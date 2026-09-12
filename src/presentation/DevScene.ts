import Phaser from 'phaser';
import type { EquipmentItem, GameSpeed, GameState } from '../core/state';
import { FixedStepSimulation } from '../core/simulation';
import { PlayableCore } from '../core/gameplay';
import { itemScore } from '../core/loot';
import { STRINGS } from '../shared/strings';
import { bindTap } from './input';

interface SafeBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface DebugApi {
  snapshot: () => ReturnType<PlayableCore['snapshot']>;
  state: () => GameState;
  power: () => number;
  loot: () => EquipmentItem | null;
  layout: () => { width: number; height: number; hud: SafeBounds; insets: SafeBounds };
  advance: (realDeltaMs: number) => number;
}
declare global {
  interface Window {
    __FA_DEBUG__?: DebugApi;
  }
}

export class DevScene extends Phaser.Scene {
  private sim = new FixedStepSimulation();
  private core: PlayableCore;
  private heroHp!: Phaser.GameObjects.Text;
  private enemyHp!: Phaser.GameObjects.Text;
  private resolveText!: Phaser.GameObjects.Text;
  private pyraText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private resourcesText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private lootText!: Phaser.GameObjects.Text;
  private diagnosticText!: Phaser.GameObjects.Text;
  private heroWeapon!: Phaser.GameObjects.Rectangle;
  private equipButton!: Phaser.GameObjects.Text;
  private keepButton!: Phaser.GameObjects.Text;
  private lockButton!: Phaser.GameObjects.Text;
  private nextButton!: Phaser.GameObjects.Text;
  private replayButton!: Phaser.GameObjects.Text;
  private retryButton!: Phaser.GameObjects.Text;
  private floaters: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly state: GameState,
    private readonly onSave: (s: GameState) => void,
  ) {
    super('DevScene');
    this.sim.setSpeed(state.settings.speed);
    this.core = new PlayableCore(state, onSave);
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    const hud = this.hudBounds(w, h);
    this.drawBackdrop(w, h);
    this.add
      .text(w / 2, hud.top, STRINGS.title, {
        fontFamily: 'Arial',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);
    this.add
      .text(w / 2, hud.top + 34, STRINGS.subtitle, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#8fa9d8',
      })
      .setOrigin(0.5, 0);
    this.stageText = this.add.text(hud.left, hud.top + 4, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#a9c7ff',
    });
    this.powerText = this.add
      .text(hud.right, hud.top + 4, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        align: 'right',
        color: '#ffd778',
      })
      .setOrigin(1, 0);
    this.makeMute(hud.right, hud.top);
    this.makeActors(w, h);
    this.makeHud(w, h, hud);
    this.makeSpeedButtons(w, hud.bottom);
    this.makeNav(w, hud);
    this.makeResultPanel(w, h);
    this.updateUi();
    this.scale.on('resize', () => this.scene.restart());
    if (import.meta.env.DEV) {
      window.__FA_DEBUG__ = {
        snapshot: () => this.core.snapshot(),
        state: () => this.state,
        power: () => this.core.power(),
        loot: () => this.core.loot(),
        layout: () => {
          const { width, height } = this.scale;
          return { width, height, hud: this.hudBounds(width, height), insets: this.safeInsets() };
        },
        advance: (realDeltaMs: number) => {
          const before = this.state.statistics.totalSimulationMs;
          this.sim.advance(realDeltaMs, (dt) => this.core.tick(dt));
          return this.state.statistics.totalSimulationMs - before;
        },
      };
    }
  }

  override update(_: number, delta: number): void {
    const events: ReturnType<PlayableCore['tick']> = [];
    this.sim.advance(delta, (dt) => events.push(...this.core.tick(dt)));
    for (const event of events) this.presentEvent(event);
    this.updateUi();
  }

  private safeInsets(): SafeBounds {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string): number => Number.parseFloat(style.getPropertyValue(name)) || 0;
    return {
      left: read('--safe-left'),
      right: read('--safe-right'),
      top: read('--safe-top'),
      bottom: read('--safe-bottom'),
    };
  }

  private hudBounds(w: number, h: number): SafeBounds {
    const insets = this.safeInsets();
    const horizontalGutter = 28;
    const verticalGutter = 18;
    const usableLeft = insets.left + horizontalGutter;
    const usableRight = w - insets.right - horizontalGutter;
    const usableTop = insets.top + verticalGutter;
    const usableBottom = h - insets.bottom - verticalGutter;
    const usableWidth = Math.max(0, usableRight - usableLeft);
    const usableHeight = Math.max(0, usableBottom - usableTop);
    const hudWidth = Math.min(usableWidth, usableHeight * (16 / 9));
    const left = Math.max(usableLeft, (w - hudWidth) / 2);
    const right = Math.min(usableRight, left + hudWidth);
    return { left, right, top: usableTop, bottom: usableBottom };
  }

  private drawBackdrop(w: number, h: number): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x05071b, 0x171044, 0x050817, 0x260d43, 1);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 58; i++) {
      g.fillStyle(0xffffff, 0.15 + (i % 4) * 0.06);
      g.fillCircle((i * 101) % w, (i * 59) % h, 1 + (i % 2));
    }
    g.lineStyle(2, 0x7a43ff, 0.2);
    g.strokeEllipse(w / 2, h * 0.43, w * 0.42, h * 0.5);
  }

  private makeActors(w: number, h: number): void {
    this.actor(w * 0.23, h * 0.47, 'RIFTWARDEN', 0x54b9ff);
    this.actor(w * 0.41, h * 0.53, 'PYRA', 0xff8f4a, 28);
    this.actor(w * 0.76, h * 0.47, 'ENEMY', 0xff577d);
    this.heroWeapon = this.add
      .rectangle(w * 0.29, h * 0.46, 76, 10, 0xb9e5ff)
      .setOrigin(0, 0.5)
      .setRotation(-0.22);
  }

  private actor(x: number, y: number, label: string, color: number, radius = 42): void {
    const g = this.add.graphics();
    g.fillStyle(color, 0.92);
    g.fillCircle(x, y, radius);
    g.lineStyle(3, 0xffffff, 0.65);
    g.strokeCircle(x, y, radius);
    this.add
      .text(x, y + radius + 12, label, { fontFamily: 'Arial', fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5, 0);
  }

  private makeHud(w: number, h: number, hud: SafeBounds): void {
    const hpY = hud.top + 72;
    this.heroHp = this.add.text(hud.left, hpY, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#8fffc1',
    });
    this.enemyHp = this.add
      .text(hud.right, hpY, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ff9caf',
        align: 'right',
      })
      .setOrigin(1, 0);
    this.resolveText = this.add.text(hud.left, hpY + 38, '', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#bda4ff',
    });
    this.pyraText = this.add.text(hud.left, hpY + 76, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffbd82',
    });
    this.skillText = this.add
      .text(w / 2, Math.min(h * 0.69, hud.bottom - 118), '', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#dfe8ff',
        backgroundColor: '#11182ccc',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5);
    this.resourcesText = this.add.text(hud.left, hud.bottom - 94, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#dbe7ff',
    });
  }

  private makeMute(hudRight: number, hudTop: number): void {
    const mute = this.add
      .text(hudRight, hudTop + 40, this.state.settings.muted ? 'UNMUTE' : STRINGS.mute, {
        fontFamily: 'Arial',
        fontSize: '12px',
        backgroundColor: '#1b2343',
        padding: { x: 12, y: 8 },
        color: '#fff',
      })
      .setOrigin(1, 0);
    bindTap(mute, () => {
      this.state.settings.muted = !this.state.settings.muted;
      this.sound.mute = this.state.settings.muted;
      mute.setText(this.state.settings.muted ? 'UNMUTE' : STRINGS.mute);
      this.onSave(this.state);
    });
    this.sound.mute = this.state.settings.muted;
  }

  private makeSpeedButtons(w: number, hudBottom: number): void {
    ([1, 2, 3] as GameSpeed[]).forEach((speed, i) => {
      const t = this.add
        .text(w / 2 - 92 + i * 92, hudBottom - 94, `x${speed}`, {
          fontFamily: 'Arial',
          fontSize: '18px',
          backgroundColor: this.state.settings.speed === speed ? '#5841a8' : '#1b2343',
          padding: { x: 20, y: 10 },
          color: '#fff',
        })
        .setName(`speed-${speed}`);
      bindTap(t, () => {
        this.state.settings.speed = speed;
        this.sim.setSpeed(speed);
        this.onSave(this.state);
        this.scene.restart();
      });
    });
  }

  private makeNav(w: number, hud: SafeBounds): void {
    const labels = [STRINGS.battle, STRINGS.hero, STRINGS.forge, STRINGS.companions, STRINGS.rifts, STRINGS.more];
    const cell = (hud.right - hud.left) / labels.length;
    labels.forEach((label, i) => {
      const t = this.add
        .text(hud.left + cell * i + cell / 2, hud.bottom - 18, label, {
          fontFamily: 'Arial',
          fontSize: '13px',
          color: i < 2 ? '#fff' : '#9aa7c7',
          backgroundColor: '#11182c',
          padding: { x: 8, y: 8 },
        })
        .setOrigin(0.5)
        .setName(`nav-${label.toLowerCase()}`);
      if (label === STRINGS.hero) bindTap(t, () => this.showHeroPanel(w, hud.bottom));
      else if (i > 1) bindTap(t, () => this.toast(`${label} — ${STRINGS.locked}`, w, hud.bottom));
    });
  }

  private makeResultPanel(w: number, h: number): void {
    this.resultText = this.add
      .text(w / 2, h * 0.18, '', {
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#fff',
        backgroundColor: '#0c122ddd',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.lootText = this.add
      .text(w / 2, h * 0.31, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        align: 'center',
        color: '#eef3ff',
        backgroundColor: '#101731ee',
        padding: { x: 18, y: 14 },
        wordWrap: { width: 430 },
      })
      .setOrigin(0.5, 0)
      .setDepth(20);
    this.diagnosticText = this.add
      .text(w / 2, h * 0.31, '', {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#ffcf8a',
        backgroundColor: '#101731ee',
        padding: { x: 18, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.equipButton = this.actionButton(w / 2 - 110, h * 0.61, 'EQUIP', () => this.core.equipPending());
    this.lockButton = this.actionButton(w / 2, h * 0.61, 'LOCK', () => this.core.toggleLockPending());
    this.keepButton = this.actionButton(w / 2 + 110, h * 0.61, 'KEEP', () => this.core.keepPending());
    this.replayButton = this.actionButton(w / 2 - 70, h * 0.61, 'REPLAY', () => this.core.replay());
    this.nextButton = this.actionButton(w / 2 + 70, h * 0.61, 'NEXT', () => this.core.nextStage());
    this.retryButton = this.actionButton(w / 2 - 65, h * 0.58, 'RETRY', () => this.core.retry());
    const hero = this.actionButton(w / 2 + 65, h * 0.58, 'HERO', () => this.showHeroPanel(w, h));
    hero.setName('defeat-hero');
  }

  private actionButton(x: number, y: number, label: string, action: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, label, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#5841a8',
        padding: { x: 15, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setName(`action-${label.toLowerCase()}`);
    bindTap(t, action);
    return t;
  }

  private showHeroPanel(w: number, h: number): void {
    const stats = this.core.stats();
    const gear = Object.entries(this.state.equipped)
      .map(
        ([slot, id]) =>
          `${slot.toUpperCase()}: ${id ? (this.state.inventory.find((i) => i.instanceId === id)?.name ?? 'Unknown') : 'Empty'}`,
      )
      .join('\n');
    const t = this.add
      .text(
        w / 2,
        h * 0.22,
        `RIFTWARDEN\nPOWER ${this.core.power()}\nHP ${stats.maxHp}  ATK ${stats.attack}  DEF ${stats.defense}\nCRIT ${(stats.critChance * 100).toFixed(1)}%  CDR ${(stats.cooldownRecovery * 100).toFixed(1)}%\n\n${gear}\n\nTap to close`,
        {
          fontFamily: 'Arial',
          fontSize: '15px',
          color: '#eef3ff',
          align: 'left',
          backgroundColor: '#0c122df4',
          padding: { x: 22, y: 18 },
        },
      )
      .setOrigin(0.5, 0)
      .setDepth(30);
    bindTap(t, () => t.destroy());
  }

  private updateUi(): void {
    const s = this.core.snapshot();
    this.stageText.setText(`${STRINGS.world}\nSTAGE ${s.stage} — WAVE ${Math.min(3, s.wave)}/3`);
    this.powerText.setText(`${STRINGS.power}\n${this.core.power()}`);
    this.heroHp.setText(
      `RIFTWARDEN  HP ${s.heroHp}/${s.heroMaxHp}${s.heroShield > 0 ? `  SHIELD ${s.heroShield}` : ''}`,
    );
    this.enemyHp.setText(`${s.enemyName}\nHP ${s.enemyHp}/${s.enemyMaxHp}`);
    this.resolveText.setText(`${STRINGS.resolve}: ${s.resolve}/100`);
    this.pyraText.setText(`${STRINGS.pyra}  •  SOLAR CHARGE ${s.pyraCharge}/3`);
    this.skillText.setText(`AUTO: ${s.currentSkill}`);
    this.resourcesText.setText(
      `${STRINGS.shards}: ${this.state.currencies.shards}   ${STRINGS.essence}: ${this.state.currencies.essence}`,
    );
    const weapon = this.state.equipped.weapon
      ? this.state.inventory.find((item) => item.instanceId === this.state.equipped.weapon)
      : null;
    const weaponColor = weapon?.rarity === 'rare' ? 0xd070ff : weapon?.rarity === 'uncommon' ? 0x69e49f : 0xb9e5ff;
    this.heroWeapon.setFillStyle(weaponColor).setSize(weapon ? 88 + weapon.itemLevel * 6 : 76, 10);

    const victory = s.status === 'victory';
    const defeat = s.status === 'defeat';
    const loot = this.core.loot();
    this.resultText
      .setVisible(victory || defeat)
      .setText(victory ? 'VICTORY — FRACTURE STABILIZED' : defeat ? 'DEFEAT' : '');
    this.lootText.setVisible(victory && !!loot).setText(loot ? this.formatLoot(loot) : '');
    this.diagnosticText
      .setVisible(defeat)
      .setText(defeat ? `${s.diagnostic ?? 'BUILD CHECK'}\nImprove gear or retry the stage.` : '');
    for (const button of [this.equipButton, this.lockButton, this.keepButton]) button.setVisible(victory && !!loot);
    this.replayButton.setVisible(victory && !loot);
    this.nextButton.setVisible(victory && !loot);
    this.retryButton.setVisible(defeat);
    const defeatHero = this.children.getByName('defeat-hero') as Phaser.GameObjects.Text | null;
    defeatHero?.setVisible(defeat);
  }

  private formatLoot(item: EquipmentItem): string {
    const stats = [...Object.entries(item.primary), ...item.affixes.map((a) => [a.stat, a.value] as const)]
      .map(
        ([stat, value]) =>
          `${String(stat).toUpperCase()} +${typeof value === 'number' && value < 1 ? (value * 100).toFixed(1) + '%' : Number(value).toFixed(1)}`,
      )
      .join('   ');
    const delta = this.core.comparison();
    const locked = this.state.lockedItemIds.includes(item.instanceId) ? 'LOCKED • ' : '';
    return `LOOT FOUND\n${locked}${item.name.toUpperCase()}  [${item.rarity.toUpperCase()}]\n${item.slot.toUpperCase()} • ITEM LV ${item.itemLevel} • SCORE ${itemScore(item)}\n${stats}\nCOMPARE: ${delta >= 0 ? '+' : ''}${delta}`;
  }

  private presentEvent(event: ReturnType<PlayableCore['tick']>[number]): void {
    if (event.type === 'damage' && event.amount) {
      this.floater(
        event.target === 'hero' ? 310 : 965,
        310,
        `${Math.round(event.amount)}${event.critical ? '!' : ''}`,
        event.target === 'hero' ? '#ff8a8a' : '#ffffff',
      );
    }
    if (event.type === 'shield' && event.amount)
      this.floater(310, 350, `SHIELD ${Math.round(event.amount)}`, '#83c9ff');
    if (event.type === 'pyra' && event.label) this.floater(520, 350, event.label, '#ffad67');
  }

  private floater(x: number, y: number, text: string, color: string): void {
    if (this.floaters.length >= 12) this.floaters.shift()?.destroy();
    const t = this.add
      .text(x, y, text, { fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color })
      .setOrigin(0.5)
      .setDepth(15);
    this.floaters.push(t);
    this.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        this.floaters = this.floaters.filter((f) => f !== t);
        t.destroy();
      },
    });
  }

  private toast(message: string, w: number, h: number): void {
    const t = this.add
      .text(w / 2, h * 0.72, message, {
        fontFamily: 'Arial',
        fontSize: '15px',
        backgroundColor: '#10172e',
        padding: { x: 16, y: 10 },
        color: '#ffdb8a',
      })
      .setOrigin(0.5)
      .setDepth(25);
    this.time.delayedCall(1200, () => t.destroy());
  }
}
