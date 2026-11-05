# Conan: preserve genuine installation, then original game launch

Task `NEW-GAME-CONAN-DEMO-20261010`, continuation from main
`a5c90bfd0ccc40c96ad457c617e898ae9064bda3`.
Evidence: `scratch/runs/20261105-conan-installed-state-gameplay/`.
Unique installer-produced state destination:
`scratch/game-media/conan-installed-20261105/`.

The genuine installation is now preserved, including its final `INSTALL.LOG`
and registry. Ordinary Finish completed and the identified original game
launched, rendered its menu, and accepted New Game and Warrior difficulty.
**Gameplay is not established.** Its first recorded emulator failure is
`QueueError: D3D9 draw: texture not resident`; it remained on the Kordava loading
screen. This is committed investigation evidence, not a tested renderer repair.

## Genuine installed state

Reused the working recipe in `conan-recovered-installer-20261105.md`, with one
recreated original installer session and no archive/media discovery. Existing
media remains at
`scratch/game-media/conan-demo-20261105/ConanPC-Demo-from-Herni-Vyber-23.exe`,
126741363 bytes, SHA-256
`73038ac99299abc8d5e0cef28d83324e6b493fecdbd21fd65964919376fa3007`.
Historical magazine-demo equivalence remains unknown. The installer was not
copied into evidence or the installed-state directory.

Ordinary trusted clicks selected U.S. English, the default destination, I
Accept, and Next. The acceptance screenshot shows the radio selection and
enabled Next; the following screenshot shows Start Installation. Installation
reached its genuine success page.

The observer connects with `defaultViewport:null`. Before/after attachment
measurements remain 1000×800 at DPR 1. Installer screenshots and actual input
both use a 660×602 canvas/CSS rectangle at (10,160). The successful Finish click
used page (402.7,630.162), inside the reviewed button. It completed by
18:00:35.415Z, well before the actual queue deadline 18:04:51.764Z. Guest
`ExitProcess` recorded code 0 and the shell published the Conan desktop shortcut.

Read-only remote VFS references were held through Finish. Chunked recovery
before Finish retained 31 installed files, 156126585 bytes. Recovery after
Finish found the additional genuine 4134-byte `INSTALL.LOG`:

