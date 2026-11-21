// Browser e2e for the immersive office (COS-107) against the local server in DEMO mode
// (no API keys, temp data dir) and the static GitHub Pages demo.
import {test, expect} from '@playwright/test';

const DEMO_URL = 'http://127.0.0.1:4199/index.html';
const IGNORED = /GPU stall|GL Driver Message|favicon/i;

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
  return errors;
}
const pos = page => page.evaluate(() => ({x: window.__atlas.player.x, z: window.__atlas.player.z}));
const ready = page => page.waitForFunction(() => window.__atlas?.ready && window.__atlas.store.data, null, {timeout: 20_000});
const apiPost = (page, route, body = {}) => page.evaluate(([r, b]) => fetch(r, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)}).then(x => x.json()), [route, body]);
async function stateOf(page) { await page.evaluate(() => window.__atlas.store.refresh()); return page.evaluate(() => window.__atlas.store.data); }
async function enter(page, room) {
  await page.evaluate(r => window.__atlas.travel(r), room);
  await page.waitForFunction(r => window.__atlas.nearby === r, room);
  await page.keyboard.press('e');
  await expect(page.locator('#overlay')).toBeVisible();
}

test.describe('local server (DEMO mode)', () => {
  test('boots signed in with a 3D renderer, DEMO labels and no console errors @mobile', async ({page}) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await ready(page);
    expect(['three', 'webgl', 'canvas2d']).toContain(await page.evaluate(() => window.__atlas.renderer));
    await expect(page.locator('#modeBadge')).toHaveText('DEMO');
    await expect(page.locator('#staffList .staff-card')).toHaveCount(7);
    expect(errors).toEqual([]);
  });

  test('walls block the player; the PM office doorway lets them in', async ({page}) => {
    await page.goto('/'); await ready(page);
    await page.evaluate(() => window.__atlas.place(14, -4.5));
    await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
    expect((await pos(page)).z).toBeGreaterThan(-7); // stopped by the office front wall
    await page.evaluate(() => window.__atlas.place(17, -4.5));
    await page.keyboard.down('w');
    await page.waitForFunction(() => window.__atlas.player.z < -8, null, {timeout: 8000});
    await page.keyboard.up('w');
  });

  test('no interaction through a wall; E opens the office from inside; Esc closes', async ({page}) => {
    await page.goto('/'); await ready(page);
    await page.evaluate(() => window.__atlas.place(14.5, -6.5));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__atlas.nearby)).not.toBe('manager');
    await enter(page, 'manager');
    await expect(page.locator('#panelTitle')).toHaveText('مدير المشاريع');
    await expect(page.locator('#empHeader .tag.demo')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#overlay')).toBeHidden();
  });

  test('text meeting with the Manager is answered, labelled DEMO and persisted', async ({page}) => {
    await page.goto('/'); await ready(page);
    await enter(page, 'manager');
    await page.fill('#utterance', 'أبي نطلق المنتج في أسبوع بدون اختبارات');
    await page.click('#sendBtn');
    await expect(page.locator('#agentOutcome')).toBeVisible();
    await expect(page.locator('#agentOutcome')).toContainText('DEMO');
    await expect(page.locator('#agentOutcome')).toContainText('اعتراض');
    await page.reload(); await ready(page);
    const st = await stateOf(page);
    expect(st.meetings.some(m => m.ceoInput.includes('بدون اختبارات'))).toBe(true);
  });

  test('acceptance flow in the browser: project → plan → CEO approvals → sandbox execution → QA → merge', async ({page}) => {
    test.setTimeout(150_000);
    await page.goto('/'); await ready(page);
    // the e2e server is shared across browsers: close any project left by a previous browser run
    for (const p of (await stateOf(page)).projects) if (!['completed', 'cancelled'].includes(p.status)) await apiPost(page, `/api/projects/${p.id}/cancel`);
    await page.evaluate(() => window.__atlas.store.refresh());

    await enter(page, 'manager');
    await page.fill('form[data-form=project] [name=name]', 'فلتر المهام المتأخرة');
    await page.fill('form[data-form=project] [name=objective]', 'نريد إضافة فلتر للمهام المتأخرة في مكتبة المهام مع اختبارات كاملة');
    await page.click('form[data-form=project] button[type=submit]');
    await expect(page.locator('#roleSection [data-act=approve-plan]')).toBeVisible({timeout: 30_000});
    await expect(page.locator('#roleSection')).toContainText('overdueTasks');
    await page.click('#roleSection [data-act=approve-plan]');
    await expect(page.locator('#roleSection [data-act=approve-plan]')).toBeHidden();
    await page.keyboard.press('Escape');

    // CEO workspace: Technical Director reviews the escalated decision, then the CEO decides
    await enter(page, 'ceo');
    await page.click('[data-act=tab][data-id=approvals]');
    // planning already queues the Director's review of escalations; request it only if it has not run
    if (await page.locator('[data-act=review]').count()) await page.locator('[data-act=review]').first().click();
    await expect(page.locator('.ws-body .feed-item:has([data-act=decide]) .tag.demo').first()).toBeVisible({timeout: 30_000});
    await page.locator('[data-act=decide][data-approve="1"]').first().click();
    await page.keyboard.press('Escape');

    // Developer executes in the sandbox; QA rejects attempt 1 on a real failing test; rework passes
    await enter(page, 'developer');
    await page.click('#roleSection [data-act=execute]');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await stateOf(page)).approvals.some(a => a.action === 'pr.merge' && a.status === 'pending'), {timeout: 120_000, intervals: [1500]}).toBe(true);
    const st = await stateOf(page);
    const merge = st.approvals.find(a => a.action === 'pr.merge' && a.status === 'pending');
    const detail = await page.evaluate(id => fetch(`/api/tasks/${id}`).then(r => r.json()), merge.targetId);
    expect(detail.deliverables.filter(d => d.kind === 'qa_report').map(d => d.evidence.verdict).sort()).toEqual(['fail', 'pass']);

    // CEO reviews evidence and approves the merge
    await enter(page, 'ceo');
    await page.click('[data-act=tab][data-id=approvals]');
    await page.locator('[data-act=approval][data-approve="1"]').first().click();
    await expect.poll(async () => (await stateOf(page)).tasks.some(t => t.status === 'done'), {timeout: 30_000}).toBe(true);
    await page.click('[data-act=tab][data-id=employees]');
    await expect(page.locator('.ws-body')).toContainText('system');
  });

  test('emergency stop halts agents and is visible; resume restores', async ({page}) => {
    await page.goto('/'); await ready(page);
    await enter(page, 'board');
    await page.click('[data-act=stop]');
    await expect(page.locator('#haltBadge')).toBeVisible();
    await page.click('[data-act=resume]');
    await expect(page.locator('#haltBadge')).toBeHidden();
  });

  test('English interface toggle switches direction and labels', async ({page}) => {
    await page.goto('/'); await ready(page);
    await page.click('#langBtn');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#sideTitle')).toHaveText('Your team');
    await page.click('#langBtn');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('mobile: on-screen controls move the player and the interact button opens the office @mobile', async ({page, isMobile}) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/'); await ready(page);
    const before = await pos(page);
    const up = page.locator('[data-move=w]');
    await up.dispatchEvent('pointerdown', {pointerId: 1});
    await page.waitForTimeout(700);
    await up.dispatchEvent('pointerup', {pointerId: 1});
    expect((await pos(page)).z).not.toBe(before.z);
    await page.evaluate(() => window.__atlas.travel('qa'));
    await expect(page.locator('#mobileInteract')).toBeVisible();
    await page.locator('#mobileInteract').tap();
    await expect(page.locator('#overlay')).toBeVisible();
  });
});

test.describe('static GitHub Pages demo', () => {
  test.use({storageState: {cookies: [], origins: []}});
  test('runs without a server, labelled STATIC DEMO, simulated loop, no external requests @mobile', async ({page}) => {
    const errors = trackErrors(page);
    const external = [];
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4199/') && !r.url().startsWith('data:')) external.push(r.url()); });
    await page.goto(DEMO_URL); await ready(page);
    await expect(page.locator('#modeBadge')).toHaveText('STATIC DEMO');
    await expect(page.locator('#modeHelp')).toContainText(/محاكاة|simulation/);
    await page.evaluate(() => window.__atlas.panels.open('manager'));
    await page.fill('#utterance', 'نحتاج خطة لفلتر المهام');
    await page.click('#sendBtn');
    await expect(page.locator('#agentOutcome')).toContainText('DEMO');
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });
});
