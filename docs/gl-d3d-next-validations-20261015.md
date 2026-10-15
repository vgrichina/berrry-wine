# Two bounded corpus validations, 15 October 2026

Source-only handoff against main `73f27af1bbe772fd10c8d6a237d8d5f361cb8ccc`.
No build, browser, VM, download or gameplay was executed for this note.
These are known rows in the expanded corpus, not an assertion of original
27-app membership. Preserve the membership audit in the status document.

## Selection and exact remaining proof

1. **Age of Wonders II**: existing ordinary army-control route, complete local
   payload, and merged viewport/Start repairs make a short WebGL control check
   useful. `9a438f1b9`, `201de22d9`, `b6e18c196` are ancestors of the pinned
   main. The re-note reports clean panels on both renderers; this host lacks
   `20261010T1145-aow2-viewport-clip-fix` and
   `20261009T0306Z-age-of-wonders2-gameplay`. Thus recover those bundles or
   obtain a fresh live owning-backend attestation plus army displacement and
   movement-point decrement. Julia's card alone is world arrival, not control.
2. **Darkstone**: all installed manifest paths are present, only about 33 MB.
   Retained Town/camera evidence exists in the historical re-note, but
   `scratch/runs/20261007-darkstone-retained-gameplay-audit` is absent locally
   and original source/module/backend remain unknown. Qualify the same Town
   route separately on software and WebGL; blue mana HUD distinguishes Town
   from forest loading. Camera response establishes control, not combat or
   champion locomotion. `test/test-darkstone-gameplay.js` requires the absent
   `test/binaries/win98-games-a-d/DarkstoneDemo-D3D/Setup.exe`; do not launch it
   expecting the installed tree alone to satisfy that guard. Direct registered
   browser launch below does not require reinstalling or bypassing that test.

## Verified local inputs

Paths are relative to `/home/user/wine-assembly`. Roots:

- Darkstone: `test/binaries/win98-games-a-d/DarkstoneDemo-D3D/installed`
- AoW2: `test/binaries/win98-games-a-d/Age of Wonders2 demo-SW/extracted`

| Root / file | Bytes | SHA-256 |
|---|---:|---|
| Darkstone / darkstonedemo.exe | 1298432 | `b43db5e1b835eb1e93688a1f3f1d9c814517be6fc8110c7fb6e024d467ee721b` |
| Darkstone / .wine-assembly-browser.json | 1204 | `e01b8a7739a0570e8165a78d8138d8543bb070912a66b741cdb9f73f6b0cadfe` |
| AoW2 / AoW2.exe | 5748736 | `a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7` |
| AoW2 / .wine-assembly-browser.json | 176886 | `af7a4432d2dab026e1fdc6c8db4aef183090534d0bc9075d9f388272bee0213a` |
| AoW2 / vcl50.bpl | 2023424 | `cfd375eb124d1fba73f2d46705a43ed30e8aaadca7627bab7718f674fb82df38` |
| AoW2 / vclx50.bpl | 248832 | `0bca4d6adf70b4a01f0b6fe0e3d4d1ff08d97bdebb6ae2e836dde9d3a89cc148` |
| AoW2 / Ml42ND50.bpl | 468992 | `c503b230760bfc9f3c315f91911c3b90471368115fabf227e4e95d0e34a30993` |

Reproduce the complete payload check without copying binaries. This was run
locally: 15 Darkstone and 1061 AoW2 unique paths, none missing. Each inventory
includes the manifest and executable as well as every manifest URL.

```bash
node <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sha = bytes => require('node:crypto').createHash('sha256').update(bytes).digest('hex');
for (const [folder, exe, expected] of [
 ['DarkstoneDemo-D3D/installed', 'darkstonedemo.exe', '7379dca78b373080febeb6fce4282c284faa234deec8185870041e508cc3f673'],
 ['Age of Wonders2 demo-SW/extracted', 'AoW2.exe', '8e51ccd5c6990d9aa34f0825860b5612e9e29143c93fbe29a7e8af0edc158422']]) {
 const root = path.join('test/binaries/win98-games-a-d', folder);
 const manifest = JSON.parse(fs.readFileSync(path.join(root, '.wine-assembly-browser.json'), 'utf8'));
 const names = [...new Set([...manifest.files.map(x => x.url), exe, '.wine-assembly-browser.json'])].sort();
 const rows = names.map(p => sha(fs.readFileSync(path.join(root, p))) + '  ' + p + '\n').join('');
 const actual = sha(rows);
 assert.equal(actual, expected, folder);
 console.log(folder, names.length, actual);
}
JS
```

