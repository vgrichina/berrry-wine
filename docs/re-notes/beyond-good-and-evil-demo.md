# Beyond Good and Evil Windows demo

Original installer:
`test/binaries/win98-games-a-d/BeyondGood&Evil-DX9-D3D/EnglishOfficialDemoBGE_WIN.exe`.
The installed executable on temporary box `bx_hx8msa33` is
`/home/user/bge-game-20261010/BGE.exe`, entry 0x0090df19. The extracted original
tree is mounted as its VFS. The original settings utility's saved registry is
`/home/user/bge-settings-save-20261010/registry.json` (77 imported entries).
These are temporary investigation paths, not a registered desktop route.

## Startup and message polling, 2026-10-10

With software D3D9, programmable shaders, cooperative threads and the saved
settings, the original previously stopped on
`MsgWaitForMultipleObjectsEx(0, NULL, 0, 0xff, 6)` at 0x4027c3.
It needs an immediate all-input queue poll with INPUTAVAILABLE and ALERTABLE.

Implemented this mode using actual queued work, a retained host-input event,
non-consuming timer inspection, and the existing APC callback continuation.
Empty polls return WAIT_TIMEOUT. Repeated polls retain unread input. No
synthetic message wake is used. Currently supported shapes are zero handles,
zero timeout, all-input masks 0xff/0x4ff and INPUTAVAILABLE (optionally ALERTABLE
or WAITALL, which has no additional objects to wait on). Other Ex modes remain
explicitly unimplemented: masked host-queue inspection, the new/old queue-bit
latch, and object/timed parking need separate work. Do not describe this as
complete MsgWaitForMultipleObjectsEx support.

Contract reference:
https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-msgwaitformultipleobjectsex

Canonical build, `test-msgwait-ex-poll`, `test-msgwait-infinite`, and
`test-queue-user-apc` pass on the temporary box. The new test covers queue and
input retention, preserved input fields, timers, actual APC execution/return
and stack cleanup, and fail-fast unsupported modes. Evidence:
`scratch/runs/20261010T0743Z-bge-poll-tests-20261010`.

## Next blocker: MOVNTPS

A 30,000-batch run ends after only 0.719 seconds with a blank window and is
too short to diagnose a hang. Raising the batch budget exposes the next real
stop at batch45179: `MOVNTPS` (0F 2B) at EIP **0x0048e692**, with aligned
destination storage rooted at EAX 0x7d799b80. Nearby code performs several
non-temporal XMM stores to consecutive 16-byte slots. Inspect the exact
instruction and existing SSE store/exception handling before implementation.

The original run exits with an unsupported-instruction trap, not gameplay.
Evidence: `scratch/runs/20261010T0743Z-bge-million-batches-20261010` (full crash,
identity and cleanup). A trace-window-only replay hid the useful late
diagnostic; prefer the unfiltered crash receipt.

## MOVNTPS implemented; next COM failure

SSE1 memory MOVNTPS now preserves all 128 source bits through guest translation
and code-cache invalidation; misalignment raises an access violation before any
write at the instruction address. Register and unsupported prefix forms remain
fail-fast. Canonical build and MOVNTPS, scalar SSE (144 cases), and MsgWaitEx
tests pass on bx_hx8msa33. The initial test attempt lacked notepad.exe; staging
the original fixture resolved that setup failure.

The original executable now passes the old batch45179 instruction stop and
reaches batch56150. Next failure is a COM vtable call at 0x004aaa42
(`[edx+0x88]`, return0x004aaa48), with EAX0x8876086c after the preceding
call. The generic ordinal diagnostic does not identify this method; resolve
the object/vtable before changing APIs. No gameplay yet. Evidence:
`scratch/runs/20261010T0758Z-bge-movntps`.

## Rectangular StretchRect and nested copies

API tracing identifies IDirect3DDevice9_StretchRect with non-null source and
destination rectangles, filter NONE. The whole-surface-only implementation
traps before copying. Archived rectangle/filter support is restored narrowly,
retaining the newer standalone LockRect semantics and backbuffer coverage.

