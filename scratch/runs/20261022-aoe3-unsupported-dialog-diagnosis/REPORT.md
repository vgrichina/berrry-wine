# AOE3 original RT_DIALOG177: offline diagnosis, 2026-10-22

The cause of **all blank child labels is not established** by the preserved run. Original data is present, and the executable contains a complete dynamic localization path. The missing evidence is the runtime result of that path: string-table initialization, returned localized buffers, and the actual child WM_SETTEXT arguments/results. Selecting a particular native XML/API/capability failure would exceed the evidence.

A separate, supported source defect explains why the original caption can remain `<unsupported>`: the tested engine's dialog default procedure drops unhandled WM_SETTEXT. This does not explain empty child controls. No production change or new guest execution was made.

## Scope and identities

Assignment: NEW-GAME-AOE3-DEMO-20261010, one offline diagnosis task. Actual live Codex process arguments verify wine-worker, gpt-6.1-sol, medium reasoning and200000 total-scope compaction (worker-launch.json); this is runtime launch evidence, not config parsing. Report branch `task/aoe3-unsupported-dialog-diagnosis-oct22`, based on `63d563df7a2b901d222a311ceaf55a0823a22261`. Input commit `e8c6728be1de7763b01e6661011e43b2f1df4b26`, branch `task/aoe3-original-recover-launch-oct22`. Selected input files were compared byte-for-byte with that commit before copying; [input-manifest.json](input-manifest.json) records their hashes. Full earlier recovery/provenance remains in [input/RECOVERY.md](input/RECOVERY.md).

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Original installer | 383598224 | `4ef69289dfa0817ec14942d85ef597835a9d2b09e1506c60b9938b20daa274ad` |
| Original installed age3.exe | 8826880 | `5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256` |
| Original data/stringtable.xml | 2404654 | `62fa66202af9e6ea6b98a7bb4b429a6fc724f51b57831c2b3062253ddb249f17` |
| RT_DIALOG / 177 / language1033 | 432 | `9c2480eae1444b90eff519a7451235f21a4ee79ea175b86605fc240f5a659fb6` |
| Tested historical engine module | 1878971 | `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7` |

Tested source is `c26252c4a95babe583ade1d1c6e2da0c050be45c`; canonical qualification receipt is `ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c`, archive SHA256 `3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`. This is analysis of that historical engine, **not current-main qualification**. [source-pins.json](source-pins.json) pins complete historical Git blobs and hashes alongside numbered focused excerpts.

Original resource offset is **8631880**, VA **0xdb9648** (PE image base 0x400000). [dialog177.bin](dialog177.bin), [dialogs.json](dialogs.json), and [pe-analysis.json](pe-analysis.json) preserve the extraction and mapping. All executable addresses below are original guest VAs. Raw immediate/call scans are candidate locators, not a complete control-flow proof; the cited instructions were checked in focused disassembly.

## What the existing run proves

The original EULA was populated and the ordinary Accept input was accepted in guest. The next modal dialog was hwnd0x1000f with caption `<unsupported>` and blank controls 2/1032/1034/1035/1036/1030. The diagnostic snapshots place the thread in modal wait at EIP0x075010d8, rather than a demonstrated crash. Input run duration was 168.017308 seconds, terminated by a bounded harness quit. This is not gameplay evidence.

[input/raw/game-run/output.log](input/raw/game-run/output.log) and [input/blocker-diagnostic-0.json](input/blocker-diagnostic-0.json) through diagnostic2 are authoritative observations. The log used quiet API output; it has no sufficient lookup-buffer, COM HRESULT/SAX callback, or text-message trace. No failing API is identified. An import list is not execution evidence.

