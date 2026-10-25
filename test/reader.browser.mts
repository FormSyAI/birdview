import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { architecture, activity, present } from './fixtures.mjs';
import { renderArchitecture } from '../src/render.mjs';

const { chromium }: typeof import('playwright') = await import(process.env.BIRDVIEW_PLAYWRIGHT_PATH ? pathToFileURL(process.env.BIRDVIEW_PLAYWRIGHT_PATH).href : 'playwright');
const map = architecture(fs.readFileSync(new URL('../examples/system.architecture.json', import.meta.url), 'utf8'));
const events = activity(fs.readFileSync(new URL('../examples/harness.activity.jsonl', import.meta.url), 'utf8'));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'birdview-native-host-'));
const file = path.join(output, 'reader.html');
fs.writeFileSync(file, renderArchitecture(map, events, { presentation: 'reader', readerLanguage: 'zh', readerTheme: 'dark' }));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);
  for (const width of [320, 390, 897, 1440, 390]) {
    await page.setViewportSize({width, height:900});
    await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector<HTMLElement>('#map')!.style.width) - Math.min(960, document.querySelector<HTMLElement>('.map-scroll')!.clientWidth - 16)) < 2);
    assert.equal(await page.locator('#nodes .node').count(), map.modules.length);
    assert.equal(await page.locator('#connections .edge').count(), map.relationships.length);
    assert.equal(await page.locator('#reader-root').count(), 0);
    const layout = await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>('.map-scroll')!;
      const nodes = [...document.querySelectorAll<HTMLElement>('#nodes .node')].map(node => ({x:node.offsetLeft,y:node.offsetTop,w:node.offsetWidth,h:node.offsetHeight}));
      return {overflow:document.documentElement.scrollWidth > innerWidth,
        mapOverflow: viewport.scrollWidth > viewport.clientWidth + 1,
        overlaps:nodes.some((a,i) => nodes.slice(i+1).some(b => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y)),
        zoom:document.querySelector('#zoom-value')!.textContent};
    });
    assert.deepEqual(layout, {overflow:false,mapOverflow:false,overlaps:false,zoom:'100%'});
    assert.ok((await page.locator('#connections .edge').first().getAttribute('d'))?.startsWith('M'));
    const expansion = await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>('.map-scroll')!;
      const stage = document.querySelector<HTMLElement>('#map-stage')!;
      return {nestedScroll: viewport.scrollHeight > viewport.clientHeight + 1,
        allRows: viewport.clientHeight >= stage.offsetHeight,
        headerVisible: getComputedStyle(document.querySelector('body > header')!).display !== 'none'};
    });
    assert.deepEqual(expansion, {nestedScroll:false, allRows:true, headerVisible:false});
    assert.equal(await page.locator('#activity-targets').isVisible(), false);
    const summary = page.locator('#activity-disclosure > summary');
    const closedHeight = await page.locator('body').evaluate(node => node.getBoundingClientRect().height);
    await summary.click();
    assert.ok(await page.locator('body').evaluate(node => node.getBoundingClientRect().height) > closedHeight);
    assert.equal(await page.locator('#activity-targets').isVisible(), true);
    assert.ok(await page.locator('#activity-targets').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await summary.click();
    assert.equal(await page.locator('body').evaluate(node => node.getBoundingClientRect().height), closedHeight);
    await page.locator('#nodes .node').last().scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#nodes .node').last().isVisible());
  }
  await page.locator('#activity-step').selectOption('0');
  await page.locator('#activity-mode [data-view="architecture"]').click();
  await page.locator('#relation-view').selectOption('all');
  assert.equal(await page.locator('#connections .edge').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length), map.relationships.length);
  const module = present(map.modules[0]);
  await page.locator(`[data-module="${module.id}"]`).click();
  assert.equal(await page.locator('#responsibility').innerText(), module.translations?.zh?.responsibility ?? module.responsibility);
  assert.equal(await page.locator('aside').isVisible(), true);
  await page.locator('#close-details').click();
  assert.equal(await page.locator('aside').isVisible(), false);
  await page.locator('#language').selectOption('en');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.locator(`[data-module="${module.id}"]`).press('Enter');
  assert.equal(await page.locator('aside').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('Native graph host checks passed: full-height page, no nested canvas scrolling or duplicate header, complete wrapping targets on demand, nodes and routed edges retained, width reflow without text scaling or overlap, original activity/relationship controls, module inspector, keyboard, language and theme.');
} finally { await browser.close(); }
