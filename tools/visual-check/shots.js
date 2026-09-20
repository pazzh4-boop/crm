const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const outDir = process.argv[2]; const base = process.argv[3] || 'http://127.0.0.1:8766/';
const vw = Number(process.argv[4]) || 1920, vh = Number(process.argv[5]) || 1032;
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const log = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) log.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Determinism: the app picks the order of pinned Being rows with Math.random(),
  // and the Reactivation card stamps the current time into its contact field.
  // Both are seeded/frozen here so two runs of the same build match pixel for pixel.
  await page.clock.setFixedTime(new Date('2026-09-19T12:00:00'));
  await page.addInitScript(() => {
    let seed = 0x2f6e2b1;
    Math.random = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 1e6) / 1e6;
    };
  });
  await page.addInitScript(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s)); });
  await page.goto(base, { waitUntil: 'load' });
  try { await page.waitForFunction(() => { const l = document.getElementById('appLoader'); return !l || l.hidden || getComputedStyle(l).display === 'none' || getComputedStyle(l).visibility === 'hidden' || getComputedStyle(l).opacity === '0'; }, null, { timeout: 20000 }); }
  catch (e) { log.push('[harness] loader did not finish: ' + e.message); }
  await sleep(600);
  // The browser decides on its own whether a focused control draws its
  // :focus-visible ring, so the same build photographs differently run to run.
  // Focus is dropped before each frame to keep screenshots comparable.
  const shot = async (name) => {
    await page.evaluate(() => { const el = document.activeElement; if (el && el.blur) el.blur(); });
    await sleep(250);
    await page.screenshot({ path: path.join(outDir, name + '.png'), fullPage: false });
  };
  const click = async (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
  await shot('00-menu');
  for (const p of ['yesterday', 'dashboard', 'clients', 'reactivation', 'being']) { await click(`.main-menu__button[data-page="${p}"]`); await sleep(500); await shot('10-' + p); }
  await click('.main-menu__button[data-page="being"]'); await sleep(400);
  if (await click('.being-row')) { await sleep(500); await shot('20-being-card'); }
  await page.keyboard.press('Escape'); await sleep(300);
  await click('.main-menu__button[data-page="reactivation"]'); await sleep(400);
  if (await click('.reactivation-row [data-reactivation-open]')) { await sleep(500); await shot('30-reactivation-card');
    const tools = await page.$$('[data-reactivation-work-tool]');
    for (let i = 0; i < tools.length; i++) { await page.evaluate((i) => document.querySelectorAll('[data-reactivation-work-tool]')[i].click(), i); await sleep(300); await shot(`31-reactivation-tool-${i}`); }
  }
  await page.keyboard.press('Escape'); await sleep(300);
  await click('.main-menu__button[data-page="clients"]'); await sleep(400);
  if (await click('.client-card')) { await sleep(500); await shot('40-client-profile');
    const periods = await page.$$('[data-profile-period]');
    for (let i = 0; i < periods.length; i++) { await page.evaluate((i) => document.querySelectorAll('[data-profile-period]')[i].click(), i); await sleep(200); await shot(`41-profile-period-${i}`); }
    const questBtn = await page.$('#profileQuestOpen, [data-profile-quest-open], .profile-quest-open, button.client-quest-open');
    if (questBtn) { await questBtn.evaluate(b => b.click()); await sleep(500); await shot('42-quest-detail'); }
  }
  fs.writeFileSync(path.join(outDir, 'console.log'), log.join('\n') + '\n');
  console.log('screens:', fs.readdirSync(outDir).filter(f => f.endsWith('.png')).length, 'console/page errors:', log.length);
  if (log.length) console.log(log.join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