The launch mounted original stringtable.xml and the other installed files. Preserved VFS/registry receipts and pre/post hashes exclude a simple replacement of these inputs. Presence in VFS does not establish successful guest path resolution, reading, parsing, or registration into the game's string manager. Native msxml4.dll/msxml4r.dll loaded and DllMain returned1; that does not prove successful COM class activation or XML parsing. The registry maps CLSID `{7c6e29bc-8b8b-4c3d-859e-af6cd158be0f}` to `c:\msxml4.dll` in the recorded route.

## Original dynamic label path

The raw resource contains five nonempty placeholder labels, not the observed blanks:

| Control | Template title | Item offset | Localized ID used by initializer | Original localized text |
| --- | --- | ---: | ---: | --- |
| dialog | `<unsupported>` | resource8631880 | 19884 | Age of Empires III Error |
| 2 | `<exit>` | 8631972 | 19891 | Exit Game |
| 1032 | `<Run anyway>` | 8632016 | 19890 | Attempt to Run |
| 1034 | `<unsupported>` | 8632072 | 19887 | Full minimum-requirements paragraph |
| 1035 | `<Don't show this dialog again>` | 8632132 | 19889 | Don't show this dialog again |
| 1036 | `<More Info>` | 8632224 | 19888 | Click for more information about this error |
| 1030 | empty edit | 8632280 | result block +4 | Dynamic check explanation, not a fixed localized ID |

All six requested localized IDs are nonempty in the exact original UTF16 XML; [localized-labels.json](localized-labels.json) includes the complete paragraph and symbols. Thus the six blank children do not all share one fixed-string source: control1030 has a separate explanation buffer, and its template is legitimately empty.

The verified RT177 creation sequence in [check-and-create.asm](check-and-create.asm) pushes callback **0x486e30** at0x488eb6, resource177 at0x488ebc, and calls USER32!DialogBoxParamW through IAT0xb305fc. lParam is **0xc4319c**, hInstance comes from0xc43178 and parent from0xc43184. Wrapper0x488e50 first calls check0x4888e0 with that result block, tests AL, then considers the ignore preference and creates the dialog. This establishes the original check/dialog path. It does not establish a particular insufficient capability: the check function also contains load/getproc/initialization failure paths.

In [dialog-proc.asm](dialog-proc.asm), DLGPROC0x486e30 branches on WM_INITDIALOG (0x110) to **0x486fd7**. It repeatedly calls localized-string wrapper **0x8e45f0**, obtains child HWNDs through GetDlgItem IAT0xb305ac, then calls **SendMessageW IAT0xb305b4**, message WM_SETTEXT0x0c, wParam0. Send sites are title0x48700b, control2 0x48703e, 1032 0x48706e, 1034 0x4870b3, 1035 0x4870e3, and 1036 0x487117. Control1030 is populated from result-block+4 at0x487197–0x4871a9. The title setter here is SendMessageW, not SetWindowTextW.

Wrapper0x8e45f0 calls manager **0x918670**, using singleton **0xce2518**. The manager loops table pointers at singleton+0x1b4 (**0xce26cc**) and count+0x1b8 (**0xce26d0**), tests an ID through0x930560, and retrieves its value through0x930530. No matching table returns empty-string object **0xcea720**; wrapper0x8e45f0 explicitly clears its destination when the returned value is null/empty (0x8e46ca–0x8e4701). See [string-lookup.asm](string-lookup.asm), [lookup-manager.asm](lookup-manager.asm), [string-table.asm](string-table.asm). An unpopulated string manager would therefore coherently clear the five resource placeholders. The run did not capture that manager's state or these return values.

## Initialization and XML boundary

[startup-load-and-check.asm](startup-load-and-check.asm) shows StringTable.xml load through wrapper0x8e4bc0 at **0x489ec9**, then UnitHelpStrings.xml at0x489ef1, before the check wrapper call0x488e50 at **0x48a1d9**. The caller continues without testing those AL results. Localization is not simply scheduled only after this check.

