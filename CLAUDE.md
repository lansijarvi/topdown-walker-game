# Topdown Walker Game

Single-file HTML5 canvas top-down game. All game code currently lives in [index.html](index.html) (~2800 lines): styles, HTML overlay controls, and JS game loop are all inline in one file.

## Architecture (as of last review)

- **Rendering**: `draw()` → `drawOutside()` / `drawInterior()` depending on scene, plus `drawHUD()`, `drawDialogueUI()`. Main loop via `loop(timestamp)` → `update(timestamp, dt)` → `draw()`.
- **World**: outdoor city scene with roads (`drawRoads`), traffic + traffic lights (`trafficLane`, `getLightPhase`, `carShouldStopAtLight`), a park (`drawParkGround`, trees), sidewalks (`buildSidewalkPath`, `randomSidewalkPoint`), and buildings incl. a civic block (police station, courthouse, jail) with interior/exterior transitions (`enterBuilding`, `exitBuilding`, `enterNode`).
- **Player**: on-foot movement, running, drivable motorcycle (`toggleMotorcycle`, `drawMotorcycle`) and car (`toggleCar`, `drawCar`), gun equip/shoot/reload (`toggleGunEquip`, `shoot`, `reload`), knockback/blood-spot physics (`applyImpact`, `applyKnockbackDecay`, `drawBloodSpot`).
- **NPCs/dialogue**: branching dialogue system (`pressInteract`, `selectDialogueOption`, `syncDialogueOptionsOverlay`).
- **Controls**: touch (virtual d-pad + action buttons) and keyboard/mouse, with touch-only controls hidden on desktop.
- **`old-versions/`**: earlier iterations of the game (`sexy-top.html`, `topdown.html`, `topdown_walker (7).html`) — kept for reference, not part of the live build.

## Planned work

- Integrating a Firebase backend (console project not yet created/connected as of 2026-07-06). Likely candidates: Firebase Auth (player accounts), Firestore (save state, world/NPC persistence), Hosting. Scope not yet decided — confirm with user before assuming which Firebase services are in play.

## Working notes

- No build step / bundler / package.json currently exists — it's a static HTML file opened directly or served via a local dev server (e.g. VSCode Live Server).
- When adding Firebase, decide early whether to keep the single-file structure or split into modules — will affect how the SDK is loaded (script tag vs. npm + bundler).