- **32 installed files, 156130719 bytes** under
  `c:\program files\tdk mediactive\conan demo\`.
- **37 final produced files** in the machine manifest, including five real
  shortcuts outside the installation directory. Produced temporary files that
  were later deleted remain distinguishable from the final manifest.
- Full final registry: **70 entries**, with **two installer-changed keys**:
  Cauldron/Conan's `InstallDir_Demo` and `Language_Demo`, and the Conan Demo
  uninstall key. No DirectX values were invented or substituted.

Canonical state is retained in the unique directory above:
`manifest.json`, `files/`, `registry.json`, and `registry-changes.json`.
Treat this specifically requested preserved state as a retained task input.
`preservation-verified.json` rereads all 37 files and verifies their sizes and
SHA-256 values, the registry against its actual observation, and every route
mount. All 31 predecessor-installed files match the predecessor inventory
exactly. Final manifest SHA-256:
`adf7c78e9ab56519edd53479b2151f04e18496668dec450ba2af12cc0b90cd38`;
registry SHA-256:
`64969ff6f94d58b54431e18f937af3374bda5755e233ad62517840e1611d8de3`.

The real game remains 1630208 bytes, SHA-256
`c343ef6a51a88c5b01a3c3e1511035359d25336fbe010123bd2e02962b77df56`.
`prepare-game.cjs` reconstructs only a private app route from the final
manifest: that executable, its actual installed working directory, 36 companion
mounts, and the exact observed registry. It does not alter installed bytes.
The recipes and receipts reference the canonical files; no second media tree
or source archive was made.

## One original game session and first failure

One original game session started at 18:03:00Z using the Worker backend and
SwiftShader/WebGL in Chrome 151 on Linux. Its canvas is 640×480, displayed in
the same input/presentation rectangle at (10,194), 660×568 CSS pixels. Passive
observer attachment preserved the 1000×800 outer viewport.

Personally reviewed all 20 saved PNGs across installation and game execution.
The game screenshots establish NVIDIA splash → normal Conan menu → New Game
→ Warrior difficulty → “Kordava - Like a Thief in the Night...” loading.
Trusted Escape and Enter presses/releases reached the guest and produced
these normal menu transitions.

After difficulty confirmation, the **first recorded emulator error** is
`D3D9 draw: texture not resident`, at line 61 of `game/console.log`, after the
18:05:14.684Z Enter release. The log does not timestamp that error itself.
`game/loading-state.json` at 18:07:33.072Z independently records the owning
bridge's `QueueError: D3D9 draw: texture not resident`:

- D3D9 backend `webgl`, asynchronous shared render Worker, device 136450064.
- Queue generation 1; submitted/consumed 11553, completed 11551, inflight 0.
  Host resident texture map empty; snapshot cache 137443928 bytes, serial 547.
- Correct owning-main-Worker `readExports` gives EIP `0x428a68`, yield 0 and
  render token 0. The page's idle-instance EIP 0 is not a guest diagnosis.
- Loading thread started at `0x4dc090` and is recorded exited with code 0.
  No x86 trap, Win32 missing import, or deadlock was established.

The error corresponds to the D3D9 executor's texture residency validation;
`lib/d3d9-backend.js` checks for missing/wrong-sized resident RGBA in
`Device.levelPixels`. The precise failing texture key, dimensions, and first
causal command are **unresolved**. Two bounded render-Worker prototype wrappers
delegated to the original method unchanged and collected no matching failures.
Their empty records do not prove that no residency failure occurred, nor that
the wrapper reached the failing device implementation. No cause or repair is
inferred from those empty records.

A trusted ArrowUp hold at 18:09:00.038–18:09:02.171Z reached guest keydown/up
(`wParam=0x26`). Personally inspected before/held/after captures still show the
loading screen, without a player character, HUD, or visible movement. Normal
menu response is proved; player-controlled gameplay is not.

No source/guest patches, forced scenes, fabricated DirectX state, second
installer recreation, second game session, or speculative API fix. The next
technical step is to isolate the failing D3D9 draw/residency transaction with
its texture keys, pixel extents, releases and ordering, then derive a meaningful
generated renderer regression. This run does not justify changing a Win32/x86
handler, residency budgets, or scene selection.

## Build identity, checks, and cleanup

Source-only preparation lasted until Aranna1850 FINAL 17:33:51Z, legacy1915
FINAL 17:43:35Z, and AoE3DXSETUP1925 FINAL 17:55:42Z. Independent cleanup
verified 326 recorded PIDs absent, 133 ports refused, 33 profiles absent, four
locks free, no heavy runtime, and more than 5 GB free before execution.

Installer source commit: `fb256f9f6456e1d790e9fe0813adaec28cdadc35`.
Game source commit: `26353de28d1132ef6630a5cfae870c985496f05f`.
Each session records all 301 relevant tracked-source hashes; final rereads
match every hash. Relevant tracked binary diffs are empty. The preexisting
untracked `lib/wininit-boot.js` is recorded as a small patch and hash, never
edited. Owned new documentation is also retained as a patch.

Both actual browser sessions compiled the same 2173559-byte module, SHA-256
`2e4280f8d513b99d57273cb70838871e03088c84d49d64357a66ddb318c8f8b3`;
one unique copy is retained as `tested-wine-assembly.wasm`.

Current production boot helpers, DLL graph, system files, bitmap/subset fonts,
all genuine game route file pins, production queued-input validator controls,
and private script syntax passed. Static audit finds live handlers for all
70 installer and 130 game direct imports; dynamic behavior is not thereby
qualified. `flock /tmp/wine-build.lock bash tools/build.sh` passed before each
original run. No production repair or new emulator regression was committed.

After the installer's queued quit and final readout, its outer tool caller
returned status 143; caller/probe were absent but Chrome remained. The cause
is unknown, with no terminal/Chrome-exit receipt. Cleanup-only CDP Browser.close
on its exact owned endpoint at 18:01:41.506Z returned successfully; all three
PIDs, both ports and the profile were then absent. Do not infer a normal probe
exit from that recovery. The game caller used a separate process session and
its queued quit completed before its deadline: probe code 0, Chrome code 0,
normal caller cleanup at 18:09:25Z. This is browser cleanup, not normal guest
game exit. Game PIDs/ports/profile and four locks independently passed cleanup.

Evidence remains under this run ID; no unrelated candidate-corpus entry is
attached. No boxes, subworkers, public deployment, explicit platform flag, or
laptop Heroes II work. Box ID/state/expiry N/A; coordinator lifecycle unchanged.
