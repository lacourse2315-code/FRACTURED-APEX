import type { EquipmentItem, EquipmentSlot, GameState } from '../core/state';
import { createInitialState, emptyEquipment } from '../core/state';

const KEYS = { current: 'fa.save.current', previous: 'fa.save.previous', good: 'fa.save.good' } as const;
const slots: EquipmentSlot[] = ['weapon', 'helm', 'chest', 'ring', 'relic'];

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const nonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

function validItem(value: unknown): value is EquipmentItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<EquipmentItem>;
  return (
    typeof item.instanceId === 'string' && !!item.instanceId &&
    typeof item.baseId === 'string' && typeof item.name === 'string' &&
    slots.includes(item.slot as EquipmentSlot) &&
    ['common', 'uncommon', 'rare'].includes(String(item.rarity)) &&
    Number.isInteger(item.itemLevel) && Number(item.itemLevel) >= 1 &&
    !!item.primary && typeof item.primary === 'object' && Array.isArray(item.affixes)
  );
}

export function isValidState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<GameState>;
  if (s.schemaVersion !== 2 || s.selectedClassId !== 'riftwarden') return false;
  if (!s.profile || typeof s.profile.id !== 'string' || typeof s.profile.createdAt !== 'string') return false;
  if (!s.campaign || s.campaign.worldId !== 'dev-fracture' || !Number.isInteger(s.campaign.stage) || s.campaign.stage < 1 || !Number.isInteger(s.campaign.highestCleared) || s.campaign.highestCleared < 0) return false;
  if (!s.currencies || !nonNegative(s.currencies.shards) || !nonNegative(s.currencies.essence)) return false;
  if (!Array.isArray(s.inventory) || !s.inventory.every(validItem)) return false;
  if (!s.equipped || slots.some((slot) => !(slot in s.equipped!) || (s.equipped![slot] !== null && typeof s.equipped![slot] !== 'string'))) return false;
  const ids = new Set(s.inventory.map((item) => item.instanceId));
  if (ids.size !== s.inventory.length) return false;
  if (slots.some((slot) => s.equipped![slot] !== null && !ids.has(s.equipped![slot]!))) return false;
  if (!s.companion || s.companion.id !== 'pyra-emberwing' || !nonNegative(s.companion.bondXp)) return false;
  if (!stringArray(s.featureUnlocks) || !stringArray(s.lockedItemIds)) return false;
  if (!s.settings || typeof s.settings.muted !== 'boolean' || ![1, 2, 3].includes(s.settings.speed)) return false;
  if (!s.statistics || !nonNegative(s.statistics.totalSimulationMs) || !nonNegative(s.statistics.victories) || !nonNegative(s.statistics.defeats)) return false;
  return true;
}

function migrateV1(value: Record<string, unknown>): GameState | null {
  const profile = value.profile as { id?: unknown; createdAt?: unknown } | undefined;
  const settings = value.settings as { muted?: unknown; speed?: unknown } | undefined;
  if (!profile || typeof profile.id !== 'string' || typeof profile.createdAt !== 'string') return null;
  const fresh = createInitialState();
  fresh.profile = { id: profile.id, createdAt: profile.createdAt };
  if (settings && typeof settings.muted === 'boolean') fresh.settings.muted = settings.muted;
  if (settings && [1, 2, 3].includes(Number(settings.speed))) fresh.settings.speed = Number(settings.speed) as 1 | 2 | 3;
  const currencies = value.currencies as { shards?: unknown; essence?: unknown } | undefined;
  if (currencies && nonNegative(currencies.shards)) fresh.currencies.shards = currencies.shards;
  if (currencies && nonNegative(currencies.essence)) fresh.currencies.essence = currencies.essence;
  return fresh;
}

export function migrate(value: unknown): GameState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion === 2) return isValidState(raw) ? raw : null;
  if (raw.schemaVersion === 1) return migrateV1(raw);
  return null;
}

function parse(raw: string | null): GameState | null {
  if (!raw) return null;
  try { return migrate(JSON.parse(raw)); } catch { return null; }
}

export class SaveRepository {
  constructor(private readonly storage: StorageLike) {}
  load(): GameState {
    const current = parse(this.storage.getItem(KEYS.current));
    if (current) { this.storage.setItem(KEYS.good, JSON.stringify(current)); return current; }
    const previous = parse(this.storage.getItem(KEYS.previous));
    if (previous) { this.storage.setItem(KEYS.current, JSON.stringify(previous)); this.storage.setItem(KEYS.good, JSON.stringify(previous)); return previous; }
    const good = parse(this.storage.getItem(KEYS.good));
    if (good) { this.storage.setItem(KEYS.current, JSON.stringify(good)); return good; }
    const fresh = createInitialState();
    fresh.equipped = emptyEquipment();
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
