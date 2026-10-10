# Rodent's Revenge (WEP2, 16-bit)

`test/binaries/wep16/WEP2/RODENT.EXE` — Microsoft Entertainment Pack 2, 1991,
Christopher Lee Fraley, written in Visual Basic 1 (NE, links VBRUN100 plus the
pack's FIELD100 custom control and WEPUTIL). App id `wep16_rodent`; it is on the
desktop (`DESKTOP_APPS`) as of 2026-08-25.

There is a second Rodent's Revenge in the tree — `Rodent2000` in
`test/binaries/wep32-community/`, a 2002 VB6 remake. Both editions are playable;
the original remains the desktop edition and the remake is separately
selectable as `rodent2000`. See [rodent2000.md](rodent2000.md) for the remake's
OLE picture startup fix and gameplay command.

## Shared USER queue scratch overrun (2026-09-16)

The 2026-09-15 queue-unification commit `7d4342eb` made ordinary same-thread
posts use the shared USER queue. Its internal reads passed a 16-byte
`PAINT_SCRATCH` rectangle slot as the output buffer for a 28-byte Win32 `MSG`.
At the final slot of the paint ring, the twelve overflow bytes landed in the
adjacent `WND_CLASS_SLOT_TABLE`. Rodent's board (`hwnd=0x10005`) changed from
class slot 22 (`cbWndExtra=6`) to slot 0 (`cbWndExtra=0`); the VB runtime then
followed an invalid far callback and trapped at `0x00650151`. This explains
why the failure moved with paint scheduling and phone orientation.

Internal queue reads now pass a null output pointer and return their first
four fields through instance-private globals. The non-removing pending-message
probe, modal pump, and window-destruction purge use this path; guest-supplied
MSG buffers continue to be written directly. Instance-private results also
avoid a cross-Worker race on a single shared scratch region.
`test-user-queue-msg-scratch.js` holds a post through sixteen pending probes
and checks the adjacent class-slot canary. The full Rodent/Rattler gameplay
test, Win16 WaitMessage, Win32 queue/filter tests, and a 375×667 Chrome
portrait launch pass on the repaired build.

## High Scores close corruption and invisible saved names (2026-09-10)

Two independent bugs reproduced in non-isolated Chrome with the compatibility
WASM artifact explicitly forced (tail-call support selects the artifact;
SharedArrayBuffer availability does not).

* Closing the viewer raised a garbage-text message box and eventually consumed
  the Win16 stack. The modal return at WEPUTIL `1:0xc07` was correct. The real
  corruption happened during owner-draw painting: the fourth 32-byte
  DRAWITEMSTRUCT scratch slot at DGROUP `0x12 + 3*32 = 0x72` overwrote VB's
  nesting counter with `ODT_BUTTON=4`, and nearby runtime fields with the rest
  of the structure. VB declares an empty static DGROUP then initializes its
  own runtime data there. USER's message/font copies now occupy a dedicated,
  lazily allocated selector instead. Existing heap/stack spacing is retained.
* Saved name/score strings were present in the actual STATIC controls but
  invisible. The implicit Win32-dialog sibling clip treated WEPUTIL's earlier
  decorative IndentBox as an opaque occluder of later enclosed labels. Win16
  native controls now require explicit WS_CLIPSIBLINGS; custom painters retain
  the dialog visible-region clip around native controls, including headings
  later in template order. An exactly coincident custom frame is the label's
  own border and remains drawable. The existing Win32 rule and explicit Win16 clipping
  remain intact. Disabling implicit clipping for all Win16 controls was too
  broad: it restored names but drew horizontal frame lines across headings.

Verification: `test-win16-user-scratch.js` checks all DGROUP bytes, the four-slot
ring, DRAWITEM fields, and EnumFonts far pointers. The window-surface regression
checks Win16 implicit/explicit and Win32 dialog clips. A compat-browser probe
substituted the real WepScore API call for WepFame with a test score of 9999,
typed `PhoneProbe` through browser keyboard events, inspected both real score
lists and their pixels, and closed back to the idle game with ESP `0x1179ea`.
This exercises WEPUTIL's actual entry/save/viewer code, not a naturally earned
game-over or Safari keyboard policy. Probe: `/private/tmp/rodent-compat-close.js`
with `SCORE_PROBE=1`; capture: `/private/tmp/rodent-score-saved.png`.

The broader `test-win16-dialog.js` Solitaire suite still fails its final
Cancel/closed-screenshot assertion, identically with the pre-fix HEAD artifact
and the new build. It is not a green-suite claim; the scratch, clipping matrix,
native caret, and actual WEPUTIL resource tests pass.

The board-profile presentation area is now used for both Fit and Fill,
including modal windows, and accounts for the CSS safe-area insets and visual
viewport top. A host already below the status bar does not double the inset;
keyboard-open retains the frozen area and landscape retains its side rails.
Single-app and touch-control tests cover these bounds. The phone preview uses
Chrome with an explicitly simulated 47px top inset, not an actual Safari capture.

## Idle CPU: Win16 WaitMessage busy loop (2026-09-10)

Browser block tracing found a repeating 34-block pump, ending at
`0x001e0395`, with USER ordinal 112 (`WaitMessage`) as the last API on
successive slices. The handler set only `yield_flag`, leaving reason 0:
the host immediately posted another MessageChannel slice instead of sleeping.
This was an explicit wait misimplemented as polling, not a missing clock-spin
heuristic. Absolute PCs describe this particular NE load, not a stable module map.

The handler now completes its Pascal CS:IP return and sets queue park 15.
The host's stack-neutral clear-yield resumes the caller, with input waking
the sleep immediately and timers bounding its duration (still capped at 50ms).
Do not use the Win32 message-wait resume here: its stdcall pop corrupts the
16-bit stack. `test-win16-wait-message.js` checks the return PC and exact stack
cleanup before and after wake.

The first browser rerun fixed idle but left playing at ~83% of one core:
`_parkedSleepMs` suppressed sleep for 120ms after every input event, even when
the guest had just explicitly parked again. Fresh spin/queue parks now bypass
that grace period; new input still cancels the sleep via `_wakeStep`.
`test-browser-park-sleep.js` pins this single-use exception.

Apple M1, headless Chrome 152, visible 390x664 phone viewport, 15-second
renderer-process CPU deltas: before idle 101.1%, paused 101.9%, playing
102.2–102.8%; after both fixes idle 0.66%, paused 0.60%, playing 2.22–2.56%.
Gameplay uses real F2/F3 transitions and arrow pulses every 150ms;
screenshots verify a changed board and the actual paused message. These are
desktop Chrome measurements, not iPhone battery measurements. Host load was
above the quiet-box threshold, so percentages are indicative, not a fine-grained
benchmark. Raw before/final results and screenshots are under
`/private/tmp/rodent-cpu-*`; source/cache version 302 on the isolated LAN build.

## Reaching gameplay headlessly

### Phone board presentation (2026-09-10)

Fill contains the full 276x276 FIELD100 board including its cyan one-tile
perimeter. Its window-local bounds are x=3, y=78 within the 282x357 form.
Portrait reserves 204 CSS pixels below the board for the D-pad and New Game;
Fill/Keyboard sit directly above New Game. Landscape centres the intact square
between left D-pad and right action controls, using the available height.
Rotation preserves the window's guest backing extent so a shorter viewport
cannot cut away the bottom rows before presentation. Fit retains window chrome;
dialogs and open menus temporarily use the composed window bounds in Fill.

Portrait now omits the 12px wall column on each side (252x276 crop), preserving
all playable cells and the top/bottom wall. Landscape retains the full square.
Two-finger separation continuously interpolates window/board presentation and
snaps to the nearer endpoint on release; cancellation restores the starting
mode. Keyboard opening freezes control anchors and counteracts the parent
view's caret shift, allowing the keyboard to cover the controls.

The app deals a board at launch, but a *game* only starts from the menu:

```
node test/run.js --app=wep16_rodent --max-batches=11000 --no-close \
  --input='6000:click:203:71,7000:click:230:92,8500:png:/tmp/a.png,\
8600:keydown:38,8700:keyup:38,8900:keydown:38,9000:keyup:38,10500:png:/tmp/b.png'
```

`click:203:71` is the Game menu, `click:230:92` is New Game. Arrow keydowns then
push a column of blocks and the score climbs (5 → 12 over three keys, 1317 px
changed in a 232x264 box). Menu-bar hit points at 640x480: Game `203,71`,
Options `253,71`, Help `300,71`; Game popup items at y = 92 / 112 / 133 / 173.

A 16-bit app reports **0 API calls** and prints no host census when it is
healthy — that is not a sign of a dead run.

## Browser Worker startup (fixed 2026-08-30)

With the experimental **Threads** switch enabled, the NE executable was loaded
in slot 0's Worker but its NE DLLs were loaded into the idle main-thread WASM
instance. That split the selector/module state: RODENT's first far import into
VBRUN100 remained unresolved and trapped at `EIP=0x100010`.

The guest-worker protocol now runs `loadWin16Dlls` beside the instance that
loaded the NE task. Its `VBRUN100` selector, app-local modules, and far-import
fixups therefore share one arena. `test/test-worker-guest.js` keeps Threads on,
requires the Worker backend, and checks the rendered green Rodent board.

## Browser Worker keyboard focus (fixed 2026-08-30)

The renderer's Worker-owned WASM is only a browser-side shadow. Mouse clicks
updated its focus global, while slot 0 kept `$focus_hwnd == 0`; a following
arrow therefore reached the top-level form instead of the 276x276 VB picture
child that implements the board. The frame stayed alive and its timer kept
firing, which made this look like frozen rendering rather than wrong input.

Renderer focus changes now ride on the next slot-0 slice. The Worker performs
the normal `set_focus` notification and then mirrors USER's focus bookkeeping
before it dequeues a following key. Opening Game > New Game consequently leaves
live focus on `0x10005`, matching cooperative execution. The Worker browser
regression holds Right and requires the board to change; the 2026-08-30 run
changed 221 pixels with no trap. The reviewed frame has intact chrome, menu,
mouse counter, cyan border, olive floor, and green block field.

## Nothing owns the keyboard until you click (fixed 2026-08-31)

Reported from a real iPhone: the on-screen dpad (`lib/touch-controls.js`) does
nothing. It is not the overlay and it is not the Worker focus bug above — the
overlay reaches `renderer.handleKeyDown` with the right vk every time.

`get_focus_hwnd()` is **0** from launch until a press lands in the client area.
Nothing in our activation chain records a focus window: `ShowWindow` sends
WM_ACTIVATEAPP/WM_ACTIVATE/WM_SETFOCUS to the form but writes no focus, and
`--trace-win16` shows VBRUN100 calling `USER.23 GETFOCUS` exactly once, getting
0, and never calling `SetFocus` at all. With focus 0 the shared routing rule in
`lib/host-window.js` (`inputEventHwnd`) sends every key to `main_hwnd` — the
0x10001 VB form, which ignores arrows. The board is 0x10005.

It is not touch-specific and not browser-specific. Headless, with no click:

```
node test/run.js --app=wep16_rodent --max-batches=11000 --no-close --quiet-api \
  --input='6000:keydown:113,6100:keyup:113,7000:png:/tmp/a.png,\
8600:keydown:38,8700:keyup:38,8900:keydown:38,9000:keyup:38,10500:png:/tmp/b.png'
```

gave `0 of 307200 pixels differ`. Setting `$focus_hwnd` to 0x10005 by hand made
the same keystrokes play the game, so the routing was right and only the seed
was missing.

`P._seedKeyboardFocus` in `lib/renderer-input.js` now runs on each
`handleKeyDown`: when nothing holds the focus and the deep child at the client
centre covers at least half the top-level client area (and is not WS_DISABLED),
that child is given the focus. Rodent's 276x276 board inside a 292x350 frame is
79% of the client, so it qualifies; a frame whose children are a toolbar and a
status strip does not, and single-window games keep the old `main_hwnd` routing
unchanged. The same command now changes 944 px and F2 alone deals a real game.
`test/test-keyboard-focus-seed.js` pins all five cases.

## Menu inventory and what each item does

Driven by click, item by item, on 2026-08-25. `menu-sweep.js` cannot do this
one: RODENT.EXE has no RT_MENU (`ne-dump.js --menus-json` returns `{}`) because
VB builds the menu at runtime from the form.

| Menu | Item | Verdict |
|---|---|---|
| Game | New Game (F2) | works — deals mouse, cats, blocks |
| Game | Pause (F3) | works — "Paused. Press F3 To Continue." |
| Game | High Scores… | **partial** — the Hall of Fame dialog paints (trophies, OK, Clear Scores) and VBRUN then raises `Control array element '0' does not exist` over it |
| Game | Exit | works — resolves VB1's dynamic KERNEL `WritePrivateProfileString` lookup and closes cleanly |
| Options | Level… | **partial** — "Enter Starting Level: (1-50)" with Ok/Cancel paints, but the input box is not there: typing a digit and pressing Ok leaves the title at `[1]` |
| Options | Snail / Slow / Medium / Fast / Blazing | work — the radio check follows the selection (verified Slow → Blazing) |
| Help | Index (F1) | works — RODENT.HLP renders with live hyperlinks |
| Help | How to Play | works — own topic |
| Help | Commands | works — own topic |
| Help | Using Help | works — Help Topics dialog, Contents/Index tabs, 12 topics |
| Help | About Rodent's Revenge… | works — full WEP splash, author, VB credit |

The High Scores error is a VBRUN100 runtime error raised by the guest, not an
emulator trap. The former Exit error was different: VBRUN dynamically asks
`GetProcAddress(KERNEL, "WRITEPRIVATEPROFILESTRING")`; the API existed as
KERNEL.129 but was absent from the emulator's by-name export table, so the
false NULL became VB error 35 (`Sub or Function not defined`). Mapping that
name to the existing ordinal makes both the title-bar close button and Game >
Exit close cleanly. The Level… input box is likely related to the remaining
control-array shortfall one form over.

## VBRUN100 VERR during phone interaction (fixed 2026-09-09)

An actual iPhone run trapped at linear `0x001401a4`, bytes
`0f 00 26 ad 91`: `VERR word ptr [91ad]` in a loaded VBRUN100 segment. The
two-byte decoder previously knew LAR but not the adjacent protected-mode
selector-readability probe, so it emitted `$th_bad_opcode` and Safari reported
`RuntimeError: Unreachable code should not be executed`.

Handler 447 now implements both register and memory forms. A mapped Win16
selector is readable under the descriptor model already synthesized by LAR;
an unmapped selector is not, and VERR reports that result through ZF while
preserving the other materialized arithmetic flags. The focused selector test
executes the same disp16 memory encoding and checks both valid and invalid
answers.

### High Scores viewer check did not cover name entry (2026-09-09)

The Game > High Scores window is a viewer, not the new-score name prompt. A
current `dump-windows` / `dlg-dump` run shows 20 static score/name labels, three
trophy buttons, OK, and disabled Clear Scores; there is no Edit control. USER
focus is correctly on the OK button (`hwnd=0x1000f`, control class 1, id 1).
Consequently there is no USER caret to blink and the browser's caret-gated
phone keyboard correctly stays closed. Adding a synthetic caret or forcing the
keyboard here would send text to a push button. A real post-game name prompt,
if reached, must be checked separately because it is a different form/path.

### New-score caret missing from the compositor (fixed locally 2026-09-10)

The reported bug concerns earning a score and **entering a name**, not the
viewer above. WEPUTIL.DLL's RT_DIALOG 200 says "You have achieved a high
score!" / "Please enter your name:" and contains Edit id 500, a decorative
IndentBox, and OK. ENTERDLGPROC (export 1002, segment 1:0x10bb) sets the name
text and returns TRUE from WM_INITDIALOG; it relies on USER's initial focus.

Loading that exact resource through the Win16 template converter reproduces
the mismatch: USER focus and its visible caret both name Edit 500, but
`renderer.caretRect()` is null. Resource-created controls have WAT window
records, not entries in `renderer.windows`; `_paintCaretOverlay` discarded
the caret when that JavaScript record was absent. This also withheld the
caret signal used by the phone keyboard and touch-overlay pass-through.

The compositor now resolves these children through WAT's existing absolute
geometry exports and requires visible ancestry back to an owned renderer
window. No synthetic caret, focus override, or extra rendering surface is
introduced. Blink-off retains the keyboard anchor; hidden/destroyed/orphaned
controls do not. `test-win16-score-caret.js` uses the original DLL resource
and checks Edit 500 focus, caret, text insertion, and compositor visibility;
`test-renderer-native-caret.js` covers blink phases, visibility, ancestry,
ownership, and the existing JavaScript-backed window path.

Verification is resource-level plus automated input regressions. The bounded
Chrome gameplay run reached score 188 but not game over; it does not establish
end-to-end score saving. Actual iPhone keyboard appearance remains to verify
on the local build. Main d61fb67f was subsequently merged into the 8087
worktree; its centralized cache identity and automatic test discovery replace
the original renderer-201 cache bump and explicit test-list additions. Caret,
resource typing, and mobile touch regressions pass after integration. No
production deployment.

## Status panel regression (fixed 2026-08-25, dec5373c)

The gray strip above the board — mouse count, stopwatch, score — turned into a
white band at some point after 2026-08-22. Bisected to `8fdf2f5f`, which fixed a
latent `i32.and`-with-a-boolean in BeginPaint's class-brush fill (the fill had
never actually run) and in the same move let it fire for a top-level window on
the creation-time erase seed. A VB form registers its class with
`COLOR_WINDOW+1` and paints its real BackColor itself, so that second erase is
**white**, over content the app had already drawn: 7645 px against the reviewed
v86 capture.

