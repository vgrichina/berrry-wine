# Penguin Command original A-key path, 2026-10-24

**No generic input defect was reproduced offline; no production patch is justified.**
The authentic executable fires from an SDL keydown event filter, comparing
the symbol with lowercase `0x61`. The retained production message has the
correct A scan code, and the inspected SDL translation path maps that scan
code to the expected symbol. Whether that path executed and whether the
cannon accepted the shot remain unobserved. No guest was run in this task.

The useful next observation is the authentic game filter's event symbol
and the cannon routine's immediate state/branch, rather than another delayed
pixel comparison. This report supplies exact addresses and an existing-tool
capture recipe, without adding diagnostics or claiming firing success.

## Inputs and evidence

Base is main `5691793a58b4670fd2a621114d7926100a1e47de`, read from the
verified read-only donor `/tmp/input-consumption-clock-independent-closeout-oct24/repo`.
The original files were inspected in place under
`/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11`:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| penguin-command.exe | 107008 | `14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1` |
| SDL.dll | 321536 | `15537c9176d7e6d5c28c607c4b147c8c2a7c45102b1b8e836b38d2f9449fc8ce` |

SDL identity matches `/tmp/penguin-integrated-clock-firing-oct24/manifest.json`.
No media was downloaded, copied or replaced. The adjacent evidence directory
contains 17 bounded disassembly slices, VA/file-offset/raw-byte seals,
source excerpts with exact full-blob/excerpt hashes, and source-only checks.
All addresses below are preferred-image VAs, unless marked relocated.

Reuse the retained matched-test report and logs at
`/tmp/penguin-postrelease-matched-firing-oct24/repo/docs/re-notes/penguin-command-postrelease-matched-firing-20261024`.
The independently read treatment log confirms:

* A-down: batch40032, WM_KEYDOWN `0x100`, wParam `0x41`,
  lParam `0x001e0001`, DispatchMessageA hwnd `0x10001`.
* A-up: batch40282, WM_KEYUP `0x101`, wParam `0x41`,
  lParam `0xc01e0001`, same hwnd.

Thus the missing-scan-code hypothesis is contradicted by retained delivery
evidence. The first post-down frame40100 is 68 batches after dispatch:
at the configured 200ms/batch, 13600ms of batch-clock advance. This gap can
miss transient state; it does not establish that a projectile existed or
that its lifetime followed that clock without other constraints. The full
ammo baseline39999 precedes A consumption and cannot prove ammo at40032.

## Authentic executable branch

EXE `.text` mapping is `fileOffset = VA - 0x400c00`.

| VA / file offset | Decoded evidence and consequence |
| --- | --- |
| `0x4038c2` / `0x2cc2` | Stores callback `0x403150` as SDL_SetEventFilter argument; call at `0x4038c9` goes through thunk `0x40f680`, IAT `0x571414`. Static registration site; active pointer at40032 is unknown. |
| `0x40315a` / `0x255a` | Loads event type byte from EBX; type2 reaches keydown branch `0x403190`. |
| `0x40319c` / `0x259c` | Calls SDL_GetKeyState(NULL) through `0x40f690`; return pointer is not used to decide A firing. |
| `0x4031a1` / `0x25a1` | Loads event symbol dword `[EBX+8]` into EDX; sets EAX=1. Compare at `0x4031a9`: `83 fa 61` (`cmp edx,0x61`). Match branches to `0x40326d`. S=`0x73` selects2; D=`0x64` selects3. |
| `0x40326d` / `0x266d` | Builds cannon arguments `(x=[0x413e50], y=[0x413f30], cannon=EAX)`; call at `0x403282` goes to `0x406d80`. |
| `0x403b87` / `0x2f87` | Calls SDL_PumpEvents through `0x40f6a0` in the game update routine. The firing filter can run during pumping before an event is later polled. |

This establishes actual binary A/S/D use, beyond the README. It does not
establish the game's callback was still installed in the matched run.

## SDL/production translation

