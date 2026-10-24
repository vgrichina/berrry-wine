# Opt-in head yield observer — 2026-10-24

Implementation passes cheap controls. **Native off/on equivalence is NOT qualified.**
The only authorized retained-module attempt failed an off-control fixture assertion
before the on lane ran. No repeat, game, build, acquisition, box or deployment.
Historical original-game zero-record cause, EDI target and errno remain UNKNOWN.

`tools/maelstrom-head-yield-observer.cjs` transforms only the historical runner
SHA-256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`,
with pinned export source `739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86`
at revision `d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`.
Disabled transform returns the input byte for byte. Enabled mode requires exact,
unique anchors and both pins. Raw watch flags are rejected during argument parsing,
before guest memory exists, including deferred/JS-only watch configurations.

The explicit profile is `--trace-at=7a3362 --trace-at-start-batch=36163
--trace-at-limit=1 --count=7a3362,7a3366`, original batch size 1000, no break or
watch configuration. Use the historical runner's normal startup recipe; this
profile does not itself supply game inputs or authorize a guest. CLI:

```
node tools/maelstrom-head-yield-observer.cjs --enable PINNED_RUN_JS PINNED_EXPORTS_WAT NEW_ADJACENT_RUN_JS
```

The new output must be adjacent to the runner for its relative imports. No extra
run, breakpoint write, counter clear, clock change or guest-memory write is added.
The existing set_bp is observed, and the existing main run/skip conditional is
wrapped without changing its scheduling decision. A genuine head halt requires
halt 5, matching EIP/breakpoint readback and exact instruction bytes
`8b e8 ff d7 83 38 04`. Registers EDI/EAX/EBP/ESP, yield reason/flag, halt,
entry counters, cache stores/clears/invals and block count are read through real
export names from pinned `src/13-exports.wat`. Six boundary pairs, arm and summary
produce at most 14 records, with enforced ceilings of 16 records/8192 bytes.
Later boundaries are unsampled; absence of a later record establishes nothing.

Only pinned reason 1 with halt 4, unchanged head EIP, registers and cache state is
classified as pending yield before instructions. Other transitions remain UNKNOWN.
A head breakpoint says the current instructions have not yet run at that halt;
it does not say no instructions executed earlier in the invocation. Entry counts
never establish executed CALLs. Genuine halt/readback checks precede code reads.

Cheap command (under the retained bounded supervisor):

```
node --max-old-space-size=256 test/test-maelstrom-head-yield-observer.js PINNED_RUN_JS PINNED_EXPORTS_WAT
```

Controls passed: disabled identity; altered/missing pins; missing/duplicate anchors;
early watch conflict with untouched sentinel; all missing exports; wrong halt,
EIP, breakpoint and instruction readback; misleading counters and halts; skipped
runner boundaries; bounded output; syntax of transformed runner/native fixture;
no extra run or observer writes. Existing accepted tools and default/interior
assertions are unchanged. Exact-revision native acceptance at `369ba073` is reused
only as historical evidence; the old probe was not rerun.

The one native attempt used the standing 1879746-byte module SHA-256
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`, source
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, ABI 291/layout
`9a3bc9149d58209c`, fixed shared 512 MiB arena and Node heap 512 MiB.
Native admission passed with MemAvailable 2915176448; CPU 90 s/wall 60 s,
output 131072, per file 24 MiB, exclusive `/tmp/wine-ops-heavy-runtime.lock`.
It instantiated exactly once and executed only a synthetic CPU microprogram.
All native child processes exited naturally and were reaped.

Disjoint off-control `0x7a3c62/66` started with counts `[0,0]` before any run.
Five pending-yield entries alternated halts 5/4/5/4/5, head counts 0/1/1/2/2,
unchanged EBP/ESP and zero cache-store growth. Clearing yield consumed the head
skip, executed MOV/CALL/synthetic RET/CMP/JMP and halted at the head with EBP=EAX.
The final real interior breakpoint reached `0x7a3c66`, but interior count was 2,
not the fixture's expected 1. Pinned set_bp preserves bp_skip_once: the earlier
head halt's skip carries into the first interior arrival; it counts and loops,
then the second arrival halts. This was an independent fixture oracle failure.
The on lane did not run. It provides no evidence of observer correctness or
original-game causality.

The corrected fixture expects `[0,0,0,0,0,1,2]` interior counts and a cleanup count
of 3. Retained off rows match the correction in a static replay; corrected native
execution remains untested. A new native attempt requires a coordinator assignment
and fresh resource admission, not an unchanged retry in this task.

Evidence is sealed in the adjacent `maelstrom-head-yield-observer-20261024/`
directory. Full operational evidence and recovered exact blobs remain under
`/tmp/maelstrom-head-yield-observer-oct24/ops`. Recovery uses the immutable manifest
`/tmp/maelstrom-native-errno-capture-oct24/manifest.json`, SHA-256
`86111762b21d2c589925d13686bb2285bed23c89cce5243d1c27c407beb244fe`, and its runner
donor/revision; export source is recovered from that same revision and hash checked.
No broad checkout or donor mutation occurred. The initial manifest capture exceeded
the requested read bound and was truncated; subsequent inspection selected entries
in process. That procedural mistake is retained in admission.json.

Disk receipts count sparse checkout/Git, copies, temp/evidence, full external
session and launcher logs, positive SQLite high-water growth, future growth and
8 MiB reserve inside 64 MiB, plus the other worker's reservation and host floor.
Standing tools and read-only donor inputs are separately recorded. No main merge.
