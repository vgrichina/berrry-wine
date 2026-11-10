# LBreakout startup: original fill work and display-path controls

Evidence: `scratch/runs/20261110-lbreakout-startup-cause-0355/` (ignored).
This investigation was entirely offline. No box, browser or native game run
was created or resumed. The original startup timeout remains unexplained;
there is no supported runtime repair or native menu/gameplay acceptance.
The shipped change preserves bounded original state in existing startup
snapshots, with compiled original-code and actual installed-Worker caller tests.

## What the retained run establishes

`cead58dea` describes the retained original attempt in
`20261110-lbreakout-first-menu-gameplay-0343`. Secondary-worker initialization
and the original title precede startup arming at 03:46:11.033Z. The unchanged
two-second deadline expires before a recorded SDL or menu display return.
The prior renderer-readiness identity slice 42 has EIP `0x6108fa`, ESP
`0x074ffbc8`, yield 0 and 100,000 blocks. Its registers are null. It is an
earlier slice, not the guest PC at failure. The later page slice in the same
readiness artifact is a different observation and must not be merged with it.
No retained original memory supplies the fill dimensions, remaining count,
caller, menu or dirty rectangle count at timeout.

The earlier native caller predates its cached-failure repair: its retained
first-browser-failure names the deadline but contains no startup snapshot.
Adding retention now cannot recover that lost state. No new native attempt
was made to manufacture an answer.

## Original instruction paths and causal controls

With SDL loaded at `0x5f0000`, `0x6108fa` maps to original SDL VA
`0x100208fa`, inside the 32-bit `SDL_FillRect` software loop. The original
loop stores ECX through EAX, advances EAX, decrements EBX and exits the inner
loop when EBX reaches zero. It then advances the row by the surface pitch,
decrements the remaining row local at ESP+0x20 and repeats. ESI at this PC
holds width/4, not a surface pointer. The surface is the local at ESP+0x1c;
EBP points to the clipped rectangle. These locations were checked by running
the original DLL instructions, rather than inferred from a replacement loop.

`tools/lbreakout-startup-cause.test.cjs` loads the original hash-pinned EXE,
SDL and installed CRT into real compiled Wasm. Original SDL allocates and
fills an isolated 640x480 surface. Two samples at exactly SDL+0x208fa show
EBX decreasing 160 to 159 and EAX advancing 16 bytes. The original call
terminates with its cdecl stack restored and every output pixel zero.
Thus this PC can be finite original work. It does not establish the native
run's dimensions, completion time or eventual menu.

The original manager suffix at `0x41083f` pushes 1 and calls the original
wrapper `0x425ff6` from `0x410844`. If dirty count `[0x452468]` is 200, the
wrapper calls `SDL_UpdateRect` through `0x4500c0`, returns at `0x426026`,
resets the count at `0x426047`, and returns to manager `0x410849`.
The compiled control executes this original suffix and real SDL on an isolated
software surface. Both original returns are observed in order; the startup
gate completes. This tests control flow, not native pixel presentation.

For dirty counts 1 and 0 the original wrapper instead selects `0x42602b`,
which calls `SDL_UpdateRects` through `0x4500d0` and returns at `0x426044`.
The compiled controls stop at that original branch entry. They do not claim
successful partial presentation. Early experiments continuing this path with
the isolated software surface entered SDL error formatting; those experiments
did not establish native startup behavior. The gate currently watches
only `0x426026`. A partial-update ordering gap is therefore possible, but the
retained run has neither a dirty count nor either return proving it caused
this failure. Changing the gate to accept a different return would be an
unsupported causal repair here, so its completion conditions are unchanged.

## Bounded retention and complete-caller validation

The startup observer now enriches only its existing `snapshot()` read with
sample time/PC, eight registers, 24 stack words, menu/selected-link fields,
dirty count and screen surface header. In the original 32-bit fill-loop range
it also retains the actual local surface header and clipped rectangle. Reads
are bounded, reject unmapped pointers and report diagnostic read errors
without changing completion. No pixels, arbitrary pointer graph or memory
dump is retained. The last sample freezes on stop; its timestamp remains the
sample time and must not be relabeled as failure time.

There are no added protocol requests, timers, trace ranges, guest calls or
guest writes in this change. The existing caller's cached-failure snapshot
and sticky first failure remain in place. `cead58dea` duplicate startup
composition refusal and `080064edf` unobserved paddle/combined-play refusal
remain enforced. Explicit level start and separate P pause/P resume/Space
commands are preserved. Shared CRT, renderer, startup providers, Nox and Q3
were read-only; clocks, tiers, budgets and deadlines were unchanged.

The extended installed-Worker test runs the emitted attached-Worker handler,
actual host initialization, original Worker installation statements, real
Wasm and the actual generated arm/completion functions. Its timeout control
holds the original SDL fill at SDL+0x208fa and retains the real registers,
surface, rectangle and stack through the caller's first failure. It performs
exactly one owner read and one existing snapshot read, then zero protocol
after deadline or terminal reuse. A separate success control executes the
original manager suffix and SDL full-update return and satisfies the complete
generated caller through its page-presentation boundary adapter. Replacing
the installed instance with equal exports still fails owner binding.

Validation also includes eight startup observer cases, seven full generated
startup cases, nineteen composed menu/paddle controls, thirteen inspection
tests, two cached-failure/composition tests, original compiled menu/paddle
controls, pause/explicit-level-start tests, and locked builds. Test preparation
failures and corrected newline/held-breakpoint controls are retained locally.
No development failure caused a native retry.

The concrete missing state is a naturally sampled original caller/stack,
EBX/row count/destination, clipped dimensions/pitch, active menu and dirty count
during the failed interval. This change can retain those fields during the
existing sample cadence in a separately authorized future run. Until that
evidence exists, finite original work versus missed partial/menu ordering
cannot be distinguished for the retained native timeout.

No new box ID, expiry or stop receipt exists. The inherited evidence records
`bx_azpsrme4` archived, expiry null, receipt `stop_cbe69a7349613dfd`; it was
untouched. Git commit plus relevant binary diffs and small helper inputs
preserve source without source archives or copied game media. This single-task
worker releases its paths and stops after publication.
