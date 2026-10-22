 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32) (local $clsid_d1 i32) (local $obj_guest i32)
    (local $clsid_wa i32) (local $iid_wa i32) (local $local_class i32)
    ;; Short-circuit CLSID_DirectDrawFactory {4FD2A832-86C8-11D0-8FCA-00C04FD9189D}
    ;; from ddrawex.dll. Used by CORBIS/FASHION/HORROR/WOTRAVEL screensavers; we
    ;; manufacture an IDirectDrawFactory directly so the guest never needs the DLL.
    ;; Translate each input GUID once. The host fallback below receives these
    ;; same addresses; local classes compare all 128 bits in-place.
    (if (local.get $arg0)
      (then (local.set $clsid_wa (call $g2w (local.get $arg0)))))
    (if (local.get $arg3)
      (then (local.set $iid_wa (call $g2w (local.get $arg3)))))
    (if (local.get $clsid_wa)
      (then (local.set $clsid_d1 (i32.load (local.get $clsid_wa)))))

    ;; The eight Win98-era classes below have complete local
    ;; QueryInterface contracts. Classify by full CLSID, manufacture one
    ;; factory-owned reference, query the requested interface, then release
    ;; that temporary reference on both success and failure.
    ;; CLSID_DirectPlay {D1EB6D20-8923-11D0-9D97-00A0C90A43CB}.
    (if (local.get $clsid_wa) (then
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0xD1EB6D20) (i32.const 0x11D08923)
            (i32.const 0xA000979D) (i32.const 0xCB430AC9))
        (then (local.set $local_class (i32.const 1))))
      ;; CLSID_DirectMusic {636B9F10-0C7D-11D1-95B2-0020AFDC7421}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x636B9F10) (i32.const 0x11D10C7D)
            (i32.const 0x2000B295) (i32.const 0x2174DCAF))
        (then (local.set $local_class (i32.const 2))))
      ;; CLSID_AMMultiMediaStream {49C47CE5-9BA4-11D0-8212-00C04FC32C45}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x49C47CE5) (i32.const 0x11D09BA4)
            (i32.const 0xC0001282) (i32.const 0x452CC34F))
        (then (local.set $local_class (i32.const 3))))
      ;; CLSID_DirectPlayLobby {2FE8F810-B2A5-11D0-A787-0000F803ABFC}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x2FE8F810) (i32.const 0x11D0B2A5)
            (i32.const 0x000087A7) (i32.const 0xFCAB03F8))
        (then (local.set $local_class (i32.const 4))))
      ;; CLSID_DirectSound {47D4D946-62E8-11CF-93BC-444553540000}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x47D4D946) (i32.const 0x11CF62E8)
            (i32.const 0x4544BC93) (i32.const 0x00005453))
        (then (local.set $local_class (i32.const 5))))
      ;; CLSID_DirectSound8 {3901CC3F-84B5-4FA4-BA35-AA8172B8A09B}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x3901CC3F) (i32.const 0x4FA484B5)
            (i32.const 0x81AA35BA) (i32.const 0x9BA0B872))
        (then (local.set $local_class (i32.const 10))))
      ;; CLSID_ShellLink {00021401-0000-0000-C000-000000000046}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x00021401) (i32.const 0)
            (i32.const 0x000000C0) (i32.const 0x46000000))
        (then (local.set $local_class (i32.const 6))))
      ;; CLSID_DirectX7 {E1211353-8E94-11D1-8808-00C04FC2C602}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0xE1211353) (i32.const 0x11D18E94)
            (i32.const 0xC0000888) (i32.const 0x02C6C24F))
        (then (local.set $local_class (i32.const 7))))
      ;; CLSID_DirectDrawFactory {4FD2A832-86C8-11D0-8FCA-00C04FD9189D}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x4FD2A832) (i32.const 0x11D086C8)
            (i32.const 0xC000CA8F) (i32.const 0x9D18D94F))
        (then (local.set $local_class (i32.const 8))))
      ;; CLSID_DirectDraw {D7B70EE0-4340-11CF-B063-0020AFC2CD35}. Half-Life's
      ;; hw.dll builds its DirectDraw this way rather than through
      ;; DirectDrawCreate, then calls IDirectDraw::Initialize; failing the
      ;; activation is what made the engine report "The selected D3D mode is
      ;; not supported by your video card" and unload the hardware renderer.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0xD7B70EE0) (i32.const 0x11CF4340)
            (i32.const 0x200063B0) (i32.const 0x35CDC2AF))
        (then (local.set $local_class (i32.const 9))))
      ;; CLSID_DirectInput {25E609E0-B259-11CF-BFC7-444553540000}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x25E609E0) (i32.const 0x11CFB259)
            (i32.const 0x4544C7BF) (i32.const 0x00005453))
        (then (local.set $local_class (i32.const 11))))))

    (if (local.get $local_class) (then
      (if (i32.eqz (local.get $arg4))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
          (return)))
      (call $gs32 (local.get $arg4) (i32.const 0))
      (if (local.get $arg1)
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110)) ;; CLASS_E_NOAGGREGATION
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
          (return)))
      (if (i32.eq (local.get $local_class) (i32.const 1))
        (then (local.set $obj_guest
          (call $dx_create_com_obj (i32.const 26) (global.get $DX_VTBL_DPLAY3)))))
      (if (i32.eq (local.get $local_class) (i32.const 2))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 35) (call $directmusic_vtable)))))
      (if (i32.eq (local.get $local_class) (i32.const 3))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 36) (call $init_com_vtable
            (global.get $API_ID_IAMMultiMediaStream_BASE) (i32.const 19))))))
      (if (i32.eq (local.get $local_class) (i32.const 4))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 27) (global.get $DX_VTBL_DPLAYLOBBY2)))))
      (if (i32.eq (local.get $local_class) (i32.const 5))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 4) (global.get $DX_VTBL_DSOUND)))))
      ;; COM activation leaves Initialize to the caller, unlike DirectSoundCreate8.
      (if (i32.eq (local.get $local_class) (i32.const 10))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 4) (global.get $DX_VTBL_DSOUND8)))))
      (if (i32.eq (local.get $local_class) (i32.const 6))
        (then
          (call $shell_link_init_vtables)
          (local.set $obj_guest (call $dx_create_com_obj
            (i32.const 36) (global.get $SHELL_LINK_VTBL)))))
      (if (i32.eq (local.get $local_class) (i32.const 7))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 32) (call $init_com_vtable (global.get $API_ID_IVBDirectX7_BASE) (i32.const 58))))))
      (if (i32.eq (local.get $local_class) (i32.const 8))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 10) (global.get $DX_VTBL_DDFACTORY)))))
      (if (i32.eq (local.get $local_class) (i32.const 9))
        (then
          (local.set $obj_guest (call $dx_create_com_obj
            (i32.const 1) (global.get $DX_VTBL_DDRAW)))
          (if (local.get $obj_guest)
            (then
              (global.set $dx_ddraw_this (local.get $obj_guest))
              (call $dx_coop_hwnd_set (i32.const 0))))))
      ;; The DirectInputCreateA object, uninitialized until IDirectInput::Initialize.
      (if (i32.eq (local.get $local_class) (i32.const 11))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 6) (global.get $DX_VTBL_DINPUT)))))
      (if (i32.eqz (local.get $obj_guest))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; E_OUTOFMEMORY
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
          (return)))
      (if (i32.eq (local.get $local_class) (i32.const 1))
        (then (local.set $hr (call $dplay_query_interface
          (local.get $obj_guest) (local.get $arg3) (local.get $arg4) (i32.const 0)))))
      (if (i32.eq (local.get $local_class) (i32.const 2))
        (then (local.set $hr (call $dx_query_interface_single_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
          (i32.const 0x6536115A) (i32.const 0x11D27B2D)
          (i32.const 0x000018BA) (i32.const 0x12AC75F8)))))
      (if (i32.eq (local.get $local_class) (i32.const 3))
        (then (local.set $hr (call $dx_query_interface_single_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
          (i32.const 0xBEBE595C) (i32.const 0x11D09A6F)
          (i32.const 0xC000DE8F) (i32.const 0x9D18D94F)))))
      (if (i32.eq (local.get $local_class) (i32.const 4))
        (then (local.set $hr (call $dplay_query_interface_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4) (i32.const 1)))))
      (if (i32.eq (local.get $local_class) (i32.const 5))
        (then (local.set $hr (call $dx_query_interface_single_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
          (i32.const 0x279AFA83) (i32.const 0x11CE4981)
          (i32.const 0x200021A5) (i32.const 0x60E50BAF)))))
      (if (i32.eq (local.get $local_class) (i32.const 10))
        (then
          (if (if (result i32) (local.get $iid_wa)
                (then (call $guid_words_equal (local.get $iid_wa)
                  (i32.const 0xC50A7E93) (i32.const 0x4834F395)
                  (i32.const 0xA97FF69E) (i32.const 0x6609E59D)))
                (else (i32.const 0)))
            (then (local.set $hr (call $dx_query_interface_result
              (local.get $obj_guest) (local.get $arg4) (i32.const 1))))
            (else (local.set $hr (call $dx_query_interface_single_wa
              (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
              (i32.const 0x279AFA83) (i32.const 0x11CE4981)
              (i32.const 0x200021A5) (i32.const 0x60E50BAF)))))))
      (if (i32.eq (local.get $local_class) (i32.const 6))
        (then (local.set $hr (call $shell_link_query_interface_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)))))
      (if (i32.eq (local.get $local_class) (i32.const 7))
        (then (local.set $hr (call $directx7_query_interface_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)))))
      (if (i32.eq (local.get $local_class) (i32.const 8))
        (then (local.set $hr (call $dx_query_interface_single_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
          (i32.const 0x4FD2A833) (i32.const 0x11D086C8)
          (i32.const 0xC000CA8F) (i32.const 0x9D18D94F)))))
      (if (i32.eq (local.get $local_class) (i32.const 9))
        (then (local.set $hr (call $ddraw_cocreate_query_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)))))
      (if (i32.eq (local.get $local_class) (i32.const 11))
        (then (local.set $hr (call $dinput_cocreate_query_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)))))
      (drop (call $dx_com_release_basic (local.get $obj_guest)))
      (i32.store offset=0 (global.get $reg_base) (local.get $hr))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (return)))

    ;; Minimal DirectAnimation Automation placeholders for the Plus!98 MFC
    ;; screensavers. CLSIDFromProgID below writes private sentinel CLSIDs for
    ;; DAView/DAStatics; these objects expose IDispatch enough for tracing and
    ;; graceful fallback without loading danim.dll.
    (if (i32.eq (local.get $clsid_d1) (i32.const 0xDA51DA01))
      (then
        (local.set $obj_guest (call $dx_create_com_obj (i32.const 28) (global.get $DX_VTBL_DA_VIEW)))
        (if (i32.eqz (local.get $obj_guest))
          (then
            (call $gs32 (local.get $arg4) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (call $gs32 (local.get $arg4) (local.get $obj_guest))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.eq (local.get $clsid_d1) (i32.const 0xDA57A71C))
      (then
        (local.set $obj_guest (call $dx_create_com_obj (i32.const 29) (global.get $DX_VTBL_DA_STATICS)))
        (if (i32.eqz (local.get $obj_guest))
          (then
            (call $gs32 (local.get $arg4) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (call $gs32 (local.get $arg4) (local.get $obj_guest))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; The private 0x40000000 CLSCTX bit asks the host only to resolve an
    ;; in-proc server: it answers COM_RESOLVED_INPROC with DllGetClassObject's
    ;; address in *ppv, and the activation then runs as ordinary guest calls
    ;; ($com_activate_begin) instead of a nested run the guest cannot block in.
    (local.set $hr (call $host_com_create_instance
      (local.get $clsid_wa)           ;; rclsid → WASM addr
      (local.get $arg1)               ;; pUnkOuter (guest addr, usually NULL)
      (i32.or (local.get $arg2) (i32.const 0x40000000)) ;; dwClsContext
      (local.get $iid_wa)             ;; riid → WASM addr
      (local.get $arg4)))             ;; ppv (guest addr)
    (if (i32.eq (local.get $hr) (i32.const 2)) ;; COM_RESOLVED_INPROC
      (then
        (call $com_activate_begin (call $gl32 (local.get $arg4)) (local.get $arg0) (local.get $arg4) (i32.const 0) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $hr) (i32.const 3)) ;; COM_RESOLVED_REGISTERED_FACTORY
      (then
        (call $com_activate_registered_begin (call $gl32 (local.get $arg4)) (local.get $arg4))
        (return)))
    ;; Check if we need async DLL load (host returns 0x800401F0 = CO_E_DLLNOTFOUND)
    (if (i32.eq (local.get $hr) (i32.const 0x800401F0))
      (then
        ;; Save COM state for resume after DLL fetch
        (global.set $com_clsid_ptr (local.get $arg0))
        (global.set $com_iid_ptr (local.get $arg3))
        (global.set $com_ppv_ptr (local.get $arg4))
        (global.set $com_unk_outer (local.get $arg1))
        (global.set $com_cls_ctx (local.get $arg2))
        (global.set $com_dll_name (call $com_pending_dll_name))
        ;; Yield to JS for async DLL fetch — DON'T advance ESP yet
        ;; JS will load DLL, then re-call com_create_instance
        (call $com_dll_block)
        (return)))
    ;; Synchronous success or error — zero *ppv on failure per COM spec
    (if (local.get $hr)
      (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; CoGetClassObject(rclsid, dwClsContext, pvReserved, riid, ppv) — 5 args.
  ;; The host COM bridge already performs registry lookup, async in-proc DLL
  ;; loading and DllGetClassObject reentry. Its private high CLSCTX bit asks it
  ;; to return the requested class-factory interface directly.
