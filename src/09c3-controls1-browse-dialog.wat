  ;; ============================================================
  ;; SHBrowseForFolderA — classic Win98 shell folder picker
  ;; ============================================================

  ;; Insert one TreeView item. path_data is either a guest path pointer or one
  ;; of the private virtual-folder sentinels 1=Desktop, 2=My Computer,
  ;; 3=Network Neighborhood. TreeView copies label_guest immediately.
  (func $browse_tree_insert
    (param $tree i32) (param $parent i32) (param $label_guest i32)
    (param $path_data i32) (param $has_children i32) (param $expanded i32)
    (result i32)
    (local $insert_g i32) (local $insert_w i32) (local $item i32)
    (local.set $insert_g (call $heap_alloc (i32.const 48)))
    (if (i32.eqz (local.get $insert_g)) (then (return (i32.const 0))))
    (local.set $insert_w (call $g2w (local.get $insert_g)))
    (call $zero_memory (local.get $insert_w) (i32.const 48))
    (i32.store (local.get $insert_w) (local.get $parent))
    (i32.store offset=4 (local.get $insert_w) (i32.const 0xFFFF0002)) ;; TVI_LAST
    (i32.store offset=8 (local.get $insert_w) (i32.const 0x4D)) ;; TEXT|PARAM|STATE|CHILDREN
    (i32.store offset=16 (local.get $insert_w)
      (select (i32.const 0x20) (i32.const 0) (local.get $expanded)))
    (i32.store offset=20 (local.get $insert_w) (i32.const 0x20))
    (i32.store offset=24 (local.get $insert_w) (local.get $label_guest))
    (i32.store offset=28 (local.get $insert_w) (i32.const 260))
    (i32.store offset=40 (local.get $insert_w) (local.get $has_children))
    (i32.store offset=44 (local.get $insert_w) (local.get $path_data))
    (local.set $item (call $wnd_send_message
      (local.get $tree) (i32.const 0x1100) (i32.const 0) (local.get $insert_g)))
    (call $heap_free (local.get $insert_g))
    (local.get $item))

  ;; Stable WAT string variant for shell-owned labels. The TreeView takes its
  ;; own copy during TVM_INSERTITEM, so release the temporary guest conversion.
  (func $browse_tree_insert_wat
    (param $tree i32) (param $parent i32) (param $label_wa i32) (param $label_len i32)
    (param $path_data i32) (param $has_children i32) (param $expanded i32)
    (result i32)
    (local $label_g i32) (local $item i32)
    (local.set $label_g (call $wat_str_to_heap (local.get $label_wa) (local.get $label_len)))
    (if (i32.eqz (local.get $label_g)) (then (return (i32.const 0))))
    (local.set $item (call $browse_tree_insert
      (local.get $tree) (local.get $parent) (local.get $label_g)
      (local.get $path_data) (local.get $has_children) (local.get $expanded)))
    (call $heap_free (local.get $label_g))
    (local.get $item))

  (func $browse_set_item_children (param $tree i32) (param $item i32) (param $has_children i32)
    (local $tvitem_g i32) (local $tvitem_w i32)
    (local.set $tvitem_g (call $heap_alloc (i32.const 40)))
    (if (i32.eqz (local.get $tvitem_g)) (then (return)))
    (local.set $tvitem_w (call $g2w (local.get $tvitem_g)))
    (call $zero_memory (local.get $tvitem_w) (i32.const 40))
    (i32.store (local.get $tvitem_w) (i32.const 0x40)) ;; TVIF_CHILDREN
    (i32.store offset=4 (local.get $tvitem_w) (local.get $item))
    (i32.store offset=32 (local.get $tvitem_w) (local.get $has_children))
    (drop (call $wnd_send_message
      (local.get $tree) (i32.const 0x110D) (i32.const 0) (local.get $tvitem_g)))
    (call $heap_free (local.get $tvitem_g)))

  ;; Query whether path has at least one real subdirectory. FindFirstFile also
  ;; returns synthetic "." and ".." records; those are navigation metadata,
  ;; not children in the shell namespace tree.
  (func $browse_path_has_dirs (param $path_g i32) (result i32)
    (local $pattern_g i32) (local $pattern_w i32) (local $path_w i32)
    (local $fd_g i32) (local $fd_w i32) (local $find i32)
    (local $len i32) (local $name_w i32) (local $found i32)
    (if (i32.eqz (local.get $path_g)) (then (return (i32.const 0))))
    (local.set $path_w (call $g2w (local.get $path_g)))
    (local.set $len (call $strlen (local.get $path_w)))
    (if (i32.or (i32.eqz (local.get $len)) (i32.gt_u (local.get $len) (i32.const 257)))
      (then (return (i32.const 0))))
    (local.set $pattern_g (call $heap_alloc (i32.const 260)))
    (local.set $fd_g (call $heap_alloc (i32.const 320)))
    (if (i32.or (i32.eqz (local.get $pattern_g)) (i32.eqz (local.get $fd_g)))
      (then
        (call $heap_free (local.get $pattern_g))
        (call $heap_free (local.get $fd_g))
        (return (i32.const 0))))
    (local.set $pattern_w (call $g2w (local.get $pattern_g)))
    (local.set $fd_w (call $g2w (local.get $fd_g)))
    (call $memcpy (local.get $pattern_w) (local.get $path_w) (local.get $len))
    (if (i32.ne
          (i32.load8_u (i32.add (local.get $path_w) (i32.sub (local.get $len) (i32.const 1))))
          (i32.const 0x5C))
      (then
        (i32.store8 (i32.add (local.get $pattern_w) (local.get $len)) (i32.const 0x5C))
        (local.set $len (i32.add (local.get $len) (i32.const 1)))))
    (i32.store8 (i32.add (local.get $pattern_w) (local.get $len)) (i32.const 0x2A))
    (i32.store8 (i32.add (local.get $pattern_w) (i32.add (local.get $len) (i32.const 1))) (i32.const 0))
    (local.set $find (call $host_fs_find_first_file
      (local.get $pattern_w) (local.get $fd_g) (i32.const 0)))
    (if (i32.ne (local.get $find) (i32.const -1))
      (then
        (block $done (loop $entries
          (local.set $name_w (i32.add (local.get $fd_w) (i32.const 44)))
          (if (i32.and
                (i32.ne (i32.and (i32.load (local.get $fd_w)) (i32.const 0x10)) (i32.const 0))
                (i32.eqz
                  (i32.and
                    (i32.eq (i32.load8_u (local.get $name_w)) (i32.const 46))
                    (i32.or
                      (i32.eqz (i32.load8_u offset=1 (local.get $name_w)))
                      (i32.and
                        (i32.eq (i32.load8_u offset=1 (local.get $name_w)) (i32.const 46))
                        (i32.eqz (i32.load8_u offset=2 (local.get $name_w))))))))
            (then (local.set $found (i32.const 1)) (br $done)))
          (br_if $done (i32.eqz (call $host_fs_find_next_file
            (local.get $find) (local.get $fd_g) (i32.const 0))))
          (br $entries)))
        (drop (call $host_fs_find_close (local.get $find)))))
    (call $heap_free (local.get $fd_g))
    (call $heap_free (local.get $pattern_g))
    (local.get $found))

  ;; Materialize a directory's children the first time its expansion button is
  ;; pressed. Returns the number inserted, or 1 when already materialized.
  (func $browse_populate_children
    (param $tree i32) (param $parent i32) (param $path_g i32) (result i32)
    (local $pattern_g i32) (local $pattern_w i32) (local $path_w i32)
    (local $fd_g i32) (local $fd_w i32) (local $find i32)
    (local $len i32) (local $name_w i32) (local $name_len i32)
    (local $full_g i32) (local $full_w i32) (local $full_len i32)
    (local $sep i32) (local $item i32) (local $count i32)
    (if (call $wnd_send_message
          (local.get $tree) (i32.const 0x110A) (i32.const 4) (local.get $parent))
      (then (return (i32.const 1))))
    (if (i32.eqz (local.get $path_g)) (then (return (i32.const 0))))
    (local.set $path_w (call $g2w (local.get $path_g)))
    (local.set $len (call $strlen (local.get $path_w)))
    (if (i32.or (i32.eqz (local.get $len)) (i32.gt_u (local.get $len) (i32.const 257)))
      (then (return (i32.const 0))))
    (local.set $pattern_g (call $heap_alloc (i32.const 260)))
    (local.set $fd_g (call $heap_alloc (i32.const 320)))
    (if (i32.or (i32.eqz (local.get $pattern_g)) (i32.eqz (local.get $fd_g)))
      (then
        (call $heap_free (local.get $pattern_g))
        (call $heap_free (local.get $fd_g))
        (return (i32.const 0))))
    (local.set $pattern_w (call $g2w (local.get $pattern_g)))
    (local.set $fd_w (call $g2w (local.get $fd_g)))
    (call $memcpy (local.get $pattern_w) (local.get $path_w) (local.get $len))
    (local.set $sep
      (i32.ne
        (i32.load8_u (i32.add (local.get $path_w) (i32.sub (local.get $len) (i32.const 1))))
        (i32.const 0x5C)))
    (if (local.get $sep)
      (then
        (i32.store8 (i32.add (local.get $pattern_w) (local.get $len)) (i32.const 0x5C))
        (local.set $len (i32.add (local.get $len) (i32.const 1)))))
    (i32.store8 (i32.add (local.get $pattern_w) (local.get $len)) (i32.const 0x2A))
    (i32.store8 (i32.add (local.get $pattern_w) (i32.add (local.get $len) (i32.const 1))) (i32.const 0))
    (local.set $find (call $host_fs_find_first_file
      (local.get $pattern_w) (local.get $fd_g) (i32.const 0)))
    (if (i32.ne (local.get $find) (i32.const -1))
      (then
        (block $done (loop $entries
          (local.set $name_w (i32.add (local.get $fd_w) (i32.const 44)))
          (if (i32.and
                (i32.ne (i32.and (i32.load (local.get $fd_w)) (i32.const 0x10)) (i32.const 0))
                (i32.eqz
                  (i32.and
                    (i32.eq (i32.load8_u (local.get $name_w)) (i32.const 46))
                    (i32.or
                      (i32.eqz (i32.load8_u offset=1 (local.get $name_w)))
                      (i32.and
                        (i32.eq (i32.load8_u offset=1 (local.get $name_w)) (i32.const 46))
                        (i32.eqz (i32.load8_u offset=2 (local.get $name_w))))))))
            (then
              (local.set $name_len (call $strlen (local.get $name_w)))
              (local.set $full_len
                (i32.add (local.get $len) (local.get $name_len)))
              (if (i32.lt_u (local.get $full_len) (i32.const 260))
                (then
                  (local.set $full_g (call $heap_alloc
                    (i32.add (local.get $full_len) (i32.const 1))))
                  (if (local.get $full_g)
                    (then
                      (local.set $full_w (call $g2w (local.get $full_g)))
                      (call $memcpy (local.get $full_w) (local.get $pattern_w) (local.get $len))
                      (call $memcpy (i32.add (local.get $full_w) (local.get $len))
                        (local.get $name_w) (i32.add (local.get $name_len) (i32.const 1)))
                      (local.set $item (call $browse_tree_insert
                        (local.get $tree) (local.get $parent)
                        (i32.add (local.get $fd_g) (i32.const 44))
                        (local.get $full_g)
                        (call $browse_path_has_dirs (local.get $full_g))
                        (i32.const 0)))
                      (if (local.get $item)
                        (then (local.set $count (i32.add (local.get $count) (i32.const 1))))
                        (else (call $heap_free (local.get $full_g))))))))))
          (br_if $done (i32.eqz (call $host_fs_find_next_file
            (local.get $find) (local.get $fd_g) (i32.const 0))))
          (br $entries)))
        (drop (call $host_fs_find_close (local.get $find)))))
    (call $heap_free (local.get $fd_g))
    (call $heap_free (local.get $pattern_g))
    (if (i32.eqz (local.get $count))
      (then (call $browse_set_item_children
        (local.get $tree) (local.get $parent) (i32.const 0))))
    (local.get $count))

  ;; Read an item's private path/sentinel after verifying that it belongs to
  ;; this TreeView rather than another live control sharing TV_TABLE.
  (func $browse_item_data (param $tree i32) (param $item i32) (result i32)
    (local $slot i32) (local $data i32)
    (local.set $slot (call $tv_find_slot (local.get $item)))
    (if (i32.ne (local.get $slot) (i32.const -1))
      (then
        (if (i32.eq (i32.load (call $tv_owner_cell (local.get $slot))) (local.get $tree))
          (then
            (local.set $data (i32.load offset=24
              (i32.add (global.get $TV_TABLE) (i32.mul (local.get $slot) (i32.const 32)))))))))
    (local.get $data))

  (func $browse_selection_allowed (param $dlg i32) (param $item i32) (result i32)
    (local $tree i32) (local $bi i32) (local $data i32) (local $flags i32)
    (local.set $tree (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x470)))
    (local.set $bi (call $wnd_get_userdata (local.get $dlg)))
    (if (i32.or (i32.eqz (local.get $tree)) (i32.eqz (local.get $bi)))
      (then (return (i32.const 0))))
    (local.set $data (call $browse_item_data (local.get $tree) (local.get $item)))
    (if (i32.eqz (local.get $data)) (then (return (i32.const 0))))
    (local.set $flags (call $gl32 (i32.add (local.get $bi) (i32.const 16))))
    ;; BIF_RETURNONLYFSDIRS excludes Desktop/My Computer/Network but accepts
    ;; every real directory path. Other Win98 flag combinations may select a
    ;; virtual shell folder and receive its opaque PIDL.
    (if (i32.and
          (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))
          (i32.le_u (local.get $data) (i32.const 3)))
      (then (return (i32.const 0))))
    (i32.const 1))

  ;; Release only the path buffers created by this shell dialog. TreeView owns
  ;; its copied labels, while virtual-folder sentinels are small integers.
  (func $browse_release_paths (param $tree i32)
    (local $i i32) (local $base i32) (local $data i32)
    (block $done (loop $items
      (br_if $done (i32.ge_u (local.get $i) (call $tv_slot_limit)))
      (local.set $base
        (i32.add (global.get $TV_TABLE) (i32.mul (local.get $i) (i32.const 32))))
      (if (i32.and
            (i32.ne (i32.load (local.get $base)) (i32.const 0))
            (i32.eq (i32.load (call $tv_owner_cell (local.get $i))) (local.get $tree)))
        (then
          (local.set $data (i32.load offset=24 (local.get $base)))
          (if (i32.gt_u (local.get $data) (i32.const 3))
            (then (call $heap_free (local.get $data))))
          (i32.store offset=24 (local.get $base) (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items))))

  ;; Runs only in the instance that owns the parked SHBrowseForFolder call.
  ;; The renderer-side shadow passes an HTREEITEM through shared modal state;
  ;; PIDL allocation and caller-buffer writeback happen here on the owner heap.
  (func $browse_modal_finish (param $dlg i32) (param $item i32) (result i32)
    (local $tree i32) (local $bi i32) (local $bi_w i32)
    (local $data i32) (local $pidl i32)
    (local $tvitem_g i32) (local $tvitem_w i32) (local $text_g i32)
    (local $text_w i32) (local $display_g i32) (local $display_w i32)
    (local $len i32)
    (local.set $tree (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x470)))
    (local.set $bi (call $wnd_get_userdata (local.get $dlg)))
    (if (i32.and
          (i32.and
            (i32.ne (local.get $tree) (i32.const 0))
            (i32.ne (local.get $bi) (i32.const 0)))
          (call $browse_selection_allowed (local.get $dlg) (local.get $item)))
      (then
        (local.set $bi_w (call $g2w (local.get $bi)))
        (local.set $tvitem_g (call $heap_alloc (i32.const 40)))
        (local.set $text_g (call $heap_alloc (i32.const 260)))
        (if (i32.and (local.get $tvitem_g) (local.get $text_g))
          (then
            (local.set $tvitem_w (call $g2w (local.get $tvitem_g)))
            (local.set $text_w (call $g2w (local.get $text_g)))
            (call $zero_memory (local.get $tvitem_w) (i32.const 40))
            (i32.store (local.get $tvitem_w) (i32.const 0x5)) ;; TVIF_TEXT|PARAM
            (i32.store offset=4 (local.get $tvitem_w) (local.get $item))
            (i32.store offset=16 (local.get $tvitem_w) (local.get $text_g))
            (i32.store offset=20 (local.get $tvitem_w) (i32.const 260))
            (if (call $wnd_send_message
                  (local.get $tree) (i32.const 0x110C) (i32.const 0) (local.get $tvitem_g))
              (then
                (local.set $data (i32.load offset=36 (local.get $tvitem_w)))
                (if (i32.eq (local.get $data) (i32.const 1))
                  (then (local.set $pidl (call $shell_virtual_pidl_from_csidl (i32.const 0)))))
                (if (i32.eq (local.get $data) (i32.const 2))
                  (then (local.set $pidl (call $shell_virtual_pidl_from_csidl (i32.const 0x11)))))
                (if (i32.eq (local.get $data) (i32.const 3))
                  (then (local.set $pidl (call $shell_virtual_pidl_from_csidl (i32.const 0x12)))))
                (if (i32.gt_u (local.get $data) (i32.const 3))
                  (then (local.set $pidl (call $shell_filesystem_pidl_from_path (local.get $data)))))
                (if (local.get $pidl)
                  (then
                    (local.set $display_g (i32.load offset=8 (local.get $bi_w)))
                    (if (local.get $display_g)
                      (then
                        (local.set $display_w (call $g2w (local.get $display_g)))
                        (local.set $len (call $strlen (local.get $text_w)))
                        (if (i32.gt_u (local.get $len) (i32.const 259))
                          (then (local.set $len (i32.const 259))))
                        (call $memcpy (local.get $display_w)
                          (local.get $text_w) (local.get $len))
                        (i32.store8 (i32.add (local.get $display_w) (local.get $len)) (i32.const 0))))
                    (i32.store offset=28 (local.get $bi_w) (i32.const 0))))))))))
    (call $heap_free (local.get $text_g))
    (call $heap_free (local.get $tvitem_g))
    (if (local.get $tree) (then (call $browse_release_paths (local.get $tree))))
    (local.get $pidl))

  (func $browse_add_drives (param $tree i32) (param $parent i32) (result i32)
    (local $mask i32) (local $i i32) (local $path_g i32) (local $path_w i32)
    (local $item i32) (local $first i32) (local $preferred i32)
    (local.set $mask (call $host_fs_logical_drive_mask))
    (block $done (loop $letters
      (br_if $done (i32.ge_u (local.get $i) (i32.const 26)))
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $i)))
        (then
          (local.set $path_g (call $heap_alloc (i32.const 4)))
          (if (local.get $path_g)
            (then
              (local.set $path_w (call $g2w (local.get $path_g)))
              (i32.store8 (local.get $path_w) (i32.add (i32.const 65) (local.get $i)))
              (i32.store8 offset=1 (local.get $path_w) (i32.const 58))
              (i32.store8 offset=2 (local.get $path_w) (i32.const 92))
              (i32.store8 offset=3 (local.get $path_w) (i32.const 0))
              (local.set $item (call $browse_tree_insert
                (local.get $tree) (local.get $parent) (local.get $path_g)
                (local.get $path_g) (call $browse_path_has_dirs (local.get $path_g))
                (i32.const 0)))
              (if (local.get $item)
                (then
                  (if (i32.eqz (local.get $first)) (then (local.set $first (local.get $item))))
                  (if (i32.eq (local.get $i) (i32.const 2))
                    (then (local.set $preferred (local.get $item)))))
                (else (call $heap_free (local.get $path_g))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $letters)))
    (select (local.get $preferred) (local.get $first) (local.get $preferred)))

  (func $browse_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $code i32) (local $item i32) (local $data i32) (local $tree i32)
    (local $ok i32) (local $notify_w i32)
    (if (i32.eq (local.get $msg) (i32.const 0x0085))
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0014))
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0010))
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x004E)) ;; WM_NOTIFY
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $notify_w (call $g2w (local.get $lParam)))
        (local.set $code (i32.load offset=8 (local.get $notify_w)))
        (local.set $tree (i32.load (local.get $notify_w)))
        (local.set $item (i32.load offset=60 (local.get $notify_w)))
        (if (i32.eq (local.get $code) (i32.const -405)) ;; TVN_ITEMEXPANDINGA
          (then
            (if (i32.eq (i32.load offset=12 (local.get $notify_w)) (i32.const 2))
              (then
                (local.set $data (i32.load offset=92 (local.get $notify_w)))
                (if (i32.and (i32.gt_u (local.get $data) (i32.const 3))
                             (i32.eqz (call $browse_populate_children
                               (local.get $tree) (local.get $item) (local.get $data))))
                  (then (return (i32.const 1))))))
            (return (i32.const 0))))
        (if (i32.eq (local.get $code) (i32.const -402)) ;; TVN_SELCHANGEDA
          (then
            (local.set $ok (call $ctrl_find_by_id (local.get $hwnd) (i32.const 1)))
            (if (local.get $ok)
              (then (drop (call $wnd_send_message
                (local.get $ok) (i32.const 0x000A)
                (call $browse_selection_allowed (local.get $hwnd) (local.get $item))
                (i32.const 0)))))
            (return (i32.const 0))))
        (return (i32.const 0))))
    (if (i32.ne (local.get $msg) (i32.const 0x0111))
      (then (return (i32.const 0))))
    (local.set $code (i32.and (local.get $wParam) (i32.const 0xFFFF)))
    (if (i32.eq (local.get $code) (i32.const 2))
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))
    (if (i32.eq (local.get $code) (i32.const 1))
      (then
        (local.set $tree (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x470)))
        (if (local.get $tree)
          (then
            (local.set $item (call $wnd_send_message
              (local.get $tree) (i32.const 0x110A) (i32.const 9) (i32.const 0)))
            (if (call $browse_selection_allowed (local.get $hwnd) (local.get $item))
              (then (call $modal_done (local.get $item))))))
        (return (i32.const 0))))
    (i32.const 0))

  (func $create_browse_dialog (param $dlg i32) (param $owner i32) (param $bi i32)
    (local $tree i32) (local $bi_w i32) (local $title_g i32)
    (local $owned_title_g i32) (local $button_g i32)
    (local $root i32) (local $root_w i32)
    (local $desktop i32) (local $computer i32) (local $network i32)
    (local $mydocs_g i32) (local $root_path_g i32) (local $attrs i32)
    (local $root_item i32) (local $selected i32) (local $csidl i32)
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner)
      (region.addr $BROWSE_DIALOG_STRINGS 0x00)
      (i32.const 330) (i32.const 300) (i32.const 1))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg)
      (region.addr $BROWSE_DIALOG_STRINGS 0x00) (i32.const 17))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg))
      (i32.const 31) (i32.const 0))
    (drop (call $wnd_set_userdata (local.get $dlg) (local.get $bi)))
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    (call $defwndproc_do_ncpaint (local.get $dlg))
    (call $nc_flags_set (local.get $dlg) (i32.const 3))
    (call $dlg_fill_bkgnd (local.get $dlg))
    (if (local.get $bi)
      (then
        (local.set $bi_w (call $g2w (local.get $bi)))
        (local.set $title_g (i32.load offset=12 (local.get $bi_w)))))
    (if (i32.eqz (local.get $title_g))
      (then
        (local.set $title_g (call $wat_str_to_heap
          (region.addr $BROWSE_DIALOG_STRINGS 0x00) (i32.const 17)))
        (local.set $owned_title_g (local.get $title_g))))
    (drop (call $ctrl_create_child
      (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 12) (i32.const 10) (i32.const 296) (i32.const 30)
      (i32.const 0x50000000) (local.get $title_g)))
    (call $heap_free (local.get $owned_title_g))
    (local.set $tree (call $ctrl_create_child
      (local.get $dlg) (i32.const 8) (i32.const 0x470)
      (i32.const 12) (i32.const 44) (i32.const 296) (i32.const 190)
      (i32.const 0x50A00007) (i32.const 0)))
    (local.set $button_g
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x0) (i32.const 2)))
    (drop (call $ctrl_create_child
      (local.get $dlg) (i32.const 1) (i32.const 1)
      (i32.const 146) (i32.const 244) (i32.const 72) (i32.const 24)
      (i32.const 0x50010001) (local.get $button_g)))
    (call $heap_free (local.get $button_g))
    (local.set $button_g
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x3) (i32.const 6)))
    (drop (call $ctrl_create_child
      (local.get $dlg) (i32.const 1) (i32.const 2)
      (i32.const 228) (i32.const 244) (i32.const 72) (i32.const 24)
      (i32.const 0x50010000) (local.get $button_g)))
    (call $heap_free (local.get $button_g))

    (if (local.get $bi_w)
      (then (local.set $root (i32.load offset=4 (local.get $bi_w)))))
    (if (local.get $root)
      (then
        (local.set $root_path_g (call $heap_alloc (i32.const 260)))
        (if (i32.and (i32.ne (local.get $root_path_g) (i32.const 0))
                    (call $shell_filesystem_pidl_copy_path
                      (local.get $root) (local.get $root_path_g)))
          (then
            (local.set $root_item (call $browse_tree_insert
              (local.get $tree) (i32.const 0) (local.get $root_path_g)
              (local.get $root_path_g) (call $browse_path_has_dirs (local.get $root_path_g))
              (i32.const 1)))
            (local.set $selected (local.get $root_item))
            (drop (call $browse_populate_children
              (local.get $tree) (local.get $root_item) (local.get $root_path_g))))
          (else
            (call $heap_free (local.get $root_path_g))
            (local.set $root_path_g (i32.const 0))
            ;; Our virtual PIDLs carry "WAVP" at +2 and the CSIDL at +6.
            (local.set $root_w (call $g2w (local.get $root)))
            (if (i32.and
                  (i32.eq (i32.load16_u (local.get $root_w)) (i32.const 10))
                  (i32.eq (i32.load offset=2 (local.get $root_w))
                          (i32.const 0x50564157)))
              (then
                (local.set $csidl (i32.load offset=6 (local.get $root_w)))))))))

    (if (i32.eqz (local.get $root_item))
      (then
        (if (i32.eq (local.get $csidl) (i32.const 0x11))
          (then
            (local.set $computer (call $browse_tree_insert_wat
              (local.get $tree) (i32.const 0)
              (region.addr $BROWSE_DIALOG_STRINGS 0x1A) (i32.const 11)
              (i32.const 2) (i32.const 1) (i32.const 1)))
            (local.set $selected (call $browse_add_drives (local.get $tree) (local.get $computer))))
          (else
            (if (i32.eq (local.get $csidl) (i32.const 0x12))
              (then
                (local.set $network (call $browse_tree_insert_wat
                  (local.get $tree) (i32.const 0)
                  (region.addr $BROWSE_DIALOG_STRINGS 0x26) (i32.const 20)
                  (i32.const 3) (i32.const 0) (i32.const 0)))
                (local.set $selected (local.get $network)))
              (else
                ;; NULL, Desktop, or an unknown root uses the Win98 desktop
                ;; namespace. Post-Win98 BIF_NEWDIALOGSTYLE is intentionally
                ;; ignored: this remains the old fixed-size tree dialog.
                (local.set $desktop (call $browse_tree_insert_wat
                  (local.get $tree) (i32.const 0)
                  (region.addr $BROWSE_DIALOG_STRINGS 0x12) (i32.const 7)
                  (i32.const 1) (i32.const 1) (i32.const 1)))
                (local.set $attrs (call $host_fs_get_file_attributes
                  (region.addr $BROWSE_DIALOG_STRINGS 0x48) (i32.const 0)))
                (if (i32.and
                      (i32.ne (local.get $attrs) (i32.const -1))
                      (i32.ne (i32.and (local.get $attrs) (i32.const 0x10)) (i32.const 0)))
                  (then
                    (local.set $mydocs_g (call $wat_str_to_heap
                      (region.addr $BROWSE_DIALOG_STRINGS 0x48) (i32.const 15)))
                    (local.set $selected (call $browse_tree_insert_wat
                      (local.get $tree) (local.get $desktop)
                      (region.addr $BROWSE_DIALOG_STRINGS 0x3B) (i32.const 12)
                      (local.get $mydocs_g) (call $browse_path_has_dirs (local.get $mydocs_g))
                      (i32.const 0)))
                    (if (i32.eqz (local.get $selected))
                      (then (call $heap_free (local.get $mydocs_g))))))
                (local.set $computer (call $browse_tree_insert_wat
                  (local.get $tree) (local.get $desktop)
                  (region.addr $BROWSE_DIALOG_STRINGS 0x1A) (i32.const 11)
                  (i32.const 2) (i32.const 1) (i32.const 1)))
                (local.set $selected (call $browse_add_drives
                  (local.get $tree) (local.get $computer)))
                (local.set $network (call $browse_tree_insert_wat
                  (local.get $tree) (local.get $desktop)
                  (region.addr $BROWSE_DIALOG_STRINGS 0x26) (i32.const 20)
                  (i32.const 3) (i32.const 0) (i32.const 0)))))))))
    (if (i32.eqz (local.get $selected))
      (then (local.set $selected (call $wnd_send_message
        (local.get $tree) (i32.const 0x110A) (i32.const 0) (i32.const 0)))))
    (if (local.get $selected)
      (then (drop (call $wnd_send_message
        (local.get $tree) (i32.const 0x110B) (i32.const 9) (local.get $selected)))))
    ;; The frame and background were painted synchronously above. Clear the
    ;; redundant deferred erase before the exposure pass; otherwise the
    ;; TreeView's immediate item paints appear while STATIC/BUTTON children
    ;; stay queued behind an ancestor erase until the modal pump catches up.
    (call $nc_flags_clear (local.get $dlg) (i32.const 2))
    (drop (call $paint_flush_visible_native_children (local.get $dlg))))
