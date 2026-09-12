import type { EarlyRarity, EquipmentItem, EquipmentSlot, GameState, StatKey } from './state';
import type { RandomSource } from './rng';

export interface ItemBase {
  id: string;
  name: string;
  slot: EquipmentSlot;
  primaryStat: StatKey;
  primaryPerLevel: number;
}

export const ITEM_BASES: ItemBase[] = [
  { id: 'rift-cleaver', name: 'Rift Cleaver', slot: 'weapon', primaryStat: 'attack', primaryPerLevel: 5.2 },
  { id: 'apex-guard', name: 'Apex Guard', slot: 'helm', primaryStat: 'maxHp', primaryPerLevel: 21 },
  { id: 'fracture-plate', name: 'Fracture Plate', slot: 'chest', primaryStat: 'defense', primaryPerLevel: 3.8 },
  { id: 'gravity-band', name: 'Gravity Band', slot: 'ring', primaryStat: 'critChance', primaryPerLevel: 0.004 },
  { id: 'ember-core', name: 'Ember Core', slot: 'relic', primaryStat: 'cooldownRecovery', primaryPerLevel: 0.004 },
];

const rarityOrder: EarlyRarity[] = ['common', 'uncommon', 'rare'];
const rarityMultiplier: Record<EarlyRarity, number> = { common: 1, uncommon: 1.22, rare: 1.52 };
const affixPool: StatKey[] = ['attack', 'maxHp', 'defense', 'critChance', 'critDamage', 'accuracy', 'dodge'];

export function itemScore(item: EquipmentItem): number {
  const weight: Record<StatKey, number> = {
    maxHp: 0.12,
    attack: 1.8,
    defense: 1.35,
    attackSpeed: 120,
    critChance: 350,
    critDamage: 90,
    accuracy: 0.7,
    dodge: 0.8,
    cooldownRecovery: 240,
  };
  let score = 0;
  for (const [stat, value] of Object.entries(item.primary) as Array<[StatKey, number]>) score += value * weight[stat];
  for (const affix of item.affixes) score += affix.value * weight[affix.stat];
  return Math.round(score * 10) / 10;
}

function rollRarity(rng: RandomSource): EarlyRarity {
  const r = rng.next();
  if (r > 0.88) return 'rare';
  if (r > 0.55) return 'uncommon';
  return 'common';
}

export function generateItem(
  itemLevel: number,
  rng: RandomSource,
  idFactory: () => string = () => crypto.randomUUID(),
  forcedSlot?: EquipmentSlot,
): EquipmentItem {
  const candidates = forcedSlot ? ITEM_BASES.filter((base) => base.slot === forcedSlot) : ITEM_BASES;
  const base = candidates[Math.floor(rng.next() * candidates.length)]!;
  const rarity = rollRarity(rng);
  const mult = rarityMultiplier[rarity];
  const primaryValue = base.primaryPerLevel * Math.max(1, itemLevel) * mult;
  const affixCount = rarityOrder.indexOf(rarity);
  const affixes: EquipmentItem['affixes'] = [];
  for (let i = 0; i < affixCount; i++) {
    const stat = affixPool[Math.floor(rng.next() * affixPool.length)]!;
    const baseValue = stat === 'critChance' ? 0.012 : stat === 'critDamage' ? 0.08 : Math.max(2, itemLevel * 2.2);
    affixes.push({ stat, value: Number((baseValue * (0.85 + rng.next() * 0.3)).toFixed(3)) });
  }
  return {
    instanceId: idFactory(),
    baseId: base.id,
    name: `${rarity === 'common' ? '' : `${rarity[0]!.toUpperCase()}${rarity.slice(1)} `}${base.name}`,
    slot: base.slot,
    rarity,
    itemLevel,
    primary: { [base.primaryStat]: Number(primaryValue.toFixed(3)) },
    affixes,
  };
}

export function equippedItem(state: GameState, slot: EquipmentSlot): EquipmentItem | null {
  const id = state.equipped[slot];
  return id ? state.inventory.find((item) => item.instanceId === id) ?? null : null;
}

export function comparisonDelta(state: GameState, item: EquipmentItem): number {
  const current = equippedItem(state, item.slot);
  return Number((itemScore(item) - (current ? itemScore(current) : 0)).toFixed(1));
}

export function equipItem(state: GameState, instanceId: string): void {
  const item = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  if (!item) throw new Error(`Cannot equip missing item ${instanceId}`);
  state.equipped[item.slot] = item.instanceId;
}

export function toggleItemLock(state: GameState, instanceId: string): void {
  if (!state.inventory.some((item) => item.instanceId === instanceId)) throw new Error('Cannot lock missing item');
  const index = state.lockedItemIds.indexOf(instanceId);
  if (index >= 0) state.lockedItemIds.splice(index, 1);
  else state.lockedItemIds.push(instanceId);
}
