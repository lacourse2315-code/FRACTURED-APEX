import type { GameSpeed } from './state';
export class FixedStepSimulation {
  private accumulator = 0;
  private speed: GameSpeed = 1;
  constructor(readonly fixedStepMs = 1000 / 60) {}
  setSpeed(speed: GameSpeed): void { this.speed = speed; }
  getSpeed(): GameSpeed { return this.speed; }
  advance(realDeltaMs: number, step: (dtMs: number) => void): number {
    const bounded = Math.max(0, Math.min(realDeltaMs, 250));
    this.accumulator += bounded * this.speed;
    let count = 0;
    while (this.accumulator >= this.fixedStepMs) {
      step(this.fixedStepMs);
      this.accumulator -= this.fixedStepMs;
      count++;
      if (count > 100) { this.accumulator = 0; break; }
    }
    return count;
  }
}
