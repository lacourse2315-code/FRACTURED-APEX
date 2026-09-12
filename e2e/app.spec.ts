import { test, expect, type Page } from '@playwright/test';

type Snapshot = {
  status: string;
  stage: number;
  wave: number;
  heroHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  resolve: number;
  pyraCharge: number;
};
type BrowserState = {
  campaign: { stage: number };
  equipped: { weapon: string | null };
  settings: { speed: number };
  statistics: { totalSimulationMs: number };
};
type LootView = { slot: string };
type BrowserDebug = {
  snapshot: () => Snapshot;
  state: () => BrowserState;
  power: () => number;
  loot: () => LootView | null;
  advance: (realDeltaMs: number) => number;
};
type DebugWindow = Window & { __FA_DEBUG__?: BrowserDebug };

async function debug<T>(page: Page, key: 'snapshot' | 'state' | 'power' | 'loot'): Promise<T> {
  return page.evaluate((k) => {
    const api = (window as DebugWindow).__FA_DEBUG__;
    if (!api) throw new Error('FRACTURED APEX debug bridge unavailable');
    if (k === 'snapshot') return api.snapshot();
    if (k === 'state') return api.state();
    if (k === 'power') return api.power();
    return api.loot();
  }, key) as Promise<T>;
}

async function advance(page: Page, realDeltaMs: number): Promise<number> {
  return page.evaluate((delta) => {
    const api = (window as DebugWindow).__FA_DEBUG__;
    if (!api) throw new Error('FRACTURED APEX debug bridge unavailable');
    return api.advance(delta);
  }, realDeltaMs);
}

async function logicalClick(page: Page, x: number, y: number, touch = false) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const px = box.x + box.width * (x / 1280);
  const py = box.y + box.height * (y / 720);
  if (touch) await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
}

async function waitSpeed(page: Page, speed: number) {
  await expect.poll(async () => (await debug<BrowserState>(page, 'state')).settings.speed).toBe(speed);
}

async function driveToStatus(page: Page, status: 'victory' | 'defeat', maxIterations = 80) {
  for (let i = 0; i < maxIterations; i++) {
    const snapshot = await debug<Snapshot>(page, 'snapshot');
    if (snapshot.status === status) return snapshot;
    if (snapshot.status !== 'fighting') throw new Error(`Unexpected combat status ${snapshot.status}`);
    await advance(page, 250);
  }
  throw new Error(`Combat did not reach ${status}`);
}

test.describe('real playable loop', () => {
  test('desktop: auto combat → Pyra → loot → equip → continue → reload → defeat → retry', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    const startPower = await debug<number>(page, 'power');

    await logicalClick(page, 732, 608);
    await waitSpeed(page, 3);
    const combatStart = await debug<Snapshot>(page, 'snapshot');
    await advance(page, 60);
    const firstAction = await debug<Snapshot>(page, 'snapshot');
    expect(firstAction.enemyHp).toBeLessThan(combatStart.enemyHp);
    expect(firstAction.pyraCharge).toBeGreaterThan(0);

    await driveToStatus(page, 'victory');
    const loot = await debug<LootView | null>(page, 'loot');
    expect(loot).not.toBeNull();
    expect(loot?.slot).toBe('weapon');
    await logicalClick(page, 530, 439);
    await expect.poll(async () => debug<number>(page, 'power')).toBeGreaterThan(startPower);
    const equippedId = (await debug<BrowserState>(page, 'state')).equipped.weapon;
    expect(equippedId).toBeTruthy();

    await logicalClick(page, 710, 439);
    await expect.poll(async () => (await debug<BrowserState>(page, 'state')).campaign.stage).toBe(2);
    await page.reload();
    await expect(page.locator('canvas')).toBeVisible();
    expect((await debug<BrowserState>(page, 'state')).equipped.weapon).toBe(equippedId);
    expect((await debug<BrowserState>(page, 'state')).campaign.stage).toBe(2);
    expect(await debug<number>(page, 'power')).toBeGreaterThan(startPower);

    await driveToStatus(page, 'victory');
    await logicalClick(page, 750, 439);
    await logicalClick(page, 710, 439);
    await expect.poll(async () => (await debug<BrowserState>(page, 'state')).campaign.stage).toBe(3);
    const defeat = await driveToStatus(page, 'defeat', 100);
    expect(defeat.heroHp).toBe(0);
    await logicalClick(page, 575, 418);
    await expect.poll(async () => (await debug<Snapshot>(page, 'snapshot')).status).toBe('fighting');
    expect(errors).toEqual([]);
  });

  test('desktop: x2 and x3 control authoritative fixed-step rate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    await page.goto('/');
    await logicalClick(page, 640, 608);
    await waitSpeed(page, 2);
    const x2Delta = await advance(page, 100);
    await logicalClick(page, 732, 608);
    await waitSpeed(page, 3);
    const x3Delta = await advance(page, 100);
    expect(x2Delta).toBeGreaterThan(150);
    expect(x3Delta).toBeGreaterThan(250);
    expect(x3Delta).toBeGreaterThan(x2Delta * 1.25);
  });

  test('desktop: cleared stage can be replayed without a page reload', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    await page.goto('/');
    await logicalClick(page, 732, 608);
    await waitSpeed(page, 3);
    await driveToStatus(page, 'victory');
    await logicalClick(page, 750, 439);
    await logicalClick(page, 570, 439);
    const replay = await debug<Snapshot>(page, 'snapshot');
    expect(replay.status).toBe('fighting');
    expect(replay.stage).toBe(1);
  });

  test('phone landscape: touch speed control and automatic combat work', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-landscape');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    await logicalClick(page, 732, 608, true);
    await waitSpeed(page, 3);
    const before = await debug<Snapshot>(page, 'snapshot');
    await advance(page, 60);
    const after = await debug<Snapshot>(page, 'snapshot');
    expect(after.enemyHp).toBeLessThan(before.enemyHp);
    expect(after.pyraCharge).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
});

const sizes = [
  [907, 510],
  [1216, 684],
  [1366, 768],
  [1280, 720],
  [800, 450],
  [1080, 607],
  [667, 375],
] as const;
for (const [width, height] of sizes) {
  test(`responsive ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      ),
    ).toBe(false);
  });
}
