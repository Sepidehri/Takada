# Presenter guide · Smart Diary live demo

How to present the working prototype instead of the demo video, what to say in each scene, and how to answer "how did you build it?".

---

## Part 1 · Presenting the demo

### Before the pitch (10 minutes)

1. On the presentation laptop, open the published link in Chrome or Edge while signed in to claude.ai. The footer must show **RAG · Claude in claude.ai** with a green dot.
2. Click that footer button, then **Allow Claude now**. Do this once, so no permission window appears in front of the audience.
3. Run the whole demo once. Then go to the main page and click **Reset demo data** twice (the second click confirms).
4. Press **F** for full screen and click once inside the page so the keys reach it.
5. Backups: keep `dist/smart-diary.html` on the desktop (it works with no internet), and remember backup slides 21 and 22.
6. Use your printed cue card for your lines. Pressing **N** shows the line on screen too, so the audience would see it: use N only when rehearsing.

### How to drive it

- **→**, **Space** or the clicker: next scene. Talk while the scene runs.
- Pressing **→** while a scene is still moving finishes it at once. Press again for the next scene.
- **←** goes back one scene. **Esc** closes a window.
- With Claude, the wording of the lessons and answers changes a little each run. Describe what is on screen, not exact words.

### Bridge from slide 7 (before you switch to the browser)

> Your second question was a complete example: input, processing, output and decision.
> The project and all figures are invented. But the form is your real SSC App form.
> The project is heat recovery from the process-cooling return for HVAC pre-heating. We chose heating on purpose: it is the largest CO₂ source in your carbon balance.
> Instead of a video, we show it in our working prototype, click by click.

Switch to the browser and click **Concept demo**.

### Scene by scene

**1 · Opening** (click *Concept demo*)
- You see: the red and grey title screen; the search box types the project title.
- Say: *"This is Smart Diary, inside the SSC App. One project, from input to decision."*

**2 · Input** (→)
- You see: the SSC form fills in. SPOT ID, then the lookup fills the red SPOT box (180 t, €250–500k, utilities building), then title, description, project manager, Thursday 26.11 at 14:35, 20 minutes, four stars, the draft deck.
- Say: *"The project manager creates the project exactly as today: SPOT ID, lookup, title, description, meeting date, self-rating. Nothing new to type. Smart Diary only reads these fields and the SPOT figures."*

**3 · Six tags** (→)
- You see: the red strip with six tags; they tick one by one and are confirmed. A dark box says *Why tags matter*.
- Say: *"This strip is the only new element. Smart Diary suggests six tags from Takeda's controlled vocabulary, and the project manager confirms them with one click. Tags let a small archive be searched by technology, utility and equipment, not by word overlap."*

**4 · Search** (→)
- You see: the Smart Diary panel slides in. Six steps tick: 142 projects → 19 candidates → 60 passages → 5 scored → 3 shown, 2 too weak.
- Say: *"Now it searches only Takeda's own records. Filter by tags: 142 projects become 19. Search their decks and diary entries. Re-rank, and drop weak matches below a floor. Then the AI writes only from what was found, and a sentence without a source is deleted. No step decides. People judge."*
- Add if you like: *"These numbers are computed live, not a picture."*

**5 · Reference brief** (→)
- You see: three references. Page 6 of the first project's approval deck opens with one sentence highlighted, then closes. References 1 and 2 are marked *Reference*.
- Say: *"This is the result: the reference brief. Three comparable projects, with promised versus achieved and one lesson each. The first one promised 210 tonnes and achieved 140, because heat demand falls in summer. Every line has a source, down to the page: here is page 6 of the approval deck. One click cites it. And at the bottom it says honestly when nothing fits: no past project combines this heat source with this sink, so the 180 tonnes stay an unverified estimate."*

**6 · Ask** (→)
- You see: a question is typed; the answer appears with numbered sources and the note *Counts come from SPOT fields*.
- Say: *"Next is Ask. A question in plain language: which heat-recovery projects needed requalification, and how long did it take? The answer comes only from Takeda's records: two projects, about three to four months, each with its source. The count comes from SPOT, not from the language model."*

