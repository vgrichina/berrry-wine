(layout DxObject
    (field type     i32)     ;; +0   0=free,1=DDraw,2=DDSurface,3=DDPalette,...
    (field refcount i32)     ;; +4
    (field misc0    i32)     ;; +8   DDraw: hwnd | DSBuffer: wave_handle | DIDev: device_type
    (field width    u16)     ;; +12
    (field height   u16)     ;; +14
    (field bpp      u16)     ;; +16
    (field pitch    u16)     ;; +18
    (field misc1    i32)     ;; +20  union — see table above
    (field misc2    i32)     ;; +24  union — see table above
    (field flags    i32))

(func $dx_native_desc_size (param $this i32) (result i32)
    (local $vt i32)
    (if (i32.eqz (local.get $this)) (then (return (i32.const 108))))
    (local.set $vt (call $gl32 (local.get $this)))
    (select (i32.const 124) (i32.const 108)
      (i32.or
        (i32.or (i32.eq (local.get $vt) (global.get $DX_VTBL_DDRAW4))
                (i32.eq (local.get $vt) (global.get $DX_VTBL_DDRAW7)))
        (i32.or (i32.eq (local.get $vt) (global.get $DX_VTBL_DDSURF4))
                (i32.eq (local.get $vt) (global.get $DX_VTBL_DDSURF7))))))

(func $handle_IDirectDrawSurface_GetAttachedSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $child i32) (local $child_entry i32)
    (local $requested i32) (local $actual i32)
    (local.set $entry (call $ddraw_surface_entry_checked (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $requested (call $gl32 (local.get $arg1)))
    (if (i32.eq (call $dx_native_desc_size (local.get $arg0)) (i32.const 124)) (then
      (if (i32.or (call $gl32 (i32.add (local.get $arg1) (i32.const 4)))
            (i32.or (call $gl32 (i32.add (local.get $arg1) (i32.const 8)))
                    (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))) (then
        (call $gs32 (local.get $arg2) (i32.const 0))
        (i32.store (global.get $reg_base) (i32.const 0x887600ff))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))))
    (local.set $child (load.field DxObject misc0 (local.get $entry)))
    (if (i32.eqz (local.get $child))
      (then (local.set $child (call $dx_flip_tail_front (local.get $entry)))))
    (if (local.get $child)
      (then
        (local.set $child_entry (call $ddraw_surface_entry_checked (local.get $child)))
        (if (i32.eqz (local.get $child_entry)) (then (local.set $child (i32.const 0))))
        (if (local.get $child_entry)
          (then (local.set $actual (i32.load (call $dx_surf_meta_ptr (local.get $child_entry))))))))
    ;; The flip-chain link does not satisfy the request: try the surfaces
    ;; attached with AddAttachedSurface. Giants attaches its Z-buffer to the
    ;; back buffer that way and later asks the render target for
    ;; DDSCAPS_ZBUFFER; NOTFOUND there ended the game at its error screen.
    (if (i32.eqz (i32.and (i32.ne (local.get $child) (i32.const 0))
                          (i32.eq (i32.and (local.get $actual) (local.get $requested))
                                  (local.get $requested))))
      (then
        (local.set $child (call $dx_surface_explicit_child (local.get $entry) (local.get $requested)))
        (local.set $actual (local.get $requested))))
    ;; Every requested capability must belong to the returned attachment.
    ;; Blitz probes a primary for TEXTURE|MIPMAP before converting loaded
    ;; images. Returning its unrelated back buffer makes Blitz copy that empty
    ;; surface over the decoded image instead of taking its no-mipmap path.
    (if (i32.and
          (i32.ne (local.get $child) (i32.const 0))
          (i32.eq (i32.and (local.get $actual) (local.get $requested))
                  (local.get $requested)))
      (then
        ;; The attachment keeps its reference; each successful retrieval
        ;; transfers an additional reference for the caller to Release.
        (local.set $child (call $dx_surface_view (local.get $child) (call $gl32 (local.get $arg0))))
        (if (i32.eqz (local.get $child)) (then
          (call $gs32 (local.get $arg2) (i32.const 0))
          (i32.store (global.get $reg_base) (i32.const 0x8007000e))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
          (return)))
        ;; Start tracking an auxiliary view before the shared AddRef path.
        (if (i32.eqz (call $dx_aux_refs (local.get $child))) (then
          (drop (call $dx_aux_ref_add (local.get $child) (i32.const 1)))
          (store.field DxObject refcount (call $dx_from_this (local.get $child))
            (i32.add (load.field DxObject refcount (call $dx_from_this (local.get $child))) (i32.const 1)))
          (call $gs32 (local.get $arg2) (local.get $child))
          (i32.store (global.get $reg_base) (i32.const 0))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
          (return)))
        (drop (call $dx_com_addref (local.get $child)))
        (call $gs32 (local.get $arg2) (local.get $child))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        ;; Zero the out pointer as well as failing. A caller that ignores the
        ;; HRESULT -- hw.dll walking a mip chain does exactly that -- would
        ;; otherwise carry whatever it happened to leave in that variable into
        ;; the next Lock, which is a stale surface rather than an obvious NULL.
        (call $gs32 (local.get $arg2) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x887600FF)))) ;; DDERR_NOTFOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
