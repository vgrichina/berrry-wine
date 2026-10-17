# Cooperative DLL completion ownership

Async DLL completion previously resumed WASM outside ThreadManager.runSlice without a running caller. FreeLibraryAndExitThread(73) consequently recorded zero for cooperative threads. The callback facade assigns the exact live thread only during each synchronous WASM invocation, restores the prior owner on exceptions, and rejects retired/reused records or replaced instances. It holds no owner across awaits. CLI and browser service loops use the same facade; browser runtime has not been exercised.

Historical module 937466db reproduced the original two cooperative failures (guest code 103, child exit zero); both Worker cases passed. This defect is separate from the synthetic KERNEL32 stage and its NE/QT limitations.

Source 005ac43d936e45b0a38aff6027c604042cb3b051 received a normal full build and three four-case native arms on the sole granted box. PID 239903 exited zero at 2026-10-15T16:21:22.667Z. Candidate and restored arms passed all four cases; the unwrapped CLI negative control reproduced exactly the two cooperative failures while both Worker cases passed. Module SHA-256: 5d02aa3354d6a87f8ddedac35701e5dd934ddda6d249609ab6db0e3a0c98a344. Independent postflight at 16:22:32.869Z verified idle, 4,998 source files, 52 dependencies, exact CLI restoration and unchanged canonical 937466db/a948a826/KERNEL32 0dbf1893 artifacts. The lane was released.

Recovery archive: scratch/runs/20261015-outlaws-kernel32-native/coop-owner.tar.gz, SHA-256 d2b44aff330101b18b7c72b23ef2ac9246a876cd2d1d7da7fb22b2ab646ef6f9 (4,126,642 bytes). It includes logs, physical inventories, exact control/original CLI copies and the module. Fixture manifest SHA-256 remains 5f3a72b0da228d535182c928a1bfbd05137ff6c2abb29c2bb1a9f5d0e2a26fa4.

## Integrated IW host follow-up

The fix is applied separately onto main 095984b68, preserving the integrated IW host. The facade explicitly requires active state. Actual ThreadManager async ownership, both local/Worker wait-reservation suites and process-send broker tests pass. No WAT or compiler changes were made.

The reviewed source controller tools/run-cooperative-dll-owner-native.js now reuses the admitted IW module 04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17 (1,803,941 bytes), built from 7405b3f4803855e6d2e25506c74afab0d2184af9. It refuses any source delta beyond host/test/docs and explicitly named evidence controllers, verifies all physical tracked input bytes and the matching region map, then runs owner/reservation/broker checks and candidate/control/restored four-case arms. Each native arm is bounded at 130 seconds; the outer command must be bounded at 550 seconds. Canonical donors and KERNEL32 evidence stay immutable. No build, original game or browser execution is requested. This integrated runtime proof completed under a separate explicit grant, as recorded below.

## Integrated native result

Source 8620589336d264cd8e4d35a45ae43c476c9e3318 passed the native-only controller on the admitted 04ede4000 module. PID 249384 (command cmd_ud8y4vj0rlkn) ran 2026-10-15T16:36:55.012Z–16:37:01.034Z and exited zero. Owner, local/Worker wait-reservation and process-send broker checks passed. Candidate and restored arms each passed all four lifecycle cases. The unwrapped control reproduced exactly the two cooperative failures (guest code103, child exit zero), with both Worker cases passing. The same nine-fixture manifest and module were used throughout.

Independent postflight at16:37:07.054Z confirmed idle, all5,042 physical source files and52 dependency hashes unchanged, exact CLI restoration, and unchanged937466db/a948a826/KERNEL32 0dbf1893/IW04ede4000/Lords e26a7515 modules. Sole runtime lane explicitly released. No full build, browser or original game execution occurred. The tested WAT/compiler/region-map sources were verified identical to the admitted7405 full build; this receipt does not claim newer main WAT was exercised.

Recovery: scratch/runs/20261015-outlaws-kernel32-native/coop-owner-integrated.tar.gz, SHA-256 eccc50758fe5343ef261508df8bf063b931bb01eb4cb228f04dd2ba85e6d9b29 (4,669,229 bytes). Includes all source inventories, exact original/control CLI copies, case logs, independent postflight and admitted module. Remote evidence: /tmp/wa-coop-dll-owner-integrated-20261015; isolated source: /home/user/wa-coop-dll-owner-integrated.