**7 · SSC decision** (→)
- You see: the decision window. *Go to deepening with conditions* is chosen and three conditions tick, each marked with the reference it came from. On the right: the brief and the question asked in the meeting.
- Say: *"Thursday, 14:35. The SSC decides: go to deepening, with three conditions taken from the lessons. Measure the load, split winter and summer, check the pipe route. The SSC keeps full decision authority. Smart Diary only changes what is on the table."*
- The window stays open on purpose. The next → saves the decision.

**8 · Write** (→)
- You see: the decision is saved; diary entry 1 is written out; *Confirm entry*; the message *Diary entry 1 saved · searchable from tomorrow*.
- Say: *"This decision becomes diary entry one. The AI drafts it from what is already written: the form, the decision and the references. The project manager confirms it. Nothing is published before that. And tomorrow it is searchable."*

**9 · The loop** (→)
- You see: the six steps, with a red arrow from step 6 back to step 1.
- Say: *"And here the loop closes. Step six, lessons learned, feeds step one of the next project. Takeda defined it. Smart Diary closes it."*
- Strong extra if you have 30 seconds: click **Run tonight's index now**, then **Start the next project ›**. The next project's brief lists, as reference 1, the decision you just made. Say: *"Here is the proof: the next project already finds the decision we just recorded."*

**Stop here** and go back to the slides, as the cue card says: *"That was one project, from the form to the decision. Now we look at the output once more."* (slide 8)

**10 · Close** (→, optional)
- You see: *Approve Phase 0 of Smart Diary*. This repeats your last slide, so keep it for the very end or skip it.

### If something goes wrong

| Problem | What to do |
|---|---|
| Claude takes a few seconds | Keep talking. The step *Write the brief* shows a spinner until the text arrives. |
| Claude does not answer | Nothing to do: the app switches to the offline writer on its own and says so in grey. Everything else works the same. |
| You pressed → too early | Press ← to go back one scene. |
| The browser or network fails | Double-click `smart-diary.html` from the desktop (works offline), or use backup slides 21 and 22. |

### Questions you can answer by clicking (Q&A)

| Question | Click |
|---|---|
| "Where does this sentence come from?" | Any source chip: *SPOT*, *DECK P. 6*, *DIARY · CLOSEOUT*. The page opens with the sentence highlighted. |
| "Is this real or a mock-up?" | In the brief, *How these 3 were found*; click any of the six steps to see the 19 candidates, the passage scores and the re-rank against the floor. |
| "What if nothing fits?" | Ask tab: `Did any project use hydrogen?` → **NOT FOUND**. |
| "Our documents are partly German." | Ask tab: `Abwärmenutzung der Druckluftkompressoren`. |
| "Does it only work for heat recovery?" | Main page → open **10xx151 LED retrofit**: it finds LED projects. |
| "How do you know it is good?" | **PILOT** → *Run the Gate B demo check*. |
| "Who saw what?" | **RECORDS** → *Audit log*. |

---

## Part 2 · "How did you build it?"

### The honest short answer

> We designed the concept, the demo flow and the rules. We built the prototype with Claude Code, Anthropic's AI coding assistant, and tested it ourselves. All the data is invented to show the format.

This matches slide 19 (AI transparency). Say it openly: using AI to build an AI prototype is part of the story.

### The 30-second explanation

> It is a small web application. It holds an archive of 142 invented past projects: SPOT records, approval-deck pages, SSC decisions and diary entries, some in German. When the project manager creates a project, it does exactly what slide 11 describes. It tags the project, filters by tags, searches by keywords and by meaning, re-ranks, and drops weak matches. Then Claude, Anthropic's language model, writes the brief only from the passages that were found. Our code then checks every sentence and deletes any sentence that does not cite a source.

### What is inside

