  ;; ============================================================
  ;; CONTROL TABLE + BUILT-IN CONTROL WNDPROCS
  ;; ============================================================
  ;;
  ;; Two parallel mechanisms exist during the controls refactor:
  ;;
  ;;   (a) CONTROL_TABLE at WASM 0x2980 — legacy parallel array
  ;;       indexed by window slot. Holds (ctrl_class, ctrl_id, check_state).
  ;;       Populated by handle_CreateDialogParamA when JS creates a dialog
  ;;       template; consulted by BM_GETCHECK / BM_SETCHECK as a fallback.
  ;;       Slated for deletion in STEP 5+ once dialogs are built from WAT.
  ;;
  ;;   (b) Per-window state struct (ButtonState / StaticState / ...)
  ;;       allocated in $heap_alloc and pointed to by WND_RECORDS.state_ptr
  ;;       (via $wnd_set_state_ptr). Allocated in WM_CREATE, freed in
  ;;       WM_DESTROY. This is the new model — when state_ptr != 0 the
  ;;       wndproc treats this control as fully owned by WAT.
  ;;
  ;; ctrl_class values: 0=not a control, 1=Button, 2=Edit, 3=Static,
  ;;                    4=ListBox, 5=ComboBox, 6=ColorGrid, 7=ScrollBar,
  ;;                    8=TreeView, 9=Combo popup, 10+=WAT-built dialogs,
  ;;                    17=ProgressBar, 18=ListView, 19=TrackBar,
  ;;                    20=Tooltip, 21=Toolbar

  ;; ---- Per-class state struct layouts ----
  ;;
  ;; The wndproc that allocates the state struct in WM_CREATE is responsible
  ;; for freeing it AND any sub-allocations (text_buf_ptr) in WM_DESTROY,
  ;; then calling $wnd_set_state_ptr(hwnd, 0).
  ;;
  ;; WND_RECORDS.state_ptr IS A DISCRIMINATED UNION, NOT A STRUCT — and it is a
  ;; stronger union than GdiObject (docs/watx-layout-migration-design.md §5.4).
  ;; Two properties make it so:
  ;;
  ;;   (1) THERE IS NO SHARED PREFIX. GdiObject at least agreed on handle@0 and
  ;;       type@4, which is what `GdiObject` names. Here even +0 disagrees:
  ;;         Button/Static/Combo/Edit  +0 = text_buf_ptr, a GUEST POINTER
  ;;         Progress/TrackBar         +0 = min,          a signed integer
  ;;         ListBox                   +0 = items_buf_ptr, a GUEST POINTER
  ;;         ListView                  +0 = item_count,   a count
  ;;         ColorGrid                 +0 = sel_idx,      -1 when none
  ;;       so there is deliberately no `ControlStateAny` view below: there is
  ;;       nothing true to put in it. +8 is the sharpest single word — it is a
  ;;       Button's bit-field, a Static's SS_* enum, a Combo's full window
  ;;       style, a Progress/TrackBar POSITION, a ListBox byte CAPACITY, an
  ;;       Edit's char capacity, and a ListView's guest POINTER to the cell
  ;;       array. One (layout ControlState) would compile perfectly and be
  ;;       wrong at most of its sites.
  ;;
  ;;   (2) THE VARIANTS DO NOT EVEN SHARE A SIZE (8/12/16/20/24/40/44/56/72/80),
  ;;       so unlike GdiObject's uniform 48-byte record `size-of` pins nothing
  ;;       in common; each variant's size is its own allocation argument, cited
  ;;       per layout below.
  ;;
  ;;   (3) THE DISCRIMINANT IS NOT IN THE RECORD AT ALL. GdiObject carries its
  ;;       type at +4 and $gdi_object_delete_full dispatches on it. Here the
  ;;       tag lives entirely OUTSIDE: in CONTROL_TABLE.class (see the ctrl
  ;;       slot layout near $ctrl_slot_addr) and, operationally, in WHICH
  ;;       WNDPROC allocated the record — the wndproc that ran $heap_alloc in
  ;;       WM_CREATE is the only thing that knows what these bytes mean. So a
  ;;       variant cannot be chosen by reading the record; it is chosen by the
  ;;       class of the code holding the pointer.
  ;;
  ;; That last point is also why this family is nonetheless SAFE to convert,
  ;; and cheaper to attribute than GdiObject was: almost every raw site lives
  ;; in a function whose own name states the class ($btn_*, $static_*, $prog_*,
  ;; $trk_*, $lb_*, $cb_*, $lv_*, $edit_*, $colorspectrum_*, $toolbar_*). The
  ;; attribution is per FUNCTION, it is checked by tools/control-variant-gate.js,
  ;; and that gate refuses any new raw offset spelled against one of these
  ;; records in either the add form or the memarg form.
  ;;
  ;; A field a variant does not own is named `reserved*` rather than left
  ;; implicit, so reaching for it is an unknown-field compile error instead of
  ;; a plausible read (the GdiObject rule, and it applies unchanged here).

  ;; Button (ctrl_class 1). 68 bytes — $button_wndproc WM_CREATE heap_alloc 68.
  ;; flags@8 bit0=pressed bit1=checked bit2=default (the CURRENT paint default,
  ;; which flips on focus — $btn_clear_sibling_default / $btn_restore_real_default)
  ;; bit3=focused, bit8=indeterminate (mutually exclusive with checked bit1);
  ;; bit9=press tracking (mouse/Space, independent of visual pressed bit0);
  ;; bit10=mouse-origin tracking; BM_GETSTATE exposes bits9/10 as Win98 0x20/0x40.
  ;; read/written only through $btn_flags / $btn_set_flags, and by
  ;; $ctrl_get_check_state / $ctrl_set_check_state which share the native
  ;; unchecked/checked/indeterminate encoding with BM_GETCHECK.
  ;; drawitem@12 is a 48-byte DRAWITEMSTRUCT scratch embedded in the record, not
  ;; a field: $btn_drawitem_guest hands its GUEST address to the app's owner-draw
  ;; handler, so its 12 words are the app's to write. It is named, and named as
  ;; an array, precisely so that nothing in here can address into the middle of
  ;; it by accident.
  ;; NO ctrl_id HERE, deliberately: the child/menu id lives once, in
  ;; CONTROL_TABLE+4, and is read with $ctrl_table_get_id($hwnd). A second copy
  ;; in the record went stale the moment SetWindowLongA(GWL_ID) moved the table
  ;; entry, and every WM_COMMAND this control sent afterwards carried the old id.
  (layout ButtonState
    (field text_buf_ptr  i32)      ;; +0   guest ptr from $heap_alloc (0 = no text)
    (field text_len      i32)      ;; +4   chars, no NUL
    (field flags         i32)      ;; +8   see above
    (field drawitem      i32 12)   ;; +12..+59 embedded DRAWITEMSTRUCT scratch
    (field image_type    i32)      ;; +60  IMAGE_BITMAP=0
    (field image_handle  i32))     ;; +64  HBITMAP from BM_SETIMAGE; ends at +68

  ;; Static (ctrl_class 3). 20 bytes — $static_wndproc WM_CREATE heap_alloc 20,
  ;; and $syslink_wndproc allocates the SAME 20-byte shape and reads through the
  ;; same $static_* accessors (a SysLink is a static that paints part of its
  ;; caption blue). image_ord@12 and text_buf_ptr@0 are exclusive in practice: a
  ;; template static with an ORDINAL caption keeps the resource ordinal here and
  ;; paints an icon, a string caption leaves it 0 and fills text_buf_ptr.
  (layout StaticState
    (field text_buf_ptr  i32)      ;; +0
    (field text_len      i32)      ;; +4
    (field style         i32)      ;; +8   SS_LEFT=0 SS_CENTER=1 SS_RIGHT=2 SS_ICON=3 …
    (field image_ord     i32)      ;; +12  RT_ICON/RT_BITMAP resource ordinal, or 0
    (field font          i32))     ;; +16  HFONT from WM_SETFONT; ends at +20

  ;; Progress bar (ctrl_class 17). 16 bytes — $progress_wndproc heap_alloc 16,
  ;; twice (WM_CREATE and the lazy path for a template control that gets PBM_*
  ;; first). $prog_state_init writes 0/100/0/10, the comctl32 defaults.
  ;; NOTE the trap this layout exists to close: min/max/pos land on the SAME
  ;; three offsets as TrackBarState below, and the two records are different
  ;; lengths — spelled as bare offsets a copy-paste between the two wndprocs
  ;; compiles and misbehaves quietly.
  (layout ProgressState
    (field min   i32)              ;; +0
    (field max   i32)              ;; +4
    (field pos   i32)              ;; +8   clamped into [min,max] by $prog_clamp
    (field step  i32))             ;; +12  PBM_STEPIT increment; ends at +16

  ;; TrackBar (ctrl_class 19). 24 bytes — $trackbar_wndproc heap_alloc 24.
  (layout TrackBarState
    (field min        i32)         ;; +0
    (field max        i32)         ;; +4
    (field pos        i32)         ;; +8   clamped by $trk_clamp
    (field line       i32)         ;; +12  TBM_SETLINESIZE
    (field page       i32)         ;; +16  TBM_SETPAGESIZE
    (field thumb_len  i32))        ;; +20  TBM_SETTHUMBLENGTH; ends at +24

  ;; ListBox (ctrl_class 4). 52 bytes — $listbox_wndproc heap_alloc 52.
  ;; Three of the four buffers are a pointer and a capacity that must be read
  ;; together, and items_used belongs to the first of them; +4/+8, +32/+36 and
  ;; +40/+44 look alike as bare offsets and the one that is NOT a capacity
  ;; (count@12, which counts items while items_used@4 counts bytes) sits between
  ;; them. item_h@48 is 0 until an owner-draw listbox has been measured; after
  ;; that it is what WM_MEASUREITEM asked for, and $lb_row_height selects it
  ;; against the Win98 default of 16.
  ;; The notification id is NOT here: see ButtonState above — one copy, in
  ;; CONTROL_TABLE+4, read with $ctrl_table_get_id($hwnd).
  (layout ListBoxState
    (field items_buf_ptr   i32)    ;; +0   guest ptr, flat NUL-separated strings
    (field items_used      i32)    ;; +4   BYTES used in items_buf (incl. NULs)
    (field items_cap       i32)    ;; +8   BYTES allocated for items_buf
    (field count           i32)    ;; +12  number of ITEMS
    (field cur_sel         i32)    ;; +16  -1 = none
    (field top_index       i32)    ;; +20  first visible row
    (field drag_anchor_y   i32)    ;; +24
    (field drag_anchor_top i32)    ;; +28
    (field data_buf_ptr    i32)    ;; +32  guest ptr to u32[] (LB_SETITEMDATA)
    (field data_cap        i32)    ;; +36  capacity in u32 SLOTS
    (field sel_buf_ptr     i32)    ;; +40  guest ptr to u8[] multi-selection flags
    (field sel_cap         i32)    ;; +44  capacity in BYTES
    (field item_h          i32))   ;; +48  owner-draw row height, 0 = default; ends at +52

  ;; ComboBox (ctrl_class 5). 40 bytes — $combobox_wndproc heap_alloc 40.
  ;; The notification id is NOT here: see ButtonState above — one copy, in
  ;; CONTROL_TABLE+4, read with $ctrl_table_get_id($hwnd).
  (layout ComboBoxState
    (field text_buf_ptr         i32) ;; +0   selected/typed item text
    (field text_len             i32) ;; +4
    (field style                i32) ;; +8   FULL WINDOW STYLE (not an SS_*)
    (field cur_sel              i32) ;; +12  mirror of the listbox's; -1 = none
    (field lb_hwnd              i32) ;; +16  inner listbox
    (field popup_hwnd           i32) ;; +20  reserved for WS_POPUP escape (0 today)
    (field edit_hwnd            i32) ;; +24  CBS_DROPDOWN inner edit; 0 for SIMPLE/DROPDOWNLIST
    (field is_dropped           i32) ;; +28  0/1 — CB_GETDROPPEDSTATE
    (field variant              i32) ;; +32  1=SIMPLE 2=DROPDOWN 3=DROPDOWNLIST
    (field suppress_edit_notify i32)) ;; +36 combo-originated edit WM_SETTEXT nesting; ends at +40

  ;; ListView (ctrl_class 18). 76 bytes — $listview_wndproc heap_alloc 76.
  ;; item_count/item_cap and col_count/col_cap are two count+capacity pairs at
  ;; +0/+4 and +16/+20; storing an item COUNT into a CAP reads as a plausible
  ;; line and corrupts the next grow. The three COLORREFs at +56/+60/+64 have
  ;; the same problem in the other direction — all three take the same kind of
  ;; value, so a wrong offset paints rather than traps.
  ;; The notification id is NOT here: see ButtonState above — one copy, in
  ;; CONTROL_TABLE+4. This record's copy was written at WM_CREATE and never
  ;; read by anything at all, which is the same redundancy one stage further on.
  (layout ListViewState
    (field item_count        i32)  ;; +0
    (field item_cap          i32)  ;; +4
    (field item_cells_ptr    i32)  ;; +8   guest ptr to item_cap * 44-byte rows
    (field reserved_12       i32)  ;; +12  written 0, never read
    (field col_count         i32)  ;; +16
    (field col_cap           i32)  ;; +20
    (field col_widths_ptr    i32)  ;; +24  guest ptr to u32[]
    (field col_texts_ptr     i32)  ;; +28  guest ptr to u32[] heap string ptrs
    (field selected_index    i32)  ;; +32  -1 = none
    (field top_index         i32)  ;; +36  content viewport; not SetScrollPos's thumb-only state
    (field extended_style    i32)  ;; +40  LVM_SETEXTENDEDLISTVIEWSTYLE shadow
    (field drag_anchor_y     i32)  ;; +44
    (field drag_anchor_top   i32)  ;; +48
    (field small_image_list  i32)  ;; +52  LVM_SETIMAGELIST
    (field bk_color          i32)  ;; +56  COLORREF
    (field text_color        i32)  ;; +60  COLORREF
    (field text_bk_color     i32)  ;; +64  COLORREF or CLR_NONE
    (field state_image_list  i32)  ;; +68  LVM_SETIMAGELIST(LVSIL_STATE)
    (field normal_image_list i32)) ;; +72  LVM_SETIMAGELIST(LVSIL_NORMAL); ends at +76

  ;; Edit (ctrl_class 2). 40 bytes — $edit_wndproc WM_CREATE heap_alloc 40.
  ;; This is the one variant with NO accessor layer at all: its ~60 raw sites
  ;; are spelled inline in the $edit_* helpers, which is why naming buys the
  ;; most here. cursor@12 and sel_anchor@16 are equal exactly when there is no
  ;; selection, and $edit_sel_lo / $edit_sel_hi read the pair together — the two
  ;; are trivially swappable as bare offsets and a swap is a selection that
  ;; extends the wrong way, not a crash.
  (layout EditState
    (field text_buf_ptr i32)       ;; +0   guest ptr, NUL-terminated
    (field text_len     i32)       ;; +4   chars, excluding NUL
    (field text_cap     i32)       ;; +8   capacity, excluding the NUL slot
    (field cursor       i32)       ;; +12  char position
    (field sel_anchor   i32)       ;; +16  == cursor when there is no selection
    (field scroll_top   i32)       ;; +20  first visible line (0 single-line)
    (field flags        i32)       ;; +24  bit0=multiline bit1=password
                                   ;;      bit2=readonly bit3=focused
    (field max_length   i32)       ;; +28  0 = unlimited
    (field font         i32)       ;; +32  HFONT from WM_SETFONT (0 = GUI font)
    (field scroll_x     i32))      ;; +36  horizontal scroll in PIXELS; ends at +40

  ;; ColorGrid (ctrl_class 6). 4 bytes — $colorgrid_wndproc heap_alloc 4; the
  ;; WM_CREATE store writes -1, which is the evidence for the name. It used to
  ;; store CREATESTRUCT.hMenu in a second word as well; that copy is gone and
  ;; the three places that read it (the 0x461 "custom colours" grid test) now
  ;; ask $ctrl_table_get_id($hwnd), which is where the id already lived.
  (layout ColorGridState
    (field sel_idx  i32))          ;; +0   selected cell, -1 = none; ends at +4

  ;; The colour dialog's HSL spectrum child. 12 bytes — $colorspectrum_wndproc
  ;; heap_alloc 12. The three words are named from the ONLY thing that consumes
  ;; them: $colorspectrum_commit passes +0/+4/+8 positionally to
  ;; $colordlg_hsl_to_rgb (param $h) (param $s) (param $l).
  (layout ColorSpectrumState
    (field hue  i32)               ;; +0
    (field sat  i32)               ;; +4
    (field lum  i32))              ;; +8   ends at +12

  ;; Tooltip (ctrl_class 20). 64 bytes — $tooltip_wndproc heap_alloc 64. The
  ;; two colour words are pinned by the messages that reach them:
  ;; TTM_SETTIPBKCOLOR(0x0413)/TTM_GETTIPBKCOLOR(0x0416) are +20 and
  ;; TTM_SETTIPTEXTCOLOR(0x0414)/TTM_GETTIPTEXTCOLOR(0x0417) are +24, so the
  ;; pair is not guessable from the values (both are COLORREFs) but is exact
  ;; from the message ids. Likewise TTM_SETMAXTIPWIDTH(0x0418) /
  ;; TTM_GETMAXTIPWIDTH(0x0419) name +28, and TTM_SETDELAYTIME(0x0403)'s
  ;; wParam selects +40 (TTDT_AUTOMATIC/AUTOPOP), +32 (TTDT_RESHOW) and +36
  ;; (TTDT_INITIAL) — the WM_CREATE defaults 5000/500/100 are the cross-check.
  (layout TooltipState
    (field items_guest    i32)     ;; +0   guest ptr to 48-byte TOOLINFOA snapshots
    (field count          i32)     ;; +4
    (field capacity       i32)     ;; +8   snapshots allocated
    (field active         i32)     ;; +12  TTM_ACTIVATE
    (field current_index  i32)     ;; +16  tool being shown, -1 = none
    (field bk_color       i32)     ;; +20  COLORREF, default 0x00FFFFE1
    (field text_color     i32)     ;; +24  COLORREF, default 0
    (field max_tip_width  i32)     ;; +28  -1 = unlimited
    (field autopop_delay  i32)     ;; +32  ms, default 5000
    (field initial_delay  i32)     ;; +36  ms, default 500
    (field reshow_delay   i32)     ;; +40  ms, default 100
    (field margin         i32 4)   ;; +44..+59  l/t/r/b
    (field reserved_60    i32))    ;; +60  allocated, never read; ends at +64

  ;; The native tab strip's shadow state — NOT reached through
  ;; WND_RECORDS.state_ptr but through $tab_native_state_get, which keeps its
  ;; own 32-slot (hwnd, state) table in $TAB_NATIVE_STATE_TABLE. It is declared
  ;; here anyway because it is the same KIND of record and shares the same
  ;; hazard: 128 bytes = two counters and eight 15-byte fixed label records, so
  ;; the array is not i32-strided and only count@0 and selected@4 are words.
  ;; Naming them is what stops a reader taking `offset=8` for a third counter.
  (layout TabNativeState
    (field count     i32)          ;; +0   tabs inserted, hard-capped at 8
    (field selected  i32)          ;; +4   TCM_SETCURSEL
    (field labels    u8 120))      ;; +8   8 * 15-byte fixed records; ends at +128

  ;; A VIEW over the four variants that genuinely agree, and ONLY over them.
  ;; ButtonState, StaticState, ComboBoxState and EditState all keep a guest text
  ;; pointer at +0 and its length in chars at +4; Progress, TrackBar, ListBox,
  ;; ListView, ColorGrid, ColorSpectrum, Tooltip and Toolbar do NOT, so this is
  ;; a partial prefix and emphatically not a `ControlStateAny`. It exists for
  ;; the two functions that are deliberately class-agnostic —
  ;; $ctrl_decimal_value and $ctrl_inches_milli look a control up by DIALOG ID
  ;; and read whatever text it has — and it stops at +8 so that reading a fifth
  ;; word through this view, where the four classes stop agreeing, is an
  ;; unknown-field compile error. This is the GdiPenBrush precedent: name only
  ;; what the members share, and make a site that wants more pick a variant.
  (layout ControlTextState
    (field text_buf_ptr i32)       ;; +0   guest ptr
    (field text_len     i32))      ;; +4   chars, no NUL; ends at +8

  ;; Toolbar (ctrl_class 21). 80 bytes — $toolbar_ensure_state heap_alloc 80,
  ;; which also supplies the defaults cited per field.
  (layout ToolbarState
    (field button_count        i32) ;; +0
    (field button_w            i32) ;; +4   dxButton, default 23
    (field button_h            i32) ;; +8   dyButton, default 22
    (field bitmap_w            i32) ;; +12  dxBitmap, default 16
    (field bitmap_h            i32) ;; +16  dyBitmap, default 15
    (field rows                i32) ;; +20  default 1
    (field tbutton_struct_size i32) ;; +24  sizeof(TBBUTTON), default 20
    (field bitmap_count        i32) ;; +28
    (field buttons_guest       i32) ;; +32  guest ptr to 20-byte TBBUTTON snapshots
    (field capacity            i32) ;; +36  snapshots allocated
    (field pressed_index       i32) ;; +40  default -1
    (field hwnd                i32) ;; +44  refreshed on every $toolbar_ensure_state
    (field bitmap_handle       i32) ;; +48
    (field image_list          i32) ;; +52
    (field hot_image_list      i32) ;; +56
    (field disabled_image_list i32) ;; +60
    (field style               i32) ;; +64
    (field extended_style      i32) ;; +68
    (field padding_packed      i32) ;; +72  TB_SETPADDING, cx | cy<<16
    (field hot_index           i32)) ;; +76 default -1; ends at +80

  ;; Status bar (ctrl_class 22, and the WAT paint mirror for a registered
  ;; comctl32 status bar). MenuHelp writes transient help to simple part 0xFF
  ;; and toggles SB_SIMPLE; it does not destroy pane zero's normal text.
  ;; Retaining both strings lets closing a menu restore the application's
  ;; ordinary status line. TITLE_TABLE mirrors whichever string is active.
  (layout StatusBarState
    (field normal_text_ptr i32)    ;; +0  guest heap ptr, ANSI
    (field normal_text_len i32)    ;; +4
    (field simple_text_ptr i32)    ;; +8  guest heap ptr, ANSI
    (field simple_text_len i32)    ;; +12
    (field simple_mode     i32)    ;; +16 BOOL
    (field font            i32))   ;; +20 WM_SETFONT HFONT, 0 = status font; ends at +24

  ;; ---- ButtonState accessors ----
  ;;
  ;; $sw is the *WASM* address of the struct — $g2w of WND_RECORDS.state_ptr.
  ;; Only the layout above says what a bare `offset=8` means, and every class
  ;; puts something different there (a listbox keeps its top index at +20, an
  ;; edit its selection anchor), so a reader landing mid-file cannot tell a
  ;; button's flags word from anything else. Naming the fields makes the class
  ;; of the pointer part of the expression instead of something you have to
  ;; carry in your head from the wndproc entry.
  (func $btn_text_ptr (param $sw ptr<ButtonState>) (result i32)
    (load.field ButtonState text_buf_ptr (local.get $sw)))
  (func $btn_set_text_ptr (param $sw ptr<ButtonState>) (param $v i32)
    (store.field ButtonState text_buf_ptr (local.get $sw) (local.get $v)))
  (func $btn_text_len (param $sw ptr<ButtonState>) (result i32)
    (load.field.memarg ButtonState text_len (local.get $sw)))
  (func $btn_set_text_len (param $sw ptr<ButtonState>) (param $v i32)
    (store.field.memarg ButtonState text_len (local.get $sw) (local.get $v)))
  (func $btn_flags (param $sw ptr<ButtonState>) (result i32)
    (load.field.memarg ButtonState flags (local.get $sw)))
  (func $btn_set_flags (param $sw ptr<ButtonState>) (param $v i32)
    (store.field.memarg ButtonState flags (local.get $sw) (local.get $v)))
  (func $btn_image_type (param $sw ptr<ButtonState>) (result i32)
    (load.field.memarg ButtonState image_type (local.get $sw)))
  (func $btn_image_handle (param $sw ptr<ButtonState>) (result i32)
    (load.field.memarg ButtonState image_handle (local.get $sw)))
  (func $btn_set_image (param $sw ptr<ButtonState>) (param $type i32) (param $h i32)
    (store.field.memarg ButtonState image_type (local.get $sw) (local.get $type))
    (store.field.memarg ButtonState image_handle (local.get $sw) (local.get $h)))
  ;; The owner-draw DRAWITEMSTRUCT scratch lives inside the struct; the message
  ;; carries its *guest* address, so both forms are named.
  (func $btn_drawitem_guest (param $state i32) (result i32)
    (i32.add (local.get $state) (i32.const 16)))

  ;; ---- StaticState accessors ----
  ;;
  ;; Same rules as the button block above: $sw is the WASM address. SysLink
  ;; allocates this same 20-byte layout (it is a static that paints part of its
  ;; caption blue), so both wndprocs read through these; that shared shape is
  ;; invisible when both files spell out `offset=8`.
  ;;
  ;; +12 is a union in practice: a static created from a dialog template with
  ;; an *ordinal* caption keeps the resource ordinal there and paints an icon,
  ;; while a string caption leaves it 0 and fills text_ptr instead. Naming it
  ;; image_ord is what says the icon branch and the text branch are exclusive.
  (func $static_text_ptr (param $sw ptr<StaticState>) (result i32)
    (load.field StaticState text_buf_ptr (local.get $sw)))
  (func $static_set_text_ptr (param $sw ptr<StaticState>) (param $v i32)
    (store.field StaticState text_buf_ptr (local.get $sw) (local.get $v)))
  (func $static_text_len (param $sw ptr<StaticState>) (result i32)
    (load.field.memarg StaticState text_len (local.get $sw)))
  (func $static_set_text_len (param $sw ptr<StaticState>) (param $v i32)
    (store.field.memarg StaticState text_len (local.get $sw) (local.get $v)))
  (func $static_style (param $sw ptr<StaticState>) (result i32)
    (load.field.memarg StaticState style (local.get $sw)))
  (func $static_set_style (param $sw ptr<StaticState>) (param $v i32)
    (store.field.memarg StaticState style (local.get $sw) (local.get $v)))
  (func $static_image_ord (param $sw ptr<StaticState>) (result i32)
    (load.field.memarg StaticState image_ord (local.get $sw)))
  (func $static_set_image_ord (param $sw ptr<StaticState>) (param $v i32)
    (store.field.memarg StaticState image_ord (local.get $sw) (local.get $v)))
  (func $static_font (param $sw ptr<StaticState>) (result i32)
    (load.field.memarg StaticState font (local.get $sw)))
  (func $static_set_font (param $sw ptr<StaticState>) (param $v i32)
    (store.field.memarg StaticState font (local.get $sw) (local.get $v)))

  ;; ---- ProgressState accessors ----
  ;;
  ;; min/max/pos/step. The PBM_* handlers clamp pos into [min,max] on nearly
  ;; every message, and getting the clamp arguments the wrong way round reads
  ;; as a progress bar that never moves rather than as a crash, so the two
  ;; bounds being named rather than offset=0 / offset=4 matters here.
  (func $prog_min (param $sw ptr<ProgressState>) (result i32)
    (load.field ProgressState min (local.get $sw)))
  (func $prog_set_min (param $sw ptr<ProgressState>) (param $v i32)
    (store.field ProgressState min (local.get $sw) (local.get $v)))
  (func $prog_max (param $sw ptr<ProgressState>) (result i32)
    (load.field.memarg ProgressState max (local.get $sw)))
  (func $prog_set_max (param $sw ptr<ProgressState>) (param $v i32)
    (store.field.memarg ProgressState max (local.get $sw) (local.get $v)))
  (func $prog_pos (param $sw ptr<ProgressState>) (result i32)
    (load.field.memarg ProgressState pos (local.get $sw)))
  (func $prog_set_pos (param $sw ptr<ProgressState>) (param $v i32)
    (store.field.memarg ProgressState pos (local.get $sw) (local.get $v)))
  (func $prog_step (param $sw ptr<ProgressState>) (result i32)
    (load.field.memarg ProgressState step (local.get $sw)))
  (func $prog_set_step (param $sw ptr<ProgressState>) (param $v i32)
    (store.field.memarg ProgressState step (local.get $sw) (local.get $v)))
  ;; Fresh bar: 0..100, pos 0, step 10 — the comctl32 defaults.
  (func $prog_state_init (param $sw i32)
    (call $prog_set_min (local.get $sw) (i32.const 0))
    (call $prog_set_max (local.get $sw) (i32.const 100))
    (call $prog_set_pos (local.get $sw) (i32.const 0))
    (call $prog_set_step (local.get $sw) (i32.const 10)))
  ;; Clamp a candidate position into the bar's range.
  (func $prog_clamp (param $sw i32) (param $pos i32) (result i32)
    (if (i32.lt_s (local.get $pos) (call $prog_min (local.get $sw)))
      (then (local.set $pos (call $prog_min (local.get $sw)))))
    (if (i32.gt_s (local.get $pos) (call $prog_max (local.get $sw)))
      (then (local.set $pos (call $prog_max (local.get $sw)))))
    (local.get $pos))

  ;; ---- TrackBarState accessors (24 bytes) ----
  ;;
  ;; min/max/pos land on the same three offsets as ProgressState, which is
  ;; exactly why the raw form was worth removing: two different classes with
  ;; the same first three words and different lengths read identically at the
  ;; call site, so a copy-paste between the two wndprocs would have compiled.
  ;; +12 line, +16 page, +20 thumb length.
  (func $trk_min (param $sw ptr<TrackBarState>) (result i32)
    (load.field TrackBarState min (local.get $sw)))
  (func $trk_set_min (param $sw ptr<TrackBarState>) (param $v i32)
    (store.field TrackBarState min (local.get $sw) (local.get $v)))
  (func $trk_max (param $sw ptr<TrackBarState>) (result i32)
    (load.field.memarg TrackBarState max (local.get $sw)))
  (func $trk_set_max (param $sw ptr<TrackBarState>) (param $v i32)
    (store.field.memarg TrackBarState max (local.get $sw) (local.get $v)))
  (func $trk_pos (param $sw ptr<TrackBarState>) (result i32)
    (load.field.memarg TrackBarState pos (local.get $sw)))
  (func $trk_set_pos (param $sw ptr<TrackBarState>) (param $v i32)
    (store.field.memarg TrackBarState pos (local.get $sw) (local.get $v)))
  (func $trk_line (param $sw ptr<TrackBarState>) (result i32)
    (load.field.memarg TrackBarState line (local.get $sw)))
  (func $trk_set_line (param $sw ptr<TrackBarState>) (param $v i32)
    (store.field.memarg TrackBarState line (local.get $sw) (local.get $v)))
  (func $trk_page (param $sw ptr<TrackBarState>) (result i32)
    (load.field.memarg TrackBarState page (local.get $sw)))
  (func $trk_set_page (param $sw ptr<TrackBarState>) (param $v i32)
    (store.field.memarg TrackBarState page (local.get $sw) (local.get $v)))
  (func $trk_thumb_len (param $sw ptr<TrackBarState>) (result i32)
    (load.field.memarg TrackBarState thumb_len (local.get $sw)))
  (func $trk_set_thumb_len (param $sw ptr<TrackBarState>) (param $v i32)
    (store.field.memarg TrackBarState thumb_len (local.get $sw) (local.get $v)))
  ;; Fresh slider: 0..100 at 0, line 1, page 10, 16px thumb.
  (func $trk_state_init (param $sw i32)
    (call $trk_set_min (local.get $sw) (i32.const 0))
    (call $trk_set_max (local.get $sw) (i32.const 100))
    (call $trk_set_pos (local.get $sw) (i32.const 0))
    (call $trk_set_line (local.get $sw) (i32.const 1))
    (call $trk_set_page (local.get $sw) (i32.const 10))
    (call $trk_set_thumb_len (local.get $sw) (i32.const 16)))
  (func $trk_clamp (param $sw i32) (param $pos i32) (result i32)
    (if (i32.lt_s (local.get $pos) (call $trk_min (local.get $sw)))
      (then (local.set $pos (call $trk_min (local.get $sw)))))
    (if (i32.gt_s (local.get $pos) (call $trk_max (local.get $sw)))
      (then (local.set $pos (call $trk_max (local.get $sw)))))
    (local.get $pos))

  ;; ---- ListBoxState accessors (52 bytes) ----
  ;;
  ;; Three of the four buffers this struct owns are a pointer and a capacity
  ;; that must be read together, and a fourth field — items_used — belongs to
  ;; the first of them. Spelled as bare offsets, +4/+8 and +36/+40 and +44/+48
  ;; look alike, and the one that is *not* a capacity (+12 count, which counts
  ;; items while +4 counts bytes) sits right between them. See the layout
  ;; comment above $listbox_wndproc.
  (func $lb_items_ptr (param $sw ptr<ListBoxState>) (result i32)
    (load.field ListBoxState items_buf_ptr (local.get $sw)))
  (func $lb_set_items_ptr (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field ListBoxState items_buf_ptr (local.get $sw) (local.get $v)))
  (func $lb_items_used (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState items_used (local.get $sw)))
  (func $lb_set_items_used (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState items_used (local.get $sw) (local.get $v)))
  (func $lb_items_cap (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState items_cap (local.get $sw)))
  (func $lb_set_items_cap (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState items_cap (local.get $sw) (local.get $v)))
  (func $lb_count (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState count (local.get $sw)))
  (func $lb_set_count (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState count (local.get $sw) (local.get $v)))
  (func $lb_cur_sel (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState cur_sel (local.get $sw)))
  (func $lb_set_cur_sel (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState cur_sel (local.get $sw) (local.get $v)))
  (func $lb_top_index (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState top_index (local.get $sw)))
  (func $lb_set_top_index (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState top_index (local.get $sw) (local.get $v)))
  (func $lb_drag_anchor_y (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState drag_anchor_y (local.get $sw)))
  (func $lb_set_drag_anchor_y (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState drag_anchor_y (local.get $sw) (local.get $v)))
  (func $lb_drag_anchor_top (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState drag_anchor_top (local.get $sw)))
  (func $lb_set_drag_anchor_top (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState drag_anchor_top (local.get $sw) (local.get $v)))
  (func $lb_data_ptr (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState data_buf_ptr (local.get $sw)))
  (func $lb_set_data_ptr (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState data_buf_ptr (local.get $sw) (local.get $v)))
  (func $lb_data_cap (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState data_cap (local.get $sw)))
  (func $lb_set_data_cap (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState data_cap (local.get $sw) (local.get $v)))
  (func $lb_sel_ptr (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState sel_buf_ptr (local.get $sw)))
  (func $lb_set_sel_ptr (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState sel_buf_ptr (local.get $sw) (local.get $v)))
  ;; +52 item_h: 0 until an owner-draw listbox has been measured; after that
  ;; the height WM_MEASUREITEM asked for. Everything else keeps the Win98
  ;; default, so $lb_row_height is what paint, hit-testing and scrolling all
  ;; ask instead of the 16 they used to hardcode.
  (func $lb_item_h (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState item_h (local.get $sw)))
  (func $lb_set_item_h (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState item_h (local.get $sw) (local.get $v)))
  (func $lb_row_height (param $sw i32) (result i32)
    (if (i32.eqz (local.get $sw)) (then (return (i32.const 16))))
    (select (call $lb_item_h (local.get $sw)) (i32.const 16)
      (call $lb_item_h (local.get $sw))))
  (func $lb_sel_cap (param $sw ptr<ListBoxState>) (result i32)
    (load.field.memarg ListBoxState sel_cap (local.get $sw)))
  (func $lb_set_sel_cap (param $sw ptr<ListBoxState>) (param $v i32)
    (store.field.memarg ListBoxState sel_cap (local.get $sw) (local.get $v)))

  ;; USER hides a listbox's WS_VSCROLL strip while every item fits, unless
  ;; LBS_DISABLENOSCROLL explicitly asks for a disabled strip. Paint and
  ;; hit-test share this decision so a hidden strip cannot steal clicks.
  (func $listbox_vscroll_visible (param $hwnd i32) (param $sw i32) (result i32)
    (local $style i32) (local $sz i32) (local $h i32) (local $visible i32)
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    (if (i32.eqz (i32.and (local.get $style) (i32.const 0x00200000)))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $style) (i32.const 0x00001000)) ;; LBS_DISABLENOSCROLL
      (then (return (i32.const 1))))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (if (i32.le_s (local.get $h) (i32.const 4))
      (then (return (i32.const 1))))
    (local.set $visible
      (i32.div_u (i32.sub (local.get $h) (i32.const 4)) (call $lb_row_height (local.get $sw))))
    (i32.gt_s (call $lb_count (local.get $sw)) (local.get $visible)))

  (func $listbox_visible_rows (param $hwnd i32) (param $sw i32) (result i32)
    (local $h i32) (local $visible i32)
    (local.set $h (call $ctrl_get_h (local.get $hwnd)))
    (if (i32.le_s (local.get $h) (i32.const 4)) (then (return (i32.const 1))))
    (local.set $visible
      (i32.div_u (i32.sub (local.get $h) (i32.const 4)) (call $lb_row_height (local.get $sw))))
    (select (local.get $visible) (i32.const 1)
      (i32.gt_s (local.get $visible) (i32.const 0))))

  ;; Clamp a requested first row so the list never scrolls past its last full
  ;; page. Returns the resulting top index.
  (func $listbox_scroll_to (param $hwnd i32) (param $sw i32) (param $requested i32) (result i32)
    (local $top i32) (local $max i32)
    (local.set $max (i32.sub (call $lb_count (local.get $sw))
      (call $listbox_visible_rows (local.get $hwnd) (local.get $sw))))
    (if (i32.lt_s (local.get $max) (i32.const 0)) (then (local.set $max (i32.const 0))))
    (local.set $top (local.get $requested))
    (if (i32.lt_s (local.get $top) (i32.const 0)) (then (local.set $top (i32.const 0))))
    (if (i32.gt_s (local.get $top) (local.get $max)) (then (local.set $top (local.get $max))))
    (if (i32.ne (local.get $top) (call $lb_top_index (local.get $sw)))
      (then
        (call $lb_set_top_index (local.get $sw) (local.get $top))
        (call $invalidate_hwnd (local.get $hwnd))))
    (local.get $top))

  ;; ---- ComboBoxState accessors (44 bytes) ----
  ;;
  ;; A combobox is three windows: itself, an inner listbox, and (for
  ;; CBS_DROPDOWN) an inner edit, plus a popup shell that hosts the listbox
  ;; when it drops. Their handles sit at +20/+24/+28 and are indistinguishable
  ;; as bare offsets, which is exactly the mistake that hurts here — sending a
  ;; listbox message to the edit hwnd is silently ignored rather than trapping.
  ;; See the layout comment above $combobox_wndproc.
  (func $cb_text_ptr (param $sw ptr<ComboBoxState>) (result i32)
    (load.field ComboBoxState text_buf_ptr (local.get $sw)))
  (func $cb_set_text_ptr (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field ComboBoxState text_buf_ptr (local.get $sw) (local.get $v)))
  (func $cb_text_len (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState text_len (local.get $sw)))
  (func $cb_set_text_len (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState text_len (local.get $sw) (local.get $v)))
  (func $cb_style (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState style (local.get $sw)))
  (func $cb_set_style (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState style (local.get $sw) (local.get $v)))
  (func $cb_cur_sel (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState cur_sel (local.get $sw)))
  (func $cb_set_cur_sel (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState cur_sel (local.get $sw) (local.get $v)))
  (func $cb_lb_hwnd (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState lb_hwnd (local.get $sw)))
  (func $cb_set_lb_hwnd (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState lb_hwnd (local.get $sw) (local.get $v)))
  (func $cb_popup_hwnd (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState popup_hwnd (local.get $sw)))
  (func $cb_set_popup_hwnd (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState popup_hwnd (local.get $sw) (local.get $v)))
  (func $cb_edit_hwnd (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState edit_hwnd (local.get $sw)))
  (func $cb_set_edit_hwnd (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState edit_hwnd (local.get $sw) (local.get $v)))
  (func $cb_is_dropped (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState is_dropped (local.get $sw)))
  (func $cb_set_is_dropped (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState is_dropped (local.get $sw) (local.get $v)))
  (func $cb_variant (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState variant (local.get $sw)))
  (func $cb_set_variant (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState variant (local.get $sw) (local.get $v)))
  (func $cb_suppress_edit_notify (param $sw ptr<ComboBoxState>) (result i32)
    (load.field.memarg ComboBoxState suppress_edit_notify (local.get $sw)))
  (func $cb_set_suppress_edit_notify (param $sw ptr<ComboBoxState>) (param $v i32)
    (store.field.memarg ComboBoxState suppress_edit_notify (local.get $sw) (local.get $v)))
  ;; CB_SETEXTENDEDUI has no field of its own: it rides the unused top bit of
  ;; the stored style word, which is why a plain read of +8 is not the window
  ;; style an app would recognise. Both halves of that trick live here.
  (func $cb_extended_ui (param $sw i32) (result i32)
    (i32.shr_u (i32.and (call $cb_style (local.get $sw)) (i32.const 0x80000000))
               (i32.const 31)))
  (func $cb_set_extended_ui (param $sw i32) (param $on i32)
    (call $cb_set_style (local.get $sw)
      (select (i32.or  (call $cb_style (local.get $sw)) (i32.const 0x80000000))
              (i32.and (call $cb_style (local.get $sw)) (i32.const 0x7FFFFFFF))
              (local.get $on))))

  ;; Dialog mouse capture for WAT-managed buttons. Browser mouseup coordinates
  ;; can drift from the mousedown point; deliver the release to the pressed
  ;; button so owner-draw controls always clear ODS_SELECTED.
  (global $dialog_button_capture_parent (mut i32) (i32.const 0))
  (global $dialog_button_capture_hwnd (mut i32) (i32.const 0))
  (global $edit_sb_drag_anchor_y (mut i32) (i32.const 0))
  (global $edit_sb_drag_anchor_top (mut i32) (i32.const 0))
  (global $lv_debug_notify_count (mut i32) (i32.const 0))
  (global $lv_debug_notify_code (mut i32) (i32.const 0))
  (global $lv_debug_notify_item (mut i32) (i32.const -1))
  (global $lv_debug_notify_old_state (mut i32) (i32.const 0))
  (global $lv_debug_notify_new_state (mut i32) (i32.const 0))

  ;; Copy a NUL-terminated string from a WASM-linear address into a fresh
  ;; heap-allocated guest buffer. Returns the guest pointer (suitable for
  ;; passing as $text_wa to $ctrl_create_child, which then ends up in
  ;; CREATESTRUCT.lpszName for the wndproc to read in WM_CREATE).
  ;; $len excludes NUL.
  (func $wat_str_to_heap (param $wa i32) (param $len i32) (result i32)
    (local $buf i32) (local $bw i32)
    (local.set $buf (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (local.set $bw (call $g2w (local.get $buf)))
    ;; $buf is a fresh allocation, so it cannot overlap $wa and memory.copy's
    ;; memmove semantics are strictly safe here.
    (memory.copy (local.get $bw) (local.get $wa) (local.get $len))
    (i32.store8 (i32.add (local.get $bw) (local.get $len)) (i32.const 0))
    (local.get $buf))

  ;; ---- Control geometry table helpers (CONTROL_GEOM) ----
  ;; Each entry: 8 bytes = (i16 x, i16 y, i16 w, i16 h), parent-relative.
  ;; Indexed by window slot (same index as CONTROL_TABLE / WND_RECORDS).

  (func $ctrl_geom_addr (param $slot i32) (result i32)
    (i32.add (global.get $CONTROL_GEOM) (i32.mul (local.get $slot) (i32.const 8))))

  (func $ctrl_geom_set
    (param $slot i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (local $a i32)
    (local.set $a (call $ctrl_geom_addr (local.get $slot)))
    (i32.store16        (local.get $a) (local.get $x))
    (i32.store16 offset=2 (local.get $a) (local.get $y))
    (i32.store16 offset=4 (local.get $a) (local.get $w))
    (i32.store16 offset=6 (local.get $a) (local.get $h)))

  ;; Keep CONTROL_GEOM in sync with MoveWindow/SetWindowPos for WAT-managed
  ;; controls and child dialogs. $flags uses SWP_NOSIZE(1) / SWP_NOMOVE(2)
  ;; like SetWindowPos; MoveWindow callers pass 0. No-op only for true
  ;; top-level/non-WAT windows. Dialog windows have class==0 but a parent.
  (func $ctrl_geom_sync
        (param $hwnd i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32) (param $flags i32)
    (local $idx i32) (local $a i32) (local $parent i32) (local $moved i32)
    (local $ox i32) (local $oy i32) (local $ow i32) (local $oh i32)
    (local $hdc i32) (local $brush i32) (local $slot i32) (local $shrank i32)
    (if (i32.and
          (i32.eqz (call $ctrl_table_get_class (local.get $hwnd)))
          (i32.eqz (call $wnd_get_parent (local.get $hwnd))))
      (then (return)))
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1)) (then (return)))
    (local.set $a (call $ctrl_geom_addr (local.get $idx)))
    ;; A control that moves OR shrinks leaves its old pixels behind: children
    ;; have no surface of their own, they draw onto the parent's back-canvas,
    ;; so nothing repaints the rectangle it vacated. Win32 erases the parent
    ;; over the uncovered region for exactly this reason. fontview.exe
    ;; right-aligns its Print button on startup, and the strip it moved off
    ;; stayed on screen as a slice of a second button.
    ;;
    ;; The SHRINK half matters just as much and is not a special case of the
    ;; move: RegEdit's splitter drag leaves the tree pane at the same x,y and
    ;; takes 82px off its WIDTH, so SetWindowPos passes SWP_NOMOVE and the
    ;; move test never ran. The strip the tree gave up kept its own white
    ;; interior; the sibling list pane covers most of it when it slides over,
    ;; and what is left is the 4px splitter gap, painted white instead of the
    ;; dialog face. That is the visible "RegEdit does not repaint its window".
    ;;
    ;; Only for WAT-native controls, whose pixels WAT owns and must
    ;; therefore clean up after. An application's own child window paints
    ;; itself from its own WM_PAINT and lays itself out against siblings
    ;; this code knows nothing about; erasing under one of those with the
    ;; parent's brush wipes application output that nothing will redraw.
    ;; mspaint moves its canvas and toolbars during startup layout and the
    ;; ungated erase blanked its client area.
    (local.set $ox (i32.load16_s (local.get $a)))
    (local.set $oy (i32.load16_s offset=2 (local.get $a)))
    (local.set $ow (i32.load16_u offset=4 (local.get $a)))
    (local.set $oh (i32.load16_u offset=6 (local.get $a)))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 2))) ;; !SWP_NOMOVE
      (then
        (local.set $moved (i32.or
          (i32.ne (local.get $ox) (local.get $x))
          (i32.ne (local.get $oy) (local.get $y))))
        (i32.store16        (local.get $a) (local.get $x))
        (i32.store16 offset=2 (local.get $a) (local.get $y))))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 1))) ;; !SWP_NOSIZE
      (then
        (local.set $shrank (i32.or
          (i32.lt_s (local.get $w) (local.get $ow))
          (i32.lt_s (local.get $h) (local.get $oh))))
        (i32.store16 offset=4 (local.get $a) (local.get $w))
        (i32.store16 offset=6 (local.get $a) (local.get $h))))
    ;; Geometry still commits under SWP_NOREDRAW, but neither the old parent
    ;; pixels nor sibling update regions may change. MoveWindow(FALSE) and
    ;; deferred SetWindowPos batches share this path too.
    (if (i32.and (local.get $flags) (i32.const 0x0008))
      (then (return)))
    (if (i32.and
          (i32.and
            (i32.or (local.get $moved) (local.get $shrank))
            (i32.ne (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 0)))
          (i32.and (i32.gt_s (local.get $ow) (i32.const 0))
                   (i32.gt_s (local.get $oh) (i32.const 0))))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then
            ;; CONTROL_GEOM is parent-client relative, which is what a
            ;; client DC on the parent draws in.
            (local.set $hdc
              (call $host_alloc_window_dc (local.get $parent) (i32.const 0)))
            (if (local.get $hdc)
              (then
                (local.set $brush (call $wnd_get_bg_brush (local.get $parent)))
                (if (i32.eqz (local.get $brush))
                  (then (local.set $brush (i32.const 0x30011)))) ;; COLOR_3DFACE
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                  (local.get $ox) (local.get $oy)
                  (i32.add (local.get $ox) (local.get $ow))
                  (i32.add (local.get $oy) (local.get $oh))
                  (local.get $brush)))
                (drop (call $host_release_dc (local.get $hdc)))))
            (call $invalidate_hwnd (local.get $parent))
            ;; A sibling may overlap what was just erased, so repaint the
            ;; whole set rather than leaving a hole where one of them was.
            (local.set $slot (i32.const 0))
            (block $sib_done (loop $sib
              (local.set $slot
                (call $wnd_next_child_slot (local.get $parent) (local.get $slot)))
              (br_if $sib_done (i32.eq (local.get $slot) (i32.const -1)))
              (call $invalidate_hwnd (call $wnd_slot_hwnd (local.get $slot)))
              (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
              (br $sib))))))))

  ;; Pack x|y<<16 / w|h<<16 for export to JS.
  (func $ctrl_get_xy_packed (param $hwnd i32) (result i32)
    (local $idx i32) (local $a i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $a (call $ctrl_geom_addr (local.get $idx)))
    (i32.or (i32.load16_u (local.get $a))
            (i32.shl (i32.load16_u offset=2 (local.get $a)) (i32.const 16))))

  (func $ctrl_get_wh_packed (param $hwnd i32) (result i32)
    (local $idx i32) (local $a i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $a (call $ctrl_geom_addr (local.get $idx)))
    (i32.or (i32.load16_u offset=4 (local.get $a))
            (i32.shl (i32.load16_u offset=6 (local.get $a)) (i32.const 16))))

  ;; The width and height halves of $ctrl_get_wh_packed. Nearly every control
  ;; wndproc starts by unpacking that word into two locals with the same two
  ;; shifts and masks, ~30 times across this file; a caller that only wants one
  ;; dimension had to write both. Named accessors so the packing is stated once.
  (func $ctrl_get_w (param $hwnd i32) (result i32)
    (i32.and (call $ctrl_get_wh_packed (local.get $hwnd)) (i32.const 0xFFFF)))

  (func $ctrl_get_h (param $hwnd i32) (result i32)
    (i32.shr_u (call $ctrl_get_wh_packed (local.get $hwnd)) (i32.const 16)))

  ;; ---- Control table helpers (legacy CONTROL_TABLE) ----

  (func $statusbar_normal_ptr (param $sw ptr<StatusBarState>) (result i32)
    (load.field StatusBarState normal_text_ptr (local.get $sw)))
  (func $statusbar_set_normal_ptr (param $sw ptr<StatusBarState>) (param $v i32)
    (store.field StatusBarState normal_text_ptr (local.get $sw) (local.get $v)))
  (func $statusbar_normal_len (param $sw ptr<StatusBarState>) (result i32)
    (load.field.memarg StatusBarState normal_text_len (local.get $sw)))
  (func $statusbar_set_normal_len (param $sw ptr<StatusBarState>) (param $v i32)
    (store.field.memarg StatusBarState normal_text_len (local.get $sw) (local.get $v)))
  (func $statusbar_simple_ptr (param $sw ptr<StatusBarState>) (result i32)
    (load.field.memarg StatusBarState simple_text_ptr (local.get $sw)))
  (func $statusbar_set_simple_ptr (param $sw ptr<StatusBarState>) (param $v i32)
    (store.field.memarg StatusBarState simple_text_ptr (local.get $sw) (local.get $v)))
  (func $statusbar_simple_len (param $sw ptr<StatusBarState>) (result i32)
    (load.field.memarg StatusBarState simple_text_len (local.get $sw)))
  (func $statusbar_set_simple_len (param $sw ptr<StatusBarState>) (param $v i32)
    (store.field.memarg StatusBarState simple_text_len (local.get $sw) (local.get $v)))
  (func $statusbar_simple_mode (param $sw ptr<StatusBarState>) (result i32)
    (load.field.memarg StatusBarState simple_mode (local.get $sw)))
  (func $statusbar_set_simple_mode (param $sw ptr<StatusBarState>) (param $v i32)
    (store.field.memarg StatusBarState simple_mode (local.get $sw) (local.get $v)))
  (func $statusbar_font (param $sw ptr<StatusBarState>) (result i32)
    (load.field.memarg StatusBarState font (local.get $sw)))
  (func $statusbar_set_font (param $sw ptr<StatusBarState>) (param $v i32)
    (store.field.memarg StatusBarState font (local.get $sw) (local.get $v)))

  ;; Copy one status-bar string from a WASM address into state-owned guest
  ;; storage. Allocate before retiring the old string so an OOM leaves the
  ;; status bar exactly as it was.
  (func $statusbar_state_store_text
      (param $sw ptr<StatusBarState>) (param $simple i32)
      (param $src_wa i32) (param $len i32) (result i32)
    (local $old i32) (local $buf i32) (local $buf_wa i32)
    (if (i32.gt_u (local.get $len) (i32.const 255))
      (then (local.set $len (i32.const 255))))
    (local.set $old
      (if (result i32) (local.get $simple)
        (then (call $statusbar_simple_ptr (local.get $sw)))
        (else (call $statusbar_normal_ptr (local.get $sw)))))
    (if (i32.eqz (local.get $len))
      (then
        (if (local.get $old) (then (call $heap_free (local.get $old))))
        (if (local.get $simple)
          (then
            (call $statusbar_set_simple_ptr (local.get $sw) (i32.const 0))
            (call $statusbar_set_simple_len (local.get $sw) (i32.const 0)))
          (else
            (call $statusbar_set_normal_ptr (local.get $sw) (i32.const 0))
            (call $statusbar_set_normal_len (local.get $sw) (i32.const 0))))
        (return (i32.const 1))))
    (local.set $buf (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 0))))
    (local.set $buf_wa (call $g2w (local.get $buf)))
    (memory.copy (local.get $buf_wa) (local.get $src_wa) (local.get $len))
    (i32.store8 (i32.add (local.get $buf_wa) (local.get $len)) (i32.const 0))
    (if (local.get $old) (then (call $heap_free (local.get $old))))
    (if (local.get $simple)
      (then
        (call $statusbar_set_simple_ptr (local.get $sw) (local.get $buf))
        (call $statusbar_set_simple_len (local.get $sw) (local.get $len)))
      (else
        (call $statusbar_set_normal_ptr (local.get $sw) (local.get $buf))
        (call $statusbar_set_normal_len (local.get $sw) (local.get $len))))
    (i32.const 1))

  (func $statusbar_state_publish (param $hwnd i32) (param $sw ptr<StatusBarState>)
    (local $ptr i32) (local $len i32)
    (if (call $statusbar_simple_mode (local.get $sw))
      (then
        (local.set $ptr (call $statusbar_simple_ptr (local.get $sw)))
        (local.set $len (call $statusbar_simple_len (local.get $sw))))
      (else
        (local.set $ptr (call $statusbar_normal_ptr (local.get $sw)))
        (local.set $len (call $statusbar_normal_len (local.get $sw)))))
    (call $title_table_set
      (local.get $hwnd)
      (if (result i32) (local.get $ptr)
        (then (call $g2w (local.get $ptr)))
        (else (i32.const 0)))
      (local.get $len))
    (call $invalidate_hwnd (local.get $hwnd)))

  ;; Lazily attach the paint mirror. Registered native status bars do not run
  ;; their WM_CREATE through the WAT proc, so seed pane zero from TITLE_TABLE
  ;; the first time one of their status messages reaches us.
  (func $statusbar_state_get (param $hwnd i32) (param $create i32) (result i32)
    (local $state i32) (local $sw ptr<StatusBarState>)
    (local $title_wa i32) (local $title_len i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (local.get $state) (then (return (local.get $state))))
    (if (i32.eqz (local.get $create)) (then (return (i32.const 0))))
    (local.set $state (call $heap_alloc (size-of StatusBarState)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (cast ptr<StatusBarState> (call $g2w (local.get $state))))
    (memory.fill (local.get $sw) (i32.const 0) (size-of StatusBarState))
    (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
    (local.set $title_wa (call $title_table_get_ptr (local.get $hwnd)))
    (local.set $title_len (call $title_table_get_len (local.get $hwnd)))
    (if (i32.and (i32.ne (local.get $title_wa) (i32.const 0))
                 (i32.ne (local.get $title_len) (i32.const 0)))
      (then
        (drop (call $statusbar_state_store_text
          (local.get $sw) (i32.const 0)
          (local.get $title_wa) (local.get $title_len)))))
    (local.get $state))

  (func $statusbar_state_release (param $hwnd i32)
    (local $state i32) (local $sw ptr<StatusBarState>) (local $ptr i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (cast ptr<StatusBarState> (call $g2w (local.get $state))))
    (local.set $ptr (call $statusbar_normal_ptr (local.get $sw)))
    (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
    (local.set $ptr (call $statusbar_simple_ptr (local.get $sw)))
    (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
    (call $heap_free (local.get $state))
    (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0)))

  ;; Both hybrid control families keep one bit per window slot. Keep bounds
  ;; and bit addressing in one place; the family wrappers own the region.
  (func $native_control_mark_slot (param $base i32) (param $slot i32) (param $marked i32)
    (local $addr i32) (local $mask i32) (local $value i32)
    (if (i32.or (i32.lt_s (local.get $slot) (i32.const 0))
                (i32.ge_u (local.get $slot) (global.get $MAX_WINDOWS)))
      (then (return)))
    (local.set $addr
      (i32.add (local.get $base)
        (i32.shr_u (local.get $slot) (i32.const 3))))
    (local.set $mask
      (i32.shl (i32.const 1) (i32.and (local.get $slot) (i32.const 7))))
    (local.set $value (i32.load8_u (local.get $addr)))
    (i32.store8 (local.get $addr)
      (if (result i32) (local.get $marked)
        (then (i32.or (local.get $value) (local.get $mask)))
        (else (i32.and (local.get $value) (i32.xor (local.get $mask) (i32.const 0xFF)))))))

  (func $native_control_is_marked (param $base i32) (param $hwnd i32) (result i32)
    (local $slot i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.lt_s (local.get $slot) (i32.const 0))
      (then (return (i32.const 0))))
    (i32.and
      (i32.shr_u
        (i32.load8_u
          (i32.add (local.get $base)
            (i32.shr_u (local.get $slot) (i32.const 3))))
        (i32.and (local.get $slot) (i32.const 7)))
      (i32.const 1)))

  ;; Mark a registered native status-bar window without classifying it as a
  ;; WAT control. Its guest comctl32/MFC wndproc remains authoritative for
  ;; CCS_BOTTOM layout; WAT paints the shared renderer surface.
  (func $statusbar_native_mark_slot (param $slot i32) (param $marked i32)
    (call $native_control_mark_slot (global.get $NATIVE_STATUS_BITS)
      (local.get $slot) (local.get $marked)))

  (func $statusbar_native_is (param $hwnd i32) (result i32)
    (call $native_control_is_marked (global.get $NATIVE_STATUS_BITS) (local.get $hwnd)))

  ;; Hybrid SysTabControl32 marker. The real COMCTL32 wndproc remains installed
  ;; for TCM_ADJUSTRECT, page switching, and hit-testing; WAT mirrors only the
  ;; short tab labels/selection needed to paint Win98 chrome on the shared
  ;; parent surface.
  (func $tab_native_mark_slot (param $slot i32) (param $marked i32)
    (call $native_control_mark_slot (global.get $NATIVE_TAB_BITS)
      (local.get $slot) (local.get $marked)))

  (func $tab_native_is (param $hwnd i32) (result i32)
    (call $native_control_is_marked (global.get $NATIVE_TAB_BITS) (local.get $hwnd)))

  ;; COMCTL32 owns the ordinary per-window state pointer. Keep our paint mirror
  ;; separate so observing TCM_* messages cannot corrupt its WM_CREATE state.
  (func $tab_native_state_get (param $hwnd i32) (param $create i32) (result i32)
    (local $i i32) (local $addr i32) (local $empty i32) (local $state i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (i32.const 32)))
      (local.set $addr (i32.add (global.get $TAB_NATIVE_STATE_TABLE)
        (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
        (then (return (i32.load offset=4 (local.get $addr)))))
      (if (i32.and (i32.eqz (local.get $empty))
                   (i32.eqz (i32.load (local.get $addr))))
        (then (local.set $empty (local.get $addr))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.or (i32.eqz (local.get $create)) (i32.eqz (local.get $empty)))
      (then (return (i32.const 0))))
    (local.set $state (call $heap_alloc (i32.const 128)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (call $zero_memory (call $g2w (local.get $state)) (i32.const 128))
    (i32.store (local.get $empty) (local.get $hwnd))
    (i32.store offset=4 (local.get $empty) (local.get $state))
    (local.get $state))

  ;; Selected tab, or -1 when this window has no mirror state yet. The mirror
  ;; is updated by $tab_native_note_message before any wndproc sees the click,
  ;; so a WAT-owned tab strip can read its own new selection on WM_LBUTTONDOWN.
  (func $tab_native_cursel (param $hwnd i32) (result i32)
    (local $state i32)
    (local.set $state (call $tab_native_state_get (local.get $hwnd) (i32.const 0)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const -1))))
    (i32.load offset=4 (call $g2w (local.get $state))))

  (func $tab_native_state_release (param $hwnd i32)
    (local $i i32) (local $addr i32) (local $state i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (i32.const 32)))
      (local.set $addr (i32.add (global.get $TAB_NATIVE_STATE_TABLE)
        (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
        (then
          (local.set $state (i32.load offset=4 (local.get $addr)))
          (if (local.get $state) (then (call $heap_free (local.get $state))))
          (i64.store (local.get $addr) (i64.const 0))
          (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; Tab mirror state is 128 inline bytes: count@0, selected@4, followed by
  ;; eight 15-byte records {len:u8, text[14]}. No secondary allocations are
  ;; needed. It lives in TAB_NATIVE_STATE_TABLE, not COMCTL32's window state.
  (func $tab_native_note_message
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32)
    (local $state i32) (local $sw ptr<TabNativeState>) (local $item_w i32)
    (local $count i32) (local $index i32) (local $i i32) (local $j i32)
    (local $src i32) (local $dst i32) (local $text_g i32) (local $text_w i32)
    (local $len i32) (local $x i32) (local $left i32) (local $right i32)
    (if (i32.eqz (call $tab_native_is (local.get $hwnd))) (then (return)))
    ;; Do not allocate while forwarding WM_CREATE or unrelated private traffic.
    ;; TCM_INSERTITEMW (0x133E) matters as much as the A form: a Unicode app
    ;; adds its tabs through it and only through it, so mirroring just the A
    ;; message left the state at zero tabs and $tab_native_paint drew an empty
    ;; strip -- XP Sound Recorder's File > Properties showed no "Details" tab.
    (if (i32.and
          (i32.and
            (i32.ne (local.get $msg) (i32.const 0x1307))
            (i32.ne (local.get $msg) (i32.const 0x133E)))
          (i32.and
            (i32.ne (local.get $msg) (i32.const 0x1309))
            (i32.and
              (i32.ne (local.get $msg) (i32.const 0x130C))
              (i32.ne (local.get $msg) (i32.const 0x0201)))))
      (then (return)))
    (local.set $state (call $tab_native_state_get (local.get $hwnd) (i32.const 1)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (cast ptr<TabNativeState> (call $g2w (local.get $state))))
    (local.set $count (load.field TabNativeState count (local.get $sw)))
    ;; TCM_INSERTITEMA / TCM_INSERTITEMW — TCITEMA and TCITEMW share their
    ;; layout (pszText at +12); only the string's width differs.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x1307))
                (i32.eq (local.get $msg) (i32.const 0x133E)))
      (then
        (if (i32.ge_u (local.get $count) (i32.const 8)) (then (return)))
        (local.set $index (local.get $wParam))
        (if (i32.gt_u (local.get $index) (local.get $count))
          (then (local.set $index (local.get $count))))
        ;; Shift records [$index, $count) back one 15-byte slot. The old nested
        ;; loop walked records high-to-low and each record's bytes last-to-first
        ;; — that is exactly memmove of the whole run for a destination above
        ;; the source, which is what memory.copy gives us in one op.
        (local.set $dst (i32.add (i32.add (local.get $sw) (i32.const 8))
          (i32.mul (local.get $index) (i32.const 15))))
        (memory.copy
          (i32.add (local.get $dst) (i32.const 15))
          (local.get $dst)
          (i32.mul (i32.sub (local.get $count) (local.get $index)) (i32.const 15)))
        (call $zero_memory (local.get $dst) (i32.const 15))
        (if (local.get $lParam)
          (then
            (local.set $item_w (call $g2w (local.get $lParam)))
            (if (i32.and (i32.load (local.get $item_w)) (i32.const 1)) ;; TCIF_TEXT
              (then
                (local.set $text_g (i32.load offset=12 (local.get $item_w)))
                (if (local.get $text_g)
                  (then
                    (local.set $text_w (call $g2w (local.get $text_g)))
                    (if (i32.eq (local.get $msg) (i32.const 0x133E))
                      (then
                        ;; Narrow the label straight into the fixed record.
                        (local.set $len (call $guest_wcslen (local.get $text_g)))
                        (if (i32.gt_u (local.get $len) (i32.const 14))
                          (then (local.set $len (i32.const 14))))
                        (i32.store8 (local.get $dst) (local.get $len))
                        (local.set $j (i32.const 0))
                        (block $wdone (loop $wcopy
                          (br_if $wdone (i32.ge_u (local.get $j) (local.get $len)))
                          (i32.store8
                            (i32.add (i32.add (local.get $dst) (i32.const 1)) (local.get $j))
                            (call $gl16 (i32.add (local.get $text_g)
                              (i32.mul (local.get $j) (i32.const 2)))))
                          (local.set $j (i32.add (local.get $j) (i32.const 1)))
                          (br $wcopy))))
                      (else
                        (local.set $len (call $strlen (local.get $text_w)))
                        (if (i32.gt_u (local.get $len) (i32.const 14))
                          (then (local.set $len (i32.const 14))))
                        (i32.store8 (local.get $dst) (local.get $len))
                        (if (local.get $len)
                          (then (call $memcpy (i32.add (local.get $dst) (i32.const 1))
                            (local.get $text_w) (local.get $len))))))))))))
        (store.field TabNativeState count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return)))
    ;; TCM_DELETEALLITEMS
    (if (i32.eq (local.get $msg) (i32.const 0x1309))
      (then
        (store.field TabNativeState count (local.get $sw) (i32.const 0))
        (store.field.memarg TabNativeState selected (local.get $sw) (i32.const 0))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return)))
    ;; TCM_SETCURSEL
    (if (i32.eq (local.get $msg) (i32.const 0x130C))
      (then
        (if (i32.lt_u (local.get $wParam) (local.get $count))
          (then (store.field.memarg TabNativeState selected (local.get $sw) (local.get $wParam))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return)))
    ;; Mirror direct mouse selection while the guest proc remains authoritative.
    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $x (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $i (i32.const 0))
        (local.set $left (i32.const 0))
        (block $hit_done (loop $hit
          (br_if $hit_done (i32.ge_u (local.get $i) (local.get $count)))
          (local.set $src (i32.add (i32.add (local.get $sw) (i32.const 8))
            (i32.mul (local.get $i) (i32.const 15))))
          (local.set $right (i32.add (local.get $left)
            (i32.add (i32.mul (i32.load8_u (local.get $src)) (i32.const 5)) (i32.const 16))))
          (if (i32.and (i32.ge_u (local.get $x) (local.get $left))
                       (i32.lt_u (local.get $x) (local.get $right)))
            (then
              (store.field.memarg TabNativeState selected (local.get $sw) (local.get $i))
              (call $paint_flag_set_inv (local.get $hwnd))
              (br $hit_done)))
          (local.set $left (local.get $right))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $hit)))))
    )

  ;; A property sheet's page dialog is a sibling of its tab control, inset
  ;; below the tab row. The tab owns the exposed band above that sibling, but
  ;; not the page itself: clearing the full client area here would erase
  ;; controls that have already painted into the shared top-level surface.
  (func $tab_native_page_top (param $hwnd i32) (param $height i32) (result i32)
    (local $parent i32) (local $slot i32) (local $child i32)
    (local $tab_y i32) (local $child_y i32) (local $page_top i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return (i32.const 21))))
    (local.set $tab_y (call $ctrl_get_y_s (local.get $hwnd)))
    (local.set $slot (i32.const 0))
    (block $done (loop $scan
      (local.set $slot (call $wnd_next_child_slot (local.get $parent) (local.get $slot)))
      (br_if $done (i32.lt_s (local.get $slot) (i32.const 0)))
      (local.set $child (call $wnd_slot_hwnd (local.get $slot)))
      (if (i32.and
            (i32.eq (call $wnd_table_get (local.get $child)) (global.get $WNDPROC_DIALOG))
            (call $wnd_is_effectively_visible (local.get $child)))
        (then
          (local.set $child_y
            (i32.sub (call $ctrl_get_y_s (local.get $child)) (local.get $tab_y)))
          (if (i32.and
                (i32.gt_s (local.get $child_y) (i32.const 21))
                (i32.lt_s (local.get $child_y) (local.get $height)))
            (then
              (if (i32.or (i32.eqz (local.get $page_top))
                          (i32.lt_s (local.get $child_y) (local.get $page_top)))
                (then (local.set $page_top (local.get $child_y))))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (select (local.get $page_top) (i32.const 21) (i32.ne (local.get $page_top) (i32.const 0))))

  (func $tab_native_paint (param $hwnd i32) (result i32)
    (local $state i32) (local $sw ptr<TabNativeState>) (local $hdc i32) (local $sz i32)
    (local $w i32) (local $h i32) (local $count i32) (local $selected i32)
    (local $i i32) (local $rec i32) (local $len i32)
    (local $left i32) (local $right i32) (local $top i32) (local $page_top i32)
    (local.set $state (call $tab_native_state_get (local.get $hwnd) (i32.const 0)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (cast ptr<TabNativeState> (call $g2w (local.get $state))))
    (local.set $count (load.field TabNativeState count (local.get $sw)))
    (local.set $selected (load.field.memarg TabNativeState selected (local.get $sw)))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h)))
      (then (return (i32.const 0))))
    (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
    ;; Only clear the chrome strip. Child pages paint into this common backing
    ;; surface too, and a late tab repaint must not erase their topic tree.
    (drop (call $gdi_native_fill_rect (local.get $hdc)
      (i32.const 0) (i32.const 0) (local.get $w) (i32.const 21) (i32.const 0x30011)))
    ;; Clear only the page-frame band that no visible page dialog owns. This
    ;; is the strip WinRAR exposes after switching Settings pages.
    (local.set $page_top
      (call $tab_native_page_top (local.get $hwnd) (local.get $h)))
    (if (i32.gt_s (local.get $page_top) (i32.const 21))
      (then
        (drop (call $gdi_native_fill_rect (local.get $hdc)
          (i32.const 2) (i32.const 21) (i32.sub (local.get $w) (i32.const 2))
          (local.get $page_top) (i32.const 0x30011)))))
    ;; Native Win98 tabs use a 20px row and merge the selected tab into the
    ;; raised page frame beneath it.
    (drop (call $gdi_native_draw_edge (local.get $hdc)
      (i32.const 0) (i32.const 19) (local.get $w) (local.get $h)
      (i32.const 0x05) (i32.const 0x0F)))
    (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
    (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
    (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0)))
    (local.set $i (i32.const 0))
    (local.set $left (i32.const 0))
    (block $done (loop $tabs
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (i32.add (local.get $sw) (i32.const 8))
        (i32.mul (local.get $i) (i32.const 15))))
      (local.set $len (i32.load8_u (local.get $rec)))
      (local.set $right (i32.add (local.get $left)
        (i32.add (i32.mul (local.get $len) (i32.const 5)) (i32.const 16))))
      (local.set $top (select (i32.const 0) (i32.const 2)
        (i32.eq (local.get $i) (local.get $selected))))
      (drop (call $gdi_native_fill_rect (local.get $hdc)
        (local.get $left) (local.get $top) (local.get $right) (i32.const 20)
        (i32.const 0x30011)))
      (drop (call $gdi_native_draw_edge (local.get $hdc)
        (local.get $left) (local.get $top) (local.get $right) (i32.const 20)
        (i32.const 0x05) (i32.const 0x07))) ;; BF_LEFT|TOP|RIGHT
      (if (i32.eq (local.get $i) (local.get $selected))
        (then
          ;; Erase the page's top edge under the selected tab.
          (drop (call $gdi_native_fill_rect (local.get $hdc)
            (i32.add (local.get $left) (i32.const 2)) (i32.const 18)
            (i32.sub (local.get $right) (i32.const 2)) (i32.const 21)
            (i32.const 0x30011)))))
      (if (local.get $len)
        (then
          (drop (call $gdi_native_text_out (local.get $hdc)
            (i32.add (local.get $left) (i32.const 8))
            (i32.add (local.get $top) (i32.const 3))
            (i32.add (local.get $rec) (i32.const 1)) (local.get $len) (i32.const 0)))))
      (local.set $left (local.get $right))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $tabs)))
    (i32.const 1))

  ;; One CONTROL_TABLE row, parallel to the WND_RECORDS slot of the same index:
  ;;
  ;;   +0  class       one of the CTRL_CLASS_* ids, 0 for a non-control window
  ;;   +4  ctrl_id     the child/menu id CreateWindow was given
  ;;   +8  check_state legacy checkbox/radio state; ButtonState owns this when
  ;;                   the window has one (see $ctrl_get_check_state)
  ;;   +12 ex_style    per-control WS_EX_* written by $dlg_load
  ;;
  ;; Every reader of the row goes through this so the stride is stated once.
  (func $ctrl_slot_addr (param $slot i32) (result i32)
    (i32.add (global.get $CONTROL_TABLE) (i32.mul (local.get $slot) (i32.const 16))))

  ;; Set control class and ID for a window table slot
  (func $ctrl_table_set (param $slot i32) (param $class i32) (param $ctrl_id i32)
    (local $addr i32)
    (local.set $addr (call $ctrl_slot_addr (local.get $slot)))
    (i32.store (local.get $addr) (local.get $class))
    (i32.store offset=4 (local.get $addr) (local.get $ctrl_id))
    (i32.store offset=8 (local.get $addr) (i32.const 0))  ;; check_state = 0
    (i32.store offset=12 (local.get $addr) (i32.const 0)) ;; ex_style
  )

  ;; Clear per-slot WAT control metadata when WND_RECORDS reuses a slot.
  (func $ctrl_table_reset_slot (param $slot i32)
    (local $addr i32)
    (call $tab_native_state_release (call $wnd_slot_hwnd (local.get $slot)))
    (if (i32.or
          (i32.eq (i32.load (call $ctrl_slot_addr (local.get $slot))) (i32.const 22))
          (call $statusbar_native_is (call $wnd_slot_hwnd (local.get $slot))))
      (then (call $statusbar_state_release (call $wnd_slot_hwnd (local.get $slot)))))
    (call $statusbar_native_mark_slot (local.get $slot) (i32.const 0))
    (call $tab_native_mark_slot (local.get $slot) (i32.const 0))
    (local.set $addr (call $ctrl_slot_addr (local.get $slot)))
    (i64.store (local.get $addr) (i64.const 0))
    (i64.store offset=8 (local.get $addr) (i64.const 0))
    (local.set $addr (call $ctrl_geom_addr (local.get $slot)))
    (i64.store (local.get $addr) (i64.const 0)))

  ;; Per-control WS_EX_* flags. Stored in CONTROL_TABLE+12 by $dlg_load
  ;; so static_wndproc / button_wndproc can render WS_EX_CLIENTEDGE etc.
  (func $ctrl_set_ex_style (param $hwnd i32) (param $ex i32)
    (local $idx i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.ne (local.get $idx) (i32.const -1))
      (then
        (i32.store offset=12 (call $ctrl_slot_addr (local.get $idx)) (local.get $ex)))))
  (func $ctrl_get_ex_style (param $hwnd i32) (result i32)
    (local $idx i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1)) (then (return (i32.const 0))))
    (i32.load offset=12 (call $ctrl_slot_addr (local.get $idx))))

  ;; Get control class for a hwnd (returns 0 if not a control)
  (func $ctrl_table_get_class (param $hwnd i32) (result i32)
    (local $idx i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1))
      (then (return (i32.const 0))))
    (i32.load (call $ctrl_slot_addr (local.get $idx)))
  )

  (func $ctrl_table_get_id (param $hwnd i32) (result i32)
    (local $idx i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1))
      (then (return (i32.const 0))))
    (i32.load offset=4 (call $ctrl_slot_addr (local.get $idx))))

  ;; Change a child window's control/menu ID and return its previous value.
  ;; MFC temporarily renames views while installing Print Preview, then finds
  ;; the saved view by its replacement ID when preview closes.
  (func $ctrl_table_set_id (param $hwnd i32) (param $ctrl_id i32) (result i32)
    (local $idx i32) (local $addr i32) (local $old i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1))
      (then (return (i32.const 0))))
    (local.set $addr (call $ctrl_slot_addr (local.get $idx)))
    (local.set $old (i32.load offset=4 (local.get $addr)))
    (i32.store offset=4 (local.get $addr) (local.get $ctrl_id))
    (local.get $old))

  ;; One encoding for native check state; preserve pressed/default/focus bits.
  (func $btn_normalize_check (param $hwnd i32) (param $check i32) (result i32)
    (local $kind i32)
    (local.set $kind (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 15)))
    (if (i32.eqz (i32.or
          (i32.and (i32.ge_u (local.get $kind) (i32.const 2))
                   (i32.le_u (local.get $kind) (i32.const 6)))
          (i32.eq (local.get $kind) (i32.const 9))))
      (then (return (i32.const -1)))) ;; Not a checkbox/radio: ignore setters.
    (if (i32.and (i32.eq (local.get $check) (i32.const 2))
          (i32.or (i32.eq (local.get $kind) (i32.const 5))
                  (i32.eq (local.get $kind) (i32.const 6))))
      (then (return (i32.const 2))))
    (i32.ne (local.get $check) (i32.const 0)))

  (func $btn_check_from_flags (param $flags i32) (result i32)
    (select (i32.const 2)
      (i32.and (i32.shr_u (local.get $flags) (i32.const 1)) (i32.const 1))
      (i32.and (local.get $flags) (i32.const 0x100))))

  (func $btn_flags_with_check (param $flags i32) (param $check i32) (result i32)
    (i32.or (i32.and (local.get $flags) (i32.const -259))
      (select (i32.const 0x100)
        (select (i32.const 2) (i32.const 0) (i32.eq (local.get $check) (i32.const 1)))
        (i32.eq (local.get $check) (i32.const 2)))))

  ;; Get check state for a control hwnd (legacy CONTROL_TABLE path)
  (func $ctrl_get_check_state (param $hwnd i32) (result i32)
    (local $idx i32) (local $state i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (local.get $state)
      (then
        (return (call $btn_check_from_flags (call $btn_flags (call $g2w (local.get $state)))))))
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1))
      (then (return (i32.const 0))))
    (i32.load offset=8 (call $ctrl_slot_addr (local.get $idx)))
  )

  ;; Set check state for a control hwnd (legacy CONTROL_TABLE path)
  (func $ctrl_set_check_state (param $hwnd i32) (param $state i32)
    (local $idx i32) (local $btn_state i32) (local $btn_state_w i32) (local $flags i32)
    (local.set $state (call $btn_normalize_check (local.get $hwnd) (local.get $state)))
    (if (i32.lt_s (local.get $state) (i32.const 0)) (then (return)))
    (local.set $btn_state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (local.get $btn_state)
      (then
        (local.set $btn_state_w (call $g2w (local.get $btn_state)))
        (local.set $flags (call $btn_flags_with_check
          (call $btn_flags (local.get $btn_state_w)) (local.get $state)))
        (call $btn_set_flags (local.get $btn_state_w) (local.get $flags))))
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.ne (local.get $idx) (i32.const -1))
      (then
        (i32.store offset=8 (call $ctrl_slot_addr (local.get $idx)) (local.get $state))))
  )

  ;; Enumerate WAT-managed child windows of a parent. Caller starts with
  ;; $start_slot=0 and gets back (hwnd, next_slot) packed: hwnd in low
  ;; bits, but we use a single i32 hwnd return + a side-channel for the
  ;; next slot via $ctrl_enum_next_slot. Simpler API: the caller passes
  ;; a starting slot index, and the result is the next-occupied slot whose
  ;; parent matches, or -1 if no more. The caller separately reads hwnd
  ;; via $wnd_slot_hwnd. Cheap because slot iteration is O(MAX_WINDOWS).
  (func $wnd_next_child_slot (param $parent i32) (param $start i32) (result i32)
    (local $i i32) (local $addr i32) (local $hwnd i32)
    (local.set $i (local.get $start))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
        (local.set $addr (call $wnd_record_addr (local.get $i)))
        (local.set $hwnd (load.field WndRecord hwnd (local.get $addr)))
        (if (i32.and (i32.ne (local.get $hwnd) (i32.const 0))
                     (i32.eq (load.field.memarg WndRecord parent (local.get $addr)) (local.get $parent)))
          (then (return (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
    (i32.const -1))

  (func $wnd_slot_hwnd (param $slot i32) (result i32)
    (load.field WndRecord hwnd (call $wnd_record_addr (local.get $slot))))

  ;; Find child control hwnd by parent and control ID
  (func $ctrl_find_by_id (param $parent_hwnd i32) (param $ctrl_id i32) (result i32)
    (local $i i32)
    (local $addr i32)
    (local $hwnd i32)
    (local $ctrl_addr i32)
    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
        (local.set $addr (call $wnd_record_addr (local.get $i)))
        (local.set $hwnd (load.field WndRecord hwnd (local.get $addr)))
        (if (i32.ne (local.get $hwnd) (i32.const 0))
          (then
            (local.set $ctrl_addr (call $ctrl_slot_addr (local.get $i)))
            (if (i32.and
                  (i32.eq (call $wnd_get_parent (local.get $hwnd)) (local.get $parent_hwnd))
                  (i32.eq (i32.load offset=4 (local.get $ctrl_addr)) (local.get $ctrl_id)))
              (then (return (local.get $hwnd))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
    (i32.const 0)
  )

  ;; Mark every child control of $parent_hwnd as needing repaint.
  ;;
  ;; Erasing a parent's client area paints over whatever its children have
  ;; already put there, and a control that painted before the erase has
  ;; already cleared its own update flag -- nothing will ask it to paint
  ;; again, so its pixels are gone for the life of the window. sndvol32's
  ;; Properties dialog hits this: CheckRadioButton in WM_INITDIALOG drives
  ;; BM_SETCHECK, which repaints the three radios immediately, and the
  ;; dialog's first WM_ERASEBKGND then wipes them.
  ;;
  ;; The walk is recursive because the erase is not: a child owns no surface,
  ;; so the fill covers the whole subtree's pixels on the one top-level
  ;; back-canvas, not just the direct children's. NSIS's wizard is a dialog
  ;; whose pages are child dialogs -- reinvalidating one level left the
  ;; license page's icon, header and RichEdit erased and never asked to paint
  ;; again, and the page came up empty grey.
  (func $invalidate_child_controls (param $parent_hwnd i32)
    (local $i i32) (local $hwnd i32)
    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
        (local.set $hwnd (load.field WndRecord hwnd (call $wnd_record_addr (local.get $i))))
        (if (i32.and
              (i32.and
                (i32.ne (local.get $hwnd) (i32.const 0))
                (i32.ne (local.get $hwnd) (local.get $parent_hwnd)))
              (i32.eq (call $wnd_get_parent (local.get $hwnd)) (local.get $parent_hwnd)))
          (then
            (call $invalidate_hwnd (local.get $hwnd))
            (call $invalidate_child_controls (local.get $hwnd))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
  )

  ;; Fill a freshly-registered dialog's client area on its back-canvas with
  ;; COLOR_BTNFACE. Called right after $host_register_dialog_frame so the
  ;; dialog face shows in gaps between child controls. Equivalent to the
  ;; default WM_ERASEBKGND handler for a class with hbrBackground = BTNFACE.
  (func $dlg_fill_bkgnd (param $hwnd i32)
    (call $nc_flags_set (local.get $hwnd) (i32.const 2)))

  ;; ---- Control WndProc dispatch ----

  ;; One --trace-ctrl line for a WAT-native control. $reason is 0 when the
  ;; control is about to paint, and otherwise says why it will not:
  ;;   1 = an ancestor still owes an erase or a paint
  ;;   2 = the control (or an ancestor) is not effectively visible
  ;;   3 = its update rect is empty
  ;;   4 = it has no CONTROL_TABLE class, so this drain never paints it
  ;; A control that never appears in this trace at all was never asked --
  ;; nothing invalidated it, which is a different bug from any of the above.
  ;;
  ;; Two controls painting the same pixels, or one painting twice at
  ;; different origins, is invisible in --trace-gdi now that the GDI
  ;; primitives rasterize inside WAT. JS drops this unless --trace-ctrl.
  (func $ctrl_paint_trace_emit (param $hwnd i32) (param $class i32) (param $reason i32)
    (local $wh i32)
    (local.set $wh (call $ctrl_get_wh_packed (local.get $hwnd)))
    (call $host_ctrl_paint_trace
      (local.get $hwnd)
      ;; Reason rides above the class byte -- the packed word below is full.
      (i32.or (local.get $class) (i32.shl (local.get $reason) (i32.const 8)))
      (call $wnd_window_screen_x (local.get $hwnd))
      (call $wnd_window_screen_y (local.get $hwnd))
      (i32.and (local.get $wh) (i32.const 0xFFFF))
      (i32.or (i32.shl (i32.shr_u (local.get $wh) (i32.const 16)) (i32.const 1))
              (call $wnd_is_effectively_visible (local.get $hwnd)))
      ;; Paint order alone cannot say which surface a control lands on --
      ;; that is decided by its top-level ancestor. A child whose parent is
      ;; not the window it appears over paints onto the wrong back-canvas
      ;; and vanishes under whatever is stacked above.
      ;;
      ;; Everything reported here is a pure read. Resolving the control's
      ;; hwnd+0x40000 DC would say whether its surface exists yet, which is
      ;; the other way to paint no pixels -- but $gdi_surface_descriptor
      ;; ENSURES the window surface, so asking the question changes the
      ;; answer, and a trace call sits on every control paint.
      (i32.or
          (call $wnd_get_parent (local.get $hwnd))
          ;; state=0 is another way to paint nothing: most control
          ;; wndprocs bail out of WM_PAINT before their first primitive
          ;; when the hwnd has no state record.
          (i32.or
            (i32.shl (i32.ne (call $wnd_get_state_ptr (local.get $hwnd))
                             (i32.const 0))
                     (i32.const 25))
            ;; Low style nibble. Every class that composes its face from
            ;; primitives dispatches on it, and a value no branch claims
            ;; draws nothing at all -- indistinguishable, from the
            ;; outside, from a control that never got asked to paint.
            (i32.shl (i32.and (call $wnd_get_style (local.get $hwnd))
                              (i32.const 0x0F))
                     (i32.const 26))))))

  ;; Dispatch to the correct control wndproc based on control class
  (func $control_wndproc_dispatch (export "control_wndproc_dispatch")
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $class i32)
    (local.set $class (call $ctrl_table_get_class (local.get $hwnd)))
    ;; Disabled appearance belongs to the control procedure, not EnableWindow
    ;; itself. Guest windows may disable/re-enable themselves while painting
    ;; without requesting another WM_PAINT (Klotski does exactly that).
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x000A))
          (i32.and (i32.ne (local.get $class) (i32.const 0))
                   (i32.ne (local.get $class) (i32.const 16))))
      (then (call $invalidate_hwnd (local.get $hwnd))))
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x000F))
          (i32.ne (local.get $class) (i32.const 0)))
      (then
        ;; USER never sends WM_PAINT to a window with no visible region, and a
        ;; hidden child has none. Our children share the top-level's backing
        ;; canvas, so a paint that slips through here is not merely wasted: it
        ;; stamps pixels nothing will ever erase. mIRC's installer creates every
        ;; wizard page's controls up front and hides all but one, and every
        ;; page's text was landing on the same dialog face at once.
        (if (i32.eqz (call $wnd_is_effectively_visible (local.get $hwnd)))
          (then
            (call $ctrl_paint_trace_emit
              (local.get $hwnd) (local.get $class) (i32.const 2))
            (return (i32.const 0))))
        ;; Native control procedures paint without calling BeginPaint. Own
        ;; the corresponding update consumption here, regardless of whether
        ;; dispatch came from the pump, UpdateWindow or a subclass chaining
        ;; through CallWindowProc. Consume BEFORE painting so invalidation
        ;; during an owner callback survives for the next paint.
        ;; A supplied DC is a drawing request, not a BeginPaint transaction.
        (if (i32.eqz (local.get $wParam))
          (then
            ;; MDICLIENT has no painter of its own: USER's procedure hands
            ;; WM_PAINT to DefWindowProc, whose BeginPaint sends WM_ERASEBKGND
            ;; back through the window's current procedure. Applications that
            ;; subclass the client draw their backdrop from that erase --
            ;; SimCity 2000's MFC frame paints its title artwork there, and
            ;; clearing the erase bit unsent left its launcher on bare grey.
            (if (i32.eq (local.get $class) (i32.const 33))
              (then (call $defwndproc_paint_erase (local.get $hwnd))))
            (drop (call $paint_seed_child_paints (local.get $hwnd)))
            (call $paint_flag_clear_hwnd (local.get $hwnd))
            (call $update_clear_hwnd (local.get $hwnd))
            (call $nc_flags_clear (local.get $hwnd) (i32.const 2))))
        (call $ctrl_paint_trace_emit
          (local.get $hwnd) (local.get $class) (i32.const 0))))
    ;; Class 1 = Button
    (if (i32.eq (local.get $class) (i32.const 1))
      (then (return (call $button_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 2 = Edit; 24 = RichEdit 1.0; 25 = RichEdit 2.0+.
    ;; They share editing/painting state, while $edit_wndproc gates messages
    ;; that did not exist in the 1.0 contract.
    (if (i32.or
          (i32.eq (local.get $class) (i32.const 2))
          (i32.or (i32.eq (local.get $class) (i32.const 24))
                  (i32.eq (local.get $class) (i32.const 25))))
      (then (return (call $edit_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 3 = Static
    (if (i32.eq (local.get $class) (i32.const 3))
      (then (return (call $static_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 4 = ListBox
    (if (i32.eq (local.get $class) (i32.const 4))
      (then (return (call $listbox_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 5 = ComboBox
    (if (i32.eq (local.get $class) (i32.const 5))
      (then (return (call $combobox_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 6 = ColorGrid (ChooseColor swatches)
    (if (i32.eq (local.get $class) (i32.const 6))
      (then (return (call $colorgrid_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 7 = ScrollBar control
    (if (i32.eq (local.get $class) (i32.const 7))
      (then (return (call $scrollbar_ctrl_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 8 = TreeView (SysTreeView32)
    (if (i32.eq (local.get $class) (i32.const 8))
      (then (return (call $treeview_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 9 = ComboBox dropdown popup shell (WS_POPUP top-level owned by a combobox)
    (if (i32.eq (local.get $class) (i32.const 9))
      (then (return (call $combo_popup_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 10 = Find/Replace dialog parent (WAT-built)
    (if (i32.eq (local.get $class) (i32.const 10))
      (then (return (call $findreplace_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 11 = ShellAbout dialog parent (WAT-built)
    (if (i32.eq (local.get $class) (i32.const 11))
      (then (return (call $about_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 12 = Open / Save common dialog parent (WAT-built)
    (if (i32.eq (local.get $class) (i32.const 12))
      (then (return (call $opendlg_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 13 = Generic stub dialog (Page Setup / Print / Color / Font)
    (if (i32.eq (local.get $class) (i32.const 13))
      (then (return (call $stub_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 14 = Font (ChooseFont) dialog parent
    (if (i32.eq (local.get $class) (i32.const 14))
      (then (return (call $fontdlg_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 15 = Color (ChooseColor) dialog parent
    (if (i32.eq (local.get $class) (i32.const 15))
      (then (return (call $colordlg_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 16 = MessageBox modal dialog
    (if (i32.eq (local.get $class) (i32.const 16))
      (then (return (call $msgbox_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 17 = ProgressBar (msctls_progress32)
    (if (i32.eq (local.get $class) (i32.const 17))
      (then (return (call $progress_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 18 = ListView (SysListView32)
    (if (i32.eq (local.get $class) (i32.const 18))
      (then (return (call $listview_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 19 = TrackBar/Slider (Slider1, msctls_trackbar32)
    (if (i32.eq (local.get $class) (i32.const 19))
      (then (return (call $trackbar_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 20 = Tooltip (tooltips_class32)
    (if (i32.eq (local.get $class) (i32.const 20))
      (then (return (call $tooltip_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 21 = Toolbar (ToolbarWindow32)
    (if (i32.eq (local.get $class) (i32.const 21))
      (then (return (call $toolbar_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 22 = StatusBar (msctls_statusbar32)
    (if (i32.eq (local.get $class) (i32.const 22))
      (then (return (call $statusbar_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 23 = ChooseColor hue/saturation and luminance picker
    (if (i32.eq (local.get $class) (i32.const 23))
      (then (return (call $colorspectrum_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 26 = ChooseColor current/solid preview
    (if (i32.eq (local.get $class) (i32.const 26))
      (then (return (call $colorpreview_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 27 = Help Topics tab strip (WAT-owned SysTabControl32 page)
    (if (i32.eq (local.get $class) (i32.const 27))
      (then (return (call $help_topics_tab_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 28 = SysLink
    (if (i32.eq (local.get $class) (i32.const 28))
      (then (return (call $syslink_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 29 = Shell Run / Shut Down dialog parent (WAT-built)
    (if (i32.eq (local.get $class) (i32.const 29))
      (then (return (call $shelldlg_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; 30 = OLEDLG's Insert Object dialog; the proc lives in 09a7b-ole.wat with
    ;; the rest of OLE.
    (if (i32.eq (local.get $class) (i32.const 30))
      (then (return (call $insertobj_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 31 = the classic Win98 SHBrowseForFolder shell dialog.
    (if (i32.eq (local.get $class) (i32.const 31))
      (then (return (call $browse_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 32 = COMCTL32 PropertySheetA wizard frame.
    (if (i32.eq (local.get $class) (i32.const 32))
      (then (return (call $propsheet_wndproc (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 33 = USER's preregistered MDICLIENT window.
    (if (i32.eq (local.get $class) (i32.const 33))
      (then (return (call $mdiclient_wndproc
        (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Class 34 = COMCTL32 SysAnimate32 (09c3-wndprocs6-animate.wat).
    (if (i32.eq (local.get $class) (i32.const 34))
      (then (return (call $animate_wndproc
        (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Other classes: return 0 (DefWindowProc)
    (i32.const 0)
  )

  ;; ---- Find/Replace dialog parent wndproc ----
  ;;
  ;; Handles WM_COMMAND posted by child buttons (Find Next id=1, Cancel id=2).
  ;; Reads the FINDREPLACE struct guest ptr from the dialog's userdata
  ;; (stashed by $create_findreplace_dialog), populates the buffer + flags
  ;; the way commdlg's real find dialog does, and posts the registered
  ;; message (matching the JS-side _handleFindDialogButton path) to the
  ;; owner. Owner is typically notepad's main window — so $wnd_send_message
  ;; will queue this via post_queue and notepad's GetMessage loop picks it
  ;; up just like a PostMessage.
  ;;
  ;; FINDREPLACE struct (offsets we touch):
  ;;   +0x04  hwndOwner
  ;;   +0x0C  Flags          (read-modify-write)
  ;;   +0x10  lpstrFindWhat  (guest ptr)
  ;;   +0x18  wFindWhatLen   (u16, max chars in lpstrFindWhat buffer)
  ;;
  ;; Flags constants:
  ;;   FR_DOWN        = 0x0001
  ;;   FR_MATCHCASE   = 0x0004
  ;;   FR_FINDNEXT    = 0x0008
  ;;   FR_REPLACE     = 0x0010
  ;;   FR_REPLACEALL  = 0x0020
  ;;   FR_DIALOGTERM  = 0x0040
  ;; The FINDREPLACE belongs to the caller, and for a modeless dialog the
  ;; caller can outlive its own struct. WordPad does: MFC's
  ;; CFindReplaceDialog::Create attaches the returned HWND through the WH_CBT
  ;; hook commdlg's own dialog fires, we do not fire it, so Create decides it
  ;; failed and deletes the object while our dialog stays up. Everything past
  ;; that point reads recycled heap.
  ;;
  ;; lStructSize is the one field commdlg itself requires the caller to set,
  ;; so it doubles as a liveness bit: sizeof(FINDREPLACE) is 40 (ten dwords,
  ;; the two length WORDs sharing one), and a block that still says 40 is
  ;; still the FINDREPLACE it was. Anything else means somebody else owns
  ;; those bytes now and writing flags or search text into them corrupts them.
  (func $findreplace_struct_live (param $fr_w i32) (result i32)
    (i32.eq (i32.load (local.get $fr_w)) (i32.const 40)))

  ;; Flags back-fill, skipped once the struct is gone. The dialog's own state
  ;; (the WAT edits, the direction radios) is what the search runs off, so
  ;; losing the write costs the app nothing it can still read.
  (func $findreplace_store_flags (param $fr_w i32) (param $flags i32)
    (global.set $findreplace_last_flags (local.get $flags))
    (if (call $findreplace_struct_live (local.get $fr_w))
      (then (i32.store offset=12 (local.get $fr_w) (local.get $flags)))))

  (func $findreplace_load_flags (param $fr_w i32) (result i32)
    (if (call $findreplace_struct_live (local.get $fr_w))
      (then (return (i32.load offset=12 (local.get $fr_w)))))
    (i32.const 0))

  (func $findreplace_copy_edit_to_buffer
    (param $edit_h i32) (param $fr_w i32) (param $ptr_off i32) (param $len_off i32)
    (local $state i32) (local $state_w i32) (local $src_w i32)
    (local $buf_g i32) (local $buf_w i32) (local $text_len i32) (local $max_len i32)
    (if (i32.eqz (call $findreplace_struct_live (local.get $fr_w))) (then (return)))
    (local.set $state (call $wnd_get_state_ptr (local.get $edit_h)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $state_w (call $g2w (local.get $state)))
    (local.set $buf_g (i32.load (i32.add (local.get $fr_w) (local.get $ptr_off))))
    (local.set $max_len (i32.load16_u (i32.add (local.get $fr_w) (local.get $len_off))))
    (if (i32.or (i32.eqz (local.get $buf_g)) (i32.eqz (local.get $max_len))) (then (return)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (i32.ge_u (local.get $text_len) (local.get $max_len))
      (then (local.set $text_len (i32.sub (local.get $max_len) (i32.const 1)))))
    (local.set $buf_w (call $g2w (local.get $buf_g)))
    ;; Do not combine the length and guest pointer with bitwise i32.and:
    ;; a one-byte replacement plus an even pointer would incorrectly skip.
    (if (local.get $text_len)
      (then
        (if (load.field EditState text_buf_ptr (local.get $state_w))
          (then
            (local.set $src_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
            (call $memcpy (local.get $buf_w) (local.get $src_w) (local.get $text_len))))))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $text_len)) (i32.const 0)))

  (func $findreplace_native_richedit_replace
    (param $owner i32) (param $fr_w i32) (result i32)
    (local $replace_g i32) (local $state i32) (local $state_w ptr<EditState>) (local $empty_g i32)
    (if (i32.or
          (i32.ne (call $ctrl_table_get_class (local.get $owner)) (i32.const 0))
          (i32.eqz (call $wnd_get_parent (local.get $owner))))
      (then (return (i32.const 0))))
    ;; Use the live dialog edit buffer for the immediate native operation.
    ;; MFC may clear its temporary FINDREPLACE lpstrReplaceWith field after
    ;; ReplaceTextA returns, while the modeless WAT edit remains authoritative.
    (local.set $state (call $wnd_get_state_ptr (global.get $findreplace_replace_hwnd)))
    (if (local.get $state)
      (then
        (local.set $state_w (cast ptr<EditState> (call $g2w (local.get $state))))
        (local.set $replace_g (load.field EditState text_buf_ptr (local.get $state_w))))
      ;; Only when there is no dialog edit at all does lpstrReplaceWith get a
      ;; say. An edit that exists and is EMPTY still answers the question --
      ;; "replace with nothing" -- and its text_buf is a null pointer, which is
      ;; indistinguishable from "no edit" if the two cases share a branch.
      ;; MFC nulls lpstrReplaceWith itself once the replace box is cleared and
      ;; the field then reads back as stale garbage, so believing it deleted
      ;; nothing at all: WordPad's Replace All with an empty replacement left
      ;; every match in place.
      (else
        (if (call $findreplace_struct_live (local.get $fr_w))
          (then (local.set $replace_g (i32.load offset=20 (local.get $fr_w)))))))
    ;; Empty replacement is valid and means delete the selected match.
    (if (i32.eqz (local.get $replace_g))
      (then
        (local.set $empty_g (call $heap_alloc (i32.const 1)))
        (i32.store8 (call $g2w (local.get $empty_g)) (i32.const 0))
        (local.set $replace_g (local.get $empty_g))))
    (drop (call $wnd_send_message
      (local.get $owner) (i32.const 0x00C2) (i32.const 1) (local.get $replace_g)))
    (if (local.get $empty_g) (then (call $heap_free (local.get $empty_g))))
    (call $paint_flag_set_inv (local.get $owner))
    (i32.const 1))

  (func $findreplace_native_richedit_find
    (param $owner i32) (param $fr_w i32) (param $flags i32) (result i32)
    (local $find_g i32) (local $range_g i32) (local $range_w i32)
    (local $sel_a i32) (local $sel_b i32) (local $start i32) (local $ret i32)
    (local $find_state i32) (local $find_state_w ptr<EditState>)
    ;; A class-0 child with a real native wndproc is the shape used by
    ;; RichEdit20A. Plain WAT Edit owners (Notepad) continue through their
    ;; application FINDMSGSTRING handler below.
    (if (i32.or
          (i32.ne (call $ctrl_table_get_class (local.get $owner)) (i32.const 0))
          (i32.eqz (call $wnd_get_parent (local.get $owner))))
      (then (return (i32.const 0))))
    ;; Same rule as the replace side: the WAT dialog's own edit is what the
    ;; user typed into, and it stays valid whatever MFC does to its temporary
    ;; FINDREPLACE afterwards. Clearing the replace box was enough to leave
    ;; lpstrReplaceWith and the two length words holding stale values, and a
    ;; bad wFindWhatLen makes $findreplace_copy_edit_to_buffer skip the copy
    ;; entirely -- so the struct's find buffer still held the previous search
    ;; and Replace All matched nothing at all.
    (local.set $find_state (call $wnd_get_state_ptr (global.get $findreplace_edit_hwnd)))
    (if (local.get $find_state)
      (then
        (local.set $find_state_w (cast ptr<EditState> (call $g2w (local.get $find_state))))
        (local.set $find_g (load.field EditState text_buf_ptr (local.get $find_state_w)))))
    (if (i32.eqz (local.get $find_g))
      (then
        (if (call $findreplace_struct_live (local.get $fr_w))
          (then (local.set $find_g (i32.load offset=16 (local.get $fr_w)))))))
    (if (i32.eqz (local.get $find_g)) (then (return (i32.const 0))))
    (local.set $range_g (call $heap_alloc (i32.const 20)))
    (if (i32.eqz (local.get $range_g)) (then (return (i32.const 0))))
    (local.set $range_w (call $g2w (local.get $range_g)))
    (call $zero_memory (local.get $range_w) (i32.const 20))
    ;; Use the current selection end for a downward Find Next and the start
    ;; for an upward search. FINDTEXTEXA is CHARRANGE + lpstrText + result
    ;; CHARRANGE; all pointers passed to native RichEdit stay in guest space.
    (drop (call $wnd_send_message
      (local.get $owner) (i32.const 0x00B0)
      (local.get $range_g) (i32.add (local.get $range_g) (i32.const 4))))
    (local.set $sel_a (i32.load (local.get $range_w)))
    (local.set $sel_b (i32.load offset=4 (local.get $range_w)))
    (if (i32.and (local.get $flags) (i32.const 0x01))
      (then
        (local.set $start (local.get $sel_a))
        (if (i32.gt_s (local.get $sel_b) (local.get $start))
          (then (local.set $start (local.get $sel_b))))
        (i32.store (local.get $range_w) (local.get $start))
        (i32.store offset=4 (local.get $range_w) (i32.const -1)))
      (else
        (local.set $start (local.get $sel_a))
        (if (i32.lt_s (local.get $sel_b) (local.get $start))
          (then (local.set $start (local.get $sel_b))))
        (i32.store (local.get $range_w) (i32.const 0))
        (i32.store offset=4 (local.get $range_w) (local.get $start))))
    (i32.store offset=8 (local.get $range_w) (local.get $find_g))
    (local.set $ret (call $wnd_send_message
      (local.get $owner) (i32.const 0x044F) (local.get $flags) (local.get $range_g))) ;; EM_FINDTEXTEXA
    (if (i32.ge_s (local.get $ret) (i32.const 0))
      (then
        (drop (call $wnd_send_message
          (local.get $owner) (i32.const 0x00B1)
          (i32.load offset=12 (local.get $range_w))
          (i32.load offset=16 (local.get $range_w))))
        (call $paint_flag_set_inv (local.get $owner))))
    (call $heap_free (local.get $range_g))
    (i32.ge_s (local.get $ret) (i32.const 0)))

  (func $findreplace_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32) (local $fr i32) (local $fr_w i32)
    (local $owner i32) (local $flags i32)
    (local $edit_h i32) (local $edit_state i32) (local $edit_sw ptr<EditState>)
    (local $text_src_w i32) (local $text_len i32) (local $max_len i32)
    (local $find_buf_g i32) (local $find_buf_w i32) (local $i i32)
    (local $mc_h i32) (local $rd_h i32)
    (local $main_edit_h i32) (local $main_state i32) (local $main_state_w ptr<EditState>)
    (local $main_len i32) (local $start_g i32) (local $end_g i32)
    (local $sel_start i32) (local $sel_end i32) (local $replace_count i32)
    (local $replace_ready i32)

    ;; WM_NCPAINT → paint chrome (title bar + border) on back-canvas.
    (if (i32.eq (local.get $msg) (i32.const 0x0085))
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    ;; WM_ERASEBKGND → fill client with COLOR_BTNFACE (index 16).
    (if (i32.eq (local.get $msg) (i32.const 0x0014))
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))

    ;; Recover FR ptr stashed at userdata, owner from FR+4. Both WM_CLOSE
    ;; (title-bar X) and WM_COMMAND (Cancel/Find Next) need this.
    (local.set $fr (call $wnd_get_userdata (local.get $hwnd)))
    (if (i32.eqz (local.get $fr)) (then (return (i32.const 0))))
    (local.set $fr_w (call $g2w (local.get $fr)))
    ;; Some MFC callers release/clear their temporary FINDREPLACE wrapper
    ;; fields after FindTextA returns. The modeless dialog's owner relationship
    ;; remains authoritative for the dialog lifetime.
    (local.set $owner (call $wnd_get_owner (local.get $hwnd)))

    ;; ---- WM_CLOSE (0x0010) — title-bar X click ----
    ;; Real commdlg routes a title-bar close through IDCANCEL; do the same.
    (if (i32.eq (local.get $msg) (i32.const 0x0010))
      (then
        (local.set $cmd (i32.const 2))))  ;; fall through into the Cancel branch below
    ;; Title-bar close starts as WM_NCLBUTTONDOWN/HTCLOSE from the WAT
    ;; nonclient sysbutton tracker, then normally flows through
    ;; DefWindowProc to SC_CLOSE/WM_CLOSE. Find's custom dialog proc is the
    ;; whole dispatch target here, so mirror DefWindowProc's close mapping.
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x00A1))
                 (i32.eq (local.get $wParam) (i32.const 20)))
      (then
        (local.set $cmd (i32.const 2))))
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x0112))
                 (i32.eq (i32.and (local.get $wParam) (i32.const 0xFFF0)) (i32.const 0xF060)))
      (then
        (local.set $cmd (i32.const 2))))

    ;; WM_COMMAND only past this point
    (if (i32.and
          (i32.and (i32.ne (local.get $msg) (i32.const 0x0111))
                   (i32.ne (local.get $msg) (i32.const 0x0010)))
          (i32.and (i32.ne (local.get $msg) (i32.const 0x00A1))
                   (i32.ne (local.get $msg) (i32.const 0x0112))))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0111))
      (then (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))))

    ;; ---- Cancel (id=2) ----
    (if (i32.eq (local.get $cmd) (i32.const 2))
      (then
        (local.set $flags (call $findreplace_load_flags (local.get $fr_w)))
        ;; clear FR_FINDNEXT(0x08), set FR_DIALOGTERM(0x40)
        (local.set $flags (i32.or (i32.and (local.get $flags) (i32.const 0xFFFFFFB7))
                                  (i32.const 0x40)))
        (call $findreplace_store_flags (local.get $fr_w) (local.get $flags))
        (drop (call $post_queue_push (local.get $owner)
                (select (global.get $findreplace_message) (i32.const 0xC000)
                        (i32.ne (global.get $findreplace_message) (i32.const 0)))
                (i32.const 0) (local.get $fr)))
        ;; Tear down the dialog: free child WAT state via WM_DESTROY,
        ;; release the WND_RECORDS slots, drop the visible JS window,
        ;; and clear the globals so the next FindTextA opens fresh state.
        (call $wnd_destroy_tree (local.get $hwnd))
        (call $host_destroy_window (local.get $hwnd))
        (global.set $findreplace_dlg_hwnd  (i32.const 0))
        (global.set $findreplace_edit_hwnd (i32.const 0))
        (global.set $findreplace_replace_hwnd (i32.const 0))
        (global.set $findreplace_is_replace (i32.const 0))
        (return (i32.const 0))))

    ;; ---- Replace / Replace All (ids 0x400 / 0x401) ----
    (if (i32.and (global.get $findreplace_is_replace)
          (i32.or (i32.eq (local.get $cmd) (i32.const 0x400))
                  (i32.eq (local.get $cmd) (i32.const 0x401))))
      (then
        (local.set $flags
          (select (i32.const 0x20) (i32.const 0x10)
                  (i32.eq (local.get $cmd) (i32.const 0x401))))
        (local.set $mc_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x411)))
        (if (i32.and
              (i32.ne (local.get $mc_h) (i32.const 0))
              (i32.ne
                (i32.and (call $button_get_flags_internal (local.get $mc_h)) (i32.const 0x02))
                (i32.const 0)))
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x04)))))
        (call $findreplace_store_flags (local.get $fr_w) (local.get $flags))
        (call $findreplace_copy_edit_to_buffer
          (global.get $findreplace_edit_hwnd) (local.get $fr_w) (i32.const 16) (i32.const 24))
        (call $findreplace_copy_edit_to_buffer
          (global.get $findreplace_replace_hwnd) (local.get $fr_w) (i32.const 20) (i32.const 26))
        (if (i32.eq (local.get $cmd) (i32.const 0x400))
          (then
            ;; Replace the active match. If there is no selection yet, find
            ;; the first match. Then select the following match, matching the
            ;; classic modeless dialog's repeated Replace workflow.
            (local.set $start_g (call $heap_alloc (i32.const 8)))
            (local.set $end_g (i32.add (local.get $start_g) (i32.const 4)))
            (drop (call $wnd_send_message (local.get $owner) (i32.const 0x00B0)
              (local.get $start_g) (local.get $end_g)))
            (local.set $sel_start (i32.load (call $g2w (local.get $start_g))))
            (local.set $sel_end (i32.load (call $g2w (local.get $end_g))))
            (if (i32.eq (local.get $sel_start) (local.get $sel_end))
              (then (local.set $replace_ready (call $findreplace_native_richedit_find
                (local.get $owner) (local.get $fr_w)
                (i32.or (i32.and (local.get $flags) (i32.const 0x04)) (i32.const 0x01)))))
              (else (local.set $replace_ready (i32.const 1))))
            (if (local.get $replace_ready)
              (then
                (drop (call $findreplace_native_richedit_replace (local.get $owner) (local.get $fr_w)))
                (drop (call $findreplace_native_richedit_find
                  (local.get $owner) (local.get $fr_w)
                  (i32.or (i32.and (local.get $flags) (i32.const 0x04)) (i32.const 0x01))))))
            (call $heap_free (local.get $start_g)))
          (else
            ;; Replace All always scans forward from the document start.
            (drop (call $wnd_send_message
              (local.get $owner) (i32.const 0x00B1) (i32.const 0) (i32.const 0)))
            (block $replace_all_done (loop $replace_all_loop
              (br_if $replace_all_done (i32.ge_u (local.get $replace_count) (i32.const 65535)))
              (br_if $replace_all_done (i32.eqz (call $findreplace_native_richedit_find
                (local.get $owner) (local.get $fr_w)
                (i32.or (i32.and (local.get $flags) (i32.const 0x04)) (i32.const 0x01)))))
              (br_if $replace_all_done (i32.eqz (call $findreplace_native_richedit_replace
                (local.get $owner) (local.get $fr_w))))
              (local.set $replace_count (i32.add (local.get $replace_count) (i32.const 1)))
              (br $replace_all_loop)))))
        ;; Native RichEdit owners are operated directly above. Posting the
        ;; same FR_REPLACE notification would make their framework perform the
        ;; operation a second time. Plain WAT/application owners still receive
        ;; the standard registered common-dialog notification.
        (if (i32.or
              (i32.ne (call $ctrl_table_get_class (local.get $owner)) (i32.const 0))
              (i32.eqz (call $wnd_get_parent (local.get $owner))))
          (then
            (drop (call $post_queue_push (local.get $owner)
              (select (global.get $findreplace_message) (i32.const 0xC000)
                      (i32.ne (global.get $findreplace_message) (i32.const 0)))
              (i32.const 0) (local.get $fr)))))
        (return (i32.const 0))))

    ;; ---- Find Next (id=1) ----
    (if (i32.eq (local.get $cmd) (i32.const 1))
      (then
        ;; Build flags = FR_FINDNEXT | (matchCase ? FR_MATCHCASE : 0) | (down ? FR_DOWN : 0)
        (local.set $flags (i32.const 0x08))
        (local.set $mc_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x411)))
        (if (local.get $mc_h)
          (then (if (i32.and (call $button_get_flags_internal (local.get $mc_h)) (i32.const 0x02))
                  (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x04)))))))
        (local.set $rd_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x421)))
        (if (local.get $rd_h)
          (then (if (i32.and (call $button_get_flags_internal (local.get $rd_h)) (i32.const 0x02))
                  (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x01)))))))
        ;; Replace dialogs do not expose direction controls; Win98 common
        ;; dialog Find Next always searches downward in this mode.
        (if (global.get $findreplace_is_replace)
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x01)))))
        (call $findreplace_store_flags (local.get $fr_w) (local.get $flags))
        ;; Copy edit text into FR.lpstrFindWhat (clamped to wFindWhatLen-1).
        (local.set $edit_h (global.get $findreplace_edit_hwnd))
        (local.set $edit_state (call $wnd_get_state_ptr (local.get $edit_h)))
        (if (i32.eqz (call $findreplace_struct_live (local.get $fr_w)))
          (then (local.set $edit_state (i32.const 0))))
        (if (local.get $edit_state)
          (then
            (local.set $edit_sw (cast ptr<EditState> (call $g2w (local.get $edit_state))))
            (local.set $text_len (load.field.memarg EditState text_len (local.get $edit_sw)))
            (local.set $find_buf_g (i32.load offset=16 (local.get $fr_w)))
            (local.set $max_len (i32.load16_u offset=24 (local.get $fr_w)))
            ;; Nested ifs — do NOT use i32.and as logical AND on pointer/length
            ;; pairs. find_buf_g typically has bit 0 = 0, so a bitwise AND with
            ;; (max_len > 0) would silently zero out the guard.
            (if (local.get $find_buf_g)
              (then (if (i32.gt_u (local.get $max_len) (i32.const 0))
              (then
                (local.set $find_buf_w (call $g2w (local.get $find_buf_g)))
                (if (i32.ge_u (local.get $text_len) (local.get $max_len))
                  (then (local.set $text_len (i32.sub (local.get $max_len) (i32.const 1)))))
                (if (load.field EditState text_buf_ptr (local.get $edit_sw))
                  (then
                    (local.set $text_src_w (call $g2w (load.field EditState text_buf_ptr (local.get $edit_sw))))
                (if (local.get $text_len)
                  (then (call $memcpy (local.get $find_buf_w)
                                          (local.get $text_src_w)
                                          (local.get $text_len))))))
                (i32.store8 (i32.add (local.get $find_buf_w) (local.get $text_len)) (i32.const 0))))))))
        (drop (call $findreplace_native_richedit_find
          (local.get $owner) (local.get $fr_w) (local.get $flags)))
        ;; Win98 Notepad's Find starts at the current caret. In the web UI
        ;; the common case is: type text, open Find, search for text that is
        ;; before the caret. When the main edit is exactly at EOF with no
        ;; selection, treat the first downward search as starting at top so
        ;; the visible document is searchable without requiring Home first.
        (if (i32.and (local.get $flags) (i32.const 0x01))
          (then
            (local.set $main_edit_h (call $ctrl_find_by_id (local.get $owner) (i32.const 15)))
            (local.set $main_state (call $wnd_get_state_ptr (local.get $main_edit_h)))
            (if (local.get $main_state)
              (then
                (local.set $main_state_w (cast ptr<EditState> (call $g2w (local.get $main_state))))
                (local.set $main_len (load.field.memarg EditState text_len (local.get $main_state_w)))
                (if (i32.and
                      (i32.gt_u (local.get $main_len) (i32.const 0))
                      (i32.and
                        (i32.eq (load.field.memarg EditState cursor (local.get $main_state_w)) (local.get $main_len))
                        (i32.eq (load.field.memarg EditState sel_anchor (local.get $main_state_w)) (local.get $main_len))))
                  (then (drop (call $wnd_send_message
                    (local.get $main_edit_h) (i32.const 0x00B1) (i32.const 0) (i32.const 0)))))))))
        ;; Native RichEdit was handled synchronously above; avoid duplicating
        ;; Find Next in the application after selecting the same match here.
        (if (i32.or
              (i32.ne (call $ctrl_table_get_class (local.get $owner)) (i32.const 0))
              (i32.eqz (call $wnd_get_parent (local.get $owner))))
          (then
            (drop (call $post_queue_push (local.get $owner)
                    (select (global.get $findreplace_message) (i32.const 0xC000)
                            (i32.ne (global.get $findreplace_message) (i32.const 0)))
                    (i32.const 0) (local.get $fr)))))
        (return (i32.const 0))))

    (i32.const 0)
  )

  ;; ---- ShellAbout dialog parent wndproc ----
  ;;
  ;; Handles WM_COMMAND posted by the OK button (id=IDOK=1) and WM_CLOSE
  ;; from the title-bar X. Both close the dialog: free child WAT state,
  ;; release the WND_RECORDS slots, drop the visible JS-side window.
  ;; The About dialog has no struct-back-fill the way commdlg's find
  ;; dialog does — it's purely informational, so close = teardown.
  (func $about_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32) (local $close i32)
    (local.set $close (i32.const 0))
    ;; WM_NCPAINT → paint chrome (title bar + border) on back-canvas.
    ;; Without this the dialog has no frame: ShellAbout doesn't run the
    ;; modal pump (which would drain nc_flags directly), so paint messages
    ;; come via the main GetMessageA loop and must be handled here.
    (if (i32.eq (local.get $msg) (i32.const 0x0085))
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    ;; WM_ERASEBKGND → fill client with COLOR_BTNFACE (index 16).
    (if (i32.eq (local.get $msg) (i32.const 0x0014))
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))
    ;; WM_CLOSE → close
    (if (i32.eq (local.get $msg) (i32.const 0x0010))
      (then (local.set $close (i32.const 1))))
    ;; Title-bar X follows the normal DefWindowProc route:
    ;; WM_NCLBUTTONDOWN/HTCLOSE -> WM_SYSCOMMAND/SC_CLOSE -> WM_CLOSE.
    ;; ShellAbout's dialog proc is WAT-native, so handle that translation
    ;; here instead of dropping the NC click on the floor.
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x00A1))
          (i32.eq (local.get $wParam) (i32.const 20))) ;; HTCLOSE
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0112) (i32.const 0xF060) (i32.const 0))) ;; SC_CLOSE
        (return (i32.const 0))))
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0112))
          (i32.eq (i32.and (local.get $wParam) (i32.const 0xFFF0)) (i32.const 0xF060))) ;; SC_CLOSE
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0010) (i32.const 0) (i32.const 0)))
        (return (i32.const 0))))
    ;; WM_COMMAND with id=IDOK → close
    (if (i32.eq (local.get $msg) (i32.const 0x0111))
      (then
        (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        (if (i32.eq (local.get $cmd) (i32.const 1))
          (then (local.set $close (i32.const 1))))))
    (if (local.get $close)
      (then
        (call $wnd_destroy_tree (local.get $hwnd))
        (call $host_destroy_window (local.get $hwnd))
        (return (i32.const 0))))
    (i32.const 0))

  ;; Build the ShellAbout dialog. Called from $handle_ShellAboutA after
  ;; allocating the dlg hwnd. All strings come from the original guest
  ;; ShellAbout call:
  ;;   $app_g   = arg1, "Notepad" or whatever the app passed for szApp
  ;;   $other_g = arg2, free-form line(s) supplied by the guest
  ;;              (may be 0)
  ;; The title shown in the caption is "About <appname>", built in WAT
  ;; via memcpy. Lines are: app, then up to two newline-split chunks of
  ;; other_g.
  (func $create_about_dialog
    (param $dlg i32) (param $owner i32)
    (param $app_g i32) (param $other_g i32)
    (local $w i32) (local $h i32)
    (local $title_w i32) (local $title_buf_w i32) (local $app_len i32)
    (local $body_g i32) (local $body_w i32) (local $app_h i32)
    (local $line1_w i32) (local $line2_w i32) (local $line3_w i32)
    (local $other_w i32) (local $i i32) (local $nl i32)
    (local.set $w (i32.const 260))
    (local.set $h (i32.const 160))
    ;; Title = "About " + app. Six chars from data segment 0x1DC, then
    ;; the app string + NUL. Built in a fresh heap allocation; the
    ;; renderer reads it once during host_register_dialog_frame and
    ;; copies it into renderer.windows[].title — we own the buffer here.
    (local.set $app_len (call $strlen (call $g2w (local.get $app_g))))
    (local.set $title_buf_w
      (call $g2w (call $heap_alloc (i32.add (local.get $app_len) (i32.const 7)))))
    (call $memcpy (local.get $title_buf_w) (i32.const 0x1DC) (i32.const 6))
    (call $memcpy (i32.add (local.get $title_buf_w) (i32.const 6))
                  (call $g2w (local.get $app_g)) (local.get $app_len))
    (i32.store8 (i32.add (local.get $title_buf_w) (i32.add (local.get $app_len) (i32.const 6)))
                (i32.const 0))
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner)
      (local.get $title_buf_w)
      (local.get $w) (local.get $h)
      (i32.const 1))  ;; kind bit 0 = isAboutDialog
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg) (local.get $title_buf_w)
      (i32.add (local.get $app_len) (i32.const 6)))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    ;; USER calculates the client rect before the first WM_NCPAINT. The NC
    ;; painter's clip is window minus client; without this, ShellAbout's
    ;; frame repaint erases the child STATIC/BUTTON controls.
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    ;; Tag the parent dialog as control class 11 so $control_wndproc_dispatch
    ;; routes WM_COMMAND from the OK button (and WM_CLOSE from the title-bar X)
    ;; to $about_wndproc.
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg))
      (i32.const 11) (i32.const 0))
    ;; Queue WM_NCPAINT + WM_ERASEBKGND on the now-registered slot so the
    ;; main GetMessageA loop dispatches chrome + background fill to
    ;; $about_wndproc. Must run AFTER wnd_table_set — nc_flags_set is a
    ;; no-op when the slot doesn't exist yet.
    (call $nc_flags_set (local.get $dlg) (i32.const 3))  ;; bits 0+1
    (call $dlg_fill_bkgnd (local.get $dlg))
    (local.set $app_h (i32.const 18))
    (if (i32.eqz (local.get $other_g))
      (then
        (local.set $body_g (call $heap_alloc (i32.add (local.get $app_len) (i32.const 71))))
        (local.set $body_w (call $g2w (local.get $body_g)))
        (call $memcpy (local.get $body_w) (call $g2w (local.get $app_g)) (local.get $app_len))
        (i32.store8 (i32.add (local.get $body_w) (local.get $app_len)) (i32.const 10))
        (call $memcpy
          (i32.add (local.get $body_w) (i32.add (local.get $app_len) (i32.const 1)))
          (region.addr $USER_DIALOG_STRINGS 0xC6) (i32.const 68))
        (i32.store8
          (i32.add (local.get $body_w) (i32.add (local.get $app_len) (i32.const 69)))
          (i32.const 0))
        (local.set $app_g (local.get $body_g))
        (local.set $app_h (i32.const 74))))
    ;; Line 1: appname static
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 12) (i32.const 10) (i32.const 236) (local.get $app_h)
            (i32.const 0x50000000) (local.get $app_g)))
    ;; OK button — id=IDOK=1, BS_DEFPUSHBUTTON style. Centered horizontally,
    ;; near the bottom of the 160px dialog.
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
            (i32.const 90) (i32.sub (local.get $h) (i32.const 56))
            (i32.const 80) (i32.const 24)
            (i32.const 0x50010001)
            (call $wat_str_to_heap (i32.const 0x1D9) (i32.const 2))))
    ;; Lines 2 + 3: split other_g on the first '\n'. If the app passes
    ;; NULL, ShellAbout still fills the dialog with the standard Windows
    ;; version/copyright block.
    (if (local.get $other_g)
      (then
        (local.set $other_w (call $g2w (local.get $other_g)))
        ;; Find newline position. -1 if none.
        (local.set $nl (i32.const -1))
        (local.set $i (i32.const 0))
        (block $done (loop $scan
          (br_if $done (i32.eqz (i32.load8_u (i32.add (local.get $other_w) (local.get $i)))))
          (if (i32.eq (i32.load8_u (i32.add (local.get $other_w) (local.get $i))) (i32.const 10))
            (then (local.set $nl (local.get $i)) (br $done)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))
        (if (i32.eq (local.get $nl) (i32.const -1))
          (then
            ;; Single line — render as line 2.
            (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
                    (i32.const 12) (i32.const 32) (i32.const 236) (i32.const 18)
                    (i32.const 0x50000000) (local.get $other_g))))
          (else
            ;; Two lines — split on '\n' into two heap copies so each
            ;; static_wndproc sees a clean NUL-terminated guest string.
            (local.set $line2_w
              (call $ctrl_text_dup (local.get $other_g) (local.get $nl)))
            (local.set $line3_w
              (call $ctrl_text_dup
                (i32.add (local.get $other_g) (i32.add (local.get $nl) (i32.const 1)))
                (call $strlen (i32.add (local.get $other_w) (i32.add (local.get $nl) (i32.const 1))))))
            (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
                    (i32.const 12) (i32.const 32) (i32.const 236) (i32.const 18)
                    (i32.const 0x50000000) (local.get $line2_w)))
            (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
                    (i32.const 12) (i32.const 50) (i32.const 236) (i32.const 18)
                    (i32.const 0x50000000) (local.get $line3_w)))))))
    ;; ShellAbout is a modal shell-owned dialog on Win98: by the time the
    ;; caller observes it, USER has already exposed/erased the dialog and
    ;; delivered paint to built-in child controls. Our ShellAbout handler is
    ;; WAT-side and returns through the guest's normal message loop, so run
    ;; that initial exposure pass here to keep child STATIC/BUTTON controls
    ;; visible without JS special-casing control drawing.
    (call $nc_flags_clear (local.get $dlg) (i32.const 2))
    (if (local.get $other_g)
      (then (drop (call $host_erase_background (local.get $dlg) (i32.const 16)))))
    (drop (call $paint_flush_visible_native_children (local.get $dlg))))

  ;; ============================================================
  ;; Common-dialog parent (control class 13)
  ;; ============================================================
  ;;
  ;; Generic fallbacks still show a compact message, while Print and Page
  ;; Setup use concrete controls and commit their fields on IDOK.
  (func $ctrl_decimal_value (param $parent i32) (param $id i32) (param $fallback i32) (result i32)
    (local $h i32) (local $state i32) (local $sw i32) (local $buf i32)
    (local $i i32) (local $n i32) (local $c i32) (local $value i32)
    (local.set $h (call $ctrl_find_by_id (local.get $parent) (local.get $id)))
    (if (i32.eqz (local.get $h)) (then (return (local.get $fallback))))
    (local.set $state (call $wnd_get_state_ptr (local.get $h)))
    (if (i32.eqz (local.get $state)) (then (return (local.get $fallback))))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $buf (load.field ControlTextState text_buf_ptr (local.get $sw)))
    (local.set $n (load.field.memarg ControlTextState text_len (local.get $sw)))
    (if (i32.eqz (local.get $buf)) (then (return (local.get $fallback))))
    (local.set $buf (call $g2w (local.get $buf)))
    (block $done (loop $digits
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $c (i32.load8_u (i32.add (local.get $buf) (local.get $i))))
      (br_if $done (i32.or (i32.lt_u (local.get $c) (i32.const 48))
                           (i32.gt_u (local.get $c) (i32.const 57))))
      (local.set $value (i32.add (i32.mul (local.get $value) (i32.const 10))
                                (i32.sub (local.get $c) (i32.const 48))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $digits)))
    (if (i32.eqz (local.get $i)) (then (return (local.get $fallback))))
    (local.get $value))

  ;; Parse an edit containing inches (for example "1.25") to thousandths.
  (func $ctrl_inches_milli (param $parent i32) (param $id i32) (result i32)
    (local $h i32) (local $state i32) (local $sw i32) (local $buf i32)
    (local $i i32) (local $n i32) (local $c i32) (local $whole i32)
    (local $frac i32) (local $digits i32) (local $dot i32)
    (local.set $h (call $ctrl_find_by_id (local.get $parent) (local.get $id)))
    (if (local.get $h) (then (local.set $state (call $wnd_get_state_ptr (local.get $h)))))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 1000))))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $buf (load.field ControlTextState text_buf_ptr (local.get $sw)))
    (local.set $n (load.field.memarg ControlTextState text_len (local.get $sw)))
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 1000))))
    (local.set $buf (call $g2w (local.get $buf)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $c (i32.load8_u (i32.add (local.get $buf) (local.get $i))))
      (if (i32.eq (local.get $c) (i32.const 46))
        (then (local.set $dot (i32.const 1)))
        (else
          (br_if $done (i32.or (i32.lt_u (local.get $c) (i32.const 48))
                               (i32.gt_u (local.get $c) (i32.const 57))))
          (if (local.get $dot)
            (then
              (if (i32.lt_u (local.get $digits) (i32.const 3))
                (then
                  (local.set $frac (i32.add (i32.mul (local.get $frac) (i32.const 10))
                                           (i32.sub (local.get $c) (i32.const 48))))
                  (local.set $digits (i32.add (local.get $digits) (i32.const 1))))))
            (else (local.set $whole (i32.add (i32.mul (local.get $whole) (i32.const 10))
                                             (i32.sub (local.get $c) (i32.const 48))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.eq (local.get $digits) (i32.const 1)) (then (local.set $frac (i32.mul (local.get $frac) (i32.const 100)))))
    (if (i32.eq (local.get $digits) (i32.const 2)) (then (local.set $frac (i32.mul (local.get $frac) (i32.const 10)))))
    (i32.add (i32.mul (local.get $whole) (i32.const 1000)) (local.get $frac)))

  ;; Both buttons call $modal_done; OK records result=1 and Cancel 0.
  ;; Apps that see result=1 typically act on the corresponding struct
  ;; (e.g. PAGESETUPDLG.rtMargin) but these are already zero-initialized
  ;; by the app, so returning 1 from an empty dialog is harmless for
  ;; non-printing paths and lets us visually prove the modal mechanism
  ;; without implementing the real form.
  (func $stub_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32)
    (if (i32.eq (local.get $msg) (i32.const 0x0085))   ;; WM_NCPAINT
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0014))   ;; WM_ERASEBKGND
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0010))   ;; WM_CLOSE
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))
    (if (i32.ne (local.get $msg) (i32.const 0x0111)) (then (return (i32.const 0))))
    (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))
    (if (i32.eq (local.get $cmd) (i32.const 1))
      (then
        (if (i32.eq (global.get $common_dialog_kind) (i32.const 1))
          (then
            (local.set $cmd (call $ctrl_inches_milli (local.get $hwnd) (i32.const 1155)))
            (if (i32.and (call $gl32 (i32.add (global.get $common_dialog_struct) (i32.const 16))) (i32.const 8))
              (then (local.set $cmd (i32.div_u (i32.add (i32.mul (local.get $cmd) (i32.const 254)) (i32.const 50)) (i32.const 100)))))
            (call $gs32 (i32.add (global.get $common_dialog_struct) (i32.const 44)) (local.get $cmd))
            (local.set $cmd (call $ctrl_inches_milli (local.get $hwnd) (i32.const 1156)))
            (if (i32.and (call $gl32 (i32.add (global.get $common_dialog_struct) (i32.const 16))) (i32.const 8))
              (then (local.set $cmd (i32.div_u (i32.add (i32.mul (local.get $cmd) (i32.const 254)) (i32.const 50)) (i32.const 100)))))
            (call $gs32 (i32.add (global.get $common_dialog_struct) (i32.const 48)) (local.get $cmd))
            (local.set $cmd (call $ctrl_inches_milli (local.get $hwnd) (i32.const 1157)))
            (if (i32.and (call $gl32 (i32.add (global.get $common_dialog_struct) (i32.const 16))) (i32.const 8))
              (then (local.set $cmd (i32.div_u (i32.add (i32.mul (local.get $cmd) (i32.const 254)) (i32.const 50)) (i32.const 100)))))
            (call $gs32 (i32.add (global.get $common_dialog_struct) (i32.const 52)) (local.get $cmd))
            (local.set $cmd (call $ctrl_inches_milli (local.get $hwnd) (i32.const 1158)))
            (if (i32.and (call $gl32 (i32.add (global.get $common_dialog_struct) (i32.const 16))) (i32.const 8))
              (then (local.set $cmd (i32.div_u (i32.add (i32.mul (local.get $cmd) (i32.const 254)) (i32.const 50)) (i32.const 100)))))
            (call $gs32 (i32.add (global.get $common_dialog_struct) (i32.const 56)) (local.get $cmd))))
        (if (i32.eq (global.get $common_dialog_kind) (i32.const 2))
          (then
            (call $gs16 (i32.add (global.get $common_dialog_struct) (i32.const 24))
              (call $ctrl_decimal_value (local.get $hwnd) (i32.const 1152) (i32.const 1)))
            (call $gs16 (i32.add (global.get $common_dialog_struct) (i32.const 26))
              (call $ctrl_decimal_value (local.get $hwnd) (i32.const 1153) (i32.const 1)))
            (call $gs16 (i32.add (global.get $common_dialog_struct) (i32.const 32))
              (call $ctrl_decimal_value (local.get $hwnd) (i32.const 1154) (i32.const 1)))))
        (call $modal_done (i32.const 1)) (return (i32.const 0))))
    (if (i32.eq (local.get $cmd) (i32.const 2))
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))
    (i32.const 0))

  (func $create_print_dialog (param $dlg i32) (param $owner i32)
    (call $host_register_dialog_frame (local.get $dlg) (local.get $owner)
      (i32.const 0x24C) (i32.const 330) (i32.const 235) (i32.const 1))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg) (i32.const 0x24C) (i32.const 5))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg)) (i32.const 13) (i32.const 0))
    (call $nc_flags_set (local.get $dlg) (i32.const 3))
    (call $dlg_fill_bkgnd (local.get $dlg))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 14) (i32.const 14) (i32.const 290) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x188) (i32.const 20))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 14) (i32.const 42) (i32.const 100) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x19D) (i32.const 10))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1056)
      (i32.const 24) (i32.const 64) (i32.const 56) (i32.const 20) (i32.const 0x50010009)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1A8) (i32.const 3))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1057)
      (i32.const 92) (i32.const 64) (i32.const 70) (i32.const 20) (i32.const 0x50010009)
      (call $wat_str_to_heap (region.addr $POWER_SCREEN_STRINGS 0x67) (i32.const 5))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 24) (i32.const 94) (i32.const 42) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1AC) (i32.const 5))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 1152)
      (i32.const 68) (i32.const 91) (i32.const 48) (i32.const 22) (i32.const 0x50810080)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x20E) (i32.const 1))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 130) (i32.const 94) (i32.const 25) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1B2) (i32.const 3))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 1153)
      (i32.const 158) (i32.const 91) (i32.const 48) (i32.const 22) (i32.const 0x50810080)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x210) (i32.const 4))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 24) (i32.const 128) (i32.const 48) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1B6) (i32.const 7))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 1154)
      (i32.const 76) (i32.const 125) (i32.const 48) (i32.const 22) (i32.const 0x50810080)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x20E) (i32.const 1))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
      (i32.const 154) (i32.const 170) (i32.const 72) (i32.const 24) (i32.const 0x50010001)
      (call $wat_str_to_heap (i32.const 0x1D9) (i32.const 2))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
      (i32.const 238) (i32.const 170) (i32.const 72) (i32.const 24) (i32.const 0x50010000)
      (call $wat_str_to_heap (i32.const 0x1D2) (i32.const 6)))))

  (func $create_page_setup_dialog (param $dlg i32) (param $owner i32)
    (local $i i32)
    (call $host_register_dialog_frame (local.get $dlg) (local.get $owner)
      (i32.const 0x241) (i32.const 350) (i32.const 245) (i32.const 1))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg) (i32.const 0x241) (i32.const 10))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg)) (i32.const 13) (i32.const 0))
    (call $nc_flags_set (local.get $dlg) (i32.const 3))
    (call $dlg_fill_bkgnd (local.get $dlg))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 14) (i32.const 14) (i32.const 310) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1E9) (i32.const 25))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 14) (i32.const 44) (i32.const 150) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1BE) (i32.const 16))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 24) (i32.const 76) (i32.const 40) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1CF) (i32.const 5))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 1155)
      (i32.const 70) (i32.const 73) (i32.const 58) (i32.const 22) (i32.const 0x50810080)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x203) (i32.const 4))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 180) (i32.const 76) (i32.const 34) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1D5) (i32.const 4))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 1156)
      (i32.const 220) (i32.const 73) (i32.const 58) (i32.const 22) (i32.const 0x50810080)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x203) (i32.const 4))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 24) (i32.const 112) (i32.const 40) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1DA) (i32.const 6))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 1157)
      (i32.const 70) (i32.const 109) (i32.const 58) (i32.const 22) (i32.const 0x50810080)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x203) (i32.const 4))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 180) (i32.const 112) (i32.const 48) (i32.const 18) (i32.const 0x50000000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x1E1) (i32.const 7))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 1158)
      (i32.const 234) (i32.const 109) (i32.const 58) (i32.const 22) (i32.const 0x50810080)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x203) (i32.const 4))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
      (i32.const 174) (i32.const 168) (i32.const 72) (i32.const 24) (i32.const 0x50010001)
      (call $wat_str_to_heap (i32.const 0x1D9) (i32.const 2))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
      (i32.const 258) (i32.const 168) (i32.const 72) (i32.const 24) (i32.const 0x50010000)
      (call $wat_str_to_heap (i32.const 0x1D2) (i32.const 6)))))

  ;; ============================================================
  ;; MessageBox dialog — control class 15 ($msgbox_wndproc)
  ;; ============================================================
  ;;
  ;; $msgbox_wndproc is its own class because it needs to map every
  ;; WM_COMMAND id (1=IDOK ... 11=IDCONTINUE) directly into modal_done's
  ;; result. The stub_wndproc only knows IDOK/IDCANCEL.
  (func $msgbox_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32)
    (if (i32.eq (local.get $msg) (i32.const 0x0085))   ;; WM_NCPAINT
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0014))   ;; WM_ERASEBKGND
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0010))   ;; WM_CLOSE
      (then (call $modal_done (i32.const 2)) (return (i32.const 0))))  ;; IDCANCEL
    (if (i32.ne (local.get $msg) (i32.const 0x0111)) (then (return (i32.const 0))))
    (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))
    ;; Any of IDOK..IDCONTINUE: report the id verbatim. Unknown cmds drop.
    (if (i32.and (i32.ge_u (local.get $cmd) (i32.const 1))
                 (i32.le_u (local.get $cmd) (i32.const 11)))
      (then (call $modal_done (local.get $cmd)) (return (i32.const 0))))
    (i32.const 0))

  ;; Append a button at $bx,$by, recording it in the dialog so the row
  ;; can be centered after all buttons are placed.
  (func $msgbox_btn (param $dlg i32) (param $id i32) (param $x i32) (param $y i32)
                    (param $label_wa i32) (param $label_len i32) (param $is_default i32)
    (local $style i32)
    ;; BS_PUSHBUTTON=0, BS_DEFPUSHBUTTON=1; WS_TABSTOP|WS_VISIBLE|WS_CHILD
    (local.set $style (i32.const 0x50010000))
    (if (local.get $is_default)
      (then (local.set $style (i32.or (local.get $style) (i32.const 1)))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (local.get $id)
            (local.get $x) (local.get $y) (i32.const 72) (i32.const 24)
            (local.get $style)
            (call $wat_str_to_heap (local.get $label_wa) (local.get $label_len)))))

  ;; Builds a dialog whose static text is the caller's message string and
  ;; whose title is the caller's caption. Decodes the MB_* button mask
  ;; (low nibble of $uType) into the matching button row. NULL caption
  ;; is tolerated (renders empty).
  ;; $text_wa / $caption_wa are WASM linear addresses (already $g2w'd).
  (func $create_msgbox_dialog
    (param $dlg i32) (param $owner i32) (param $caption_wa i32) (param $text_wa i32)
    (param $uType i32)
    (local $text_len i32) (local $cap_len i32)
    (local $text_g i32) (local $w i32) (local $h i32)
    (local $btn_kind i32) (local $n_btn i32) (local $row_w i32)
    (local $bx i32) (local $by i32) (local $longest i32)
    (local $slot i32) (local $ch i32) (local $scan i32)
    (local $line_len i32) (local $line_last i32) (local $line_started i32)
    (local.set $text_len (call $strlen (local.get $text_wa)))
    (if (i32.eqz (local.get $caption_wa))
      (then (local.set $cap_len (i32.const 0)))
      (else (local.set $cap_len (call $strlen (local.get $caption_wa)))))
    (local.set $btn_kind (i32.and (local.get $uType) (i32.const 0xF)))
    ;; Decide button count up front so we can size the dialog.
    (local.set $n_btn
      (select (i32.const 1)                                    ;; default
        (select (i32.const 2)                                  ;; OKCANCEL/RETRYCANCEL/YESNO
          (select (i32.const 3)                                ;; ABORTRETRYIGNORE/YESNOCANCEL/CANCELTRYCONTINUE
            (i32.const 0)
            (i32.or (i32.or
              (i32.eq (local.get $btn_kind) (i32.const 2))
              (i32.eq (local.get $btn_kind) (i32.const 3)))
              (i32.eq (local.get $btn_kind) (i32.const 6))))
          (i32.or (i32.or
            (i32.eq (local.get $btn_kind) (i32.const 1))
            (i32.eq (local.get $btn_kind) (i32.const 4)))
            (i32.eq (local.get $btn_kind) (i32.const 5))))
        (i32.eqz (local.get $btn_kind))))
    (if (i32.eqz (local.get $n_btn)) (then (local.set $n_btn (i32.const 1))))
    (local.set $row_w (i32.add
      (i32.mul (local.get $n_btn) (i32.const 76))
      (i32.const 8)))
    ;; Measure the longest visible message line. Win98 does not size a box
    ;; from the total byte count (nor from leading/trailing centering spaces),
    ;; so multiline Win16 strings such as Klotski's compact Welcome box must
    ;; not turn into a desktop-wide dialog.
    (block $measure_done (loop $measure
      (br_if $measure_done (i32.ge_u (local.get $scan) (local.get $text_len)))
      (local.set $ch (i32.load8_u (i32.add (local.get $text_wa) (local.get $scan))))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 10))
            (i32.eq (local.get $ch) (i32.const 13)))
        (then
          (if (i32.gt_u (local.get $line_last) (local.get $longest))
            (then (local.set $longest (local.get $line_last))))
          (local.set $line_len (i32.const 0))
          (local.set $line_last (i32.const 0))
          (local.set $line_started (i32.const 0)))
        (else
          (if (i32.or (i32.ne (local.get $ch) (i32.const 32))
                (local.get $line_started))
            (then
              (local.set $line_started (i32.const 1))
              (local.set $line_len (i32.add (local.get $line_len) (i32.const 1)))
              (if (i32.ne (local.get $ch) (i32.const 32))
                (then (local.set $line_last (local.get $line_len))))))))
      (local.set $scan (i32.add (local.get $scan) (i32.const 1)))
      (br $measure)))
    (if (i32.gt_u (local.get $line_last) (local.get $longest))
      (then (local.set $longest (local.get $line_last))))
    ;; Classic small-font metrics are about five pixels per message character.
    ;; Caption sizing keeps enough room for the frame buttons independently.
    (local.set $w (i32.add
      (i32.div_u (i32.mul (local.get $longest) (i32.const 11)) (i32.const 2))
      (i32.const 32)))
    (if (i32.lt_u (local.get $w)
          (i32.add (i32.mul (local.get $cap_len) (i32.const 6)) (i32.const 60)))
      (then (local.set $w
        (i32.add (i32.mul (local.get $cap_len) (i32.const 6)) (i32.const 60)))))
    (if (i32.lt_u (local.get $w) (i32.add (local.get $row_w) (i32.const 32)))
      (then (local.set $w (i32.add (local.get $row_w) (i32.const 32)))))
    (if (i32.lt_u (local.get $w) (i32.const 148)) (then (local.set $w (i32.const 148))))
    (if (i32.gt_u (local.get $w) (i32.const 420)) (then (local.set $w (i32.const 420))))
    (local.set $h (i32.const 124))
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner)
      (local.get $caption_wa)
      (local.get $w) (local.get $h)
      (i32.const 1))
    (if (i32.and (i32.ge_u (global.get $gdi_screen_width) (local.get $w))
          (i32.ge_u (global.get $gdi_screen_height) (local.get $h)))
      (then
        (call $host_move_window (local.get $dlg)
          (i32.div_u (i32.sub (global.get $gdi_screen_width) (local.get $w)) (i32.const 2))
          (i32.div_u (i32.sub (global.get $gdi_screen_height) (local.get $h)) (i32.const 2))
          (local.get $w) (local.get $h) (i32.const 0))))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (if (local.get $caption_wa)
      (then (call $title_table_set (local.get $dlg) (local.get $caption_wa)
              (local.get $cap_len))))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg))
      (i32.const 16) (i32.const 0))
    ;; Match the normal dialog path: establish client geometry before any
    ;; erase/background/child paints. Otherwise the browser compositor can
    ;; see only the frame while child controls are painted against stale
    ;; window-local client bounds.
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    ;; Paint the frame/background immediately. MessageBox can be created
    ;; inside a synchronous button click; if it waits for the modal pump's
    ;; first paint pass, the browser mouse-up from the original click can
    ;; arrive first and leave the user staring at the disabled owner.
    (drop (call $host_erase_background (local.get $dlg) (i32.const 16)))
    (call $defwndproc_do_ncpaint (local.get $dlg))
    ;; Message text static.
    (local.set $text_g (call $wat_str_to_heap (local.get $text_wa) (local.get $text_len)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 16) (i32.const 24)
            ;; Stop at the button row. WAT-native sibling windows do not get
            ;; USER's WS_CLIPSIBLINGS exclusion automatically; an invalidated
            ;; message static otherwise repaints over the top eight pixels of
            ;; Klotski's OK button after focus has already drawn the button.
            (i32.sub (local.get $w) (i32.const 32)) (i32.const 40)
            (i32.const 0x50000000)
            (local.get $text_g)))
    ;; Button row, left edge centered around dialog midpoint.
    ;; Child controls use client coordinates. MessageBox has a captioned
    ;; 3px frame, 19px caption/client separator, and 4px bottom border, so
    ;; place the row relative to the client bottom rather than the outer
    ;; window bottom.
    (local.set $bx (i32.div_u (i32.sub (local.get $w) (local.get $row_w)) (i32.const 2)))
    (local.set $by (i32.sub (local.get $h) (i32.const 60)))
    ;; Layout per MB_* mask. IDs match winuser.h.
    (block $done
      ;; MB_OK (0)
      (if (i32.eqz (local.get $btn_kind))
        (then
          (call $msgbox_btn (local.get $dlg) (i32.const 1)
            (local.get $bx) (local.get $by) (region.addr $USER_DIALOG_STRINGS 0x0) (i32.const 2) (i32.const 1))
          (br $done)))
      ;; MB_OKCANCEL (1)
      (if (i32.eq (local.get $btn_kind) (i32.const 1))
        (then
          (call $msgbox_btn (local.get $dlg) (i32.const 1)
            (local.get $bx) (local.get $by) (region.addr $USER_DIALOG_STRINGS 0x0) (i32.const 2) (i32.const 1))
          (call $msgbox_btn (local.get $dlg) (i32.const 2)
            (i32.add (local.get $bx) (i32.const 76)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x3) (i32.const 6) (i32.const 0))
          (br $done)))
      ;; MB_ABORTRETRYIGNORE (2)
      (if (i32.eq (local.get $btn_kind) (i32.const 2))
        (then
          (call $msgbox_btn (local.get $dlg) (i32.const 3)
            (local.get $bx) (local.get $by) (region.addr $USER_DIALOG_STRINGS 0xA) (i32.const 5) (i32.const 1))
          (call $msgbox_btn (local.get $dlg) (i32.const 4)
            (i32.add (local.get $bx) (i32.const 76)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x10) (i32.const 5) (i32.const 0))
          (call $msgbox_btn (local.get $dlg) (i32.const 5)
            (i32.add (local.get $bx) (i32.const 152)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x16) (i32.const 6) (i32.const 0))
          (br $done)))
      ;; MB_YESNOCANCEL (3)
      (if (i32.eq (local.get $btn_kind) (i32.const 3))
        (then
          (call $msgbox_btn (local.get $dlg) (i32.const 6)
            (local.get $bx) (local.get $by) (region.addr $USER_DIALOG_STRINGS 0x1D) (i32.const 3) (i32.const 1))
          (call $msgbox_btn (local.get $dlg) (i32.const 7)
            (i32.add (local.get $bx) (i32.const 76)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x21) (i32.const 2) (i32.const 0))
          (call $msgbox_btn (local.get $dlg) (i32.const 2)
            (i32.add (local.get $bx) (i32.const 152)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x3) (i32.const 6) (i32.const 0))
          (br $done)))
      ;; MB_YESNO (4)
      (if (i32.eq (local.get $btn_kind) (i32.const 4))
        (then
          (call $msgbox_btn (local.get $dlg) (i32.const 6)
            (local.get $bx) (local.get $by) (region.addr $USER_DIALOG_STRINGS 0x1D) (i32.const 3) (i32.const 1))
          (call $msgbox_btn (local.get $dlg) (i32.const 7)
            (i32.add (local.get $bx) (i32.const 76)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x21) (i32.const 2) (i32.const 0))
          (br $done)))
      ;; MB_RETRYCANCEL (5)
      (if (i32.eq (local.get $btn_kind) (i32.const 5))
        (then
          (call $msgbox_btn (local.get $dlg) (i32.const 4)
            (local.get $bx) (local.get $by) (region.addr $USER_DIALOG_STRINGS 0x10) (i32.const 5) (i32.const 1))
          (call $msgbox_btn (local.get $dlg) (i32.const 2)
            (i32.add (local.get $bx) (i32.const 76)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x3) (i32.const 6) (i32.const 0))
          (br $done)))
      ;; MB_CANCELTRYCONTINUE (6)
      (if (i32.eq (local.get $btn_kind) (i32.const 6))
        (then
          (call $msgbox_btn (local.get $dlg) (i32.const 2)
            (local.get $bx) (local.get $by) (region.addr $USER_DIALOG_STRINGS 0x3) (i32.const 6) (i32.const 1))
          (call $msgbox_btn (local.get $dlg) (i32.const 10)
            (i32.add (local.get $bx) (i32.const 76)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x24) (i32.const 9) (i32.const 0))
          (call $msgbox_btn (local.get $dlg) (i32.const 11)
            (i32.add (local.get $bx) (i32.const 152)) (local.get $by)
            (region.addr $USER_DIALOG_STRINGS 0x2E) (i32.const 8) (i32.const 0))
          (br $done)))
      ;; Fallback: lone OK.
      (call $msgbox_btn (local.get $dlg) (i32.const 1)
        (local.get $bx) (local.get $by) (region.addr $USER_DIALOG_STRINGS 0x0) (i32.const 2) (i32.const 1)))
    ;; Static text + buttons. Used by renderer-input.js for Enter/Esc
    ;; handling on the message box.
    (i32.store offset=28 (call $dlg_record_for_hwnd (local.get $dlg))
               (i32.add (local.get $n_btn) (i32.const 1)))
    ;; Paint the WAT-built children immediately for the same reason as the
    ;; frame/background above.
    (local.set $slot (i32.const 0))
    (block $paint_done (loop $paint_children
      (local.set $slot (call $wnd_next_child_slot (local.get $dlg) (local.get $slot)))
      (br_if $paint_done (i32.eq (local.get $slot) (i32.const -1)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (local.get $ch)
        (then (drop (call $wnd_send_message
          (local.get $ch) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $paint_children)))
    (call $dlg_seed_focus (local.get $dlg))
    ;; Focus seeding can repaint the default button and touch the dialog
    ;; background. Repaint children once more so non-focused sibling buttons
    ;; are not left partially covered in the first visible modal frame.
    (local.set $slot (i32.const 0))
    (block $paint_done2 (loop $paint_children2
      (local.set $slot (call $wnd_next_child_slot (local.get $dlg) (local.get $slot)))
      (br_if $paint_done2 (i32.eq (local.get $slot) (i32.const -1)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (local.get $ch)
        (then (drop (call $wnd_send_message
          (local.get $ch) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $paint_children2))))

  ;; ============================================================
  ;; Font (ChooseFont) dialog — control class 14
  ;; ============================================================
  ;;
  ;; Three listboxes (face / style / size) + OK / Cancel. The CHOOSEFONT
  ;; guest ptr is stashed in userdata so the IDOK handler can write the
  ;; selected face/style/size back into CHOOSEFONT.lpLogFont plus the
  ;; CHOOSEFONT output fields that apps commonly consume (notably
  ;; iPointSize). WordPad builds its RichEdit CHARFORMAT from that result.
  ;;
  ;; Listbox control IDs: face=0x450, style=0x451, size=0x452.
  (func $fontdlg_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32) (local $cf i32) (local $cf_w i32)
    (local $lf_g i32) (local $lf_w i32)
    (local $face_h i32) (local $size_h i32)
    (local $size_sel i32) (local $size_buf_g i32) (local $size_buf_w i32)
    (local $size_val i32) (local $i i32) (local $c i32)

    (if (i32.eq (local.get $msg) (i32.const 0x0085))   ;; WM_NCPAINT
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0014))   ;; WM_ERASEBKGND
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0010))   ;; WM_CLOSE
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))
    (if (i32.ne (local.get $msg) (i32.const 0x0111)) (then (return (i32.const 0))))
    (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))

    ;; ---- Cancel ----
    (if (i32.eq (local.get $cmd) (i32.const 2))
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))

    ;; ---- OK: write selected face/style/size back to CHOOSEFONT ----
    (if (i32.eq (local.get $cmd) (i32.const 1))
      (then
        (call $fontdlg_writeback (local.get $hwnd))
        (call $modal_done (i32.const 1))
        (return (i32.const 0))))
    (i32.const 0))

  ;; Helper: read selected face/style/size from the dialog listboxes and
  ;; populate the CHOOSEFONT output fields that legacy apps expect:
  ;;
  ;;   CHOOSEFONT.lpLogFont (+0x0C) -> LOGFONTA
  ;;   CHOOSEFONT.iPointSize (+0x10) = selected point size * 10
  ;;   CHOOSEFONT.lpszStyle (+0x2C), if provided
  ;;   CHOOSEFONT.nFontType (+0x30) style flags + TRUETYPE_FONTTYPE
  ;;
  ;; LOGFONT.lfHeight remains a simple negative point-size proxy. iPointSize
  ;; gives MFC/WordPad the standard tenths-of-points value for
  ;; CHARFORMAT.yHeight; RichEdit's latest-size reporting/rendering cache is
  ;; tracked separately from this common-dialog writeback.
  (func $fontdlg_writeback (param $hwnd i32)
    (local $cf i32) (local $cf_w i32) (local $lf_g i32) (local $lf_w i32)
    (local $face_h i32) (local $style_h i32) (local $size_h i32)
    (local $face_sel i32) (local $style_sel i32) (local $size_sel i32)
    (local $buf_g i32) (local $buf_w i32)
    (local $style_dst_g i32) (local $font_type i32)
    (local $val i32) (local $i i32) (local $c i32)
    (local.set $cf (call $wnd_get_userdata (local.get $hwnd)))
    (if (i32.eqz (local.get $cf)) (then (return)))
    (local.set $cf_w (call $g2w (local.get $cf)))
    (local.set $lf_g (i32.load offset=12 (local.get $cf_w)))
    (if (i32.eqz (local.get $lf_g)) (then (return)))
    (local.set $lf_w (call $g2w (local.get $lf_g)))

    ;; Style selection -> LOGFONT weight/italic + CHOOSEFONT.nFontType.
    (local.set $style_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x451)))
    (local.set $style_sel (i32.const 0))
    (if (local.get $style_h)
      (then
        (local.set $style_sel (call $wnd_send_message
          (local.get $style_h) (i32.const 0x0188) (i32.const 0) (i32.const 0)))
        (if (i32.lt_s (local.get $style_sel) (i32.const 0))
          (then (local.set $style_sel (i32.const 0))))))
    (i32.store offset=16 (local.get $lf_w) (i32.const 400))
    (if (i32.or (i32.eq (local.get $style_sel) (i32.const 1))
                (i32.eq (local.get $style_sel) (i32.const 3)))
      (then (i32.store offset=16 (local.get $lf_w) (i32.const 700))))
    (i32.store8 offset=20 (local.get $lf_w) (i32.const 0))
    (if (i32.or (i32.eq (local.get $style_sel) (i32.const 2))
                (i32.eq (local.get $style_sel) (i32.const 3)))
      (then (i32.store8 offset=20 (local.get $lf_w) (i32.const 1))))
    (i32.store8 offset=21 (local.get $lf_w) (i32.const 0)) ;; lfUnderline
    (i32.store8 offset=22 (local.get $lf_w) (i32.const 0)) ;; lfStrikeOut
    (local.set $font_type (i32.const 0x0404)) ;; REGULAR_FONTTYPE | TRUETYPE_FONTTYPE
    (if (i32.eq (local.get $style_sel) (i32.const 1))
      (then (local.set $font_type (i32.const 0x0104)))) ;; BOLD | TRUETYPE
    (if (i32.eq (local.get $style_sel) (i32.const 2))
      (then (local.set $font_type (i32.const 0x0204)))) ;; ITALIC | TRUETYPE
    (if (i32.eq (local.get $style_sel) (i32.const 3))
      (then (local.set $font_type (i32.const 0x0304)))) ;; BOLD | ITALIC | TRUETYPE
    (i32.store16 offset=48 (local.get $cf_w) (local.get $font_type))
    (local.set $style_dst_g (i32.load offset=44 (local.get $cf_w)))
    (if (local.get $style_h)
      (then
        (if (local.get $style_dst_g)
          (then
            (drop (call $wnd_send_message
              (local.get $style_h) (i32.const 0x0189)
              (local.get $style_sel) (local.get $style_dst_g)))))))

    ;; Face selection -> LOGFONT.lfFaceName (32-byte ANSI buffer).
    (local.set $face_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x450)))
    (local.set $face_sel (i32.const 0))
    (if (local.get $face_h)
      (then
        (local.set $face_sel (call $wnd_send_message
          (local.get $face_h) (i32.const 0x0188) (i32.const 0) (i32.const 0)))
        (if (i32.lt_s (local.get $face_sel) (i32.const 0))
          (then (local.set $face_sel (i32.const 0))))
        (call $zero_memory (i32.add (local.get $lf_w) (i32.const 28)) (i32.const 32))
        (drop (call $wnd_send_message
          (local.get $face_h) (i32.const 0x0189)
          (local.get $face_sel) (i32.add (local.get $lf_g) (i32.const 28))))))

    ;; Size selection -> LOGFONT.lfHeight and CHOOSEFONT.iPointSize.
    (local.set $size_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x452)))
    (if (i32.eqz (local.get $size_h)) (then (return)))
    (local.set $size_sel (call $wnd_send_message (local.get $size_h) (i32.const 0x0188) (i32.const 0) (i32.const 0)))
    (if (i32.lt_s (local.get $size_sel) (i32.const 0)) (then (return)))
    (local.set $buf_g (call $heap_alloc (i32.const 16)))
    (local.set $buf_w (call $g2w (local.get $buf_g)))
    (drop (call $wnd_send_message (local.get $size_h) (i32.const 0x0189) (local.get $size_sel) (local.get $buf_g)))
    (local.set $val (i32.const 0))
    (local.set $i (i32.const 0))
    (block $end (loop $digit
      (local.set $c (i32.load8_u (i32.add (local.get $buf_w) (local.get $i))))
      (br_if $end (i32.or (i32.lt_s (local.get $c) (i32.const 0x30))
                          (i32.gt_s (local.get $c) (i32.const 0x39))))
      (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10))
                               (i32.sub (local.get $c) (i32.const 0x30))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $digit)))
    (call $heap_free (local.get $buf_g))
    (if (i32.gt_s (local.get $val) (i32.const 0))
      (then
        (i32.store (local.get $lf_w) (i32.sub (i32.const 0) (local.get $val)))
        (i32.store offset=16 (local.get $cf_w)
          (i32.mul (local.get $val) (i32.const 10))))))

  (func $create_font_dialog (param $dlg i32) (param $owner i32) (param $cf i32)
    (local $face_lb i32) (local $style_lb i32) (local $size_lb i32)
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner)
      (i32.const 0x258)   ;; "Font"
      (i32.const 420) (i32.const 260)
      (i32.const 1))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg) (i32.const 0x258) (i32.const 4))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg))
      (i32.const 14) (i32.const 0))
    (call $nc_flags_set (local.get $dlg) (i32.const 3))
    (call $dlg_fill_bkgnd (local.get $dlg))
    (drop (call $wnd_set_userdata (local.get $dlg) (local.get $cf)))

    ;; Face label + listbox
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 12) (i32.const 8) (i32.const 40) (i32.const 14)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (i32.const 0x25D) (i32.const 5))))
    (local.set $face_lb (call $ctrl_create_child (local.get $dlg) (i32.const 4) (i32.const 0x450)
                          (i32.const 12) (i32.const 24) (i32.const 160) (i32.const 120)
                          (i32.const 0x50810001) (i32.const 0)))
    (drop (call $wnd_send_message (local.get $face_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x270) (i32.const 13))))
    (drop (call $wnd_send_message (local.get $face_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x27E) (i32.const 5))))
    (drop (call $wnd_send_message (local.get $face_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x284) (i32.const 11))))
    (drop (call $wnd_send_message (local.get $face_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x290) (i32.const 15))))
    (drop (call $wnd_send_message (local.get $face_lb) (i32.const 0x0186) (i32.const 0) (i32.const 0)))

    ;; Style label + listbox
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 180) (i32.const 8) (i32.const 40) (i32.const 14)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (i32.const 0x263) (i32.const 6))))
    (local.set $style_lb (call $ctrl_create_child (local.get $dlg) (i32.const 4) (i32.const 0x451)
                           (i32.const 180) (i32.const 24) (i32.const 100) (i32.const 120)
                           (i32.const 0x50810001) (i32.const 0)))
    (drop (call $wnd_send_message (local.get $style_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2A0) (i32.const 7))))
    (drop (call $wnd_send_message (local.get $style_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2A8) (i32.const 4))))
    (drop (call $wnd_send_message (local.get $style_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2AD) (i32.const 6))))
    (drop (call $wnd_send_message (local.get $style_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2B4) (i32.const 11))))
    (drop (call $wnd_send_message (local.get $style_lb) (i32.const 0x0186) (i32.const 0) (i32.const 0)))

    ;; Size label + listbox
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 288) (i32.const 8) (i32.const 40) (i32.const 14)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (i32.const 0x26A) (i32.const 5))))
    (local.set $size_lb (call $ctrl_create_child (local.get $dlg) (i32.const 4) (i32.const 0x452)
                          (i32.const 288) (i32.const 24) (i32.const 60) (i32.const 120)
                          (i32.const 0x50810001) (i32.const 0)))
    (drop (call $wnd_send_message (local.get $size_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2C0) (i32.const 1))))
    (drop (call $wnd_send_message (local.get $size_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2C2) (i32.const 2))))
    (drop (call $wnd_send_message (local.get $size_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2C5) (i32.const 2))))
    (drop (call $wnd_send_message (local.get $size_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2C8) (i32.const 2))))
    (drop (call $wnd_send_message (local.get $size_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2CB) (i32.const 2))))
    (drop (call $wnd_send_message (local.get $size_lb) (i32.const 0x0180) (i32.const 0)
            (call $wat_str_to_heap (i32.const 0x2E6) (i32.const 2))))
    (drop (call $wnd_send_message (local.get $size_lb) (i32.const 0x0186) (i32.const 1) (i32.const 0)))

    ;; OK / Cancel
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
            (i32.const 358) (i32.const 24) (i32.const 52) (i32.const 22)
            (i32.const 0x50010001)
            (call $wat_str_to_heap (i32.const 0x1D9) (i32.const 2))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
            (i32.const 358) (i32.const 52) (i32.const 52) (i32.const 22)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (i32.const 0x1D2) (i32.const 6)))))

;; Internal helper for $findreplace_wndproc — reads ButtonState.flags
  ;; without the export-layer wrapping.
  (func $button_get_flags_internal (param $hwnd i32) (result i32)
    (local $s i32)
    (local.set $s (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $s)) (then (return (i32.const 0))))
    (call $btn_flags (call $g2w (local.get $s))))

  ;; WS_DISABLED is numerically identical to a private memory-region base.
  ;; Keep the flag spelling in one control-specific helper so moving a
  ;; control implementation between fragments cannot look like a new
  ;; hard-coded memory-map address to the region census.
  (func $ctrl_style_disabled (param $style i32) (result i32)
    (i32.ne
      (i32.and (local.get $style) (i32.const 0x08000000))
      (i32.const 0)))
