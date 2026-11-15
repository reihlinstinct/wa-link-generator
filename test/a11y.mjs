// Automated accessibility and language-switch check. Needs Chrome (CHROME_PATH) and: npm i
import puppeteer from 'puppeteer-core';
import axe from 'axe-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true });
let failed = false;
const expect = { he: 'rtl', ar: 'rtl', en: 'ltr', ru: 'ltr' };
try {
  const page = await browser.newPage();
  await page.goto(url + '#c=' + encodeURIComponent('Dana:0501234567'), { waitUntil: 'networkidle0' });
  for (const lang of Object.keys(expect)) {
    await page.select('#lang', lang);
    const st = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, msg: document.getElementById('msg').value, href: document.getElementById('go').href }));
    const ok = st.lang === lang && st.dir === expect[lang] && st.href.startsWith('https://wa.me/972501234567?text=') && !/[,.]/.test(decodeURIComponent(st.href.split('text=')[1]));
    console.log(lang, ok ? 'ok' : 'FAIL', JSON.stringify(st.msg));
    if (!ok) failed = true;
    if (lang === 'he' || lang === 'ru') { /* script check below */ }
    const script = lang === 'he' || lang === 'ar' ? (lang === 'he' ? /[\u0590-\u05FF]/ : /[\u0600-\u06FF]/) : (lang === 'ru' ? /[\u0400-\u04FF]/ : /[A-Za-z]/);
    if (!script.test(st.msg.replace(/Dana/g, ''))) { console.log(lang, 'message not in expected script'); failed = true; }
    await page.evaluate(axe.source);
    const r = await page.evaluate(async () => await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }));
    for (const v of r.violations) { console.log(lang, 'axe', v.id, v.impact, v.nodes.length); failed = true; }
    console.log(lang, 'axe passes:', r.passes.length, 'violations:', r.violations.length);
  }
} finally { await browser.close(); server.close(); }
process.exit(failed ? 1 : 0);
