# Mad Bomber complete-module MIDI qualification attempt

Base: `dc22b2b38624da40b2dcec29c76bfb986ae03a35`.

BLOCKED at the first complete-module compilation. All 139 supplied source/compiler/helper pins verified on both hosts, but they do not form the main include closure. The compiler reports `Missing include '09a8ca-gl-lists.wat' referenced from <main>` at PARSE. Direct source inspection also finds missing `09a8cb-gl-bitmap.wat`, `09a8cc-gl-stencil.wat`, and `09a8cd-gl-color-mask.wat`. These names appear in the exact pinned main source; no files or handlers were substituted.

The single acceptance invocation used Node v24.22.1 / V8 13.6.233.17-node.58 and canonical watxSourceClosure/compileClosure with production, standardWat, strictDeclarations, runtimeBuiltins false, tailCalls true. No Wasm binary was produced; hashes and import/export inventories therefore do not exist. Complete-module instantiation, production audio boundary, open/queue/start/stop, header ownership and flags, callback delivery, stale replay, and negative control remain OPEN. x86/native/audio hardware/browser/gameplay also remain OPEN. The harness contains prospective instantiation code which was never reached; it is an attempt recorder, not an accepted lifecycle test.

The exact Node startup check passed under the same executable, heap, environment, and child limits. Qualification peak sampled group RSS: 87,044,096 bytes. Remote RAM admission: 7,447,420,928 available bytes. No remote limit denial occurred. Remote evidence preserves the raw compiler stderr and supervision receipts. No runtime retry occurred.

Local publication is blocked: connectivity checking reported missing commit objects `98d132898c963790f797ef3d00c812964e413cab` and `36a7171e024551ad0c64046a84779c094d9496ef`. No staging, commit, or push was attempted, and full inherited-index blob closure is NOT certified. The initial full index listing exceeded the evidence cap; its digest and the denial are preserved, its oversized capture was compacted, and that listing operation was not retried.

No guest runner or mount argument was used. Transfer used native Boat API chunks (45,000 raw bytes; <=64KiB encoded argument), archive SHA-256 verification, safe extraction, and all manifest pins before compilation. The production audio host source was unchanged. No production code changed.
