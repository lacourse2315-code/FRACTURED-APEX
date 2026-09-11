import type { GameState } from '../core/state';
import { createInitialState } from '../core/state';

const KEYS = { current: 'fa.save.current', previous: 'fa.save.previous', good: 'fa.save.good' } as const;

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isNonNegativeFinite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function isValidState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<GameState>;
  if (s.schemaVersion !== 1) return false;
  if (!s.profile || typeof s.profile.id !== 'string' || typeof s.profile.createdAt !== 'string') return false;
  if (!s.campaign || typeof s.campaign.worldId !== 'string' || !Number.isInteger(s.campaign.stage) || s.campaign.stage < 1)
    return false;
  if (!s.currencies || !isNonNegativeFinite(s.currencies.shards) || !isNonNegativeFinite(s.currencies.essence)) return false;
  if (!isStringArray(s.inventory) || !isStringArray(s.companionIds) || !isStringArray(s.featureUnlocks)) return false;
  if (!s.equipped || typeof s.equipped !== 'object' || Array.isArray(s.equipped)) return false;
  if (s.selectedClassId !== null && typeof s.selectedClassId !== 'string') return false;
  if (!s.settings || typeof s.settings.muted !== 'boolean' || ![1, 2, 3].includes(s.settings.speed)) return false;
  if (!s.statistics || !isNonNegativeFinite(s.statistics.totalSimulationMs)) return false;
  return true;
}

export function migrate(value: unknown): GameState | null {
  if (!value || typeof value !== 'object') return null;
  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  switch (version) {
    case 1:
      return isValidState(value) ? value : null;
    default:
      return null;
  }
}

function parse(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export class SaveRepository {
  constructor(private readonly storage: StorageLike) {}

  load(): GameState {
    const current = parse(this.storage.getItem(KEYS.current));
    if (current) {
      this.storage.setItem(KEYS.good, JSON.stringify(current));
      return current;
    }
    const previous = parse(this.storage.getItem(KEYS.previous));
    if (previous) {
      this.storage.setItem(KEYS.current, JSON.stringify(previous));
      this.storage.setItem(KEYS.good, JSON.stringify(previous));
      return previous;
    }
    const good = parse(this.storage.getItem(KEYS.good));
    if (good) {
      this.storage.setItem(KEYS.current, JSON.stringify(good));
      return good;
    }
    const fresh = createInitialState();
    this.save(fresh);
    return fresh;
  }

  save(state: GameState): void {
    if (!isValidState(state)) throw new Error('Refusing to persist invalid state');
    const current = this.storage.getItem(KEYS.current);
    if (parse(current)) this.storage.setItem(KEYS.previous, current!);
    const raw = JSON.stringify(state);
    this.storage.setItem(KEYS.current, raw);
    this.storage.setItem(KEYS.good, raw);
  }
}
