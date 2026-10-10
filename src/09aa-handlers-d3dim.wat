  ;; ============================================================
  ;; DIRECT3D IMMEDIATE MODE HANDLERS — hand-maintained implementations
  ;; tools/d3dim-methods.js owns interface order and dispatch aliases;
  ;; this fragment owns handler bodies. Do not regenerate from stub recipes.
  ;; ============================================================

  ;; A DX1 Pick executes one buffer at a time, and the historical runtime
  ;; stops after the first triangle hit in that buffer.  Keep that record on
  ;; the device module until GetPickRecords copies it to the caller.
  (global $D3DIM_PICK_COUNT (mut i32) (i32.const 0))
  (global $D3DIM_PICK_OPCODE (mut i32) (i32.const 0))
  (global $D3DIM_PICK_OFFSET (mut i32) (i32.const 0))
  (global $D3DIM_PICK_Z (mut f32) (f32.const 0.0))

  ;; One ordered light-list head per DX object slot.  Viewport entries already
  ;; use all 32 bytes (device, rectangle, background), while light entries have
  ;; room for their viewport owner, light index and next/previous links.  The
  ;; list therefore needs only this one shared pointer per possible viewport.
  ;; D3D v1-v3 expose at most eight lights on a viewport.
  (global $D3DIM_VIEWPORT_LIGHT_HEAD i32 (region.addr $D3DIM_VIEWPORT_LIGHT_HEAD 0))
  (global $D3DIM_VIEWPORT_LIGHT_HEAD_SIZE i32 (region.size $D3DIM_VIEWPORT_LIGHT_HEAD))

  (func $d3dim_viewport_light_head_addr (param $this i32) (result i32)
    (i32.add (global.get $D3DIM_VIEWPORT_LIGHT_HEAD)
      (i32.shl (call $dx_slot_of (call $dx_from_this (local.get $this))) (i32.const 2))))

  ;; Drop one reference while LOCK_DX is held.  Viewport attachment owns a COM
  ;; reference just like Win98 Direct3D, so DeleteLight / viewport destruction
  ;; can be the operation that finally destroys a light.
  (func $d3dim_light_release_locked (param $entry i32)
    (local $rc i32) (local $buf i32)
    (local.set $rc
      (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (local.set $buf (load.field DxObject misc0 (local.get $entry)))
        (if (local.get $buf) (then (call $heap_free (local.get $buf))))
        (call $dx_free (local.get $entry)))
      (else
        (store.field DxObject refcount (local.get $entry) (local.get $rc)))))

  (func $d3dim_viewport_add_light (param $this i32) (param $light i32) (result i32)
    (local $vp_entry i32) (local $light_entry i32) (local $head_addr i32)
    (local $head i32) (local $cur i32) (local $cur_entry i32)
    (local $count i32) (local $used i32) (local $index i32)
    (local $hr i32)
    (if (i32.or (i32.eqz (local.get $this)) (i32.eqz (local.get $light)))
      (then (return (i32.const 0x80070057)))) ;; DDERR_INVALIDPARAMS
    (local.set $vp_entry (call $dx_from_this (local.get $this)))
    (local.set $light_entry (call $dx_from_this (local.get $light)))
    (if (i32.or
          (i32.ne (i32.load (local.get $vp_entry)) (i32.const 23))
          (i32.ne (i32.load (local.get $light_entry)) (i32.const 24)))
      (then (return (i32.const 0x80070057))))
    (local.set $head_addr (call $d3dim_viewport_light_head_addr (local.get $this)))
    (call $lock_acquire (global.get $LOCK_DX))
    (if (i32.load (i32.add (local.get $light_entry) (i32.const 12)))
      (then
        (local.set $hr (i32.const 0x887602EF))) ;; D3DERR_LIGHTHASVIEWPORT
      (else
        (local.set $head (i32.load (local.get $head_addr)))
        (local.set $cur (local.get $head))
        (block $scanned (loop $scan
          (br_if $scanned (i32.eqz (local.get $cur)))
          (br_if $scanned (i32.ge_u (local.get $count) (i32.const 8)))
          (local.set $cur_entry (call $dx_from_this (local.get $cur)))
          (local.set $used
            (i32.or (local.get $used)
              (i32.shl (i32.const 1)
                (i32.load (i32.add (local.get $cur_entry) (i32.const 16))))))
          (local.set $count (i32.add (local.get $count) (i32.const 1)))
          (local.set $cur (i32.load (i32.add (local.get $cur_entry) (i32.const 20))))
          (br $scan)))
        (if (i32.ge_u (local.get $count) (i32.const 8))
          (then (local.set $hr (i32.const 0x80070057)))
          (else
            (block $index_found (loop $find_index
              (br_if $index_found
                (i32.eqz (i32.and (local.get $used)
                  (i32.shl (i32.const 1) (local.get $index)))))
              (local.set $index (i32.add (local.get $index) (i32.const 1)))
              (br $find_index)))
            ;; Light entry: +12 owner viewport, +16 driver light index,
            ;; +20 next, +24 previous.  Add at the head, matching Win9x.
            (i32.store (i32.add (local.get $light_entry) (i32.const 12)) (local.get $this))
            (i32.store (i32.add (local.get $light_entry) (i32.const 16)) (local.get $index))
            (i32.store (i32.add (local.get $light_entry) (i32.const 20)) (local.get $head))
            (i32.store (i32.add (local.get $light_entry) (i32.const 24)) (i32.const 0))
            (if (local.get $head) (then
              (local.set $cur_entry (call $dx_from_this (local.get $head)))
              (i32.store (i32.add (local.get $cur_entry) (i32.const 24)) (local.get $light))))
            (i32.store (local.get $head_addr) (local.get $light))
            (i32.store (i32.add (local.get $light_entry) (i32.const 4))
              (i32.add (i32.load (i32.add (local.get $light_entry) (i32.const 4)))
                (i32.const 1)))))))
    (call $lock_release (global.get $LOCK_DX))
    (local.get $hr))

  (func $d3dim_viewport_delete_light (param $this i32) (param $light i32) (result i32)
    (local $vp_entry i32) (local $entry i32) (local $head_addr i32)
    (local $next i32) (local $prev i32) (local $link_entry i32)
    (local $hr i32)
    (if (i32.or (i32.eqz (local.get $this)) (i32.eqz (local.get $light)))
      (then (return (i32.const 0x80070057))))
    (local.set $vp_entry (call $dx_from_this (local.get $this)))
    (local.set $entry (call $dx_from_this (local.get $light)))
    (if (i32.or
          (i32.ne (i32.load (local.get $vp_entry)) (i32.const 23))
          (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 24)))
      (then (return (i32.const 0x80070057))))
    (local.set $head_addr (call $d3dim_viewport_light_head_addr (local.get $this)))
    (call $lock_acquire (global.get $LOCK_DX))
    (if (i32.ne (i32.load (i32.add (local.get $entry) (i32.const 12))) (local.get $this))
      (then
        (local.set $hr (i32.const 0x887602F0))) ;; D3DERR_LIGHTNOTINTHISVIEWPORT
      (else
        (local.set $next (load.field DxObject misc1 (local.get $entry)))
        (local.set $prev (load.field DxObject misc2 (local.get $entry)))
        (if (local.get $prev)
          (then
            (local.set $link_entry (call $dx_from_this (local.get $prev)))
            (i32.store (i32.add (local.get $link_entry) (i32.const 20)) (local.get $next)))
          (else (i32.store (local.get $head_addr) (local.get $next))))
        (if (local.get $next) (then
          (local.set $link_entry (call $dx_from_this (local.get $next)))
          (i32.store (i32.add (local.get $link_entry) (i32.const 24)) (local.get $prev))))
        (i32.store (i32.add (local.get $entry) (i32.const 12)) (i32.const 0))
        (i32.store (i32.add (local.get $entry) (i32.const 16)) (i32.const 0))
        (store.field DxObject misc1 (local.get $entry) (i32.const 0))
        (store.field DxObject misc2 (local.get $entry) (i32.const 0))
        (call $d3dim_light_release_locked (local.get $entry))))
    (call $lock_release (global.get $LOCK_DX))
    (local.get $hr))

  (func $d3dim_viewport_next_light
    (param $this i32) (param $light i32) (param $out i32) (param $flags i32) (result i32)
    (local $vp_entry i32) (local $entry i32) (local $result i32)
    (local $result_entry i32) (local $steps i32) (local $hr i32)
    (if (i32.or (i32.eqz (local.get $this)) (i32.eqz (local.get $out)))
      (then (return (i32.const 0x80070057))))
    (local.set $vp_entry (call $dx_from_this (local.get $this)))
    (if (i32.ne (i32.load (local.get $vp_entry)) (i32.const 23))
      (then (return (i32.const 0x80070057))))
    (call $lock_acquire (global.get $LOCK_DX))
    (if (i32.eq (local.get $flags) (i32.const 2)) ;; D3DNEXT_HEAD
      (then
        (local.set $result
          (i32.load (call $d3dim_viewport_light_head_addr (local.get $this)))))
      (else (if (i32.eq (local.get $flags) (i32.const 4)) ;; D3DNEXT_TAIL
        (then
          (local.set $result
            (i32.load (call $d3dim_viewport_light_head_addr (local.get $this))))
          (block $tail_done (loop $tail
            (br_if $tail_done (i32.eqz (local.get $result)))
            (local.set $result_entry (call $dx_from_this (local.get $result)))
            (br_if $tail_done
              (i32.eqz (i32.load (i32.add (local.get $result_entry) (i32.const 20)))))
            (local.set $result
              (i32.load (i32.add (local.get $result_entry) (i32.const 20))))
            (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
            (br_if $tail_done (i32.ge_u (local.get $steps) (i32.const 8)))
            (br $tail))))
        (else (if (i32.eq (local.get $flags) (i32.const 1)) ;; D3DNEXT_NEXT
          (then
            (if (local.get $light) (then
              (local.set $entry (call $dx_from_this (local.get $light)))
              (if (i32.and
                    (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 24))
                    (i32.eq (i32.load (i32.add (local.get $entry) (i32.const 12)))
                      (local.get $this)))
                (then (local.set $result
                  (load.field DxObject misc1 (local.get $entry))))))))
          (else (local.set $hr (i32.const 0x80070057))))))))
    (if (i32.and
          (i32.eqz (local.get $hr))
          (i32.ne (local.get $result) (i32.const 0)))
      (then
        (local.set $result_entry (call $dx_from_this (local.get $result)))
        (i32.store (i32.add (local.get $result_entry) (i32.const 4))
          (i32.add (i32.load (i32.add (local.get $result_entry) (i32.const 4)))
            (i32.const 1)))
        (call $gs32 (local.get $out) (local.get $result)))
      (else
        (call $gs32 (local.get $out) (i32.const 0))
        (if (i32.eqz (local.get $hr))
          (then (local.set $hr (i32.const 0x80070057))))))
    (call $lock_release (global.get $LOCK_DX))
    (local.get $hr))

  (func $d3dim_viewport_release_owned (param $this i32)
    ;; Viewport::Release enters here without holding LOCK_DX.  Device teardown
    ;; and current-viewport replacement already hold it, so the list walker is
    ;; split into the locked core appended in 09ab and this locking wrapper.
    (if (i32.eqz (local.get $this)) (then (return)))
    (call $lock_acquire (global.get $LOCK_DX))
    (call $d3dim_viewport_release_owned_locked (local.get $this))
    ;; Do not make the locked core acquire recursively: the DX lock is shared
    ;; between real Worker instances, and device destruction needs to drop two
    ;; viewport references while keeping owner/current state atomic.
    ;;
    ;; Keeping this wrapper also leaves every Viewport1/2/3 Release handler on
    ;; one path. A viewport that owns lights can therefore be destroyed either
    ;; directly or as the last consequence of device cleanup without leaking
    ;; the light-list references.
    ;;
    ;; The locked helper keeps the list's eight-entry bound before walking it,
    ;; matching AddLight and NextLight's bounded state model.
    ;;
    ;;
    ;;
    (call $lock_release (global.get $LOCK_DX)))

  ;; ── IDirect3D2 — 9 methods ─────────────
  ;; QueryInterface aliases IDirect3D_QueryInterface through the interface spec.

  ;; IDirect3D2_EnumDevices(this, lpEnumDevicesCallback, lpUserArg) — 3 args
  ;; Delegates to shared HAL-device enumerator (same callback contract as v1/v3).
  (func $handle_IDirect3D2_EnumDevices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $d3d_enum_devices_invoke (local.get $arg1) (local.get $arg2) (local.get $ret_addr) (i32.const 2)))

  ;; IDirect3D2_CreateLight — 3 args (incl. this)
  (func $handle_IDirect3D2_CreateLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_create_child
      (local.get $arg1) (local.get $arg2)
      (i32.const 24) (global.get $DX_VTBL_D3DLIGHT)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D2_CreateMaterial — 3 args (incl. this)
  (func $handle_IDirect3D2_CreateMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 25) (global.get $DX_VTBL_D3DMAT2)))
    (if (i32.eqz (local.get $obj)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (call $gs32 (local.get $arg1) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D2_CreateViewport — 3 args (incl. this)
  (func $handle_IDirect3D2_CreateViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_create_child
      (local.get $arg1) (local.get $arg2)
      (i32.const 23) (global.get $DX_VTBL_D3DVP2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D2_FindDevice — 3 args (incl. this)
  (func $handle_IDirect3D2_FindDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d_fill_find_device_result (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D2_CreateDevice — 4 args (incl. this)
  (func $handle_IDirect3D2_CreateDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_create_device (local.get $arg0) (local.get $arg2) (local.get $arg3) (global.get $DX_VTBL_D3DDEV2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))


  ;; ── IDirect3D7 — 8 methods ─────────────
  ;; QueryInterface aliases IDirect3D_QueryInterface through the interface spec.

  ;; IDirect3D7_EnumDevices — 3 args (incl. this)
  (func $handle_IDirect3D7_EnumDevices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $d3d_enum_devices7_invoke (local.get $arg1) (local.get $arg2) (local.get $ret_addr)))

  ;; IDirect3D7_CreateDevice — 4 args (incl. this)
  (func $handle_IDirect3D7_CreateDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_create_device (local.get $arg0) (local.get $arg2) (local.get $arg3) (global.get $DX_VTBL_D3DDEV7))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirect3D7_CreateVertexBuffer — 4 args (incl. this)
  (func $handle_IDirect3D7_CreateVertexBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_create_vb (local.get $arg1) (local.get $arg2) (global.get $DX_VTBL_D3DVB7))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))


  ;; IDirect3D7_EvictManagedTextures — 1 args (incl. this)
  (func $handle_IDirect3D7_EvictManagedTextures (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))


  ;; ── IDirect3DDevice — 22 methods ─────────────
  ;; IDirect3DDevice_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DDevice_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 2) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice_Release — 1 args (incl. this)
  (func $handle_IDirect3DDevice_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; All QI revisions share one type-20 device and attachment lifetime.
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_release (local.get $arg0)))



    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice_Initialize — 4 args (incl. this)
  (func $handle_IDirect3DDevice_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirect3DDevice_GetCaps — 3 args (incl. this): (this, lpHWDesc, lpHELDesc)
  (func $handle_IDirect3DDevice_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_fill_device_desc (local.get $arg1))
    (call $d3dim_fill_device_desc (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice_SwapTextureHandles — 3 args (incl. this)
  (func $handle_IDirect3DDevice_SwapTextureHandles (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice_CreateExecuteBuffer — 4 args (incl. this)
  ;; args: this, lpDesc (D3DEXECUTEBUFFERDESC*), lplpBuffer (out), pUnkOuter
  ;; DX_OBJECTS entry layout for ExecuteBuffer (type=21):
  ;;   +8  bufPtr (guest)   +12 bufSize
  ;;   +16 vertOff          +20 vertCount
  ;;   +24 instrOff         +28 instrLen
  (func $handle_IDirect3DDevice_CreateExecuteBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32) (local $entry i32) (local $sz i32) (local $buf i32)
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    ;; Read dwBufferSize from desc (offset +12)
    (local.set $sz (i32.const 0))
    (if (local.get $arg1) (then
      (local.set $sz (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))))
    ;; Clamp to sane range (drop zero/huge to a reasonable default)
    (if (i32.or (i32.eqz (local.get $sz)) (i32.gt_u (local.get $sz) (i32.const 0x100000)))
      (then (local.set $sz (i32.const 0x4000))))
    ;; Allocate fallible storage before consuming a permanent COM wrapper.
    (local.set $buf (call $heap_alloc (local.get $sz)))
    (if (i32.eqz (local.get $buf)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
      (return)))
    (local.set $obj (call $dx_create_com_obj (i32.const 21) (global.get $DX_VTBL_D3DEXEC)))
    (if (i32.eqz (local.get $obj)) (then
      (call $heap_free (local.get $buf))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
      (return)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject misc0 (local.get $entry) (local.get $buf))
    (i32.store (i32.add (local.get $entry) (i32.const 12)) (local.get $sz))
    (call $gs32 (local.get $arg2) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirect3DDevice_GetStats — 2 args (incl. this)
  (func $handle_IDirect3DDevice_GetStats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_get_stats (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice_Execute — 4 args (incl. this)
  ;; args: this, lpDirect3DExecuteBuffer, lpDirect3DViewport, dwFlags
  ;; Walk D3DINSTRUCTION stream and emit a trace event per opcode.
  ;; D3DINSTRUCTION: {u8 bOpcode; u8 bSize; u16 wCount;} = 4 bytes, then wCount*bSize operand bytes.
  (func $handle_IDirect3DDevice_Execute (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $eb_entry i32) (local $buf i32) (local $instr_off i32) (local $instr_len i32)
    (local $cursor i32) (local $end i32) (local $op i32) (local $sz i32) (local $cnt i32) (local $step i32)
    (local $branch i32) (local $handled i32) (local $record_index i32)
    (local $saved_extent i32) (local $saved_extent_rt i32) (local $extent_header i32)
    (local $state i32) (local $vp_entry i32) (local $sw i32)
    (local $vp_x i32) (local $vp_y i32) (local $vp_w i32) (local $vp_h i32)
    ;; Execute buffers never go to the render Worker. With the GPU executor
    ;; their triangles do go to it, in order, so the fence waits for the ops
    ;; that still rasterize into the DIB (points, lines, wireframe).
    (if (i32.eqz (global.get $d3dim_gpu_on)) (then (call $d3dim_worker_fence)))
    (local.set $saved_extent (global.get $d3dim_exec_extent_guest))
    (local.set $saved_extent_rt (global.get $d3dim_exec_extent_rt))
    (global.set $d3dim_exec_extent_guest (i32.const 0))
    (global.set $d3dim_exec_extent_rt (call $d3ddev_rt_entry (local.get $arg0)))
    (local.set $extent_header (call $d3dim_execbuf_cache_header_guest (local.get $arg1)))
    (if (local.get $extent_header) (then
      (global.set $d3dim_exec_extent_guest (i32.add (local.get $extent_header) (i32.const 16)))))
    ;; DX1 selects the transform viewport per Execute call. It has no
    ;; Device2::SetCurrentViewport requirement, so legacy apps commonly only
    ;; AddViewport/SetViewport and pass that object here (Tunnel and Twist do).
    (if (local.get $arg2) (then
      (local.set $state (call $d3ddev_state (local.get $arg0)))
      (local.set $vp_entry (call $dx_from_this (local.get $arg2)))
      (if (i32.and (i32.ne (local.get $state) (i32.const 0))
                   (i32.ne (local.get $vp_entry) (i32.const 0)))
        (then
          (local.set $sw (call $g2w (local.get $state)))
          (local.set $vp_x (i32.load (i32.add (local.get $vp_entry) (i32.const 12))))
          (local.set $vp_y (i32.load (i32.add (local.get $vp_entry) (i32.const 16))))
          (local.set $vp_w (i32.load (i32.add (local.get $vp_entry) (i32.const 20))))
          (local.set $vp_h (i32.load (i32.add (local.get $vp_entry) (i32.const 24))))
          (i32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_RECT)) (local.get $vp_x))
          (i32.store (i32.add (local.get $sw)
            (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 4))) (local.get $vp_y))
          (i32.store (i32.add (local.get $sw)
            (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 8))) (local.get $vp_w))
          (i32.store (i32.add (local.get $sw)
            (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 12))) (local.get $vp_h))
          (f32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))
            (f32.div (f32.convert_i32_s (local.get $vp_w)) (f32.const 2.0)))
          (f32.store (i32.add (local.get $sw)
            (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 4)))
            (f32.div (f32.convert_i32_s (local.get $vp_h)) (f32.const 2.0)))
          (f32.store (i32.add (local.get $sw)
            (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 8))) (f32.const 0.0))
          (f32.store (i32.add (local.get $sw)
            (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 12))) (f32.const 1.0))
          (f32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN))
            (f32.add (f32.convert_i32_s (local.get $vp_x))
                     (f32.div (f32.convert_i32_s (local.get $vp_w)) (f32.const 2.0))))
          (f32.store (i32.add (local.get $sw)
            (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 4)))
            (f32.add (f32.convert_i32_s (local.get $vp_y))
                     (f32.div (f32.convert_i32_s (local.get $vp_h)) (f32.const 2.0))))))))
    (if (local.get $arg1) (then
      (local.set $eb_entry (call $dx_from_this (local.get $arg1)))
      (local.set $buf       (i32.load (i32.add (local.get $eb_entry) (i32.const 8))))
      (local.set $instr_off (i32.load (i32.add (local.get $eb_entry) (i32.const 24))))
      (local.set $instr_len (i32.load (i32.add (local.get $eb_entry) (i32.const 28))))
      ;; kind=8: Execute-entry: slot=bufPtr, a=instr_off, b=instr_len, c=0
      (call $host_dx_trace (i32.const 8) (local.get $buf) (local.get $instr_off)
        (local.get $instr_len) (i32.const 0))
      (if (i32.and (i32.ne (local.get $buf) (i32.const 0)) (i32.ne (local.get $instr_len) (i32.const 0))) (then
        ;; Instruction cursors and record inputs are guest addresses throughout.
        (local.set $cursor (i32.add (local.get $buf) (local.get $instr_off)))
        (local.set $end (i32.add (local.get $cursor) (local.get $instr_len)))
        (block $done (loop $lp
          (br_if $done (i32.ge_u (i32.add (local.get $cursor) (i32.const 4)) (local.get $end)))
          (local.set $op  (call $gl8 (local.get $cursor)))
          (local.set $sz  (call $gl8 (i32.add (local.get $cursor) (i32.const 1))))
          (local.set $cnt (call $gl16 (i32.add (local.get $cursor) (i32.const 2))))
          (local.set $handled (i32.const 0))
          ;; kind=7 → Execute instruction trace
          (call $host_dx_trace (i32.const 7) (local.get $op) (local.get $sz) (local.get $cnt)
            (i32.sub (local.get $cursor) (local.get $buf)))
          ;; D3DOP_EXIT (11)
          (br_if $done (i32.eq (local.get $op) (i32.const 11)))
          ;; ── Opcode dispatch ──────────────────────────────────────
          ;; 1 = D3DOP_POINT        (4-byte records)
          (if (i32.eq (local.get $op) (i32.const 1)) (then
            (call $d3dim_exec_points (local.get $arg0) (local.get $buf)
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 2 = D3DOP_LINE         (4-byte records)
          (if (i32.eq (local.get $op) (i32.const 2)) (then
            (call $d3dim_exec_lines (local.get $arg0) (local.get $buf)
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 3 = D3DOP_TRIANGLE     (8-byte records)
          (if (i32.eq (local.get $op) (i32.const 3)) (then
            (call $d3dim_exec_triangles (local.get $arg0) (local.get $buf)
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 4 = D3DOP_MATRIXLOAD   (8-byte records)
          (if (i32.eq (local.get $op) (i32.const 4)) (then
            (call $d3dim_exec_matrix_load
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 5 = D3DOP_MATRIXMULTIPLY (12-byte records)
          (if (i32.eq (local.get $op) (i32.const 5)) (then
            (call $d3dim_exec_matrix_multiply
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 6 = D3DOP_STATETRANSFORM  (8-byte D3DSTATE records)
          (if (i32.eq (local.get $op) (i32.const 6)) (then
            (call $d3dim_exec_state_walk (local.get $arg0) (i32.const 6)
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 7 = D3DOP_STATELIGHT   (8-byte D3DSTATE records)
          (if (i32.eq (local.get $op) (i32.const 7)) (then
            (call $d3dim_exec_state_walk (local.get $arg0) (i32.const 7)
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 8 = D3DOP_STATERENDER  (8-byte D3DSTATE records)
          (if (i32.eq (local.get $op) (i32.const 8)) (then
            (call $d3dim_exec_state_walk (local.get $arg0) (i32.const 8)
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 9 = D3DOP_PROCESSVERTICES (16-byte records)
          (if (i32.eq (local.get $op) (i32.const 9)) (then
            (call $d3dim_exec_process_vertices (local.get $arg0) (local.get $arg1) (local.get $buf)
              (i32.add (local.get $cursor) (i32.const 4)) (local.get $cnt))
            (local.set $handled (i32.const 1))))
          ;; 12 = D3DOP_BRANCHFORWARD. Examine each record until one branches.
          (if (i32.eq (local.get $op) (i32.const 12)) (then
            (local.set $record_index (i32.const 0))
            (block $branches_done (loop $branches
              (br_if $branches_done (i32.ge_u (local.get $record_index) (local.get $cnt)))
              (local.set $branch (call $d3dim_exec_branch
                (local.get $arg1)
                (i32.add (i32.add (local.get $cursor) (i32.const 4))
                  (i32.mul (local.get $record_index) (local.get $sz)))
                (local.get $cursor)))
              (if (i32.eqz (local.get $branch))
                (then (br $done)))
              (if (i32.ne (local.get $branch) (i32.const -1))
                (then
                  (local.set $cursor (local.get $branch))
                  (br $lp)))
              (local.set $record_index (i32.add (local.get $record_index) (i32.const 1)))
              (br $branches)))
            (local.set $handled (i32.const 1))))
          ;; 14 = D3DOP_SETSTATUS  (24-byte D3DSTATUS record). Retained-mode
          ;; D3DRM reads the resulting extent through GetExecuteData and skips
          ;; its primary-surface Blt when the driver reports an empty rect.
          (if (i32.eq (local.get $op) (i32.const 14)) (then
            (local.set $record_index (i32.const 0))
            (block $statuses_done (loop $statuses
              (br_if $statuses_done (i32.ge_u (local.get $record_index) (local.get $cnt)))
              (call $d3dim_exec_set_status (local.get $arg1)
                (i32.add (i32.add (local.get $cursor) (i32.const 4))
                  (i32.mul (local.get $record_index) (local.get $sz))))
              (local.set $record_index (i32.add (local.get $record_index) (i32.const 1)))
              (br $statuses)))
            (local.set $handled (i32.const 1))))
          ;; Known-but-unimplemented: 10=TEXTURELOAD, 13=SPAN. Anything else
          ;; is malformed — log + crash so we can see what hit us.
          (if (i32.eqz (local.get $handled))
            (then
              (call $host_dx_trace (i32.const 9) (local.get $op) (local.get $sz)
                (local.get $cnt) (i32.sub (local.get $cursor) (local.get $buf)))
              (call $crash_unimplemented (global.get $D3DIM_UNIMPL_EXEC_OP))))
          (local.set $step (i32.add (i32.const 4) (i32.mul (local.get $sz) (local.get $cnt))))
          ;; Guard against zero/huge step to avoid infinite loops.
          (br_if $done (i32.eqz (local.get $step)))
          (local.set $cursor (i32.add (local.get $cursor) (local.get $step)))
          (br $lp)))))
      ;; End collection before presentation can reenter the host.
      (global.set $d3dim_exec_extent_guest (local.get $saved_extent))
      (global.set $d3dim_exec_extent_rt (local.get $saved_extent_rt))
      ;; After Execute returns, apps expect the back buffer to be updated.
      ;; Present immediately if the RT is the primary (same rule as EndScene).
      (call $d3dim_end_scene (local.get $arg0))))
    (global.set $d3dim_exec_extent_guest (local.get $saved_extent))
    (global.set $d3dim_exec_extent_rt (local.get $saved_extent_rt))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirect3DDevice_AddViewport — 2 args (incl. this)
  (func $handle_IDirect3DDevice_AddViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice2_AddViewport
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; IDirect3DDevice_DeleteViewport — 2 args (incl. this)
  (func $handle_IDirect3DDevice_DeleteViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice2_DeleteViewport
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; IDirect3DDevice_NextViewport — 4 args (incl. this)
  (func $handle_IDirect3DDevice_NextViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice2_NextViewport
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; Test a screen-space point against one transformed execute-buffer
  ;; triangle.  D3DRM calls Pick after PROCESSVERTICES has produced TL
  ;; vertices, so this is the same geometry the rasterizer consumes.
  ;; Vertex addresses and the Pick instruction cursor are guest-relative.
  (func $d3dim_pick_tl_triangle_guest
    (param $px f32) (param $py f32)
    (param $v0 i32) (param $v1 i32) (param $v2 i32) (result i32)
    (local $x0 f32) (local $y0 f32) (local $x1 f32) (local $y1 f32)
    (local $x2 f32) (local $y2 f32)
    (local $e0 f32) (local $e1 f32) (local $e2 f32)
    (local $den f32) (local $w0 f32) (local $w1 f32) (local $w2 f32)
    (local.set $x0 (f32.reinterpret_i32 (call $gl32 (local.get $v0))))
    (local.set $y0 (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v0) (i32.const 4)))))
    (local.set $x1 (f32.reinterpret_i32 (call $gl32 (local.get $v1))))
    (local.set $y1 (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v1) (i32.const 4)))))
    (local.set $x2 (f32.reinterpret_i32 (call $gl32 (local.get $v2))))
    (local.set $y2 (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v2) (i32.const 4)))))
    (local.set $e0
      (f32.sub
        (f32.mul (f32.sub (local.get $x1) (local.get $x0))
          (f32.sub (local.get $py) (local.get $y0)))
        (f32.mul (f32.sub (local.get $y1) (local.get $y0))
          (f32.sub (local.get $px) (local.get $x0)))))
    (local.set $e1
      (f32.sub
        (f32.mul (f32.sub (local.get $x2) (local.get $x1))
          (f32.sub (local.get $py) (local.get $y1)))
        (f32.mul (f32.sub (local.get $y2) (local.get $y1))
          (f32.sub (local.get $px) (local.get $x1)))))
    (local.set $e2
      (f32.sub
        (f32.mul (f32.sub (local.get $x0) (local.get $x2))
          (f32.sub (local.get $py) (local.get $y2)))
        (f32.mul (f32.sub (local.get $y0) (local.get $y2))
          (f32.sub (local.get $px) (local.get $x2)))))
    (if (i32.eqz
          (i32.or
            (i32.and
              (i32.and (f32.ge (local.get $e0) (f32.const 0.0))
                       (f32.ge (local.get $e1) (f32.const 0.0)))
              (f32.ge (local.get $e2) (f32.const 0.0)))
            (i32.and
              (i32.and (f32.le (local.get $e0) (f32.const 0.0))
                       (f32.le (local.get $e1) (f32.const 0.0)))
              (f32.le (local.get $e2) (f32.const 0.0)))))
      (then (return (i32.const 0))))
    ;; Barycentric depth is what D3DRM uses to choose the frontmost visual.
    (local.set $den
      (f32.add
        (f32.mul (f32.sub (local.get $y1) (local.get $y2))
          (f32.sub (local.get $x0) (local.get $x2)))
        (f32.mul (f32.sub (local.get $x2) (local.get $x1))
          (f32.sub (local.get $y0) (local.get $y2)))))
    (if (f32.eq (local.get $den) (f32.const 0.0))
      (then (return (i32.const 0))))
    (local.set $w0
      (f32.div
        (f32.add
          (f32.mul (f32.sub (local.get $y1) (local.get $y2))
            (f32.sub (local.get $px) (local.get $x2)))
          (f32.mul (f32.sub (local.get $x2) (local.get $x1))
            (f32.sub (local.get $py) (local.get $y2))))
        (local.get $den)))
    (local.set $w1
      (f32.div
        (f32.add
          (f32.mul (f32.sub (local.get $y2) (local.get $y0))
            (f32.sub (local.get $px) (local.get $x2)))
          (f32.mul (f32.sub (local.get $x0) (local.get $x2))
            (f32.sub (local.get $py) (local.get $y2))))
        (local.get $den)))
    (local.set $w2 (f32.sub (f32.const 1.0) (f32.add (local.get $w0) (local.get $w1))))
    (global.set $D3DIM_PICK_Z
      (f32.add
        (f32.add
          (f32.mul (local.get $w0) (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v0) (i32.const 8)))))
          (f32.mul (local.get $w1) (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v1) (i32.const 8))))))
        (f32.mul (local.get $w2) (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v2) (i32.const 8)))))))
    (i32.const 1))

  ;; IDirect3DDevice_Pick — 5 args (incl. this)
  (func $handle_IDirect3DDevice_Pick (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $buf i32) (local $vert_off i32)
    (local $instr_off i32) (local $instr_len i32) (local $base i32)
    (local $cursor i32) (local $end i32) (local $op i32) (local $sz i32)
    (local $cnt i32) (local $step i32) (local $i i32) (local $rec i32)
    (local $vbase i32) (local $v0 i32) (local $v1 i32) (local $v2 i32)
    (local $px f32) (local $py f32)
    (global.set $D3DIM_PICK_COUNT (i32.const 0))
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0))
                 (i32.ne (local.get $arg4) (i32.const 0))) (then
      (local.set $entry (call $dx_from_this (local.get $arg1)))
      (if (local.get $entry) (then
        (local.set $buf (load.field DxObject misc0 (local.get $entry)))
        (local.set $vert_off (i32.load (i32.add (local.get $entry) (i32.const 16))))
        (local.set $instr_off (load.field DxObject misc2 (local.get $entry)))
        (local.set $instr_len (load.field DxObject flags (local.get $entry)))
        (if (i32.and (i32.ne (local.get $buf) (i32.const 0))
                     (i32.ne (local.get $instr_len) (i32.const 0))) (then
          (local.set $vbase (i32.add (local.get $buf) (local.get $vert_off)))
          (local.set $base (i32.add (local.get $buf) (local.get $instr_off)))
          (local.set $cursor (local.get $base))
          (local.set $end (i32.add (local.get $cursor) (local.get $instr_len)))
          (local.set $px (f32.convert_i32_s (call $gl32 (local.get $arg4))))
          (local.set $py (f32.convert_i32_s (call $gl32 (i32.add (local.get $arg4) (i32.const 4)))))
          (block $done (loop $lp
            (br_if $done (i32.gt_u (i32.add (local.get $cursor) (i32.const 4)) (local.get $end)))
            (local.set $op (call $gl8 (local.get $cursor)))
            (local.set $sz (call $gl8 (i32.add (local.get $cursor) (i32.const 1))))
            (local.set $cnt (call $gl16 (i32.add (local.get $cursor) (i32.const 2))))
            (local.set $rec (i32.add (local.get $cursor) (i32.const 4)))
            (if (i32.eq (local.get $op) (i32.const 3)) (then
              (local.set $i (i32.const 0))
              (block $tris (loop $tri
                (br_if $tris (i32.ge_u (local.get $i) (local.get $cnt)))
                (local.set $v0 (i32.add (local.get $vbase)
                  (i32.mul (call $gl16 (local.get $rec)) (i32.const 32))))
                (local.set $v1 (i32.add (local.get $vbase)
                  (i32.mul (call $gl16 (i32.add (local.get $rec) (i32.const 2))) (i32.const 32))))
                (local.set $v2 (i32.add (local.get $vbase)
                  (i32.mul (call $gl16 (i32.add (local.get $rec) (i32.const 4))) (i32.const 32))))
                (if (call $d3dim_pick_tl_triangle_guest
                      (local.get $px) (local.get $py)
                      (local.get $v0) (local.get $v1) (local.get $v2))
                  (then
                    (global.set $D3DIM_PICK_COUNT (i32.const 1))
                    (global.set $D3DIM_PICK_OPCODE (local.get $op))
                    (global.set $D3DIM_PICK_OFFSET (i32.sub (local.get $rec) (local.get $base)))
                    (br $done)))
                (local.set $rec (i32.add (local.get $rec) (local.get $sz)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $tri)))))
            (local.set $step (i32.add (i32.const 4) (i32.mul (local.get $sz) (local.get $cnt))))
            (br_if $done (i32.eqz (local.get $step)))
            (local.set $cursor (i32.add (local.get $cursor) (local.get $step)))
            (br $lp)))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; IDirect3DDevice_GetPickRecords — 3 args (incl. this)
  (func $handle_IDirect3DDevice_GetPickRecords (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then
      (call $gs32 (local.get $arg1) (global.get $D3DIM_PICK_COUNT))
      (if (i32.and (i32.ne (local.get $arg2) (i32.const 0))
                   (i32.ne (global.get $D3DIM_PICK_COUNT) (i32.const 0))) (then
        ;; D3DPICKRECORD is {u8 opcode, u8 pad, 2 alignment bytes,
        ;; u32 instruction offset, float z}.
        (call $gs8 (local.get $arg2) (global.get $D3DIM_PICK_OPCODE))
        (call $gs8 (i32.add (local.get $arg2) (i32.const 1)) (i32.const 0))
        (call $gs32 (i32.add (local.get $arg2) (i32.const 4)) (global.get $D3DIM_PICK_OFFSET))
        (call $gs32 (i32.add (local.get $arg2) (i32.const 8))
          (i32.reinterpret_f32 (global.get $D3DIM_PICK_Z)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  ;; IDirect3DDevice_CreateMatrix(this, lpHandle) — 2 args (incl. this)
  ;; Linear scan for a free entry in D3DIM_MATRIX_USED, write slot+1 to
  ;; *lpHandle, mark it occupied independently of its contents, and initialize
  ;; the matrix with the 4x4 identity. Keeping ownership separate is required
  ;; because SetMatrix may legitimately replace the identity with all zeroes.
  (func $handle_IDirect3DDevice_CreateMatrix (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $slot_wa i32) (local $found i32)
    (if (i32.eqz (local.get $arg1)) (then (call $crash_unimplemented (local.get $name_ptr))))
    (local.set $i (i32.const 0))
    (local.set $found (i32.const -1))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (global.get $D3DIM_MATRIX_MAX)))
      (if (i32.eqz (i32.load8_u (i32.add (global.get $D3DIM_MATRIX_USED) (local.get $i))))
        (then (local.set $found (local.get $i)) (br $done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (if (i32.lt_s (local.get $found) (i32.const 0))
      (then
        ;; D3DERR_MATRIX_CREATE_FAILED = 0x887602F0
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x887602F0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $slot_wa
      (i32.add (global.get $D3DIM_MATRICES) (i32.mul (local.get $found) (i32.const 64))))
    (i32.store8 (i32.add (global.get $D3DIM_MATRIX_USED) (local.get $found)) (i32.const 1))
    ;; Identity: m00=m11=m22=m33=1.0 (0x3F800000), rest 0.
    (call $zero_memory (local.get $slot_wa) (i32.const 64))
    (f32.store (i32.add (local.get $slot_wa) (i32.const 0))  (f32.const 1.0))
    (f32.store (i32.add (local.get $slot_wa) (i32.const 20)) (f32.const 1.0))
    (f32.store (i32.add (local.get $slot_wa) (i32.const 40)) (f32.const 1.0))
    (f32.store (i32.add (local.get $slot_wa) (i32.const 60)) (f32.const 1.0))
    (call $gs32 (local.get $arg1) (i32.add (local.get $found) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice_SetMatrix(this, handle, lpMatrix) — 3 args (incl. this)
  (func $handle_IDirect3DDevice_SetMatrix (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $matrix_wa i32)
    (if (i32.or (i32.eqz (local.get $arg2))
                (i32.or (i32.lt_u (local.get $arg1) (i32.const 1))
                        (i32.gt_u (local.get $arg1) (global.get $D3DIM_MATRIX_MAX))))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (local.set $matrix_wa (call $g2w (local.get $arg2)))
    ;; Matrix dump goes through the dx trace channel, which is silent unless
    ;; --trace-dx is on. As seventeen bare $host_log_i32 calls it cost every
    ;; D3DIM app 17 console writes per SetMatrix -- scr_oasaver sets 16269
    ;; matrices in a single run, i.e. 276k lines of output nobody asked for.
    (call $host_dx_trace (i32.const 20) (local.get $arg1)
      (local.get $matrix_wa) (i32.const 0) (i32.const 0))
    (call $memcpy
      (i32.add (global.get $D3DIM_MATRICES)
               (i32.mul (i32.sub (local.get $arg1) (i32.const 1)) (i32.const 64)))
      (local.get $matrix_wa)
      (i32.const 64))
    (call $d3dim_refresh_bound_matrix (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice_GetMatrix(this, handle, lpOut) — 3 args (incl. this)
  (func $handle_IDirect3DDevice_GetMatrix (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (local.get $arg2))
                (i32.or (i32.lt_u (local.get $arg1) (i32.const 1))
                        (i32.gt_u (local.get $arg1) (global.get $D3DIM_MATRIX_MAX))))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (call $memcpy
      (call $g2w (local.get $arg2))
      (i32.add (global.get $D3DIM_MATRICES)
               (i32.mul (i32.sub (local.get $arg1) (i32.const 1)) (i32.const 64)))
      (i32.const 64))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice_DeleteMatrix(this, handle) — 2 args (incl. this)
  (func $handle_IDirect3DDevice_DeleteMatrix (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.lt_u (local.get $arg1) (i32.const 1))
                (i32.gt_u (local.get $arg1) (global.get $D3DIM_MATRIX_MAX)))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (call $zero_memory
      (i32.add (global.get $D3DIM_MATRICES)
               (i32.mul (i32.sub (local.get $arg1) (i32.const 1)) (i32.const 64)))
      (i32.const 64))
    (i32.store8
      (i32.add (global.get $D3DIM_MATRIX_USED) (i32.sub (local.get $arg1) (i32.const 1)))
      (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice_BeginScene — 1 args (incl. this)
  (func $handle_IDirect3DDevice_BeginScene (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_begin_scene (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice_EndScene — 1 args (incl. this)
  (func $handle_IDirect3DDevice_EndScene (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_end_scene (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice_GetDirect3D — 2 args (incl. this)
  (func $handle_IDirect3DDevice_GetDirect3D (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_direct3d (local.get $arg0) (local.get $arg1) (global.get $DX_VTBL_D3D))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))


  ;; ── IDirect3DDevice2 — 33 methods ─────────────
  ;; IDirect3DDevice2_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 2) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_Release — 1 args (incl. this)
  (func $handle_IDirect3DDevice2_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; All QI revisions share one type-20 device and attachment lifetime.
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_release (local.get $arg0)))




    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice2_GetCaps — 3 args (incl. this): (this, lpHWDesc, lpHELDesc)
  (func $handle_IDirect3DDevice2_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_fill_device_desc (local.get $arg1))
    (call $d3dim_fill_device_desc (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_SwapTextureHandles — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_SwapTextureHandles (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_GetStats — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_GetStats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_get_stats (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice2_AddViewport — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_AddViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice3_AddViewport
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; IDirect3DDevice2_DeleteViewport — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_DeleteViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice3_DeleteViewport
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; IDirect3DDevice2_NextViewport — 4 args (incl. this)
  (func $handle_IDirect3DDevice2_NextViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice3_NextViewport
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; IDirect3DDevice2_EnumTextureFormats — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_EnumTextureFormats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    ;; Direct3D 2 retains the legacy callback contract: lpD3DTextureFormat is
    ;; a DDSURFACEDESC whose DDPIXELFORMAT begins at +72.  The pixel-format-only
    ;; callback was introduced by Device3/7.  MCM copies from +72 and therefore
    ;; recorded heap garbage when Device2 was incorrectly given 32 bytes.
    (call $d3d_enum_tex_desc_invoke (local.get $arg1) (local.get $arg2) (local.get $ret_addr)))

  ;; IDirect3DDevice2_BeginScene — 1 args (incl. this)
  (func $handle_IDirect3DDevice2_BeginScene (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_begin_scene (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice2_EndScene — 1 args (incl. this)
  (func $handle_IDirect3DDevice2_EndScene (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_end_scene (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice2_GetDirect3D — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_GetDirect3D (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_direct3d (local.get $arg0) (local.get $arg1) (global.get $DX_VTBL_D3D2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice2_SetCurrentViewport — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_SetCurrentViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice3_SetCurrentViewport
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; IDirect3DDevice2_GetCurrentViewport — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_GetCurrentViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_current_viewport (local.get $arg0) (local.get $arg1) (global.get $DX_VTBL_D3DVP2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice2_SetRenderTarget — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_SetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_render_target (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_GetRenderTarget — 2 args (incl. this)
  ;; Writes the bound render-target surface ptr to *arg1 and AddRefs it.
  ;; rt_slot is stashed at entry+8 by d3dim_create_device.
  (func $handle_IDirect3DDevice2_GetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_render_target (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice2_Begin — 4 args (incl. this)
  ;; The v2 half of the unimplemented immediate-mode family; see the comment on
  ;; $handle_IDirect3DDevice3_Begin for why these trap instead of returning
  ;; S_OK and dropping the vertices on the floor.
  (func $handle_IDirect3DDevice2_Begin (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; IDirect3DDevice2_BeginIndexed — 6 args (incl. this)
  (func $handle_IDirect3DDevice2_BeginIndexed (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; IDirect3DDevice2_Vertex — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_Vertex (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; IDirect3DDevice2_Index — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_Index (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; IDirect3DDevice2_End — 2 args (incl. this)
  (func $handle_IDirect3DDevice2_End (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; IDirect3DDevice2_GetRenderState — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_GetRenderState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_render_state (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_SetRenderState — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_SetRenderState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_render_state (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_GetLightState — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_GetLightState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_light_state (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_SetLightState — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_SetLightState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_light_state (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_SetTransform — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_SetTransform (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_transform (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_GetTransform — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_GetTransform (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_transform (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_MultiplyTransform — 3 args (incl. this)
  (func $handle_IDirect3DDevice2_MultiplyTransform (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_multiply_transform (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice2_DrawPrimitive — 6 args (incl. this)
  ;; args: this, d3dptPrimitiveType, d3dvtVertexType, lpvVertices, dwVertexCount, dwFlags
  ;; Phase 1: for D3DVT_TLVERTEX (pre-transformed+lit) vertices, plot each vertex
  ;; as a 2x2 dot in its own color into the device's render target. Not a real
  ;; triangle rasterizer yet — the goal is to validate the transform and
  ;; presentation pipelines end-to-end. TLVERTEX layout (32 bytes):
  ;;   +0 sx, +4 sy, +8 sz, +12 rhw, +16 color (D3DCOLOR 0xAARRGGBB),
  ;;   +20 specular, +24 tu, +28 tv
  ;; Untransformed (D3DVT_VERTEX/LVERTEX) is ignored for now — rasterizer will
  ;; handle those once the WVP pipeline and triangle fill land.
  (func $handle_IDirect3DDevice2_DrawPrimitive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dwVertexCount i32)
    (local.set $dwVertexCount (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
    ;; kind=10 DP2: primType, vtxType, vtxCount, lpvVertices
    (call $host_dx_trace (i32.const 10) (local.get $arg1) (local.get $arg2)
      (local.get $dwVertexCount) (local.get $arg3))
    (call $d3dim_draw_primitive (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $dwVertexCount))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; IDirect3DDevice2_DrawIndexedPrimitive — 8 args (incl. this)
  (func $handle_IDirect3DDevice2_DrawIndexedPrimitive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dwVertexCount i32) (local $lpwIndices i32) (local $dwIndexCount i32)
    (local.set $dwVertexCount (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
    (local.set $lpwIndices    (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $dwIndexCount  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (call $d3dim_draw_indexed_primitive
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $dwVertexCount)
      (local.get $lpwIndices) (local.get $dwIndexCount))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; D3DCLIPSTATUS round-trip: Set stores 24 bytes (dwFlags, dwStatus, 4 floats)
  ;; in the per-device state block. Get reads it back. Not consumed by the rasterizer today
  ;; but removes a silent data drop so that apps polling Get-after-Set see the
  ;; value they stored.
  (func $handle_IDirect3DDevice2_SetClipStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_clip_status (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice2_GetClipStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_clip_status (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))


  ;; ── IDirect3DDevice7 — 49 methods ─────────────
  ;; IDirect3DDevice7_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 2) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_Release — 1 args (incl. this)
  (func $handle_IDirect3DDevice7_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Device7 can be the last QI reference to the same legacy device object.
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_release (local.get $arg0)))




    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice7_GetCaps — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_fill_device_desc7 (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))


  ;; IDirect3DDevice7_BeginScene — 1 args (incl. this)
  (func $handle_IDirect3DDevice7_BeginScene (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_begin_scene (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice7_EndScene — 1 args (incl. this)
  (func $handle_IDirect3DDevice7_EndScene (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_end_scene (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice7_GetDirect3D — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_GetDirect3D (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_direct3d (local.get $arg0) (local.get $arg1) (global.get $DX_VTBL_D3D7))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_SetRenderTarget — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_SetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_render_target (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_GetRenderTarget — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_GetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_render_target (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_Clear — 7 args (incl. this)
  (func $handle_IDirect3DDevice7_Clear (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dvZ_bits i32)
    ;; Stack: ret,this,count,rects,flags,color,dvZ,stencil.
    (local.set $dvZ_bits (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (call $d3dim_device7_clear
      (local.get $arg0) (local.get $arg3) (local.get $arg4)
      (f32.reinterpret_i32 (local.get $dvZ_bits)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; IDirect3DDevice7_GetTransform — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_GetTransform (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_transform (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_SetViewport — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_SetViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_set_viewport (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_MultiplyTransform — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_MultiplyTransform (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_multiply_transform (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_GetViewport — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_GetViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_get_viewport (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_SetMaterial — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_SetMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_set_material (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_GetMaterial — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_GetMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_get_material (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_SetLight — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_SetLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_set_light (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_GetLight — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_GetLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_get_light (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_BeginStateBlock — 1 args (incl. this)
  (func $handle_IDirect3DDevice7_BeginStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $d3dim_stateblock_record_dev (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice7_EndStateBlock — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_EndStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32) (local $dev_this i32)
    (local.set $dev_this (global.get $d3dim_stateblock_record_dev))
    (if (i32.eqz (local.get $dev_this)) (then (local.set $dev_this (local.get $arg0))))
    (local.set $handle (call $d3dim_stateblock_create (local.get $dev_this)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (local.get $handle))))
    (global.set $d3dim_stateblock_record_dev (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_PreLoad — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_PreLoad (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7::DrawPrimitive(primType, fvf, lpvVerts, dwVtxCount, dwFlags)
  ;; DX7 replaces the explicit vtxType enum with an FVF bitfield. Pack FVF
  ;; records into the 32-byte legacy layouts consumed by the shared renderer.
  (func $handle_IDirect3DDevice7_DrawPrimitive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dwVertexCount i32) (local $vtxType i32) (local $packed i32)
    (local.set $dwVertexCount (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
    (local.set $vtxType (call $d3dim_fvf_vtxtype (local.get $arg2)))
    (local.set $packed (call $d3dim_pack_fvf_vertices
      (local.get $arg2) (local.get $arg3) (local.get $dwVertexCount)
      (call $d3dim_texcoord_index (local.get $arg0))))
    (local.set $vtxType (call $d3dim_d7_light_vertices (local.get $arg0) (local.get $arg2)
      (local.get $arg3) (local.get $packed) (local.get $dwVertexCount) (local.get $vtxType)))
    (if (local.get $packed) (then
      (call $d3dim_draw_primitive (local.get $arg0) (local.get $arg1) (local.get $vtxType)
        (local.get $packed) (local.get $dwVertexCount))
      (call $heap_free (local.get $packed))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    ;; 6 dwords with `this` (primType, fvf, lpvVerts, dwVtxCount, dwFlags), so
    ;; 28 -- the same arity the hand-written Device3 twin above already pops.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; IDirect3DDevice7_DrawIndexedPrimitive — 7 args (incl. this)
  (func $handle_IDirect3DDevice7_DrawIndexedPrimitive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dwVertexCount i32) (local $lpwIndices i32) (local $dwIndexCount i32) (local $vtxType i32) (local $packed i32)
    (local.set $dwVertexCount (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
    (local.set $lpwIndices    (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $dwIndexCount  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (local.set $vtxType (call $d3dim_fvf_vtxtype (local.get $arg2)))
    (local.set $packed (call $d3dim_pack_fvf_vertices
      (local.get $arg2) (local.get $arg3) (local.get $dwVertexCount)
      (call $d3dim_texcoord_index (local.get $arg0))))
    (local.set $vtxType (call $d3dim_d7_light_vertices (local.get $arg0) (local.get $arg2)
      (local.get $arg3) (local.get $packed) (local.get $dwVertexCount) (local.get $vtxType)))
    (if (local.get $packed) (then
      (call $d3dim_draw_indexed_primitive
        (local.get $arg0) (local.get $arg1) (local.get $vtxType)
        (local.get $packed) (local.get $dwVertexCount)
        (local.get $lpwIndices) (local.get $dwIndexCount))
      (call $heap_free (local.get $packed))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    ;; 8 dwords with `this` (…, lpwIndices, dwIndexCount, dwFlags), so 36 --
    ;; matching the Device3 twin, and matching this handler's own reads, which
    ;; already go out to esp+28 for the seventh argument.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; IDirect3DDevice7_SetClipStatus — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_SetClipStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_clip_status (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_GetClipStatus — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_GetClipStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_clip_status (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_DrawPrimitiveStrided — 6 args (incl. this)
  (func $handle_IDirect3DDevice7_DrawPrimitiveStrided (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_draw_primitive_strided
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; IDirect3DDevice7_DrawIndexedPrimitiveStrided — 8 args (incl. this)
  (func $handle_IDirect3DDevice7_DrawIndexedPrimitiveStrided (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Sixth and seventh arguments (lpwIndices, dwIndexCount) are esp+24 and
    ;; esp+28; esp+20 is $arg4, already passed above. The pop here was always
    ;; 36, so only the reads were short.
    (call $d3dim_draw_indexed_primitive_strided
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; IDirect3DDevice7_DrawPrimitiveVB — 6 args (incl. this)
  (func $handle_IDirect3DDevice7_DrawPrimitiveVB (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_vb_draw_primitive
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; IDirect3DDevice7_DrawIndexedPrimitiveVB — 8 args (incl. this)
  ;; (primType, lpVB, dwStartVertex, dwNumVertices, lpwIndices, dwIndexCount,
  ;; dwFlags). $arg0..$arg4 are esp+4..esp+20, so the sixth and seventh
  ;; arguments are esp+24 and esp+28 -- reading esp+20 handed the core a copy
  ;; of $arg4 (dwNumVertices) where it wanted lpwIndices, and dropped
  ;; dwIndexCount entirely.
  (func $handle_IDirect3DDevice7_DrawIndexedPrimitiveVB (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_vb_draw_indexed_primitive
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; IDirect3DDevice7_ComputeSphereVisibility — 6 args (incl. this)
  (func $handle_IDirect3DDevice7_ComputeSphereVisibility (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; The v3 and v7 signatures, stack cleanup, result flags, and HRESULT are
    ;; identical. Keep one implementation so fixes cannot drift by revision.
    (call $handle_IDirect3DDevice3_ComputeSphereVisibility
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DDevice7_GetTexture — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_GetTexture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_texture (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_SetTexture — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_SetTexture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_texture (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_ApplyStateBlock — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_ApplyStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_stateblock_apply (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_CaptureStateBlock — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_CaptureStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_stateblock_capture (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_DeleteStateBlock — 2 args (incl. this)
  (func $handle_IDirect3DDevice7_DeleteStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_stateblock_delete (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DDevice7_CreateStateBlock — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_CreateStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $d3dim_stateblock_create (local.get $arg0)))
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (local.get $handle))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_Load(this, lpDestTex, lpDestPoint, lpSrcTex, lprcSrcRect,
  ;; dwFlags) — 6 args (incl. this). Popping a seventh shifted the caller's ESP
  ;; by 4, so Deus Ex's D3DDrv restored a garbage EBX after its SetTexture.
  (func $handle_IDirect3DDevice7_Load (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32)
    (if (i32.or (i32.ne (local.get $arg2) (i32.const 0))
                (i32.ne (local.get $arg4) (i32.const 0)))
      (then
        (local.set $hr (call $d3dim_device7_load_rect
          (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4))))
      (else (call $d3dim_device7_load_chain (local.get $arg1) (local.get $arg3))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; Rectangular uploads use coordinates at source level zero. Match each
  ;; destination level to the source, halve origins and round far edges up.
  ;; Validate the complete chain before publishing any pixels.
  ;; Reference: wine-mirror/wine dlls/ddraw/device.c, copy_mipmap_chain.
  (func $d3dim_device7_load_rect
      (param $dst_this i32) (param $point i32) (param $src_this i32) (param $rect i32) (result i32)
    (local $dst i32) (local $src i32) (local $pass i32) (local $level i32)
    (local $x i32) (local $y i32) (local $l i32) (local $t i32) (local $r i32) (local $b i32)
    (local $sw i32) (local $sh i32) (local $dw i32) (local $dh i32)
    (local $xx i32) (local $yy i32) (local $dbpp i32) (local $sbpp i32)
    (local $dbits i32) (local $sbits i32) (local $dp i32) (local $sp i32)
    (local $same i32) (local $bytes i32)
    (local $key i32) (local $dst_pal i32) (local $src_pal i32)
    (loop $passes
      (local.set $dst (call $ddraw_surface_entry_checked (local.get $dst_this)))
      (local.set $src (call $ddraw_surface_entry_checked (local.get $src_this)))
      (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src)))
        (then (return (i32.const 0x80070057))))
      (local.set $x (i32.const 0)) (local.set $y (i32.const 0))
      (if (local.get $point) (then
        (local.set $x (call $gl32 (local.get $point)))
        (local.set $y (call $gl32 (i32.add (local.get $point) (i32.const 4))))))
      (local.set $l (i32.const 0)) (local.set $t (i32.const 0))
      (local.set $r (load.field DxObject width (local.get $src)))
      (local.set $b (load.field DxObject height (local.get $src)))
      (if (local.get $rect) (then
        (local.set $l (call $gl32 (local.get $rect)))
        (local.set $t (call $gl32 (i32.add (local.get $rect) (i32.const 4))))
        (local.set $r (call $gl32 (i32.add (local.get $rect) (i32.const 8))))
        (local.set $b (call $gl32 (i32.add (local.get $rect) (i32.const 12))))))
      (local.set $level (i32.const 0))
      (block $done (loop $levels
        (br_if $done (i32.eqz (local.get $dst)))
        (if (i32.or (i32.eqz (local.get $src)) (i32.gt_u (local.get $level) (i32.const 20)))
          (then (return (i32.const 0x80070057))))
        (local.set $sw (load.field DxObject width (local.get $src)))
        (local.set $sh (load.field DxObject height (local.get $src)))
        (local.set $dw (load.field DxObject width (local.get $dst)))
        (local.set $dh (load.field DxObject height (local.get $dst)))
        (if (i32.lt_s (local.get $l) (i32.const 0)) (then (return (i32.const 0x80070057))))
        (if (i32.lt_s (local.get $t) (i32.const 0)) (then (return (i32.const 0x80070057))))
        (if (i32.lt_s (local.get $x) (i32.const 0)) (then (return (i32.const 0x80070057))))
        (if (i32.lt_s (local.get $y) (i32.const 0)) (then (return (i32.const 0x80070057))))
        (if (i32.le_s (local.get $r) (local.get $l)) (then (return (i32.const 0x80070057))))
        (if (i32.le_s (local.get $b) (local.get $t)) (then (return (i32.const 0x80070057))))
        (if (i32.gt_u (local.get $r) (local.get $sw)) (then (return (i32.const 0x80070057))))
        (if (i32.gt_u (local.get $b) (local.get $sh)) (then (return (i32.const 0x80070057))))
        (if (i32.gt_u (local.get $dw) (local.get $sw)) (then (return (i32.const 0x80070057))))
        (if (i32.gt_u (local.get $dh) (local.get $sh)) (then (return (i32.const 0x80070057))))
        (if (i32.gt_u (local.get $x) (i32.sub (local.get $sw) (i32.sub (local.get $r) (local.get $l)))) (then (return (i32.const 0x80070057))))
        (if (i32.gt_u (local.get $y) (i32.sub (local.get $sh) (i32.sub (local.get $b) (local.get $t)))) (then (return (i32.const 0x80070057))))
        (if (i32.and (i32.eq (local.get $dw) (local.get $sw)) (i32.eq (local.get $dh) (local.get $sh)))
          (then
            (local.set $dbpp (load.field DxObject bpp (local.get $dst)))
            (local.set $sbpp (load.field DxObject bpp (local.get $src)))
            (local.set $same (i32.and (i32.eq (local.get $dbpp) (local.get $sbpp))
              (i32.eq (call $dx_surf_fmt_get (local.get $dst)) (call $dx_surf_fmt_get (local.get $src)))))
            (if (i32.or (i32.lt_u (local.get $dbpp) (i32.const 8))
                        (i32.lt_u (local.get $sbpp) (i32.const 8)))
              (then (return (i32.const 0x80004001))))
            (if (i32.and (i32.eqz (local.get $same)) (i32.eq (local.get $dbpp) (i32.const 8)))
              (then (return (i32.const 0x80004001))))
            (if (local.get $pass) (then
              (call $d3dim_surface_fence (local.get $src))
              (call $d3dim_surface_fence (local.get $dst))
              (local.set $src_pal (call $dx_surf_pal_get (local.get $src)))
              (local.set $dst_pal (call $dx_surf_pal_get (local.get $dst)))
              (if (i32.and (i32.ne (local.get $src_pal) (i32.const 0))
                           (i32.ne (local.get $dst_pal) (i32.const 0)))
                (then (call $memcpy (local.get $dst_pal) (local.get $src_pal) (i32.const 1024))))
              (if (i32.and (load.field DxObject flags (local.get $src)) (i32.const 0x100))
                (then
                  (local.set $key (load.field DxObject misc2 (local.get $src)))
                  (if (i32.eqz (local.get $same))
                    (then (local.set $key (call $d3dim_encode_surface_pixel (local.get $dst)
                      (call $d3dim_decode_surface_pixel (local.get $src) (local.get $key) (local.get $sbpp))
                      (local.get $dbpp)))))
                  (store.field DxObject misc2 (local.get $dst) (local.get $key))
                  (store.field DxObject flags (local.get $dst)
                    (i32.or (load.field DxObject flags (local.get $dst)) (i32.const 0x100)))))
              (local.set $dbits (load.field DxObject misc1 (local.get $dst)))
              (local.set $sbits (load.field DxObject misc1 (local.get $src)))
              (local.set $dp (load.field DxObject pitch (local.get $dst)))
              (local.set $sp (load.field DxObject pitch (local.get $src)))
              (local.set $bytes (i32.shr_u (local.get $dbpp) (i32.const 3)))
              (local.set $yy (i32.const 0))
              (block $rows_done (loop $rows
                (br_if $rows_done (i32.ge_u (local.get $yy) (i32.sub (local.get $b) (local.get $t))))
                (if (local.get $same)
                  (then (call $memcpy
                    (i32.add (local.get $dbits) (i32.add (i32.mul (i32.add (local.get $y) (local.get $yy)) (local.get $dp)) (i32.mul (local.get $x) (local.get $bytes))))
                    (i32.add (local.get $sbits) (i32.add (i32.mul (i32.add (local.get $t) (local.get $yy)) (local.get $sp)) (i32.mul (local.get $l) (local.get $bytes))))
                    (i32.mul (i32.sub (local.get $r) (local.get $l)) (local.get $bytes))))
                  (else
                    (local.set $xx (i32.const 0))
                    (block $cols_done (loop $cols
                      (br_if $cols_done (i32.ge_u (local.get $xx) (i32.sub (local.get $r) (local.get $l))))
                      (call $d3dim_surf_put_texel (local.get $dst) (local.get $dbits) (local.get $dbpp) (local.get $dp)
                        (i32.add (local.get $x) (local.get $xx)) (i32.add (local.get $y) (local.get $yy))
                        (call $d3dim_surf_texel_rgb (local.get $src) (local.get $sbits) (local.get $sbpp) (local.get $sp)
                          (i32.add (local.get $l) (local.get $xx)) (i32.add (local.get $t) (local.get $yy))))
                      (local.set $xx (i32.add (local.get $xx) (i32.const 1)))
                      (br $cols)))))
                (local.set $yy (i32.add (local.get $yy) (i32.const 1))) (br $rows)))
              (call $dx_surf_note_write (local.get $dst))))
            (local.set $dst (call $ddraw_surface_entry_checked (load.field DxObject misc0 (local.get $dst))))))
        (local.set $src (call $ddraw_surface_entry_checked (load.field DxObject misc0 (local.get $src))))
        (local.set $x (i32.shr_u (local.get $x) (i32.const 1)))
        (local.set $y (i32.shr_u (local.get $y) (i32.const 1)))
        (local.set $l (i32.shr_u (local.get $l) (i32.const 1)))
        (local.set $t (i32.shr_u (local.get $t) (i32.const 1)))
        (local.set $r (i32.shr_u (i32.add (local.get $r) (i32.const 1)) (i32.const 1)))
        (local.set $b (i32.shr_u (i32.add (local.get $b) (i32.const 1)) (i32.const 1)))
        (local.set $level (i32.add (local.get $level) (i32.const 1))) (br $levels)))
      (local.set $pass (i32.add (local.get $pass) (i32.const 1)))
      (br_if $passes (i32.lt_u (local.get $pass) (i32.const 2))))
    (i32.const 0))

  ;; Copy every level of a source mip chain into the destination's matching
  ;; level, converting format per level as Texture::Load does. A level's next
  ;; level is its misc0 (see $dx_create_mip_chain); the walk ends with the
  ;; shorter chain.
  (func $d3dim_device7_load_chain (param $dst_this i32) (param $src_this i32)
    (local $level i32)
    (block $done (loop $next
      (br_if $done (i32.or (i32.eqz (local.get $dst_this)) (i32.eqz (local.get $src_this))))
      (br_if $done (i32.gt_u (local.get $level) (i32.const 20)))
      (call $d3dim_texture_load (local.get $dst_this) (local.get $src_this))
      (local.set $dst_this (load.field DxObject misc0 (call $dx_from_this (local.get $dst_this))))
      (local.set $src_this (load.field DxObject misc0 (call $dx_from_this (local.get $src_this))))
      (local.set $level (i32.add (local.get $level) (i32.const 1)))
      (br $next))))

  ;; IDirect3DDevice7_LightEnable — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_LightEnable (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_light_enable (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_GetLightEnable — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_GetLightEnable (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_get_light_enable (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_SetClipPlane — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_SetClipPlane (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_set_clip_plane (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_GetClipPlane — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_GetClipPlane (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_device7_get_clip_plane (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_GetInfo — 4 args (incl. this)
  (func $handle_IDirect3DDevice7_GetInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32)
    (local.set $size (local.get $arg3))
    (if (i32.gt_u (local.get $size) (i32.const 4096))
      (then (local.set $size (i32.const 4096))))
    (if (i32.and
          (i32.ne (local.get $arg2) (i32.const 0))
          (i32.ne (local.get $size) (i32.const 0)))
      (then (call $zero_memory (call $g2w (local.get $arg2)) (local.get $size))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirect3DDevice7_SetRenderState — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_SetRenderState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_render_state (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice7_GetRenderState — 3 args (incl. this)
  (func $handle_IDirect3DDevice7_GetRenderState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_render_state (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  ;; ── IDirect3DViewport — 16 methods ─────────────
  ;; IDirect3DViewport_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DViewport_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 3) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DViewport_Release — 1 args (incl. this)
  (func $handle_IDirect3DViewport_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (call $d3dim_viewport_release_owned (local.get $arg0))
        (call $dx_free (local.get $entry))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (store.field DxObject refcount (local.get $entry) (local.get $rc)) (i32.store offset=0 (global.get $reg_base) (local.get $rc))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DViewport_Initialize — 2 args (incl. this)
  (func $handle_IDirect3DViewport_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport_GetViewport — 2 args (incl. this)
  (func $handle_IDirect3DViewport_GetViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_get (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport_SetViewport — 2 args (incl. this)
  (func $handle_IDirect3DViewport_SetViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_set (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport_TransformVertices — 5 args (incl. this)
  (func $handle_IDirect3DViewport_TransformVertices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4)
      (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; IDirect3DViewport_LightElements — 3 args (incl. this)
  (func $handle_IDirect3DViewport_LightElements (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; E_NOTIMPL / DDERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DViewport_SetBackground — 2 args (incl. this)
  (func $handle_IDirect3DViewport_SetBackground (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_set_background (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport_GetBackground — 3 args (incl. this)
  (func $handle_IDirect3DViewport_GetBackground (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_get_background (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DViewport_SetBackgroundDepth — 2 args (incl. this)
  (func $handle_IDirect3DViewport_SetBackgroundDepth (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport_GetBackgroundDepth — 3 args (incl. this)
  (func $handle_IDirect3DViewport_GetBackgroundDepth (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DViewport_Clear — 4 args (incl. this)
  (func $handle_IDirect3DViewport_Clear (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DViewport3_Clear (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DViewport_AddLight — 2 args (incl. this)
  (func $handle_IDirect3DViewport_AddLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_add_light (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport_DeleteLight — 2 args (incl. this)
  (func $handle_IDirect3DViewport_DeleteLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_delete_light (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport_NextLight — 4 args (incl. this)
  (func $handle_IDirect3DViewport_NextLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_next_light
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))


  ;; ── IDirect3DViewport2 — 18 methods ─────────────
  ;; QueryInterface aliases IDirect3DViewport_QueryInterface.

  ;; IDirect3DViewport2_Initialize — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport2_GetViewport — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_GetViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_get (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport2_SetViewport — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_SetViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_set (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport2_TransformVertices — 5 args (incl. this)
  (func $handle_IDirect3DViewport2_TransformVertices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4)
      (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; IDirect3DViewport2_LightElements — 3 args (incl. this)
  (func $handle_IDirect3DViewport2_LightElements (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; E_NOTIMPL / DDERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DViewport2_SetBackground — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_SetBackground (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_set_background (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport2_GetBackground — 3 args (incl. this)
  (func $handle_IDirect3DViewport2_GetBackground (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_get_background (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DViewport2_SetBackgroundDepth — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_SetBackgroundDepth (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport2_GetBackgroundDepth — 3 args (incl. this)
  (func $handle_IDirect3DViewport2_GetBackgroundDepth (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DViewport2_Clear — 4 args (incl. this)
  (func $handle_IDirect3DViewport2_Clear (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DViewport3_Clear (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DViewport2_AddLight — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_AddLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_add_light (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport2_DeleteLight — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_DeleteLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_delete_light (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DViewport2_NextLight — 4 args (incl. this)
  (func $handle_IDirect3DViewport2_NextLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_next_light
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirect3DViewport2_GetViewport2 — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_GetViewport2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DViewport3_GetViewport2 (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; IDirect3DViewport2_SetViewport2 — 2 args (incl. this)
  (func $handle_IDirect3DViewport2_SetViewport2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DViewport3_SetViewport2 (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))


  ;; ── IDirect3DMaterial — 9 methods ─────────────
  ;; IDirect3DMaterial_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DMaterial_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 4) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; All material revisions share their owned payload and final teardown.
  (func $handle_IDirect3DMaterial_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_material_release (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DMaterial_Initialize — 2 args (incl. this)
  (func $handle_IDirect3DMaterial_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DMaterial_SetMaterial — 2 args (incl. this)
  (func $handle_IDirect3DMaterial_SetMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_set (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DMaterial_GetMaterial — 2 args (incl. this)
  (func $handle_IDirect3DMaterial_GetMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_get (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DMaterial_GetHandle — 3 args (incl. this)
  (func $handle_IDirect3DMaterial_GetHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_get_handle (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DMaterial_Reserve — 1 args (incl. this)
  (func $handle_IDirect3DMaterial_Reserve (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DMaterial_Unreserve — 1 args (incl. this)
  (func $handle_IDirect3DMaterial_Unreserve (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))


  ;; ── IDirect3DMaterial2 — 6 methods ─────────────
  ;; IDirect3DMaterial2_QueryInterface — 3 args (incl. this)
  ;; QueryInterface aliases IDirect3DMaterial_QueryInterface.

  ;; IDirect3DMaterial2_SetMaterial — 2 args (incl. this)
  (func $handle_IDirect3DMaterial2_SetMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_set (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DMaterial2_GetMaterial — 2 args (incl. this)
  (func $handle_IDirect3DMaterial2_GetMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_get (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DMaterial2_GetHandle — 3 args (incl. this)
  (func $handle_IDirect3DMaterial2_GetHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_get_handle (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  ;; ── IDirect3DExecuteBuffer — 10 methods ─────────────
  ;; IDirect3DExecuteBuffer_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DExecuteBuffer_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_child_qi (i32.const 8) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DExecuteBuffer_Release — 1 args (incl. this)
  (func $handle_IDirect3DExecuteBuffer_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32) (local $buf i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (call $d3dim_execbuf_cache_clear (local.get $arg0))
        ;; The decoded cache and the Lock-visible payload are separate owners.
        (local.set $buf (load.field DxObject misc0 (local.get $entry)))
        (store.field DxObject misc0 (local.get $entry) (i32.const 0))
        (if (local.get $buf) (then (call $heap_free (local.get $buf))))
        (call $dx_free (local.get $entry))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (store.field DxObject refcount (local.get $entry) (local.get $rc)) (i32.store offset=0 (global.get $reg_base) (local.get $rc))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DExecuteBuffer_Initialize — 3 args (incl. this)
  (func $handle_IDirect3DExecuteBuffer_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DExecuteBuffer_Lock — 2 args (incl. this)
  ;; arg1 = D3DEXECUTEBUFFERDESC*. Fill dwBufferSize+lpData from our DX entry.
  (func $handle_IDirect3DExecuteBuffer_Lock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (if (local.get $arg1) (then
      (local.set $entry (call $dx_from_this (local.get $arg0)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 12))
        (i32.load (i32.add (local.get $entry) (i32.const 12))))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 16))
        (load.field DxObject misc0 (local.get $entry)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DExecuteBuffer_Unlock — 1 args (incl. this)
  (func $handle_IDirect3DExecuteBuffer_Unlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_execbuf_cache_refresh (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DExecuteBuffer_SetExecuteData — 2 args (incl. this)
  ;; arg1 = D3DEXECUTEDATA*. Capture vertex/instruction offsets + lengths.
  (func $handle_IDirect3DExecuteBuffer_SetExecuteData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $header i32) (local $hr i32)
    (block $done
    (if (local.get $arg1) (then
      (local.set $entry (call $dx_from_this (local.get $arg0)))
      ;; Prepare storage before publishing any descriptor fields. Status must
      ;; survive even when SetExecuteData precedes the first Unlock.
      (local.set $header (call $d3dim_execbuf_cache_ensure (local.get $entry) (i32.const 0)))
      (if (i32.eqz (local.get $header)) (then
        (local.set $hr (i32.const 0x8007000E))
        (br $done)))
      ;; dwVertexOffset @+4 → entry+16
      (i32.store (i32.add (local.get $entry) (i32.const 16))
        (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
      ;; dwVertexCount @+8 → entry+20
      (store.field DxObject misc1 (local.get $entry) (call $gl32 (i32.add (local.get $arg1) (i32.const 8))))
      ;; dwInstructionOffset @+12 → entry+24
      (store.field DxObject misc2 (local.get $entry) (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))
      ;; dwInstructionLength @+16 → entry+28
      (store.field DxObject flags (local.get $entry) (call $gl32 (i32.add (local.get $arg1) (i32.const 16))))
      ;; D3DEXECUTEDATA.dsStatus @+24 is driver-owned after Execute. Keep it
      ;; alongside the cached source bytes so every execute buffer has its own
      ;; status without widening the shared 32-byte DX_OBJECTS entry.
      (call $guest_memmove (i32.add (local.get $header) (i32.const 8))
        (i32.add (local.get $arg1) (i32.const 24))
        (i32.const 24)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DExecuteBuffer_GetExecuteData — 2 args (incl. this)
  (func $handle_IDirect3DExecuteBuffer_GetExecuteData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $header i32)
    (if (local.get $arg1) (then
      (local.set $entry (call $dx_from_this (local.get $arg0)))
      (call $guest_memset (local.get $arg1) (i32.const 0) (i32.const 48))
      (call $gs32 (local.get $arg1) (i32.const 48))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 4))
        (i32.load (i32.add (local.get $entry) (i32.const 16))))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 8))
        (load.field DxObject misc1 (local.get $entry)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 12))
        (load.field DxObject misc2 (local.get $entry)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 16))
        (load.field DxObject flags (local.get $entry)))
      (local.set $header (call $d3dim_execbuf_cache_header_guest (local.get $arg0)))
      (if (local.get $header) (then
        (call $guest_memmove (i32.add (local.get $arg1) (i32.const 24))
          (i32.add (local.get $header) (i32.const 8))
          (i32.const 24))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DExecuteBuffer_Validate — 5 args (incl. this)
  (func $handle_IDirect3DExecuteBuffer_Validate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; IDirect3DExecuteBuffer_Optimize — 2 args (incl. this)
  (func $handle_IDirect3DExecuteBuffer_Optimize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))


  ;; ── IDirect3DVertexBuffer — 8 methods ─────────────
  ;; IDirect3DVertexBuffer_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DVertexBuffer_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 6) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DVertexBuffer_Release — 1 args (incl. this)
  (func $handle_IDirect3DVertexBuffer_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then (call $d3dim_vb_free_entry (local.get $entry)) (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (store.field DxObject refcount (local.get $entry) (local.get $rc)) (i32.store offset=0 (global.get $reg_base) (local.get $rc))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DVertexBuffer_Lock — 4 args (incl. this)
  (func $handle_IDirect3DVertexBuffer_Lock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_vb_lock (local.get $arg0) (local.get $arg2) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirect3DVertexBuffer_Unlock — 1 args (incl. this)
  (func $handle_IDirect3DVertexBuffer_Unlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DVertexBuffer_ProcessVertices — 8 args (incl. this)
  ;; ProcessVertices(this, dwVertexOp, dwDestIndex, dwCount, lpSrcBuffer,
  ;;                 dwSrcIndex, lpD3DDevice, dwFlags)
  ;; Transforms and lights source vertices INTO this buffer, so the last three
  ;; arguments come off the guest stack past arg4.
  (func $handle_IDirect3DVertexBuffer_ProcessVertices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_vb_process_vertices
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; IDirect3DVertexBuffer_GetVertexBufferDesc — 2 args (incl. this)
  (func $handle_IDirect3DVertexBuffer_GetVertexBufferDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_vb_get_desc (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DVertexBuffer_Optimize — 3 args (incl. this)
  (func $handle_IDirect3DVertexBuffer_Optimize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  ;; ── IDirect3DVertexBuffer7 — 9 methods ─────────────
  ;; IDirect3DVertexBuffer7_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DVertexBuffer7_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 6) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))



  ;; IDirect3DVertexBuffer7_Unlock — 1 args (incl. this)
  (func $handle_IDirect3DVertexBuffer7_Unlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))



  ;; IDirect3DVertexBuffer7_Optimize — 3 args (incl. this)
  (func $handle_IDirect3DVertexBuffer7_Optimize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DVertexBuffer7_ProcessVerticesStrided — 9 args (incl. this)
  (func $handle_IDirect3DVertexBuffer7_ProcessVerticesStrided (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))


  ;; ── IDirect3DTexture — 8 methods ─────────────
  ;; IDirect3DTexture_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DTexture_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 5) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DTexture_Release — 1 args (incl. this)
  ;;
  ;; An IDirect3DTexture is not a separate object: QueryInterface hands back
  ;; another COM view of the DirectDrawSurface's own DX_OBJECTS slot. So the
  ;; final release of the texture view is the final release of the SURFACE,
  ;; and it has to run the surface teardown -- $dx_free alone retires the slot
  ;; while leaving the DIB pages allocated and $dx_vidmem_used still charged
  ;; for them.
  ;;
  ;; Measured on Diablo II, which creates and drops its texture cache through
  ;; exactly this vtable: 4756 orphaned runs, 48.5 MB of a 63 MB arena, held
  ;; by nothing, in precisely the game's three tile geometries (1 page for a
  ;; 32x32, 10 for a 128x128, 35 for a 256x256 with its slack row). The video
  ;; memory never came back either, so the next GetAvailableVidMem answered
  ;; 6.4 MB, d2direct3d sized its cache from that and eventually reached a
  ;; capacity of zero -- and its eviction loop cannot terminate at capacity
  ;; zero, because count==0 skips the body including the decrement while the
  ;; exit test count==nMaxNumItems is already true. The black screen that made
  ;; this look like a rendering bug is that spin, two steps downstream.
  (func $handle_IDirect3DTexture_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_texture_view_release (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DTexture_Initialize — 3 args (incl. this)
  (func $handle_IDirect3DTexture_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DTexture_GetHandle — 3 args (incl. this)
  (func $handle_IDirect3DTexture_GetHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (call $gs32 (local.get $arg2) (call $dx_slot_of (local.get $entry)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DTexture_PaletteChanged — 3 args (incl. this)
  (func $handle_IDirect3DTexture_PaletteChanged (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DTexture_Load — 2 args (incl. this)
  (func $handle_IDirect3DTexture_Load (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_texture_load (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3DTexture_Unload — 1 args (incl. this)
  (func $handle_IDirect3DTexture_Unload (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_worker_fence)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))


  ;; ── IDirect3DTexture2 — 6 methods ─────────────
  ;; IDirect3DTexture2_QueryInterface — 3 args (incl. this)
  (func $handle_IDirect3DTexture2_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 5) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DTexture2_Release — 1 args (incl. this)
  ;; Same object, same teardown; see IDirect3DTexture_Release above.
  (func $handle_IDirect3DTexture2_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_texture_view_release (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Release one COM view of a texture. A view over a real DirectDraw surface
  ;; (type 2) goes through the surface teardown so its DIB pages and video
  ;; memory are returned; anything else keeps the plain slot release, because
  ;; $dx_surface_release would read misc1/misc2 as a DIB pointer and a byte
  ;; count, and on another type those are a different pair of things entirely.
  (func $d3dim_texture_view_release (param $this i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 2))
      (then
        (i32.store offset=0 (global.get $reg_base)
          (call $dx_surface_release (local.get $this)))
        (return)))
    (call $d3dim_worker_fence)
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then (call $dx_free (local.get $entry)) (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (store.field DxObject refcount (local.get $entry) (local.get $rc)) (i32.store offset=0 (global.get $reg_base) (local.get $rc)))))

  ;; IDirect3DTexture2_PaletteChanged — 3 args (incl. this)
  (func $handle_IDirect3DTexture2_PaletteChanged (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DTexture2_Load — 2 args (incl. this)
  (func $handle_IDirect3DTexture2_Load (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_texture_load (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
