# Issue30 gears: MSVCR110 SSE2 math helpers and _time64 — gears run

Evidence: `scratch/runs/20261124-issue30-gears/`. Follows
[gears-sse2-gear-builder-arithmetic-20261118.md](gears-sse2-gear-builder-arithmetic-20261118.md).
Same release EXE: 16384 bytes, SHA256
`ef3de2e8bc52f1285fc603f374ac1f39781211590f2f38c1eb2c870418812240`
([K4sum1 release 1.0](https://github.com/K4sum1/windows-glxgears-built/releases/download/1.0/glxgears.x86.exe)),
image base 0x400000. MSVCR110 is not shipped: its imports resolve to builtin
handlers by name.

## Result

The VS2012 glxgears now opens its 300x300 "glxgears" window, builds the three
gear display lists, and animates them (headless WebGL, ~37 presents per
200 ms batch), prints its `N frames in 5.0 seconds` line through printf, and
exits with code 0 on Escape. Frames at batches 40/120/final differ (rotation).

```sh
node test/run.js --exe=scratch/runs/20261124-issue30-gears/input/glxgears.x86.exe \
  --headless-gl --quiet-api --max-batches=160 --no-close --png=OUT.png
```

## What was missing

1. `_libm_sse2_sin_precise` (thunk 403110), `_libm_sse2_cos_precise` (40310a),
   `_libm_sse2_sqrt_precise` — the `/arch:SSE2` CRT math helpers
   (`__libm_sse2_*_precise`; the import name drops one underscore).
   **ABI, from the caller:** argument double in XMM0's low qword, result in
   XMM0's low qword, no stack arguments (only the return address is popped).
   401174 `cvtpd2ps` / 40117e `cvtps2pd xmm0,xmm0` / 401181 `call 403110` /
   401186 `cvtsd2ss xmm0,xmm0`. Ten sin call sites, plus cos at 4011a5.
   Implemented in `src/09a6-handlers-crt.wat` (`$libm_sse2_precise`): XMM0's
   upper qword, the other XMM registers, GPRs and x87 state are untouched; a
   NaN argument returns quieted with sign/payload; sin/cos(±inf) and
   sqrt(x < -0) return the x86 QNaN indefinite `0xFFF8000000000000` and set
   errno EDOM (33); sqrt(-0) = -0. Finite sin/cos use the existing
   `host.math_sin/cos` imports (JS Math, fdlibm, full range reduction); sqrt
   is `f64.sqrt` (correctly rounded, as SQRTSD).
2. CVTSD2SS at 401186 — already supported on main by the time of this pass
   (`$sse2_form` F2 5A, subop 76, added by the GameMaker:Studio SSE2 work);
   no decoder change was needed. COMISD (402646) and CVTDQ2PS (40265c) on the
   fps path are likewise already present.
3. `_time64` (4023cb, and 40262e each frame for the fps timer) — cdecl,
   64-bit seconds in EDX:EAX, also stored as a qword through a non-NULL
   pointer; same calendar clock as `time()`. In `src/09a7-handlers-dispatch.wat`.

api_table.json rows appended: 4959..4962.

## Tests

`test/test-libm-sse2-precise.js` (unit tier, 78 groups): result bits equal to
JS `Math.sin/cos/sqrt` for ±0, ±1, π, -π/2, 1e-8, min denormal, -max denormal,
min normal, 1e22, 2^53, ±1e300, DBL_MAX and a gear angle; ±inf, QNaN,
indefinite, SNaN/negative SNaN payload; sqrt domain errors; upper-lane and
XMM1..7 preservation, ESP +4, errno set/untouched; `_time64` EDX:EAX, qword
store, NULL pointer, agreement with `time()`.

## Not reached / still unimplemented (fail-fast)

Imported but not executed on the startup/animate/Escape route:
`_except_handler4_common`, `_invoke_watson`, `_crt_debugger_hook`,
`_calloc_crt`, `__crtUnhandledException`, `__crtTerminateProcess`,
`_amsg_exit`, `?terminate@@YAXXZ`, `__iob_func` (and the `_fmode`,
`_commode`, `__initenv` data imports, which the CRT startup already gets past).
They stay crash-on-call. The browser Worker route was not re-run in this pass
(no browser tests); the handlers are WAT-only and use host imports already
present in the Worker's `guest-rpc.js` import set.
