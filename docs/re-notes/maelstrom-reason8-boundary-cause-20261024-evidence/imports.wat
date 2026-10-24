  (func $process_dll_imports (param $load_addr i32) (param $import_rva i32)
    (local $data_addr i32)
    (local $desc_ptr i32) (local $ilt_rva i32) (local $iat_rva i32)
    (local $ilt_ptr i32) (local $iat_ptr i32) (local $entry i32) (local $thunk_addr i32)
    (local $dll_name_rva i32) (local $dll_name_ptr i32)
    (local $resolved_dll i32) (local $resolved_addr i32) (local $api_id i32) (local $hint_name_wa i32)
    (local.set $desc_ptr (call $g2w (i32.add (local.get $load_addr) (local.get $import_rva))))
    (block $id (loop $dl
      (local.set $ilt_rva (i32.load (local.get $desc_ptr)))
      (local.set $iat_rva (i32.load (i32.add (local.get $desc_ptr) (i32.const 16))))
      ;; OriginalFirstThunk is optional. As in the main PE loader, a stripped
      ;; image keeps its lookup entries in FirstThunk until we overwrite them.
      ;; FirstThunk is required for a live descriptor, so use it to recognize
      ;; the terminator and as the lookup-table fallback.
      (br_if $id (i32.eqz (local.get $iat_rva)))
      (if (i32.eqz (local.get $ilt_rva))
        (then (local.set $ilt_rva (local.get $iat_rva))))
      ;; Get imported DLL name
      (local.set $dll_name_rva (i32.load (i32.add (local.get $desc_ptr) (i32.const 12))))
      (local.set $dll_name_ptr (i32.add (local.get $load_addr) (local.get $dll_name_rva)))
      ;; Check if this DLL is loaded — search DLL_TABLE
      (call $dll_load_lock_begin)
      (local.set $resolved_dll (call $find_loaded_dll (local.get $dll_name_ptr)))
      (if (i32.ge_s (local.get $resolved_dll) (i32.const 0))
        (then
          (if (i32.eqz (call $dll_bind_dependency_locked
                (call $dll_index_from_module (local.get $load_addr)) (local.get $resolved_dll)))
            (then (local.set $resolved_dll (i32.const -1))))))
      (call $lock_release (global.get $DLL_LOAD_LOCK))
      (local.set $ilt_ptr (call $g2w (i32.add (local.get $load_addr) (local.get $ilt_rva))))
      (local.set $iat_ptr (call $g2w (i32.add (local.get $load_addr) (local.get $iat_rva))))
      (block $fd (loop $fl
        (local.set $entry (i32.load (local.get $ilt_ptr)))
        (br_if $fd (i32.eqz (local.get $entry)))
        (if (i32.ge_s (local.get $resolved_dll) (i32.const 0))
          (then
            ;; Resolve against loaded DLL
            (if (i32.and (local.get $entry) (i32.const 0x80000000))
              (then
                ;; Ordinal import
                (local.set $resolved_addr (call $resolve_ordinal (local.get $resolved_dll)
                  (i32.and (local.get $entry) (i32.const 0xFFFF)))))
              (else
                ;; Name import — get name from hint/name table
                (local.set $resolved_addr (call $resolve_name_export (local.get $resolved_dll)
                  (call $g2w (i32.add (local.get $load_addr) (i32.add (local.get $entry) (i32.const 2))))))))
            (i32.store (local.get $iat_ptr) (local.get $resolved_addr)))
          (else
            ;; System DLL — create thunk. LoadLibrary can run on any guest
            ;; thread, so the index comes from the process-wide cursor rather
            ;; than this instance's count (see $thunk_reserve).
            (global.set $num_thunks (call $thunk_reserve))
            (local.set $thunk_addr (i32.add
              (i32.sub (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8)))
                       (global.get $GUEST_BASE))
              (global.get $image_base)))
            (i32.store (local.get $iat_ptr) (local.get $thunk_addr))
            (if (i32.eqz (i32.and (local.get $entry) (i32.const 0x80000000)))
              (then
                (local.set $hint_name_wa
                  (call $g2w (i32.add (local.get $load_addr) (local.get $entry))))
                (local.set $api_id (call $import_hint_override_api_id
                  (local.get $dll_name_ptr)
                  (local.get $hint_name_wa)))
                (if (i32.ne (local.get $api_id) (i32.const -1))
                  (then
                    (i32.store
                      (i32.add (global.get $THUNK_BASE)
                        (i32.mul (global.get $num_thunks) (i32.const 8)))
                      (i32.or (i32.const 0x80000000)
                        (i32.load16_u (local.get $hint_name_wa))))
                    (i32.store
                      (i32.add
                        (i32.add (global.get $THUNK_BASE)
                          (i32.mul (global.get $num_thunks) (i32.const 8)))
                        (i32.const 4))
                      (local.get $api_id)))
                  (else
                    ;; Name import: store name RVA relative to guest base.
                    ;; The name is at load_addr + entry, but thunk expects RVA
                    ;; from image_base.
                    (i32.store
                      (i32.add (global.get $THUNK_BASE)
                        (i32.mul (global.get $num_thunks) (i32.const 8)))
                      (i32.sub (i32.add (local.get $load_addr) (local.get $entry))
                        (global.get $image_base)))
                    (i32.store
                      (i32.add
                        (i32.add (global.get $THUNK_BASE)
                          (i32.mul (global.get $num_thunks) (i32.const 8)))
                        (i32.const 4))
                      (call $lookup_api_id
                        (call $g2w
                          (i32.add (local.get $load_addr)
                            (i32.add (local.get $entry) (i32.const 2)))))))))
              (else
                ;; A DLL import needs the same WAT-first, host-fallback ordinal
                ;; resolver as the main executable.  Calling only the static
                ;; WAT table here made host-mapped system exports (notably the
                ;; authentic DPLAYX ordinal set) turn into ORD diagnostics
                ;; when imported by a loaded DLL, even though the identical
                ;; import from an EXE resolved correctly.
                (local.set $api_id (call $resolve_import_ordinal
                  (local.get $dll_name_ptr)
                  (call $g2w (local.get $dll_name_ptr))
                  (i32.and (local.get $entry) (i32.const 0xFFFF))))
                (if (i32.ne (local.get $api_id) (i32.const -1))
                  (then
                    (i32.store (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8)))
                      (i32.or (i32.const 0x80000000) (i32.and (local.get $entry) (i32.const 0xFFFF))))
                    (i32.store (i32.add (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))) (i32.const 4))
                      (local.get $api_id)))
                  (else
                    ;; Unknown ordinal: retain a clear diagnostic instead of
                    ;; treating the raw ordinal as an API-table index.
                    (i32.store (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8)))
                      (i32.const 0x4F524400)) ;; "ORD\0" marker
                    (i32.store (i32.add (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))) (i32.const 4))
                      (i32.and (local.get $entry) (i32.const 0xFFFF)))))))
            ;; Preserve the reserved thunk slot/index, but point a CRTDLL _iob
            ;; IAT entry at the shared FILE array. Loaded DLL exports above
            ;; remain authoritative; this is only the system fallback path.
            (if (i32.eqz (i32.and (local.get $entry) (i32.const 0x80000000)))
              (then
                (local.set $data_addr (call $resolve_crtdll_iob_import
                  (call $g2w (local.get $dll_name_ptr))
                  (i32.add (local.get $hint_name_wa) (i32.const 2))))
                (if (local.get $data_addr)
                  (then (i32.store (local.get $iat_ptr) (local.get $data_addr))))))
            (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
            (call $update_thunk_end)))
        (local.set $ilt_ptr (i32.add (local.get $ilt_ptr) (i32.const 4)))
        (local.set $iat_ptr (i32.add (local.get $iat_ptr) (i32.const 4)))
        (br $fl)))
      (local.set $desc_ptr (i32.add (local.get $desc_ptr) (i32.const 20)))
      (br $dl))))
