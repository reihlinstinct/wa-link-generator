'use strict';
// Shared MCP logic (JSON-RPC 2.0). No I/O, no storage, no logging, no dependencies.
// Used by the stdio server (mcp/server.js) and the Cloudflare Worker (worker/index.mjs, generated).
module.exports = function createMcp(WA, data, LANGS) {
  var TOPICS = data.topics.map(function (t) { return t.id; });
  var tools = [
    {
      name: 'generate_whatsapp_link',
      description: 'Build a wa.me link with a prefilled neutral thank-you message. Nothing is sent: the human opens the link, reviews the text and presses send in WhatsApp. The phone number is used only to build the link and is not stored or logged.',
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
      return { topics: data.topics.map(function (t) { return { id: t.id, title: t.title }; }), languages: LANGS };
    }
    if (name !== 'generate_whatsapp_link') throw new Error('Unknown tool');
    var lang = a.lang || 'he';
    if (LANGS.indexOf(lang) < 0) throw new Error('Unsupported lang');
    var topic = data.topics.filter(function (t) { return t.id === (a.topic || TOPICS[0]); })[0];
    if (!topic) throw new Error('Unknown topic');
    var text = a.message ? WA.clean(a.message) : WA.pickMessage(topic.languages[lang], { name: a.name, useName: a.use_name !== false });
    var link = WA.buildLink(a.phone, text);
    if (!link) throw new Error('Invalid phone number or empty message');
    return { link: link, text: text, lang: lang, note: 'Show the link to the user. They open it, review the text and send it themselves.' };
  }

  function res(id, result) { return { jsonrpc: '2.0', id: id, result: result }; }
  function err(id, code, message) { return { jsonrpc: '2.0', id: id, error: { code: code, message: message } }; }

  // Returns a response object, or null for notifications.
  function handle(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(null, -32600, 'Invalid Request');
    if (msg.id === undefined) return null;
    switch (msg.method) {
      case 'initialize':
        return res(msg.id, { protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'wa-link-generator', version: '1.1.0' } });
      case 'ping': return res(msg.id, {});
      case 'tools/list': return res(msg.id, { tools: tools });
      case 'tools/call':
        try {
          var out = callTool(msg.params && msg.params.name, msg.params && msg.params.arguments);
          return res(msg.id, { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out });
        } catch (e) {
          return res(msg.id, { content: [{ type: 'text', text: String(e.message) }], isError: true });
        }
      default: return err(msg.id, -32601, 'Method not found');
    }
  }
  return { tools: tools, callTool: callTool, handle: handle };
};