## Later serialized runtime commands — not executed

Use a clean full checkout and its fresh canonical module, complete fixture
trees, and an already running isolated private dev server. Require actual
HTTP/module digest equality and record the loaded digest; a source revision or
on-disk module hash alone is insufficient. No WAT fallback qualifies. Set
`VALIDATION_URL` to that server's origin (no path, query or trailing slash).
Run these commands from the full checkout root. Run one arm at a time under the coordinator's
runtime slot. The commands below have outer 360-second limits. Their timing
translation is a candidate route, not a new validated test; stop on a wrong
screen and retain the failed route instead of blind repeated clicks.

Source-parser review: the probe appends `/index.html${QUERY}` to the supplied
origin, so the leading `?debug&` below is intentional. Every step kind below
is handled by the existing dispatcher. `shot:` passes its path directly to
Puppeteer; all supplied paths are children of the newly created `$out`, with
no traversal. Keep that directory and its parents free of symlinks. Bash
parsing and a stubbed execution of the actual step dispatcher checked these
commands without starting Chrome; this validates syntax, not guest timing.

AoW2 coordinates and waits come directly from its October 10 re-note:

```bash
: "${VALIDATION_URL:?set the isolated private server URL}"
out="scratch/runs/$(date -u +%Y%m%dT%H%M%SZ)-aow2-webgl-control"
mkdir -p "$out"
timeout --signal=TERM --kill-after=10s 360s node tools/web-input-probe.js \
  --url="$VALIDATION_URL" --app=age_of_wonders2_demo --gpu --threads \
  --query='?debug&d3d-renderer=webgl' --launch=30000 --launcher-wait=30000 \
  --steps="wait:70000;shot:$out/menu.png;click:569,346;click:290,78;wait:20000;shot:$out/setup.png;click:896,697;wait:45000;shot:$out/world-card.png;click:518,473;click:515,344;shot:$out/army-before.png;wait:5000;shot:$out/idle.png;click:632,388;click:632,388;wait:10000;shot:$out/army-after.png" \
  >"$out/output.log" 2>&1
```

Darkstone browser timing translates the existing frozen CLI test's ordinary
menu clicks; loading speed must be checked from the captured milestones.
Fresh browser storage avoids old champions/saves changing the route.

```bash
: "${VALIDATION_URL:?set the isolated private server URL}"
backend=software  # Run webgl separately after reviewing this arm.
out="scratch/runs/$(date -u +%Y%m%dT%H%M%SZ)-darkstone-$backend-control"
mkdir -p "$out"
timeout --signal=TERM --kill-after=10s 360s node tools/web-input-probe.js \
  --url="$VALIDATION_URL" --app=darkstone_demo --gpu --threads \
  --query="?debug&d3d-renderer=$backend" --launch=30000 --launcher-wait=30000 \
  --steps="wait:20000;keydown:Escape;wait:1000;keyup:Escape;wait:10000;shot:$out/menu.png;click:400,260;wait:3000;click:400,305;wait:3000;click:145,410;wait:3000;click:385,480;type:CODEX;click:425,570;wait:3000;click:530,225;move:425,570;wait:3000;shot:$out/party.png;click:425,570;wait:90000;shot:$out/town-before.png;wait:5000;shot:$out/town-idle.png;keydown:ArrowRight;wait:5000;keyup:ArrowRight;wait:2000;shot:$out/town-after.png" \
  >"$out/output.log" 2>&1
```

These commands capture the route only. `--gpu` enables browser graphics and
the query requests a backend; neither proves the guest renderer. Before a
pass, retain live host **and owning guest/render Worker** backend identity,
D3DIM draw progress and fallback/error counters at Town/world. Software must
show actual software consumption; WebGL must show actual GPU draws, not just
canvas presentation. If those observations are missing, label backend unknown.
Use the existing owning-Worker diagnostics rather than inventing a page global.

Review idle versus input landmarks, not only whole-frame pixel change. AoW2
must move the selected army and decrement points; Darkstone must reach Town
and rotate fixed road/gate landmarks. Retain clean lower-UI checks for AoW2.
Record module/fixture hashes before and after, exact command, exit status,
console, browser/GPU implementation, and process-tree cleanup. Save artifacts
inside each run, then publish `result.json` last according to `ops/README.md`.
No FPS, audio, hardware-device or full-game acceptance follows from this pair.
