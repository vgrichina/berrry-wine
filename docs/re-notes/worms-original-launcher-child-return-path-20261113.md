# Original WORMS.EXE: configuration, ordinary children and return ownership

Static and pure host/register investigation, 2026-11-13.
**NO_NATIVE_RESULT.** No original instruction, CPU engine, Machine instance,
VM, WASM, native guest, browser, game, build or box ran. This closes the
launcher questions left in the [0940 launch contract](worms-original-dos-launch-contract-20261113.md);
it does not qualify installation, the helpers, DOS/4GW or gameplay.

The main routine ignores the result of **every** helper and of WRMS. The
runtime wrapper tests DOS EXEC's carry flag, fetches AH=4Dh only after a
successful EXEC return, and translates EXEC errors. These are distinct layers:
ignoring a returned error is proven; surviving a helper that hangs, damages
state or never returns is not. Intro launches remain part of the ordinary
graph, including when an earlier launch returns an error.

## Evidence and address convention

Run: `scratch/runs/20261113-worms-launcher-child-2480/`. Initial main commit:
`8cb53659def91f21e4dda035b0cd19e1a7f20975`. `incoming.json` pins the actual
working sources and incoming changes; `relevant-incoming.diff` and individual
new-file patches preserve relevant uncommitted source. No incoming production
or test file was edited. The newer CD/FCB/loader changes in that tree are
preserved; the old note's absence-of-CD statements are not a fresh finding here.

All 19 artifact seals from `20261113-worms-dos-static-0940/seals.json` were
verified. The original member identity remains 14,368 bytes, SHA-256
`7dd42f1d5d719912855c567e95570423cd4c816500c754ff8628dd84f67d46ec`.
Only explicitly printed byte spans in its sealed disassembly were used.
Eight bounded windows were redisassembled from temporary RAM files and removed.
No new HTTP request, executable recovery, dependency/media fetch or `/home`
media staging was needed. `static.json` records exact bytes, strings, argument
vectors and four rejected byte mutations. The old Mode1/2352 recovery recipe
remains the recovery authority; this run did not repeat it.

Addresses below exclude the 64-byte MZ header. DS starts at image `33A0h`
(file `33E0h`); a DS address therefore maps to file `33E0h + offset`.
The true main entry is image `0008h`. Startup is MZ CS:IP `0000:09FE`, whose
jump must be decoded from `09FEh`, not from the preceding padding byte.

## The actual 94-byte consumer

Main `001F–004C` opens relative `SETUP.CFG` in `rb` mode (`DS:00B9`), requests
94 one-byte elements into `DS:0440`, then closes the stream. Only open success
is tested. Neither the read count nor close result is checked. CRT startup
`0BBA–0BC6` zeroes the BSS containing the buffer before main. A short read can
therefore leave zero fields; that is not proof of a valid configuration or
permission to fabricate one. Open failure prints the run-SETUP diagnostic and
calls exit(0), not a special nonzero installation error.

| CFG byte offset | Consumer and consequence |
|---|---|
| `0–1` / DS:`0440` | Sound/environment selector; compared against 0, 3, 5 and 2. |
| `2–3` / `0442` | Zero/nonzero sound-environment guard; first numeric format operand. |
| `4–5` / `0444` | Second numeric operand; duplicated for the five-field format. |
| `6–7` / `0446` | Third numeric operand; duplicated for the five-field format. |
| `8–9` / `0448` | Installed-file drive number; add `40h` for WORMS.CFG/WRMS names; select this drive after WRMS returns. |
| `10–11` / `044A` | No direct main consumer established. Do not assign a meaning. |
| `12–13` / `044C` | Media drive number; select before helpers, add `40h` for their absolute paths. |
| `14–93` / `044E` | Start of the installed-directory C string, passed directly to `%s`. Eighty bytes remain in the requested record; main does not validate a terminator or that capacity. |

After reading, main `004F–005B` calls the drive wrapper `06DE` with `044C`:
INT 21h AH=0Eh, DL=word minus one. It then calls AH=3Bh with `"\\"`. Results
are ignored. Thus config is read in the initial CWD, but ordinary helper
launches are attempted after selecting the configured media drive and changing
to its root. This is important for the *relative* AVI arguments. The wrapper's
output local receives AH=0Eh's drive-count result, not a saved original drive.
There is no launcher chdir to the installed-directory string.

Main formats `WORMSCFG` as `%c:%s\\WORMS.CFG`, using `0448 + 40h` and `044E`.
It preserves the directory string's own leading slash or lack of one. These
bytes do not establish actual drive letters, directory spelling or a generated
SETUP.CFG. The format is not enough to assume an absolute installed path.

Sound branches `0083–0154` alter the C runtime's environment vector:

- Selector 0 removes both `ULTRASND` and `BLASTER`.
- Selector 3 removes `BLASTER`; if `0442 != 0`, writes `ULTRASND` using
  `%3x,%d,%d,%d,%d` with words `0442,0446,0446,0444,0444`. If zero,
  inherited ULTRASND remains.
