# Sims final WORD fix: OpenCAB succeeds, returned interface cannot marshal

The single authorized fresh original on the published `b9191be8bfd05e2701f2ca7552b722a71ee20b64` WORD correction still displays the installation support-file error `0x80004001`. Installation, gameplay and native Quit remain incomplete. Evidence is `scratch/runs/20261117-sims-final-word-fix-method4-install-progress/result.json`.

The actual module was `dcaefe74632b53f344649dfa67ae4bb937950d0c669576aa54f004629a865438`, preserved from the prior locked canonical build. All 154 checked WAT/selected host and COM source files match the prior publication pins. The run checkout was main `0a823095cd147c43d362384efd33a312cc2766c7`; its relevant dirty binary patch and file hashes are retained. Existing reader/Invoke, 783 continuation, input guard and BW2 parser proofs were verified by hash and reused. No blanket tests or new build were needed for this findings-only change.

## Reproduced native boundary

The real registrar publishes 293 registry/INI keys and exits normally within Setup's unchanged 10000 ms wait. Real `-Embedding` activation succeeds. Native `LoadRegTypeLib` returns `S_OK`; both the client and server Automation adapters use major 1, minor 0 and user locale 1033 (`0x409`).

The actual IID `{91814EBF-B5F0-11D2-80B9-00104B1F6CEA}` is `ISetupMedia`. Slot 4 is `OpenCAB`, member 20: HRESULT return, input BSTR and output/retval `ISetupCABFile **`. The argument is `D:\Setup\data1.hdr`. The passive boundary observer records entry to the genuine engine target `0x004340cc` and return **0 (`S_OK`)**. Disassembly confirms the three-DWORD stdcall frame (`RET 12`, including `this`). The native callback continuation also checks ESP and callee-saved registers.

The subsequent error originates while encoding the returned interface. `NativeAutomation.encode` calls `ComStandardMarshaler.marshalReference`, which creates its real native stub. `NativeAutomation.info` describes the returned IID `{91814EC1-B5F0-11D2-80B9-00104B1F6CEA}` (`ISetupCABFile`) and eagerly validates every non-IUnknown method. Its inherited IDispatch slots 4, 5 and 6 fail validation with `E_NOTIMPL`. This happens after OpenCAB's successful native return, before a successful reply publishes the returned interface to Setup.

Two small offline probes use the genuine SLTG resource as data with the exact final module, without executing IKernel. They confirm `ISetupCABFile` has 20 slots, type locale 1033, one base and 13 own methods at slots 7–19. Every own method passes the current metadata validator. Inherited slot 4 has a pointer-to-pointer-to-void descriptor, and slots 5 and 6 include unsupported record descriptors. The probe records the complete actual method types, flags, native names and HRESULTs. Passing metadata validation does not qualify future interface calls or imply installation success.

This is a missing native IDispatch transport capability, not evidence that the media decoder failed. Removing eager validation alone would admit methods whose pointer/record/array ABI the current transport cannot implement correctly. No provider implementation, fabricated success, private registry seed or validation bypass was introduced. No production correction was published, so the conditional post-fix original was not spent.

## Capture, shutdown and limits

The bootstrap's complete image was personally reviewed and shows the Sims splash and support-file error. A subsequent complete image is entirely teal, without a visible Quit target. Its bind review accidentally described the earlier image; an explicit correction in the run invalidates that review. Zero physical inputs were sent. The session was closed as terminal UNKNOWN, with no later control HTTP, then cancelled through the host. No ordinary native Quit is claimed.

Parent, registrar and Embedding process waits all record actual exit 0 and both stream EOFs; helper and independent watchdog waits also settle. All five expected main/worker provider exit audits are present. The synchronous-read audit reports no genuine Automation provider reads; it is not an audit of every possible host I/O API. Execution configuration omits genuine oleaut32/olepro32/stdole providers while all 22 pinned host provider/media inputs remain unchanged. No boxes, workers or deployments were created; no source archives, game-media copies or cachelink changes were made.

Next work is a real native implementation of the inherited IDispatch ABI, with typed structured values, outputs, interface ownership, failure and cancellation coverage, followed by a meaningful tested/published correction before another original. FullT-db74d863 still requires actual Sims plus full BW2/IS11 original installation. The distinct non-Automation provider issue remains open.
