# Original legacy D3D capability fixture: native run failed

The one authorized actual x86 run **FAILED** before capability acceptance.
No production code, fixture, oracle, public method, or module was changed;
there was no build, repair, or repeat native run. This is public source/native
acceptance evidence only, with no rendering or gameplay claim.

| Identity | Exact value |
| --- | --- |
| Original immutable fixture commit | `b7500149f3c5ea9e2322a12928e9c79807670c4d` |
| Canonical source commit | `1262cbfcf8b5881543f2fb18c0f80b4bd9429306` |
| Already built module SHA-256 | `bc5412c1ba338ec5b385ff77eca1aa213c156cd5d0693e1cdcbf850867f7ecd4` |
| Original guest PE SHA-256 | `3f9b8e369226c2c3dd88e47125b41b20f9f04f00a65ec65bdb7c4e7439224637` |
| Runtime | `bx_6czhvg6m`, Node `v24.18.1`, x64 |
| Canonical remote source/build | `/home/user/winhelp-qualified-fullvm` |
| Unique external fixture/evidence root | `/home/user/legacy-caps-b7500149-native-20261020` |
| Local evidence | `scratch/runs/20261020-legacy-caps-native-run` |
| Boat execution receipt | `cmd_pldzlvohfkmz` |

The exact test and existing `tools/kernel32-native-fixture.js` were extracted
from immutable Git objects, not the reviewer's working files. Both were staged
as external ordinary files; a `lib` symlink resolves the canonical host imports.
The complete canonical source closure and module hash were checked before and
after execution. Existing dependencies loaded successfully before the run;
their resolved files, hashes, node_modules location and Node executable are
recorded in `recovered/dependencies.json`. No dependency installation occurred.

Native execution started at 2026-10-20T13:25:21.470Z and finished at
13:25:21.551Z, child exit **1**, no signal or timeout. The runner instantiated
the supplied production wasm, loaded its deterministic original PE and ran
the x86 interpreter. It wrote `native-observed.json` before the unchanged
assertion failed:

```
AssertionError [ERR_ASSERTION]: SetCooperativeLevel NORMAL: HRESULT
2779096485 !== 0
```

`2779096485` is `0xa5a5a5a5`, the fixture's untouched poison sentinel.
It is **not an observed HRESULT returned by SetCooperativeLevel**. The first
unwritten record is the public slot-20 call; the runner does not capture the
resolved vtable pointer or last executed instruction, so these observations do
not establish the underlying cause. No speculative diagnosis or repair was
attempted.

| Call record | Observed EAX | Guest ESP immediately after call |
| --- | --- | --- |
| LoadLibraryA(ddraw.dll) | `0x00429874` | `0x00429848` |
| GetProcAddress(DirectDrawCreate) | `0x07500138` | `0x00429848` |
| DirectDrawCreate | HRESULT `0x00000000` | `0x00429848` |
| SetCooperativeLevel NORMAL, slot 20 | poison `0xa5a5a5a5` | poison `0xa5a5a5a5` |
| Remaining 43 planned calls | poison `0xa5a5a5a5` | poison `0xa5a5a5a5` |

Entry ESP was `0x00429848`; terminal EIP was zero but the fixture completion
flag remained zero. Thus EIP zero does not establish successful completion.
The outer RET assertion occurs after the failing verification and was not
reached. Output pointer values and terminal ESP are not independently retained
by this runner; no additional instrumentation was introduced.

All 55 leading/trailing guard pairs remained `0xa5a5a5a5`. This is observed
preservation, not proof that the unexecuted calls obey bounds. All four
EnumDevices callback counts and captured contexts are zero, against expected
counts 3/3/2/1 for D3D1/2/3/7. No callback ABI acceptance is established.

The 45 planned descriptor buffers contain 12 × 172, 12 × 204, 18 × 252 and
3 × 236-byte records. The 38 GetCaps buffers include aligned/+1 Device1/2/3
HW/HEL descriptors and fixed Device7 descriptors; seven enumeration copies
were planned. Line/triangle texture, filter and address fields remain poison.
Expected masks were `0xf7df`, legacy `0xc3` or D3D7 `0x030003c3`, and `0xf7`;
none was observed as a returned capability. Initialized dwSize fields are
fixture input, not returned descriptor evidence. D3D7 texture ops `0x3ff`
were likewise not qualified.

The unchanged offline oracle separately passed 1,053 synthetic negative
controls and deterministic PE regeneration. `verify-evidence.js` reproduces
the exact failure from recovered native observations without executing wasm.
Neither offline result is represented as successful public COM execution.
Any later reviewer candidate is a distinct fixture and **was not executed**;
this result applies only to original `b7500149`.

The process had its own group, 84814, with a 120-second timeout and five-second
kill grace. The group was absent after execution and again during recovery.
Before/after hashes preserve all 6,441 canonical source files and 29,620 prior
files across Army, ICM, callback, COM, MadBomber, WinHelp, dependencies and builds,
plus the module and both fixture files. Logs, observations, receipts, original
PE, module, source manifest and recovery recipe are ordinary local artifacts.
The recovered archive SHA-256 is
`b8392a86413b246f6a877b4f370fc679788b24ac0018607a80fe8bf0832b9a91`.

The runtime was released at 13:26:49 UTC, left running for the coordinator
with TTL 15:53 UTC. The sparse report worktree has no local build or
node_modules. Evidence expansion was approximately 9.3 MB, below the 20 MiB
cap; local free space remained above 2 GiB + 60 MiB.

Recheck the self-contained evidence with:

```
node scratch/runs/20261020-legacy-caps-native-run/verify-evidence.js
```

See that directory's `RECOVERY.md`, `fixture-pins.json`, `execution-transport.json`,
`recovered/execution.json`, `recovered/native.log`,
`recovered/native/native-observed.json`, and `SHA256SUMS.local.json`.
The concrete blocker to acceptance is the first unwritten public slot-20
return record. Further investigation or a revised fixture requires a separate
coordinator assignment; this bounded task stops with the preserved failure.
