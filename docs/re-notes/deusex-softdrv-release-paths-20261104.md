# SoftDrv original release block extension

This extends `4a723c802`'s optional passive collector to the nine release blocks
it explicitly rejected. Lock decrement is never retirement. Every record keeps
before/after ID64, metadata, data, physical range and links, the release RVA and
frame item-reference address. Release `object` remains null: an item does not
establish its owning cache. Prior acquisition/lifetime history remains unknown.

Evidence: `scratch/runs/20261104-deusex-softdrv-release-paths/`. Original media
is `test/binaries/candidates/deus-ex-demo/installed/system/softdrv.dll`, SHA-256
`25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18`.
The file is referenced in place. Independent objdump output in the run establishes
the following contracts; tests independently map original PE sections and check
the contiguous signatures, relocated operand and direct branch displacement.

| Release RVA | Item source | Mandatory post-boundary | Frame/epilogue |
| --- | --- | --- | --- |
| `94bf` (retained) | `[EBP-14]` | saved external caller | `ret 18`, ESP = pre EBP + 32 |
| `38766` | `[EBP-14]` | `3877e` or `38919` | EBP/ESP unchanged; **no return** |
| `421db` | `[EBP+44]` | saved external caller | `ret 54`, ESP = pre EBP + 92 |
| `45c4a` | `[EBP+18]` | saved external caller | `ret 30`, ESP = pre EBP + 56 |
| `46139` | `[EBP+18]` | saved external caller | `ret 30`, ESP = pre EBP + 56 |
| `46606` | `[EBP+18]` | saved external caller | `ret 30`, ESP = pre EBP + 56 |
| `46b04` | `[EBP+18]` | saved external caller | `ret 30`, ESP = pre EBP + 56 |
| `46fb9` | `[EBP+18]` | saved external caller | `ret 30`, ESP = pre EBP + 56 |
| `474e6` | `[EBP+18]` | saved external caller | `ret 30`, ESP = pre EBP + 56 |
| `47541` direct entry | `[EBP+18]` | saved external caller | `ret 30`, ESP = pre EBP + 56 |
| `47541` via entry `4753e` | `[EBP+18]` | saved external caller | `add esp,2c; …; ret 30`, ESP = pre EBP + 56 |

Addresses, offsets and RET operands in the table are hexadecimal; ESP increments
are decimal. Each cost ADD is item-load + 3, subtracting `01000000` from cost.
`47541` is both a direct branch target (including `45967`) and an interior load
on the call-return route: the original indirect CALL at `47538` returns to
mandatory entry `4753e`. The fixture executes that original CALL with an explicit
synthetic external RET stub, proves its decoder landing, then executes the
cleanup/release block. Popped registers come from pre ESP + 44 on this route;
direct entry at `47541` has its own contract with no stack adjustment. The full
incoming-branch census is retained in the run; branch displacement and preceding
conditional-fallthrough checks cover the other release entries.
For `38766`, the subsequent relocated `mov eax,[base+af3f0]` reads a pointer;
`cmp [eax],0; je 38919` yields the two mandatory destinations. The fixture tests
both destinations and stops there, before either continuation executes.

The returning blocks load ECX from `[EBP-c]` and restore FS:0. `94bf` and
`421db` pop EDI/ESI before that FS store; the seven `ret 30` blocks store FS
before all three pops. All pop EBX, set ESP to EBP, pop saved EBP and return.
The source checks the saved caller, expected post ESP/EBP, restored general
registers and unchanged frame item-reference. Whole-memory parity includes the
FS store. It does not certify an enclosing method call, exception unwind or
return-instruction retirement. Internal SoftDrv saved callers remain explicitly
unsupported. Positive lock cost, unchanged ID/data/range/time/links and exact
cost delta are required. No decrement implies unhash, invalidation or freeing.

Missing entry produces no manufactured release; known interior/post landings
without pending history stop unsupported. Any unexpected boundary while a block
is pending now stops explicitly with its pending record. Changed signatures at
either end, wrong frame/item/cost/caller or restored registers also stop support.
The existing loader identity, thread/instance rejection and finite limits remain.

The actual shipped `lib/guest-worker.js` queued owning Worker fixture compares
the observer with ordinary `ex.run(1)` without an adapter, at bases `900000` and
`1100000`, using normal and compatibility WASM. Each arm executes the retained
two acquisitions/two releases/miss plus eleven additional original release blocks
(two branch outcomes for `38766` and two entries to `47541`). The cleanup route
can deliver intermediate `47541` when that direct target is already decoded;
this requires unchanged item/cost/EBP and ESP advanced by 44 before the final
release/return. Other release entries execute in one ordinary block.
No original SoftDrv instruction is changed in these parity arms.
The complete 512 MB memory, general registers, EIP, lazy flags, yield/halt,
returned blocks, ordered slice/command digests and actual UD2 trap/post-trap
state match. ID/data/link identity survives all thirteen releases, including the
last lock reaching zero. Negative mutations cover every release's missed entry,
interior/skipped boundary, frame/item/cost/bytes/caller, zero lock, unmapped item,
and each returning block's saved EBP/restored register/internal caller. Existing
acquisition, loader, foreign thread/instance, pin and bounds tests are reused.
Each parity arm performs 25 successful slices and one trap command; delivered
release PC lists are asserted, including `4753e,47541` for the cleanup route.
The focused matrix, reused regressions and serialized full build pass. WASM
SHA-256 remains `b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf`
(normal) and `4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00`
(compatibility).

Validation commands:

```sh
DEUSEX_SOFTDRV_RESULT=scratch/runs/20261104-deusex-softdrv-release-paths/result.json node test/test-deusex-softdrv-cache-observer.js
node test/test-deusex-inline-eviction-observer.js
node test/test-deusex-startup-cache-observer.js
node test/test-deusex-native-cache-observer.js
flock /tmp/wine-build.lock bash tools/build.sh
```

Synthetic cache/stack/caller/import-data inputs connect independent fragments;
no full method, original startup, natural game or native Windows execution is
claimed. No atomic, cross-thread, complete lifetime or all-path coverage is
established. The optional collector still observes only Worker 0/thread 1;
same-PC/ESP duplicate suppression and attachment after earlier execution leave
history holes. Other acquisition/invalidating encodings remain unqualified.
Core histories are not automatically joined with SoftDrv locks.

The exact runtime attachment prerequisite is a verified original-media binding
to each live loader generation, with this optional source composed into every
owning Worker execution seam, including loader-run initialization slices and
relevant scheduled threads, before those blocks execute. Current test-local
`drawObserver` injection does not provide that production attachment. Descriptor
consumer ordering and cross-thread history must then be established separately.

No production emulator defect was found. The census change only refreshes this
existing optional host-entry fingerprint; general ownership remains pending.
Evidence records exact Git SHA and relevant binary diff/owned new-file patches,
not source snapshots or copied media/modules. Predecessor inputs are preserved;
adjacent gzip inputs are verified before decoding when present. No Chrome, game,
remote API, assigned box, lifecycle operation, deployment or subworker was used.
Box ID/state/expiry: NA; the coordinator retains lifecycle ownership.
