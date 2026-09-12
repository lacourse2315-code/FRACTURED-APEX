import { expect, test } from '@playwright/test';

test.describe('PRD-02 character art replacement', () => {
  test('real character art assets load and replace procedural primary actors', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    for (const path of ['/art/riftwarden.svg', '/art/fracture-warden.svg']) {
      const response = await request.get(path);
      expect(response.ok()).toBeTruthy();
      expect(response.headers()['content-type']).toContain('image/svg+xml');
      expect(await response.text()).toContain('<path');
    }
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForFunction(() => !!window.__FA_DEBUG__);
    const visuals = await page.evaluate(() => window.__FA_DEBUG__?.visuals());
    expect(visuals?.renderer).toBe('sprite-combat-v2');
    expect(visuals?.hero).toBe(true);
    expect(visuals?.enemy).toBe(true);
  });

  for (const viewport of [
    { width: 844, height: 390 },
    { width: 932, height: 430 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
  ]) {
    test(`character art remains visible without breaking HUD at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('canvas')).toBeVisible();
      await page.waitForFunction(() => !!window.__FA_DEBUG__);
      const layout = await page.evaluate(() => window.__FA_DEBUG__?.layout());
      const visuals = await page.evaluate(() => window.__FA_DEBUG__?.visuals());
      expect(visuals?.hero).toBe(true);
      expect(visuals?.enemy).toBe(true);
      expect(layout).toBeDefined();
      expect(layout!.hud.left).toBeGreaterThanOrEqual(28);
      expect(layout!.hud.right).toBeLessThanOrEqual(layout!.width - 28);
    });
  }
});
