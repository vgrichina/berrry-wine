  ;; Direct3D 8 compatibility layer.  D3D8's fixed-function state is close
  ;; enough to D3D9 that the device shares the mature D3D9 backend state; the
  ;; ABI-facing vtable and presentation-parameter layout remain strictly D3D8.

  ;; Texture8 cannot reuse Texture9's vtable: D3D9 inserted three methods at
  ;; slot 14.  This per-instance lazy vtable is safe for worker instances and
  ;; leaves the fixed cross-thread registry layout untouched.
  (global $DX_VTBL_D3DTEX8 (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DCUBE8 (mut i32) (i32.const 0))
  ;; D3D8 vertex-declaration token type 2. Spell this semantically because its
  ;; bit pattern happens to overlap the private thread-RPC address range.
  (global $D3D8_DECL_TOKEN_STREAM i32 (i32.const 536870912))

  (func $d3d8_not_available (result i32) (i32.const 0x8876086a))
  (func $d3d8_adapter_count (result i32) (i32.const 1))
  ;; Adapter 0 lists 640x480 in X8R8G8B8 and then R5G6B5, as a Win98 driver
  ;; offers both depths. The backend renders 32 bpp either way: a fullscreen
  ;; R5G6B5 device gets an X8R8G8B8 back buffer with a 16-bit view over it
  ;; (GetDesc / LockRect / UnlockRect below). LithTech (Die Hard: Nakatomi
  ;; Plaza demo) falls back to a hard-coded 640x480x16 mode and gives up when
  ;; no 16-bit mode is listed. X8R8G8B8 stays mode 0 so a caller that takes
  ;; the first mode is unchanged.
  (func $d3d8_mode_count (param $adapter i32) (result i32)
    (select (i32.const 2) (i32.const 0) (i32.eqz (local.get $adapter))))
  ;; D3DFMT_R5G6B5, the one 16-bit display/back-buffer format listed.
  (global $D3D8_FMT_R5G6B5 i32 (i32.const 23))
  (global $D3D8_FMT_X1R5G5B5 i32 (i32.const 24))
  (global $D3D8_FMT_A1R5G5B5 i32 (i32.const 25))
  (func $d3d8_is_display_format (param $format i32) (result i32)
    (i32.or (i32.eq (local.get $format) (i32.const 22))
            (i32.eq (local.get $format) (global.get $D3D8_FMT_R5G6B5))))
  (func $d3d8_adapter_monitor (param $adapter i32) (result i32)
    ;; Match the primary monitor exposed by USER32 enumeration and info APIs.
    (if (result i32) (i32.eqz (local.get $adapter))
      (then (i32.const 0x10000)) (else (i32.const 0))))

  (func $handle_d3d8_not_available_6 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_not_available))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_d3d8_not_available_7 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_not_available))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_d3d8_unimplemented (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Keep unsupported D3D8 methods fail-fast, including the original guest
    ;; call frame in the diagnostic. This intentionally never returns.
    (call $host_crash_unimplemented (local.get $name_ptr)
      (i32.load offset=16 (global.get $reg_base)) (global.get $eip) (i32.load offset=20 (global.get $reg_base)))
    (unreachable))

  ;; D3D8 names a state block by a DWORD token where D3D9 hands out an
  ;; IDirect3DStateBlock9; the token is that object's address, so Create/End
  ;; share D3D9's handlers and these three take (device, token).
  (func $handle_d3d8_ApplyStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (local.get $arg1) (then (call $d3d9_stateblock_transfer (local.get $arg1) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_d3d8_CaptureStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (local.get $arg1) (then (call $d3d9_stateblock_transfer (local.get $arg1) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; The D3D9 release pops its own one-argument frame; the token is the
  ;; second argument here, so pop one more and report D3D_OK, not a count.
  (func $handle_d3d8_DeleteStateBlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
      (return)))
    (call $handle_IDirect3DShader9_Release (local.get $arg1)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (local.get $name_ptr))
    (if (global.get $d3d_render_token) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_Direct3DCreate8 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dx_create_com_obj (i32.const 37) (global.get $DX_VTBL_D3D8)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3D8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return))) ;; E_POINTER
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
    (local.set $iid (call $g2w (local.get $arg1)))
    ;; IID_IUnknown or IID_IDirect3D8
    (if (i32.or
          (call $guid_words_equal (local.get $iid)
            (i32.const 0) (i32.const 0) (i32.const 0x000000c0) (i32.const 0x46000000))
          (call $guid_words_equal (local.get $iid)
            (i32.const 0x1dd9e8da) (i32.const 0x4d401c77)
            (i32.const 0xfe98cfb0) (i32.const 0x1295fffd)))
      (then
        (drop (call $dx_com_addref (local.get $arg0)))
        (call $gs32 (local.get $arg2) (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))) ;; E_NOINTERFACE

  (func $handle_IDirect3D8_RegisterSoftwareDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_not_available))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3D8_GetAdapterCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_adapter_count))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3D8_GetAdapterIdentifier (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.or (local.get $arg1) (i32.eqz (local.get $arg3)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)) (return)))
    ;; D3DADAPTER_IDENTIFIER8 is 0x42c bytes: Driver[512], Description[512],
    ;; then version, PCI ids, GUID and WHQL level, all left zero so no vendor
    ;; or certification is invented.  The two names match D3D9's identity;
    ;; launchers list Description in their adapter picker.
    ;; 0x42c bytes crosses a guest page boundary from most addresses, and two
    ;; adjacent sparse guest pages need not be adjacent in WASM memory -- so the
    ;; record is gathered and written back rather than filled through one $g2w.
    (local.set $arg4 (call $guest_span_in (local.get $arg3) (i32.const 0x42c)))
    (call $zero_memory (local.get $arg4) (i32.const 0x42c))
    (i32.store (local.get $arg4) (i32.const 0x656e6977))            ;; "wine"
    (i32.store offset=4 (local.get $arg4) (i32.const 0x7373612d))   ;; "-ass"
    (i32.store offset=8 (local.get $arg4) (i32.const 0x6c626d65))   ;; "embl"
    (i32.store offset=12 (local.get $arg4) (i32.const 0x00000079))  ;; "y"
    (i32.store offset=512 (local.get $arg4) (i32.const 0x656e6957)) ;; "Wine"
    (i32.store offset=516 (local.get $arg4) (i32.const 0x73734120)) ;; " Ass"
    (i32.store offset=520 (local.get $arg4) (i32.const 0x6c626d65)) ;; "embl"
    (i32.store offset=524 (local.get $arg4) (i32.const 0x33442079)) ;; "y D3"
    (i32.store offset=528 (local.get $arg4) (i32.const 0x003844))   ;; "D8"
    (call $guest_span_writeback (local.get $arg3) (local.get $arg4) (i32.const 0x42c))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirect3D8_GetAdapterModeCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_mode_count (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $d3d8_write_mode (param $out i32) (param $format i32) (result i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x8876086c))))
    (call $gs32 (local.get $out) (i32.const 640))
    (call $gs32 (i32.add (local.get $out) (i32.const 4)) (i32.const 480))
    (call $gs32 (i32.add (local.get $out) (i32.const 8)) (i32.const 60))
    (call $gs32 (i32.add (local.get $out) (i32.const 12)) (local.get $format))
    (i32.const 0))

  ;; The desktop mode: X8R8G8B8.
  (func $d3d8_write_display_mode (param $out i32) (result i32)
    (call $d3d8_write_mode (local.get $out) (i32.const 22)))

  (func $handle_IDirect3D8_EnumAdapterModes (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.and (i32.eqz (local.get $arg1))
          (i32.lt_u (local.get $arg2) (call $d3d8_mode_count (local.get $arg1))))
        (then (call $d3d8_write_mode (local.get $arg3)
          (select (i32.const 22) (global.get $D3D8_FMT_R5G6B5) (i32.eqz (local.get $arg2)))))
        (else (i32.const 0x8876086c))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; The adapter's current mode is the desktop's X8R8G8B8 unless a fullscreen
  ;; R5G6B5 device holds the display: then it reads R5G6B5, as the mode a real
  ;; driver switched to. LithTech re-enumerates after creating its device and
  ;; rejects a mode list that does not contain the current mode's depth.
  (global $d3d8_fullscreen16_device (mut i32) (i32.const 0))
  (func $handle_IDirect3D8_GetAdapterDisplayMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eqz (local.get $arg1))
        (then (call $d3d8_write_mode (local.get $arg2)
          (select (global.get $D3D8_FMT_R5G6B5) (i32.const 22)
            (call $d3d8_device_is_16bit (global.get $d3d8_fullscreen16_device)))))
        (else (i32.const 0x8876086c))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3D8_CheckDeviceType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $windowed i32)
    ;; this, Adapter, CheckType, DisplayFormat and BackBufferFormat are the five
    ;; direct dispatcher arguments.  Windowed is the sixth COM argument.
    (local.set $windowed (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (if (local.get $arg1) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)) (return))) ;; D3DERR_INVALIDCALL
    (if (i32.ne (local.get $arg2) (i32.const 1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086b)) (return))) ;; D3DERR_INVALIDDEVICE
    ;; Fullscreen R5G6B5 (the second enumerated mode) pairs with an R5G6B5
    ;; back buffer. Windowed rendering uses the X8R8G8B8 desktop, as a real
    ;; driver requires the desktop format there.
    (if (i32.and (i32.eq (local.get $arg3) (global.get $D3D8_FMT_R5G6B5))
          (i32.and (i32.eq (local.get $arg4) (global.get $D3D8_FMT_R5G6B5))
                   (i32.eqz (local.get $windowed)))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    ;; The X8R8G8B8 mode's back buffer may add alpha, but otherwise must have
    ;; the same RGB layout. The shared backend supports both its advertised
    ;; windowed and fullscreen paths.
    (if (i32.or (i32.ne (local.get $arg3) (i32.const 22))
          (i32.and (i32.ne (local.get $arg4) (i32.const 22))
                   (i32.ne (local.get $arg4) (i32.const 21)))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086a)) (return))) ;; D3DERR_NOTAVAILABLE
    (drop (local.get $windowed))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirect3D8_CheckDeviceFormat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rtype i32) (local $format i32) (local $ok i32)
    ;; RType and CheckFormat are arguments six and seven including this.
    (local.set $rtype (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $format (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
    (if (i32.or (local.get $arg1) (i32.ne (local.get $arg2) (i32.const 1))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)) (return))) ;; D3DERR_INVALIDCALL
    ;; Only X8R8G8B8 is exposed as an adapter mode.  Each answer below asks the
    ;; same format gate the matching create path uses, so capability
    ;; negotiation can never promise a resource that create then refuses.
    ;;   Usage 0, RType TEXTURE (3): ordinary 2D textures.
    ;;   D3DUSAGE_RENDERTARGET (1), RType SURFACE (1): the colour targets the
    ;;     back buffer and CreateRenderTarget accept.
    ;;   D3DUSAGE_DEPTHSTENCIL (2), RType SURFACE (1): the depth formats the
    ;;     auto depth buffer and CreateDepthStencilSurface accept.
    ;; NetImmerse (Morrowind) builds its frame-buffer and depth/stencil mode
    ;; lists from the last two; refusing them left both lists empty and the
    ;; renderer failed with "Unknown stencil mode format".
    ;; Resources do not depend on the display depth (the backend is 32 bpp
    ;; underneath), so an R5G6B5 display answers as X8R8G8B8 does, plus the
    ;; R5G6B5 colour target its back buffer is.
    (if (call $d3d8_is_display_format (local.get $arg3)) (then
      (if (i32.and (i32.eqz (local.get $arg4))
            (i32.or (i32.eq (local.get $rtype) (i32.const 3))
                    (i32.eq (local.get $rtype) (i32.const 5))))
        (then (local.set $ok (call $d3d9_texture_format_supported (local.get $format)))))
      (if (i32.and (i32.eq (local.get $arg4) (i32.const 1)) (i32.eq (local.get $rtype) (i32.const 1)))
        (then (local.set $ok (i32.or (call $d3d9_color_target_format (local.get $format))
          (i32.and (i32.eq (local.get $arg3) (global.get $D3D8_FMT_R5G6B5))
                   (i32.eq (local.get $format) (global.get $D3D8_FMT_R5G6B5)))))))
      (if (i32.and (i32.eq (local.get $arg4) (i32.const 2)) (i32.eq (local.get $rtype) (i32.const 1)))
        (then (local.set $ok (call $d3d9_depth_format (local.get $format)))))))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x8876086a) (local.get $ok)))) ;; D3DERR_NOTAVAILABLE

  ;; IDirect3D8_CheckDepthStencilMatch(this, Adapter, DeviceType, AdapterFormat,
  ;; RenderTargetFormat, DepthStencilFormat) -- 6 args.  Same answer as D3D9's:
  ;; any colour target the backend presents pairs with any depth format it
  ;; creates.
  (func $handle_IDirect3D8_CheckDepthStencilMatch (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $depth_format i32)
    (local.set $depth_format (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (if (i32.or (local.get $arg1) (i32.ne (local.get $arg2) (i32.const 1))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)) (return))) ;; D3DERR_INVALIDCALL
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x8876086a) ;; D3DERR_NOTAVAILABLE
        (i32.and (call $d3d8_is_display_format (local.get $arg3))
          (i32.and (i32.or (call $d3d9_color_target_format (local.get $arg4))
                     (i32.and (i32.eq (local.get $arg3) (global.get $D3D8_FMT_R5G6B5))
                              (i32.eq (local.get $arg4) (global.get $D3D8_FMT_R5G6B5))))
                   (call $d3d9_depth_format (local.get $depth_format)))))))

  (func $handle_IDirect3D8_CheckDeviceMultiSampleType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $multisample i32)
    ;; arg4 is Windowed; MultiSampleType is the sixth COM argument on-stack.
    (local.set $multisample (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (if (i32.or (local.get $arg1) (i32.gt_u (local.get $multisample) (i32.const 16))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)) (return))) ;; D3DERR_INVALIDCALL
    (if (i32.ne (local.get $arg2) (i32.const 1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086b)) (return))) ;; D3DERR_INVALIDDEVICE
    ;; The backend exposes no antialias target.  NONE works for either
    ;; windowed/fullscreen mode on the two 32-bit color surface layouts it can
    ;; present; every real multisample technique is unavailable.
    ;; R5G6B5 is a target only fullscreen (the 16-bit mode); windowed rendering
    ;; is on the X8R8G8B8 desktop.
    (if (i32.or (local.get $multisample)
          (i32.and (i32.ne (local.get $arg3) (i32.const 22))
            (i32.and (i32.ne (local.get $arg3) (i32.const 21))
                     (i32.or (i32.ne (local.get $arg3) (global.get $D3D8_FMT_R5G6B5))
                             (i32.ne (local.get $arg4) (i32.const 0)))))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086a)) (return))) ;; D3DERR_NOTAVAILABLE
    (drop (local.get $arg4))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3d8_fill_caps (param $out i32) (result i32)
    (local $caps i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x8876086c))))
    ;; D3DCAPS8 is 0xd4 bytes and crosses a guest page boundary from most
    ;; addresses; the two halves need not be adjacent in WASM memory.
    (local.set $caps (call $guest_span_in (local.get $out) (i32.const 0xd4)))
    (call $zero_memory (local.get $caps) (i32.const 0xd4))
    (i32.store (local.get $caps) (i32.const 1))       ;; DeviceType = HAL
    ;; Advertise the fixed-function surface the shared WebGL backend actually
    ;; implements. Leaving every bitfield zero made UE2 disable mipmaps and
    ;; material paths even though CreateTexture and the fixed-function compiler
    ;; handle them. Keep volume textures, anisotropy and hardware T&L clear.
    ;; The bounded vertex adapter supports stream elements and VS1.0/1.1,
    ;; but not every D3D8 declaration form (e.g. constant/tessellator tokens);
    ;; do not advertise a complete programmable-vertex capability yet.
    (i32.store offset=0x0c (local.get $caps) (i32.const 0x00080000)) ;; CANRENDERWINDOWED
    (i32.store offset=0x1c (local.get $caps) (i32.const 0x00088f00)) ;; DevCaps
    (i32.store offset=0x20 (local.get $caps) (i32.const 0x00000ef0)) ;; PrimitiveMiscCaps
    (i32.store offset=0x24 (local.get $caps) (i32.const 0x00600190)) ;; RasterCaps
    (i32.store offset=0x28 (local.get $caps) (i32.const 0x000000ff)) ;; ZCmpCaps
    (i32.store offset=0x2c (local.get $caps) (i32.const 0x000007ff)) ;; SrcBlendCaps
    (i32.store offset=0x30 (local.get $caps) (i32.const 0x000007ff)) ;; DestBlendCaps
    (i32.store offset=0x34 (local.get $caps) (i32.const 0x000000ff)) ;; AlphaCmpCaps
    (i32.store offset=0x38 (local.get $caps) (i32.const 0x00084208)) ;; ShadeCaps
    (i32.store offset=0x3c (local.get $caps) (i32.const 0x00014c05)) ;; TextureCaps, cube + mip cube
    (i32.store offset=0x40 (local.get $caps) (i32.const 0x03030300)) ;; TextureFilterCaps
    (i32.store offset=0x44 (local.get $caps) (i32.const 0x03030300)) ;; CubeTextureFilterCaps
    (i32.store offset=0x4c (local.get $caps) (i32.const 0x00000017)) ;; TextureAddressCaps
    (i32.store offset=0x54 (local.get $caps) (i32.const 0x0000001f)) ;; LineCaps
    (i32.store offset=0x58 (local.get $caps) (i32.const 4096))
    (i32.store offset=0x5c (local.get $caps) (i32.const 4096))
    (i32.store offset=0x64 (local.get $caps) (i32.const 8192)) ;; MaxTextureRepeat
    (i32.store offset=0x68 (local.get $caps) (i32.const 4096)) ;; MaxTextureAspectRatio
    (i32.store offset=0x6c (local.get $caps) (i32.const 1))    ;; MaxAnisotropy
    (f32.store offset=0x70 (local.get $caps) (f32.const 1e10)) ;; MaxVertexW
    (i32.store offset=0x88 (local.get $caps) (i32.const 0x000000ff)) ;; StencilCaps
    (i32.store offset=0x8c (local.get $caps) (i32.const 8)) ;; eight FVF texcoords
    (i32.store offset=0x90 (local.get $caps) (i32.const 0x03feffff)) ;; TextureOpCaps
    (i32.store offset=0x94 (local.get $caps) (i32.const 8))
    (i32.store offset=0x98 (local.get $caps) (i32.const 8))
    (i32.store offset=0x9c (local.get $caps) (i32.const 0x0000003b)) ;; VertexProcessingCaps
    (i32.store offset=0xa0 (local.get $caps) (i32.const 8)) ;; MaxActiveLights
    (f32.store offset=0xb0 (local.get $caps) (f32.const 1)) ;; MaxPointSize
    ;; Zero here means the device cannot draw a single primitive. UE2 records
    ;; these limits and later sizes/splits its dynamic batches from them.
    (i32.store offset=0xb4 (local.get $caps) (i32.const 1048575)) ;; MaxPrimitiveCount
    (i32.store offset=0xb8 (local.get $caps) (i32.const 1048575)) ;; MaxVertexIndex
    (i32.store offset=0xbc (local.get $caps) (i32.const 8)) ;; MaxStreams
    (i32.store offset=0xc0 (local.get $caps) (i32.const 255))
    (i32.store offset=0xc8 (local.get $caps) (i32.const 96)) ;; MaxVertexShaderConst
    (i32.store offset=0xcc (local.get $caps) (i32.const 0xffff0104)) ;; PixelShaderVersion
    (f32.store offset=0xd0 (local.get $caps) (f32.const 8)) ;; MaxPixelShaderValue
    (call $guest_span_writeback (local.get $out) (local.get $caps) (i32.const 0xd4))
    (i32.const 0))

  (func $handle_IDirect3D8_GetDeviceCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.or (local.get $arg1) (i32.ne (local.get $arg2) (i32.const 1)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)) (return)))
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_fill_caps (local.get $arg3))))

  (func $handle_IDirect3D8_GetAdapterMonitor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; HMONITOR belongs to the emulated desktop, just like USER32 handles.
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_adapter_monitor (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Translate D3DPRESENT_PARAMETERS8 (52 bytes) to the D3D9 layout (56 bytes)
  ;; and let the established D3D9 device/backend allocator do the real work.
  (func $handle_IDirect3D8_CreateDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pp8 i32) (local $out i32) (local $pp9 i32) (local $dev i32) (local $hr i32)
    (local $bb16 i32) (local $state i32)
    (local.set $pp8 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $out (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (if (i32.or (i32.eqz (local.get $pp8)) (i32.eqz (local.get $out))) (then
      (if (local.get $out) (then (call $gs32 (local.get $out) (i32.const 0))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
      (return)))
    (local.set $pp9 (call $heap_alloc (i32.const 56)))
    (if (i32.eqz (local.get $pp9)) (then
      (call $gs32 (local.get $out) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
      (return)))
    (call $zero_memory (call $g2w (local.get $pp9)) (i32.const 56))
    (memory.copy (call $g2w (local.get $pp9)) (call $g2w (local.get $pp8)) (i32.const 20))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 24)) (call $gl32 (i32.add (local.get $pp8) (i32.const 20))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 28)) (call $gl32 (i32.add (local.get $pp8) (i32.const 24))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 32)) (call $gl32 (i32.add (local.get $pp8) (i32.const 28))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 36)) (call $gl32 (i32.add (local.get $pp8) (i32.const 32))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 40)) (call $gl32 (i32.add (local.get $pp8) (i32.const 36))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 44)) (call $gl32 (i32.add (local.get $pp8) (i32.const 40))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 48)) (call $gl32 (i32.add (local.get $pp8) (i32.const 44))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 52)) (call $gl32 (i32.add (local.get $pp8) (i32.const 48))))
    ;; An R5G6B5 back buffer is the fullscreen 16-bit mode: the backend draws
    ;; it as X8R8G8B8 and the D3D8 side gives it a 16-bit view. Windowed, the
    ;; back buffer must match the X8R8G8B8 desktop, as on a real driver.
    (local.set $bb16 (i32.eq (call $gl32 (i32.add (local.get $pp8) (i32.const 8)))
      (global.get $D3D8_FMT_R5G6B5)))
    (if (local.get $bb16) (then
      (if (call $gl32 (i32.add (local.get $pp8) (i32.const 28))) (then
        (call $heap_free (local.get $pp9))
        (call $gs32 (local.get $out) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)) ;; D3DERR_INVALIDCALL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
      (call $gs32 (i32.add (local.get $pp9) (i32.const 8)) (i32.const 22))))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp9))
    (call $handle_IDirect3D9_CreateDevice
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (local.set $hr (i32.load offset=0 (global.get $reg_base)))
    (if (i32.eqz (local.get $hr)) (then
      (local.set $dev (call $gl32 (local.get $out)))
      (if (local.get $dev) (then
        (i32.store (call $g2w (local.get $dev)) (global.get $DX_VTBL_D3DDEV8))
        ;; The device's display mode (+20660 is its format) is what marks it
        ;; 16-bit for GetDisplayMode and the back-buffer view.
        (if (local.get $bb16) (then
          (local.set $state (call $d3d9_program_state (local.get $dev)))
          (if (local.get $state) (then
            (call $gs32 (i32.add (local.get $state) (i32.const 20660))
              (global.get $D3D8_FMT_R5G6B5))
            (global.set $d3d8_fullscreen16_device (local.get $dev))))))))))
    (call $heap_free (local.get $pp9))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr)))

  ;; IDirect3DDevice8_CopyRects(this, src, pSrcRects, cRects, dst, pDstPoints).
  ;; D3D9 split this into UpdateSurface/StretchRect, but D3D8 copies between
  ;; any two same-format surfaces regardless of pool. Texture levels outside
  ;; the default pool are CPU-authoritative here, so their rects are copied
  ;; row by row at the format's own texel size and the destination's dirty
  ;; counter is bumped for re-upload; a single rect into a default-pool target
  ;; goes through the D3D9 UpdateSurface path, which owns the GPU hand-off.
  ;; LithTech copies 64x64 X1R5G5B5 managed textures this way.
  (func $d3d8_copy_view (param $surface i32) (param $device i32) (param $out i32) (result i32)
    (if (call $d3d9_update_view (local.get $surface) (local.get $device) (i32.const 1) (local.get $out))
      (then (return (i32.const 1))))
    (if (call $d3d9_update_view (local.get $surface) (local.get $device) (i32.const 2) (local.get $out))
      (then (return (i32.const 1))))
    (if (call $d3d9_update_view (local.get $surface) (local.get $device) (i32.const 3) (local.get $out))
      (then (return (i32.const 1))))
    (call $d3d9_update_view (local.get $surface) (local.get $device) (i32.const 0) (local.get $out)))

  (func $handle_IDirect3DDevice8_CopyRects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $points i32) (local $src i32) (local $dst i32) (local $scratch i32) (local $s i32) (local $d i32)
    (local $count i32) (local $i i32) (local $x i32) (local $y i32) (local $w i32) (local $h i32)
    (local $dx i32) (local $dy i32) (local $texel i32) (local $row i32) (local $hr i32)
    (local.set $points (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $src (call $d3d8_surface_in (local.get $arg1)))
    (local.set $dst (call $d3d8_surface_in (local.get $arg4)))
    (local.set $hr (i32.const 0x8876086c)) ;; D3DERR_INVALIDCALL
    (local.set $scratch (call $heap_alloc (i32.const 64)))
    (block $done
      (br_if $done (i32.or (i32.eqz (local.get $scratch))
        (i32.or (i32.eqz (local.get $src)) (i32.eqz (local.get $dst)))))
      (local.set $s (call $g2w (local.get $scratch)))
      (local.set $d (i32.add (local.get $s) (i32.const 32)))
      (if (i32.and (call $d3d8_copy_view (local.get $src) (local.get $arg0) (local.get $s))
            (call $d3d8_copy_view (local.get $dst) (local.get $arg0) (local.get $d)))
        (then
          ;; Both CPU-authoritative and not a colour target: copy here.
          (if (i32.and
                (i32.and (i32.eqz (i32.load offset=20 (local.get $d))) (i32.eqz (i32.load offset=28 (local.get $d))))
                (i32.and (i32.eqz (i32.load offset=20 (local.get $s))) (i32.eqz (i32.load offset=28 (local.get $s))))) (then
            (br_if $done (i32.ne (i32.load offset=8 (local.get $s)) (i32.load offset=8 (local.get $d))))
            ;; Block-compressed copies need block alignment; none seen yet.
            (br_if $done (i32.ne (call $d3d9_texture_block_bytes (i32.load offset=8 (local.get $s))) (i32.const 0)))
            (local.set $texel (call $d3d9_texture_texel_bytes (i32.load offset=8 (local.get $s))))
            (local.set $count (select (local.get $arg3) (i32.const 1) (i32.ne (local.get $arg2) (i32.const 0))))
            (local.set $i (i32.const 0))
            (block $rects_done (loop $rects
              (br_if $rects_done (i32.ge_u (local.get $i) (local.get $count)))
              (if (local.get $arg2)
                (then
                  (local.set $x (call $gl32 (i32.add (local.get $arg2) (i32.shl (local.get $i) (i32.const 4)))))
                  (local.set $y (call $gl32 (i32.add (local.get $arg2) (i32.add (i32.shl (local.get $i) (i32.const 4)) (i32.const 4)))))
                  (local.set $w (i32.sub (call $gl32 (i32.add (local.get $arg2) (i32.add (i32.shl (local.get $i) (i32.const 4)) (i32.const 8)))) (local.get $x)))
                  (local.set $h (i32.sub (call $gl32 (i32.add (local.get $arg2) (i32.add (i32.shl (local.get $i) (i32.const 4)) (i32.const 12)))) (local.get $y))))
                (else
                  (local.set $x (i32.const 0)) (local.set $y (i32.const 0))
                  (local.set $w (i32.load (local.get $s))) (local.set $h (i32.load offset=4 (local.get $s)))))
              (local.set $dx (local.get $x)) (local.set $dy (local.get $y))
              (if (local.get $points) (then
                (local.set $dx (call $gl32 (i32.add (local.get $points) (i32.shl (local.get $i) (i32.const 3)))))
                (local.set $dy (call $gl32 (i32.add (local.get $points) (i32.add (i32.shl (local.get $i) (i32.const 3)) (i32.const 4)))))))
              ;; Both rects inside their surfaces (unsigned compares reject negatives).
              (br_if $done (i32.or (i32.le_s (local.get $w) (i32.const 0)) (i32.le_s (local.get $h) (i32.const 0))))
              (br_if $done (i32.or (i32.gt_u (i32.add (local.get $x) (local.get $w)) (i32.load (local.get $s)))
                (i32.gt_u (i32.add (local.get $y) (local.get $h)) (i32.load offset=4 (local.get $s)))))
              (br_if $done (i32.or (i32.gt_u (i32.add (local.get $dx) (local.get $w)) (i32.load (local.get $d)))
                (i32.gt_u (i32.add (local.get $dy) (local.get $h)) (i32.load offset=4 (local.get $d)))))
              (local.set $row (i32.const 0))
              (block $rows_done (loop $rows
                (br_if $rows_done (i32.ge_u (local.get $row) (local.get $h)))
                (memory.copy
                  (i32.add (i32.load offset=12 (local.get $d))
                    (i32.add (i32.mul (i32.add (local.get $dy) (local.get $row)) (i32.load offset=16 (local.get $d)))
                             (i32.mul (local.get $dx) (local.get $texel))))
                  (i32.add (i32.load offset=12 (local.get $s))
                    (i32.add (i32.mul (i32.add (local.get $y) (local.get $row)) (i32.load offset=16 (local.get $s)))
                             (i32.mul (local.get $x) (local.get $texel))))
                  (i32.mul (local.get $w) (local.get $texel)))
                (local.set $row (i32.add (local.get $row) (i32.const 1)))
                (br $rows)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $rects)))
            (local.set $row (i32.load offset=24 (local.get $d)))
            (i32.store (local.get $row) (i32.add (i32.load (local.get $row)) (i32.const 1)))
            (local.set $hr (i32.const 0))
            (br $done)))))
      ;; A colour target is on one side: one rect goes through UpdateSurface.
      (if (i32.le_u (local.get $arg3) (i32.const 1)) (then
        (call $heap_free (local.get $scratch))
        (call $d3d9_update_surface (local.get $arg0) (local.get $src) (local.get $arg2) (local.get $dst) (local.get $points))
        (if (global.get $d3d_render_token) (then (return)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
      (call $crash_unimplemented (local.get $name_ptr)))
    (if (local.get $scratch) (then (call $heap_free (local.get $scratch))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; IDirect3DDevice8_Reset(this, D3DPRESENT_PARAMETERS8*). The D3D9 reset
  ;; transaction keeps the parameter pointer in its plan while a render worker
  ;; finishes the old device and re-enters this handler, so the translated
  ;; block lives in one per-instance buffer rather than a temporary. A 16-bit
  ;; back buffer is handled as in CreateDevice. D3D8's COPY_VSYNC swap effect
  ;; (4) is D3D9's COPY with a vsync interval, which this backend's COPY is.
  (global $d3d8_reset_pp9 (mut i32) (i32.const 0))
  (func $handle_IDirect3DDevice8_Reset (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pp9 i32) (local $bb16 i32) (local $state i32) (local $swap i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
      (return)))
    (local.set $bb16 (i32.eq (call $gl32 (i32.add (local.get $arg1) (i32.const 8)))
      (global.get $D3D8_FMT_R5G6B5)))
    (if (i32.and (local.get $bb16)
          (i32.ne (call $gl32 (i32.add (local.get $arg1) (i32.const 28))) (i32.const 0))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)) ;; windowed 16-bit
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
      (return)))
    (if (i32.eqz (global.get $d3d8_reset_pp9))
      (then (global.set $d3d8_reset_pp9 (call $heap_alloc (i32.const 56)))))
    (local.set $pp9 (global.get $d3d8_reset_pp9))
    (if (i32.eqz (local.get $pp9)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
      (return)))
    ;; D3D8 (52 bytes) -> D3D9 (56): MultiSampleQuality is inserted at +20.
    (local.set $swap (i32.const 0))
    (block $copied (loop $copy
      (br_if $copied (i32.ge_u (local.get $swap) (i32.const 20)))
      (call $gs32 (i32.add (local.get $pp9) (local.get $swap))
        (call $gl32 (i32.add (local.get $arg1) (local.get $swap))))
      (local.set $swap (i32.add (local.get $swap) (i32.const 4)))
      (br $copy)))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 20)) (i32.const 0))
    (local.set $swap (i32.const 20))
    (block $tail (loop $rest
      (br_if $tail (i32.ge_u (local.get $swap) (i32.const 52)))
      (call $gs32 (i32.add (local.get $pp9) (i32.add (local.get $swap) (i32.const 4)))
        (call $gl32 (i32.add (local.get $arg1) (local.get $swap))))
      (local.set $swap (i32.add (local.get $swap) (i32.const 4)))
      (br $rest)))
    (if (i32.eq (call $gl32 (i32.add (local.get $pp9) (i32.const 24))) (i32.const 4))
      (then (call $gs32 (i32.add (local.get $pp9) (i32.const 24)) (i32.const 3))))
    ;; The backend presents from one physical back buffer, which CreateDevice
    ;; already gives a device whatever BackBufferCount it asked for; the D3D9
    ;; reset gate refuses more than one. LithTech asks for two (triple
    ;; buffering unless "Disable TripBuf" is set) and falls back to software
    ;; emulation when the reset fails.
    (if (i32.gt_u (call $gl32 (i32.add (local.get $pp9) (i32.const 12))) (i32.const 1))
      (then (call $gs32 (i32.add (local.get $pp9) (i32.const 12)) (i32.const 1))))
    (if (local.get $bb16) (then (call $gs32 (i32.add (local.get $pp9) (i32.const 8)) (i32.const 22))))
    (call $handle_IDirect3DDevice9_Reset (local.get $arg0) (local.get $pp9)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (global.get $d3d_render_token) (then (return)))
    (if (i32.load offset=0 (global.get $reg_base)) (then (return)))
    ;; Reset reports the size it chose for a zero width/height back.
    (call $gs32 (local.get $arg1) (call $gl32 (local.get $pp9)))
    (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (call $gl32 (i32.add (local.get $pp9) (i32.const 4))))
    (local.set $state (call $d3d9_program_state (local.get $arg0)))
    (if (local.get $bb16)
      (then
        (if (local.get $state) (then
          (call $gs32 (i32.add (local.get $state) (i32.const 20660)) (global.get $D3D8_FMT_R5G6B5))
          (global.set $d3d8_fullscreen16_device (local.get $arg0)))))
      (else
        (if (i32.eq (global.get $d3d8_fullscreen16_device) (local.get $arg0))
          (then (global.set $d3d8_fullscreen16_device (i32.const 0)))))))

  (func $handle_IDirect3DDevice8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (local.get $arg2)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
    (if (i32.or
          (call $guid_words_equal (call $g2w (local.get $arg1))
            (i32.const 0) (i32.const 0) (i32.const 0x000000c0) (i32.const 0x46000000))
          (call $guid_words_equal (call $g2w (local.get $arg1))
            (i32.const 0x7385e5df) (i32.const 0x41d58fe8)
            (i32.const 0xb4d7b686) (i32.const 0xcfb64785)))
      (then
        (drop (call $dx_com_addref (local.get $arg0)))
        (call $gs32 (local.get $arg2) (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)))

  (func $handle_IDirect3DDevice8_ResourceManagerDiscardBytes (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; The browser backend owns resource residency. The byte count is an
    ;; advisory eviction request, so accepting it without eviction is valid.
    (drop (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice8_GetDeviceCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_fill_caps (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice8_GetDisplayMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3d8_write_mode (local.get $arg1)
      (select (global.get $D3D8_FMT_R5G6B5) (i32.const 22)
        (call $d3d8_device_is_16bit (local.get $arg0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; D3D9 inserted a swap-chain index before D3D8's back-buffer index.
  ;; Devices in this backend expose only the implicit swap chain, so insert
  ;; zero and correct the delegated stdcall cleanup by one word.
  (func $handle_IDirect3DDevice8_GetBackBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice9_GetBackBuffer
      (local.get $arg0) (i32.const 0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $d3d8_surface_out (local.get $arg3))
    (call $d3d8_view_track (local.get $arg0) (local.get $arg3)))

  ;; D3D8's gamma ramp belongs to the device's implicit swap chain; D3D9
  ;; added the swap-chain index as the first argument.
  (func $handle_IDirect3DDevice8_SetGammaRamp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_gamma_ramp (local.get $arg0) (i32.const 0) (local.get $arg2) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DDevice8_GetGammaRamp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_gamma_ramp (local.get $arg0) (i32.const 0) (local.get $arg1) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; D3D8 binds an FVF or a device-owned declaration/program pair. The common
  ;; binding helpers retain both resources and record them in state blocks.
  (func $handle_IDirect3DDevice8_SetVertexShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $node i32)
    (local.set $node (call $d3d8_vertex_handle (call $d3d9_program_state (local.get $arg0)) (local.get $arg1)))
    (if (local.get $node) (then
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
      (if (i32.eqz (call $gl32 (i32.add (local.get $node) (i32.const 12)))) (then (return)))
      (call $d3d9_declaration_bind (local.get $arg0) (call $gl32 (i32.add (local.get $node) (i32.const 16))))
      (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then
        (call $d3d9_shader_binding (local.get $arg0) (call $gl32 (i32.add (local.get $node) (i32.const 8)))
          (i32.const 0) (i32.const 0))))
      (return)))
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $handle_IDirect3DDevice9_SetFVF
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then
      (call $d3d9_shader_binding (local.get $arg0) (i32.const 0) (i32.const 0) (i32.const 0)))))

  ;; GetVertexShader returns whatever SetVertexShader last bound: an FVF code
  ;; or a declaration handle. The backend keeps the two mutually exclusive
  ;; (binding one zeroes the other), so the non-zero FVF wins, else the handle.
  ;; D3D8 shader handles are not reference counted.
  (func $handle_IDirect3DDevice8_GetVertexShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $fvf i32) (local $node i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $arg0)))
    (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $arg1))) (then (return)))
    (local.set $fvf (call $gl32 (i32.add (local.get $state) (i32.const 12))))
    (if (i32.eqz (local.get $fvf)) (then
      (local.set $node (call $gl32 (i32.add (local.get $state) (i32.const 25612))))
      (block $none (loop $find
        (br_if $none (i32.eqz (local.get $node)))
        (if (i32.and
          (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 8))) (call $gl32 (local.get $state)))
          (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 16)))
            (call $gl32 (i32.add (local.get $state) (i32.const 8))))) (then
          (call $gs32 (local.get $arg1) (local.get $node))
          (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
        (local.set $node (call $gl32 (local.get $node))) (br $find)))))
    (call $gs32 (local.get $arg1)
      (select (local.get $fvf) (call $gl32 (i32.add (local.get $state) (i32.const 8)))
        (i32.ne (local.get $fvf) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Vertex handle nodes retain both immutable resources and the original
  ;; D3D8 declaration tokens. Node addresses are process-unique handles;
  ;; tombstones remain until device destruction so deletion cannot recycle a
  ;; live device's stale handle. Layout: next, handle, shader, live, declaration,
  ;; token-byte-count, original tokens. A state block owns resource references
  ;; independently of the handle's live flag.
  (func $d3d8_vertex_handle (param $state i32) (param $handle i32) (result i32)
    (local $node i32)
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $node (call $gl32 (i32.add (local.get $state) (i32.const 25612))))
    (block $done (loop $next
      (br_if $done (i32.eqz (local.get $node)))
      (if (i32.eq (local.get $node) (local.get $handle)) (then (return (local.get $node))))
      (local.set $node (call $gl32 (local.get $node))) (br $next)))
    (i32.const 0))

  (func $d3d8_vertex_handle_create (param $device i32) (param $declaration i32)
      (param $function i32) (param $tokens i32) (param $bytes i32) (param $out i32)
    (local $state i32) (local $node i32) (local $shader i32) (local $esp i32) (local $hr i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (local.set $hr (i32.const 0x8007000e))
    (local.set $node (call $heap_alloc (i32.add (local.get $bytes) (i32.const 24))))
    (block $failed
      (br_if $failed (i32.eqz (local.get $node)))
      (call $gs32 (i32.add (local.get $node) (i32.const 8)) (i32.const 0))
      (if (local.get $function) (then
        (call $d3d9_shader_create (local.get $device) (local.get $function)
          (i32.add (local.get $node) (i32.const 8))
          (select (i32.const 0xfffe0100) (i32.const 0xfffe0101)
            (i32.eq (call $gl32 (local.get $function)) (i32.const 0xfffe0100))))
        (local.set $hr (i32.load offset=0 (global.get $reg_base)))
        (br_if $failed (local.get $hr))))
      (local.set $shader (call $gl32 (i32.add (local.get $node) (i32.const 8))))
      (call $gs32 (local.get $node) (call $gl32 (i32.add (local.get $state) (i32.const 25612))))
      (call $gs32 (i32.add (local.get $node) (i32.const 4)) (local.get $node))
      (call $gs32 (i32.add (local.get $node) (i32.const 12)) (i32.const 1))
      (call $gs32 (i32.add (local.get $node) (i32.const 16)) (local.get $declaration))
      (call $gs32 (i32.add (local.get $node) (i32.const 20)) (local.get $bytes))
      (memory.copy (i32.add (call $g2w (local.get $node)) (i32.const 24))
        (call $g2w (local.get $tokens)) (local.get $bytes))
      (call $gs32 (i32.add (local.get $state) (i32.const 25612)) (local.get $node))
      ;; Convert external COM references to internal device ownership, without
      ;; a reference cycle between the device and its DWORD handles.
      (call $gs32 (i32.add (local.get $declaration) (i32.const 20)) (i32.const 1))
      (if (local.get $shader) (then
        (call $gs32 (i32.add (local.get $shader) (i32.const 20)) (i32.const 1))
        (call $handle_IDirect3DShader9_Release (local.get $shader)
          (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
      (call $handle_IDirect3DShader9_Release (local.get $declaration)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (call $gs32 (local.get $out) (local.get $node))
      (i32.store offset=16 (global.get $reg_base) (local.get $esp))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (return))
    (call $heap_free (local.get $node))
    (call $handle_IDirect3DShader9_Release (local.get $declaration)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (call $gs32 (local.get $out) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr)))

  (func $d3d8_vertex_handles_free (param $state i32)
    (local $node i32) (local $next i32)
    (local.set $node (call $gl32 (i32.add (local.get $state) (i32.const 25612))))
    (call $gs32 (i32.add (local.get $state) (i32.const 25612)) (i32.const 0))
    (block $done (loop $next_node
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $next (call $gl32 (local.get $node)))
      (if (call $gl32 (i32.add (local.get $node) (i32.const 12))) (then
        (call $d3d9_shader_unbind (call $gl32 (i32.add (local.get $node) (i32.const 8))))
        (call $d3d9_shader_unbind (call $gl32 (i32.add (local.get $node) (i32.const 16))))))
      (call $heap_free (local.get $node))
      (local.set $node (local.get $next)) (br $next_node))))

  (func $d3d8_vertex_bytes (param $device i32) (param $handle i32)
      (param $data i32) (param $size i32) (param $function i32)
    (local $node i32) (local $source i32) (local $length i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $size)) (then (return)))
    (local.set $node (call $d3d8_vertex_handle (call $d3d9_program_state (local.get $device)) (local.get $handle)))
    (if (i32.eqz (local.get $node)) (then (return)))
    (if (i32.eqz (call $gl32 (i32.add (local.get $node) (i32.const 12)))) (then (return)))
    (if (local.get $function) (then
      (local.set $source (call $gl32 (i32.add (local.get $node) (i32.const 8))))
      (if (local.get $source) (then
        (local.set $length (call $gl32 (i32.add (local.get $source) (i32.const 16))))
        (local.set $source (i32.add (local.get $source) (i32.const 24))))))
    (else
      (local.set $length (call $gl32 (i32.add (local.get $node) (i32.const 20))))
      (local.set $source (i32.add (local.get $node) (i32.const 24)))))
    (if (local.get $data) (then
      (if (i32.lt_u (call $gl32 (local.get $size)) (local.get $length)) (then (return)))
      (if (local.get $length) (then
        (memory.copy (call $g2w (local.get $data)) (call $g2w (local.get $source)) (local.get $length))))))
    (call $gs32 (local.get $size) (local.get $length))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirect3DDevice8_GetVertexShaderDeclaration (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d8_vertex_bytes (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DDevice8_GetVertexShaderFunction (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d8_vertex_bytes (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DDevice8_SetVertexShaderConstant (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.and (i32.le_u (local.get $arg3) (i32.const 96))
      (i32.le_u (local.get $arg1) (i32.sub (i32.const 96) (local.get $arg3)))) (then
      (call $d3d9_float_constants (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DDevice8_GetVertexShaderConstant (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.and (i32.le_u (local.get $arg3) (i32.const 96))
      (i32.le_u (local.get $arg1) (i32.sub (i32.const 96) (local.get $arg3)))) (then
      (call $d3d9_float_constants (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; D3D8 shaders are device-owned DWORD handles, not COM references.
  ;; Nodes: next, handle, shared shader object, live flag. Deleted nodes keep
  ;; their identity until device destruction: a captured state block can
  ;; still bind the old object, while Set/Delete must reject its dead handle.
  (func $d3d8_pixel_handle (param $state i32) (param $handle i32) (result i32)
    (local $node i32)
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $node (call $gl32 (i32.add (local.get $state) (i32.const 25604))))
    (block $done (loop $next
      (br_if $done (i32.eqz (local.get $node)))
      (if (i32.and (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 4))) (local.get $handle))
            (i32.ne (call $gl32 (i32.add (local.get $node) (i32.const 12))) (i32.const 0)))
        (then (return (local.get $node))))
      (local.set $node (call $gl32 (local.get $node))) (br $next)))
    (i32.const 0))

  (func $d3d8_pixel_handles_free (param $state i32)
    (local $node i32) (local $next i32)
    (local.set $node (call $gl32 (i32.add (local.get $state) (i32.const 25604))))
    (call $gs32 (i32.add (local.get $state) (i32.const 25604)) (i32.const 0))
    (block $done (loop $nodes
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $next (call $gl32 (local.get $node)))
      (if (call $gl32 (i32.add (local.get $node) (i32.const 12))) (then
        (call $d3d9_shader_unbind (call $gl32 (i32.add (local.get $node) (i32.const 8))))))
      (call $heap_free (local.get $node))
      (local.set $node (local.get $next)) (br $nodes))))

  (func $handle_IDirect3DDevice8_CreatePixelShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $node i32) (local $handle i32) (local $shader i32) (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (block $done
      (br_if $done (i32.eqz (local.get $arg2)))
      (call $gs32 (local.get $arg2) (i32.const 0))
      (local.set $state (call $d3d9_program_state (local.get $arg0)))
      (br_if $done (i32.eqz (local.get $state)))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e))
      (local.set $handle (call $gl32 (i32.add (local.get $state) (i32.const 25608))))
      (br_if $done (i32.ge_u (local.get $handle) (i32.const 0x7ffeffff)))
      (local.set $node (call $heap_alloc (i32.const 16)))
      (br_if $done (i32.eqz (local.get $node)))
      (call $d3d9_shader_create (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0xffff0101))
      (if (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0))
        (then (call $heap_free (local.get $node)) (br $done)))
      (local.set $shader (call $gl32 (local.get $arg2)))
      (local.set $handle (i32.add (local.get $handle) (i32.const 1)))
      (call $gs32 (i32.add (local.get $state) (i32.const 25608)) (local.get $handle))
      (local.set $handle (i32.add (local.get $handle) (i32.const 0x10000)))
      (call $gs32 (local.get $node) (call $gl32 (i32.add (local.get $state) (i32.const 25604))))
      (call $gs32 (i32.add (local.get $node) (i32.const 4)) (local.get $handle))
      (call $gs32 (i32.add (local.get $node) (i32.const 8)) (local.get $shader))
      (call $gs32 (i32.add (local.get $node) (i32.const 12)) (i32.const 1))
      (call $gs32 (i32.add (local.get $state) (i32.const 25604)) (local.get $node))
      ;; Convert the new external COM reference into internal device ownership.
      ;; This retains bytecode without a device <-> shader reference cycle.
      (call $gs32 (i32.add (local.get $shader) (i32.const 20)) (i32.const 1))
      (call $handle_IDirect3DShader9_Release (local.get $shader)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (local.get $name_ptr))
      (call $gs32 (local.get $arg2) (local.get $handle))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 16))))

  (func $handle_IDirect3DDevice8_GetPixelShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $shader i32) (local $node i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $arg1)) (then (return)))
    (local.set $state (call $d3d9_program_state (local.get $arg0)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $shader (call $gl32 (i32.add (local.get $state) (i32.const 4))))
    (if (i32.eqz (local.get $shader)) (then
      (call $gs32 (local.get $arg1) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $node (call $gl32 (i32.add (local.get $state) (i32.const 25604))))
    (block $done (loop $next
      (br_if $done (i32.eqz (local.get $node)))
      (if (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 8))) (local.get $shader)) (then
        (call $gs32 (local.get $arg1) (call $gl32 (i32.add (local.get $node) (i32.const 4))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
      (local.set $node (call $gl32 (local.get $node))) (br $next))))

  (func $handle_IDirect3DDevice8_SetPixelShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $node i32) (local $shader i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (local.get $arg1) (then
      (local.set $node (call $d3d8_pixel_handle (call $d3d9_program_state (local.get $arg0)) (local.get $arg1)))
      (if (i32.eqz (local.get $node)) (then (return)))
      (local.set $shader (call $gl32 (i32.add (local.get $node) (i32.const 8))))))
    (call $d3d9_shader_binding (local.get $arg0) (local.get $shader) (i32.const 1) (i32.const 0)))

  (func $handle_IDirect3DDevice8_DeletePixelShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $node i32) (local $shader i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $arg0)))
    (local.set $node (call $d3d8_pixel_handle (local.get $state) (local.get $arg1)))
    (if (i32.eqz (local.get $node)) (then (return)))
    (local.set $shader (call $gl32 (i32.add (local.get $node) (i32.const 8))))
    (if (i32.eq (call $gl32 (i32.add (local.get $state) (i32.const 4))) (local.get $shader)) (then
      (call $d3d9_shader_binding (local.get $arg0) (i32.const 0) (i32.const 1) (i32.const 0))))
    (call $gs32 (i32.add (local.get $node) (i32.const 12)) (i32.const 0))
    (call $d3d9_shader_unbind (local.get $shader))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirect3DDevice8_GetPixelShaderFunction (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $node i32) (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $node (call $d3d8_pixel_handle (call $d3d9_program_state (local.get $arg0)) (local.get $arg1)))
    (if (local.get $node) (then
      (call $handle_IDirect3DShader9_GetFunction (call $gl32 (i32.add (local.get $node) (i32.const 8)))
        (local.get $arg2) (local.get $arg3) (i32.const 0) (i32.const 0) (local.get $name_ptr))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 20))))

  ;; D3D9 inserted OffsetInBytes before Stride. D3D8 streams always begin at
  ;; byte zero, so supply that field and correct the delegated stack cleanup
  ;; from D3D9's six words back to D3D8's five.
  (func $handle_IDirect3DDevice8_SetStreamSource (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice9_SetStreamSource
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0) (local.get $arg3) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; D3D8 retains BaseVertexIndex at SetIndices time; D3D9 moved that value to
  ;; DrawIndexedPrimitive. Keep the value in the reserved word between the
  ;; common clear-color and point-scale fields and bind the index buffer
  ;; normally. D3D9 itself neither reads nor writes this word.
  (func $handle_IDirect3DDevice8_SetIndices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32)
    (call $d3d9_buffer_bind (local.get $arg0) (local.get $arg1)
      (i32.const 7) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then
      (local.set $state (call $d3d9_program_state (local.get $arg0)))
      (if (local.get $state) (then
        (call $gs32 (i32.add (local.get $state) (i32.const 1692)) (local.get $arg2))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; D3D8 keeps sampler controls in D3DTEXTURESTAGESTATETYPE. D3D9 moved
  ;; those same controls into D3DSAMPLERSTATETYPE, so forwarding the numeric
  ;; type to the D3D9 texture-stage handler rejected every address/filter call.
  ;; Return the D3D9 sampler-state number, or zero for a true shared TSS.
  (func $d3d8_sampler_type (param $type i32) (result i32)
    (if (result i32) (i32.lt_u (i32.sub (local.get $type) (i32.const 13)) (i32.const 2))
      (then (i32.sub (local.get $type) (i32.const 12)))
      (else (if (result i32) (i32.lt_u (i32.sub (local.get $type) (i32.const 15)) (i32.const 7))
        (then (i32.sub (local.get $type) (i32.const 11)))
        (else (select (i32.const 3) (i32.const 0)
          (i32.eq (local.get $type) (i32.const 25))))))))

  (func $handle_IDirect3DDevice8_GetTextureStageState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sampler i32)
    (local.set $sampler (call $d3d8_sampler_type (local.get $arg2)))
    (if (local.get $sampler)
      (then (call $d3d9_sampler_state (local.get $arg0) (local.get $arg1)
        (local.get $sampler) (local.get $arg3) (i32.const 1)))
      (else (if (i32.eq (local.get $arg2) (i32.const 32))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)))
        (else (call $d3d9_texture_stage_state (local.get $arg0) (local.get $arg1)
          (local.get $arg2) (local.get $arg3) (i32.const 1))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DDevice8_SetTextureStageState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sampler i32)
    (local.set $sampler (call $d3d8_sampler_type (local.get $arg2)))
    (if (local.get $sampler)
      (then (call $d3d9_sampler_state (local.get $arg0) (local.get $arg1)
        (local.get $sampler) (local.get $arg3) (i32.const 0)))
      (else (if (i32.eq (local.get $arg2) (i32.const 32))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c)))
        (else (call $d3d9_texture_stage_state (local.get $arg0) (local.get $arg1)
          (local.get $arg2) (local.get $arg3) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; D3D8 exposes only render target zero and binds its color/depth pair in a
  ;; single call. D3D9 split those operations and added a target index.
  (func $handle_IDirect3DDevice8_SetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_color_binding (local.get $arg0) (i32.const 0) (call $d3d8_surface_in (local.get $arg1)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $d3d9_depth_binding (local.get $arg0) (local.get $arg2) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DDevice8_GetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice9_GetRenderTarget
      (local.get $arg0) (i32.const 0) (local.get $arg1)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $d3d8_surface_out (local.get $arg1))
    (call $d3d8_view_track (local.get $arg0) (local.get $arg1)))

  ;; D3D8 surface creation has no MultisampleQuality, Discard or shared-handle
  ;; arguments. The backend renders single-sampled only, as its D3D9 creators
  ;; already require.
  ;; CreateRenderTarget(this, Width, Height, Format, MultiSample, Lockable, pp)
  (func $handle_IDirect3DDevice8_CreateRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $out i32)
    (local.set $out (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $arg4)) (then
      (call $d3d9_color_create (local.get $arg0) (local.get $arg1) (local.get $arg2)
        (local.get $arg3) (i32.const 0) (i32.const 1)
        (i32.ne (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (i32.const 0))
        (local.get $out))
      (call $d3d8_surface_out (local.get $out))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; CreateDepthStencilSurface(this, Width, Height, Format, MultiSample, pp)
  (func $handle_IDirect3DDevice8_CreateDepthStencilSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $out i32) (local $surface i32)
    (local.set $out (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (if (i32.eqz (local.get $out)) (then (return)))
    (call $gs32 (local.get $out) (i32.const 0))
    (if (local.get $arg4) (then (return)))
    (local.set $surface (call $d3d9_depth_new (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (i32.const 0) (i32.const 1)))
    (if (i32.eqz (local.get $surface)) (then (return)))
    (call $gs32 (local.get $out) (local.get $surface))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $d3d8_surface_out (local.get $out)))

  ;; CreateImageSurface(this, Width, Height, Format, pp): a lockable
  ;; system-memory surface, D3D9's CreateOffscreenPlainSurface in SYSTEMMEM.
  ;; The backend's colour surfaces are 32-bit, so a 16-bit image surface is an
  ;; X8R8G8B8 one presented through the same 16-bit view as the back buffer:
  ;; GetDesc reports the 16-bit format and LockRect converts. CopyRects into
  ;; the 16-bit device's back buffer is then a 32-bit copy on both sides.
  ;; LithTech builds its 2D menu screens from R5G6B5 image surfaces.
  (func $handle_IDirect3DDevice8_CreateImageSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $e i32) (local $surface i32)
    (if (call $d3d8_is_view_format (local.get $arg3))
      (then
        ;; Claim the view slot first (under a placeholder key no surface
        ;; pointer can equal), so a full table fails before anything exists.
        (local.set $e (call $d3d8_view_entry (i32.const 1) (i32.const 1)))
        (if (i32.eqz (local.get $e)) (then
          (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) ;; E_OUTOFMEMORY
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
          (return)))
        (call $d3d9_color_create (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (i32.const 22) (i32.const 2) (i32.const 0) (i32.const 1) (local.get $arg4))
        (call $zero_memory (call $g2w (local.get $e)) (i32.const 32))
        (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then
          (local.set $surface (call $gl32 (local.get $arg4)))
          (call $gs32 (local.get $e) (local.get $surface))
          (call $gs32 (i32.add (local.get $e) (i32.const 4)) (local.get $arg3)))))
      (else
        (call $d3d9_color_create (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (i32.const 2) (i32.const 0) (i32.const 1) (local.get $arg4))))
    (call $d3d8_surface_out (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IDirect3DDevice8_GetDepthStencilSurface(param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice9_GetDepthStencilSurface
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $d3d8_surface_out (local.get $arg1)))

  ;; ── IDirect3DSurface8 ──────────────────────────────────────────────
  ;; The D3D9 backend owns every surface. Heap surfaces (color, depth and
  ;; texture levels) are recognised by the tag at +12, so a D3D8 caller can
  ;; be handed the same object with the D3D8 vtable written in place. The
  ;; implicit back buffer is an 8-byte COM wrapper whose identity the backend
  ;; checks against its SURF9 wrapper, so D3D8 gets an aux wrapper on the same
  ;; slot instead, and every D3D8 entry point maps it back before use.
  (global $DX_VTBL_D3DSURF8 (mut i32) (i32.const 0))

  ;; --- The 16-bit back-buffer view ------------------------------------
  ;; A fullscreen R5G6B5 device's back buffer is an X8R8G8B8 surface in the
  ;; backend. Its D3D8 view reports R5G6B5 and locks through a 16-bit shadow:
  ;; LockRect converts the locked rectangle 32->16 into the shadow and hands
  ;; that out, UnlockRect converts it back unless the lock was read-only. The
  ;; table is keyed by the surface's D3D9 identity and filled where a 16-bit
  ;; device hands its back buffer out (GetBackBuffer/GetRenderTarget, which
  ;; also clears an entry when a 32-bit device's surface reuses the key) and
  ;; by CreateImageSurface for a 16-bit format (cleared by the final Release).
  ;; Entry (32 bytes): +0 key, +4 format, +8 shadow, +12 locked 32-bit bits,
  ;; +16 32-bit pitch, +20 lock flags (bit 31 = locked), +24 left|top<<16,
  ;; +28 right|bottom<<16.
  (global $d3d8_view_table (mut i32) (i32.const 0))
  (global $D3D8_VIEW_ENTRIES i32 (i32.const 64))

  (func $d3d8_device_is_16bit (param $device i32) (result i32)
    (local $state i32)
    (if (i32.eqz (local.get $device)) (then (return (i32.const 0))))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (i32.eq (call $gl32 (i32.add (local.get $state) (i32.const 20660)))
      (global.get $D3D8_FMT_R5G6B5)))

  ;; The view entry for $key, or 0. With $create, a free entry is claimed.
  (func $d3d8_view_entry (param $key i32) (param $create i32) (result i32)
    (local $i i32) (local $e i32) (local $free i32)
    (if (i32.eqz (local.get $key)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $d3d8_view_table)) (then
      (if (i32.eqz (local.get $create)) (then (return (i32.const 0))))
      (global.set $d3d8_view_table
        (call $heap_alloc (i32.mul (global.get $D3D8_VIEW_ENTRIES) (i32.const 32))))
      (if (i32.eqz (global.get $d3d8_view_table)) (then (return (i32.const 0))))
      (call $zero_memory (call $g2w (global.get $d3d8_view_table))
        (i32.mul (global.get $D3D8_VIEW_ENTRIES) (i32.const 32)))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $D3D8_VIEW_ENTRIES)))
      (local.set $e (i32.add (global.get $d3d8_view_table) (i32.shl (local.get $i) (i32.const 5))))
      (if (i32.eq (call $gl32 (local.get $e)) (local.get $key)) (then (return (local.get $e))))
      (if (i32.and (i32.eqz (local.get $free)) (i32.eqz (call $gl32 (local.get $e))))
        (then (local.set $free (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.and (local.get $create) (i32.ne (local.get $free) (i32.const 0))) (then
      (call $zero_memory (call $g2w (local.get $free)) (i32.const 32))
      (call $gs32 (local.get $free) (local.get $key))
      (return (local.get $free))))
    (i32.const 0))

  ;; After GetBackBuffer/GetRenderTarget stored a surface at $out: view it as
  ;; 16-bit when the device is, and forget any stale view otherwise.
  (func $d3d8_view_track (param $device i32) (param $out i32)
    (local $surface i32) (local $e i32)
    (if (i32.or (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0))
                (i32.eqz (local.get $out))) (then (return)))
    (local.set $surface (call $d3d8_surface_in (call $gl32 (local.get $out))))
    (if (i32.eqz (local.get $surface)) (then (return)))
    (if (i32.and (call $d3d8_device_is_16bit (local.get $device))
          (i32.eq (load.field DxObject type (call $dx_from_this (local.get $surface))) (i32.const 2)))
      (then
        (local.set $e (call $d3d8_view_entry (local.get $surface) (i32.const 1)))
        (if (local.get $e) (then
          (call $gs32 (i32.add (local.get $e) (i32.const 4)) (global.get $D3D8_FMT_R5G6B5))))
        (return)))
    (local.set $e (call $d3d8_view_entry (local.get $surface) (i32.const 0)))
    (if (local.get $e) (then
      (if (call $gl32 (i32.add (local.get $e) (i32.const 8)))
        (then (call $heap_free (call $gl32 (i32.add (local.get $e) (i32.const 8))))))
      (call $zero_memory (call $g2w (local.get $e)) (i32.const 32)))))

  ;; X8R8G8B8 <-> R5G6B5, replicating the high bits on the way up.
  (func $d3d8_rgb565_from_x8 (param $p i32) (result i32)
    (i32.or (i32.or
      (i32.and (i32.shr_u (local.get $p) (i32.const 8)) (i32.const 0xf800))
      (i32.and (i32.shr_u (local.get $p) (i32.const 5)) (i32.const 0x07e0)))
      (i32.and (i32.shr_u (local.get $p) (i32.const 3)) (i32.const 0x001f))))
  (func $d3d8_x8_from_rgb565 (param $v i32) (result i32)
    (local $r i32) (local $g i32) (local $b i32)
    (local.set $r (i32.and (i32.shr_u (local.get $v) (i32.const 11)) (i32.const 0x1f)))
    (local.set $g (i32.and (i32.shr_u (local.get $v) (i32.const 5)) (i32.const 0x3f)))
    (local.set $b (i32.and (local.get $v) (i32.const 0x1f)))
    (local.set $r (i32.or (i32.shl (local.get $r) (i32.const 3)) (i32.shr_u (local.get $r) (i32.const 2))))
    (local.set $g (i32.or (i32.shl (local.get $g) (i32.const 2)) (i32.shr_u (local.get $g) (i32.const 4))))
    (local.set $b (i32.or (i32.shl (local.get $b) (i32.const 3)) (i32.shr_u (local.get $b) (i32.const 2))))
    (i32.or (i32.const 0xff000000)
      (i32.or (i32.shl (local.get $r) (i32.const 16))
        (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b)))))

  ;; X8R8G8B8 <-> X1R5G5B5/A1R5G5B5. The alpha bit maps to 0x00/0xff, and an
  ;; X1 format keeps its top bit clear on the way down.
  (func $d3d8_rgb555_from_x8 (param $format i32) (param $p i32) (result i32)
    (local $v i32)
    (local.set $v (i32.or (i32.or
      (i32.and (i32.shr_u (local.get $p) (i32.const 9)) (i32.const 0x7c00))
      (i32.and (i32.shr_u (local.get $p) (i32.const 6)) (i32.const 0x03e0)))
      (i32.and (i32.shr_u (local.get $p) (i32.const 3)) (i32.const 0x001f))))
    (if (i32.and (i32.eq (local.get $format) (global.get $D3D8_FMT_A1R5G5B5))
          (i32.ne (i32.and (local.get $p) (i32.const 0x80000000)) (i32.const 0)))
      (then (local.set $v (i32.or (local.get $v) (i32.const 0x8000)))))
    (local.get $v))
  (func $d3d8_x8_from_rgb555 (param $format i32) (param $v i32) (result i32)
    (local $r i32) (local $g i32) (local $b i32) (local $a i32)
    (local.set $r (i32.and (i32.shr_u (local.get $v) (i32.const 10)) (i32.const 0x1f)))
    (local.set $g (i32.and (i32.shr_u (local.get $v) (i32.const 5)) (i32.const 0x1f)))
    (local.set $b (i32.and (local.get $v) (i32.const 0x1f)))
    (local.set $r (i32.or (i32.shl (local.get $r) (i32.const 3)) (i32.shr_u (local.get $r) (i32.const 2))))
    (local.set $g (i32.or (i32.shl (local.get $g) (i32.const 3)) (i32.shr_u (local.get $g) (i32.const 2))))
    (local.set $b (i32.or (i32.shl (local.get $b) (i32.const 3)) (i32.shr_u (local.get $b) (i32.const 2))))
    (local.set $a (i32.const 0xff000000))
    (if (i32.and (i32.eq (local.get $format) (global.get $D3D8_FMT_A1R5G5B5))
          (i32.eqz (i32.and (local.get $v) (i32.const 0x8000))))
      (then (local.set $a (i32.const 0))))
    (i32.or (local.get $a)
      (i32.or (i32.shl (local.get $r) (i32.const 16))
        (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b)))))

  ;; The 16-bit formats a view can present over a 32-bit backend surface.
  (func $d3d8_is_view_format (param $format i32) (result i32)
    (i32.or (i32.eq (local.get $format) (global.get $D3D8_FMT_R5G6B5))
      (i32.or (i32.eq (local.get $format) (global.get $D3D8_FMT_X1R5G5B5))
              (i32.eq (local.get $format) (global.get $D3D8_FMT_A1R5G5B5)))))

  ;; A viewed surface's size: heap colour surfaces (image surfaces) carry it
  ;; in their header, the implicit back buffer in its DxObject.
  (func $d3d8_view_width (param $surface i32) (result i32)
    (if (result i32) (call $d3d9_is_color_surface (local.get $surface))
      (then (call $gl32 (i32.add (local.get $surface) (i32.const 20))))
      (else (load.field DxObject width (call $dx_from_this (local.get $surface))))))
  (func $d3d8_view_height (param $surface i32) (result i32)
    (if (result i32) (call $d3d9_is_color_surface (local.get $surface))
      (then (call $gl32 (i32.add (local.get $surface) (i32.const 24))))
      (else (load.field DxObject height (call $dx_from_this (local.get $surface))))))

  ;; Drop $surface's view, if any, and its shadow.
  (func $d3d8_view_forget (param $surface i32)
    (local $e i32)
    (local.set $e (call $d3d8_view_entry (local.get $surface) (i32.const 0)))
    (if (i32.eqz (local.get $e)) (then (return)))
    (if (call $gl32 (i32.add (local.get $e) (i32.const 8)))
      (then (call $heap_free (call $gl32 (i32.add (local.get $e) (i32.const 8))))))
    (call $zero_memory (call $g2w (local.get $e)) (i32.const 32)))

  ;; Copy the locked rectangle between the 32-bit lock and the 16-bit shadow:
  ;; $up = 0 converts 32->16 (lock), 1 converts 16->32 (unlock).
  (func $d3d8_view_convert (param $e i32) (param $width i32) (param $up i32)
    (local $format i32)
    (local $bits i32) (local $pitch i32) (local $shadow i32)
    (local $l i32) (local $t i32) (local $w i32) (local $h i32) (local $x i32) (local $y i32)
    (local $src i32) (local $dst i32)
    (local.set $format (call $gl32 (i32.add (local.get $e) (i32.const 4))))
    (local.set $shadow (call $gl32 (i32.add (local.get $e) (i32.const 8))))
    (local.set $bits (call $gl32 (i32.add (local.get $e) (i32.const 12))))
    (local.set $pitch (call $gl32 (i32.add (local.get $e) (i32.const 16))))
    (local.set $l (call $gl16 (i32.add (local.get $e) (i32.const 24))))
    (local.set $t (call $gl16 (i32.add (local.get $e) (i32.const 26))))
    (local.set $w (i32.sub (call $gl16 (i32.add (local.get $e) (i32.const 28))) (local.get $l)))
    (local.set $h (i32.sub (call $gl16 (i32.add (local.get $e) (i32.const 30))) (local.get $t)))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_s (local.get $y) (local.get $h)))
      (local.set $src (i32.add (local.get $bits) (i32.mul (local.get $y) (local.get $pitch))))
      (local.set $dst (i32.add (local.get $shadow)
        (i32.shl (i32.add (i32.mul (i32.add (local.get $t) (local.get $y)) (local.get $width))
                          (local.get $l)) (i32.const 1))))
      (local.set $x (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_s (local.get $x) (local.get $w)))
        (if (local.get $up)
          (then (call $gs32 (i32.add (local.get $src) (i32.shl (local.get $x) (i32.const 2)))
            (if (result i32) (i32.eq (local.get $format) (global.get $D3D8_FMT_R5G6B5))
              (then (call $d3d8_x8_from_rgb565
                (call $gl16 (i32.add (local.get $dst) (i32.shl (local.get $x) (i32.const 1))))))
              (else (call $d3d8_x8_from_rgb555 (local.get $format)
                (call $gl16 (i32.add (local.get $dst) (i32.shl (local.get $x) (i32.const 1)))))))))
          (else (call $gs16 (i32.add (local.get $dst) (i32.shl (local.get $x) (i32.const 1)))
            (if (result i32) (i32.eq (local.get $format) (global.get $D3D8_FMT_R5G6B5))
              (then (call $d3d8_rgb565_from_x8
                (call $gl32 (i32.add (local.get $src) (i32.shl (local.get $x) (i32.const 2))))))
              (else (call $d3d8_rgb555_from_x8 (local.get $format)
                (call $gl32 (i32.add (local.get $src) (i32.shl (local.get $x) (i32.const 2))))))))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br $cols)))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $rows))))

  ;; After the backend locked $surface into the D3DLOCKED_RECT at $locked:
  ;; fill the shadow and hand it out instead.
  (func $d3d8_view_lock (param $e i32) (param $surface i32) (param $locked i32)
        (param $rect i32) (param $flags i32)
    (local $entry i32) (local $width i32) (local $height i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32)
    (local.set $width (call $d3d8_view_width (local.get $surface)))
    (local.set $height (call $d3d8_view_height (local.get $surface)))
    (local.set $r (local.get $width))
    (local.set $b (local.get $height))
    (if (local.get $rect) (then
      (local.set $l (call $gl32 (local.get $rect)))
      (local.set $t (call $gl32 (i32.add (local.get $rect) (i32.const 4))))
      (local.set $r (call $gl32 (i32.add (local.get $rect) (i32.const 8))))
      (local.set $b (call $gl32 (i32.add (local.get $rect) (i32.const 12))))))
    ;; The backend already accepted the rect; keep the shadow walk inside the
    ;; surface regardless.
    (if (i32.gt_u (local.get $r) (local.get $width)) (then (local.set $r (local.get $width))))
    (if (i32.gt_u (local.get $b) (local.get $height)) (then (local.set $b (local.get $height))))
    (if (i32.gt_u (local.get $l) (local.get $r)) (then (local.set $l (local.get $r))))
    (if (i32.gt_u (local.get $t) (local.get $b)) (then (local.set $t (local.get $b))))
    (if (i32.eqz (call $gl32 (i32.add (local.get $e) (i32.const 8)))) (then
      (call $gs32 (i32.add (local.get $e) (i32.const 8))
        (call $heap_alloc (i32.shl (i32.mul (local.get $width) (local.get $height)) (i32.const 1))))))
    (if (i32.eqz (call $gl32 (i32.add (local.get $e) (i32.const 8)))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) (return))) ;; E_OUTOFMEMORY
    (call $gs32 (i32.add (local.get $e) (i32.const 12)) (call $gl32 (i32.add (local.get $locked) (i32.const 4))))
    (call $gs32 (i32.add (local.get $e) (i32.const 16)) (call $gl32 (local.get $locked)))
    (call $gs32 (i32.add (local.get $e) (i32.const 20)) (i32.or (local.get $flags) (i32.const 0x80000000)))
    (call $gs32 (i32.add (local.get $e) (i32.const 24))
      (i32.or (local.get $l) (i32.shl (local.get $t) (i32.const 16))))
    (call $gs32 (i32.add (local.get $e) (i32.const 28))
      (i32.or (local.get $r) (i32.shl (local.get $b) (i32.const 16))))
    (call $d3d8_view_convert (local.get $e) (local.get $width) (i32.const 0))
    (call $gs32 (local.get $locked) (i32.shl (local.get $width) (i32.const 1)))
    (call $gs32 (i32.add (local.get $locked) (i32.const 4))
      (i32.add (call $gl32 (i32.add (local.get $e) (i32.const 8)))
        (i32.shl (i32.add (i32.mul (local.get $t) (local.get $width)) (local.get $l)) (i32.const 1)))))

  ;; Before the backend unlocks: write the shadow back unless read-only.
  (func $d3d8_view_unlock (param $e i32) (param $surface i32)
    (local $flags i32)
    (local.set $flags (call $gl32 (i32.add (local.get $e) (i32.const 20))))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x80000000))) (then (return)))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x10))) ;; D3DLOCK_READONLY
      (then (call $d3d8_view_convert (local.get $e)
        (call $d3d8_view_width (local.get $surface)) (i32.const 1))))
    (call $gs32 (i32.add (local.get $e) (i32.const 20)) (i32.const 0)))

  (func $d3d8_surface_vtbl (result i32)
    (if (i32.eqz (global.get $DX_VTBL_D3DSURF8)) (then
      (global.set $DX_VTBL_D3DSURF8
        (call $init_com_vtable (global.get $API_ID_IDirect3DSurface8_BASE) (i32.const 11)))))
    (global.get $DX_VTBL_D3DSURF8))

  (func $d3d8_is_heap_surface (param $surface i32) (result i32)
    (i32.or (call $d3d9_is_texture_surface (local.get $surface))
      (i32.or (call $d3d9_is_color_surface (local.get $surface))
              (call $d3d9_is_depth_surface (local.get $surface)))))

  ;; After a successful D3D9 call stored a surface at `out`, give the caller
  ;; the D3D8 view of it.
  (func $d3d8_surface_out (param $out i32)
    (local $surface i32)
    (if (i32.or (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0)) (i32.eqz (local.get $out))) (then (return)))
    (local.set $surface (call $gl32 (local.get $out)))
    (if (i32.eqz (local.get $surface)) (then (return)))
    (if (call $d3d8_is_heap_surface (local.get $surface)) (then
      (call $gs32 (local.get $surface) (call $d3d8_surface_vtbl))
      (return)))
    (call $gs32 (local.get $out)
      (call $dx_get_wrapper_for_vtbl
        (call $dx_slot_of (call $dx_from_this (local.get $surface)))
        (call $d3d8_surface_vtbl))))

  ;; The D3D9 identity of a surface pointer a D3D8 caller passed in. Keyed on
  ;; "not the SURF9 wrapper" rather than on this instance's SURF8 vtable, so
  ;; an aux wrapper made by another guest thread's instance maps back too.
  (func $d3d8_surface_in (param $surface i32) (result i32)
    (if (i32.eqz (local.get $surface)) (then (return (i32.const 0))))
    (if (call $d3d8_is_heap_surface (local.get $surface)) (then (return (local.get $surface))))
    (if (i32.eq (call $gl32 (local.get $surface)) (global.get $DX_VTBL_D3DSURF9))
      (then (return (local.get $surface))))
    (call $dx_get_wrapper_for_vtbl
      (call $dx_slot_of (call $dx_from_this (local.get $surface)))
      (global.get $DX_VTBL_D3DSURF9)))

  ;; D3D9 SURFACE_DESC: Format Type Usage Pool MultiSampleType
  ;; MultiSampleQuality Width Height. D3D8 replaces the fifth field with the
  ;; surface's byte Size and moves MultiSampleType into the sixth.
  (func $d3d8_desc_from_d3d9 (param $desc i32)
    (local $wa i32) (local $format i32) (local $width i32) (local $height i32) (local $size i32)
    (if (i32.or (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0)) (i32.eqz (local.get $desc))) (then (return)))
    (local.set $wa (call $g2w (local.get $desc)))
    (local.set $format (i32.load (local.get $wa)))
    (local.set $width (i32.load offset=24 (local.get $wa)))
    (local.set $height (i32.load offset=28 (local.get $wa)))
    (local.set $size
      (if (result i32) (i32.eq (local.get $format) (i32.const 80)) ;; D16
        (then (i32.mul (i32.mul (local.get $width) (local.get $height)) (i32.const 2)))
        (else (i32.mul (call $d3d9_texture_pitch (local.get $width) (local.get $format))
                       (call $d3d9_texture_rows (local.get $height) (local.get $format))))))
    (i32.store offset=20 (local.get $wa) (i32.load offset=16 (local.get $wa)))
    (i32.store offset=16 (local.get $wa) (local.get $size)))

  (func $handle_IDirect3DSurface8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lo i64) (local $hi i64) (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
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
        (i32.and (i64.eq (local.get $lo) (i64.const 0x4ea5b326b96eebca)) (i64.eq (local.get $hi) (i64.const 0xdd21e0baf52f2f88))))))
      (call $handle_IDirect3DSurface9_AddRef (call $d3d8_surface_in (local.get $arg0))
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (local.get $name_ptr))
      (call $gs32 (local.get $arg2) (local.get $arg0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 16))))
  (func $handle_IDirect3DSurface8_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DSurface9_AddRef (call $d3d8_surface_in (local.get $arg0))
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IDirect3DSurface8_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $surface i32)
    (local.set $surface (call $d3d8_surface_in (local.get $arg0)))
    (call $handle_IDirect3DSurface9_Release (local.get $surface)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (global.get $d3d_render_token) (then (return)))
    ;; A freed image surface's address is reused by later allocations, so its
    ;; view must not outlive it. (A back buffer's view is re-made by every
    ;; GetBackBuffer, so forgetting one costs nothing.)
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $d3d8_view_forget (local.get $surface)))))
  (func $handle_IDirect3DSurface8_GetDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DSurface9_GetDevice (call $d3d8_surface_in (local.get $arg0))
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IDirect3DSurface8_SetPrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DSurface9_SetPrivateData (call $d3d8_surface_in (local.get $arg0))
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IDirect3DSurface8_GetPrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DSurface9_GetPrivateData (call $d3d8_surface_in (local.get $arg0))
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IDirect3DSurface8_FreePrivateData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DSurface9_FreePrivateData (call $d3d8_surface_in (local.get $arg0))
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IDirect3DSurface8_GetContainer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $parent i32)
    (if (call $d3d9_is_texture_surface (local.get $arg0)) (then
      (local.set $parent (call $gl32 (i32.add (local.get $arg0) (i32.const 8))))
      (if (i32.eq (call $gl32 (i32.add (local.get $parent) (i32.const 12))) (i32.const 5)) (then
        (call $handle_IDirect3DCubeTexture8_QueryInterface (local.get $parent)
          (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (return)))))
    (call $handle_IDirect3DSurface9_GetContainer (call $d3d8_surface_in (local.get $arg0))
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IDirect3DSurface8_GetDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $surface i32) (local $e i32)
    (local.set $surface (call $d3d8_surface_in (local.get $arg0)))
    (call $handle_IDirect3DSurface9_GetDesc (local.get $surface)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $d3d8_desc_from_d3d9 (local.get $arg1))
    ;; D3D8 SURFACE_DESC: Format +0, Size +16, Width +24, Height +28.
    (local.set $e (call $d3d8_view_entry (local.get $surface) (i32.const 0)))
    (if (i32.and (i32.ne (local.get $e) (i32.const 0))
          (i32.and (i32.eqz (i32.load offset=0 (global.get $reg_base)))
                   (i32.ne (local.get $arg1) (i32.const 0)))) (then
      (call $gs32 (local.get $arg1) (call $gl32 (i32.add (local.get $e) (i32.const 4))))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 16))
        (i32.shl (i32.mul (call $gl32 (i32.add (local.get $arg1) (i32.const 24)))
                          (call $gl32 (i32.add (local.get $arg1) (i32.const 28)))) (i32.const 1))))))
  (func $handle_IDirect3DSurface8_LockRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $surface i32) (local $e i32)
    (local.set $surface (call $d3d8_surface_in (local.get $arg0)))
    (call $handle_IDirect3DSurface9_LockRect (local.get $surface)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    ;; A lock handed to the render worker re-enters this handler when done.
    (if (global.get $d3d_render_token) (then (return)))
    (local.set $e (call $d3d8_view_entry (local.get $surface) (i32.const 0)))
    (if (i32.and (i32.ne (local.get $e) (i32.const 0))
          (i32.and (i32.eqz (i32.load offset=0 (global.get $reg_base)))
                   (i32.ne (local.get $arg1) (i32.const 0))))
      (then (call $d3d8_view_lock (local.get $e) (local.get $surface)
        (local.get $arg1) (local.get $arg2) (local.get $arg3)))))
  (func $handle_IDirect3DSurface8_UnlockRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $surface i32) (local $e i32)
    (local.set $surface (call $d3d8_surface_in (local.get $arg0)))
    (local.set $e (call $d3d8_view_entry (local.get $surface) (i32.const 0)))
    (if (local.get $e) (then (call $d3d8_view_unlock (local.get $e) (local.get $surface))))
    (call $handle_IDirect3DSurface9_UnlockRect (local.get $surface)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirect3DTexture8_GetLevelDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_GetLevelDesc (local.get $arg0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $d3d8_desc_from_d3d9 (local.get $arg2)))

  (func $handle_IDirect3DTexture8_GetSurfaceLevel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DTexture9_GetSurfaceLevel (local.get $arg0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $d3d8_surface_out (local.get $arg2)))

  ;; D3D8 CreateTexture is D3D9 CreateTexture without the final shared-handle
  ;; parameter. Feed its otherwise identical fields to the common allocator.
  (func $handle_IDirect3DDevice8_CreateTexture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $out i32) (local $texture i32)
    (local.set $out (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    (call $d3d9_texture_create
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
      (local.get $out))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then
      (local.set $texture (call $gl32 (local.get $out)))
      (if (local.get $texture) (then
        (if (i32.eqz (global.get $DX_VTBL_D3DTEX8)) (then
          (global.set $DX_VTBL_D3DTEX8
            (call $init_com_vtable (global.get $API_ID_IDirect3DTexture8_BASE) (i32.const 19)))))
        (call $gs32 (local.get $texture) (global.get $DX_VTBL_D3DTEX8))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; Cube8 has the same storage as Cube9, but its 19-slot ABI omits the three
  ;; D3D9 autogen methods. Surface descriptors and returned surfaces also
  ;; retain the D3D8 layout. Shared helpers own face/mip storage and lifetime.
  (func $handle_IDirect3DDevice8_CreateCubeTexture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $out i32) (local $texture i32)
    (local.set $out (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (call $d3d9_texture_create_kind (local.get $arg0) (local.get $arg1) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (local.get $out) (i32.const 5))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then
      (local.set $texture (call $gl32 (local.get $out)))
      (if (local.get $texture) (then
        (if (i32.eqz (global.get $DX_VTBL_D3DCUBE8)) (then
          (global.set $DX_VTBL_D3DCUBE8
            (call $init_com_vtable (global.get $API_ID_IDirect3DCubeTexture8_BASE) (i32.const 19)))))
        (call $gs32 (local.get $texture) (global.get $DX_VTBL_D3DCUBE8))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_IDirect3DCubeTexture8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lo i64) (local $hi i64)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
    (if (i32.eqz (local.get $arg2)) (then (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1)) (then (return)))
    (local.set $lo (i64.load (call $g2w (local.get $arg1))))
    (local.set $hi (i64.load offset=8 (call $g2w (local.get $arg1))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
    ;; IUnknown, Resource8, BaseTexture8, CubeTexture8. Never return a Cube8
    ;; vtable for a D3D9 IID, whose later method slots are incompatible.
    (if (i32.or
      (i32.or
        (i32.and (i64.eq (local.get $lo) (i64.const 0)) (i64.eq (local.get $hi) (i64.const 0x46000000000000c0)))
        (i32.and (i64.eq (local.get $lo) (i64.const 0x410a09b71b36bb7b)) (i64.eq (local.get $hi) (i64.const 0x3fb3d730147d45b4))))
      (i32.or
        (i32.and (i64.eq (local.get $lo) (i64.const 0x4a9f51b9b4211cfa)) (i64.eq (local.get $hi) (i64.const 0x8e67bbb299db78ab)))
        (i32.and (i64.eq (local.get $lo) (i64.const 0x4c342aca3ee5b968)) (i64.eq (local.get $hi) (i64.const 0x50b7193d0c7eb58b)))))
      (then
        (drop (call $d3d9_shader_addref (local.get $arg0)))
        (call $gs32 (local.get $arg2) (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))))

  (func $handle_IDirect3DCubeTexture8_GetLevelDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DCubeTexture9_GetLevelDesc (local.get $arg0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $d3d8_desc_from_d3d9 (local.get $arg2)))

  (func $handle_IDirect3DCubeTexture8_GetCubeMapSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DCubeTexture9_GetCubeMapSurface (local.get $arg0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $d3d8_surface_out (local.get $arg3)))

  ;; D3D8 vertex/index buffer creation has the same fields as D3D9 except for
  ;; D3D9's trailing shared-handle pointer. Allocate the common buffer object
  ;; directly so the six-argument D3D8 stdcall frame is consumed exactly.
  (func $handle_IDirect3DDevice8_CreateVertexBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_buffer_create (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (i32.const 6))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_IDirect3DDevice8_CreateIndexBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_buffer_create (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (i32.const 7))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; Pair D3D8's retained SetIndices base with every indexed draw while
  ;; preserving the common D3D9 async draw protocol.
  (func $handle_IDirect3DDevice8_DrawIndexedPrimitive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $base i32)
    (local.set $state (call $d3d9_program_state (local.get $arg0)))
    (if (local.get $state) (then
      (local.set $base (call $gl32 (i32.add (local.get $state) (i32.const 1692))))))
    (call $d3d9_draw_buffer (local.get $arg0) (local.get $arg1) (local.get $base)
      (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (i32.const 1))
    (if (global.get $d3d_render_token) (then (return)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; Convert the Direct3D 8 declaration token stream into D3DVERTEXELEMENT9.
  ;; FLOAT1..4/D3DCOLOR streams retain their explicit input registers for a
  ;; program, or fixed-function semantics for a declaration-only handle.
  (func $handle_IDirect3DDevice8_CreateVertexShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src i32) (local $tmp i32) (local $elem i32) (local $token i32)
    (local $stream i32) (local $offset i32) (local $dtype i32) (local $reg i32)
    (local $usage i32) (local $usage_index i32) (local $size i32)
    (local $count i32) (local $elements i32) (local $declaration i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg3))) (then (return)))
    (local.set $tmp (call $heap_alloc (i32.const 152)))
    (if (i32.eqz (local.get $tmp))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) (return)))
    (local.set $src (call $g2w (local.get $arg1)))
    (call $zero_memory (i32.add (call $g2w (local.get $tmp)) (i32.const 136)) (i32.const 16))
    (block $finish (loop $tokens
      (if (i32.ge_u (local.get $count) (i32.const 32))
        (then (call $heap_free (local.get $tmp)) (return)))
      (local.set $token (i32.load (i32.add (local.get $src) (i32.mul (local.get $count) (i32.const 4)))))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (if (i32.eq (local.get $token) (i32.const 0xffffffff)) (then (br $finish)))
      (if (i32.eq (i32.and (local.get $token) (i32.const 0xf0000000)) (global.get $D3D8_DECL_TOKEN_STREAM))
        (then
          (local.set $stream (i32.and (local.get $token) (i32.const 0xf)))
          ;; D3D8 exposes the same sixteen stream selectors now implemented by
          ;; the common D3D9 binding table. Preserve the selector: UT2003's
          ;; terrain declaration splits position/normal/colors/UVs over 0..4.
          (if (i32.ge_u (local.get $stream) (i32.const 16))
            (then (call $heap_free (local.get $tmp)) (return)))
          (local.set $offset (i32.const 0))
          (br $tokens)))
      (if (i32.ne (i32.and (local.get $token) (i32.const 0xf0000000)) (i32.const 0x40000000))
        (then (call $heap_free (local.get $tmp)) (return)))
      (local.set $dtype (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 0xf)))
      (local.set $reg (i32.and (local.get $token) (i32.const 0x1f)))
      (if (i32.or (i32.gt_u (local.get $dtype) (i32.const 4))
            (i32.gt_u (local.get $reg) (i32.const 16)))
        (then (call $heap_free (local.get $tmp)) (return)))
      (local.set $usage_index (i32.const 0))
      (local.set $usage
        (if (result i32) (i32.eqz (local.get $reg)) (then (i32.const 0))
          (else (if (result i32) (i32.eq (local.get $reg) (i32.const 1)) (then (i32.const 1))
            (else (if (result i32) (i32.eq (local.get $reg) (i32.const 2)) (then (i32.const 2))
              (else (if (result i32) (i32.eq (local.get $reg) (i32.const 3)) (then (i32.const 3))
                (else (if (result i32) (i32.eq (local.get $reg) (i32.const 4)) (then (i32.const 4))
                  (else (if (result i32) (i32.lt_u (local.get $reg) (i32.const 7))
                    (then (local.set $usage_index (i32.sub (local.get $reg) (i32.const 5))) (i32.const 10))
                    (else (if (result i32) (i32.lt_u (local.get $reg) (i32.const 15))
                      (then (local.set $usage_index (i32.sub (local.get $reg) (i32.const 7))) (i32.const 5))
                      (else (if (result i32) (i32.eq (local.get $reg) (i32.const 15))
                        (then (local.set $usage_index (i32.const 1)) (i32.const 0))
                        (else (local.set $usage_index (i32.const 1)) (i32.const 3))))))))))))))))))
      (if (i32.ge_u (local.get $elements) (i32.const 16))
        (then (call $heap_free (local.get $tmp)) (return)))
      (i32.store8 (i32.add (call $g2w (local.get $tmp))
        (i32.add (i32.const 136) (local.get $elements))) (local.get $reg))
      (local.set $elem (i32.add (call $g2w (local.get $tmp))
        (i32.mul (local.get $elements) (i32.const 8))))
      (i32.store16 (local.get $elem) (local.get $stream))
      (i32.store16 offset=2 (local.get $elem) (local.get $offset))
      (i32.store8 offset=4 (local.get $elem) (local.get $dtype))
      (i32.store8 offset=5 (local.get $elem) (i32.const 0))
      (i32.store8 offset=6 (local.get $elem) (local.get $usage))
      (i32.store8 offset=7 (local.get $elem) (local.get $usage_index))
      (local.set $elements (i32.add (local.get $elements) (i32.const 1)))
      (local.set $size
        (if (result i32) (i32.eqz (local.get $dtype)) (then (i32.const 4))
          (else (if (result i32) (i32.eq (local.get $dtype) (i32.const 1)) (then (i32.const 8))
            (else (if (result i32) (i32.eq (local.get $dtype) (i32.const 2)) (then (i32.const 12))
              (else
                (if (result i32) (i32.eq (local.get $dtype) (i32.const 3))
                  (then (i32.const 16)) (else (i32.const 4))))))))))
      (local.set $offset (i32.add (local.get $offset) (local.get $size)))
      (br $tokens)))
    (local.set $elem (i32.add (call $g2w (local.get $tmp))
      (i32.mul (local.get $elements) (i32.const 8))))
    (i32.store (local.get $elem) (i32.const 0x000000ff))
    (i32.store offset=4 (local.get $elem) (i32.const 0x00000011))
    (call $d3d9_declaration_create_mapped (local.get $arg0) (local.get $tmp) (local.get $arg3)
      (select (i32.add (local.get $tmp) (i32.const 136)) (i32.const 0)
        (i32.ne (local.get $arg2) (i32.const 0))))
    (call $heap_free (local.get $tmp))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then
      (local.set $declaration (call $gl32 (local.get $arg3)))
      (call $d3d8_vertex_handle_create (local.get $arg0) (local.get $declaration)
        (local.get $arg2) (local.get $arg1) (i32.shl (local.get $count) (i32.const 2))
        (local.get $arg3)))))

  (func $handle_IDirect3DDevice8_DeleteVertexShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $node i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876086c))
    (local.set $state (call $d3d9_program_state (local.get $arg0)))
    (local.set $node (call $d3d8_vertex_handle (local.get $state) (local.get $arg1)))
    (if (local.get $node) (then
      (if (i32.eqz (call $gl32 (i32.add (local.get $node) (i32.const 12)))) (then (return)))
      (if (i32.and
        (i32.eq (call $gl32 (local.get $state)) (call $gl32 (i32.add (local.get $node) (i32.const 8))))
        (i32.eq (call $gl32 (i32.add (local.get $state) (i32.const 8)))
          (call $gl32 (i32.add (local.get $node) (i32.const 16))))) (then
        (call $d3d9_shader_binding (local.get $arg0) (i32.const 0) (i32.const 0) (i32.const 0))
        (call $d3d9_declaration_bind (local.get $arg0) (i32.const 0))))
      (call $gs32 (i32.add (local.get $node) (i32.const 12)) (i32.const 0))
      (call $d3d9_shader_unbind (call $gl32 (i32.add (local.get $node) (i32.const 8))))
      (call $d3d9_shader_unbind (call $gl32 (i32.add (local.get $node) (i32.const 16))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return))))
