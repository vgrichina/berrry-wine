# Reviewed helper plan staged; first settings-capture fixture blocker

This bounded task advanced beyond the old pin failure: the newly authorized
224-entry plan passed its actual-plan fixture and nine rejecting controls,
all runtime entries were uploaded and verified, and ONE hard tmpfs / ONE
2,045-file ordinary-user VFS clone was prepared. Guest execution remains
**UNEXECUTED** because the subsequent required settings-capture fixture failed.
Stopped at this first concrete blocker; no repair or runtime retry was attempted.

## Separate historical failure and current successful plan gate

`prior-failed-offline-plan-fixture.json` and `prior-failed-REPORT.md` preserve
53407046c7817001001fdf27bfea3a70fd3a87d5's three stale-helper failures.
`historical-accepted-fixed-pins.json` preserves the old pins. The authoritative
historical staging plan was not edited. `helper-review.json` explicitly
approves three new helper identities. `reviewed-diff-check.json` proves exactly
three reviewed replacements and 221 unchanged entries. New plan SHA256 is
`f50d1bcb37fcc27710e34f2391e4f7057cdc1c7f20b86bfa8abea6360b7c0ad7`.

`offline-plan-fixture.json` now records **passAll=true, donorIdentityPass=true,
stagingAuthorized=true**, zero mismatches and nine rejecting controls.
Classification is 216 immutable + 8 fixed = 224; separate ctl-pin receipt
makes 217 immutable closure/receipt entries. All main Git identities, exact
manifest destinations and command/Worker/PNG/storage/ctl dependencies passed.
The old failed receipt is not reinterpreted as a success.

`stage_runtime.py` completed the runtime-only supported signed raw PUT recipe,
with buffers <=64KiB, no retries, no original file transfers and no credential
or signed URL persistence. `stage-receipts.json` contains 224 successful
size/SHA256 receipts. Destination full-hash gate exit0 verified these entries,
separate ctl receipt and all 2,083 originals (186,399,681 bytes). Before and after
staging, original hashes exactly match `destination-original-hashes.json`.

## Preparation passed, then a concrete required fixture failed

`prepare_runtime.py` exited 1 at `settings-capture-fixture-api.json`.
Earlier phases succeeded in this order:

- Full destination hashes / actual allocation projection: exit0.
- ONE 896MiB tmpfs mount, UID/GID1000 mode0755, ordinary write/delete probe,
  ONE 2,045-file VFS + pristine registry clone: exit0.
- PNG roundtrip, static dependencies, ten forwarding assertions and five
  rejecting compile-guard controls: exit0, retained in handback fixed receipts.
- Canonical module consumption and base command preflight: exit0.
- External out-of-process `node -e 'for(;;){}'` fixture: exit0; PG43446 reaped
  after 1.21275243s <=2s, parent OS exit -15, remaining=[]; no guest instance.
- Settings-capture diagnostic fixture: **exit1**, synthetic changed-path capture
  raises `Error: unsafe diagnostic guest path` at `settings-observer.cjs:21`.

The diagnostic fixture supplies a normal single-separator Windows path
`c:\test.ini`, captures its unchanged baseline, changes synthetic bytes to
`actual-change`, then calls `__shadowCapture('after')`. The supplied observer's
regex and split/replacement expressions use two literal path separators;
the normal single-separator fixture path fails the observer's safety check.
See exact source `settings-observer.cjs` and exact fixture construction in
`prepare_runtime.py`. This is a helper/fixture blocker, **not an observed guest
failure**. No safety check was bypassed. No observer repair, duplicate fixture,
second clone or guest launch followed it. Synthetic fixture evidence is isolated
under mutable/output/save-gameplay/diagnostic-fixture, outside the VFS clone;
it is not a genuine guest settings write or runtime acceptance.

The base preflight is not final session acceptance: session1 preflight was
never reached, no fixed/save-gameplay session directory exists, and the
settings fixture's required pass condition is false. Historical syntax-only
checks did not establish the observer's correctness. Original Configuration
OK/defaults, save/persistence, actual Play enablement, launch and input remain
**UNTESTED**. Zero of three guest sessions, zero game launches, zero new PNGs.
No candidate result.json is attached: this unregistered guest uses this note.

## Identities and handback

Runtime production source remains `58e90870a40a541a4083cae5e987ca8de31889e6`.
Read-only actual remote main matches docs successor
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`; no source/build/main merge.
Canonical module is 1,879,387 bytes SHA256
`ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`,
consumed by the no-guest compile fixture under the fallback guard.
No guest module instance, renderer/native-game ownership or gameplay result
exists. API shell `node` resolves to Node v20.20.2 under preflight's explicit
/bin:/usr/bin PATH (the coordinator's prior v24 check used its own environment).

Pristine and cloned registry are unchanged 17,088 bytes SHA256
`d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3`.
`handback.json` retains exact native seals for D3DConfigUtility, MSS32, DSETUP,
ShadowMan.exe; all 2,045 clone files equal their originals. All 2,083 originals
and all 224 staged entries rehashed unchanged; immutable tree is read-only.
Historical Spielen-disabled and ABANDONED synchronous callbacks remain prior
observations; no new callback-completion or fatal-warning claim is made.

Measured admission before checkout was 64,126,976 bytes including used donors,
own allowance, Git/tools allowance and 8MiB reserve inside 64MiB. Final verifier
records actual total and host free against the 2,982,150,144-byte floor.
Remote final immutable206180352B <2GiB, fixed147456B <96MiB,
tmpfs183619584/939524096B; fixed96+tmpfs896+reserve32MiB ceiling remains1GiB.
Remote free48837165056B. No clone/guest-export capacity failure occurred.

**bx_fn7pn7yg left RUNNING**, API idle/healthy/stop=null,
expiry2026-10-23T03:46:00.580Z. No Node processes or owned groups remain.
Coordinator owns lifecycle and02:50 shutdown; immediate handback before02:45.
No lifecycle operation, recovery/reinstall, source edit, broad harness expansion,
replacement task, worker launch, laptop or public deployment occurred.

Evidence is published on task/shadow-man-reviewed-helper-config-runtime-oct23;
publication.json and append-only messageboard record independently verified
remote backup. Stop after this concrete blocker and handback.
