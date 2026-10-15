# OemKeyScan full-module validation

This source checkpoint prepares remote validation of candidate 81268f666cb026946b7d4d09c56639ed8cfcbe97. It does not claim a completed build or runtime result.

The controller requires WA_OEM_COMMIT (its own reviewed full commit), WA_OEM_EVIDENCE (a fresh absolute directory). It checks every physical tracked file against the commit, retains SHA256 manifests, and preserves both historical 937466 and held IW a948 modules. No calc.exe exists on the donor. A deterministic 8704-byte PE fixture follows the existing test/test-dll-lifecycle-real-pe.js layout with one GetModuleHandleA import and INT3 entry point; the controller records its bytes/source hash, and never executes its entry point; the candidate test verifies the sealed hash and uses exported guest_to_wasm translation for pointers and thunk records.

Run tools/run-outlaws-oemkeyscan-native.js only after sole-runtime authorization, independent previous-owner postflight verification, and fresh idle inventory. The sequence is normal gated build (600 seconds), focused test (90 seconds), actual candidate thunk (90 seconds), old module expected-missing control (90 seconds), restored candidate (90 seconds). Each has an outer timeout plus five seconds kill grace, separate logs and status, followed by idle inventory. An unexpected failure stops the sequence; final source/module and inventory receipts remain mandatory. This does not run Outlaws. Original startup requires a separate coordinator review/grant and updated candidate host/module pins.

## Native result

Sole controller 169813 completed with API exit 0 at 2026-10-15T14:41:23.397Z. The normal gated build passed in 19.926 seconds, producing 1,803,808-byte module SHA256 `5d02aa3354d6a87f8ddedac35701e5dd934ddda6d249609ab6db0e3a0c98a344`. Focused test, actual candidate thunk, old-module expected-missing control, and restored candidate all passed (55/60/62/59 ms). The synthetic loader fixture is 8704 bytes, SHA256 `7e3517d00163507c5fda9a18b75caebdfac6543c57bd6480255d18e78bfb91cb`; its application entry point was never run.

Independent postflight at 14:42:01.724Z verified all 6549 physical candidate files and the candidate module unchanged, retained historical 937466 and held a948 modules, and found no active runtime/build/browser processes. Compact evidence recovered to `scratch/runs/20261015-outlaws-oemkeyscan-native/evidence.tar.gz`, 1,002,552 bytes, SHA256 `d4bdcb14c301a770c7996e0f40d0b0c45b7ffbc28fc6a598a2a8927f0dcb814d`. Remote full evidence remains `/home/user/outlaws-oemkeyscan-native-evidence` on bx_9ef2wdsw; source recovery is branch `task/outlaws-oemkeyscan-native`, built commit `c08ee45a1eb4c2e4df8ba2e7c3d9e3ead284fbb8`.

Preparation discovered no calc.exe on the host and missing shallow Git prerequisites. No build or guest ran during those failures. The deterministic synthetic fixture replaces calc; an ordinary bounded HTTPS fetch obtained the exact candidate commit before the single successful build sequence. No native retry was required.

## Original startup source plan

`tools/outlaws-oemkeyscan-first-launch.js` preserves the original complete 31-file payload (30 deduplicated VFS files), no-input ordinary CLI route, 120-second guest / 150-second outer limits and existing licence/crash stop. Its separate candidate pin manifest seals all 6548 unchanged built/tested candidate files (the updated validation report is explicitly excluded) and the new module above. The controller records its own updated physical source identity. Original startup remains pending coordinator review/grant; no game/menu/playability claim follows from the API conformance result.
