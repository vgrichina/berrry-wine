# AoE3 original localization: native parseURL failure captured

Task `NEW-GAME-AOE3-DEMO-20261010`, one bounded diagnostic run. **The earliest proven failing boundary on the executed StringTable native fallback is the actual return to `0x8e9904`: EAX=`0xc06d007f`.** The original caller tests this value as signed negative and takes its failure/release/log path. The primary StringTable load subsequently returns AL=0 at `0x489ece`. Activation and both preceding native methods returned zero. This is actual original guest continuation/register evidence, not a host API-exit interpretation.

The trace also proves **ID19891 lookup already returns a null-text sentinel before the wrapper**: `0x918670` → EAX=`0xcea720` at `0x8e4603`, with sixteen zero object bytes and null text pointer. The wrapper takes its original empty-source path at `0x8e46ca`; SendMessageW receives an empty UTF16 buffer. The later successful UnitHelpStrings load and count1 manager must not be confused with successful StringTable loading.

The precise internal reason for the native parse return remains **UNKNOWN**. No hardware attribution, XML-content diagnosis, missing-export attribution, production repair, current-main qualification or gameplay claim follows. `0xc06d007f` is reported literally, without assigning a named error from its numeric resemblance. The earliest *internal* native text-loss instruction and SAX callback/registration sequence are not captured.

## Original run and identities

Historical source `c26252c4a95babe583ade1d1c6e2da0c050be45c`; unchanged module SHA256 `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`, 1878971 bytes. Original runner SHA256 `1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799`; original age3.exe `5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256`; XML `62fa66202af9e6ea6b98a7bb4b429a6fc724f51b57831c2b3062253ddb249f17`. Registry SHA256 `69fd648e03a5d4f1f25c41dcdbb2f976f813ca36a1dbdd3d9db5d05280f45cfe`. Actual preflight [staging-gate-result.json](staging-gate-result.json) and [raw/postflight.json](raw/postflight.json) verify all **199 runtime/support +174 installed pins before and after**. Required API table/native/support DLLs are present. Registry and original assets were not changed.

Node v24.18.1, CLI raster renderer, cooperative scheduling, ordinary unchanged batch budget1000; no OS worker_threads. [raw/launch.json](raw/launch.json) is the actual command and guard receipt. Existing trace range `0x400000..0x0b00000` and selected API hooks were enabled from startup. Tracing changes dispatch paths and overhead: no timing or performance claim is made. Only a generated diagnostic runner copy, existing tracing flags, output paths and finite guards differ from the retained route.

Guest launch **10:58:03.525244 UTC**, exit0 **10:59:20.568188 UTC**, elapsed **77.042936848s**. Guest240s/TERM255s/KILL260s guards; neither signal fired. [control-accept.json](control-accept.json) records the only ordinary guest input, `click:163:424`, batch1423941. [eula.png](eula.png) and [rt177.png](rt177.png) were visually reviewed. No RT177 choice was made. `quit` in [control-host-quit.json](control-host-quit.json) stops the harness, not a guest dialog action. One guest run, one Accept, **zero failed preengine or guest startup attempts**.

One local worktree setup command failed because the root repository does not contain the supplied current-main base object. It made no root changes; an isolated shared clone using the existing donor object store supplied base `63d563df7a2b901d222a311ceaf55a0823a22261`. The initial dependency resolver reported optional `skia-canvas` absent. Its raw result is retained. All top-level imports and required renderer/canvas/PNG imports passed; exact path matching proves this `--exe` selects no app image manifest, so the optional image decoder is unreachable. [raw/dependency-selected-route.json](raw/dependency-selected-route.json) records that classification. No dependency installation, repeated staging loop, guest retry or acquisition occurred.

## Actual native boundary sequence

[raw/boundary.jsonl](raw/boundary.jsonl) contains all442 synchronous BOUNDARY records,322 blocks and120 API entry/exits, all owned by instance `main`. Every record links to the original raw line and zero-based byte offset. Registers and twelve stack words are captured at each block. [raw/output.log.gz](raw/output.log.gz) preserves the **entire unfiltered 20,838,365-byte /172,087-line log**, SHA256 `c618d6428acf766bd46f2946ae4ca0f379fb59fc3266bfa9983f6056842afbf6`. [raw/focused-trace.log](raw/focused-trace.log) is an index, not a replacement for the raw log.

