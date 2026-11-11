/*
 * Smart Diary · RAG engine (shared by the browser and the Node server)
 * -----------------------------------------------------------------------------
 * Retrieval runs locally and deterministically:
 *   1 build the query   2 filter by tags   3 hybrid search (BM25 + concept vectors)
 *   4 re-rank + similarity floor   5 write with citations   6 log
 *
 * Step 5 calls a "writer". With an API key the Node server passes a writer that
 * calls Claude with the retrieved passages as search_result blocks (native
 * citations). Without one, the offline writer composes the answer extractively
 * from the same passages. Either way, the citation check below runs on the
 * result: a sentence without a source is deleted.
 */
(function (root) {
  'use strict';
  var SD = (root.SD = root.SD || {});
  var E = (SD.engine = {});

  /* ================================================================== */
  /* Text processing                                                     */
  /* ================================================================== */
  var STOP = {};
  ('a an the and or of to in on for with from by at as is are was were be been being it its this that these those than then ' +
    'into over per via about after before since did does do how which what who whom when where why can could should would will ' +
    'may our your their there here not all any each more most less very also only just up out off has have had we i you he she ' +
    'they them us me my if so but while during between under within without one two three new project projects use used using ' +
    'site takeda vienna ever built build get got need needed take took long much many went wrong tell show give find any some ' +
    'der die das und oder von zu im in am an für mit aus bei ist sind war wurde werden ein eine einer eines dem den des zur zum ' +
    'auf als pro über nur wird nach expected per year').split(' ').forEach(function (w) { STOP[w] = 1; });

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/co₂e?|co2e/g, 'co2')
      .replace(/[→‐-―\-–—/]/g, ' ')
      .replace(/[^a-z0-9äöüß%°\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function stem(w) {
    if (/^\d/.test(w)) return w;
    if (w.length > 5 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function tokens(s) {
    return norm(s).split(' ').filter(function (w) { return w.length > 1 && !STOP[w]; }).map(stem);
  }
  E.norm = norm;
  E.tokens = tokens;

  /* Concept dictionary: the "semantic" half of hybrid search. Bilingual on
     purpose: "Abwärmenutzung" and "waste heat recovery" share one concept.
     Entries starting with ~ match inside German compound words. */
  var CONCEPTS = {
    heatrec: ['heat recovery', 'recover heat', 'recovers heat', 'recovered heat', 'waste heat', 'reuse heat', 'condenser heat', 'desuperheater', 'economiser', 'economizer', 'run around coil', 'flash steam', 'heat from', 'heat of', '~abwärme', '~wärmerückgewinn', '~entspannungsdampf'],
    hx: ['heat exchanger', 'plate heat exchanger', 'exchanger', 'plate pack', '~wärmetauscher', '~wärmeübertrager'],
    cooling: ['process cooling', 'cooling water', 'cooling return', 'cooling loop', 'cooling circuit', 'cooling load', 'dry cooler', 'glycol', '~kühlwasser', '~kühlkreis', '~notkühler'],
    hvac: ['hvac', 'ahu', 'air handling', 'supply air', 'outside air', 'heating coil', 'pre heating coil', 'ventilation', 'air change', '~lüftung'],
    preheat: ['pre heating', 'preheating', 'pre heat', 'pre heats', '~vorwärm'],
    heating: ['heating', 'space heating', 'heating network', 'floor heating', 'radiator', '~heiz'],
    hotwater: ['hot water', 'domestic hot water', 'washing water', '~warmwasser'],
    requal: ['requalification', 'requalify', 'requalified', 'qualification', 'iq oq', 'iq', 'oq', '~requalifi', '~qualifizier'],
    gmp: ['gmp', 'classified', 'grade c', 'clean room', 'cleanroom', 'qualified system', 'purified water room', '~reinraum'],
    season: ['summer', 'winter', 'seasonal', 'season', 'october', 'april', 'heating season', '~sommer', '~winter', '~heizperiode'],
    hp: ['heat pump', 'cop', '~wärmepumpe'],
    chiller: ['chiller', 'condenser', 'refrigeration', 'freeze dryer', 'free cooling', '~kältemaschine', '~kälteerzeugung'],
    air: ['compressed air', 'compressor', 'screw compressor', '~druckluft', '~kompressor'],
    steam: ['steam', 'condensate', 'steam trap', 'boiler', 'blowdown', 'feed water', 'make up water', '~dampf', '~kondensat', '~speisewasser', '~kessel'],
    light: ['led', 'lighting', 'luminaire', 'fluorescent', 'high bay', '~beleuchtung', '~leuchte'],
    pv: ['pv', 'photovoltaic', 'solar', 'kwp', 'carport', '~photovoltaik'],
    water: ['wfi', 'purified water', 'reverse osmosis', 'ro', 'rinse water', 'cip', 'water reuse', 'sanitisation', '~reinstwasser'],
    waste: ['solvent', 'waste segregation', 'distillation', 'recycling', 'incineration', '~lösungsmittel', '~abfall'],
    insul: ['insulation', 'window', 'roof', 'door', 'envelope', 'heat losses', '~dämmung', '~isolier', '~wärmeverlust'],
    refrig: ['refrigerant', 'r404a', 'gwp', 'f gas', 'cold room', '~kältemittel'],
    measure: ['measurement', 'measured', 'measure', 'logger', 'metering', 'load profile', 'profile', '~messung', '~gemessen'],
    design: ['design basis', 'sizing', 'sized', 'oversized', 'undersized', '~auslegung', '~ausgelegt'],
    savings: ['saving', 'achieved', 'promise', 'promised', 'shortfall', '~einsparung'],
    cost: ['capex', 'cost', 'payback', 'business case', 'budget', 'price', '~kosten'],
    shutdown: ['weekend', 'shutdown', 'night', 'part load', 'campaign', '~wochenende', '~stillstand'],
    fouling: ['fouling', 'cleaning', 'corrosion', 'acidic', 'stainless', 'scaling', '~verschmutzung'],
    hygiene: ['legionella', 'hygiene'],
    material: ['material', 'stainless', 'carbon steel', 'steel'],
    controls: ['control', 'control valve', 'bms', 'set point', 'setpoint', 'schedule', 'sequencing', '~regelung'],
    frost: ['frost', 'freezing'],
    route: ['pipe route', 'route', 'pipe line', 'new line', 'corridor', 'pipe'],
    hydrogen: ['hydrogen', '~wasserstoff'],
    electric: ['electricity', 'grid', 'electrical', '~strom'],
    noise: ['noise', 'acoustic'],
    lab: ['laboratory', 'fume hood', 'qc'],
    safety: ['safety', 'hse', 'hazardous', 'asbestos'],
    wind: ['wind turbine', 'wind']
  };
  var CONCEPT_LIST = [];
  Object.keys(CONCEPTS).forEach(function (c) {
    CONCEPTS[c].forEach(function (p) {
      var sub = p.charAt(0) === '~';
      CONCEPT_LIST.push({ c: c, p: norm(sub ? p.slice(1) : p), sub: sub });
    });
  });
  function concepts(text) {
    var t = ' ' + norm(text) + ' ';
    var out = {};
    for (var i = 0; i < CONCEPT_LIST.length; i++) {
      var e = CONCEPT_LIST[i];
      if (e.sub ? t.indexOf(e.p) >= 0 : t.indexOf(' ' + e.p + ' ') >= 0 || t.indexOf(' ' + e.p + 's ') >= 0) out[e.c] = 1;
    }
    return out;
  }
  E.concepts = concepts;

  /* Sentence boundaries as [start, end) offsets. Does not split after
     initials ("M. Berger"), "p. 6", "e.g." or "approx.". */
  var BOUNDARY = /(?<![\s(][A-Z]\.)(?<!\bp\.)(?<!e\.g\.)(?<!approx\.)(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9“"(])|\n+/g;
  function sentenceSpans(text) {
    var spans = [], start = 0, m;
    text = String(text);
    BOUNDARY.lastIndex = 0;
    while ((m = BOUNDARY.exec(text))) {
      spans.push([start, m.index]);
      start = m.index + m[0].length;
    }
    spans.push([start, text.length]);
    return spans.filter(function (sp) { return text.slice(sp[0], sp[1]).trim(); });
  }
  function sentences(text) {
    text = String(text);
    return sentenceSpans(' ' + text).map(function (sp) { return (' ' + text).slice(sp[0], sp[1]).trim(); }).filter(Boolean);
  }
  E.sentences = sentences;

  /* ================================================================== */
  /* Index                                                               */
  /* ================================================================== */
  function pct(r) { return r.achieved != null && r.promised ? Math.round((r.achieved / r.promised) * 100) : null; }
  E.pct = pct;

  function cardText(r) {
    var t = r.tags;
    var s = ['SPOT record ' + r.id + ': ' + r.title + '.',
      'Year ' + r.year + ', status ' + r.status + '.',
      'Technology: ' + t.technology + '. Utility: ' + t.utility + '. ' + t.scope + '. Area: ' + t.area + '. Equipment: ' + t.equipment + '. CAPEX ' + t.capex + '.',
      'Promised ' + r.promised + ' t CO₂e per year.',
      r.achieved != null ? 'Achieved ' + r.achieved + ' t CO₂e per year (' + pct(r) + ' %).' : 'Achieved: not recorded.'];
    if (r.requal) s.push('Requalification needed: yes, about ' + r.requal.months + ' months.');
    if (r.owner) s.push('Owner: ' + r.owner.name + ', ' + r.owner.role + '.');
    return s.join(' ');
  }

  /* What the search matches on for a SPOT card: content, not the tag line.
     Tags are compared structurally in the tag filter and the re-ranker. */
  function cardMatchText(r) {
    return r.title + '. Year ' + r.year + ', ' + r.status + '.' + (r.requal ? ' Requalification needed, about ' + r.requal.months + ' months.' : '') +
      (r.owner ? ' Owner ' + r.owner.name + ', ' + r.owner.role + '.' : '');
  }

  function passageLabel(r, p) {
    if (p.kind === 'spot') return 'SPOT ' + r.id;
    if (p.kind === 'deck') return 'SPOT ' + r.id + ' · deck p. ' + p.page;
    if (p.kind === 'diary') return 'SPOT ' + r.id + ' · diary · ' + p.gate;
    return 'SPOT ' + r.id + ' · SSC decision · ' + p.gate;
  }
  function chipLabel(p) {
    if (p.kind === 'spot') return 'SPOT ' + p.pid.toUpperCase();
    if (p.kind === 'deck') return 'DECK P. ' + p.page;
    if (p.kind === 'diary') return 'DIARY · ' + String(p.gate).toUpperCase();
    return 'SSC DECISION · ' + String(p.gate).toUpperCase();
  }
  E.chipLabel = chipLabel;

  E.buildIndex = function (extra) {
    var projects = (SD.PROJECTS || []).concat(extra || []);
    var passages = [];
    var byId = {};
    var df = {};
    projects.forEach(function (r) {
      var list = [{ id: r.id + ':spot', kind: 'spot', text: cardText(r), match: cardMatchText(r), lang: 'en' }].concat(r.passages);
      list.forEach(function (p) {
        var mt = p.match || p.text;
        var toks = tokens(mt);
        var tf = {};
        toks.forEach(function (w) { tf[w] = (tf[w] || 0) + 1; });
        Object.keys(tf).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
        var q = {
          id: p.id, pid: r.id, kind: p.kind, page: p.page || null, gate: p.gate || null, date: p.date || null,
          lang: p.lang || 'en', text: p.text, supports: !!p.supports, L: p.L || null,
          tf: tf, len: toks.length, con: concepts(mt)
        };
        q.label = passageLabel(r, q);
        q.chip = chipLabel(q);
        passages.push(q);
        byId[q.id] = q;
      });
    });
    var N = passages.length;
    var avgdl = passages.reduce(function (a, p) { return a + p.len; }, 0) / N;
    var proj = {};
    projects.forEach(function (r) { proj[r.id] = r; });
    return { projects: projects, proj: proj, passages: passages, byId: byId, df: df, N: N, avgdl: avgdl };
  };

  function idf(idx, w) {
    var n = idx.df[w] || 0;
    return Math.log(1 + (idx.N - n + 0.5) / (n + 0.5));
  }

  /* Keyword half: BM25, normalised by the query's own IDF mass so the score is
     absolute (0..1) and a similarity floor means something. */
  function lexical(idx, qTerms, p) {
    var k1 = 1.2, b = 0.75, s = 0, mass = 0;
    var seen = {};
    qTerms.forEach(function (w) {
      if (seen[w]) return; seen[w] = 1;
      var i = idf(idx, w);
      mass += i;
      var f = p.tf[w];
      if (f) s += i * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * p.len) / idx.avgdl));
    });
    return mass ? Math.min(1, s / mass) : 0;
  }
  /* Semantic half: cosine similarity of concept vectors. */
  function semantic(qCon, p) {
    var qk = Object.keys(qCon), pk = Object.keys(p.con);
    if (!qk.length || !pk.length) return 0;
    var hit = qk.filter(function (c) { return p.con[c]; }).length;
    return hit / Math.sqrt(qk.length * pk.length);
  }
  function hybrid(idx, qTerms, qCon, p) {
    var lex = lexical(idx, qTerms, p), sem = semantic(qCon, p);
    return { lex: lex, sem: sem, score: 0.5 * lex + 0.5 * sem };
  }

  /* ================================================================== */
  /* Tag suggestion (rule-based; the server can also ask Claude)         */
  /* ================================================================== */
  var TECH_CUES = [
    ['heat recovery', ['heat recovery', 'waste heat', 'recover', '~abwärme', '~wärmerückgewinn', 'desuperheater', 'economiser']],
    ['heat pump', ['heat pump', '~wärmepumpe']],
    ['LED lighting', ['led', 'lighting', 'luminaire', '~beleuchtung']],
    ['solar PV', ['pv', 'photovoltaic', 'solar', '~photovoltaik']],
    ['compressed air', ['compressed air', 'compressor', 'leak', '~druckluft']],
    ['steam & condensate', ['steam trap', 'steam', 'condensate', '~dampf']],
    ['chiller optimisation', ['chiller', 'free cooling', 'chilled water', '~kältemaschine']],
    ['HVAC airflow & controls', ['ventilation', 'airflow', 'air change', 'set back', '~lüftung']],
    ['water reuse', ['water reuse', 'wfi loop', 'purified water', 'rinse water', '~reinstwasser']],
    ['solvent & waste recovery', ['solvent', 'waste segregation', 'recycling', '~lösungsmittel']],
    ['insulation & envelope', ['insulation', 'window', 'roof', 'door', '~dämmung']],
    ['refrigerant replacement', ['refrigerant', 'gwp', 'r404a', '~kältemittel']]
  ];
  function has(t, cue) {
    if (cue.charAt(0) === '~') return t.indexOf(norm(cue.slice(1))) >= 0;
    var c = norm(cue);
    return t.indexOf(' ' + c + ' ') >= 0 || t.indexOf(' ' + c + 's ') >= 0 || t.indexOf(' ' + c + 'ed ') >= 0 || t.indexOf(' ' + c + 'ing ') >= 0;
  }
  function detectTech(text) {
    var t = ' ' + norm(text) + ' ';
    for (var i = 0; i < TECH_CUES.length; i++) {
      for (var j = 0; j < TECH_CUES[i][1].length; j++) if (has(t, TECH_CUES[i][1][j])) return TECH_CUES[i][0];
    }
    return null;
  }
  E.detectTech = detectTech;

  var SOURCES = [
    ['process cooling', ['process cooling', 'cooling return', 'cooling loop', 'cooling water', 'wfi cooling']],
    ['chilled water', ['chilled water', 'chiller', 'server room']],
    ['compressed air', ['compressor', 'compressed air']],
    ['exhaust air', ['exhaust air', 'exhaust']],
    ['waste water', ['waste water']],
    ['boiler flue gas', ['flue gas', 'blowdown']],
    ['steam condensate', ['condensate']],
    ['refrigeration heat', ['refrigeration', 'freeze dryer']]
  ];
  var SINKS = [
    ['HVAC heating', ['hvac', 'ahu', 'pre heating coil', 'supply air', 'outside air', 'space heating', 'heating network', 'floor heating', 'building heating']],
    ['hot water', ['hot water', 'washing water']],
    ['feed water', ['feed water', 'make up water']],
    ['supply air', ['supply air']],
    ['purified water', ['purified water']]
  ];
  var TECH_DEFAULTS = {
    'heat pump': { utility: 'heating hot water', scope: 'Scope 1', equipment: 'heat pump' },
    'chiller optimisation': { utility: 'chilled water', scope: 'Scope 2', equipment: 'chiller' },
    'HVAC airflow & controls': { utility: 'ventilation air', scope: 'Scope 1+2', equipment: 'air-handling unit' },
    'steam & condensate': { utility: 'steam', scope: 'Scope 1', equipment: 'steam traps' },
    'compressed air': { utility: 'compressed air', scope: 'Scope 2', equipment: 'compressor' },
    'LED lighting': { utility: 'electricity', scope: 'Scope 2', equipment: 'LED luminaires' },
    'solar PV': { utility: 'electricity', scope: 'Scope 2', equipment: 'PV modules' },
    'water reuse': { utility: 'purified water / WFI', scope: 'Scope 1+2', equipment: 'RO / distillation unit' },
    'solvent & waste recovery': { utility: 'solvent streams', scope: 'Scope 3', equipment: 'solvent recovery unit' },
    'insulation & envelope': { utility: 'heating hot water', scope: 'Scope 1', equipment: 'insulation' },
    'refrigerant replacement': { utility: 'refrigerant circuit', scope: 'Scope 1', equipment: 'chiller' },
    'heat recovery': { utility: '', scope: 'Scope 1', equipment: 'heat exchanger' }
  };
  var EQUIP_CUES = [
    ['heat exchanger', ['heat exchanger', '~wärmetauscher']], ['heat pump', ['heat pump']], ['LED luminaires', ['led', 'luminaire']],
    ['PV modules', ['pv', 'solar']], ['compressor', ['compressor']], ['chiller', ['chiller']], ['boiler', ['boiler']],
    ['steam traps', ['steam trap']], ['air-handling unit', ['ahu', 'air handling']], ['insulation', ['insulation']],
    ['building management system', ['bms']], ['pumps & VFDs', ['pump', 'vfd']]
  ];
  var AREA_CUES = [
    ['utilities building', ['utilities building', 'utility building']], ['production building', ['production']],
    ['GMP clean-room area', ['clean room', 'gmp']], ['QC laboratory', ['laboratory', 'qc lab']], ['warehouse', ['warehouse']],
    ['office building', ['office']], ['outdoor / parking', ['parking', 'outdoor']], ['site-wide', ['site wide']]
  ];
  function firstCue(t, list) {
    for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i][1].length; j++) if (has(t, list[i][1][j])) return list[i][0];
    return null;
  }

  /* form: {title, description, spot:{co2, capex, area}} → six suggested tags */
  E.suggestTags = function (form) {
    var text = (form.title || '') + '. ' + (form.description || '');
    var t = ' ' + norm(text) + ' ';
    var titleT = ' ' + norm(form.title || '') + ' ';
    var spot = form.spot || {};
    var out = {};
    var tech = detectTech(form.title || '') || detectTech(text);
    out.technology = { value: tech || '', from: tech ? (detectTech(form.title || '') ? 'title' : 'description') : 'choose' };
    var d = TECH_DEFAULTS[tech] || {};
    if (tech === 'heat recovery') {
      var src = firstCue(t, SOURCES), sink = firstCue(t, SINKS);
      var u = src && sink ? src + ' → ' + sink : '';
      if (u && SD.VOCAB.utility.indexOf(u) < 0) {
        u = SD.VOCAB.utility.filter(function (v) { return v.indexOf(' → ' + sink) > 0; })[0] || '';
      }
      out.utility = { value: u, from: u ? (firstCue(titleT, SOURCES) ? 'title' : 'description') : 'choose' };
    } else {
      out.utility = { value: d.utility || '', from: d.utility ? 'technology' : 'choose' };
    }
    out.scope = { value: d.scope || 'Scope 1', from: 'technology' };
    var area = '';
    if (spot.area) {
      var a = norm(spot.area);
      area = SD.VOCAB.area.filter(function (v) { return norm(v) === a; })[0] || firstCue(' ' + a + ' ', AREA_CUES) || '';
    }
    out.area = area ? { value: area, from: 'SPOT' } : { value: firstCue(t, AREA_CUES) || '', from: 'description' };
    var eq = firstCue(t, EQUIP_CUES) || d.equipment || '';
    out.equipment = { value: eq, from: firstCue(t, EQUIP_CUES) ? 'description' : 'technology' };
    out.capex = { value: spot.capex || '', from: spot.capex ? 'SPOT' : 'choose' };
    return out;
  };

  /* Prompt for Claude to pick the six tags (structured output, constrained to
     the controlled vocabulary). The server validates the answer again. */
  E.tagPrompt = function (form) {
    var props = {};
    SD.TAG_TYPES.forEach(function (tt) {
      props[tt.key] = { type: 'string', enum: SD.VOCAB[tt.key] };
    });
    props.reasons = {
      type: 'object', additionalProperties: false,
      properties: { technology: { type: 'string' }, utility: { type: 'string' }, equipment: { type: 'string' } },
      required: ['technology', 'utility', 'equipment']
    };
    return {
      system: 'You tag sustainability projects for the Sustainability Steering Committee (SSC) of a pharmaceutical site. ' +
        'Choose exactly one value per tag type from the controlled vocabulary. Base every choice only on the project form and the SPOT figures given. ' +
        'Utility for heat recovery is written as "heat source → heat sink". Scope: heat that replaces gas heating is Scope 1; electricity savings are Scope 2. ' +
        'For each reason, write at most 12 words that quote the field you used.',
      user: 'Project form:\nTitle: ' + (form.title || '') + '\nDescription: ' + (form.description || '') +
        '\nSPOT figures: CO₂ reduction ' + ((form.spot || {}).co2 || '?') + ' t CO₂e per year; CAPEX ' + ((form.spot || {}).capex || '?') + '; area ' + ((form.spot || {}).area || '?') + '.',
      schema: { type: 'object', additionalProperties: false, properties: props, required: SD.TAG_TYPES.map(function (t) { return t.key; }).concat('reasons') }
    };
  };
  E.validateTags = function (json) {
    var out = {};
    SD.TAG_TYPES.forEach(function (tt) {
      var v = json && json[tt.key];
      if (SD.VOCAB[tt.key].indexOf(v) >= 0) out[tt.key] = { value: v, from: 'Claude', reason: (json.reasons || {})[tt.key] || '' };
    });
    return Object.keys(out).length === 6 ? out : null;
  };

  /* ================================================================== */
  /* Compare: retrieval for the reference brief                          */
  /* ================================================================== */
  var W = { technology: 0.25, utility: 0.25, scope: 0.1, area: 0.15, equipment: 0.15, capex: 0.1 };
  E.PARAMS = { match: 0.1, rerankK: 5, floor: 0.7, askFloor: 0.3 };

  function utilParts(u) { var p = String(u || '').split(' → '); return p.length === 2 ? p : [u, u]; }
  function tagScore(qt, rt) {
    var s = 0;
    Object.keys(W).forEach(function (k) {
      if (!qt[k] || !rt[k]) return;
      if (qt[k] === rt[k]) s += W[k];
      else if (k === 'utility') {
        var a = utilParts(qt[k]), b = utilParts(rt[k]);
        if (a[0] === b[0] || a[1] === b[1]) s += W[k] / 2;
      }
    });
    return s;
  }
  E.tagScore = tagScore;

  function round(x, d) { var m = Math.pow(10, d || 2); return Math.round(x * m) / m; }

  /* query: {projectId, title, description, tags:{6 values}, spot:{co2,capex,area}} */
  E.retrieveBrief = function (idx, query) {
    var t0 = Date.now();
    var tags = query.tags || {};
    var qText = [query.title, query.description].join('. ');
    var qTerms = tokens(qText);
    var qCon = concepts(qText);
    var pool = idx.projects.filter(function (r) { return r.id !== query.projectId; });

    // 2 · filter by tags
    var cand = pool.filter(function (r) { return r.tags.technology === tags.technology || r.tags.utility === tags.utility; });
    var widened = false;
    if (cand.length < 3) {
      widened = true;
      cand = pool.filter(function (r) { return tagScore(tags, r.tags) >= 0.35; });
    }
    var candSet = {};
    cand.forEach(function (r) { candSet[r.id] = 1; });

    // 3 · hybrid search over cards, decks, decisions and diary entries
    var scored = [];
    idx.passages.forEach(function (p) {
      if (!candSet[p.pid]) return;
      var h = hybrid(idx, qTerms, qCon, p);
      if (h.score >= E.PARAMS.match) scored.push({ p: p, h: h });
    });
    scored.sort(function (a, b) { return b.h.score - a.h.score; });
    var best = {};
    scored.forEach(function (s) { if (!best[s.p.pid] || best[s.p.pid].h.score < s.h.score) best[s.p.pid] = s; });
    var retrieved = Object.keys(best).sort(function (a, b) { return best[b].h.score - best[a].h.score; });

    // 4 · re-rank the top K, apply the floor
    var topK = retrieved.slice(0, E.PARAMS.rerankK).map(function (pid) {
      var r = idx.proj[pid];
      var ts = tagScore(tags, r.tags);
      var txt = Math.min(1, best[pid].h.score / 0.45);
      var score = 0.55 * ts + 0.45 * txt;
      return { pid: pid, title: r.title, year: r.year, tag: round(ts), text: round(txt), score: round(score), shown: score >= E.PARAMS.floor };
    }).sort(function (a, b) { return b.score - a.score; });
    var shown = topK.filter(function (x) { return x.shown; });

    // Evidence for each reference: every passage of the project, best first
    var refs = shown.map(function (x, i) {
      var r = idx.proj[x.pid];
      var ps = idx.passages.filter(function (p) { return p.pid === x.pid; }).map(function (p) {
        return { p: p, s: hybrid(idx, qTerms, qCon, p).score };
      }).sort(function (a, b) { return (b.p.kind === 'spot') - (a.p.kind === 'spot') || b.s - a.s; });
      return { rank: i + 1, pid: x.pid, score: x.score, passages: ps.map(function (o) { return o.p.id; }) };
    });

    // NOT FOUND check: does any completed project combine this source and sink?
    var notFound = null;
    var sameUtil = pool.filter(function (r) { return tags.utility && r.tags.utility === tags.utility; });
    var closedSame = sameUtil.filter(function (r) { return r.achieved != null; });
    var est = query.spot && query.spot.co2 ? query.spot.co2 + ' t' : 'the estimate';
    if (!shown.length) {
      notFound = { kind: 'none', text: 'No past project passes the similarity floor. Smart Diary shows nothing rather than a weak match. Treat ' + est + ' as unverified.' };
    } else if (!closedSame.length) {
      var open = sameUtil.filter(function (r) { return r.achieved == null; })[0];
      notFound = {
        kind: 'combo',
        text: open
          ? 'No completed project combines this heat source with this sink. ' + open.id + ' has the same combination but no result yet (' + open.status + '). Treat ' + est + ' as unverified.'
          : (tags.technology === 'heat recovery'
            ? 'No reference combines this heat source with this sink. Treat ' + est + ' as unverified.'
            : 'No reference matches this utility exactly. Treat ' + est + ' as unverified.')
      };
    }

    return {
      projectId: query.projectId,
      query: { title: query.title, tags: tags, spot: query.spot || {}, terms: qTerms.slice(0, 40), concepts: Object.keys(qCon) },
      steps: {
        filter: { total: pool.length, candidates: cand.map(function (r) { return r.id; }), widened: widened },
        search: { matched: scored.length, top: scored.slice(0, 12).map(function (s) { return { id: s.p.id, pid: s.p.pid, label: s.p.label, score: round(s.h.score), lex: round(s.h.lex), sem: round(s.h.sem) }; }) },
        rerank: { k: E.PARAMS.rerankK, floor: E.PARAMS.floor, scored: topK }
      },
      refs: refs,
      notFound: notFound,
      ms: Date.now() - t0
    };
  };

  /* ================================================================== */
  /* Sources → search_result blocks                                      */
  /* ================================================================== */
  function srcFromPassage(idx, p, extraTitle) {
    var r = idx.proj[p.pid];
    return {
      id: p.id, pid: p.pid, kind: p.kind, chip: p.chip, label: p.label, lang: p.lang,
      title: r.id + ' · ' + r.title + ' (' + r.year + ')' + (extraTitle || ''),
      blocks: sentences(p.text)
    };
  }
  function toSearchResults(sources) {
    return sources.map(function (s) {
      return {
        type: 'search_result',
        source: s.label,
        title: s.title + (s.lang === 'de' ? ' [German]' : ''),
        content: s.blocks.map(function (b) { return { type: 'text', text: b }; }),
        citations: { enabled: true }
      };
    });
  }
  E.toSearchResults = toSearchResults;

  /* Normalised writer response: {content:[{text, citations:[{search_result_index,
     start_block_index, end_block_index, cited_text}]}], model, usage} */
  function cite(sources, i, block) {
    var b = block || 0;
    return { search_result_index: i, start_block_index: b, end_block_index: b + 1, cited_text: sources[i].blocks[b] || '' };
  }
  function bestBlock(src, re) {
    for (var i = 0; i < src.blocks.length; i++) if (re.test(src.blocks[i])) return i;
    return 0;
  }

  /* ================================================================== */
  /* Citation check: no source, no sentence                              */
  /* ================================================================== */
  function concatCited(content) {
    var text = '', marks = [];
    (content || []).forEach(function (b) {
      var start = text.length;
      text += b.text || '';
      if ((b.citations || []).length) marks.push({ a: start, z: text.length, c: b.citations });
    });
    return { text: text, marks: marks };
  }
  /* Models sometimes add Markdown (**bold**, bullets, headings): strip it. */
  function demark(t) {
    return String(t).replace(/\*\*|__/g, '').replace(/^\s*(?:[-*•>]|#{1,6}|\d+[.)])\s+(?=\S)/, '').trim();
  }
  E.demark = demark;
  function splitCited(content) {
    var cc = concatCited(content);
    var padded = ' ' + cc.text;
    return sentenceSpans(padded).map(function (sp) {
      var a = sp[0] - 1, z = sp[1] - 1, cs = [];
      cc.marks.forEach(function (m) {
        var lo = Math.max(a, m.a), hi = Math.min(z, m.z);
        if (hi > lo && cc.text.slice(lo, hi).trim()) cs = cs.concat(m.c);
      });
      return { text: demark(padded.slice(sp[0], sp[1]).replace(/\s+/g, ' ')), cites: cs };
    }).filter(function (x) { return x.text; });
  }
  function check(content) {
    var kept = [], deleted = [];
    splitCited(content).forEach(function (s) {
      var words = s.text.split(/\s+/).filter(function (w) { return /[a-zA-Z0-9]/.test(w); }).length;
      if (s.cites.length) kept.push(s);
      else if (words >= 3) deleted.push(s.text);
    });
    return { kept: kept, deleted: deleted };
  }
  E.citationCheck = check;

  function lineCites(content) {
    // Lines of the brief format, each with the citations that touch it.
    var cc = concatCited(content);
    var lines = [], pos = 0;
    cc.text.split('\n').forEach(function (ln) {
      var a = pos, z = pos + ln.length;
      pos = z + 1;
      var cs = [];
      cc.marks.forEach(function (m) {
        var lo = Math.max(a, m.a), hi = Math.min(z, m.z);
        if (hi > lo && cc.text.slice(lo, hi).trim()) cs = cs.concat(m.c);
      });
      var clean = demark(ln);
      if (clean) lines.push({ text: clean, cites: cs });
    });
    return lines;
  }

  /* ================================================================== */
  /* Write the brief                                                     */
  /* ================================================================== */
  E.briefSources = function (idx, R) {
    var sources = [];
    R.refs.forEach(function (ref) {
      ref.passages.forEach(function (id) {
        var s = srcFromPassage(idx, idx.byId[id], ' · REF ' + ref.rank);
        s.ref = ref.rank;
        sources.push(s);
      });
    });
    return sources;
  };

  E.prompts = {};
  E.prompts.brief = function (idx, R) {
    var sources = E.briefSources(idx, R);
    var q = R.query;
    var refList = R.refs.map(function (ref) { var r = idx.proj[ref.pid]; return 'REF ' + ref.rank + ' = ' + r.id + ' (' + r.title + ', ' + r.year + ')'; }).join('\n');
    var system =
      'You are Smart Diary, the knowledge assistant of the Sustainability Steering Committee (SSC) at a pharmaceutical site. ' +
      'You write the reference brief that the project manager and the SSC read before Review 1. ' +
      'Use only the search results provided. They are the site’s own records: SPOT records, approval decks, SSC decisions and diary entries. ' +
      'Never add facts, figures or advice from general knowledge. Never recommend a decision; people decide. ' +
      'Some records are in German; write in English.';
    var user =
      'New project: ' + q.title + '.\nConfirmed tags: ' + SD.TAG_TYPES.map(function (t) { return q.tags[t.key]; }).filter(Boolean).join(' · ') +
      '.\nPM estimate in SPOT: ' + (q.spot.co2 || '?') + ' t CO₂e per year.\n\nThe search results belong to these references:\n' + refList +
      '\n\nFor each reference, write exactly three lines in this format and nothing else:\n' +
      'REF <n> LESSON: <the one lesson from this reference that matters most for the new project, one sentence, at most 20 words>\n' +
      'REF <n> QUESTION: <the question the new project must settle before Review 2 because of that lesson, at most 14 words>\n' +
      'REF <n> CONDITION: <a condition the SSC could set, at most 8 words> || <the same condition as one full sentence>\n' +
      'If a reference contains no lesson, write REF <n> LESSON: NONE and skip its other two lines. Do not write a title, an introduction or a summary.';
    return { task: 'brief', sources: sources, system: system, user: user, content: toSearchResults(sources).concat([{ type: 'text', text: user }]) };
  };

  E.offline = {};
  E.offline.brief = function (idx, R, prompt) {
    var content = [];
    R.refs.forEach(function (ref) {
      var lessonPassage = null;
      ref.passages.forEach(function (id) { var p = idx.byId[id]; if (p.L && !lessonPassage) lessonPassage = p; });
      if (!lessonPassage) { content.push({ text: 'REF ' + ref.rank + ' LESSON: NONE\n', citations: [] }); return; }
      var si = -1;
      prompt.sources.forEach(function (s, i) { if (s.id === lessonPassage.id && s.ref === ref.rank) si = i; });
      var L = lessonPassage.L;
      var b = bestBlock(prompt.sources[si], /./);
      var key = L.lesson.split(/[ ;,]/).filter(function (w) { return w.length > 5; })[0] || '';
      if (key) b = bestBlock(prompt.sources[si], new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      var c = [cite(prompt.sources, si, b)];
      content.push({ text: 'REF ' + ref.rank + ' LESSON: ', citations: [] });
      content.push({ text: L.lesson, citations: c });
      content.push({ text: '\nREF ' + ref.rank + ' QUESTION: ', citations: [] });
      content.push({ text: L.question, citations: c });
      content.push({ text: '\nREF ' + ref.rank + ' CONDITION: ', citations: [] });
      content.push({ text: L.condition.short + ' || ' + L.condition.long, citations: c });
      content.push({ text: '\n', citations: [] });
    });
    return { content: content, model: 'offline extractive writer' };
  };

  function citedSources(sources, cites) {
    var seen = {}, out = [];
    cites.forEach(function (c) {
      var s = sources[c.search_result_index];
      if (!s || seen[s.id]) return;
      seen[s.id] = 1;
      out.push({ id: s.id, pid: s.pid, chip: s.chip, label: s.label, kind: s.kind, cited: c.cited_text || s.blocks[c.start_block_index] || '' });
    });
    return out;
  }

  var PRIORITY = [/measur|profile|logger/i, /winter|summer|season/i, /gmp|route|classif|qa /i, /qualif|iq|oq/i];
  function conditionPriority(text) {
    for (var i = 0; i < PRIORITY.length; i++) if (PRIORITY[i].test(text)) return i + 1;
    return 9;
  }

  E.assembleBrief = function (idx, R, prompt, resp) {
    var lines = lineCites(resp.content);
    var refs = R.refs.map(function (ref) {
      var r = idx.proj[ref.pid];
      var spot = idx.byId[r.id + ':spot'];
      return {
        rank: ref.rank, pid: r.id, title: r.title, year: r.year, status: r.status, score: ref.score,
        promised: r.promised, achieved: r.achieved, pct: pct(r), owner: r.owner,
        figures: { chip: spot.chip, id: spot.id },
        lesson: null, question: null, condition: null, chips: [{ id: spot.id, chip: spot.chip }]
      };
    });
    var deleted = [];
    var unparsed = [];
    lines.forEach(function (ln) {
      var m = /^REF\s*(\d+)\s*(LESSON|QUESTION|CONDITION)\s*:\s*(.*)$/i.exec(ln.text);
      if (!m) { if (/[a-z]{3}/i.test(ln.text)) (ln.cites.length ? unparsed : deleted).push(ln.text); return; }
      var ref = refs[Number(m[1]) - 1];
      var field = m[2].toUpperCase(), body = m[3].trim();
      if (!ref) return;
      if (/^NONE\b/i.test(body)) return;
      if (!ln.cites.length) { deleted.push(body); return; }
      var cs = citedSources(prompt.sources, ln.cites);
      var item = { text: body, sources: cs };
      if (field === 'LESSON') {
        ref.lesson = item;
        cs.forEach(function (s) { if (!ref.chips.some(function (c) { return c.id === s.id; })) ref.chips.push({ id: s.id, chip: s.chip }); });
      } else if (field === 'QUESTION') ref.question = item;
      else {
        var parts = body.split('||');
        ref.condition = { short: parts[0].trim(), long: (parts[1] || parts[0]).trim(), sources: cs };
      }
    });
    // Keep the lesson passage's supporting pages as chips (e.g. the deck page with the assumption)
    refs.forEach(function (ref) {
      if (!ref.lesson) return;
      idx.passages.forEach(function (p) {
        if (p.pid === ref.pid && p.supports && !ref.chips.some(function (c) { return c.id === p.id; })) ref.chips.push({ id: p.id, chip: p.chip });
      });
      ref.chips.sort(function (a, b) { return order(idx.byId[a.id]) - order(idx.byId[b.id]); });
    });
    function order(p) { return p.kind === 'spot' ? 0 : p.kind === 'deck' ? 1 + p.page / 100 : p.kind === 'decision' ? 2 : 3; }
    var questions = [], seenQ = {};
    refs.forEach(function (ref) { if (ref.question && !seenQ[ref.question.text]) { seenQ[ref.question.text] = 1; questions.push({ text: ref.question.text, ref: ref.rank }); } });
    var conditions = [], seenC = {};
    refs.forEach(function (ref) {
      if (!ref.condition) return;
      var k = ref.condition.short.toLowerCase();
      if (seenC[k]) return; seenC[k] = 1;
      conditions.push({ short: ref.condition.short, long: ref.condition.long, ref: ref.rank, pid: ref.pid, priority: conditionPriority(ref.condition.short + ' ' + ref.condition.long) });
    });
    conditions.sort(function (a, b) { return a.priority - b.priority || a.ref - b.ref; });
    return { refs: refs, questions: questions, conditions: conditions, deleted: deleted, notFound: R.notFound, sentences: lines.length };
  };

  /* ================================================================== */
  /* Ask                                                                 */
  /* ================================================================== */
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var ADJ = { 'heat recovery': 'heat-recovery', 'heat pump': 'heat-pump', 'compressed air': 'compressed-air', 'steam & condensate': 'steam and condensate', 'solvent & waste recovery': 'solvent and waste', 'insulation & envelope': 'insulation', 'HVAC airflow & controls': 'HVAC airflow' };
  function techAdj(t) { return t ? (ADJ[t] || t) + ' ' : ''; }
  function listJoin(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  function parseQuestion(q) {
    var t = ' ' + norm(q) + ' ';
    var f = { tech: detectTech(q) };
    var m;
    if ((m = /(since|seit|from)\s+(\d{4})/i.exec(q))) f.yearMin = +m[2];
    if ((m = /after\s+(\d{4})/i.exec(q))) f.yearMin = +m[1] + 1;
    if ((m = /(before|until|bis)\s+(\d{4})/i.exec(q))) f.yearMax = +m[2] - (m[1] === 'before' ? 1 : 0);
    if ((m = /\bin\s+(\d{4})\b/i.exec(q))) { f.yearMin = f.yearMax = +m[1]; }
    if ((m = /(less than|below|under|unter)\s+(\d+)\s*%/i.exec(q))) f.pctMax = +m[2];
    if ((m = /(more than|above|over|at least)\s+(\d+)\s*%/i.exec(q))) f.pctMin = +m[2];
    var con = concepts(q);
    var intent = 'search';
    if (con.requal) intent = 'requal';
    else if (/\b(how many|number of|count|wie viele)\b/i.test(q)) intent = 'count';
    else if (f.pctMax != null || f.pctMin != null || /achiev|promis|deliver|shortfall|underperform/i.test(q)) intent = 'performance';
    else if (/\b(who|whom|call|contact|expert|owner|wen)\b/i.test(t)) intent = 'who';
    return { intent: intent, filters: f, concepts: Object.keys(con) };
  }
  E.parseQuestion = parseQuestion;

  function filterDesc(f) {
    var parts = [];
    if (f.tech) parts.push('technology = ' + f.tech);
    if (f.yearMin != null && f.yearMax != null && f.yearMin === f.yearMax) parts.push('year = ' + f.yearMin);
    else {
      if (f.yearMin != null) parts.push('year ≥ ' + f.yearMin);
      if (f.yearMax != null) parts.push('year ≤ ' + f.yearMax);
    }
    return parts;
  }
  function applyFilters(idx, f) {
    return idx.projects.filter(function (r) {
      if (f.tech && r.tags.technology !== f.tech) return false;
      if (f.yearMin != null && r.year < f.yearMin) return false;
      if (f.yearMax != null && r.year > f.yearMax) return false;
      return true;
    });
  }

  function searchPassages(idx, question, opts) {
    var qTerms = tokens(question).filter(function (w) { return !/^(call|contact|whom|who|expert|owner)$/.test(w); });
    var qCon = concepts(question);
    var hits = [];
    idx.passages.forEach(function (p) {
      if (p.kind === 'spot' && !(opts && opts.cards)) return;
      var h = hybrid(idx, qTerms, qCon, p);
      if (h.score >= E.PARAMS.askFloor && (h.sem > 0 || h.lex >= 0.75)) hits.push({ p: p, h: h });
    });
    hits.sort(function (a, b) { return b.h.score - a.h.score; });
    var perProject = {}, out = [];
    hits.forEach(function (x) {
      perProject[x.p.pid] = (perProject[x.p.pid] || 0) + 1;
      if (perProject[x.p.pid] <= 2 && out.length < 5) out.push(x);
    });
    return out;
  }

  /* Retrieval for Ask: structured SPOT facts + passages. Counts come from SPOT. */
  E.retrieveAsk = function (idx, question, ctx) {
    var t0 = Date.now();
    var P = parseQuestion(question);
    var f = P.filters;
    var facts = null, sources = [], rows = [];
    var spotRows = function (title, list, render, checked) {
      return {
        id: 'spotquery', pid: null, kind: 'query', chip: 'SPOT QUERY', label: 'SPOT query', lang: 'en',
        title: title,
        blocks: ['SPOT query: ' + title + '. ' + checked + ' records checked, ' + list.length + ' match.'].concat(list.map(render)),
        rows: list.map(function (r) { return r.id; })
      };
    };
    var structured = (P.intent === 'requal' || P.intent === 'count' || P.intent === 'performance') && (f.tech || f.yearMin != null || f.pctMax != null || f.pctMin != null || P.intent === 'requal');
    if (structured) {
      var base = applyFilters(idx, f);
      var desc = filterDesc(f);
      if (P.intent === 'requal') {
        rows = base.filter(function (r) { return r.requal; });
        facts = spotRows(desc.concat('requalification = yes').join(', '), rows, function (r) {
          return r.id + ': ' + r.title + ' (' + r.year + '), requalification needed, about ' + r.requal.months + ' months.';
        }, base.length);
        sources.push(facts);
        rows.forEach(function (r) {
          var p = idx.passages.filter(function (x) { return x.pid === r.id && x.con.requal && x.kind !== 'spot'; })[0];
          if (p) sources.push(srcFromPassage(idx, p));
        });
      } else if (P.intent === 'performance') {
        var withPct = base.filter(function (r) { return r.achieved != null; });
        rows = withPct.filter(function (r) {
          var x = pct(r);
          return (f.pctMax == null || x < f.pctMax) && (f.pctMin == null || x >= f.pctMin);
        }).sort(function (a, b) { return pct(a) - pct(b); });
        var cond = f.pctMax != null ? 'achieved < ' + f.pctMax + ' % of promise' : f.pctMin != null ? 'achieved ≥ ' + f.pctMin + ' % of promise' : 'achieved figure recorded';
        facts = spotRows(desc.concat(cond).join(', '), rows, function (r) {
          return r.id + ': ' + r.title + ' (' + r.year + '), promised ' + r.promised + ' t, achieved ' + r.achieved + ' t, ' + pct(r) + ' %.';
        }, base.length);
        facts.blocks.push((base.length - withPct.length) + ' of the ' + base.length + ' records have no achieved figure.');
        sources.push(facts);
        rows.slice(0, 4).forEach(function (r) {
          var p = idx.passages.filter(function (x) { return x.pid === r.id && x.L; })[0];
          if (p) sources.push(srcFromPassage(idx, p));
        });
      } else {
        rows = base;
        facts = spotRows(desc.join(', ') || 'all projects', rows, function (r) {
          return r.id + ': ' + r.title + ' (' + r.year + ', ' + r.status + ').';
        }, idx.projects.length);
        sources.push(facts);
      }
    } else {
      var hits = searchPassages(idx, question, { cards: P.intent === 'who' });
      if (P.intent === 'who') {
        var pids = [];
        hits.forEach(function (x) { if (pids.indexOf(x.p.pid) < 0) pids.push(x.p.pid); });
        pids.slice(0, 3).forEach(function (pid) { sources.push(srcFromPassage(idx, idx.byId[pid + ':spot'])); });
        hits.slice(0, 3).forEach(function (x) { if (x.p.kind !== 'spot') sources.push(srcFromPassage(idx, x.p)); });
      } else {
        hits.forEach(function (x) { sources.push(srcFromPassage(idx, x.p)); });
      }
    }
    var notFound = structured ? false : sources.length === 0;
    return {
      question: question, intent: P.intent, filters: f, structured: !!structured, rows: rows.map(function (r) { return r.id; }),
      context: ctx || null, sources: sources, notFound: notFound, ms: Date.now() - t0
    };
  };

  E.prompts.ask = function (A) {
    var system =
      'You are Smart Diary, the knowledge assistant of the Sustainability Steering Committee (SSC) at a pharmaceutical site. ' +
      'Answer only from the search results provided: the site’s own SPOT records, approval decks, SSC decisions and diary entries. ' +
      'Every sentence must be supported by a search result. Never use general knowledge, never estimate, never give advice; people decide. ' +
      'Counts and totals: use the SPOT query result exactly as given. Mention project IDs such as 10xxxx3. Some records are in German; answer in English. ' +
      'Keep the answer to at most four sentences, plain text, no headings, no lists. ' +
      'If the search results do not answer the question, reply with exactly: NOT FOUND';
    var ctx = A.context ? '\n\nContext of the current project: ' + A.context : '';
    var user = 'Question: ' + A.question + ctx;
    return { task: 'ask', sources: A.sources, system: system, user: user, content: toSearchResults(A.sources).concat([{ type: 'text', text: user }]) };
  };

  E.offline.ask = function (idx, A) {
    var S = A.sources, c = [];
    var F = A.filters;
    var techWord = techAdj(F.tech);
    if (A.structured && A.intent === 'requal') {
      var rows = A.rows;
      if (!rows.length) {
        c.push({ text: 'No ' + techWord + 'project matching these filters needed requalification. No records found.', citations: [cite(S, 0, 0)] });
      } else {
        var bits = rows.slice(0, 6).map(function (id) {
          var r = idx.proj[id];
          var si = -1;
          S.forEach(function (s, i) { if (s.pid === id && i > 0 && si < 0) si = i; });
          var b = si >= 0 ? bestBlock(S[si], /qualif|IQ|OQ/i) : 0;
          return { text: id + ', about ' + num(r.requal.months) + ' months', c: si >= 0 ? [cite(S, si, b)] : [cite(S, 0, 1 + rows.indexOf(id))] };
        });
        c.push({ text: cap(num(rows.length)) + ' project' + (rows.length > 1 ? 's' : '') + ' needed requalification: ', citations: [] });
        bits.forEach(function (b, i) {
          c.push({ text: b.text, citations: b.c });
          c.push({ text: i < bits.length - 2 ? ', ' : i === bits.length - 2 ? ', and ' : '. ', citations: [] });
        });
        if (rows.length > 6) c.push({ text: 'There are ' + (rows.length - 6) + ' more in SPOT. ', citations: [cite(S, 0, 0)] });
        c.push({ text: 'No other records found.', citations: [cite(S, 0, 0)] });
      }
    } else if (A.structured && A.intent === 'performance') {
      var rs = A.rows;
      if (!rs.length) c.push({ text: 'No ' + techWord + 'project in SPOT matches this condition.', citations: [cite(S, 0, 0)] });
      else {
        var lst = rs.slice(0, 6).map(function (id) { var r = idx.proj[id]; return id + ' (' + pct(r) + ' %)'; });
        var verb = F.pctMax != null ? 'achieved less than ' + F.pctMax + ' % of their promise' : F.pctMin != null ? 'achieved at least ' + F.pctMin + ' % of their promise' : 'have an achieved figure in SPOT';
        if (rs.length === 1) verb = verb.replace('their', 'its').replace('have', 'has');
        c.push({ text: cap(num(rs.length)) + ' ' + techWord + 'project' + (rs.length > 1 ? 's ' : ' ') + verb + ': ' + listJoin(lst) + (rs.length > 6 ? ' and ' + (rs.length - 6) + ' more' : '') + '. ', citations: [cite(S, 0, 0)] });
        S.slice(1, 3).forEach(function (s, i) {
          var p = idx.byId[s.id];
          c.push({ text: s.pid + ': ' + (p.L ? p.L.lesson : s.blocks[0]) + ' ', citations: [cite(S, i + 1, bestBlock(s, /./))] });
        });
      }
      c.push({ text: S[0].blocks[S[0].blocks.length - 1], citations: [cite(S, 0, S[0].blocks.length - 1)] });
    } else if (A.structured) {
      var n = A.rows.length;
      var ids = A.rows.slice(0, 5);
      c.push({ text: cap(num(n)) + ' ' + techWord + 'project' + (n === 1 ? ' is' : 's are') + ' recorded in SPOT' + (n ? ', for example ' + listJoin(ids) : '') + '.', citations: [cite(S, 0, 0)] });
    } else if (A.notFound) {
      c.push({ text: 'NOT FOUND', citations: [] });
    } else if (A.intent === 'who') {
      var cards = S.filter(function (s) { return s.kind === 'spot'; });
      cards.forEach(function (s, i) {
        var r = idx.proj[s.pid];
        if (!r.owner) return;
        var si = S.indexOf(s);
        c.push({ text: (i === 0 ? 'Call ' : 'Also call ') + r.owner.name + ' (' + r.owner.role + '), owner of ' + r.id + ', ' + r.title + '. ', citations: [cite(S, si, bestBlock(s, /^Owner/))] });
      });
    } else {
      S.slice(0, 3).forEach(function (s, i) {
        var p = s.kind !== 'spot' ? s : null;
        var b = 0;
        if (p) {
          var best = -1;
          s.blocks.forEach(function (bl, k) { var l = tokens(bl).filter(function (w) { return tokens(A.question).indexOf(w) >= 0; }).length; if (l > best) { best = l; b = k; } });
        }
        var r = idx.proj[s.pid];
        var sent = s.blocks[b];
        c.push({ text: 'In ' + r.id + ' (' + r.title + ', ' + r.year + ')' + (s.lang === 'de' ? ', German record' : '') + ': ' + sent + ' ', citations: [cite(S, i, b)] });
      });
    }
    return { content: c, model: 'offline extractive writer' };
  };

  E.assembleAsk = function (A, resp) {
    var raw = (resp.content || []).map(function (b) { return b.text; }).join('').trim();
    if (A.notFound || /^NOT FOUND\b/.test(raw)) {
      return { notFound: true, sentences: [], sources: [], deleted: [], usedSpot: false };
    }
    var chk = check(resp.content);
    if (!chk.kept.length) return { notFound: true, sentences: [], sources: [], deleted: chk.deleted, usedSpot: false };
    var order = [], map = {};
    var sents = chk.kept.map(function (s) {
      var nums = [];
      s.cites.forEach(function (c) {
        var src = A.sources[c.search_result_index];
        if (!src) return;
        if (map[src.id] == null) { map[src.id] = order.length; order.push({ src: src, cited: c.cited_text || src.blocks[c.start_block_index] || src.blocks[0] }); }
        var n = map[src.id] + 1;
        if (nums.indexOf(n) < 0) nums.push(n);
      });
      return { text: s.text, cites: nums };
    });
    var sources = order.map(function (o, i) {
      return { n: i + 1, id: o.src.id, pid: o.src.pid, chip: o.src.chip, label: o.src.label, kind: o.src.kind, cited: o.cited, rows: o.src.rows || null, title: o.src.title };
    });
    return { notFound: false, sentences: sents, sources: sources, deleted: chk.deleted, usedSpot: sources.some(function (s) { return s.kind === 'query'; }) };
  };

  /* ================================================================== */
  /* Write: diary entry 1, drafted from what is already written          */
  /* ================================================================== */
  function fmtDate(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  E.fmtDate = fmtDate;

  /* input: {projectId, title, description, meeting, co2, unverified, decision:{option, conditions:[{short,long,ref,pid}]},
             refsUsed:[{pid, lesson}], tags:[...] } */
  E.draftSources = function (input) {
    var form = {
      id: 'form', pid: input.projectId, kind: 'form', chip: 'SSC APP FORM', label: 'SSC App form · ' + input.projectId, lang: 'en',
      title: 'SSC Project Presentation · ' + input.projectId,
      blocks: ['Title: ' + input.title + '.', 'Description: ' + input.description, 'CO₂ reduction in SPOT: ' + input.co2 + ' t CO₂e per year (PM estimate).']
    };
    var d = input.decision || {};
    var optText = d.option === 'conditions' ? 'Go to deepening with ' + num((d.conditions || []).length) + ' conditions.' : d.option === 'hold' ? 'Hold and rework.' : 'Go to deepening as proposed.';
    var dec = {
      id: 'decision', pid: input.projectId, kind: 'decision', chip: 'REVIEW 1 OUTCOME', label: 'SSC Review 1 outcome · ' + fmtDate(input.meeting), lang: 'en',
      title: 'SSC Review 1 decision, ' + fmtDate(input.meeting),
      blocks: ['Decision of SSC Review 1 on ' + fmtDate(input.meeting) + ': ' + optText].concat((d.conditions || []).map(function (c, i) {
        return 'Condition ' + (i + 1) + ' (from reference ' + c.pid + '): ' + c.long;
      })).concat(d.note ? ['Note: ' + d.note] : [])
    };
    var refs = {
      id: 'refs', pid: input.projectId, kind: 'refs', chip: 'REFERENCES USED', label: 'References used · ' + input.projectId, lang: 'en',
      title: 'References the PM cited',
      blocks: (input.refsUsed || []).length ? input.refsUsed.map(function (r) { return 'Reference ' + r.pid + ': ' + r.lesson; }) : ['No reference was cited.']
    };
    var est = {
      id: 'estimate', pid: input.projectId, kind: 'brief', chip: 'REFERENCE BRIEF', label: 'Reference brief · not found', lang: 'en',
      title: 'Reference brief, not-found line',
      blocks: [input.unverified ? 'Not found: no completed project combines this heat source with this sink, so the ' + input.co2 + ' t estimate is unverified.' : 'A completed reference exists for this combination.']
    };
    return [form, dec, refs, est];
  };

  E.prompts.draft = function (input) {
    var sources = E.draftSources(input);
    var system =
      'You draft diary entries for Smart Diary. A diary entry records a gate of an SSC project in at most 120 words. ' +
      'Use only the search results: the SSC App form, the Review 1 outcome, the references the PM cited and the brief. Add nothing else. ' +
      'Plain text, one paragraph, no headings. Nothing is published until the project manager confirms it.';
    var user =
      'Draft diary entry 1 (after SSC Review 1) for project ' + input.projectId + '. Use this order: ' +
      '"Decision (Review 1, ' + fmtDate(input.meeting) + '):" followed by the decision and the numbered conditions written as (1), (2), (3); ' +
      'then "References used:" with each project ID and its lesson in a few words in brackets; ' +
      'then, if the brief says the estimate is unverified, one sentence saying the CO₂ figure is a PM estimate and stays unverified until measured.';
    return { task: 'draft', sources: sources, system: system, user: user, content: toSearchResults(sources).concat([{ type: 'text', text: user }]) };
  };

  E.offline.draft = function (input, prompt) {
    var S = prompt.sources;
    var d = input.decision || {};
    var c = [];
    var conds = d.conditions || [];
    var head = 'Decision (Review 1, ' + fmtDate(input.meeting) + '): ';
    if (d.option === 'conditions') {
      c.push({ text: head + 'go to deepening with ' + num(conds.length) + ' condition' + (conds.length === 1 ? '' : 's') + '. ', citations: [cite(S, 1, 0)] });
      conds.forEach(function (k, i) { c.push({ text: '(' + (i + 1) + ') ' + k.long + ' ', citations: [cite(S, 1, i + 1)] }); });
    } else if (d.option === 'hold') {
      c.push({ text: head + 'hold and rework. ', citations: [cite(S, 1, 0)] });
    } else {
      c.push({ text: head + 'go to deepening as proposed. ', citations: [cite(S, 1, 0)] });
    }
    if ((input.refsUsed || []).length) {
      c.push({ text: 'References used: ' + input.refsUsed.map(function (r) { return r.pid + ' (' + (r.short || r.lesson).replace(/\.$/, '').toLowerCase() + ')'; }).join(', ') + '. ', citations: input.refsUsed.map(function (r, i) { return cite(S, 2, i); }) });
    }
    if (input.unverified) {
      c.push({ text: 'The ' + input.co2 + ' t CO₂e per year is a PM estimate and stays unverified until measured.', citations: [cite(S, 0, 2), cite(S, 3, 0)] });
    }
    return { content: c, model: 'offline extractive writer' };
  };

  E.assembleDraft = function (input, prompt, resp) {
    var chk = check(resp.content);
    var text = chk.kept.map(function (s) { return s.text; }).join(' ');
    var used = {};
    chk.kept.forEach(function (s) { s.cites.forEach(function (c) { var src = prompt.sources[c.search_result_index]; if (src) used[src.chip] = 1; }); });
    return {
      text: text, words: text.split(/\s+/).filter(Boolean).length, deleted: chk.deleted,
      draftedFrom: Object.keys(used)
    };
  };

  /* A confirmed diary entry becomes an archive record (indexed "overnight"). */
  E.recordFromDiary = function (p) {
    var conds = (p.decision && p.decision.conditions) || [];
    var lesson = conds.length
      ? 'Review 1 set ' + num(conds.length) + ' conditions: ' + listJoin(conds.map(function (c) { return c.short.toLowerCase(); })) + '.'
      : 'Review 1 decided: ' + (p.decision && p.decision.option === 'hold' ? 'hold and rework.' : 'go to deepening as proposed.');
    var owner = (SD.CONTACTS.filter(function (c) { return c.id === p.contact; })[0]) || SD.CONTACTS[0];
    return {
      id: p.id, n: 900, title: p.title, year: Number(String(p.meeting || '2026').slice(0, 4)), status: 'in deepening',
      tags: p.tags, promised: p.co2, achieved: null, requal: null, shortLesson: null,
      owner: { name: owner.name, role: owner.role, dept: 'Utilities' },
      passages: [{
        id: p.id + ':d-Review 1', kind: 'diary', gate: 'Review 1', date: p.meeting, lang: 'en', text: p.entryText, supports: false,
        L: {
          lesson: lesson,
          question: conds.length ? 'Do the Review 1 conditions of ' + p.id + ' apply to this project?' : 'What did Review 1 of ' + p.id + ' decide?',
          condition: { short: 'Apply the Review 1 conditions of ' + p.id, long: 'Check which Review 1 conditions of ' + p.id + ' apply here.', priority: 9 }
        }
      }]
    };
  };

  /* ================================================================== */
  /* Orchestration: retrieve → write (Claude or offline) → check         */
  /* ================================================================== */
  function runWriter(write, prompt, offline) {
    var t0 = Date.now();
    if (!write) return Promise.resolve({ resp: offline(), writer: { mode: 'offline', model: 'offline extractive writer', ms: Date.now() - t0 } });
    return Promise.resolve()
      .then(function () { return write(prompt); })
      .then(function (resp) {
        return { resp: resp, writer: { mode: 'claude', model: resp.model, ms: Date.now() - t0, usage: resp.usage || null } };
      })
      .catch(function (err) {
        return { resp: offline(), writer: { mode: 'offline', model: 'offline extractive writer', ms: Date.now() - t0, fallback: String((err && err.message) || err) } };
      });
  }

  E.rag = {};
  E.rag.brief = function (idx, query, write) {
    var R = E.retrieveBrief(idx, query);
    var prompt = E.prompts.brief(idx, R);
    if (!R.refs.length) {
      return Promise.resolve({ R: R, brief: E.assembleBrief(idx, R, prompt, { content: [] }), writer: { mode: 'none', ms: 0 } });
    }
    return runWriter(write, prompt, function () { return E.offline.brief(idx, R, prompt); }).then(function (o) {
      return { R: R, brief: E.assembleBrief(idx, R, prompt, o.resp), writer: o.writer };
    });
  };
  E.rag.ask = function (idx, question, ctx, write) {
    var A = E.retrieveAsk(idx, question, ctx);
    var prompt = E.prompts.ask(A);
    if (A.notFound) return Promise.resolve({ A: A, answer: E.assembleAsk(A, { content: [] }), writer: { mode: 'none', ms: 0 } });
    return runWriter(write, prompt, function () { return E.offline.ask(idx, A); }).then(function (o) {
      return { A: A, answer: E.assembleAsk(A, o.resp), writer: o.writer };
    });
  };
  E.rag.draft = function (input, write) {
    var prompt = E.prompts.draft(input);
    return runWriter(write, prompt, function () { return E.offline.draft(input, prompt); }).then(function (o) {
      return { draft: E.assembleDraft(input, prompt, o.resp), writer: o.writer };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
