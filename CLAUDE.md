# Topdown Walker Game

HTML5 canvas top-down game. [index.html](index.html) holds the styles and HTML overlay controls; the game code lives in [js/](js/) as plain (non-module) scripts loaded in order at the end of `<body>`. Hosted on GitHub Pages at www.plastichut.com (see [CNAME](CNAME)).

## Script layout and load order

All scripts share one global scope (top-level `const`/`let`/`function` are visible across files), so **order matters**: code that runs at load time (top-level statements, `const x = fn(...)`) can only call functions from files loaded *earlier*. Calls inside functions/callbacks are fine, since everything is loaded before the game loop starts.

1. `setup.js` - canvas, resize, touch detection
2. `audio.js` - WebAudio sound effects, engine/ambient sounds
3. `config.js` - world/room dimensions
4. `dialogue.js` - dialogue trees for shops, NPCs, casino/blackjack
5. `util.js` - pure helpers called during world setup (`hashNoise`, `randomPersonStyle`, `freeSegments`, `pointToSegmentDist`)
6. `world.js` - roads, river, buildings, park, wilderness/lakes, farmland/ocean, NPC lists, quest spots
7. `player.js` - player state, shooting, vehicles, editors, input handlers, interact/enter/exit, movement
8. `interiors.js` - home furniture, bathroom/kitchen/laundry, seats/beds, interior collision
9. `combat.js` - knockback, blood spots, bullet hits
10. `update.js` - `update(timestamp, dt)`
11. `draw-characters.js` - original `drawDude` art (still used for lying/sitting/classic-view riding), top-down car/motorcycle art
12. `people.js` - `drawPerson`: naturally proportioned (~6 heads, ~48px tall, feet at y=0) outlined figures with a crossing walk cycle, faces, hair (long hair falls down the back), and detailed outfits (men: tee / button-up / open jacket / hoodie + jeans or trousers with belt, pockets, creases; women: dress, crop top + skirt or shorts, tank or sweater + jeans, heels). Wraps `drawDude` so all standing/walking/swimming/knocked-down/iso-riding characters use it
13. `draw-world.js` - building exteriors, roads, terrain, water, trees
14. `traffic.js` - traffic lanes, cars/bikes, lights, day/night, street lamps, camera
15. `draw-scenes.js` - `drawOutside`, `drawInterior`, furniture, dialogue UI, minimap, HUD, `draw`, `loop`
16. `visuals.js` - presentation layer: world-anchored ground textures, ~25k scattered decor sprites + street furniture (built once at load, bucketed by 256px cells), building roof/wall/window/door detailing, pre-rendered tree sprites, cloud shadows, light-mapped night (`drawNightLighting`), interior shell/back wall/plants. Purely visual - no collision
17. `iso.js` - isometric outdoor renderer (default; V toggles classic top-down, saved in localStorage). World logic stays 2D; ground draw functions run through a 2:1 iso canvas transform (canvas.width/height are temporarily overridden to the visible world bbox so their culling works), buildings are extruded boxes with the regular facade/roof art mapped onto each face, upright things are placed at `isoS(x, y)` and depth-sorted against building footprints. Cars/motorcycles are true 3D models built from shaded boxes (`drawIsoCar`, `drawIsoMotorcycle`, `isoVehBox`). Keys move along world axes (up = screen up-right). Camera zoom = auto-fit (min screen side / 530) × user factor (+/- keys, saved); the scene is drawn in logical px under ctx.scale(iso.Z), so use relative transforms only. Interiors are still top-down
18. `main.js` - button bindings, save/load (`localStorage`), name/tier overlays, startup

A new file goes into the `<script>` list in index.html at the right position.

## Architecture

- **Main loop**: `loop(timestamp)` → `update(timestamp, dt)` → `draw()` → `drawOutsideIso()` (or `drawOutside()` in classic view) / `drawInterior()`, `drawHUD()`, `drawDialogueUI()`.
- **Persistence**: `saveGame`/`loadGame` to `localStorage`, autosaved every 5s + on `beforeunload`.
- **`old-versions/`**: earlier iterations, kept for reference, not part of the live build.

## Firebase

- Project `westlake--county` (config in [.firebaserc](.firebaserc) / [firebase.json](firebase.json)). Firestore (nam5) and Realtime Database (`westlake--county-default-rtdb`, us-central1) exist, with deny-all rules in [firestore.rules](firestore.rules) / [database.rules.json](database.rules.json). Deploy rules with `firebase deploy --only firestore:rules,database`.
- Auth: Email/Password + Google enabled, plastichut.com authorized.
- Planned: sign-in/sign-up with cloud saves, small multiplayer (~5 players) over Realtime Database, NPC "thinking" (local needs/routines plus optional LLM dialogue via a Cloud Function), graphics pass. Firebase Hosting may replace GitHub Pages later (better sign-in reliability, `/api` rewrites to Functions).

## Working notes

- No build step / bundler / package.json - static files opened directly or served via a local dev server (e.g. VSCode Live Server).