| Part | What we used | In one sentence |
|---|---|---|
| **App** | HTML, CSS and JavaScript, no framework | Runs in any browser; the same code runs as a claude.ai page, as one offline file, or with a small server |
| **Data** | 142 invented projects, 498 text passages | 19 heat-recovery projects written by hand (including the three on slide 8); the rest generated from templates for 11 other technology classes; some in German |
| **Tags** | Controlled vocabulary of six tag types | A rule-based matcher suggests the tags; with Claude connected, Claude picks them, and it can only choose words from the vocabulary |
| **Search** | Hybrid search: BM25 + concept vectors | BM25 is the classic search-engine keyword score; concept vectors match meaning through a bilingual concept dictionary ("Abwärme" = "waste heat"); the two scores count half each |
| **Re-rank and floor** | 0.55 × tag match + 0.45 × text match; floor 0.70 | Anything under the floor is dropped; if nothing passes, the answer is "not found" |
| **Writing** | Claude by Anthropic | In the published page Claude runs on the viewer's claude.ai account. With a local server it runs through the official Anthropic API (Claude Opus 5.5) with built-in citations |
| **Citation check** | Our own code | Every sentence must point to a retrieved passage; a sentence without one is deleted and shown struck through |
| **Numbers** | Queries on SPOT fields | Counts like "two projects" are computed by code; the model only puts them into words |
| **The loop** | A button that stands in for the nightly job | A confirmed diary entry becomes a new record in the archive, so the next project finds it |
| **Quality** | 19 automated tests and browser test runs | They check the tags, the 142 → 19 → 60 → 5 → 3 numbers, "not found", the citation check and the loop |
| **Code** | GitHub repository | `github.com/Sepidehri/Takada` |

### Prototype versus pilot: be precise

| In this prototype | In the pilot (slides 11–14) |
|---|---|
| Invented data | SPOT export, approval decks and SSC minutes, checked in Phase 0 |
| "Meaning" search through a hand-made concept dictionary | An embedding model and a search service such as Azure AI Search |
| Claude on claude.ai or through the Anthropic API | A model approved by DD&T in Takeda's own tenant; no training on Takeda data |
| Overnight index is a button | A nightly job |
| Browser storage | Takeda's systems, with access rights inherited and every answer logged |

### Questions you may get, with short answers

**Is the AI real, or is the demo scripted?**
Both parts are real. The search runs live in the browser, and Claude writes the brief, the answers and the diary entry live. That is why the wording changes a little each time. If Claude is unavailable, an offline writer stands in and the screen says so.

**What is RAG?**
Retrieval-augmented generation (Lewis et al., 2020): first look up the relevant records, then let the model write only from them, with sources.

**How do you stop it from making things up?**
Three protections: it writes only from the passages that were found; a sentence without a source is deleted; and if nothing passes the floor, it says "not found". One limit remains: a citation proves a source exists, not that the source is right. That is why people decide.

**Which AI model?**
Claude by Anthropic. In the prototype: Claude on claude.ai, or Claude Opus 5.5 through the API. In the pilot, the model is DD&T's choice, inside Takeda's tenant.

**Where does the data come from?**
It is invented to show the format. The form fields are those of SSC App version 2.0. In the pilot the data comes from SPOT, the approval decks and the SSC minutes, and Phase 0 checks that it exists.

**Are the numbers 142 → 19 → 60 → 5 → 3 real?**
They are computed by the code every time. We designed the invented archive so that our worked example matches the numbers on our slides. The same code would run on real records and give their numbers.

**Is the "meaning" search a neural embedding?**
Not in the prototype. It uses a bilingual concept vocabulary, which is enough for a small archive ("tags before semantics"). The pilot would add an embedding model.

**What does one brief cost?**
On claude.ai it uses the viewer's own plan. Through the API, a few cents per brief.

**Could this run at Takeda?**
Yes. It is the same pattern Takeda already uses in TAK GPT and AIMI (slide 12). It needs the SPOT export, a platform approved by DD&T and IT security, and the works council involved, which is exactly what Phase 0 checks.

**Did you write the code yourselves?**
We used Claude Code, an AI coding assistant, to write it. We decided what it does: the use case, the six steps, the rules (tags first, no source no sentence, numbers from SPOT, people decide), the gates. Then we tested it. We can show the code on GitHub.

**How long did it take?**
A few days with the AI assistant, including tests.
