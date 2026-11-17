'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/build-worker.js');

test('worker/index.mjs is up to date with its sources', () => {
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '../worker/index.mjs'), 'utf8'), build());
});
test('worker never logs and touches storage and network only in open_issue', () => {
  const src = fs.readFileSync(path.join(__dirname, '../worker/index.mjs'), 'utf8');
  assert.ok(!/console\.|localStorage|caches\.|waitUntil/.test(src));
  assert.strictEqual((src.match(/env\.RATE\./g) || []).length, 2);
  assert.strictEqual((src.match(/await fetch\(/g) || []).length, 1);
  assert.ok(src.indexOf('await fetch(') > src.indexOf('async function openIssue'));
  assert.ok(src.indexOf('await fetch(') < src.indexOf('async function handleMsg'));
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

const rpc = (name, args) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
function fakeEnv() {
  const kv = new Map();
  return { MCP_ISSUE_TOKEN: 'secret-test-token', GH_ISSUES_TOKEN: 'gh-test', RATE: { get: async (k) => kv.get(k) || null, put: async (k, v) => { kv.set(k, v); } } };
}
async function callWith(worker, env, body, headers = {}) {
  const r = await worker.fetch(new Request('https://x.test/mcp', { method: 'POST', headers, body: JSON.stringify(body) }), env);
  return JSON.parse(await r.text()).result;
}
test('open_issue requires the bearer token and is not configured without secrets', async () => {
  const worker = (await import('../worker/index.mjs')).default;
  let r = await callWith(worker, {}, rpc('open_issue', { title: 't', body: 'b' }));
  assert.strictEqual(r.isError, true);
  r = await callWith(worker, fakeEnv(), rpc('open_issue', { title: 't', body: 'b' }), { authorization: 'Bearer wrong' });
  assert.strictEqual(r.isError, true);
  assert.ok(/bearer/.test(r.content[0].text));
});
test('open_issue rejects personal data and oversize input before any network call', async () => {
  const worker = (await import('../worker/index.mjs')).default;
  const h = { authorization: 'Bearer secret-test-token' };
  const real = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network must not be called'); };
  try {
    for (const args of [{ title: 't', body: 'call 050-123 4567' }, { title: 'a@b.co', body: 'x' }, { title: 't', body: 'x'.repeat(2001) }, { title: '', body: 'x' }]) {
      const r = await callWith(worker, fakeEnv(), rpc('open_issue', args), h);
      assert.strictEqual(r.isError, true, JSON.stringify(args));
    }
  } finally { globalThis.fetch = real; }
});
test('open_issue posts to the repo with the secret, then rate limits', async () => {
  const worker = (await import('../worker/index.mjs')).default;
  const env = fakeEnv(), h = { authorization: 'Bearer secret-test-token' };
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ html_url: 'https://github.com/x/y/issues/1', number: 1 }) }; };
  try {
    for (let i = 0; i < 5; i++) {
      const r = await callWith(worker, env, rpc('open_issue', { title: 'Idea', body: 'Add a Russian wording' }), h);
      assert.ok(!r.isError, JSON.stringify(r));
      assert.ok(!JSON.stringify(r).includes('gh-test'));
    }
    const r = await callWith(worker, env, rpc('open_issue', { title: 'Idea', body: 'More' }), h);
    assert.strictEqual(r.isError, true);
    assert.strictEqual(calls.length, 5);
    assert.strictEqual(calls[0].url, 'https://api.github.com/repos/reihlinstinct/wa-link-generator/issues');
    assert.strictEqual(calls[0].init.headers.authorization, 'Bearer gh-test');
  } finally { globalThis.fetch = real; }
});
test('built-in contact numbers come only from the Worker secret', async () => {
  const worker = (await import('../worker/index.mjs')).default;
  const env = { CONTACT_PHONE_MAYOR: 'ignored', CONTACT_PHONES: JSON.stringify({ mayor: '972501234567' }) };
  let r = await callWith(worker, {}, rpc('list_contacts', {}));
  assert.deepStrictEqual(r.structuredContent.contacts, []);
  r = await callWith(worker, {}, rpc('generate_whatsapp_link', { contact: 'mayor', message: 'Thank you' }));
  assert.strictEqual(r.isError, true);
  r = await callWith(worker, env, rpc('list_contacts', {}));
  assert.ok(r.structuredContent.contacts.some((c) => c.id === 'mayor'));
  assert.ok(!JSON.stringify(r.structuredContent).includes('972'));
  r = await callWith(worker, env, rpc('get_topic_guidance', {}));
  assert.ok(r.structuredContent.guidance.goal && Array.isArray(r.structuredContent.guidance.facts));
  r = await callWith(worker, env, rpc('generate_whatsapp_link', { contact: 'mayor', lang: 'en', message: 'Thank you for the bus lane' }));
  assert.ok(r.structuredContent.link.startsWith('https://wa.me/972501234567?text='));
  r = await callWith(worker, env, rpc('generate_whatsapp_link', { contact: 'mayor', message: 'write to me at a@b.co' }));
  assert.strictEqual(r.isError, true);
  for (const name of ['Dana 050-123 4567', 'a@b.co', 12345]) {
    r = await callWith(worker, env, rpc('generate_whatsapp_link', { contact: 'mayor', name }));
    assert.strictEqual(r.isError, true, String(name));
  }
  let g = await worker.fetch(new Request('https://x.test/contacts'), env);
  const list = (await g.json()).contacts;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].phone, '972501234567');
  assert.strictEqual(g.headers.get('cache-control'), 'public, max-age=300');
  g = await worker.fetch(new Request('https://x.test/contacts'), { CONTACT_PHONES: 'not json' });
  assert.deepStrictEqual((await g.json()).contacts, []);
  assert.strictEqual((await worker.fetch(new Request('https://x.test/contacts', { method: 'POST' }), env)).status, 405);
});
