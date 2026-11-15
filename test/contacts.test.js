'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const contacts = JSON.parse(fs.readFileSync(path.join(root, 'data/contacts.json'), 'utf8')).contacts;
const i18n = JSON.parse(fs.readFileSync(path.join(root, 'i18n/strings.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/messages.json'), 'utf8'));

test('every built-in contact has names, roles in all languages and a stated basis', () => {
  for (const c of contacts) {
    for (const l of Object.keys(i18n.meta)) assert.ok(c.name[l] && c.role[l], c.id + ' ' + l);
    assert.ok(/^972\d{9}$/.test(c.phone), c.id);
    assert.ok(c.basis && c.basis.length > 10, c.id + ' needs a basis for being public');
  }
});
test('phone numbers live only in data/contacts.json and the generated worker', () => {
  const re = /(\+?972|\b05[0-9])[0-9 -]{7,}/;
  const skip = new Set(['.git', 'node_modules', 'test']);
  const hits = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(f.name)) continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p); else if (re.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(root, p));
    }
  })(root);
  assert.deepStrictEqual(hits.sort(), ['data/contacts.json', 'worker/index.mjs']);
});
test('topic guidance has no invented facts: every fact needs a source URL', () => {
  for (const t of data.topics) {
    assert.ok(t.guidance && t.guidance.goal && t.guidance.stance, t.id);
    for (const f of t.guidance.facts) assert.ok(f.text && /^https:\/\//.test(f.source), t.id);
  }
});
