;; Graceful render-instance heap handoff. The producer must have destroyed all
;; devices/programs/contexts before retirement and must never allocate afterward.
;; The receiver may adopt only after confirmed producer termination. These are
;; host lifecycle exports, not guest APIs. Forced-death orphan recovery is separate.
  (func (export "d3d_render_retire_heap") (result i32)
    (local $head i32)
    ;; Bins first, so each freed tail still lands at the head; flush again for
    ;; a tail small enough to have been binned itself.
    (call $heap_bins_flush)
    (call $heap_arena_free_tail (global.get $heap_ptr) (global.get $heap_end) (global.get $heap_arena_record))
    (call $heap_arena_free_tail (global.get $heap_sparse_ptr) (global.get $heap_sparse_end) (global.get $heap_sparse_record))
    (call $heap_bins_flush)
    (local.set $head (global.get $free_list))
    (global.set $free_list (i32.const 0))
    (global.set $heap_ptr (i32.const 0))
    (global.set $heap_end (i32.const 0))
    (global.set $heap_arena_record (i32.const 0))
    (global.set $heap_sparse_ptr (i32.const 0))
    (global.set $heap_sparse_end (i32.const 0))
    (global.set $heap_sparse_record (i32.const 0))
    (local.get $head))

  ;; Passive diagnostic of THIS instance's free_list, including after a failed
  ;; coalesce. Call between submissions with arena/mapping writers quiescent;
  ;; separate field calls rescan, they are not a concurrent atomic snapshot.
  ;; Bins are deliberately neither flushed nor inspected. No stores, globals,
  ;; allocator hints, translation fault handlers or lazy DIB access are changed.
  ;; Fields: 0 reason, 1 head, 2 current guest header, 3 WASM header address,
  ;; 4 raw size, 5 next guest header, 6 arena record, 7 arena base, 8 arena end,
  ;; 9 allocated high-water, 10 validated nodes, 11 published arena count.
  ;; Unread/unavailable fields are zero; successful scans return zero current
  ;; and metadata, with head/count retained. Unknown field returns -1.
  ;; Reasons: 0 valid/empty, 1 walk limit (cycle OR >65536 nodes), 2 alignment,
  ;; 3 missing arena, 4 unmapped/out-of-memory header, 5 malformed size,
  ;; 6 guest extent overflow, 7 extent outside arena/high-water,
  ;; 8 invalid arena table count, 9 header outside arena/high-water,
  ;; 10 ascending adjacent links overlap. Reason 10 covers the coalescer's
  ;; second rejection after its address sort. It also proves overlap in an
  ;; unsorted chain, but success does NOT prove arbitrary unsorted extents are
  ;; disjoint. Equal/backward links retain the bounded cycle check.
  ;; Priority is per node: validate this header/extent, then its ascending link,
  ;; then visit the next node. Thus reason 10 may precede a later node's bad
  ;; alignment/header (unlike coalesce's complete validation pass before sort).
  (func (export "d3d_render_free_list_diagnostic") (param $field i32) (result i32)
    (local $head i32) (local $cur i32) (local $wa i32) (local $size i32)
    (local $next i32) (local $rec i32) (local $base i32) (local $end i32)
    (local $high i32) (local $count i32) (local $arenas i32) (local $i i32)
    (local $candidate i32) (local $candidate_base i32) (local $reason i32)
    (local $extent i64)
    (local.set $head (global.get $free_list))
    (local.set $cur (local.get $head))
    (local.set $arenas (i32.atomic.load (global.get $HEAP_ARENAS)))
    (block $done (loop $walk
      (local.set $wa (i32.const 0)) (local.set $size (i32.const 0))
      (local.set $next (i32.const 0)) (local.set $rec (i32.const 0))
      (local.set $base (i32.const 0)) (local.set $end (i32.const 0))
      (local.set $high (i32.const 0))
      (br_if $done (i32.eqz (local.get $cur)))
      (local.set $reason (i32.const 1))
      (br_if $done (i32.ge_u (local.get $count) (i32.const 65536)))
      (local.set $reason (i32.const 2))
      (br_if $done (i32.ne (i32.and (local.get $cur) (i32.const 7)) (i32.const 0)))
      (local.set $reason (i32.const 8))
      (br_if $done (i32.gt_u (local.get $arenas)
        (i32.div_u (i32.sub (global.get $HEAP_ARENAS_SIZE) (i32.const 16)) (i32.const 16))))
      (local.set $i (i32.const 0))
      (block $found (loop $scan
        (br_if $found (i32.ge_u (local.get $i) (local.get $arenas)))
        (local.set $candidate (i32.add (global.get $HEAP_ARENAS)
          (i32.add (i32.const 16) (i32.mul (local.get $i) (i32.const 16)))))
        (local.set $candidate_base (i32.atomic.load (local.get $candidate)))
        (if (i32.and (i32.ne (local.get $candidate_base) (i32.const 0))
          (i32.and (i32.ge_u (local.get $cur) (local.get $candidate_base))
            (i32.lt_u (local.get $cur) (i32.atomic.load offset=8 (local.get $candidate)))))
          (then
            (local.set $rec (local.get $candidate))
            (local.set $base (local.get $candidate_base))
            (local.set $end (i32.load offset=4 (local.get $rec)))
            (local.set $high (i32.atomic.load offset=8 (local.get $rec)))
            (br $found)))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
      (local.set $reason (i32.const 3))
      (br_if $done (i32.eqz (local.get $rec)))
      (local.set $extent (i64.add (i64.extend_i32_u (local.get $cur)) (i64.const 8)))
      (local.set $reason (i32.const 9))
      (br_if $done (i32.or
        (i64.gt_u (local.get $extent) (i64.extend_i32_u (local.get $end)))
        (i64.gt_u (local.get $extent) (i64.extend_i32_u (local.get $high)))))
      ;; Aligned eight-byte headers cannot cross a page boundary. Mirror g2w's
      ;; direct, DIB and packed-page cases without its side-effecting slow path.
      (local.set $wa (i32.add (i32.sub (local.get $cur) (global.get $image_base)) (global.get $GUEST_BASE)))
      (if (i32.ge_u (local.get $wa) (region.end $DIRECT_WINDOW)) (then
        (if (i32.lt_u (i32.sub (local.get $cur) (global.get $DIB_GUEST_BASE)) (global.get $DIB_GUEST_CAPACITY))
          (then (local.set $wa (i32.add (global.get $DIB_BACKING_BASE)
            (i32.sub (local.get $cur) (global.get $DIB_GUEST_BASE)))))
          (else (local.set $wa (call $guest_page_translate (local.get $cur)))))))
      (local.set $reason (i32.const 4))
      (br_if $done (i32.or (i32.lt_u (local.get $wa) (i32.const 256))
        (i64.gt_u (i64.add (i64.extend_i32_u (local.get $wa)) (i64.const 8))
          (i64.shl (i64.extend_i32_u (memory.size)) (i64.const 16)))))
      (local.set $size (i32.load (local.get $wa)))
      (local.set $next (i32.load offset=4 (local.get $wa)))
      (local.set $reason (i32.const 5))
      (br_if $done (i32.or (i32.lt_u (local.get $size) (i32.const 16))
        (i32.ne (i32.and (local.get $size) (i32.const 7)) (i32.const 0))))
      (local.set $extent (i64.add (i64.extend_i32_u (local.get $cur)) (i64.extend_i32_u (local.get $size))))
      (local.set $reason (i32.const 6))
      (br_if $done (i64.gt_u (local.get $extent) (i64.const 4294967295)))
      (local.set $reason (i32.const 7))
      (br_if $done (i32.or
        (i64.gt_u (local.get $extent) (i64.extend_i32_u (local.get $end)))
        (i64.gt_u (local.get $extent) (i64.extend_i32_u (local.get $high)))))
      (local.set $reason (i32.const 10))
      (br_if $done (i32.and (i32.gt_u (local.get $next) (local.get $cur))
        (i64.lt_u (i64.extend_i32_u (local.get $next)) (local.get $extent))))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (local.set $cur (local.get $next))
      (local.set $reason (i32.const 0)) (br $walk)))
    (if (i32.eqz (local.get $field)) (then (return (local.get $reason))))
    (if (i32.eq (local.get $field) (i32.const 1)) (then (return (local.get $head))))
    (if (i32.eq (local.get $field) (i32.const 2)) (then (return (local.get $cur))))
    (if (i32.eq (local.get $field) (i32.const 3)) (then (return (local.get $wa))))
    (if (i32.eq (local.get $field) (i32.const 4)) (then (return (local.get $size))))
    (if (i32.eq (local.get $field) (i32.const 5)) (then (return (local.get $next))))
    (if (i32.eq (local.get $field) (i32.const 6)) (then (return (local.get $rec))))
    (if (i32.eq (local.get $field) (i32.const 7)) (then (return (local.get $base))))
    (if (i32.eq (local.get $field) (i32.const 8)) (then (return (local.get $end))))
    (if (i32.eq (local.get $field) (i32.const 9)) (then (return (local.get $high))))
    (if (i32.eq (local.get $field) (i32.const 10)) (then (return (local.get $count))))
    (if (i32.eq (local.get $field) (i32.const 11)) (then (return (local.get $arenas))))
    (i32.const -1))

  ;; Validated walk returns the terminal block (or -1). Count bound detects
  ;; cycles without allocation and caps hostile/corrupted-list work. Both chains
  ;; are validated before linking; equal tails mean intersection/double adoption.
  (func $d3d_render_list_tail (param $head i32) (result i32)
    (local $cur i32) (local $tail i32) (local $wa i32) (local $count i32)
    (local.set $cur (local.get $head))
    (block $done (loop $walk
      (br_if $done (i32.eqz (local.get $cur)))
      (if (i32.ge_u (local.get $count) (i32.const 65536)) (then (return (i32.const -1))))
      (if (i32.ne (i32.and (local.get $cur) (i32.const 7)) (i32.const 0)) (then (return (i32.const -1))))
      (if (i32.eqz (call $heap_arena_find (local.get $cur))) (then (return (i32.const -1))))
      (local.set $wa (call $g2w (local.get $cur)))
      (if (i32.or (i32.lt_u (local.get $wa) (i32.const 256))
        (i64.gt_u (i64.add (i64.extend_i32_u (local.get $wa)) (i64.const 8))
          (i64.shl (i64.extend_i32_u (memory.size)) (i64.const 16)))) (then (return (i32.const -1))))
      (if (call $heap_block_bad (local.get $cur) (i32.load (local.get $wa))) (then (return (i32.const -1))))
      (local.set $tail (local.get $cur))
      (local.set $cur (i32.load offset=4 (local.get $wa)))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (br $walk)))
    (local.get $tail))

  ;; Called only between render submissions. The free list is instance-local;
  ;; other instances own disjoint lists even though arena records are shared.
  ;; No allocations, live-block moves, retired-tail adoption or guest CPU state
  ;; changes. Bottom-up merge sort bounds work to O(n log n), n<=65536.
  (func (export "d3d_render_coalesce_heap") (result i32)
    (local $head i32) (local $width i32) (local $p i32) (local $q i32)
    (local $psize i32) (local $qsize i32) (local $item i32) (local $tail i32)
    (local $newhead i32) (local $merges i32) (local $cur i32) (local $next i32)
    (local $wa i32) (local $size i32) (local $joined i32) (local $by_size i32)
    (call $heap_bins_flush)
    (local.set $head (global.get $free_list))
    (if (i32.eq (call $d3d_render_list_tail (local.get $head)) (i32.const -1))
      (then (return (i32.const -1))))
    (if (i32.eqz (local.get $head)) (then (return (i32.const 0))))
    (loop $order (result i32)
    (local.set $width (i32.const 1))
    (loop $sort
      (local.set $p (local.get $head))
      (local.set $newhead (i32.const 0)) (local.set $tail (i32.const 0))
      (local.set $merges (i32.const 0))
      (block $pass_done (loop $runs
        (br_if $pass_done (i32.eqz (local.get $p)))
        (local.set $merges (i32.add (local.get $merges) (i32.const 1)))
        (local.set $q (local.get $p)) (local.set $psize (i32.const 0))
        (block $split_done (loop $split
          (br_if $split_done (i32.eqz (local.get $q)))
          (br_if $split_done (i32.eq (local.get $psize) (local.get $width)))
          (local.set $psize (i32.add (local.get $psize) (i32.const 1)))
          (local.set $q (i32.load offset=4 (call $g2w (local.get $q))))
          (br $split)))
        (local.set $qsize (local.get $width))
        (block $merge_done (loop $merge
          (br_if $merge_done (i32.and (i32.eqz (local.get $psize))
            (i32.or (i32.eqz (local.get $qsize)) (i32.eqz (local.get $q)))))
          (if (i32.and (i32.ne (local.get $psize) (i32.const 0))
            (i32.or (i32.eqz (local.get $qsize))
              (i32.or (i32.eqz (local.get $q))
                (if (result i32) (local.get $by_size)
                  (then (i32.le_u (i32.load (call $g2w (local.get $p))) (i32.load (call $g2w (local.get $q)))))
                  (else (i32.le_u (local.get $p) (local.get $q)))))))
            (then
              (local.set $item (local.get $p))
              (local.set $p (i32.load offset=4 (call $g2w (local.get $p))))
              (local.set $psize (i32.sub (local.get $psize) (i32.const 1))))
            (else
              (local.set $item (local.get $q))
              (local.set $q (i32.load offset=4 (call $g2w (local.get $q))))
              (local.set $qsize (i32.sub (local.get $qsize) (i32.const 1)))))
          (if (local.get $tail)
            (then (i32.store offset=4 (call $g2w (local.get $tail)) (local.get $item)))
            (else (local.set $newhead (local.get $item))))
          (local.set $tail (local.get $item)) (br $merge)))
        (local.set $p (local.get $q)) (br $runs)))
      (i32.store offset=4 (call $g2w (local.get $tail)) (i32.const 0))
      (local.set $head (local.get $newhead))
      (local.set $width (i32.shl (local.get $width) (i32.const 1)))
      (br_if $sort (i32.gt_u (local.get $merges) (i32.const 1))))
    (global.set $free_list (local.get $head))
    (if (local.get $by_size) (then (return (local.get $joined))))
    ;; Validate disjointness before changing any block size. On overlap the
    ;; links remain sorted but every original block/header is retained.
    (local.set $cur (local.get $head))
    (block $checked (loop $check
      (local.set $wa (call $g2w (local.get $cur)))
      (local.set $next (i32.load offset=4 (local.get $wa)))
      (br_if $checked (i32.eqz (local.get $next)))
      (if (i64.gt_u (i64.add (i64.extend_i32_u (local.get $cur))
        (i64.extend_i32_u (i32.load (local.get $wa)))) (i64.extend_i32_u (local.get $next)))
        (then (return (i32.const -1))))
      (local.set $cur (local.get $next)) (br $check)))
    (local.set $cur (local.get $head))
    (block $done (loop $coalesce
      (local.set $wa (call $g2w (local.get $cur)))
      (local.set $size (i32.load (local.get $wa)))
      (local.set $next (i32.load offset=4 (local.get $wa)))
      (br_if $done (i32.eqz (local.get $next)))
      (if (i32.and (i32.eq (i32.add (local.get $cur) (local.get $size)) (local.get $next))
        (i32.eq (call $heap_arena_find (local.get $cur)) (call $heap_arena_find (local.get $next))))
        (then
          (i32.store (local.get $wa) (i32.add (local.get $size) (i32.load (call $g2w (local.get $next)))))
          (i32.store offset=4 (local.get $wa) (i32.load offset=4 (call $g2w (local.get $next))))
          (local.set $joined (i32.add (local.get $joined) (i32.const 1))))
        (else (local.set $cur (local.get $next))))
      (br $coalesce)))
    ;; First-fit allocation must not consume a large texture-sized free block
    ;; for tiny shader packets before that texture is rebound. Sorting the
    ;; coalesced blocks by size preserves smaller fits at the next submission.
    (local.set $by_size (i32.const 1))
    (br $order)))

  (func (export "d3d_render_adopt_free_list") (param $head i32) (result i32)
    (local $tail i32) (local $oldtail i32) (local $cur i32) (local $count i32)
    (if (i32.eqz (local.get $head)) (then (return (i32.const 0))))
    (local.set $tail (call $d3d_render_list_tail (local.get $head)))
    (local.set $oldtail (call $d3d_render_list_tail (global.get $free_list)))
    (if (i32.or (i32.eq (local.get $tail) (i32.const -1))
      (i32.or (i32.eq (local.get $oldtail) (i32.const -1))
        (i32.eq (local.get $tail) (local.get $oldtail)))) (then (return (i32.const -1))))
    (local.set $cur (local.get $head))
    (loop $count
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (local.set $cur (i32.load offset=4 (call $g2w (local.get $cur))))
      (br_if $count (local.get $cur)))
    (i32.store offset=4 (call $g2w (local.get $tail)) (global.get $free_list))
    (global.set $free_list (local.get $head))
    (local.get $count))
