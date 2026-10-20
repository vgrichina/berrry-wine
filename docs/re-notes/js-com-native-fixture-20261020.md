# JS COM real-x86 conformance fixture — 2026-10-20

Target: integrated `ee139a0947c82e3a8eba4920508cb760d99882f5`.
Native/fullVM execution is **UNEXECUTED**. No build, guest, browser or Boat
access occurred in this task. Offline checks are not emulator execution.

`test/test-js-com-native.js` and `test/fixtures/js-com-native.js` generate
original deterministic PE32 machine code using the existing ICM native
fixture's PE layout. They require no assembler or proprietary executable.
The standalone native mode uses the canonical production module, real
`load_pe`/`load_dll`, production host imports and actual x86 instructions.
It never builds, patches production, changes activation flags, supplies
successful callback results, or suppresses a trap. Unavailable unrelated
host imports throw if reached.

## Concrete public-route blocker

The requested public JS activation coverage cannot be claimed at this
revision. In `src/09a7-handlers-dispatch.wat`, `handle_CoCreateInstance`
unconditionally ORs `0x40000000` into the host request; `handle_CoGetClassObject`
ORs `0xC0000000`. `lib/storage.js` interprets `0x40000000` as resolve-only,
returning the DLL entry/factory for the owner-side continuation. Both public
entry points therefore bypass the JS callback carrier for DllGetClassObject
and CreateInstance. A guest cannot clear a bit that the handler adds.

The missing prerequisite is a supported production/public caller of
`com_create_instance` without resolve-only, or an explicit acceptance change
allowing direct host-bridge invocation for those two routes. No such caller
is introduced here. This is a route prerequisite, not a request to weaken
failfast or silently switch public activation back to synchronous callbacks.

The fixture deliberately distinguishes:

1. **Public guest route:** CoRegisterClassObject → JS AddRef → nested guest
   CoRegisterClassObject/CoRevokeClassObject → JS inner AddRef/Release, then
   outer CoRevokeClassObject → JS Release. CoCreateInstance on the registered
   factory and DLL, and CoGetClassObject on the DLL, also execute; instrumentation
   requires their activation callbacks to be owner-side, with zero JS carrier
   entries. Guest counters, HRESULTs, factory pointer and caller ESP are checked.
2. **Direct host-bridge route:** after suspending an actual decoded x86 loop
   with `run(1)`, invoke the unmodified storage import without resolve-only.
   Its DllGetClassObject → CreateInstance sequence must execute through JS.
   This qualifies the carrier when run, but is explicitly **not public COM
   activation coverage**.

The observer forwards all calls to the original exports. It records real
i64/BigInt acquisition, nesting, method addresses, stack argument words,
zero return sentinel, actual ESP at completion **before restoration**, and
guest-produced EAX. It checks `ret 4`, `ret 12`, `ret 16`, IID_IClassFactory
contents, and E_FAIL with nonzero output. Every storage import must restore
GPRs/EIP/decodedIP/current thunk/steps/handler/yield/SEH. Sequential bridge
callbacks must enter against the same suspended decodedIP and thunk.
The fixture uses nonvolatile registers according to ordinary x86 ABI.

## Offline evidence and replay

From a checkout:

```sh
node test/test-js-com-native.js --out=scratch/runs/20261020-js-com-native-fixture
```

Evidence is retained in that directory in the original task workspace,
including self-contained `snapshot/test/` sources, generated images/method
bytes, offline results, disassembly, source-route excerpts and SHA-256 hashes.
Replay without repository dependencies:

```sh
node scratch/runs/20261020-js-com-native-fixture/snapshot/test/test-js-com-native.js \
  --out=/tmp/js-com-native-offline-replay
```

The offline suite checks reproducibility and machine-code stdcall epilogues,
rejects 24 corrupted argument/return-address/ESP/HRESULT records and four
missing/reordered-carrier/decodedIP/thunk records. These are oracle tests,
not execution of the generated guest. A separate PE has malformed outer
AddRef `ret 8`; the native observer must reject it before parent restoration.
GNU objdump inspection confirms PE import/export names, original x86 calls,
argument pushes, pointer writes, E_FAIL and `ret N` instructions.

## Exact subsequent serialized fullVM commands

Use a complete checkout of the target revision with these two test files
overlaid, and an approved canonical gated build receipt for **that exact
production revision**. Run only under the coordinator's subsequent runtime
assignment. `--source` records operator provenance; a hash alone does not
establish source/build correspondence. Set `MODULE` to that receipt's WASM
and `SHA256` to its recorded hash:

```sh
timeout 120s node test/test-js-com-native.js --native \
  --wasm="$MODULE" --sha256="$SHA256" \
  --source=ee139a0947c82e3a8eba4920508cb760d99882f5 \
  --out=scratch/runs/20261020-js-com-native-runtime/positive
```

Expected exit 0 and `native.json` PASS, with public activation explicitly
marked blocked for the JS route. This does not turn the blocked acceptance
criterion into a pass. Then, in a fresh process:

```sh
timeout 120s node test/test-js-com-native.js --native --bad-ret \
  --wasm="$MODULE" --sha256="$SHA256" \
  --source=ee139a0947c82e3a8eba4920508cb760d99882f5 \
  --out=scratch/runs/20261020-js-com-native-runtime/bad-ret
```

Expected exit 1 with `actual ret N cleanup before parent restore` in
`failure.json`; timeout, missing dependencies or any other failure is not
the expected malformed-ABI rejection. Inspect both receipts and actual
callback rows. Neither command was executed here.

Capacity, serial exhaustion, stale epoch/thread/root, abort/yield, actual
spill-pressure/reclamation and instance retirement remain future work.
This fixture is not whole jump-system readiness or native qualification.
No census/test-tier file was changed; invoke this bounded fixture explicitly.
