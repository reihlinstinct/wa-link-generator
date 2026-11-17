'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'wa-contacts-v1', LKEY = 'wa-lang-v1', MAX_CONTACTS = 30;
  var WORKER = 'https://wa-link-generator.reihlinstinct.workers.dev';
  var contacts = [], builtin = [], data, i18n, lang = 'he';
  function load() { try { var c = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(c) ? c : []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(contacts)); } catch (e) { /* storage unavailable */ } }
  function t(k) { return i18n.strings[lang][k] || i18n.strings.he[k] || ''; }
  function say(k) { $('status').textContent = t(k); }
  function applyLang() {
    var m = i18n.meta[lang];
    document.documentElement.lang = lang; document.documentElement.dir = m.dir;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.title = t('title');
    var keep = $('topic').value || '0'; $('topic').textContent = '';
    data.topics.forEach(function (tp, i) { var o = new Option(tp.title[lang], i); o.lang = lang; $('topic').add(o); });
    $('topic').value = keep;
    fillContacts();
  }
  function importHash() {
    var m = location.hash.match(/^#c=(.+)$/); if (!m) return;
    var raw; try { raw = decodeURIComponent(m[1]); } catch (e) { return; }
    raw.split(';').slice(0, MAX_CONTACTS).forEach(function (s) {
      var i = s.lastIndexOf(':'), name = WA.safeName(s.slice(0, i)), ph = WA.normPhone(s.slice(i + 1));
      if (name && ph && contacts.length < MAX_CONTACTS && !contacts.some(function (c) { return c.phone === ph; })) contacts.push({ name: name, phone: ph });
    });
    save(); history.replaceState(null, '', location.pathname + location.search);
  }
  function fillContacts() {
    var s = $('contact'), keep = s.value; s.textContent = '';
    if (!contacts.length && !builtin.length) s.add(new Option(t('noContacts'), ''));
    builtin.concat(contacts).forEach(function (c) { s.add(new Option(WA.label(c.name, lang), c.phone)); });
    if (keep) s.value = keep;
    $('remove').disabled = isBuiltin(s.value);
    regen();
  }
  function isBuiltin(ph) { return builtin.some(function (c) { return c.phone === ph; }); }
  function cur() { return builtin.concat(contacts).find(function (c) { return c.phone === $('contact').value; }); }
  // Built-in contacts come from the Worker (the numbers live in a Worker secret, not in this repo or page).
  // They are shown, never saved to this browser, and the page works without them if the request fails.
  function loadBuiltin() {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, to = ctl && setTimeout(function () { ctl.abort(); }, 5000);
    return fetch(WORKER + '/contacts', ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.ok ? r.json() : { contacts: [] }; }).then(function (j) {
      builtin = (j.contacts || []).slice(0, 10).map(function (c) { return { name: WA.safeName(c.name && c.name.he), phone: WA.normPhone(c.phone) }; }).filter(function (c) { return c.name && c.phone; });
    }).catch(function () { builtin = []; }).then(function () { if (to) clearTimeout(to); });
  }
  function update() {
    var link = WA.buildLink($('contact').value, $('msg').value), go = $('go');
    if (link) { go.href = link; go.setAttribute('aria-disabled', 'false'); }
    else { go.removeAttribute('href'); go.setAttribute('aria-disabled', 'true'); }
  }
  function regen() {
    var L = data.topics[$('topic').value || 0].languages[lang], c = cur();
    $('msg').lang = lang; $('msg').dir = i18n.meta[lang].dir;
    $('msg').value = WA.pickMessage(L, { name: c && c.name, lang: lang, useName: $('usename').checked, prev: $('msg').value });
    update();
  }
  $('add').onclick = function () {
    var n = WA.safeName($('cname').value), p = WA.normPhone($('cphone').value);
    if (!n || !p || contacts.length >= MAX_CONTACTS) return say('invalid');
    contacts.push({ name: n, phone: p }); save(); fillContacts();
    $('contact').value = p; regen(); $('cname').value = ''; $('cphone').value = ''; say('added');
  };
  $('remove').onclick = function () {
    contacts = contacts.filter(function (c) { return c.phone !== $('contact').value; }); save(); fillContacts(); say('removed');
  };
  $('share').onclick = function () {
    var c = cur(); if (!c) return;
    $('sharebox').textContent = location.origin + location.pathname + '#c=' + encodeURIComponent(c.name + ':' + c.phone);
  };
  $('copy').onclick = function () {
    var txt = WA.clean($('msg').value);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { say('copied'); }, function () { $('msg').select(); say('copyManual'); });
  };
  $('rand').onclick = regen;
  $('msg').oninput = update; $('contact').onchange = function () { $('remove').disabled = isBuiltin($('contact').value); regen(); }; $('topic').onchange = regen; $('usename').onchange = regen;
  $('go').addEventListener('click', function (e) { if ($('go').getAttribute('aria-disabled') === 'true') e.preventDefault(); });
  $('lang').onchange = function () { lang = $('lang').value; try { localStorage.setItem(LKEY, lang); } catch (e) { /* ignore */ } applyLang(); };
  Promise.all([fetch('data/messages.json').then(function (r) { return r.json(); }), fetch('i18n/strings.json').then(function (r) { return r.json(); })]).then(function (r) {
    data = r[0]; i18n = r[1]; contacts = load();
    Object.keys(i18n.meta).forEach(function (k) { var o = new Option(i18n.meta[k].name, k); o.lang = k; $('lang').add(o); });
    var saved = null; try { saved = localStorage.getItem(LKEY); } catch (e) { /* ignore */ }
    var nav = (navigator.language || 'he').slice(0, 2);
    lang = i18n.meta[saved] ? saved : (i18n.meta[nav] ? nav : 'he'); $('lang').value = lang;
    importHash(); applyLang();
    loadBuiltin().then(function () { if (builtin.length) { var first = !$('contact').value; fillContacts(); if (first && builtin[0]) { $('contact').value = builtin[0].phone; regen(); } } });
  });
})();
