import type Phaser from 'phaser';

export type TapAction = () => void;

export function bindTap(target: Phaser.GameObjects.GameObject, action: TapAction): void {
  target.setInteractive({ useHandCursor: true });
  target.on('pointerup', action);
}
