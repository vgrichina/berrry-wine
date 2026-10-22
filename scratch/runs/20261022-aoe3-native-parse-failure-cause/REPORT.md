# AoE3 StringTable: executed native failure origin

Task `NEW-GAME-AOE3-DEMO-20261010`. **The first concrete failing operation in the captured native path is `GetProcAddress(0x00400000, ordinal 8)`, requested by MSXML4's delay resolver for `OLEAUT32.dll`: it returns NULL at the actual native continuation `0x01779bfb`.** The resolver executes its original failure hook, receives no replacement, and calls `RaiseException(0xc06d007f, 0, 1, …)`. Native exception handling propagates the same value through the parser and `parseURL` epilogue to actual game continuation `0x008e9904`, which takes the original failure branch. Primary StringTable load then returns AL=0.

This is an executed API request, guest return, exception and native-return chain. It does not assign an exception name from numeric resemblance, or infer a missing export from static imports. No production fix was selected, built or integrated. No gameplay claim follows.

## Exact module and address identity

Historical source `c26252c4a95babe583ade1d1c6e2da0c050be45c`, unchanged WASM `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7` (1878971 bytes), original runner `1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799`, age3.exe `5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256`, XML `62fa66202af9e6ea6b98a7bb4b429a6fc724f51b57831c2b3062253ddb249f17`. Preflight and postflight verify all199 runtime/support and174 installed pins. Registry/native/support/dependency route matches the accepted retained launch.

The actual startup DLL map identifies **msxml4.dll mapped at `0x01766000`, preferred base `0x69b10000`**. Exact retained source `/home/user/aoe3-original-oct22/installed/System:System/msxml4.dll` is1230336 bytes, SHA256 `83206377ad3c28a1cc9f11ec0bfd6ef0abd196ee999f556074ff885f29ed99f1`; a lossless evidence copy is [msxml4.dll.gz](msxml4.dll.gz). `runtime = 0x01766000 + (preferredVA - 0x69b10000)` applies only to this mapped image. [native-pe-map.json](native-pe-map.json) records its actual PE sections and delay descriptors.

Actual COM object is `0x018e4a08`, vtable `0x017aeff8`. Captured slot28/38/50 targets are `0x01809464`, `0x017ae41e`, `0x017ae4f4`; all belong to this MSXML image. Slot50 is RVA`0x484f4`, preferredVA`0x69b584f4`. All **86 captured native block code snapshots match32 original PE bytes after applying its HIGHLOW relocations**, and all96 vtable bytes match the relocated source image. [mapped-code-validation.json](mapped-code-validation.json) and [verify.py](verify.py) establish ownership independently of the raw numeric address. No cross-instance address substitution is used; every event is bound to `main`, with EIP checked by the accepted instance hook.

`LoadLibraryA("OLEAUT32.dll")` returns **`0x00400000`**, also the EXE image base. The native DLL map contains no loaded OLEAUT32 PE. This must not be described as a real OLEAUT32 image loaded at4MiB. The pinned historical handler source supports this interpretation: the LoadLibrary fallback can alias `image_base`; GetProcAddress's nonloaded ordinal path returns zero when no static ordinal resolves (source lines383–385). This source reading is supporting evidence; the actual request and zero return below establish causality without relying on it. A named OLEAUT32 export identity for ordinal8 was not established from a loaded OLEAUT32 PE, so the result remains explicitly **ordinal8**.

## Decisive executed events

[raw/boundary.jsonl](raw/boundary.jsonl) has258 synchronous records,118 blocks and70 API entry/exit pairs. Every record links to the full raw log by one-based line and zero-based byte offset. Registers,64 stack words,32 instruction bytes and selected frame/register memory are captured. Host API exits remain labeled as host exits; the conclusions below use separate actual native guest continuations.

| Event | Seq | Raw line / byte | Actual result |
|---|---:|---|---|
| `parseURL` native entry `0x17ae4f4` |6|See indexed record|stack `[0x8e9904,0x18e4a08,0x900e410]`; original URL `file:\\\\c:\data\StringTable.xml`|
| delay helper entry `0x1779af5` |192|984102 /45554252|descriptor`0x1857d4c`, IAT slot`0x1859080`; enclosing native call return`0x17a62bc`|
| `LoadLibraryA("OLEAUT32.dll")` |208|984118 /45580984|actual continuation`0x1779c69` seq210 EAX`0x400000`|
| `GetProcAddress(0x400000,8)` |219|984129 /45598783|actual continuation`0x1779bfb` seq221, line984131 /45602278, **EAX0**, ESP restored from`0x74fdeb8` to`0x74fdec4`|
| `GetLastError` after failed lookup |223|984133 /45605476|actual continuation`0x17d0081` seq225 **EAX0**; no inferred127 LastError|
| `RaiseException` |229|984139 /45615443|args `[0xc06d007f,0,1,0x74fdf14]`, return site`0x17d00b7`|
| native exception filter `0x17d825d` |232|984142 /45620831|EDI`0xc06d007f`|
| inner native return `0x1780c90` |252|984170 /45653832|EAX`0xc06d007f`, stack return`0x17ae549`|
| outer native continuation `0x17ae549` |253|984171 /45655412|EAX`0xc06d007f`|
| native `ret8` instruction `0x17ae567` |255|984173 /45658565|EAX`0xc06d007f`, stack return`0x8e9904`|
| actual game continuation `0x8e9904` |256|984174 /45659973|EAX`0xc06d007f`; original failure block`0x8e990d` follows|
| primary load return `0x489ece` |258|984176 /45662787|AL0|

