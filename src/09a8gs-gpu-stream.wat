  ;; GPU stream v2 (docs/gpu-stream-v2.md): the byte records WAT frontends
  ;; write for every renderer. This file is the ONE declaration of the wire
  ;; format. tools/gen-gpu-stream.js reads the $GPS_* globals and the Gps*
  ;; layouts below and writes lib/gpu-stream.generated.js; build.sh refuses a
  ;; stale mirror and any renumbered op (op ids are append-only, as
  ;; api_table.json ids are).
  ;;
  ;; Ring directory: the $GPU_STREAM region holds $GPS_RING_MAX entries of
  ;; (size-of GpsRing). Ring bytes and the upload arena are guest-heap memory
  ;; (affine, wasm-contiguous), named by ring_data/arena_data. Positions
  ;; (write/read, arena head/tail) are monotonic u32 byte counters; the byte
  ;; lives at data + (pos & (bytes - 1)), so both sizes are powers of two.
  ;; One ring has exactly one producer AT A TIME: whichever guest thread owns
  ;; the device now, never the thread that created it (NFS3 opens Glide on a
  ;; worker and draws on main; Hype's main thread only queries, then T1 does
  ;; everything). Every record starts with an owner check: a matching owner
  ;; id is the whole fast path; a mismatch takes the ring's producer lock,
  ;; kicks the previous owner's published records, and switches the owner
  ;; ($gps_own). A device driven by two threads in one frame would ping-pong
  ;; here but stays correct, because frontends serialize producers with their
  ;; own lock and seq comes from one device counter.
  ;; A device may own several rings; their
  ;; records carry seq values from one device counter (seq_counter), and a
  ;; consumer merges rings by seq. Nothing here assumes one ring per device.
  ;;
  ;; Producer waits: a sync kick (host import mode 1) returns after the
  ;; consumer has executed every published record. It is used only when the
  ;; ring or arena is full, for READBACK/FENCE results, and at open/close.

  (global $GPU_STREAM i32 (region.addr $GPU_STREAM 0))
  (global $GPU_STREAM_SIZE i32 (region.size $GPU_STREAM))
  (global $GPS_MAGIC i32 (i32.const 0x32535047))     ;; 'GPS2'
  (global $GPS_VERSION i32 (i32.const 1))
  (global $GPS_RING_MAX i32 (i32.const 8))
  (global $GPS_RECORD_ALIGN i32 (i32.const 8))
  (global $GPS_FLAG_WANT_DONE i32 (i32.const 1))
  (global $GPS_KICK_ASYNC i32 (i32.const 0))
  (global $GPS_KICK_SYNC i32 (i32.const 1))
  (global $GPS_KICK_CLOSE i32 (i32.const 2))
  ;; Producer API tags (GpsRing.api): which host bridge owns the consumer.
  (global $GPS_API_GLIDE i32 (i32.const 1))

  ;; Opcodes. APPEND ONLY: tools/gpu-stream-ops.json is the baseline.
  (global $GPS_OP_WRAP i32 (i32.const 0))
  (global $GPS_OP_CREATE i32 (i32.const 1))
  (global $GPS_OP_UPLOAD i32 (i32.const 2))
  (global $GPS_OP_RELEASE i32 (i32.const 3))
  (global $GPS_OP_SHADER i32 (i32.const 4))
  (global $GPS_OP_LAYOUT i32 (i32.const 5))
  (global $GPS_OP_SAMPLER i32 (i32.const 6))
  (global $GPS_OP_TARGETS i32 (i32.const 10))
  (global $GPS_OP_VIEWPORT i32 (i32.const 11))
  (global $GPS_OP_RASTER i32 (i32.const 12))
  (global $GPS_OP_BIND i32 (i32.const 13))
  (global $GPS_OP_CONSTS i32 (i32.const 14))
  (global $GPS_OP_DRAW i32 (i32.const 20))
  (global $GPS_OP_DRAW_UP i32 (i32.const 21))
  (global $GPS_OP_CLEAR i32 (i32.const 22))
  (global $GPS_OP_COPY i32 (i32.const 23))
  (global $GPS_OP_FENCE i32 (i32.const 30))
  (global $GPS_OP_READBACK i32 (i32.const 31))
  (global $GPS_OP_PRESENT i32 (i32.const 32))
  (global $GPS_OP_MARK i32 (i32.const 33))

  ;; Resource kinds (GpsCreate.kind).
  (global $GPS_KIND_TEX2D i32 (i32.const 1))
  (global $GPS_KIND_CUBE i32 (i32.const 2))
  (global $GPS_KIND_VBUF i32 (i32.const 3))
  (global $GPS_KIND_IBUF i32 (i32.const 4))
  (global $GPS_KIND_RT i32 (i32.const 5))
  (global $GPS_KIND_DS i32 (i32.const 6))
  (global $GPS_KIND_SHADER i32 (i32.const 7))
  (global $GPS_KIND_LAYOUT i32 (i32.const 8))
  (global $GPS_KIND_SAMPLER i32 (i32.const 9))
  (global $GPS_KIND_STATEBLK i32 (i32.const 10))

  ;; Formats (GpsCreate.fmt, GpsReadback.fmt; an UPLOAD's bytes are in the
  ;; resource's format). 1..4 match lib/d3dim-gpu.js native16 codes. A8R8G8B8
  ;; bytes are B,G,R,A in memory (D3D order). APPEND ONLY.
  (global $GPS_FMT_RGB565 i32 (i32.const 1))
  (global $GPS_FMT_X1R5G5B5 i32 (i32.const 2))
  (global $GPS_FMT_A1R5G5B5 i32 (i32.const 3))
  (global $GPS_FMT_A4R4G4B4 i32 (i32.const 4))
  (global $GPS_FMT_X8R8G8B8 i32 (i32.const 5))
  (global $GPS_FMT_A8R8G8B8 i32 (i32.const 6))
  (global $GPS_FMT_P8 i32 (i32.const 7))
  (global $GPS_FMT_D16 i32 (i32.const 8))
  (global $GPS_FMT_D24S8 i32 (i32.const 9))
  (global $GPS_FMT_DXT1 i32 (i32.const 10))
  (global $GPS_FMT_DXT3 i32 (i32.const 11))
  (global $GPS_FMT_DXT5 i32 (i32.const 12))
  (global $GPS_FMT_L8 i32 (i32.const 13))
  (global $GPS_FMT_A8 i32 (i32.const 14))
  ;; Bytes R,G,B,A in memory (D3DFMT_A8B8G8R8): what WebGL and the software
  ;; rasterizer take without a swizzle. Glide textures and targets use it.
  (global $GPS_FMT_A8B8G8R8 i32 (i32.const 15))

  ;; Primitive types (GpsDraw.prim), D3DPRIMITIVETYPE values.
  (global $GPS_PRIM_POINTLIST i32 (i32.const 1))
  (global $GPS_PRIM_LINELIST i32 (i32.const 2))
  (global $GPS_PRIM_TRIANGLELIST i32 (i32.const 4))

  ;; Vertex element types/usages (GpsLayoutElem), D3DDECLTYPE/D3DDECLUSAGE.
  (global $GPS_VTYPE_FLOAT4 i32 (i32.const 3))
  (global $GPS_USAGE_TEXCOORD i32 (i32.const 5))
  (global $GPS_USAGE_POSITIONT i32 (i32.const 9))
  (global $GPS_USAGE_COLOR i32 (i32.const 10))

  ;; CLEAR mask bits; RASTER colormask bits (R,G,B,A = 1,2,4,8).
  (global $GPS_CLEAR_COLOR i32 (i32.const 1))
  (global $GPS_CLEAR_DEPTH i32 (i32.const 2))
  (global $GPS_CLEAR_STENCIL i32 (i32.const 4))

  ;; RASTER depth modes and fog modes.
  (global $GPS_DEPTH_OFF i32 (i32.const 0))
  (global $GPS_DEPTH_Z i32 (i32.const 1))
  (global $GPS_DEPTH_W i32 (i32.const 2))
  (global $GPS_FOG_NONE i32 (i32.const 0))
  (global $GPS_FOG_VERTEX_ALPHA i32 (i32.const 1))
  (global $GPS_FOG_TABLE_W i32 (i32.const 2))
  (global $GPS_FOG_Z i32 (i32.const 3))
  (global $GPS_FOGF_NO_MULT i32 (i32.const 1))
  (global $GPS_FOGF_NO_ADD i32 (i32.const 2))

  ;; SHADER stages. vs id 0 in a DRAW means "pretransformed": positions are
  ;; render-target pixels, y down, centers at +0.5 (Glide/D3D XYZRHW).
  (global $GPS_STAGE_VS i32 (i32.const 0))
  (global $GPS_STAGE_PS i32 (i32.const 1))

  ;; Executor error codes (GpsRing.error_code).
  (global $GPS_ERR_UNKNOWN_OP i32 (i32.const 1))
  (global $GPS_ERR_MALFORMED i32 (i32.const 2))
  (global $GPS_ERR_UNSUPPORTED i32 (i32.const 3))
  (global $GPS_ERR_EXECUTOR i32 (i32.const 4))

  ;; One directory entry. Bytes 0..63 are the spec's ring header; 64..127 are
  ;; the completion slots FENCE/READBACK name; 128.. are producer-private.
  (layout GpsRing
    (field magic i32)
    (field version u16)
    (field flags u16)
    (field ring_bytes i32)
    (field arena_bytes i32)
    (field write_pos i32)       ;; producer, published after a record completes
    (field read_pos i32)        ;; consumer
    (field submit_seq i32)      ;; producer: seq of the last published record
    (field done_seq i32)        ;; consumer
    (field arena_head i32)      ;; producer
    (field arena_tail i32)      ;; consumer: end of the data the last executed record used
    (field error_seq i32)       ;; consumer
    (field error_code i32)      ;; consumer
    (field ring_data i32)       ;; wasm address of ring_bytes bytes
    (field arena_data i32)      ;; wasm address of arena_bytes bytes
    (field api i32)             ;; $GPS_API_*
    (field seq_counter i32)     ;; wasm address of the device-wide seq counter
    (field slots i32 16)        ;; completion slots: the executor stores the seq
    (field seq_storage i32)     ;; default device counter (one-ring devices)
    (field last_present i32)    ;; seq of the newest PRESENT (pacing)
    (field owner i32)           ;; lock owner id of the thread now producing
    (field producer_lock i32 2) ;; $lock_acquire word + depth; taken only on handoff
    (field handoffs i32)        ;; owner changes (diagnostic)
    (field ring_guest i32)      ;; guest blocks behind ring_data/arena_data (heap_free)
    (field arena_guest i32)
    ;; consumer: nonzero while a render Worker drains this ring on its own
    ;; (a doorbell consumer). Host producers then hand ASYNC work over with
    ;; Atomics.notify on write_pos and wait for SYNC on done_seq themselves;
    ;; 0 = kick through the host bridge. WAT never reads it: the alloc/free
    ;; memory.fill clears it, the consumer sets and clears it.
    (field consumer i32)
    (field reserved i32 7))

  ;; Record header; the payload follows at (size-of GpsRecord).
  (layout GpsRecord
    (field op u16)
    (field flags u16)
    (field bytes i32)           ;; whole record including this header, before padding
    (field seq i32))

  (layout GpsCreate
    (field id i32) (field kind u8) (field fmt u8) (field levels u16)
    (field width i32) (field height i32) (field size i32))
  ;; src is an arena position; data rows are top-down, pitch bytes apart.
  (layout GpsUpload
    (field id i32) (field level u16) (field face u16)
    (field x i32) (field y i32) (field w i32) (field h i32)
    (field pitch i32) (field src i32) (field bytes i32))
  (layout GpsRelease (field id i32))
  ;; Followed by ir_bytes of src/09af-d3d-shader-ir.wat IR.
  (layout GpsShader (field id i32) (field stage u8) (field pad u8) (field pad2 u16) (field ir_bytes i32))
  ;; Followed by count GpsLayoutElem entries.
  (layout GpsLayout (field id i32) (field count i32) (field stride i32))
  (layout GpsLayoutElem
    (field slot u8) (field type u8) (field usage u8) (field index u8)
    (field offset u16) (field pad u16))
  ;; address: 1 wrap, 3 clamp (D3DTADDRESS). filters: 1 point, 2 linear;
  ;; mip 0 none. lod_bias in levels.
  (layout GpsSampler
    (field id i32) (field address_u u8) (field address_v u8) (field min u8) (field mag u8)
    (field mip u8) (field pad u8) (field pad2 u16) (field lod_bias f32))
  (layout GpsTargets (field color i32) (field depth i32))
  (layout GpsViewport
    (field x i32) (field y i32) (field w i32) (field h i32) (field zmin f32) (field zmax f32))
  ;; Whole pipeline block, always sent complete (never a partial update), but
  ;; sticky: executors keep the last RASTER, CONSTS, BIND and TARGETS until
  ;; the next one, so producers re-emit a block only when its bytes changed.
  ;; CLEAR uses its own rect/colormask and leaves this state. Enums are D3D's: compare
  ;; functions D3DCMP (1 never .. 8 always), blend D3DBLEND (1..11), cull
  ;; D3DCULL in render-target pixel space (1 none, 2 cw, 3 ccw). Scissor is
  ;; top-down, half-open. fog_table names an L8 64x1 texture (table fog).
  ;; depth_bias applies to W depth and table fog lookups (Glide units).
  (layout GpsRaster
    (field depth_mode u8) (field zfunc u8) (field zwrite u8) (field cull u8)
    (field blend u8) (field src_rgb u8) (field dst_rgb u8) (field src_alpha u8)
    (field dst_alpha u8) (field alpha_func u8) (field alpha_ref u8) (field colormask u8)
    (field fog_mode u8) (field fog_flags u8) (field fill u8) (field pad u8)
    (field fog_color i32)       ;; R | G<<8 | B<<16 | A<<24
    (field fog_table i32)
    (field depth_bias i32)
    (field scissor_left i32) (field scissor_top i32)
    (field scissor_right i32) (field scissor_bottom i32)
    (field reserved i32 5))
  ;; Followed by count GpsBindEntry.
  (layout GpsBind (field count i32))
  (layout GpsBindEntry (field slot i32) (field texture i32) (field sampler i32))
  ;; Followed by count * 16 bytes of f32x4.
  (layout GpsConsts (field stage u8) (field pad u8) (field first u16) (field count i32))
  ;; DRAW_UP: vbuf 0, voff is an arena position, count is vertices.
  (layout GpsDraw
    (field prim u8) (field pad u8) (field pad2 u16)
    (field vs i32) (field ps i32) (field layout i32)
    (field vbuf i32) (field voff i32) (field stride i32)
    (field ibuf i32) (field ioff i32) (field count i32))
  ;; rgba: R | G<<8 | B<<16 | A<<24. Rect top-down, half-open.
  (layout GpsClear
    (field mask u8) (field colormask u8) (field pad u16)
    (field rgba i32) (field z f32) (field stencil i32)
    (field left i32) (field top i32) (field right i32) (field bottom i32))
  (layout GpsCopy
    (field src i32) (field dst i32)
    (field sx i32) (field sy i32) (field sw i32) (field sh i32)
    (field dx i32) (field dy i32) (field dw i32) (field dh i32) (field filter i32))
  (layout GpsFence (field slot i32))
  ;; Pixels go to the arena at dst, rows top-down, pitch bytes apart; then the
  ;; executor stores this record's seq into slots[slot].
  (layout GpsReadback
    (field rt i32) (field x i32) (field y i32) (field w i32) (field h i32)
    (field fmt i32) (field dst i32) (field pitch i32) (field slot i32))
  ;; gamma names a 256x1 A8R8G8B8 lookup texture (0 = none). surface is the
  ;; frontend's window handle.
  (layout GpsPresent
    (field rt i32) (field gamma i32)
    (field x i32) (field y i32) (field w i32) (field h i32) (field surface i32))
  (layout GpsMark (field frame i32) (field tag i32))

  (func $gps_fail
    (call $host_log_i32 (i32.const 0x47505332))
    (unreachable))

  (func $gps_ring (param $index i32) (result i32)
    (if (i32.ge_u (local.get $index) (global.get $GPS_RING_MAX)) (then (call $gps_fail)))
    (i32.add (global.get $GPU_STREAM) (i32.mul (local.get $index) (size-of GpsRing))))

  (func $gps_is_pow2 (param $n i32) (result i32)
    (i32.and (i32.ne (local.get $n) (i32.const 0))
      (i32.eqz (i32.and (local.get $n) (i32.sub (local.get $n) (i32.const 1))))))

  ;; Affine guest-heap block of $n bytes (+16 slack for alignment). Returns
  ;; the GUEST pointer; $gps_wa gives the 16-aligned wasm address.
  (func $gps_alloc (param $n i32) (result i32)
    (call $gl_alloc_affine (i32.add (local.get $n) (i32.const 16))))
  (func $gps_wa (param $guest i32) (result i32)
    (i32.and (i32.add (call $g2w (local.get $guest)) (i32.const 15)) (i32.const -16)))

  ;; Claim a free directory entry for $api. Caller holds the frontend lock
  ;; (Glide's shared board lock). The opening thread becomes the first owner,
  ;; nothing more: any thread may produce later ($gps_own).
  (func $gps_ring_open (param $api i32) (param $ring_bytes i32) (param $arena_bytes i32) (result i32)
    (local $i i32) (local $h i32) (local $ring i32) (local $arena i32)
    (if (i32.eqz (i32.and (call $gps_is_pow2 (local.get $ring_bytes))
        (call $gps_is_pow2 (local.get $arena_bytes)))) (then (call $gps_fail)))
    (block $found (loop $scan
      (local.set $h (call $gps_ring (local.get $i)))
      (br_if $found (i32.eqz (i32.atomic.load (local.get $h))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (global.get $GPS_RING_MAX)))
      (return (i32.const 0))))
    (local.set $ring (call $gps_alloc (local.get $ring_bytes)))
    (if (i32.eqz (local.get $ring)) (then (return (i32.const 0))))
    (local.set $arena (call $gps_alloc (local.get $arena_bytes)))
    (if (i32.eqz (local.get $arena)) (then
      (call $heap_free (local.get $ring))
      (return (i32.const 0))))
    (memory.fill (local.get $h) (i32.const 0) (size-of GpsRing))
    (store.field.memarg GpsRing version (local.get $h) (global.get $GPS_VERSION))
    (store.field.memarg GpsRing ring_bytes (local.get $h) (local.get $ring_bytes))
    (store.field.memarg GpsRing arena_bytes (local.get $h) (local.get $arena_bytes))
    (store.field.memarg GpsRing ring_data (local.get $h) (call $gps_wa (local.get $ring)))
    (store.field.memarg GpsRing arena_data (local.get $h) (call $gps_wa (local.get $arena)))
    (store.field.memarg GpsRing ring_guest (local.get $h) (local.get $ring))
    (store.field.memarg GpsRing arena_guest (local.get $h) (local.get $arena))
    (store.field.memarg GpsRing api (local.get $h) (local.get $api))
    (store.field.memarg GpsRing seq_counter (local.get $h)
      (i32.add (local.get $h) (offset-of GpsRing seq_storage)))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing owner)) (call $lock_owner_id))
    (i32.atomic.store (local.get $h) (global.get $GPS_MAGIC))
    (local.get $h))

  ;; Return the entry and its storage (after a CLOSE kick drained the ring).
  (func $gps_ring_free (param $h i32)
    (local $ring i32) (local $arena i32)
    (local.set $ring (load.field.memarg GpsRing ring_guest (local.get $h)))
    (local.set $arena (load.field.memarg GpsRing arena_guest (local.get $h)))
    (i32.atomic.store (local.get $h) (i32.const 0))
    (memory.fill (local.get $h) (i32.const 0) (size-of GpsRing))
    (if (local.get $ring) (then (call $heap_free (local.get $ring))))
    (if (local.get $arena) (then (call $heap_free (local.get $arena)))))

  ;; Make the calling thread this ring's producer. Same owner: one atomic load.
  ;; Handoff: under the producer lock, kick what the previous owner published
  ;; (its records are complete: frontends end every record before releasing
  ;; their own lock), then take ownership. Never tied to the creating thread.
  (func $gps_own (param $h i32)
    (local $me i32) (local $lock i32)
    (local.set $me (call $lock_owner_id))
    (if (i32.eq (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing owner))) (local.get $me))
      (then (return)))
    (local.set $lock (i32.add (local.get $h) (offset-of GpsRing producer_lock)))
    (call $lock_acquire (local.get $lock))
    (if (i32.ne (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing owner))) (local.get $me))
      (then
        (if (i32.ne (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing write_pos)))
              (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing read_pos))))
          (then (drop (call $host_gpu_stream_kick (local.get $h) (global.get $GPS_KICK_ASYNC)))))
        (call $gps_check (local.get $h))
        (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing owner)) (local.get $me))
        (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing handoffs))
          (i32.add (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing handoffs))) (i32.const 1)))))
    (call $lock_release (local.get $lock)))

  ;; Forget every published and unpublished byte (after a CLOSE kick drained
  ;; the ring). Storage stays allocated for the next open on this entry.
  (func $gps_ring_reset (param $h i32)
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing write_pos)) (i32.const 0))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing read_pos)) (i32.const 0))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing arena_head)) (i32.const 0))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing arena_tail)) (i32.const 0))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing error_seq)) (i32.const 0))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing error_code)) (i32.const 0)))

  (func $gps_check (param $h i32)
    ;; A consumer that failed stops; the producer must not keep writing.
    (if (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing error_code)))
      (then (call $gps_fail))))

  ;; Hand published records to the consumer. ASYNC returns at once; SYNC and
  ;; CLOSE return after the consumer executed every published record.
  (func $gps_kick (param $h i32) (param $mode i32) (result i32)
    (local $r i32)
    (local.set $r (call $host_gpu_stream_kick (local.get $h) (local.get $mode)))
    (call $gps_check (local.get $h))
    (if (i32.and (i32.ne (local.get $mode) (global.get $GPS_KICK_ASYNC)) (i32.ne (local.get $r) (i32.const 0)))
      (then
        (if (i32.ne (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing read_pos)))
              (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing write_pos))))
          (then (call $gps_fail)))))
    (local.get $r))

  (func $gps_sync (param $h i32)
    (if (i32.ne (call $gps_kick (local.get $h) (global.get $GPS_KICK_SYNC)) (i32.const 1))
      (then (call $gps_fail))))

  ;; Reserve a record of $payload bytes and return the payload address. The
  ;; record is invisible to the consumer until $gps_end publishes it. Writes a
  ;; WRAP record when the record would cross the end of the ring.
  (func $gps_begin (param $h i32) (param $op i32) (param $payload i32) (result i32)
    (local $size i32) (local $total i32) (local $wp i32) (local $phys i32) (local $skip i32)
    (local $ring_bytes i32) (local $p i32) (local $tries i32)
    (call $gps_own (local.get $h))
    (local.set $ring_bytes (load.field.memarg GpsRing ring_bytes (local.get $h)))
    (local.set $size (i32.add (size-of GpsRecord) (local.get $payload)))
    (local.set $total (i32.and (i32.add (local.get $size) (i32.const 7)) (i32.const -8)))
    (if (i32.or (i32.lt_u (local.get $size) (local.get $payload))
        (i32.gt_u (local.get $total) (i32.shr_u (local.get $ring_bytes) (i32.const 1))))
      (then (call $gps_fail)))
    (loop $retry
      (local.set $wp (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing write_pos))))
      (local.set $phys (i32.and (local.get $wp) (i32.sub (local.get $ring_bytes) (i32.const 1))))
      (local.set $skip (i32.const 0))
      (if (i32.gt_u (i32.add (local.get $phys) (local.get $total)) (local.get $ring_bytes))
        (then (local.set $skip (i32.sub (local.get $ring_bytes) (local.get $phys)))))
      (if (i32.gt_u (i32.add (i32.add (local.get $skip) (local.get $total))
            (i32.sub (local.get $wp) (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing read_pos)))))
            (local.get $ring_bytes))
        (then
          (if (local.get $tries) (then (call $gps_fail)))
          (local.set $tries (i32.const 1))
          (call $gps_sync (local.get $h))
          (br $retry))))
    (if (local.get $skip) (then
      (local.set $p (i32.add (load.field.memarg GpsRing ring_data (local.get $h)) (local.get $phys)))
      (store.field.memarg GpsRecord op (local.get $p) (global.get $GPS_OP_WRAP))
      (store.field.memarg GpsRecord flags (local.get $p) (i32.const 0))
      (store.field.memarg GpsRecord bytes (local.get $p) (local.get $skip))
      ;; An 8-byte WRAP has no room for seq; the consumer reads op and bytes.
      (if (i32.ge_u (local.get $skip) (size-of GpsRecord))
        (then (store.field.memarg GpsRecord seq (local.get $p) (i32.const 0))))
      (local.set $wp (i32.add (local.get $wp) (local.get $skip)))
      (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing write_pos)) (local.get $wp))
      (local.set $phys (i32.const 0))))
    (local.set $p (i32.add (load.field.memarg GpsRing ring_data (local.get $h)) (local.get $phys)))
    (store.field.memarg GpsRecord op (local.get $p) (local.get $op))
    (store.field.memarg GpsRecord flags (local.get $p) (i32.const 0))
    (store.field.memarg GpsRecord bytes (local.get $p) (local.get $size))
    (i32.add (local.get $p) (size-of GpsRecord)))

  ;; Publish the record $gps_begin returned $payload_ptr for. Returns its seq.
  (func $gps_end (param $h i32) (param $payload_ptr i32) (param $flags i32) (result i32)
    (local $p i32) (local $seq i32) (local $size i32)
    (local.set $p (i32.sub (local.get $payload_ptr) (size-of GpsRecord)))
    (local.set $seq (i32.add (i32.atomic.rmw.add
      (load.field.memarg GpsRing seq_counter (local.get $h)) (i32.const 1)) (i32.const 1)))
    (store.field.memarg GpsRecord flags (local.get $p) (local.get $flags))
    (store.field.memarg GpsRecord seq (local.get $p) (local.get $seq))
    (local.set $size (i32.and (i32.add (load.field.memarg GpsRecord bytes (local.get $p)) (i32.const 7)) (i32.const -8)))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing submit_seq)) (local.get $seq))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing write_pos))
      (i32.add (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing write_pos))) (local.get $size)))
    (local.get $seq))

  ;; Arena: $n bytes, 16-aligned, never split across the end. Returns the
  ;; arena POSITION; $gps_arena_ptr gives its address. Space is reclaimed as
  ;; the consumer advances arena_tail past executed records.
  (func $gps_arena_alloc (param $h i32) (param $n i32) (result i32)
    (local $bytes i32) (local $head i32) (local $phys i32) (local $skip i32) (local $need i32)
    (local $tries i32)
    (local.set $bytes (load.field.memarg GpsRing arena_bytes (local.get $h)))
    (local.set $n (i32.and (i32.add (local.get $n) (i32.const 15)) (i32.const -16)))
    (if (i32.gt_u (local.get $n) (i32.shr_u (local.get $bytes) (i32.const 1))) (then (call $gps_fail)))
    (loop $retry
      (local.set $head (load.field.memarg GpsRing arena_head (local.get $h)))
      (local.set $phys (i32.and (local.get $head) (i32.sub (local.get $bytes) (i32.const 1))))
      (local.set $skip (i32.const 0))
      (if (i32.gt_u (i32.add (local.get $phys) (local.get $n)) (local.get $bytes))
        (then (local.set $skip (i32.sub (local.get $bytes) (local.get $phys)))))
      (local.set $need (i32.add (local.get $skip) (local.get $n)))
      (if (i32.gt_u (i32.add (local.get $need) (i32.sub (local.get $head)
            (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing arena_tail)))))
            (local.get $bytes))
        (then
          (if (local.get $tries) (then (call $gps_fail)))
          (local.set $tries (i32.const 1))
          (call $gps_sync (local.get $h))
          (br $retry))))
    (local.set $head (i32.add (local.get $head) (local.get $skip)))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing arena_head))
      (i32.add (local.get $head) (local.get $n)))
    (local.get $head))

  ;; Room for $n more bytes directly after position $end without wrapping or
  ;; waiting (open DRAW_UP growth). Returns 1 and claims it, or 0.
  (func $gps_arena_extend (param $h i32) (param $end i32) (param $n i32) (result i32)
    (local $bytes i32) (local $phys i32)
    (local.set $bytes (load.field.memarg GpsRing arena_bytes (local.get $h)))
    (if (i32.ne (load.field.memarg GpsRing arena_head (local.get $h)) (local.get $end))
      (then (return (i32.const 0))))
    (local.set $phys (i32.and (local.get $end) (i32.sub (local.get $bytes) (i32.const 1))))
    (if (i32.or (i32.eqz (local.get $phys))
        (i32.gt_u (i32.add (local.get $phys) (local.get $n)) (local.get $bytes)))
      (then (return (i32.const 0))))
    (if (i32.gt_u (i32.add (local.get $n) (i32.sub (local.get $end)
          (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing arena_tail)))))
          (local.get $bytes))
      (then (return (i32.const 0))))
    (i32.atomic.store (i32.add (local.get $h) (offset-of GpsRing arena_head))
      (i32.add (local.get $end) (local.get $n)))
    (i32.const 1))

  (func $gps_arena_ptr (param $h i32) (param $pos i32) (result i32)
    (i32.add (load.field.memarg GpsRing arena_data (local.get $h))
      (i32.and (local.get $pos) (i32.sub (load.field.memarg GpsRing arena_bytes (local.get $h)) (i32.const 1)))))

  (func $gps_slot_addr (param $h i32) (param $slot i32) (result i32)
    (if (i32.ge_u (local.get $slot) (i32.const 16)) (then (call $gps_fail)))
    (elem-addr GpsRing slots (local.get $h) (local.get $slot)))

  ;; Clear a completion slot before naming it in a FENCE/READBACK.
  (func $gps_slot_arm (param $h i32) (param $slot i32)
    (i32.atomic.store (call $gps_slot_addr (local.get $h) (local.get $slot)) (i32.const 0)))

  ;; Wait (via a sync kick) until the slot holds $seq.
  (func $gps_slot_wait (param $h i32) (param $slot i32) (param $seq i32)
    (if (i32.ne (i32.atomic.load (call $gps_slot_addr (local.get $h) (local.get $slot))) (local.get $seq))
      (then (call $gps_sync (local.get $h))))
    (if (i32.ne (i32.atomic.load (call $gps_slot_addr (local.get $h) (local.get $slot))) (local.get $seq))
      (then (call $gps_fail))))

  ;; Fixed-size helpers for the common records.
  (func $gps_release (param $h i32) (param $id i32)
    (local $p i32)
    (local.set $p (call $gps_begin (local.get $h) (global.get $GPS_OP_RELEASE) (size-of GpsRelease)))
    (store.field.memarg GpsRelease id (local.get $p) (local.get $id))
    (drop (call $gps_end (local.get $h) (local.get $p) (i32.const 0))))

  (func $gps_create (param $h i32) (param $id i32) (param $kind i32) (param $fmt i32)
      (param $levels i32) (param $w i32) (param $hgt i32) (param $size i32)
    (local $p i32)
    (local.set $p (call $gps_begin (local.get $h) (global.get $GPS_OP_CREATE) (size-of GpsCreate)))
    (store.field.memarg GpsCreate id (local.get $p) (local.get $id))
    (store.field.memarg GpsCreate kind (local.get $p) (local.get $kind))
    (store.field.memarg GpsCreate fmt (local.get $p) (local.get $fmt))
    (store.field.memarg GpsCreate levels (local.get $p) (local.get $levels))
    (store.field.memarg GpsCreate width (local.get $p) (local.get $w))
    (store.field.memarg GpsCreate height (local.get $p) (local.get $hgt))
    (store.field.memarg GpsCreate size (local.get $p) (local.get $size))
    (drop (call $gps_end (local.get $h) (local.get $p) (i32.const 0))))

  ;; Upload $bytes already placed at arena position $src.
  (func $gps_upload (param $h i32) (param $id i32) (param $level i32)
      (param $w i32) (param $hgt i32) (param $pitch i32) (param $src i32) (param $bytes i32)
    (local $p i32)
    (local.set $p (call $gps_begin (local.get $h) (global.get $GPS_OP_UPLOAD) (size-of GpsUpload)))
    (store.field.memarg GpsUpload id (local.get $p) (local.get $id))
    (store.field.memarg GpsUpload level (local.get $p) (local.get $level))
    (store.field.memarg GpsUpload face (local.get $p) (i32.const 0))
    (store.field.memarg GpsUpload x (local.get $p) (i32.const 0))
    (store.field.memarg GpsUpload y (local.get $p) (i32.const 0))
    (store.field.memarg GpsUpload w (local.get $p) (local.get $w))
    (store.field.memarg GpsUpload h (local.get $p) (local.get $hgt))
    (store.field.memarg GpsUpload pitch (local.get $p) (local.get $pitch))
    (store.field.memarg GpsUpload src (local.get $p) (local.get $src))
    (store.field.memarg GpsUpload bytes (local.get $p) (local.get $bytes))
    (drop (call $gps_end (local.get $h) (local.get $p) (i32.const 0))))

  (func $gps_mark (param $h i32) (param $frame i32) (param $tag i32)
    (local $p i32)
    (local.set $p (call $gps_begin (local.get $h) (global.get $GPS_OP_MARK) (size-of GpsMark)))
    (store.field.memarg GpsMark frame (local.get $p) (local.get $frame))
    (store.field.memarg GpsMark tag (local.get $p) (local.get $tag))
    (drop (call $gps_end (local.get $h) (local.get $p) (i32.const 0))))

  ;; Shader IR builder (src/09af-d3d-shader-ir.wat ABI 1). Frontends emit
  ;; fixed-function lowering into $gps_ir_buf with $gps_ir_ins; $gps_ir_finish
  ;; writes the header. Operand tokens use the D3D packed register token
  ;; shape: bank<<28 | index | selector<<16 | modifier<<24 (sources) and
  ;; mask<<16 | sat<<20 (destinations), converted to IR operands here.
  (func $gps_ir_operand (param $at i32) (param $token i32) (param $is_dest i32)
    (i32.store (local.get $at) (i32.and (i32.shr_u (local.get $token) (i32.const 28)) (i32.const 7)))
    (i32.store offset=4 (local.get $at) (i32.and (local.get $token) (i32.const 2047)))
    (if (local.get $is_dest)
      (then
        (i32.store offset=8 (local.get $at) (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 15)))
        (i32.store offset=12 (local.get $at) (i32.or
          (i32.and (i32.shr_u (local.get $token) (i32.const 20)) (i32.const 1))
          (i32.shl (i32.and (i32.shr_u (local.get $token) (i32.const 24)) (i32.const 15)) (i32.const 8)))))
      (else
        (i32.store offset=8 (local.get $at) (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 255)))
        (i32.store offset=12 (local.get $at) (i32.and (i32.shr_u (local.get $token) (i32.const 24)) (i32.const 15))))))

  ;; Append one instruction to the IR at $buf (header already reserved).
  ;; $n counts operands including the destination. Returns the new count.
  (func $gps_ir_ins (param $buf i32) (param $count i32) (param $op i32) (param $n i32)
      (param $d i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
    (local $at i32)
    (if (i32.ge_u (local.get $count) (i32.const 96)) (then (call $gps_fail)))
    (local.set $at (i32.add (i32.add (local.get $buf) (i32.const 32)) (i32.shl (local.get $count) (i32.const 7))))
    (memory.fill (local.get $at) (i32.const 0) (i32.const 128))
    (i32.store (local.get $at) (local.get $op))
    (i32.store offset=4 (local.get $at) (i32.add (local.get $count) (i32.const 1)))
    (i32.store offset=8 (local.get $at) (local.get $n))
    (call $gps_ir_operand (i32.add (local.get $at) (i32.const 16)) (local.get $d) (i32.const 1))
    (if (i32.ge_u (local.get $n) (i32.const 2))
      (then (call $gps_ir_operand (i32.add (local.get $at) (i32.const 32)) (local.get $a) (i32.const 0))))
    (if (i32.ge_u (local.get $n) (i32.const 3))
      (then (call $gps_ir_operand (i32.add (local.get $at) (i32.const 48)) (local.get $b) (i32.const 0))))
    (if (i32.ge_u (local.get $n) (i32.const 4))
      (then (call $gps_ir_operand (i32.add (local.get $at) (i32.const 64)) (local.get $c) (i32.const 0))))
    (i32.add (local.get $count) (i32.const 1)))

  ;; Write the 32-byte header; returns the IR byte length.
  (func $gps_ir_finish (param $buf i32) (param $count i32) (param $stage i32) (param $version i32)
      (result i32)
    (local $bytes i32)
    (local.set $bytes (i32.add (i32.const 32) (i32.shl (local.get $count) (i32.const 7))))
    (i32.store (local.get $buf) (i32.const 0x44534952))
    (i32.store offset=4 (local.get $buf) (i32.const 1))
    (i32.store offset=8 (local.get $buf) (local.get $stage))
    (i32.store offset=12 (local.get $buf) (local.get $version))
    (i32.store offset=16 (local.get $buf) (local.get $count))
    (i32.store offset=20 (local.get $buf) (i32.add (local.get $count) (i32.const 2)))
    (i32.store offset=24 (local.get $buf) (local.get $bytes))
    (i32.store offset=28 (local.get $buf) (i32.const 1))
    (local.get $bytes))
