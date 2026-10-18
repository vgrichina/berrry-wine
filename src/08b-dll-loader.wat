  ;; ============================================================
  ;; DLL LOADER — Load PE DLLs into guest address space
  ;; ============================================================
  ;; DLL_TABLE layout at DLL_TABLE global: 32 bytes per DLL, max 32 DLLs = 1024 bytes
  ;; +0:  load_addr (guest)
  ;; +4:  size_of_image
  ;; +8:  export_dir_rva
  ;; +12: num_functions (export)
  ;; +16: ordinal_base (export)
  ;; +20: addr_of_functions_rva (export)
  ;; +24: addr_of_names_rva (export)
  ;; +28: addr_of_name_ordinals_rva (export)

  ;; Lifetime metadata is deliberately separate from the export ABI and the
  ;; TLS/initializer flags. Every mutation runs under DLL_LOAD_LOCK. Registry
  ;; readers that need to keep an image past lock release hold a generation-
  ;; checked pin; neither an HMODULE nor a high-water count grants ownership.
  ;; Row (64 bytes): state, generation, explicit roots, temporary pins,
  ;; outgoing dependency bits (2 words), entrypoint, successful attach order,
  ;; sparse flag, retained reservation base/capacity, detach token,
  ;; attached, EXE roots, reserved, reserved.
  (global $DLL_LIFE_FREE i32 (i32.const 0))
  (global $DLL_LIFE_INITIALIZING i32 (i32.const 1))
  (global $DLL_LIFE_LIVE i32 (i32.const 2))
  (global $DLL_LIFE_DETACHING i32 (i32.const 3))
  (global $DLL_LIFE_FAILED i32 (i32.const 4))
  (func $dll_lifecycle_row (param $index i32) (result i32)
    (i32.add (global.get $DLL_LIFECYCLE_TABLE)
      (i32.shl (local.get $index) (i32.const 6))))
  (func (export "get_dll_lifecycle_table") (result i32)
    (global.get $DLL_LIFECYCLE_TABLE))
  (func (export "get_dll_lifecycle_stride") (result i32) (i32.const 64))
  (func $dll_available_slot (export "get_available_dll_slot") (result i32)
    (local $i i32)
    (block $full (loop $scan
      (br_if $full (i32.ge_u (local.get $i) (global.get $DLL_TABLE_CAPACITY)))
      (if (i32.eqz (i32.atomic.load (call $dll_lifecycle_row (local.get $i))))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))
  (func (export "get_dll_generation") (param $index i32) (result i32)
    (if (i32.ge_u (local.get $index) (i32.atomic.load (global.get $DLL_SHARED)))
      (then (return (i32.const 0))))
    (i32.atomic.load offset=4 (call $dll_lifecycle_row (local.get $index))))
  (func (export "next_dll_unload_token_locked") (result i32)
    (local $token i32)
    (local.set $token (i32.add (i32.load (region.addr $DLL_SHARED 8)) (i32.const 1)))
    (if (i32.eqz (local.get $token)) (then (unreachable)))
    (i32.store (region.addr $DLL_SHARED 8) (local.get $token))
    (local.get $token))
  ;; The host owns an immutable group snapshot and holds DLL_LOAD_LOCK. It
  ;; validates the entire group before calling this for any member. Callback
  ;; execution has already finished for every image in the group.
  (func (export "finish_dll_unload_locked")
      (param $index i32) (param $generation i32) (param $token i32) (result i32)
    (local $life i32) (local $row i32) (local $base i32) (local $size i32)
    (local $sparse i32) (local $capacity i32)
    (if (i32.ge_u (local.get $index) (i32.atomic.load (global.get $DLL_SHARED)))
      (then (return (i32.const 0))))
    (local.set $life (call $dll_lifecycle_row (local.get $index)))
    (if (i32.or (i32.ne (i32.load (local.get $life)) (global.get $DLL_LIFE_DETACHING))
          (i32.or (i32.ne (i32.load offset=4 (local.get $life)) (local.get $generation))
            (i32.ne (i32.load offset=44 (local.get $life)) (local.get $token))))
      (then (return (i32.const 0))))
    (local.set $row (i32.add (global.get $DLL_TABLE) (i32.shl (local.get $index) (i32.const 5))))
    (local.set $base (i32.load (local.get $row)))
    (local.set $size (i32.load offset=4 (local.get $row)))
    (local.set $sparse (i32.load offset=32 (local.get $life)))
    (local.set $capacity (i32.load offset=40 (local.get $life)))
    (call $process_code_cache_invalidate (local.get $base) (local.get $size))
    (if (local.get $sparse)
      (then
        (if (i32.eqz (call $virtual_map_release (local.get $base))) (then (unreachable))))
      (else
        ;; VirtualProtect publishes direct-image overrides in the shared PTE
        ;; table. They belong to this generation, just like the image bytes.
        (call $guest_page_clear_range (local.get $base) (local.get $capacity))
        (memory.fill (call $g2w (local.get $base)) (i32.const 0) (local.get $capacity))))
    (memory.fill (local.get $row) (i32.const 0) (i32.const 32))
    (memory.fill (i32.add (global.get $DLL_RSRC_TABLE) (i32.shl (local.get $index) (i32.const 3)))
      (i32.const 0) (i32.const 8))
    (i32.store (i32.add (global.get $DLL_PATH_TABLE) (i32.shl (local.get $index) (i32.const 2))) (i32.const 0))
    (i32.atomic.store (i32.add (global.get $DLL_FLAGS_TABLE) (i32.shl (local.get $index) (i32.const 2))) (i32.const 0))
    (memory.fill (local.get $life) (i32.const 0) (i32.const 64))
    (i32.store offset=4 (local.get $life) (local.get $generation))
    (if (i32.eqz (local.get $sparse))
      (then
        (i32.store offset=36 (local.get $life) (local.get $base))
        (i32.store offset=40 (local.get $life) (local.get $capacity))))
    (i32.atomic.store (local.get $life) (global.get $DLL_LIFE_FREE))
    (drop (memory.atomic.notify (local.get $life) (i32.const -1)))
    (drop (memory.atomic.notify
      (i32.add (global.get $DLL_FLAGS_TABLE) (i32.shl (local.get $index) (i32.const 2))) (i32.const -1)))
    (i32.const 1))
  ;; Caller owns the loader lock. All counts are full unsigned words; overflow
  ;; fails before mutation instead of wrapping into an unreferenced image.
  (func $dll_retain_locked (param $index i32) (result i32)
    (local $row i32) (local $state i32) (local $roots i32)
    (if (i32.ge_u (local.get $index) (i32.atomic.load (global.get $DLL_SHARED)))
      (then (return (i32.const 0))))
    (local.set $row (call $dll_lifecycle_row (local.get $index)))
    (local.set $state (i32.atomic.load (local.get $row)))
    (if (i32.and (i32.ne (local.get $state) (global.get $DLL_LIFE_INITIALIZING))
          (i32.ne (local.get $state) (global.get $DLL_LIFE_LIVE)))
      (then (return (i32.const 0))))
    (local.set $roots (i32.load offset=8 (local.get $row)))
    (if (i32.eq (local.get $roots) (i32.const -1)) (then (return (i32.const 0))))
    (i32.store offset=8 (local.get $row) (i32.add (local.get $roots) (i32.const 1)))
    (i32.const 1))
  (func (export "retain_dll_row_locked") (param $index i32) (result i32)
    (call $dll_retain_locked (local.get $index)))
  (func (export "get_dll_index") (param $module i32) (result i32)
    (call $dll_index_from_module (local.get $module)))
  ;; Binding is a set operation, not an extra explicit reference. Repeated
  ;; import descriptors, late IAT repair and cyclic back-edges share one edge.
  ;; Startup imports root the provider independently of explicit LoadLibrary.
  (func $dll_bind_dependency_locked (param $importer i32) (param $dependency i32) (result i32)
    (local $target i32) (local $source i32) (local $state i32) (local $word i32)
    (if (i32.ge_u (local.get $dependency) (i32.atomic.load (global.get $DLL_SHARED)))
      (then (return (i32.const 0))))
    (local.set $target (call $dll_lifecycle_row (local.get $dependency)))
    (local.set $state (i32.load (local.get $target)))
    (if (i32.and (i32.ne (local.get $state) (global.get $DLL_LIFE_INITIALIZING))
          (i32.ne (local.get $state) (global.get $DLL_LIFE_LIVE)))
      (then (return (i32.const 0))))
    (if (i32.lt_s (local.get $importer) (i32.const 0))
      (then (i32.store offset=52 (local.get $target) (i32.const 1)) (return (i32.const 1))))
    (if (i32.ge_u (local.get $importer) (i32.atomic.load (global.get $DLL_SHARED)))
      (then (return (i32.const 0))))
    (local.set $source (call $dll_lifecycle_row (local.get $importer)))
    (local.set $state (i32.load (local.get $source)))
    (if (i32.and (i32.ne (local.get $state) (global.get $DLL_LIFE_INITIALIZING))
          (i32.ne (local.get $state) (global.get $DLL_LIFE_LIVE)))
      (then (return (i32.const 0))))
    (local.set $word (i32.add (local.get $source)
      (i32.add (i32.const 16) (i32.shl (i32.shr_u (local.get $dependency) (i32.const 5)) (i32.const 2)))))
    (i32.store (local.get $word) (i32.or (i32.load (local.get $word))
      (i32.shl (i32.const 1) (i32.and (local.get $dependency) (i32.const 31)))))
    (i32.const 1))
  (func $dll_bind_dependency (export "bind_dll_dependency")
      (param $importer_base i32) (param $dependency i32) (result i32)
    (local $result i32) (local $importer i32)
    (call $dll_load_lock_begin)
    (local.set $importer (call $dll_index_from_module (local.get $importer_base)))
    (if (i32.or (i32.ge_s (local.get $importer) (i32.const 0))
          (i32.eq (local.get $importer_base) (global.get $image_base)))
      (then (local.set $result (call $dll_bind_dependency_locked (local.get $importer) (local.get $dependency)))))
    (call $lock_release (global.get $DLL_LOAD_LOCK))
    (local.get $result))
  ;; An initialization completion belongs to its original row generation.
  ;; It can never mark a replacement image at the same HMODULE initialized.
  (func $complete_dll_initialize (export "complete_dll_initialize")
      (param $index i32) (param $generation i32) (param $success i32) (result i32)
    (local $row i32) (local $flags i32) (local $sequence i32)
    (call $dll_load_lock_begin)
    (block $stale
      (br_if $stale (i32.ge_u (local.get $index) (i32.atomic.load (global.get $DLL_SHARED))))
      (local.set $row (call $dll_lifecycle_row (local.get $index)))
      (br_if $stale (i32.ne (i32.load offset=4 (local.get $row)) (local.get $generation)))
      (br_if $stale (i32.ne (i32.load (local.get $row)) (global.get $DLL_LIFE_INITIALIZING)))
      (local.set $flags (i32.add (global.get $DLL_FLAGS_TABLE) (i32.shl (local.get $index) (i32.const 2))))
      ;; success: 1=TRUE, 2=FALSE, 3=no entry point, 0=did not return.
      ;; A FALSE PROCESS_ATTACH still receives PROCESS_DETACH during rollback.
      (if (i32.or (i32.eq (local.get $success) (i32.const 1)) (i32.eq (local.get $success) (i32.const 2)))
        (then
          (local.set $sequence (i32.add (i32.load (region.addr $DLL_SHARED 4)) (i32.const 1)))
          (i32.store (region.addr $DLL_SHARED 4) (local.get $sequence))
          (i32.store offset=28 (local.get $row) (local.get $sequence))
          (i32.store offset=48 (local.get $row) (i32.const 1))))
      (if (i32.or (i32.eq (local.get $success) (i32.const 1)) (i32.eq (local.get $success) (i32.const 3)))
        (then
          (i32.atomic.store (local.get $row) (global.get $DLL_LIFE_LIVE))
          (drop (i32.atomic.rmw.or (local.get $flags) (global.get $DLL_FLAG_INITIALIZED))))
        (else (i32.atomic.store (local.get $row) (global.get $DLL_LIFE_FAILED))))
      (drop (memory.atomic.notify (local.get $flags) (i32.const -1)))
      (drop (memory.atomic.notify (local.get $row) (i32.const -1)))
      (call $lock_release (global.get $DLL_LOAD_LOCK))
      (return (i32.const 1)))
    (call $lock_release (global.get $DLL_LOAD_LOCK))
    (i32.const 0))

  ;; Load a DLL from PE_STAGING into guest memory at load_addr.
  ;; Returns DllMain entry point (guest addr), or 0 if none/error.
  ;; The row this instance's most recent load published, or -1 when it failed.
  ;; The shared count minus one can already name another thread's row by the
  ;; time the host reads it, so the host asks for this instead (the address it
  ;; hands the guest as HMODULE, and the row its module path belongs on).
  (global $last_loaded_dll_index (mut i32) (i32.const -1))
  (func (export "get_last_loaded_dll_index") (result i32) (global.get $last_loaded_dll_index))
  ;; The guest path string the host is loading, set under the loader lock just
  ;; before load_dll and written into the row before it is published.
  (global $next_dll_path (mut i32) (i32.const 0))
  (global $next_dll_explicit_root (mut i32) (i32.const 1))
  (func (export "set_next_dll_explicit_root") (param $root i32)
    (global.set $next_dll_explicit_root (i32.ne (local.get $root) (i32.const 0))))
  (func (export "set_next_dll_path") (param $path_g i32) (global.set $next_dll_path (local.get $path_g)))
  (global $DLL_FLAG_INITIALIZED i32 (i32.const 4))
  (func (export "get_dll_flags_table") (result i32) (global.get $DLL_FLAGS_TABLE))
  ;; DLL_PROCESS_ATTACH of the module at $module has returned: set the bit and
  ;; wake any thread waiting to use it (the host waits on the flags word).
  (func (export "mark_dll_initialized") (param $module i32)
    (call $mark_dll_row_initialized (call $dll_index_from_module (local.get $module))))
  (func $mark_dll_row_initialized (param $index i32)
    (local $row i32) (local $pins i32)
    (if (i32.lt_s (local.get $index) (i32.const 0)) (then (return)))
    (call $dll_load_lock_begin)
    (local.set $row (call $dll_lifecycle_row (local.get $index)))
    ;; The native WinHelp mapper intentionally does not execute a PE entry
    ;; point. Publish that entry-less completion without inventing an attach.
    (if (i32.eq (i32.load (local.get $row)) (global.get $DLL_LIFE_INITIALIZING))
      (then
        (drop (call $complete_dll_initialize (local.get $index) (i32.load offset=4 (local.get $row)) (i32.const 3)))
        (local.set $pins (i32.load offset=12 (local.get $row)))
        (if (local.get $pins) (then (i32.store offset=12 (local.get $row) (i32.sub (local.get $pins) (i32.const 1)))))))
    (call $lock_release (global.get $DLL_LOAD_LOCK)))
  ;; 1 while row $index is still in another thread's DLL_PROCESS_ATTACH, so a
  ;; LoadLibrary that found it must park and retry rather than hand out a
  ;; module whose initializer has not run (Windows holds such a caller on the
  ;; loader lock). Never for the initializing thread itself -- a DllMain that
  ;; loads its own module gets it at once -- and bounded by wall time: a host
  ;; path that maps a module and then fails before its DllMain never marks it,
  ;; and a guest parked on that row would never run again.
  (global $dll_init_wait_row (mut i32) (i32.const -1))
  (global $dll_init_wait_since (mut i32) (i32.const 0))
  (func $dll_row_init_pending (param $index i32) (result i32)
    (local $flags i32) (local $owner i32) (local $state i32)
    (local.set $state (i32.atomic.load (call $dll_lifecycle_row (local.get $index))))
    (if (i32.eq (local.get $state) (global.get $DLL_LIFE_DETACHING))
      (then (return (i32.ne
        (i32.load offset=56 (call $dll_lifecycle_row (local.get $index))) (global.get $current_thread_id)))))
    (if (i32.ne (local.get $state) (global.get $DLL_LIFE_INITIALIZING))
      (then (return (i32.const 0))))
    (local.set $flags (i32.atomic.load (i32.add (global.get $DLL_FLAGS_TABLE)
      (i32.shl (local.get $index) (i32.const 2)))))
    (local.set $owner (i32.shr_u (local.get $flags) (i32.const 16)))
    (if (i32.or (i32.ne (i32.and (local.get $flags) (global.get $DLL_FLAG_INITIALIZED)) (i32.const 0))
          (i32.or (i32.eqz (local.get $owner))
            (i32.eq (local.get $owner) (i32.and (global.get $current_thread_id) (i32.const 0xFFFF)))))
      (then (return (i32.const 0))))
    (i32.const 1))
  ;; Test harness: one guest LoadLibraryA of the name at $name_g. Bit 0: it
  ;; parked to retry (yield 9, frame intact, EIP back on the thunk); otherwise
  ;; the result is in EAX (get_eax). The frame and yield are restored after.
  (func (export "test_loadlibrary_once") (param $name_g i32) (result i32)
    (local $saved_esp i32) (local $bits i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_LoadLibraryA (local.get $name_g)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.and (i32.eq (global.get $yield_reason) (i32.const 9))
          (i32.and (i32.ne (global.get $handler_set_eip) (i32.const 0))
            (i32.eq (i32.load offset=16 (global.get $reg_base)) (local.get $saved_esp))))
      (then (local.set $bits (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (global.set $yield_reason (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    (global.set $handler_set_eip (i32.const 0))
    (local.get $bits))
  ;; Row of a published module whose recorded path is $path_g's string (case-
  ;; insensitive, '/' read as '\'), or -1. The path only: two different DLLs
  ;; can share an export-directory name (CMR3's codecs both call themselves
  ;; DEFFILE.dll), which is why $find_loaded_dll is not used here. Run under
  ;; the loader lock, so a row cannot be published between this and the load.
  (func $find_dll_by_path_locked (export "find_loaded_dll_path") (param $path_g i32) (result i32)
    (local $i i32) (local $count i32) (local $row_g i32)
    (local.set $count (i32.atomic.load (global.get $DLL_SHARED)))
    (block $none (loop $scan
      (br_if $none (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $row_g (i32.load (i32.add (global.get $DLL_PATH_TABLE) (i32.shl (local.get $i) (i32.const 2)))))
      (if (i32.and (i32.ne (local.get $row_g) (i32.const 0))
            (call $dll_path_equal (call $g2w (local.get $row_g)) (call $g2w (local.get $path_g))))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))
  (func $dll_path_equal (param $a i32) (param $b i32) (result i32)
    (local $i i32) (local $ca i32) (local $cb i32)
    (block $done (loop $cmp
      (local.set $ca (call $tolower (i32.load8_u (i32.add (local.get $a) (local.get $i)))))
      (local.set $cb (call $tolower (i32.load8_u (i32.add (local.get $b) (local.get $i)))))
      (if (i32.eq (local.get $ca) (i32.const 47)) (then (local.set $ca (i32.const 92))))
      (if (i32.eq (local.get $cb) (i32.const 47)) (then (local.set $cb (i32.const 92))))
      (if (i32.ne (local.get $ca) (local.get $cb)) (then (return (i32.const 0))))
      (br_if $done (i32.eqz (local.get $ca)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $i) (i32.const 260)))
      (br $cmp)))
    (i32.const 1))
  (func $load_dll (export "load_dll") (param $size i32) (param $load_addr i32) (result i32)
    (local $pe_off i32) (local $num_sections i32) (local $opt_hdr_size i32)
    (local $section_off i32) (local $i i32) (local $vaddr i32) (local $vsize i32)
    (local $raw_off i32) (local $raw_size i32) (local $mapped_size i32)
    (local $preferred_base i32) (local $delta i32)
    (local $import_rva i32) (local $export_rva i32) (local $export_size i32)
    (local $reloc_rva i32) (local $reloc_size i32)
    (local $entry_rva i32) (local $tls_rva i32) (local $characteristics i32)
    (local $dll_idx i32) (local $tbl_ptr i32)
    (local $src i32) (local $dst i32) (local $header_size i32)
    (local $rsrc_rva_d i32) (local $rsrc_size_d i32) (local $rsrc_ptr i32)
    (local $image_size i32) (local $image_end i32) (local $sparse i32)
    (local $life i32) (local $generation i32) (local $reservation_capacity i32)
    (local $claim_tries i32)
    (global.set $last_loaded_dll_index (i32.const -1))
    ;; Staging, address choice, mapping and the row are one critical section
    ;; ($dll_load_lock_begin). A caller that staged the image already holds the
    ;; lock; one that did not (unit tests) takes it here. Either way it is
    ;; released below, before the imports' host round trip and DllMain.
    (if (i32.ne (i32.atomic.load (global.get $DLL_LOAD_LOCK)) (call $lock_owner_id))
      (then (call $lock_acquire (global.get $DLL_LOAD_LOCK))))
    (block $map_fail

    ;; Every DLL has entries in three fixed parallel tables. Refuse the load
    ;; before mapping a section when no row remains; the former unchecked 17th
    ;; load wrote its DLL metadata over DLL_RSRC_TABLE. Under the lock, so the
    ;; check and the claim below cannot be split by another loader.
    (local.set $dll_idx (call $dll_available_slot))
    (if (i32.lt_s (local.get $dll_idx) (i32.const 0))
      (then (br $map_fail)))
    (local.set $life (call $dll_lifecycle_row (local.get $dll_idx)))
    (local.set $generation (i32.add (i32.load offset=4 (local.get $life)) (i32.const 1)))
    ;; A wrapped generation must not make an old asynchronous operation valid.
    (if (i32.eqz (local.get $generation)) (then (br $map_fail)))

    ;; Validate the staged file before reading optional/section headers. Without
    ;; these checks a short file can reuse stale bytes left in PE_STAGING by the
    ;; prior module, and a truncated raw section can leave stale guest memory in
    ;; place as if it were part of this DLL.
    (if (i32.or (i32.lt_u (local.get $size) (i32.const 0x40))
                (i32.gt_u (local.get $size) (global.get $PE_STAGING_SIZE)))
      (then (br $map_fail)))
    (if (i32.ne (i32.load16_u (global.get $PE_STAGING)) (i32.const 0x5A4D))
      (then (br $map_fail)))
    (local.set $pe_off (i32.load (i32.add (global.get $PE_STAGING) (i32.const 0x3C))))
    ;; The COFF fields used below reach PE+0x58. Require that much of the file
    ;; before dereferencing them, then require a PE32 optional header through
    ;; the TLS directory fields consumed below.
    (if (i32.or (i32.lt_u (local.get $size) (i32.const 0x58))
                (i32.gt_u (local.get $pe_off) (i32.sub (local.get $size) (i32.const 0x58))))
      (then (br $map_fail)))
    (local.set $pe_off (i32.add (global.get $PE_STAGING) (local.get $pe_off)))
    (if (i32.ne (i32.load (local.get $pe_off)) (i32.const 0x00004550))
      (then (br $map_fail)))
    (if (i32.ne (i32.load16_u (i32.add (local.get $pe_off) (i32.const 4))) (i32.const 0x014C))
      (then (br $map_fail)))

    (local.set $num_sections (i32.load16_u (i32.add (local.get $pe_off) (i32.const 6))))
    (local.set $opt_hdr_size (i32.load16_u (i32.add (local.get $pe_off) (i32.const 20))))
    (if (i32.or (i32.ne (i32.load16_u (i32.add (local.get $pe_off) (i32.const 24))) (i32.const 0x010B))
                (i32.lt_u (local.get $opt_hdr_size) (i32.const 172)))
      (then (br $map_fail)))
    ;; Headers themselves are copied into the image, so reject a declared
    ;; header extent that escapes either the file or SizeOfImage.
    (local.set $image_size (i32.load (i32.add (local.get $pe_off) (i32.const 80))))
    (if (i32.or (i32.eqz (local.get $image_size))
          (i32.or
            (i32.gt_u (i32.load (i32.add (local.get $pe_off) (i32.const 84))) (local.get $size))
            (i32.gt_u (i32.load (i32.add (local.get $pe_off) (i32.const 84))) (local.get $image_size))))
      (then (br $map_fail)))
    (local.set $section_off (i32.add (local.get $pe_off)
      (i32.add (i32.const 24) (local.get $opt_hdr_size))))
    (if (i32.or
          (i32.gt_u (local.get $section_off) (i32.add (global.get $PE_STAGING) (local.get $size)))
          (i32.gt_u (i32.mul (local.get $num_sections) (i32.const 40))
            (i32.sub (i32.add (global.get $PE_STAGING) (local.get $size)) (local.get $section_off))))
      (then (br $map_fail)))
    ;; Preflight every section before mapping anything. A truncated raw range is
    ;; malformed input; rejecting it avoids exposing old bytes or partial code.
    (local.set $i (i32.const 0))
    (block $preflight_done (loop $preflight
      (br_if $preflight_done (i32.ge_u (local.get $i) (local.get $num_sections)))
      (local.set $vaddr (i32.load (i32.add (local.get $section_off) (i32.const 12))))
      (local.set $vsize (i32.load (i32.add (local.get $section_off) (i32.const 8))))
      (local.set $raw_size (i32.load (i32.add (local.get $section_off) (i32.const 16))))
      (local.set $raw_off (i32.load (i32.add (local.get $section_off) (i32.const 20))))
      (local.set $mapped_size (select (local.get $vsize) (local.get $raw_size)
        (i32.gt_u (local.get $vsize) (local.get $raw_size))))
      (if (i32.or
            (i32.gt_u (local.get $vaddr) (i32.load (i32.add (local.get $pe_off) (i32.const 80))))
            (i32.gt_u (local.get $mapped_size)
              (i32.sub (i32.load (i32.add (local.get $pe_off) (i32.const 80))) (local.get $vaddr))))
        (then (br $map_fail)))
      (if (i32.and (i32.and (i32.ne (local.get $raw_off) (i32.const 0))
                           (i32.ne (local.get $raw_size) (i32.const 0)))
                   (i32.or
                     (i32.gt_u (local.get $raw_off) (local.get $size))
                     (i32.gt_u (local.get $raw_size)
                       (i32.sub (local.get $size) (local.get $raw_off)))))
        (then (br $map_fail)))
      (local.set $section_off (i32.add (local.get $section_off) (i32.const 40)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $preflight)))
    (local.set $preferred_base (i32.load (i32.add (local.get $pe_off) (i32.const 52))))
    (local.set $entry_rva (i32.load (i32.add (local.get $pe_off) (i32.const 40))))
    ;; Only this row owns its retired direct reservation. The heap watermark
    ;; includes it, so treating the reservation as a fresh picked address would
    ;; reject safe reuse. Sparse reservations were released at retirement.
    (if (i32.and (i32.ne (i32.load offset=36 (local.get $life)) (i32.const 0))
          (i32.and (i32.eqz (i32.load offset=32 (local.get $life)))
            (i32.le_u (local.get $image_size) (i32.load offset=40 (local.get $life)))))
      (then
        (local.set $load_addr (i32.load offset=36 (local.get $life)))
        (global.set $dll_pick_addr (i32.const 0))))
    ;; The direct window is affine over ALL of low linear memory, emulator
    ;; tables included, so an image is only safe inside the guest's own spans:
    ;; the image mirror and the low heap, and not the emulator strings between
    ;; them. The candidate follows the low-heap watermark upward, and once the
    ;; EXE, its DLLs and the heap have used that span a late LoadLibrary lands
    ;; on the page indexes: Morrowind's DirectShow chain put l3codecx.ax across
    ;; PAGE_INDEX_ARENA and the main thread dispatched garbage ops. Rebase such
    ;; an image into a committed sparse reservation instead, as a real loader
    ;; does when the preferred range is taken.
    (loop $place
    (local.set $image_size (i32.load (i32.add (local.get $pe_off) (i32.const 80))))
    (local.set $image_end (i32.add (local.get $load_addr) (local.get $image_size)))
    (if (i32.or
          (i32.or
            (i32.lt_u (local.get $image_end) (local.get $load_addr))
            (i32.gt_u (local.get $image_end) (call $w2g (region.end $GUEST_HEAP_BASE))))
          (i32.and
            (i32.lt_u (local.get $load_addr) (call $w2g (global.get $GUEST_HEAP_BASE)))
            (i32.gt_u (local.get $image_end) (call $w2g (region.end $GUEST_BASE)))))
      (then
        (local.set $image_size
          (i32.and (i32.add (local.get $image_size) (i32.const 0xFFFF)) (i32.const 0xFFFF0000)))
        (local.set $load_addr (call $virtual_reserve_down (local.get $image_size)))
        (if (i32.eqz (local.get $load_addr)) (then (br $map_fail)))
        (if (i32.eqz (call $virtual_map_commit_protect
              (local.get $load_addr) (local.get $image_size) (i32.const 0x40))) ;; PAGE_EXECUTE_READWRITE
          (then
            (drop (call $virtual_map_release (local.get $load_addr)))
            (br $map_fail)))
        (local.set $sparse (i32.const 1))))
    ;; Claim the low range before writing a byte of it. The heap lives above
    ;; the same watermark, and a guest thread's HeapAlloc does not take this
    ;; lock: claiming only after mapping (as this used to) let a concurrent
    ;; arena land on the image while it was being copied. If an arena already
    ;; reached into the candidate, place the image again past it.
    (if (i32.eqz (local.get $sparse))
      (then
        (if (i32.eqz (call $dll_claim_low (local.get $load_addr)
              (i32.and (i32.add (local.get $image_end) (i32.const 0xFFF)) (i32.const 0xFFFFF000))))
          (then
            (local.set $claim_tries (i32.add (local.get $claim_tries) (i32.const 1)))
            (if (i32.gt_u (local.get $claim_tries) (i32.const 64)) (then (br $map_fail)))
            (local.set $load_addr (call $next_dll_addr))
            (br $place)))))
    )
    (local.set $delta (i32.sub (local.get $load_addr) (local.get $preferred_base)))

    ;; Keep the mapped DLL's DOS/PE headers just as $load_pe keeps the
    ;; executable's. VirtualQuery can then derive MEM_IMAGE page protection
    ;; from the authentic section table after PE_STAGING is reused by another
    ;; module, rather than growing a second per-DLL metadata format.
    (local.set $header_size (i32.load (i32.add (local.get $pe_off) (i32.const 84))))
    (if (i32.gt_u (local.get $header_size) (local.get $size))
      (then (local.set $header_size (local.get $size))))
    (if (local.get $header_size)
      (then (call $memcpy (call $g2w (local.get $load_addr))
        (global.get $PE_STAGING) (local.get $header_size))))

    ;; Read data directories
    (local.set $export_rva (i32.load (i32.add (local.get $pe_off) (i32.const 120))))
    (local.set $export_size (i32.load (i32.add (local.get $pe_off) (i32.const 124))))
    (local.set $import_rva (i32.load (i32.add (local.get $pe_off) (i32.const 128))))
    (local.set $reloc_rva (i32.load (i32.add (local.get $pe_off) (i32.const 160))))
    (local.set $reloc_size (i32.load (i32.add (local.get $pe_off) (i32.const 164))))
    ;; IMAGE_DIRECTORY_ENTRY_TLS (9). A DLL with static TLS cannot suppress
    ;; thread notifications because its runtime needs them to initialize each
    ;; thread's static TLS block.
    (local.set $tls_rva (i32.load (i32.add (local.get $pe_off) (i32.const 192))))
    ;; Resource data directory = entry #2 (offset 136 in optional header)
    (local.set $rsrc_rva_d  (i32.load (i32.add (local.get $pe_off) (i32.const 136))))
    (local.set $rsrc_size_d (i32.load (i32.add (local.get $pe_off) (i32.const 140))))

    ;; Map sections
    (local.set $section_off (i32.add (local.get $pe_off) (i32.add (i32.const 24) (local.get $opt_hdr_size))))
    (local.set $i (i32.const 0))
    (block $sd (loop $sl
      (br_if $sd (i32.ge_u (local.get $i) (local.get $num_sections)))
      (local.set $vaddr (i32.load (i32.add (local.get $section_off) (i32.const 12))))
      (local.set $raw_size (i32.load (i32.add (local.get $section_off) (i32.const 16))))
      (local.set $raw_off (i32.load (i32.add (local.get $section_off) (i32.const 20))))
      (local.set $characteristics (i32.load (i32.add (local.get $section_off) (i32.const 36))))
      (local.set $vsize (i32.load (i32.add (local.get $section_off) (i32.const 8))))
      ;; Watcom DLLs use VirtualSize=0 and SizeOfRawData for the BSS
      ;; extent. PointerToRawData=0 means no file bytes, just as in load_pe.
      (local.set $mapped_size (select (local.get $vsize) (local.get $raw_size)
        (i32.gt_u (local.get $vsize) (local.get $raw_size))))
      (if (i32.eqz (local.get $raw_off))
        (then (local.set $raw_size (i32.const 0))))
      (local.set $dst (call $g2w (i32.add (local.get $load_addr) (local.get $vaddr))))
      (if (i32.and (i32.gt_u (local.get $raw_size) (i32.const 0))
                   (i32.le_u (i32.add (local.get $raw_off) (local.get $raw_size)) (local.get $size)))
        (then
          (local.set $src (i32.add (global.get $PE_STAGING) (local.get $raw_off)))
          (call $memcpy (local.get $dst) (local.get $src) (local.get $raw_size))))
      ;; Zero the complete uninitialized mapped extent.
      (if (i32.gt_u (local.get $mapped_size) (local.get $raw_size))
        (then (call $zero_memory
          (i32.add (local.get $dst) (local.get $raw_size))
          (i32.sub (local.get $mapped_size) (local.get $raw_size)))))
      (local.set $section_off (i32.add (local.get $section_off) (i32.const 40)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $sl)))

    ;; Process base relocations
    (if (i32.and (i32.ne (local.get $reloc_rva) (i32.const 0))
                 (i32.ne (local.get $delta) (i32.const 0)))
      (then (call $process_relocations (local.get $load_addr) (local.get $reloc_rva) (local.get $reloc_size) (local.get $delta))))

    ;; Store DLL metadata in DLL_TABLE
    (local.set $tbl_ptr (i32.add (global.get $DLL_TABLE) (i32.mul (local.get $dll_idx) (i32.const 32))))
    (local.set $reservation_capacity (local.get $image_size))
    (if (i32.and (i32.eq (local.get $load_addr) (i32.load offset=36 (local.get $life)))
          (i32.gt_u (i32.load offset=40 (local.get $life)) (local.get $reservation_capacity)))
      (then (local.set $reservation_capacity (i32.load offset=40 (local.get $life)))))
    (memory.fill (local.get $tbl_ptr) (i32.const 0) (i32.const 32))
    (memory.fill (local.get $life) (i32.const 0) (i32.const 64))
    (i32.store offset=4 (local.get $life) (local.get $generation))
    (i32.store offset=8 (local.get $life) (global.get $next_dll_explicit_root))
    (global.set $next_dll_explicit_root (i32.const 1))
    (i32.store offset=12 (local.get $life) (i32.const 1))
    (i32.store offset=24 (local.get $life)
      (select (i32.add (local.get $load_addr) (local.get $entry_rva)) (i32.const 0)
        (i32.ne (local.get $entry_rva) (i32.const 0))))
    (i32.store offset=32 (local.get $life) (local.get $sparse))
    (i32.store offset=36 (local.get $life) (local.get $load_addr))
    (i32.store offset=40 (local.get $life) (local.get $reservation_capacity))
    (i32.store (local.get $tbl_ptr) (local.get $load_addr))
    (i32.store (i32.add (local.get $tbl_ptr) (i32.const 4))
      (i32.load (i32.add (local.get $pe_off) (i32.const 80)))) ;; SizeOfImage

    ;; Store resource directory info in DLL_RSRC_TABLE (parallel to DLL_TABLE).
    (local.set $rsrc_ptr (i32.add (global.get $DLL_RSRC_TABLE) (i32.mul (local.get $dll_idx) (i32.const 8))))
    (i32.store (local.get $rsrc_ptr)                         (local.get $rsrc_rva_d))
    (i32.store (i32.add (local.get $rsrc_ptr) (i32.const 4)) (local.get $rsrc_size_d))
    ;; bit 0: static TLS. bit 2 ($DLL_FLAG_INITIALIZED): DLL_PROCESS_ATTACH has
    ;; finished -- at once for an image with no entry point, else when the host
    ;; marks it (mark_dll_initialized). bits 16-31: the thread running that
    ;; DllMain, which a second loader of the same module must not wait for.
    (i32.store
      (i32.add (global.get $DLL_FLAGS_TABLE) (i32.shl (local.get $dll_idx) (i32.const 2)))
      (i32.or
        (i32.ne (local.get $tls_rva) (i32.const 0))
        ;; Even an entry-less image is incomplete until imports/static TLS
        ;; finish. The host publishes completion afterwards with status 3.
        (i32.shl (i32.and (global.get $current_thread_id) (i32.const 0xFFFF)) (i32.const 16))))
    ;; The module path the host named, recorded before the row is published so
    ;; a concurrent loader of the same file finds this row instead of mapping a
    ;; second copy (find_loaded_dll_path).
    (if (global.get $next_dll_path)
      (then
        (i32.store (i32.add (global.get $DLL_PATH_TABLE) (i32.shl (local.get $dll_idx) (i32.const 2)))
          (global.get $next_dll_path))
        ;; The host allocated this persistent path; retire it with this generation.
        (i32.store offset=60 (call $dll_lifecycle_row (local.get $dll_idx)) (global.get $next_dll_path))
        (global.set $next_dll_path (i32.const 0))))

    ;; Parse export directory
    (if (i32.ne (local.get $export_rva) (i32.const 0))
      (then (call $parse_exports (local.get $tbl_ptr) (local.get $load_addr) (local.get $export_rva))))

    ;; Publish the row while the lock still orders loaders: the next one reads
    ;; this row's end for its address and takes the next index. The image range
    ;; was already claimed from the low heap above.
    (i32.atomic.store (local.get $life) (global.get $DLL_LIFE_INITIALIZING))
    (if (i32.eq (local.get $dll_idx) (i32.atomic.load (global.get $DLL_SHARED)))
      (then (i32.atomic.store (global.get $DLL_SHARED) (i32.add (local.get $dll_idx) (i32.const 1)))))
    (global.set $last_loaded_dll_index (local.get $dll_idx))
    ;; Nothing below reads PE_STAGING (the directories are in locals), so the
    ;; next loader may stage. Release before the imports: resolving an ordinal
    ;; is a host round trip, and lock rule 1 forbids holding a lock across one.
    (call $dll_load_lock_end)

    ;; Process DLL's own imports (resolve to our thunks)
    (if (i32.ne (local.get $import_rva) (i32.const 0))
      (then (call $process_dll_imports (local.get $load_addr) (local.get $import_rva))))

    ;; Static TLS, after relocation (the directory holds VAs) and before
    ;; DllMain, which may already use __declspec(thread) data.
    (if (i32.ne (local.get $tls_rva) (i32.const 0))
      (then (call $dll_static_tls_attach (local.get $dll_idx)
        (i32.add (local.get $load_addr) (local.get $tls_rva)))))

    ;; Return DllMain entry point
    (return
      (if (result i32) (i32.ne (local.get $entry_rva) (i32.const 0))
        (then (i32.add (local.get $load_addr) (local.get $entry_rva)))
        (else (i32.const 0)))))
    ;; $map_fail: nothing was published; let the next loader in.
    (global.set $next_dll_explicit_root (i32.const 1))
    (global.set $next_dll_path (i32.const 0))
    (call $dll_load_lock_end)
    (i32.const 0))

  ;; ---- The loader lock -------------------------------------------------------
  ;; PE_STAGING is one buffer for the whole process, and the next DLL address is
  ;; computed from the last row and the heap watermark, so two guest threads
  ;; loading at once used to map each other's bytes, pick the same address and
  ;; write the same DLL_TABLE row (DLL-CONCURRENT-MAPPING). One lock now covers
  ;; staging, address choice, the claim, mapping and publishing the row:
  ;;
  ;;   dll_load_lock_begin  -> host/WinHelp copies the file into PE_STAGING
  ;;                        -> get_next_dll_addr -> load_dll (maps, publishes,
  ;;                           releases) -> imports, TLS, DllMain unlocked
  ;;
  ;; It is never held across a host import (rule 1): the section is copying and
  ;; table arithmetic, and load_dll lets go before the imports' ordinal lookups.
  ;; The one lock taken inside it is LOCK_VIRTUAL_MAP, by a rebase into a sparse
  ;; reservation; that is a strict order (this one outside, never the reverse --
  ;; LOCK_VIRTUAL_MAP's sections never reach the loader), the single exception
  ;; to rule 2. Spinning, like every lock here, so a waiter burns the time the
  ;; holder spends copying an image -- milliseconds, once per load.
  (func $dll_load_lock_begin (export "dll_load_lock_begin")
    (call $lock_acquire (global.get $DLL_LOAD_LOCK)))
  ;; Lifecycle readers release exactly their acquisition, preserving an outer
  ;; import-binding transaction on this owning instance.
  (func (export "dll_load_lock_release_once")
    (call $lock_release (global.get $DLL_LOAD_LOCK)))
  ;; Let go of the lock whatever its depth, if this instance holds it. load_dll
  ;; ends every load this way; a host that staged and then failed before calling
  ;; load_dll calls it to abandon the load.
  (func $dll_load_lock_end (export "dll_load_lock_end")
    (if (i32.eq (i32.atomic.load (global.get $DLL_LOAD_LOCK)) (call $lock_owner_id))
      (then
        (i32.store (region.addr $DLL_LOAD_LOCK 4) (i32.const 1))
        (call $lock_release (global.get $DLL_LOAD_LOCK)))))

  ;; Claim [addr, end) of the low span for an image, against the heap: the
  ;; watermark is the top of everything the heap has handed out. Fails (0) when
  ;; an arena already reaches into the range, so the caller places the image
  ;; again. A range wholly below the watermark is a fixed placement the heap
  ;; never covered, as before, and needs no claim.
  ;;
  ;; That exemption is only for an address the caller fixed. One this instance
  ;; just took from $next_dll_addr was at or above the watermark when picked,
  ;; so a cursor past it now is an arena another thread reserved since -- and a
  ;; small image can lie wholly below that new cursor, inside the arena.
  (func $dll_claim_low (param $addr i32) (param $end i32) (result i32)
    (local $cursor i32) (local $picked i32)
    (local.set $picked (i32.and (i32.ne (global.get $dll_pick_addr) (i32.const 0))
      (i32.eq (local.get $addr) (global.get $dll_pick_addr))))
    (global.set $dll_pick_addr (i32.const 0))
    (block $done (loop $retry
      (local.set $cursor (i32.atomic.load (global.get $HEAP_SHARED)))
      (if (i32.and (i32.eqz (local.get $picked)) (i32.le_u (local.get $end) (local.get $cursor)))
        (then (return (i32.const 1))))
      (if (i32.gt_u (local.get $cursor)
            (i32.and (i32.add (local.get $addr) (i32.const 0xFFF)) (i32.const 0xFFFFF000)))
        (then
          ;; The heap has never been touched (cursor 0) or sits below: claim.
          (if (i32.ne (local.get $cursor) (i32.const 0)) (then (return (i32.const 0))))))
      (br_if $done (i32.eq (local.get $cursor)
        (i32.atomic.rmw.cmpxchg (global.get $HEAP_SHARED) (local.get $cursor) (local.get $end))))
      (br $retry)))
    ;; As $heap_reserve_below does when it moves the cursor: publish the new
    ;; base and drop this instance's arena so it cannot hand out past the image.
    (i32.store (region.addr $HEAP_SHARED 4) (local.get $end))
    (global.set $heap_base (local.get $end))
    (global.set $heap_ptr (i32.const 0))
    (global.set $heap_end (i32.const 0))
    (i32.const 1))

  ;; Resolve a live dynamic-library module handle to its DLL_TABLE slot.
  ;; The executable image is deliberately absent: DisableThreadLibraryCalls
  ;; accepts a DLL module, not GetModuleHandle(NULL)'s executable handle.
  (func $dll_index_from_module (param $module i32) (result i32)
    (local $i i32)
    (if (i32.eqz (local.get $module)) (then (return (i32.const -1))))
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $i) (i32.atomic.load (global.get $DLL_SHARED))))
      (if (i32.eq (i32.load (i32.add (global.get $DLL_TABLE)
            (i32.mul (local.get $i) (i32.const 32)))) (local.get $module))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Return 1 only when this loaded DLL still wants DLL_THREAD_ATTACH/DETACH.
  ;; Exported because both cooperative and real browser Worker creation must
  ;; consult the same process-shared loader state immediately before calling
  ;; DllMain; caching this decision in JS would race a later disable call.
  (func $dll_thread_notifications_enabled_locked
      (param $module i32) (result i32)
    (local $index i32)
    (local.set $index (call $dll_index_from_module (local.get $module)))
    (if (result i32) (i32.lt_s (local.get $index) (i32.const 0))
      (then (i32.const 0))
      (else (i32.eqz (i32.and
        (i32.load (i32.add (global.get $DLL_FLAGS_TABLE)
          (i32.shl (local.get $index) (i32.const 2))))
        (i32.const 2))))))

  ;; Mark a DLL as notification-free. Return 0 for an invalid module or a DLL
  ;; whose PE advertises static TLS, exactly the two documented failure classes.
  (func $dll_disable_thread_notifications_locked (param $module i32) (result i32)
    (local $index i32) (local $flags_ptr i32) (local $flags i32)
    (local.set $index (call $dll_index_from_module (local.get $module)))
    (if (i32.lt_s (local.get $index) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $flags_ptr (i32.add (global.get $DLL_FLAGS_TABLE)
      (i32.shl (local.get $index) (i32.const 2))))
    (local.set $flags (i32.load (local.get $flags_ptr)))
    (if (i32.and (local.get $flags) (i32.const 1))
      (then (return (i32.const 0))))
    (i32.store (local.get $flags_ptr) (i32.or (local.get $flags) (i32.const 2)))
    (i32.const 1))

  ;; Process base relocations: apply delta to all HIGHLOW fixups
  (func $process_relocations (param $load_addr i32) (param $reloc_rva i32) (param $reloc_size i32) (param $delta i32)
    (local $ptr i32) (local $end i32) (local $block_va i32) (local $block_size i32)
    (local $num_entries i32) (local $j i32) (local $entry i32) (local $type i32) (local $offset i32)
    (local $fixup_wa i32) (local $old_val i32)
    (local.set $ptr (call $g2w (i32.add (local.get $load_addr) (local.get $reloc_rva))))
    (local.set $end (i32.add (local.get $ptr) (local.get $reloc_size)))
    (block $done (loop $block
      (br_if $done (i32.ge_u (local.get $ptr) (local.get $end)))
      (local.set $block_va (i32.load (local.get $ptr)))
      (local.set $block_size (i32.load (i32.add (local.get $ptr) (i32.const 4))))
      (br_if $done (i32.eqz (local.get $block_size)))
      (local.set $num_entries (i32.shr_u (i32.sub (local.get $block_size) (i32.const 8)) (i32.const 1)))
      (local.set $j (i32.const 0))
      (block $ed (loop $el
        (br_if $ed (i32.ge_u (local.get $j) (local.get $num_entries)))
        (local.set $entry (i32.load16_u (i32.add (local.get $ptr) (i32.add (i32.const 8) (i32.shl (local.get $j) (i32.const 1))))))
        (local.set $type (i32.shr_u (local.get $entry) (i32.const 12)))
        (local.set $offset (i32.and (local.get $entry) (i32.const 0xFFF)))
        ;; Type 3 = IMAGE_REL_BASED_HIGHLOW (32-bit fixup)
        (if (i32.eq (local.get $type) (i32.const 3))
          (then
            (local.set $fixup_wa (call $g2w (i32.add (local.get $load_addr) (i32.add (local.get $block_va) (local.get $offset)))))
            (local.set $old_val (i32.load (local.get $fixup_wa)))
            (i32.store (local.get $fixup_wa) (i32.add (local.get $old_val) (local.get $delta)))))
        ;; Type 0 = IMAGE_REL_BASED_ABSOLUTE (padding, skip)
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $el)))
      (local.set $ptr (i32.add (local.get $ptr) (local.get $block_size)))
      (br $block))))

  ;; Parse export directory and store metadata in DLL_TABLE entry
  (func $parse_exports (param $tbl_ptr i32) (param $load_addr i32) (param $export_rva i32)
    (local $exp_wa i32)
    (local.set $exp_wa (call $g2w (i32.add (local.get $load_addr) (local.get $export_rva))))
    ;; Store export info
    (i32.store (i32.add (local.get $tbl_ptr) (i32.const 8)) (local.get $export_rva))
    (i32.store (i32.add (local.get $tbl_ptr) (i32.const 12))
      (i32.load (i32.add (local.get $exp_wa) (i32.const 20)))) ;; NumberOfFunctions
    (i32.store (i32.add (local.get $tbl_ptr) (i32.const 16))
      (i32.load (i32.add (local.get $exp_wa) (i32.const 16)))) ;; OrdinalBase
    (i32.store (i32.add (local.get $tbl_ptr) (i32.const 20))
      (i32.load (i32.add (local.get $exp_wa) (i32.const 28)))) ;; AddressOfFunctions RVA
    (i32.store (i32.add (local.get $tbl_ptr) (i32.const 24))
      (i32.load (i32.add (local.get $exp_wa) (i32.const 32)))) ;; AddressOfNames RVA
    (i32.store (i32.add (local.get $tbl_ptr) (i32.const 28))
      (i32.load (i32.add (local.get $exp_wa) (i32.const 36))))) ;; AddressOfNameOrdinals RVA

  ;; Resolve an ordinal export from a loaded DLL. Returns guest address of function.
  (func $resolve_ordinal_locked (param $dll_idx i32) (param $ordinal i32) (result i32)
    (local $tbl_ptr i32) (local $load_addr i32) (local $func_idx i32)
    (local $func_rva i32) (local $aof_rva i32)
    (if (i32.or (i32.ge_u (local.get $dll_idx) (i32.atomic.load (global.get $DLL_SHARED)))
          (i32.eq (i32.load (call $dll_lifecycle_row (local.get $dll_idx))) (global.get $DLL_LIFE_FREE)))
      (then (return (i32.const 0))))
    (local.set $tbl_ptr (i32.add (global.get $DLL_TABLE) (i32.mul (local.get $dll_idx) (i32.const 32))))
    (local.set $load_addr (i32.load (local.get $tbl_ptr)))
    (local.set $func_idx (i32.sub (local.get $ordinal) (i32.load (i32.add (local.get $tbl_ptr) (i32.const 16))))) ;; ordinal - OrdinalBase
    ;; Bounds check
    (if (i32.or (i32.lt_s (local.get $func_idx) (i32.const 0))
                (i32.ge_u (local.get $func_idx) (i32.load (i32.add (local.get $tbl_ptr) (i32.const 12)))))
      (then (return (i32.const 0))))
    (local.set $aof_rva (i32.load (i32.add (local.get $tbl_ptr) (i32.const 20))))
    (local.set $func_rva (i32.load (call $g2w (i32.add (local.get $load_addr)
      (i32.add (local.get $aof_rva) (i32.shl (local.get $func_idx) (i32.const 2)))))))
    (if (result i32) (i32.eqz (local.get $func_rva))
      (then (i32.const 0))
      (else (i32.add (local.get $load_addr) (local.get $func_rva)))))

  ;; Resolve a named export from a loaded DLL. Returns guest address or 0.
  (func $resolve_name_export_locked (param $dll_idx i32) (param $name_wa i32) (result i32)
    (local $tbl_ptr i32) (local $load_addr i32)
    (local $num_names i32) (local $aon_rva i32) (local $ano_rva i32) (local $aof_rva i32)
    (local $i i32) (local $name_rva i32) (local $cmp_wa i32) (local $ordinal_idx i32)
    (local $func_rva i32)
    (if (i32.or (i32.ge_u (local.get $dll_idx) (i32.atomic.load (global.get $DLL_SHARED)))
          (i32.eq (i32.load (call $dll_lifecycle_row (local.get $dll_idx))) (global.get $DLL_LIFE_FREE)))
      (then (return (i32.const 0))))
    (local.set $tbl_ptr (i32.add (global.get $DLL_TABLE) (i32.mul (local.get $dll_idx) (i32.const 32))))
    (if (i32.eqz (i32.load offset=8 (local.get $tbl_ptr))) (then (return (i32.const 0))))
    (local.set $load_addr (i32.load (local.get $tbl_ptr)))
    ;; Read from export directory (stored in DLL_TABLE)
    ;; NumNames is in export_dir+24, but we only stored NumFunctions. Use linear search.
    ;; Actually we need NumNames from the export dir itself.
    (local.set $aon_rva (i32.load (i32.add (local.get $tbl_ptr) (i32.const 24)))) ;; AddressOfNames
    (local.set $ano_rva (i32.load (i32.add (local.get $tbl_ptr) (i32.const 28)))) ;; AddressOfNameOrdinals
    (local.set $aof_rva (i32.load (i32.add (local.get $tbl_ptr) (i32.const 20)))) ;; AddressOfFunctions
    ;; Get NumNames from export directory
    (local.set $num_names (i32.load (i32.add
      (call $g2w (i32.add (local.get $load_addr) (i32.load (i32.add (local.get $tbl_ptr) (i32.const 8)))))
      (i32.const 24))))
    ;; Linear search through name table
    (local.set $i (i32.const 0))
    (block $found (block $notfound (loop $search
      (br_if $notfound (i32.ge_u (local.get $i) (local.get $num_names)))
      ;; Get name RVA
      (local.set $name_rva (i32.load (call $g2w (i32.add (local.get $load_addr)
        (i32.add (local.get $aon_rva) (i32.shl (local.get $i) (i32.const 2)))))))
      (local.set $cmp_wa (call $g2w (i32.add (local.get $load_addr) (local.get $name_rva))))
      ;; Compare names (both are WASM addresses of null-terminated strings)
      (if (call $str_eq (local.get $name_wa) (local.get $cmp_wa))
        (then
          ;; Get ordinal index from AddressOfNameOrdinals
          (local.set $ordinal_idx (i32.load16_u (call $g2w (i32.add (local.get $load_addr)
            (i32.add (local.get $ano_rva) (i32.shl (local.get $i) (i32.const 1)))))))
          ;; Get function RVA
          (local.set $func_rva (i32.load (call $g2w (i32.add (local.get $load_addr)
            (i32.add (local.get $aof_rva) (i32.shl (local.get $ordinal_idx) (i32.const 2)))))))
          (br $found)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $search)))
    (return (i32.const 0))) ;; not found
    (if (result i32) (i32.eqz (local.get $func_rva))
      (then (i32.const 0))
      (else (i32.add (local.get $load_addr) (local.get $func_rva)))))

  ;; Compare two null-terminated strings at WASM addresses
  (func $str_eq (param $a i32) (param $b i32) (result i32)
    (local $i i32) (local $ca i32) (local $cb i32)
    (block $no (loop $l
      (local.set $ca (i32.load8_u (i32.add (local.get $a) (local.get $i))))
      (local.set $cb (i32.load8_u (i32.add (local.get $b) (local.get $i))))
      (br_if $no (i32.ne (local.get $ca) (local.get $cb)))
      (if (i32.eqz (local.get $ca)) (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (i32.const 0))

  ;; Exports that keep their native handler even when the real DLL that owns
  ;; them is loaded. The math entries route CRT float helpers to the host FPU;
  ;; the comctl32 entry papers over a genuine Win98-vs-XP version gap.
  (func $native_override_export_api_id (param $name_wa i32) (result i32)
    ;; MSVC emits _ftol at every float/double-to-integer conversion.  Running
    ;; the authentic 21-instruction MSVCRT wrapper through the threaded x86
    ;; core is especially expensive in vertex-colour loops; the native handler
    ;; implements the same x87 pop, truncation and EDX:EAX result directly.
    (if (i32.eq (call $lookup_api_id (local.get $name_wa)) (i32.const 759))
      (then (return (i32.const 759)))) ;; _ftol
    ;; Morrowind resolves every object by name with a linear list walk that
    ;; calls _stricmp once per entry; the authentic byte-at-a-time loop was
    ;; ~30% of all blocks retired during its startup load. The native handler
    ;; compares with the same C-locale ASCII folding and keeps no CRT state.
    ;; From a real MSVCRT/MSVCR7x it also defers to the authentic export once
    ;; the locale leaves "C" ($crt_native_override_defers).
    (if (call $str_eq (local.get $name_wa) "_stricmp")
      (then (return (call $lookup_api_id "_stricmp"))))
    (if (call $str_eq (local.get $name_wa) "ceil")
      (then (return (call $lookup_api_id "ceil"))))
    (if (call $str_eq (local.get $name_wa) "sqrt")
      (then (return (call $lookup_api_id "sqrt"))))
    (if (call $str_eq (local.get $name_wa) "sin")
      (then (return (call $lookup_api_id "sin"))))
    (if (call $str_eq (local.get $name_wa) "pow")
      (then (return (call $lookup_api_id "pow"))))
    (if (call $str_eq (local.get $name_wa) "_CIpow")
      (then (return (call $lookup_api_id "_CIpow"))))
    ;; Win98's comctl32 rejects every ICC_* bit in 0x7fff8000, so an XP-era
    ;; caller asking for ICC_LINK_CLASS (0x8000) gets FALSE and quits. The
    ;; classes themselves are registered from the DLL's DllMain, so answering
    ;; natively costs nothing and matches how a newer comctl32 would behave.
    (if (call $str_eq (local.get $name_wa) "InitCommonControlsEx")
      (then (return (call $lookup_api_id "InitCommonControlsEx"))))
    (i32.const -1))

  ;; WinSock 1.1 commonly imports WSOCK32 by ordinal. Resolve ordinals for
  ;; APIs already handled by the normal dispatch table; leave unsupported
  ;; ordinals explicit so they still produce the diagnostic marker below.
  (func $guest_name_has_basename8_ci
        (param $name i32)
        (param $c0 i32) (param $c1 i32) (param $c2 i32) (param $c3 i32)
        (param $c4 i32) (param $c5 i32) (param $c6 i32) (param $c7 i32)
        (result i32)
    (local $start i32) (local $scan i32) (local $c i32)
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    (block $base_done (loop $base
      (local.set $c (call $gl8 (i32.add (local.get $name) (local.get $scan))))
      (br_if $base_done (i32.eqz (local.get $c)))
      (if (i32.or
            (i32.or (i32.eq (local.get $c) (i32.const 92))
                    (i32.eq (local.get $c) (i32.const 47)))
            (i32.eq (local.get $c) (i32.const 58)))
        (then (local.set $start (i32.add (local.get $scan) (i32.const 1)))))
      (local.set $scan (i32.add (local.get $scan) (i32.const 1)))
      (br $base)))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (local.get $start)))) (local.get $c0)) (then (return (i32.const 0))))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 1))))) (local.get $c1)) (then (return (i32.const 0))))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 2))))) (local.get $c2)) (then (return (i32.const 0))))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 3))))) (local.get $c3)) (then (return (i32.const 0))))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 4))))) (local.get $c4)) (then (return (i32.const 0))))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 5))))) (local.get $c5)) (then (return (i32.const 0))))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 6))))) (local.get $c6)) (then (return (i32.const 0))))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 7))))) (local.get $c7)) (then (return (i32.const 0))))
    (call $guest_name_tail_is_dll
      (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 8)))))

  (func $guest_name_is_ws2_32_ci (param $name i32) (result i32)
    (local $start i32) (local $scan i32) (local $c i32)
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    (block $base_done (loop $base
      (local.set $c (call $gl8 (i32.add (local.get $name) (local.get $scan))))
      (br_if $base_done (i32.eqz (local.get $c)))
      (if (i32.or
            (i32.or (i32.eq (local.get $c) (i32.const 92))
                    (i32.eq (local.get $c) (i32.const 47)))
            (i32.eq (local.get $c) (i32.const 58)))
        (then (local.set $start (i32.add (local.get $scan) (i32.const 1)))))
      (local.set $scan (i32.add (local.get $scan) (i32.const 1)))
      (br $base)))
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (local.get $start)))) (i32.const 0x77)) (then (return (i32.const 0)))) ;; w
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 1))))) (i32.const 0x73)) (then (return (i32.const 0)))) ;; s
    (if (i32.ne (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 2)))) (i32.const 0x32)) (then (return (i32.const 0)))) ;; 2
    (if (i32.ne (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 3)))) (i32.const 0x5F)) (then (return (i32.const 0)))) ;; _
    (if (i32.ne (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 4)))) (i32.const 0x33)) (then (return (i32.const 0)))) ;; 3
    (if (i32.ne (call $gl8 (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 5)))) (i32.const 0x32)) (then (return (i32.const 0)))) ;; 2
    (call $guest_name_tail_is_dll
      (i32.add (local.get $name) (i32.add (local.get $start) (i32.const 6)))))

  (func $system_ordinal_api_id (param $dll_name_ga i32) (param $ordinal i32) (result i32)
    ;; Authentic Win98 SE KERNEL32.DLL: ordinal 99 is unnamed, RVA 0x1e260.
    ;; Its native body takes one BOOL refresh flag and returns the current
    ;; TIME_ZONE_ID_* classification (0 unknown, 1 standard, 2 daylight).
    (if (call $dll_name_match (local.get $dll_name_ga) "KERNEL32.dll")
      (then
        (if (i32.eq (local.get $ordinal) (i32.const 35))
          (then (return (call $lookup_api_id "LoadLibrary16"))))
        (if (i32.eq (local.get $ordinal) (i32.const 36))
          (then (return (call $lookup_api_id "FreeLibrary16"))))
        (if (i32.eq (local.get $ordinal) (i32.const 37))
          (then (return (call $lookup_api_id "GetProcAddress16"))))
        (if (i32.eq (local.get $ordinal) (i32.const 99))
          (then (return (call $lookup_api_id "KERNEL32_Ordinal99"))))
      ))
    (if (i32.or
          (call $dll_name_match (local.get $dll_name_ga) "WSOCK32.dll")
          (call $guest_name_is_ws2_32_ci (local.get $dll_name_ga)))
      (then
        (if (i32.eq (local.get $ordinal) (i32.const 115)) (then (return (call $lookup_api_id "WSAStartup"))))
        (if (i32.eq (local.get $ordinal) (i32.const 116)) (then (return (call $lookup_api_id "WSACleanup"))))
        (if (i32.eq (local.get $ordinal) (i32.const 111)) (then (return (call $lookup_api_id "WSAGetLastError"))))
        (if (i32.eq (local.get $ordinal) (i32.const 23))  (then (return (call $lookup_api_id "socket"))))
        (if (i32.eq (local.get $ordinal) (i32.const 3))   (then (return (call $lookup_api_id "closesocket"))))
        (if (i32.eq (local.get $ordinal) (i32.const 4))   (then (return (call $lookup_api_id "connect"))))
        (if (i32.eq (local.get $ordinal) (i32.const 5))   (then (return (call $lookup_api_id "getpeername"))))
        (if (i32.eq (local.get $ordinal) (i32.const 6))   (then (return (call $lookup_api_id "getsockname"))))
        (if (i32.eq (local.get $ordinal) (i32.const 7))   (then (return (call $lookup_api_id "getsockopt"))))
        ;; htonl and ntohl are the same byte swap on this little-endian guest.
        (if (i32.eq (local.get $ordinal) (i32.const 8))   (then (return (call $lookup_api_id "ntohl"))))
        (if (i32.eq (local.get $ordinal) (i32.const 19))  (then (return (call $lookup_api_id "send"))))
        (if (i32.eq (local.get $ordinal) (i32.const 16))  (then (return (call $lookup_api_id "recv"))))
        (if (i32.eq (local.get $ordinal) (i32.const 20))  (then (return (call $lookup_api_id "sendto"))))
        (if (i32.eq (local.get $ordinal) (i32.const 17))  (then (return (call $lookup_api_id "recvfrom"))))
        (if (i32.eq (local.get $ordinal) (i32.const 52))  (then (return (call $lookup_api_id "gethostbyname"))))
        (if (i32.eq (local.get $ordinal) (i32.const 9))   (then (return (call $lookup_api_id "htons"))))
        ;; WS2_32 renumbered three exports relative to WSOCK32: 10 is ioctlsocket,
        ;; 11 inet_addr and 12 inet_ntoa (WSOCK32: 10 inet_addr, 11 inet_ntoa,
        ;; 12 ioctlsocket). Pocket Tanks imports WS2_32 by ordinal; resolving its
        ;; ioctlsocket (3 args) as inet_addr (1 arg) left 8 bytes on the stack
        ;; and its return ran into the stack.
        (if (call $guest_name_is_ws2_32_ci (local.get $dll_name_ga))
          (then
            (if (i32.eq (local.get $ordinal) (i32.const 10)) (then (return (call $lookup_api_id "ioctlsocket"))))
            (if (i32.eq (local.get $ordinal) (i32.const 11)) (then (return (call $lookup_api_id "inet_addr"))))
            (if (i32.eq (local.get $ordinal) (i32.const 12)) (then (return (call $lookup_api_id "inet_ntoa"))))))
        (if (i32.eq (local.get $ordinal) (i32.const 10))  (then (return (call $lookup_api_id "inet_addr"))))
        (if (i32.eq (local.get $ordinal) (i32.const 11))  (then (return (call $lookup_api_id "inet_ntoa"))))
        (if (i32.eq (local.get $ordinal) (i32.const 18))  (then (return (call $lookup_api_id "select"))))
        (if (i32.eq (local.get $ordinal) (i32.const 21))  (then (return (call $lookup_api_id "setsockopt"))))
        (if (i32.eq (local.get $ordinal) (i32.const 12))  (then (return (call $lookup_api_id "ioctlsocket"))))
        (if (i32.eq (local.get $ordinal) (i32.const 1))   (then (return (call $lookup_api_id "accept"))))
        (if (i32.eq (local.get $ordinal) (i32.const 2))   (then (return (call $lookup_api_id "bind"))))
        (if (i32.eq (local.get $ordinal) (i32.const 13))  (then (return (call $lookup_api_id "listen"))))
        (if (i32.eq (local.get $ordinal) (i32.const 14))  (then (return (call $lookup_api_id "ntohl"))))
        (if (i32.eq (local.get $ordinal) (i32.const 15))  (then (return (call $lookup_api_id "ntohs"))))
        (if (i32.eq (local.get $ordinal) (i32.const 22))  (then (return (call $lookup_api_id "shutdown"))))
        (if (i32.eq (local.get $ordinal) (i32.const 15))  (then (return (call $lookup_api_id "ntohs"))))
        (if (i32.eq (local.get $ordinal) (i32.const 11))  (then (return (call $lookup_api_id "inet_ntoa"))))
        (if (i32.eq (local.get $ordinal) (i32.const 151)) (then (return (call $lookup_api_id "__WSAFDIsSet"))))
        (if (i32.eq (local.get $ordinal) (i32.const 112)) (then (return (call $lookup_api_id "WSASetLastError"))))
        (if (i32.eq (local.get $ordinal) (i32.const 113)) (then (return (call $lookup_api_id "WSACancelBlockingCall"))))
        (if (i32.eq (local.get $ordinal) (i32.const 14))   (then (return (call $lookup_api_id "ntohl"))))
        (if (i32.eq (local.get $ordinal) (i32.const 5))    (then (return (call $lookup_api_id "getpeername"))))
        (if (i32.eq (local.get $ordinal) (i32.const 57))   (then (return (call $lookup_api_id "gethostname"))))
        (if (i32.eq (local.get $ordinal) (i32.const 101))  (then (return (call $lookup_api_id "WSAAsyncSelect"))))
        (if (i32.eq (local.get $ordinal) (i32.const 1001)) (then (return (call $lookup_api_id "WsControl"))))
      ))
    ;; WINMM. Welcome98 imports PlaySound purely by ordinal; the name is
    ;; resolved from the real Win98 winmm.dll export table rather than guessed
    ;; (tools/pe-exports.js --ordinal=2).
    (if (call $dll_name_match (local.get $dll_name_ga) "winmm.dll")
      (then
        (if (i32.eq (local.get $ordinal) (i32.const 2)) (then (return (call $lookup_api_id "PlaySoundA"))))
      ))
    ;; Authentic Win98 DPLAYX exports (ordinals read off the retail DX6
    ;; dplayx.dll with tools/pe-exports.js, not guessed). RollerCoaster Tycoon
    ;; imports 1 and 2 by ordinal only. $guest_name_is_static_system_dll
    ;; answers a *1-based* list position, and the DirectX tail of the list is
    ;; dplayx/ddraw/dsound/d3drm starting at 0-based $STATIC_SYS_DLL_FIRST_DX —
    ;; so dplayx is FIRST_DX+1 and dsound FIRST_DX+3, derived rather than
    ;; spelled so a new non-DirectX name cannot skew them. The DSOUND rule below
    ;; once said dplayx's number and therefore claimed
    ;; every dplayx ordinal: RCT's ordinal 2 came back as DirectSoundEnumerateA,
    ;; whose handler pushes four callback arguments where DirectPlayEnumerateA's
    ;; callback pops five (`ret 0x14`), and the resulting stack skew returned the
    ;; guest to EIP 0 before it ever created a window.
    (if (i32.eq (call $guest_name_is_static_system_dll (local.get $dll_name_ga))
                (i32.add (global.get $STATIC_SYS_DLL_FIRST_DX) (i32.const 1)))
      (then
        (if (i32.eq (local.get $ordinal) (i32.const 1)) (then (return (i32.const 1232)))) ;; DirectPlayCreate
        (if (i32.eq (local.get $ordinal) (i32.const 2)) (then (return (i32.const 1234)))) ;; DirectPlayEnumerateA
        (if (i32.eq (local.get $ordinal) (i32.const 4)) (then (return (i32.const 1235)))) ;; DirectPlayLobbyCreateA
        (if (i32.eq (local.get $ordinal) (i32.const 9)) (then (return (i32.const 1233)))) ;; DirectPlayEnumerate
      ))
    ;; Authentic Win98 DSOUND exports. Diablo II's D2Sound imports both by
    ;; ordinal: 2 enumerates the default driver, then 1 creates it. DSOUND is
    ;; entry FIRST_DX+3 in STATIC_SYS_DLL_NAMES' 1-based numbering; those API ids are
    ;; append-only table positions and therefore as stable as the generated
    ;; dispatch itself.
    (if (i32.eq (call $guest_name_is_static_system_dll (local.get $dll_name_ga))
                (i32.add (global.get $STATIC_SYS_DLL_FIRST_DX) (i32.const 3)))
      (then
        (if (i32.eq (local.get $ordinal) (i32.const 1)) (then (return (i32.const 976))))  ;; DirectSoundCreate
        (if (i32.eq (local.get $ordinal) (i32.const 2)) (then (return (i32.const 1236)))) ;; DirectSoundEnumerateA
        (if (i32.eq (local.get $ordinal) (i32.const 11)) (then (return (i32.const 3886)))) ;; DirectSoundCreate8
      ))
    ;; Authentic Win98 COMCTL32 ordinal 17 is InitCommonControls. InstallShield
    ;; setup helpers (including Heroes III's chkreqs.dll) import it without a
    ;; name. Match the module stem directly so a full path works as well.
    (if (call $guest_name_has_basename8_ci
          (local.get $dll_name_ga)
          (i32.const 0x63) (i32.const 0x6f) (i32.const 0x6d) (i32.const 0x63)
          (i32.const 0x74) (i32.const 0x6c) (i32.const 0x33) (i32.const 0x32)) ;; comctl32
      (then
        (if (i32.eq (local.get $ordinal) (i32.const 17))
          (then (return (i32.const 877)))) ;; InitCommonControls
      ))
    ;; OLEAUT32. Kodak Imaging imports the VARIANT/BSTR set by ordinal only.
    (if (call $dll_name_match (local.get $dll_name_ga) "oleaut32.dll")
      (then
        (if (i32.eq (local.get $ordinal) (i32.const 2))  (then (return (call $lookup_api_id "SysAllocString"))))
        (if (i32.eq (local.get $ordinal) (i32.const 4))  (then (return (call $lookup_api_id "SysAllocStringLen"))))
        (if (i32.eq (local.get $ordinal) (i32.const 5))  (then (return (call $lookup_api_id "SysReAllocStringLen"))))
        (if (i32.eq (local.get $ordinal) (i32.const 6))  (then (return (call $lookup_api_id "SysFreeString"))))
        (if (i32.eq (local.get $ordinal) (i32.const 7))  (then (return (call $lookup_api_id "SysStringLen"))))
        (if (i32.eq (local.get $ordinal) (i32.const 8))  (then (return (call $lookup_api_id "VariantInit"))))
        (if (i32.eq (local.get $ordinal) (i32.const 9))  (then (return (call $lookup_api_id "VariantClear"))))
        (if (i32.eq (local.get $ordinal) (i32.const 10)) (then (return (call $lookup_api_id "VariantCopy"))))
        ;; DirectX 8.1 devenum.dll registers filters through these by ordinal.
        (if (i32.eq (local.get $ordinal) (i32.const 15)) (then (return (call $lookup_api_id "SafeArrayCreate"))))
        (if (i32.eq (local.get $ordinal) (i32.const 16)) (then (return (call $lookup_api_id "SafeArrayDestroy"))))
        (if (i32.eq (local.get $ordinal) (i32.const 23)) (then (return (call $lookup_api_id "SafeArrayAccessData"))))
        (if (i32.eq (local.get $ordinal) (i32.const 24)) (then (return (call $lookup_api_id "SafeArrayUnaccessData"))))
        (if (i32.eq (local.get $ordinal) (i32.const 64)) (then (return (call $lookup_api_id "VarI4FromStr"))))
        (if (i32.eq (local.get $ordinal) (i32.const 161)) (then (return (call $lookup_api_id "LoadTypeLib"))))
        (if (i32.eq (local.get $ordinal) (i32.const 163)) (then (return (call $lookup_api_id "RegisterTypeLib"))))
        ;; InstallShield 11 imports the binary-BSTR helpers by ordinal. Keep
        ;; these in the guest resolver as well as the host fallback so loaded
        ;; DLL imports cannot depend on which resolver path reached them.
        (if (i32.eq (local.get $ordinal) (i32.const 149)) (then (return (call $lookup_api_id "SysStringByteLen"))))
        (if (i32.eq (local.get $ordinal) (i32.const 150)) (then (return (call $lookup_api_id "SysAllocStringByteLen"))))
        (if (i32.eq (local.get $ordinal) (i32.const 420)) (then (return (call $lookup_api_id "OleCreateFontIndirect"))))
      ))
    (i32.const -1))

  ;; Resolve one ordinal-only import. The WAT table above is consulted
  ;; first, so a DLL described there behaves the same whether the EXE or
  ;; another DLL imports it — the two loaders previously each had their own
  ;; answer, and a name present in one was missing from the other. The host
  ;; map still covers the DLLs whose ordinals have not moved into WAT.
  ;; $dll_name_ga is a guest address (what $dll_name_match reads through);
  ;; $dll_name_wa is the same string as a linear-memory address, which is
  ;; what the host import expects.
  (func $resolve_import_ordinal (param $dll_name_ga i32) (param $dll_name_wa i32)
                                (param $ordinal i32) (result i32)
    (local $id i32)
    (local.set $id (call $system_ordinal_api_id
      (local.get $dll_name_ga) (local.get $ordinal)))
    (if (i32.ne (local.get $id) (i32.const -1)) (then (return (local.get $id))))
    (call $host_resolve_ordinal (local.get $dll_name_wa) (local.get $ordinal)))

  ;; Process a loaded DLL's imports — create thunks for system DLLs,
  ;; resolve against other loaded DLLs if found.
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

  ;; Find a loaded DLL by name (guest address of name string).
  ;; Returns dll_idx (0-based) or -1 if not found.
  ;; Compares against DLL export names stored in export directory.
  (func $find_loaded_dll (param $name_ptr i32) (result i32)
    (local $i i32) (local $tbl_ptr i32) (local $la i32) (local $exp_rva i32)
    (local $exp_name_rva i32) (local $exp_name_wa i32)
    (local $path_g i32) (local $path_wa i32) (local $base_wa i32) (local $ch i32)
    ;; A supplied path identifies that file, not the first matching basename
    ;; or internal export name from a different directory.
    (local.set $path_wa (call $g2w (local.get $name_ptr)))
    (block $bare_name (loop $qualified
      (local.set $ch (i32.load8_u (local.get $path_wa)))
      (br_if $bare_name (i32.eqz (local.get $ch)))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 92))
            (i32.or (i32.eq (local.get $ch) (i32.const 47))
              (i32.eq (local.get $ch) (i32.const 58))))
        (then (return (call $find_dll_by_path_locked (local.get $name_ptr)))))
      (local.set $path_wa (i32.add (local.get $path_wa) (i32.const 1)))
      (br $qualified)))
    (local.set $i (i32.const 0))
    (block $notfound (loop $search
      (br_if $notfound (i32.ge_u (local.get $i) (i32.atomic.load (global.get $DLL_SHARED))))
      (local.set $tbl_ptr (i32.add (global.get $DLL_TABLE) (i32.mul (local.get $i) (i32.const 32))))
      (local.set $la (i32.load (local.get $tbl_ptr)))
      (local.set $exp_rva (i32.load (i32.add (local.get $tbl_ptr) (i32.const 8))))
      ;; Windows identifies a loaded module by its file name, and a
      ;; resource-only DLL has no export directory to name it at all.
      ;; msi.dll loads msimsg.dll that way on every message lookup; unmatched,
      ;; each call mapped another copy and yielded to the host, which a nested
      ;; synchronous wndproc cannot service -- the wizard's Next did nothing.
      (local.set $path_g (i32.load (i32.add (global.get $DLL_PATH_TABLE)
        (i32.shl (local.get $i) (i32.const 2)))))
      (if (local.get $path_g)
        (then
          (local.set $path_wa (call $g2w (local.get $path_g)))
          (local.set $base_wa (local.get $path_wa))
          (block $end (loop $scan
            (local.set $ch (i32.load8_u (local.get $path_wa)))
            (br_if $end (i32.eqz (local.get $ch)))
            (local.set $path_wa (i32.add (local.get $path_wa) (i32.const 1)))
            (if (i32.or (i32.eq (local.get $ch) (i32.const 92))
                        (i32.or (i32.eq (local.get $ch) (i32.const 47))
                                (i32.eq (local.get $ch) (i32.const 58))))
              (then (local.set $base_wa (local.get $path_wa))))
            (br $scan)))
          (if (call $dll_name_match (local.get $name_ptr) (local.get $base_wa))
            (then (return (local.get $i))))))
      (if (i32.ne (local.get $exp_rva) (i32.const 0))
        (then
          ;; Get export directory name RVA
          (local.set $exp_name_rva (i32.load (i32.add (call $g2w (i32.add (local.get $la) (local.get $exp_rva))) (i32.const 12))))
          (local.set $exp_name_wa (call $g2w (i32.add (local.get $la) (local.get $exp_name_rva))))
          ;; Compare (case-insensitive)
          (if (call $dll_name_match (local.get $name_ptr) (local.get $exp_name_wa))
            (then (return (local.get $i))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $search)))
    (i32.const -1))

  ;; An import descriptor without OriginalFirstThunk (Borland/Delphi linkers
  ;; leave it 0) keeps its hint/name RVAs only in FirstThunk, and the first
  ;; loader pass overwrote those with stub thunks for every DLL that was not
  ;; loaded yet -- for an EXE, all of them. Each stub still records its
  ;; name's RVA from $image_base, so recover the caller-relative RVA from it.
  ;; 0 means "nothing to patch": the slot is already a resolved address, or
  ;; its stub records an ordinal, a native hint override or no name at all.
  (func $iat_slot_name_rva (param $caller_base i32) (param $slot i32) (result i32)
    (local $off i32) (local $rec i32)
    (call $update_thunk_end)
    (local.set $off (i32.sub (local.get $slot) (global.get $thunk_guest_base)))
    (if (i32.ge_u (local.get $off)
          (i32.sub (global.get $thunk_guest_end) (global.get $thunk_guest_base)))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $off) (i32.const 7)) (then (return (i32.const 0))))
    (local.set $rec (i32.load (call $thunk_metadata_addr (i32.shr_u (local.get $off) (i32.const 3)))))
    (if (i32.or (i32.ne (i32.and (local.get $rec) (i32.const 0x80000000)) (i32.const 0))
                (i32.eq (local.get $rec) (i32.const 0x4F524400))) ;; "ORD\0"
      (then (return (i32.const 0))))
    (i32.sub (i32.add (local.get $rec) (global.get $image_base)) (local.get $caller_base)))

  ;; Patch a caller's imports for a specific loaded DLL.
  ;; Walks the caller's import descriptor and resolves against DLL exports.
  (func $patch_caller_iat (export "patch_caller_iat")
    (param $caller_base i32) (param $caller_import_rva i32)
    (param $target_dll_name_ptr i32) (param $dll_idx i32)
    (local $desc_ptr i32) (local $ilt_rva i32) (local $iat_rva i32)
    (local $dll_name_rva i32) (local $dll_name_ga i32)
    (local $ilt_ptr i32) (local $iat_ptr i32) (local $entry i32)
    (local $resolved i32) (local $name_wa i32) (local $api_id i32) (local $thunk_addr i32)
    (local $crt_real i32) (local $no_ilt i32)
    (local.set $desc_ptr (call $g2w (i32.add (local.get $caller_base) (local.get $caller_import_rva))))
    (block $id (loop $dl
      (local.set $ilt_rva (i32.load (local.get $desc_ptr)))
      (local.set $iat_rva (i32.load (i32.add (local.get $desc_ptr) (i32.const 16))))
      ;; FirstThunk is required for a live descriptor; OriginalFirstThunk is
      ;; optional (the same rule as the PE loader's own import walk).
      (br_if $id (i32.eqz (local.get $iat_rva)))
      (local.set $no_ilt (i32.eqz (local.get $ilt_rva)))
      (if (local.get $no_ilt) (then (local.set $ilt_rva (local.get $iat_rva))))
      ;; Check if this descriptor's DLL name matches
      (local.set $dll_name_rva (i32.load (i32.add (local.get $desc_ptr) (i32.const 12))))
      (local.set $dll_name_ga (i32.add (local.get $caller_base) (local.get $dll_name_rva)))
      (if (call $dll_name_match (local.get $dll_name_ga) (call $g2w (local.get $target_dll_name_ptr)))
        (then
          ;; Found matching descriptor — patch all IAT entries
          (local.set $ilt_ptr (call $g2w (i32.add (local.get $caller_base) (local.get $ilt_rva))))
          (local.set $iat_ptr (call $g2w (i32.add (local.get $caller_base) (local.get $iat_rva))))
          (block $fd (loop $fl
            (local.set $entry (i32.load (local.get $ilt_ptr)))
            (br_if $fd (i32.eqz (local.get $entry)))
            (if (local.get $no_ilt)
              (then (local.set $entry
                (call $iat_slot_name_rva (local.get $caller_base) (local.get $entry)))))
            (local.set $resolved (i32.const 0))
            (if (i32.eqz (local.get $entry))
              (then) ;; already resolved, or nothing recoverable to resolve by
            (else (if (i32.and (local.get $entry) (i32.const 0x80000000))
              (then
                ;; Ordinal import
                (local.set $resolved (call $resolve_ordinal (local.get $dll_idx)
                  (i32.and (local.get $entry) (i32.const 0xFFFF)))))
              (else
                ;; Name import
                (local.set $name_wa
                  (call $g2w (i32.add (local.get $caller_base) (i32.add (local.get $entry) (i32.const 2)))))
                (local.set $api_id (call $native_override_export_api_id (local.get $name_wa)))
                ;; CRT exports with a native handler that can defer to the
                ;; authentic code (09a6-handlers-crt.wat): only for the real
                ;; MSVCRT/MSVCR7x, and only when the export exists to defer to.
                (local.set $crt_real (i32.const 0))
                ;; An older override that is locale-sensitive (_stricmp) still
                ;; gets its authentic export recorded when it comes from a real
                ;; MSVCRT/MSVCR7x, so it can defer once setlocale leaves "C".
                ;; Without the export it stays native, as it always was.
                (if (i32.and
                      (i32.ne (local.get $api_id) (i32.const -1))
                      (call $crt_dll_is_msvcr (local.get $target_dll_name_ptr)))
                  (then
                    (if (call $crt_native_override_defers (local.get $name_wa))
                      (then
                        (local.set $crt_real
                          (call $resolve_name_export (local.get $dll_idx) (local.get $name_wa)))))))
                (if (i32.and
                      (i32.eq (local.get $api_id) (i32.const -1))
                      (call $crt_dll_is_msvcr (local.get $target_dll_name_ptr)))
                  (then
                    (local.set $api_id (call $crt_override_api_id (local.get $name_wa)))
                    (if (i32.ne (local.get $api_id) (i32.const -1))
                      (then
                        (local.set $crt_real
                          (call $resolve_name_export (local.get $dll_idx) (local.get $name_wa)))
                        (if (i32.eqz (local.get $crt_real))
                          (then (local.set $api_id (i32.const -1))))))))
                (if (i32.ne (local.get $api_id) (i32.const -1))
                  (then
                    ;; Same reservation as above: this patching path runs
                    ;; whenever a DLL loads, on whichever thread loaded it.
                    (global.set $num_thunks (call $thunk_reserve))
                    ;; A full fallback table binds this import to the real
                    ;; export after all (the reserved thunk just goes unused).
                    (if (local.get $crt_real)
                      (then
                        (if (i32.eqz (call $crt_override_record
                              (global.get $num_thunks) (local.get $crt_real)))
                          (then
                            (local.set $api_id (i32.const -1))))))))
                (if (i32.ne (local.get $api_id) (i32.const -1))
                  (then
                    (local.set $thunk_addr (i32.add
                      (i32.sub (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8)))
                               (global.get $GUEST_BASE))
                      (global.get $image_base)))
                    (i32.store (local.get $iat_ptr) (local.get $thunk_addr))
                    (i32.store (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8)))
                      (i32.sub (i32.add (local.get $caller_base) (local.get $entry)) (global.get $image_base)))
                    (i32.store (i32.add (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))) (i32.const 4))
                      (local.get $api_id))
                    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
                    (call $update_thunk_end)
                    (local.set $resolved (i32.const 0)))
                  (else
                    (local.set $resolved
                      (call $resolve_name_export (local.get $dll_idx) (local.get $name_wa)))))))))
            (if (local.get $resolved)
              (then (i32.store (local.get $iat_ptr) (local.get $resolved))))
            (local.set $ilt_ptr (i32.add (local.get $ilt_ptr) (i32.const 4)))
            (local.set $iat_ptr (i32.add (local.get $iat_ptr) (i32.const 4)))
            (br $fl)))))
      (local.set $desc_ptr (i32.add (local.get $desc_ptr) (i32.const 20)))
      (br $dl))))

  ;; Resolve an export straight out of a mapped image's export directory,
  ;; without a DLL_TABLE entry behind it. The running EXE is the case this
  ;; exists for: an EXE can export, and a DLL that ships with it can import
  ;; from it. Warcraft III's Game.dll does exactly that — 460 of its imports
  ;; are ordinals into War3Demo.exe, which exports 695 functions — and the EXE
  ;; is not in DLL_TABLE, so $resolve_ordinal cannot see it.
  ;;
  ;; Pass $name_wa = 0 for an ordinal import; otherwise $ordinal is ignored.
  ;; Returns the guest address, or 0 when the export is absent.
  (func $resolve_image_export
    (param $base i32) (param $exp_rva i32) (param $ordinal i32) (param $name_wa i32)
    (result i32)
    (local $exp_wa i32) (local $idx i32) (local $aof_rva i32) (local $aon_rva i32)
    (local $ano_rva i32) (local $num_names i32) (local $i i32) (local $name_rva i32)
    (local $func_rva i32) (local $found i32)
    (if (i32.eqz (local.get $exp_rva)) (then (return (i32.const 0))))
    (local.set $exp_wa (call $g2w (i32.add (local.get $base) (local.get $exp_rva))))
    (local.set $aof_rva (i32.load (i32.add (local.get $exp_wa) (i32.const 28))))
    (if (local.get $name_wa)
      (then
        (local.set $aon_rva (i32.load (i32.add (local.get $exp_wa) (i32.const 32))))
        (local.set $ano_rva (i32.load (i32.add (local.get $exp_wa) (i32.const 36))))
        (local.set $num_names (i32.load (i32.add (local.get $exp_wa) (i32.const 24))))
        (block $done (loop $search
          (br_if $done (i32.ge_u (local.get $i) (local.get $num_names)))
          (local.set $name_rva (i32.load (call $g2w (i32.add (local.get $base)
            (i32.add (local.get $aon_rva) (i32.shl (local.get $i) (i32.const 2)))))))
          (if (call $str_eq (local.get $name_wa)
                (call $g2w (i32.add (local.get $base) (local.get $name_rva))))
            (then
              (local.set $idx (i32.load16_u (call $g2w (i32.add (local.get $base)
                (i32.add (local.get $ano_rva) (i32.shl (local.get $i) (i32.const 1)))))))
              (local.set $found (i32.const 1))
              (br $done)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $search)))
        (if (i32.eqz (local.get $found)) (then (return (i32.const 0)))))
      (else
        (local.set $idx (i32.sub (local.get $ordinal)
          (i32.load (i32.add (local.get $exp_wa) (i32.const 16)))))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_u (local.get $idx)
                              (i32.load (i32.add (local.get $exp_wa) (i32.const 20)))))
          (then (return (i32.const 0))))))
    (local.set $func_rva (i32.load (call $g2w (i32.add (local.get $base)
      (i32.add (local.get $aof_rva) (i32.shl (local.get $idx) (i32.const 2)))))))
    (if (result i32) (i32.eqz (local.get $func_rva))
      (then (i32.const 0))
      (else (i32.add (local.get $base) (local.get $func_rva)))))

  ;; Patch one import descriptor of $caller_base against a mapped image that is
  ;; not a loaded DLL — the EXE. Same walk as $patch_caller_iat, but every
  ;; entry resolves through the provider's own export directory: an unresolved
  ;; entry is left alone so it keeps whatever the API-thunk pass put there and
  ;; still fails loudly if it is called.
  (func $patch_caller_iat_image (export "patch_caller_iat_image")
    (param $caller_base i32) (param $caller_import_rva i32)
    (param $target_dll_name_ptr i32)
    (param $provider_base i32) (param $provider_export_rva i32)
    (result i32)
    (local $desc_ptr i32) (local $ilt_rva i32) (local $iat_rva i32)
    (local $dll_name_rva i32) (local $ilt_ptr i32) (local $iat_ptr i32)
    (local $entry i32) (local $resolved i32) (local $patched i32) (local $no_ilt i32)
    (local.set $desc_ptr (call $g2w (i32.add (local.get $caller_base) (local.get $caller_import_rva))))
    (block $id (loop $dl
      (local.set $ilt_rva (i32.load (local.get $desc_ptr)))
      (local.set $iat_rva (i32.load (i32.add (local.get $desc_ptr) (i32.const 16))))
      (br_if $id (i32.eqz (local.get $iat_rva)))
      (local.set $no_ilt (i32.eqz (local.get $ilt_rva)))
      (if (local.get $no_ilt) (then (local.set $ilt_rva (local.get $iat_rva))))
      (local.set $dll_name_rva (i32.load (i32.add (local.get $desc_ptr) (i32.const 12))))
      (if (call $dll_name_match
            (i32.add (local.get $caller_base) (local.get $dll_name_rva))
            (call $g2w (local.get $target_dll_name_ptr)))
        (then
          (local.set $ilt_ptr (call $g2w (i32.add (local.get $caller_base) (local.get $ilt_rva))))
          (local.set $iat_ptr (call $g2w (i32.add (local.get $caller_base) (local.get $iat_rva))))
          (block $fd (loop $fl
            (local.set $entry (i32.load (local.get $ilt_ptr)))
            (br_if $fd (i32.eqz (local.get $entry)))
            (if (local.get $no_ilt)
              (then (local.set $entry
                (call $iat_slot_name_rva (local.get $caller_base) (local.get $entry)))))
            (local.set $resolved (i32.const 0))
            (if (i32.eqz (local.get $entry))
              (then)
            (else (if (i32.and (local.get $entry) (i32.const 0x80000000))
              (then
                (local.set $resolved (call $resolve_image_export
                  (local.get $provider_base) (local.get $provider_export_rva)
                  (i32.and (local.get $entry) (i32.const 0xFFFF)) (i32.const 0))))
              (else
                (local.set $resolved (call $resolve_image_export
                  (local.get $provider_base) (local.get $provider_export_rva) (i32.const 0)
                  (call $g2w (i32.add (local.get $caller_base)
                                      (i32.add (local.get $entry) (i32.const 2))))))))))
            (if (local.get $resolved)
              (then
                (i32.store (local.get $iat_ptr) (local.get $resolved))
                (local.set $patched (i32.add (local.get $patched) (i32.const 1)))))
            (local.set $ilt_ptr (i32.add (local.get $ilt_ptr) (i32.const 4)))
            (local.set $iat_ptr (i32.add (local.get $iat_ptr) (i32.const 4)))
            (br $fl)))))
      (local.set $desc_ptr (i32.add (local.get $desc_ptr) (i32.const 20)))
      (br $dl)))
    (local.get $patched))

  ;; Get next available DLL load address (page-aligned after last DLL AND after heap)
  ;; Named as well as exported: WAT-side callers load DLLs too. The WinHelp
  ;; engine loads a help file's own DLL when a registered macro is called,
  ;; without a round trip through the host.
  ;; The last address $next_dll_addr handed this instance (0 once claimed).
  (global $dll_pick_addr (mut i32) (i32.const 0))
  (func $next_dll_addr (export "get_next_dll_addr") (result i32)
    (local $addr i32) (local $after_dll i32) (local $mark i32) (local $i i32) (local $end i32)
    ;; High-water rows may be retired, reused out of order, or sparse. Only
    ;; retained direct reservations constrain the next low image placement.
    (local.set $after_dll (i32.and
      (i32.add (i32.add (global.get $image_base) (global.get $exe_size_of_image)) (i32.const 0xFFF))
      (i32.const 0xFFFFF000)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (i32.atomic.load (global.get $DLL_SHARED))))
      (local.set $addr (call $dll_lifecycle_row (local.get $i)))
      (if (i32.eqz (i32.load offset=32 (local.get $addr)))
        (then
          (local.set $end (i32.and
            (i32.add (i32.add (i32.load offset=36 (local.get $addr))
              (i32.load offset=40 (local.get $addr))) (i32.const 0xFFF)) (i32.const 0xFFFFF000)))
          (if (i32.gt_u (local.get $end) (local.get $after_dll))
            (then (local.set $after_dll (local.get $end))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    ;; Return max(after_dll, page_aligned(low-heap watermark)) to avoid
    ;; overwriting the heap. The watermark is the top of every instance's
    ;; reserved arena, which is what has to be cleared — one instance's
    ;; $heap_ptr would say nothing about the others'.
    (local.set $mark (call $heap_low_watermark))
    (if (i32.gt_u (local.get $mark) (local.get $after_dll))
      (then (local.set $after_dll
        (i32.and (i32.add (local.get $mark) (i32.const 0xFFF)) (i32.const 0xFFFFF000)))))
    ;; $dll_claim_low treats this address as picked, not fixed.
    (global.set $dll_pick_addr (local.get $after_dll))
    (local.get $after_dll))

  (func (export "get_exe_size_of_image") (result i32) (global.get $exe_size_of_image))
  (func (export "get_exe_stack_reserve") (result i32) (global.get $exe_stack_reserve))
  (func (export "get_exe_export_rva") (result i32) (global.get $exe_export_rva))
  (func (export "has_shared_dll_registry") (result i32) (i32.const 1))
  (func (export "get_dll_count") (result i32) (i32.atomic.load (global.get $DLL_SHARED)))
  (func (export "get_dll_capacity") (result i32) (global.get $DLL_TABLE_CAPACITY))

  ;; Pin a mapped image for a bounded metadata/API operation. Other threads
  ;; cannot enter a detaching image; its owning callback may still inspect it.
  (func $dll_pin_module (param $module i32) (result i32)
    (local $index i32) (local $row i32) (local $state i32) (local $pins i32) (local $result i32)
    (call $dll_load_lock_begin)
    (block $done
      (local.set $index (call $dll_index_from_module (local.get $module)))
      (br_if $done (i32.lt_s (local.get $index) (i32.const 0)))
      (local.set $row (call $dll_lifecycle_row (local.get $index)))
      (local.set $state (i32.load (local.get $row)))
      (br_if $done (i32.or (i32.eq (local.get $state) (global.get $DLL_LIFE_FREE))
        (i32.eq (local.get $state) (global.get $DLL_LIFE_FAILED))))
      (br_if $done (i32.and (i32.eq (local.get $state) (global.get $DLL_LIFE_DETACHING))
        (i32.ne (i32.load offset=56 (local.get $row)) (global.get $current_thread_id))))
      (local.set $pins (i32.load offset=12 (local.get $row)))
      (br_if $done (i32.eq (local.get $pins) (i32.const -1)))
      (i32.store offset=12 (local.get $row) (i32.add (local.get $pins) (i32.const 1)))
      (local.set $result (i32.add (local.get $index) (i32.const 1))))
    (call $lock_release (global.get $DLL_LOAD_LOCK))
    (local.get $result))
  (global $dll_drain_pending (mut i32) (i32.const 0))
  (func $dll_unpin_module_index (param $pin i32)
    (local $row i32) (local $pins i32)
    (if (i32.eqz (local.get $pin)) (then (return)))
    (call $dll_load_lock_begin)
    (local.set $row (call $dll_lifecycle_row (i32.sub (local.get $pin) (i32.const 1))))
    (local.set $pins (i32.load offset=12 (local.get $row)))
    (if (i32.eqz (local.get $pins)) (then (unreachable)))
    (i32.store offset=12 (local.get $row) (i32.sub (local.get $pins) (i32.const 1)))
    ;; A concurrent FreeLibrary may already have removed the last root while
    ;; this reader kept the image alive. The completed API must drain it even
    ;; if the application never calls another loader API.
    (if (i32.and (i32.eq (local.get $pins) (i32.const 1))
          (i32.and (i32.eqz (i32.load offset=8 (local.get $row)))
            (i32.eq (i32.load (local.get $row)) (global.get $DLL_LIFE_LIVE))))
      (then (global.set $dll_drain_pending (i32.const 1))))
    (call $lock_release (global.get $DLL_LOAD_LOCK)))

  ;; One coherent registry read, with no guest callback or host import held.
  (func $dll_thread_notifications_enabled (export "dll_thread_notifications_enabled") (param $module i32) (result i32)
    (local $value i32)
    (call $dll_load_lock_begin)
    (local.set $value (call $dll_thread_notifications_enabled_locked (local.get $module)))
    (call $lock_release (global.get $DLL_LOAD_LOCK))
    (local.get $value))

  ;; One coherent registry read, with no guest callback or host import held.
  (func $dll_disable_thread_notifications (param $module i32) (result i32)
    (local $value i32)
    (call $dll_load_lock_begin)
    (local.set $value (call $dll_disable_thread_notifications_locked (local.get $module)))
    (call $lock_release (global.get $DLL_LOAD_LOCK))
    (local.get $value))

  ;; One coherent registry read, with no guest callback or host import held.
  (func $resolve_ordinal (param $dll_idx i32) (param $ordinal i32) (result i32)
    (local $value i32)
    (call $dll_load_lock_begin)
    (local.set $value (call $resolve_ordinal_locked (local.get $dll_idx) (local.get $ordinal)))
    (call $lock_release (global.get $DLL_LOAD_LOCK))
    (local.get $value))

  ;; One coherent registry read, with no guest callback or host import held.
  (func $resolve_name_export (param $dll_idx i32) (param $name_wa i32) (result i32)
    (local $value i32)
    (call $dll_load_lock_begin)
    (local.set $value (call $resolve_name_export_locked (local.get $dll_idx) (local.get $name_wa)))
    (call $lock_release (global.get $DLL_LOAD_LOCK))
    (local.get $value))

  ;; Record the loader-owned template allocation separately from TLS vector
  ;; contents: guest TlsSetValue may replace a vector entry later.
  (func $dll_static_tls_attach (param $index i32) (param $directory i32)
    (local $slot i32) (local $row i32)
    (local.set $slot (call $static_tls_attach_owned (local.get $directory)))
    (if (i32.eqz (local.get $slot)) (then (return)))
    (local.set $row (i32.add (global.get $DLL_STATIC_TLS_TABLE) (i32.shl (local.get $index) (i32.const 4))))
    (i32.store (local.get $row) (local.get $slot))
    (i32.store offset=4 (local.get $row)
      (call $gl32 (i32.add (global.get $tls_slots) (i32.shl (i32.sub (local.get $slot) (i32.const 1)) (i32.const 2))))))
  ;; Invoked after every detach callback, before final metadata retirement.
  ;; No loader lock spans the TLS/heap allocator locks.
  (func $release_dll_static_tls (export "release_dll_static_tls")
      (param $index i32) (param $generation i32) (param $token i32)
    (local $life i32) (local $row i32) (local $slot i32) (local $data i32) (local $path i32)
    (call $dll_load_lock_begin)
    (local.set $life (call $dll_lifecycle_row (local.get $index)))
    (if (i32.or (i32.ne (i32.load (local.get $life)) (global.get $DLL_LIFE_DETACHING))
      (i32.or (i32.ne (i32.load offset=4 (local.get $life)) (local.get $generation))
        (i32.ne (i32.load offset=44 (local.get $life)) (local.get $token)))) (then (unreachable)))
    (local.set $row (i32.add (global.get $DLL_STATIC_TLS_TABLE) (i32.shl (local.get $index) (i32.const 4))))
    (local.set $path (i32.load offset=60 (local.get $life)))
    (i32.store offset=60 (local.get $life) (i32.const 0))
    (i32.store (i32.add (global.get $DLL_PATH_TABLE) (i32.shl (local.get $index) (i32.const 2))) (i32.const 0))
    (local.set $slot (i32.load (local.get $row)))
    (local.set $data (i32.load offset=4 (local.get $row)))
    (memory.fill (local.get $row) (i32.const 0) (i32.const 16))
    (call $lock_release (global.get $DLL_LOAD_LOCK))
    (if (local.get $slot) (then (drop (call $tls_release_index (i32.sub (local.get $slot) (i32.const 1))))))
    (if (local.get $data) (then (call $heap_free (local.get $data))))
    (if (local.get $path) (then (call $heap_free (local.get $path)))))

  ;; Separate from short metadata locking: JS owns this recursive callback
  ;; gate and awaits contention without blocking host RPC/byte resolution.
  ;; The metadata mutex uses bytes 0..7 of its dedicated 64-byte cache line.
  ;; Callback owner/depth use bytes 16..23; neither releases the other lock.
  (func (export "get_dll_callback_lock") (result i32)
    (region.addr $DLL_LOAD_LOCK 16))
  (func (export "get_dll_callback_owner") (result i32) (call $lock_owner_id))

  ;; Owned affine backing is retained for safe reuse, but a retired mapping
  ;; is guest MEM_FREE, not the permissive unknown-low-address fallback.
  ;; Caller holds DLL_LOAD_LOCK while consulting this reservation metadata.
  (func $dll_retired_reservation_end (param $address i32) (result i32)
    (local $index i32) (local $life i32) (local $base i32) (local $size i32)
    (block $none (loop $scan
      (br_if $none (i32.ge_u (local.get $index) (i32.atomic.load (global.get $DLL_SHARED))))
      (local.set $life (call $dll_lifecycle_row (local.get $index)))
      (local.set $base (i32.load offset=36 (local.get $life)))
      (local.set $size (i32.load offset=40 (local.get $life)))
      (if (i32.and (i32.ne (local.get $base) (i32.const 0))
            (i32.lt_u (i32.sub (local.get $address) (local.get $base)) (local.get $size)))
        (then
          (if (i32.or (i32.eqz (i32.load (local.get $life)))
                (i32.ge_u (i32.sub (local.get $address) (local.get $base))
                  (i32.load offset=4 (i32.add (global.get $DLL_TABLE) (i32.shl (local.get $index) (i32.const 5))))))
            (then (return (i32.add (local.get $base) (local.get $size)))))))
      (local.set $index (i32.add (local.get $index) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func (export "get_dll_path_table") (result i32) (global.get $DLL_PATH_TABLE))
