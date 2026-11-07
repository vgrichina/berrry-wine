# MW3 original runtime assignment — 2026-11-07

The original browser runtime did not start. The bounded ten-minute preparation
window ended at 13:46:11 UTC with **1,668,419,584 bytes free**, below the owner's
2,000,000,000-byte floor. Evidence is in
`scratch/runs/20261107-mw3-original-qualified/`.

Disk briefly crossed the floor during preparation, but immediate admission
checks fell below it. The guarded allocation command failed at its first disk
assertion, before creating staging files or issuing any API request. A later
13:46:34 sample reached 2,135,494,656 bytes after the cutoff. No allocation or
boot followed that late recovery. `disk-samples.json` preserves selected exact
observations, including the cutoff and subsequent recovery.

Read-only preparation verified all 167 retained runtime file pins and all 37
local resource/registry-source hashes against the qualified driver's evidence;
there were no mismatches. This did not repeat the HTTP or fixture controls.
The qualified driver remains the one documented by commit `ccdf141cc` in
[the local driver note](mw3-local-driver-20261107.md).

The registered `mw3` route preserves authentic MSVCP50, Mech3Msg, fonts,
database resources, and normal configuration. The retained browser entry already
contains the original route. An in-memory syntax check passed for replacing its
fixture-only assertion and raising its disk guard to 2 GB. That adaptation was
not written or executed. The eighteen-field postbinding identity/module checks,
fresh reviewed captures, exact numbered acknowledgements, and independently
scheduled UP remain required. No UNKNOWN input was issued or replayed.

No production code changed, so no emulator regression, focused runtime test, or
locked build was applicable. No original pixels, cockpit, movement, turning, or
fire were obtained. Backend, gameplay FPS, and parity remain unknown; prior
fixture validation does not establish them. No PBO-warning analysis was repeated.

Box ID/state/expiry: **none**. There was no create, resume, stop, archive, or
delete request, and no owned browser, server, profile, port, or held input.
The owner explicitly delegated normal shutdown, but nothing was allocated.

Next: a new bounded assignment can reuse the retained pins and qualified driver
after disk recovery, create one fresh boat with a persisted UUID Idempotency-Key,
then set one immutable 25-minute original deadline and review fresh original
pixels before ordinary native input. Git plus relevant binary patches and the
existing media paths/hashes remain the recovery recipe; no source/media archive
was created. This assignment is finished with the concrete disk blocker.
