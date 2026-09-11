import { test, expect } from '@playwright/test';

const sizes = [
  [907, 510],
  [1216, 684],
  [1366, 768],
  [1280, 720],
  [800, 450],
  [1080, 607],
  [667, 375],
] as const;

test('loads, renders canvas, persists speed and survives malformed save', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) return;
  const x2X = box.x + box.width * (666 / 1280);
  const x2Y = box.y + box.height * (623 / 720);
  if (testInfo.project.name === 'phone-landscape') {
    await page.touchscreen.tap(x2X, x2Y);
  } else {
    await page.mouse.click(x2X, x2Y);
  }

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('fa.save.current');
        return raw ? JSON.parse(raw).settings.speed : null;
      }),
    )
    .toBe(2);

  await page.reload();
  await expect(canvas).toBeVisible();
  const persistedSpeed = await page.evaluate(() => {
    const raw = localStorage.getItem('fa.save.current');
    return raw ? JSON.parse(raw).settings.speed : null;
  });
  expect(persistedSpeed).toBe(2);

  await page.evaluate(() => localStorage.setItem('fa.save.current', '{bad'));
  await page.reload();
  await expect(canvas).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [width, height] of sizes) {
  test(`responsive ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    );
    expect(overflow).toBe(false);
  });
}
