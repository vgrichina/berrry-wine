# Drakan original startup dialog and native route, 2026-11-13

The registered `drakan_demo` stops at an ordinary **MessageBoxA**, “Drakan
Beta Demo Warning”, with one default **OK (IDOK = 1)**. The concrete first
action is a freshly reviewed, focused native **Enter down/up**, followed by
observation of dismissal and graphics creation. No configuration change is
needed to attempt this route. This assignment performed static reads only:
no input, dismissal, backend creation, crash repair or gameplay is newly proved.

Evidence is `scratch/runs/20261113-drakan-startup-static-0900/` (ignored).
`exactGit.txt`, relevant binary diff, new-file patch, source/media pins,
resource decoder and bounded disassemblies preserve recovery without copying
the tree or media. Source observed initially:
`5d496f592552ed7388b329932f35f3f7c13c8e38`, branch `main`.

## Original identity and warning

The existing installed root is
`test/binaries/win98-games-a-d/DrakanOrderOfTheFlameDemoD3D-installed/drakan demo/`.
`media-pins.json` hashes the **64 distinct registered paths**: executable,
manifest and its 62 entries. `drakan.exe` is 516,096 bytes, SHA-256
`29ddccec4b073aaeeb998f0ce83d581ccf3e6a3e28791844f4434d661febecbe`;
`dragon.rfl` is 1,605,632 bytes, SHA-256
`b0ede61e43571f9ecead5e7637c585e1e3523ba70d7fd325ec39e99381807b1e`.
These are fresh identities of existing files, not a publisher-authenticity
claim. Working directory and executable guest path remain
`c:\program files\psygnosis\drakan demo` and its `drakan.exe` respectively.

All addresses below are original preferred VAs, EXE image base `0x400000`.
In `startup.asm`, `0x410a33–0x410a47` passes:

| MessageBoxA argument | Original bytes / interpretation |
| --- | --- |
| owner | NULL |
| text | `0x47343c`: “THIS DEMO IS BETA CODE (95% complete)!” followed by development/possible bugs and crashes notice |
| caption | `0x4734d4`: “Drakan Beta Demo Warning” |
| type | `0x30`: MB_OK, MB_ICONEXCLAMATION, first/default button |
| import | IAT `0x46d1e8`, independently decoded as USER32 MessageBoxA |

**There is no numbered RT_DIALOG resource for this warning.** The message-box
implementation generates the OK control; IDOK is its standard command/return
ID, not an EXE resource number or a stable HWND. No Cancel choice or alternate
default is requested. After MessageBoxA returns, the executable does not test
its result: `0x410a53` calls `0x411180` (configuration/device enumeration),
then `0x410a7b` calls `0x410b50` (window/engine startup). Either initialization
failure returns without entering the frame loop; return alone proves no frame.
The frame loop starts at `0x410a97`, calling `0x4078b0` at `0x410b18`.

This explains why requiring an existing 3D renderer **before** admitting warning
input would prevent progress. The [12-cell sweep](graphics-additional-browser-crash-sweep-20261108.md)
sent zero input and observed warning/GDI only, with no D3D device, render
endpoint or GL context. It established no graphics-backend parity.

## Options resources and defaults

`resources.json` decodes every EXE dialog (RT_DIALOG=5, language 1033); coordinates
there are dialog units, not browser click coordinates. The warning must not be
confused with these templates:

| Resource ID | Template caption | Relevant controls |
| --- | --- | --- |
| 116 | Properties | tab 1000; OK 1, style `0x50010001` (BS_DEFPUSHBUTTON); Cancel 2, `0x50010000` |
| 117 | Graphics | driver combo 1001; display-mode combo 1036; rendering choices below |
| 118 | Sound | driver combo 1001; Use 3D Sound Buffers 1026; Enable EAX 1029; Enable A3D Support 1030; quality radios 1034–1036 are disabled in template |
| 119 | Developer | warnings/statistics/debugging controls; not a gameplay-start button |

