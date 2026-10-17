# Combined IW native validation — 2026-10-15

Attempt 2 passed all eight native arms on the unchanged full-build module
04ede recorded below. Attempt 1 and its fixture failure remain retained.
This validates the integrated scalar-send and scoped lifecycle conformance;
it does not establish original IW playability or pointer marshalling.

Source `7405b3f4803855e6d2e25506c74afab0d2184af9`, dedicated remote checkout
`/home/user/wa-iw-combined-native`, sole `bx_9ef2wdsw` lane under root grant.
Independent preflight 16:11:38.210Z verified 5036 source blobs, 43 dependency
files, idle runtime and preserved 937/a948 modules. TTL was extended and
verified to 17:10:41.792Z; remote free space was 39 GB.

The normal full build passed all gates in 19074 ms and produced 1803941 bytes:
`04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
The first native arm, cross-process-wat, exited 1 after 138 ms:

```
Error: Callback wait reservation fences export set_last_error
    at WorkerLink._onMessage (.../lib/guest-thread-host.js:322:41)
```

The controller stopped immediately. None of the other seven native arms ran.
Its summary is failed. The original detach wrapper PID 233894 exited 0 because
setsid forked; this was only launcher success. Actual outer timeout PID 233898
and controller PID 233899 terminated. Use `setsid --wait timeout ...` for the
next launch so its wrapper retains the actual terminal status.

Independent postflight at 16:13:02.766Z passed: no live runtime processes, all
source/dependency/donor files and both preserved modules unchanged. The lane
was released to root. No original game, browser, main merge or deployment.

Recovered archive:
`scratch/runs/20261015-iw-combined-native/attempt1.tar.gz`
(2715120 bytes), SHA-256
`55378b4635c9bf3dd1b9910dd223e304477f9b858141a13bd9eb32098340980a`.
The archived summary and postflight were inspected after recovery.
Remote complete evidence remains `/home/user/iw-combined-evidence-1`;
the built module remains in the dedicated checkout.

Source diagnosis: the test intentionally traps a guest callback using the
public resolveThreadSend driver, correctly leaving the sender at yield10 with
its root reservation intact. It then directly calls private _resolveProcessSend
without a waitToken for a missing window. That unowned helper path attempts
set_last_error, and the production reservation fence correctly rejects it.
Both production root and nested drivers supply the owned token and return
the error through atomic completion; the fence must not be relaxed.

The fixture repair moves missing-target and unsupported-route assertions
before the terminal intentional fault. It loses the target after actual WAT
parks the sender, uses public resolveThreadSend, and checks result 0,
last-error 1400, ESP/EIP restoration, cleared yield, and an unfenced ordinary
setter. The terminal fault still rejects, leaves yield10, and explicitly
proves set_last_error remains fenced. Production code is unchanged.

Local repair checks: JavaScript syntax/whitespace and the full tiny-module
actual Worker admission suite pass, including owned receiver-gone completion
with last-error 1400. The repaired full-module fixture has not run.

A prepared native-only controller mode accepts a pinned existing build receipt
and verifies its exact module bytes/size and unchanged original dependency
inventory. It permits only the named fixture/controller/report changes from
the original build commit; every production/compiler/WAT/region-map change is
rejected. This avoids rebuilding the unchanged production module. A separately
reviewed immutable commit and renewed root runtime grant are required.

## Attempt 2: reviewed fixture repair, same built module

Root granted the native-only retry at source
`6c22121e56a0b60163b86969bda2a95f6a4098ad`. The prior build receipt hash was
`5054bc64b8e41601f93d167dbda61e92fb2e97dcdc24bba93413e2642abf3a7c`.
The controller verified that only the four reviewed fixture/controller/docs
paths differed from the build commit, with all production/compiler/WAT/region
map inputs unchanged. It reused the exact 04ede module without rebuilding.

Independent preflight at 16:18:31.246Z verified 5037 source blobs, the same 43
dependency files, idle runtime and preserved inputs. PID 237863, launched with
`setsid --wait` and the unchanged 1500-second outer bound, exited 0 at
16:18:47.779Z. All arms reached their expected final log messages:

| Native arm | Exit | Elapsed ms |
| --- | ---: | ---: |
| Actual WAT cross-process send and error continuation | 0 | 127 |
| Scoped DLL lifecycle | 0 | 62 |
| Local/Worker and Worker/Worker scoped endpoints | 0 | 237 |
| Owner retirement, timeout and pin retention | 0 | 790 |
| Independent send admission | 0 | 257 |
| Deferred and active receiver retirement | 0 | 707 |
| Current-broker receiver-subscription negative control | 1, expected | 1827 |
| Restored receiver suite | 0 | 706 |

The negative control failed specifically with
`RECEIVER_RETIREMENT_DID_NOT_SETTLE`. Its broker was an evidence-only copy;
production source and module never changed. The positive/restored suites
completed all deferred and active stop/raw exit/raw error controls. The WAT
route now completes the missing-window error through its owned root reservation,
and the terminal guest fault retains the mutating-export fence as asserted.

Independent postflight at 16:18:59.497Z verified idle runtime, all source,
dependency and donor files, prior receipt and immutable-input records, and
unchanged 937/a948/04ede module hashes. The lane was released to root.

Recovered and inspected archive:
`scratch/runs/20261015-iw-combined-native/attempt2.tar.gz` (5785532 bytes),
SHA-256 `77693fdebd3bf5a173b6d270df31fad871d53365fced128f9591ced6a9363c0e`.
Remote complete evidence remains `/home/user/iw-combined-evidence-2`.
No original IW, browser or deployment was performed by this validation. The separate
CLI cooperative FreeLibraryAndExitThread repair was not incorporated into
this source/module and needs its own evidence.

Root subsequently integrated 898bf1d50, 7405b3f48 and 6c22121e5 onto current
main and pushed merge receipt `3fdb29373325607fc2780a5d64832e5b3dd4ac08`.
Root independently verified production src/lib/host/index and the runtime test
matched the tested source, and broker/wait-reservation/crash tests passed.
This receipt does not broaden the original-game or pointer-marshalling scope.
