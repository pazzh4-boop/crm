// Behaviour check against the mock bridge: every path that writes to the sheet
// must actually send its request, and nothing may throw along the way.
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8766/';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { (ok ? pass++ : fail++); console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1032 } });
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('request', r => {
    if (!/being-api|crm-control/.test(r.url())) return;
    let body = null; try { body = r.postData(); } catch {}
    requests.push({ method: r.method(), url: r.url(), body, startedAt: Date.now() });
  });
  const responses = [];
  page.on('response', r => {
    if (!/being-api/.test(r.url())) return;
    responses.push({ url: r.url(), doneAt: Date.now() });
  });
  const sent = (pred) => requests.some(pred);
  const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
  const open = async (p) => { await click(`.main-menu__button[data-page="${p}"]`); await sleep(500); };

  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => { const l = document.getElementById('appLoader'); return !l || getComputedStyle(l).opacity === '0' || getComputedStyle(l).display === 'none'; }, null, { timeout: 20000 });
  await sleep(600);

  check('startup requests getClients', sent(r => /action=getClients/.test(r.url)));
  check('startup requests getReactivation', sent(r => /action=getReactivation/.test(r.url)));
  // Sequential loading would start the second request only after the first
  // one came back; parallel loading starts it before that.
  const clientsDone = responses.find(r => /action=getClients/.test(r.url))?.doneAt;
  const reactStart = requests.find(r => /action=getReactivation/.test(r.url))?.startedAt;
  check('startup starts getReactivation before getClients resolves (parallel)',
    Number.isFinite(clientsDone) && Number.isFinite(reactStart) && reactStart <= clientsDone,
    Number.isFinite(clientsDone) && Number.isFinite(reactStart) ? `${reactStart - clientsDone}ms relative to the getClients response` : 'requests not seen');

  // (a) note saved from the Being card
  await open('being');
  const rows = await page.evaluate(() => document.querySelectorAll('.being-row').length);
  check('Being list renders rows', rows > 0, `${rows} rows`);
  await click('.being-row'); await sleep(500);
  check('Being card opens', await page.evaluate(() => document.querySelector('.being-card-overlay')?.classList.contains('is-open')));
  await page.evaluate(() => {
    const t = document.getElementById('beingNoteText'); t.value = 'harness note';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('#beingNoteSave'); await sleep(900);
  check('(a) note save posts updateClient', sent(r => r.method === 'POST' && /being-api/.test(r.url) && /"action":"updateClient"/.test(r.body || '') && /harness note/.test(r.body || '')));

  // (c) dates and pin from the card
  await page.evaluate(() => { const d = document.getElementById('beingCardFollowUp'); d.value = '2026-10-01'; d.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(900);
  check('(c) follow-up change posts updateClient', sent(r => /"followUpDate":"2026-10-01"/.test(r.body || '')));
  const before = requests.length;
  await click('#beingCardPin'); await sleep(900);
  check('(c) pin uses GET updatePinned', requests.slice(before).some(r => r.method === 'GET' && /action=updatePinned/.test(r.url)));
  await page.keyboard.press('Escape'); await sleep(400);

  // (b) contact + undo in Reactivation, (d) search
  await open('reactivation');
  const rrows = await page.evaluate(() => document.querySelectorAll('.reactivation-row').length);
  check('Reactivation list renders rows', rrows > 0, `${rrows} rows`);
  await click('.reactivation-row [data-reactivation-contact="email"]'); await sleep(900);
  check('(b) Email posts contact:add', sent(r => /"action":"contact:add"/.test(r.body || '')));
  await click('.reactivation-row [data-reactivation-undo-type="email"]'); await sleep(900);
  check('(b) Undo posts contact:undo', sent(r => /"action":"contact:undo"/.test(r.body || '')));
  await page.evaluate(() => { const s = document.getElementById('reactivationSearch'); s.value = 'boris'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(500);
  const filtered = await page.evaluate(() => document.querySelectorAll('.reactivation-row').length);
  check('(d) search filters the list', filtered === 1, `${filtered} row(s) for "boris"`);
  await page.evaluate(() => { const s = document.getElementById('reactivationSearch'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(400);
  check('(d) clearing search restores the list', await page.evaluate(() => document.querySelectorAll('.reactivation-row').length) === rrows);

  // card: COMM note and offer
  await click('.reactivation-row [data-reactivation-open]'); await sleep(600);
  await page.evaluate(() => { const t = document.getElementById('reactivationNoteText'); t.value = 'harness comm'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('#reactivationNoteSave'); await sleep(900);
  check('COMM note posts comm:update', sent(r => /"action":"comm:update"/.test(r.body || '')));
  await click('#reactivationToolOffer'); await sleep(400);
  await page.evaluate(() => { const i = document.getElementById('reactivationOfferBd'); i.value = '6.5'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('#reactivationOfferSave'); await sleep(900);
  check('offer save posts plan:update', sent(r => /"action":"plan:update"/.test(r.body || '')));
  await page.keyboard.press('Escape'); await sleep(400);

  // quest editor stays responsive
  await open('clients');
  await click('.client-card'); await sleep(500);
  await click('#profileQuestOpen'); await sleep(500);
  check('quest view opens', await page.evaluate(() => !document.getElementById('clientQuestView')?.hidden));

  // (e) heartbeat and Save & Exit
  check('(e) heartbeat pings /crm-control', sent(r => /crm-control/.test(r.url)));
  await click('#appExitButton'); await sleep(1500);
  check('(e) Save & Exit posts shutdown', sent(r => /crm-control/.test(r.url) && /"action":"shutdown"/.test(r.body || '')));

  const real = errors.filter(e => !/ERR_CERT_AUTHORITY_INVALID/.test(e));
  check('no page or console errors', real.length === 0, real.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