`dec5373c` gates that seed on `WS_CHILD`. That left the 32x32 stopwatch child
erased white the same way, one level down — 605 px — because children genuinely
do need the seed: IdleWild's IWINFO pane is white in Win98 for exactly that
reason and `test-win16-wep1-gameplay` asserts it.

The fix is ordering, not the seed. `$win16_rearm_visible_child_erases`
(`src/09e-win16-api.wat`) re-arms the deferred NC sequence for every visible
guest-wndproc child when a hidden parent is shown, and the erase bit was being
cashed in lazily at that child's *first BeginPaint* — after VBRUN had already
stamped the stopwatch into the picture control. USER erases when a window is
shown, before the app draws. Erasing right there at re-arm time and clearing
bit 1 restores that order: the capture is now pixel-identical (0 of 307200) to
the reviewed 2026-08-22 wine-assembly reference, and IdleWild still gets its
white background because its erase merely happens first instead of last.

The reviewed native reference is
`test/output/win16-v86-comparison/wep16_rodent/native.png` (`native.json` has
the v86 provenance); the 2026-08-22 wine-assembly capture beside it is a good
before-image for this area. Native runs at 4-bit VGA, so the board reads tan and
teal there against our olive and green — that difference is the palette, not a
bug.

## Stopwatch AutoRedraw padding (fixed 2026-08-31)