Copy packets now belong to the guest stack frame. A different ESP starts a
child packet and saves the parent phase; completion or validation failure
frees that child and restores its parent. The existing host token snapshot
continues to own the suspended backend request. Same-frame re-entry resumes
the captured rectangles rather than reading mutable caller arguments again.

Direct/Worker pixel tests cover filtering, exterior preservation, scaling,
implicit backbuffers and suspend/resume. The nested regression exercises both
readback and upload parks with distinct source colors, invalid children before
and after allocation, restored parent phase and empty packet stack at the end.
The old shared-packet control fails by returning S_OK for the invalid child;
the fix passes. Canonical build plus color-target/alias suites pass. This is a
handler-level nested-frame test, not an original-game cross-thread callback
reproduction. Evidence: scratch/runs/20261010T0816Z-bge-rect-nested.

The original configured game now reaches a visible starfield intro instead
of the StretchRect trap (45-second bounded replay, clean terminal0). This
is startup progress, not player-controlled gameplay or a performance claim.

## New Game: archive/decoder mismatch (October 10)

Ordinary Escape at batch60000 reaches the menu; click240,255 at72500 and
Enter73000 reach an original Decode error. No gameplay qualification.
Run20261010T0827Z-bge-newgame; original decoder is0x492370, wrapper0x4911d0,
little-endian word reader0x4911b0. Wrapper compares actual output against
expected at0x49124a; error branch0x49124e. At failure84570: expectedEBX
0x016ffc00 (24116224), actualEAX0x7cfab (511915), compressedESI0xd00,
inputEBP0x9aa508, outputEDI0x7da8e984.

Run0855 captures the header/input after decoding. It starts
00fc6f01000d000000ff0300b3000000 and occurs twice in sally_clean.bf:
0x6c17ff and0x8217ff. The first search result alone does not establish a
wrong seek. Run0903 logs real ReadFile positions0x8217f7/fb/ff into0x9aa500,
2048 bytes each. The latter occurrence agrees with those reads.

Independent archive-table inspection: 1025 entries starting at0x44.
FF00631B starts8095744, stored padded size430076. Its two compressed blocks
at0x7b8804 and0x7e8b86 describe (output,input)=(512000,197498) and
(403650,232105), ending0x821637. The next entry FF40631B starts0x821800,
size94204, with uncompressed sound-bank data. The failing read starts one
byte before that entry. The format reference treats FF4 keys as uncompressed:
https://github.com/4g3v/JadeStudio/blob/master/JadeStudio.Core/FileFormats/Bigfile/FATFile.cs
This is a lead about selection/stream position, not proof of a seek API bug.

A standalone original-decoder probe supplied only the declared3328 input
bytes: neither uop mode terminated within100M blocks. Inconclusive because
the original decoder may read beyond the declared buffer. Do not attribute
the game failure to optimization from that probe. Re-armed break49124e
needed the310s controller guard; prefer trace-only for capture. Mid-block
trace49123e emitted no hits; next target is function entry492370.
Evidence: scratch/runs/20261010T0855Z-bge-decode-block,
20261010T0903Z-bge-decode-entry,20261010T0910Z-bge-callsite-trace.

Trace setup caution: --trace-from/--trace-to gates console.log globally,
including TRACE-AT diagnostics (test/run.js traceWindowOpen). API windows
can hide decoder hits after breakpoint-induced batch shifts. A dedicated
unwindowed492370 trace is needed; absence in the windowed logs is inconclusive.

### Delayed entry capture and native decoder parity

Run20261010T0929Z-bge-late-decoder-entry delayed the function trace until
batch84000, after the ordinary menu inputs, without a global log window.
At84556 the original decoder receives the valid final block: expected403650,
input232105, source0x9da88e. At84588 it receives the malformed next header:
expected24116224, input3328, source0x9aa508, prefix
00ff0300b300000000c70800870000000050060087000000.
The bad input is therefore present before decompression begins.

