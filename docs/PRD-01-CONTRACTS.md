# PRD-01 Technical Contracts

## Architecture

Core owns authoritative rules/state and is presentation-agnostic. Content is structured and validated. Presentation is Phaser-only rendering/input. Platform, Persistence and Commerce are replaceable boundaries.

## Input contract

Pointer and touch actions share the `bindTap` presentation boundary. Essential development-shell actions do not depend on keyboard, hover or right-click behavior.

## Save contract

Schema version 1. Saves use current, previous and last-known-good slots. Loaded data is validated. Corrupt current data falls back to previous, then last-known-good, then a clean versioned state. `migrate` is the future migration entry point.

## Content contract

Content uses stable IDs. QA validation detects duplicates, invalid references, missing required fields and impossible numeric ranges.

## Platform contract

Gameplay depends on a provider interface rather than an external SDK. Development mode advertises unavailable ads, purchases, account and cloud save. A later CrazyGames provider can implement the same boundary.

## Simulation contract

`FixedStepSimulation` separates render delta from simulation steps, bounds runaway frame deltas and applies x1/x2/x3 to accumulated simulation time rather than timer frequency.

## Cloudflare Pages configuration

No runtime is tied to localhost. The production artifact is a static Vite build.

- Root directory: repository root
- Node.js: 22
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Required environment variables: none for PRD-01

A real Cloudflare deployment requires authorized Cloudflare access and must remain `NOT TESTED / ACCESS REQUIRED` until an actual preview URL is verified.

## QA

Run `npm run qa`. This executes formatting, lint, strict TypeScript typecheck, Vitest, production build and Playwright E2E. Representative landscape viewports include 907x510, 1216x684, 1366x768, 1280x720, 800x450, 1080x607 and 667x375.
