'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('mcp server speaks JSON-RPC over stdio', () => {
  const input = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'generate_whatsapp_link', arguments: { phone: '0501234567', lang: 'en', name: 'Dana' } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'generate_whatsapp_link', arguments: { phone: 'nope' } } }
  ].map((m) => JSON.stringify(m)).join('\n') + '\n';
  const r = spawnSync(process.execPath, [path.join(__dirname, '../mcp/server.js')], { input, encoding: 'utf8' });
  const out = r.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(out.length, 4);
  assert.strictEqual(out[0].result.serverInfo.name, 'wa-link-generator');
  assert.ok(out[1].result.tools.some((t) => t.name === 'generate_whatsapp_link'));
  assert.ok(out[2].result.structuredContent.link.startsWith('https://wa.me/972501234567?text='));
  assert.strictEqual(out[3].result.isError, true);
});
