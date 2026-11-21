// COS-110A browser tests: opt-in third-person mouse control. Pointer lock itself needs a real user gesture and
// is checked manually (see docs/cos-110a/REPORT.md); here mouse look goes through the same code path via
// `camera.lookBy`, and drag-to-look covers the no-pointer-lock fallback.
import {test, expect} from '@playwright/test';

const ready = page => page.waitForFunction(() => window.__atlas?.ready && window.__atlas.store.data, null, {timeout: 20_000});
const needs3D = async page => test.skip(await page.evaluate(() => window.__atlas.renderer) !== 'three', 'third-person needs WebGL (Canvas2D fallback hides it)');
const key = (page, type, code, k) => page.evaluate(([t, c, kk]) => window.dispatchEvent(new KeyboardEvent(t, {code: c, key: kk})), [type, code, k]);

test.describe('COS-110A third-person', () => {
  test.use({viewport: {width: 1280, height: 720}});

  test('F / button enter and leave; V goes to the overview; third-person is never restored on reload', async ({page}) => {
    await page.goto('/'); await ready(page); await needs3D(page);
    await key(page, 'keydown', 'KeyF', 'f');
    await expect.poll(() => page.evaluate(() => window.__atlas.camera.mode)).toBe('third');
    await expect(page.locator('#tpBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tpHint')).toBeVisible();
    await key(page, 'keydown', 'KeyV', 'v');
    await expect.poll(() => page.evaluate(() => window.__atlas.camera.mode)).toBe('overview');
    await page.click('#tpBtn');
    await expect.poll(() => page.evaluate(() => window.__atlas.camera.mode)).toBe('third');
    await page.reload(); await ready(page);
    expect(await page.evaluate(() => window.__atlas.camera.mode)).toBe('overview'); // last persisted classic view
    await page.click('#tpBtn'); await page.click('#tpBtn');
    await expect.poll(() => page.evaluate(() => window.__atlas.camera.mode)).toBe('follow');
    await expect(page.locator('#tpHint')).toBeHidden();
  });

  test('mouse look turns the view and W walks where the camera faces (Arabic layout too)', async ({page}) => {
    await page.goto('/'); await ready(page); await needs3D(page);
    await page.evaluate(() => { window.__atlas.place(6, 10); window.__atlas.camera.setMode('third'); });
    const yaw0 = await page.evaluate(() => window.__atlas.camera.view.yaw);
    await page.evaluate(() => window.__atlas.camera.lookBy(400, 0));
    const yaw1 = await page.evaluate(() => window.__atlas.camera.view.yaw);
    expect(yaw1).toBeLessThan(yaw0); // mouse right → yaw decreases → view turns right
    const p0 = await page.evaluate(() => ({...window.__atlas.player}));
    await key(page, 'keydown', 'KeyW', 'ص');
    await page.waitForFunction(([x, z]) => Math.hypot(window.__atlas.player.x - x, window.__atlas.player.z - z) > 1, [p0.x, p0.z], {timeout: 10_000});
    await key(page, 'keyup', 'KeyW', 'ص');
    const r = await page.evaluate(([x, z]) => { const p = window.__atlas.player, y = window.__atlas.camera.view.yaw, dx = p.x - x, dz = p.z - z, l = Math.hypot(dx, dz); return (dx * -Math.sin(y) + dz * -Math.cos(y)) / l; }, [p0.x, p0.z]);
    expect(r).toBeGreaterThan(.95); // moved along the camera's ground-projected forward
  });

  test('the camera stays inside the room when a wall is behind the player', async ({page}) => {
    await page.goto('/'); await ready(page); await needs3D(page);
    await page.evaluate(() => { window.__atlas.place(14, -8.4); window.__atlas.camera.setMode('third'); });
    // turn so the camera points back toward the south partition (yaw 0 = camera on +z)
    await page.evaluate(() => { const c = window.__atlas.camera; for (let i = 0; i < 50 && Math.abs(Math.atan2(Math.sin(c.view.yaw), Math.cos(c.view.yaw))) > .01; i++) { const y = Math.atan2(Math.sin(c.view.yaw), Math.cos(c.view.yaw)); c.lookBy(Math.max(-300, Math.min(300, y / .0022)), 0); } });
    await expect.poll(() => page.evaluate(() => window.__atlas.camera.eye.z), {timeout: 20_000}).toBeLessThan(-7.1);
    expect(await page.evaluate(() => window.__atlas.camera.obstructed)).toBe(true);
  });

  test('drag-to-look works without pointer lock; opening a panel stops movement and frees the mouse', async ({page}) => {
    await page.goto('/'); await ready(page); await needs3D(page);
    await page.evaluate(() => { window.__atlas.travel('qa'); window.__atlas.camera.setMode('third'); });
    const yaw0 = await page.evaluate(() => window.__atlas.camera.view.yaw);
    await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(760, 400, {steps: 6}); await page.mouse.up();
    expect(await page.evaluate(() => window.__atlas.camera.view.yaw)).not.toBeCloseTo(yaw0, 3);
    await page.waitForFunction(() => window.__atlas.nearby === 'qa');
    await key(page, 'keydown', 'KeyE', 'e');
    await expect(page.locator('#overlay')).toBeVisible();
    await key(page, 'keydown', 'KeyW', 'w');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__atlas.player.moving)).toBe(false);
    expect(await page.evaluate(() => window.__atlas.camera.locked)).toBe(false);
    await key(page, 'keyup', 'KeyW', 'w');
  });
});