Run20261010T0948Z-bge-native-lzo-parity compares the original game's decoder
against the boat's native liblzo2 lzo1x_decompress_safe, called from JavaScript
through Koffi. Both valid archive blocks match byte-for-byte in both
interpreter and uop modes (four cases), with EAX0, normal return, and exact
output lengths. Output SHA-256 values:

- Block0x7b8804,512000 bytes:
  3f19cef3d23f1a838e01b275ce79ae794824674e22d88a2fe0752b8d6d08146d
- Block0x7e8b86,403650 bytes:
  96ae4078c094b4a7643dabcab8ed65c36f40e2c7977bed6fddd31babe8edec98

Tested WASM: e74c9b0dcff250158282ece0406096d6b55bbb9eac514c0622852a73de3fe0dd.
This verifies those two isolated blocks, not every decoder input or the live
loader's destination state. Investigate loader selection and refill next.
Helper0x491300 checks compressed bytes available against input length+8;
0x491390 checks decoded space against the output length; both branch on
compression flag0x96a108. Stream counters/cursors occupy0x98f988..0x98f9b0.

Frozen-control stepping changed the route to the promotional Coming Soon
screen, as did an earlier startup-armed trace. Those captures are not evidence
for the New Game failure. Keep the ordinary run and delay tracing until84000;
the next capture targets wrapper0x4911d0 and its caller/descriptor/globals.

## Live decoded bytes intact; descriptor framing investigation (2026-10-10 10:28Z)

Runs0953/1001 show the huge capacity value0x646d732e is a consequence of
the guest requesting that length, not the origin of corruption. General read
490310 returns a pointer into the decoded buffer. Caller48deaf reads4 bytes;
48debb ->48db40 ->48d940 dereferences the DWORD with flag8; caller48d930
requests that length. At logical512234 the DWORD is literally '.smd'.
The following DWORD at512238 is1904; do not substitute that length without
understanding the missing record consumption.

Run20261010T1025Z-bge-descriptor-frame compares live7edf0190:160 against
native decompressed logical512130:160. All160 bytes match exactly, including
the prior76-byte record, next8-byte record, '.smd' and1904. Reviewed screenshot
still shows Decode error; no gameplay. Baseline e74c9b0d module was explicitly
selected, with then-current host source; identity records the full command.

Final descriptor/read sequence:

- b2ab80/key350091e7, handler453540: length76.
- b2ab90/key4900fdc2, handler4c72b0: length8, payload4900fdbc/4900fdc1.
- b2aba0/key9e003a04, handler496020: no read observed in this interval.
- b2abb0/key8f0005a9, handler453540: reads '.smd' as a length.

Handler496020 at496067 would request4 bytes when98f204 is nonzero and
streammode98f980 is2, then compare a four-byte marker and choose a loader.
Dispatch4886c0 loops sixteen-byte queued descriptors. It resolves keys via
490000, then queries loaded objects through488520. Only when the loaded
lookup returnsFFFFFFFF does48876e invoke the descriptor's handler.
This suggests investigating why the preceding descriptor consumes nothing;
it does not yet prove the lookup or emulator is wrong.

Lookup488520 uses bucket b1ba00 + (((key + (key>>8)) &255)*16), then
48df50 binary-searches eight-byte key/value entries. For9e003a04 the bucket
is b1bde0. Root queued a single delayed488520 trace (10:33Z) of descriptor,
bucket and pointed entries. Never use multiple trace-at addresses on this
route: the harness forces startup batch-size1 and changes input timing.

Run20261010T1040Z-bge-descriptor-cache confirms the lookup input and table:
bucketb1bde0 points7d1f9cfc, count4; entries7100b589->7d664834,
9e00241a->7d4c7778,9e003a04->0,ce00a49a->7d840b44. Thus the binary
search legitimately returns0 for9e003a04, and dispatch treats anything other
thanFFFFFFFF as already loaded. Next descriptor's saved EBP is0. No evidence
of incorrect comparison here. Investigate the earlier insertion of the zero
value (488590), not the LZO decoder or the final length-read arithmetic.

