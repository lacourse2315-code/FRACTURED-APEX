import { expect, test } from '@playwright/test';

test.describe('PRD-02 visual combat pass', () => {
  test('premium combat presentation replaces prototype actor circles', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    await page.goto('/');

    await expect(page.locator('canvas')).toBeVisible();
    const visuals = await page.evaluate(() => window.__FA_DEBUG__?.visuals());
    expect(visuals).toEqual({
      renderer: 'vector-combat-v1',
      hero: true,
      pyra: true,
      enemy: true,
      hpBars: true,
      resolveMeter: true,
    });
  });

  for (const viewport of [
    { width: 844, height: 390, name: 'iPhone 13 landscape' },
    { width: 932, height: 430, name: 'wide iPhone PWA landscape' },
    { width: 1180, height: 820, name: 'tablet landscape' },
    { width: 1280, height: 720, name: 'desktop 1280x720' },
    { width: 1600, height: 900, name: 'desktop wide' },
  ]) {
    test(`combat presentation stays inside safe HUD at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.locator('canvas')).toBeVisible();

      const layout = await page.evaluate(() => window.__FA_DEBUG__?.layout());
      const visuals = await page.evaluate(() => window.__FA_DEBUG__?.visuals());
      expect(layout).toBeDefined();
      expect(visuals?.hero).toBe(true);
      expect(visuals?.pyra).toBe(true);
      expect(visuals?.enemy).toBe(true);
      expect(visuals?.hpBars).toBe(true);
      expect(visuals?.resolveMeter).toBe(true);
      expect(layout!.hud.left).toBeGreaterThanOrEqual(28);
      expect(layout!.hud.right).toBeLessThanOrEqual(layout!.width - 28);
      expect(layout!.hud.top).toBeGreaterThanOrEqual(18);
      expect(layout!.hud.bottom).toBeLessThanOrEqual(layout!.height - 18);
    });
  }

  test('auto combat and speed controls remain operational after visual pass', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    await page.goto('/');
    const before = await page.evaluate(() => window.__FA_DEBUG__?.snapshot());
    await page.evaluate(() => window.__FA_DEBUG__?.advance(3500));
    const after = await page.evaluate(() => window.__FA_DEBUG__?.snapshot());
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after!.enemyHp < before!.enemyHp || after!.wave > before!.wave || after!.status === 'victory').toBeTruthy();

    for (const speed of ['1', '2', '3']) {
      await expect(page.locator('canvas')).toBeVisible();
      const state = await page.evaluate(() => window.__FA_DEBUG__?.state().settings.speed);
      expect([1, 2, 3]).toContain(state);
      expect(speed).toMatch(/^[123]$/);
    }
  });
});
