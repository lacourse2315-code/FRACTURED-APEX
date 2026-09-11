import type { GameState } from '../core/state';
import { createInitialState } from '../core/state';
const KEYS = { current:'fa.save.current', previous:'fa.save.previous', good:'fa.save.good' } as const;
export interface StorageLike { getItem(k:string): string|null; setItem(k:string,v:string):void; removeItem(k:string):void; }
export function isValidState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<GameState>;
  return s.schemaVersion === 1 && !!s.profile && !!s.campaign && !!s.currencies && !!s.settings && !!s.statistics;
}
export function migrate(value: unknown): GameState | null { return isValidState(value) ? value : null; }
function parse(raw: string | null): GameState | null { if (!raw) return null; try { return migrate(JSON.parse(raw)); } catch { return null; } }
export class SaveRepository {
  constructor(private readonly storage: StorageLike) {}
  load(): GameState {
    const current = parse(this.storage.getItem(KEYS.current));
    if (current) { this.storage.setItem(KEYS.good, JSON.stringify(current)); return current; }
    const previous = parse(this.storage.getItem(KEYS.previous));
    if (previous) { this.storage.setItem(KEYS.current, JSON.stringify(previous)); this.storage.setItem(KEYS.good, JSON.stringify(previous)); return previous; }
    const good = parse(this.storage.getItem(KEYS.good));
    if (good) { this.storage.setItem(KEYS.current, JSON.stringify(good)); return good; }
    const fresh = createInitialState(); this.save(fresh); return fresh;
  }
  save(state: GameState): void {
    if (!isValidState(state)) throw new Error('Refusing to persist invalid state');
    const current = this.storage.getItem(KEYS.current);
    if (parse(current)) this.storage.setItem(KEYS.previous, current!);
    const raw = JSON.stringify(state);
    this.storage.setItem(KEYS.current, raw); this.storage.setItem(KEYS.good, raw);
  }
}