The v86 reference shows the analog stopwatch only after gameplay starts. The
VB1 runtime draws that 32x32 PictureBox through a 34x34 AutoRedraw memory
bitmap, then copies it into the parent status strip. If the compositor keeps
the previous 32x32 child surface attached, that stale white surface covers the
fresh parent pixels and the clock appears as a blank square.

`$gdi_win16_autopresent_child_bitmap` therefore accepts VBRUN100 child backing
bitmaps up to two pixels larger than the child in each dimension. The match
stays tight enough to avoid attaching unrelated sprite sheets, while covering
Rodent's padded stopwatch bitmap.

## Deterministic input A/B (2026-10-10)

`test-win16-vb-gameplay.js` previously ran Rodent on `--real-ticks` and only required the board to change
between two moments, which the cats' own movement guarantees. It now runs the same route twice on the
deterministic clock: new game via clicks at batches 200/500/520, then RIGHT held from batch 1100 to 1105 in one
run only. The two runs must be byte-identical before the key and differ after it.

The difference is the mouse stepping right and pushing its whole block row (screen strip 311,250 108x12): one
block ends up sticking out past the field's right edge. The pace is timer-driven, about 15 SelectObject calls per
guest second, the same with or without input. Evidence: `scratch/runs/20261010-wep16_rodent-push-ab`.
