# TR2 mapped weapon snapshot repair — 2026-11-08

Offline repair of the observer's direct-only read restriction. No original,
Chrome, game loop or remote box ran. The 1914 failure's actual address and
pointer values were not retained and **cannot be reconstructed** from its
report. This change does not establish that its pointer was valid, identify
its exact failed field, or claim a successful production weapon observation.

Evidence R: `scratch/runs/20261108-tr2-mapped-snapshot-1925/`. Git records
source; R records starting SHA, relevant owned binary diff/small patches,
fixture results, compressed test/build logs, selected providers and existing
media/module path+hash. No source archive, media copy or peer WIP is retained.

## Exact selected failure path and limits

The [1914 report](tr2-early-weapon-20261108.md) retains poll at boundary30876,
Action EBX40 at31049, then generic `Error: TR2 unmapped read` at31184 with only
two rows, pending/pendingWeapon/pendingShot=false and removed=true. Requested
Control2000ms measured2001ms: the explicit overrun remains. Drawn pistols/full
health are pixels, not a weapon-state snapshot or a readiness/aim/shot proof.

Its 615-provider selection pins `tools/tr2-action-observer.cjs` to SHA-256
`eb01238a18f965f17331d96dc8a46460ba0a80c6c4743db8d15b3a72e6bbb96c`,
identical to Git `aadf4012e`. There is no intervening runtime read adapter:
`workerSource()` serializes `install()`, whose local `read()` only accepts
`guest-400000+12000` within the 08000000 direct window and discards address
and length when throwing. It never called the CPU translator.

At a matching input caller return (`41427f`, `411fd8`, `4220a7`), the observer
checks saved caller, ESP=ActionESP+6c and the published Action bit, then calls
`weaponRow('input-published')`. That function verifies instruction pins and
constructs `state()` **before** appending a row or setting `chain.published`.
The old `state()` first loads item pointer52173c, reads fixed input/weapon/arm/
ammo fields, dereferences nonnull target5216e0 at target+22, then dereferences
nonnull item at +22/+14/+16/+0e/+42. The observed source ordering narrows the
failure to this first snapshot path; the report does not identify which read
failed. Outside-direct valid pointer versus invalid pointer remains UNKNOWN.
There is no retained memory image or pointer value to recover that lost fact.

## Repair and causal evidence

The serialized observer now embeds mapping addresses from the selected
`lib/region-map.generated.js`. Its reader mirrors the selected CPU's direct
window, high DIB arena and authoritative packed PTE lookup (present bit800),
loading memory/metadata only. Each byte is checked, including crossed pages;
noncontiguous valid sparse backing is read correctly. Absent PTEs never fall
back to allocation records or the null sentinel. Invalid spans, corrupt PTE
backing into private storage, and backing outside memory fail closed. PTEs
are reread after copying to reject an observed mapping change. The DIB reader
conservatively refuses while lazy shared metadata reports a lock or pending
work, before and after copying: it never calls a materializer or returns stale
pending bytes. Mapping membership follows the CPU; it does not prove object
allocation/type validity or an atomic snapshot against every other thread.

Failures retain `readFailure.address`, `length`, `field`, `reason`, `pc`, `esp`,
`boundary` and snapshot row kind when applicable. Snapshot fields have names
such as `targetHealth` and `itemState.health`; no partial snapshot row is
appended. Actual null pointers remain explicitly null and are not dereferenced;
unmapped/invalid pointers never become null, zero or guessed state. Other
call/link/instruction errors retain their existing fail-closed behavior.

`R/causal-baseline.cjs` obtains the **exact selected** old source from Git,
checks its hash against the 1914 manifest, and applies identical authored
state/stacks to old and repaired observers. Production d8fac's real allocator
commits sparse12000000; its HP word is authored777. Old item or target reads
at12000022/length2 fail before any input/weapon row, reproducing the failure
mechanism with the same generic error. The repaired observer records the
actual values through the first linked weapon return. Those are explicit
causal fixtures, not a reconstruction of the old runtime address or state.

The expanded weapon suite retains all prior exact-byte cases and adds actual
production sparse/DIB allocation, direct+sparse and sparse+direct objects,
sparse+null, sparse+sparse, DIB+null, direct+DIB and actual null pointers.
Original x86 `42e666..42e679` loads Lara's pointer and compares mapped HP on
the exact production CPU; positive HP reaches42e949. Missing/low/wrapped
pointers, a two-byte word crossing into a missing page, corrupt/out-of-memory
PTEs and pending DIB data stop UNKNOWN with exact field/address/length and
only poll/Action rows. The same word across two valid noncontiguous PTEs is
read correctly. Full512MB before/after hashes prove no observer writes on a
complete linked trace and each failing fixture; forbidden translator/setter
hooks throw if called. Sparse mappings do not weaken saved-caller, stack,
full published-mask or weapon-caller requirements. Serialized native-hold
orchestration also exercises mapped state and independent release.

The first linked weapon return still stops observation. The32-record cap,
2500ms deadline, activation after native keyDown, actual retired-block debit,
caller remainder forwarding and input/native release policy are unchanged.
No guest write, binding, config, backend, clock, seed or budget change is made.

## Validation, selection and next step

Weapon150 checks and Action32 checks pass; helper closure13 and provider
transition8 checks pass. The full build passes under `/tmp/wine-build.lock`;
its result and original-byte log hashes are in `R/checks.json`. CPU bytes
remain SHA-256 `d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
Prior95 artifacts, including accepted126 weapon/32 Action/direct+RPC/closure/
build proofs, are independently reread and reused by hash in
`R/accepted-proofs-reused.json` rather than copied or requalified.

`R/prepare.py` uses `tools/native-runtime-generation.py` to select the one
changed observer, then `tools/runtime_helper_closure.py` to relocate/validate
all29 helpers. All615 providers resolve by hash; other585 nonhelper providers
are unchanged. The region-map dependency already belongs to this closure.
Historical selections remain unchanged. This prepares an explicit opt-in
selection; it launches nothing and grants no original authorization.

Next is a separately assigned original with fresh owning authority and the
same bounded input policy. Inspect a linked snapshot or its exact read
failure before further gameplay. No production repair/consumption, aim, hit,
kill or physical-GPU qualification is claimed. Intel versus SystemInfo
SwiftShader remains unresolved; Full27/parity/audio/FPS remain open.
Box ID/state/expiry/stop receipt: N/A (none created). No old-box operation,
public deployment, old-run deletion, subworker or worker launch occurred.
Single-task worker releases its paths and stops after publication.
