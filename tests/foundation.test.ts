import { describe, expect, it } from 'vitest';
import { FixedStepSimulation } from '../src/core/simulation';
import { developmentContent, validateContent } from '../src/content/content';
import { DevelopmentPlatformProvider } from '../src/platform/platform';
import { createInitialState } from '../src/core/state';
import { SaveRepository, type StorageLike } from '../src/persistence/persistence';

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

describe('locked PRD-01 foundation remains intact', () => {
  it('fixed-step speed foundation remains deterministic', () => {
    const sim = new FixedStepSimulation(10);
    let n = 0;
    sim.setSpeed(2);
    expect(sim.advance(25, () => n++)).toBe(5);
    expect(n).toBe(5);
  });
  it('development content validates', () => expect(validateContent(developmentContent)).toEqual([]));
  it('platform still falls back without external SDKs', () =>
    expect(new DevelopmentPlatformProvider().capabilities().purchases).toBe(false));
  it('corrupt current save still recovers a prior valid save', () => {
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
});
