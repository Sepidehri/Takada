# Smart Diary in production: how Takeda would use it and build it

The prototype shows the method with invented data. This page describes the real case: who uses Smart Diary when, and how DD&T would build it on the platform Takeda already runs. It is our proposal for the pilot; Phase 0 checks every assumption with DD&T.

---

## 1 · One project, in real life

| When | Who | What happens |
|---|---|---|
| Monday | Project manager | Creates the project in the SSC App as today: SPOT ID, lookup, title, description. Smart Diary suggests six tags; the PM ticks, unticks or corrects them (about 30 seconds). The reference brief appears in the SSC App: comparable past projects, promised vs achieved, one lesson each, the source down to the page. The PM cites two references in the approval deck and calls the owner of the third. |
| Tuesday–Wednesday | SSC members | Read the same brief in the pre-read, so every project arrives with its precedent. |
| Thursday, 14:35 | SSC | Review 1. Questions are asked in plain language during the meeting (Ask). The decision and its conditions are recorded in the SSC App. |
| Thursday afternoon | Project manager | Confirms diary entry 1, drafted by AI from the form, the decision and the references (about 5 minutes). Nothing is published before that. |
| Thursday night | Nightly job | Indexes the confirmed entry. From Friday, every new project can find it. |
| Review 2, go-live, closeout | Project manager | Entries 2, 3 and 4: rejected options and why, surprises in implementation, promised vs achieved (from SPOT and the sustainability dashboard). Entry 4 is step 6, and it feeds step 1 of the next project. |
| Every quarter | Sustainability Management | Reviews lessons by technology class, maintains the tag vocabulary, reads the usage figures for the gates. |
| Always | DD&T | Runs the platform, access rights, monitoring and the evaluation set. |

---

## 2 · The technology, step by step

Takeda mentioned that it runs **Databricks**. Smart Diary fits it directly. If DD&T prefers a pure Azure stack, every step has an Azure equivalent. The design does not depend on the platform.

| Smart Diary step | In our prototype | On Databricks | Azure alternative |
|---|---|---|---|
| **Collect the sources** | Invented records in a JavaScript file | SPOT tables, approval decks, SSC minutes and diary entries land in **Delta tables** governed by **Unity Catalog**, refreshed by a nightly **Lakeflow** job | Azure Blob Storage or SharePoint, with an Azure AI Search indexer |
| **Read the approval decks** | Deck pages typed in by hand | **`ai_parse_document`** reads PDF and PowerPoint; one passage per slide, so a citation can name the page | Azure AI Document Intelligence |
| **Suggest the six tags** | Rule-based matcher, or Claude constrained to the vocabulary | **`ai_query`** with a model and the vocabulary table as allowed values; the PM confirms in the SSC App | Azure OpenAI with structured output |
| **Index** | BM25 + a hand-made bilingual concept dictionary | **Databricks AI Search** (formerly Mosaic AI Vector Search): an index synced from the passages table, a **multilingual embedding model** (German and English), the tags as filter columns | **Azure AI Search** with integrated vectorization |
| **Search** | Tag filter, hybrid score, re-rank, floor | **Filters** on the tag columns, **hybrid search** (keyword + vector), the built-in **reranker**; the similarity floor stays in our code | Hybrid search (BM25 + vector) with the semantic ranker and filters |
| **Numbers** | Queries on SPOT fields in JavaScript | SQL on the SPOT tables, offered to the model as **Unity Catalog functions**; the model only phrases the result | SQL on the SPOT database |
| **Write with sources** | Claude with citations; sentences without a source are deleted | **Claude through Databricks Foundation Model APIs** (native Anthropic Messages API), or another model DD&T approves; the citation check stays in our code | Azure OpenAI, or Claude in Microsoft Foundry |
| **Show it in the SSC App** | A web page | A **Model Serving** endpoint that the SSC App calls (one button in the pilot, a panel later), or a **Databricks App** | Azure App Service or Functions |
| **Access rights** | None (invented data) | Unity Catalog permissions on tables and the index; the SSC App passes the user's identity, so users see only what they may already open | Security filters in Azure AI Search with Entra ID |
| **Log every answer** | Audit log in the app | **AI Gateway** usage tracking and inference tables, **MLflow** tracing | Azure Monitor and Application Insights |
| **Gate B: is it good?** | 12-question demo check | **MLflow evaluation** with LLM judges (groundedness, relevance) on the 50 test questions, plus two engineers rating | Azure AI Foundry evaluation |
| **A fast start for Ask** | (not needed) | **Agent Bricks: Knowledge Assistant** answers questions over documents with page-level citations. Current docs mark it as legacy and point new builds to **Genie Agents**; DD&T picks what is current. | Azure AI Foundry agents |

### What changes from the prototype, and what stays

- **Changes:** the "meaning" half of the search. The prototype uses a hand-made bilingual concept dictionary, which is enough for 142 invented projects. The real system uses a multilingual embedding model in the search index.
- **Stays:** tags before semantics (the tags become filters), the similarity floor and the honest "not found", numbers from SPOT, the citation check that deletes sentences without a source, people decide.

---

## 3 · Questions to settle in Phase 0

1. **Platform:** does the SSC pilot run in Takeda's Databricks workspace (Unity Catalog enabled), or on Azure AI Search?
2. **Models in the EU:** which models are approved, and are they served in Takeda's region? Some Claude endpoints on Databricks are limited to certain regions or need cross-geo processing to be allowed. That is a decision for DD&T and IT security.
3. **SPOT:** can it be exported to Delta tables, and how often?
4. **Decks:** where are they stored, and does `ai_parse_document` read them well? Test on the 20 sampled projects.
5. **Cost:** the cloud line on slide 14 uses Azure AI Search list prices. On Databricks it becomes AI Search plus model serving; DD&T prices it in Phase 0.

---

## Sources

- [Databricks AI Search (formerly Mosaic AI Vector Search)](https://docs.databricks.com/aws/en/generative-ai/vector-search) · [Hybrid search GA](https://databricks.com/blog/announcing-hybrid-search-general-availability-mosaic-ai-vector-search) · [Retrieval quality guide (reranking)](https://docs.databricks.com/aws/en/vector-search/vector-search-retrieval-quality) · [Query an AI Search index](https://docs.databricks.com/aws/en/ai-search/query-ai-search)
- [Foundation Model APIs: supported models](https://docs.databricks.com/aws/machine-learning/foundation-model-apis/supported-models) · [Query Claude with the Anthropic Messages API](https://docs.databricks.com/aws/en/machine-learning/model-serving/query-anthropic-messages.html) · [Compliance and regions](https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/compliance)
- [`ai_parse_document`](https://learn.microsoft.com/azure/databricks/sql/language-manual/functions/ai_parse_document)
- [Agent Bricks: Knowledge Assistant](https://docs.databricks.com/aws/en/agents/agent-bricks/knowledge-assistant) · [GA announcement, January 2026](https://www.databricks.com/blog/agent-bricks-knowledge-assistant-now-generally-available-turning-enterprise-knowledge-answers)
