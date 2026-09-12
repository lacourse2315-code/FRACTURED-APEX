import { test, expect, type Page } from '@playwright/test';

type DebugWindow = Window & {
  __FA_DEBUG__?: {
    snapshot: () => { status: string };
    power: () => number;
    loot: () => unknown;
    advance: (realDeltaMs: number) => number;
  };
};

async function driveToVictory(page: Page): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const status = await page.evaluate(() => (window as DebugWindow).__FA_DEBUG__?.snapshot().status);
    if (status === 'victory') return;
    await page.evaluate(() => (window as DebugWindow).__FA_DEBUG__?.advance(250));
  }
  throw new Error('Combat did not reach victory');
}

async function logicalTap(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.touchscreen.tap(box.x + box.width * (x / 1280), box.y + box.height * (y / 720));
}

test('phone landscape fills the available viewport and essential touch actions work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-landscape');
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;
  expect(box.width).toBeGreaterThanOrEqual(viewport.width * 0.96);
  expect(box.height).toBeGreaterThanOrEqual(viewport.height * 0.96);

  await logicalTap(page, 770, 630);
  await driveToVictory(page);
  const before = await page.evaluate(() => (window as DebugWindow).__FA_DEBUG__?.power() ?? 0);
  expect(await page.evaluate(() => (window as DebugWindow).__FA_DEBUG__?.loot())).not.toBeNull();
  await logicalTap(page, 530, 439);
  await expect
    .poll(async () => page.evaluate(() => (window as DebugWindow).__FA_DEBUG__?.power() ?? 0))
    .toBeGreaterThan(before);
  expect(await page.evaluate(() => (window as DebugWindow).__FA_DEBUG__?.loot())).toBeNull();
});

test('phone portrait shows rotation guidance instead of a tiny game', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-landscape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#rotate-device')).toBeVisible();
  await expect(page.locator('#rotate-device')).toContainText('ROTATE YOUR DEVICE');
  await expect(page.locator('#app')).toHaveCSS('visibility', 'hidden');
});
