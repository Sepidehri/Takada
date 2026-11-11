// Run with: npm test   (node --test)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/data.js');
require('../js/engine.js');
const SD = globalThis.SD;
const E = SD.engine;

function tagValues(t) { const o = {}; Object.keys(t).forEach((k) => (o[k] = t[k].value)); return o; }
function queryFor(id, extra) {
  const np = SD.NEW_PROJECTS[id];
  const tags = tagValues(E.suggestTags({ title: np.title, description: np.description, spot: np.spot }));
  return Object.assign({ projectId: id, title: np.title, description: np.description, tags, spot: np.spot }, extra || {});
}

test('archive has 142 invented projects with unique IDs', () => {
  assert.equal(SD.PROJECTS.length, 142);
  assert.equal(new Set(SD.PROJECTS.map((p) => p.id)).size, 142);
  assert.ok(SD.PROJECTS.find((p) => p.id === '10xxxx1'));
  assert.ok(SD.PROJECTS.find((p) => p.id === '10xx142'));
});

test('six tags are suggested from the form and SPOT, all from the vocabulary', () => {
  const np = SD.NEW_PROJECTS['10xxxxx'];
  const t = E.suggestTags({ title: np.title, description: np.description, spot: np.spot });
  assert.deepEqual(tagValues(t), {
    technology: 'heat recovery',
    utility: 'process cooling → HVAC heating',
    scope: 'Scope 1',
    area: 'utilities building',
    equipment: 'heat exchanger',
    capex: '€250–500k'
  });
  SD.TAG_TYPES.forEach((tt) => assert.ok(SD.VOCAB[tt.key].includes(t[tt.key].value), tt.key));
});

test('tags for a different domain (LED retrofit)', () => {
  const np = SD.NEW_PROJECTS['10xx151'];
  const t = tagValues(E.suggestTags({ title: np.title, description: np.description, spot: np.spot }));
  assert.equal(t.technology, 'LED lighting');
  assert.equal(t.scope, 'Scope 2');
  assert.equal(t.area, 'warehouse');
});

test('worked example: 142 → 19 candidates → 60 passages → 5 scored → 3 shown', () => {
  const idx = E.buildIndex();
  const R = E.retrieveBrief(idx, queryFor('10xxxxx'));
  assert.equal(R.steps.filter.total, 142);
  assert.equal(R.steps.filter.candidates.length, 19);
  assert.equal(R.steps.search.matched, 60);
  assert.equal(R.steps.rerank.scored.length, 5);
  assert.deepEqual(R.refs.map((r) => r.pid), ['10xxxx1', '10xxxx2', '10xxxx3']);
  assert.equal(R.notFound.kind, 'combo');
});

test('offline brief: lessons, questions and conditions, all cited', async () => {
  const idx = E.buildIndex();
  const out = await E.rag.brief(idx, queryFor('10xxxxx'), null);
  const b = out.brief;
  assert.equal(out.writer.mode, 'offline');
  assert.equal(b.refs.length, 3);
  assert.match(b.refs[0].lesson.text, /summer/);
  assert.deepEqual(b.refs[0].chips.map((c) => c.chip), ['SPOT 10XXXX1', 'DECK P. 6', 'DIARY · CLOSEOUT']);
  assert.deepEqual(b.refs[1].chips.map((c) => c.chip), ['SPOT 10XXXX2', 'DIARY · GO-LIVE']);
  assert.deepEqual(b.refs[2].chips.map((c) => c.chip), ['SPOT 10XXXX3', 'DECK P. 9']);
  assert.deepEqual(b.conditions.map((c) => c.ref), [2, 1, 3]);
  assert.equal(b.questions.length, 3);
  assert.equal(b.deleted.length, 0);
});

test('citation check deletes a sentence without a source', async () => {
  const idx = E.buildIndex();
  const fake = async (prompt) => {
    // A Claude-shaped answer with one uncited line at the end
    const off = E.offline.brief(idx, E.retrieveBrief(idx, queryFor('10xxxxx')), prompt);
    off.content.push({ text: 'Heat-recovery projects usually pay back within three years.\n', citations: [] });
    return { content: off.content, model: 'test-model' };
  };
  const out = await E.rag.brief(idx, queryFor('10xxxxx'), fake);
  assert.equal(out.writer.mode, 'claude');
  assert.deepEqual(out.brief.deleted, ['Heat-recovery projects usually pay back within three years.']);
});

test('writer errors fall back to the offline writer', async () => {
  const idx = E.buildIndex();
  const out = await E.rag.brief(idx, queryFor('10xxxxx'), async () => { throw new Error('network down'); });
  assert.equal(out.writer.mode, 'offline');
  assert.match(out.writer.fallback, /network down/);
  assert.equal(out.brief.refs.length, 3);
});

