const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [a, b] = [process.argv[2], process.argv[3]];
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const names = fs.readdirSync(a).filter(f => f.endsWith('.png'));
  let worst = 0;
  for (const n of names) {
    if (!fs.existsSync(path.join(b, n))) { console.log(n.padEnd(34), 'MISSING in after'); worst = 100; continue; }
    const A = 'data:image/png;base64,' + fs.readFileSync(path.join(a, n)).toString('base64');
    const B = 'data:image/png;base64,' + fs.readFileSync(path.join(b, n)).toString('base64');
    const r = await page.evaluate(async ([A, B]) => {
      const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
      const cv = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const da = cv(ia), db = cv(ib); let diff = 0;
      for (let i = 0; i < da.length; i += 4) { if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i+1] - db[i+1]) > 8 || Math.abs(da[i+2] - db[i+2]) > 8) diff++; }
      return { pct: (100 * diff / (w * h)), sizeSame: ia.width === ib.width && ia.height === ib.height };
    }, [A, B]);
    worst = Math.max(worst, r.pct);
    console.log(n.padEnd(34), r.pct.toFixed(3) + '%', r.sizeSame ? '' : '(size differs)');
  }
  console.log('worst:', worst.toFixed(3) + '%');
  await browser.close();
})();
