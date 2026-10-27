import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { architecture, activity, present } from './fixtures.mjs';
import { renderArchitecture } from '../src/render.mjs';

const { chromium }: typeof import('playwright') = await import(process.env.BIRDVIEW_PLAYWRIGHT_PATH ? pathToFileURL(process.env.BIRDVIEW_PLAYWRIGHT_PATH).href : 'playwright');
const map = architecture(fs.readFileSync(new URL('../examples/system.architecture.json', import.meta.url), 'utf8'));
const first = present(map.modules[0]);
first.name = 'LongModuleWithoutBreaks'.repeat(5);
first.translations = {...first.translations, en: {...first.translations?.en, name: first.name}, zh: {...first.translations?.zh, name: '长节点：保留当前版本与分支并核对密集关系、审查结果和发布条件'.repeat(3)}};
const connected = new Set(map.relationships.map(relation => `${relation.from}:${relation.to}`));
for (const target of map.modules.slice(1)) {
  if (connected.has(`${first.id}:${target.id}`)) continue;
  map.relationships.push({...present(map.relationships[0]), id: `stress-${target.id}`, from: first.id, to: target.id, label: 'A long relationship description that remains readable in the module inspector', visibility: 'detail'});
}
const events = activity(fs.readFileSync(new URL('../examples/harness.activity.jsonl', import.meta.url), 'utf8'));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'birdview-reader-stress-'));
const file = path.join(output, 'reader.html');
fs.writeFileSync(file, renderArchitecture(map, events, {presentation: 'reader', readerLanguage: 'zh', readerTheme: 'dark'}));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const calls: Array<ScrollBehavior | undefined> = [];
    Object.assign(window, {__birdviewScrollBehaviors: calls});
    const original = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function(options?: ScrollToOptions | number, y?: number) {
      calls.push(typeof options === 'object' ? options.behavior : undefined);
      Reflect.apply(original, this, typeof options === 'number' ? [options, y ?? 0] : [options]);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);
  for (const language of ['zh', 'en']) {
    await page.locator('#language').selectOption(language);
    for (const width of [320, 390, 897, 1440]) {
      await page.setViewportSize({width, height: 844});
      await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector<HTMLElement>('#map')!.style.width) - Math.min(960, document.querySelector<HTMLElement>('.map-scroll')!.clientWidth - 16)) < 2);
      const layout = await page.locator('#nodes .node').evaluateAll(nodes => {
        const boxes = nodes.map(node => node.getBoundingClientRect());
        return {
          clippedTitles: nodes.filter(node => { const name = node.querySelector<HTMLElement>('strong')!; return name.scrollHeight > name.clientHeight + 1; }).length,
          titleBadgeOverlap: nodes.some(node => {
            const badge = node.querySelector<HTMLElement>('.hidden-relations')!;
            if (badge.hidden) return false;
            const a = node.querySelector('strong')!.getBoundingClientRect(), b = badge.getBoundingClientRect();
            return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          }),
          overlap: boxes.some((a, i) => boxes.slice(i + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
          overflow: document.documentElement.scrollWidth > innerWidth,
          zoom: document.querySelector('#zoom-value')?.textContent,
        };
      });
      assert.deepEqual(layout, {clippedTitles: 0, titleBadgeOverlap: false, overlap: false, overflow: false, zoom: '100%'});
    }
  }
  const node = page.locator(`[data-module="${first.id}"]`);
  await node.click();
  assert.equal(await page.locator('#module-name').innerText(), first.name);
  assert.equal(await page.locator('#relations li').count(), map.relationships.filter(relation => relation.from === first.id || relation.to === first.id).length);
  assert.equal(await page.locator('.edge-label.visible').count(), 0);
  await page.locator('#close-details').click();

  // Fullscreen comes from the real browser API, never a synthetic state flag.
  for (const preference of ['reduce', 'no-preference'] as const) {
    await page.emulateMedia({reducedMotion: preference});
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
    assert.equal(await page.locator('#fullscreen').innerText(), 'Exit fullscreen');
    assert.equal(await page.locator('#fullscreen').getAttribute('aria-pressed'), 'true');
    await page.locator('#nodes .node').last().scrollIntoViewIfNeeded();
    const control = await page.locator('#fullscreen').boundingBox();
    assert.ok(control && control.y >= 0 && control.y + control.height <= 844);
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => !document.fullscreenElement && document.querySelector('#fullscreen')?.getAttribute('aria-pressed') === 'false');
    // An external exit must update the same button and preserve a reading focus.
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.locator('#language').focus();
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForFunction(() => !document.fullscreenElement && document.querySelector('#fullscreen')?.getAttribute('aria-pressed') === 'false');
    assert.equal(await page.locator('#fullscreen').innerText(), 'Fullscreen');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'language');
    assert.equal(await node.getAttribute('aria-pressed'), 'true');
    await page.locator('#fit').click();
    assert.equal(await page.evaluate(() => (window as unknown as {__birdviewScrollBehaviors: ScrollBehavior[]}).__birdviewScrollBehaviors.at(-1)), preference === 'reduce' ? 'instant' : 'auto');
    assert.equal(await page.locator('.map-scroll').evaluate(node => node.scrollLeft), 0);
    await page.locator('#activity-disclosure > summary').click();
    assert.equal(await page.locator('#activity-details').isVisible(), true);
    await page.locator('#activity-disclosure > summary').click();
    assert.equal(await page.locator('#activity-details').isVisible(), false);
    await page.locator('[data-view="architecture"]').click();
    assert.equal(await page.locator('[data-view="architecture"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-view="activity"]').click();
    assert.equal(await page.locator('[data-view="activity"]').getAttribute('aria-pressed'), 'true');
  }
  const rejected = await browser.newPage();
  await rejected.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('fixture denial')); });
  await rejected.goto(pathToFileURL(file).href);
  await rejected.locator('#fullscreen').click();
  await rejected.locator('#fullscreen-status').waitFor({state: 'visible'});
  assert.equal(await rejected.evaluate(() => document.fullscreenElement), null);
  assert.equal(await rejected.locator('#fullscreen').getAttribute('aria-pressed'), 'false');
  assert.equal(await rejected.evaluate(() => document.activeElement?.id), 'fullscreen');
  assert.deepEqual(errors, []);
  console.log(`Reader stress passed: ${map.modules.length} nodes/${map.relationships.length} relations; long CJK/unbroken English titles at 320/390/897/1440px; real fullscreen entry/button/external exit, rejection, retained focus/selection and reduce/no-preference mode/disclosure controls. Native Escape is inspected separately in the supported browser.`);
} finally { await browser.close(); fs.rmSync(output, {recursive: true, force: true}); }