- Other nonzero selectors remove `ULTRASND`; if `0442 != 0`, write BLASTER
  using words `0442,0444,0446`. Selector 5 uses `A%3x I%d D%d T6\n`, selector
  2 uses `A%3x I%d D%d T4\n`, otherwise `A%3x I%d D%d\n`. The LF is present
  in the original strings. If `0442 == 0`, inherited BLASTER remains.

These are observed formatting branches, not assigned hardware choices.
`0157–0160` sets `DOS4G=quiet`. Main ignores environment-update failures too.

## Exact ordinary launch graph

Every row passes AX=0 to wrapper `09F3`, with DX naming the formatted path and
BX naming the following DS-relative near-pointer argv vector. The wrapper
supplies CX=`[DS:037C]`, the runtime environment vector.

| Main call | Path format and source | argv vector | DOS command tail, excluding length and CR |
|---|---|---|---|
| `0180` | `%c:\\BLACK.EXE`, `044C+40h` | `0234: {002B,0}` = `BLACK.EXE` | empty |
| `01A0` | `%c:\\FMV\\PLAY.EXE`, same drive | `0238: {0035,003E,0}` = `FMV\\PLAY`, `fmv\\logo1.avi` | `fmv\\logo1.avi` (13 bytes) |
| `01C0` | Same PLAY path | `023E: {0035,004C,0}` = `FMV\\PLAY`, `fmv\\logo2.avi` | `fmv\\logo2.avi` (13 bytes) |
| `01E4` | `%c:%s\\WRMS.EXE`, `0448+40h`, `044E` | `0230: {0022,0}` = `WRMS.EXE` | empty |

`0183`, `01A3`, `01C3`, and `01E7` immediately begin unrelated setup; none
tests returned AX, errno, child termination type or flags. A returned BLACK
failure still leads to logo1, then logo2, then WRMS. A nonzero ordinary child
exit likewise does not veto the next launch. No intro bypass or special
accepted error list exists in main. No later helper is conditional on a
previous helper's success.

After WRMS returns, `01E7–01ED` selects the **configured installed drive**
`0448`; it does not restore a recorded prelaunch drive/CWD. Wrapper `06DE`
always returns AX=0, and main preserves it through its epilogue. CRT
`2207–220A`, `040C`, `041E`, `0BFC–0C52` consequently reaches AH=4Ch with
AL=0 on this returning path, regardless of WRMS's returned status. Do not use
launcher exit 0 as proof that a helper or WRMS ran successfully.

## What the shared runtime wrapper owns

The ordinary chain is `09F3 -> 1F25 -> 1EF4 -> 2E44 -> INT 21h at 2EDF`.
`1F25` does allocation/path work; direct explicit `.EXE` names take the branch
at `20C5`, call `1EF4` at `20D9`, save the result at `21C4`, clean up, and
return it at `21ED`. Empty-extension `.com/.exe/.bat` trials and COMSPEC/shell
fallback exist elsewhere in this library but are not the original four paths.
AX=2's special dispatch and the low-level AL=4 mode are also not selected.

`2CC6–2DE8` constructs a paragraph-aligned temporary DOS environment from the
runtime vector, copying variable strings and the terminating null. The vector
was copied from the launcher's original PSP environment by `282D–28E6` and
then modified by `0750`. This temporary segment is supplied **explicitly** in
the EXEC parameter block; passing env=0 and merely inheriting the unchanged
parent PSP environment would lose the launcher's changes.

`2DF0–2E43` skips argv[0], copies remaining arguments separated by one space,
and emits a DOS length byte plus trailing CR. There is no leading space for
these calls, no automatic executable name in the tail, and no propagation of
the original WORMS command line. `2DBE` rejects argument text longer than 126
bytes before EXEC. All four tails above fit.

`2E44` builds the ES:BX parameter block at DS:`0402`: environment segment,
far tail pointer, and two far default-FCB pointers. It parses the first two
tail names through AH=29h into DS:`03E2` and `03F2`, without checking those
parse results. It saves SS:SP and DS, polls AH=0Bh, calls the runtime far hook
at `[03A0]` (initialized to the RETF at `0C5D`), sets AH=4Bh with AL=0, and
EXECs the generated path. The launcher, not a shell, owns the tail and
environment buffers. Its environment allocations are cleaned up on return.

At `2EE1` it saves returned AX and flags, restores its own DS using `0C54`,
restores SS:SP/DS, and recovers the saved CF via SAHF at `2F0C`. At `2F17`:

- CF set: skip AH=4Dh; translate the DOS EXEC error through `1443/1448`,
  retain DOS error information through `0D02`, map errno and return AX=FFFFh.
