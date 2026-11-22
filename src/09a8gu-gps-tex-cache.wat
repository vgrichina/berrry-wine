  ;; ---- Shared GPU-stream texture cache ($gtc_*) ------------------------------
  ;; Slot bookkeeping for a producer's decoded-texture cache: LRU eviction
  ;; under a byte budget, pinning, and a fixed-stride payload per slot that
  ;; the producer owns (its key, its GPU-side texture id, its validity
  ;; state: Glide's TMU ranges and palette, D3DIM's page-watch generations).
  ;; The cache never emits records: the producer evicts what $gtc_victim
  ;; names with its own release path, then claims a slot.
  ;;
  ;; Diablo II's town draws ~200 distinct textures a frame (~35 KB of RGBA
  ;; each); a 64-slot round robin re-uploaded 90% of them every frame
  ;; (scratch/runs/20261121-gps-plumbing). $GTC_SLOTS x the budget below
  ;; hold several frames of that working set.
  ;;
  ;; Header (64 B): +0 slots, +4 stride, +8 budget bytes, +12 bytes in use,
  ;; +16 use tick, +20 pin epoch. Then slots x 16 B of meta {state (1 live),
  ;; bytes, tick of last use, pin epoch}, then slots x stride of payload.
  (global $GTC_SLOTS i32 (i32.const 512))
  (global $GTC_BUDGET i32 (i32.const 0x02000000))

  (func $gtc_create (param $slots i32) (param $stride i32) (param $budget i32) (result i32)
    (local $n i32) (local $g i32) (local $c i32)
    (local.set $n (i32.add (i32.const 64) (i32.mul (local.get $slots) (i32.add (i32.const 16) (local.get $stride)))))
    (local.set $g (call $gps_alloc (local.get $n)))
    (if (i32.eqz (local.get $g)) (then (call $gps_fail)))
    (local.set $c (call $gps_wa (local.get $g)))
    (memory.fill (local.get $c) (i32.const 0) (local.get $n))
    (i32.store (local.get $c) (local.get $slots))
    (i32.store offset=4 (local.get $c) (local.get $stride))
    (i32.store offset=8 (local.get $c) (local.get $budget))
    ;; Epoch 1: a never-used slot (pin 0) is not pinned.
    (i32.store offset=20 (local.get $c) (i32.const 1))
    (local.get $c))

  (func $gtc_slots (param $c i32) (result i32) (i32.load (local.get $c)))
  (func $gtc_meta (param $c i32) (param $i i32) (result i32)
    (i32.add (i32.add (local.get $c) (i32.const 64)) (i32.shl (local.get $i) (i32.const 4))))
  (func $gtc_entry (param $c i32) (param $i i32) (result i32)
    (i32.add (i32.add (i32.add (local.get $c) (i32.const 64)) (i32.shl (i32.load (local.get $c)) (i32.const 4)))
      (i32.mul (local.get $i) (i32.load offset=4 (local.get $c)))))
  ;; Slot index of payload address $e.
  (func $gtc_index (param $c i32) (param $e i32) (result i32)
    (i32.div_u (i32.sub (local.get $e) (call $gtc_entry (local.get $c) (i32.const 0)))
      (i32.load offset=4 (local.get $c))))
  (func $gtc_live (param $c i32) (param $i i32) (result i32)
    (i32.load (call $gtc_meta (local.get $c) (local.get $i))))

  ;; Slot $i was looked up: most recently used, pinned until $gtc_unpin.
  (func $gtc_use (param $c i32) (param $i i32)
    (local $m i32) (local $t i32)
    (local.set $m (call $gtc_meta (local.get $c) (local.get $i)))
    (local.set $t (i32.add (i32.load offset=16 (local.get $c)) (i32.const 1)))
    (i32.store offset=16 (local.get $c) (local.get $t))
    (i32.store offset=8 (local.get $m) (local.get $t))
    (i32.store offset=12 (local.get $m) (i32.load offset=20 (local.get $c))))

  ;; The producer's open batch closed: nothing it bound stays pinned.
  (func $gtc_unpin (param $c i32)
    (i32.store offset=20 (local.get $c) (i32.add (i32.load offset=20 (local.get $c)) (i32.const 1))))

  ;; A free slot, or -1.
  (func $gtc_free_slot (param $c i32) (result i32)
    (local $i i32)
    (block $none (loop $scan
      (br_if $none (i32.ge_u (local.get $i) (i32.load (local.get $c))))
      (if (i32.eqz (call $gtc_live (local.get $c) (local.get $i))) (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; The slot the producer must evict before a $bytes texture fits (and,
  ;; with $need_slot, before a slot is free): the least recently used
  ;; unpinned live slot. -1 when nothing needs evicting. Fails when only
  ;; pinned entries are left: a pinned entry is never evicted.
  (func $gtc_victim (param $c i32) (param $bytes i32) (param $need_slot i32) (result i32)
    (local $i i32) (local $m i32) (local $best i32) (local $age i32) (local $a i32) (local $tick i32) (local $epoch i32)
    (if (i32.and
          (i64.le_u (i64.add (i64.extend_i32_u (i32.load offset=12 (local.get $c))) (i64.extend_i32_u (local.get $bytes)))
            (i64.extend_i32_u (i32.load offset=8 (local.get $c))))
          (i32.or (i32.eqz (local.get $need_slot))
            (i32.ge_s (call $gtc_free_slot (local.get $c)) (i32.const 0))))
      (then (return (i32.const -1))))
    (local.set $best (i32.const -1))
    (local.set $tick (i32.load offset=16 (local.get $c)))
    (local.set $epoch (i32.load offset=20 (local.get $c)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (i32.load (local.get $c))))
      (local.set $m (call $gtc_meta (local.get $c) (local.get $i)))
      (if (i32.and (i32.ne (i32.load (local.get $m)) (i32.const 0))
            (i32.ne (i32.load offset=12 (local.get $m)) (local.get $epoch)))
        (then
          (local.set $a (i32.sub (local.get $tick) (i32.load offset=8 (local.get $m))))
          (if (i32.or (i32.lt_s (local.get $best) (i32.const 0)) (i32.gt_u (local.get $a) (local.get $age)))
            (then (local.set $best (local.get $i)) (local.set $age (local.get $a))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.lt_s (local.get $best) (i32.const 0)) (then (call $gps_fail)))
    (local.get $best))

  ;; Claim free slot $i for a $bytes texture (used and pinned).
  (func $gtc_claim (param $c i32) (param $i i32) (param $bytes i32)
    (local $m i32)
    (local.set $m (call $gtc_meta (local.get $c) (local.get $i)))
    (if (i32.load (local.get $m)) (then (call $gps_fail)))
    (i32.store (local.get $m) (i32.const 1))
    (i32.store offset=4 (local.get $m) (local.get $bytes))
    (i32.store offset=12 (local.get $c) (i32.add (i32.load offset=12 (local.get $c)) (local.get $bytes)))
    (call $gtc_use (local.get $c) (local.get $i)))

  ;; Slot $i's texture is gone (the producer released it).
  (func $gtc_drop (param $c i32) (param $i i32)
    (local $m i32)
    (local.set $m (call $gtc_meta (local.get $c) (local.get $i)))
    (if (i32.eqz (i32.load (local.get $m))) (then (return)))
    (i32.store (local.get $m) (i32.const 0))
    (i32.store offset=12 (local.get $c) (i32.sub (i32.load offset=12 (local.get $c)) (i32.load offset=4 (local.get $m))))
    (i32.store offset=4 (local.get $m) (i32.const 0)))

  ;; Forget every slot without releasing (the consumer already dropped all).
  (func $gtc_reset (param $c i32)
    (memory.fill (call $gtc_meta (local.get $c) (i32.const 0)) (i32.const 0)
      (i32.shl (i32.load (local.get $c)) (i32.const 4)))
    (i32.store offset=12 (local.get $c) (i32.const 0)))
