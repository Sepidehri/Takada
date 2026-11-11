/*
 * Smart Diary · demo server
 * -----------------------------------------------------------------------------
 * Serves the app and runs the generation step of the RAG pipeline with Claude.
 *
 *   npm install
 *   cp .env.example .env      # put your ANTHROPIC_API_KEY in .env
 *   npm start                 # http://localhost:3000
 *
 * Retrieval (tags → hybrid search → re-rank → floor) is the shared engine in
 * js/engine.js. The server re-runs it for every request, sends the retrieved
 * passages to Claude as search_result blocks with citations enabled, and runs
 * the citation check on the answer: a sentence without a source is deleted.
 * Without a key, or if a call fails, the offline writer answers instead.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import Anthropic from '@anthropic-ai/sdk';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env: fine */ }

const require = createRequire(import.meta.url);
require('../js/data.js');
require('../js/engine.js');
const SD = globalThis.SD;
const E = SD.engine;

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = process.env.SMART_DIARY_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.SMART_DIARY_EFFORT || 'low';
const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = HAS_KEY ? new Anthropic({ timeout: 90_000, maxRetries: 1 }) : null;

/* ---------------------------------------------------------------- Claude */

// Server-side refusal fallback is on by default (beta). If the account or
// platform rejects the beta, retry once as a plain request.
let fallbacksSupported = true;
async function createMessage(params) {
  if (fallbacksSupported) {
    try {
      return await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    } catch (err) {
      if (!(err instanceof Anthropic.BadRequestError)) throw err;
      fallbacksSupported = false;
      console.warn('[claude] refusal fallbacks not accepted, continuing without them:', err.message);
    }
  }
  return client.messages.create(params);
}

function checkStop(resp) {
  if (resp.stop_reason === 'refusal') throw new Error('Claude declined this request (refusal).');
  if (resp.stop_reason === 'max_tokens') throw new Error('The answer was cut off (max_tokens).');
}

/* Writer for the RAG engine: prompt.content holds the search_result blocks
   plus the instruction. Returns text blocks with their citations. */
async function claudeWrite(prompt) {
  const resp = await createMessage({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: EFFORT },
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.content }]
  });
  checkStop(resp);
  const content = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => ({
      text: b.text,
      citations: (b.citations || [])
        .filter((c) => c.type === 'search_result_location')
        .map((c) => ({
          search_result_index: c.search_result_index,
          start_block_index: c.start_block_index,
          end_block_index: c.end_block_index,
          cited_text: c.cited_text
        }))
    }));
  return { content, model: resp.model, usage: { input: resp.usage.input_tokens, output: resp.usage.output_tokens } };
}

/* Six tags from the controlled vocabulary (structured output, no citations). */
async function claudeTags(form) {
  const p = E.tagPrompt(form);
  const resp = await createMessage({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: p.schema } },
    system: p.system,
    messages: [{ role: 'user', content: p.user }]
  });
  checkStop(resp);
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const tags = E.validateTags(JSON.parse(text));
  if (!tags) throw new Error('Claude returned tags outside the vocabulary.');
  return { tags, model: resp.model };
}

/* ---------------------------------------------------------------- Index */

const baseIndex = E.buildIndex();
function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
// Records added by the "overnight index" in the browser (confirmed diary entries).
function cleanExtras(extras) {
  if (!Array.isArray(extras)) return [];
  return extras.slice(0, 10).filter((r) => r && typeof r.id === 'string' && Array.isArray(r.passages)).map((r) => ({
    id: str(r.id, 20), n: 900, title: str(r.title, 200), year: Number(r.year) || 2026, status: str(r.status, 40),
    tags: Object.fromEntries(SD.TAG_TYPES.map((t) => [t.key, str((r.tags || {})[t.key], 80)])),
    promised: Number(r.promised) || 0, achieved: null, requal: null, shortLesson: null,
    owner: r.owner ? { name: str(r.owner.name, 60), role: str(r.owner.role, 80), dept: str(r.owner.dept, 40) } : null,
    passages: r.passages.slice(0, 5).map((p) => ({
      id: str(p.id, 60), kind: 'diary', gate: str(p.gate, 40), date: str(p.date, 20), lang: 'en',
      text: str(p.text, 2000), supports: false,
      L: p.L ? { lesson: str(p.L.lesson, 300), question: str(p.L.question, 200), condition: { short: str((p.L.condition || {}).short, 120), long: str((p.L.condition || {}).long, 300), priority: 9 } } : null
    }))
  }));
}
function indexFor(extras) {
  const x = cleanExtras(extras);
  return x.length ? E.buildIndex(x) : baseIndex;
}

/* ---------------------------------------------------------------- HTTP */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.pdf': 'application/pdf' };
const STATIC_DIRS = ['js', 'css', 'docs'];

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readJSON(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 300_000) { reject(new Error('Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!rel) rel = 'index.html';
  const top = rel.split('/')[0];
  if (rel !== 'index.html' && !STATIC_DIRS.includes(top)) return send(res, 404, 'Not found', 'text/plain');
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
}

const writer = HAS_KEY ? claudeWrite : null;

const routes = {
  'GET /api/health': async () => ({ ok: true, llm: HAS_KEY, model: HAS_KEY ? MODEL : null, effort: EFFORT, projects: baseIndex.projects.length, passages: baseIndex.N }),
  'POST /api/rag/brief': async (b) => E.rag.brief(indexFor(b.extras), b.query || {}, writer),
  'POST /api/rag/ask': async (b) => E.rag.ask(indexFor(b.extras), str(b.question, 500), str(b.context, 300) || null, writer),
  'POST /api/rag/draft': async (b) => E.rag.draft(b.input || {}, writer),
  'POST /api/rag/tags': async (b) => {
    const form = { title: str((b.form || {}).title, 300), description: str((b.form || {}).description, 1500), spot: (b.form || {}).spot || {} };
    const t0 = Date.now();
    if (!HAS_KEY) return { tags: E.suggestTags(form), writer: { mode: 'offline', model: 'rule-based tagger', ms: Date.now() - t0 } };
    try {
      const out = await claudeTags(form);
      return { tags: out.tags, writer: { mode: 'claude', model: out.model, ms: Date.now() - t0 } };
    } catch (err) {
      return { tags: E.suggestTags(form), writer: { mode: 'offline', model: 'rule-based tagger', ms: Date.now() - t0, fallback: err.message } };
    }
  }
};

const server = http.createServer(async (req, res) => {
  const key = req.method + ' ' + new URL(req.url, 'http://x').pathname;
  const route = routes[key];
  if (!route) {
    if (req.method === 'GET') return serveStatic(req, res);
    return send(res, 404, { error: 'not found' });
  }
  const t0 = Date.now();
  try {
    const body = req.method === 'POST' ? await readJSON(req) : {};
    const out = await route(body);
    const w = out && out.writer;
    console.log(`${key} · ${Date.now() - t0} ms${w ? ` · writer ${w.mode}${w.model ? ' (' + w.model + ')' : ''}${w.fallback ? ' · fallback: ' + w.fallback : ''}` : ''}`);
    send(res, 200, out);
  } catch (err) {
    console.error(key, err);
    send(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\nSmart Diary demo · http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Archive: ${baseIndex.projects.length} invented projects, ${baseIndex.N} passages`);
  console.log(HAS_KEY
    ? `Generation: Claude (${MODEL}, effort ${EFFORT}) with search-result citations`
    : 'Generation: offline writer (no ANTHROPIC_API_KEY found; add it to .env to use Claude)');
});