Graphics labels/IDs are exact original resource text (ampersands indicate
mnemonics):

| ID | Label / type | Registered value, before capability-dependent UI changes |
| --- | --- | --- |
| 1001 | Display Driver combo | Registration comment says primary display driver; current enumerated name/availability unobserved |
| 1036 | Display Mode combo | 640 × 480 × 16 |
| 1010 | &Windowed Mode | off, flags bit `0x01` clear |
| 1011 | Disable &VSYNC | off, bit `0x80` clear |
| 1007 | Enable &Dithering | on, bit `0x08` set |
| 1014 | Enable &Shadows (slower) | on, bit `0x10` set |
| 1004 | &Anti-Aliasing (slower) | off, separate DWORD 0 |
| 1037 | Fix Texture &Coordinates | off, bit `0x40` clear |
| 1035 | D&etail Texturing (slower) | off, bit `0x20` clear |
| 1005 | Texture &Filtering | Bilinear Filter, index 1 |
| 1006 | Texture &Quality (Size Limit) | High (no limit), index 3 |

Resource checkbox styles do **not** encode checked defaults. Values above come
from registered bytes and the handler, not template order. `graphics-flags.asm`
maps IsDlgButtonChecked IDs to the stored masks; `graphics-populate.asm` maps
the mode, check states and combo indices back to controls. Filtering strings
are added Point/Bilinear/Trilinear; quality is added Lowest/Low/Medium/High.
The handler tests capabilities before enabling several controls, so these
stored values are not proof that every option is currently usable or checked.
`defaults.asm` (`0x407e50`) independently initializes graphics mode 640/480/16,
flags `0x1e`, AA 0, filtering 1 and quality 3 in a default graphics structure.
It does not establish a universal hardware-independent first-run configuration.

`init.asm` shows `0x411180` checking Shift via GetAsyncKeyState(0x10), and
comparing the command-line text after its first character with `setup`.
These can request setup; a failed/missing registry record also leads to setup.
Templates 117 and 118 are installed at `0x411465` and `0x411480`; developer
template 119 is conditional. EXE string-table ID4 is “Riot Engine Options”,
loaded at `0x41140b`; the outer stored dialog template says Properties.
OK leads to `0x4131a0`, which writes the settings; Cancel is not a launch route.
Do not hold Shift, supply a setup argument, or edit registry data to bypass the
actual startup boundary in a future unchanged registered launch.

## Registered settings versus saved game configuration

The current `lib/apps.js` entry supplies `HKLM\SOFTWARE\Surreal\Riot Engine`,
`Settings100`, REG_BINARY (type 3), **92 bytes**, SHA-256
`207f1bdaccfd50d9e739ec3c812a09806eb119af4638351155548e4f7e290f43`.
This corrects the **84-byte** description in [the older demo note](drakan-demo.md)
for this observed registration. The original reader at `0x4130b0` formats
`Settings%03x` with `0x100`, requests `0x5c` bytes, and accepts only type 3,
returned length `0x5c`, first DWORD `0x100`. It copies 23 DWORDs to `0x477008`
and clears the DWORD at `0x47700c`. Writer `0x4131a0` also stores `0x5c` bytes.

Exact little-endian DWORD values, in byte-offset order 0 through 88:

```text
00000100 00000000 0000042f 00000001 00000000 00000000
00000000 00000000 0000001e 00000280 000001e0 00000010
00000000 00000001 00000003 00000001 00000000 00000000
00000000 00000000 00000007 0000008e 00000021
```

Offsets 32/36/40/44/48/52/56 are graphics flags/width/height/depth/AA/filter/
quality. This is the **launch seed**, not a read of any live guest registry or
a current user's saved preferences. Display and sound enumeration can still
reject devices or invoke setup; successful registry parsing alone is insufficient.
Other fields are retained raw without speculative decoding.