Run20261010T1049Z-bge-zero-insert (single488590 trace delayed74000)
reproduces Decode error,443 insertions, none for9e003a04. That key already
maps to0 at first observed bucket74953/count7 and remains0 at80462/count4.
The cause predates this capture; next startup-only insertion trace can avoid
requiring the ordinary New Game route while locating the initial zero.

### Startup cache producer (2026-10-10 11:34 UTC)

The startup trace on current DSNotify candidate1e409f8f5 records the first
9e003a04 insertion at batch67503, trace1646, entry488590: return488788,
key9e003a04, value0. ESI=b261c0, EBP=0, EDI=9e003a04. This is before
the later cached-null lookup that skips the descriptor handler. Handler496020
compares a four-byte tag after reading eight bytes, then calls495c00 or495810;
495810 can return NULL if the count returned by48d060 shifts to zero.
The actual chosen path/count still needs runtime evidence.

Trace uses current matching WASM/map because previous WASM73fc66950e59ec4b
was refused against both current3e487f373153f493 and HEAD485cdc0e0f419af9
mirrors. Those two rejected attempts ran no guest code.

Header trace runs/20261010T1139Z-bge-resource-header proves key9e003a04
reads `.smd`, compares against `.snk` at95152c, returns memcmp=-1 at496099
and takes495810. Next probe495823 captures48d060 output pointer/length.

Model read trace runs/20261010T1143Z-bge-model-read rules out the zero-size
early return: key9e003a04 gets pointer7edf0200 and length0x770 (1904),
which shifts to238 entries. Bytes begin12000000 033a009e .smd. Next capture
4959d9 return EBX and/or495846 allocator result to locate the later NULL.

## Disabled loader causes failed sound-model list

Run1156Z-bge-model-body: target allocation7d8345c0 succeeds. The list count
is18 after packed count decoding. First nested key9e003a03 has.smd tag and
calls49b390. Next iteration reads0x40 as a key and an invalid tag, takes
failure cleanup4959e1, frees the object and returns0 at495a07. This explains
the null cached by488590; it is not an allocation failure or decoder error.

Follow-up49b390 trace sees global990194=0. Its guard returnsFFFFFFFF
without consuming the inline.smd body. Find why initialization stays off:
real stores are4950c7 (sets1) and492c8e (teardown). Initialization tests
494360 at4950a8, then494720 at4950bb, before byte990280 check.
494360 initially rejects when9a76a0=0. Next trace initialization branches.

Sound-init run `20261010T1201Z-bge-sound-init` narrows this further:494360
returns0, then494720 returnsFFFFFFFF at4950bb. The latter calls the function
pointer atb30804 with990198; a zero result invokes teardown492c30.
This is before setting990194. Driver-pointer capture is the next action.

Driver capture `20261010T1205Z-bge-sound-driver` confirms b30804=49f7f0
(Windows backend); it returns0. Inspect49f832/49f840/49f851/49f870/49f89d
to identify the failing API or driver step. Init trace completed normally;
neither this startup-only trace nor prior menu capture proves gameplay.

Run20261010T1206Z-bge-audio-com:49f870 gets80070008 after49fe30
loads the audio DLL and resolves its create function. Native eax.dll loads
at1293000; native ole32 was also auto-loaded. Earlier probes succeed.
Next A/B: only binkw32 seeded, common native DLL search directory temporarily
removed from search on isolated boat with finally restoration. No guest patch.

Built-in OLE comparison `20261010T1207Z-bge-builtin-com` changes the
audio-create result to80040154 (class not registered). Need requested CLSID
and IID, not a forced successful creation. Original eax.dll remains loaded.

