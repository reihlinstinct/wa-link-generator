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
    assert.strictEqual(c.phone, undefined, c.id + ' must not hold its number in the repo');
    assert.ok(/^[a-z][a-z0-9-]*$/.test(c.phone_key || ''), c.id + ' needs phone_key');
    assert.ok(c.basis && c.basis.length > 10, c.id + ' needs a basis for being public');
    const oc = c.owner_confirmation;
    const hasSource = /^https:\/\/\S+$/.test(c.source || '');
    const hasOwner = oc && oc.permitted_for_publication === true && /^\d{4}-\d{2}-\d{2}$/.test(oc.date || '') && oc.by;
    assert.ok(hasSource || hasOwner, c.id + ' needs a source URL or an owner confirmation (by, date, permitted_for_publication)');
  }
});
test('no phone numbers anywhere in the repo (built-in numbers live in secrets)', () => {
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
  assert.deepStrictEqual(hits, []);
});
test('topic guidance has no invented facts: every fact needs a source URL', () => {
  for (const t of data.topics) {
    assert.ok(t.guidance && t.guidance.goal && t.guidance.stance, t.id);
    for (const f of t.guidance.facts) assert.ok(f.text && /^https:\/\//.test(f.source), t.id);
  }
});
