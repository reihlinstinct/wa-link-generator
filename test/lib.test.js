'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const WA = require('../lib.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/messages.json'), 'utf8'));
const i18n = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n/strings.json'), 'utf8'));
const LANGS = Object.keys(i18n.meta);

test('clean strips commas, periods and line breaks', () => {
  assert.strictEqual(WA.clean('a, b.\nc\r\nd\u060C e\u2026'), 'a b c d e');
});
test('normPhone normalizes Israeli and international numbers', () => {
  assert.strictEqual(WA.normPhone('050-123 4567'), '972501234567');
  assert.strictEqual(WA.normPhone('+972 50 123 4567'), '972501234567');
  assert.strictEqual(WA.normPhone('00972501234567'), '972501234567');
  assert.strictEqual(WA.normPhone('abc'), null);
  assert.strictEqual(WA.normPhone('123'), null);
});
test('buildLink encodes text and rejects bad input', () => {
  const l = WA.buildLink('0501234567', 'שלום, עולם.');
  assert.strictEqual(l, 'https://wa.me/972501234567?text=' + encodeURIComponent('שלום עולם'));
  assert.strictEqual(WA.buildLink('x', 'hi'), null);
  assert.strictEqual(WA.buildLink('0501234567', ' , . '), null);
});
test('buildLink resists injection via text and name', () => {
  const l = WA.buildLink('0501234567', '"><script>alert(1)</script>&x=1#');
  assert.ok(l.startsWith('https://wa.me/972501234567?text='));
  assert.ok(!/[<>"& #]/.test(l.slice('https://wa.me/972501234567?text='.length)));
  assert.strictEqual(WA.safeName('<b>x</b>\n'), 'bx/b');
});
test('every language has the same pool shape and clean strings', () => {
  for (const tp of data.topics) {
    for (const l of LANGS) {
      const L = tp.languages[l];
      assert.ok(L, 'missing ' + l);
      assert.ok(L.standalone.length >= 20 && L.cores.length >= 10 && L.closers.length >= 5 && L.greetings.length >= 3, l);
      for (const k of ['standalone', 'cores', 'closers', 'greetings']) {
        assert.strictEqual(L[k].length, tp.languages.he[k].length, l + ' ' + k);
        for (const s of L[k]) assert.strictEqual(WA.clean(s), s, 'not clean: ' + s);
      }
    }
  }
});
test('ui strings: same keys in every language', () => {
  const keys = Object.keys(i18n.strings.he).sort();
  for (const l of LANGS) assert.deepStrictEqual(Object.keys(i18n.strings[l]).sort(), keys, l);
});
test('no phone numbers or emails anywhere in data or strings', () => {
  const all = JSON.stringify(data) + JSON.stringify(i18n);
  assert.ok(!/\d{7,}/.test(all));
  assert.ok(!/@/.test(all));
});
test('pickMessage returns clean varied text', () => {
  const L = data.topics[0].languages.en;
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const m = WA.pickMessage(L, { name: 'Dana', useName: true });
    assert.strictEqual(WA.clean(m), m);
    seen.add(m);
  }
  assert.ok(seen.size > 100);
});
