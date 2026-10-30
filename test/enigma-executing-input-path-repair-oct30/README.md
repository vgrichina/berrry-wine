# Original Enigma executing-path observation — 2026-10-30

Outcome: causal acceptance BLOCKED; gameplay NOT accepted. No production source or module changed. Exactly one original-game execution completed with exit 0 in 46.11 seconds, using the retained native input reproducer and module af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b. Original source build 425755ee5ee9be0734c7aca187521100f5487674. Parent aaf401d2f9b1d95031a6bf508e61f6e55603d66a. Runner identities are in observer-deploy.json.

## Findings

The retained DLL mapping is SDL.dll runtime base 0xe8e000, original PE base 0x68100000. Runtime PC 0xec9bd0 maps to original 0x6813bbd0: a callback checking message 0x3bd (WOM_DONE), then invoking ReleaseSemaphore through 0x6813feb0. PC 0xecdee0 maps to original 0x6813fee0, a jump through IAT 0x681554c4, WaitForSingleObject. These are mapped saved-PC interpretations, not claims that each PC was executing when sampled. Exact bounded disassembly and PE import-table names are retained.

The invocation-owned entry/post-handler trace, installed before guest initializers, recorded actual main-context ReleaseSemaphore(0xe0004, 1, NULL) entries at PC 0xecdeb0 and successful return values 1 with yieldFlag 0. The last 64 rows are these balanced calls. At final control boundary the main context remained parked with yieldReason 1 and wait handle 0xe0003. The wait handle and release handle differ. This alone does not establish that a wrong semaphore is used: SDL can legitimately own several objects. 388468 cooperative worker slices entered and returned, excluding absence of worker dispatch over the whole run; it does not establish useful worker progress or identify the worker's executing API.

Native UP was consumed at batch 74371 through check_input and routed to focus hwnd 0x10001. Polls subsequently reached 8722 then stopped while native UP keyup and Enter remained queued. The actual final frame remains the Enigma Main Menu. final-review.png is an inspected half-size nearest-neighbour derivative; frame-provenance.json binds its exact bytes to the retained original final.png. Full-size frames and raw runtime evidence remain in the stopped Boat snapshot.

## Rejected boundary and stopping condition

The observer's UP-triggered reset did not fire. Its h.check_input wrapper was installed alongside message-boundary installation, before the production runner assigns h.check_input at canonical line 4543; the later assignment replaces it. Consequently the first ring retains initializers rather than the first post-UP API chain. The old passing guest-poll wrapper is installed later and still proves input consumption. The tail is valid direct invocation evidence, but does not retain the decisive WaitForSingleObject entry. Worker API imports are not instrumented by this main-import wrapper. No current API is inferred from a saved PC or a stale pending name.

These explicit evidence gaps prevent a causal production correction. The authorized single retest is exhausted. No second execution, state edits, forced callbacks, mutex unlocks, audio suppression, production patch, main integration or public deployment occurred. A later coordinator assignment can move the reset behind final input binding and bind actual worker import invocations, preserving this evidence; this task does not authorize that additional runtime.

## Validation and recovery

Pinned parent/source files and canonical filename-bearing mount argv passed before runtime, including the supported tree mount of 2460 files (no comma-bearing paths in this set). The unchanged legitimate-file/output-overflow wrapper receipt was reused. Generated FSIZE remains 12 MiB; captures 512 KiB each/4 MiB aggregate. Actual Node v24.22.1 startup with heap512 and inherited limits is recorded in selected-runtime.json; syntax check passed. Observation assertions passed against actual runtime evidence; causal/gameplay acceptance failed explicitly. No synthetic substitute or broad regression replay was used.

Runtime box bx_yvskdryx had a finite1800s TTL and independent watchdog armed before API smoke. Explicit all-path shutdown was delegated in the task. closeout.json verifies completed post-run snapshot and stopped state. Coordinator receives ownership of the retained stopped snapshot. Local closed API exchanges are losslessly archived with per-member SHA verification before unlink, adjacent closed-api-recovery.json. All original denials remain preserved in inherited recovery roots.
