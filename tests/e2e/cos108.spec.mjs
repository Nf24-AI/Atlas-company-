// COS-108 browser tests: camera modes and reset, collapsible HUD (keyboard, mouse, touch, persistence),
// interaction with the HUD minimised, employee state fidelity, Canvas2D fallback parity, non-Latin
// keyboard layouts and the static demo's simulation label. Runs against the local DEMO server.
import {test, expect} from '@playwright/test';

const DEMO_URL = 'http://127.0.0.1:4199/index.html';
const IGNORED = /GPU stall|GL Driver Message|favicon/i;
const ready = page => page.waitForFunction(() => window.__atlas?.ready && window.__atlas.store.data, null, {timeout: 20_000});
/** Poses the store's REAL statuses should produce, computed with the app's own presence module. */
const expectedPoses = page => page.evaluate(async () => { const {presenceFor} = await import('/js/world/presence.js'); return Object.fromEntries(window.__atlas.store.data.employees.filter(e => e.kind === 'ai').map(e => [e.roleKey, presenceFor(e.status).pose])); });
const settle = page => page.waitForTimeout(1200); // camera easing
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
  return errors;
}

test.describe('COS-108 camera', () => {
  test.use({viewport: {width: 1280, height: 720}});

  test('close follow view by default; V toggles the overview; the choice survives reload', async ({page}) => {
    await page.goto('/'); await ready(page);
    expect(await page.evaluate(() => window.__atlas.camera.mode)).toBe('follow');
    await expect(page.locator('#camModeBtn')).toHaveAttribute('aria-pressed', 'false');
    await settle(page);
    const follow = await page.evaluate(() => window.__atlas.measure().playerPx);
    expect(follow).toBeGreaterThan(100); // was ~60 px before COS-108

    await page.keyboard.press('v');
    await expect(page.locator('#camModeBtn')).toHaveAttribute('aria-pressed', 'true');
    await settle(page);
    const overview = await page.evaluate(() => window.__atlas.measure().playerPx);
    expect(overview).toBeLessThan(follow / 2);

    await page.reload(); await ready(page);
    expect(await page.evaluate(() => window.__atlas.camera.mode)).toBe('overview');
    await page.click('#camModeBtn'); // the button works the same as V
    expect(await page.evaluate(() => window.__atlas.camera.mode)).toBe('follow');
  });

  test('the avatar stays centred and on screen; R resets zoom and orbit', async ({page}) => {
    await page.goto('/'); await ready(page); await settle(page);
    const m = await page.evaluate(() => window.__atlas.measure());
    expect(Math.abs(m.feet[0] - m.width / 2)).toBeLessThan(m.width * .1);
    expect(m.head[1]).toBeGreaterThan(90); // below the top bar
    expect(m.feet[1]).toBeLessThan(m.height - 80); // above the bottom bar

    await page.mouse.move(640, 400);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400); // wheel zoom works in follow mode too
    await page.keyboard.press('c');
    await page.mouse.down(); await page.mouse.move(820, 330, {steps: 6}); await page.mouse.up();
    const moved = await page.evaluate(() => window.__atlas.camera.target);
    expect(moved.distance).toBeGreaterThan(14);
    await page.keyboard.press('c');
    await page.keyboard.press('r');
    await expect.poll(() => page.evaluate(() => { const v = window.__atlas.camera.view, t = window.__atlas.camera.target; return Math.abs(v.distance - t.distance) < .05 && Math.abs(v.yaw - t.yaw) < .01; })).toBe(true);
    const back = await page.evaluate(() => window.__atlas.camera.target);
    expect(back.distance).toBeCloseTo(12.5, 5);
  });

  for (const mode of ['follow', 'overview']) {
    test(`W walks up the screen and walls still stop the player (${mode})`, async ({page}) => {
      await page.goto('/'); await ready(page);
      await page.evaluate(m => { window.__atlas.camera.setMode(m, {instant: true}); window.__atlas.place(0, 13); }, mode);
      await settle(page);
      const before = await page.evaluate(() => ({z: window.__atlas.player.z}));
      // Hold W until the player has walked 1 m (frame-rate independent: software WebGL can be slow),
      // then check the direction: "up the screen" = north in world space at the shared yaw.
      await page.keyboard.down('w');
      await page.waitForFunction(z0 => window.__atlas.player.z < z0 - 1, before.z, {timeout: 8000});
      await page.keyboard.up('w');
      const after = await page.evaluate(() => ({z: window.__atlas.player.z, x: window.__atlas.player.x}));
      expect(after.z).toBeLessThan(before.z - 1);
      expect(Math.abs(after.x)).toBeLessThan(.05);
      await page.evaluate(() => window.__atlas.place(14, -4.5));
      await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w');
      expect(await page.evaluate(() => window.__atlas.player.z)).toBeGreaterThan(-7);
    });
  }

  test('WASD and E work with a non-Latin (Arabic) keyboard layout', async ({page}) => {
    await page.goto('/'); await ready(page);
    await page.evaluate(() => window.__atlas.place(0, 13));
    const z0 = await page.evaluate(() => window.__atlas.player.z);
    // Arabic layout: physical W types "ص", physical E types "ث"
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ص', code: 'KeyW'})));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', {key: 'ص', code: 'KeyW'})));
    expect(await page.evaluate(() => window.__atlas.player.z)).toBeLessThan(z0 - .5);
    await page.evaluate(() => window.__atlas.travel('qa'));
    await page.waitForFunction(() => window.__atlas.nearby === 'qa');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ث', code: 'KeyE'})));
    await expect(page.locator('#overlay')).toBeVisible();
  });
});

