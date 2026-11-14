'use strict';
const $ = id => document.getElementById(id);
const KEY = 'wa-contacts-v1';
// Strip commas, periods, line breaks (user rule for prefilled links).
const clean = t => t.replace(/[,.\u060C\u05F3\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
function normPhone(p) {
  let d = String(p).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '972' + d.slice(1);
  return /^\d{9,15}$/.test(d) ? d : null;
}
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
const save = c => localStorage.setItem(KEY, JSON.stringify(c));
let contacts = load(), data = {topics: []}, cur = '';
function importHash() {
  // #c=<name>:<number>;<name>:<number>  (fragment never reaches the server)
  const m = location.hash.match(/^#c=(.+)$/);
  if (!m) return;
  decodeURIComponent(m[1]).split(';').forEach(s => {
    const i = s.lastIndexOf(':');
    const name = s.slice(0, i).trim(), ph = normPhone(s.slice(i + 1));
    if (name && ph && !contacts.some(c => c.phone === ph)) contacts.push({name, phone: ph});
  });
  save(contacts);
  history.replaceState(null, '', location.pathname + location.search);
}
function fillContacts() {
  const s = $('contact'); s.textContent = '';
  if (!contacts.length) { s.add(new Option('אין אנשי קשר - הוסף למטה', '')); }
  contacts.forEach(c => s.add(new Option(c.name, c.phone)));
  update();
}
function update() {
  const phone = $('contact').value, text = clean($('msg').value);
  const go = $('go');
  if (phone && text) {
    go.href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
    go.setAttribute('aria-disabled', 'false');
  } else { go.href = '#'; go.setAttribute('aria-disabled', 'true'); }
}
function pick(i) { $('msg').value = data.topics[$('topic').value].messages[i]; update(); }
const rnd = a => a[Math.floor(Math.random() * a.length)];
function rand() {
  // Regenerate: fixed variants plus compose opener + core + closer.
  const t = data.topics[$('topic').value]; let out;
  do {
    out = (Math.random() < 0.25 || !t.cores)
      ? rnd(t.messages)
      : clean(rnd(t.openers) + ' ' + rnd(t.cores) + ' ' + rnd(t.closers));
  } while (out === $('msg').value);
  $('msg').value = out; update();
}
function fillTopic() {
  const m = data.topics[$('topic').value].messages, ol = $('all'); ol.textContent = '';
  m.forEach((t, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    li.append(t + ' '); b.type = 'button'; b.textContent = 'בחר';
    b.setAttribute('aria-label', 'בחר נוסח ' + (i + 1));
    b.onclick = () => { pick(i); $('msg').focus(); };
    li.append(b); ol.append(li);
  });
  rand();
}
$('add').onclick = () => {
  const n = $('cname').value.trim(), p = normPhone($('cphone').value);
  if (!n || !p) { $('status').textContent = 'שם או מספר לא תקינים'; return; }
  contacts.push({name: n, phone: p}); save(contacts); fillContacts();
  $('contact').value = p; update(); $('cname').value = $('cphone').value = '';
  $('status').textContent = 'איש הקשר נוסף';
};
$('remove').onclick = () => {
  contacts = contacts.filter(c => c.phone !== $('contact').value); save(contacts); fillContacts();
  $('status').textContent = 'איש הקשר נמחק';
};
$('share').onclick = () => {
  const c = contacts.find(c => c.phone === $('contact').value); if (!c) return;
  $('sharebox').textContent = location.origin + location.pathname + '#c=' + encodeURIComponent(c.name + ':' + c.phone);
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(clean($('msg').value)); $('status').textContent = 'הטקסט הועתק'; }
  catch (e) { $('msg').select(); $('status').textContent = 'סמן והעתק ידנית'; }
};
$('rand').onclick = rand;
$('msg').oninput = update; $('contact').onchange = update; $('topic').onchange = fillTopic;
$('go').addEventListener('click', e => { if ($('go').getAttribute('aria-disabled') === 'true') e.preventDefault(); });
fetch('data/messages.json').then(r => r.json()).then(j => {
  data.topics = [j];
  data.topics.forEach((t, i) => $('topic').add(new Option(t.topic, i)));
  importHash(); fillContacts(); fillTopic();
});
