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
