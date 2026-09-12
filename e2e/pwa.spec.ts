import { expect, test } from '@playwright/test';

test.describe('PRD-02 iOS PWA support', () => {
  test('manifest exposes standalone landscape installation metadata', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest.name).toBe('FRACTURED APEX');
    expect(manifest.short_name).toBe('FRACTURED APEX');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }),
        expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }),
      ]),
    );
  });

  test('index exposes Apple standalone metadata and PWA links', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
      'content',
      'black-translucent',
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'FRACTURED APEX');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
  });

  test('PWA icons are publicly served', async ({ request }) => {
    for (const path of ['/icons/apple-touch-icon.png', '/icons/icon-192.png', '/icons/icon-512.png']) {
      const response = await request.get(path);
      expect(response.ok(), path).toBeTruthy();
      expect(response.headers()['content-type']).toContain('image/png');
      expect((await response.body()).byteLength).toBeGreaterThan(1000);
    }
  });

  for (const viewport of [
    { width: 844, height: 390, name: 'iPhone 13 landscape' },
    { width: 932, height: 430, name: 'wide iPhone landscape' },
  ]) {
    test(`canvas expands across ${viewport.name} viewport without 16:9 side letterboxing`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      const canvas = page.locator('#app canvas');
      await expect(canvas).toBeVisible();

      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 2);
      expect(box!.height).toBeGreaterThan(viewport.height * 0.94);
      expect(box!.width / box!.height).toBeGreaterThan(1.9);

      const appStyle = await page.locator('#app').evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          width: style.width,
          maxWidth: style.maxWidth,
          marginLeft: style.marginLeft,
          marginRight: style.marginRight,
        };
      });
      expect(parseFloat(appStyle.width)).toBeGreaterThanOrEqual(viewport.width - 2);
      expect(appStyle.maxWidth).toBe('none');
      expect(appStyle.marginLeft).toBe('0px');
      expect(appStyle.marginRight).toBe('0px');
    });
  }

  test('portrait keeps the rotate-device gate and hides the game', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('#rotate-device')).toBeVisible();
    await expect(page.locator('#app')).toHaveCSS('visibility', 'hidden');
  });

  test('stylesheet keeps dynamic viewport sizing and standalone landscape support without a max-width cap', async ({
    request,
  }) => {
    const response = await request.get('/src/style.css');
    expect(response.ok()).toBeTruthy();
    const css = await response.text();
    expect(css).toContain('100dvw');
    expect(css).toContain('100dvh');
    expect(css).toContain('(display-mode: standalone) and (orientation: landscape)');
    expect(css).toContain('max-width: none');
  });
});