The 64-path closure contains no `Drakan.cfg`. The original `dragon.rfl` names
`Drakan.cfg` at file offset `0x15ac6c`, with nearby ` // settings` at `0x15ac02`;
that identifies an additional game-settings path, not its current contents or
bindings. No persistent guest overlay was read or changed. Its current saved
values, if any, remain unknown.

The EXE has one RT_MENU: ID119, language1033, `&Control`, with recording/camera
commands 40001–40009. It contains **no New Game or difficulty command**.
`menus.json` preserves every label/ID/flag; it is not evidence that this menu
is attached during ordinary startup. `common/interface/interface.mod` names
“Main Menu” at offset `0xe`; bounded selected interface/RFL string reads are
in `menu-strings.json`. Those strings do not establish live gem positions,
default difficulty or a keyboard shortcut. The installed original readme
(SHA-256 `a523552d10c828bd60f4da9649289dc12fb478f793b6a31d3d6c7f26759c2bdc`)
recommends default first-run hardware choices and clicking the central New Game
gem. No guessed WM_COMMAND or fixed click is justified by the menu resources.

## Reviewed next-action route and missing evidence

1. After the existing runtime hold is explicitly lifted, use the unchanged
   registered closure/configuration and capture the actual owning process/CPU
   module plus a fresh warning image and live modal/OK focus/bounds. No graphics
   owner is expected yet. Review the exact title/text and OK control; historical
   HWNDs or coordinates cannot authorize fresh input.
2. With that live warning focused, issue **one ordinary native Enter down/up**
   with an independent bounded key release. Confirm delivery/release and then
   capture dismissal and the next state. A freshly reviewed OK click is a possible
   alternative; no pixel coordinate is established by this static assignment.
   If an options sheet appears, review driver/mode and default OK live before
   accepting; do not assume Enter dismissed both dialogs or change options blindly.
3. Observe actual owning D3DIM device/renderer creation and advancing completed
   draw/presentation evidence, with exact CPU/render/module binding. A selected
   Software/WebGL host option, warning disappearance, GDI image or COM enumeration
   alone does not prove an active backend or real 3D frame.
4. Review each subsequent startup presentation. Historical original runs used
   balanced Enter activations, then the production-requested pointer lock and
   DirectInput relative mouse to hover/review/click **New Game → Normal**, then
   story Enter to a rainy mounted scene. Reacquire live hover/pressed/result
   evidence at each step; do not replay historical offsets `(-6,-75)`/`(-2,+69)`
   or batch counts as current coordinates/timing. Normal is a reviewed historical
   selection, not a default proved by these resources.

[Native warning/gameplay evidence](drakan-native-warning-gameplay-20261108.md)
already reports focused OK, ordinary Enter and actual subsequent D3DIM drawing
on November 8, separately from the passive sweep. [The later original run](drakan-browser-original-2203-20261108.md)
reports reaching the menu before stopping at the disk floor. These provide a
reviewed historical route; neither qualifies the present source/module.

The exact missing current evidence is: a fresh original launch with its runtime
hold lifted; actual warning owner/focus and balanced native input consequence;
postwarning enumeration/setup outcome; exact owning renderer/device/context and
completed 3D presentation; then fresh menu/difficulty/story and living-world
captures. No fresh crash cause or graphics defect was established. Current saved
game config, physical GPU behavior, parity, sound, FPS and playability remain open.

Validation: all 64 paths were reread and hashed, resource/control/import/config
decoding checked against original bytes and bounded objdump listings, and the
document checked for whitespace errors. No production code changed, so no build,
emulator, fixture, browser or native execution was run. Box **NONE / NOT_CREATED**,
expiry **null**, stop receipt **not applicable**; no watchdog is needed without
runtime allocation. No downloads, staging, guest writes, capacity probes,
reserve changes, cleanup, shared TODO edits or workers occurred.