Exact missing class: EAX runtime10d2000 calls CoCreateInstance from10d3104
with CLSID at10e839c and IID10e843c. Original eax.dll RVA1639c bytes
3fcc0139b584a44fba35aa8172b8a09b, IID RVA1643c
937e0ac595f334489ef67fa99de50966: CLSID_DirectSound8 / IID_IDirectSound8.
Current CoCreateInstance implements only CLSID_DirectSound; add DS8 activation
with existing DS8 vtable and uninitialized COM lifecycle, not a success stub.

DirectSound8 activation implemented using existing12-slot vtable, uninitialized
COM object, DS8/DS/IUnknown interfaces and common reference transfer.
Canonical build, extended DirectSound COM lifecycle regression and notification
regression pass: scratch/runs/20261010T1211Z-ds8-activation-tests.
Original game replay pending; this is not gameplay qualification.

Original replay after DS8 activation (`20261010T1212Z-bge-ds8-qedit`)
passes creation and reaches buffer setup, then NULL at49ff5d/batch289.
It queries buffer IID95149c into b30290 and immediately calls slot5;
identify this property-set interface next. Native common directory restored.

Next missing IID95149c is IKsPropertySet31EFAC30-515C-11D0-A9AA-00AA0061BE93;
slot5 is QuerySupport. Property set965bc0=A8FA6882-B476-11D3-BDB9-00C0F02DDF87,
ID1. BGE checks HRESULT and support bits before enabling the feature, so the
correct software backend exposes property queries with no hardware support.
Microsoft DirectSound QuerySupport contract permits E_NOTIMPL and zero flags:
https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418258(v=vs.85)
This is distinct from the incompatible DirectShow IKsPropertySet interface.

IKsPropertySet implemented as stable buffer-owned auxiliary face; IUnknown
identity/refcounts are shared. QuerySupport zeroes capability flags and returns
E_NOTIMPL for unsupported driver property sets; Get returns0 bytes/E_NOTIMPL,
Set returnsE_NOTIMPL. Null/unmapped output failsE_POINTER. Six API IDs appended,
registry capacity enlarged. Build and property/COM/notify regressions PASS;
evidence20261010T1217Z-dsproperty-tests retains initial bad test-stack failure
and corrected run. Original replay pending.

Replay20261010T1220Z-bge-sound-newgame runs18855 batches/150s and
shows New Game menu at final capture (reviewed). Menu.png at18640 was still
intro, so clicks18660/Enter18680 were premature. Next click18870/Enter18880
with210s cap. No controlled gameplay claim.

Run20261010T1228Z-bge-menu-qasf: ordinary18870click/18880Enter starts
New Game; final210s/48796batches shows Fehn Digler HTV News opening
cinematic (reviewed, Telegram1039). Original cache/decoder failure is cleared
by sound initialization fixes. Player control still unverified; browser route
prepared for trusted input/WebGL. No guest patch or gameplay-state writes.

Chrome Worker replay20261010T1230Z-bge-browser-caps-failure exposed a host
broker boundary bug: D3D9 capability opcode0x30017 trapped as a direct GL
call (EIP0x4a1df7). The host already implements that opcode; extend the
synchronous D3D broker range through0x30017. Import-throw/caps argument and
result, nested-wait and caller-ESP regressions pass remotely. Fixed Chrome
WebGL/Threads replay20261010T1232Z-bge-browser-capsfixed reaches the
New Game menu after trusted Escape (reviewed after-escape.png). Player
control remains unverified. This fixes browser startup, not game qualification.

Correction to browser click interpretation: 1232Z trusted click at screen
255,415 showed a Coming Soon demo end card (transition.png), then black;
it does not establish New Game. No recorded JS trap. Browser closed cleanly
12:38:25Z. Keyboard-only replay1239Z uses timed trusted Escape then Enter
and scheduled captures; PID592204 verified live. Need distinguish input
coordinate/selection issue from guest path failure before qualification.

Keyboard-only1239Z replay: menu.png shows New Game selected; trusted
Enter also yields Coming Soon card in after-enter.png. This weakens the
mouse-coordinate-only hypothesis. Next controlled comparison preserves
fixture/settings/WebGL/keys, changes only browser ?no-threads cooperative
mode, queued to start after PID592204 ends. No gameplay qualification.

