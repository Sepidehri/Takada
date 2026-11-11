# Smart Diary · working demo

**Group 3 · Final pitch · Topic 2: AI, knowledge management and change management**

Smart Diary is a panel inside the SSC App. For each new SSC project it shows the most comparable past projects, their lessons and their sources before Review 1 (**Compare**). It answers questions only from Takeda's records (**Ask**). It drafts a short diary entry at the gates that already exist (**Write**). This repository holds a working version you can present live instead of the demo video.

> **Illustrative data.** Every project, SPOT ID, person and figure in this demo is invented to show the format. The form fields follow SSC App v2.0.

---

## Four ways to run it

| | How | Generation step | Needs |
|---|---|---|---|
| **Link** | Open the published claude.ai link in any browser, signed in to claude.ai | **Claude** on your claude.ai account (allow it once when the page asks) | Internet, a claude.ai login |
| **A · Double-click** | Open `dist/smart-diary.html` in Chrome or Edge | Offline writer (extractive, no model) | Nothing: no install, no internet |
| **B · Local server** | `npm install`, then `npm start`, then open http://localhost:3000 | Offline writer | Node.js 20.12 or newer |
| **C · Local server + Claude** | As B, with an API key in `.env` | **Claude** writes from the retrieved passages, with citations | Node.js, internet, an Anthropic API key |

### C · With Claude (real RAG end to end)

```bash
npm install
```

```bash
cp .env.example .env
```

Open `.env` and set `ANTHROPIC_API_KEY=...`. The file is git-ignored and is never committed.

```bash
npm start
```

The terminal prints `Generation: Claude (claude-opus-5-5, effort low)`. The footer of the app shows a green dot: **RAG · Claude claude-opus-5-5**.

Optional settings in `.env`:

- `SMART_DIARY_MODEL` (default `claude-opus-5-5`)
- `SMART_DIARY_EFFORT` (default `low`: fastest for a live pitch; `medium` or `high` gives richer text)
- `PORT` (default `3000`)

**If the network fails during the pitch**, nothing breaks. Every call falls back to the offline writer, and the screen says so ("Claude unavailable"). The retrieval, the numbers and the citations are the same in both modes. Keep option A open in a second tab as a backup.

---

## Presenting

Click **Concept demo** (top right), or **Start the guided demo** on the main page. The app then runs one scene per key press, in the order of your demo video.

| Key | What it does |
|---|---|
| `→`, `Space`, `PageDown` (most clickers) | Next scene. Pressing it while a scene is still animating finishes that scene at once |
| `←`, `PageUp` | Previous scene |
| `N` | Shows or hides your line from the cue card (bottom right) |
| `F` | Full screen |
| `Esc` | Closes a window or a source |

| # | Scene | What happens on screen | Your line (cue card) |
|---|---|---|---|
| 1 | Opening | Title screen; the search box fills in | This is Smart Diary, inside the SSC App. One project, from input to decision. |
| 2 | Input | The SSC form fills in: SPOT ID, lookup, title, description, date, stars | The project manager creates the project exactly as today … |
| 3 | Six tags | The red strip suggests six tags; they tick and are confirmed | This strip is the only new element … |
| 4 | Search | The six-step pipeline runs with real numbers: 142 → 19 → 60 → 5 scored → 3 shown | Now it searches only Takeda's own records … |
| 5 | Reference brief | Three references; deck p. 6 opens with the sentence highlighted; two are cited | This is the result: the reference brief … |
| 6 | Ask | The question is typed; the answer has two sources plus the SPOT query | Next is Ask … |
| 7 | SSC decision | The decision window opens; three conditions are ticked | Thursday, 14:35. The SSC decides … |
| 8 | Write | Diary entry 1 is drafted and confirmed | This decision becomes diary entry one … |
| 9 | The loop | Six steps, red arrow from step 6 to step 1 | And here the loop closes … |
| 10 | Close | "Approve Phase 0 of Smart Diary" | That was one project, from the form to the decision … |

Before the pitch, run through it once with your laptop and the projector. With Claude connected, the first run calls the API. Going back and forth afterwards reuses the answers, so it is instant. **Reset demo data** on the main page starts clean.

### Good moments for questions

- **"Is this real or a mock-up?"** In the search scene, click any of the six steps to see what it did: the 19 candidates, the passage scores, the re-rank against the floor.
- **"Where does this sentence come from?"** Click any source chip (SPOT, DECK P. 6, DIARY · CLOSEOUT). The page opens with the cited sentence highlighted.
- **"What if nothing fits?"** In Ask, type `Did any project use hydrogen?` to get an honest **not found**.
- **"German documents?"** In Ask, type `Abwärmenutzung der Druckluftkompressoren`.
- **"Does the loop really close?"** On the loop screen, click *Run tonight's index now*, then *Start the next project*. The next project's brief cites the diary entry you just confirmed.
- **"How do you know it is good?"** **PILOT → Run the Gate B demo check** runs the test questions and scores relevance, wrong citations and "not found".
- **"Who saw what?"** **RECORDS → Audit log** lists every brief, answer, decision and entry.

---

## What is real in this demo

| Part | In this demo |
|---|---|
| Archive | 142 invented projects, 498 passages: SPOT records, approval-deck pages, SSC decisions, diary entries; some in German |
| Tags | Rule-based tagger over a controlled vocabulary. With Claude: Claude picks the six tags, constrained to the vocabulary by a JSON schema |
| 1 Build the query | Title and description of the form; tags and SPOT figures |
| 2 Filter by tags | Same technology class or same utility |
| 3 Hybrid search | BM25 keyword score, normalised, plus cosine similarity of bilingual concept vectors (½ + ½) |
| 4 Re-rank, floor | Top 5 re-ranked: 0.55 × tag match + 0.45 × text match; floor 0.70 |
| 5 Write | **Claude** gets the passages as `search_result` blocks with citations enabled and writes only from them. Without a key, an extractive writer does it |
| Citation check | Every sentence must carry a citation; a sentence without one is deleted and shown struck through |
| Counts | Counting questions are answered with a query on SPOT fields; the model only phrases the result |
| 6 Log | Every action is written to the audit log |
| Overnight index | A button stands in for the nightly job |

Nothing is advice: the brief retrieves and cites, people decide.

---

## Project layout

```
index.html            entry page (used by the server)
css/app.css           styles
js/data.js            the invented archive, vocabulary and presenter script
js/engine.js          RAG engine shared by browser and server: tags, retrieval,
                      prompts, offline writer, citation check
js/app.js             the application and presenter mode
server/server.mjs     Node server: serves the app, calls Claude
scripts/build.mjs     builds dist/smart-diary.html (one file, works offline)
test/engine.test.js   tests for the engine (npm test)
```

```bash
npm test
```

```bash
npm run build
```

Run `npm run build` after changing anything in `js/` or `css/`, so `dist/smart-diary.html` (double-click file) and `dist/smart-diary.artifact.html` (the published claude.ai page) stay in step.

In the published claude.ai page, Claude gets the retrieved passages numbered `[S1]`, `[S2]` … and must end every sentence with the numbers of its sources. Those numbers become the citations, and the same check deletes any sentence without one. Open the footer button (**RAG · …**) to switch between *Quick* (best for a live pitch) and *Balanced*, and to allow Claude once before you present.

---

*Concept demo with illustrative data. All projects, project numbers, people and figures are invented. Internal material for the Takeda pitch.*
