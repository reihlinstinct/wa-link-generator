#!/usr/bin/env node
'use strict';
// Minimal MCP server over stdio (JSON-RPC 2.0, newline-delimited). No dependencies, no network, no storage.
// Run locally: node mcp/server.js
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const WA = require('../lib.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/messages.json'), 'utf8'));
const i18n = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n/strings.json'), 'utf8'));
const LANGS = Object.keys(i18n.meta);
const TOPICS = data.topics.map((t) => t.id);

const tools = [
  {
    name: 'generate_whatsapp_link',
    description: 'Build a wa.me link with a prefilled neutral thank-you message. Nothing is sent: the human opens the link, reviews the text and presses send in WhatsApp. The phone number is used only to build the link and is not stored.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Recipient WhatsApp number, local Israeli (05X-XXXXXXX) or international (+972 5X XXX XXXX).' },
        topic: { type: 'string', enum: TOPICS, description: 'Message topic id.' },
        lang: { type: 'string', enum: LANGS, description: 'Message language. Default he.' },
        name: { type: 'string', description: 'Optional name or title used in a greeting, e.g. the contact first name.' },
        use_name: { type: 'boolean', description: 'Address the contact by name when a name is given. Default true.' },
        message: { type: 'string', description: 'Optional custom wording. If omitted a wording is picked from the pool.' }
      },
      required: ['phone']
    }
  },
  {
    name: 'list_topics',
    description: 'List available topics and languages.',
    inputSchema: { type: 'object', properties: {} }
  }
];

function callTool(name, a) {
  a = a || {};
  if (name === 'list_topics') {
    return { topics: data.topics.map((t) => ({ id: t.id, title: t.title })), languages: LANGS };
  }
  if (name !== 'generate_whatsapp_link') throw new Error('Unknown tool');
  const lang = a.lang || 'he';
  if (!LANGS.includes(lang)) throw new Error('Unsupported lang');
  const topic = data.topics.find((t) => t.id === (a.topic || TOPICS[0]));
  if (!topic) throw new Error('Unknown topic');
  const text = a.message ? WA.clean(a.message) : WA.pickMessage(topic.languages[lang], { name: a.name, useName: a.use_name !== false });
  const link = WA.buildLink(a.phone, text);
  if (!link) throw new Error('Invalid phone number or empty message');
  return { link, text, lang, note: 'Show the link to the user. They open it, review the text and send it themselves.' };
}

function reply(id, result, error) {
  const m = error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result };
  process.stdout.write(JSON.stringify(m) + '\n');
}

function handle(msg) {
  if (msg.id === undefined) return; // notification
  switch (msg.method) {
    case 'initialize':
      return reply(msg.id, { protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'wa-link-generator', version: '1.0.0' } });
    case 'ping': return reply(msg.id, {});
    case 'tools/list': return reply(msg.id, { tools });
    case 'tools/call':
      try {
        const out = callTool(msg.params && msg.params.name, msg.params && msg.params.arguments);
        return reply(msg.id, { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out });
      } catch (e) {
        return reply(msg.id, { content: [{ type: 'text', text: String(e.message) }], isError: true });
      }
    default: return reply(msg.id, null, { code: -32601, message: 'Method not found' });
  }
}

if (require.main === module) {
  readline.createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return;
    try { handle(JSON.parse(line)); } catch (e) { reply(null, null, { code: -32700, message: 'Parse error' }); }
  });
}
module.exports = { callTool, tools };
