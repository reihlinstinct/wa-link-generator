'use strict';
// Shared MCP logic (JSON-RPC 2.0). No I/O, no storage, no logging, no dependencies.
// Used by the stdio server (mcp/server.js) and the Cloudflare Worker (worker/index.mjs, generated).
// Built-in contacts keep no phone number in the code. The numbers come from one secret named in
// phones_secret (an environment variable or a Worker secret) holding a JSON object, contact id to phone.
// A contact without an entry is left out. A missing or invalid secret leaves the list empty.
function withPhones(contactsData, env) {
  var phones = {};
  try { phones = JSON.parse((env && contactsData && env[contactsData.phones_secret]) || '{}') || {}; } catch (e) { phones = {}; }
  var list = ((contactsData && contactsData.contacts) || []).filter(function (c) { return typeof phones[c.phone_key || c.id] === 'string' && phones[c.phone_key || c.id]; })
    .map(function (c) { var o = {}; Object.keys(c).forEach(function (k) { if (k !== 'phone_key') o[k] = c[k]; }); o.phone = phones[c.phone_key || c.id]; return o; });
  return { contacts: list };
}
module.exports = function createMcp(WA, data, LANGS, contactsData) {
  var CONTACTS = (contactsData && contactsData.contacts) || [];
  var CONTACT_IDS = CONTACTS.map(function (c) { return c.id; });
  var MAX_TEXT = 400;
  // Free text must carry no phone numbers or email addresses.
  // Rejects 8+ digit runs (also long dates or ids written that way) and any @. Deliberately strict.
  var PII = /\d[\d\s\-().]{6,}\d|@/;
  var TOPICS = data.topics.map(function (t) { return t.id; });
  var tools = [
    {
      name: 'generate_whatsapp_link',
      description: 'Build a wa.me link with a prefilled neutral thank-you message. Nothing is sent: the human opens the link, reviews the text and presses send in WhatsApp. The phone number is used only to build the link and is not stored or logged.',
      inputSchema: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Recipient WhatsApp number, local Israeli (05X-XXXXXXX) or international (+972 5X XXX XXXX). Not needed when contact is given.' },
          contact: { type: 'string', enum: CONTACT_IDS, description: 'Id of a built-in public contact from list_contacts. Use instead of phone.' },
          topic: { type: 'string', enum: TOPICS, description: 'Message topic id.' },
          lang: { type: 'string', enum: LANGS, description: 'Message language. Default he.' },
          name: { type: 'string', description: 'Optional name or title used in a greeting, e.g. the contact first name.' },
          use_name: { type: 'boolean', description: 'Address the contact by name when a name is given. Default true.' },
          message: { type: 'string', description: 'Optional wording you composed yourself, up to ' + MAX_TEXT + ' characters, with no phone numbers or emails. Follow get_topic_guidance and state no invented facts. If omitted a wording is picked from the pool.' }
        }
      }
    },
    {
      name: 'list_contacts',
      description: 'List the built-in public contacts (id, name, role) that can be used with generate_whatsapp_link by id. Only people whose number is public are included. Contacts a person added in their own browser are stored only there and are not visible here.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_topic_guidance',
      description: 'Goal, stance, tone, length and verified facts for a topic, so you can compose a NEW wording yourself and pass it as message to generate_whatsapp_link. Use only the facts listed. Do not invent claims.',
      inputSchema: { type: 'object', properties: { topic: { type: 'string', enum: TOPICS, description: 'Topic id.' } } }
    },
    {
      name: 'open_issue',
      description: 'Open a PUBLIC GitHub issue in reihlinstinct/wa-link-generator with a new request or idea. Anyone can read it, so include no phone numbers, emails or personal data. Needs an MCP bearer token and is rate limited. Hosted endpoint only.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title, up to 120 characters.' },
          body: { type: 'string', description: 'Details of the request, up to 2000 characters. No personal data.' }
        },
        required: ['title', 'body']
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
    if (name === 'list_contacts') {
      return {
        contacts: CONTACTS.map(function (c) { return { id: c.id, name: c.name, role: c.role, basis: c.basis }; }),
        note: 'Built-in public contacts only. Contacts a user added in their own browser live only in that browser. Use the id as the contact argument of generate_whatsapp_link.'
      };
    }
    if (name === 'get_topic_guidance') {
      var gt = data.topics.filter(function (t) { return t.id === (a.topic || TOPICS[0]); })[0];
      if (!gt) throw new Error('Unknown topic');
      return { topic: gt.id, title: gt.title, guidance: gt.guidance || null, languages: LANGS };
    }
    if (name === 'open_issue') throw new Error('open_issue is available only on the hosted endpoint');
    if (name !== 'generate_whatsapp_link') throw new Error('Unknown tool');
    var lang = a.lang || 'he';
    if (LANGS.indexOf(lang) < 0) throw new Error('Unsupported lang');
    var topic = data.topics.filter(function (t) { return t.id === (a.topic || TOPICS[0]); })[0];
    if (!topic) throw new Error('Unknown topic');
    var phone = a.phone;
    var contact = null;
    if (a.contact) {
      contact = CONTACTS.filter(function (c) { return c.id === a.contact; })[0];
      if (!contact) throw new Error('Unknown contact');
      phone = contact.phone;
    }
    if (a.name !== undefined && a.name !== null && (typeof a.name !== 'string' || PII.test(a.name))) throw new Error('name must be text without phone numbers or emails');
    var name = a.name || (contact && contact.name[lang]);
    if (a.message !== undefined && a.message !== null) {
      if (typeof a.message !== 'string') throw new Error('message must be text');
      if (a.message.length > MAX_TEXT) throw new Error('message too long');
      if (PII.test(a.message)) throw new Error('message must not contain phone numbers or emails');
    }
    var text = a.message ? WA.clean(a.message) : WA.pickMessage(topic.languages[lang], { name: name, useName: a.use_name !== false });
    var link = WA.buildLink(phone, text);
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
        return res(msg.id, { protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'wa-link-generator', version: '1.2.0' } });
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
  // Validates open_issue arguments. Returns { title, body } or throws.
  function checkIssue(a) {
    a = a || {};
    var title = String(a.title || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    var body = String(a.body || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    if (!title || !body) throw new Error('title and body are required');
    if (title.length > 120) throw new Error('title too long');
    if (body.length > 2000) throw new Error('body too long');
    if (PII.test(title) || PII.test(body)) throw new Error('issue must not contain phone numbers or emails');
    return { title: title, body: body };
  }
  return { tools: tools, callTool: callTool, handle: handle, checkIssue: checkIssue };
};
module.exports.withPhones = withPhones;
