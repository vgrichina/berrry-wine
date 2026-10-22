# Verdict: ORIGINAL_CONFIG_CHILD_BLOCKED_DSETUP_ORDINAL_11

ONE launch of the already installed original ShadowMan.exe on the same **bx_m4xrrj5a** genuinely spawned original D3DConfigUtility.exe. First precise blocker, from the real child-prefixed log:

`UNIMPLEMENTED API: <ord>` — **DSETUP.DLL#11**, through **IAT0x409024**, no handler and DLL not loaded as real PE. Child EIP0x0040309c, return0x0040297f. Actual interpreter trap **unreachable at batch6** follows. No configuration window, visible defaults, input or gameplay was reached. No repair or second attempt.

`raw/output.log` lines2081–2107 retain the diagnosis/trap. The earlier ole32.dll and comctl32.dll warnings are warnings, not substituted diagnoses. No capability/version/silent-success bypass was used.

## Genuine execution and exits

`raw/command.json` is the exact command/environment. Installed VFS and registry, authentic guest cwd `c:\program files\acclaim entertainment\shadowman`, installed native mss32.dll, unchanged staged runtime and historical wasm were used. No installer, extraction, media acquisition, build, other game, worker, production change or merge occurred.

Parent OS37693 / owned PGID37693 spawned config OS37702 / guest0x4004 through actual CreateProcessA. Parent guest **ExitProcess(0)** after this handoff is not game success. Parent Node eventually exited0 during cleanup; config **Node exit1**, independently reported by the actual child process exit event. Config guest ExitProcess was **not observed**; it trapped. The game process was not relaunched after configuration.

Two preload identities, two real WebAssembly module-instance records, authentic child573440B/hash, and realTicks=true for both are retained in `raw/*jsonl`. Supported `--pipe-child-args=--real-ticks` forwarded real ticks; no production runner mutation. Diagnostic fork targeting chose dynamic child-only port45011; actual child log confirms listening, no recursive control argument. Ports can race after ephemeral reservation; no collision occurred here. Worker-isMainThread preload guard preserved.

Child `raw/child-37702.png` is a valid2061B640x480 **blank teal canvas**, inspected directly. Its summary has zero windows and no guest input records. It proves neither a visible configuration UI nor gameplay. Parent/final PNGs are likewise not game success. No action was sent to the control endpoint.

## Offline gates before the sole guest run

* Real output to `/dev/full` produced ENOSPC errno28 while fixture child37015 and grandchild37016 remained alive. The independent process-group watchdog killed both, reaped the orphan grandchild (wait status15), and wrote/fsynced its preallocated65536B receipt outside mutable tmpfs. Monotonic elapsed0.719330496s <1.5s fixture bound; no survivors. Fixture includes no guest execution.
* Admission rejected a missing CreateProcess-input/child-export copy budget. The phase calculation reserves actual CreateProcess input, parent export and child export concurrently. Guard wraps the actual shared `lib/vfs-export.saveVfsToHost` before runner import, so the CreateProcess route and both ordinary exports are covered; it does not rely on the former process_spawn-only interception.
* Actual pinned codec encode/decode passed. A ten-assertion offline fork fixture checked real-tick forwarding, preserved recursive supported flags, fresh child-only control, unchanged stdio and rejects for missing ticks/inherited control. Actual child subsequently confirms these settings.
* All243 existing runtime/codec/original/support pins passed before and after launch, no rebuild/repack/download. Installed executable hashes matched separately. Gate records are `fixed/gate.json`, `fixed/fixture-receipt.json`, `fixed/fixture-enospc.json`, `fixed/forwarding-fixture.json`.

## Independent external bound and cleanup

`watchdog.py` is an OS-level Python supervisor, separate from synchronous guest JavaScript. Linux subreaper enabled; TERM then KILL targets the complete owned process group in finally, followed by parent/descendant waitpid. Receipt is preallocated in bounded fixed diagnostic storage outside mutable tmpfs; cleanup never tries to write guest output. No synchronous guest JS timer is used as the external stop.

ONE guest session aggregate monotonic **1.127420046s <=90s**. Watchdog detected actual RuntimeError from the sealed output, stopped immediately, and found **zero remaining owned processes**. Full log identifies the earlier unimplemented ordinal in that same failure. Actual child exit1 was reaped by the original parent (no orphan in the real attempt); fixture separately exercised orphan reaping. Parent logged orderly SIGTERM. Exact result/receipt: `fixed/launch-result.json`, `fixed/exit.json`. No ENOSPC occurred in the guest run.

## Measured allocation

Same existing tmpfs was remounted to the explicitly revised **939524096B hard maximum**. No deletion or guest-output relocation preceded launch. Original session192540672B stayed present.

| Phase/budget | Bytes |
|---|---:|
| Existing mutable usage |192540672|
| One page-rounded actual child VFS copy |188022784|
| Three concurrent copies: input + parent output + child output |564068352|
| Conservative per-file/path metadata + diagnostic allowance |41955328|
| Growth allowance |67108864|
| Projected mutable phase total |865673216|
| Enforced mutable maximum |939524096|
| Sampled mutable peak (exact highwater unknown) |567132160|
| Final mutable usage |379097088|
| Measured fixed staging/diagnostics at gate |85581824|
| Fixed ceiling incl diagnostic growth allowance |100663296|
| Separate reserve |33554432|
| Total authorized ceiling |1073741824|

Fixed ceiling + mutable maximum + reserve equals1GiB exactly. Measured projected phase plus fixed ceiling/reserve fits. Runtime actual-export admission records are in parent JSONL; parent export ran successfully. Config trapped before child output export. Its ordinary runner removed its temporary input snapshot; the original disk installation was untouched. No blind cleanup/deletion.

Immutable recovery allocation after new backup **1491165184B <2147483648B**; host free47564218368B >2982150144B floor. Precopy projection1498308608B included all new backup/transients. New187801600B allocated backup180637257logicalB was fully hashed against mutable output before handback; nothing deleted afterwards. Local whole-task allocation, including isolated Git/scripts/evidence and8MiB reserve, is recorded in `allocation-local.json`, below64MiB. No binary/archive was retrieved locally.

## Identity, preservation and handback

Original ShadowMan.exe1896448B SHA256 **4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772**. Original D3DConfigUtility.exe573440B SHA256 **850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0**. Historical wasm1878971B SHA256 **f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7**; **not a canonical compilation of current main**. Retained158-file host manifest revision13bb92cd2e1bc060ff908722843d1e97a439b1a4; reviewed production0a130dc477ac7e885d520d05093db880c7be941a, integrated main89f1e9d2c67aa94d56d2319115589d07204d42e0. User-specified source lineage closurea0236c978074ece58495c9eab7db6168e27e71b4 is inherited provenance, not a new build claim.

All2083 original installed-session/registry/evidence files still match the immutable retained-session counterpart after this attempt. This is preservation comparison, not repeated cabinet extraction/1959-file installation acceptance. Original registry SHA256d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3. Previous retained-game backup untouched. `fixed/handback.json` contains new backup hashes and allocations. `RECOVERY.md` names every remote path. Git preserves the diagnostic evidence, not original binary payloads.

Same **bx_m4xrrj5a left RUNNING** (actual API state idle, healthok, stopnull). Expiry **2026-10-22T21:52:45.530Z**. Coordinator retains ownership of20:50 shutdown checkpoint. No stop/delete/resume/fork/new compute or public deployment. Owned PGID37693 absent; fixture group also absent. Handback before20:40. One-task worker stops here; coordinator decides next assignment.
