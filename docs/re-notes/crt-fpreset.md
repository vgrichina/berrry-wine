# x86 CRT `_fpreset`

## Trigger and contract

Original Circus Linux 1.0.0 fails at `_fpreset` before main, at VA `0x463f60`,
return `0x40115b`. Evidence: shared repository
`scratch/runs/20261018-circuslinux-passive-startup/` (reviewed failure; no window).

Microsoft documents `void _fpreset(void)` as reinitializing the floating-point
package, including recovery after SIGFPE:
<https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/fpreset>.
Its x86 control-word documentation demonstrates restoring `_CW_DEFAULT` after
24-bit precision and returning to 53-bit default precision:
<https://learn.microsoft.com/en-us/previous-versions/visualstudio/visual-studio-2010/e9b52ceh(v=vs.100)>.
Wine's upstream CRT implementation independently implements the x86 reset as
FNINIT followed by loading `0x027f`:
<https://github.com/wine-mirror/wine/blob/master/dlls/msvcrt/math.c>.
The live sources were inspected 2026-10-18; Wine is corroborating implementation
evidence, not a claim of testing native Windows CRTDLL.

The CRT default masks all six x87 exceptions, selects nearest-even rounding and
53-bit precision. Hardware FNINIT/FNSAVE reset uses `0x037f` (64-bit precision).
The distinction must remain visible even though this emulator stores values as
f64 and does not implement full extended precision.

## Implementation

`$fpu_reset(cw)` clears TOP, status, occupied tags, and the internal exact-integer
shadow-validity mask for the current thread. Physical register data and raw
payload bytes are retained. FNINIT and post-FNSAVE share this reset with 037F;
their existing exception trace behavior is preserved. FNINIT now also clears
the raw validity mask, as post-FNSAVE already did. This is metadata invalidation,
not overwriting data registers.

The new cdecl `_fpreset` handler traces cleared exception flags and calls the
helper with 027F. It consumes the four-byte return address and leaves EAX alone
for its void return. Its API row is appended, with both generated dispatch and
hash tables regenerated; no existing API row changes.

This is the legacy x87 CRT contract. MXCSR is not modeled by the current SSE
subset, and this change makes no new SSE reset claim. FIP/FDP/FOP are likewise
not tracked by the existing x87 environment implementation; saved fields remain
zero. Existing x87 exception delivery and precision limitations remain.

## Validation and remaining gates

`test/test-crt-fpreset.js` is a focused compiled conformance test using the real
generated API dispatcher and FNINIT/FNSAVE handlers. It dirties control/status,
condition bits, TOP, tags and exact-integer validity; checks CRT027F versus
hardware037F, cdecl stack cleanup, unchanged payloads, architectural empty tags,
nearest-even rounding, and sibling guest-thread instance isolation with shared
memory. Three dirty environments exercise differing prior control settings.
It is conventionally assigned to the unit tier.

At this source-only checkpoint, generator freshness checks, exact append-only
API prefix comparison, JS syntax, WAT fragment parentheses/label checks, and
`git diff --check` pass. **The compiled conformance test has not run.** No full
module compilation, native oracle, canonical build, or original-game retry was
authorized at this stage. Source base is origin/main
`9c68e38d820e47f61ccf25cdb3e3f7dcc6f8ea5b`.

After the coordinator grants resources: run the new test, existing
`test-fpu-instance-isolation.js`, `test-msvcrt-controlfp.js`, and appropriate
x87 regression/build gates before integration or original retry. The later
CRTDLL data imports and other absent APIs in Circus remain unverified; this
fix does not imply that startup will progress to a menu.

## Granted build and conformance validation

2026-10-18, 20:40–20:42 UTC: the complete normal `bash tools/build.sh` gate chain
passed in the isolated sparse worktree. The initial attempt found that the ESP
checker recognizes cleanup on one line; the equivalent cleanup was reformatted.
Two subsequent attempts exposed omitted sparse-checkout dependencies (Terminal
font and committed toy-VM bundles); those exact tracked files were added and the
whole gate chain rerun successfully. No gate was skipped or changed.

All four compiled tests passed:

- `test-crt-fpreset.js`: reset, ABI, rounding, empty tags, preserved payloads,
  shared-memory sibling-thread isolation and FNINIT/FNSAVE distinction.
- `test-fpu-instance-isolation.js`: original interleaved stack/raw-integer tests.
- `test-msvcrt-controlfp.js`: live x87 control-word query/update and rounding.
- `test-x87-island-predecode.js`: 400 sequences, 7,178 operations, fast/generic/
  unfused agreement including FNINIT/FNSAVE. The initial sparse fixture omission
  was resolved with the existing 53,248-byte notepad test fixture; its hash is
  recorded, and the initial failures remain in the evidence.

Independent review requested real math_pow2/math_log2 hooks in the conformance
test; these are installed. FNSAVE now also checks the saved pre-reset control,
status and exact 80-bit representation of physical +1.5/-1.5 registers, proving
that the common reset does not damage the save preceding it.

Evidence: shared `scratch/runs/20261018-crt-fpreset-validation/` contains each
command/log/result, source pins, tested patch, process postflight and receipt.
Candidate module is 1,866,400 bytes, SHA-256
`0c617764e036d0422ab19bc0d97477ff68ba5eb8fa7c247833b7519e8060e5f7`.
The prior canonical module remains unchanged at
`fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Node was v24.18.1. Minimum sampled free disk was 2,223,206,400 bytes, above the
2 GiB plus 64 MiB stop margin; no resource guard fired. All owned build/test
process groups are absent. Resource slot released; no game or browser run.
This supersedes the earlier pending compiled-test checkpoint, but does not add
a native Windows CRT oracle or establish that Circus progresses beyond reset.