1. Seq9, raw line136878: original loader `0x8e9680` receives **StringTable.xml**. Resolved CreateFileW paths are `c:\data\StringTable.xml`. Seq34 (line136904) reads4 bytes `ff fe 3c 00`; seq62 (line136946) reads2048 bytes through native return0x17702b6, with128 actual bytes preserved beginning UTF16 BOM, XML declaration and `<StringTable`. This proves executed input reads, not complete parsing. The earlier `0x8e982c` AL0 is the executed probe that branches to native fallback; it is not alone evidence of final load failure.
2. Seq50 captures actual CoCreateInstance arguments and GUID bytes. Its **host API exit** seq51 has object0. The **actual guest continuation** seq52 at`0x8e98b7` has EAX0 and object`0x018e4a08` in `[esp+0x14]`. This difference concretely demonstrates why API exit cannot stand in for the native/guest return.
3. Seq53 at`0x8e98bf` captures that object and96 vtable bytes. Seq58 has actual vtable pointer ESI=`0x017aeff8`. The captured slot targets are `+0x28=0x01809464`, `+0x38=0x017ae41e`, `+0x50=0x017ae4f4`. The original bytes in [raw/native-loader.disasm.txt](raw/native-loader.disasm.txt) show the argument pushes from the captured registers/object: slot28 receives object and handler`0x074fe244`; slot38 receives object and handler`0x074fe248`; slot50 receives object and URL pointer`0x0900e410`. These are deterministic reconstructions across straight-line original push instructions; the observer does **not** snapshot the interior CALL instruction stacks themselves.

| Actual continuation | Seq / raw line / byte | Captured EAX | Executed outcome |
|---|---|---|---|
| `0x8e98b7` activation |52 /136935 /16371734|0|nonnegative branch to`0x8e98bf`|
| `0x8e98ca` slot28 |54 /136937 /16373808|0|nonnegative branch to`0x8e98ce`|
| `0x8e98dc` slot38 |56 /136939 /16375534|0|nonnegative branch to`0x8e98ec`|
| `0x8e9904` parseURL |63 /136949 /16380433|`0xc06d007f`|failure branch to`0x8e990d`|

4. Seq58 at`0x8e98fb`, line136941/byte16377260, captures URL pointer`0x0900e410` and literal `file:\\c:\data\StringTable.xml`. The return seq63 has the same ESP=`0x074fe1c8` and twelve restored stack words as seq58. It is followed by actual blocks`0x8e990d`, `0x8e9912`, `0x8e9921`, `0x8e9960`, `0x8e9969`, `0x8e9972`: release/log/failure epilogue. The success branch`0x8e9923→0x8e9931` is skipped by this signed-negative result; it is not an exhausted observation allowance. The earlier activation-failure branch`0x8e9946` is likewise skipped because activation returned0. Interior/native callbacks outside the selected observer points are not covered, so their absence cannot be claimed.
5. Seq77, line136965/byte16388832: primary load return`0x489ece`, AL0, manager count0/pointer0 **actually observed at that time**. Seq84 receives **UnitHelpStrings.xml**. Subsequent loose XML/XMB opens return invalid handles but its alternative original path returns AL1 at`0x8e97c7`/`0x930695`; seq257 at`0x489ef6`, line152452/byte18307255, has AL1 and **manager count1**, array`0x08ac9e6c`, table`0x08ac6920`. Array bytes and first128 table bytes are captured, including later changes; this is not a full decoded table dump. The second load does not execute the native activation/parse branch again. No failing return is inferred merely from unsuccessful optional file opens.

## Lookup, wrapper and original WM_INITDIALOG

Seq377 at literal`0x486e30` captures `[return=0x075010d8, hwnd=0x1000f, message=0x110, wParam=0x10010, lParam=0xc4319c]`. Initial native label text includes `<exit>` and the other template placeholders. Thus the captured initializer is genuine WM_INITDIALOG, not a later message guessed from its callback address.

Seq387, line171963/byte20732071: lookup`0x918670`, ECX=`0xce2518`, ID19891 on actual stack, manager count1. Seq388, line171964/byte20732898: actual return to`0x8e4603`, EAX=`0xcea720`, sixteen object bytes zero, text pointerNULL. Original lookup disassembly identifies`0xcea720` as the fallback sentinel. This is a **null source**, not merely a string whose first character is NUL. Seq389 at`0x8e46ca` has ESI0 and wrapper destination`0x092fe7d0`, already empty. Original wrapper bytes prove the source-null branch; no production copy/string patch was used.

The same chain is captured for all six localized IDs. Each WM_SETTEXT receives pointer`0x092fe7d0`, firstUTF16 word0, and empty decoded text. Actual caller continuations contain the corresponding HWND state.

