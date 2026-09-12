export type GameSpeed = 1 | 2 | 3;
export type EquipmentSlot = 'weapon' | 'helm' | 'chest' | 'ring' | 'relic';
export type EarlyRarity = 'common' | 'uncommon' | 'rare';
export type StatKey =
  | 'maxHp'
  | 'attack'
  | 'defense'
  | 'attackSpeed'
  | 'critChance'
  | 'critDamage'
  | 'accuracy'
  | 'dodge'
  | 'cooldownRecovery';

export interface EquipmentItem {
  instanceId: string;
  baseId: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EarlyRarity;
  itemLevel: number;
  primary: Partial<Record<StatKey, number>>;
  affixes: Array<{ stat: StatKey; value: number }>;
}

export interface GameState {
  schemaVersion: 2;
  profile: { id: string; createdAt: string };
  selectedClassId: 'riftwarden';
  campaign: { worldId: 'dev-fracture'; stage: number; highestCleared: number };
  currencies: { shards: number; essence: number };
  inventory: EquipmentItem[];
  equipped: Record<EquipmentSlot, string | null>;
  companion: { id: 'pyra-emberwing'; bondXp: number };
  featureUnlocks: string[];
  lockedItemIds: string[];
  settings: { muted: boolean; speed: GameSpeed };
  statistics: { totalSimulationMs: number; victories: number; defeats: number };
}

export const emptyEquipment = (): Record<EquipmentSlot, string | null> => ({
  weapon: null,
  helm: null,
  chest: null,
  ring: null,
  relic: null,
});

export const createInitialState = (): GameState => ({
  schemaVersion: 2,
  profile: { id: crypto.randomUUID(), createdAt: new Date().toISOString() },
  selectedClassId: 'riftwarden',
  campaign: { worldId: 'dev-fracture', stage: 1, highestCleared: 0 },
  currencies: { shards: 0, essence: 0 },
  inventory: [],
  equipped: emptyEquipment(),
  companion: { id: 'pyra-emberwing', bondXp: 0 },
  featureUnlocks: [],
  lockedItemIds: [],
  settings: { muted: false, speed: 1 },
  statistics: { totalSimulationMs: 0, victories: 0, defeats: 0 },
});
