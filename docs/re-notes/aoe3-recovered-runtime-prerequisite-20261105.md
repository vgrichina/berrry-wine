# AoE3 recovered inputs: DirectX prerequisite stop, 2026-11-05

The required offline inventory verifier passes: **208 files / 572,051,434
bytes**, no missing members, and the original installer matches its existing
383,598,224-byte SHA-256 pin. Media bytes were neither edited nor copied.
Evidence is `scratch/runs/20261105-aoe3-recovered-runtime-prerequisite/`.

The concrete missing prerequisite is **a genuine DirectX 9c installation input
and verifiable installation state for the XP guest**. The recovered set has a
real DxDiag provider and its registration, but its original registry still says
`4.07.00.0700`, with binary InstalledVersion `[0,0,0,4,7,0,0,0]`.
The historical genuine-provider observation reports DirectX 7 from that state.
This task did not repeat that observation or observe a current guest failure.

New static evidence narrows the requirement:

- The exact installed `Readme.rtf`, section D, requires DirectX **9c or later**
  and describes installation separately from compatible video drivers.
- In the exact recovered `ConfigDetect.dll`, preferred VA `0x10007dd5` compares
  the helper's output with `0x00040009`; `jb` at `0x10007ddc` branches to the
  failure return at `0x10007dfb`. This is a major-version gate, not evidence that
  satisfying it establishes 9c or the later video capability requirements.
- The game imports `d3d9.dll`; ConfigDetect imports OLE32/OLEAUT32 and VERSION.
  Neither this import nor the repository's D3D9 implementation proves an
  authentic installed DX9c system or sufficient GPU support.
- All 174 installed-manifest members are present; none is DXSETUP, DSETUP,
  DSETUP32 or a DirectX setup CAB/INF. The recovered native dependencies are
  MSVCRT, SHLWAPI and STDOLE2; the additional provider is DXDIAGN. A single
  diagnostic-provider DLL is not a completed runtime installation.

The original installer was inspected read-only with `7z l`. It exposes PE
sections and an opaque overlay, consistent with the earlier InstallShield
bootstrap notes. **This does not prove that its compressed payload lacks a
redistributable.** Its contents beyond that listing were not extracted or
executed here. No external package was downloaded. The next useful input is
the genuine DX9c setup payload/manifest recovered from the original installer
if present, or another legally obtained, identified XP-compatible original
redistributable, followed by real installation/file/registration evidence.
Do not copy another game's Version value or synthesize installation state.

`current-launch-unexecuted.json` translates the historical launch to the current
`test/run.js`, canonical original files, XP profile, explicit DLL seeds,
root-relative VFS layout, genuine provider mount/registration, 180-second guard,
and current `build/wine-assembly.wasm` path. It is a preparation artifact only:
its `readyToExecute` is false and it must not be launched until the genuine
prerequisite and serialized runner/module/collector checks pass. Historical
diagnostic tracing and the old copied runner/module are not replayed.

No emulator divergence was demonstrated, so no production repair or regression
was added. No shared test, full build, browser, guest, acceptance, player input
or gameplay capture was run. `acceptedInGuest=false`; gameplay and DX9/GPU
sufficiency remain unknown. Original-session usage is **0 of at most 1**.
The Aranna1710 → Shadow1800 → legacy1820 order was respected by remaining in
source-only preparation and stopping at this input prerequisite. No runtime
ownership was acquired, and no current module/build identity is claimed.

Validation: required inventory rehash, static PE import/disassembly inspection,
unchanged registry/registration delta, current runner option/source inspection,
and read-only installer listing. These are file/static checks, not guest tests.
Git SHA plus relevant binary diff and this owned new-file patch are retained;
there is no source archive or duplicate media. No owned server/profile/port or
heavy process was created. The board watcher is terminated on closeout.
No box is assigned (ID/state/expiry N/A); coordinator lifecycle ownership and
laptop Heroes II remain untouched. No platform rejection occurred.
