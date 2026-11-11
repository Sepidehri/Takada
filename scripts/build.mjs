// Builds dist/smart-diary.html: the whole app in one file that opens with a
// double-click, works offline and needs no server (offline writer).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');
const inlineJs = (src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`;
html = html.replace('<link rel="stylesheet" href="css/app.css">', `<style>\n${read('css/app.css')}\n</style>`);
for (const src of ['js/data.js', 'js/engine.js', 'js/app.js']) {
  html = html.replace(`<script src="${src}"></script>`, () => inlineJs(src));
}
if (/src="js\/|href="css\//.test(html)) throw new Error('build: an asset was not inlined');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'smart-diary.html'), html);
console.log(`dist/smart-diary.html · ${(html.length / 1024).toFixed(0)} KB`);

// The same app as page content for a claude.ai Artifact: the platform adds
// the doctype, <html>, <head> and <body>, so only the title, fonts, styles,
// markup and scripts go in, title first.
const title = /<title>[^<]*<\/title>/.exec(html)[0];
const fonts = html.match(/<link rel="preconnect"[^>]*>|<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g).join('\n');
const style = /<style>[\s\S]*?<\/style>/.exec(html)[0];
const body = /<body>([\s\S]*)<\/body>/.exec(html)[1];
const page = `${title}\n${fonts}\n${style}\n${body.trim()}\n`;
fs.writeFileSync(path.join(root, 'dist', 'smart-diary.artifact.html'), page);
console.log(`dist/smart-diary.artifact.html · ${(page.length / 1024).toFixed(0)} KB`);
