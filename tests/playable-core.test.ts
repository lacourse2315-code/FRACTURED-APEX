import { describe, expect, it } from 'vitest';
import {
  CombatEngine,
  calculatePower,
  calculateRiftwardenStats,
  hitChance,
  mitigate,
  rollDamage,
} from '../src/core/combat';
import { PlayableCore } from '../src/core/gameplay';
import { comparisonDelta, equipItem, generateItem, itemScore, toggleItemLock } from '../src/core/loot';
import { SeededRng, type RandomSource } from '../src/core/rng';
import { FixedStepSimulation } from '../src/core/simulation';
import { createInitialState } from '../src/core/state';
import { developmentContent, enemies, validateContent } from '../src/content/content';
import { isValidState, migrate, SaveRepository, type StorageLike } from '../src/persistence/persistence';

class MemoryStorage implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
class SequenceRng implements RandomSource {
  constructor(private values: number[]) {}
  next() {
    return this.values.shift() ?? 0;
  }
}
function runCore(stage: number, seed = 1234) {
  const state = createInitialState();
  state.campaign.stage = stage;
  const core = new PlayableCore(state, () => {}, seed);
  let elapsed = 0;
  while (core.snapshot().status === 'fighting' && elapsed < 120_000) {
    core.tick(1000 / 60);
    elapsed += 1000 / 60;
  }
  return { state, core, elapsed };
}

describe('combat formulas', () => {
  it('Defense reduces damage', () => {
    expect(mitigate(100, 100)).toBeCloseTo(50);
    expect(mitigate(100, 25)).toBeGreaterThan(mitigate(100, 100));
  });
  it('controlled RNG produces a critical hit', () => {
    const state = createInitialState();
    const attacker = calculateRiftwardenStats(state);
    const defender = { ...attacker, defense: 0, dodge: 0 };
    const result = rollDamage({ ...attacker, critChance: 1 }, defender, 1, new SequenceRng([0, 0]));
    expect(result.hit).toBe(true);
    expect(result.critical).toBe(true);
    expect(result.damage).toBeGreaterThan(attacker.attack);
  });
  it('Accuracy and Dodge affect hit chance', () => {
    const state = createInitialState();
    const a = calculateRiftwardenStats(state);
    expect(hitChance({ ...a, accuracy: 130 }, { ...a, dodge: 0 })).toBeGreaterThan(
      hitChance({ ...a, accuracy: 70 }, { ...a, dodge: 35 }),
    );
  });
});

describe('Riftwarden + Pyra combat loop', () => {
  it('uses cooldown-gated automatic skills', () => {
    const state = createInitialState();
    const engine = new CombatEngine(state, developmentContent, new SeededRng(8));
    engine.start(1);
    const slamTimes: number[] = [];
    let t = 0;
    while (t < 14_000 && engine.snapshot().status === 'fighting') {
      for (const e of engine.tick(1000 / 60)) if (e.type === 'skill' && e.label === 'Gravitic Slam') slamTimes.push(t);
      t += 1000 / 60;
    }
    expect(slamTimes.length).toBeGreaterThanOrEqual(1);
    if (slamTimes.length > 1) expect(slamTimes[1]! - slamTimes[0]!).toBeGreaterThan(6500);
  });
  it('generates and spends Resolve through Worldbreaker', () => {
    const state = createInitialState();
    const engine = new CombatEngine(state, developmentContent, new SeededRng(18));
    engine.start(2);
    let saw = false;
    for (let i = 0; i < 1800 && engine.snapshot().status === 'fighting'; i++) {
      const events = engine.tick(1000 / 60);
      if (events.some((e) => e.label === 'Worldbreaker')) {
        saw = true;
        expect(engine.snapshot().resolve).toBeLessThan(100);
        break;
      }
    }
    expect(saw).toBe(true);
  });
  it('Pyra charges from hero skills and fires Solar Pounce', () => {
    const state = createInitialState();
    const engine = new CombatEngine(state, developmentContent, new SeededRng(33));
    engine.start(1);
    let solar = false;
    for (let i = 0; i < 1200 && engine.snapshot().status === 'fighting'; i++) {
      if (engine.tick(1000 / 60).some((e) => e.type === 'pyra' && e.label === 'Solar Pounce')) {
        solar = true;
        break;
      }
    }
    expect(solar).toBe(true);
  });
  it('enemy archetypes have materially different profiles', () => {
    const brute = enemies.find((e) => e.archetype === 'brute')!;
    const skirmisher = enemies.find((e) => e.archetype === 'skirmisher')!;
    const warden = enemies.find((e) => e.archetype === 'warden')!;
    expect(brute.stats.attack).toBeGreaterThan(skirmisher.stats.attack);
    expect(skirmisher.stats.attackSpeed).toBeGreaterThan(brute.stats.attackSpeed);
    expect(warden.stats.defense).toBeGreaterThan(skirmisher.stats.defense);
  });
  it('stage 1 reaches victory', () => expect(runCore(1).core.snapshot().status).toBe('victory'));
  it('stage 3 can genuinely defeat an ungeared Riftwarden', () =>
    expect(runCore(3).core.snapshot().status).toBe('defeat'));
  it('a cleared stage can be replayed without changing development-stage progress', () => {
    const state = createInitialState();
    const core = new PlayableCore(state, () => {}, 77);
    while (core.snapshot().status === 'fighting') core.tick(1000 / 60);
    expect(core.snapshot().status).toBe('victory');
    core.keepPending();
    core.replay();
    expect(core.snapshot().status).toBe('fighting');
    expect(state.campaign.stage).toBe(1);
  });
});