| ID / target | Lookup→object→wrapper seq | WM_SETTEXT seq / raw line | Actual caller continuation seq |
|---|---|---|---|
|19884 title, HWND1000f|379→380→381|383 /171959|`0x48700d` /386|
|19891 Exit Game, HWND10010/control2|387→388→389|393 /171969|`0x487040` /395|
|19890 Attempt to Run, HWND10011/control1032|396→397→398|402 /171978|`0x487070` /404|
|19887 requirements, HWND10012/control1034|405→406→407|411 /171987|`0x4870b5` /413|
|19889 preference, HWND10013/control1035|414→415→416|420 /171996|`0x4870e5` /422|
|19888 More Info, HWND10014/control1036|423→424→425|429 /172005|`0x487119` /431|

Each of the five child labels has stored pointer0/length0 at its own continuation; title metadata still contains template placeholders. The title's guest dialog callback reentry (seq384, WM_SETTEXT) and actual caller continuation386 are captured, while its caption metadata remains `<unsupported>`. That caption behavior is a separate previously known issue; this task did not repair or qualify it.

Control1030 is independent: WM_SETTEXT seq435, line172015, HWND10015 receives pointer`0x092f0c10` with UTF16 NUL. Actual continuation`0x4871ab` seq439 captures result word0=0 and result+4=`0x092f0c10`, empty explanation, and the correct HWND/control state. The global observer's `lookup` field still reflects the previous label at this point; it must **not** relabel this separate result buffer as ID19888. No capability result is inferred.

## Coverage limits and verification

The accepted generator/observer from commit`4d5377fe7cf1b397d1989f4fb29e3bba12cb826f` was reused, without replaying its offline primitive investigation or repackaging old archives. [prepare-harness.py](prepare-harness.py) is copied locally so generation writes only this task's evidence. Hook SHA256`c7a54607d074d144149129a5e867d92b091dde049d1579f142606953c72a74c4`; unchanged quota observer`b89ab5bba916de36a324b6068d7df09f26ef227f8940ca58995677b946032032`. Main/cooperative hooks bind actual instance exports independently and OS-worker mode rejects. All captured required records are main-instance records, so no cooperative API data substitution is involved.

Prior accepted58 full memory/register seals establish read-only mechanics for these exact hook/observer bytes. This run does not add full512MiB memory seals around every real callback; the live guest legitimately mutates memory between observations. Observer operations remain direct reads/getters with host-side quotas/output. Pre/post373 input seals passed.

[verify.py](verify.py) verifies all19 collected-file hashes, compressed full-log identity,442 raw-line/byte mappings and instance/register consistency, exact native EAX/branch/stack chain, all six lookup/wrapper/dispatch/continuation chains, independent1030/result+4,373 pre/post pins and protected root files. Four negative controls detect a missing native return, stale native EAX, missing ID19891 return and contradictory nonempty message input. These are evidence-validation controls, not another synthetic module study. [verification.log](verification.log) records PASS.

Remaining evidence limits: no direct snapshot at interior native CALL opcodes; pre-call arguments are reconstructed from adjacent actual snapshots and original straight-line bytes. No complete native SAX callback-entry/return/tree-registration trace or first internal failing native instruction was captured. The numeric native failure's internal source is unknown. No production fix is selected from conjecture. The captured parse failure and later sentinel lookup are sufficient to move the known boundary upstream of the wrapper and WM_SETTEXT.

## Retention and handback

Assigned **bx_32262dnp remains RUNNING** (Boat API idle/healthok/stopnull), TTL expiry **12:53:29.069 UTC**. Coordinator owns shutdown checkpoint11:50UTC. No lifecycle action occurred. Owned guest process group23039 is absent and8123/8124 connect111, per [raw/process-state.json](raw/process-state.json). Originals, earlier HANDOFF, full raw log and new diagnostics remain under `/home/user/aoe3-original-oct22`; new remote directory is `diagnostics-targeted-localization-20261022T1058Z`. New HANDOFF.json is written there after commit/push. Shadow Man was untouched.

API guest command **cmd_rxpbgdnxlumq**, staging command in [staging-gate.json](staging-gate.json), collection command in [collection.json](collection.json); every transfer/control/inspection command receipt is retained. No remote public service/deploy, production integration, build, acquisition, children, delegation or refill. No change to root HEAD/index/config/TODOS/STATUS. Focused manifest measured before materialization; allocation and final protected seals are [allocation.json](allocation.json). Dedicated strict SSH key/trust push and actual HTTPS remote-SHA verification are recorded in the root append-only messageboard. Branch `task/aoe3-targeted-localization-capture-oct22`; no merge. Task ownership is returned and this worker stops.
