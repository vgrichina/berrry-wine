# THPS2 original installed demo: shared CRT exit localized; triggering caller unobserved

No concrete emulator defect is established. No emulator source correction, executable patch, guest attempt, build, acquisition, box contact, browser or deployment was performed. This bounded task ends with a tested offline diagnostic and the precise missing causal input. The retained corrupted title is not evidence of why the application exited.

## Proven terminal path

The authentic capture is commit `28d866798242da36343abdb043dad4ca2bba296d`, branch `task/thps2-installed-demo-gameplay-api-oct26`. Original EXE SHA256 is `fe5b66dd0a14bf5f3e5b00aceeeda9e1da165c7274a83a22fd1cb106e03d4b26` (1,359,930 bytes). The standing original was present and matched the effective source manifest before disassembly; no recovery or copy was needed. It remains read-only. Trace SHA256 is `74313246cd6f2df2b23bf330d5819ed1a1925a4b976cde407932e7a4c4af1311`; its small authentic bytes are retained as `authentic-output.log`. The original failed run, PNG, input manifest and corrected offline-only 16-action recipe remain unchanged in the immutable donor.

PE32 image base is `0x00400000`. In `.text`, RVA and raw offset happen to coincide. The exact original instruction is file offset `0x000f03d6`, bytes `ff 15 b0 71 50 00`, `call dword ptr [0x005071b0]`. Parsing the import directory binds that IAT slot to KERNEL32 `ExitProcess`; its six-byte continuation is `0x004f03dc`. Do not apply the accidental `.text` identity to other sections: `.rsrc` RVA `0x0321e000` maps to raw `0x0014b000`. The fixture derives section arithmetic, checks file-backed bounds, and rejects zero-filled virtual tails. It does not decode a PE by indexing `VA-imageBase` indiscriminately.

Instruction-boundary-confirmed original path:

1. `0x004f0339` is shared CRT termination: saves EDI, locks through `0x004f03de`, marks termination state, optionally invokes on-exit/termination arrays.
2. `0x004f0360..0x004f036b` preserves the caller's third argument as EBX. `0x004f03c0..0x004f03c3` selects return versus process termination. The process-termination branch is taken when that argument is zero.
3. `0x004f03cc` pushes the caller's first argument as process status. `0x004f03d6` calls the imported API. The captured invocation has status 1, entry ESP `0x074ffbd8`, return `0x004f03dc`, API ordinal-in-trace 3548. Thus status 1 is application/CRT input to a supported termination API, not an emulator trap reported as exit1.
4. Normal CRT `exit` wrapper `0x004f02f9` calls that routine at `0x004f0301`, continuation `0x004f0306`, with `(status,0,0)`. Quick `_exit` wrapper `0x004f030a` calls at `0x004f0312`, continuation `0x004f0317`, with `(status,1,0)`. The retained trace does not select between them or identify their caller.

The report's `rawExitCallCandidates` are byte-scan candidates, **not a dynamically observed callchain or a claim that every E8 is an instruction**. Two confirmed counterexamples show why attribution from the API alone is impossible:

- CRT startup `0x004f20cb` calls WinMain `0x004e7530`; `0x004f20d0..0x004f20d4` passes its return value directly to `exit`. WinMain's message pump `0x004e7400` normally returns sentinel `0x75`, but after GetMessageA returns zero, `0x004e7471` returns MSG.wParam. WinMain `0x004e76f8..0x004e7719` cleans up and returns that value when it differs from `0x75`. A WM_QUIT wParam of 1 can therefore produce this termination path without an unsupported API. This is a conditional original-code path, not a claim that this run received WM_QUIT.
- Cleanup `0x004c6397..0x004c63b7` calls object vtable slot `+8` (the IUnknown Release position), branches on its nonzero return, logs source line `0x238`, and passes that return unchanged to `exit`. A positive reference count of 1 can also give exit1. A positive Release count is not by itself an unsupported API or proof of a reference-count defect. The object's identity, starting references and actual result were not captured.

Two additional confirmed literal-one exits are `0x004dad59` (PKR-edit path, preceded by a print of `\t\tACK!`) and `0x004e61a6` (MessageBoxA after three failed data-file checks). The latter's prerequisite is successful fopen-style access at `0x004e6000` to a constructed `Demo.pkr` path; failure displays `Cannot locate data files. You must reinstall THPS2`. Successful later reads of demo.pkr in this run demonstrate file access, but do not justify selecting any particular exit caller or ruling out a later distinct failure.