describe('loot, equipment and Power', () => {
  it('generates unique equipment identities and supported slots', () => {
    const rng = new SeededRng(4);
    let id = 0;
    const a = generateItem(1, rng, () => `item-${++id}`);
    const b = generateItem(1, rng, () => `item-${++id}`);
    expect(a.instanceId).not.toBe(b.instanceId);
    expect(['weapon', 'helm', 'chest', 'ring', 'relic']).toContain(a.slot);
  });
  it('equipping real gear recalculates stats and Power', () => {
    const state = createInitialState();
    const beforeStats = calculateRiftwardenStats(state);
    const beforePower = calculatePower(beforeStats);
    const item = generateItem(2, new SeededRng(9), () => 'weapon-1', 'weapon');
    state.inventory.push(item);
    equipItem(state, item.instanceId);
    const afterStats = calculateRiftwardenStats(state);
    const afterPower = calculatePower(afterStats);
    expect(afterStats.attack).toBeGreaterThan(beforeStats.attack);
    expect(afterPower).toBeGreaterThan(beforePower);
    expect(comparisonDelta(state, item)).toBe(0);
  });
  it('replacement comparison, replacement equip and locking are authoritative', () => {
    const state = createInitialState();
    const weak = generateItem(1, new SeededRng(2), () => 'weak', 'weapon');
    const strong = generateItem(3, new SeededRng(2), () => 'strong', 'weapon');
    state.inventory.push(weak, strong);
    equipItem(state, weak.instanceId);
    expect(itemScore(strong)).toBeGreaterThan(itemScore(weak));
    expect(comparisonDelta(state, strong)).toBeGreaterThan(0);
    equipItem(state, strong.instanceId);
    expect(state.equipped.weapon).toBe('strong');
    toggleItemLock(state, strong.instanceId);
    expect(state.lockedItemIds).toContain('strong');
    toggleItemLock(state, strong.instanceId);
    expect(state.lockedItemIds).not.toContain('strong');
  });
});

describe('persistence v2', () => {
  it('migrates the locked PRD-01 v1 shape without inventing gear', () => {
    const v1 = {
      schemaVersion: 1,
      profile: { id: 'legacy', createdAt: '2026-01-01T00:00:00.000Z' },
      selectedClassId: null,
      campaign: { worldId: 'dev-fracture', stage: 1 },
      currencies: { shards: 7, essence: 2 },
      inventory: [],
      equipped: {},
      companionIds: [],
      featureUnlocks: [],
      settings: { muted: true, speed: 2 },
      statistics: { totalSimulationMs: 0 },
    };
    const migrated = migrate(v1)!;
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.profile.id).toBe('legacy');
    expect(migrated.inventory).toEqual([]);
    expect(migrated.settings.speed).toBe(2);
  });
  it('persists inventory/equipment identity across reload', () => {
    const mem = new MemoryStorage();
    const repo = new SaveRepository(mem);
    const state = repo.load();
    const item = generateItem(2, new SeededRng(3), () => 'stable-id', 'weapon');
    state.inventory.push(item);
    equipItem(state, item.instanceId);
    repo.save(state);
    const loaded = repo.load();
    expect(loaded.equipped.weapon).toBe('stable-id');
    expect(loaded.inventory.find((i) => i.instanceId === 'stable-id')).toEqual(item);
    expect(isValidState(loaded)).toBe(true);
  });
  it('retains previous/known-good corruption recovery', () => {
    const mem = new MemoryStorage();
    const repo = new SaveRepository(mem);
    const a = repo.load();
    a.currencies.shards = 11;
    repo.save(a);
    const b = structuredClone(a);
    b.currencies.shards = 19;
    repo.save(b);
    mem.setItem('fa.save.current', '{broken');
    expect(repo.load().currencies.shards).toBe(11);
  });
});

describe('deterministic simulation and speed', () => {
  it('x1/x2/x3 produce proportional fixed steps', () => {
    for (const speed of [1, 2, 3] as const) {
      const sim = new FixedStepSimulation(10);
      sim.setSpeed(speed);
      let n = 0;
      sim.advance(100, () => n++);
      expect(n).toBe(10 * speed);
    }
  });
  it('different render delta patterns resolve the same deterministic combat', () => {
    const execute = (pattern: number[]) => {
      const state = createInitialState();
      const engine = new CombatEngine(state, developmentContent, new SeededRng(777));
      engine.start(1);
      const sim = new FixedStepSimulation(1000 / 60);
      let i = 0;
      let real = 0;
      while (real < 12_000 && engine.snapshot().status === 'fighting') {
        const delta = pattern[i++ % pattern.length]!;
        sim.advance(delta, (dt) => engine.tick(dt));
        real += delta;
      }
      const s = engine.snapshot();
      return { status: s.status, heroHp: s.heroHp, enemyHp: s.enemyHp, wave: s.wave };
    };
    expect(execute([1000 / 60])).toEqual(execute([1000 / 120, 1000 / 120]));
    expect(execute([1000 / 60])).toEqual(execute([33.333, 8.333, 8.334]));
  });
});

describe('content integrity', () => {
  it('accepts PRD-02 development content', () => expect(validateContent(developmentContent)).toEqual([]));
  it('rejects bad stage references', () => {
    const bad = {
      ...developmentContent,
      stages: [{ id: 'bad', stage: 1, waves: ['missing', 'missing', 'missing'], rewardLevel: 1 }],
    };
    expect(validateContent(bad).some((e) => e.includes('Invalid enemy reference'))).toBe(true);
  });
});