[string-load-wrapper.asm](string-load-wrapper.asm) and [string-manager-load.asm](string-manager-load.asm) connect0x8e4bc0 →0x918790 →table loader0x930650. At **0x930690**, the table loader calls XML loader **0x8e9680**, validates root/name/children, and can return failure without registering a table. File-open and native XML outcomes therefore matter even though the XML is present and independently parseable offline.

[xml-load.asm](xml-load.asm) includes both a binary/.xmb route and a COM XML fallback; the executed route is unknown. The fallback constructs its file URL then calls CoCreateInstance through IAT0xb30894 at **0x8e98b1**. Original CLSID bytes at **0xbcc9d8**, file offset8178136, decode to the exact registry CLSID above; IID at0xbcc9e8 is `a4f96ed0-f829-476e-81c0-cdc7bd2a0802` ([xml-guids.json](xml-guids.json)). Subsequent indirect calls occur at **0x8e98c7** (vtable+0x28), **0x8e98d9** (+0x38), and **0x8e9901** (+0x50, URL parse operation), with HRESULT-dependent failure exits. Neither HRESULTs nor resulting SAX/tree/string-manager state were captured. Static code establishes this plausible failure chain, not an actual native XML failure or malformed resolved URL.

## Tested engine handling and the separate caption defect

At historical source `src/09a5-handlers-window.wat:4354–4361`, SendMessageA routes WNDPROC_DIALOG to `dialog_default_proc`. In `src/09c3a-dialog-runtime.wat:412–568`, that function invokes the game's DLGPROC and processes its result. The original DLGPROC returns false for WM_SETTEXT (unhandled branch0x486ebe). The historical dialog epilog has no WM_SETTEXT case or general DefWindowProc tail and ultimately returns0. Thus this ordinary title-update path lacks the default caption assignment. If the initializer sends its title, the original placeholder can remain regardless of whether localization succeeded. This source omission is supported independently of guessing a hardware requirement.

There is an additional encoding obligation for any eventual caption repair: `src/09a5c-handlers-wide.wat:391–421` narrows a text lParam only for registered native controls; a dialog does not take that control conversion path. A future default caption implementation must preserve the actual A/W contract, not reinterpret a UTF16 pointer as ANSI or bypass the guest DLGPROC. No such repair was implemented here.

For child labels, the tested SendMessageW path **does have** UTF16 conversion, dispatch through SendMessageA, and native control dispatch (`09a5-handlers-window.wat:4369+`). It is not a universal success-only stub. `src/10-helpers.wat` also contains UTF16 template text reading and child creation. These source paths weaken a blanket missing-Wide/resource-parser explanation but do not verify their runtime inputs, target classifications, buffers, or post-dispatch state in this run.

## Competing explanations

| Hypothesis | Supported conclusion |
| --- | --- |
| Labels/caption absent in the original RT177 | Ruled out for five placeholders and caption; edit1030 is empty by design. |
| Required localized IDs absent/corrupt in original stringtable | Ruled out for all six IDs by exact hash and XML extraction. |
| Simple missing/wrong-case mounted stringtable payload | Existing exact mounted input rules out simple absence; actual guest resolution/read is unobserved. |
| Localization intentionally occurs only after check | Ruled out by startup call order. |
| Empty manager caused by failed open, XML activation/parse, callback/tree construction | Plausible, coherent with clearing; actual failing boundary unobserved. Native DLL load alone is insufficient. |
| WM_INITDIALOG omitted/misdelivered | Handler source constructs the init path, but runtime DLGPROC entry/args were not captured; not conclusively excluded. Placeholder disappearance is consistent with initialization, not proof. |
| All SendMessageW text operations are stubs | Ruled out by tested-source implementation; a target/buffer/control-state defect remains possible. |
| Caption proves failed hardware/capability API | Unsupported. Caption is original data and its replacement path has an independent default-handler omission. |
| Specific hardware/API failure or gameplay blocker | No attribution possible from this run; imports and error-category strings are not enough. |

## Finite next diagnostic acceptance check (not executed)

