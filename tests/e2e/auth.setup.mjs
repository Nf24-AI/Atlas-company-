// Creates the local CEO account through the real setup form once, then saves the session cookie
// for the browser projects (keeps the suite well under the auth rate limit).
import {test as setup, expect} from '@playwright/test';

const STATE = 'test-results/.auth-state.json';
const CEO = {email: 'ceo@atlas.test', password: 'correct horse battery'};

setup('CEO account setup through the UI', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#authForm')).toBeVisible();
  if (await page.locator('[name=displayName]').count()) {
    await page.fill('[name=displayName]', 'Nawaf');
    await page.fill('[name=email]', CEO.email);
    await page.fill('[name=password]', 'short');
    await page.click('#authForm button');
    await expect(page.locator('#authError')).not.toBeEmpty(); // password policy enforced server-side
    await page.fill('[name=password]', CEO.password);
  } else {
    await page.fill('[name=email]', CEO.email);
    await page.fill('[name=password]', CEO.password);
  }
  await page.click('#authForm button');
  await page.waitForFunction(() => window.__atlas?.ready);
  await page.context().storageState({path: STATE});
});
