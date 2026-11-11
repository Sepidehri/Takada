/*
 * Smart Diary · concept demo application
 * ILLUSTRATIVE DATA: all projects, IDs, people and figures are invented.
 */
(function () {
  'use strict';
  const SD = window.SD;
  const E = SD.engine;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const DEMO = '10xxxxx';
  const NEXT = '10xx150';

  /* ================================================================ */
  /* State                                                             */
  /* ================================================================ */
  const KEY = 'smart-diary-demo-v1';
  const fresh = () => ({ view: 'home', pid: DEMO, projects: {}, indexed: [], log: [], notes: false, guided: null, recTab: 'records', drafts: 0 });
  let S = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.projects) return Object.assign(fresh(), s, { guided: null });
    } catch (e) { /* storage blocked */ }
    return fresh();
  })();
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }, 150);
  }
  function newProject(id) {
    return {
      id, form: { spotId: '', title: '', description: '', contact: '', meeting: '', minutes: '', stars: 0, attachments: [] },
      spot: null, tags: null, tagsFrom: null, tagsConfirmed: false, panel: { open: false, tab: 'compare' },
      compare: null, used: [], notRelevant: [], asks: [], decision: null, entry: null
    };
  }
  function proj(id) {
    id = id || S.pid;
    if (!S.projects[id]) S.projects[id] = newProject(id);
    return S.projects[id];
  }
  const UI = {
    modal: null, drawer: null, editing: false, live: null, askBusy: false, drafting: false, tagBusy: false,
    callout: null, heroQ: '', homeRes: null, showPipe: false, expanded: {}, lookupErr: '', dec: null,
    rec: { q: '', tech: '', status: '' }, gateB: null, typing: null, contact: null
  };

  /* ================================================================ */
  /* RAG client: Claude through the local server, or offline           */
  /* ================================================================ */
  const RAG = { server: false, mode: 'offline', model: null, checked: false };
  function checkServer() {
    if (!/^https?:$/.test(location.protocol)) { RAG.checked = true; return; }
    fetch('api/health', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.ok) { RAG.server = true; RAG.mode = j.llm ? 'claude' : 'offline'; RAG.model = j.model; } })
      .catch(() => {})
      .then(() => { RAG.checked = true; refresh('foot'); });
  }
  function postJSON(url, body, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 60000);
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal })
      .then((r) => {
        clearTimeout(t);
        if (!r.ok) return r.json().then((j) => { throw new Error(j.error || 'HTTP ' + r.status); }, () => { throw new Error('HTTP ' + r.status); });
        return r.json();
      }, (e) => { clearTimeout(t); throw new Error(e.name === 'AbortError' ? 'the request timed out' : e.message); });
  }
  let IDX = null, IDXKEY = '';
  function index() {
    const k = S.indexed.map((r) => r.id).join(',');
    if (!IDX || k !== IDXKEY) { IDX = E.buildIndex(S.indexed); IDXKEY = k; }
    return IDX;
  }
  const CACHE = {};
  function cached(key, fn) {
    if (CACHE[key]) return Promise.resolve(CACHE[key]);
    return fn().then((r) => (CACHE[key] = r));
  }
  const viaServer = () => RAG.mode === 'claude';
  function genBrief(q) {
    index();
    return cached('b|' + IDXKEY + '|' + JSON.stringify(q) + RAG.mode, () => (viaServer()
      ? postJSON('api/rag/brief', { query: q, extras: S.indexed }, 120000).catch((err) => E.rag.brief(index(), q, () => Promise.reject(err)))
      : E.rag.brief(index(), q, null)));
  }
  function genAsk(question, ctx) {
    index();
    return cached('a|' + IDXKEY + '|' + question + '|' + ctx + RAG.mode, () => (viaServer()
      ? postJSON('api/rag/ask', { question, context: ctx, extras: S.indexed }, 90000).catch((err) => E.rag.ask(index(), question, ctx, () => Promise.reject(err)))
      : E.rag.ask(index(), question, ctx, null)));
  }
  function genDraft(input) {
    return cached('d|' + JSON.stringify(input) + RAG.mode, () => (viaServer()
      ? postJSON('api/rag/draft', { input }, 90000).catch((err) => E.rag.draft(input, () => Promise.reject(err)))
      : E.rag.draft(input, null)));
  }
  function genTags(form) {
    const offline = (fallback) => ({ tags: E.suggestTags(form), writer: { mode: 'offline', model: 'rule-based tagger', fallback } });
    return cached('t|' + JSON.stringify(form) + RAG.mode, () => (viaServer()
      ? postJSON('api/rag/tags', { form }, 60000).catch((err) => offline(err.message))
      : Promise.resolve(offline())));
  }

  /* ================================================================ */
  /* Small helpers                                                     */
  /* ================================================================ */
  const anim = { skip: false, pending: [] };
  function sleep(ms) {
    if (anim.skip || !ms) return Promise.resolve();
    return new Promise((res) => {
      const item = { res, t: setTimeout(() => { anim.pending = anim.pending.filter((x) => x !== item); res(); }, ms) };
      anim.pending.push(item);
    });
  }
  function skipAnim() {
    anim.skip = true;
    anim.pending.forEach((p) => { clearTimeout(p.t); p.res(); });
    anim.pending = [];
  }
  async function typeInto(sel, text, cps) {
    const el0 = $(sel);
    if (el0) el0.focus({ preventScroll: true });
    for (let i = 1; i <= text.length; i++) {
      const el = $(sel);
      if (!el) return;
      if (anim.skip) { el.value = text; break; }
      el.value = text.slice(0, i);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(1000 / (cps || 40));
    }
    const el = $(sel);
    if (el) { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); el.blur(); }
  }
  function flash(sel) {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  }
  let toastT = null;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.innerHTML = `<div class="toast"><span class="box on">✓</span>${esc(msg)}</div>`;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.innerHTML = ''; }, 3400);
  }
  const tagValues = (t) => { const o = {}; Object.keys(t || {}).forEach((k) => (o[k] = t[k].value)); return o; };
  const fmtDate = E.fmtDate;
  const dayName = (iso) => (iso ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(iso + 'T12:00:00').getDay()] + ' ' + fmtDate(iso) : '');
  const nowStr = () => { const d = new Date(); return d.toLocaleDateString('de-AT') + ' ' + d.toTimeString().slice(0, 5); };
  function addLog(action, detail, sources) {
    S.log.unshift({ at: nowStr(), who: 'L. Hofer (PM)', action, detail, sources: sources || [] });
    S.log = S.log.slice(0, 200);
    save();
  }
  function writerText(w) {
    if (!w) return '';
    if (w.mode === 'claude') return `Written by Claude (${esc(w.model)}) from the retrieved passages · ${(w.ms / 1000).toFixed(1)} s`;
    if (w.mode === 'none') return 'Nothing passed the similarity floor, so no text was written';
    return `Offline writer: extractive, no language model${w.fallback ? ` · Claude unavailable (${esc(w.fallback)})` : ''}`;
  }
  const PULSE = '<svg viewBox="0 0 26 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="M1 15h6.5L12 3l4.5 12H25"/></svg>';
  const DB = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>';
  function waves() {
    let p = '';
    for (let i = 0; i < 15; i++) {
      const y = 10 + i * 24;
      p += `<path d="M0 ${y} C 220 ${y - 34}, 420 ${y + 34}, 640 ${y} S 1020 ${y - 26}, 1240 ${y}" stroke="#fff" fill="none" stroke-width="1"/>`;
    }
    return `<svg class="waves" viewBox="0 0 1240 360" preserveAspectRatio="none" aria-hidden="true">${p}</svg>`;
  }
  const PULSELINE = '<svg class="pulse-line" viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0 72 H150 C 166 72, 168 68, 172 52 L 184 8 L 196 52 C 200 68, 203 72, 218 72 H1000" stroke="#d8232a" stroke-width="7" fill="none"/></svg>';

  /* ================================================================ */
  /* Stage, header and stepper                                         */
  /* ================================================================ */
  function currentStage(p) {
    if (S.view === 'loop') return 'loop';
    if (UI.modal === 'decision') return 'decide';
    if (p.panel.open) {
      if (p.panel.tab === 'ask') return 'ask';
      if (p.panel.tab === 'write') return 'write';
      return UI.live || !p.compare ? 'search' : 'brief';
    }
    return p.tags && !p.tagsConfirmed ? 'tags' : 'input';
  }
  function sceneInfo(p) {
    if (S.guided) return SD.SCENES[S.guided.scene];
    const st = currentStage(p);
    return SD.SCENES.find((s) => s.id === st);
  }
  const STEPS = ['INPUT', 'COMPARE', 'ASK', 'DECIDE', 'WRITE', 'LOOP'];
  function stephead() {
    const p = proj();
    const sc = sceneInfo(p) || SD.SCENES[1];
    const active = sc.step || 1;
    return `<div class="stephead" id="stephead">
      <div class="grow">
        <div class="label">${esc(sc.label)}</div>
        <h1>${esc(sc.headline)}</h1>
      </div>
      <div>
        <div class="stepper">${STEPS.map((s, i) => `<button class="${active === i + 1 ? 'on' : ''}" data-act="step" data-step="${i + 1}"><b>${i + 1}</b>${s}</button>`).join('')}</div>
        <div style="text-align:right;margin-top:.35rem"><a class="small" data-act="home">‹ Main page</a></div>
      </div>
    </div>`;
  }

  /* ================================================================ */
  /* Shell                                                             */
  /* ================================================================ */
  function topnav(active) {
    const items = [['compare', 'COMPARE'], ['ask', 'ASK'], ['write', 'WRITE'], ['records', 'RECORDS'], ['pilot', 'PILOT']];
    return `<header class="topnav">
      <a class="logo" data-act="home"><b>Smart Diary</b><small>SSC APP</small></a>
      <nav>${items.map(([k, l]) => `<a class="${active === k ? 'on' : ''}" data-act="nav" data-to="${k}">${l}</a>`).join('')}</nav>
      <span class="grow"></span>
      <button class="btn outline" data-act="guided-start">${S.guided ? 'Restart demo' : 'Concept demo'}</button>
    </header>`;
  }
  function foot() {
    const live = RAG.mode === 'claude';
    return `<footer class="foot" id="foot">
      <span><b>Smart Diary</b> · concept mock-up for Takeda Vienna · AI-supported knowledge management in the SSC Project Review</span>
      <span class="grow"></span>
      <button class="mode" data-act="rag-info" title="How retrieval and generation work in this demo"><span class="dot ${live ? 'live' : ''}"></span>${live ? 'RAG · Claude ' + esc(RAG.model || '') : RAG.checked ? 'RAG · offline writer' : 'RAG · checking…'}</button>
      <span class="illus">ILLUSTRATIVE DATA · ALL PROJECTS, IDS AND FIGURES INVENTED</span>
    </footer>`;
  }
  function presenter() {
    if (!S.guided) return '';
    const i = S.guided.scene, sc = SD.SCENES[i];
    return `<div class="presenter" id="presenter">
      ${S.notes ? `<div class="say"><small>SAY · SCENE ${i + 1} OF ${SD.SCENES.length}</small>${esc(sc.say)}</div>` : ''}
      <div class="pbar">
        <button data-act="guided-prev" title="Previous scene (←)">◀</button>
        <span class="sc"><b>${i + 1}/${SD.SCENES.length}</b> · ${esc(sc.name)}</span>
        <button data-act="guided-next" title="Next scene (→, Space, clicker)">▶</button>
        <button data-act="notes" title="Speaker line (N)">${S.notes ? 'Hide line' : 'Line'}</button>
        <button data-act="guided-exit" title="Leave presenter mode">✕</button>
      </div>
    </div>`;
  }
  function render() {
    const app = $('#app');
    const v = S.view;
    let html = '';
    if (v === 'home') html = topnav('') + `<main class="view">${homeView()}</main>`;
    else if (v === 'work') html = `<main class="view">${workView()}</main>`;
    else if (v === 'loop') html = `<main class="view">${loopView()}</main>`;
    else if (v === 'records') html = topnav('records') + `<main class="view">${recordsView()}</main>`;
    else if (v === 'pilot') html = topnav('pilot') + `<main class="view">${pilotView()}</main>`;
    app.innerHTML = html + foot() + `<div id="overlay">${overlay()}</div><div id="toast"></div>` + presenter();
    afterRender();
  }
  function refresh(part) {
    const map = {
      foot: ['#foot', foot], panel: ['#sdpanel', panel], tags: ['#tags', tagsStrip], stephead: ['#stephead', stephead],
      overlay: ['#overlay', () => `<div id="overlay">${overlay()}</div>`], presenter: ['#presenter', presenter], cited: ['#cited', citedBox]
    };
    const m = map[part];
    if (!m) return render();
    const el = $(m[0]);
    if (!el) { if (part === 'presenter' && S.guided) return render(); return; }
    const scroll = part === 'panel' && $('.sd-body') ? $('.sd-body').scrollTop : 0;
    el.outerHTML = m[1]();
    if (part === 'panel') { const b = $('.sd-body'); if (b) b.scrollTop = scroll; }
    afterRender();
  }
  function afterRender() {
    if (UI.openPanelNext) {
      UI.openPanelNext = false;
      const pnl = $('#sdpanel');
      if (pnl) requestAnimationFrame(() => requestAnimationFrame(() => pnl.classList.add('open')));
    }
  }

  /* ================================================================ */
  /* Home                                                              */
  /* ================================================================ */
  function projectStatus(p) {
    if (!p) return ['Not started', 'grey'];
    if (p.entry && S.indexed.some((r) => r.id === p.id)) return ['Entry 1 indexed', 'green'];
    if (p.entry && p.entry.status === 'confirmed') return ['Entry 1 confirmed', 'green'];
    if (p.decision) return ['Review 1 decided', 'dark'];
    if (p.compare) return ['Brief ready', 'outline'];
    if (p.tagsConfirmed) return ['Tags confirmed', 'outline'];
    if (p.form.title) return ['Draft', 'grey'];
    return ['Not started', 'grey'];
  }
  function homeView() {
    const rows = Object.keys(SD.NEW_PROJECTS).map((id) => ({ id, np: SD.NEW_PROJECTS[id], p: S.projects[id] }))
      .concat(Object.keys(S.projects).filter((id) => !SD.NEW_PROJECTS[id]).map((id) => ({ id, np: null, p: S.projects[id] })));
    const idx = index();
    return `
    <section class="hero">
      <div class="hero-dark">${waves()}
        <div class="kicker" style="position:relative">Concept demo · Takeda Vienna · SSC Project Review</div>
        <h1>Every new SSC project starts from what Takeda has already learned</h1>
        ${PULSELINE}
      </div>
      <div class="hero-red">
        <label for="hero-q">Find comparable projects for</label>
        <input id="hero-q" value="${esc(UI.heroQ)}" placeholder="e.g. heat recovery for HVAC pre-heating" data-bind="heroQ">
        <label for="hero-site">Site and project family</label>
        <select id="hero-site"><option>Takeda Vienna · Utilities &amp; HVAC</option><option>Takeda Vienna · all project families</option></select>
        <div><button class="btn on-red" data-act="hero-search">Search Takeda records</button></div>
      </div>
    </section>
    <div class="wrap">
      <h2 class="red">Smart Diary in the SSC App</h2>
      <p class="intro">Compare, Ask and Write: comparable past projects, their lessons and their sources, on screen before <a data-act="open-project" data-pid="${DEMO}">Review 1</a>. A walk-through of one project from input to SSC decision.</p>
      ${UI.homeRes ? homeResults() : ''}
      <div class="grid-2">
        <div>
          <div class="section-title">Your SSC projects</div>
          <table class="tbl">
            <thead><tr><th>SPOT ID</th><th>Title</th><th>Meeting</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows.map((r) => {
              const st = projectStatus(r.p);
              const title = (r.p && r.p.form.title) || (r.np ? r.np.title : 'New SSC project');
              const meet = (r.p && r.p.form.meeting) || (r.np && r.np.meeting) || '';
              return `<tr class="click" data-act="open-project" data-pid="${esc(r.id)}"><td class="mono">${esc(r.np ? r.np.spotId : (r.p && r.p.form.spotId) || '—')}</td><td>${esc(title)}${r.np ? `<div class="small">${esc(r.np.label)}</div>` : ''}</td><td class="small">${esc(dayName(meet))}</td><td><span class="badge ${st[1]}">${st[0]}</span></td><td><a>Open ›</a></td></tr>`;
            }).join('')}</tbody>
          </table>
          <div style="margin-top:.8rem;display:flex;gap:.5rem"><button class="btn outline sm" data-act="new-project">+ New SSC project</button></div>
        </div>
        <div>
          <div class="section-title">Present it</div>
          <div class="fcard">
            <span class="badge red">Presenter mode</span>
            <h4>One project, from input to decision, in ten scenes</h4>
            <p>Press <span class="kbd">→</span>, <span class="kbd">Space</span> or your clicker to run the next scene. <span class="kbd">←</span> goes back. <span class="kbd">N</span> shows your line from the cue card. <span class="kbd">F</span> is full screen. Pressing <span class="kbd">→</span> while a scene runs finishes it at once.</p>
            <div style="margin-top:.8rem;display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn" data-act="guided-start">▶ Start the guided demo</button><button class="btn ghost sm" data-act="reset-demo">Reset demo data</button></div>
          </div>
          <div class="fcard" style="margin-top:.8rem">
            <span class="badge outline">The archive</span>
            <h4>${idx.projects.length} indexed projects · ${idx.N} passages</h4>
            <p>SPOT records, approval decks, SSC decisions and diary entries. All invented. <a data-act="nav" data-to="records">Browse the records ›</a></p>
          </div>
        </div>
      </div>
      <div class="section-title">Three functions on the six steps Takeda already runs</div>
      <div class="grid-3">
        <div class="fcard"><span class="badge red">Compare</span><h4>The reference brief</h4><p>The three to five most comparable past projects: promised vs achieved, one lesson, the source down to the page.</p></div>
        <div class="fcard"><span class="badge dark">Ask</span><h4>Questions in plain language</h4><p>Answered only from Takeda’s records, each sentence with its source. Counts come from SPOT. Honest “not found”.</p></div>
        <div class="fcard"><span class="badge outline">Write</span><h4>Four short diary entries</h4><p>Drafted by AI from what is already written, at gates that already exist. Nothing is published until the PM confirms.</p></div>
      </div>
    </div>`;
  }
  function homeResults() {
    const R = UI.homeRes;
    const idx = index();
    return `<div class="fcard" style="margin-bottom:1.6rem">
      <div style="display:flex;align-items:center;gap:.6rem"><span class="badge red">Retrieval preview</span><b>${esc(R.query.title)}</b><span class="grow"></span><button class="btn ghost xs" data-act="home-clear">Close</button></div>
      <p class="small" style="margin:.4rem 0 .6rem">Tags: ${SD.TAG_TYPES.map((t) => esc(R.query.tags[t.key] || '—')).join(' · ')} · ${R.steps.filter.candidates.length} candidates · ${R.steps.search.matched} passages · ${R.refs.length} above the floor</p>
      ${R.refs.length ? R.refs.map((ref) => {
        const r = idx.proj[ref.pid];
        const p = idx.byId[ref.passages.find((id) => idx.byId[id].kind !== 'spot') || ref.passages[0]];
        return `<div class="mini-ref"><b>${ref.rank} · ${esc(r.title)} · ${r.year}</b> <span class="small">score ${ref.score.toFixed(2)}</span><small>${esc(p.text.slice(0, 160))}${p.text.length > 160 ? '…' : ''}</small></div>`;
      }).join('') : `<div class="mini-ref nf"><b>Not found</b><small>${esc(R.notFound ? R.notFound.text : 'No past project passes the similarity floor.')}</small></div>`}
      <div style="margin-top:.5rem"><button class="btn sm" data-act="home-new-from-search">Create an SSC project with this title ›</button></div>
    </div>`;
  }

  /* ================================================================ */
  /* Workspace: SSC Project Presentation + Smart Diary panel          */
  /* ================================================================ */
  function workView() {
    const p = proj();
    const dec = p.decision;
    return `<div class="work">
      ${stephead()}
      <div class="workbg">
        <section class="card">
          <div class="card-head">
            <h2>SSC Project Presentation</h2><span class="ver">Version 2.0 · with Smart Diary (concept)</span>
            <span class="grow"></span>
            ${dec ? `<span class="badge dark">Review 1: ${dec.option === 'conditions' ? 'go with ' + dec.conditions.length + ' conditions' : dec.option === 'hold' ? 'hold and rework' : 'go as proposed'}</span>` : ''}
            <button class="btn outline sm" data-act="open-decision">SSC Review 1</button>
            <button class="btn outline sm" data-act="ssc-info">SSC information</button>
            <button class="btn outline sm" data-act="home">Back to main page</button>
          </div>
          <div class="card-info"><span>So that the Sustainability Steering Committee can assess the sustainability aspects of your project, please fill in the fields:</span><span>✓ &nbsp; ✕</span></div>
          <div class="card-main">
            ${formGrid(p)}
            ${p.panel.open ? '' : `<button class="sd-open-tab" data-act="panel-open">SMART DIARY</button>`}
            ${panel()}
            ${UI.callout ? `<div class="callout" data-act="callout-close"><small>${esc(UI.callout.title)}</small><p>${esc(UI.callout.text)}</p></div>` : ''}
          </div>
        </section>
      </div>
    </div>`;
  }
  function formGrid(p) {
    const f = p.form;
    const np = SD.NEW_PROJECTS[p.id];
    const empty = !f.spotId && !f.title;
    const c = SD.CONTACTS.find((x) => x.id === f.contact);
    return `<div class="form-grid" id="formgrid">
      <div class="col">
        <div class="field"><label><span class="req">*</span>SPOT ID ${np && empty && !S.guided ? `<a class="hint" style="float:right;font-weight:600;color:var(--red)" data-act="fill-example">Fill in the example ›</a>` : ''}</label>
          <div class="row"><input id="f-spot" class="grow" data-bind="form.spotId" value="${esc(f.spotId)}" placeholder="10xxxxx"><button class="btn" id="btn-lookup" data-act="lookup">SPOT data lookup</button></div>
          ${UI.lookupErr ? `<div class="err">${esc(UI.lookupErr)}</div>` : ''}</div>
        <div class="field"><label><span class="req">*</span>Title</label><input id="f-title" data-bind="form.title" value="${esc(f.title)}"></div>
        <div class="field"><label>Project description / comments</label><textarea id="f-desc" data-bind="form.description" rows="3">${esc(f.description)}</textarea></div>
        <div class="field"><label><span class="req">*</span>Contact person / project manager</label>
          <div class="contact">${c ? `<span class="initials">${esc(c.initials)}</span>` : ''}<select id="f-contact" class="grow" data-bind="form.contact" style="width:auto;flex:1"><option value="">Select…</option>${SD.CONTACTS.map((x) => `<option value="${x.id}" ${x.id === f.contact ? 'selected' : ''}>${esc(x.name)} · ${esc(x.role)}</option>`).join('')}</select></div></div>
        ${tagsStrip()}
      </div>
      <div class="col">
        <div class="field"><label><span class="req">*</span>Preferred meeting <span class="hint">(held every Thursday at 14:35)</span></label>
          <select id="f-meeting" data-bind="form.meeting"><option value="">Select a Thursday…</option>${SD.MEETINGS.concat(f.meeting && SD.MEETINGS.indexOf(f.meeting) < 0 ? [f.meeting] : []).map((d) => `<option value="${d}" ${d === f.meeting ? 'selected' : ''}>${dayName(d)}</option>`).join('')}</select></div>
        <div class="field"><label><span class="req">*</span>How much time (in minutes) should we plan for the presentation?</label><input id="f-min" data-bind="form.minutes" value="${esc(f.minutes)}" placeholder="max. 20 min"></div>
        <div class="field"><label>How sustainable do you rate your project?</label><div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-act="star" data-n="${n}" aria-label="${n} stars">${n <= f.stars ? '★' : '☆'}</button>`).join('')}</div></div>
        <div class="field"><label><span class="req">*</span>Attachments</label><div class="attach">${f.attachments.map((a) => `<span class="file-chip"><i></i>${esc(a)}</span>`).join('')}<a data-act="attach">+ Attach file</a></div></div>
        <div>
          <div class="redbar">Potential reductions – from SPOT</div>
          <div class="trip" style="margin-top:.55rem">
            <div class="field"><label>CO₂ reduction in SPOT</label><input readonly value="${p.spot ? esc(p.spot.co2 + ' t CO₂e / year') : ''}"></div>
            <div class="field"><label>CAPEX</label><input readonly value="${p.spot ? esc(p.spot.capex) : ''}"></div>
            <div class="field"><label>Area</label><input readonly value="${p.spot ? esc(p.spot.area) : ''}"></div>
          </div>
          ${p.spot ? `<div class="small" style="margin-top:.3rem">SPOT baseline: ${esc(p.spot.energy)} · the CO₂ figure is the PM’s estimate</div>` : ''}
        </div>
        ${citedBox()}
      </div>
    </div>`;
  }
  function citedBox() {
    const p = proj();
    if (!p.used.length || !p.compare) return '<div id="cited"></div>';
    const refs = p.compare.brief.refs;
    return `<div class="cited-box" id="cited"><h6>Cited references · for the approval deck</h6><ul>${p.used.map((pid) => {
      const r = refs.find((x) => x.pid === pid);
      return r ? `<li><b>${esc(pid)}</b> · ${esc(r.title)} (${r.year}) · ${r.chips.map((c) => esc(c.chip.replace(/^SPOT /, 'SPOT ').toLowerCase())).join(' · ')}</li>` : '';
    }).join('')}</ul></div>`;
  }
  function tagsStrip() {
    const p = proj();
    const ready = !!String(p.form.title || '').trim();
    if (!p.tags) {
      if (!ready || S.guided) return '<div id="tags"></div>';
      return `<div id="tags" class="tags-strip"><div class="tags-top"><span class="badge red">New</span><h5>Smart Diary · six tags</h5><span class="grow"></span><button class="btn sm" data-act="suggest-tags">Suggest six tags</button></div>
        <div class="tags-sub">Suggested from the form fields and the SPOT figures, from Takeda’s controlled vocabulary. The PM confirms or corrects them.</div></div>`;
    }
    const all = SD.TAG_TYPES.every((t) => p.tags[t.key] && p.tags[t.key].checked && p.tags[t.key].value);
    const from = p.tagsFrom || {};
    return `<div id="tags" class="tags-strip ${p.tagsConfirmed ? 'confirmed' : ''}">
      <div class="tags-top"><span class="badge red">New</span><h5>${p.tagsConfirmed ? '6 tags confirmed' : '6 tags suggested'} · Takeda controlled vocabulary</h5><span class="grow"></span>
        ${p.tagsConfirmed ? '<button class="btn sm done" data-act="unconfirm-tags">Confirmed</button>' : `<button class="btn sm" id="btn-confirm-tags" data-act="confirm-tags" ${all ? '' : 'disabled'}>Confirm all</button>`}</div>
      <div class="tags-sub">From the form fields and the SPOT figures. The PM confirms or corrects them. ${UI.tagBusy ? '<span class="spin"></span> Claude is checking the tags…' : from.mode === 'claude' ? `Checked by Claude (${esc(from.model)}).` : from.fallback ? 'Rule-based (Claude unavailable).' : 'Rule-based tagger.'}</div>
      <div class="tags-grid">${SD.TAG_TYPES.map((t) => {
        const v = p.tags[t.key] || { value: '' };
        const opts = SD.VOCAB[t.key];
        return `<div class="tag" title="${esc(v.reason || ('from ' + (v.from || '')))}"><span class="tk">${t.label}</span>
          <select data-tag="${t.key}" ${p.tagsConfirmed ? 'disabled' : ''}><option value="">choose…</option>${opts.map((o) => `<option ${o === v.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
          <span class="from">${esc(v.from === 'Claude' ? 'Claude' : v.from || '')}</span>
          <button class="box ${v.checked ? 'on' : ''}" data-act="tag-toggle" data-k="${t.key}" ${p.tagsConfirmed ? 'disabled' : ''} aria-label="confirm ${t.label}">${v.checked ? '✓' : ''}</button></div>`;
      }).join('')}</div>
      ${p.tagsConfirmed && !p.panel.open && !S.guided ? `<div class="tags-foot">Smart Diary is ready. <button class="btn sm" data-act="panel-open" data-tab="compare">Find comparable projects ›</button></div>` : ''}
    </div>`;
  }

  /* ---------- Panel ---------- */
  function panel() {
    const p = proj();
    const tab = p.panel.tab;
    const n = p.compare ? p.compare.brief.refs.length : 0;
    const sub = tab === 'ask' ? 'Ask · answers come only from Takeda records, each with its source'
      : tab === 'write' ? 'Write · nothing is published until its owner confirms it'
        : UI.live ? 'Searching SPOT, approval decks, SSC decisions and diary entries …'
          : p.compare ? (n ? `${n} comparable project${n > 1 ? 's' : ''} found · every line has a source` : 'No comparable project above the floor')
            : 'Compare · comparable past projects, their lessons and their sources';
    const openCls = p.panel.open && !UI.openPanelNext ? 'open' : '';
    return `<aside class="sdpanel ${openCls}" id="sdpanel" aria-label="Smart Diary">
      <div class="sd-head">
        <div class="sd-logo">${PULSE}Smart Diary</div>
        <div class="sd-tabs">${['compare', 'ask', 'write'].map((t) => `<button class="${tab === t ? 'on' : ''}" data-act="tab" data-tab="${t}">${t.toUpperCase()}</button>`).join('')}<button class="sd-close" data-act="panel-close" title="Close">×</button></div>
        <div class="sd-sub">${esc(sub)}</div>
      </div>
      <div class="sd-body">${tab === 'ask' ? askBody(p) : tab === 'write' ? writeBody(p) : compareBody(p)}</div>
      ${tab === 'ask' ? `<form class="askbar" data-form="ask"><input id="ask-q" placeholder="Ask about previous projects …" autocomplete="off"><button class="btn" type="submit" ${UI.askBusy ? 'disabled' : ''}>Ask</button></form>` : ''}
    </aside>`;
  }

  function compareBody(p) {
    if (!p.tagsConfirmed) {
      return `<div class="sd-empty"><p>Compare starts from the six confirmed tags.</p><p class="small">Fill in the SPOT ID, run the SPOT lookup and confirm the tags in the form.</p></div>`;
    }
    if (UI.live || (UI.showPipe && p.compare)) return pipelineView(p);
    if (!p.compare) {
      return `<div class="sd-empty"><p>Compare this project with ${index().projects.length} indexed past projects.</p><button class="btn" data-act="run-compare">Find comparable projects</button></div>`;
    }
    return briefView(p);
  }

  function pipelineView(p) {
    const live = UI.live;
    const R = live ? live.R : p.compare.R;
    const res = live ? live.res : p.compare;
    const step = live ? live.step : 6;
    const elapsed = live ? (Date.now() - live.t0) / 1000 : (p.compare.ms || 0) / 1000;
    const idx = index();
    const q = R.query;
    const sc = R.steps.rerank.scored;
    const shown = sc.filter((x) => x.shown).length;
    const del = res ? res.brief.deleted.length : 0;
    const rows = [
      ['Build the query', 'Form fields, confirmed tags, SPOT figures', `${esc(q.tags.technology)} · ${esc(String(q.tags.utility).replace(' heating', ''))} · ${esc(q.tags.capex)}`],
      ['Filter by tags', 'Same technology class or utility', `<span class="hot">${R.steps.filter.total}</span> indexed projects → <span class="hot">${R.steps.filter.candidates.length}</span> candidates${R.steps.filter.widened ? ' (widened)' : ''}`],
      ['Hybrid search', 'Keyword (BM25) + semantic, over cards, decks, decisions, diary', `<span class="hot">${R.steps.filter.candidates.length}</span> projects → <span class="hot">${R.steps.search.matched}</span> matching passages`],
      ['Re-rank, apply floor', 'Weak matches below the floor are dropped', `${sc.length} scored → <span class="hot">${shown} shown</span>, ${sc.length - shown} too weak <span class="minibars">${sc.map((x) => `<i class="${x.shown ? '' : 'weak'}" style="height:${Math.round(x.score * 100)}%"></i>`).join('')}<span class="fl" style="bottom:${Math.round(R.steps.rerank.floor * 100)}%"></span></span>`],
      ['Write the brief', 'Only from those passages, one source per sentence', res ? (del ? `<s>${del} sentence${del > 1 ? 's' : ''} without a source</s> → deleted` : 'Citation check: every line has a source') + ` · ${res.writer.mode === 'claude' ? 'Claude' : res.writer.mode === 'none' ? 'nothing to write' : 'offline writer'}` : step >= 4 ? `<span class="spin"></span> ${viaServer() ? 'Claude is writing from ' + R.refs.length * 3 + '+ passages…' : 'Writing…'}` : ''],
      ['Log', 'What was shown, to whom and when', 'Audit trail kept with the SSC record']
    ];
    const details = [
      () => `<div><b>Terms:</b> ${q.terms.map(esc).join(', ')}</div><div style="margin-top:.3rem"><b>Concepts:</b> ${q.concepts.map(esc).join(', ')}</div><div style="margin-top:.3rem"><b>Tags:</b> ${SD.TAG_TYPES.map((t) => esc(q.tags[t.key])).join(' · ')} · <b>SPOT:</b> ${esc(q.spot.co2 || '?')} t CO₂e, ${esc(q.spot.capex || '?')}</div>`,
      () => `<div class="chiplist">${R.steps.filter.candidates.map((id) => `<button class="chip" data-act="record" data-pid="${id}" title="${esc(idx.proj[id] ? idx.proj[id].title : '')}">${id}</button>`).join('')}</div>`,
      () => `<table class="tbl"><thead><tr><th>Passage</th><th>Keyword</th><th>Semantic</th><th>Score</th></tr></thead><tbody>${R.steps.search.top.map((x) => `<tr class="click" data-act="source" data-id="${esc(x.id)}"><td>${esc(x.label)}</td><td class="mono">${x.lex.toFixed(2)}</td><td class="mono">${x.sem.toFixed(2)}</td><td class="mono"><b>${x.score.toFixed(2)}</b></td></tr>`).join('')}</tbody></table><div class="small" style="margin-top:.3rem">Top 12 of ${R.steps.search.matched}. Score = ½ keyword + ½ semantic. German and English share one concept vocabulary.</div>`,
      () => `<table class="tbl"><thead><tr><th>Project</th><th>Tags</th><th>Text</th><th style="width:40%">Score vs floor ${R.steps.rerank.floor.toFixed(2)}</th></tr></thead><tbody>${sc.map((x) => `<tr><td><b>${x.pid}</b><div class="small">${esc(x.title)}</div></td><td class="mono">${x.tag.toFixed(2)}</td><td class="mono">${x.text.toFixed(2)}</td><td><div class="scorebar"><span class="${x.shown ? '' : 'weak'}" style="width:${x.score * 100}%"></span><i class="floor" style="left:${R.steps.rerank.floor * 100}%"></i></div><div class="small">${x.score.toFixed(2)} · ${x.shown ? 'shown' : 'too weak, dropped'}</div></td></tr>`).join('')}</tbody></table><div class="small" style="margin-top:.3rem">Re-rank = 0.55 × tag match + 0.45 × text match. Tags before semantics.</div>`,
      () => res ? `<div>${writerText(res.writer)}</div>${res.brief.deleted.length ? `<div class="deleted">Deleted: ${res.brief.deleted.map((d) => `<s>${esc(d)}</s>`).join(' · ')}</div>` : '<div class="deleted">No sentence was deleted: every line of the brief cites a retrieved passage.</div>'}` : '',
      () => `<div>${esc(S.log[0] ? S.log[0].at + ' · ' + S.log[0].who + ' · ' + S.log[0].action + ' · ' + S.log[0].detail : 'Logged when the brief is shown.')}</div><a data-act="nav" data-to="log">Open the audit log ›</a>`
    ];
    return `<div class="pipe-head"><b>Comparing with past Takeda projects</b><span class="timer" id="timer">${elapsed.toFixed(1)} s</span></div>
      ${rows.map((r, i) => {
        const n = i + 1;
        const state = step >= n ? 'done' : step >= n - 1 ? 'active' : 'pending';
        const open = !live && UI.expanded[n];
        return `<div class="pstep ${state}"><div class="pstep-row" data-act="expand" data-step="${n}"><span class="ck">${state === 'done' ? '✓' : ''}</span><div><b>${r[0]}</b><small>${r[1]}</small></div><div class="pres">${state === 'pending' ? '' : r[2]}</div></div>${open ? `<div class="pdetail">${details[i]()}</div>` : ''}</div>`;
      }).join('')}
      ${!live ? `<div style="display:flex;gap:.5rem;margin-top:.4rem"><button class="btn sm" data-act="toggle-pipe">Show the reference brief ›</button><span class="small" style="align-self:center">Click a step to see what it did.</span></div>` : ''}`;
  }

  function figHTML(r) {
    if (r.achieved != null) {
      return `<span class="bar"><span style="width:${Math.min(100, r.pct)}%"></span></span><span class="fig">Promised ${r.promised} t · achieved ${r.achieved} t (${r.pct} %)</span>`;
    }
    return `<span class="bar none"></span><span class="fig none">${r.status === 'closed' ? 'Achieved: not recorded' : 'Achieved: not yet (' + esc(r.status) + ')'}</span>`;
  }
  function chipBtn(c, hl) {
    const p = index().byId[c.id];
    return `<button class="chip ${p && p.lang === 'de' ? 'de' : ''}" data-act="source" data-id="${esc(c.id)}" data-hl="${esc(hl || '')}"><i></i>${esc(c.chip)}</button>`;
  }
  function briefView(p) {
    const b = p.compare.brief;
    const lessonCite = (ref, id) => { const s = ref.lesson && ref.lesson.sources.find((x) => x.id === id); return s ? s.cited : ''; };
    const refsHTML = b.refs.map((r) => {
      const used = p.used.includes(r.pid), nr = p.notRelevant.includes(r.pid);
      return `<article class="ref ${used ? 'used' : ''} ${nr ? 'notrel' : ''}" id="ref-${r.rank}">
        <div class="ref-top"><span class="num">${r.rank}</span><h4>${esc(r.title)}</h4><span class="yr">${r.year}</span><span class="grow"></span>
          <button class="btn xs ${used ? 'done' : 'outline'}" data-act="use-ref" data-pid="${r.pid}" id="use-${r.rank}">${used ? '✓ Reference' : 'Use as reference'}</button>
          <button class="btn xs ghost" data-act="notrel" data-pid="${r.pid}">${nr ? 'Undo' : 'Not relevant'}</button></div>
        <div>${figHTML(r)}</div>
        <p class="lesson">${r.lesson ? esc(r.lesson.text) : '<span class="muted">No lesson could be cited for this reference.</span>'}</p>
        <div class="chips">${r.chips.map((c) => chipBtn(c, lessonCite(r, c.id))).join('')}<span class="grow"></span>${r.owner ? `<a class="small" data-act="contact" data-pid="${r.pid}">Ask: ${esc(r.owner.dept)}</a>` : ''}</div>
        ${nr ? '<div class="small" style="margin-top:.3rem">Marked not relevant. The rating feeds the Gate B quality check.</div>' : ''}
      </article>`;
    }).join('');
    const w = p.compare.writer;
    return `${b.refs.length ? refsHTML : ''}
      <div class="brief-foot">
        <div><h5>Questions to settle before Review 2</h5>${b.questions.length ? `<ol>${b.questions.map((q) => `<li>${esc(q.text)}<span class="refchip">REF ${q.ref}</span></li>`).join('')}</ol>` : '<span class="small">No question could be cited.</span>'}</div>
        <div class="nf">${b.notFound ? `<h5>Not found</h5>${esc(b.notFound.text).replace(/(\d+ t)/, '<b>$1</b>')}` : '<h5>Closest precedent</h5>A completed project with the same heat source and sink exists. Compare its figures before Review 2.'}</div>
      </div>
      <div class="writer-line"><span class="dot ${w.mode === 'claude' ? 'live' : ''}"></span>${writerText(w)} · ${b.deleted.length} sentence${b.deleted.length === 1 ? '' : 's'} without a source deleted · <a data-act="toggle-pipe">How these ${b.refs.length} were found</a></div>`;
  }

  /* ---------- Ask ---------- */
  function askContext(p) {
    const t = tagValues(p.tags);
    return [t.technology, t.utility, t.area].filter(Boolean).join(' · ');
  }
  function askBody(p) {
    const ctx = askContext(p);
    let html = `<div class="ctx"><span class="badge grey">Context</span>${esc(ctx || 'whole archive')}</div>`;
    if (!p.asks.length) {
      html += `<p class="small">Ask in plain language, in English or German. Smart Diary answers only from Takeda’s records; counts come from SPOT queries; if nothing passes the similarity floor it says “not found”.</p>
        <div class="suggest">${SD.ASK_SUGGESTIONS.map((q) => `<button data-act="ask-suggest" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
    }
    p.asks.forEach((a) => {
      html += `<div class="msg-user"><small>L. HOFER · PM</small><div class="bubble">${esc(a.q)}</div></div>`;
      if (a.pending) { html += `<div class="msg-ans"><span class="spin"></span> Searching Takeda records${viaServer() ? ' · Claude is writing from the retrieved passages' : ''}…</div>`; return; }
      const ans = a.answer;
      if (ans.notFound) {
        html += `<div class="notfound-card"><b>NOT FOUND</b><div>No Takeda record answers this question. Nothing passed the similarity floor, so Smart Diary does not guess. Ask the owners of comparable projects, or rephrase.</div><div class="writer-line">${writerText(a.writer)}</div></div>`;
        return;
      }
      html += `<div class="msg-ans"><span class="lbl">Smart Diary · answered from Takeda records only</span>
        <p>${ans.sentences.map((s) => esc(s.text) + s.cites.map((n) => `<span class="cn" title="source ${n}">${n}</span>`).join('')).join(' ')}</p>
        <ul class="srcs">${ans.sources.map((s) => `<li><span class="num">${s.n}</span>${s.kind === 'query' ? `<button class="chip" data-act="query-src" data-ask="${p.asks.indexOf(a)}" data-n="${s.n}"><i></i>SPOT QUERY</button>` : `<button class="chip">${esc('SPOT ' + String(s.pid).toUpperCase())}</button>${s.kind !== 'spot' ? chipBtn(s, s.cited) : ''}`}<span class="snip">${esc(s.cited)}</span></li>`).join('')}</ul>
        ${ans.usedSpot ? `<div class="dbnote">${DB} Counts come from SPOT fields; the model only phrases them.</div>` : ''}
        <div class="writer-line"><span class="dot ${a.writer.mode === 'claude' ? 'live' : ''}"></span>${writerText(a.writer)}${ans.deleted.length ? ` · deleted without a source: ${ans.deleted.map((d) => `<s>${esc(d)}</s>`).join(' · ')}` : ''}</div>
      </div>`;
    });
    return html;
  }

  /* ---------- Write ---------- */
  function entryHTML(text) {
    return esc(text).replace(/^(Decision \([^)]*\):)/, '<b>$1</b>').replace(/(References used:)/, '<b>$1</b>');
  }
  function writeBody(p) {
    const e = p.entry;
    const gates = [['After Review 1', '5 min'], ['At Review 2', '10 min'], ['At go-live', '10 min'], ['Closeout · Step 6', '10 min']];
    let html = `<div class="gates">${gates.map((g, i) => `<div class="gate ${i === 0 && e && e.status === 'confirmed' ? 'on' : ''}" title="${['Decision, conditions, references used · drafted from the SSC App and the meeting outcome', 'Chosen option, rejected options and why · drafted from the approval deck', 'Surprises in implementation and qualification · drafted from handover notes', 'Promised vs achieved, advice to the next project · drafted from SPOT and the sustainability dashboard'][i]}"><span class="gk">${i === 0 && e && e.status === 'confirmed' ? '✓' : i + 1}</span><b>${g[0].toUpperCase()}</b><small>${g[1]}</small></div>`).join('')}</div>`;
    if (!p.decision) {
      return html + `<div class="sd-empty"><p>Diary entry 1 is drafted after the SSC decision at Review 1.</p><button class="btn" data-act="open-decision">Record the Review 1 decision</button></div>`;
    }
    if (UI.drafting) return html + `<div class="entry"><span class="spin"></span> Drafting entry 1 from the SSC App form, the Review 1 outcome and the references used${viaServer() ? ' · Claude' : ''}…</div>`;
    if (!e) return html + `<div class="sd-empty"><p>Draft entry 1 from what is already written.</p><button class="btn" data-act="draft">Draft diary entry 1</button></div>`;
    const tags = tagValues(p.tags);
    const typing = UI.typing && UI.typing.pid === p.id;
    const indexed = S.indexed.some((r) => r.id === p.id);
    return html + `<div class="entry">
      <div class="entry-top"><h5>DIARY ENTRY 1 · AFTER SSC REVIEW 1</h5><span class="grow"></span>
        ${e.status === 'confirmed' ? `<span class="badge dark">✓ Confirmed by PM · ${indexed ? 'indexed, searchable' : 'indexed tonight'}</span>` : '<span class="badge outline">Draft · not published</span>'}</div>
      ${UI.editing ? `<textarea id="entry-edit">${esc(e.text)}</textarea>` : `<p class="entry-text ${typing ? 'caret' : ''}" id="entry-text">${typing ? esc(e.text.slice(0, UI.typing.n)) : entryHTML(e.text)}</p>`}
      <div class="tagchips">${SD.TAG_TYPES.map((t) => `<span>${esc(tags[t.key])}</span>`).join('')}</div>
      <div class="entry-meta"><span>Drafted from: ${esc((e.draftedFrom || []).map((x) => x.toLowerCase()).join(' · ') || 'SSC App form · Review 1 outcome · references used')}</span><span><b>${e.words}</b> / 150 words</span></div>
      ${e.deleted && e.deleted.length ? `<div class="deleted">Deleted without a source: ${e.deleted.map((d) => `<s>${esc(d)}</s>`).join(' · ')}</div>` : ''}
      <div class="writer-line"><span class="dot ${e.writer && e.writer.mode === 'claude' ? 'live' : ''}"></span>${writerText(e.writer)}${e.edited ? ' · edited by the PM' : ''}</div>
      <div class="entry-actions">
        ${e.status === 'confirmed'
          ? `<button class="btn outline sm" data-act="go-loop">Step 6 feeds Step 1 ›</button>`
          : UI.editing ? `<button class="btn ghost sm" data-act="cancel-edit">Cancel</button><button class="btn sm" data-act="save-edit">Save text</button>`
            : `<button class="btn ghost sm" data-act="edit-entry">Edit</button><button class="btn" id="btn-confirm-entry" data-act="confirm-entry">Confirm entry</button>`}
      </div>
    </div>`;
  }

  /* ================================================================ */
  /* Overlays: decision, source drawer, record, info                   */
  /* ================================================================ */
  function overlay() {
    if (UI.drawer) return drawerHTML();
    if (UI.modal === 'decision') return decisionHTML();
    if (UI.modal === 'ssc') return infoModal('SSC information', 'Sustainability Steering Committee', `<p>The SSC meets every Thursday at 14:35. Each project gets up to 20 minutes.</p><p><b>Review 1 · Planning:</b> sustainability potentials are identified. <b>Review 2 · Investment approval:</b> the business case is approved.</p><p>With Smart Diary, the pre-read of Review 1 contains the reference brief: the same page for the PM and for every SSC member. The SSC keeps full decision authority; Smart Diary changes what is on the table.</p>`);
    if (UI.modal === 'contact') return contactHTML();
    if (UI.modal === 'rag') return ragInfo();
    return '';
  }
  function infoModal(title, sub, body) {
    return `<div class="scrim" data-act="close-overlay"><div class="modal narrow" data-stop="1"><div class="m-head"><h3>${esc(title)}</h3><p>${esc(sub)}</p><button class="m-close" data-act="close-overlay">×</button></div><div class="m-body">${body}</div></div></div>`;
  }
  function contactHTML() {
    const r = index().proj[UI.contact];
    if (!r || !r.owner) return '';
    return infoModal(r.owner.name, r.owner.role, `<p>Owner of <b>${esc(r.id)}</b> · ${esc(r.title)} (${r.year}).</p><p>Smart Diary names the person who knows why an option was rejected and what went wrong: the knowledge that today sits only in people’s heads. Call before Review 2.</p><p class="small">Invented person for the demo.</p>`);
  }
  function ragInfo() {
    const live = RAG.mode === 'claude';
    return infoModal('How the RAG works in this demo', live ? `Live · Claude ${RAG.model}` : 'Offline writer · no language model connected', `
      <p><b>1–4 · Retrieve</b> runs for real on ${index().projects.length} invented projects and ${index().N} passages: tag filter, hybrid search (BM25 keyword + bilingual concept vectors), re-rank, similarity floor. Counts and totals are queries on SPOT fields.</p>
      <p><b>5 · Generate.</b> ${live ? `The retrieved passages go to <b>Claude (${esc(RAG.model)})</b> as search-result blocks with citations on. Claude writes only from them.` : 'No API key is connected, so an extractive writer composes the text from the retrieved passages. Start the server with an API key to let Claude write.'} Then the citation check runs: <b>a sentence without a source is deleted</b>. If nothing passes the floor, the answer is “not found”.</p>
      <p><b>6 · Log.</b> Every brief, answer, decision and entry goes to the audit log.</p>
      ${live ? '' : `<p class="small">To use Claude: <span class="kbd">npm install</span>, put <span class="kbd">ANTHROPIC_API_KEY=…</span> in <span class="kbd">.env</span>, run <span class="kbd">npm start</span> and open http://localhost:3000. If the network fails during the pitch, the app falls back to the offline writer on its own.</p>`}`);
  }
  function decisionHTML() {
    const p = proj();
    const b = p.compare && p.compare.brief;
    const D = UI.dec || { option: null, checked: {}, custom: [] };
    const conds = (b ? b.conditions : []).concat(D.custom.map((c) => ({ short: c, long: c, ref: null, custom: true })));
    const lastAsk = p.asks.filter((a) => a.answer && !a.answer.notFound).slice(-1)[0];
    const meet = p.form.meeting || SD.MEETINGS[1];
    const opt = (v, label) => `<div class="radio ${D.option === v ? 'on' : ''}" data-act="dec-opt" data-v="${v}" id="opt-${v}"><i></i>${label}</div>`;
    return `<div class="scrim" data-act="close-overlay"><div class="modal" data-stop="1">
      <div class="m-head"><h3>SSC Review 1 · Decision</h3><p>${dayName(meet)} · 14:35 · ${esc(p.form.minutes || 20)} min · ${esc(p.form.title)}</p><button class="m-close" data-act="close-overlay">×</button></div>
      <div class="m-body m-cols">
        <div>
          <h6 class="cap">Decision</h6>
          ${opt('proposed', 'Go to deepening as proposed')}${opt('conditions', 'Go to deepening <b>with conditions</b>')}${opt('hold', 'Hold and rework')}
          <h6 class="cap" style="margin-top:1rem">Conditions · suggested from the Smart Diary brief</h6>
          ${conds.length ? conds.map((c, i) => `<div class="cond" data-act="dec-cond" data-i="${i}" id="cond-${i}"><span class="box ${D.checked[i] ? 'on' : ''}">${D.checked[i] ? '✓' : ''}</span><span class="grow">${esc(c.short)}</span>${c.ref ? `<span class="refchip">REF ${c.ref}</span>` : '<span class="badge grey">added</span>'}</div>`).join('') : '<div class="small">No conditions in the brief.</div>'}
          <form class="addcond" data-form="addcond"><input id="addcond" placeholder="Add a condition…"><button class="btn ghost sm" type="submit">Add</button></form>
          <div style="margin-top:1.2rem"><button class="btn" id="btn-save-dec" data-act="dec-save" ${D.option ? '' : 'disabled'}>Save decision</button></div>
        </div>
        <div>
          <h6 class="cap">In the pre-read · Smart Diary brief</h6>
          ${b ? b.refs.map((r) => `<div class="mini-ref"><b>${r.rank} · ${esc(r.title)} · ${r.year}</b><small>${r.pct != null ? 'Achieved ' + r.pct + ' %' : 'Achieved not recorded'} · ${esc(r.lesson ? r.lesson.text : '')}</small></div>`).join('') : ''}
          ${b && b.notFound ? `<div class="mini-ref nf"><b>Not found</b><small>${esc(b.notFound.text)}</small></div>` : ''}
          <h6 class="cap" style="margin-top:.9rem">Asked in the meeting</h6>
          <div class="mini-ref">${lastAsk ? `<small>${esc(lastAsk.q)}</small><b>${esc(lastAsk.answer.sentences.map((s) => s.text).join(' ').slice(0, 220))}</b>` : '<small>Nothing asked yet.</small>'}</div>
          <p class="small">The SSC keeps full decision authority. Smart Diary changes what is on the table.</p>
        </div>
      </div></div></div>`;
  }
  function highlight(text, hl) {
    const sents = E.sentences(text);
    const H = String(hl || '');
    return sents.map((s) => {
      const on = (H && (H.indexOf(s) >= 0 || s.indexOf(H) >= 0)) || (!H && /^Assumption/.test(s));
      return on ? `<mark>${esc(s)}</mark>` : esc(s);
    }).join(' ');
  }
  function drawerHTML() {
    const d = UI.drawer;
    const idx = index();
    let head = '', body = '', footBtns = '';
    if (d.type === 'record') {
      const r = idx.proj[d.pid];
      if (!r) return '';
      const ps = idx.passages.filter((x) => x.pid === r.id);
      head = `<small>SPOT RECORD</small><h3>${esc(r.id)} · ${esc(r.title)}</h3><p>${r.year} · ${esc(r.status)}</p>`;
      body = `<dl class="kv">${SD.TAG_TYPES.map((t) => `<dt>${t.label}</dt><dd>${esc(r.tags[t.key])}</dd>`).join('')}
        <dt>Promised</dt><dd>${r.promised} t CO₂e / year</dd><dt>Achieved</dt><dd>${r.achieved != null ? r.achieved + ' t (' + E.pct(r) + ' %)' : 'not recorded'}</dd>
        <dt>Requalification</dt><dd>${r.requal ? 'yes, about ' + r.requal.months + ' months' : 'no'}</dd><dt>Owner</dt><dd>${r.owner ? esc(r.owner.name + ', ' + r.owner.role) : '—'}</dd></dl>
        <h6 class="cap" style="margin-top:1.1rem">Sources (${ps.length})</h6>
        ${ps.filter((x) => x.kind !== 'spot').map((x) => `<div class="mini-ref" style="cursor:pointer" data-act="source" data-id="${esc(x.id)}"><b>${esc(x.chip)}</b> <span class="small">${esc(x.date || '')}${x.lang === 'de' ? ' · German' : ''}</span><small>${esc(x.text)}</small></div>`).join('')}`;
    } else if (d.type === 'query') {
      head = `<small>SOURCE · SPOT QUERY</small><h3>${esc(d.src.title)}</h3><p>Counts and totals are queries on SPOT fields.</p>`;
      body = `<div class="diarycard">${d.src.cited ? esc(d.src.cited) : ''}</div>
        <table class="tbl" style="margin-top:.8rem"><thead><tr><th>SPOT ID</th><th>Title</th><th>Year</th></tr></thead><tbody>${(d.src.rows || []).map((id) => { const r = idx.proj[id]; return r ? `<tr class="click" data-act="record" data-pid="${id}"><td class="mono">${id}</td><td>${esc(r.title)}</td><td>${r.year}</td></tr>` : ''; }).join('')}</tbody></table>`;
    } else {
      const x = idx.byId[d.id];
      if (!x) return '';
      const r = idx.proj[x.pid];
      head = `<small>SOURCE</small><h3>${esc(x.chip)}</h3><p>${esc(r.id)} · ${esc(r.title)} · ${r.year}</p>`;
      if (x.kind === 'deck') {
        body = `<div class="slide"><div class="sh"><span>APPROVAL DECK · ${esc(r.id.toUpperCase())} · ${esc(r.title.toUpperCase())}</span><span>p. ${x.page}</span></div><p>${highlight(x.text, d.hl)}</p></div>
          <p class="small" style="margin-top:.7rem">Stored with the SSC record, ${esc(x.date || '')}.${x.lang === 'de' ? ' German original; the brief is written in English.' : ''}</p>`;
      } else if (x.kind === 'spot') {
        body = `<dl class="kv">${SD.TAG_TYPES.map((t) => `<dt>${t.label}</dt><dd>${esc(r.tags[t.key])}</dd>`).join('')}<dt>Promised</dt><dd>${r.promised} t CO₂e / year</dd><dt>Achieved</dt><dd>${r.achieved != null ? r.achieved + ' t (' + E.pct(r) + ' %)' : 'not recorded'}</dd><dt>Owner</dt><dd>${r.owner ? esc(r.owner.name + ', ' + r.owner.role) : '—'}</dd></dl><p class="small" style="margin-top:.8rem">SPOT is the single point of truth for CO₂, energy, water and waste per project.</p>`;
      } else {
        body = `<div class="diarycard"><div class="small" style="margin-bottom:.3rem"><b>${x.kind === 'diary' ? 'Diary entry · ' + esc(x.gate) : 'SSC decision · ' + esc(x.gate)}</b> · ${esc(x.date || '')}${x.kind === 'diary' ? ' · confirmed by the project owner' : ''}${x.lang === 'de' ? ' · German' : ''}</div>${highlight(x.text, d.hl)}</div>`;
      }
      footBtns = `<button class="btn ghost sm" data-act="record" data-pid="${r.id}">Whole record</button><button class="btn outline sm" data-act="cite" data-id="${esc(x.id)}">Cite in my deck</button>`;
      const p = proj();
      if (p.compare && p.compare.brief.refs.some((rf) => rf.pid === r.id)) {
        const used = p.used.includes(r.id);
        footBtns += `<button class="btn sm ${used ? 'done' : ''}" data-act="use-ref" data-pid="${r.id}">${used ? '✓ Reference' : 'Use as reference'}</button>`;
      }
    }
    return `<div class="scrim drawer-scrim" data-act="close-overlay"><aside class="drawer" data-stop="1"><div class="d-head">${head}<button class="m-close" data-act="close-overlay">×</button></div><div class="d-body">${body}</div>${footBtns ? `<div class="d-foot">${footBtns}</div>` : ''}</aside></div>`;
  }

  /* ================================================================ */
  /* Loop, records, pilot                                              */
  /* ================================================================ */
  function loopView() {
    const p = proj(DEMO);
    const confirmed = p.entry && p.entry.status === 'confirmed';
    const indexed = S.indexed.some((r) => r.id === DEMO);
    const node = (n, title, sub, what, fns, hl, st, pos) => `<div class="lnode ${hl ? 'hl' : ''}" style="${pos || ''}"><h4><span class="num" style="background:${n === 2 || n === 4 ? 'var(--red)' : n === 6 ? '#8f1218' : 'var(--char)'}">${n}</span>${title}</h4><p>${sub}</p><div class="what">${what}</div><div class="chips">${fns}</div>${st ? `<span class="st">${st}</span>` : ''}</div>`;
    const C = '<span class="badge red">Compare</span>', A = '<span class="badge dark">Ask</span>', W = '<span class="badge outline">Write</span>';
    return `<div class="work" style="height:auto;min-height:calc(100vh - 2.3rem)">${stephead()}
      <div class="loopbg">
        <div class="loop">
          <div class="back-arrow anim"></div>
          ${node(1, 'Project idea', 'Initial technical solution is sketched out', 'Compare opens after the SPOT lookup', C)}
          <div class="arrow">→</div>
          ${node(2, 'SSC Review 1 · Planning', 'Sustainability potentials are identified', 'Brief in the pre-read · diary entry 1', C + W, false, confirmed ? '<span class="badge green">✓ entry 1</span>' : '')}
          <div class="arrow">→</div>
          ${node(3, 'Deepening & Evaluation', 'Alternatives, data and business case', 'Ask · call the owners of the references', A)}
          <div class="down">↓</div>
          ${node(6, 'Monitoring & Lessons Learned', 'Knowledge transfer into future projects', 'Entry 4, indexed overnight, back to step 1', W, false, indexed ? '<span class="badge green">indexed</span>' : '', 'grid-row:3;grid-column:1')}
          <div class="arrow" style="grid-row:3;grid-column:2">←</div>
          ${node(5, 'Implementation', 'Project realisation incl. qualification', 'Diary entry 3 at go-live', W, false, '', 'grid-row:3;grid-column:3')}
          <div class="arrow" style="grid-row:3;grid-column:4">←</div>
          ${node(4, 'SSC Review 2 · Investment approval', 'Decision and approval of the business case', 'Citations in the approval deck · entry 2', A + W, true, '', 'grid-row:3;grid-column:5')}
        </div>
        <div class="loopnote"><b class="r">Step 6 → Step 1</b><span>Takeda: insights “should feed into the next project approval process”. Today no function does this. Every confirmed diary entry is indexed overnight and shows up at the next project’s Review 1.</span></div>
        <div class="livebox">
          <div><div class="stepn">1 · DIARY ENTRY 1</div><p>${confirmed ? `Confirmed by the PM for ${DEMO}.` : 'Not confirmed yet.'}</p>${confirmed ? '<span class="badge green">✓ Confirmed</span>' : `<button class="btn sm" data-act="go-write">Go to Write</button>`}</div>
          <div><div class="stepn">2 · TONIGHT’S INDEX</div><p>${indexed ? `Entry 1 is in the index: ${index().projects.length} projects.` : 'Adds confirmed entries to the search index. In the pilot this runs every night.'}</p>${indexed ? '<span class="badge green">✓ Searchable</span>' : `<button class="btn sm" data-act="index-tonight" ${confirmed ? '' : 'disabled'}>Run tonight’s index now</button>`}</div>
          <div><div class="stepn">3 · THE NEXT PROJECT</div><p>${esc(SD.NEW_PROJECTS[NEXT].spotId)} · ${esc(SD.NEW_PROJECTS[NEXT].title)}. Its brief should now cite ${DEMO}.</p><button class="btn sm" data-act="start-next" ${confirmed ? '' : 'disabled'}>Start the next project ›</button></div>
        </div>
      </div></div>`;
  }

  function recordsView() {
    const idx = index();
    const f = UI.rec;
    const q = E.norm(f.q);
    const rows = idx.projects.filter((r) => (!f.tech || r.tags.technology === f.tech) && (!f.status || r.status === f.status) &&
      (!q || E.norm(r.id + ' ' + r.title + ' ' + Object.values(r.tags).join(' ')).indexOf(q) >= 0));
    const tab = S.recTab;
    return `<div class="wrap">
      <h2 class="red">Takeda’s own records</h2>
      <p class="intro">What Smart Diary searches: ${idx.projects.length} indexed projects with ${idx.N} passages from SPOT, approval decks, SSC decisions and diary entries. All invented for the demo.</p>
      <div class="tabs"><button class="${tab === 'records' ? 'on' : ''}" data-act="rec-tab" data-tab="records">Records</button><button class="${tab === 'log' ? 'on' : ''}" data-act="rec-tab" data-tab="log">Audit log (${S.log.length})</button></div>
      ${tab === 'log' ? (S.log.length ? `<table class="tbl"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>What was shown</th></tr></thead><tbody>${S.log.map((l) => `<tr><td class="mono small">${esc(l.at)}</td><td>${esc(l.who)}</td><td><b>${esc(l.action)}</b></td><td>${esc(l.detail)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nothing logged yet. Every brief, answer, decision and entry is logged here.</p>') : `
      <div class="filters">
        <input data-bind="rec.q" value="${esc(f.q)}" placeholder="Search ID, title or tag" style="min-width:18rem">
        <select data-bind="rec.tech"><option value="">All technologies</option>${SD.VOCAB.technology.map((t) => `<option ${t === f.tech ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <select data-bind="rec.status"><option value="">All statuses</option>${['closed', 'live', 'in implementation', 'in deepening'].map((s) => `<option ${s === f.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <span class="small">${rows.length} shown</span>
      </div>
      <table class="tbl"><thead><tr><th>SPOT ID</th><th>Title</th><th>Year</th><th>Technology</th><th>Status</th><th>Promised</th><th>Achieved</th><th>Sources</th></tr></thead>
        <tbody>${rows.map((r) => `<tr class="click" data-act="record" data-pid="${r.id}"><td class="mono">${r.id}</td><td>${esc(r.title)}</td><td>${r.year}</td><td>${esc(r.tags.technology)}</td><td class="status">${esc(r.status)}</td><td class="mono">${r.promised} t</td><td class="mono">${r.achieved != null ? r.achieved + ' t (' + E.pct(r) + ' %)' : '—'}</td><td class="mono">${r.passages.length + 1}</td></tr>`).join('')}</tbody></table>`}
    </div>`;
  }

  function pilotView() {
    const G = UI.gateB;
    return `<section class="hero">
      <div class="hero-dark">${waves()}
        <div class="kicker" style="position:relative">Today’s decision</div>
        <h1>Approve Phase 0 of Smart Diary</h1>
        <p class="lead">Four weeks, about 12 person-days, owned by Sustainability Management and DD&amp;T: a data check on 20 past projects, ending in a go/no-go.</p>
        ${PULSELINE}
      </div>
      <div class="hero-red">
        <label>What Smart Diary is</label>
        <div class="checks"><div><span class="tick">✓</span>It retrieves and cites. It never decides.</div><div><span class="tick">✓</span>Inside the SSC App. No new portal.</div><div><span class="tick">✓</span>Every line traceable to a Takeda record.</div></div>
        <div><span class="btn on-red" style="cursor:default">Pilot · Utilities &amp; HVAC · 6 months</span></div>
      </div>
    </section>
    <div class="wrap">
      <p class="tagline">The scarce resource is not intelligence.<br>It is structured, trusted, reusable knowledge.</p>
      <p class="small">Concept demo. All projects, IDs and figures are invented to show the format.</p>
      <div class="section-title">The pilot: six months, three gates, clear stop rules</div>
      <div class="gates3">
        <div class="gatecard"><span class="badge red">Gate A · week 4</span><h4>Is the data there?</h4><div class="metric"><b>≥ 70 %</b>of 20 sampled projects have a deck and SPOT figures</div><div class="metric"><b>≥ 30</b>comparable utilities and HVAC projects</div></div>
        <div class="gatecard"><span class="badge red">Gate B · week 12</span><h4>Is the quality good enough?</h4><div class="metric"><b>≥ 70 %</b>of references rated relevant on 50 test questions</div><div class="metric"><b>&lt; 5 %</b>wrong citations; every sentence traceable</div><div class="metric"><b>≥ 90 %</b>correct “not found” where no precedent exists</div></div>
        <div class="gatecard"><span class="badge red">Gate C · week 24</span><h4>Is it used?</h4><div class="metric"><b>≥ 70 %</b>of pilot proposals cite a reference</div><div class="metric"><b>≥ 50 %</b>of reviews raise a condition from the brief</div><div class="metric"><b>≤ 10 min</b>per diary entry</div></div>
      </div>
      <div class="stopbox"><b>STOP RULES</b>Gate A fails: diary only, retrieve in 12 months. Reuse under 30 % after eight live weeks: stop. Maximum exposure about €75k.</div>
      <div class="section-title">Gate B, tried on this demo</div>
      <p class="small" style="max-width:52rem">The pilot rates 50 questions with two engineers. This demo runs ${SD.GATE_B_TESTS.length} of them, three with no precedent on purpose, through the same retrieval and citation check (offline writer, so it is fast and free).</p>
      ${G ? `<div class="grid-3" style="margin:.6rem 0 1rem">
          <div class="fcard"><span class="badge ${G.rel / G.relN >= 0.7 ? 'green' : 'red'}">${G.rel / G.relN >= 0.7 ? 'Pass' : 'Fail'}</span><h4>${G.rel} of ${G.relN} relevant</h4><p>Target ≥ 70 %</p></div>
          <div class="fcard"><span class="badge ${G.bad === 0 ? 'green' : 'red'}">${G.bad === 0 ? 'Pass' : 'Fail'}</span><h4>${G.bad} wrong citations of ${G.cites}</h4><p>Target &lt; 5 %: every cited text must be in its source</p></div>
          <div class="fcard"><span class="badge ${G.nf / G.nfN >= 0.9 ? 'green' : 'red'}">${G.nf / G.nfN >= 0.9 ? 'Pass' : 'Fail'}</span><h4>${G.nf} of ${G.nfN} correct “not found”</h4><p>Target ≥ 90 %</p></div>
        </div>
        <table class="tbl"><thead><tr><th>Question</th><th>Expected</th><th>Smart Diary found</th><th></th></tr></thead><tbody>${G.rows.map((r) => `<tr><td>${esc(r.q)}</td><td class="small">${esc(r.expect)}</td><td class="small">${esc(r.got)}</td><td class="${r.ok ? 'pass' : 'fail'}">${r.ok ? '✓' : '✕'}</td></tr>`).join('')}</tbody></table>`
        : `<button class="btn" data-act="gateb-run">Run the Gate B demo check</button>`}
    </div>`;
  }

  /* ================================================================ */
  /* Flows                                                             */
  /* ================================================================ */
  function setForm(p, np) {
    Object.assign(p.form, { spotId: np.spotId, title: np.title, description: np.description, contact: np.contact, meeting: np.meeting, minutes: String(np.minutes), stars: np.stars, attachments: [np.attachment] });
  }
  function doLookup(p) {
    const id = String(p.form.spotId || '').trim();
    const np = Object.values(SD.NEW_PROJECTS).find((x) => x.spotId === id);
    if (!np) {
      UI.lookupErr = id ? `No SPOT record for “${id}”. Demo IDs: ${Object.keys(SD.NEW_PROJECTS).join(', ')}.` : 'Enter a SPOT ID first.';
      return false;
    }
    UI.lookupErr = '';
    p.spot = Object.assign({}, np.spot);
    return true;
  }
  async function fillForm(p, a) {
    const np = SD.NEW_PROJECTS[p.id] || SD.NEW_PROJECTS[DEMO];
    if (!a) { setForm(p, np); doLookup(p); render(); return; }
    await sleep(500);
    await typeInto('#f-spot', np.spotId, 12);
    await sleep(250); flash('#btn-lookup'); await sleep(300);
    doLookup(p); render();
    await sleep(600); await typeInto('#f-title', np.title, 48);
    await sleep(250); await typeInto('#f-desc', np.description, 120);
    await sleep(300); p.form.contact = np.contact; render();
    await sleep(350); p.form.meeting = np.meeting; render();
    await sleep(250); await typeInto('#f-min', String(np.minutes), 8);
    for (let n = 1; n <= np.stars; n++) { await sleep(220); p.form.stars = n; render(); }
    await sleep(300); p.form.attachments = [np.attachment]; render();
    save();
  }
  async function suggestTags(p, a) {
    const form = { title: p.form.title, description: p.form.description, spot: p.spot || {} };
    const mark = (t) => { const o = {}; Object.keys(t).forEach((k) => (o[k] = Object.assign({}, t[k], { checked: false }))); return o; };
    p.tagsConfirmed = false;
    p.tags = mark(E.suggestTags(form));
    p.tagsFrom = { mode: 'offline', model: 'rule-based tagger' };
    UI.tagBusy = viaServer();
    refresh('tags'); refresh('stephead');
    const res = await genTags(form);
    UI.tagBusy = false;
    p.tags = mark(res.tags);
    p.tagsFrom = res.writer;
    refresh('tags');
    for (const t of SD.TAG_TYPES) {
      if (a) await sleep(280);
      if (p.tags[t.key].value) p.tags[t.key].checked = true;
      if (a) refresh('tags');
    }
    refresh('tags');
    save();
  }
  async function confirmTags(p, a) {
    if (a) { await sleep(500); flash('#btn-confirm-tags'); await sleep(350); }
    SD.TAG_TYPES.forEach((t) => { if (p.tags[t.key]) p.tags[t.key].checked = true; });
    p.tagsConfirmed = true;
    addLog('Tags confirmed', SD.TAG_TYPES.map((t) => p.tags[t.key].value).join(' · '));
    refresh('tags'); refresh('stephead');
  }
  function queryOf(p) {
    return { projectId: p.id, title: p.form.title, description: p.form.description, tags: tagValues(p.tags), spot: p.spot ? { co2: p.spot.co2, capex: p.spot.capex, area: p.spot.area } : {} };
  }
  let timerI = null;
  function openPanel(p, tab) {
    const wasOpen = p.panel.open;
    p.panel.open = true;
    p.panel.tab = tab || p.panel.tab;
    if (!wasOpen) UI.openPanelNext = true;
  }
  async function runCompare(p, a, keepPipe) {
    if (!p.tagsConfirmed) { toast('Confirm the six tags first.'); return; }
    const q = queryOf(p);
    openPanel(p, 'compare');
    p.compare = null; p.used = []; p.notRelevant = [];
    const R = E.retrieveBrief(index(), q);
    const gen = genBrief(q);
    UI.live = { step: 0, R, t0: Date.now(), res: null };
    UI.expanded = {};
    render();
    clearInterval(timerI);
    timerI = setInterval(() => { const t = $('#timer'); if (t && UI.live) t.textContent = ((Date.now() - UI.live.t0) / 1000).toFixed(1) + ' s'; }, 100);
    const D = a ? 950 : 0;
    await sleep(a ? 700 : 0);
    for (let s = 1; s <= 4; s++) { await sleep(D); UI.live.step = s; refresh('panel'); }
    const res = await gen;
    await sleep(a ? 500 : 0);
    UI.live.res = res; UI.live.step = 5; refresh('panel');
    await sleep(D * 0.7);
    UI.live.step = 6;
    addLog('Compare', `${res.brief.refs.length} references shown (${res.brief.refs.map((r) => r.pid).join(', ')}) · ${res.R.steps.search.matched} passages · writer: ${res.writer.mode === 'claude' ? res.writer.model : 'offline'}`, res.brief.refs.map((r) => r.pid));
    refresh('panel');
    await sleep(a ? 1300 : 0);
    clearInterval(timerI);
    const ms = Date.now() - UI.live.t0;
    p.compare = Object.assign({ at: Date.now(), ms }, res);
    UI.live = null; UI.showPipe = !!keepPipe;
    render(); save();
  }
  function useRef(p, pid) {
    const i = p.used.indexOf(pid);
    if (i >= 0) p.used.splice(i, 1);
    else {
      p.used.push(pid);
      p.notRelevant = p.notRelevant.filter((x) => x !== pid);
      addLog('Use as reference', pid + ' cited for the approval deck');
    }
    save();
  }
  async function sendAsk(p, q) {
    q = String(q || '').trim();
    if (!q || UI.askBusy) return;
    const item = { q, at: Date.now(), pending: true };
    p.asks.push(item);
    UI.askBusy = true;
    refresh('panel'); scrollAsk();
    const res = await genAsk(q, askContext(p));
    item.pending = false;
    item.answer = res.answer; item.writer = res.writer;
    UI.askBusy = false;
    addLog('Ask', `“${q}” → ${res.answer.notFound ? 'not found' : res.answer.sources.map((s) => s.chip + (s.pid ? ' ' + s.pid : '')).join(', ')}`);
    refresh('panel'); scrollAsk(); save();
  }
  function scrollAsk() { const b = $('.sd-body'); if (b) b.scrollTop = b.scrollHeight; }
  function openDecision(p) {
    if (!p.compare) { toast('Run Compare first: the decision uses the reference brief.'); return false; }
    const conds = p.compare.brief.conditions;
    if (p.decision) {
      const checked = {};
      p.decision.conditions.forEach((c) => { const i = conds.findIndex((x) => x.short === c.short); if (i >= 0) checked[i] = true; });
      const custom = p.decision.conditions.filter((c) => !c.ref).map((c) => c.short);
      custom.forEach((c, k) => { checked[conds.length + k] = true; });
      UI.dec = { option: p.decision.option, checked, custom };
    } else UI.dec = { option: null, checked: {}, custom: [] };
    UI.modal = 'decision';
    return true;
  }
  function saveDecision(p) {
    const D = UI.dec;
    const conds = p.compare.brief.conditions.concat(D.custom.map((c) => ({ short: c, long: c.replace(/\.?$/, '.'), ref: null, pid: null })));
    const chosen = D.option === 'conditions' ? conds.filter((c, i) => D.checked[i]).map((c) => ({ short: c.short, long: c.long, ref: c.ref, pid: c.pid })) : [];
    p.decision = { option: D.option, conditions: chosen, date: p.form.meeting, savedAt: Date.now() };
    p.entry = null;
    UI.modal = null; UI.dec = null;
    addLog('SSC decision', `Review 1 ${dayName(p.form.meeting)}: ${D.option === 'conditions' ? 'go with ' + chosen.length + ' conditions (' + chosen.map((c) => c.short).join('; ') + ')' : D.option}`);
    toast(`Decision saved · Review 1 · ${dayName(p.form.meeting)}`);
    save();
  }
  function draftInput(p) {
    const b = p.compare.brief;
    const idx = index();
    const used = (p.used.length ? p.used : []).map((pid) => {
      const ref = b.refs.find((r) => r.pid === pid);
      const rec = idx.proj[pid];
      const lesson = ref && ref.lesson ? ref.lesson.text : '';
      return { pid, lesson, short: rec && rec.shortLesson ? rec.shortLesson : lesson };
    });
    return {
      projectId: p.id, title: p.form.title, description: p.form.description, meeting: p.form.meeting || SD.MEETINGS[1],
      co2: p.spot ? p.spot.co2 : '?', unverified: !!b.notFound, decision: p.decision, refsUsed: used
    };
  }
  async function draftEntry(p, a) {
    if (!p.decision) { toast('Record the Review 1 decision first.'); return; }
    UI.drafting = true; UI.editing = false;
    refresh('panel');
    const res = await genDraft(draftInput(p));
    UI.drafting = false;
    p.entry = { text: res.draft.text, words: res.draft.words, draftedFrom: res.draft.draftedFrom, deleted: res.draft.deleted, writer: res.writer, status: 'draft' };
    if (a) {
      UI.typing = { pid: p.id, n: 0 };
      refresh('panel');
      while (UI.typing.n < p.entry.text.length) {
        if (anim.skip) break;
        UI.typing.n += 7;
        const el = $('#entry-text');
        if (el) el.textContent = p.entry.text.slice(0, UI.typing.n);
        await sleep(16);
      }
      UI.typing = null;
    }
    refresh('panel'); save();
  }
  async function confirmEntry(p, a) {
    if (!p.entry) return;
    if (a) { flash('#btn-confirm-entry'); await sleep(350); }
    p.entry.status = 'confirmed';
    p.entry.confirmedAt = Date.now();
    UI.editing = false;
    addLog('Diary entry 1 confirmed', `${p.id} · ${p.entry.words} words · indexed tonight`);
    refresh('panel'); refresh('stephead');
    toast('Diary entry 1 saved · searchable from tomorrow');
    save();
  }
  function indexTonight(p) {
    if (!p.entry || p.entry.status !== 'confirmed') return false;
    const rec = E.recordFromDiary({ id: p.id, title: p.form.title, meeting: p.form.meeting, co2: p.spot ? p.spot.co2 : 0, contact: p.form.contact, tags: tagValues(p.tags), decision: p.decision, entryText: p.entry.text });
    S.indexed = S.indexed.filter((r) => r.id !== p.id).concat([rec]);
    addLog('Overnight index', `Diary entry 1 of ${p.id} added · ${index().projects.length} projects`);
    save();
    return true;
  }
  async function startNext(a) {
    const p0 = proj(DEMO);
    if (!S.indexed.some((r) => r.id === DEMO) && !indexTonight(p0)) { toast('Confirm diary entry 1 first.'); return; }
    S.projects[NEXT] = newProject(NEXT);
    const p = proj(NEXT);
    S.pid = NEXT; S.view = 'work';
    setForm(p, SD.NEW_PROJECTS[NEXT]); doLookup(p);
    render();
    await suggestTags(p, false);
    await confirmTags(p, false);
    await sleep(a ? 400 : 0);
    await runCompare(p, a);
    const hit = p.compare && p.compare.brief.refs.find((r) => r.pid === DEMO);
    toast(hit ? `${DEMO} is reference ${hit.rank}: last week’s diary entry, found by the next project` : 'Brief ready');
  }
  async function runGateB() {
    const idx = index();
    const rows = [];
    let rel = 0, relN = 0, nf = 0, nfN = 0, bad = 0, cites = 0;
    for (const t of SD.GATE_B_TESTS) {
      const out = await E.rag.ask(idx, t.q, null, null);
      const ans = out.answer;
      ans.sources.forEach((s) => {
        cites++;
        const passage = s.kind === 'query' ? out.A.sources.find((x) => x.kind === 'query') : idx.byId[s.id];
        const text = passage ? (passage.blocks ? passage.blocks.join(' ') : passage.text) : '';
        if (!passage || (s.cited && text.indexOf(s.cited) < 0)) bad++;
      });
      if (t.expect === 'notfound') {
        nfN++; if (ans.notFound) nf++;
        rows.push({ q: t.q, expect: 'not found', got: ans.notFound ? 'not found' : ans.sources.map((s) => s.pid || 'SPOT query').join(', '), ok: ans.notFound });
      } else {
        relN++;
        const pids = new Set();
        ans.sources.forEach((s) => (s.rows || [s.pid]).forEach((x) => pids.add(x)));
        const ok = t.expect.some((e) => pids.has(e));
        if (ok) rel++;
        rows.push({ q: t.q, expect: t.expect.join(' or '), got: ans.notFound ? 'not found' : [...pids].filter(Boolean).slice(0, 6).join(', '), ok });
      }
    }
    UI.gateB = { rows, rel, relN, nf, nfN, bad, cites };
    render();
  }

  /* ================================================================ */
  /* Guided demo: the ten scenes                                       */
  /* ================================================================ */
  const G = { busy: false };
  function resetDemo() {
    S.projects[DEMO] = newProject(DEMO);
    S.projects[NEXT] = newProject(NEXT);
    S.indexed = [];
    S.pid = DEMO;
    Object.assign(UI, { modal: null, drawer: null, editing: false, live: null, askBusy: false, drafting: false, tagBusy: false, callout: null, showPipe: false, expanded: {}, lookupErr: '', dec: null, typing: null, heroQ: '', homeRes: null });
  }
  const DONE = [
    () => true,
    () => !!(proj(DEMO).spot && proj(DEMO).form.title && proj(DEMO).form.stars),
    () => proj(DEMO).tagsConfirmed,
    () => !!proj(DEMO).compare,
    () => proj(DEMO).used.length > 0,
    () => proj(DEMO).asks.some((x) => x.answer),
    () => !!proj(DEMO).decision || !!(UI.modal === 'decision' && UI.dec && UI.dec.option),
    () => !!(proj(DEMO).entry && proj(DEMO).entry.status === 'confirmed'),
    () => true,
    () => true
  ];
  const ASKQ = SD.ASK_SUGGESTIONS[0];
  const RUN = [
    async (a) => {
      S.view = 'home'; UI.modal = null; UI.drawer = null; render(); window.scrollTo(0, 0);
      if (a) { await sleep(700); await typeInto('#hero-q', SD.NEW_PROJECTS[DEMO].title, 30); } else { UI.heroQ = SD.NEW_PROJECTS[DEMO].title; render(); }
    },
    async (a) => {
      S.pid = DEMO; S.view = 'work'; UI.modal = null; UI.drawer = null;
      const p = proj(DEMO); p.panel.open = false;
      render();
      if (!DONE[1]()) await fillForm(p, a);
    },
    async (a) => {
      const p = proj(DEMO); S.view = 'work'; p.panel.open = false; UI.modal = null; render();
      if (!p.tagsConfirmed) { await sleep(a ? 400 : 0); await suggestTags(p, a); await confirmTags(p, a); }
    },
    async (a) => {
      const p = proj(DEMO); S.view = 'work'; UI.modal = null;
      if (!p.compare) await runCompare(p, a, true);
      else { openPanel(p, 'compare'); UI.showPipe = true; render(); }
    },
    async (a) => {
      const p = proj(DEMO); S.view = 'work'; UI.modal = null; UI.callout = null; openPanel(p, 'compare'); UI.showPipe = false; render();
      const refs = p.compare.brief.refs;
      if (a && refs[0]) {
        await sleep(1300);
        const deck = refs[0].chips.find((c) => /^DECK/.test(c.chip)) || refs[0].chips[1] || refs[0].chips[0];
        UI.drawer = { type: 'source', id: deck.id, hl: '' }; refresh('overlay');
        await sleep(3200);
        UI.drawer = null; refresh('overlay');
        await sleep(500);
      }
      for (const r of refs.slice(0, 2)) {
        if (!p.used.includes(r.pid)) {
          if (a) { flash('#use-' + r.rank); await sleep(350); }
          useRef(p, r.pid); refresh('panel'); refresh('cited');
          await sleep(a ? 700 : 0);
        }
      }
    },
    async (a) => {
      const p = proj(DEMO); S.view = 'work'; UI.modal = null; openPanel(p, 'ask'); render();
      if (!p.asks.some((x) => x.q === ASKQ && x.answer)) {
        await sleep(a ? 700 : 0);
        await typeInto('#ask-q', ASKQ, 40);
        await sleep(a ? 300 : 0);
        const el = $('#ask-q'); if (el) el.value = '';
        await sendAsk(p, ASKQ);
      }
    },
    async (a) => {
      const p = proj(DEMO); S.view = 'work'; UI.callout = null;
      if (!openDecision(p)) return;
      render();
      if (!p.decision) {
        await sleep(a ? 900 : 0);
        UI.dec.option = 'conditions'; refresh('overlay'); flash('#opt-conditions');
        const n = p.compare.brief.conditions.length;
        for (let i = 0; i < Math.min(3, n); i++) { await sleep(a ? 650 : 0); UI.dec.checked[i] = true; refresh('overlay'); flash('#cond-' + i); }
        await sleep(a ? 500 : 0);
        flash('#btn-save-dec');
      }
    },
    async (a) => {
      const p = proj(DEMO); S.view = 'work';
      if (!p.decision && UI.modal === 'decision' && UI.dec && UI.dec.option) {
        flash('#btn-save-dec'); await sleep(a ? 450 : 0);
        saveDecision(p);
      }
      UI.modal = null; openPanel(p, 'write'); render();
      if (!p.entry) await draftEntry(p, a);
      if (p.entry && p.entry.status !== 'confirmed') { await sleep(a ? 1600 : 0); await confirmEntry(p, a); }
    },
    async () => { S.view = 'loop'; UI.modal = null; UI.drawer = null; render(); window.scrollTo(0, 0); },
    async () => { S.view = 'pilot'; UI.modal = null; UI.drawer = null; render(); window.scrollTo(0, 0); }
  ];
  async function goScene(i, jump) {
    if (i < 0 || i >= SD.SCENES.length) return;
    const from = S.guided ? S.guided.scene : -1;
    S.guided = { scene: i };
    G.busy = true;
    const sc = SD.SCENES[i];
    UI.callout = null;
    try {
      if (jump || i !== from + 1) {
        anim.skip = true;
        if (i <= from || from < 0) resetDemo();
      }
      for (let k = 1; k < i; k++) if (!DONE[k]()) { const s = anim.skip; anim.skip = true; await RUN[k](false); anim.skip = s; }
      if (sc.callout) UI.callout = sc.callout;
      await RUN[i](!anim.skip);
    } catch (e) {
      console.error(e);
    } finally {
      anim.skip = false; anim.pending = [];
      G.busy = false;
      if (S.view !== 'work') UI.callout = null;
      render(); save();
    }
  }
  function next() {
    if (G.busy) { skipAnim(); return; }
    if (!S.guided) { goScene(0); return; }
    if (S.guided.scene < SD.SCENES.length - 1) goScene(S.guided.scene + 1);
  }
  function prev() {
    if (G.busy) { skipAnim(); return; }
    if (S.guided && S.guided.scene > 0) goScene(S.guided.scene - 1, true);
  }

  /* ================================================================ */
  /* Events                                                            */
  /* ================================================================ */
  function navTo(to) {
    UI.modal = null; UI.drawer = null; UI.callout = null;
    if (to === 'records' || to === 'log') { S.view = 'records'; S.recTab = to === 'log' ? 'log' : 'records'; render(); window.scrollTo(0, 0); return; }
    if (to === 'pilot') { S.view = 'pilot'; render(); window.scrollTo(0, 0); return; }
    if (to === 'loop') { S.view = 'loop'; render(); return; }
    const p = proj();
    S.view = 'work';
    if (to === 'compare' || to === 'ask' || to === 'write') openPanel(p, to);
    render(); save();
  }
  function stepClick(n) {
    if (S.guided) {
      const map = { 1: 1, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8 };
      goScene(map[n], true);
      return;
    }
    const p = proj();
    UI.modal = null; UI.callout = null;
    if (n === 1) { S.view = 'work'; p.panel.open = false; render(); }
    else if (n === 6) navTo('loop');
    else if (n === 4) { S.view = 'work'; if (openDecision(p)) render(); }
    else {
      if (!p.tagsConfirmed) { S.view = 'work'; render(); toast('Confirm the six tags first.'); return; }
      navTo(['', '', 'compare', 'ask', '', 'write'][n]);
    }
  }

  const ACT = {
    home: () => { S.view = 'home'; UI.modal = null; UI.drawer = null; UI.callout = null; render(); window.scrollTo(0, 0); },
    nav: (d) => navTo(d.to),
    step: (d) => stepClick(Number(d.step)),
    'guided-start': () => { if (G.busy) return; resetDemo(); S.guided = null; goScene(0); },
    'guided-next': () => next(),
    'guided-prev': () => prev(),
    'guided-exit': () => { S.guided = null; UI.callout = null; render(); },
    notes: () => { S.notes = !S.notes; refresh('presenter'); save(); },
    'reset-demo': () => { if (confirm('Reset the demo projects, the index and the log?')) { resetDemo(); S.log = []; S.guided = null; S.view = 'home'; for (const k in CACHE) delete CACHE[k]; render(); save(); } },
    'open-project': (d) => { S.pid = d.pid; proj(d.pid); S.view = 'work'; UI.lookupErr = ''; render(); save(); },
    'new-project': () => { S.drafts = (S.drafts || 0) + 1; const id = 'draft-' + S.drafts; S.projects[id] = newProject(id); S.pid = id; S.view = 'work'; render(); save(); },
    'hero-search': () => {
      const q = ($('#hero-q') || {}).value || UI.heroQ;
      UI.heroQ = q;
      if (!q.trim()) return;
      const tags = tagValues(E.suggestTags({ title: q, description: '', spot: {} }));
      UI.homeRes = E.retrieveBrief(index(), { projectId: 'search', title: q, description: '', tags, spot: {} });
      addLog('Search', `“${q}” → ${UI.homeRes.refs.map((r) => r.pid).join(', ') || 'not found'}`);
      render();
    },
    'home-clear': () => { UI.homeRes = null; render(); },
    'home-new-from-search': () => { S.drafts = (S.drafts || 0) + 1; const id = 'draft-' + S.drafts; const p = (S.projects[id] = newProject(id)); p.form.title = UI.heroQ; S.pid = id; S.view = 'work'; UI.homeRes = null; render(); save(); },
    'fill-example': () => { const p = proj(); fillForm(p, false); save(); },
    lookup: () => { const p = proj(); p.form.spotId = ($('#f-spot') || {}).value || p.form.spotId; if (doLookup(p)) { const np = Object.values(SD.NEW_PROJECTS).find((x) => x.spotId === p.form.spotId.trim()); if (np && !p.form.title && !String(p.id).startsWith('10')) p.form.title = np.title; } render(); save(); },
    star: (d) => { const p = proj(); p.form.stars = Number(d.n); render(); save(); },
    attach: () => { const p = proj(); const name = prompt('File name to attach (demo, nothing is uploaded):', 'Energy audit extract.pdf'); if (name) { p.form.attachments.push(name); render(); save(); } },
    'suggest-tags': () => suggestTags(proj(), true),
    'tag-toggle': (d) => { const p = proj(); const t = p.tags[d.k]; if (t && t.value) { t.checked = !t.checked; refresh('tags'); save(); } },
    'confirm-tags': () => confirmTags(proj(), false).then(() => { if (!S.guided) { const p = proj(); openPanel(p, 'compare'); render(); runCompare(p, true); } }),
    'unconfirm-tags': () => { const p = proj(); if (S.guided) return; p.tagsConfirmed = false; refresh('tags'); save(); },
    'panel-open': (d) => { const p = proj(); openPanel(p, d.tab || p.panel.tab); render(); if (p.panel.tab === 'compare' && !p.compare && p.tagsConfirmed && !UI.live) runCompare(p, true); },
    'panel-close': () => { const p = proj(); p.panel.open = false; UI.showPipe = false; render(); save(); },
    tab: (d) => {
      const p = proj();
      p.panel.tab = d.tab; UI.showPipe = false; render(); save();
      if (d.tab === 'write' && p.decision && !p.entry && !UI.drafting) draftEntry(p, true);
      if (d.tab === 'ask') { const i = $('#ask-q'); if (i) i.focus(); scrollAsk(); }
    },
    'run-compare': () => runCompare(proj(), true),
    'toggle-pipe': () => { UI.showPipe = !UI.showPipe; refresh('panel'); },
    expand: (d) => { if (UI.live) return; UI.expanded[d.step] = !UI.expanded[d.step]; refresh('panel'); },
    'use-ref': (d) => { useRef(proj(), d.pid); if (UI.drawer) refresh('overlay'); refresh('panel'); refresh('cited'); },
    notrel: (d) => { const p = proj(); const i = p.notRelevant.indexOf(d.pid); if (i >= 0) p.notRelevant.splice(i, 1); else { p.notRelevant.push(d.pid); p.used = p.used.filter((x) => x !== d.pid); addLog('Rated not relevant', d.pid); } refresh('panel'); refresh('cited'); save(); },
    source: (d) => { if (!index().byId[d.id]) { toast('This source is not in the index.'); return; } UI.drawer = { type: 'source', id: d.id, hl: d.hl || '' }; refresh('overlay'); },
    record: (d) => { UI.drawer = { type: 'record', pid: d.pid }; refresh('overlay'); },
    'query-src': (d) => { const a = proj().asks[Number(d.ask)]; const s = a && a.answer.sources.find((x) => String(x.n) === d.n); if (s) { UI.drawer = { type: 'query', src: s }; refresh('overlay'); } },
    contact: (d) => { UI.contact = d.pid; UI.modal = 'contact'; refresh('overlay'); },
    cite: (d) => {
      const x = index().byId[d.id];
      if (!x) return;
      const txt = `Source: ${x.label.replace(/^SPOT /, 'SPOT ')} (via Smart Diary)`;
      try { navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) { /* clipboard blocked */ }
      const p = proj();
      if (p.compare && p.compare.brief.refs.some((r) => r.pid === x.pid) && !p.used.includes(x.pid)) useRef(p, x.pid);
      toast('Citation copied: ' + x.label);
      addLog('Cite', x.label);
      refresh('overlay'); refresh('panel'); refresh('cited');
    },
    'ask-suggest': (d) => sendAsk(proj(), d.q),
    'open-decision': () => { const p = proj(); if (S.view !== 'work') S.view = 'work'; if (openDecision(p)) render(); },
    'dec-opt': (d) => { UI.dec.option = d.v; refresh('overlay'); },
    'dec-cond': (d) => { const i = Number(d.i); UI.dec.checked[i] = !UI.dec.checked[i]; if (UI.dec.checked[i] && UI.dec.option !== 'conditions') UI.dec.option = 'conditions'; refresh('overlay'); },
    'dec-save': () => { const p = proj(); saveDecision(p); openPanel(p, 'write'); render(); if (!S.guided) draftEntry(p, true); },
    draft: () => draftEntry(proj(), true),
    'edit-entry': () => { UI.editing = true; refresh('panel'); },
    'cancel-edit': () => { UI.editing = false; refresh('panel'); },
    'save-edit': () => { const p = proj(); const v = ($('#entry-edit') || {}).value; if (v != null) { p.entry.text = v.trim(); p.entry.words = v.trim().split(/\s+/).filter(Boolean).length; p.entry.edited = true; } UI.editing = false; refresh('panel'); save(); },
    'confirm-entry': () => confirmEntry(proj(), false),
    'go-loop': () => navTo('loop'),
    'go-write': () => { S.pid = DEMO; navTo('write'); },
    'index-tonight': () => { if (indexTonight(proj(DEMO))) { toast(`Indexed overnight · ${index().projects.length} projects`); render(); } },
    'start-next': () => startNext(true),
    'close-overlay': () => { UI.modal = null; UI.drawer = null; UI.dec = null; refresh('overlay'); refresh('stephead'); },
    'ssc-info': () => { UI.modal = 'ssc'; refresh('overlay'); },
    'rag-info': () => { UI.modal = 'rag'; refresh('overlay'); },
    'rec-tab': (d) => { S.recTab = d.tab; render(); },
    'gateb-run': () => runGateB(),
    'callout-close': () => { UI.callout = null; const c = $('.callout'); if (c) c.remove(); }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'close-overlay' && e.target.closest('[data-stop]') && !e.target.closest('.m-close')) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el.dataset, el);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    if (f.dataset.form === 'ask') { const i = $('#ask-q'); const q = i.value; i.value = ''; sendAsk(proj(), q); }
    if (f.dataset.form === 'addcond') { const i = $('#addcond'); const v = i.value.trim(); if (v && UI.dec) { const n = proj().compare.brief.conditions.length + UI.dec.custom.length; UI.dec.custom.push(v); UI.dec.checked[n] = true; UI.dec.option = 'conditions'; refresh('overlay'); } }
  });
  function setPath(obj, path, v) { const k = path.split('.'); let o = obj; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = v; }
  document.addEventListener('input', (e) => {
    const b = e.target.dataset && e.target.dataset.bind;
    if (!b) return;
    if (b === 'heroQ') { UI.heroQ = e.target.value; return; }
    if (b.startsWith('rec.')) { setPath(UI, b, e.target.value); if (e.target.tagName === 'INPUT') { clearTimeout(UI.recT); UI.recT = setTimeout(() => { const pos = e.target.selectionStart; render(); const i = document.querySelector('[data-bind="rec.q"]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 200); } return; }
    const p = proj();
    setPath(p, b, e.target.value);
    if (b === 'form.title' || b === 'form.description') {
      if (p.tags && !p.tagsConfirmed && !S.guided) { /* PM edits after a suggestion: offer to re-suggest */ }
    }
    save();
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.tag) {
      const p = proj();
      p.tags[t.dataset.tag] = { value: t.value, from: 'PM', checked: !!t.value };
      refresh('tags'); save();
      return;
    }
    const b = t.dataset && t.dataset.bind;
    if (!b) return;
    if (b.startsWith('rec.')) { setPath(UI, b, t.value); render(); return; }
    setPath(proj(), b, t.value);
    if (b === 'form.contact') render();
    if (b === 'form.title' && !proj().tags) refresh('tags');
    save();
  });
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (e.key === 'Escape') { if (UI.modal || UI.drawer) { UI.modal = null; UI.drawer = null; UI.dec = null; refresh('overlay'); } return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { if (S.guided) { e.preventDefault(); next(); } }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { if (S.guided) { e.preventDefault(); prev(); } }
    else if (e.key === 'n' || e.key === 'N') { if (S.guided) { S.notes = !S.notes; refresh('presenter'); save(); } }
    else if (e.key === 'f' || e.key === 'F') {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (err) { /* not allowed */ }
    }
  });

  /* ================================================================ */
  /* Start                                                             */
  /* ================================================================ */
  // A reload in the middle of a run leaves no animation half-done.
  Object.values(S.projects).forEach((p) => { p.asks = (p.asks || []).filter((a) => a.answer); });
  render();
  checkServer();
  window.SmartDiary = { state: () => S, ui: UI, goScene, next, prev, rag: RAG, busy: () => G.busy };
})();
