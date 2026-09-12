import type { CombatContent, CombatStats, EnemyDefinition, StageDefinition } from '../core/combat';
import { ITEM_BASES } from '../core/loot';

const stats = (overrides: Partial<CombatStats>): CombatStats => ({
  maxHp: 300,
  attack: 52,
  defense: 25,
  attackSpeed: 0.8,
  critChance: 0.04,
  critDamage: 1.5,
  accuracy: 90,
  dodge: 2,
  cooldownRecovery: 0,
  ...overrides,
});

export const enemies: EnemyDefinition[] = [
  { id: 'dev-brute', name: 'Fracture Brute', archetype: 'brute', stats: stats({ maxHp: 390, attack: 68, defense: 22, attackSpeed: 0.62 }) },
  { id: 'dev-skirmisher', name: 'Rift Skirmisher', archetype: 'skirmisher', stats: stats({ maxHp: 265, attack: 44, defense: 14, attackSpeed: 1.22, dodge: 12 }) },
  { id: 'dev-warden', name: 'Fracture Warden', archetype: 'warden', stats: stats({ maxHp: 520, attack: 58, defense: 54, attackSpeed: 0.78 }) },
  { id: 'dev-captain', name: 'Apex Captain', archetype: 'warden', stats: stats({ maxHp: 670, attack: 72, defense: 64, attackSpeed: 0.82, critChance: 0.08 }) },
  { id: 'dev-captain-hard', name: 'Ascendant Captain', archetype: 'brute', stats: stats({ maxHp: 1250, attack: 205, defense: 82, attackSpeed: 0.92, accuracy: 118 }) },
];

export const stages: StageDefinition[] = [
  { id: 'dev-stage-1', stage: 1, waves: ['dev-skirmisher', 'dev-brute', 'dev-warden'], rewardLevel: 1 },
  { id: 'dev-stage-2', stage: 2, waves: ['dev-brute', 'dev-skirmisher', 'dev-captain'], rewardLevel: 2 },
  { id: 'dev-stage-3', stage: 3, waves: ['dev-warden', 'dev-brute', 'dev-captain-hard'], rewardLevel: 3 },
];

export const developmentContent: CombatContent = { enemies, stages };

export function validateContent(content: CombatContent): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const enemy of content.enemies) {
    if (!enemy.id || !enemy.name || !enemy.archetype) errors.push('Enemy missing required fields');
    if (ids.has(enemy.id)) errors.push(`Duplicate ID: ${enemy.id}`);
    ids.add(enemy.id);
    if (!Number.isFinite(enemy.stats.maxHp) || enemy.stats.maxHp <= 0) errors.push(`Invalid enemy HP: ${enemy.id}`);
    if (!Number.isFinite(enemy.stats.attack) || enemy.stats.attack <= 0) errors.push(`Invalid enemy attack: ${enemy.id}`);
  }
  const enemyIds = new Set(content.enemies.map((enemy) => enemy.id));
  for (const stage of content.stages) {
    if (ids.has(stage.id)) errors.push(`Duplicate ID: ${stage.id}`);
    ids.add(stage.id);
    if (stage.stage < 1 || stage.waves.length !== 3) errors.push(`Invalid stage structure: ${stage.id}`);
    for (const enemyId of stage.waves) if (!enemyIds.has(enemyId)) errors.push(`Invalid enemy reference: ${stage.id}/${enemyId}`);
  }
  for (const base of ITEM_BASES) {
    if (ids.has(base.id)) errors.push(`Duplicate ID: ${base.id}`);
    ids.add(base.id);
    if (!base.name || base.primaryPerLevel <= 0) errors.push(`Malformed item base: ${base.id}`);
  }
  return errors;
}
