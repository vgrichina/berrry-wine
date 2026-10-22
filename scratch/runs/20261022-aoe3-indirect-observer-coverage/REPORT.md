# AoE3 indirect-call and nested-return observer mechanics

**PASS: the existing exact historical module's `host.log_eip` supplies usable current-instance register context across the controlled x86 indirect calls and nested guest returns. No missing module primitive was found.** A diagnostic-only instance binding wrapper, reproducible copied-runner generator and explicit mechanics gate are ready for the coordinator's next separately assigned original trace. Original XML/native outcomes and the first lost text boundary remain **UNKNOWN**. Zero original-game executions, runtime accesses, compute creation, production changes, builds or integrations occurred.

## New executed controls

Run `python3 scratch/runs/20261022-aoe3-indirect-observer-coverage/verify.py` from this checkout. Node v24.18.1 executes the **unchanged historical WASM** in two independent synthetic memory arenas. `actual-wasm-controls.json` contains synchronous raw getter snapshots alongside observer records. These are actual WASM interpreter executions of **synthetic control programs**, not mock observer block submissions, original-game executions, or native MSXML behavior.

The original PE is read in place and hash checked. Original instruction bytes at `0x8e98b1..0x8e98df` and `0x8e98ec..0x8e9903` execute unchanged. This covers `FF 15 94 08 B3 00`, `FF 52 28`, `FF 52 38`, and `FF 56 50`, including original branch/fallthrough layout. Synthetic functions populate the vtable and imported-call target. They return distinct EAX values; the last original return boundary `0x8e9904` contains a deliberately synthetic stop loop. Other functions, data, addresses and stops are explicitly synthetic fixtures. `opcode-fixtures.json` records the exact copied ranges.

The first method surrogate makes an indirect register CALL to literal `0x486e30` with four WM_INITDIALOG-shaped arguments. That synthetic callback indirectly calls a second synthetic guest callback, which writes UTF16 and returns. Observed stack depths are caller `0x700000`, first method `0x6ffff4`, outer callback `0x6fffe0`, nested callback `0x6fffcc`, then restored in reverse. Nested EAX is `0xc001/0xc002`, outer callback EAX `0xb001/0xb002`, method returns `0x101/0x102`, `0x201/0x202`, `0x301/0x302`. Original after-return addresses `0x8e98b7/ca/dc/9904` and pre-call blocks `0x8e98bf/fb` report the expected stack, registers, object/vtable or URL state. This models stdcall guest callback mechanics; it does not execute an OS dialog dispatcher or the original callback body.

Each instance first receives **800 unrelated ReadFile entry/exit fixture pairs** through actual exported register getters. These API events are mock host submissions, not executed guest ReadFiles. Each emits zero records and leaves later observations available. Actual execution then produces **48 observer records, 54 block-hook calls and 58 full-memory/register read-only seals**. Two instances alternate execution; each has distinct EBX/EDI/EBP and return-register sentinels. Every observer register object equals the raw getters captured synchronously in the same import. All observed caller/callback stacks restore correctly. The nested callback changes `PRE1/PRE2` to `INE1/INE2`; a later synthetic ID19891 lookup returns a dynamic object, and both `0x8e4603` object UTF16 and `0x8e46ca` wrapper destination read the changed strings. This is an instrumentation fixture, not successful original lookup/copy behavior.

Negative controls reject a missing `0x8e98dc`, stale pre-return EAX, swapped instance ownership, stale UTF16, hook rebinding, and mismatched EIP. `mechanics-gate.js` additionally rejects missing return coverage and evidence relabeled as nonsynthetic. Its accepted result is `mechanicsReadyForNextAssignedOriginalTrace=true`, `originalRouteEvidence=false`, `guestRunAuthorized=false`. This intentionally separates mechanical qualification from actual-route evidence and avoids demanding an original run before testing instrumentation.

## Diagnostic harness

`instance-hook.js` captures one exports/memory/translator context per observer; binding twice fails. Imports read the bound context synchronously, verify the reported EIP, and call the unchanged quota-corrected observer. No guest calls, writes, breakpoint changes, allocation, timers or scheduling changes occur in observation. Full memory and exported register seals surround calls in the actual-WASM controls. Synthetic program/data construction and its own intentional UTF16 writes occur outside observation.

`prepare-harness.py` reads the previously retained diagnostic runner and quota-corrected observer in place, checks exact hashes, writes a **new local output directory**, and syntax checks the generated CommonJS files. It never connects to or executes a box. `harness.patch` is the complete change against that pinned diagnostic input: main binding immediately after instantiation, independent cooperative-instance block observers bound through `__setInstance`, and an explicit OS-worker-mode rejection. No production source or module is changed. The main observer's API supplementation remains as before; cooperative instances receive block snapshots only. If required API entry/exit evidence occurs on a cooperative instance, this harness must report that missing evidence rather than substitute main-instance API data. OS worker_threads are outside this bounded harness. The generated runner was syntax checked, not started.

The controls validate the actual hook/observer functions and indirect instruction mechanics. They do not validate all runner startup dependencies, shared-memory cooperative scheduling, host-side reentrant callback setup, arbitrary interior-instruction trace addresses, or the actual native library's chosen code path. Entry/return blocks tested here are concrete. API-handler exit remains distinct from guest/native callback return.

## Identities and recovery

- Historical source: `c26252c4a95babe583ade1d1c6e2da0c050be45c`; historical exports source SHA256 `bcbf5b24281cc993e0e6f897fc99c69f2c14730f9056dcfd098d3c2892f3afc6`.
- Exact module: SHA256 `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`, 1878971 bytes, extracted temporarily from existing archive SHA256 `3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`. `verify.py` records its donor path. No module/archive duplication is retained.
- Original PE used only for byte verification: SHA256 `5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256`. No full PE is loaded into either arena.
- Original runner: SHA256 `1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799`. Retained diagnostic input: `8b0295232f0ecccbcf65d22628469dd4165f35a2856fc9464b589123158d6753`. Quota-corrected observer: `b89ab5bba916de36a324b6068d7df09f26ef227f8940ca58995677b946032032`.
- Inputs: `af2c790be6eebe9d41b93ee4d5d4ffe9984c587f`, `c8cc00f2da99f0b0016ad60704f7db36081c3dce`, read in place. Base: `63d563df7a2b901d222a311ceaf55a0823a22261`. No old evidence package or old verification suite was replayed/repackaged.

Example **local preparation only**, after replaying verification:

```sh
python3 scratch/runs/20261022-aoe3-indirect-observer-coverage/prepare-harness.py \
  --output-dir /tmp/aoe3-next-diagnostic \
  --deployment-dir /home/user/aoe3-original-oct22/diagnostics-indirect-next
```

Use a nonexistent local output directory. Transfer/startup is a future coordinator assignment, not this command. Do not replay the previous `prepare.py` or expired driver deadlines. No runtime command or new guest driver is delivered by this offline task. Important outputs, code and recovery recipes are committed; the ignored temporary module is reproducible from the pinned donor.

`bx_5mu9dnhg` was **SNAPSHOT-STOPPED** by coordinator stop `stop_71ddd00bf5d00b7c` completed 2026-10-22 10:26:14 UTC, per supplied receipt. Previous expiry was 10:48:47.315 UTC. No box was inspected, resumed, forked, created, executed, stopped or deleted by this worker; lifecycle ownership stays with the coordinator. Root protected-file hashes and local allocation are recorded separately. Task branch/commit and verified remote ref appear in the append-only repository messageboard and final handoff. No merge, children, delegation or refill.
