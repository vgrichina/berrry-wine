# Quake II owning move-up and lateral binding coverage, 0625

The production passive reader now reports live Space, Mouse2 and lateral
bindings before input and during existing held samples. Previously it only
reported Enter13, Control133 and Mouse1200. That omission allowed an `a` command
to be described as move-up without a binding row to inspect. The 0600 original
PNG established `a` = step left and Space/Mouse2 = up/jump; its Space ascent,
consumption and ladder-contact cause remain UNKNOWN.

This is an offline code correction, with authored shared-memory and protocol
fixtures. No original game, Chrome, box, local browser, deployment, agent or
worker was started. Box ID, expiry and stop receipt are null; state NOT_CREATED.
No live pmove contact field is added: no independently justified owning contact
address/lifetime was established here. There is no new causality claim.

## Exact executable mapping

The existing installed `quake2.exe` has SHA-256
`2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
The reader's existing seven canonical windows remain unchanged. MapKey at
0x42fe10 reads the scan byte and table at 0x44d398. The existing instruction
at 0x41911a reads the binding pointer from `0x4d6c60 + key*4`.
Tests verify keyboard scan entries directly from the SHA-checked executable,
and verify original keyname records, including MOUSE2 at 0x448ec8 = 201.

| Input | Set-1 scan | Quake key | Binding pointer address |
|---|---|---|---|
| Space | 0x39 | 32 | 0x4d6ce0 |
| Mouse2 | n/a | 201 | 0x4d6f84 |
| a | 0x1e | 97 | 0x4d6de4 |
| d | 0x20 | 100 | 0x4d6df0 |
| comma | 0x33 | 44 | 0x4d6d10 |
| period | 0x34 | 46 | 0x4d6d18 |
| left arrow | 0x4b | 130 | 0x4d6e68 |
| right arrow | 0x4d | 131 | 0x4d6e6c |
| Alt (strafe modifier) | 0x38 | 132 | 0x4d6e70 |

Physical rows append Win32 VK32/65/68/188/190/18. Quake keycodes and Win32
VKs remain distinct. Mouse2 is a binding row, not a fabricated keyboard state.
The existing attack fields and first three binding rows retain their order
and meaning. The table bounds check extends by four bytes to include key201.

## Reader behavior and safety boundaries

Every added binding uses the existing bounded 128-byte reader, stable double
read, and final PTE validation on the same owning memory/buffer. Its atomic
packed PTE interpretation matches `$guest_page_translate`/`$g2w_slow` in
`src/03-registers.wat` and the JS translator. Readable PAGE permissions, private
backing bounds, complete cross-page coverage and identity checks remain
mandatory. Missing/changed mappings, binding bytes/pointers, permissions or
owners return UNKNOWN. The conservative direct ceiling remains 0x04000000;
no DIB or allocation-record fallback is introduced. Full-memory hashes verify
zero writes for direct and sparse reads.

Stable custom bindings are reported literally. In controls, a stable Space
binding changed to `+movedown` is reported as `+movedown`; a change during the
double read is UNKNOWN. Neither key names nor defaults are promoted into live
actions. SNAPSHOT still means a latch/binding snapshot: consumption and weapon
effect remain UNKNOWN, with no proof of usercmd execution, ladder contact or
ascent. ABA between reads is not excluded. The observer injects no input.

There is no production caller change: the actual composition already installs
this reader on captures and held progress. Its native Space encoding was
already correct. Native lifetime remains REVOKED; all-writers and edict ABA
remain UNKNOWN. Strict lineage, both observation flags, preCPU/preDLLmain
zero-entry barriers, all work/ACK/hold/freshness caps and native custody are
unchanged. No peer Drakan/Warcraft or native-custody source is edited.

## Regression evidence

Evidence directory: `scratch/runs/20261109-quake2-moveup-observation-0625/`.
`git-base.txt` and `relevant.patch` are the source recovery references, with
original media/config/source paths and hashes in `canonical-inputs.json`.
Only small disassembly extracts, inputs and unique logs are retained; no
source tree, media or module archive is made.

The old Git-base reader fails the new sparse regression because Space32 is
absent (`old-fail.log`). The actual composed caller/driver regression also
fails against that old reader because its Space binding row is absent
(`composed-old.log`, `old-reader-preload.cjs`). The control obtains old source
from Git in memory, without replacing shared files or copying a source tree.

The new reader tests exercise all nine added keys through owning sparse PTEs,
stable custom bindings, per-key byte/pointer/backing/permission/owner races,
missing mappings, invalid permissions/private/bounds/direct-window cases,
canonical-window and memory replacement cases, cross-page/full128 validation,
ASCII/NUL rejection, and zero writes.

The full composed driver tests use the actual composed Python launch/request
branches and owned Session, actual numbered Node transport, driver command
loop, serialized owning reader, native input helper and renderer queue. Only
remote transport, startup, review images and browser/CDP peer are fixtures.
The launch transport remains a live local sleeper until cleanup. Space uses
CDP `key=" "`, `code="Space"`, VK32 and queued WM_KEYDOWN/UP scan0x39;
`a` uses KeyA/VK65. Startup and held rows report the actual sparse `+moveup`
and `+moveleft` bindings on one memory identity. DOWN/UP ACK failures still
attempt balanced release, preserve UNKNOWN when release is unacknowledged,
and block subsequent commands. Child actual waits and separate stdio EOF are
recorded. These are offline queue/protocol checks, not original consumption.

Validation: `passive-final.log`, `composed-final.log` (all 14 scenarios),
`launch-client-final.log`, and `locked-build.log` record focused tests and
`flock /tmp/wine-build.lock bash tools/build.sh`. `result.json` records their
final status. Next: separately authorized gameplay can inspect the new live
binding rows before choosing controls; Space consumption/contact/ascent still
require independent evidence. Single-task STOP after publication.
