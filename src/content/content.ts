export interface DevWorld {
  id: string;
  name: string;
  minStage: number;
  maxStage: number;
}
export interface DevEnemy {
  id: string;
  name: string;
  worldId: string;
  power: number;
}
export interface GameContent {
  worlds: DevWorld[];
  enemies: DevEnemy[];
}
export const developmentContent: GameContent = {
  worlds: [{ id: 'dev-fracture', name: 'The First Fracture', minStage: 1, maxStage: 1 }],
  enemies: [{ id: 'dev-warden', name: 'Fracture Warden', worldId: 'dev-fracture', power: 100 }],
};
export function validateContent(content: GameContent): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const world of content.worlds) {
    if (!world.id || !world.name) errors.push('World missing required fields');
    if (ids.has(world.id)) errors.push(`Duplicate ID: ${world.id}`);
    ids.add(world.id);
    if (world.minStage < 1 || world.maxStage < world.minStage) errors.push(`Invalid stage range: ${world.id}`);
  }
  const worldIds = new Set(content.worlds.map((w) => w.id));
  for (const enemy of content.enemies) {
    if (!enemy.id || !enemy.name || !enemy.worldId) errors.push('Enemy missing required fields');
    if (ids.has(enemy.id)) errors.push(`Duplicate ID: ${enemy.id}`);
    ids.add(enemy.id);
    if (!worldIds.has(enemy.worldId)) errors.push(`Invalid world reference: ${enemy.id}`);
    if (!Number.isFinite(enemy.power) || enemy.power <= 0) errors.push(`Invalid enemy power: ${enemy.id}`);
  }
  return errors;
}
