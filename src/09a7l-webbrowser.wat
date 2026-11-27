  ;; CLSID_WebBrowser {8856F961-340A-11D0-A96B-00C04FD705A2}: a blank,
  ;; never-navigated WebBrowser control.
  ;;
  ;; The Game Maker 7/8 runner (Delphi) puts a TWebBrowser ("SplashWeb") on its
  ;; TSplashForm, so every Game Maker game creates one while its forms stream
  ;; in, whether or not it ever shows an HTML splash. TOleControl.Create
  ;; CoCreateInstance's IOleObject, asks GetMiscStatus, calls SetClientSite
  ;; when OLEMISC_SETCLIENTSITEFIRST is set, takes IWebBrowser2 and
  ;; IPersistStreamInit, sizes itself through GetExtent, and on destruction
  ;; Close's and clears the site. Without the class the activation fails and
  ;; the runner dies with EOleSysError before the game loads (Spelunky
  ;; Classic, docs/re-notes/spelunky-classic.md).
  ;;
  ;; What this object is: one DxObject (type 36) behind four interfaces --
  ;; IOleObject (also IUnknown), IPersistStreamInit (also IPersist),
  ;; IOleControl, and IWebBrowser2 (also IWebBrowserApp, IWebBrowser,
  ;; IDispatch) -- sharing the object's reference count. It holds the state a
  ;; blank control has: its HIMETRIC extent (misc1/misc2), whether InitNew
  ;; ran (flags bit 0) and whether it is closed (flags bit 1). It owns one
  ;; reference, on the client site (misc0): SetClientSite, GetClientSite and
  ;; the final Release AddRef/Release the guest site through the OLE
  ;; guest-callback transaction (09a7b-ole.wat, operations 2 and 39). Nothing
  ;; else calls the site, so what would need it -- DoVerb in-place
  ;; activation, navigation, Advise, IPersistStreamInit::Load of stored
  ;; ControlData through the host's IStream -- is crash_unimplemented.
  ;; IConnectionPointContainer is not exposed: Delphi's InterfaceConnect
  ;; treats E_NOINTERFACE as "no events", which is the truth for a control
  ;; that never navigates.
  (global $WEBBROWSER_OLEOBJ_VTBL (mut i32) (i32.const 0))
  (global $WEBBROWSER_PSI_VTBL (mut i32) (i32.const 0))
  (global $WEBBROWSER_OLECTL_VTBL (mut i32) (i32.const 0))
  (global $WEBBROWSER_WB2_VTBL (mut i32) (i32.const 0))

  (func $webbrowser_init_vtables
    (if (i32.eqz (global.get $WEBBROWSER_OLEOBJ_VTBL))
      (then
        (global.set $WEBBROWSER_OLEOBJ_VTBL
          (call $init_com_vtable (global.get $API_ID_WebBrowserOleObject_BASE) (i32.const 24)))
        (global.set $WEBBROWSER_PSI_VTBL
          (call $init_com_vtable (global.get $API_ID_WebBrowserPersistStreamInit_BASE) (i32.const 9)))
        (global.set $WEBBROWSER_OLECTL_VTBL
          (call $init_com_vtable (global.get $API_ID_WebBrowserOleControl_BASE) (i32.const 7)))
        (global.set $WEBBROWSER_WB2_VTBL
          (call $init_com_vtable (global.get $API_ID_IWebBrowser2_BASE) (i32.const 71))))))

  ;; One factory-owned reference on the IOleObject identity; the caller
  ;; queries the requested interface and drops this reference.
  (func $webbrowser_create (result i32)
    (local $obj i32) (local $entry i32)
    (call $webbrowser_init_vtables)
    (local.set $obj (call $dx_create_com_obj (i32.const 36) (global.get $WEBBROWSER_OLEOBJ_VTBL)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject misc0 (local.get $entry) (i32.const 0))
    ;; The initial HIMETRIC extent Wine's shdocvw gives a new control
    ;; (about 50 x 20 mm); the host replaces it through SetExtent.
    (store.field DxObject misc1 (local.get $entry) (i32.const 1323))
    (store.field DxObject misc2 (local.get $entry) (i32.const 529))
    (store.field DxObject flags (local.get $entry) (i32.const 0))
    (local.get $obj))

  (func $webbrowser_query_interface_wa (param $this i32) (param $iid_wa i32)
      (param $out i32) (result i32)
    (local $vtbl i32) (local $wrapper i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (call $gs32 (local.get $out) (i32.const 0))
    (if (i32.eqz (local.get $iid_wa)) (then (return (i32.const 0x80004003))))
    (call $webbrowser_init_vtables)
    ;; IUnknown / IOleObject {00000112-0000-0000-C000-000000000046}.
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x00000112) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000)))
      (then (local.set $vtbl (global.get $WEBBROWSER_OLEOBJ_VTBL))))
    ;; IPersistStreamInit {7FD52380-4E07-101B-AE2D-08002B2EC713} /
    ;; IPersist {0000010C-0000-0000-C000-000000000046}.
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x7FD52380) (i32.const 0x101B4E07) (i32.const 0x00082DAE) (i32.const 0x13C72E2B))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x0000010C) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000)))
      (then (local.set $vtbl (global.get $WEBBROWSER_PSI_VTBL))))
    ;; IOleControl {B196B288-BAB4-101A-B69C-00AA00341D07}.
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0xB196B288) (i32.const 0x101ABAB4) (i32.const 0xAA009CB6) (i32.const 0x071D3400))
      (then (local.set $vtbl (global.get $WEBBROWSER_OLECTL_VTBL))))
    ;; IWebBrowser2 {D30C1661-CDAF-11D0-8A3E-00C04FC9E26E} derives from
    ;; IWebBrowserApp {0002DF05-0000-0000-C000-000000000046}, IWebBrowser
    ;; {EAB22AC1-30C1-11CF-A7EB-0000C05BAE0B} and IDispatch
    ;; {00020400-0000-0000-C000-000000000046}: one vtable answers all four.
    (if (i32.or
          (i32.or
            (call $guid_words_equal (local.get $iid_wa)
              (i32.const 0xD30C1661) (i32.const 0x11D0CDAF) (i32.const 0xC0003E8A) (i32.const 0x6EE2C94F))
            (call $guid_words_equal (local.get $iid_wa)
              (i32.const 0x0002DF05) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000)))
          (i32.or
            (call $guid_words_equal (local.get $iid_wa)
              (i32.const 0xEAB22AC1) (i32.const 0x11CF30C1) (i32.const 0x0000EBA7) (i32.const 0x0BAE5BC0))
            (call $guid_words_equal (local.get $iid_wa)
              (i32.const 0x00020400) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000))))
      (then (local.set $vtbl (global.get $WEBBROWSER_WB2_VTBL))))
    (if (i32.eqz (local.get $vtbl)) (then (return (i32.const 0x80004002)))) ;; E_NOINTERFACE
    (local.set $wrapper (call $dx_get_wrapper_for_vtbl
      (call $dx_slot_of (call $dx_from_this (local.get $this))) (local.get $vtbl)))
    (if (i32.eqz (local.get $wrapper)) (then (return (i32.const 0x8007000E)))) ;; E_OUTOFMEMORY
    (drop (call $dx_com_addref (local.get $this)))
    (call $gs32 (local.get $out) (local.get $wrapper))
    (i32.const 0))

  (func $webbrowser_query_interface (param $this i32) (param $iid i32) (param $out i32) (result i32)
    (call $webbrowser_query_interface_wa (local.get $this)
      (if (result i32) (local.get $iid)
        (then (call $g2w (local.get $iid)))
        (else (i32.const 0)))
      (local.get $out)))

  ;; Write CLSID_WebBrowser to a guest CLSID*.
  (func $webbrowser_write_clsid (param $out i32) (result i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80004003))))
    (call $gs32 (local.get $out) (i32.const 0x8856F961))
    (call $gs32 (i32.add (local.get $out) (i32.const 4)) (i32.const 0x11D0340A))
    (call $gs32 (i32.add (local.get $out) (i32.const 8)) (i32.const 0xC0006BA9))
    (call $gs32 (i32.add (local.get $out) (i32.const 12)) (i32.const 0xA205D74F))
    (i32.const 0))

  ;; Handlers below return through $amstream_finish (09a7-handlers-dispatch):
  ;; EAX = hr, then pop the stdcall arguments.

  ;; ---- shared IUnknown, every interface (one identity, one count) ----
  (func $handle_WebBrowser_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish
      (call $webbrowser_query_interface (local.get $arg0) (local.get $arg1) (local.get $arg2))
      (i32.const 16)))
  ;; AddRef aliases $handle_dx_com_addref (api_table.json). The final Release
  ;; gives up the object's client-site reference, which is a guest call.
  (func $handle_WebBrowser_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $site i32) (local $ctx i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (local.get $entry)
      (then (local.set $site (load.field DxObject misc0 (local.get $entry)))))
    (if (i32.and
          (i32.ne (local.get $site) (i32.const 0))
          (i32.and
            (i32.eq (load.field DxObject refcount (local.get $entry)) (i32.const 1))
            (i32.ne (call $ole_guest_method_addr (local.get $site) (i32.const 2)) (i32.const 0))))
      (then
        (store.field DxObject misc0 (local.get $entry) (i32.const 0))
        (drop (call $dx_com_release_basic (local.get $arg0)))
        (local.set $ctx (call $ole_guest_callback_context
          (i32.const 39) (i32.const 1) (call $gl32 (i32.load offset=16 (global.get $reg_base)))
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))
          (i32.const 0) (i32.const 0) (i32.const 0) (local.get $site) (i32.const 0)))
        (drop (call $ole_guest_callback_invoke1 (local.get $ctx) (local.get $site) (i32.const 2)))
        (return)))
    (call $amstream_finish (call $dx_com_release_basic (local.get $arg0)) (i32.const 8)))

  ;; CACA0011 resumes operation 39 ($ole_guest_callback_continue) after a
  ;; guest site AddRef (stage 0) or Release (stage 1). Context: root = this,
  ;; p1 = new site, p3 = former site. Stage 0 publishes the new site before
  ;; releasing the former one, the COM replacement order.
  (func $webbrowser_site_continue (param $ctx i32)
    (local $entry i32) (local $old i32)
    (if (i32.eqz (call $gl32 (i32.add (local.get $ctx) (i32.const 8))))
      (then
        (local.set $entry (call $dx_from_this (call $gl32 (i32.add (local.get $ctx) (i32.const 20)))))
        (if (local.get $entry)
          (then (store.field DxObject misc0 (local.get $entry)
            (call $gl32 (i32.add (local.get $ctx) (i32.const 24))))))
        (local.set $old (call $gl32 (i32.add (local.get $ctx) (i32.const 32))))
        (if (local.get $old)
          (then
            (call $gs32 (i32.add (local.get $ctx) (i32.const 8)) (i32.const 1))
            (if (call $ole_guest_callback_invoke1 (local.get $ctx) (local.get $old) (i32.const 2))
              (then (return)))))))
    (call $ole_guest_callback_finish (local.get $ctx) (i32.const 0)))

  ;; Everything else needs a document, navigation or in-place activation, and
  ;; stays fail-fast until a program reaches it: DoVerb, Advise,
  ;; IPersistStreamInit::Load/Save, IOleControl::GetControlInfo/OnMnemonic,
  ;; and all of IDispatch/IWebBrowser2 past IUnknown. Those rows alias the
  ;; shared $handle_ftm_unimplemented (api_table.json), which crashes with
  ;; the method's own name.

  ;; ---- IOleObject ----
  ;; The object owns one reference on its client site (misc0). A guest site
  ;; is AddRef'd before it is published and the former one Released after.
  (func $handle_WebBrowserOleObject_SetClientSite (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $old i32) (local $ctx i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then (call $amstream_finish (i32.const 0x8000FFFF) (i32.const 12)) (return)))
    (local.set $old (load.field DxObject misc0 (local.get $entry)))
    (if (i32.eq (local.get $old) (local.get $arg1))
      (then (call $amstream_finish (i32.const 0) (i32.const 12)) (return)))
    (if (i32.or
          (i32.and (i32.ne (local.get $arg1) (i32.const 0))
            (i32.eqz (call $ole_guest_method_addr (local.get $arg1) (i32.const 1))))
          (i32.and (i32.ne (local.get $old) (i32.const 0))
            (i32.eqz (call $ole_guest_method_addr (local.get $old) (i32.const 2)))))
      (then (call $amstream_finish (i32.const 0x80004002) (i32.const 12)) (return)))
    (if (i32.eqz (local.get $arg1))
      (then (store.field DxObject misc0 (local.get $entry) (i32.const 0))))
    (local.set $ctx (call $ole_guest_callback_context
      (i32.const 39) (i32.eqz (local.get $arg1))
      (call $gl32 (i32.load offset=16 (global.get $reg_base)))
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))
      (local.get $arg0) (local.get $arg1) (i32.const 0) (local.get $old) (i32.const 0)))
    (if (local.get $arg1)
      (then (drop (call $ole_guest_callback_invoke1 (local.get $ctx) (local.get $arg1) (i32.const 1))))
      (else (drop (call $ole_guest_callback_invoke1 (local.get $ctx) (local.get $old) (i32.const 2))))))
  ;; Hands out an AddRef'd site through the shared GetClientSite completion
  ;; (operation 2 writes *ppSite and returns S_OK). No site: S_OK with NULL.
  (func $handle_WebBrowserOleObject_GetClientSite (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $site i32) (local $ctx i32)
    (if (i32.eqz (local.get $arg1))
      (then (call $amstream_finish (i32.const 0x80004003) (i32.const 12)) (return)))
    (call $gs32 (local.get $arg1) (i32.const 0))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (local.get $entry)
      (then (local.set $site (load.field DxObject misc0 (local.get $entry)))))
    (if (i32.eqz (local.get $site))
      (then (call $amstream_finish (i32.const 0) (i32.const 12)) (return)))
    (if (i32.eqz (call $ole_guest_method_addr (local.get $site) (i32.const 1)))
      (then (call $amstream_finish (i32.const 0x80004002) (i32.const 12)) (return)))
    (local.set $ctx (call $ole_guest_callback_context
      (i32.const 2) (i32.const 0) (call $gl32 (i32.load offset=16 (global.get $reg_base)))
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))
      (local.get $arg0) (local.get $site) (local.get $arg1) (i32.const 0) (i32.const 0)))
    (drop (call $ole_guest_callback_invoke1 (local.get $ctx) (local.get $site) (i32.const 1))))
  ;; Container/document names are only window-title material for a server.
  (func $handle_WebBrowserOleObject_SetHostNames (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 0) (i32.const 16)))
  ;; A blank document has nothing to save under any OLECLOSE option.
  (func $handle_WebBrowserOleObject_Close (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (local.get $entry)
      (then (store.field DxObject flags (local.get $entry)
        (i32.or (load.field DxObject flags (local.get $entry)) (i32.const 2)))))
    (call $amstream_finish (i32.const 0) (i32.const 12)))
  ;; Also IPersist::GetClassID (same arguments, same answer).
  (func $handle_WebBrowserOleObject_GetUserClassID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (call $webbrowser_write_clsid (local.get $arg1)) (i32.const 12)))
  ;; (this, dwDrawAspect, SIZEL*) -- HIMETRIC extent kept in misc1/misc2.
  (func $handle_WebBrowserOleObject_SetExtent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.eqz (local.get $entry)))
      (then (call $amstream_finish (i32.const 0x80070057) (i32.const 16)) (return)))
    (store.field DxObject misc1 (local.get $entry) (call $gl32 (local.get $arg2)))
    (store.field DxObject misc2 (local.get $entry) (call $gl32 (i32.add (local.get $arg2) (i32.const 4))))
    (call $amstream_finish (i32.const 0) (i32.const 16)))
  (func $handle_WebBrowserOleObject_GetExtent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.eqz (local.get $entry)))
      (then (call $amstream_finish (i32.const 0x80070057) (i32.const 16)) (return)))
    (call $gs32 (local.get $arg2) (load.field DxObject misc1 (local.get $entry)))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 4)) (load.field DxObject misc2 (local.get $entry)))
    (call $amstream_finish (i32.const 0) (i32.const 16)))
  ;; OLEMISC_SETCLIENTSITEFIRST | ACTIVATEWHENVISIBLE | INSIDEOUT |
  ;; CANTLINKINSIDE | RECOMPOSEONRESIZE: the WebBrowser control's status.
  (func $handle_WebBrowserOleObject_GetMiscStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg2))
      (then (call $amstream_finish (i32.const 0x80004003) (i32.const 16)) (return)))
    (call $gs32 (local.get $arg2) (i32.const 0x00020191))
    (call $amstream_finish (i32.const 0) (i32.const 16)))

  ;; ---- IPersistStreamInit ----
  ;; A blank control never changes its persistent state: S_FALSE.
  (func $handle_WebBrowserPersistStreamInit_IsDirty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 1) (i32.const 8)))
  (func $handle_WebBrowserPersistStreamInit_InitNew (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (local.get $entry)
      (then (store.field DxObject flags (local.get $entry)
        (i32.or (load.field DxObject flags (local.get $entry)) (i32.const 1)))))
    (call $amstream_finish (i32.const 0) (i32.const 8)))

  ;; ---- IOleControl ----
  ;; Also FreezeEvents: ambient properties only matter to a rendered document,
  ;; and a control that fires no events has nothing to hold back.
  (func $handle_WebBrowserOleControl_OnAmbientPropertyChange (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 0) (i32.const 12)))
