# Neverhood installed launch: authentic persisted registry boundary

Evidence: `scratch/runs/20261117-neverhood-authentic-installed-room-gameplay/result.json`.

The newly authorized installed invocation was **not launched**. Read-only
recovery verified the prior actual installer output: 65 overlay records, all
58 file blobs, the installed-files manifest, original overlay index, registry
export, original public API log, full 257-member CD and the three pinned genuine
DLL inputs. The 51 removed byte-identical blobs were recovered and hashed in
memory from the original ISO; the seven unique generated outputs were checked
against the original artifact catalog. No recovered media or replacement
registry was written, and no prior process or endpoint was reopened.

The original `The Neverhood.lnk` (203 bytes, SHA-256
`61cb5df946735885c03ad2eb350e24f16651dc6bf9162d1785c7cfa330e14930`)
targets `C:\Program Files\DreamWorks Interactive\Neverhood\setup95.exe`.
It supplies neither arguments nor a working directory. The published
`browser-shell.js` shortcut route therefore uses that executable's directory
as the working directory. The installed target is the original 202240-byte
launcher with SHA-256
`ceae7885f49569fdc1100870286634c36d05eabe6010c228efef214c9444a95e`.
The installed 810496-byte `nhc.exe` also matches its expected
`82bf1e31ad6c811a4915f49da1a5ea841cc23b37b0ee212c6d90fddbba97d011`.
Substituting a direct NHC launch would skip the genuine shortcut route.

The first boundary is the authentic persisted registry. Its product key
contains only `KBPS` (DWORD 4294967295) and `Installed` (DWORD 1).
`Data Drive`, `Installed Directory`, and `Run File` are absent, including
case-insensitive and trailing-separator-equivalent product keys. The original
hash-verified public API transcript nevertheless records genuine writes of
these values at lines 61, 5727 and 5791. The final export is 25614 bytes,
SHA-256 `5a0bc056552fcae99ece2194f979e0439806f343e64f8ff54ca58535b4febc5c`;
the original transcript hash is
`dc3e8abed98e2061ee69a84f1ba112ca1bc43d5538e6fd07a6fdabbfe86fb5ff`.
This establishes an observable mismatch between earlier API writes and final
persisted state. It does not establish the cause of that mismatch.

The [original installed asset contract](neverhood-original-installed-asset-contract-20261113.md)
describes those public path values. This task re-read unchanged launcher/game
bytes from the pinned ISO and retained bounded read-only disassembly of the
path readers/writers and launcher initialization. Missing values have original
fallback paths; these are not evidence that the authentic installation source
path survived persistence. No fallback was executed or used to synthesize a
replacement installation record. The user explicitly defines missing authentic
registry as a recovery boundary and forbids registry fixups/key fabrication.
Accordingly, no registry was rebuilt from the transcript or guessed paths.

`tools/neverhood-original-current-preflight.cjs --installed` now checks this
provenance and reports `authenticInstalledLaunchReady: false` with the missing
values. It observes inputs and never mutates them. Its `verified` field means
artifact/hash verification, not launch qualification or playability.

The provenance/tamper checks, existing Neverhood controller units and Shell
Link COM test passed. A Git-only compile at published `9a95ce3744ad2453adff9dd9b63963e8a01e9a7a`
produced module `b46a7856634256d0f0ab799610de82589b78d0f44cd9f695e637738c154429f6`;
4599 Git source hashes matched. That module was compiled only, never used for
an original invocation. Its holder was joined with exit 0 and both pipes EOF.

The required shared-tree canonical build failed at the concurrently edited
C3 `PeekMessageA_fetch` lifetime gate. A separate attempt to run all canonical
gates against sealed published Git plus only the owned verifier/test patches
also refused: the census enumerated the VB worker's untracked
`lib/cli-native-common-controls.js`, which was correctly rejected as an unsealed
input. Neither failure was bypassed, and neither proves a published-main
regression. Accordingly only this documentation is committed; the verifier
and provenance test remain uncommitted in the shared tree, with exact patches
in this run. Their publication requires a passing canonical build after the
other workers finish their source/gate changes.

No game/launcher process, browser Worker, fixed native clock, input intent,
capture or native Quit was attempted in this task. The shared USER input
qualification dependency reported by the concurrent C3 worker also remains
separate; this task makes no claim about that worker's evolving repair.
No private original-game memory was read. There are no selected screenshots,
source archives, media copies, boxes or other workers from this task.

The earlier fa5ed/cff5 installer remains permanently UNKNOWN after its stale
Exit review; its successful installation, deferred restart, disabled Play,
host-cleanup native/watchdog waits and missing outer/holder joins retain their
original meanings. The d7 GlobalAlloc correction's original effect remains
UNMEASURED. Neither the registry mismatch nor static code explains disabled
Play dynamically, proves a successful restart, or proves native Quit.

Next is authentic persisted-registry recovery at its provenance boundary,
without replaying the closed installer, reinstalling, fabricating values or
silently substituting an executable/configuration. A later original launch
also requires exact-current native input qualification. This bounded task
stops with its single installed invocation unused.
