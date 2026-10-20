# Standalone Screen Savers applet recovery

Base: `2c1bb1fa464254e45749478dcdc73b2caaf4103c` (remote main verified).
Source provenance: `40193154b73bca813390df4b92a1ccf42be4dd5e` and the
append-only region correction `bf35c96b54502bd9209f4618abb8b409bbdab2d9`.
Historical save persistence work is already on main and is outside this patch.

The recovered applet lists the original 19 registered saver filenames, updates
selection details, launches Preview/double-click through ShellExecute, and
closes through its button or title bar. It has no PE or guest execution loop.
Class 35 preserves current MDICLIENT 33 and SysAnimate32 34. The 4096-byte
catalog allocation is appended; the current generator produces its mirror
without relocating any existing region. Original control IDs and geometry
remain intact. Failed window creation or ShellExecute is not reported as
successful. The local host uses current `init()` font preparation, suppresses
guest Worker startup, skips system payload mounting, and pumps at a 50 ms
idle delay with the existing input wake mechanism.

## Focused verification

Run from a complete checkout:

```sh
node test/test-screensaver-applet.js
node test/test-screensaver-wiring.js
node tools/check-wat-manifest.js
node tools/check-wat-fragments.js src/00-regions.wat src/09c3-controls.wat src/09ca-screensavers.wat
node tools/check-wat-logical-and.js src/09ca-screensavers.wat
node tools/check-region-decls.js --strict
node tools/gen-region-map.js --check
```

The applet test compiles the actual applet with the current vendored compiler
and a 256 KiB fixture memory. Explicit host/control doubles verify catalog
bounds, unique registry correspondence, list contents, selection, exact
Preview filenames, same-thread queued commands, double-click, 64 messages,
Close/dead pump, allocation/window failures and failed ShellExecute. Three
compiled mutations (wrong selection, lost queue, ineffective Close) must fail.
The host test executes current host methods against doubles, checks idle
scheduling, disallows guest loading/restart, checks six failed/canceled startup
cases, checks `.SCR` fallback, and validates applet registry exports including a
missing-export negative control. It checks every fixture boundary signature
against the current source and preserves existing control dispatch.

Local verification used an exact sparse worktree; the evidence preload reads
unmaterialized sources directly from the pinned base into memory. It does not
materialize the full tree or use shared dirty sources. Evidence and the replay
script are retained at
`scratch/runs/20261020-screensaver-recovery-bounded/` in the coordinator tree.

## Required qualification still pending

These are implementation tests, not native/browser or gameplay acceptance.
No full local build, runtime, browser, merge to main, or deployment was run.
The complete recovery-audit regression requirement remains:

1. Run the real native controls: catalog bounds/unique registered filenames,
   population and selection, same-thread queued Preview drain, exact selected
   filename ShellExecute, and Close returning a dead pump.
2. On a fresh cold browser launch, observe a painted catalog with fonts ready,
   zero guest EXE/DLL/SCR payload requests and no guest Worker. Test missing
   exports, cancellation and startup failure with no surviving applet.
3. Launch a real registered saver through Preview; closing the catalog must
   remove only its process while leaving the saver running. Verify bounded
   idle scheduling and no guest execution in the applet.
4. Run full current build/registry/region/control gates with assets available.
   The focused manifest, signature, declaration and generated-map checks
   do not substitute for the full build or real renderer qualification.

No claim is made about individual saver rendering or gameplay.
