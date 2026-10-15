# Cooperative DLL completion ownership

Async DLL completion previously resumed WASM outside ThreadManager.runSlice without a running caller. FreeLibraryAndExitThread(73) consequently recorded zero for cooperative threads. The callback facade assigns the exact live thread only during each synchronous WASM invocation, restores the prior owner on exceptions, and rejects retired/reused records or replaced instances. It holds no owner across awaits. CLI and browser service loops use the same facade; browser runtime has not been exercised.

Historical module 937466db reproduced the original two cooperative failures (guest code 103, child exit zero); both Worker cases passed. This defect is separate from the synthetic KERNEL32 stage and its NE/QT limitations.

Source 005ac43d936e45b0a38aff6027c604042cb3b051 received a normal full build and three four-case native arms on the sole granted box. PID 239903 exited zero at 2026-10-15T16:21:22.667Z. Candidate and restored arms passed all four cases; the unwrapped CLI negative control reproduced exactly the two cooperative failures while both Worker cases passed. Module SHA-256: 5d02aa3354d6a87f8ddedac35701e5dd934ddda6d249609ab6db0e3a0c98a344. Independent postflight at 16:22:32.869Z verified idle, 4,998 source files, 52 dependencies, exact CLI restoration and unchanged canonical 937466db/a948a826/KERNEL32 0dbf1893 artifacts. The lane was released.

Recovery archive: scratch/runs/20261015-outlaws-kernel32-native/coop-owner.tar.gz, SHA-256 d2b44aff330101b18b7c72b23ef2ac9246a876cd2d1d7da7fb22b2ab646ef6f9 (4,126,642 bytes). It includes logs, physical inventories, exact control/original CLI copies and the module. Fixture manifest SHA-256 remains 5f3a72b0da228d535182c928a1bfbd05137ff6c2abb29c2bb1a9f5d0e2a26fa4.

## Integrated IW host follow-up

The fix is applied separately onto main 095984b68, preserving the integrated IW host. The facade explicitly requires active state. Actual ThreadManager async ownership, both local/Worker wait-reservation suites and process-send broker tests pass. No WAT or compiler changes were made.

The reviewed source controller tools/run-cooperative-dll-owner-native.js now reuses the admitted IW module 04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17 (1,803,941 bytes), built from 7405b3f4803855e6d2e25506c74afab0d2184af9. It refuses any source delta beyond host/test/docs and explicitly named evidence controllers, verifies all physical tracked input bytes and the matching region map, then runs owner/reservation/broker checks and candidate/control/restored four-case arms. Each native arm is bounded at 130 seconds; the outer command must be bounded at 550 seconds. Canonical donors and KERNEL32 evidence stay immutable. No build, original game or browser execution is requested. This integrated runtime proof is pending a separate explicit runtime grant.
