// Browser smoke tests for the modular frontend (COS-102). Runs against the local server in
// DEMO mode (no API keys, temp state) and against the built static Pages demo.
import {test, expect} from '@playwright/test';

const DEMO_URL = 'http://127.0.0.1:4199/index.html';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const pos = page => page.evaluate(() => ({x: window.__atlas.player.x, z: window.__atlas.player.z}));
async function ready(page) {
  await page.waitForFunction(() => window.__atlas && document.getElementById('modeBadge').textContent !== 'جارٍ التحقق');
}

test('game boots with a renderer and no console errors', async ({page}) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await ready(page);
  const kind = await page.evaluate(() => window.__atlas.renderer);
  expect(['webgl', 'canvas2d']).toContain(kind);
  await expect(page.locator('#modeBadge')).toHaveText('DEMO');
  expect(errors).toEqual([]);
});

test('walls block the player; doorway lets them through', async ({page}) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => window.__atlas.place(-11, 5));
  await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
  const blocked = await pos(page);
  expect(blocked.z).toBeGreaterThan(2.8); // stopped by the front partition
  await page.evaluate(() => window.__atlas.place(-7.05, 5));
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.__atlas.player.z < 1, null, {timeout: 8000}); // walked in through the door gap
  await page.keyboard.up('w');
});

test('cannot interact through a partition; E opens the office from inside', async ({page}) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => window.__atlas.place(-10, 3.4));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__atlas.nearby)).toBeNull();
  await expect(page.locator('#interactBtn')).toBeDisabled();
  await page.evaluate(() => window.__atlas.travel('manager'));
  await page.waitForFunction(() => window.__atlas.nearby === 'manager');
  await page.keyboard.press('e');
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#panelTitle')).toHaveText('مدير المشاريع التقنية');
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay')).toBeHidden();
});

test('manager DEMO draft → CEO approval → persists after reload', async ({page}) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => window.__atlas.travel('manager'));
  await page.waitForFunction(() => window.__atlas.nearby === 'manager');
  await page.locator('#interactBtn').click();
  await page.locator('#utterance').fill('أبي نطلق المنتج في أسبوع بدون اختبارات');
  await page.locator('#sendBtn').click();
  await expect(page.locator('#agentOutcome')).toContainText('محاكاة — ليس AI');
  await page.locator('#acceptCurrent').click();
  await expect(page.locator('#agentOutcome')).toContainText('تم الاعتماد');
  await page.reload();
  await ready(page);
  await page.evaluate(() => window.__atlas.travel('board'));
  await page.waitForFunction(() => window.__atlas.nearby === 'board');
  await page.locator('#interactBtn').click();
  await expect(page.locator('#tasksList')).toContainText('إعداد تعريف ونطاق المشروع');
});

test('C toggles the optional orbit camera', async ({page}) => {
  await page.goto('/');
  await ready(page);
  await page.keyboard.press('c');
  await expect(page.locator('body')).toHaveClass(/orbit-on/);
  await page.keyboard.press('c');
  await expect(page.locator('body')).not.toHaveClass(/orbit-on/);
});

test('static Pages demo runs the same game with scripted replies only', async ({page}) => {
  const errors = trackErrors(page);
  await page.goto(DEMO_URL);
  await ready(page);
  await expect(page.locator('#modeBadge')).toHaveText('STATIC DEMO');
  await page.evaluate(() => window.__atlas.travel('manager'));
  await page.waitForFunction(() => window.__atlas.nearby === 'manager');
  await page.keyboard.press('e');
  await page.locator('#utterance').fill('خطة لمشروع تطبيق مهام');
  await page.locator('#sendBtn').click();
  await expect(page.locator('#agentOutcome')).toContainText('محاكاة — ليس AI');
  expect(errors).toEqual([]);
});

test('@mobile on-screen controls move the player', async ({page, isMobile}) => {
  test.skip(!isMobile, 'mobile project only');
  await page.goto('/');
  await ready(page);
  const before = await pos(page);
  const up = page.locator('[data-move="w"]');
  await expect(up).toBeVisible();
  const box = await up.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
  expect((await pos(page)).z).toBeLessThan(before.z - 0.5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
