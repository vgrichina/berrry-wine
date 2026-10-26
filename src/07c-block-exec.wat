  ;; ======================================================================
  ;; 07c-block-exec.wat -- a per-BLOCK executor for every basic block.
  ;;
  ;; docs/block-executor-design.md is the design; this is the prototype it
  ;; describes. Default OFF ($block_exec_enabled), decode-time gate.
  ;;
  ;; The claim being tested, from docs/dispatch-attribution-2026-09.md: the
  ;; per-op `call_indirect` is 18-19% of guest CPU and the $get_reg/$set_reg
  ;; br_table register file another 8-12%, on three apps whose blocks are 3.5,
  ;; 4.3 and 7.0 ops long. Holding the eight GPRs in wasm LOCALS for the length
  ;; of one block deletes the second outright and most of the first, and
  ;; docs/region-descriptor-bench-2026-09.md measured that mechanism at
  ;; +29..46% on straight-line blocks of 2 to 32 ops with no crossover.
  ;;
  ;; Two structural decisions, both argued in the design doc:
  ;;
  ;;   1. THE TERMINATOR STAYS THREADED. The descriptor covers ops [0, n-1) and
  ;;      the block's real terminator is re-emitted after it, untouched. That
  ;;      keeps $decode_run's fall-through adjacency alive (it reads the last
  ;;      OP_INDEX entry and requires optr + 16 == d_block_end), keeps
  ;;      $page_retire_at's 8-byte stamp landing on the block's first op, and
  ;;      means call/ret/loop/jecxz/far-jmp/H404/H407 need no executor code at
  ;;      all. Cost: one dispatch per block. A block of N ops goes N -> 2.
  ;;
  ;;   2. UNIMPLEMENTED OPS RUN THE REAL HANDLER. Registers spill to the
  ;;      globals, the handler is called, the registers reload. Every $th_* ends
  ;;      in `return_call $next`, so the copied words are followed by an op
  ;;      naming $th_bx_resume (H459), whose empty body returns -- and because
  ;;      the whole chain is tail calls, that return lands back in THIS frame.
  ;;      The fallback share is the migration progress meter.
  ;;
  ;; The micro-op encoding is H454's ($TU_* in 07b-loop-match.wat) and so is the
  ;; classifier ($tree_uop_classify). There is one encoding and one classifier;
  ;; what this file adds is a second EXECUTOR, which exists only because a wasm
  ;; local cannot cross a function boundary -- the exact property the design
  ;; exploits. See OPEN-2 in the design doc.
  ;; ======================================================================

  ;; Decode-time gate. OFF, and no app path sets it.
  (global $block_exec_enabled (mut i32) (i32.const 0))
  ;; Below this many body micro-ops the H458 dispatch is not repaid. Argued,
  ;; not measured -- OPEN-8.
  ;; The install FLOOR, and it is a measured crossover, not a taste. A
  ;; descriptor pays a fixed entry/exit cost (park $steps, run the loop, publish
  ;; eight GPRs and $ea_temp, recompute $steps) against a saving that is
  ;; per-micro-op, so it only wins once the block is long enough. From
  ;; `tools/bench-loops.js --toggle=block_exec` (7 interleaved reps, minima):
  ;; blk2 -1.9%, blk4 +4.7%, blk8 -0.9%, blk16 +22.0%, blk32 +36.2%. Heroes II
  ;; at a floor of 2 is a *resolved loss* of 0.36s on 3.08s (its blocks are
  ;; short and 37% of its ops fall back); at 12 the same A/B is unresolvable,
  ;; and MW3 at 12 is a resolved gain of 0.40s on 8.54s. Lower it with
  ;; --block-exec-min-uops for a correctness sweep, where coverage is the point.
  ;; 0 means "decide with the cost model" (the default). A nonzero value is the
  ;; old hard uop-count floor, kept verbatim so every A/B command already
  ;; written down keeps meaning what it meant.
  (global $block_exec_min_uops (mut i32) (i32.const 0))
  ;; A DEBUG knob, 0 = no ceiling. Paired with the floor above it turns the
  ;; installer into a one-size sieve, which is how a divergence gets bisected
  ;; down to a single block shape without an instrumented build: walk the
  ;; window until the app breaks, then log the entry EIPs inside it. Quake II's
  ;; 8-uop blocks were found this way.
  (global $block_exec_max_uops (mut i32) (i32.const 0))
  ;; --trace-block-exec: log every installed descriptor as
  ;;   0xBE000000, entry_eip, nuops, then (kind, original handler, d, b)
  ;; per uop. Round 11 added the last two words because the split form is not
  ;; readable without them: a split memory op becomes a load into a temp lane
  ;; plus a register op reading it, and which lane that is lives in `d` and in
  ;; the TU_B_SRC0 field of `b`. A handler index of -1 marks the load half,
  ;; which no original x86 handler corresponds to.
  ;; The marker word is there so the stream survives being interleaved with
  ;; every other $host_log_i32 caller. Pair it with the min/max sieve above:
  ;; the two together name the exact block behind a divergence, and finding
  ;; one without them means reading a 3000-batch trace instead.
  (global $block_exec_trace (mut i32) (i32.const 0))

  ;; Meters. The native/fallback split is the fraction of the 19-23% ceiling
  ;; collected so far, per app, and names the opcode to migrate next.
  (global $block_exec_installs (mut i32) (i32.const 0))
  (global $block_exec_declines (mut i32) (i32.const 0))
  (global $block_exec_runs (mut i32) (i32.const 0))
  (global $block_exec_native_ops (mut i64) (i64.const 0))
  (global $block_exec_fallback_ops (mut i64) (i64.const 0))
  ;; Interior block edges the region did not have to take. Together with the
  ;; run count this is the whole cost model -- ns/entry against ns/op -- and it
  ;; is the one term no histogram can recover, because a folded edge leaves no
  ;; trace anywhere else.
  (global $block_exec_transfers_saved (mut i64) (i64.const 0))
  ;; One sample, not a histogram: the handler index of the most recent op that
  ;; had to take the fallback. Enough to name the family to widen first.
  (global $block_exec_last_fallback_fn (mut i32) (i32.const -1))
  ;; Why the most recent block declined. 1 too short, 2 poisoned/16-bit/fault,
  ;; 3 an unsafe op in the body, 4 past the emit slack, 5 past the scratch.
  (global $block_exec_decl_why (mut i32) (i32.const 0))

  (global $BX_HANDLER i32 (i32.const 458))
  (global $BX_RESUME_HANDLER i32 (i32.const 459))
  ;; ROUND 16 (section 25): the one-block leaf. A descriptor that is one block,
  ;; ends in a threaded tail and holds neither a TU_FALLBACK nor a TU_X87RUN is
  ;; emitted under THIS handler instead, and runs in $th_block_exec_leaf, which
  ;; carries none of the region machinery. The descriptor bytes are identical
  ;; either way -- only the first word of the stream differs -- so every reader
  ;; of a descriptor (the page publisher, the saved-stream walk, the region
  ;; builder) asks $bx_is_desc_word rather than comparing against one constant.
  (global $BX_LEAF_HANDLER i32 (i32.const 463))
  ;; The A/B switch. ON by default *within* the executor: with
  ;; $block_exec_enabled 0 nothing installs at all, so this global is inert
  ;; unless the family is already armed. `--no-block-exec-leaf` is the arm that
  ;; sends every one-block install back through $th_block_exec.
  (global $block_exec_leaf (mut i32) (i32.const 1))
  ;; Entries that took the leaf, against $block_exec_runs (every entry). The
  ;; difference is the region/fallback/folded-terminator population, which is
  ;; the split section 25 reports per window.
  (global $block_exec_leaf_runs (mut i32) (i32.const 0))
  ;; ROUND 17 (section 27): the SECOND leaf. Same contract as H463 except that
  ;; it may carry TU_FALLBACK and TU_X87RUN micro-ops, which section 25.3
  ;; measured at 73% of executor entries on both real windows. A separate
  ;; function rather than an arm on H463, so the pure leaf's code size and
  ;; indirect-site count -- the two things section 25 attributed its win to --
  ;; are untouched by construction.
  (global $BX_LEAFFB_HANDLER i32 (i32.const 464))
  ;; Its own A/B switch, ON by default within the executor, and meaningless
  ;; with $block_exec_leaf off: `--no-block-exec-leaf` already sends every
  ;; one-block install back to $th_block_exec, and this narrows that to "only
  ;; the fallback-carrying ones". `--no-block-exec-leaf-fb` is the arm.
  (global $block_exec_leaf_fb (mut i32) (i32.const 1))
  (global $block_exec_leaf_fb_runs (mut i32) (i32.const 0))

  ;; ======================================================================
  ;; ROUND 18 (section 28): THE UNMODELLED-TERMINATOR SIDE EXIT.
  ;; ======================================================================
  ;; `termNotModelled` -- a block ending in a call, a ret, an indirect branch,
  ;; a `loop`/`jecxz`, an int, a far jump, or one of the fused Jcc forms the
  ;; classifier will not read -- was the top classify refusal in five of six
  ;; apps (section 14.2). Such a block was not a member at all, so its BODY --
  ;; which is ordinary code the executor can run perfectly well -- was left on
  ;; the threaded path together with its terminator, and the region stopped at
  ;; the edge into it.
  ;;
  ;; This admits it as a member with `term_kind 10`: the body runs natively
  ;; like any other member's, and then the member SIDE-EXITS into threaded
  ;; execution at its OWN terminator -- publish all eight, `$ip <- this
  ;; member's tail`, `return_call $next` -- exactly as the one-block
  ;; `term_kind 5` path does. Nothing about call/ret semantics is modelled.
  ;;
  ;; Section 14.6 said this "needs a per-block tail pointer first", because
  ;; `$tail_ip` is one value derived from the descriptor header. The per-member
  ;; pointer costs NO new descriptor words: a `term_kind 10` member evaluates
  ;; no condition and has no in-region successor, so `term_a`/`term_b`/
  ;; `term_uop`/`term_imm`/`term_cc`/`succ_taken`/`succ_fall` are all dead for
  ;; it. `term_imm` (record word 7) carries the BYTE OFFSET of this member's
  ;; copied terminator within the descriptor's fallback pool, and the executor
  ;; reads `tail = $fbp + term_imm`. $REGION_BLOCK_WORDS is unchanged, every
  ;; existing descriptor is byte-identical, and the single-`$tail_ip` fast path
  ;; is untouched for a region that has no such member.
  ;;
  ;; A `term_kind 10` member is a DEAD END in the region graph: it has zero
  ;; interior successors. A call's fall-through is deliberately not one -- the
  ;; callee runs threaded and returns to call+5 through `$branch_end`, which
  ;; re-enters the page index like any other transfer, and (since round 13) a
  ;; region's index footprint is its HEAD BLOCK ONLY, so call+5 keeps its own
  ;; entry and nothing about the return retires the region. Re-entering the
  ;; region means re-entering at the head, as it does for every other exit.
  ;;
  ;; The A/B switch, ON within the executor; `--no-block-exec-tail-exits` is
  ;; the arm that reproduces round 17 exactly on this build.
  (global $block_exec_tail_exits (mut i32) (i32.const 1))
  ;; term_kind 10 members in the region currently being built. Reset with the
  ;; rest of the builder state in $bx_walk_once.
  (global $bx_rg_tail_n (mut i32) (i32.const 0))
  ;; ---- the census (section 28.1), which ran BEFORE the executor change ----
  ;; Classify refusals with reason 4 (termNotModelled) seen during the walk in
  ;; progress. Reset per walk; $bx_rg_nofit bumps it.
  (global $bx_rg_tailref (mut i32) (i32.const 0))
  ;; Walks that declined for `shortChain` (fewer than two members) but whose
  ;; member count PLUS the blocks refused for termNotModelled would have been
  ;; two or more. This is the upper bound on regions the side exit can add --
  ;; upper, because it assumes every such block would also have passed the
  ;; body scan, the uop caps and the cost model.
  (global $bx_rg_tail_would_admit (mut i32) (i32.const 0))
  ;; Walks that DID install and had at least one termNotModelled refusal: the
  ;; regions that would have grown rather than the ones that would have
  ;; appeared.
  (global $bx_rg_tail_would_grow (mut i32) (i32.const 0))
  ;; Total termNotModelled refusals seen inside a walk, and how many of those
  ;; were actually admitted as term_kind 10 members.
  (global $bx_rg_tail_refusals (mut i64) (i64.const 0))
  (global $bx_rg_tail_admitted (mut i64) (i64.const 0))
  ;; Installed regions carrying at least one, and the member total across them.
  (global $bx_rg_tail_regions (mut i32) (i32.const 0))
  (global $bx_rg_tail_members (mut i32) (i32.const 0))
  ;; Why an admission was refused after the terminator was accepted in
  ;; principle: 1 the switch is off, 2 the published stream could not be read,
  ;; 3 the terminator's byte length is not in [8,64], 4 the pool is full.
  (global $bx_rg_tail_norm (mut i32) (i32.const 0))
  ;; RUNTIME: side exits actually taken through an unmodelled terminator.
  (global $block_exec_tail_exit_runs (mut i32) (i32.const 0))
  ;; ROUND 19 (docs/block-chaining-design.md section 8): every executor exit
  ;; that leaves through a COPIED TERMINATOR -- term_kind 5 in all three
  ;; handlers plus round 18's per-member term_kind 10 -- as opposed to a
  ;; modelled side exit, which sets $eip and goes to $branch_end with no
  ;; threaded tail at all. It is the denominator of "what share of executor
  ;; exits did block chaining claim": the numerator is $chain_hits_pool, since
  ;; a chain slot in a descriptor chunk can only be one of these tails.
  (global $block_exec_tail_exit_count (mut i64) (i64.const 0))
  ;; ROUND 19, and the reason the round's executor-exit gate is stated against
  ;; TWO denominators rather than one: the subset of those tails whose copied
  ;; terminator is a handler that HAS a chain slot -- H43 ($th_jmp) and the
  ;; specialised Jcc forms H307..H322. Every other terminator (ret, call, the
  ;; generic $th_jcc whose operand word is its condition code, $th_block_end,
  ;; loop/jecxz, an indirect jump) reaches $branch_end with $patch_at 0 and
  ;; cannot be chained by any widening of the anchor rule, because there is no
  ;; spare word to write the answer in. Measured, not assumed: round 18's
  ;; term_kind 10 exists precisely to admit blocks ending in the UNMODELLED
  ;; terminators, so an executor arm's tails are biased towards the
  ;; unchainable kinds by construction.
  (global $block_exec_tail_chainable (mut i64) (i64.const 0))

  ;; One executor exit through a copied terminator. $tail_ip points at that
  ;; copy's {handler, operand} pair, and the handler index is the first word --
  ;; the same word $next loads -- so classifying the tail costs one load on an
  ;; exit that is already about to take a mispredicted indirect branch.
  (func $bx_tail_note (param $tail_ip i32)
    (local $fn i32)
    (global.set $block_exec_tail_exit_count
      (i64.add (global.get $block_exec_tail_exit_count) (i64.const 1)))
    (local.set $fn (i32.load (local.get $tail_ip)))
    (if (i32.or
          (i32.eq (local.get $fn) (i32.const 43))
          (i32.and (i32.ge_u (local.get $fn) (i32.const 307))
                   (i32.le_u (local.get $fn) (i32.const 322))))
      (then (global.set $block_exec_tail_chainable
              (i64.add (global.get $block_exec_tail_chainable) (i64.const 1))))))

  (global $BX_UOP_WORDS i32 (i32.const 6))
  (global $BX_HEADER_WORDS i32 (i32.const 4))

  ;; Micro-op kinds are the $TU_* space from 07b-loop-match.wat, used
  ;; directly -- there is no second, denser numbering any more. What this file
  ;; adds are the four kinds the loop matcher never needed, appended above
  ;; 07b's last kind (53) so both matchers emit into one vocabulary.
  (global $TU_PUSH_R   i32 (i32.const 54))  ;; [--esp] = R[d]
  (global $TU_POP_R    i32 (i32.const 55))  ;; R[d] = [esp++]
  (global $TU_PUSH_I   i32 (i32.const 56))  ;; [--esp] = imm
  ;; The escape hatch: run the op's real handler with the register file
  ;; spilled and reloaded around it. `a` is the handler index, `imm` its operand
  ;; word, `b` the byte offset of its inline words in the trailing fallback
  ;; pool. One of these costs far more than a threaded dispatch, so the install
  ;; cost model prices them explicitly rather than counting them as coverage.
  (global $TU_FALLBACK i32 (i32.const 57))
  ;; 58 and 59 are $TU_CMP_RR / $TU_CMP_RI, declared in 07b beside the rest of
  ;; the shared vocabulary because the classifier emits them.
  ;;
  ;; ROUND 15 (design doc section 24). A FUSED x87 run -- one of H449..H453 --
  ;; as a native micro-op instead of a TU_FALLBACK. `a` is the fused handler
  ;; index, `imm` its packed operand word, `b` the byte offset of its inline
  ;; words in the trailing pool, and `d` the 8-bit mask of general registers
  ;; the run READS (computed at install time by $x87_run_reads, or by the
  ;; island walk). It differs from TU_FALLBACK in three ways, all of them the
  ;; point:
  ;;
  ;;   * it calls the fused BODY (07b's $x87_run_body) rather than the thread
  ;;     table's wrapper, so there is no `return_call $next`, no H459 resume
  ;;     handler and no second indirect dispatch;
  ;;   * it publishes only the registers in `d` and reloads NONE, because no
  ;;     fused x87 body writes a general register (proved family by family in
  ;;     section 24.1) -- against eight stores and eight loads;
  ;;   * it is priced at $BX_C_X87RUN rather than $BX_C_X87FB.
  ;;
  ;; `d` therefore does NOT name a destination register here. That is safe
  ;; because $bx_mem_shape gives this kind shape 3 -- the "not modelled" shape
  ;; -- and the optimisation pass's walk 1 leaves on shape 3 before it ever
  ;; reads `d`, while the executor arm clears $wrote so the writeback br_table
  ;; never runs. Both are asserted by test-block-exec.js rather than left to
  ;; the reading.
  (global $TU_X87RUN   i32 (i32.const 60))
  (global $TU_MAX_KIND i32 (i32.const 60))

  ;; ======================================================================
  ;; ROUND 11 -- the decode-time load/op split (design doc section 16)
  ;; ======================================================================

  ;; The pass itself, ON whenever the executor is on. --no-block-exec-split is
  ;; the A/B partner; it is a per-instance mutable global like every other
  ;; toggle in this family and is in INHERITED_WASM_GLOBALS.
  (global $block_exec_split (mut i32) (i32.const 1))

  ;; ROUND 12 (OPEN-6) -- may a block hold an x87 op? OFF, opt in with
  ;; --block-exec-x87. It shipped ON and was turned off by its own
  ;; re-measurement on the finished round-12 build (section 17.5): with the
  ;; cross-edge carry and the RMW split in place it LOSES coverage on
  ;; quake2-gameplay (installs 59448 -> 52749, transfersSaved 3.29M -> 2.51M,
  ;; native% 97.63 -> 97.59) and changes nothing at all on mw3-gameplay. Zero is
  ;; therefore round 11's blanket decline, and one is the arm to measure.
  ;; Per-instance mutable and in INHERITED_WASM_GLOBALS like every other toggle.
  (global $block_exec_x87 (mut i32) (i32.const 0))
  ;; ROUND 16 (section 26) -- may a REGION MEMBER hold an x87 op? This is a
  ;; sub-lever of $block_exec_x87 and is meaningless without it: it defaults ON
  ;; so that --block-exec-x87 means "x87 everywhere the executor goes", and
  ;; --no-block-exec-x87-regions is its A/B partner, which is what makes the
  ;; round-15 behaviour (one-block only) reproducible on this build.
  (global $block_exec_x87_regions (mut i32) (i32.const 1))

  ;; Temp lanes. Register indices 8..14, held in seven wasm locals inside
  ;; $th_block_exec. 15 is still "absent", which is what caps this at seven.
  (global $BX_LANE0    i32 (i32.const 8))
  (global $BX_LANE_N   i32 (i32.const 7))
  (global $BX_LANE_END i32 (i32.const 15))   ;; one past the last lane

  ;; Decode-time meters for the pass. uopsBefore/uopsAfter are the two numbers
  ;; section 16.6's table is built from; the four transform counters say WHICH
  ;; rewrite did it, because "the pass removed 3%" with no breakdown cannot be
  ;; compared against section 8's per-transform prediction at all.
  (global $bx_pass_uops_before (mut i64) (i64.const 0))
  (global $bx_pass_uops_after  (mut i64) (i64.const 0))
  (global $bx_pass_split       (mut i64) (i64.const 0))
  (global $bx_pass_rle         (mut i64) (i64.const 0))
  (global $bx_pass_stlf        (mut i64) (i64.const 0))
  (global $bx_pass_movelim     (mut i64) (i64.const 0))
  (global $bx_pass_immfold     (mut i64) (i64.const 0))
  ;; Round 12 (OPEN-6): x87 micro-ops the classifier accepted as fallbacks
  ;; rather than declining the whole block over. One per FUSED region or per
  ;; bare x87 op, so it is a count of descriptor entries, not of guest x87
  ;; instructions.
  (global $bx_x87_uops         (mut i64) (i64.const 0))
  ;; Round 15 (section 24): of those, how many are the CHEAP kind -- a fused
  ;; run that went in as TU_X87RUN. `x87 - x87run` is the residue still paying
  ;; the trampoline: a bare op the native classifier declined, or an island
  ;; carrying a form $fpu_exec_* does not implement.
  (global $bx_x87run_uops      (mut i64) (i64.const 0))
  ;; And how many bare H188..H190 went in as one of 07b's own native x87 kinds
  ;; (TU_X87_MEM / _MRO / _REG / _SW_AX) rather than as a fallback. Those are
  ;; real dispatches saved and DO bump $nat, which is why they are counted
  ;; apart from the two above.
  (global $bx_x87_native_uops  (mut i64) (i64.const 0))
  ;; Round 12 (section 18): redundant loads eliminated ONLY because a fact was
  ;; carried across a region edge. It is a strict subset of $bx_pass_rle -- the
  ;; carry pass bumps both -- so `rle - carryRle` is what a block-local pass
  ;; would have found on its own.
  (global $bx_pass_carry_rle   (mut i64) (i64.const 0))
  ;; Region edges the carry was actually taken along, and the ones it was
  ;; refused on. The refusal count is the interesting half: it is the measure of
  ;; how much of §16.2's permission the single-predecessor rule reaches.
  (global $bx_carry_edges      (mut i64) (i64.const 0))
  (global $bx_carry_refused    (mut i64) (i64.const 0))
  ;; ON whenever the executor is on; --no-block-exec-carry is the A/B partner
  ;; the section-18 table is measured with.
  (global $block_exec_carry (mut i32) (i32.const 1))
  ;; Round 12 lever C: the read-modify-write store split. ON with the executor;
  ;; --no-block-exec-rmw is its A/B partner.
  (global $block_exec_rmw   (mut i32) (i32.const 1))
  (global $bx_pass_rmw      (mut i64) (i64.const 0))

  ;; ---- the fact table --------------------------------------------------
  ;; Up to $BX_FACT_MAX live memory facts for the straight-line stretch being
  ;; walked. One fact is six words:
  ;;   0 valid      1 = live
  ;;   1 base       register index, 0xF = none (absolute)
  ;;   2 idx        register index, 0xF = none
  ;;   3 scale      0..3, the shift amount
  ;;   4 disp       displacement, or the absolute address
  ;;   5 width      bytes
  ;;   6 val_reg    where the value is: an architectural register or a lane
  ;;   7 def_kind   -1 when the fact came from a STORE; otherwise the micro-op
  ;;                KIND of the load that made it. A load fact matches only a
  ;;                load of the same kind, because `movzx` and `movsx` of one
  ;;                byte are the same access and two different values, and
  ;;                nothing else in the record distinguishes them.
  ;; Eight words so the index arithmetic is a shift. It lives in the tail of
  ;; $BX_RG_BASE, which is 32 KB and had 25 KB spare -- the pass runs entirely
  ;; inside one classify call and never overlaps the region builder's own use
  ;; of the front of that region.
  (global $BX_FACT_MAX i32 (i32.const 16))
  (global $bx_fact_n (mut i32) (i32.const 0))
  ;; The constant table, for transform (e). Fifteen {valid, value} pairs, one
  ;; per architectural register and temp lane, tracking "this register holds a
  ;; known immediate right here". It exists only so that a forwarded load whose
  ;; source is a constant becomes TU_MOV_RI rather than TU_MOV_RR -- which is
  ;; the one place immediate folding genuinely falls out of forwarding, and
  ;; costs a table rather than a dataflow.
  (global $BX_CONST_N i32 (i32.const 15))
  ;; Scratch for the walk, so the helpers below can be plain functions.
  (global $bx_opt_term_pos (mut i32) (i32.const 0))
  (global $bx_lane_next (mut i32) (i32.const 0))
  ;; ROUND 12 (section 18). The register the FOLDED terminator writes, or -1.
  ;; The terminator is not a micro-op in the list -- it was lifted out -- so
  ;; walk 1 has to be told, and it is the one thing that can invalidate a fact
  ;; at a region edge as well as inside a block. term_kind 0 (inc/dec),
  ;; 8 (`alu r,r`) and 9 (`alu r,imm32`) write `term_a`; every other kind
  ;; writes nothing but flags.
  (global $bx_opt_term_wreg (mut i32) (i32.const -1))
  ;; 1 while $bx_rg_carry_pass is re-walking a member, so an `rle` hit can be
  ;; attributed to the carry rather than to the block-local pass.
  (global $bx_opt_carry_mode (mut i32) (i32.const 0))

  ;; ----------------------------------------------------------------------
  ;; Decode-time helpers
  ;; ----------------------------------------------------------------------

  ;; "This handler ends a block, or can set $eip." Such an op is legal as the
  ;; block's TERMINATOR (which stays threaded and is never our problem) and is
  ;; a hard decline anywhere in the body, because the executor resumes at the
  ;; next micro-op unconditionally and would run past a taken branch.
  ;;
  ;; Handlers that merely set $yield_flag / $yield_reason are NOT here: the
  ;; threaded path does not stop for them between two ops of one block either,
  ;; so excluding them would make the two arms differ rather than agree.
  (func $bx_op_unsafe (param $fn i32) (result i32)
    ;; CALL / RET / JMP / Jcc / $th_block_end / LOOP
    (if (i32.and (i32.ge_u (local.get $fn) (i32.const 39))
                 (i32.le_u (local.get $fn) (i32.const 46)))
      (then (return (i32.const 1))))
    ;; the sixteen specialised Jcc
    (if (i32.and (i32.ge_u (local.get $fn) (i32.const 307))
                 (i32.le_u (local.get $fn) (i32.const 322)))
      (then (return (i32.const 1))))
    ;; fused terminators and the storm bitreader
    (if (i32.and (i32.ge_u (local.get $fn) (i32.const 391))
                 (i32.le_u (local.get $fn) (i32.const 396)))
      (then (return (i32.const 1))))
    ;; Every loop/region super-op -- 418 and up is where the folds live, and a
    ;; fold runs a whole loop and lands EIP wherever the loop exits.
    ;;
    ;; Two ordinary handlers were shelved in that range as it grew, and they
    ;; are ORDINARY: H420 is a plain `MOV [base+idx*s+disp], r32` the decoder
    ;; emits from a single instruction, and H421 is the two-instruction
    ;; load/store pair fused. Neither touches EIP. Excluding them cost more
    ;; than it sounds: a dword SIB store is the write half of nearly every
    ;; indexed loop body, so the blanket declined the exact blocks this
    ;; executor exists for. Anything else new above 418 must be added here
    ;; deliberately, which is the right default for a range whose meaning is
    ;; "a fold unless stated otherwise".
    ;; H467/H468 are the packed-displacement twins of H26/H27: one plain
    ;; dword load or store each, disp in the operand word, no EIP.
    (if (i32.and (i32.ge_u (local.get $fn) (i32.const 418))
                 (i32.eqz (i32.or (i32.or (i32.eq (local.get $fn) (i32.const 420))
                                          (i32.eq (local.get $fn) (i32.const 421)))
                                  (i32.or (i32.eq (local.get $fn) (i32.const 467))
                                          (i32.eq (local.get $fn) (i32.const 468))))))
      (then (return (i32.const 1))))
    ;; The three x87 handlers, 188..190. Not because they set $eip -- they do
    ;; not -- but because the x87 fusers ($x87_fuse_block and friends) run
    ;; AFTER this matcher and rewrite an op IN PLACE, leaving the ops it
    ;; absorbed in the stream as inline data with stale OP_INDEX entries. A
    ;; block claimed here never reaches them, so an x87 block would silently
    ;; lose its fusion AND take the expensive fallback for every one of its
    ;; x87 ops. Standing down is both correct and faster. Widening the
    ;; executor to the x87 micro-op kinds H454 already has is OPEN-6.
    (if (i32.and (i32.ge_u (local.get $fn) (i32.const 188))
                 (i32.le_u (local.get $fn) (i32.const 190)))
      (then (return (i32.const 1))))
    (i32.or
      (i32.or
        (i32.or (i32.eq (local.get $fn) (i32.const 120))
                (i32.eq (local.get $fn) (i32.const 125)))
        (i32.or (i32.eq (local.get $fn) (i32.const 141))
                (i32.eq (local.get $fn) (i32.const 216))))
      (i32.or
        (i32.or
          (i32.or (i32.eq (local.get $fn) (i32.const 355))
                  (i32.eq (local.get $fn) (i32.const 361)))
          (i32.or (i32.eq (local.get $fn) (i32.const 368))
                  (i32.eq (local.get $fn) (i32.const 370))))
        (i32.or
          (i32.or (i32.eq (local.get $fn) (i32.const 381))
                  (i32.eq (local.get $fn) (i32.const 382)))
          (i32.or (i32.eq (local.get $fn) (i32.const 404))
                  (i32.eq (local.get $fn) (i32.const 407)))))))


  ;; ----------------------------------------------------------------------
  ;; Cost model (OPEN-7). The install decision used to be "does this block have
  ;; at least N micro-ops", a proxy that gets the two things that actually
  ;; matter backwards: a fallback micro-op is SLOWER than the threaded op it
  ;; replaces (a spill and reload of the whole register file around an indirect
  ;; call), and a folded interior edge is worth more than a micro-op. Counting
  ;; uops charges nothing for the first and credits nothing for the second.
  ;;
  ;; So price it instead, in nanoseconds, from numbers the bench measured:
  ;; a threaded micro-op is ~38ns and the same op inside the executor ~22ns
  ;; (docs/region-descriptor-bench-2026-09.md section 4), and a block transfer
  ;; is ~9ns on top of its dispatch (tools/bench-loops.js nop_chain/jmp_chain).
  ;; Every term is known at decode time.
  ;;
  ;; $BX_C_ENTRY is calibrated, not measured: it is set so that the plain
  ;; one-block no-fallback case -- the only shape with an empirical answer --
  ;; reproduces the floor of 12 that docs/block-executor-design.md OPEN-8
  ;; settled by bisection. Anything the microbench cannot see about entry cost
  ;; (the eight register materializations, the header parse, the extra live
  ;; range V8 has to allocate) is therefore inside this one number.
  ;; Entry cost in ns. Calibrated against tools/bench-loops.js on the MERGED
  ;; executor, not the pre-merge one: at 100 (breakeven ~7 native uops) the
  ;; 9-uop shapes install and LOSE -3.2% (blk8), -12.2% (blk_mem8), -8.5%
  ;; (blk_fb8), while blk16 wins +5.7% and blk32 +19.4%. So the real breakeven
  ;; sits between 9 and 16 native uops; 190/16 = 11.9 lands inside that window
  ;; and declines exactly the shapes that measured as losses.
  (global $BX_C_ENTRY    i32 (i32.const 190))
  (global $BX_C_UOP      i32 (i32.const 16))
  (global $BX_C_TRANSFER i32 (i32.const 9))
  (global $BX_C_FALLBACK i32 (i32.const 20))

  ;; An x87 micro-op is a fallback like any other -- but it is the only fallback
  ;; the executor admits that BUYS NOTHING, because $nat is deliberately not
  ;; bumped for it (section 17): the x87 body still runs through its real
  ;; handler, so the descriptor saves no dispatch there and pays the spill,
  ;; the resume trampoline and the reload on top. Pricing it at $BX_C_FALLBACK
  ;; measured as a LOSS: tools/bench-loops.js --shapes=blk_x87mix, a 5-op block
  ;; with an fld/fstp pair in it, installs at 20 and runs -62.0% slower than the
  ;; same block left to the threaded interpreter (250k iterations, minima, same
  ;; process). The extra wall time was ~42ns per x87 micro-op against the ~16ns
  ;; ($BX_C_UOP) a native micro-op saves, so this is set to about six native
  ;; uops' worth: enough that an x87-DENSE block declines, while a long integer
  ;; block carrying one stray x87 op still installs.
  (global $BX_C_X87FB    i32 (i32.const 96))
  ;; ROUND 15 (section 24). A fused x87 run that went in as TU_X87RUN. It is
  ;; still worth nothing on the BENEFIT side -- the fold already made the run
  ;; one dispatch, so the executor saves zero of them and $nat is not bumped --
  ;; but it no longer costs a trampoline either, so it must not be priced like
  ;; one. Set from tools/bench-loops.js --shapes=blk_x87mix,blk_x87long,
  ;; blk_x87sw --toggle=block_exec_x87 (section 24.3); see that table before
  ;; changing it.
  (global $BX_C_X87RUN   i32 (i32.const 16))

  ;; Where the descriptor is BUILT. Writing it forward from $tstart would
  ;; overwrite the very ops still being read -- a 24-byte micro-op over an
  ;; 8-byte op clobbers on the third instruction -- so it is assembled in the
  ;; far half of OP_INDEX (the same scratch $loop_try_tree_fold uses, and never
  ;; at the same time) and copied out once the whole block has been accepted.
  ;;
  ;; That half is split again: micro-ops forward from the bottom, the fallback
  ;; pool forward from the middle. Two cursors rather than one because the pool
  ;; is variable-length and the micro-op array must not be.
  (func $bx_scratch (result i32)
    (i32.add (global.get $OP_INDEX) (i32.shr_u (global.get $OP_INDEX_SLICE) (i32.const 1))))
  (func $bx_scratch_words (result i32)
    (i32.shr_u (global.get $OP_INDEX_SLICE) (i32.const 3)))

  ;; "Is this thread word the first word of a block-executor descriptor?"
  ;; There are two such words since round 16 -- the general executor's and the
  ;; leaf's -- and every reader that used to compare against $BX_HANDLER asks
  ;; here instead, so adding a third entry point is one edit rather than a hunt.
  ;; Neither index is ever a legal first handler of an ordinary decoded block:
  ;; the decoder emits neither, only $block_exec_try_install and
  ;; $bx_region_finish do.
  (func $bx_is_desc_word (param $w i32) (result i32)
    (i32.or (i32.eq (local.get $w) (global.get $BX_HANDLER))
      (i32.or (i32.eq (local.get $w) (global.get $BX_LEAF_HANDLER))
              (i32.eq (local.get $w) (global.get $BX_LEAFFB_HANDLER)))))

  ;; ======================================================================
  ;; THE MULTI-BLOCK MATCHER (OPEN-2)
  ;;
  ;; Everything above builds a ONE-block descriptor. The executor has always
  ;; been able to run N, and docs/region-census-2026-09.md measured that 43.6%
  ;; of retired guest ops on a six-app corpus sit inside a 2-4 block region and
  ;; 4.4% inside a 5-16 block one. This is what builds those descriptors from
  ;; real code.
  ;;
  ;; WHERE THE BLOCKS COME FROM, and why there is no second decoder. A region
  ;; needs the micro-ops of several blocks at once, and a block's micro-ops
  ;; only exist for the instant between $decode_block emitting it and the next
  ;; $decode_block overwriting OP_INDEX. $decode_run already walks exactly the
  ;; set of blocks this wants -- the fall-through chain out of one entry, in
  ;; ascending guest address, inside one page, stopping at anything already
  ;; compiled -- so the matcher rides along with it:
  ;;
  ;;   $decode_run(eip)      -> $bx_region_begin(eip)
  ;;     $decode_block(b0)   -> $bx_region_collect(b0)   [before every matcher]
  ;;     $decode_block(b1)   -> $bx_region_collect(b1)
  ;;     ...
  ;;                         -> $bx_region_finish()
  ;;
  ;; Each collect classifies that block's ops into $BX_RG_BASE while they are
  ;; still there and then gets out of the way; the per-block matchers run after
  ;; it exactly as before, so a member keeps whatever one-block descriptor it
  ;; would have had. Nothing is decoded twice and no block is decoded that
  ;; $decode_run was not going to decode anyway, which is why the matcher's own
  ;; decode-time cost is a classify pass and nothing else.
  ;;
  ;; WHAT THE SET LOOKS LIKE. Members are guest-contiguous by construction (the
  ;; chain follows fall-throughs), so the region's guest extent is exactly
  ;; [head, last block's end) with no holes. That is what makes the SMC story
  ;; the EXISTING one rather than a new generation counter: $page_publish marks
  ;; every byte of that extent as covered by the region, so a write anywhere
  ;; inside any member retires the whole region, and the region's own publish
  ;; retires the member entries it subsumes. Entry is through the head only --
  ;; a jump INTO a member lands on a cover mark, misses, and re-decodes that
  ;; block, which symmetrically retires the region. That is the "or decline"
  ;; arm of the entry rule, self-healing rather than checked, and the thrash
  ;; table below is what stops the two from ping-ponging forever.
  ;;
  ;; The rules are docs/region-census-2026-09.md's, one for one:
  ;;   single entry          the head; interior entries retire the region
  ;;   <= 16 blocks          $REGION_MAX_BLOCKS
  ;;   <= 8 exits            $REGION_MAX_EXITS
  ;;   uop budget            derived from the 4096-byte emit slack, below
  ;;   one page              $decode_run's own rule, inherited
  ;;   no call/ret/int/indirect inside   $bx_op_unsafe on every body op; a
  ;;                         terminator that is not a foldable Jcc or an
  ;;                         unconditional jump simply ends the region, so the
  ;;                         edge into such a block becomes an exit
  ;;   every op a micro-op   $tree_uop_classify, or a FALLBACK micro-op
  ;; ======================================================================

  ;; Armed by --block-exec; --no-block-exec-regions turns just this half off so
  ;; an A/B can separate the matcher from the one-block executor it rides on.
  ;; Not a flag but a CAP: the largest region the matcher may install, 0 for
  ;; "no multi-block regions at all". A boolean cannot bisect a divergence --
  ;; "regions are wrong" and "regions of more than three blocks are wrong" are
  ;; different bugs and the second is the one that happens -- so the knob that
  ;; turns the family off is the same knob that narrows it. 16 is
  ;; $REGION_MAX_BLOCKS, written as a literal because a global initializer
  ;; cannot read another global.
  (global $bx_region_enabled (mut i32) (i32.const 16))

  (global $BX_RG_BASE i32 (region.addr $BX_RG_BASE 0))
  (global $BX_RG_BASE_SIZE i32 (region.size $BX_RG_BASE))
  ;; A builder record is the 13-word $REGION_BLOCK_WORDS record the descriptor
  ;; wants, verbatim in its first 13 words, followed by the five fields only the
  ;; builder needs. Keeping the prefix identical means emitting a block is a
  ;; 13-word copy with two fixups rather than a field-by-field transcription.
  (global $BX_RG_REC_WORDS i32 (i32.const 24))
  (global $BX_RG_UOP_OFF   i32 (i32.const 512))
  (global $BX_RG_UOPS_MAX  i32 (i32.const 160))
  (global $BX_RG_FB_OFF    i32 (i32.const 1536))
  (global $BX_RG_FB_MAX    i32 (i32.const 1600))
  (global $BX_RG_EXIT_OFF  i32 (i32.const 3140))   ;; 8 exits * 2 words
  (global $BX_RG_THRASH_OFF i32 (i32.const 3200))  ;; 64 slots * 2 words
  (global $BX_RG_HIST_OFF  i32 (i32.const 3400))   ;; 17 counters, by block count
  ;; Coverage by region size, written by the EXECUTOR rather than the matcher:
  ;; how many micro-ops retired inside a descriptor of N blocks, and how many
  ;; times such a descriptor was entered. The install histogram above counts
  ;; static shapes; these two count the work, which is the number the census
  ;; cross-check is against.
  (global $BX_RG_OPSN_OFF  i32 (i32.const 3440))   ;; 17 i64 counters
  (global $BX_RG_ENTN_OFF  i32 (i32.const 3480))   ;; 17 i32 counters
  (global $BX_RG_WHY_OFF   i32 (i32.const 3520))   ;; 8 decline-reason counters
  (global $BX_RG_CFAIL_OFF i32 (i32.const 3536))   ;; 8 collect-refusal counters
  (global $BX_RG_NOFIT_OFF i32 (i32.const 3552))   ;; 9 classify-refusal counters
  ;; ---- the CFG walker's three tables (round 10) ------------------------
  ;; The worklist. One entry per edge discovered, popped in order, so the walk
  ;; is a breadth-first closure over the block graph rather than a fall-through
  ;; chain. 64 is twice $REGION_MAX_BLOCKS * 2 edges, i.e. it cannot overflow
  ;; before the block cap does.
  (global $BX_RG_WL_OFF    i32 (i32.const 3600))   ;; 64 words
  ;; Per-head entry counters, direct-mapped on the head EIP. This is the
  ;; HOTNESS GATE: discovery is attempted only after a block has been entered
  ;; through $branch_end $bx_walk_hot_k times, so a cold block that happens to
  ;; be a branch target costs one table bump and nothing else. 512 slots of
  ;; {eip, count}.
  (global $BX_RG_HOT_OFF   i32 (i32.const 4096))   ;; 512 * 2 words
  ;; Per-head failure memo. A head whose walk declined $bx_walk_memo_max times
  ;; is never attempted again, which is what turns "cost paid once per hot
  ;; head" from an aspiration into a bound: without it the hotness counter
  ;; re-arms every K entries forever. 256 slots of {eip, fails}.
  (global $BX_RG_MEMO_OFF  i32 (i32.const 5120))   ;; 256 * 2 words
  ;; The round-11 pass's memory-fact table: $BX_FACT_MAX * 8 words. Live only
  ;; inside one $bx_opt_pass call, which is why it can share this region with
  ;; the collector state above it.
  (global $BX_RG_FACT_OFF  i32 (i32.const 7168))   ;; 16 * 8 words
  ;; ...and its constant table, immediately after: 15 * 2 words.
  (global $BX_RG_CONST_OFF i32 (i32.const 7296))
  ;; ROUND 13 -- the RAW-WANTED table. 256 direct-mapped slots of one guest
  ;; address.
  ;;
  ;; The two families compete for the same blocks. The one-block installer runs
  ;; at the tail of every decode and replaces the threaded stream with a
  ;; descriptor; the region walker, which no longer decodes, can only classify a
  ;; threaded stream. So a block claimed by the one-block family is invisible to
  ;; discovery, and a loop whose body blocks were all claimed collects nothing
  ;; but its head. (Round 12 never noticed: its walk decoded the member back
  ;; into existence and paid a decode plus a retire for it every time.)
  ;;
  ;; A walk that meets a descriptor where it wanted a member marks that address
  ;; WANTED and retires the descriptor. The guest re-decodes the block on its
  ;; next entry -- one decode, once -- and the one-block installer declines it
  ;; while the mark stands, so the stream is there for the next walk. The table
  ;; is direct-mapped and never cleared: an evicted mark just means that block
  ;; may be claimed again, which costs coverage and never correctness.
  ;; 512 slots, the whole tail of $BX_RG_BASE (7400 + 512 = 7912 of 8192
  ;; words). An evicted mark costs one extra take-back, never correctness.
  ;; ROUND 14 retired this. It was headroom an optional executor publish left
  ;; in the page's ONE chunk so that the ordinary blocks decoded later on the
  ;; same page still fitted -- because a chunk that overflowed dropped the
  ;; whole page. Descriptors have their own chunk now
  ;; (docs/block-executor-design.md section 23), overflowing it is a local
  ;; decline, and the two families no longer compete for a byte. Kept at 0 as
  ;; documentation of what the number meant; the install paths call
  ;; $page_desc_would_fit and pass no reserve at all.
  (global $BX_PAGE_RESERVE i32 (i32.const 0))
  (global $BX_RG_RAW_OFF   i32 (i32.const 7400))   ;; 512 words
  (global $BX_RG_RAW_MASK  i32 (i32.const 511))
  (global $bx_raw_wants    (mut i32) (i32.const 0))
  ;; Set by $bx_raw_want, read by $bx_walk_try: did THIS walk take a descriptor
  ;; back? If so its decline says nothing about the code and must not be memoed.
  (global $bx_walk_marked  (mut i32) (i32.const 0))

  ;; Collector state. Live only between $bx_region_begin and $bx_region_finish,
  ;; which are both inside one $decode_run and therefore cannot nest.
  (global $bx_rg_active (mut i32) (i32.const 0))
  (global $bx_rg_n      (mut i32) (i32.const 0))
  (global $bx_rg_uops   (mut i32) (i32.const 0))
  (global $bx_rg_fw     (mut i32) (i32.const 0))
  ;; The fallback-pool cursor as it stood when the current classify started, so
  ;; a refusal part-way through a block's body scan rewinds exactly what that
  ;; block wrote and nothing earlier.
  (global $bx_rg_fw0    (mut i32) (i32.const 0))
  (global $bx_rg_head   (mut i32) (i32.const 0))
  ;; The EIP $decode_run was asked for, which is what its return value has to
  ;; be the code for. A restarted chain has a head PAST that, and a region
  ;; built there must not be handed back as the run's entry point -- it is
  ;; reached through the page index like any other block.
  (global $bx_rg_run_start (mut i32) (i32.const 0))
  (global $bx_rg_next   (mut i32) (i32.const 0))

  ;; ---- the CFG walker (round 10) ---------------------------------------
  ;; Round 9's discovery rode $decode_run's fall-through chain, and measured
  ;; ~0% coverage of 2+ block regions at the shipped cost model against a
  ;; census that followed Jcc and jmp TARGETS as well. A region whose head is a
  ;; branch target, or whose second block is one, was invisible by
  ;; construction. This is the replacement: a closure walk over the block graph
  ;; from one hot head, decoding on demand inside the head's page.
  ;;
  ;; What it keeps from round 9, unchanged and deliberately so:
  ;;   * the descriptor, the classifier, the executor, the exit table;
  ;;   * the SMC story -- the region is published over ONE contiguous guest
  ;;     span [head, max member end), $page_publish retires every old block it
  ;;     touches, and a write anywhere inside retires the region;
  ;;   * the 64-slot thrash guard.
  ;; What that span costs is the one new rule: **every member must start at or
  ;; above the head**, so the head is the lowest address in the region and the
  ;; published entry point is the span's first byte. An edge to a lower address
  ;; is simply an exit. Without it $page_retire_at, which infers a block's
  ;; extent by walking out over equal chunk offsets, would break the chunk with
  ;; the span's low byte as the resume address and a later entry at the head
  ;; would jump into the middle of its own region.
  ;;
  ;; Bytes inside the span that belong to no member are covered by the region
  ;; too. That is not an approximation: a cover mark means "not an entry point",
  ;; so entering such a byte misses, re-decodes, and symmetrically retires the
  ;; region -- the same self-healing arm the interior-entry case has always
  ;; used, and the thrash table is what bounds it.
  (global $bx_rg_walk (mut i32) (i32.const 0))
  ;; How many addresses the current walk has put on its worklist.
  (global $bx_rg_wl_n (mut i32) (i32.const 0))
  ;; Entries through $branch_end before a head is worth a walk.
  ;;
  ;; 256, and the number is measured rather than chosen. The gate does not
  ;; only decide how much discovery costs -- it decides how much RE-DECODE the
  ;; install path costs, because publishing a descriptor covers its whole guest
  ;; extent and anything that enters the interior misses, re-decodes and
  ;; symmetrically retires the region. A lukewarm head installs, churns and
  ;; installs again. Measured on quake2 (300 batches, 200000-block batches),
  ;; against 124,061 block decodes with the family off:
  ;;
  ;;     K       decodes      opsMulti
  ;;     24    1,584,079    16,179,253
  ;;     64      942,968    24,727,410
  ;;     256     417,280    27,817,225
  ;;     1024    187,442    22,672,623
  ;;     4096    133,051    17,406,161
  ;;
  ;; So K=24 was not buying coverage with that decode work: 256 covers 72% MORE
  ;; guest ops for a QUARTER of the decodes. The same shape holds on caesar3
  ;; (158,278 -> 15,582 decodes, opsMulti 110,830 -> 237,822) and mw3. That
  ;; miscalibration was the whole of round 9's quake2 loss: at K=24 the family
  ;; costs a resolved -1.794s on a 9.4s run, and at 256 it is inside the null
  ;; spread. heroes2 is the one app that harvests less at 256 than at 24 (its
  ;; hot heads are not entered 256 times in the window), at near-baseline
  ;; decode cost -- less gain, never a loss.
  ;;
  ;; The residual churn is the thrash table aliasing: 64 direct-mapped slots
  ;; over thousands of heads reset each other before the 16-install threshold
  ;; bites, which is why raising K works at all and is the next lever.
  (global $bx_walk_hot_k (mut i32) (i32.const 256))
  ;; Hot-slot takeovers by another EIP, and those that threw away a count of
  ;; 16 or more ($bx_hot_bump).
  (global $bx_hot_evicts (mut i32) (i32.const 0))
  (global $bx_hot_evicts_warm (mut i32) (i32.const 0))
  ;; Sticky hot slots (default on; --no-uop-hot-sticky, docs/uop-tier-design.md
  ;; section 21.5): a foreign EIP decrements the resident's count and takes the
  ;; slot only once that count is spent, instead of resetting it on sight.
  (global $bx_hot_sticky (mut i32) (i32.const 1))
  (global $bx_hot_decays (mut i32) (i32.const 0))
  ;; Time decay for the sticky counts (--uop-hot-age=N, 0 = off;
  ;; docs/uop-tier-design.md section 22): every N bumps, every slot's count
  ;; is halved. A sticky count otherwise only ever falls when a sharer
  ;; arrives, so a head entered a few hundred times over a whole run
  ;; installs eventually; halving turns the gate back into a RATE -- a head
  ;; must see about 128 entries per N bumps to reach the threshold. The
  ;; clock is bumps, not wall time or batches, so it is deterministic under
  ;; either guest clock. $bx_hot_age_left counts down to the next halving.
  ;; Only acts with sticky slots on.
  (global $bx_hot_age      (mut i32) (i32.const 0x8000))
  (global $bx_hot_age_left (mut i32) (i32.const 0x8000))
  (global $bx_hot_halvings (mut i32) (i32.const 0))
  ;; Blocks one walk may visit. This is the discovery COST bound, and it is
  ;; counted in blocks rather than in uops because a block is what costs a
  ;; $decode_block.
  (global $bx_walk_budget (mut i32) (i32.const 24))
  ;; Declines a head may accumulate before it is never attempted again.
  (global $bx_walk_memo_max (mut i32) (i32.const 3))
  ;; The $branch_end gate, kept as its own global so the hot path is one load
  ;; and one not-taken branch when the family is off -- which is the default and
  ;; every other app's configuration. Set by set_block_exec / the region cap.
  (global $bx_hot_on (mut i32) (i32.const 0))

  ;; Discovery meters. $bx_walk_blocks is the number the design doc reports as
  ;; "blocks visited per install"; $bx_walk_uops is the same in micro-ops, which
  ;; is what makes it comparable with the executor's own op counters.
  (global $bx_walk_attempts (mut i32) (i32.const 0))
  (global $bx_walk_installs (mut i32) (i32.const 0))
  (global $bx_walk_blocks   (mut i64) (i64.const 0))
  (global $bx_walk_uops     (mut i64) (i64.const 0))
  (global $bx_walk_memo_refusals (mut i32) (i32.const 0))
  (global $bx_walk_hot_probes (mut i32) (i32.const 0))
  ;; The lowest in-page successor a walk had to refuse for being BELOW its
  ;; head, and the count of walks that were re-anchored onto one. See the
  ;; re-anchor comment on $bx_walk_try.
  (global $bx_walk_min_below (mut i32) (i32.const 0))
  (global $bx_walk_reanchors (mut i32) (i32.const 0))
  ;; Round 13. Successors a walk turned into exits because the guest had not
  ;; compiled them yet, and installs refused because the descriptor would not
  ;; fit the page chunk without dropping the page. Both used to be paid in
  ;; block decodes instead of being counted.
  (global $bx_walk_uncached (mut i32) (i32.const 0))
  (global $bx_no_room (mut i32) (i32.const 0))
  ;; ROUND 16 (section 26). The displaced-stream copy is what keeps a block
  ;; installed by the ONE-BLOCK family visible to the region walker
  ;; ($page_cached_ops reads it back). It is skipped when the descriptor plus
  ;; the copy would not fit 4096 bytes -- "too big is not a decline" -- and a
  ;; skipped copy is invisible in every counter round 15 had, while costing the
  ;; region family the whole block: the walker meets a descriptor with no
  ;; stream, takes it back ($bx_raw_want), and declines the walk.
  ;;
  ;; That is the channel by which turning ANY one-block lever on can cost
  ;; region installs with the region classifier unchanged, so it is counted:
  ;; $bx_desc_nocopy for the one-block installer, $bx_rg_nocopy for the region
  ;; installer's own head copy.
  ;;
  ;; MEASURED AND RULED OUT for round 15's churn (section 26): both came back
  ;; at 0 on quake2-gameplay in every arm, and $bx_raw_want with them, so the
  ;; copy always fits and the walker never had to take a descriptor back. The
  ;; counters stay because the channel is real and silent when it opens; the
  ;; round-15 regression was elsewhere.
  (global $bx_desc_nocopy (mut i32) (i32.const 0))
  (global $bx_rg_nocopy   (mut i32) (i32.const 0))
  ;; Decline reason 3 ("no room to emit") has THREE sites and they mean
  ;; different things: the descriptor is bigger than 4096 bytes, the arena is
  ;; about to flush, or the page's DESCRIPTOR CHUNK is full. The third is the
  ;; one that couples the two families -- every one-block descriptor competes
  ;; for that chunk -- so it has to be separable from the other two.
  (global $bx_rg_nr_bytes (mut i32) (i32.const 0))
  (global $bx_rg_nr_arena (mut i32) (i32.const 0))
  (global $bx_rg_nr_fit   (mut i32) (i32.const 0))
  ;; Walk attempts whose HEAD already held a one-block descriptor, and how many
  ;; of those failed. This is the direct measure of "the one-block family took
  ;; the head first".
  (global $bx_rg_head_desc      (mut i32) (i32.const 0))
  (global $bx_rg_head_desc_fail (mut i32) (i32.const 0))
  ;; Heads the memo LOCKED OUT -- the walk failed $bx_walk_memo_max times in a
  ;; row and the address stops being asked about. The memo is a ratchet, so a
  ;; transient rise in failures is permanent coverage loss, and this counts the
  ;; doors that shut rather than the knocks ($bx_walk_memo_refusals).
  (global $bx_memo_locked (mut i32) (i32.const 0))
  ;; Regions installed holding at least one x87 member micro-op (round 16).
  (global $bx_rg_x87_regions (mut i32) (i32.const 0))
  ;; x87 micro-ops the REGION classifier emitted, split the same way the
  ;; one-block path splits them: cheap fused runs, bare native kinds, and the
  ;; residue still on the trampoline.
  (global $bx_rg_x87run_uops    (mut i64) (i64.const 0))
  (global $bx_rg_x87_native_uops(mut i64) (i64.const 0))
  (global $bx_rg_x87_fb_uops    (mut i64) (i64.const 0))

  ;; Meters.
  (global $bx_region_installs (mut i32) (i32.const 0))
  (global $bx_region_declines (mut i32) (i32.const 0))
  (global $bx_region_blocks   (mut i32) (i32.const 0))
  ;; Why the last candidate with >= 2 collected blocks was refused:
  ;; 1 cost model / floor, 2 too many exits, 3 past the emit slack,
  ;; 4 thrash guard, 5 publish failed.
  (global $bx_region_why      (mut i32) (i32.const 0))
  (global $bx_region_thrash   (mut i32) (i32.const 0))
  (global $bx_region_restarts (mut i32) (i32.const 0))

  ;; The producer walk's six results, module-level so the walk can be its own
  ;; function instead of six more locals threaded through the classifier.
  (global $bx_pr_kind (mut i32) (i32.const 0))
  (global $bx_pr_a    (mut i32) (i32.const 0))
  (global $bx_pr_b    (mut i32) (i32.const 0))
  (global $bx_pr_imm  (mut i32) (i32.const 0))
  (global $bx_pr_uop  (mut i32) (i32.const 0))
  (global $bx_pr_pos  (mut i32) (i32.const 0))

  (func $bx_rg_rec (param $k i32) (result i32)
    (i32.add (global.get $BX_RG_BASE)
      (i32.mul (local.get $k)
        (i32.shl (global.get $BX_RG_REC_WORDS) (i32.const 2)))))
  (func $bx_rg_word (param $w i32) (result i32)
    (i32.add (global.get $BX_RG_BASE) (i32.shl (local.get $w) (i32.const 2))))
  (func $bx_rg_uop_at (param $j i32) (result i32)
    (call $bx_rg_word
      (i32.add (global.get $BX_RG_UOP_OFF)
               (i32.mul (local.get $j) (global.get $TREE_UOP_WORDS)))))

  ;; ----------------------------------------------------------------------
  ;; The terminator's flag producer. Identical in rule to the backward scan in
  ;; $loop_try_tree_fold -- same accepted handlers, same flag-transparency test
  ;; for the ops it walks over -- but it does not require the branch to close a
  ;; self-loop, because in a region the branch target is resolved against the
  ;; member set instead. Its answers go into the six $bx_pr_* globals.
  ;;
  ;; Returns the uop count on success (n - 2, both terminator ops lifted out)
  ;; and -1 on failure, so zero stays a legal answer for a block that is
  ;; nothing but `cmp / jcc`.
  ;; ----------------------------------------------------------------------
  (func $bx_rg_producer (param $n i32) (result i32)
    (local $t i32) (local $p i32) (local $fn i32) (local $op i32)
    (if (i32.lt_u (local.get $n) (i32.const 2)) (then (return (i32.const -1))))
    (local.set $t (i32.sub (local.get $n) (i32.const 2)))
    (block $found
      (loop $scan
        (local.set $p (call $loop_op_at (local.get $t)))
        (local.set $fn (i32.load (local.get $p)))
        (br_if $found (i32.eq (local.get $fn) (i32.const 64)))
        (br_if $found (i32.eq (local.get $fn) (i32.const 65)))
        (br_if $found (i32.eq (local.get $fn) (i32.const 19)))
        (br_if $found (i32.eq (local.get $fn) (i32.const 10)))
        (br_if $found (i32.eq (local.get $fn) (i32.const 72)))
        (br_if $found (i32.eq (local.get $fn) (i32.const 73)))
        (br_if $found (i32.eq (local.get $fn) (i32.const 128)))
        ;; ALU r,imm32 (H3 add, H4 or, H7 and, H8 sub, H9 xor) and ALU r,r
        ;; (H12, H13, H16, H17, H18). These WRITE a register as well as the
        ;; flags, which is the only thing that separates them from the `cmp`
        ;; and `test` pair above, and the executor's term_kind 8/9 does that
        ;; write. Round 9 measured `noFlagProducer` at 1.84M of Diablo's 2.81M
        ;; classify refusals for exactly this reason: `and eax,7 / jnz` is as
        ;; common an idiom as `test eax,eax / jnz` and was not accepted.
        ;;
        ;; The two holes in each range -- H5/H6 adc/sbb and H14/H15 adc/sbb --
        ;; are matched here and declined below rather than skipped, because a
        ;; carry-consuming op is a flag WRITER and the backward scan may not
        ;; walk over one either way.
        (br_if $found (i32.and (i32.ge_u (local.get $fn) (i32.const 3))
                               (i32.le_u (local.get $fn) (i32.const 9))))
        (br_if $found (i32.and (i32.ge_u (local.get $fn) (i32.const 12))
                               (i32.le_u (local.get $fn) (i32.const 18))))
        ;; Not a producer: it may still be walked over, but only if it is a
        ;; micro-op that neither writes nor reads a flag field. Those keep
        ;; their original position and run after the terminator, which is what
        ;; $term_pos records.
        (if (i32.eqz (call $tree_uop_classify (local.get $p)))
          (then (return (i32.const -1))))
        (if (i32.or
              (call $tree_uop_flag_writes (global.get $tu_kind) (global.get $tu_b))
              (call $tree_uop_flag_reads  (global.get $tu_kind) (global.get $tu_b)))
          (then (return (i32.const -1))))
        (if (i32.eqz (local.get $t)) (then (return (i32.const -1))))
        (local.set $t (i32.sub (local.get $t) (i32.const 1)))
        (br $scan)))
    (local.set $op (i32.load offset=4 (local.get $p)))
    (global.set $bx_pr_pos (local.get $t))
    (global.set $bx_pr_imm (i32.const 0))
    (global.set $bx_pr_uop (i32.const 0))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 64))
                (i32.eq (local.get $fn) (i32.const 65)))
      (then
        (global.set $bx_pr_kind (i32.const 0))
        (global.set $bx_pr_uop (i32.eq (local.get $fn) (i32.const 64)))
        (global.set $bx_pr_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $bx_pr_b (i32.const 0)))
      (else (if (i32.eq (local.get $fn) (i32.const 19))
        (then
          (global.set $bx_pr_kind (i32.const 1))
          (global.set $bx_pr_a
            (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
          (global.set $bx_pr_b (i32.and (local.get $op) (i32.const 0xF))))
        (else (if (i32.eq (local.get $fn) (i32.const 10))
          (then
            (global.set $bx_pr_kind (i32.const 2))
            (global.set $bx_pr_a (i32.and (local.get $op) (i32.const 0xF)))
            (global.set $bx_pr_b (i32.load offset=8 (local.get $p))))
          (else (if (i32.eq (local.get $fn) (i32.const 72))
            (then
              (global.set $bx_pr_kind (i32.const 6))
              (global.set $bx_pr_a
                (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
              (global.set $bx_pr_b (i32.and (local.get $op) (i32.const 0xF))))
            (else (if (i32.eq (local.get $fn) (i32.const 73))
              (then
                (global.set $bx_pr_kind (i32.const 7))
                (global.set $bx_pr_a (i32.and (local.get $op) (i32.const 0xF)))
                (global.set $bx_pr_b (i32.load offset=8 (local.get $p))))
              (else (if (i32.and (i32.eq (local.get $fn) (i32.const 128))
                                 (i32.eq (i32.and (i32.shr_u (local.get $op) (i32.const 8))
                                                  (i32.const 0xF))
                                         (i32.const 7)))
                (then
                  (global.set $bx_pr_kind (i32.const 3))
                  (global.set $bx_pr_a
                    (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
                  (global.set $bx_pr_b (i32.and (local.get $op) (i32.const 0xF)))
                  (global.set $bx_pr_imm (i32.load offset=8 (local.get $p))))
                (else
                  ;; ALU r,imm32 -> kind 9, ALU r,r -> kind 8. `uop` carries
                  ;; the x86 group sub-op (0 add, 1 or, 4 and, 5 sub, 6 xor),
                  ;; which is `fn - 3` for the immediate forms and `fn - 12`
                  ;; for the register ones; 2 and 3 are adc/sbb and decline.
                  (if (i32.and (i32.ge_u (local.get $fn) (i32.const 3))
                               (i32.le_u (local.get $fn) (i32.const 9)))
                    (then
                      (global.set $bx_pr_uop (i32.sub (local.get $fn) (i32.const 3)))
                      (if (call $bx_alu_term_bad (global.get $bx_pr_uop))
                        (then (return (i32.const -1))))
                      (global.set $bx_pr_kind (i32.const 9))
                      (global.set $bx_pr_a (i32.and (local.get $op) (i32.const 0xF)))
                      (global.set $bx_pr_b (i32.load offset=8 (local.get $p))))
                    (else (if (i32.and (i32.ge_u (local.get $fn) (i32.const 12))
                                       (i32.le_u (local.get $fn) (i32.const 18)))
                      (then
                        (global.set $bx_pr_uop (i32.sub (local.get $fn) (i32.const 12)))
                        (if (call $bx_alu_term_bad (global.get $bx_pr_uop))
                          (then (return (i32.const -1))))
                        (global.set $bx_pr_kind (i32.const 8))
                        (global.set $bx_pr_a
                          (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
                        (global.set $bx_pr_b (i32.and (local.get $op) (i32.const 0xF))))
                      (else (return (i32.const -1))))))))))))))))))
    (i32.sub (local.get $n) (i32.const 2)))

  ;; "This x86 ALU group sub-op may not be a terminator flag producer." Only
  ;; add/or/and/sub/xor are modelled: adc (2) and sbb (3) read CF as an input
  ;; and cmp (7) is handled by its own kinds above.
  (func $bx_alu_term_bad (param $s i32) (result i32)
    (i32.or (i32.eq (local.get $s) (i32.const 2))
      (i32.or (i32.eq (local.get $s) (i32.const 3))
              (i32.ge_u (local.get $s) (i32.const 7)))))

  ;; ----------------------------------------------------------------------
  ;; Classify one just-decoded block into the region builder. Reads OP_INDEX
  ;; and $d_pc, which are only valid right now -- this runs before every other
  ;; matcher for exactly that reason.
  ;; ----------------------------------------------------------------------
  (func $bx_rg_classify_block (param $start_eip i32) (result i32)
    (local $n i32) (local $p i32) (local $pn i32) (local $fn i32) (local $op i32)
    (local $rec i32) (local $i i32) (local $j i32) (local $oi i32) (local $nw i32)
    (local $tidx i32) (local $nuops i32) (local $shape i32)
    (local $term_kind i32) (local $term_a i32) (local $term_b i32)
    (local $term_cc i32) (local $term_uop i32) (local $term_imm i32)
    (local $fall i32) (local $taken i32) (local $extra i32)
    (local $nat i32) (local $nfb i32) (local $up i32) (local $u0 i32)
    (local $k i32) (local $fbp i32)
    ;; ROUND 16 (section 26): the x87 arm, the same shape the one-block path
    ;; has. $span is the fused run's op count (1 for a bare op), $cheap whether
    ;; it can take TU_X87RUN, $rmask the registers it reads, $absorbed the ops
    ;; a fused run swallowed -- which never dispatched on the threaded path and
    ;; so must not be billed as steps -- and the three counters the cost model
    ;; and the stats line read.
    (local $span i32) (local $cheap i32) (local $rmask i32)
    (local $pe i32) (local $peop i32) (local $absorbed i32)
    (local $nx87run i32) (local $nx87fb i32) (local $nx87nat i32)
    ;; Round 11: the scan's op index and its micro-op index are no longer the
    ;; same number, because the split emits two micro-ops for one op. $nops is
    ;; the op count the terminator analysis produced, $ui the micro-ops written
    ;; so far, and $tpos the terminator's position measured in MICRO-ops --
    ;; which is what the executor's `term_pos` field means.
    (local $nops i32) (local $ui i32) (local $tpos i32)
    ;; Round 18 (section 28): the unmodelled-terminator side exit. $tail_p is
    ;; the terminator op's address in the PUBLISHED stream and $tail_bytes its
    ;; length there, which is what gets copied into the descriptor's pool.
    (local $tail_p i32) (local $tail_bytes i32) (local $sbase i32)

    (global.set $bx_rg_fw0 (global.get $bx_rg_fw))
    (local.set $n (global.get $op_index_n))
    (if (i32.eqz (local.get $n)) (then (return (call $bx_rg_nofit (i32.const 1)))))
    (local.set $u0 (global.get $bx_rg_uops))

    ;; ---- the terminator ------------------------------------------------
    (local.set $p (call $loop_op_at (i32.sub (local.get $n) (i32.const 1))))
    (local.set $fn (i32.load (local.get $p)))
    (local.set $op (i32.load offset=4 (local.get $p)))
    (local.set $tidx (i32.const -1))
    ;; H404 is `test r,r + Jcc` already fused by the decoder: both the flag
    ;; producer and the branch in one op, so there is no backward walk.
    (if (i32.eq (local.get $fn) (i32.const 404))
      (then
        ;; the byte form leaves $flag_sign_shift at 7; term_kind 6 is 32-bit
        (if (i32.and (local.get $op) (i32.const 0x1000))
          (then (return (call $bx_rg_nofit (i32.const 2)))))
        (local.set $shape (i32.const 1))
        (local.set $term_kind (i32.const 6))
        (local.set $term_cc
          (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
        (local.set $term_a
          (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $term_b (i32.and (local.get $op) (i32.const 0xF)))
        (local.set $fall  (i32.load offset=8  (local.get $p)))
        (local.set $taken (i32.load offset=12 (local.get $p)))
        (local.set $nuops (i32.sub (local.get $n) (i32.const 1)))
        (local.set $tidx  (i32.sub (local.get $n) (i32.const 1)))))
    (if (i32.and (i32.eqz (local.get $shape))
                 (i32.and (i32.ge_u (local.get $fn) (i32.const 307))
                          (i32.le_u (local.get $fn) (i32.const 322))))
      (then
        (local.set $nuops (call $bx_rg_producer (local.get $n)))
        (if (i32.lt_s (local.get $nuops) (i32.const 0))
          (then (return (call $bx_rg_nofit (i32.const 3)))))
        (local.set $shape (i32.const 1))
        (local.set $term_kind (global.get $bx_pr_kind))
        (local.set $term_a    (global.get $bx_pr_a))
        (local.set $term_b    (global.get $bx_pr_b))
        (local.set $term_imm  (global.get $bx_pr_imm))
        (local.set $term_uop  (global.get $bx_pr_uop))
        (local.set $tidx      (global.get $bx_pr_pos))
        (local.set $term_cc (i32.sub (local.get $fn) (i32.const 307)))
        (local.set $fall  (i32.load offset=8  (local.get $p)))
        (local.set $taken (i32.load offset=12 (local.get $p)))))
    ;; An unconditional edge. H43 is `jmp`, target in the word after the op;
    ;; H45 is $th_block_end, whose operand IS the address -- the decoder emits
    ;; it when a block runs into code it has already compiled. Either way
    ;; term_kind 4 evaluates no condition and always takes succ_fall.
    (if (i32.and (i32.eqz (local.get $shape))
                 (i32.or (i32.eq (local.get $fn) (i32.const 43))
                         (i32.eq (local.get $fn) (i32.const 45))))
      (then
        (local.set $shape (i32.const 1))
        (local.set $term_kind (i32.const 4))
        (local.set $taken
          (select (i32.load offset=8 (local.get $p)) (local.get $op)
                  (i32.eq (local.get $fn) (i32.const 43))))
        (local.set $fall (local.get $taken))
        (local.set $nuops (i32.sub (local.get $n) (i32.const 1)))
        (local.set $tidx (i32.const -1))))
    ;; ---- ROUND 18 (section 28): THE UNMODELLED TERMINATOR ----------------
    ;; Nothing above recognised this block's last op as an edge the descriptor
    ;; can express -- it is a call, a ret, an indirect branch, a loop/jecxz, an
    ;; int, a far jump, or a fused Jcc form the two arms above declined. Admit
    ;; the block anyway, as a DEAD END whose body runs natively and whose
    ;; terminator runs THREADED, from a copy of its own published words parked
    ;; in the descriptor's fallback pool.
    ;;
    ;; No call/ret semantics are modelled anywhere. The member simply publishes
    ;; all eight registers, points $ip at its own tail and `return_call $next`
    ;; -- the same three lines the one-block `term_kind 5` install has always
    ;; run, applied per member instead of per region.
    ;;
    ;; $eip is restored to the member's entry address at the exit, because the
    ;; threaded arm this is compared against had the PREVIOUS block's
    ;; terminator set it there, and a folded interior edge does not. Section
    ;; 2.1's "mid-block $eip is stale at the block's entry" is then true inside
    ;; a region as well, which is what `ret`'s crash reporting and
    ;; `--fault-null` read.
    (if (i32.and (i32.eqz (local.get $shape))
                 (i32.ne (global.get $block_exec_tail_exits) (i32.const 0)))
      (then
        (block $no_tail
          ;; The exits budget. A side exit IS an exit -- it is a place the
          ;; region hands control back -- so it is held to $REGION_MAX_EXITS
          ;; together with the modelled ones. This is the cheap half of the
          ;; test; $bx_region_finish does the exact one once the edge set is
          ;; resolved and the modelled exit count is known.
          (if (i32.ge_u (global.get $bx_rg_tail_n) (global.get $REGION_MAX_EXITS))
            (then (global.set $bx_rg_tail_norm (i32.const 4)) (br $no_tail)))
          ;; Where this block's published threaded bytes are. The walker never
          ;; decodes (round 13), so the terminator's length cannot be taken
          ;; from $thread_alloc the way the one-block installer takes it -- it
          ;; is the distance from the last op to the end of the published
          ;; stream, and $page_cached_stream is what knows that end. It also
          ;; answers for a member that is itself a one-block descriptor, by
          ;; handing back the verbatim copy OP_INDEX was rebuilt from, so the
          ;; two agree by construction.
          (local.set $sbase (call $page_cached_stream (local.get $start_eip)))
          (if (i32.eqz (local.get $sbase))
            (then (global.set $bx_rg_tail_norm (i32.const 2)) (br $no_tail)))
          (local.set $tail_p (call $loop_op_at (i32.sub (local.get $n) (i32.const 1))))
          (if (i32.or (i32.lt_u (local.get $tail_p) (local.get $sbase))
                      (i32.ge_u (local.get $tail_p)
                        (i32.add (local.get $sbase)
                                 (global.get $page_cached_stream_len))))
            (then (global.set $bx_rg_tail_norm (i32.const 2)) (br $no_tail)))
          (local.set $tail_bytes
            (i32.sub (i32.add (local.get $sbase) (global.get $page_cached_stream_len))
                     (local.get $tail_p)))
          ;; The same 8..64 window the one-block installer holds its tail to:
          ;; an op is at least a {handler, operand} pair and no terminator in
          ;; the table carries more than fourteen inline words.
          (if (i32.or (i32.lt_u (local.get $tail_bytes) (i32.const 8))
                      (i32.or (i32.gt_u (local.get $tail_bytes) (i32.const 64))
                              (i32.and (local.get $tail_bytes) (i32.const 3))))
            (then (global.set $bx_rg_tail_norm (i32.const 3)) (br $no_tail)))
          (local.set $shape (i32.const 1))
          (local.set $term_kind (i32.const 10))
          ;; 15 is "absent". It keeps $bx_opt_term_wreg at -1 (the select below
          ;; requires `term_a < 8`), which is right: the terminator is not
          ;; folded here, so it writes nothing this pass has to model.
          (local.set $term_a (i32.const 15))
          ;; Both successors are the member itself, so $bx_walk_once's two
          ;; worklist pushes are no-ops rather than a walk into address 0.
          ;; A call's fall-through is NOT an interior edge: the callee runs
          ;; threaded and returns to call+5 through $branch_end, which resolves
          ;; it through the page index like any other transfer.
          (local.set $fall  (local.get $start_eip))
          (local.set $taken (local.get $start_eip))
          (local.set $nuops (i32.sub (local.get $n) (i32.const 1)))
          (local.set $tidx  (i32.const -1)))))
    (if (i32.eqz (local.get $shape)) (then (return (call $bx_rg_nofit (i32.const 4)))))
    (if (i32.gt_u (i32.add (local.get $u0) (local.get $nuops))
                  (global.get $BX_RG_UOPS_MAX))
      (then (return (call $bx_rg_nofit (i32.const 5)))))

    ;; ---- the body ------------------------------------------------------
    (local.set $fbp (call $bx_rg_word (global.get $BX_RG_FB_OFF)))
    (local.set $i (i32.const 0))
    (local.set $nops (local.get $nuops))
    (local.set $ui (i32.const 0))
    (local.set $tpos (i32.const -1))
    (global.set $bx_lane_next (i32.const 0))
    (block $scan_done
      (loop $scan
        (br_if $scan_done (i32.ge_u (local.get $i) (local.get $nops)))
        ;; The flag producer was lifted out at op index $tidx; the micro-op
        ;; position it vacated is wherever the writer cursor stands when the
        ;; scan reaches it.
        (if (i32.and (i32.ge_s (local.get $tidx) (i32.const 0))
                     (i32.eq (local.get $i) (local.get $tidx)))
          (then (local.set $tpos (local.get $ui))))
        ;; Room for three micro-ops, so a split never has to be undone -- two
        ;; for round 11's load split, three for round 12's RMW store split.
        (if (i32.gt_u (i32.add (local.get $u0) (i32.add (local.get $ui) (i32.const 3)))
                      (global.get $BX_RG_UOPS_MAX))
          (then (return (call $bx_rg_nofit (i32.const 5)))))
        ;; uop index -> op index: the flag producer is lifted out of the list
        ;; and everything at or past it shifts by one, exactly as
        ;; $tree_op_for_uop does for the one-block fold. tidx of -1 (an
        ;; unconditional terminator) makes the unsigned compare false for every
        ;; real index, so the mapping is the identity.
        (local.set $oi
          (select (i32.add (local.get $i) (i32.const 1)) (local.get $i)
                  (i32.ge_u (local.get $i) (local.get $tidx))))
        (local.set $p  (call $loop_op_at (local.get $oi)))
        (local.set $pn (call $loop_op_at (i32.add (local.get $oi) (i32.const 1))))
        (local.set $fn (i32.load (local.get $p)))

        ;; ---- ROUND 16 (section 26): x87 AS A REGION MEMBER OP.
        ;;
        ;; Section 17.4 named this the "smaller change" of the two ways to lift
        ;; the region path's x87 refusal, and it is the one taken: teach THIS
        ;; classifier the same $x87_fused_span arithmetic the one-block
        ;; installer learned in round 12, rather than moving collection to run
        ;; after the fusers (which would change what discovery sees at every
        ;; head, x87 or not).
        ;;
        ;; It sits above $bx_op_unsafe for the same reason the one-block arm
        ;; does: 188..190 and 449..453 are both "unsafe" to that function, the
        ;; first because the fusers used to run after the matcher and the second
        ;; because everything at 418 and up is a fold unless stated otherwise.
        ;; Neither reason survives -- the fusers run FIRST, and none of these
        ;; five handlers touches $eip.
        ;;
        ;; A member is emitted with exactly the kinds and the publish mask the
        ;; one-block path emits, because there is only one executor: a one-block
        ;; descriptor IS a one-member region to $th_block_exec, so a micro-op
        ;; array that runs in one runs in the other by construction. What is
        ;; genuinely new here is the OP-INDEX BOOKKEEPING, and it has two
        ;; hazards the one-block scan does not have:
        ;;
        ;;  * the flag producer is LIFTED OUT of the body at op index $tidx, so
        ;;    scan index i maps to op index i or i+1. A span is a run of
        ;;    CONSECUTIVE op indices, so a producer sitting strictly inside one
        ;;    would make `i += span` step over it -- and over the $tpos
        ;;    assignment at the top of this loop. Declined rather than repaired:
        ;;    a flag producer is a cmp/test/sub and an absorbed entry is checked
        ;;    below to be 188..190/449..453, so the two cannot overlap in
        ;;    practice and this is a guard, not a path.
        ;;  * the member's `cost` word is an OP COUNT, not $nat, so a fused run
        ;;    would bill one step per absorbed entry. The threaded arm bills
        ;;    one -- the absorbed ops are inline data and never dispatch -- so
        ;;    $absorbed is subtracted at the commit below.
        (local.set $span (i32.const 0))
        (if (i32.and (i32.ne (global.get $block_exec_x87) (i32.const 0))
                     (i32.ne (global.get $block_exec_x87_regions) (i32.const 0)))
          (then
            (if (i32.and (i32.ge_u (local.get $fn) (i32.const 188))
                         (i32.le_u (local.get $fn) (i32.const 190)))
              (then
                (local.set $span (i32.const 1))
                ;; A BARE x87 op the fuser refused. 07b's own native kinds
                ;; (TU_X87_MEM/_MRO/_REG/_SW_AX, 50..53) are real saved
                ;; dispatches and bump $nat, exactly as in the one-block path.
                (if (call $tree_uop_classify (local.get $p))
                  (then
                    (local.set $up
                      (call $bx_rg_uop_at (i32.add (local.get $u0) (local.get $ui))))
                    (local.set $extra
                      (i32.add (local.get $extra) (global.get $tu_extra)))
                    (i32.store           (local.get $up) (global.get $tu_kind))
                    (i32.store offset=4  (local.get $up) (global.get $tu_d))
                    (i32.store offset=8  (local.get $up) (global.get $tu_a))
                    (i32.store offset=12 (local.get $up) (global.get $tu_imm))
                    (i32.store offset=16 (local.get $up) (global.get $tu_fn))
                    (i32.store offset=20 (local.get $up) (global.get $tu_b))
                    (local.set $ui (i32.add (local.get $ui) (i32.const 1)))
                    (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
                    (local.set $nx87nat (i32.add (local.get $nx87nat) (i32.const 1)))
                    (global.set $bx_rg_x87_native_uops
                      (i64.add (global.get $bx_rg_x87_native_uops) (i64.const 1)))
                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                    (br $scan))))
              (else
                (local.set $span
                  (call $x87_fused_span (local.get $fn)
                        (i32.load offset=4 (local.get $p))))))))
        (if (local.get $span)
          (then
            ;; The span must stay inside the BODY -- the terminator is not in
            ;; this scan's range at all.
            (if (i32.gt_u (i32.add (local.get $i) (local.get $span))
                          (local.get $nops))
              (then (return (call $bx_rg_nofit (i32.const 6)))))
            ;; ...and must not straddle the lifted flag producer.
            (if (i32.and (i32.ge_s (local.get $tidx) (i32.const 0))
                  (i32.and (i32.gt_u (local.get $tidx) (local.get $i))
                           (i32.lt_u (local.get $tidx)
                                     (i32.add (local.get $i) (local.get $span)))))
              (then (return (call $bx_rg_nofit (i32.const 6)))))
            ;; The absorbed walk, identical to the one-block path's: every
            ;; absorbed entry must be a plain x87 op or a fused one an earlier
            ;; fuser left behind (section 24.2), and for the ISLAND family the
            ;; same walk decides $cheap and collects the read mask.
            (local.set $cheap (i32.const 1))
            (local.set $rmask (call $x87_run_reads (local.get $fn)
                                (i32.load offset=4 (local.get $p))))
            (if (i32.eq (local.get $fn) (i32.const 451))
              (then
                (local.set $peop (i32.load offset=4 (local.get $p)))
                (local.set $pe
                  (i32.and (i32.shr_u (local.get $peop) (i32.const 12)) (i32.const 0xFF)))
                (local.set $peop (i32.and (local.get $peop) (i32.const 0xFFF)))
                (if (i32.eqz (call $x87_island_op_ok (local.get $pe) (local.get $peop)))
                  (then (local.set $cheap (i32.const 0))))
                (local.set $rmask (i32.or (local.get $rmask)
                  (call $x87_island_op_base (local.get $pe) (local.get $peop))))))
            (local.set $j (i32.const 1))
            (block $rab_done
              (loop $rab
                (br_if $rab_done (i32.ge_u (local.get $j) (local.get $span)))
                (local.set $pe
                  (call $loop_op_at (i32.add (local.get $oi) (local.get $j))))
                (local.set $peop (i32.load offset=4 (local.get $pe)))
                (local.set $pe (i32.load (local.get $pe)))
                (if (i32.eqz (i32.or
                      (i32.and (i32.ge_u (local.get $pe) (i32.const 188))
                               (i32.le_u (local.get $pe) (i32.const 190)))
                      (i32.and (i32.ge_u (local.get $pe) (i32.const 449))
                               (i32.le_u (local.get $pe) (i32.const 453)))))
                  (then (return (call $bx_rg_nofit (i32.const 6)))))
                (if (i32.eq (local.get $fn) (i32.const 451))
                  (then
                    (if (i32.eqz (call $x87_island_op_ok
                                   (local.get $pe) (local.get $peop)))
                      (then (local.set $cheap (i32.const 0))))
                    (local.set $rmask (i32.or (local.get $rmask)
                      (call $x87_island_op_base (local.get $pe) (local.get $peop))))))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $rab)))
            ;; Inline words: this op's word 2 up to the start of the op the span
            ;; ends at, plus the two-word H459 resume trampoline.
            (local.set $pe
              (call $loop_op_at (i32.add (local.get $oi) (local.get $span))))
            (local.set $nw (i32.shr_u
              (i32.sub (i32.sub (local.get $pe) (local.get $p)) (i32.const 8))
              (i32.const 2)))
            (if (i32.gt_u (i32.add (global.get $bx_rg_fw)
                                   (i32.add (local.get $nw) (i32.const 2)))
                          (global.get $BX_RG_FB_MAX))
              (then (return (call $bx_rg_nofit (i32.const 7)))))
            ;; A BARE op never takes the cheap arm: $tree_uop_classify had first
            ;; refusal on it above, and $x87_run_body only knows 449..453.
            (if (i32.and (i32.ge_u (local.get $fn) (i32.const 188))
                         (i32.le_u (local.get $fn) (i32.const 190)))
              (then (local.set $cheap (i32.const 0))))
            (local.set $up
              (call $bx_rg_uop_at (i32.add (local.get $u0) (local.get $ui))))
            (i32.store           (local.get $up)
              (select (global.get $TU_X87RUN) (global.get $TU_FALLBACK)
                      (local.get $cheap)))
            ;; `d` is the read mask for TU_X87RUN and inert for TU_FALLBACK,
            ;; which publishes all eight regardless.
            (i32.store offset=4  (local.get $up) (local.get $rmask))
            (i32.store offset=8  (local.get $up) (local.get $fn))
            (i32.store offset=12 (local.get $up) (i32.load offset=4 (local.get $p)))
            (i32.store offset=16 (local.get $up) (local.get $fn))
            (i32.store offset=20 (local.get $up)
              (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
            (local.set $j (i32.const 0))
            (block $rx87cp_done
              (loop $rx87cp
                (br_if $rx87cp_done (i32.ge_u (local.get $j) (local.get $nw)))
                (i32.store
                  (i32.add (local.get $fbp) (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
                  (i32.load (i32.add (local.get $p)
                    (i32.add (i32.const 8) (i32.shl (local.get $j) (i32.const 2))))))
                (global.set $bx_rg_fw (i32.add (global.get $bx_rg_fw) (i32.const 1)))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $rx87cp)))
            (i32.store
              (i32.add (local.get $fbp) (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
              (global.get $BX_RESUME_HANDLER))
            (i32.store offset=4
              (i32.add (local.get $fbp) (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
              (i32.const 0))
            (global.set $bx_rg_fw (i32.add (global.get $bx_rg_fw) (i32.const 2)))
            (local.set $ui (i32.add (local.get $ui) (i32.const 1)))
            (local.set $absorbed
              (i32.add (local.get $absorbed) (i32.sub (local.get $span) (i32.const 1))))
            (if (local.get $cheap)
              (then
                (local.set $nx87run (i32.add (local.get $nx87run) (i32.const 1)))
                (global.set $bx_rg_x87run_uops
                  (i64.add (global.get $bx_rg_x87run_uops) (i64.const 1))))
              (else
                (local.set $nfb (i32.add (local.get $nfb) (i32.const 1)))
                (local.set $nx87fb (i32.add (local.get $nx87fb) (i32.const 1)))
                (global.set $bx_rg_x87_fb_uops
                  (i64.add (global.get $bx_rg_x87_fb_uops) (i64.const 1)))))
            (local.set $i (i32.add (local.get $i) (local.get $span)))
            (br $scan)))

        (if (call $bx_op_unsafe (local.get $fn)) (then (return (call $bx_rg_nofit (i32.const 6)))))
        (local.set $up (call $bx_rg_uop_at (i32.add (local.get $u0) (local.get $ui))))
        (local.set $k (i32.const -1))
        ;; PUSH/POP r32 carry the register in the handler index (323..338) or,
        ;; in the generic $th_push_r/$th_pop_r spelling the decoder emits since
        ;; the register file moved to memory, in the operand word.
        (if (i32.or (i32.eq (local.get $fn) (global.get $TH_PUSH_R))
                    (i32.and (i32.ge_u (local.get $fn) (i32.const 323))
                             (i32.le_u (local.get $fn) (i32.const 330))))
          (then
            (i32.store           (local.get $up) (global.get $TU_PUSH_R))
            (i32.store offset=4  (local.get $up)
              (select (i32.load offset=4 (local.get $p)) (i32.sub (local.get $fn) (i32.const 323))
                      (i32.eq (local.get $fn) (global.get $TH_PUSH_R))))
            (i32.store offset=8  (local.get $up) (i32.const 0))
            (i32.store offset=12 (local.get $up) (i32.const 0))
            (i32.store offset=16 (local.get $up) (local.get $fn))
            (i32.store offset=20 (local.get $up) (i32.const 0))
            (local.set $ui (i32.add (local.get $ui) (i32.const 1)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))
        (if (i32.or (i32.eq (local.get $fn) (global.get $TH_POP_R))
                    (i32.and (i32.ge_u (local.get $fn) (i32.const 331))
                             (i32.le_u (local.get $fn) (i32.const 338))))
          (then
            (i32.store           (local.get $up) (global.get $TU_POP_R))
            (i32.store offset=4  (local.get $up)
              (select (i32.load offset=4 (local.get $p)) (i32.sub (local.get $fn) (i32.const 331))
                      (i32.eq (local.get $fn) (global.get $TH_POP_R))))
            (i32.store offset=8  (local.get $up) (i32.const 0))
            (i32.store offset=12 (local.get $up) (i32.const 0))
            (i32.store offset=16 (local.get $up) (local.get $fn))
            (i32.store offset=20 (local.get $up) (i32.const 0))
            (local.set $ui (i32.add (local.get $ui) (i32.const 1)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))
        (if (i32.and (i32.eq (local.get $fn) (i32.const 34))
                     (i32.eq (i32.sub (local.get $pn) (local.get $p)) (i32.const 12)))
          (then
            (i32.store           (local.get $up) (global.get $TU_PUSH_I))
            (i32.store offset=4  (local.get $up) (i32.const 0))
            (i32.store offset=8  (local.get $up) (i32.const 0))
            (i32.store offset=12 (local.get $up) (i32.load offset=8 (local.get $p)))
            (i32.store offset=16 (local.get $up) (local.get $fn))
            (i32.store offset=20 (local.get $up) (i32.const 0))
            (local.set $ui (i32.add (local.get $ui) (i32.const 1)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))
        (if (call $tree_uop_classify (local.get $p))
          (then (local.set $k (global.get $tu_kind))))
        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            (local.set $extra (i32.add (local.get $extra) (global.get $tu_extra)))
            (i32.store           (local.get $up) (local.get $k))
            (i32.store offset=4  (local.get $up) (global.get $tu_d))
            (i32.store offset=8  (local.get $up) (global.get $tu_a))
            (i32.store offset=12 (local.get $up) (global.get $tu_imm))
            (i32.store offset=16 (local.get $up) (global.get $tu_fn))
            (i32.store offset=20 (local.get $up) (global.get $tu_b))
            (local.set $ui (i32.add (local.get $ui) (i32.const 1)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))
        ;; ---- the round-11 split. Two micro-ops for one op; the room for the
        ;; second was reserved at the top of this iteration.
        (if (call $bx_try_split (local.get $p) (call $bx_next_lane))
          (then
            (call $bx_emit_split (local.get $up))
            (local.set $ui (i32.add (local.get $ui) (global.get $bx_split_n)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))
        ;; ---- fallback: the op's own inline words plus the H459 resume
        ;; trampoline go into the trailing pool, and `b` carries the byte
        ;; offset of the first of them.
        (local.set $nw (i32.shr_u
          (i32.sub (i32.sub (local.get $pn) (local.get $p)) (i32.const 8))
          (i32.const 2)))
        (if (i32.gt_u (i32.add (global.get $bx_rg_fw)
                               (i32.add (local.get $nw) (i32.const 2)))
                      (global.get $BX_RG_FB_MAX))
          (then (return (call $bx_rg_nofit (i32.const 7)))))
        (i32.store           (local.get $up) (global.get $TU_FALLBACK))
        (i32.store offset=4  (local.get $up) (i32.const 0))
        (i32.store offset=8  (local.get $up) (local.get $fn))
        (i32.store offset=12 (local.get $up) (i32.load offset=4 (local.get $p)))
        (i32.store offset=16 (local.get $up) (local.get $fn))
        (i32.store offset=20 (local.get $up)
          (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
        (local.set $j (i32.const 0))
        (block $cp_done
          (loop $cp
            (br_if $cp_done (i32.ge_u (local.get $j) (local.get $nw)))
            (i32.store
              (i32.add (local.get $fbp) (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
              (i32.load (i32.add (local.get $p)
                (i32.add (i32.const 8) (i32.shl (local.get $j) (i32.const 2))))))
            (global.set $bx_rg_fw (i32.add (global.get $bx_rg_fw) (i32.const 1)))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $cp)))
        (i32.store
          (i32.add (local.get $fbp) (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
          (global.get $BX_RESUME_HANDLER))
        (i32.store offset=4
          (i32.add (local.get $fbp) (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
          (i32.const 0))
        (global.set $bx_rg_fw (i32.add (global.get $bx_rg_fw) (i32.const 2)))
            (local.set $ui (i32.add (local.get $ui) (i32.const 1)))
        (local.set $nfb (i32.add (local.get $nfb) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))

    ;; A producer that sat at or past the end of the body never came up in the
    ;; scan, so its micro-op position is simply the end of the list.
    (if (i32.and (i32.ge_s (local.get $tidx) (i32.const 0))
                 (i32.lt_s (local.get $tpos) (i32.const 0)))
      (then (local.set $tpos (local.get $ui))))

    ;; ---- the round-11 optimisation pass, over this member block alone.
    ;; Facts still start empty here: the edge set is not resolved until every
    ;; member is classified, so nothing at this point can say whether a
    ;; successor has one predecessor. $bx_rg_carry_pass runs at emit, where it
    ;; can (section 18).
    ;;
    ;; What IS new in round 12 is the terminator's own write. The flag producer
    ;; was lifted out of the micro-op list above, so walk 1 cannot see that
    ;; term_kind 0/8/9 writes $term_a, and a fact naming that register survived
    ;; across it. Tell it.
    (global.set $bx_opt_term_wreg
      (select (local.get $term_a) (i32.const -1)
        (i32.and (i32.lt_u (local.get $term_a) (i32.const 8))
          (i32.or (i32.eqz (local.get $term_kind))
                  (i32.ge_u (local.get $term_kind) (i32.const 8))))))
    (local.set $ui
      (call $bx_opt_pass (call $bx_rg_uop_at (local.get $u0))
                         (local.get $ui) (local.get $tpos)))
    ;; Record it per member, for the carry pass to replay.
    (i32.store offset=72 (call $bx_rg_rec (global.get $bx_rg_n))
               (global.get $bx_opt_term_wreg))
    (local.set $tpos (global.get $bx_opt_term_pos))
    (local.set $nuops (local.get $ui))

    ;; A bare EA compute as the last micro-op has nobody inside the block to
    ;; consume it, and neither a folded terminator nor $eval_cc reads $ea_temp.
    (if (local.get $nuops)
      (then
        (if (i32.eq
              (i32.load (call $bx_rg_uop_at
                (i32.add (local.get $u0) (i32.sub (local.get $nuops) (i32.const 1)))))
              (global.get $TU_EA_SIB))
          (then (return (call $bx_rg_nofit (i32.const 8)))))))

    ;; ---- ROUND 18: park this member's terminator in the pool -------------
    ;; Last, because every refusal above rewinds the pool cursor and there is
    ;; no refusal after this point. The offset goes in `term_imm`, which a
    ;; term_kind 10 member does not otherwise use, so $REGION_BLOCK_WORDS and
    ;; every existing descriptor's bytes are unchanged -- see section 28.
    (if (i32.eq (local.get $term_kind) (i32.const 10))
      (then
        (if (i32.gt_u
              (i32.add (global.get $bx_rg_fw)
                       (i32.shr_u (local.get $tail_bytes) (i32.const 2)))
              (global.get $BX_RG_FB_MAX))
          (then (return (call $bx_rg_nofit (i32.const 7)))))
        (local.set $term_imm (i32.shl (global.get $bx_rg_fw) (i32.const 2)))
        (local.set $k (i32.const 0))
        (block $tl_done
          (loop $tl
            (br_if $tl_done (i32.ge_u (i32.shl (local.get $k) (i32.const 2))
                                      (local.get $tail_bytes)))
            (i32.store
              (i32.add (local.get $fbp)
                (i32.shl (i32.add (global.get $bx_rg_fw) (local.get $k))
                         (i32.const 2)))
              (i32.load (i32.add (local.get $tail_p)
                          (i32.shl (local.get $k) (i32.const 2)))))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br $tl)))
        (global.set $bx_rg_fw
          (i32.add (global.get $bx_rg_fw)
                   (i32.shr_u (local.get $tail_bytes) (i32.const 2))))
        (global.set $bx_rg_tail_n (i32.add (global.get $bx_rg_tail_n) (i32.const 1)))
        (global.set $bx_rg_tail_admitted
          (i64.add (global.get $bx_rg_tail_admitted) (i64.const 1)))))

    ;; ---- commit the builder record -------------------------------------
    (local.set $rec (call $bx_rg_rec (global.get $bx_rg_n)))
    (i32.store          (local.get $rec) (local.get $u0))         ;; uop_off
    (i32.store offset=4  (local.get $rec) (local.get $nuops))
    (i32.store offset=8  (local.get $rec) (local.get $tpos))      ;; term_pos
    (i32.store offset=12 (local.get $rec) (local.get $term_kind))
    (i32.store offset=16 (local.get $rec) (local.get $term_a))
    (i32.store offset=20 (local.get $rec) (local.get $term_b))
    (i32.store offset=24 (local.get $rec) (local.get $term_uop))
    (i32.store offset=28 (local.get $rec) (local.get $term_imm))
    (i32.store offset=32 (local.get $rec) (local.get $term_cc))
    ;; cost: one $steps per x86 op the unfolded block billed, plus whatever the
    ;; ops charged on their own account ($tu_extra).
    ;;
    ;; ROUND 16: minus $absorbed. An op a fuser swallowed is still an OP_INDEX
    ;; entry -- that is how the fused body finds its address words -- but it is
    ;; inline data on the threaded path and never dispatches, so the arm this
    ;; cost is compared against bills ONE step for the whole run. Without the
    ;; subtraction `--block-exec-x87` would silently give the guest fewer ops
    ;; per batch inside a region than outside one.
    ;;
    ;; ROUND 18: minus one more for a term_kind 10 member. Its terminator is
    ;; NOT folded -- it dispatches through $next on the way out and bills its
    ;; own step there, exactly as it does on the threaded path -- so counting
    ;; it here would charge the guest twice for one instruction.
    (i32.store offset=36 (local.get $rec)
      (i32.sub
        (i32.sub (i32.add (local.get $n) (local.get $extra)) (local.get $absorbed))
        (i32.eq (local.get $term_kind) (i32.const 10))))
    (i32.store offset=40 (local.get $rec) (i32.const 0))          ;; succ_taken, later
    (i32.store offset=44 (local.get $rec) (i32.const 0))          ;; succ_fall, later
    (i32.store offset=48 (local.get $rec) (local.get $start_eip))
    ;; builder-only
    (i32.store offset=52 (local.get $rec) (global.get $d_pc))     ;; guest_end
    (i32.store offset=56 (local.get $rec) (local.get $taken))
    (i32.store offset=60 (local.get $rec) (local.get $fall))
    (i32.store offset=64 (local.get $rec) (local.get $nat))
    (i32.store offset=68 (local.get $rec) (local.get $nfb))
    ;; ROUND 16, builder-only (the emit copies $REGION_BLOCK_WORDS = 13 words,
    ;; so nothing at or past offset 52 reaches the descriptor). 76 is the
    ;; member's TU_X87RUN count and 80 the x87 FALLBACK share of $nfb; the
    ;; region cost model needs both to price an x87 member the way the
    ;; one-block model prices one, and 76+80+$nx87nat is what decides whether
    ;; the installed region gets counted as an x87 region.
    (i32.store offset=76 (local.get $rec) (local.get $nx87run))
    (i32.store offset=80 (local.get $rec) (local.get $nx87fb))
    (i32.store offset=84 (local.get $rec) (local.get $nx87nat))
    (global.set $bx_rg_uops (i32.add (local.get $u0) (local.get $nuops)))
    (i32.const 1))

  ;; ----------------------------------------------------------------------
  ;; Collector entry point, called from $decode_block. Round 9 armed this from
  ;; $decode_run and collected along the run's fall-through chain; round 10
  ;; arms it only from $bx_walk_try, so a decode that is not part of a
  ;; discovery walk pays one global load here and nothing else. That deleted
  ;; cost is the 412,327 `shortChain` declines the round-9 quake2 window spent
  ;; classifying blocks that could never become a region.
  ;; ----------------------------------------------------------------------

  ;; One classify refusal, recorded by reason, returning the 0 the caller
  ;; wants so a decline site stays one expression. 1 empty block, 2 byte-form
  ;; fused test+Jcc, 3 no flag producer, 4 terminator is not a modelled edge,
  ;; 5 micro-op array full, 6 op the executor may not run natively,
  ;; 7 fallback pool full, 8 trailing EA_SIB.
  ;;
  ;; It also rewinds the fallback pool. A refusal can happen AFTER the body
  ;; scan has copied a fallback's inline words into the pool, and in round 9
  ;; that leak was invisible because every refusal either ended the chain or
  ;; restarted the builder, both of which reset the cursor. The walker keeps
  ;; collecting after a refused block, so the rewind has to be explicit.
  (func $bx_rg_nofit (param $r i32) (result i32)
    (local $p i32)
    (global.set $bx_rg_fw (global.get $bx_rg_fw0))
    ;; ROUND 18 census. Reason 4 is the one the side exit is aimed at, and the
    ;; per-walk counter is what lets $bx_region_finish say whether THIS walk
    ;; would have become (or grown) a region if the block had been admitted.
    (if (i32.eq (local.get $r) (i32.const 4))
      (then
        (global.set $bx_rg_tailref
          (i32.add (global.get $bx_rg_tailref) (i32.const 1)))
        (global.set $bx_rg_tail_refusals
          (i64.add (global.get $bx_rg_tail_refusals) (i64.const 1)))))
    (local.set $p (call $bx_rg_word
      (i32.add (global.get $BX_RG_NOFIT_OFF) (local.get $r))))
    (i32.store (local.get $p) (i32.add (i32.load (local.get $p)) (i32.const 1)))
    (i32.const 0))

  ;; One collect refusal, recorded by reason and by whether the walk already
  ;; had members. Slots 0..3 are the reason at n==0, 4..7 the same reason at
  ;; n>=1. Unlike round 9 this does NOT disarm the collector: a block the
  ;; walker cannot classify is simply not a member, and the edge into it
  ;; becomes one of the region's exits.
  (func $bx_rg_cfail (param $r i32)
    (local $p i32)
    (local.set $p (call $bx_rg_word
      (i32.add (global.get $BX_RG_CFAIL_OFF)
        (i32.add (local.get $r)
          (select (i32.const 4) (i32.const 0)
                  (i32.ne (global.get $bx_rg_n) (i32.const 0)))))))
    (i32.store (local.get $p) (i32.add (i32.load (local.get $p)) (i32.const 1))))

  ;; Called from $decode_block, before $loop_match_block, on every block --
  ;; including every block decoded outside a walk, where $bx_rg_active is 0 and
  ;; this is one load and a branch.
  (func $bx_region_collect (param $start_eip i32)
    (if (i32.eqz (global.get $bx_rg_active)) (then (return)))
    (if (i32.or
          (i32.ge_u (global.get $bx_rg_n) (global.get $REGION_MAX_BLOCKS))
          (i32.ge_u (global.get $bx_rg_n) (global.get $bx_region_enabled)))
      (then (call $bx_rg_cfail (i32.const 1)) (return)))
    (if (i32.or (global.get $op_index_poison) (i32.eqz (global.get $op_index_n)))
      (then (call $bx_rg_cfail (i32.const 2)) (return)))
    ;; A block the classifier refuses is simply not a member; the edge into it
    ;; becomes an exit. That is what makes a `call`- or `ret`-terminated
    ;; successor cost nothing here beyond its own decode.
    (if (i32.eqz (call $bx_rg_classify_block (local.get $start_eip)))
      (then (call $bx_rg_cfail (i32.const 3)) (return)))
    (global.set $bx_rg_n (i32.add (global.get $bx_rg_n) (i32.const 1))))

  ;; ---- the raw-wanted table (round 13) ---------------------------------
  (func $bx_raw_slot (param $ga i32) (result i32)
    (call $bx_rg_word
      (i32.add (global.get $BX_RG_RAW_OFF)
        (i32.and
          (i32.xor (local.get $ga) (i32.shr_u (local.get $ga) (i32.const 12)))
          (global.get $BX_RG_RAW_MASK)))))

  (func $bx_raw_wanted (param $ga i32) (result i32)
    (i32.eq (i32.load (call $bx_raw_slot (local.get $ga))) (local.get $ga)))

  ;; Claim this address for the region family and take back the descriptor that
  ;; is standing on it, so the guest's next entry publishes the threaded stream
  ;; a walk can read.
  (func $bx_raw_want (param $ga i32)
    (if (call $bx_raw_wanted (local.get $ga)) (then (return)))
    (i32.store (call $bx_raw_slot (local.get $ga)) (local.get $ga))
    (global.set $bx_raw_wants (i32.add (global.get $bx_raw_wants) (i32.const 1)))
    (global.set $bx_walk_marked (i32.const 1))
    (call $page_retire_ga (local.get $ga)))

  ;; ----------------------------------------------------------------------
  ;; ROUND 13 -- classify a block that is ALREADY in the thread cache.
  ;;
  ;; The classifier's whole input is OP_INDEX plus $d_pc: the addresses of this
  ;; block's threaded ops, and the guest address one past its last byte. Both
  ;; used to exist only for the instant between a decode and the next one,
  ;; which is why discovery re-decoded. $page_cached_ops rebuilds OP_INDEX from
  ;; the published stream and the bitmaps beside it, and $page_cached_end reads
  ;; the guest extent out of the byte index -- the same walk $page_retire_at
  ;; does. Nothing is decoded, nothing is emitted, and the page registers do
  ;; not move.
  ;;
  ;; Returns 1 when the block was readable (whether or not the classifier
  ;; accepted it -- a refusal makes the edge an exit, and the caller's own
  ;; member test sees that), 0 when it is not compiled, is a descriptor, or
  ;; its ops cannot be described.
  ;; ----------------------------------------------------------------------
  (func $bx_classify_cached (param $ga i32) (result i32)
    (local $n i32) (local $e i32)
    (local.set $n (call $page_cached_ops (local.get $ga)))
    (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
    (local.set $e (call $page_cached_end (local.get $ga)))
    (if (i32.le_u (local.get $e) (local.get $ga)) (then (return (i32.const 0))))
    (global.set $op_index_n (local.get $n))
    (global.set $op_index_poison (i32.const 0))
    (global.set $d_pc (local.get $e))
    (call $bx_region_collect (local.get $ga))
    (global.set $op_index_n (i32.const 0))
    (i32.const 1))

  ;; Member index whose entry EIP is $ga, or -1.
  (func $bx_rg_member (param $ga i32) (result i32)
    (local $i i32)
    (block $done
      (loop $s
        (br_if $done (i32.ge_u (local.get $i) (global.get $bx_rg_n)))
        (if (i32.eq (i32.load offset=48 (call $bx_rg_rec (local.get $i)))
                    (local.get $ga))
          (then (return (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $s)))
    (i32.const -1))

  ;; Resolve one edge: a member index, or an exit slot encoded as -1-slot.
  ;; $nexits is carried in the scratch word just below the exit table so the
  ;; resolver can allocate slots without a second out-parameter.
  (func $bx_rg_edge (param $ga i32) (result i32)
    (local $m i32) (local $i i32) (local $ne i32) (local $ep i32)
    (local.set $m (call $bx_rg_member (local.get $ga)))
    (if (i32.ge_s (local.get $m) (i32.const 0)) (then (return (local.get $m))))
    (local.set $ep (call $bx_rg_word (global.get $BX_RG_EXIT_OFF)))
    (local.set $ne (i32.load (call $bx_rg_word
                     (i32.sub (global.get $BX_RG_EXIT_OFF) (i32.const 1)))))
    (block $done
      (loop $s
        (br_if $done (i32.ge_u (local.get $i) (local.get $ne)))
        (if (i32.eq (i32.load (i32.add (local.get $ep)
                                (i32.shl (local.get $i) (i32.const 3))))
                    (local.get $ga))
          (then (return (i32.sub (i32.const -1) (local.get $i)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $s)))
    (if (i32.ge_u (local.get $ne) (global.get $REGION_MAX_EXITS))
      (then (return (i32.const 0x7FFFFFFF))))
    (i32.store (i32.add (local.get $ep) (i32.shl (local.get $ne) (i32.const 3)))
               (local.get $ga))
    ;; Every exit publishes all eight. A region has more than one path to most
    ;; of its exits and the union of what those paths define is what a mask
    ;; would have to be; publishing a register the region never wrote is a
    ;; no-op, since the local still holds the value it was loaded with.
    (i32.store offset=4 (i32.add (local.get $ep) (i32.shl (local.get $ne) (i32.const 3)))
               (i32.const 0xFF))
    (i32.store (call $bx_rg_word
                 (i32.sub (global.get $BX_RG_EXIT_OFF) (i32.const 1)))
               (i32.add (local.get $ne) (i32.const 1)))
    (i32.sub (i32.const -1) (local.get $ne)))

  ;; ----------------------------------------------------------------------
  ;; ROUND 12 (section 18) -- CARRY LOAD FACTS ACROSS A REGION EDGE.
  ;;
  ;; Section 16.2's rule already permits a carry along an edge whose target has
  ;; a single predecessor inside the region; round 11's implementation took the
  ;; conservative end of that permission and carried nothing, because the edge
  ;; set is not resolved until every member has been classified. This runs
  ;; after it is, over the members in index order, re-walking each one's
  ;; micro-ops -- and seeding the fact table from the previous member's exit
  ;; state exactly when that member is the target's ONE in-region predecessor.
  ;;
  ;; Three things make the seed sound, and all three are the existing rule
  ;; rather than a new one:
  ;;
  ;;  * A region is only ever ENTERED at its head. A member reached from
  ;;    outside gets decoded as a block of its own, which retires the region
  ;;    ($bx_rg_thrash_ok), so "one predecessor inside the region" really is
  ;;    "one predecessor".
  ;;  * Everything that kills a fact inside a block still kills it: this is the
  ;;    same walk, so a store on the carried edge, an unmodelled op, a
  ;;    fallback, an x87 op or a write to a fact's base register all kill
  ;;    exactly as they did within one block.
  ;;  * The FOLDED TERMINATOR on the carried edge kills too, through
  ;;    $bx_opt_term_wreg: term_kind 0/8/9 write $term_a and are not in the
  ;;    micro-op list, so without that kill a carry would step straight over a
  ;;    `inc esi` / `add esi,4` that moved the base.
  ;;
  ;; Restricting the seed to `pred == m - 1` is an implementation limit, not the
  ;; rule: seeding from an arbitrary predecessor means storing one fact table
  ;; per member, while walking members in index order gives the m-1 case for
  ;; free. Every other single-predecessor edge is counted in $bx_carry_refused,
  ;; which is exactly the measure of what a per-member table would add.
  ;;
  ;; Walk 2 is deliberately NOT re-run. It deletes micro-ops, and $total plus
  ;; every member's uop_off were fixed when it ran; walk 1 only rewrites one in
  ;; place, so the descriptor's shape is untouched by this pass.
  ;; ----------------------------------------------------------------------
  (func $bx_rg_carry_pass (param $n i32)
    (local $m i32) (local $j i32) (local $np i32) (local $pred i32)
    (local $rec i32) (local $rj i32) (local $carry i32)
    (if (i32.eqz (global.get $block_exec_split)) (then (return)))
    (global.set $bx_opt_carry_mode (i32.const 1))
    (local.set $m (i32.const 0))
    (block $m_done
      (loop $ms
        (br_if $m_done (i32.ge_u (local.get $m) (local.get $n)))
        (local.set $rec (call $bx_rg_rec (local.get $m)))
        ;; ---- how many members have an edge into m? A block whose two
        ;; successors are both m is ONE predecessor, not two.
        (local.set $np (i32.const 0))
        (local.set $pred (i32.const -1))
        (local.set $j (i32.const 0))
        (block $j_done
          (loop $js
            (br_if $j_done (i32.ge_u (local.get $j) (local.get $n)))
            (local.set $rj (call $bx_rg_rec (local.get $j)))
            (if (i32.or
                  (i32.eq (i32.load offset=40 (local.get $rj)) (local.get $m))
                  (i32.eq (i32.load offset=44 (local.get $rj)) (local.get $m)))
              (then
                (local.set $np (i32.add (local.get $np) (i32.const 1)))
                (local.set $pred (local.get $j))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $js)))
        (local.set $carry
          (i32.and (i32.ne (global.get $block_exec_carry) (i32.const 0))
            (i32.and (i32.ne (local.get $m) (i32.const 0))
              (i32.and (i32.eq (local.get $np) (i32.const 1))
                       (i32.eq (local.get $pred)
                               (i32.sub (local.get $m) (i32.const 1)))))))
        (if (local.get $m)
          (then
            (if (local.get $carry)
              (then (global.set $bx_carry_edges
                      (i64.add (global.get $bx_carry_edges) (i64.const 1))))
              (else (global.set $bx_carry_refused
                      (i64.add (global.get $bx_carry_refused) (i64.const 1)))))))
        (global.set $bx_opt_term_pos  (i32.load offset=8  (local.get $rec)))
        (global.set $bx_opt_term_wreg (i32.load offset=72 (local.get $rec)))
        (call $bx_opt_walk1
          (call $bx_rg_uop_at (i32.load (local.get $rec)))
          (i32.load offset=4 (local.get $rec))
          (local.get $carry))
        ;; The terminator runs on the way OUT, so its register write has to be
        ;; in the state the next member inherits. Walk 1 only reaches it when
        ;; the producer stood mid-block; at the end of the block -- which is
        ;; where `inc ecx ; jnz top` puts it -- term_pos == nuops and the loop
        ;; never visits that index.
        (call $bx_kill_term_wreg)
        (local.set $m (i32.add (local.get $m) (i32.const 1)))
        (br $ms)))
    (global.set $bx_opt_carry_mode (i32.const 0)))

  ;; The thrash guard. A member block that something else jumps into gets
  ;; re-decoded, which retires the region; the region's head then misses and
  ;; rebuilds it, which retires the member. Neither step is wrong -- the
  ;; index invariant is preserved both ways -- but the pair can repeat forever
  ;; and would be pure decode cost. 64 direct-mapped slots of (head EIP,
  ;; installs); past 16 the head stops being a region head.
  (func $bx_rg_thrash_ok (param $eip i32) (result i32)
    (local $s i32) (local $c i32)
    (local.set $s (call $bx_rg_word
      (i32.add (global.get $BX_RG_THRASH_OFF)
        (i32.shl (i32.and (i32.shr_u (local.get $eip) (i32.const 4)) (i32.const 63))
                 (i32.const 1)))))
    (if (i32.ne (i32.load (local.get $s)) (local.get $eip))
      (then
        (i32.store (local.get $s) (local.get $eip))
        (i32.store offset=4 (local.get $s) (i32.const 1))
        (return (i32.const 1))))
    (local.set $c (i32.add (i32.load offset=4 (local.get $s)) (i32.const 1)))
    (i32.store offset=4 (local.get $s) (local.get $c))
    (if (i32.gt_u (local.get $c) (i32.const 16))
      (then
        (global.set $bx_region_thrash
          (i32.add (global.get $bx_region_thrash) (i32.const 1)))
        (return (i32.const 0))))
    (i32.const 1))

  ;; One decline, recorded. $bx_region_why keeps the last reason for a quick
  ;; look; the histogram beside it is what answers "what declined most".
  ;; 1 not worth it, 2 exit table full, 3 no room to emit, 4 thrashing,
  ;; 5 publish refused, 6 fewer than two members, 7 unused (round 9's
  ;; "a member declined and the chain ended early", which the walker no longer
  ;; has -- a refused member is just an exit), 8 the discovery budget ran out
  ;; before the closure did, 9 the head was memoised as a repeat failure.
  (func $bx_rg_decline (param $w i32)
    (local $p i32)
    (global.set $bx_region_why (local.get $w))
    (global.set $bx_region_declines
      (i32.add (global.get $bx_region_declines) (i32.const 1)))
    (local.set $p (call $bx_rg_word
      (i32.add (global.get $BX_RG_WHY_OFF)
        (select (i32.const 0) (local.get $w) (i32.gt_u (local.get $w) (i32.const 9))))))
    (i32.store (local.get $p) (i32.add (i32.load (local.get $p)) (i32.const 1))))

  ;; ----------------------------------------------------------------------
  ;; $bx_region_finish -- decide, then emit the descriptor over a fresh piece
  ;; of the arena and publish it at the head EIP. Returns 1 on an install.
  ;;
  ;; The guest extent is [head, max member end). Every member is at or above
  ;; the head by the walker's own rule, so that span covers all of them; bytes
  ;; inside it that belong to no member are covered too, which retires whatever
  ;; used to own them and makes entering one a miss (and therefore a re-decode
  ;; that symmetrically retires the region).
  ;; ----------------------------------------------------------------------
  (func $bx_region_finish (result i32)
    (local $n i32) (local $i i32) (local $j i32) (local $rec i32)
    (local $e i32) (local $ne i32) (local $ep i32)
    (local $nat i32) (local $nfb i32) (local $total i32) (local $bytes i32)
    (local $tstart i32) (local $off i32) (local $head i32) (local $gend i32)
    (local $blocks i32) (local $benefit i32) (local $cost i32)
    ;; Round 14: the head block's displaced threaded stream, saved with the
    ;; region descriptor the way the one-block installer saves its own.
    (local $rawoff i32) (local $rawsrc i32) (local $rawlen i32)
    (local $rawn i32) (local $extra i32) (local $save i32)
    ;; Round 16: the region's x87 split, summed from the member records.
    (local $nx87run i32) (local $nx87fb i32) (local $nx87nat i32)

    (if (i32.eqz (global.get $bx_rg_active)) (then (return (i32.const 0))))
    (global.set $bx_rg_active (i32.const 0))
    (local.set $n (global.get $bx_rg_n))
    (if (i32.lt_u (local.get $n) (i32.const 2))
      (then
        ;; ROUND 18 census. A walk that found fewer than two members but
        ;; refused at least one block for termNotModelled is a region the side
        ;; exit could create -- provided that block also survives the body
        ;; scan and the cost model, which is why this is an UPPER bound.
        (if (i32.ge_u (i32.add (local.get $n) (global.get $bx_rg_tailref))
                      (i32.const 2))
          (then (global.set $bx_rg_tail_would_admit
                  (i32.add (global.get $bx_rg_tail_would_admit) (i32.const 1)))))
        (call $bx_rg_decline (i32.const 6))
        (return (i32.const 0))))
    (local.set $head (global.get $bx_rg_head))
    (if (i32.eqz (call $bx_rg_thrash_ok (local.get $head)))
      (then
        (call $bx_rg_decline (i32.const 4))
        (return (i32.const 0))))

    ;; ---- resolve every edge ---------------------------------------------
    (i32.store (call $bx_rg_word
                 (i32.sub (global.get $BX_RG_EXIT_OFF) (i32.const 1)))
               (i32.const 0))
    (local.set $i (i32.const 0))
    (block $ed_done
      (loop $ed
        (br_if $ed_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $rec (call $bx_rg_rec (local.get $i)))
        ;; ROUND 18. A term_kind 10 member has no in-region successor at all:
        ;; it leaves through its own threaded terminator, so there is no edge
        ;; to resolve and no exit-table slot to claim. Both successor words are
        ;; set to -1, which is not a member index, so $bx_rg_carry_pass's
        ;; predecessor count never attributes an edge to it either. Its share
        ;; of the exits budget is charged below, against $bx_rg_tail_n.
        (if (i32.eq (i32.load offset=12 (local.get $rec)) (i32.const 10))
          (then
            (i32.store offset=40 (local.get $rec) (i32.const -1))
            (i32.store offset=44 (local.get $rec) (i32.const -1))
            (local.set $nat (i32.add (local.get $nat) (i32.load offset=64 (local.get $rec))))
            (local.set $nfb (i32.add (local.get $nfb) (i32.load offset=68 (local.get $rec))))
            (local.set $nx87run (i32.add (local.get $nx87run) (i32.load offset=76 (local.get $rec))))
            (local.set $nx87fb  (i32.add (local.get $nx87fb)  (i32.load offset=80 (local.get $rec))))
            (local.set $nx87nat (i32.add (local.get $nx87nat) (i32.load offset=84 (local.get $rec))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $ed)))
        (local.set $e (call $bx_rg_edge (i32.load offset=60 (local.get $rec))))
        (if (i32.eq (local.get $e) (i32.const 0x7FFFFFFF))
          (then
            (call $bx_rg_decline (i32.const 2))
            (return (i32.const 0))))
        (i32.store offset=44 (local.get $rec) (local.get $e))
        ;; term_kind 4 evaluates no condition and always takes succ_fall, so
        ;; its taken slot must not claim an exit of its own.
        (if (i32.eq (i32.load offset=12 (local.get $rec)) (i32.const 4))
          (then (i32.store offset=40 (local.get $rec) (local.get $e)))
          (else
            (local.set $e (call $bx_rg_edge (i32.load offset=56 (local.get $rec))))
            (if (i32.eq (local.get $e) (i32.const 0x7FFFFFFF))
              (then
                (call $bx_rg_decline (i32.const 2))
                (return (i32.const 0))))
            (i32.store offset=40 (local.get $rec) (local.get $e))))
        (local.set $nat (i32.add (local.get $nat) (i32.load offset=64 (local.get $rec))))
        (local.set $nfb (i32.add (local.get $nfb) (i32.load offset=68 (local.get $rec))))
        (local.set $nx87run (i32.add (local.get $nx87run) (i32.load offset=76 (local.get $rec))))
        (local.set $nx87fb  (i32.add (local.get $nx87fb)  (i32.load offset=80 (local.get $rec))))
        (local.set $nx87nat (i32.add (local.get $nx87nat) (i32.load offset=84 (local.get $rec))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $ed)))

    ;; ---- round 12: now that the edge set is resolved, carry facts across the
    ;; edges whose target has a single in-region predecessor (section 18).
    (call $bx_rg_carry_pass (local.get $n))

    (local.set $ne (i32.load (call $bx_rg_word
                     (i32.sub (global.get $BX_RG_EXIT_OFF) (i32.const 1)))))
    ;; ROUND 18: a side exit through an unmodelled terminator counts against
    ;; the <= 8 exits rule alongside the modelled ones. It owns no exit-table
    ;; slot -- it has no resume EIP to publish, the threaded terminator picks
    ;; the successor -- so the sum is checked here rather than inside
    ;; $bx_rg_edge.
    (if (i32.gt_u (i32.add (local.get $ne) (global.get $bx_rg_tail_n))
                  (global.get $REGION_MAX_EXITS))
      (then
        (call $bx_rg_decline (i32.const 2))
        (return (i32.const 0))))
    (local.set $total (global.get $bx_rg_uops))
    ;; The span's high edge. Round 9's chain was guest-ascending so the last
    ;; member ended it; a closure walk visits in edge order, so take the max.
    (local.set $gend (i32.const 0))
    (local.set $i (i32.const 0))
    (block $gd_done
      (loop $gd
        (br_if $gd_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $e (i32.load offset=52 (call $bx_rg_rec (local.get $i))))
        (if (i32.gt_u (local.get $e) (local.get $gend))
          (then (local.set $gend (local.get $e))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $gd)))

    ;; ---- worth it? -------------------------------------------------------
    ;; The same ns model the one-block installer uses, with the two terms a
    ;; region actually changes. One ENTRY is paid per execution of the region,
    ;; not per block, so the per-entry benefit is the work on the path taken --
    ;; unknown at decode time. Half the region is the estimate: a two-block
    ;; if/else runs one arm, a loop runs its body many times, and the two
    ;; errors are in opposite directions. The transfer term is exact in the
    ;; other direction -- an N-block region saves at least one edge whenever it
    ;; runs more than one block, and (n-1) when it runs them all.
    (local.set $benefit
      (i32.add
        (i32.div_u (i32.mul (local.get $nat) (global.get $BX_C_UOP)) (i32.const 2))
        (i32.mul (i32.sub (local.get $n) (i32.const 1)) (global.get $BX_C_TRANSFER))))
    ;; ROUND 16: price the x87 members the way the one-block model prices them.
    ;; $nfb carries the x87 FALLBACK micro-ops too, so bill those at the higher
    ;; $BX_C_X87FB and the rest at the plain fallback price; a TU_X87RUN is NOT
    ;; in $nfb and is billed at its own, much smaller, $BX_C_X87RUN. With
    ;; --block-exec-x87 off every one of these is zero and the expression is
    ;; the round-10 one, unchanged.
    ;;
    ;; ROUND 18: plus one $BX_C_TRANSFER per term_kind 10 member. Leaving
    ;; through an unmodelled terminator costs the eight-register spill and the
    ;; dispatch into it -- the same pair the one-block path's threaded tail
    ;; pays -- and $BX_C_TRANSFER is exactly what that pair is priced at on the
    ;; benefit side. No other knob moves; the K, thrash, memo and reserve
    ;; settings are round 17's.
    (local.set $cost
      (i32.add (i32.mul (global.get $bx_rg_tail_n) (global.get $BX_C_TRANSFER))
      (i32.add (global.get $BX_C_ENTRY)
        (i32.add
          (i32.mul (local.get $nx87run) (global.get $BX_C_X87RUN))
          (i32.add
            (i32.mul (i32.sub (local.get $nfb) (local.get $nx87fb))
                     (global.get $BX_C_FALLBACK))
            (i32.mul (local.get $nx87fb) (global.get $BX_C_X87FB)))))))
    (if (global.get $block_exec_min_uops)
      (then
        (if (i32.lt_u (local.get $total) (global.get $block_exec_min_uops))
          (then
            (call $bx_rg_decline (i32.const 1))
            (return (i32.const 0)))))
      (else
        (if (i32.le_s (local.get $benefit) (local.get $cost))
          (then
            (call $bx_rg_decline (i32.const 1))
            (return (i32.const 0))))))

    ;; ---- the emit slack, derived exactly as the one-block case does -------
    (local.set $bytes
      (i32.add
        (i32.add (i32.const 24)                              ;; dispatch + header
                 (i32.mul (local.get $n) (i32.const 52)))    ;; block table
        (i32.add (i32.shl (local.get $ne) (i32.const 3))     ;; exit table
          (i32.add (i32.mul (local.get $total) (i32.const 24))
                   (i32.shl (global.get $bx_rg_fw) (i32.const 2))))))
    (if (i32.gt_u (local.get $bytes) (i32.const 4096))
      (then
        (global.set $bx_rg_nr_bytes (i32.add (global.get $bx_rg_nr_bytes) (i32.const 1)))
        (call $bx_rg_decline (i32.const 3))
        (return (i32.const 0))))
    ;; $te's overflow backstop must not fire in the middle of this emit.
    (if (i32.or (global.get $thread_flush_pending)
                (i32.ge_u (global.get $thread_alloc)
                  (i32.sub (global.get $THREAD_END) (i32.const 16384))))
      (then
        (global.set $bx_rg_nr_arena (i32.add (global.get $bx_rg_nr_arena) (i32.const 1)))
        (call $bx_rg_decline (i32.const 3))
        (return (i32.const 0))))

    ;; ---- ROUND 14: SAVE THE HEAD BLOCK'S DISPLACED THREADED STREAM --------
    ;; Section 22 left this undone, and the cost was structural: a region
    ;; descriptor replaces the head's index entry, so a later walk arriving at
    ;; the head found something it could not classify, marked the address and
    ;; RETIRED THE REGION -- throwing away a multi-block install to get one
    ;; block's ops back. The one-block family had not had that problem since
    ;; round 13, because it carries a verbatim copy of the stream it displaced.
    ;; Now the region carries one too, read by the same $page_cached_ops path
    ;; through the same otherwise-unused operand word.
    ;;
    ;; It is cheaper here than in the one-block case. That installer copies out
    ;; of the emit scratch it is about to overwrite; the head block's bytes are
    ;; already published in the page's THREADED chunk and nothing is about to
    ;; move them, so $page_cached_stream just points at them.
    ;;
    ;; $bytes is exactly the offset the copy will land at -- the emit below
    ;; writes the header, block table, exit table, uops and fallback pool, in
    ;; that order, and $bytes is their total by construction.
    (local.set $rawoff (i32.const 0))
    (local.set $extra (i32.const 0))
    (local.set $rawn (call $page_cached_ops (local.get $head)))
    (if (local.get $rawn)
      (then
        (local.set $rawsrc (call $page_cached_stream (local.get $head)))
        (local.set $rawlen (global.get $page_cached_stream_len))
        (if (i32.and (i32.ne (local.get $rawsrc) (i32.const 0))
                     (i32.ne (local.get $rawlen) (i32.const 0)))
          (then
            (local.set $extra
              (i32.add (i32.const 8)
                (i32.add (i32.shl (local.get $rawn) (i32.const 2))
                         (local.get $rawlen))))
            ;; Too big WITH the copy is not a decline: publish the region
            ;; without it, exactly as the one-block path does.
            (if (i32.or
                  (i32.gt_u (i32.add (local.get $bytes) (local.get $extra))
                            (i32.const 4096))
                  (i32.ge_u
                    (i32.add (global.get $thread_alloc)
                      (i32.add (i32.shl (local.get $bytes) (i32.const 1))
                               (i32.const 8192)))
                    (i32.sub (global.get $THREAD_END) (i32.const 4096))))
              (then (local.set $extra (i32.const 0))
                    (global.set $bx_rg_nocopy
                      (i32.add (global.get $bx_rg_nocopy) (i32.const 1))))
              (else
                ;; Stage the table and the bytes past the emit. OP_INDEX is
                ;; about to be reused by $te, so the offsets have to be read
                ;; out of it now.
                (local.set $rawoff (local.get $bytes))
                (local.set $save
                  (i32.add (global.get $thread_alloc)
                    (i32.add (local.get $bytes)
                      (i32.add (local.get $extra) (i32.const 64)))))
                (i32.store (local.get $save) (local.get $rawn))
                (i32.store offset=4 (local.get $save) (local.get $rawlen))
                (local.set $i (i32.const 0))
                (block $rot_done
                  (loop $rot
                    (br_if $rot_done (i32.ge_u (local.get $i) (local.get $rawn)))
                    (i32.store
                      (i32.add (local.get $save)
                        (i32.shl (i32.add (local.get $i) (i32.const 2)) (i32.const 2)))
                      (i32.sub (call $loop_op_at (local.get $i)) (local.get $rawsrc)))
                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                    (br $rot)))
                (memory.copy
                  (i32.add (local.get $save)
                    (i32.add (i32.const 8) (i32.shl (local.get $rawn) (i32.const 2))))
                  (local.get $rawsrc) (local.get $rawlen))
                (local.set $bytes (i32.add (local.get $bytes) (local.get $extra)))))))))

    ;; ---- emit ------------------------------------------------------------
    (local.set $tstart (global.get $thread_alloc))
    (global.set $op_index_n (i32.const 0))
    (global.set $op_index_poison (i32.const 0))
    (call $te (global.get $BX_HANDLER) (local.get $rawoff))
    (call $te_raw (local.get $n))
    (call $te_raw (local.get $ne))
    (call $te_raw (local.get $total))
    (call $te_raw (i32.shl (global.get $bx_rg_fw) (i32.const 2)))  ;; fb_bytes
    (local.set $i (i32.const 0))
    (block $bt_done
      (loop $bt
        (br_if $bt_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $rec (call $bx_rg_rec (local.get $i)))
        (local.set $j (i32.const 0))
        (block $w_done
          (loop $w
            (br_if $w_done (i32.ge_u (local.get $j) (global.get $REGION_BLOCK_WORDS)))
            (call $te_raw (i32.load (i32.add (local.get $rec)
                                      (i32.shl (local.get $j) (i32.const 2)))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $w)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $bt)))
    (local.set $ep (call $bx_rg_word (global.get $BX_RG_EXIT_OFF)))
    (local.set $i (i32.const 0))
    (block $ex_done
      (loop $ex
        (br_if $ex_done (i32.ge_u (local.get $i) (local.get $ne)))
        (call $te_raw (i32.load (i32.add (local.get $ep)
                                  (i32.shl (local.get $i) (i32.const 3)))))
        (call $te_raw (i32.load offset=4 (i32.add (local.get $ep)
                                  (i32.shl (local.get $i) (i32.const 3)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $ex)))
    (local.set $i (i32.const 0))
    (block $uo_done
      (loop $uo
        (br_if $uo_done (i32.ge_u (local.get $i)
          (i32.mul (local.get $total) (global.get $TREE_UOP_WORDS))))
        (call $te_raw (i32.load (call $bx_rg_word
          (i32.add (global.get $BX_RG_UOP_OFF) (local.get $i)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $uo)))
    (local.set $i (i32.const 0))
    (block $fb_done
      (loop $fb
        (br_if $fb_done (i32.ge_u (local.get $i) (global.get $bx_rg_fw)))
        (call $te_raw (i32.load (call $bx_rg_word
          (i32.add (global.get $BX_RG_FB_OFF) (local.get $i)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $fb)))
    ;; ...and, straight after the pool, the head block's saved threaded stream.
    ;; `fb_bytes` above deliberately does NOT include it: a region's terminator
    ;; is folded, so nothing ever reads past the pool, and the copy is inert to
    ;; the executor and visible only to $page_cached_ops.
    (if (local.get $extra)
      (then
        (memory.copy (global.get $thread_alloc) (local.get $save)
                     (local.get $extra))
        (global.set $thread_alloc
          (i32.add (global.get $thread_alloc) (local.get $extra)))))

    ;; ---- publish over the HEAD BLOCK ONLY (round 13) ---------------------
    ;; Round 10 published over [head, max member end), so every member's own
    ;; index entry was retired and the region owned every byte. That is what
    ;; made a write to a member retire the region -- and also what made an
    ;; ordinary transfer INTO a member miss, decode the member afresh, and
    ;; publish it back over the region that had just been built. On the
    ;; 1000-batch quake2 window that loop cost 1.37M extra retires and 3.1M
    ;; block decodes against 781k with the family off.
    ;;
    ;; So the region's index footprint is its head block, exactly the block it
    ;; replaces. The members keep their entries and keep running as ordinary
    ;; blocks when they are entered from outside; entering at the head runs the
    ;; region. Nothing is decoded either way.
    ;;
    ;; The invalidation duty the cover marks used to discharge moves to the
    ;; page: $page_mark_spanreg below sets a bit that makes any guest write to
    ;; this page drop the whole page rather than retire per offset. See
    ;; $page_desc_spanreg in 04-cache.wat.
    (global.set $op_index_n (i32.const 0))
    (local.set $bytes (global.get $thread_alloc))     ;; reused: the emit end
    ;; Admission control. A publish that does not fit drops the WHOLE PAGE and
    ;; re-decodes every block on it; an install is optional, so ask first.
    ;; ROUND 17: reserve 0. A REGION install gets first refusal on the last
    ;; bytes of the page's descriptor chunk; the one-block installer below is
    ;; the family that has to leave room. Section 26.2 measured the asymmetry
    ;; that justifies it -- 2,925 extra one-block descriptors took nrChunkFull
    ;; up 149 and region installs down 448, at a 3.3% install rate where a 1%
    ;; shift in decline mass moves installs by 38%.
    (if (i32.eqz (call $page_desc_would_fit (local.get $head)
                    (i32.sub (local.get $bytes) (local.get $tstart))
                    (i32.const 0)))
      (then
        (global.set $bx_no_room (i32.add (global.get $bx_no_room) (i32.const 1)))
        (global.set $bx_rg_nr_fit (i32.add (global.get $bx_rg_nr_fit) (i32.const 1)))
        (global.set $thread_alloc (local.get $tstart))
        (call $bx_rg_decline (i32.const 3))
        (return (i32.const 0))))
    (local.set $off (call $page_publish (local.get $head) (local.get $tstart)
                      (local.get $bytes)
                      (i32.load offset=52 (call $bx_rg_rec (i32.const 0)))))
    (if (i32.lt_s (local.get $off) (i32.const 0))
      (then
        ;; No home in the chunk. Nothing is executing this copy -- the walker
        ;; runs at a block boundary, not on the path into the block -- so the
        ;; staging bytes are abandoned and the head keeps whatever entry it
        ;; already had. Round 9 had to hand the arena copy back to $decode_run
        ;; here; there is no run to hand it to any more.
        (global.set $bx_region_why (i32.const 5))
        (return (i32.const 0))))
    ;; Counted here and not before the test above: a descriptor that found no
    ;; home in the chunk was emitted, not installed, and counting it as one
    ;; reads as "the matcher is working and the executor never runs it".
    ;; The region stands for guest bytes its index footprint does not cover, so
    ;; the page can no longer be invalidated per offset.
    (if (i32.gt_u (local.get $gend)
                  (i32.load offset=52 (call $bx_rg_rec (i32.const 0))))
      (then (call $page_mark_spanreg (local.get $head))))
    (global.set $bx_region_installs
      (i32.add (global.get $bx_region_installs) (i32.const 1)))
    ;; ROUND 18. The census half: an installed region that still refused a
    ;; block for termNotModelled is one the side exit could have grown. The
    ;; coverage half: how many regions carry a term_kind 10 member, and how
    ;; many such members there are in total.
    (if (global.get $bx_rg_tailref)
      (then (global.set $bx_rg_tail_would_grow
              (i32.add (global.get $bx_rg_tail_would_grow) (i32.const 1)))))
    (if (global.get $bx_rg_tail_n)
      (then
        (global.set $bx_rg_tail_regions
          (i32.add (global.get $bx_rg_tail_regions) (i32.const 1)))
        (global.set $bx_rg_tail_members
          (i32.add (global.get $bx_rg_tail_members) (global.get $bx_rg_tail_n)))))
    ;; Round 16: regions that actually carry x87. Counted at INSTALL and not at
    ;; classify, because a member that was classified into a region nobody
    ;; installed is not coverage.
    (if (i32.or (local.get $nx87run)
                (i32.or (local.get $nx87fb) (local.get $nx87nat)))
      (then (global.set $bx_rg_x87_regions
              (i32.add (global.get $bx_rg_x87_regions) (i32.const 1)))))
    (global.set $bx_region_blocks
      (i32.add (global.get $bx_region_blocks) (local.get $n)))
    (local.set $i (call $bx_rg_word
      (i32.add (global.get $BX_RG_HIST_OFF) (local.get $n))))
    (i32.store (local.get $i) (i32.add (i32.load (local.get $i)) (i32.const 1)))
    ;; Reclaim the staging bytes, but only when publishing left $thread_alloc
    ;; exactly where the emit ended -- $page_publish can itself carve a chunk
    ;; out of the arena, and rewinding over that would hand the next block's
    ;; emit the memory the page is about to run from. Same rule, same reason,
    ;; as $publish_block.
    (if (i32.eq (global.get $thread_alloc) (local.get $bytes))
      (then (global.set $thread_alloc (local.get $tstart))))
    (global.set $bx_region_why (i32.const 0))
    (i32.const 1))

  ;; ======================================================================
  ;; DISCOVERY BY CFG WALK (round 10)
  ;; ======================================================================

  ;; The hotness gate. 512 direct-mapped slots of {head EIP, entries}. Bumped
  ;; from $branch_end -- which is every taken branch, every jmp and every
  ;; $th_block_end, i.e. exactly "this address is a branch target" -- and it
  ;; fires a walk on the $bx_walk_hot_k'th entry, then rearms at zero. The
  ;; memo below is what stops the rearm from turning into an unbounded retry.
  ;; The $branch_end gate is the AND of the two switches, cached in its own
  ;; global so the hot path never reads two. Both setters call this.
  (func $bx_hot_gate_refresh
    (global.set $bx_hot_on
      (i32.or
        (i32.and (i32.ne (global.get $block_exec_enabled) (i32.const 0))
                 (i32.ne (global.get $bx_region_enabled) (i32.const 0)))
        (global.get $uop_enabled)))
    (call $be_gate_refresh))

  (func $bx_hot_slot (param $eip i32) (result i32)
    (call $bx_rg_word
      (i32.add (global.get $BX_RG_HOT_OFF)
        (i32.shl (i32.and (i32.shr_u (local.get $eip) (i32.const 2))
                          (i32.const 511))
                 (i32.const 1)))))

  ;; Halve every hot-table count (the age tick of $bx_hot_bump).
  (func $bx_hot_halve
    (local $p i32) (local $e i32)
    (global.set $bx_hot_halvings (i32.add (global.get $bx_hot_halvings) (i32.const 1)))
    (local.set $p (i32.add (call $bx_rg_word (global.get $BX_RG_HOT_OFF)) (i32.const 4)))
    (local.set $e (i32.add (local.get $p) (i32.const 4096)))
    (loop $l
      (i32.store (local.get $p) (i32.shr_u (i32.load (local.get $p)) (i32.const 1)))
      (local.set $p (i32.add (local.get $p) (i32.const 8)))
      (br_if $l (i32.lt_u (local.get $p) (local.get $e)))))

  (func $bx_hot_bump (param $eip i32)
    (local $s i32) (local $c i32)
    ;; Only with sticky slots: reset-on-sight already forgets, and
    ;; --no-uop-hot-sticky must stay the pre-section-21.5 gate exactly.
    (if (i32.and (i32.ne (global.get $bx_hot_age) (i32.const 0))
                 (i32.ne (global.get $bx_hot_sticky) (i32.const 0)))
      (then
        (global.set $bx_hot_age_left (i32.sub (global.get $bx_hot_age_left) (i32.const 1)))
        (if (i32.le_s (global.get $bx_hot_age_left) (i32.const 0))
          (then
            (global.set $bx_hot_age_left (global.get $bx_hot_age))
            (call $bx_hot_halve)))))
    (local.set $s (call $bx_hot_slot (local.get $eip)))
    (if (i32.ne (i32.load (local.get $s)) (local.get $eip))
      (then
        ;; Sticky: a foreign entry wears the resident's count down by one and
        ;; only takes the slot at zero. Resetting on sight let a head entered
        ;; one time in eighteen keep a 150K-entry head below the threshold for
        ;; a whole run -- Caesar III's blit tail at exe+0x41de07 shares its
        ;; slot with exe+0x41f606 and was never compiled (section 21.5). With
        ;; the decay the hotter of two sharers keeps the slot and reaches the
        ;; threshold; a squatter that went cold is worn out by at most 255
        ;; entries of its successor.
        (if (i32.and (i32.ne (global.get $bx_hot_sticky) (i32.const 0))
                     (i32.ne (i32.load offset=4 (local.get $s)) (i32.const 0)))
          (then
            (global.set $bx_hot_decays (i32.add (global.get $bx_hot_decays) (i32.const 1)))
            (i32.store offset=4 (local.get $s)
              (i32.sub (i32.load offset=4 (local.get $s)) (i32.const 1)))
            (return)))
        ;; The slot is taken over and its count lost: two heads sharing a
        ;; slot reset each other and neither ever reaches the threshold.
        ;; Counted so --uop-census can say how often a warm count is lost.
        (global.set $bx_hot_evicts (i32.add (global.get $bx_hot_evicts) (i32.const 1)))
        (if (i32.ge_u (i32.load offset=4 (local.get $s)) (i32.const 16))
          (then (global.set $bx_hot_evicts_warm
                  (i32.add (global.get $bx_hot_evicts_warm) (i32.const 1)))))
        (i32.store (local.get $s) (local.get $eip))
        (i32.store offset=4 (local.get $s) (i32.const 1))
        (return)))
    (local.set $c (i32.add (i32.load offset=4 (local.get $s)) (i32.const 1)))
    (if (i32.lt_u (local.get $c) (global.get $bx_walk_hot_k))
      (then
        (i32.store offset=4 (local.get $s) (local.get $c))
        (return)))
    (i32.store offset=4 (local.get $s) (i32.const 0))
    (global.set $bx_walk_hot_probes
      (i32.add (global.get $bx_walk_hot_probes) (i32.const 1)))
    ;; The micro-op tier (07d) shares this hotness gate and replaces the walk.
    ;; A settled "never" (declined, or retired as poor) is marked in the page
    ;; index under $uop_fast, and transfers into the head stop counting.
    (if (global.get $uop_enabled)
      (then
        (if (i32.and (call $uop_try (local.get $eip)) (global.get $uop_fast))
          (then (call $page_nobump_mark (local.get $eip))))
        (return)))
    (call $bx_walk_try (local.get $eip)))

  (func (export "set_uop_hot_sticky") (param $on i32)
    (global.set $bx_hot_sticky (local.get $on)))
  (func (export "uop_hot_decays") (result i32) (global.get $bx_hot_decays))
  ;; --uop-hot-age=N: halve every hot count each N bumps (0 = never).
  (func (export "set_uop_hot_age") (param $n i32)
    (global.set $bx_hot_age (select (local.get $n) (i32.const 0) (i32.gt_s (local.get $n) (i32.const 0))))
    (global.set $bx_hot_age_left (global.get $bx_hot_age)))
  (func (export "uop_hot_halvings") (result i32) (global.get $bx_hot_halvings))

  ;; The per-head failure memo. 256 direct-mapped slots of {head EIP, fails}.
  ;; A head that has declined $bx_walk_memo_max times is never walked again,
  ;; which is what makes the discovery cost per head a constant rather than a
  ;; rate. A successful install clears the entry, so a region retired by SMC
  ;; can be rediscovered.
  (func $bx_memo_slot (param $eip i32) (result i32)
    (call $bx_rg_word
      (i32.add (global.get $BX_RG_MEMO_OFF)
        (i32.shl (i32.and (i32.shr_u (local.get $eip) (i32.const 2))
                          (i32.const 255))
                 (i32.const 1)))))

  (func $bx_memo_ok (param $eip i32) (result i32)
    (local $s i32)
    (local.set $s (call $bx_memo_slot (local.get $eip)))
    (if (i32.ne (i32.load (local.get $s)) (local.get $eip)) (then (return (i32.const 1))))
    (i32.lt_u (i32.load offset=4 (local.get $s)) (global.get $bx_walk_memo_max)))

  (func $bx_memo_note (param $eip i32) (param $ok i32)
    (local $s i32)
    (local.set $s (call $bx_memo_slot (local.get $eip)))
    (if (i32.ne (i32.load (local.get $s)) (local.get $eip))
      (then
        (i32.store (local.get $s) (local.get $eip))
        (i32.store offset=4 (local.get $s) (i32.const 0))))
    (if (local.get $ok)
      (then (i32.store offset=4 (local.get $s) (i32.const 0)))
      (else
        (i32.store offset=4 (local.get $s)
          (i32.add (i32.load offset=4 (local.get $s)) (i32.const 1)))
        ;; The moment this head stops being asked about at all.
        (if (i32.eq (i32.load offset=4 (local.get $s)) (global.get $bx_walk_memo_max))
          (then (global.set $bx_memo_locked
                  (i32.add (global.get $bx_memo_locked) (i32.const 1))))))))

  ;; Push one edge target onto the worklist if it is not there already.
  ;; Returns 0 when the list is full, which is a decline rather than a
  ;; truncation: a region whose edges were silently dropped would resolve them
  ;; as exits and could exceed nothing, but it would also not be the region the
  ;; walk set out to build, and a shape that varies with table pressure is not
  ;; one a PNG sweep can hold still.
  (func $bx_wl_push (param $ga i32) (result i32)
    (local $i i32) (local $n i32) (local $p i32)
    (local.set $p (call $bx_rg_word (global.get $BX_RG_WL_OFF)))
    (local.set $n (global.get $bx_rg_wl_n))
    (block $dup
      (loop $s
        (br_if $dup (i32.ge_u (local.get $i) (local.get $n)))
        (if (i32.eq (i32.load (i32.add (local.get $p)
                                (i32.shl (local.get $i) (i32.const 2))))
                    (local.get $ga))
          (then (return (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $s)))
    (if (i32.ge_u (local.get $n) (i32.const 64)) (then (return (i32.const 0))))
    (i32.store (i32.add (local.get $p) (i32.shl (local.get $n) (i32.const 2)))
               (local.get $ga))
    (global.set $bx_rg_wl_n (i32.add (local.get $n) (i32.const 1)))
    (i32.const 1))

  ;; ----------------------------------------------------------------------
  ;; $bx_walk_try -- one discovery attempt at one hot head.
  ;;
  ;; A closure walk over the block graph: pop an address, decode it (which
  ;; classifies it into the builder through $bx_region_collect), push both its
  ;; successors, repeat. Both edges of every member are followed, which is the
  ;; whole difference from round 9 -- a Jcc target, a `jmp` target and a loop
  ;; back edge are all ordinary worklist entries now, where before only a
  ;; fall-through could extend the set.
  ;;
  ;; Four things bound the cost, and all four are needed:
  ;;   * the HOTNESS GATE above -- a walk is attempted only for a head that
  ;;     has been branched to $bx_walk_hot_k times;
  ;;   * the ATTEMPT BUDGET here -- $bx_walk_budget blocks visited, after which
  ;;     the attempt declines rather than truncating;
  ;;   * the MEMO -- a head that declined too often is never retried;
  ;;   * the THRASH GUARD, unchanged from round 9, on the install side.
  ;;
  ;; An address that is not walked is not an error: it is simply not a member,
  ;; and the edge into it resolves to an exit in $bx_region_finish.
  ;; ----------------------------------------------------------------------
  (func $bx_walk_once (param $head i32) (result i32)
    (local $wi i32) (local $eip i32) (local $page i32) (local $budget i32)
    (local $before i32) (local $rec i32) (local $ok i32) (local $p i32)
    (local $hdesc i32)

    (if (i32.eqz (call $bx_walk_head_ok (local.get $head)))
      (then (return (i32.const 0))))
    (global.set $bx_walk_attempts
      (i32.add (global.get $bx_walk_attempts) (i32.const 1)))
    ;; Round 16: was the one-block family already standing on this head?
    (local.set $hdesc (call $page_cached_is_desc (local.get $head)))
    (if (local.get $hdesc)
      (then (global.set $bx_rg_head_desc
              (i32.add (global.get $bx_rg_head_desc) (i32.const 1)))))
    (global.set $bx_walk_min_below (i32.const 0))

    (local.set $page (i32.and (local.get $head) (i32.const 0xFFFFF000)))
    (local.set $budget (global.get $bx_walk_budget))
    (global.set $bx_rg_active (i32.const 1))
    (global.set $bx_rg_walk   (i32.const 1))
    (global.set $bx_rg_n      (i32.const 0))
    (global.set $bx_rg_uops   (i32.const 0))
    (global.set $bx_rg_fw     (i32.const 0))
    (global.set $bx_rg_fw0    (i32.const 0))
    (global.set $bx_rg_head   (local.get $head))
    (global.set $bx_rg_wl_n   (i32.const 0))
    ;; ROUND 18: per-walk state -- the census counter and the count of
    ;; term_kind 10 members this build has taken.
    (global.set $bx_rg_tailref (i32.const 0))
    (global.set $bx_rg_tail_n  (i32.const 0))
    (drop (call $bx_wl_push (local.get $head)))

    (local.set $ok (i32.const 1))
    (block $walk_done
      (loop $walk
        (br_if $walk_done (i32.ge_u (local.get $wi) (global.get $bx_rg_wl_n)))
        (local.set $eip
          (i32.load (i32.add (call $bx_rg_word (global.get $BX_RG_WL_OFF))
                      (i32.shl (local.get $wi) (i32.const 2)))))
        (local.set $wi (i32.add (local.get $wi) (i32.const 1)))
        ;; Already a member: nothing to do, the edge resolves to it.
        (br_if $walk (i32.ge_s (call $bx_rg_member (local.get $eip)) (i32.const 0)))
        ;; Out of the head's page, or BELOW the head. The second is the rule
        ;; that keeps the published span's first byte the region's entry point
        ;; -- see the comment on $bx_rg_walk. Either way this address is an
        ;; exit, not a member.
        (br_if $walk (i32.ne (i32.and (local.get $eip) (i32.const 0xFFFFF000))
                             (local.get $page)))
        (if (i32.lt_u (local.get $eip) (local.get $head))
          (then
            (if (i32.or (i32.eqz (global.get $bx_walk_min_below))
                        (i32.lt_u (local.get $eip) (global.get $bx_walk_min_below)))
              (then (global.set $bx_walk_min_below (local.get $eip))))
            (br $walk)))
        ;; The budget. Declining here rather than truncating keeps the shape a
        ;; function of the code and not of how much of the budget earlier edges
        ;; happened to spend.
        (if (i32.eqz (local.get $budget))
          (then
            (call $bx_rg_decline (i32.const 8))
            (local.set $ok (i32.const 0))
            (br $walk_done)))
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $before (global.get $bx_rg_n))
        (global.set $bx_walk_blocks
          (i64.add (global.get $bx_walk_blocks) (i64.const 1)))
        ;; ROUND 13. A walk NEVER decodes. It used to call $decode_block here,
        ;; which republished the block and then republished the region over it
        ;; -- 724,450 decodes on the 1000-batch quake2 window, and every one of
        ;; them a block the guest had already compiled. The micro-ops are now
        ;; recovered from the PUBLISHED threaded code instead, through the
        ;; op-boundary bitmaps $page_publish writes beside every block.
        ;;
        ;; A successor that is not compiled yet is simply not a member: the
        ;; edge into it becomes one of the region's exits, exactly as a
        ;; successor the classifier refuses does. The guest will compile it in
        ;; the ordinary course of running, and the head's gate -- which rearms
        ;; -- brings the walk back when it has. Decoding it here to find out
        ;; what it looks like is the thing this round exists to delete.
        (if (i32.eqz (call $bx_classify_cached (local.get $eip)))
          (then
            ;; A one-block descriptor is standing where this member should be.
            ;; Take it back and try again on the next pass; see $bx_raw_want.
            (if (call $page_cached_is_desc (local.get $eip))
              (then (call $bx_raw_want (local.get $eip))))
            (global.set $bx_walk_uncached
              (i32.add (global.get $bx_walk_uncached) (i32.const 1)))
            (br $walk)))
        ;; Refused by the classifier: not a member, and the edge is an exit.
        (br_if $walk (i32.eq (global.get $bx_rg_n) (local.get $before)))
        (local.set $rec (call $bx_rg_rec (local.get $before)))
        (global.set $bx_walk_uops
          (i64.add (global.get $bx_walk_uops)
            (i64.extend_i32_u (i32.load offset=4 (local.get $rec)))))
        (if (i32.eqz (call $bx_wl_push (i32.load offset=60 (local.get $rec))))
          (then
            (call $bx_rg_decline (i32.const 8))
            (local.set $ok (i32.const 0))
            (br $walk_done)))
        (if (i32.eqz (call $bx_wl_push (i32.load offset=56 (local.get $rec))))
          (then
            (call $bx_rg_decline (i32.const 8))
            (local.set $ok (i32.const 0))
            (br $walk_done)))
        (br $walk)))

    (global.set $bx_rg_walk (i32.const 0))
    (if (local.get $ok)
      (then (local.set $ok (call $bx_region_finish)))
      (else (global.set $bx_rg_active (i32.const 0))))
    (if (local.get $ok)
      (then (global.set $bx_walk_installs
              (i32.add (global.get $bx_walk_installs) (i32.const 1))))
      (else
        (if (local.get $hdesc)
          (then (global.set $bx_rg_head_desc_fail
                  (i32.add (global.get $bx_rg_head_desc_fail) (i32.const 1)))))))
    (local.get $ok))

  ;; ----------------------------------------------------------------------
  ;; $bx_walk_head_ok -- may a walk be started here at all? Split out of
  ;; $bx_walk_try so the re-anchored second attempt below is held to exactly
  ;; the same standard as the first.
  ;;
  ;; The head must be an address the interpreter has ALREADY compiled code at.
  ;; $branch_end's gate fires for every value $eip takes at a block edge, and
  ;; not all of them are code: the sentinel 0 a `ret` off the end of the guest
  ;; stack leaves behind, an API thunk address, a wild transfer a crash is
  ;; about to report. Decoding those traps inside $decode_block for a reason
  ;; that has nothing to do with the guest -- 0 lands in the "execution entered
  ;; zeros" check, which is a true statement about a false premise.
  ;;
  ;; Zero is tested on its own and not left to $page_probe, because $page_probe
  ;; CANNOT reject it: an unused page-directory slot holds the tag 0, which is
  ;; exactly page 0's tag, so the slot matches and the probe reads an index out
  ;; of address 0 and reports cover. Every other address the probe does answer
  ;; for, and it moves no page registers and counts no hit or miss.
  ;; ----------------------------------------------------------------------
  (func $bx_walk_head_ok (param $head i32) (result i32)
    (if (i32.eqz (global.get $block_exec_enabled)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $bx_region_enabled)) (then (return (i32.const 0))))
    ;; Never re-enter: $decode_block runs the collector, and a walk started
    ;; inside a walk would share the one builder.
    (if (global.get $bx_rg_active) (then (return (i32.const 0))))
    ;; The same standing-down conditions the one-block matcher has, plus the
    ;; arena: decoding into a flush-pending arena is what $decode_block itself
    ;; refuses to do.
    (if (i32.or (global.get $code16) (global.get $fault_unmapped))
      (then (return (i32.const 0))))
    (if (global.get $thread_flush_pending) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $head)) (then (return (i32.const 0))))
    (if (thunk-contains (local.get $head))
      (then (return (i32.const 0))))
    (call $page_probe (local.get $head)))

  ;; ----------------------------------------------------------------------
  ;; $bx_walk_try -- one discovery attempt, and a RE-ANCHOR HINT when it fails.
  ;;
  ;; The walk refuses any member below its head, because the published span
  ;; must start at the region's one entry point. That rule costs nothing when
  ;; the hot head is the lowest address of its loop, and everything when it is
  ;; not: a loop discovered from its BOTTOM block -- the join of a diamond
  ;; reached by a forward `jmp` before the back edge has run K times -- turns
  ;; away its own loop top and collects one block.
  ;;
  ;; The fix is NOT to walk again immediately from the lower address. A region
  ;; may only be installed while the guest is standing at its entry, and here
  ;; the guest is standing at the bottom block. Install from the top anyway and
  ;; the very next transfer lands on an interior address, which is a cover mark
  ;; and not an entry, so it is decoded afresh -- and that publish retires the
  ;; region that was just built. Measured: three installs, zero entries, on
  ;; every iteration of the test's diamond.
  ;;
  ;; So the lower address is HINTED instead: its hot counter is primed to one
  ;; short of K, and the next branch into it -- the back edge, which is one
  ;; iteration away -- fires the gate there. The walk then runs with the guest
  ;; at the address it is about to publish as the entry, which is the same
  ;; situation every ordinary loop-top discovery is in.
  ;;
  ;; The memo is noted against the address the GATE fired on, never against the
  ;; hinted one -- the gate is what will ask again.
  ;; ----------------------------------------------------------------------
  (func $bx_walk_try (param $head i32)
    (local $ok i32) (local $alt i32) (local $s i32)
    (if (i32.eqz (call $bx_memo_ok (local.get $head)))
      (then
        (global.set $bx_walk_memo_refusals
          (i32.add (global.get $bx_walk_memo_refusals) (i32.const 1)))
        (return)))
    (global.set $bx_walk_marked (i32.const 0))
    (local.set $ok (call $bx_walk_once (local.get $head)))
    ;; Round 13. This walk took back one or more one-block descriptors it wants
    ;; the threaded stream of ($bx_raw_want). The guest republishes those blocks
    ;; on its next entry, so the answer will be different one iteration from
    ;; now: re-arm the gate at this head so the retry is one guest iteration
    ;; away rather than K of them. The memo failure is still recorded below --
    ;; re-arming without it is an unbounded retry loop, which is the thing the
    ;; memo exists to make impossible.
    (if (i32.and (global.get $bx_walk_marked) (i32.eqz (local.get $ok)))
      (then
        (local.set $s (call $bx_hot_slot (local.get $head)))
        (i32.store (local.get $s) (local.get $head))
        (i32.store offset=4 (local.get $s)
          (i32.sub (global.get $bx_walk_hot_k) (i32.const 1)))))
    (if (i32.eqz (local.get $ok))
      (then
        (local.set $alt (global.get $bx_walk_min_below))
        (if (i32.and (i32.ne (local.get $alt) (i32.const 0))
                     (call $bx_memo_ok (local.get $alt)))
          (then
            (global.set $bx_walk_reanchors
              (i32.add (global.get $bx_walk_reanchors) (i32.const 1)))
            (local.set $s (call $bx_hot_slot (local.get $alt)))
            (i32.store (local.get $s) (local.get $alt))
            (i32.store offset=4 (local.get $s)
              (i32.sub (global.get $bx_walk_hot_k) (i32.const 1)))))))
    (call $bx_memo_note (local.get $head) (local.get $ok)))

  ;; ======================================================================
  ;; ROUND 11 -- the load/op split pass (design doc section 16)
  ;;
  ;; Two pieces, both decode-time, both over the descriptor a builder is
  ;; writing:
  ;;
  ;;   $bx_try_split   -- one x86 memory-form ALU instruction becomes a LOAD
  ;;                      into a temp lane plus a register-form op on it.
  ;;                      Called from inside a builder's classify loop, which
  ;;                      is the only place with room to emit two micro-ops
  ;;                      where the classifier wanted one.
  ;;   $bx_opt_pass    -- redundant-load elimination, store-to-load
  ;;                      forwarding, register-move elimination and immediate
  ;;                      folding, in two forward walks over one block's
  ;;                      micro-ops.
  ;;
  ;; No runtime codegen: the vocabulary is fixed and the executor is fixed.
  ;; What the pass changes is which fixed arms the descriptor names.
  ;; ======================================================================

  ;; The split's output. The classifier's own $tu_* globals carry the ALU half,
  ;; so the caller's existing six-word store sequence writes it unchanged;
  ;; these five carry the LOAD half, which the caller writes first.
  (global $bxs_kind (mut i32) (i32.const 0))
  (global $bxs_d    (mut i32) (i32.const 0))
  (global $bxs_a    (mut i32) (i32.const 0))
  (global $bxs_imm  (mut i32) (i32.const 0))
  (global $bxs_b    (mut i32) (i32.const 0))

  ;; ROUND 12 lever C (section 19): the STORE half of a read-modify-write.
  ;; Round 11 split only the load side -- `reg OP= [m]` -- and left `[m] OP=
  ;; reg` a whole-instruction fallback. The store half needs its own five
  ;; fields because the RMW form writes THREE micro-ops, not two.
  (global $bxr_kind (mut i32) (i32.const 0))
  (global $bxr_d    (mut i32) (i32.const 0))
  (global $bxr_a    (mut i32) (i32.const 0))
  (global $bxr_imm  (mut i32) (i32.const 0))
  (global $bxr_b    (mut i32) (i32.const 0))
  ;; How many micro-ops the last successful $bx_try_split produced: 2 for the
  ;; round-11 load split, 3 for an RMW. Both call sites read it instead of the
  ;; literal 2 they used to add.
  (global $bx_split_n (mut i32) (i32.const 2))

  ;; $bx_mem_shape's output. 0 = touches no memory and is understood,
  ;; 1 = a load, 2 = a store, 3 = NOT UNDERSTOOD, which kills every fact.
  (global $bx_ms_shape (mut i32) (i32.const 0))
  (global $bx_ms_base  (mut i32) (i32.const 0))
  (global $bx_ms_idx   (mut i32) (i32.const 0))
  (global $bx_ms_scale (mut i32) (i32.const 0))
  (global $bx_ms_disp  (mut i32) (i32.const 0))
  (global $bx_ms_width (mut i32) (i32.const 0))
  (global $bx_ms_val   (mut i32) (i32.const 0))
  (global $bx_ms_full  (mut i32) (i32.const 0))

  (func $bx_fact (param $i i32) (result i32)
    (i32.add (global.get $BX_RG_BASE)
      (i32.shl (i32.add (global.get $BX_RG_FACT_OFF) (i32.shl (local.get $i) (i32.const 3)))
               (i32.const 2))))

  (func $bx_const (param $r i32) (result i32)
    (i32.add (global.get $BX_RG_BASE)
      (i32.shl (i32.add (global.get $BX_RG_CONST_OFF) (i32.shl (local.get $r) (i32.const 1)))
               (i32.const 2))))

  (func $bx_const_clear
    (local $i i32)
    (block $done
      (loop $l
        (br_if $done (i32.ge_u (local.get $i) (global.get $BX_CONST_N)))
        (i32.store (call $bx_const (local.get $i)) (i32.const 0))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $l))))

  ;; Classify one micro-op's memory behaviour. Absolute forms whose address
  ;; word was the SIB sentinel report 3 rather than 0-with-an-address: their
  ;; address is whatever the preceding TU_EA_SIB computed, which is a runtime
  ;; value, and calling that "absolute" would let two unrelated accesses match
  ;; on a displacement of 0.
  (func $bx_mem_shape (param $up i32)
    (local $kind i32) (local $d i32) (local $a i32) (local $imm i32) (local $b i32)
    (local.set $kind (i32.load           (local.get $up)))
    (local.set $d    (i32.load offset=4  (local.get $up)))
    (local.set $a    (i32.load offset=8  (local.get $up)))
    (local.set $imm  (i32.load offset=12 (local.get $up)))
    (local.set $b    (i32.load offset=20 (local.get $up)))
    (global.set $bx_ms_base  (i32.const 0xF))
    (global.set $bx_ms_idx   (i32.const 0xF))
    (global.set $bx_ms_scale (i32.const 0))
    (global.set $bx_ms_disp  (local.get $imm))
    (global.set $bx_ms_width (i32.const 4))
    (global.set $bx_ms_val   (local.get $d))
    (global.set $bx_ms_full  (i32.const 1))
    (global.set $bx_ms_shape (i32.const 3))

    ;; -- the kinds that touch no memory and whose whole register effect is
    ;; "defines d, or defines nothing". Everything not named here (the EA
    ;; pair, rep, x87, push/pop, fallback) falls through to 3.
    (if (i32.or (i32.le_u (local.get $kind) (i32.const 19))
        (i32.or (i32.and (i32.ge_u (local.get $kind) (i32.const 24))
                         (i32.le_u (local.get $kind) (i32.const 27)))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_LEA_SIB))
        (i32.or (i32.and (i32.ge_u (local.get $kind) (i32.const 43))
                         (i32.le_u (local.get $kind) (i32.const 46)))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_CMP_RR))
                (i32.eq (local.get $kind) (global.get $TU_CMP_RI)))))))
      (then (global.set $bx_ms_shape (i32.const 0)) (return)))

    ;; -- base+disp dword
    (if (i32.eq (local.get $kind) (global.get $TU_LOAD32))
      (then (global.set $bx_ms_base (local.get $a))
            (global.set $bx_ms_shape (i32.const 1)) (return)))
    (if (i32.eq (local.get $kind) (global.get $TU_STORE32))
      (then (global.set $bx_ms_base (local.get $a))
            (global.set $bx_ms_shape (i32.const 2)) (return)))
    ;; -- absolute dword
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_LOAD32_ABS))
                (i32.eq (local.get $kind) (global.get $TU_STORE32_ABS)))
      (then
        (if (i32.and (local.get $b) (global.get $TU_B_EA)) (then (return)))
        (global.set $bx_ms_shape
          (select (i32.const 1) (i32.const 2)
                  (i32.eq (local.get $kind) (global.get $TU_LOAD32_ABS))))
        (return)))
    ;; -- SIB dword
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_LOAD32_SIB))
                (i32.eq (local.get $kind) (global.get $TU_STORE32_SIB)))
      (then
        (global.set $bx_ms_base (local.get $a))
        (global.set $bx_ms_idx (i32.and (local.get $b) (i32.const 0xF)))
        (global.set $bx_ms_scale
          (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 3)))
        (global.set $bx_ms_shape
          (select (i32.const 1) (i32.const 2)
                  (i32.eq (local.get $kind) (global.get $TU_LOAD32_SIB))))
        (return)))
    ;; -- byte and word forms. The narrow loads that write the WHOLE
    ;; destination (movzx/movsx) keep full=1; the lane forms do not, so a
    ;; rewrite to TU_MOV_RR -- which writes all 32 bits -- can never reach
    ;; them, and neither can a fact record.
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_MOVZX8_RO))
                (i32.eq (local.get $kind) (global.get $TU_MOVSX8_RO)))
      (then (global.set $bx_ms_base (local.get $a))
            (global.set $bx_ms_width (i32.const 1))
            (global.set $bx_ms_shape (i32.const 1)) (return)))
    (if (i32.eq (local.get $kind) (global.get $TU_MOVSX8_SIB))
      (then
        (global.set $bx_ms_base (local.get $a))
        (global.set $bx_ms_idx (i32.and (local.get $b) (i32.const 0xF)))
        (global.set $bx_ms_scale
          (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 3)))
        (global.set $bx_ms_width (i32.const 1))
        (global.set $bx_ms_shape (i32.const 1)) (return)))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_LOAD8_RO))
                (i32.eq (local.get $kind) (global.get $TU_STORE8_RO)))
      (then (global.set $bx_ms_base (local.get $a))
            (global.set $bx_ms_width (i32.const 1))
            (global.set $bx_ms_full (i32.const 0))
            (global.set $bx_ms_shape
              (select (i32.const 1) (i32.const 2)
                      (i32.eq (local.get $kind) (global.get $TU_LOAD8_RO))))
            (return)))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_LOAD8_ABS))
                (i32.eq (local.get $kind) (global.get $TU_STORE8_ABS)))
      (then
        (if (i32.and (local.get $b) (global.get $TU_B_EA)) (then (return)))
        (global.set $bx_ms_width (i32.const 1))
        (global.set $bx_ms_full (i32.const 0))
        (global.set $bx_ms_shape
          (select (i32.const 1) (i32.const 2)
                  (i32.eq (local.get $kind) (global.get $TU_LOAD8_ABS))))
        (return)))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_STORE8_SIB))
                (i32.eq (local.get $kind) (global.get $TU_MOV_M8_I_SIB)))
      (then
        (global.set $bx_ms_base (local.get $a))
        (global.set $bx_ms_idx (i32.and (local.get $b) (i32.const 0xF)))
        (global.set $bx_ms_scale
          (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 3)))
        (global.set $bx_ms_width (i32.const 1))
        (global.set $bx_ms_full (i32.const 0))
        (global.set $bx_ms_shape (i32.const 2))
        (return)))
    (if (i32.eq (local.get $kind) (global.get $TU_LOAD16_ABS))
      (then
        (if (i32.and (local.get $b) (global.get $TU_B_EA)) (then (return)))
        (global.set $bx_ms_width (i32.const 2))
        (global.set $bx_ms_full (i32.const 0))
        (global.set $bx_ms_shape (i32.const 1)) (return)))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_LOAD16_RO))
                (i32.eq (local.get $kind) (global.get $TU_STORE16_RO)))
      (then (global.set $bx_ms_base (local.get $a))
            (global.set $bx_ms_width (i32.const 2))
            (global.set $bx_ms_full (i32.const 0))
            (global.set $bx_ms_shape
              (select (i32.const 1) (i32.const 2)
                      (i32.eq (local.get $kind) (global.get $TU_LOAD16_RO))))
            (return))))

  ;; Do two accesses' byte ranges overlap? Compared in i64 so `disp + width`
  ;; cannot wrap, and extended SIGNED for a base-relative displacement,
  ;; UNSIGNED for an absolute address -- a displacement is a signed offset and
  ;; an address is not. The pair being compared always agrees about which it
  ;; is, because the callers have already tested the bases equal.
  (func $bx_ranges_overlap
    (param $abs i32) (param $d1 i32) (param $w1 i32) (param $d2 i32) (param $w2 i32)
    (result i32)
    (local $a1 i64) (local $a2 i64)
    (local.set $a1
      (select (i64.extend_i32_u (local.get $d1)) (i64.extend_i32_s (local.get $d1))
              (local.get $abs)))
    (local.set $a2
      (select (i64.extend_i32_u (local.get $d2)) (i64.extend_i32_s (local.get $d2))
              (local.get $abs)))
    (i32.and
      (i64.lt_s (local.get $a1) (i64.add (local.get $a2) (i64.extend_i32_s (local.get $w2))))
      (i64.lt_s (local.get $a2) (i64.add (local.get $a1) (i64.extend_i32_s (local.get $w1))))))

  ;; THE ALIAS RULE, as section 16.2 of the design doc writes it down: a store
  ;; kills every earlier fact unless the store and the fact name the same base,
  ;; the same index and the same scale AND their byte ranges are disjoint.
  (func $bx_store_kills (param $f i32) (result i32)
    (if (i32.or (i32.ne (i32.load offset=4  (local.get $f)) (global.get $bx_ms_base))
        (i32.or (i32.ne (i32.load offset=8  (local.get $f)) (global.get $bx_ms_idx))
                (i32.ne (i32.load offset=12 (local.get $f)) (global.get $bx_ms_scale))))
      (then (return (i32.const 1))))
    (call $bx_ranges_overlap
      (i32.eq (global.get $bx_ms_base) (i32.const 0xF))
      (i32.load offset=16 (local.get $f)) (i32.load offset=20 (local.get $f))
      (global.get $bx_ms_disp) (global.get $bx_ms_width)))

  ;; Kill every fact whose base, index or value register is $r, and forget any
  ;; constant it held. A partial write to a container is still a write to it,
  ;; which is why this is called for the sub-register kinds too.
  (func $bx_kill_reg (param $r i32)
    (local $i i32) (local $f i32)
    (if (i32.ge_u (local.get $r) (global.get $BX_CONST_N)) (then (return)))
    (i32.store (call $bx_const (local.get $r)) (i32.const 0))
    (block $done
      (loop $l
        (br_if $done (i32.ge_u (local.get $i) (global.get $bx_fact_n)))
        (local.set $f (call $bx_fact (local.get $i)))
        (if (i32.load (local.get $f))
          (then
            (if (i32.or (i32.eq (i32.load offset=4  (local.get $f)) (local.get $r))
                (i32.or (i32.eq (i32.load offset=8  (local.get $f)) (local.get $r))
                        (i32.eq (i32.load offset=24 (local.get $f)) (local.get $r))))
              (then (i32.store (local.get $f) (i32.const 0))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $l))))

  (func $bx_fact_add (param $def_kind i32) (param $val i32)
    (local $f i32)
    (if (i32.ge_u (global.get $bx_fact_n) (global.get $BX_FACT_MAX)) (then (return)))
    (local.set $f (call $bx_fact (global.get $bx_fact_n)))
    (i32.store           (local.get $f) (i32.const 1))
    (i32.store offset=4  (local.get $f) (global.get $bx_ms_base))
    (i32.store offset=8  (local.get $f) (global.get $bx_ms_idx))
    (i32.store offset=12 (local.get $f) (global.get $bx_ms_scale))
    (i32.store offset=16 (local.get $f) (global.get $bx_ms_disp))
    (i32.store offset=20 (local.get $f) (global.get $bx_ms_width))
    (i32.store offset=24 (local.get $f) (local.get $val))
    (i32.store offset=28 (local.get $f) (local.get $def_kind))
    (global.set $bx_fact_n (i32.add (global.get $bx_fact_n) (i32.const 1))))

  ;; Does this live fact describe exactly the access $bx_ms_* holds right now?
  ;; Exact in every field: "the same place, one byte narrower" is a different
  ;; transform and is not this one.
  (func $bx_fact_matches (param $f i32) (result i32)
    (i32.and
      (i32.and (i32.ne (i32.load (local.get $f)) (i32.const 0))
               (i32.eq (i32.load offset=4 (local.get $f)) (global.get $bx_ms_base)))
      (i32.and
        (i32.and (i32.eq (i32.load offset=8  (local.get $f)) (global.get $bx_ms_idx))
                 (i32.eq (i32.load offset=12 (local.get $f)) (global.get $bx_ms_scale)))
        (i32.and (i32.eq (i32.load offset=16 (local.get $f)) (global.get $bx_ms_disp))
                 (i32.eq (i32.load offset=20 (local.get $f)) (global.get $bx_ms_width))))))

  ;; "This micro-op reads R[d] as its FIRST SOURCE and then redefines R[d] in
  ;; full." The whitelist for register-move elimination, and the only place
  ;; $TU_B_SRC0 is ever set. TU_IMUL_RI (19) is deliberately absent -- its arm
  ;; computes from $vb, not $va -- and so is TU_CMP_*, which reads R[d] but
  ;; redefines nothing, so the move feeding it would still have to happen.
  (func $bx_src0_ok (param $kind i32) (result i32)
    (i32.or (i32.and (i32.ge_u (local.get $kind) (i32.const 3))
                     (i32.le_u (local.get $kind) (i32.const 18)))
            (i32.and (i32.ge_u (local.get $kind) (i32.const 43))
                     (i32.le_u (local.get $kind) (i32.const 46)))))

  ;; Of those, the ones whose `a` field really is a source REGISTER, so a move
  ;; whose destination is also that source can have BOTH reads redirected.
  ;; TU_SHIFT's `a` is the rotate type and the _RI forms' is unused, which is
  ;; exactly the confusion this function exists to prevent: comparing a shift
  ;; type against a register index is how `shl eax,4` would get its operand
  ;; rewritten.
  (func $bx_src1_is_reg (param $kind i32) (result i32)
    (i32.or
      (i32.or (i32.or (i32.eq (local.get $kind) (global.get $TU_ADD_RR))
                      (i32.eq (local.get $kind) (global.get $TU_SUB_RR)))
              (i32.or (i32.eq (local.get $kind) (global.get $TU_AND_RR))
                      (i32.eq (local.get $kind) (global.get $TU_OR_RR))))
      (i32.or (i32.or (i32.eq (local.get $kind) (global.get $TU_XOR_RR))
                      (i32.eq (local.get $kind) (global.get $TU_IMUL_RR)))
              (i32.or (i32.eq (local.get $kind) (global.get $TU_ADC_RR))
                      (i32.eq (local.get $kind) (global.get $TU_SBB_RR))))))

  ;; "This micro-op defines R[r] in full and does NOT read it." A move into r
  ;; immediately followed by one of these is dead outright. Kinds whose `a`
  ;; field is not a register still take part: comparing an inert `a` against r
  ;; can only make this return 0, which declines the fold.
  (func $bx_full_def_no_read (param $up i32) (param $r i32) (result i32)
    (local $kind i32)
    (local.set $kind (i32.load (local.get $up)))
    (if (i32.ne (i32.load offset=4 (local.get $up)) (local.get $r))
      (then (return (i32.const 0))))
    (if (i32.eq (i32.load offset=8 (local.get $up)) (local.get $r))
      (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $kind) (global.get $TU_FIRST_SIB))
      (then
        (if (i32.eq (i32.and (i32.load offset=20 (local.get $up)) (i32.const 0xF))
                    (local.get $r))
          (then (return (i32.const 0))))))
    (i32.or
      (i32.or (i32.or (i32.eq (local.get $kind) (global.get $TU_MOV_RR))
                      (i32.eq (local.get $kind) (global.get $TU_MOV_RI)))
              (i32.or (i32.eq (local.get $kind) (global.get $TU_LEA_RO))
                      (i32.eq (local.get $kind) (global.get $TU_IMUL_RI))))
      (i32.or
        (i32.or (i32.or (i32.eq (local.get $kind) (global.get $TU_LOAD32))
                        (i32.eq (local.get $kind) (global.get $TU_LOAD32_ABS)))
                (i32.or (i32.eq (local.get $kind) (global.get $TU_LOAD32_SIB))
                        (i32.eq (local.get $kind) (global.get $TU_LEA_SIB))))
        (i32.or (i32.or (i32.eq (local.get $kind) (global.get $TU_MOVZX8_RO))
                        (i32.eq (local.get $kind) (global.get $TU_MOVSX8_RO)))
                (i32.eq (local.get $kind) (global.get $TU_MOVSX8_SIB))))))

  (func $bx_uop_copy (param $dst i32) (param $src i32)
    (i32.store           (local.get $dst) (i32.load           (local.get $src)))
    (i32.store offset=4  (local.get $dst) (i32.load offset=4  (local.get $src)))
    (i32.store offset=8  (local.get $dst) (i32.load offset=8  (local.get $src)))
    (i32.store offset=12 (local.get $dst) (i32.load offset=12 (local.get $src)))
    (i32.store offset=16 (local.get $dst) (i32.load offset=16 (local.get $src)))
    (i32.store offset=20 (local.get $dst) (i32.load offset=20 (local.get $src))))

  ;; ----------------------------------------------------------------------
  ;; WALK 1, on its own, so it can be re-run over a member block with the fact
  ;; table already holding a predecessor's exit state (round 12, section 18).
  ;;
  ;; `seed` of 0 starts from nothing, which is what round 11 did at every block
  ;; boundary. `seed` of 1 keeps whatever the previous call left -- and that is
  ;; sound only where the caller has proved the previous call was over this
  ;; block's ONE in-region predecessor; $bx_rg_carry_pass is the only caller
  ;; that passes 1.
  ;;
  ;; Re-running this with `seed` 0 over a list it has already walked is a
  ;; no-op: a load it rewrote is now a TU_MOV_RR, which has no memory shape and
  ;; cannot match as a load again, and the constant table is rebuilt
  ;; identically. So neither `rle` nor `immfold` double-counts, and the only
  ;; hits a second walk can find are the ones the seed made visible.
  ;; ----------------------------------------------------------------------
  ;; The folded terminator's register write, applied to the fact tables. Two
  ;; callers: walk 1 applies it at $bx_opt_term_pos, which is where the producer
  ;; stood in program order, and the carry pass applies it again on the way out
  ;; of a member. Both are needed and neither is redundant: a producer lifted
  ;; from the MIDDLE of a block has ops after it that walk 1 must see the kill
  ;; for, while a producer that stood at the END has $bx_opt_term_pos == nuops,
  ;; a position walk 1's loop never visits -- so for the common shape (`inc
  ;; ecx ; jnz top`) the exit kill is the ONLY one that fires. Idempotent, so
  ;; the overlap costs nothing.
  (func $bx_kill_term_wreg
    (if (i32.lt_s (global.get $bx_opt_term_wreg) (i32.const 0)) (then (return)))
    (call $bx_kill_reg (global.get $bx_opt_term_wreg))
    (if (i32.lt_u (global.get $bx_opt_term_wreg) (global.get $BX_CONST_N))
      (then (i32.store (call $bx_const (global.get $bx_opt_term_wreg))
                       (i32.const 0)))))

  (func $bx_opt_walk1 (param $up0 i32) (param $nuops i32) (param $seed i32)
    (local $i i32) (local $j i32) (local $up i32) (local $f i32)
    (local $kind i32) (local $d i32) (local $a i32) (local $hit i32)
    (local $cp i32)
    (if (i32.eqz (local.get $seed))
      (then
        (global.set $bx_fact_n (i32.const 0))
        (call $bx_const_clear)))
    ;; ---- walk 1: redundant loads, store->load forwarding, imm folding ----
    (local.set $i (i32.const 0))
    (block $w1_done
      (loop $w1
        (br_if $w1_done (i32.ge_u (local.get $i) (local.get $nuops)))
        (local.set $up (i32.add (local.get $up0)
          (i32.mul (local.get $i) (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2)))))
        ;; ROUND 12. The FOLDED TERMINATOR runs here, at $bx_opt_term_pos, and
        ;; it is not a micro-op in this list -- $bx_rg_classify_block lifted it
        ;; out. term_kind 0 (inc/dec), 8 (`alu r,r`) and 9 (`alu r,imm32`)
        ;; WRITE a register, and walk 1 could not see that at all before this
        ;; round: a fact recorded before the producer and matched after it named
        ;; an address the producer had since moved. That is a latent round-11
        ;; bug in the region path on its own account, and it is the same kill
        ;; the round-12 carry needs at a region edge, so it lives here once.
        ;; (term_kind 3 dereferences a register but only READS, and a read
        ;; never kills a fact.)
        (if (i32.eq (local.get $i) (global.get $bx_opt_term_pos))
          (then (call $bx_kill_term_wreg)))
        (local.set $kind (i32.load (local.get $up)))
        (local.set $d (i32.load offset=4 (local.get $up)))
        (call $bx_mem_shape (local.get $up))

        ;; 3 -- an op this pass does not model. Every fact and every constant
        ;; dies, which is what makes a fallback, a call, a rep, an x87 op or a
        ;; push safe here without any of them being named at the use sites.
        (if (i32.eq (global.get $bx_ms_shape) (i32.const 3))
          (then
            (global.set $bx_fact_n (i32.const 0))
            (call $bx_const_clear)
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $w1)))

        (if (i32.eq (global.get $bx_ms_shape) (i32.const 2))
          (then
            ;; a store: apply the alias rule, then record it if it is
            ;; forwardable -- a full-width dword out of a register.
            (local.set $j (i32.const 0))
            (block $k_done
              (loop $k
                (br_if $k_done (i32.ge_u (local.get $j) (global.get $bx_fact_n)))
                (local.set $f (call $bx_fact (local.get $j)))
                (if (i32.load (local.get $f))
                  (then
                    (if (call $bx_store_kills (local.get $f))
                      (then (i32.store (local.get $f) (i32.const 0))))))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $k)))
            ;; And that is ALL a store does here. Store-to-load forwarding is
            ;; NOT sound in this emulator and is deliberately absent -- see the
            ;; note at the head of $bx_opt_pass.
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $w1)))

        (if (i32.eq (global.get $bx_ms_shape) (i32.const 1))
          (then
            (local.set $hit (i32.const -1))
            ;; Only a load that writes its destination IN FULL can become a
            ;; TU_MOV_RR or a TU_MOV_RI, because both write all 32 bits.
            (if (global.get $bx_ms_full)
              (then
                (local.set $j (i32.const 0))
                (block $m_done
                  (loop $m
                    (br_if $m_done (i32.ge_u (local.get $j) (global.get $bx_fact_n)))
                    (local.set $f (call $bx_fact (local.get $j)))
                    (if (call $bx_fact_matches (local.get $f))
                      (then
                        ;; A fact matches only a load of the same KIND: movzx
                        ;; and movsx of one byte are the same access and two
                        ;; different values, and nothing else in the record
                        ;; tells them apart.
                        (if (i32.eq (i32.load offset=28 (local.get $f)) (local.get $kind))
                          (then (local.set $hit (local.get $j)) (br $m_done)))))
                    (local.set $j (i32.add (local.get $j) (i32.const 1)))
                    (br $m)))))
            (if (i32.ge_s (local.get $hit) (i32.const 0))
              (then
                (local.set $f (call $bx_fact (local.get $hit)))
                (local.set $a (i32.load offset=24 (local.get $f)))
                (global.set $bx_pass_rle
                  (i64.add (global.get $bx_pass_rle) (i64.const 1)))
                (if (global.get $bx_opt_carry_mode)
                  (then (global.set $bx_pass_carry_rle
                    (i64.add (global.get $bx_pass_carry_rle) (i64.const 1)))))
                (i32.store           (local.get $up) (global.get $TU_MOV_RR))
                (i32.store offset=8  (local.get $up) (local.get $a))
                (i32.store offset=12 (local.get $up) (i32.const 0))
                (i32.store offset=20 (local.get $up) (i32.const 0))))
            ;; The load defines d, whichever form it ended up in.
            (call $bx_kill_reg (local.get $d))
            ;; Record the new fact -- but NOT when the load's own base or index
            ;; is the register it just overwrote (`mov eax,[eax+4]`), because
            ;; the address the fact names no longer means what it meant.
            (if (i32.and (global.get $bx_ms_full)
                  (i32.and (i32.ne (global.get $bx_ms_base) (local.get $d))
                           (i32.ne (global.get $bx_ms_idx) (local.get $d))))
              (then (call $bx_fact_add (local.get $kind) (local.get $d))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $w1)))

        ;; shape 0: no memory.
        ;;
        ;; (e) immediate folding, before the kill: a TU_MOV_RR whose SOURCE is
        ;; known to hold a constant becomes a TU_MOV_RI of that constant, which
        ;; drops the register read and lets the next walk delete the move that
        ;; defined the source when nothing else needs it. Done here rather than
        ;; where the constant was written because the pass is a forward walk
        ;; and this is where the reader is.
        (if (i32.and (i32.eq (local.get $kind) (global.get $TU_MOV_RR))
                     (i32.lt_u (i32.load offset=8 (local.get $up))
                               (global.get $BX_CONST_N)))
          (then
            (local.set $cp (call $bx_const (i32.load offset=8 (local.get $up))))
            (if (i32.load (local.get $cp))
              (then
                (i32.store           (local.get $up) (global.get $TU_MOV_RI))
                (i32.store offset=8  (local.get $up) (i32.const 0xF))
                (i32.store offset=12 (local.get $up) (i32.load offset=4 (local.get $cp)))
                (local.set $kind (global.get $TU_MOV_RI))
                (global.set $bx_pass_immfold
                  (i64.add (global.get $bx_pass_immfold) (i64.const 1)))))))
        ;; Kill on the register it defines, if any, then note the constant if
        ;; it is a TU_MOV_RI.
        (if (i32.eqz (call $tree_uop_is_store (local.get $kind)))
          (then
            (call $bx_kill_reg (local.get $d))
            (if (i32.and (i32.eq (local.get $kind) (global.get $TU_MOV_RI))
                         (i32.lt_u (local.get $d) (global.get $BX_CONST_N)))
              (then
                (local.set $cp (call $bx_const (local.get $d)))
                (i32.store          (local.get $cp) (i32.const 1))
                (i32.store offset=4 (local.get $cp) (i32.load offset=12 (local.get $up)))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $w1))))

  ;; ----------------------------------------------------------------------
  ;; THE PASS. One block's micro-ops, in place. Returns the new micro-op count
  ;; and leaves the adjusted terminator position in $bx_opt_term_pos.
  ;;
  ;; Two walks, separate on purpose: the first only ever rewrites a micro-op
  ;; where it stands, so it can carry the fact table forward without worrying
  ;; about indices moving; the second deletes, and deleting while analysing is
  ;; how an off-by-one in term_pos gets written.
  ;;
  ;; WHY THERE IS NO STORE-TO-LOAD FORWARDING. It was written, it was measured,
  ;; and it is unsound in this emulator -- not because of aliasing, which the
  ;; rule above handles, but because guest memory is not coherent at an
  ;; unmapped address. $g2w resolves a miss to the NULL sentinel, where a store
  ;; goes nowhere and a load reads 0, so `mov [eax],ecx ; mov edx,[eax]` with
  ;; eax unmapped leaves edx at 0 on the threaded path and at ecx if the store
  ;; is forwarded. Real hardware would have faulted and the question would
  ;; never arise; here the sentinel makes the two paths differ silently, and
  ;; `test/test-block-exec.js`'s "a store through a null base register" case is
  ;; the one that caught it. Nothing at decode time can prove an address is
  ;; mapped, so the transform is dropped rather than guarded. REDUNDANT-LOAD
  ;; elimination is unaffected: two loads of one address read the same place
  ;; whether it is the sentinel or real memory, and both give the same value.
  ;; ----------------------------------------------------------------------
  (func $bx_opt_pass (param $up0 i32) (param $nuops i32) (param $term_pos i32)
    (result i32)
    (local $i i32) (local $j i32) (local $up i32) (local $nxt i32) (local $f i32)
    (local $kind i32) (local $d i32) (local $a i32) (local $hit i32)
    (local $out i32) (local $tp i32) (local $cp i32)

    (global.set $bx_opt_term_pos (local.get $term_pos))
    (if (i32.eqz (global.get $block_exec_split)) (then (return (local.get $nuops))))
    (global.set $bx_pass_uops_before
      (i64.add (global.get $bx_pass_uops_before) (i64.extend_i32_u (local.get $nuops))))
    ;; ---- walk 1, as its own function since round 12 ----------------------
    (call $bx_opt_walk1 (local.get $up0) (local.get $nuops) (i32.const 0))

    ;; ---- walk 2: register-move elimination ------------------------------
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (local.set $tp (global.get $bx_opt_term_pos))
    (block $w2_done
      (loop $w2
        (br_if $w2_done (i32.ge_u (local.get $i) (local.get $nuops)))
        (local.set $up (i32.add (local.get $up0)
          (i32.mul (local.get $i) (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2)))))
        (local.set $kind (i32.load (local.get $up)))
        (local.set $d (i32.load offset=4 (local.get $up)))
        (local.set $a (i32.load offset=8 (local.get $up)))
        (local.set $hit (i32.const 0))
        ;; A move is a candidate only when its consumer is the very NEXT
        ;; micro-op and the folded terminator does not run between them: the
        ;; terminator reads and writes architectural registers, so a value
        ;; carried across it is not the value the consumer would have read.
        (if (i32.and
              (i32.or (i32.eq (local.get $kind) (global.get $TU_MOV_RR))
                      (i32.eq (local.get $kind) (global.get $TU_MOV_RI)))
              (i32.and (i32.lt_u (i32.add (local.get $i) (i32.const 1))
                                 (local.get $nuops))
                       (i32.ne (i32.add (local.get $i) (i32.const 1))
                               (global.get $bx_opt_term_pos))))
          (then
            (local.set $nxt (i32.add (local.get $up)
              (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2))))
            ;; (a) the consumer overwrites d without reading it: the move is
            ;; simply dead.
            (if (call $bx_full_def_no_read (local.get $nxt) (local.get $d))
              (then
                (local.set $hit (i32.const 1))
                (global.set $bx_pass_movelim
                  (i64.add (global.get $bx_pass_movelim) (i64.const 1)))))
            ;; (b) the consumer reads d as its first source and redefines it.
            ;; Only TU_MOV_RR folds this way -- TU_MOV_RI would need a kind
            ;; that takes an immediate as its FIRST source, and none does.
            (if (i32.and (i32.eqz (local.get $hit))
                 (i32.and (i32.eq (local.get $kind) (global.get $TU_MOV_RR))
                  (i32.and (i32.eq (i32.load offset=4 (local.get $nxt)) (local.get $d))
                           (call $bx_src0_ok (i32.load (local.get $nxt))))))
              (then
                ;; The consumer's own `a` may name d as well (`mov eax,edx ;
                ;; add eax,eax`); redirect it too, but only for a kind whose
                ;; `a` really is a source register.
                (if (i32.and (call $bx_src1_is_reg (i32.load (local.get $nxt)))
                             (i32.eq (i32.load offset=8 (local.get $nxt)) (local.get $d)))
                  (then (i32.store offset=8 (local.get $nxt) (local.get $a))))
                (i32.store offset=20 (local.get $nxt)
                  (i32.or (i32.load offset=20 (local.get $nxt))
                    (i32.or (global.get $TU_B_SRC0)
                      (i32.shl (local.get $a) (global.get $TU_B_SRC0_SHIFT)))))
                (local.set $hit (i32.const 1))
                (global.set $bx_pass_movelim
                  (i64.add (global.get $bx_pass_movelim) (i64.const 1)))))))
        (if (local.get $hit)
          (then
            (if (i32.and (i32.ge_s (global.get $bx_opt_term_pos) (i32.const 0))
                         (i32.lt_s (local.get $i) (global.get $bx_opt_term_pos)))
              (then (local.set $tp (i32.sub (local.get $tp) (i32.const 1)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $w2)))
        (if (i32.ne (local.get $out) (local.get $i))
          (then
            (call $bx_uop_copy
              (i32.add (local.get $up0)
                (i32.mul (local.get $out) (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2))))
              (local.get $up))))
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $w2)))
    (global.set $bx_opt_term_pos (local.get $tp))
    (global.set $bx_pass_uops_after
      (i64.add (global.get $bx_pass_uops_after) (i64.extend_i32_u (local.get $out))))
    (local.get $out))

  ;; x86 ALU group sub-op -> the register-form micro-op kind, in $do_alu32's
  ;; own order: add or adc sbb and sub xor cmp.
  (func $bx_alu_kind (param $alu i32) (result i32)
    (if (i32.eqz (local.get $alu))
      (then (global.set $tu_kind (global.get $TU_ADD_RR)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 1))
      (then (global.set $tu_kind (global.get $TU_OR_RR)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 2))
      (then (global.set $tu_kind (global.get $TU_ADC_RR)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 3))
      (then (global.set $tu_kind (global.get $TU_SBB_RR)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 4))
      (then (global.set $tu_kind (global.get $TU_AND_RR)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 5))
      (then (global.set $tu_kind (global.get $TU_SUB_RR)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 6))
      (then (global.set $tu_kind (global.get $TU_XOR_RR)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 7))
      (then (global.set $tu_kind (global.get $TU_CMP_RR)) (return (i32.const 1))))
    (i32.const 0))

  ;; The immediate-operand twin of $bx_alu_kind, for the `[m] OP= imm32` forms
  ;; lever C accepts. Same ALU sub-op numbering, which is x86's /r field order
  ;; and is what every handler in 05-alu.wat reads.
  (func $bx_alu_kind_i (param $alu i32) (result i32)
    (if (i32.eqz (local.get $alu))
      (then (global.set $tu_kind (global.get $TU_ADD_RI)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 1))
      (then (global.set $tu_kind (global.get $TU_OR_RI)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 2))
      (then (global.set $tu_kind (global.get $TU_ADC_RI)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 3))
      (then (global.set $tu_kind (global.get $TU_SBB_RI)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 4))
      (then (global.set $tu_kind (global.get $TU_AND_RI)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 5))
      (then (global.set $tu_kind (global.get $TU_SUB_RI)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 6))
      (then (global.set $tu_kind (global.get $TU_XOR_RI)) (return (i32.const 1))))
    (if (i32.eq (local.get $alu) (i32.const 7))
      (then (global.set $tu_kind (global.get $TU_CMP_RI)) (return (i32.const 1))))
    (i32.const 0))

  ;; The four unary memory sub-ops, in the handlers' own numbering
  ;; (0 inc, 1 dec, 2 not, 3 neg -- $th_unary_m32's if-chain). TU_NOT is
  ;; flag-transparent in this vocabulary exactly as x86 NOT is, so the mapping
  ;; is one for one and no flag fixup rides along.
  (func $bx_unary_kind (param $u i32) (result i32)
    (if (i32.eqz (local.get $u))
      (then (global.set $tu_kind (global.get $TU_INC)) (return (i32.const 1))))
    (if (i32.eq (local.get $u) (i32.const 1))
      (then (global.set $tu_kind (global.get $TU_DEC)) (return (i32.const 1))))
    (if (i32.eq (local.get $u) (i32.const 2))
      (then (global.set $tu_kind (global.get $TU_NOT)) (return (i32.const 1))))
    (if (i32.eq (local.get $u) (i32.const 3))
      (then (global.set $tu_kind (global.get $TU_NEG)) (return (i32.const 1))))
    (i32.const 0))

  ;; The next temp lane, round-robin. A lane's previous contents die at its
  ;; reallocation for free, because walk 1 treats the split's LOAD as a write
  ;; to that lane and kills every fact naming it -- so there is no separate
  ;; liveness check here to get wrong.
  (func $bx_next_lane (result i32)
    (local $l i32)
    (local.set $l (i32.add (global.get $BX_LANE0) (global.get $bx_lane_next)))
    (global.set $bx_lane_next
      (select (i32.const 0) (i32.add (global.get $bx_lane_next) (i32.const 1))
              (i32.ge_u (i32.add (global.get $bx_lane_next) (i32.const 1))
                        (global.get $BX_LANE_N))))
    (local.get $l))

  ;; ----------------------------------------------------------------------
  ;; THE SPLIT. One memory-form ALU or IMUL instruction becomes two micro-ops.
  ;; Returns 1 when it applied, with the LOAD half in $bxs_* and the ALU half
  ;; in the classifier's own $tu_* globals, so the caller writes two records
  ;; with the six-word store sequence it already has.
  ;;
  ;; Every accepted handler's operand decode is taken from the handler itself,
  ;; field for field: H128's operand is alu<<8|reg<<4|base with the
  ;; displacement in the next word, H48's is alu<<4|reg with a $read_addr word,
  ;; and so on. A register slot that is not one of the eight architectural
  ;; registers declines, rather than being passed to a br_table that would read
  ;; a lane.
  ;; ----------------------------------------------------------------------
  (func $bx_try_split (param $p i32) (param $lane i32) (result i32)
    (local $fn i32) (local $op i32) (local $alu i32) (local $reg i32) (local $base i32)
    (if (i32.eqz (global.get $block_exec_split)) (then (return (i32.const 0))))
    (global.set $bx_split_n (i32.const 2))
    (local.set $fn (i32.load (local.get $p)))
    (local.set $op (i32.load offset=4 (local.get $p)))
    (global.set $bxs_d   (local.get $lane))
    (global.set $bxs_a   (i32.const 0xF))
    (global.set $bxs_b   (i32.const 0))
    (global.set $bxs_imm (i32.const 0))
    (global.set $tu_d     (i32.const 0))
    (global.set $tu_a     (local.get $lane))
    (global.set $tu_imm   (i32.const 0))
    (global.set $tu_b     (i32.const 0))
    (global.set $tu_extra (i32.const 0))
    (global.set $tu_fn    (local.get $fn))

    ;; H128 -- reg OP= [base+disp]
    (if (i32.eq (local.get $fn) (i32.const 128))
      (then
        (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
        (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $base (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.or (i32.gt_u (local.get $base) (i32.const 7))
                    (i32.gt_u (local.get $reg) (i32.const 7)))
          (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32))
        (global.set $bxs_a (local.get $base))
        (global.set $bxs_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_d (local.get $reg))
        (return (call $bx_alu_kind (local.get $alu)))))

    ;; H48 -- reg OP= [addr]
    (if (i32.eq (local.get $fn) (i32.const 48))
      (then
        (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $reg (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.gt_u (local.get $reg) (i32.const 7)) (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32_ABS))
        ;; $tree_abs_addr ORs $TU_B_EA into $tu_b when the address word is the
        ;; SIB sentinel. That bit is the LOAD's business, not the ALU's, so it
        ;; is moved across and $tu_b put back to zero.
        (global.set $tu_b (i32.const 0))
        (global.set $bxs_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (global.set $bxs_b (global.get $tu_b))
        (global.set $tu_b (i32.const 0))
        (global.set $tu_d (local.get $reg))
        (return (call $bx_alu_kind (local.get $alu)))))

    ;; H157 -- imul reg, [base+disp]
    (if (i32.eq (local.get $fn) (i32.const 157))
      (then
        (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $base (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.or (i32.gt_u (local.get $base) (i32.const 7))
                    (i32.gt_u (local.get $reg) (i32.const 7)))
          (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32))
        (global.set $bxs_a (local.get $base))
        (global.set $bxs_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_d (local.get $reg))
        (global.set $tu_kind (global.get $TU_IMUL_RR))
        (return (i32.const 1))))

    ;; H158 -- imul reg, [addr]
    (if (i32.eq (local.get $fn) (i32.const 158))
      (then
        (local.set $reg (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.gt_u (local.get $reg) (i32.const 7)) (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32_ABS))
        (global.set $tu_b (i32.const 0))
        (global.set $bxs_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (global.set $bxs_b (global.get $tu_b))
        (global.set $tu_b (i32.const 0))
        (global.set $tu_d (local.get $reg))
        (global.set $tu_kind (global.get $TU_IMUL_RR))
        (return (i32.const 1))))

    ;; ------------------------------------------------------------------
    ;; ROUND 12 LEVER C (section 19): the READ-MODIFY-WRITE forms, where the
    ;; destination is the memory operand. Three micro-ops, not two:
    ;;
    ;;     TU_LOAD32  lane <- [m]
    ;;     <register-form op> on the lane        (the same $set_flags_* call,
    ;;                                            in the same position)
    ;;     TU_STORE32 [m] <- lane
    ;;
    ;; The alias rule needs no clause: the third micro-op is a REAL store kind,
    ;; so walk 1 kills facts through it exactly as it does for a plain
    ;; `mov [m],reg`, and the first is a real load kind, so a live fact naming
    ;; the same address is reused. `add [eax],eax` is safe by construction --
    ;; the op writes the LANE, never the base.
    ;;
    ;; Only the DWORD forms are here. The byte and word twins (H49/H52/H129/
    ;; H132/H160/H162/H220 ...) stay whole-instruction fallbacks, because a
    ;; partial-width RMW would need the sub-register vocabulary on the lane and
    ;; that is a wider change than this lever.
    ;;
    ;; `alu == 7` is CMP, and $th_alu_m32_r/$th_alu_m32_i32 skip their store for
    ;; it. So does this: the form stays TWO micro-ops, a load and a TU_CMP_*,
    ;; and $bx_split_n is left at 2. Emitting a store there would write back a
    ;; value the instruction does not produce.
    ;; ------------------------------------------------------------------

    ;; H127 -- [base+disp] OP= reg. operand = alu<<8 | reg<<4 | base.
    (if (i32.eq (local.get $fn) (i32.const 127))
      (then
        (if (i32.eqz (global.get $block_exec_rmw)) (then (return (i32.const 0))))
        (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
        (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $base (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.or (i32.gt_u (local.get $base) (i32.const 7))
                    (i32.gt_u (local.get $reg) (i32.const 7)))
          (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32))
        (global.set $bxs_a (local.get $base))
        (global.set $bxs_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_d (local.get $lane))
        (global.set $tu_a (local.get $reg))
        (if (i32.ne (local.get $alu) (i32.const 7))
          (then
            (global.set $bxr_kind (global.get $TU_STORE32))
            (global.set $bxr_d (local.get $lane))
            (global.set $bxr_a (local.get $base))
            (global.set $bxr_imm (i32.load offset=8 (local.get $p)))
            (global.set $bxr_b (i32.const 0))
            (global.set $bx_split_n (i32.const 3))))
        (return (call $bx_alu_kind (local.get $alu)))))

    ;; H47 -- [addr] OP= reg. operand = alu<<4 | reg, address in the next word.
    (if (i32.eq (local.get $fn) (i32.const 47))
      (then
        (if (i32.eqz (global.get $block_exec_rmw)) (then (return (i32.const 0))))
        (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $reg (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.gt_u (local.get $reg) (i32.const 7)) (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32_ABS))
        ;; $tree_abs_addr reports the SIB sentinel by ORing $TU_B_EA into
        ;; $tu_b; that bit belongs to BOTH memory halves and to neither the
        ;; ALU op, so it is copied across and $tu_b put back to zero.
        (global.set $tu_b (i32.const 0))
        (global.set $bxs_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (global.set $bxs_b (global.get $tu_b))
        (global.set $tu_b (i32.const 0))
        (global.set $tu_d (local.get $lane))
        (global.set $tu_a (local.get $reg))
        (if (i32.ne (local.get $alu) (i32.const 7))
          (then
            (global.set $bxr_kind (global.get $TU_STORE32_ABS))
            (global.set $bxr_d (local.get $lane))
            (global.set $bxr_a (i32.const 0xF))
            (global.set $bxr_imm (global.get $bxs_imm))
            (global.set $bxr_b (global.get $bxs_b))
            (global.set $bx_split_n (i32.const 3))))
        (return (call $bx_alu_kind (local.get $alu)))))

    ;; H131 -- [base+disp] OP= imm32. operand = alu<<8 | base; disp then imm.
    (if (i32.eq (local.get $fn) (i32.const 131))
      (then
        (if (i32.eqz (global.get $block_exec_rmw)) (then (return (i32.const 0))))
        (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
        (local.set $base (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.gt_u (local.get $base) (i32.const 7)) (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32))
        (global.set $bxs_a (local.get $base))
        (global.set $bxs_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_d (local.get $lane))
        (global.set $tu_a (i32.const 0))
        (global.set $tu_imm (i32.load offset=12 (local.get $p)))
        (if (i32.ne (local.get $alu) (i32.const 7))
          (then
            (global.set $bxr_kind (global.get $TU_STORE32))
            (global.set $bxr_d (local.get $lane))
            (global.set $bxr_a (local.get $base))
            (global.set $bxr_imm (i32.load offset=8 (local.get $p)))
            (global.set $bxr_b (i32.const 0))
            (global.set $bx_split_n (i32.const 3))))
        (return (call $bx_alu_kind_i (local.get $alu)))))

    ;; H51 -- [addr] OP= imm32. operand = alu; address then imm in the words.
    (if (i32.eq (local.get $fn) (i32.const 51))
      (then
        (if (i32.eqz (global.get $block_exec_rmw)) (then (return (i32.const 0))))
        (local.set $alu (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $bxs_kind (global.get $TU_LOAD32_ABS))
        (global.set $tu_b (i32.const 0))
        (global.set $bxs_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (global.set $bxs_b (global.get $tu_b))
        (global.set $tu_b (i32.const 0))
        (global.set $tu_d (local.get $lane))
        (global.set $tu_a (i32.const 0))
        (global.set $tu_imm (i32.load offset=12 (local.get $p)))
        (if (i32.ne (local.get $alu) (i32.const 7))
          (then
            (global.set $bxr_kind (global.get $TU_STORE32_ABS))
            (global.set $bxr_d (local.get $lane))
            (global.set $bxr_a (i32.const 0xF))
            (global.set $bxr_imm (global.get $bxs_imm))
            (global.set $bxr_b (global.get $bxs_b))
            (global.set $bx_split_n (i32.const 3))))
        (return (call $bx_alu_kind_i (local.get $alu)))))

    ;; H135 -- inc/dec/not/neg [base+disp]. operand = unary<<4 | base.
    (if (i32.eq (local.get $fn) (i32.const 135))
      (then
        (if (i32.eqz (global.get $block_exec_rmw)) (then (return (i32.const 0))))
        (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $base (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.gt_u (local.get $base) (i32.const 7)) (then (return (i32.const 0))))
        (if (i32.eqz (call $bx_unary_kind (local.get $alu)))
          (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32))
        (global.set $bxs_a (local.get $base))
        (global.set $bxs_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_d (local.get $lane))
        (global.set $tu_a (i32.const 0))
        (global.set $bxr_kind (global.get $TU_STORE32))
        (global.set $bxr_d (local.get $lane))
        (global.set $bxr_a (local.get $base))
        (global.set $bxr_imm (i32.load offset=8 (local.get $p)))
        (global.set $bxr_b (i32.const 0))
        (global.set $bx_split_n (i32.const 3))
        (return (i32.const 1))))

    ;; H68 -- inc/dec/not/neg [addr]. operand = unary; address in the next word.
    (if (i32.eq (local.get $fn) (i32.const 68))
      (then
        (if (i32.eqz (global.get $block_exec_rmw)) (then (return (i32.const 0))))
        (local.set $alu (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.eqz (call $bx_unary_kind (local.get $alu)))
          (then (return (i32.const 0))))
        (global.set $bxs_kind (global.get $TU_LOAD32_ABS))
        (global.set $tu_b (i32.const 0))
        (global.set $bxs_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (global.set $bxs_b (global.get $tu_b))
        (global.set $tu_b (i32.const 0))
        (global.set $tu_d (local.get $lane))
        (global.set $tu_a (i32.const 0))
        (global.set $bxr_kind (global.get $TU_STORE32_ABS))
        (global.set $bxr_d (local.get $lane))
        (global.set $bxr_a (i32.const 0xF))
        (global.set $bxr_imm (global.get $bxs_imm))
        (global.set $bxr_b (global.get $bxs_b))
        (global.set $bx_split_n (i32.const 3))
        (return (i32.const 1))))

    (i32.const 0))

  ;; Write the split's two micro-ops at $up. The LOAD half carries fn = -1 so
  ;; the handler histogram skips it: a split op must count once, not twice, or
  ;; a histogram taken with the pass on is not comparable with one taken
  ;; without it.
  (func $bx_emit_split (param $up i32)
    (i32.store           (local.get $up) (global.get $bxs_kind))
    (i32.store offset=4  (local.get $up) (global.get $bxs_d))
    (i32.store offset=8  (local.get $up) (global.get $bxs_a))
    (i32.store offset=12 (local.get $up) (global.get $bxs_imm))
    (i32.store offset=16 (local.get $up) (i32.const -1))
    (i32.store offset=20 (local.get $up) (global.get $bxs_b))
    (local.set $up (i32.add (local.get $up)
      (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2))))
    (i32.store           (local.get $up) (global.get $tu_kind))
    (i32.store offset=4  (local.get $up) (global.get $tu_d))
    (i32.store offset=8  (local.get $up) (global.get $tu_a))
    (i32.store offset=12 (local.get $up) (global.get $tu_imm))
    (i32.store offset=16 (local.get $up) (global.get $tu_fn))
    (i32.store offset=20 (local.get $up) (global.get $tu_b))
    ;; Round 12 lever C: the RMW form's store half. Its `fn` is -1 for the same
    ;; reason the load half's is -- one x86 instruction must count once in the
    ;; handler histogram however many micro-ops it became, or a histogram taken
    ;; with the pass on is not comparable with one taken without it.
    (if (i32.eq (global.get $bx_split_n) (i32.const 3))
      (then
        (local.set $up (i32.add (local.get $up)
          (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2))))
        (i32.store           (local.get $up) (global.get $bxr_kind))
        (i32.store offset=4  (local.get $up) (global.get $bxr_d))
        (i32.store offset=8  (local.get $up) (global.get $bxr_a))
        (i32.store offset=12 (local.get $up) (global.get $bxr_imm))
        (i32.store offset=16 (local.get $up) (i32.const -1))
        (i32.store offset=20 (local.get $up) (global.get $bxr_b))
        (global.set $bx_pass_rmw
          (i64.add (global.get $bx_pass_rmw) (i64.const 1)))))
    (global.set $bx_pass_split
      (i64.add (global.get $bx_pass_split) (i64.const 1))))

  ;; ----------------------------------------------------------------------
  ;; $block_exec_try_install -- the matcher. Called from $decode_block AFTER
  ;; $loop_match_block, so every specialised family keeps priority; a block one
  ;; of them claimed set $op_index_n to 0 and is declined here on the first
  ;; test.
  ;;
  ;; What it emits is a ONE-BLOCK REGION with term_kind 5: the same descriptor
  ;; format the loop matcher emits for a self-loop, with no exit table and the
  ;; block's own terminator left threaded in the stream behind it. Folding that
  ;; terminator (OPEN-1) is a decode-time change to this function alone -- the
  ;; executor already runs folded terminators for every other kind.
  ;; ----------------------------------------------------------------------
  (func $block_exec_try_install (param $start_eip i32) (param $tstart i32) (result i32)
    (local $n i32) (local $i i32) (local $p i32) (local $pn i32) (local $fn i32)
    (local $tail_p i32) (local $tail_bytes i32) (local $tail_words i32)
    (local $sc i32) (local $base i32) (local $cap i32)
    (local $ucap i32) (local $fbb i32) (local $fbw i32)
    (local $words i32) (local $nuops i32) (local $k i32) (local $nw i32)
    (local $j i32) (local $total i32) (local $extra i32)
    (local $nat i32) (local $nfb i32) (local $up i32)
    (local $span i32) (local $pe i32) (local $nx87 i32)
    ;; Round 15 (section 24): TU_X87RUN micro-ops, their read mask, and the
    ;; walk's verdict on whether this run may take the cheap arm.
    (local $nx87run i32) (local $rmask i32) (local $cheap i32) (local $peop i32)
    ;; Round 13: the displaced threaded stream, saved with the descriptor.
    (local $rawlen i32) (local $save i32) (local $extra i32) (local $rawoff i32)

    (if (i32.eqz (global.get $block_exec_enabled)) (then (return (i32.const 0))))
    ;; A fold already rewrote this block.
    (if (i32.eqz (global.get $op_index_n)) (then (return (i32.const 0))))
    ;; Round 13: if the region walker asked for this block's threaded stream,
    ;; this install carries a copy of it (see the SAVE THE STREAM comment
    ;; below). It is not declined -- declining would cost the one-block family
    ;; every member of every region the walker ever looked at.
    ;; OP_INDEX overflowed, so op boundaries are unknown; 16-bit blocks have a
    ;; different register and address model; and under --fault-null=stop a
    ;; native memory op can trap with the register locals unpublished, so the
    ;; whole family stands down while that is armed (design doc section 6).
    (if (i32.or (global.get $op_index_poison)
        (i32.or (global.get $code16) (global.get $fault_unmapped)))
      (then (global.set $block_exec_decl_why (i32.const 2))
            (global.set $block_exec_declines
              (i32.add (global.get $block_exec_declines) (i32.const 1)))
            (return (i32.const 0))))

    (local.set $n (global.get $op_index_n))
    (local.set $base (call $bx_scratch))
    (local.set $cap (call $bx_scratch_words))
    (local.set $ucap (i32.shr_u (local.get $cap) (i32.const 1)))
    (local.set $fbb (i32.add (local.get $base) (i32.shl (local.get $ucap) (i32.const 2))))
    ;; The near half of OP_INDEX holds this block's op addresses. Past its
    ;; halfway point those entries ARE the scratch, so building a descriptor
    ;; would eat the input.
    (if (i32.ge_u (local.get $n) (local.get $ucap))
      (then (global.set $block_exec_decl_why (i32.const 5))
            (global.set $block_exec_declines
              (i32.add (global.get $block_exec_declines) (i32.const 1)))
            (return (i32.const 0))))
    ;; body ops = n - 1 (the terminator is not ours)
    (if (i32.lt_u (local.get $n) (i32.const 2))
      (then (global.set $block_exec_decl_why (i32.const 1))
            (global.set $block_exec_declines
              (i32.add (global.get $block_exec_declines) (i32.const 1)))
            (return (i32.const 0))))

    ;; The terminator: the last op, which must actually be one.
    (local.set $tail_p (call $loop_op_at (i32.sub (local.get $n) (i32.const 1))))
    (local.set $tail_bytes (i32.sub (global.get $thread_alloc) (local.get $tail_p)))
    (if (i32.or (i32.lt_u (local.get $tail_bytes) (i32.const 8))
                (i32.gt_u (local.get $tail_bytes) (i32.const 64)))
      (then (global.set $block_exec_decl_why (i32.const 3))
            (global.set $block_exec_declines
              (i32.add (global.get $block_exec_declines) (i32.const 1)))
            (return (i32.const 0))))
    (if (i32.eqz (call $bx_op_unsafe (i32.load (local.get $tail_p))))
      (then (global.set $block_exec_decl_why (i32.const 3))
            (global.set $block_exec_declines
              (i32.add (global.get $block_exec_declines) (i32.const 1)))
            (return (i32.const 0))))
    (local.set $tail_words (i32.shr_u (local.get $tail_bytes) (i32.const 2)))

    ;; ---- classify and assemble, one pass, into the scratch ----
    (local.set $sc (i32.const 0))
    (local.set $fbw (i32.const 0))
    (local.set $nuops (i32.const 0))
    (local.set $i (i32.const 0))
    (global.set $bx_lane_next (i32.const 0))
    (block $scan_done
      (loop $scan
        (br_if $scan_done (i32.ge_u (local.get $i)
                                    (i32.sub (local.get $n) (i32.const 1))))
        (local.set $p (call $loop_op_at (local.get $i)))
        (local.set $pn (call $loop_op_at (i32.add (local.get $i) (i32.const 1))))
        (local.set $fn (i32.load (local.get $p)))

        ;; ---- ROUND 12 (OPEN-6): x87, as ONE fallback micro-op.
        ;;
        ;; This runs before the safety test on purpose. 188..190 and the fused
        ;; families 449..453 are all "unsafe" to $bx_op_unsafe -- 188..190
        ;; because the x87 fusers used to run after this matcher, 449..453
        ;; because everything at 418 and up is a fold unless stated otherwise.
        ;; Neither reason survives round 12: the fusers now run FIRST
        ;; (07-decoder.wat), and none of these five handlers touches $eip. What
        ;; makes them safe here is exactly what makes any fallback safe -- the
        ;; executor spills all eight registers, sets $ip at the op's inline
        ;; words in the pool, call_indirects the real handler, and reloads. The
        ;; x87 stack, tags and status word are globals the executor never
        ;; touches, so they are preserved by not being modelled at all.
        ;;
        ;; A fused op's absorbed ops are STILL in the stream as its inline
        ;; data with their original handler words, so the span comes from
        ;; $x87_fused_span and the inline words run from this op's second word
        ;; to wherever the op $span entries later starts. A bare x87 op (a run
        ;; the fuser refused, or --no-x87-fusion) is span 1 and the generic
        ;; `nw` arithmetic below already gets it right; it is here only so the
        ;; unsafe test does not decline the block first.
        ;;
        ;; ---- ROUND 15 (section 24) adds two cheaper outcomes ahead of that.
        ;;
        ;; (a) A BARE H188..H190 goes to $tree_uop_classify first. That
        ;;     function already emits 07b's own native x87 kinds -- TU_X87_MEM,
        ;;     TU_X87_MRO, TU_X87_REG and TU_X87_SW_AX -- which the executor
        ;;     has run since the H454 merge, so the only reason a bare x87 op
        ;;     was ever a fallback here is that this arm ran before the
        ;;     classifier did. Those are real saved dispatches and bump $nat.
        ;;     A form the classifier declines still falls through to (c).
        ;;
        ;; (b) A FUSED H449..H453 whose absorbed ops all pass the island
        ;;     predicates becomes ONE TU_X87RUN: the fused body is called
        ;;     directly, with only the registers it reads published and none
        ;;     reloaded. It saves no dispatch -- the fold already made the run
        ;;     one -- so $nat is still not bumped; what it saves is the
        ;;     trampoline, and it is priced at $BX_C_X87RUN instead of
        ;;     $BX_C_X87FB.
        ;;
        ;; (c) Anything else keeps the round-12 TU_FALLBACK exactly as it was.
        (local.set $span (i32.const 0))
        (if (global.get $block_exec_x87)
          (then
            (if (i32.and (i32.ge_u (local.get $fn) (i32.const 188))
                         (i32.le_u (local.get $fn) (i32.const 190)))
              (then
                (local.set $span (i32.const 1))
                ;; (a). The emit is the same six stores the generic classify
                ;; path below does; it is repeated rather than jumped to
                ;; because this arm sits above the $bx_op_unsafe test that
                ;; would otherwise have declined the block already.
                (if (call $tree_uop_classify (local.get $p))
                  (then
                    (if (i32.gt_u (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS))
                                  (local.get $ucap))
                      (then (global.set $block_exec_decl_why (i32.const 5))
                            (global.set $block_exec_declines
                              (i32.add (global.get $block_exec_declines) (i32.const 1)))
                            (return (i32.const 0))))
                    (local.set $up
                      (i32.add (local.get $base) (i32.shl (local.get $sc) (i32.const 2))))
                    (local.set $extra (i32.add (local.get $extra) (global.get $tu_extra)))
                    (i32.store           (local.get $up) (global.get $tu_kind))
                    (i32.store offset=4  (local.get $up) (global.get $tu_d))
                    (i32.store offset=8  (local.get $up) (global.get $tu_a))
                    (i32.store offset=12 (local.get $up) (global.get $tu_imm))
                    (i32.store offset=16 (local.get $up) (global.get $tu_fn))
                    (i32.store offset=20 (local.get $up) (global.get $tu_b))
                    (local.set $sc (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS)))
                    (local.set $nuops (i32.add (local.get $nuops) (i32.const 1)))
                    (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
                    (global.set $bx_x87_native_uops
                      (i64.add (global.get $bx_x87_native_uops) (i64.const 1)))
                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                    (br $scan))))
              (else
                (local.set $span
                  (call $x87_fused_span (local.get $fn)
                        (i32.load offset=4 (local.get $p))))))))
        (if (local.get $span)
          (then
            ;; The span must stay inside the body: the terminator is op n-1 and
            ;; is emitted separately. Anything else means the fuser and this
            ;; walk disagree, and guessing is how a block runs its own inline
            ;; data as handlers.
            (if (i32.gt_u (i32.add (local.get $i) (local.get $span))
                          (i32.sub (local.get $n) (i32.const 1)))
              (then (global.set $block_exec_decl_why (i32.const 3))
                    (global.set $block_exec_declines
                      (i32.add (global.get $block_exec_declines) (i32.const 1)))
                    (return (i32.const 0))))
            ;; Every absorbed entry must be a plain x87 op. Checked rather than
            ;; assumed, because this is the one place a wrong span silently
            ;; turns inline address words into a handler index.
            ;;
            ;; ROUND 15: the same walk now also answers the TU_X87RUN question
            ;; for the ISLAND family, whose base registers and (group, reg, rm)
            ;; forms live in the absorbed records rather than in the packed
            ;; word. $cheap starts at 1 and only ever falls to 0, so a walk
            ;; that finds one unimplemented form -- or an FNSTSW AX, which
            ;; $tree_x87_reg_ok declines and which WRITES EAX -- puts the whole
            ;; run back on the old trampoline rather than half of it.
            ;;
            ;; The other four families are shape-matched by their fusers: they
            ;; call $fpu_arith / $fpu_push / $fpu_set directly and never reach
            ;; $fpu_exec_mem's default arm, so they are cheap by construction
            ;; and their mask comes from $x87_run_reads.
            (local.set $cheap (i32.const 1))
            (local.set $rmask (call $x87_run_reads (local.get $fn)
                                (i32.load offset=4 (local.get $p))))
            (if (i32.eq (local.get $fn) (i32.const 451))
              (then
                ;; op 0 is the one the fuser overwrote; the packed word kept
                ;; its handler at bits 12..19 and its operand at bits 0..11.
                (local.set $peop (i32.load offset=4 (local.get $p)))
                (local.set $pe
                  (i32.and (i32.shr_u (local.get $peop) (i32.const 12)) (i32.const 0xFF)))
                (local.set $peop (i32.and (local.get $peop) (i32.const 0xFFF)))
                (if (i32.eqz (call $x87_island_op_ok (local.get $pe) (local.get $peop)))
                  (then (local.set $cheap (i32.const 0))))
                (local.set $rmask (i32.or (local.get $rmask)
                  (call $x87_island_op_base (local.get $pe) (local.get $peop))))))
            (local.set $j (i32.const 1))
            (block $ab_done
              (loop $ab
                (br_if $ab_done (i32.ge_u (local.get $j) (local.get $span)))
                (local.set $pe (call $loop_op_at (i32.add (local.get $i) (local.get $j))))
                (local.set $peop (i32.load offset=4 (local.get $pe)))
                (local.set $pe (i32.load (local.get $pe)))
                ;; 188..190 is the ordinary case. 449..453 is the one ROUND 15
                ;; found: the five fusers run in a fixed order and none of them
                ;; skips ops an earlier one already absorbed, so
                ;; $x87_island_fuse_block -- which runs LAST -- re-fuses the
                ;; TAIL of an H449/H450/H452/H453 region into an H451. Only the
                ;; first op's handler word is rewritten, and an outer fused
                ;; body reads its inline stream by ADDRESS WORD only (H449 takes
                ;; $tp+0/+12/+24/+36, i.e. the address slot of each absorbed
                ;; 12-byte record) -- so the rewritten handler and operand words
                ;; are dead data on the threaded path and nothing observes them.
                ;; They were NOT dead here: this check declined the whole block
                ;; over them, which is why an H449 mode-0 region -- the four-op
                ;; FLD/arith/arith/FSTP pipeline, the commonest shape the fold
                ;; has -- never installed at all before round 15.
                (if (i32.eqz (i32.or
                      (i32.and (i32.ge_u (local.get $pe) (i32.const 188))
                               (i32.le_u (local.get $pe) (i32.const 190)))
                      (i32.and (i32.ge_u (local.get $pe) (i32.const 449))
                               (i32.le_u (local.get $pe) (i32.const 453)))))
                  (then (global.set $block_exec_decl_why (i32.const 3))
                        (global.set $block_exec_declines
                          (i32.add (global.get $block_exec_declines) (i32.const 1)))
                        (return (i32.const 0))))
                (if (i32.eq (local.get $fn) (i32.const 451))
                  (then
                    (if (i32.eqz (call $x87_island_op_ok
                                   (local.get $pe) (local.get $peop)))
                      (then (local.set $cheap (i32.const 0))))
                    (local.set $rmask (i32.or (local.get $rmask)
                      (call $x87_island_op_base (local.get $pe) (local.get $peop))))))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $ab)))
            ;; room for one micro-op, before anything is written
            (if (i32.gt_u (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS))
                          (local.get $ucap))
              (then (global.set $block_exec_decl_why (i32.const 5))
                    (global.set $block_exec_declines
                      (i32.add (global.get $block_exec_declines) (i32.const 1)))
                    (return (i32.const 0))))
            (local.set $up (i32.add (local.get $base) (i32.shl (local.get $sc) (i32.const 2))))
            ;; Inline words: from this op's word 2 to the start of the op the
            ;; span ends at. $pe is that op's address.
            (local.set $pe (call $loop_op_at (i32.add (local.get $i) (local.get $span))))
            (local.set $nw (i32.shr_u
              (i32.sub (i32.sub (local.get $pe) (local.get $p)) (i32.const 8))
              (i32.const 2)))
            (if (i32.gt_u (i32.add (local.get $fbw) (i32.add (local.get $nw) (i32.const 2)))
                          (i32.sub (local.get $cap) (local.get $ucap)))
              (then (global.set $block_exec_decl_why (i32.const 5))
                    (global.set $block_exec_declines
                      (i32.add (global.get $block_exec_declines) (i32.const 1)))
                    (return (i32.const 0))))
            ;; A BARE op never takes the cheap arm here: path (a) above already
            ;; had first refusal on it through $tree_uop_classify, and this is
            ;; the residue that function declined. TU_X87RUN's body dispatch
            ;; only knows 449..453.
            (if (i32.and (i32.ge_u (local.get $fn) (i32.const 188))
                         (i32.le_u (local.get $fn) (i32.const 190)))
              (then (local.set $cheap (i32.const 0))))
            (i32.store           (local.get $up)
              (select (global.get $TU_X87RUN) (global.get $TU_FALLBACK)
                      (local.get $cheap)))
            ;; `d` is the read mask for TU_X87RUN and inert for TU_FALLBACK,
            ;; which publishes all eight regardless.
            (i32.store offset=4  (local.get $up) (local.get $rmask))
            (i32.store offset=8  (local.get $up) (local.get $fn))
            (i32.store offset=12 (local.get $up) (i32.load offset=4 (local.get $p)))
            (i32.store offset=16 (local.get $up) (local.get $fn))
            (i32.store offset=20 (local.get $up) (i32.shl (local.get $fbw) (i32.const 2)))
            (local.set $sc (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS)))
            (local.set $j (i32.const 0))
            (block $x87cp_done
              (loop $x87cp
                (br_if $x87cp_done (i32.ge_u (local.get $j) (local.get $nw)))
                (i32.store (i32.add (local.get $fbb) (i32.shl (local.get $fbw) (i32.const 2)))
                  (i32.load (i32.add (local.get $p)
                    (i32.add (i32.const 8) (i32.shl (local.get $j) (i32.const 2))))))
                (local.set $fbw (i32.add (local.get $fbw) (i32.const 1)))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $x87cp)))
            ;; The H459 resume trampoline. TU_X87RUN does not need one -- it
            ;; never calls $next -- but the two words are written for it all
            ;; the same, so the pool layout is one shape and the size check
            ;; above is one arithmetic. Two words per fused run, once, at
            ;; install time.
            (i32.store (i32.add (local.get $fbb) (i32.shl (local.get $fbw) (i32.const 2)))
                       (global.get $BX_RESUME_HANDLER))
            (i32.store offset=4 (i32.add (local.get $fbb) (i32.shl (local.get $fbw) (i32.const 2)))
                       (i32.const 0))
            (local.set $fbw (i32.add (local.get $fbw) (i32.const 2)))
            (local.set $nuops (i32.add (local.get $nuops) (i32.const 1)))
            (global.set $bx_x87_uops
              (i64.add (global.get $bx_x87_uops) (i64.const 1)))
            (if (local.get $cheap)
              (then
                ;; Cheap arm. NOT counted in $nfb: a fallback bills itself a
                ;; step through the parked counter (its handler ends in
                ;; $next), and this one does not call $next at all -- so its
                ;; one step has to be in the descriptor's `cost` instead, via
                ;; $nx87run. $nat stays where it is: no dispatch was saved.
                (local.set $nx87run (i32.add (local.get $nx87run) (i32.const 1)))
                (global.set $bx_x87run_uops
                  (i64.add (global.get $bx_x87run_uops) (i64.const 1))))
              (else
                (local.set $nfb (i32.add (local.get $nfb) (i32.const 1)))
                ;; counted separately so the cost model can charge it $BX_C_X87FB
                (local.set $nx87 (i32.add (local.get $nx87) (i32.const 1)))))
            (local.set $i (i32.add (local.get $i) (local.get $span)))
            (br $scan)))

        ;; A terminator in the body means the block does not have the shape
        ;; OP_INDEX says it has. Decline rather than guess.
        (if (call $bx_op_unsafe (local.get $fn))
          (then (global.set $block_exec_decl_why (i32.const 3))
                (global.set $block_exec_declines
                  (i32.add (global.get $block_exec_declines) (i32.const 1)))
                (return (i32.const 0))))
        ;; room for one micro-op, before anything is written
        (if (i32.gt_u (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS))
                      (local.get $ucap))
          (then (global.set $block_exec_decl_why (i32.const 5))
                (global.set $block_exec_declines
                  (i32.add (global.get $block_exec_declines) (i32.const 1)))
                (return (i32.const 0))))
        (local.set $up (i32.add (local.get $base) (i32.shl (local.get $sc) (i32.const 2))))

        (local.set $k (i32.const -1))
        ;; PUSH/POP r32 carry the register in the HANDLER index (323..338), so
        ;; $tree_uop_classify has nothing to say about them and this file's own
        ;; three kinds are recognised here.
        (if (i32.or (i32.eq (local.get $fn) (global.get $TH_PUSH_R))
                    (i32.and (i32.ge_u (local.get $fn) (i32.const 323))
                             (i32.le_u (local.get $fn) (i32.const 330))))
          (then
            (i32.store           (local.get $up) (global.get $TU_PUSH_R))
            (i32.store offset=4  (local.get $up)
              (select (i32.load offset=4 (local.get $p)) (i32.sub (local.get $fn) (i32.const 323))
                      (i32.eq (local.get $fn) (global.get $TH_PUSH_R))))
            (i32.store offset=8  (local.get $up) (i32.const 0))
            (i32.store offset=12 (local.get $up) (i32.const 0))
            (i32.store offset=16 (local.get $up) (local.get $fn))
            (i32.store offset=20 (local.get $up) (i32.const 0))
            (local.set $sc (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS)))
            (local.set $nuops (i32.add (local.get $nuops) (i32.const 1)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))
        (if (i32.or (i32.eq (local.get $fn) (global.get $TH_POP_R))
                    (i32.and (i32.ge_u (local.get $fn) (i32.const 331))
                             (i32.le_u (local.get $fn) (i32.const 338))))
          (then
            (i32.store           (local.get $up) (global.get $TU_POP_R))
            (i32.store offset=4  (local.get $up)
              (select (i32.load offset=4 (local.get $p)) (i32.sub (local.get $fn) (i32.const 331))
                      (i32.eq (local.get $fn) (global.get $TH_POP_R))))
            (i32.store offset=8  (local.get $up) (i32.const 0))
            (i32.store offset=12 (local.get $up) (i32.const 0))
            (i32.store offset=16 (local.get $up) (local.get $fn))
            (i32.store offset=20 (local.get $up) (i32.const 0))
            (local.set $sc (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS)))
            (local.set $nuops (i32.add (local.get $nuops) (i32.const 1)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))
        ;; PUSH imm32 -- one inline word, no register at all.
        (if (i32.and (i32.eq (local.get $fn) (i32.const 34))
                     (i32.eq (i32.sub (local.get $pn) (local.get $p)) (i32.const 12)))
          (then
            (i32.store           (local.get $up) (global.get $TU_PUSH_I))
            (i32.store offset=4  (local.get $up) (i32.const 0))
            (i32.store offset=8  (local.get $up) (i32.const 0))
            (i32.store offset=12 (local.get $up) (i32.load offset=8 (local.get $p)))
            (i32.store offset=16 (local.get $up) (local.get $fn))
            (i32.store offset=20 (local.get $up) (i32.const 0))
            (local.set $sc (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS)))
            (local.set $nuops (i32.add (local.get $nuops) (i32.const 1)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))

        ;; The loop matcher's classifier, unchanged, straight into the same kind
        ;; space the executor dispatches on. There is no remap step any more --
        ;; that function was where the two encodings could disagree.
        (if (call $tree_uop_classify (local.get $p))
          (then (local.set $k (global.get $tu_kind))))

        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            ;; Steps this op bills BEYOND the one $next charges for its own
            ;; dispatch. Carrying it matters even though nothing architectural
            ;; depends on it: `--block-exec` must not silently buy the guest
            ;; more work per batch than the threaded arm got, or every
            ;; fixed-batch A/B is comparing two different amounts of guest
            ;; execution and reads as a speedup.
            (local.set $extra (i32.add (local.get $extra) (global.get $tu_extra)))
            (i32.store           (local.get $up) (local.get $k))
            (i32.store offset=4  (local.get $up) (global.get $tu_d))
            (i32.store offset=8  (local.get $up) (global.get $tu_a))
            (i32.store offset=12 (local.get $up) (global.get $tu_imm))
            (i32.store offset=16 (local.get $up) (global.get $tu_fn))
            (i32.store offset=20 (local.get $up) (global.get $tu_b))
            (local.set $sc (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS)))
            (local.set $nuops (i32.add (local.get $nuops) (i32.const 1)))
            (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)))

        ;; ---- the round-11 split. A memory-form ALU or IMUL the classifier
        ;; had nothing to say about becomes a LOAD into a temp lane plus a
        ;; register-form op on that lane -- two micro-ops where every other
        ;; path writes one, so the room check is for twelve words rather than
        ;; six. `nat` still counts ONE, because it is a count of x86
        ;; instructions and feeds the block's `cost`.
        (if (call $bx_try_split (local.get $p) (call $bx_next_lane))
          (then
            (if (i32.le_u (i32.add (local.get $sc)
                            (i32.mul (global.get $TREE_UOP_WORDS)
                                     (global.get $bx_split_n)))
                          (local.get $ucap))
              (then
                (call $bx_emit_split (local.get $up))
                (local.set $sc (i32.add (local.get $sc)
                  (i32.mul (global.get $TREE_UOP_WORDS)
                           (global.get $bx_split_n))))
                (local.set $nuops (i32.add (local.get $nuops) (global.get $bx_split_n)))
                (local.set $nat (i32.add (local.get $nat) (i32.const 1)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $scan)))))

        ;; ---- fallback. The micro-op stays exactly six words; the op's own
        ;; inline words and the H459 resume trampoline go into the pool, and the
        ;; micro-op's `b` word carries the byte offset of the first of them.
        (local.set $nw (i32.shr_u
          (i32.sub (i32.sub (local.get $pn) (local.get $p)) (i32.const 8))
          (i32.const 2)))
        (if (i32.gt_u (i32.add (local.get $fbw) (i32.add (local.get $nw) (i32.const 2)))
                      (i32.sub (local.get $cap) (local.get $ucap)))
          (then (global.set $block_exec_decl_why (i32.const 5))
                (global.set $block_exec_declines
                  (i32.add (global.get $block_exec_declines) (i32.const 1)))
                (return (i32.const 0))))
        (i32.store           (local.get $up) (global.get $TU_FALLBACK))
        (i32.store offset=4  (local.get $up) (i32.const 0))
        ;; `a` is the handler index -- the executor calls through it, and it is
        ;; never a register number, so the R[a] read the common path does above
        ;; lands on the br_table default and is discarded.
        (i32.store offset=8  (local.get $up) (local.get $fn))
        ;; the handler's own operand word rides in `imm`
        (i32.store offset=12 (local.get $up) (i32.load offset=4 (local.get $p)))
        (i32.store offset=16 (local.get $up) (local.get $fn))
        (i32.store offset=20 (local.get $up) (i32.shl (local.get $fbw) (i32.const 2)))
        (local.set $sc (i32.add (local.get $sc) (global.get $TREE_UOP_WORDS)))
        (local.set $j (i32.const 0))
        (block $cp_done
          (loop $cp
            (br_if $cp_done (i32.ge_u (local.get $j) (local.get $nw)))
            (i32.store (i32.add (local.get $fbb) (i32.shl (local.get $fbw) (i32.const 2)))
              (i32.load (i32.add (local.get $p)
                (i32.add (i32.const 8) (i32.shl (local.get $j) (i32.const 2))))))
            (local.set $fbw (i32.add (local.get $fbw) (i32.const 1)))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $cp)))
        (i32.store (i32.add (local.get $fbb) (i32.shl (local.get $fbw) (i32.const 2)))
                   (global.get $BX_RESUME_HANDLER))
        (i32.store offset=4 (i32.add (local.get $fbb) (i32.shl (local.get $fbw) (i32.const 2)))
                   (i32.const 0))
        (local.set $fbw (i32.add (local.get $fbw) (i32.const 2)))
        (local.set $nuops (i32.add (local.get $nuops) (i32.const 1)))
        (local.set $nfb (i32.add (local.get $nfb) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))

    ;; ---- the round-11 optimisation pass, over the block just assembled.
    ;; term_pos is -1 here: a one-block descriptor leaves its terminator
    ;; threaded behind the executor, so there is no folded terminator inside
    ;; the micro-op list for a move to be carried across.
    ;; term_wreg is -1 for the same reason term_pos is: a one-block descriptor
    ;; leaves its terminator threaded behind the executor, so there is no
    ;; lifted-out producer whose register write walk 1 could miss.
    (global.set $bx_opt_term_wreg (i32.const -1))
    (local.set $nuops
      (call $bx_opt_pass (local.get $base) (local.get $nuops) (i32.const -1)))
    (local.set $sc (i32.mul (local.get $nuops) (global.get $TREE_UOP_WORDS)))
    (local.set $words (local.get $sc))

    ;; ---- worth it? Either the explicit floor, when one was asked for, or the
    ;; cost model. $block_exec_min_uops of 0 means "use the model"; a nonzero
    ;; value is the old uop-count floor, kept because every A/B command in the
    ;; design doc names one and they have to keep meaning what they meant.
    (if (global.get $block_exec_min_uops)
      (then
        (if (i32.lt_u (local.get $nuops) (global.get $block_exec_min_uops))
          (then (global.set $block_exec_decl_why (i32.const 1))
                (global.set $block_exec_declines
                  (i32.add (global.get $block_exec_declines) (i32.const 1)))
                (return (i32.const 0)))))
      (else
        ;; One block, so no interior transfer is saved yet -- the transfer term
        ;; is written out because the region matcher is what will make it
        ;; nonzero and the arithmetic has to already be right when it does.
        (if (i32.le_s
              (i32.sub
                (i32.add (i32.mul (local.get $nat) (global.get $BX_C_UOP))
                         (i32.mul (i32.const 0) (global.get $BX_C_TRANSFER)))
                ;; $nfb counts the x87 FALLBACK micro-ops too; bill those at
                ;; the higher $BX_C_X87FB and the rest at the plain fallback
                ;; price. $nx87run is NOT in $nfb (round 15) and is billed at
                ;; its own, much smaller, $BX_C_X87RUN.
                (i32.add (global.get $BX_C_ENTRY)
                  (i32.add
                    (i32.mul (local.get $nx87run) (global.get $BX_C_X87RUN))
                    (i32.add
                      (i32.mul (i32.sub (local.get $nfb) (local.get $nx87))
                               (global.get $BX_C_FALLBACK))
                      (i32.mul (local.get $nx87) (global.get $BX_C_X87FB))))))
              (i32.const 0))
          (then (global.set $block_exec_decl_why (i32.const 1))
                (global.set $block_exec_declines
                  (i32.add (global.get $block_exec_declines) (i32.const 1)))
                (return (i32.const 0))))))
    (if (i32.and (i32.ne (global.get $block_exec_max_uops) (i32.const 0))
                 (i32.gt_u (local.get $nuops) (global.get $block_exec_max_uops)))
      (then (global.set $block_exec_decl_why (i32.const 1))
            (global.set $block_exec_declines
              (i32.add (global.get $block_exec_declines) (i32.const 1)))
            (return (i32.const 0))))

    ;; ---- the emit slack, DERIVED. $decode_block reserves 4096 bytes past
    ;; $thread_alloc before $te signals a flush, and a descriptor past it
    ;; corrupts the next block silently instead of failing.
    ;; 8 dispatch + 16 header + 52 block record + 0 exit table + uops + pool
    ;; + the threaded terminator.
    ;; ---- round 13: SAVE THE STREAM THIS DESCRIPTOR DISPLACES.
    ;; The region walker classifies threaded ops and no longer decodes, so a
    ;; block this family claims is invisible to discovery unless its ops are
    ;; still readable somewhere. They are: a byte-for-byte copy of the block's
    ;; threaded stream, preceded by its op-boundary table, rides along at the
    ;; tail of the fallback pool -- inert to the executor, which addresses the
    ;; pool only through offsets its own micro-ops carry, and reachable from
    ;; $page_cached_ops through the descriptor's otherwise-unused operand word.
    ;;
    ;; ROUND 13 made the copy conditional on $bx_raw_wanted, because a
    ;; descriptor plus its copy is roughly twice the bytes and they were
    ;; competing with ordinary threaded code for one 16KB chunk that DROPS THE
    ;; WHOLE PAGE when it overflows -- 1,064,880 block decodes against 950,026
    ;; with the copy withheld. ROUND 14 removed that competition: descriptors
    ;; and their copies live in a chunk of their own, and overflowing it
    ;; declines one install instead of throwing a page away. So the copy is
    ;; made for every install that has room for it, and the "wanted" mark is
    ;; left as what it always was -- the record of a walk that had to take a
    ;; descriptor back because no copy was there.
    (local.set $rawoff (i32.const 0))
    (local.set $extra (i32.const 0))
    (local.set $total
      (i32.add
        (i32.add (i32.const 76) (i32.shl (local.get $words) (i32.const 2)))
        (i32.add (i32.shl (local.get $fbw) (i32.const 2)) (local.get $tail_bytes))))
    ;; The only precondition left is that the copy would be readable: an op
    ;; table of $n entries, and a decoder that can still describe them.
    (if (i32.and (i32.ne (local.get $n) (i32.const 0))
                 (i32.eqz (global.get $op_index_poison)))
      (then
        (local.set $rawlen (i32.sub (global.get $thread_alloc) (local.get $tstart)))
        (local.set $rawoff
          (i32.add (i32.const 76)
            (i32.add (i32.shl (local.get $words) (i32.const 2))
                     (i32.shl (local.get $fbw) (i32.const 2)))))
        (local.set $extra
          (i32.add (i32.const 8)
            (i32.add (i32.shl (local.get $n) (i32.const 2)) (local.get $rawlen))))
        ;; Too big WITH the copy is not a decline: publish the descriptor
        ;; without it and let discovery meet it again. Installs must not fall
        ;; for a diagnostic convenience.
        (if (i32.or
              (i32.gt_u (i32.add (local.get $total) (local.get $extra))
                        (i32.const 4096))
              (i32.ge_u
                (i32.add
                  (i32.add (local.get $tstart)
                    (i32.add (local.get $total) (local.get $extra)))
                  (i32.add (local.get $rawlen) (i32.const 64)))
                (i32.sub (global.get $THREAD_END) (i32.const 4096))))
          (then
            (local.set $extra (i32.const 0))
            (local.set $rawoff (i32.const 0))
            (global.set $bx_desc_nocopy
              (i32.add (global.get $bx_desc_nocopy) (i32.const 1))))
          (else
            (local.set $total (i32.add (local.get $total) (local.get $extra)))
            ;; Park the table and the bytes past where the descriptor will end
            ;; -- the emit rewinds to $tstart and writes straight over the
            ;; stream being copied.
            (local.set $save
              (i32.add (i32.add (local.get $tstart) (local.get $total))
                       (i32.const 64)))
            (i32.store (local.get $save) (local.get $n))
            (i32.store offset=4 (local.get $save) (local.get $rawlen))
            (local.set $j (i32.const 0))
            (block $ot_done
              (loop $ot
                (br_if $ot_done (i32.ge_u (local.get $j) (local.get $n)))
                (i32.store
                  (i32.add (local.get $save)
                    (i32.shl (i32.add (local.get $j) (i32.const 2)) (i32.const 2)))
                  (i32.sub (call $loop_op_at (local.get $j)) (local.get $tstart)))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $ot)))
            (memory.copy
              (i32.add (local.get $save)
                (i32.add (i32.const 8) (i32.shl (local.get $n) (i32.const 2))))
              (local.get $tstart) (local.get $rawlen))))))
    (if (i32.gt_u (local.get $total) (i32.const 4096))
      (then (global.set $block_exec_decl_why (i32.const 4))
            (global.set $block_exec_declines
              (i32.add (global.get $block_exec_declines) (i32.const 1)))
            (return (i32.const 0))))
    ;; ---- round 14 admission control. The question is now only "does this
    ;; descriptor fit in the page's DESCRIPTOR chunk", which is a chunk no
    ;; ordinary block ever writes to. There is no reserve and no overflow memo
    ;; because there is nothing left to protect: round 13 needed both because a
    ;; descriptor could be the byte that pushed the shared 16KB chunk over and
    ;; $page_publish answers that by DROPPING THE PAGE.
    ;;
    ;; Declining here costs nothing: $publish_block goes on to publish the
    ;; ordinary threaded block, which is smaller and fits.
    ;; ROUND 17: the ONE-BLOCK family leaves $page_desc_rg_reserve behind it,
    ;; so it stops installing while the chunk still has room for a region. At
    ;; the default of 0 this is exactly round 16's admission test.
    (if (i32.eqz (call $page_desc_would_fit (local.get $start_eip) (local.get $total)
                    (global.get $page_desc_rg_reserve)))
      (then (global.set $bx_no_room (i32.add (global.get $bx_no_room) (i32.const 1)))
            (global.set $block_exec_decl_why (i32.const 4))
            (global.set $block_exec_declines
              (i32.add (global.get $block_exec_declines) (i32.const 1)))
            (return (i32.const 0))))

    ;; Copy the terminator into the scratch before the descriptor overwrites
    ;; the arena it currently lives in. It goes after the fallback pool, which
    ;; is exactly where it will land in the emitted descriptor.
    (local.set $j (i32.const 0))
    (block $tl_done
      (loop $tl
        (br_if $tl_done (i32.ge_u (local.get $j) (local.get $tail_words)))
        (i32.store (i32.add (local.get $fbb)
                     (i32.shl (i32.add (local.get $fbw) (local.get $j)) (i32.const 2)))
          (i32.load (i32.add (local.get $tail_p) (i32.shl (local.get $j) (i32.const 2)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $tl)))

    ;; ---- emit: a one-block region, no exits, terminator threaded ----
    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    ;; The operand the executor never reads carries the offset of the saved
    ;; threaded stream (0 = not saved).
    ;;
    ;; ROUND 16 (section 25): WHICH entry point. The descriptor bytes are the
    ;; same either way; only this word differs. The leaf takes it when the
    ;; block carries no micro-op that leaves the frame -- no TU_FALLBACK
    ;; (`$nfb`, which includes the x87 trampoline ones) and no TU_X87RUN
    ;; (`$nx87run`, which calls a fused body directly). Both counts are final
    ;; here: the round-11 pass rewrites kinds and lanes but never introduces a
    ;; fallback, and a descriptor is immutable after this point. term_kind is
    ;; the literal 5 below and nexits the literal 0, so the leaf's other two
    ;; contract terms are satisfied by construction.
    ;;
    ;; ROUND 17 (section 27): three entry points, not two. The pure leaf still
    ;; takes only the block that carries nothing leaving the frame; a block
    ;; that does now takes H464, which is the same leaf with arms 57 and 60
    ;; made real, instead of the whole region function. The two gates are
    ;; separate globals so an A/B can move one without the other --
    ;; `--no-block-exec-leaf-fb` reproduces round 16 exactly on this build.
    (call $te
      (select (global.get $BX_LEAF_HANDLER)
        (select (global.get $BX_LEAFFB_HANDLER) (global.get $BX_HANDLER)
          (i32.and (i32.ne (global.get $block_exec_leaf) (i32.const 0))
                   (i32.ne (global.get $block_exec_leaf_fb) (i32.const 0))))
        (i32.and (i32.ne (global.get $block_exec_leaf) (i32.const 0))
                 (i32.eqz (i32.or (local.get $nfb) (local.get $nx87run)))))
      (local.get $rawoff))
    (call $te_raw (i32.const 1))                    ;; nblocks
    (call $te_raw (i32.const 0))                    ;; nexits
    (call $te_raw (local.get $nuops))               ;; uops_total
    ;; fb_bytes INCLUDES the saved stream: it is how the executor finds its
    ;; threaded terminator, and the copy sits between the pool and the tail.
    (call $te_raw (i32.add (i32.shl (local.get $fbw) (i32.const 2))
                           (local.get $extra)))     ;; fb_bytes
    (call $te_raw (i32.const 0))                    ;; uop_off
    (call $te_raw (local.get $nuops))               ;; nuops
    (call $te_raw (i32.const -1))                   ;; term_pos: never
    (call $te_raw (i32.const 5))                    ;; term_kind: threaded tail
    (call $te_raw (i32.const 0))                    ;; term_a
    (call $te_raw (i32.const 0))                    ;; term_b
    (call $te_raw (i32.const 0))                    ;; term_uop
    (call $te_raw (i32.const 0))                    ;; term_imm
    (call $te_raw (i32.const 0))                    ;; term_cc
    ;; cost: the steps this block stands for on its own account. The fallbacks
    ;; are NOT in it -- they charge themselves through the parked counter, and
    ;; counting them here would bill the guest twice.
    ;; ROUND 14 FIX: this used to be `$nat + $extra`, i.e. the block's step
    ;; cost plus the BYTE COUNT of the saved threaded copy parked behind it.
    ;; A cost is steps; bytes are not steps. It was near-invisible while the
    ;; copy was rare (round 13 made it only for blocks discovery had asked
    ;; for), and would have billed the guest clock several hundred steps per
    ;; block now that every install carries one.
    ;;
    ;; ROUND 15: `+ $nx87run`. A TU_X87RUN calls the fused body WITHOUT going
    ;; through $next, so unlike every other fallback-shaped micro-op it charges
    ;; the guest nothing through the parked counter. The threaded arm this is
    ;; compared against spends exactly one step on the fused op's own dispatch,
    ;; so one step per run belongs here or `--block-exec-x87` silently buys the
    ;; guest more work per batch than `--block-exec` did.
    (call $te_raw (i32.add (local.get $nat) (local.get $nx87run)))
    (call $te_raw (i32.const 0))                    ;; succ_taken (unused)
    (call $te_raw (i32.const 0))                    ;; succ_fall  (unused)
    (call $te_raw (local.get $start_eip))           ;; entry_eip
    (local.set $j (i32.const 0))
    (block $em_done
      (loop $em
        (br_if $em_done (i32.ge_u (local.get $j) (local.get $words)))
        (call $te_raw
          (i32.load (i32.add (local.get $base) (i32.shl (local.get $j) (i32.const 2)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $em)))
    (local.set $j (i32.const 0))
    (block $fb_done
      (loop $fb
        (br_if $fb_done (i32.ge_u (local.get $j) (local.get $fbw)))
        (call $te_raw
          (i32.load (i32.add (local.get $fbb) (i32.shl (local.get $j) (i32.const 2)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $fb)))
    ;; ...and the saved stream, straight after the pool.
    (if (local.get $extra)
      (then
        (memory.copy (global.get $thread_alloc) (local.get $save)
                     (local.get $extra))
        (global.set $thread_alloc
          (i32.add (global.get $thread_alloc) (local.get $extra)))))
    ;; The terminator goes back through $te, not $te_raw, so OP_INDEX records
    ;; it as the block's last op at its new address -- which is what keeps
    ;; $decode_run's `optr + 16 == d_block_end` adjacency test working and lets
    ;; it patch the fall-through bit into the Jcc operand word.
    (call $te
      (i32.load (i32.add (local.get $fbb) (i32.shl (local.get $fbw) (i32.const 2))))
      (i32.load (i32.add (local.get $fbb)
                  (i32.shl (i32.add (local.get $fbw) (i32.const 1)) (i32.const 2)))))
    (local.set $j (i32.const 2))
    (block $tw_done
      (loop $tw
        (br_if $tw_done (i32.ge_u (local.get $j) (local.get $tail_words)))
        (call $te_raw
          (i32.load (i32.add (local.get $fbb)
                      (i32.shl (i32.add (local.get $fbw) (local.get $j)) (i32.const 2)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $tw)))

    (global.set $block_exec_installs
      (i32.add (global.get $block_exec_installs) (i32.const 1)))
    (if (global.get $block_exec_trace)
      (then
        (call $host_log_i32 (i32.const 0xBE000000))
        (call $host_log_i32 (local.get $start_eip))
        (call $host_log_i32 (local.get $nuops))
        (local.set $j (i32.const 0))
        (block $tr_done
          (loop $tr
            (br_if $tr_done (i32.ge_u (local.get $j) (local.get $words)))
            ;; kind, then the original handler index this micro-op came from
            (call $host_log_i32
              (i32.load (i32.add (local.get $base) (i32.shl (local.get $j) (i32.const 2)))))
            (call $host_log_i32
              (i32.load offset=16
                (i32.add (local.get $base) (i32.shl (local.get $j) (i32.const 2)))))
            ;; d, then b -- the destination lane and the source-lane field.
            (call $host_log_i32
              (i32.load offset=4
                (i32.add (local.get $base) (i32.shl (local.get $j) (i32.const 2)))))
            (call $host_log_i32
              (i32.load offset=20
                (i32.add (local.get $base) (i32.shl (local.get $j) (i32.const 2)))))
            (local.set $j (i32.add (local.get $j) (global.get $TREE_UOP_WORDS)))
            (br $tr)))))
    (i32.const 1))

  ;; ----------------------------------------------------------------------
  ;; H459 -- the fallback resume trampoline. Empty on purpose.
  ;;
  ;; Every $th_* ends in `return_call $next`, so a fallback handler cannot
  ;; simply return to the executor. It tail-calls into $next, which tail-calls
  ;; into THIS -- and because the whole chain is tail calls, this function's
  ;; plain return unwinds straight back to $th_block_exec's frame with $ip
  ;; pointing one word past this op.
  ;; ----------------------------------------------------------------------
  (func $th_bx_resume (param $op i32))


  ;; ----------------------------------------------------------------------
  ;; H458 (and H454, which is an alias of it) -- THE executor.
  ;;
  ;; This function used to be two: $th_tree_fold in 07b-loop-match.wat ran a
  ;; region descriptor over the $TU_* micro-op vocabulary, and $th_block_exec
  ;; here ran a per-block descriptor over a second, DENSE re-encoding of a
  ;; subset of the same vocabulary. Two interpreters over one classifier is a
  ;; place for the two to disagree about what a micro-op means, so they are one
  ;; interpreter now, over one descriptor format:
  ;;
  ;;   a BLOCK is a 1-block region with no back edge (term_kind 5, the
  ;;     terminator left in the thread stream after the descriptor),
  ;;   a SELF-LOOP FOLD is a 1-block region whose taken successor is itself,
  ;;   a REGION is N <= $REGION_MAX_BLOCKS blocks with interior edges.
  ;;
  ;; Everything the two halves could do separately, this does together: the
  ;; per-exit live-out mask and the folded Jcc terminator from H454, and the
  ;; FALLBACK micro-op (run the real handler, spill and reload) plus the stack
  ;; forms from H458. The kind space is $TU_* directly -- there is no second
  ;; numbering to remap through any more.
  ;;
  ;; Eight guest registers in locals for the whole run; memory, flags and the
  ;; branch decision through the ordinary helpers.
  ;; ----------------------------------------------------------------------
  (func $th_block_exec (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $tp i32) (local $up i32) (local $ub i32)
    (local $steps_in i32) (local $fb_used i32) (local $n_fb i32)
    (local $tail_ip i32) (local $fb_bytes i32) (local $fbp i32)
    (local $tail_exit i32)
    (local $nuops i32) (local $live_out i32)
    (local $term_kind i32) (local $term_a i32) (local $term_b i32)
    (local $term_cc i32) (local $term_uop i32) (local $term_imm i32)
    (local $cost i32) (local $term_pos i32)
    (local $r0 i32) (local $r1 i32) (local $r2 i32) (local $r3 i32)
    (local $r4 i32) (local $r5 i32) (local $r6 i32) (local $r7 i32)
    ;; The seven TEMP LANES of the round-11 load/op split (section 16). Lane
    ;; index 8..14; 15 stays "absent". They are not architectural: never
    ;; spilled to a global, never in a live-out mask, never a SIB base or
    ;; index, never read by a terminator. A fallback cannot see them, which is
    ;; why they survive one for free -- but the alias rule kills every fact
    ;; across a fallback anyway, so nothing depends on that.
    (local $r8 i32) (local $r9 i32) (local $r10 i32) (local $r11 i32)
    (local $r12 i32) (local $r13 i32) (local $r14 i32)
    (local $i i32) (local $kind i32) (local $d i32) (local $a i32) (local $imm i32)
    (local $b i32) (local $ea i32) (local $ea_hold i32)
    (local $sh_d i32) (local $sh_a i32) (local $mask i32) (local $ssh i32)
    (local $nof i32) (local $beff i32)
    (local $va i32) (local $vb i32) (local $vr i32)
    (local $old i32) (local $wrote i32)
    (local $nblocks i32) (local $nexits i32) (local $uops_total i32)
    (local $BR i32) (local $EX i32) (local $UO i32) (local $brp i32)
    (local $cur i32) (local $loaded i32) (local $next_b i32)
    (local $succ_t i32) (local $succ_f i32) (local $exit_eip i32) (local $side i32)
    (local $nblk i32) (local $nsteps i32) (local $nuops_run i32) (local $nb_clamped i32)
    (local $steps_avail i32) (local $budget_avail i32)

    (local.set $tp (global.get $ip))
    (local.set $nblocks    (i32.load          (local.get $tp)))
    (local.set $nexits     (i32.load offset=4 (local.get $tp)))
    (local.set $uops_total (i32.load offset=8 (local.get $tp)))
    (local.set $BR (i32.add (local.get $tp) (i32.const 16)))
    (local.set $EX
      (i32.add (local.get $BR)
        (i32.mul (local.get $nblocks)
          (i32.shl (global.get $REGION_BLOCK_WORDS) (i32.const 2)))))
    (local.set $UO
      (i32.add (local.get $EX) (i32.shl (local.get $nexits) (i32.const 3))))
    ;; Header word +12 is `fb_bytes`: the size of the trailing FALLBACK POOL,
    ;; the one variable-length part of the descriptor. A fallback micro-op has
    ;; to hand the real handler its own inline operand words followed by the
    ;; H459 resume op, and those cannot live in the micro-op array without
    ;; breaking its fixed 24-byte stride (which every hand-written descriptor in
    ;; the tests and the bench depends on). So they are relocated here and the
    ;; micro-op's `b` word carries a byte offset into this pool. A descriptor
    ;; with no fallbacks -- every one the loop matcher emits -- writes 0 and the
    ;; pool is empty, which is why the older format is still readable verbatim.
    (local.set $fbp
      (i32.add (local.get $UO)
        (i32.mul (local.get $uops_total)
          (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2)))))
    (local.set $fb_bytes (i32.load offset=12 (local.get $tp)))
    (local.set $tail_ip (i32.add (local.get $fbp) (local.get $fb_bytes)))
    (global.set $ip (local.get $tail_ip))

    ;; Entry materialization: the whole architectural register file, once.
    ;; Reading all eight unconditionally is cheaper than a live-in mask and
    ;; cannot be wrong about a register the descriptor forgot to name.
    (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
    (local.set $r1 (i32.load offset=4 (global.get $reg_base)))
    (local.set $r2 (i32.load offset=8 (global.get $reg_base)))
    (local.set $r3 (i32.load offset=12 (global.get $reg_base)))
    (local.set $r4 (i32.load offset=16 (global.get $reg_base)))
    (local.set $r5 (i32.load offset=20 (global.get $reg_base)))
    (local.set $r6 (i32.load offset=24 (global.get $reg_base)))
    (local.set $r7 (i32.load offset=28 (global.get $reg_base)))

    ;; Both meters, exactly as the unfolded graph would have spent them: one
    ;; $steps per guest op ($cost of them per block execution) and one
    ;; $block_budget per block entry. They are checked at a block edge rather
    ;; than bounded up front, because with more than one block in the region
    ;; the per-execution cost is not a constant to divide by. The first block
    ;; always runs -- a do-while runs its body once even with the budget
    ;; already spent, exactly as the block would have when $run entered it.
    (local.set $steps_in (global.get $steps))
    (local.set $steps_avail
      (select (global.get $steps) (i32.const 0)
              (i32.gt_s (global.get $steps) (i32.const 0))))
    ;; A FALLBACK micro-op runs a real handler, and a real handler ends in
    ;; `return_call $next`, which spends a step and will take the out-of-steps
    ;; path if the counter has run down. So the counter is parked high for the
    ;; duration and settled once at exit; what the fallbacks actually spent is
    ;; then `parked - $steps`, measured rather than predicted, so an unfamiliar
    ;; self-charging handler cannot silently change pacing. A descriptor with no
    ;; fallbacks never touches it and the difference is zero.
    (global.set $steps (i32.const 0x100000))
    (local.set $budget_avail
      (select (global.get $block_budget) (i32.const 0)
              (i32.gt_s (global.get $block_budget) (i32.const 0))))

    (global.set $tree_fold_runs
      (i32.add (global.get $tree_fold_runs) (i32.const 1)))

    (local.set $loaded (i32.const -1))
    (block $done
      (loop $trip
        ;; The block record, reloaded only when the block index actually
        ;; changed. A self-loop -- the shape the shipped fold emits -- changes
        ;; it never, so its inner loop pays one compare per iteration and none
        ;; of these thirteen loads.
        (if (i32.ne (local.get $cur) (local.get $loaded))
          (then
            (local.set $brp
              (i32.add (local.get $BR)
                (i32.mul (local.get $cur)
                  (i32.shl (global.get $REGION_BLOCK_WORDS) (i32.const 2)))))
            (local.set $ub
              (i32.add (local.get $UO)
                (i32.mul (i32.load (local.get $brp))
                  (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2)))))
            (local.set $nuops     (i32.load offset=4  (local.get $brp)))
            (local.set $term_pos  (i32.load offset=8  (local.get $brp)))
            (local.set $term_kind (i32.load offset=12 (local.get $brp)))
            (local.set $term_a    (i32.load offset=16 (local.get $brp)))
            (local.set $term_b    (i32.load offset=20 (local.get $brp)))
            (local.set $term_uop  (i32.load offset=24 (local.get $brp)))
            (local.set $term_imm  (i32.load offset=28 (local.get $brp)))
            (local.set $term_cc   (i32.load offset=32 (local.get $brp)))
            (local.set $cost      (i32.load offset=36 (local.get $brp)))
            (local.set $succ_t    (i32.load offset=40 (local.get $brp)))
            (local.set $succ_f    (i32.load offset=44 (local.get $brp)))
            (local.set $loaded (local.get $cur))))
        (local.set $i (i32.const 0))
        (local.set $up (local.get $ub))
        (block $body_done
          (loop $body
            ;; -- terminator --------------------------------------------------
            ;; It runs at uop index $term_pos, which is usually $nuops (the
            ;; flag producer really was the last thing before the Jcc) but is
            ;; lower whenever the compiler put flag-transparent ops after it --
            ;; see the decode-time walk. Everything from here to $nuops is a
            ;; uop that executes AFTER the counter is updated, exactly as the
            ;; unfolded block ran it, so nothing is reordered across a flag.
            (if (i32.eq (local.get $i) (local.get $term_pos))
              (then
                (local.set $va
                  (block $gt (result i32)
                    (block $t7 (block $t6 (block $t5 (block $t4
                    (block $t3 (block $t2 (block $t1 (block $t0
                      (br_table $t0 $t1 $t2 $t3 $t4 $t5 $t6 $t7 (local.get $term_a)))
                      (br $gt (local.get $r0))) (br $gt (local.get $r1)))
                      (br $gt (local.get $r2))) (br $gt (local.get $r3)))
                      (br $gt (local.get $r4))) (br $gt (local.get $r5)))
                      (br $gt (local.get $r6)))
                    (local.get $r7)))
                (if (i32.eqz (local.get $term_kind))
                  (then
                    ;; dec/inc the counter and write it straight back.
                    (local.set $old (local.get $va))
                    (local.set $vr
                      (select (i32.add (local.get $old) (i32.const 1))
                              (i32.sub (local.get $old) (i32.const 1))
                              (local.get $term_uop)))
                    (if (local.get $term_uop)
                      (then (call $set_flags_inc (local.get $old) (local.get $vr)))
                      (else (call $set_flags_dec (local.get $old) (local.get $vr))))
                    (block $cdone
                    (block $c7 (block $c6 (block $c5 (block $c4
                    (block $c3 (block $c2 (block $c1 (block $c0
                      (br_table $c0 $c1 $c2 $c3 $c4 $c5 $c6 $c7 (local.get $term_a)))
                      (local.set $r0 (local.get $vr)) (br $cdone))
                      (local.set $r1 (local.get $vr)) (br $cdone))
                      (local.set $r2 (local.get $vr)) (br $cdone))
                      (local.set $r3 (local.get $vr)) (br $cdone))
                      (local.set $r4 (local.get $vr)) (br $cdone))
                      (local.set $r5 (local.get $vr)) (br $cdone))
                      (local.set $r6 (local.get $vr)) (br $cdone))
                    (local.set $r7 (local.get $vr))))
                  (else (if (i32.ge_u (local.get $term_kind) (i32.const 8))
                  (then
                    ;; term_kind 8 (`alu r,r`) and 9 (`alu r,imm32`). These are
                    ;; the round-10 producers, and the one thing that separates
                    ;; them from the cmp/test pair below is that they WRITE the
                    ;; destination register as well as the flags -- so the arm
                    ;; ends in the same 8-way writeback the inc/dec arm uses.
                    ;; `term_uop` is the x86 group sub-op; only 0 add, 1 or,
                    ;; 4 and, 5 sub, 6 xor are ever emitted ($bx_alu_term_bad
                    ;; declines adc/sbb, which read CF, and cmp, which has its
                    ;; own kinds).
                    (local.set $vb (local.get $term_b))
                    (if (i32.eq (local.get $term_kind) (i32.const 8))
                      (then (local.set $vb
                        (block $gw (result i32)
                          (block $w7 (block $w6 (block $w5 (block $w4
                          (block $w3 (block $w2 (block $w1 (block $w0
                            (br_table $w0 $w1 $w2 $w3 $w4 $w5 $w6 $w7 (local.get $term_b)))
                            (br $gw (local.get $r0))) (br $gw (local.get $r1)))
                            (br $gw (local.get $r2))) (br $gw (local.get $r3)))
                            (br $gw (local.get $r4))) (br $gw (local.get $r5)))
                            (br $gw (local.get $r6)))
                          (local.get $r7)))))
                    (local.set $vr
                      (block $ar (result i32)
                        (if (i32.eqz (local.get $term_uop))
                          (then (br $ar (i32.add (local.get $va) (local.get $vb)))))
                        (if (i32.eq (local.get $term_uop) (i32.const 1))
                          (then (br $ar (i32.or (local.get $va) (local.get $vb)))))
                        (if (i32.eq (local.get $term_uop) (i32.const 4))
                          (then (br $ar (i32.and (local.get $va) (local.get $vb)))))
                        (if (i32.eq (local.get $term_uop) (i32.const 5))
                          (then (br $ar (i32.sub (local.get $va) (local.get $vb)))))
                        (i32.xor (local.get $va) (local.get $vb))))
                    (if (i32.eqz (local.get $term_uop))
                      (then (call $set_flags_add (local.get $va) (local.get $vb) (local.get $vr)))
                      (else (if (i32.eq (local.get $term_uop) (i32.const 5))
                        (then (call $set_flags_sub (local.get $va) (local.get $vb) (local.get $vr)))
                        (else (call $set_flags_logic (local.get $vr))))))
                    (block $tdone
                    (block $v7 (block $v6 (block $v5 (block $v4
                    (block $v3 (block $v2 (block $v1 (block $v0
                      (br_table $v0 $v1 $v2 $v3 $v4 $v5 $v6 $v7 (local.get $term_a)))
                      (local.set $r0 (local.get $vr)) (br $tdone))
                      (local.set $r1 (local.get $vr)) (br $tdone))
                      (local.set $r2 (local.get $vr)) (br $tdone))
                      (local.set $r3 (local.get $vr)) (br $tdone))
                      (local.set $r4 (local.get $vr)) (br $tdone))
                      (local.set $r5 (local.get $vr)) (br $tdone))
                      (local.set $r6 (local.get $vr)) (br $tdone))
                    (local.set $r7 (local.get $vr))))
                  (else
                    ;; cmp: no register write, all five flag fields.
                    ;; kind 2 compares against the immediate in `term_b`;
                    ;; kinds 1 and 3 both read a register named by it, and
                    ;; kind 3 then dereferences [that register + term_imm].
                    ;; kinds 6 and 7 are `test`, the census's top decline: it
                    ;; is the flag producer for every `test eax,eax / jz` and
                    ;; for the bit-mask tests a state machine branches on, and
                    ;; declining it cost about six points of coverage. It reads
                    ;; its operands exactly like the cmp pair beside it and
                    ;; differs only in the helper it ends in.
                    (local.set $vb (local.get $term_b))
                    (if (i32.or
                          (i32.eq (local.get $term_kind) (i32.const 6))
                          (i32.or (i32.eq (local.get $term_kind) (i32.const 1))
                                  (i32.eq (local.get $term_kind) (i32.const 3))))
                      (then (local.set $vb
                        (block $gu (result i32)
                          (block $u7 (block $u6 (block $u5 (block $u4
                          (block $u3 (block $u2 (block $u1 (block $u0
                            (br_table $u0 $u1 $u2 $u3 $u4 $u5 $u6 $u7 (local.get $term_b)))
                            (br $gu (local.get $r0))) (br $gu (local.get $r1)))
                            (br $gu (local.get $r2))) (br $gu (local.get $r3)))
                            (br $gu (local.get $r4))) (br $gu (local.get $r5)))
                            (br $gu (local.get $r6)))
                          (local.get $r7)))))
                    ;; Re-read every iteration. The bound is in memory and the
                    ;; body may be what moves it; hoisting it would turn a
                    ;; loop that ends into one that does not.
                    (if (i32.eq (local.get $term_kind) (i32.const 3))
                      (then (local.set $vb
                        (call $gl32
                          (i32.add (local.get $vb) (local.get $term_imm))))))
                    (if (i32.ge_u (local.get $term_kind) (i32.const 6))
                      (then
                        (call $set_flags_logic
                          (i32.and (local.get $va) (local.get $vb))))
                      (else
                        (call $set_flags_sub (local.get $va) (local.get $vb)
                          (i32.sub (local.get $va) (local.get $vb)))))))))))
            (br_if $body_done (i32.ge_u (local.get $i) (local.get $nuops)))
            (local.set $kind (i32.load           (local.get $up)))
            (local.set $d    (i32.load offset=4  (local.get $up)))
            (local.set $a    (i32.load offset=8  (local.get $up)))
            (local.set $imm  (i32.load offset=12 (local.get $up)))
            (local.set $b    (i32.load offset=20 (local.get $up)))
            ;; Op totals have to stay comparable with a --tree-fold-off build,
            ;; or a handler histogram silently stops counting the work this
            ;; fold does. Re-record the original handler index, as H428 does.
            ;; fn == -1 is the LOAD half of a round-11 split: one x86
            ;; instruction became two micro-ops, and recording both would
            ;; report more guest ops than the threaded arm retired for the
            ;; same code. The other half carries the original handler index,
            ;; so the instruction is still counted exactly once.
            (if (i32.and (global.get $handler_hist_enabled)
                         (i32.ne (i32.load offset=16 (local.get $up)) (i32.const -1)))
              (then (call $handler_hist_record (i32.load offset=16 (local.get $up)))))
            (local.set $up (i32.add (local.get $up) (i32.const 24)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))

            ;; R[d] and R[a], by index. A br_table each, but over LOCALS --
            ;; no memory traffic and no call, which is the whole point.
            ;;
            ;; Fifteen arms since round 11: 0..7 are the architectural
            ;; registers and 8..14 the split's temp lanes. Index 15 (absent)
            ;; still lands on the DEFAULT arm, and every site that can see a
            ;; 15 guards it, so which lane the default names is immaterial --
            ;; it is r14 here only because a br_table needs some default.
            (local.set $va
              (block $gd (result i32)
                (block $g14 (block $g13 (block $g12 (block $g11 (block $g10
                (block $g9 (block $g8
                (block $g7 (block $g6 (block $g5 (block $g4
                (block $g3 (block $g2 (block $g1 (block $g0
                  (br_table $g0 $g1 $g2 $g3 $g4 $g5 $g6 $g7
                            $g8 $g9 $g10 $g11 $g12 $g13 $g14
                            $g14 (local.get $d)))
                  (br $gd (local.get $r0))) (br $gd (local.get $r1)))
                  (br $gd (local.get $r2))) (br $gd (local.get $r3)))
                  (br $gd (local.get $r4))) (br $gd (local.get $r5)))
                  (br $gd (local.get $r6))) (br $gd (local.get $r7)))
                  (br $gd (local.get $r8))) (br $gd (local.get $r9)))
                  (br $gd (local.get $r10))) (br $gd (local.get $r11)))
                  (br $gd (local.get $r12))) (br $gd (local.get $r13)))
                (local.get $r14)))
            ;; TU_B_SRC0: the register-move elimination's redirect. The move
            ;; that used to put this value in R[d] is gone, so the first
            ;; source comes out of the lane named at b[27:24] instead. Read as
            ;; a second br_table rather than by patching `d`, because `d` is
            ;; still where the RESULT goes.
            (if (i32.and (local.get $b) (global.get $TU_B_SRC0))
              (then (local.set $va
                (block $sd (result i32)
                  (block $q14 (block $q13 (block $q12 (block $q11 (block $q10
                  (block $q9 (block $q8
                  (block $q7 (block $q6 (block $q5 (block $q4
                  (block $q3 (block $q2 (block $q1 (block $q0
                    (br_table $q0 $q1 $q2 $q3 $q4 $q5 $q6 $q7
                              $q8 $q9 $q10 $q11 $q12 $q13 $q14
                              $q14
                              (i32.and (i32.shr_u (local.get $b)
                                         (global.get $TU_B_SRC0_SHIFT))
                                       (i32.const 0xF))))
                    (br $sd (local.get $r0))) (br $sd (local.get $r1)))
                    (br $sd (local.get $r2))) (br $sd (local.get $r3)))
                    (br $sd (local.get $r4))) (br $sd (local.get $r5)))
                    (br $sd (local.get $r6))) (br $sd (local.get $r7)))
                    (br $sd (local.get $r8))) (br $sd (local.get $r9)))
                    (br $sd (local.get $r10))) (br $sd (local.get $r11)))
                    (br $sd (local.get $r12))) (br $sd (local.get $r13)))
                  (local.get $r14)))))
            (local.set $vb
              (block $ga (result i32)
                (block $a14 (block $a13 (block $a12 (block $a11 (block $a10
                (block $a9 (block $a8
                (block $a7 (block $a6 (block $a5 (block $a4
                (block $a3 (block $a2 (block $a1 (block $a0
                  (br_table $a0 $a1 $a2 $a3 $a4 $a5 $a6 $a7
                            $a8 $a9 $a10 $a11 $a12 $a13 $a14
                            $a14 (local.get $a)))
                  (br $ga (local.get $r0))) (br $ga (local.get $r1)))
                  (br $ga (local.get $r2))) (br $ga (local.get $r3)))
                  (br $ga (local.get $r4))) (br $ga (local.get $r5)))
                  (br $ga (local.get $r6))) (br $ga (local.get $r7)))
                  (br $ga (local.get $r8))) (br $ga (local.get $r9)))
                  (br $ga (local.get $r10))) (br $ga (local.get $r11)))
                  (br $ga (local.get $r12))) (br $ga (local.get $r13)))
                (local.get $r14)))

            ;; Sub-register lane and width, decoded unconditionally because it
            ;; is four arithmetic ops with no branch and every alternative
            ;; (a guard, a second br_table) costs more than it saves. The lane
            ;; bits are placed so that one shift extracts each: bit 6 -> 8 and
            ;; bit 7 -> 8, i.e. a byte op on AH..BH reads and writes bits 8..15
            ;; of its container and a low-byte or word op reads bits 0..15.
            (local.set $sh_d (i32.and (i32.shr_u (local.get $b) (i32.const 3)) (i32.const 8)))
            (local.set $sh_a (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 8)))
            (local.set $mask
              (select (i32.const 0xFFFF) (i32.const 0xFF)
                      (i32.and (local.get $b) (global.get $TU_B_WORD))))
            (local.set $ssh
              (select (i32.const 15) (i32.const 7)
                      (i32.and (local.get $b) (global.get $TU_B_WORD))))
            ;; "Nobody reads the flags this op would write." Decoded here, next
            ;; to the other `b` fields, so the arms below are a single test on
            ;; a local rather than a mask-and-shift each.
            (local.set $nof (i32.and (local.get $b) (global.get $TU_B_NOFLAGS)))

            ;; The H149 pair's join. A consumer marked TU_B_EA had
            ;; $SIB_SENTINEL where its address should be, so its address is the
            ;; one the preceding TU_EA_SIB left in $ea_hold -- which is exactly
            ;; what $read_addr does with $ea_temp, one indirection shorter.
            ;; Branchless, and folded into the same `b` decode as the lane bits
            ;; above so no kind that cannot carry the bit pays a test for it.
            (local.set $imm
              (select (local.get $ea_hold) (local.get $imm)
                      (i32.and (local.get $b) (global.get $TU_B_EA))))

            ;; SIB effective address, for the contiguous tail of kinds that
            ;; need one. Hoisted here rather than repeated in three arms, and
            ;; guarded by a range test so no other kind pays for it.
            ;;
            ;; $vb already holds R[a] from the read above, so the base term is
            ;; free -- but only when a base is present: `a == 0xF` means the
            ;; SIB had none, and $vb then holds r7 (the br_table's default
            ;; arm), which is why the base is added under a test rather than
            ;; unconditionally. The index needs its own read because it is a
            ;; different register from both $d and $a.
            (if (i32.ge_u (local.get $kind) (global.get $TU_FIRST_SIB))
              (then
                (local.set $ea (local.get $imm))
                (if (i32.ne (local.get $a) (i32.const 0xF))
                  (then (local.set $ea (i32.add (local.get $ea) (local.get $vb)))))
                (if (i32.ne (i32.and (local.get $b) (i32.const 0xF)) (i32.const 0xF))
                  (then (local.set $ea
                    (i32.add (local.get $ea)
                      (i32.shl
                        (block $gi (result i32)
                          (block $i7 (block $i6 (block $i5 (block $i4
                          (block $i3 (block $i2 (block $i1 (block $i0
                            (br_table $i0 $i1 $i2 $i3 $i4 $i5 $i6 $i7
                                      (i32.and (local.get $b) (i32.const 0xF))))
                            (br $gi (local.get $r0))) (br $gi (local.get $r1)))
                            (br $gi (local.get $r2))) (br $gi (local.get $r3)))
                            (br $gi (local.get $r4))) (br $gi (local.get $r5)))
                            (br $gi (local.get $r6)))
                          (local.get $r7))
                        ;; Scale is TWO bits at b[5:4]. The `& 3` is load-bearing
                        ;; on exactly one kind: TU_STORE8_SIB is the only one that
                        ;; carries SIB fields AND a lane bit, and TU_B_LANE_D is
                        ;; 0x40 -- bit 6, which an unmasked `b >> 4` folds into
                        ;; the shift amount as +4. A high-byte store through an
                        ;; indexed address then writes at index<<(scale+4).
                        ;; Found by test/test-block-exec.js, which reaches the
                        ;; combination H454 has apparently never met in a
                        ;; self-loop; H458 shares this decode verbatim.
                        (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 3)))))))))

            ;; Evaluate. Every arm publishes exactly the flag fields its
            ;; scalar handler publishes, by calling the same helper -- which
            ;; is what makes the per-field join right at every instant.
            ;;
            ;; $wrote, rather than a second exit label out of the br_table:
            ;; a store is the one kind whose result does not go to a register,
            ;; and branching around the writeback from inside the table put
            ;; the branch target outside the loop body the first time this was
            ;; written -- which silently truncated every iteration at its
            ;; first store instead of failing.
            (local.set $wrote (i32.const 1))
            (block $kdone
              (block $k60
              (block $k59 (block $k58
              (block $k57 (block $k56 (block $k55 (block $k54
              (block $k53 (block $k52 (block $k51 (block $k50
              (block $k49 (block $k48 (block $k47
              (block $k46 (block $k45 (block $k44 (block $k43
              (block $k42 (block $k41 (block $k40
              (block $k39 (block $k38 (block $k37 (block $k36 (block $k35
              (block $k34 (block $k33 (block $k32 (block $k31 (block $k30
              (block $k29 (block $k28 (block $k27 (block $k26 (block $k25
              (block $k24 (block $k23 (block $k22
              (block $k21 (block $k20 (block $k19 (block $k18
              (block $k17 (block $k16 (block $k15 (block $k14
              (block $k13 (block $k12 (block $k11 (block $k10
              (block $k09 (block $k08 (block $k07 (block $k06
              (block $k05 (block $k04 (block $k03 (block $k02
              (block $k01 (block $k00
                (br_table $k00 $k01 $k02 $k03 $k04 $k05 $k06 $k07 $k08 $k09
                          $k10 $k11 $k12 $k13 $k14 $k15 $k16 $k17 $k18 $k19
                          $k20 $k21 $k22 $k23 $k24 $k25 $k26 $k27 $k28 $k29
                          $k30 $k31 $k32 $k33 $k34 $k35 $k36 $k37 $k38 $k39
                          $k40 $k41 $k42 $k43 $k44 $k45 $k46 $k47 $k48 $k49
                          $k50 $k51 $k52 $k53 $k54 $k55 $k56 $k57
                          $k58 $k59 $k60
                          $k60
                          (local.get $kind)))
                ;; 0 MOV_RR
                (local.set $vr (local.get $vb)) (br $kdone))
                ;; 1 MOV_RI
                (local.set $vr (local.get $imm)) (br $kdone))
                ;; 2 LEA_RO -- LEA never touches flags
                (local.set $vr (i32.add (local.get $vb) (local.get $imm))) (br $kdone))
                ;; 3 ADD_RR. From here to 19, the arithmetic is unconditional
                ;; and only the $set_flags_* call is gated on $nof -- the bit
                ;; the decode-time dead-flag pass set when it proved nothing
                ;; between here and the terminator reads what this would write.
                (local.set $vr (i32.add (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_add (local.get $va) (local.get $vb) (local.get $vr))))
                (br $kdone))
                ;; 4 ADD_RI
                (local.set $vr (i32.add (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_add (local.get $va) (local.get $imm) (local.get $vr))))
                (br $kdone))
                ;; 5 SUB_RR
                (local.set $vr (i32.sub (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (local.get $va) (local.get $vb) (local.get $vr))))
                (br $kdone))
                ;; 6 SUB_RI
                (local.set $vr (i32.sub (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (local.get $va) (local.get $imm) (local.get $vr))))
                (br $kdone))
                ;; 7 AND_RR
                (local.set $vr (i32.and (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 8 AND_RI
                (local.set $vr (i32.and (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 9 OR_RR
                (local.set $vr (i32.or (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 10 OR_RI
                (local.set $vr (i32.or (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 11 XOR_RR
                (local.set $vr (i32.xor (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 12 XOR_RI
                (local.set $vr (i32.xor (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 13 INC -- preserves CF, which $set_flags_inc reads back out
                ;; of whatever really wrote it last. Skipping it when the flags
                ;; are dead also skips that $get_cf, which is the single most
                ;; expensive thing the elision removes.
                (local.set $vr (i32.add (local.get $va) (i32.const 1)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_inc (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 14 DEC
                (local.set $vr (i32.sub (local.get $va) (i32.const 1)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_dec (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 15 NEG == SUB 0, src
                (local.set $vr (i32.sub (i32.const 0) (local.get $va)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (i32.const 0) (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 16 NOT -- no flags, exactly as x86
                (local.set $vr (i32.xor (local.get $va) (i32.const -1))) (br $kdone))
                ;; 17 SHIFT -- $do_shift32 owns the flag contract, including
                ;; the count==0 case that writes nothing at all.
                (local.set $vr
                  (call $do_shift32 (local.get $a) (local.get $va) (local.get $imm)))
                (br $kdone))
                ;; 18 IMUL_RR. The 64-bit product exists only to decide CF/OF,
                ;; so a dead-flag IMUL drops the widening multiply as well as
                ;; the three global stores.
                (local.set $vr (i32.mul (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then
                    (global.set $flag_op (i32.const 6))
                    (global.set $flag_sign_shift (i32.const 31))
                    (global.set $flag_b
                      (i64.ne
                        (i64.mul (i64.extend_i32_s (local.get $va))
                                 (i64.extend_i32_s (local.get $vb)))
                        (i64.extend_i32_s (local.get $vr))))
                    (global.set $flag_res (local.get $vr))))
                (br $kdone))
                ;; 19 IMUL_RI
                (local.set $vr (i32.mul (local.get $vb) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then
                    (global.set $flag_op (i32.const 6))
                    (global.set $flag_sign_shift (i32.const 31))
                    (global.set $flag_b
                      (i64.ne
                        (i64.mul (i64.extend_i32_s (local.get $vb))
                                 (i64.extend_i32_s (local.get $imm)))
                        (i64.extend_i32_s (local.get $vr))))
                    (global.set $flag_res (local.get $vr))))
                (br $kdone))
                ;; 20 LOAD32
                (local.set $vr
                  (call $gl32 (i32.add (local.get $vb) (local.get $imm))))
                (br $kdone))
                ;; 21 STORE32. Writes memory, not a register, so it skips the
                ;; writeback entirely -- and it goes through $gs32, which is
                ;; what keeps SMC invalidation and page crossing identical to
                ;; the scalar path.
                (call $gs32 (i32.add (local.get $vb) (local.get $imm)) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 22 LOAD32_ABS -- the address is a decode-time constant.
                (local.set $vr (call $gl32 (local.get $imm))) (br $kdone))
                ;; 23 STORE32_ABS
                (call $gs32 (local.get $imm) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))

                ;; -- sub-register writes. Each of these computes a value at
                ;; the sub-width and then INSERTS it into the container's
                ;; local, leaving the lanes it does not cover exactly as they
                ;; were -- which is what makes a partial write expressible here
                ;; at all, and why $vr is always a full 32-bit value even when
                ;; the op wrote eight bits of it.

                ;; 24 MOV_SUB_RR -- no flags, either width.
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $sh_d))))
                (br $kdone))
                ;; 25 MOV_SUB_RI -- no flags.
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (i32.and (local.get $imm) (local.get $mask)) (local.get $sh_d))))
                (br $kdone))
                ;; 26 ALU_SUB_RR. $do_alu_sized owns the flag contract at this
                ;; width, including flag_sign_shift; CMP (7) writes no register.
                ;; With the flags dead, $tree_alu_sized_noflags computes the
                ;; same six results with the flag half removed -- and a dead
                ;; CMP becomes nothing at all, since it writes no register
                ;; either.
                (local.set $vb
                  (if (result i32) (local.get $nof)
                    (then (call $tree_alu_sized_noflags
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $mask)))
                    (else (call $do_alu_sized
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $mask) (local.get $ssh)))))
                (if (i32.eq (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT))
                                     (i32.const 0xF))
                            (i32.const 7))
                  (then (local.set $wrote (i32.const 0)))
                  (else (local.set $vr
                    (i32.or
                      (i32.and (local.get $va)
                        (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                      (i32.shl (local.get $vb) (local.get $sh_d))))))
                (br $kdone))
                ;; 27 ALU_SUB_RI
                (local.set $vb
                  (if (result i32) (local.get $nof)
                    (then (call $tree_alu_sized_noflags
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (local.get $imm) (local.get $mask))
                      (local.get $mask)))
                    (else (call $do_alu_sized
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (local.get $imm) (local.get $mask))
                      (local.get $mask) (local.get $ssh)))))
                (if (i32.eq (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT))
                                     (i32.const 0xF))
                            (i32.const 7))
                  (then (local.set $wrote (i32.const 0)))
                  (else (local.set $vr
                    (i32.or
                      (i32.and (local.get $va)
                        (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                      (i32.shl (local.get $vb) (local.get $sh_d))))))
                (br $kdone))
                ;; 28 LOAD8_RO -- R8[d] = [R[a] + imm]
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (call $gl8 (i32.add (local.get $vb) (local.get $imm)))
                             (local.get $sh_d))))
                (br $kdone))
                ;; 29 STORE8_RO
                (call $gs8 (i32.add (local.get $vb) (local.get $imm))
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 30 LOAD8_ABS
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (call $gl8 (local.get $imm)) (local.get $sh_d))))
                (br $kdone))
                ;; 31 STORE8_ABS
                (call $gs8 (local.get $imm)
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 32 MOVZX8_RO -- narrow read, WHOLE destination written.
                (local.set $vr (call $gl8 (i32.add (local.get $vb) (local.get $imm))))
                (br $kdone))
                ;; 33 MOVSX8_RO
                (local.set $vr
                  (call $sign_ext8 (call $gl8 (i32.add (local.get $vb) (local.get $imm)))))
                (br $kdone))
                ;; 34 LEA_SIB -- address arithmetic only, no memory and, as on
                ;; x86, no flags.
                (local.set $vr (local.get $ea)) (br $kdone))
                ;; 35 LOAD32_SIB
                (local.set $vr (call $gl32 (local.get $ea))) (br $kdone))
                ;; 36 STORE32_SIB
                (call $gs32 (local.get $ea) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 37 MOVSX8_SIB
                (local.set $vr (call $sign_ext8 (call $gl8 (local.get $ea)))) (br $kdone))
                ;; 38 STORE8_SIB
                (call $gs8 (local.get $ea)
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 39 MOV_M8_I_SIB. The immediate rides in `b` because this
                ;; handler's operand word IS the byte.
                (call $gs8 (local.get $ea)
                  (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_IMM8_SHIFT))
                           (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 40 LOAD16_ABS -- the low half only; the top half of the
                ;; container survives, exactly as $th_mov_r16_m16 leaves it.
                (local.set $vr
                  (i32.or (i32.and (local.get $va) (i32.const 0xFFFF0000))
                          (call $gl16 (local.get $imm))))
                (br $kdone))
                ;; 41 LOAD16_RO
                (local.set $vr
                  (i32.or (i32.and (local.get $va) (i32.const 0xFFFF0000))
                          (call $gl16 (i32.add (local.get $vb) (local.get $imm)))))
                (br $kdone))
                ;; 42 STORE16_RO
                (call $gs16 (i32.add (local.get $vb) (local.get $imm))
                  (i32.and (local.get $va) (i32.const 0xFFFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 43 ADC_RR -- $th_adc_r_r, transcribed. The CF fix-up is not
                ;; decoration: when `b + cf` wraps, the carry out is 1 no
                ;; matter what the sum says, and flag_op 8 is the raw mode that
                ;; states that without disturbing the ZF/SF the add just set.
                (local.set $beff (i32.add (local.get $vb) (call $get_cf)))
                (local.set $vr (i32.add (local.get $va) (local.get $beff)))
                (call $set_flags_add (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $vb))
                  (then (global.set $flag_op (i32.const 8))
                        (global.set $flag_a (i32.const 1))
                        (global.set $flag_b (i32.const 0))))
                (br $kdone))
                ;; 44 ADC_RI
                (local.set $beff (i32.add (local.get $imm) (call $get_cf)))
                (local.set $vr (i32.add (local.get $va) (local.get $beff)))
                (call $set_flags_add (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $imm))
                  (then (global.set $flag_op (i32.const 8))
                        (global.set $flag_a (i32.const 1))
                        (global.set $flag_b (i32.const 0))))
                (br $kdone))
                ;; 45 SBB_RR -- the borrow twin, which fixes flag_a/flag_b only.
                (local.set $beff (i32.add (local.get $vb) (call $get_cf)))
                (local.set $vr (i32.sub (local.get $va) (local.get $beff)))
                (call $set_flags_sub (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $vb))
                  (then (global.set $flag_a (i32.const 0))
                        (global.set $flag_b (i32.const 1))))
                (br $kdone))
              ;; 46 SBB_RI
              (local.set $beff (i32.add (local.get $imm) (call $get_cf)))
              (local.set $vr (i32.sub (local.get $va) (local.get $beff)))
              (call $set_flags_sub (local.get $va) (local.get $beff) (local.get $vr))
              (if (i32.lt_u (local.get $beff) (local.get $imm))
                (then (global.set $flag_a (i32.const 0))
                      (global.set $flag_b (i32.const 1))))
              (br $kdone))
              ;; 47 EA_SIB -- the address is already in $ea (the hoist above
              ;; computed it, since this kind is in the SIB range). Park it for
              ;; the next micro-op and write no register: this op is not an
              ;; instruction, it is half of one.
              (local.set $ea_hold (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 48 EA_SIB_LD8 (and the unreachable default) -- the same EA,
              ;; plus the byte load H149's operand bit 8 fused into it. The
              ;; insert is the ordinary sub-register one, so AH..BH land in
              ;; bits 8..15 of their container exactly as $set_reg8 puts them.
              (local.set $ea_hold (local.get $ea))
              (local.set $vr
                (i32.or
                  (i32.and (local.get $va)
                    (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                  (i32.shl (call $gl8 (local.get $ea)) (local.get $sh_d))))
              (br $kdone))
              ;; 49 REP_STR. Publish, call the
              ;; interpreter's own body, reload. The publish has to be all
              ;; eight and not just ESI/EDI/ECX/EAX: $gs8/$gl8 reach
              ;; $invalidate_code_write and the page compiler, and a fault
              ;; path reads the register file to build its report, so leaving
              ;; a stale global behind would be visible from inside the call.
              (i32.store offset=0 (global.get $reg_base) (local.get $r0))
              (i32.store offset=4 (global.get $reg_base) (local.get $r1))
              (i32.store offset=8 (global.get $reg_base) (local.get $r2))
              (i32.store offset=12 (global.get $reg_base) (local.get $r3))
              (i32.store offset=16 (global.get $reg_base) (local.get $r4))
              (i32.store offset=20 (global.get $reg_base) (local.get $r5))
              (i32.store offset=24 (global.get $reg_base) (local.get $r6))
              (i32.store offset=28 (global.get $reg_base) (local.get $r7))
              (block $rdone
                (block $r3b (block $r2b (block $r1b (block $r0b
                  (br_table $r0b $r1b $r2b $r3b $r3b (local.get $d)))
                  (call $rep_movsb_do) (br $rdone))
                  (call $rep_movsd_do) (br $rdone))
                  (call $rep_stosb_do) (br $rdone))
                (call $rep_stosd_do))
              (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
              (local.set $r1 (i32.load offset=4 (global.get $reg_base)))
              (local.set $r2 (i32.load offset=8 (global.get $reg_base)))
              (local.set $r3 (i32.load offset=12 (global.get $reg_base)))
              (local.set $r4 (i32.load offset=16 (global.get $reg_base)))
              (local.set $r5 (i32.load offset=20 (global.get $reg_base)))
              (local.set $r6 (i32.load offset=24 (global.get $reg_base)))
              (local.set $r7 (i32.load offset=28 (global.get $reg_base)))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 50 X87_MEM -- absolute (or H149-paired) address. The hoisted
              ;; $ea is already the address: `a` is 0xF so no base was added
              ;; and the SIB index nibble is 0xF so no index was, leaving the
              ;; immediate the TU_B_EA select above may have replaced with
              ;; $ea_hold. $fpu_exec_mem is the same function $th_fpu_mem
              ;; calls with the same two nibbles, so the load width, the
              ;; push/pop, the tag word and every sticky bit in $fpu_sw are
              ;; the interpreter's, not this family's.
              (call $fpu_exec_mem
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 51 X87_MRO -- base+disp. $ea is R[a] + imm, computed from the
              ;; register LOCAL; the scalar H190 pays a $get_reg for the same
              ;; number. Identical call otherwise.
              (call $fpu_exec_mem
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 52 X87_REG -- no memory and no general register at all. The
              ;; accepted set excludes FCMOVcc and FCOMI/FUCOMI, so nothing
              ;; here reads or writes a lazy-flag field and the dead-flag
              ;; pass's model stays complete.
              (call $fpu_exec_reg
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_RM_SHIFT))
                         (i32.const 0xF)))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 53 FNSTSW AX (and the unreachable default). The one x87 op
              ;; that writes a general register, so EAX round-trips through
              ;; the global the way TU_REP_STR round-trips all eight -- the
              ;; interpreter's arm reads $eax to preserve its top half and
              ;; writes the status word into the bottom, and reproducing that
              ;; here would be a second copy of it. Only EAX needs publishing:
              ;; DF E0 reads and writes nothing else.
              (i32.store offset=0 (global.get $reg_base) (local.get $r0))
              (call $fpu_exec_reg (i32.const 7) (i32.const 4) (i32.const 0))
              (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 54 PUSH_R. ESP is r4, a local, so the whole push is register
              ;; arithmetic plus one $gs32. `push esp` pushes the OLD esp, which
              ;; is already what $va holds.
              (local.set $r4 (i32.sub (local.get $r4) (i32.const 4)))
              (call $gs32 (local.get $r4) (local.get $va))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 55 POP_R. The writeback runs after the ESP adjustment, so
              ;; `pop esp` lands the loaded value and not the incremented one --
              ;; which is what the architecture says.
              (local.set $vr (call $gl32 (local.get $r4)))
              (local.set $r4 (i32.add (local.get $r4) (i32.const 4)))
              (br $kdone))

              ;; 56 PUSH_I
              (local.set $r4 (i32.sub (local.get $r4) (i32.const 4)))
              (call $gs32 (local.get $r4) (local.get $imm))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 57 FALLBACK -- run the op's real handler.
              ;;
              ;; Spill all eight first: $gs*/$gl* reach $invalidate_code_write
              ;; and the page compiler, a fault path reads the register file to
              ;; build its report, and every --trace-* formatter reads the
              ;; globals, so a stale one is observable from inside the call.
              ;; This spill is also the publish-before-trap guarantee -- a
              ;; handler that traps does so with the register file exactly as
              ;; the threaded path would have left it.
              ;;
              ;; `a` carries the handler index (a fallback has no R[a] operand,
              ;; so the field is free), `imm` the handler's own operand word,
              ;; and `b` the byte offset of this op's inline words in the
              ;; trailing fallback pool.
              (i32.store offset=0 (global.get $reg_base) (local.get $r0))
              (i32.store offset=4 (global.get $reg_base) (local.get $r1))
              (i32.store offset=8 (global.get $reg_base) (local.get $r2))
              (i32.store offset=12 (global.get $reg_base) (local.get $r3))
              (i32.store offset=16 (global.get $reg_base) (local.get $r4))
              (i32.store offset=20 (global.get $reg_base) (local.get $r5))
              (i32.store offset=24 (global.get $reg_base) (local.get $r6))
              (i32.store offset=28 (global.get $reg_base) (local.get $r7))
              ;; The H149 pair's OTHER half. A native TU_EA_SIB parks its
              ;; address in $ea_hold, a LOCAL -- but a consumer that fell back
              ;; reads it through $read_addr, which substitutes the $ea_temp
              ;; GLOBAL for a $SIB_SENTINEL address word. Both directions,
              ;; because a producer can fall back too and the next micro-op may
              ;; be a native consumer reading $ea_hold.
              (global.set $ea_temp (local.get $ea_hold))
              (global.set $ip (i32.add (local.get $fbp) (local.get $b)))
              (call_indirect (type $handler_t)
                (local.get $imm) (local.get $a))
              (local.set $ea_hold (global.get $ea_temp))
              (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
              (local.set $r1 (i32.load offset=4 (global.get $reg_base)))
              (local.set $r2 (i32.load offset=8 (global.get $reg_base)))
              (local.set $r3 (i32.load offset=12 (global.get $reg_base)))
              (local.set $r4 (i32.load offset=16 (global.get $reg_base)))
              (local.set $r5 (i32.load offset=20 (global.get $reg_base)))
              (local.set $r6 (i32.load offset=24 (global.get $reg_base)))
              (local.set $r7 (i32.load offset=28 (global.get $reg_base)))
              (local.set $n_fb (i32.add (local.get $n_fb) (i32.const 1)))
              (global.set $block_exec_last_fallback_fn (local.get $a))
              (local.set $wrote (i32.const 0))
              ;; Explicit, since round 11: this arm is no longer the last one
              ;; in the chain, and falling out of its block now lands in the
              ;; CMP arm below rather than at the writeback.
              (br $kdone))

              ;; 58 CMP_RR -- flags of R[d] - R[a], no register written. The
              ;; same $set_flags_sub $th_cmp_r_r calls, on the same two values.
              (if (i32.eqz (local.get $nof))
                (then (call $set_flags_sub (local.get $va) (local.get $vb)
                        (i32.sub (local.get $va) (local.get $vb)))))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 59 CMP_RI
              (if (i32.eqz (local.get $nof))
                (then (call $set_flags_sub (local.get $va) (local.get $imm)
                        (i32.sub (local.get $va) (local.get $imm)))))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 60 X87RUN (and the unreachable default) -- a FUSED x87 run,
              ;; H449..H453, called as the body it is instead of routed through
              ;; the trampoline. Section 24.
              ;;
              ;; PUBLISH: only the registers `d` names. Every address a fused
              ;; body forms goes through $x87_pipeline_addr or, in the island,
              ;; through one $get_reg, and the install-time walk collected
              ;; exactly those. Nothing else in these five bodies reads the
              ;; register file: $fpu_exec_mem/$fpu_exec_reg do not, $gs32's
              ;; $invalidate_code_write does not, and the only other consumer
              ;; of a stale global -- a crash report out of $fpu_crash_op --
              ;; is unreachable here, because $x87_island_op_ok declined every
              ;; form that could reach it and the other four families never
              ;; call those two functions at all.
              ;;
              ;; RELOAD: none. No fused x87 body writes a general register.
              ;; FNSTSW AX is the one x87 instruction that does, and it cannot
              ;; be inside one of these runs: four of the five families are
              ;; shape-matched to FLD/arith/FSTP, and in the fifth
              ;; $tree_x87_reg_ok declines group 7 outright.
              ;;
              ;; $ip: set to this run's pool copy, exactly as the TU_FALLBACK
              ;; arm does. The body walks its inline words through that global
              ;; and leaves it past them; nothing downstream of here reads it
              ;; before the exit path rewrites it.
              (if (i32.and (local.get $d) (i32.const 0x01)) (then (i32.store offset=0 (global.get $reg_base) (local.get $r0))))
              (if (i32.and (local.get $d) (i32.const 0x02)) (then (i32.store offset=4 (global.get $reg_base) (local.get $r1))))
              (if (i32.and (local.get $d) (i32.const 0x04)) (then (i32.store offset=8 (global.get $reg_base) (local.get $r2))))
              (if (i32.and (local.get $d) (i32.const 0x08)) (then (i32.store offset=12 (global.get $reg_base) (local.get $r3))))
              (if (i32.and (local.get $d) (i32.const 0x10)) (then (i32.store offset=16 (global.get $reg_base) (local.get $r4))))
              (if (i32.and (local.get $d) (i32.const 0x20)) (then (i32.store offset=20 (global.get $reg_base) (local.get $r5))))
              (if (i32.and (local.get $d) (i32.const 0x40)) (then (i32.store offset=24 (global.get $reg_base) (local.get $r6))))
              (if (i32.and (local.get $d) (i32.const 0x80)) (then (i32.store offset=28 (global.get $reg_base) (local.get $r7))))
              ;; The H149 pair, one direction only: an island's FIRST op may be
              ;; an H188 whose address word is $SIB_SENTINEL, and $th_x87_island
              ;; reads $ea_temp for it. Nothing in these bodies WRITES $ea_temp,
              ;; so there is no reload to match.
              (global.set $ea_temp (local.get $ea_hold))
              (global.set $ip (i32.add (local.get $fbp) (local.get $b)))
              (call $x87_run_body (local.get $a) (local.get $imm))
              (global.set $block_exec_last_fallback_fn (local.get $a))
              (local.set $wrote (i32.const 0)))

            ;; Writeback R[d], fifteen arms as above.
            (if (local.get $wrote)
              (then
                (block $sdone
                (block $s14 (block $s13 (block $s12 (block $s11 (block $s10
                (block $s9 (block $s8
                (block $s7 (block $s6 (block $s5 (block $s4
                (block $s3 (block $s2 (block $s1 (block $s0
                  (br_table $s0 $s1 $s2 $s3 $s4 $s5 $s6 $s7
                            $s8 $s9 $s10 $s11 $s12 $s13 $s14
                            $s14 (local.get $d)))
                  (local.set $r0 (local.get $vr)) (br $sdone))
                  (local.set $r1 (local.get $vr)) (br $sdone))
                  (local.set $r2 (local.get $vr)) (br $sdone))
                  (local.set $r3 (local.get $vr)) (br $sdone))
                  (local.set $r4 (local.get $vr)) (br $sdone))
                  (local.set $r5 (local.get $vr)) (br $sdone))
                  (local.set $r6 (local.get $vr)) (br $sdone))
                  (local.set $r7 (local.get $vr)) (br $sdone))
                  (local.set $r8 (local.get $vr)) (br $sdone))
                  (local.set $r9 (local.get $vr)) (br $sdone))
                  (local.set $r10 (local.get $vr)) (br $sdone))
                  (local.set $r11 (local.get $vr)) (br $sdone))
                  (local.set $r12 (local.get $vr)) (br $sdone))
                  (local.set $r13 (local.get $vr)) (br $sdone))
                (local.set $r14 (local.get $vr)))))
            (br $body)))

        (local.set $nblk (i32.add (local.get $nblk) (i32.const 1)))
        (local.set $nsteps (i32.add (local.get $nsteps) (local.get $cost)))
        (local.set $nuops_run (i32.add (local.get $nuops_run) (local.get $nuops)))
        ;; term_kind 5 -- THE THREADED TAIL. The block's own terminator was left
        ;; in the thread stream immediately after the descriptor instead of
        ;; being folded, so there is no condition to evaluate and no successor
        ;; to pick: publish everything and walk into it. This is the shape every
        ;; install from $block_exec_try_install has today, and it is what makes
        ;; a plain basic block expressible as a one-block region.
        (if (i32.eq (local.get $term_kind) (i32.const 5))
          (then
            (local.set $tail_exit (i32.const 1))
            (local.set $live_out (i32.const 0xFF))
            (br $done)))
        ;; term_kind 10 (round 18, section 28) -- THE UNMODELLED TERMINATOR.
        ;; The same exit as term_kind 5 with one word of indirection: this
        ;; MEMBER's terminator was copied into the descriptor's fallback pool
        ;; at byte offset `term_imm`, so the tail is per member rather than the
        ;; header's one $tail_ip. Publish all eight, restore $eip to this
        ;; block's entry -- which is where the threaded arm's previous
        ;; terminator left it, and which a folded interior edge did not write
        ;; -- and walk into the copy. Nothing about the terminator itself is
        ;; interpreted here; $next dispatches it and it transfers as it always
        ;; does.
        (if (i32.eq (local.get $term_kind) (i32.const 10))
          (then
            (local.set $tail_exit (i32.const 1))
            (local.set $live_out (i32.const 0xFF))
            (local.set $tail_ip
              (i32.add (local.get $fbp) (local.get $term_imm)))
            (global.set $eip (i32.load offset=48 (local.get $brp)))
            (global.set $block_exec_tail_exit_runs
              (i32.add (global.get $block_exec_tail_exit_runs) (i32.const 1)))
            (br $done)))
        ;; Which edge. term_kind 4 is an unconditional one -- a block that ends
        ;; in a `jmp`, or one that simply falls into its successor -- and it
        ;; evaluates no condition at all. Everything else evaluates the same
        ;; $eval_cc the scalar Jcc would have, off the same globals, so all
        ;; sixteen conditions are exact here for free.
        (local.set $next_b (local.get $succ_f))
        (if (i32.ne (local.get $term_kind) (i32.const 4))
          (then
            (if (call $eval_cc (local.get $term_cc))
              (then (local.set $next_b (local.get $succ_t))))))
        ;; A modelled exit. Publishes THIS exit's live-out mask: which
        ;; registers the region defined on the paths that can reach it is a
        ;; per-exit fact, not a per-region one.
        (if (i32.lt_s (local.get $next_b) (i32.const 0))
          (then
            (local.set $up
              (i32.add (local.get $EX)
                (i32.shl (i32.sub (i32.const -1) (local.get $next_b))
                         (i32.const 3))))
            (local.set $exit_eip (i32.load          (local.get $up)))
            (local.set $live_out (i32.load offset=4 (local.get $up)))
            (br $done)))
        ;; A breakpoint on an INTERIOR block's entry. $run checks $bp_addr at
        ;; block entries, and a region's interior edges are block entries that
        ;; $run never sees -- so without this a `--break=` inside a folded loop
        ;; would fire on the first entry and then never again, which is a
        ;; debugger that lies. Leaving through the ordinary side-exit hands the
        ;; address to $run, which halts (and arms $bp_skip_once) exactly as it
        ;; does for the unfolded graph. Guarded on the global, so an ordinary
        ;; run pays one already-hot load per block edge and no branch taken.
        (if (global.get $bp_addr)
          (then
            (local.set $exit_eip
              (i32.load offset=48
                (i32.add (local.get $BR)
                  (i32.mul (local.get $next_b)
                    (i32.shl (global.get $REGION_BLOCK_WORDS) (i32.const 2))))))
            (if (i32.eq (local.get $exit_eip) (global.get $bp_addr))
              (then
                (local.set $side (i32.const 1))
                (br $done)))))
        ;; Safepoint. The only place either meter is allowed to stop the run is
        ;; a block edge, because that is the only place the guest is in a state
        ;; the rest of the emulator can read: every register is a value in a
        ;; local about to be published, no instruction is half-retired, and the
        ;; EIP the run resumes at is a real basic-block entry.
        ;; What the fallbacks have spent so far is the drop in the parked
        ;; counter -- it only ever falls, so this is a running total and needs
        ;; no re-parking. Without it a region whose blocks are mostly fallbacks
        ;; would run past its step budget by whatever those handlers charged.
        (if (i32.or (i32.ge_u
                      (i32.add (local.get $nsteps)
                        (i32.sub (i32.const 0x100000) (global.get $steps)))
                      (local.get $steps_avail))
                    (i32.ge_u (local.get $nblk) (local.get $budget_avail)))
          (then
            (local.set $side (i32.const 1))
            (local.set $exit_eip
              (i32.load offset=48
                (i32.add (local.get $BR)
                  (i32.mul (local.get $next_b)
                    (i32.shl (global.get $REGION_BLOCK_WORDS) (i32.const 2))))))
            (br $done)))
        (local.set $cur (local.get $next_b))
        (br $trip)))

    ;; Exit materialization. The live-out mask is what the descriptor proved
    ;; the body writes; a register outside it holds the value it entered with,
    ;; so publishing it would be a no-op and skipping it is not an omission.
    ;; This runs on BOTH kinds of exit -- a modelled one, with its own mask,
    ;; and the budget-exhausted side exit, which publishes all eight because it
    ;; resumes at a block entry rather than at a modelled exit and no mask in
    ;; the descriptor describes what is live there.
    (if (local.get $side) (then (local.set $live_out (i32.const 0xFF))))
    (if (i32.and (local.get $live_out) (i32.const 0x01)) (then (i32.store offset=0 (global.get $reg_base) (local.get $r0))))
    (if (i32.and (local.get $live_out) (i32.const 0x02)) (then (i32.store offset=4 (global.get $reg_base) (local.get $r1))))
    (if (i32.and (local.get $live_out) (i32.const 0x04)) (then (i32.store offset=8 (global.get $reg_base) (local.get $r2))))
    (if (i32.and (local.get $live_out) (i32.const 0x08)) (then (i32.store offset=12 (global.get $reg_base) (local.get $r3))))
    (if (i32.and (local.get $live_out) (i32.const 0x10)) (then (i32.store offset=16 (global.get $reg_base) (local.get $r4))))
    (if (i32.and (local.get $live_out) (i32.const 0x20)) (then (i32.store offset=20 (global.get $reg_base) (local.get $r5))))
    (if (i32.and (local.get $live_out) (i32.const 0x40)) (then (i32.store offset=24 (global.get $reg_base) (local.get $r6))))
    (if (i32.and (local.get $live_out) (i32.const 0x80)) (then (i32.store offset=28 (global.get $reg_base) (local.get $r7))))

    ;; The H149 pair once more: a native producer parked its address in a local
    ;; that nothing outside this frame can see, and the consumer may be the
    ;; first op after the region. One store, on the cold path.
    (global.set $ea_temp (local.get $ea_hold))

    (global.set $tree_fold_iters
      (i64.add (global.get $tree_fold_iters) (i64.extend_i32_u (local.get $nblk))))
    (global.set $tree_fold_ops
      (i64.add (global.get $tree_fold_ops) (i64.extend_i32_u (local.get $nsteps))))
    (global.set $block_exec_runs
      (i32.add (global.get $block_exec_runs) (i32.const 1)))
    (global.set $block_exec_native_ops
      (i64.add (global.get $block_exec_native_ops)
        (i64.extend_i32_u (i32.sub (local.get $nuops_run) (local.get $n_fb)))))
    (global.set $block_exec_fallback_ops
      (i64.add (global.get $block_exec_fallback_ops)
        (i64.extend_i32_u (local.get $n_fb))))
    ;; Transfers the region did NOT make: one per interior block edge. This is
    ;; the second term of the cost model -- ns/entry against ns/op -- and it is
    ;; the only one the histogram cannot recover, because a folded edge leaves
    ;; no trace anywhere else.
    (global.set $block_exec_transfers_saved
      (i64.add (global.get $block_exec_transfers_saved)
        (i64.extend_i32_u (i32.sub (local.get $nblk) (i32.const 1)))))
    ;; Coverage BY REGION SIZE. One store pair per region exit, on the cold
    ;; path out of the trip loop, and the only place the descriptor's own
    ;; $nblocks is joined to the work it did -- $block_exec_native_ops sums
    ;; every size together and cannot answer "how much of this app runs in a
    ;; 2-4 block region", which is the question the census asked.
    ;; Clamped, because $nblocks comes out of the descriptor and a descriptor
    ;; can be hand-fed through set_region_spec; an unclamped index here would
    ;; be a store past the end of $BX_RG_BASE.
    (local.set $nb_clamped
      (select (global.get $REGION_MAX_BLOCKS) (local.get $nblocks)
              (i32.gt_u (local.get $nblocks) (global.get $REGION_MAX_BLOCKS))))
    (local.set $ea (call $bx_rg_word
      (i32.add (global.get $BX_RG_ENTN_OFF) (local.get $nb_clamped))))
    (i32.store (local.get $ea) (i32.add (i32.load (local.get $ea)) (i32.const 1)))
    (local.set $ea (call $bx_rg_word
      (i32.add (global.get $BX_RG_OPSN_OFF) (i32.shl (local.get $nb_clamped) (i32.const 1)))))
    (i64.store (local.get $ea)
      (i64.add (i64.load (local.get $ea)) (i64.extend_i32_u (local.get $nuops_run))))

    ;; Pacing, settled once. $next already billed one step for the dispatch that
    ;; entered here and $run already billed one block, so charge the rest: the
    ;; guest ops every block execution stood for, what the fallbacks actually
    ;; spent (measured as the drop in the parked counter), and the interior
    ;; transfers. The transfer OUT of the region is charged by $branch_end (or,
    ;; on a threaded tail, by the terminator itself), exactly as the unfolded
    ;; graph would have charged it.
    (local.set $fb_used (i32.sub (i32.const 0x100000) (global.get $steps)))
    (global.set $steps
      (i32.sub (local.get $steps_in)
        (i32.sub (i32.add (local.get $nsteps) (local.get $fb_used))
                 (i32.const 1))))
    (global.set $block_budget
      (i32.sub (global.get $block_budget)
        (i32.sub (local.get $nblk) (i32.const 1))))

    ;; A threaded tail does not leave the region through an edge at all: the
    ;; block's own terminator is the next op in the stream. If $steps went
    ;; non-positive above, $next takes the ordinary out-of-steps path and parks
    ;; $resume_ip HERE -- a real op boundary with every register published.
    (if (local.get $tail_exit)
      (then
        (call $bx_tail_note (local.get $tail_ip))
        (global.set $ip (local.get $tail_ip))
        (dispatch-next)))

    ;; A side exit resumes at the entry EIP of the block it was about to run:
    ;; the guest state is fully materialized, so the region is re-entered (or,
    ;; if the resume point is an interior block, that block is decoded on its
    ;; own) as if the graph had simply been interrupted at an edge -- which it
    ;; was.
    (global.set $eip (local.get $exit_eip))
    (return_call $branch_end))

  ;; ======================================================================
  ;; H463 -- THE ONE-BLOCK LEAF (round 16, section 25 of the design doc)
  ;; ======================================================================
  ;; Section 13.7's open item, and the review's round-14 experiment #2: the
  ;; merged executor is ONE large wasm function, and the 1-block case is the
  ;; one that amortizes its prologue over the fewest micro-ops -- which is
  ;; exactly what section 13.5 measured as blk16 losing 17 points and blk32 20
  ;; when H454 and H458 became one function.
  ;;
  ;; So the common install gets its own entry point. What is NOT here, against
  ;; $th_block_exec: the trip loop and its thirteen per-block record loads, the
  ;; five terminator `br_table`s and the flag helpers under them, `$eval_cc`,
  ;; the exit table, the per-exit live-out mask, the interior-breakpoint side
  ;; exit, the step/budget safepoint, the parked `$steps` counter, the fallback
  ;; spill/`call_indirect`/reload pair and the per-region-size histogram. What
  ;; IS here is the micro-op body loop, byte for byte the same code, and the
  ;; publish that follows it.
  ;;
  ;; THE CONTRACT, which $block_exec_try_install enforces at emit time:
  ;;   nblocks == 1, nexits == 0, term_kind == 5 (threaded tail),
  ;;   no TU_FALLBACK and no TU_X87RUN micro-op.
  ;; Every one of those is a property of the descriptor's bytes, and a
  ;; descriptor is immutable once emitted -- an SMC write drops the whole page
  ;; rather than editing it -- so the two arms this function cannot run are
  ;; `unreachable` rather than guarded.
  ;;
  ;; THE DUPLICATION IS DELIBERATE AND IS THE COST OF THE EXPERIMENT. WAT has
  ;; no way to share a body across two functions with different local sets,
  ;; and different local sets are the entire point: a local lives exactly one
  ;; function invocation. `tools/indirect-census.js --preset=block-exec` prints
  ;; both functions' sizes side by side, and test/test-block-exec.js runs the
  ;; same 269 differential cases through both arms of `--block-exec-leaf`, so a
  ;; body that drifts is a failing test rather than a silent divergence.
  (func $th_block_exec_leaf (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $tp i32) (local $up i32) (local $ub i32)
    (local $nuops i32) (local $cost i32) (local $tail_ip i32) (local $brp i32)
    (local $r0 i32) (local $r1 i32) (local $r2 i32) (local $r3 i32)
    (local $r4 i32) (local $r5 i32) (local $r6 i32) (local $r7 i32)
    (local $r8 i32) (local $r9 i32) (local $r10 i32) (local $r11 i32)
    (local $r12 i32) (local $r13 i32) (local $r14 i32)
    (local $i i32) (local $kind i32) (local $d i32) (local $a i32) (local $imm i32)
    (local $b i32) (local $ea i32) (local $ea_hold i32)
    (local $sh_d i32) (local $sh_a i32) (local $mask i32) (local $ssh i32)
    (local $nof i32) (local $beff i32)
    (local $va i32) (local $vb i32) (local $vr i32) (local $wrote i32)

    (local.set $tp (global.get $ip))
    ;; The block record is the only one there is, at +16. Its own fields are
    ;; read rather than assumed -- three loads against the general function's
    ;; thirteen -- and the micro-op array starts right after it because
    ;; `nexits` is 0 and there is no exit table between them.
    (local.set $brp (i32.add (local.get $tp) (i32.const 16)))
    (local.set $nuops (i32.load offset=4  (local.get $brp)))
    (local.set $cost  (i32.load offset=36 (local.get $brp)))
    (local.set $ub
      (i32.add
        (i32.add (local.get $brp)
          (i32.shl (global.get $REGION_BLOCK_WORDS) (i32.const 2)))
        (i32.load (local.get $brp))))          ;; uop_off, 0 for a one-block emit
    ;; The threaded terminator sits after the micro-op array and after the
    ;; `fb_bytes` tail -- which for a leaf descriptor holds no fallback pool,
    ;; only round 13's saved copy of the stream this descriptor displaced.
    (local.set $tail_ip
      (i32.add
        (i32.add (local.get $ub)
          (i32.mul (local.get $nuops)
            (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2))))
        (i32.load offset=12 (local.get $tp))))
    (global.set $ip (local.get $tail_ip))

    ;; Entry materialization, all eight, for the same reason the general
    ;; function does it: a live-in mask cannot be wrong about a register the
    ;; descriptor forgot to name, and eight local.sets are cheaper than the
    ;; test that would skip one.
    (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
    (local.set $r1 (i32.load offset=4 (global.get $reg_base)))
    (local.set $r2 (i32.load offset=8 (global.get $reg_base)))
    (local.set $r3 (i32.load offset=12 (global.get $reg_base)))
    (local.set $r4 (i32.load offset=16 (global.get $reg_base)))
    (local.set $r5 (i32.load offset=20 (global.get $reg_base)))
    (local.set $r6 (i32.load offset=24 (global.get $reg_base)))
    (local.set $r7 (i32.load offset=28 (global.get $reg_base)))

    (global.set $tree_fold_runs
      (i32.add (global.get $tree_fold_runs) (i32.const 1)))

    ;; No safepoint and no do-while: one block always runs to completion,
    ;; exactly as the unfolded block would have once $run entered it. The
    ;; meters are settled once, below.
    (local.set $i (i32.const 0))
    (local.set $up (local.get $ub))
    (block $body_done
      (loop $body
            (br_if $body_done (i32.ge_u (local.get $i) (local.get $nuops)))
            (local.set $kind (i32.load           (local.get $up)))
            (local.set $d    (i32.load offset=4  (local.get $up)))
            (local.set $a    (i32.load offset=8  (local.get $up)))
            (local.set $imm  (i32.load offset=12 (local.get $up)))
            (local.set $b    (i32.load offset=20 (local.get $up)))
            ;; Op totals have to stay comparable with a --tree-fold-off build,
            ;; or a handler histogram silently stops counting the work this
            ;; fold does. Re-record the original handler index, as H428 does.
            ;; fn == -1 is the LOAD half of a round-11 split: one x86
            ;; instruction became two micro-ops, and recording both would
            ;; report more guest ops than the threaded arm retired for the
            ;; same code. The other half carries the original handler index,
            ;; so the instruction is still counted exactly once.
            (if (i32.and (global.get $handler_hist_enabled)
                         (i32.ne (i32.load offset=16 (local.get $up)) (i32.const -1)))
              (then (call $handler_hist_record (i32.load offset=16 (local.get $up)))))
            (local.set $up (i32.add (local.get $up) (i32.const 24)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))

            ;; R[d] and R[a], by index. A br_table each, but over LOCALS --
            ;; no memory traffic and no call, which is the whole point.
            ;;
            ;; Fifteen arms since round 11: 0..7 are the architectural
            ;; registers and 8..14 the split's temp lanes. Index 15 (absent)
            ;; still lands on the DEFAULT arm, and every site that can see a
            ;; 15 guards it, so which lane the default names is immaterial --
            ;; it is r14 here only because a br_table needs some default.
            (local.set $va
              (block $gd (result i32)
                (block $g14 (block $g13 (block $g12 (block $g11 (block $g10
                (block $g9 (block $g8
                (block $g7 (block $g6 (block $g5 (block $g4
                (block $g3 (block $g2 (block $g1 (block $g0
                  (br_table $g0 $g1 $g2 $g3 $g4 $g5 $g6 $g7
                            $g8 $g9 $g10 $g11 $g12 $g13 $g14
                            $g14 (local.get $d)))
                  (br $gd (local.get $r0))) (br $gd (local.get $r1)))
                  (br $gd (local.get $r2))) (br $gd (local.get $r3)))
                  (br $gd (local.get $r4))) (br $gd (local.get $r5)))
                  (br $gd (local.get $r6))) (br $gd (local.get $r7)))
                  (br $gd (local.get $r8))) (br $gd (local.get $r9)))
                  (br $gd (local.get $r10))) (br $gd (local.get $r11)))
                  (br $gd (local.get $r12))) (br $gd (local.get $r13)))
                (local.get $r14)))
            ;; TU_B_SRC0: the register-move elimination's redirect. The move
            ;; that used to put this value in R[d] is gone, so the first
            ;; source comes out of the lane named at b[27:24] instead. Read as
            ;; a second br_table rather than by patching `d`, because `d` is
            ;; still where the RESULT goes.
            (if (i32.and (local.get $b) (global.get $TU_B_SRC0))
              (then (local.set $va
                (block $sd (result i32)
                  (block $q14 (block $q13 (block $q12 (block $q11 (block $q10
                  (block $q9 (block $q8
                  (block $q7 (block $q6 (block $q5 (block $q4
                  (block $q3 (block $q2 (block $q1 (block $q0
                    (br_table $q0 $q1 $q2 $q3 $q4 $q5 $q6 $q7
                              $q8 $q9 $q10 $q11 $q12 $q13 $q14
                              $q14
                              (i32.and (i32.shr_u (local.get $b)
                                         (global.get $TU_B_SRC0_SHIFT))
                                       (i32.const 0xF))))
                    (br $sd (local.get $r0))) (br $sd (local.get $r1)))
                    (br $sd (local.get $r2))) (br $sd (local.get $r3)))
                    (br $sd (local.get $r4))) (br $sd (local.get $r5)))
                    (br $sd (local.get $r6))) (br $sd (local.get $r7)))
                    (br $sd (local.get $r8))) (br $sd (local.get $r9)))
                    (br $sd (local.get $r10))) (br $sd (local.get $r11)))
                    (br $sd (local.get $r12))) (br $sd (local.get $r13)))
                  (local.get $r14)))))
            (local.set $vb
              (block $ga (result i32)
                (block $a14 (block $a13 (block $a12 (block $a11 (block $a10
                (block $a9 (block $a8
                (block $a7 (block $a6 (block $a5 (block $a4
                (block $a3 (block $a2 (block $a1 (block $a0
                  (br_table $a0 $a1 $a2 $a3 $a4 $a5 $a6 $a7
                            $a8 $a9 $a10 $a11 $a12 $a13 $a14
                            $a14 (local.get $a)))
                  (br $ga (local.get $r0))) (br $ga (local.get $r1)))
                  (br $ga (local.get $r2))) (br $ga (local.get $r3)))
                  (br $ga (local.get $r4))) (br $ga (local.get $r5)))
                  (br $ga (local.get $r6))) (br $ga (local.get $r7)))
                  (br $ga (local.get $r8))) (br $ga (local.get $r9)))
                  (br $ga (local.get $r10))) (br $ga (local.get $r11)))
                  (br $ga (local.get $r12))) (br $ga (local.get $r13)))
                (local.get $r14)))

            ;; Sub-register lane and width, decoded unconditionally because it
            ;; is four arithmetic ops with no branch and every alternative
            ;; (a guard, a second br_table) costs more than it saves. The lane
            ;; bits are placed so that one shift extracts each: bit 6 -> 8 and
            ;; bit 7 -> 8, i.e. a byte op on AH..BH reads and writes bits 8..15
            ;; of its container and a low-byte or word op reads bits 0..15.
            (local.set $sh_d (i32.and (i32.shr_u (local.get $b) (i32.const 3)) (i32.const 8)))
            (local.set $sh_a (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 8)))
            (local.set $mask
              (select (i32.const 0xFFFF) (i32.const 0xFF)
                      (i32.and (local.get $b) (global.get $TU_B_WORD))))
            (local.set $ssh
              (select (i32.const 15) (i32.const 7)
                      (i32.and (local.get $b) (global.get $TU_B_WORD))))
            ;; "Nobody reads the flags this op would write." Decoded here, next
            ;; to the other `b` fields, so the arms below are a single test on
            ;; a local rather than a mask-and-shift each.
            (local.set $nof (i32.and (local.get $b) (global.get $TU_B_NOFLAGS)))

            ;; The H149 pair's join. A consumer marked TU_B_EA had
            ;; $SIB_SENTINEL where its address should be, so its address is the
            ;; one the preceding TU_EA_SIB left in $ea_hold -- which is exactly
            ;; what $read_addr does with $ea_temp, one indirection shorter.
            ;; Branchless, and folded into the same `b` decode as the lane bits
            ;; above so no kind that cannot carry the bit pays a test for it.
            (local.set $imm
              (select (local.get $ea_hold) (local.get $imm)
                      (i32.and (local.get $b) (global.get $TU_B_EA))))

            ;; SIB effective address, for the contiguous tail of kinds that
            ;; need one. Hoisted here rather than repeated in three arms, and
            ;; guarded by a range test so no other kind pays for it.
            ;;
            ;; $vb already holds R[a] from the read above, so the base term is
            ;; free -- but only when a base is present: `a == 0xF` means the
            ;; SIB had none, and $vb then holds r7 (the br_table's default
            ;; arm), which is why the base is added under a test rather than
            ;; unconditionally. The index needs its own read because it is a
            ;; different register from both $d and $a.
            (if (i32.ge_u (local.get $kind) (global.get $TU_FIRST_SIB))
              (then
                (local.set $ea (local.get $imm))
                (if (i32.ne (local.get $a) (i32.const 0xF))
                  (then (local.set $ea (i32.add (local.get $ea) (local.get $vb)))))
                (if (i32.ne (i32.and (local.get $b) (i32.const 0xF)) (i32.const 0xF))
                  (then (local.set $ea
                    (i32.add (local.get $ea)
                      (i32.shl
                        (block $gi (result i32)
                          (block $i7 (block $i6 (block $i5 (block $i4
                          (block $i3 (block $i2 (block $i1 (block $i0
                            (br_table $i0 $i1 $i2 $i3 $i4 $i5 $i6 $i7
                                      (i32.and (local.get $b) (i32.const 0xF))))
                            (br $gi (local.get $r0))) (br $gi (local.get $r1)))
                            (br $gi (local.get $r2))) (br $gi (local.get $r3)))
                            (br $gi (local.get $r4))) (br $gi (local.get $r5)))
                            (br $gi (local.get $r6)))
                          (local.get $r7))
                        ;; Scale is TWO bits at b[5:4]. The `& 3` is load-bearing
                        ;; on exactly one kind: TU_STORE8_SIB is the only one that
                        ;; carries SIB fields AND a lane bit, and TU_B_LANE_D is
                        ;; 0x40 -- bit 6, which an unmasked `b >> 4` folds into
                        ;; the shift amount as +4. A high-byte store through an
                        ;; indexed address then writes at index<<(scale+4).
                        ;; Found by test/test-block-exec.js, which reaches the
                        ;; combination H454 has apparently never met in a
                        ;; self-loop; H458 shares this decode verbatim.
                        (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 3)))))))))

            ;; Evaluate. Every arm publishes exactly the flag fields its
            ;; scalar handler publishes, by calling the same helper -- which
            ;; is what makes the per-field join right at every instant.
            ;;
            ;; $wrote, rather than a second exit label out of the br_table:
            ;; a store is the one kind whose result does not go to a register,
            ;; and branching around the writeback from inside the table put
            ;; the branch target outside the loop body the first time this was
            ;; written -- which silently truncated every iteration at its
            ;; first store instead of failing.
            (local.set $wrote (i32.const 1))
            (block $kdone
              (block $k60
              (block $k59 (block $k58
              (block $k57 (block $k56 (block $k55 (block $k54
              (block $k53 (block $k52 (block $k51 (block $k50
              (block $k49 (block $k48 (block $k47
              (block $k46 (block $k45 (block $k44 (block $k43
              (block $k42 (block $k41 (block $k40
              (block $k39 (block $k38 (block $k37 (block $k36 (block $k35
              (block $k34 (block $k33 (block $k32 (block $k31 (block $k30
              (block $k29 (block $k28 (block $k27 (block $k26 (block $k25
              (block $k24 (block $k23 (block $k22
              (block $k21 (block $k20 (block $k19 (block $k18
              (block $k17 (block $k16 (block $k15 (block $k14
              (block $k13 (block $k12 (block $k11 (block $k10
              (block $k09 (block $k08 (block $k07 (block $k06
              (block $k05 (block $k04 (block $k03 (block $k02
              (block $k01 (block $k00
                (br_table $k00 $k01 $k02 $k03 $k04 $k05 $k06 $k07 $k08 $k09
                          $k10 $k11 $k12 $k13 $k14 $k15 $k16 $k17 $k18 $k19
                          $k20 $k21 $k22 $k23 $k24 $k25 $k26 $k27 $k28 $k29
                          $k30 $k31 $k32 $k33 $k34 $k35 $k36 $k37 $k38 $k39
                          $k40 $k41 $k42 $k43 $k44 $k45 $k46 $k47 $k48 $k49
                          $k50 $k51 $k52 $k53 $k54 $k55 $k56 $k57
                          $k58 $k59 $k60
                          $k60
                          (local.get $kind)))
                ;; 0 MOV_RR
                (local.set $vr (local.get $vb)) (br $kdone))
                ;; 1 MOV_RI
                (local.set $vr (local.get $imm)) (br $kdone))
                ;; 2 LEA_RO -- LEA never touches flags
                (local.set $vr (i32.add (local.get $vb) (local.get $imm))) (br $kdone))
                ;; 3 ADD_RR. From here to 19, the arithmetic is unconditional
                ;; and only the $set_flags_* call is gated on $nof -- the bit
                ;; the decode-time dead-flag pass set when it proved nothing
                ;; between here and the terminator reads what this would write.
                (local.set $vr (i32.add (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_add (local.get $va) (local.get $vb) (local.get $vr))))
                (br $kdone))
                ;; 4 ADD_RI
                (local.set $vr (i32.add (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_add (local.get $va) (local.get $imm) (local.get $vr))))
                (br $kdone))
                ;; 5 SUB_RR
                (local.set $vr (i32.sub (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (local.get $va) (local.get $vb) (local.get $vr))))
                (br $kdone))
                ;; 6 SUB_RI
                (local.set $vr (i32.sub (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (local.get $va) (local.get $imm) (local.get $vr))))
                (br $kdone))
                ;; 7 AND_RR
                (local.set $vr (i32.and (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 8 AND_RI
                (local.set $vr (i32.and (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 9 OR_RR
                (local.set $vr (i32.or (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 10 OR_RI
                (local.set $vr (i32.or (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 11 XOR_RR
                (local.set $vr (i32.xor (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 12 XOR_RI
                (local.set $vr (i32.xor (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 13 INC -- preserves CF, which $set_flags_inc reads back out
                ;; of whatever really wrote it last. Skipping it when the flags
                ;; are dead also skips that $get_cf, which is the single most
                ;; expensive thing the elision removes.
                (local.set $vr (i32.add (local.get $va) (i32.const 1)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_inc (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 14 DEC
                (local.set $vr (i32.sub (local.get $va) (i32.const 1)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_dec (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 15 NEG == SUB 0, src
                (local.set $vr (i32.sub (i32.const 0) (local.get $va)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (i32.const 0) (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 16 NOT -- no flags, exactly as x86
                (local.set $vr (i32.xor (local.get $va) (i32.const -1))) (br $kdone))
                ;; 17 SHIFT -- $do_shift32 owns the flag contract, including
                ;; the count==0 case that writes nothing at all.
                (local.set $vr
                  (call $do_shift32 (local.get $a) (local.get $va) (local.get $imm)))
                (br $kdone))
                ;; 18 IMUL_RR. The 64-bit product exists only to decide CF/OF,
                ;; so a dead-flag IMUL drops the widening multiply as well as
                ;; the three global stores.
                (local.set $vr (i32.mul (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then
                    (global.set $flag_op (i32.const 6))
                    (global.set $flag_sign_shift (i32.const 31))
                    (global.set $flag_b
                      (i64.ne
                        (i64.mul (i64.extend_i32_s (local.get $va))
                                 (i64.extend_i32_s (local.get $vb)))
                        (i64.extend_i32_s (local.get $vr))))
                    (global.set $flag_res (local.get $vr))))
                (br $kdone))
                ;; 19 IMUL_RI
                (local.set $vr (i32.mul (local.get $vb) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then
                    (global.set $flag_op (i32.const 6))
                    (global.set $flag_sign_shift (i32.const 31))
                    (global.set $flag_b
                      (i64.ne
                        (i64.mul (i64.extend_i32_s (local.get $vb))
                                 (i64.extend_i32_s (local.get $imm)))
                        (i64.extend_i32_s (local.get $vr))))
                    (global.set $flag_res (local.get $vr))))
                (br $kdone))
                ;; 20 LOAD32
                (local.set $vr
                  (call $gl32 (i32.add (local.get $vb) (local.get $imm))))
                (br $kdone))
                ;; 21 STORE32. Writes memory, not a register, so it skips the
                ;; writeback entirely -- and it goes through $gs32, which is
                ;; what keeps SMC invalidation and page crossing identical to
                ;; the scalar path.
                (call $gs32 (i32.add (local.get $vb) (local.get $imm)) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 22 LOAD32_ABS -- the address is a decode-time constant.
                (local.set $vr (call $gl32 (local.get $imm))) (br $kdone))
                ;; 23 STORE32_ABS
                (call $gs32 (local.get $imm) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))

                ;; -- sub-register writes. Each of these computes a value at
                ;; the sub-width and then INSERTS it into the container's
                ;; local, leaving the lanes it does not cover exactly as they
                ;; were -- which is what makes a partial write expressible here
                ;; at all, and why $vr is always a full 32-bit value even when
                ;; the op wrote eight bits of it.

                ;; 24 MOV_SUB_RR -- no flags, either width.
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $sh_d))))
                (br $kdone))
                ;; 25 MOV_SUB_RI -- no flags.
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (i32.and (local.get $imm) (local.get $mask)) (local.get $sh_d))))
                (br $kdone))
                ;; 26 ALU_SUB_RR. $do_alu_sized owns the flag contract at this
                ;; width, including flag_sign_shift; CMP (7) writes no register.
                ;; With the flags dead, $tree_alu_sized_noflags computes the
                ;; same six results with the flag half removed -- and a dead
                ;; CMP becomes nothing at all, since it writes no register
                ;; either.
                (local.set $vb
                  (if (result i32) (local.get $nof)
                    (then (call $tree_alu_sized_noflags
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $mask)))
                    (else (call $do_alu_sized
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $mask) (local.get $ssh)))))
                (if (i32.eq (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT))
                                     (i32.const 0xF))
                            (i32.const 7))
                  (then (local.set $wrote (i32.const 0)))
                  (else (local.set $vr
                    (i32.or
                      (i32.and (local.get $va)
                        (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                      (i32.shl (local.get $vb) (local.get $sh_d))))))
                (br $kdone))
                ;; 27 ALU_SUB_RI
                (local.set $vb
                  (if (result i32) (local.get $nof)
                    (then (call $tree_alu_sized_noflags
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (local.get $imm) (local.get $mask))
                      (local.get $mask)))
                    (else (call $do_alu_sized
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (local.get $imm) (local.get $mask))
                      (local.get $mask) (local.get $ssh)))))
                (if (i32.eq (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT))
                                     (i32.const 0xF))
                            (i32.const 7))
                  (then (local.set $wrote (i32.const 0)))
                  (else (local.set $vr
                    (i32.or
                      (i32.and (local.get $va)
                        (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                      (i32.shl (local.get $vb) (local.get $sh_d))))))
                (br $kdone))
                ;; 28 LOAD8_RO -- R8[d] = [R[a] + imm]
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (call $gl8 (i32.add (local.get $vb) (local.get $imm)))
                             (local.get $sh_d))))
                (br $kdone))
                ;; 29 STORE8_RO
                (call $gs8 (i32.add (local.get $vb) (local.get $imm))
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 30 LOAD8_ABS
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (call $gl8 (local.get $imm)) (local.get $sh_d))))
                (br $kdone))
                ;; 31 STORE8_ABS
                (call $gs8 (local.get $imm)
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 32 MOVZX8_RO -- narrow read, WHOLE destination written.
                (local.set $vr (call $gl8 (i32.add (local.get $vb) (local.get $imm))))
                (br $kdone))
                ;; 33 MOVSX8_RO
                (local.set $vr
                  (call $sign_ext8 (call $gl8 (i32.add (local.get $vb) (local.get $imm)))))
                (br $kdone))
                ;; 34 LEA_SIB -- address arithmetic only, no memory and, as on
                ;; x86, no flags.
                (local.set $vr (local.get $ea)) (br $kdone))
                ;; 35 LOAD32_SIB
                (local.set $vr (call $gl32 (local.get $ea))) (br $kdone))
                ;; 36 STORE32_SIB
                (call $gs32 (local.get $ea) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 37 MOVSX8_SIB
                (local.set $vr (call $sign_ext8 (call $gl8 (local.get $ea)))) (br $kdone))
                ;; 38 STORE8_SIB
                (call $gs8 (local.get $ea)
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 39 MOV_M8_I_SIB. The immediate rides in `b` because this
                ;; handler's operand word IS the byte.
                (call $gs8 (local.get $ea)
                  (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_IMM8_SHIFT))
                           (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 40 LOAD16_ABS -- the low half only; the top half of the
                ;; container survives, exactly as $th_mov_r16_m16 leaves it.
                (local.set $vr
                  (i32.or (i32.and (local.get $va) (i32.const 0xFFFF0000))
                          (call $gl16 (local.get $imm))))
                (br $kdone))
                ;; 41 LOAD16_RO
                (local.set $vr
                  (i32.or (i32.and (local.get $va) (i32.const 0xFFFF0000))
                          (call $gl16 (i32.add (local.get $vb) (local.get $imm)))))
                (br $kdone))
                ;; 42 STORE16_RO
                (call $gs16 (i32.add (local.get $vb) (local.get $imm))
                  (i32.and (local.get $va) (i32.const 0xFFFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 43 ADC_RR -- $th_adc_r_r, transcribed. The CF fix-up is not
                ;; decoration: when `b + cf` wraps, the carry out is 1 no
                ;; matter what the sum says, and flag_op 8 is the raw mode that
                ;; states that without disturbing the ZF/SF the add just set.
                (local.set $beff (i32.add (local.get $vb) (call $get_cf)))
                (local.set $vr (i32.add (local.get $va) (local.get $beff)))
                (call $set_flags_add (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $vb))
                  (then (global.set $flag_op (i32.const 8))
                        (global.set $flag_a (i32.const 1))
                        (global.set $flag_b (i32.const 0))))
                (br $kdone))
                ;; 44 ADC_RI
                (local.set $beff (i32.add (local.get $imm) (call $get_cf)))
                (local.set $vr (i32.add (local.get $va) (local.get $beff)))
                (call $set_flags_add (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $imm))
                  (then (global.set $flag_op (i32.const 8))
                        (global.set $flag_a (i32.const 1))
                        (global.set $flag_b (i32.const 0))))
                (br $kdone))
                ;; 45 SBB_RR -- the borrow twin, which fixes flag_a/flag_b only.
                (local.set $beff (i32.add (local.get $vb) (call $get_cf)))
                (local.set $vr (i32.sub (local.get $va) (local.get $beff)))
                (call $set_flags_sub (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $vb))
                  (then (global.set $flag_a (i32.const 0))
                        (global.set $flag_b (i32.const 1))))
                (br $kdone))
              ;; 46 SBB_RI
              (local.set $beff (i32.add (local.get $imm) (call $get_cf)))
              (local.set $vr (i32.sub (local.get $va) (local.get $beff)))
              (call $set_flags_sub (local.get $va) (local.get $beff) (local.get $vr))
              (if (i32.lt_u (local.get $beff) (local.get $imm))
                (then (global.set $flag_a (i32.const 0))
                      (global.set $flag_b (i32.const 1))))
              (br $kdone))
              ;; 47 EA_SIB -- the address is already in $ea (the hoist above
              ;; computed it, since this kind is in the SIB range). Park it for
              ;; the next micro-op and write no register: this op is not an
              ;; instruction, it is half of one.
              (local.set $ea_hold (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 48 EA_SIB_LD8 (and the unreachable default) -- the same EA,
              ;; plus the byte load H149's operand bit 8 fused into it. The
              ;; insert is the ordinary sub-register one, so AH..BH land in
              ;; bits 8..15 of their container exactly as $set_reg8 puts them.
              (local.set $ea_hold (local.get $ea))
              (local.set $vr
                (i32.or
                  (i32.and (local.get $va)
                    (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                  (i32.shl (call $gl8 (local.get $ea)) (local.get $sh_d))))
              (br $kdone))
              ;; 49 REP_STR. Publish, call the
              ;; interpreter's own body, reload. The publish has to be all
              ;; eight and not just ESI/EDI/ECX/EAX: $gs8/$gl8 reach
              ;; $invalidate_code_write and the page compiler, and a fault
              ;; path reads the register file to build its report, so leaving
              ;; a stale global behind would be visible from inside the call.
              (i32.store offset=0 (global.get $reg_base) (local.get $r0))
              (i32.store offset=4 (global.get $reg_base) (local.get $r1))
              (i32.store offset=8 (global.get $reg_base) (local.get $r2))
              (i32.store offset=12 (global.get $reg_base) (local.get $r3))
              (i32.store offset=16 (global.get $reg_base) (local.get $r4))
              (i32.store offset=20 (global.get $reg_base) (local.get $r5))
              (i32.store offset=24 (global.get $reg_base) (local.get $r6))
              (i32.store offset=28 (global.get $reg_base) (local.get $r7))
              (block $rdone
                (block $r3b (block $r2b (block $r1b (block $r0b
                  (br_table $r0b $r1b $r2b $r3b $r3b (local.get $d)))
                  (call $rep_movsb_do) (br $rdone))
                  (call $rep_movsd_do) (br $rdone))
                  (call $rep_stosb_do) (br $rdone))
                (call $rep_stosd_do))
              (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
              (local.set $r1 (i32.load offset=4 (global.get $reg_base)))
              (local.set $r2 (i32.load offset=8 (global.get $reg_base)))
              (local.set $r3 (i32.load offset=12 (global.get $reg_base)))
              (local.set $r4 (i32.load offset=16 (global.get $reg_base)))
              (local.set $r5 (i32.load offset=20 (global.get $reg_base)))
              (local.set $r6 (i32.load offset=24 (global.get $reg_base)))
              (local.set $r7 (i32.load offset=28 (global.get $reg_base)))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 50 X87_MEM -- absolute (or H149-paired) address. The hoisted
              ;; $ea is already the address: `a` is 0xF so no base was added
              ;; and the SIB index nibble is 0xF so no index was, leaving the
              ;; immediate the TU_B_EA select above may have replaced with
              ;; $ea_hold. $fpu_exec_mem is the same function $th_fpu_mem
              ;; calls with the same two nibbles, so the load width, the
              ;; push/pop, the tag word and every sticky bit in $fpu_sw are
              ;; the interpreter's, not this family's.
              (call $fpu_exec_mem
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 51 X87_MRO -- base+disp. $ea is R[a] + imm, computed from the
              ;; register LOCAL; the scalar H190 pays a $get_reg for the same
              ;; number. Identical call otherwise.
              (call $fpu_exec_mem
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 52 X87_REG -- no memory and no general register at all. The
              ;; accepted set excludes FCMOVcc and FCOMI/FUCOMI, so nothing
              ;; here reads or writes a lazy-flag field and the dead-flag
              ;; pass's model stays complete.
              (call $fpu_exec_reg
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_RM_SHIFT))
                         (i32.const 0xF)))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 53 FNSTSW AX (and the unreachable default). The one x87 op
              ;; that writes a general register, so EAX round-trips through
              ;; the global the way TU_REP_STR round-trips all eight -- the
              ;; interpreter's arm reads $eax to preserve its top half and
              ;; writes the status word into the bottom, and reproducing that
              ;; here would be a second copy of it. Only EAX needs publishing:
              ;; DF E0 reads and writes nothing else.
              (i32.store offset=0 (global.get $reg_base) (local.get $r0))
              (call $fpu_exec_reg (i32.const 7) (i32.const 4) (i32.const 0))
              (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 54 PUSH_R. ESP is r4, a local, so the whole push is register
              ;; arithmetic plus one $gs32. `push esp` pushes the OLD esp, which
              ;; is already what $va holds.
              (local.set $r4 (i32.sub (local.get $r4) (i32.const 4)))
              (call $gs32 (local.get $r4) (local.get $va))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 55 POP_R. The writeback runs after the ESP adjustment, so
              ;; `pop esp` lands the loaded value and not the incremented one --
              ;; which is what the architecture says.
              (local.set $vr (call $gl32 (local.get $r4)))
              (local.set $r4 (i32.add (local.get $r4) (i32.const 4)))
              (br $kdone))

              ;; 56 PUSH_I
              (local.set $r4 (i32.sub (local.get $r4) (i32.const 4)))
              (call $gs32 (local.get $r4) (local.get $imm))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 57 FALLBACK -- cannot occur here. $block_exec_try_install
              ;; only emits $BX_LEAF_HANDLER when the descriptor carries no
              ;; TU_FALLBACK and no TU_X87RUN, and a descriptor is immutable
              ;; once emitted (an SMC write drops the whole page), so this arm
              ;; is unreachable by construction rather than by hope. Failing
              ;; fast here is the project's stub rule: a silent wrong answer
              ;; from a mis-emitted descriptor would be far harder to find.
              (unreachable)
              (br $kdone))

              ;; 58 CMP_RR -- flags of R[d] - R[a], no register written. The
              ;; same $set_flags_sub $th_cmp_r_r calls, on the same two values.
              (if (i32.eqz (local.get $nof))
                (then (call $set_flags_sub (local.get $va) (local.get $vb)
                        (i32.sub (local.get $va) (local.get $vb)))))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 59 CMP_RI
              (if (i32.eqz (local.get $nof))
                (then (call $set_flags_sub (local.get $va) (local.get $imm)
                        (i32.sub (local.get $va) (local.get $imm)))))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 60 X87RUN (and the unreachable default) -- cannot occur
              ;; here, for the same reason arm 57 cannot; see there.
              (unreachable))
            ;; Writeback R[d], fifteen arms as above.
            (if (local.get $wrote)
              (then
                (block $sdone
                (block $s14 (block $s13 (block $s12 (block $s11 (block $s10
                (block $s9 (block $s8
                (block $s7 (block $s6 (block $s5 (block $s4
                (block $s3 (block $s2 (block $s1 (block $s0
                  (br_table $s0 $s1 $s2 $s3 $s4 $s5 $s6 $s7
                            $s8 $s9 $s10 $s11 $s12 $s13 $s14
                            $s14 (local.get $d)))
                  (local.set $r0 (local.get $vr)) (br $sdone))
                  (local.set $r1 (local.get $vr)) (br $sdone))
                  (local.set $r2 (local.get $vr)) (br $sdone))
                  (local.set $r3 (local.get $vr)) (br $sdone))
                  (local.set $r4 (local.get $vr)) (br $sdone))
                  (local.set $r5 (local.get $vr)) (br $sdone))
                  (local.set $r6 (local.get $vr)) (br $sdone))
                  (local.set $r7 (local.get $vr)) (br $sdone))
                  (local.set $r8 (local.get $vr)) (br $sdone))
                  (local.set $r9 (local.get $vr)) (br $sdone))
                  (local.set $r10 (local.get $vr)) (br $sdone))
                  (local.set $r11 (local.get $vr)) (br $sdone))
                  (local.set $r12 (local.get $vr)) (br $sdone))
                  (local.set $r13 (local.get $vr)) (br $sdone))
                (local.set $r14 (local.get $vr)))))
            (br $body)))
    ;; Exit. A threaded tail publishes all eight unconditionally: the next op
    ;; in the stream is the block's own terminator, which may read anything.
    (i32.store offset=0 (global.get $reg_base) (local.get $r0))
    (i32.store offset=4 (global.get $reg_base) (local.get $r1))
    (i32.store offset=8 (global.get $reg_base) (local.get $r2))
    (i32.store offset=12 (global.get $reg_base) (local.get $r3))
    (i32.store offset=16 (global.get $reg_base) (local.get $r4))
    (i32.store offset=20 (global.get $reg_base) (local.get $r5))
    (i32.store offset=24 (global.get $reg_base) (local.get $r6))
    (i32.store offset=28 (global.get $reg_base) (local.get $r7))
    ;; The H149 pair: a native producer parked its address in a local nothing
    ;; outside this frame can see, and the consumer may be the first op after
    ;; the block.
    (global.set $ea_temp (local.get $ea_hold))

    ;; The same counters the general function keeps, so a histogram or a
    ;; --block-exec-stats line reads the same whichever entry point ran the
    ;; descriptor -- plus one that says which did.
    (global.set $tree_fold_iters
      (i64.add (global.get $tree_fold_iters) (i64.const 1)))
    (global.set $tree_fold_ops
      (i64.add (global.get $tree_fold_ops) (i64.extend_i32_u (local.get $cost))))
    (global.set $block_exec_runs
      (i32.add (global.get $block_exec_runs) (i32.const 1)))
    (global.set $block_exec_leaf_runs
      (i32.add (global.get $block_exec_leaf_runs) (i32.const 1)))
    (global.set $block_exec_native_ops
      (i64.add (global.get $block_exec_native_ops)
        (i64.extend_i32_u (local.get $nuops))))
    ;; Coverage by region size, index 1: one block, every time.
    (local.set $ea (call $bx_rg_word
      (i32.add (global.get $BX_RG_ENTN_OFF) (i32.const 1))))
    (i32.store (local.get $ea) (i32.add (i32.load (local.get $ea)) (i32.const 1)))
    (local.set $ea (call $bx_rg_word
      (i32.add (global.get $BX_RG_OPSN_OFF) (i32.const 2))))
    (i64.store (local.get $ea)
      (i64.add (i64.load (local.get $ea)) (i64.extend_i32_u (local.get $nuops))))

    ;; Pacing. No fallback ran, so nothing charged itself through $steps and
    ;; there is no parked counter to settle: the block stands for `cost` guest
    ;; steps and $next already billed one for the dispatch that got here.
    ;; $block_budget is untouched -- $run already billed the one block.
    (global.set $steps
      (i32.sub (global.get $steps) (i32.sub (local.get $cost) (i32.const 1))))

    ;; The terminator is the next op in the stream. If $steps went non-positive
    ;; above, $next takes the ordinary out-of-steps path and parks $resume_ip
    ;; here -- a real op boundary with every register published.
    (call $bx_tail_note (local.get $tail_ip))
    (global.set $ip (local.get $tail_ip))
    (dispatch-next))

  ;; ======================================================================
  ;; H464 -- THE ONE-BLOCK LEAF THAT MAY FALL BACK (round 17, section 27)
  ;; ======================================================================
  ;; Section 25.4 named the next question and 25.5 left it as the untouched
  ;; prize: a fallback-carrying one-block descriptor is 73% of executor
  ;; entries on both real windows, and it pays the WHOLE general region
  ;; function -- 10,472 bytes and 14 data-dependent indirect sites -- for the
  ;; sake of one pushfd.
  ;;
  ;; This is $th_block_exec_leaf with arms 57 and 60 made real, and nothing
  ;; else. Against $th_block_exec it still carries none of the region
  ;; machinery: no trip loop and no thirteen per-block record loads, no five
  ;; terminator br_tables and no flag helpers under them, no $eval_cc, no exit
  ;; table, no per-exit live-out mask, no interior-breakpoint side exit, no
  ;; step/budget safepoint and no per-region-size histogram.
  ;;
  ;; WHY A SECOND FUNCTION AND NOT AN ARM ON THE FIRST. The pure leaf's
  ;; measured win is its size and its indirect-site count (section 25.1), and
  ;; a call_indirect in its body loop would add a data-dependent site to EVERY
  ;; descriptor, including the ones that never reach it. A separate entry
  ;; point leaves $th_block_exec_leaf byte-for-byte what it was, which makes
  ;; "the pure leaf did not regress" a property of the build rather than of a
  ;; measurement -- and section 27 checks it as a measurement anyway.
  ;;
  ;; THE CONTRACT, which $block_exec_try_install enforces at emit time:
  ;;   nblocks == 1, nexits == 0, term_kind == 5 (threaded tail).
  ;; It MAY carry TU_FALLBACK and TU_X87RUN micro-ops; those are the point.
  ;; Everything else is the pure leaf's contract, unchanged.
  (func $th_block_exec_leaf_fb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $tp i32) (local $up i32) (local $ub i32)
    ;; ROUND 17 additions over the pure leaf: the fallback pool base, the
    ;; count of fallback micro-ops this run retired, and the two words the
    ;; parked $steps counter needs.
    (local $fbp i32) (local $n_fb i32) (local $steps_in i32) (local $fb_used i32)
    (local $nuops i32) (local $cost i32) (local $tail_ip i32) (local $brp i32)
    (local $r0 i32) (local $r1 i32) (local $r2 i32) (local $r3 i32)
    (local $r4 i32) (local $r5 i32) (local $r6 i32) (local $r7 i32)
    (local $r8 i32) (local $r9 i32) (local $r10 i32) (local $r11 i32)
    (local $r12 i32) (local $r13 i32) (local $r14 i32)
    (local $i i32) (local $kind i32) (local $d i32) (local $a i32) (local $imm i32)
    (local $b i32) (local $ea i32) (local $ea_hold i32)
    (local $sh_d i32) (local $sh_a i32) (local $mask i32) (local $ssh i32)
    (local $nof i32) (local $beff i32)
    (local $va i32) (local $vb i32) (local $vr i32) (local $wrote i32)

    (local.set $tp (global.get $ip))
    ;; The block record is the only one there is, at +16. Its own fields are
    ;; read rather than assumed -- three loads against the general function's
    ;; thirteen -- and the micro-op array starts right after it because
    ;; `nexits` is 0 and there is no exit table between them.
    (local.set $brp (i32.add (local.get $tp) (i32.const 16)))
    (local.set $nuops (i32.load offset=4  (local.get $brp)))
    (local.set $cost  (i32.load offset=36 (local.get $brp)))
    (local.set $ub
      (i32.add
        (i32.add (local.get $brp)
          (i32.shl (global.get $REGION_BLOCK_WORDS) (i32.const 2)))
        (i32.load (local.get $brp))))          ;; uop_off, 0 for a one-block emit
    ;; The threaded terminator sits after the micro-op array and after the
    ;; `fb_bytes` tail -- which for a leaf descriptor holds no fallback pool,
    ;; only round 13's saved copy of the stream this descriptor displaced.
    ;; The FALLBACK POOL starts right after the micro-op array, and the
    ;; threaded terminator right after the pool (header +12, fb_bytes, covers
    ;; the pool AND round 13's saved copy of the displaced stream). The pure
    ;; leaf folds these two adds into one because its pool is always empty;
    ;; this variant needs the intermediate, because a TU_FALLBACK's b word is
    ;; a byte offset into that pool.
    (local.set $fbp
      (i32.add (local.get $ub)
        (i32.mul (local.get $nuops)
          (i32.shl (global.get $TREE_UOP_WORDS) (i32.const 2)))))
    (local.set $tail_ip
      (i32.add (local.get $fbp) (i32.load offset=12 (local.get $tp))))
    (global.set $ip (local.get $tail_ip))

    ;; Entry materialization, all eight, for the same reason the general
    ;; function does it: a live-in mask cannot be wrong about a register the
    ;; descriptor forgot to name, and eight local.sets are cheaper than the
    ;; test that would skip one.
    (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
    (local.set $r1 (i32.load offset=4 (global.get $reg_base)))
    (local.set $r2 (i32.load offset=8 (global.get $reg_base)))
    (local.set $r3 (i32.load offset=12 (global.get $reg_base)))
    (local.set $r4 (i32.load offset=16 (global.get $reg_base)))
    (local.set $r5 (i32.load offset=20 (global.get $reg_base)))
    (local.set $r6 (i32.load offset=24 (global.get $reg_base)))
    (local.set $r7 (i32.load offset=28 (global.get $reg_base)))

    ;; A FALLBACK micro-op runs a real handler, and a real handler ends in
    ;; return_call $next, which spends a step and would take the out-of-steps
    ;; path if the counter had run down mid-block. Park it high for the
    ;; duration and settle once at exit, exactly as $th_block_exec does; what
    ;; the fallbacks actually spent is then (parked - $steps), measured rather
    ;; than predicted, so an unfamiliar self-charging handler cannot silently
    ;; change pacing. There is no safepoint to consult it at -- one block runs
    ;; to completion -- so unlike the general function this needs no
    ;; steps_avail and no budget_avail.
    (local.set $steps_in (global.get $steps))
    (global.set $steps (i32.const 0x100000))

    (global.set $tree_fold_runs
      (i32.add (global.get $tree_fold_runs) (i32.const 1)))

    ;; No safepoint and no do-while: one block always runs to completion,
    ;; exactly as the unfolded block would have once $run entered it. The
    ;; meters are settled once, below.
    (local.set $i (i32.const 0))
    (local.set $up (local.get $ub))
    (block $body_done
      (loop $body
            (br_if $body_done (i32.ge_u (local.get $i) (local.get $nuops)))
            (local.set $kind (i32.load           (local.get $up)))
            (local.set $d    (i32.load offset=4  (local.get $up)))
            (local.set $a    (i32.load offset=8  (local.get $up)))
            (local.set $imm  (i32.load offset=12 (local.get $up)))
            (local.set $b    (i32.load offset=20 (local.get $up)))
            ;; Op totals have to stay comparable with a --tree-fold-off build,
            ;; or a handler histogram silently stops counting the work this
            ;; fold does. Re-record the original handler index, as H428 does.
            ;; fn == -1 is the LOAD half of a round-11 split: one x86
            ;; instruction became two micro-ops, and recording both would
            ;; report more guest ops than the threaded arm retired for the
            ;; same code. The other half carries the original handler index,
            ;; so the instruction is still counted exactly once.
            (if (i32.and (global.get $handler_hist_enabled)
                         (i32.ne (i32.load offset=16 (local.get $up)) (i32.const -1)))
              (then (call $handler_hist_record (i32.load offset=16 (local.get $up)))))
            (local.set $up (i32.add (local.get $up) (i32.const 24)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))

            ;; R[d] and R[a], by index. A br_table each, but over LOCALS --
            ;; no memory traffic and no call, which is the whole point.
            ;;
            ;; Fifteen arms since round 11: 0..7 are the architectural
            ;; registers and 8..14 the split's temp lanes. Index 15 (absent)
            ;; still lands on the DEFAULT arm, and every site that can see a
            ;; 15 guards it, so which lane the default names is immaterial --
            ;; it is r14 here only because a br_table needs some default.
            (local.set $va
              (block $gd (result i32)
                (block $g14 (block $g13 (block $g12 (block $g11 (block $g10
                (block $g9 (block $g8
                (block $g7 (block $g6 (block $g5 (block $g4
                (block $g3 (block $g2 (block $g1 (block $g0
                  (br_table $g0 $g1 $g2 $g3 $g4 $g5 $g6 $g7
                            $g8 $g9 $g10 $g11 $g12 $g13 $g14
                            $g14 (local.get $d)))
                  (br $gd (local.get $r0))) (br $gd (local.get $r1)))
                  (br $gd (local.get $r2))) (br $gd (local.get $r3)))
                  (br $gd (local.get $r4))) (br $gd (local.get $r5)))
                  (br $gd (local.get $r6))) (br $gd (local.get $r7)))
                  (br $gd (local.get $r8))) (br $gd (local.get $r9)))
                  (br $gd (local.get $r10))) (br $gd (local.get $r11)))
                  (br $gd (local.get $r12))) (br $gd (local.get $r13)))
                (local.get $r14)))
            ;; TU_B_SRC0: the register-move elimination's redirect. The move
            ;; that used to put this value in R[d] is gone, so the first
            ;; source comes out of the lane named at b[27:24] instead. Read as
            ;; a second br_table rather than by patching `d`, because `d` is
            ;; still where the RESULT goes.
            (if (i32.and (local.get $b) (global.get $TU_B_SRC0))
              (then (local.set $va
                (block $sd (result i32)
                  (block $q14 (block $q13 (block $q12 (block $q11 (block $q10
                  (block $q9 (block $q8
                  (block $q7 (block $q6 (block $q5 (block $q4
                  (block $q3 (block $q2 (block $q1 (block $q0
                    (br_table $q0 $q1 $q2 $q3 $q4 $q5 $q6 $q7
                              $q8 $q9 $q10 $q11 $q12 $q13 $q14
                              $q14
                              (i32.and (i32.shr_u (local.get $b)
                                         (global.get $TU_B_SRC0_SHIFT))
                                       (i32.const 0xF))))
                    (br $sd (local.get $r0))) (br $sd (local.get $r1)))
                    (br $sd (local.get $r2))) (br $sd (local.get $r3)))
                    (br $sd (local.get $r4))) (br $sd (local.get $r5)))
                    (br $sd (local.get $r6))) (br $sd (local.get $r7)))
                    (br $sd (local.get $r8))) (br $sd (local.get $r9)))
                    (br $sd (local.get $r10))) (br $sd (local.get $r11)))
                    (br $sd (local.get $r12))) (br $sd (local.get $r13)))
                  (local.get $r14)))))
            (local.set $vb
              (block $ga (result i32)
                (block $a14 (block $a13 (block $a12 (block $a11 (block $a10
                (block $a9 (block $a8
                (block $a7 (block $a6 (block $a5 (block $a4
                (block $a3 (block $a2 (block $a1 (block $a0
                  (br_table $a0 $a1 $a2 $a3 $a4 $a5 $a6 $a7
                            $a8 $a9 $a10 $a11 $a12 $a13 $a14
                            $a14 (local.get $a)))
                  (br $ga (local.get $r0))) (br $ga (local.get $r1)))
                  (br $ga (local.get $r2))) (br $ga (local.get $r3)))
                  (br $ga (local.get $r4))) (br $ga (local.get $r5)))
                  (br $ga (local.get $r6))) (br $ga (local.get $r7)))
                  (br $ga (local.get $r8))) (br $ga (local.get $r9)))
                  (br $ga (local.get $r10))) (br $ga (local.get $r11)))
                  (br $ga (local.get $r12))) (br $ga (local.get $r13)))
                (local.get $r14)))

            ;; Sub-register lane and width, decoded unconditionally because it
            ;; is four arithmetic ops with no branch and every alternative
            ;; (a guard, a second br_table) costs more than it saves. The lane
            ;; bits are placed so that one shift extracts each: bit 6 -> 8 and
            ;; bit 7 -> 8, i.e. a byte op on AH..BH reads and writes bits 8..15
            ;; of its container and a low-byte or word op reads bits 0..15.
            (local.set $sh_d (i32.and (i32.shr_u (local.get $b) (i32.const 3)) (i32.const 8)))
            (local.set $sh_a (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 8)))
            (local.set $mask
              (select (i32.const 0xFFFF) (i32.const 0xFF)
                      (i32.and (local.get $b) (global.get $TU_B_WORD))))
            (local.set $ssh
              (select (i32.const 15) (i32.const 7)
                      (i32.and (local.get $b) (global.get $TU_B_WORD))))
            ;; "Nobody reads the flags this op would write." Decoded here, next
            ;; to the other `b` fields, so the arms below are a single test on
            ;; a local rather than a mask-and-shift each.
            (local.set $nof (i32.and (local.get $b) (global.get $TU_B_NOFLAGS)))

            ;; The H149 pair's join. A consumer marked TU_B_EA had
            ;; $SIB_SENTINEL where its address should be, so its address is the
            ;; one the preceding TU_EA_SIB left in $ea_hold -- which is exactly
            ;; what $read_addr does with $ea_temp, one indirection shorter.
            ;; Branchless, and folded into the same `b` decode as the lane bits
            ;; above so no kind that cannot carry the bit pays a test for it.
            (local.set $imm
              (select (local.get $ea_hold) (local.get $imm)
                      (i32.and (local.get $b) (global.get $TU_B_EA))))

            ;; SIB effective address, for the contiguous tail of kinds that
            ;; need one. Hoisted here rather than repeated in three arms, and
            ;; guarded by a range test so no other kind pays for it.
            ;;
            ;; $vb already holds R[a] from the read above, so the base term is
            ;; free -- but only when a base is present: `a == 0xF` means the
            ;; SIB had none, and $vb then holds r7 (the br_table's default
            ;; arm), which is why the base is added under a test rather than
            ;; unconditionally. The index needs its own read because it is a
            ;; different register from both $d and $a.
            (if (i32.ge_u (local.get $kind) (global.get $TU_FIRST_SIB))
              (then
                (local.set $ea (local.get $imm))
                (if (i32.ne (local.get $a) (i32.const 0xF))
                  (then (local.set $ea (i32.add (local.get $ea) (local.get $vb)))))
                (if (i32.ne (i32.and (local.get $b) (i32.const 0xF)) (i32.const 0xF))
                  (then (local.set $ea
                    (i32.add (local.get $ea)
                      (i32.shl
                        (block $gi (result i32)
                          (block $i7 (block $i6 (block $i5 (block $i4
                          (block $i3 (block $i2 (block $i1 (block $i0
                            (br_table $i0 $i1 $i2 $i3 $i4 $i5 $i6 $i7
                                      (i32.and (local.get $b) (i32.const 0xF))))
                            (br $gi (local.get $r0))) (br $gi (local.get $r1)))
                            (br $gi (local.get $r2))) (br $gi (local.get $r3)))
                            (br $gi (local.get $r4))) (br $gi (local.get $r5)))
                            (br $gi (local.get $r6)))
                          (local.get $r7))
                        ;; Scale is TWO bits at b[5:4]. The `& 3` is load-bearing
                        ;; on exactly one kind: TU_STORE8_SIB is the only one that
                        ;; carries SIB fields AND a lane bit, and TU_B_LANE_D is
                        ;; 0x40 -- bit 6, which an unmasked `b >> 4` folds into
                        ;; the shift amount as +4. A high-byte store through an
                        ;; indexed address then writes at index<<(scale+4).
                        ;; Found by test/test-block-exec.js, which reaches the
                        ;; combination H454 has apparently never met in a
                        ;; self-loop; H458 shares this decode verbatim.
                        (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 3)))))))))

            ;; Evaluate. Every arm publishes exactly the flag fields its
            ;; scalar handler publishes, by calling the same helper -- which
            ;; is what makes the per-field join right at every instant.
            ;;
            ;; $wrote, rather than a second exit label out of the br_table:
            ;; a store is the one kind whose result does not go to a register,
            ;; and branching around the writeback from inside the table put
            ;; the branch target outside the loop body the first time this was
            ;; written -- which silently truncated every iteration at its
            ;; first store instead of failing.
            (local.set $wrote (i32.const 1))
            (block $kdone
              (block $k60
              (block $k59 (block $k58
              (block $k57 (block $k56 (block $k55 (block $k54
              (block $k53 (block $k52 (block $k51 (block $k50
              (block $k49 (block $k48 (block $k47
              (block $k46 (block $k45 (block $k44 (block $k43
              (block $k42 (block $k41 (block $k40
              (block $k39 (block $k38 (block $k37 (block $k36 (block $k35
              (block $k34 (block $k33 (block $k32 (block $k31 (block $k30
              (block $k29 (block $k28 (block $k27 (block $k26 (block $k25
              (block $k24 (block $k23 (block $k22
              (block $k21 (block $k20 (block $k19 (block $k18
              (block $k17 (block $k16 (block $k15 (block $k14
              (block $k13 (block $k12 (block $k11 (block $k10
              (block $k09 (block $k08 (block $k07 (block $k06
              (block $k05 (block $k04 (block $k03 (block $k02
              (block $k01 (block $k00
                (br_table $k00 $k01 $k02 $k03 $k04 $k05 $k06 $k07 $k08 $k09
                          $k10 $k11 $k12 $k13 $k14 $k15 $k16 $k17 $k18 $k19
                          $k20 $k21 $k22 $k23 $k24 $k25 $k26 $k27 $k28 $k29
                          $k30 $k31 $k32 $k33 $k34 $k35 $k36 $k37 $k38 $k39
                          $k40 $k41 $k42 $k43 $k44 $k45 $k46 $k47 $k48 $k49
                          $k50 $k51 $k52 $k53 $k54 $k55 $k56 $k57
                          $k58 $k59 $k60
                          $k60
                          (local.get $kind)))
                ;; 0 MOV_RR
                (local.set $vr (local.get $vb)) (br $kdone))
                ;; 1 MOV_RI
                (local.set $vr (local.get $imm)) (br $kdone))
                ;; 2 LEA_RO -- LEA never touches flags
                (local.set $vr (i32.add (local.get $vb) (local.get $imm))) (br $kdone))
                ;; 3 ADD_RR. From here to 19, the arithmetic is unconditional
                ;; and only the $set_flags_* call is gated on $nof -- the bit
                ;; the decode-time dead-flag pass set when it proved nothing
                ;; between here and the terminator reads what this would write.
                (local.set $vr (i32.add (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_add (local.get $va) (local.get $vb) (local.get $vr))))
                (br $kdone))
                ;; 4 ADD_RI
                (local.set $vr (i32.add (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_add (local.get $va) (local.get $imm) (local.get $vr))))
                (br $kdone))
                ;; 5 SUB_RR
                (local.set $vr (i32.sub (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (local.get $va) (local.get $vb) (local.get $vr))))
                (br $kdone))
                ;; 6 SUB_RI
                (local.set $vr (i32.sub (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (local.get $va) (local.get $imm) (local.get $vr))))
                (br $kdone))
                ;; 7 AND_RR
                (local.set $vr (i32.and (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 8 AND_RI
                (local.set $vr (i32.and (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 9 OR_RR
                (local.set $vr (i32.or (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 10 OR_RI
                (local.set $vr (i32.or (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 11 XOR_RR
                (local.set $vr (i32.xor (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 12 XOR_RI
                (local.set $vr (i32.xor (local.get $va) (local.get $imm)))
                (if (i32.eqz (local.get $nof)) (then (call $set_flags_logic (local.get $vr))))
                (br $kdone))
                ;; 13 INC -- preserves CF, which $set_flags_inc reads back out
                ;; of whatever really wrote it last. Skipping it when the flags
                ;; are dead also skips that $get_cf, which is the single most
                ;; expensive thing the elision removes.
                (local.set $vr (i32.add (local.get $va) (i32.const 1)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_inc (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 14 DEC
                (local.set $vr (i32.sub (local.get $va) (i32.const 1)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_dec (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 15 NEG == SUB 0, src
                (local.set $vr (i32.sub (i32.const 0) (local.get $va)))
                (if (i32.eqz (local.get $nof))
                  (then (call $set_flags_sub (i32.const 0) (local.get $va) (local.get $vr))))
                (br $kdone))
                ;; 16 NOT -- no flags, exactly as x86
                (local.set $vr (i32.xor (local.get $va) (i32.const -1))) (br $kdone))
                ;; 17 SHIFT -- $do_shift32 owns the flag contract, including
                ;; the count==0 case that writes nothing at all.
                (local.set $vr
                  (call $do_shift32 (local.get $a) (local.get $va) (local.get $imm)))
                (br $kdone))
                ;; 18 IMUL_RR. The 64-bit product exists only to decide CF/OF,
                ;; so a dead-flag IMUL drops the widening multiply as well as
                ;; the three global stores.
                (local.set $vr (i32.mul (local.get $va) (local.get $vb)))
                (if (i32.eqz (local.get $nof))
                  (then
                    (global.set $flag_op (i32.const 6))
                    (global.set $flag_sign_shift (i32.const 31))
                    (global.set $flag_b
                      (i64.ne
                        (i64.mul (i64.extend_i32_s (local.get $va))
                                 (i64.extend_i32_s (local.get $vb)))
                        (i64.extend_i32_s (local.get $vr))))
                    (global.set $flag_res (local.get $vr))))
                (br $kdone))
                ;; 19 IMUL_RI
                (local.set $vr (i32.mul (local.get $vb) (local.get $imm)))
                (if (i32.eqz (local.get $nof))
                  (then
                    (global.set $flag_op (i32.const 6))
                    (global.set $flag_sign_shift (i32.const 31))
                    (global.set $flag_b
                      (i64.ne
                        (i64.mul (i64.extend_i32_s (local.get $vb))
                                 (i64.extend_i32_s (local.get $imm)))
                        (i64.extend_i32_s (local.get $vr))))
                    (global.set $flag_res (local.get $vr))))
                (br $kdone))
                ;; 20 LOAD32
                (local.set $vr
                  (call $gl32 (i32.add (local.get $vb) (local.get $imm))))
                (br $kdone))
                ;; 21 STORE32. Writes memory, not a register, so it skips the
                ;; writeback entirely -- and it goes through $gs32, which is
                ;; what keeps SMC invalidation and page crossing identical to
                ;; the scalar path.
                (call $gs32 (i32.add (local.get $vb) (local.get $imm)) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 22 LOAD32_ABS -- the address is a decode-time constant.
                (local.set $vr (call $gl32 (local.get $imm))) (br $kdone))
                ;; 23 STORE32_ABS
                (call $gs32 (local.get $imm) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))

                ;; -- sub-register writes. Each of these computes a value at
                ;; the sub-width and then INSERTS it into the container's
                ;; local, leaving the lanes it does not cover exactly as they
                ;; were -- which is what makes a partial write expressible here
                ;; at all, and why $vr is always a full 32-bit value even when
                ;; the op wrote eight bits of it.

                ;; 24 MOV_SUB_RR -- no flags, either width.
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $sh_d))))
                (br $kdone))
                ;; 25 MOV_SUB_RI -- no flags.
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (i32.and (local.get $imm) (local.get $mask)) (local.get $sh_d))))
                (br $kdone))
                ;; 26 ALU_SUB_RR. $do_alu_sized owns the flag contract at this
                ;; width, including flag_sign_shift; CMP (7) writes no register.
                ;; With the flags dead, $tree_alu_sized_noflags computes the
                ;; same six results with the flag half removed -- and a dead
                ;; CMP becomes nothing at all, since it writes no register
                ;; either.
                (local.set $vb
                  (if (result i32) (local.get $nof)
                    (then (call $tree_alu_sized_noflags
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $mask)))
                    (else (call $do_alu_sized
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (i32.shr_u (local.get $vb) (local.get $sh_a)) (local.get $mask))
                      (local.get $mask) (local.get $ssh)))))
                (if (i32.eq (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT))
                                     (i32.const 0xF))
                            (i32.const 7))
                  (then (local.set $wrote (i32.const 0)))
                  (else (local.set $vr
                    (i32.or
                      (i32.and (local.get $va)
                        (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                      (i32.shl (local.get $vb) (local.get $sh_d))))))
                (br $kdone))
                ;; 27 ALU_SUB_RI
                (local.set $vb
                  (if (result i32) (local.get $nof)
                    (then (call $tree_alu_sized_noflags
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (local.get $imm) (local.get $mask))
                      (local.get $mask)))
                    (else (call $do_alu_sized
                      (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF))
                      (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (local.get $mask))
                      (i32.and (local.get $imm) (local.get $mask))
                      (local.get $mask) (local.get $ssh)))))
                (if (i32.eq (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT))
                                     (i32.const 0xF))
                            (i32.const 7))
                  (then (local.set $wrote (i32.const 0)))
                  (else (local.set $vr
                    (i32.or
                      (i32.and (local.get $va)
                        (i32.xor (i32.shl (local.get $mask) (local.get $sh_d)) (i32.const -1)))
                      (i32.shl (local.get $vb) (local.get $sh_d))))))
                (br $kdone))
                ;; 28 LOAD8_RO -- R8[d] = [R[a] + imm]
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (call $gl8 (i32.add (local.get $vb) (local.get $imm)))
                             (local.get $sh_d))))
                (br $kdone))
                ;; 29 STORE8_RO
                (call $gs8 (i32.add (local.get $vb) (local.get $imm))
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 30 LOAD8_ABS
                (local.set $vr
                  (i32.or
                    (i32.and (local.get $va)
                      (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                    (i32.shl (call $gl8 (local.get $imm)) (local.get $sh_d))))
                (br $kdone))
                ;; 31 STORE8_ABS
                (call $gs8 (local.get $imm)
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 32 MOVZX8_RO -- narrow read, WHOLE destination written.
                (local.set $vr (call $gl8 (i32.add (local.get $vb) (local.get $imm))))
                (br $kdone))
                ;; 33 MOVSX8_RO
                (local.set $vr
                  (call $sign_ext8 (call $gl8 (i32.add (local.get $vb) (local.get $imm)))))
                (br $kdone))
                ;; 34 LEA_SIB -- address arithmetic only, no memory and, as on
                ;; x86, no flags.
                (local.set $vr (local.get $ea)) (br $kdone))
                ;; 35 LOAD32_SIB
                (local.set $vr (call $gl32 (local.get $ea))) (br $kdone))
                ;; 36 STORE32_SIB
                (call $gs32 (local.get $ea) (local.get $va))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 37 MOVSX8_SIB
                (local.set $vr (call $sign_ext8 (call $gl8 (local.get $ea)))) (br $kdone))
                ;; 38 STORE8_SIB
                (call $gs8 (local.get $ea)
                  (i32.and (i32.shr_u (local.get $va) (local.get $sh_d)) (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 39 MOV_M8_I_SIB. The immediate rides in `b` because this
                ;; handler's operand word IS the byte.
                (call $gs8 (local.get $ea)
                  (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_IMM8_SHIFT))
                           (i32.const 0xFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 40 LOAD16_ABS -- the low half only; the top half of the
                ;; container survives, exactly as $th_mov_r16_m16 leaves it.
                (local.set $vr
                  (i32.or (i32.and (local.get $va) (i32.const 0xFFFF0000))
                          (call $gl16 (local.get $imm))))
                (br $kdone))
                ;; 41 LOAD16_RO
                (local.set $vr
                  (i32.or (i32.and (local.get $va) (i32.const 0xFFFF0000))
                          (call $gl16 (i32.add (local.get $vb) (local.get $imm)))))
                (br $kdone))
                ;; 42 STORE16_RO
                (call $gs16 (i32.add (local.get $vb) (local.get $imm))
                  (i32.and (local.get $va) (i32.const 0xFFFF)))
                (local.set $wrote (i32.const 0)) (br $kdone))
                ;; 43 ADC_RR -- $th_adc_r_r, transcribed. The CF fix-up is not
                ;; decoration: when `b + cf` wraps, the carry out is 1 no
                ;; matter what the sum says, and flag_op 8 is the raw mode that
                ;; states that without disturbing the ZF/SF the add just set.
                (local.set $beff (i32.add (local.get $vb) (call $get_cf)))
                (local.set $vr (i32.add (local.get $va) (local.get $beff)))
                (call $set_flags_add (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $vb))
                  (then (global.set $flag_op (i32.const 8))
                        (global.set $flag_a (i32.const 1))
                        (global.set $flag_b (i32.const 0))))
                (br $kdone))
                ;; 44 ADC_RI
                (local.set $beff (i32.add (local.get $imm) (call $get_cf)))
                (local.set $vr (i32.add (local.get $va) (local.get $beff)))
                (call $set_flags_add (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $imm))
                  (then (global.set $flag_op (i32.const 8))
                        (global.set $flag_a (i32.const 1))
                        (global.set $flag_b (i32.const 0))))
                (br $kdone))
                ;; 45 SBB_RR -- the borrow twin, which fixes flag_a/flag_b only.
                (local.set $beff (i32.add (local.get $vb) (call $get_cf)))
                (local.set $vr (i32.sub (local.get $va) (local.get $beff)))
                (call $set_flags_sub (local.get $va) (local.get $beff) (local.get $vr))
                (if (i32.lt_u (local.get $beff) (local.get $vb))
                  (then (global.set $flag_a (i32.const 0))
                        (global.set $flag_b (i32.const 1))))
                (br $kdone))
              ;; 46 SBB_RI
              (local.set $beff (i32.add (local.get $imm) (call $get_cf)))
              (local.set $vr (i32.sub (local.get $va) (local.get $beff)))
              (call $set_flags_sub (local.get $va) (local.get $beff) (local.get $vr))
              (if (i32.lt_u (local.get $beff) (local.get $imm))
                (then (global.set $flag_a (i32.const 0))
                      (global.set $flag_b (i32.const 1))))
              (br $kdone))
              ;; 47 EA_SIB -- the address is already in $ea (the hoist above
              ;; computed it, since this kind is in the SIB range). Park it for
              ;; the next micro-op and write no register: this op is not an
              ;; instruction, it is half of one.
              (local.set $ea_hold (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 48 EA_SIB_LD8 (and the unreachable default) -- the same EA,
              ;; plus the byte load H149's operand bit 8 fused into it. The
              ;; insert is the ordinary sub-register one, so AH..BH land in
              ;; bits 8..15 of their container exactly as $set_reg8 puts them.
              (local.set $ea_hold (local.get $ea))
              (local.set $vr
                (i32.or
                  (i32.and (local.get $va)
                    (i32.xor (i32.shl (i32.const 0xFF) (local.get $sh_d)) (i32.const -1)))
                  (i32.shl (call $gl8 (local.get $ea)) (local.get $sh_d))))
              (br $kdone))
              ;; 49 REP_STR. Publish, call the
              ;; interpreter's own body, reload. The publish has to be all
              ;; eight and not just ESI/EDI/ECX/EAX: $gs8/$gl8 reach
              ;; $invalidate_code_write and the page compiler, and a fault
              ;; path reads the register file to build its report, so leaving
              ;; a stale global behind would be visible from inside the call.
              (i32.store offset=0 (global.get $reg_base) (local.get $r0))
              (i32.store offset=4 (global.get $reg_base) (local.get $r1))
              (i32.store offset=8 (global.get $reg_base) (local.get $r2))
              (i32.store offset=12 (global.get $reg_base) (local.get $r3))
              (i32.store offset=16 (global.get $reg_base) (local.get $r4))
              (i32.store offset=20 (global.get $reg_base) (local.get $r5))
              (i32.store offset=24 (global.get $reg_base) (local.get $r6))
              (i32.store offset=28 (global.get $reg_base) (local.get $r7))
              (block $rdone
                (block $r3b (block $r2b (block $r1b (block $r0b
                  (br_table $r0b $r1b $r2b $r3b $r3b (local.get $d)))
                  (call $rep_movsb_do) (br $rdone))
                  (call $rep_movsd_do) (br $rdone))
                  (call $rep_stosb_do) (br $rdone))
                (call $rep_stosd_do))
              (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
              (local.set $r1 (i32.load offset=4 (global.get $reg_base)))
              (local.set $r2 (i32.load offset=8 (global.get $reg_base)))
              (local.set $r3 (i32.load offset=12 (global.get $reg_base)))
              (local.set $r4 (i32.load offset=16 (global.get $reg_base)))
              (local.set $r5 (i32.load offset=20 (global.get $reg_base)))
              (local.set $r6 (i32.load offset=24 (global.get $reg_base)))
              (local.set $r7 (i32.load offset=28 (global.get $reg_base)))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 50 X87_MEM -- absolute (or H149-paired) address. The hoisted
              ;; $ea is already the address: `a` is 0xF so no base was added
              ;; and the SIB index nibble is 0xF so no index was, leaving the
              ;; immediate the TU_B_EA select above may have replaced with
              ;; $ea_hold. $fpu_exec_mem is the same function $th_fpu_mem
              ;; calls with the same two nibbles, so the load width, the
              ;; push/pop, the tag word and every sticky bit in $fpu_sw are
              ;; the interpreter's, not this family's.
              (call $fpu_exec_mem
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 51 X87_MRO -- base+disp. $ea is R[a] + imm, computed from the
              ;; register LOCAL; the scalar H190 pays a $get_reg for the same
              ;; number. Identical call otherwise.
              (call $fpu_exec_mem
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (local.get $ea))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 52 X87_REG -- no memory and no general register at all. The
              ;; accepted set excludes FCMOVcc and FCOMI/FUCOMI, so nothing
              ;; here reads or writes a lazy-flag field and the dead-flag
              ;; pass's model stays complete.
              (call $fpu_exec_reg
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_GROUP_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_REG_SHIFT))
                         (i32.const 0xF))
                (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_X87_RM_SHIFT))
                         (i32.const 0xF)))
              (local.set $wrote (i32.const 0))
              (br $kdone))
              ;; 53 FNSTSW AX (and the unreachable default). The one x87 op
              ;; that writes a general register, so EAX round-trips through
              ;; the global the way TU_REP_STR round-trips all eight -- the
              ;; interpreter's arm reads $eax to preserve its top half and
              ;; writes the status word into the bottom, and reproducing that
              ;; here would be a second copy of it. Only EAX needs publishing:
              ;; DF E0 reads and writes nothing else.
              (i32.store offset=0 (global.get $reg_base) (local.get $r0))
              (call $fpu_exec_reg (i32.const 7) (i32.const 4) (i32.const 0))
              (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 54 PUSH_R. ESP is r4, a local, so the whole push is register
              ;; arithmetic plus one $gs32. `push esp` pushes the OLD esp, which
              ;; is already what $va holds.
              (local.set $r4 (i32.sub (local.get $r4) (i32.const 4)))
              (call $gs32 (local.get $r4) (local.get $va))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 55 POP_R. The writeback runs after the ESP adjustment, so
              ;; `pop esp` lands the loaded value and not the incremented one --
              ;; which is what the architecture says.
              (local.set $vr (call $gl32 (local.get $r4)))
              (local.set $r4 (i32.add (local.get $r4) (i32.const 4)))
              (br $kdone))

              ;; 56 PUSH_I
              (local.set $r4 (i32.sub (local.get $r4) (i32.const 4)))
              (call $gs32 (local.get $r4) (local.get $imm))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 57 FALLBACK -- run the op's real handler. Identical to
              ;; $th_block_exec's arm 57, and it has to be: the spill is the
              ;; publish-before-trap guarantee, and every reason given there
              ;; ($gs*/$gl* reach $invalidate_code_write and the page
              ;; compiler, a fault path reads the register file to build its
              ;; report, every --trace-* formatter reads the globals) holds
              ;; here word for word.
              ;;
              ;; a carries the handler index, imm the handler's own operand
              ;; word, and b the byte offset of this op's inline words in the
              ;; trailing fallback pool.
              (i32.store offset=0 (global.get $reg_base) (local.get $r0))
              (i32.store offset=4 (global.get $reg_base) (local.get $r1))
              (i32.store offset=8 (global.get $reg_base) (local.get $r2))
              (i32.store offset=12 (global.get $reg_base) (local.get $r3))
              (i32.store offset=16 (global.get $reg_base) (local.get $r4))
              (i32.store offset=20 (global.get $reg_base) (local.get $r5))
              (i32.store offset=24 (global.get $reg_base) (local.get $r6))
              (i32.store offset=28 (global.get $reg_base) (local.get $r7))
              ;; The H149 pair, both directions: a native producer parks its
              ;; address in $ea_hold, a LOCAL, and a consumer that fell back
              ;; reads the $ea_temp GLOBAL instead -- and a producer can fall
              ;; back too, with a native consumer reading $ea_hold after it.
              (global.set $ea_temp (local.get $ea_hold))
              (global.set $ip (i32.add (local.get $fbp) (local.get $b)))
              (call_indirect (type $handler_t)
                (local.get $imm) (local.get $a))
              (local.set $ea_hold (global.get $ea_temp))
              (local.set $r0 (i32.load offset=0 (global.get $reg_base)))
              (local.set $r1 (i32.load offset=4 (global.get $reg_base)))
              (local.set $r2 (i32.load offset=8 (global.get $reg_base)))
              (local.set $r3 (i32.load offset=12 (global.get $reg_base)))
              (local.set $r4 (i32.load offset=16 (global.get $reg_base)))
              (local.set $r5 (i32.load offset=20 (global.get $reg_base)))
              (local.set $r6 (i32.load offset=24 (global.get $reg_base)))
              (local.set $r7 (i32.load offset=28 (global.get $reg_base)))
              (local.set $n_fb (i32.add (local.get $n_fb) (i32.const 1)))
              (global.set $block_exec_last_fallback_fn (local.get $a))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 58 CMP_RR -- flags of R[d] - R[a], no register written. The
              ;; same $set_flags_sub $th_cmp_r_r calls, on the same two values.
              (if (i32.eqz (local.get $nof))
                (then (call $set_flags_sub (local.get $va) (local.get $vb)
                        (i32.sub (local.get $va) (local.get $vb)))))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 59 CMP_RI
              (if (i32.eqz (local.get $nof))
                (then (call $set_flags_sub (local.get $va) (local.get $imm)
                        (i32.sub (local.get $va) (local.get $imm)))))
              (local.set $wrote (i32.const 0))
              (br $kdone))

              ;; 60 X87RUN (and the unreachable default) -- a FUSED x87 run,
              ;; H449..H453, called as the body it is rather than routed
              ;; through the trampoline. Identical to $th_block_exec's arm 60;
              ;; see there for why the publish is the d mask alone, why there
              ;; is no reload, and why $ea_temp moves one way only.
              (if (i32.and (local.get $d) (i32.const 0x01)) (then (i32.store offset=0 (global.get $reg_base) (local.get $r0))))
              (if (i32.and (local.get $d) (i32.const 0x02)) (then (i32.store offset=4 (global.get $reg_base) (local.get $r1))))
              (if (i32.and (local.get $d) (i32.const 0x04)) (then (i32.store offset=8 (global.get $reg_base) (local.get $r2))))
              (if (i32.and (local.get $d) (i32.const 0x08)) (then (i32.store offset=12 (global.get $reg_base) (local.get $r3))))
              (if (i32.and (local.get $d) (i32.const 0x10)) (then (i32.store offset=16 (global.get $reg_base) (local.get $r4))))
              (if (i32.and (local.get $d) (i32.const 0x20)) (then (i32.store offset=20 (global.get $reg_base) (local.get $r5))))
              (if (i32.and (local.get $d) (i32.const 0x40)) (then (i32.store offset=24 (global.get $reg_base) (local.get $r6))))
              (if (i32.and (local.get $d) (i32.const 0x80)) (then (i32.store offset=28 (global.get $reg_base) (local.get $r7))))
              (global.set $ea_temp (local.get $ea_hold))
              (global.set $ip (i32.add (local.get $fbp) (local.get $b)))
              (call $x87_run_body (local.get $a) (local.get $imm))
              (global.set $block_exec_last_fallback_fn (local.get $a))
              (local.set $wrote (i32.const 0)))
            ;; Writeback R[d], fifteen arms as above.
            (if (local.get $wrote)
              (then
                (block $sdone
                (block $s14 (block $s13 (block $s12 (block $s11 (block $s10
                (block $s9 (block $s8
                (block $s7 (block $s6 (block $s5 (block $s4
                (block $s3 (block $s2 (block $s1 (block $s0
                  (br_table $s0 $s1 $s2 $s3 $s4 $s5 $s6 $s7
                            $s8 $s9 $s10 $s11 $s12 $s13 $s14
                            $s14 (local.get $d)))
                  (local.set $r0 (local.get $vr)) (br $sdone))
                  (local.set $r1 (local.get $vr)) (br $sdone))
                  (local.set $r2 (local.get $vr)) (br $sdone))
                  (local.set $r3 (local.get $vr)) (br $sdone))
                  (local.set $r4 (local.get $vr)) (br $sdone))
                  (local.set $r5 (local.get $vr)) (br $sdone))
                  (local.set $r6 (local.get $vr)) (br $sdone))
                  (local.set $r7 (local.get $vr)) (br $sdone))
                  (local.set $r8 (local.get $vr)) (br $sdone))
                  (local.set $r9 (local.get $vr)) (br $sdone))
                  (local.set $r10 (local.get $vr)) (br $sdone))
                  (local.set $r11 (local.get $vr)) (br $sdone))
                  (local.set $r12 (local.get $vr)) (br $sdone))
                  (local.set $r13 (local.get $vr)) (br $sdone))
                (local.set $r14 (local.get $vr)))))
            (br $body)))
    ;; Exit. A threaded tail publishes all eight unconditionally: the next op
    ;; in the stream is the block's own terminator, which may read anything.
    (i32.store offset=0 (global.get $reg_base) (local.get $r0))
    (i32.store offset=4 (global.get $reg_base) (local.get $r1))
    (i32.store offset=8 (global.get $reg_base) (local.get $r2))
    (i32.store offset=12 (global.get $reg_base) (local.get $r3))
    (i32.store offset=16 (global.get $reg_base) (local.get $r4))
    (i32.store offset=20 (global.get $reg_base) (local.get $r5))
    (i32.store offset=24 (global.get $reg_base) (local.get $r6))
    (i32.store offset=28 (global.get $reg_base) (local.get $r7))
    ;; The H149 pair: a native producer parked its address in a local nothing
    ;; outside this frame can see, and the consumer may be the first op after
    ;; the block.
    (global.set $ea_temp (local.get $ea_hold))

    ;; The same counters the general function keeps, so a histogram or a
    ;; --block-exec-stats line reads the same whichever entry point ran the
    ;; descriptor -- plus one that says which did.
    (global.set $tree_fold_iters
      (i64.add (global.get $tree_fold_iters) (i64.const 1)))
    (global.set $tree_fold_ops
      (i64.add (global.get $tree_fold_ops) (i64.extend_i32_u (local.get $cost))))
    (global.set $block_exec_runs
      (i32.add (global.get $block_exec_runs) (i32.const 1)))
    (global.set $block_exec_leaf_fb_runs
      (i32.add (global.get $block_exec_leaf_fb_runs) (i32.const 1)))
    ;; The native/fallback split, exactly as $th_block_exec keeps it, so
    ;; "ops native" and native% read the same whichever entry point ran the
    ;; descriptor.
    (global.set $block_exec_native_ops
      (i64.add (global.get $block_exec_native_ops)
        (i64.extend_i32_u (i32.sub (local.get $nuops) (local.get $n_fb)))))
    (global.set $block_exec_fallback_ops
      (i64.add (global.get $block_exec_fallback_ops)
        (i64.extend_i32_u (local.get $n_fb))))
    ;; Coverage by region size, index 1: one block, every time.
    (local.set $ea (call $bx_rg_word
      (i32.add (global.get $BX_RG_ENTN_OFF) (i32.const 1))))
    (i32.store (local.get $ea) (i32.add (i32.load (local.get $ea)) (i32.const 1)))
    (local.set $ea (call $bx_rg_word
      (i32.add (global.get $BX_RG_OPSN_OFF) (i32.const 2))))
    (i64.store (local.get $ea)
      (i64.add (i64.load (local.get $ea)) (i64.extend_i32_u (local.get $nuops))))

    ;; Pacing, settled once. $next already billed one step for the dispatch
    ;; that entered here, so charge the rest: the cost guest steps this block
    ;; stands for, plus what the fallbacks actually spent, measured as the
    ;; drop in the parked counter. $block_budget is untouched -- $run already
    ;; billed the one block, and there is only one.
    (local.set $fb_used (i32.sub (i32.const 0x100000) (global.get $steps)))
    (global.set $steps
      (i32.sub (local.get $steps_in)
        (i32.sub (i32.add (local.get $cost) (local.get $fb_used))
                 (i32.const 1))))

    ;; The terminator is the next op in the stream. If $steps went non-positive
    ;; above, $next takes the ordinary out-of-steps path and parks $resume_ip
    ;; here -- a real op boundary with every register published.
    (call $bx_tail_note (local.get $tail_ip))
    (global.set $ip (local.get $tail_ip))
    (dispatch-next))

