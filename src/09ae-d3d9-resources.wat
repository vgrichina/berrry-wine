  ;; IDirect3DCubeTexture9_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_QueryInterface (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_AddRef — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_AddRef (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_Release — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_Release (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_GetDevice — 2 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_GetDevice (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_SetPrivateData — 5 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_SetPrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_SetPrivateData (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_GetPrivateData — 4 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetPrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_GetPrivateData (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_FreePrivateData — 2 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_FreePrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_FreePrivateData (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_SetPriority — 2 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_SetPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_SetPriority (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_GetPriority — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_GetPriority (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_PreLoad — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_PreLoad (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_PreLoad (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_GetType — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (local.get $arg0) (i32.const 12))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DCubeTexture9_SetLOD — 2 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_SetLOD (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_SetLOD (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_GetLOD — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetLOD (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_GetLOD (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_GetLevelCount — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetLevelCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_GetLevelCount (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DCubeTexture9_SetAutoGenFilterType — 2 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_SetAutoGenFilterType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DCubeTexture9_GetAutoGenFilterType — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetAutoGenFilterType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DCubeTexture9_GenerateMipSubLevels — 1 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GenerateMipSubLevels (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DCubeTexture9_GetLevelDesc — 3 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetLevelDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_texture_desc (local.get $arg0) (call $d3d9_cube_index (local.get $arg0) (i32.const 0) (local.get $arg1)) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DCubeTexture9_GetCubeMapSurface — 4 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_GetCubeMapSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_texture_surface (local.get $arg0) (call $d3d9_cube_index (local.get $arg0) (local.get $arg1) (local.get $arg2)) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirect3DCubeTexture9_LockRect — 6 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_LockRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_texture_lock (local.get $arg0) (call $d3d9_cube_index (local.get $arg0) (local.get $arg1) (local.get $arg2)) (local.get $arg3) (local.get $arg4) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; IDirect3DCubeTexture9_UnlockRect — 3 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_UnlockRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_UnlockRect (local.get $arg0) (call $d3d9_cube_index (local.get $arg0) (local.get $arg1) (local.get $arg2)) (i32.const 0) (i32.const 0) (i32.const 0) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; IDirect3DCubeTexture9_AddDirtyRect — 3 args (incl. this)
  (func $handle_IDirect3DCubeTexture9_AddDirtyRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $mip i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $mip (call $d3d9_texture_mip (local.get $arg0) (call $d3d9_cube_index (local.get $arg0) (local.get $arg1) (i32.const 0))))
    (if (local.get $mip) (then
      (i32.store offset=28 (local.get $mip) (i32.add (i32.load offset=28 (local.get $mip)) (i32.const 1)))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $d3d9_viewport (param $device i32) (param $ptr i32) (param $get i32)
    (local $state i32) (local $wa i32) (local $rt i32) (local $w i32) (local $h i32)
    (local $block i32)
    (local $x i32) (local $y i32) (local $width i32) (local $height i32)
    (local $min f32) (local $max f32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $ptr)) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
    (local.set $state (call $g2w (i32.add (local.get $state) (i32.const 21728))))
    (local.set $wa (call $d3d9_state_bytes (local.get $ptr) (i32.const 24)))
    (if (i32.eqz (local.get $wa)) (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $device)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (local.set $w (call $d3d9_color_extent (local.get $device) (i32.const 0)))
    (local.set $h (call $d3d9_color_extent (local.get $device) (i32.const 1)))
    (if (local.get $get) (then
      (if (i32.load offset=8 (local.get $state)) (then
        (memory.copy (local.get $wa) (local.get $state) (i32.const 24)))
      (else
        (call $zero_memory (local.get $wa) (i32.const 24))
        (i32.store offset=8 (local.get $wa) (local.get $w))
        (i32.store offset=12 (local.get $wa) (local.get $h))
        (f32.store offset=20 (local.get $wa) (f32.const 1))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $x (i32.load (local.get $wa))) (local.set $y (i32.load offset=4 (local.get $wa)))
    (local.set $width (i32.load offset=8 (local.get $wa))) (local.set $height (i32.load offset=12 (local.get $wa)))
    (if (i32.or (i32.gt_u (local.get $x) (local.get $w)) (i32.gt_u (local.get $y) (local.get $h))) (then (return)))
    (if (i32.or (i32.eqz (local.get $width)) (i32.eqz (local.get $height))) (then (return)))
    (if (i32.or (i32.gt_u (local.get $width) (i32.sub (local.get $w) (local.get $x)))
      (i32.gt_u (local.get $height) (i32.sub (local.get $h) (local.get $y)))) (then (return)))
    (local.set $min (f32.load offset=16 (local.get $wa))) (local.set $max (f32.load offset=20 (local.get $wa)))
    (if (i32.eqz (i32.and (f32.ge (local.get $min) (f32.const 0))
      (i32.and (f32.le (local.get $max) (f32.const 1)) (f32.le (local.get $min) (local.get $max))))) (then (return)))
    (if (local.get $block) (then
      (local.set $block (call $g2w (local.get $block)))
      (i32.store offset=22316 (local.get $block) (i32.const 1))
      (local.set $state (i32.add (local.get $block) (i32.const 22320)))))
    (memory.copy (local.get $state) (local.get $wa) (i32.const 24))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; D3D9 resources use heap COM objects, not the permanently retired DX slot
  ;; pool. Header +0..20 shares shader external/internal reference ownership.
  ;; Texture: +24 width,+28 height,+32 levels,+36 format,+40 usage,+44 pool,
  ;; +48 LOD,+52 priority. At +64: 32-byte mip records, then packed native pixels.
  ;; Mip: width,height,pitch,bytes,bitsGuest,lockFlags,surface,reserved/dirtySeq.
  ;; Buffer: common resource header, +24 length,+28 usage,+32 FVF/index format,
  ;; +36 pool,+40 lock flags,+52 priority; canonical byte storage starts at +64.
  ;; Device slots: +1716 buffer vtable, +1732 indices, and the 16 stream
  ;; binding records at +25340 that $d3d9_stream_slot addresses (+1720/+1724/
  ;; +1728 were stream 0's slots before there was more than one stream, and
  ;; are now unused). Bindings hold internal refs, not a parent-device cycle.
  (func $d3d9_buffer_create (param $device i32) (param $length i32) (param $usage i32)
    (param $format i32) (param $pool i32) (param $out i32) (param $kind i32)
    (local $state i32) (local $vtbl i32) (local $obj i32) (local $wa i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (if (i32.or (i32.eqz (local.get $length)) (i32.gt_u (local.get $length) (i32.const 0x1000000))) (then (return)))
    (if (i32.gt_u (local.get $pool) (i32.const 2)) (then (return)))
    (if (i32.and (local.get $usage) (i32.const -537)) (then (return))) ;; WRITEONLY|SOFTWAREPROCESSING|DYNAMIC
    (if (i32.and (i32.ne (i32.and (local.get $usage) (i32.const 512)) (i32.const 0))
      (i32.eq (local.get $pool) (i32.const 1))) (then (return)))
    (if (i32.eq (local.get $kind) (i32.const 7)) (then
      (if (i32.and (i32.ne (local.get $format) (i32.const 101))
        (i32.ne (local.get $format) (i32.const 102))) (then (return)))))
    (local.set $vtbl (call $gl32 (i32.add (local.get $state) (i32.const 1716))))
    (if (i32.eqz (local.get $vtbl)) (then
      (local.set $vtbl (call $init_com_vtable (global.get $API_ID_IDirect3DBuffer9_BASE) (i32.const 14)))
      (call $gs32 (i32.add (local.get $state) (i32.const 1716)) (local.get $vtbl))))
    (if (i32.eqz (local.get $vtbl)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) (return)))
    (local.set $obj (call $heap_alloc (i32.add (local.get $length) (i32.const 64))))
    (if (i32.eqz (local.get $obj)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) (return)))
    (local.set $wa (call $g2w (local.get $obj)))
    (call $zero_memory (local.get $wa) (i32.add (local.get $length) (i32.const 64)))
    (i32.store (local.get $wa) (local.get $vtbl))
    (i32.store offset=4 (local.get $wa) (i32.const 1))
    (i32.store offset=8 (local.get $wa) (local.get $device))
    (i32.store offset=12 (local.get $wa) (local.get $kind))
    (i32.store offset=16 (local.get $wa) (i32.add (local.get $length) (i32.const 64)))
    (i32.store offset=24 (local.get $wa) (local.get $length))
    (i32.store offset=28 (local.get $wa) (local.get $usage))
    (i32.store offset=32 (local.get $wa) (local.get $format))
    (i32.store offset=36 (local.get $wa) (local.get $pool))
    (call $d3d9_reset_resource (local.get $wa) (i32.const 1))
    (drop (call $d3d9_device_addref (local.get $device)))
    (call $gs32 (local.get $out) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_buffer_lock (param $buffer i32) (param $offset i32) (param $size i32)
    (param $out i32) (param $flags i32)
    (local $wa i32) (local $length i32) (local $usage i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (local.set $wa (call $g2w (local.get $buffer)))
    (local.set $length (i32.load offset=24 (local.get $wa)))
    (local.set $usage (i32.load offset=28 (local.get $wa)))
    (if (i32.load offset=40 (local.get $wa)) (then (return)))
    (if (i32.ge_u (local.get $offset) (local.get $length)) (then (return)))
    (if (i32.eqz (local.get $size)) (then (local.set $size (i32.sub (local.get $length) (local.get $offset)))))
    (if (i32.gt_u (local.get $size) (i32.sub (local.get $length) (local.get $offset))) (then (return)))
    (if (i32.and (local.get $flags) (i32.const -14353)) (then (return))) ;; READONLY|NOSYSLOCK|DISCARD|NOOVERWRITE
    (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 0x3000)) (i32.const 0))
      (i32.eqz (i32.and (local.get $usage) (i32.const 512)))) (then (return)))
    (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 16)) (i32.const 0))
      (i32.ne (i32.or (i32.and (local.get $usage) (i32.const 8))
        (i32.and (local.get $flags) (i32.const 0x3000))) (i32.const 0))) (then (return)))
    ;; Synchronous draw snapshots make DISCARD/NOOVERWRITE safe without retaining
    ;; previous CPU storage: no in-flight GPU command references these bytes.
    (i32.store offset=40 (local.get $wa) (i32.or (local.get $flags) (i32.const 0x80000000)))
    (call $gs32 (local.get $out) (i32.add (local.get $buffer) (i32.add (i32.const 64) (local.get $offset))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Where stream $index's binding record lives, as a guest address. The record
  ;; is four dwords: +0 buffer, +4 offset, +8 stride, +12 the byte pointer the
  ;; last draw computed for it (zero when the stream is unusable for that draw).
  ;;
  ;; There used to be exactly one stream, at +1720/+1724/+1728, and that is why
  ;; $handle_IDirect3DDevice9_SetStreamSource ignored every index but 0 and
  ;; $d3d9_declaration_create refused every element naming a stream but 0 --
  ;; both silently. Black & White 2 declares TEXCOORD2 on stream 1 throughout
  ;; its menus, so those refusals took the declaration, and every draw using it,
  ;; with them. The table is 16 records because D3D9 devices expose 16 streams;
  ;; it lives at the end of the device state, past the user clip planes. The
  ;; old three slots are retired, not mirrored -- a
  ;; mirror is a second place for stream 0 to be right or wrong.
  (func $d3d9_stream_slot (param $state i32) (param $index i32) (result i32)
    (i32.add (local.get $state) (i32.add (i32.const 25340) (i32.mul (local.get $index) (i32.const 16)))))

  (func $d3d9_buffer_bind (param $device i32) (param $buffer i32) (param $kind i32)
    (param $offset i32) (param $stride i32) (param $stream i32)
    (local $state i32) (local $slot i32) (local $old i32) (local $wa i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (if (i32.ge_u (local.get $stream) (i32.const 16)) (then (return)))
    (if (local.get $buffer) (then
      (local.set $wa (call $g2w (local.get $buffer)))
      (if (i32.ne (i32.load offset=12 (local.get $wa)) (local.get $kind)) (then (return)))
      (if (i32.ne (i32.load offset=8 (local.get $wa)) (local.get $device)) (then (return)))
      (if (i32.eq (local.get $kind) (i32.const 6)) (then
        (if (i32.ge_u (local.get $offset) (i32.load offset=24 (local.get $wa))) (then (return)))
        (if (i32.or (i32.eqz (local.get $stride)) (i32.gt_u (local.get $stride) (i32.const 255))) (then (return)))))))
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
    (if (local.get $block) (then
      (call $d3d9_stateblock_buffer (call $g2w (local.get $block)) (local.get $buffer)
        (local.get $kind) (local.get $offset) (local.get $stride))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (local.get $buffer) (then
      (i32.store offset=20 (local.get $wa) (i32.add (i32.load offset=20 (local.get $wa)) (i32.const 1)))))
    (local.set $slot (select
      (call $d3d9_stream_slot (local.get $state) (local.get $stream))
      (i32.add (local.get $state) (i32.const 1732))
      (i32.eq (local.get $kind) (i32.const 6))))
    (local.set $old (call $gl32 (local.get $slot)))
    (call $gs32 (local.get $slot) (local.get $buffer))
    (if (i32.eq (local.get $kind) (i32.const 6)) (then
      (call $gs32 (i32.add (local.get $slot) (i32.const 4)) (local.get $offset))
      (call $gs32 (i32.add (local.get $slot) (i32.const 8)) (local.get $stride))))
    (call $d3d9_shader_unbind (local.get $old))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirect3DBuffer9_SetPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_SetPriority (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirect3DBuffer9_GetPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_GetPriority (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirect3DBuffer9_SetPrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IDirect3DBuffer9_GetPrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DBuffer9_FreePrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DBuffer9_PreLoad (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Residency hint: CPU-canonical buffers are uploaded synchronously at Draw.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DBuffer9_GetType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (local.get $arg0) (i32.const 12))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DBuffer9_Lock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_buffer_lock (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IDirect3DBuffer9_Unlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (call $gl32 (i32.add (local.get $arg0) (i32.const 40))) (then
      (call $gs32 (i32.add (local.get $arg0) (i32.const 40)) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DBuffer9_GetDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $kind i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (local.get $arg1) (then
      (local.set $wa (call $g2w (local.get $arg0)))
      (local.set $kind (i32.load offset=12 (local.get $wa)))
      (call $gs32 (local.get $arg1) (select (i32.const 100) (i32.load offset=32 (local.get $wa))
        (i32.eq (local.get $kind) (i32.const 6))))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (local.get $kind))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 8)) (i32.load offset=28 (local.get $wa)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 12)) (i32.load offset=36 (local.get $wa)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 16)) (i32.load offset=24 (local.get $wa)))
      (if (i32.eq (local.get $kind) (i32.const 6)) (then
        (call $gs32 (i32.add (local.get $arg1) (i32.const 20)) (i32.load offset=32 (local.get $wa)))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DBuffer9_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lo i64) (local $hi i64) (local $vertex i32) (local $match i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
    (block $done
      (br_if $done (i32.eqz (local.get $arg2)))
      (call $gs32 (local.get $arg2) (i32.const 0))
      (br_if $done (i32.eqz (local.get $arg1)))
      (local.set $lo (i64.load (call $g2w (local.get $arg1))))
      (local.set $hi (i64.load offset=8 (call $g2w (local.get $arg1))))
      (local.set $vertex (i32.eq (call $gl32 (i32.add (local.get $arg0) (i32.const 12))) (i32.const 6)))
      (local.set $match (i32.or
        (i32.and (i64.eq (local.get $lo) (i64.const 0)) (i64.eq (local.get $hi) (i64.const 0x46000000000000c0)))
        (i32.or
          (i32.and (i64.eq (local.get $lo) (i64.const 0x43628f7d05eec05d)) (i64.eq (local.get $hi) (i64.const 0x04c757f3bad199b9)))
          (i32.and
            (i64.eq (local.get $lo) (select (i64.const 0x4df6fd70b64bb1b5) (i64.const 0x4529d3f77c9dd65e) (local.get $vertex)))
            (i64.eq (local.get $hi) (select (i64.const 0xe35524a1d01991bf) (i64.const 0x35deac305878eeac) (local.get $vertex)))))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
      (br_if $done (i32.eqz (local.get $match)))
      (drop (call $d3d9_shader_addref (local.get $arg0)))
      (call $gs32 (local.get $arg2) (local.get $arg0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; The first byte stream $index contributes to this draw, or 0 when it cannot
  ;; contribute one: nothing bound, the buffer locked, a zero stride, a range
  ;; that runs past the buffer, or an address that does not fit in 32 bits.
  ;; $end is the exclusive highest vertex index the draw will read.
  (func $d3d9_stream_pointer (param $state i32) (param $index i32) (param $base i32)
    (param $end i64) (param $indexed i32) (result i32)
    (local $slot i32) (local $vb i32) (local $stride i32) (local $offset i32) (local $ptr i64)
    (local.set $slot (call $d3d9_stream_slot (local.get $state) (local.get $index)))
    (local.set $vb (call $gl32 (local.get $slot)))
    (if (i32.eqz (local.get $vb)) (then (return (i32.const 0))))
    (if (call $gl32 (i32.add (local.get $vb) (i32.const 40))) (then (return (i32.const 0))))
    (local.set $offset (call $gl32 (i32.add (local.get $slot) (i32.const 4))))
    (local.set $stride (call $gl32 (i32.add (local.get $slot) (i32.const 8))))
    (if (i32.eqz (local.get $stride)) (then (return (i32.const 0))))
    (if (i64.gt_u
      (i64.add (i64.extend_i32_u (local.get $offset))
        (i64.mul (local.get $end) (i64.extend_i32_u (local.get $stride))))
      (i64.extend_i32_u (call $gl32 (i32.add (local.get $vb) (i32.const 24)))))
      (then (return (i32.const 0))))
    (local.set $ptr (i64.add (i64.extend_i32_u (i32.add (local.get $vb) (i32.const 64)))
      (i64.add (i64.extend_i32_u (local.get $offset))
        (i64.mul (select (i64.extend_i32_s (local.get $base)) (i64.extend_i32_u (local.get $base)) (local.get $indexed))
          (i64.extend_i32_u (local.get $stride))))))
    (if (i64.gt_u (local.get $ptr) (i64.const 0xffffffff)) (then (return (i32.const 0))))
    (i32.wrap_i64 (local.get $ptr)))

  (func $d3d9_draw_buffer (param $device i32) (param $primitive i32) (param $base i32)
    (param $min i32) (param $num i32) (param $start i32) (param $primitives i32) (param $indexed i32)
    (local $i i32) (local $state i32) (local $ib i32)
    (local $count i32) (local $desc i32) (local $format i32)
    (local $index_bytes i32) (local $first i64) (local $end i64)
    (local $result i32)
    (block $issue
    (if (global.get $d3d_render_token) (then
      (local.set $result (call $d3d_render_poll)) (br $issue)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    ;; The GPU frontend validates both programmed and fixed-function stages.
    (if (call $d3d9_bound_dc_held (local.get $device)) (then (return)))
    (if (i32.or (i32.eqz (local.get $primitive)) (i32.gt_u (local.get $primitive) (i32.const 6))) (then (return)))
    (if (i32.gt_u (local.get $primitives) (i32.const 0x100000)) (then (return)))
    (local.set $count (local.get $primitives))
    (if (local.get $count) (then
      (if (i32.eq (local.get $primitive) (i32.const 2)) (then (local.set $count (i32.mul (local.get $count) (i32.const 2)))))
      (if (i32.eq (local.get $primitive) (i32.const 3)) (then (local.set $count (i32.add (local.get $count) (i32.const 1)))))
      (if (i32.eq (local.get $primitive) (i32.const 4)) (then (local.set $count (i32.mul (local.get $count) (i32.const 3)))))
      (if (i32.ge_u (local.get $primitive) (i32.const 5)) (then (local.set $count (i32.add (local.get $count) (i32.const 2)))))))
    (if (local.get $indexed) (then
      (local.set $first (i64.add (i64.extend_i32_s (local.get $base)) (i64.extend_i32_u (local.get $min))))
      (local.set $end (i64.add (local.get $first) (i64.extend_i32_u (local.get $num))))
      (local.set $ib (call $gl32 (i32.add (local.get $state) (i32.const 1732))))
      (if (i32.eqz (local.get $ib)) (then (return)))
      (if (call $gl32 (i32.add (local.get $ib) (i32.const 40))) (then (return)))
      (local.set $format (call $gl32 (i32.add (local.get $ib) (i32.const 32))))
      (local.set $index_bytes (select (i32.const 2) (i32.const 4) (i32.eq (local.get $format) (i32.const 101))))
      (if (i64.gt_u
        (i64.mul (i64.add (i64.extend_i32_u (local.get $start)) (i64.extend_i32_u (local.get $count)))
          (i64.extend_i32_u (local.get $index_bytes)))
        (i64.extend_i32_u (call $gl32 (i32.add (local.get $ib) (i32.const 24))))) (then (return))))
    (else
      (local.set $first (i64.extend_i32_u (local.get $base)))
      (local.set $end (i64.add (local.get $first) (i64.extend_i32_u (local.get $count))))))
    (if (i64.lt_s (local.get $first) (i64.const 0)) (then (return)))
    (local.set $desc (call $d3d9_gpu_descriptor (local.get $device)))
    (if (i32.eqz (local.get $desc)) (then (return)))
    (i32.store offset=24 (local.get $desc) (local.get $primitive))
    (i32.store offset=28 (local.get $desc) (local.get $primitives))
    ;; Buffered draws consume the binding table below. These legacy fields are
    ;; retained for Draw*UP descriptors, which have no table and use stream 0.
    (i32.store offset=32 (local.get $desc) (i32.const 0))
    (i32.store offset=36 (local.get $desc) (i32.const 0))
    ;; Publish a byte pointer for every stream the declaration might name. Only
    ;; an unusable stream records zero and lib/d3d9-host.js raises only if an
    ;; attribute actually reads it. A stream left bound from
    ;; an earlier draw and unused by this declaration must not cost this draw
    ;; anything, which is why this is not a validation loop.
    (local.set $i (i32.const 0))
    (loop $streams
      (call $gs32 (i32.add (call $d3d9_stream_slot (local.get $state) (local.get $i)) (i32.const 12))
        (call $d3d9_stream_pointer (local.get $state) (local.get $i) (local.get $base)
          (local.get $end) (local.get $indexed)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $streams (i32.lt_u (local.get $i) (i32.const 16))))
    (i32.store offset=60 (local.get $desc) (call $d3d9_stream_slot (local.get $state) (i32.const 0)))
    (if (local.get $indexed) (then
      (i32.store offset=44 (local.get $desc) (i32.add (local.get $ib)
        (i32.add (i32.const 64) (i32.mul (local.get $start) (local.get $index_bytes)))))
      (i32.store offset=48 (local.get $desc) (local.get $format))
      (i32.store offset=52 (local.get $desc) (local.get $min))
      (i32.store offset=56 (local.get $desc) (local.get $num))))
    (local.set $result (call $host_gpu_gl_call (i32.const 0x30001) (local.get $desc) (i32.const 0))))
    (if (call $d3d_render_park (local.get $result) (i32.const 0)) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x8876086c) (i32.eq (local.get $result) (i32.const 1)))))

  ;; Why $d3d9_declaration_create refused, counted. The refusal itself is
  ;; invisible: it sets eax to D3DERR_INVALIDCALL, leaves *out at 0 and
  ;; returns, so a guest that does not check HRESULTs carries a NULL
  ;; declaration around and the consequence surfaces thousands of draws later,
  ;; somewhere else, as a draw with neither a declaration nor an FVF that
  ;; lib/d3d9-host.js drops with a bare "D3D9 FVF 0 is not implemented".
  ;; Black & White 2's world pass loses about 61% of its draws that way and no
  ;; error count in the system moves. These three globals are what make the
  ;; question answerable at all: how many, on which rule, and which element.
  (global $d3d9_decl_reject_count (mut i32) (i32.const 0))
  (global $d3d9_decl_reject_mask (mut i32) (i32.const 0))
  ;; The element is kept as its two raw dwords rather than decoded fields: the
  ;; type and usage live in the high one, and tools/d3d9-decl-decode.js already
  ;; knows how to read the pair.
  (global $d3d9_decl_reject_element (mut i32) (i32.const 0))
  (global $d3d9_decl_reject_element_hi (mut i32) (i32.const 0))
  (global $d3d9_decl_reject_reason (mut i32) (i32.const 0))
  (global $d3d9_decl_reject_element2 (mut i32) (i32.const 0))
  (global $d3d9_decl_reject_element2_hi (mut i32) (i32.const 0))
  (global $d3d9_decl_reject_reason2 (mut i32) (i32.const 0))
  ;; $reason is one bit, so a run that trips several rules reports all of them
  ;; rather than only the last. Two element slots, not one: keeping only the
  ;; very first refusal's element was measured to be too few, because Black &
  ;; White 2 trips `stream != 0` in its menus and `type > 4` later, as the land
  ;; loads -- a single slot reports the first rule with an element and the
  ;; second with a bare bit, which is exactly enough to scope a fix at half its
  ;; real size. So slot 1 keeps the first refusal and slot 2 the first refusal
  ;; whose reason DIFFERS from it. Each slot also records its own reason, so a
  ;; reader never has to guess which bit an element belongs to.
  (func $d3d9_decl_reject (param $reason i32) (param $element i32)
    (global.set $d3d9_decl_reject_mask
      (i32.or (global.get $d3d9_decl_reject_mask) (local.get $reason)))
    (global.set $d3d9_decl_reject_count
      (i32.add (global.get $d3d9_decl_reject_count) (i32.const 1)))
    (if (i32.eqz (global.get $d3d9_decl_reject_reason)) (then
      (global.set $d3d9_decl_reject_reason (local.get $reason))
      (if (local.get $element) (then
        (global.set $d3d9_decl_reject_element (i32.load (local.get $element)))
        (global.set $d3d9_decl_reject_element_hi (i32.load offset=4 (local.get $element)))))
      (return)))
    (if (i32.or (i32.eq (local.get $reason) (global.get $d3d9_decl_reject_reason))
                (i32.ne (global.get $d3d9_decl_reject_reason2) (i32.const 0)))
      (then (return)))
    (global.set $d3d9_decl_reject_reason2 (local.get $reason))
    (if (local.get $element) (then
      (global.set $d3d9_decl_reject_element2 (i32.load (local.get $element)))
      (global.set $d3d9_decl_reject_element2_hi (i32.load offset=4 (local.get $element))))))

  ;; Immutable vertex declaration: resource header, then 8-byte elements incl.
  ;; D3DDECL_END. Device +1736 caches its vtable; +8 owns the current binding.
  (func $d3d9_declaration_create (param $device i32) (param $elements i32) (param $out i32)
    (local $state i32) (local $src i32) (local $i i32) (local $element i32)
    (local $vtbl i32) (local $obj i32) (local $wa i32) (local $bytes i32) (local $j i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $out)) (then
      (call $d3d9_decl_reject (i32.const 0x001) (i32.const 0)) (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (if (i32.eqz (local.get $elements)) (then
      (call $d3d9_decl_reject (i32.const 0x002) (i32.const 0)) (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then
      (call $d3d9_decl_reject (i32.const 0x004) (i32.const 0)) (return)))
    (local.set $src (call $g2w (local.get $elements)))
    (block $end (loop $scan
      (if (i32.gt_u (local.get $i) (i32.const 16)) (then
        (call $d3d9_decl_reject (i32.const 0x008) (local.get $element)) (return)))
      (local.set $element (i32.add (local.get $src) (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.eq (i32.load (local.get $element)) (i32.const 255)) (then
        (if (i32.ne (i32.load offset=4 (local.get $element)) (i32.const 17)) (then
          (call $d3d9_decl_reject (i32.const 0x010) (local.get $element)) (return)))
        (br $end)))
      ;; The renderer supports all 16 D3D9 streams with the DEFAULT method, and
      ;; every D3DDECLTYPE from FLOAT1 (0) through FLOAT16_4 (16) -- the
      ;; backend's DECL_TYPES table in lib/d3d9-software-backend.js decodes all
      ;; of them. 17 is D3DDECLTYPE_UNUSED, which is only legal in D3DDECL_END
      ;; and is handled above. Both limits used to be narrower (stream 0 only,
      ;; type <= D3DCOLOR) and both refusals were silent, which is how Black &
      ;; White 2 lost its menus' stream-1 TEXCOORD2 and its land's SHORT4
      ;; positions without a single error being raised.
      (if (i32.ge_u (i32.load16_u (local.get $element)) (i32.const 16)) (then
        (call $d3d9_decl_reject (i32.const 0x020) (local.get $element)) (return)))
      (if (i32.and (i32.load16_u offset=2 (local.get $element)) (i32.const 3)) (then
        (call $d3d9_decl_reject (i32.const 0x040) (local.get $element)) (return)))
      (if (i32.gt_u (i32.load8_u offset=4 (local.get $element)) (i32.const 16)) (then
        (call $d3d9_decl_reject (i32.const 0x080) (local.get $element)) (return)))
      (if (i32.load8_u offset=5 (local.get $element)) (then
        (call $d3d9_decl_reject (i32.const 0x100) (local.get $element)) (return)))
      (if (i32.gt_u (i32.load8_u offset=6 (local.get $element)) (i32.const 13)) (then
        (call $d3d9_decl_reject (i32.const 0x200) (local.get $element)) (return)))
      (if (i32.gt_u (i32.load8_u offset=7 (local.get $element)) (i32.const 15)) (then
        (call $d3d9_decl_reject (i32.const 0x400) (local.get $element)) (return)))
      (local.set $j (i32.const 0))
      (block $unique (loop $previous
        (br_if $unique (i32.ge_u (local.get $j) (local.get $i)))
        (if (i32.eq (i32.load16_u offset=6 (local.get $element))
          (i32.load16_u offset=6 (i32.add (local.get $src) (i32.mul (local.get $j) (i32.const 8))))) (then
          (call $d3d9_decl_reject (i32.const 0x800) (local.get $element)) (return)))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $previous)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    (if (i32.eqz (local.get $i)) (then
      (call $d3d9_decl_reject (i32.const 0x1000) (i32.const 0)) (return)))
    (local.set $bytes (i32.mul (i32.add (local.get $i) (i32.const 1)) (i32.const 8)))
    (local.set $vtbl (call $gl32 (i32.add (local.get $state) (i32.const 1736))))
    (if (i32.eqz (local.get $vtbl)) (then
      (local.set $vtbl (call $init_com_vtable (global.get $API_ID_IDirect3DVertexDeclaration9_BASE) (i32.const 5)))
      (call $gs32 (i32.add (local.get $state) (i32.const 1736)) (local.get $vtbl))))
    (if (i32.eqz (local.get $vtbl)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e))
      (call $d3d9_decl_reject (i32.const 0x2000) (i32.const 0)) (return)))
    (local.set $obj (call $heap_alloc (i32.add (local.get $bytes) (i32.const 24))))
    (if (i32.eqz (local.get $obj)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e))
      (call $d3d9_decl_reject (i32.const 0x4000) (i32.const 0)) (return)))
    (local.set $wa (call $g2w (local.get $obj)))
    (i32.store (local.get $wa) (local.get $vtbl))
    (i32.store offset=4 (local.get $wa) (i32.const 1))
    (i32.store offset=8 (local.get $wa) (local.get $device))
    (i32.store offset=12 (local.get $wa) (i32.const 0xd3d90002))
    (i32.store offset=16 (local.get $wa) (local.get $bytes))
    (i32.store offset=20 (local.get $wa) (i32.const 0))
    (memory.copy (i32.add (local.get $wa) (i32.const 24)) (local.get $src) (local.get $bytes))
    (drop (call $d3d9_device_addref (local.get $device)))
    (call $gs32 (local.get $out) (local.get $obj)) (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_declaration_bind (param $device i32) (param $declaration i32)
    (local $state i32) (local $wa i32) (local $old i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (if (local.get $declaration) (then
      (local.set $wa (call $g2w (local.get $declaration)))
      (if (i32.ne (i32.load offset=12 (local.get $wa)) (i32.const 0xd3d90002)) (then (return)))
      (if (i32.ne (i32.load offset=8 (local.get $wa)) (local.get $device)) (then (return)))
    ))
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
    (if (local.get $block) (then
      (call $d3d9_stateblock_declaration (call $g2w (local.get $block)) (local.get $declaration) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (local.get $declaration) (then
      (i32.store offset=20 (local.get $wa) (i32.add (i32.load offset=20 (local.get $wa)) (i32.const 1)))))
    (local.set $old (call $gl32 (i32.add (local.get $state) (i32.const 8))))
    (call $gs32 (i32.add (local.get $state) (i32.const 8)) (local.get $declaration))
    (call $gs32 (i32.add (local.get $state) (i32.const 12)) (i32.const 0))
    (call $d3d9_shader_unbind (local.get $old)) (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirect3DVertexDeclaration9_GetDeclaration (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $bytes i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (local.get $arg2) (then
      (local.set $bytes (call $gl32 (i32.add (local.get $arg0) (i32.const 16))))
      (call $gs32 (local.get $arg2) (i32.div_u (local.get $bytes) (i32.const 8)))
      (if (local.get $arg1) (then
        (memory.copy (call $g2w (local.get $arg1)) (call $g2w (i32.add (local.get $arg0) (i32.const 24))) (local.get $bytes))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DVertexDeclaration9_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lo i64) (local $hi i64)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
    (block $done
      (br_if $done (i32.eqz (local.get $arg2)))
      (call $gs32 (local.get $arg2) (i32.const 0))
      (br_if $done (i32.eqz (local.get $arg1)))
      (local.set $lo (i64.load (call $g2w (local.get $arg1))))
      (local.set $hi (i64.load offset=8 (call $g2w (local.get $arg1))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
      (br_if $done (i32.eqz (i32.or
        (i32.and (i64.eq (local.get $lo) (i64.const 0)) (i64.eq (local.get $hi) (i64.const 0x46000000000000c0)))
        (i32.and (i64.eq (local.get $lo) (i64.const 0x409836fadd13c59c)) (i64.eq (local.get $hi) (i64.const 0x4685dc39edc7fba8))))))
      (drop (call $d3d9_shader_addref (local.get $arg0)))
      (call $gs32 (local.get $arg2) (local.get $arg0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Queries own a device reference. EVENT END drains the backend. Software
  ;; OCCLUSION BEGIN/END queue ordered brackets; GetData polls without parking.
  ;; Header40 uses common resource lifetime; +24 type,+28 EVENT HRESULT,
  ;; +32 occlusion DWORD,+36 phase(0new,1issued,2building,3release pending).
  ;; Async broker callbacks never write this allocation: only current GetData
  ;; copies a ready result, so Release may reclaim it while END is in flight.
  (func $d3d9_query_create (param $device i32) (param $type i32) (param $out i32)
    (local $state i32) (local $vtbl i32) (local $obj i32) (local $wa i32)
    (if (local.get $out) (then (call $gs32 (local.get $out) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086a)) ;; D3DERR_NOTAVAILABLE
    (if (i32.ne (local.get $type) (i32.const 8)) (then
      (if (i32.ne (local.get $type) (i32.const 9)) (then (return)))
      (if (i32.ne (call $host_gpu_gl_call (i32.const 0x3000a) (i32.const 0) (local.get $device)) (i32.const 1))
        (then (return)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $out)) (then (return))) ;; support probe
    (local.set $vtbl (call $gl32 (i32.add (local.get $state) (i32.const 21720))))
    (if (i32.eqz (local.get $vtbl)) (then
      (local.set $vtbl (call $init_com_vtable (global.get $API_ID_IDirect3DQuery9_BASE) (i32.const 8)))
      (call $gs32 (i32.add (local.get $state) (i32.const 21720)) (local.get $vtbl))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e))
    (if (i32.eqz (local.get $vtbl)) (then (return)))
    (local.set $obj (call $heap_alloc (i32.const 40)))
    (if (i32.eqz (local.get $obj)) (then (return)))
    (local.set $wa (call $g2w (local.get $obj)))
    (call $zero_memory (local.get $wa) (i32.const 40))
    (i32.store (local.get $wa) (local.get $vtbl))
    (i32.store offset=4 (local.get $wa) (i32.const 1))
    (i32.store offset=8 (local.get $wa) (local.get $device))
    (i32.store offset=12 (local.get $wa) (i32.const 0xd3d90004))
    (i32.store offset=16 (local.get $wa) (i32.const 4))
    (i32.store offset=24 (local.get $wa) (local.get $type))
    (drop (call $d3d9_device_addref (local.get $device)))
    (call $gs32 (local.get $out) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirect3DQuery9_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.eq (call $gl32 (i32.add (local.get $arg0) (i32.const 24))) (i32.const 9))
      (i32.and (i32.eq (call $gl32 (i32.add (local.get $arg0) (i32.const 4))) (i32.const 1))
        (i32.ne (call $gl32 (i32.add (local.get $arg0) (i32.const 36))) (i32.const 3)))) (then
      (drop (call $host_gpu_gl_call (i32.const 0x3000e) (call $g2w (local.get $arg0)) (local.get $arg0)))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 36)) (i32.const 3))))
    (call $handle_IDirect3DShader9_Release (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IDirect3DQuery9_GetType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (local.get $arg0) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirect3DQuery9_GetDataSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (local.get $arg0) (i32.const 16))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirect3DQuery9_Issue (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $desc i32)
    (if (call $gl32 (i32.add (call $d3d9_program_state
      (call $gl32 (i32.add (local.get $arg0) (i32.const 8)))) (i32.const 21776))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760868))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eq (call $gl32 (i32.add (local.get $arg0) (i32.const 24))) (i32.const 9)) (then
      (block $query_done
        (br_if $query_done (i32.eqz (i32.or (i32.eq (local.get $arg1) (i32.const 1))
          (i32.eq (local.get $arg1) (i32.const 2)))))
        (local.set $desc (call $d3d9_gpu_descriptor (call $gl32 (i32.add (local.get $arg0) (i32.const 8)))))
        (br_if $query_done (i32.eqz (local.get $desc)))
        (local.set $result (call $host_gpu_gl_call
          (select (i32.const 0x3000b) (i32.const 0x3000c) (i32.eq (local.get $arg1) (i32.const 2)))
          (local.get $desc) (local.get $arg0)))
        (br_if $query_done (i32.ne (local.get $result) (i32.const 1)))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 36)) (local.get $arg1))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const 1)) (then
      (local.set $result (if (result i32) (global.get $d3d_render_token)
        (then (call $d3d_render_poll))
        (else (call $host_gpu_gl_call (i32.const 0x30006) (i32.const 0)
          (call $gl32 (i32.add (local.get $arg0) (i32.const 8)))))))
      (if (call $d3d_render_park (local.get $result) (i32.const 0)) (then (return)))
      (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x88760868)
        (i32.eq (local.get $result) (i32.const 1))))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 28)) (i32.load offset=0 (global.get $reg_base)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirect3DQuery9_GetData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $phase i32) (local $result i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (block $done
      (br_if $done (i32.and (local.get $arg3) (i32.const -2)))
      (if (local.get $arg2) (then
        (br_if $done (i32.or (i32.ne (local.get $arg2) (i32.const 4)) (i32.eqz (local.get $arg1))))))
      (if (call $gl32 (i32.add (call $d3d9_program_state
        (call $gl32 (i32.add (local.get $arg0) (i32.const 8)))) (i32.const 21776))) (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760868)) (br $done)))
      (if (i32.eq (call $gl32 (i32.add (local.get $arg0) (i32.const 24))) (i32.const 9)) (then
        (local.set $phase (call $gl32 (i32.add (local.get $arg0) (i32.const 36))))
        (br_if $done (i32.ge_u (local.get $phase) (i32.const 2)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (if (local.get $phase) (then
          (local.set $result (call $host_gpu_gl_call (i32.const 0x3000d) (call $g2w (local.get $arg0)) (local.get $arg0)))
          (i32.store offset=0 (global.get $reg_base) (select (i32.const 1) (i32.const 0x88760868) (i32.eqz (local.get $result))))
          (br_if $done (i32.ne (local.get $result) (i32.const 1)))
          (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
        (if (local.get $arg2) (then (call $gs32 (local.get $arg1)
          (call $gl32 (i32.add (local.get $arg0) (i32.const 32))))))
        (br $done)))
      (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (local.get $arg0) (i32.const 28))))
      (if (i32.and (i32.eqz (i32.load offset=0 (global.get $reg_base))) (i32.ne (local.get $arg2) (i32.const 0)))
        (then (call $gs32 (local.get $arg1) (i32.const 1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirect3DQuery9_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lo i64) (local $hi i64)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
    (block $done
      (br_if $done (i32.eqz (local.get $arg2)))
      (call $gs32 (local.get $arg2) (i32.const 0))
      (br_if $done (i32.eqz (local.get $arg1)))
      (local.set $lo (i64.load (call $g2w (local.get $arg1))))
      (local.set $hi (i64.load offset=8 (call $g2w (local.get $arg1))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
      (br_if $done (i32.eqz (i32.or
        (i32.and (i64.eq (local.get $lo) (i64.const 0)) (i64.eq (local.get $hi) (i64.const 0x46000000000000c0)))
        (i32.and (i64.eq (local.get $lo) (i64.const 0x4f26a695d9771460)) (i64.eq (local.get $hi) (i64.const 0xcc41b540b827d3bb))))))
      (drop (call $d3d9_shader_addref (local.get $arg0)))
      (call $gs32 (local.get $arg2) (local.get $arg0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Selective state blocks: header24, byte masks[320], values[320],
  ;; texture masks[4] at1624 and internally retained texture pointers at1628.
  ;; Indices0..255 are render states;256..319 are four sampler rows of16.
  ;; Begin owns one internal ref; End transfers it to a caller/device ref.
  ;; Appended stage4/5 storage preserves every established device/block offset.
  (func $d3d9_texture_offset (param $stage i32) (result i32)
    (i32.add (select (i32.const 1700) (i32.const 21776) (i32.lt_u (local.get $stage) (i32.const 4)))
      (i32.shl (local.get $stage) (i32.const 2))))
  (func $d3d9_sampler_offset (param $stage i32) (result i32)
    (i32.add (select (i32.const 1808) (i32.const 21544) (i32.lt_u (local.get $stage) (i32.const 4)))
      (i32.shl (local.get $stage) (i32.const 6))))
  (func $d3d9_block_texture_offset (param $stage i32) (result i32)
    (i32.add (select (i32.const 1628) (i32.const 22056) (i32.lt_u (local.get $stage) (i32.const 4)))
      (i32.shl (local.get $stage) (i32.const 2))))
  (func $d3d9_block_texture_mask (param $stage i32) (result i32)
    (i32.add (select (i32.const 1624) (i32.const 22064) (i32.lt_u (local.get $stage) (i32.const 4))) (local.get $stage)))
  (func $d3d9_block_state_mask (param $index i32) (result i32)
    (i32.add (select (i32.const 24) (i32.const 21760) (i32.lt_u (local.get $index) (i32.const 320))) (local.get $index)))
  (func $d3d9_block_state_value (param $index i32) (result i32)
    (i32.add (select (i32.const 344) (i32.const 20832) (i32.lt_u (local.get $index) (i32.const 320)))
      (i32.shl (local.get $index) (i32.const 2))))

  (func $d3d9_stateblock_begin (param $device i32)
    (local $state i32) (local $obj i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (if (call $gl32 (i32.add (local.get $state) (i32.const 1740))) (then (return)))
    (local.set $obj (call $d3d9_stateblock_alloc (local.get $device)))
    (if (i32.eqz (local.get $obj)) (then (return)))
    (call $gs32 (i32.add (local.get $state) (i32.const 1740)) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Unpublished, one internal reference; caller publishes or unbinds on failure.
  (func $d3d9_stateblock_alloc (param $device i32) (result i32)
    (local $state i32) (local $vtbl i32) (local $obj i32) (local $wa i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $vtbl (call $gl32 (i32.add (local.get $state) (i32.const 2064))))
    (if (i32.eqz (local.get $vtbl)) (then
      (local.set $vtbl (call $init_com_vtable (global.get $API_ID_IDirect3DStateBlock9_BASE) (i32.const 6)))
      (call $gs32 (i32.add (local.get $state) (i32.const 2064)) (local.get $vtbl))))
    (if (i32.eqz (local.get $vtbl)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) (return (i32.const 0))))
    ;; +20728 texture-stage byte masks[264], +20992 values[264].
    ;; +22048 buffer mask, +22052 stream0, +22056 offset, +22060 stride, +22064 indices.
    ;; +22068 extra texture masks, +22072 pointers, +22080 sampler masks,
    ;; +22112 sampler values; +22240 material mask,+22244 material68,
    ;; +22312 selective light-list head; +22316 viewport mask,+22320 viewport24.
    ;; +22344 scissor mask,+22348 RECT16. Explicit empty rectangles are valid.
    ;; +22364 typed constant byte masks[64], +22428 values[640].
    ;; Bank order VS I/B, PS I/B; each I is vec4, each BOOL one raw DWORD.
    ;; +23068 VS c96..c255 byte masks[160], +23228 float values[2560].
    ;; Low VS and PS float masks/values retain their historical offsets.
    ;; +25788 user-plane byte masks[6], padding2, +25796 equations[96].
    (local.set $obj (call $heap_alloc (i32.const 25892)))
    (if (i32.eqz (local.get $obj)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $obj)))
    (call $zero_memory (local.get $wa) (i32.const 25892))
    (i32.store (local.get $wa) (local.get $vtbl))
    (i32.store offset=8 (local.get $wa) (local.get $device))
    (i32.store offset=12 (local.get $wa) (i32.const 0xd3d90003))
    (i32.store offset=16 (local.get $wa) (i32.const 25892))
    (i32.store offset=20 (local.get $wa) (i32.const 1))
    (local.get $obj))


  ;; Membership policy follows the detailed Microsoft saving-vertex/pixel-states-
  ;; with-a-stateblock tables, not the conflicting enum's shorter overlap list.
  ;; In particular LOCALVIEWER/material sources are in both detailed tables.
  ;; FOGENABLE/NORMALIZENORMALS absent from those tables remain ALL-only pending
  ;; native reference evidence. Capturing state does not advertise renderer caps.
  (func $d3d9_stateblock_render_member (param $type i32) (param $rs i32) (result i32)
    (if (i32.eq (local.get $type) (i32.const 1)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $type) (i32.const 3)) (then
    (if (i32.eq (local.get $rs) (i32.const 22)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 34)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 35)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 36)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 37)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 38)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 48)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 139)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 141)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 140)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 136)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 137)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 142)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 148)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 147)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 145)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 146)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 151)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 152)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 154)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 155)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 156)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 157)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 158)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 159)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 160)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 161)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 162)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 163)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 166)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 167)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 170)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 172)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 173)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 178)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 179)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 180)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 181)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 182)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 183)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 184)) (then (return (i32.const 1))))
      (return (i32.const 0))))
    (if (i32.eq (local.get $rs) (i32.const 7)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 29)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 8)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 9)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 14)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 15)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 16)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 19)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 20)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 23)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 24)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 25)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 26)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 36)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 37)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 38)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 27)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 195)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 52)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 53)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 54)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 55)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 56)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 57)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 58)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 59)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 60)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 128)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 129)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 130)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 131)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 132)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 133)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 134)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 135)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 198)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 199)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 200)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 201)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 202)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 203)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 204)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 205)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 142)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 148)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 147)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 145)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 146)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 168)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 171)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 174)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 175)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 176)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 185)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 186)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 187)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 188)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 189)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 190)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 191)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 192)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 193)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 194)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 206)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 207)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 208)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rs) (i32.const 209)) (then (return (i32.const 1))))
    (i32.const 0))

  (func $d3d9_stateblock_create (param $device i32) (param $type i32) (param $out i32)
    (local $state i32) (local $obj i32) (local $wa i32) (local $ow i32)
    (local $i i32) (local $j i32) (local $mask i32) (local $node i32) (local $copy i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $ow (call $d3d9_state_bytes (local.get $out) (i32.const 4)))
    (if (i32.eqz (local.get $ow)) (then (return)))
    (i32.store (local.get $ow) (i32.const 0))
    (if (i32.ge_u (i32.sub (local.get $type) (i32.const 1)) (i32.const 3)) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (if (call $gl32 (i32.add (local.get $state) (i32.const 1740))) (then (return)))
    (local.set $obj (call $d3d9_stateblock_alloc (local.get $device)))
    (if (i32.eqz (local.get $obj)) (then (return)))
    (local.set $wa (call $g2w (local.get $obj)))
    (loop $render
      (i32.store8 offset=24 (i32.add (local.get $wa) (local.get $i))
        (call $d3d9_stateblock_render_member (local.get $type) (local.get $i)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $render (i32.lt_u (local.get $i) (i32.const 256))))
    (local.set $i (i32.const 0))
    (loop $samplers
      (local.set $j (i32.const 1))
      (loop $sampler_fields
        (local.set $mask (select
          (i32.ne (local.get $type) (i32.const 2))
          (i32.ne (local.get $type) (i32.const 3))
          (i32.eq (local.get $j) (i32.const 13))))
        (i32.store8 (i32.add (local.get $wa)
          (call $d3d9_block_state_mask (i32.add (i32.const 256)
            (i32.add (i32.mul (local.get $i) (i32.const 16)) (local.get $j))))) (local.get $mask))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $sampler_fields (i32.le_u (local.get $j) (i32.const 13))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $samplers (i32.lt_u (local.get $i) (i32.const 6))))
    (local.set $i (i32.const 0))
    (loop $stages
      (local.set $j (i32.const 1))
      (loop $stage_fields
        (local.set $mask (i32.or
          (i32.lt_u (i32.sub (local.get $j) (i32.const 1)) (i32.const 11))
          (i32.or (i32.lt_u (i32.sub (local.get $j) (i32.const 22)) (i32.const 3))
          (i32.lt_u (i32.sub (local.get $j) (i32.const 26)) (i32.const 3)))))
        (if (i32.eq (local.get $j) (i32.const 32)) (then
          (local.set $mask (i32.eq (local.get $type) (i32.const 1)))))
        (if (i32.eq (local.get $type) (i32.const 3)) (then
          (local.set $mask (i32.or (i32.eq (local.get $j) (i32.const 11))
            (i32.eq (local.get $j) (i32.const 24))))))
        (i32.store8 offset=20728 (i32.add (local.get $wa)
          (i32.add (i32.mul (local.get $i) (i32.const 33)) (local.get $j))) (local.get $mask))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $stage_fields (i32.le_u (local.get $j) (i32.const 32))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $stages (i32.lt_u (local.get $i) (i32.const 8))))
    (if (i32.ne (local.get $type) (i32.const 2)) (then
      (i32.store8 offset=18948 (local.get $wa) (i32.const 1))
      (i32.store offset=18936 (local.get $wa) (i32.const 1))
      (memory.fill (i32.add (local.get $wa) (i32.const 18960)) (i32.const 1) (i32.const 96))
      (memory.fill (i32.add (local.get $wa) (i32.const 23068)) (i32.const 1) (i32.const 160))
      (memory.fill (i32.add (local.get $wa) (i32.const 22364)) (i32.const 1) (i32.const 32))
      ;; Freeze membership now: Capture must not add lights created later.
      (local.set $node (call $gl32 (i32.add (local.get $state) (i32.const 21996))))
      (block $lights_done (loop $lights
        (br_if $lights_done (i32.eqz (local.get $node)))
        (local.set $copy (call $d3d9_light_node
          (i32.add (local.get $wa) (i32.const 22312))
          (call $gl32 (i32.add (local.get $node) (i32.const 4))) (i32.const 1)))
        (if (i32.eqz (local.get $copy)) (then
          (call $d3d9_shader_unbind (local.get $obj))
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) (return)))
        (i32.store offset=8 (local.get $copy) (i32.const 3))
        (local.set $node (call $gl32 (local.get $node))) (br $lights)))))
    (if (i32.ne (local.get $type) (i32.const 3)) (then
      (i32.store8 offset=18949 (local.get $wa) (i32.const 1))
      (memory.fill (i32.add (local.get $wa) (i32.const 19056)) (i32.const 1) (i32.const 8))
      (memory.fill (i32.add (local.get $wa) (i32.const 22396)) (i32.const 1) (i32.const 32))))
    (if (i32.eq (local.get $type) (i32.const 1)) (then
      (i32.store offset=22048 (local.get $wa) (i32.const 3))
      (i32.store offset=22240 (local.get $wa) (i32.const 1))
      (i32.store offset=22316 (local.get $wa) (i32.const 1))
      (i32.store offset=22344 (local.get $wa) (i32.const 1))
      (memory.fill (i32.add (local.get $wa) (i32.const 1644)) (i32.const 1) (i32.const 266))
      (memory.fill (i32.add (local.get $wa) (i32.const 25788)) (i32.const 1) (i32.const 6))
      (local.set $i (i32.const 0))
      (loop $textures
        (i32.store8 (i32.add (local.get $wa) (call $d3d9_block_texture_mask (local.get $i))) (i32.const 1))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $textures (i32.lt_u (local.get $i) (i32.const 6))))))
    ;; Optional absent palette/vertex texture/stream-frequency state
    ;; is not fabricated. NPatch0 is immutable; this is represented-state support.
    (call $d3d9_stateblock_transfer (local.get $obj) (i32.const 0))
    (if (i32.load offset=0 (global.get $reg_base)) (then (call $d3d9_shader_unbind (local.get $obj)) (return)))
    (drop (call $d3d9_shader_addref (local.get $obj)))
    (call $d3d9_shader_unbind (local.get $obj))
    (i32.store (local.get $ow) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; SetClipPlane stores equations only; RS152 independently enables them.
  ;; Microsoft SetClipPlane: fixed-function world space, programmable clip space.
  ;; Preserve raw bits for Get; execution validates finite coefficients separately.
  (func $d3d9_clip_plane (param $device i32) (param $index i32) (param $data i32) (param $get i32)
    (local $state i32) (local $p i32) (local $slot i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.ge_u (local.get $index) (i32.const 6)) (then (return)))
    (local.set $p (call $d3d9_state_bytes (local.get $data) (i32.const 16)))
    (if (i32.eqz (local.get $p)) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $slot (i32.add (call $g2w (local.get $state))
      (i32.add (i32.const 25244) (i32.shl (local.get $index) (i32.const 4)))))
    (if (local.get $get) (then (memory.copy (local.get $p) (local.get $slot) (i32.const 16)))
    (else
      (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
      (if (local.get $block) (then
        (local.set $block (call $g2w (local.get $block)))
        (i32.store8 offset=25788 (i32.add (local.get $block) (local.get $index)) (i32.const 1))
        (local.set $slot (i32.add (local.get $block)
          (i32.add (i32.const 25796) (i32.shl (local.get $index) (i32.const 4)))))))
      (memory.copy (local.get $slot) (local.get $p) (i32.const 16))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Material/light state is native-owned, not a host shadow. Light indices
  ;; are arbitrary DWORD keys, not hardware slots. Nodes120: next guest,index,
  ;; selective mask (1 definition,2 enable),BOOL,D3DLIGHT9[104].
  (func $d3d9_state_bytes (param $ptr i32) (param $bytes i32) (result i32)
    (local $wa i32)
    (if (i32.or (i32.eqz (local.get $ptr))
      (i64.gt_u (i64.add (i64.extend_i32_u (local.get $ptr)) (i64.extend_i32_u (local.get $bytes))) (i64.const 4294967296)))
      (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $ptr)))
    (if (i32.or (i32.eq (local.get $wa) (i32.const 0xf0))
      (i32.eqz (call $d3d_shader_vm_range (local.get $wa) (local.get $bytes)))) (then (return (i32.const 0))))
    (if (i32.ne (call $g2w (i32.sub (i32.add (local.get $ptr) (local.get $bytes)) (i32.const 1)))
      (i32.sub (i32.add (local.get $wa) (local.get $bytes)) (i32.const 1))) (then (return (i32.const 0))))
    (local.get $wa))

  ;; API typed constants live independently of shader-local DEFI/DEFB.
  ;; https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-setvertexshaderconstanti
  ;; https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-setvertexshaderconstantb
  (func $d3d9_typed_constants (param $device i32) (param $start i32) (param $data i32)
    (param $count i32) (param $pixel i32) (param $boolean i32) (param $get i32)
    (local $state i32) (local $wa i32) (local $offset i32) (local $bytes i32) (local $block i32) (local $dest i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.gt_u (local.get $start) (i32.const 16)) (then (return)))
    (if (i32.gt_u (local.get $count) (i32.sub (i32.const 16) (local.get $start))) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (if (i32.eqz (local.get $count)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $bytes (i32.mul (local.get $count) (select (i32.const 4) (i32.const 16) (local.get $boolean))))
    (local.set $wa (call $d3d9_state_bytes (local.get $data) (local.get $bytes)))
    (if (i32.eqz (local.get $wa)) (then (return)))
    (local.set $offset (i32.add (i32.add (i32.mul (local.get $pixel) (i32.const 320))
      (i32.mul (local.get $boolean) (i32.const 256)))
      (i32.mul (local.get $start) (select (i32.const 4) (i32.const 16) (local.get $boolean)))))
    (local.set $dest (i32.add (call $g2w (local.get $state)) (i32.add (i32.const 22044) (local.get $offset))))
    (if (local.get $get) (then (memory.copy (local.get $wa) (local.get $dest) (local.get $bytes)))
    (else
      (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
      (if (local.get $block) (then
        (local.set $block (call $g2w (local.get $block)))
        (memory.fill (i32.add (local.get $block) (i32.add (i32.const 22364)
          (i32.add (local.get $start) (i32.add (i32.mul (local.get $pixel) (i32.const 32)) (i32.mul (local.get $boolean) (i32.const 16))))))
          (i32.const 1) (local.get $count))
        (local.set $dest (i32.add (local.get $block) (i32.add (i32.const 22428) (local.get $offset))))))
      (memory.copy (local.get $dest) (local.get $wa) (local.get $bytes))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_scissor (param $device i32) (param $ptr i32) (param $get i32)
    (local $state i32) (local $wa i32) (local $rt i32) (local $block i32) (local $slot i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (local.set $wa (call $d3d9_state_bytes (local.get $ptr) (i32.const 16)))
    (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $wa))) (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $device)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (local.set $state (call $g2w (local.get $state)))
    (local.set $slot (i32.add (local.get $state) (i32.const 22000)))
    (if (local.get $get) (then
      (if (i32.load offset=22016 (local.get $state))
        (then (memory.copy (local.get $wa) (local.get $slot) (i32.const 16)))
        (else
          (i64.store (local.get $wa) (i64.const 0))
          (i32.store offset=8 (local.get $wa) (call $d3d9_color_extent (local.get $device) (i32.const 0)))
          (i32.store offset=12 (local.get $wa) (call $d3d9_color_extent (local.get $device) (i32.const 1)))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $l (i32.load (local.get $wa))) (local.set $t (i32.load offset=4 (local.get $wa)))
    (local.set $r (i32.load offset=8 (local.get $wa))) (local.set $b (i32.load offset=12 (local.get $wa)))
    (if (i32.or (i32.lt_s (local.get $l) (i32.const 0)) (i32.lt_s (local.get $t) (i32.const 0))) (then (return)))
    (if (i32.or (i32.lt_s (local.get $r) (local.get $l)) (i32.lt_s (local.get $b) (local.get $t))) (then (return)))
    (if (i32.or (i32.gt_u (local.get $r) (call $d3d9_color_extent (local.get $device) (i32.const 0)))
      (i32.gt_u (local.get $b) (call $d3d9_color_extent (local.get $device) (i32.const 1)))) (then (return)))
    (local.set $block (i32.load offset=1740 (local.get $state)))
    (if (local.get $block) (then
      (local.set $block (call $g2w (local.get $block)))
      (i32.store offset=22344 (local.get $block) (i32.const 1))
      (local.set $slot (i32.add (local.get $block) (i32.const 22348))))
    (else (i32.store offset=22016 (local.get $state) (i32.const 1))))
    (memory.copy (local.get $slot) (local.get $wa) (i32.const 16))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_light_node (param $head i32) (param $index i32) (param $create i32) (result i32)
    (local $node i32) (local $wa i32)
    (local.set $node (i32.load (local.get $head)))
    (block $missing (loop $find
      (br_if $missing (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (if (i32.eq (i32.load offset=4 (local.get $wa)) (local.get $index)) (then (return (local.get $wa))))
      (local.set $node (i32.load (local.get $wa))) (br $find)))
    (if (i32.eqz (local.get $create)) (then (return (i32.const 0))))
    (local.set $node (call $heap_alloc (i32.const 120)))
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $node)))
    (memory.fill (local.get $wa) (i32.const 0) (i32.const 120))
    (i32.store (local.get $wa) (i32.load (local.get $head)))
    (i32.store offset=4 (local.get $wa) (local.get $index))
    ;; LightEnable's documented implicit default: white directional, +Z.
    (i32.store offset=16 (local.get $wa) (i32.const 3))
    (f32.store offset=20 (local.get $wa) (f32.const 1))
    (f32.store offset=24 (local.get $wa) (f32.const 1))
    (f32.store offset=28 (local.get $wa) (f32.const 1))
    (f32.store offset=88 (local.get $wa) (f32.const 1))
    (i32.store (local.get $head) (local.get $node))
    (local.get $wa))

  (func $d3d9_lights_free (param $head i32)
    (local $next i32)
    (block $done (loop $nodes
      (br_if $done (i32.eqz (local.get $head)))
      (local.set $next (call $gl32 (local.get $head)))
      (call $heap_free (local.get $head)) (local.set $head (local.get $next)) (br $nodes))))

  (func $d3d9_material (param $device i32) (param $ptr i32) (param $get i32)
    (local $state i32) (local $wa i32) (local $slot i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (local.set $wa (call $d3d9_state_bytes (local.get $ptr) (i32.const 68)))
    (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $wa))) (then (return)))
    (local.set $slot (i32.add (call $g2w (local.get $state)) (i32.const 21928)))
    (if (i32.eqz (local.get $get)) (then
      (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
      (if (local.get $block) (then
        (local.set $block (call $g2w (local.get $block)))
        (i32.store offset=22240 (local.get $block) (i32.const 1))
        (local.set $slot (i32.add (local.get $block) (i32.const 22244)))))))
    (memory.copy (select (local.get $wa) (local.get $slot) (local.get $get))
      (select (local.get $slot) (local.get $wa) (local.get $get)) (i32.const 68))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; op0 SetLight,1 GetLight,2 LightEnable,3 GetLightEnable.
  (func $d3d9_light (param $device i32) (param $index i32) (param $value i32) (param $op i32)
    (local $state i32) (local $wa i32) (local $head i32) (local $node i32) (local $live i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (if (i32.ne (local.get $op) (i32.const 2)) (then
      (local.set $wa (call $d3d9_state_bytes (local.get $value)
        (select (i32.const 4) (i32.const 104) (i32.eq (local.get $op) (i32.const 3)))))
      (if (i32.eqz (local.get $wa)) (then (return)))))
    (if (i32.eqz (local.get $op)) (then
      (if (i32.ge_u (i32.sub (i32.load (local.get $wa)) (i32.const 1)) (i32.const 3)) (then (return)))))
    (local.set $head (i32.add (call $g2w (local.get $state)) (i32.const 21996)))
    (local.set $live (call $d3d9_light_node (local.get $head) (local.get $index) (i32.const 0)))
    (if (i32.and (local.get $op) (i32.const 1)) (then
      (if (i32.eqz (local.get $live)) (then (return)))
      (if (i32.eq (local.get $op) (i32.const 1))
        (then (memory.copy (local.get $wa) (i32.add (local.get $live) (i32.const 16)) (i32.const 104)))
        (else (i32.store (local.get $wa) (i32.load offset=12 (local.get $live)))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
    (if (local.get $block) (then (local.set $head (i32.add (call $g2w (local.get $block)) (i32.const 22312)))))
    (local.set $node (call $d3d9_light_node (local.get $head) (local.get $index) (i32.const 1)))
    (if (i32.eqz (local.get $node)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) (return)))
    (if (i32.eqz (local.get $op)) (then
      (memory.copy (i32.add (local.get $node) (i32.const 16)) (local.get $wa) (i32.const 104))
      (i32.store offset=8 (local.get $node) (i32.or (i32.load offset=8 (local.get $node)) (i32.const 1))))
    (else
      (i32.store offset=12 (local.get $node) (i32.ne (local.get $value) (i32.const 0)))
      (i32.store offset=8 (local.get $node) (i32.or (i32.load offset=8 (local.get $node))
        (select (i32.const 2) (i32.const 3) (i32.ne (local.get $live) (i32.const 0)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Dense transform indices0..265; unlike D3DIM, texture/world matrices
  ;; must not alias the view/projection slots. State blocks have masks at1644
  ;; and owned matrices at1912; device matrices begin at2068.
  ;; Gamma setters are void and have no display effect when the current
  ;; presentation mode lacks gamma support, as our Caps2 explicitly reports.
  ;; Retain the API ramp for GetGammaRamp; do not alter render-target bytes.
  (func $d3d9_gamma_ramp (param $device i32) (param $chain i32) (param $ramp i32) (param $get i32)
    (local $state i32) (local $slot i32) (local $rw i32)
    (if (local.get $chain) (then (return)))
    (if (i32.eqz (local.get $ramp)) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $slot (i32.add (call $g2w (local.get $state)) (i32.const 19092)))
    (local.set $rw (call $g2w (local.get $ramp)))
    (memory.copy (select (local.get $rw) (local.get $slot) (local.get $get))
      (select (local.get $slot) (local.get $rw) (local.get $get)) (i32.const 1536)))

  (func $d3d9_transform_index (param $type i32) (result i32)
    (if (i32.lt_u (i32.sub (local.get $type) (i32.const 2)) (i32.const 2))
      (then (return (i32.sub (local.get $type) (i32.const 2)))))
    (if (i32.lt_u (i32.sub (local.get $type) (i32.const 16)) (i32.const 8))
      (then (return (i32.sub (local.get $type) (i32.const 14)))))
    (if (i32.lt_u (i32.sub (local.get $type) (i32.const 256)) (i32.const 256))
      (then (return (i32.sub (local.get $type) (i32.const 246)))))
    (i32.const -1))

  (func $d3d9_transform (param $device i32) (param $type i32) (param $matrix i32) (param $get i32)
    (local $index i32) (local $state i32) (local $slot i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $index (call $d3d9_transform_index (local.get $type)))
    (if (i32.eq (local.get $index) (i32.const -1)) (then (return)))
    (if (i32.eqz (local.get $matrix)) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $slot (i32.add (call $g2w (local.get $state))
      (i32.add (i32.const 2068) (i32.mul (local.get $index) (i32.const 64)))))
    (if (local.get $get) (then
      (memory.copy (call $g2w (local.get $matrix)) (local.get $slot) (i32.const 64)))
    (else
      (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
      (if (local.get $block) (then
        (local.set $block (call $g2w (local.get $block)))
        (i32.store8 offset=1644 (i32.add (local.get $block) (local.get $index)) (i32.const 1))
        (local.set $slot (i32.add (local.get $block)
          (i32.add (i32.const 1912) (i32.mul (local.get $index) (i32.const 64)))))))
      (memory.copy (local.get $slot) (call $g2w (local.get $matrix)) (i32.const 64))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_resource_free (param $obj i32)
    (local $wa i32) (local $stage i32)
    (local.set $wa (call $g2w (local.get $obj)))
    (if (i32.or (i32.eq (i32.load offset=12 (local.get $wa)) (i32.const 3))
      (i32.eq (i32.load offset=12 (local.get $wa)) (i32.const 5))) (then
      (if (i32.load offset=56 (local.get $wa)) (then
        ;; The broker copies all IDs into one ordered retirement command.
        ;; Its executor storage is independent of this canonical allocation.
        (drop (call $host_gpu_gl_call (i32.const 0x30013) (local.get $wa) (i32.load offset=8 (local.get $wa))))))))
    (if (i32.eq (i32.load offset=12 (local.get $wa)) (i32.const 0xd3d90003)) (then
      (call $d3d9_lights_free (i32.load offset=22312 (local.get $wa)))
      (call $d3d9_shader_unbind (i32.load offset=22052 (local.get $wa)))
      (call $d3d9_shader_unbind (i32.load offset=22064 (local.get $wa)))
      (call $d3d9_shader_unbind (i32.load offset=18940 (local.get $wa)))
      (call $d3d9_shader_unbind (i32.load offset=18952 (local.get $wa)))
      (call $d3d9_shader_unbind (i32.load offset=18956 (local.get $wa)))
      (loop $textures
        (call $d3d9_shader_unbind (i32.load
          (i32.add (local.get $wa) (call $d3d9_block_texture_offset (local.get $stage)))))
        (local.set $stage (i32.add (local.get $stage) (i32.const 1)))
        (br_if $textures (i32.lt_u (local.get $stage) (i32.const 6))))))
    (call $heap_free (local.get $obj)))

  (func $d3d9_stateblock_buffer (param $wa i32) (param $buffer i32) (param $kind i32)
    (param $offset i32) (param $stride i32)
    (local $slot i32) (local $old i32) (local $bw i32)
    (local.set $slot (i32.add (local.get $wa)
      (select (i32.const 22052) (i32.const 22064) (i32.eq (local.get $kind) (i32.const 6)))))
    (local.set $old (i32.load (local.get $slot)))
    (if (local.get $buffer) (then
      (local.set $bw (call $g2w (local.get $buffer)))
      (i32.store offset=20 (local.get $bw) (i32.add (i32.load offset=20 (local.get $bw)) (i32.const 1)))))
    (i32.store (local.get $slot) (local.get $buffer))
    (i32.store offset=22048 (local.get $wa) (i32.or (i32.load offset=22048 (local.get $wa))
      (select (i32.const 1) (i32.const 2) (i32.eq (local.get $kind) (i32.const 6)))))
    (if (i32.eq (local.get $kind) (i32.const 6)) (then
      (i32.store offset=22056 (local.get $wa) (local.get $offset))
      (i32.store offset=22060 (local.get $wa) (local.get $stride))))
    (call $d3d9_shader_unbind (local.get $old)))

  (func $d3d9_stateblock_shader (param $wa i32) (param $pixel i32) (param $shader i32)
    (local $slot i32) (local $old i32) (local $sw i32)
    (local.set $slot (i32.add (local.get $wa) (i32.add (i32.const 18952) (i32.mul (local.get $pixel) (i32.const 4)))))
    (local.set $old (i32.load (local.get $slot)))
    (if (local.get $shader) (then
      (local.set $sw (call $g2w (local.get $shader)))
      (i32.store offset=20 (local.get $sw) (i32.add (i32.load offset=20 (local.get $sw)) (i32.const 1)))))
    (i32.store8 offset=18948 (i32.add (local.get $wa) (local.get $pixel)) (i32.const 1))
    (i32.store (local.get $slot) (local.get $shader))
    (call $d3d9_shader_unbind (local.get $old)))

  ;; Declaration selection also captures its mutually exclusive FVF value.
  (func $d3d9_stateblock_declaration (param $wa i32) (param $declaration i32) (param $fvf i32)
    (local $old i32) (local $dw i32)
    (local.set $old (i32.load offset=18940 (local.get $wa)))
    (if (local.get $declaration) (then
      (local.set $dw (call $g2w (local.get $declaration)))
      (i32.store offset=20 (local.get $dw) (i32.add (i32.load offset=20 (local.get $dw)) (i32.const 1)))))
    (i32.store offset=18936 (local.get $wa) (i32.const 1))
    (i32.store offset=18940 (local.get $wa) (local.get $declaration))
    (i32.store offset=18944 (local.get $wa) (local.get $fvf))
    (call $d3d9_shader_unbind (local.get $old)))

  (func $d3d9_stateblock_texture (param $wa i32) (param $stage i32) (param $texture i32)
    (local $slot i32) (local $old i32) (local $tw i32)
    (local.set $slot (i32.add (local.get $wa) (call $d3d9_block_texture_offset (local.get $stage))))
    (local.set $old (i32.load (local.get $slot)))
    (if (local.get $texture) (then
      (local.set $tw (call $g2w (local.get $texture)))
      (i32.store offset=20 (local.get $tw) (i32.add (i32.load offset=20 (local.get $tw)) (i32.const 1)))))
    (i32.store8 (i32.add (local.get $wa) (call $d3d9_block_texture_mask (local.get $stage))) (i32.const 1))
    (i32.store (local.get $slot) (local.get $texture))
    (call $d3d9_shader_unbind (local.get $old)))

  (func $d3d9_stateblock_end (param $device i32) (param $out i32)
    (local $state i32) (local $obj i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $obj (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
    (if (i32.eqz (local.get $obj)) (then (return)))
    (drop (call $d3d9_shader_addref (local.get $obj)))
    (call $gs32 (i32.add (local.get $state) (i32.const 1740)) (i32.const 0))
    (call $d3d9_shader_unbind (local.get $obj))
    (call $gs32 (local.get $out) (local.get $obj)) (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_set_render_state (param $device i32) (param $rs i32) (param $value i32)
    (local $state i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.ge_u (local.get $rs) (i32.const 256)) (then (return)))
    (if (i32.eq (local.get $rs) (i32.const 8)) (then
      (if (i32.ge_u (i32.sub (local.get $value) (i32.const 1)) (i32.const 3)) (then (return)))))
    (if (i32.eq (local.get $rs) (i32.const 16)) (then
      (if (i32.gt_u (local.get $value) (i32.const 1)) (then (return)))))
    (if (i32.or (i32.eq (local.get $rs) (i32.const 156)) (i32.eq (local.get $rs) (i32.const 157))) (then
      (if (i32.gt_u (local.get $value) (i32.const 1)) (then (return)))))
    (if (i32.or (i32.or (i32.eq (local.get $rs) (i32.const 154)) (i32.eq (local.get $rs) (i32.const 155)))
      (i32.or (i32.eq (local.get $rs) (i32.const 166))
        (i32.and (i32.ge_u (local.get $rs) (i32.const 158)) (i32.le_u (local.get $rs) (i32.const 160))))) (then
      (if (i32.eqz (i32.and (f32.ge (f32.reinterpret_i32 (local.get $value)) (f32.const 0))
        (f32.le (f32.reinterpret_i32 (local.get $value)) (f32.const 3.4028234663852886e38)))) (then (return)))))
    (if (i32.or (i32.and (i32.ge_u (local.get $rs) (i32.const 53)) (i32.le_u (local.get $rs) (i32.const 56)))
      (i32.and (i32.ge_u (local.get $rs) (i32.const 186)) (i32.le_u (local.get $rs) (i32.const 189)))) (then
      (if (i32.ge_u (i32.sub (local.get $value) (i32.const 1)) (i32.const 8)) (then (return)))))
    (if (i32.or (i32.eq (local.get $rs) (i32.const 52)) (i32.eq (local.get $rs) (i32.const 185))) (then
      (if (i32.gt_u (local.get $value) (i32.const 1)) (then (return)))))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
    (if (local.get $block) (then
      (local.set $block (call $g2w (local.get $block)))
      (i32.store8 offset=24 (i32.add (local.get $block) (local.get $rs)) (i32.const 1))
      (i32.store offset=344 (i32.add (local.get $block) (i32.mul (local.get $rs) (i32.const 4))) (local.get $value))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
    (else (call $d3dim_set_render_state (local.get $device) (local.get $rs) (local.get $value)))))

  (func $d3d9_texture_stage_state (param $device i32) (param $stage i32)
    (param $type i32) (param $value i32) (param $get i32)
    (local $state i32) (local $index i32) (local $slot i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.ge_u (local.get $stage) (i32.const 8)) (then (return)))
    ;; RESULTARG has no source modifiers: only CURRENT or TEMP are writable.
    (if (i32.and (i32.eqz (local.get $get)) (i32.and (i32.eq (local.get $type) (i32.const 28))
      (i32.and (i32.ne (local.get $value) (i32.const 1)) (i32.ne (local.get $value) (i32.const 5))))) (then (return)))
    (if (i32.eqz (i32.or
      (i32.lt_u (i32.sub (local.get $type) (i32.const 1)) (i32.const 11))
      (i32.or (i32.lt_u (i32.sub (local.get $type) (i32.const 22)) (i32.const 3))
      (i32.or (i32.lt_u (i32.sub (local.get $type) (i32.const 26)) (i32.const 3))
        (i32.eq (local.get $type) (i32.const 32)))))) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $index (i32.add (i32.mul (local.get $stage) (i32.const 33)) (local.get $type)))
    (local.set $slot (i32.add (call $g2w (local.get $state))
      (i32.add (i32.const 20664) (i32.mul (local.get $index) (i32.const 4)))))
    (if (local.get $get) (then
      (if (i32.eqz (local.get $value)) (then (return)))
      (call $gs32 (local.get $value) (i32.load (local.get $slot))))
    (else
      (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
      (if (local.get $block) (then
        (local.set $block (call $g2w (local.get $block)))
        (i32.store8 offset=20728 (i32.add (local.get $block) (local.get $index)) (i32.const 1))
        (local.set $slot (i32.add (local.get $block)
          (i32.add (i32.const 20992) (i32.mul (local.get $index) (i32.const 4))))))
      (else
        ;; Project the shared fixed-function subset into its existing renderer state.
        (call $d3dim_set_tss (local.get $device) (local.get $stage) (local.get $type) (local.get $value))))
      (i32.store (local.get $slot) (local.get $value))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_lighting_transfer (param $block i32) (param $state i32) (param $apply i32) (result i32)
    (local $node i32) (local $wa i32) (local $live i32) (local $mask i32)
    (local $head i32) (local $material i32)
    (local.set $head (i32.add (call $g2w (local.get $state)) (i32.const 21996)))
    ;; Resolve every required light before copying fields. Definitions and
    ;; enables have independent masks; Apply must not overwrite an unrecorded
    ;; definition when a block only recorded LightEnable.
    (local.set $node (i32.load offset=22312 (local.get $block)))
    (block $resolved (loop $resolve
      (br_if $resolved (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (local.set $live (call $d3d9_light_node (local.get $head) (i32.load offset=4 (local.get $wa)) (local.get $apply)))
      (if (i32.eqz (local.get $live)) (then
        (return (select (i32.const 0x8007000e) (i32.const 0x8876086c) (local.get $apply)))))
      (local.set $node (i32.load (local.get $wa))) (br $resolve)))
    (local.set $node (i32.load offset=22312 (local.get $block)))
    (block $done (loop $copy
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (local.set $live (call $d3d9_light_node (local.get $head) (i32.load offset=4 (local.get $wa)) (i32.const 0)))
      (local.set $mask (i32.load offset=8 (local.get $wa)))
      (if (i32.and (local.get $mask) (i32.const 1)) (then
        (memory.copy (i32.add (select (local.get $live) (local.get $wa) (local.get $apply)) (i32.const 16))
          (i32.add (select (local.get $wa) (local.get $live) (local.get $apply)) (i32.const 16)) (i32.const 104))))
      (if (i32.and (local.get $mask) (i32.const 2)) (then
        (i32.store offset=12 (select (local.get $live) (local.get $wa) (local.get $apply))
          (i32.load offset=12 (select (local.get $wa) (local.get $live) (local.get $apply))))))
      (local.set $node (i32.load (local.get $wa))) (br $copy)))
    (if (i32.load offset=22240 (local.get $block)) (then
      (local.set $material (i32.add (local.get $block) (i32.const 22244)))
      (local.set $live (i32.add (call $g2w (local.get $state)) (i32.const 21928)))
      (memory.copy (select (local.get $live) (local.get $material) (local.get $apply))
        (select (local.get $material) (local.get $live) (local.get $apply)) (i32.const 68))))
    (i32.const 0))

  (func $d3d9_stateblock_transfer (param $obj i32) (param $apply i32)
    (local $wa i32) (local $device i32) (local $state i32) (local $rs i32) (local $values i32) (local $live i32)
    (local $typed_offset i32) (local $typed_bytes i32)
    (local.set $wa (call $g2w (local.get $obj)))
    (local.set $device (i32.load offset=8 (local.get $wa)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (call $gl32 (i32.add (local.get $state) (i32.const 1740))) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (call $d3d9_lighting_transfer (local.get $wa) (local.get $state) (local.get $apply)))
    (if (i32.load offset=0 (global.get $reg_base)) (then (return)))
    (if (i32.load offset=22316 (local.get $wa)) (then
      (if (local.get $apply) (then
        (memory.copy (i32.add (call $g2w (local.get $state)) (i32.const 21728))
          (i32.add (local.get $wa) (i32.const 22320)) (i32.const 24)))
      (else
        ;; GetViewport also materializes the untouched full-target default.
        (call $d3d9_viewport (local.get $device)
          (i32.add (local.get $obj) (i32.const 22320)) (i32.const 1))
        (if (i32.load offset=0 (global.get $reg_base)) (then (return)))))))
    (if (i32.load offset=22344 (local.get $wa)) (then
      (if (local.get $apply) (then
        (memory.copy (i32.add (call $g2w (local.get $state)) (i32.const 22000))
          (i32.add (local.get $wa) (i32.const 22348)) (i32.const 16))
        (call $gs32 (i32.add (local.get $state) (i32.const 22016)) (i32.const 1)))
      (else
        (call $d3d9_scissor (local.get $device)
          (i32.add (local.get $obj) (i32.const 22348)) (i32.const 1))
        (if (i32.load offset=0 (global.get $reg_base)) (then (return)))))))
    (local.set $values (i32.add (call $g2w (call $d3ddev_state (local.get $device))) (i32.const 256)))
    (loop $buffers
      (if (i32.and (i32.load offset=22048 (local.get $wa)) (i32.shl (i32.const 1) (local.get $rs))) (then
        (if (local.get $apply) (then
          ;; State blocks capture stream 0 only, which is all the mask at
          ;; +22048 models. SetStreamSource refuses a non-zero index while a
          ;; block records rather than dropping it on the floor.
          (call $d3d9_buffer_bind (local.get $device)
            (i32.load (i32.add (local.get $wa) (select (i32.const 22064) (i32.const 22052) (local.get $rs))))
            (i32.add (i32.const 6) (local.get $rs))
            (i32.load offset=22056 (local.get $wa)) (i32.load offset=22060 (local.get $wa)) (i32.const 0)))
        (else
          (call $d3d9_stateblock_buffer (local.get $wa)
            (select (call $gl32 (i32.add (local.get $state) (i32.const 1732)))
              (call $gl32 (call $d3d9_stream_slot (local.get $state) (i32.const 0))) (local.get $rs))
            (i32.add (i32.const 6) (local.get $rs))
            (call $gl32 (i32.add (call $d3d9_stream_slot (local.get $state) (i32.const 0)) (i32.const 4)))
            (call $gl32 (i32.add (call $d3d9_stream_slot (local.get $state) (i32.const 0)) (i32.const 8))))))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $buffers (i32.lt_u (local.get $rs) (i32.const 2))))
    (local.set $rs (i32.const 0))
    (loop $states
      (if (i32.load8_u (i32.add (local.get $wa) (call $d3d9_block_state_mask (local.get $rs)))) (then
        (local.set $live (select
          (i32.add (local.get $values) (i32.mul (local.get $rs) (i32.const 4)))
          (i32.add (call $g2w (local.get $state))
            (i32.add (call $d3d9_sampler_offset (i32.shr_u (i32.sub (local.get $rs) (i32.const 256)) (i32.const 4)))
              (i32.shl (i32.and (local.get $rs) (i32.const 15)) (i32.const 2))))
          (i32.lt_u (local.get $rs) (i32.const 256))))
        (if (local.get $apply) (then
          (if (i32.lt_u (local.get $rs) (i32.const 256)) (then
            (call $d3dim_set_render_state (local.get $device) (local.get $rs)
              (i32.load (i32.add (local.get $wa) (call $d3d9_block_state_value (local.get $rs))))))
          (else
            (i32.store (local.get $live)
              (i32.load (i32.add (local.get $wa) (call $d3d9_block_state_value (local.get $rs))))))))
        (else
          (i32.store (i32.add (local.get $wa) (call $d3d9_block_state_value (local.get $rs)))
            (i32.load (local.get $live)))))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $states (i32.lt_u (local.get $rs) (i32.const 352))))
    (local.set $rs (i32.const 0))
    (loop $textures
      (if (i32.load8_u (i32.add (local.get $wa) (call $d3d9_block_texture_mask (local.get $rs)))) (then
        (if (local.get $apply) (then
          (call $d3d9_texture_binding (local.get $device) (local.get $rs)
            (i32.load (i32.add (local.get $wa) (call $d3d9_block_texture_offset (local.get $rs)))) (i32.const 0)))
        (else
          (call $d3d9_stateblock_texture (local.get $wa) (local.get $rs)
            (call $gl32 (i32.add (local.get $state) (call $d3d9_texture_offset (local.get $rs)))))))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $textures (i32.lt_u (local.get $rs) (i32.const 6))))
    (local.set $rs (i32.const 0))
    (loop $matrices
      (if (i32.load8_u offset=1644 (i32.add (local.get $wa) (local.get $rs))) (then
        (local.set $live (i32.add (call $g2w (local.get $state))
          (i32.add (i32.const 2068) (i32.mul (local.get $rs) (i32.const 64)))))
        (local.set $values (i32.add (local.get $wa)
          (i32.add (i32.const 1912) (i32.mul (local.get $rs) (i32.const 64)))))
        (memory.copy (select (local.get $live) (local.get $values) (local.get $apply))
          (select (local.get $values) (local.get $live) (local.get $apply)) (i32.const 64))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $matrices (i32.lt_u (local.get $rs) (i32.const 266))))
    (local.set $rs (i32.const 0))
    (loop $shaders
      (if (i32.load8_u offset=18948 (i32.add (local.get $wa) (local.get $rs))) (then
        (if (local.get $apply) (then
          (call $d3d9_shader_binding (local.get $device)
            (i32.load offset=18952 (i32.add (local.get $wa) (i32.mul (local.get $rs) (i32.const 4))))
            (local.get $rs) (i32.const 0)))
        (else
          (call $d3d9_stateblock_shader (local.get $wa) (local.get $rs)
            (call $gl32 (i32.add (local.get $state) (i32.mul (local.get $rs) (i32.const 4)))))))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $shaders (i32.lt_u (local.get $rs) (i32.const 2))))
    (local.set $rs (i32.const 0))
    (loop $constants
      (if (i32.load8_u offset=18960 (i32.add (local.get $wa) (local.get $rs))) (then
        (local.set $live (i32.add (call $g2w (local.get $state))
          (i32.add (i32.const 16) (i32.mul (local.get $rs) (i32.const 16)))))
        (local.set $values (i32.add (local.get $wa)
          (i32.add (i32.const 19064) (i32.mul (local.get $rs) (i32.const 16)))))
        (memory.copy (select (local.get $live) (local.get $values) (local.get $apply))
          (select (local.get $values) (local.get $live) (local.get $apply)) (i32.const 16))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $constants (i32.lt_u (local.get $rs) (i32.const 104))))
    (local.set $rs (i32.const 0))
    (loop $high_vertex_constants
      (if (i32.load8_u offset=23068 (i32.add (local.get $wa) (local.get $rs))) (then
        (local.set $live (i32.add (call $g2w (local.get $state))
          (i32.add (i32.const 22684) (i32.mul (local.get $rs) (i32.const 16)))))
        (local.set $values (i32.add (local.get $wa)
          (i32.add (i32.const 23228) (i32.mul (local.get $rs) (i32.const 16)))))
        (memory.copy (select (local.get $live) (local.get $values) (local.get $apply))
          (select (local.get $values) (local.get $live) (local.get $apply)) (i32.const 16))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $high_vertex_constants (i32.lt_u (local.get $rs) (i32.const 160))))
    (local.set $rs (i32.const 0))
    (loop $typed_constants
      (if (i32.load8_u offset=22364 (i32.add (local.get $wa) (local.get $rs))) (then
        (local.set $typed_bytes (select (i32.const 4) (i32.const 16) (i32.and (local.get $rs) (i32.const 16))))
        (local.set $typed_offset (i32.add
          (i32.add (i32.mul (i32.shr_u (local.get $rs) (i32.const 5)) (i32.const 320))
            (i32.shl (i32.and (local.get $rs) (i32.const 16)) (i32.const 4)))
          (i32.mul (i32.and (local.get $rs) (i32.const 15)) (local.get $typed_bytes))))
        (local.set $live (i32.add (call $g2w (local.get $state)) (i32.add (i32.const 22044) (local.get $typed_offset))))
        (local.set $values (i32.add (local.get $wa) (i32.add (i32.const 22428) (local.get $typed_offset))))
        (memory.copy (select (local.get $live) (local.get $values) (local.get $apply))
          (select (local.get $values) (local.get $live) (local.get $apply)) (local.get $typed_bytes))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $typed_constants (i32.lt_u (local.get $rs) (i32.const 64))))
    (local.set $rs (i32.const 0))
    (loop $clip_planes
      (if (i32.load8_u offset=25788 (i32.add (local.get $wa) (local.get $rs))) (then
        (local.set $live (i32.add (call $g2w (local.get $state))
          (i32.add (i32.const 25244) (i32.shl (local.get $rs) (i32.const 4)))))
        (local.set $values (i32.add (local.get $wa)
          (i32.add (i32.const 25796) (i32.shl (local.get $rs) (i32.const 4)))))
        (memory.copy (select (local.get $live) (local.get $values) (local.get $apply))
          (select (local.get $values) (local.get $live) (local.get $apply)) (i32.const 16))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $clip_planes (i32.lt_u (local.get $rs) (i32.const 6))))
    (local.set $rs (i32.const 0))
    (loop $texture_stages
      (if (i32.load8_u offset=20728 (i32.add (local.get $wa) (local.get $rs))) (then
        (local.set $values (i32.add (local.get $wa) (i32.add (i32.const 20992) (i32.mul (local.get $rs) (i32.const 4)))))
        (if (local.get $apply) (then
          (call $d3d9_texture_stage_state (local.get $device)
            (i32.div_u (local.get $rs) (i32.const 33)) (i32.rem_u (local.get $rs) (i32.const 33))
            (i32.load (local.get $values)) (i32.const 0)))
        (else
          (i32.store (local.get $values) (call $gl32 (i32.add (local.get $state)
            (i32.add (i32.const 20664) (i32.mul (local.get $rs) (i32.const 4))))))))))
      (local.set $rs (i32.add (local.get $rs) (i32.const 1)))
      (br_if $texture_stages (i32.lt_u (local.get $rs) (i32.const 264))))
    (if (i32.load offset=18936 (local.get $wa)) (then
      (if (local.get $apply) (then
        (call $d3d9_declaration_bind (local.get $device) (i32.load offset=18940 (local.get $wa)))
        (call $gs32 (i32.add (local.get $state) (i32.const 12)) (i32.load offset=18944 (local.get $wa))))
      (else
        (call $d3d9_stateblock_declaration (local.get $wa)
          (call $gl32 (i32.add (local.get $state) (i32.const 8)))
          (call $gl32 (i32.add (local.get $state) (i32.const 12))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_recording_guard (param $device i32) (param $name i32)
    (local $state i32)
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (local.get $state) (then
      (if (call $gl32 (i32.add (local.get $state) (i32.const 1740)))
        (then (call $crash_unimplemented (local.get $name)))))))

  (func $handle_IDirect3DStateBlock9_Capture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_stateblock_transfer (local.get $arg0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DStateBlock9_Apply (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_stateblock_transfer (local.get $arg0) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DStateBlock9_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lo i64) (local $hi i64)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
    (block $done
      (br_if $done (i32.eqz (local.get $arg2)))
      (call $gs32 (local.get $arg2) (i32.const 0))
      (br_if $done (i32.eqz (local.get $arg1)))
      (local.set $lo (i64.load (call $g2w (local.get $arg1))))
      (local.set $hi (i64.load offset=8 (call $g2w (local.get $arg1))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
      (br_if $done (i32.eqz (i32.or
        (i32.and (i64.eq (local.get $lo) (i64.const 0)) (i64.eq (local.get $hi) (i64.const 0x46000000000000c0)))
        (i32.and (i64.eq (local.get $lo) (i64.const 0x4ba8310db07c4fe5)) (i64.eq (local.get $hi) (i64.const 0x8b216f200f4f3ca2))))))
      (drop (call $d3d9_shader_addref (local.get $arg0)))
      (call $gs32 (local.get $arg2) (local.get $arg0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $d3d9_texture_query (param $texture i32) (param $iid_guest i32) (param $out i32)
    (local $iid i32) (local $lo i64) (local $hi i64) (local $match i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (if (i32.eqz (local.get $iid_guest)) (then (return)))
    (local.set $iid (call $g2w (local.get $iid_guest)))
    (local.set $lo (i64.load (local.get $iid))) (local.set $hi (i64.load offset=8 (local.get $iid)))
    (local.set $match (i32.or
      (i32.and (i64.eq (local.get $lo) (i64.const 0)) (i64.eq (local.get $hi) (i64.const 0x46000000000000c0)))
      (i32.or
        (i32.and (i64.eq (local.get $lo) (i64.const 0x43628f7d05eec05d)) (i64.eq (local.get $hi) (i64.const 0x04c757f3bad199b9)))
        (i32.or
          (i32.and (i64.eq (local.get $lo) (i64.const 0x4d541d3c580ca87e)) (i64.eq (local.get $hi) (i64.const 0xce98c2e3d3b71d99)))
          (i32.or
            (i32.and (i32.eq (call $gl32 (i32.add (local.get $texture) (i32.const 12))) (i32.const 3))
              (i32.and (i64.eq (local.get $lo) (i64.const 0x4f003de585c31227)) (i64.eq (local.get $hi) (i64.const 0xb5188cc31af13a9b))))
            (i32.and (i32.eq (call $gl32 (i32.add (local.get $texture) (i32.const 12))) (i32.const 5))
              (i32.and (i64.eq (local.get $lo) (i64.const 0x473ad953fff32f81)) (i64.eq (local.get $hi) (i64.const 0x3fa9ab52d6932392)))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
    (if (local.get $match) (then
      (drop (call $d3d9_shader_addref (local.get $texture)))
      (call $gs32 (local.get $out) (local.get $texture))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)))))

  (func $d3d9_texture_create (param $device i32) (param $width i32) (param $height i32)
    (param $levels i32) (param $usage i32) (param $format i32) (param $pool i32) (param $out i32)
    (call $d3d9_texture_create_kind (local.get $device) (local.get $width) (local.get $height)
      (local.get $levels) (local.get $usage) (local.get $format) (local.get $pool) (local.get $out) (i32.const 3)))

  ;; Cube descriptors are face-major: face * levels + level. Surface aliases
  ;; retain this flattened index, sharing the same bytes and lock state.
  (func $d3d9_texture_block_bytes (param $format i32) (result i32)
    (if (i32.eq (local.get $format) (i32.const 0x31545844)) (then (return (i32.const 8))))
    (if (i32.eq (local.get $format) (i32.const 0x33545844)) (then (return (i32.const 16))))
    (if (i32.eq (local.get $format) (i32.const 0x35545844)) (then (return (i32.const 16))))
    (i32.const 0))

  ;; Uncompressed texel width. The luminance family is narrower than four bytes:
  ;; L8 is one, A8L8 and L16 are two; everything else we store is four. The
  ;; 16-bit colour family (A4R4G4B4) is two as well.
  (func $d3d9_texture_texel_bytes (param $format i32) (result i32)
    (if (i32.eq (local.get $format) (i32.const 50)) (then (return (i32.const 1))))
    (if (i32.or (i32.or (i32.eq (local.get $format) (i32.const 23))
                        (i32.eq (local.get $format) (i32.const 51)))
                (i32.or (i32.or (i32.eq (local.get $format) (i32.const 81))
                                (i32.eq (local.get $format) (i32.const 26)))
                        (i32.or (i32.eq (local.get $format) (i32.const 24))
                                (i32.eq (local.get $format) (i32.const 25))))) (then (return (i32.const 2))))
    (if (i32.eq (local.get $format) (i32.const 20)) (then (return (i32.const 3))))
    (i32.const 4))

  ;; The formats the texture path can store and the draw path can sample. This
  ;; is the one list: the create gate reads it, and so does CheckDeviceFormat,
  ;; so a game's format fallback chain gets a truthful no rather than a yes that
  ;; CreateTexture then contradicts. B&W2's land asks for L8, R8G8B8 and R5G6B5
  ;; as well as the four-byte pair; with those refused and the check still
  ;; saying yes, it left its own texture slot NULL and called through it.
  ;; A4R4G4B4 (26) is the last one it asks for and the one that used to kill it:
  ;; a single 32x32 managed texture, created by the game's own direct call at
  ;; 0x00938af6 with no CheckDeviceFormat ahead of it, so a truthful "no" here
  ;; is not a fallback the game will take -- it dereferences the NULL slot
  ;; thirty instructions later at 0x0093907b.
  (func $d3d9_texture_format_supported (param $format i32) (result i32)
    (if (call $d3d9_texture_block_bytes (local.get $format)) (then (return (i32.const 1))))
    (i32.or
      (i32.or
        (i32.or (i32.eq (local.get $format) (i32.const 20))
                (i32.eq (local.get $format) (i32.const 21)))
        (i32.or (i32.eq (local.get $format) (i32.const 22))
                (i32.eq (local.get $format) (i32.const 23))))
      (i32.or
        (i32.or (i32.or (i32.eq (local.get $format) (i32.const 50))
                        (i32.eq (local.get $format) (i32.const 51)))
                (i32.eq (local.get $format) (i32.const 26)))
        (i32.or (i32.or (i32.eq (local.get $format) (i32.const 62))
                        (i32.eq (local.get $format) (i32.const 81)))
                (i32.or (i32.eq (local.get $format) (i32.const 24))
                        (i32.eq (local.get $format) (i32.const 25)))))))

  (func $d3d9_texture_pitch (param $width i32) (param $format i32) (result i32)
    (local $block i32)
    (local.set $block (call $d3d9_texture_block_bytes (local.get $format)))
    (if (local.get $block) (then (return (i32.mul (local.get $block)
      (i32.shr_u (i32.add (local.get $width) (i32.const 3)) (i32.const 2))))))
    (i32.mul (local.get $width) (call $d3d9_texture_texel_bytes (local.get $format))))

  (func $d3d9_texture_rows (param $height i32) (param $format i32) (result i32)
    (if (call $d3d9_texture_block_bytes (local.get $format)) (then
      (return (i32.shr_u (i32.add (local.get $height) (i32.const 3)) (i32.const 2)))))
    (local.get $height))

  (func $d3d9_texture_create_kind (param $device i32) (param $width i32) (param $height i32)
    (param $levels i32) (param $usage i32) (param $format i32) (param $pool i32) (param $out i32) (param $kind i32)
    (local $count i32) (local $faces i32) (local $vtbl i32) (local $state i32)
    (local $w i32) (local $h i32) (local $max i32) (local $bytes i32)
    (local $obj i32) (local $wa i32) (local $mip i32) (local $i i32) (local $offset i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086C))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (if (i32.eqz (call $d3d9_program_state (local.get $device))) (then (return)))
    (if (i32.or (i32.eqz (local.get $width)) (i32.eqz (local.get $height))) (then (return)))
    (if (i32.or (i32.gt_u (local.get $width) (i32.const 2048))
                (i32.gt_u (local.get $height) (i32.const 2048))) (then (return)))
    ;; Pitch/lock storage stays raw for every uncompressed format; the texel
    ;; width is what varies, and $d3d9_texture_texel_bytes owns it.
    (if (i32.eqz (call $d3d9_texture_format_supported (local.get $format))) (then (return)))
    (if (call $d3d9_texture_block_bytes (local.get $format)) (then
      (if (i32.and (i32.or (local.get $width) (local.get $height)) (i32.const 3)) (then (return)))))
    (if (i32.gt_u (local.get $pool) (i32.const 3)) (then (return)))
    ;; Render-target textures share native storage identities with their surface
    ;; views. Autogen/depth textures and dynamic render targets remain gated.
    (if (i32.and (local.get $usage) (i32.const -514)) (then (return)))
    ;; RGB565 render targets retain packed texture/alias storage on the
    ;; software backend. Preserve historical widening on other backends: BW2
    ;; dereferences a NULL texture if this previously accepted request fails.
    ;; This fallback is not a claim of native RGB565 destination precision.
    ;; A4R4G4B4 widening likewise remains a compatibility limitation.
    (if (i32.and (local.get $usage) (i32.const 1)) (then
      (if (i32.and (i32.eq (local.get $format) (i32.const 23))
        (i32.eqz (call $d3d9_rgb565_supported)))
        (then (local.set $format (i32.const 22))))
      (if (i32.eq (local.get $format) (i32.const 26))
        (then (local.set $format (i32.const 21))))))
    (if (i32.and (local.get $usage) (i32.const 1)) (then
      (if (local.get $pool) (then (return)))
      (if (i32.ne (local.get $usage) (i32.const 1)) (then (return)))
      (if (i32.eqz (call $d3d9_color_target_format (local.get $format))) (then (return)))))
    (local.set $w (local.get $width)) (local.set $h (local.get $height))
    (local.set $max (i32.const 1))
    (block $counted (loop $count
      (br_if $counted (i32.eq (i32.or (local.get $w) (local.get $h)) (i32.const 1)))
      (local.set $w (select (i32.shr_u (local.get $w) (i32.const 1)) (i32.const 1) (i32.gt_u (local.get $w) (i32.const 1))))
      (local.set $h (select (i32.shr_u (local.get $h) (i32.const 1)) (i32.const 1) (i32.gt_u (local.get $h) (i32.const 1))))
      (local.set $max (i32.add (local.get $max) (i32.const 1))) (br $count)))
    (if (i32.eqz (local.get $levels)) (then (local.set $levels (local.get $max))))
    (if (i32.gt_u (local.get $levels) (local.get $max)) (then (return)))
    (local.set $faces (select (i32.const 6) (i32.const 1) (i32.eq (local.get $kind) (i32.const 5))))
    (local.set $count (i32.mul (local.get $levels) (local.get $faces)))
    (local.set $offset (i32.add (i32.const 64) (i32.mul (local.get $count) (i32.const 32))))
    (if (i32.and (local.get $usage) (i32.const 1)) (then
      (local.set $offset (i32.add (local.get $offset) (i32.mul (local.get $count) (i32.const 80))))))
    (local.set $bytes (local.get $offset))
    (local.set $w (local.get $width)) (local.set $h (local.get $height))
    (local.set $i (i32.const 0))
    (loop $size
      (local.set $bytes (i32.add (local.get $bytes) (i32.mul (local.get $faces)
        (i32.mul (call $d3d9_texture_pitch (local.get $w) (local.get $format))
          (call $d3d9_texture_rows (local.get $h) (local.get $format))))))
      (local.set $w (select (i32.shr_u (local.get $w) (i32.const 1)) (i32.const 1) (i32.gt_u (local.get $w) (i32.const 1))))
      (local.set $h (select (i32.shr_u (local.get $h) (i32.const 1)) (i32.const 1) (i32.gt_u (local.get $h) (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $size (i32.lt_u (local.get $i) (local.get $levels))))
    (local.set $obj (call $heap_alloc (local.get $bytes)))
    (if (i32.eqz (local.get $obj)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
    (local.set $wa (call $g2w (local.get $obj)))
    (call $zero_memory (local.get $wa) (local.get $bytes))
    ;; This allocation may reuse a released texture's mip records: move the
    ;; device's texture generation so the host re-checks its snapshots.
    (local.set $state (i32.add (call $d3d9_program_state (local.get $device)) (i32.const 25596)))
    (call $gs32 (local.get $state) (i32.add (call $gl32 (local.get $state)) (i32.const 1)))
    (local.set $vtbl (global.get $DX_VTBL_D3DTEX9))
    (if (i32.eq (local.get $kind) (i32.const 5)) (then
      (local.set $state (call $d3d9_program_state (local.get $device)))
      (local.set $vtbl (call $gl32 (i32.add (local.get $state) (i32.const 21724))))
      (if (i32.eqz (local.get $vtbl)) (then
        (local.set $vtbl (call $init_com_vtable (global.get $API_ID_IDirect3DCubeTexture9_BASE) (i32.const 22)))
        (call $gs32 (i32.add (local.get $state) (i32.const 21724)) (local.get $vtbl))))))
    (i32.store (local.get $wa) (local.get $vtbl))
    (i32.store offset=4 (local.get $wa) (i32.const 1))
    (i32.store offset=8 (local.get $wa) (local.get $device))
    (i32.store offset=12 (local.get $wa) (local.get $kind))
    (i32.store offset=16 (local.get $wa) (local.get $bytes))
    (i32.store offset=24 (local.get $wa) (local.get $width))
    (i32.store offset=28 (local.get $wa) (local.get $height))
    (i32.store offset=32 (local.get $wa) (local.get $levels))
    (i32.store offset=36 (local.get $wa) (local.get $format))
    (i32.store offset=40 (local.get $wa) (local.get $usage))
    (i32.store offset=44 (local.get $wa) (local.get $pool))
    (local.set $w (local.get $width)) (local.set $h (local.get $height))
    (local.set $i (i32.const 0))
    (loop $init
      (local.set $mip (i32.add (local.get $wa) (i32.add (i32.const 64) (i32.mul (local.get $i) (i32.const 32)))))
      (i32.store (local.get $mip) (local.get $w))
      (i32.store offset=4 (local.get $mip) (local.get $h))
      (i32.store offset=8 (local.get $mip) (call $d3d9_texture_pitch (local.get $w) (local.get $format)))
      (local.set $bytes (i32.mul (i32.load offset=8 (local.get $mip))
        (call $d3d9_texture_rows (local.get $h) (local.get $format))))
      (i32.store offset=12 (local.get $mip) (local.get $bytes))
      (i32.store offset=16 (local.get $mip) (i32.add (local.get $obj) (local.get $offset)))
      (local.set $offset (i32.add (local.get $offset) (local.get $bytes)))
      (local.set $w (select (i32.shr_u (local.get $w) (i32.const 1)) (i32.const 1) (i32.gt_u (local.get $w) (i32.const 1))))
      (local.set $h (select (i32.shr_u (local.get $h) (i32.const 1)) (i32.const 1) (i32.gt_u (local.get $h) (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (if (i32.eqz (i32.rem_u (local.get $i) (local.get $levels))) (then
        (local.set $w (local.get $width)) (local.set $h (local.get $height))))
      (br_if $init (i32.lt_u (local.get $i) (local.get $count))))
    (if (i32.and (local.get $usage) (i32.const 1)) (then
      (if (i32.eqz (call $d3d9_texture_colors_init (local.get $obj) (local.get $count))) (then
        (call $heap_free (local.get $obj)) (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))))
    (call $d3d9_reset_resource (local.get $wa) (i32.const 1))
    (drop (call $d3d9_device_addref (local.get $device)))
    (call $gs32 (local.get $out) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_texture_mip (param $texture i32) (param $level i32) (result i32)
    (local $wa i32) (local $kind i32) (local $count i32)
    (if (i32.eqz (local.get $texture)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $texture)))
    (local.set $kind (i32.load offset=12 (local.get $wa)))
    (if (i32.and (i32.ne (local.get $kind) (i32.const 3)) (i32.ne (local.get $kind) (i32.const 5))) (then (return (i32.const 0))))
    (local.set $count (i32.mul (i32.load offset=32 (local.get $wa))
      (select (i32.const 6) (i32.const 1) (i32.eq (local.get $kind) (i32.const 5)))))
    (if (i32.ge_u (local.get $level) (local.get $count)) (then (return (i32.const 0))))
    (i32.add (local.get $wa) (i32.add (i32.const 64) (i32.mul (local.get $level) (i32.const 32)))))

  (func $d3d9_cube_index (param $texture i32) (param $face i32) (param $level i32) (result i32)
    (local $wa i32) (local $levels i32)
    (if (i32.eqz (local.get $texture)) (then (return (i32.const -1))))
    (local.set $wa (call $g2w (local.get $texture)))
    (local.set $levels (i32.load offset=32 (local.get $wa)))
    (if (i32.or (i32.ne (i32.load offset=12 (local.get $wa)) (i32.const 5))
      (i32.or (i32.ge_u (local.get $face) (i32.const 6)) (i32.ge_u (local.get $level) (local.get $levels))))
      (then (return (i32.const -1))))
    (i32.add (i32.mul (local.get $face) (local.get $levels)) (local.get $level)))

  ;; SYSTEMMEM -> DEFAULT textures. Dirty rectangles are upload hints, not
  ;; clipping bounds: copy the complete matching mip chain and advance each
  ;; destination snapshot generation. Validate every level before any write.
  (func $d3d9_texture_update (param $device i32) (param $source i32) (param $dest i32) (param $name_ptr i32)
    (local $src i32) (local $dst i32) (local $sl i32) (local $dl i32)
    (local $faces i32) (local $face i32) (local $level i32) (local $pass i32)
    (local $sm i32) (local $dm i32) (local $i i32) (local $n i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (call $d3d9_program_state (local.get $device))) (then (return)))
    (if (i32.or (i32.eqz (call $d3d9_texture_mip (local.get $source) (i32.const 0)))
      (i32.eqz (call $d3d9_texture_mip (local.get $dest) (i32.const 0)))) (then (return)))
    (local.set $src (call $g2w (local.get $source))) (local.set $dst (call $g2w (local.get $dest)))
    (if (i32.or (i32.ne (i32.load offset=8 (local.get $src)) (local.get $device))
      (i32.ne (i32.load offset=8 (local.get $dst)) (local.get $device))) (then (return)))
    (if (i32.or (i32.ne (i32.load offset=44 (local.get $src)) (i32.const 2))
      (i32.ne (i32.load offset=44 (local.get $dst)) (i32.const 0))) (then (return)))
    (if (i32.or (i32.ne (i32.load offset=12 (local.get $src)) (i32.load offset=12 (local.get $dst)))
      (i32.ne (i32.load offset=36 (local.get $src)) (i32.load offset=36 (local.get $dst)))) (then (return)))
    (local.set $sl (i32.load offset=32 (local.get $src))) (local.set $dl (i32.load offset=32 (local.get $dst)))
    (if (i32.lt_u (local.get $sl) (local.get $dl)) (then (return)))
    ;; GPU-owned render-target texture storage needs a fenced upload, not a
    ;; CPU shadow write. Keep that valid but unsupported path fail-fast.
    (if (i32.load offset=56 (local.get $dst)) (then (call $crash_unimplemented (local.get $name_ptr)) (return)))
    (local.set $faces (select (i32.const 6) (i32.const 1) (i32.eq (i32.load offset=12 (local.get $src)) (i32.const 5))))
    (local.set $n (i32.mul (local.get $faces) (local.get $sl)))
    (loop $source_locks
      (if (i32.load offset=20 (call $d3d9_texture_mip (local.get $source) (local.get $i))) (then (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $source_locks (i32.lt_u (local.get $i) (local.get $n))))
    (loop $passes
      (local.set $face (i32.const 0))
      (loop $faces_loop
        (local.set $level (i32.const 0))
        (loop $levels_loop
          (local.set $sm (call $d3d9_texture_mip (local.get $source)
            (i32.add (i32.mul (local.get $face) (local.get $sl)) (i32.add (i32.sub (local.get $sl) (local.get $dl)) (local.get $level)))))
          (local.set $dm (call $d3d9_texture_mip (local.get $dest)
            (i32.add (i32.mul (local.get $face) (local.get $dl)) (local.get $level))))
          (if (i32.eqz (local.get $pass)) (then
            (if (i32.load offset=20 (local.get $dm)) (then (return)))
            (if (i32.or (i64.ne (i64.load (local.get $sm)) (i64.load (local.get $dm)))
              (i64.ne (i64.load offset=8 (local.get $sm)) (i64.load offset=8 (local.get $dm)))) (then (return))))
          (else
            (memory.copy (call $g2w (i32.load offset=16 (local.get $dm)))
              (call $g2w (i32.load offset=16 (local.get $sm))) (i32.load offset=12 (local.get $sm)))
            (i32.store offset=28 (local.get $dm) (i32.add (i32.load offset=28 (local.get $dm)) (i32.const 1)))))
          (local.set $level (i32.add (local.get $level) (i32.const 1)))
          (br_if $levels_loop (i32.lt_u (local.get $level) (local.get $dl))))
        (local.set $face (i32.add (local.get $face) (i32.const 1)))
        (br_if $faces_loop (i32.lt_u (local.get $face) (local.get $faces))))
      (local.set $pass (i32.add (local.get $pass) (i32.const 1)))
      (br_if $passes (i32.lt_u (local.get $pass) (i32.const 2))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_texture_lock (param $texture i32) (param $level i32) (param $out i32) (param $rect i32) (param $flags i32)
    (local $mip i32) (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $block i32) (local $xbytes i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086C))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (call $gs32 (i32.add (local.get $out) (i32.const 4)) (i32.const 0))
    (local.set $mip (call $d3d9_texture_mip (local.get $texture) (local.get $level)))
    (if (i32.eqz (local.get $mip)) (then (return)))
    (if (i32.and (call $gl32 (i32.add (local.get $texture) (i32.const 40))) (i32.const 1)) (then (return)))
    (if (i32.load offset=20 (local.get $mip)) (then (return)))
    (if (i32.and (local.get $flags) (i32.const -43025)) (then (return))) ;; READONLY|NOSYSLOCK|DISCARD|NO_DIRTY_UPDATE
    (local.set $right (i32.load (local.get $mip))) (local.set $bottom (i32.load offset=4 (local.get $mip)))
    (if (local.get $rect) (then
      (local.set $left (call $gl32 (local.get $rect)))
      (local.set $top (call $gl32 (i32.add (local.get $rect) (i32.const 4))))
      (local.set $right (call $gl32 (i32.add (local.get $rect) (i32.const 8))))
      (local.set $bottom (call $gl32 (i32.add (local.get $rect) (i32.const 12))))))
    (if (i32.or (i32.ge_u (local.get $left) (local.get $right)) (i32.ge_u (local.get $top) (local.get $bottom))) (then (return)))
    (if (i32.or (i32.gt_u (local.get $right) (i32.load (local.get $mip)))
      (i32.gt_u (local.get $bottom) (i32.load offset=4 (local.get $mip)))) (then (return)))
    (local.set $block (call $d3d9_texture_block_bytes (call $gl32 (i32.add (local.get $texture) (i32.const 36)))))
    (local.set $xbytes (i32.mul (local.get $left)
      (call $d3d9_texture_texel_bytes (call $gl32 (i32.add (local.get $texture) (i32.const 36))))))
    (if (local.get $block) (then
      (if (i32.and (i32.or (local.get $left) (local.get $top)) (i32.const 3)) (then (return)))
      (if (i32.and (i32.ne (i32.and (local.get $right) (i32.const 3)) (i32.const 0))
        (i32.ne (local.get $right) (i32.load (local.get $mip)))) (then (return)))
      (if (i32.and (i32.ne (i32.and (local.get $bottom) (i32.const 3)) (i32.const 0))
        (i32.ne (local.get $bottom) (i32.load offset=4 (local.get $mip)))) (then (return)))
      (local.set $top (i32.shr_u (local.get $top) (i32.const 2)))
      (local.set $xbytes (i32.mul (i32.shr_u (local.get $left) (i32.const 2)) (local.get $block)))))
    (i32.store offset=20 (local.get $mip) (i32.or (local.get $flags) (i32.const 0x80000000)))
    (call $gs32 (local.get $out) (i32.load offset=8 (local.get $mip)))
    (call $gs32 (i32.add (local.get $out) (i32.const 4))
      (i32.add (i32.load offset=16 (local.get $mip))
        (i32.add (i32.mul (local.get $top) (i32.load offset=8 (local.get $mip))) (local.get $xbytes))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_texture_desc (param $texture i32) (param $level i32) (param $out i32)
    (local $mip i32) (local $wa i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086C))
    (if (i32.eqz (local.get $out)) (then (return)))
    (local.set $mip (call $d3d9_texture_mip (local.get $texture) (local.get $level)))
    (if (i32.eqz (local.get $mip)) (then (return)))
    (local.set $wa (call $g2w (local.get $out)))
    (call $zero_memory (local.get $wa) (i32.const 32))
    (i32.store (local.get $wa) (call $gl32 (i32.add (local.get $texture) (i32.const 36))))
    (i32.store offset=4 (local.get $wa) (i32.const 1))
    (i32.store offset=8 (local.get $wa) (call $gl32 (i32.add (local.get $texture) (i32.const 40))))
    (i32.store offset=12 (local.get $wa) (call $gl32 (i32.add (local.get $texture) (i32.const 44))))
    (i32.store offset=24 (local.get $wa) (i32.load (local.get $mip)))
    (i32.store offset=28 (local.get $wa) (i32.load offset=4 (local.get $mip)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_texture_binding (param $device i32) (param $stage i32) (param $texture i32) (param $get i32)
    (local $state i32) (local $slot i32) (local $old i32) (local $wa i32) (local $block i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086C))
    (if (i32.ge_u (local.get $stage) (i32.const 6)) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $slot (i32.add (local.get $state) (call $d3d9_texture_offset (local.get $stage))))
    (local.set $old (call $gl32 (local.get $slot)))
    (if (local.get $get) (then
      (if (i32.eqz (local.get $texture)) (then (return)))
      (if (local.get $old) (then (drop (call $d3d9_shader_addref (local.get $old)))))
      (call $gs32 (local.get $texture) (local.get $old))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (local.get $texture) (then
      (if (i32.eqz (call $d3d9_texture_mip (local.get $texture) (i32.const 0))) (then (return)))
      (local.set $wa (call $g2w (local.get $texture)))
      (if (i32.ne (i32.load offset=8 (local.get $wa)) (local.get $device)) (then (return)))
      (if (i32.gt_u (i32.load offset=44 (local.get $wa)) (i32.const 1)) (then (return)))
    ))
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
    (if (local.get $block) (then
      (call $d3d9_stateblock_texture (call $g2w (local.get $block)) (local.get $stage) (local.get $texture))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (local.get $texture) (then
      (i32.store offset=20 (local.get $wa) (i32.add (i32.load offset=20 (local.get $wa)) (i32.const 1)))))
    (call $gs32 (local.get $slot) (local.get $texture))
    (call $d3d9_shader_unbind (local.get $old))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Texture level surfaces are real independent interface identities, retained
  ;; by callers and aliasing the parent's pixels/lock state. Header: vtbl,refs,
  ;; parent texture, unique kind marker, mip index. The parent cache is weak.
  (func $d3d9_is_texture_surface (param $surface i32) (result i32)
    (if (i32.eqz (local.get $surface)) (then (return (i32.const 0))))
    (i32.eq (call $gl32 (i32.add (local.get $surface) (i32.const 12))) (i32.const 0xd3d90001)))

  (func $d3d9_surface_query (param $surface i32) (param $iid i32) (param $out i32)
    (local $lo i64) (local $hi i64) (local $match i32) (local $stack i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (if (i32.eqz (local.get $iid)) (then (return)))
    (local.set $lo (i64.load (call $g2w (local.get $iid))))
    (local.set $hi (i64.load offset=8 (call $g2w (local.get $iid))))
    (local.set $match (i32.or
      (i32.and (i64.eq (local.get $lo) (i64.const 0)) (i64.eq (local.get $hi) (i64.const 0x46000000000000c0)))
      (i32.or
        (i32.and (i64.eq (local.get $lo) (i64.const 0x43628f7d05eec05d)) (i64.eq (local.get $hi) (i64.const 0x04c757f3bad199b9)))
        (i32.and (i64.eq (local.get $lo) (i64.const 0x429a9ff60cfbaf3a)) (i64.eq (local.get $hi) (i64.const 0x9bb8f86a79a2b399))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
    (if (i32.eqz (local.get $match)) (then (return)))
    (local.set $stack (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirect3DSurface9_AddRef (local.get $surface) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $out) (local.get $surface))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_texture_surface (param $texture i32) (param $level i32) (param $out i32)
    (local $mip i32) (local $surface i32) (local $wa i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086C))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (local.set $mip (call $d3d9_texture_mip (local.get $texture) (local.get $level)))
    (if (i32.eqz (local.get $mip)) (then (return)))
    (local.set $surface (i32.load offset=24 (local.get $mip)))
    (if (local.get $surface) (then
      (call $gs32 (i32.add (local.get $surface) (i32.const 4))
        (i32.add (call $gl32 (i32.add (local.get $surface) (i32.const 4))) (i32.const 1))))
    (else
      (local.set $surface (call $heap_alloc (i32.const 20)))
      (if (i32.eqz (local.get $surface)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
      (local.set $wa (call $g2w (local.get $surface)))
      (i32.store (local.get $wa) (global.get $DX_VTBL_D3DSURF9))
      (i32.store offset=4 (local.get $wa) (i32.const 1))
      (i32.store offset=8 (local.get $wa) (local.get $texture))
      (i32.store offset=12 (local.get $wa) (i32.const 0xd3d90001))
      (i32.store offset=16 (local.get $wa) (local.get $level))
      (drop (call $d3d9_shader_addref (local.get $texture)))
      (i32.store offset=24 (local.get $mip) (local.get $surface))))
    (call $gs32 (local.get $out) (local.get $surface))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d9_texture_surface_release (param $surface i32) (result i32)
    (local $wa i32) (local $refs i32) (local $texture i32) (local $mip i32) (local $stack i32)
    (local.set $wa (call $g2w (local.get $surface)))
    (local.set $refs (i32.sub (i32.load offset=4 (local.get $wa)) (i32.const 1)))
    (i32.store offset=4 (local.get $wa) (local.get $refs))
    (if (i32.eqz (local.get $refs)) (then
      (local.set $texture (i32.load offset=8 (local.get $wa)))
      (local.set $mip (call $d3d9_texture_mip (local.get $texture) (i32.load offset=16 (local.get $wa))))
      (i32.store offset=24 (local.get $mip) (i32.const 0))
      (call $heap_free (local.get $surface))
      (local.set $stack (i32.load offset=16 (global.get $reg_base)))
      (call $handle_IDirect3DTexture9_Release (local.get $texture) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (local.get $stack))))
    (local.get $refs))

  (func $d3d9_texture_surface_unlock (param $surface i32)
    (local $stack i32)
    (local.set $stack (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirect3DTexture9_UnlockRect
      (call $gl32 (i32.add (local.get $surface) (i32.const 8)))
      (call $gl32 (i32.add (local.get $surface) (i32.const 16)))
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack)))

  (func $d3d9_sampler_state (param $device i32) (param $stage i32) (param $type i32) (param $value i32) (param $get i32)
    (local $state i32) (local $slot i32) (local $block i32) (local $index i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086C))
    (if (i32.ge_u (local.get $stage) (i32.const 6)) (then (return)))
    (if (i32.or (i32.eqz (local.get $type)) (i32.gt_u (local.get $type) (i32.const 13))) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $slot (i32.add (local.get $state) (i32.add (call $d3d9_sampler_offset (local.get $stage))
      (i32.mul (local.get $type) (i32.const 4)))))
    (if (local.get $get) (then
      (if (i32.eqz (local.get $value)) (then (return)))
      (call $gs32 (local.get $value) (call $gl32 (local.get $slot)))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.le_u (local.get $type) (i32.const 3)) (then
      (if (i32.or (i32.eqz (local.get $value)) (i32.gt_u (local.get $value) (i32.const 3))) (then (return))))
    (else (if (i32.or (i32.eq (local.get $type) (i32.const 5)) (i32.eq (local.get $type) (i32.const 6))) (then
      (if (i32.or (i32.eqz (local.get $value)) (i32.gt_u (local.get $value) (i32.const 2))) (then (return))))
    (else (if (i32.eq (local.get $type) (i32.const 7)) (then
      (if (i32.gt_u (local.get $value) (i32.const 2)) (then (return))))
    (else (if (i32.eq (local.get $type) (i32.const 10)) (then
      (if (i32.ne (local.get $value) (i32.const 1)) (then (return))))
    (else (if (i32.eq (local.get $type) (i32.const 8)) (then
      ;; MIPMAPLODBIAS is a float encoded as DWORD, not an integer enum.
      (if (i32.eq (i32.and (local.get $value) (i32.const 0x7f800000)) (i32.const 0x7f800000)) (then (return))))
    (else (if (i32.and (i32.ne (local.get $type) (i32.const 4)) (i32.ne (local.get $type) (i32.const 9)))
      (then (if (local.get $value) (then (return)))))))))))))))
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 1740))))
    (if (local.get $block) (then
      (local.set $block (call $g2w (local.get $block)))
      (local.set $index (i32.add (i32.const 256) (i32.add (i32.mul (local.get $stage) (i32.const 16)) (local.get $type))))
      (i32.store8 (i32.add (local.get $block) (call $d3d9_block_state_mask (local.get $index))) (i32.const 1))
      (i32.store (i32.add (local.get $block) (call $d3d9_block_state_value (local.get $index))) (local.get $value)))
    (else (call $gs32 (local.get $slot) (local.get $value))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
