  ;; Glide 2 ABI: original 3dfx glide2x/cvg/glide/src/glide.h at
  ;; sezero/glide 2f226f0f9225ce8ee83e6a4a7042981e719d19ee.
  ;; One virtual board: Glide2 exposes one TMU; Glide3 exposes two, each 4 MiB.
  ;; Shared block: +0/+4 recursive lock; +8 initialized; +12 open;
  ;; +16 GPS ring header (wasm), +20 GlideGps producer block (wasm);
  ;; +24 width,+28 height; +32 callback;
  ;; +36 triangle count; +40 LFB guest pointer; +44 producer block (guest);
  ;; +48 LFB lock kind; +52 locked buffer; +112 ABI mode; +116 Glide3 heap;
  ;; +120 opt-in LFB metrics flag;
  ;; +256 pipeline state; +512 scratch. Glide3 extension is affine heap storage.
  ;; All handlers take the shared lock, including state setters. No setter
  ;; performs host RPC. Command records contain immutable copied arguments.

  (global $GLIDE_STATE i32 (region.addr $GLIDE_STATE 0))
  (global $GLIDE_STATE_SIZE i32 (region.size $GLIDE_STATE))

  (func $glide_fail
    (call $host_log_i32 (i32.const 0x474c4944))
    (unreachable))

  (func $glide_init
    (i32.store offset=8 (global.get $GLIDE_STATE) (i32.const 1)))

  (func $glide_state (result i32) (region.addr $GLIDE_STATE 256))
  (func $glide_scratch (result i32) (region.addr $GLIDE_STATE 512))

  ;; ================================================================
  ;; GPU stream v2 producer (docs/gpu-stream-v2.md, "Glide lowering").
  ;; Glide is lowered HERE into GPS records: state -> RASTER/BIND/SAMPLER/
  ;; SHADER/CONSTS, vertices -> DRAW_UP in the arena, LFB -> READBACK/UPLOAD,
  ;; grBufferSwap -> PRESENT. Texture RAM, the palette and every format
  ;; decode live in WAT; executors never see a Glide enum.
  ;; Shared block: +16 ring header (wasm), +20 producer block (wasm),
  ;; +44 producer block (guest, for heap_free).
  ;; ================================================================
  (global $GLIDE_TMU_BYTES i32 (i32.const 4194304))
  (global $GLIDE_RING_BYTES i32 (i32.const 1048576))
  (global $GLIDE_ARENA_BYTES i32 (i32.const 4194304))
  (global $GLIDE_TEX_CACHE i32 (i32.const 64))
  (global $GLIDE_SHADER_CACHE i32 (i32.const 64))
  (global $GLIDE_SAMPLER_CACHE i32 (i32.const 32))
  (global $GLIDE_DRAW_MAX i32 (i32.const 65535))

  ;; Texture cache entry (12 words): valid, unit, start, small, large, aspect,
  ;; format, mask, id, end, pad, pad. Shader entry (26 words): valid, id,
  ;; key[24]. Sampler entry (4 words): valid, packed, lod bias bits, id.
  (layout GlideGps
    (field next_id i32)
    (field color i32 2)          ;; resource id of Glide buffer 0 (front), 1 (back)
    (field depth i32)
    (field layout i32)
    (field target i32)           ;; color id named by the last TARGETS
    (field single i32)           ;; one color buffer: front and back are one RT
    (field width i32) (field height i32) (field hwnd i32) (field color_format i32)
    (field front_dirty i32)
    (field pipe_valid i32)       ;; snap matches the emitted pipeline
    (field pipe_dual i32)
    (field ps i32)               ;; pixel shader of the emitted pipeline
    (field draw_open i32)        ;; payload address of the begun DRAW_UP, 0 none
    (field draw_prim i32)
    (field draw_end i32)         ;; arena position after its last vertex
    (field draw_count i32)
    (field kick_pos i32)         ;; write_pos at the last kick
    (field kick_arena i32)       ;; arena_head at the last kick
    (field present_seq i32 2)    ;; seqs of the two newest PRESENTs (pacing)
    (field frame i32)
    (field gamma_id i32)
    (field gamma_bits i32)       ;; f32 bits of the scalar gamma the LUT holds
    (field gamma_table i32)      ;; grLoadGammaTable/guGammaCorrectionRGB seen
    (field gamma_dirty i32)
    (field fog_id i32)
    (field tmu_ram i32 2)        ;; wasm address, 0 = never allocated (reads 0)
    (field tmu_guest i32 2)
    (field ir i32)               ;; IR scratch, wasm
    (field ir_guest i32)
    (field tex_next i32)         ;; round-robin eviction cursor
    (field shader_next i32)
    (field sampler_next i32)
    ;; Vertex conversion parameters of the emitted pipeline.
    (field vx_origin i32) (field vx_height f32)
    (field vx_s0 f32) (field vx_t0 f32) (field vx_s1 f32) (field vx_t1 f32)
    (field vx_hint_q0 i32) (field vx_needs_z i32) (field vx_bias f64) (field vx_dual i32)
    (field snap i32 84)          ;; 256-byte state + 80-byte Glide3 TMU1 state
    (field vtx i32 45)           ;; three GrVertex for Glide 2 draws
    (field fog i32 16)
    (field gamma i32 192)        ;; R[256] G[256] B[256] bytes
    (field tex i32 768)
    (field shader i32 1664)
    (field sampler i32 128)
    (field key i32 24)           ;; shader key being looked up
    ;; Last emitted RASTER / CONSTS / BIND payloads (executor state is sticky:
    ;; an unchanged one is not re-emitted), and the payload being built.
    (field last_raster i32 24)
    (field last_consts i32 22)
    (field last_bind i32 7)
    (field stage i32 24))

  (func $glide_pb (result i32)
    (local $pb i32)
    (local.set $pb (i32.load offset=20 (global.get $GLIDE_STATE)))
    (if (i32.or (i32.eqz (local.get $pb)) (i32.eqz (i32.load offset=12 (global.get $GLIDE_STATE))))
      (then (call $glide_fail)))
    (local.get $pb))

  (func $glide_ring (result i32) (i32.load offset=16 (global.get $GLIDE_STATE)))

  (func $glide_word (param $pb i32) (param $field i32) (param $i i32) (result i32)
    (i32.load (i32.add (local.get $field) (i32.shl (local.get $i) (i32.const 2)))))

  ;; Publish the open DRAW_UP, if any. Every other record closes it first.
  (func $glide_close_draw (param $pb i32)
    (local $p i32)
    (local.set $p (load.field GlideGps draw_open (local.get $pb)))
    (if (i32.eqz (local.get $p)) (then (return)))
    (store.field GlideGps draw_open (local.get $pb) (i32.const 0))
    (store.field GpsDraw count (local.get $p) (load.field GlideGps draw_count (local.get $pb)))
    (store.field GpsDraw vcount (local.get $p) (load.field GlideGps draw_count (local.get $pb)))
    (drop (call $gps_end (call $glide_ring) (local.get $p) (i32.const 0))))

  (func $glide_kick (param $pb i32) (param $mode i32) (result i32)
    (local $h i32)
    (local.set $h (call $glide_ring))
    (call $glide_close_draw (local.get $pb))
    (store.field GlideGps kick_pos (local.get $pb) (load.field.memarg GpsRing write_pos (local.get $h)))
    (store.field GlideGps kick_arena (local.get $pb) (load.field.memarg GpsRing arena_head (local.get $h)))
    (call $gps_kick (local.get $h) (local.get $mode)))

  ;; Begin a record (closing the open draw). Hands the consumer a quarter of
  ;; the ring or arena at a time so it runs while the guest keeps writing.
  (func $glide_begin (param $pb i32) (param $op i32) (param $n i32) (result i32)
    (local $h i32)
    (local.set $h (call $glide_ring))
    (call $glide_close_draw (local.get $pb))
    (if (i32.or
          (i32.ge_u (i32.sub (load.field.memarg GpsRing write_pos (local.get $h))
            (load.field GlideGps kick_pos (local.get $pb))) (i32.shr_u (global.get $GLIDE_RING_BYTES) (i32.const 2)))
          (i32.ge_u (i32.sub (load.field.memarg GpsRing arena_head (local.get $h))
            (load.field GlideGps kick_arena (local.get $pb))) (i32.shr_u (global.get $GLIDE_ARENA_BYTES) (i32.const 2))))
      (then (drop (call $glide_kick (local.get $pb) (global.get $GPS_KICK_ASYNC)))))
    (call $gps_begin (local.get $h) (local.get $op) (local.get $n)))

  (func $glide_end (param $p i32) (result i32)
    (call $gps_end (call $glide_ring) (local.get $p) (i32.const 0)))

  (func $glide_new_id (param $pb i32) (result i32)
    (local $id i32)
    (local.set $id (i32.add (load.field GlideGps next_id (local.get $pb)) (i32.const 1)))
    (store.field GlideGps next_id (local.get $pb) (local.get $id))
    (local.get $id))

  (func $glide_release (param $pb i32) (param $id i32)
    (local $p i32)
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_RELEASE) (size-of GpsRelease)))
    (store.field GpsRelease id (local.get $p) (local.get $id))
    (drop (call $glide_end (local.get $p)))
    (store.field GlideGps pipe_valid (local.get $pb) (i32.const 0)))

  (func $glide_create (param $pb i32) (param $id i32) (param $kind i32) (param $fmt i32)
      (param $levels i32) (param $w i32) (param $hgt i32)
    (call $glide_close_draw (local.get $pb))
    (call $gps_create (call $glide_ring) (local.get $id) (local.get $kind) (local.get $fmt)
      (local.get $levels) (local.get $w) (local.get $hgt) (i32.const 0)))

  ;; UPLOAD rows [y, y+hgt) of level $level from arena position $src.
  (func $glide_upload (param $pb i32) (param $id i32) (param $level i32)
      (param $y i32) (param $w i32) (param $hgt i32) (param $pitch i32) (param $src i32)
    (local $p i32)
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_UPLOAD) (size-of GpsUpload)))
    (store.field GpsUpload id (local.get $p) (local.get $id))
    (store.field GpsUpload level (local.get $p) (local.get $level))
    (store.field GpsUpload face (local.get $p) (i32.const 0))
    (store.field GpsUpload x (local.get $p) (i32.const 0))
    (store.field GpsUpload y (local.get $p) (local.get $y))
    (store.field GpsUpload w (local.get $p) (local.get $w))
    (store.field GpsUpload h (local.get $p) (local.get $hgt))
    (store.field GpsUpload pitch (local.get $p) (local.get $pitch))
    (store.field GpsUpload src (local.get $p) (local.get $src))
    (store.field GpsUpload bytes (local.get $p) (i32.mul (local.get $pitch) (local.get $hgt)))
    (drop (call $glide_end (local.get $p))))

  (func $glide_arena (param $pb i32) (param $n i32) (result i32)
    (call $glide_close_draw (local.get $pb))
    (call $gps_arena_alloc (call $glide_ring) (local.get $n)))

  (func $glide_arena_ptr (param $pos i32) (result i32)
    (call $gps_arena_ptr (call $glide_ring) (local.get $pos)))

  ;; Name color buffer $buffer (0 front, 1 back) as the render target.
  (func $glide_target (param $pb i32) (param $buffer i32)
    (local $id i32) (local $p i32)
    (if (i32.gt_u (local.get $buffer) (i32.const 1)) (then (call $glide_fail)))
    (local.set $id (i32.load (i32.add (elem-addr GlideGps color (local.get $pb) (i32.const 0))
      (i32.shl (local.get $buffer) (i32.const 2)))))
    (if (i32.eq (local.get $id) (load.field GlideGps target (local.get $pb))) (then (return)))
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_TARGETS) (size-of GpsTargets)))
    (store.field GpsTargets color (local.get $p) (local.get $id))
    (store.field GpsTargets depth (local.get $p) (load.field GlideGps depth (local.get $pb)))
    (drop (call $glide_end (local.get $p)))
    (store.field GlideGps target (local.get $pb) (local.get $id)))

  ;; Glide's color value in the open's GrColorFormat, as R|G<<8|B<<16|A<<24
  ;; (original backend color(): ARGB, ABGR, RGBA, BGRA byte orders).
  (func $glide_rgba (param $pb i32) (param $v i32) (result i32)
    (local $f i32) (local $a i32) (local $r i32) (local $g i32) (local $b i32)
    (local.set $f (load.field GlideGps color_format (local.get $pb)))
    (local.set $a (i32.shr_u (local.get $v) (i32.const 24)))
    (local.set $r (i32.and (i32.shr_u (local.get $v) (i32.const 16)) (i32.const 255)))
    (local.set $g (i32.and (i32.shr_u (local.get $v) (i32.const 8)) (i32.const 255)))
    (local.set $b (i32.and (local.get $v) (i32.const 255)))
    (if (i32.eq (local.get $f) (i32.const 1)) (then   ;; ABGR
      (local.set $a (i32.shr_u (local.get $v) (i32.const 24)))
      (local.set $r (i32.and (local.get $v) (i32.const 255)))
      (local.set $b (i32.and (i32.shr_u (local.get $v) (i32.const 16)) (i32.const 255)))))
    (if (i32.eq (local.get $f) (i32.const 2)) (then   ;; RGBA
      (local.set $r (i32.shr_u (local.get $v) (i32.const 24)))
      (local.set $g (i32.and (i32.shr_u (local.get $v) (i32.const 16)) (i32.const 255)))
      (local.set $b (i32.and (i32.shr_u (local.get $v) (i32.const 8)) (i32.const 255)))
      (local.set $a (i32.and (local.get $v) (i32.const 255)))))
    (if (i32.eq (local.get $f) (i32.const 3)) (then   ;; BGRA
      (local.set $b (i32.shr_u (local.get $v) (i32.const 24)))
      (local.set $g (i32.and (i32.shr_u (local.get $v) (i32.const 16)) (i32.const 255)))
      (local.set $r (i32.and (i32.shr_u (local.get $v) (i32.const 8)) (i32.const 255)))
      (local.set $a (i32.and (local.get $v) (i32.const 255)))))
    (if (i32.gt_u (local.get $f) (i32.const 3)) (then (call $glide_fail)))
    (i32.or (i32.or (local.get $r) (i32.shl (local.get $g) (i32.const 8)))
      (i32.or (i32.shl (local.get $b) (i32.const 16)) (i32.shl (local.get $a) (i32.const 24)))))

  ;; Store an R|G<<8|B<<16|A<<24 color as four normalized floats.
  (func $glide_store_color (param $dst i32) (param $rgba i32)
    (f32.store (local.get $dst) (f32.div (f32.convert_i32_u (i32.and (local.get $rgba) (i32.const 255))) (f32.const 255)))
    (f32.store offset=4 (local.get $dst) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $rgba) (i32.const 8)) (i32.const 255))) (f32.const 255)))
    (f32.store offset=8 (local.get $dst) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $rgba) (i32.const 16)) (i32.const 255))) (f32.const 255)))
    (f32.store offset=12 (local.get $dst) (f32.div (f32.convert_i32_u (i32.shr_u (local.get $rgba) (i32.const 24))) (f32.const 255))))

  ;; PRESENT the front buffer. At most two PRESENTs are in flight: the
  ;; producer waits for the older one before writing a third.
  (func $glide_present (param $pb i32)
    (local $h i32) (local $p i32) (local $old i32) (local $seq i32)
    (local.set $h (call $glide_ring))
    (call $glide_gamma_sync (local.get $pb))
    (local.set $old (i32.load (elem-addr GlideGps present_seq (local.get $pb) (i32.const 0))))
    (if (i32.and (i32.ne (local.get $old) (i32.const 0))
          (i32.lt_s (i32.sub (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing done_seq)))
            (local.get $old)) (i32.const 0)))
      (then (drop (call $glide_kick (local.get $pb) (global.get $GPS_KICK_SYNC)))))
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_MARK) (size-of GpsMark)))
    (store.field GpsMark frame (local.get $p) (load.field GlideGps frame (local.get $pb)))
    (store.field GpsMark tag (local.get $p) (i32.const 0x47504c44))
    (drop (call $glide_end (local.get $p)))
    (store.field GlideGps frame (local.get $pb) (i32.add (load.field GlideGps frame (local.get $pb)) (i32.const 1)))
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_PRESENT) (size-of GpsPresent)))
    (store.field GpsPresent rt (local.get $p) (i32.load (elem-addr GlideGps color (local.get $pb) (i32.const 0))))
    (store.field GpsPresent gamma (local.get $p)
      (if (result i32) (i32.or (load.field GlideGps gamma_table (local.get $pb))
            (i32.ne (load.field GlideGps gamma_bits (local.get $pb)) (i32.const 0x3f800000)))
        (then (load.field GlideGps gamma_id (local.get $pb))) (else (i32.const 0))))
    (store.field GpsPresent x (local.get $p) (i32.const 0))
    (store.field GpsPresent y (local.get $p) (i32.const 0))
    (store.field GpsPresent w (local.get $p) (load.field GlideGps width (local.get $pb)))
    (store.field GpsPresent h (local.get $p) (load.field GlideGps height (local.get $pb)))
    (store.field GpsPresent surface (local.get $p) (load.field GlideGps hwnd (local.get $pb)))
    (store.field GpsPresent dst_x (local.get $p) (i32.const 0))
    (store.field GpsPresent dst_y (local.get $p) (i32.const 0))
    (store.field GpsPresent stamp (local.get $p) (load.field GlideGps frame (local.get $pb)))
    (local.set $seq (call $glide_end (local.get $p)))
    (i32.store (elem-addr GlideGps present_seq (local.get $pb) (i32.const 0))
      (i32.load (elem-addr GlideGps present_seq (local.get $pb) (i32.const 1))))
    (i32.store (elem-addr GlideGps present_seq (local.get $pb) (i32.const 1)) (local.get $seq))
    (store.field GlideGps front_dirty (local.get $pb) (i32.const 0)))

  ;; The batch boundary of the old transport: front-buffer work becomes
  ;; visible (when the board is active) and the consumer is handed the rest.
  (func $glide_flush
    (local $pb i32)
    (if (i32.or (i32.eqz (i32.load offset=12 (global.get $GLIDE_STATE)))
          (i32.eqz (i32.load offset=20 (global.get $GLIDE_STATE)))) (then (return)))
    (local.set $pb (call $glide_pb))
    (call $glide_close_draw (local.get $pb))
    (if (i32.and (i32.ne (load.field GlideGps front_dirty (local.get $pb)) (i32.const 0))
          (i32.ne (i32.load offset=244 (call $glide_state)) (i32.const 0)))
      (then (call $glide_present (local.get $pb))))
    (if (i32.ne (load.field.memarg GpsRing write_pos (call $glide_ring))
          (load.field GlideGps kick_pos (local.get $pb)))
      (then (drop (call $glide_kick (local.get $pb) (global.get $GPS_KICK_ASYNC))))))

  ;; grFinish / status reads: everything issued has executed.
  (func $glide_finish
    (local $pb i32)
    (if (i32.or (i32.eqz (i32.load offset=12 (global.get $GLIDE_STATE)))
          (i32.eqz (i32.load offset=20 (global.get $GLIDE_STATE)))) (then (return)))
    (call $glide_flush)
    (local.set $pb (call $glide_pb))
    (if (i32.ne (call $glide_kick (local.get $pb) (global.get $GPS_KICK_SYNC)) (i32.const 1))
      (then (call $glide_fail))))

  ;; ---- Open / close ---------------------------------------------------------
  ;; Producer block and ring survive close (reused by the next open) and are
  ;; returned at grGlideShutdown. Returns 1 when an executor took the open.
  (func $glide_open (param $hwnd i32) (param $w i32) (param $hgt i32) (param $fmt i32) (param $cbuf i32)
      (result i32)
    (local $pb i32) (local $guest i32) (local $h i32) (local $keep i32) (local $p i32) (local $id i32)
    (local $r i32) (local $i i32)
    (local.set $pb (i32.load offset=20 (global.get $GLIDE_STATE)))
    (if (i32.eqz (local.get $pb)) (then
      (local.set $guest (call $gl_alloc_affine (i32.add (size-of GlideGps) (i32.const 16))))
      (if (i32.eqz (local.get $guest)) (then (call $glide_fail)))
      (local.set $pb (i32.and (i32.add (call $g2w (local.get $guest)) (i32.const 15)) (i32.const -16)))
      (memory.fill (local.get $pb) (i32.const 0) (size-of GlideGps))
      (i32.store offset=44 (global.get $GLIDE_STATE) (local.get $guest))
      (i32.store offset=20 (global.get $GLIDE_STATE) (local.get $pb))))
    (if (i32.eqz (load.field GlideGps ir (local.get $pb))) (then
      (local.set $guest (call $gl_alloc_affine (i32.const 12352)))
      (if (i32.eqz (local.get $guest)) (then (call $glide_fail)))
      (store.field GlideGps ir_guest (local.get $pb) (local.get $guest))
      (store.field GlideGps ir (local.get $pb)
        (i32.and (i32.add (call $g2w (local.get $guest)) (i32.const 15)) (i32.const -16)))))
    (local.set $h (i32.load offset=16 (global.get $GLIDE_STATE)))
    (if (i32.eqz (local.get $h)) (then
      (local.set $h (call $gps_ring_open (global.get $GPS_API_GLIDE)
        (global.get $GLIDE_RING_BYTES) (global.get $GLIDE_ARENA_BYTES)))
      (if (i32.eqz (local.get $h)) (then (call $glide_fail)))
      (i32.store offset=16 (global.get $GLIDE_STATE) (local.get $h))))
    ;; Fresh caches and ids; texture RAM, IR scratch and their guest blocks
    ;; (tmu_ram .. ir_guest, six words) are kept, and TMU RAM reads zero again.
    (local.set $keep (i32.add (local.get $pb) (offset-of GlideGps tmu_ram)))
    (local.set $p (call $glide_scratch))
    (memory.copy (local.get $p) (local.get $keep) (i32.const 24))
    (memory.fill (local.get $pb) (i32.const 0) (size-of GlideGps))
    (memory.copy (local.get $keep) (local.get $p) (i32.const 24))
    (loop $units
      (local.set $p (i32.load (i32.add (local.get $keep) (i32.shl (local.get $i) (i32.const 2)))))
      (if (local.get $p) (then (memory.fill (local.get $p) (i32.const 0) (global.get $GLIDE_TMU_BYTES))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $units (i32.lt_u (local.get $i) (i32.const 2))))
    (store.field GlideGps width (local.get $pb) (local.get $w))
    (store.field GlideGps height (local.get $pb) (local.get $hgt))
    (store.field GlideGps hwnd (local.get $pb) (local.get $hwnd))
    (store.field GlideGps color_format (local.get $pb) (local.get $fmt))
    (store.field GlideGps single (local.get $pb) (i32.eq (local.get $cbuf) (i32.const 1)))
    (i32.store offset=12 (global.get $GLIDE_STATE) (i32.const 1))
    (local.set $id (call $glide_new_id (local.get $pb)))
    (call $glide_create (local.get $pb) (local.get $id) (global.get $GPS_KIND_RT)
      (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt))
    (i32.store (elem-addr GlideGps color (local.get $pb) (i32.const 0)) (local.get $id))
    (if (i32.eq (local.get $cbuf) (i32.const 2)) (then
      (local.set $id (call $glide_new_id (local.get $pb)))
      (call $glide_create (local.get $pb) (local.get $id) (global.get $GPS_KIND_RT)
        (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt))))
    (i32.store (elem-addr GlideGps color (local.get $pb) (i32.const 1)) (local.get $id))
    (local.set $id (call $glide_new_id (local.get $pb)))
    (call $glide_create (local.get $pb) (local.get $id) (global.get $GPS_KIND_DS)
      (global.get $GPS_FMT_D16) (i32.const 1) (local.get $w) (local.get $hgt))
    (store.field GlideGps depth (local.get $pb) (local.get $id))
    ;; Vertex layout: POSITIONT, COLOR, TEXCOORD0, TEXCOORD1, float4 each.
    (local.set $id (call $glide_new_id (local.get $pb)))
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_LAYOUT)
      (i32.add (size-of GpsLayout) (i32.mul (i32.const 4) (size-of GpsLayoutElem)))))
    (store.field GpsLayout id (local.get $p) (local.get $id))
    (store.field GpsLayout count (local.get $p) (i32.const 4))
    (store.field GpsLayout stride (local.get $p) (i32.const 64))
    (local.set $i (i32.const 0))
    (loop $elems
      (local.set $guest (i32.add (i32.add (local.get $p) (size-of GpsLayout)) (i32.mul (local.get $i) (size-of GpsLayoutElem))))
      (store.field GpsLayoutElem slot (local.get $guest) (i32.const 0))
      (store.field GpsLayoutElem type (local.get $guest) (global.get $GPS_VTYPE_FLOAT4))
      (store.field GpsLayoutElem usage (local.get $guest)
        (if (result i32) (i32.eqz (local.get $i)) (then (global.get $GPS_USAGE_POSITIONT))
          (else (if (result i32) (i32.eq (local.get $i) (i32.const 1)) (then (global.get $GPS_USAGE_COLOR))
            (else (global.get $GPS_USAGE_TEXCOORD))))))
      (store.field GpsLayoutElem index (local.get $guest)
        (if (result i32) (i32.eq (local.get $i) (i32.const 3)) (then (i32.const 1)) (else (i32.const 0))))
      (store.field GpsLayoutElem offset (local.get $guest) (i32.shl (local.get $i) (i32.const 4)))
      (store.field GpsLayoutElem pad (local.get $guest) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $elems (i32.lt_u (local.get $i) (i32.const 4))))
    (drop (call $glide_end (local.get $p)))
    (store.field GlideGps layout (local.get $pb) (local.get $id))
    (call $glide_target (local.get $pb) (i32.const 1))
    (local.set $r (call $glide_kick (local.get $pb) (global.get $GPS_KICK_SYNC)))
    (if (i32.ne (local.get $r) (i32.const 1)) (then
      (call $gps_ring_reset (call $glide_ring))
      (i32.store offset=12 (global.get $GLIDE_STATE) (i32.const 0))
      (return (i32.const 0))))
    (i32.const 1))

  ;; grSstWinClose: present pending front work, drain, and tell the executor
  ;; to drop every resource. The ring entry stays for the next open.
  (func $glide_close
    (local $pb i32)
    (if (i32.eqz (i32.load offset=12 (global.get $GLIDE_STATE))) (then (return)))
    (call $glide_flush)
    (local.set $pb (call $glide_pb))
    (if (i32.ne (call $glide_kick (local.get $pb) (global.get $GPS_KICK_CLOSE)) (i32.const 1))
      (then (call $glide_fail)))
    (call $gps_ring_reset (call $glide_ring))
    (i32.store offset=12 (global.get $GLIDE_STATE) (i32.const 0)))

  ;; grGlideShutdown: return the ring, producer block, texture RAM and IR.
  (func $glide_release_storage
    (local $pb i32) (local $p i32)
    (if (i32.load offset=16 (global.get $GLIDE_STATE))
      (then (call $gps_ring_free (i32.load offset=16 (global.get $GLIDE_STATE)))))
    (local.set $pb (i32.load offset=20 (global.get $GLIDE_STATE)))
    (if (local.get $pb) (then
      (local.set $p (i32.load (elem-addr GlideGps tmu_guest (local.get $pb) (i32.const 0))))
      (if (local.get $p) (then (call $heap_free (local.get $p))))
      (local.set $p (i32.load (elem-addr GlideGps tmu_guest (local.get $pb) (i32.const 1))))
      (if (local.get $p) (then (call $heap_free (local.get $p))))
      (local.set $p (load.field GlideGps ir_guest (local.get $pb)))
      (if (local.get $p) (then (call $heap_free (local.get $p))))))
    (local.set $p (i32.load offset=44 (global.get $GLIDE_STATE)))
    (if (local.get $p) (then (call $heap_free (local.get $p))))
    (i32.store offset=16 (global.get $GLIDE_STATE) (i32.const 0))
    (i32.store offset=20 (global.get $GLIDE_STATE) (i32.const 0))
    (i32.store offset=44 (global.get $GLIDE_STATE) (i32.const 0)))

  ;; ---- Gamma: a 256x1 R,G,B,255 lookup texture PRESENT names. -----------
  (func $glide_gamma_scalar (param $pb i32) (param $g f64)
    (local $i i32) (local $v i32) (local $t i32)
    (local.set $t (elem-addr GlideGps gamma (local.get $pb) (i32.const 0)))
    (loop $ramp
      (local.set $v (i32.trunc_sat_f64_u (f64.floor (f64.add (f64.mul (f64.const 255)
        (call $host_math_pow (f64.div (f64.convert_i32_u (local.get $i)) (f64.const 255))
          (f64.div (f64.const 1) (local.get $g)))) (f64.const 0.5)))))
      (i32.store8 (i32.add (local.get $t) (local.get $i)) (local.get $v))
      (i32.store8 offset=256 (i32.add (local.get $t) (local.get $i)) (local.get $v))
      (i32.store8 offset=512 (i32.add (local.get $t) (local.get $i)) (local.get $v))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $ramp (i32.lt_u (local.get $i) (i32.const 256))))
    (store.field GlideGps gamma_dirty (local.get $pb) (i32.const 1)))

  ;; grGammaCorrectionValue (state word 53, f32); <= 0 or NaN means 1.
  (func $glide_gamma_value (result f32)
    (local $g f32)
    (local.set $g (f32.load offset=212 (call $glide_state)))
    (if (result f32) (f32.gt (local.get $g) (f32.const 0)) (then (local.get $g)) (else (f32.const 1))))

  ;; The first explicit table/RGB ramp starts from the scalar ramp; from then
  ;; on the table owns the display (original backend gammaTable()).
  (func $glide_gamma_take_table (param $pb i32)
    (if (i32.eqz (load.field GlideGps gamma_table (local.get $pb))) (then
      (call $glide_gamma_scalar (local.get $pb) (f64.promote_f32 (call $glide_gamma_value)))
      (store.field GlideGps gamma_table (local.get $pb) (i32.const 1))))
    (store.field GlideGps gamma_dirty (local.get $pb) (i32.const 1))
    (store.field GlideGps front_dirty (local.get $pb) (i32.const 1)))

  (func $glide_gamma_sync (param $pb i32)
    (local $bits i32) (local $pos i32) (local $dst i32) (local $t i32) (local $i i32) (local $id i32)
    (if (i32.eqz (load.field GlideGps gamma_table (local.get $pb))) (then
      (local.set $bits (i32.reinterpret_f32 (call $glide_gamma_value)))
      (if (i32.ne (local.get $bits) (load.field GlideGps gamma_bits (local.get $pb))) (then
        (store.field GlideGps gamma_bits (local.get $pb) (local.get $bits))
        (if (i32.ne (local.get $bits) (i32.const 0x3f800000)) (then
          (call $glide_gamma_scalar (local.get $pb) (f64.promote_f32 (f32.reinterpret_i32 (local.get $bits))))))))))
    (if (i32.eqz (load.field GlideGps gamma_dirty (local.get $pb))) (then (return)))
    (store.field GlideGps gamma_dirty (local.get $pb) (i32.const 0))
    (local.set $id (load.field GlideGps gamma_id (local.get $pb)))
    (if (i32.eqz (local.get $id)) (then
      (local.set $id (call $glide_new_id (local.get $pb)))
      (store.field GlideGps gamma_id (local.get $pb) (local.get $id))
      (call $glide_create (local.get $pb) (local.get $id) (global.get $GPS_KIND_TEX2D)
        (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (i32.const 256) (i32.const 1))))
    (local.set $pos (call $glide_arena (local.get $pb) (i32.const 1024)))
    (local.set $dst (call $glide_arena_ptr (local.get $pos)))
    (local.set $t (elem-addr GlideGps gamma (local.get $pb) (i32.const 0)))
    (loop $entries
      (i32.store (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 2)))
        (i32.or (i32.or (i32.load8_u (i32.add (local.get $t) (local.get $i)))
            (i32.shl (i32.load8_u offset=256 (i32.add (local.get $t) (local.get $i))) (i32.const 8)))
          (i32.or (i32.shl (i32.load8_u offset=512 (i32.add (local.get $t) (local.get $i))) (i32.const 16))
            (i32.const 0xFF000000))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $entries (i32.lt_u (local.get $i) (i32.const 256))))
    (call $glide_upload (local.get $pb) (local.get $id) (i32.const 0) (i32.const 0)
      (i32.const 256) (i32.const 1) (i32.const 1024) (local.get $pos)))

  ;; ---- Fog table: a 64x1 A8B8G8R8 texture RASTER names for table fog;
  ;; the table is its R channel (G = B = R, A = 255). --------------------
  (func $glide_fog_upload (param $pb i32)
    (local $id i32) (local $pos i32) (local $dst i32) (local $src i32) (local $i i32)
    (local.set $id (load.field GlideGps fog_id (local.get $pb)))
    (if (i32.eqz (local.get $id)) (then
      (local.set $id (call $glide_new_id (local.get $pb)))
      (store.field GlideGps fog_id (local.get $pb) (local.get $id))
      (store.field GlideGps pipe_valid (local.get $pb) (i32.const 0))
      (call $glide_create (local.get $pb) (local.get $id) (global.get $GPS_KIND_TEX2D)
        (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (i32.const 64) (i32.const 1))))
    (local.set $pos (call $glide_arena (local.get $pb) (i32.const 256)))
    (local.set $dst (call $glide_arena_ptr (local.get $pos)))
    (local.set $src (elem-addr GlideGps fog (local.get $pb) (i32.const 0)))
    (loop $entries
      (i32.store (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 2)))
        (i32.or (i32.mul (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 0x010101))
          (i32.const 0xFF000000)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $entries (i32.lt_u (local.get $i) (i32.const 64))))
    (call $glide_upload (local.get $pb) (local.get $id) (i32.const 0) (i32.const 0)
      (i32.const 64) (i32.const 1) (i32.const 256) (local.get $pos)))

  ;; ---- Texture RAM, decode and the texture cache. ------------------------
  (func $glide_tmu_ram (param $pb i32) (param $unit i32) (result i32)
    (local $at i32) (local $guest i32) (local $wa i32)
    (local.set $at (i32.add (elem-addr GlideGps tmu_ram (local.get $pb) (i32.const 0))
      (i32.shl (local.get $unit) (i32.const 2))))
    (local.set $wa (i32.load (local.get $at)))
    (if (local.get $wa) (then (return (local.get $wa))))
    (local.set $guest (call $gl_alloc_affine (global.get $GLIDE_TMU_BYTES)))
    (if (i32.eqz (local.get $guest)) (then (call $glide_fail)))
    (local.set $wa (call $g2w (local.get $guest)))
    (memory.fill (local.get $wa) (i32.const 0) (global.get $GLIDE_TMU_BYTES))
    (i32.store (local.get $at) (local.get $wa))
    (i32.store (i32.add (elem-addr GlideGps tmu_guest (local.get $pb) (i32.const 0))
      (i32.shl (local.get $unit) (i32.const 2))) (local.get $guest))
    (local.get $wa))

  (func $glide_dim_w (param $lod i32) (param $aspect i32) (result i32)
    (local $n i32)
    (local.set $n (i32.shr_u (i32.const 256) (local.get $lod)))
    (if (i32.gt_u (local.get $aspect) (i32.const 3))
      (then (local.set $n (i32.shr_u (local.get $n) (i32.sub (local.get $aspect) (i32.const 3))))))
    (if (result i32) (local.get $n) (then (local.get $n)) (else (i32.const 1))))

  (func $glide_dim_h (param $lod i32) (param $aspect i32) (result i32)
    (local $n i32)
    (local.set $n (i32.shr_u (i32.const 256) (local.get $lod)))
    (if (i32.lt_u (local.get $aspect) (i32.const 3))
      (then (local.set $n (i32.shr_u (local.get $n) (i32.sub (i32.const 3) (local.get $aspect))))))
    (if (result i32) (local.get $n) (then (local.get $n)) (else (i32.const 1))))

  ;; round(v * 255 / n) for an n-level channel, exact: floor((510v + n) / 2n).
  (func $glide_expand (param $v i32) (param $n i32) (result i32)
    (i32.div_u (i32.add (i32.mul (local.get $v) (i32.const 510)) (local.get $n))
      (i32.shl (local.get $n) (i32.const 1))))

  ;; Glide texel formats to R,G,B,A bytes (original backend decodeTexture).
  (func $glide_decode (param $dst i32) (param $src i32) (param $count i32)
      (param $format i32) (param $palette i32)
    (local $i i32) (local $x i32) (local $r i32) (local $g i32) (local $b i32) (local $a i32)
    (local $p i32)
    (block $done (loop $texels
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $x (if (result i32) (i32.lt_u (local.get $format) (i32.const 8))
        (then (i32.load8_u (i32.add (local.get $src) (local.get $i))))
        (else (i32.load16_u (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 1)))))))
      (local.set $r (i32.const 255)) (local.set $g (i32.const 255))
      (local.set $b (i32.const 255)) (local.set $a (i32.const 255))
      (block $f (block $f14 (block $f13 (block $f12 (block $f11 (block $f10 (block $f5
        (block $f4 (block $f3 (block $f2 (block $f0
          (br_table $f0 $f $f2 $f3 $f4 $f5 $f $f $f0 $f $f10 $f11 $f12 $f13 $f14 $f
            (local.get $format)))
          ;; 0 RGB332, 8 ARGB8332
          (local.set $r (call $glide_expand (i32.and (i32.shr_u (local.get $x) (i32.const 5)) (i32.const 7)) (i32.const 7)))
          (local.set $g (call $glide_expand (i32.and (i32.shr_u (local.get $x) (i32.const 2)) (i32.const 7)) (i32.const 7)))
          (local.set $b (i32.mul (i32.and (local.get $x) (i32.const 3)) (i32.const 85)))
          (if (i32.eq (local.get $format) (i32.const 8))
            (then (local.set $a (i32.shr_u (local.get $x) (i32.const 8)))))
          (br $f))
          (local.set $a (local.get $x)) (br $f))                         ;; 2 ALPHA8
          (local.set $r (local.get $x)) (local.set $g (local.get $x))    ;; 3 INTENSITY8
          (local.set $b (local.get $x)) (br $f))
          (local.set $r (i32.mul (i32.and (local.get $x) (i32.const 15)) (i32.const 17)))  ;; 4 AI44
          (local.set $g (local.get $r)) (local.set $b (local.get $r))
          (local.set $a (i32.mul (i32.shr_u (local.get $x) (i32.const 4)) (i32.const 17))) (br $f))
          ;; 5 P8 (and 14 AP88 joins below)
          (local.set $p (i32.load (i32.add (local.get $palette) (i32.shl (i32.and (local.get $x) (i32.const 255)) (i32.const 2)))))
          (local.set $r (i32.and (i32.shr_u (local.get $p) (i32.const 16)) (i32.const 255)))
          (local.set $g (i32.and (i32.shr_u (local.get $p) (i32.const 8)) (i32.const 255)))
          (local.set $b (i32.and (local.get $p) (i32.const 255)))
          (br $f))
          ;; 10 RGB565
          (local.set $r (call $glide_expand (i32.shr_u (local.get $x) (i32.const 11)) (i32.const 31)))
          (local.set $g (call $glide_expand (i32.and (i32.shr_u (local.get $x) (i32.const 5)) (i32.const 63)) (i32.const 63)))
          (local.set $b (call $glide_expand (i32.and (local.get $x) (i32.const 31)) (i32.const 31)))
          (br $f))
          ;; 11 ARGB1555
          (local.set $r (call $glide_expand (i32.and (i32.shr_u (local.get $x) (i32.const 10)) (i32.const 31)) (i32.const 31)))
          (local.set $g (call $glide_expand (i32.and (i32.shr_u (local.get $x) (i32.const 5)) (i32.const 31)) (i32.const 31)))
          (local.set $b (call $glide_expand (i32.and (local.get $x) (i32.const 31)) (i32.const 31)))
          (local.set $a (if (result i32) (i32.and (local.get $x) (i32.const 0x8000)) (then (i32.const 255)) (else (i32.const 0))))
          (br $f))
          ;; 12 ARGB4444
          (local.set $r (i32.mul (i32.and (i32.shr_u (local.get $x) (i32.const 8)) (i32.const 15)) (i32.const 17)))
          (local.set $g (i32.mul (i32.and (i32.shr_u (local.get $x) (i32.const 4)) (i32.const 15)) (i32.const 17)))
          (local.set $b (i32.mul (i32.and (local.get $x) (i32.const 15)) (i32.const 17)))
          (local.set $a (i32.mul (i32.shr_u (local.get $x) (i32.const 12)) (i32.const 17)))
          (br $f))
          ;; 13 AI88
          (local.set $r (i32.and (local.get $x) (i32.const 255)))
          (local.set $g (local.get $r)) (local.set $b (local.get $r))
          (local.set $a (i32.shr_u (local.get $x) (i32.const 8)))
          (br $f))
        ;; 14 AP88
        (local.set $p (i32.load (i32.add (local.get $palette) (i32.shl (i32.and (local.get $x) (i32.const 255)) (i32.const 2)))))
        (local.set $r (i32.and (i32.shr_u (local.get $p) (i32.const 16)) (i32.const 255)))
        (local.set $g (i32.and (i32.shr_u (local.get $p) (i32.const 8)) (i32.const 255)))
        (local.set $b (i32.and (local.get $p) (i32.const 255)))
        (local.set $a (i32.shr_u (local.get $x) (i32.const 8))))
      (i32.store (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 2)))
        (i32.or (i32.or (local.get $r) (i32.shl (local.get $g) (i32.const 8)))
          (i32.or (i32.shl (local.get $b) (i32.const 16)) (i32.shl (local.get $a) (i32.const 24)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $texels))))

  (func $glide_format_ok (param $format i32) (result i32)
    (i32.and (i32.le_u (local.get $format) (i32.const 14))
      (i32.ne (i32.and (i32.shr_u (i32.const 0x7D3D) (local.get $format)) (i32.const 1)) (i32.const 0))))

  ;; Texture id for TMU $unit sampling the mip chain at $start. A Voodoo TMU
  ;; samples whatever its RAM holds; Glide never requires a download first
  ;; (Myth TFL draws from never-downloaded addresses), so unwritten RAM is 0.
  (func $glide_texture (param $pb i32) (param $unit i32) (param $start i32) (param $small i32)
      (param $large i32) (param $aspect i32) (param $format i32) (param $mask i32) (result i32)
    (local $e i32) (local $at i32) (local $id i32) (local $total i32) (local $lod i32)
    (local $w i32) (local $hgt i32) (local $off i32) (local $pos i32) (local $ram i32) (local $tries i32)
    (if (i32.ne (local.get $mask) (i32.const 3)) (then (call $glide_fail)))   ;; split even/odd chains
    (if (i32.eqz (call $glide_format_ok (local.get $format))) (then (call $glide_fail)))
    (local.set $total (call $glide_tex_bytes (local.get $small) (local.get $large)
      (local.get $aspect) (local.get $format) (local.get $mask)))
    (if (i64.gt_u (i64.add (i64.extend_i32_u (local.get $start)) (i64.extend_i32_u (local.get $total)))
          (i64.extend_i32_u (global.get $GLIDE_TMU_BYTES))) (then (call $glide_fail)))
    (block $miss (loop $scan
      (local.set $at (elem-addr GlideGps tex (local.get $pb) (i32.mul (local.get $e) (i32.const 12))))
      (if (i32.and (i32.ne (i32.load (local.get $at)) (i32.const 0))
          (i32.and (i32.and (i32.eq (i32.load offset=4 (local.get $at)) (local.get $unit))
                            (i32.eq (i32.load offset=8 (local.get $at)) (local.get $start)))
            (i32.and (i32.and (i32.eq (i32.load offset=12 (local.get $at)) (local.get $small))
                              (i32.eq (i32.load offset=16 (local.get $at)) (local.get $large)))
              (i32.and (i32.eq (i32.load offset=20 (local.get $at)) (local.get $aspect))
                       (i32.eq (i32.load offset=24 (local.get $at)) (local.get $format))))))
        (then
          (i32.store offset=44 (local.get $at) (i32.const 1))   ;; pinned for this pipeline
          (return (i32.load offset=32 (local.get $at)))))
      (local.set $e (i32.add (local.get $e) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $e) (global.get $GLIDE_TEX_CACHE)))))
    (local.set $ram (i32.add (call $glide_tmu_ram (local.get $pb) (local.get $unit)) (local.get $start)))
    (local.set $id (call $glide_new_id (local.get $pb)))
    (call $glide_create (local.get $pb) (local.get $id) (global.get $GPS_KIND_TEX2D)
      (global.get $GPS_FMT_A8B8G8R8) (i32.add (i32.sub (local.get $small) (local.get $large)) (i32.const 1))
      (call $glide_dim_w (local.get $large) (local.get $aspect)) (call $glide_dim_h (local.get $large) (local.get $aspect)))
    (local.set $lod (local.get $large))
    (loop $levels
      (local.set $w (call $glide_dim_w (local.get $lod) (local.get $aspect)))
      (local.set $hgt (call $glide_dim_h (local.get $lod) (local.get $aspect)))
      (local.set $pos (call $glide_arena (local.get $pb) (i32.shl (i32.mul (local.get $w) (local.get $hgt)) (i32.const 2))))
      (call $glide_decode (call $glide_arena_ptr (local.get $pos)) (i32.add (local.get $ram) (local.get $off))
        (i32.mul (local.get $w) (local.get $hgt)) (local.get $format) (i32.add (call $glide3_ext) (i32.const 128)))
      (call $glide_upload (local.get $pb) (local.get $id) (i32.sub (local.get $lod) (local.get $large)) (i32.const 0)
        (local.get $w) (local.get $hgt) (i32.shl (local.get $w) (i32.const 2)) (local.get $pos))
      (local.set $off (i32.add (local.get $off) (i32.shl (i32.mul (local.get $w) (local.get $hgt))
        (i32.ge_u (local.get $format) (i32.const 8)))))
      (local.set $lod (i32.add (local.get $lod) (i32.const 1)))
      (br_if $levels (i32.le_u (local.get $lod) (local.get $small))))
    ;; Round-robin slot; never evict a texture the pipeline being built binds.
    (loop $slot
      (local.set $e (load.field GlideGps tex_next (local.get $pb)))
      (store.field GlideGps tex_next (local.get $pb)
        (i32.rem_u (i32.add (local.get $e) (i32.const 1)) (global.get $GLIDE_TEX_CACHE)))
      (local.set $at (elem-addr GlideGps tex (local.get $pb) (i32.mul (local.get $e) (i32.const 12))))
      (local.set $tries (i32.add (local.get $tries) (i32.const 1)))
      (br_if $slot (i32.and (i32.ne (i32.load (local.get $at)) (i32.const 0))
        (i32.and (i32.eq (i32.load offset=44 (local.get $at)) (i32.const 1))
          (i32.lt_u (local.get $tries) (i32.const 3))))))
    (if (i32.load (local.get $at)) (then (call $glide_release (local.get $pb) (i32.load offset=32 (local.get $at)))))
    (i32.store (local.get $at) (i32.const 1))
    (i32.store offset=4 (local.get $at) (local.get $unit))
    (i32.store offset=8 (local.get $at) (local.get $start))
    (i32.store offset=12 (local.get $at) (local.get $small))
    (i32.store offset=16 (local.get $at) (local.get $large))
    (i32.store offset=20 (local.get $at) (local.get $aspect))
    (i32.store offset=24 (local.get $at) (local.get $format))
    (i32.store offset=28 (local.get $at) (local.get $mask))
    (i32.store offset=32 (local.get $at) (local.get $id))
    (i32.store offset=36 (local.get $at) (i32.add (local.get $start) (local.get $total)))
    (i32.store offset=44 (local.get $at) (i32.const 1))   ;; pinned until the pipeline is emitted
    (local.get $id))

  ;; Release every cached texture of $unit overlapping [start, end), or with
  ;; a palette format when $palette is set.
  (func $glide_tex_invalidate (param $pb i32) (param $unit i32) (param $start i32) (param $end i32)
      (param $palette i32)
    (local $e i32) (local $at i32) (local $f i32) (local $hit i32)
    (loop $scan
      (local.set $at (elem-addr GlideGps tex (local.get $pb) (i32.mul (local.get $e) (i32.const 12))))
      (if (i32.load (local.get $at)) (then
        (local.set $f (i32.load offset=24 (local.get $at)))
        (local.set $hit (if (result i32) (local.get $palette)
          (then (i32.or (i32.eq (local.get $f) (i32.const 5)) (i32.eq (local.get $f) (i32.const 14))))
          (else (i32.and (i32.eq (i32.load offset=4 (local.get $at)) (local.get $unit))
            (i32.and (i32.lt_u (local.get $start) (i32.load offset=36 (local.get $at)))
              (i32.gt_u (local.get $end) (i32.load offset=8 (local.get $at))))))))
        (if (local.get $hit) (then
          (i32.store (local.get $at) (i32.const 0))
          (call $glide_release (local.get $pb) (i32.load offset=32 (local.get $at)))))))
      (local.set $e (i32.add (local.get $e) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $e) (global.get $GLIDE_TEX_CACHE)))))

  ;; Copy $n guest bytes into TMU RAM at $addr (bounds checked by callers).
  (func $glide_tmu_write (param $pb i32) (param $unit i32) (param $addr i32) (param $guest i32) (param $n i32)
    (if (i32.eqz (local.get $n)) (then (return)))
    (call $glide_copy_guest (i32.add (call $glide_tmu_ram (local.get $pb) (local.get $unit)) (local.get $addr))
      (local.get $guest) (local.get $n))
    (call $glide_tex_invalidate (local.get $pb) (local.get $unit) (local.get $addr)
      (i32.add (local.get $addr) (local.get $n)) (i32.const 0)))

  ;; The palette lives at glide3_ext+128 (0x00RRGGBB entries) for both ABIs;
  ;; a change releases every decoded palette-format texture.
  (func $glide_palette_changed
    (if (i32.eqz (i32.load offset=12 (global.get $GLIDE_STATE))) (then (return)))
    (call $glide_tex_invalidate (call $glide_pb) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 1)))

  ;; ---- Samplers -----------------------------------------------------------
  (func $glide_sampler (param $pb i32) (param $clamp_s i32) (param $clamp_t i32) (param $minf i32)
      (param $magf i32) (param $mip i32) (param $blend i32) (param $bias i32) (param $pin i32) (result i32)
    (local $packed i32) (local $e i32) (local $at i32) (local $id i32) (local $p i32)
    (local.set $packed (i32.or (i32.or
        (if (result i32) (local.get $clamp_s) (then (i32.const 3)) (else (i32.const 1)))
        (i32.shl (if (result i32) (local.get $clamp_t) (then (i32.const 3)) (else (i32.const 1))) (i32.const 4)))
      (i32.or (i32.or
        (i32.shl (if (result i32) (local.get $minf) (then (i32.const 2)) (else (i32.const 1))) (i32.const 8))
        (i32.shl (if (result i32) (local.get $magf) (then (i32.const 2)) (else (i32.const 1))) (i32.const 12)))
        (i32.shl (if (result i32) (local.get $mip)
          (then (if (result i32) (local.get $blend) (then (i32.const 2)) (else (i32.const 1))))
          (else (i32.const 0))) (i32.const 16)))))
    (block $miss (loop $scan
      (local.set $at (elem-addr GlideGps sampler (local.get $pb) (i32.shl (local.get $e) (i32.const 2))))
      (if (i32.and (i32.ne (i32.load (local.get $at)) (i32.const 0))
          (i32.and (i32.eq (i32.load offset=4 (local.get $at)) (local.get $packed))
            (i32.eq (i32.load offset=8 (local.get $at)) (local.get $bias))))
        (then (return (i32.load offset=12 (local.get $at)))))
      (local.set $e (i32.add (local.get $e) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $e) (global.get $GLIDE_SAMPLER_CACHE)))))
    (local.set $id (call $glide_new_id (local.get $pb)))
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_SAMPLER) (size-of GpsSampler)))
    (store.field GpsSampler id (local.get $p) (local.get $id))
    (store.field GpsSampler address_u (local.get $p) (i32.and (local.get $packed) (i32.const 15)))
    (store.field GpsSampler address_v (local.get $p) (i32.and (i32.shr_u (local.get $packed) (i32.const 4)) (i32.const 15)))
    (store.field GpsSampler min (local.get $p) (i32.and (i32.shr_u (local.get $packed) (i32.const 8)) (i32.const 15)))
    (store.field GpsSampler mag (local.get $p) (i32.and (i32.shr_u (local.get $packed) (i32.const 12)) (i32.const 15)))
    (store.field GpsSampler mip (local.get $p) (i32.shr_u (local.get $packed) (i32.const 16)))
    (store.field GpsSampler address_w (local.get $p) (i32.const 0))
    (store.field GpsSampler max_level (local.get $p) (i32.const 0))
    (store.field GpsSampler max_aniso (local.get $p) (i32.const 0))
    (store.field GpsSampler lod_bias (local.get $p) (f32.reinterpret_i32 (local.get $bias)))
    (store.field GpsSampler border (local.get $p) (i32.const 0))
    (drop (call $glide_end (local.get $p)))
    (loop $slot
      (local.set $e (load.field GlideGps sampler_next (local.get $pb)))
      (store.field GlideGps sampler_next (local.get $pb)
        (i32.rem_u (i32.add (local.get $e) (i32.const 1)) (global.get $GLIDE_SAMPLER_CACHE)))
      (local.set $at (elem-addr GlideGps sampler (local.get $pb) (i32.shl (local.get $e) (i32.const 2))))
      (br_if $slot (i32.and (i32.ne (local.get $pin) (i32.const 0))
        (i32.eq (i32.load offset=12 (local.get $at)) (local.get $pin)))))
    (if (i32.load (local.get $at)) (then (call $glide_release (local.get $pb) (i32.load offset=12 (local.get $at)))))
    (i32.store (local.get $at) (i32.const 1))
    (i32.store offset=4 (local.get $at) (local.get $packed))
    (i32.store offset=8 (local.get $at) (local.get $bias))
    (i32.store offset=12 (local.get $at) (local.get $id))
    (local.get $id))

  ;; ---- Pixel shader: the Glide combine units as ps_1_4 IR ---------------
  ;; Ported from the original lib/glide-software.js pixelShader(). Registers:
  ;; r0 result, r1 factor, r2 the sample a TMU stage reads (TEX), r3/r4 TMU0
  ;; sample/TMU1 output; v0 iterated color; c0 constant color, c1 one, c2
  ;; zero, c3 chroma key, c4 half an 8-bit quantum. t0/t1 are sampled
  ;; projectively (texld r0/r1, t#_dw): tex.xy / tex.w.
  (global $GPS_IR_MOV i32 (i32.const 1))
  (global $GPS_IR_SUB i32 (i32.const 3))
  (global $GPS_IR_MAD i32 (i32.const 4))
  (global $GPS_IR_MUL i32 (i32.const 5))
  (global $GPS_IR_MAX i32 (i32.const 11))
  (global $GPS_IR_TEXKILL i32 (i32.const 65))
  (global $GPS_IR_TEX i32 (i32.const 66))

  (func $glide_ir_dest (param $index i32) (param $mask i32) (param $sat i32) (result i32)
    (i32.or (i32.or (i32.const 0x80000000) (local.get $index))
      (i32.or (i32.shl (local.get $mask) (i32.const 16)) (i32.shl (local.get $sat) (i32.const 20)))))
  (func $glide_ir_alpha (param $t i32) (result i32)
    (i32.or (i32.and (local.get $t) (i32.const 0xFF00FFFF)) (i32.const 0x00FF0000)))

  ;; One combine channel; returns the new instruction count.
  (func $glide_ir_channel (param $buf i32) (param $n i32) (param $fn i32) (param $factor i32)
      (param $local i32) (param $other i32) (param $invert i32) (param $mask i32)
      (param $tmu i32) (param $incoming i32) (result i32)
    (local $l i32) (local $o i32) (local $f i32) (local $d i32) (local $la i32)
    (local.set $l (if (result i32) (local.get $tmu) (then (i32.const 0x80E40002))
      (else (if (result i32) (i32.eqz (local.get $local)) (then (i32.const 0x90E40000))
        (else (if (result i32) (i32.eq (local.get $local) (i32.const 1)) (then (i32.const 0xA0E40000))
          (else (call $glide_fail) (i32.const 0))))))))
    (local.set $o (if (result i32) (local.get $tmu) (then (local.get $incoming))
      (else (if (result i32) (i32.eqz (local.get $other)) (then (i32.const 0x90E40000))
        (else (if (result i32) (i32.eq (local.get $other) (i32.const 1)) (then (i32.const 0x80E40002))
          (else (if (result i32) (i32.eq (local.get $other) (i32.const 2)) (then (i32.const 0xA0E40000))
            (else (call $glide_fail) (i32.const 0))))))))))
    (local.set $la (call $glide_ir_alpha (local.get $l)))
    (block $known (block $bad
      (block $f13 (block $f12 (block $f11 (block $f10 (block $f9 (block $f8 (block $f5 (block $f4
        (block $f3 (block $f2 (block $f1 (block $f0
          (br_table $f0 $f1 $f2 $f3 $f4 $f5 $bad $bad $f8 $f9 $f10 $f11 $f12 $f13 $bad (local.get $factor)))
          (local.set $f (i32.const 0xA0E40002)) (br $known))
          (local.set $f (local.get $l)) (br $known))
          (local.set $f (call $glide_ir_alpha (local.get $o))) (br $known))
          (local.set $f (local.get $la)) (br $known))
          (local.set $f (i32.const 0x80FF0002)) (br $known))
          (local.set $f (i32.const 0x80E40002)) (br $known))
          (local.set $f (i32.const 0xA0E40001)) (br $known))
          (local.set $f (local.get $l)) (br $known))
          (local.set $f (call $glide_ir_alpha (local.get $o))) (br $known))
          (local.set $f (local.get $la)) (br $known))
          (local.set $f (i32.const 0x80FF0002)) (br $known))
          (local.set $f (i32.const 0x80E40002)) (br $known))
      (call $glide_fail))
    (if (i32.ge_u (local.get $factor) (i32.const 9))
      (then (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_SUB) (i32.const 3)
        (call $glide_ir_dest (i32.const 1) (i32.const 15) (i32.const 0)) (i32.const 0xA0E40001) (local.get $f) (i32.const 0))))
      (else (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
        (call $glide_ir_dest (i32.const 1) (i32.const 15) (i32.const 0)) (local.get $f) (i32.const 0) (i32.const 0)))))
    (local.set $d (call $glide_ir_dest (i32.const 0) (local.get $mask) (i32.const 1)))
    (block $emitted
      (if (i32.eqz (local.get $fn)) (then
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
          (local.get $d) (i32.const 0xA0E40002) (i32.const 0) (i32.const 0))) (br $emitted)))
      (if (i32.eq (local.get $fn) (i32.const 1)) (then
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
          (local.get $d) (local.get $l) (i32.const 0) (i32.const 0))) (br $emitted)))
      (if (i32.eq (local.get $fn) (i32.const 2)) (then
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
          (local.get $d) (local.get $la) (i32.const 0) (i32.const 0))) (br $emitted)))
      (if (i32.eq (local.get $fn) (i32.const 3)) (then
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MUL) (i32.const 3)
          (local.get $d) (i32.const 0x80E40001) (local.get $o) (i32.const 0))) (br $emitted)))
      (if (i32.or (i32.eq (local.get $fn) (i32.const 4)) (i32.eq (local.get $fn) (i32.const 5))) (then
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MAD) (i32.const 4)
          (local.get $d) (i32.const 0x80E40001) (local.get $o)
          (if (result i32) (i32.eq (local.get $fn) (i32.const 4)) (then (local.get $l)) (else (local.get $la)))))
        (br $emitted)))
      (if (i32.and (i32.ge_u (local.get $fn) (i32.const 6)) (i32.le_u (local.get $fn) (i32.const 8))) (then
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_SUB) (i32.const 3)
          (call $glide_ir_dest (i32.const 0) (local.get $mask) (i32.const 0)) (local.get $o) (local.get $l) (i32.const 0)))
        (if (i32.eq (local.get $fn) (i32.const 6))
          (then (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MUL) (i32.const 3)
            (local.get $d) (i32.const 0x80E40001) (i32.const 0x80E40000) (i32.const 0))))
          (else (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MAD) (i32.const 4)
            (local.get $d) (i32.const 0x80E40001) (i32.const 0x80E40000)
            (if (result i32) (i32.eq (local.get $fn) (i32.const 7)) (then (local.get $l)) (else (local.get $la)))))))
        (br $emitted)))
      (if (i32.or (i32.eq (local.get $fn) (i32.const 9)) (i32.eq (local.get $fn) (i32.const 16))) (then
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MAD) (i32.const 4)
          (local.get $d) (i32.const 0x80E40001) (i32.xor (local.get $l) (i32.const 0x01000000))
          (if (result i32) (i32.eq (local.get $fn) (i32.const 9)) (then (local.get $l)) (else (local.get $la)))))
        (br $emitted)))
      (call $glide_fail))
    (if (local.get $invert)
      (then (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_SUB) (i32.const 3)
        (local.get $d) (i32.const 0xA0E40001) (i32.const 0x80E40000) (i32.const 0)))))
    (local.get $n))

  ;; Glide combine needs (original backend tmuNeedsLocal/Other, fbiNeedsTexture).
  (func $glide_tmu_needs_local (param $fn i32) (param $factor i32) (result i32)
    (i32.or (i32.or (i32.eq (local.get $fn) (i32.const 1)) (i32.eq (local.get $fn) (i32.const 2)))
      (i32.or (i32.ge_u (local.get $fn) (i32.const 4))
        (i32.and (i32.eq (local.get $fn) (i32.const 3))
          (i32.or (i32.or (i32.eq (local.get $factor) (i32.const 1)) (i32.eq (local.get $factor) (i32.const 3)))
            (i32.or (i32.eq (local.get $factor) (i32.const 9)) (i32.eq (local.get $factor) (i32.const 11))))))))
  (func $glide_tmu_needs_other (param $fn i32) (param $factor i32) (result i32)
    (i32.or
      (i32.and (i32.and (i32.ge_u (local.get $fn) (i32.const 3)) (i32.le_u (local.get $fn) (i32.const 8)))
        (i32.ne (local.get $factor) (i32.const 0)))
      (i32.and (i32.or (i32.eq (local.get $fn) (i32.const 9)) (i32.eq (local.get $fn) (i32.const 16)))
        (i32.or (i32.eq (local.get $factor) (i32.const 2)) (i32.eq (local.get $factor) (i32.const 10))))))
  (func $glide_fbi_needs_texture (param $fn i32) (param $factor i32) (param $other i32) (result i32)
    (if (i32.or (i32.le_u (local.get $fn) (i32.const 2)) (i32.eqz (local.get $factor))) (then (return (i32.const 0))))
    (i32.or (i32.or
        (i32.and (i32.le_u (local.get $fn) (i32.const 8)) (i32.eq (local.get $other) (i32.const 1)))
        (call $glide_factor_is_texture (local.get $factor)))
      (i32.and (i32.eq (local.get $other) (i32.const 1))
        (i32.or (i32.eq (local.get $factor) (i32.const 2)) (i32.eq (local.get $factor) (i32.const 10))))))
  ;; Factors 4/5/12/13: TMU detail/LOD fraction (TMU) or texture alpha/rgb (FBI).
  (func $glide_factor_is_texture (param $factor i32) (result i32)
    (i32.or (i32.or (i32.eq (local.get $factor) (i32.const 4)) (i32.eq (local.get $factor) (i32.const 5)))
      (i32.or (i32.eq (local.get $factor) (i32.const 12)) (i32.eq (local.get $factor) (i32.const 13)))))

  ;; State word $w of TMU $unit: unit 0 is the shared state, unit 1 Glide3's
  ;; TMU1 block (words 32..43, 46..51, 60; see $glide_tmu_store).
  (func $glide_tsw (param $unit i32) (param $w i32) (result i32)
    (local $t i32)
    (if (i32.eqz (local.get $unit))
      (then (return (i32.load (i32.add (call $glide_state) (i32.shl (local.get $w) (i32.const 2)))))))
    (local.set $t (call $glide3_tmu1))
    (if (i32.and (i32.ge_u (local.get $w) (i32.const 32)) (i32.le_u (local.get $w) (i32.const 43)))
      (then (return (i32.load (i32.add (local.get $t) (i32.shl (i32.sub (local.get $w) (i32.const 32)) (i32.const 2)))))))
    (if (i32.and (i32.ge_u (local.get $w) (i32.const 46)) (i32.le_u (local.get $w) (i32.const 51)))
      (then (return (i32.load (i32.add (local.get $t) (i32.shl (i32.sub (local.get $w) (i32.const 34)) (i32.const 2)))))))
    (if (i32.eq (local.get $w) (i32.const 60)) (then (return (i32.load offset=72 (local.get $t)))))
    (i32.const 0))

  ;; chain bits: 1 textured, 2 useSecond, 4 local0, 8 local1.
  (func $glide_chain (param $dual i32) (result i32)
    (local $s i32) (local $textured i32) (local $second i32) (local $r i32)
    (local.set $s (call $glide_state))
    (local.set $textured (i32.or (i32.or
        (call $glide_fbi_needs_texture (i32.load offset=0 (local.get $s)) (i32.load offset=4 (local.get $s)) (i32.load offset=12 (local.get $s)))
        (call $glide_fbi_needs_texture (i32.load offset=20 (local.get $s)) (i32.load offset=24 (local.get $s)) (i32.load offset=32 (local.get $s))))
      (i32.and (i32.ne (i32.load offset=80 (local.get $s)) (i32.const 0)) (i32.eq (i32.load offset=12 (local.get $s)) (i32.const 1)))))
    (if (i32.eqz (local.get $textured)) (then (return (i32.const 0))))
    (local.set $r (i32.const 1))
    (if (i32.and (i32.ne (local.get $dual) (i32.const 0))
          (i32.or (call $glide_tmu_needs_other (i32.load offset=184 (local.get $s)) (i32.load offset=188 (local.get $s)))
            (call $glide_tmu_needs_other (i32.load offset=192 (local.get $s)) (i32.load offset=196 (local.get $s)))))
      (then (local.set $second (i32.const 1)) (local.set $r (i32.or (local.get $r) (i32.const 2)))))
    (if (i32.or (call $glide_tmu_needs_local (i32.load offset=184 (local.get $s)) (i32.load offset=188 (local.get $s)))
          (call $glide_tmu_needs_local (i32.load offset=192 (local.get $s)) (i32.load offset=196 (local.get $s))))
      (then (local.set $r (i32.or (local.get $r) (i32.const 4)))))
    (if (i32.and (local.get $second)
          (i32.or (call $glide_tmu_needs_local (call $glide_tsw (i32.const 1) (i32.const 46)) (call $glide_tsw (i32.const 1) (i32.const 47)))
            (call $glide_tmu_needs_local (call $glide_tsw (i32.const 1) (i32.const 48)) (call $glide_tsw (i32.const 1) (i32.const 49)))))
      (then (local.set $r (i32.or (local.get $r) (i32.const 8)))))
    (local.get $r))

  ;; TMU stage of $unit (RGB then alpha), sampling r2, OTHER = $incoming.
  (func $glide_ir_tmu (param $buf i32) (param $n i32) (param $unit i32) (param $incoming i32) (result i32)
    (local.set $n (call $glide_ir_channel (local.get $buf) (local.get $n)
      (call $glide_tsw (local.get $unit) (i32.const 46)) (call $glide_tsw (local.get $unit) (i32.const 47))
      (i32.const 0) (i32.const 2) (call $glide_tsw (local.get $unit) (i32.const 50)) (i32.const 7) (i32.const 1) (local.get $incoming)))
    (call $glide_ir_channel (local.get $buf) (local.get $n)
      (call $glide_tsw (local.get $unit) (i32.const 48)) (call $glide_tsw (local.get $unit) (i32.const 49))
      (i32.const 0) (i32.const 2) (call $glide_tsw (local.get $unit) (i32.const 51)) (i32.const 8) (i32.const 1) (local.get $incoming)))

  ;; Build the pixel shader IR for the current state into pb.ir; returns bytes.
  (func $glide_ir_build (param $pb i32) (param $chain i32) (result i32)
    (local $buf i32) (local $n i32) (local $s i32)
    (local.set $buf (load.field GlideGps ir (local.get $pb)))
    (local.set $s (call $glide_state))
    (if (i32.and (local.get $chain) (i32.const 1))
      (then
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n)
          (if (result i32) (i32.and (local.get $chain) (i32.const 4)) (then (global.get $GPS_IR_TEX)) (else (global.get $GPS_IR_MOV)))
          (i32.const 2) (call $glide_ir_dest (i32.const 0) (i32.const 15) (i32.const 0))
          (if (result i32) (i32.and (local.get $chain) (i32.const 4)) (then (i32.const 0xBAE40000)) (else (i32.const 0xA0E40002)))
          (i32.const 0) (i32.const 0)))
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
          (call $glide_ir_dest (i32.const 3) (i32.const 15) (i32.const 0)) (i32.const 0x80E40000) (i32.const 0) (i32.const 0)))
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n)
          (if (result i32) (i32.and (local.get $chain) (i32.const 8)) (then (global.get $GPS_IR_TEX)) (else (global.get $GPS_IR_MOV)))
          (i32.const 2) (call $glide_ir_dest (i32.const 1) (i32.const 15) (i32.const 0))
          (if (result i32) (i32.and (local.get $chain) (i32.const 8)) (then (i32.const 0xBAE40001)) (else (i32.const 0xA0E40002)))
          (i32.const 0) (i32.const 0)))
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
          (call $glide_ir_dest (i32.const 2) (i32.const 15) (i32.const 0)) (i32.const 0x80E40001) (i32.const 0) (i32.const 0)))
        (if (i32.and (local.get $chain) (i32.const 2))
          (then
            (local.set $n (call $glide_ir_tmu (local.get $buf) (local.get $n) (i32.const 1) (i32.const 0xA0E40002)))
            (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
              (call $glide_ir_dest (i32.const 4) (i32.const 15) (i32.const 0)) (i32.const 0x80E40000) (i32.const 0) (i32.const 0))))
          (else
            (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
              (call $glide_ir_dest (i32.const 4) (i32.const 15) (i32.const 0)) (i32.const 0xA0E40002) (i32.const 0) (i32.const 0)))))
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
          (call $glide_ir_dest (i32.const 2) (i32.const 15) (i32.const 0)) (i32.const 0x80E40003) (i32.const 0) (i32.const 0)))
        (local.set $n (call $glide_ir_tmu (local.get $buf) (local.get $n) (i32.const 0) (i32.const 0x80E40004)))
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
          (call $glide_ir_dest (i32.const 2) (i32.const 15) (i32.const 0)) (i32.const 0x80E40000) (i32.const 0) (i32.const 0))))
      (else
        (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (i32.const 2)
          (call $glide_ir_dest (i32.const 2) (i32.const 15) (i32.const 0)) (i32.const 0xA0E40001) (i32.const 0) (i32.const 0)))))
    (if (i32.load offset=80 (local.get $s)) (then
      ;; Chroma compares the color-combine OTHER source before combining:
      ;; max(abs(other.rgb - key.rgb)) < half an 8-bit quantum is a match.
      (if (i32.gt_u (i32.load offset=12 (local.get $s)) (i32.const 2)) (then (call $glide_fail)))
      (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_SUB) (i32.const 3)
        (call $glide_ir_dest (i32.const 1) (i32.const 15) (i32.const 0))
        (select (i32.const 0x90E40000)
          (select (i32.const 0x80E40002) (i32.const 0xA0E40000) (i32.eq (i32.load offset=12 (local.get $s)) (i32.const 1)))
          (i32.eqz (i32.load offset=12 (local.get $s))))
        (i32.const 0xA0E40003) (i32.const 0)))
      (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MAX) (i32.const 3)
        (call $glide_ir_dest (i32.const 1) (i32.const 15) (i32.const 0)) (i32.const 0x80E40001) (i32.const 0x81E40001) (i32.const 0)))
      (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MAX) (i32.const 3)
        (call $glide_ir_dest (i32.const 1) (i32.const 1) (i32.const 0)) (i32.const 0x80000001) (i32.const 0x80550001) (i32.const 0)))
      (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MAX) (i32.const 3)
        (call $glide_ir_dest (i32.const 1) (i32.const 15) (i32.const 0)) (i32.const 0x80000001) (i32.const 0x80AA0001) (i32.const 0)))
      (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_SUB) (i32.const 3)
        (call $glide_ir_dest (i32.const 1) (i32.const 15) (i32.const 0)) (i32.const 0x80E40001) (i32.const 0xA0E40004) (i32.const 0)))
      (local.set $n (call $gps_ir_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_TEXKILL) (i32.const 1)
        (call $glide_ir_dest (i32.const 1) (i32.const 15) (i32.const 0)) (i32.const 0) (i32.const 0) (i32.const 0)))))
    (local.set $n (call $glide_ir_channel (local.get $buf) (local.get $n)
      (i32.load offset=0 (local.get $s)) (i32.load offset=4 (local.get $s)) (i32.load offset=8 (local.get $s))
      (i32.load offset=12 (local.get $s)) (i32.load offset=16 (local.get $s)) (i32.const 7) (i32.const 0) (i32.const 0)))
    (local.set $n (call $glide_ir_channel (local.get $buf) (local.get $n)
      (i32.load offset=20 (local.get $s)) (i32.load offset=24 (local.get $s)) (i32.load offset=28 (local.get $s))
      (i32.load offset=32 (local.get $s)) (i32.load offset=36 (local.get $s)) (i32.const 8) (i32.const 0) (i32.const 0)))
    (call $gps_ir_finish (local.get $buf) (local.get $n) (global.get $GPS_STAGE_PS) (i32.const 0xffff0104)))

  ;; Shader id for the current combine state (cached by key).
  (func $glide_shader (param $pb i32) (param $chain i32) (result i32)
    (local $k i32) (local $s i32) (local $i i32) (local $e i32) (local $at i32) (local $id i32)
    (local $bytes i32) (local $p i32) (local $hit i32)
    (local.set $k (elem-addr GlideGps key (local.get $pb) (i32.const 0)))
    (local.set $s (call $glide_state))
    (memory.copy (local.get $k) (local.get $s) (i32.const 40))                        ;; s0..9
    (memory.copy (i32.add (local.get $k) (i32.const 40)) (i32.add (local.get $s) (i32.const 184)) (i32.const 24)) ;; s46..51
    (i32.store offset=64 (local.get $k) (i32.load offset=80 (local.get $s)))          ;; s20
    (i32.store offset=68 (local.get $k) (local.get $chain))
    (loop $second
      (i32.store (i32.add (i32.add (local.get $k) (i32.const 72)) (i32.shl (local.get $i) (i32.const 2)))
        (if (result i32) (i32.and (local.get $chain) (i32.const 2))
          (then (call $glide_tsw (i32.const 1) (i32.add (i32.const 46) (local.get $i)))) (else (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $second (i32.lt_u (local.get $i) (i32.const 6))))
    (loop $scan
      (local.set $at (elem-addr GlideGps shader (local.get $pb) (i32.mul (local.get $e) (i32.const 26))))
      (if (i32.load (local.get $at)) (then
        (local.set $hit (i32.const 1))
        (local.set $i (i32.const 0))
        (block $differs (loop $words
          (br_if $differs (i32.ne (i32.load (i32.add (i32.add (local.get $at) (i32.const 8)) (i32.shl (local.get $i) (i32.const 2))))
            (i32.load (i32.add (local.get $k) (i32.shl (local.get $i) (i32.const 2))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $words (i32.lt_u (local.get $i) (i32.const 24)))
          (return (i32.load offset=4 (local.get $at)))))))
      (local.set $e (i32.add (local.get $e) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $e) (global.get $GLIDE_SHADER_CACHE))))
    (local.set $bytes (call $glide_ir_build (local.get $pb) (local.get $chain)))
    (local.set $id (call $glide_new_id (local.get $pb)))
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_SHADER)
      (i32.add (size-of GpsShader) (local.get $bytes))))
    (store.field GpsShader id (local.get $p) (local.get $id))
    (store.field GpsShader stage (local.get $p) (global.get $GPS_STAGE_PS))
    (store.field GpsShader pad (local.get $p) (i32.const 0))
    (store.field GpsShader pad2 (local.get $p) (i32.const 0))
    (store.field GpsShader ir_bytes (local.get $p) (local.get $bytes))
    (memory.copy (i32.add (local.get $p) (size-of GpsShader)) (load.field GlideGps ir (local.get $pb)) (local.get $bytes))
    (drop (call $glide_end (local.get $p)))
    (local.set $e (load.field GlideGps shader_next (local.get $pb)))
    (store.field GlideGps shader_next (local.get $pb)
      (i32.rem_u (i32.add (local.get $e) (i32.const 1)) (global.get $GLIDE_SHADER_CACHE)))
    (local.set $at (elem-addr GlideGps shader (local.get $pb) (i32.mul (local.get $e) (i32.const 26))))
    (if (i32.load (local.get $at)) (then (call $glide_release (local.get $pb) (i32.load offset=4 (local.get $at)))))
    (i32.store (local.get $at) (i32.const 1))
    (i32.store offset=4 (local.get $at) (local.get $id))
    (memory.copy (i32.add (local.get $at) (i32.const 8)) (local.get $k) (i32.const 96))
    (local.get $id))

  ;; Glide blend factor -> D3DBLEND (original backend blend()).
  (func $glide_blend (param $n i32) (param $src i32) (result i32)
    (if (i32.and (i32.eq (local.get $n) (i32.const 15)) (i32.ne (local.get $src) (i32.const 0)))
      (then (return (i32.const 11))))
    (if (i32.gt_u (local.get $n) (i32.const 7)) (then (call $glide_fail)))
    (if (i32.and (i32.ne (local.get $src) (i32.const 0)) (i32.eq (local.get $n) (i32.const 2))) (then (return (i32.const 9))))
    (if (i32.and (i32.ne (local.get $src) (i32.const 0)) (i32.eq (local.get $n) (i32.const 6))) (then (return (i32.const 10))))
    ;; Bytes, factor 0 first: ZERO, SRCALPHA, SRCCOLOR, DESTALPHA, ONE,
    ;; INVSRCALPHA, INVSRCCOLOR, INVDESTALPHA.
    (i32.wrap_i64 (i64.and (i64.shr_u (i64.const 0x0804060207030501)
      (i64.extend_i32_u (i32.shl (local.get $n) (i32.const 3)))) (i64.const 255))))

  (func $glide_needs_z (result i32)
    (local $s i32)
    (local.set $s (call $glide_state))
    (i32.or (i32.or (i32.ne (i32.load offset=44 (local.get $s)) (i32.const 2))
        (i32.eq (i32.and (i32.load offset=88 (local.get $s)) (i32.const 255)) (i32.const 3)))
      (i32.or (i32.eq (i32.load offset=8 (local.get $s)) (i32.const 2))
        (i32.eq (i32.load offset=28 (local.get $s)) (i32.const 2)))))

  ;; Clear every texture-cache pin (pipeline emitted).
  (func $glide_unpin (param $pb i32)
    (local $e i32)
    (loop $all
      (i32.store offset=44 (elem-addr GlideGps tex (local.get $pb) (i32.mul (local.get $e) (i32.const 12))) (i32.const 0))
      (local.set $e (i32.add (local.get $e) (i32.const 1)))
      (br_if $all (i32.lt_u (local.get $e) (global.get $GLIDE_TEX_CACHE)))))

  ;; Emit the $n-byte payload built in pb.stage as an $op record unless it
  ;; equals $last (the previous one of that op); then remember it.
  (func $glide_emit_state (param $pb i32) (param $op i32) (param $n i32) (param $last i32)
    (local $src i32) (local $i i32) (local $p i32)
    (local.set $src (elem-addr GlideGps stage (local.get $pb) (i32.const 0)))
    (block $differs
      (loop $words
        (br_if $differs (i32.ne (i32.load (i32.add (local.get $src) (local.get $i)))
          (i32.load (i32.add (local.get $last) (local.get $i)))))
        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br_if $words (i32.lt_u (local.get $i) (local.get $n))))
      (return))
    (local.set $p (call $glide_begin (local.get $pb) (local.get $op) (local.get $n)))
    (memory.copy (local.get $p) (local.get $src) (local.get $n))
    (drop (call $glide_end (local.get $p)))
    (memory.copy (local.get $last) (local.get $src) (local.get $n)))

  ;; Ensure the emitted pipeline matches the current state; emits
  ;; TARGETS/textures/SAMPLER/SHADER/CONSTS/RASTER/BIND when it does not.
  (func $glide_pipeline (param $pb i32) (param $dual i32)
    (local $s i32) (local $snap i32) (local $i i32) (local $chain i32)
    (local $t0 i32) (local $t1 i32) (local $s0 i32) (local $s1 i32) (local $ps i32)
    (local $p i32) (local $e i32) (local $hgt i32) (local $origin i32) (local $cull i32)
    (local $top i32) (local $bottom i32) (local $right i32) (local $fog i32) (local $n i32)
    (local.set $s (call $glide_state))
    (local.set $snap (elem-addr GlideGps snap (local.get $pb) (i32.const 0)))
    (if (i32.and (i32.ne (load.field GlideGps pipe_valid (local.get $pb)) (i32.const 0))
          (i32.eq (load.field GlideGps pipe_dual (local.get $pb)) (local.get $dual))) (then
      (block $changed
        (loop $words
          (br_if $changed (i64.ne (i64.load (i32.add (local.get $s) (local.get $i)))
            (i64.load (i32.add (local.get $snap) (local.get $i)))))
          (local.set $i (i32.add (local.get $i) (i32.const 8)))
          (br_if $words (i32.lt_u (local.get $i) (i32.const 256))))
        (if (i32.eqz (local.get $dual)) (then (return)))
        (local.set $i (i32.const 0))
        (loop $tmu1
          (br_if $changed (i64.ne (i64.load (i32.add (call $glide3_tmu1) (local.get $i)))
            (i64.load (i32.add (i32.add (local.get $snap) (i32.const 256)) (local.get $i)))))
          (local.set $i (i32.add (local.get $i) (i32.const 8)))
          (br_if $tmu1 (i32.lt_u (local.get $i) (i32.const 80))))
        (return))))
    (call $glide_close_draw (local.get $pb))
    ;; ---- validation (fail fast on what no executor implements) ----
    (if (i32.gt_u (i32.load offset=44 (local.get $s)) (i32.const 2)) (then (call $glide_fail)))
    (local.set $fog (i32.load offset=88 (local.get $s)))
    (if (i32.or (i32.gt_u (i32.and (local.get $fog) (i32.const 255)) (i32.const 3))
          (i32.ne (i32.and (local.get $fog) (i32.const -772)) (i32.const 0))) (then (call $glide_fail)))
    (if (i32.or (call $glide_factor_is_texture (i32.load offset=188 (local.get $s)))
          (call $glide_factor_is_texture (i32.load offset=196 (local.get $s)))) (then (call $glide_fail)))
    (if (i32.gt_u (i32.load offset=72 (local.get $s)) (i32.const 7)) (then (call $glide_fail)))
    (if (i32.gt_u (i32.load offset=180 (local.get $s)) (i32.const 1)) (then (call $glide_fail)))
    (local.set $chain (call $glide_chain (local.get $dual)))
    (if (i32.and (local.get $chain) (i32.const 2)) (then
      (if (i32.or (call $glide_factor_is_texture (call $glide_tsw (i32.const 1) (i32.const 47)))
            (call $glide_factor_is_texture (call $glide_tsw (i32.const 1) (i32.const 49)))) (then (call $glide_fail)))))
    (local.set $hgt (load.field GlideGps height (local.get $pb)))
    (local.set $origin (i32.ne (i32.load offset=100 (local.get $s)) (i32.const 0)))
    ;; ---- target, textures, samplers ----
    (call $glide_target (local.get $pb) (i32.load offset=180 (local.get $s)))
    (if (i32.and (local.get $chain) (i32.const 4)) (then
      (local.set $t0 (call $glide_texture (local.get $pb) (i32.const 0)
        (i32.load offset=128 (local.get $s)) (i32.load offset=132 (local.get $s)) (i32.load offset=136 (local.get $s))
        (i32.load offset=140 (local.get $s)) (i32.load offset=144 (local.get $s)) (i32.load offset=148 (local.get $s))))
      (local.set $s0 (call $glide_sampler (local.get $pb)
        (i32.load offset=152 (local.get $s)) (i32.load offset=156 (local.get $s)) (i32.load offset=160 (local.get $s))
        (i32.load offset=164 (local.get $s)) (i32.load offset=168 (local.get $s)) (i32.load offset=240 (local.get $s))
        (i32.load offset=172 (local.get $s)) (i32.const 0)))))
    (if (i32.and (local.get $chain) (i32.const 8)) (then
      (local.set $t1 (call $glide_texture (local.get $pb) (i32.const 1)
        (call $glide_tsw (i32.const 1) (i32.const 32)) (call $glide_tsw (i32.const 1) (i32.const 33))
        (call $glide_tsw (i32.const 1) (i32.const 34)) (call $glide_tsw (i32.const 1) (i32.const 35))
        (call $glide_tsw (i32.const 1) (i32.const 36)) (call $glide_tsw (i32.const 1) (i32.const 37))))
      (local.set $s1 (call $glide_sampler (local.get $pb)
        (call $glide_tsw (i32.const 1) (i32.const 38)) (call $glide_tsw (i32.const 1) (i32.const 39))
        (call $glide_tsw (i32.const 1) (i32.const 40)) (call $glide_tsw (i32.const 1) (i32.const 41))
        (call $glide_tsw (i32.const 1) (i32.const 42)) (call $glide_tsw (i32.const 1) (i32.const 60))
        (call $glide_tsw (i32.const 1) (i32.const 43)) (local.get $s0)))))
    (call $glide_unpin (local.get $pb))
    (if (i32.and (i32.eq (i32.and (local.get $fog) (i32.const 255)) (i32.const 2))
          (i32.eqz (load.field GlideGps fog_id (local.get $pb)))) (then (call $glide_fail)))
    (local.set $ps (call $glide_shader (local.get $pb) (local.get $chain)))
    ;; ---- CONSTS: c0 constant, c1 one, c2 zero, c3 chroma, c4 half quantum ----
    (local.set $p (elem-addr GlideGps stage (local.get $pb) (i32.const 0)))
    (store.field GpsConsts stage (local.get $p) (global.get $GPS_STAGE_PS))
    (store.field GpsConsts pad (local.get $p) (i32.const 0))
    (store.field GpsConsts first (local.get $p) (i32.const 0))
    (store.field GpsConsts count (local.get $p) (i32.const 5))
    (local.set $e (i32.add (local.get $p) (size-of GpsConsts)))
    (call $glide_store_color (local.get $e) (call $glide_rgba (local.get $pb) (i32.load offset=40 (local.get $s))))
    (f32.store offset=16 (local.get $e) (f32.const 1)) (f32.store offset=20 (local.get $e) (f32.const 1))
    (f32.store offset=24 (local.get $e) (f32.const 1)) (f32.store offset=28 (local.get $e) (f32.const 1))
    (memory.fill (i32.add (local.get $e) (i32.const 32)) (i32.const 0) (i32.const 16))
    (call $glide_store_color (i32.add (local.get $e) (i32.const 48)) (call $glide_rgba (local.get $pb) (i32.load offset=84 (local.get $s))))
    (f32.store offset=64 (local.get $e) (f32.const 0.00196078431372549)) (f32.store offset=68 (local.get $e) (f32.const 0.00196078431372549))
    (f32.store offset=72 (local.get $e) (f32.const 0.00196078431372549)) (f32.store offset=76 (local.get $e) (f32.const 0.00196078431372549))
    (call $glide_emit_state (local.get $pb) (global.get $GPS_OP_CONSTS) (i32.add (size-of GpsConsts) (i32.const 80))
      (elem-addr GlideGps last_consts (local.get $pb) (i32.const 0)))
    ;; ---- RASTER ----
    ;; Glide culls on the sign of the area in its own coordinates. With the
    ;; upper-left origin (y down) a negative area is counter-clockwise on
    ;; screen, so GR_CULL_NEGATIVE is D3DCULL_CCW (3) and GR_CULL_POSITIVE is
    ;; D3DCULL_CW (2). A lower-left origin is mirrored by glide_put_vertex's
    ;; y flip, which swaps the two.
    (local.set $cull (i32.const 1))
    (if (i32.eq (i32.load offset=96 (local.get $s)) (i32.const 1))
      (then (local.set $cull (select (i32.const 2) (i32.const 3) (local.get $origin)))))
    (if (i32.gt_u (i32.load offset=96 (local.get $s)) (i32.const 1))
      (then (local.set $cull (select (i32.const 3) (i32.const 2) (local.get $origin)))))
    (local.set $p (elem-addr GlideGps stage (local.get $pb) (i32.const 0)))
    (memory.fill (local.get $p) (i32.const 0) (size-of GpsRaster))
    (store.field GpsRaster depth_mode (local.get $p) (i32.load offset=44 (local.get $s)))
    (store.field GpsRaster zfunc (local.get $p) (i32.add (i32.and (i32.load offset=48 (local.get $s)) (i32.const 7)) (i32.const 1)))
    (store.field GpsRaster zwrite (local.get $p) (i32.ne (i32.load offset=52 (local.get $s)) (i32.const 0)))
    (store.field GpsRaster cull (local.get $p) (local.get $cull))
    (store.field GpsRaster blend (local.get $p) (i32.const 1))
    (store.field GpsRaster blend_op (local.get $p) (i32.const 1))          ;; D3DBLENDOP_ADD
    (store.field GpsRaster blend_op_alpha (local.get $p) (i32.const 1))
    (store.field GpsRaster linear (local.get $p) (i32.const 1))
    (store.field GpsRaster src_rgb (local.get $p) (call $glide_blend (i32.load offset=56 (local.get $s)) (i32.const 1)))
    (store.field GpsRaster dst_rgb (local.get $p) (call $glide_blend (i32.load offset=60 (local.get $s)) (i32.const 0)))
    (store.field GpsRaster src_alpha (local.get $p) (call $glide_blend (i32.load offset=64 (local.get $s)) (i32.const 1)))
    (store.field GpsRaster dst_alpha (local.get $p) (call $glide_blend (i32.load offset=68 (local.get $s)) (i32.const 0)))
    (store.field GpsRaster alpha_func (local.get $p) (i32.add (i32.load offset=72 (local.get $s)) (i32.const 1)))
    (store.field GpsRaster alpha_ref (local.get $p) (i32.and (i32.load offset=76 (local.get $s)) (i32.const 255)))
    (store.field GpsRaster colormask (local.get $p) (i32.or
      (select (i32.const 7) (i32.const 0) (i32.ne (i32.load offset=120 (local.get $s)) (i32.const 0)))
      (select (i32.const 8) (i32.const 0) (i32.ne (i32.load offset=124 (local.get $s)) (i32.const 0)))))
    (store.field GpsRaster fog_mode (local.get $p) (i32.and (local.get $fog) (i32.const 255)))
    (store.field GpsRaster fog_flags (local.get $p) (i32.or
      (select (i32.const 1) (i32.const 0) (i32.ne (i32.and (local.get $fog) (i32.const 0x100)) (i32.const 0)))
      (select (i32.const 2) (i32.const 0) (i32.ne (i32.and (local.get $fog) (i32.const 0x200)) (i32.const 0)))))
    (store.field GpsRaster fill (local.get $p) (i32.const 3))
    (store.field GpsRaster fog_color (local.get $p) (call $glide_rgba (local.get $pb) (i32.load offset=92 (local.get $s))))
    (store.field GpsRaster fog_table (local.get $p)
      (if (result i32) (i32.eq (i32.and (local.get $fog) (i32.const 255)) (i32.const 2))
        (then (load.field GlideGps fog_id (local.get $pb))) (else (i32.const 0))))
    (store.field GpsRaster depth_bias (local.get $p)
      (i32.shr_s (i32.shl (i32.load offset=176 (local.get $s)) (i32.const 16)) (i32.const 16)))
    (local.set $top (if (result i32) (local.get $origin)
      (then (i32.sub (local.get $hgt) (i32.load offset=116 (local.get $s)))) (else (i32.load offset=108 (local.get $s)))))
    (local.set $bottom (if (result i32) (local.get $origin)
      (then (i32.sub (local.get $hgt) (i32.load offset=108 (local.get $s)))) (else (i32.load offset=116 (local.get $s)))))
    (local.set $right (i32.load offset=112 (local.get $s)))
    (if (i32.lt_s (local.get $right) (i32.load offset=104 (local.get $s)))
      (then (local.set $right (i32.load offset=104 (local.get $s)))))
    (if (i32.lt_s (local.get $bottom) (local.get $top)) (then (local.set $bottom (local.get $top))))
    (store.field GpsRaster scissor_left (local.get $p) (i32.load offset=104 (local.get $s)))
    (store.field GpsRaster scissor_top (local.get $p) (local.get $top))
    (store.field GpsRaster scissor_right (local.get $p) (local.get $right))
    (store.field GpsRaster scissor_bottom (local.get $p) (local.get $bottom))
    (call $glide_emit_state (local.get $pb) (global.get $GPS_OP_RASTER) (size-of GpsRaster)
      (elem-addr GlideGps last_raster (local.get $pb) (i32.const 0)))
    ;; ---- BIND ----
    (local.set $n (i32.add (i32.ne (local.get $t0) (i32.const 0)) (i32.ne (local.get $t1) (i32.const 0))))
    (local.set $p (elem-addr GlideGps stage (local.get $pb) (i32.const 0)))
    (store.field GpsBind count (local.get $p) (local.get $n))
    (local.set $e (i32.add (local.get $p) (size-of GpsBind)))
    (if (local.get $t0) (then
      (store.field GpsBindEntry slot (local.get $e) (i32.const 0))
      (store.field GpsBindEntry texture (local.get $e) (local.get $t0))
      (store.field GpsBindEntry sampler (local.get $e) (local.get $s0))
      (local.set $e (i32.add (local.get $e) (size-of GpsBindEntry)))))
    (if (local.get $t1) (then
      (store.field GpsBindEntry slot (local.get $e) (i32.const 1))
      (store.field GpsBindEntry texture (local.get $e) (local.get $t1))
      (store.field GpsBindEntry sampler (local.get $e) (local.get $s1))))
    (call $glide_emit_state (local.get $pb) (global.get $GPS_OP_BIND)
      (i32.add (size-of GpsBind) (i32.mul (local.get $n) (size-of GpsBindEntry)))
      (elem-addr GlideGps last_bind (local.get $pb) (i32.const 0)))
    ;; ---- vertex conversion parameters and the snapshot ----
    (store.field GlideGps vx_origin (local.get $pb) (local.get $origin))
    (store.field GlideGps vx_height (local.get $pb) (f32.convert_i32_u (local.get $hgt)))
    (store.field GlideGps vx_s0 (local.get $pb) (f32.convert_i32_u (call $glide_dim_w (i32.const 0) (i32.load offset=140 (local.get $s)))))
    (store.field GlideGps vx_t0 (local.get $pb) (f32.convert_i32_u (call $glide_dim_h (i32.const 0) (i32.load offset=140 (local.get $s)))))
    (local.set $e (if (result i32) (local.get $dual) (then (call $glide_tsw (i32.const 1) (i32.const 35))) (else (i32.const 3))))
    (store.field GlideGps vx_s1 (local.get $pb) (f32.convert_i32_u (call $glide_dim_w (i32.const 0) (local.get $e))))
    (store.field GlideGps vx_t1 (local.get $pb) (f32.convert_i32_u (call $glide_dim_h (i32.const 0) (local.get $e))))
    (store.field GlideGps vx_hint_q0 (local.get $pb) (i32.ne (i32.and (i32.load offset=216 (local.get $s)) (i32.const 2)) (i32.const 0)))
    (store.field GlideGps vx_needs_z (local.get $pb) (call $glide_needs_z))
    (store.field GlideGps vx_bias (local.get $pb) (f64.convert_i32_s
      (i32.shr_s (i32.shl (i32.load offset=176 (local.get $s)) (i32.const 16)) (i32.const 16))))
    (store.field GlideGps vx_dual (local.get $pb) (local.get $dual))
    (memory.copy (local.get $snap) (local.get $s) (i32.const 256))
    (if (local.get $dual) (then (memory.copy (i32.add (local.get $snap) (i32.const 256)) (call $glide3_tmu1) (i32.const 80))))
    (store.field GlideGps ps (local.get $pb) (local.get $ps))
    (store.field GlideGps pipe_dual (local.get $pb) (local.get $dual))
    (store.field GlideGps pipe_valid (local.get $pb) (i32.const 1)))

  ;; Room for $n vertices of $prim in the open DRAW_UP (extending it when
  ;; possible); returns the wasm address of the first. Pipeline first.
  (func $glide_prim_begin (param $pb i32) (param $prim i32) (param $n i32) (result i32)
    (local $h i32) (local $bytes i32) (local $pos i32) (local $p i32) (local $end i32)
    (local.set $h (call $glide_ring))
    (local.set $bytes (i32.shl (local.get $n) (i32.const 6)))
    (if (i32.and (i32.ne (load.field GlideGps draw_open (local.get $pb)) (i32.const 0))
          (i32.and (i32.eq (load.field GlideGps draw_prim (local.get $pb)) (local.get $prim))
            (i32.le_u (i32.add (load.field GlideGps draw_count (local.get $pb)) (local.get $n)) (global.get $GLIDE_DRAW_MAX))))
      (then
        (local.set $end (load.field GlideGps draw_end (local.get $pb)))
        (if (call $gps_arena_extend (local.get $h) (local.get $end) (local.get $bytes)) (then
          (store.field GlideGps draw_end (local.get $pb) (i32.add (local.get $end) (local.get $bytes)))
          (store.field GlideGps draw_count (local.get $pb)
            (i32.add (load.field GlideGps draw_count (local.get $pb)) (local.get $n)))
          (return (call $gps_arena_ptr (local.get $h) (local.get $end)))))))
    (call $glide_close_draw (local.get $pb))
    (local.set $pos (call $gps_arena_alloc (local.get $h) (local.get $bytes)))
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_DRAW_UP) (size-of GpsDraw)))
    (store.field GpsDraw prim (local.get $p) (local.get $prim))
    (store.field GpsDraw index_size (local.get $p) (i32.const 0))
    (store.field GpsDraw pad2 (local.get $p) (i32.const 0))
    (store.field GpsDraw vs (local.get $p) (i32.const 0))
    (store.field GpsDraw ps (local.get $p) (load.field GlideGps ps (local.get $pb)))
    (store.field GpsDraw layout (local.get $p) (load.field GlideGps layout (local.get $pb)))
    (store.field GpsDraw vbuf (local.get $p) (i32.const 0))
    (store.field GpsDraw voff (local.get $p) (local.get $pos))
    (store.field GpsDraw stride (local.get $p) (i32.const 64))
    (store.field GpsDraw ibuf (local.get $p) (i32.const 0))
    (store.field GpsDraw ioff (local.get $p) (i32.const 0))
    (store.field GpsDraw count (local.get $p) (local.get $n))
    (store.field GpsDraw vcount (local.get $p) (local.get $n))
    (store.field GlideGps draw_open (local.get $pb) (local.get $p))
    (store.field GlideGps draw_prim (local.get $pb) (local.get $prim))
    (store.field GlideGps draw_end (local.get $pb) (i32.add (local.get $pos) (local.get $bytes)))
    (store.field GlideGps draw_count (local.get $pb) (local.get $n))
    (call $gps_arena_ptr (local.get $h) (local.get $pos)))

  ;; One canonical 60-byte vertex (x y z r g b ooz a oow sow0 tow0 oow0 sow1
  ;; tow1 oow1) -> the 64-byte GPS vertex of the emitted pipeline:
  ;; POSITIONT (x, y, z, oow), COLOR0, TEXCOORD0 (s, t, oow, q0), TEXCOORD1.
  ;; Glide pixel centres are at +0.5; the contract's are integers, so both
  ;; coordinates move by -0.5 here (after the lower-left origin flip). The
  ;; RASTER says linear: varyings are screen-linear, oow feeds W depth/fog.
  (func $glide_put_vertex (param $pb i32) (param $dst i32) (param $v i32)
    (local $y f32) (local $z f32)
    (local.set $y (f32.load offset=4 (local.get $v)))
    (if (load.field GlideGps vx_origin (local.get $pb))
      (then (local.set $y (f32.sub (load.field GlideGps vx_height (local.get $pb)) (local.get $y)))))
    (if (load.field GlideGps vx_needs_z (local.get $pb)) (then
      (local.set $z (f32.demote_f64 (f64.min (f64.const 1) (f64.max (f64.const 0)
        (f64.div (f64.add (f64.promote_f32 (f32.load offset=24 (local.get $v))) (load.field GlideGps vx_bias (local.get $pb)))
          (f64.const 65535))))))))
    (f32.store (local.get $dst) (f32.sub (f32.load (local.get $v)) (f32.const 0.5)))
    (f32.store offset=4 (local.get $dst) (f32.sub (local.get $y) (f32.const 0.5)))
    (f32.store offset=8 (local.get $dst) (local.get $z))
    (f32.store offset=12 (local.get $dst) (f32.load offset=32 (local.get $v)))
    (f32.store offset=16 (local.get $dst) (f32.div (f32.load offset=12 (local.get $v)) (f32.const 255)))
    (f32.store offset=20 (local.get $dst) (f32.div (f32.load offset=16 (local.get $v)) (f32.const 255)))
    (f32.store offset=24 (local.get $dst) (f32.div (f32.load offset=20 (local.get $v)) (f32.const 255)))
    (f32.store offset=28 (local.get $dst) (f32.div (f32.load offset=28 (local.get $v)) (f32.const 255)))
    (f32.store offset=32 (local.get $dst) (f32.div (f32.load offset=36 (local.get $v)) (load.field GlideGps vx_s0 (local.get $pb))))
    (f32.store offset=36 (local.get $dst) (f32.div (f32.load offset=40 (local.get $v)) (load.field GlideGps vx_t0 (local.get $pb))))
    (f32.store offset=40 (local.get $dst) (f32.load offset=32 (local.get $v)))
    (f32.store offset=44 (local.get $dst)
      (if (result f32) (load.field GlideGps vx_hint_q0 (local.get $pb))
        (then (f32.load offset=44 (local.get $v))) (else (f32.load offset=32 (local.get $v)))))
    (f32.store offset=48 (local.get $dst) (f32.div (f32.load offset=48 (local.get $v)) (load.field GlideGps vx_s1 (local.get $pb))))
    (f32.store offset=52 (local.get $dst) (f32.div (f32.load offset=52 (local.get $v)) (load.field GlideGps vx_t1 (local.get $pb))))
    (f32.store offset=56 (local.get $dst) (f32.const 0))
    (f32.store offset=60 (local.get $dst)
      (if (result f32) (load.field GlideGps vx_dual (local.get $pb))
        (then (f32.load offset=56 (local.get $v))) (else (f32.const 1)))))

  ;; Draw one primitive of canonical vertices: $op 5 triangle, 11 line,
  ;; 12 point (the old wire ops). Draws go to the target s45 names.
  (func $glide_draw (param $op i32) (param $a i32) (param $b i32) (param $c i32) (param $dual i32)
    (local $pb i32) (local $dst i32) (local $prim i32) (local $n i32)
    (local.set $pb (call $glide_pb))
    (call $glide_pipeline (local.get $pb) (local.get $dual))
    (local.set $prim (global.get $GPS_PRIM_TRIANGLELIST)) (local.set $n (i32.const 3))
    (if (i32.eq (local.get $op) (i32.const 11))
      (then (local.set $prim (global.get $GPS_PRIM_LINELIST)) (local.set $n (i32.const 2))))
    (if (i32.eq (local.get $op) (i32.const 12))
      (then (local.set $prim (global.get $GPS_PRIM_POINTLIST)) (local.set $n (i32.const 1))))
    (local.set $dst (call $glide_prim_begin (local.get $pb) (local.get $prim) (local.get $n)))
    (call $glide_put_vertex (local.get $pb) (local.get $dst) (local.get $a))
    (if (i32.ge_u (local.get $n) (i32.const 2))
      (then (call $glide_put_vertex (local.get $pb) (i32.add (local.get $dst) (i32.const 64)) (local.get $b))))
    (if (i32.eq (local.get $n) (i32.const 3))
      (then (call $glide_put_vertex (local.get $pb) (i32.add (local.get $dst) (i32.const 128)) (local.get $c))))
    (if (i32.eqz (i32.load offset=180 (call $glide_state)))
      (then (store.field GlideGps front_dirty (local.get $pb) (i32.const 1)))))

  (func $glide_check_guest (param $guest i32) (param $n i32)
    (if (i32.or (i32.eqz (local.get $guest))
      (i32.lt_u (i32.add (local.get $guest) (local.get $n)) (local.get $guest)))
      (then (call $glide_fail))))

  (func $glide_copy_guest (param $dst i32) (param $guest i32) (param $n i32)
    (local $src i32)
    (call $glide_check_guest (local.get $guest) (local.get $n))
    (local.set $src (call $guest_span_in (local.get $guest) (local.get $n)))
    (memory.copy (local.get $dst) (local.get $src) (local.get $n))
    (call $guest_span_release (local.get $src) (local.get $n)))

  (func $glide_tmu (param $tmu i32)
    (if (i32.gt_u (local.get $tmu)
      (i32.eq (call $glide_api_version) (i32.const 3))) (then (call $glide_fail))))

  ;; Original 3dfx sst1/gsplash.c (same pinned revision) defines SNAP_BIAS
  ;; as 3<<18 and passes projected coordinates PLUS this bias directly to
  ;; grDrawTriangle (lines 633-638, 676-685). The hardware's signed 12.4
  ;; coordinate conversion discards that integer multiple of 4096. Decode
  ;; exactly that alternate coordinate interval, including negative screen
  ;; positions; never subtract a guessed offset from arbitrary large values.
  ;; No hint enables this convention: Glide's own splash uses it unconditionally.
  (func $glide_coordinate (param $x f32) (result f32)
    (if (result f32) (i32.and
        (f32.ge (local.get $x) (f32.const 784384))
        (f32.lt (local.get $x) (f32.const 788480)))
      (then (f32.sub (local.get $x) (f32.const 786432)))
      (else (local.get $x))))

  (func $glide_copy_vertex (param $dst i32) (param $guest i32)
    (if (i32.eq (call $glide_api_version) (i32.const 3))
      (then (call $glide3_vertex (local.get $dst) (local.get $guest)) (return)))
    (call $glide_copy_guest (local.get $dst) (local.get $guest) (i32.const 60))
    (f32.store (local.get $dst) (call $glide_coordinate (f32.load (local.get $dst))))
    (f32.store offset=4 (local.get $dst)
      (call $glide_coordinate (f32.load offset=4 (local.get $dst)))))

  ;; Glide 2 LOD enums run 256=0 through 1=8. Each selected level occupies
  ;; its dimensions * bytes-per-pixel; complete allocations align to 8 bytes.
  (func $glide_tex_bytes (param $small i32) (param $large i32)
      (param $aspect i32) (param $format i32) (param $mask i32) (result i32)
    (local $lod i32) (local $w i32) (local $h i32) (local $n i32)
    (if (i32.or (i32.gt_u (local.get $small) (i32.const 8))
      (i32.or (i32.gt_u (local.get $large) (local.get $small))
      (i32.or (i32.gt_u (local.get $aspect) (i32.const 6))
      (i32.or (i32.gt_u (local.get $format) (i32.const 15))
      (i32.or (i32.eqz (local.get $mask)) (i32.gt_u (local.get $mask) (i32.const 3)))))))
      (then (call $glide_fail)))
    (local.set $lod (local.get $large))
    (loop $levels
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1)
          (i32.and (local.get $lod) (i32.const 1)))) (then
        (local.set $w (i32.shr_u (i32.const 256) (local.get $lod)))
        (local.set $h (local.get $w))
        (if (i32.lt_u (local.get $aspect) (i32.const 3))
          (then (local.set $h (i32.shr_u (local.get $h) (i32.sub (i32.const 3) (local.get $aspect))))))
        (if (i32.gt_u (local.get $aspect) (i32.const 3))
          (then (local.set $w (i32.shr_u (local.get $w) (i32.sub (local.get $aspect) (i32.const 3))))))
        (if (i32.eqz (local.get $w)) (then (local.set $w (i32.const 1))))
        (if (i32.eqz (local.get $h)) (then (local.set $h (i32.const 1))))
        (local.set $n (i32.add (local.get $n)
          (i32.shl (i32.mul (local.get $w) (local.get $h))
            (i32.ge_u (local.get $format) (i32.const 8)))))))
      (local.set $lod (i32.add (local.get $lod) (i32.const 1)))
      (br_if $levels (i32.le_u (local.get $lod) (local.get $small))))
    (local.get $n))

  ;; Pixel centres a Glide 2 triangle covers inside the clip window (state
  ;; +104..+116), for grSstPerfStats. Vertices are already snap-decoded
  ;; ($glide_copy_vertex). A row y counts when y+0.5 lies in [ymin, ymax); a
  ;; column x when x+0.5 lies in [xleft, xright): half-open both ways, so two
  ;; triangles sharing an edge never count its pixels twice. This is the
  ;; rasterised AREA, i.e. what enters the pixel pipeline; the backend does not
  ;; report which fragments the depth/alpha/chroma tests then reject.
  (func $glide_count_pixels (param $p0 i32) (param $p1 i32) (param $p2 i32) (result i32)
    (local $t i32) (local $y i32) (local $y_end i32) (local $xs i32) (local $xe i32) (local $n i32)
    (local $x0 f32) (local $y0 f32) (local $x1 f32) (local $y1 f32) (local $x2 f32) (local $y2 f32)
    (local $yc f32) (local $xa f32) (local $xb f32) (local $s f32)
    (local $cx0 i32) (local $cy0 i32) (local $cx1 i32) (local $cy1 i32)
    ;; Sort the three vertex pointers by y.
    (if (f32.gt (f32.load offset=4 (local.get $p0)) (f32.load offset=4 (local.get $p1)))
      (then (local.set $t (local.get $p0)) (local.set $p0 (local.get $p1)) (local.set $p1 (local.get $t))))
    (if (f32.gt (f32.load offset=4 (local.get $p1)) (f32.load offset=4 (local.get $p2)))
      (then (local.set $t (local.get $p1)) (local.set $p1 (local.get $p2)) (local.set $p2 (local.get $t))))
    (if (f32.gt (f32.load offset=4 (local.get $p0)) (f32.load offset=4 (local.get $p1)))
      (then (local.set $t (local.get $p0)) (local.set $p0 (local.get $p1)) (local.set $p1 (local.get $t))))
    (local.set $x0 (f32.load (local.get $p0))) (local.set $y0 (f32.load offset=4 (local.get $p0)))
    (local.set $x1 (f32.load (local.get $p1))) (local.set $y1 (f32.load offset=4 (local.get $p1)))
    (local.set $x2 (f32.load (local.get $p2))) (local.set $y2 (f32.load offset=4 (local.get $p2)))
    (local.set $cx0 (i32.load offset=104 (call $glide_state)))
    (local.set $cy0 (i32.load offset=108 (call $glide_state)))
    (local.set $cx1 (i32.load offset=112 (call $glide_state)))
    (local.set $cy1 (i32.load offset=116 (call $glide_state)))
    ;; Rows: clipped to the window first, so the walk is bounded by it.
    (local.set $y (i32.trunc_sat_f32_s (f32.ceil (f32.sub (local.get $y0) (f32.const 0.5)))))
    (local.set $y_end (i32.trunc_sat_f32_s (f32.ceil (f32.sub (local.get $y2) (f32.const 0.5)))))
    (if (i32.lt_s (local.get $y) (local.get $cy0)) (then (local.set $y (local.get $cy0))))
    (if (i32.gt_s (local.get $y_end) (local.get $cy1)) (then (local.set $y_end (local.get $cy1))))
    (block $done (loop $rows
      (br_if $done (i32.ge_s (local.get $y) (local.get $y_end)))
      (local.set $yc (f32.add (f32.convert_i32_s (local.get $y)) (f32.const 0.5)))
      ;; Long edge 0->2, and the short edge the row centre is on.
      (local.set $xa (f32.add (local.get $x0) (f32.mul (f32.sub (local.get $x2) (local.get $x0))
        (f32.div (f32.sub (local.get $yc) (local.get $y0)) (f32.sub (local.get $y2) (local.get $y0))))))
      (if (f32.lt (local.get $yc) (local.get $y1))
        (then (local.set $xb (f32.add (local.get $x0) (f32.mul (f32.sub (local.get $x1) (local.get $x0))
          (f32.div (f32.sub (local.get $yc) (local.get $y0)) (f32.sub (local.get $y1) (local.get $y0)))))))
        (else (local.set $xb (f32.add (local.get $x1) (f32.mul (f32.sub (local.get $x2) (local.get $x1))
          (f32.div (f32.sub (local.get $yc) (local.get $y1)) (f32.sub (local.get $y2) (local.get $y1))))))))
      (if (f32.gt (local.get $xa) (local.get $xb))
        (then (local.set $s (local.get $xa)) (local.set $xa (local.get $xb)) (local.set $xb (local.get $s))))
      (local.set $xs (i32.trunc_sat_f32_s (f32.ceil (f32.sub (local.get $xa) (f32.const 0.5)))))
      (local.set $xe (i32.trunc_sat_f32_s (f32.ceil (f32.sub (local.get $xb) (f32.const 0.5)))))
      (if (i32.lt_s (local.get $xs) (local.get $cx0)) (then (local.set $xs (local.get $cx0))))
      (if (i32.gt_s (local.get $xe) (local.get $cx1)) (then (local.set $xe (local.get $cx1))))
      (if (i32.gt_s (local.get $xe) (local.get $xs))
        (then (local.set $n (i32.add (local.get $n) (i32.sub (local.get $xe) (local.get $xs))))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $rows)))
    (local.get $n))

  (func $glide_triangle (param $a i32) (param $b i32) (param $c i32)
    (local $p i32)
    (if (i32.eq (call $glide_api_version) (i32.const 3)) (then
      (local.set $p (i32.add (call $glide3_ext) (i32.const 4800)))
      (call $glide3_vertex (local.get $p) (local.get $a))
      (call $glide3_vertex (i32.add (local.get $p) (i32.const 60)) (local.get $b))
      (call $glide3_vertex (i32.add (local.get $p) (i32.const 120)) (local.get $c))
      (call $glide3_emit (i32.const 5) (local.get $p) (i32.add (local.get $p) (i32.const 60)) (i32.add (local.get $p) (i32.const 120)))
      (return)))
    (local.set $p (elem-addr GlideGps vtx (call $glide_pb) (i32.const 0)))
    (call $glide_copy_vertex (local.get $p) (local.get $a))
    (call $glide_copy_vertex (i32.add (local.get $p) (i32.const 60)) (local.get $b))
    (call $glide_copy_vertex (i32.add (local.get $p) (i32.const 120)) (local.get $c))
    (call $glide_draw (i32.const 5) (local.get $p) (i32.add (local.get $p) (i32.const 60))
      (i32.add (local.get $p) (i32.const 120)) (i32.const 0))
    ;; grSstPerfStats counters (extension +2480 pixelsIn, +2484 pixelsOut):
    ;; the triangle's rasterised area enters and, with no per-fragment test
    ;; results from the backend, leaves the pipeline. See $handle_grSstPerfStats.
    (call $glide_perf_add (call $glide_count_pixels (local.get $p)
      (i32.add (local.get $p) (i32.const 60)) (i32.add (local.get $p) (i32.const 120))))
    (i32.store offset=36 (global.get $GLIDE_STATE)
      (i32.add (i32.load offset=36 (global.get $GLIDE_STATE)) (i32.const 1))))

  (func $glide_perf_add (param $n i32)
    (local $e i32)
    (local.set $e (call $glide3_ext))
    (i32.store offset=2480 (local.get $e) (i32.add (i32.load offset=2480 (local.get $e)) (local.get $n)))
    (i32.store offset=2484 (local.get $e) (i32.add (i32.load offset=2484 (local.get $e)) (local.get $n))))

  ;; Retain topology explicitly. Thin lines and points must reach each
  ;; backend's native coverage rules, rather than pretending to be triangles.
  (func $glide_small_primitive (param $op i32) (param $a i32) (param $b i32)
    (local $p i32)
    (if (i32.eq (call $glide_api_version) (i32.const 3)) (then
      (local.set $p (i32.add (call $glide3_ext) (i32.const 4800)))
      (call $glide3_vertex (local.get $p) (local.get $a))
      (if (i32.eq (local.get $op) (i32.const 11)) (then
        (call $glide3_vertex (i32.add (local.get $p) (i32.const 60)) (local.get $b))))
      (call $glide3_emit (local.get $op) (local.get $p) (i32.add (local.get $p) (i32.const 60)) (i32.const 0))
      (return)))
    (local.set $p (elem-addr GlideGps vtx (call $glide_pb) (i32.const 0)))
    (call $glide_copy_vertex (local.get $p) (local.get $a))
    (if (i32.eq (local.get $op) (i32.const 11)) (then
      (call $glide_copy_vertex (i32.add (local.get $p) (i32.const 60)) (local.get $b))))
    (call $glide_draw (local.get $op) (local.get $p) (i32.add (local.get $p) (i32.const 60))
      (i32.const 0) (i32.const 0)))
  ;; LFB staging is affine guest memory kept stable until unlock. The host
  ;; reads/writes the packet synchronously; it never retains a guest pointer.
  (func $glide_lfb_stage (param $buffer i32) (param $origin i32)
    (param $reason i32) (param $width i32) (param $height i32) (result i32)
    (local $guest i32) (local $p i32) (local $n i32)
    (if (i32.or (i32.eqz (i32.load offset=12 (global.get $GLIDE_STATE)))
      (i32.or (i32.gt_u (local.get $buffer) (i32.const 1))
        (i32.gt_u (local.get $origin) (i32.const 1)))) (then (return (i32.const 0))))
    (call $glide_flush)
    (local.set $guest (i32.load offset=40 (global.get $GLIDE_STATE)))
    (if (i32.eqz (local.get $guest)) (then
      (local.set $guest (call $gl_alloc_affine (i32.const 1572884)))
      (if (i32.eqz (local.get $guest)) (then (return (i32.const 0))))
      (i32.store offset=40 (global.get $GLIDE_STATE) (local.get $guest))))
    (local.set $p (call $g2w (local.get $guest)))
    (i32.store (local.get $p) (local.get $buffer))
    (i32.store offset=4 (local.get $p) (local.get $origin))
    (i32.store offset=8 (local.get $p) (i32.const 0))
    (i32.store offset=12 (local.get $p) (i32.load offset=24 (global.get $GLIDE_STATE)))
    (i32.store offset=16 (local.get $p) (i32.load offset=28 (global.get $GLIDE_STATE)))
    (local.set $n (i32.add (i32.const 20) (i32.mul
      (i32.mul (i32.load offset=24 (global.get $GLIDE_STATE))
        (i32.load offset=28 (global.get $GLIDE_STATE))) (i32.const 2))))
    (if (i32.gt_u (local.get $n) (i32.const 1572884)) (then (call $glide_fail)))
    (call $glide_lfb_record_metrics (local.get $reason) (local.get $width) (local.get $height))
    (call $glide_lfb_read (local.get $p))
    (local.get $p))

  ;; READBACK the whole buffer as A8B8G8R8 (the only readback format the
  ;; contract has) in bands of at most 2 MB (half the arena), converting each band
  ;; to RGB565 in the stage at $p+20, rows in the stage's origin (lower-left
  ;; origin: stage row 0 is the bottom row).
  (func $glide_lfb_read (param $p i32)
    (local $pb i32) (local $h i32) (local $w i32) (local $hgt i32) (local $pos i32) (local $r i32)
    (local $seq i32) (local $y i32) (local $row i32) (local $src i32) (local $band i32) (local $n i32)
    (local $i i32) (local $px i32) (local $dst i32) (local $y0 i32)
    (local.set $pb (call $glide_pb))
    (local.set $h (call $glide_ring))
    (local.set $w (i32.load offset=12 (local.get $p)))
    (local.set $hgt (i32.load offset=16 (local.get $p)))
    (local.set $row (i32.shl (local.get $w) (i32.const 2)))
    (if (i32.or (i32.eqz (local.get $w)) (i32.gt_u (local.get $row) (i32.const 2097152))) (then (call $glide_fail)))
    (local.set $band (i32.div_u (i32.const 2097152) (local.get $row)))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $y0) (local.get $hgt)))
      (local.set $n (i32.sub (local.get $hgt) (local.get $y0)))
      (if (i32.gt_u (local.get $n) (local.get $band)) (then (local.set $n (local.get $band))))
      (local.set $pos (call $glide_arena (local.get $pb) (i32.mul (local.get $row) (local.get $n))))
      (call $gps_slot_arm (local.get $h) (i32.const 0))
      (local.set $r (call $glide_begin (local.get $pb) (global.get $GPS_OP_READBACK) (size-of GpsReadback)))
      (store.field GpsReadback rt (local.get $r)
        (i32.load (i32.add (elem-addr GlideGps color (local.get $pb) (i32.const 0))
          (i32.shl (i32.load (local.get $p)) (i32.const 2)))))
      (store.field GpsReadback x (local.get $r) (i32.const 0))
      (store.field GpsReadback y (local.get $r) (local.get $y0))
      (store.field GpsReadback w (local.get $r) (local.get $w))
      (store.field GpsReadback h (local.get $r) (local.get $n))
      (store.field GpsReadback fmt (local.get $r) (global.get $GPS_FMT_A8B8G8R8))
      (store.field GpsReadback dst (local.get $r) (local.get $pos))
      (store.field GpsReadback pitch (local.get $r) (local.get $row))
      (store.field GpsReadback slot (local.get $r) (i32.const 0))
      (local.set $seq (call $glide_end (local.get $r)))
      (call $glide_kick_wait_slot (local.get $pb) (local.get $seq))
      (local.set $src (call $glide_arena_ptr (local.get $pos)))
      (local.set $y (i32.const 0))
      (loop $rows
        (local.set $dst (i32.add (i32.add (local.get $p) (i32.const 20)) (i32.mul (i32.shl (local.get $w) (i32.const 1))
          (if (result i32) (i32.load offset=4 (local.get $p))
            (then (i32.sub (i32.sub (local.get $hgt) (i32.const 1)) (i32.add (local.get $y0) (local.get $y))))
            (else (i32.add (local.get $y0) (local.get $y)))))))
        (local.set $i (i32.const 0))
        (loop $pixels
          ;; R,G,B,A bytes -> RGB565.
          (local.set $px (i32.load (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2)))))
          (i32.store16 (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 1)))
            (i32.or (i32.or
              (i32.shl (i32.and (local.get $px) (i32.const 0xF8)) (i32.const 8))
              (i32.and (i32.shr_u (local.get $px) (i32.const 5)) (i32.const 0x7E0)))
              (i32.and (i32.shr_u (local.get $px) (i32.const 19)) (i32.const 0x1F))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $pixels (i32.lt_u (local.get $i) (local.get $w))))
        (local.set $src (i32.add (local.get $src) (local.get $row)))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $y) (local.get $n))))
      (local.set $y0 (i32.add (local.get $y0) (local.get $n)))
      (br $bands))))

  (func $glide_kick_wait_slot (param $pb i32) (param $seq i32)
    (call $glide_close_draw (local.get $pb))
    (store.field GlideGps kick_pos (local.get $pb) (load.field.memarg GpsRing write_pos (call $glide_ring)))
    (store.field GlideGps kick_arena (local.get $pb) (load.field.memarg GpsRing arena_head (call $glide_ring)))
    (call $gps_slot_wait (call $glide_ring) (i32.const 0) (local.get $seq)))

  ;; Write the whole stage back: RGB565 -> R,G,B,255 UPLOADs in bands.
  (func $glide_lfb_publish (param $p i32) (result i32)
    (local $pb i32) (local $w i32) (local $hgt i32) (local $band i32) (local $y i32) (local $n i32)
    (local $pos i32) (local $dst i32) (local $src i32) (local $i i32) (local $x i32) (local $v i32)
    (local $id i32) (local $count i32)
    (local.set $pb (call $glide_pb))
    (local.set $w (i32.load offset=12 (local.get $p)))
    (local.set $hgt (i32.load offset=16 (local.get $p)))
    (local.set $id (i32.load (i32.add (elem-addr GlideGps color (local.get $pb) (i32.const 0))
      (i32.shl (i32.load (local.get $p)) (i32.const 2)))))
    (local.set $band (i32.div_u (i32.const 1048576) (i32.shl (local.get $w) (i32.const 2))))
    (if (i32.eqz (local.get $band)) (then (call $glide_fail)))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $y) (local.get $hgt)))
      (local.set $n (i32.sub (local.get $hgt) (local.get $y)))
      (if (i32.gt_u (local.get $n) (local.get $band)) (then (local.set $n (local.get $band))))
      (local.set $pos (call $glide_arena (local.get $pb) (i32.shl (i32.mul (local.get $w) (local.get $n)) (i32.const 2))))
      (local.set $dst (call $glide_arena_ptr (local.get $pos)))
      (local.set $i (i32.const 0))
      (loop $rows
        (local.set $src (i32.add (i32.add (local.get $p) (i32.const 20)) (i32.shl (i32.mul (local.get $w)
          (if (result i32) (i32.load offset=4 (local.get $p))
            (then (i32.sub (i32.sub (local.get $hgt) (i32.const 1)) (i32.add (local.get $y) (local.get $i))))
            (else (i32.add (local.get $y) (local.get $i))))) (i32.const 1))))
        (local.set $x (i32.const 0))
        (loop $pixels
          (local.set $v (i32.load16_u (i32.add (local.get $src) (i32.shl (local.get $x) (i32.const 1)))))
          (i32.store (local.get $dst) (i32.or (i32.or
              (call $glide_expand (i32.shr_u (local.get $v) (i32.const 11)) (i32.const 31))
              (i32.shl (call $glide_expand (i32.and (i32.shr_u (local.get $v) (i32.const 5)) (i32.const 63)) (i32.const 63)) (i32.const 8)))
            (i32.or (i32.shl (call $glide_expand (i32.and (local.get $v) (i32.const 31)) (i32.const 31)) (i32.const 16))
              (i32.const 0xFF000000))))
          (local.set $dst (i32.add (local.get $dst) (i32.const 4)))
          (local.set $x (i32.add (local.get $x) (i32.const 1)))
          (br_if $pixels (i32.lt_u (local.get $x) (local.get $w))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $i) (local.get $n))))
      (call $glide_upload (local.get $pb) (local.get $id) (i32.const 0) (local.get $y)
        (local.get $w) (local.get $n) (i32.shl (local.get $w) (i32.const 2)) (local.get $pos))
      (local.set $y (i32.add (local.get $y) (local.get $n)))
      (br $bands)))
    (if (i32.eqz (i32.load (local.get $p)))
      (then (store.field GlideGps front_dirty (local.get $pb) (i32.const 1))))
    (i32.const 1))

  ;; Fullscreen ownership is shared across instances, like DirectDraw's mode.
  ;; +56 target HWND, +60 saved-mode flag, +64 previous DX state (32 bytes),
  ;; +96 original window RECT. No guest callback runs synchronously here.
  (func $glide_display_target (param $hwnd i32) (result i32)
    (if (i32.eqz (local.get $hwnd)) (then (local.set $hwnd (call $dx_target_hwnd))))
    (if (i32.eqz (local.get $hwnd)) (then (local.set $hwnd (call $host_foreground_window))))
    (memory.fill (region.addr $GLIDE_STATE 96) (i32.const 0) (i32.const 16))
    (if (local.get $hwnd) (then
      (call $host_get_window_rect (local.get $hwnd) (region.addr $GLIDE_STATE 96))))
    ;; A missing HWND must not create a phantom window or restore a zero RECT.
    (if (i32.or
      (i32.le_s (i32.load offset=104 (global.get $GLIDE_STATE)) (i32.load offset=96 (global.get $GLIDE_STATE)))
      (i32.le_s (i32.load offset=108 (global.get $GLIDE_STATE)) (i32.load offset=100 (global.get $GLIDE_STATE))))
      (then (return (i32.const 0))))
    (local.get $hwnd))

  (func $glide_display_take (param $hwnd i32) (param $w i32) (param $h i32)
    (memory.copy (region.addr $GLIDE_STATE 64) (global.get $DX_PROCESS_STATE) (i32.const 32))
    (i32.store offset=56 (global.get $GLIDE_STATE) (local.get $hwnd))
    (i32.store offset=60 (global.get $GLIDE_STATE) (i32.const 1))
    (call $dx_display_w_set (local.get $w))
    (call $dx_display_h_set (local.get $h))
    (call $dx_display_bpp_set (i32.const 16))
    (call $dx_display_mode_set (i32.const 1))
    (call $dx_display_fullscreen_set (i32.const 1))
    (call $dx_coop_hwnd_set (local.get $hwnd))
    (call $dx_exclusive_set (i32.ne (local.get $hwnd) (i32.const 0)))
    (if (local.get $hwnd) (then
      (call $host_move_window (local.get $hwnd) (i32.const 0) (i32.const 0)
        (local.get $w) (local.get $h) (i32.const 0))
      (call $client_rect_set (local.get $hwnd) (i32.const 0) (i32.const 0) (local.get $w) (local.get $h))
      ;; Like DirectDraw SetDisplayMode, let the HWND's owning thread lay out
      ;; its children after the mode switch. Never call its wndproc inline:
      ;; Glide may be opened by a different thread while holding its lock.
      (drop (call $post_queue_push (local.get $hwnd) (i32.const 0x0003)
        (i32.const 0) (i32.const 0)))
      (drop (call $post_queue_push (local.get $hwnd) (i32.const 0x0005)
        (i32.const 0)
        (i32.or (i32.and (local.get $w) (i32.const 0xFFFF))
          (i32.shl (local.get $h) (i32.const 16))))))))

  (func $glide_display_restore
    (local $hwnd i32) (local $rect i32)
    (if (i32.eqz (i32.load offset=60 (global.get $GLIDE_STATE))) (then (return)))
    (i32.store offset=60 (global.get $GLIDE_STATE) (i32.const 0))
    (memory.copy (global.get $DX_PROCESS_STATE) (region.addr $GLIDE_STATE 64) (i32.const 32))
    (local.set $hwnd (i32.load offset=56 (global.get $GLIDE_STATE)))
    (if (local.get $hwnd) (then
      ;; Window may have been destroyed before grGlideShutdown.
      (local.set $rect (call $paint_scratch_take))
      (memory.fill (local.get $rect) (i32.const 0) (i32.const 16))
      (call $host_get_window_rect (local.get $hwnd) (local.get $rect))
      (if (i32.and (i32.gt_s (i32.load offset=8 (local.get $rect)) (i32.load (local.get $rect)))
          (i32.gt_s (i32.load offset=12 (local.get $rect)) (i32.load offset=4 (local.get $rect)))) (then
        (call $host_move_window (local.get $hwnd)
          (i32.load offset=96 (global.get $GLIDE_STATE)) (i32.load offset=100 (global.get $GLIDE_STATE))
          (i32.sub (i32.load offset=104 (global.get $GLIDE_STATE)) (i32.load offset=96 (global.get $GLIDE_STATE)))
          (i32.sub (i32.load offset=108 (global.get $GLIDE_STATE)) (i32.load offset=100 (global.get $GLIDE_STATE)))
          (i32.const 0))
        (call $defwndproc_do_nccalcsize (local.get $hwnd)))))))

  ;; Guest API entry points.


  (func $handle_grGlideInit
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_init)
    (i32.store offset=112 (global.get $GLIDE_STATE) (i32.const 2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grGlideShutdown
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_close)
    (call $glide_display_restore)
    (call $glide_release_storage)
    (local.set $p (i32.load offset=40 (global.get $GLIDE_STATE)))
    (if (local.get $p) (then (call $heap_free (local.get $p))))
    (local.set $p (i32.load offset=116 (global.get $GLIDE_STATE)))
    (if (local.get $p) (then (call $heap_free (local.get $p))))
    (memory.fill (region.addr $GLIDE_STATE 8) (i32.const 0) (i32.const 248))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grSstWinClose
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_close)
    (call $glide_display_restore)
    (i32.store offset=48 (global.get $GLIDE_STATE) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grSstQueryHardware
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_check_guest (local.get $arg0) (i32.const 148))
    (local.set $p (call $guest_span_in (local.get $arg0) (i32.const 148)))
    (memory.fill (local.get $p) (i32.const 0) (i32.const 148))
    (i32.store offset=0 (local.get $p) (i32.const 1))
    (i32.store offset=8 (local.get $p) (i32.const 4))
    (i32.store offset=12 (local.get $p) (i32.const 2))
    (i32.store offset=16 (local.get $p) (i32.const 1))
    (i32.store offset=24 (local.get $p) (i32.const 1))
    (i32.store offset=28 (local.get $p) (i32.const 4))
    (call $guest_span_writeback (local.get $arg0) (local.get $p) (i32.const 148))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grGlideGetVersion
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_check_guest (local.get $arg0) (i32.const 19))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 0)) (i32.const 50))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 1)) (i32.const 46))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 2)) (i32.const 52))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 3)) (i32.const 51))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 4)) (i32.const 32))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 5)) (i32.const 87))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 6)) (i32.const 105))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 7)) (i32.const 110))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 8)) (i32.const 101))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 9)) (i32.const 32))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 10)) (i32.const 65))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 11)) (i32.const 115))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 12)) (i32.const 115))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 13)) (i32.const 101))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 14)) (i32.const 109))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 15)) (i32.const 98))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 16)) (i32.const 108))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 17)) (i32.const 121))
    (call $gs8 (i32.add (local.get $arg0) (i32.const 18)) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grSstSelect
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (if (local.get $arg0) (then (call $glide_fail)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grSstScreenWidth
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=0 (global.get $reg_base) (i32.load offset=24 (global.get $GLIDE_STATE)))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grSstScreenHeight
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=0 (global.get $reg_base) (i32.load offset=28 (global.get $GLIDE_STATE)))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grSstIdle
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_flush)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grSstStatus
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_flush)
    (i32.store offset=0 (global.get $reg_base) (i32.or (i32.const 268431423)
        (i32.shl (i32.eqz (call $vblank_in_blank (call $host_get_ticks))) (i32.const 6))))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grSstVRetraceOn
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=0 (global.get $reg_base) (call $vblank_in_blank (call $host_get_ticks)))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grErrorSetCallback
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=32 (global.get $GLIDE_STATE) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grSstControl
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $r i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    ;; Activation gates presentation. GR_CONTROL_RESIZE (3) and MOVE (4) are
    ;; notifications that a fullscreen board has nothing to do for, and 3dfx's
    ;; Glide 2 returns FXTRUE for them: Driver calls grSstControl(MOVE) on
    ;; every WM_MOVE (one arrives at window creation) and posts WM_CLOSE when
    ;; it fails, so a FALSE here quit the game during boot. Unknown codes fail.
    (if (i32.or (i32.eq (local.get $arg0) (i32.const 1))
        (i32.eq (local.get $arg0) (i32.const 2))) (then
        (i32.store offset=244 (call $glide_state) (i32.eq (local.get $arg0) (i32.const 1)))
        (local.set $r (i32.const 1))))
    (if (i32.or (i32.eq (local.get $arg0) (i32.const 3))
        (i32.eq (local.get $arg0) (i32.const 4)))
      (then (local.set $r (i32.const 1))))
    (i32.store offset=0 (global.get $reg_base) (local.get $r))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grSstWinOpen
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $r i32) (local $hwnd i32)
    (local $w i32) (local $h i32) (local $cbuf i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_init) (call $glide_flush)
    (if (i32.load offset=12 (global.get $GLIDE_STATE)) (then (call $glide_fail)))
    ;; nColBuffers (stack +24) and nAuxBuffers (+28). The release 3dfx Glide
    ;; 2.4 driver (Voodoo Graphics, Win95, from Myth's disc) checks only their
    ;; sum against frame-buffer memory, and skips that check above 2 MB; this
    ;; board reports 4 MB. Myth opens with one color buffer and two aux
    ;; buffers. Triple buffering (3) has no backend surface yet: answer it as
    ;; a board without frame-buffer memory for a third buffer does, FXFALSE
    ;; with nothing opened. Deus Ex's GlideDrv asks for three first and then
    ;; retries with two; trapping there ended the game.
    (local.set $cbuf (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (if (i32.eq (local.get $cbuf) (i32.const 3))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (call $lock_release (global.get $GLIDE_STATE))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (if (i32.or (i32.gt_u (local.get $arg3) (i32.const 3)) (i32.or (i32.gt_u (local.get $arg4) (i32.const 1)) (i32.or (i32.or (i32.lt_s (local.get $cbuf) (i32.const 1)) (i32.gt_s (local.get $cbuf) (i32.const 2))) (i32.gt_u (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))) (i32.const 2))))) (then (call $glide_fail)))
    (if (i32.eq (local.get $arg1) (i32.const 0)) (then (local.set $w (i32.const 320)) (local.set $h (i32.const 200))))
    (if (i32.eq (local.get $arg1) (i32.const 1)) (then (local.set $w (i32.const 320)) (local.set $h (i32.const 240))))
    (if (i32.eq (local.get $arg1) (i32.const 2)) (then (local.set $w (i32.const 400)) (local.set $h (i32.const 256))))
    (if (i32.eq (local.get $arg1) (i32.const 3)) (then (local.set $w (i32.const 512)) (local.set $h (i32.const 384))))
    (if (i32.eq (local.get $arg1) (i32.const 4)) (then (local.set $w (i32.const 640)) (local.set $h (i32.const 200))))
    (if (i32.eq (local.get $arg1) (i32.const 5)) (then (local.set $w (i32.const 640)) (local.set $h (i32.const 350))))
    (if (i32.eq (local.get $arg1) (i32.const 6)) (then (local.set $w (i32.const 640)) (local.set $h (i32.const 400))))
    (if (i32.eq (local.get $arg1) (i32.const 7)) (then (local.set $w (i32.const 640)) (local.set $h (i32.const 480))))
    (if (i32.eq (local.get $arg1) (i32.const 8)) (then (local.set $w (i32.const 800)) (local.set $h (i32.const 600))))
    (if (i32.eq (local.get $arg1) (i32.const 9)) (then (local.set $w (i32.const 960)) (local.set $h (i32.const 720))))
    (if (i32.eq (local.get $arg1) (i32.const 10)) (then (local.set $w (i32.const 856)) (local.set $h (i32.const 480))))
    (if (i32.eq (local.get $arg1) (i32.const 11)) (then (local.set $w (i32.const 512)) (local.set $h (i32.const 256))))
    (if (i32.eq (local.get $arg1) (i32.const 12)) (then (local.set $w (i32.const 1024)) (local.set $h (i32.const 768))))
    (if (i32.eqz (local.get $w)) (then (call $glide_fail)))
    (memory.fill (call $glide_state) (i32.const 0) (i32.const 256))
    (i32.store offset=0 (call $glide_state) (i32.const 1))
    (i32.store offset=8 (call $glide_state) (i32.const 0))
    (i32.store offset=20 (call $glide_state) (i32.const 1))
    (i32.store offset=28 (call $glide_state) (i32.const 0))
    (i32.store offset=40 (call $glide_state) (i32.const 4294967295))
    (i32.store offset=48 (call $glide_state) (i32.const 1))
    (i32.store offset=52 (call $glide_state) (i32.const 1))
    (i32.store offset=56 (call $glide_state) (i32.const 4))
    (i32.store offset=64 (call $glide_state) (i32.const 4))
    (i32.store offset=72 (call $glide_state) (i32.const 7))
    (i32.store offset=120 (call $glide_state) (i32.const 1))
    (i32.store offset=124 (call $glide_state) (i32.const 1))
    (i32.store offset=148 (call $glide_state) (i32.const 3))
    (i32.store offset=180 (call $glide_state) (i32.const 1))
    (i32.store offset=184 (call $glide_state) (i32.const 1))
    (i32.store offset=192 (call $glide_state) (i32.const 1))
    (i32.store offset=212 (call $glide_state) (i32.const 1065353216))
    (i32.store offset=244 (call $glide_state) (i32.const 1))
    (i32.store offset=100 (call $glide_state) (local.get $arg4))(i32.store offset=112 (call $glide_state) (local.get $w))(i32.store offset=116 (call $glide_state) (local.get $h))
    (local.set $hwnd (call $glide_display_target (local.get $arg0)))
    ;; cbuf 1 = single-buffered: rendering lands on the displayed surface and
    ;; a swap only presents it.
    (local.set $r (call $glide_open (local.get $hwnd) (local.get $w) (local.get $h) (local.get $arg3) (local.get $cbuf)))
    (i32.store offset=12 (global.get $GLIDE_STATE) (local.get $r))(i32.store offset=24 (global.get $GLIDE_STATE) (local.get $w))(i32.store offset=28 (global.get $GLIDE_STATE) (local.get $h))
    (if (i32.eq (call $glide_api_version) (i32.const 3)) (then
      (i32.store offset=216 (call $glide_state) (i32.const 2))
      (memory.fill (call $glide3_tmu1) (i32.const 0) (i32.const 80))
      (i32.store offset=20 (call $glide3_tmu1) (i32.const 3))
      (i32.store offset=16 (call $glide3_ext) (local.get $w))
      (i32.store offset=20 (call $glide3_ext) (local.get $h))))
    (if (local.get $r) (then (call $glide_display_take (local.get $hwnd) (local.get $w) (local.get $h))))
    (i32.store offset=0 (global.get $reg_base) (local.get $r))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_grColorCombine
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=0 (call $glide_state) (local.get $arg0))
    (i32.store offset=4 (call $glide_state) (local.get $arg1))
    (i32.store offset=8 (call $glide_state) (local.get $arg2))
    (i32.store offset=12 (call $glide_state) (local.get $arg3))
    (i32.store offset=16 (call $glide_state) (local.get $arg4))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_grAlphaCombine
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=20 (call $glide_state) (local.get $arg0))
    (i32.store offset=24 (call $glide_state) (local.get $arg1))
    (i32.store offset=28 (call $glide_state) (local.get $arg2))
    (i32.store offset=32 (call $glide_state) (local.get $arg3))
    (i32.store offset=36 (call $glide_state) (local.get $arg4))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_grConstantColorValue
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=40 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grDepthBufferMode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=44 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grDepthBufferFunction
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=48 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grDepthMask
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=52 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grAlphaBlendFunction
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=56 (call $glide_state) (local.get $arg0))
    (i32.store offset=60 (call $glide_state) (local.get $arg1))
    (i32.store offset=64 (call $glide_state) (local.get $arg2))
    (i32.store offset=68 (call $glide_state) (local.get $arg3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_grAlphaTestFunction
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=72 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grAlphaTestReferenceValue
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=76 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grChromakeyMode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=80 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grChromakeyValue
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=84 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grFogMode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=88 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grFogColorValue
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=92 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grCullMode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=96 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grSstOrigin
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=100 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grClipWindow
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=104 (call $glide_state) (local.get $arg0))
    (i32.store offset=108 (call $glide_state) (local.get $arg1))
    (i32.store offset=112 (call $glide_state) (local.get $arg2))
    (i32.store offset=116 (call $glide_state) (local.get $arg3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_grColorMask
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=120 (call $glide_state) (local.get $arg0))
    (i32.store offset=124 (call $glide_state) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grRenderBuffer
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=180 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grDepthBiasLevel
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=176 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grDitherMode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=208 (call $glide_state) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grGammaCorrectionValue
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=212 (call $glide_state) (local.get $arg0))
    (call $glide_gamma_rgb (local.get $arg0) (local.get $arg0) (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grHints
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (if (i32.gt_u (local.get $arg0) (i32.const 5)) (then (call $glide_fail)))
    (i32.store (i32.add (call $glide_state) (i32.add (i32.const 216) (i32.shl (local.get $arg0) (i32.const 2)))) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grTexClampMode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (call $glide_tmu_store (local.get $arg0) (i32.const 152) (local.get $arg1))
    (call $glide_tmu_store (local.get $arg0) (i32.const 156) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grTexFilterMode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (call $glide_tmu_store (local.get $arg0) (i32.const 160) (local.get $arg1))
    (call $glide_tmu_store (local.get $arg0) (i32.const 164) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grTexLodBiasValue
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (call $glide_tmu_store (local.get $arg0) (i32.const 172) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; grTexDetailControl(tmu, lodBias, detailScale, detailMax) -- Glide 2 and 3
  ;; alike. It only parameterises the DETAIL blend factor that grTexCombine can
  ;; select; that factor stays an explicit failure (the factor br_table in
  ;; $glide_ir_channel sends it to $glide_fail), so these values are real state
  ;; for it to read, not a substitute for it. SDK ranges: lodBias -32..31,
  ;; detailScale 0..7, detailMax 0.0..1.0; outside them is a guest bug and
  ;; fails loudly. Kept per TMU in the Glide extension block at +2448 (the
  ;; gap between TMU1's state, which ends at +2444, and +2560): lodBias,
  ;; detailScale, detailMax bits, 16 bytes a TMU. Dethkarz's default 3Dfx
  ;; renderer ('Vertigo 3Dfx (Glide 2).dll') calls it with 0, 4, 6, 1.0 right
  ;; after the driver dialog -- before this it was an unimplemented trap.
  (func $handle_grTexDetailControl
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $max f32)
    (call $glide_tmu (local.get $arg0))
    (local.set $max (f32.reinterpret_i32 (local.get $arg3)))
    (if (i32.or (i32.or (i32.lt_s (local.get $arg1) (i32.const -32)) (i32.gt_s (local.get $arg1) (i32.const 31)))
          (i32.or (i32.gt_u (local.get $arg2) (i32.const 7))
            (i32.eqz (i32.and (f32.ge (local.get $max) (f32.const 0)) (f32.le (local.get $max) (f32.const 1))))))
      (then (call $glide_fail)))
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $p (i32.add (call $glide3_ext)
      (i32.add (i32.const 2448) (i32.shl (local.get $arg0) (i32.const 4)))))
    (i32.store (local.get $p) (local.get $arg1))
    (i32.store offset=4 (local.get $p) (local.get $arg2))
    (i32.store offset=8 (local.get $p) (local.get $arg3))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Legacy utility mapping from pinned Glide2 sst1/glide/src/digutex.c.
  ;; Detail/trilinear factors retain the same explicit backend limitations as
  ;; grTexCombine; this entry point must not silently replace those factors.
  (func $handle_grTexCombineFunction
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $function i32) (local $factor i32) (local $invert i32)
    (call $glide_tmu (local.get $arg0))
    (if (i32.gt_u (local.get $arg1) (i32.const 10)) (then (call $glide_fail)))
    (if (i32.eq (local.get $arg1) (i32.const 1)) (then (local.set $function (i32.const 1))))
    (if (i32.eq (local.get $arg1) (i32.const 2)) (then (local.set $function (i32.const 3)) (local.set $factor (i32.const 8))))
    (if (i32.eq (local.get $arg1) (i32.const 3)) (then (local.set $function (i32.const 4)) (local.set $factor (i32.const 8))))
    (if (i32.eq (local.get $arg1) (i32.const 4)) (then (local.set $function (i32.const 3)) (local.set $factor (i32.const 1))))
    (if (i32.eq (local.get $arg1) (i32.const 5)) (then (local.set $function (i32.const 6)) (local.set $factor (i32.const 8))))
    (if (i32.eq (local.get $arg1) (i32.const 6)) (then (local.set $function (i32.const 7)) (local.set $factor (i32.const 12))))
    (if (i32.eq (local.get $arg1) (i32.const 7)) (then (local.set $function (i32.const 7)) (local.set $factor (i32.const 4))))
    (if (i32.eq (local.get $arg1) (i32.const 8)) (then (local.set $function (i32.const 7)) (local.set $factor (i32.const 13))))
    (if (i32.eq (local.get $arg1) (i32.const 9)) (then (local.set $function (i32.const 7)) (local.set $factor (i32.const 5))))
    (local.set $invert (i32.eq (local.get $arg1) (i32.const 10)))
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu_store (local.get $arg0) (i32.const 184) (local.get $function))
    (call $glide_tmu_store (local.get $arg0) (i32.const 188) (local.get $factor))
    (call $glide_tmu_store (local.get $arg0) (i32.const 192) (local.get $function))
    (call $glide_tmu_store (local.get $arg0) (i32.const 196) (local.get $factor))
    (call $glide_tmu_store (local.get $arg0) (i32.const 200) (local.get $invert))
    (call $glide_tmu_store (local.get $arg0) (i32.const 204) (local.get $invert))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; guColorCombineFunction(fnc) and guAlphaSource(mode): Glide2 cvg/glide/
  ;; src/gu.c presets, each a fixed grColorCombine / grAlphaCombine call.
  ;; Combine enums (glide.h): function ZERO 0, LOCAL 1, SCALE_OTHER 3,
  ;; SCALE_OTHER_ADD_LOCAL 4, SCALE_OTHER_ADD_LOCAL_ALPHA 5,
  ;; SCALE_OTHER_MINUS_LOCAL 6, BLEND 7; factor NONE 0, LOCAL 1, LOCAL_ALPHA 3,
  ;; TEXTURE_ALPHA 4, ONE 8; local ITERATED 0, CONSTANT/NONE 1; other
  ;; ITERATED 0, TEXTURE 1, CONSTANT/NONE 2.
  (func $glide_color_combine_set
      (param $function i32) (param $factor i32) (param $local i32) (param $other i32) (param $invert i32)
    (i32.store offset=0 (call $glide_state) (local.get $function))
    (i32.store offset=4 (call $glide_state) (local.get $factor))
    (i32.store offset=8 (call $glide_state) (local.get $local))
    (i32.store offset=12 (call $glide_state) (local.get $other))
    (i32.store offset=16 (call $glide_state) (local.get $invert)))

  (func $handle_guColorCombineFunction
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; ITRGB_DELTA0 (3) and TEXTURE_TIMES_ITRGB_DELTA0 (7) also switch the
    ;; iterated colour to flat (_grColorCombineDelta0Mode), which the backend
    ;; does not model.
    (if (i32.or (i32.or (i32.eq (local.get $arg0) (i32.const 3)) (i32.eq (local.get $arg0) (i32.const 7)))
                (i32.gt_u (local.get $arg0) (i32.const 16)))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (call $lock_acquire (global.get $GLIDE_STATE))
    (block $done
      (if (i32.eqz (local.get $arg0)) (then                              ;; ZERO
        (call $glide_color_combine_set (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 2) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 1)) (then                 ;; CCRGB
        (call $glide_color_combine_set (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 2) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 2)) (then                 ;; ITRGB
        (call $glide_color_combine_set (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 2) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 4)) (then                 ;; DECAL_TEXTURE
        (call $glide_color_combine_set (i32.const 3) (i32.const 8) (i32.const 1) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 5)) (then                 ;; TEXTURE_TIMES_CCRGB
        (call $glide_color_combine_set (i32.const 3) (i32.const 1) (i32.const 1) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 6)) (then                 ;; TEXTURE_TIMES_ITRGB
        (call $glide_color_combine_set (i32.const 3) (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 8)) (then                 ;; TEXTURE_TIMES_ITRGB_ADD_ALPHA
        (call $glide_color_combine_set (i32.const 5) (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 9)) (then                 ;; TEXTURE_TIMES_ALPHA
        (call $glide_color_combine_set (i32.const 3) (i32.const 3) (i32.const 1) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 10)) (then                ;; TEXTURE_TIMES_ALPHA_ADD_ITRGB
        (call $glide_color_combine_set (i32.const 4) (i32.const 3) (i32.const 0) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 11)) (then                ;; TEXTURE_ADD_ITRGB
        (call $glide_color_combine_set (i32.const 4) (i32.const 8) (i32.const 0) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 12)) (then                ;; TEXTURE_SUB_ITRGB
        (call $glide_color_combine_set (i32.const 6) (i32.const 8) (i32.const 0) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 13)) (then                ;; CCRGB_BLEND_ITRGB_ON_TEXALPHA
        (call $glide_color_combine_set (i32.const 7) (i32.const 4) (i32.const 1) (i32.const 0) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 14)) (then                ;; DIFF_SPEC_A
        (call $glide_color_combine_set (i32.const 4) (i32.const 3) (i32.const 0) (i32.const 1) (i32.const 0)) (br $done)))
      (if (i32.eq (local.get $arg0) (i32.const 15)) (then                ;; DIFF_SPEC_B
        (call $glide_color_combine_set (i32.const 5) (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 0)) (br $done)))
      ;; ONE (16): ZERO inverted.
      (call $glide_color_combine_set (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 2) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_guAlphaSource
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $function i32) (local $factor i32) (local $local i32) (local $other i32)
    (if (i32.gt_u (local.get $arg0) (i32.const 3)) (then (call $glide_fail)))
    ;; CC_ALPHA 0: LOCAL, NONE, CONSTANT, NONE.  ITERATED_ALPHA 1: LOCAL, NONE,
    ;; ITERATED, NONE.  TEXTURE_ALPHA 2: SCALE_OTHER, ONE, NONE, TEXTURE.
    ;; TEXTURE_ALPHA_TIMES_ITERATED_ALPHA 3: SCALE_OTHER, LOCAL, ITERATED, TEXTURE.
    (local.set $function (select (i32.const 1) (i32.const 3) (i32.lt_u (local.get $arg0) (i32.const 2))))
    (local.set $factor (select (i32.const 8) (i32.const 0) (i32.eq (local.get $arg0) (i32.const 2))))
    (if (i32.eq (local.get $arg0) (i32.const 3)) (then (local.set $factor (i32.const 1))))
    (local.set $local (select (i32.const 0) (i32.const 1)
      (i32.or (i32.eq (local.get $arg0) (i32.const 1)) (i32.eq (local.get $arg0) (i32.const 3)))))
    (local.set $other (select (i32.const 2) (i32.const 1) (i32.lt_u (local.get $arg0) (i32.const 2))))
    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=20 (call $glide_state) (local.get $function))
    (i32.store offset=24 (call $glide_state) (local.get $factor))
    (i32.store offset=28 (call $glide_state) (local.get $local))
    (i32.store offset=32 (call $glide_state) (local.get $other))
    (i32.store offset=36 (call $glide_state) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Glide2 gu.c uses float intermediates and normalizes the last entry to 255.
  (func $glide_fog_exp (param $density f32) (param $i i32) (result f32)
    (local $dp f32)
    (local.set $dp (f32.mul (local.get $density)
      (f32.div (f32.convert_i32_u (i32.shl (i32.const 8) (i32.shr_u (local.get $i) (i32.const 2))))
        (f32.convert_i32_u (i32.sub (i32.const 8) (i32.and (local.get $i) (i32.const 3)))))))
    (f32.sub (f32.const 1) (f32.demote_f64 (call $host_math_pow2
      (f64.mul (f64.promote_f32 (f32.neg (local.get $dp))) (f64.const 1.4426950408889634))))))

  (func $handle_guFogGenerateExp
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $density f32) (local $scale f32) (local $f f32)
    (call $glide_check_guest (local.get $arg0) (i32.const 64))
    (local.set $density (f32.reinterpret_i32 (local.get $arg1)))
    (local.set $scale (f32.div (f32.const 1) (call $glide_fog_exp (local.get $density) (i32.const 63))))
    (loop $entries
      (local.set $f (f32.mul (call $glide_fog_exp (local.get $density) (local.get $i)) (local.get $scale)))
      (call $gs8 (i32.add (local.get $arg0) (local.get $i))
        (i32.trunc_sat_f32_u (f32.mul (f32.const 255) (f32.max (f32.const 0) (f32.min (f32.const 1) (local.get $f))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $entries (i32.lt_u (local.get $i) (i32.const 64))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grTexCombine
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (call $glide_tmu_store (local.get $arg0) (i32.const 184) (local.get $arg1))
    (call $glide_tmu_store (local.get $arg0) (i32.const 188) (local.get $arg2))
    (call $glide_tmu_store (local.get $arg0) (i32.const 192) (local.get $arg3))
    (call $glide_tmu_store (local.get $arg0) (i32.const 196) (local.get $arg4))
    (call $glide_tmu_store (local.get $arg0) (i32.const 200) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (call $glide_tmu_store (local.get $arg0) (i32.const 204) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_grTexMipMapMode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (call $glide_tmu_store (local.get $arg0) (i32.const 168) (local.get $arg1))(call $glide_tmu_store (local.get $arg0) (i32.const 240) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grTexMinAddress
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grTexMaxAddress
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
     ;; Largest valid aligned texture start, not the last byte of RAM.
    ;; Glide2 CVG ditex.c returns total_mem-8; keep the advertised 8-byte
    ;; alignment shared by the canonical G2/G3 texture allocation ABI.
    (i32.store offset=0 (global.get $reg_base) (i32.const 4194296))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grTexCalcMemRequired
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $n i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $n (call $glide_tex_bytes (call $glide_lod (local.get $arg0)) (call $glide_lod (local.get $arg1)) (call $glide_aspect (local.get $arg2)) (local.get $arg3) (i32.const 3)))
    (i32.store offset=0 (global.get $reg_base) (i32.and (i32.add (local.get $n) (i32.const 7)) (i32.const -8)))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_grTexTextureMemRequired
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $n i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $p (call $glide_scratch))
    (call $glide_texinfo (local.get $p) (local.get $arg1))
    (local.set $n (call $glide_tex_bytes (i32.load offset=0 (local.get $p)) (i32.load offset=4 (local.get $p)) (i32.load offset=8 (local.get $p)) (i32.load offset=12 (local.get $p)) (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.and (i32.add (local.get $n) (i32.const 7)) (i32.const -8)))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grTexSource
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $q i32) (local $n i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (call $glide_texinfo (call $glide_scratch) (local.get $arg3))
    (local.set $q (call $glide_scratch))
    (local.set $n (call $glide_tex_bytes (i32.load offset=0 (local.get $q)) (i32.load offset=4 (local.get $q)) (i32.load offset=8 (local.get $q)) (i32.load offset=12 (local.get $q)) (local.get $arg2)))
    (if (i32.or (i32.ne (i32.and (local.get $arg1) (i32.const 7)) (i32.const 0)) (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg1)) (i64.extend_i32_u (local.get $n))) (i64.const 4194304))) (then (call $glide_fail)))
    (call $glide_tmu_store (local.get $arg0) (i32.const 128) (local.get $arg1))(call $glide_tmu_store (local.get $arg0) (i32.const 148) (local.get $arg2))
    (call $glide_tmu_store (local.get $arg0) (i32.const 132) (i32.load offset=0 (local.get $q)))
    (call $glide_tmu_store (local.get $arg0) (i32.const 136) (i32.load offset=4 (local.get $q)))
    (call $glide_tmu_store (local.get $arg0) (i32.const 140) (i32.load offset=8 (local.get $q)))
    (call $glide_tmu_store (local.get $arg0) (i32.const 144) (i32.load offset=12 (local.get $q)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_grTexDownloadMipMap
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $q i32) (local $n i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (call $glide_texinfo (call $glide_scratch) (local.get $arg3))
    (local.set $q (call $glide_scratch))
    (local.set $n (call $glide_tex_bytes (i32.load offset=0 (local.get $q)) (i32.load offset=4 (local.get $q)) (i32.load offset=8 (local.get $q)) (i32.load offset=12 (local.get $q)) (local.get $arg2)))
    (if (i32.or (i32.ne (i32.and (local.get $arg1) (i32.const 7)) (i32.const 0)) (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg1)) (i64.extend_i32_u (local.get $n))) (i64.const 4194304))) (then (call $glide_fail)))
    (call $glide_tmu_write (call $glide_pb) (local.get $arg0) (local.get $arg1)
      (i32.load offset=16 (local.get $q)) (local.get $n))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; grTexDownloadMipMapLevelPartial(tmu, startAddress, thisLod, largeLod,
  ;; aspect, format, evenOdd, data, t, max_t): Glide2 cvg/glide/src/gtexdl.c.
  ;; Rows t..max_t of level thisLod of the mipmap whose largest level sits at
  ;; startAddress; data holds those rows only, packed. A level outside the
  ;; evenOdd mask is skipped. Texture RAM keeps a mipmap's levels packed from
  ;; largeLod down (grTexDownloadMipMap is these calls in a loop), so the level
  ;; starts after the bytes of every larger level the mask selects. The upload
  ;; record states that level's layout when the whole level arrives; for a
  ;; strict subset of rows it states the single 1x1 LOD, which bounds nothing
  ;; but the minimum length, because the backend only validates the copy
  ;; against the layout and the record's address and length carry the rows.
  (func $glide_download_level
      (param $tmu i32) (param $start i32) (param $lod i32) (param $large i32)
      (param $aspect i32) (param $format i32) (param $mask i32) (param $data i32)
      (param $t i32) (param $max_t i32)
    (local $w i32) (local $h i32) (local $row i32) (local $addr i32) (local $n i32) (local $p i32)
    (call $glide_tmu (local.get $tmu))
    ;; Glide3 numbers LODs the other way round; only the Glide2 ABI is here.
    (if (i32.eq (call $glide_api_version) (i32.const 3)) (then (call $glide_fail)))
    (if (i32.or (i32.lt_u (local.get $lod) (local.get $large))
          (i32.or (i32.gt_u (local.get $lod) (i32.const 8))
            (i32.or (i32.gt_u (local.get $aspect) (i32.const 6))
              (i32.or (i32.eqz (local.get $mask)) (i32.gt_u (local.get $mask) (i32.const 3))))))
      (then (call $glide_fail)))
    (if (i32.eqz (i32.and (local.get $mask)
          (i32.shl (i32.const 1) (i32.and (local.get $lod) (i32.const 1)))))
      (then (return)))
    (local.set $w (i32.shr_u (i32.const 256) (local.get $lod)))
    (local.set $h (local.get $w))
    (if (i32.lt_u (local.get $aspect) (i32.const 3))
      (then (local.set $h (i32.shr_u (local.get $h) (i32.sub (i32.const 3) (local.get $aspect))))))
    (if (i32.gt_u (local.get $aspect) (i32.const 3))
      (then (local.set $w (i32.shr_u (local.get $w) (i32.sub (local.get $aspect) (i32.const 3))))))
    (if (i32.eqz (local.get $w)) (then (local.set $w (i32.const 1))))
    (if (i32.eqz (local.get $h)) (then (local.set $h (i32.const 1))))
    (if (i32.or (i32.gt_s (local.get $t) (local.get $max_t))
          (i32.or (i32.lt_s (local.get $t) (i32.const 0)) (i32.ge_s (local.get $max_t) (local.get $h))))
      (then (call $glide_fail)))
    (local.set $row (i32.shl (local.get $w) (i32.ge_u (local.get $format) (i32.const 8))))
    (local.set $addr (local.get $start))
    (if (i32.gt_u (local.get $lod) (local.get $large))
      (then (local.set $addr (i32.add (local.get $addr)
        (call $glide_tex_bytes (i32.sub (local.get $lod) (i32.const 1)) (local.get $large)
          (local.get $aspect) (local.get $format) (local.get $mask))))))
    (local.set $addr (i32.add (local.get $addr) (i32.mul (local.get $t) (local.get $row))))
    (local.set $n (i32.mul (i32.add (i32.sub (local.get $max_t) (local.get $t)) (i32.const 1)) (local.get $row)))
    (if (i32.or (i32.ne (i32.and (local.get $start) (i32.const 7)) (i32.const 0))
          (i64.gt_u (i64.add (i64.extend_i32_u (local.get $addr)) (i64.extend_i32_u (local.get $n))) (i64.const 4194304)))
      (then (call $glide_fail)))
    (call $glide_tmu_write (call $glide_pb) (local.get $tmu) (local.get $addr) (local.get $data) (local.get $n)))

  (func $handle_grTexDownloadMipMapLevel
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32) (local $h i32) (local $aspect i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $aspect (local.get $arg4))
    ;; The whole level: rows 0 .. height-1 (glide_download_level validates).
    (local.set $h (i32.shr_u (i32.const 256) (i32.and (local.get $arg2) (i32.const 15))))
    (if (i32.lt_u (local.get $aspect) (i32.const 3))
      (then (local.set $h (i32.shr_u (local.get $h) (i32.sub (i32.const 3) (local.get $aspect))))))
    (if (i32.eqz (local.get $h)) (then (local.set $h (i32.const 1))))
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_download_level (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $aspect)
      (call $gl32 (i32.add (local.get $esp) (i32.const 24)))   ;; format
      (call $gl32 (i32.add (local.get $esp) (i32.const 28)))   ;; evenOdd
      (call $gl32 (i32.add (local.get $esp) (i32.const 32)))   ;; data
      (i32.const 0) (i32.sub (local.get $h) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  (func $handle_grTexDownloadMipMapLevelPartial
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_download_level (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4)
      (call $gl32 (i32.add (local.get $esp) (i32.const 24)))   ;; format
      (call $gl32 (i32.add (local.get $esp) (i32.const 28)))   ;; evenOdd
      (call $gl32 (i32.add (local.get $esp) (i32.const 32)))   ;; data
      (call $gl32 (i32.add (local.get $esp) (i32.const 36)))   ;; t
      (call $gl32 (i32.add (local.get $esp) (i32.const 40))))  ;; max_t
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44))))

  (func $handle_grTexDownloadTable
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_tmu (local.get $arg0))
    (if (i32.ne (local.get $arg1) (i32.const 2)) (then (call $crash_unimplemented (local.get $name_ptr))))
    (call $glide_copy_guest (i32.add (call $glide3_ext) (i32.const 128)) (local.get $arg2) (i32.const 1024))
    (call $glide_palette_changed)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grFogTable
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pb i32) (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $pb (call $glide_pb))
    (call $glide_copy_guest (elem-addr GlideGps fog (local.get $pb) (i32.const 0)) (local.get $arg0) (i32.const 64))
    (call $glide_fog_upload (local.get $pb))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grDrawTriangle
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_check_guest (local.get $arg1) (i32.const 20))
    (call $glide_triangle (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; grDrawPolygonVertexList(int nVertices, const GrVertex vlist[]): Glide 2
  ;; draws a convex polygon as a triangle fan from vlist[0]; fewer than three
  ;; vertices draw nothing. The array stride is the SDK's 60-byte GrVertex
  ;; (myth_tfl.exe fills its list with `add eax, 0x3c`). Myth's 3dfx renderer
  ;; resolves this by name and abandons Glide entirely when it is missing.
  (func $handle_grDrawPolygonVertexList
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (if (i32.ge_s (local.get $arg0) (i32.const 3)) (then
      ;; The whole list must be addressable: no wrap past 4 GiB.
      (if (i64.gt_u (i64.mul (i64.extend_i32_u (local.get $arg0)) (i64.const 60)) (i64.const 0xFFFFFFFF))
        (then (call $glide_fail)))
      (call $glide_check_guest (local.get $arg1) (i32.mul (local.get $arg0) (i32.const 60)))
      (local.set $i (i32.const 1))
      (loop $fan
        (call $glide_triangle (local.get $arg1)
          (i32.add (local.get $arg1) (i32.mul (local.get $i) (i32.const 60)))
          (i32.add (local.get $arg1) (i32.mul (i32.add (local.get $i) (i32.const 1)) (i32.const 60))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $fan (i32.lt_s (i32.add (local.get $i) (i32.const 1)) (local.get $arg0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grBufferClear
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_clear (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grBufferSwap
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_swap)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; grBufferSwap: back becomes front (double-buffered) and the front is
  ;; presented when the board is active; otherwise it waits for activation.
  (func $glide_swap
    (local $pb i32) (local $t i32)
    (local.set $pb (call $glide_pb))
    (call $glide_close_draw (local.get $pb))
    (if (i32.eqz (load.field GlideGps single (local.get $pb))) (then
      (local.set $t (i32.load (elem-addr GlideGps color (local.get $pb) (i32.const 0))))
      (i32.store (elem-addr GlideGps color (local.get $pb) (i32.const 0))
        (i32.load (elem-addr GlideGps color (local.get $pb) (i32.const 1))))
      (i32.store (elem-addr GlideGps color (local.get $pb) (i32.const 1)) (local.get $t))
      (store.field GlideGps pipe_valid (local.get $pb) (i32.const 0))))
    (if (i32.load offset=244 (call $glide_state))
      (then (call $glide_present (local.get $pb)))
      (else (store.field GlideGps front_dirty (local.get $pb) (i32.const 1))))
    (drop (call $glide_kick (local.get $pb) (global.get $GPS_KICK_ASYNC))))

  ;; grBufferClear(color, alpha, depth) on the buffer s45 names, inside the
  ;; clip window, honoring the color/alpha/depth write masks.
  (func $glide_clear (param $color i32) (param $alpha i32) (param $depth i32)
    (local $pb i32) (local $s i32) (local $p i32) (local $hgt i32) (local $mask i32)
    (local $top i32) (local $bottom i32) (local $right i32)
    (local.set $pb (call $glide_pb))
    (local.set $s (call $glide_state))
    (local.set $hgt (load.field GlideGps height (local.get $pb)))
    (call $glide_target (local.get $pb) (i32.load offset=180 (local.get $s)))
    (local.set $mask (i32.or
      (select (i32.const 1) (i32.const 0) (i32.or (i32.ne (i32.load offset=120 (local.get $s)) (i32.const 0))
        (i32.ne (i32.load offset=124 (local.get $s)) (i32.const 0))))
      (select (i32.const 2) (i32.const 0) (i32.ne (i32.load offset=52 (local.get $s)) (i32.const 0)))))
    (if (i32.load offset=100 (local.get $s))
      (then
        (local.set $top (i32.sub (local.get $hgt) (i32.load offset=116 (local.get $s))))
        (local.set $bottom (i32.sub (local.get $hgt) (i32.load offset=108 (local.get $s)))))
      (else
        (local.set $top (i32.load offset=108 (local.get $s)))
        (local.set $bottom (i32.load offset=116 (local.get $s)))))
    (local.set $right (i32.load offset=112 (local.get $s)))
    (if (i32.lt_s (local.get $right) (i32.load offset=104 (local.get $s)))
      (then (local.set $right (i32.load offset=104 (local.get $s)))))
    (if (i32.lt_s (local.get $bottom) (local.get $top)) (then (local.set $bottom (local.get $top))))
    (local.set $p (call $glide_begin (local.get $pb) (global.get $GPS_OP_CLEAR) (size-of GpsClear)))
    (store.field GpsClear mask (local.get $p) (local.get $mask))
    (store.field GpsClear colormask (local.get $p) (i32.or
      (select (i32.const 7) (i32.const 0) (i32.ne (i32.load offset=120 (local.get $s)) (i32.const 0)))
      (select (i32.const 8) (i32.const 0) (i32.ne (i32.load offset=124 (local.get $s)) (i32.const 0)))))
    (store.field GpsClear pad (local.get $p) (i32.const 0))
    (store.field GpsClear rgba (local.get $p)
      (i32.or (i32.and (call $glide_rgba (local.get $pb) (local.get $color)) (i32.const 0x00FFFFFF))
        (i32.shl (i32.and (local.get $alpha) (i32.const 255)) (i32.const 24))))
    (store.field GpsClear z (local.get $p)
      (f32.demote_f64 (f64.min (f64.const 1)
        (f64.div (f64.convert_i32_u (local.get $depth)) (f64.const 65535)))))
    (store.field GpsClear stencil (local.get $p) (i32.const 0))
    (store.field GpsClear left (local.get $p) (i32.load offset=104 (local.get $s)))
    (store.field GpsClear top (local.get $p) (local.get $top))
    (store.field GpsClear right (local.get $p) (local.get $right))
    (store.field GpsClear bottom (local.get $p) (local.get $bottom))
    (drop (call $glide_end (local.get $p)))
    (if (i32.eqz (i32.load offset=180 (local.get $s)))
      (then (store.field GlideGps front_dirty (local.get $pb) (i32.const 1)))))

  (func $handle_grLfbLock
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $q i32) (local $r i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (block $invalid
      (br_if $invalid (i32.load offset=48 (global.get $GLIDE_STATE)))
      (br_if $invalid (i32.gt_u (i32.and (local.get $arg0) (i32.const -17)) (i32.const 1)))
      (br_if $invalid (i32.and (i32.ne (local.get $arg2) (i32.const 0)) (i32.ne (local.get $arg2) (i32.const 255))))
      (if (local.get $arg4) (then (call $crash_unimplemented (local.get $name_ptr))))
      (local.set $q (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
      (br_if $invalid (i32.or (i32.eqz (local.get $q))
        (i32.gt_u (local.get $q) (i32.const 4294967275))))
      ;; info->size is not checked. The SDK says to set it to
      ;; sizeof(GrLfbInfo_t), but the retail drivers only test it with
      ;; GR_CHECK_F, which exists in debug builds alone. Die by the Sword's
      ;; rl3dfx.dll passes a GrLfbInfo_t straight off its stack with size
      ;; never written, and gives up drawing after ten failed locks, so
      ;; rejecting a stale size left its logos and menu black.
      (local.set $p (call $glide_lfb_stage (local.get $arg1) (local.get $arg3)
        (i32.and (local.get $arg0) (i32.const 1))
        (i32.load offset=24 (global.get $GLIDE_STATE)) (i32.load offset=28 (global.get $GLIDE_STATE))))
      (br_if $invalid (i32.eqz (local.get $p)))
      (call $gs32 (i32.add (local.get $q) (i32.const 4)) (i32.add (i32.load offset=40 (global.get $GLIDE_STATE)) (i32.const 20)))
      (call $gs32 (i32.add (local.get $q) (i32.const 8)) (i32.mul (i32.load offset=24 (global.get $GLIDE_STATE)) (i32.const 2)))
      (call $gs32 (i32.add (local.get $q) (i32.const 12)) (i32.const 0))
      (call $gs32 (i32.add (local.get $q) (i32.const 16)) (local.get $arg3))
      (i32.store offset=48 (global.get $GLIDE_STATE) (i32.add (i32.and (local.get $arg0) (i32.const 1)) (i32.const 1)))
      (i32.store offset=52 (global.get $GLIDE_STATE) (local.get $arg1))
      (local.set $r (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (local.get $r))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_grLfbUnlock
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $r i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (block $invalid
      (br_if $invalid (i32.ne (i32.load offset=48 (global.get $GLIDE_STATE)) (i32.add (i32.and (local.get $arg0) (i32.const 1)) (i32.const 1))))
      (br_if $invalid (i32.ne (i32.load offset=52 (global.get $GLIDE_STATE)) (local.get $arg1)))
      (local.set $r (i32.const 1))
      (if (i32.eq (i32.load offset=48 (global.get $GLIDE_STATE)) (i32.const 2)) (then
          (local.set $r (call $glide_lfb_publish (call $g2w (i32.load offset=40 (global.get $GLIDE_STATE)))))))
      (i32.store offset=48 (global.get $GLIDE_STATE) (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (local.get $r))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grLfbReadRegion
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $q i32) (local $n i32) (local $r i32)
    (local $w i32) (local $h i32) (local $i i32) (local $j i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (block $invalid
      (br_if $invalid (i32.load offset=48 (global.get $GLIDE_STATE)))
      (local.set $w (local.get $arg3)) (local.set $h (local.get $arg4))
      (local.set $n (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))) (local.set $q (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
      (br_if $invalid (i32.eqz (local.get $q)))
      (br_if $invalid (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg1)) (i64.extend_i32_u (local.get $w))) (i64.extend_i32_u (i32.load offset=24 (global.get $GLIDE_STATE)))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg2)) (i64.extend_i32_u (local.get $h))) (i64.extend_i32_u (i32.load offset=28 (global.get $GLIDE_STATE)))))
      (br_if $invalid (i32.lt_s (local.get $n) (i32.mul (local.get $w) (i32.const 2))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $q)) (i64.mul (i64.extend_i32_u (local.get $n)) (i64.extend_i32_u (local.get $h)))) (i64.const 4294967295)))
      (local.set $p (call $glide_lfb_stage (local.get $arg0) (i32.const 0)
        (i32.const 2) (local.get $w) (local.get $h)))
      (br_if $invalid (i32.eqz (local.get $p)))
      (local.set $p (i32.add (local.get $p) (i32.add (i32.const 20) (i32.mul (i32.add (i32.mul (local.get $arg2) (i32.load offset=24 (global.get $GLIDE_STATE))) (local.get $arg1)) (i32.const 2)))))
      (loop $rows
        (local.set $j (i32.const 0))
        (loop $pixels
          (call $gs8 (i32.add (local.get $q) (local.get $j)) (i32.load8_u (i32.add (local.get $p) (local.get $j))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $pixels (i32.lt_u (local.get $j) (i32.mul (local.get $w) (i32.const 2)))))
        (local.set $p (i32.add (local.get $p) (i32.mul (i32.load offset=24 (global.get $GLIDE_STATE)) (i32.const 2))))
        (local.set $q (i32.add (local.get $q) (local.get $n)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $i) (local.get $h))))
      (local.set $r (i32.const 1))
      )
    (i32.store offset=0 (global.get $reg_base) (local.get $r))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_grLfbWriteRegion
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $q i32) (local $n i32) (local $r i32)
    (local $w i32) (local $h i32) (local $i i32) (local $j i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (block $invalid
      (br_if $invalid (i32.load offset=48 (global.get $GLIDE_STATE)))
      (local.set $w (local.get $arg4)) (local.set $h (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
      (local.set $n (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))) (local.set $q (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
      (br_if $invalid (i32.eqz (local.get $q)))
      (br_if $invalid (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg1)) (i64.extend_i32_u (local.get $w))) (i64.extend_i32_u (i32.load offset=24 (global.get $GLIDE_STATE)))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg2)) (i64.extend_i32_u (local.get $h))) (i64.extend_i32_u (i32.load offset=28 (global.get $GLIDE_STATE)))))
      (br_if $invalid (i32.lt_s (local.get $n) (i32.mul (local.get $w) (i32.const 2))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $q)) (i64.mul (i64.extend_i32_u (local.get $n)) (i64.extend_i32_u (local.get $h)))) (i64.const 4294967295)))
      (if (i32.ne (local.get $arg3) (i32.const 0)) (then (call $crash_unimplemented (local.get $name_ptr))))
      (local.set $p (call $glide_lfb_stage (local.get $arg0) (i32.const 0)
        (i32.const 3) (local.get $w) (local.get $h)))
      (br_if $invalid (i32.eqz (local.get $p)))
      (local.set $p (i32.add (local.get $p) (i32.add (i32.const 20) (i32.mul (i32.add (i32.mul (local.get $arg2) (i32.load offset=24 (global.get $GLIDE_STATE))) (local.get $arg1)) (i32.const 2)))))
      (loop $rows
        (local.set $j (i32.const 0))
        (loop $pixels
          (i32.store8 (i32.add (local.get $p) (local.get $j)) (call $gl8 (i32.add (local.get $q) (local.get $j))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $pixels (i32.lt_u (local.get $j) (i32.mul (local.get $w) (i32.const 2)))))
        (local.set $p (i32.add (local.get $p) (i32.mul (i32.load offset=24 (global.get $GLIDE_STATE)) (i32.const 2))))
        (local.set $q (i32.add (local.get $q) (local.get $n)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $i) (local.get $h))))
      (local.set $r (i32.const 1))
      (local.set $r (call $glide_lfb_publish (call $g2w (i32.load offset=40 (global.get $GLIDE_STATE)))))
      )
    (i32.store offset=0 (global.get $reg_base) (local.get $r))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; grAADrawLine(a, b): the backend's native one-pixel line through the two
  ;; vertices, under the app's own blend state -- as grAADrawTriangle's edges
  ;; below; Glide's per-pixel coverage alpha is not computed. Dethkarz's 3Dfx
  ;; renderer draws with it as soon as its race starts.
  (func $handle_grAADrawLine
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_check_guest (local.get $arg0) (i32.const 20))
    (call $glide_check_guest (local.get $arg1) (i32.const 20))
    (call $glide_small_primitive (i32.const 11) (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; grAADrawTriangle(a, b, c, ab_antialias, bc_antialias, ca_antialias): the
  ;; triangle, then each flagged edge as the backend's native one-pixel line
  ;; through the same vertices. Glide antialiases by drawing edge pixels with
  ;; coverage in alpha under the app's own SRC_ALPHA blend; here the edge lines
  ;; carry the vertices' own alpha under that same blend state, and per-pixel
  ;; coverage is not computed. Dethkarz's 3Dfx renderer draws its race with it.
  (func $handle_grAADrawTriangle
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sp i32) (local $ca i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    ;; Only five args reach a handler; the sixth (ca_antialias) is on the stack.
    (local.set $ca (call $gl32 (i32.add (local.get $sp) (i32.const 24))))
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_check_guest (local.get $arg0) (i32.const 20))
    (call $glide_check_guest (local.get $arg1) (i32.const 20))
    (call $glide_check_guest (local.get $arg2) (i32.const 20))
    (call $glide_triangle (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (if (local.get $arg3) (then (call $glide_small_primitive (i32.const 11) (local.get $arg0) (local.get $arg1))))
    (if (local.get $arg4) (then (call $glide_small_primitive (i32.const 11) (local.get $arg1) (local.get $arg2))))
    (if (local.get $ca) (then (call $glide_small_primitive (i32.const 11) (local.get $arg2) (local.get $arg0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; grSstPerfStats(GrSstPerfStats_t *): {pixelsIn, chromaFail, zFuncFail,
  ;; aFuncFail, pixelsOut}, since the last grSstResetPerfStats. pixelsIn and
  ;; pixelsOut are the rasterised area of every Glide 2 triangle drawn
  ;; ($glide_count_pixels, at extension +2480/+2484). The backend renders on the
  ;; host GPU and reports no per-fragment test results, so the three fail
  ;; counters are 0 and pixelsOut equals pixelsIn; lines and points are not
  ;; counted. Dethkarz's renderer reads and resets these once per frame.
  (func $handle_grSstPerfStats
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32)
    (call $glide_check_guest (local.get $arg0) (i32.const 20))
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $e (call $glide3_ext))
    (call $gs32 (local.get $arg0) (i32.load offset=2480 (local.get $e)))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 4)) (i32.const 0))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 8)) (i32.const 0))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 12)) (i32.const 0))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 16)) (i32.load offset=2484 (local.get $e)))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grSstResetPerfStats
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $e (call $glide3_ext))
    (i64.store offset=2480 (local.get $e) (i64.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grDrawLine
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_small_primitive (i32.const 11) (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grDrawPoint
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_small_primitive (i32.const 12) (local.get $arg0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Glide3 h3/glide3/src/glide.h, distrip.c and diget.c, same pinned revision.
  ;; Heap extension (8192 bytes): coordinate/color mode0/4, viewport8..20,
  ;; depth range24/28, twelve {offset,enabled} layout entries32..127,
  ;; retained palette128..1151, strings1152..1407, array vertices1536..1715,
  ;; continuation count1720/topology1724, metrics2048..2334, TMU1state2368..2447,
  ;; grTexDetailControl per TMU2448..2479, grSstPerfStats pixelsIn2480/Out2484,
  ;; clip polygons2560..4479, projected triangle4480..4659, direct raw vertices
  ;; 4800..4979. Never grow the packed static region.
  (func $glide_api_version (export "glide_api_version") (result i32)
    (i32.load offset=112 (global.get $GLIDE_STATE)))

  (func $glide3_ext (result i32)
    (local $p i32)
    (local.set $p (i32.load offset=116 (global.get $GLIDE_STATE)))
    (if (i32.eqz (local.get $p)) (then
      (local.set $p (call $gl_alloc_affine (i32.const 8192)))
      (if (i32.eqz (local.get $p)) (then (call $glide_fail)))
      (memory.fill (call $g2w (local.get $p)) (i32.const 0) (i32.const 8192))
      (f32.store offset=28 (call $g2w (local.get $p)) (f32.const 1))
      (i32.atomic.store offset=116 (global.get $GLIDE_STATE) (local.get $p))))
    (call $g2w (local.get $p)))

  (func $glide_lod (param $x i32) (result i32)
    (if (result i32) (i32.eq (call $glide_api_version) (i32.const 3))
      (then (i32.sub (i32.const 8) (local.get $x))) (else (local.get $x))))
  (func $glide_aspect (param $x i32) (result i32)
    (if (result i32) (i32.eq (call $glide_api_version) (i32.const 3))
      (then (i32.sub (i32.const 3) (local.get $x))) (else (local.get $x))))
  (func $glide_texinfo (param $dst i32) (param $guest i32)
    (call $glide_copy_guest (local.get $dst) (local.get $guest) (i32.const 20))
    (i32.store (local.get $dst) (call $glide_lod (i32.load (local.get $dst))))
    (i32.store offset=4 (local.get $dst) (call $glide_lod (i32.load offset=4 (local.get $dst))))
    (i32.store offset=8 (local.get $dst) (call $glide_aspect (i32.load offset=8 (local.get $dst)))))

  ;; Layout slots XY,Z,W,Q,FOG,A,RGB,PARGB,ST0,ST1,Q0,Q1. Q is already
  ;; reciprocal W in window space. Missing parameters must not read guest
  ;; storage at all: many real games leave inactive fields uninitialized.
  (func $glide3_slot (param $param i32) (result i32)
    (if (i32.le_u (i32.sub (local.get $param) (i32.const 1)) (i32.const 4))
      (then (return (i32.sub (local.get $param) (i32.const 1)))))
    (if (i32.eq (local.get $param) (i32.const 16)) (then (return (i32.const 5))))
    (if (i32.eq (local.get $param) (i32.const 32)) (then (return (i32.const 6))))
    (if (i32.eq (local.get $param) (i32.const 48)) (then (return (i32.const 7))))
    (if (i32.le_u (i32.sub (local.get $param) (i32.const 64)) (i32.const 1))
      (then (return (i32.sub (local.get $param) (i32.const 56)))))
    (if (i32.le_u (i32.sub (local.get $param) (i32.const 80)) (i32.const 1))
      (then (return (i32.sub (local.get $param) (i32.const 70)))))
    (call $glide_fail) (i32.const 0))
  (func $glide3_field (param $guest i32) (param $slot i32) (param $component i32)
      (param $default f32) (result f32)
    (local $p i32)
    (local.set $p (i32.add (call $glide3_ext) (i32.add (i32.const 32) (i32.shl (local.get $slot) (i32.const 3)))))
    (if (result f32) (i32.load offset=4 (local.get $p))
      (then (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $guest)
        (i32.add (i32.load (local.get $p)) (local.get $component))))))
      (else (local.get $default))))

  ;; Match the framebuffer combine expressions: selectors/factors only
  ;; consume textures when the selected function actually uses them.
  (func $glide3_fbi_texture (param $p i32) (result i32)
    (local $fn i32) (local $factor i32) (local $other i32)
    (local.set $fn (i32.load (local.get $p)))
    (if (i32.le_u (local.get $fn) (i32.const 2)) (then (return (i32.const 0))))
    (local.set $factor (i32.load offset=4 (local.get $p)))
    (if (i32.eqz (local.get $factor)) (then (return (i32.const 0))))
    (local.set $other (i32.eq (i32.load offset=12 (local.get $p)) (i32.const 1)))
    (if (i32.and (i32.le_u (local.get $fn) (i32.const 8)) (local.get $other))
      (then (return (i32.const 1))))
    (if (i32.or
      (i32.le_u (i32.sub (local.get $factor) (i32.const 4)) (i32.const 1))
      (i32.le_u (i32.sub (local.get $factor) (i32.const 12)) (i32.const 1)))
      (then (return (i32.const 1))))
    (i32.and (local.get $other) (i32.or
      (i32.eq (local.get $factor) (i32.const 2)) (i32.eq (local.get $factor) (i32.const 10)))))

  (func $glide3_tmu_local (param $p i32) (result i32)
    (local $fn i32) (local $factor i32)
    (local.set $fn (i32.load (local.get $p)))
    (local.set $factor (i32.load offset=4 (local.get $p)))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 1))
      (i32.or (i32.eq (local.get $fn) (i32.const 2)) (i32.ge_u (local.get $fn) (i32.const 4))))
      (then (return (i32.const 1))))
    (i32.and (i32.eq (local.get $fn) (i32.const 3))
      (i32.or (i32.eq (i32.and (local.get $factor) (i32.const -9)) (i32.const 1))
        (i32.eq (i32.and (local.get $factor) (i32.const -9)) (i32.const 3)))))

  (func $glide3_tmu_other (param $p i32) (result i32)
    (local $fn i32) (local $factor i32)
    (local.set $fn (i32.load (local.get $p)))
    (local.set $factor (i32.load offset=4 (local.get $p)))
    (if (i32.and (i32.le_u (i32.sub (local.get $fn) (i32.const 3)) (i32.const 5))
      (i32.ne (local.get $factor) (i32.const 0))) (then (return (i32.const 1))))
    (i32.and (i32.or (i32.eq (local.get $fn) (i32.const 9)) (i32.eq (local.get $fn) (i32.const 16)))
      (i32.eq (i32.and (local.get $factor) (i32.const -9)) (i32.const 2))))

  (func $glide3_texture_mask (result i32)
    (local $p i32) (local $mask i32)
    (local.set $p (call $glide_state))
    ;; Chroma compares RGB OTHER before the combine function, so a LOCAL
    ;; framebuffer result can still require texture samples for rejection.
    (if (i32.eqz (i32.or
      (i32.or (call $glide3_fbi_texture (local.get $p))
        (call $glide3_fbi_texture (i32.add (local.get $p) (i32.const 20))))
      (i32.and (i32.ne (i32.load offset=80 (local.get $p)) (i32.const 0))
        (i32.eq (i32.load offset=12 (local.get $p)) (i32.const 1)))))
      (then (return (i32.const 0))))
    (if (i32.or (call $glide3_tmu_local (i32.add (local.get $p) (i32.const 184)))
      (call $glide3_tmu_local (i32.add (local.get $p) (i32.const 192))))
      (then (local.set $mask (i32.const 1))))
    (if (i32.or (call $glide3_tmu_other (i32.add (local.get $p) (i32.const 184)))
      (call $glide3_tmu_other (i32.add (local.get $p) (i32.const 192)))) (then
      (local.set $p (call $glide3_tmu1))
      (if (i32.or (call $glide3_tmu_local (i32.add (local.get $p) (i32.const 48)))
        (call $glide3_tmu_local (i32.add (local.get $p) (i32.const 56))))
        (then (local.set $mask (i32.or (local.get $mask) (i32.const 2)))))))
    (local.get $mask))

  ;; Original Hitman assets contain quiet NaN UVs, and the SDK forwards
  ;; them without rejecting the draw. NaN texel selection is unspecified;
  ;; use zero deterministically for S/T only, preserving geometry and all
  ;; finite components. This is not a claim of bit-exact H3 NaN sampling.
  ;; Infinity and non-finite geometry/Q/color retain their existing checks.
  (func $glide3_texcoord_field (param $guest i32) (param $slot i32)
      (param $offset i32) (result f32)
    (local $value f32)
    (local.set $value (call $glide3_field (local.get $guest)
      (local.get $slot) (local.get $offset) (f32.const 0)))
    (if (result f32) (f32.ne (local.get $value) (local.get $value))
      (then (f32.const 0)) (else (local.get $value))))

  (func $glide3_vertex (param $dst i32) (param $guest i32)
    (local $e i32) (local $c i32) (local $i i32) (local $mask i32) (local $q f32) (local $default f32)
    (local.set $e (call $glide3_ext))
    (call $glide_check_guest (local.get $guest) (i32.const 8))
    (if (i32.eqz (i32.load offset=36 (local.get $e))) (then (call $glide_fail)))
    (memory.fill (local.get $dst) (i32.const 0) (i32.const 60))
    (local.set $default (if (result f32) (i32.load (local.get $e))
      (then (f32.const 1)) (else (f32.const 255))))
    (if (i32.load (local.get $e)) (then
      (f32.store offset=8 (local.get $dst)
        (call $glide3_field (local.get $guest) (i32.const 2) (i32.const 0) (f32.const 1)))))
    (i32.store (local.get $dst) (call $gl32 (local.get $guest)))
    (i32.store offset=4 (local.get $dst) (call $gl32 (i32.add (local.get $guest) (i32.const 4))))
    (f32.store offset=24 (local.get $dst) (call $glide3_field (local.get $guest) (i32.const 1) (i32.const 0) (f32.const 0)))
    (local.set $q (call $glide3_field (local.get $guest) (i32.const 3) (i32.const 0) (f32.const 1)))
    (f32.store offset=32 (local.get $dst) (local.get $q))
    (if (i32.and (i32.ne (i32.load offset=4 (local.get $e)) (i32.const 0))
      (i32.ne (i32.load offset=92 (local.get $e)) (i32.const 0)))
      (then
        (local.set $c (call $gl32 (i32.add (local.get $guest) (i32.load offset=88 (local.get $e)))))
        (f32.store offset=12 (local.get $dst) (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c) (i32.const 16)) (i32.const 255))))
        (f32.store offset=16 (local.get $dst) (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c) (i32.const 8)) (i32.const 255))))
        (f32.store offset=20 (local.get $dst) (f32.convert_i32_u (i32.and (local.get $c) (i32.const 255))))
        (f32.store offset=28 (local.get $dst) (f32.convert_i32_u (i32.shr_u (local.get $c) (i32.const 24)))))
      (else
        (f32.store offset=12 (local.get $dst) (call $glide3_field (local.get $guest) (i32.const 6) (i32.const 0) (local.get $default)))
        (f32.store offset=16 (local.get $dst) (call $glide3_field (local.get $guest) (i32.const 6) (i32.const 4) (local.get $default)))
        (f32.store offset=20 (local.get $dst) (call $glide3_field (local.get $guest) (i32.const 6) (i32.const 8) (local.get $default)))
        (f32.store offset=28 (local.get $dst) (call $glide3_field (local.get $guest) (i32.const 5) (i32.const 0) (local.get $default)))))
    ;; Clip-space float colors are normalized; packed ARGB remains bytes.
    (if (i32.and (i32.ne (i32.load (local.get $e)) (i32.const 0))
      (i32.eqz (i32.load offset=4 (local.get $e)))) (then
      (f32.store offset=12 (local.get $dst) (f32.mul (f32.load offset=12 (local.get $dst)) (f32.const 255)))
      (f32.store offset=16 (local.get $dst) (f32.mul (f32.load offset=16 (local.get $dst)) (f32.const 255)))
      (f32.store offset=20 (local.get $dst) (f32.mul (f32.load offset=20 (local.get $dst)) (f32.const 255)))
      (f32.store offset=28 (local.get $dst) (f32.mul (f32.load offset=28 (local.get $dst)) (f32.const 255)))))
    ;; In clip coordinates, absent Qn means 1 before reciprocal-W scaling;
    ;; in window coordinates it inherits FBI Q, as the SDK setup list does.
    (local.set $default (if (result f32) (i32.load (local.get $e))
      (then (f32.const 1)) (else (local.get $q))))
    ;; Enabled layouts describe storage, not parameter liveness. The SDK
    ;; omits inactive texture parameters from its setup list; games leave
    ;; those stack fields uninitialized during untextured overlays.
    (local.set $mask (if (result i32) (i32.load (local.get $e))
      (then (call $glide3_texture_mask)) (else (i32.const 3))))
    (f32.store offset=44 (local.get $dst) (f32.const 1))
    (f32.store offset=56 (local.get $dst) (f32.const 1))
    (if (i32.and (local.get $mask) (i32.const 1)) (then
    (f32.store offset=36 (local.get $dst) (call $glide3_texcoord_field (local.get $guest) (i32.const 8) (i32.const 0)))
    (f32.store offset=40 (local.get $dst) (call $glide3_texcoord_field (local.get $guest) (i32.const 8) (i32.const 4)))
    (f32.store offset=44 (local.get $dst) (call $glide3_field (local.get $guest) (i32.const 10) (i32.const 0) (local.get $default)))
))
    (if (i32.and (local.get $mask) (i32.const 2)) (then
    (f32.store offset=48 (local.get $dst) (call $glide3_texcoord_field (local.get $guest) (i32.const 9) (i32.const 0)))
    (f32.store offset=52 (local.get $dst) (call $glide3_texcoord_field (local.get $guest) (i32.const 9) (i32.const 4)))
    (f32.store offset=56 (local.get $dst) (call $glide3_field (local.get $guest) (i32.const 11) (i32.const 0) (local.get $default)))
))

    (if (i32.load (local.get $e)) (then
      (loop $finite
        (if (i32.eqz (f32.le (f32.abs (f32.load (i32.add (local.get $dst) (local.get $i))))
          (f32.const 0x1.fffffep127))) (then (call $glide_fail)))
        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br_if $finite (i32.lt_u (local.get $i) (i32.const 60)))))))

  (func $glide3_emit_projected (param $op i32) (param $a i32) (param $b i32) (param $c i32)
    (if (i32.eq (local.get $op) (i32.const 5)) (then
      (i32.store offset=36 (global.get $GLIDE_STATE) (i32.add (i32.load offset=36 (global.get $GLIDE_STATE)) (i32.const 1)))))
    (call $glide_draw (local.get $op) (local.get $a) (local.get $b) (local.get $c) (i32.const 1)))

  (func $glide3_array (param $mode i32) (param $count i32) (param $vertices i32) (param $stride i32)
    (local $e i32) (local $a i32) (local $b i32) (local $c i32)
    (local $i i32) (local $n i32) (local $v i32)
    (local.set $e (call $glide3_ext))
    (local.set $a (i32.add (local.get $e) (i32.const 1536)))
    (local.set $b (i32.add (local.get $a) (i32.const 60)))
    (local.set $c (i32.add (local.get $b) (i32.const 60)))
    (if (i32.gt_u (local.get $mode) (i32.const 8)) (then (call $glide_fail)))
    (if (i32.gt_u (local.get $count) (i32.const 1048576)) (then (call $glide_fail)))
    (if (i32.and (i32.ne (local.get $count) (i32.const 0)) (i32.eqz (local.get $stride)))
      (then (call $glide_check_guest (local.get $vertices) (i32.shl (local.get $count) (i32.const 2)))))
    (if (i32.ge_u (local.get $mode) (i32.const 7))
      (then
        (local.set $mode (i32.sub (local.get $mode) (i32.const 3)))
        (if (i32.ne (i32.load offset=1724 (local.get $e)) (local.get $mode)) (then (call $glide_fail)))
        (local.set $n (i32.load offset=1720 (local.get $e))))
      (else (i32.store offset=1724 (local.get $e) (local.get $mode))))
    (block $done (loop $vertices_loop
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (if (local.get $stride)
        (then (local.set $v (i32.add (local.get $vertices) (i32.mul (local.get $i) (local.get $stride)))))
        (else (local.set $v (call $gl32 (i32.add (local.get $vertices) (i32.shl (local.get $i) (i32.const 2)))))))
      (call $glide3_vertex (local.get $c) (local.get $v))
      (if (i32.eqz (local.get $mode))
        (then (call $glide3_emit (i32.const 12) (local.get $c) (i32.const 0) (i32.const 0)))
        (else (if (i32.le_u (local.get $mode) (i32.const 2))
          (then
            (if (local.get $n) (then (call $glide3_emit (i32.const 11) (local.get $a) (local.get $c) (i32.const 0))))
            (memory.copy (local.get $a) (local.get $c) (i32.const 60))
            (if (i32.eq (local.get $mode) (i32.const 2)) (then (local.set $n (i32.sub (i32.const 0) (local.get $n))))))
          (else
            (if (i32.eqz (local.get $n))
              (then (memory.copy (local.get $a) (local.get $c) (i32.const 60)))
              (else (if (i32.eq (local.get $n) (i32.const 1))
                (then (memory.copy (local.get $b) (local.get $c) (i32.const 60)))
                (else
                  (if (i32.and (i32.eq (local.get $mode) (i32.const 4)) (i32.and (local.get $n) (i32.const 1)))
                    (then (call $glide3_emit (i32.const 5) (local.get $b) (local.get $a) (local.get $c)))
                    (else (call $glide3_emit (i32.const 5) (local.get $a) (local.get $b) (local.get $c))))
                  (if (i32.eq (local.get $mode) (i32.const 4))
                    (then (memory.copy (local.get $a) (local.get $b) (i32.const 60))))
                  (memory.copy (local.get $b) (local.get $c) (i32.const 60))
                  (if (i32.eq (local.get $mode) (i32.const 6)) (then (local.set $n (i32.const -1))))))))))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $vertices_loop)))
    (i32.store offset=1720 (local.get $e) (local.get $n)))

  ;; Original 3dfx minihwc.c hwcGammaRGB: a 256-entry DAC ramp per channel,
  ;; each rounded to the nearest byte. Arguments are f32 bits.
  (func $glide_gamma_rgb (param $r i32) (param $g i32) (param $b i32)
    (local $pb i32) (local $c i32) (local $v f32) (local $i i32) (local $t i32)
    (local.set $pb (call $glide_pb))
    (call $glide_gamma_take_table (local.get $pb))
    (loop $channels
      (local.set $v (f32.reinterpret_i32 (select (local.get $r)
        (select (local.get $g) (local.get $b) (i32.eq (local.get $c) (i32.const 1))) (i32.eqz (local.get $c)))))
      (if (i32.eqz (i32.and (f32.gt (local.get $v) (f32.const 0)) (f32.le (local.get $v) (f32.const 0x1.fffffep127))))
        (then (call $glide_fail)))
      (local.set $t (i32.add (elem-addr GlideGps gamma (local.get $pb) (i32.const 0)) (i32.shl (local.get $c) (i32.const 8))))
      (local.set $i (i32.const 0))
      (loop $ramp
        (i32.store8 (i32.add (local.get $t) (local.get $i))
          (i32.trunc_sat_f64_u (f64.floor (f64.add (f64.mul (f64.const 255)
            (call $host_math_pow (f64.div (f64.convert_i32_u (local.get $i)) (f64.const 255))
              (f64.div (f64.const 1) (f64.promote_f32 (local.get $v))))) (f64.const 0.5)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $ramp (i32.lt_u (local.get $i) (i32.const 256))))
      (local.set $c (i32.add (local.get $c) (i32.const 1)))
      (br_if $channels (i32.lt_u (local.get $c) (i32.const 3)))))

  (func $handle_glide3_grGlideInit
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_init)
    (i32.store offset=112 (global.get $GLIDE_STATE) (i32.const 3))
    (drop (call $glide3_ext))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grVertexLayout
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $slot i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $slot (call $glide3_slot (local.get $arg0)))
    (if (i32.or (i32.gt_u (local.get $arg1) (i32.const 4092))
      (i32.or (i32.and (local.get $arg1) (i32.const 3)) (i32.gt_u (local.get $arg2) (i32.const 1)))) (then (call $glide_fail)))
    (if (i32.and (i32.eqz (local.get $slot)) (i32.ne (local.get $arg1) (i32.const 0))) (then (call $glide_fail)))
    ;; Independent fog coordinates require a separate interpolator and
    ;; are not advertised. ST0/Q0 and ST1/Q1 have independent interpolators.
    (if (i32.and (local.get $arg2) (i32.eq (local.get $slot) (i32.const 4)))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (local.set $p (i32.add (call $glide3_ext) (i32.add (i32.const 32) (i32.shl (local.get $slot) (i32.const 3)))))
    (i32.store (local.get $p) (local.get $arg1)) (i32.store offset=4 (local.get $p) (local.get $arg2))
    (if (i32.and (local.get $arg2) (i32.ge_u (local.get $slot) (i32.const 5))) (then
      (if (i32.le_u (local.get $slot) (i32.const 7)) (then
        (i32.store offset=4 (call $glide3_ext) (i32.eq (local.get $slot) (i32.const 7)))))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grCoordinateSpace
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (if (i32.gt_u (local.get $arg0) (i32.const 1)) (then (call $glide_fail)))
    (i32.store (call $glide3_ext) (local.get $arg0))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grDrawVertexArray
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide3_array (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grDrawVertexArrayContiguous
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (if (i32.or (i32.lt_u (local.get $arg3) (i32.const 8)) (i32.gt_u (local.get $arg3) (i32.const 4096))) (then (call $glide_fail)))
    (if (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg2))
      (i64.mul (i64.extend_i32_u (local.get $arg1)) (i64.extend_i32_u (local.get $arg3)))) (i64.const 4294967295)) (then (call $glide_fail)))
    (call $glide3_array (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Pinned glide3x/h3/glide3/src/gsst.c: Finish submits then waits for
  ;; issued commands; Flush only submits. RPC acknowledgement is not GPU idle.
  (func $handle_grFinish
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_finish)
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grFlush
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_flush)
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_grSelectContext
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store (global.get $reg_base) (i32.and (i32.eq (local.get $arg0) (i32.const 1)) (i32.ne (i32.load offset=12 (global.get $GLIDE_STATE)) (i32.const 0))))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_glide3_grSstWinClose
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sp i32) (local $valid i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $valid (i32.and (i32.eq (local.get $arg0) (i32.const 1)) (i32.ne (i32.load offset=12 (global.get $GLIDE_STATE)) (i32.const 0))))
    (if (local.get $valid) (then
      (call $handle_grSstWinClose (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
      (i32.store offset=16 (global.get $reg_base) (local.get $sp))))
    (i32.store (global.get $reg_base) (local.get $valid))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_glide3_grTexDownloadTable
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sp i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_grTexDownloadTable (i32.const 0) (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 0) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grTexDownloadTablePartial
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32) (local $off i32) (local $p i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (if (i32.or (i32.ne (local.get $arg0) (i32.const 2))
      (i32.or (i32.gt_u (local.get $arg2) (local.get $arg3)) (i32.gt_u (local.get $arg3) (i32.const 255))))
      (then (call $glide_fail)))
    (local.set $e (i32.add (call $glide3_ext) (i32.const 128)))
    (local.set $off (i32.shl (local.get $arg2) (i32.const 2)))
    ;; SDK data is the complete table; start/end index into it.
    (call $glide_copy_guest (i32.add (local.get $e) (local.get $off))
      (i32.add (local.get $arg1) (local.get $off))
      (i32.shl (i32.add (i32.sub (local.get $arg3) (local.get $arg2)) (i32.const 1)) (i32.const 2)))
    (call $glide_palette_changed)
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Glide 2's grTexDownloadTablePartial(tmu, type, data, start, end), @20:
  ;; the Glide 3 entry above minus the leading TMU. Same table, same range
  ;; checks; the TMU is validated as for every Glide 2 per-TMU call and the
  ;; table remains the one shared palette, as grTexDownloadTable keeps it.
  ;; Dethkarz's 3Dfx renderer imports it.
  (func $handle_glide2_grTexDownloadTablePartial
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sp i32)
    (call $glide_tmu (local.get $arg0))
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_grTexDownloadTablePartial (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (i32.const 0) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $sp) (i32.const 24))))

  (func $handle_guGammaCorrectionRGB
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_gamma_rgb (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grLoadGammaTable
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $n i32) (local $p i32) (local $i i32) (local $off i32) (local $pb i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $n (local.get $arg0))
    (if (i32.gt_u (local.get $n) (i32.const 256)) (then (local.set $n (i32.const 256))))
    (local.set $pb (call $glide_pb))
    (call $glide_gamma_take_table (local.get $pb))
    (local.set $p (elem-addr GlideGps gamma (local.get $pb) (i32.const 0)))
    (block $done (loop $entries
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $off (i32.shl (local.get $i) (i32.const 2)))
      (i32.store8 (i32.add (local.get $p) (local.get $i)) (call $gl32 (i32.add (local.get $arg1) (local.get $off))))
      (i32.store8 offset=256 (i32.add (local.get $p) (local.get $i)) (call $gl32 (i32.add (local.get $arg2) (local.get $off))))
      (i32.store8 offset=512 (i32.add (local.get $p) (local.get $i)) (call $gl32 (i32.add (local.get $arg3) (local.get $off))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $entries)))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_grGet
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $n i32) (local $i i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $p (call $glide_scratch))
    (if (i32.eq (local.get $arg0) (i32.const 1)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 16))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 2)) (then
      (local.set $n (i32.const 16))
      (i32.store offset=0 (local.get $p) (i32.const 5))
      (i32.store offset=4 (local.get $p) (i32.const 6))
      (i32.store offset=8 (local.get $p) (i32.const 5))
      (i32.store offset=12 (local.get $p) (i32.const 0))
    ))
    ;; Pinned h3/diget.c: [status & SST_PCIFIFO_FREE, status], not bytes.
    ;; Conservatively drain the virtual queue and finish backend work before
    ;; reporting all 31 PCI entries free and all busy bits clear.
    (if (i32.eq (local.get $arg0) (i32.const 3)) (then
      (local.set $n (i32.const 8))
      (if (i32.eq (local.get $arg1) (i32.const 8)) (then
        (call $glide_check_guest (local.get $arg2) (i32.const 8))
        (call $glide_finish)
        (i32.store (local.get $p) (i32.const 31))
        (i32.store offset=4 (local.get $p) (i32.or (i32.const 31)
          (i32.shl (i32.eqz (call $vblank_in_blank (call $host_get_ticks))) (i32.const 6))))))))
    (if (i32.eq (local.get $arg0) (i32.const 4)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 64))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 5)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 256))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 6)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 464))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 7)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 100))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 8)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 0))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 9)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 0))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 10)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 256))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 11)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 3))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 12)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 4194304))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 13)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 4194304))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 14)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 0))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 15)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 1))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 16)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 0))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 17)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 1))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 19)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 2))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 20)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 0))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 21)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 2))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 22)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 1))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 31)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.load offset=36 (global.get $GLIDE_STATE)))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 35)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 0))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 36)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 8))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 37)) (then
      (local.set $n (i32.const 8))
      (i32.store offset=0 (local.get $p) (i32.const 0))
      (i32.store offset=4 (local.get $p) (i32.const 0))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 38)) (then
      (local.set $n (i32.const 16))
      (i32.store offset=0 (local.get $p) (i32.load offset=8 (call $glide3_ext)))
      (i32.store offset=4 (local.get $p) (i32.load offset=12 (call $glide3_ext)))
      (i32.store offset=8 (local.get $p) (i32.load offset=16 (call $glide3_ext)))
      (i32.store offset=12 (local.get $p) (i32.load offset=20 (call $glide3_ext)))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 39)) (then
      (local.set $n (i32.const 8))
      (i32.store offset=0 (local.get $p) (i32.const 0))
      (i32.store offset=4 (local.get $p) (i32.const 65535))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 40)) (then
      (local.set $n (i32.const 8))
      (i32.store offset=0 (local.get $p) (i32.const 65535))
      (i32.store offset=4 (local.get $p) (i32.const 0))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 42)) (then
      (local.set $n (i32.const 4))
      (i32.store offset=0 (local.get $p) (i32.const 8))
    ))
    (if (i32.and (i32.ne (local.get $n) (i32.const 0)) (i32.eq (local.get $arg1) (local.get $n)))
      (then
        (call $glide_check_guest (local.get $arg2) (local.get $n))
        (loop $copy
          (call $gs32 (i32.add (local.get $arg2) (local.get $i)) (i32.load (i32.add (local.get $p) (local.get $i))))
          (local.set $i (i32.add (local.get $i) (i32.const 4)))
          (br_if $copy (i32.lt_u (local.get $i) (local.get $n)))))
      (else (local.set $n (i32.const 0))))
    (i32.store (global.get $reg_base) (local.get $n))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_grGetString
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32) (local $r i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $e (call $glide3_ext))
    (if (i32.eq (local.get $arg0) (i32.const 160)) (then
      (i32.store offset=1152 (local.get $e) (i32.const 0))
      (local.set $r (i32.add (i32.load offset=116 (global.get $GLIDE_STATE)) (i32.const 1152)))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 161)) (then
      (i32.store offset=1184 (local.get $e) (i32.const 1685024598))
      (i32.store offset=1188 (local.get $e) (i32.const 1193308015))
      (i32.store offset=1192 (local.get $e) (i32.const 1752195442))
      (i32.store offset=1196 (local.get $e) (i32.const 7562089))
      (local.set $r (i32.add (i32.load offset=116 (global.get $GLIDE_STATE)) (i32.const 1184)))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 162)) (then
      (i32.store offset=1216 (local.get $e) (i32.const 1701734743))
      (i32.store offset=1220 (local.get $e) (i32.const 1936941357))
      (i32.store offset=1224 (local.get $e) (i32.const 1818389861))
      (i32.store offset=1228 (local.get $e) (i32.const 1816600697))
      (i32.store offset=1232 (local.get $e) (i32.const 6644841))
      (local.set $r (i32.add (i32.load offset=116 (global.get $GLIDE_STATE)) (i32.const 1216)))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 163)) (then
      (i32.store offset=1248 (local.get $e) (i32.const 2019968051))
      (i32.store offset=1252 (local.get $e) (i32.const 1953384736))
      (i32.store offset=1256 (local.get $e) (i32.const 1667330661))
      (i32.store offset=1260 (local.get $e) (i32.const 1702259060))
      (i32.store offset=1264 (local.get $e) (i32.const 0))
      (local.set $r (i32.add (i32.load offset=116 (global.get $GLIDE_STATE)) (i32.const 1248)))
    ))
    (if (i32.eq (local.get $arg0) (i32.const 164)) (then
      (i32.store offset=1280 (local.get $e) (i32.const 808529459))
      (i32.store offset=1284 (local.get $e) (i32.const 0))
      (local.set $r (i32.add (i32.load offset=116 (global.get $GLIDE_STATE)) (i32.const 1280)))
    ))
    (i32.store (global.get $reg_base) (local.get $r))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grViewport
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $e (call $glide3_ext))
    (i32.store offset=8 (local.get $e) (local.get $arg0))
    (i32.store offset=12 (local.get $e) (local.get $arg1))
    (i32.store offset=16 (local.get $e) (local.get $arg2))
    (i32.store offset=20 (local.get $e) (local.get $arg3))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_grDepthRange
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (f32.store offset=24 (call $glide3_ext) (f32.max (f32.const 0) (f32.min (f32.const 1) (f32.reinterpret_i32 (local.get $arg0)))))
    (f32.store offset=28 (call $glide3_ext) (f32.max (f32.const 0) (f32.min (f32.const 1) (f32.reinterpret_i32 (local.get $arg1)))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_glide3_grLfbWriteRegion
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $q i32) (local $n i32) (local $r i32)
    (local $w i32) (local $h i32) (local $i i32) (local $j i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (block $invalid
      ;; Pixel-pipeline LFB writes are not advertised (GR_LFB_PIXEL_PIPE=0).
      (br_if $invalid (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
      (br_if $invalid (i32.load offset=48 (global.get $GLIDE_STATE)))
      (local.set $w (local.get $arg4)) (local.set $h (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
      (local.set $n (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))) (local.set $q (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))
      (br_if $invalid (i32.eqz (local.get $q)))
      (br_if $invalid (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg1)) (i64.extend_i32_u (local.get $w))) (i64.extend_i32_u (i32.load offset=24 (global.get $GLIDE_STATE)))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $arg2)) (i64.extend_i32_u (local.get $h))) (i64.extend_i32_u (i32.load offset=28 (global.get $GLIDE_STATE)))))
      (br_if $invalid (i32.lt_s (local.get $n) (i32.mul (local.get $w) (i32.const 2))))
      (br_if $invalid (i64.gt_u (i64.add (i64.extend_i32_u (local.get $q)) (i64.mul (i64.extend_i32_u (local.get $n)) (i64.extend_i32_u (local.get $h)))) (i64.const 4294967295)))
      (if (i32.ne (local.get $arg3) (i32.const 0)) (then (call $crash_unimplemented (local.get $name_ptr))))
      (local.set $p (call $glide_lfb_stage (local.get $arg0) (i32.const 0)
        (i32.const 4) (local.get $w) (local.get $h)))
      (br_if $invalid (i32.eqz (local.get $p)))
      (local.set $p (i32.add (local.get $p) (i32.add (i32.const 20) (i32.mul (i32.add (i32.mul (local.get $arg2) (i32.load offset=24 (global.get $GLIDE_STATE))) (local.get $arg1)) (i32.const 2)))))
      (loop $rows
        (local.set $j (i32.const 0))
        (loop $pixels
          (i32.store8 (i32.add (local.get $p) (local.get $j)) (call $gl8 (i32.add (local.get $q) (local.get $j))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $pixels (i32.lt_u (local.get $j) (i32.mul (local.get $w) (i32.const 2)))))
        (local.set $p (i32.add (local.get $p) (i32.mul (i32.load offset=24 (global.get $GLIDE_STATE)) (i32.const 2))))
        (local.set $q (i32.add (local.get $q) (local.get $n)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $i) (local.get $h))))
      (local.set $r (i32.const 1))
      (local.set $r (call $glide_lfb_publish (call $g2w (i32.load offset=40 (global.get $GLIDE_STATE)))))
      )
    (i32.store offset=0 (global.get $reg_base) (local.get $r))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40))))


  (func $handle_grQueryResolutions
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $res i32) (local $refresh i32) (local $color i32) (local $aux i32) (local $i i32) (local $j i32) (local $n i32) (local $p i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_check_guest (local.get $arg0) (i32.const 16))
    (local.set $res (call $gl32 (local.get $arg0)))
    (local.set $refresh (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (local.set $color (call $gl32 (i32.add (local.get $arg0) (i32.const 8))))
    (local.set $aux (call $gl32 (i32.add (local.get $arg0) (i32.const 12))))
    ;; Enumerate only this virtual board's supported 60Hz, double-buffered
    ;; configurations; wildcard fields are independently matched.
    (block $done
      (br_if $done (i32.and (i32.ne (local.get $refresh) (i32.const -1)) (i32.ne (local.get $refresh) (i32.const 0))))
      (br_if $done (i32.and (i32.ne (local.get $color) (i32.const -1)) (i32.ne (local.get $color) (i32.const 2))))
      (loop $resolution
        (local.set $j (i32.const 0))
        (loop $auxiliary
          (if (i32.and
            (i32.or (i32.eq (local.get $res) (i32.const -1)) (i32.eq (local.get $res) (local.get $i)))
            (i32.or (i32.eq (local.get $aux) (i32.const -1)) (i32.eq (local.get $aux) (local.get $j)))) (then
            (if (local.get $arg1) (then
              (local.set $p (i32.add (local.get $arg1) (local.get $n)))
              (call $gs32 (local.get $p) (local.get $i))
              (call $gs32 (i32.add (local.get $p) (i32.const 4)) (i32.const 0))
              (call $gs32 (i32.add (local.get $p) (i32.const 8)) (i32.const 2))
              (call $gs32 (i32.add (local.get $p) (i32.const 12)) (local.get $j))))
            (local.set $n (i32.add (local.get $n) (i32.const 16)))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $auxiliary (i32.lt_u (local.get $j) (i32.const 2))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $resolution (i32.lt_u (local.get $i) (i32.const 13)))))
    (i32.store (global.get $reg_base) (local.get $n))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_grGetProcAddress
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (call $glide_check_guest (local.get $arg0) (i32.const 1))
    ;; GR_EXTENSION is empty; there are no extension entry points to resolve.
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grDisable
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.gt_u (local.get $arg0) (i32.const 5))) (then (call $glide_fail)))
    ;; All five optional Glide3 features start disabled. Retain that explicit
    ;; state; enabling an unsupported feature is rejected by grEnable.
    (i32.store offset=1752 (call $glide3_ext)
      (i32.and (i32.load offset=1752 (call $glide3_ext))
        (i32.xor (i32.shl (i32.const 1) (local.get $arg0)) (i32.const -1))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grEnable
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    ;; Ordered AA, mip-dither, passthrough, logo and video smoothing are not
    ;; implemented or advertised. Never silently enable an ignored feature.
    (call $crash_unimplemented (local.get $name_ptr))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grLfbConstantDepth
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)

    (call $lock_acquire (global.get $GLIDE_STATE))
    (i32.store offset=1756 (call $glide3_ext) (i32.and (local.get $arg0) (i32.const 65535)))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grGlideGetState
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32) (local $p i32) (local $i i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $e (call $glide3_ext))
    (loop $copy
      (if (i32.lt_u (local.get $i) (i32.const 256))
        (then (local.set $p (i32.add (call $glide_state) (local.get $i))))
        (else (local.set $p (i32.add (local.get $e) (i32.sub (local.get $i) (i32.const 256))))))
      (call $gs32 (i32.add (local.get $arg0) (local.get $i)) (i32.load (local.get $p)))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br_if $copy (i32.lt_u (local.get $i) (i32.const 384))))
    (if (i32.eq (call $glide_api_version) (i32.const 3)) (then
    (local.set $i (i32.const 0))
    (loop $tmu_copy
      (call $gs32 (i32.add (local.get $arg0) (i32.add (i32.const 384) (local.get $i)))
        (i32.load (i32.add (call $glide3_tmu1) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br_if $tmu_copy (i32.lt_u (local.get $i) (i32.const 80))))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grGlideSetState
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32) (local $p i32) (local $i i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $e (call $glide3_ext))
    (call $glide_copy_guest (call $glide_state) (local.get $arg0) (i32.const 256))
    (call $glide_copy_guest (local.get $e) (i32.add (local.get $arg0) (i32.const 256)) (i32.const 128))
    (if (i32.eq (call $glide_api_version) (i32.const 3)) (then
      (call $glide_copy_guest (call $glide3_tmu1) (i32.add (local.get $arg0) (i32.const 384)) (i32.const 80))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grGlideGetVertexLayout
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32) (local $p i32) (local $i i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $e (call $glide3_ext))
    (local.set $p (i32.add (local.get $e) (i32.const 32)))
    (loop $copy
      (call $gs32 (i32.add (local.get $arg0) (local.get $i)) (i32.load (i32.add (local.get $p) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br_if $copy (i32.lt_u (local.get $i) (i32.const 96))))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 96)) (i32.load offset=4 (local.get $e)))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_grGlideSetVertexLayout
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32) (local $p i32) (local $i i32)
    (call $lock_acquire (global.get $GLIDE_STATE))
    (local.set $e (call $glide3_ext))
    (local.set $p (i32.add (local.get $e) (i32.const 32)))
    (call $glide_copy_guest (local.get $p) (local.get $arg0) (i32.const 96))
    (i32.store offset=4 (local.get $e) (call $gl32 (i32.add (local.get $arg0) (i32.const 96))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (call $lock_release (global.get $GLIDE_STATE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; gu.c fog helpers use float intermediates, including the rounded W value
  ;; and exponential result. Only exp2's exponent evaluation uses double.
  (func $glide_fog_w (param $i i32) (result f32)
    (f32.div (f32.demote_f64 (call $host_math_pow2
      (f64.convert_i32_s (i32.add (i32.const 3) (i32.shr_s (local.get $i) (i32.const 2))))))
      (f32.convert_i32_s (i32.sub (i32.const 8) (i32.and (local.get $i) (i32.const 3))))))
  (func $glide_fog_exp2 (param $density f32) (param $i i32) (result f32)
    (local $dp f32)
    (local.set $dp (f32.mul (local.get $density) (call $glide_fog_w (local.get $i))))
    (f32.sub (f32.const 1) (f32.demote_f64 (call $host_math_pow2
      (f64.mul (f64.promote_f32 (f32.neg (f32.mul (local.get $dp) (local.get $dp)))) (f64.const 1.4426950408889634))))))

  (func $handle_guFogGenerateExp2
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $density f32) (local $scale f32) (local $f f32)
    (call $glide_check_guest (local.get $arg0) (i32.const 64))
    (local.set $density (f32.reinterpret_i32 (local.get $arg1)))
    (local.set $scale (f32.div (f32.const 1) (call $glide_fog_exp2 (local.get $density) (i32.const 63))))
    (loop $entries
      (local.set $f (f32.mul (call $glide_fog_exp2 (local.get $density) (local.get $i)) (local.get $scale)))
      (call $gs8 (i32.add (local.get $arg0) (local.get $i))
        (i32.trunc_sat_f32_u (f32.mul (f32.const 255) (f32.max (f32.const 0) (f32.min (f32.const 1) (local.get $f))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $entries (i32.lt_u (local.get $i) (i32.const 64))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))


  (func $handle_guFogGenerateLinear
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $f f32)
    (call $glide_check_guest (local.get $arg0) (i32.const 64))
    (loop $entries
      (local.set $f (f32.div
        (f32.sub (f32.min (f32.const 65535) (call $glide_fog_w (local.get $i))) (f32.reinterpret_i32 (local.get $arg1)))
        (f32.sub (f32.reinterpret_i32 (local.get $arg2)) (f32.reinterpret_i32 (local.get $arg1)))))
      (call $gs8 (i32.add (local.get $arg0) (local.get $i))
        (i32.trunc_sat_f32_u (f32.mul (f32.const 255) (f32.max (f32.const 0) (f32.min (f32.const 1) (local.get $f))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $entries (i32.lt_u (local.get $i) (i32.const 64))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_guFogTableIndexToW
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (f64.promote_f32 (call $glide_fog_w (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Opt-in diagnostics only. Reasons: read lock0, write lock1, read region2,
  ;; Glide2 write region3, Glide3 write region4. Each seven-u64 row holds:
  ;; attempts, requested pixels, full staged pixels, full-size requests,
  ;; last requested width/height, last guest return address. We record at the
  ;; actual readback boundary, including a backend rejection, not API entry.
  ;; Counters live in aligned extension2048..2334 and are absent until first use.
  ;; The main thread may enable/read these exports while a guest waits on RPC:
  ;; neither export takes the process lock, allocates, or waits on Atomics.
  (func $glide_lfb_metrics_enable (export "glide_lfb_metrics_enable") (param $enabled i32)
    (i32.atomic.store offset=120 (global.get $GLIDE_STATE)
      (i32.ne (local.get $enabled) (i32.const 0))))

  (func $glide_lfb_metrics_base (param $extension i32) (result i32)
    ;; heap_alloc payloads follow a four-byte header and need not be aligned8.
    (i32.and (i32.add (local.get $extension) (i32.const 2055)) (i32.const -8)))

  (func $glide_lfb_metrics_get (export "glide_lfb_metrics_get")
      (param $reason i32) (param $field i32) (result f64)
    (local $p i32)
    (if (i32.or (i32.gt_u (local.get $reason) (i32.const 4))
      (i32.gt_u (local.get $field) (i32.const 6))) (then (return (f64.const 0))))
    (local.set $p (i32.atomic.load offset=116 (global.get $GLIDE_STATE)))
    (if (i32.eqz (local.get $p)) (then (return (f64.const 0))))
    (f64.convert_i64_u (i64.atomic.load (i32.add (call $glide_lfb_metrics_base (call $g2w (local.get $p)))
      (i32.add (i32.mul (local.get $reason) (i32.const 56))
        (i32.shl (local.get $field) (i32.const 3)))))))

  (func $glide_lfb_record_metrics (param $reason i32) (param $w i32) (param $h i32)
    (local $p i32) (local $pixels i64) (local $full i64)
    (if (i32.eqz (i32.atomic.load offset=120 (global.get $GLIDE_STATE))) (then (return)))
    ;; The calling API already holds the shared recursive lock. Only this
    ;; path allocates the optional extension on a pure Glide2 application.
    (local.set $p (i32.add (call $glide_lfb_metrics_base (call $glide3_ext))
      (i32.mul (local.get $reason) (i32.const 56))))
    (local.set $pixels (i64.mul (i64.extend_i32_u (local.get $w)) (i64.extend_i32_u (local.get $h))))
    (local.set $full (i64.mul
      (i64.extend_i32_u (i32.load offset=24 (global.get $GLIDE_STATE)))
      (i64.extend_i32_u (i32.load offset=28 (global.get $GLIDE_STATE)))))
    (drop (i64.atomic.rmw.add (local.get $p) (i64.const 1)))
    (drop (i64.atomic.rmw.add offset=8 (local.get $p) (local.get $pixels)))
    (drop (i64.atomic.rmw.add offset=16 (local.get $p) (local.get $full)))
    (if (i64.eq (local.get $pixels) (local.get $full)) (then
      (drop (i64.atomic.rmw.add offset=24 (local.get $p) (i64.const 1)))))
    (i64.atomic.store offset=32 (local.get $p) (i64.extend_i32_u (local.get $w)))
    (i64.atomic.store offset=40 (local.get $p) (i64.extend_i32_u (local.get $h)))
    (i64.atomic.store offset=48 (local.get $p)
      (i64.extend_i32_u (call $gl32 (i32.load offset=16 (global.get $reg_base))))))

  (func $glide3_tmu1 (result i32)
    (i32.add (call $glide3_ext) (i32.const 2368)))
  (func $glide_tmu_store (param $tmu i32) (param $offset i32) (param $value i32)
    (local $p i32)
    (if (i32.eqz (local.get $tmu))
      (then (local.set $p (i32.add (call $glide_state) (local.get $offset))))
      (else
        (local.set $p (i32.add (call $glide3_tmu1) (i32.sub (local.get $offset) (i32.const 128))))
        (if (i32.ge_u (local.get $offset) (i32.const 184))
          (then (local.set $p (i32.add (call $glide3_tmu1) (i32.sub (local.get $offset) (i32.const 136))))))
        (if (i32.eq (local.get $offset) (i32.const 240))
          (then (local.set $p (i32.add (call $glide3_tmu1) (i32.const 72)))))))
    (i32.store (local.get $p) (local.get $value)))

  ;; Clip-space temporary vertices keep homogeneous W in the unused legacy
  ;; z slot8 and unprojected Z in slot24. Every attribute is interpolated
  ;; before division. Six clip-volume planes plus a positive normal-float W
  ;; plane avoid infinity at the eye without rejecting ordinary small W.
  (func $glide3_clip_distance (param $v i32) (param $plane i32) (result f64)
    (local $w f64) (local $c f64)
    (local.set $w (f64.promote_f32 (f32.load offset=8 (local.get $v))))
    (if (i32.eq (local.get $plane) (i32.const 6))
      (then (return (f64.sub (local.get $w) (f64.const 0x1p-126)))))
    (local.set $c (f64.promote_f32 (f32.load (i32.add (local.get $v)
      (if (result i32) (i32.lt_u (local.get $plane) (i32.const 4))
        (then (i32.shl (i32.shr_u (local.get $plane) (i32.const 1)) (i32.const 2)))
        (else (i32.const 24)))))))
    (if (result f64) (i32.and (local.get $plane) (i32.const 1))
      (then (f64.sub (local.get $w) (local.get $c)))
      (else (f64.add (local.get $w) (local.get $c)))))

  (func $glide3_clip_interpolate (param $dst i32) (param $a i32) (param $b i32)
      (param $da f64) (param $db f64)
    (local $i i32) (local $t f64) (local $v f64)
    (local.set $t (f64.div (local.get $da) (f64.sub (local.get $da) (local.get $db))))
    (loop $attributes
      (local.set $v (f64.promote_f32 (f32.load (i32.add (local.get $a) (local.get $i)))))
      (f32.store (i32.add (local.get $dst) (local.get $i)) (f32.demote_f64
        (f64.add (local.get $v) (f64.mul (local.get $t)
          (f64.sub (f64.promote_f32 (f32.load (i32.add (local.get $b) (local.get $i)))) (local.get $v))))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br_if $attributes (i32.lt_u (local.get $i) (i32.const 60)))))

  (func $glide3_texture_scale (param $aspect i32) (param $vertical i32) (result f32)
    (local $shift i32)
    (local.set $shift (if (result i32) (local.get $vertical)
      (then (i32.sub (i32.const 3) (local.get $aspect)))
      (else (i32.sub (local.get $aspect) (i32.const 3)))))
    (if (i32.lt_s (local.get $shift) (i32.const 0)) (then (local.set $shift (i32.const 0))))
    (f32.convert_i32_u (i32.shr_u (i32.const 256) (local.get $shift))))

  ;; Multiply in double precision: at the eye-plane W=2^-126, q is
  ;; finite but q*256 overflows float even when S=0 or very small. Reject
  ;; genuinely unrepresentable final attributes before recording a draw.
  (func $glide3_project_product (param $value f32) (param $q f32)
      (param $scale f32) (result f32)
    (local $out f32)
    (local.set $out (f32.demote_f64 (f64.mul
      (f64.mul (f64.promote_f32 (local.get $value)) (f64.promote_f32 (local.get $q)))
      (f64.promote_f32 (local.get $scale)))))
    (if (i32.eqz (f32.le (f32.abs (local.get $out)) (f32.const 0x1.fffffep127)))
      (then (call $glide_fail)))
    (local.get $out))

  (func $glide3_project (param $dst i32) (param $src i32)
    (local $e i32) (local $q f32) (local $half f32) (local $n f32) (local $f f32)
    (local $aspect i32)
    (local.set $e (call $glide3_ext))
    (memory.copy (local.get $dst) (local.get $src) (i32.const 60))
    (local.set $q (f32.div (f32.const 1) (f32.load offset=8 (local.get $src))))
    (local.set $half (f32.mul (f32.convert_i32_s (i32.load offset=16 (local.get $e))) (f32.const 0.5)))
    (f32.store (local.get $dst) (f32.add
      (f32.mul (f32.mul (f32.load (local.get $src)) (local.get $q)) (local.get $half))
      (f32.add (f32.convert_i32_s (i32.load offset=8 (local.get $e))) (local.get $half))))
    (local.set $half (f32.mul (f32.convert_i32_s (i32.load offset=20 (local.get $e))) (f32.const 0.5)))
    (f32.store offset=4 (local.get $dst) (f32.add
      (f32.mul (f32.mul (f32.load offset=4 (local.get $src)) (local.get $q)) (local.get $half))
      (f32.add (f32.convert_i32_s (i32.load offset=12 (local.get $e))) (local.get $half))))
    (local.set $n (f32.load offset=24 (local.get $e)))
    (local.set $f (f32.load offset=28 (local.get $e)))
    (f32.store offset=24 (local.get $dst) (f32.add
      (f32.mul (f32.mul (f32.load offset=24 (local.get $src)) (local.get $q))
        (f32.mul (f32.sub (local.get $f) (local.get $n)) (f32.const 32767.5)))
      (f32.mul (f32.add (local.get $f) (local.get $n)) (f32.const 32767.5))))
    (f32.store offset=8 (local.get $dst) (f32.const 0))
    (f32.store offset=32 (local.get $dst) (call $glide3_project_product (f32.load offset=32 (local.get $src)) (local.get $q) (f32.const 1)))
    (f32.store offset=44 (local.get $dst) (call $glide3_project_product (f32.load offset=44 (local.get $src)) (local.get $q) (f32.const 1)))
    (f32.store offset=56 (local.get $dst) (call $glide3_project_product (f32.load offset=56 (local.get $src)) (local.get $q) (f32.const 1)))
    (local.set $aspect (i32.load offset=140 (call $glide_state)))
    (f32.store offset=36 (local.get $dst) (call $glide3_project_product (f32.load offset=36 (local.get $src))
      (local.get $q) (call $glide3_texture_scale (local.get $aspect) (i32.const 0))))
    (f32.store offset=40 (local.get $dst) (call $glide3_project_product (f32.load offset=40 (local.get $src))
      (local.get $q) (call $glide3_texture_scale (local.get $aspect) (i32.const 1))))
    (local.set $aspect (i32.load offset=12 (call $glide3_tmu1)))
    (f32.store offset=48 (local.get $dst) (call $glide3_project_product (f32.load offset=48 (local.get $src))
      (local.get $q) (call $glide3_texture_scale (local.get $aspect) (i32.const 0))))
    (f32.store offset=52 (local.get $dst) (call $glide3_project_product (f32.load offset=52 (local.get $src))
      (local.get $q) (call $glide3_texture_scale (local.get $aspect) (i32.const 1)))))

  (func $glide3_emit (param $op i32) (param $a i32) (param $b i32) (param $c i32)
    (local $src i32) (local $dst i32) (local $tmp i32) (local $out i32)
    (local $n i32) (local $m i32) (local $i i32) (local $plane i32)
    (local $prev i32) (local $cur i32) (local $da f64) (local $db f64)
    (if (i32.eqz (i32.load (call $glide3_ext))) (then
      (call $glide3_emit_projected (local.get $op) (local.get $a) (local.get $b) (local.get $c))
      (return)))
    (local.set $src (i32.add (call $glide3_ext) (i32.const 2560)))
    (local.set $dst (i32.add (local.get $src) (i32.const 960)))
    (local.set $out (i32.add (call $glide3_ext) (i32.const 4480)))
    (memory.copy (local.get $src) (local.get $a) (i32.const 60))
    (local.set $n (i32.const 1))
    (if (i32.ne (local.get $op) (i32.const 12)) (then
      (memory.copy (i32.add (local.get $src) (i32.const 60)) (local.get $b) (i32.const 60))
      (local.set $n (i32.const 2))))
    (if (i32.eq (local.get $op) (i32.const 5)) (then
      (memory.copy (i32.add (local.get $src) (i32.const 120)) (local.get $c) (i32.const 60))
      (local.set $n (i32.const 3))))
    (loop $planes
      (if (i32.eq (local.get $op) (i32.const 5))
        (then
          ;; Sutherland-Hodgman preserves winding and interpolates every raw
          ;; field. A triangle clipped by seven planes fits sixteen vertices.
          (local.set $m (i32.const 0)) (local.set $i (i32.const 0))
          (local.set $prev (i32.add (local.get $src) (i32.mul (i32.sub (local.get $n) (i32.const 1)) (i32.const 60))))
          (local.set $da (call $glide3_clip_distance (local.get $prev) (local.get $plane)))
          (loop $edges
            (local.set $cur (i32.add (local.get $src) (i32.mul (local.get $i) (i32.const 60))))
            (local.set $db (call $glide3_clip_distance (local.get $cur) (local.get $plane)))
            (if (i32.ne (f64.ge (local.get $da) (f64.const 0)) (f64.ge (local.get $db) (f64.const 0))) (then
              (if (i32.ge_u (local.get $m) (i32.const 16)) (then (call $glide_fail)))
              (call $glide3_clip_interpolate (i32.add (local.get $dst) (i32.mul (local.get $m) (i32.const 60)))
                (local.get $prev) (local.get $cur) (local.get $da) (local.get $db))
              (if (i32.eq (local.get $plane) (i32.const 6)) (then
                (f32.store offset=8 (i32.add (local.get $dst) (i32.mul (local.get $m) (i32.const 60))) (f32.const 0x1p-126))))
              (local.set $m (i32.add (local.get $m) (i32.const 1)))))
            (if (f64.ge (local.get $db) (f64.const 0)) (then
              (if (i32.ge_u (local.get $m) (i32.const 16)) (then (call $glide_fail)))
              (memory.copy (i32.add (local.get $dst) (i32.mul (local.get $m) (i32.const 60))) (local.get $cur) (i32.const 60))
              (local.set $m (i32.add (local.get $m) (i32.const 1)))))
            (local.set $prev (local.get $cur)) (local.set $da (local.get $db))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br_if $edges (i32.lt_u (local.get $i) (local.get $n))))
          (if (i32.lt_u (local.get $m) (i32.const 3)) (then (return)))
          (local.set $n (local.get $m))
          (local.set $tmp (local.get $src)) (local.set $src (local.get $dst)) (local.set $dst (local.get $tmp)))
        (else
          (local.set $da (call $glide3_clip_distance (local.get $src) (local.get $plane)))
          (if (i32.eq (local.get $n) (i32.const 1))
            (then (if (f64.lt (local.get $da) (f64.const 0)) (then (return))))
            (else
              (local.set $cur (i32.add (local.get $src) (i32.const 60)))
              (local.set $db (call $glide3_clip_distance (local.get $cur) (local.get $plane)))
              (if (i32.and (f64.lt (local.get $da) (f64.const 0)) (f64.lt (local.get $db) (f64.const 0))) (then (return)))
              (if (i32.ne (f64.ge (local.get $da) (f64.const 0)) (f64.ge (local.get $db) (f64.const 0))) (then
                (call $glide3_clip_interpolate (local.get $dst) (local.get $src) (local.get $cur) (local.get $da) (local.get $db))
                (if (i32.eq (local.get $plane) (i32.const 6)) (then
                  (f32.store offset=8 (local.get $dst) (f32.const 0x1p-126))))
                (memory.copy (if (result i32) (f64.lt (local.get $da) (f64.const 0))
                  (then (local.get $src)) (else (local.get $cur))) (local.get $dst) (i32.const 60))))))))
      (local.set $plane (i32.add (local.get $plane) (i32.const 1)))
      (br_if $planes (i32.lt_u (local.get $plane) (i32.const 7))))
    (if (i32.eq (local.get $op) (i32.const 5))
      (then
        (local.set $i (i32.const 1))
        (loop $fan
          (call $glide3_project (local.get $out) (local.get $src))
          (call $glide3_project (i32.add (local.get $out) (i32.const 60)) (i32.add (local.get $src) (i32.mul (local.get $i) (i32.const 60))))
          (call $glide3_project (i32.add (local.get $out) (i32.const 120)) (i32.add (local.get $src) (i32.mul (i32.add (local.get $i) (i32.const 1)) (i32.const 60))))
          (call $glide3_emit_projected (local.get $op) (local.get $out) (i32.add (local.get $out) (i32.const 60)) (i32.add (local.get $out) (i32.const 120)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $fan (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $n)))))
      (else
        (call $glide3_project (local.get $out) (local.get $src))
        (if (i32.eq (local.get $n) (i32.const 2)) (then
          (call $glide3_project (i32.add (local.get $out) (i32.const 60)) (i32.add (local.get $src) (i32.const 60)))))
        (call $glide3_emit_projected (local.get $op) (local.get $out) (i32.add (local.get $out) (i32.const 60)) (i32.const 0)))))
