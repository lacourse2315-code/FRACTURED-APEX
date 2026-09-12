import { test, expect } from '@playwright/test';

type Snapshot = { status: string; stage: number; wave: number; heroHp: number; enemyHp: number; enemyMaxHp: number; resolve: number; pyraCharge: number };
async function debug<T>(page: import('@playwright/test').Page, key: 'snapshot'|'state'|'power'|'loot'): Promise<T> { return page.evaluate((k) => (window as any).__FA_DEBUG__[k](), key); }
async function logicalClick(page: import('@playwright/test').Page, x: number, y: number, touch = false) {
  const canvas = page.locator('canvas'); const box = await canvas.boundingBox(); expect(box).not.toBeNull(); if (!box) return;
  const px = box.x + box.width * (x / 1280); const py = box.y + box.height * (y / 720); if (touch) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
}
async function waitStatus(page: import('@playwright/test').Page, status: string, timeout = 25_000) { await expect.poll(async () => (await debug<Snapshot>(page, 'snapshot')).status, { timeout }).toBe(status); }

test.describe('real playable loop', () => {
  test('desktop: auto combat → loot → equip → stronger → reload → defeat → retry', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); await page.goto('/'); await expect(page.locator('canvas')).toBeVisible();
    const start = await debug<Snapshot>(page, 'snapshot'); const startPower = await debug<number>(page, 'power'); await logicalClick(page, 732, 608);
    await expect.poll(async () => (await debug<Snapshot>(page, 'snapshot')).enemyHp, { timeout: 5000 }).toBeLessThan(start.enemyHp); await expect.poll(async () => (await debug<Snapshot>(page, 'snapshot')).pyraCharge, { timeout: 5000 }).toBeGreaterThanOrEqual(0);
    await waitStatus(page, 'victory'); const loot = await debug<any>(page, 'loot'); expect(loot).toBeTruthy(); expect(loot.slot).toBe('weapon'); await logicalClick(page, 480, 439);
    await expect.poll(async () => debug<number>(page, 'power')).toBeGreaterThan(startPower); const equippedId = await page.evaluate(() => (window as any).__FA_DEBUG__.state().equipped.weapon); expect(equippedId).toBeTruthy();
    await page.reload(); await expect(page.locator('canvas')).toBeVisible(); expect(await page.evaluate(() => (window as any).__FA_DEBUG__.state().equipped.weapon)).toBe(equippedId); expect(await debug<number>(page, 'power')).toBeGreaterThan(startPower);
    await logicalClick(page, 732, 608); await waitStatus(page, 'victory'); await logicalClick(page, 805, 439); await waitStatus(page, 'victory'); await logicalClick(page, 805, 439); await waitStatus(page, 'defeat', 30_000);
    const defeat = await debug<Snapshot>(page, 'snapshot'); expect(defeat.heroHp).toBe(0); await logicalClick(page, 575, 418); await expect.poll(async () => (await debug<Snapshot>(page, 'snapshot')).status).toBe('fighting'); expect(errors).toEqual([]);
  });

  test('phone landscape: touch speed control and automatic combat work', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-landscape'); const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); await page.goto('/'); await expect(page.locator('canvas')).toBeVisible(); const before = await debug<Snapshot>(page, 'snapshot'); await logicalClick(page, 732, 608, true);
    await expect.poll(async () => (await debug<Snapshot>(page, 'snapshot')).enemyHp, { timeout: 6000 }).toBeLessThan(before.enemyHp); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)).toBe(false); expect(errors).toEqual([]);
  });
});

const sizes = [[907,510],[1216,684],[1366,768],[1280,720],[800,450],[1080,607],[667,375]] as const;
for (const [width,height] of sizes) {
  test(`responsive ${width}x${height}`, async ({ page }, testInfo) => { test.skip(testInfo.project.name !== 'desktop'); await page.setViewportSize({ width, height }); await page.goto('/'); await expect(page.locator('canvas')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)).toBe(false); });
}