## What the retained trace does and does not establish

Bink DllMain returned 1; two traced GetProcAddress calls for IsProcessorFeaturePresent returned nonzero handles. Logged demo.pkr reads completed at the reported lengths. The final two error-log reads are batch759 at position `0x7e2` and batch760 at `0x83f`, followed by exit at batch762 / 1.617 seconds. These reads contain no logged byte values. They cannot reveal message text, HRESULT, errno, failing API or the original exit caller. There is no logged unimplemented API, missing DLL or trap. The trace was selective; absence of a logged API failure does not prove every API succeeded. Error-log length increments cannot uniquely identify a formatted message.

Guest error-log output is written through logger `0x004c4cb0`: bounded formatting at `0x004c4cce`, append-mode string `a+` at `0x00533ffc`, and file output starting `0x004c4dce`. The file is `c:\thps2\thpcerr.log` in the retained run. Its contents and the saved caller stack are the precise missing inputs. Historical WASM SHA256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` and runner SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809` identify that failed run; current-main behavior is untested. No two-build/native qualification groups were repeated.

## Reproduce offline

From this isolated checkout, with the standing original executable available:

```sh
python3 -B -m unittest discover -s test/diagnostics/thps2-startup-exit-cause-fixture-oct26 -p 'test_*.py' -v
python3 -B test/diagnostics/thps2-startup-exit-cause-fixture-oct26/diagnose.py /home/user/wine-assembly/test/binaries/candidates/thps2-demo/game/thawk2.exe docs/reviews/thps2-startup-exit-cause-fixture-oct26/authentic-output.log
```

Use the task's `ops/run.py` supervisor for CPU90s, wall120s per command, file24MiB, output2MiB. It applies DATA536870912 only to Git children. There is no Node acceptance execution, heap allocation, guest mount argv or runtime configuration to validate; offline Python and installed `/usr/bin/objdump` are used in place. Objdump executable SHA256: `325c4205a4c658a9d1e1ebc469ae55975a2b897a3d3c1e79d9b158612d37f745`. No dependency install. Python fixture and test source identities are in `evidence-manifest.json`. Selected original-code listings are in `diagnostic.json`; each decoder request is bounded. Additional bounded exploration listings remain in task `ops/`, including the original literal-one exits and logger.

Tests cover nonidentity section translation and virtual-tail/cross-boundary rejection; two different original caller returns with identical observed exit API/status; exit versus _exit; wrong invocation, short stack, inconsistent CRT arguments; unknown wrapper remains explicitly unclassified. These tests verify the offline diagnostic's semantics, not emulator execution or successful startup.

## Next targeted observation, separately assigned runtime required

At **entry to the exact ExitProcess invocation**, before its handler changes guest ESP, retain registers and 64 bytes at ESP `0x074ffbd8`, together with the whole guest VFS `thpcerr.log`. A source-PC breakpoint immediately before `0x004f03d6` has a different stack layout: ESP is four bytes higher because CALL has not pushed the return PC. Do not feed that pre-CALL frame to the fixture without adding the actual CALL return word in a separately identified conversion.

For this exact CRT path, at ExitProcess entry: `[ESP+0]` is `0x004f03dc`, `[+4]` status1, `[+8]` saved EDI, `[+12]` CRT caller continuation, `[+16,+20,+24]` CRT arguments. With continuation `0x004f0306` or `0x004f0317`, `[+28]` is the original caller continuation and `[+32]` its status argument. Therefore the decisive original return word would be at `0x074ffbf4`. The tested `--stack RAW_FILE` decoder verifies invocation and argument consistency before returning a caller. It refuses to classify an unknown wrapper. Synthetic fixtures are expressly not observations of the failed guest.

If the resulting caller identifies a failure branch, record that call's actual API/object identity, inputs and completed return value before the original conditional; preserve caller arguments and logger format/varargs. If the continuation is startup `0x004f20d9`, observe WinMain's returned status and the message-pump/GetMessageA/MSG.wParam path. If it is cleanup `0x004c63bc`, observe the object pointer/vtable and Release lifetime before deciding whether any emulator reference-count behavior is wrong. Do not suppress termination, silently stub a prerequisite or patch the game to manufacture startup. The current retained data cannot select a unique API prerequisite; that causal blocker is the outcome.

No box is assigned to this task; ID/state/expiry are null. Coordinator retains all box lifecycle ownership. No main ownership or main publication is taken; corpus owns sole main. This task publishes only the diagnostic branch, then stops.
