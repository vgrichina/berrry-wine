# Hexen II native GL enemy follow-up — 2026-11-14

Stopped before the original game launch: the current native GL provider is
unavailable. Read-only Node resolution from `lib/headless-gl.js` returns
`MODULE_NOT_FOUND` for both `@node-3d/glfw` and `@node-3d/webgl`.
The previous Quake III run's `native-deps/` retains its package manifests but
has no installed `node_modules`. Searches found no replacement native addons
in the local home, temporary, system or cache locations checked. No download,
installation, software fallback, box, deployment or original launch was made.

Evidence: `scratch/runs/20261114-hexen2-native-gl-enemy/result.json`;
`provider-probe.cjs` and `provider-probe.json` preserve the reproducible
resolution check and its actual lookup paths. The probe exits 2 and never
loads an addon or creates a context. `test-headless-gl.js` explicitly exits 0
with SKIP when dependencies are absent; that would not qualify native GL.
No heavy GL preflight, build or game runtime entered the heavy queue ahead of
SuperTux-onward/TIM2-construction. The light prerequisite failure ended this
task without taking their lock. No finite game controller was launched and
neither a game deadline nor its watchdog was armed, because launch admission
failed first. The authorized single 1200-second launch was not consumed.

Preparation pinned HEAD `50fb19134a8f4f7b9c0d21330deeadb380fd04c0`, 318
source/helper files, all relevant uncommitted binary diffs and the untracked
runtime file patch. The accepted 317-file SuperTux build closure has zero hash
drift; local wasm SHA-256 is
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`
and matches that accepted build. This task performed no full build and loaded
no guest module: the actual loaded module digest remains null. Environment:
Node v24.18.1, Linux x86_64, DISPLAY `:0`; free disk was over 13 GB.

The 18 media/manifest/control pins have no manifest-size mismatch. Registered
root `installed/glh2.exe` remains SHA-256
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`,
matching the prior paired run. The registry still seeds the default Hexen2
Flag and mounts the existing modern config and `+mlook` autoexec. The root
MiniGL DLL is absent; the bundled GLRoot copy remains untouched. Static
registered controls bind CTRL to crouch and MOUSE1 to attack. Current native
bindings were not inspected, so neither older Control attacks nor the static
mapping are presented as a verified live binding. Media was hashed only;
no guest reverse engineering, disassembly, extraction, patch or substitute
DLL was used. Evidence holds no media/source copies or wasm dumps.

`test/test-cli-input-owner.js` and `test/test-cli-guarded-input.js` passed.
They ran their existing local fixtures before heavy-lock admission; the
guard fixture uses its existing frozen Solitaire/D3DIM setup, including its
fixture-only live-present flag. They are input-protocol checks, not an
original Hexen II run, native GL preflight, or game acceptance evidence. No
production source or foreign NE/render/host work was edited.

There are no new scenes, traversal, outgoing enemy hit/kill, incoming damage,
or native Quit observations from this task. The previous paired run's
courtyard/ramp/skull-door/chamber and incoming damage findings remain intact;
enemy damage/kill and full27 remain unproved. Next prerequisite is an
owner-authorized restoration of the native provider, then a separately
assigned bounded run with native binding review and an independently armed
1220-second watchdog. This single task stops here.

Box ID: none. State: NOT_CREATED. Expiry: null. Stop receipt: N/A. No original
runtime, game watchdog, detached game supervisor or heavy lock remains owned.