test.describe('COS-108 HUD', () => {
  test.use({viewport: {width: 1280, height: 720}});

  test('roster and map start collapsed; T / M / buttons expand them; preference persists', async ({page}) => {
    await page.goto('/'); await ready(page);
    await expect(page.locator('#teamPanel')).toBeHidden();
    await expect(page.locator('#mapPanel')).toBeHidden();
    await expect(page.locator('#teamToggle')).toHaveAttribute('aria-expanded', 'false');
    // DEMO badge and the proximity prompt are never collapsed
    await expect(page.locator('#modeBadge')).toBeVisible();
    await expect(page.locator('#nearbyText')).toBeVisible();
    await expect(page.locator('#teamToggle .hud-dots i')).toHaveCount(4);

    await page.keyboard.press('t');
    await expect(page.locator('#teamPanel')).toBeVisible();
    await expect(page.locator('#teamToggle')).toHaveAttribute('aria-expanded', 'true');
    await page.click('#mapToggle');
    await expect(page.locator('#mapPanel')).toBeVisible();
    await expect(page.locator('#mapToggle')).toHaveAttribute('aria-expanded', 'true');

    await page.reload(); await ready(page);
    await expect(page.locator('#teamPanel')).toBeVisible();
    await expect(page.locator('#mapPanel')).toBeVisible();
    await page.keyboard.press('m');
    await expect(page.locator('#mapPanel')).toBeHidden();
    // roster travel still works from the expanded panel
    await page.locator('#staffList [data-go=manager]').click();
    await page.waitForFunction(() => window.__atlas.nearby === 'manager');
  });

  test('toggles are keyboard-focusable buttons (Enter / Space)', async ({page}) => {
    await page.goto('/'); await ready(page);
    await page.focus('#teamToggle');
    await page.keyboard.press('Enter');
    await expect(page.locator('#teamPanel')).toBeVisible();
    await page.focus('#mapToggle');
    await page.keyboard.press(' ');
    await expect(page.locator('#mapPanel')).toBeVisible();
  });

  test('E interaction and Esc work with every HUD panel collapsed, and the room cue updates', async ({page}) => {
    await page.goto('/'); await ready(page);
    await expect(page.locator('#roomChip')).toHaveText('الاستقبال');
    await page.evaluate(() => window.__atlas.travel('manager'));
    await page.waitForFunction(() => window.__atlas.nearby === 'manager');
    await expect(page.locator('#roomChip')).toHaveText('مدير المشاريع');
    await expect(page.locator('#roomBanner')).toHaveText('مدير المشاريع');
    await page.keyboard.press('e');
    await expect(page.locator('#overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#overlay')).toBeHidden();
  });

  test('mobile: HUD toggles work by touch @mobile', async ({page, isMobile}) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/'); await ready(page);
    await expect(page.locator('#teamPanel')).toBeHidden();
    await page.locator('#teamToggle').tap();
    await expect(page.locator('#teamPanel')).toBeVisible();
    await page.locator('#mapToggle').tap();
    await expect(page.locator('#mapPanel')).toBeVisible();
    await page.locator('#teamToggle').tap();
    await expect(page.locator('#teamPanel')).toBeHidden();
  });
});

