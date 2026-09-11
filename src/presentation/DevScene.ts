import Phaser from 'phaser';
import { FixedStepSimulation, type GameSpeed } from '../core/simulation';
import type { GameState } from '../core/state';
import { STRINGS } from '../shared/strings';
export class DevScene extends Phaser.Scene {
  private sim = new FixedStepSimulation();
  constructor(
    private readonly state: GameState,
    private readonly onSave: (s: GameState) => void,
  ) {
    super('DevScene');
    this.sim.setSpeed(state.settings.speed);
  }
  create(): void {
    const { width: w, height: h } = this.scale;
    const g = this.add.graphics();
    g.fillGradientStyle(0x07091d, 0x151347, 0x050817, 0x201050, 1);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(0xffffff, 0.18 + (i % 4) * 0.08);
      g.fillCircle((i * 83) % w, (i * 47) % h, 1 + (i % 2));
    }
    this.add
      .text(w / 2, 24, STRINGS.title, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5, 0);
    this.add.text(28, 80, `${STRINGS.world}\n${STRINGS.stage}`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#a9c7ff',
    });
    this.add
      .text(w - 28, 80, `${STRINGS.power}\n100`, {
        fontFamily: 'Arial',
        fontSize: '18px',
        align: 'right',
        color: '#ffd778',
      })
      .setOrigin(1, 0);
    this.entity(w * 0.25, h * 0.48, 'HERO', 0x67d6ff);
    this.entity(w * 0.42, h * 0.55, 'COMPANION', 0xb281ff);
    this.entity(w * 0.73, h * 0.48, 'ENEMY', 0xff6b8b);
    this.add.text(
      28,
      h - 116,
      `${STRINGS.shards}: ${this.state.currencies.shards}   ${STRINGS.essence}: ${this.state.currencies.essence}`,
      { fontFamily: 'Arial', fontSize: '16px', color: '#dbe7ff' },
    );
    this.makeSpeedButtons(w, h);
    this.makeNav(w, h);
    this.scale.on('resize', () => this.scene.restart());
  }
  private entity(x: number, y: number, label: string, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(color, 0.9);
    g.fillCircle(x, y, 42);
    g.lineStyle(3, 0xffffff, 0.7);
    g.strokeCircle(x, y, 42);
    this.add.text(x, y + 58, label, { fontFamily: 'Arial', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
  }
  private makeSpeedButtons(w: number, h: number): void {
    ([1, 2, 3] as GameSpeed[]).forEach((s, i) => {
      const t = this.add
        .text(w / 2 - 80 + i * 80, h - 116, `x${s}`, {
          fontFamily: 'Arial',
          fontSize: '18px',
          backgroundColor: this.state.settings.speed === s ? '#5841a8' : '#1b2343',
          padding: { x: 18, y: 10 },
          color: '#fff',
        })
        .setInteractive({ useHandCursor: true });
      t.on('pointerup', () => {
        this.state.settings.speed = s;
        this.sim.setSpeed(s);
        this.onSave(this.state);
        this.scene.restart();
      });
    });
  }
  private makeNav(w: number, h: number): void {
    const labels = [STRINGS.battle, STRINGS.hero, STRINGS.forge, STRINGS.companions, STRINGS.rifts, STRINGS.more];
    const cell = w / labels.length;
    labels.forEach((label, i) => {
      const text = this.add
        .text(cell * i + cell / 2, h - 40, label, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: i === 0 ? '#fff' : '#9aa7c7',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      if (i > 0) text.on('pointerup', () => this.showLocked(label));
    });
  }
  private showLocked(label: string): void {
    const { width: w, height: h } = this.scale;
    const t = this.add
      .text(w / 2, h * 0.68, `${label} — ${STRINGS.locked}`, {
        fontFamily: 'Arial',
        fontSize: '16px',
        backgroundColor: '#10172e',
        padding: { x: 16, y: 10 },
        color: '#ffdb8a',
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.time.delayedCall(1300, () => t.destroy());
  }
  override update(_: number, delta: number): void {
    this.sim.advance(delta, (dt) => {
      this.state.statistics.totalSimulationMs += dt;
    });
  }
}