Coordinator should assign one bounded, instrumented retest of the same originals, historical module and recorded XP/native-DLL/VFS/registry route. Use the ordinary EULA Accept once, then stop at RT177; do not activate its unsupported-path buttons or change capability outcomes. Preserve the trace even if it identifies an earlier failure.

1. Capture return AL for both table loads (continuations0x489ece and0x489ef6), table-manager count/pointers at0xce26d0/0xce26cc, and actual resolved file reads. Record enough input bytes/count to distinguish successful original UTF16 XML access from a failed/different source. If COM fallback executes, record actual CLSID/IID, CoCreateInstance HRESULT/object/vtable, the three indirect-call results above, and SAX/tree construction through first localized ID registration. Do not assume COM was the executed route.
2. Capture DLGPROC0x486e30 entry with hwnd/msg/wParam/lParam for0x110 and result block0xc4319c. At lookup0x918670, record requested ID and returned string object/data, especially19891. Capture the actual UTF16 buffers, GetDlgItem return HWNDs, and WM_SETTEXT arguments/results for all five labels plus title and edit1030; compare stored child text immediately before/after dispatch. The result-block+4 explanation needs its own capture.
3. Stop once the first lost boundary is identified. Empty lookup output plus absent table requires repairing the **first proven load/parse/registration failure**. Nonempty source text delivered to the right child but absent afterward requires a **message/control-state repair**. A missing init callback requires a **delivery repair**. Do not repair XML or capability checks based only on the caption. The existing harness advertises `--trace-api`, `--trace-api-mem`, `--trace-at`, and `--trace-at-dump` in the pinned `test/run.js` excerpt; sufficient dynamic-pointer/return captures must be verified before relying on a trace configuration.

Only after that evidence should a separately authorized production repair be chosen. Caption default processing is a concrete independent candidate: test an unhandled dialog WM_SETTEXT through both A/W entry points, retain guest interception, and verify ordinary caption storage. Passing that test does not qualify the blank-child issue. Original-route acceptance requires correct localized title, five nonempty localized child labels, and a captured explanation buffer/outcome for1030, without bypass; it is not gameplay qualification.

## Validation, allocation, recovery and lifecycle

One focused [analyze.py](analyze.py) performs hash-gated original PE/resource/XML analysis, exact disassembly, historical-source pinning, and meaningful negative controls: changed executable byte, nonexistent resource/string IDs, and truncated XML. [controls.json](controls.json) records all passes. No builds or guest tests were run. Input receipts were independently matched to the input commit. Original byte acquisition used only read-only Python file reads inside `/home/user/aoe3-original-oct22` through the permitted Boat exec API, after SSH/scp returned403; no remote writes, guest processes, shared-module changes, or access to the other task's tree occurred. [acquisition.json](acquisition.json) preserves scoped per-chunk read receipts and hashes. Only age3.exe and stringtable.xml were acquired (11231534 bytes total).

The checkout was measured before writes: only AGENTS.md/CLAUDE.md projected22494 bytes, with32MiB planned allocation, above the mandatory2982150144-byte free reserve. Final measured allocation is recorded in allocation.json, below64MiB including the local original copies and Git storage. Root WIP/index/config/TODOS/STATUS were untouched; only required append-only root-board claim/result entries are authorized coordination writes.

See [RECOVERY.md](RECOVERY.md) for reproduction and binary recovery. Full originals remain ignored local files, not Git backups; focused resource/code/receipts are committed. No new huge acquisition, archived cold path, or full package rebuild was needed.

Box **bx_5mu9dnhg** was left running: this task performed no lifecycle actions or runtime session launches. Its assigned expiry is **2026-10-22T10:48:47.315Z**; the coordinator retains shutdown ownership. No claim of a new lifecycle-state measurement is made. No main merge, production patch, deployment, child worker, or queue refill was performed. This task stops with the exact instrumentation blocker above.
