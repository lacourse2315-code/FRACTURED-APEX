import type { EquipmentItem, GameState, StatKey } from './state';
import type { RandomSource } from './rng';

export interface CombatStats {
  maxHp: number;
  attack: number;
  defense: number;
  attackSpeed: number;
  critChance: number;
  critDamage: number;
  accuracy: number;
  dodge: number;
  cooldownRecovery: number;
}

export type EnemyArchetype = 'brute' | 'skirmisher' | 'warden';
export interface EnemyDefinition {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  stats: CombatStats;
}
export interface StageDefinition {
  id: string;
  stage: number;
  waves: string[];
  rewardLevel: number;
}
export interface CombatContent {
  enemies: EnemyDefinition[];
  stages: StageDefinition[];
}
export type CombatStatus = 'idle' | 'fighting' | 'victory' | 'defeat';
export interface CombatEvent {
  type: 'damage' | 'heal' | 'shield' | 'skill' | 'wave' | 'victory' | 'defeat' | 'pyra';
  source: 'hero' | 'enemy' | 'pyra' | 'system';
  target?: 'hero' | 'enemy';
  amount?: number;
  critical?: boolean;
  label?: string;
}
export interface CombatSnapshot {
  status: CombatStatus;
  stage: number;
  wave: number;
  heroHp: number;
  heroMaxHp: number;
  heroShield: number;
  resolve: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyName: string;
  pyraCharge: number;
  currentSkill: string;
  diagnostic: 'SURVIVAL LOW' | 'DAMAGE LOW' | null;
}

const BASE_RIFTWARDEN: CombatStats = {
  maxHp: 1120,
  attack: 92,
  defense: 72,
  attackSpeed: 0.92,
  critChance: 0.08,
  critDamage: 1.65,
  accuracy: 100,
  dodge: 4,
  cooldownRecovery: 0,
};
const statKeys: StatKey[] = [
  'maxHp',
  'attack',
  'defense',
  'attackSpeed',
  'critChance',
  'critDamage',
  'accuracy',
  'dodge',
  'cooldownRecovery',
];

export function calculateRiftwardenStats(state: GameState): CombatStats {
  const stats = { ...BASE_RIFTWARDEN };
  const equippedIds = new Set(Object.values(state.equipped).filter(Boolean));
  for (const item of state.inventory) if (equippedIds.has(item.instanceId)) applyItem(stats, item);
  stats.attack *= 1.08;
  return roundStats(stats);
}
function applyItem(stats: CombatStats, item: EquipmentItem): void {
  for (const key of statKeys) {
    const primary = item.primary[key];
    if (typeof primary === 'number') stats[key] += primary;
  }
  for (const affix of item.affixes) stats[affix.stat] += affix.value;
}
function roundStats(stats: CombatStats): CombatStats {
  return {
    maxHp: Math.round(stats.maxHp),
    attack: Number(stats.attack.toFixed(2)),
    defense: Number(stats.defense.toFixed(2)),
    attackSpeed: Number(stats.attackSpeed.toFixed(3)),
    critChance: Number(stats.critChance.toFixed(4)),
    critDamage: Number(stats.critDamage.toFixed(3)),
    accuracy: Number(stats.accuracy.toFixed(2)),
    dodge: Number(stats.dodge.toFixed(2)),
    cooldownRecovery: Number(stats.cooldownRecovery.toFixed(4)),
  };
}
export function calculatePower(stats: CombatStats): number {
  return Math.round(
    stats.maxHp * 0.15 +
      stats.attack * 3.4 +
      stats.defense * 2.2 +
      stats.attackSpeed * 180 +
      stats.critChance * 900 +
      (stats.critDamage - 1) * 160 +
      stats.accuracy * 0.8 +
      stats.dodge * 2.2 +
      stats.cooldownRecovery * 500,
  );
}
export function hitChance(attacker: CombatStats, defender: CombatStats): number {
  return Math.max(0.55, Math.min(0.99, 0.9 + (attacker.accuracy - defender.dodge * 2) / 500));
}
export function mitigate(raw: number, defense: number): number {
  return raw * (100 / (100 + Math.max(0, defense)));
}
export function rollDamage(
  attacker: CombatStats,
  defender: CombatStats,
  multiplier: number,
  rng: RandomSource,
): { damage: number; critical: boolean; hit: boolean } {
  if (rng.next() > hitChance(attacker, defender)) return { damage: 0, critical: false, hit: false };
  const critical = rng.next() < attacker.critChance;
  const raw = attacker.attack * multiplier * (critical ? attacker.critDamage : 1);
  return { damage: Math.max(1, Math.round(mitigate(raw, defender.defense))), critical, hit: true };
}
interface RuntimeActor {
  hp: number;
  shield: number;
  stats: CombatStats;
}

