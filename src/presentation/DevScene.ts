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

interface ActorLayout {
  heroX: number;
  heroY: number;
  pyraX: number;
  pyraY: number;
  enemyX: number;
  enemyY: number;
}

interface DebugApi {
  snapshot: () => ReturnType<PlayableCore['snapshot']>;
  state: () => GameState;
  power: () => number;
  loot: () => EquipmentItem | null;
  layout: () => { width: number; height: number; hud: SafeBounds; insets: SafeBounds };
  visuals: () => {
    renderer: string;
    hero: boolean;
    pyra: boolean;
    enemy: boolean;
    hpBars: boolean;
    resolveMeter: boolean;
  };
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
  private equipButton!: Phaser.GameObjects.Text;
  private keepButton!: Phaser.GameObjects.Text;
  private lockButton!: Phaser.GameObjects.Text;
  private nextButton!: Phaser.GameObjects.Text;
  private replayButton!: Phaser.GameObjects.Text;
  private retryButton!: Phaser.GameObjects.Text;
  private heroActor!: Phaser.GameObjects.Container;
  private pyraActor!: Phaser.GameObjects.Container;
  private enemyActor!: Phaser.GameObjects.Container;
  private heroAura!: Phaser.GameObjects.Arc;
  private heroMeter!: Phaser.GameObjects.Graphics;
  private enemyMeter!: Phaser.GameObjects.Graphics;
  private resolveMeter!: Phaser.GameObjects.Graphics;
  private pyraMeter!: Phaser.GameObjects.Graphics;
  private floaters: Phaser.GameObjects.Text[] = [];
  private layout!: ActorLayout;
  private hud!: SafeBounds;
  private lastStatus = '';

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
    this.hud = this.hudBounds(w, h);
    this.layout = this.actorLayout(w, h, this.hud);
    this.drawBackdrop(w, h);
    this.makeTopHud(w, this.hud);
    this.makeActors();
    this.makeHud(w, h, this.hud);
    this.makeSpeedButtons(w, this.hud.bottom);
    this.makeNav(w, this.hud);
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
        visuals: () => ({
          renderer: 'vector-combat-v1',
          hero: this.heroActor?.active === true,
          pyra: this.pyraActor?.active === true,
          enemy: this.enemyActor?.active === true,
          hpBars: this.heroMeter?.active === true && this.enemyMeter?.active === true,
          resolveMeter: this.resolveMeter?.active === true,
        }),
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

  private actorLayout(w: number, h: number, hud: SafeBounds): ActorLayout {
    const combatTop = hud.top + 100;
    const combatBottom = hud.bottom - 118;
    const cy = combatTop + (combatBottom - combatTop) * 0.55;
    return {
      heroX: hud.left + (hud.right - hud.left) * 0.25,
      heroY: cy,
      pyraX: hud.left + (hud.right - hud.left) * 0.43,
      pyraY: cy + Math.min(48, h * 0.07),
      enemyX: hud.left + (hud.right - hud.left) * 0.75,
      enemyY: cy,
    };
  }

