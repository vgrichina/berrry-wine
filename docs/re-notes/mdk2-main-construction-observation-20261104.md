# MDK2 actual main-Worker observation: bounded replay stops at title

The single authorized original replay did **not reach New Game, Medium or the
post-Lua construction boundary**. All 18 actual PNGs were personally viewed
before any dependent action. The last, step3280, still shows the MDK2 title,
copyright block and empty circular controls. No new loading, comic, tutorial
or gameplay evidence is claimed. The next prerequisite is a freshly qualified
ordinary title-to-menu transition; the requested post-Lua PC remains unknown.

RUN is `scratch/runs/20261104-mdk2-main-construction-observation/`. This follows
[the post-Lua native-boundary analysis](mdk2-post-lua-native-boundary-20261104.md)
at3ea434b5e and [the personally reviewed predecessor](mdk2-personally-reviewed-title-onward-20261104.md)
at61cbd27bc. Their execution evidence remains separate and historical.

The tested `20261104-mdk2-post-lua-native-boundary/main-state.cjs` adapter was
used directly through `sourceForRun(RUN)` and the unchanged Module compilation
interface. Original wrapper SHA remains
`b5f85284acebec7339786c655f56929954cd8212e64bce3ff71fcc65f071e787`;
generated source SHA is
`9ef7b94040ec0d001fe8dc8dcbeea6920ab1c81203df793986023eede96b3750`.
Its sole addition is passive main-Worker readback before the original PNG.
No timer, continuation bound, ACK, input, inspection or phase guard changed.
Each actual capture contains RGBA/raw metadata, file-owner state,
`CAPTURE-native-main.json`, PNG and the ordinary state record, in that order.
All counters agree across raw/main/owner/post-PNG state where owner exists;
the adapter also checks frozen steps/ticks/guestMs before and after its reads.

Before Chrome,17 adapter tests passed, including the actual pinned Worker
readExports branch, getter-only/memory parity, unchanged base wrapper, output
order and original construction state→step16 guards. Fourteen retained
construction/readback controls and56 pending/generated-shot controls passed.
The actual author passed5 tests, operator integration4 (all seven modes), routing6,
and actual remote adapter/wrapper compilation1. Initial local test failures
were missing compressed historical fixtures or paths inherited from a nested
RUN; logs remain. Required adjacent JSON fixtures were decoded only after
original inventory/seal size and SHA matched, retaining every gzip. No runtime
failure, production change or full-build claim resulted from those fixture fixes.

Actual bx_y35qybgf became healthy, idle and fully hydrated at14:01:40.682Z.
Its execution path and Chrome executable were checked before staging small
inputs. Preflight verified432 original runtime pins,30 media path/hashes,
Puppeteer24.31.0 CJS and ESM imports, registered MDK2/WebGL selection, cache
graph and isolated HTTP bytes. Historical execution source remains
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, canonical module
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`
and companion
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
The original EXE is
`test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe`, SHA
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`;
adjacent scripts.zip SHA is
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`.
No module replacement, media copy or source archive was made.

The sole Chrome151.0.7922.108 was PID14814, identity14:04:12.833Z, actual
endpoint `http://127.0.0.1:45519/index.html?debug&candidates&frozen&gl-renderer=webgl`.
The release set its absolute closeBy once to14:10:09.706783Z,360 seconds after
launch preparation; the original driver timer was retained. Served-file hashes,
isolation and disabled-cache setup remain in recovered driver artifacts.

| Steps | Actual personally viewed pixels and action |
| --- | --- |
| 0 | Teal desktop/startup log; no game scene. |
| 512,1024 | Gray game surface. |
| 1536 | Black surface. |
| 2048 | BioWare logo. |
| 2560 | Black surface. |
| 3072 | MDK2 title/legal, no selectable New Game; separate truthful review then original balanced Escape. |
| 3120,3136,3152,3168,3184,3200,3216,3232,3248,3264,3280 | Title/legal and empty controls persist; each independently viewed and classified, with transitioning=false and openingAnimationVisible=false. Only original16-slice title observations follow; no Enter. |

The final native facts match the visible title: file `startscreen`, scheme
`title`, new scheme nil, current `lang`, freeze1, showmenu0, selected0.
The existing Level table is levelnumber0/checkpoint0, not the requested new
Level1/`l1`. Queue0/active0, completion1 and completedBytes982692 precede the
predecessor's192320-byte Lua request. No post-Medium construction controller
was invoked and no historical Level/105-resource/699228-byte queue was supplied
or treated as a timing target. The first `Level = {}` of level1.lua was not
observed in this execution.

Actual main-Worker registers are now available for these title observations,
distinct from page EIP0 and file Worker handle921600. At final3280:

| Main register | Value | Main register | Value |
| --- | --- | --- | --- |
| EIP | `0x47d6b6` | previous EIP | `0x47d610` |
| ESP | `0x074ffc8c` | EBP | `0x0000000e` |
| EAX | `0xfffffe3a` | EBX | `0x00000080` |
| ECX | `0x00000009` | EDX | `0x00000248` |
| ESI | `0x0847a810` | EDI | `0x00d25548` |

The48-word stack begins `0x1c6,0x53,0x0847a810,0x7180,0x00d5702c,0x00d57026,
0x47db94,0x0847a810`. Guest current-thread export is1; yield and wait are0.
Original PE disassembly identifies `0x47d6b6` as `dec ebp`, followed by a store
and loop branch; this alone supplies no function-name or stall diagnosis.
The final file Worker is independently at `0x4515cd`, stack top `0x451f62`,
thread export2, active/not in flight, suspend/wait/sleep0, ECX11100.
Its idle completion does not imply the main Worker finished title work.

At3248 the main PC was `0x44fc9b`, inside the original resource-demand routine
whose entry is `0x44fc40`; its captured stack includes a distinct title request.
That is not evidence that post-Lua customdofile returned. Across title samples,
main PCs change, including `0x46eefb`, `0x4638a7`, `0x4074ca`, `0x47d9ab` and
`0x47db9b`. The original customdofile/buffer/parser/execute landmarks
`0x41fcc0 → 0x444f80 → 0x44a7a0 → 0x446c30` remain useful landmarks for a
future genuinely reached construction capture, not current-call assertions.

All95 commands0–94 have successful matching ACKs and exact requested steps.
The menu ledger ends208 slices/39 commands, limit113, open=true,
newgame=false, medium=false. Startup's ordinary launch UI click and the single
balanced Escape are retained; no other game key was sent. Quit94 was separately
submitted and ACKed. Chrome closed normally at14:10:04.251Z, reason operator
handback,5.455 seconds before its unchanged deadline. There was no retry,
reload, second Chrome, guest write/call, callback, repaint, fault clear or
timer/counter extension.

All414 closed remote artifacts/33128059 bytes were recovered with full size/SHA;
a second remote inventory is identical. All18 PNGs, raw pixels and two Worker
sidecars are retained. Chrome inventory is empty, owned driver14776 is gone,
and actual HTTP45519 is closed. Custody returned with bx_y35qybgf still RUNNING
(API idle/healthy/fully hydrated), expiry2026-11-04T14:40:11.713Z. Coordinator
owns the14:36 normal shutdown. This worker performs no lifecycle action or
further remote work.

Only this note is committed. RUN records preparation Git SHA, relevant binary
diff, owned new-file patches, qualification/failure logs, readback checks,
inventories and recovery. The unmet prerequisite is ordinary title-to-menu
readiness within the original bound, before a fresh New Game/Medium and
input-free construction sequence can capture the requested boundary. No
causal emulator repair is established. Single assignment finished; no successor
or other box was used.
