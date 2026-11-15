'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/build-worker.js');

test('worker/index.mjs is up to date with its sources', () => {
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '../worker/index.mjs'), 'utf8'), build());
});
test('worker never stores or logs', () => {
  const src = fs.readFileSync(path.join(__dirname, '../worker/index.mjs'), 'utf8');
  assert.ok(!/console\.|localStorage|caches\.|KV|fetch\(/.test(src.replace(/async fetch\(req\)/, '')));
});
async function call(worker, body, method = 'POST', p = '/mcp') {
  const r = await worker.fetch(new Request('https://x.test' + p, { method, body: method === 'POST' ? JSON.stringify(body) : undefined }));
  return { status: r.status, text: await r.text() };
}
test('worker speaks MCP over HTTP', async () => {
  const worker = (await import('../worker/index.mjs')).default;
  let r = await call(worker, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.strictEqual(r.status, 200);
  assert.ok(JSON.parse(r.text).result.tools.some((t) => t.name === 'generate_whatsapp_link'));
  r = await call(worker, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'generate_whatsapp_link', arguments: { phone: '0501234567', lang: 'ar', name: 'Dana' } } });
  const out = JSON.parse(r.text).result.structuredContent;
  assert.ok(out.link.startsWith('https://wa.me/972501234567?text='));
  assert.ok(/[\u0600-\u06FF]/.test(out.text));
  r = await call(worker, { jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.strictEqual(r.status, 202);
  r = await call(worker, null, 'GET');
  assert.strictEqual(r.status, 405);
  r = await worker.fetch(new Request('https://x.test/mcp', { method: 'POST', body: 'not json' }));
  assert.strictEqual(r.status, 400);
  r = await call(worker, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'generate_whatsapp_link', arguments: { phone: 'bad' } } });
  assert.strictEqual(JSON.parse(r.text).result.isError, true);
});
