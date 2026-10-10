# SkiFree (`ski32.exe`, Microsoft Entertainment Pack)

`test/binaries/entertainment-pack/ski32.exe`, app id `ski32`. Image base
`0x400000`; single module, no DLLs of its own, so runtime VA == original VA
(nothing here needs `module+0x` arithmetic).

Everything below is read straight out of the binary with the repo's own tools;
the commands are given so each number can be re-derived rather than trusted.

## Window class and wndproc

```
node tools/pe-imports.js test/binaries/entertainment-pack/ski32.exe --dll=USER32
node tools/disasm_fn.js test/binaries/entertainment-pack/ski32.exe 0x405440 90
```

USER32's IAT starts at `0x40a100`. `RegisterClassA` is import [1] (`0x40a104`),
called once at `0x4054dd`; the `WNDCLASS` it fills sits on the stack and takes
`style = 0x2023` and **`lpfnWndProc = 0x405800`**.

| VA | What |
|---|---|
| `0x405800` | main wndproc |
| `0x405986`, `0x406924` | the two `call [0x40a150]` (`DefWindowProcA`) sites |

`0x405800` splits three ways: `msg <= 0x24` goes through a jump table at
`0x4059c4`/`0x4059e0`; above that, `0x405915` compares against `0x200` and peels
off `WM_KEYDOWN` and `WM_CHAR` by subtraction:

```
00405915  cmp eax, 0x200
0040591a  ja  0x405986          ; -> DefWindowProc
0040591c  jz  0x405969          ; WM_MOUSEMOVE
0040591e  mov ecx, eax
00405920  sub ecx, 0x100
00405926  jz  0x40594d          ; WM_KEYDOWN -> call 0x406170
00405928  sub ecx, 0x2
0040592b  jnz 0x405995          ; default
0040592d  ...                   ; WM_CHAR   -> call 0x406780
```

**`WM_CHAR` is never spelled as the literal `0x102`.** A byte search for the
constant (`node tools/find_bytes.js … --imm32=0x102`) returns 0 hits and reads
as "this app does not use WM_CHAR", which is wrong — the subtract chain above is
how it tests for it. Do not conclude anything from the absence of a message
constant in this binary.

## Keyboard: two tables, and the character one is where the game lives

### WM_KEYDOWN — `0x406170`

```
00406170  lea eax, [ecx-0xd]      ; ecx = wParam (virtual key)
00406174  cmp eax, 0x65
00406177  ja  0x4061b1            ; default
0040617b  mov dl, [eax+0x4063bc]  ; slot index, vk 0x0d..0x72
00406181  jmp [0x4063a8+edx*4]    ; five arms
```

Dump both tables with
`node tools/dump_va.js test/binaries/entertainment-pack/ski32.exe 0x4063bc 102`
and `… 0x4063a8 20`. Slot 4 is the default arm (`0x4061b1`), and only four
virtual keys are anything else:

| vk | key | arm |
|---|---|---|
| `0x0d` | RETURN | `0x40619e` |
| `0x1b` | ESCAPE | `0x406188` |
| `0x71` | F2 | `0x4061ab` |
| `0x72` | F3 | `0x406198` |

That is the **complete** virtual-key vocabulary. There are no arrow keys: the
skier follows the mouse pointer, which is why the app's touch layout has no
dpad.

### WM_CHAR — `0x406780`

```
00406780  lea eax, [ecx-0x58]     ; ecx = wParam (character)
00406783  cmp eax, 0x21
00406786  ja  0x40684a            ; bare `ret`
0040678e  mov cl, [eax+0x40686c]  ; slot index, chars 0x58..0x79
00406794  jmp [0x40684c+ecx*4]
```

The table covers characters `0x58`–`0x79` **only**, and slot 7 is the do-nothing
arm. Everything the game exposes to the keyboard beyond the four keys above is
here, and all of it is case-sensitive by construction — `'F'` (0x46) is below
the range and is discarded before the table is even consulted.

| char | arm | What |
|---|---|---|
| `'f'` 0x66 | `0x4067a0` | **toggles the speed flag at `0x40c670`** (`setz dl` of its own value — a toggle, not a hold) |
| `'r'` 0x72 | `0x4067b3` | tail-calls `0x401060` with `[0x40c63c]` and `0x40c6b0` |
| `'t'` 0x74 | `0x40679b` | `jmp 0x401000` |
| `'x'` 0x78 | `0x4067c3` | moves the object at `[0x40c72c]` (fields +0x40/+0x42/+0x44) by `+2` on one axis via `0x402390` |
| `'X'` 0x58 | `0x4067e5` | same, `-2` |
| `'y'` 0x79 | `0x406807` | same, other axis `+2` |
| `'Y'` 0x59 | `0x406829` | same, other axis `-2` |

## Named data