SDL `.text` mapping is `fileOffset = VA - 0x68100c00`.
Its import table includes GetKeyState, GetKeyboardState, MapVirtualKeyA and
MapVirtualKeyExA, plus message-pump APIs. **GetAsyncKeyState is absent** from
this SDL import table. Speculative changes to its asynchronous press latch
would not explain this demonstrated filter branch.

SDL backend callback `0x68133640` reads message/wParam/lParam from its
arguments. Its message jump table at `0x681477a8` sends WM_KEYDOWN to
`0x68133701`. At `0x68133703` it rejects down messages whose lParam bit30
is already set; the retained A-down has that bit clear. At `0x68133728`
it shifts lParam right16 and passes the scan/extended field, VK and pressed
state through translator `0x681333b0`, called at `0x68133739`.

At `0x68133411` the translator calls MapVirtualKeyExA(scan&255,1,layout).
Production `src/09a7-handlers-dispatch.wat` lines4397–4406,4493–4568
has scan `0x1e` -> VK `0x41`; ExA delegates to A with the additional stack
cleanup. The SDL nonzero translation branch at `0x68133518` feeds this VK
into the lookup at `0x68133442`:
`mov eax,[eax*4+0x6814f5d0]`, followed by storing the symbol at `[EBX+4]`.
The initializer at `0x68132fce` loads `0x61`, and `0x68132fe9` stores it at
`0x6814f6d4 = 0x6814f5d0 + 4*0x41`. Even an unmapped zero scan translation
uses the original VK fallback at `0x68133522`/`0x68133440`. That fallback
is not needed for the retained correctly populated A message.

The actual decoded chain is therefore:
`lParam scan0x1e -> MapVirtualKeyExA type1 VK0x41 -> SDL table symbol0x61`.
The SDL code performs the table lookup after obtaining the VK; it does not
pass uppercase VK0x41 directly as the SDL symbol.

At `0x681337e3`, SDL calls its private keyboard routine `0x68106c30`.
For a non-modifier down event it constructs type2 (`0x68106df0`), suppresses
an unchanged down state (`0x68106cc6`), and writes state at
`0x6814d9c8 + symbol` (`0x68106cd4`). Thus A's SDL state byte is
`0x6814da29`. Event enable state gates processing at `0x68106ce5`; callback
pointer `0x6814c550` is called at `0x68106d81` before queue insertion at
`0x68106d98`. A consumed Win32 message alone proves none of those later
values. GetKeyState calls in the inspected backend concern modifier
disambiguation, not a separate GetAsyncKeyState(A) firing poll.

`SDL_GetKeyState` itself (`0x68106bc0`, file `0x5fc0`) simply returns the
SDL state array, optionally reporting length323; it does not call a Win32
key poll. SDL_PollEvent (`0x68106840`) pumps first, then peeps the SDL queue.
The pumping path includes an indirect video-backend callback; the selected
backend and the runtime route into the inspected key translator were not
captured. This static path is not a claim that every backend uses it.

Production renderer-input.js lines37–126 computes the correct A down/up
lParams even for numeric-only CLI callers. test/run.js lines9772–9777
calls those handlers. Source-only execution of that exact, hash-bound helper
passed eight cases, including A numeric/physical/repeat/up, S, D and unchanged
Left-arrow controls. These verify the host field construction; they do not
execute SDL or guest instructions.

