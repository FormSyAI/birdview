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
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'birdview-reader-tabs-'));
const file = path.join(output, 'reader.html');
fs.writeFileSync(file, renderArchitecture(map, events, {presentation:'reader', readerLanguage:'zh', readerTheme:'light'}));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);
  for (const theme of ['light','dark']) {
    await page.locator('html').evaluate((element, value) => { element.dataset.theme = value; }, theme);
    for (const language of ['zh','en']) {
      await page.locator('#language').selectOption(language);
      for (const width of [320,390,897,1440]) {
        await page.setViewportSize({width,height:900});
        const graph = page.locator('[data-view="architecture"]');
        const constraints = page.locator('#show-constraints');
        await graph.click();
        await page.waitForFunction(() => document.querySelector<HTMLElement>('#map')!.offsetWidth > 100);
        const node = page.locator(`[data-module="${present(map.modules[0]).id}"]`);
        await node.click();
        const selection = await node.getAttribute('aria-pressed');
        const history = await page.locator('#activity-step').inputValue();
        await page.locator('#actual').click();
        await page.locator('#zoom-in').click();
        const zoom = await page.locator('#zoom-value').innerText();
        assert.equal(await page.locator('.map-scroll').evaluate(element => getComputedStyle(element).backgroundImage), 'none');
        await constraints.scrollIntoViewIfNeeded();
        const tabTop = present(await constraints.boundingBox()).y + await page.evaluate(() => scrollY);
        await constraints.click();
        assert.equal(await constraints.getAttribute('role'),'tab');
        assert.equal(await constraints.getAttribute('aria-selected'),'true');
        assert.equal(await page.locator('#constraints-panel').isVisible(),true);
        assert.equal(await page.locator('#reader-graph-panel').isVisible(),false);
        assert.equal(await page.locator('aside').isVisible(),false);
        assert.ok(present(await page.locator('#constraints-panel').boundingBox()).y - present(await constraints.boundingBox()).y < 140,'constraints render directly below the tabs');
        assert.ok(Math.abs(present(await constraints.boundingBox()).y + await page.evaluate(() => scrollY) - tabTop) < 2,`switching does not jump to the bottom at ${width}/${language}/${theme}: ${tabTop} -> ${present(await constraints.boundingBox()).y + await page.evaluate(() => scrollY)}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const rule = page.locator('.constraint-row').first();
        if (await rule.getAttribute('aria-pressed') !== 'true') await rule.click();
        assert.equal(await page.locator('.constraint-detail').isVisible(),true);
        await page.screenshot({path:path.join(output,`constraints-${width}-${language}-${theme}.png`),fullPage:true});
        await graph.click();
        assert.equal(await node.getAttribute('aria-pressed'),selection);
        assert.equal(await page.locator('#activity-step').inputValue(),history);
        assert.equal(await page.locator('#zoom-value').innerText(),zoom);
        assert.equal(await page.locator('aside').isVisible(),true);
        await page.locator('#close-details').click();
        await graph.focus();
        await graph.press('End');
        assert.equal(await constraints.getAttribute('aria-selected'),'true');
        assert.equal(await constraints.evaluate(element => element === document.activeElement),true);
        await constraints.press('Home');
        assert.equal(await graph.getAttribute('aria-selected'),'true');
        assert.equal(await graph.evaluate(element => element === document.activeElement),true);
      }
    }
  }
  // A static map still exposes constraints, including an honest empty state.
  const empty = structuredClone(map); empty.constraints = [];
  fs.writeFileSync(path.join(output,'empty.html'),renderArchitecture(empty,[],{presentation:'reader',readerLanguage:'zh',readerTheme:'light'}));
  await page.goto(pathToFileURL(path.join(output,'empty.html')).href);
  await page.getByRole('tab',{name:'约束',exact:true}).click();
  assert.equal(await page.locator('.constraint-empty').innerText(),'已记录来源检查，但尚无整理后的架构规则；不代表没有约束。');
  assert.equal(await page.locator('[data-view="activity"]').isVisible(),false);
  await page.locator('#language').selectOption('en');
  assert.equal(await page.getByRole('tab',{name:'Constraints',exact:true}).getAttribute('aria-selected'),'true');
  assert.ok((await page.locator('.constraint-empty').innerText()).includes('does not mean there are no constraints'));
  assert.deepEqual(errors,[]);
  console.log(`Reader tabs passed: in-place constraints, plain background, retained graph/history/zoom, keyboard tabs, populated/empty/static maps, two languages and themes at 320/390/897/1440px. Screenshots: ${output}`);
} finally { await browser.close(); }