| VA | What |
|---|---|
| `0x40c670` | speed ("fast") flag, 0 or 1, toggled by `'f'` |
| `0x40c67c` | set once the game object exists; both key handlers bail when it is 0 |
| `0x40c72c` | pointer to the object `'x'`/`'y'` reposition |

## Reproduction: proving the speed key works

Speed is a rate, so no screenshot can show it. Watch the flag instead:

```
node test/run.js --app=ski32 --quiet-api --no-close \
  --max-batches=900 --max-seconds=120 \
  --watch=0x40c670 --watch-log \
  --input='300:keydown:0x46,320:keyup:0x46,500:keypress:0x66,700:keypress:0x66'
```

Measured 2026-09-13: the watchpoint fires at batches 500 and 701 (the two
characters) and **never** in the 300–500 window (the virtual key). `--input`'s
`keypress:` action is the one that produces `WM_CHAR`; `keydown:`/`keyup:` never
do — see `lib/renderer-input.js`, where `handleKeyPress` is a separate entry
point that the browser's own `keypress` event drives.

## Mouse steering: the first move is only recorded

`WM_MOUSEMOVE` (`0x405969`) bails while `[0x40c67c]` (game object) is 0, then
calls `0x406550` with the client point. That function steers only when
`[0x40c760]` is already set: the **first** move just stores the point in
`[0x40c700]`/`[0x40c70c]` and sets the flag. From the second move on, it turns
the skier (`[0x40c72c]`, pose at `+0x1c`, skipped while the pose is 0xb or 0x11, i.e. fallen)
toward the pointer relative to the skier's screen point (`[0x40c704]`,
`[0x40c5fc]`). Poses are discrete. Measured from the skier's point: 76° or more below
horizontal is straight down, 63-69° a down-right diagonal that keeps its
speed, and 58° traverses and slows to a stop. A headless route
therefore needs two moves, both **inside the SkiFree window**. A move past
the window's right edge (x ≈ 557 on the 640×480 CLI desktop) goes to the
desktop and is silently not a move. Any key press (e.g. `keydown:40`, which
the key table otherwise ignores) starts the skier straight downhill with the
pointer untouched.

## HUD: Dist and Time on the freestyle course

The status box is drawn around `0x401bb0..0x401cb9` with formats from string table 1
(`%2u:%2.2u:%2.2u.%2.2u`, `%5.2dm`, `%5.2dm/s`, `%7ld`). Dist is
`(int16)y / 16`, but after the skier crosses a course's Start banner, a flag
replaces y with `limit - y`: `[0x40c95c]` → `0x21c0 - y`, `[0x40c954]` →
`0x4100 - y`, `[0x40c958]` (the centre, freestyle) → `0x4100 - y`. So the HUD
jumps from ~29 m to ~990 m and **counts down**: distance remaining, not a wrap
bug. Time is `now - start` written only by the slalom/tree-slalom/finish paths
(`0x402cb6`, `0x4032a6`, `0x402e12`, `0x403403`). Freestyle never writes it,
so it stays `0:00:00.00` (confirmed with `--watch=0x40c944`: no write).

## Downhill FPS route (2026-10-10)

Straight downhill from the key start runs about 6 s before an obstacle in the
deterministic CLI world (rock at 967 m remaining). The browser seeds its course
differently on each launch. A crashed skier sits at 0 m/s until new input, so
a sample with no input during it is continuous downhill if its END frame shows
Speed > 0. Measured on a boat (real Xorg, Chrome 151 headful, Mesa software
GL, d27925e71): about 19-20 presents/s and 19-20 distinct displayed frames/s,
the same capped at 60 (the cap never sleeps). Evidence:
`scratch/runs/20261010T1356Z-ski32-downhill-fps-boat-d10ba697`.

## Dead ends / corrections

- **"SkiFree never uses WM_CHAR."** Withdrawn. It came from
  `find_bytes.js --imm32=0x102` returning 0 hits; see the subtract chain above.
- **"The speed key is F, so `vk: 0x46` is the binding."** Wrong twice over: the
  virtual key is discarded, and even as a character only the *lowercase* form is
  in range. This was the live bug in the phone overlay's "Fast" pill
  (`lib/apps.js`, `ski32.touchControls`) until 2026-09-13; the fix was to give
  the button spec a `char: 0x66` alongside the vk, and `lib/touch-controls.js`
  grew a `_char()` path because `_key()` only ever emitted
  `WM_KEYDOWN`/`WM_KEYUP`. Pinned by
  `test/test-skifree-fast-key-gameplay.js`.
- The touch overlay's **"New game" pill is correct as a bare `vk: 0x71`** — F2
  really is a virtual key in this binary.

## See also

- `test/test-skifree-showwindow-startup.js` — SkiFree exits during startup
  unless the first `ShowWindow` delivers the Win98 activation/focus/size
  sequence.
