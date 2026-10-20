# Legacy texture capabilities: executable public COM fixture

Native status: **UNEXECUTED**. This assignment generated and disassembled the
original x86 guest and tested its oracle offline. No VM, Boat, build, browser,
renderer, game or worker was launched.

Base: `1262cbfcf8b5881543f2fb18c0f80b4bd9429306`, fetched origin/main.
Owned addition: `test/test-legacy-texture-caps-native.js` and this note.
Evidence: `scratch/runs/20261020-legacy-caps-native-fixture/`.

The existing cube/filter/remaining suites compile extracted WAT helpers; none
executes a public descriptor call. The existing surface47 candidate exercises
surface storage through catalog-thunk routing and a game PE, not these device
descriptors. This fixture reuses the deterministic PE header/import generator
from `tools/kernel32-native-fixture.js` and the exact-module host setup of
`test/test-wave-error-text-native.js`. It does not duplicate their tests.

The generated PE has real kernel32 imports and original x86 code. Its guest
calls LoadLibraryA(ddraw.dll), GetProcAddress(DirectDrawCreate), DirectDrawCreate,
SetCooperativeLevel(NORMAL), CreateSurface (4x4 RGB, OFFSCREENPLAIN|3DDEVICE),
QI(IDirect3D2), and CreateDevice(HAL). It queries the resulting device for
Device1/3/7 and calls published vtable slots. No API catalog ID, thunk, object,
vtable or successful return is manufactured. No WAT is extracted, compiled or
transformed. The only module compiled by native mode is the supplied,
SHA-256-checked production wasm.

| Public route | Descriptor coverage |
| --- | --- |
| Device1 GetCaps, slot 4 | HW and HEL, 172/204/252 bytes, aligned and +1 |
| Device2/3 GetCaps, slot 3 | HW and HEL, 172/204/252 bytes, aligned and +1 |
| Device7 GetCaps, slot 3 | fixed 236 bytes, no dwSize, aligned and +1 |
| IDirect3D1 EnumDevices, slot 4; D3D2/3, slot 3 | real six-argument x86 callback; copy 252-byte HW and HEL while live |
| IDirect3D7 EnumDevices, slot 3 | real four-argument callback; copy 236-byte descriptor while live |

There are 47 public calls and 45 captured descriptors. Legacy enumeration
continues through the project's fixed Ramp/RGB/HAL or RGB/HAL sequence to HAL,
then cancels. D3D7 captures its first HAL and cancels. Thus both HAL/HEL builders
are covered, but this is not a universal Windows driver-order test. Invalid HW
descriptors from the skipped software devices are not interpreted as advertised
capabilities. Enum callbacks preserve EBP/ESI/EDI and use `ret 24` or `ret 16`.
The main guest records EAX and ESP immediately following every call, before
any host continuation could restore the stack. HRESULTs, output pointers,
leading/trailing canaries, primitive sizes, descriptor dwSize, callback context,
continuation/cancellation count, outer RET and bounded completion are checked.

Both line and triangle masks must retain `0xf7df` texture capabilities (no
CUBEMAP, PROJECTED preserved), `0xc3` legacy filters or `0x030003c3` D3D7 filters
(point/linear retained, unsupported mip modes absent), and `0xf7` address
capabilities (no BORDER; WRAP/MIRROR/CLAMP/INDEPENDENTUV retained). D3D7 texture
ops remain `0x3ff`.

Offline validation passed 1,053 negative controls using the *same result
checker*: old cube/border masks, clearing PROJECTED or point/linear, restoring
each legacy mip bit, every canary, every call's wrong ESP, failed HRESULTs,
wrong sizes, callback count/context and incomplete execution. These are
synthetic oracle vectors, **not successful COM calls**. Deterministic generation,
syntax and scoped diff checks passed. `disassembly.txt` exposes actual PUSH,
indirect CALL, immediate result/ESP stores, callback copies and RET cleanup.
Offline checks cannot prove that the production interpreter executes this guest.

Reproduce offline from a checkout containing this change:

```sh
node test/test-legacy-texture-caps-native.js --offline --out=scratch/runs/20261020-legacy-caps-native-fixture
objdump -D -b binary -m i386 --adjust-vma=0x403000 scratch/runs/20261020-legacy-caps-native-fixture/guest-code.bin
```

The evidence snapshot includes the test and existing PE generator; `replay.js`
regenerates the PE and rechecks hashes without dependencies or production
execution. `identities.json` records base Git blob IDs and SHA-256 identities.
Generated binaries are ignored artifacts: recover them from that snapshot or
the committed generator, not from a presumed Git binary backup.

Future **serialized native** command, from a complete runtime checkout with
this test applied, using the already recorded canonical ee139a094 module:

```sh
node test/test-legacy-texture-caps-native.js \
  --wasm=build/wine-assembly.wasm \
  --sha256=5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21 \
  --out=scratch/runs/20261020-legacy-caps-native-execution
```

That hash is a coordinator-recorded prior module, not a module validated here.
The runtime owner must verify its provenance and availability before execution.
If scheduling a newer canonical module, record its source commit/hash and pass
that exact SHA-256 instead. Native mode refuses a mismatch and records actual
call/descriptor observations before checking them when execution completes.
Unexpected host dependencies fail loudly; there is no success fallback.
No native run or build is authorized by this fixture-only assignment.

The public creation route exists in the reviewed source; no missing API
prerequisite was identified. Actual route execution remains pending. A future
failure must retain its exact API/slot/ABI evidence and stop for coordinator
assignment; this fixture is not permission to repair production code.
This closes fixture availability only, not native qualification. It does not
test cube allocation rejection, texture-format enumeration, mip storage,
sampling, rendering, backend parity or games. Canary checks on enumeration
copies protect fixture copies; they cannot establish bounds of the driver's
internally allocated callback descriptors.
