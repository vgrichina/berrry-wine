'use strict';

// Exit-only diagnostics for CLI experiments; kept off the runner's hot path.
function reportExperiments({ BLOCK_EXEC, BLOCK_EXEC_STATS, BLOCK_CHAIN, TRACE_LOOPMATCH, LOOPMATCH_STATS, X87_FUSION, VERBOSE }, instance, threadManager, log = console.log) {
  if ((BLOCK_EXEC || BLOCK_EXEC_STATS) && instance.exports.get_block_exec_runs) {
    // Per instance, because a worker thread is its own module instance with
    // its own decoder and its own counters -- a main-only read reports zero
    // for an app whose hot code runs on a worker.
    const bxReport = (label, e) => {
      if (!e || !e.get_block_exec_runs) return;
      const nat = e.get_block_exec_native_ops();
      const fb = e.get_block_exec_fallback_ops();
      const tot = nat + fb;
      // The share served in-loop IS the fraction of the dispatch/register
      // ceiling this build collects. `lastFallbackFn` names the handler
      // family to migrate next; `declWhy` is why the most recent block was
      // refused (1 short, 2 poisoned/16-bit/fault-null, 3 unsafe op,
      // 4 past the emit slack, 5 past the classify scratch).
      // `entries` and `transfersSaved` are the two terms of the cost model:
      // one region entry is paid per run and one block transfer is saved per
      // interior edge, so a ns/entry-vs-ns/op fit falls straight out of these
      // four numbers and the run's user CPU. Nothing else records a saved
      // transfer -- a folded edge leaves no trace in the handler histogram.
      const ts = e.get_block_exec_transfers_saved
        ? e.get_block_exec_transfers_saved() : 0n;
      // Round 16: how the entries split between the one-block leaf (H463) and
      // the general executor (H458). `entries` counts both, so the second
      // number is `entries - leaf` and it is the region / fallback-carrying /
      // folded-terminator population -- the part the leaf's contract excludes.
      const leafRuns = e.get_block_exec_leaf_runs
        ? e.get_block_exec_leaf_runs() : 0;
      // Round 17: the leaf FAMILY is two entry points now. `leafEntries` stays
      // the pure leaf so the round-16 numbers remain comparable; `leafFbEntries`
      // is H464, and `genEntries` is what is left on the general region
      // function -- which is the number round 17 exists to drive down.
      const leafFbRuns = e.get_block_exec_leaf_fb_runs
        ? e.get_block_exec_leaf_fb_runs() : 0;
      log(`block-exec: ${label} armed`, e.get_block_exec() ? 'yes' : 'no',
        'installs', e.get_block_exec_installs(),
        'declines', e.get_block_exec_declines(),
        'entries', e.get_block_exec_runs(),
        'leafEntries', leafRuns,
        'leafFbEntries', leafFbRuns,
        'genEntries', e.get_block_exec_runs() - leafRuns - leafFbRuns,
        'ops native', String(nat), 'fallback', String(fb),
        'native%', tot > 0n ? (Number(nat * 10000n / tot) / 100).toFixed(2) : '-',
        'transfersSaved', String(ts),
        'lastFallbackFn', e.get_block_exec_last_fallback_fn(),
        'declWhy', e.get_block_exec_decl_why());
      // Round 11's decode-time pass, one line per instance. `before`/`after`
      // are micro-ops in every descriptor this instance built, counted at the
      // moment the pass started and the moment it finished, so `after-before`
      // is the net change and the per-transform counters say where it came
      // from. The split ADDS a micro-op each time it fires (one memory op
      // becomes a load plus a register op), so `after` can exceed `before`
      // while the pass is still doing its job -- read `split` against `rle`
      // and `movelim`, which are the two that delete. `stlf` is structurally
      // zero: store-to-load forwarding was removed as unsound (the $g2w NULL
      // sentinel makes a store-then-load of an unmapped address read 0, not
      // the stored value), and the counter is kept so a future attempt cannot
      // silently reuse the name. `immfold` is a MOV r,r whose source held a
      // known constant rewritten to MOV r,imm.
      if (e.get_bx_pass_uops_before) {
        const bef = e.get_bx_pass_uops_before();
        const aft = e.get_bx_pass_uops_after();
        const sp = e.get_bx_pass_split();
        // `before` is counted at pass ENTRY, and the split already fired by
        // then (it runs in the classify scan, not in the pass), so
        // `before - split` is the descriptor size the same run would have
        // built with --no-block-exec-split. `netVsOff%` is that comparison and
        // is the number to quote against §8's predicted removable share;
        // `delta%` only prices the three transforms inside the pass proper.
        const off = bef - sp;
        log(`block-exec-split: ${label} armed`,
          e.get_block_exec_split() ? 'yes' : 'no',
          'uopsBefore', String(bef), 'uopsAfter', String(aft),
          'delta', String(aft - bef),
          'delta%', bef > 0n ? (Number((aft - bef) * 10000n / bef) / 100).toFixed(2) : '-',
          'uopsSplitOff', String(off),
          'netVsOff%', off > 0n ? (Number((aft - off) * 10000n / off) / 100).toFixed(2) : '-',
          'split', String(e.get_bx_pass_split()),
          'rle', String(e.get_bx_pass_rle()),
          'stlf', String(e.get_bx_pass_stlf()),
          'movelim', String(e.get_bx_pass_movelim()),
          'immfold', String(e.get_bx_pass_immfold()),
          // Round 12: x87 micro-ops accepted as fallbacks instead of
          // declining the whole block. One per FUSED region (H449-H453) or
          // per bare x87 op, so it counts descriptor entries and not guest
          // x87 instructions -- a single `x87` here can stand for a run of
          // 255.
          'x87', e.get_bx_x87_uops ? String(e.get_bx_x87_uops()) : '-',
          // Round 15 section 24. `x87run` is the share of `x87` that went in
          // as the CHEAP kind (TU_X87RUN -- the fused body called directly,
          // partial publish, no trampoline); `x87 - x87run` is the residue
          // still paying one. `x87native` is separate and counts BARE
          // H188-H190 that became one of 07b's own native x87 micro-ops
          // instead of a fallback -- those are real saved dispatches and are
          // inside `opsNative`, which the other two are not.
          'x87run', e.get_bx_x87run_uops ? String(e.get_bx_x87run_uops()) : '-',
          'x87native',
            e.get_bx_x87_native_uops ? String(e.get_bx_x87_native_uops()) : '-',
          // Round 12 section 18: the cross-edge carry. `carryRle` is the share
          // of `rle` that the carry itself found -- a load killed inside its
          // own block is not one of these. `carryEdges` / `carryRefused` split
          // every non-head member of every emitted region into "seeded from
          // its one predecessor" and "not", so refused is the headroom a
          // per-member fact table would reach.
          'carryRle', e.get_bx_pass_carry_rle ? String(e.get_bx_pass_carry_rle()) : '-',
          'carryEdges', e.get_bx_carry_edges ? String(e.get_bx_carry_edges()) : '-',
          'carryRefused', e.get_bx_carry_refused ? String(e.get_bx_carry_refused()) : '-',
          // Round 12 section 19: how many of `split` were READ-MODIFY-WRITE
          // forms, which produce three micro-ops instead of two. Each one is a
          // TU_FALLBACK that no longer happens, so read it beside the
          // block-exec line's `fallback` column, not beside the uop counts.
          'rmw', e.get_bx_pass_rmw ? String(e.get_bx_pass_rmw()) : '-');
      }
      // The multi-block matcher's own line. `ops by N` is the coverage split
      // the census is compared against: N=1 is a plain block, N>=2 is a region
      // the one-block matcher could never have built. It is a count of
      // micro-ops retired inside a descriptor of that size, so it is directly
      // comparable with the [handler-hist] total for the same window.
      if (!e.get_block_exec_region_installs) return;
      const byN = [];
      let opsMulti = 0n; let ops1 = 0n; let entMulti = 0;
      for (let n = 1; n <= 16; n += 1) {
        const o = e.get_block_exec_ops_by_n(n);
        const ent = e.get_block_exec_entries_by_n(n);
        const inst = e.get_block_exec_region_hist(n);
        if (o || ent || inst) byN.push(`${n}:${o}/${ent}/${inst}`);
        if (n === 1) ops1 += o; else { opsMulti += o; entMulti += ent; }
      }
      log(`block-exec-regions: ${label}`,
        'armed', e.get_block_exec_regions() ? 'yes' : 'no',
        'installs', e.get_block_exec_region_installs(),
        'declines', e.get_block_exec_region_declines(),
        'meanBlocks',
        e.get_block_exec_region_installs()
          ? (e.get_block_exec_region_blocks() / e.get_block_exec_region_installs()).toFixed(2)
          : '-',
        'thrashRefusals', e.get_block_exec_region_thrash(),
        'why', e.get_block_exec_region_why(),
        'ops1', String(ops1), 'opsMulti', String(opsMulti),
        'entriesMulti', entMulti);
      // ops/entries/installs per N. Read it as "what shapes does this app
      // actually have", not as a ranking: one 16-block region entered a
      // million times outweighs a thousand 2-block ones.
      log(`block-exec-regions: ${label} byN(ops/entries/installs)`,
        byN.join(' '));
      // Discovery cost, the round-10 number. `blocks` is $decode_block calls
      // the walker made and `uops` the micro-ops it classified; both divided by
      // installs is what the design doc quotes as cost per install, and the
      // same blocks figure against the run's total decodes is the share of
      // decode time discovery is responsible for.
      if (e.get_block_exec_walk_attempts) {
        const att = e.get_block_exec_walk_attempts();
        const ins = e.get_block_exec_walk_installs();
        const blk = e.get_block_exec_walk_blocks();
        const uop = e.get_block_exec_walk_uops();
        log(`block-exec-regions: ${label} discovery`,
          'probes', e.get_block_exec_walk_probes(),
          'attempts', att,
          'installs', ins,
          'memoRefusals', e.get_block_exec_walk_memo(),
          'reanchorHints', e.get_block_exec_walk_reanchors
            ? e.get_block_exec_walk_reanchors() : 0,
          'blocksVisited', String(blk),
          'uopsVisited', String(uop),
          'blocksPerInstall', ins ? (Number(blk) / ins).toFixed(1) : '-',
          'uopsPerInstall', ins ? (Number(uop) / ins).toFixed(1) : '-');
      }
      // Round 16 (section 26). The seam between the two families. A walk that
      // cannot READ a successor turns it into an exit (`uncached`); when the
      // reason is a one-block descriptor standing there with no copy of the
      // stream it displaced, the walk takes the descriptor back (`rawWants`)
      // and the whole attempt fails. `descNoCopy` is how many one-block
      // installs published without that copy, which is the cause of both --
      // and it rises whenever a one-block lever makes descriptors bigger.
      if (e.get_block_exec_walk_uncached) {
        log(`block-exec-regions: ${label} seam`,
          'uncached', e.get_block_exec_walk_uncached(),
          'rawWants', e.get_block_exec_raw_wants(),
          'descNoCopy', e.get_block_exec_desc_nocopy(),
          'regionNoCopy', e.get_block_exec_rg_nocopy(),
          'noRoom', e.get_block_exec_no_room(),
          'nrBytes', e.get_block_exec_rg_nr_bytes ? e.get_block_exec_rg_nr_bytes() : '-',
          'nrArena', e.get_block_exec_rg_nr_arena ? e.get_block_exec_rg_nr_arena() : '-',
          'nrChunkFull', e.get_block_exec_rg_nr_fit ? e.get_block_exec_rg_nr_fit() : '-',
          // Round 17, section 27.2. `descChunkFull` is the page-level counter
          // ($page_desc_chunk_full: a publish that did not fit), and
          // `rgReserveDeclines` is how many ONE-BLOCK installs the region
          // reserve turned away that the bare chunk would have taken -- the
          // one number that says whether the policy is doing anything.
          'descChunkFull', e.get_page_desc_chunk_full
            ? e.get_page_desc_chunk_full() : '-',
          'rgReserve', e.get_page_desc_rg_reserve
            ? e.get_page_desc_rg_reserve() : '-',
          'rgReserveDeclines', e.get_page_desc_reserve_declines
            ? e.get_page_desc_reserve_declines() : '-',
          'headWasDesc', e.get_block_exec_rg_head_desc
            ? e.get_block_exec_rg_head_desc() : '-',
          'headWasDescFailed', e.get_block_exec_rg_head_desc_fail
            ? e.get_block_exec_rg_head_desc_fail() : '-',
          'memoLocked', e.get_block_exec_memo_locked
            ? e.get_block_exec_memo_locked() : '-',
          'x87Regions', e.get_block_exec_rg_x87_regions
            ? e.get_block_exec_rg_x87_regions() : '-',
          'rgX87run', e.get_block_exec_rg_x87run
            ? String(e.get_block_exec_rg_x87run()) : '-',
          'rgX87native', e.get_block_exec_rg_x87_native
            ? String(e.get_block_exec_rg_x87_native()) : '-',
          'rgX87fb', e.get_block_exec_rg_x87_fb
            ? String(e.get_block_exec_rg_x87_fb()) : '-');
      }
      if (e.get_block_exec_region_why_n) {
        const WHY = [null, 'notWorthIt', 'exitsFull', 'noRoom', 'thrash',
          'publishRefused', 'shortChain', 'memberDeclined', 'walkBudget',
          'memoised'];
        const why = [];
        for (let w = 1; w <= 9; w += 1) {
          const c = e.get_block_exec_region_why_n(w);
          if (c) why.push(`${WHY[w]}=${c}`);
        }
        log(`block-exec-regions: ${label} declinedBy`, why.join(' ') || 'none');
      }
      if (e.get_block_exec_region_cfail) {
        const CF = ['notContiguous', 'blockCap', 'poison', 'classify'];
        const cf = [];
        for (let s = 0; s < 8; s += 1) {
          const c = e.get_block_exec_region_cfail(s);
          if (c) cf.push(`${s < 4 ? 'head' : 'tail'}.${CF[s % 4]}=${c}`);
        }
        log(`block-exec-regions: ${label} chainEndedBy`, cf.join(' ') || 'none');
      }
      if (e.get_block_exec_region_nofit) {
        const NF = [null, 'empty', 'byteFusedJcc', 'noFlagProducer', 'termNotModelled',
          'uopsFull', 'unsafeOp', 'fbPoolFull', 'trailingEaSib'];
        const nf = [];
        for (let r = 1; r <= 8; r += 1) {
          const c = e.get_block_exec_region_nofit(r);
          if (c) nf.push(`${NF[r]}=${c}`);
        }
        log(`block-exec-regions: ${label} classifyRefused`, nf.join(' ') || 'none');
      }
      // Round 18, design doc section 28. `refusals` is every termNotModelled
      // seen inside a walk and `admitted` how many of those became term_kind
      // 10 members; `wouldAdmit`/`wouldGrow` are the census's UPPER BOUND --
      // walks that a side-exiting member could have turned into a region, or
      // grown -- and they are counted with the switch off as well, which is
      // what makes the off arm the "before" measurement.
      if (e.get_block_exec_tail_refusals) {
        log(`block-exec-regions: ${label} tailExits`,
          'on', e.get_block_exec_tail_exits(),
          'refusals', String(e.get_block_exec_tail_refusals()),
          'admitted', String(e.get_block_exec_tail_admitted()),
          'regions', e.get_block_exec_tail_regions(),
          'members', e.get_block_exec_tail_members(),
          'runs', e.get_block_exec_tail_exit_runs(),
          'wouldAdmit', e.get_block_exec_tail_would_admit(),
          'wouldGrow', e.get_block_exec_tail_would_grow(),
          'lastNo', e.get_block_exec_tail_norm());
      }
    };
    bxReport('M ', instance.exports);
    if (threadManager) {
      for (const [, t] of threadManager.threads) {
        if (t.instance) bxReport(`T${t.tid}`, t.instance.exports);
      }
    }
  }

  // Block chaining (docs/block-chaining-design.md). Printed in BOTH arms, so
  // the off arm's `branchEnd` is the denominator the round's gate is stated
  // against: `hits` is transfers that never reached $branch_end at all, and
  // `branchEnd` is every entry to it, chained-terminator or not. `slow` is the
  // subset of $branch_end entries that came from a chainable terminator, which
  // is what says whether a low hit rate is "not chained yet" or "not chainable".
  if ((BLOCK_CHAIN || VERBOSE) && instance.exports.get_branch_end_calls) {
    const chainReport = (label, e) => {
      if (!e || !e.get_branch_end_calls) return;
      const hits = e.get_chain_hits();
      const be = e.get_branch_end_calls();
      const transfers = hits + be;
      log(`chain: ${label} armed`, e.get_block_chain() ? 'yes' : 'no',
        'hits', String(hits),
        'slow', String(e.get_chain_slow()),
        'branchEnd', String(be),
        'chained%', transfers > 0n
          ? (Number(hits * 10000n / transfers) / 100).toFixed(2) : '-',
        'patches', e.get_chain_patches(),
        'epochBumps', e.get_chain_bumps(),
        'epoch', e.get_chain_epoch(),
        // The third population, and the reason a chained% below 100 is not a
        // miss rate: an adjacent fall-through never reaches either desk.
        'adjacent', e.get_page_ft ? e.get_page_ft() : '-',
        'ftMissed', e.get_page_ft_missed ? e.get_page_ft_missed() : '-');
      // Round 19: the anchor-location split, and with it the executor-exit
      // half of the round's gate. A threaded op executing out of a page's
      // DESCRIPTOR chunk can only be a block-executor tail, so `poolHits` is
      // "executor exits that chained" and `tailExits` (counted inside the
      // executor itself) is the denominator. `poolDesk` is the same population
      // measured from the desk side and is a superset of `poolSlow`: a tail
      // whose terminator has no spare operand word never enters $chain_end.
      if (e.get_chain_hits_pool) {
        const tails = e.get_block_exec_tail_exit_count ? e.get_block_exec_tail_exit_count() : 0n;
        const chainable = e.get_block_exec_tail_chainable ? e.get_block_exec_tail_chainable() : 0n;
        const ph = e.get_chain_hits_pool();
        log(`chain: ${label} pool hits`, String(ph),
          'slow', String(e.get_chain_slow_pool()),
          'patches', e.get_chain_patches_pool(),
          'tailExits', String(tails),
          'tailChained%', tails > 0n
            ? (Number(ph * 10000n / tails) / 100).toFixed(2) : '-',
          // The honest denominator: a tail whose copied terminator is a ret, a
          // call, a generic Jcc or $th_block_end has no operand word to hold a
          // chain slot, so it can never be chained however the anchor rule is
          // widened. `chainableTails` is the subset that can be.
          'chainableTails', String(chainable),
          'ofChainable%', chainable > 0n
            ? (Number(ph * 10000n / chainable) / 100).toFixed(2) : '-',
          'poolDesk', String(e.get_branch_end_pool()),
          'refuseTgt', e.get_chain_refuse_target(),
          'refuseAnc', e.get_chain_refuse_anchor(),
          'staleRegs', String(e.get_chain_stale_regs()));
      }
    };
    chainReport('M ', instance.exports);
    if (threadManager) {
      for (const [, t] of threadManager.threads) {
        if (t.instance) chainReport(`T${t.tid}`, t.instance.exports);
      }
    }
  }

  if ((TRACE_LOOPMATCH || LOOPMATCH_STATS) && instance.exports.get_loop_selfloop_blocks) {
    // Each worker thread is its own WASM instance with its own decoder and its
    // own counters, so a main-only read reports zero for an app whose hot code
    // runs on a worker (Liquid War parks main in WaitForSingleObject at boot).
    const report = (label, e) => {
      if (!e || !e.get_loop_selfloop_blocks) return;
      log(`loopmatch: ${label} self-loop blocks decoded`,
        e.get_loop_selfloop_blocks(), 'matched', e.get_loop_matched_blocks());
      if (e.get_loop_lut_runs) {
        log(`loopmatch: ${label} bounded LUT matches`,
          e.get_loop_lut_bounded_matches(), 'runs', e.get_loop_lut_runs(),
          'bytes', String(e.get_loop_lut_bytes()));
      }
      if (e.get_tree_fold_runs) {
        // `matches` is blocks the predicate accepted, counted even with the
        // gate off; `runs` is entries into the super-op; `iters` is guest
        // iterations executed inside it; `ops` is the guest ops those
        // iterations stand for -- that last one is the number to compare
        // against a --handler-hist total to get the share of work caught.
        log(`loopmatch: ${label} TREE_FOLD blocks`,
          e.get_tree_fold_matches(), 'armed', e.get_tree_fold() ? 'yes' : 'no',
          'runs', e.get_tree_fold_runs(),
          'iters', String(e.get_tree_fold_iters()),
          'ops', String(e.get_tree_fold_ops()),
          // Micro-ops whose $set_flags_* call the dead-flag pass removed,
          // summed over every lowering. Decode-time, so it says how much of
          // the folded CODE was flag-dead, not how hot that code was.
          'deadflag', e.get_tree_fold_dead_flag_ops
            ? e.get_tree_fold_dead_flag_ops() : 0);
        // The decline split. A match rate alone cannot say what to widen; this
        // names the barrier, and `lastFn` names one handler that hit it.
        log(`loopmatch: ${label} TREE_FOLD declines short`,
          e.get_tree_decl_short(), 'long', e.get_tree_decl_long(),
          'terminator', e.get_tree_decl_term(),
          'unfoldable-op', e.get_tree_decl_uop(),
          'lastFn', e.get_tree_decl_uop_fn(),
          // A sub-count of unfoldable-op, not a fourth bucket: how many of
          // those declines were an x87 op outside the accepted set, and which
          // instruction the last one was. `lastFn 188` names three hundred
          // different instructions; this names one.
          'x87-op', e.get_tree_decl_x87 ? e.get_tree_decl_x87() : 0,
          'lastX87', e.get_tree_decl_x87_op
            ? '0x' + (e.get_tree_decl_x87_op() >>> 0).toString(16) : '-');
      }
      if (e.get_x87_pipeline4_matches) {
        // `matches` counts the blocks each x87 family's predicate ACCEPTED,
        // whether or not --x87-fusion armed the emit; `runs` is entries into
        // the fused handler and is zero unless it did. The two together say
        // "this many shapes matched, and they were entered this often" --
        // which is the only way to tell a family that never matches from one
        // that matches cold code.
        log(`loopmatch: ${label} x87 armed`,
          X87_FUSION ? 'yes' : 'no',
          'pipeline4', e.get_x87_pipeline4_matches(),
          'runs', e.get_x87_pipeline4_runs(),
          '| tree4', e.get_x87_tree4_matches(),
          'runs', e.get_x87_tree4_runs(),
          '| island', e.get_x87_island_matches(),
          'runs', e.get_x87_island_runs(),
          '| affine', e.get_x87_affine_prepare_matches()
            + e.get_x87_affine_finish_matches(),
          'runs', e.get_x87_affine_prepare_runs()
            + e.get_x87_affine_finish_runs());
      }
      if (e.get_loop_aoe_fill_runs) {
        log(`loopmatch: ${label} AoE grid fills`,
          e.get_loop_aoe_fill_matches(), 'runs', e.get_loop_aoe_fill_runs(),
          'bytes', String(e.get_loop_aoe_fill_bytes()));
      }
      if (e.get_mmx_fill64_runs) {
        log(`loopmatch: ${label} MMX qword fills`,
          e.get_mmx_fill64_matches(), 'runs', e.get_mmx_fill64_runs(),
          'qwords', String(e.get_mmx_fill64_qwords()),
          'bulk', String(e.get_mmx_fill64_bulk_qwords()));
      }
      if (e.get_loop_aoe_span_runs) {
        log(`loopmatch: ${label} AoE span prefixes`,
          e.get_loop_aoe_span_matches(), 'runs', e.get_loop_aoe_span_runs());
      }
      if (e.get_implode_cmp_run_runs) {
        log(`loopmatch: ${label} IMPLODE_CMP_RUN blocks`,
          e.get_implode_cmp_run_matches(), 'armed', e.get_implode_cmp_run() ? 'yes' : 'no',
          'runs', e.get_implode_cmp_run_runs(),
          'iters', String(e.get_implode_cmp_run_iters()));
      }
    };
    report('M ', instance.exports);
    if (threadManager) {
      for (const [, t] of threadManager.threads) {
        if (t.instance) report(`T${t.tid}`, t.instance.exports);
      }
    }
  }

}

module.exports = { reportExperiments };
