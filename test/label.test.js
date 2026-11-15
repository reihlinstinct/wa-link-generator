'use strict';
const test = require('node:test');
const assert = require('node:assert');
const WA = require('../lib.js');
const LANGS = ['he', 'en', 'ar', 'ru'];
const HEB = /[\u0590-\u05ff]/;

test('known contacts have a label in every language', () => {
  for (const name of Object.keys(WA.KNOWN)) {
    for (const l of LANGS) assert.ok(WA.KNOWN[name][l], name + ' missing ' + l);
  }
});
test('no Hebrew letters in non-Hebrew labels of known contacts', () => {
  for (const name of Object.keys(WA.KNOWN)) {
    for (const l of LANGS.filter((x) => x !== 'he')) {
      assert.ok(!HEB.test(WA.label(name, l)), name + ' still Hebrew in ' + l);
    }
  }
});
test('mayor is translated and user-added names fall back to the stored name', () => {
  assert.strictEqual(WA.label('ראש העיר', 'en'), 'Mayor');
  assert.strictEqual(WA.label('ראש העיר', 'he'), 'ראש העיר');
  assert.strictEqual(WA.label('Dana', 'ru'), 'Dana');
  assert.strictEqual(WA.label('דנה', 'en'), 'דנה');
});
test('greeting with a known contact uses the translated label', () => {
  const L = { standalone: ['x'], cores: ['core'], closers: ['end'], greetings: ['Hello'] };
  const rnd = () => 0.5;
  const out = WA.pickMessage(L, { name: 'ראש העיר', lang: 'en', useName: true }, rnd);
  assert.ok(out.includes('Mayor') && !HEB.test(out), out);
});