The delay entry stack contains `[0x1779af1,0x1857d4c,0x1859080,0,0x18e4a08,0x17a62bc,…]`. Exact original source at preferred`0x69b502b6` (runtime`0x17a62b6`, RVA`0x402b6`) is `call [0x69c03080]`, relocated to `[0x1859080]`; its return is`0x17a62bc`. The PE's OLEAUT32 delay descriptor is RVA`0xf1d4c`, IAT begins RVA`0xf302c`, and slot21 at RVA`0xf3080` has import word`0x80000008`. The captured descriptor and slot therefore identify the actual request, not just a potentially reachable static import. The helper entry and ordinal API call are both executed.

The actual RaiseException argument points to delay information at`0x74fded0`: words `[36,0x1857d4c,0x1859080,0x1857e30,0,8,0x400000,0,0]`. The actual DLL string is`OLEAUT32.dll`, import-by-name flag0, ordinal8, module handle`0x400000`, procedure0, lastError0. The original resolver code branches on the NULL result at`0x1779bfb` to`0x17d007b`; its failure hook path at`0x17d008d→0x17d0095` is executed and returns0. It then executes the literal push`0xc06d007f` and RaiseException call (preferred`0x69b7a0ac/0x69b7a0b1`). Thus the code value's origin is directly established.

Native filter`0x17d8247` receives the exception; its registers carry the actual code. RtlUnwind is observed, followed by parser catch support and the native return chain above. The catch-support call has stack return destination`0x17c810d` (not a separately observed block), corresponding to original preferred`0x69b7210d`, whose straight-line bytes read the stored exception code and place it into the parser object's result field. Later `0x1780c67` reads that field, and `0x1780c90` returns it. Intermediate parser/callback callsites outside selected functions were not all instrumented; the report does not invent a complete SAX callback history from stack contents.

## What this resolves and what remains open

Activation and native setter continuations`0x8e98b7/ca/dc` each return0 in this run. Original XML ReadFile returns successfully to`0x17702b6`. The primary parser does execute and eventually reaches a delayed ordinal lookup; it is not an absent XML or class-activation failure. The decisive chain ends in the already accepted original signed-negative failure branch and primary AL0. The previously accepted later UnitHelpStrings AL1/count1 and six null-sentinel localized lookups remain separate observations; this run did not repeat that packaging or lookup investigation.

The finding identifies **failed dynamic ordinal resolution and the exact native raise/return propagation**. It does not establish why the platform exposes this module alias without resolving this ordinal, the correct production remediation, a named ordinal8 identity from an actual loaded OLEAUT32 PE, complete SAX content/error-handler execution or tree registration history, or XML semantic validity. No unexecuted callback is required as proof and none is claimed absent. No API host-exit is used as a native return. Earlier repeated GetLastError calls from game code are unrelated to the decisive resolver continuation and do not imply earlier error origin.

## Run, checks and custody

One guest startup at11:21:38 UTC, exit0 at11:22:42.787360 UTC,64.292096539s. Node24.18.1, unchanged cooperative/batch1000 route, no OS worker threads. Ordinary Accept once at batch2184540; no RT177 choice. EULA and RT177 screenshots were directly reviewed. Harness `quit` is host control only. Guards guest240s/TERM255s/KILL260s; neither signal fired. No guest-state patch, forced return, guest allocator, build, integration, acquisition or other game was used. Trace range was expanded solely to deliver selected native hooks; observer emission is limited to parser/resolver/exception functions and selected APIs while the StringTable parse call is active. No timing equivalence is claimed.

[raw/output.log.gz](raw/output.log.gz) preserves the **entire75752913-byte /1770407-line log**, SHA256`aae8280b727d65ccab4f27511eb39d3ebf7c0133db466f291511277df7c41d84`. Exact execution command is [raw/launch.json](raw/launch.json), API guest command`cmd_gtfzom1kqchp`; collection`cmd_htffsisrmcz5` in [collection.json](collection.json) and [command-index.json](command-index.json). Original accepted capture and all raw links remain in place. New remote diagnostic directory `/home/user/aoe3-original-oct22/diagnostics-native-parse-cause-20261022T1125Z` is a name, not its authoritative startup time.

`verify.py` passes raw line/byte identity, all collected hashes, exact native PE/vtable mapping, API/native/exception order and values,373 pre/post pins, protected root seals and closed-process/port handoff. Five evidence negatives reject missing guest return, stale EAX, wrong instance, missing exception and wrong ordinal. These validate observed evidence rather than retesting the accepted synthetic primitive. [failure-ledger.json](failure-ledger.json) discloses4 failed remote preparation/inspection commands,1 local syntax failure,2 corrected local evidence-check assumptions and1 initial commit identity failure (followed by a base-only dedicated-ref push, corrected by normal fast-forward); **zero failed guest startups**. No second guest run occurred.

`bx_32262dnp` is left **RUNNING** (API idle/healthok/stopnull), expiry12:53:29.069 UTC, coordinator owns lifecycle/checkpoint12:05. Guest process group36932 and controller are absent;8123/8124 connect111. Shadow Man and other original trees are untouched. Root HEAD/index/config/TODOS/STATUS remain unchanged. Dedicated branch only, no merge. Remote commit verification and final handoff are recorded in `HANDOFF.json` and the append-only repository messageboard; bounded task ownership is released after push.
