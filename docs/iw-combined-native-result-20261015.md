# Combined IW native attempt 1 — 2026-10-15

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
