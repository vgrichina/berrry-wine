# Neverhood authentic installed shortcut and media handoff

Evidence: `scratch/runs/20261117-neverhood-authentic-shortcut-installed-room-action/`.

The authentic normal-installer export was restored byte for byte: 65 overlay
records, 58 files and the original 108-entry registry export. Fifty-one file
blobs were recovered from the existing pinned CD members; seven generated
outputs came from the retained original artifacts. The original artifact
catalog, provenance, registry, overlay index and every recovered file were
checked before execution. Pending WININIT files and registry entries were
preserved unchanged. Neither installer endpoint was reopened.

`ShellLink.parseShellLink` and the public `InstalledShortcuts` restore/entry
functions resolve the generated Start Menu shortcut to installed SETUP95.EXE,
empty arguments and the target directory as working directory. The CLI adapter
uses those resolved values with the original registry and overlay. It does
not select NHC directly, synthesize installation paths or acknowledge the old
installer's completion dialog.

Publication `7b47649be` adds this preparation and the authorized installed
1800-second invocation, independent 1820-second watchdog and 180-second Quit
reserve. The input controller remains unchanged: 500 ms native consumption,
1750 ms independent physical UP, 3000 ms aggregate observation, 30-second menu
and 15-second game freshness. The retained module is SHA-256
`5a4178950559d4f677d86aa75403908abee343493805f01a0b8aae8f1df2429a`.
Native, participant, startup and atomic-capture proofs are reused by matching
components. New preparation and lifecycle checks pass; no unrelated native
suite was regenerated.

The first installed invocation displayed the complete launcher with an enabled
Play BUTTON, HWND 0x10004 generation 4. A personally reviewed finite Play click
received `native-button-dispatch-return`, matching actor/generation/nonce,
independent physical release and aggregate completion in 283 ms. Its next
complete image showed the actual Error dialog. Both ShellExecute and the
launcher's fallback CreateProcess failed at the same public host boundary:

```
readonly media context refused: readonly media drive has no source ownership: d
```

The installed NHC bytes were present. The explicit `--iso` path mounted a
read-only drive without registering an owned provider, so the existing child
inheritance guard refused it before spawning a child. This is a generic CLI
media handoff fault. A later successful capture returned blank teal pixels
despite a public modal snapshot. That image qualified no further visible
target. The endpoint was permanently closed, with zero later HTTP, and stopped
by explicit host cleanup. Native Quit was not claimed.

Publication `d4b41d401` fixes explicit ISO ownership. It mounts files through a
live `NodeFileProvider`, records the source identity/hash and exact drive/parser
options, and restores that actual mount in native children. It retains the
existing provider, namespace, read-only, file metadata and revoked-owner
checks. Sources close at process exit. No game DLL, file, registry value or
pending rename was substituted.

An authored parent/child fixture reproduced the original refusal using the
published old runner and retained module. The fixed path passes on the same
sealed core: a real child starts, its DLL initializer reads the inherited disc,
its working directory and volume identity match, read-only writes are refused,
and its parent verifies merged file/registry writes and both native exits zero.
Nondefault-drive/primary-parser remount and revoked-source host checks pass,
as do the existing media context regression and locked canonical build. Runner
normalization proves the only change since the startup/atomic proof is the
explicit ISO mount block; native input/capture policy is unchanged.

The conditionally authorized second installed invocation used that published
fix and another byte-identical restoration. The operator attempted the first
controller capture immediately after the native PID record appeared. Its local
FD/TCP listener ownership assertion failed before any HTTP request. PID presence
was insufficient to establish listener readiness. This was an operator launch
sequencing error; the later native log records normal listener startup. The
permanent UNKNOWN latch was honored: no capture, bind, input, later query or
retry. The invocation was stopped by host cleanup. No third invocation is
authorized by this task.

Both originals have actual native, adapter, outer supervisor, persistent owner
and independent watchdog waits with both EOFs and empty remaining scope. Exit
zero is host cleanup, not native Quit. Room and ordinary object progress remain
unproved. The measured media handoff boundary has a faithful tested published
fix; applying it to original Play remains unverified because the second run
closed before input. Any further original run requires separate authorization
and a locally observed owned listener before entering controller startup.

No boxes, workers or public deployment were created. Box ID/expiry are null,
state NOT_CREATED and stop receipt NOT_APPLICABLE. Closed restored copies are
recoverable through the retained per-file hash recipes; unique new evidence,
selected full PNGs, logs and tested module provenance are preserved.
