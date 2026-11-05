# Stronghold ReadFile internal retry ownership

TG150-STRONGHOLD-CRUSADER-20261103 now has a generated causal reproduction and
an emulator fix for the internal ReadFile retry being recorded as a callback.
No original game or browser was launched. The historical original's missing
preceding park/frame-creation evidence remains missing; this proves the
emulator mechanism and its matching signature, not that original's full history
or subsequent gameplay.

Input was published main `939d523125df3a9c91566303bbab8b6ca3580028` and
[the first-invalidation note](stronghold-first-native-invalidation-20261105.md).
Source preparation stayed in
`scratch/runs/20261105-stronghold-readfile-native-retry/` until all releases:
formats1345 coordinator recovery at 14:23:14Z, ReturnFire1410 coordinator
recovery at 14:24:48Z, and Lords1355 worker FINAL at 14:37:47Z. Both recovered
lanes had performed no shared runtime work. The coordinator's updated queue
placed this task immediately after Lords1355. Shared ownership began 14:38:48Z
on main `99e2d8c4e45876a9cc23aa4bbe05a9dcc452a546`; the relevant ReadFile,
dispatcher and pending-context sources were unchanged from the input SHA.

`test/test-readfile-native-retry.js` generates a PE importing ReadFile and
CallWindowProcA. It mounts 96 deterministic bytes through the production VFS,
ChunkCache and filesystem imports, with an asynchronous-only provider, two
32-byte cache slots and no prefetch/read-ahead. One synchronous ReadFile needs
three actual fill/retry rounds. There is no substituted pending result, API
implementation, interpreter export or forced readiness. The fixture records
native pending frames through the generated region map and captures the actual
host import result, API exit, slice park, fill and retry boundaries.

The separate retained `baseline-proof.js` completed the same generated guest
on both released modules, asserting the exact failure below. Baseline source
identity and module hashes are in `baseline-identity.json`; raw transitions and
the immutable failure records are under `baseline/`.

| Boundary | EIP | ESP | Pending history |
| --- | --- | --- | --- |
| First host ReadFile entry/result 997 | block `0x402000` | `0x074fff08` | depth 0, entries/returns 0/0 |
| `io_block`, API exit before classification | thunk `0x07500000` | `0x074fff08` | still depth 0; yield 12, steps 0 |
| Slice park after classification | same thunk | same ESP | depth 1, entries/returns 1/0; kind 1 |
| Two more fill/retry parks | same thunk | same ESP | same erroneous frame retained |
| ReadFile result 0, API cleanup | same thunk | `0x074fff20` | erroneous frame still present |
| Next guest entry | successor `0x40201f` | `0x074fff20` | first reason 5, `pending_entry` site 4 |

The eight retained frame words are target `0x07500000`, return `0x40201f`,
entry ESP `0x074fff08`, kind 1, parent EIP `0x40201f`, parent ESP `0x074fff20`,
and two zero token words. Thread/current owner are 1/1, observation epoch
`0x996f5003`, native process epoch 1 and invocation root 2 throughout. The final
regression also asserts unchanged CS/SS and all six API stack words across
retries. The guest returns
TRUE, reads all 96 correct bytes and restores its stack even on the broken
baseline: the mismatch is in ownership accounting. This reproduces the original
record's 24-byte stack delta and retained kind-1 thunk/parent signature.

Microsoft documents that [x86 stdcall](https://learn.microsoft.com/en-us/cpp/cpp/stdcall?view=msvc-170)
passes arguments right to left and assigns stack cleanup to the callee.
ReadFile has five 32-bit arguments, so return plus arguments occupies 24 bytes.
The [ReadFile contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile)
distinguishes synchronous completion from guest asynchronous I/O; ReadFile has
no completion-routine argument. The emulator's internal 997 lazy-fill result
parks and re-enters the existing invocation. It supplies neither a guest CALL
nor a guest RET with which to own/retire a callback frame.

The fix gives `io_block` an explicit event scoped to the active
`win32_dispatch` invocation. The dispatcher saves, clears and restores that
event across nesting and snapshots its original ESP/return. Profile 2 accepts
the park only after existing thread/process/root validation and exact checks of
the dispatched thunk, current thunk, original ESP/return word, yield 12, yield
flag, zero steps and handler redirection. It preserves the existing history
without a push or pop. Malformed parks fail permanently at reason 5, new site
109. For that diagnostic site, a/b/c are entry EIP/return EIP/parent ESP, d is
original entry ESP, f is the actual dispatched thunk and g is zero. Legacy
profiles retain their conservative redirect rejection.

Genuine callbacks without this native event retain the existing callback and
RET checks, even when yield reason is 12. No guest control flow, ReadFile result,
stack cleanup, CS/SS check, target list, readiness or epoch is changed. An
exception cannot turn an aborted run into valid coverage. The two changed
census producers are exactly `$io_block` and `$win32_dispatch`; their EIP
targets, boundary lists and pending ownership status are unchanged. Only their
reviewed fingerprints/reasons were updated, with the lifetime analysis and
before-review rejection retained in the run directory. General callback
ownership and nonlocal API enablement remain pending.

Validation passed:

- `flock /tmp/wine-build.lock bash tools/build.sh`, both shipped modules.
- `node --test test/test-readfile-native-retry.js`: 52/52. Includes three-fill
  completion, eager/unarmed parity, tracked parents, two nested native callbacks,
  a genuine callback after retry, closed-handle errors, thread/observation epoch
  and native process/root replacement, import/API-exit exceptions, bad callback
  RET/stack escape/guest fault, and malformed park stack, return, thunk, yield
  reason/flag, step count and handler state. A synthetic yield-12 callback still
  owns its frame.
- `node --test test/test-stronghold-first-native-invalidation.js`: 14/14.
- Census reconciliation: 14 rejection controls; dispatcher census: 58 negatives,
  six target controls and ten guard controls. Full build keeps the census gate.

The first regression run retained the expected old-module failures and exposed
two fixture assumptions: profile 1 uses `pending_context_arm`, and the public
thread setter invalidates immediately with reason 5. Both were corrected.
One attempted focused run overlapped completion of the own build and is excluded
from qualification. The later synthetic-yield case initially assumed every
one-block run executes guest code; it now allows the normal empty slice that
consumes `yield_flag`. All failed logs remain; `green-final2.log` is the final
52-case result. There was no runtime workaround for any fixture failure.

Evidence uses exact Git SHA plus relevant binary diff and owned new-file
patches, with module hashes and logs; no source archive or media copy exists.
Box ID/state/expiry are N/A. No leased box, heavy browser, original launch,
subworker, accepted startup rerun or public deployment was used. All runtime
lifecycle remains with the coordinator. Next work is a separately authorized
original observation using the published fix; this assignment claims no game
progress beyond the generated causal repair.
