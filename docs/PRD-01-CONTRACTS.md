# PRD-01 Technical Contracts

## Architecture

Core owns authoritative rules/state and is presentation-agnostic. Content is structured and validated. Presentation is Phaser-only rendering/input. Platform, Persistence and Commerce are replaceable boundaries.

## Save contract

Schema version 1. Saves use current, previous and last-known-good slots. Loaded data is validated. Corrupt current data falls back to previous, then last-known-good, then a clean versioned state. `migrate` is the future migration entry point.

## Content contract

Content uses stable IDs. QA validation detects duplicates, invalid references, missing required fields and impossible numeric ranges.

## Platform contract

Gameplay depends on a provider interface rather than an external SDK. Development mode advertises unavailable ads, purchases, account and cloud save. A later CrazyGames provider can implement the same boundary.

## Simulation contract

`FixedStepSimulation` separates render delta from simulation steps, bounds runaway frame deltas and applies x1/x2/x3 to accumulated simulation time rather than timer frequency.

## QA

Run `npm run qa`. This executes formatting, lint, strict TypeScript typecheck, Vitest, production build and Playwright E2E. Representative landscape viewports include 907x510, 1216x684, 1366x768, 1280x720, 800x450, 1080x607 and 667x375.
