  ;; Selective backing-page observers. Guest aliases and host/native pointers
  ;; share one version. Code-cache invalidation remains guest-addressed.
  ;;
  ;; Root: 512 atomic table pointers (one per 4 MB of the 2 GB memory limit),
  ;; then poison and debug-audit words. A lazily allocated 16 KB table holds
  ;; 1024 { refs:u32, reserved:u32, generation:u64 } cells. Tables live for
  ;; the process; resource leases do not. No per-instance mutable pointer.
  ;; Versions are notifications, NOT locks: retain resource ownership/fences.
  (global $PAGE_WATCH_ROOT i32 (region.addr $PAGE_WATCH_ROOT 0))
  (global $PAGE_WATCH_ROOT_SIZE i32 (region.size $PAGE_WATCH_ROOT))

  (func (export "page_watch_root") (result i32) (global.get $PAGE_WATCH_ROOT))
  (func (export "set_page_watch_audit") (param $enabled i32)
    (i32.atomic.store offset=2052 (global.get $PAGE_WATCH_ROOT) (local.get $enabled)))
  (func $page_watch_disable (export "page_watch_disable")
    ;; Fail closed on generation/refcount overflow or an audit miss. A live
    ;; observer must never mistake a wrapped version for unchanged contents.
    (i32.atomic.store offset=2048 (global.get $PAGE_WATCH_ROOT) (i32.const 1)))

  (func $page_watch_cell (param $wa i32) (result i32)
    (local $table i32)
    (if (i32.ge_u (local.get $wa) (i32.const 0x80000000)) (then (return (i32.const 0))))
    (local.set $table (i32.atomic.load (i32.add (global.get $PAGE_WATCH_ROOT)
      (i32.shl (i32.shr_u (local.get $wa) (i32.const 22)) (i32.const 2)))))
    (if (i32.eqz (local.get $table)) (then (return (i32.const 0))))
    (i32.add (local.get $table)
      (i32.shl (i32.and (i32.shr_u (local.get $wa) (i32.const 12)) (i32.const 1023)) (i32.const 4))))

  (func $page_watch_bump (param $cell i32)
    (if (i64.eq (i64.atomic.rmw.add offset=8 (local.get $cell) (i64.const 1)) (i64.const -1))
      (then (call $page_watch_disable))))

  (func $page_watch_valid (param $wa i32) (param $len i32) (result i32)
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (i64.le_u
      (i64.add (i64.extend_i32_u (local.get $wa)) (i64.extend_i32_u (local.get $len)))
      (i64.shl (i64.extend_i32_u (memory.size)) (i64.const 16))))

  (func $page_watch_acquire (export "page_watch_acquire") (param $wa i32) (param $len i32) (result i32)
    (local $page i32) (local $end i32) (local $slot i32) (local $table i32)
    (local $allocation i32) (local $prior i32) (local $cell i32) (local $refs i32)
    (if (i32.eqz (call $page_watch_valid (local.get $wa) (local.get $len))) (then (return (i32.const 0))))
    (if (i32.atomic.load offset=2048 (global.get $PAGE_WATCH_ROOT)) (then (return (i32.const 0))))
    (local.set $page (i32.and (local.get $wa) (i32.const -4096)))
    (local.set $end (i32.add (local.get $wa) (i32.sub (local.get $len) (i32.const 1))))
    (block $failed (loop $pages
      (local.set $slot (i32.add (global.get $PAGE_WATCH_ROOT)
        (i32.shl (i32.shr_u (local.get $page) (i32.const 22)) (i32.const 2))))
      (local.set $table (i32.atomic.load (local.get $slot)))
      (if (i32.eqz (local.get $table)) (then
        (local.set $allocation (call $heap_alloc (i32.const 16399)))
        (if (i32.eqz (local.get $allocation)) (then
          (br $failed)))
        (local.set $table (call $g2w_affine_span (local.get $allocation) (i32.const 16399)))
        (if (i32.eq (local.get $table) (global.get $NULL_SENTINEL)) (then
          (call $heap_free (local.get $allocation))
          (br $failed)))
        (local.set $table (i32.and (i32.add (local.get $table) (i32.const 15)) (i32.const -16)))
        (memory.fill (local.get $table) (i32.const 0) (i32.const 16384))
        (local.set $prior (i32.atomic.rmw.cmpxchg (local.get $slot) (i32.const 0) (local.get $table)))
        (if (local.get $prior) (then
          (call $heap_free (local.get $allocation))
          (local.set $table (local.get $prior))))))
      (local.set $cell (call $page_watch_cell (local.get $page)))
      (loop $reference
        (local.set $refs (i32.atomic.load (local.get $cell)))
        (br_if $failed (i32.eq (local.get $refs) (i32.const -1)))
        (br_if $reference (i32.ne
          (i32.atomic.rmw.cmpxchg (local.get $cell) (local.get $refs)
            (i32.add (local.get $refs) (i32.const 1))) (local.get $refs))))
      (call $page_watch_bump (local.get $cell))
      (local.set $page (i32.add (local.get $page) (i32.const 4096)))
      (br_if $pages (i32.le_u (local.get $page) (local.get $end))))
    ;; Previously proved store windows must be checked again by every thread.
    (call $uop_win_bump)
    (return (i32.const 1)))
    ;; Roll back only pages acquired by this attempt; keep other leases live.
    (call $page_watch_release (i32.and (local.get $wa) (i32.const -4096))
      (i32.sub (local.get $page) (i32.and (local.get $wa) (i32.const -4096))))
    (call $page_watch_disable)
    (i32.const 0))

  (func $page_watch_release (export "page_watch_release") (param $wa i32) (param $len i32)
    (local $page i32) (local $end i32) (local $cell i32) (local $refs i32)
    (if (i32.eqz (call $page_watch_valid (local.get $wa) (local.get $len))) (then (return)))
    (local.set $page (i32.and (local.get $wa) (i32.const -4096)))
    (local.set $end (i32.add (local.get $wa) (i32.sub (local.get $len) (i32.const 1))))
    (loop $pages
      (local.set $cell (call $page_watch_cell (local.get $page)))
      (if (local.get $cell) (then
        (block $done (loop $retry
          (local.set $refs (i32.atomic.load (local.get $cell)))
          (br_if $done (i32.eqz (local.get $refs)))
          (br_if $retry (i32.ne (i32.atomic.rmw.cmpxchg (local.get $cell) (local.get $refs)
            (i32.sub (local.get $refs) (i32.const 1))) (local.get $refs)))))))
      (local.set $page (i32.add (local.get $page) (i32.const 4096)))
      (br_if $pages (i32.le_u (local.get $page) (local.get $end)))))

  (func $page_watch_is_watched (param $wa i32) (result i32)
    (local $cell i32)
    (local.set $cell (call $page_watch_cell (local.get $wa)))
    (if (i32.eqz (local.get $cell)) (then (return (i32.const 0))))
    (i32.ne (i32.atomic.load (local.get $cell)) (i32.const 0)))

  (func $page_watch_write_one (param $wa i32)
    (local $cell i32)
    (local.set $cell (call $page_watch_cell (local.get $wa)))
    (if (i32.eqz (local.get $cell)) (then (return)))
    (if (i32.atomic.load (local.get $cell)) (then (call $page_watch_bump (local.get $cell)))))

  (func $page_watch_write (export "page_watch_write") (param $wa i32) (param $len i32)
    (local $page i32) (local $end i32)
    (if (i32.eqz (call $page_watch_valid (local.get $wa) (local.get $len))) (then (return)))
    (local.set $page (i32.and (local.get $wa) (i32.const -4096)))
    (local.set $end (i32.add (local.get $wa) (i32.sub (local.get $len) (i32.const 1))))
    (loop $pages
      (call $page_watch_write_one (local.get $page))
      (local.set $page (i32.add (local.get $page) (i32.const 4096)))
      (br_if $pages (i32.le_u (local.get $page) (local.get $end)))))

  (func $page_watch_write_guest (param $ga i32) (param $len i32)
    (local $chunk i32)
    (block $done (loop $pages
      (br_if $done (i32.eqz (local.get $len)))
      (call $page_watch_write_one (call $g2w (local.get $ga)))
      (local.set $chunk (i32.sub (i32.const 4096) (i32.and (local.get $ga) (i32.const 4095))))
      (if (i32.gt_u (local.get $chunk) (local.get $len)) (then (local.set $chunk (local.get $len))))
      (local.set $ga (i32.add (local.get $ga) (local.get $chunk)))
      (local.set $len (i32.sub (local.get $len) (local.get $chunk)))
      (br $pages))))

  (func $page_watch_any (param $wa i32) (param $len i32) (result i32)
    (local $end i32)
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (local.set $end (i32.add (local.get $wa) (i32.sub (local.get $len) (i32.const 1))))
    (local.set $wa (i32.and (local.get $wa) (i32.const -4096)))
    (loop $pages
      (if (call $page_watch_is_watched (local.get $wa)) (then (return (i32.const 1))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 4096)))
      (br_if $pages (i32.le_u (local.get $wa) (local.get $end))))
    (i32.const 0))
