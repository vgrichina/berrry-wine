  ;; ============================================================
  ;; Menu painting + hit-testing (WAT-side, was JS drawMenuBar /
  ;; _drawDropdown / _drawAccelText / renderer-input menu hit code)
  ;; ============================================================
  ;; Menu data is heap-resident, owned by WAT, and indexed per window
  ;; via MENU_DATA_TABLE (parallel to WND_RECORDS slots). JS encodes a
  ;; flat blob from its parsed PE menu tree once when the menu is set,
  ;; passes it through $menu_set; we copy into the heap and remember
  ;; the pointer. Paint and hit-test then re-walk the blob on demand,
  ;; matching the way real USER32 walks an HMENU instead of caching
  ;; rectangles.
  ;;
  ;; Blob layout (see also MENU_DATA_TABLE comment in 01-header.wat):
  ;;   +0       i32  bar_count
  ;;   +4       bar_items[bar_count] × 16:
  ;;              +0  i32 text_offset  (offset in blob)
  ;;              +4  i32 text_len
  ;;              +8  i32 child_offset (offset to child header, 0 = none)
  ;;              +12 i32 id (0 for popup bar items; command id otherwise)
  ;;   <child header> per submenu:
  ;;     +0  i32 child_count
  ;;     +4  child_items[child_count] × 28:
  ;;              +0  i32 label_offset
  ;;              +4  i32 label_len
  ;;              +8  i32 shortcut_offset
  ;;              +12 i32 shortcut_len
  ;;              +16 i32 flags  (bit0 = separator, bit1 = grayed,
  ;;                               bit2 = checked, bit3 = popup)
  ;;              +20 i32 id
  ;;              +24 i32 child_offset (nested popup header, 0 if none)
  ;;   string bytes appended at the tail (referenced by *_offset above)
  ;;
  ;; Geometry constants — must match the old JS code so the layout is
  ;; pixel-identical:
  ;;   bar item height       = 18
  ;;   bar item left pad     = 4 (first item starts at x+4)
  ;;   bar item text inset   = 6 (text drawn at item.x+6)
  ;;   bar item width        = measureText(label) + 12
  ;;   dropdown width        = max(180, widest measured item)
  ;;   dropdown item height  = 20
  ;;   dropdown left/right pad = 2
  ;;   dropdown label inset  = 20 (from dropdown left)
  ;;   dropdown shortcut inset = 20 (from dropdown right)

  ;; The fake LoadMenu handle keeps the most recent resource name as its
  ;; stable identity. Named W calls need their original character width when
  ;; SetMenu later resolves that opaque handle into RT_MENU bytes.
  (global $last_load_menu_wide (mut i32) (i32.const 0))

  ;; A dynamic TrackPopupMenu paints from a transient copy after the caller's
  ;; MNUD record has been serialized. Retain the originating HMENU separately
  ;; so handle-based geometry queries cannot mistake any other live popup for
  ;; the one currently displayed.
  (global $menu_open_dynamic_hmenu (mut i32) (i32.const 0))

  ;; TPM_RETURNCMD: USER runs the menu loop inside TrackPopupMenu and returns
  ;; the picked id instead of posting WM_COMMAND. The call parks on its thunk
  ;; while the popup is open. State 0 = no such call, 1 = popup open, 2 = the
  ;; popup closed and $menu_track_result holds the id (0 = dismissed).
  (global $menu_track_state (mut i32) (i32.const 0))
  (global $menu_track_result (mut i32) (i32.const 0))

  ;; Resource menus are stored as immutable-layout paint blobs, but Win32
  ;; still lets applications mutate an HMENU returned for a cascading popup.
  ;; Keep those second-level popup handles in a small heap-backed binding list
  ;; and paint their canonical MNUD state in place of the resource placeholder.
  ;; Binding: next, parent blob, top index, child index, HMENU, paint blob,
  ;;           owned copies of seed labels, cached owner-draw measurements,
  ;;           owner HWND.
  (global $resource_submenu_bindings (mut i32) (i32.const 0))

  ;; --------- MENU_DATA_TABLE accessors ---------

  (func $menu_data_table_addr (param $slot i32) (result i32)
    (i32.add (global.get $MENU_DATA_TABLE) (i32.mul (local.get $slot) (i32.const 4))))

  ;; Returns the WASM linear address of this hwnd's menu blob, or 0.
  (func $menu_blob_w (param $hwnd i32) (result i32)
    (local $slot i32) (local $g i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $g (i32.load (call $menu_data_table_addr (local.get $slot))))
    (if (i32.eqz (local.get $g)) (then (return (i32.const 0))))
    (call $g2w (local.get $g)))

  ;; Persistent menu allocations carry a private two-dword header immediately
  ;; before the guest-visible blob: the original resource key at -8 and the
  ;; blob byte length at -4. Keeping the key lets GetMenu return an identity
  ;; that SetMenu can resolve again, including named menu resources. Dynamic
  ;; TrackPopupMenu blobs do not use this table.
  (func $menu_source_get (param $hwnd i32) (result i32)
    (local $slot i32) (local $g i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $g (i32.load (call $menu_data_table_addr (local.get $slot))))
    (if (i32.lt_u (local.get $g) (i32.const 8)) (then (return (i32.const 0))))
    (i32.load (call $g2w (i32.sub (local.get $g) (i32.const 8)))))

  (func $menu_blob_size (param $hwnd i32) (result i32)
    (local $slot i32) (local $g i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $g (i32.load (call $menu_data_table_addr (local.get $slot))))
    (if (i32.lt_u (local.get $g) (i32.const 4)) (then (return (i32.const 0))))
    (i32.load (call $g2w (i32.sub (local.get $g) (i32.const 4)))))

  ;; Dropdown helpers normally read the window's menu-bar blob. Dynamic popup
  ;; menus created with CreatePopupMenu/AppendMenuA do not belong to the menu
  ;; bar, so TrackPopupMenu synthesizes a transient one-popup blob and stores it
  ;; here for painting, hit-testing, and activation until $menu_close.
  (func $menu_dropdown_blob_w (param $hwnd i32) (result i32)
    (if (i32.and
          (i32.ne (global.get $menu_open_popup_blob) (i32.const 0))
          (i32.eq (local.get $hwnd) (global.get $menu_open_hwnd)))
      (then (return (call $g2w (global.get $menu_open_popup_blob)))))
    (call $menu_blob_w (local.get $hwnd)))

  ;; Dynamic popup HMENU state. Handles are guest heap pointers to:
  ;; +0 magic "MNUD", +4 count, +8 capacity, +12 reserved,
  ;; +16 items[capacity], 20 bytes each:
  ;;   { flags, id, dwItemData, submenu, canonical ANSI text }.
  ;; The high private flag bit says text is an owned SetMenuItemInfo copy;
  ;; public getters mask it away before returning Win32 type/state flags.
  ;; This is intentionally small; WordPad's color popup appends 17 owner-draw
  ;; items and then lets USER32 drive TrackPopupMenu/WM_COMMAND selection.
  (global $DYNAMIC_MENU_OWNS_TEXT i32 (i32.const 0x80000000))
  (global $DYNAMIC_MENU_ITEM_BYTES i32 (i32.const 20))
  (global $DYNAMIC_MENU_BYTES i32 (i32.const 1296)) ;; 16 + 64*20

  ;; True unless $hmenu is a live heap_alloc block (header at hmenu-4).
  (func $menu_handle_not_heap (param $hmenu i32) (result i32)
    (if (i32.lt_u (local.get $hmenu) (i32.const 4)) (then (return (i32.const 1))))
    (i32.eqz (call $heap_arena_find (i32.sub (local.get $hmenu) (i32.const 4)))))

  (func $dynamic_menu_state_w (param $hmenu i32) (result i32)
    (local $sw i32)
    ;; Ask the arena table, not [heap_base, heap_ptr): once the low window is
    ;; spent heap_alloc spills to the sparse high arena, and Civ2's menus land
    ;; at 0x7eff0704 -- every one of them read as "not a menu", so GetSubMenu
    ;; answered 0 and the whole bar was built into nothing.
    (if (call $menu_handle_not_heap (local.get $hmenu))
      (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $hmenu)))
    (if (i32.ne (i32.load (local.get $sw)) (i32.const 0x4D4E5544))
      (then (return (i32.const 0))))
    (local.get $sw))

  ;; Validate every HMENU representation used by the compatibility layer:
  ;; heap-backed popup menus, resource-backed LoadMenu handles, fixed handles
  ;; returned by GetMenu/GetSystemMenu, encoded submenu handles, and the small
  ;; host-owned range returned by CreateMenu.
  (func $menu_handle_is_valid (param $hmenu i32) (result i32)
    (if (i32.eqz (local.get $hmenu)) (then (return (i32.const 0))))
    (if (call $dynamic_menu_state_w (local.get $hmenu))
      (then (return (i32.const 1))))
    ;; Heap-range menu handles are exclusively MNUD records. If the magic is
    ;; gone, the object was destroyed (or never was a menu); do not let its
    ;; pointer-shaped high/low words fall through as an encoded resource
    ;; submenu handle.
    (if (i32.eqz (call $menu_handle_not_heap (local.get $hmenu)))
      (then (return (i32.const 0))))
    (if (i32.or
          (i32.eq (local.get $hmenu) (i32.const 0x00080001))
          (i32.eq (local.get $hmenu) (i32.const 0x00040003)))
      (then (return (i32.const 1))))
    (if (i32.eq
          (i32.and (local.get $hmenu) (i32.const 0x00FF0000))
          (i32.const 0x00BE0000))
      (then (return (i32.const 1))))
    (if (i32.and
          (i32.ge_u (local.get $hmenu) (i32.const 0x00800001))
          (i32.lt_u (local.get $hmenu) (i32.const 0x00900000)))
      (then (return (i32.const 1))))
    ;; GetSubMenu encodes its zero-based position+1 in the high word.
    (if (i32.and
          (i32.ne (i32.and (local.get $hmenu) (i32.const 0xFFFF0000)) (i32.const 0))
          (i32.ne (i32.and (local.get $hmenu) (i32.const 0x0000FFFF)) (i32.const 0)))
      (then (return (i32.const 1))))
    (i32.const 0))

  (func $dynamic_menu_create (result i32)
    (local $hmenu i32) (local $sw i32)
    ;; 64 entries is enough for Win9x color/font popup menus and keeps every
    ;; HMENU self-contained without a realloc path.
    (local.set $hmenu (call $heap_alloc (global.get $DYNAMIC_MENU_BYTES)))
    (if (i32.eqz (local.get $hmenu)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $hmenu)))
    (call $zero_memory (local.get $sw) (global.get $DYNAMIC_MENU_BYTES))
    (i32.store        (local.get $sw) (i32.const 0x4D4E5544)) ;; "MNUD"
    (i32.store offset=8 (local.get $sw) (i32.const 64))
    (local.get $hmenu))

  ;; Returns -1 when $hmenu is not a WAT dynamic menu; otherwise TRUE/FALSE.
  (func $dynamic_menu_append
        (param $hmenu i32) (param $flags i32) (param $id i32) (param $itemData i32)
        (result i32)
    (local $sw i32) (local $count i32) (local $cap i32) (local $rec i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const -1))))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (local.set $cap (i32.load offset=8 (local.get $sw)))
    (if (i32.ge_u (local.get $count) (local.get $cap))
      (then (return (i32.const 0))))
    (local.set $rec
      (i32.add (local.get $sw)
        (i32.add (i32.const 16)
          (i32.mul (local.get $count) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
    (i32.store         (local.get $rec) (local.get $flags))
    ;; For MF_POPUP, uIDNewItem is an HMENU rather than a command id. Keep it
    ;; in the dedicated submenu word so GetSubMenu and replacement ownership
    ;; see the same object InsertMenuItem already records there.
    (i32.store offset=4  (local.get $rec)
      (select (i32.const 0) (local.get $id)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0))))
    ;; AppendMenu's final argument is either the label or non-string type data,
    ;; never MENUITEMINFO's independent dwItemData field.
    (i32.store offset=8  (local.get $rec)
      (select (local.get $itemData) (i32.const 0)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x904)) (i32.const 0))))
    (i32.store offset=12 (local.get $rec)
      (select (local.get $id) (i32.const 0)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0))))
    (i32.store offset=16 (local.get $rec)
      (select (i32.const 0) (local.get $itemData)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x904)) (i32.const 0))))
    (call $dynamic_menu_take_text (local.get $rec))
    (i32.store offset=4 (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
    (call $resource_submenu_binding_refresh (local.get $hmenu))
    (i32.const 1))

  ;; Release an item's owned string: the copy every Append/Insert/Modify takes
  ;; ($dynamic_menu_take_text) or the one SetMenuItemInfoA/W makes.
  (func $dynamic_menu_owned_text_release (param $rec i32)
    (local $flags i32) (local $text i32)
    (local.set $flags (i32.load (local.get $rec)))
    (if (i32.ne
          (i32.and (local.get $flags) (global.get $DYNAMIC_MENU_OWNS_TEXT))
          (i32.const 0))
      (then
        (local.set $text (i32.load offset=16 (local.get $rec)))
        (if (local.get $text) (then (call $heap_free (local.get $text))))
        (i32.store offset=16 (local.get $rec) (i32.const 0))
        (i32.store (local.get $rec)
          (i32.and (local.get $flags) (i32.const 0x7FFFFFFF))))))

  ;; USER copies an item's string when it is added; the caller's buffer is
  ;; free to be reused the moment the call returns. Civ2 builds its whole menu
  ;; bar out of one scratch buffer (every bar item's AppendMenu names
  ;; 04ef:635a), so keeping the pointer left every title reading as whatever
  ;; was loaded into that buffer last.
  (func $dynamic_menu_take_text (param $rec i32)
    (local $flags i32) (local $text i32) (local $copy i32)
    (local.set $flags (i32.load (local.get $rec)))
    (local.set $text (i32.load offset=16 (local.get $rec)))
    (if (i32.or (i32.eqz (local.get $text))
          (i32.or
            (i32.ne (i32.and (local.get $flags) (i32.const 0x904)) (i32.const 0))
            (i32.ne (i32.and (local.get $flags) (global.get $DYNAMIC_MENU_OWNS_TEXT))
                    (i32.const 0))))
      (then (return)))
    (local.set $copy (call $guest_strdup (local.get $text)))
    (if (i32.eqz (local.get $copy)) (then (return)))
    (i32.store offset=16 (local.get $rec) (local.get $copy))
    (i32.store (local.get $rec)
      (i32.or (local.get $flags) (global.get $DYNAMIC_MENU_OWNS_TEXT))))

  (func $dynamic_menu_owned_texts_release (param $sw i32)
    (local $count i32) (local $i i32) (local $rec i32)
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec
        (i32.add (local.get $sw)
          (i32.add (i32.const 16)
            (i32.mul (local.get $i) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
      (call $dynamic_menu_owned_text_release (local.get $rec))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; Replace one dynamic-menu item in place. ModifyMenu transfers ownership of
  ;; a replacement popup to the parent and destroys the old popup it replaces.
  ;; Return -1 for a non-dynamic handle so the public API can fail honestly
  ;; instead of claiming it mutated a resource/host menu that is immutable in
  ;; this compact representation.
  (func $dynamic_menu_modify
        (param $hmenu i32) (param $item i32) (param $flags i32)
        (param $id_or_submenu i32) (param $itemData i32) (result i32)
    (local $sw i32) (local $rec i32) (local $old_submenu i32)
    (local $new_submenu i32) (local $by_position i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const -1))))
    (local.set $by_position
      (i32.ne (i32.and (local.get $flags) (i32.const 0x400)) (i32.const 0)))
    (local.set $rec (call $dynamic_menu_item_w
      (local.get $hmenu) (local.get $item) (local.get $by_position)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $new_submenu
      (select (local.get $id_or_submenu) (i32.const 0)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0))))
    ;; A menu cannot own itself. Besides being invalid USER state, accepting it
    ;; would make a later replacement free the record currently being edited.
    (if (i32.eq (local.get $new_submenu) (local.get $hmenu))
      (then (return (i32.const 0))))
    (local.set $old_submenu (i32.load offset=12 (local.get $rec)))
    (if (i32.and
          (i32.ne (local.get $old_submenu) (i32.const 0))
          (i32.ne (local.get $old_submenu) (local.get $new_submenu)))
      (then
        (if (i32.eqz (call $dynamic_menu_destroy (local.get $old_submenu)))
          (then (drop (call $host_menu_destroy (local.get $old_submenu)))))))
    (call $dynamic_menu_owned_text_release (local.get $rec))
    ;; MF_BYPOSITION selects the lookup mode for this call; it is not retained
    ;; item type/state.
    (i32.store (local.get $rec)
      (i32.and (local.get $flags) (i32.const -1025)))
    (i32.store offset=4 (local.get $rec)
      (select (i32.const 0) (local.get $id_or_submenu)
        (i32.ne (local.get $new_submenu) (i32.const 0))))
    (i32.store offset=8 (local.get $rec)
      (select (local.get $itemData) (i32.const 0)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x904)) (i32.const 0))))
    (i32.store offset=12 (local.get $rec) (local.get $new_submenu))
    (i32.store offset=16 (local.get $rec)
      (select (i32.const 0) (local.get $itemData)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x904)) (i32.const 0))))
    (call $dynamic_menu_take_text (local.get $rec))
    (call $resource_submenu_binding_refresh (local.get $hmenu))
    (i32.const 1))

  ;; Position of the item carrying command id $id, or -1. InsertMenu and
  ;; InsertMenuItem both accept "insert before the item with this id" as an
  ;; alternative to a positional index.
  (func $dynamic_menu_index_of_id (param $sw i32) (param $id i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec
        (i32.add (local.get $sw)
          (i32.add (i32.const 16)
            (i32.mul (local.get $i) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
      (if (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $id))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Insert an item *before* position $pos, shifting the tail down. A $pos at
  ;; or past the end appends, which is what Win32 does for InsertMenu with
  ;; MF_BYPOSITION and an out-of-range position. Returns -1 when $hmenu is not
  ;; a WAT dynamic menu; otherwise TRUE/FALSE.
  ;; Text, dwItemData, and submenu have independent slots so combined
  ;; MENUITEMINFO masks never overwrite one another.
  (func $dynamic_menu_insert
        (param $hmenu i32) (param $pos i32) (param $flags i32) (param $id i32)
        (param $itemData i32) (param $text i32) (param $submenu i32)
        (result i32)
    (local $sw i32) (local $count i32) (local $cap i32) (local $rec i32) (local $i i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const -1))))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (local.set $cap (i32.load offset=8 (local.get $sw)))
    (if (i32.ge_u (local.get $count) (local.get $cap))
      (then (return (i32.const 0))))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (local.get $count))))
    (if (i32.gt_u (local.get $pos) (local.get $count))
      (then (local.set $pos (local.get $count))))
    ;; Shift from the tail back so overlapping records copy cleanly.
    (local.set $i (local.get $count))
    (block $done (loop $shift
      (br_if $done (i32.le_u (local.get $i) (local.get $pos)))
      (local.set $rec
        (i32.add (local.get $sw)
          (i32.add (i32.const 16)
            (i32.mul (local.get $i) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
      (i32.store         (local.get $rec) (i32.load         (i32.sub (local.get $rec) (global.get $DYNAMIC_MENU_ITEM_BYTES))))
      (i32.store offset=4  (local.get $rec) (i32.load offset=4  (i32.sub (local.get $rec) (global.get $DYNAMIC_MENU_ITEM_BYTES))))
      (i32.store offset=8  (local.get $rec) (i32.load offset=8  (i32.sub (local.get $rec) (global.get $DYNAMIC_MENU_ITEM_BYTES))))
      (i32.store offset=12 (local.get $rec) (i32.load offset=12 (i32.sub (local.get $rec) (global.get $DYNAMIC_MENU_ITEM_BYTES))))
      (i32.store offset=16 (local.get $rec) (i32.load offset=16 (i32.sub (local.get $rec) (global.get $DYNAMIC_MENU_ITEM_BYTES))))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (br $shift)))
    (local.set $rec
      (i32.add (local.get $sw)
        (i32.add (i32.const 16)
          (i32.mul (local.get $pos) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
    (i32.store         (local.get $rec) (local.get $flags))
    (i32.store offset=4  (local.get $rec) (local.get $id))
    (i32.store offset=8  (local.get $rec) (local.get $itemData))
    (i32.store offset=12 (local.get $rec) (local.get $submenu))
    (i32.store offset=16 (local.get $rec) (local.get $text))
    (call $dynamic_menu_take_text (local.get $rec))
    (i32.store offset=4 (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
    (call $resource_submenu_binding_refresh (local.get $hmenu))
    (i32.const 1))

  ;; Resolve the InsertMenu/InsertMenuItem "uItem" argument to a position.
  ;; $by_position selects between a raw index and an item id.
  (func $dynamic_menu_resolve_pos
        (param $hmenu i32) (param $uItem i32) (param $by_position i32) (result i32)
    (local $sw i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const -1))))
    (if (local.get $by_position) (then (return (local.get $uItem))))
    (call $dynamic_menu_index_of_id (local.get $sw) (local.get $uItem)))

  ;; Resolve a dynamic-menu item to its 20-byte record. Resource/host-backed
  ;; menu representations are not mutable through this compact table and
  ;; return NULL so their public handlers can fail honestly.
  (func $dynamic_menu_item_w
        (param $hmenu i32) (param $item i32) (param $by_position i32) (result i32)
    (local $sw i32) (local $idx i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const 0))))
    (local.set $idx
      (call $dynamic_menu_resolve_pos
        (local.get $hmenu) (local.get $item) (local.get $by_position)))
    (if (i32.or
          (i32.lt_s (local.get $idx) (i32.const 0))
          (i32.ge_u (local.get $idx) (i32.load offset=4 (local.get $sw))))
      (then (return (i32.const 0))))
    (i32.add (local.get $sw)
      (i32.add (i32.const 16)
        (i32.mul (local.get $idx) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))

  ;; Apply the supported Win98 MENUITEMINFOA fields to a dynamic MNUD item.
  ;; CHECKMARKS and BITMAP need storage the compact record does not have, so a
  ;; caller asking for either gets FALSE instead of a silent success.
  (func $dynamic_menu_item_info_set
        (param $hmenu i32) (param $item i32) (param $by_position i32)
        (param $mii i32) (param $wide i32) (result i32)
    (local $rec i32) (local $mask i32) (local $flags i32) (local $submenu i32)
    (local $text i32) (local $ansi_text i32) (local $chars i32)
    (local $replace_text i32) (local $drop_text i32)
    (if (i32.eqz (local.get $mii)) (then (return (i32.const 0))))
    (if (i32.lt_u (call $gl32 (local.get $mii)) (i32.const 44))
      (then (return (i32.const 0))))
    (local.set $mask (call $gl32 (i32.add (local.get $mii) (i32.const 4))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const -376)) (i32.const 0))
      (then (return (i32.const 0)))) ;; supported mask is 0x177
    (local.set $rec
      (call $dynamic_menu_item_w
        (local.get $hmenu) (local.get $item) (local.get $by_position)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $flags (i32.load (local.get $rec)))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 0x110)) (i32.const 0))
      (then
        (local.set $flags
          (i32.or
            (i32.and (local.get $flags) (i32.const -2309)) ;; ~0x904
            (i32.and (call $gl32 (i32.add (local.get $mii) (i32.const 8)))
                     (i32.const 0x904))))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 1)) (i32.const 0))
      (then
        (local.set $flags
          (i32.or
            (i32.and (local.get $flags) (i32.const -4236)) ;; ~0x108B
            (i32.and (call $gl32 (i32.add (local.get $mii) (i32.const 12)))
                     (i32.const 0x108B))))))
    ;; USER owns a menu item's string after SetMenuItemInfo returns. Keep one
    ;; canonical ANSI copy for the existing painter/GetMenuString paths, for A
    ;; as well as W, and allocate it before changing the record so OOM is
    ;; failure-atomic. Non-string type data retains its original bit pattern.
    (local.set $replace_text
      (i32.and
        (i32.ne (i32.and (local.get $mask) (i32.const 0x50)) (i32.const 0))
        (i32.eqz (i32.and (local.get $flags) (i32.const 0x904)))))
    (if (local.get $replace_text)
      (then
        (local.set $text (call $gl32 (i32.add (local.get $mii) (i32.const 36))))
        (if (local.get $text)
          (then
            (if (local.get $wide)
              (then
                (local.set $chars (call $guest_wcslen (local.get $text)))
                (local.set $ansi_text
                  (call $heap_alloc (i32.add (local.get $chars) (i32.const 1))))
                (if (i32.eqz (local.get $ansi_text))
                  (then (return (i32.const 0))))
                (drop (call $wide_to_ansi
                  (local.get $text) (local.get $ansi_text)
                  (i32.add (local.get $chars) (i32.const 1)))))
              (else
                (local.set $ansi_text (call $guest_strdup (local.get $text)))
                (if (i32.eqz (local.get $ansi_text))
                  (then (return (i32.const 0))))))))))
    ;; A string replacement, or a type transition away from string, retires the
    ;; previous owned copy. MIIM_DATA is independent and never changes text.
    (local.set $drop_text
      (i32.or
        (i32.ne (i32.and (local.get $mask) (i32.const 0x50)) (i32.const 0))
        (i32.and
          (i32.ne (i32.and (local.get $mask) (i32.const 0x100)) (i32.const 0))
          (i32.ne (i32.and (local.get $flags) (i32.const 0x904)) (i32.const 0)))))
    (if (local.get $drop_text)
      (then
        (call $dynamic_menu_owned_text_release (local.get $rec))
        (local.set $flags
          (i32.and (local.get $flags) (i32.const 0x7FFFFFFF)))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 2)) (i32.const 0))
      (then (i32.store offset=4 (local.get $rec)
        (call $gl32 (i32.add (local.get $mii) (i32.const 16))))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 4)) (i32.const 0))
      (then
        (local.set $submenu (call $gl32 (i32.add (local.get $mii) (i32.const 20))))
        (i32.store offset=12 (local.get $rec) (local.get $submenu))
        (local.set $flags
          (if (result i32) (local.get $submenu)
            (then (i32.or (local.get $flags) (i32.const 0x10)))
            (else (i32.and (local.get $flags) (i32.const -17)))))))
    ;; The legacy MIIM_TYPE form carries bitmap/owner-draw data in
    ;; dwTypeData. MIIM_DATA, when also present, remains authoritative below.
    (if (i32.and
          (i32.ne (i32.and (local.get $mask) (i32.const 0x10)) (i32.const 0))
          (i32.ne (i32.and (local.get $flags) (i32.const 0x904)) (i32.const 0)))
      (then (i32.store offset=8 (local.get $rec)
        (call $gl32 (i32.add (local.get $mii) (i32.const 36))))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 0x20)) (i32.const 0))
      (then (i32.store offset=8 (local.get $rec)
        (call $gl32 (i32.add (local.get $mii) (i32.const 32))))))
    ;; A transition to a non-string type retires the label independently of
    ;; whatever MIIM_DATA says about application data.
    (if (i32.and
          (i32.ne (i32.and (local.get $mask) (i32.const 0x110)) (i32.const 0))
          (i32.ne (i32.and (local.get $flags) (i32.const 0x904)) (i32.const 0)))
      (then (i32.store offset=16 (local.get $rec) (i32.const 0))))
    (if (local.get $replace_text)
      (then
        (i32.store offset=16 (local.get $rec) (local.get $ansi_text))
        (if (local.get $ansi_text)
          (then (local.set $flags
            (i32.or (local.get $flags) (global.get $DYNAMIC_MENU_OWNS_TEXT)))))))
    (i32.store (local.get $rec) (local.get $flags))
    (call $resource_submenu_binding_refresh (local.get $hmenu))
    (i32.const 1))

  ;; Fill supported MENUITEMINFOA fields from a dynamic MNUD item. String
  ;; copies honor cch and always report the full source length through cch.
  (func $dynamic_menu_item_info_get
        (param $hmenu i32) (param $item i32) (param $by_position i32)
        (param $mii i32) (param $wide i32) (result i32)
    (local $rec i32) (local $mask i32) (local $flags i32)
    (local $text i32) (local $dst i32) (local $cch i32) (local $len i32)
    (if (i32.eqz (local.get $mii)) (then (return (i32.const 0))))
    (if (i32.lt_u (call $gl32 (local.get $mii)) (i32.const 44))
      (then (return (i32.const 0))))
    (local.set $mask (call $gl32 (i32.add (local.get $mii) (i32.const 4))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const -376)) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $rec
      (call $dynamic_menu_item_w
        (local.get $hmenu) (local.get $item) (local.get $by_position)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $flags (i32.load (local.get $rec)))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 0x110)) (i32.const 0))
      (then (call $gs32 (i32.add (local.get $mii) (i32.const 8))
        (i32.and (local.get $flags) (i32.const 0x904)))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 1)) (i32.const 0))
      (then (call $gs32 (i32.add (local.get $mii) (i32.const 12))
        (i32.and (local.get $flags) (i32.const 0x108B)))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 2)) (i32.const 0))
      (then (call $gs32 (i32.add (local.get $mii) (i32.const 16))
        (i32.load offset=4 (local.get $rec)))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 4)) (i32.const 0))
      (then (call $gs32 (i32.add (local.get $mii) (i32.const 20))
        (i32.load offset=12 (local.get $rec)))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 0x20)) (i32.const 0))
      (then (call $gs32 (i32.add (local.get $mii) (i32.const 32))
        (i32.load offset=8 (local.get $rec)))))
    (if (i32.ne (i32.and (local.get $mask) (i32.const 0x50)) (i32.const 0))
      (then
        (local.set $text (i32.load offset=16 (local.get $rec)))
        (if (i32.and
              (i32.ne (local.get $text) (i32.const 0))
              (i32.eqz (i32.and (local.get $flags) (i32.const 0x904))))
          (then (local.set $len (call $lstr_len (local.get $text) (i32.const 0)))))
        (local.set $dst (call $gl32 (i32.add (local.get $mii) (i32.const 36))))
        (local.set $cch (call $gl32 (i32.add (local.get $mii) (i32.const 40))))
        (if (i32.and
              (i32.ne (local.get $dst) (i32.const 0))
              (i32.and (i32.ne (local.get $cch) (i32.const 0))
                       (i32.ne (local.get $text) (i32.const 0))))
          (then
            (if (local.get $wide)
              (then (drop (call $ansi_to_wide
                (local.get $text) (local.get $dst) (local.get $cch))))
              (else (call $lstr_cpyn
                (local.get $dst) (local.get $text) (local.get $cch)
                (i32.const 0))))))
        (call $gs32 (i32.add (local.get $mii) (i32.const 40)) (local.get $len))))
    (i32.const 1))

  ;; Fold a MENUITEMINFO at guest address $mii into the (flags, id, itemData)
  ;; triple the dynamic menu stores. The MFT_*/MFS_* constants deliberately
  ;; share values with the MF_* ones AppendMenu uses, so the type and state
  ;; words carry straight across; only the string pointer needs picking out.
  ;; Returns the flags; $out_* are written through the two globals below to
  ;; keep the handler side free of multi-value plumbing.
  (global $mii_out_id (mut i32) (i32.const 0))
  (global $mii_out_data (mut i32) (i32.const 0))
  (global $mii_out_text (mut i32) (i32.const 0))
  (global $mii_out_submenu (mut i32) (i32.const 0))
  (func $menu_item_info_decode (param $mii i32) (result i32)
    (local $mask i32) (local $flags i32)
    (global.set $mii_out_id (i32.const 0))
    (global.set $mii_out_data (i32.const 0))
    (global.set $mii_out_text (i32.const 0))
    (global.set $mii_out_submenu (i32.const 0))
    (if (i32.eqz (local.get $mii)) (then (return (i32.const 0))))
    (local.set $mask (call $gl32 (i32.add (local.get $mii) (i32.const 4))))
    ;; MIIM_FTYPE (0x100) and the older MIIM_TYPE (0x10) both describe fType.
    (if (i32.and (local.get $mask) (i32.const 0x110))
      (then (local.set $flags (call $gl32 (i32.add (local.get $mii) (i32.const 8))))))
    ;; MIIM_STATE
    (if (i32.and (local.get $mask) (i32.const 0x1))
      (then (local.set $flags (i32.or (local.get $flags)
              (call $gl32 (i32.add (local.get $mii) (i32.const 12)))))))
    ;; MIIM_ID
    (if (i32.and (local.get $mask) (i32.const 0x2))
      (then (global.set $mii_out_id (call $gl32 (i32.add (local.get $mii) (i32.const 16))))))
    ;; MIIM_SUBMENU — a non-null handle makes this a popup item.
    (if (i32.and (local.get $mask) (i32.const 0x4))
      (then
        (if (call $gl32 (i32.add (local.get $mii) (i32.const 20)))
          (then
            (local.set $flags (i32.or (local.get $flags) (i32.const 0x10))) ;; MF_POPUP
            (global.set $mii_out_submenu (call $gl32 (i32.add (local.get $mii) (i32.const 20))))))))
    ;; MIIM_STRING / MIIM_TYPE with a string type: dwTypeData is the label.
    (if (i32.and (local.get $mask) (i32.const 0x50))
      (then
        (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x900))) ;; not separator/owner-draw
          (then (global.set $mii_out_text (call $gl32 (i32.add (local.get $mii) (i32.const 36)))))
          (else
            (if (i32.and (local.get $mask) (i32.const 0x10))
              (then (global.set $mii_out_data
                (call $gl32 (i32.add (local.get $mii) (i32.const 36))))))))))
    ;; MIIM_DATA — independent owner-draw application data.
    (if (i32.and (local.get $mask) (i32.const 0x20))
      (then (global.set $mii_out_data (call $gl32 (i32.add (local.get $mii) (i32.const 32))))))
    (local.get $flags))

  (func $dynamic_menu_destroy (param $hmenu i32) (result i32)
    (local $sw i32) (local $i i32) (local $count i32) (local $rec i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const 0))))
    ;; Retire before descending so repeated/cyclic child links cannot recurse
    ;; into this menu twice. Keep the record allocated until its children and
    ;; owned labels have been released.
    (i32.store (local.get $sw) (i32.const 0))
    (drop (call $menu_detached_take (local.get $hmenu)))
    (drop (call $resource_submenu_binding_forget_handle (local.get $hmenu)))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (block $done (loop $children
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $dmb_item_w (local.get $sw) (local.get $i)))
      (if (i32.and (i32.load (local.get $rec)) (i32.const 0x10))
        (then (drop (call $dynamic_menu_destroy (i32.load offset=12 (local.get $rec))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $children)))
    (call $dynamic_menu_owned_texts_release (local.get $sw))
    (call $heap_free (local.get $hmenu))
    (i32.const 1))

  ;; Remove one item from a WAT-owned popup. Return -1 when the handle is not
  ;; dynamic so the caller can fall through to the host-owned CreateMenu tree;
  ;; otherwise return the Win32 BOOL result. DeleteMenu passes $destroy=1 and
  ;; owns a removed popup's submenu, whereas RemoveMenu leaves it alive.
  (func $dynamic_menu_remove
        (param $hmenu i32) (param $item i32) (param $by_position i32)
        (param $destroy i32) (result i32)
    (local $sw i32) (local $count i32) (local $idx i32)
    (local $i i32) (local $dst i32) (local $src i32) (local $submenu i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const -1))))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (local.set $idx
      (if (result i32) (local.get $by_position)
        (then (local.get $item))
        (else (call $dynamic_menu_index_of_id (local.get $sw) (local.get $item)))))
    (if (i32.or
          (i32.lt_s (local.get $idx) (i32.const 0))
          (i32.ge_u (local.get $idx) (local.get $count)))
      (then (return (i32.const 0))))
    (local.set $dst
      (i32.add (local.get $sw)
        (i32.add (i32.const 16)
          (i32.mul (local.get $idx) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
    (local.set $submenu (i32.load offset=12 (local.get $dst)))
    (call $dynamic_menu_owned_text_release (local.get $dst))
    (local.set $i (local.get $idx))
    (block $done (loop $shift
      (br_if $done
        (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $count)))
      (local.set $src
        (i32.add (local.get $dst) (global.get $DYNAMIC_MENU_ITEM_BYTES)))
      (i32.store         (local.get $dst) (i32.load         (local.get $src)))
      (i32.store offset=4  (local.get $dst) (i32.load offset=4  (local.get $src)))
      (i32.store offset=8  (local.get $dst) (i32.load offset=8  (local.get $src)))
      (i32.store offset=12 (local.get $dst) (i32.load offset=12 (local.get $src)))
      (i32.store offset=16 (local.get $dst) (i32.load offset=16 (local.get $src)))
      (local.set $dst (local.get $src))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $shift)))
    (call $zero_memory (local.get $dst) (global.get $DYNAMIC_MENU_ITEM_BYTES))
    (i32.store offset=4 (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
    (if (i32.and
          (i32.ne (local.get $destroy) (i32.const 0))
          (i32.ne (local.get $submenu) (i32.const 0)))
      (then
        (if (i32.eqz (call $dynamic_menu_destroy (local.get $submenu)))
          (then (drop (call $host_menu_destroy (local.get $submenu)))))))
    (call $resource_submenu_binding_refresh (local.get $hmenu))
    (i32.const 1))

  ;; Remove one item from the mutable copy of a window-attached resource
  ;; dropdown. GetSubMenu represents these as (position+1)<<16 | source-low16,
  ;; so they are neither MNUD heap menus nor handles in the host's menu map.
  ;; Return -1 when $hmenu is not one of those encoded dropdowns, otherwise the
  ;; Win32 BOOL result. Child records are fixed 28-byte entries in the menu
  ;; blob; deleting a popup also retires its embedded child block.
  (func $resource_menu_remove
        (param $hmenu i32) (param $item i32) (param $by_position i32)
        (param $destroy i32) (result i32)
    (local $hwnd i32) (local $top i32) (local $blob i32) (local $block i32)
    (local $count i32) (local $idx i32) (local $i i32)
    (local $dst i32) (local $src i32) (local $sub i32)
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const -1))))
    (local.set $top (call $menu_handle_top_index (local.get $hwnd) (local.get $hmenu)))
    ;; The attached bar itself has top=-1. Only GetSubMenu's direct-dropdown
    ;; handles name a mutable child block here.
    (if (i32.lt_s (local.get $top) (i32.const 0))
      (then (return (i32.const -1))))
    (if (i32.ge_u (local.get $top) (call $menu_bar_count (local.get $hwnd)))
      (then (return (i32.const 0))))
    (local.set $blob (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $block
      (i32.add (local.get $blob)
        (i32.load offset=8
          (i32.add (local.get $blob)
            (i32.add (i32.const 4) (i32.mul (local.get $top) (i32.const 16)))))))
    (if (i32.eq (local.get $block) (local.get $blob))
      (then (return (i32.const 0))))
    (local.set $count (i32.load (local.get $block)))
    (if (local.get $by_position)
      (then (local.set $idx (local.get $item)))
      (else
        (local.set $idx (i32.const -1))
        (local.set $i (i32.const 0))
        (block $found (loop $find
          (br_if $found (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.eq
                (i32.load offset=20
                  (i32.add (local.get $block)
                    (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
                (local.get $item))
            (then (local.set $idx (local.get $i)) (br $found)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $find)))))
    (if (i32.or
          (i32.lt_s (local.get $idx) (i32.const 0))
          (i32.ge_u (local.get $idx) (local.get $count)))
      (then (return (i32.const 0))))
    (local.set $dst
      (i32.add (local.get $block)
        (i32.add (i32.const 4) (i32.mul (local.get $idx) (i32.const 28)))))
    (local.set $sub (i32.load offset=24 (local.get $dst)))
    (local.set $i (local.get $idx))
    (block $done (loop $shift
      (br_if $done
        (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $count)))
      (local.set $src (i32.add (local.get $dst) (i32.const 28)))
      (i32.store           (local.get $dst) (i32.load           (local.get $src)))
      (i32.store offset=4  (local.get $dst) (i32.load offset=4  (local.get $src)))
      (i32.store offset=8  (local.get $dst) (i32.load offset=8  (local.get $src)))
      (i32.store offset=12 (local.get $dst) (i32.load offset=12 (local.get $src)))
      (i32.store offset=16 (local.get $dst) (i32.load offset=16 (local.get $src)))
      (i32.store offset=20 (local.get $dst) (i32.load offset=20 (local.get $src)))
      (i32.store offset=24 (local.get $dst) (i32.load offset=24 (local.get $src)))
      (local.set $dst (local.get $src))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $shift)))
    (call $zero_memory (local.get $dst) (i32.const 28))
    (i32.store (local.get $block) (i32.sub (local.get $count) (i32.const 1)))
    (if (i32.and
          (i32.ne (local.get $destroy) (i32.const 0))
          (i32.ne (local.get $sub) (i32.const 0)))
      (then (i32.store (i32.add (local.get $blob) (local.get $sub)) (i32.const 0))))
    (i32.const 1))

  (func $menu_remove_item
        (param $hmenu i32) (param $item i32) (param $flags i32)
        (param $destroy i32) (result i32)
    (local $result i32)
    (local.set $result
      (call $dynamic_menu_remove
        (local.get $hmenu) (local.get $item)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x400)) (i32.const 0))
        (local.get $destroy)))
    (if (i32.ne (local.get $result) (i32.const -1))
      (then (return (local.get $result))))
    (local.set $result
      (call $resource_menu_remove
        (local.get $hmenu) (local.get $item)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x400)) (i32.const 0))
        (local.get $destroy)))
    (if (i32.ne (local.get $result) (i32.const -1))
      (then (return (local.get $result))))
    (call $host_menu_remove
      (local.get $hmenu) (local.get $item) (local.get $flags) (local.get $destroy)))

  (func $hex_ascii (param $n i32) (result i32)
    (local.set $n (i32.and (local.get $n) (i32.const 0x0F)))
    (if (i32.lt_u (local.get $n) (i32.const 10))
      (then (return (i32.add (local.get $n) (i32.const 48)))))
    (i32.add (local.get $n) (i32.const 87)))

  (func $write_hex_menu_label (param $dst i32) (param $id i32)
    (i32.store8        (local.get $dst) (i32.const 35)) ;; '#'
    (i32.store8 offset=1 (local.get $dst)
      (call $hex_ascii (i32.shr_u (local.get $id) (i32.const 12))))
    (i32.store8 offset=2 (local.get $dst)
      (call $hex_ascii (i32.shr_u (local.get $id) (i32.const 8))))
    (i32.store8 offset=3 (local.get $dst)
      (call $hex_ascii (i32.shr_u (local.get $id) (i32.const 4))))
    (i32.store8 offset=4 (local.get $dst)
      (call $hex_ascii (local.get $id))))

  ;; Label bytes for one dynamic item, or 0 when the item has no string of its
  ;; own: MF_SEPARATOR (0x800) draws a line, and MF_BITMAP (0x04) /
  ;; MF_OWNERDRAW (0x100) make lpNewItem a handle rather than text.
  (func $dynamic_item_label_w (param $item_w i32) (result i32)
    (local $data i32)
    (if (i32.and (i32.load (local.get $item_w)) (i32.const 0x904))
      (then (return (i32.const 0))))
    (local.set $data (i32.load offset=16 (local.get $item_w)))
    (if (i32.eqz (local.get $data)) (then (return (i32.const 0))))
    (call $g2w (local.get $data)))

  ;; First '\t' in an ASCII run, or -1. ($ml_find_tab is for the UTF-16
  ;; characters a menu resource holds and cannot read these.)
  (func $dynamic_find_tab (param $wa i32) (param $len i32) (result i32)
    (local $i i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $wa) (local.get $i))) (i32.const 0x09))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $dynamic_menu_make_popup_blob (param $hmenu i32) (result i32)
    (local $sw i32) (local $struct i32) (local $total i32) (local $blob_g i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const 0))))
    (if (i32.eqz (i32.load offset=4 (local.get $sw))) (then (return (i32.const 0))))
    ;; A tracked popup is one synthetic bar record followed by the same
    ;; recursive child blocks used by SetMenu. MF_POPUP has no command id;
    ;; flattening it into an id-zero command incorrectly made it a separator.
    (global.set $dmb_struct (i32.const 20))
    (global.set $dmb_str (i32.const 0))
    (call $dmb_measure (local.get $hmenu) (i32.const 1))
    (local.set $struct (global.get $dmb_struct))
    (local.set $total (i32.add (local.get $struct) (global.get $dmb_str)))
    (local.set $blob_g (call $heap_alloc (local.get $total)))
    (if (i32.eqz (local.get $blob_g)) (then (return (i32.const 0))))
    (global.set $dmb_blob_w (call $g2w (local.get $blob_g)))
    (call $zero_memory (global.get $dmb_blob_w) (local.get $total))
    (i32.store (global.get $dmb_blob_w) (i32.const 1))
    (global.set $dmb_struct (i32.const 20))
    (global.set $dmb_str (local.get $struct))
    (i32.store offset=12 (global.get $dmb_blob_w)
      (call $dmb_write_block (local.get $hmenu) (i32.const 1)))
    (local.get $blob_g))

  ;; ---- A menu bar built at runtime out of MNUD menus ----
  ;;
  ;; CreateMenu + AppendMenu(MF_POPUP) + SetMenu, with every level a WAT
  ;; dynamic menu, serialized into the same paint blob $menu_load makes of an
  ;; RT_MENU resource (layout at the top of this file). The tree is live MNUD
  ;; state until SetMenu, so GetSubMenu/InsertMenu/DeleteMenu work on it the
  ;; way they do on real USER while the app is still assembling it -- Civ2 asks
  ;; for each dropdown with GetSubMenu and fills it with InsertMenu before it
  ;; ever attaches the bar. Like the resource blob, dropdowns keep one level of
  ;; cascade below them.
  ;;
  ;; Two passes: $dmb_measure sizes the struct and string regions, then
  ;; $dmb_write_block lays each child block out at the $dmb_struct cursor and
  ;; each label at the $dmb_str cursor. Both cursors are blob-relative.
  (global $dmb_struct (mut i32) (i32.const 0))
  (global $dmb_str (mut i32) (i32.const 0))
  (global $dmb_blob_w (mut i32) (i32.const 0))

  (func $dmb_item_w (param $sw i32) (param $i i32) (result i32)
    (i32.add (local.get $sw)
      (i32.add (i32.const 16)
        (i32.mul (local.get $i) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))

  ;; The MNUD submenu of a popup item, or 0 for a command or a popup whose
  ;; child is not a dynamic menu (which then paints as a plain item).
  (func $dmb_child_menu (param $item i32) (result i32)
    (local $sub i32)
    (if (i32.eqz (i32.and (i32.load (local.get $item)) (i32.const 0x10)))
      (then (return (i32.const 0))))
    (local.set $sub (i32.load offset=12 (local.get $item)))
    (if (i32.eqz (call $dynamic_menu_state_w (local.get $sub)))
      (then (return (i32.const 0))))
    (local.get $sub))

  (func $dmb_measure (param $hmenu i32) (param $depth i32)
    (local $sw i32) (local $count i32) (local $i i32) (local $item i32)
    (local $label i32) (local $sub i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (global.set $dmb_struct (i32.add (global.get $dmb_struct)
      (i32.add (i32.const 4) (i32.mul (local.get $count) (i32.const 28)))))
    (block $done (loop $items
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $item (call $dmb_item_w (local.get $sw) (local.get $i)))
      (local.set $label (call $dynamic_item_label_w (local.get $item)))
      (if (local.get $label)
        (then (global.set $dmb_str
          (i32.add (global.get $dmb_str) (call $strlen (local.get $label))))))
      (local.set $sub (call $dmb_child_menu (local.get $item)))
      (if (i32.and (i32.ne (local.get $sub) (i32.const 0))
                   (i32.lt_u (local.get $depth) (i32.const 2)))
        (then (call $dmb_measure (local.get $sub)
          (i32.add (local.get $depth) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items))))

  ;; Copy one label into the string region and point $rec's text fields at it.
  ;; A dropdown item splits at the first '\t' into label and right-aligned
  ;; shortcut; a bar record has no shortcut slot, so it keeps the label only.
  (func $dmb_put_text (param $rec i32) (param $label i32) (param $split i32)
    (local $chars i32) (local $tab i32) (local $label_chars i32) (local $sc_chars i32)
    (if (i32.eqz (local.get $label)) (then (return)))
    (local.set $chars (call $strlen (local.get $label)))
    (local.set $tab (call $dynamic_find_tab (local.get $label) (local.get $chars)))
    (local.set $label_chars
      (select (local.get $tab) (local.get $chars)
        (i32.ge_s (local.get $tab) (i32.const 0))))
    (i32.store (local.get $rec) (global.get $dmb_str))
    (i32.store offset=4 (local.get $rec) (local.get $label_chars))
    (call $memcpy (i32.add (global.get $dmb_blob_w) (global.get $dmb_str))
      (local.get $label) (local.get $label_chars))
    (global.set $dmb_str (i32.add (global.get $dmb_str) (local.get $label_chars)))
    (if (i32.or (i32.eqz (local.get $split)) (i32.lt_s (local.get $tab) (i32.const 0)))
      (then (return)))
    (local.set $sc_chars
      (i32.sub (i32.sub (local.get $chars) (local.get $tab)) (i32.const 1)))
    (if (i32.eqz (local.get $sc_chars)) (then (return)))
    (i32.store offset=8 (local.get $rec) (global.get $dmb_str))
    (i32.store offset=12 (local.get $rec) (local.get $sc_chars))
    (call $memcpy (i32.add (global.get $dmb_blob_w) (global.get $dmb_str))
      (i32.add (local.get $label) (i32.add (local.get $tab) (i32.const 1)))
      (local.get $sc_chars))
    (global.set $dmb_str (i32.add (global.get $dmb_str) (local.get $sc_chars))))

  ;; Lay out $hmenu's items as one child block; returns its blob offset.
  (func $dmb_write_block (param $hmenu i32) (param $depth i32) (result i32)
    (local $sw i32) (local $count i32) (local $off i32) (local $i i32)
    (local $item i32) (local $rec i32) (local $flags i32) (local $out i32)
    (local $sub i32) (local $id i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (local.set $off (global.get $dmb_struct))
    (global.set $dmb_struct (i32.add (global.get $dmb_struct)
      (i32.add (i32.const 4) (i32.mul (local.get $count) (i32.const 28)))))
    (i32.store (i32.add (global.get $dmb_blob_w) (local.get $off)) (local.get $count))
    (block $done (loop $items
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $item (call $dmb_item_w (local.get $sw) (local.get $i)))
      (local.set $rec (i32.add (global.get $dmb_blob_w)
        (i32.add (local.get $off)
          (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28))))))
      (local.set $flags (i32.load (local.get $item)))
      (local.set $id (i32.load offset=4 (local.get $item)))
      (call $dmb_put_text (local.get $rec)
        (call $dynamic_item_label_w (local.get $item)) (i32.const 1))
      ;; Shared bar/popup flags: separator (or a command with no id),
      ;; grayed, checked, and the owner-draw marker below.
      (local.set $out (i32.const 0))
      ;; USER also makes a separator of a plain string item whose string is
      ;; NULL: Civ2 spaces its dropdowns with InsertMenu(MF_STRING, id, NULL).
      (if (i32.or
            (i32.or (i32.ne (i32.and (local.get $flags) (i32.const 0x0800)) (i32.const 0))
                    (i32.and (i32.eqz (local.get $id))
                             (i32.eqz (i32.and (local.get $flags) (i32.const 0x10)))))
            (i32.and (i32.eqz (i32.and (local.get $flags) (i32.const 0x0914)))
                     (i32.eqz (i32.load offset=16 (local.get $item)))))
        (then (local.set $out (i32.or (local.get $out) (i32.const 1)))))
      (if (i32.and (local.get $flags) (i32.const 0x0003))
        (then (local.set $out (i32.or (local.get $out) (i32.const 2)))))
      (if (i32.and (local.get $flags) (i32.const 0x0008))
        (then (local.set $out (i32.or (local.get $out) (i32.const 4)))))
      ;; Preserve the tracked popup painter's owner-draw marker. Submenus
      ;; are identified by their child offset, independently of this bit.
      (if (i32.and (local.get $flags) (i32.const 0x0100))
        (then (local.set $out (i32.or (local.get $out) (i32.const 8)))))
      (i32.store offset=16 (local.get $rec) (local.get $out))
      (i32.store offset=20 (local.get $rec) (local.get $id))
      (local.set $sub (call $dmb_child_menu (local.get $item)))
      (if (i32.and (i32.ne (local.get $sub) (i32.const 0))
                   (i32.lt_u (local.get $depth) (i32.const 2)))
        (then (i32.store offset=24 (local.get $rec)
          (call $dmb_write_block (local.get $sub)
            (i32.add (local.get $depth) (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items)))
    (local.get $off))

  ;; Install $hmenu's tree as $hwnd's menu bar. Returns 0, having done
  ;; nothing, when $hmenu is not a dynamic menu.
  (func $menu_set_bar_from_dynamic (param $hwnd i32) (param $hmenu i32) (result i32)
    (local $sw i32) (local $count i32) (local $i i32) (local $item i32)
    (local $label i32) (local $sub i32) (local $struct i32) (local $total i32)
    (local $blob_g i32) (local $rec i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const 0))))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    ;; Pass 1.
    (global.set $dmb_struct
      (i32.add (i32.const 4) (i32.mul (local.get $count) (i32.const 16))))
    (global.set $dmb_str (i32.const 0))
    (block $sized (loop $measure
      (br_if $sized (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $item (call $dmb_item_w (local.get $sw) (local.get $i)))
      (local.set $label (call $dynamic_item_label_w (local.get $item)))
      (if (local.get $label)
        (then (global.set $dmb_str
          (i32.add (global.get $dmb_str) (call $strlen (local.get $label))))))
      (local.set $sub (call $dmb_child_menu (local.get $item)))
      (if (local.get $sub) (then (call $dmb_measure (local.get $sub) (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $measure)))
    (local.set $struct (global.get $dmb_struct))
    (local.set $total (i32.add (local.get $struct) (global.get $dmb_str)))
    (local.set $blob_g (call $heap_alloc (local.get $total)))
    (if (i32.eqz (local.get $blob_g)) (then (return (i32.const 0))))
    (global.set $dmb_blob_w (call $g2w (local.get $blob_g)))
    (call $zero_memory (global.get $dmb_blob_w) (local.get $total))
    ;; Pass 2.
    (i32.store (global.get $dmb_blob_w) (local.get $count))
    (global.set $dmb_struct
      (i32.add (i32.const 4) (i32.mul (local.get $count) (i32.const 16))))
    (global.set $dmb_str (local.get $struct))
    (local.set $i (i32.const 0))
    (block $done (loop $bars
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $item (call $dmb_item_w (local.get $sw) (local.get $i)))
      (local.set $rec (i32.add (global.get $dmb_blob_w)
        (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 16)))))
      (call $dmb_put_text (local.get $rec)
        (call $dynamic_item_label_w (local.get $item)) (i32.const 0))
      (local.set $sub (call $dmb_child_menu (local.get $item)))
      (if (local.get $sub)
        (then (i32.store offset=8 (local.get $rec)
          (call $dmb_write_block (local.get $sub) (i32.const 1)))))
      (i32.store offset=12 (local.get $rec)
        (select (i32.const 0) (i32.load offset=4 (local.get $item))
          (i32.ne (i32.and (i32.load (local.get $item)) (i32.const 0x10)) (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $bars)))
    (call $menu_set_source (local.get $hwnd) (global.get $dmb_blob_w)
      (local.get $total) (local.get $hmenu))
    (call $heap_free (local.get $blob_g))
    (i32.const 1))

  (func $resource_submenu_binding_find_key
        (param $parent_blob i32) (param $top i32) (param $child i32) (result i32)
    (local $binding i32) (local $bw i32)
    (local.set $binding (global.get $resource_submenu_bindings))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $binding)))
      (local.set $bw (call $g2w (local.get $binding)))
      (if (i32.and
            (i32.eq (i32.load offset=4 (local.get $bw)) (local.get $parent_blob))
            (i32.and
              (i32.eq (i32.load offset=8 (local.get $bw)) (local.get $top))
              (i32.eq (i32.load offset=12 (local.get $bw)) (local.get $child))))
        (then (return (local.get $bw))))
      (local.set $binding (i32.load (local.get $bw)))
      (br $scan)))
    (i32.const 0))

  (func $resource_submenu_binding_find_handle (param $hmenu i32) (result i32)
    (local $binding i32) (local $bw i32)
    (local.set $binding (global.get $resource_submenu_bindings))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $binding)))
      (local.set $bw (call $g2w (local.get $binding)))
      (if (i32.eq (i32.load offset=16 (local.get $bw)) (local.get $hmenu))
        (then (return (local.get $bw))))
      (local.set $binding (i32.load (local.get $bw)))
      (br $scan)))
    (i32.const 0))

  ;; Is $h the dynamic menu $root or one of its popup descendants? Depth is
  ;; bounded the way the blob writer bounds it.
  (func $dynamic_menu_contains (param $root i32) (param $h i32) (param $depth i32) (result i32)
    (local $sw i32) (local $count i32) (local $i i32) (local $rec i32)
    (if (i32.eq (local.get $root) (local.get $h)) (then (return (i32.const 1))))
    (if (i32.gt_u (local.get $depth) (i32.const 3)) (then (return (i32.const 0))))
    (local.set $sw (call $dynamic_menu_state_w (local.get $root)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const 0))))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $dmb_item_w (local.get $sw) (local.get $i)))
      (if (i32.and (i32.load (local.get $rec)) (i32.const 0x10))
        (then
          (if (call $dynamic_menu_contains (i32.load offset=12 (local.get $rec))
                (local.get $h) (i32.add (local.get $depth) (i32.const 1)))
            (then (return (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; A window's menu bar blob is a snapshot built by SetMenu from its dynamic
  ;; tree, but USER reads the live HMENU: a CheckMenuItem or EnableMenuItem on
  ;; one of the bar's popups shows the next time that popup opens, with no
  ;; DrawMenuBar. Rebuild the snapshot of every window whose attached dynamic
  ;; bar contains $hmenu. VB1 builds its menus this way (CreateMenu/AppendMenu,
  ;; then SetMenu); JigSawed's Options checks never reached the drawn menu.
  (global $menu_refresh_in_place (mut i32) (i32.const 0))
  (func $dynamic_menu_refresh_attached (param $hmenu i32)
    (local $i i32) (local $hwnd i32) (local $src i32)
    (if (i32.eqz (call $dynamic_menu_state_w (local.get $hmenu))) (then (return)))
    (block $done (loop $wins
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (load.field WndRecord hwnd (call $wnd_record_addr (local.get $i))))
      (if (local.get $hwnd)
        (then
          (local.set $src (call $menu_source_get (local.get $hwnd)))
          (if (i32.and (i32.ne (local.get $src) (i32.const 0))
                (i32.ne (call $dynamic_menu_state_w (local.get $src)) (i32.const 0)))
            (then
              (if (call $dynamic_menu_contains (local.get $src) (local.get $hmenu) (i32.const 0))
                (then
                  (global.set $menu_refresh_in_place (i32.const 1))
                  (drop (call $menu_set_bar_from_dynamic
                    (local.get $hwnd) (local.get $src)))
                  (global.set $menu_refresh_in_place (i32.const 0))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $wins))))

  ;; Rebuild the compact paint view after a mutation of a bound cascade. The
  ;; public handle remains the MNUD object; this copy exists only because the
  ;; menu compositor consumes the common resource/dynamic blob representation.
  (func $resource_submenu_binding_refresh (param $hmenu i32)
    (local $bw i32) (local $old i32) (local $measurements i32)
    (call $dynamic_menu_refresh_attached (local.get $hmenu))
    (local.set $bw (call $resource_submenu_binding_find_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $bw)) (then (return)))
    (local.set $old (i32.load offset=20 (local.get $bw)))
    (if (local.get $old) (then (call $heap_free (local.get $old))))
    ;; Item insertion/removal/replacement invalidates every cached index and
    ;; itemData value. Re-measure lazily when geometry is next queried.
    (local.set $measurements (i32.load offset=28 (local.get $bw)))
    (if (local.get $measurements)
      (then
        (call $heap_free (local.get $measurements))
        (i32.store offset=28 (local.get $bw) (i32.const 0))))
    (i32.store offset=20 (local.get $bw)
      (call $dynamic_menu_make_popup_blob (local.get $hmenu))))

  ;; Return -1 when no mutable cascade is bound, zero for a bound-but-empty
  ;; popup, or the WASM address of its current paint blob.
  (func $resource_submenu_blob_w
        (param $parent_w i32) (param $top i32) (param $child i32) (result i32)
    (local $bw i32) (local $paint i32)
    (local.set $bw (call $resource_submenu_binding_find_key
      (call $w2g (local.get $parent_w)) (local.get $top) (local.get $child)))
    (if (i32.eqz (local.get $bw)) (then (return (i32.const -1))))
    (local.set $paint (i32.load offset=20 (local.get $bw)))
    (if (i32.eqz (local.get $paint)) (then (return (i32.const 0))))
    (call $g2w (local.get $paint)))

  (func $resource_submenu_binding_forget_handle (param $hmenu i32) (result i32)
    (local $binding i32) (local $prev_w i32) (local $bw i32) (local $next i32)
    (local $parent_w i32) (local $item i32)
    (local.set $binding (global.get $resource_submenu_bindings))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $binding)))
      (local.set $bw (call $g2w (local.get $binding)))
      (local.set $next (i32.load (local.get $bw)))
      (if (i32.eq (i32.load offset=16 (local.get $bw)) (local.get $hmenu))
        (then
          ;; Destroying an HMENU destroys its submenus. Retire the resource
          ;; item's link as well as the mutable object so the immutable seed
          ;; cannot reappear in paint/hit testing after DestroyMenu returns.
          (local.set $parent_w (call $g2w (i32.load offset=4 (local.get $bw))))
          (local.set $item (call $child_item_w
            (local.get $parent_w)
            (i32.load offset=8 (local.get $bw))
            (i32.load offset=12 (local.get $bw))))
          (if (local.get $item)
            (then (i32.store offset=24 (local.get $item) (i32.const 0))))
          (if (i32.load offset=20 (local.get $bw))
            (then (call $heap_free (i32.load offset=20 (local.get $bw)))))
          (if (i32.load offset=24 (local.get $bw))
            (then (call $heap_free (i32.load offset=24 (local.get $bw)))))
          (if (i32.load offset=28 (local.get $bw))
            (then (call $heap_free (i32.load offset=28 (local.get $bw)))))
          (if (local.get $prev_w)
            (then (i32.store (local.get $prev_w) (local.get $next)))
            (else (global.set $resource_submenu_bindings (local.get $next))))
          (call $heap_free (local.get $binding))
          (return (i32.const 1))))
      (local.set $prev_w (local.get $bw))
      (local.set $binding (local.get $next))
      (br $scan)))
    (i32.const 0))

  (func $resource_submenu_bindings_drop_parent (param $parent_blob i32)
    (local $binding i32) (local $prev_w i32) (local $bw i32) (local $next i32)
    (local $hmenu i32) (local $sw i32)
    (local.set $binding (global.get $resource_submenu_bindings))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $binding)))
      (local.set $bw (call $g2w (local.get $binding)))
      (local.set $next (i32.load (local.get $bw)))
      (if (i32.eq (i32.load offset=4 (local.get $bw)) (local.get $parent_blob))
        (then
          (if (i32.load offset=20 (local.get $bw))
            (then (call $heap_free (i32.load offset=20 (local.get $bw)))))
          (if (i32.load offset=24 (local.get $bw))
            (then (call $heap_free (i32.load offset=24 (local.get $bw)))))
          (if (i32.load offset=28 (local.get $bw))
            (then (call $heap_free (i32.load offset=28 (local.get $bw)))))
          (local.set $hmenu (i32.load offset=16 (local.get $bw)))
          (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
          (if (local.get $sw)
            (then
              (call $dynamic_menu_owned_texts_release (local.get $sw))
              (i32.store (local.get $sw) (i32.const 0))
              (call $heap_free (local.get $hmenu))))
          (if (local.get $prev_w)
            (then (i32.store (local.get $prev_w) (local.get $next)))
            (else (global.set $resource_submenu_bindings (local.get $next))))
          (call $heap_free (local.get $binding)))
        (else (local.set $prev_w (local.get $bw))))
      (local.set $binding (local.get $next))
      (br $scan))))

  (func $resource_submenu_bind
        (param $parent_w i32) (param $top i32) (param $child i32)
        (param $hwnd i32) (result i32)
    (local $bw i32) (local $hdr i32) (local $count i32) (local $i i32)
    (local $it i32) (local $flags i32) (local $mf i32) (local $label_len i32)
    (local $label_bytes i32) (local $labels i32) (local $label_at i32)
    (local $hmenu i32) (local $binding i32)
    (local.set $bw (call $resource_submenu_binding_find_key
      (call $w2g (local.get $parent_w)) (local.get $top) (local.get $child)))
    (if (local.get $bw)
      (then (return (i32.load offset=16 (local.get $bw)))))
    (local.set $hdr (call $child_sub_hdr_w
      (local.get $parent_w) (local.get $top) (local.get $child)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (local.set $count (i32.load (local.get $hdr)))
    (local.set $i (i32.const 0))
    (block $sized (loop $measure
      (br_if $sized (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $it (i32.add (local.get $hdr)
        (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (local.set $label_bytes (i32.add (local.get $label_bytes)
        (i32.add (i32.load offset=4 (local.get $it)) (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $measure)))
    (local.set $hmenu (call $dynamic_menu_create))
    (if (i32.eqz (local.get $hmenu)) (then (return (i32.const 0))))
    (if (local.get $label_bytes)
      (then
        (local.set $labels (call $heap_alloc (local.get $label_bytes)))
        (if (i32.eqz (local.get $labels))
          (then
            (drop (call $dynamic_menu_destroy (local.get $hmenu)))
            (return (i32.const 0))))))
    (local.set $label_at (local.get $labels))
    (local.set $i (i32.const 0))
    (block $seeded (loop $seed
      (br_if $seeded (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $it (i32.add (local.get $hdr)
        (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (local.set $flags (i32.load offset=16 (local.get $it)))
      (local.set $mf (i32.const 0))
      (if (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))
        (then (local.set $mf (i32.or (local.get $mf) (i32.const 0x800)))))
      (if (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))
        (then (local.set $mf (i32.or (local.get $mf) (i32.const 1)))))
      (if (i32.ne (i32.and (local.get $flags) (i32.const 4)) (i32.const 0))
        (then (local.set $mf (i32.or (local.get $mf) (i32.const 8)))))
      (local.set $label_len (i32.load offset=4 (local.get $it)))
      (if (local.get $label_len)
        (then
          (call $memcpy (call $g2w (local.get $label_at))
            (i32.add (local.get $parent_w) (i32.load (local.get $it)))
            (local.get $label_len))))
      (i32.store8 (i32.add (call $g2w (local.get $label_at)) (local.get $label_len))
        (i32.const 0))
      (drop (call $dynamic_menu_append
        (local.get $hmenu) (local.get $mf) (i32.load offset=20 (local.get $it))
        (local.get $label_at)))
      (local.set $label_at
        (i32.add (local.get $label_at) (i32.add (local.get $label_len) (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $seed)))
    (local.set $binding (call $heap_alloc (i32.const 36)))
    (if (i32.eqz (local.get $binding))
      (then
        (if (local.get $labels) (then (call $heap_free (local.get $labels))))
        (drop (call $dynamic_menu_destroy (local.get $hmenu)))
        (return (i32.const 0))))
    (local.set $bw (call $g2w (local.get $binding)))
    (i32.store (local.get $bw) (global.get $resource_submenu_bindings))
    (i32.store offset=4 (local.get $bw) (call $w2g (local.get $parent_w)))
    (i32.store offset=8 (local.get $bw) (local.get $top))
    (i32.store offset=12 (local.get $bw) (local.get $child))
    (i32.store offset=16 (local.get $bw) (local.get $hmenu))
    (i32.store offset=20 (local.get $bw) (i32.const 0))
    (i32.store offset=24 (local.get $bw) (local.get $labels))
    (i32.store offset=28 (local.get $bw) (i32.const 0))
    (i32.store offset=32 (local.get $bw) (local.get $hwnd))
    (global.set $resource_submenu_bindings (local.get $binding))
    (call $resource_submenu_binding_refresh (local.get $hmenu))
    (local.get $hmenu))

  ;; Cached Win98 MEASUREITEM dimensions for one item in a resource-backed
  ;; mutable cascade. The packed result is height:width; ordinary items and
  ;; unbound resource menus retain the classic 20px row and no width override.
  ;; A mutation drops the whole cache because both positions and itemData can
  ;; change in one InsertMenuItem/SetMenuItemInfo call.
  (func $resource_submenu_item_dimensions
        (param $parent_w i32) (param $top i32) (param $child i32)
        (param $index i32) (result i32)
    (local $bw i32) (local $hmenu i32) (local $sw i32) (local $item i32)
    (local $measurements i32) (local $mw i32) (local $mis i32) (local $misw i32)
    (local $width i32) (local $height i32)
    (local.set $bw (call $resource_submenu_binding_find_key
      (call $w2g (local.get $parent_w)) (local.get $top) (local.get $child)))
    (if (i32.eqz (local.get $bw)) (then (return (i32.const 0x00140000))))
    (local.set $hmenu (i32.load offset=16 (local.get $bw)))
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.or
          (i32.eqz (local.get $sw))
          (i32.or
            (i32.lt_s (local.get $index) (i32.const 0))
            (i32.ge_u (local.get $index) (i32.load offset=4 (local.get $sw)))))
      (then (return (i32.const 0x00140000))))
    (local.set $item (i32.add (local.get $sw)
      (i32.add (i32.const 16)
        (i32.mul (local.get $index) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
    (if (i32.eqz (i32.and (i32.load (local.get $item)) (i32.const 0x0100)))
      (then (return (i32.const 0x00140000))))
    (local.set $measurements (i32.load offset=28 (local.get $bw)))
    (if (i32.eqz (local.get $measurements))
      (then
        ;; 64 MNUD slots x {measured, width, height}.
        (local.set $measurements (call $heap_alloc (i32.const 768)))
        (if (i32.eqz (local.get $measurements))
          (then (return (i32.const 0x00140000))))
        (call $zero_memory (call $g2w (local.get $measurements)) (i32.const 768))
        (i32.store offset=28 (local.get $bw) (local.get $measurements))))
    (local.set $mw (i32.add (call $g2w (local.get $measurements))
      (i32.mul (local.get $index) (i32.const 12))))
    (if (i32.load (local.get $mw))
      (then
        (return (i32.or
          (i32.and (i32.load offset=4 (local.get $mw)) (i32.const 0xFFFF))
          (i32.shl (i32.load offset=8 (local.get $mw)) (i32.const 16))))))
    (local.set $mis (call $heap_alloc (i32.const 24)))
    (if (i32.eqz (local.get $mis))
      (then (return (i32.const 0x00140000))))
    (local.set $misw (call $g2w (local.get $mis)))
    (i32.store           (local.get $misw) (i32.const 1)) ;; ODT_MENU
    (i32.store offset=4  (local.get $misw) (i32.const 0))
    (i32.store offset=8  (local.get $misw) (i32.load offset=4 (local.get $item)))
    (i32.store offset=12 (local.get $misw) (i32.const 0))
    (i32.store offset=16 (local.get $misw) (i32.const 20))
    (i32.store offset=20 (local.get $misw) (i32.load offset=8 (local.get $item)))
    (drop (call $wnd_send_message
      (i32.load offset=32 (local.get $bw)) (i32.const 0x002C)
      (i32.const 0) (local.get $mis)))
    (local.set $width (i32.load offset=12 (local.get $misw)))
    (local.set $height (i32.load offset=16 (local.get $misw)))
    (call $heap_free (local.get $mis))
    (if (i32.or
          (i32.lt_s (local.get $width) (i32.const 0))
          (i32.gt_s (local.get $width) (i32.const 4096)))
      (then (local.set $width (i32.const 0))))
    (if (i32.or
          (i32.lt_s (local.get $height) (i32.const 1))
          (i32.gt_s (local.get $height) (i32.const 255)))
      (then (local.set $height (i32.const 20))))
    (i32.store          (local.get $mw) (i32.const 1))
    (i32.store offset=4 (local.get $mw) (local.get $width))
    (i32.store offset=8 (local.get $mw) (local.get $height))
    (i32.or (i32.and (local.get $width) (i32.const 0xFFFF))
      (i32.shl (local.get $height) (i32.const 16))))

  (func $resource_submenu_ownerdraw_width
        (param $parent_w i32) (param $top i32) (param $child i32)
        (param $count i32) (result i32)
    (local $i i32) (local $width i32) (local $candidate i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $candidate (i32.and
        (call $resource_submenu_item_dimensions
          (local.get $parent_w) (local.get $top) (local.get $child) (local.get $i))
        (i32.const 0xFFFF)))
      (if (i32.gt_u (local.get $candidate) (local.get $width))
        (then (local.set $width (local.get $candidate))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    ;; USER supplies the checkmark gutter around an owner-measured menu item.
    (select (i32.add (local.get $width) (i32.const 40)) (i32.const 0)
      (i32.ne (local.get $width) (i32.const 0))))

  (func $resource_submenu_item_height
        (param $parent_w i32) (param $top i32) (param $child i32)
        (param $index i32) (result i32)
    (i32.shr_u
      (call $resource_submenu_item_dimensions
        (local.get $parent_w) (local.get $top) (local.get $child) (local.get $index))
      (i32.const 16)))

  ;; Hand an owner-draw menu row to the owning guest wndproc. hDC is the same
  ;; canonical screen overlay the normal menu painter uses, so guest GDI calls
  ;; write directly into the pixels the compositor presents.
  (func $resource_submenu_draw_item
        (param $parent_w i32) (param $top i32) (param $child i32)
        (param $index i32) (param $hdc i32)
        (param $left i32) (param $top_y i32) (param $right i32) (param $bottom i32)
        (param $selected i32) (result i32)
    (local $bw i32) (local $hmenu i32) (local $sw i32) (local $item i32)
    (local $flags i32) (local $state i32) (local $dis i32) (local $disw i32)
    (local.set $bw (call $resource_submenu_binding_find_key
      (call $w2g (local.get $parent_w)) (local.get $top) (local.get $child)))
    (if (i32.eqz (local.get $bw)) (then (return (i32.const 0))))
    (local.set $hmenu (i32.load offset=16 (local.get $bw)))
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.or
          (i32.eqz (local.get $sw))
          (i32.or
            (i32.lt_s (local.get $index) (i32.const 0))
            (i32.ge_u (local.get $index) (i32.load offset=4 (local.get $sw)))))
      (then (return (i32.const 0))))
    (local.set $item (i32.add (local.get $sw)
      (i32.add (i32.const 16)
        (i32.mul (local.get $index) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
    (local.set $flags (i32.load (local.get $item)))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x0100)))
      (then (return (i32.const 0))))
    (local.set $state
      (i32.or
        (i32.or
          (select (i32.const 0x0001) (i32.const 0)
            (i32.ne (local.get $selected) (i32.const 0)))
          (select (i32.const 0x0002) (i32.const 0)
            (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))))
        (i32.or
          (select (i32.const 0x0004) (i32.const 0)
            (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0)))
          (select (i32.const 0x0008) (i32.const 0)
            (i32.ne (i32.and (local.get $flags) (i32.const 8)) (i32.const 0))))))
    (local.set $dis (call $heap_alloc (i32.const 48)))
    (if (i32.eqz (local.get $dis)) (then (return (i32.const 0))))
    (local.set $disw (call $g2w (local.get $dis)))
    (i32.store           (local.get $disw) (i32.const 1)) ;; ODT_MENU
    (i32.store offset=4  (local.get $disw) (i32.const 0))
    (i32.store offset=8  (local.get $disw) (i32.load offset=4 (local.get $item)))
    (i32.store offset=12 (local.get $disw) (i32.const 1)) ;; ODA_DRAWENTIRE
    (i32.store offset=16 (local.get $disw) (local.get $state))
    (i32.store offset=20 (local.get $disw) (local.get $hmenu))
    (i32.store offset=24 (local.get $disw) (local.get $hdc))
    (i32.store offset=28 (local.get $disw) (local.get $left))
    (i32.store offset=32 (local.get $disw) (local.get $top_y))
    (i32.store offset=36 (local.get $disw) (local.get $right))
    (i32.store offset=40 (local.get $disw) (local.get $bottom))
    (i32.store offset=44 (local.get $disw) (i32.load offset=8 (local.get $item)))
    (drop (call $wnd_send_message
      (i32.load offset=32 (local.get $bw)) (i32.const 0x002B)
      (i32.const 0) (local.get $dis)))
    (call $heap_free (local.get $dis))
    (i32.const 1))

  ;; Install (or replace) a menu blob for a window. Allocates heap
  ;; memory, memcpys the source bytes, stores the guest pointer in
  ;; MENU_DATA_TABLE[slot]. Frees any prior blob first.
  ;; Args: hwnd, src_wa (WASM addr), len (bytes).
  (func (export "menu_set")
        (param $hwnd i32) (param $src_wa i32) (param $len i32)
    (local $slot i32) (local $tbl i32) (local $old i32) (local $newg i32) (local $neww i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then (return)))
    (local.set $tbl (call $menu_data_table_addr (local.get $slot)))
    (local.set $old (i32.load (local.get $tbl)))
    (if (local.get $old)
      (then
        (call $resource_submenu_bindings_drop_parent (local.get $old))
        (call $heap_free (i32.sub (local.get $old) (i32.const 8)))))
    (i32.store (local.get $tbl) (i32.const 0))
    (if (i32.eqz (local.get $len)) (then (return)))
    (local.set $newg (call $heap_alloc (i32.add (local.get $len) (i32.const 8)))) (local.set $neww (call $g2w (local.get $newg)))
    (i32.store (local.get $neww) (i32.const 0))
    (i32.store offset=4 (local.get $neww) (local.get $len))
    (call $memcpy
      (i32.add (local.get $neww) (i32.const 8))
      (local.get $src_wa) (local.get $len))
    (i32.store (local.get $tbl) (i32.add (local.get $newg) (i32.const 8)))
    ;; Host-built menus are serialized only after SetMenu has returned to the
    ;; browser bridge. Recompute now that menu_bar_count can see the blob.
    (call $defwndproc_do_nccalcsize (local.get $hwnd)))

  ;; Host-created menu bars have no RT_MENU resource key, but GetMenu and the
  ;; handle-based mutation APIs still need the CreateMenu handle as identity.
  ;; Keep the ordinary three-argument menu_set for tests/tools and let the
  ;; runtime bridge supply the source handle through this variant.
  (func $menu_set_source (export "menu_set_source")
        (param $hwnd i32) (param $src_wa i32) (param $len i32) (param $source i32)
    (local $slot i32) (local $tbl i32) (local $old i32) (local $newg i32) (local $neww i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then (return)))
    (local.set $tbl (call $menu_data_table_addr (local.get $slot)))
    (local.set $old (i32.load (local.get $tbl)))
    (if (local.get $old)
      (then
        (call $resource_submenu_bindings_drop_parent (local.get $old))
        (call $heap_free (i32.sub (local.get $old) (i32.const 8)))))
    (i32.store (local.get $tbl) (i32.const 0))
    (if (i32.eqz (local.get $len)) (then (return)))
    (local.set $newg (call $heap_alloc (i32.add (local.get $len) (i32.const 8)))) (local.set $neww (call $g2w (local.get $newg)))
    (i32.store (local.get $neww) (local.get $source))
    (i32.store offset=4 (local.get $neww) (local.get $len))
    (call $memcpy
      (i32.add (local.get $neww) (i32.const 8))
      (local.get $src_wa) (local.get $len))
    (i32.store (local.get $tbl) (i32.add (local.get $newg) (i32.const 8)))
    ;; A refresh of an already attached bar (an item checked/greyed under it)
    ;; keeps the same bar, so it must not touch window geometry.
    (if (i32.eqz (global.get $menu_refresh_in_place))
      (then (call $defwndproc_do_nccalcsize (local.get $hwnd)))))

  ;; Browser hosts do not carry a JS guest-address translator. Let them fill a
  ;; temporary guest allocation through guest_write8 and translate it here.
  (func (export "menu_set_source_guest")
        (param $hwnd i32) (param $src_g i32) (param $len i32) (param $source i32)
    (call $menu_set_source (local.get $hwnd) (call $g2w (local.get $src_g))
      (local.get $len) (local.get $source)))

  ;; Drop a window's menu (called from $host_destroy_window path).
  (func (export "menu_clear") (param $hwnd i32)
    (local $slot i32) (local $tbl i32) (local $old i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then (return)))
    (local.set $tbl (call $menu_data_table_addr (local.get $slot)))
    (local.set $old (i32.load (local.get $tbl)))
    (if (local.get $old)
      (then
        (call $resource_submenu_bindings_drop_parent (local.get $old))
        (call $heap_free (i32.sub (local.get $old) (i32.const 8)))))
    (i32.store (local.get $tbl) (i32.const 0)))

  ;; Top-level item count (0 if no menu). Helper for keyboard nav.
  (func $menu_bar_count (export "menu_bar_count") (param $hwnd i32) (result i32)
    (local $b i32)
    (local.set $b (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $b)) (then (return (i32.const 0))))
    (i32.load (local.get $b)))

  ;; ----- text-width measurement -----
  ;; gdi_draw_text with DT_CALCRECT(0x400)|DT_SINGLELINE(0x20)|DT_NOPREFIX(0x800)
  ;; = 0xC20 returns the natural width via the rect's right field.
  (func $measure_text (param $hdc i32) (param $text_wa i32) (param $len i32)
                       (result i32)
    (local $rect i32)
    (local.set $rect (call $paint_rect (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (drop (call $gdi_native_draw_text (local.get $hdc)
            (local.get $text_wa) (local.get $len)
            (local.get $rect)
            (i32.const 0xC20) (i32.const 0)))
    (i32.load offset=8 (local.get $rect)))

  ;; Size a popup from the items Windows will actually draw. The left check
  ;; gutter and right shortcut/arrow gutter consume 20px each; an accelerator
  ;; gets a 24px gap after the label. Keep the former 180px layout as a floor
  ;; so existing compact menus remain pixel-stable while long Win9x menus
  ;; (notably WinRAR's Commands popup) grow instead of colliding text columns.
  (func $menu_header_width
        (param $blob_w i32) (param $hdr i32) (param $hdc i32) (result i32)
    (local $count i32) (local $i i32) (local $it i32) (local $flags i32)
    (local $label_w i32) (local $sc_w i32) (local $candidate i32)
    (local $width i32) (local $sc_len i32) (local $old_font i32)
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (local.set $old_font
      (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
    (local.set $count (i32.load (local.get $hdr)))
    (local.set $width (i32.const 180))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $it (i32.add (local.get $hdr)
                       (i32.add (i32.const 4)
                         (i32.mul (local.get $i) (i32.const 28)))))
      (local.set $flags (i32.load offset=16 (local.get $it)))
      (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x01)))
        (then
          (local.set $label_w
            (call $measure_text (local.get $hdc)
              (i32.add (local.get $blob_w) (i32.load (local.get $it)))
              (i32.load offset=4 (local.get $it))))
          (local.set $candidate
            (i32.add (local.get $label_w) (i32.const 40)))
          (local.set $sc_len (i32.load offset=12 (local.get $it)))
          (if (local.get $sc_len)
            (then
              (local.set $sc_w
                (call $measure_text (local.get $hdc)
                  (i32.add (local.get $blob_w) (i32.load offset=8 (local.get $it)))
                  (local.get $sc_len)))
              (local.set $candidate
                (i32.add (local.get $candidate)
                  (i32.add (i32.const 24) (local.get $sc_w))))))
          (if (i32.gt_u (local.get $candidate) (local.get $width))
            (then (local.set $width (local.get $candidate))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old_font)))
    (local.get $width))

  ;; ----- bar item geometry walker -----
  ;; Compute the width of bar item $idx (0-based). hdc must be set up
  ;; with the menu font already selected. Returns text-width + 12.
  (func $bar_item_width (param $blob_w i32) (param $hdc i32) (param $idx i32)
                          (result i32)
    (local $base i32) (local $text_w i32)
    (local.set $base (i32.add (local.get $blob_w)
                       (i32.add (i32.const 4) (i32.mul (local.get $idx) (i32.const 16)))))
    (local.set $text_w
      (call $measure_text (local.get $hdc)
        (i32.add (local.get $blob_w) (i32.load (local.get $base)))
        (i32.load offset=4 (local.get $base))))
    (i32.add (local.get $text_w) (i32.const 12)))

  ;; Compute the LEFT edge x-offset (relative to bar start) of bar item
  ;; $target. Walks items 0..target-1, summing widths.
  (func $bar_item_x (param $blob_w i32) (param $hdc i32) (param $target i32)
                      (result i32)
    (local $i i32) (local $x i32)
    (local.set $x (i32.const 4))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $target)))
      (local.set $x (i32.add (local.get $x)
                       (call $bar_item_width (local.get $blob_w) (local.get $hdc) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $x))

  ;; ============================================================
  ;; $menu_paint_bar — draw the menu bar at (x, y, w, 18). Mirrors
  ;; the old JS drawMenuBar layout exactly (item.x = running cursor,
  ;; item.w = textWidth + 12, label drawn at item.x + 6, highlight
  ;; covers full item rect when open). Called via _activeChildDraw
  ;; routing so gdi_* primitives composite at the screen position
  ;; the renderer chose.
  ;; ============================================================
  (func $menu_bar_screen_x (export "menu_bar_screen_x") (param $hwnd i32) (result i32)
    (i32.add (call $wnd_window_screen_x (local.get $hwnd)) (i32.const 3)))

  (func $menu_bar_screen_y (export "menu_bar_screen_y") (param $hwnd i32) (result i32)
    (local $style i32) (local $is_child i32) (local $has_caption i32)
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    (local.set $is_child
      (i32.ne (i32.and (local.get $style) (i32.const 0x40000000)) (i32.const 0)))
    (local.set $has_caption
      (i32.eq (i32.and (local.get $style) (i32.const 0x00C00000))
              (i32.const 0x00C00000)))
    (if
      (i32.and
        (i32.eqz (local.get $is_child))
        (i32.and
          (i32.ne (i32.and (local.get $style) (i32.const 0x00800000)) (i32.const 0))
          (i32.ne (i32.and (local.get $style) (i32.const 0x00080000)) (i32.const 0))))
      (then (local.set $has_caption (i32.const 1))))
    (i32.add
      (call $wnd_window_screen_y (local.get $hwnd))
      (i32.add
        (i32.const 3)
        (select (i32.const 19) (i32.const 0) (local.get $has_caption)))))

  (func $menu_bar_screen_h (export "menu_bar_screen_h") (result i32)
    (i32.const 18))

  (func (export "menu_paint_bar")
        (param $hwnd i32) (param $x i32) (param $y i32) (param $w i32)
        (param $open_idx i32)
        (result i32)  ;; bar height drawn (0 if no menu)
    (local $blob i32) (local $count i32) (local $i i32)
    (local $hdc i32) (local $cur_x i32) (local $iw i32)
    (local $base i32) (local $text_wa i32) (local $text_len i32)

    (local.set $blob (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $count (i32.load (local.get $blob)))
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
    (if (i32.and
          (i32.ne (global.get $menu_open_popup_blob) (i32.const 0))
          (i32.eq (local.get $hwnd) (global.get $menu_open_hwnd)))
      (then (local.set $open_idx (i32.const -1))))

    (local.set $hdc (call $host_alloc_window_dc (local.get $hwnd) (i32.const 2)))
    (if (i32.eqz (local.get $hdc)) (then (return (i32.const 0))))
    ;; Background fill (menuBg = LTGRAY = 0xC0C0C0 = LTGRAY_BRUSH 0x30011).
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (local.get $x) (local.get $y)
            (i32.add (local.get $x) (local.get $w))
            (i32.add (local.get $y) (i32.const 18))
            (i32.const 0x30011)))
    ;; Font + transparent bk (so highlight or face shows through).
    (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
    (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))

    (local.set $cur_x (i32.add (local.get $x) (i32.const 4)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $base (i32.add (local.get $blob)
                         (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 16)))))
      (local.set $text_wa (i32.add (local.get $blob) (i32.load (local.get $base))))
      (local.set $text_len (i32.load offset=4 (local.get $base)))
      (local.set $iw (i32.add (call $measure_text (local.get $hdc)
                                 (local.get $text_wa) (local.get $text_len))
                              (i32.const 12)))
      ;; Highlight rectangle if this is the open menu.
      (if (i32.eq (local.get $i) (local.get $open_idx))
        (then
          (drop (call $gdi_native_fill_rect (local.get $hdc)
                  (local.get $cur_x) (local.get $y)
                  (i32.add (local.get $cur_x) (local.get $iw))
                  (i32.add (local.get $y) (i32.const 18))
                  (i32.const 14))) ;; COLOR_HIGHLIGHT brush (navy)
          (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0xFFFFFF))))
        (else
          (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x000000)))))
      ;; Draw label (gdi_draw_text handles & accelerator underline now).
      ;; DT_LEFT(0)|DT_VCENTER(4)|DT_SINGLELINE(0x20) = 0x24
      (drop (call $gdi_native_draw_text (local.get $hdc)
              (local.get $text_wa) (local.get $text_len)
              (call $paint_rect (i32.add (local.get $cur_x) (i32.const 6))
                                (local.get $y)
                                (i32.const 0x7FFF)
                                (i32.add (local.get $y) (i32.const 18)))
              (i32.const 0x24) (i32.const 0)))
      (local.set $cur_x (i32.add (local.get $cur_x) (local.get $iw)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (call $menu_paint_mdi_buttons (local.get $hwnd) (local.get $hdc)
      (i32.add (local.get $x) (local.get $w)) (local.get $y))
    ;; Bottom 1px shadow line (btnShadow 0x808080).
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (local.get $x) (i32.add (local.get $y) (i32.const 17))
            (i32.add (local.get $x) (local.get $w))
            (i32.add (local.get $y) (i32.const 18))
            (i32.const 0x30012))) ;; GRAY_BRUSH
    (drop (call $host_release_dc (local.get $hdc)))
    (i32.const 18))

  ;; A maximized MDI child has no caption of its own on screen, so the frame's
  ;; menu bar carries its minimize / restore / close buttons at the right end,
  ;; laid out like a caption's. $r is the bar's right edge, $y its top, both in
  ;; the coordinates of whichever surface the caller is drawing or testing.
  (func $menu_paint_mdi_buttons (param $hwnd i32) (param $hdc i32) (param $r i32) (param $y i32)
    (local $child i32) (local $style i32)
    (local.set $child (call $mdi_frame_maximized_child (local.get $hwnd)))
    (if (i32.eqz (local.get $child)) (then (return)))
    (local.set $style (call $wnd_get_style (local.get $child)))
    (local.set $y (i32.add (local.get $y) (i32.const 2)))
    (call $sysbtn_draw (local.get $hdc) (i32.sub (local.get $r) (i32.const 18)) (local.get $y)
      (i32.const 0) (i32.const 0) (i32.const 0x30014))
    (call $sysbtn_draw (local.get $hdc) (i32.sub (local.get $r) (i32.const 36)) (local.get $y)
      (i32.const 2) (i32.const 0)
      (select (i32.const 0x30014) (i32.const 0x30012)
        (i32.ne (i32.and (local.get $style) (i32.const 0x00010000)) (i32.const 0))))
    (call $sysbtn_draw (local.get $hdc) (i32.sub (local.get $r) (i32.const 52)) (local.get $y)
      (i32.const 3) (i32.const 0)
      (select (i32.const 0x30014) (i32.const 0x30012)
        (i32.ne (i32.and (local.get $style) (i32.const 0x00020000)) (i32.const 0)))))

  ;; The SC_* command for a click on one of those buttons (screen point), or 0.
  (func $menu_hittest_mdi_buttons (param $hwnd i32) (param $sx i32) (param $sy i32) (result i32)
    (local $child i32) (local $r i32) (local $y i32) (local $style i32)
    (local.set $child (call $mdi_frame_maximized_child (local.get $hwnd)))
    (if (i32.eqz (local.get $child)) (then (return (i32.const 0))))
    (local.set $y (i32.add (call $menu_bar_screen_y (local.get $hwnd)) (i32.const 2)))
    (if (i32.or (i32.lt_s (local.get $sy) (local.get $y))
                (i32.ge_s (local.get $sy) (i32.add (local.get $y) (i32.const 14))))
      (then (return (i32.const 0))))
    (call $host_get_window_rect (local.get $hwnd) (global.get $WINDOW_RECT_SCRATCH))
    (local.set $r (i32.sub (i32.load offset=8 (global.get $WINDOW_RECT_SCRATCH)) (i32.const 3)))
    (local.set $style (call $wnd_get_style (local.get $child)))
    (if (i32.and (i32.ge_s (local.get $sx) (i32.sub (local.get $r) (i32.const 18)))
                 (i32.lt_s (local.get $sx) (i32.sub (local.get $r) (i32.const 2))))
      (then (return (i32.const 0xF060))))  ;; SC_CLOSE
    (if (i32.and (i32.ge_s (local.get $sx) (i32.sub (local.get $r) (i32.const 36)))
                 (i32.lt_s (local.get $sx) (i32.sub (local.get $r) (i32.const 20))))
      (then (return (select (i32.const 0xF120) (i32.const -1)
        (i32.ne (i32.and (local.get $style) (i32.const 0x00010000)) (i32.const 0))))))  ;; SC_RESTORE
    (if (i32.and (i32.ge_s (local.get $sx) (i32.sub (local.get $r) (i32.const 52)))
                 (i32.lt_s (local.get $sx) (i32.sub (local.get $r) (i32.const 36))))
      (then (return (select (i32.const 0xF020) (i32.const -1)
        (i32.ne (i32.and (local.get $style) (i32.const 0x00020000)) (i32.const 0))))))  ;; SC_MINIMIZE
    (i32.const 0))

  ;; ============================================================
  ;; $menu_hittest_bar — given a screen-relative click point and the
  ;; bar's left/top, return the index of the hit bar item, or -1.
  ;; ============================================================
  (func $menu_hittest_bar (export "menu_hittest_bar")
        (param $hwnd i32) (param $bar_x i32) (param $bar_y i32)
        (param $click_x i32) (param $click_y i32)
        (result i32)
    (local $blob i32) (local $count i32) (local $i i32)
    (local $hdc i32) (local $cur_x i32) (local $iw i32)
    (local $base i32) (local $text_wa i32) (local $text_len i32)

    (local.set $blob (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const -1))))
    (if (i32.lt_s (local.get $click_y) (local.get $bar_y))
      (then (return (i32.const -1))))
    (if (i32.ge_s (local.get $click_y) (i32.add (local.get $bar_y) (i32.const 18)))
      (then (return (i32.const -1))))
    (local.set $count (i32.load (local.get $blob)))
    (local.set $hdc (call $gdi_menu_overlay_ensure))
    (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))

    (local.set $cur_x (i32.add (local.get $bar_x) (i32.const 4)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $base (i32.add (local.get $blob)
                         (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 16)))))
      (local.set $text_wa (i32.add (local.get $blob) (i32.load (local.get $base))))
      (local.set $text_len (i32.load offset=4 (local.get $base)))
      (local.set $iw (i32.add (call $measure_text (local.get $hdc)
                                 (local.get $text_wa) (local.get $text_len))
                              (i32.const 12)))
      (if (i32.and (i32.ge_s (local.get $click_x) (local.get $cur_x))
                   (i32.lt_s (local.get $click_x)
                             (i32.add (local.get $cur_x) (local.get $iw))))
        (then (return (local.get $i))))
      (local.set $cur_x (i32.add (local.get $cur_x) (local.get $iw)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Returns x-offset (relative to bar_x) of bar item $idx — used by JS
  ;; to anchor the dropdown beneath the open menu.
  (func $menu_bar_item_x (export "menu_bar_item_x")
        (param $hwnd i32) (param $idx i32) (result i32)
    (local $blob i32) (local $hdc i32)
    (local.set $blob (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $hdc (call $gdi_menu_overlay_ensure))
    (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
    (call $bar_item_x (local.get $blob) (local.get $hdc) (local.get $idx)))

  ;; ----- child group (dropdown) helpers -----

  ;; Address (in blob_w) of the child header for top-level item $idx,
  ;; or 0 if there are no children.
  (func $child_hdr_w (param $blob_w i32) (param $idx i32) (result i32)
    (local $base i32) (local $cof i32)
    (local.set $base (i32.add (local.get $blob_w)
                       (i32.add (i32.const 4) (i32.mul (local.get $idx) (i32.const 16)))))
    (local.set $cof (i32.load offset=8 (local.get $base)))
    (if (i32.eqz (local.get $cof)) (then (return (i32.const 0))))
    (i32.add (local.get $blob_w) (local.get $cof)))

  ;; Number of children for bar item $idx (0 if none).
  (func $menu_child_count (export "menu_child_count")
        (param $hwnd i32) (param $idx i32) (result i32)
    (local $blob i32) (local $hdr i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $hdr (call $child_hdr_w (local.get $blob) (local.get $idx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (i32.load (local.get $hdr)))

  ;; Command id of a top-level bar item. Most Win98 menu bars use popups
  ;; here, but Spider's "Deal!" is a real command item with no dropdown.
  (func $menu_bar_id (export "menu_bar_id")
        (param $hwnd i32) (param $idx i32) (result i32)
    (local $blob i32) (local $count i32) (local $base i32)
    (local.set $blob (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $count (i32.load (local.get $blob)))
    (if (i32.ge_u (local.get $idx) (local.get $count)) (then (return (i32.const 0))))
    (local.set $base (i32.add (local.get $blob)
                       (i32.add (i32.const 4) (i32.mul (local.get $idx) (i32.const 16)))))
    (i32.load offset=12 (local.get $base)))

  ;; Address (in blob_w) of child item $cidx within top item $tidx, or 0.
  (func $child_item_w (param $blob_w i32) (param $tidx i32) (param $cidx i32)
                        (result i32)
    (local $hdr i32)
    (local.set $hdr (call $child_hdr_w (local.get $blob_w) (local.get $tidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (i32.add (local.get $hdr)
             (i32.add (i32.const 4) (i32.mul (local.get $cidx) (i32.const 28)))))

  ;; Command id of child (top, child).
  (func $menu_child_id (export "menu_child_id")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $child_item_w (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (i32.load offset=20 (local.get $it)))

  ;; Flags of child (bit0 separator, bit1 grayed, bit2 checked).
  (func $menu_child_flags (export "menu_child_flags")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $child_item_w (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (i32.load offset=16 (local.get $it)))

  (func $menu_child_label_ptr (export "menu_child_label_ptr")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $child_item_w (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (i32.add (local.get $blob) (i32.load (local.get $it))))

  (func $menu_child_label_len (export "menu_child_label_len")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $child_item_w (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (i32.load offset=4 (local.get $it)))

  (func (export "menu_child_shortcut_ptr")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $it i32) (local $off i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $child_item_w (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (local.set $off (i32.load offset=8 (local.get $it)))
    (if (i32.eqz (local.get $off)) (then (return (i32.const 0))))
    (i32.add (local.get $blob) (local.get $off)))

  (func (export "menu_child_shortcut_len")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $child_item_w (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (i32.load offset=12 (local.get $it)))

  ;; Nested popup helpers for one cascading submenu level under a dropdown item.
  (func $child_sub_hdr_w (param $blob_w i32) (param $tidx i32) (param $cidx i32)
                         (result i32)
    (local $it i32) (local $off i32) (local $bound i32)
    (local.set $bound (call $resource_submenu_blob_w
      (local.get $blob_w) (local.get $tidx) (local.get $cidx)))
    (if (i32.ne (local.get $bound) (i32.const -1))
      (then
        (if (i32.eqz (local.get $bound)) (then (return (i32.const 0))))
        (return (call $child_hdr_w (local.get $bound) (i32.const 0)))))
    (local.set $it (call $child_item_w (local.get $blob_w) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (local.set $off (i32.load offset=24 (local.get $it)))
    (if (i32.eqz (local.get $off)) (then (return (i32.const 0))))
    (i32.add (local.get $blob_w) (local.get $off)))

  ;; Widths are exports because the compositor crop, popup screen clamping,
  ;; painting and WAT hit-testing must all agree on the same rectangles.
  (func $menu_dropdown_width (export "menu_dropdown_width")
        (param $hwnd i32) (param $tidx i32) (result i32)
    (local $blob i32) (local $hdr i32) (local $hdc i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $hdr (call $child_hdr_w (local.get $blob) (local.get $tidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (local.set $hdc (call $gdi_menu_overlay_ensure))
    (call $menu_header_width (local.get $blob) (local.get $hdr) (local.get $hdc)))

  (func $menu_submenu_width (export "menu_submenu_width")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $parent_blob i32) (local $hdr i32)
    (local $hdc i32) (local $bound i32) (local $width i32) (local $owner_width i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $parent_blob (local.get $blob))
    (local.set $hdr (call $child_sub_hdr_w
                      (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (local.set $bound (call $resource_submenu_blob_w
      (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.ne (local.get $bound) (i32.const -1))
      (then (local.set $blob (local.get $bound))))
    (local.set $hdc (call $gdi_menu_overlay_ensure))
    (local.set $width
      (call $menu_header_width (local.get $blob) (local.get $hdr) (local.get $hdc)))
    (local.set $owner_width (call $resource_submenu_ownerdraw_width
      (local.get $parent_blob) (local.get $tidx) (local.get $cidx)
      (i32.load (local.get $hdr))))
    (select (local.get $owner_width) (local.get $width)
      (i32.gt_u (local.get $owner_width) (local.get $width))))

  (func $menu_submenu_height (export "menu_submenu_height")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $hdr i32) (local $count i32)
    (local $i i32) (local $height i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $hdr (call $child_sub_hdr_w
      (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (local.set $count (i32.load (local.get $hdr)))
    (local.set $height (i32.const 4))
    (block $done (loop $rows
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $height (i32.add (local.get $height)
        (call $resource_submenu_item_height
          (local.get $blob) (local.get $tidx) (local.get $cidx) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $rows)))
    (local.get $height))

  (func $submenu_item_w (param $blob_w i32) (param $tidx i32)
                        (param $cidx i32) (param $sidx i32) (result i32)
    (local $hdr i32)
    (local.set $hdr (call $child_sub_hdr_w
                      (local.get $blob_w) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (i32.add (local.get $hdr)
             (i32.add (i32.const 4) (i32.mul (local.get $sidx) (i32.const 28)))))

  (func $menu_child_sub_count (export "menu_child_sub_count")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $hdr i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $hdr (call $child_sub_hdr_w
                      (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (i32.load (local.get $hdr)))

  (func $menu_subchild_id (export "menu_subchild_id")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (param $sidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $submenu_item_w
                     (local.get $blob) (local.get $tidx) (local.get $cidx) (local.get $sidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (i32.load offset=20 (local.get $it)))

  (func $menu_subchild_flags (export "menu_subchild_flags")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (param $sidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $submenu_item_w
                     (local.get $blob) (local.get $tidx) (local.get $cidx) (local.get $sidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (i32.load offset=16 (local.get $it)))

  (func (export "menu_subchild_label_ptr")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (param $sidx i32) (result i32)
    (local $blob i32) (local $it i32) (local $bound i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $submenu_item_w
                     (local.get $blob) (local.get $tidx) (local.get $cidx) (local.get $sidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (local.set $bound (call $resource_submenu_blob_w
      (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.ne (local.get $bound) (i32.const -1))
      (then (local.set $blob (local.get $bound))))
    (i32.add (local.get $blob) (i32.load (local.get $it))))

  (func (export "menu_subchild_label_len")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (param $sidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $submenu_item_w
                     (local.get $blob) (local.get $tidx) (local.get $cidx) (local.get $sidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (i32.load offset=4 (local.get $it)))

  ;; Set/clear the "checked" flag bit (bit2, value 0x04) on the first match in
  ;; one child header, recursing into cascading submenus. Returns the first
  ;; matched item's previous state (MF_CHECKED=8 or MF_UNCHECKED=0), or -1
  ;; if nothing matched.
  (func $menu_group_set_check
        (param $blob_w i32) (param $blob_size i32) (param $hdr i32)
        (param $id i32) (param $check i32)
        (result i32)
    (local $cc i32) (local $i i32) (local $it i32) (local $flags i32)
    (local $hdr_off i32) (local $child_off i32) (local $r i32) (local $prev i32)
    (local.set $prev (i32.const -1))
    (if (i32.lt_u (local.get $hdr) (local.get $blob_w))
      (then (return (local.get $prev))))
    (local.set $hdr_off (i32.sub (local.get $hdr) (local.get $blob_w)))
    (if (i32.or
          (i32.lt_u (local.get $blob_size) (i32.const 4))
          (i32.gt_u (local.get $hdr_off) (i32.sub (local.get $blob_size) (i32.const 4))))
      (then (return (local.get $prev))))
    (local.set $cc (i32.load (local.get $hdr)))
    (if (i32.gt_u (local.get $cc)
          (i32.div_u
            (i32.sub (i32.sub (local.get $blob_size) (local.get $hdr_off)) (i32.const 4))
            (i32.const 28)))
      (then (return (local.get $prev))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $cc)))
      (local.set $it (i32.add (local.get $hdr)
                       (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (if (i32.and (i32.eqz (i32.load offset=24 (local.get $it)))
            (i32.eq (i32.load offset=20 (local.get $it)) (local.get $id)))
        (then
          (local.set $flags (i32.load offset=16 (local.get $it)))
          (if (i32.eq (local.get $prev) (i32.const -1))
            (then
              (local.set $prev
                (select (i32.const 8) (i32.const 0)
                  (i32.ne (i32.and (local.get $flags) (i32.const 0x04)) (i32.const 0))))))
          (if (local.get $check)
            (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x04))))
            (else (local.set $flags (i32.and (local.get $flags) (i32.const -5)))))
          (i32.store offset=16 (local.get $it) (local.get $flags))
          (return (local.get $prev))))
      (local.set $child_off (i32.load offset=24 (local.get $it)))
      (if (i32.and
            (i32.ne (local.get $child_off) (i32.const 0))
            (i32.and
              (i32.lt_u (local.get $child_off) (local.get $blob_size))
              (i32.ge_u (i32.sub (local.get $blob_size) (local.get $child_off)) (i32.const 4))))
        (then
          (local.set $r
            (call $menu_group_set_check
              (local.get $blob_w)
              (local.get $blob_size)
              (i32.add (local.get $blob_w) (local.get $child_off))
              (local.get $id)
              (local.get $check)))
          (if (i32.and
                (i32.eq (local.get $prev) (i32.const -1))
                (i32.ne (local.get $r) (i32.const -1)))
            (then (return (local.get $r))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $prev))

  ;; Set/clear the "checked" flag bit (bit2, value 0x04) on the first child
  ;; item in this blob whose command id matches $id. Returns the item's
  ;; previous checked state (MF_CHECKED=8 or MF_UNCHECKED=0) for the
  ;; first match, or -1 if nothing matched.
  (func $menu_blob_set_check
        (param $blob_w i32) (param $blob_size i32)
        (param $id i32) (param $check i32) (result i32)
    (local $bar_count i32) (local $i i32) (local $bar_item i32)
    (local $hdr_off i32) (local $r i32) (local $prev i32)
    (local.set $prev (i32.const -1))
    (if (i32.lt_u (local.get $blob_size) (i32.const 4))
      (then (return (local.get $prev))))
    (local.set $bar_count (i32.load (local.get $blob_w)))
    (if (i32.gt_u (local.get $bar_count)
          (i32.div_u (i32.sub (local.get $blob_size) (i32.const 4)) (i32.const 16)))
      (then (return (local.get $prev))))
    (local.set $i (i32.const 0))
    (block $done (loop $bar
      (br_if $done (i32.ge_u (local.get $i) (local.get $bar_count)))
      (local.set $bar_item (i32.add (local.get $blob_w)
                             (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 16)))))
      (local.set $hdr_off (i32.load offset=8 (local.get $bar_item)))
      (if (local.get $hdr_off)
        (then
          (local.set $r
            (call $menu_group_set_check
              (local.get $blob_w)
              (local.get $blob_size)
              (i32.add (local.get $blob_w) (local.get $hdr_off))
              (local.get $id)
              (local.get $check)))
          (if (i32.and
                (i32.eq (local.get $prev) (i32.const -1))
                (i32.ne (local.get $r) (i32.const -1)))
            (then (return (local.get $r))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $bar)))
    (local.get $prev))

  ;; Set/clear checked state by submenu position. GetSubMenu handles are
  ;; represented as menu-id | ((top-index+1)<<16), which makes the resource
  ;; submenu deterministic without a separate HMENU object table.
  ;; EnableMenuItem with MF_BYPOSITION. MFC addresses every item this way while
  ;; walking a popup -- it asks GetMenuItemID what is at position N and then
  ;; enables or greys position N -- so routing the whole API through the
  ;; by-command path meant those calls landed on whichever item happened to
  ;; have that number as its ID, or on nothing at all. Paint greys File > Send
  ;; as position 9 of the File popup; before this, nothing moved.
  (func $menu_enable_position_global (export "menu_enable_position_global")
        (param $hmenu i32) (param $pos i32) (param $disabled i32) (result i32)
    (local $i i32) (local $hwnd i32) (local $blob i32) (local $it i32)
    (local $tidx i32) (local $flags i32) (local $prev i32)
    (local.set $prev (i32.const -1))
    (local.set $tidx (i32.sub (i32.shr_u (local.get $hmenu) (i32.const 16)) (i32.const 1)))
    (if (i32.lt_s (local.get $tidx) (i32.const 0)) (then (return (local.get $prev))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (load.field WndRecord hwnd (call $wnd_record_addr (local.get $i))))
      (if (local.get $hwnd)
        (then
          (local.set $blob (call $menu_blob_w (local.get $hwnd)))
          ;; Every window's bar is visited, so the dropdown and the position
          ;; must both exist in THIS bar before a child record is addressed:
          ;; $child_item_w trusts its indices, and a bar with fewer dropdowns
          ;; than $tidx would hand it an offset read from past the bar table.
          (if (i32.and (i32.ne (local.get $blob) (i32.const 0))
                (i32.lt_u (local.get $tidx) (i32.load (local.get $blob))))
            (then
              (local.set $it (call $child_hdr_w (local.get $blob) (local.get $tidx)))
              (if (i32.and (i32.ne (local.get $it) (i32.const 0))
                    (i32.lt_u (local.get $pos) (i32.load (local.get $it))))
                (then (local.set $it (call $child_item_w
                  (local.get $blob) (local.get $tidx) (local.get $pos))))
                (else (local.set $it (i32.const 0))))
              (if (local.get $it)
                (then
                  (local.set $flags (i32.load offset=16 (local.get $it)))
                  (if (i32.eq (local.get $prev) (i32.const -1))
                    (then (local.set $prev
                      (select (i32.const 1) (i32.const 0)
                        (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))))))
                  (i32.store offset=16 (local.get $it)
                    (select (i32.or (local.get $flags) (i32.const 2))
                            (i32.and (local.get $flags) (i32.const -3))
                            (local.get $disabled)))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $prev))

  (func $menu_check_position_global (export "menu_check_position_global")
        (param $hmenu i32) (param $pos i32) (param $check i32) (result i32)
    (local $hwnd i32) (local $blob i32) (local $it i32) (local $top i32) (local $flags i32)
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const -1))))
    (local.set $top (call $menu_handle_top_index (local.get $hwnd) (local.get $hmenu)))
    ;; Menu-bar items cannot carry check marks.
    (if (i32.lt_s (local.get $top) (i32.const 0)) (then (return (i32.const -1))))
    (if (i32.ge_u (local.get $top) (call $menu_bar_count (local.get $hwnd)))
      (then (return (i32.const -1))))
    (if (i32.ge_u (local.get $pos) (call $menu_child_count (local.get $hwnd) (local.get $top)))
      (then (return (i32.const -1))))
    (local.set $blob (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const -1))))
    (local.set $it (call $child_item_w (local.get $blob) (local.get $top) (local.get $pos)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const -1))))
    ;; Position identifies exactly this record, even with duplicate command IDs.
    (local.set $flags (i32.load offset=16 (local.get $it)))
    (i32.store offset=16 (local.get $it)
      (select (i32.or (local.get $flags) (i32.const 4))
        (i32.and (local.get $flags) (i32.const -5)) (local.get $check)))
    (call $invalidate_hwnd (local.get $hwnd))
    (select (i32.const 8) (i32.const 0)
      (i32.ne (i32.and (local.get $flags) (i32.const 4)) (i32.const 0))))

  ;; Resource menu enable/disable state. Internal flag bit1 is rendered as
  ;; MF_GRAYED; return values use the public MF_GRAYED/MF_ENABLED constants.
  (func $menu_group_set_disabled
        (param $blob i32) (param $hdr i32) (param $id i32) (param $disabled i32)
        (result i32)
    (local $count i32) (local $i i32) (local $it i32) (local $flags i32)
    (local $ret i32) (local $child_off i32) (local $r i32)
    (local.set $ret (i32.const -1))
    (local.set $count (i32.load (local.get $hdr)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $it (i32.add (local.get $hdr)
        (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (if (i32.eq (i32.load offset=20 (local.get $it)) (local.get $id))
        (then
          (local.set $flags (i32.load offset=16 (local.get $it)))
          (if (i32.eq (local.get $ret) (i32.const -1))
            (then (local.set $ret
              (select (i32.const 1) (i32.const 0)
                (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))))))
          (i32.store offset=16 (local.get $it)
            (select (i32.or (local.get $flags) (i32.const 2))
                    (i32.and (local.get $flags) (i32.const -3))
                    (local.get $disabled)))))
      ;; By command id reaches cascaded popups too (Daytona USA Deluxe greys
      ;; its Settings > Screen mode items one level below the dropdown).
      (local.set $child_off (i32.load offset=24 (local.get $it)))
      (if (local.get $child_off)
        (then
          (local.set $r (call $menu_group_set_disabled
            (local.get $blob) (i32.add (local.get $blob) (local.get $child_off))
            (local.get $id) (local.get $disabled)))
          (if (i32.eq (local.get $ret) (i32.const -1))
            (then (local.set $ret (local.get $r))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (return (local.get $ret))
    (unreachable))

  (func $menu_enable_item_global (export "menu_enable_item_global")
        (param $hmenu i32) (param $item i32) (param $flags i32) (result i32)
    (local $i i32) (local $hwnd i32) (local $blob i32) (local $bar_count i32)
    (local $bar i32) (local $hdr_off i32) (local $ret i32) (local $r i32)
    (local $disabled i32)
    (local.set $ret (i32.const -1))
    (local.set $disabled (i32.and (local.get $flags) (i32.const 3)))
    (block $done
      (loop $wins
        (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
        (local.set $hwnd (load.field WndRecord hwnd (call $wnd_record_addr (local.get $i))))
        (if (local.get $hwnd)
          (then
            (local.set $blob (call $menu_blob_w (local.get $hwnd)))
            (if (local.get $blob)
              (then
                (local.set $bar_count (i32.load (local.get $blob)))
                (local.set $bar (i32.const 0))
                (block $bars_done
                  (loop $bars
                    (br_if $bars_done
                      (i32.ge_u (local.get $bar) (local.get $bar_count)))
                    (local.set $hdr_off
                      (i32.load offset=8
                        (i32.add (local.get $blob)
                          (i32.add (i32.const 4)
                            (i32.mul (local.get $bar) (i32.const 16))))))
                    (if (local.get $hdr_off)
                      (then
                        (local.set $r
                          (call $menu_group_set_disabled
                            (local.get $blob)
                            (i32.add (local.get $blob) (local.get $hdr_off))
                            (local.get $item) (local.get $disabled)))
                        (if (i32.and
                              (i32.eq (local.get $ret) (i32.const -1))
                              (i32.ne (local.get $r) (i32.const -1)))
                          (then (local.set $ret (local.get $r))))))
                    (local.set $bar
                      (i32.add (local.get $bar) (i32.const 1)))
                    (br $bars)))
                (if (i32.ne (local.get $ret) (i32.const -1))
                  (then (call $invalidate_hwnd (local.get $hwnd))))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $wins)))
    (local.get $ret))

  ;; CheckMenuRadioItem by submenu position. Fake submenu handles encode
  ;; GetSubMenu(hMenu,nPos) as low-word | ((nPos+1)<<16), so $tidx is
  ;; high-word-1. Sets bit2 on the selected child item and clears it on
  ;; the rest of [first..last].
  (func $menu_blob_check_radio_pos
        (param $blob_w i32) (param $tidx i32)
        (param $first i32) (param $last i32) (param $check i32) (result i32)
    (local $bar_count i32) (local $bar_item i32) (local $hdr_off i32)
    (local $hdr i32) (local $cc i32) (local $i i32) (local $it i32)
    (local $flags i32) (local $lo i32) (local $hi i32)
    (local.set $bar_count (i32.load (local.get $blob_w)))
    (if (i32.ge_u (local.get $tidx) (local.get $bar_count)) (then (return (i32.const 0))))
    (local.set $bar_item (i32.add (local.get $blob_w)
                           (i32.add (i32.const 4) (i32.mul (local.get $tidx) (i32.const 16)))))
    (local.set $hdr_off (i32.load offset=8 (local.get $bar_item)))
    (if (i32.eqz (local.get $hdr_off)) (then (return (i32.const 0))))
    (local.set $hdr (i32.add (local.get $blob_w) (local.get $hdr_off)))
    (local.set $cc (i32.load (local.get $hdr)))
    (local.set $lo
      (select (local.get $first) (local.get $last)
        (i32.le_u (local.get $first) (local.get $last))))
    (local.set $hi
      (select (local.get $last) (local.get $first)
        (i32.le_u (local.get $first) (local.get $last))))
    (local.set $i (local.get $lo))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (local.get $i) (local.get $hi)))
      (br_if $done (i32.ge_u (local.get $i) (local.get $cc)))
      (local.set $it (i32.add (local.get $hdr)
                       (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (local.set $flags (i32.load offset=16 (local.get $it)))
      (if (i32.eq (local.get $i) (local.get $check))
        (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x04))))
        (else (local.set $flags (i32.and (local.get $flags) (i32.const -5)))))
      (i32.store offset=16 (local.get $it) (local.get $flags))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 1))

  (func $menu_group_check_radio_cmd
        (param $blob_w i32) (param $hdr i32)
        (param $lo i32) (param $hi i32) (param $check i32) (result i32)
    (local $cc i32) (local $i i32) (local $it i32) (local $flags i32)
    (local $id i32) (local $child_off i32) (local $changed i32)
    (local.set $cc (i32.load (local.get $hdr)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $cc)))
      (local.set $it (i32.add (local.get $hdr)
                       (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (local.set $id (i32.load offset=20 (local.get $it)))
      (if (i32.and (i32.ge_u (local.get $id) (local.get $lo))
                   (i32.le_u (local.get $id) (local.get $hi)))
        (then
          (local.set $flags (i32.load offset=16 (local.get $it)))
          (if (i32.eq (local.get $id) (local.get $check))
            (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x04))))
            (else (local.set $flags (i32.and (local.get $flags) (i32.const -5)))))
          (i32.store offset=16 (local.get $it) (local.get $flags))
          (local.set $changed (i32.const 1))))
      (local.set $child_off (i32.load offset=24 (local.get $it)))
      (if (local.get $child_off)
        (then
          (if (call $menu_group_check_radio_cmd
                (local.get $blob_w)
                (i32.add (local.get $blob_w) (local.get $child_off))
                (local.get $lo) (local.get $hi) (local.get $check))
            (then (local.set $changed (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $changed))

  ;; CheckMenuRadioItem by command id. Clears every command id in the
  ;; requested range and checks idCheck, including nested cascading submenus.
  (func $menu_blob_check_radio_cmd
        (param $blob_w i32) (param $first i32) (param $last i32) (param $check i32) (result i32)
    (local $bar_count i32) (local $i i32) (local $bar_item i32)
    (local $hdr_off i32) (local $lo i32) (local $hi i32)
    (local $changed i32)
    (local.set $lo
      (select (local.get $first) (local.get $last)
        (i32.le_u (local.get $first) (local.get $last))))
    (local.set $hi
      (select (local.get $last) (local.get $first)
        (i32.le_u (local.get $first) (local.get $last))))
    (local.set $bar_count (i32.load (local.get $blob_w)))
    (local.set $i (i32.const 0))
    (block $done (loop $bar
      (br_if $done (i32.ge_u (local.get $i) (local.get $bar_count)))
      (local.set $bar_item (i32.add (local.get $blob_w)
                             (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 16)))))
      (local.set $hdr_off (i32.load offset=8 (local.get $bar_item)))
      (if (local.get $hdr_off)
        (then
          (if (call $menu_group_check_radio_cmd
                (local.get $blob_w)
                (i32.add (local.get $blob_w) (local.get $hdr_off))
                (local.get $lo) (local.get $hi) (local.get $check))
            (then (local.set $changed (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $bar)))
    (local.get $changed))

  (func $menu_check_radio_global (export "menu_check_radio_global")
        (param $hmenu i32) (param $first i32) (param $last i32)
        (param $check i32) (param $flags i32) (result i32)
    (local $i i32) (local $hwnd i32) (local $blob_w i32)
    (local $tidx i32) (local $changed i32)
    (local.set $tidx (i32.sub (i32.shr_u (local.get $hmenu) (i32.const 16)) (i32.const 1)))
    (local.set $i (i32.const 0))
    (block $done (loop $loop
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (load.field WndRecord hwnd (call $wnd_record_addr (local.get $i))))
      (if (local.get $hwnd)
        (then
          (local.set $blob_w (call $menu_blob_w (local.get $hwnd)))
          (if (local.get $blob_w)
            (then
              (if (i32.and (local.get $flags) (i32.const 0x400)) ;; MF_BYPOSITION
                (then
                  (if (call $menu_blob_check_radio_pos
                        (local.get $blob_w) (local.get $tidx)
                        (local.get $first) (local.get $last) (local.get $check))
                    (then (local.set $changed (i32.const 1)))))
                (else
                  (if (call $menu_blob_check_radio_cmd
                        (local.get $blob_w)
                        (local.get $first) (local.get $last) (local.get $check))
                    (then (local.set $changed (i32.const 1))))))
              (if (local.get $changed)
                (then (call $invalidate_hwnd (local.get $hwnd))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $loop)))
    (select (i32.const 1) (i32.const 0) (local.get $changed)))

  ;; Resolve the requested resource menu and change its first matching id.
  ;; A dropdown handle searches only that subtree, never sibling dropdowns
  ;; or another window. Invalidates the owning window. Returns the
  ;; original state (MF_UNCHECKED=0, MF_CHECKED=8) or -1 if no match.
  (func $menu_check_item_global (export "menu_check_item_global")
        (param $hmenu i32) (param $id i32) (param $check i32) (result i32)
    (local $hwnd i32) (local $blob i32) (local $size i32)
    (local $top i32) (local $off i32) (local $r i32)
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const -1))))
    (local.set $blob (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const -1))))
    (local.set $size (call $menu_blob_size (local.get $hwnd)))
    (local.set $top (call $menu_handle_top_index (local.get $hwnd) (local.get $hmenu)))
    (if (i32.lt_s (local.get $top) (i32.const 0))
      (then (local.set $r (call $menu_blob_set_check
        (local.get $blob) (local.get $size) (local.get $id) (local.get $check))))
      (else
        (if (i32.ge_u (local.get $top) (i32.load (local.get $blob)))
          (then (return (i32.const -1))))
        (local.set $off (i32.load offset=12
          (i32.add (local.get $blob) (i32.mul (local.get $top) (i32.const 16)))))
        (if (i32.eqz (local.get $off)) (then (return (i32.const -1))))
        (local.set $r (call $menu_group_set_check
          (local.get $blob) (local.get $size) (i32.add (local.get $blob) (local.get $off))
          (local.get $id) (local.get $check)))))
    (if (i32.ne (local.get $r) (i32.const -1))
      (then (call $invalidate_hwnd (local.get $hwnd))))
    (local.get $r))

  ;; Accel-char (uppercase ASCII) for top-level item $idx, or 0 if none.
  ;; The accel char is the byte after the first un-doubled '&'.
  (func $menu_bar_accel (export "menu_bar_accel")
        (param $hwnd i32) (param $idx i32) (result i32)
    (local $blob i32) (local $base i32)
    (local $text_wa i32) (local $text_len i32) (local $i i32) (local $ch i32)
    (local.set $blob (call $menu_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $base (i32.add (local.get $blob)
                       (i32.add (i32.const 4) (i32.mul (local.get $idx) (i32.const 16)))))
    (local.set $text_wa (i32.add (local.get $blob) (i32.load (local.get $base))))
    (local.set $text_len (i32.load offset=4 (local.get $base)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1))
                             (local.get $text_len)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $text_wa) (local.get $i))) (i32.const 0x26))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $text_wa)
                            (i32.add (local.get $i) (i32.const 1)))))
          (if (i32.ne (local.get $ch) (i32.const 0x26))
            (then
              ;; Uppercase ASCII a-z → A-Z
              (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                           (i32.le_u (local.get $ch) (i32.const 0x7A)))
                (then (local.set $ch (i32.sub (local.get $ch) (i32.const 0x20)))))
              (return (local.get $ch)))
            ;; "&&" is a literal ampersand, so step over BOTH of them. Stepping
            ;; one at a time re-reads the second '&' as a fresh marker and
            ;; hands back whatever follows it — "Save && Exit" mnemonic'd on
            ;; the space, and it shadowed any real '&' later in the label.
            (else (local.set $i (i32.add (local.get $i) (i32.const 1)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Accel-char for child item (top, child) — same logic as bar_accel.
  (func $menu_child_accel (export "menu_child_accel")
        (param $hwnd i32) (param $tidx i32) (param $cidx i32) (result i32)
    (local $blob i32) (local $it i32)
    (local $text_wa i32) (local $text_len i32) (local $i i32) (local $ch i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $it (call $child_item_w (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $it)) (then (return (i32.const 0))))
    (local.set $text_wa (i32.add (local.get $blob) (i32.load (local.get $it))))
    (local.set $text_len (i32.load offset=4 (local.get $it)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1))
                             (local.get $text_len)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $text_wa) (local.get $i))) (i32.const 0x26))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $text_wa)
                            (i32.add (local.get $i) (i32.const 1)))))
          (if (i32.ne (local.get $ch) (i32.const 0x26))
            (then
              (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                           (i32.le_u (local.get $ch) (i32.const 0x7A)))
                (then (local.set $ch (i32.sub (local.get $ch) (i32.const 0x20)))))
              (return (local.get $ch)))
            ;; See $menu_bar_accel: skip both halves of a doubled ampersand.
            (else (local.set $i (i32.add (local.get $i) (i32.const 1)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $menu_draw_submenu_arrow (param $hdc i32) (param $dx i32)
                                 (param $dw i32) (param $iy i32) (param $hover i32)
    (local $glyph i32)
    ;; The '>' this draws needs a byte somewhere; it used to live just past the
    ;; single shared rect. Take a slot of its own instead of writing off the end
    ;; of one.
    (local.set $glyph (call $paint_scratch_take))
    ;; NOT a (layout PaintRect) site, deliberately. This slot is a one-byte
    ;; STRING buffer, not a RECT: the ring hands out 16 bytes and what they mean
    ;; is the caller's business. `store.field PaintRect left` would name a rect
    ;; edge for a '>' character. The i32.store8 is what says so, and it is why
    ;; the codemod declines this site rather than converting it.
    (i32.store8 (local.get $glyph) (i32.const 0x3E))
    (drop (call $gdi_native_set_text_color (local.get $hdc)
            (if (result i32) (local.get $hover)
              (then (i32.const 0xFFFFFF))
              (else (i32.const 0x000000)))))
    ;; DT_CENTER|DT_VCENTER|DT_SINGLELINE = 0x25
    (drop (call $gdi_native_draw_text (local.get $hdc)
            (local.get $glyph) (i32.const 1)
            (call $paint_rect (i32.add (local.get $dx)
                                (i32.sub (local.get $dw) (i32.const 16)))
                              (local.get $iy)
                              (i32.add (local.get $dx)
                                (i32.sub (local.get $dw) (i32.const 4)))
                              (i32.add (local.get $iy) (i32.const 20)))
            (i32.const 0x25) (i32.const 0))))

  (func $menu_draw_check_glyph (param $hdc i32) (param $dx i32)
                               (param $iy i32) (param $hover i32)
    (drop (call $gdi_native_select_object (local.get $hdc)
            (if (result i32) (local.get $hover)
              (then (i32.const 0x30016))   ;; WHITE_PEN on hover
              (else (i32.const 0x30017))))) ;; BLACK_PEN otherwise
    (drop (call $gdi_native_move_to (local.get $hdc)
            (i32.add (local.get $dx) (i32.const 5))
            (i32.add (local.get $iy) (i32.const 10))))
    (drop (call $gdi_native_line_to (local.get $hdc)
            (i32.add (local.get $dx) (i32.const 8))
            (i32.add (local.get $iy) (i32.const 14))))
    (drop (call $gdi_native_line_to (local.get $hdc)
            (i32.add (local.get $dx) (i32.const 14))
            (i32.add (local.get $iy) (i32.const 6))))
    (drop (call $gdi_native_move_to (local.get $hdc)
            (i32.add (local.get $dx) (i32.const 5))
            (i32.add (local.get $iy) (i32.const 11))))
    (drop (call $gdi_native_line_to (local.get $hdc)
            (i32.add (local.get $dx) (i32.const 8))
            (i32.add (local.get $iy) (i32.const 15))))
    (drop (call $gdi_native_line_to (local.get $hdc)
            (i32.add (local.get $dx) (i32.const 14))
            (i32.add (local.get $iy) (i32.const 7))))
    (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021))))

  ;; WordPad's formatting toolbar supplies seventeen MF_OWNERDRAW entries with
  ;; command ids 0x800e..0x801e and no strings. Its menu is destroyed as soon as
  ;; asynchronous TrackPopupMenu returns, so reproduce the simple palette strip
  ;; from the same COLORREF mapping used when a row is selected.
  (func $menu_draw_wordpad_color_swatch
        (param $hdc i32) (param $dx i32) (param $dw i32)
        (param $iy i32) (param $id i32)
    (local $brush i32)
    ;; A black frame keeps white and silver visible against COLOR_MENU.
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (i32.add (local.get $dx) (i32.const 19))
            (i32.add (local.get $iy) (i32.const 2))
            (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 19)))
            (i32.add (local.get $iy) (i32.const 18))
            (i32.const 0x30014))) ;; BLACK_BRUSH
    (local.set $brush
      (call $gdi_native_create_solid_brush
        (call $wordpad_colorref_for_index
          (i32.sub (local.get $id) (i32.const 0x800e)))))
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (i32.add (local.get $dx) (i32.const 20))
            (i32.add (local.get $iy) (i32.const 3))
            (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 20)))
            (i32.add (local.get $iy) (i32.const 17))
            (local.get $brush)))
    (drop (call $gdi_native_delete_object (local.get $brush))))

  ;; ============================================================
  ;; $menu_paint_dropdown — draw the dropdown for top-level item
  ;; $tidx at (dx, dy). Width fits its measured text, height=count*20+4.
  ;; Items use itemH=20, label inset=20, hover highlight when
  ;; $hover_cidx == this child index.
  ;; ============================================================
  (func $menu_paint_submenu
        (param $hwnd i32) (param $tidx i32) (param $cidx i32)
        (param $dx i32) (param $dy i32) (param $hover_sidx i32)
    (local $blob i32) (local $parent_blob i32) (local $hdr i32)
    (local $count i32) (local $i i32)
    (local $hdc i32) (local $iy i32) (local $ih i32) (local $it i32) (local $flags i32)
    (local $label_wa i32) (local $label_len i32)
    (local $sc_wa i32) (local $sc_len i32) (local $dh i32) (local $dw i32)
    (local $bound i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return)))
    (local.set $parent_blob (local.get $blob))
    (local.set $hdr (call $child_sub_hdr_w
                      (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $hdr)) (then (return)))
    (local.set $bound (call $resource_submenu_blob_w
      (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.ne (local.get $bound) (i32.const -1))
      (then (local.set $blob (local.get $bound))))
    (local.set $count (i32.load (local.get $hdr)))
    (if (i32.eqz (local.get $count)) (then (return)))

    (local.set $hdc (call $gdi_menu_overlay_ensure))
    (if (i32.eqz (local.get $hdc)) (then (return)))
    (local.set $dw
      (call $menu_submenu_width (local.get $hwnd) (local.get $tidx) (local.get $cidx)))
    (local.set $dh
      (call $menu_submenu_height (local.get $hwnd) (local.get $tidx) (local.get $cidx)))
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (local.get $dx) (local.get $dy)
            (i32.add (local.get $dx) (local.get $dw))
            (i32.add (local.get $dy) (local.get $dh))
            (i32.const 0x30011)))
    (drop (call $gdi_native_draw_edge (local.get $hdc)
            (local.get $dx) (local.get $dy)
            (i32.add (local.get $dx) (local.get $dw))
            (i32.add (local.get $dy) (local.get $dh))
            (i32.const 0x05) (i32.const 0x0F)))

    (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
    (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))

    (local.set $iy (i32.add (local.get $dy) (i32.const 2)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $it (i32.add (local.get $hdr)
                       (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (local.set $flags (i32.load offset=16 (local.get $it)))
      (local.set $ih (call $resource_submenu_item_height
        (local.get $parent_blob) (local.get $tidx) (local.get $cidx) (local.get $i)))
      (if (i32.and (local.get $flags) (i32.const 0x01))
        (then
          (drop (call $gdi_native_fill_rect (local.get $hdc)
                  (i32.add (local.get $dx) (i32.const 4))
                  (i32.add (local.get $iy) (i32.const 9))
                  (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 4)))
                  (i32.add (local.get $iy) (i32.const 10))
                  (i32.const 0x30012))))
        (else
          (if (i32.eq (local.get $i) (local.get $hover_sidx))
            (then
              (drop (call $gdi_native_fill_rect (local.get $hdc)
                      (i32.add (local.get $dx) (i32.const 2)) (local.get $iy)
                      (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 2)))
                      (i32.add (local.get $iy) (local.get $ih))
                      (i32.const 14)))
              (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0xFFFFFF))))
            (else
              (if (i32.and (local.get $flags) (i32.const 0x02))
                (then (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x808080))))
                (else (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x000000)))))))
          (local.set $label_wa (i32.add (local.get $blob) (i32.load (local.get $it))))
          (local.set $label_len (i32.load offset=4 (local.get $it)))
          (if (i32.and (local.get $flags) (i32.const 0x04))
            (then
              (call $menu_draw_check_glyph
                (local.get $hdc) (local.get $dx) (local.get $iy)
                (i32.eq (local.get $i) (local.get $hover_sidx)))))
          (drop (call $gdi_native_draw_text (local.get $hdc)
                  (local.get $label_wa) (local.get $label_len)
                  (call $paint_rect (i32.add (local.get $dx) (i32.const 20))
                                    (local.get $iy)
                                    (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 20)))
                                    (i32.add (local.get $iy) (local.get $ih)))
                  (i32.const 0x24) (i32.const 0)))
          (local.set $sc_len (i32.load offset=12 (local.get $it)))
          (if (local.get $sc_len)
            (then
              (local.set $sc_wa (i32.add (local.get $blob)
                                  (i32.load offset=8 (local.get $it))))
              (drop (call $gdi_native_draw_text (local.get $hdc)
                      (local.get $sc_wa) (local.get $sc_len)
                      (call $paint_rect (i32.add (local.get $dx) (i32.const 20))
                                        (local.get $iy)
                                        (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 20)))
                                        (i32.add (local.get $iy) (local.get $ih)))
                      (i32.const 0x26) (i32.const 0)))))
          (if (i32.ne (i32.and (local.get $flags) (i32.const 0x08)) (i32.const 0))
            (then
              (drop (call $resource_submenu_draw_item
                (local.get $parent_blob) (local.get $tidx) (local.get $cidx)
                (local.get $i) (local.get $hdc)
                (local.get $dx) (local.get $iy)
                (i32.add (local.get $dx) (local.get $dw))
                (i32.add (local.get $iy) (local.get $ih))
                (i32.eq (local.get $i) (local.get $hover_sidx))))))
          (if (i32.load offset=24 (local.get $it))
            (then
              (call $menu_draw_submenu_arrow
                (local.get $hdc) (local.get $dx) (local.get $dw) (local.get $iy)
                (i32.eq (local.get $i) (local.get $hover_sidx)))))))
      (local.set $iy (i32.add (local.get $iy) (local.get $ih)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  (func (export "menu_paint_dropdown")
        (param $hwnd i32) (param $tidx i32) (param $dx i32) (param $dy i32)
        (param $hover_cidx i32)
    (local $blob i32) (local $hdr i32) (local $count i32) (local $i i32)
    (local $hdc i32) (local $iy i32) (local $it i32) (local $flags i32)
    (local $label_wa i32) (local $label_len i32)
    (local $sc_wa i32) (local $sc_len i32) (local $dh i32) (local $dw i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return)))
    (local.set $hdr (call $child_hdr_w (local.get $blob) (local.get $tidx)))
    (if (i32.eqz (local.get $hdr)) (then (return)))
    (local.set $count (i32.load (local.get $hdr)))
    (if (i32.eqz (local.get $count)) (then (return)))

    (local.set $hdc (call $gdi_menu_overlay_ensure))
    (if (i32.eqz (local.get $hdc)) (then (return)))
    (local.set $dw
      (call $menu_header_width (local.get $blob) (local.get $hdr) (local.get $hdc)))
    (local.set $dh (i32.add (i32.mul (local.get $count) (i32.const 20)) (i32.const 4)))
    ;; Background + outset border.
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (local.get $dx) (local.get $dy)
            (i32.add (local.get $dx) (local.get $dw))
            (i32.add (local.get $dy) (local.get $dh))
            (i32.const 0x30011)))
    (drop (call $gdi_native_draw_edge (local.get $hdc)
            (local.get $dx) (local.get $dy)
            (i32.add (local.get $dx) (local.get $dw))
            (i32.add (local.get $dy) (local.get $dh))
            (i32.const 0x05) (i32.const 0x0F)))

    (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
    (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))

    (local.set $iy (i32.add (local.get $dy) (i32.const 2)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $it (i32.add (local.get $hdr)
                       (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (local.set $flags (i32.load offset=16 (local.get $it)))
      (if (i32.and (local.get $flags) (i32.const 0x01))
        (then
          ;; Separator: 1px shadow line in the middle of the row.
          (drop (call $gdi_native_fill_rect (local.get $hdc)
                  (i32.add (local.get $dx) (i32.const 4))
                  (i32.add (local.get $iy) (i32.const 9))
                  (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 4)))
                  (i32.add (local.get $iy) (i32.const 10))
                  (i32.const 0x30012))))
        (else
          ;; Hover highlight.
          (if (i32.eq (local.get $i) (local.get $hover_cidx))
            (then
              (drop (call $gdi_native_fill_rect (local.get $hdc)
                      (i32.add (local.get $dx) (i32.const 2)) (local.get $iy)
                      (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 2)))
                      (i32.add (local.get $iy) (i32.const 20))
                      (i32.const 14))) ;; COLOR_HIGHLIGHT brush
              (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0xFFFFFF))))
            (else
              (if (i32.and (local.get $flags) (i32.const 0x02))
                (then (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x808080))))
                (else (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x000000)))))))
          ;; Check glyph — two-stroke V drawn with BLACK_PEN/WHITE_PEN in the
          ;; left margin when MF_CHECKED (bit2) is set. Second pass offset by
          ;; +1 row gives a 2-px thick check. Font is re-selected after so
          ;; DrawText below keeps working.
          (if (i32.and (local.get $flags) (i32.const 0x04))
            (then
              (drop (call $gdi_native_select_object (local.get $hdc)
                      (if (result i32) (i32.eq (local.get $i) (local.get $hover_cidx))
                        (then (i32.const 0x30016))   ;; WHITE_PEN on hover
                        (else (i32.const 0x30017))))) ;; BLACK_PEN otherwise
              (drop (call $gdi_native_move_to (local.get $hdc)
                      (i32.add (local.get $dx) (i32.const 5))
                      (i32.add (local.get $iy) (i32.const 10))))
              (drop (call $gdi_native_line_to (local.get $hdc)
                      (i32.add (local.get $dx) (i32.const 8))
                      (i32.add (local.get $iy) (i32.const 14))))
              (drop (call $gdi_native_line_to (local.get $hdc)
                      (i32.add (local.get $dx) (i32.const 14))
                      (i32.add (local.get $iy) (i32.const 6))))
              (drop (call $gdi_native_move_to (local.get $hdc)
                      (i32.add (local.get $dx) (i32.const 5))
                      (i32.add (local.get $iy) (i32.const 11))))
              (drop (call $gdi_native_line_to (local.get $hdc)
                      (i32.add (local.get $dx) (i32.const 8))
                      (i32.add (local.get $iy) (i32.const 15))))
              (drop (call $gdi_native_line_to (local.get $hdc)
                      (i32.add (local.get $dx) (i32.const 14))
                      (i32.add (local.get $iy) (i32.const 7))))
              (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))))
          (if (i32.and
                (i32.ne (i32.and (local.get $flags) (i32.const 0x08)) (i32.const 0))
                (i32.and
                  (i32.ge_u (i32.load offset=20 (local.get $it)) (i32.const 0x800e))
                  (i32.le_u (i32.load offset=20 (local.get $it)) (i32.const 0x801e))))
            (then
              (call $menu_draw_wordpad_color_swatch
                (local.get $hdc) (local.get $dx) (local.get $dw) (local.get $iy)
                (i32.load offset=20 (local.get $it))))
            (else
              ;; Label
              (local.set $label_wa (i32.add (local.get $blob) (i32.load (local.get $it))))
              (local.set $label_len (i32.load offset=4 (local.get $it)))
              ;; DT_LEFT|DT_VCENTER|DT_SINGLELINE = 0x24
              (drop (call $gdi_native_draw_text (local.get $hdc)
                      (local.get $label_wa) (local.get $label_len)
                      (call $paint_rect (i32.add (local.get $dx) (i32.const 20))
                                        (local.get $iy)
                                        (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 20)))
                                        (i32.add (local.get $iy) (i32.const 20)))
                      (i32.const 0x24) (i32.const 0)))))
          ;; Optional shortcut, right-aligned.
          (local.set $sc_len (i32.load offset=12 (local.get $it)))
          (if (local.get $sc_len)
            (then
              (local.set $sc_wa (i32.add (local.get $blob)
                                  (i32.load offset=8 (local.get $it))))
              ;; DT_RIGHT(2)|DT_VCENTER(4)|DT_SINGLELINE(0x20) = 0x26
              (drop (call $gdi_native_draw_text (local.get $hdc)
                      (local.get $sc_wa) (local.get $sc_len)
                      (call $paint_rect (i32.add (local.get $dx) (i32.const 20))
                                        (local.get $iy)
                                        (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 20)))
                                        (i32.add (local.get $iy) (i32.const 20)))
                      (i32.const 0x26) (i32.const 0)))))
          (if (i32.load offset=24 (local.get $it))
            (then
              (call $menu_draw_submenu_arrow
                (local.get $hdc) (local.get $dx) (local.get $dw) (local.get $iy)
                (i32.eq (local.get $i) (local.get $hover_cidx)))))))
      (local.set $iy (i32.add (local.get $iy) (i32.const 20)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.and (i32.ge_s (local.get $hover_cidx) (i32.const 0))
                 (i32.lt_s (local.get $hover_cidx) (local.get $count)))
      (then
        (call $menu_paint_submenu
          (local.get $hwnd) (local.get $tidx) (local.get $hover_cidx)
          (i32.add (local.get $dx) (local.get $dw))
          (i32.add (i32.add (local.get $dy) (i32.const 2))
                   (i32.mul (local.get $hover_cidx) (i32.const 20)))
          (global.get $menu_open_sub_hover)))))

  ;; Let the compositor obtain/clear the presentation canvas before invoking
  ;; menu_paint_dropdown. The returned surface remains an ordinary WAT bitmap.
  (func (export "menu_prepare_overlay") (result i32)
    (i32.ne (call $gdi_menu_overlay_ensure) (i32.const 0)))

  ;; Dropdown box height for top item $tidx (0 if no children).
  ;; Used by JS to size the dropdown rect for hit-testing.
  (func (export "menu_dropdown_height")
        (param $hwnd i32) (param $tidx i32) (result i32)
    (local $blob i32) (local $hdr i32) (local $count i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const 0))))
    (local.set $hdr (call $child_hdr_w (local.get $blob) (local.get $tidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const 0))))
    (local.set $count (i32.load (local.get $hdr)))
    (i32.add (i32.mul (local.get $count) (i32.const 20)) (i32.const 4)))

  ;; Hit-test a click against an open dropdown of $tidx anchored at
  ;; (dx, dy). Returns child index, or -1 if outside / on a separator.
  (func $menu_hittest_dropdown (export "menu_hittest_dropdown")
        (param $hwnd i32) (param $tidx i32) (param $dx i32) (param $dy i32)
        (param $click_x i32) (param $click_y i32) (result i32)
    (local $blob i32) (local $hdr i32) (local $count i32) (local $cidx i32)
    (local $iy0 i32) (local $it i32) (local $flags i32) (local $dh i32)
    (local $dw i32) (local $hdc i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const -1))))
    (local.set $hdr (call $child_hdr_w (local.get $blob) (local.get $tidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const -1))))
    (local.set $count (i32.load (local.get $hdr)))
    (local.set $dh (i32.add (i32.mul (local.get $count) (i32.const 20)) (i32.const 4)))
    (local.set $hdc (call $gdi_menu_overlay_ensure))
    (local.set $dw
      (call $menu_header_width (local.get $blob) (local.get $hdr) (local.get $hdc)))
    ;; Outside box?
    (if (i32.lt_s (local.get $click_x) (i32.add (local.get $dx) (i32.const 2)))
      (then (return (i32.const -1))))
    (if (i32.ge_s (local.get $click_x)
          (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 2))))
      (then (return (i32.const -1))))
    (if (i32.lt_s (local.get $click_y) (i32.add (local.get $dy) (i32.const 2)))
      (then (return (i32.const -1))))
    (if (i32.ge_s (local.get $click_y) (i32.add (local.get $dy) (local.get $dh)))
      (then (return (i32.const -1))))
    (local.set $iy0 (i32.add (local.get $dy) (i32.const 2)))
    (local.set $cidx (i32.div_s (i32.sub (local.get $click_y) (local.get $iy0))
                                 (i32.const 20)))
    (if (i32.lt_s (local.get $cidx) (i32.const 0)) (then (return (i32.const -1))))
    (if (i32.ge_s (local.get $cidx) (local.get $count)) (then (return (i32.const -1))))
    (local.set $it (i32.add (local.get $hdr)
                     (i32.add (i32.const 4) (i32.mul (local.get $cidx) (i32.const 28)))))
    (local.set $flags (i32.load offset=16 (local.get $it)))
    (if (i32.and (local.get $flags) (i32.const 0x01))
      (then (return (i32.const -1))))
    (local.get $cidx))

  (func $menu_hittest_submenu
        (param $hwnd i32) (param $tidx i32) (param $cidx i32)
    (param $dx i32) (param $dy i32)
    (param $click_x i32) (param $click_y i32) (result i32)
    (local $blob i32) (local $hdr i32) (local $count i32) (local $sidx i32)
    (local $iy0 i32) (local $row_h i32) (local $it i32)
    (local $flags i32) (local $dh i32) (local $dw i32)
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const -1))))
    (local.set $hdr (call $child_sub_hdr_w
                      (local.get $blob) (local.get $tidx) (local.get $cidx)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const -1))))
    (local.set $count (i32.load (local.get $hdr)))
    (local.set $dh
      (call $menu_submenu_height (local.get $hwnd) (local.get $tidx) (local.get $cidx)))
    (local.set $dw
      (call $menu_submenu_width (local.get $hwnd) (local.get $tidx) (local.get $cidx)))
    ;; The box's own 2px border counts as inside. It used not to, and the left
    ;; border is precisely the column the pointer crosses when it slides right
    ;; out of the parent item: entering a cascade at its first two columns
    ;; highlighted nothing, so "Select Players > 2 Players" needed the pointer
    ;; to land two pixels deeper than the submenu appears to start.
    (if (i32.lt_s (local.get $click_x) (local.get $dx))
      (then (return (i32.const -1))))
    (if (i32.ge_s (local.get $click_x) (i32.add (local.get $dx) (local.get $dw)))
      (then (return (i32.const -1))))
    (if (i32.lt_s (local.get $click_y) (i32.add (local.get $dy) (i32.const 2)))
      (then (return (i32.const -1))))
    (if (i32.ge_s (local.get $click_y) (i32.add (local.get $dy) (local.get $dh)))
      (then (return (i32.const -1))))
    (local.set $iy0 (i32.add (local.get $dy) (i32.const 2)))
    (block $row_found (loop $rows
      (br_if $row_found (i32.ge_u (local.get $sidx) (local.get $count)))
      (local.set $row_h (call $resource_submenu_item_height
        (local.get $blob) (local.get $tidx) (local.get $cidx) (local.get $sidx)))
      (br_if $row_found
        (i32.lt_s (local.get $click_y) (i32.add (local.get $iy0) (local.get $row_h))))
      (local.set $iy0 (i32.add (local.get $iy0) (local.get $row_h)))
      (local.set $sidx (i32.add (local.get $sidx) (i32.const 1)))
      (br $rows)))
    (if (i32.ge_s (local.get $sidx) (local.get $count)) (then (return (i32.const -1))))
    (local.set $it (i32.add (local.get $hdr)
                     (i32.add (i32.const 4) (i32.mul (local.get $sidx) (i32.const 28)))))
    (local.set $flags (i32.load offset=16 (local.get $it)))
    (if (i32.and (local.get $flags) (i32.const 0x01))
      (then (return (i32.const -1))))
    (local.get $sidx))

  ;; ============================================================
  ;; $menu_load — parse the PE MENU resource ($find_resource(4, id))
  ;; into the heap-resident blob layout above and store the guest
  ;; pointer in MENU_DATA_TABLE[slot]. Replaces the JS encoder that
  ;; used to call menu_set with a pre-built blob.
  ;;
  ;; PE MENUITEMTEMPLATE format (we accept the standard, not MENUEX):
  ;;   MENUHEADER:  WORD wVersion=0; WORD cbHeaderSize=0;
  ;;   per item:    WORD fItemFlags;
  ;;                if !(fItemFlags & MF_POPUP=0x10): WORD wMenuID;
  ;;                WCHAR szString[]   (UTF-16, NUL-terminated)
  ;;                if fItemFlags & MF_POPUP: nested items follow
  ;;   MF_END=0x80 marks the last sibling at any level.
  ;;   MF_GRAYED=0x01, MF_SEPARATOR=0x800 may be ORed in.
  ;;
  ;; Top-level items become bar items. Popup children are preserved as
  ;; dropdown items; cascading sub-popups keep a nested child_offset so
  ;; TrackPopupMenu cascades render as grouped
  ;; submenus instead of one flattened command list.
  ;;
  ;; Two passes over the PE bytes:
  ;;   pass 1 — count $ml_bar_count, $ml_struct_size, $ml_string_size
  ;;   pass 2 — write into a freshly allocated heap blob, sized exactly
  ;; ============================================================

  ;; Read the label starting at $ml_pos, one $ml_char_stride-wide character at
  ;; a time. Advances $ml_pos past the trailing NUL, writes the char count to
  ;; $ml_label_chars, and returns the WASM addr of the first character.
  (func $ml_load_label (result i32)
    (local $start i32) (local $chars i32) (local $ch i32)
    (local.set $start (global.get $ml_pos))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (global.get $ml_pos) (global.get $ml_end)))
      (local.set $ch (call $ml_char_at (global.get $ml_pos) (i32.const 0)))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (global.get $ml_char_stride)))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $chars (i32.add (local.get $chars) (i32.const 1)))
      (br $scan)))
    (global.set $ml_label_chars (local.get $chars))
    (local.get $start))

  ;; Character $i of the label at $wa, in whichever width this template uses.
  (func $ml_char_at (param $wa i32) (param $i i32) (result i32)
    (local.set $wa (i32.add (local.get $wa)
      (i32.mul (local.get $i) (global.get $ml_char_stride))))
    (if (result i32) (i32.eq (global.get $ml_char_stride) (i32.const 1))
      (then (i32.load8_u (local.get $wa)))
      (else (i32.load16_u (local.get $wa)))))

  ;; Recursively consume one level of items WITHOUT counting them.
  ;; Used to skip cascading sub-popups in pass 1 / pass 2.
  (func $ml_skip_level
    (local $flags i32)
    (block $done (loop $items
      (br_if $done (i32.ge_u (global.get $ml_pos) (global.get $ml_end)))
      (local.set $flags (i32.load16_u (global.get $ml_pos)))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))
      (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x10)))
        (then (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))))
      (drop (call $ml_load_label))
      (if (i32.and (local.get $flags) (i32.const 0x10))
        (then (call $ml_skip_level)))
      (br_if $done (i32.and (local.get $flags) (i32.const 0x80)))
      (br $items))))

  ;; Pass 1 — children of one popup. Updates $ml_struct_size /
  ;; $ml_string_size. Counts direct children locally; nested popups recurse
  ;; and reserve their own child blocks.
  (func $ml_pass1_children
    (local $cc i32) (local $flags i32) (local $isPopup i32)
    (block $done (loop $items
      (br_if $done (i32.ge_u (global.get $ml_pos) (global.get $ml_end)))
      (local.set $flags (i32.load16_u (global.get $ml_pos)))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))
      (local.set $isPopup (i32.and (local.get $flags) (i32.const 0x10)))
      (if (i32.eqz (local.get $isPopup))
        (then (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))))
      (drop (call $ml_load_label))
      (local.set $cc (i32.add (local.get $cc) (i32.const 1)))
      (global.set $ml_string_size
        (i32.add (global.get $ml_string_size) (global.get $ml_label_chars)))
      (if (local.get $isPopup)
        (then (call $ml_pass1_children)))
      (br_if $done (i32.and (local.get $flags) (i32.const 0x80)))
      (br $items)))
    (if (local.get $cc)
      (then (global.set $ml_struct_size
              (i32.add (global.get $ml_struct_size)
                       (i32.add (i32.const 4) (i32.mul (local.get $cc) (i32.const 28))))))))

  ;; Pass 1 — top level. Walks each top item, counting bar slots and
  ;; recursing into children once for popups.
  (func $ml_pass1
    (local $flags i32) (local $chars i32)
    (block $done (loop $items
      (br_if $done (i32.ge_u (global.get $ml_pos) (global.get $ml_end)))
      (local.set $flags (i32.load16_u (global.get $ml_pos)))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))
      (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x10)))
        (then (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))))
      (drop (call $ml_load_label))
      (global.set $ml_bar_count (i32.add (global.get $ml_bar_count) (i32.const 1)))
      (global.set $ml_struct_size (i32.add (global.get $ml_struct_size) (i32.const 16)))
      (global.set $ml_string_size
        (i32.add (global.get $ml_string_size) (global.get $ml_label_chars)))
      (if (i32.and (local.get $flags) (i32.const 0x10))
        (then (call $ml_pass1_children)))
      (br_if $done (i32.and (local.get $flags) (i32.const 0x80)))
      (br $items))))

  ;; MENUEX resources (wVersion=1) use DWORD type/state/id fields, a WORD
  ;; bResInfo (bit0 popup, bit7 end), DWORD alignment after each label, and a
  ;; popup help-id DWORD before the nested items.
  (func $mlex_align_pos
    (global.set $ml_pos
      (i32.and (i32.add (global.get $ml_pos) (i32.const 3)) (i32.const -4))))

  (func $mlex_skip_level
    (local $resInfo i32)
    (block $done (loop $items
      (br_if $done (i32.gt_u (i32.add (global.get $ml_pos) (i32.const 14)) (global.get $ml_end)))
      (local.set $resInfo (i32.load16_u (i32.add (global.get $ml_pos) (i32.const 12))))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 14)))
      (drop (call $ml_load_label))
      (call $mlex_align_pos)
      (if (i32.and (local.get $resInfo) (i32.const 1))
        (then
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 4)))
          (call $mlex_skip_level)))
      (br_if $done (i32.and (local.get $resInfo) (i32.const 0x80)))
      (br $items))))

  (func $mlex_pass1_children
    (local $cc i32) (local $resInfo i32)
    (block $done (loop $items
      (br_if $done (i32.gt_u (i32.add (global.get $ml_pos) (i32.const 14)) (global.get $ml_end)))
      (local.set $resInfo (i32.load16_u (i32.add (global.get $ml_pos) (i32.const 12))))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 14)))
      (drop (call $ml_load_label))
      (local.set $cc (i32.add (local.get $cc) (i32.const 1)))
      (global.set $ml_string_size
        (i32.add (global.get $ml_string_size) (global.get $ml_label_chars)))
      (call $mlex_align_pos)
      (if (i32.and (local.get $resInfo) (i32.const 1))
        (then
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 4)))
          (call $mlex_pass1_children)))
      (br_if $done (i32.and (local.get $resInfo) (i32.const 0x80)))
      (br $items)))
    (if (local.get $cc)
      (then (global.set $ml_struct_size
              (i32.add (global.get $ml_struct_size)
                       (i32.add (i32.const 4) (i32.mul (local.get $cc) (i32.const 28))))))))

  (func $mlex_pass1
    (local $resInfo i32)
    (block $done (loop $items
      (br_if $done (i32.gt_u (i32.add (global.get $ml_pos) (i32.const 14)) (global.get $ml_end)))
      (local.set $resInfo (i32.load16_u (i32.add (global.get $ml_pos) (i32.const 12))))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 14)))
      (drop (call $ml_load_label))
      (global.set $ml_bar_count (i32.add (global.get $ml_bar_count) (i32.const 1)))
      (global.set $ml_struct_size (i32.add (global.get $ml_struct_size) (i32.const 16)))
      (global.set $ml_string_size
        (i32.add (global.get $ml_string_size) (global.get $ml_label_chars)))
      (call $mlex_align_pos)
      (if (i32.and (local.get $resInfo) (i32.const 1))
        (then
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 4)))
          (call $mlex_pass1_children)))
      (br_if $done (i32.and (local.get $resInfo) (i32.const 0x80)))
      (br $items))))

  ;; Find the first '\t' (0x09) in a label, or -1.
  (func $ml_find_tab (param $wa i32) (param $chars i32) (result i32)
    (local $i i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $chars)))
      (if (i32.eq (call $ml_char_at (local.get $wa) (local.get $i)) (i32.const 0x09))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Copy $chars characters from $src_wa to $dst_wa as ASCII (low byte).
  (func $ml_copy_ascii (param $src_wa i32) (param $dst_wa i32) (param $chars i32)
    (local $i i32)
    (block $done (loop $cp
      (br_if $done (i32.ge_u (local.get $i) (local.get $chars)))
      (i32.store8 (i32.add (local.get $dst_wa) (local.get $i))
                  (call $ml_char_at (local.get $src_wa) (local.get $i)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cp))))

  ;; Write one dropdown item record at explicit struct offset $rec_off.
  (func $ml_write_child_record (param $rec_off i32) (param $flags i32) (param $id i32)
                               (param $str_w i32) (param $chars i32) (param $child_off i32)
    (local $hdr_off i32) (local $tab i32)
    (local $label_chars i32) (local $sc_chars i32)
    (local $label_off i32) (local $sc_off i32) (local $out_flags i32)
    (local.set $hdr_off (local.get $rec_off))
    ;; Split label on '\t' for shortcut
    (local.set $tab (call $ml_find_tab (local.get $str_w) (local.get $chars)))
    (if (i32.ge_s (local.get $tab) (i32.const 0))
      (then
        (local.set $label_chars (local.get $tab))
        (local.set $sc_chars (i32.sub (i32.sub (local.get $chars) (local.get $tab)) (i32.const 1))))
      (else
        (local.set $label_chars (local.get $chars))
        (local.set $sc_chars (i32.const 0))))
    ;; Copy label to string region
    (local.set $label_off (global.get $ml_string_cur))
    (call $ml_copy_ascii (local.get $str_w)
          (i32.add (global.get $ml_blob_w) (global.get $ml_string_cur))
          (local.get $label_chars))
    (global.set $ml_string_cur (i32.add (global.get $ml_string_cur) (local.get $label_chars)))
    (local.set $sc_off (i32.const 0))
    (if (local.get $sc_chars)
      (then
        (local.set $sc_off (global.get $ml_string_cur))
        (call $ml_copy_ascii
          (i32.add (local.get $str_w) (i32.shl (i32.add (local.get $tab) (i32.const 1))
                                                (i32.const 1)))
          (i32.add (global.get $ml_blob_w) (global.get $ml_string_cur))
          (local.get $sc_chars))
        (global.set $ml_string_cur (i32.add (global.get $ml_string_cur) (local.get $sc_chars)))))
    ;; Out flags: bit0 separator, bit1 grayed, bit2 checked, bit3 popup
    (local.set $out_flags (i32.const 0))
    (if (i32.or (i32.and (local.get $flags) (i32.const 0x800))
                (i32.and (i32.eqz (local.get $chars))
                         (i32.eqz (local.get $id))))
      (then (local.set $out_flags (i32.or (local.get $out_flags) (i32.const 1)))))
    (if (i32.and (local.get $flags) (i32.const 0x01))
      (then (local.set $out_flags (i32.or (local.get $out_flags) (i32.const 2)))))
    (if (i32.and (local.get $flags) (i32.const 0x08))
      (then (local.set $out_flags (i32.or (local.get $out_flags) (i32.const 4)))))
    (if (local.get $child_off)
      (then (local.set $out_flags (i32.or (local.get $out_flags) (i32.const 8)))))
    ;; Write the child item record (28 bytes) at hdr_off.
    (i32.store           (i32.add (global.get $ml_blob_w) (local.get $hdr_off)) (local.get $label_off))
    (i32.store offset=4  (i32.add (global.get $ml_blob_w) (local.get $hdr_off)) (local.get $label_chars))
    (i32.store offset=8  (i32.add (global.get $ml_blob_w) (local.get $hdr_off)) (local.get $sc_off))
    (i32.store offset=12 (i32.add (global.get $ml_blob_w) (local.get $hdr_off)) (local.get $sc_chars))
    (i32.store offset=16 (i32.add (global.get $ml_blob_w) (local.get $hdr_off)) (local.get $out_flags))
    (i32.store offset=20 (i32.add (global.get $ml_blob_w) (local.get $hdr_off)) (local.get $id))
    (i32.store offset=24 (i32.add (global.get $ml_blob_w) (local.get $hdr_off)) (local.get $child_off)))

  ;; Count direct children at the current level, consuming nested popup
  ;; payloads only to skip them. Caller saves/restores $ml_pos around this.
  (func $ml_count_direct_children (result i32)
    (local $cc i32) (local $flags i32) (local $isPopup i32)
    (block $done (loop $items
      (br_if $done (i32.ge_u (global.get $ml_pos) (global.get $ml_end)))
      (local.set $flags (i32.load16_u (global.get $ml_pos)))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))
      (local.set $isPopup (i32.and (local.get $flags) (i32.const 0x10)))
      (if (i32.eqz (local.get $isPopup))
        (then (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))))
      (drop (call $ml_load_label))
      (local.set $cc (i32.add (local.get $cc) (i32.const 1)))
      (if (local.get $isPopup)
        (then (call $ml_skip_level)))
      (br_if $done (i32.and (local.get $flags) (i32.const 0x80)))
      (br $items)))
    (local.get $cc))

  ;; Pass 2 — children of one popup. Walks PE bytes the same way, fills
  ;; the child block at $ml_struct_cur. The direct item array must stay
  ;; contiguous, so it is reserved first and nested child blocks are appended
  ;; after it. Returns direct child count.
  (func $ml_pass2_children (result i32)
    (local $cc i32) (local $flags i32) (local $id i32)
    (local $str_w i32) (local $chars i32)
    (local $start_pos i32) (local $count_off i32) (local $rec_off i32)
    (local $child_off i32) (local $sub_count i32)
    (local $isPopup i32)
    (local.set $start_pos (global.get $ml_pos))
    (local.set $cc (call $ml_count_direct_children))
    (global.set $ml_pos (local.get $start_pos))
    (if (i32.eqz (local.get $cc)) (then (return (i32.const 0))))
    (local.set $count_off (global.get $ml_struct_cur))
    (global.set $ml_struct_cur
      (i32.add (global.get $ml_struct_cur)
               (i32.add (i32.const 4) (i32.mul (local.get $cc) (i32.const 28)))))
    (i32.store (i32.add (global.get $ml_blob_w) (local.get $count_off)) (local.get $cc))
    (local.set $rec_off (i32.add (local.get $count_off) (i32.const 4)))
    (block $done (loop $items
      (br_if $done (i32.ge_u (global.get $ml_pos) (global.get $ml_end)))
      (local.set $flags (i32.load16_u (global.get $ml_pos)))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))
      (local.set $isPopup (i32.and (local.get $flags) (i32.const 0x10)))
      (local.set $id (i32.const 0))
      (if (i32.eqz (local.get $isPopup))
        (then
          (local.set $id (i32.load16_u (global.get $ml_pos)))
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))))
      (local.set $str_w (call $ml_load_label))
      (local.set $chars (global.get $ml_label_chars))
      (local.set $child_off (i32.const 0))
      (if (local.get $isPopup)
        (then
          (local.set $child_off (global.get $ml_struct_cur))
          (local.set $sub_count (call $ml_pass2_children))
          (if (i32.eqz (local.get $sub_count))
            (then (local.set $child_off (i32.const 0))))))
      (call $ml_write_child_record
        (local.get $rec_off) (local.get $flags) (local.get $id)
        (local.get $str_w) (local.get $chars) (local.get $child_off))
      (local.set $rec_off (i32.add (local.get $rec_off) (i32.const 28)))
      (br_if $done (i32.and (local.get $flags) (i32.const 0x80)))
      (br $items)))
    (local.get $cc))

  ;; Pass 2 — top level. Writes bar items at fixed offsets and recurses
  ;; into children for each popup.
  (func $ml_pass2
    (local $bar_idx i32) (local $flags i32) (local $id i32)
    (local $isPopup i32) (local $str_w i32) (local $chars i32)
    (local $bar_addr i32) (local $label_off i32)
    (local $child_off i32) (local $cc i32)
    (block $done (loop $items
      (br_if $done (i32.ge_u (global.get $ml_pos) (global.get $ml_end)))
      (br_if $done (i32.ge_u (local.get $bar_idx) (global.get $ml_bar_count)))
      (local.set $flags (i32.load16_u (global.get $ml_pos)))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))
      (local.set $isPopup (i32.and (local.get $flags) (i32.const 0x10)))
      (local.set $id (i32.const 0))
      (if (i32.eqz (local.get $isPopup))
        (then
          (local.set $id (i32.load16_u (global.get $ml_pos)))
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))))
      (local.set $str_w (call $ml_load_label))
      (local.set $chars (global.get $ml_label_chars))
      (local.set $bar_addr
        (i32.add (global.get $ml_blob_w)
                 (i32.add (i32.const 4) (i32.mul (local.get $bar_idx) (i32.const 16)))))
      ;; Copy bar label
      (local.set $label_off (global.get $ml_string_cur))
      (call $ml_copy_ascii (local.get $str_w)
            (i32.add (global.get $ml_blob_w) (global.get $ml_string_cur))
            (local.get $chars))
      (global.set $ml_string_cur (i32.add (global.get $ml_string_cur) (local.get $chars)))
      (i32.store          (local.get $bar_addr) (local.get $label_off))
      (i32.store offset=4 (local.get $bar_addr) (local.get $chars))
      (i32.store offset=8 (local.get $bar_addr) (i32.const 0))
      (i32.store offset=12 (local.get $bar_addr) (local.get $id))
      (if (local.get $isPopup)
        (then
          (local.set $child_off (global.get $ml_struct_cur))
          (local.set $cc (call $ml_pass2_children))
          (if (local.get $cc)
            (then (i32.store offset=8 (local.get $bar_addr) (local.get $child_off))))))
      (local.set $bar_idx (i32.add (local.get $bar_idx) (i32.const 1)))
      (br_if $done (i32.and (local.get $flags) (i32.const 0x80)))
      (br $items))))

  (func $mlex_count_direct_children (result i32)
    (local $cc i32) (local $resInfo i32)
    (block $done (loop $items
      (br_if $done (i32.gt_u (i32.add (global.get $ml_pos) (i32.const 14)) (global.get $ml_end)))
      (local.set $resInfo (i32.load16_u (i32.add (global.get $ml_pos) (i32.const 12))))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 14)))
      (drop (call $ml_load_label))
      (local.set $cc (i32.add (local.get $cc) (i32.const 1)))
      (call $mlex_align_pos)
      (if (i32.and (local.get $resInfo) (i32.const 1))
        (then
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 4)))
          (call $mlex_skip_level)))
      (br_if $done (i32.and (local.get $resInfo) (i32.const 0x80)))
      (br $items)))
    (local.get $cc))

  (func $mlex_pass2_children (result i32)
    (local $cc i32) (local $type i32) (local $state i32) (local $id i32)
    (local $resInfo i32) (local $flags i32) (local $str_w i32) (local $chars i32)
    (local $start_pos i32) (local $count_off i32) (local $rec_off i32)
    (local $child_off i32) (local $sub_count i32)
    (local.set $start_pos (global.get $ml_pos))
    (local.set $cc (call $mlex_count_direct_children))
    (global.set $ml_pos (local.get $start_pos))
    (if (i32.eqz (local.get $cc)) (then (return (i32.const 0))))
    (local.set $count_off (global.get $ml_struct_cur))
    (global.set $ml_struct_cur
      (i32.add (global.get $ml_struct_cur)
               (i32.add (i32.const 4) (i32.mul (local.get $cc) (i32.const 28)))))
    (i32.store (i32.add (global.get $ml_blob_w) (local.get $count_off)) (local.get $cc))
    (local.set $rec_off (i32.add (local.get $count_off) (i32.const 4)))
    (block $done (loop $items
      (br_if $done (i32.gt_u (i32.add (global.get $ml_pos) (i32.const 14)) (global.get $ml_end)))
      (local.set $type (i32.load (global.get $ml_pos)))
      (local.set $state (i32.load offset=4 (global.get $ml_pos)))
      (local.set $id (i32.load offset=8 (global.get $ml_pos)))
      (local.set $resInfo (i32.load16_u (i32.add (global.get $ml_pos) (i32.const 12))))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 14)))
      (local.set $str_w (call $ml_load_label))
      (local.set $chars (global.get $ml_label_chars))
      (call $mlex_align_pos)
      (local.set $flags (i32.and (local.get $type) (i32.const 0x800)))
      (if (i32.and (local.get $state) (i32.const 3))
        (then (local.set $flags (i32.or (local.get $flags) (i32.const 1)))))
      ;; MENUEX stores MFS_CHECKED in dwState, while the shared record writer
      ;; consumes the equivalent classic MF_CHECKED bit.
      (if (i32.and (local.get $state) (i32.const 8))
        (then (local.set $flags (i32.or (local.get $flags) (i32.const 8)))))
      (local.set $child_off (i32.const 0))
      (if (i32.and (local.get $resInfo) (i32.const 1))
        (then
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 4)))
          (local.set $child_off (global.get $ml_struct_cur))
          (local.set $sub_count (call $mlex_pass2_children))
          (if (i32.eqz (local.get $sub_count))
            (then (local.set $child_off (i32.const 0))))))
      (call $ml_write_child_record
        (local.get $rec_off) (local.get $flags) (local.get $id)
        (local.get $str_w) (local.get $chars) (local.get $child_off))
      (local.set $rec_off (i32.add (local.get $rec_off) (i32.const 28)))
      (br_if $done (i32.and (local.get $resInfo) (i32.const 0x80)))
      (br $items)))
    (local.get $cc))

  (func $mlex_pass2
    (local $bar_idx i32) (local $id i32) (local $resInfo i32)
    (local $str_w i32) (local $chars i32) (local $bar_addr i32)
    (local $label_off i32) (local $child_off i32) (local $cc i32)
    (block $done (loop $items
      (br_if $done (i32.gt_u (i32.add (global.get $ml_pos) (i32.const 14)) (global.get $ml_end)))
      (br_if $done (i32.ge_u (local.get $bar_idx) (global.get $ml_bar_count)))
      (local.set $id (i32.load offset=8 (global.get $ml_pos)))
      (local.set $resInfo (i32.load16_u (i32.add (global.get $ml_pos) (i32.const 12))))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 14)))
      (local.set $str_w (call $ml_load_label))
      (local.set $chars (global.get $ml_label_chars))
      (call $mlex_align_pos)
      (local.set $bar_addr
        (i32.add (global.get $ml_blob_w)
                 (i32.add (i32.const 4) (i32.mul (local.get $bar_idx) (i32.const 16)))))
      (local.set $label_off (global.get $ml_string_cur))
      (call $ml_copy_ascii (local.get $str_w)
            (i32.add (global.get $ml_blob_w) (global.get $ml_string_cur))
            (local.get $chars))
      (global.set $ml_string_cur (i32.add (global.get $ml_string_cur) (local.get $chars)))
      (i32.store          (local.get $bar_addr) (local.get $label_off))
      (i32.store offset=4 (local.get $bar_addr) (local.get $chars))
      (i32.store offset=8 (local.get $bar_addr) (i32.const 0))
      (i32.store offset=12 (local.get $bar_addr) (local.get $id))
      (if (i32.and (local.get $resInfo) (i32.const 1))
        (then
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 4)))
          (local.set $child_off (global.get $ml_struct_cur))
          (local.set $cc (call $mlex_pass2_children))
          (if (local.get $cc)
            (then (i32.store offset=8 (local.get $bar_addr) (local.get $child_off))))))
      (local.set $bar_idx (i32.add (local.get $bar_idx) (i32.const 1)))
      (br_if $done (i32.and (local.get $resInfo) (i32.const 0x80)))
      (br $items))))

  ;; Public entry: load the menu identified by $menu_id (RT_MENU=4) for
  ;; $hwnd. Pass menu_id=0 to clear. Skips the load entirely if this
  ;; slot already has a blob — callers may invoke this multiple times
  ;; (eager path in $handle_CreateWindowExA, lazy path from renderer
  ;; _ensureWatMenu) and the first load wins so mutable state such as
  ;; CheckMenuItem's bit2 flag survives subsequent calls.
  ;; Why a window ended up with no menu. Every failure below is a plain
  ;; `return` that leaves the window looking like one that never asked for a
  ;; menu, and the app then paints an empty strip -- which reads as a painting
  ;; bug rather than a load that declined. $stage names the step that gave up:
  ;;   1 no window slot yet   2 cleared (menu_id 0)   3 already has a menu
  ;;   4 resource not found   5 header too small or unknown version
  ;;   6 parsed zero bar items   7 installed ($a = bar count)
  ;; Gated on --trace-win16 with the NE resource trace it pairs with; a Win32
  ;; app's menus resolve through the same function and trace the same way.
  (func $menu_load_trace (param $hwnd i32) (param $menu_id i32) (param $stage i32)
        (param $a i32) (param $b i32)
    (if (i32.eqz (global.get $win16_trace)) (then (return)))
    (call $host_log_i32 (i32.const 0xCA16A9E3))
    (call $host_log_i32 (local.get $hwnd))
    (call $host_log_i32 (local.get $menu_id))
    (call $host_log_i32 (local.get $stage))
    (call $host_log_i32 (local.get $a))
    (call $host_log_i32 (local.get $b)))

  (func $menu_load (export "menu_load") (param $hwnd i32) (param $menu_id i32)
    (local $slot i32) (local $tbl i32) (local $old i32)
    (local $entry i32) (local $bytes_g i32) (local $bytes_w i32)
    (local $size i32) (local $total i32) (local $newg i32) (local $neww i32)
    (local $source_id i32) (local $from_last_load i32) (local $ctx_hinst i32)
    (local $version i32) (local $headerOffset i32) (local $items_w i32)
    (local.set $source_id (local.get $menu_id))
    ;; Consume the one-shot class-menu module (see $class_menu_hinst). Taken
    ;; here rather than at the resolve site so an early return below can't leave
    ;; it armed for an unrelated later menu_load.
    (local.set $ctx_hinst (global.get $class_menu_hinst))
    (global.set $class_menu_hinst (i32.const 0))
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $slot) (i32.const -1))
      (then
        (call $menu_load_trace (local.get $hwnd) (local.get $menu_id)
          (i32.const 1) (i32.const 0) (i32.const 0))
        (return)))
    (local.set $tbl (call $menu_data_table_addr (local.get $slot)))
    (local.set $old (i32.load (local.get $tbl)))
    (if (i32.eqz (local.get $menu_id))
      (then
        (if (local.get $old)
          (then
            (call $resource_submenu_bindings_drop_parent (local.get $old))
            (call $heap_free (i32.sub (local.get $old) (i32.const 8)))))
        (i32.store (local.get $tbl) (i32.const 0))
        (call $menu_load_trace (local.get $hwnd) (local.get $menu_id)
          (i32.const 2) (i32.const 0) (i32.const 0))
        (return)))
    (if (local.get $old)
      (then
        (call $menu_load_trace (local.get $hwnd) (local.get $menu_id)
          (i32.const 3) (local.get $old) (i32.const 0))
        (return)))
    ;; LoadMenuA returns `resId | 0x00BE0000` as a fake handle. When MFC's
    ;; CreateWindowExA(hMenu=...) forwards that value through to us, strip
    ;; the tag so find_resource sees the raw resource ID.
    (if (i32.eq (i32.and (local.get $menu_id) (i32.const 0xFFFF0000))
                (i32.const 0x00BE0000))
      (then (local.set $menu_id (i32.and (local.get $menu_id) (i32.const 0xFFFF)))))
    (local.set $from_last_load
      (i32.eq (local.get $menu_id) (global.get $last_load_menu_id)))
    ;; Resolve resource bytes. An NE image keeps its menus in a flat resource
    ;; table with none of the PE tree, and stores the same MENUITEMTEMPLATE
    ;; with ANSI rather than UTF-16 labels — which is the whole difference, so
    ;; both feed the one parser below with the character width set here.
    (if (global.get $code16)
      (then
        (global.set $ml_char_stride (i32.const 1))
        ;; A Win16 WNDCLASS.lpszMenuName is a far pointer, not the integer
        ;; resource id Win32 commonly puts there. RegisterClass widens that
        ;; pointer to its linear guest address before storing the shared
        ;; WNDCLASSA. Treating the address as an id leaves class-owned named
        ;; menus (Cruel/Golf use "CRUEL"/"GOLF") absent even though the
        ;; RT_NAMETABLE maps each name to a real RT_MENU entry.
        (if (i32.ge_u (local.get $menu_id) (i32.const 0x10000))
          (then
            (local.set $bytes_w (call $win16_find_resource_ex
              (i32.const 4) (i32.const 0) (call $g2w (local.get $menu_id)))))
          (else
            (local.set $bytes_w (call $win16_find_resource
              (i32.const 4) (local.get $menu_id)))))
        (if (i32.eqz (local.get $bytes_w))
          (then
            (call $menu_load_trace (local.get $hwnd) (local.get $menu_id)
              (i32.const 4) (i32.const 0) (i32.const 0))
            (return)))
        (local.set $size (global.get $win16_res_len)))
      (else
        (global.set $ml_char_stride (i32.const 2))
        ;; LoadMenu can target a DLL and can carry a named ANSI/UTF-16 key.
        ;; Resolve it in the module and character width captured by the most
        ;; recent LoadMenuA/W call; direct class-menu pointers remain ANSI in
        ;; the current executable as before.
        (if (local.get $from_last_load)
          (then (call $push_rsrc_ctx (global.get $last_load_menu_hinst)))
          (else
            (if (local.get $ctx_hinst)
              (then (call $push_rsrc_ctx (local.get $ctx_hinst))))))
        (local.set $entry
          (if (result i32) (i32.and (local.get $from_last_load)
                (global.get $last_load_menu_wide))
            (then (call $find_resource_w (i32.const 4) (local.get $menu_id)))
            (else (call $find_resource (i32.const 4) (local.get $menu_id)))))
        ;; $entry and the RVA it points at are both relative to the module the
        ;; lookup ran in, so the context has to stay pushed until the bytes are
        ;; resolved — popping first silently re-based a DLL menu on the EXE.
        (if (i32.eqz (local.get $entry))
          (then
            (if (i32.or (local.get $from_last_load) (i32.ne (local.get $ctx_hinst) (i32.const 0)))
              (then (call $pop_rsrc_ctx)))
            (return)))
        ;; data entry: i32 RVA, i32 size
        (local.set $bytes_g (i32.add (call $r_base)
                              (i32.load (call $g2w (i32.add (call $r_base) (local.get $entry))))))
        (local.set $size (i32.load (call $g2w (i32.add (call $r_base)
                                                        (i32.add (local.get $entry) (i32.const 4))))))
        (local.set $bytes_w (call $g2w (local.get $bytes_g)))
        (if (i32.or (local.get $from_last_load) (i32.ne (local.get $ctx_hinst) (i32.const 0)))
          (then (call $pop_rsrc_ctx)))))
    (if (i32.lt_u (local.get $size) (i32.const 8))
      (then
        (call $menu_load_trace (local.get $hwnd) (local.get $menu_id)
          (i32.const 5) (local.get $size) (i32.const 0))
        (return)))
    (local.set $version (i32.load16_u (local.get $bytes_w)))
    (local.set $headerOffset (i32.load16_u (i32.add (local.get $bytes_w) (i32.const 2))))
    (if (i32.gt_u (local.get $version) (i32.const 1))
      (then
        (call $menu_load_trace (local.get $hwnd) (local.get $menu_id)
          (i32.const 5) (local.get $size) (local.get $version))
        (return)))
    (local.set $items_w
      (i32.add (local.get $bytes_w) (i32.add (i32.const 4) (local.get $headerOffset))))
    ;; --- Pass 1: count ---
    (global.set $ml_pos (local.get $items_w))
    (global.set $ml_end (i32.add (local.get $bytes_w) (local.get $size)))
    (global.set $ml_bar_count   (i32.const 0))
    (global.set $ml_struct_size (i32.const 4)) ;; bar_count header
    (global.set $ml_string_size (i32.const 0))
    (if (local.get $version)
      (then (call $mlex_pass1))
      (else (call $ml_pass1)))
    (if (i32.eqz (global.get $ml_bar_count))
      (then
        (call $menu_load_trace (local.get $hwnd) (local.get $menu_id)
          (i32.const 6) (local.get $size) (local.get $items_w))
        (return)))
    ;; --- Allocate blob and run pass 2 ---
    (local.set $total (i32.add (global.get $ml_struct_size) (global.get $ml_string_size)))
    (local.set $newg (call $heap_alloc (i32.add (local.get $total) (i32.const 8)))) (local.set $neww (call $g2w (local.get $newg)))
    (i32.store (local.get $neww) (local.get $source_id))
    (i32.store offset=4 (local.get $neww) (local.get $total))
    (i32.store (local.get $tbl) (i32.add (local.get $newg) (i32.const 8)))
    (global.set $ml_blob_w (i32.add (local.get $neww) (i32.const 8)))
    ;; bar_count header
    (i32.store (global.get $ml_blob_w) (global.get $ml_bar_count))
    ;; cursors: $ml_struct_cur runs forward through bar items + child
    ;; blocks; $ml_string_cur runs forward through the string region
    ;; that begins right after the struct region.
    (global.set $ml_string_cur (global.get $ml_struct_size))
    (global.set $ml_struct_cur
      (i32.add (i32.const 4) (i32.mul (global.get $ml_bar_count) (i32.const 16))))
    (global.set $ml_pos (local.get $items_w))
    (if (local.get $version)
      (then (call $mlex_pass2))
      (else (call $ml_pass2)))
    (call $menu_load_trace (local.get $hwnd) (local.get $menu_id)
      (i32.const 7) (global.get $ml_bar_count) (i32.load (local.get $tbl))))

  ;; ============================================================
  ;; Menu tracking — JS shells out raw mouse / keyboard events to
  ;; the helpers below; all open/close/hover/activate logic lives
  ;; here. State is in $menu_open_hwnd / $menu_open_top /
  ;; $menu_open_hover (one menu open at a time, system-wide).
  ;;
  ;; Activations post WM_COMMAND into the shared owning-thread queue. Menu
  ;; tracking may execute in the browser-side shadow instance while the live
  ;; guest runs in a Worker, so the instance-local queue/count at 0x400 is not
  ;; a valid handoff. The guest pump dequeues the shared message next slice.
  ;; ============================================================

  (func (export "menu_open_hwnd")  (result i32) (global.get $menu_open_hwnd))
  (func (export "menu_open_top")   (result i32) (global.get $menu_open_top))
  (func (export "menu_open_hover") (result i32) (global.get $menu_open_hover))
  (func (export "menu_open_sub_hover") (result i32) (global.get $menu_open_sub_hover))
  (func (export "menu_open_x")     (result i32) (global.get $menu_open_x))
  (func (export "menu_open_y")     (result i32) (global.get $menu_open_y))

  ;; Exported so a trace can say where the dropdown and its cascade are:
  ;; "the submenu was never highlighted" and "the pointer was aimed left of
  ;; the submenu" are the same subhover=-1 without them.
  (func $menu_dropdown_x (export "menu_dropdown_x") (param $hwnd i32) (param $top i32) (result i32)
    (if (i32.ge_s (global.get $menu_open_x) (i32.const 0))
      (then (return (global.get $menu_open_x))))
    (i32.add (call $menu_bar_screen_x (local.get $hwnd))
             (call $menu_bar_item_x (local.get $hwnd) (local.get $top))))

  (func $menu_dropdown_y (export "menu_dropdown_y") (param $hwnd i32) (result i32)
    (if (i32.ge_s (global.get $menu_open_y) (i32.const 0))
      (then (return (global.get $menu_open_y))))
    (i32.add (call $menu_bar_screen_y (local.get $hwnd)) (call $menu_bar_screen_h)))

  ;; Number of items currently being tracked (0 if no menu open).
  (func $menu_track_child_count (result i32)
    (if (i32.eqz (global.get $menu_open_hwnd)) (then (return (i32.const 0))))
    (call $menu_child_count (global.get $menu_open_hwnd) (global.get $menu_open_top)))

  (func $menu_sub_track_child_count (result i32)
    (if (i32.eqz (global.get $menu_open_hwnd)) (then (return (i32.const 0))))
    (if (i32.lt_s (global.get $menu_open_hover) (i32.const 0)) (then (return (i32.const 0))))
    (call $menu_child_sub_count
      (global.get $menu_open_hwnd) (global.get $menu_open_top) (global.get $menu_open_hover)))

  (func $menu_sub_first_selectable (result i32)
    (local $n i32) (local $i i32) (local $f i32)
    (local.set $n (call $menu_sub_track_child_count))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $f (call $menu_subchild_flags
        (global.get $menu_open_hwnd)
        (global.get $menu_open_top)
        (global.get $menu_open_hover)
        (local.get $i)))
      (if (i32.eqz (i32.and (local.get $f) (i32.const 0x03)))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; ============================================================
  ;; Detached LoadMenu handles.
  ;;
  ;; Every menu above belongs to a window: the blob lives in
  ;; MENU_DATA_TABLE[slot] and $menu_hwnd_from_handle finds it by walking the
  ;; window table. A menu that LoadMenu returned and nobody has attached yet
  ;; has no window, so those queries answered "invalid menu" — and that is a
  ;; real handle on Win32, not an invalid one. MFC keeps
  ;; CMultiDocTemplate::m_hMenuShared exactly that way and walks it with
  ;; GetMenuItemCount/GetSubMenu/GetMenuItemID hunting for the MRU id block,
  ;; and -1 from GetMenuItemCount turns its `for (i = count - 1; i; i--)` into
  ;; a loop that counts down from -2 through four billion iterations. That is
  ;; SimCity 2000's "Load Demo City" hang: 21.3M block entries, 93% of all the
  ;; work in the run, in the three blocks at simdemo+0x4a4993.
  ;;
  ;; Materialize such a handle on first query as an ordinary dynamic (MNUD)
  ;; menu built from its RT_MENU template, and cache it so the identity is
  ;; stable across calls. Every existing dynamic-menu query then answers it,
  ;; including GetSubMenu handing back a real child HMENU. Attaching the menu
  ;; later is unaffected: $menu_hwnd_from_handle finds the window first, and
  ;; $menu_load still builds the paint blob from the same resource.
  ;;
  ;; Only an integer resource id can be resolved back this way — LoadMenu
  ;; returns the caller's pointer for a named resource, which carries no tag —
  ;; and only the classic MENUITEMTEMPLATE, not MENUEX.
  ;; ============================================================

  ;; Guest-heap list of {next, resource id, dynamic HMENU}.
  (global $detached_menus (mut i32) (i32.const 0))

  ;; Resolve the RT_MENU bytes for $menu_id and return the WASM address of its
  ;; first item, with $ml_end and $ml_char_stride set for the walkers below.
  ;; 0 when the resource is missing, truncated, or MENUEX.
  (func $menu_detached_items (param $menu_id i32) (result i32)
    (local $bytes_w i32) (local $size i32) (local $entry i32) (local $pushed i32)
    (if (global.get $code16)
      (then
        (global.set $ml_char_stride (i32.const 1))
        (local.set $bytes_w
          (call $win16_find_resource (i32.const 4) (local.get $menu_id)))
        (if (i32.eqz (local.get $bytes_w)) (then (return (i32.const 0))))
        (local.set $size (global.get $win16_res_len)))
      (else
        (global.set $ml_char_stride (i32.const 2))
        ;; LoadMenu can name a DLL. The only module recorded per call is the
        ;; most recent one, so use it when this is that same id and fall back
        ;; to the current resource context otherwise.
        (if (i32.and
              (i32.ne (global.get $last_load_menu_hinst) (i32.const 0))
              (i32.eq (local.get $menu_id) (global.get $last_load_menu_id)))
          (then
            (call $push_rsrc_ctx (global.get $last_load_menu_hinst))
            (local.set $pushed (i32.const 1))))
        (local.set $entry (call $find_resource (i32.const 4) (local.get $menu_id)))
        (if (i32.eqz (local.get $entry))
          (then
            (if (local.get $pushed) (then (call $pop_rsrc_ctx)))
            (return (i32.const 0))))
        ;; data entry: i32 RVA, i32 size — both relative to the module the
        ;; lookup ran in, so resolve the bytes before popping the context.
        (local.set $bytes_w (call $g2w (i32.add (call $r_base)
          (i32.load (call $g2w (i32.add (call $r_base) (local.get $entry)))))))
        (local.set $size (i32.load (call $g2w (i32.add (call $r_base)
          (i32.add (local.get $entry) (i32.const 4))))))
        (if (local.get $pushed) (then (call $pop_rsrc_ctx)))))
    (if (i32.lt_u (local.get $size) (i32.const 8)) (then (return (i32.const 0))))
    (if (i32.ne (i32.load16_u (local.get $bytes_w)) (i32.const 0))
      (then (return (i32.const 0))))
    (global.set $ml_end (i32.add (local.get $bytes_w) (local.get $size)))
    (i32.add (local.get $bytes_w)
      (i32.add (i32.const 4)
        (i32.load16_u (i32.add (local.get $bytes_w) (i32.const 2))))))

  ;; Append one sibling level of the template at $ml_pos into $hmenu, nesting
  ;; into a fresh child menu for every MF_POPUP. Stops after the MF_END item.
  (func $menu_detached_level (param $hmenu i32)
    (local $flags i32) (local $id i32) (local $child i32) (local $lab i32)
    (local $chars i32) (local $txt_g i32) (local $txt_w i32) (local $i i32)
    (block $done (loop $items
      (br_if $done (i32.ge_u (global.get $ml_pos) (global.get $ml_end)))
      (local.set $flags (i32.load16_u (global.get $ml_pos)))
      (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2)))
      (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x10)))
        (then
          (local.set $id (i32.load16_u (global.get $ml_pos)))
          (global.set $ml_pos (i32.add (global.get $ml_pos) (i32.const 2))))
        (else (local.set $id (i32.const 0))))
      (local.set $lab (call $ml_load_label))
      (local.set $chars (global.get $ml_label_chars))
      ;; The dynamic menu keeps canonical ANSI text; a PE template is UTF-16.
      (local.set $txt_g (call $heap_alloc (i32.add (local.get $chars) (i32.const 1))))
      (if (local.get $txt_g)
        (then
          (local.set $txt_w (call $g2w (local.get $txt_g)))
          (local.set $i (i32.const 0))
          (block $copied (loop $chs
            (br_if $copied (i32.ge_u (local.get $i) (local.get $chars)))
            (i32.store8 (i32.add (local.get $txt_w) (local.get $i))
              (call $ml_char_at (local.get $lab) (local.get $i)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $chs)))
          (i32.store8 (i32.add (local.get $txt_w) (local.get $chars)) (i32.const 0))))
      ;; A popup's children follow its label immediately, so consume them
      ;; before the parent item is appended.
      (local.set $child (i32.const 0))
      (if (i32.and (local.get $flags) (i32.const 0x10))
        (then
          (local.set $child (call $dynamic_menu_create))
          (if (local.get $child)
            (then (call $menu_detached_level (local.get $child))))))
      ;; MF_END is a template terminator, never a state Win32 reports back.
      (drop (call $dynamic_menu_append (local.get $hmenu)
        (i32.and (local.get $flags) (i32.const 0xFFFFFF7F))
        (select (local.get $child) (local.get $id)
          (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0)))
        (local.get $txt_g)))
      (if (local.get $txt_g) (then (call $heap_free (local.get $txt_g))))
      (br_if $done (i32.and (local.get $flags) (i32.const 0x80)))
      (br $items))))

  (func $menu_detached_build (param $menu_id i32) (result i32)
    (local $items_w i32) (local $hmenu i32)
    (local.set $items_w (call $menu_detached_items (local.get $menu_id)))
    (if (i32.eqz (local.get $items_w)) (then (return (i32.const 0))))
    (local.set $hmenu (call $dynamic_menu_create))
    (if (i32.eqz (local.get $hmenu)) (then (return (i32.const 0))))
    (global.set $ml_pos (local.get $items_w))
    (call $menu_detached_level (local.get $hmenu))
    (local.get $hmenu))

  ;; The dynamic HMENU standing in for an unattached LoadMenu handle, built on
  ;; first use. 0 when $hmenu is not an integer-resource menu handle or its
  ;; template cannot be read — the callers keep answering "invalid menu" then,
  ;; which is what Win32 says about a handle that really is invalid.
  (func $menu_detached_handle (param $hmenu i32) (result i32)
    (local $id i32) (local $node i32) (local $nw i32) (local $built i32)
    (if (i32.ne (i32.and (local.get $hmenu) (i32.const 0x00FF0000))
                (i32.const 0x00BE0000))
      (then (return (i32.const 0))))
    (local.set $id (i32.and (local.get $hmenu) (i32.const 0xFFFF)))
    (if (i32.eqz (local.get $id)) (then (return (i32.const 0))))
    (local.set $node (global.get $detached_menus))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $nw (call $g2w (local.get $node)))
      (if (i32.eq (i32.load offset=4 (local.get $nw)) (local.get $id))
        (then (return (i32.load offset=8 (local.get $nw)))))
      (local.set $node (i32.load (local.get $nw)))
      (br $scan)))
    (local.set $built (call $menu_detached_build (local.get $id)))
    (if (i32.eqz (local.get $built)) (then (return (i32.const 0))))
    (local.set $node (call $heap_alloc (i32.const 12)))
    (if (local.get $node)
      (then
        (local.set $nw (call $g2w (local.get $node)))
        (i32.store         (local.get $nw) (global.get $detached_menus))
        (i32.store offset=4 (local.get $nw) (local.get $id))
        (i32.store offset=8 (local.get $nw) (local.get $built))
        (global.set $detached_menus (local.get $node))))
    (local.get $built))

  ;; The alias already built for an integer LoadMenu handle, or 0. Never
  ;; builds one: SetMenu asks this so a menu the app edited while unattached
  ;; (Unreal localizes its ID_* labels through SetMenuItemInfo before SetMenu)
  ;; is attached as edited, while an untouched handle keeps the resource path.
  (func $menu_detached_existing (param $hmenu i32) (result i32)
    (local $id i32) (local $node i32) (local $nw i32)
    (if (i32.ne (i32.and (local.get $hmenu) (i32.const 0xFFFF0000))
                (i32.const 0x00BE0000))
      (then (return (i32.const 0))))
    (local.set $id (i32.and (local.get $hmenu) (i32.const 0xFFFF)))
    (local.set $node (global.get $detached_menus))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $nw (call $g2w (local.get $node)))
      (if (i32.eq (i32.load offset=4 (local.get $nw)) (local.get $id))
        (then (return (i32.load offset=8 (local.get $nw)))))
      (local.set $node (i32.load (local.get $nw)))
      (br $scan)))
    (i32.const 0))

  ;; MENUITEMINFO calls address the canonical dynamic tree: a heap menu as
  ;; is, an unattached LoadMenu handle through its detached alias (built on
  ;; first use, as EnableMenuItem/CheckMenuItem do). Attached resource bars
  ;; keep their window-backed representation and stay unsupported here.
  (func $menu_item_info_target (param $hmenu i32) (result i32)
    (local $alias i32)
    (if (call $dynamic_menu_state_w (local.get $hmenu))
      (then (return (local.get $hmenu))))
    (if (call $menu_hwnd_from_handle (local.get $hmenu))
      (then (return (local.get $hmenu))))
    (local.set $alias (call $menu_detached_handle (local.get $hmenu)))
    (select (local.get $alias) (local.get $hmenu) (i32.ne (local.get $alias) (i32.const 0))))

  ;; Unlink an existing detached alias without materializing a new menu.
  ;; Accept either its tagged resource handle or its canonical dynamic root.
  ;; The caller owns destruction of the returned root.
  (func $menu_detached_take (param $hmenu i32) (result i32)
    (local $node i32) (local $nw i32) (local $prev i32)
    (local $next i32) (local $root i32) (local $tagged i32)
    (local.set $tagged (i32.eq
      (i32.and (local.get $hmenu) (i32.const 0xFFFF0000)) (i32.const 0x00BE0000)))
    (local.set $node (global.get $detached_menus))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $nw (call $g2w (local.get $node)))
      (local.set $next (i32.load (local.get $nw)))
      (local.set $root (i32.load offset=8 (local.get $nw)))
      (if (i32.or (i32.eq (local.get $root) (local.get $hmenu))
            (i32.and (local.get $tagged)
              (i32.eq (i32.load offset=4 (local.get $nw))
                (i32.and (local.get $hmenu) (i32.const 0xFFFF)))))
        (then
          (if (local.get $prev)
            (then (i32.store (local.get $prev) (local.get $next)))
            (else (global.set $detached_menus (local.get $next))))
          (call $heap_free (local.get $node))
          (return (local.get $root))))
      (local.set $prev (local.get $nw))
      (local.set $node (local.get $next))
      (br $scan)))
    (i32.const 0))

  ;; ---- Menu handle queries (GetMenuItemCount / GetMenuItemID / GetMenuState)
  ;;
  ;; A menu handle here is the window's own menu id, and GetSubMenu turns that
  ;; into (hmenu & 0xFFFF) | ((pos+1) << 16). So the low word identifies which
  ;; window's menu this is, and a non-matching high word says which dropdown.
  ;; Find the window by the low word and everything else follows from the menu
  ;; model we already keep.
  (func $menu_hwnd_from_handle (param $hmenu i32) (result i32)
    (local $i i32) (local $hwnd i32) (local $src i32)
    (if (i32.eqz (local.get $hmenu)) (then (return (i32.const 0))))
    (block $done
      (loop $wins
        (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
        (local.set $hwnd (load.field WndRecord hwnd (call $wnd_record_addr (local.get $i))))
        (if (local.get $hwnd)
          (then
            (local.set $src (call $menu_source_get (local.get $hwnd)))
            (if (i32.eqz (local.get $src))
              (then (if (i32.gt_s (call $menu_bar_count (local.get $hwnd)) (i32.const 0))
                (then (local.set $src (i32.const 0x80001))))))
            (if (local.get $src)
              (then
                (if (i32.eq (i32.and (local.get $src) (i32.const 0xFFFF))
                            (i32.and (local.get $hmenu) (i32.const 0xFFFF)))
                  (then (return (local.get $hwnd))))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $wins)))
    (i32.const 0))

  ;; Is this handle the menu bar itself, or one of its dropdowns? The bar's
  ;; handle is whatever GetMenu hands out; a dropdown always carries pos+1 in
  ;; its high word, so it differs from the bar's own handle.
  (func $menu_handle_top_index (param $hwnd i32) (param $hmenu i32) (result i32)
    (local $src i32)
    (local.set $src (call $menu_source_get (local.get $hwnd)))
    (if (i32.eqz (local.get $src)) (then (local.set $src (i32.const 0x80001))))
    (if (i32.eq (local.get $src) (local.get $hmenu)) (then (return (i32.const -1))))
    (i32.sub (i32.shr_u (local.get $hmenu) (i32.const 16)) (i32.const 1)))

  ;; Resolve the submenu activated by a zero-based item position. Dynamic
  ;; menus retain the real child HMENU. Resource/attached menu bars use the
  ;; established encoded dropdown handle, but only after proving the position
  ;; exists and actually owns children; a command or out-of-range position is
  ;; NULL on Win32, not a fabricated handle.
  (func $menu_handle_submenu (param $hmenu i32) (param $pos i32) (result i32)
    (local $dyn i32) (local $rec i32) (local $hwnd i32) (local $top i32)
    (local $blob i32) (local $item i32)
    (local.set $dyn (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (local.get $dyn)
      (then
        (if (i32.or
              (i32.lt_s (local.get $pos) (i32.const 0))
              (i32.ge_u (local.get $pos) (i32.load offset=4 (local.get $dyn))))
          (then (return (i32.const 0))))
        (local.set $rec (i32.add (local.get $dyn)
          (i32.add (i32.const 16)
            (i32.mul (local.get $pos) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
        (if (i32.eqz (i32.and (i32.load (local.get $rec)) (i32.const 0x10)))
          (then (return (i32.const 0))))
        (return (i32.load offset=12 (local.get $rec)))))
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd))
      (then
        (local.set $dyn (call $menu_detached_handle (local.get $hmenu)))
        (if (local.get $dyn)
          (then (return (call $menu_handle_submenu (local.get $dyn) (local.get $pos)))))
        (return (i32.const 0))))
    (local.set $top (call $menu_handle_top_index (local.get $hwnd) (local.get $hmenu)))
    ;; A direct dropdown can itself own a cascade. Its immutable resource blob
    ;; is bridged to an MNUD handle so DeleteMenu/InsertMenuItem/SetMenuItemInfo
    ;; mutate the same state the nested painter and hit tester consume.
    (if (i32.ge_s (local.get $top) (i32.const 0))
      (then
        (if (i32.or
              (i32.ge_u (local.get $top) (call $menu_bar_count (local.get $hwnd)))
              (i32.or
                (i32.lt_s (local.get $pos) (i32.const 0))
                (i32.ge_u (local.get $pos)
                  (call $menu_child_count (local.get $hwnd) (local.get $top)))))
          (then (return (i32.const 0))))
        (local.set $blob (call $menu_blob_w (local.get $hwnd)))
        (local.set $item (call $child_item_w
          (local.get $blob) (local.get $top) (local.get $pos)))
        (if (i32.or
              (i32.eqz (local.get $item))
              (i32.eqz (i32.load offset=24 (local.get $item))))
          (then (return (i32.const 0))))
        (return (call $resource_submenu_bind
          (local.get $blob) (local.get $top) (local.get $pos)
          (local.get $hwnd)))))
    (if (i32.or
          (i32.lt_s (local.get $pos) (i32.const 0))
          (i32.ge_u (local.get $pos) (call $menu_bar_count (local.get $hwnd))))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $menu_child_count (local.get $hwnd) (local.get $pos)))
      (then (return (i32.const 0))))
    (i32.or
      (i32.and (local.get $hmenu) (i32.const 0xFFFF))
      (i32.shl (i32.add (local.get $pos) (i32.const 1)) (i32.const 16))))

  (func $menu_handle_item_count (export "menu_handle_item_count")
        (param $hmenu i32) (result i32)
    (local $hwnd i32) (local $top i32) (local $dyn i32)
    (local.set $dyn (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (local.get $dyn)
      (then (return (i32.load offset=4 (local.get $dyn)))))
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd))
      (then
        (local.set $dyn (call $menu_detached_handle (local.get $hmenu)))
        (if (local.get $dyn)
          (then (return (call $menu_handle_item_count (local.get $dyn)))))
        (return (i32.const -1))))
    (local.set $top (call $menu_handle_top_index (local.get $hwnd) (local.get $hmenu)))
    (if (i32.lt_s (local.get $top) (i32.const 0))
      (then (return (call $menu_bar_count (local.get $hwnd)))))
    (call $menu_child_count (local.get $hwnd) (local.get $top)))

  ;; Command id at a position. Windows returns -1 for a submenu or a NULL
  ;; identifier, and also for an invalid menu/position.
  (func $menu_handle_item_id (export "menu_handle_item_id")
        (param $hmenu i32) (param $pos i32) (result i32)
    (local $hwnd i32) (local $top i32) (local $dyn i32) (local $rec i32)
    (local.set $dyn (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (local.get $dyn)
      (then
        (if (i32.or
              (i32.lt_s (local.get $pos) (i32.const 0))
              (i32.ge_u (local.get $pos) (i32.load offset=4 (local.get $dyn))))
          (then (return (i32.const -1))))
        (local.set $rec (i32.add (local.get $dyn)
          (i32.add (i32.const 16)
            (i32.mul (local.get $pos) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
        (if (i32.or
              (i32.ne (i32.and (i32.load (local.get $rec)) (i32.const 0x10)) (i32.const 0))
              (i32.eqz (i32.load offset=4 (local.get $rec))))
          (then (return (i32.const -1))))
        (return (i32.load offset=4 (local.get $rec)))))
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd))
      (then
        (local.set $dyn (call $menu_detached_handle (local.get $hmenu)))
        (if (local.get $dyn)
          (then (return (call $menu_handle_item_id (local.get $dyn) (local.get $pos)))))
        (return (i32.const -1))))
    (local.set $top (call $menu_handle_top_index (local.get $hwnd) (local.get $hmenu)))
    (if (i32.lt_s (local.get $top) (i32.const 0))
      (then
        (if (i32.or
              (i32.lt_s (local.get $pos) (i32.const 0))
              (i32.ge_u (local.get $pos) (call $menu_bar_count (local.get $hwnd))))
          (then (return (i32.const -1))))
        (if (call $menu_child_count (local.get $hwnd) (local.get $pos))
          (then (return (i32.const -1))))
        (local.set $top (call $menu_bar_id (local.get $hwnd) (local.get $pos)))
        (return (select (local.get $top) (i32.const -1)
          (i32.ne (local.get $top) (i32.const 0))))))
    (if (i32.ge_u (local.get $pos) (call $menu_child_count (local.get $hwnd) (local.get $top)))
      (then (return (i32.const -1))))
    (local.set $top (call $menu_child_id (local.get $hwnd) (local.get $top) (local.get $pos)))
    (return (select (local.get $top) (i32.const -1)
      (i32.ne (local.get $top) (i32.const 0)))))

  ;; Our item flags are internal (bit 1 = disabled, bit 2 = checked); Windows
  ;; wants MF_GRAYED 1 / MF_DISABLED 2 / MF_CHECKED 8. Translate rather than
  ;; leak the internal encoding through the API.
  ;; Bit 0 (separator) is MF_SEPARATOR 0x800: MFC's OnUpdateFileSendMail
  ;; removes Send... and then one of the separators around it only when
  ;; GetMenuState reports both neighbours as separators, so without this bit
  ;; Paint's File menu kept two adjacent separators.
  (func $menu_flags_to_mf (param $flags i32) (result i32)
    (i32.or
      (i32.or
        (select (i32.const 3) (i32.const 0)
          (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0)))
        (select (i32.const 8) (i32.const 0)
          (i32.ne (i32.and (local.get $flags) (i32.const 4)) (i32.const 0))))
      (select (i32.const 0x800) (i32.const 0)
        (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0)))))

  ;; Return the canonical dynamic record once, whether the public handle is
  ;; a heap menu or an unattached LoadMenu alias. Attached resource menus keep
  ;; their window-backed representation.
  (func $menu_query_dynamic_w (param $hmenu i32) (result i32)
    (local $sw i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (local.get $sw) (then (return (local.get $sw))))
    (if (call $menu_hwnd_from_handle (local.get $hmenu))
      (then (return (i32.const 0))))
    (call $dynamic_menu_state_w (call $menu_detached_handle (local.get $hmenu))))

  ;; GetMenuState uses public MF bits, not the painter's compact flags. For
  ;; popup rows the high byte contains the child count and the low byte flags.
  (func $dynamic_menu_query_state
        (param $sw i32) (param $item i32) (param $bypos i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32) (local $flags i32)
    (local $sub i32) (local $r i32)
    (if (i32.eqz (local.get $sw)) (then (return (i32.const -1))))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (if (local.get $bypos)
      (then
        (if (i32.ge_u (local.get $item) (local.get $count))
          (then (return (i32.const -1))))
        (local.set $i (local.get $item))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $dmb_item_w (local.get $sw) (local.get $i)))
      (local.set $flags (i32.and (i32.load (local.get $rec)) (i32.const 0x7FFFFFFF)))
      (local.set $sub (i32.const 0))
      (if (i32.and (local.get $flags) (i32.const 0x10))
        (then (local.set $sub
          (call $dynamic_menu_state_w (i32.load offset=12 (local.get $rec))))))
      (if (i32.or (local.get $bypos)
            (i32.and (i32.eqz (i32.and (local.get $flags) (i32.const 0x10)))
              (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $item))))
        (then
          (if (i32.and (local.get $flags) (i32.const 0x10))
            (then
              (if (i32.eqz (local.get $sub)) (then (return (i32.const -1))))
              (return (i32.or (i32.and (local.get $flags) (i32.const 0xFF))
                (i32.shl (i32.and (i32.load offset=4 (local.get $sub)) (i32.const 0xFF))
                  (i32.const 8))))))
          (return (local.get $flags))))
      (if (local.get $sub)
        (then
          (local.set $r (call $dynamic_menu_query_state
            (local.get $sub) (local.get $item) (i32.const 0)))
          (if (i32.ne (local.get $r) (i32.const -1))
            (then (return (local.get $r))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $menu_handle_item_state (export "menu_handle_item_state")
        (param $hmenu i32) (param $pos i32) (result i32)
    (local $hwnd i32) (local $top i32) (local $sw i32)
    (local.set $sw (call $menu_query_dynamic_w (local.get $hmenu)))
    (if (local.get $sw)
      (then (return (call $dynamic_menu_query_state
        (local.get $sw) (local.get $pos) (i32.const 1)))))
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const -1))))
    (local.set $top (call $menu_handle_top_index (local.get $hwnd) (local.get $hmenu)))
    (if (i32.lt_s (local.get $top) (i32.const 0)) (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $pos) (call $menu_child_count (local.get $hwnd) (local.get $top)))
      (then (return (i32.const -1))))
    (call $menu_flags_to_mf
      (call $menu_child_flags (local.get $hwnd) (local.get $top) (local.get $pos))))

  ;; Same, addressed by command id rather than position -- MF_BYCOMMAND.
  (func $menu_handle_state_by_id (export "menu_handle_state_by_id")
        (param $hmenu i32) (param $id i32) (result i32)
    (local $hwnd i32) (local $bar i32) (local $bars i32)
    (local $i i32) (local $n i32) (local $sw i32)
    (local $blob i32) (local $hdr i32) (local $flags i32)
    (local.set $sw (call $menu_query_dynamic_w (local.get $hmenu)))
    (if (local.get $sw)
      (then (return (call $dynamic_menu_query_state
        (local.get $sw) (local.get $id) (i32.const 0)))))
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const -1))))
    (local.set $bars (call $menu_bar_count (local.get $hwnd)))
    (block $done
      (loop $tops
        (br_if $done (i32.ge_s (local.get $bar) (local.get $bars)))
        (local.set $n (call $menu_child_count (local.get $hwnd) (local.get $bar)))
        (local.set $i (i32.const 0))
        (block $next (loop $items
          (br_if $next (i32.ge_u (local.get $i) (local.get $n)))
          (if (i32.eq (call $menu_child_id (local.get $hwnd) (local.get $bar) (local.get $i))
                      (local.get $id))
            (then (return (call $menu_flags_to_mf
              (call $menu_child_flags (local.get $hwnd) (local.get $bar) (local.get $i))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $items)))
        (local.set $bar (i32.add (local.get $bar) (i32.const 1)))
        (br $tops)))
    ;; Not a dropdown item: by command id also searches cascaded popups.
    (local.set $blob (call $menu_dropdown_blob_w (local.get $hwnd)))
    (if (i32.eqz (local.get $blob)) (then (return (i32.const -1))))
    (local.set $bar (i32.const 0))
    (block $cdone
      (loop $ctops
        (br_if $cdone (i32.ge_s (local.get $bar) (local.get $bars)))
        (local.set $hdr (call $child_hdr_w (local.get $blob) (local.get $bar)))
        (if (local.get $hdr)
          (then
            (local.set $flags (call $menu_group_find_flags
              (local.get $blob) (local.get $hdr) (local.get $id)))
            (if (i32.ne (local.get $flags) (i32.const -1))
              (then (return (call $menu_flags_to_mf (local.get $flags)))))))
        (local.set $bar (i32.add (local.get $bar) (i32.const 1)))
        (br $ctops)))
    (i32.const -1))

  ;; Blob flags of the item with command id $id in the popup at $hdr or any
  ;; popup cascaded below it, or -1.
  (func $menu_group_find_flags
        (param $blob i32) (param $hdr i32) (param $id i32) (result i32)
    (local $count i32) (local $i i32) (local $it i32) (local $child_off i32)
    (local $r i32)
    (local.set $count (i32.load (local.get $hdr)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $it (i32.add (local.get $hdr)
        (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 28)))))
      (if (i32.eq (i32.load offset=20 (local.get $it)) (local.get $id))
        (then (return (i32.load offset=16 (local.get $it)))))
      (local.set $child_off (i32.load offset=24 (local.get $it)))
      (if (local.get $child_off)
        (then
          (local.set $r (call $menu_group_find_flags
            (local.get $blob) (i32.add (local.get $blob) (local.get $child_off))
            (local.get $id)))
          (if (i32.ne (local.get $r) (i32.const -1)) (then (return (local.get $r))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Resolve a handle+item pair to (top index, child index). Returns -1 in the
  ;; high half when the item is not found. Packed because WAT has no tuples:
  ;; (top << 16) | child, or -1.
  (func $menu_handle_locate (param $hmenu i32) (param $item i32) (param $by_pos i32) (result i32)
    (local $hwnd i32) (local $top i32) (local $bar i32) (local $bars i32)
    (local $i i32) (local $n i32)
    (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const -1))))
    (if (local.get $by_pos)
      (then
        (local.set $top (call $menu_handle_top_index (local.get $hwnd) (local.get $hmenu)))
        (if (i32.lt_s (local.get $top) (i32.const 0)) (then (return (i32.const -1))))
        (if (i32.ge_u (local.get $item) (call $menu_child_count (local.get $hwnd) (local.get $top)))
          (then (return (i32.const -1))))
        (return (i32.or (i32.shl (local.get $top) (i32.const 16)) (local.get $item)))))
    ;; By command id: the id is unique across the whole menu, so scan it all.
    (local.set $bars (call $menu_bar_count (local.get $hwnd)))
    (block $done
      (loop $tops
        (br_if $done (i32.ge_s (local.get $bar) (local.get $bars)))
        (local.set $n (call $menu_child_count (local.get $hwnd) (local.get $bar)))
        (local.set $i (i32.const 0))
        (block $next (loop $items
          (br_if $next (i32.ge_u (local.get $i) (local.get $n)))
          (if (i32.eq (call $menu_child_id (local.get $hwnd) (local.get $bar) (local.get $i))
                      (local.get $item))
            (then (return (i32.or (i32.shl (local.get $bar) (i32.const 16)) (local.get $i)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $items)))
        (local.set $bar (i32.add (local.get $bar) (i32.const 1)))
        (br $tops)))
    (i32.const -1))

  ;; GetMenuString's body. $out_wa is a linear address; $cch counts bytes
  ;; including the terminator, as Windows does. Returns characters copied.
  (func $menu_handle_copy_label (export "menu_handle_copy_label")
        (param $hmenu i32) (param $item i32) (param $by_pos i32)
        (param $out_wa i32) (param $cch i32) (result i32)
    (local $hwnd i32) (local $loc i32) (local $top i32) (local $child i32)
    (local $src i32) (local $len i32) (local $dyn i32) (local $idx i32) (local $rec i32)
    (block $found
      ;; A CreatePopupMenu handle belongs to no window, so the lookup below
      ;; could never resolve one and every app that read back a label it had
      ;; just appended got an empty string. Answer from the item records.
      (local.set $dyn (call $dynamic_menu_state_w (local.get $hmenu)))
      (if (local.get $dyn)
        (then
          (local.set $idx
            (if (result i32) (local.get $by_pos)
              (then (local.get $item))
              (else (call $dynamic_menu_index_of_id (local.get $dyn) (local.get $item)))))
          (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
          (if (i32.ge_u (local.get $idx) (i32.load offset=4 (local.get $dyn)))
            (then (return (i32.const 0))))
          (local.set $rec (i32.add (local.get $dyn)
            (i32.add (i32.const 16)
              (i32.mul (local.get $idx) (global.get $DYNAMIC_MENU_ITEM_BYTES)))))
          (local.set $src (call $dynamic_item_label_w (local.get $rec)))
          (if (i32.eqz (local.get $src)) (then (return (i32.const 0))))
          ;; Win32 hands back the whole string it was given, shortcut included.
          (local.set $len (call $strlen (local.get $src)))
          (br $found)))
      (local.set $hwnd (call $menu_hwnd_from_handle (local.get $hmenu)))
      (if (i32.eqz (local.get $hwnd)) (then (return (i32.const 0))))
      (local.set $loc (call $menu_handle_locate
        (local.get $hmenu) (local.get $item) (local.get $by_pos)))
      (if (i32.eq (local.get $loc) (i32.const -1)) (then (return (i32.const 0))))
      (local.set $top (i32.shr_u (local.get $loc) (i32.const 16)))
      (local.set $child (i32.and (local.get $loc) (i32.const 0xFFFF)))
      (local.set $src (call $menu_child_label_ptr
        (local.get $hwnd) (local.get $top) (local.get $child)))
      (local.set $len (call $menu_child_label_len
        (local.get $hwnd) (local.get $top) (local.get $child))))
    ;; A NULL buffer means "just tell me how long it is".
    (if (i32.eqz (local.get $out_wa)) (then (return (local.get $len))))
    (if (i32.eqz (local.get $cch)) (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $len) (local.get $cch))
      (then (local.set $len (i32.sub (local.get $cch) (i32.const 1)))))
    (if (local.get $len)
      (then (call $memcpy (local.get $out_wa) (local.get $src) (local.get $len))))
    (i32.store8 (i32.add (local.get $out_wa) (local.get $len)) (i32.const 0))
    (local.get $len))

  ;; Opening a dropdown is an app's cue to bring the menu up to date, and it
  ;; was never given: WM_INITMENU and WM_INITMENUPOPUP were not sent by
  ;; anything. That is where every MFC app runs its ON_UPDATE_COMMAND_UI
  ;; handlers, so their menus showed whatever state the resource shipped with
  ;; -- Paint offered File > Send... in black on a machine with no mail
  ;; subsystem, and clicking it correctly did nothing, which reads from the
  ;; outside exactly like a broken command.
  ;;
  ;; These are posted rather than sent. A dropdown stays open for many frames
  ;; and is repainted from this model each time, so the app's EnableMenuItem
  ;; calls land well before anyone can pick an item -- and posting avoids
  ;; re-entering a guest wndproc from inside the click that opened the menu.
  ;;
  ;; The submenu handle follows GetSubMenu's encoding, (hmenu & 0xFFFF) |
  ;; ((pos+1) << 16), so an app that stashes what GetSubMenu gave it compares
  ;; equal to what arrives here. A bar the app built from dynamic menus has
  ;; real popup handles, and GetSubMenu returns those, so this does too.
  (func $menu_init_popup (param $hwnd i32) (param $top_idx i32)
    (local $hmenu i32) (local $popup i32)
    (local.set $hmenu (call $menu_source_get (local.get $hwnd)))
    (if (i32.eqz (local.get $hmenu))
      (then (local.set $hmenu (i32.const 0x80001))))
    (local.set $popup
      (if (result i32) (call $dynamic_menu_state_w (local.get $hmenu))
        (then (call $menu_handle_submenu (local.get $hmenu) (local.get $top_idx)))
        (else (i32.or (i32.and (local.get $hmenu) (i32.const 0xFFFF))
                (i32.shl (i32.add (local.get $top_idx) (i32.const 1)) (i32.const 16))))))
    (call $menu_post (local.get $hwnd) (i32.const 0x0116)   ;; WM_INITMENU
      (local.get $hmenu) (i32.const 0))
    (call $menu_post (local.get $hwnd) (i32.const 0x0117)   ;; WM_INITMENUPOPUP
      (local.get $popup) (local.get $top_idx)))

  (func $menu_open (export "menu_open") (param $hwnd i32) (param $top_idx i32)
    (call $menu_track_finish)
    (if (global.get $menu_open_popup_blob)
      (then
        (call $heap_free (global.get $menu_open_popup_blob))
        (global.set $menu_open_popup_blob (i32.const 0))))
    (global.set $menu_open_dynamic_hmenu (i32.const 0))
    (global.set $menu_open_hwnd  (local.get $hwnd))
    (global.set $menu_open_top   (local.get $top_idx))
    (global.set $menu_open_hover (i32.const -1))
    (global.set $menu_open_sub_hover (i32.const -1))
    (global.set $menu_open_x     (i32.const -1))
    (global.set $menu_open_y     (i32.const -1))
    (call $menu_init_popup (local.get $hwnd) (local.get $top_idx)))

  (func $menu_track_popup_open (export "menu_track_popup_open")
        (param $hmenu i32) (param $flags i32) (param $x i32) (param $y i32) (param $hwnd i32)
        (result i32)
    (local $menu_id i32) (local $top_idx i32)
    ;; A new popup replaces any open one. An outstanding TPM_RETURNCMD call
    ;; then completes as dismissed, the way USER ends one menu loop.
    (call $menu_track_finish)
    (if (call $dynamic_menu_state_w (local.get $hmenu))
      (then
        (if (global.get $menu_open_popup_blob)
          (then
            (call $heap_free (global.get $menu_open_popup_blob))
            (global.set $menu_open_popup_blob (i32.const 0))))
        (global.set $menu_open_popup_blob
          (call $dynamic_menu_make_popup_blob (local.get $hmenu)))
        (if (i32.eqz (global.get $menu_open_popup_blob))
          (then (return (i32.const 0))))
        (global.set $menu_open_dynamic_hmenu (local.get $hmenu))
        (global.set $menu_open_hwnd  (local.get $hwnd))
        (global.set $menu_open_top   (i32.const 0))
        (global.set $menu_open_hover (i32.const -1))
        (global.set $menu_open_sub_hover (i32.const -1))
        (global.set $menu_open_x     (local.get $x))
        (global.set $menu_open_y     (local.get $y))
        (return (i32.const 1))))
    (if (global.get $menu_open_popup_blob)
      (then
        (call $heap_free (global.get $menu_open_popup_blob))
        (global.set $menu_open_popup_blob (i32.const 0))))
    (global.set $menu_open_dynamic_hmenu (i32.const 0))
    (local.set $menu_id (i32.and (local.get $hmenu) (i32.const 0xFFFF)))
    (local.set $top_idx (i32.sub (i32.and (i32.shr_u (local.get $hmenu) (i32.const 16)) (i32.const 0xFFFF)) (i32.const 1)))
    (if (i32.or (i32.eqz (local.get $menu_id)) (i32.lt_s (local.get $top_idx) (i32.const 0)))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $menu_id) (global.get $last_load_menu_id))
      (then
        (call $push_rsrc_ctx (global.get $last_load_menu_hinst))
        (call $menu_load (local.get $hwnd) (local.get $menu_id))
        (call $pop_rsrc_ctx))
      (else
        (call $menu_load (local.get $hwnd) (local.get $menu_id))))
    (if (i32.eqz (call $menu_child_count (local.get $hwnd) (local.get $top_idx)))
      (then (return (i32.const 0))))
    (global.set $menu_open_hwnd  (local.get $hwnd))
    (global.set $menu_open_top   (local.get $top_idx))
    (global.set $menu_open_hover (i32.const -1))
    (global.set $menu_open_sub_hover (i32.const -1))
    (global.set $menu_open_x     (local.get $x))
    (global.set $menu_open_y     (local.get $y))
    (i32.const 1))

  ;; An open TPM_RETURNCMD popup is closing, with or without a pick.
  (func $menu_track_finish
    (if (i32.eq (global.get $menu_track_state) (i32.const 1))
      (then (global.set $menu_track_state (i32.const 2)))))

  ;; Is the guest parked in a TPM_RETURNCMD TrackPopupMenu? Hosts exempt that
  ;; wait from their stalled-wire cap: it lasts as long as the user looks.
  (func (export "menu_track_parked") (result i32)
    (i32.eq (global.get $menu_track_state) (i32.const 1)))

  (func $menu_close (export "menu_close")
    (call $menu_track_finish)
    (if (global.get $menu_open_popup_blob)
      (then
        (call $heap_free (global.get $menu_open_popup_blob))
        (global.set $menu_open_popup_blob (i32.const 0))))
    (global.set $menu_open_dynamic_hmenu (i32.const 0))
    (global.set $menu_open_hwnd  (i32.const 0))
    (global.set $menu_open_top   (i32.const -1))
    (global.set $menu_open_hover (i32.const -1))
    (global.set $menu_open_sub_hover (i32.const -1))
    (global.set $menu_open_x     (i32.const -1))
    (global.set $menu_open_y     (i32.const -1)))

  (func (export "menu_set_hover") (param $cidx i32)
    (global.set $menu_open_hover (local.get $cidx))
    (global.set $menu_open_sub_hover (i32.const -1)))

  ;; Activate a top-level command item, if the bar slot is a command
  ;; instead of a popup. Returns 1 when a command was posted.
  (func $menu_activate_bar_command (export "menu_activate_bar_command")
        (param $hwnd i32) (param $top_idx i32) (result i32)
    (local $id i32)
    (if (call $menu_child_count (local.get $hwnd) (local.get $top_idx))
      (then (return (i32.const 0))))
    (local.set $id (call $menu_bar_id (local.get $hwnd) (local.get $top_idx)))
    (if (i32.eqz (local.get $id)) (then (return (i32.const 0))))
    ;; Command IDs are application-defined. Let the window procedure decide
    ;; whether a command exits; Globe, for example, uses 28 for File -> Go.
    (call $menu_post (local.get $hwnd) (i32.const 0x0111) (local.get $id) (i32.const 0))
    (call $menu_close)
    (i32.const 1))

  ;; USER-side click routing for an already-open dropdown. The host supplies
  ;; only the browser/screen point; WAT owns menu hit testing, hover, command
  ;; activation, and close/switch behavior.
  (func $menu_handle_mouse_open (export "menu_handle_mouse_open")
        (param $sx i32) (param $sy i32) (result i32)
    (local $hwnd i32) (local $top i32)
    (local $bar_x i32) (local $bar_y i32) (local $bar_h i32)
    (local $dx i32) (local $dy i32) (local $idx i32)
    (local $sdx i32) (local $sdy i32) (local $dw i32)
    (local.set $hwnd (global.get $menu_open_hwnd))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const 0))))
    (local.set $top (global.get $menu_open_top))
    (local.set $bar_x (call $menu_bar_screen_x (local.get $hwnd)))
    (local.set $bar_y (call $menu_bar_screen_y (local.get $hwnd)))
    (local.set $bar_h (call $menu_bar_screen_h))
    (local.set $dx (call $menu_dropdown_x (local.get $hwnd) (local.get $top)))
    (local.set $dy (call $menu_dropdown_y (local.get $hwnd)))
    (local.set $dw (call $menu_dropdown_width (local.get $hwnd) (local.get $top)))

    (local.set $idx (call $menu_hittest_dropdown
      (local.get $hwnd) (local.get $top)
      (local.get $dx) (local.get $dy)
      (local.get $sx) (local.get $sy)))
    (if (i32.ge_s (local.get $idx) (i32.const 0))
      (then
        (global.set $menu_open_hover (local.get $idx))
        (global.set $menu_open_sub_hover (i32.const -1))
        (drop (call $menu_activate))
        (return (i32.const 1))))

    (if (i32.ge_s (global.get $menu_open_hover) (i32.const 0))
      (then
        (local.set $sdx (i32.add (local.get $dx) (local.get $dw)))
        (local.set $sdy
          (i32.add (i32.add (local.get $dy) (i32.const 2))
                   (i32.mul (global.get $menu_open_hover) (i32.const 20))))
        (local.set $idx (call $menu_hittest_submenu
          (local.get $hwnd) (local.get $top) (global.get $menu_open_hover)
          (local.get $sdx) (local.get $sdy)
          (local.get $sx) (local.get $sy)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (global.set $menu_open_sub_hover (local.get $idx))
            (drop (call $menu_activate))
            (return (i32.const 1))))))

    ;; TrackPopupMenu popups have an explicit screen anchor. They are not a
    ;; menubar tracking session, so an outside click must dismiss them instead
    ;; of switching to another top-level menu item in the same resource.
    (if (i32.lt_s (global.get $menu_open_x) (i32.const 0))
      (then
        (local.set $idx (call $menu_hittest_bar
          (local.get $hwnd) (local.get $bar_x) (local.get $bar_y)
          (local.get $sx) (local.get $sy)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (if (call $menu_activate_bar_command (local.get $hwnd) (local.get $idx))
              (then (return (i32.const 1))))
            (call $menu_open (local.get $hwnd) (local.get $idx))
            (return (i32.const 1))))))

    (call $menu_close)
    (i32.const 1))

  ;; Hover update for an open dropdown. Returns the resulting hover index
  ;; (or -1) after updating WAT tracking state.
  (func $menu_hover_from_point (export "menu_hover_from_point")
        (param $sx i32) (param $sy i32) (result i32)
    (local $hwnd i32) (local $top i32)
    (local $bar_x i32) (local $bar_y i32) (local $bar_h i32)
    (local $dx i32) (local $dy i32) (local $idx i32)
    (local $sdx i32) (local $sdy i32) (local $subn i32)
    (local $dw i32) (local $sw i32)
    (local.set $hwnd (global.get $menu_open_hwnd))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const -1))))
    (local.set $top (global.get $menu_open_top))
    (local.set $bar_x (call $menu_bar_screen_x (local.get $hwnd)))
    (local.set $bar_y (call $menu_bar_screen_y (local.get $hwnd)))
    (local.set $bar_h (call $menu_bar_screen_h))
    (local.set $dx (call $menu_dropdown_x (local.get $hwnd) (local.get $top)))
    (local.set $dy (call $menu_dropdown_y (local.get $hwnd)))
    (local.set $dw (call $menu_dropdown_width (local.get $hwnd) (local.get $top)))
    ;; When a cascading submenu is open, prefer the submenu tracking region
    ;; over lower parent rows on the right side of the dropdown. Otherwise a
    ;; diagonal move toward "2 Players" can briefly hit "&Sounds" and close
    ;; the cascade before the cursor reaches the child menu.
    (if (i32.ge_s (global.get $menu_open_hover) (i32.const 0))
      (then
        (local.set $subn (call $menu_child_sub_count
          (local.get $hwnd) (local.get $top) (global.get $menu_open_hover)))
        (if (i32.gt_s (local.get $subn) (i32.const 0))
          (then
            (local.set $sdx (i32.add (local.get $dx) (local.get $dw)))
            (local.set $sw (call $menu_submenu_width
              (local.get $hwnd) (local.get $top) (global.get $menu_open_hover)))
            (local.set $sdy
              (i32.add (i32.add (local.get $dy) (i32.const 2))
                       (i32.mul (global.get $menu_open_hover) (i32.const 20))))
            (local.set $idx
              (i32.and
                (i32.and
                  (i32.ge_s (local.get $sx)
                    (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 60))))
                  (i32.lt_s (local.get $sx)
                    (i32.add (local.get $sdx) (i32.sub (local.get $sw) (i32.const 2)))))
                (i32.and
                  (i32.ge_s (local.get $sy) (local.get $sdy))
                  (i32.lt_s (local.get $sy)
                    (i32.add (local.get $sdy)
                      (i32.add (i32.mul (local.get $subn) (i32.const 20))
                               (i32.const 4)))))))
            (if (local.get $idx)
              (then
                (local.set $idx (call $menu_hittest_submenu
                  (local.get $hwnd) (local.get $top) (global.get $menu_open_hover)
                  (local.get $sdx) (local.get $sdy)
                  (local.get $sx) (local.get $sy)))
                (if (i32.ge_s (local.get $idx) (i32.const 0))
                  (then (global.set $menu_open_sub_hover (local.get $idx))))
                (return (global.get $menu_open_hover))))))))
    (local.set $idx (call $menu_hittest_dropdown
      (local.get $hwnd) (local.get $top)
      (local.get $dx) (local.get $dy)
      (local.get $sx) (local.get $sy)))
    (if (i32.ge_s (local.get $idx) (i32.const 0))
      (then
        (global.set $menu_open_hover (local.get $idx))
        (global.set $menu_open_sub_hover (i32.const -1))
        (return (local.get $idx))))
    (if (i32.ge_s (global.get $menu_open_hover) (i32.const 0))
      (then
        (local.set $sdx (i32.add (local.get $dx) (local.get $dw)))
        (local.set $sw (call $menu_submenu_width
          (local.get $hwnd) (local.get $top) (global.get $menu_open_hover)))
        (local.set $sdy
          (i32.add (i32.add (local.get $dy) (i32.const 2))
                   (i32.mul (global.get $menu_open_hover) (i32.const 20))))
        (local.set $idx (call $menu_hittest_submenu
          (local.get $hwnd) (local.get $top) (global.get $menu_open_hover)
          (local.get $sdx) (local.get $sdy)
          (local.get $sx) (local.get $sy)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (global.set $menu_open_sub_hover (local.get $idx))
            (return (global.get $menu_open_hover))))
        ;; Keep the parent submenu open while the pointer crosses the small
        ;; non-client gap between the parent item and its cascading submenu.
        (local.set $subn (call $menu_child_sub_count
          (local.get $hwnd) (local.get $top) (global.get $menu_open_hover)))
        (local.set $idx
          (i32.and
            (i32.gt_s (local.get $subn) (i32.const 0))
            (i32.and
              (i32.and
                (i32.ge_s (local.get $sx)
                  (i32.add (local.get $dx) (i32.sub (local.get $dw) (i32.const 2))))
                (i32.lt_s (local.get $sx)
                  (i32.add (local.get $sdx) (i32.sub (local.get $sw) (i32.const 2)))))
              (i32.and
                (i32.ge_s (local.get $sy) (local.get $sdy))
                (i32.lt_s (local.get $sy)
                  (i32.add (local.get $sdy)
                    (i32.add (i32.mul (local.get $subn) (i32.const 20))
                             (i32.const 4))))))))
        (if (local.get $idx)
          (then (return (global.get $menu_open_hover))))))
    (global.set $menu_open_hover (i32.const -1))
    (global.set $menu_open_sub_hover (i32.const -1))
    (i32.const -1))

  ;; Open a top-level menu item for a particular hwnd and point. Used by the
  ;; browser event shell after it has already selected the top-level window.
  (func $menu_handle_bar_click (export "menu_handle_bar_click")
        (param $hwnd i32) (param $sx i32) (param $sy i32) (result i32)
    (local $idx i32) (local $cmd i32)
    (local.set $cmd (call $menu_hittest_mdi_buttons (local.get $hwnd) (local.get $sx) (local.get $sy)))
    ;; -1 is a disabled button: the click lands on it and does nothing.
    (if (local.get $cmd)
      (then
        (if (i32.ne (local.get $cmd) (i32.const -1))
          (then (call $menu_post (call $mdi_frame_maximized_child (local.get $hwnd))
            (i32.const 0x0112) (local.get $cmd) (i32.const 0))))
        (return (i32.const 1))))
    (local.set $idx (call $menu_hittest_bar
      (local.get $hwnd)
      (call $menu_bar_screen_x (local.get $hwnd))
      (call $menu_bar_screen_y (local.get $hwnd))
      (local.get $sx) (local.get $sy)))
    (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
    (if (call $menu_activate_bar_command (local.get $hwnd) (local.get $idx))
      (then (return (i32.const 1))))
    (call $menu_open (local.get $hwnd) (local.get $idx))
    (i32.const 1))

  ;; Down/Up arrow nav: walk to next selectable child, wrapping. $dir
  ;; is +1 (Down) or -1 (Up).
  (func $menu_advance (export "menu_advance") (param $dir i32)
    (local $n i32) (local $i i32) (local $k i32) (local $f i32)
    (local.set $n (call $menu_track_child_count))
    (if (i32.eqz (local.get $n)) (then (return)))
    (local.set $i (global.get $menu_open_hover))
    (if (i32.lt_s (local.get $i) (i32.const 0))
      (then (local.set $i (select (i32.const -1) (local.get $n)
                                  (i32.gt_s (local.get $dir) (i32.const 0))))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $k) (local.get $n)))
      (local.set $i (i32.add (local.get $i) (local.get $dir)))
      (if (i32.lt_s (local.get $i) (i32.const 0))
        (then (local.set $i (i32.sub (local.get $n) (i32.const 1)))))
      (if (i32.ge_s (local.get $i) (local.get $n))
        (then (local.set $i (i32.const 0))))
      (local.set $f (call $menu_child_flags
                     (global.get $menu_open_hwnd)
                     (global.get $menu_open_top)
                     (local.get $i)))
      (if (i32.eqz (i32.and (local.get $f) (i32.const 0x03)))
        (then
          (global.set $menu_open_hover (local.get $i))
          (global.set $menu_open_sub_hover (i32.const -1))
          (return)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $scan))))

  (func $menu_sub_advance (param $dir i32)
    (local $n i32) (local $i i32) (local $k i32) (local $f i32)
    (local.set $n (call $menu_sub_track_child_count))
    (if (i32.eqz (local.get $n)) (then (return)))
    (local.set $i (global.get $menu_open_sub_hover))
    (if (i32.lt_s (local.get $i) (i32.const 0))
      (then (local.set $i (select (i32.const -1) (local.get $n)
                                  (i32.gt_s (local.get $dir) (i32.const 0))))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $k) (local.get $n)))
      (local.set $i (i32.add (local.get $i) (local.get $dir)))
      (if (i32.lt_s (local.get $i) (i32.const 0))
        (then (local.set $i (i32.sub (local.get $n) (i32.const 1)))))
      (if (i32.ge_s (local.get $i) (local.get $n))
        (then (local.set $i (i32.const 0))))
      (local.set $f (call $menu_subchild_flags
        (global.get $menu_open_hwnd)
        (global.get $menu_open_top)
        (global.get $menu_open_hover)
        (local.get $i)))
      (if (i32.eqz (i32.and (local.get $f) (i32.const 0x03)))
        (then
          (global.set $menu_open_sub_hover (local.get $i))
          (return)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $scan))))

  ;; Left/Right arrow nav: switch to neighbor bar item, wrapping.
  (func $menu_switch_top (export "menu_switch_top") (param $dir i32)
    (local $n i32) (local $i i32)
    (if (i32.eqz (global.get $menu_open_hwnd)) (then (return)))
    (local.set $n (call $menu_bar_count (global.get $menu_open_hwnd)))
    (if (i32.eqz (local.get $n)) (then (return)))
    (local.set $i (i32.add (global.get $menu_open_top) (local.get $dir)))
    (if (i32.lt_s (local.get $i) (i32.const 0))
      (then (local.set $i (i32.sub (local.get $n) (i32.const 1)))))
    (if (i32.ge_s (local.get $i) (local.get $n))
      (then (local.set $i (i32.const 0))))
    (global.set $menu_open_top (local.get $i))
    (global.set $menu_open_hover (i32.const -1))
    (global.set $menu_open_sub_hover (i32.const -1))
    (global.set $menu_open_x     (i32.const -1))
    (global.set $menu_open_y     (i32.const -1)))

  ;; Keyboard routing for an already-open dropdown. Returns 1 when the key was
  ;; consumed by USER menu tracking.
  (func $menu_handle_key_open (export "menu_handle_key_open")
        (param $vk i32) (result i32)
    (if (i32.eqz (global.get $menu_open_hwnd)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $vk) (i32.const 27))
      (then (call $menu_close) (return (i32.const 1))))     ;; Escape
    (if (i32.eq (local.get $vk) (i32.const 40))
      (then
        (if (i32.ge_s (global.get $menu_open_sub_hover) (i32.const 0))
          (then (call $menu_sub_advance (i32.const 1)))
          (else (call $menu_advance (i32.const 1))))
        (return (i32.const 1))))  ;; Down
    (if (i32.eq (local.get $vk) (i32.const 38))
      (then
        (if (i32.ge_s (global.get $menu_open_sub_hover) (i32.const 0))
          (then (call $menu_sub_advance (i32.const -1)))
          (else (call $menu_advance (i32.const -1))))
        (return (i32.const 1)))) ;; Up
    (if (i32.eq (local.get $vk) (i32.const 39))
      (then
        (if (call $menu_sub_track_child_count)
          (then
            (global.set $menu_open_sub_hover (call $menu_sub_first_selectable)))
          (else
            (if (i32.lt_s (global.get $menu_open_x) (i32.const 0))
              (then (call $menu_switch_top (i32.const 1))))))
        (return (i32.const 1))))  ;; Right
    (if (i32.eq (local.get $vk) (i32.const 37))
      (then
        (if (i32.ge_s (global.get $menu_open_sub_hover) (i32.const 0))
          (then (global.set $menu_open_sub_hover (i32.const -1)))
          (else
            (if (i32.lt_s (global.get $menu_open_x) (i32.const 0))
              (then (call $menu_switch_top (i32.const -1))))))
        (return (i32.const 1)))) ;; Left
    (if (i32.eq (local.get $vk) (i32.const 13))
      (then (drop (call $menu_activate)) (return (i32.const 1)))) ;; Enter
    (if (i32.and
          (i32.ge_s (local.get $vk) (i32.const 65))
          (i32.le_s (local.get $vk) (i32.const 90)))
      (then
        (if (call $menu_handle_letter (local.get $vk))
          (then (return (i32.const 1))))))
    (i32.const 0))

  ;; Internal: enqueue a posted message for hwnd. This is a UI-originated
  ;; command and may be produced outside the owning guest instance, so always
  ;; use the shared per-thread queue rather than the local post-count global.
  ;;
  ;; Real USER tracks a menu synchronously inside the owner's DefWindowProc;
  ;; ours runs on host input while the guest may be busy elsewhere, so the
  ;; result can sit in the queue until some unrelated pump -- typically a
  ;; modal loop that has just disabled the owner -- retrieves it. The tag
  ;; lets retrieval discard it then, as Windows discards input aimed at a
  ;; disabled window (Civ2 Win16: Save Game ran nested inside the AI news
  ;; box's modal and wedged it).
  (func $menu_post (param $hwnd i32) (param $msg i32)
                    (param $wp i32) (param $lp i32)
    (drop (call $shared_post_queue_enqueue_flags
      (local.get $hwnd) (local.get $msg) (local.get $wp) (local.get $lp)
      (global.get $USER_QUEUE_FLAG_MENU))))

  ;; Activate the currently-hovered child of the open menu. Posts a
  ;; WM_COMMAND to the parent hwnd, then closes the menu. Returns the command
  ;; id that was posted (0 if nothing happened).
  (func $menu_activate (export "menu_activate") (result i32)
    (local $hwnd i32) (local $top i32) (local $hover i32)
    (local $sub i32) (local $f i32) (local $id i32)
    (local.set $hwnd (global.get $menu_open_hwnd))
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const 0))))
    (local.set $top  (global.get $menu_open_top))
    (local.set $hover (global.get $menu_open_hover))
    (if (i32.lt_s (local.get $hover) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $f (call $menu_child_flags (local.get $hwnd) (local.get $top) (local.get $hover)))
    (if (i32.and (local.get $f) (i32.const 0x03))
      (then (return (i32.const 0))))   ;; separator or grayed
    (if (call $menu_child_sub_count (local.get $hwnd) (local.get $top) (local.get $hover))
      (then
        (local.set $sub (global.get $menu_open_sub_hover))
        (if (i32.lt_s (local.get $sub) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $f (call $menu_subchild_flags
                        (local.get $hwnd) (local.get $top) (local.get $hover) (local.get $sub)))
        (if (i32.and (local.get $f) (i32.const 0x03))
          (then (return (i32.const 0))))
        (local.set $id (call $menu_subchild_id
                         (local.get $hwnd) (local.get $top) (local.get $hover) (local.get $sub)))
        (call $menu_deliver_command (local.get $hwnd) (local.get $id))
        (call $menu_close)
        (return (local.get $id))))
    (local.set $id (call $menu_child_id (local.get $hwnd) (local.get $top) (local.get $hover)))
    (call $menu_deliver_command (local.get $hwnd) (local.get $id))
    (call $menu_close)
    (local.get $id))

  ;; A picked command goes back to a TPM_RETURNCMD caller as its return value
  ;; and is not posted; otherwise it is an edit command or a WM_COMMAND.
  (func $menu_deliver_command (param $hwnd i32) (param $id i32)
    (if (i32.eq (global.get $menu_track_state) (i32.const 1))
      (then (global.set $menu_track_result (local.get $id)) (return)))
    (if (call $menu_try_edit_command (local.get $id))
      (then (nop))
      (else (call $menu_post (local.get $hwnd) (i32.const 0x0111) (local.get $id) (i32.const 0)))))

  ;; Find the bar item index whose accelerator char (uppercase ASCII)
  ;; matches $ch, or -1.
  (func $menu_find_bar_accel (export "menu_find_bar_accel") (param $hwnd i32) (param $ch i32) (result i32)
    (local $n i32) (local $i i32)
    (local.set $n (call $menu_bar_count (local.get $hwnd)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (if (i32.eq (call $menu_bar_accel (local.get $hwnd) (local.get $i)) (local.get $ch))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Open the first suitable top-level menu with a matching bar accelerator.
  ;; Prefer the focused window's top-level ancestor, then scan WND_RECORDS in
  ;; reverse slot order as the current z-order proxy.
  (func $menu_open_bar_accel (export "menu_open_bar_accel")
        (param $ch i32) (result i32)
    (local $hwnd i32) (local $idx i32) (local $slot i32) (local $rec i32)
    (local $style i32)
    (if (global.get $focus_hwnd)
      (then
        (local.set $hwnd (call $wnd_top_level (global.get $focus_hwnd)))
        (local.set $idx (call $menu_find_bar_accel (local.get $hwnd) (local.get $ch)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (if (call $menu_activate_bar_command (local.get $hwnd) (local.get $idx))
              (then (return (i32.const 1))))
            (call $menu_open (local.get $hwnd) (local.get $idx))
            (return (i32.const 1))))))
    (local.set $slot (i32.sub (global.get $MAX_WINDOWS) (i32.const 1)))
    (block $done (loop $scan
      (local.set $rec (call $wnd_record_addr (local.get $slot)))
      (local.set $hwnd (load.field WndRecord hwnd (local.get $rec)))
      (if (local.get $hwnd)
        (then
          (local.set $style (call $wnd_get_style (local.get $hwnd)))
          (if (i32.and
                (i32.and
                  (i32.ne (i32.and (local.get $style) (i32.const 0x10000000)) (i32.const 0))
                  (i32.eqz (i32.and (local.get $style) (i32.const 0x40000000))))
                (i32.eq (call $wnd_top_level (local.get $hwnd)) (local.get $hwnd)))
            (then
              (local.set $idx (call $menu_find_bar_accel
                (local.get $hwnd) (local.get $ch)))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  (if (call $menu_activate_bar_command (local.get $hwnd) (local.get $idx))
                    (then (return (i32.const 1))))
                  (call $menu_open (local.get $hwnd) (local.get $idx))
                  (return (i32.const 1))))))))
      (br_if $done (i32.eqz (local.get $slot)))
      (local.set $slot (i32.sub (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Try to activate by child accelerator char while a menu is open.
  ;; Returns 1 if a matching item was found and activated, else 0.
  (func $menu_handle_letter (export "menu_handle_letter") (param $ch i32) (result i32)
    (local $n i32) (local $i i32) (local $f i32)
    (if (i32.eqz (global.get $menu_open_hwnd)) (then (return (i32.const 0))))
    (local.set $n (call $menu_track_child_count))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $f (call $menu_child_flags
                     (global.get $menu_open_hwnd)
                     (global.get $menu_open_top)
                     (local.get $i)))
      (if (i32.eqz (i32.and (local.get $f) (i32.const 0x03)))
        (then
          (if (i32.eq (call $menu_child_accel
                       (global.get $menu_open_hwnd)
                       (global.get $menu_open_top)
                       (local.get $i))
                      (local.get $ch))
            (then
              (global.set $menu_open_hover (local.get $i))
              (drop (call $menu_activate))
              (return (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; ============================================================
  ;; MENU API HANDLERS
  ;; The 35 $handle_* entry points for the menu APIs, moved here from
  ;; 09a-handlers.wat where they were scattered across a dozen places. This file
  ;; already held the 75 menu_* helpers they call and had no entry points of its
  ;; own.
  ;; ============================================================

  ;; 84: DestroyMenu(hMenu) — 1 arg stdcall, return TRUE
  (func $handle_DestroyMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $detached i32)
    (local.set $detached (call $menu_detached_take (local.get $arg0)))
    (if (local.get $detached) (then (local.set $arg0 (local.get $detached))))
    (if (call $dynamic_menu_destroy (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (call $host_menu_destroy (local.get $arg0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 87: GetMenu(hwnd) — return the attached menu's stable resource key.
  (func $handle_GetMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Named class menus use a guest string pointer rather than a low-word
    ;; resource ID. Preserve that identity so SetMenu can reattach the menu
    ;; after an app temporarily removes it (Pinball fullscreen). menu_set's
    ;; legacy host blobs have no source key, so retain the old fake fallback.
    (i32.store offset=0 (global.get $reg_base) (call $menu_source_get (local.get $arg0)))
    (if (i32.and
          (i32.eqz (i32.load offset=0 (global.get $reg_base)))
          (i32.gt_s (call $menu_bar_count (local.get $arg0)) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80001))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 88: GetSubMenu(hMenu, nPos) → HMENU. A command, invalid position, or
  ;; invalid menu returns NULL; dynamic popup items return their retained child.
  (func $handle_GetSubMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_handle_submenu (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 314: GetSystemMenu(hwnd, bRevert) — stdcall(2)
  (func $handle_GetSystemMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x40003))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 113: EnableMenuItem(hMenu, uIDEnableItem, uEnable).
  ;; EnableMenuItem(hMenu, uIDEnableItem, uEnable). MF_BYPOSITION is 0x400 and
  ;; has to be honoured: it is how MFC addresses items while walking a popup,
  ;; and treating a position as a command id put the state on the wrong item.
  ;;
  ;; A CreateMenu/CreatePopupMenu handle is a guest heap pointer, and it has to
  ;; be recognised before the encoded-submenu paths below read its high word
  ;; as a bar index. Civilization II builds every popup this way and greys
  ;; items by position: 0x7EF0xxxx read as dropdown 0x7EEF sent
  ;; $menu_enable_position_global half a megabyte past the bar blob for a
  ;; child offset, and wrote a flags word wherever that pointed -- nothing in
  ;; a fresh session, where the far heap is still zero, and a trap or quiet
  ;; corruption once a long session had filled it.
  (func $handle_EnableMenuItem (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dynamic i32)
    (local.set $dynamic (local.get $arg0))
    (if (i32.eqz (call $dynamic_menu_state_w (local.get $dynamic)))
      (then
        (local.set $dynamic (i32.const 0))
        (if (i32.eqz (call $menu_hwnd_from_handle (local.get $arg0)))
          (then (local.set $dynamic (call $menu_detached_handle (local.get $arg0)))))))
    (if (local.get $dynamic)
      (then
        (i32.store (global.get $reg_base) (call $dynamic_menu_enable
          (local.get $dynamic) (local.get $arg1) (local.get $arg2)))
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.and (local.get $arg2) (i32.const 0x400))
        (then (call $menu_enable_position_global
          (local.get $arg0) (local.get $arg1)
          (i32.ne (i32.and (local.get $arg2) (i32.const 3)) (i32.const 0))))
        (else (call $menu_enable_item_global
          (local.get $arg0) (local.get $arg1) (local.get $arg2)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 121: CheckMenuRadioItem(hMenu, idFirst, idLast, idCheck, uFlags)
  ;; Unchecks items [idFirst..idLast], checks idCheck with radio bullet. Returns TRUE.
  ;; Menu item state is tracked in the renderer's menu model when available.
  (func $handle_CheckMenuRadioItem (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_check_radio_global
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; Check a canonical dynamic tree, including detached LoadMenu trees.
  ;; By-position addresses this level only; by-command descends into popup
  ;; children and stops at the first match. Never search unrelated menus.
  (func $dynamic_menu_check
        (param $hmenu i32) (param $item i32) (param $flags i32) (result i32)
    (local $sw i32) (local $count i32) (local $i i32) (local $rec i32)
    (local $old i32) (local $r i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const -1))))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (if (i32.and (local.get $flags) (i32.const 0x400))
      (then
        (if (i32.ge_u (local.get $item) (local.get $count))
          (then (return (i32.const -1))))
        (local.set $i (local.get $item))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $dmb_item_w (local.get $sw) (local.get $i)))
      (local.set $old (i32.load (local.get $rec)))
      (if (i32.or
            (i32.ne (i32.and (local.get $flags) (i32.const 0x400)) (i32.const 0))
            (i32.and
              (i32.eqz (i32.and (local.get $old) (i32.const 0x10)))
              (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $item))))
        (then
          (i32.store (local.get $rec)
            (i32.or (i32.and (local.get $old) (i32.const -9))
              (i32.and (local.get $flags) (i32.const 8))))
          (call $resource_submenu_binding_refresh (local.get $hmenu))
          (return (i32.and (local.get $old) (i32.const 8)))))
      (if (i32.and (local.get $old) (i32.const 0x10))
        (then
          (local.set $r (call $dynamic_menu_check
            (i32.load offset=12 (local.get $rec)) (local.get $item) (local.get $flags)))
          (if (i32.ne (local.get $r) (i32.const -1))
            (then (return (local.get $r))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; EnableMenuItem on a dynamic menu: set MF_GRAYED|MF_DISABLED (0x3) of the
  ;; item named by position (MF_BYPOSITION 0x400) or by command id, searching
  ;; popups by id as dynamic_menu_check does. Answers the previous state bits,
  ;; or -1 when there is no such item.
  (func $dynamic_menu_enable
        (param $hmenu i32) (param $item i32) (param $flags i32) (result i32)
    (local $sw i32) (local $count i32) (local $i i32) (local $rec i32)
    (local $old i32) (local $r i32)
    (local.set $sw (call $dynamic_menu_state_w (local.get $hmenu)))
    (if (i32.eqz (local.get $sw)) (then (return (i32.const -1))))
    (local.set $count (i32.load offset=4 (local.get $sw)))
    (if (i32.and (local.get $flags) (i32.const 0x400))
      (then
        (if (i32.ge_u (local.get $item) (local.get $count))
          (then (return (i32.const -1))))
        (local.set $i (local.get $item))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $dmb_item_w (local.get $sw) (local.get $i)))
      (local.set $old (i32.load (local.get $rec)))
      (if (i32.or
            (i32.ne (i32.and (local.get $flags) (i32.const 0x400)) (i32.const 0))
            (i32.and
              (i32.eqz (i32.and (local.get $old) (i32.const 0x10)))
              (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $item))))
        (then
          (i32.store (local.get $rec)
            (i32.or (i32.and (local.get $old) (i32.const -4))
              (i32.and (local.get $flags) (i32.const 3))))
          (call $resource_submenu_binding_refresh (local.get $hmenu))
          (return (i32.and (local.get $old) (i32.const 3)))))
      (if (i32.and (local.get $old) (i32.const 0x10))
        (then
          (local.set $r (call $dynamic_menu_enable
            (i32.load offset=12 (local.get $rec)) (local.get $item) (local.get $flags)))
          (if (i32.ne (local.get $r) (i32.const -1))
            (then (return (local.get $r))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; 122: CheckMenuItem(hMenu, uIDCheckItem, uCheck) → previous state.
  ;; Attached resource blobs retain their legacy path below; dynamic and
  ;; detached menus must update their canonical tree before popup tracking.
  (func $handle_CheckMenuItem (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dynamic i32)
    (local.set $dynamic (local.get $arg0))
    (if (i32.eqz (call $dynamic_menu_state_w (local.get $dynamic)))
      (then
        (local.set $dynamic (i32.const 0))
        (if (i32.eqz (call $menu_hwnd_from_handle (local.get $arg0)))
          (then (local.set $dynamic (call $menu_detached_handle (local.get $arg0)))))))
    (if (local.get $dynamic)
      (then
        (i32.store (global.get $reg_base) (call $dynamic_menu_check
          (local.get $dynamic) (local.get $arg1) (local.get $arg2)))
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.and (local.get $arg2) (i32.const 0x400))
      (then (i32.store offset=0 (global.get $reg_base) (call $menu_check_position_global
        (local.get $arg0) (local.get $arg1)
        (i32.and (local.get $arg2) (i32.const 8)))))
      (else (i32.store offset=0 (global.get $reg_base) (call $menu_check_item_global
        (local.get $arg0) (local.get $arg1)
        (i32.and (local.get $arg2) (i32.const 8))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 137: LoadMenuA(hInstance, lpMenuName) — 2 args stdcall.
  ;; Integer resources retain the compact tagged handle. A named resource uses
  ;; its guest pointer as the opaque identity so SetMenu can resolve the same
  ;; name instead of silently substituting ordinal 1.
  (func $handle_LoadMenuA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $last_load_menu_id (local.get $arg1))
    (global.set $last_load_menu_hinst (local.get $arg0))
    (global.set $last_load_menu_wide (i32.const 0))
    ;; If lpMenuName < 0x10000, it's MAKEINTRESOURCE (resource ID)
    (if (i32.lt_u (local.get $arg1) (i32.const 0x10000))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.or (local.get $arg1) (i32.const 0x00BE0000))))
      (else (i32.store offset=0 (global.get $reg_base) (local.get $arg1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; TrackPopupMenu[Ex] core. Returns 1 when the call completed with EAX set
  ;; (the handler then pops its frame), 0 when it parked. Without TPM_RETURNCMD the popup stays open after the call returns
  ;; TRUE and a pick is posted as WM_COMMAND. With it (0x100) the call parks on
  ;; its thunk until the popup closes and returns the picked id, or 0 when it
  ;; was dismissed; SimCity 2000's palette fly-outs read that id.
  (func $menu_track_call (param $hmenu i32) (param $flags i32) (param $x i32) (param $y i32)
        (param $hwnd i32) (result i32)
    (local $ret i32)
    (block $done
      (if (i32.eq (global.get $menu_track_state) (i32.const 2))
        (then
          (local.set $ret (global.get $menu_track_result))
          (global.set $menu_track_state (i32.const 0))
          (br $done)))
      (if (i32.eq (global.get $menu_track_state) (i32.const 1))
        (then (call $menu_track_park) (return (i32.const 0))))
      (local.set $ret (call $menu_track_popup_open
        (local.get $hmenu) (local.get $flags) (local.get $x) (local.get $y) (local.get $hwnd)))
      (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x0100))) (then (br $done)))
      (if (i32.eqz (local.get $ret)) (then (br $done)))
      (global.set $menu_track_result (i32.const 0))
      (global.set $menu_track_state (i32.const 1))
      (call $menu_track_park)
      (return (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (local.get $ret))
    (i32.const 1))

  ;; Leave the stdcall frame on the stack and re-enter this call on the next
  ;; slice, the net-wait park: hosts clear the yield and resume at the thunk.
  (func $menu_track_park
    (global.set $handler_set_eip (i32.const 1))
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $yield_reason (i32.const 8))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; 138: TrackPopupMenuEx(hMenu, uFlags, x, y, hWnd, lptpm)
  (func $handle_TrackPopupMenuEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $menu_track_call (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4))
      (then (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))))
  )

  ;; 292: LoadMenuW — ordinals share the A path; named resources keep the
  ;; pointer identity but select UTF-16 matching for the later SetMenu load.
  (func $handle_LoadMenuW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadMenuA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then (global.set $last_load_menu_wide (i32.const 1))))
  )

  ;; 407: RemoveMenu(hMenu, uPosition, uFlags). Unlike DeleteMenu, a removed
  ;; popup remains owned by the caller.
  (func $handle_RemoveMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_remove_item
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; IsMenu(hMenu) → BOOL.
  (func $handle_IsMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_handle_is_valid (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 619: TrackPopupMenu(hMenu, uFlags, x, y, nReserved, hWnd, prcRect)
  (func $handle_TrackPopupMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa_esp i32) (local $hwnd i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (local.set $hwnd (i32.load (i32.add (local.get $wa_esp) (i32.const 24))))
    (if (call $menu_track_call (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $hwnd))
      (then (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))))
  )

  ;; 620: GetMenuItemID(hMenu, nPos). A NULL id, submenu, invalid menu, or
  ;; invalid position returns -1, matching USER rather than inventing id zero.
  (func $handle_GetMenuItemID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_handle_item_id (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; 2 args
  )

  ;; SetMenuItemInfoA(hMenu, uItem, fByPos, lpmii). Dynamic popup menus retain
  ;; the supported type/state/id/submenu/data/string fields.
  (func $handle_SetMenuItemInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dynamic_menu_item_info_set
      (call $menu_item_info_target (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) ;; 4 args
  )

  ;; GetMenuItemInfoA(hMenu, uItem, fByPos, lpmii). Unsupported menu handle or
  ;; mask combinations return FALSE instead of claiming untouched output.
  (func $handle_GetMenuItemInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dynamic_menu_item_info_get
      (call $menu_item_info_target (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) ;; 4 args
  )

  ;; Wide spellings share the MENUITEMINFO field/mask core. Dynamic menu text
  ;; remains canonical ANSI for the byte-oriented painter, so Set converts a
  ;; UTF-16 label on entry and Get widens it only into the caller's buffer.
  (func $handle_SetMenuItemInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dynamic_menu_item_info_set
      (call $menu_item_info_target (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  (func $handle_GetMenuItemInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dynamic_menu_item_info_get
      (call $menu_item_info_target (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 621: GetMenuItemCount(hMenu) — the menu subsystem is a stub that doesn't
  ;; track items, so report 0 (empty menu) rather than crashing. DX samples
  ;; like flip2d call this during window setup but don't care about the count.
  ;; GetMenuItemCount(hMenu). Returning 0 here is what kept every MFC menu
  ;; stale: CFrameWnd::OnInitMenuPopup walks the popup by index to run its
  ;; ON_UPDATE_COMMAND_UI handlers, and a count of zero means it walks nothing
  ;; and never enables or greys anything. Paint offered File > Send... in black
  ;; on a machine with no mail subsystem because of this.
  (func $handle_GetMenuItemCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_handle_item_count (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) ;; 1 arg stdcall
  )

  ;; 650: DrawMenuBar. Menu chrome is WAT-owned, so redraw it synchronously and
  ;; tell the renderer that the non-client surface changed.
  (func $handle_DrawMenuBar (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src i32)
    (if (i32.eq (call $wnd_table_find (local.get $arg0)) (i32.const -1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        ;; A bar built from CreateMenu/AppendMenu is a snapshot taken at
        ;; SetMenu. Apps edit the live menus afterwards and call DrawMenuBar
        ;; to publish the change -- Civ2 rebuilds every popup with new command
        ;; ids, so a stale snapshot sends WM_COMMAND ids its handler no longer
        ;; knows. Re-serialize from the live tree before repainting.
        (local.set $src (call $menu_source_get (local.get $arg0)))
        (if (i32.ne (local.get $src) (i32.const 0))
          (then (if (call $dynamic_menu_state_w (local.get $src))
            (then (drop (call $menu_set_bar_from_dynamic
              (local.get $arg0) (local.get $src)))))))
        (call $defwndproc_do_ncpaint (local.get $arg0))
        (call $host_invalidate_frame (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 655: AppendMenuW(hMenu, uFlags, uIDNewItem, lpNewItem)
  (func $handle_AppendMenuW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dyn i32)
    (local.set $dyn
      (call $dynamic_menu_append
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (if (i32.ne (local.get $dyn) (i32.const -1))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $dyn)))
      (else
        (i32.store offset=0 (global.get $reg_base) (call $host_menu_append
          (local.get $arg0) (local.get $arg1) (local.get $arg2) (call $g2w (local.get $arg3)) (i32.const 1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; AppendMenuA(hMenu, uFlags, uIDNewItem, lpNewItem) — return TRUE
  (func $handle_AppendMenuA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dyn i32)
    (local.set $dyn
      (call $dynamic_menu_append
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (if (i32.ne (local.get $dyn) (i32.const -1))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $dyn)))
      (else
        (i32.store offset=0 (global.get $reg_base) (call $host_menu_append
          (local.get $arg0) (local.get $arg1) (local.get $arg2) (call $g2w (local.get $arg3)) (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; InsertMenuA(hMenu, uPosition, uFlags, uIDNewItem, lpNewItem)
  ;; MF_BYPOSITION is 0x400; without it uPosition names the item to insert
  ;; before by command id. CreateMenu is host-backed (unlike CreatePopupMenu's
  ;; MNUD table), and VB6 builds menu bars by repeatedly inserting at -1. Feed
  ;; that append form into the existing host tree so SetMenu can serialize the
  ;; completed hierarchy into WAT. Resource-backed menu blobs and non-tail
  ;; host insertion are not mutable yet, so those cases retain the historical
  ;; success/no-op result.
  (func $handle_InsertMenuA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dyn i32)
    (local.set $dyn
      (call $dynamic_menu_insert
        (local.get $arg0)
        (call $dynamic_menu_resolve_pos (local.get $arg0) (local.get $arg1)
          (i32.and (local.get $arg2) (i32.const 0x400)))
        (local.get $arg2) (local.get $arg3)
        (select (local.get $arg4) (i32.const 0)
          (i32.ne (i32.and (local.get $arg2) (i32.const 0x904)) (i32.const 0)))
        (select (i32.const 0) (local.get $arg4)
          (i32.ne (i32.and (local.get $arg2) (i32.const 0x904)) (i32.const 0)))
        ;; MF_POPUP: uIDNewItem is the submenu handle, not a command id.
        (if (result i32) (i32.and (local.get $arg2) (i32.const 0x10))
          (then (local.get $arg3))
          (else (i32.const 0)))))
    (if (i32.ne (local.get $dyn) (i32.const -1))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $dyn)))
      (else
        (if (i32.and
              (i32.ne (i32.and (local.get $arg2) (i32.const 0x400))
                      (i32.const 0))
              (i32.eq (local.get $arg1) (i32.const -1)))
          (then
            (i32.store offset=0 (global.get $reg_base) (call $host_menu_append
              (local.get $arg0) (local.get $arg2) (local.get $arg3)
              (call $g2w (local.get $arg4)) (i32.const 0))))
          (else (i32.store offset=0 (global.get $reg_base) (i32.const 1))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; InsertMenuItemA/W(hMenu, uItem, fByPosition, lpmii)
  ;; Same host fallback as InsertMenuA: a menu bar from CreateMenu is host-backed,
  ;; and Delphi/VB-style code fills it with repeated appends (uItem == -1). Without
  ;; the fallback those items were dropped, so SetMenu serialized an empty tree and
  ;; the window came up with no menu bar at all (tetravex).
  (func $insert_menu_item_common (param $hmenu i32) (param $item i32) (param $bypos i32)
                                 (param $mii i32) (param $wide i32) (result i32)
    (local $dyn i32) (local $flags i32)
    (local.set $flags (call $menu_item_info_decode (local.get $mii)))
    (local.set $dyn
      (call $dynamic_menu_insert
        (local.get $hmenu)
        (call $dynamic_menu_resolve_pos (local.get $hmenu) (local.get $item) (local.get $bypos))
        (local.get $flags) (global.get $mii_out_id) (global.get $mii_out_data)
        (global.get $mii_out_text)
        (global.get $mii_out_submenu)))
    (if (i32.ne (local.get $dyn) (i32.const -1))
      (then (return (local.get $dyn))))
    (if (i32.eq (local.get $item) (i32.const -1))
      (then (return (call $host_menu_append
        (local.get $hmenu) (local.get $flags)
        ;; MF_POPUP: the host stores the submenu handle in the id slot.
        (if (result i32) (global.get $mii_out_submenu)
          (then (global.get $mii_out_submenu))
          (else (global.get $mii_out_id)))
        (if (result i32) (global.get $mii_out_text)
          (then (call $g2w (global.get $mii_out_text)))
          (else
            (if (result i32) (global.get $mii_out_data)
              (then (call $g2w (global.get $mii_out_data)))
              (else (i32.const 0)))))
        (local.get $wide)))))
    (i32.const 1))

  (func $handle_InsertMenuItemA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $insert_menu_item_common
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  (func $handle_InsertMenuItemW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $insert_menu_item_common
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; ModifyMenuA(hMnu, uPosition, uFlags, uIDNewItem, lpNewItem). Dynamic menus
  ;; are replaced in place; immutable/unknown handles fail instead of silently
  ;; preserving stale labels, ids, state, and submenu ownership.
  (func $handle_ModifyMenuA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dynamic_menu_modify
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 656: DeleteMenu(hMenu, uPosition, uFlags). Return FALSE when the requested
  ;; item is absent; callers commonly clear a menu with
  ;; `while (DeleteMenu(menu, 0, MF_BYPOSITION))`.
  (func $handle_DeleteMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_remove_item
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 672: SetMenuItemBitmaps(hMenu, uPosition, uFlags, hBitmapUnchecked,
  ;; hBitmapChecked). The compact menu records do not retain custom checkmark
  ;; artwork yet, but USER32 still has to validate the addressed item and let
  ;; applications continue with the normal checkmark painter.
  (func $handle_SetMenuItemBitmaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $by_position i32)
    (local.set $by_position
      (i32.ne (i32.and (local.get $arg2) (i32.const 0x400)) (i32.const 0)))
    (if (call $dynamic_menu_state_w (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.ne
            (call $dynamic_menu_item_w
              (local.get $arg0) (local.get $arg1) (local.get $by_position))
            (i32.const 0))))
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.ne
            (call $menu_handle_locate
              (local.get $arg0) (local.get $arg1) (local.get $by_position))
            (i32.const -1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 673: ModifyMenuW — item metadata shares the A path. String rendering of
  ;; dynamic W menus retains the existing compatibility representation.
  (func $handle_ModifyMenuW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_ModifyMenuA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; GetMenuState(hMenu, uId, uFlags) → MF_* state, or -1 when the item is not
  ;; there. MF_BYPOSITION is 0x400; without it uId is a command id.
  (func $handle_GetMenuState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.and (local.get $arg2) (i32.const 0x400))
        (then (call $menu_handle_item_state (local.get $arg0) (local.get $arg1)))
        (else (call $menu_handle_state_by_id (local.get $arg0) (local.get $arg1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args
  )

  ;; GetMenuItemRect uses the same geometry that paints and hit-tests menus.
  ;; Windows does not assign meaningful item rectangles until a menu bar is
  ;; attached or a popup is displayed, so hidden dynamic/resource popups fail
  ;; without touching the caller's RECT rather than inventing coordinates.
  (func $menu_get_item_rect
        (param $hwnd_arg i32) (param $hmenu i32) (param $item i32)
        (param $rect_g i32) (result i32)
    (local $owner i32) (local $top_index i32) (local $count i32)
    (local $blob i32) (local $hdc i32) (local $width i32)
    (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $popup_x i32) (local $popup_y i32) (local $rect_w i32)
    (if (i32.eqz (local.get $rect_g)) (then (return (i32.const 0))))

    ;; A CreatePopupMenu handle is meaningful only while that exact popup is
    ;; the dynamic menu currently displayed by TrackPopupMenu.
    (if (call $dynamic_menu_state_w (local.get $hmenu))
      (then
        (if (i32.or
              (i32.eqz (global.get $menu_open_popup_blob))
              (i32.ne (local.get $hmenu) (global.get $menu_open_dynamic_hmenu)))
          (then (return (i32.const 0))))
        (if (i32.and
              (i32.ne (local.get $hwnd_arg) (i32.const 0))
              (i32.ne (local.get $hwnd_arg) (global.get $menu_open_hwnd)))
          (then (return (i32.const 0))))
        (local.set $count
          (call $menu_child_count (global.get $menu_open_hwnd) (i32.const 0)))
        (if (i32.ge_u (local.get $item) (local.get $count))
          (then (return (i32.const 0))))
        (local.set $width
          (call $menu_dropdown_width (global.get $menu_open_hwnd) (i32.const 0)))
        (if (i32.eqz (local.get $width)) (then (return (i32.const 0))))
        (local.set $left (i32.add (global.get $menu_open_x) (i32.const 2)))
        (local.set $top
          (i32.add
            (i32.add (global.get $menu_open_y) (i32.const 2))
            (i32.mul (local.get $item) (i32.const 20))))
        (local.set $right
          (i32.sub (i32.add (global.get $menu_open_x) (local.get $width))
                   (i32.const 2)))
        (local.set $bottom (i32.add (local.get $top) (i32.const 20))))
      (else
        ;; Resource and attached menus resolve back to their owning window.
        ;; The exact attached handle denotes the bar; GetSubMenu's encoded
        ;; handle denotes one popup below it.
        (local.set $owner (call $menu_hwnd_from_handle (local.get $hmenu)))
        (if (i32.eqz (local.get $owner)) (then (return (i32.const 0))))
        (local.set $top_index
          (call $menu_handle_top_index (local.get $owner) (local.get $hmenu)))
        (if (i32.lt_s (local.get $top_index) (i32.const 0))
          (then
            ;; A menu bar is attached to a specific window; NULL or another
            ;; HWND cannot identify its screen placement.
            (if (i32.ne (local.get $hwnd_arg) (local.get $owner))
              (then (return (i32.const 0))))
            (local.set $count (call $menu_bar_count (local.get $owner)))
            (if (i32.ge_u (local.get $item) (local.get $count))
              (then (return (i32.const 0))))
            (local.set $blob (call $menu_blob_w (local.get $owner)))
            (local.set $hdc (call $gdi_menu_overlay_ensure))
            (if (i32.eqz (local.get $hdc)) (then (return (i32.const 0))))
            (drop (call $gdi_native_select_object
              (local.get $hdc) (i32.const 0x30021)))
            (local.set $left
              (i32.add
                (call $menu_bar_screen_x (local.get $owner))
                (call $bar_item_x
                  (local.get $blob) (local.get $hdc) (local.get $item))))
            (local.set $top (call $menu_bar_screen_y (local.get $owner)))
            (local.set $right
              (i32.add (local.get $left)
                (call $bar_item_width
                  (local.get $blob) (local.get $hdc) (local.get $item))))
            (local.set $bottom
              (i32.add (local.get $top) (call $menu_bar_screen_h))))
          (else
            ;; Popup positions exist only while this submenu is displayed.
            (if (i32.or
                  (i32.ge_u (local.get $top_index)
                    (call $menu_bar_count (local.get $owner)))
                  (i32.or
                    (i32.ne (global.get $menu_open_dynamic_hmenu) (i32.const 0))
                    (i32.or
                      (i32.ne (global.get $menu_open_hwnd) (local.get $owner))
                      (i32.ne (global.get $menu_open_top) (local.get $top_index)))))
              (then (return (i32.const 0))))
            (if (i32.and
                  (i32.ne (local.get $hwnd_arg) (i32.const 0))
                  (i32.ne (local.get $hwnd_arg) (local.get $owner)))
              (then (return (i32.const 0))))
            (local.set $count
              (call $menu_child_count (local.get $owner) (local.get $top_index)))
            (if (i32.ge_u (local.get $item) (local.get $count))
              (then (return (i32.const 0))))
            (local.set $width
              (call $menu_dropdown_width (local.get $owner) (local.get $top_index)))
            (if (i32.eqz (local.get $width)) (then (return (i32.const 0))))
            (local.set $popup_x
              (call $menu_dropdown_x (local.get $owner) (local.get $top_index)))
            (local.set $popup_y (call $menu_dropdown_y (local.get $owner)))
            (local.set $left
              (i32.add (local.get $popup_x) (i32.const 2)))
            (local.set $top
              (i32.add
                (i32.add (local.get $popup_y) (i32.const 2))
                (i32.mul (local.get $item) (i32.const 20))))
            (local.set $right
              (i32.sub
                (i32.add (local.get $popup_x) (local.get $width))
                (i32.const 2)))
            (local.set $bottom (i32.add (local.get $top) (i32.const 20)))))))

    ;; Translate the output exactly once, and only after every failure check,
    ;; so a rejected query leaves the caller's buffer unchanged.
    (local.set $rect_w (call $g2w (local.get $rect_g)))
    (i32.store          (local.get $rect_w) (local.get $left))
    (i32.store offset=4 (local.get $rect_w) (local.get $top))
    (i32.store offset=8 (local.get $rect_w) (local.get $right))
    (i32.store offset=12 (local.get $rect_w) (local.get $bottom))
    (i32.const 1))

  ;; 735: GetMenuItemRect(hWnd, hMenu, uItem, lprcItem) -> BOOL
  (func $handle_GetMenuItemRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_get_item_rect
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; Windows 98 classic at 96 DPI uses a square 13px default check bitmap.
  ;; This is a metric, not the wider 20px menu column that includes padding.
  ;; Keep it named so GetSystemMetrics(SM_CXMENUCHECK/SM_CYMENUCHECK) can
  ;; share the same authority when those late Win98 metric IDs are added.
  (func $menu_checkmark_size (result i32)
    (i32.const 13))

  ;; 675: GetMenuCheckMarkDimensions() -> MAKELONG(width, height).
  ;; The Windows 98 classic 96-DPI menu check bitmap is 13x13 pixels.  Keep
  ;; this distinct from the wider 20px column reserved by our menu painter:
  ;; the latter includes the padding around the system bitmap.
  (func $handle_GetMenuCheckMarkDimensions (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32)
    (local.set $size (call $menu_checkmark_size))
    (i32.store offset=0 (global.get $reg_base) (i32.or
        (local.get $size)
        (i32.shl (local.get $size) (i32.const 16))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 682: InsertMenuW(hMenu, uPosition, uFlags, uIDNewItem, lpNewItem).
  ;; This reported success and inserted nothing, so a wide app's menu was
  ;; missing exactly the items it built at runtime. Narrow the label and let
  ;; the A implementation do the insert.
  ;;
  ;; The narrowed copy is deliberately not freed: the menu record keeps the
  ;; label pointer, so it has to outlive this call the same way the caller's
  ;; own string does. MF_BITMAP (0x04) and MF_OWNERDRAW (0x100) make lpNewItem
  ;; a handle rather than a string — those pass through untouched.
  (func $handle_InsertMenuW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32) (local $ansi i32)
    (if (i32.and
          (i32.ne (local.get $arg4) (i32.const 0))
          (i32.eqz (i32.and (local.get $arg2) (i32.const 0x104))))
      (then
        (local.set $len (i32.add (call $guest_wcslen (local.get $arg4)) (i32.const 1)))
        (local.set $ansi (call $heap_alloc (local.get $len)))
        (if (local.get $ansi)
          (then
            (drop (call $wide_to_ansi (local.get $arg4) (local.get $ansi) (local.get $len)))
            (local.set $arg4 (local.get $ansi))))))
    (call $handle_InsertMenuA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; GetMenuStringA(hMenu, uIDItem, lpString, cchMax, uFlag) → chars copied.
  ;; MFC reads every label back while walking a popup, so this sits directly
  ;; behind the WM_INITMENUPOPUP path -- it was not registered at all, and the
  ;; unimplemented-API crash was the first thing Paint hit once its update loop
  ;; started running. MF_BYPOSITION is 0x400.
  (func $handle_GetMenuStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $menu_handle_copy_label
      (local.get $arg0) (local.get $arg1)
      (i32.and (local.get $arg4) (i32.const 0x400))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; 5 args
  )

  ;; 683: GetMenuStringW(hMenu, uIDItem, lpString, cchMax, uFlag) → chars copied.
  ;; The label lives as ANSI, so read it into a staging buffer of the caller's
  ;; size and widen it into their buffer. A NULL buffer is a measuring call and
  ;; needs no staging at all.
  (func $handle_GetMenuStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $len i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; 5 args
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.le_s (local.get $arg3) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $menu_handle_copy_label
          (local.get $arg0) (local.get $arg1)
          (i32.and (local.get $arg4) (i32.const 0x400))
          (i32.const 0) (local.get $arg3)))
        (return)))
    (local.set $tmp (call $heap_alloc (local.get $arg3)))
    (if (i32.eqz (local.get $tmp))
      (then (call $gs16 (local.get $arg2) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (call $gs8 (local.get $tmp) (i32.const 0))
    (local.set $len (call $menu_handle_copy_label
      (local.get $arg0) (local.get $arg1)
      (i32.and (local.get $arg4) (i32.const 0x400))
      (call $g2w (local.get $tmp)) (local.get $arg3)))
    (drop (call $ansi_to_wide (local.get $tmp) (local.get $arg2) (local.get $arg3)))
    (call $heap_free (local.get $tmp))
    (i32.store offset=0 (global.get $reg_base) (local.get $len))
  )

  ;; 687: CreateMenu() — a WAT dynamic (MNUD) menu, the same object
  ;; CreatePopupMenu makes; SetMenu serializes the finished bar with
  ;; $menu_set_bar_from_dynamic. It used to be a host-side JS tree, which could
  ;; not answer GetSubMenu until SetMenu: Civ II MGE appends its dropdowns to
  ;; the bar and fills each one through GetSubMenu before attaching it, so every
  ;; dropdown came up empty.
  (func $handle_CreateMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_CreatePopupMenu (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; CreatePopupMenu() — WAT-owned dynamic popup menu state.
  (func $handle_CreatePopupMenu (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dynamic_menu_create))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )
