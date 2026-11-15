(function (root) {
  'use strict';
  var DEFAULT_COUNTRY = '972';
  // Prefilled text never contains commas, periods, ellipsis or line breaks.
  var STRIP = /[,.\u060C\u06D4\u2026\u2028\u2029\r\n]+/g;
  function clean(t) {
    return String(t).replace(STRIP, ' ').replace(/\s+/g, ' ').trim();
  }
  function normPhone(p) {
    var d = String(p).replace(/[^\d+]/g, '');
    if (d.charAt(0) === '+') d = d.slice(1);
    else if (d.slice(0, 2) === '00') d = d.slice(2);
    else if (d.charAt(0) === '0') d = DEFAULT_COUNTRY + d.slice(1);
    return /^[1-9]\d{8,14}$/.test(d) ? d : null;
  }
  function buildLink(phone, text) {
    var p = normPhone(phone), t = clean(text);
    if (!p || !t) return null;
    return 'https://wa.me/' + p + '?text=' + encodeURIComponent(t);
  }
  function safeName(n) {
    return String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 40);
  }
  // Display labels for well-known contacts, keyed by the stored (Hebrew) name.
  // User-added contacts have no entry and keep their stored name.
  var KNOWN = {
    'ראש העיר': { he: 'ראש העיר', en: 'Mayor', ar: 'رئيس البلدية', ru: 'Мэр' }
  };
  function label(name, lang) {
    var k = KNOWN[safeName(name)];
    return (k && k[lang]) || safeName(name);
  }
  function pick(a, rnd) { return a[Math.floor(rnd() * a.length)]; }
  // L: {standalone, cores, closers, greetings}. Returns a cleaned wording.
  function pickMessage(L, opts, rnd) {
    opts = opts || {}; rnd = rnd || Math.random;
    var out, tries = 0;
    do {
      var text;
      if (rnd() < 0.3) text = pick(L.standalone, rnd);
      else text = pick(L.cores, rnd) + ' ' + pick(L.closers, rnd);
      var name = opts.lang ? label(opts.name, opts.lang) : safeName(opts.name);
      if (opts.useName && name && rnd() < 0.6) text = pick(L.greetings, rnd) + ' ' + name + ' ' + text;
      out = clean(text);
      tries++;
    } while (out === opts.prev && tries < 25);
    return out;
  }
  var api = { clean: clean, normPhone: normPhone, buildLink: buildLink, safeName: safeName, label: label, KNOWN: KNOWN, pickMessage: pickMessage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WA = api;
})(typeof self !== 'undefined' ? self : this);
