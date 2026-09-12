import { calculatePower, calculateRiftwardenStats, CombatEngine, type CombatEvent } from './combat';
import { comparisonDelta, equipItem, generateItem, toggleItemLock } from './loot';
import { SeededRng } from './rng';
import type { EquipmentItem, GameState } from './state';
import { developmentContent } from '../content/content';

export class PlayableCore {
  private rng: SeededRng;
  private engine: CombatEngine;
  private pendingLoot: EquipmentItem | null = null;
  constructor(readonly state: GameState, private readonly save: (state: GameState) => void, seed = 0xface0202) {
    this.rng = new SeededRng(seed + state.statistics.victories * 97 + state.campaign.stage * 17);
    this.engine = new CombatEngine(state, developmentContent, this.rng);
    this.engine.start(state.campaign.stage);
  }
  tick(dtMs: number): CombatEvent[] {
    const events = this.engine.tick(dtMs); this.state.statistics.totalSimulationMs += dtMs;
    if (events.some((event) => event.type === 'victory')) this.onVictory();
    if (events.some((event) => event.type === 'defeat')) this.save(this.state);
    return events;
  }
  snapshot() { return this.engine.snapshot(); }
  power(): number { return calculatePower(calculateRiftwardenStats(this.state)); }
  stats() { return calculateRiftwardenStats(this.state); }
  loot(): EquipmentItem | null { return this.pendingLoot; }
  comparison(): number { return this.pendingLoot ? comparisonDelta(this.state, this.pendingLoot) : 0; }
  equipPending(): void { if (!this.pendingLoot) return; equipItem(this.state, this.pendingLoot.instanceId); this.pendingLoot = null; this.save(this.state); }
  keepPending(): void { this.pendingLoot = null; this.save(this.state); }
  toggleLockPending(): void { if (this.pendingLoot) { toggleItemLock(this.state, this.pendingLoot.instanceId); this.save(this.state); } }
  retry(): void { this.pendingLoot = null; this.engine = new CombatEngine(this.state, developmentContent, this.rng); this.engine.start(this.state.campaign.stage); }
  replay(): void { this.retry(); }
  nextStage(): void { this.pendingLoot = null; this.state.campaign.stage = Math.min(3, this.state.campaign.stage + 1); this.engine = new CombatEngine(this.state, developmentContent, this.rng); this.engine.start(this.state.campaign.stage); this.save(this.state); }
  setStage(stage: number): void { if (stage < 1 || stage > 3) throw new Error('Invalid development stage'); this.state.campaign.stage = stage; this.engine = new CombatEngine(this.state, developmentContent, this.rng); this.engine.start(stage); this.save(this.state); }
  private onVictory(): void {
    this.state.currencies.shards += 6 + this.state.campaign.stage * 2; this.state.companion.bondXp += 3;
    const forcedSlot = this.state.statistics.victories === 1 ? 'weapon' : undefined;
    const item = generateItem(this.state.campaign.stage, this.rng, undefined, forcedSlot); this.state.inventory.push(item); this.pendingLoot = item; this.save(this.state);
  }
}
