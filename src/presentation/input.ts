import type Phaser from 'phaser';

export type TapAction = () => void;

type Touchable = Phaser.GameObjects.GameObject & {
  setScale?: (x: number, y?: number) => unknown;
  setAlpha?: (alpha: number) => unknown;
};

export function bindTap(target: Phaser.GameObjects.GameObject, action: TapAction): void {
  target.setInteractive({ useHandCursor: true });
  const hitArea = target.input?.hitArea as { width?: number; height?: number } | undefined;
  if (hitArea) {
    if (typeof hitArea.width === 'number') hitArea.width = Math.max(hitArea.width, 112);
    if (typeof hitArea.height === 'number') hitArea.height = Math.max(hitArea.height, 56);
  }
  const touchable = target as Touchable;
  const pressed = () => {
    touchable.setScale?.(0.96);
    touchable.setAlpha?.(0.82);
  };
  const released = () => {
    touchable.setScale?.(1);
    touchable.setAlpha?.(1);
  };
  target.on('pointerdown', pressed);
  target.on('pointerout', released);
  target.on('pointerup', () => {
    released();
    action();
  });
}
