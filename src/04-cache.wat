  ;; Existing thunks stay on the local fast path. A different instance may
  ;; publish a new callback during this instance's current run() slice.
  (defmacro (thunk-contains $target)
    (if (result i32) (i32.ge_u $target (global.get $thunk_guest_base))
      (then
        (if (result i32) (i32.lt_u $target (global.get $thunk_guest_end))
          (then (call $thunk_entry_original $target))
          (else (call $thunk_contains_new $target))))
      (else (i32.const 0))))

  ;; ============================================================
  ;; BLOCK CACHE
  ;; ============================================================
  ;; Executed sparse VirtualAlloc pages are a second self-modifying-code
  ;; domain. StarCraft builds and rewrites its palette blitters immediately
  ;; below 0x50000000. The min..max page span of such code is still kept
  ;; (tests and diagnostics read it), but it is NO LONGER a store filter: see
  ;; $code_page_test below for why.
  (global $generated_sparse_code_start (mut i32) (i32.const 0))
  (global $generated_sparse_code_end   (mut i32) (i32.const 0))

  ;; Page-granular record of where code has actually been decoded from, over
  ;; the WHOLE 4GB guest space, in 8KB: one bit per slot, slot =
  ;; ((ga >> 12) ^ (ga >> 28) ^ ((ga >> 30) << 15)) & 0xFFFF. Below 0x10000000
  ;; that is the page number (exact, one bit per page, as it always was);
  ;; above, the top four address bits fold into the low ones and bit 30 into
  ;; bit 15, so pages alias only across 256MB segments and never within one.
  ;; $CODE_PAGE_BITMAP_PAGES is the slot count.
  ;; ga bit 30 also flips slot bit 15 (uop-tier section 21). Without it a
  ;; page in 0x4xxxxxxx..0x7xxxxxxx aliased the page with the same offset in
  ;; 0x0xxxxxxx..0x3xxxxxxx, and the DIB arena (0x50000000..0x53F00000) sits
  ;; at offsets 0..63MB of its segment: its pages landed on the exe's own
  ;; .text below 0x04000000 and on DLLs at their usual 0x10000000 base. On
  ;; Caesar III the frame buffer's pages 0x50504000/0x50505000 read as
  ;; c3.exe's .text pages 0x501000/0x500000, and 1.81M uop store-window
  ;; proofs (12.6% of all reguards) were refused as "code". With the flip a
  ;; DIB page shares its slot with 0x08000000..0x0BF00000 -- above every
  ;; direct guest window and below VIRTUAL_ALLOC_MIN, so nothing lives there
  ;; -- and with 0x18000000.. / 0x28000000.. / 0x38000000.. in the sparse arena.
  ;; Pages 0..0x0FFFFFFF keep slot = page number, and within a 256MB segment
  ;; no two pages share a slot, as before.
  ;;
  ;; It used to cover only guest pages below 0x10000000, with everything above
  ;; falling back to the sparse min..max span -- the coarse filter the bitmap
  ;; exists to replace. Measured on StarCraft's 3500-batch uop-game-ab route:
  ;; the span grew to 0x7c6d0000..0x7ef81000, 7,560,358 guest stores landed in
  ;; it, and 7,546,085 of them (99.8%) retired nothing -- data pages
  ;; 0x7e07x000..0x7e095000 between two generated-code islands, written by
  ;; exe+0x4b43f6 (4.47M) and the generated blitters themselves. Each paid a
  ;; PAGE_DIR walk plus $uop_code_write, and every uop store window over those
  ;; pages declared its head "poor". A 128KB one-bit-per-page map would drop
  ;; the aliasing too, but the direct window has no 128KB left (every shake
  ;; mode must still place; measured again for section 21: the gap and pad
  ;; shakes have 0x200 and 0x1E0 bytes to spare, so not even 2KB fits).
  ;;
  ;; A set bit only says "some instance decoded a block from a page with this
  ;; slot"; the exact answer (which bytes) is each instance's own page index,
  ;; which $invalidate_code_range consults. So the bitmap is a conservative
  ;; shared filter and is never cleared (see the NOTE near
  ;; $invalidate_code_range): a stale or aliased bit costs a wasted slow path,
  ;; a missing bit would be a missed SMC. Bits only go 0->1, from any
  ;; instance. The mark is an atomic OR rather than load/or/store because two
  ;; Worker instances marking different slots of one byte at once would
  ;; otherwise lose a bit. The $gsN store helpers (03-registers) inline
  ;; $code_page_test; keep the two in step.
  (func $code_page_slot (param $ga i32) (result i32)
    (i32.and
      (i32.xor
        (i32.xor (i32.shr_u (local.get $ga) (i32.const 12))
                 (i32.shr_u (local.get $ga) (i32.const 28)))
        (i32.shl (i32.shr_u (local.get $ga) (i32.const 30)) (i32.const 15)))
      (i32.const 0xFFFF)))

  (func $code_page_mark (param $ga i32)
    (local $slot i32) (local $ba i32) (local $bit i32)
    (local.set $slot (call $code_page_slot (local.get $ga)))
    (local.set $ba (i32.add (global.get $CODE_PAGE_BITMAP) (i32.shr_u (local.get $slot) (i32.const 3))))
    (local.set $bit (i32.shl (i32.const 1) (i32.and (local.get $slot) (i32.const 7))))
    (if (i32.and (i32.load8_u (local.get $ba)) (local.get $bit)) (then (return)))
    (drop (i32.atomic.rmw8.or_u (local.get $ba) (local.get $bit)))
    ;; A page just became code: a uop store window over it (07d) must stop
    ;; letting stores through without invalidation.
    (call $uop_win_bump))

  (func $code_page_test (param $ga i32) (result i32)
    (local $slot i32)
    (local.set $slot (call $code_page_slot (local.get $ga)))
    (i32.and
      (i32.shr_u
        (i32.load8_u (i32.add (global.get $CODE_PAGE_BITMAP) (i32.shr_u (local.get $slot) (i32.const 3))))
        (i32.and (local.get $slot) (i32.const 7)))
      (i32.const 1)))

  ;; --code-write-legacy: the A/B arm for the old filter. The old store test
  ;; was "bitmap bit OR inside the sparse span"; marking every page of the
  ;; span into the bitmap as the span widens reproduces that answer with the
  ;; new, span-free hot path, so the arms differ only in which pages are
  ;; flagged. Per instance (inherited by guest threads, lib/worker-imports.js).
  (global $code_write_legacy (mut i32) (i32.const 0))
  (func (export "set_code_write_legacy") (param $on i32)
    (global.set $code_write_legacy (local.get $on))
    (if (i32.and (i32.ne (local.get $on) (i32.const 0))
                 (i32.ne (global.get $generated_sparse_code_start) (i32.const 0)))
      (then (call $code_page_mark_span
              (global.get $generated_sparse_code_start)
              (global.get $generated_sparse_code_end)))))
  (func $code_page_mark_span (param $lo i32) (param $hi i32)
    (block $done
      (loop $pages
        (br_if $done (i32.ge_u (local.get $lo) (local.get $hi)))
        (call $code_page_mark (local.get $lo))
        (local.set $lo (i32.add (local.get $lo) (i32.const 0x1000)))
        (br $pages))))

  ;; Bookkeeping that used to live inside $cache_store, kept when the hash it
  ;; belonged to was deleted (docs/page-compile-design.md section 4). None of it
  ;; ever had anything to do with the hash: it records *that* a guest address
  ;; was decoded, so that a later write to those bytes knows it is touching
  ;; code. That question is asked by $invalidate_code_write and is independent
  ;; of where the decoded code is stored, so this now runs once per decoded
  ;; block from $decode_block instead.
  (func $code_note_decode (param $ga i32)
    (local $page i32) (local $page_end i32) (local $should_track i32)
    (global.set $cache_stores (i32.add (global.get $cache_stores) (i32.const 1)))
    (call $code_page_mark (local.get $ga))
    (local.set $should_track
      (i32.and
        (i32.ne (global.get $exe_size_of_image) (i32.const 0))
        (i32.and
          (i32.ge_u (local.get $ga) (global.get $image_base))
          (i32.and
            (i32.lt_u (local.get $ga) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))
            (i32.or (i32.lt_u (local.get $ga) (global.get $code_start))
                    (i32.ge_u (local.get $ga) (global.get $code_end)))))))
    (if (local.get $should_track)
      (then
        (local.set $page (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
        (local.set $page_end (i32.add (local.get $page) (i32.const 0x1000)))
        (if (i32.or (i32.eqz (global.get $generated_code_start))
                    (i32.lt_u (local.get $page) (global.get $generated_code_start)))
          (then (global.set $generated_code_start (local.get $page))))
        (if (i32.gt_u (local.get $page_end) (global.get $generated_code_end))
          (then (global.set $generated_code_end (local.get $page_end))))))
    ;; Sparse VirtualAlloc code sits outside image_base..SizeOfImage, so track
    ;; it independently rather than widening generated_code_* across hundreds
    ;; of megabytes of ordinary heap/framebuffer writes.
    (if (i32.and
          (i32.ge_u (local.get $ga) (call $virtual_alloc_min))
          (i32.lt_u (local.get $ga) (global.get $VIRTUAL_ALLOC_TOP_INIT)))
      (then
        (local.set $page (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
        (local.set $page_end (i32.add (local.get $page) (i32.const 0x1000)))
        ;; The span is bookkeeping only now; the store filter is the bitmap.
        ;; Under --code-write-legacy the widened part is marked into the
        ;; bitmap, which is the old "bit OR in span" answer ($code_page_mark
        ;; bumps the uop window epoch for every page that turns on).
        (if (i32.or (i32.eqz (global.get $generated_sparse_code_start))
                    (i32.lt_u (local.get $page) (global.get $generated_sparse_code_start)))
          (then
            (if (i32.and (i32.ne (global.get $code_write_legacy) (i32.const 0))
                         (i32.ne (global.get $generated_sparse_code_start) (i32.const 0)))
              (then (call $code_page_mark_span (local.get $page) (global.get $generated_sparse_code_start))))
            (global.set $generated_sparse_code_start (local.get $page))))
        (if (i32.gt_u (local.get $page_end) (global.get $generated_sparse_code_end))
          (then
            (if (i32.and (i32.ne (global.get $code_write_legacy) (i32.const 0))
                         (i32.ne (global.get $generated_sparse_code_end) (i32.const 0)))
              (then (call $code_page_mark_span (global.get $generated_sparse_code_end) (local.get $page_end))))
            (global.set $generated_sparse_code_end (local.get $page_end)))))))
  ;; Every full cache wipe throws away all decoded code and forces the whole
  ;; working set to be re-decoded. One at startup is normal; thousands mean the
  ;; arena is too small for the app's hot set and the interpreter is spending
  ;; its time in the decoder. Nothing else in the emulator reports that, so
  ;; count it and export the count.
  (global $cache_clears (mut i32) (i32.const 0))
  ;; Decoded blocks. Named for the export that has always reported it.
  (global $cache_stores (mut i32) (i32.const 0))
  ;; Compiled pages evicted: another page landing in their directory slot, or
  ;; the index arena running out ($page_index_alloc's clock walk).
  (global $cache_evicts (mut i32) (i32.const 0))
  ;; The second cause alone. cache_evicts minus this is directory aliasing
  ;; (PAGE_DIR is direct-mapped on page number), this is index-arena capacity
  ;; (PAGE_INDEX_SLOTS). The two need opposite fixes, so they are told apart.
  (global $page_index_evicts (mut i32) (i32.const 0))
  (func (export "get_page_index_evicts") (result i32) (global.get $page_index_evicts))

  ;; Every WASM instance has its own decoded-code directory and arena, while
  ;; all instances execute bytes from the same guest memory. A Win32
  ;; FlushInstructionCache therefore has to reach farther than the caller's
  ;; local $invalidate_code_range. Offset +4 in SHARED_COUNTERS is a process
  ;; generation; each instance compares it once at run() entry and performs a
  ;; safe full local flush before executing its next slice. The caller records
  ;; the generation immediately because its requested range is retired below.
  (global $code_cache_generation_seen (mut i32) (i32.const 0))

  (func $process_code_cache_invalidate (param $ga i32) (param $len i32)
    (local $generation i32)
    (local.set $generation
      (i32.add
        (i32.atomic.rmw.add offset=4
          (global.get $SHARED_COUNTERS) (i32.const 1))
        (i32.const 1)))
    (global.set $code_cache_generation_seen (local.get $generation))
    ;; NULL means the whole process cache. A wrapping range likewise covers
    ;; the top of the address space and is safer as a complete flush than as
    ;; the empty unsigned interval $invalidate_code_range would otherwise see.
    (if (i32.or
          (i32.eqz (local.get $ga))
          (i32.lt_u (i32.add (local.get $ga) (local.get $len)) (local.get $ga)))
      (then (global.set $thread_flush_pending (i32.const 1)) (call $uop_flush_all))
      (else (call $invalidate_code_range (local.get $ga) (local.get $len)))))

  ;; Throw away every scrap of decoded code for this thread. Compiled chunks
  ;; live in the arena $thread_arena_flush_if_safe rewinds, and every caller is
  ;; either that flush or the corruption recovery in $next -- both mean no chunk
  ;; pointer can be trusted. With the hash gone, resetting the directory *is*
  ;; the whole job; there is no second index to sweep.
  (func $clear_cache
    (global.set $cache_clears (i32.add (global.get $cache_clears) (i32.const 1)))
    (call $page_dir_reset))

  ;; Companion to $cache_clears: a page invalidation is cheap on its own, but a
  ;; data variable that happens to share a 4KB page with hot code turns every
  ;; write to it into a re-decode of that code, and the arena it burns is never
  ;; reclaimed. $cache_inval_hits counts only the invalidations that actually
  ;; dropped a cached block, which is the number that costs something;
  ;; $cache_inval_page keeps the last such page so the culprit can be named.
  (global $cache_invals (mut i32) (i32.const 0))
  (global $cache_inval_hits (mut i32) (i32.const 0))
  (global $cache_inval_page (mut i32) (i32.const 0))

  ;; ============================================================
  ;; BLOCK CHAINING -- docs/block-chaining-design.md
  ;; ============================================================
  ;;
  ;; A taken direct branch costs $branch_end: four guard globals, two $sbh_eip
  ;; compares, $page_resolve (page compare, index load, cover test, chunk
  ;; select) and a budget decrement, on 100% of transfers. The target of a
  ;; `jmp rel32` or a `Jcc rel32` is a decode-time constant, so once it has
  ;; been resolved ONCE the answer can be written back into the terminator's
  ;; own operand word and every later transfer is a compare plus an add.
  ;;
  ;; Two properties make that a data patch rather than a second cache:
  ;;
  ;;   * it is stored as an OFFSET INSIDE ONE OF THE PAGE'S TWO CHUNKS, plus a
  ;;     one-bit selector saying which. A chunk grow relocates the whole chunk
  ;;     with one memory.copy that preserves offsets, so an offset survives
  ;;     what an absolute pointer would not; and a 16KB chunk cap bounds it to
  ;;     12 bits of dword index, which is what leaves room for the epoch and
  ;;     the selector beside it. (Round 15 stored a signed 16-bit DELTA from
  ;;     the operand word's own address instead. That could not name a target
  ;;     in the page's OTHER chunk -- the two chunks are independently bump-
  ;;     allocated out of the same multi-megabyte thread-cache arena at
  ;;     different times, so the distance between them is unbounded -- which is
  ;;     why chaining and the block executor used to be mutually exclusive.
  ;;     See docs/block-chaining-design.md section 8.)
  ;;   * validity is one global compare. $chain_epoch is bumped by every event
  ;;     that can make a chunk pointer mean something else -- a block retired,
  ;;     a page dropped, the directory reset, a chunk handed back to a free
  ;;     list -- so a stale patch simply fails the compare and takes the slow
  ;;     path, which re-resolves and re-patches it.
  ;;
  ;; Encoding. The word is shifted left by $shift so a Jcc keeps $jcc_end's
  ;; bits 0/1 exactly where $decode_run writes them; H43's operand is emitted
  ;; as 0 at all three decoder sites and read by nobody, so jmp shifts by zero.
  ;; Above that shift:
  ;;   bits 26..14  epoch, 1..$CHAIN_EPOCH_MAX; 0 means unpatched
  ;;   bit  13      which CHUNK of the page the target is in: 0 the threaded
  ;;                stream chunk, 1 the block-executor DESCRIPTOR chunk
  ;;   bits 12..1   the target's DWORD offset inside that chunk, 0..4095, which
  ;;                covers the whole 16KB cap exactly
  ;;   bit 0        which EDGE the slot describes: 0 taken, 1 fall-through
  ;; 27 bits, three fewer than round 15's 13+16+1, which is what pays for the
  ;; selector.
  ;;
  ;; A conditional branch has two edges and one slot, so the edge tag is not
  ;; decoration. Most of them need only one: when $decode_run proved the
  ;; fall-through block sits immediately behind this one, the not-taken side
  ;; costs nothing already and the slot serves the taken edge. When it did not
  ;; -- 5.0M of Caesar III's 11.6M desk trips, which is what `page_ft_missed`
  ;; has been counting all along -- BOTH edges go to the desk, and the slot
  ;; follows whichever one last missed. A branch that truly alternates pays one
  ;; extra store per transfer and is no slower than it was; a biased one, which
  ;; is nearly all of them, keeps the edge it uses.
  (global $CHAIN_EPOCH_MAX i32 (i32.const 0x1FFF))
  ;; Never 0 while chaining is usable, so an unpatched (zero) operand cannot
  ;; match. Past $CHAIN_EPOCH_MAX it parks at 0x4000 -- a value no patched word
  ;; can hold -- which disables every existing chain until the arena flush the
  ;; bump requests restarts it at 1 from a state with no decoded code left.
  (global $chain_epoch (mut i32) (i32.const 1))
  (global $block_chain_on (mut i32) (i32.const 0))
  (global $chain_hits (mut i64) (i64.const 0))
  (global $chain_slow (mut i64) (i64.const 0))
  (global $chain_patches (mut i32) (i32.const 0))
  (global $chain_bumps (mut i32) (i32.const 0))
  ;; ROUND 19 -- the anchor-location split. A threaded op executing out of a
  ;; page's DESCRIPTOR chunk can only be a block-executor tail: the descriptor
  ;; itself is entered at its head and never dispatched through $next again,
  ;; and round 13's saved verbatim stream copy is inert data nothing runs. So
  ;; "the chain slot lives in the descriptor chunk" IS "this transfer is an
  ;; executor exit", and these three counters are the executor-exit half of
  ;; the round's gate without any flag or handshake between the two features.
  (global $chain_hits_pool   (mut i64) (i64.const 0))
  (global $chain_slow_pool   (mut i64) (i64.const 0))
  (global $chain_patches_pool (mut i32) (i32.const 0))
  ;; Patch refusals, split by which end of the edge could not be named. Both
  ;; are addresses outside BOTH of the current page's chunks: a target on a
  ;; different page (the common one -- a chain is confined to one page) and an
  ;; anchor in the emit scratch or in a stream the page registers do not
  ;; describe.
  (global $chain_refuse_target (mut i32) (i32.const 0))
  (global $chain_refuse_anchor (mut i32) (i32.const 0))
  ;; Live slots that failed the anchor-membership test at READ time, i.e. the
  ;; page registers were not describing the anchor's page. Those fall to the
  ;; desk like any other miss. Nonzero is not a bug -- a nested synchronous
  ;; dispatch repoints the registers under a suspended block -- but a LARGE
  ;; number would mean the chunk-relative encoding is paying for itself less
  ;; often than the counters above suggest, so it is reported rather than
  ;; folded into `slow`.
  (global $chain_stale_regs (mut i64) (i64.const 0))
  ;; ROUND 19. One transfer's worth of "$chain_end already did the block
  ;; executor's discovery bump for this address". Set by $chain_hot_ok when the
  ;; bump invalidated the slot it was about to follow, consumed and cleared by
  ;; $branch_end_at, which the same transfer then tail-calls. Never live across
  ;; a transfer, so it is per-instance state and not a setting.
  (global $chain_hot_bumped (mut i32) (i32.const 0))
  ;; Entries to $branch_end, chaining or not. The round's gate is stated per
  ;; retired block against this number, so it is counted in both arms.
  (global $branch_end_calls (mut i64) (i64.const 0))
  ;; Of those, the ones whose terminator was executing out of a page's
  ;; descriptor chunk -- i.e. block-executor tail exits that took the desk.
  ;; Only counted while the executor is armed.
  (global $branch_end_pool (mut i64) (i64.const 0))
  ;; The one load $branch_end_at pays for all of its diagnostics and discovery
  ;; hooks. OR of: the executor armed ($block_exec_enabled), its hotness gate
  ;; ($bx_hot_on) and the branch-end statistics ($be_stats_on, armed by run.js
  ;; for --block-chain / --verbose, the only readers of the counters). Every
  ;; setter of one of those recomputes it through $be_gate_refresh; an off run
  ;; reads one zero and skips the whole $branch_end_diag call.
  (global $be_gate_on (mut i32) (i32.const 0))
  (global $be_stats_on (mut i32) (i32.const 0))
  ;; $uop_fast: the micro-op tier is the ONLY reason to bump -- no executor,
  ;; no statistics, no chaining. Then the hot bump moves out of
  ;; $branch_end_diag to after $page_resolve in $branch_end_at, where the
  ;; target's no-bump mark (01-header PAGE_INDEX_NOBUMP) can skip it, and the
  ;; taken-Jcc inline fast path in 05-alu stays open for marked targets.
  ;; $uop_nobump_on (default 1, set_uop_nobump) is the A/B switch; off, every
  ;; configuration is what it was before the mark existed.
  (global $uop_fast (mut i32) (i32.const 0))
  (global $uop_nobump_on (mut i32) (i32.const 1))
  (global $bx_hot_skips (mut i32) (i32.const 0))
  (func $be_gate_refresh
    (global.set $uop_fast
      (i32.and (i32.ne (global.get $uop_nobump_on) (i32.const 0))
      (i32.and (i32.ne (global.get $uop_enabled) (i32.const 0))
        (i32.eqz (i32.or (global.get $block_exec_enabled)
                 (i32.or (global.get $be_stats_on) (global.get $block_chain_on)))))))
    (global.set $be_gate_on
      (i32.or (i32.ne (global.get $block_exec_enabled) (i32.const 0))
        (i32.or (i32.and (i32.ne (global.get $bx_hot_on) (i32.const 0))
                         (i32.eqz (global.get $uop_fast)))
                (i32.ne (global.get $be_stats_on) (i32.const 0))))))
  (func (export "set_uop_nobump") (param $on i32)
    (global.set $uop_nobump_on (i32.ne (local.get $on) (i32.const 0)))
    (call $be_gate_refresh))
  (func (export "get_uop_nobump_skips") (result i32) (global.get $bx_hot_skips))

  ;; Set by $chain_patch the first time it writes a slot, cleared only by the
  ;; arena flush that rewinds every decoded stream. While it is 0 no threaded
  ;; word anywhere holds an epoch, so there is nothing a wrapped epoch could
  ;; falsely match and the wrap may simply restart at 1.
  ;;
  ;; Without this the wrap requested a FULL arena flush every 8192 bumps even
  ;; with chaining off (the default -- $chain_patch is only reached under
  ;; --block-chain), and every retire, page drop and chunk free bumps. Warcraft
  ;; III gameplay retires/drops ~500 blocks a batch, so it flushed the whole
  ;; cache every ~15 batches and spent ~1M decodes per 2360 batches rebuilding
  ;; its working set (docs/re-notes/warcraft3-demo.md, "Decode storms").
  (global $chain_slots_live (mut i32) (i32.const 0))

  (func $chain_bump
    (global.set $chain_bumps (i32.add (global.get $chain_bumps) (i32.const 1)))
    (global.set $chain_epoch (i32.add (global.get $chain_epoch) (i32.const 1)))
    (if (i32.and
          (i32.gt_u (global.get $chain_epoch) (global.get $CHAIN_EPOCH_MAX))
          (i32.eqz (global.get $chain_slots_live)))
      (then
        (global.set $chain_epoch (i32.const 1))
        (return)))
    (if (i32.gt_u (global.get $chain_epoch) (global.get $CHAIN_EPOCH_MAX))
      (then
        (global.set $chain_epoch (i32.const 0x2000))
        ;; Not a full flush from here: this runs inside invalidation, from
        ;; which recycling the arena is exactly the unsafe thing
        ;; $thread_arena_flush_if_safe exists to defer. $run services the
        ;; request at its next block boundary and restarts the epoch there.
        (global.set $thread_flush_pending (i32.const 1)))))

  ;; ROUND 13 -- the per-page OVERFLOW MEMO (region $PAGE_OVFL_MEMO).
  ;;
  ;; A page whose 16KB chunk once overflowed is a page whose compiled code does
  ;; not fit, and an overflow is not a local failure: $page_publish DROPS THE
  ;; WHOLE PAGE and every block on it is decoded again. An executor descriptor
  ;; is several times the size of the threaded stream it stands in for, so an
  ;; optional install on such a page brings the next overflow forward. The memo
  ;; is direct-mapped on the page base and deliberately outlives the directory
  ;; entry -- the drop is what destroys that entry, so a bit in the page desc
  ;; would be erased by the very event it has to remember.
  (global $PAGE_OVFL_MEMO i32 (region.addr $PAGE_OVFL_MEMO 0))
  (global $PAGE_OVFL_MEMO_SIZE i32 (region.size $PAGE_OVFL_MEMO))
  (func $page_ovfl_slot (param $base i32) (result i32)
    (i32.add (global.get $PAGE_OVFL_MEMO)
      (i32.shl
        (i32.and (i32.shr_u (local.get $base) (i32.const 12)) (i32.const 1023))
        (i32.const 2))))
  (func $page_ovfl_memo (param $base i32) (result i32)
    (i32.eq (i32.load (call $page_ovfl_slot (local.get $base))) (local.get $base)))
  (func $page_ovfl_note (param $base i32)
    (i32.store (call $page_ovfl_slot (local.get $base)) (local.get $base)))

  ;; Occupancy of page chunks when they leave the directory. PAGE_CHUNK_BYTES
  ;; is deliberately a worst-case reservation, but without these counters an
  ;; app that exhausts the arena cannot tell us whether it needs more memory or
  ;; whether most of that memory is merely empty tail space. Samples include
  ;; collision/invalidation drops and every live page discarded by a full
  ;; cache clear. The four buckets are cumulative upper bounds.
  (global $page_chunk_samples (mut i32) (i32.const 0))
  (global $page_chunk_used_total (mut i64) (i64.const 0))
  (global $page_chunk_used_max (mut i32) (i32.const 0))
  (global $page_chunk_le_4k (mut i32) (i32.const 0))
  (global $page_chunk_le_8k (mut i32) (i32.const 0))
  (global $page_chunk_le_12k (mut i32) (i32.const 0))
  (global $page_chunk_le_16k (mut i32) (i32.const 0))
  ;; Four size-class free lists. A freed chunk stores the next pointer in its
  ;; first word. They are per-instance globals just like $thread_alloc; worker
  ;; instances share memory but never share a decoded-code arena.
  (global $page_chunk_free_4k (mut i32) (i32.const 0))
  (global $page_chunk_free_8k (mut i32) (i32.const 0))
  (global $page_chunk_free_12k (mut i32) (i32.const 0))
  (global $page_chunk_free_16k (mut i32) (i32.const 0))
  (global $page_chunk_grows (mut i32) (i32.const 0))
  (global $page_chunk_reuses (mut i32) (i32.const 0))
  (global $page_index_evict_cursor (mut i32) (i32.const 0))
  (global $page_chunk_deferred (mut i32) (i32.const 0))
  (global $page_chunk_deferred_class (mut i32) (i32.const 0))

  ;; PAGE_DIR offset 12 packs the used byte count in the low 16 bits and the
  ;; 4/8/12/16KB capacity class in bits 16..17. Used offsets remain u16 so the
  ;; page index's existing 14-bit chunk offsets stay unchanged.
  (func $page_desc_used (param $desc i32) (result i32)
    (i32.and (local.get $desc) (i32.const 0xFFFF)))

  (func $page_desc_class (param $desc i32) (result i32)
    (i32.and (i32.shr_u (local.get $desc) (i32.const 16)) (i32.const 3)))

  ;; ROUND 14 -- the SECOND per-page chunk, for block-executor descriptors.
  ;; See docs/block-executor-design.md section 23.
  ;;
  ;; Round 13 put descriptors in the page's one 16KB threaded chunk, and that
  ;; chunk is a hard ceiling (the index entry is a 14-bit offset). A descriptor
  ;; is ~24 bytes of micro-op per guest op against 8 for the threaded stream it
  ;; stands in for, so an install brought the next OVERFLOW forward -- and an
  ;; overflow does not fail locally, it DROPS THE WHOLE PAGE and re-decodes
  ;; every block on it. The admission control that followed traded installs
  ;; away to stop that: region installs fell 38,881 -> 1,101.
  ;;
  ;; Descriptors get their own chunk now, in slot words +16/+20. Nothing an
  ;; install spends can push an ordinary block out of the threaded chunk, so
  ;; the admission reserve for descriptors is zero, and overflowing the
  ;; descriptor chunk degrades to a DECLINE -- the ordinary threaded block is
  ;; published instead -- rather than dropping the page.
  (global $page_desc_chunk_allocs (mut i32) (i32.const 0))
  (global $page_desc_chunk_grows  (mut i32) (i32.const 0))
  (global $page_desc_chunk_full   (mut i32) (i32.const 0))
  ;; ROUND 17 (section 27.2): the two descriptor families -- one-block installs
  ;; and multi-block region installs -- draw on the SAME 16KB per-page chunk,
  ;; and section 26.2 priced what that costs: round 15's 2,925 extra one-block
  ;; x87 descriptors took nrChunkFull from 2,714 to 2,863 and round 16's bigger
  ;; region descriptors to 3,637, i.e. a one-block install crowding a region
  ;; install off the same page. This is the headroom a ONE-BLOCK install must
  ;; leave behind it in the descriptor chunk; a region install passes 0 and so
  ;; gets first refusal on the last bytes of the page. Zero reproduces round 16
  ;; exactly. Not a knob on K, the thrash cap or the memo depth -- it is round
  ;; 14's storage split, which is the thing section 26.2 named.
  (global $page_desc_rg_reserve (mut i32) (i32.const 0))
  ;; One-block installs this reserve declined that the bare chunk would have
  ;; admitted. Without it a reserve that never binds and one that binds
  ;; constantly look identical from outside.
  (global $page_desc_reserve_declines (mut i32) (i32.const 0))

  (func $page_dchunk (param $slot i32) (result i32)
    (i32.load offset=16 (local.get $slot)))
  (func $page_dword (param $slot i32) (result i32)
    (i32.load offset=20 (local.get $slot)))

  ;; Bit 20 of the page descriptor word: "a block-executor REGION descriptor on
  ;; this page stands for guest bytes outside its own published extent."
  ;;
  ;; A region's index footprint is its HEAD BLOCK only -- the members keep their
  ;; own entries, which is what stops an interior transfer from re-decoding and
  ;; symmetrically retiring the region (section 22). The price of not covering
  ;; them is that a guest WRITE to a member's bytes retires that member and says
  ;; nothing about the region, whose micro-ops are a copy of the member's
  ;; semantics and are now stale. This bit is how that case is caught: any
  ;; invalidation on a page carrying one drops the whole page instead of
  ;; retiring per offset. Publishes never set it -- only $bx_region_finish does,
  ;; and only for a region with more than its head block in it -- so the common
  ;; page keeps exact per-offset invalidation.
  (global $PAGE_DESC_SPANREG i32 (i32.const 0x00100000))

  (func $page_desc_spanreg (param $desc i32) (result i32)
    (i32.and (local.get $desc) (global.get $PAGE_DESC_SPANREG)))

  ;; Mark the page holding $ga as carrying a span region. Called once per
  ;; multi-block region install.
  (func $page_mark_spanreg (param $ga i32)
    (local $slot i32)
    (local.set $slot (call $page_dir_slot (i32.and (local.get $ga) (i32.const 0xFFFFF000))))
    (if (i32.ne (i32.load (local.get $slot)) (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
      (then (return)))
    (i32.store offset=12 (local.get $slot)
      (i32.or (i32.load offset=12 (local.get $slot)) (global.get $PAGE_DESC_SPANREG))))

  (func $page_chunk_bytes (param $class i32) (result i32)
    (i32.shl (i32.add (local.get $class) (i32.const 1)) (i32.const 12)))

  ;; Smallest class that can hold $needed, or -1 beyond the indexable 16KB.
  (func $page_chunk_class_for (param $needed i32) (result i32)
    (if (i32.le_u (local.get $needed) (i32.const 4096)) (then (return (i32.const 0))))
    (if (i32.le_u (local.get $needed) (i32.const 8192)) (then (return (i32.const 1))))
    (if (i32.le_u (local.get $needed) (i32.const 12288)) (then (return (i32.const 2))))
    (if (i32.le_u (local.get $needed) (global.get $PAGE_CHUNK_BYTES))
      (then (return (i32.const 3))))
    (i32.const -1))

  (func $page_chunk_put (param $chunk i32) (param $class i32)
    ;; The single choke point through which a chunk becomes reusable storage.
    ;; Every chain delta points inside a chunk, so this is where they die.
    (call $chain_bump)
    (if (i32.eq (local.get $class) (i32.const 0))
      (then
        (i32.store (local.get $chunk) (global.get $page_chunk_free_4k))
        (global.set $page_chunk_free_4k (local.get $chunk))
        (return)))
    (if (i32.eq (local.get $class) (i32.const 1))
      (then
        (i32.store (local.get $chunk) (global.get $page_chunk_free_8k))
        (global.set $page_chunk_free_8k (local.get $chunk))
        (return)))
    (if (i32.eq (local.get $class) (i32.const 2))
      (then
        (i32.store (local.get $chunk) (global.get $page_chunk_free_12k))
        (global.set $page_chunk_free_12k (local.get $chunk))
        (return)))
    (i32.store (local.get $chunk) (global.get $page_chunk_free_16k))
    (global.set $page_chunk_free_16k (local.get $chunk)))

  (func $page_chunk_alloc (param $class i32) (result i32)
    (local $p i32) (local $size i32)
    (if (i32.eq (local.get $class) (i32.const 0))
      (then
        (local.set $p (global.get $page_chunk_free_4k))
        (if (local.get $p)
          (then (global.set $page_chunk_free_4k (i32.load (local.get $p)))))))
    (if (i32.eq (local.get $class) (i32.const 1))
      (then
        (local.set $p (global.get $page_chunk_free_8k))
        (if (local.get $p)
          (then (global.set $page_chunk_free_8k (i32.load (local.get $p)))))))
    (if (i32.eq (local.get $class) (i32.const 2))
      (then
        (local.set $p (global.get $page_chunk_free_12k))
        (if (local.get $p)
          (then (global.set $page_chunk_free_12k (i32.load (local.get $p)))))))
    (if (i32.eq (local.get $class) (i32.const 3))
      (then
        (local.set $p (global.get $page_chunk_free_16k))
        (if (local.get $p)
          (then (global.set $page_chunk_free_16k (i32.load (local.get $p)))))))
    (if (local.get $p)
      (then
        (global.set $page_chunk_reuses
          (i32.add (global.get $page_chunk_reuses) (i32.const 1)))
        (return (local.get $p))))
    (local.set $size (call $page_chunk_bytes (local.get $class)))
    (if (i32.gt_u
          (i32.add (global.get $thread_alloc) (local.get $size))
          (i32.sub (global.get $THREAD_END) (i32.const 16384)))
      (then (return (i32.const 0))))
    (local.set $p (global.get $thread_alloc))
    (global.set $thread_alloc (i32.add (global.get $thread_alloc) (local.get $size)))
    (local.get $p))

  ;; Dropping a page can happen from a store inside the page's own decoded
  ;; block. Reusing that chunk before the block terminates would overwrite the
  ;; interpreter stream under $ip. Nested synchronous dispatch has the same
  ;; issue for the suspended outer block. Those rare chunks remain abandoned
  ;; until the next arena reset; every other drop is immediately reusable.
  (func $page_chunk_put_if_safe (param $chunk i32) (param $class i32)
    (local $end i32)
    (if (i32.eqz (local.get $chunk)) (then (return)))
    (if (global.get $sync_msg_depth) (then (return)))
    (local.set $end
      (i32.add (local.get $chunk) (call $page_chunk_bytes (local.get $class))))
    (if (i32.and
          (i32.ge_u (global.get $ip) (local.get $chunk))
          (i32.lt_u (global.get $ip) (local.get $end)))
      (then (return)))
    (call $page_chunk_put (local.get $chunk) (local.get $class)))

  ;; A page that fills while $decode_run is extending it can still contain the
  ;; first block that decode_run is about to execute. Retire the directory entry
  ;; now, but wait until that block returns to $run before putting its chunk on
  ;; a reusable free list. Only one can be pending: the failed publication ends
  ;; the run immediately. Nested synchronous execution abandons the chunk just
  ;; as the old bump allocator did, because an outer frame may still name it.
  (func $page_chunk_reclaim_deferred
    (if (i32.eqz (global.get $page_chunk_deferred)) (then (return)))
    (if (global.get $sync_msg_depth) (then (return)))
    (call $page_chunk_put
      (global.get $page_chunk_deferred) (global.get $page_chunk_deferred_class))
    (global.set $page_chunk_deferred (i32.const 0))
    (global.set $page_chunk_deferred_class (i32.const 0)))

  (func $page_chunk_sample (param $used i32)
    (global.set $page_chunk_samples
      (i32.add (global.get $page_chunk_samples) (i32.const 1)))
    (global.set $page_chunk_used_total
      (i64.add (global.get $page_chunk_used_total)
        (i64.extend_i32_u (local.get $used))))
    (if (i32.gt_u (local.get $used) (global.get $page_chunk_used_max))
      (then (global.set $page_chunk_used_max (local.get $used))))
    (if (i32.le_u (local.get $used) (i32.const 4096))
      (then (global.set $page_chunk_le_4k
        (i32.add (global.get $page_chunk_le_4k) (i32.const 1)))))
    (if (i32.le_u (local.get $used) (i32.const 8192))
      (then (global.set $page_chunk_le_8k
        (i32.add (global.get $page_chunk_le_8k) (i32.const 1)))))
    (if (i32.le_u (local.get $used) (i32.const 12288))
      (then (global.set $page_chunk_le_12k
        (i32.add (global.get $page_chunk_le_12k) (i32.const 1)))))
    (if (i32.le_u (local.get $used) (global.get $PAGE_CHUNK_BYTES))
      (then (global.set $page_chunk_le_16k
        (i32.add (global.get $page_chunk_le_16k) (i32.const 1))))))

  ;; Retire the one compiled block that covers guest offset $off of the page
  ;; whose directory slot is $slot. Returns the offset one past the retired
  ;; block's last guest byte, so a range walk can skip the bytes it just dealt
  ;; with; returns $off+1 when nothing covered it.
  ;;
  ;; Two things have to happen, and doing only the first is the trap this
  ;; design walks into (docs/page-compile-design.md section 5.1). Clearing the
  ;; index stops the block being *entered*. It does not stop it being *fallen
  ;; into*: a run's whole point is that the not-taken side of a branch is the
  ;; next word of the chunk, consulting nothing. So the chunk itself has to be
  ;; broken, by overwriting the retired block's 8-byte header in place with
  ;; $th_block_end and the block's own guest address.
  ;;
  ;; That handler already exists -- `eip = op; return_call $branch_end` -- and
  ;; it is exactly 8 bytes with no trailing word, so it fits over any header.
  ;; The design predicted a new opcode ($th_page_exit) would be needed here; it
  ;; is not, and the handler table does not move.
  (func $page_retire_at (param $slot i32) (param $off i32) (result i32)
    (local $idx i32) (local $chunk i32) (local $v i32) (local $coff i32)
    (local $lo i32) (local $hi i32) (local $owner i32)
    (local.set $idx (i32.load offset=4 (local.get $slot)))
    (local.set $v
      (i32.load16_u (i32.add (local.get $idx) (i32.shl (local.get $off) (i32.const 1)))))
    (if (i32.eq (local.get $v) (global.get $PAGE_INDEX_NONE))
      (then (return (i32.add (local.get $off) (i32.const 1)))))
    ;; Round 14: the walk below compares the OWNER key -- chunk bit kept, cover
    ;; bit dropped -- so a descriptor block and a threaded block that happen to
    ;; sit at the same offset in their two different chunks never read as one
    ;; block. $coff stays the plain 14-bit offset, into whichever chunk bit 15
    ;; names.
    (local.set $owner (i32.and (local.get $v) (global.get $PAGE_INDEX_OWNER)))
    (local.set $coff (i32.and (local.get $v) (global.get $PAGE_INDEX_OFFMASK)))
    ;; Walk out to the block's guest extent. Every byte of it carries the same
    ;; chunk offset -- that is what $page_publish wrote -- so the extent is
    ;; readable from the index without an instruction-length table and without
    ;; storing a length anywhere.
    (local.set $lo (local.get $off))
    (block $ld (loop $ls
      (br_if $ld (i32.eqz (local.get $lo)))
      (local.set $v
        (i32.load16_u
          (i32.add (local.get $idx)
            (i32.shl (i32.sub (local.get $lo) (i32.const 1)) (i32.const 1)))))
      (br_if $ld (i32.eq (local.get $v) (global.get $PAGE_INDEX_NONE)))
      (br_if $ld (i32.ne (i32.and (local.get $v) (global.get $PAGE_INDEX_OWNER))
                         (local.get $owner)))
      (local.set $lo (i32.sub (local.get $lo) (i32.const 1)))
      (br $ls)))
    (local.set $hi (i32.add (local.get $off) (i32.const 1)))
    (block $hd (loop $hs
      (br_if $hd (i32.ge_u (local.get $hi) (i32.const 4096)))
      (local.set $v
        (i32.load16_u (i32.add (local.get $idx) (i32.shl (local.get $hi) (i32.const 1)))))
      (br_if $hd (i32.eq (local.get $v) (global.get $PAGE_INDEX_NONE)))
      (br_if $hd (i32.ne (i32.and (local.get $v) (global.get $PAGE_INDEX_OWNER))
                         (local.get $owner)))
      (local.set $hi (i32.add (local.get $hi) (i32.const 1)))
      (br $hs)))
    ;; Break the chunk before clearing the index, so there is no window in
    ;; which the block is unreachable by lookup but still fallen into. A
    ;; descriptor's first 8 bytes are handler + operand, exactly the shape
    ;; $th_block_end overwrites, so the same store works for both chunks.
    (local.set $chunk
      (if (result i32) (i32.and (local.get $owner) (global.get $PAGE_INDEX_DESC))
        (then (call $page_dchunk (local.get $slot)))
        (else (i32.load offset=8 (local.get $slot)))))
    (if (i32.eqz (local.get $chunk)) (then (return (i32.add (local.get $off) (i32.const 1)))))
    (i32.store (i32.add (local.get $chunk) (local.get $coff))
      (select (i32.const 45) (i32.const 471)
              (i32.and (local.get $owner) (global.get $PAGE_INDEX_DESC))))
    (i32.store offset=4 (i32.add (local.get $chunk) (local.get $coff))
      (i32.or (i32.load (local.get $slot)) (local.get $lo)))
    ;; --trace-code-writes also names every retirement that no guest write
    ;; caused: a newly published block overlapping an old one retires it here
    ;; too. Retired entry, its extent, the EIP being published or executed,
    ;; and whether $invalidate_code_range (a write) is the caller.
    (if (global.get $code_write_trace)
      (then
        (call $host_log_i32 (i32.const 0xCAC0DE02))
        (call $host_log_i32 (i32.or (i32.load (local.get $slot)) (local.get $lo)))
        (call $host_log_i32 (i32.sub (local.get $hi) (local.get $lo)))
        (call $host_log_i32 (global.get $eip))
        (call $host_log_i32 (global.get $in_code_write))))
    (block $cd (loop $cs
      (br_if $cd (i32.ge_u (local.get $lo) (local.get $hi)))
      (i32.store16 (i32.add (local.get $idx) (i32.shl (local.get $lo) (i32.const 1)))
        (global.get $PAGE_INDEX_NONE))
      (local.set $lo (i32.add (local.get $lo) (i32.const 1)))
      (br $cs)))
    ;; A retired block's header now holds $th_block_end. Any chain delta
    ;; pointing at it would still land correctly -- that handler re-enters
    ;; $branch_end at the block's own address -- but a chain pointing INTO the
    ;; retired extent would not, so the epoch moves.
    (call $chain_bump)
    (global.set $page_retires (i32.add (global.get $page_retires) (i32.const 1)))
    (global.set $cache_inval_hits (i32.add (global.get $cache_inval_hits) (i32.const 1)))
    (global.set $cache_inval_page (i32.load (local.get $slot)))
    (local.get $hi))

  ;; A guest write of $len bytes starting at $ga landed on a page that has held
  ;; code. Retire exactly the blocks whose x86 those bytes are part of.
  ;;
  ;; This is docs/page-compile-design.md section 5, and it is the reason the
  ;; hash cache could go. The old code retired *every block in the 4KB page* and
  ;; had to sweep all 4096 hash slots to find them; a data variable sharing a
  ;; page with hot code therefore turned each write to it into a re-decode of
  ;; the code. The index is keyed by page offset, so a write to offset X names
  ;; the one block covering X in a single load, and the rest of the page keeps
  ;; running compiled.
  ;;
  ;; NOTE: the CODE_PAGE_BITMAP bit is deliberately never cleared. The page
  ;; directory is per-thread while the bitmap is shared, so this retires only
  ;; the writing thread's code. Clearing the shared bit would tell every other
  ;; thread the page holds none, and their stale blocks would never be
  ;; invalidated again -- Storm and Smacker rewrite generated blitters in place,
  ;; so that is a real case.
  (func $invalidate_code_range (param $ga i32) (param $len i32)
    (local $end i32) (local $page i32) (local $slot i32)
    (local $off i32) (local $stop i32) (local $hits0 i32) (local $kills0 i32)
    (local.set $hits0 (global.get $cache_inval_hits))
    (local.set $kills0 (global.get $uop_kills))
    (global.set $in_code_write (i32.const 1))
    (global.set $cache_invals (i32.add (global.get $cache_invals) (i32.const 1)))
    (local.set $end (i32.add (local.get $ga) (local.get $len)))
    (local.set $page (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (block $pd (loop $ps
      (br_if $pd (i32.ge_u (local.get $page) (local.get $end)))
      (local.set $slot (call $page_dir_slot (local.get $page)))
      (if (i32.eq (i32.load (local.get $slot)) (local.get $page))
        (then
          (local.set $off
            (if (result i32) (i32.gt_u (local.get $ga) (local.get $page))
              (then (i32.sub (local.get $ga) (local.get $page)))
              (else (i32.const 0))))
          (local.set $stop
            (if (result i32)
                (i32.lt_u (local.get $end) (i32.add (local.get $page) (i32.const 4096)))
              (then (i32.sub (local.get $end) (local.get $page)))
              (else (i32.const 4096))))
          ;; A wide write is not worth walking: past a few hundred bytes the
          ;; per-offset walk costs more than dropping the page and letting the
          ;; next entry rebuild only what is still executed. This is the same
          ;; bound the old whole-page behaviour had, kept for the pathological
          ;; case only -- a REP MOVS over a code page, not an app patching one
          ;; branch.
          ;; A page carrying a block-executor REGION descriptor cannot be
          ;; invalidated per offset: the region's micro-ops are a copy of guest
          ;; bytes it does not cover in the index (section 22), so a write
          ;; anywhere on the page may have invalidated it and the index cannot
          ;; say. Drop the page. Only a multi-block install sets the bit, and
          ;; only a real guest write to a code page reaches here, so this is the
          ;; rare case paying for the common one.
          (if (i32.or
                (i32.ne (call $page_desc_spanreg (i32.load offset=12 (local.get $slot)))
                        (i32.const 0))
                (i32.gt_u (i32.sub (local.get $stop) (local.get $off)) (i32.const 512)))
            (then
              (global.set $page_range_drops
                (i32.add (global.get $page_range_drops) (i32.const 1)))
              (global.set $cache_inval_hits
                (i32.add (global.get $cache_inval_hits) (i32.const 1)))
              (global.set $cache_inval_page (local.get $page))
              (call $page_dir_drop (local.get $page)))
            (else
              (block $od (loop $os
                (br_if $od (i32.ge_u (local.get $off) (local.get $stop)))
                (local.set $off (call $page_retire_at (local.get $slot) (local.get $off)))
                (br $os)))))))
      (local.set $page (i32.add (local.get $page) (i32.const 0x1000)))
      (br $ps)))
    (global.set $in_code_write (i32.const 0))
    (if (global.get $uop_nranges)
      (then (call $uop_code_write (local.get $ga) (local.get $len))))
    ;; --trace-code-writes: every write that actually retired decoded code,
    ;; with the guest address, width, the EIP of the block that wrote it and
    ;; how many blocks it cost. `cache: page invalidations` counts these but
    ;; cannot say who, and a count with no code bytes changed underneath it is
    ;; a false invalidation to hunt, not self-modifying code.
    (if (global.get $code_write_trace)
      (then
        (if (i32.ne (global.get $cache_inval_hits) (local.get $hits0))
          (then
            (call $host_log_i32 (i32.const 0xCAC0DE01))
            (call $host_log_i32 (local.get $ga))
            (call $host_log_i32 (local.get $len))
            (call $host_log_i32 (global.get $eip))
            (call $host_log_i32 (i32.sub (global.get $cache_inval_hits) (local.get $hits0))))
          ;; =all: a write the shared code map let through that retired no
          ;; block and killed no uop program -- a false invalidation.
          (else (if (i32.and (i32.eq (global.get $code_write_trace) (i32.const 2))
                             (i32.eq (global.get $uop_kills) (local.get $kills0)))
            (then
              (call $host_log_i32 (i32.const 0xCAC0DE03))
              (call $host_log_i32 (local.get $ga))
              (call $host_log_i32 (local.get $len))
              (call $host_log_i32 (global.get $eip)))))))))

  (global $code_write_trace (mut i32) (i32.const 0))
  (global $in_code_write (mut i32) (i32.const 0))
  (func (export "set_code_write_trace") (param $on i32)
    (global.set $code_write_trace (local.get $on)))

  ;; ============================================================
  ;; PAGE COMPILATION -- see docs/page-compile-design.md
  ;; ============================================================
  ;; A compiled page owns one 8KB index (4096 u16 entries, guest page offset ->
  ;; offset within the page's threaded-code chunk) and one contiguous chunk in
  ;; this thread's arena. Nothing here is required for correctness: when a
  ;; freshly decoded block cannot be published, $publish_block returns its emit
  ;; scratch so this entry can execute, and a later entry decodes it again.
  ;; That is the property that makes each sizing constant a tuning knob rather
  ;; than a correctness constraint; there is no second cache or lookup fallback.

  (func $page_dir_slot (param $page_base i32) (result i32)
    (i32.add (global.get $PAGE_DIR)
      (i32.mul
        (i32.and (i32.shr_u (local.get $page_base) (i32.const 12))
                 (global.get $PAGE_DIR_MASK))
        (global.get $PAGE_DIR_SLOT_BYTES))))

  ;; Forget every compiled page for this thread. Used at thread init and
  ;; whenever the arena the chunks live in is recycled underneath them.
  (func $page_dir_reset
    (call $chain_bump)
    (local $i i32) (local $slot i32)
    (global.set $cur_page_base (i32.const 0))
    (global.set $cur_page_index (i32.const 0))
    (global.set $cur_page_chunk (i32.const 0))
    (global.set $cur_page_desc (i32.const 0))
    (global.set $cur_page_chunk_cap (i32.const 0))
    (global.set $cur_page_desc_cap (i32.const 0))
    (global.set $page_index_next (i32.const 0))
    (global.set $page_index_free (i32.const 0))
    (global.set $page_index_evict_cursor (i32.const 0))
    (global.set $page_chunk_free_4k (i32.const 0))
    (global.set $page_chunk_free_8k (i32.const 0))
    (global.set $page_chunk_free_12k (i32.const 0))
    (global.set $page_chunk_free_16k (i32.const 0))
    (global.set $page_chunk_deferred (i32.const 0))
    (global.set $page_chunk_deferred_class (i32.const 0))
    (local.set $i (i32.const 0))
    (block $d (loop $s
      (br_if $d (i32.ge_u (local.get $i) (global.get $PAGE_DIR_ENTRIES)))
      (local.set $slot
        (i32.add (global.get $PAGE_DIR)
          (i32.mul (local.get $i) (global.get $PAGE_DIR_SLOT_BYTES))))
      (if (i32.load (local.get $slot))
        (then (call $page_chunk_sample
          (call $page_desc_used (i32.load offset=12 (local.get $slot))))))
      (i32.store (local.get $slot) (i32.const 0))
      (i32.store offset=4 (local.get $slot) (i32.const 0))
      (i32.store offset=8 (local.get $slot) (i32.const 0))
      (i32.store offset=12 (local.get $slot) (i32.const 0))
      (i32.store offset=16 (local.get $slot) (i32.const 0))
      (i32.store offset=20 (local.get $slot) (i32.const 0))
      (i32.store offset=24 (local.get $slot) (i32.const 0))
      (i32.store offset=28 (local.get $slot) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $s))))

  ;; Hand out an 8KB index, preferring the free list. Returns 0 when this
  ;; thread's index arena is exhausted, which simply means the page does not
  ;; get compiled.
  (func $page_index_alloc (result i32)
    (local $p i32) (local $n i32) (local $slot i32) (local $page i32)
    (if (global.get $page_index_free)
      (then
        (local.set $p (global.get $page_index_free))
        (global.set $page_index_free (i32.load (local.get $p)))
        (return (local.get $p))))
    (if (i32.ge_u (global.get $page_index_next) (global.get $PAGE_INDEX_SLOTS))
      (then
        ;; The old behaviour simply declined every new page once all 128
        ;; indexes were live. Frequent arena overflows accidentally hid that
        ;; on Diablo II by clearing the directory; compact chunks remove those
        ;; clears, so make index pressure explicit and bounded. Evict one
        ;; non-current directory entry with a clock walk, then consume the
        ;; index $page_dir_drop put on the free list.
        (block $found (loop $scan
          ;; Second chance: PAGE_DIR +24 is a referenced bit, set when the page
          ;; is created or entered and cleared as the hand passes. A plain
          ;; clock evicted whatever the hand reached, so with the working set
          ;; larger than the arena it threw out hot pages as readily as cold
          ;; ones. Two sweeps bound the walk: the first may only clear bits.
          (br_if $found (i32.ge_u (local.get $n)
                          (i32.shl (global.get $PAGE_DIR_ENTRIES) (i32.const 1))))
          (local.set $slot
            (i32.add (global.get $PAGE_DIR)
              (i32.mul (global.get $page_index_evict_cursor)
                       (global.get $PAGE_DIR_SLOT_BYTES))))
          (global.set $page_index_evict_cursor
            (i32.and
              (i32.add (global.get $page_index_evict_cursor) (i32.const 1))
              (global.get $PAGE_DIR_MASK)))
          (local.set $page (i32.load (local.get $slot)))
          (if (i32.and
                (i32.and
                  (i32.ne (local.get $page) (i32.const 0))
                  (i32.ne (local.get $page) (global.get $cur_page_base)))
                (i32.ne (i32.load offset=24 (local.get $slot)) (i32.const 0)))
            (then
              (i32.store offset=24 (local.get $slot) (i32.const 0))
              (local.set $page (i32.const 0))))
          (if (i32.and
                (i32.ne (local.get $page) (i32.const 0))
                (i32.ne (local.get $page) (global.get $cur_page_base)))
            (then
              (global.set $cache_evicts
                (i32.add (global.get $cache_evicts) (i32.const 1)))
              (global.set $page_index_evicts
                (i32.add (global.get $page_index_evicts) (i32.const 1)))
              (call $page_dir_drop (local.get $page))
              (br $found)))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))
          (br $scan)))
        (if (i32.eqz (global.get $page_index_free))
          (then (return (i32.const 0))))
        (local.set $p (global.get $page_index_free))
        (global.set $page_index_free (i32.load (local.get $p)))
        (return (local.get $p))))
    (local.set $p
      (i32.add (global.get $PAGE_INDEX)
        (i32.mul (global.get $page_index_next) (global.get $PAGE_INDEX_BYTES))))
    (global.set $page_index_next (i32.add (global.get $page_index_next) (i32.const 1)))
    (local.get $p))

  ;; Every entry starts as PAGE_INDEX_NONE: an offset that was never written is
  ;; either a mid-instruction byte or code pass 1 never reached, and both must
  ;; miss rather than resolve to chunk offset 0.
  ;; PAGE_INDEX_NONE is 0xFFFFFFFF, so every byte of it is 0xFF and the dword
  ;; store loop is a byte fill written the long way.
  ;; The two op-boundary bitmaps at the tail of the slot are the opposite
  ;; polarity: a set bit is a claim, so a fresh slot must read as "nothing is
  ;; marked here", which is zero.
  (func $page_index_clear (param $p i32)
    (memory.fill (local.get $p) (i32.const 0xFF) (global.get $PAGE_OPBITS_START))
    (memory.fill (i32.add (local.get $p) (global.get $PAGE_OPBITS_START))
      (i32.const 0) (i32.shl (global.get $PAGE_OPBITS_BYTES) (i32.const 1))))

  ;; ----------------------------------------------------------------------
  ;; The op-boundary bitmaps (docs/block-executor-design.md section 22).
  ;; $map is a slot-relative base, $w a word index into the page's chunk.
  ;; ----------------------------------------------------------------------
  (func $page_opbit_set (param $map i32) (param $w i32)
    (local $p i32)
    (local.set $p (i32.add (local.get $map) (i32.shr_u (local.get $w) (i32.const 3))))
    (i32.store8 (local.get $p)
      (i32.or (i32.load8_u (local.get $p))
        (i32.shl (i32.const 1) (i32.and (local.get $w) (i32.const 7))))))

  (func $page_opbit_clear (param $map i32) (param $w i32)
    (local $p i32)
    (local.set $p (i32.add (local.get $map) (i32.shr_u (local.get $w) (i32.const 3))))
    (i32.store8 (local.get $p)
      (i32.and (i32.load8_u (local.get $p))
        (i32.xor (i32.shl (i32.const 1) (i32.and (local.get $w) (i32.const 7)))
                 (i32.const 0xFF)))))

  (func $page_opbit_test (param $map i32) (param $w i32) (result i32)
    (i32.and
      (i32.shr_u
        (i32.load8_u
          (i32.add (local.get $map) (i32.shr_u (local.get $w) (i32.const 3))))
        (i32.and (local.get $w) (i32.const 7)))
      (i32.const 1)))

  ;; Record the op boundaries of the block just copied into [used, used+len) of
  ;; the current page's chunk. OP_INDEX still holds this block's op addresses in
  ;; the STAGING arena, so each is rebased by (used - tstart).
  ;;
  ;; The START map is cleared over the block's whole word range; the END map is
  ;; cleared from one word IN, because the end bit sitting at `used` belongs to
  ;; whatever block ended exactly where this one begins and clearing it would
  ;; leave that block's scan unbounded.
  ;;
  ;; A block whose ops the decoder can no longer describe -- OP_INDEX poisoned,
  ;; or a matcher that rewrote the stream and zeroed $op_index_n -- gets its
  ;; range cleared and no start bits at all, which reads downstream as "this
  ;; block cannot be classified", the right answer for a folded block.
  (func $page_opbits_publish (param $tstart i32) (param $used i32) (param $len i32)
    (local $ms i32) (local $me i32) (local $w i32) (local $wend i32)
    (local $i i32) (local $n i32)
    (local.set $ms (i32.add (global.get $cur_page_index) (global.get $PAGE_OPBITS_START)))
    (local.set $me (i32.add (global.get $cur_page_index) (global.get $PAGE_OPBITS_END)))
    (local.set $w (i32.shr_u (local.get $used) (i32.const 2)))
    (local.set $wend (i32.shr_u (i32.add (local.get $used) (local.get $len)) (i32.const 2)))
    (block $cd (loop $cs
      (br_if $cd (i32.ge_u (local.get $w) (local.get $wend)))
      (call $page_opbit_clear (local.get $ms) (local.get $w))
      (if (i32.gt_u (local.get $w) (i32.shr_u (local.get $used) (i32.const 2)))
        (then (call $page_opbit_clear (local.get $me) (local.get $w))))
      (local.set $w (i32.add (local.get $w) (i32.const 1)))
      (br $cs)))
    ;; A block that fills the chunk to its last word has no word after it, so
    ;; it gets no END bit: the maps hold one bit per chunk word, and word
    ;; 4096 of a full 16KB chunk is byte 0x200 of the END map -- which is byte
    ;; 0 of the NEXT slot's index, its page-offset-0 entry. Setting it turned
    ;; that entry's even chunk offset odd, and the next entry at the top of
    ;; that page ran from a misaligned stream (Arcanum: bad handler 0x02000000
    ;; at eip=0x500000, then a garbage exit). Readers treat the chunk's used
    ;; end as the implicit end of its last block.
    (if (i32.lt_u (local.get $wend)
                  (i32.shl (global.get $PAGE_OPBITS_BYTES) (i32.const 3)))
      (then (call $page_opbit_set (local.get $me) (local.get $wend))))
    (if (global.get $op_index_poison) (then (return)))
    (local.set $n (global.get $op_index_n))
    (block $od (loop $os
      (br_if $od (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $w
        (i32.shr_u
          (i32.add
            (i32.sub (call $loop_op_at (local.get $i)) (local.get $tstart))
            (local.get $used))
          (i32.const 2)))
      (if (i32.and (i32.ge_u (local.get $w) (i32.shr_u (local.get $used) (i32.const 2)))
                   (i32.lt_u (local.get $w) (local.get $wend)))
        (then (call $page_opbit_set (local.get $ms) (local.get $w))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $os)))
  )

  ;; ----------------------------------------------------------------------
  ;; $page_cached_ops -- rebuild OP_INDEX for a block that is ALREADY compiled,
  ;; from the bitmaps above. Returns the op count, or 0 when this address is not
  ;; an entry point, its page is gone, or the block is itself a block-executor
  ;; descriptor (H458), which has no x86 op stream to classify.
  ;;
  ;; This is what lets the region walker classify without decoding. It moves no
  ;; page registers, exactly as $page_probe does not, because it is a query
  ;; about a page that need not be the executing one.
  ;; ----------------------------------------------------------------------
  (func $page_cached_ops (param $ga i32) (result i32)
    (local $slot i32) (local $idx i32) (local $chunk i32) (local $base i32)
    (local $e i32) (local $coff i32) (local $ms i32) (local $me i32)
    (local $w i32) (local $wmax i32) (local $n i32)
    (local.set $base (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $base))
      (then (return (i32.const 0))))
    (local.set $idx (i32.load offset=4 (local.get $slot)))
    (local.set $e
      (i32.load16_u
        (i32.add (local.get $idx)
          (i32.shl (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 1)))))
    (if (i32.and (local.get $e) (global.get $PAGE_INDEX_COVER))
      (then (return (i32.const 0))))
    (local.set $coff (i32.and (local.get $e) (global.get $PAGE_INDEX_OFFMASK)))
    (local.set $chunk
      (if (result i32) (i32.and (local.get $e) (global.get $PAGE_INDEX_DESC))
        (then (call $page_dchunk (local.get $slot)))
        (else (i32.load offset=8 (local.get $slot)))))
    (if (i32.eqz (local.get $chunk)) (then (return (i32.const 0))))
    ;; ---- an executor DESCRIPTOR stands here -------------------------------
    ;; Not an x86 op stream -- but a one-block descriptor carries a verbatim
    ;; copy of the threaded stream it displaced, parked at the tail of its
    ;; fallback pool, with an op-boundary table in front of it. That copy is
    ;; the whole point of round 13: the region walker wants this block's ops,
    ;; and before the copy existed the only way to get them back was to retire
    ;; the descriptor and make the guest re-decode the block -- once per walk
    ;; that passed through it, which on the 1000-batch quake2 window was ~139k
    ;; decodes for 2.4k regions. The descriptor's OPERAND word (unused by the
    ;; executor, which reads its header from $ip) holds the byte offset from
    ;; the block start to that table; zero means the copy was not saved and
    ;; the caller falls back to taking the descriptor back.
    ;;
    ;; Round 14 gave the table a second header word and extended the copy to
    ;; REGION descriptors as well (section 23). The layout is
    ;;   +0  n, the op count
    ;;   +4  rawlen, the copy's byte length
    ;;   +8  n offsets, each relative to the copy's first byte
    ;;   +8+4n  the copy itself
    ;; The length is there so that a region whose head is ITSELF a one-block
    ;; descriptor can pass the same stream on to its own copy instead of
    ;; publishing without one -- which is the case that would otherwise still
    ;; end with a walk retiring a finished region.
    (if (call $bx_is_desc_word
          (i32.load (i32.add (local.get $chunk) (local.get $coff))))
      (then
        (local.set $w (i32.add (local.get $chunk) (local.get $coff)))
        (local.set $wmax (i32.load offset=4 (local.get $w)))
        (if (i32.eqz (local.get $wmax)) (then (return (i32.const 0))))
        (local.set $ms (i32.add (local.get $w) (local.get $wmax)))  ;; table
        (local.set $n (i32.load (local.get $ms)))
        (if (i32.or (i32.eqz (local.get $n))
                    (i32.gt_u (local.get $n) (global.get $OP_INDEX_MAX)))
          (then (return (i32.const 0))))
        (local.set $me                                              ;; raw base
          (i32.add (local.get $ms)
            (i32.add (i32.const 8) (i32.shl (local.get $n) (i32.const 2)))))
        (local.set $w (i32.const 0))
        (block $rd (loop $rl
          (br_if $rd (i32.ge_u (local.get $w) (local.get $n)))
          (i32.store
            (i32.add (global.get $OP_INDEX) (i32.shl (local.get $w) (i32.const 2)))
            (i32.add (local.get $me)
              (i32.load (i32.add (local.get $ms)
                (i32.shl (i32.add (local.get $w) (i32.const 2)) (i32.const 2))))))
          (local.set $w (i32.add (local.get $w) (i32.const 1)))
          (br $rl)))
        (return (local.get $n))))
    (local.set $ms (i32.add (local.get $idx) (global.get $PAGE_OPBITS_START)))
    (local.set $me (i32.add (local.get $idx) (global.get $PAGE_OPBITS_END)))
    (local.set $w (i32.shr_u (local.get $coff) (i32.const 2)))
    (local.set $wmax
      (i32.shr_u (call $page_desc_used (i32.load offset=12 (local.get $slot)))
                 (i32.const 2)))
    ;; The entry word itself: an END bit here belongs to the block below.
    (if (i32.eqz (call $page_opbit_test (local.get $ms) (local.get $w)))
      (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $w) (local.get $wmax)))
      (if (i32.and (i32.gt_u (local.get $w) (i32.shr_u (local.get $coff) (i32.const 2)))
                   (call $page_opbit_test (local.get $me) (local.get $w)))
        (then (br $done)))
      (if (call $page_opbit_test (local.get $ms) (local.get $w))
        (then
          (if (i32.ge_u (local.get $n) (global.get $OP_INDEX_MAX))
            (then (return (i32.const 0))))
          (i32.store
            (i32.add (global.get $OP_INDEX) (i32.shl (local.get $n) (i32.const 2)))
            (i32.add (local.get $chunk) (i32.shl (local.get $w) (i32.const 2))))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $w (i32.add (local.get $w) (i32.const 1)))
      (br $scan)))
    (local.get $n))

  ;; ----------------------------------------------------------------------
  ;; $page_cached_stream -- round 14. Where the published THREADED bytes of the
  ;; block entered at $ga live, and how many there are.
  ;;
  ;; The one-block installer saves the stream it displaces by copying it out of
  ;; the emit scratch, which it is about to overwrite. The REGION installer has
  ;; no such copy to make: its head block was published normally some time ago
  ;; and its bytes are sitting in the page's threaded chunk right now, so the
  ;; region only needs to be told where they are. That is this.
  ;;
  ;; Returns the chunk address, or 0 when $ga is not a threaded entry point or
  ;; its extent cannot be read. The byte length lands in
  ;; $page_cached_stream_len, which is only meaningful on a non-zero return.
  ;; ----------------------------------------------------------------------
  (global $page_cached_stream_len (mut i32) (i32.const 0))

  (func $page_cached_stream (param $ga i32) (result i32)
    (local $slot i32) (local $idx i32) (local $chunk i32) (local $base i32)
    (local $e i32) (local $coff i32) (local $me i32)
    (local $w i32) (local $w0 i32) (local $wmax i32)
    (global.set $page_cached_stream_len (i32.const 0))
    (local.set $base (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $base))
      (then (return (i32.const 0))))
    (local.set $idx (i32.load offset=4 (local.get $slot)))
    (local.set $e
      (i32.load16_u
        (i32.add (local.get $idx)
          (i32.shl (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 1)))))
    ;; An ENTRY, in either chunk.
    (if (i32.and (local.get $e) (global.get $PAGE_INDEX_COVER))
      (then (return (i32.const 0))))
    (local.set $coff (i32.and (local.get $e) (global.get $PAGE_INDEX_OFFMASK)))
    ;; A DESCRIPTOR stands here. It does not own a threaded stream -- but if it
    ;; carries a copy of the one it displaced, that copy IS the stream, and
    ;; handing it on is what lets a region built over a one-block descriptor
    ;; keep the block's ops readable instead of publishing bare.
    (if (i32.and (local.get $e) (global.get $PAGE_INDEX_DESC))
      (then
        (local.set $chunk (call $page_dchunk (local.get $slot)))
        (if (i32.eqz (local.get $chunk)) (then (return (i32.const 0))))
        (local.set $w (i32.add (local.get $chunk) (local.get $coff)))
        (local.set $me (i32.load offset=4 (local.get $w)))        ;; rawoff
        (if (i32.eqz (local.get $me)) (then (return (i32.const 0))))
        (local.set $me (i32.add (local.get $w) (local.get $me))) ;; the table
        (local.set $w0 (i32.load (local.get $me)))                ;; n
        (if (i32.or (i32.eqz (local.get $w0))
                    (i32.gt_u (local.get $w0) (global.get $OP_INDEX_MAX)))
          (then (return (i32.const 0))))
        (global.set $page_cached_stream_len (i32.load offset=4 (local.get $me)))
        (if (i32.eqz (global.get $page_cached_stream_len))
          (then (return (i32.const 0))))
        (return
          (i32.add (local.get $me)
            (i32.add (i32.const 8) (i32.shl (local.get $w0) (i32.const 2)))))))
    (local.set $chunk (i32.load offset=8 (local.get $slot)))
    (if (i32.eqz (local.get $chunk)) (then (return (i32.const 0))))
    ;; The extent is the END bitmap's first set bit strictly above the entry
    ;; word -- exactly the bound $page_cached_ops scans to.
    (local.set $me (i32.add (local.get $idx) (global.get $PAGE_OPBITS_END)))
    (local.set $w0 (i32.shr_u (local.get $coff) (i32.const 2)))
    (local.set $wmax
      (i32.shr_u (call $page_desc_used (i32.load offset=12 (local.get $slot)))
                 (i32.const 2)))
    ;; The used end bounds the last block even without its END bit, which a
    ;; block filling the whole chunk does not get (see $page_opbits_publish),
    ;; and stopping there keeps the test inside this slot's map.
    (local.set $w (i32.add (local.get $w0) (i32.const 1)))
    (if (i32.gt_u (local.get $w) (local.get $wmax)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $w) (local.get $wmax)))
      (br_if $done (call $page_opbit_test (local.get $me) (local.get $w)))
      (local.set $w (i32.add (local.get $w) (i32.const 1)))
      (br $scan)))
    (global.set $page_cached_stream_len
      (i32.shl (i32.sub (local.get $w) (local.get $w0)) (i32.const 2)))
    (i32.add (local.get $chunk) (local.get $coff)))

  ;; Is the compiled block entered at $ga a block-executor descriptor rather
  ;; than a threaded op stream? 0 for "not compiled" as well, so the caller has
  ;; to have established that separately.
  (func $page_cached_is_desc (param $ga i32) (result i32)
    (local $slot i32) (local $base i32) (local $e i32)
    (local.set $base (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $base))
      (then (return (i32.const 0))))
    (local.set $e
      (i32.load16_u
        (i32.add (i32.load offset=4 (local.get $slot))
          (i32.shl (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 1)))))
    ;; Round 14: a descriptor is now exactly "an entry whose index bit 15 is
    ;; set". No chunk load, no handler compare.
    (i32.and (i32.eqz (i32.and (local.get $e) (global.get $PAGE_INDEX_COVER)))
             (i32.ne (i32.and (local.get $e) (global.get $PAGE_INDEX_DESC))
                     (i32.const 0))))

  ;; Retire the compiled block entered at $ga, by guest address. Same machinery
  ;; a code write uses; the region walker needs it to take back a one-block
  ;; descriptor it wants the raw op stream of.
  ;; Set the no-bump mark (01-header PAGE_INDEX_NOBUMP) on the entry compiled
  ;; at $ga, if there is one. Moves no page registers.
  (func $page_nobump_mark (param $ga i32)
    (local $slot i32) (local $base i32) (local $p i32) (local $e i32)
    (local.set $base (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $base)) (then (return)))
    (local.set $p (i32.add (i32.load offset=4 (local.get $slot))
      (i32.shl (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 1))))
    (local.set $e (i32.load16_u (local.get $p)))
    (if (i32.and (local.get $e) (global.get $PAGE_INDEX_COVER)) (then (return)))
    (i32.store16 (local.get $p) (i32.or (local.get $e) (global.get $PAGE_INDEX_NOBUMP))))

  (func $page_retire_ga (param $ga i32)
    (local $slot i32) (local $base i32)
    (local.set $base (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $base)) (then (return)))
    (drop (call $page_retire_at (local.get $slot)
            (i32.and (local.get $ga) (i32.const 0xFFF)))))

  ;; Guest extent of the already-compiled block entered at $ga: the first offset
  ;; past its last covered byte. Read straight out of the index, the same way
  ;; $page_retire_at reads it, so it needs no instruction-length table.
  (func $page_cached_end (param $ga i32) (result i32)
    (local $slot i32) (local $idx i32) (local $base i32) (local $coff i32)
    (local $o i32) (local $v i32)
    (local.set $base (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $base))
      (then (return (i32.const 0))))
    (local.set $idx (i32.load offset=4 (local.get $slot)))
    (local.set $o (i32.and (local.get $ga) (i32.const 0xFFF)))
    (local.set $coff
      (i32.load16_u (i32.add (local.get $idx) (i32.shl (local.get $o) (i32.const 1)))))
    (if (i32.and (local.get $coff) (global.get $PAGE_INDEX_COVER))
      (then (return (i32.const 0))))
    ;; The owner key, not the bare offset: bit 15 has to match too, or a
    ;; descriptor block's cover marks would be read as a threaded block's.
    (local.set $coff (i32.and (local.get $coff) (global.get $PAGE_INDEX_OWNER)))
    (local.set $o (i32.add (local.get $o) (i32.const 1)))
    (block $hd (loop $hs
      (br_if $hd (i32.ge_u (local.get $o) (i32.const 4096)))
      (local.set $v
        (i32.load16_u (i32.add (local.get $idx) (i32.shl (local.get $o) (i32.const 1)))))
      (br_if $hd (i32.eq (local.get $v) (global.get $PAGE_INDEX_NONE)))
      (br_if $hd (i32.eqz (i32.and (local.get $v) (global.get $PAGE_INDEX_COVER))))
      (br_if $hd (i32.ne (i32.and (local.get $v) (global.get $PAGE_INDEX_OWNER))
                         (local.get $coff)))
      (local.set $o (i32.add (local.get $o) (i32.const 1)))
      (br $hs)))
    (i32.add (local.get $base) (local.get $o)))

  ;; ----------------------------------------------------------------------
  ;; $page_would_fit -- admission control for an OPTIONAL publish.
  ;;
  ;; A block-executor descriptor is bigger than the threaded code it replaces,
  ;; and a publish that does not fit does not merely fail: $page_publish drops
  ;; the WHOLE PAGE and every block on it is decoded again. Paying ~76 block
  ;; decodes to install one descriptor is how round 12's regions arm turned
  ;; 781k decodes into 3.1M. An install is optional, so ask first.
  ;; ----------------------------------------------------------------------
  ;; $reserve is headroom an OPTIONAL publish must leave behind it. A block
  ;; executor descriptor is bigger than the threaded stream it stands in for,
  ;; so installing one near a full chunk does not merely fail later -- it
  ;; brings forward the moment some ORDINARY block overflows the chunk, and
  ;; that drops the whole page and re-decodes every block on it. Measured on
  ;; the 1000-batch quake2 window: with no reserve the one-block family alone
  ;; took page compiles from 18,269 to 21,997 and block decodes from 781,266
  ;; to 1,047,921. A mandatory publish passes 0.
  ;; ROUND 14: this is the DESCRIPTOR chunk's admission test, and it is a
  ;; different question from the threaded chunk's. A descriptor now has a chunk
  ;; of its own, so nothing it spends can push an ordinary block out of the
  ;; threaded chunk, and overflowing the descriptor chunk is a local decline --
  ;; $publish_block goes on to publish the threaded block instead. There is
  ;; therefore no reserve and no overflow memo here: both existed only to keep
  ;; descriptors from bringing forward a whole-page DROP, and the drop is gone.
  ;;
  ;; A page that is not compiled yet answers 1: the publish creates it.
  ;; ROUND 17: $reserve is headroom this publish must leave behind it in the
  ;; DESCRIPTOR chunk, and it exists for one reason only -- to stop the
  ;; one-block family from spending the page's last bytes on descriptors a
  ;; region install would have used better. A region install passes 0 and is
  ;; therefore admitted on exactly the terms round 14 gave it; a one-block
  ;; install passes $page_desc_rg_reserve. It is NOT the threaded chunk's
  ;; reserve reintroduced: overflowing this chunk is still a local decline and
  ;; still cannot drop a page, so nothing here is protecting against a drop.
  (func $page_desc_would_fit (param $start_eip i32) (param $len i32)
                             (param $reserve i32) (result i32)
    (local $slot i32) (local $base i32) (local $used i32)
    (if (i32.gt_u (local.get $len) (global.get $PAGE_CHUNK_BYTES))
      (then (return (i32.const 0))))
    (local.set $base (i32.and (local.get $start_eip) (i32.const 0xFFFFF000)))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $base))
      (then (return (i32.const 1))))
    (local.set $used (call $page_desc_used (call $page_dword (local.get $slot))))
    ;; Would it have fitted WITHOUT the reserve? Answering that here is what
    ;; makes the counter mean "the reserve is what declined this", rather than
    ;; "the chunk was full anyway" -- which is the difference between a policy
    ;; that is doing something and one that is inert.
    (if (i32.gt_u (local.get $reserve) (i32.const 0))
      (then
        (if (i32.and
              (i32.le_u (i32.add (local.get $used) (local.get $len))
                        (global.get $PAGE_CHUNK_BYTES))
              (i32.gt_u (i32.add (local.get $used)
                          (i32.add (local.get $len) (local.get $reserve)))
                        (global.get $PAGE_CHUNK_BYTES)))
          (then
            (global.set $page_desc_reserve_declines
              (i32.add (global.get $page_desc_reserve_declines) (i32.const 1)))))))
    (i32.le_u
      (i32.add (local.get $used) (i32.add (local.get $len) (local.get $reserve)))
      (global.get $PAGE_CHUNK_BYTES)))

  (func $page_would_fit (param $start_eip i32) (param $len i32)
                        (param $reserve i32) (result i32)
    (local $slot i32) (local $base i32)
    (if (i32.gt_u (local.get $len) (global.get $PAGE_CHUNK_BYTES))
      (then (return (i32.const 0))))
    (local.set $base (i32.and (local.get $start_eip) (i32.const 0xFFFFF000)))
    ;; This page has overflowed before, so its compiled code does not fit in
    ;; 16KB and every byte an optional publish spends brings the next drop
    ;; forward. Refusing outright was measured and is too blunt -- the pages
    ;; that overflow are the hot ones, and the family's installs fell from
    ;; 27,711 to 4,795 on the quake2 window. Ask for a much bigger reserve
    ;; instead: descriptors land while the chunk is still low and stop once it
    ;; is filling.
    (if (call $page_ovfl_memo (local.get $base))
      (then (local.set $reserve
              (i32.add (local.get $reserve) (i32.const 6144)))))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    ;; Not compiled yet: the publish creates the page at the class that fits.
    (if (i32.ne (i32.load (local.get $slot)) (local.get $base))
      (then (return (i32.const 1))))
    (i32.le_u
      (i32.add (call $page_desc_used (i32.load offset=12 (local.get $slot)))
               (i32.add (local.get $len) (local.get $reserve)))
      (global.get $PAGE_CHUNK_BYTES)))

  ;; Retire one page. This is what makes the fast path safe without a
  ;; generation counter: a dropped page can no longer be named by the page
  ;; registers, so a stale chunk pointer is unreachable rather than merely
  ;; unlikely.
  (func $page_dir_drop_mode (param $page_base i32) (param $defer i32)
    (local $slot i32) (local $idx i32) (local $chunk i32) (local $desc i32)
    (local $dchunk i32) (local $dword i32)
    (local.set $slot (call $page_dir_slot (local.get $page_base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $page_base)) (then (return)))
    ;; The page's index is about to go, so nothing can be entered here again --
    ;; but a block already executing from this chunk may still reach a chain
    ;; word pointing at a block on the dropped page.
    (call $chain_bump)
    (local.set $idx (i32.load offset=4 (local.get $slot)))
    (local.set $chunk (i32.load offset=8 (local.get $slot)))
    (local.set $desc (i32.load offset=12 (local.get $slot)))
    (local.set $dchunk (call $page_dchunk (local.get $slot)))
    (local.set $dword (call $page_dword (local.get $slot)))
    (call $page_chunk_sample (call $page_desc_used (local.get $desc)))
    (if (local.get $idx)
      (then
        (i32.store (local.get $idx) (global.get $page_index_free))
        (global.set $page_index_free (local.get $idx))))
    (i32.store (local.get $slot) (i32.const 0))
    (i32.store offset=4 (local.get $slot) (i32.const 0))
    (i32.store offset=8 (local.get $slot) (i32.const 0))
    (i32.store offset=12 (local.get $slot) (i32.const 0))
    (i32.store offset=16 (local.get $slot) (i32.const 0))
    (i32.store offset=20 (local.get $slot) (i32.const 0))
    (if (i32.eq (global.get $cur_page_base) (local.get $page_base))
      (then
        (global.set $cur_page_base (i32.const 0))
        (global.set $cur_page_index (i32.const 0))
        (global.set $cur_page_chunk (i32.const 0))
        (global.set $cur_page_desc (i32.const 0))
        (global.set $cur_page_chunk_cap (i32.const 0))
        (global.set $cur_page_desc_cap (i32.const 0))))
    ;; The descriptor chunk is never the one a suspended stream is running
    ;; from at a DEFERRED drop -- that path exists for the block $decode_run
    ;; has already saved, which is always threaded code -- so it goes back on
    ;; its free list through the same safety test the ordinary chunk uses.
    (if (local.get $dchunk)
      (then (call $page_chunk_put_if_safe
              (local.get $dchunk) (call $page_desc_class (local.get $dword)))))
    (if (local.get $defer)
      (then
        (if (i32.and
              (i32.eqz (global.get $sync_msg_depth))
              (i32.eqz (global.get $page_chunk_deferred)))
          (then
            (global.set $page_chunk_deferred (local.get $chunk))
            (global.set $page_chunk_deferred_class (call $page_desc_class (local.get $desc))))))
      (else
        (call $page_chunk_put_if_safe
          (local.get $chunk) (call $page_desc_class (local.get $desc))))))

  (func $page_dir_drop (param $page_base i32)
    (call $page_dir_drop_mode (local.get $page_base) (i32.const 0)))

  (func $page_dir_drop_deferred (param $page_base i32)
    (call $page_dir_drop_mode (local.get $page_base) (i32.const 1)))

  ;; Give $page_base an index and a chunk, and leave the page registers loaded
  ;; on it. Returns 0 (and compiles nothing) if either resource is exhausted.
  ;; The chunk is bumped off $thread_alloc rather than out of a private arena so
  ;; that $thread_arena_flush_if_safe and $clear_cache — which already know when
  ;; recycling decoded code is safe — keep covering it; $clear_cache calls
  ;; $page_dir_reset for exactly that reason.
  (func $page_create (param $page_base i32) (param $needed i32) (result i32)
    (local $slot i32) (local $idx i32) (local $chunk i32) (local $class i32)
    (local.set $slot (call $page_dir_slot (local.get $page_base)))
    ;; The directory is direct-mapped, so a live page can be sitting in the slot
    ;; this one wants. Retire it properly instead of overwriting its index
    ;; pointer, which would leak the 8KB and leave $cur_page_* naming it.
    (if (i32.load (local.get $slot))
      (then
        (global.set $cache_evicts (i32.add (global.get $cache_evicts) (i32.const 1)))
        (call $page_dir_drop (i32.load (local.get $slot)))))
    (local.set $idx (call $page_index_alloc))
    (if (i32.eqz (local.get $idx)) (then (return (i32.const 0))))
    (local.set $class (call $page_chunk_class_for (local.get $needed)))
    (if (i32.lt_s (local.get $class) (i32.const 0))
      (then
        (i32.store (local.get $idx) (global.get $page_index_free))
        (global.set $page_index_free (local.get $idx))
        (return (i32.const 0))))
    (local.set $chunk (call $page_chunk_alloc (local.get $class)))
    (if (i32.eqz (local.get $chunk))
      (then
        ;; Hand the index straight back and ask the next safe block boundary to
        ;; recycle the arena. The just-decoded block still runs from scratch.
        (i32.store (local.get $idx) (global.get $page_index_free))
        (global.set $page_index_free (local.get $idx))
        (global.set $thread_flush_pending (i32.const 1))
        (return (i32.const 0))))
    (call $page_index_clear (local.get $idx))
    (i32.store (local.get $slot) (local.get $page_base))
    (i32.store offset=4 (local.get $slot) (local.get $idx))
    (i32.store offset=8 (local.get $slot) (local.get $chunk))
    (i32.store offset=12 (local.get $slot)
      (i32.shl (local.get $class) (i32.const 16)))
    (i32.store offset=16 (local.get $slot) (i32.const 0))
    (i32.store offset=20 (local.get $slot) (i32.const 0))
    (i32.store offset=24 (local.get $slot) (i32.const 1))  ;; referenced
    (global.set $page_compiles (i32.add (global.get $page_compiles) (i32.const 1)))
    (global.set $cur_page_base (local.get $page_base))
    (global.set $cur_page_index (local.get $idx))
    (global.set $cur_page_chunk (local.get $chunk))
    (global.set $cur_page_desc (i32.const 0))
    (global.set $cur_page_chunk_cap (call $page_chunk_bytes (local.get $class)))
    (global.set $cur_page_desc_cap (i32.const 0))
    (i32.const 1))

  ;; Copy a freshly decoded block out of the arena into its page's chunk and
  ;; index it. Threaded code is position-independent — every operand a handler
  ;; reads is a guest address, an immediate or a register number, never a
  ;; pointer into the thread stream — so a block can be relocated with a plain
  ;; byte copy. That is what lets the decoder stay exactly as it is: it emits
  ;; where it always did, and this runs afterwards.
  ;;
  ;; Returns the chunk offset the block landed at, or -1 when nothing was
  ;; published. $decode_run needs that number: the only way it may treat one
  ;; block's not-taken branch as "just carry on down the stream" is if the next
  ;; block really did land immediately after this one, and a return of -1 (or of
  ;; an offset that is not where the previous block ended) is how a page swap, a
  ;; full chunk or an arena flush announces itself.
  ;; Set by $page_publish when the stream it just published went into the
  ;; DESCRIPTOR chunk, so $publish_block knows which base to add the returned
  ;; offset to and that the address-ordered run must stop here.
  (global $page_pub_was_desc (mut i32) (i32.const 0))

  ;; ----------------------------------------------------------------------
  ;; $page_publish_desc -- round 14. Publish a block-executor descriptor into
  ;; the page's SECOND chunk.
  ;;
  ;; Everything an ordinary publish does, except three things, and each of the
  ;; three is the point of the round:
  ;;
  ;;   * it never drops the page. A descriptor that does not fit returns -1
  ;;     and the caller publishes the ordinary threaded block instead, so the
  ;;     worst case of an install is a DECLINE rather than 4096 bytes of other
  ;;     people's compiled code thrown away.
  ;;   * it writes no op-boundary bitmaps. Those describe threaded words, and
  ;;     a descriptor has none; $page_cached_ops reads a descriptor through the
  ;;     displaced-stream copy in its fallback pool instead.
  ;;   * its index entries carry $PAGE_INDEX_DESC, which is what sends
  ;;     $page_resolve to the second chunk.
  ;; ----------------------------------------------------------------------
  (func $page_publish_desc (param $start_eip i32) (param $tstart i32)
                           (param $tend i32) (param $guest_end i32) (result i32)
    (local $base i32) (local $slot i32) (local $used i32) (local $len i32)
    (local $dword i32) (local $class i32) (local $needed i32)
    (local $chunk i32) (local $new_chunk i32) (local $new_class i32)
    (local $o i32) (local $olast i32) (local $overlap_stop i32)
    (local.set $len (i32.sub (local.get $tend) (local.get $tstart)))
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const -1))))
    (local.set $base (i32.and (local.get $start_eip) (i32.const 0xFFFFF000)))
    (if (i32.ne (local.get $base) (global.get $cur_page_base))
      (then
        (if (i32.eqz (call $page_enter (local.get $base)))
          (then
            ;; The page does not exist yet. Create it at the smallest class --
            ;; the threaded chunk this makes is empty and will grow on its own
            ;; terms; what is wanted here is the index.
            (if (i32.eqz (call $page_create (local.get $base) (i32.const 1)))
              (then (return (i32.const -1))))))))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    ;; Same index invariant as the threaded publish: any live block covering a
    ;; byte must be the block that byte names. Retire whatever the descriptor's
    ;; guest extent overlaps, in EITHER chunk -- $page_retire_at reads the
    ;; owner's chunk bit and breaks the right one.
    (local.set $o (i32.and (local.get $start_eip) (i32.const 0xFFF)))
    (local.set $overlap_stop (i32.sub (local.get $guest_end) (local.get $base)))
    (if (i32.gt_u (local.get $overlap_stop) (i32.const 4096))
      (then (local.set $overlap_stop (i32.const 4096))))
    (block $overlap_done (loop $overlap_scan
      (br_if $overlap_done (i32.ge_u (local.get $o) (local.get $overlap_stop)))
      (local.set $o (call $page_retire_at (local.get $slot) (local.get $o)))
      (br $overlap_scan)))
    (local.set $dword (call $page_dword (local.get $slot)))
    (local.set $used (call $page_desc_used (local.get $dword)))
    (local.set $class (call $page_desc_class (local.get $dword)))
    (local.set $chunk (call $page_dchunk (local.get $slot)))
    (local.set $needed (i32.add (local.get $used) (local.get $len)))
    ;; The descriptor chunk is full. DECLINE -- do not drop the page. This is
    ;; the whole behavioural difference from round 13, and the reason installs
    ;; can be generous again.
    (if (i32.gt_u (local.get $needed) (global.get $PAGE_CHUNK_BYTES))
      (then
        (global.set $page_desc_chunk_full
          (i32.add (global.get $page_desc_chunk_full) (i32.const 1)))
        (return (i32.const -1))))
    (if (i32.eqz (local.get $chunk))
      (then
        (local.set $class (call $page_chunk_class_for (local.get $needed)))
        (if (i32.lt_s (local.get $class) (i32.const 0)) (then (return (i32.const -1))))
        (local.set $chunk (call $page_chunk_alloc (local.get $class)))
        (if (i32.eqz (local.get $chunk)) (then (return (i32.const -1))))
        (global.set $page_desc_chunk_allocs
          (i32.add (global.get $page_desc_chunk_allocs) (i32.const 1)))
        (i32.store offset=16 (local.get $slot) (local.get $chunk))
        (global.set $cur_page_desc (local.get $chunk))
        (global.set $cur_page_desc_cap (call $page_chunk_bytes (local.get $class)))))
    (if (i32.gt_u (local.get $needed) (call $page_chunk_bytes (local.get $class)))
      (then
        ;; Growing relocates every descriptor already in the chunk. A nested
        ;; synchronous dispatch can have one of them suspended, so decline
        ;; instead, exactly as the threaded grow does.
        (if (global.get $sync_msg_depth) (then (return (i32.const -1))))
        (local.set $new_class (call $page_chunk_class_for (local.get $needed)))
        (local.set $new_chunk (call $page_chunk_alloc (local.get $new_class)))
        (if (i32.eqz (local.get $new_chunk)) (then (return (i32.const -1))))
        (memory.copy (local.get $new_chunk) (local.get $chunk) (local.get $used))
        (i32.store offset=16 (local.get $slot) (local.get $new_chunk))
        (call $page_chunk_put (local.get $chunk) (local.get $class))
        (local.set $chunk (local.get $new_chunk))
        (local.set $class (local.get $new_class))
        (global.set $cur_page_desc (local.get $new_chunk))
        (global.set $cur_page_desc_cap (call $page_chunk_bytes (local.get $new_class)))
        (global.set $page_desc_chunk_grows
          (i32.add (global.get $page_desc_chunk_grows) (i32.const 1)))))
    (memory.copy (i32.add (local.get $chunk) (local.get $used))
                 (local.get $tstart) (local.get $len))
    (i32.store16
      (i32.add (global.get $cur_page_index)
        (i32.shl (i32.and (local.get $start_eip) (i32.const 0xFFF)) (i32.const 1)))
      (i32.or (local.get $used) (global.get $PAGE_INDEX_DESC)))
    (local.set $o (i32.add (i32.and (local.get $start_eip) (i32.const 0xFFF)) (i32.const 1)))
    (local.set $olast (i32.sub (local.get $guest_end) (local.get $base)))
    (if (i32.gt_u (local.get $olast) (i32.const 4096))
      (then (local.set $olast (i32.const 4096))))
    (block $md (loop $ms
      (br_if $md (i32.ge_u (local.get $o) (local.get $olast)))
      (i32.store16
        (i32.add (global.get $cur_page_index) (i32.shl (local.get $o) (i32.const 1)))
        (i32.or (local.get $used)
          (i32.or (global.get $PAGE_INDEX_DESC) (global.get $PAGE_INDEX_COVER))))
      (local.set $o (i32.add (local.get $o) (i32.const 1)))
      (br $ms)))
    (i32.store offset=20 (local.get $slot)
      (i32.or (i32.shl (local.get $class) (i32.const 16))
              (i32.add (local.get $used) (local.get $len))))
    (global.set $page_pub_was_desc (i32.const 1))
    (local.get $used))

  (func $page_publish (param $start_eip i32) (param $tstart i32) (param $tend i32)
                      (param $guest_end i32) (result i32)
    (local $base i32) (local $slot i32) (local $used i32) (local $len i32)
    (local $desc i32) (local $class i32) (local $needed i32)
    (local $old_chunk i32) (local $new_chunk i32) (local $new_class i32)
    (local $o i32) (local $olast i32) (local $overlap_stop i32)
    (local.set $len (i32.sub (local.get $tend) (local.get $tstart)))
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const -1))))
    ;; Round 14: a block-executor descriptor goes into the page's OTHER chunk.
    ;; The test is the stream itself -- a descriptor opens with the executor's
    ;; handler index -- so no caller has to be told apart and no parameter is
    ;; threaded through the decoder for it. $BX_HANDLER is never a legal first
    ;; handler of an ordinary decoded block: the decoder emits it nowhere, only
    ;; $block_exec_try_install and $bx_region_finish do.
    (global.set $page_pub_was_desc (i32.const 0))
    (if (call $bx_is_desc_word (i32.load (local.get $tstart)))
      (then
        (return (call $page_publish_desc (local.get $start_eip) (local.get $tstart)
                  (local.get $tend) (local.get $guest_end)))))
    (local.set $base (i32.and (local.get $start_eip) (i32.const 0xFFFFF000)))
    ;; The decoder caps every block at its starting page (see the page-boundary
    ;; split in $decode_block), so a block's x86 is inside one page and its
    ;; whole extent is indexable here. Only the last *instruction* can spill a
    ;; few bytes over the edge; those bytes get no cover entry, exactly as they
    ;; got no hash entry before, and a write to them does not retire the block.
    ;; That hole is unchanged from the hash design, not introduced by this one.
    (if (i32.ne (local.get $base) (global.get $cur_page_base))
      (then
        (if (i32.eqz (call $page_enter (local.get $base)))
          (then
            (if (i32.eqz (call $page_create (local.get $base) (local.get $len)))
              (then (return (i32.const -1))))))))
    (local.set $slot (call $page_dir_slot (local.get $base)))
    ;; The byte index has one owner per guest offset. A control transfer into
    ;; the middle of an existing block therefore cannot merely overwrite that
    ;; block's cover entries: doing so would leave its distinct entry point
    ;; live while hiding it from a later write to the shared bytes. Storm's
    ;; count-dependent SCode entries do exactly this, and the hidden old block
    ;; then executes a stale generated jump after the shared tail is patched.
    ;;
    ;; Retire every old block touched by the new guest extent before publishing
    ;; it. This preserves the index invariant that any live block covering a
    ;; byte is the block named by that byte. Re-entering a retired outer entry
    ;; simply decodes it again (and symmetrically retires the interior entry).
    (local.set $o (i32.and (local.get $start_eip) (i32.const 0xFFF)))
    (local.set $overlap_stop (i32.sub (local.get $guest_end) (local.get $base)))
    (if (i32.gt_u (local.get $overlap_stop) (i32.const 4096))
      (then (local.set $overlap_stop (i32.const 4096))))
    (block $overlap_done (loop $overlap_scan
      (br_if $overlap_done (i32.ge_u (local.get $o) (local.get $overlap_stop)))
      (local.set $o (call $page_retire_at (local.get $slot) (local.get $o)))
      (br $overlap_scan)))
    (local.set $desc (i32.load offset=12 (local.get $slot)))
    (local.set $used (call $page_desc_used (local.get $desc)))
    (local.set $class (call $page_desc_class (local.get $desc)))
    (local.set $needed (i32.add (local.get $used) (local.get $len)))
    (if (i32.gt_u (local.get $needed) (global.get $PAGE_CHUNK_BYTES))
      (then
        ;; Rebuild around the still-hot subset on the next entry, as the fixed
        ;; allocator did. The old chunk cannot be reused until decode_run's
        ;; already-saved first block has executed, so retirement is deferred to
        ;; the next safe return to $run.
        (call $page_ovfl_note (local.get $base))
        (call $page_dir_drop_deferred (local.get $base))
        (return (i32.const -1))))
    (if (i32.gt_u (local.get $needed) (call $page_chunk_bytes (local.get $class)))
      (then
        ;; A synchronous nested guest dispatch can have an outer decoded block
        ;; suspended in this same chunk. Let this block run from scratch and
        ;; grow on a later top-level miss instead of moving that live stream.
        (if (global.get $sync_msg_depth) (then (return (i32.const -1))))
        (local.set $new_class (call $page_chunk_class_for (local.get $needed)))
        (local.set $new_chunk (call $page_chunk_alloc (local.get $new_class)))
        (if (i32.eqz (local.get $new_chunk))
          (then
            (global.set $thread_flush_pending (i32.const 1))
            (return (i32.const -1))))
        (local.set $old_chunk (global.get $cur_page_chunk))
        (memory.copy (local.get $new_chunk) (local.get $old_chunk) (local.get $used))
        (i32.store offset=8 (local.get $slot) (local.get $new_chunk))
        (i32.store offset=12 (local.get $slot)
          (i32.or (call $page_desc_spanreg (local.get $desc))
            (i32.or (i32.shl (local.get $new_class) (i32.const 16)) (local.get $used))))
        (global.set $cur_page_chunk (local.get $new_chunk))
        (global.set $cur_page_chunk_cap (call $page_chunk_bytes (local.get $new_class)))
        ;; No decoded block is executing while a top-level miss is being
        ;; published. $decode_run adjusts its local first-block pointer when it
        ;; observes this relocation.
        (call $page_chunk_put (local.get $old_chunk) (local.get $class))
        (global.set $page_chunk_grows
          (i32.add (global.get $page_chunk_grows) (i32.const 1)))
        (local.set $class (local.get $new_class))))
    ;; Same move as the grow path above, over the same disjoint regions: the
    ;; staging span [$tstart,$tend) is $len bytes and never overlaps a page
    ;; chunk. $len is the size every bound above was decided against, so the
    ;; copy is exactly it -- the dword loop rounded up to the next word.
    (memory.copy
      (i32.add (global.get $cur_page_chunk) (local.get $used))
      (local.get $tstart)
      (local.get $len))
    ;; Persist this block's op boundaries alongside it, so a later pass can read
    ;; the published stream without re-decoding. Section 22.
    (call $page_opbits_publish (local.get $tstart) (local.get $used) (local.get $len))
    ;; Index the entry point, then mark every interior byte of the block's x86
    ;; as covered by it. The cover marks are what make section 5's invalidation
    ;; a single load: a write anywhere in the block's guest bytes names the
    ;; block. Interior bytes must be written even where the index already holds
    ;; NONE, and the walk stops at the page edge because the last instruction
    ;; may spill past it.
    (i32.store16
      (i32.add (global.get $cur_page_index)
        (i32.shl (i32.and (local.get $start_eip) (i32.const 0xFFF)) (i32.const 1)))
      (local.get $used))
    (local.set $o (i32.add (i32.and (local.get $start_eip) (i32.const 0xFFF)) (i32.const 1)))
    (local.set $olast (i32.sub (local.get $guest_end) (local.get $base)))
    (if (i32.gt_u (local.get $olast) (i32.const 4096))
      (then (local.set $olast (i32.const 4096))))
    (block $md (loop $ms
      (br_if $md (i32.ge_u (local.get $o) (local.get $olast)))
      (i32.store16
        (i32.add (global.get $cur_page_index) (i32.shl (local.get $o) (i32.const 1)))
        (i32.or (local.get $used) (global.get $PAGE_INDEX_COVER)))
      (local.set $o (i32.add (local.get $o) (i32.const 1)))
      (br $ms)))
    (i32.store offset=12 (local.get $slot)
      (i32.or (call $page_desc_spanreg (local.get $desc))
        (i32.or
          (i32.shl (local.get $class) (i32.const 16))
          (i32.add (local.get $used) (local.get $len)))))
    (local.get $used))

  ;; Load the page registers for $page_base if it is already compiled.
  (func $page_enter (param $page_base i32) (result i32)
    (local $slot i32)
    (local.set $slot (call $page_dir_slot (local.get $page_base)))
    (if (i32.ne (i32.load (local.get $slot)) (local.get $page_base))
      (then (return (i32.const 0))))
    ;; Referenced bit for $page_index_alloc's second-chance clock. Only a
    ;; page-crossing transfer reaches here, so it costs one store per crossing.
    (i32.store offset=24 (local.get $slot) (i32.const 1))
    (global.set $cur_page_base (local.get $page_base))
    (global.set $cur_page_index (i32.load offset=4 (local.get $slot)))
    (global.set $cur_page_chunk (i32.load offset=8 (local.get $slot)))
    (global.set $cur_page_desc (call $page_dchunk (local.get $slot)))
    ;; A cap is only meaningful beside a real base: a page that has never had a
    ;; descriptor chunk keeps 0/0, which makes the membership test below false
    ;; for every address rather than true for everything near 0.
    (global.set $cur_page_chunk_cap
      (call $page_chunk_bytes
        (call $page_desc_class (i32.load offset=12 (local.get $slot)))))
    (global.set $cur_page_desc_cap
      (select (i32.const 0)
        (call $page_chunk_bytes
          (call $page_desc_class (call $page_dword (local.get $slot))))
        (i32.eqz (call $page_dchunk (local.get $slot)))))
    (i32.const 1))

  ;; The hot path. Resolve a guest address to a threaded-code pointer without
  ;; touching the hash, or 0 to mean "use the ordinary path". Straight-line
  ;; execution inside one page costs one compare and one load; only a
  ;; page-crossing transfer consults PAGE_DIR, and it caches the result.
  (func $page_resolve (param $dest i32) (result i32)
    (local $base i32) (local $off i32)
    (local.set $base (i32.and (local.get $dest) (i32.const 0xFFFFF000)))
    (if (i32.ne (local.get $base) (global.get $cur_page_base))
      (then
        (if (i32.eqz (call $page_enter (local.get $base)))
          (then
            (global.set $page_misses (i32.add (global.get $page_misses) (i32.const 1)))
            (return (i32.const 0))))))
    (local.set $off
      (i32.load16_u
        (i32.add (global.get $cur_page_index)
          (i32.shl (i32.and (local.get $dest) (i32.const 0xFFF)) (i32.const 1)))))
    ;; One test covers both misses: PAGE_INDEX_NONE (0xFFFF, nothing compiled
    ;; here) and a cover mark (bit 14 set, this byte is inside a block but is
    ;; not its entry point, so entering here would run from the middle of an
    ;; instruction). Round 14 made it an AND rather than a compare because the
    ;; entry space now has a high half: a descriptor entry is 0x8000..0xBFFF
    ;; and a descriptor cover mark 0xC000..0xFFFE, and bit 14 still separates
    ;; them exactly as it does in the low half.
    (if (i32.and (local.get $off) (global.get $PAGE_INDEX_COVER))
      (then
        (global.set $page_misses (i32.add (global.get $page_misses) (i32.const 1)))
        (return (i32.const 0))))
    (global.set $page_hits (i32.add (global.get $page_hits) (i32.const 1)))
    ;; Bit 15 picks the chunk. Branchless on purpose: this is the hot path and
    ;; a descriptor entry is rare, so a predicted-taken branch would be worse
    ;; than the select.
    ;; Bit 0 of the result is the entry's no-bump mark (01-header,
    ;; PAGE_INDEX_NOBUMP); a chunk base is word-aligned, so every caller gets
    ;; the pointer back with `& -2`.
    (i32.add
      (select (global.get $cur_page_desc) (global.get $cur_page_chunk)
              (i32.and (local.get $off) (global.get $PAGE_INDEX_DESC)))
      (i32.and (local.get $off)
        (i32.or (global.get $PAGE_INDEX_OFFMASK) (global.get $PAGE_INDEX_NOBUMP)))))

  ;; "Is there already compiled code entered at this address?" -- the question
  ;; $decode_run asks before extending a run into the next block. Unlike
  ;; $page_resolve this moves no page registers and counts no hit or miss: it
  ;; is a decode-time query about a page that may not be the executing one, and
  ;; letting it swap $cur_page_* underneath a run in progress would repoint the
  ;; chunk the run is being appended to.
  (func $page_probe (param $ga i32) (result i32)
    (local $slot i32) (local $idx i32)
    (local.set $slot (call $page_dir_slot (i32.and (local.get $ga) (i32.const 0xFFFFF000))))
    (if (i32.ne (i32.load (local.get $slot)) (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
      (then (return (i32.const 0))))
    (local.set $idx (i32.load offset=4 (local.get $slot)))
    ;; "Entry point in EITHER chunk" -- a descriptor is compiled code too, and
    ;; reading it as "not compiled" would have $decode_run extend a run into a
    ;; block that is already installed and decode it again.
    (i32.eqz
      (i32.and
        (i32.load16_u
          (i32.add (local.get $idx)
            (i32.shl (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 1))))
        (global.get $PAGE_INDEX_COVER))))

  ;; Every block-terminating handler ends by tail-calling this instead of
  ;; returning. Returning is what costs: it unwinds to the top of $run, which
  ;; re-runs the whole guard preamble before it can look the destination up.
  ;; When the destination is already compiled and none of those guards has
  ;; anything to say, the guards are exactly the work being removed, so this
  ;; hands the thread straight to $next.
  ;;
  ;; The five tests below are the guards that can actually fire; each is a
  ;; global that is zero in a plain run, and any non-zero one falls back to the
  ;; desk rather than trying to reproduce what the desk does:
  ;;   $dbg_chain_guard  OR of the debug arming flags; benchmark mode exempts
  ;;                 only the breakpoint, whose target is checked separately
  ;;   $code16       16-bit tasks get two extra checks and a separate dispatch
  ;;   $yield_flag   a handler asked the host for control
  ;;   $yield_reason a blocking API is parked; $run decides whether to halt
  ;;   $sbh_eip_a/b  the decoder recognised an MSVC small-block-heap entry, and
  ;;                 $run runs a scan ahead of those two addresses
  ;; The thunk zone needs no test here: a thunk page is never compiled, so
  ;; $page_resolve cannot name one.
  ;; ----------------------------------------------------------------------
  ;; Which of the loaded page's two chunks holds $a, or -1 for neither.
  ;; 0 = the threaded stream chunk, 1 = the block-executor descriptor chunk.
  ;;
  ;; The bound is each chunk's REAL allocated capacity, never the nominal
  ;; $PAGE_CHUNK_BYTES: chunks are bump-allocated back to back out of one
  ;; arena, so a loose bound would happily accept an address in the next
  ;; chunk -- which belongs to a different page. A base of 0 carries a cap of
  ;; 0, so an unallocated chunk matches nothing rather than matching low
  ;; addresses.
  ;; ----------------------------------------------------------------------
  (func $chain_chunk_of (param $a i32) (result i32)
    (if (i32.lt_u (i32.sub (local.get $a) (global.get $cur_page_chunk))
                  (global.get $cur_page_chunk_cap))
      (then (return (i32.const 0))))
    (if (i32.lt_u (i32.sub (local.get $a) (global.get $cur_page_desc))
                  (global.get $cur_page_desc_cap))
      (then (return (i32.const 1))))
    (i32.const -1))

  ;; ----------------------------------------------------------------------
  ;; Write the resolved target back into the terminator's operand word, as a
  ;; chunk selector plus a dword offset inside that chunk, plus the epoch.
  ;; Refused unless BOTH words live inside one of the loaded page's two
  ;; chunks -- they need not be the SAME chunk any more, which is the whole
  ;; round: an executor tail's anchor is in the descriptor chunk and its
  ;; target is usually an ordinary block in the stream chunk.
  ;;
  ;; That test is still what confines a chain to one page (the page registers
  ;; name one page's two chunks), what bounds the offset to 12 bits of dword,
  ;; and what rejects a stream still executing out of the emit scratch.
  ;; ----------------------------------------------------------------------
  (func $chain_patch (param $patch_at i32) (param $t i32) (param $shift i32)
                     (param $tag i32)
    (local $tsel i32) (local $asel i32) (local $off i32) (local $lowmask i32)
    (if (i32.gt_u (global.get $chain_epoch) (global.get $CHAIN_EPOCH_MAX))
      (then (return)))
    (local.set $tsel (call $chain_chunk_of (local.get $t)))
    (if (i32.lt_s (local.get $tsel) (i32.const 0))
      (then (global.set $chain_refuse_target
              (i32.add (global.get $chain_refuse_target) (i32.const 1)))
            (return)))
    (local.set $asel (call $chain_chunk_of (local.get $patch_at)))
    (if (i32.lt_s (local.get $asel) (i32.const 0))
      (then (global.set $chain_refuse_anchor
              (i32.add (global.get $chain_refuse_anchor) (i32.const 1)))
            (return)))
    ;; Every threaded word is 4-byte aligned -- $te and $te_raw are the only
    ;; writers and both bump by multiples of 4 -- so the two low bits carry no
    ;; information and are what the 16KB cap fits into 12 bits of index.
    (local.set $off
      (i32.shr_u
        (i32.sub (local.get $t)
          (select (global.get $cur_page_desc) (global.get $cur_page_chunk)
                  (local.get $tsel)))
        (i32.const 2)))
    (local.set $lowmask
      (i32.sub (i32.shl (i32.const 1) (local.get $shift)) (i32.const 1)))
    (i32.store (local.get $patch_at)
      (i32.or
        (i32.and (i32.load (local.get $patch_at)) (local.get $lowmask))
        (i32.shl
          (i32.or
            (i32.shl (global.get $chain_epoch) (i32.const 14))
            (i32.or
              (i32.shl (local.get $tsel) (i32.const 13))
              (i32.or
                (i32.shl (i32.and (local.get $off) (i32.const 0xFFF))
                         (i32.const 1))
                (local.get $tag))))
          (local.get $shift))))
    (global.set $chain_slots_live (i32.const 1))
    (global.set $chain_patches (i32.add (global.get $chain_patches) (i32.const 1)))
    (if (local.get $asel)
      (then (global.set $chain_patches_pool
              (i32.add (global.get $chain_patches_pool) (i32.const 1))))))

  ;; ----------------------------------------------------------------------
  ;; ROUND 19. Perform the block executor's discovery bump on behalf of a
  ;; transfer that is about to skip the desk, and say whether the chain slot
  ;; survived it. Returns 1 when the caller may still follow the slot: either
  ;; discovery is not armed at all (the common case, one global load), or the
  ;; bump changed nothing this slot depends on.
  ;;
  ;; A 0 sets $chain_hot_bumped, which $branch_end_at consumes instead of
  ;; bumping again -- the bump has to happen exactly once per transfer or the
  ;; walk probes land at different entries than they do with chaining off, and
  ;; "identical block decodes" is the gate this whole round is measured by.
  ;; ----------------------------------------------------------------------
  (func $chain_hot_ok (param $patch_at i32) (param $asel i32) (result i32)
    (local $ep0 i32)
    (if (i32.eqz (global.get $bx_hot_on)) (then (return (i32.const 1))))
    (local.set $ep0 (global.get $chain_epoch))
    (call $bx_hot_bump (global.get $eip))
    (if (i32.and
          (i32.eq (global.get $chain_epoch) (local.get $ep0))
          (i32.eq (call $chain_chunk_of (local.get $patch_at)) (local.get $asel)))
      (then (return (i32.const 1))))
    (global.set $chain_hot_bumped (i32.const 1))
    (i32.const 0))

  ;; ----------------------------------------------------------------------
  ;; The chained transfer itself. $chain is the operand word with the Jcc's two
  ;; adjacency bits already shifted off, so its high half is the epoch and its
  ;; low half the signed delta.
  ;;
  ;; Everything $branch_end does per transfer is done here too, and in the same
  ;; order: the four guard globals, the budget test and its decrement, the two
  ;; dbg_prev stores. What is NOT here is $page_resolve and the call that
  ;; reaches it. The $sbh_eip_a/b pair is handled at patch time instead -- see
  ;; $sbh_note in the decoder, which bumps the epoch.
  ;;
  ;; ROUND 19 -- the block executor's discovery gate. Round 15 put $bx_hot_on
  ;; in the guard set, which made "the executor is armed" mean "nothing
  ;; chains", and that was the other half of the mutual exclusion. It is
  ;; PERFORMED here now instead: $bx_hot_bump is what counts entries into a
  ;; head, and a transfer that skips the desk is still an entry, so skipping
  ;; the bump would silently stop hot heads from being discovered. It is bumped
  ;; exactly once per transfer either way -- here when this call commits to the
  ;; jump, in $branch_end_at when it does not -- and $chain_hot_bumped carries
  ;; the one case where both would otherwise fire.
  ;;
  ;; The bump can decode, install a descriptor and free a chunk, so it runs
  ;; LAST, after every other test, and its two side effects are re-tested
  ;; afterwards: an epoch that moved means something was retired or freed, and
  ;; an anchor that no longer sits in the same chunk means the page registers
  ;; moved. Either sends this transfer to the desk, where $page_resolve gives
  ;; it the descriptor the walk just installed.
  ;; ----------------------------------------------------------------------
  (func $chain_end (param $patch_at i32) (param $chain i32) (param $shift i32)
                   (param $tag i32)
     (local $nx_fn i32) (local $nx_op i32) (local $asel i32) (local $tsel i32) (local $off4 i32)
    ;; The anchor's own chunk, which is also the ROUND-19 VALIDITY TEST for the
    ;; page registers this function is about to read a chunk base out of. A
    ;; chained transfer does not call $page_resolve, so $cur_page_* are not
    ;; refreshed and can describe another page entirely -- a nested synchronous
    ;; dispatch is enough to do it. Chunks are disjoint, so an anchor that
    ;; falls inside one of the two chunks the registers currently name IS in
    ;; that chunk, which proves the registers describe the page that owns the
    ;; anchor -- the same page whose chunks $chain_patch measured the offset
    ;; against. Everything that frees, relocates or reassigns either chunk
    ;; bumps the epoch, so a slot that also passes the epoch compare is naming
    ;; a chunk that has not moved since it was written.
    (local.set $asel (call $chain_chunk_of (local.get $patch_at)))
    (if (i32.and
          (i32.ge_s (local.get $asel) (i32.const 0))
          (i32.and
            (i32.eq (i32.shr_u (local.get $chain) (i32.const 14))
                    (global.get $chain_epoch))
            (i32.eq (i32.and (local.get $chain) (i32.const 1)) (local.get $tag))))
      (then
        (if (i32.eqz
              (i32.or (i32.or (global.get $dbg_chain_guard)
                             (i32.eq (global.get $eip) (global.get $bp_addr)))
              (i32.or (global.get $code16)
              (i32.or (global.get $yield_flag) (global.get $yield_reason)))))
          (then
            (if (i32.gt_s (global.get $block_budget) (i32.const 0))
              (then
                (local.set $tsel
                  (i32.and (i32.shr_u (local.get $chain) (i32.const 13))
                           (i32.const 1)))
                (local.set $off4
                  (i32.shl
                    (i32.and (i32.shr_u (local.get $chain) (i32.const 1))
                             (i32.const 0xFFF))
                    (i32.const 2)))
                ;; Belt and braces: the offset must still be inside the
                ;; selected chunk's allocated capacity. It cannot fail while
                ;; the epoch holds -- a class shrink is a free plus an alloc,
                ;; both of which bump -- and it costs one compare to stop a
                ;; wrong answer being a wild jump rather than a desk trip.
                (if (i32.lt_u (local.get $off4)
                      (select (global.get $cur_page_desc_cap)
                              (global.get $cur_page_chunk_cap)
                              (local.get $tsel)))
                  (then
                   ;; The discovery bump goes LAST, so that a transfer which
                   ;; ends up at the desk anyway is never bumped twice. It is
                   ;; a separate `if` and not an `and` operand for exactly that
                   ;; reason: an `and` evaluates both sides.
                   (if (call $chain_hot_ok (local.get $patch_at) (local.get $asel))
                    (then
                    (global.set $block_budget
                      (i32.sub (global.get $block_budget) (i32.const 1)))
                    (global.set $steps (i32.sub (global.get $steps) (i32.const 1)))
                    (global.set $chain_hits
                      (i64.add (global.get $chain_hits) (i64.const 1)))
                    (if (local.get $asel)
                      (then (global.set $chain_hits_pool
                              (i64.add (global.get $chain_hits_pool) (i64.const 1)))))
                    (global.set $dbg_prev2_eip (global.get $dbg_prev_eip))
                    (global.set $dbg_prev_eip (global.get $eip))
                    (global.set $ip
                      (i32.add
                        (select (global.get $cur_page_desc)
                                (global.get $cur_page_chunk)
                                (local.get $tsel))
                        (local.get $off4)))
                    (dispatch-next)))))))))))
    (global.set $chain_slow (i64.add (global.get $chain_slow) (i64.const 1)))
    (if (i32.gt_s (local.get $asel) (i32.const 0))
      (then (global.set $chain_slow_pool
              (i64.add (global.get $chain_slow_pool) (i64.const 1)))))
    ;; A live-looking slot the registers could not be trusted for. Separated
    ;; from `slow` so "not chained yet" and "chained, but read from the wrong
    ;; page" are not the same number.
    (if (i32.and
          (i32.lt_s (local.get $asel) (i32.const 0))
          (i32.ne (i32.shr_u (local.get $chain) (i32.const 14)) (i32.const 0)))
      (then (global.set $chain_stale_regs
              (i64.add (global.get $chain_stale_regs) (i64.const 1)))))
    (return_call $branch_end_at (local.get $patch_at) (local.get $shift)
                 (local.get $tag)))

  (func $branch_end
    (return_call $branch_end_at (i32.const 0) (i32.const 0) (i32.const 0)))

  ;; The counters and discovery hooks $branch_end_at used to run inline, now
  ;; behind $be_gate_on. Same order as before: count, pool, hot bump.
  (func $branch_end_diag
    (if (global.get $be_stats_on)
      (then
        (global.set $branch_end_calls
          (i64.add (global.get $branch_end_calls) (i64.const 1)))
        (if (global.get $block_exec_enabled)
          (then
            (if (i32.gt_s (call $chain_chunk_of (global.get $ip)) (i32.const 0))
              (then (global.set $branch_end_pool
                      (i64.add (global.get $branch_end_pool) (i64.const 1)))))))))
    (if (global.get $bx_hot_on)
      (then
        ;; ROUND 19: unless $chain_end already bumped this transfer on its way
        ;; here, in which case the flag is spent and the bump is not repeated.
        (if (global.get $chain_hot_bumped)
          (then (global.set $chain_hot_bumped (i32.const 0)))
          (else (call $bx_hot_bump (global.get $eip)))))))

  ;; $uop_fast: the bump for a transfer that leaves $branch_end_at before it
  ;; could read the target's no-bump mark -- debug/yield guards, budget, SBH,
  ;; nothing compiled yet -- so every taken transfer still counts once, as it
  ;; did from $branch_end_diag (a run under --handler-hist or --break still
  ;; finds the same heads).
  (func $uop_fast_bump
    (if (global.get $uop_fast) (then (call $bx_hot_bump (global.get $eip)))))

  (func $branch_end_at (param $patch_at i32) (param $shift i32) (param $tag i32)
     (local $nx_fn i32) (local $nx_op i32) (local $t i32)
    (if (global.get $be_gate_on) (then (call $branch_end_diag)))
    ;; ROUND 19: how many desk trips came out of a block-executor tail. $ip is
    ;; still inside the stream the terminator was read from, so the descriptor
    ;; chunk answers it -- and the only threaded ops that ever execute from
    ;; there are executor tails. Gated on the executor being armed so that the
    ;; off arm's desk path is byte-for-byte what it was. It is a superset of
    ;; $chain_slow_pool: the tails whose terminator has no spare operand word
    ;; (ret, call, loop, $th_block_end) arrive here with $patch_at 0 and are
    ;; invisible to the chain counters by construction.
    ;; The block-executor's discovery gate. $branch_end is every taken branch,
    ;; every jmp and every $th_block_end, so "this address was entered through
    ;; $branch_end" IS the "loop head or branch target" signal the multi-block
    ;; matcher wants, and the counter behind it is the hotness gate that keeps
    ;; discovery to once per hot head rather than once per decode. Off by
    ;; default and for every app: $bx_hot_on is set only by set_block_exec with
    ;; regions armed, so the cost here is one load and a not-taken branch.
    ;; It runs BEFORE the debug and yield returns below, so that a run with
    ;; --break= or --watch= still forms the same regions a plain run does; the
    ;; walk itself decodes and never executes, which is safe at a block edge in
    ;; exactly the way $run's own miss path is.
    (if (i32.or (i32.or (global.get $dbg_chain_guard)
                       (i32.eq (global.get $eip) (global.get $bp_addr)))
        (i32.or (global.get $code16)
        (i32.or (global.get $yield_flag) (global.get $yield_reason))))
      (then (call $uop_fast_bump) (return)))
    (if (i32.le_s (global.get $block_budget) (i32.const 0))
      (then (call $uop_fast_bump) (return)))
    ;; No test on $steps here. Running out is now a resume, not a restart:
    ;; $next parks $ip in $resume_ip and $run picks the block up where it left
    ;; off, without spending a second block from the budget for it.
    (if (i32.or (i32.eq (global.get $eip) (global.get $sbh_eip_a))
                (i32.eq (global.get $eip) (global.get $sbh_eip_b)))
      (then (call $uop_fast_bump) (return)))
    (local.set $t (call $page_resolve (global.get $eip)))
    (if (i32.eqz (local.get $t)) (then (call $uop_fast_bump) (return)))
    ;; $uop_fast: the tier's hot bump, here rather than in $branch_end_diag,
    ;; unless the target is marked no-bump. A bump that reached $uop_try may
    ;; have installed a program and retired this very block, so the target is
    ;; resolved again whenever the probe counter moved.
    (if (global.get $uop_fast)
      (then
        (if (i32.and (local.get $t) (i32.const 1))
          (then (global.set $bx_hot_skips (i32.add (global.get $bx_hot_skips) (i32.const 1))))
          (else
            (local.set $nx_op (global.get $bx_walk_hot_probes))
            (call $bx_hot_bump (global.get $eip))
            (if (i32.ne (local.get $nx_op) (global.get $bx_walk_hot_probes))
              (then
                (local.set $t (call $page_resolve (global.get $eip)))
                (if (i32.eqz (local.get $t)) (then (return)))))))))
    (local.set $t (i32.and (local.get $t) (i32.const -2)))
    ;; The resolve that just succeeded is the one answer worth remembering.
    ;; $patch_at is non-zero only when the caller was a chainable terminator
    ;; AND $block_chain_on was set, so an off run never reaches this.
    (if (local.get $patch_at)
      (then (call $chain_patch (local.get $patch_at) (local.get $t)
                               (local.get $shift) (local.get $tag))))
    (global.set $block_budget (i32.sub (global.get $block_budget) (i32.const 1)))
    (global.set $steps (i32.sub (global.get $steps) (i32.const 1)))
    (global.set $page_fast (i32.add (global.get $page_fast) (i32.const 1)))
    ;; Kept even on the fast path: these two are what a crash log reads to say
    ;; which block produced a bad transfer, and a stale answer there is worse
    ;; than the two stores are expensive.
    (global.set $dbg_prev2_eip (global.get $dbg_prev_eip))
    (global.set $dbg_prev_eip (global.get $eip))
    (global.set $ip (local.get $t))
    ;; $steps is deliberately NOT refilled. It is the wasm-stack bound: each
    ;; dispatch adds a frame that only unwinds when the chain ends, so letting
    ;; one refill of 1000 span a whole fast chain keeps the depth exactly where
    ;; it is today.
    (dispatch-next))

  ;; Recycling the decoded-code arena means resetting $thread_alloc to the base
  ;; and invalidating every cached block. That is only safe between blocks.
  ;; While a synchronous wndproc runs nested inside a handler — SendMessage,
  ;; a control's default processing, WM_WINDOWPOSCHANGED — the caller's decoded
  ;; block is still live in the arena, and reusing that memory rewrites the
  ;; code the outer frame is about to return into. The symptom is a jump to a
  ;; garbage EIP some distance after the flush, which resembles its cause not
  ;; at all: what you see is a runaway decoding nonsense, several more
  ;; overflows in a row, and then a wild EIP.
  ;;
  ;; So defer while nested, and flush at the next block boundary instead.
  (global $thread_flush_pending (mut i32) (i32.const 0))

  ;; Spill arena ($THREAD_SPILL in 00-regions.wat). When the arena is full and
  ;; the flush has to wait (a nested synchronous run is suspended inside a
  ;; block decoded here), decoding used to carry on past THREAD_END into the
  ;; next thread's partition: Serious Sam's main thread, inside a synchronous
  ;; fault-filter run, rewrote the winmm timer thread's callback stream, and
  ;; the timer thread then ran main's zlib copy loop with a count of -1. Instead
  ;; the allocator moves to this thread's slot of the spill region until the
  ;; deferred flush can run; $thread_arena_rewind moves it back. Main's slot is
  ;; 0x80000, a worker's 0x10000 ($init_thread sets the bounds).
  (global $spill_base (mut i32) (region.addr $THREAD_SPILL 0))
  (global $spill_end (mut i32) (region.addr $THREAD_SPILL 0x80000))
  (global $spill_active (mut i32) (i32.const 0))
  (global $spill_saved_end (mut i32) (i32.const 0))
  (global $spill_enters (mut i32) (i32.const 0))
  (global $spill_recycles (mut i32) (i32.const 0))
  ;; Bit k set: the frame suspended at sync depth k (the one that started the
  ;; nested run at depth k+1) was executing out of the spill when it did, so
  ;; the spill holds the live block that frame returns into. Depths from 31 up
  ;; share bit 31, which then stays set until the rewind.
  (global $spill_pins (mut i32) (i32.const 0))
  ;; Set while a depth-0 frame owes the spill's full flush; OR'd into
  ;; $dbg_chain_guard by $dbg_recompute so every transfer takes $run's desk.
  (global $spill_desk_forced (mut i32) (i32.const 0))

  ;; Every change to $sync_msg_depth goes through these two, which is what
  ;; keeps $spill_pins true (test/test-thread-arena-spill.js refuses a bare
  ;; write anywhere else). Only threaded streams are ever decoded into the
  ;; spill -- the block executor and micro-op installers decline while a flush
  ;; is pending, and one always is while spilled -- so $ip names the code a
  ;; suspended frame will resume in.
  (func $sync_depth_enter
    (if (i32.and (i32.ne (global.get $spill_active) (i32.const 0))
          (i32.and (i32.ge_u (global.get $ip) (global.get $spill_base))
                   (i32.lt_u (global.get $ip) (global.get $spill_end))))
      (then
        (global.set $spill_pins (i32.or (global.get $spill_pins)
          (i32.shl (i32.const 1)
            (select (global.get $sync_msg_depth) (i32.const 31)
              (i32.lt_u (global.get $sync_msg_depth) (i32.const 31))))))))
    (global.set $sync_msg_depth (i32.add (global.get $sync_msg_depth) (i32.const 1))))

  (func $sync_depth_leave
    (global.set $sync_msg_depth (i32.sub (global.get $sync_msg_depth) (i32.const 1)))
    (if (i32.lt_u (global.get $sync_msg_depth) (i32.const 31))
      (then
        (global.set $spill_pins (i32.and (global.get $spill_pins)
          (i32.xor (i32.shl (i32.const 1) (global.get $sync_msg_depth))
                   (i32.const -1))))))
    ;; Back at depth 0 with the spill in use: the full flush is owed and now
    ;; allowed, but $run only takes it at its desk, and the transfer fast paths
    ;; skip the desk for any target already compiled -- including blocks the
    ;; nested run decoded into the spill. Serious Sam's depth-0 frame chained
    ;; into one, faulted again there, and pinned the spill of the next nested
    ;; run (w6, runs/20261011T0300Z-serious-sam-timeron2-w6). So send every
    ;; transfer to the desk until the flush has run. The block this frame
    ;; resumes in was decoded before the spill existed (the spill is only ever
    ;; entered at depth >= 1), so it is never spill code.
    (if (i32.and (i32.eqz (global.get $sync_msg_depth))
                 (i32.ne (global.get $spill_active) (i32.const 0)))
      (then
        (global.set $spill_desk_forced (i32.const 1))
        (call $dbg_recompute))))

  ;; The spill filled while still nested (Serious Sam's synchronous fault-filter
  ;; run inflates whole level files at depth 1). The spill can be reused from
  ;; its base exactly when no suspended frame below this depth resumes into
  ;; it: this depth's own frame is between blocks ($decode_block's head), and
  ;; $decode_run stops 32KB short of the end so no run is mid-extension. Main-
  ;; arena blocks of suspended frames survive untouched; $page_dir_reset
  ;; forgets every index into the spill and bumps the chain epoch, so a chain
  ;; word in one of those surviving blocks that named a spill block fails its
  ;; compare and re-resolves.
  (func $thread_spill_can_recycle (result i32)
    (if (i32.eqz (global.get $spill_active)) (then (return (i32.const 0))))
    (if (i32.ge_u (global.get $sync_msg_depth) (i32.const 32))
      (then (return (i32.eqz (global.get $spill_pins)))))
    (i32.eqz (i32.and (global.get $spill_pins)
      (i32.sub (i32.shl (i32.const 1) (global.get $sync_msg_depth)) (i32.const 1)))))

  (func $thread_spill_recycle
    (global.set $thread_alloc (global.get $spill_base))
    (call $clear_cache)
    (global.set $spill_recycles (i32.add (global.get $spill_recycles) (i32.const 1))))

  (func $thread_spill_enter
    (if (global.get $spill_active) (then (return)))
    (global.set $spill_saved_end (global.get $THREAD_END))
    (global.set $THREAD_END (global.get $spill_end))
    (global.set $thread_alloc (global.get $spill_base))
    (global.set $spill_active (i32.const 1))
    (global.set $spill_enters (i32.add (global.get $spill_enters) (i32.const 1))))

  ;; Every rewind of the arena to its base goes through here, so a thread that
  ;; spilled gets its real THREAD_END back at the same moment.
  (func $thread_arena_rewind
    (if (global.get $spill_active)
      (then
        (global.set $THREAD_END (global.get $spill_saved_end))
        (global.set $spill_active (i32.const 0))))
    (global.set $spill_pins (i32.const 0))
    (if (global.get $spill_desk_forced)
      (then
        (global.set $spill_desk_forced (i32.const 0))
        (call $dbg_recompute)))
    (global.set $thread_alloc (global.get $THREAD_BASE)))

  ;; Fail fast rather than write decoded code outside this thread's arena:
  ;; past THREAD_END is another thread's partition (or, spilled, another
  ;; thread's spill slot). Marker 0xCA00F11F, then the cursor, the end, the
  ;; decode address and the nesting state.
  (func $thread_arena_exhausted
    (call $host_log_i32 (i32.const 0xCA00F11F))
    (call $host_log_i32 (global.get $thread_alloc))
    (call $host_log_i32 (global.get $THREAD_END))
    (call $host_log_i32 (global.get $d_pc))
    (call $host_log_i32 (global.get $sync_msg_depth))
    (call $host_log_i32 (global.get $spill_active))
    (call $host_log_i32 (global.get $spill_pins))
    (unreachable))

  (func $thread_arena_flush_if_safe (result i32)
    (if (global.get $sync_msg_depth)
      (then
        (global.set $thread_flush_pending (i32.const 1))
        (return (i32.const 0))))
    (global.set $thread_flush_pending (i32.const 0))
    (call $thread_arena_rewind)
    (call $clear_cache)
    ;; The one point at which the epoch may restart. Everything decoded is
    ;; gone, the arena is rewound, and this is called between blocks from
    ;; $run's loop head -- so no stream holding a stale chain word can be
    ;; reached again without being re-emitted first (which zeroes it).
    (global.set $chain_epoch (i32.const 1))
    (global.set $chain_slots_live (i32.const 0))
    (i32.const 1))

  ;; Thread emit helpers
  (func $te (param $fn i32) (param $op i32)
    ;; Backstop only: $decode_block reserves far more headroom than a single
    ;; block needs, so reaching this mid-emit means something unusual. Never
    ;; recycle from here — $tstart is already captured and a reset would leave
    ;; the half-emitted block pointing into reused storage.
    ;; Report the overflow once per episode, not once per opcode. $te runs for
    ;; every emitted operand, so an unconditional log here is a per-instruction
    ;; log on the hottest path in the emulator: it produced nine million host
    ;; calls in a single batch and exhausted the harness's heap long before
    ;; anything else went wrong.
    (if (i32.ge_u (global.get $thread_alloc) (i32.sub (global.get $THREAD_END) (i32.const 4096)))
      (then
        (if (i32.eqz (global.get $thread_flush_pending))
          (then (call $host_log_i32 (i32.const 0xCA00F10F))))  ;; cache overflow
        (global.set $thread_flush_pending (i32.const 1))))
    ;; Record where this op starts, before the bump. The thread stream is not
    ;; self-describing -- a word is 8 bytes but some handlers pull extra ones
    ;; with $read_thread_word -- and $te is the single choke point through
    ;; which all 376 decoder emit sites pass, so this is the one place that
    ;; knows an op boundary without anyone having to declare it. Decode-time
    ;; only; see docs/loop-idiom-superops-design.md 6.1.
    (if (i32.lt_u (global.get $op_index_n) (global.get $OP_INDEX_MAX))
      (then
        (i32.store
          (i32.add (global.get $OP_INDEX)
            (i32.shl (global.get $op_index_n) (i32.const 2)))
          (global.get $thread_alloc))
        (global.set $op_index_n (i32.add (global.get $op_index_n) (i32.const 1))))
      (else (global.set $op_index_poison (i32.const 1))))
    (if (i32.gt_u (i32.add (global.get $thread_alloc) (i32.const 8)) (global.get $THREAD_END))
      (then (call $thread_arena_exhausted)))
    (i32.store (global.get $thread_alloc) (local.get $fn))
    (i32.store offset=4 (global.get $thread_alloc) (local.get $op))
    (global.set $thread_alloc (i32.add (global.get $thread_alloc) (i32.const 8))))
  (func $te_raw (param $v i32)
    (if (i32.gt_u (i32.add (global.get $thread_alloc) (i32.const 4)) (global.get $THREAD_END))
      (then (call $thread_arena_exhausted)))
    (i32.store (global.get $thread_alloc) (local.get $v))
    (global.set $thread_alloc (i32.add (global.get $thread_alloc) (i32.const 4))))

  ;; ============================================================
  ;; FORTH INNER INTERPRETER
  ;; ============================================================
  (func $dispatch_bad (param $fn i32)
    (call $host_log_i32 (i32.const 0xCAC4BAD0))
    (call $host_log_i32 (local.get $fn))
    (call $host_log_i32 (global.get $eip))
    ;; Where the bad word was read from, against the loaded page's chunk and
    ;; the arena cursor: an $ip outside [chunk, chunk+cap) is a stale stream
    ;; pointer, one inside it is a corrupt stream.
    (call $host_log_i32 (i32.const 0xCAC4BAD1))
    (call $host_log_i32 (i32.sub (global.get $ip) (i32.const 8)))
    (call $host_log_i32 (global.get $dbg_prev_eip))
    (call $host_log_i32 (global.get $cur_page_base))
    (call $host_log_i32 (global.get $cur_page_chunk))
    (call $host_log_i32 (global.get $cur_page_chunk_cap))
    (call $host_log_i32 (global.get $thread_alloc))
    (call $host_log_i32 (global.get $THREAD_BASE))
    (call $thread_arena_rewind)
    (call $clear_cache))

  ;; The dispatch step. A MACRO, not only a function: every handler ends in
  ;; `(dispatch-next)`, so each one carries its own copy of this body and its
  ;; own `return_call_indirect`, and $next below is the same body under a
  ;; name for the non-tail callers ($run's resume path, $th_call_step). One
  ;; shared site was measured at -4.86% gameplay CPU on StarCraft against a
  ;; 1.13% null band (quiet box, perf counters, 2026-09-19): not a branch
  ;; prediction win -- the shared site missed 0.24% either way -- but the
  ;; call, frame setup and stack check per dispatch are gone. See
  ;; docs/repl-tailcall-main-emu.md. V8 does the same inlining when given
  ;; --wasm-inlining-min-budget=600, which a browser cannot be asked for.
  ;;
  ;; The body is written on two locals, $nx_fn and $nx_op, that the
  ;; expanding function must declare: a macro cannot add locals, and the
  ;; compiler refuses an undeclared one, so a handler that forgets the pair
  ;; is a build error and never a silently different dispatch. Do not write
  ;; `(return_call $next)` in a handler again -- test/test-dispatch-macro.js
  ;; refuses it, because a tree with both spellings has two dispatch paths
  ;; that can drift apart (it happened: docs/next-source-inline.md).
  ;;
  ;; $steps is a BLOCK quantum, decremented where $block_budget is on the
  ;; three transfer fast paths ($branch_end_at, $jcc_end fall-through,
  ;; $chain_end), not here per op. The test stays: a handler that sets
  ;; $steps to 0 after redirecting EIP (SendMessage, an API yield, SEH) is
  ;; relying on the next dispatch returning to $run instead of running the
  ;; op after it in the stream. The frame bound is unchanged in kind: only
  ;; $jcc_end's fall-through nests a frame, and it is one of the three.
  ;; Because the expansion sits in tail position, its `(return)` lands
  ;; exactly where $next's would: in $run, which reads $resume_ip.
  ;; A multi-form macro body, expanded inside a function. That used to
  ;; compile to NOTHING, silently (the expander spliced a multi-form body
  ;; only at module level; every app "ran" zero ops), and this landed with a
  ;; `(block ...)` wrapper as the workaround. The compiler is fixed (see
  ;; tools/watx-src/CHANGELOG.md, 2026-09-19) and
  ;; test/watx-compiler-macro-body.test.js CALLS such a module, so the
  ;; wrapper is gone; the artifact is byte-identical either way.
  (defmacro (dispatch-next)
    (if (i32.le_s (global.get $steps) (i32.const 0))
      (then
        ;; Hand $run the op we are declining to run, so it resumes the block
        ;; instead of restarting it. See $resume_ip in 01-header.wat.
        ;; Unless $eip has just been replaced out from under this block by an
        ;; exception raise: that block is abandoned, and parking $ip here would
        ;; send $run back into it instead of into the handler.
        (if (i32.eqz (global.get $eip_redirected))
          (then (global.set $resume_ip (global.get $ip))))
        (return)))
    (local.set $nx_fn (i32.load (global.get $ip)))
    (local.set $nx_op (i32.load offset=4 (global.get $ip)))
    (global.set $ip (i32.add (global.get $ip) (i32.const 8)))
    ;; Defensive: if cache is corrupted (bad handler index), drop the
    ;; whole cache and restart at $eip. The fresh decode will produce
    ;; valid threaded code. This recovers from rare corruption rather
    ;; than trapping with wasm "table index out of bounds".
    (if (i32.ge_u (local.get $nx_fn) (i32.const 500))
      (then
        (return_call $dispatch_bad (local.get $nx_fn))))
    (if (global.get $handler_hist_enabled)
      (then (call $handler_hist_record (local.get $nx_fn))))
    ;; A tail call, so the chain runs at constant stack depth. Nothing follows
    ;; the dispatch, which is what makes it legal.
    ;;
    ;; This was measured at the fork point and rejected as worthless, for a
    ;; reason that was true there and is not true here: a chain used to be one
    ;; x86 basic block deep -- 151.5M dispatches over 30.0M blocks is 5.05 ops
    ;; -- so there were never enough frames for their cost to matter, and
    ;; $steps=1000 was a backstop nothing reached. Since $branch_end and
    ;; $jcc_end stopped unwinding at block terminators, $steps is no longer a
    ;; backstop: it *is* the chain length, and the same chain is now ~1000
    ;; frames instead of ~5. See docs/interpreter-dispatch-perf.md.
    (return_call_indirect (type $handler_t) (local.get $nx_op) (local.get $nx_fn)))

  (func $next
    (local $nx_fn i32) (local $nx_op i32)
    (dispatch-next))

  ;; Read next thread i32 and advance $ip.
  ;;
  ;; A macro, like (dispatch-next), and for the same reason: as a function it
  ;; was 237 call sites V8 never inlined -- each paid a call, a frame, a stack
  ;; check and a spill of whatever the handler held live across it, and it was
  ;; 3.5-7% self CPU on every game profiled (docs/uop-tier-design.md 11). The
  ;; body is ONE expression form, so it expands anywhere a value is wanted,
  ;; including inside another call's argument list, and needs no local (so no
  ;; expanding function has to declare one): it advances $ip first and loads
  ;; the word just stepped over. Same result and same side effect as the old
  ;; load-then-advance; nothing else can observe $ip between the two. (The
  ;; load-first spelling, leaving the value on the stack beneath the
  ;; global.set, is valid wasm but the WATX compiler drops the stacked value
  ;; -- "expected 1 elements on the stack for fallthru" -- so it is not used.)
  (defmacro (read-thread-word)
    (block (result i32)
      (global.set $ip (i32.add (global.get $ip) (i32.const 4)))
      (i32.load (i32.sub (global.get $ip) (i32.const 4)))))

  ;; The same step under a name, for tools that attribute by function name
  ;; (tools/dispatch-attribution.js) and any non-hot caller that wants a call.
  (func $read_thread_word (result i32)
    (read-thread-word))

  (func $handler_hist_record (param $fn i32)
    (local $addr i32) (local $prev i32)
    (local.set $addr
      (i32.add (global.get $HANDLER_HIST_COUNTS)
        (i32.shl (local.get $fn) (i32.const 2))))
    (i32.store (local.get $addr)
      (i32.add (i32.load (local.get $addr)) (i32.const 1)))
    (local.set $prev (global.get $handler_hist_last))
    ;; The dense pair matrix predates handlers 361+ and is intentionally
    ;; bounded to HANDLER_HIST_COUNT. Keep individual counts for newer
    ;; handlers, but never alias their pairs into another matrix row.
    (if (i32.and
          (i32.and
            (i32.and
              (i32.ge_s (local.get $prev) (i32.const 0))
              (i32.lt_u (local.get $prev) (global.get $HANDLER_HIST_COUNT)))
            (i32.lt_u (local.get $fn) (global.get $HANDLER_HIST_COUNT)))
          ;; --edge-hist has borrowed the pair matrix ($edge_hist_record).
          (i32.eqz (global.get $edge_hist_enabled)))
      (then
        (local.set $addr
          (i32.add (global.get $HANDLER_PAIR_HIST_COUNTS)
            (i32.shl
              (i32.add
                (i32.mul (local.get $prev) (global.get $HANDLER_HIST_COUNT))
                (local.get $fn))
              (i32.const 2))))
        (i32.store (local.get $addr)
          (i32.add (i32.load (local.get $addr)) (i32.const 1)))))
    (if (i32.and
          (i32.ne (local.get $fn) (i32.const 44))
          (i32.or
            (i32.lt_u (local.get $fn) (i32.const 307))
            (i32.gt_u (local.get $fn) (i32.const 322))))
      (then (global.set $branch_hist_kind (i32.const 0))))
    (global.set $handler_hist_last (local.get $fn)))

  ;; One {from, to, count} record per block-to-block transfer seen in the
  ;; window, eight-way probed. `from` is the previous block entry this
  ;; instance recorded, so an edge out of a uop program reads as head -> exit.
  ;; The 65536 records live in the handler-pair matrix, which is 1MB and
  ;; idle while --edge-hist is on: the memory map has no room for a region.
  (func $edge_hist_record (param $from i32) (param $to i32)
    (local $slot i32) (local $ptr i32) (local $i i32) (local $cur i32)
    (local.set $slot
      (i32.and
        (i32.xor (i32.mul (local.get $from) (i32.const 0x9E3779B1))
                 (i32.shr_u (local.get $to) (i32.const 2)))
        (i32.const 0xFFF8)))
    (local.set $ptr
      (i32.add (global.get $HANDLER_PAIR_HIST_COUNTS) (i32.shl (local.get $slot) (i32.const 4))))
    (block $done (loop $probe
      (local.set $cur (i32.load offset=8 (local.get $ptr)))
      (if (i32.eqz (local.get $cur))
        (then
          (i32.store (local.get $ptr) (local.get $from))
          (i32.store offset=4 (local.get $ptr) (local.get $to))
          (i32.store offset=8 (local.get $ptr) (i32.const 1))
          (return)))
      (if (i32.and (i32.eq (i32.load (local.get $ptr)) (local.get $from))
                   (i32.eq (i32.load offset=4 (local.get $ptr)) (local.get $to)))
        (then
          (i32.store offset=8 (local.get $ptr) (i32.add (local.get $cur) (i32.const 1)))
          (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 16)))
      (br $probe)))
    (global.set $edge_hist_collisions
      (i32.add (global.get $edge_hist_collisions) (i32.const 1))))

  (func $hot_block_hist_record (param $addr i32)
    (local $slot i32) (local $ptr i32) (local $i i32) (local $cur i32)
    (if (global.get $edge_hist_enabled)
      (then
        (call $edge_hist_record (global.get $edge_hist_prev) (local.get $addr))
        (global.set $edge_hist_prev (local.get $addr))))
    ;; Four-way direct bucket keyed by block-entry EIP.
    (local.set $slot
      (i32.and
        (i32.shr_u (local.get $addr) (i32.const 2))
        (i32.const 0x7FFC)))
    (local.set $ptr
      (i32.add (global.get $HOT_BLOCK_HIST)
        (i32.shl (local.get $slot) (i32.const 3))))
    (local.set $i (i32.const 0))
    (block $done (loop $probe
      (local.set $cur (i32.load (local.get $ptr)))
      (if (i32.or
            (i32.eq (local.get $cur) (local.get $addr))
            (i32.eqz (local.get $cur)))
        (then
          (if (i32.eqz (local.get $cur))
            (then (i32.store (local.get $ptr) (local.get $addr))))
          (i32.store offset=4 (local.get $ptr)
            (i32.add (i32.load offset=4 (local.get $ptr)) (i32.const 1)))
          (br $done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $i) (i32.const 4)))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 8)))
      (br $probe)))
    (if (i32.ge_u (local.get $i) (i32.const 4))
      (then
        (global.set $hot_block_hist_collisions
          (i32.add (global.get $hot_block_hist_collisions) (i32.const 1))))))

  (func $sib_consumer_hist_record (param $fn i32) (param $op i32) (param $info i32)
    (local $key i32) (local $slot i32) (local $ptr i32) (local $i i32) (local $cur i32)
    (global.set $sib_consumer_hist_total
      (i32.add (global.get $sib_consumer_hist_total) (i32.const 1)))
    ;; key: fn:9 | op:9 | base:4 | index:4 | scale:2 | low marker bit
    (local.set $key (i32.const 1))
    (local.set $key
      (i32.or (local.get $key)
        (i32.shl (i32.and (local.get $fn) (i32.const 0x1FF)) (i32.const 23))))
    (local.set $key
      (i32.or (local.get $key)
        (i32.shl (i32.and (local.get $op) (i32.const 0x1FF)) (i32.const 14))))
    (local.set $key
      (i32.or (local.get $key)
        (i32.shl (i32.and (local.get $info) (i32.const 0xF)) (i32.const 10))))
    (local.set $key
      (i32.or (local.get $key)
        (i32.shl
          (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF))
          (i32.const 6))))
    (local.set $key
      (i32.or (local.get $key)
        (i32.shl
          (i32.and (i32.shr_u (local.get $info) (i32.const 8)) (i32.const 3))
          (i32.const 4))))
    (local.set $slot
      (i32.and
        (i32.xor (local.get $key) (i32.shr_u (local.get $key) (i32.const 16)))
        (i32.const 0x1FFC)))
    (local.set $ptr
      (i32.add (global.get $SIB_CONSUMER_HIST)
        (i32.shl (local.get $slot) (i32.const 3))))
    (local.set $i (i32.const 0))
    (block $done (loop $probe
      (local.set $cur (i32.load (local.get $ptr)))
      (if (i32.or
            (i32.eq (local.get $cur) (local.get $key))
            (i32.eqz (local.get $cur)))
        (then
          (if (i32.eqz (local.get $cur))
            (then (i32.store (local.get $ptr) (local.get $key))))
          (i32.store offset=4 (local.get $ptr)
            (i32.add (i32.load offset=4 (local.get $ptr)) (i32.const 1)))
          (br $done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $i) (i32.const 4)))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 8)))
      (br $probe)))
    (if (i32.ge_u (local.get $i) (i32.const 4))
      (then
        (global.set $sib_consumer_hist_collisions
          (i32.add (global.get $sib_consumer_hist_collisions) (i32.const 1))))))

  (func $branch_hist_set (param $kind i32) (param $operand i32)
    (if (global.get $handler_hist_enabled)
      (then
        (global.set $branch_hist_kind (local.get $kind))
        (global.set $branch_hist_operand (local.get $operand)))))

  (func $branch_hist_record_jcc (param $cc i32)
    (local $base i32) (local $idx i32) (local $kind i32)
    (if (i32.eqz (global.get $handler_hist_enabled))
      (then (return)))
    (local.set $kind (global.get $branch_hist_kind))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (local.set $base (global.get $BRANCH_CMP_JCC_HIST))
        (local.set $idx
          (i32.add
            (i32.shl (i32.and (local.get $cc) (i32.const 0xF)) (i32.const 6))
            (i32.and (global.get $branch_hist_operand) (i32.const 0x3F))))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then
        (local.set $base (global.get $BRANCH_TEST_JCC_HIST))
        (local.set $idx
          (i32.add
            (i32.shl (i32.and (local.get $cc) (i32.const 0xF)) (i32.const 6))
            (i32.and (global.get $branch_hist_operand) (i32.const 0x3F))))))
    (if (i32.eq (local.get $kind) (i32.const 3))
      (then
        (local.set $base (global.get $BRANCH_ALU_M32_RO_JCC_HIST))
        (local.set $idx
          (i32.add
            (i32.shl (i32.and (local.get $cc) (i32.const 0xF)) (i32.const 9))
            (i32.and (global.get $branch_hist_operand) (i32.const 0x1FF))))))
    (if (local.get $base)
      (then
        (local.set $base (i32.add (local.get $base) (i32.shl (local.get $idx) (i32.const 2))))
        (i32.store (local.get $base)
          (i32.add (i32.load (local.get $base)) (i32.const 1)))))
    (global.set $branch_hist_kind (i32.const 0)))
