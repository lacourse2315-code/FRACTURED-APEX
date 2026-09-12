# PRD-02 Playable Core Contracts

## Authoritative combat
Combat rules live in `src/core/combat.ts`. Phaser presents snapshots/events and never owns HP, Resolve, cooldown, loot or equipment truth. Fixed-step simulation from PRD-01 remains the clock boundary; x1/x2/x3 multiplies simulation time, not rendering timers.

## Riftwarden
PRD-02 implements only Riftwarden. Rift Cleaver is the automatic basic attack. Fracture Cleave, Aegis Pulse, Gravitic Slam, Retaliation and Worldbreaker are automatic balance candidates. Resolve is capped at 100 and Worldbreaker consumes a full resource bar.

## Pyra — Emberwing
Pyra is an authoritative combat participant. Ember Bolt is automatic. Hero skill activations charge Solar Pounce. Kindled Spirit currently contributes an 8% Riftwarden Attack reinforcement and is intentionally a balance candidate.

## Loot + equipment
PRD-02 enables Weapon, Helm, Chest, Ring and Relic only. Item instances have stable IDs, base IDs, early rarity, item level, primary stats and affixes. Equipped item IDs reference inventory instances. Real stats, not Power, determine combat. Power is a presentation/comparison summary.

## Persistence
Schema v2 stores inventory item objects, equipped IDs, locks, companion state and development progress. The loader migrates the locked PRD-01 v1 shape and preserves the current/previous/last-known-good recovery chain.

## Development stages
Three development stages prove the wave architecture. Each is Wave 1 → Wave 2 → Captain. Stage 3 is deliberately capable of defeating an ungeared/lightly geared build so the defeat/retry loop is real. These are not Emberfall World 1 content.

## Deferred
Starweaver, Voidstrider, final worlds, 12 slots, 10 rarities, production forge, Rifts, Tower, Raids, Events, VIP, purchases and final CrazyGames integration remain outside PRD-02.