Cooperative WebGL1244Z also reaches Coming Soon after Enter; Chrome
closed12:47:18Z. Worker1248Z with no Escape also reaches that card
after Enter (after-70000.png reviewed), so neither Worker-only behavior
nor an earlier Escape explains it. Do not repeat these same menu trials.
Next trace the guest transition/exit decision and compare software/WebGL
with the same ordinary input; earlier software cinematic is not qualification.

Browser1314Z explicit ArrowUp x3 before Enter changes outcome: menu image
remains at50s/100s instead of end card, with new BF asset reads (7b8800,
821800,839800,84a800,885000). fs/input tracing enabled through existing
window.__waTraceCategories; no fatal JS errors. Longer selected-route
replay queued after CMR terminal, includes ordinary W/A and screenshots;
no controlled gameplay yet. Its source is main72e9d1834;1314Z raw identity
main field retained stale2fa baseline, corrected in source-note.json.

Selected long replay1319Z is terminal13:27:08Z, Chrome errors[]. At300s
it still shows menu; final450s after trusted W/A shows Coming Soon card.
Neither longer wait nor this selection sequence proves New Game. Evidence
scratch/runs/20261010T1319Z-bge-selected-long includes identity, commands,
console/errors and reviewed300s/final images. Next trace guest input/menu
selection consumer, not another timed screenshot-only replay.

Held-click comparison1333Z: same original fixture/settings/WebGL/Worker,
no Escape/Enter/arrow keys; trusted mouse click250,415 held500ms at45s.
47s reviewed screenshot shows Loading;90s shows Fehn Digler HTV News
opening cinematic. This reaches the software route in the real browser.
Earlier instantaneous clicks/key trials did not establish this route;
button duration and omitting subsequent Enter are both changed, so isolate
them before attributing a specific emulator input bug. Controller611874
bounded210s remains live; player-controlled gameplay still unverified.
Evidence scratch/runs/20261010T1333Z-bge-held-click.

Held-click browser611874 terminal13:37:18Z, errors[]. Final210s image
shows outdoor vortex cinematic, progressing beyond HTV sequence. Trusted
player movement remains to verify; next longer held-click route should
wait for control before comparing W/A frames. No gameplay claim yet.

Long held-click route1339Z reaches active Jade fight/HUD by505s, then
records idle/A/D/click/Q/ArrowDown/attack comparisons. Browser closed
13:50:11Z/errors[]. Images show enemy/character animation and pose changes,
but movement attribution is not decisive (enemy hits can displace Jade);
do not mark ordinary control qualified. Trace DirectInput key state next,
and use longer held movement with a nearby idle baseline if needed.
Evidence scratch/runs/20261010T1339Z-bge-control-long includes commands,
console, cleanup and reviewed control frames. Two helper scripts appended
ordinary input commands10..24; original600/660s queued filenames had
already been consumed, so command24 performs explicit clean shutdown.

## 2026-10-10: ordinary gameplay input consumed and reviewed

Run `20261010T1432Z-bge-input-consumer` repeats the trusted500ms menu
click at45s, then eight-second key holds in Jade’s initial fight. The
isolated HTTP response wraps `get_key_down_state` to log selected key
state changes without altering its return value. Guest reads W/A/D/Q/Up
down=32768 and release=0. After Q, the food count2 disappears; the later
after-attack frame has two lit health units. After eight seconds of Up,
Jade is running toward the doorway with substantially changed world
framing. Reviewed before/Q/attack/arrow captures and key-event record in
review.json establish ordinary gameplay input response. W/A/D movement
individually remains confounded by enemy hits; do not claim those bindings.

Chrome closed14:42:50Z/errors[]. No product input patch or game memory
mutation. Remote baseline72e9d1834 WASM + storage d9255b1d4 and Worker
filename087b18311; CMR async-loader candidate was not installed. Audio,
logical FPS, dashboard manifest registration and release remain separate.