test('Ask: requalification answer comes from SPOT, with two sources', async () => {
  const idx = E.buildIndex();
  const q = 'Which heat-recovery projects since 2019 needed requalification, and how long did it take?';
  const out = await E.rag.ask(idx, q, null, null);
  const text = out.answer.sentences.map((s) => s.text).join(' ');
  assert.equal(out.A.intent, 'requal');
  assert.deepEqual(out.A.rows, ['10xxxx3', '10xxxx7']);
  assert.match(text, /^Two projects needed requalification: 10xxxx3, about four months, and 10xxxx7, about three months\. No other records found\.$/);
  assert.ok(out.answer.usedSpot);
  const chips = out.answer.sources.map((s) => s.chip);
  assert.ok(chips.includes('DECK P. 9'));
  assert.ok(chips.includes('DIARY · GO-LIVE'));
});

test('Ask: honest "not found" when nothing passes the floor', async () => {
  const idx = E.buildIndex();
  for (const q of ['Did any project use hydrogen?', 'Has the site ever built a wind turbine?', 'What did the cafeteria dishwasher replacement cost?']) {
    const out = await E.rag.ask(idx, q, null, null);
    assert.ok(out.answer.notFound, q);
  }
});

test('Ask: Claude-style "NOT FOUND" reply is respected', async () => {
  const idx = E.buildIndex();
  const out = await E.rag.ask(idx, 'What went wrong with seasonal heat demand?', null, async () => ({ content: [{ text: 'NOT FOUND', citations: [] }], model: 't' }));
  assert.ok(out.answer.notFound);
});

test('Gate B demo set: at least 70 % relevant and 90 % correct not-found', async () => {
  const idx = E.buildIndex();
  let rel = 0, relN = 0, nf = 0, nfN = 0;
  for (const t of SD.GATE_B_TESTS) {
    const out = await E.rag.ask(idx, t.q, null, null);
    if (t.expect === 'notfound') { nfN++; if (out.answer.notFound) nf++; }
    else {
      relN++;
      const pids = new Set(out.answer.sources.flatMap((s) => (s.rows ? s.rows : [s.pid])));
      if (t.expect.some((e) => pids.has(e))) rel++;
      else console.log('miss:', t.q, [...pids]);
    }
  }
  assert.ok(rel / relN >= 0.7, `relevant ${rel}/${relN}`);
  assert.ok(nf / nfN >= 0.9, `not found ${nf}/${nfN}`);
});

test('Write: diary entry 1 drafted from form, decision and references', async () => {
  const input = {
    projectId: '10xxxxx', title: SD.NEW_PROJECTS['10xxxxx'].title, description: SD.NEW_PROJECTS['10xxxxx'].description,
    meeting: '2026-11-26', co2: 180, unverified: true,
    decision: { option: 'conditions', conditions: [
      { short: 'Four weeks of cooling-load measurement', long: 'Measure the process-cooling load for four weeks, including weekends and shutdowns.', pid: '10xxxx2', ref: 2 },
      { short: 'Winter and summer split of the savings', long: 'Split the expected savings into winter and summer.', pid: '10xxxx1', ref: 1 },
      { short: 'QA check of the pipe route', long: 'QA checks whether the pipe route crosses a GMP-classified area.', pid: '10xxxx3', ref: 3 }
    ] },
    refsUsed: [{ pid: '10xxxx1', lesson: 'Heat demand falls in summer.', short: 'heat demand only October to April' }, { pid: '10xxxx2', lesson: 'Load below design basis.', short: 'source load below the design basis' }]
  };
  const out = await E.rag.draft(input, null);
  assert.match(out.draft.text, /^Decision \(Review 1, 26\.11\.2026\): go to deepening with three conditions\./);
  assert.match(out.draft.text, /References used: 10xxxx1 \(heat demand only october to april\), 10xxxx2/);
  assert.match(out.draft.text, /stays unverified until measured\.$/);
  assert.ok(out.draft.words > 50 && out.draft.words < 150);
});

test('the loop: a confirmed entry is found by the next project', async () => {
  const p = {
    id: '10xxxxx', title: SD.NEW_PROJECTS['10xxxxx'].title, meeting: '2026-11-26', co2: 180, contact: 'lh',
    tags: tagValues(E.suggestTags({ title: SD.NEW_PROJECTS['10xxxxx'].title, description: SD.NEW_PROJECTS['10xxxxx'].description, spot: SD.NEW_PROJECTS['10xxxxx'].spot })),
    decision: { option: 'conditions', conditions: [{ short: 'Four weeks of cooling-load measurement' }, { short: 'Winter and summer split of the savings' }, { short: 'QA check of the pipe route' }] },
    entryText: 'Decision (Review 1, 26.11.2026): go to deepening with three conditions. (1) Measure the process-cooling load for four weeks, including weekends and shutdowns.'
  };
  const idx = E.buildIndex([E.recordFromDiary(p)]);
  assert.equal(idx.projects.length, 143);
  const R = E.retrieveBrief(idx, queryFor('10xx150'));
  assert.ok(R.refs.some((r) => r.pid === '10xxxxx'), 'entry 1 of 10xxxxx appears for 10xx150: ' + R.refs.map((r) => r.pid));
});