  private drawBackdrop(w: number, h: number): void {
    const g = this.add.graphics().setDepth(-20);
    g.fillGradientStyle(0x030617, 0x171046, 0x07162a, 0x2b0b3f, 1);
    g.fillRect(0, 0, w, h);

    g.fillStyle(0x35126b, 0.22);
    g.fillEllipse(w * 0.55, h * 0.36, w * 0.82, h * 0.82);
    g.fillStyle(0x0e79a8, 0.1);
    g.fillEllipse(w * 0.23, h * 0.46, w * 0.52, h * 0.62);

    for (let i = 0; i < 82; i++) {
      const x = (i * 137 + 41) % w;
      const y = (i * 71 + 23) % Math.max(1, h * 0.76);
      const alpha = 0.12 + (i % 5) * 0.045;
      g.fillStyle(i % 7 === 0 ? 0xb895ff : 0xffffff, alpha);
      g.fillCircle(x, y, 1 + (i % 3) * 0.45);
    }

    this.drawFracture(g, w * 0.5, h * 0.15, h * 0.52, 0x8a48ff, 0.34);
    this.drawFracture(g, w * 0.84, h * 0.08, h * 0.34, 0xff477f, 0.18);
    this.drawFracture(g, w * 0.12, h * 0.18, h * 0.3, 0x3fb8ff, 0.16);

    g.fillStyle(0x070a18, 0.88);
    g.fillRect(0, h * 0.72, w, h * 0.28);
    g.fillStyle(0x16132e, 1);
    g.fillTriangle(0, h * 0.75, w * 0.24, h * 0.64, w * 0.42, h * 0.75);
    g.fillTriangle(w * 0.58, h * 0.75, w * 0.79, h * 0.63, w, h * 0.75);
    g.fillStyle(0x261b4f, 0.8);
    g.fillEllipse(w * 0.5, h * 0.72, w * 0.6, h * 0.13);
    g.lineStyle(2, 0x6d45d8, 0.45);
    g.strokeEllipse(w * 0.5, h * 0.72, w * 0.6, h * 0.13);

    for (let i = 0; i < 8; i++) {
      const shardX = w * (0.08 + i * 0.12);
      const shardY = h * (0.23 + (i % 3) * 0.11);
      g.fillStyle(i % 2 ? 0x764bff : 0x2b7fbd, 0.18);
      g.fillTriangle(shardX, shardY - 14, shardX + 8, shardY + 10, shardX - 6, shardY + 7);
    }
  }

  private drawFracture(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    length: number,
    color: number,
    alpha: number,
  ): void {
    g.lineStyle(2, color, alpha);
    const points = [
      new Phaser.Math.Vector2(x, y),
      new Phaser.Math.Vector2(x - 12, y + length * 0.16),
      new Phaser.Math.Vector2(x + 10, y + length * 0.32),
      new Phaser.Math.Vector2(x - 7, y + length * 0.48),
      new Phaser.Math.Vector2(x + 16, y + length * 0.66),
      new Phaser.Math.Vector2(x + 4, y + length * 0.82),
      new Phaser.Math.Vector2(x + 9, y + length),
    ];
    g.strokePoints(points, false, false);
  }

