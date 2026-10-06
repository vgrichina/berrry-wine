'use strict';

// CLI experiment flags, per-instance setup and worker inheritance live together.
// Add a flag here with its application below; run.js only supplies the runtime.
const { reportExperiments } = require('./runner-experiment-report');

// 07e-uop-compiler.wat's decline reasons, by code ($uop_decline_count).
const UOP_REASONS = [null, 'scan-limit', 'overlap', 'head-unsupported', 'no-backedge', 'loop-too-big',
  'seam-ambiguous', 'long-block', 'unreached-block', 'demand-no-fixpoint', 'branch-mid-block',
  'dead-flags-consumed', 'dead-cf', 'cf-no-recipe', 'cf-kind', 'dead-flags-rec', 'rec-no-recipe', 'rec-kind',
  'dead-flags-jcc', 'kind', 'too-many-windows', 'label', 'arg', 'too-many-temps', 'program-too-big',
  'ranges-full', 'scratch-overflow', 'call-indirect'];

function createRunnerExperiments({ hasFlag, getArg, env = process.env, log = console.log,
  appPolicy = () => null }) {
  // appPolicy() is the --app registry entry (or null), read lazily because
  // run.js resolves it after building this object. An app opts out of a
  // default-on tier with `uop: false` / `x87Fusion: false` in lib/apps.js.
  // --trace-loopmatch[=0xEIP]: at decode time, dump the emitted op sequence of
  // every self-loop block (or just the one at 0xEIP). Prints the block's entry,
  // op count and each (handler index, operand) -- the input the Design A matcher
  // in src/07b-loop-match.wat actually sees. See docs/loop-idiom-superops-design.md
  const TRACE_LOOPMATCH = hasFlag('trace-loopmatch') || getArg('trace-loopmatch', null) !== null;
  const TRACE_LOOPMATCH_EIP = (() => {
    const v = getArg('trace-loopmatch', null);
    return v && v !== 'true' ? (parseInt(v, 16) | 0) : 0;
  })();
  // The decode-time trace has no channel but log_i32, which lib/host-imports.js
  // gates on DBG_INV. Asking for the flag is asking for the output.
  if (TRACE_LOOPMATCH) env.DBG_INV = '1';
  // LUT_RUN is independently enabled by default; COPY_RUN remains disabled.
  // The broad legacy switch controls both, while the family switches allow a
  // useful LUT A/B without opting into COPY's historical Storm divergence.
  const LOOP_SUPEROPS = hasFlag('loop-superops');
  const NO_LOOP_SUPEROPS = hasFlag('no-loop-superops');
  const LUT_SUPEROPS = hasFlag('lut-superops');
  const NO_LUT_SUPEROPS = hasFlag('no-lut-superops');
  const COPY_SUPEROPS_ARG = hasFlag('copy-superops');
  const NO_COPY_SUPEROPS = hasFlag('no-copy-superops');
  // --block-exec: run every eligible basic block through the per-block executor
  // (H458) instead of dispatching its ops one at a time. Default OFF, decode
  // time, so it steers only blocks decoded after it is applied — which is why it
  // is set before the first batch and on every per-thread instance.
  // --block-exec-stats prints installs/declines/runs and the native-vs-fallback
  // op split at exit; that split is the migration meter, not a curiosity.
  // docs/block-executor-design.md.
  // --tree-fold named the second half of the same machine and is now an alias.
  // One round of deprecation: it still works, and it says so.
  const TREE_FOLD_ALIAS = hasFlag('tree-fold');
  if (TREE_FOLD_ALIAS) {
    log('[deprecated] --tree-fold is now --block-exec: the self-loop fold '
      + 'and the block executor are one descriptor format and one handler. '
      + 'Passing --block-exec instead does exactly this.');
  }
  const BLOCK_EXEC = hasFlag('block-exec') || TREE_FOLD_ALIAS;
  // The micro-op tier (src/07d-uop-engine.wat + 07e-uop-compiler.wat), ON by
  // default since 2026-09-28; --no-uop (or `uop: false` on the app) turns it
  // off, and --uop is accepted and a no-op. A branch target entered 256 times
  // is handed to the x86 -> micro-op lowering; a loop it accepts runs as a
  // program until it leaves. Every guest thread's instance gets it too
  // (recordInherited), each compiling into its own arena, since a program
  // names its instance's registers. docs/uop-tier-design.md.
  const uopWanted = () => !hasFlag('no-uop') && (appPolicy() || {}).uop !== false;
  // --aggressive-stack (or `aggressiveStack: true` on the app): the tier also
  // elides a push and the pop that takes it back when nothing between can
  // observe the slot, forwarding exact ESP/EBP-relative accesses to the
  // push's temp (07e $uc_sp_block). Opt-in: an elided slot is not in guest
  // memory while the pair is open. docs/uop-tier-design.md.
  const aggrWanted = () => uopWanted() && (hasFlag('aggressive-stack') || (appPolicy() || {}).aggressiveStack === true);
  // Opt-in tier widenings, each its own A/B arm (07e):
  //   --uop-muldiv  mul/imul/div/idiv r/m32 (F7 /4-/7); a divide that would
  //                 fault leaves the program at the div, threaded code raises.
  //   --uop-icall   call [reg+disp] / call [reg] / call reg (FF /2) with a
  //                 guarded inline cache of the target the slot held at
  //                 compile time; a mismatch leaves at the call.
  //   --uop-iat     call [abs] into a guest DLL, the same guard; a target in
  //                 the thunk zone stays an exit.
  const muldivWanted = () => uopWanted() && (hasFlag('uop-muldiv') || (appPolicy() || {}).uopMuldiv === true);
  const icallWanted = () => uopWanted() && (hasFlag('uop-icall') || (appPolicy() || {}).uopIcall === true);
  const iatWanted = () => uopWanted() && (hasFlag('uop-iat') || (appPolicy() || {}).uopIat === true);
  const WIDEN = [['set_uop_muldiv', muldivWanted], ['set_uop_icall', icallWanted], ['set_uop_iat', iatWanted]];
  // MMX (07e kind 27, on by default; --no-uop-mmx or `uopMmx: false` on the
  // app turns it off): MMX instructions lowered into the program over the
  // per-thread $MMX_FILE instead of declining the head.
  const mmxWanted = () => uopWanted() && !hasFlag('no-uop-mmx') && (appPolicy() || {}).uopMmx !== false;
  // --uop-mmx-fwd (off by default): MMX results forwarded op to op through
  // the engine's $q, decided at encode time (07e $uc_mmx_fwd, 07d 86-91).
  const mmxFwdWanted = () => mmxWanted() && hasFlag('uop-mmx-fwd');
  // REP MOVS/STOS as bulk COPY/FILL ops (07e kind 30, 07d 82/83; on by
  // default, --no-uop-rep turns it off and the tier declines such heads).
  const repWanted = () => uopWanted() && !hasFlag('no-uop-rep') && (appPolicy() || {}).uopRep !== false;
  // Trace heads (on by default; --no-uop-trace-heads or `uopTraceHeads: false`
  // on the app turns them off; --uop-trace-heads=MIN,MAX sets the limits): a hot
  // head with no back edge is lowered as a forward trace -- straight-line
  // code, both arms of a branch, calls and rets to an in-region call -- of
  // MIN..MAX instructions (default 8..160) instead of declined as no-backedge
  // (07e $uc_form_trace). The hotness gate is still --block-exec-walk-k.
  const UOP_TRACE_ARG = getArg('uop-trace-heads', null);
  const traceWanted = () => uopWanted() && !hasFlag('no-uop-trace-heads') &&
    (appPolicy() || {}).uopTraceHeads !== false;
  const TRACE_LIMITS = (() => {
    const [mn = '0', mx = '0'] = (UOP_TRACE_ARG && UOP_TRACE_ARG !== 'true' ? UOP_TRACE_ARG : '').split(',');
    return [parseInt(mn, 10) || 0, parseInt(mx, 10) || 0];
  })();
  // --uop-poor-work=N: the x86 instructions per entry a trace program must
  // average to escape the poor-program retirement (07d $uop_poor_check,
  // default 16; docs/uop-tier-design.md §21.1). A huge N restores the
  // blocks-only rule for traces.
  const UOP_POOR_WORK = getArg('uop-poor-work', null);
  // --no-uop-trace-cut: traces leave only through a branch again (07e
  // $uc_trace_cut; docs/uop-tier-design.md §21.3). On by default; it only
  // acts under --branch-clock.
  const NO_UOP_TRACE_CUT = hasFlag('no-uop-trace-cut');
  // --no-uop-mcopy: runs of dword mov pairs stay one LD/ST per instruction
  // instead of one MCOPY (07e $uc_mcopy_on; docs/uop-tier-design.md §21.4).
  const NO_UOP_MCOPY = hasFlag('no-uop-mcopy');
  // --no-uop-hot-sticky: a foreign head resets a hot-table slot on sight again
  // instead of wearing its count down (07c $bx_hot_sticky; §21.5).
  const NO_UOP_HOT_STICKY = hasFlag('no-uop-hot-sticky');
  // --uop-hot-age=N: halve every sticky hot count each N hot-table bumps
  // (07c $bx_hot_age; 0 = never, the section-21.5 behaviour; §22).
  const UOP_HOT_AGE = getArg('uop-hot-age', null);
  // --uop-icg-mega=N: an --uop-icall/--uop-iat site whose guard has failed N
  // times is megamorphic: programs failing there are killed and recompiled
  // without its inline cache (07d $uop_icg_mega, default 32; 0 = never; §23).
  const UOP_ICG_MEGA = getArg('uop-icg-mega', null);
  // --uop-census: log every head's verdict (installed / declined + reason),
  // every poor retirement and code-write kill with the program's counts, every
  // flush, and the live programs at exit. The records go through log_i32, so
  // this turns DBG_INV on; read them with tools/uop-census.js.
  const UOP_CENSUS = hasFlag('uop-census');
  // --uop-win-census: classify every uop window proof and re-guard by the
  // memory it landed on, and read the VirtualAlloc backing's contiguity at
  // exit (test/runner-win-census.js). Main instance only.
  const UOP_WIN_CENSUS = hasFlag('uop-win-census');
  // --uop-reguard-span=BYTES: how far a uop re-guard may grow its window
  // around the page it missed on (07d $uop_reguard_wide; default 64KB, 4096 =
  // the old one-page window). Every instance: each thread re-guards its own.
  const UOP_REGUARD_SPAN = getArg('uop-reguard-span', null);
  if (UOP_CENSUS) env.DBG_INV = '1';
  // --branch-clock: one guest-clock block per executed x86 branch, not per
  // threaded block cut ($branch_clock in 05-alu). Pass it to BOTH arms of any
  // A/B whose tier re-decodes code, or the arms run on different clocks.
  const BRANCH_CLOCK = hasFlag('branch-clock');
  // --code-write-legacy: the A/B arm for the store filter's old answer, "code
  // page bit OR inside the sparse generated-code min..max span" (04-cache
  // $code_write_legacy). Default is page-exact over the whole guest space.
  const CODE_WRITE_LEGACY = hasFlag('code-write-legacy');
  // --no-uop-nobump: turn off the page index's no-bump mark (01-header
  // PAGE_INDEX_NOBUMP) -- heads with a settled uop verdict stop counting
  // toward hotness and taken Jccs into them keep the inline fast path.
  const NO_UOP_NOBUMP = hasFlag('no-uop-nobump');
  let uopOn = false;
  const BLOCK_EXEC_STATS = hasFlag('block-exec-stats');
  // --block-chain: patch a taken direct branch's own operand word with the
  // resolved threaded-code address of its target, so every later transfer skips
  // $branch_end and $page_resolve. Default OFF; the `chain:` line at exit is the
  // counter pair the round's gate is stated against.
  // docs/block-chaining-design.md.
  // Round 19 removed the mutual exclusion with --block-exec: a chain slot holds
  // a chunk selector plus an offset inside one of the loaded page's two chunks,
  // not a delta from its own address, so a slot inside a descriptor's copied
  // terminator names its target exactly as one in the threaded stream does.
  // Both flags together is the configuration section 8 of the design doc
  // measures, and the `chain:` line's pool columns are that measurement.
  const BLOCK_CHAIN = hasFlag('block-chain');
  const BLOCK_EXEC_MIN_UOPS = parseInt(getArg('block-exec-min-uops', '0'), 10) || 0;
  // Debug ceiling. With the floor it makes the installer a one-size sieve, which
  // is how a --block-exec divergence gets bisected to a block shape.
  const BLOCK_EXEC_MAX_UOPS = parseInt(getArg('block-exec-max-uops', '0'), 10) || 0;
  const BLOCK_EXEC_TRACE = hasFlag('trace-block-exec');
  // --no-block-exec-regions: arm the one-block executor but not the multi-block
  // matcher. The two halves ride the same switch, so this is the only way to
  // attribute an app-scale change to one of them.
  const NO_BLOCK_EXEC_REGIONS = hasFlag('no-block-exec-regions');
  // --block-exec-region-max=N: the largest multi-block region the matcher may
  // install. This is the bisect knob for a divergence — a picture that differs
  // at 16 and matches at 2 names the size at which the descriptor stops being
  // right, which "regions on/off" cannot.
  const BLOCK_EXEC_REGION_MAX = parseInt(getArg('block-exec-region-max', '0'), 10) || 0;
  // --block-exec-walk-k=N / --block-exec-walk-budget=N: the two discovery knobs
  // of the round-10 CFG walker. K is how many times a block has to be branched
  // to before its region is looked for; the budget is how many blocks one such
  // look may decode. Together they are the whole decode-time cost of the
  // multi-block matcher, which is what the round-9 measurement blamed for a 2.6%
  // loss on Quake II, so they are flags rather than constants.
  const BLOCK_EXEC_WALK_K = parseInt(getArg('block-exec-walk-k', '0'), 10) || 0;
  const BLOCK_EXEC_WALK_BUDGET = parseInt(getArg('block-exec-walk-budget', '0'), 10) || 0;
  // Round 11's decode-time load/op split. ON whenever the executor is on, so the
  // only switch is the negative one -- this is the A/B partner, not an opt-in.
  const NO_BLOCK_EXEC_SPLIT = hasFlag('no-block-exec-split');
  // Round 12's x87 widening (design doc section 17). Also ON whenever the
  // executor is on, so this too is only a negative switch: it restores round 11's
  // behaviour of declining any block that holds an H188-H190 or a fused
  // H449-H453, which is the `before` arm of section 17's coverage table.
  // Round 12 lever A. OFF by default -- see section 17.5 of
  // docs/block-executor-design.md; ONE is the meaningful value here.
  const BLOCK_EXEC_X87 = hasFlag('block-exec-x87');
  // Round 16 (section 26): x87 inside a REGION MEMBER. A sub-lever of the one
  // above and ON whenever it is, so ZERO is the meaningful value here --
  // --no-block-exec-x87-regions restores round 15's one-block-only behaviour and
  // is the A/B partner every section-26 table is taken against.
  const NO_BLOCK_EXEC_X87_REGIONS = hasFlag('no-block-exec-x87-regions');
  const NO_BLOCK_EXEC_CARRY = hasFlag('no-block-exec-carry');
  const NO_BLOCK_EXEC_RMW = hasFlag('no-block-exec-rmw');
  // Round 16's one-block leaf entry point (H463, section 25). ON by default
  // inside an armed executor, so ZERO is the meaningful value: --no-block-exec-leaf
  // sends every one-block install back through the merged H458.
  const NO_BLOCK_EXEC_LEAF = hasFlag('no-block-exec-leaf');
  // Round 17's fallback-carrying leaf (H464, section 27). ON by default inside an
  // armed executor, so ZERO is the meaningful value: --no-block-exec-leaf-fb
  // sends every fallback-carrying one-block install back through H458 and
  // reproduces round 16 exactly on this build.
  const NO_BLOCK_EXEC_LEAF_FB = hasFlag('no-block-exec-leaf-fb');
  // Round 18 (design doc section 28): let a region member end in an unmodelled
  // terminator and side-exit into threaded execution there. ON within the
  // executor; this flag is the arm that reproduces round 17 exactly.
  const NO_BLOCK_EXEC_TAIL_EXITS = hasFlag('no-block-exec-tail-exits');
  // Round 17, section 27.2: headroom (in bytes) a ONE-BLOCK install must leave
  // in the per-page descriptor chunk, so a region install gets first refusal on
  // the page's last bytes. 0 (the module default) is round 16's admission test.
  const PAGE_DESC_RG_RESERVE = (() => {
    const v = getArg('page-desc-rg-reserve');
    return v == null ? null : parseInt(v, 10);
  })();
  const NO_AOE_FILL = hasFlag('no-aoe-fill');
  const NO_AOE_SPAN = hasFlag('no-aoe-span');
  // --no-mmx-fill-superops: decode UE1 SoftDrv's `movq [r],mmN / add r,8 /
  // dec c / jnz` clear as ordinary MMX blocks again (07b $try_emit_mmx_fill64).
  const NO_MMX_FILL = hasFlag('no-mmx-fill-superops');
  // --no-sib-fusion: decode indexed SIB memory operands as the unfused
  // compute_ea_sib + consumer pair. On by default in the module; this is the
  // A/B partner, so a fusion's op-count delta and its wall-clock effect can be
  // measured on one build. See docs/interpreter-dispatch-perf.md -- fewer
  // dispatches has measured ZERO more than once, so the flag is not optional.
  const NO_SIB_FUSION = hasFlag('no-sib-fusion');
  // --no-stack-fusion: PUSH/POP runs and their CALL/RET decoded one op per
  // instruction again (07-decoder.wat $try_emit_stack_run), the same-build A/B.
  const NO_STACK_FUSION = hasFlag('no-stack-fusion');
  // --no-x87-island-predecode: H451 islands run the original per-op
  // $fpu_exec_* walk instead of $x87_island_fast (07b-loop-match.wat). A
  // run-time switch, so both arms decode identically.
  const NO_X87_ISLAND_PREDECODE = hasFlag('no-x87-island-predecode');
  const NO_JUMP_TABLE = hasFlag('no-jump-table');
  const NO_RLE_RUN = hasFlag('no-rle-run');
  // Prototype folds under measurement, both off unless asked for.
  const ALU8_SIB = hasFlag('alu8-sib');
  const IMPLODE_CMP_RUN = hasFlag('implode-cmp-run');
  // --no-fold=NAME[,NAME...]: turn off any exact threaded fold by name, for the
  // fold-vs-uop-tier A/B of docs/uop-tier-design.md section 18. Folds with a
  // setter of their own map to it; the ones that had no switch share one mask
  // (07-decoder.wat $fold_off_mask). An unknown name is an error, not a no-op:
  // a typo would otherwise be an A/B of a build against itself.
  const FOLD_SETTERS = {
    'rle-run': 'set_rle_run',
    'aoe-fill': 'set_loop_aoe_fill_emit', 'aoe-span': 'set_loop_aoe_span_emit',
    'mmx-fill': 'set_loop_mmx_fill_emit', 'mmx-copy64': 'set_mmx_copy64',
  };
  const FOLD_BITS = {
    'colorkey8': 0x08, 'xlat-stosb': 0x80,
  };
  const NO_FOLDS = (getArg('no-fold', '') || '').split(',').filter(Boolean);
  for (const n of NO_FOLDS) {
    if (!FOLD_SETTERS[n] && !FOLD_BITS[n]) {
      throw new Error(`--no-fold=${n}: unknown fold; known: ${[...Object.keys(FOLD_SETTERS), ...Object.keys(FOLD_BITS)].join(',')}`);
    }
  }
  const FOLD_OFF_MASK = NO_FOLDS.reduce((m, n) => m | (FOLD_BITS[n] || 0), 0);
  const FOLD_OFF_SETTERS = NO_FOLDS.map(n => FOLD_SETTERS[n]).filter(Boolean);
  // The semantic x87 families (H449 pipeline4/short, H450 balanced tree, H451
  // island, H452/453 affine prefix+suffix) are ON by default since 2026-09-28:
  // pixel-exact on MCM and Heroes III, -4.3% user CPU on Heroes III gameplay,
  // and the Worker-mode crash (shared $OP_INDEX) is fixed. The module global
  // still defaults to 0, so the runner sets it explicitly on every instance.
  // --no-x87-fusion is the A/B partner; --x87-fusion is accepted and a no-op.
  // The match COUNTERS increment either way (the emit gate is checked after the
  // predicate), so `--loopmatch-stats` answers "how many blocks would match"
  // even with the fold off.
  const x87Wanted = () => !hasFlag('no-x87-fusion') && (appPolicy() || {}).x87Fusion !== false;
  // --x87-fuse-debug=MASK,LO,HI: with --x87-fusion, offer only the families in
  // MASK (1 pipeline4, 2 short, 4 tree4, 8 affine, 16 island) and only blocks
  // whose guest start is in [LO,HI). The bisect knob for a fold divergence.
  // Setting it clears the code cache, and block extents depend on cache history
  // (the decoder stops at any already-cached block start), which moves the
  // batch clock on timing-driven apps. So A/B a fold as MASK=0 vs MASK=31, both
  // with this flag, never as the flag against no flag.
  const X87_FUSE_DEBUG = getArg('x87-fuse-debug', '');
  // --loopmatch-stats: print the self-loop/match counts at exit.
  const LOOPMATCH_STATS = hasFlag('loopmatch-stats');
  // --tree-fold: the general decode-time integer-expression fold, H448.
  // docs/tree-fold-design-a.md. OFF by default, so this is the only way to turn
  // it on -- and, like every other decode-time gate, it has to reach every
  // per-thread instance or the A/B measures two different decoders.
  // --tree-fold-min-ops=N lowers or raises the interior-op floor (default 4).
  // --tree-fold-max-ops=N lowers or raises the ceiling (default 160, clamped in
  // WAT to the structural limit; see $TREE_FOLD_UOPS_LIMIT). The default is not
  // a throughput guess -- tools/bench-loops.js tree_len8..tree_len160 found no
  // crossover at any length -- so this exists to A/B a SHORTER cap, e.g. to ask
  // what one app's long bodies are actually contributing.
  const TREE_FOLD = BLOCK_EXEC;
  // --trace-tree-fold: dump every lowered TREE_FOLD block's classified micro-op
  // list (entry EIP, terminator, per-uop kind/dst/src/imm/handler/b) through the
  // decode-time log_i32 channel. Consumed by tools/tree-shape-census.js, which
  // joins it against a --hot-block-dump to weight each shape by hit count.
  // Implies --tree-fold, since only a lowered block writes the descriptor.
  const TRACE_TREE_FOLD = hasFlag('trace-tree-fold');
  if (TRACE_TREE_FOLD) env.DBG_INV = '1';
  const TREE_FOLD_MIN_OPS = (() => {
    const v = getArg('tree-fold-min-ops', null);
    return v === null ? null : (parseInt(v, 10) | 0);
  })();
  const TREE_FOLD_MAX_OPS = (() => {
    const v = getArg('tree-fold-max-ops', null);
    return v === null ? null : (parseInt(v, 10) | 0);
  })();

  function recordInherited(inheritWasm, { copySuperops: COPY_SUPEROPS, verbose: VERBOSE }) {
    if (TRACE_LOOPMATCH) inheritWasm('set_loop_trace', 1, TRACE_LOOPMATCH_EIP);
    if (LOOP_SUPEROPS) inheritWasm('set_loop_emit', 1);
    if (NO_LOOP_SUPEROPS) inheritWasm('set_loop_emit', 0);
    if (LUT_SUPEROPS) inheritWasm('set_loop_lut_emit', 1);
    if (NO_LUT_SUPEROPS) inheritWasm('set_loop_lut_emit', 0);
    if (COPY_SUPEROPS) inheritWasm('set_loop_copy_emit', 1);
    if (NO_COPY_SUPEROPS) inheritWasm('set_loop_copy_emit', 0);
    if (BLOCK_CHAIN) inheritWasm('set_block_chain', 1);
    if (BLOCK_CHAIN || VERBOSE) inheritWasm('set_branch_end_stats', 1);
    if (BLOCK_EXEC) inheritWasm('set_block_exec', 1);
    if (BLOCK_EXEC_MIN_UOPS) inheritWasm('set_block_exec_min_uops', BLOCK_EXEC_MIN_UOPS);
    if (BLOCK_EXEC_MAX_UOPS) inheritWasm('set_block_exec_max_uops', BLOCK_EXEC_MAX_UOPS);
    if (BLOCK_EXEC_TRACE) inheritWasm('set_block_exec_trace', 1);
    if (NO_BLOCK_EXEC_REGIONS) inheritWasm('set_block_exec_regions', 0);
    else if (BLOCK_EXEC_REGION_MAX) inheritWasm('set_block_exec_regions', BLOCK_EXEC_REGION_MAX);
    if (BLOCK_EXEC_WALK_K) inheritWasm('set_block_exec_walk_k', BLOCK_EXEC_WALK_K);
    if (BLOCK_EXEC_WALK_BUDGET) inheritWasm('set_block_exec_walk_budget', BLOCK_EXEC_WALK_BUDGET);
    if (NO_BLOCK_EXEC_SPLIT) inheritWasm('set_block_exec_split', 0);
    if (BLOCK_EXEC_X87) inheritWasm('set_block_exec_x87', 1);
    if (NO_BLOCK_EXEC_X87_REGIONS) inheritWasm('set_block_exec_x87_regions', 0);
    if (NO_BLOCK_EXEC_CARRY) inheritWasm('set_block_exec_carry', 0);
    if (NO_BLOCK_EXEC_RMW) inheritWasm('set_block_exec_rmw', 0);
    if (NO_BLOCK_EXEC_LEAF) inheritWasm('set_block_exec_leaf', 0);
    if (NO_BLOCK_EXEC_LEAF_FB) inheritWasm('set_block_exec_leaf_fb', 0);
    if (NO_BLOCK_EXEC_TAIL_EXITS) inheritWasm('set_block_exec_tail_exits', 0);
    if (PAGE_DESC_RG_RESERVE != null) {
      inheritWasm('set_page_desc_rg_reserve', PAGE_DESC_RG_RESERVE);
    }
    if (NO_AOE_FILL) inheritWasm('set_loop_aoe_fill_emit', 0);
    if (NO_AOE_SPAN) inheritWasm('set_loop_aoe_span_emit', 0);
    if (NO_MMX_FILL) inheritWasm('set_loop_mmx_fill_emit', 0);
    if (NO_SIB_FUSION) inheritWasm('set_sib_fusion', 0);
    if (NO_STACK_FUSION) inheritWasm('set_stack_fusion', 0);
    if (NO_X87_ISLAND_PREDECODE) inheritWasm('set_x87_island_predecode', 0);
    if (NO_JUMP_TABLE) inheritWasm('set_jump_table', 0);
    if (NO_RLE_RUN) inheritWasm('set_rle_run', 0);
    if (ALU8_SIB) inheritWasm('set_alu8_sib', 1);
    if (IMPLODE_CMP_RUN) inheritWasm('set_implode_cmp_run', 1);
    for (const s of FOLD_OFF_SETTERS) inheritWasm(s, 0);
    if (FOLD_OFF_MASK) inheritWasm('set_fold_off_mask', FOLD_OFF_MASK);
    if (x87Wanted()) {
      inheritWasm('set_x87_pipeline4_fusion', 1);
      inheritWasm('set_x87_affine_fusion', 1);
    }
    // The bisect mask, for the same reason as the fold flags right above it:
    // applyMain() sets it on the main instance only, and a guest thread
    // decodes in its own. Without this line --x87-fuse-debug restricts the
    // families on the one instance and leaves every thread folding under the
    // default -1 (all families, all addresses), so the arm that is supposed to
    // have the island switched off still runs islands wherever the work is.
    if (X87_FUSE_DEBUG) {
      const [mask, lo = '0', hi = '0xFFFFFFFF'] = X87_FUSE_DEBUG.split(',');
      inheritWasm('set_x87_fuse_debug', Number(mask) | 0, Number(lo) | 0, Number(hi) | 0);
    }
    if (BRANCH_CLOCK) inheritWasm('set_branch_clock', 1);
    if (CODE_WRITE_LEGACY) inheritWasm('set_code_write_legacy', 1);
    if (uopWanted()) inheritWasm('set_uop', 1);
    if (NO_UOP_NOBUMP) inheritWasm('set_uop_nobump', 0);
    if (aggrWanted()) inheritWasm('set_aggressive_stack', 1);
    inheritWasm('set_uop_trace_heads', traceWanted() ? 1 : 0);
    inheritWasm('set_uop_mmx', mmxWanted() ? 1 : 0);
    if (mmxFwdWanted()) inheritWasm('set_uop_mmxfwd', 1);
    inheritWasm('set_uop_rep', repWanted() ? 1 : 0);
    for (const [setter, wanted] of WIDEN) if (wanted()) inheritWasm(setter, 1);
    if (traceWanted()) {
      if (TRACE_LIMITS[0] || TRACE_LIMITS[1]) inheritWasm('set_uop_trace_limits', TRACE_LIMITS[0], TRACE_LIMITS[1]);
    }
    if (UOP_CENSUS) inheritWasm('set_uop_census', 1);
    if (UOP_POOR_WORK !== null) inheritWasm('set_uop_poor_work', Number(UOP_POOR_WORK) | 0);
    if (NO_UOP_TRACE_CUT) inheritWasm('set_uop_trace_cut', 0);
    if (NO_UOP_MCOPY) inheritWasm('set_uop_mcopy', 0);
    if (NO_UOP_HOT_STICKY) inheritWasm('set_uop_hot_sticky', 0);
    if (UOP_HOT_AGE !== null) inheritWasm('set_uop_hot_age', Number(UOP_HOT_AGE) | 0);
    if (UOP_ICG_MEGA !== null) inheritWasm('set_uop_icg_mega', Number(UOP_ICG_MEGA) | 0);
    if (UOP_REGUARD_SPAN !== null) inheritWasm('set_uop_reguard_span', Number(UOP_REGUARD_SPAN) | 0);
    if (TREE_FOLD || TRACE_TREE_FOLD) inheritWasm('set_tree_fold', 1);
    if (TRACE_TREE_FOLD) inheritWasm('set_tree_trace', 1);
    // The thresholds too: a guest thread decodes in its own instance, so a cap
    // set only on the main instance leaves the workers folding by a different
    // rule and the --threads arm of an A/B compares two decoders.
    if (TREE_FOLD_MIN_OPS !== null) inheritWasm('set_tree_fold_min_ops', TREE_FOLD_MIN_OPS);
    if (TREE_FOLD_MAX_OPS !== null) inheritWasm('set_tree_fold_max_ops', TREE_FOLD_MAX_OPS);

  }

  function applyMain(instance, { copySuperops: COPY_SUPEROPS, ctx = null }) {
    if (BRANCH_CLOCK && instance.exports.set_branch_clock) instance.exports.set_branch_clock(1);
    if (CODE_WRITE_LEGACY && instance.exports.set_code_write_legacy) instance.exports.set_code_write_legacy(1);
    if (NO_UOP_NOBUMP && instance.exports.set_uop_nobump) instance.exports.set_uop_nobump(0);
    if (uopWanted() && instance.exports.set_uop && ctx) {
      if (UOP_CENSUS && instance.exports.set_uop_census) instance.exports.set_uop_census(1);
      instance.exports.set_uop(1);
      if (UOP_WIN_CENSUS && instance.exports.set_uop_win_census) instance.exports.set_uop_win_census(1);
      if (UOP_REGUARD_SPAN !== null && instance.exports.set_uop_reguard_span) instance.exports.set_uop_reguard_span(Number(UOP_REGUARD_SPAN) | 0);
      if (UOP_POOR_WORK !== null && instance.exports.set_uop_poor_work) instance.exports.set_uop_poor_work(Number(UOP_POOR_WORK) | 0);
      if (NO_UOP_TRACE_CUT && instance.exports.set_uop_trace_cut) instance.exports.set_uop_trace_cut(0);
      if (NO_UOP_MCOPY && instance.exports.set_uop_mcopy) instance.exports.set_uop_mcopy(0);
      if (NO_UOP_HOT_STICKY && instance.exports.set_uop_hot_sticky) instance.exports.set_uop_hot_sticky(0);
      if (UOP_HOT_AGE !== null && instance.exports.set_uop_hot_age) instance.exports.set_uop_hot_age(Number(UOP_HOT_AGE) | 0);
      if (UOP_ICG_MEGA !== null && instance.exports.set_uop_icg_mega) instance.exports.set_uop_icg_mega(Number(UOP_ICG_MEGA) | 0);
      if (aggrWanted() && instance.exports.set_aggressive_stack) instance.exports.set_aggressive_stack(1);
      for (const [setter, wanted] of WIDEN) if (wanted() && instance.exports[setter]) instance.exports[setter](1);
      if (instance.exports.set_uop_trace_heads) instance.exports.set_uop_trace_heads(traceWanted() ? 1 : 0);
      if (instance.exports.set_uop_mmx) instance.exports.set_uop_mmx(mmxWanted() ? 1 : 0);
      if (mmxFwdWanted() && instance.exports.set_uop_mmxfwd) instance.exports.set_uop_mmxfwd(1);
      if (instance.exports.set_uop_rep) instance.exports.set_uop_rep(repWanted() ? 1 : 0);
      if (traceWanted() && instance.exports.set_uop_trace_limits) {
        if (TRACE_LIMITS[0] || TRACE_LIMITS[1]) instance.exports.set_uop_trace_limits(TRACE_LIMITS[0], TRACE_LIMITS[1]);
      }
      uopOn = true;
    }
    if (TRACE_LOOPMATCH && instance.exports.set_loop_trace) {
      instance.exports.set_loop_trace(1, TRACE_LOOPMATCH_EIP);
    }
    if (LOOP_SUPEROPS && instance.exports.set_loop_emit) {
      instance.exports.set_loop_emit(1);
    }
    if (NO_LOOP_SUPEROPS && instance.exports.set_loop_emit) {
      instance.exports.set_loop_emit(0);
    }
    if (LUT_SUPEROPS && instance.exports.set_loop_lut_emit) {
      instance.exports.set_loop_lut_emit(1);
    }
    if (NO_LUT_SUPEROPS && instance.exports.set_loop_lut_emit) {
      instance.exports.set_loop_lut_emit(0);
    }
    if (COPY_SUPEROPS && instance.exports.set_loop_copy_emit) {
      instance.exports.set_loop_copy_emit(1);
    }
    if (NO_COPY_SUPEROPS && instance.exports.set_loop_copy_emit) {
      instance.exports.set_loop_copy_emit(0);
    }
    if (BLOCK_CHAIN && instance.exports.set_block_chain) {
      instance.exports.set_block_chain(1);
    }
    if (BLOCK_EXEC && instance.exports.set_block_exec) {
      instance.exports.set_block_exec(1);
    }
    if (BLOCK_EXEC_MIN_UOPS && instance.exports.set_block_exec_min_uops) {
      instance.exports.set_block_exec_min_uops(BLOCK_EXEC_MIN_UOPS);
    }
    if (BLOCK_EXEC_MAX_UOPS && instance.exports.set_block_exec_max_uops) {
      instance.exports.set_block_exec_max_uops(BLOCK_EXEC_MAX_UOPS);
    }
    if (BLOCK_EXEC_TRACE && instance.exports.set_block_exec_trace) {
      instance.exports.set_block_exec_trace(1);
    }
    if (NO_BLOCK_EXEC_REGIONS && instance.exports.set_block_exec_regions) {
      instance.exports.set_block_exec_regions(0);
    } else if (BLOCK_EXEC_REGION_MAX && instance.exports.set_block_exec_regions) {
      instance.exports.set_block_exec_regions(BLOCK_EXEC_REGION_MAX);
    }
    if (BLOCK_EXEC_WALK_K && instance.exports.set_block_exec_walk_k) {
      instance.exports.set_block_exec_walk_k(BLOCK_EXEC_WALK_K);
    }
    if (BLOCK_EXEC_WALK_BUDGET && instance.exports.set_block_exec_walk_budget) {
      instance.exports.set_block_exec_walk_budget(BLOCK_EXEC_WALK_BUDGET);
    }
    if (NO_BLOCK_EXEC_SPLIT && instance.exports.set_block_exec_split) {
      instance.exports.set_block_exec_split(0);
    }
    if (BLOCK_EXEC_X87 && instance.exports.set_block_exec_x87) {
      instance.exports.set_block_exec_x87(1);
    }
    if (NO_BLOCK_EXEC_X87_REGIONS && instance.exports.set_block_exec_x87_regions) {
      instance.exports.set_block_exec_x87_regions(0);
    }
    if (NO_BLOCK_EXEC_CARRY && instance.exports.set_block_exec_carry) {
      instance.exports.set_block_exec_carry(0);
    }
    if (NO_BLOCK_EXEC_RMW && instance.exports.set_block_exec_rmw) {
      instance.exports.set_block_exec_rmw(0);
    }
    if (NO_BLOCK_EXEC_LEAF && instance.exports.set_block_exec_leaf) {
      instance.exports.set_block_exec_leaf(0);
    }
    if (NO_BLOCK_EXEC_LEAF_FB && instance.exports.set_block_exec_leaf_fb) {
      instance.exports.set_block_exec_leaf_fb(0);
    }
    if (NO_BLOCK_EXEC_TAIL_EXITS && instance.exports.set_block_exec_tail_exits) {
      instance.exports.set_block_exec_tail_exits(0);
    }
    if (PAGE_DESC_RG_RESERVE != null && instance.exports.set_page_desc_rg_reserve) {
      instance.exports.set_page_desc_rg_reserve(PAGE_DESC_RG_RESERVE);
    }
    if (NO_AOE_FILL && instance.exports.set_loop_aoe_fill_emit) {
      instance.exports.set_loop_aoe_fill_emit(0);
    }
    if (NO_AOE_SPAN && instance.exports.set_loop_aoe_span_emit) {
      instance.exports.set_loop_aoe_span_emit(0);
    }
    if (NO_MMX_FILL && instance.exports.set_loop_mmx_fill_emit) {
      instance.exports.set_loop_mmx_fill_emit(0);
    }
    // Per-instance, not once: worker threads are separate WASM instances over
    // one shared memory, so a mut global set only on the main instance leaves
    // every worker decoding with the other setting and makes the A/B meaningless.
    if (NO_SIB_FUSION && instance.exports.set_sib_fusion) {
      instance.exports.set_sib_fusion(0);
    }
    if (NO_STACK_FUSION && instance.exports.set_stack_fusion) {
      instance.exports.set_stack_fusion(0);
    }
    if (NO_X87_ISLAND_PREDECODE && instance.exports.set_x87_island_predecode) {
      instance.exports.set_x87_island_predecode(0);
    }
    if (NO_JUMP_TABLE && instance.exports.set_jump_table) {
      instance.exports.set_jump_table(0);
    }
    if (NO_RLE_RUN && instance.exports.set_rle_run) {
      instance.exports.set_rle_run(0);
    }
    if (ALU8_SIB && instance.exports.set_alu8_sib) instance.exports.set_alu8_sib(1);
    if (IMPLODE_CMP_RUN && instance.exports.set_implode_cmp_run) instance.exports.set_implode_cmp_run(1);
    for (const s of FOLD_OFF_SETTERS) {
      if (!instance.exports[s]) throw new Error(`--no-fold: this module has no ${s}`);
      instance.exports[s](0);
    }
    if (FOLD_OFF_MASK) instance.exports.set_fold_off_mask(FOLD_OFF_MASK);
    // Per-instance, like every other decode-time setting: a guest thread decodes
    // in its own instance, so arming only the main one would leave the workers
    // running the scalar x87 handlers and make the share unreadable.
    if (x87Wanted() && instance.exports.set_x87_pipeline4_fusion) {
      instance.exports.set_x87_pipeline4_fusion(1);
      instance.exports.set_x87_affine_fusion(1);
    }
    if (X87_FUSE_DEBUG && instance.exports.set_x87_fuse_debug) {
      const [mask, lo = '0', hi = '0xFFFFFFFF'] = X87_FUSE_DEBUG.split(',');
      instance.exports.set_x87_fuse_debug(Number(mask) | 0, Number(lo) | 0, Number(hi) | 0);
    }
    if ((TREE_FOLD || TRACE_TREE_FOLD) && instance.exports.set_tree_fold) {
      instance.exports.set_tree_fold(1);
    }
    if (TRACE_TREE_FOLD && instance.exports.set_tree_trace) {
      instance.exports.set_tree_trace(1);
    }
    // The floor applies whether or not the fold is armed: with it off, the
    // matcher still counts what it WOULD have taken, and that census is only
    // meaningful if both arms use the same threshold.
    if (TREE_FOLD_MIN_OPS !== null && instance.exports.set_tree_fold_min_ops) {
      instance.exports.set_tree_fold_min_ops(TREE_FOLD_MIN_OPS);
    }
    if (TREE_FOLD_MAX_OPS !== null && instance.exports.set_tree_fold_max_ops) {
      instance.exports.set_tree_fold_max_ops(TREE_FOLD_MAX_OPS);
    }
  }

  function report(instance, threadManager, verbose, log = console.log) {
    if (uopOn) {
      const x = instance.exports;
      if (UOP_CENSUS && x.uop_census_dump) x.uop_census_dump();
      const st = (k) => x.uop_stats(k) >>> 0;
      const cs = (k) => x.uop_cstat(k) >>> 0;
      const why = UOP_REASONS.map((name, k) => [name, k && x.uop_decline_count(k) >>> 0])
        .filter(([, n]) => n).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k}=${n}`).join(' ');
      log(`uop: installs=${st(2)} kills=${st(3)} retired-poor=${st(7)} enters=${st(4)} ` +
        `blocks=${st(5)} head-exits=${st(6)} reguards=${st(1)} rg-pages=${st(14)} rg-nonadj=${st(15)} win-kept=${st(9)} win-reset=${st(10)} gen=${st(8)} | compiled=${cs(0)} declined=${cs(1)} ` +
        `insns=${cs(2)} uops=${cs(3)} flushes=${cs(4)}` + (traceWanted() ? ` traces=${cs(26)}` : '') + (why ? `\n  declines: ${why}` : ''));
      if (muldivWanted() || icallWanted() || iatWanted()) {
        // $uop_cstat 27..30 are what the compiler kept; $uop_stats 16..20 what
        // those programs did at run time. The failing sites are the four
        // call EIPs whose guards failed most ($uop_icg_note).
        const sites = [0, 1, 2, 3].map((k) => [x.uop_icg_site(k) >>> 0, x.uop_icg_site(4 + k) >>> 0])
          .filter(([, n]) => n).map(([a, n]) => `0x${a.toString(16)}=${n}`).join(' ');
        log(`uop widen: muldiv-insns=${cs(27)} div-exits=${st(16)} | icall-sites=${cs(28)} pass=${st(17)} fail=${st(18)} | ` +
          `iat-sites=${cs(29)} pass=${st(19)} fail=${st(20)} | rejected=${cs(30)} | ` +
          `mega-sites=${st(21)} mega-kills=${st(22)} mega-refused=${cs(31)}` + (sites ? `\n  guard-fail sites: ${sites}` : ''));
      }
      if (mmxFwdWanted() && x.uop_mmxfwd_stat) {
        // compile-time counts over every program built (07e $uc_mmx_fwd)
        log(`uop mmx-fwd: operands-from-q=${x.uop_mmxfwd_stat(0) >>> 0} dead-stores=${x.uop_mmxfwd_stat(1) >>> 0} ` +
          `mxopm=${x.uop_mmxfwd_stat(2) >>> 0}`);
      }
      if (x.get_uop_nobump_skips) log(`uop nobump: skips=${x.get_uop_nobump_skips() >>> 0}`);
      if (x.uop_hot_decays) log(`uop hot: decays=${x.uop_hot_decays() >>> 0}` +
        (x.uop_hot_halvings ? ` halvings=${x.uop_hot_halvings() >>> 0}` : ''));
      if (UOP_WIN_CENSUS) require('./runner-win-census').reportWinCensus(instance, log);
      if (aggrWanted()) {
        // $uop_cstat 6..25: the aggressive-stack counters of every program
        // kept (07e $uc_sp_block). plain = pairs the conservative "nothing
        // between" rule would also elide; rescued = the rest of the elided.
        const sp = (k) => cs(6 + k);
        log(`uop stack: pushes=${sp(0)} matched=${sp(1)} elided=${sp(2)} plain=${sp(3)} rescued=${sp(4)} ` +
          `(other-slot=${sp(5)} fwd-read=${sp(6)} fwd-write=${sp(7)}) fwd-loads=${sp(8)} fwd-stores=${sp(9)} | ` +
          `materialized: unknown-addr=${sp(11)} ebp-unknown=${sp(12)} partial/rmw=${sp(13)} esp-write=${sp(14)} ` +
          `released=${sp(15)} call/ret=${sp(16)} list-full=${sp(17)} | unmatched-pops=${sp(18)} spills=${sp(19)}`);
      }
      // Each guest thread's instance has its own arena and counters, listed
      // while the thread is alive: read directly from a cooperative thread's
      // instance, or from the counters a --threads worker sends with each
      // slice result (guest-worker.js).
      for (const [handle, thread] of (threadManager && threadManager.threads) || []) {
        const tx = thread.instance && thread.instance.exports;
        const c = tx && tx.uop_stats ? [2, 3, 4, 5].map(k => tx.uop_stats(k) >>> 0) : thread.uop;
        if (!c) continue;
        // A cooperative thread's census goes out through its own log_i32,
        // tagged with its thread id by run.js.
        if (UOP_CENSUS && tx && tx.uop_census_dump) tx.uop_census_dump();
        const where = tx && tx.uop_arena ? `arena=0x${(tx.uop_arena() >>> 0).toString(16)}` : 'worker';
        // tid= is what the census records are tagged with (`[i32 TN]`), and
        // tools/uop-census.js --thread takes either it or this handle.
        log(`uop[thread 0x${(handle >>> 0).toString(16)}]: tid=${thread.tid | 0} ${where} ` +
          `installs=${c[0]} kills=${c[1]} enters=${c[2]} blocks=${c[3]}`);
      }
    }
    reportExperiments({ BLOCK_EXEC, BLOCK_EXEC_STATS, BLOCK_CHAIN, TRACE_LOOPMATCH, LOOPMATCH_STATS, X87_FUSION: x87Wanted(), VERBOSE: verbose }, instance, threadManager, log);
  }

  return { traceLoopmatch: TRACE_LOOPMATCH, uopCensus: UOP_CENSUS, copySuperopsRequested: COPY_SUPEROPS_ARG,
    noCopySuperops: NO_COPY_SUPEROPS, recordInherited, applyMain, report };
}

module.exports = { createRunnerExperiments };