test('LED project finds LED references, not heat recovery', () => {
  const idx = E.buildIndex();
  const R = E.retrieveBrief(idx, queryFor('10xx151'));
  assert.ok(R.refs.length >= 1);
  R.refs.forEach((r) => assert.equal(idx.proj[r.pid].tags.technology, 'LED lighting'));
});

test('Claude tag prompt and validation stay inside the vocabulary', () => {
  const np = SD.NEW_PROJECTS['10xxxxx'];
  const p = E.tagPrompt({ title: np.title, description: np.description, spot: np.spot });
  assert.deepEqual(p.schema.properties.technology.enum, SD.VOCAB.technology);
  assert.equal(E.validateTags({ technology: 'nuclear', utility: 'x' }), null);
  const ok = E.validateTags({ technology: 'heat recovery', utility: 'process cooling → HVAC heating', scope: 'Scope 1', area: 'utilities building', equipment: 'heat exchanger', capex: '€250–500k', reasons: {} });
  assert.equal(ok.technology.from, 'Claude');
});

test('Markdown around the brief format is tolerated', async () => {
  const idx = E.buildIndex();
  const fake = async (prompt) => {
    const off = E.offline.brief(idx, E.retrieveBrief(idx, queryFor('10xxxxx')), prompt);
    off.content.forEach((b) => { b.text = b.text.replace(/^(\n?)REF/, '$1**REF').replace(/: $/, ':** '); });
    return { content: off.content, model: 'test-model' };
  };
  const out = await E.rag.brief(idx, queryFor('10xxxxx'), fake);
  assert.equal(out.brief.refs.filter((r) => r.lesson).length, 3);
  assert.equal(out.brief.conditions.length, 3);
});

test('marker writer: [S#] markers become citations; unmarked sentences are deleted', async () => {
  const idx = E.buildIndex();
  const q = 'Which heat-recovery projects since 2019 needed requalification, and how long did it take?';
  const write = async (prompt) => {
    const text = E.markerPrompt(prompt);
    assert.match(text, /\[S1\] SPOT query/);
    assert.match(text, /A sentence or line without a marker is deleted/);
    const reply = 'Here is what the records show. Two projects needed requalification: 10xxxx3, about four months [S2], and 10xxxx7, about three months [S3]. No other records found [S1].';
    return { content: E.markersToContent(reply, prompt.sources), model: 'test' };
  };
  const out = await E.rag.ask(idx, q, null, write);
  const text = out.answer.sentences.map((s) => s.text).join(' ');
  assert.equal(text, 'Two projects needed requalification: 10xxxx3, about four months, and 10xxxx7, about three months. No other records found.');
  assert.deepEqual(out.answer.deleted, ['Here is what the records show.']);
  assert.deepEqual(out.answer.sources.map((s) => s.chip), ['DECK P. 9', 'DIARY · GO-LIVE', 'SPOT QUERY']);
});

test('marker writer works with the line format of the brief', async () => {
  const idx = E.buildIndex();
  const write = async (prompt) => {
    const i = prompt.sources.findIndex((s) => s.id === '10xxxx1:d-closeout' && s.ref === 1) + 1;
    const reply = `REF 1 LESSON: Heat demand fell in summer, so savings came only from October to April [S${i}]\nREF 1 QUESTION: Is there heat demand at the sink all year? [S${i}]\nREF 1 CONDITION: Winter and summer split || Split the expected savings into winter and summer. [S${i}]\nThis kind of project usually pays back fast.`;
    return { content: E.markersToContent(reply, prompt.sources), model: 'test' };
  };
  const out = await E.rag.brief(idx, queryFor('10xxxxx'), write);
  assert.match(out.brief.refs[0].lesson.text, /October to April/);
  assert.equal(out.brief.refs[0].condition.short, 'Winter and summer split');
  assert.deepEqual(out.brief.deleted, ['This kind of project usually pays back fast.']);
});

test('tag prompt text lists the vocabulary', () => {
  const np = SD.NEW_PROJECTS['10xxxxx'];
  const t = E.tagPromptText({ title: np.title, description: np.description, spot: np.spot });
  assert.match(t, /technology: heat recovery \| heat pump/);
  assert.match(t, /Reply with only a JSON object/);
});