export class CombatEngine {
  private status: CombatStatus = 'idle';
  private stage!: StageDefinition;
  private waveIndex = 0;
  private hero!: RuntimeActor;
  private enemy!: RuntimeActor;
  private enemyDef!: EnemyDefinition;
  private heroAttackTimer = 0;
  private enemyAttackTimer = 0;
  private pyraTimer = 0;
  private cooldowns = { cleave: 0, aegis: 0, slam: 0, worldbreaker: 0, retaliation: 0 };
  private resolve = 0;
  private pyraCharge = 0;
  private damageTaken = 0;
  private damageDone = 0;
  private currentSkill = 'Rift Cleaver';
  private events: CombatEvent[] = [];
  constructor(
    private readonly state: GameState,
    private readonly content: CombatContent,
    private readonly rng: RandomSource,
  ) {}

  start(stageNumber = this.state.campaign.stage): void {
    const stage = this.content.stages.find((s) => s.stage === stageNumber);
    if (!stage) throw new Error(`Missing development stage ${stageNumber}`);
    this.stage = stage;
    this.status = 'fighting';
    this.waveIndex = 0;
    const heroStats = calculateRiftwardenStats(this.state);
    this.hero = { hp: heroStats.maxHp, shield: 0, stats: heroStats };
    this.resolve = 0;
    this.pyraCharge = 0;
    this.damageTaken = 0;
    this.damageDone = 0;
    this.cooldowns = { cleave: 0, aegis: 0, slam: 0, worldbreaker: 0, retaliation: 0 };
    this.spawnWave();
  }
  tick(dtMs: number): CombatEvent[] {
    this.events = [];
    if (this.status !== 'fighting') return this.events;
    const dt = Math.max(0, Math.min(dtMs, 250));
    for (const key of Object.keys(this.cooldowns) as Array<keyof typeof this.cooldowns>)
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    this.heroAttackTimer -= dt;
    this.enemyAttackTimer -= dt;
    this.pyraTimer -= dt;
    if (this.hero.hp <= 0 || this.enemy.hp <= 0) return this.resolveDeaths();
    if (this.heroAttackTimer <= 0) this.heroAction();
    if (this.pyraTimer <= 0 && this.status === 'fighting') this.pyraAction();
    if (this.enemyAttackTimer <= 0 && this.status === 'fighting') this.enemyAction();
    if (this.hero.hp <= 0 || this.enemy.hp <= 0) this.resolveDeaths();
    return this.events;
  }
  snapshot(): CombatSnapshot {
    return {
      status: this.status,
      stage: this.stage?.stage ?? this.state.campaign.stage,
      wave: this.waveIndex + 1,
      heroHp: Math.max(0, Math.round(this.hero?.hp ?? 0)),
      heroMaxHp: Math.round(this.hero?.stats.maxHp ?? calculateRiftwardenStats(this.state).maxHp),
      heroShield: Math.max(0, Math.round(this.hero?.shield ?? 0)),
      resolve: Math.round(this.resolve),
      enemyHp: Math.max(0, Math.round(this.enemy?.hp ?? 0)),
      enemyMaxHp: Math.round(this.enemy?.stats.maxHp ?? 0),
      enemyName: this.enemyDef?.name ?? '',
      pyraCharge: this.pyraCharge,
      currentSkill: this.currentSkill,
      diagnostic:
        this.status === 'defeat' ? (this.damageTaken > this.damageDone * 1.2 ? 'SURVIVAL LOW' : 'DAMAGE LOW') : null,
    };
  }
  private heroAction(): void {
    const recovery = Math.max(0.5, 1 - this.hero.stats.cooldownRecovery);
    if (this.resolve >= 100 && this.cooldowns.worldbreaker <= 0) {
      this.resolve = 0;
      this.cooldowns.worldbreaker = 10500 * recovery;
      this.heroSkill('Worldbreaker', 2.9);
    } else if (this.hero.hp / this.hero.stats.maxHp < 0.58 && this.cooldowns.aegis <= 0) {
      this.currentSkill = 'Aegis Pulse';
      const amount = Math.round(this.hero.stats.maxHp * 0.24);
      this.hero.shield += amount;
      this.resolve = Math.min(100, this.resolve + 12);
      this.cooldowns.aegis = 9000 * recovery;
      this.pyraCharge++;
      this.events.push({ type: 'shield', source: 'hero', target: 'hero', amount, label: 'Aegis Pulse' });
      this.heroAttackTimer = 650;
    } else if (this.cooldowns.slam <= 0) {
      this.cooldowns.slam = 7200 * recovery;
      this.heroSkill('Gravitic Slam', 1.75);
    } else if (this.cooldowns.cleave <= 0) {
      this.cooldowns.cleave = 4300 * recovery;
      this.heroSkill('Fracture Cleave', 1.45);
    } else {
      this.currentSkill = 'Rift Cleaver';
      this.damageEnemy('hero', 1, 'Rift Cleaver');
      this.resolve = Math.min(100, this.resolve + 8);
      this.heroAttackTimer = 1000 / Math.max(0.25, this.hero.stats.attackSpeed);
    }
  }
  private heroSkill(label: string, multiplier: number): void {
    this.currentSkill = label;
    this.damageEnemy('hero', multiplier, label);
    this.resolve = Math.min(100, this.resolve + (label === 'Worldbreaker' ? 0 : 10));
    this.pyraCharge++;
    this.events.push({ type: 'skill', source: 'hero', label });
    this.heroAttackTimer = 720;
  }
  private pyraAction(): void {
    const pyraStats: CombatStats = {
      ...this.hero.stats,
      attack: Math.round(this.hero.stats.attack * 0.38 + 18),
      critChance: 0.12,
      critDamage: 1.5,
    };
    if (this.pyraCharge >= 3) {
      this.pyraCharge -= 3;
      const result = rollDamage(pyraStats, this.enemy.stats, 1.8, this.rng);
      this.applyEnemyDamage(result.damage, result.critical, 'pyra', 'Solar Pounce');
      this.events.push({ type: 'pyra', source: 'pyra', label: 'Solar Pounce' });
      this.pyraTimer = 1750;
    } else {
      const result = rollDamage(pyraStats, this.enemy.stats, 1, this.rng);
      this.applyEnemyDamage(result.damage, result.critical, 'pyra', 'Ember Bolt');
      this.pyraTimer = 1450;
    }
  }
  private enemyAction(): void {
    let multiplier = 1;
    let label = 'Attack';
    if (this.enemyDef.archetype === 'brute') {
      multiplier = 1.28;
      label = 'Crushing Blow';
    } else if (this.enemyDef.archetype === 'skirmisher') {
      multiplier = 0.78;
      label = 'Quick Slash';
    } else {
      multiplier = 0.95;
      label = 'Warden Strike';
    }
    const result = rollDamage(this.enemy.stats, this.hero.stats, multiplier, this.rng);
    if (result.hit) this.applyHeroDamage(result.damage, result.critical, label);
    this.enemyAttackTimer =
      (1000 / Math.max(0.25, this.enemy.stats.attackSpeed)) * (this.enemyDef.archetype === 'skirmisher' ? 0.82 : 1);
  }
  private damageEnemy(source: 'hero' | 'pyra', multiplier: number, label: string): void {
    const result = rollDamage(this.hero.stats, this.enemy.stats, multiplier, this.rng);
    this.applyEnemyDamage(result.damage, result.critical, source, label);
  }
  private applyEnemyDamage(amount: number, critical: boolean, source: 'hero' | 'pyra', label: string): void {
    if (amount <= 0) return;
    this.enemy.hp -= amount;
    this.damageDone += amount;
    this.events.push({ type: 'damage', source, target: 'enemy', amount, critical, label });
  }
  private applyHeroDamage(amount: number, critical: boolean, label: string): void {
    let remaining = amount;
    if (this.hero.shield > 0) {
      const absorbed = Math.min(this.hero.shield, remaining);
      this.hero.shield -= absorbed;
      remaining -= absorbed;
      this.resolve = Math.min(100, this.resolve + Math.max(3, Math.round(absorbed / 45)));
      this.events.push({ type: 'shield', source: 'enemy', target: 'hero', amount: absorbed, label: 'Blocked' });
    }
    if (remaining > 0) {
      this.hero.hp -= remaining;
      this.damageTaken += remaining;
      this.resolve = Math.min(100, this.resolve + Math.max(2, Math.round(remaining / 55)));
      this.events.push({ type: 'damage', source: 'enemy', target: 'hero', amount: remaining, critical, label });
    }
    if (this.cooldowns.retaliation <= 0 && this.rng.next() < 0.34 && this.hero.hp > 0) {
      this.cooldowns.retaliation = 2400;
      this.currentSkill = 'Retaliation';
      this.damageEnemy('hero', 0.72, 'Retaliation');
      this.resolve = Math.min(100, this.resolve + 8);
      this.events.push({ type: 'skill', source: 'hero', label: 'Retaliation' });
    }
  }
  private resolveDeaths(): CombatEvent[] {
    if (this.hero.hp <= 0) {
      this.status = 'defeat';
      this.state.statistics.defeats++;
      this.events.push({ type: 'defeat', source: 'system' });
      return this.events;
    }
    if (this.enemy.hp <= 0) {
      if (this.waveIndex < this.stage.waves.length - 1) {
        this.waveIndex++;
        this.spawnWave();
      } else {
        this.status = 'victory';
        this.state.statistics.victories++;
        this.state.campaign.highestCleared = Math.max(this.state.campaign.highestCleared, this.stage.stage);
        this.events.push({ type: 'victory', source: 'system' });
      }
    }
    return this.events;
  }
  private spawnWave(): void {
    const enemyId = this.stage.waves[this.waveIndex]!;
    const def = this.content.enemies.find((enemy) => enemy.id === enemyId);
    if (!def) throw new Error(`Missing enemy ${enemyId}`);
    this.enemyDef = def;
    this.enemy = { hp: def.stats.maxHp, shield: 0, stats: { ...def.stats } };
    this.enemyAttackTimer = 650;
    this.events.push({ type: 'wave', source: 'system', label: def.name });
  }
}