The four inspected input files (renderer-input.js, handlers-dispatch.wat,
handlers3-sync.wat and handlers-window.wat) are byte-identical between
historical module source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`
and main5691793a. This source comparison does not promote the historical
Wasm SHA `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`
to a current-main build qualification.

## Authentic firing rejection and immediate acceptance

The cannon routine `0x406d80` has real rejection paths:

* Cannon index >3 returns at `0x406f00`.
* Flag `[0x4130a0]` reverses index to `4-index` at `0x406f08`.
  Consequently the A event does not always select physical left ammo.
* Active count `[0x4130a4]` participates in a previous-target equality
  check at `0x406dca`/`0x406f2a`; identical target coordinates can return.
* Ammo `[0x41010c+4*effectiveIndex] <= 0` returns (`0x406ddf`–`0x406de8`).
  For index1 that dword is `0x410110`; reversed index3 uses `0x410118`.
* Count >19 takes the diagnostic/return path `0x406f16`.

Accepted firing initializes a record at
`0x4d0750 + count*0x7d2c`, increments count at `0x406ece`, and decrements
the chosen ammo dword at `0x406eec`. Those immediate writes, or the exact
return branch preventing them, are better causal evidence than sparse later
pixels. None was recorded at the actual A dispatch. We therefore cannot
choose between missing SDL delivery/filter, duplicate state suppression,
game rejection, or successful transient firing from the retained evidence.

## Concrete missing observation / unexecuted capture recipe

No new instrumentation is necessary. If a coordinator later authorizes a
runtime task, reuse the sealed treatment argv and authentic files, give it
new output paths, and retain all current build, resource and deadline gates.
Use one trace address at a time; multiple trace addresses force batch-size1
in this runner and would invalidate the original batch schedule.

For the game keydown branch, the existing flags can capture:

```
--trace-at=0x4031a1 --trace-at-start-batch=39999 --trace-at-limit=1
--trace-at-mem=ebx:20
--trace-at-dump=0x4130a0:8,0x410110:12,0x413e50:4,0x413f30:4
```

This site is after the filter type2 check and SDL_GetKeyState call, with EBX
still pointing at SDL_Event. Acceptance: observe type2, symbol `[EBX+8]=0x61`,
pressed byte `[EBX+2]=1`, coordinates, reverse-index flag, count and actual
ammo. A missing hit alone is not a key bug: first confirm the authentic
filter pointer, selected backend, enabled-event byte and SDL A state at the
translator/private-keyboard boundary. For the retained SDL load base
`0x7be000`, translate a preferred SDL VA as `0x7be000+(VA-0x68100000)`;
re-read the module load line in any future run instead of assuming that base.

To decide firing acceptance, the same existing single-address trace can
instead target `0x403287`, immediately after the cannon call, with dumps of
the same count/ammo/coordinate globals and the expected record. Compare
with pre-call values captured at the entry, or use a bounded interactive
break at `0x406d80` to record arguments and step the listed rejection tests.
Acceptance requires the count/ammo/record writes or a witnessed rejection
branch and its operands. A post-call dump by itself cannot prove an earlier
decrement. These are capture instructions, not executed recipes or requests
to repeat runtime attempts in this task.

## Validation, resources and handoff

Checks passed: exact binary hashes; nine authentic instruction byte anchors;
17 bounded disassembly slices and Win32-message jump-table mapping; retained
dispatch lParams; eight executed production-JS helper cases; exact historical
versus main input-source equality. No SDL/x86 execution, native/Wasm build,
guest run, gameplay qualification or generic repair regression is claimed.

Own private sparse repository and report/evidence only; donors and root
tracked worktree/index/refs remained read-only. Messageboard was watched and
appended. Flattened own alternate paths avoid inherited-depth failures without
altering donor repositories. Publication is task branch only, strict SSH SHA
verification, no main merge/deployment. External admission/resource/publication
and cleanup receipts remain at `/tmp/penguin-original-keypath-cause-oct24`.

Initial projected peak60388608/67108864 bytes included8MiB reserve and30MB
external growth allowance. The late first SQLite measurement is explicitly
qualified in resource-mid.json: all then-retained WAL bytes plus8MiB prior
main-file growth allowance are charged conservatively, with later positive
growth and future allowance retained. No history was deleted to reset bytes.
Installed tools and immutable input binaries remain standing inputs; no
whole-media staging or new tools. Internal cumulative capture stays below1MiB;
source slices stay below8192 bytes. Final resource receipt records actuals.

No box was assigned or touched. Coordinator's supplied state for bx_fkg5uw8h
was snapshot STOPPED at05:18:56UTC, prior expiry05:24:53.790UTC. No create,
resume, stop or delete was attempted; lifecycle ownership stays with coordinator.
Single bounded task ends with this causal limitation and actionable addresses.
