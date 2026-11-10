# LBreakout native fixture input and original launch refusal, 2026-11-10

The changed fixture passes its complete short Left input through authentic SDL
and original paddle routines. The one original launch was refused before it
started: its release gate checked for the fixture parent's wait record before
that record had been published. This is the first live failure and ended the
experiment. No original input, brick removal, score progress or causal emulator
repair is claimed.

Evidence: `scratch/runs/20261110-lbreakout-observed-native-input-0015/`.
`runtime-pins.json` records the exact staged Git SHA and 822 file pins.
`relevant-source.patch`, `relevant-untracked-source.patch`,
`owned-new-tools.patch` and `final-owned-helper-inputs.patch` preserve relevant
differences and run helpers. Git remains the source archive. Existing candidate
media paths and hashes are used; there is no source/media archive.

## Tested inspection implementation

`tools/lbreakout-case-inspection.py` generates case-specific read-only inspection.
It selects fixture/original logs explicitly, reports an unpublished live log as
pending, and independently surfaces browser failure, transport failure, cleanup,
Chrome exit and actual launcher wait records. Launcher logs are written only
after `communicate()` completes; absence while live is expected. Unknown case
names fail before generation. The observer, loaded module/generation binding,
native return/ESP matching, Canvas2D/noD3D identity and caller guards are unchanged.

Before allocation, both actual run-specific control consumers executed generated
inspection locally with missing live logs, available case logs and terminal
failure controls. Seven controls passed. Permanent generated-consumer tests
also check foreign-case log isolation and terminal parent wait records. The
fixture generator initially included Node-only offline negative controls; that
offline failure was corrected before allocation, and the exact regenerated
initializer passed 43 authentic calls with 159 passive observer records. The
47-call observer controls, generated caller terminal/pulse controls, native-key
tests, buffered DirectInput tests, media verifier and locked builds pass.

## Reviewed native fixture and first failure

The production Worker loaded module SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`,
2186068 bytes. Its initializer independently passed the 43 original-consumer
calls. Startup was separately model-reviewed: usable dark board, eight gold
blocks and white paddle/attached ball at page x328.

One Left pulse requested 80 ms. Independent release was armed before DOWN;
both phases acknowledged. Trusted DOWN/UP occurred at 00:16:56.230Z and
00:16:56.306Z. Native SDL plus original paddle routines returned x312 for both
edges. The separately reviewed returned image shows paddle/ball at page x320,
eight pixels left, matching x312 plus canvas offset8. Drawing consumes returned
coordinates and implements no key-driven displacement. Released physical state
is zero. These are diagnostic fixture results, not original gameplay.

After the reviewed fixture passed, its ordinary close acknowledged. Cleanup was
published at 00:17:25.430Z, but the launch script's immediate wait-file assertion
failed at 00:17:26.273Z. It had not yet reached original process creation. The
fixture parent subsequently wrote actual wait code 0 with separate stdout/stderr
EOFs at 00:17:30.174Z. Thus cleanup/ACK did not establish parent completion.
No retry or later game protocol/input/capture/quit/guard extension followed the
refusal. Immediate owning-native cancellation found both fixture processes
already absent and recovered the actual wait record.

## Retrieval and lifecycle

All 49 remote artifacts, 43 unique SHA/size pairs, were independently retrieved
and verified before the sole delegated normal stop. All 822 staged pins were
unchanged. Box `bx_x4qy94sx` used independently observable immutable watchdog
UUID `781273ec-cdee-431f-8627-0058c52ab68a`, prearmed before allocation with a
25-minute deadline 00:41:15.118Z and initial API expiry 00:41:14.500Z.
Stop `stop_72a8b2e5c40aacec` completed unforced at 00:18:06.806Z. Independent
final API state is ARCHIVED, expiry null. The watchdog was actually waited with
return code 0 and separate EOFs; immutable deadline, UUID, stop receipt and final
API response are retained. Inherited boxes were untouched; /home remained above
1.5 GB free.

Next requires a separately authorized run whose original launch gate waits for
the actual fixture parent completion before its one launch. No second runtime
or original attempt was made here. Original SDL/game consumption and visible
brick/score progress remain unmeasured. This worker releases its files and stops.
