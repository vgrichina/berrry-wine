# Reproduce

Checkout this task branch in an isolated sparse tree containing the new test,
this review directory, lib/renderer-input.js, lib/mem-utils.js and
lib/region-map.generated.js. Use the exact recorded parent source pins.
The normal tree's browser file is intentionally not used; set its immutable
input path explicitly. Run from repository root:

```sh
export BROWSER_INPUT_SOURCE="$PWD/docs/reviews/keyboard-focus-renderer-interoperability-oct26/evidence/inputs/lib/browser-input.js"
FOCUS_INTEROP_GROUP=cancellation timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=ownership timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=timeline timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=focus-transfer timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=legacy-contract timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=negative-control FOCUS_INTEROP_NEGATIVE=bridge-release timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=negative-control FOCUS_INTEROP_NEGATIVE=renderer-keyup timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
```

Expected positive group counts:12/6/3/3/1, all exit0. Each negative run must
exit1 and name the targeted release-delivery assertion (not an arbitrary error).
ops/test.py preserves each completed group and rechecks source/test hashes.
Only new fixture plus own review/evidence are committed; root/donor stores are
borrowed readonly via flat alternates locally and must remain available until
the verified push. Durable recovery requires only the pushed task branch, which
retains the immutable browser input; no ignored build/run artifacts are needed.

Resource gates:64 MiB task allocation includes all task Git/tree/evidence,
launcher/session bytes, future session/events/positive-WAL once and8 MiB reserve.
Projected peak56 MiB; free-after-growth>=2982150144 and RAM-after-client/heap
>=805306368. Serial Node16 MiB,20s,24 MiB individual files,128 KiB group output,
2 MiB tool capture,8192-byte excerpts. No mounts are executed, so mount argv is
empty and canonical mount parsing is inapplicable. Trusted SSH is retained in
evidence/configuration.json. Recheck admission before rerunning or publishing.
