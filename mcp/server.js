#!/usr/bin/env node
'use strict';
// MCP server over stdio (newline-delimited JSON-RPC). No dependencies, no network, no storage.
// Run locally: node mcp/server.js
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const WA = require('../lib.js');
const createMcp = require('./core.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/messages.json'), 'utf8'));
const i18n = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n/strings.json'), 'utf8'));
const mcp = createMcp(WA, data, Object.keys(i18n.meta));

if (require.main === module) {
  readline.createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return;
    let out;
    try { out = mcp.handle(JSON.parse(line)); } catch (e) { out = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; }
    if (out) process.stdout.write(JSON.stringify(out) + '\n');
  });
}
module.exports = mcp;