test.describe('COS-108 employee presence', () => {
  test('poses follow the store: idle by default; executing types, approvals wait, blocked, unknown is neutral', async ({page}) => {
    await page.goto('/'); await ready(page);
    // Real DEMO data: the scene shows exactly what the store says, and only 'executing' types.
    const real = await expectedPoses(page);
    expect(Object.keys(real).sort()).toEqual(['developer', 'director', 'manager', 'qa']);
    await expect.poll(() => page.evaluate(() => window.__atlas.presence())).toEqual(real);
    const statuses = await page.evaluate(() => Object.fromEntries(window.__atlas.store.data.employees.map(e => [e.roleKey, e.status])));
    for (const [k, pose] of Object.entries(real)) if (pose === 'typing') expect(statuses[k]).toBe('executing');

    // Same API shape with different statuses (as the orchestrator would set them) → the scene must follow.
    await page.route('**/api/state', async route => {
      const res = await route.fetch(), d = await res.json();
      const set = {manager: 'executing', director: 'awaiting_approval', developer: 'blocked', qa: 'something-new'};
      for (const e of d.employees) if (set[e.roleKey]) e.status = set[e.roleKey];
      await route.fulfill({response: res, json: d});
    });
    await page.evaluate(() => window.__atlas.store.refresh());
    await expect.poll(() => page.evaluate(() => window.__atlas.presence())).toEqual({director: 'waiting', manager: 'typing', developer: 'blocked', qa: 'unknown'});
    await expect(page.locator('#teamToggle .hud-alert')).toBeVisible(); // a blocker is visible while the roster is collapsed
    await expect(page.locator('#teamToggle')).toHaveAttribute('data-blocked', '1');
    await page.evaluate(() => window.__atlas.travel('developer'));
    await expect(page.locator('#label-developer small')).toHaveText('متوقف');
    await expect(page.locator('#label-developer')).toHaveClass(/attention/);

    // Back to the real data after "refresh": the states come from the server, not a timer.
    await page.unroute('**/api/state');
    await page.reload(); await ready(page);
    await expect.poll(() => page.evaluate(() => window.__atlas.presence())).toEqual(await expectedPoses(page));
  });
});

test.describe('COS-108 Canvas2D fallback', () => {
  test('?canvas renders the same world with signs, presence, camera keys and E interaction, without errors', async ({page}) => {
    const errors = trackErrors(page);
    await page.goto('/?canvas'); await ready(page);
    expect(await page.evaluate(() => window.__atlas.renderer)).toBe('canvas2d');
    await expect.poll(() => page.evaluate(() => window.__atlas.presence())).toEqual(await expectedPoses(page));
    await page.keyboard.press('v'); await page.keyboard.press('r'); await page.keyboard.press('t');
    await expect(page.locator('#teamPanel')).toBeVisible();
    await page.evaluate(() => window.__atlas.travel('board'));
    await page.waitForFunction(() => window.__atlas.nearby === 'board');
    await page.keyboard.press('e');
    await expect(page.locator('#overlay')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('COS-108 static demo', () => {
  test.use({storageState: {cookies: [], origins: []}});
  test('office labels say the activity is simulated @mobile', async ({page}) => {
    await page.goto(DEMO_URL); await ready(page);
    await page.evaluate(() => window.__atlas.travel('manager'));
    await expect(page.locator('#label-manager small')).toContainText('محاكاة');
    await expect(page.locator('#modeBadge')).toHaveText('STATIC DEMO');
  });
});