  private makeTopHud(w: number, hud: SafeBounds): void {
    this.add
      .text(w / 2, hud.top, 'FRACTURED APEX', {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.92);
    this.add
      .text(w / 2, hud.top + 25, 'DEVELOPMENT FRACTURE', {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#8fa9d8',
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0);

    this.stageText = this.add.text(hud.left, hud.top + 4, '', {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#b8ceff',
      lineSpacing: 2,
    });
    this.powerText = this.add
      .text(hud.right, hud.top + 4, '', {
        fontFamily: 'Arial',
        fontSize: '12px',
        align: 'right',
        color: '#d7bfff',
      })
      .setOrigin(1, 0);
    this.makeMute(hud.right, hud.top);
  }

  private makeActors(): void {
    const { heroX, heroY, pyraX, pyraY, enemyX, enemyY } = this.layout;
    this.heroAura = this.add.circle(heroX, heroY + 34, 86, 0x7b4dff, 0.1).setDepth(1);
    this.heroAura.setStrokeStyle(2, 0x8d63ff, 0.35);
    this.heroActor = this.makeRiftwarden(heroX, heroY).setName('visual-riftwarden');
    this.pyraActor = this.makePyra(pyraX, pyraY).setName('visual-pyra');
    this.enemyActor = this.makeFractureWarden(enemyX, enemyY).setName('visual-fracture-warden');

    this.tweens.add({
      targets: this.pyraActor,
      y: pyraY - 8,
      duration: 1050,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.tweens.add({
      targets: [this.heroAura],
      alpha: { from: 0.35, to: 0.7 },
      scale: { from: 0.98, to: 1.04 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private makeRiftwarden(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(5);
    const shadow = this.add.ellipse(0, 86, 132, 24, 0x000000, 0.35);
    const cloak = this.add.triangle(-20, 18, -54, -58, 4, -42, -24, 80, 0x10172f, 0.95);
    const legL = this.add.rectangle(-28, 54, 28, 80, 0x182440).setStrokeStyle(3, 0x6684b0);
    const legR = this.add.rectangle(20, 54, 28, 80, 0x182440).setStrokeStyle(3, 0x6684b0);
    const body = this.add.polygon(0, -20, [-58, -35, -38, -78, 0, -92, 42, -76, 58, -28, 36, 36, 0, 50, -38, 34], 0x18233e);
    body.setStrokeStyle(4, 0x7894bf, 1);
    const shoulderL = this.add.circle(-54, -48, 24, 0x26375d).setStrokeStyle(4, 0x8aa7d2);
    const shoulderR = this.add.circle(52, -48, 24, 0x26375d).setStrokeStyle(4, 0x8aa7d2);
    const helm = this.add.polygon(0, -112, [-34, -19, -24, -52, 0, -66, 28, -48, 36, -16, 20, 15, -22, 15], 0x17213a);
    helm.setStrokeStyle(4, 0x91acd1);
    const hornL = this.add.triangle(-28, -151, 0, 35, -24, -28, 8, 30, 0x213052).setStrokeStyle(2, 0x6f8cb8);
    const hornR = this.add.triangle(28, -151, 0, 35, 24, -28, -8, 30, 0x213052).setStrokeStyle(2, 0x6f8cb8);
    const visor = this.add.rectangle(0, -116, 48, 8, 0x8f68ff, 0.95);
    const core = this.add.diamond(0, -36, 0, 26, 14, 0x9d67ff, 0.9).setStrokeStyle(2, 0xe0d2ff);
    const arm = this.add.rectangle(55, -2, 24, 82, 0x1b2948).setRotation(-0.32).setStrokeStyle(3, 0x718bb6);
    const grip = this.add.rectangle(78, -23, 14, 64, 0x27395d).setRotation(-0.55);
    const blade = this.add.polygon(118, -57, [-14, -80, 15, -80, 25, 70, 0, 94, -16, 68], 0x9bc4df);
    blade.setRotation(-0.55).setStrokeStyle(3, 0xdff5ff);
    const bladeRift = this.add.rectangle(116, -61, 6, 110, 0xa46cff, 0.9).setRotation(-0.55);
    const crack1 = this.add.line(0, 0, -22, -58, -5, -36, 14, -62, 0xa56cff, 0.85).setLineWidth(3);
    const crack2 = this.add.line(0, 0, 8, -16, -9, 9, 12, 25, 0x7651e8, 0.75).setLineWidth(2);
    c.add([
      shadow,
      cloak,
      legL,
      legR,
      body,
      shoulderL,
      shoulderR,
      arm,
      grip,
      blade,
      bladeRift,
      helm,
      hornL,
      hornR,
      visor,
      core,
      crack1,
      crack2,
    ]);
    c.setScale(0.78);
    return c;
  }

  private makePyra(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(6);
    const glow = this.add.circle(0, 0, 54, 0xff7a32, 0.12);
    const wingL = this.add.triangle(-34, 0, 0, -4, -72, -54, -52, 22, 0xff9a3a, 0.9).setStrokeStyle(2, 0xffd16a);
    const wingR = this.add.triangle(34, 0, 0, -4, 72, -54, 52, 22, 0xff9a3a, 0.9).setStrokeStyle(2, 0xffd16a);
    const tail = this.add.triangle(-43, 28, -6, -9, -86, 26, -62, 45, 0xe9512c, 0.9).setStrokeStyle(2, 0xffa04a);
    const body = this.add.ellipse(0, 12, 72, 58, 0xf07032).setStrokeStyle(3, 0xffc45e);
    const head = this.add.circle(0, -28, 29, 0xff8b34).setStrokeStyle(3, 0xffdc78);
    const earL = this.add.triangle(-17, -54, 0, 23, -21, -14, 4, 13, 0xffa33e).setStrokeStyle(2, 0xffdc78);
    const earR = this.add.triangle(17, -54, 0, 23, 21, -14, -4, 13, 0xffa33e).setStrokeStyle(2, 0xffdc78);
    const eyeL = this.add.circle(-10, -31, 4, 0x2e1220);
    const eyeR = this.add.circle(10, -31, 4, 0x2e1220);
    const ember = this.add.circle(0, 6, 8, 0xffef9d, 0.95);
    c.add([glow, wingL, wingR, tail, body, head, earL, earR, eyeL, eyeR, ember]);
    c.setScale(0.72);
    return c;
  }

  private makeFractureWarden(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(5);
    const shadow = this.add.ellipse(0, 88, 130, 24, 0x000000, 0.38);
    const legL = this.add.rectangle(-26, 55, 30, 82, 0x291431).setStrokeStyle(3, 0x864b95);
    const legR = this.add.rectangle(22, 55, 30, 82, 0x291431).setStrokeStyle(3, 0x864b95);
    const body = this.add.polygon(0, -20, [-60, -30, -42, -79, 0, -95, 43, -78, 60, -28, 37, 39, 0, 52, -38, 38], 0x28132f);
    body.setStrokeStyle(4, 0xa25aab);
    const shoulderL = this.add.polygon(-54, -52, [-28, 8, -8, -26, 28, -18, 22, 18, -6, 28], 0x3d1b47).setStrokeStyle(3, 0xb565bf);
    const shoulderR = this.add.polygon(54, -52, [-28, -18, 8, -26, 28, 8, 6, 28, -22, 18], 0x3d1b47).setStrokeStyle(3, 0xb565bf);
    const helm = this.add.polygon(0, -114, [-34, -18, -26, -52, 0, -69, 29, -49, 36, -14, 18, 16, -20, 16], 0x211027);
    helm.setStrokeStyle(4, 0xb867c2);
    const crystalL = this.add.triangle(-31, -155, 0, 44, -27, -24, 11, 24, 0xc33cff, 0.9).setStrokeStyle(2, 0xff5d9f);
    const crystalR = this.add.triangle(31, -155, 0, 44, 27, -24, -11, 24, 0xc33cff, 0.9).setStrokeStyle(2, 0xff5d9f);
    const visor = this.add.rectangle(0, -118, 48, 8, 0xff477b, 0.95);
    const core = this.add.diamond(0, -34, 0, 29, 16, 0xe245a5, 0.88).setStrokeStyle(2, 0xff9bc8);
    const arm = this.add.rectangle(-56, -2, 24, 82, 0x35163e).setRotation(0.26).setStrokeStyle(3, 0x9551a4);
    const glaiveGrip = this.add.rectangle(-83, -6, 12, 130, 0x4b2455).setRotation(0.16);
    const glaive = this.add.triangle(-104, -74, 0, 50, -50, -8, -2, -70, 0xd745a1, 0.9).setRotation(0.16).setStrokeStyle(3, 0xff79b5);
    const crack1 = this.add.line(0, 0, -15, -56, 5, -36, -9, -14, 0xd346ff, 0.85).setLineWidth(3);
    const crack2 = this.add.line(0, 0, 11, -17, -5, 10, 17, 28, 0xff477b, 0.8).setLineWidth(2);
    c.add([
      shadow,
      legL,
      legR,
      body,
      shoulderL,
      shoulderR,
      arm,
      glaiveGrip,
      glaive,
      helm,
      crystalL,
      crystalR,
      visor,
      core,
      crack1,
      crack2,
    ]);
    c.setScale(0.78);
    return c;
  }

  private makeHud(w: number, h: number, hud: SafeBounds): void {
    const meterY = this.layout.heroY - Math.min(128, h * 0.2);
    this.heroMeter = this.add.graphics().setDepth(12).setName('hud-hero-hp-bar');
    this.enemyMeter = this.add.graphics().setDepth(12).setName('hud-enemy-hp-bar');
    this.resolveMeter = this.add.graphics().setDepth(12).setName('hud-resolve-bar');
    this.pyraMeter = this.add.graphics().setDepth(12).setName('hud-pyra-charge');

    this.heroHp = this.add
      .text(this.layout.heroX, meterY - 18, '', {
        fontFamily: 'Arial',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#dff7ff',
      })
      .setOrigin(0.5, 1)
      .setDepth(13);
    this.enemyHp = this.add
      .text(this.layout.enemyX, meterY - 18, '', {
        fontFamily: 'Arial',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffe2ed',
      })
      .setOrigin(0.5, 1)
      .setDepth(13);

    this.resolveText = this.add
      .text(w / 2, hud.top + 58, '', {
        fontFamily: 'Arial',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#dbcfff',
      })
      .setOrigin(0.5, 0)
      .setDepth(13);
    this.pyraText = this.add
      .text(this.layout.pyraX, this.layout.pyraY + 56, '', {
        fontFamily: 'Arial',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffd28a',
      })
      .setOrigin(0.5, 0)
      .setDepth(13);
    this.skillText = this.add
      .text(w / 2, Math.min(h * 0.69, hud.bottom - 122), '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#eaf1ff',
        backgroundColor: '#0c1227dd',
        padding: { x: 13, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(13);
    this.resourcesText = this.add.text(hud.left, hud.bottom - 90, '', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#afbddb',
    });
  }

  private drawMeter(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    ratio: number,
    color: number,
    glow: number,
  ): void {
    const value = Phaser.Math.Clamp(ratio, 0, 1);
    g.clear();
    g.fillStyle(0x060915, 0.82);
    g.fillRoundedRect(x, y, width, height, Math.min(7, height / 2));
    g.lineStyle(1, 0xffffff, 0.16);
    g.strokeRoundedRect(x, y, width, height, Math.min(7, height / 2));
    if (value > 0) {
      g.fillStyle(glow, 0.25);
      g.fillRoundedRect(x + 2, y + 2, Math.max(4, (width - 4) * value), height - 4, Math.min(5, height / 2));
      g.fillStyle(color, 0.95);
      g.fillRoundedRect(x + 2, y + 2, Math.max(3, (width - 4) * value), height - 5, Math.min(5, height / 2));
    }
  }

  private makeMute(hudRight: number, hudTop: number): void {
    const mute = this.add
      .text(hudRight, hudTop + 32, this.state.settings.muted ? 'UNMUTE' : STRINGS.mute, {
        fontFamily: 'Arial',
        fontSize: '10px',
        backgroundColor: '#12182fdd',
        padding: { x: 10, y: 7 },
        color: '#c8d3ec',
      })
      .setOrigin(1, 0)
      .setDepth(15);
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
        .text(w / 2 - 74 + i * 74, hudBottom - 90, `x${speed}`, {
          fontFamily: 'Arial',
          fontSize: '14px',
          fontStyle: 'bold',
          backgroundColor: this.state.settings.speed === speed ? '#6b4fd1' : '#141b35dd',
          padding: { x: 16, y: 8 },
          color: '#fff',
        })
        .setOrigin(0.5)
        .setDepth(15)
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
          fontSize: '11px',
          fontStyle: i < 2 ? 'bold' : 'normal',
          color: i < 2 ? '#ffffff' : '#8793b2',
          backgroundColor: i === 0 ? '#332366ee' : '#0e1428e8',
          padding: { x: 8, y: 7 },
        })
        .setOrigin(0.5)
        .setDepth(15)
        .setName(`nav-${label.toLowerCase()}`);
      if (label === STRINGS.hero) bindTap(t, () => this.showHeroPanel(w, hud.bottom));
      else if (i > 1) bindTap(t, () => this.toast(`${label} — ${STRINGS.locked}`, w, hud.bottom));
    });
  }

  private makeResultPanel(w: number, h: number): void {
    this.resultText = this.add
      .text(w / 2, h * 0.17, '', {
        fontFamily: 'Arial',
        fontSize: '21px',
        fontStyle: 'bold',
        color: '#fff',
        backgroundColor: '#0a1029ee',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.lootText = this.add
      .text(w / 2, h * 0.28, '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        align: 'center',
        color: '#eef3ff',
        backgroundColor: '#101731f4',
        padding: { x: 18, y: 14 },
        wordWrap: { width: Math.min(430, w * 0.55) },
      })
      .setOrigin(0.5, 0)
      .setDepth(30);
    this.diagnosticText = this.add
      .text(w / 2, h * 0.31, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffcf8a',
        backgroundColor: '#101731ee',
        padding: { x: 18, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.equipButton = this.actionButton(w / 2 - 110, h * 0.6, 'EQUIP', () => this.core.equipPending());
    this.lockButton = this.actionButton(w / 2, h * 0.6, 'LOCK', () => this.core.toggleLockPending());
    this.keepButton = this.actionButton(w / 2 + 110, h * 0.6, 'KEEP', () => this.core.keepPending());
    this.replayButton = this.actionButton(w / 2 - 70, h * 0.6, 'REPLAY', () => this.core.replay());
    this.nextButton = this.actionButton(w / 2 + 70, h * 0.6, 'NEXT', () => this.core.nextStage());
    this.retryButton = this.actionButton(w / 2 - 65, h * 0.58, 'RETRY', () => this.core.retry());
    const hero = this.actionButton(w / 2 + 65, h * 0.58, 'HERO', () => this.showHeroPanel(w, h));
    hero.setName('defeat-hero');
  }

  private actionButton(x: number, y: number, label: string, action: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, label, {
        fontFamily: 'Arial',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fff',
        backgroundColor: '#674bd0',
        padding: { x: 16, y: 11 },
      })
      .setOrigin(0.5)
      .setDepth(31)
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
      .setDepth(40);
    bindTap(t, () => t.destroy());
  }

  private updateUi(): void {
    const s = this.core.snapshot();
    this.stageText.setText(`STAGE ${s.stage}\nWAVE ${Math.min(3, s.wave)}/3`);
    this.powerText.setText(`POWER  ${this.core.power()}`);
    this.heroHp.setText(`RIFTWARDEN  ${s.heroHp}/${s.heroMaxHp}${s.heroShield > 0 ? `  +${s.heroShield}` : ''}`);
    this.enemyHp.setText(`${s.enemyName.toUpperCase()}  ${s.enemyHp}/${s.enemyMaxHp}`);
    this.resolveText.setText(`RESOLVE  ${s.resolve}/100`);
    this.pyraText.setText(`PYRA  •  SOLAR ${s.pyraCharge}/3`);
    this.skillText.setText(`AUTO  •  ${s.currentSkill}`);
    this.resourcesText.setText(`SHARDS ${this.state.currencies.shards}   ESSENCE ${this.state.currencies.essence}`);

    const meterY = this.layout.heroY - 118;
    this.drawMeter(this.heroMeter, this.layout.heroX - 76, meterY, 152, 11, s.heroHp / Math.max(1, s.heroMaxHp), 0x46d59a, 0x7effc9);
    this.drawMeter(this.enemyMeter, this.layout.enemyX - 76, meterY, 152, 11, s.enemyHp / Math.max(1, s.enemyMaxHp), 0xea426f, 0xff82a3);
    this.drawMeter(this.resolveMeter, this.scale.width / 2 - 104, this.hud.top + 78, 208, 10, s.resolve / 100, 0x8f61ff, 0xd3b7ff);
    this.drawMeter(this.pyraMeter, this.layout.pyraX - 44, this.layout.pyraY + 76, 88, 7, s.pyraCharge / 3, 0xff923f, 0xffd36d);

    const weapon = this.state.equipped.weapon
      ? this.state.inventory.find((item) => item.instanceId === this.state.equipped.weapon)
      : null;
    const weaponColor = weapon?.rarity === 'rare' ? 0xcf62ff : weapon?.rarity === 'uncommon' ? 0x5ee19a : 0x7b4dff;
    this.heroAura.setFillStyle(weaponColor, weapon ? 0.18 : 0.1).setStrokeStyle(2, weaponColor, 0.45);

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

    if (this.lastStatus !== s.status) {
      if (s.status === 'fighting') {
        this.heroActor.setAlpha(1).setScale(0.78).setAngle(0);
        this.enemyActor.setAlpha(1).setScale(0.78).setAngle(0);
      }
      this.lastStatus = s.status;
    }
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
      if (event.target === 'enemy') {
        if (event.source === 'hero') this.animateHeroAttack(event.label ?? 'Attack', event.critical === true);
        if (event.source === 'pyra') this.animatePyraAttack(event.label ?? 'Ember Bolt');
        this.hitReact(this.enemyActor, 0xff5d93);
        this.impactBurst(this.layout.enemyX - 40, this.layout.enemyY - 25, event.critical ? 0xffd36d : 0xa56cff, event.critical ? 10 : 6);
        this.floater(
          this.layout.enemyX,
          this.layout.enemyY - 92,
          `${Math.round(event.amount)}${event.critical ? ' CRIT!' : ''}`,
          event.critical ? '#ffd36d' : '#ffffff',
          event.critical ? 20 : 16,
        );
      } else {
        this.animateEnemyAttack();
        this.hitReact(this.heroActor, 0xff5a70);
        this.impactBurst(this.layout.heroX + 28, this.layout.heroY - 18, 0xff4c7d, event.critical ? 9 : 5);
        this.floater(
          this.layout.heroX,
          this.layout.heroY - 96,
          `${Math.round(event.amount)}${event.critical ? '!' : ''}`,
          '#ff8f9f',
          event.critical ? 19 : 16,
        );
      }
    }

    if (event.type === 'shield' && event.amount) {
      this.shieldPulse();
      this.floater(this.layout.heroX, this.layout.heroY - 84, `SHIELD ${Math.round(event.amount)}`, '#83d7ff', 14);
    }

    if (event.type === 'pyra' && event.label) {
      this.animatePyraAttack(event.label);
      this.floater(this.layout.pyraX, this.layout.pyraY - 70, event.label, '#ffb35e', 13);
    }

    if (event.type === 'wave') {
      this.enemyActor.setAlpha(0).setScale(0.64);
      this.tweens.add({ targets: this.enemyActor, alpha: 1, scale: 0.78, duration: 240, ease: 'Back.Out' });
    }

    if (event.type === 'victory') {
      this.tweens.add({ targets: this.enemyActor, alpha: 0, y: this.layout.enemyY + 30, angle: 12, duration: 420, ease: 'Quad.In' });
      this.impactBurst(this.layout.enemyX, this.layout.enemyY, 0xc84cff, 12);
    }

    if (event.type === 'defeat') {
      this.tweens.add({ targets: this.heroActor, alpha: 0.35, y: this.layout.heroY + 22, angle: -8, duration: 360, ease: 'Quad.In' });
    }
  }

  private animateHeroAttack(label: string, critical: boolean): void {
    const startX = this.layout.heroX;
    this.tweens.killTweensOf(this.heroActor);
    const distance = label === 'Worldbreaker' ? 74 : label === 'Gravitic Slam' ? 58 : 42;
    this.tweens.add({
      targets: this.heroActor,
      x: startX + distance,
      angle: label === 'Worldbreaker' ? -5 : -2,
      scaleX: critical ? 0.84 : 0.8,
      scaleY: critical ? 0.84 : 0.8,
      duration: label === 'Worldbreaker' ? 150 : 105,
      yoyo: true,
      hold: 35,
      ease: 'Quad.Out',
      onComplete: () => this.heroActor.setPosition(startX, this.layout.heroY).setScale(0.78).setAngle(0),
    });
  }

  private animateEnemyAttack(): void {
    const startX = this.layout.enemyX;
    this.tweens.killTweensOf(this.enemyActor);
    this.tweens.add({
      targets: this.enemyActor,
      x: startX - 38,
      angle: 3,
      duration: 100,
      yoyo: true,
      hold: 25,
      ease: 'Quad.Out',
      onComplete: () => this.enemyActor.setPosition(startX, this.layout.enemyY).setScale(0.78).setAngle(0),
    });
  }

  private animatePyraAttack(label: string): void {
    const startX = this.layout.pyraX;
    const startY = this.layout.pyraY;
    this.tweens.killTweensOf(this.pyraActor);
    const pounce = label === 'Solar Pounce';
    this.tweens.add({
      targets: this.pyraActor,
      x: pounce ? this.layout.enemyX - 110 : startX + 46,
      y: pounce ? this.layout.enemyY - 40 : startY - 18,
      angle: pounce ? 18 : -8,
      scale: pounce ? 0.82 : 0.76,
      duration: pounce ? 180 : 120,
      yoyo: true,
      hold: pounce ? 55 : 20,
      ease: 'Sine.Out',
      onComplete: () => {
        this.pyraActor.setPosition(startX, startY).setScale(0.72).setAngle(0);
        this.tweens.add({
          targets: this.pyraActor,
          y: startY - 8,
          duration: 1050,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      },
    });
    this.impactBurst(pounce ? this.layout.enemyX - 40 : startX + 80, pounce ? this.layout.enemyY - 22 : startY - 20, 0xff913d, pounce ? 9 : 5);
  }

  private hitReact(actor: Phaser.GameObjects.Container, color: number): void {
    const ring = this.add.circle(actor.x, actor.y - 16, 54, color, 0.1).setDepth(8).setStrokeStyle(3, color, 0.75);
    this.tweens.add({
      targets: ring,
      scale: 1.7,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({ targets: actor, alpha: 0.45, duration: 55, yoyo: true, repeat: 1 });
  }

  private shieldPulse(): void {
    const shield = this.add.circle(this.layout.heroX, this.layout.heroY - 8, 78, 0x4ec8ff, 0.06).setDepth(8).setStrokeStyle(4, 0x7ddcff, 0.8);
    this.tweens.add({
      targets: shield,
      scale: 1.35,
      alpha: 0,
      duration: 420,
      ease: 'Sine.Out',
      onComplete: () => shield.destroy(),
    });
  }

  private impactBurst(x: number, y: number, color: number, count: number): void {
    const bounded = Math.min(12, Math.max(4, count));
    for (let i = 0; i < bounded; i++) {
      const angle = (Math.PI * 2 * i) / bounded;
      const distance = 24 + (i % 3) * 10;
      const particle = this.add.circle(x, y, 2 + (i % 3), color, 0.9).setDepth(18);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scale: 0.2,
        alpha: 0,
        duration: 280 + (i % 3) * 45,
        ease: 'Quad.Out',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private floater(x: number, y: number, text: string, color: string, size = 16): void {
    if (this.floaters.length >= 12) this.floaters.shift()?.destroy();
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'Arial',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#050713',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.floaters.push(t);
    this.tweens.add({
      targets: t,
      y: y - 38,
      scale: size >= 19 ? 1.12 : 1,
      alpha: 0,
      duration: 720,
      ease: 'Quad.Out',
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
      .setDepth(40);
    this.time.delayedCall(1200, () => t.destroy());
  }
}