- CF clear: call AH=4Dh at `2F19–2F1B`; the returned AX contains the child
  code in AL and termination type in AH. The wrapper does not reject nonzero
  AL or a nonzero AH. With successful status retrieval it passes AX onward.

Main ignores either result. This tolerates **returned failures**, not loss of
the parent's continuation. Child hangs, child termination mechanisms, damage
to vectors/devices/files, and any inter-helper dependencies remain outside the
inspected binary boundary: BLACK/PLAY bodies were not fetched or examined.

## Exact current ToyVM comparison and first dependency

Actual source is [dos.js](../../tools/toyvm/dos.js), especially `loadExe`,
`int21`, `pspSaveStack` and AH=4Bh/4Ch/4Dh, plus
[dos-loop.js](../../tools/toyvm/dos-loop.js)'s `serviceInterrupt`. Run tests
borrow these actual exported methods onto plain host data/register bags; no
Machine or DosSession constructor, CPU engine, decoding or dispatch executes.

| Launcher contract | Current host source / pure check |
|---|---|
| Ordinary AX=4B00, ES:BX PB | AL00 implemented. Missing file returns CF=1/AX=2 without a child. Bad environment and insufficient space return 10/8. AL04 is unsupported; original calls use AL00. |
| Explicit runtime environment | Nonzero PB environment wins over PSP:2Ch. Host clones variable strings, appends count=1 and the child's absolute self-name, owns the new environment by child PSP, and preserves parent bytes. Env=0 inheritance separately controlled. |
| Exact tails | Host copies length-limited text to child PSP:80h, writes CR, and excludes argv[0]. Empty/13-byte tails verified for all four rows. |
| Parent continuation | AL00 saves parent CS:IP from the IRET frame, SS:SP, DS/ES, PSP/allocation frontiers and AX=0. AH4C pops that frame, frees child-owned environment/allocations, and returns `transfer`; loop applies it after IRET. Pure checks resume at the original continuation `2EE1`. |
| Separate child code/type | AH4C records normal type 0 and low-byte code independently of parent AX=0; AH31 records type 3 and retains resident memory. Codes 0/1/255 and type3/code7 checked. |
| Default FCB pointers | AH29 parser exists, but AL00 does not read/copy PB's two FCB pointers into PSP:5Ch/6Ch. Reproduced with distinguishable source bytes. No original helper dependence on these PSP fields is established. |
| AH4D ownership | Current host returns its stored code/type repeatedly; it does not consume/reset that status. Original wrapper reads it once per successful EXEC, so no demonstrated launcher failure follows from repeatability. |
| EXEC return CF | **Pure host discrepancy:** AL00 records no return flags; AH4C assigns the parent transfer without clearing the child's saved CF; loop IRET reads the child's flags then transfers segments/IP/SP/AX without restoring parent flags. A synthetic AH4C with CF=1 resumes at `2EE1`, AX=0, CF=1. Paired CF=0/1 controls reproduce it using the complete actual `serviceInterrupt` method. The original wrapper would classify that successful return as an EXEC error and skip AH4D. Original child flags/termination and actual failure remain unobserved. |

The first concrete ordinary EXEC dependency is therefore **BLACK at `2EDF`
followed by a return to `2EE1`**, with the supplied tail/environment and a
correct success/error CF. There is no need to reach the extender to identify
this dependency. A missing BLACK can return DOS error 2 and main still tries
both PLAY calls and WRMS; it cannot stand in for observing successful helper
return. Successful EXEC followed by child AH4C is represented in source, but
the CF reproduction prevents claiming the full return contract is qualified.

No production fix was made. The pure CF reproduction supplies a bounded next
host target; changing that return path still needs focused runtime validation
and the locked build before any code commit. Original helper termination
methods, exit flags and side effects remain unknown. After ordinary WRMS
entry, its already documented DOS4GW search/4B03 overlay is the next binary
boundary, not an analyzed extender/game path in this task.

## Validation and next authorized work

`supervise.py` runs the sealed-byte checks and ten pure actual-source/register
groups under independent process deadlines. Four original-byte mutations are
rejected; three actual-source mutations (wrong environment source, lost child
code, missing CR) each produce the expected failed assertion. A real deadline
control is killed and reaped with SIGKILL. The initial malformed-environment
fixture accidentally overwrote its PB; it was corrected to use a disjoint
synthetic region before the recorded supervised PASS. No finding depends on
that fixture error. Evidence is compact JSON/logs, source patches and bounded
assembly windows, with reconstruction/hash checks; no source archive or media
copy is retained.

Next: an authorized, focused DOS parent/child return test for the CF seam and
any narrow fix, then the locked build if code is to be committed. Original
launch observation still requires genuine setup-produced state, explicit
verified device mapping, unchanged intros and bounded deadlines. Do not invent
SETUP.CFG, drive letters, hardware selections or helper success. No install,
menu, audio, game load or turn outcome is claimed. Box ID none; state
NOT_CREATED; expiry null; stop receipt not applicable.
