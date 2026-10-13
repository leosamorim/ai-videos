import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/util.mjs';

test('real SVG/CSS motion has continuous intermediate poses and identical arbitrary seeks', {
  skip: process.env.HF_RENDER_SMOKE !== '1', timeout: 120000,
}, async () => {
  const require = createRequire(import.meta.url);
  const { default: puppeteer } = await import('puppeteer-core');
  // Use the browser selected by the pinned engine; no new browser dependency.
  const executablePath = execFileSync(process.execPath, [join(ROOT, 'scripts/hf.mjs'), 'browser', 'path'], { encoding: 'utf8' }).trim();
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const makePage = async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 300 });
    await page.setContent(`<style>body{margin:0;background:#111;color:white}#button{position:absolute;left:30px;top:30px;width:200px;height:70px;background:#253c31}#label,#done{position:absolute;left:20px;top:20px}#done,#cursor{opacity:0}#cursor{position:absolute;left:150px;top:40px;width:15px;height:15px;background:white}</style>
      <div id="button"><span id="label">Follow</span><span id="done">Following</span><div id="cursor"></div></div>
      <svg width="400" height="100" style="position:absolute;top:150px"><path id="line" d="M20 50 L380 50" fill="none" stroke="white" stroke-width="4" pathLength="1"/></svg>`);
    await page.addScriptTag({ path: require.resolve('gsap/dist/gsap.min.js') });
    await page.addScriptTag({ path: join(ROOT, 'templates/components/motion.js') });
    await page.evaluate(() => {
      window.tl = gsap.timeline({ paused: true });
      VidMotion.enter(tl, '#button', { id: 'entry', start: 0.1, duration: 0.3 });
      VidMotion.draw(tl, '#line', { id: 'line', start: 0.2, duration: 0.6, length: 1 });
      VidMotion.click(tl, { button: '#button', cursor: '#cursor', label: '#label', doneLabel: '#done' }, { id: 'click', hit: 1.5, duration: 1 });
      tl.set({}, {}, 2.4);
    });
    return page;
  };
  const pose = (page, time) => page.evaluate((t) => {
    tl.seek(t);
    return Object.fromEntries(['button', 'cursor', 'label', 'done', 'line'].map((id) => {
      const s = getComputedStyle(document.getElementById(id));
      return [id, { transform: s.transform, opacity: s.opacity, visibility: s.visibility, dash: s.strokeDashoffset }];
    }));
  }, time);
  try {
    const page = await makePage();
    const offsets = [];
    for (const time of [0.3, 0.4, 0.5, 0.6, 0.7]) offsets.push(parseFloat((await pose(page, time)).line.dash));
    assert.ok(offsets.every((v, i) => v > 0 && v < 1 && (i === 0 || v < offsets[i - 1])), String(offsets));
    // Crossing states in both directions must match a fresh, direct seek and its pixels.
    for (const t of [2.4, 0, 1.62, 0.4, 1.5, 0.199, 0.8, 2, 1.49]) {
      const fresh = await makePage();
      try {
        assert.deepEqual(await pose(page, t), await pose(fresh, t), `state at ${t}`);
        assert.deepEqual(await page.screenshot(), await fresh.screenshot(), `pixels at ${t}`);
      } finally { await fresh.close(); }
    }
  } finally { await browser.close(); }
});
