/*
 * Smart Diary · demo data
 * -----------------------------------------------------------------------------
 * ILLUSTRATIVE DATA. Every project, SPOT ID, person and figure in this file is
 * invented to show the format. Form fields follow the SSC App v2.0 form.
 *
 * Works in the browser (window.SD) and in Node (globalThis.SD via require()).
 */
(function (root) {
  'use strict';
  var SD = (root.SD = root.SD || {});

  /* ------------------------------------------------------------------ */
  /* Controlled vocabulary: six tag types                                */
  /* ------------------------------------------------------------------ */
  SD.TAG_TYPES = [
    { key: 'technology', label: 'Technology' },
    { key: 'utility', label: 'Utility' },
    { key: 'scope', label: 'Scope' },
    { key: 'area', label: 'Area' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'capex', label: 'CAPEX' }
  ];

  SD.VOCAB = {
    technology: [
      'heat recovery', 'heat pump', 'chiller optimisation', 'HVAC airflow & controls',
      'steam & condensate', 'compressed air', 'LED lighting', 'solar PV', 'water reuse',
      'solvent & waste recovery', 'insulation & envelope', 'refrigerant replacement'
    ],
    utility: [
      'process cooling → HVAC heating', 'process cooling → hot water', 'chilled water → HVAC heating',
      'chilled water → hot water', 'compressed air → hot water', 'compressed air → HVAC heating',
      'exhaust air → supply air', 'waste water → HVAC heating', 'refrigeration heat → HVAC heating',
      'boiler flue gas → feed water', 'steam condensate → feed water', 'steam condensate → hot water',
      'clean-steam condensate → purified water',
      'heating hot water', 'chilled water', 'ventilation air', 'steam', 'compressed air', 'electricity',
      'purified water / WFI', 'solvent streams', 'refrigerant circuit'
    ],
    scope: ['Scope 1', 'Scope 2', 'Scope 1+2', 'Scope 3'],
    area: [
      'utilities building', 'production building', 'GMP clean-room area', 'QC laboratory',
      'warehouse', 'office building', 'site-wide', 'outdoor / parking'
    ],
    equipment: [
      'heat exchanger', 'heat pump', 'air-handling unit', 'chiller', 'compressor', 'boiler',
      'steam traps', 'pumps & VFDs', 'LED luminaires', 'PV modules', 'RO / distillation unit',
      'solvent recovery unit', 'insulation', 'building management system'
    ],
    capex: ['< €50k', '€50–250k', '€250–500k', '€500k–1M', '> €1M']
  };

  /* People. All names invented. */
  SD.PEOPLE = {
    berger: { name: 'M. Berger', role: 'Utilities Engineering', dept: 'Utilities' },
    novak: { name: 'S. Novak', role: 'Utilities Engineering', dept: 'Utilities' },
    steiner: { name: 'P. Steiner', role: 'Utilities Operations', dept: 'Utilities' },
    wimmer: { name: 'A. Wimmer', role: 'Engineering & Qualification', dept: 'Engineering' },
    moser: { name: 'J. Moser', role: 'Engineering', dept: 'Engineering' },
    leitner: { name: 'K. Leitner', role: 'Energy Management', dept: 'Energy Mgmt' },
    huber: { name: 'T. Huber', role: 'Facility Management', dept: 'Facilities' },
    bauer: { name: 'C. Bauer', role: 'Facility Management', dept: 'Facilities' },
    fuchs: { name: 'D. Fuchs', role: 'Production Engineering', dept: 'Production' },
    schmid: { name: 'N. Schmid', role: 'QC Laboratory Operations', dept: 'QC Lab' },
    gruber: { name: 'R. Gruber', role: 'HSE', dept: 'HSE' },
    eder: { name: 'H. Eder', role: 'QA Validation', dept: 'QA' }
  };

  SD.CONTACTS = [
    { id: 'lh', initials: 'LH', name: 'L. Hofer', role: 'Project Manager, Utilities' },
    { id: 'aw', initials: 'AW', name: 'A. Wimmer', role: 'Engineering & Qualification' },
    { id: 'kl', initials: 'KL', name: 'K. Leitner', role: 'Energy Management' },
    { id: 'th', initials: 'TH', name: 'T. Huber', role: 'Facility Management' }
  ];

  /* SSC meets every Thursday at 14:35 */
  SD.MEETINGS = ['2026-11-19', '2026-11-26', '2026-12-03', '2026-12-10', '2026-12-17'];

  /* ------------------------------------------------------------------ */
  /* Hand-written archive: the 19 heat-recovery projects                 */
  /* ------------------------------------------------------------------ */
  function L(lesson, question, cShort, cLong, priority, requalOnly) {
    return { lesson: lesson, question: question, condition: { short: cShort, long: cLong, priority: priority || 9 }, requalOnly: !!requalOnly };
  }

  var HR = [
    {
      n: 1, title: 'Chiller condenser heat → HVAC pre-heating', year: 2021, status: 'closed',
      tags: { utility: 'chilled water → HVAC heating', scope: 'Scope 1', area: 'utilities building', equipment: 'heat exchanger', capex: '€250–500k' },
      promised: 210, achieved: 140, owner: 'berger', shortLesson: 'heat demand only October to April',
      passages: [
        { kind: 'deck', page: 3, date: '2020-02-14', text: 'Business case. Recover condenser heat from chillers K1 to K3 with a plate heat exchanger and feed it into the AHU pre-heating coils of the utilities building. Expected saving: 210 t CO₂e per year, based on full-year heat demand.' },
        { kind: 'deck', page: 6, date: '2020-02-14', supports: true, text: 'Design basis. 1.1 MW recoverable at 32 °C from the condenser circuit. Assumption: the pre-heating coils need heat all year at the same level.' },
        { kind: 'decision', gate: 'Review 1', date: '2020-03-12', text: 'SSC Review 1: go to deepening as proposed. No conditions recorded.' },
        { kind: 'diary', gate: 'go-live', date: '2021-03-18', text: 'Commissioned in March 2021. Tuning the three-way control valves took two weeks longer than planned.' },
        { kind: 'diary', gate: 'closeout', date: '2022-05-04', text: 'Achieved 140 t CO₂e in the first full year, 67 % of the promise. Heat demand falls in summer; savings came only October to April. Advice to the next project: check that the sink needs heat all year before sizing on the source.',
          L: L('Heat demand falls in summer; savings came only October to April.', 'Is there heat demand at the sink all year?', 'Winter and summer split of the savings', 'Split the expected savings into winter and summer.', 2) }
      ]
    },
    {
      n: 2, title: 'Heat exchanger on the cooling-water return', year: 2022, status: 'closed',
      tags: { utility: 'process cooling → hot water', scope: 'Scope 1', area: 'utilities building', equipment: 'heat exchanger', capex: '€50–250k' },
      promised: 95, achieved: 90, owner: 'novak', shortLesson: 'source load below the design basis',
      passages: [
        { kind: 'deck', page: 6, date: '2021-05-20', text: 'Load profile. The cooling load was taken from one week of chiller logs in March; weekends were not measured.' },
        { kind: 'deck', page: 4, date: '2021-05-20', text: 'Plate heat exchanger on the process cooling-water return in the utilities building, pre-heating process hot water for line 3 from 12 to 28 °C. Design basis: 650 kW cooling load, five days a week. Expected saving: 95 t CO₂e per year.' },
        { kind: 'diary', gate: 'go-live', date: '2022-06-09', text: 'Weekend and shutdown cooling load was 35 % below the design basis. A four-week logger measurement before sizing would have shown it; one plate pack was removed before go-live.',
          L: L('Weekend and shutdown cooling load was 35 % below the design basis.', 'Has the heat-source profile been measured?', 'Four weeks of cooling-load measurement', 'Measure the process-cooling load for four weeks, including weekends and shutdowns.', 1) },
        { kind: 'diary', gate: 'closeout', date: '2023-07-12', text: 'Achieved 90 t CO₂e per year, 95 % of the promise, after the plate pack was adjusted.' }
      ]
    },
    {
      n: 3, title: 'Waste-heat line into a GMP-area hot-water loop', year: 2020, status: 'closed',
      tags: { utility: 'compressed air → hot water', scope: 'Scope 1', area: 'utilities building', equipment: 'heat exchanger', capex: '€250–500k' },
      promised: 120, achieved: null, owner: 'wimmer', shortLesson: 'requalification added about 4 months',
      requal: { months: 4, ref: 1 },
      passages: [
        { kind: 'deck', page: 5, date: '2019-04-11', text: 'Route. The new line runs 140 m from the compressor room through corridor B to the hot-water loop of building 4.' },
        { kind: 'deck', page: 2, date: '2019-04-11', text: 'Business case. Recover waste heat at about 35 °C from the compressor cooling circuit with a plate heat exchanger. A new pipe line carries it to the hot-water loop that feeds the HVAC pre-heating coils of building 4. Expected saving: 120 t CO₂e per year.' },
        { kind: 'deck', page: 9, date: '2019-04-11', text: 'Risks and schedule. The new pipe route crosses a classified corridor (grade C). Requalification of the hot-water loop: 17 weeks.',
          L: L('The route crossed a classified area; requalification added about 4 months.', 'Does the route cross a GMP-classified area?', 'QA check of the pipe route (GMP classification)', 'QA checks whether the pipe route crosses a GMP-classified area.', 3) }
      ]
    },
    {
      n: 4, title: 'Compressor heat for domestic hot water', year: 2019, status: 'closed',
      tags: { utility: 'compressed air → hot water', scope: 'Scope 1', area: 'utilities building', equipment: 'heat exchanger', capex: '€50–250k' },
      promised: 60, achieved: 58, owner: 'leitner',
      passages: [
        { kind: 'diary', gate: 'go-live', date: '2019-05-16', text: 'Commissioned in May 2019. The plate heat exchanger delivers water at 65 °C to the hot-water tank.' },
        { kind: 'deck', page: 4, date: '2018-09-03', text: 'Design basis. Hot-water demand peaks in the morning; the plate heat exchanger is sized for 120 kW.' },
        { kind: 'deck', page: 2, date: '2018-09-03', text: 'Oil-cooled screw compressors C1 and C2 deliver about 180 kW of heat at 70 °C. A heat exchanger feeds it into the domestic hot-water tank of the utilities building. Expected saving: 60 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2020-10-02', text: 'Achieved 58 t CO₂e per year. The compressors run at part load at night, so the gas boiler stays as back-up for hot water.',
          L: L('Compressors run at part load at night; the gas boiler stays as back-up.', 'Is the heat source available when the sink needs it?', 'Compare source and sink operating hours', 'Compare the operating hours of the heat source and the heat sink.', 5) }
      ]
    },
    {
      n: 5, title: 'Waste-water heat pump for the HVAC heating network', year: 2022, status: 'closed',
      tags: { utility: 'waste water → HVAC heating', scope: 'Scope 1', area: 'site-wide', equipment: 'heat pump', capex: '€500k–1M' },
      promised: 150, achieved: 96, owner: 'berger',
      passages: [
        { kind: 'deck', page: 7, date: '2021-03-25', text: 'Risks. Fouling of the heat exchanger in waste water; the cleaning interval is still to be defined.' },
        { kind: 'deck', page: 5, date: '2021-03-25', text: 'A heat pump lifts heat from the site waste-water channel to 45 °C for the HVAC heating network. Expected saving: 150 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2023-11-15', text: 'Achieved 96 t CO₂e per year, 64 % of the promise. Fouling of the waste-water heat exchanger cut the heat output; cleaning every six weeks was not in the maintenance plan.',
          L: L('Fouling cut the heat output; six-weekly cleaning was not planned.', 'Is exchanger fouling in the maintenance plan?', 'Maintenance plan for exchanger fouling', 'Add exchanger cleaning to the maintenance plan before go-live.', 6) }
      ]
    },
    {
      n: 6, title: 'Run-around coils in the office AHUs', year: 2018, status: 'closed',
      tags: { utility: 'exhaust air → supply air', scope: 'Scope 1', area: 'office building', equipment: 'air-handling unit', capex: '€50–250k' },
      promised: 40, achieved: 37, owner: 'huber',
      passages: [
        { kind: 'diary', gate: 'go-live', date: '2017-11-09', text: 'Commissioned in November 2017. Supply-air pre-heating from the exhaust coils works as designed.' },
        { kind: 'deck', page: 4, date: '2017-06-08', text: 'Design basis. Heat recovery efficiency 55 %; supply air is pre-heated from −5 to 9 °C in winter.' },
        { kind: 'deck', page: 2, date: '2017-06-08', text: 'Run-around coil system between exhaust and supply air of AHU 1 to 4 in the office building. Expected saving: 40 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2019-09-20', text: 'Achieved 37 t CO₂e per year. Frost protection of the exhaust coil needed a control change in the first winter.',
          L: L('Frost protection of the exhaust coil needed a control change in the first winter.', 'Is frost protection designed in?', 'Frost-protection concept in the design', 'Include a frost-protection concept for exhaust coils in the design.', 7) }
      ]
    },
    {
      n: 7, title: 'Clean-steam condensate heat for purified-water pre-heating', year: 2023, status: 'closed',
      tags: { utility: 'clean-steam condensate → purified water', scope: 'Scope 1', area: 'GMP clean-room area', equipment: 'heat exchanger', capex: '€50–250k' },
      promised: 70, achieved: 61, owner: 'wimmer',
      requal: { months: 3, ref: 1 },
      passages: [
        { kind: 'decision', gate: 'Review 1', date: '2022-09-22', text: 'SSC Review 1: go to deepening; QA to assess the impact of the new condensate line on the purified-water system.' },
        { kind: 'deck', page: 3, date: '2022-08-30', text: 'Use the heat of clean-steam condensate to pre-heat the feed of the purified-water generator. Expected saving: 70 t CO₂e per year.' },
        { kind: 'diary', gate: 'go-live', date: '2023-09-14', text: 'The new condensate line runs through the purified-water room. IQ/OQ repeated for the new route: about 3 months.',
          L: L('IQ/OQ had to be repeated for the new route, about 3 months.', 'Does the new line touch a qualified system?', 'QA impact assessment of qualified systems', 'QA assesses which qualified systems the new line touches.', 4) },
        { kind: 'diary', gate: 'closeout', date: '2024-10-08', text: 'Achieved 61 t CO₂e per year, 87 % of the promise.' }
      ]
    },
    {
      n: 8, title: 'Exhaust-air heat recovery in the clean-room AHUs', year: 2017, status: 'closed',
      tags: { utility: 'exhaust air → supply air', scope: 'Scope 1', area: 'GMP clean-room area', equipment: 'air-handling unit', capex: '€500k–1M' },
      promised: 130, achieved: 118, owner: 'moser',
      requal: { months: 5, ref: 1 },
      passages: [
        { kind: 'diary', gate: 'closeout', date: '2018-12-06', text: 'Achieved 118 t CO₂e per year, 91 % of the promise. Supply air is pre-heated by recovered exhaust heat from October to April.' },
        { kind: 'deck', page: 3, date: '2016-05-12', text: 'Run-around coils between exhaust and supply air of clean-room AHUs 7 and 8. Rotary wheels are excluded because of cross-contamination risk. Expected saving: 130 t CO₂e per year.' },
        { kind: 'deck', page: 7, date: '2016-05-12', text: 'Schedule. Requalification of AHU 7 and 8 after the change: about 5 months.',
          L: L('AHU requalification after the change took about 5 months.', 'Will the HVAC change need requalification?', 'QA requalification plan for GMP AHUs', 'QA prepares a requalification plan for the affected AHUs.', 4) }
      ]
    },
    {
      n: 9, title: 'Condensing economiser on steam boiler B1', year: 2020, status: 'closed',
      tags: { utility: 'boiler flue gas → feed water', scope: 'Scope 1', area: 'utilities building', equipment: 'boiler', capex: '€50–250k' },
      promised: 85, achieved: 80, owner: 'steiner',
      passages: [
        { kind: 'deck', page: 5, date: '2019-07-04', text: 'Design basis. Feed water is pre-heated from 60 to 90 °C with recovered flue-gas heat.' },
        { kind: 'deck', page: 3, date: '2019-07-04', text: 'A condensing economiser on steam boiler B1 pre-heats boiler feed water with flue-gas heat. Expected saving: 85 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2021-06-17', text: 'Achieved 80 t CO₂e per year. Acidic condensate in the flue gas required stainless steel; the first quote was carbon steel.',
          L: L('Acidic condensate required stainless steel; the first quote was carbon steel.', 'Is the material suitable for acidic condensate?', 'Material check for condensate corrosion', 'Check the exchanger material against acidic condensate.', 8) }
      ]
    },
    {
      n: 11, title: 'Freeze-dryer refrigeration heat for building heating', year: 2021, status: 'closed',
      tags: { utility: 'refrigeration heat → HVAC heating', scope: 'Scope 1', area: 'production building', equipment: 'heat exchanger', capex: '€250–500k' },
      promised: 75, achieved: 41, owner: 'fuchs',
      passages: [
        { kind: 'deck', page: 6, date: '2020-04-22', text: 'Design basis. 400 kW of desuperheater heat is available while the freeze-dryers run; the heating network takes it at 45 °C.' },
        { kind: 'deck', page: 4, date: '2020-04-22', text: 'Desuperheaters on the freeze-dryer refrigeration plant supply heat to the heating network of the production building. Expected saving: 75 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2022-09-28', text: 'Achieved 41 t CO₂e per year, 55 % of the promise. The freeze-dryers run in campaigns; between campaigns there is no heat.',
          L: L('Freeze-dryers run in campaigns; between campaigns there is no heat.', 'Does the heat source run all year?', 'Source operating profile over a full year', 'Document the operating profile of the heat source over a full year.', 5) }
      ]
    },
    {
      n: 14, title: 'Server-room heat for office heating', year: 2023, status: 'closed',
      tags: { utility: 'chilled water → HVAC heating', scope: 'Scope 1', area: 'office building', equipment: 'heat pump', capex: '< €50k' },
      promised: 25, achieved: 24, owner: 'huber',
      passages: [
        { kind: 'diary', gate: 'go-live', date: '2023-03-02', text: 'Commissioned in March 2023. The heat pump feeds the heating return of the office floors.' },
        { kind: 'deck', page: 4, date: '2022-10-06', text: 'Design basis. The heat pump raises the 28 °C cooling return to 45 °C for the office heating circuit.' },
        { kind: 'deck', page: 2, date: '2022-10-06', text: 'A small heat pump uses the return of the server-room cooling to heat the office floors. Expected saving: 25 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2024-11-21', text: 'Achieved 24 t CO₂e per year. Simple and reliable; IT must agree before any change to the server-room cooling.',
          L: L('IT must agree before any change to the source cooling.', 'Who else depends on the source system?', 'Agreement with the owner of the heat source', 'Agree operating rules with the owner of the heat source.', 9) }
      ]
    },
    {
      n: 18, title: 'Flash-steam recovery from the condensate tanks', year: 2019, status: 'closed',
      tags: { utility: 'steam condensate → feed water', scope: 'Scope 1', area: 'utilities building', equipment: 'heat exchanger', capex: '€50–250k' },
      promised: 55, achieved: 50, owner: 'steiner',
      passages: [
        { kind: 'diary', gate: 'go-live', date: '2019-10-10', text: 'Commissioned in October 2019. Flash-steam heat pre-heats the feed water from 45 to 85 °C.' },
        { kind: 'deck', page: 3, date: '2018-11-15', lang: 'de', text: 'Nutzung des Entspannungsdampfs aus den Kondensatbehältern zur Vorwärmung des Kesselspeisewassers. Erwartete Einsparung: 55 t CO₂e pro Jahr.' },
        { kind: 'diary', gate: 'closeout', date: '2020-12-03', text: 'Achieved 50 t CO₂e per year. Venting losses were higher than the energy audit had measured.',
          L: L('Venting losses were higher than the audit had measured.', 'Are the audit figures confirmed by measurement?', 'Confirm audit figures by measurement', 'Confirm the energy-audit figures with a measurement.', 6) }
      ]
    },
    {
      n: 23, title: 'Compressor waste heat for building 7 heating', year: 2024, status: 'live',
      tags: { utility: 'compressed air → HVAC heating', scope: 'Scope 1', area: 'production building', equipment: 'heat exchanger', capex: '€50–250k' },
      promised: 70, achieved: 52, owner: 'fuchs',
      passages: [
        { kind: 'diary', gate: 'closeout', date: '2025-06-26', text: 'First full heating season: 52 t CO₂e, 74 % of the promise. The recovered compressor heat covers the heating return of building 7 from October to April.' },
        { kind: 'deck', page: 2, date: '2023-09-07', lang: 'de', text: 'Abwärmenutzung der Druckluftkompressoren K4 bis K6 zur Heizungsunterstützung in Gebäude 7. Plattenwärmetauscher im Heizungsrücklauf, ausgelegt auf 240 kW. Erwartete Einsparung: 70 t CO₂e pro Jahr.' },
        { kind: 'diary', gate: 'go-live', date: '2024-10-17', lang: 'de', text: 'Inbetriebnahme im Oktober 2024. Im Sommer wird die Abwärme über den Notkühler abgeführt; Einsparungen nur in der Heizperiode.',
          L: L('In summer the heat goes to the dry cooler; savings only in the heating season.', 'Is there heat demand at the sink all year?', 'Winter and summer split of the savings', 'Split the expected savings into winter and summer.', 2) }
      ]
    },
    {
      n: 29, title: 'WFI cooling-loop heat for process hot water', year: 2020, status: 'closed',
      tags: { utility: 'process cooling → hot water', scope: 'Scope 1', area: 'production building', equipment: 'heat exchanger', capex: '€50–250k' },
      promised: 90, achieved: 72, owner: 'moser',
      passages: [
        { kind: 'deck', page: 5, date: '2019-06-27', text: 'Design basis. 400 kW of heat from the WFI cooling loop at 25 °C; the plate heat exchanger sits in the utility corridor.' },
        { kind: 'deck', page: 3, date: '2019-06-27', text: 'A heat exchanger on the WFI cooling-loop return pre-heats process hot water. The exchanger sits on the utility side, outside the classified area. Expected saving: 90 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2021-10-14', text: 'Achieved 72 t CO₂e per year, 80 % of the promise. Placing the exchanger outside the classified area avoided requalification.',
          L: L('Placing the exchanger outside the classified area avoided requalification.', 'Can the new equipment sit outside the classified area?', 'Place new equipment outside GMP areas', 'Place the exchanger on the utility side, outside GMP-classified areas.', 4) }
      ]
    },
    {
      n: 36, title: 'Autoclave condensate heat for washing water', year: 2016, status: 'closed',
      tags: { utility: 'steam condensate → hot water', scope: 'Scope 1', area: 'production building', equipment: 'heat exchanger', capex: '< €50k' },
      promised: 18, achieved: 17, owner: 'fuchs',
      passages: [
        { kind: 'diary', gate: 'closeout', date: '2017-05-11', text: 'Achieved 17 t CO₂e per year. The recovered heat pre-heats washing water for the parts washers.' },
        { kind: 'deck', page: 2, date: '2015-10-01', text: 'Heat recovery from autoclave condensate pre-heats washing water in building 3. Expected saving: 18 t CO₂e per year.' },
        { kind: 'deck', page: 4, date: '2015-10-01', text: 'Lessons from the pilot. The condensate cooler needed a bypass for sterilisation cycles.',
          L: L('The condensate cooler needed a bypass for sterilisation cycles.', 'Does the process need a bypass for special cycles?', 'Bypass for sterilisation cycles', 'Design a bypass so sterilisation cycles are not affected.', 9) }
      ]
    },
    {
      n: 44, title: 'Glycol return heat pump for warehouse floor heating', year: 2025, status: 'in implementation',
      tags: { utility: 'chilled water → HVAC heating', scope: 'Scope 1', area: 'warehouse', equipment: 'heat pump', capex: '€250–500k' },
      promised: 45, achieved: null, owner: 'bauer',
      passages: [
        { kind: 'decision', gate: 'Review 1', date: '2024-10-17', text: 'SSC Review 1: go to deepening; confirm the heating demand of the warehouse floor in spring and autumn.' },
        { kind: 'deck', page: 5, date: '2025-01-23', text: 'Design basis. A 150 kW heat pump uses the 12 °C glycol return; the floor heating runs at 30 °C.' },
        { kind: 'deck', page: 3, date: '2025-01-23', text: 'A heat pump uses the glycol chilled-water return to heat the warehouse floor. Expected saving: 45 t CO₂e per year.' },
        { kind: 'decision', gate: 'Review 2', date: '2025-04-10', text: 'SSC Review 2: investment approved. Commissioning planned for spring 2026.' }
      ]
    },
    {
      n: 52, title: 'Exhaust-air heat recovery in the QC laboratory', year: 2018, status: 'closed',
      tags: { utility: 'exhaust air → supply air', scope: 'Scope 1', area: 'QC laboratory', equipment: 'air-handling unit', capex: '€250–500k' },
      promised: 65, achieved: 39, owner: 'schmid',
      passages: [
        { kind: 'deck', page: 5, date: '2017-03-16', text: 'Design basis. 18,000 m³/h of laboratory exhaust air through a run-around coil that pre-heats supply air.' },
        { kind: 'deck', page: 3, date: '2017-03-16', text: 'Heat recovery from the exhaust air of the QC laboratory pre-heats supply air. Expected saving: 65 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2019-12-05', text: 'Achieved 39 t CO₂e per year, 60 % of the promise. Fume-hood exhaust could not be connected for safety reasons, so only 60 % of the airflow was usable.',
          L: L('Fume-hood exhaust could not be connected; only 60 % of the airflow was usable.', 'Which exhaust streams may be connected?', 'HSE check of the exhaust streams', 'HSE confirms which exhaust streams may be connected.', 7) }
      ]
    },
    {
      n: 61, title: 'Desuperheater on chiller K7 for canteen hot water', year: 2021, status: 'closed',
      tags: { utility: 'chilled water → hot water', scope: 'Scope 1', area: 'office building', equipment: 'chiller', capex: '< €50k' },
      promised: 30, achieved: 29, owner: 'bauer',
      passages: [
        { kind: 'diary', gate: 'go-live', date: '2021-05-06', text: 'Commissioned in May 2021. The desuperheater supplies about 40 kW of heat to the hot-water tank.' },
        { kind: 'deck', page: 3, date: '2020-09-17', text: 'A desuperheater on chiller K7 heats domestic hot water for the canteen and the changing rooms. Expected saving: 30 t CO₂e per year.' },
        { kind: 'diary', gate: 'closeout', date: '2022-11-10', text: 'Achieved 29 t CO₂e per year. Legionella rules required the hot-water tank to stay at 60 °C; a booster heater was added.',
          L: L('Legionella rules required 60 °C in the tank; a booster heater was added.', 'Do hygiene rules set a minimum temperature?', 'Hygiene check of the hot-water temperature', 'Check hygiene rules for the minimum hot-water temperature.', 8) }
      ]
    },
    {
      n: 77, title: 'Boiler blowdown heat for make-up water', year: 2024, status: 'live',
      tags: { utility: 'boiler flue gas → feed water', scope: 'Scope 1', area: 'utilities building', equipment: 'boiler', capex: '< €50k' },
      promised: 22, achieved: 21, owner: 'steiner',
      passages: [
        { kind: 'diary', gate: 'closeout', date: '2025-09-18', text: 'Achieved 21 t CO₂e per year. The blowdown heat exchanger needed no extra maintenance.' },
        { kind: 'deck', page: 2, date: '2023-11-30', text: 'Heat from the steam-boiler blowdown pre-heats boiler make-up water. Expected saving: 22 t CO₂e per year.' }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Generated archive: other technology classes                         */
  /* ------------------------------------------------------------------ */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var T = {
    'heat pump': {
      utility: ['heating hot water'], scope: ['Scope 1'], equipment: ['heat pump'],
      area: ['office building', 'warehouse', 'production building'], capex: ['€250–500k', '€500k–1M', '> €1M'],
      p: [60, 260], ratio: [0.6, 1.0], owners: ['leitner', 'huber', 'bauer'],
      titles: ['Air-source heat pump for the {area} heating', 'Heat pump replacing the gas boiler in building {b}', 'Hybrid heat pump for building {b}', 'Ground-source heat pump for building {b}'],
      business: 'Replace the gas heating of building {b} with a {kw} kW heat pump. Expected saving: {p} t CO₂e per year at an average COP of {cop}.',
      businessDe: 'Ersatz der Gasheizung in Gebäude {b} durch eine Wärmepumpe mit {kw} kW. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('The existing radiators needed 70 °C supply temperature, so the COP stayed below plan.', 'Does the heating system work at low supply temperatures?', 'Check supply temperature of the heating system', 'Check whether the heating system works at 55 °C or less.'),
        L('The grid connection upgrade added six months to the schedule.', 'Is the electrical connection sized for the heat pump?', 'Electrical capacity check', 'Confirm the electrical capacity with the grid operator.'),
        L('Noise limits at the site boundary required an acoustic enclosure.', 'Do noise limits apply at the installation point?', 'Noise assessment at the site boundary', 'Assess noise at the site boundary before choosing the location.')
      ]
    },
    'chiller optimisation': {
      utility: ['chilled water'], scope: ['Scope 2'], equipment: ['chiller'],
      area: ['utilities building', 'production building'], capex: ['€50–250k', '€250–500k', '€500k–1M'],
      p: [30, 180], ratio: [0.65, 1.05], owners: ['berger', 'novak', 'steiner'],
      titles: ['Free cooling for chilled water in winter', 'Chiller sequencing optimisation in building {b}', 'Raising the chilled-water set-point to {t} °C', 'Replacement of chiller K{k} with a high-efficiency unit'],
      business: 'Reduce the electricity use of the chilled-water plant in building {b}. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Senkung des Stromverbrauchs der Kälteerzeugung in Gebäude {b}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Raising the set-point needed QA approval for two cold rooms.', 'Which GMP rooms depend on the chilled-water temperature?', 'QA review of temperature-sensitive rooms', 'QA lists the rooms that depend on the chilled-water temperature.'),
        L('Free-cooling hours were 20 % fewer than the weather data suggested.', 'Are the free-cooling hours based on local data?', 'Validate free-cooling hours with site data', 'Validate free-cooling hours with measured site temperatures.'),
        L('A BMS update overwrote the sequencing logic within a year.', 'Is the new control logic protected against BMS updates?', 'Change control for BMS logic', 'Put the new control logic under change control.')
      ]
    },
    'HVAC airflow & controls': {
      utility: ['ventilation air'], scope: ['Scope 1+2'], equipment: ['air-handling unit', 'building management system'],
      area: ['office building', 'warehouse', 'GMP clean-room area', 'QC laboratory'], capex: ['< €50k', '€50–250k', '€250–500k'],
      p: [20, 140], ratio: [0.6, 1.0], owners: ['huber', 'moser', 'schmid'],
      titles: ['Night set-back of air-change rates in the {area}', 'Demand-controlled ventilation in the {area}', 'EC fans for AHU {k}', 'Occupancy-based HVAC schedules in the {area}'],
      business: 'Reduce fan and heating energy of the {area} ventilation. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Reduktion der Ventilator- und Heizenergie der Lüftung im Bereich {area}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Reduced air changes in the GMP area required requalification of about {m} months.', 'Will the airflow change need requalification?', 'QA requalification plan for airflow changes', 'QA prepares a requalification plan for the airflow change.', null, true),
        L('The night set-back needed a pressure-cascade check by QA.', 'Is the room pressure cascade kept at all times?', 'Pressure-cascade check by QA', 'QA checks the pressure cascade in set-back mode.'),
        L('Users overrode the schedules within weeks; the set-points were locked.', 'Can users override the new schedules?', 'Lock set-points against overrides', 'Lock the set-points and agree an override process.')
      ]
    },
    'steam & condensate': {
      utility: ['steam'], scope: ['Scope 1'], equipment: ['steam traps', 'boiler'],
      area: ['utilities building', 'production building', 'site-wide'], capex: ['< €50k', '€50–250k'],
      p: [15, 120], ratio: [0.55, 1.0], owners: ['steiner', 'berger'],
      titles: ['Steam-trap survey and replacement in building {b}', 'Condensate return from building {b}', 'Insulation of steam valves and flanges', 'Steam pressure reduction from {x} to {y} bar'],
      business: 'Reduce steam losses in building {b}. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Reduktion der Dampfverluste in Gebäude {b}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('A third of the replaced traps failed again within two years; a yearly survey was added.', 'Is a yearly survey planned after the replacement?', 'Yearly steam-trap survey', 'Plan a yearly steam-trap survey after the replacement.'),
        L('Returned condensate was contaminated; conductivity monitoring was added.', 'Can returned condensate be contaminated?', 'Conductivity monitoring of condensate', 'Add conductivity monitoring before condensate returns to the boiler.')
      ]
    },
    'compressed air': {
      utility: ['compressed air'], scope: ['Scope 2'], equipment: ['compressor'],
      area: ['utilities building', 'production building', 'site-wide'], capex: ['< €50k', '€50–250k', '€250–500k'],
      p: [10, 90], ratio: [0.5, 1.0], owners: ['steiner', 'leitner'],
      titles: ['Compressed-air leak programme in building {b}', 'Pressure reduction of the compressed-air network', 'Variable-speed compressor K{k}', 'Compressor control system for building {b}'],
      business: 'Cut the electricity use of compressed air in building {b}. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Leckageortung und Druckabsenkung im Druckluftnetz von Gebäude {b}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Leaks came back within a year; the programme only worked with quarterly surveys.', 'Is a regular leak survey planned?', 'Quarterly leak survey', 'Plan a quarterly leak survey after the first campaign.'),
        L('Two machines needed 7 bar, so pressure was lowered locally instead of site-wide.', 'Which consumers need the highest pressure?', 'List pressure needs per consumer', 'List the pressure needs of every consumer before lowering the pressure.')
      ]
    },
    'LED lighting': {
      utility: ['electricity'], scope: ['Scope 2'], equipment: ['LED luminaires'],
      area: ['warehouse', 'office building', 'production building', 'outdoor / parking'], capex: ['< €50k', '€50–250k'],
      p: [8, 70], ratio: [0.75, 1.1], owners: ['huber', 'bauer'],
      titles: ['LED retrofit in the {area}', 'LED and presence sensors in the {area}', 'LED high-bay lighting in building {b}'],
      business: 'Replace fluorescent lighting in the {area} with LED luminaires. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Umrüstung der Beleuchtung im Bereich {area} auf LED. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Luminaires in GMP areas needed cleanable housings; the first offer did not qualify.', 'Do the luminaires meet GMP cleaning requirements?', 'GMP suitability of luminaires', 'Confirm the luminaires meet GMP cleaning requirements.'),
        L('Presence sensors switched off lights in low-traffic aisles too early; timers were adjusted.', 'Are sensor timers set for low-traffic zones?', 'Sensor timer settings per zone', 'Set sensor timers per zone with the users.')
      ]
    },
    'solar PV': {
      utility: ['electricity'], scope: ['Scope 2'], equipment: ['PV modules'],
      area: ['outdoor / parking', 'warehouse', 'office building'], capex: ['€250–500k', '€500k–1M', '> €1M'],
      p: [40, 300], ratio: [0.8, 1.05], owners: ['leitner', 'bauer'],
      titles: ['PV on the roof of building {b}', 'PV carport on the parking deck', 'Façade PV on building {b}'],
      business: 'Install {kw} kWp of PV on building {b}. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Photovoltaikanlage mit {kw} kWp auf Gebäude {b}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Roof statics allowed only 60 % of the planned module area.', 'Has the roof statics been checked?', 'Structural check of the roof', 'Have a structural engineer check the roof load first.'),
        L('Fire-brigade access rules changed the module layout.', 'Do fire-brigade access rules affect the layout?', 'Fire-brigade access review', 'Review the layout with the fire brigade early.')
      ]
    },
    'water reuse': {
      utility: ['purified water / WFI'], scope: ['Scope 1+2'], equipment: ['RO / distillation unit'],
      area: ['GMP clean-room area', 'utilities building', 'production building'], capex: ['€50–250k', '€250–500k'],
      p: [5, 60], ratio: [0.6, 1.0], owners: ['wimmer', 'novak', 'eder'],
      titles: ['Reuse of RO reject water for the cooling towers', 'WFI loop temperature optimisation', 'Recovery of purified-water sanitisation water', 'CIP rinse-water reuse in building {b}'],
      business: 'Reduce water and energy use of the purified-water system in building {b}. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Reduktion des Wasser- und Energieverbrauchs der Reinstwasseranlage in Gebäude {b}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Changing the WFI loop required requalification of about {m} months.', 'Does the change touch a qualified water system?', 'QA requalification plan for the water system', 'QA prepares a requalification plan for the water system.', null, true),
        L('Reused water quality varied; a conductivity check was added.', 'Is the quality of the reused water monitored?', 'Quality monitoring of reused water', 'Add online quality monitoring of the reused water.')
      ]
    },
    'solvent & waste recovery': {
      utility: ['solvent streams'], scope: ['Scope 3'], equipment: ['solvent recovery unit'],
      area: ['production building', 'QC laboratory'], capex: ['€250–500k', '€500k–1M'],
      p: [20, 160], ratio: [0.5, 0.95], owners: ['fuchs', 'gruber', 'schmid'],
      titles: ['Solvent recovery by distillation in building {b}', 'Segregation of non-hazardous waste in the {area}', 'Recycling of laboratory solvents'],
      business: 'Recover solvents and reduce waste incineration in building {b}. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Rückgewinnung von Lösungsmitteln und weniger Abfallverbrennung in Gebäude {b}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Recovered solvent needed a regulatory change before reuse in the process.', 'Does reuse need a regulatory change?', 'Regulatory assessment of solvent reuse', 'Regulatory Affairs assesses whether reuse needs a variation.'),
        L('Waste segregation only worked after training on every shift.', 'Is training planned for every shift?', 'Training on every shift', 'Train every shift before the start.')
      ]
    },
    'insulation & envelope': {
      utility: ['heating hot water'], scope: ['Scope 1'], equipment: ['insulation'],
      area: ['warehouse', 'office building', 'utilities building'], capex: ['€50–250k', '€250–500k'],
      p: [10, 90], ratio: [0.7, 1.05], owners: ['huber', 'bauer'],
      titles: ['Roof insulation of the {area}', 'Window replacement in building {b}', 'Insulation of the heating distribution in the {area}', 'Rapid-roll doors for the {area}'],
      business: 'Reduce heat losses of the {area}. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Reduktion der Wärmeverluste im Bereich {area}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Asbestos was found in the old roof, which added three months.', 'Has a hazardous-material survey been done?', 'Hazardous-material survey', 'Survey the building for hazardous materials first.'),
        L('Doors were left open during loading, so the saving was lower than planned.', 'Will users change how doors are operated?', 'Agree operating rules with users', 'Agree door operating rules with the warehouse team.')
      ]
    },
    'refrigerant replacement': {
      utility: ['refrigerant circuit'], scope: ['Scope 1'], equipment: ['chiller'],
      area: ['utilities building', 'production building', 'QC laboratory'], capex: ['€50–250k', '€250–500k', '€500k–1M'],
      p: [15, 120], ratio: [0.7, 1.0], owners: ['novak', 'berger', 'eder'],
      titles: ['Replacement of R404A in cold rooms', 'Low-GWP refrigerant for chiller K{k}', 'Leak detection on refrigeration circuits in building {b}'],
      business: 'Replace high-GWP refrigerant in building {b}. Expected saving: {p} t CO₂e per year.',
      businessDe: 'Ersatz von Kältemittel mit hohem GWP in Gebäude {b}. Erwartete Einsparung: {p} t CO₂e pro Jahr.',
      lessons: [
        L('Cold rooms with GMP material needed new temperature mapping after the change.', 'Do GMP rooms need temperature mapping afterwards?', 'Temperature mapping plan', 'Plan temperature mapping for GMP cold rooms.'),
        L('Spare parts for the old refrigerant became scarce, which set the deadline.', 'When do spare parts for the old system run out?', 'Spare-part availability check', 'Check spare-part availability for the old system.')
      ]
    }
  };

  function fill(s, v) {
    return s.replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ''; });
  }
  function idFor(n) {
    var s = String(n);
    return '10' + 'xxxxx'.slice(0, 5 - s.length) + s;
  }
  SD.idFor = idFor;

  function generate() {
    var rng = mulberry32(20261117);
    var pick = function (a) { return a[Math.floor(rng() * a.length)]; };
    var used = {};
    HR.forEach(function (p) { used[p.n] = true; });
    var classes = Object.keys(T);
    var out = [];
    var ci = 0;
    for (var n = 1; n <= 142; n++) {
      if (used[n]) continue;
      var cls = classes[ci % classes.length]; ci++;
      var t = T[cls];
      var year = 2015 + Math.floor(rng() * 11);
      var area = pick(t.area);
      var v = {
        b: 1 + Math.floor(rng() * 12), k: 1 + Math.floor(rng() * 9), area: area,
        t: 8 + Math.floor(rng() * 4), x: 10, y: 7, kw: 50 * (2 + Math.floor(rng() * 10)),
        cop: (2.8 + rng() * 1.4).toFixed(1), m: 2 + Math.floor(rng() * 4)
      };
      var promised = Math.round(t.p[0] + rng() * (t.p[1] - t.p[0]));
      v.p = promised;
      var status = year <= 2023 ? 'closed' : year === 2024 ? 'live' : 'in implementation';
      var achieved = null;
      if (status !== 'in implementation' && !(year < 2019 && rng() < 0.35)) {
        achieved = Math.round(promised * (t.ratio[0] + rng() * (t.ratio[1] - t.ratio[0])));
      }
      var lesson = pick(t.lessons);
      if (lesson.requalOnly && area !== 'GMP clean-room area' && cls === 'HVAC airflow & controls') {
        lesson = t.lessons[1];
      }
      var ls = {
        lesson: fill(lesson.lesson, v), question: lesson.question,
        condition: { short: lesson.condition.short, long: lesson.condition.long, priority: 9 }
      };
      var rec = {
        n: n, title: fill(pick(t.titles), v), year: year, status: status, technology: cls,
        tags: { utility: pick(t.utility), scope: pick(t.scope), area: area, equipment: pick(t.equipment), capex: pick(t.capex) },
        promised: promised, achieved: achieved, owner: pick(t.owners), passages: []
      };
      if (lesson.requalOnly) rec.requal = { months: v.m, ref: 1 };
      var de = rng() < 0.22;
      var dy = String(year - 1);
      var mm = String(1 + Math.floor(rng() * 12)); if (mm.length < 2) mm = '0' + mm;
      rec.passages.push({ kind: 'deck', page: 2, date: dy + '-' + mm + '-12', lang: de ? 'de' : undefined, text: fill(de ? t.businessDe : t.business, v) });
      if (achieved != null && rng() < 0.55) {
        var pct = Math.round((achieved / promised) * 100);
        rec.passages.push({ kind: 'diary', gate: 'closeout', date: (year + 1) + '-' + mm + '-20', text: 'Achieved ' + achieved + ' t CO₂e per year, ' + pct + ' % of the promise. ' + ls.lesson, L: ls });
      } else {
        rec.passages.push({ kind: 'deck', page: 5 + Math.floor(rng() * 5), date: dy + '-' + mm + '-12', text: 'Risks and lessons. ' + ls.lesson, L: ls });
      }
      if (rng() < 0.3) {
        rec.passages.push({ kind: 'decision', gate: 'Review 1', date: dy + '-' + mm + '-28', text: 'SSC Review 1: go to deepening as proposed.' });
      }
      out.push(rec);
    }
    return out;
  }

  function finalize(rec) {
    var id = idFor(rec.n);
    var tags = Object.assign({ technology: rec.technology || 'heat recovery' }, rec.tags);
    return {
      id: id, n: rec.n, title: rec.title, year: rec.year, status: rec.status, tags: tags,
      promised: rec.promised, achieved: rec.achieved, owner: SD.PEOPLE[rec.owner] || null,
      requal: rec.requal || null, shortLesson: rec.shortLesson || null,
      passages: rec.passages.map(function (p, i) {
        return {
          id: id + ':' + (p.kind === 'deck' ? 'p' + p.page : p.kind === 'diary' ? 'd-' + p.gate : 'dec' + i),
          kind: p.kind, page: p.page || null, gate: p.gate || null, date: p.date || null,
          lang: p.lang || 'en', text: p.text, supports: !!p.supports, L: p.L || null
        };
      })
    };
  }

  SD.PROJECTS = HR.concat(generate()).map(finalize).sort(function (a, b) { return a.n - b.n; });

  /* ------------------------------------------------------------------ */
  /* New projects that exist in SPOT but not yet in the archive          */
  /* ------------------------------------------------------------------ */
  SD.NEW_PROJECTS = {
    '10xxxxx': {
      spotId: '10xxxxx', label: 'Worked example',
      title: 'Heat recovery from the process-cooling return for HVAC pre-heating',
      description: 'Recover about 30 °C heat from the process-cooling return with a plate heat exchanger and feed it into the HVAC pre-heating coil of the utilities building. Expected CO₂ reduction: see SPOT.',
      spot: { co2: 180, capex: '€250–500k', area: 'Utilities building', energy: '≈ 900 MWh natural gas per year' },
      contact: 'lh', meeting: '2026-11-26', minutes: 20, stars: 4, attachment: 'Approval deck (draft).pptx'
    },
    '10xx150': {
      spotId: '10xx150', label: 'Next project (the loop)',
      title: 'Heat recovery from the WFI cooling return for AHU pre-heating',
      description: 'Use the 25 °C return of the WFI cooling loop to pre-heat outside air in AHU 5 of the production building with a plate heat exchanger.',
      spot: { co2: 120, capex: '€250–500k', area: 'Production building', energy: '≈ 600 MWh natural gas per year' },
      contact: 'aw', meeting: '2027-01-14', minutes: 15, stars: 3, attachment: 'Approval deck (draft).pptx'
    },
    '10xx151': {
      spotId: '10xx151', label: 'Different domain',
      title: 'LED retrofit in the warehouse high-bay area',
      description: 'Replace 240 metal-halide high-bay luminaires in the warehouse with LED luminaires and presence sensors.',
      spot: { co2: 45, capex: '€50–250k', area: 'Warehouse', energy: '≈ 310 MWh electricity per year' },
      contact: 'th', meeting: '2026-12-10', minutes: 10, stars: 4, attachment: 'Approval deck (draft).pptx'
    }
  };

  /* ------------------------------------------------------------------ */
  /* Presenter script: the nine lines from the cue card                  */
  /* ------------------------------------------------------------------ */
  SD.SCENES = [
    { id: 'opening', name: 'Opening', label: 'CONCEPT DEMO · TAKEDA VIENNA · SSC PROJECT REVIEW', headline: 'Every new SSC project starts from what Takeda has already learned',
      say: 'This is Smart Diary, inside the SSC App. One project, from input to decision.' },
    { id: 'input', name: 'Input', step: 1, label: 'STEP 1 · PROJECT IDEA · SSC APP V2.0', headline: 'The PM creates the project in the SSC App, as today',
      say: 'The project manager creates the project exactly as today: SPOT ID, lookup, title, description, meeting date, self-rating. Nothing new to type. Smart Diary only reads these fields and the SPOT figures.' },
    { id: 'tags', name: 'Six tags', step: 1, label: 'STEP 1 · WHAT IS NEW: ONE STRIP', headline: 'Smart Diary suggests six tags. The PM confirms them in about 30 seconds',
      say: 'This strip is the only new element. Smart Diary suggests six tags, and the project manager confirms them with one click.',
      callout: { title: 'Why tags matter', text: 'They let a small archive be searched by technology, utility and equipment, not by word overlap.' } },
    { id: 'search', name: 'Search', step: 2, label: 'STEP 1 · COMPARE · THE NEXT TEN SECONDS', headline: 'Smart Diary searches only Takeda’s own records',
      say: 'Now it searches only Takeda’s own records: filter by tags, search, re-rank, drop weak matches. A sentence without a source is deleted. No step decides. People judge.',
      callout: { title: 'No step decides', text: 'Retrieval finds, the model summarises with sources, people judge.' } },
    { id: 'brief', name: 'Reference brief', step: 2, label: 'STEP 2 · SSC REVIEW 1 PRE-READ · COMPARE', headline: 'The reference brief the PM and the SSC both see',
      say: 'This is the result: the reference brief. Three comparable projects, with promised versus achieved and one lesson each. Every line has a source, down to the page. One click cites it. And it says honestly when nothing fits.' },
    { id: 'ask', name: 'Ask', step: 3, label: 'STEP 3 · DEEPENING · ASK', headline: 'Questions in plain language, answered only from Takeda records',
      say: 'Next is Ask. A question in plain language: which heat-recovery projects needed requalification, and how long did it take? The answer comes only from Takeda’s records: two projects, three to four months, each with its source. The count comes from SPOT.',
      callout: { title: 'No source, no sentence', text: 'Uncited sentences are deleted. If nothing passes the similarity floor, the panel says “not found”.' } },
    { id: 'decide', name: 'SSC decision', step: 4, label: 'STEP 2 · SSC REVIEW 1 · THURSDAY 14:35', headline: 'The SSC decides on precedent, not on a star rating',
      say: 'Thursday, 14:35. The SSC decides: go to deepening, with three conditions taken from the lessons.' },
    { id: 'write', name: 'Write', step: 5, label: 'STEP 5 · WRITE · DIARY ENTRY 1', headline: 'AI drafts the entry from what is already written. The PM confirms',
      say: 'This decision becomes diary entry one. The AI drafts it from what is already written. The project manager confirms it, and tomorrow it is searchable.' },
    { id: 'loop', name: 'The loop', step: 6, label: 'STEP 6 · LESSONS LEARNED → NEXT PROJECT', headline: 'Step 6 feeds Step 1: the reuse loop Takeda defined, now closed',
      say: 'And here the loop closes. Step six, lessons learned, feeds step one of the next project. Takeda defined it. Smart Diary closes it.' },
    { id: 'close', name: 'Close', label: 'TODAY’S DECISION', headline: 'Approve Phase 0 of Smart Diary',
      say: 'That was one project, from the form to the decision. Now we look at the output once more.' }
  ];

  SD.ASK_SUGGESTIONS = [
    'Which heat-recovery projects since 2019 needed requalification, and how long did it take?',
    'Which heat-recovery projects achieved less than 70 % of their promise?',
    'Whom should I call about heat exchangers in the utilities building?',
    'What went wrong with seasonal heat demand?',
    'Did any project use hydrogen?'
  ];

  /* Gate B check: a small demo test set (the pilot uses 50 questions) */
  SD.GATE_B_TESTS = [
    { q: 'Which heat-recovery projects since 2019 needed requalification, and how long did it take?', expect: ['10xxxx3', '10xxxx7'] },
    { q: 'Which heat-recovery projects achieved less than 70 % of their promise?', expect: ['10xxxx1', '10xxxx5', '10xxx11', '10xxx52'] },
    { q: 'What went wrong with seasonal heat demand?', expect: ['10xxxx1', '10xxx23', '10xxx11'] },
    { q: 'Whom should I call about fouling of the waste-water heat exchanger?', expect: ['10xxxx5'] },
    { q: 'Did a flue-gas economiser need special materials?', expect: ['10xxxx9'] },
    { q: 'Abwärmenutzung der Druckluftkompressoren', expect: ['10xxx23', '10xxxx4', '10xxxx3'] },
    { q: 'Frost problems with run-around coils?', expect: ['10xxxx6'] },
    { q: 'Why was a plate pack removed on the cooling-water return exchanger?', expect: ['10xxxx2'] },
    { q: 'Which exhaust streams could not be connected in the laboratory?', expect: ['10xxx52'] },
    { q: 'Did any project use hydrogen?', expect: 'notfound' },
    { q: 'Has the site ever built a wind turbine?', expect: 'notfound' },
    { q: 'What did the cafeteria dishwasher replacement cost?', expect: 'notfound' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
