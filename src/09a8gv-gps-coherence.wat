  ;; GPU-stream coherence: the one readback loop and the one lazy CPU-access
  ;; table every GPS producer (Glide, D3DIM, GL, D3D9) uses.
  ;;
  ;; READBACK. $gps_readback_rect reads executor RT rect (x, y, w, hgt) into
  ;; CPU pixels in bands of at most 2 MB of A8B8G8R8 (half the smallest
  ;; arena), converting each row with $d3g_rgba_to_row to (fmt, bpp). $pitch
  ;; is signed: a negative pitch with $dst at the last row stores bottom-up
  ;; (Glide's lower-left-origin LFB stage). The caller has closed its own
  ;; open batch/draw (each band's READBACK then closes nothing), keeps its
  ;; per-call statistics and page-watch extents, and gets the band count
  ;; back. Per band: arena, slot 0 armed, READBACK published, a producer
  ;; kick mark (the sync kick that follows hands the consumer everything),
  ;; slot wait, rows converted.
  ;;
  ;; LAZY CPU ACCESS. A producer that would read a GPU surface back because
  ;; the guest MIGHT touch its CPU copy (a Lock) arms a lazy entry instead:
  ;; the wasm range of the CPU copy, which must lie in the DIB window, the
  ;; only guest memory whose every translation leaves the direct window
  ;; ($g2w_slow, $g2w_affine_span). The first guest translation that
  ;; overlaps an armed entry materializes it -- the producer's readback --
  ;; and frees it; an Unlock that finds its entry still armed ($gps_lazy_disarm
  ;; returns 1) knows the guest never looked or wrote, so there is nothing to
  ;; read and nothing to upload. A REP MOVS/STOS that overwrites a whole
  ;; armed range without reading it ($gps_lazy_overwrite) frees it with no
  ;; readback (the producer's discard). Host writes into guest memory
  ;; ($gps_lazy_host_write_fence) count as touches.
  ;;
  ;; $GPS_LAZY: +0 mutex, +4 armed entries (the one word the translation hot
  ;; path reads), +8 generation counter, +64 eight 48-byte entries:
  ;;   +0 start (wasm)  +4 length (0 = free)  +8 api ($GPS_API_*)
  ;;   +12 key (the producer's name for the surface)  +16 generation
  ;;   +20..+36 five producer words  +40 readback site.
  ;; Process-shared, never initialized by data (like the old
  ;; $D3DIM_LAZY_SHARED words it replaces).
  ;;
  ;; Lock order: a producer's own lock (Glide's $GLIDE_STATE, D3D9's process
  ;; state lock), then the mutex. D3DIM's materialize takes its producer
  ;; lock INSIDE the mutex, as its lazy Lock always has, and no D3DIM path
  ;; takes the mutex while holding it. A touch of a Glide/D3D9 entry
  ;; therefore drops the mutex, takes the producer lock, retakes the mutex
  ;; and rechecks the entry's generation before reading back.
  ;;
  ;; Statistics (gps_stat(api, i), printed on the [gps] line): 8 lazy
  ;; arms, 9 touched (read back on first access), 10 untouched (disarmed by
  ;; the Unlock, nothing read), 11 overwritten (discarded by a whole-range
  ;; REP MOVS/STOS).

  (global $GPS_LAZY i32 (region.addr $GPS_LAZY 0))
  (global $GPS_LAZY_SIZE i32 (region.size $GPS_LAZY))
  (global $GPS_LAZY_STAT_ARMED i32 (i32.const 8))
  (global $GPS_LAZY_STAT_TOUCHED i32 (i32.const 9))
  (global $GPS_LAZY_STAT_UNTOUCHED i32 (i32.const 10))
  (global $GPS_LAZY_STAT_OVERWRITTEN i32 (i32.const 11))
  ;; Set while this instance holds the mutex (and so while it materializes):
  ;; its own translations of an armed range must not re-enter.
  (global $gps_lazy_bypass (mut i32) (i32.const 0))

  ;; ---- readback -------------------------------------------------------------
  (func $gps_readback_rect (param $h i32) (param $rt i32) (param $x i32) (param $y i32)
      (param $w i32) (param $hgt i32) (param $dst i32) (param $pitch i32) (param $fmt i32) (param $bpp i32)
      (result i32)
    (local $band i32) (local $k i32) (local $n i32) (local $pos i32) (local $p i32) (local $seq i32)
    (local $src i32) (local $i i32) (local $bands i32) (local $row i32)
    (local.set $row (i32.shl (local.get $w) (i32.const 2)))
    (local.set $band (i32.div_u (i32.const 0x200000) (local.get $row)))
    (if (i32.eqz (local.get $band)) (then (local.set $band (i32.const 1))))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $k) (local.get $hgt)))
      (local.set $n (i32.sub (local.get $hgt) (local.get $k)))
      (if (i32.gt_u (local.get $n) (local.get $band)) (then (local.set $n (local.get $band))))
      (local.set $pos (call $gps_arena_alloc (local.get $h) (i32.mul (local.get $row) (local.get $n))))
      (call $gps_slot_arm (local.get $h) (i32.const 0))
      (local.set $p (call $gps_begin_auto (local.get $h) (global.get $GPS_OP_READBACK) (size-of GpsReadback)))
      (store.field GpsReadback rt (local.get $p) (local.get $rt))
      (store.field GpsReadback x (local.get $p) (local.get $x))
      (store.field GpsReadback y (local.get $p) (i32.add (local.get $y) (local.get $k)))
      (store.field GpsReadback w (local.get $p) (local.get $w))
      (store.field GpsReadback h (local.get $p) (local.get $n))
      (store.field GpsReadback fmt (local.get $p) (global.get $GPS_FMT_A8B8G8R8))
      (store.field GpsReadback dst (local.get $p) (local.get $pos))
      (store.field GpsReadback pitch (local.get $p) (local.get $row))
      (store.field GpsReadback slot (local.get $p) (i32.const 0))
      (local.set $seq (call $gps_end (local.get $h) (local.get $p) (i32.const 0)))
      (local.set $bands (i32.add (local.get $bands) (i32.const 1)))
      (call $gps_kick_mark (local.get $h))
      (call $gps_slot_wait (local.get $h) (i32.const 0) (local.get $seq))
      (local.set $src (call $gps_arena_ptr (local.get $h) (local.get $pos)))
      (local.set $i (i32.const 0))
      (block $rows_done (loop $rows
        (br_if $rows_done (i32.ge_u (local.get $i) (local.get $n)))
        (call $d3g_rgba_to_row
          (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $row)))
          (i32.add (local.get $dst) (i32.mul (i32.add (local.get $k) (local.get $i)) (local.get $pitch)))
          (local.get $w) (local.get $fmt) (local.get $bpp))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $rows)))
      (local.set $k (i32.add (local.get $k) (local.get $n)))
      (br $bands)))
    (local.get $bands))

  ;; ---- lazy table -------------------------------------------------------------
  (func $gps_lazy_enter
    (loop $retry
      (if (i32.atomic.rmw.cmpxchg (region.addr $GPS_LAZY 0) (i32.const 0) (i32.const 1)) (then
        ;; A failed renderer must not leave another guest waiting forever.
        (if (i32.eq (memory.atomic.wait32 (region.addr $GPS_LAZY 0)
              (i32.const 1) (i64.const 30000000000)) (i32.const 2)) (then (unreachable)))
        (br $retry))))
    (global.set $gps_lazy_bypass (i32.const 1)))

  (func $gps_lazy_leave
    (global.set $gps_lazy_bypass (i32.const 0))
    (i32.atomic.store (region.addr $GPS_LAZY 0) (i32.const 0))
    (drop (memory.atomic.notify (region.addr $GPS_LAZY 0) (i32.const 2147483647))))

  (func $gps_lazy_slot (param $i i32) (result i32)
    (i32.add (region.addr $GPS_LAZY 64) (i32.mul (local.get $i) (i32.const 48))))

  (func $gps_lazy_hits (param $e i32) (param $wa i32) (param $len i32) (result i32)
    (local $n i32)
    (local.set $n (i32.atomic.load offset=4 (local.get $e)))
    (i32.and (i32.and (i32.ne (local.get $n) (i32.const 0)) (i32.ne (local.get $len) (i32.const 0)))
      (i32.and (i32.lt_u (local.get $wa) (i32.add (i32.load (local.get $e)) (local.get $n)))
        (i64.gt_u (i64.add (i64.extend_i32_u (local.get $wa)) (i64.extend_i32_u (local.get $len)))
          (i64.extend_i32_u (i32.load (local.get $e)))))))

  ;; The first armed entry overlapping [wa, wa+len), or 0.
  (func $gps_lazy_find (param $wa i32) (param $len i32) (result i32)
    (local $i i32) (local $e i32)
    (loop $scan
      (local.set $e (call $gps_lazy_slot (local.get $i)))
      (if (call $gps_lazy_hits (local.get $e) (local.get $wa) (local.get $len)) (then (return (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 8))))
    (i32.const 0))

  ;; The armed entry of $api named $key (0 = any of $api's), or 0. Without
  ;; the mutex it is a peek: the answer may be stale by the time it returns.
  (func $gps_lazy_find_key (param $api i32) (param $key i32) (result i32)
    (local $i i32) (local $e i32)
    (loop $scan
      (local.set $e (call $gps_lazy_slot (local.get $i)))
      (if (i32.and (i32.ne (i32.atomic.load offset=4 (local.get $e)) (i32.const 0))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $api))
              (i32.or (i32.eqz (local.get $key)) (i32.eq (i32.load offset=12 (local.get $e)) (local.get $key)))))
        (then (return (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 8))))
    (i32.const 0))

  ;; With the mutex held: arm [wa, wa+len) for $api/$key. Eight surfaces
  ;; locked at once is more than any producer makes; a ninth is a bug.
  (func $gps_lazy_arm_locked (param $api i32) (param $key i32) (param $wa i32) (param $len i32)
      (param $a0 i32) (param $a1 i32) (param $a2 i32) (param $a3 i32) (param $a4 i32) (param $site i32)
    (local $i i32) (local $e i32) (local $gen i32)
    (block $found (loop $scan
      (local.set $e (call $gps_lazy_slot (local.get $i)))
      (br_if $found (i32.eqz (i32.atomic.load offset=4 (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 8)))
      (call $gps_fail)))
    (local.set $gen (i32.add (i32.load (region.addr $GPS_LAZY 8)) (i32.const 1)))
    (i32.store (region.addr $GPS_LAZY 8) (local.get $gen))
    (i32.store (local.get $e) (local.get $wa))
    (i32.store offset=8 (local.get $e) (local.get $api))
    (i32.store offset=12 (local.get $e) (local.get $key))
    (i32.store offset=16 (local.get $e) (local.get $gen))
    (i32.store offset=20 (local.get $e) (local.get $a0))
    (i32.store offset=24 (local.get $e) (local.get $a1))
    (i32.store offset=28 (local.get $e) (local.get $a2))
    (i32.store offset=32 (local.get $e) (local.get $a3))
    (i32.store offset=36 (local.get $e) (local.get $a4))
    (i32.store offset=40 (local.get $e) (local.get $site))
    (i32.atomic.store offset=4 (local.get $e) (local.get $len))
    (drop (i32.atomic.rmw.add (region.addr $GPS_LAZY 4) (i32.const 1)))
    (call $gps_stat_api (local.get $api) (global.get $GPS_LAZY_STAT_ARMED) (i32.const 1))
    ;; Cached read windows must re-prove their DIB span before use.
    (call $uop_win_bump))

  ;; Arm with the mutex taken here (the caller holds its producer lock).
  (func $gps_lazy_arm (param $api i32) (param $key i32) (param $wa i32) (param $len i32)
      (param $a0 i32) (param $a1 i32) (param $a2 i32) (param $a3 i32) (param $a4 i32) (param $site i32)
    (local $e i32)
    (call $gps_lazy_enter)
    ;; A stale entry of the same surface (its Unlock never came) goes first.
    (local.set $e (call $gps_lazy_find_key (local.get $api) (local.get $key)))
    (if (local.get $e) (then (call $gps_lazy_free_locked (local.get $e))))
    (call $gps_lazy_arm_locked (local.get $api) (local.get $key) (local.get $wa) (local.get $len)
      (local.get $a0) (local.get $a1) (local.get $a2) (local.get $a3) (local.get $a4) (local.get $site))
    (call $gps_lazy_leave))

  (func $gps_lazy_free_locked (param $e i32)
    (if (i32.eqz (i32.atomic.load offset=4 (local.get $e))) (then (return)))
    (i32.atomic.store offset=4 (local.get $e) (i32.const 0))
    (drop (i32.atomic.rmw.sub (region.addr $GPS_LAZY 4) (i32.const 1))))

  ;; The Unlock of $api/$key: 1 when its entry was still armed (the guest
  ;; never translated the range: nothing to read back, nothing to upload).
  ;; $key 0 disarms every entry of $api (a closing device).
  (func $gps_lazy_disarm (param $api i32) (param $key i32) (result i32)
    (local $e i32) (local $r i32)
    (if (i32.eqz (i32.atomic.load (region.addr $GPS_LAZY 4))) (then (return (i32.const 0))))
    (call $gps_lazy_enter)
    (loop $more
      (local.set $e (call $gps_lazy_find_key (local.get $api) (local.get $key)))
      (if (local.get $e) (then
        (call $gps_lazy_free_locked (local.get $e))
        (call $gps_stat_api (local.get $api) (global.get $GPS_LAZY_STAT_UNTOUCHED) (i32.const 1))
        (local.set $r (i32.const 1))
        (br_if $more (i32.eqz (local.get $key))))))
    (call $gps_lazy_leave)
    (local.get $r))

  ;; Producer locks a Glide/D3D9 materialize needs (taken before the mutex).
  (func $gps_lazy_frontend_acquire (param $api i32)
    (if (i32.eq (local.get $api) (global.get $GPS_API_GLIDE))
      (then (call $lock_acquire (global.get $GLIDE_STATE)) (return)))
    (if (i32.eq (local.get $api) (global.get $GPS_API_D3D9))
      (then (call $d3d_state_enter_blocking) (return)))
    (call $gps_fail))
  (func $gps_lazy_frontend_release (param $api i32)
    (if (i32.eq (local.get $api) (global.get $GPS_API_GLIDE))
      (then (call $lock_release (global.get $GLIDE_STATE)) (return)))
    (if (i32.eq (local.get $api) (global.get $GPS_API_D3D9))
      (then (call $d3d_state_leave) (return)))
    (call $gps_fail))

  ;; With the producer lock and the mutex held: read entry $e back (or, with
  ;; $discard, record that the guest is overwriting all of it) and free it.
  (func $gps_lazy_settle (param $e i32) (param $discard i32)
    (local $api i32)
    (local.set $api (i32.load offset=8 (local.get $e)))
    (if (i32.eq (local.get $api) (global.get $GPS_API_GLIDE)) (then
      (call $glide_lazy_settle (local.get $e) (local.get $discard))))
    (if (i32.eq (local.get $api) (global.get $GPS_API_D3D9)) (then
      (call $d9g_lazy_settle (local.get $e) (local.get $discard))))
    (call $gps_lazy_free_locked (local.get $e))
    (call $gps_stat_api (local.get $api)
      (select (global.get $GPS_LAZY_STAT_OVERWRITTEN) (global.get $GPS_LAZY_STAT_TOUCHED) (local.get $discard))
      (i32.const 1)))

  ;; Settle entry $e (found under the mutex, generation $gen) from a guest
  ;; translation: drop the mutex, take the producer lock, retake the mutex,
  ;; settle if it is still the same arming. Returns with the mutex released.
  (func $gps_lazy_settle_relocked (param $e i32) (param $gen i32) (param $discard i32)
    (local $api i32)
    (local.set $api (i32.load offset=8 (local.get $e)))
    (call $gps_lazy_leave)
    (call $gps_lazy_frontend_acquire (local.get $api))
    (call $gps_lazy_enter)
    (if (i32.and (i32.ne (i32.atomic.load offset=4 (local.get $e)) (i32.const 0))
          (i32.eq (i32.load offset=16 (local.get $e)) (local.get $gen)))
      (then (call $gps_lazy_settle (local.get $e) (local.get $discard))))
    (call $gps_lazy_leave)
    (call $gps_lazy_frontend_release (local.get $api)))

  ;; A guest translation of wasm [wa, wa+len) in the DIB window while
  ;; something is armed: materialize every entry it overlaps.
  (func $gps_lazy_access (param $wa i32) (param $len i32)
    (local $e i32)
    (if (global.get $gps_lazy_bypass) (then (return)))
    (loop $again
      (call $gps_lazy_enter)
      (local.set $e (call $gps_lazy_find (local.get $wa) (local.get $len)))
      (if (i32.eqz (local.get $e)) (then (call $gps_lazy_leave) (return)))
      (if (i32.eq (i32.load offset=8 (local.get $e)) (global.get $GPS_API_D3DIM))
        (then
          (global.set $d3dim_lazy_touched (i32.add (global.get $d3dim_lazy_touched) (i32.const 1)))
          (call $gps_stat_api (global.get $GPS_API_D3DIM) (global.get $GPS_LAZY_STAT_TOUCHED) (i32.const 1))
          (call $d3dim_lazy_materialize (i32.load (local.get $e)) (i32.atomic.load offset=4 (local.get $e)))
          ;; Materializing the entry's own range always frees it.
          (call $gps_lazy_free_locked (local.get $e))
          (call $d3dim_lazy_settled_locked)
          (call $gps_lazy_leave))
        (else
          (call $gps_lazy_settle_relocked (local.get $e) (i32.load offset=16 (local.get $e)) (i32.const 0))))
      (br $again)))

  ;; A REP MOVS / STOS ($rep_movs_mem, $rep_stos_mem, the micro-op tier's
  ;; COPY/FILL slow path) is about to write guest [dst, dst+bytes), reading
  ;; [src, src+sbytes) (0 for STOS). An armed entry that write covers whole,
  ;; when the read does not touch an armed range, would have its first-touch
  ;; readback overwritten before anything read it: the producer discards
  ;; instead and the entry is freed with nothing read back. MechWarrior 3
  ;; copies its whole menu background into the locked back buffer every
  ;; frame (one 640x480 readback per Flip before). The source must be one
  ;; proven mapping so the copy cannot stop part way.
  (func $gps_lazy_overwrite (param $dst i32) (param $bytes i32) (param $src i32) (param $sbytes i32)
    (local $off i32) (local $wa i32) (local $i i32) (local $e i32) (local $start i32) (local $len i32)
    (if (i32.eqz (i32.atomic.load (region.addr $GPS_LAZY 4))) (then (return)))
    (if (global.get $gps_lazy_bypass) (then (return)))
    (local.set $off (i32.sub (local.get $dst) (global.get $DIB_GUEST_BASE)))
    (if (i32.ge_u (local.get $off) (global.get $DIB_GUEST_CAPACITY)) (then (return)))
    (if (i32.gt_u (local.get $bytes) (i32.sub (global.get $DIB_GUEST_CAPACITY) (local.get $off))) (then (return)))
    (local.set $wa (i32.add (global.get $DIB_BACKING_BASE) (local.get $off)))
    (call $gps_lazy_enter)
    (block $out
      ;; The read side first: it must not touch any armed range.
      (if (local.get $sbytes) (then
        (local.set $off (i32.sub (local.get $src) (global.get $DIB_GUEST_BASE)))
        (if (i32.lt_u (local.get $off) (global.get $DIB_GUEST_CAPACITY)) (then
          (br_if $out (call $gps_lazy_find
            (i32.add (global.get $DIB_BACKING_BASE) (local.get $off)) (local.get $sbytes)))
          ;; The span may run past the window: then it is not one mapping.
          (br_if $out (i32.gt_u (local.get $sbytes) (i32.sub (global.get $DIB_GUEST_CAPACITY) (local.get $off))))))
        (br_if $out (i32.eqz (call $string_guest_range_contiguous (local.get $src) (local.get $sbytes))))))
      (loop $scan
        (local.set $e (call $gps_lazy_slot (local.get $i)))
        (local.set $len (i32.atomic.load offset=4 (local.get $e)))
        (local.set $start (i32.load (local.get $e)))
        (if (i32.and (i32.ne (local.get $len) (i32.const 0))
              (i32.and (i32.le_u (local.get $wa) (local.get $start))
                (i64.ge_u (i64.add (i64.extend_i32_u (local.get $wa)) (i64.extend_i32_u (local.get $bytes)))
                  (i64.add (i64.extend_i32_u (local.get $start)) (i64.extend_i32_u (local.get $len))))))
          (then
            (if (i32.eq (i32.load offset=8 (local.get $e)) (global.get $GPS_API_D3DIM))
              (then
                (if (i32.eqz (global.get $d3dim_gpu_cooperative)) (then
                  (if (i32.eq (call $d3dim_gps_discard (local.get $start) (local.get $len)) (i32.const 1)) (then
                    (call $gps_lazy_free_locked (local.get $e))
                    (call $d3dim_lazy_settled_locked)
                    (call $gps_stat_api (global.get $GPS_API_D3DIM) (global.get $GPS_LAZY_STAT_OVERWRITTEN) (i32.const 1)))))))
              (else
                ;; Releases the mutex; the scan restarts under a new one.
                (call $gps_lazy_settle_relocked (local.get $e) (i32.load offset=16 (local.get $e)) (i32.const 1))
                (call $gps_lazy_enter)
                (local.set $i (i32.const -1))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $scan (i32.lt_u (local.get $i) (i32.const 8)))))
    (call $gps_lazy_leave))

  ;; Host file reads scatter directly through JS views, bypassing g2w stores.
  ;; Run on the owning instance BEFORE its host import, never on the page
  ;; shadow after copying. Lazy entries only cover backing wholly inside the
  ;; DIB window; other mappings need no materialization here.
  (func $gps_lazy_host_write_interval (param $start i64) (param $end i64)
    (local $lo i64) (local $hi i64) (local $window_end i64)
    (local.set $lo (i64.extend_i32_u (global.get $DIB_GUEST_BASE)))
    (local.set $window_end (i64.add (local.get $lo)
      (i64.extend_i32_u (global.get $DIB_GUEST_CAPACITY))))
    (if (i64.gt_u (local.get $start) (local.get $lo))
      (then (local.set $lo (local.get $start))))
    (local.set $hi (select (local.get $end) (local.get $window_end)
      (i64.lt_u (local.get $end) (local.get $window_end))))
    (if (i64.lt_u (local.get $lo) (local.get $hi)) (then
      (call $gps_lazy_access
        (i32.add (global.get $DIB_BACKING_BASE)
          (i32.sub (i32.wrap_i64 (local.get $lo)) (global.get $DIB_GUEST_BASE)))
        (i32.wrap_i64 (i64.sub (local.get $hi) (local.get $lo)))))))
  (func $gps_lazy_host_write_fence (param $ga i32) (param $len i32)
    (local $end i64)
    (if (i32.eqz (local.get $len)) (then (return)))
    (if (i32.eqz (i32.atomic.load (region.addr $GPS_LAZY 4))) (then (return)))
    ;; Match filesystem guestChunk((bufGA + moved) >>> 0), without changing
    ;; its mapping validation or errors. Widen before adding; do not mistake
    ;; a wrapping interval for an empty/nonoverlapping one.
    (local.set $end (i64.add (i64.extend_i32_u (local.get $ga))
      (i64.extend_i32_u (local.get $len))))
    (call $gps_lazy_host_write_interval (i64.extend_i32_u (local.get $ga))
      (select (local.get $end) (i64.const 4294967296)
        (i64.lt_u (local.get $end) (i64.const 4294967296))))
    (if (i64.gt_u (local.get $end) (i64.const 4294967296)) (then
      (call $gps_lazy_host_write_interval (i64.const 0)
        (i64.sub (local.get $end) (i64.const 4294967296))))))

  ;; Is wasm [wa, wa+len) a range a lazy entry may cover: page-aligned start
  ;; (scalar helpers translate only an access's first byte unless it crosses
  ;; a page, so a range starting mid-page could be entered by a straddling
  ;; access that never translates inside it), wholly in the DIB window.
  (func $gps_lazy_range_ok (param $wa i32) (param $len i32) (result i32)
    (local $off i32)
    (local.set $off (i32.sub (local.get $wa) (global.get $DIB_BACKING_BASE)))
    (i32.and (i32.and (i32.eqz (i32.and (local.get $wa) (i32.const 4095))) (i32.ne (local.get $len) (i32.const 0)))
      (i32.and (i32.lt_u (local.get $off) (global.get $DIB_GUEST_CAPACITY))
        (i32.le_u (local.get $len) (i32.sub (global.get $DIB_GUEST_CAPACITY) (local.get $off))))))
