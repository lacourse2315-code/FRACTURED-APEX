export interface GameState {
  schemaVersion: 1;
  profile: { id: string; createdAt: string };
  selectedClassId: string | null;
  campaign: { worldId: string; stage: number };
  currencies: { shards: number; essence: number };
  inventory: string[];
  equipped: Record<string, string | null>;
  companionIds: string[];
  featureUnlocks: string[];
  settings: { muted: boolean; speed: 1 | 2 | 3 };
  statistics: { totalSimulationMs: number };
}
export const createInitialState = (): GameState => ({
  schemaVersion: 1,
  profile: { id: crypto.randomUUID(), createdAt: new Date().toISOString() },
  selectedClassId: null,
  campaign: { worldId: 'dev-fracture', stage: 1 },
  currencies: { shards: 0, essence: 0 },
  inventory: [], equipped: {}, companionIds: [], featureUnlocks: [],
  settings: { muted: false, speed: 1 }, statistics: { totalSimulationMs: 0 }
});
