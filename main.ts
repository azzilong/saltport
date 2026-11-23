// SALTPORT — build program (Node 22, standard library only).
// Re-written in-session for rebuild #3 (recording 5, 2026-11-23):
// recording 4 died in a VM restart before sealing, so this file is
// re-authored here under the fresh settled recording. Same build as
// before, bundling the shooting + chase systems and item drops.
// Copies game/ and screenshots/ beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, via make.fun's library.
// The 163,840-byte text cap covers the game's own source text only:
// vendored files (game/vendor/ and *.min.js) are counted, not embedded.
//
// Serve locally with:  python3 -m http.server 8123 --directory game
// then open http://localhost:8123/
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps: text is the only byte cap that shapes the source;
// the rest refuse an entry the scorer would refuse (more than 4 screenshots
// or one over 256 KiB; more than 993 files in game/ or 48 MiB of game files
// in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
