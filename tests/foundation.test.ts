import { describe, expect, it } from 'vitest';
import { FixedStepSimulation } from '../src/core/simulation';
import { developmentContent, validateContent } from '../src/content/content';
import { DevelopmentPlatformProvider } from '../src/platform/platform';
import { createInitialState } from '../src/core/state';
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

describe('simulation', () => {
  it('applies deterministic speed multiplier', () => {
    const s = new FixedStepSimulation(10);
    let n = 0;
    s.setSpeed(2);
    expect(s.advance(25, () => n++)).toBe(5);
    expect(n).toBe(5);
  });
});

describe('content', () => {
  it('accepts development content', () => expect(validateContent(developmentContent)).toEqual([]));
  it('rejects invalid references', () =>
    expect(validateContent({ worlds: [], enemies: [{ id: 'e', name: 'E', worldId: 'missing', power: 1 }] })).toContain(
      'Invalid world reference: e',
    ));
  it('rejects duplicate IDs and impossible ranges', () => {
    const errors = validateContent({
      worlds: [
        { id: 'w', name: 'One', minStage: 1, maxStage: 1 },
        { id: 'w', name: 'Two', minStage: 4, maxStage: 2 },
      ],
      enemies: [],
    });
    expect(errors).toContain('Duplicate ID: w');
    expect(errors).toContain('Invalid stage range: w');
  });
});

describe('platform', () => {
  it('falls back safely without SDK', () =>
    expect(new DevelopmentPlatformProvider().capabilities().purchases).toBe(false));
});

describe('persistence', () => {
  it('validates a legitimate schema and rejects malformed nested state', () => {
    expect(isValidState(createInitialState())).toBe(true);
    expect(isValidState({ schemaVersion: 1, profile: {}, campaign: {}, currencies: {}, settings: {}, statistics: {} })).toBe(
      false,
    );
  });
  it('rejects unsupported versions at the migration entry point', () => {
    const future = { ...createInitialState(), schemaVersion: 2 };
    expect(migrate(future)).toBeNull();
  });
  it('persists and recovers previous valid save after corruption', () => {
    const mem = new MemoryStorage();
    const repo = new SaveRepository(mem);
    const a = createInitialState();
    a.currencies.shards = 7;
    repo.save(a);
    const b = structuredClone(a);
    b.currencies.shards = 9;
    repo.save(b);
    mem.setItem('fa.save.current', '{broken');
    expect(repo.load().currencies.shards).toBe(7);
  });
  it('creates a fresh versioned save when none exists', () => {
    const s = new SaveRepository(new MemoryStorage()).load();
    expect(s.schemaVersion).toBe(1);
  });
});
