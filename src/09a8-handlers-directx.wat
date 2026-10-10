  ;; ============================================================
  ;; DIRECTX HANDLERS — DirectDraw, DirectSound, DirectInput
  ;; COM vtable dispatch via thunk zone (reuses existing IAT infra)
  ;; ============================================================

  ;; ── DX_OBJECTS table ─────────────────────────────────────────
  ;; 4096 entries × 32 bytes at 0x07F60000 (high memory, safe from guest writes)
  ;; +0  type: 0=free,1=DDraw,2=DDSurface,3=DDPalette,4=DSound,5=DSBuffer,6=DInput,7=DIDev,26=DPlay3,27=DPlayLobby2,28=DAView,29=DAStatics,30=IMalloc,31=DABehavior/node
  ;; +4  refcount
  ;; +8  misc0 (DDraw/DSound: hwnd, DSBuffer: wave_handle, DIDev: device_type 1=kbd 2=mouse)
  ;; +12 width (u16) | height (u16); DIDev: DIPROP_BUFFERSIZE
  ;; +16 bpp (u16) | pitch (u16); DIDev: parent DirectInput version
  ;; +20 misc1 (DDSurface: dib_ptr, DSound: DSSCL level, 0 before SetCooperativeLevel)
  ;; +24 misc2 (DDSurface: color key low / surface byte size)
  ;; +28 flags (surface type: 1=primary,2=backbuf,4=offscreen; 0x100=has_colorkey;
  ;;            DSound root: initialized speaker configuration plus one)
  ;; D3D9 surface arm: 0x40000000 = guest CPU ownership (not compositor binding).
  ;; 0x20000000 = acquire pending; 0x10000000 = release upload pending.
  ;; Bit 27 = D3D9 lockable backbuffer, captured from presentation flags.
  ;; Bit26 distinguishes LockRect from GetDC; bit25 records READONLY LockRect.
  ;;
  ;; The comment above is the SEMANTICS; the declaration below is the OFFSETS,
  ;; and after wave 4 of docs/watx-layout-migration-design.md it is the only
  ;; place they are written down. Reached through $dx_from_this in five files
  ;; (09a8, 09aa, 09ab, 09ad, 09a7); layouts are module-global, so those files
  ;; use this declaration without repeating it.
  ;;
  ;; NOT frozen (§7): this is our record, not a Win32 ABI structure — no guest
  ;; code reads these offsets. But `size-of DxObject` must stay 32 to agree with
  ;; $DX_ENTRY_SIZE and with the `(i32.mul slot (i32.const 32))` in $dx_from_this
  ;; and $dx_slot_of, which are byte-identity-pinned and deliberately untouched.
  ;;
  ;; width/height/bpp/pitch are u16 PAIRS packed into one dword each. They were
  ;; declared `u8 2` through wave 4 — the right OFFSETS and size, deliberately
  ;; the wrong width to load through — because §3.1 had no u16 field type, so
  ;; every access stayed hand-spelled and the codemod declined those sites
  ;; rather than widening them to i32 (which would read two fields as one).
  ;; a5fc1b72 closed the field-type set and admitted u16/s16/s8, so they are
  ;; now declared at their true width and the accesses go through the accessor.
  ;;
  ;; u16 AND NOT s16 IS A MEASURED CHOICE, NOT A DEFAULT. Signedness lives in
  ;; the FIELD TYPE, not the access: u16 emits i32.load16_u and s16 emits
  ;; i32.load16_s, and there is no per-site override. Every 16-bit load against
  ;; these four across all three DX files is `_u` (0 occurrences of
  ;; i32.load16_s in 09a8/09ab/09ad), so u16 is the type that reproduces the
  ;; existing bytes exactly. A site that ever needs sign extension must not be
  ;; spelled through a u16 field — split the field or keep that site by hand.
  ;;
  ;; +12 AND +16 ARE ALSO UNIONS, exactly like misc0/misc1/misc2 below, and the
  ;; four names are the SURFACE arm only. Other object types use the same two
  ;; dwords whole: a DirectInput device reads a `capacity` at +12, a D3D device
  ;; a `version` at +16. So the codemod converts the 64 sites that spell a
  ;; 16-bit op and DECLINES the 59 that spell i32.load/i32.store there — and
  ;; that decline is the gate working, not the gate giving up. Widening those
  ;; to `load.field width` would read two fields as one and label a capacity as
  ;; a width; the width mismatch is the only thing standing between the two
  ;; readings, because both are legal accesses to the same four bytes.
  ;;
  ;; WHY +8/+20/+24 ARE CALLED misc0/misc1/misc2 AND NOT hwnd/dib_ptr/color_key.
  ;; They are per-TYPE unions — one record serves surfaces, sound buffers,
  ;; viewports, execute buffers and devices — and the migration's whole point is
  ;; that the name IS the truth. A field called `dib_ptr` would be a lie at the
  ;; majority of its own sites, which is the same plausible-but-wrong trap the
  ;; hand-spelled offsets were, one level up. Measured over the 367 converted
  ;; sites, what actually lives in each:
  ;;   misc1 (+20)  DDSurface: dib_ptr | DDPalette: palette data addr
  ;;                D3DIM light: next-in-list | execbuf: data guest ptr
  ;;                D3DIM vertex buf: FVF | viewport: width
  ;;   misc2 (+24)  DDSurface: color key low | DSBuffer: nSamplesPerSec
  ;;                D3DIM execbuf: instruction offset | viewport: height
  ;; The per-type reading belongs at the site, which is where the type is known.
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
    (field flags    i32))    ;; +28  ends at +32 == $DX_ENTRY_SIZE
  (global $DX_OBJECTS i32 (region.addr $DX_OBJECTS 0))
  (global $DX_OBJECTS_SIZE i32 (region.size $DX_OBJECTS))
  ;; 8192 rather than 4096 because a texture cache is sized from the video
  ;; memory we report, and the surfaces that fill it are all live at once --
  ;; exhaustion here is not a slot leak, $dx_alloc_locked already recycles.
  ;; Diablo II sizes its cache twice against its own 32 MB ceiling and never
  ;; releases the first one, and 32 MB of arena is about 3550 surfaces (~179
  ;; of 256x256, ~97 of 128x128, ~3276 of 32x32 at 2 bytes a pixel), which is
  ;; why 4096 filled at 4094 and asserted in the guest's d3dSprite.cpp:85.
  ;; Two rounds plus what the game holds besides fits here; $DX_VIDMEM_TOTAL
  ;; is the other half of this and the two move together.
  (global $DX_MAX i32 (i32.const 8192))
  ;; D3DIM matrix handle table (Immediate Mode): 256 slots × 64 bytes.
  ;; Handle value = slot_idx + 1 (0 is invalid). Allocation state is kept in
  ;; a separate byte table because SetMatrix may legitimately store an all-zero
  ;; matrix; matrix contents therefore cannot serve as the ownership marker.
  (global $D3DIM_MATRICES i32 (region.addr $D3DIM_MATRICES 0))
  (global $D3DIM_MATRICES_SIZE i32 (region.size $D3DIM_MATRICES))
  (global $D3DIM_MATRIX_MAX i32 (i32.const 256))
  (global $D3DIM_MATRIX_USED i32 (region.addr $D3DIM_AUX 0x00000F00))
  (global $DX_ENTRY_SIZE i32 (i32.const 32))
  ;; Per-surface palette: DX_MAX slots × 4 bytes, holding the WASM address of
  ;; the palette data last handed to that surface's SetPalette. The DX entry
  ;; itself is full (32 bytes, every field taken), and a single global is wrong
  ;; for textures: an 8bpp D3D texture carries its own palette while the
  ;; primary surface carries another.
  (global $DX_SURF_PAL i32 (region.addr $DX_SURF_PAL 0))
  (global $DX_SURF_PAL_SIZE i32 (region.size $DX_SURF_PAL))
  ;; DirectDraw surfaces with the same bit count can have incompatible channel
  ;; layouts. In particular MW3 uses ARGB4444 light/detail textures alongside
  ;; RGB565 render targets. Keep one normalized format kind per surface:
  ;;   0=infer from bpp, 1=RGB565, 2=XRGB1555, 3=ARGB1555,
  ;;   4=ARGB4444, 5=ARGB8888, 6=XRGB8888.
  (global $DX_SURF_FMT i32 (region.addr $DX_SURF_FMT 0))
  (global $DX_SURF_FMT_SIZE i32 (region.size $DX_SURF_FMT))
  ;; Creation caps and attachment parent for every surface.  AddAttachedSurface
  ;; is used for flipping chains and mipmaps as well as depth buffers, so D3DIM
  ;; must retain DDSCAPS_ZBUFFER instead of treating every attached 16-bit
  ;; surface as depth.  4096 entries x {caps,parent_slot+1}.
  (global $DX_SURF_META i32 (region.addr $DX_SURF_META 0))
  (global $DX_SURF_META_SIZE i32 (region.size $DX_SURF_META))
  ;; DirectDraw object that created each surface, stored as owner slot + 1.
  ;; EnumSurfaces is scoped to one DirectDraw instance; a process may have
  ;; several live instances and must not see surfaces belonging to another.
  (global $DX_SURF_OWNER i32 (region.addr $DX_SURF_OWNER 0))
  (global $DX_SURF_OWNER_SIZE i32 (region.size $DX_SURF_OWNER))
  ;; Per-object auxiliary records. For DirectDraw surfaces these hold CPU-write
  ;; epochs and reversible-copy provenance:
  ;; 4096 entries x 32 bytes in 0x07F36000..0x07F55FFF:
  ;;   +0  CPU-write epoch (advanced by Unlock)
  ;;   +4  source slot + 1 of the last small <- large plain Blt, or 0
  ;;   +8  source CPU epoch at that save
  ;;   +12/+16 source x/y in the large surface
  ;;   +20/+24 destination x/y in the save surface
  ;;   +28 width (u16) | height (u16)
  ;; This recognizes the classic software-cursor save/draw/restore idiom. If
  ;; the large surface was CPU-redrawn after the save, replaying those pixels
  ;; would stamp stale terrain over the new frame (AoE I/II). Exact inverse
  ;; rectangle matching keeps ordinary small-surface blits untouched.
  ;;
  ;; DirectSound buffers use the same per-slot storage as a disjoint union:
  ;;   +0 owner DirectSound slot + 1, +4 creation DSBCAPS, +8 current DSSCL,
  ;;   +12 play-cursor base (the stopped position or live snapshot origin).
  ;;   +16 volume and +20 pan, signed centibels; zero is the initial value.
  ;;   +24 playback frequency override (0 = original PCM format rate in misc2).
  ;; $dx_create_com_obj clears the full record before either type publishes it.
  (global $DX_SURF_STATE i32 (region.addr $DX_SURF_STATE 0))
  (global $DX_SURF_STATE_SIZE i32 (region.size $DX_SURF_STATE))
  ;; Per-destination cache for the 32x32 keyed software cursor used by MCM.
  ;; +0 is 0 (inactive), 1 (legacy null-source frame marker seen), or a DIB-
  ;; arena record holding two physical-page identities, x/y pairs, and their
  ;; 32x32x16 backgrounds. Flip swaps DIB pointers between COM surface entries,
  ;; so keying those two saves by physical page is essential.
  ;; +4 is the guest IDirectDrawClipper pointer retained by a type-2 surface.
  ;; Keeping this in the existing parallel table avoids stealing one of the
  ;; fully occupied per-type union fields in DxObject.
  (global $DX_CURSOR_SAVE i32 (region.addr $DX_CURSOR_SAVE 0))
  (global $DX_CURSOR_SAVE_SIZE i32 (region.size $DX_CURSOR_SAVE))
  ;; COM wrapper stubs: DX_MAX × 8 bytes in high memory (safe from guest address collision)
  (global $COM_WRAPPERS i32 (region.addr $COM_WRAPPERS 0))
  (global $COM_WRAPPERS_SIZE i32 (region.size $COM_WRAPPERS))
  ;; Auxiliary wrappers for QueryInterface results that need a different vtable
  ;; than the primary wrapper. Each entry is [vtbl, slot], same shape as the
  ;; primary wrappers so $dx_from_this works for aux guest ptrs too. Dedup'd
  ;; by (slot, vtbl) via linear scan.
  (global $COM_WRAPPERS_AUX  i32 (region.addr $COM_WRAPPERS_AUX 0))
  (global $COM_WRAPPERS_AUX_SIZE i32 (region.size $COM_WRAPPERS_AUX))
  ;; One per live DX object, because an app may hold an alternate view of every
  ;; object it owns at once and exhaustion is not a graceful degradation here:
  ;; the miss path below rewrites the PRIMARY wrapper's vtbl in place, so the
  ;; pointer the app already holds silently changes interface. Diablo II's
  ;; Render=1 path QueryInterfaces all 5434 of its surfaces for
  ;; IID_IDirect3DTexture2; past the old 2015 the surface it kept using came
  ;; back carrying the 6-slot texture vtable, and its next Lock (slot 25) read
  ;; past the end of that vtable into the next heap block's thunks and
  ;; dispatched IFont_get_Charset.
  (global $COM_WRAPPERS_AUX_MAX i32 (i32.const 8192))
  ;; The aux-wrapper cursor lives at $COM_AUX_NEXT_SHARED, not in a global: a
  ;; mutable global is per-instance, and every guest thread is its own instance
  ;; over this one memory, so two threads would hand out the same aux slot. Same
  ;; shape of bug $heap_ptr had (docs/design-real-threads.md §3.1a). Read and
  ;; written only under $LOCK_DX.
  ;; Rotating cursor for the recycle tier in $dx_alloc. Kept out of the fresh
  ;; scan so a slot that was just freed is the LAST one handed back out. Stays a
  ;; global: it only biases which free slot is picked, and $dx_alloc holds
  ;; $LOCK_DX while it claims one, so a per-instance copy costs nothing.
  (global $dx_recycle_cursor (mut i32) (i32.const 0))

  ;; Shared registry for COM vtable guest addresses. The vtable globals below
  ;; are per-WASM-instance, while threads use separate instances over one
  ;; shared memory. The main instance records the addresses produced by
  ;; $init_dx_com_thunks here; a worker restores its local globals before its
  ;; guest code begins. Reserve the tail of the auxiliary-wrapper region
  ;; rather than overlapping VSOCK_TABLE at 0x07FFE000.
  (global $DX_VTBL_REGISTRY i32 (region.addr $DX_VTBL_REGISTRY 0))
  ;; Registry count and worker restoration are generated with vtable initialization.

  ;; Vtable blocks — arrays of thunk guest-addrs, one per interface type.
  ;; Must be in guest-reachable memory (above image_base), so allocated from heap.
  ;; These globals store the GUEST address of each vtable block (set by init_dx_com_thunks).
  (global $DX_VTBL_DDRAW      (mut i32) (i32.const 0))
  (global $DX_VTBL_DDSURF     (mut i32) (i32.const 0))
  (global $DX_VTBL_DDPAL      (mut i32) (i32.const 0))
  (global $DX_VTBL_DSOUND     (mut i32) (i32.const 0))
  (global $DX_VTBL_DSOUND8    (mut i32) (i32.const 0))
  (global $DX_VTBL_DSBUF      (mut i32) (i32.const 0))
  (global $DX_VTBL_DS3DBUF    (mut i32) (i32.const 0))
  (global $DX_VTBL_DS3DLISTENER (mut i32) (i32.const 0))
  (global $DX_VTBL_DINPUT     (mut i32) (i32.const 0))
  (global $DX_VTBL_DIDEV      (mut i32) (i32.const 0))
  (global $DX_VTBL_DPLAY3     (mut i32) (i32.const 0))
  (global $DX_VTBL_DPLAY4W (mut i32) (i32.const 0))
  (global $DX_VTBL_DPLAY4     (mut i32) (i32.const 0))
  (global $DX_VTBL_DPLAYLOBBY3 (mut i32) (i32.const 0))
  (global $DX_VTBL_DPLAYLOBBY2 (mut i32) (i32.const 0))
  (global $DX_VTBL_DPLAYLOBBY3W (mut i32) (i32.const 0))
  (global $DX_VTBL_D3D        (mut i32) (i32.const 0))
  (global $DX_VTBL_D3D3       (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DDEV3    (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DVP3     (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DLIGHT   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DMAT3    (mut i32) (i32.const 0))
  (global $DX_VTBL_DDFACTORY  (mut i32) (i32.const 0))
  (global $DX_VTBL_DA_VIEW    (mut i32) (i32.const 0))
  (global $DX_VTBL_DA_STATICS (mut i32) (i32.const 0))
  (global $DX_VTBL_DA_BEHAVIOR (mut i32) (i32.const 0))
  (global $DX_VTBL_IMALLOC    (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_ROT    (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_ENUMMONIKER (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_MONIKER (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_BINDCTX (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_ENUMSTRING (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_LOCKBYTES (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_STREAM    (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_STORAGE   (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_DATAOBJECT (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_ENUMFORMATETC (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_ENUMSTATSTG (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_OBJECT (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_PERSISTSTORAGE (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_CACHE (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_VIEWOBJECT (mut i32) (i32.const 0))
  (global $DX_VTBL_OLE_VIEWOBJECT2 (mut i32) (i32.const 0))
  (global $DX_VTBL_DDRAW2    (mut i32) (i32.const 0))
  ;; IDirectDraw4/7 are lazy extensions of the generated IDirectDraw2 table.
  ;; Keeping them out of the fixed cross-thread vtable registry avoids moving
  ;; that registry's tightly packed shared-memory boundary; each WASM instance
  ;; constructs the same ABI-correct tail on first use.
  (global $DX_VTBL_DDRAW4    (mut i32) (i32.const 0))
  (global $DX_VTBL_DDRAW7    (mut i32) (i32.const 0))
  (global $DX_VTBL_DDSURF2   (mut i32) (i32.const 0))
  (global $DX_VTBL_DDSURF3   (mut i32) (i32.const 0))
  (global $DX_VTBL_DDCLIP    (mut i32) (i32.const 0))
  ;; Direct3D Immediate Mode vtables (Phase 0+ — populated by $init_dx_com_thunks)
  (global $DX_VTBL_D3D2      (mut i32) (i32.const 0))
  (global $DX_VTBL_D3D7      (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DDEV1   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DDEV2   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DDEV7   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DVP1    (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DVP2    (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DMAT1   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DMAT2   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DEXEC   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DVB     (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DVB7    (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DTEX    (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DTEX2   (mut i32) (i32.const 0))
  ;; OLE Automation font object (OleCreateFontIndirect).
  (global $DX_VTBL_OLE_FONT  (mut i32) (i32.const 0))
  ;; IDirectInput7 — the v1 vtable plus FindDevice/CreateDeviceEx.
  (global $DX_VTBL_DINPUT7   (mut i32) (i32.const 0))
  ;; IDirectInputDevice2 — the v1 device vtable plus the nine force-feedback /
  ;; Poll methods. Every device we hand out uses this one: QueryInterface
  ;; returns the same pointer for IID_IDirectInputDevice and
  ;; IID_IDirectInputDevice2, and v2 is a strict superset, so one vtable is
  ;; correct for both. Without the extra slots a v2 caller's Poll (slot 25)
  ;; landed on whichever interface's thunks followed ours.
  (global $DX_VTBL_DIDEV2    (mut i32) (i32.const 0))
  ;; Direct3D 9 vtables (Direct3DCreate9 path).
  (global $DX_VTBL_D3D9      (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DDEV9   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DTEX9   (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DSURF9  (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DSWAP9  (mut i32) (i32.const 0))
  ;; D3D8 factory/device; appended after every established vtable.
  (global $DX_VTBL_D3D8      (mut i32) (i32.const 0))
  (global $DX_VTBL_D3DDEV8   (mut i32) (i32.const 0))
  ;; Free-threaded marshaler: inner IUnknown and IMarshal.
  (global $DX_VTBL_FTM_INNER   (mut i32) (i32.const 0))
  (global $DX_VTBL_FTM_MARSHAL (mut i32) (i32.const 0))
  ;; IDirectInputDevice7 — the v2 device vtable plus EnumEffectsInFile and
  ;; WriteEffectToFile. v7 is a strict superset of v2 the way v2 is of v1, so
  ;; a device hands out whichever face the caller asked for and QueryInterface
  ;; answers all three from the same object.
  (global $DX_VTBL_DIDEV7    (mut i32) (i32.const 0))

  (func $dx_vtable_registry_reset
    (i32.store (global.get $DX_VTBL_REGISTRY) (i32.const 0)))

  (func $dx_vtable_registry_append (param $vtbl_guest i32)
    (local $count i32)
    (local.set $count (i32.load (global.get $DX_VTBL_REGISTRY)))
    (if (i32.lt_u (local.get $count) (global.get $DX_VTBL_REGISTRY_COUNT))
      (then
        (i32.store
          (i32.add (global.get $DX_VTBL_REGISTRY)
            (i32.add (i32.const 4) (i32.mul (local.get $count) (i32.const 4))))
          (local.get $vtbl_guest))
        (i32.store (global.get $DX_VTBL_REGISTRY)
          (i32.add (local.get $count) (i32.const 1))))))


  (func $dx_sync_thread_vtables_if_needed
    (if (i32.eqz (global.get $DX_VTBL_DDRAW))
      (then (call $dx_sync_thread_vtables))))

  ;; DirectDraw display/cooperative state is process state, not thread state.
  ;; Mutable WebAssembly globals are private to each instance, so keeping these
  ;; values in globals made a cross-thread SendMessage callback update only the
  ;; HWND owner's copy. Allegro does exactly that while selecting a video mode:
  ;; its caller then observed the old 16bpp mode and rejected every DirectDraw
  ;; driver. Keep the canonical values in shared memory so owner-thread window
  ;; dispatch and the calling DirectDraw thread see the same device state.
  ;;
  ;;   +0/+4/+8  display width/height/bpp (zero means 640/480/configured desktop)
  ;;   +12       display mode has been selected
  ;;   +16       cooperative-level HWND
  ;;   +20       exclusive/fullscreen flag
  ;;   +24       primary palette WASM address
  (global $DX_PROCESS_STATE i32 (region.addr $DX_PROCESS_STATE 0))
  (global $DX_PROCESS_STATE_SIZE i32 (region.size $DX_PROCESS_STATE))

  (func $dx_display_w_get (result i32)
    (local $v i32)
    (local.set $v (i32.atomic.load offset=0 (global.get $DX_PROCESS_STATE)))
    (if (result i32) (local.get $v) (then (local.get $v)) (else (i32.const 640))))
  (func $dx_display_h_get (result i32)
    (local $v i32)
    (local.set $v (i32.atomic.load offset=4 (global.get $DX_PROCESS_STATE)))
    (if (result i32) (local.get $v) (then (local.get $v)) (else (i32.const 480))))
  (func $dx_display_bpp_get (result i32)
    (local $v i32)
    (local.set $v (i32.atomic.load offset=8 (global.get $DX_PROCESS_STATE)))
    ;; No explicit mode yet: report the real launch desktop, also used by GDI.
    (if (result i32) (local.get $v) (then (local.get $v)) (else (call $gdi_desktop_bpp))))
  (func $dx_display_mode_get (result i32)
    (i32.atomic.load offset=12 (global.get $DX_PROCESS_STATE)))
  (func $dx_coop_hwnd_get (result i32)
    (i32.atomic.load offset=16 (global.get $DX_PROCESS_STATE)))
  (func $dx_exclusive_get (result i32)
    (i32.atomic.load offset=20 (global.get $DX_PROCESS_STATE)))
  (func $dx_primary_pal_get (result i32)
    (i32.atomic.load offset=24 (global.get $DX_PROCESS_STATE)))
  (func $dx_display_w_set (param $v i32)
    (i32.atomic.store offset=0 (global.get $DX_PROCESS_STATE) (local.get $v)))
  (func $dx_display_h_set (param $v i32)
    (i32.atomic.store offset=4 (global.get $DX_PROCESS_STATE) (local.get $v)))
  (func $dx_display_bpp_set (param $v i32)
    (i32.atomic.store offset=8 (global.get $DX_PROCESS_STATE) (local.get $v)))
  (func $dx_display_mode_set (param $v i32)
    (i32.atomic.store offset=12 (global.get $DX_PROCESS_STATE) (local.get $v)))
  (func $dx_coop_hwnd_set (param $v i32)
    (i32.atomic.store offset=16 (global.get $DX_PROCESS_STATE) (local.get $v)))
  (func $dx_exclusive_set (param $v i32)
    (i32.atomic.store offset=20 (global.get $DX_PROCESS_STATE) (local.get $v)))
  (func $dx_present_pal_get (result i32)
    (if (i32.and (i32.ne (call $dx_primary_pal_get) (i32.const 0))
          (i32.and (i32.eqz (call $dx_exclusive_get))
            (i32.eq (call $gdi_display_bpp) (i32.const 8))))
      (then (return (i32.add (call $gdi_system_palette) (i32.const 3072)))))
    (call $dx_primary_pal_get))
  (func $dx_primary_pal_set (param $v i32)
    (i32.atomic.store offset=24 (global.get $DX_PROCESS_STATE) (local.get $v)))
  ;; 1 while a non-DirectDraw guest holds a ChangeDisplaySettings mode. It
  ;; lives here, in process state, rather than in a mutable WASM global,
  ;; because a global belongs to ONE INSTANCE: with `--threads` every guest
  ;; thread has its own instance over this one shared memory, globals are
  ;; propagated at spawn and never again, and in the browser's worker backend
  ;; the guest's own main thread is one of those workers. So the guest set the
  ;; flag in a worker's copy while lib/renderer.js asked the main thread's
  ;; copy and got 0 -- SimGolf, which takes the display with
  ;; ChangeDisplaySettingsA(mode, 0), went fullscreen cooperatively and sat in
  ;; the corner of the desktop in threads mode. Every other field of this
  ;; record was already here for exactly this reason.
  (func $dx_display_fullscreen_get (result i32)
    (i32.atomic.load offset=28 (global.get $DX_PROCESS_STATE)))
  (func $dx_display_fullscreen_set (param $v i32)
    (i32.atomic.store offset=28 (global.get $DX_PROCESS_STATE) (local.get $v)))
  ;; 1 once SetDisplayMode has actually chosen a mode. The width/height above
  ;; carry a default, so they cannot answer "is a mode in effect?" on their
  ;; own — and that question decides whether GetSystemMetrics reports the mode
  ;; or the host window ($system_metric in 09a-handlers.wat).

  ;; Running tally of bytes allocated to DirectDraw surfaces. MCM measures
  ;; GetAvailableVidMem delta across CreateSurface/Release to detect texture
  ;; footprint; must move in response to allocations.
  (global $dx_vidmem_used (mut i32) (i32.const 0))

  ;; The card we claim to be, in bytes, reported identically by GetCaps
  ;; (dwVidMemTotal/dwVidMemFree) and by GetAvailableVidMem for local and
  ;; non-local memory alike. It is a named constant because it is not flavour:
  ;; an app that carves a texture cache out of this figure sizes that cache,
  ;; and therefore how many surfaces it creates, from it -- so $DX_MAX is a
  ;; consequence of this number and the two only move together.
  ;;
  ;; 64 MB rather than the 8 MB this used to be, because free is total minus
  ;; what is already held and Diablo II sizes its caches twice. d2direct3d
  ;; takes the NON-LOCAL free figure (d2direct3d+0x10002710), clamps it to its
  ;; own 32 MB ceiling, and divides the arena by the bytes per tile with a
  ;; SIGNED idiv. Answer 0 -- which 8 MB and 16 MB both do by the second round,
  ;; because the first round's caches are never released -- and the slot count
  ;; comes out negative, so the rep stosd at +0x1000929b zeroes about 4 GB.
  ;; That is the 561M-unmapped-access wipe in the re-notes, and because the
  ;; register file lives in memory the dump lands all-zero a long way from it.
  ;; The ceiling on the other side is $DIB_BACKING_BASE, 0x03F00000 (63 MB):
  ;; every surface we hand out is really a DIB there, so promising more video
  ;; memory than that region can back just moves the failure to dib_alloc
  ;; returning the NULL sentinel. Measured at 64 MB: the two rounds together
  ;; ask for two full 32 MB arenas, the arena ends at "pages used 16384 free 0"
  ;; and surfaces come back with dib=0xf0 and nothing in them. 48 MB gives D2
  ;; its full 32 MB ceiling on the first round and a healthy 16 MB on the
  ;; second, and the sum still fits the region with room for the per-surface
  ;; slack row and page rounding.
  ;;
  ;; That rounding is not small, and it is why the figure is 40 MB and not the
  ;; 48 MB the bytes alone suggest. Every surface costs whole 4K pages plus a
  ;; slack row of pitch*16+64, so D2's tile sizes cost 1.09x (256x256), 1.25x
  ;; (128x128) and 2.0x (32x32) of their pixels -- and its cache is 20% 32x32
  ;; tiles by arena bytes, which weights the whole thing to about 1.29x. Both
  ;; rounds plus the 800x600 primary and back buffer then have to fit 63 MB,
  ;; which puts the ceiling near 45 MB; 48 MB was measured filling the arena
  ;; exactly and asserting d3dSprite.cpp:85 on the surface that would not fit.
  (global $DX_VIDMEM_TOTAL i32 (i32.const 0x02800000))

  ;; Most-recently-created IDirectDraw guest ptr; IDirectDrawSurface2::GetDDInterface
  ;; returns it so apps like flip3dtl can navigate from RT surface back to DDraw.
  (global $dx_ddraw_this (mut i32) (i32.const 0))

  ;; HWND supplied through IDirectDraw::SetCooperativeLevel (or the ddrawex
  ;; factory). VCL games commonly create a hidden TApplication window first
  ;; and give DirectDraw their later visible form. Rendering through main_hwnd
  ;; in that case puts the primary surface at the desktop's top-left instead
  ;; of in the game window.
  ;; DDSCL_EXCLUSIVE was granted, i.e. the app owns the whole screen and its
  ;; primary surface *is* the display. Windows the app stacks over the game
  ;; window then share that one framebuffer: they show through wherever they
  ;; do not draw. Storm puts every Diablo menu on a screen-sized WS_POPUP
  ;; SDlgDialog owned by the game window, so an opaque COLOR_BTNFACE backing
  ;; on those erases the presented frame entirely.
  (func $dx_target_hwnd (result i32)
    (if (result i32) (call $dx_coop_hwnd_get)
      (then (call $dx_coop_hwnd_get))
      (else (global.get $main_hwnd))))

  ;; DirectInput mouse tracking (for relative dx/dy)
  ;; Physical browser motion is accumulated in process-shared memory. It must
  ;; not be inferred from get_mouse_position: SetCursorPos legitimately moves
  ;; that virtual cursor and would otherwise become a phantom DirectInput
  ;; event. Atomic exchange lets a Worker consume exactly the deltas that were
  ;; present at its poll while later browser movement remains queued.
  (global $DI_MOUSE_INPUT_STATE i32 (region.addr $DI_MOUSE_INPUT_STATE 0))
  (global $DI_MOUSE_INPUT_STATE_SIZE i32 (region.size $DI_MOUSE_INPUT_STATE))
  (func $di_mouse_delta_peek_x (result i32)
    (i32.atomic.load offset=0 (global.get $DI_MOUSE_INPUT_STATE)))
  (func $di_mouse_delta_peek_y (result i32)
    (i32.atomic.load offset=4 (global.get $DI_MOUSE_INPUT_STATE)))
  (func $di_mouse_delta_take_x (result i32)
    (i32.atomic.rmw.xchg offset=0 (global.get $DI_MOUSE_INPUT_STATE) (i32.const 0)))
  (func $di_mouse_delta_take_y (result i32)
    (i32.atomic.rmw.xchg offset=4 (global.get $DI_MOUSE_INPUT_STATE) (i32.const 0)))
  (func $di_mouse_event_count (result i32)
    (i32.add
      (i32.sub
        (i32.atomic.load offset=12 (global.get $DI_MOUSE_INPUT_STATE))
        (i32.atomic.load offset=8 (global.get $DI_MOUSE_INPUT_STATE)))
      (i32.add
        (i32.ne (i32.atomic.load offset=272 (global.get $DI_MOUSE_INPUT_STATE)) (i32.const 0))
        (i32.ne (i32.atomic.load offset=276 (global.get $DI_MOUSE_INPUT_STATE)) (i32.const 0)))))
  (func $di_mouse_event_peek (param $index i32) (result i32)
    (local $head i32) (local $queued i32) (local $delta i32)
    (local.set $head (i32.atomic.load offset=8 (global.get $DI_MOUSE_INPUT_STATE)))
    (local.set $queued
      (i32.sub (i32.atomic.load offset=12 (global.get $DI_MOUSE_INPUT_STATE))
               (local.get $head)))
    (if (i32.lt_u (local.get $index) (local.get $queued))
      (then
        (return
          (i32.atomic.load
            (i32.add (global.get $DI_MOUSE_INPUT_STATE)
              (i32.add (i32.const 16)
                (i32.shl
                  (i32.and (i32.add (local.get $head) (local.get $index)) (i32.const 63))
                  (i32.const 2))))))))
    (local.set $index (i32.sub (local.get $index) (local.get $queued)))
    (local.set $delta (i32.atomic.load offset=272 (global.get $DI_MOUSE_INPUT_STATE)))
    (if (local.get $delta)
      (then
        (if (i32.eqz (local.get $index))
          (then (return (i32.or (i32.const 0x50000000)
            (i32.and (local.get $delta) (i32.const 0x0FFFFFFF))))))
        (local.set $index (i32.sub (local.get $index) (i32.const 1)))))
    (local.set $delta (i32.atomic.load offset=276 (global.get $DI_MOUSE_INPUT_STATE)))
    (if (i32.and (local.get $delta) (i32.eqz (local.get $index)))
      (then (return (i32.or (i32.const 0x60000000)
        (i32.and (local.get $delta) (i32.const 0x0FFFFFFF))))))
    (i32.const 0))
  (func $di_mouse_event_take (result i32)
    (local $head i32) (local $event i32) (local $delta i32)
    (local.set $head (i32.atomic.load offset=8 (global.get $DI_MOUSE_INPUT_STATE)))
    (if (i32.ne (local.get $head)
                (i32.atomic.load offset=12 (global.get $DI_MOUSE_INPUT_STATE)))
      (then
        (local.set $event
          (i32.atomic.load
            (i32.add (global.get $DI_MOUSE_INPUT_STATE)
              (i32.add (i32.const 16)
                (i32.shl (i32.and (local.get $head) (i32.const 63)) (i32.const 2))))))
        (drop (i32.atomic.rmw.add offset=8 (global.get $DI_MOUSE_INPUT_STATE) (i32.const 1)))
        (return (local.get $event))))
    (local.set $delta
      (i32.atomic.rmw.xchg offset=272 (global.get $DI_MOUSE_INPUT_STATE) (i32.const 0)))
    (if (local.get $delta)
      (then (return (i32.or (i32.const 0x50000000)
        (i32.and (local.get $delta) (i32.const 0x0FFFFFFF))))))
    (local.set $delta
      (i32.atomic.rmw.xchg offset=276 (global.get $DI_MOUSE_INPUT_STATE) (i32.const 0)))
    (if (local.get $delta)
      (then (return (i32.or (i32.const 0x60000000)
        (i32.and (local.get $delta) (i32.const 0x0FFFFFFF))))))
    (i32.const 0))

  (global $di_mouse_last_x (mut i32) (i32.const 0))
  (global $di_mouse_last_y (mut i32) (i32.const 0))
  (global $di_mouse_initialized (mut i32) (i32.const 0))
  ;; DirectInput buffered mouse data tracking for GetDeviceData.
  (global $di_mouse_data_last_x (mut i32) (i32.const 0))
  (global $di_mouse_data_last_y (mut i32) (i32.const 0))
  (global $di_mouse_data_last_buttons (mut i32) (i32.const 0))
  (global $di_mouse_data_initialized (mut i32) (i32.const 0))
  (global $di_mouse_data_sequence (mut i32) (i32.const 0))
  ;; DirectInput buffered keyboard data for GetDeviceData. The last state
  ;; reported to the guest is a 256-bit map (one bit per DIK scancode) held in
  ;; eight globals, so buffered keys need no memory region of their own.
  ;; GetDeviceData diffs the live host key state against this map and reports
  ;; one DIDEVICEOBJECTDATA record per edge, which is how Allegro-based games
  ;; (Liquid War) learn about key presses — they never call GetDeviceState.
  (global $di_kbd_prev0 (mut i32) (i32.const 0))
  (global $di_kbd_prev1 (mut i32) (i32.const 0))
  (global $di_kbd_prev2 (mut i32) (i32.const 0))
  (global $di_kbd_prev3 (mut i32) (i32.const 0))
  (global $di_kbd_prev4 (mut i32) (i32.const 0))
  (global $di_kbd_prev5 (mut i32) (i32.const 0))
  (global $di_kbd_prev6 (mut i32) (i32.const 0))
  (global $di_kbd_prev7 (mut i32) (i32.const 0))
  (global $di_kbd_data_sequence (mut i32) (i32.const 0))

  ;; WASM address of the palette data for the primary surface (256 RGBQUAD entries)
  ;; Set by IDirectDrawSurface::SetPalette

  ;; DX_OBJECTS entry address of the primary surface created most recently.
  ;; An app that changes display mode mid-run creates a second primary without
  ;; always releasing the first: Liquid War opens a 16bpp primary, calls
  ;; SetDisplayMode(640,480,8), then creates the 8bpp primary it actually draws
  ;; its menu into. Both carry DDSCAPS_PRIMARYSURFACE, so a scan for "the
  ;; primary" finds the stale one and every palette-driven re-present pushes an
  ;; all-black 16bpp surface over the menu that was just flushed.
  (global $dx_primary_wa (mut i32) (i32.const 0))
  ;; Hold the last complete scanout while a 640x480x8 primary contains
  ;; Heroes II's temporary 447-pixel-wide scroll composition.
  (global $dx_scroll_hold_wa (mut i32) (i32.const 0))

  ;; EnumDisplayModes keeps invocation state on its callback stack.
  (global $enum_modes_thunk (mut i32) (i32.const 0))     ;; CACA0008 thunk guest addr

  ;; Only immutable callback entry addresses are global. Invocation state is
  ;; owned by the hidden record pointer on each guest callback stack.
  (global $d3d_enum_zbuf_thunk    (mut i32) (i32.const 0)) ;; CACA000D thunk guest addr
  (global $d3d_enum_tex_thunk    (mut i32) (i32.const 0)) ;; CACA000F thunk guest addr

  ;; ── Helper: allocate a DX object ─────────────────────────────
  ;; Returns WASM addr of entry, or 0 if full
  ;; Serialised: the scan below finds a free slot and only then claims it, so two
  ;; threads creating COM objects at the same instant would both take the same
  ;; one and the second would silently inherit the first's object. The critical
  ;; section is pure table arithmetic with no host import in it, which is what
  ;; makes a spinlock safe here — see the rules on $lock_acquire.
  (func $dx_alloc (param $type i32) (result i32)
    (local $r i32)
    (call $lock_acquire (global.get $LOCK_DX))
    (local.set $r (call $dx_alloc_locked (local.get $type)))
    (call $lock_release (global.get $LOCK_DX))
    ;; Kind 21 publishes object allocation to the host-side live-surface
    ;; index. Keep the import outside LOCK_DX: a real Worker import is an RPC
    ;; and no thread may park while holding this spinlock.
    (if (i32.and
          (i32.ne (local.get $r) (i32.const 0))
          (i32.eq (local.get $type) (i32.const 2))) ;; DDSurface only
      (then (call $host_dx_trace
        (i32.const 21)
        (i32.div_u (i32.sub (local.get $r) (global.get $DX_OBJECTS)) (i32.const 32))
        (local.get $type) (i32.const 0) (i32.const 0))))
    (local.get $r))

  (func $dx_alloc_locked (param $type i32) (result i32)
    (local $i i32) (local $ptr i32) (local $wrapper_wa i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DX_MAX)))
      (local.set $ptr (i32.add (global.get $DX_OBJECTS)
        (i32.mul (local.get $i) (i32.const 32))))
      ;; Slot must be free (type==0) AND have no live COM wrapper (we never
      ;; reuse a slot whose wrapper was ever handed to the guest, to avoid
      ;; ABA bugs — some DX APIs AddRef refs we don't track, so dangling
      ;; guest pointers can outlive our refcount).
      (local.set $wrapper_wa (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.and (i32.eqz (i32.load (local.get $ptr)))
                   (i32.eqz (i32.load (local.get $wrapper_wa))))
        (then
          (call $zero_memory (local.get $ptr) (i32.const 32))
          (i32.store (local.get $ptr) (local.get $type))
          (i32.store (i32.add (local.get $ptr) (i32.const 4)) (i32.const 1)) ;; refcount=1
          (return (local.get $ptr))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    ;; No never-used slot left. Retiring a slot forever is only affordable
    ;; while an app's *lifetime* object count stays under DX_MAX; one that
    ;; tears DirectDraw down and re-initialises burns through the table.
    ;; RollerCoaster Tycoon creates ~250 DirectSound buffers per attempt and
    ;; exhausted all 1024 slots on its third pass -- CreateSurface then
    ;; returned 0, the app's own teardown dereferenced the surface pointer it
    ;; had never been given, and the run died at EIP 0.
    ;;
    ;; So recycle logically-freed slots (refcount reached 0, type cleared)
    ;; rather than failing. A guest pointer the app kept past its own Release
    ;; can alias the new object, which is exactly the ABA case the retire rule
    ;; avoids -- but this tier is reached only where the alternative is a hard
    ;; failure, so every app that fits in DX_MAX behaves as before. Sweeping
    ;; from a rotating cursor hands back the least-recently-freed slot first,
    ;; giving a stale pointer the longest grace period we can offer.
    (local.set $i (i32.const 0))
    (block $recycled (loop $rescan
      (br_if $recycled (i32.ge_u (local.get $i) (global.get $DX_MAX)))
      (local.set $ptr (i32.add (global.get $DX_OBJECTS)
        (i32.mul (global.get $dx_recycle_cursor) (i32.const 32))))
      (local.set $wrapper_wa (i32.add (global.get $COM_WRAPPERS)
        (i32.mul (global.get $dx_recycle_cursor) (i32.const 8))))
      (global.set $dx_recycle_cursor
        (i32.rem_u (i32.add (global.get $dx_recycle_cursor) (i32.const 1))
                   (global.get $DX_MAX)))
      (if (i32.eqz (i32.load (local.get $ptr)))
        (then
          (call $zero_memory (local.get $ptr) (i32.const 32))
          (i32.store (local.get $ptr) (local.get $type))
          (i32.store (i32.add (local.get $ptr) (i32.const 4)) (i32.const 1)) ;; refcount=1
          ;; Drop the stale wrapper so the vtable $dx_create_com_obj writes
          ;; next is the only one this slot advertises.
          (i32.store (local.get $wrapper_wa) (i32.const 0))
          (i32.store (i32.add (local.get $wrapper_wa) (i32.const 4)) (i32.const 0))
          (return (local.get $ptr))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $rescan)))
    (i32.const 0))

  ;; ── Helper: find DX object by guest ptr ──────────────────────
  ;; The guest ptr IS the DX_OBJECTS WASM addr (objects live below GUEST_BASE
  ;; so guest addresses equal WASM addresses in our flat model).
  ;; Wait — objects are below GUEST_BASE, so they don't have a guest address.
  ;; We need to give the guest a *guest-space* pointer. Let's use heap_alloc
  ;; for the COM object wrapper (just [lpVtbl] at offset 0) and store the
  ;; DX_OBJECTS slot index at wrapper+4 (or in the DX_OBJECTS entry itself).
  ;;
  ;; Actually simpler: the "guest object" is a tiny heap block:
  ;;   +0: lpVtbl (guest addr of vtable)
  ;;   +4: dx_slot (index 0..31 into DX_OBJECTS)
  ;; When the guest calls a COM method, "this" is arg0 on the stack.
  ;; We read dx_slot from this+4 to find the DX_OBJECTS entry.

  ;; Look up DX_OBJECTS entry from guest "this" pointer
  (func $dx_from_this (param $this_guest i32) (result i32)
    (local $wa i32) (local $slot i32)
    (local.set $wa (call $g2w (local.get $this_guest)))
    (local.set $slot (i32.load (i32.add (local.get $wa) (i32.const 4))))
    ;; Sanity: if slot is wild, log this+slot and clamp to 0 to avoid OOB trap.
    (if (i32.ge_u (local.get $slot) (global.get $DX_MAX)) (then
      (call $host_log_i32 (i32.const 0xDEADC0DE))
      (call $host_log_i32 (local.get $this_guest))
      (call $host_log_i32 (local.get $slot))
      (local.set $slot (i32.const 0))))
    (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $slot) (i32.const 32))))

  ;; Compute slot index from a DX_OBJECTS entry WASM address.
  (func $dx_slot_of (param $entry_wa i32) (result i32)
    (i32.div_u (i32.sub (local.get $entry_wa) (global.get $DX_OBJECTS)) (i32.const 32)))

  (func $dx_surf_state_ptr (param $entry_wa i32) (result i32)
    (i32.add (global.get $DX_SURF_STATE)
      (i32.shl (call $dx_slot_of (local.get $entry_wa)) (i32.const 5))))

  (func $dx_surf_fmt_ptr (param $entry_wa i32) (result i32)
    (i32.add (global.get $DX_SURF_FMT)
      (i32.shl (call $dx_slot_of (local.get $entry_wa)) (i32.const 2))))

  ;; Per-surface creation metadata, 16 bytes a slot:
  ;;   +0 creation caps +4 parent slot+1 +8 billed vidmem bytes
  ;;   +12 owned VB drawing-state guest heap pointer (0 until needed).
  (func $dx_surf_meta_ptr (param $entry_wa i32) (result i32)
    (i32.add (global.get $DX_SURF_META)
      (i32.shl (call $dx_slot_of (local.get $entry_wa)) (i32.const 4))))

  ;; What this surface added to $dx_vidmem_used when it was created, and so
  ;; exactly what its release must give back. Kept out of the DxObject record
  ;; because every spare field there is a per-type union with a different
  ;; lifetime, and the one this used to share (misc2) is rewritten by
  ;; SetColorKey while the surface is alive.
  (func $dx_surf_billed_set (param $entry_wa i32) (param $bytes i32)
    (if (local.get $entry_wa)
      (then (i32.store offset=8 (call $dx_surf_meta_ptr (local.get $entry_wa))
              (local.get $bytes)))))

  (func $dx_surf_billed_get (param $entry_wa i32) (result i32)
    (if (i32.eqz (local.get $entry_wa)) (then (return (i32.const 0))))
    (i32.load offset=8 (call $dx_surf_meta_ptr (local.get $entry_wa))))

  (func $dx_surf_owner_ptr (param $entry_wa i32) (result i32)
    (i32.add (global.get $DX_SURF_OWNER)
      (i32.shl (call $dx_slot_of (local.get $entry_wa)) (i32.const 2))))

  (func $dx_surf_fmt_default (param $bpp i32) (result i32)
    (if (i32.eq (local.get $bpp) (i32.const 16)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $bpp) (i32.const 32)) (then (return (i32.const 6))))
    (i32.const 0))

  (func $dx_surf_fmt_get (param $entry_wa i32) (result i32)
    (local $fmt i32)
    (if (i32.eqz (local.get $entry_wa)) (then (return (i32.const 0))))
    (local.set $fmt (i32.load (call $dx_surf_fmt_ptr (local.get $entry_wa))))
    (if (local.get $fmt) (then (return (local.get $fmt))))
    (call $dx_surf_fmt_default (i32.load16_u offset=16 (local.get $entry_wa))))

  (func $dx_surf_fmt_set (param $entry_wa i32) (param $fmt i32)
    (if (local.get $entry_wa)
      (then (i32.store (call $dx_surf_fmt_ptr (local.get $entry_wa)) (local.get $fmt)))))

  ;; S3TC block-compressed surfaces (DDPF_FOURCC "DXT1".."DXT5"), stored as
  ;; format kinds 7..11 (FourCC 0x31545844 + (kind - 7) << 24). Their bytes are
  ;; a linear run of 4x4 blocks, 8 bytes each for DXT1 and 16 for the rest;
  ;; the DIB is allocated at 16bpp, which always holds that. Real DirectDraw
  ;; decompresses on Blt to an uncompressed surface -- Colin McRae Rally 2.0
  ;; loads every texture as a DXT5 staging surface and Blts it into ARGB4444.
  (func $dx_fmt_is_dxt (param $fmt i32) (result i32)
    (i32.and (i32.ge_u (local.get $fmt) (i32.const 7))
             (i32.le_u (local.get $fmt) (i32.const 11))))

  (func $dx_dxt_linear_size (param $fmt i32) (param $w i32) (param $h i32) (result i32)
    (i32.mul
      (i32.mul (i32.shr_u (i32.add (select (local.get $w) (i32.const 1) (local.get $w)) (i32.const 3)) (i32.const 2))
               (i32.shr_u (i32.add (select (local.get $h) (i32.const 1) (local.get $h)) (i32.const 3)) (i32.const 2)))
      (select (i32.const 8) (i32.const 16) (i32.eq (local.get $fmt) (i32.const 7)))))

  ;; Rewrite a DDSURFACEDESC that $dx_fill_surface_desc/Lock filled for a DXT
  ;; surface: DDSD_LINEARSIZE instead of DDSD_PITCH, and a FOURCC pixel format.
  (func $dx_dxt_fix_desc (param $wa i32) (param $entry i32)
    (local $fmt i32)
    (local.set $fmt (call $dx_surf_fmt_get (local.get $entry)))
    (if (i32.eqz (call $dx_fmt_is_dxt (local.get $fmt))) (then (return)))
    (i32.store offset=4 (local.get $wa)
      (i32.or (i32.and (i32.load offset=4 (local.get $wa)) (i32.const 0xFFFFFFF7))
              (i32.const 0x80000))) ;; -DDSD_PITCH +DDSD_LINEARSIZE
    (i32.store offset=16 (local.get $wa)
      (call $dx_dxt_linear_size (local.get $fmt)
        (load.field.memarg DxObject width (local.get $entry))
        (load.field.memarg DxObject height (local.get $entry))))
    (call $zero_memory (i32.add (local.get $wa) (i32.const 76)) (i32.const 28))
    (i32.store offset=76 (local.get $wa) (i32.const 4)) ;; DDPF_FOURCC
    (i32.store offset=80 (local.get $wa)
      (i32.add (i32.const 0x31545844)
        (i32.shl (i32.sub (local.get $fmt) (i32.const 7)) (i32.const 24)))))

  ;; RGB565 -> 0x00RRGGBB
  (func $dx_dxt_565 (param $c i32) (result i32)
    (local $r i32) (local $g i32) (local $b i32)
    (local.set $r (i32.and (i32.shr_u (local.get $c) (i32.const 11)) (i32.const 31)))
    (local.set $g (i32.and (i32.shr_u (local.get $c) (i32.const 5)) (i32.const 63)))
    (local.set $b (i32.and (local.get $c) (i32.const 31)))
    (i32.or
      (i32.shl (i32.or (i32.shl (local.get $r) (i32.const 3)) (i32.shr_u (local.get $r) (i32.const 2))) (i32.const 16))
      (i32.or
        (i32.shl (i32.or (i32.shl (local.get $g) (i32.const 2)) (i32.shr_u (local.get $g) (i32.const 4))) (i32.const 8))
        (i32.or (i32.shl (local.get $b) (i32.const 3)) (i32.shr_u (local.get $b) (i32.const 2))))))

  ;; Per-channel (a*wa + b*wb) / div over 0x00RRGGBB.
  (func $dx_dxt_mix (param $a i32) (param $b i32) (param $wa i32) (param $wb i32) (param $div i32) (result i32)
    (local $i i32) (local $out i32) (local $sh i32)
    (block $done (loop $ch
      (br_if $done (i32.ge_u (local.get $i) (i32.const 3)))
      (local.set $sh (i32.shl (local.get $i) (i32.const 3)))
      (local.set $out (i32.or (local.get $out)
        (i32.shl
          (i32.div_u
            (i32.add
              (i32.mul (i32.and (i32.shr_u (local.get $a) (local.get $sh)) (i32.const 255)) (local.get $wa))
              (i32.mul (i32.and (i32.shr_u (local.get $b) (local.get $sh)) (i32.const 255)) (local.get $wb)))
            (local.get $div))
          (local.get $sh))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $ch)))
    (local.get $out))

  ;; Decode the whole DXT surface $src_entry into $dst_wa (pitch $dst_pitch),
  ;; packing each texel in the pixel format of $dst_entry ($dst_bpp 16 or 32).
  (func $dx_dxt_decode_to
      (param $src_entry i32) (param $dst_entry i32) (param $dst_wa i32)
      (param $dst_pitch i32) (param $dst_bpp i32)
    (local $fmt i32) (local $w i32) (local $h i32) (local $bw i32) (local $bh i32)
    (local $bx i32) (local $by i32) (local $blk i32) (local $cblk i32) (local $bytes i32)
    (local $c0 i32) (local $c1 i32) (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $p3 i32)
    (local $idx i32) (local $abits i64) (local $a0 i32) (local $a1 i32)
    (local $i i32) (local $px i32) (local $py i32) (local $rgb i32) (local $alpha i32)
    (local $code i32) (local $argb i32) (local $out i32) (local $four i32)
    (local.set $fmt (call $dx_surf_fmt_get (local.get $src_entry)))
    (local.set $w (load.field DxObject width (local.get $src_entry)))
    (local.set $h (load.field DxObject height (local.get $src_entry)))
    (local.set $bw (i32.shr_u (i32.add (local.get $w) (i32.const 3)) (i32.const 2)))
    (local.set $bh (i32.shr_u (i32.add (local.get $h) (i32.const 3)) (i32.const 2)))
    (local.set $bytes (select (i32.const 8) (i32.const 16) (i32.eq (local.get $fmt) (i32.const 7))))
    (local.set $blk (load.field DxObject misc1 (local.get $src_entry)))
    (local.set $by (i32.const 0))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_u (local.get $by) (local.get $bh)))
      (local.set $bx (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_u (local.get $bx) (local.get $bw)))
        ;; Colour half: the whole block for DXT1, the second 8 bytes otherwise.
        (local.set $cblk (i32.add (local.get $blk)
          (select (i32.const 0) (i32.const 8) (i32.eq (local.get $fmt) (i32.const 7)))))
        (local.set $c0 (i32.load16_u (local.get $cblk)))
        (local.set $c1 (i32.load16_u offset=2 (local.get $cblk)))
        (local.set $idx (i32.load offset=4 (local.get $cblk)))
        (local.set $p0 (call $dx_dxt_565 (local.get $c0)))
        (local.set $p1 (call $dx_dxt_565 (local.get $c1)))
        ;; DXT1 with c0 <= c1 is the 3-colour mode whose fourth entry is
        ;; transparent black; every other case interpolates two thirds.
        (local.set $four (i32.or (i32.ne (local.get $fmt) (i32.const 7))
                                 (i32.gt_u (local.get $c0) (local.get $c1))))
        (if (local.get $four)
          (then
            (local.set $p2 (call $dx_dxt_mix (local.get $p0) (local.get $p1) (i32.const 2) (i32.const 1) (i32.const 3)))
            (local.set $p3 (call $dx_dxt_mix (local.get $p0) (local.get $p1) (i32.const 1) (i32.const 2) (i32.const 3))))
          (else
            (local.set $p2 (call $dx_dxt_mix (local.get $p0) (local.get $p1) (i32.const 1) (i32.const 1) (i32.const 2)))
            (local.set $p3 (i32.const 0))))
        (if (i32.ge_u (local.get $fmt) (i32.const 10)) (then
          (local.set $a0 (i32.load8_u (local.get $blk)))
          (local.set $a1 (i32.load8_u offset=1 (local.get $blk)))
          (local.set $abits (i64.shr_u (i64.load (local.get $blk)) (i64.const 16)))))
        (if (i32.or (i32.eq (local.get $fmt) (i32.const 8)) (i32.eq (local.get $fmt) (i32.const 9)))
          (then (local.set $abits (i64.load (local.get $blk)))))
        (local.set $i (i32.const 0))
        (block $px_done (loop $pixels
          (br_if $px_done (i32.ge_u (local.get $i) (i32.const 16)))
          (local.set $px (i32.add (i32.shl (local.get $bx) (i32.const 2)) (i32.and (local.get $i) (i32.const 3))))
          (local.set $py (i32.add (i32.shl (local.get $by) (i32.const 2)) (i32.shr_u (local.get $i) (i32.const 2))))
          (if (i32.and (i32.lt_u (local.get $px) (local.get $w)) (i32.lt_u (local.get $py) (local.get $h))) (then
            (local.set $code (i32.and (i32.shr_u (local.get $idx) (i32.shl (local.get $i) (i32.const 1))) (i32.const 3)))
            (local.set $rgb (select (local.get $p0) (local.get $p1) (i32.eqz (local.get $code))))
            (if (i32.eq (local.get $code) (i32.const 2)) (then (local.set $rgb (local.get $p2))))
            (if (i32.eq (local.get $code) (i32.const 3)) (then (local.set $rgb (local.get $p3))))
            (local.set $alpha (i32.const 255))
            (if (i32.eq (local.get $fmt) (i32.const 7)) (then
              (if (i32.and (i32.eqz (local.get $four)) (i32.eq (local.get $code) (i32.const 3)))
                (then (local.set $alpha (i32.const 0))))))
            (if (i32.or (i32.eq (local.get $fmt) (i32.const 8)) (i32.eq (local.get $fmt) (i32.const 9))) (then
              (local.set $alpha (i32.mul (i32.const 17)
                (i32.wrap_i64 (i64.and
                  (i64.shr_u (local.get $abits) (i64.extend_i32_u (i32.shl (local.get $i) (i32.const 2))))
                  (i64.const 15)))))))
            (if (i32.ge_u (local.get $fmt) (i32.const 10)) (then
              (local.set $code (i32.wrap_i64 (i64.and
                (i64.shr_u (local.get $abits) (i64.extend_i32_u (i32.mul (local.get $i) (i32.const 3))))
                (i64.const 7))))
              (local.set $alpha
                (if (result i32) (i32.eqz (local.get $code))
                  (then (local.get $a0))
                  (else (if (result i32) (i32.eq (local.get $code) (i32.const 1))
                    (then (local.get $a1))
                    (else (if (result i32) (i32.gt_u (local.get $a0) (local.get $a1))
                      (then (i32.div_u
                        (i32.add (i32.mul (i32.sub (i32.const 8) (local.get $code)) (local.get $a0))
                                 (i32.mul (i32.sub (local.get $code) (i32.const 1)) (local.get $a1)))
                        (i32.const 7)))
                      (else (if (result i32) (i32.eq (local.get $code) (i32.const 6))
                        (then (i32.const 0))
                        (else (if (result i32) (i32.eq (local.get $code) (i32.const 7))
                          (then (i32.const 255))
                          (else (i32.div_u
                            (i32.add (i32.mul (i32.sub (i32.const 6) (local.get $code)) (local.get $a0))
                                     (i32.mul (i32.sub (local.get $code) (i32.const 1)) (local.get $a1)))
                            (i32.const 5)))))))))))))))
            (local.set $argb (i32.or (i32.shl (local.get $alpha) (i32.const 24)) (local.get $rgb)))
            (local.set $out (i32.add (local.get $dst_wa)
              (i32.add (i32.mul (local.get $py) (local.get $dst_pitch))
                       (i32.mul (local.get $px) (i32.shr_u (local.get $dst_bpp) (i32.const 3))))))
            (if (i32.eq (local.get $dst_bpp) (i32.const 32))
              (then (i32.store (local.get $out)
                (call $d3dim_encode_surface_pixel (local.get $dst_entry) (local.get $argb) (i32.const 32))))
              (else (i32.store16 (local.get $out)
                (call $d3dim_encode_surface_pixel (local.get $dst_entry) (local.get $argb) (i32.const 16)))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $pixels)))
        (local.set $blk (i32.add (local.get $blk) (local.get $bytes)))
        (local.set $bx (i32.add (local.get $bx) (i32.const 1)))
        (br $cols)))
      (local.set $by (i32.add (local.get $by) (i32.const 1)))
      (br $rows))))

  ;; One scratch DIB, grown on demand, that a Blt from a DXT source decodes
  ;; into before the ordinary copy path runs over it (WASM address).
  (global $dx_dxt_scratch (mut i32) (i32.const 0))
  (global $dx_dxt_scratch_size (mut i32) (i32.const 0))
  (func $dx_dxt_scratch_get (param $bytes i32) (result i32)
    (local $guest i32)
    (if (i32.gt_u (local.get $bytes) (global.get $dx_dxt_scratch_size)) (then
      (if (global.get $dx_dxt_scratch)
        (then (call $dib_free_wasm (global.get $dx_dxt_scratch))))
      (local.set $guest (call $dib_alloc (local.get $bytes)))
      (if (i32.eqz (local.get $guest)) (then
        (global.set $dx_dxt_scratch (i32.const 0))
        (global.set $dx_dxt_scratch_size (i32.const 0))
        (return (i32.const 0))))
      (global.set $dx_dxt_scratch (call $g2w (local.get $guest)))
      (global.set $dx_dxt_scratch_size (local.get $bytes))))
    (global.get $dx_dxt_scratch))

  ;; Normalize a DDPIXELFORMAT already mapped into WASM memory. Unknown masks
  ;; deliberately fall back to the native display layout rather than being
  ;; guessed from their texel contents.
  (func $dx_surf_fmt_from_ddpf (param $pf_wa i32) (param $bpp i32) (result i32)
    (local $r i32) (local $g i32) (local $b i32) (local $a i32) (local $fourcc i32)
    (if (i32.eqz (local.get $pf_wa))
      (then (return (call $dx_surf_fmt_default (local.get $bpp)))))
    ;; DDPF_FOURCC: S3TC "DXT1".."DXT5" become kinds 7..11 (see $dx_fmt_is_dxt).
    (if (i32.and (i32.load offset=4 (local.get $pf_wa)) (i32.const 4)) (then
      (local.set $fourcc (i32.load offset=8 (local.get $pf_wa)))
      ;; "DXTn" little-endian: the digit is the high byte.
      (if (i32.and
            (i32.eq (i32.and (local.get $fourcc) (i32.const 0x00FFFFFF)) (i32.const 0x00545844))
            (i32.and (i32.ge_u (local.get $fourcc) (i32.const 0x31545844))
                     (i32.le_u (local.get $fourcc) (i32.const 0x35545844))))
        (then (return (i32.add (i32.const 7)
          (i32.shr_u (i32.sub (local.get $fourcc) (i32.const 0x31545844)) (i32.const 24))))))))
    (local.set $r (i32.load offset=16 (local.get $pf_wa)))
    (local.set $g (i32.load offset=20 (local.get $pf_wa)))
    (local.set $b (i32.load offset=24 (local.get $pf_wa)))
    (local.set $a (i32.load offset=28 (local.get $pf_wa)))
    (if (i32.eq (local.get $bpp) (i32.const 16)) (then
      (if (i32.and
            (i32.eq (local.get $r) (i32.const 0xF800))
            (i32.and (i32.eq (local.get $g) (i32.const 0x07E0))
                     (i32.eq (local.get $b) (i32.const 0x001F))))
        (then (return (i32.const 1))))
      (if (i32.and
            (i32.eq (local.get $r) (i32.const 0x7C00))
            (i32.and (i32.eq (local.get $g) (i32.const 0x03E0))
                     (i32.eq (local.get $b) (i32.const 0x001F))))
        (then
          (if (i32.eq (local.get $a) (i32.const 0x8000))
            (then (return (i32.const 3))))
          (return (i32.const 2))))
      (if (i32.and
            (i32.eq (local.get $r) (i32.const 0x0F00))
            (i32.and
              (i32.eq (local.get $g) (i32.const 0x00F0))
              (i32.and (i32.eq (local.get $b) (i32.const 0x000F))
                       (i32.eq (local.get $a) (i32.const 0xF000)))))
        (then (return (i32.const 4))))))
    (if (i32.eq (local.get $bpp) (i32.const 32)) (then
      (if (i32.eq (local.get $a) (i32.const 0xFF000000))
        (then (return (i32.const 5))))
      (return (i32.const 6))))
    (call $dx_surf_fmt_default (local.get $bpp)))

  (func $dx_cursor_state_ptr (param $entry_wa i32) (result i32)
    (i32.add (global.get $DX_CURSOR_SAVE)
      (i32.shl (call $dx_slot_of (local.get $entry_wa)) (i32.const 3))))

  (func $dx_surface_clipper_ptr (param $entry_wa i32) (result i32)
    (i32.add (call $dx_cursor_state_ptr (local.get $entry_wa)) (i32.const 4)))

  (func $dx_surface_clipper_get (param $entry_wa i32) (result i32)
    (i32.load (call $dx_surface_clipper_ptr (local.get $entry_wa))))

  ;; Type-10 (IDirectDrawClipper) uses its otherwise-free union arm as:
  ;;   +8  associated HWND, or zero for an explicit clip list
  ;;   +12/+16/+20/+24 last observed HWND client RECT in screen coordinates
  ;;   +20 explicit RGNDATA guest pointer when +8 is zero
  ;;   +24 explicit RGNDATA byte size when +8 is zero
  ;;   +28 bit 0 = HWND snapshot valid, bit 1 = snapshot changed
  ;; Explicit lists are canonical private copies, so the application can free
  ;; or mutate its input immediately after SetClipList returns.
  (func $dx_clipper_release_explicit (param $entry_wa i32)
    (local $list i32)
    (if (i32.eqz (local.get $entry_wa)) (then (return)))
    (if (i32.ne (load.field DxObject misc0 (local.get $entry_wa)) (i32.const 0))
      (then (return)))
    (local.set $list (load.field DxObject misc1 (local.get $entry_wa)))
    (if (local.get $list) (then (call $heap_free (local.get $list))))
    (store.field DxObject misc1 (local.get $entry_wa) (i32.const 0))
    (store.field DxObject misc2 (local.get $entry_wa) (i32.const 0)))

  ;; Refresh the single rectangular client-region approximation used by the
  ;; browser compositor. Occluding sibling windows are clipped by composition;
  ;; DirectDraw still observes movement/resizing through IsClipListChanged and
  ;; GetClipList in the same screen-coordinate space as Win98 primary surfaces.
  (func $dx_clipper_refresh_hwnd (param $entry_wa i32)
    (local $hwnd i32) (local $l i32) (local $t i32)
    (local $r i32) (local $b i32) (local $flags i32)
    (local.set $hwnd (load.field DxObject misc0 (local.get $entry_wa)))
    (if (i32.eqz (local.get $hwnd)) (then (return)))
    (local.set $l (call $wnd_client_screen_x (local.get $hwnd)))
    (local.set $t (call $wnd_client_screen_y (local.get $hwnd)))
    (if (call $wnd_is_effectively_visible (local.get $hwnd))
      (then
        (local.set $r (i32.add (local.get $l)
          (call $wnd_client_w_for_clip (local.get $hwnd))))
        (local.set $b (i32.add (local.get $t)
          (call $wnd_client_h_for_clip (local.get $hwnd)))))
      (else
        (local.set $r (local.get $l))
        (local.set $b (local.get $t))))
    (local.set $flags (load.field DxObject flags (local.get $entry_wa)))
    (if (i32.and (local.get $flags) (i32.const 1))
      (then
        (if (i32.or
              (i32.or
                (i32.ne (i32.load offset=12 (local.get $entry_wa)) (local.get $l))
                (i32.ne (i32.load offset=16 (local.get $entry_wa)) (local.get $t)))
              (i32.or
                (i32.ne (load.field DxObject misc1 (local.get $entry_wa)) (local.get $r))
                (i32.ne (load.field DxObject misc2 (local.get $entry_wa)) (local.get $b))))
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 2)))))))
    (i32.store offset=12 (local.get $entry_wa) (local.get $l))
    (i32.store offset=16 (local.get $entry_wa) (local.get $t))
    (store.field DxObject misc1 (local.get $entry_wa) (local.get $r))
    (store.field DxObject misc2 (local.get $entry_wa) (local.get $b))
    (store.field DxObject flags (local.get $entry_wa)
      (i32.or (local.get $flags) (i32.const 1))))

  ;; Test one destination point against a prepared clipper. For an explicit
  ;; list, data_wa is the translated canonical RGNDATA copy. HWND-backed lists
  ;; use the cached client RECT and never enter this loop on the ordinary Blt
  ;; path: the compositor already clips that common path at window granularity.
  (func $dx_clipper_contains (param $entry_wa i32) (param $data_wa i32)
      (param $x i32) (param $y i32) (result i32)
    (local $i i32) (local $count i32) (local $rect i32)
    (if (i32.eqz (local.get $entry_wa)) (then (return (i32.const 1))))
    (if (load.field DxObject misc0 (local.get $entry_wa))
      (then
        (return
          (i32.and
            (i32.and
              (i32.ge_s (local.get $x) (i32.load offset=12 (local.get $entry_wa)))
              (i32.ge_s (local.get $y) (i32.load offset=16 (local.get $entry_wa))))
            (i32.and
              (i32.lt_s (local.get $x) (load.field DxObject misc1 (local.get $entry_wa)))
              (i32.lt_s (local.get $y) (load.field DxObject misc2 (local.get $entry_wa))))))))
    (if (i32.eqz (local.get $data_wa)) (then (return (i32.const 1))))
    (local.set $count (i32.load offset=8 (local.get $data_wa)))
    (block $miss (loop $scan
      (br_if $miss (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rect (i32.add (local.get $data_wa)
        (i32.add (i32.const 32) (i32.shl (local.get $i) (i32.const 4)))))
      (if (i32.and
            (i32.and
              (i32.ge_s (local.get $x) (i32.load (local.get $rect)))
              (i32.ge_s (local.get $y) (i32.load offset=4 (local.get $rect))))
            (i32.and
              (i32.lt_s (local.get $x) (i32.load offset=8 (local.get $rect)))
              (i32.lt_s (local.get $y) (i32.load offset=12 (local.get $rect)))))
        (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; A windowed primary presents to the clipper's associated HWND. Fall back
  ;; to the cooperative-level target for old applications that never attach a
  ;; clipper, and for clippers that have not yet received SetHWnd.
  (func $dx_surface_target_hwnd (param $entry_wa i32) (result i32)
    (local $clipper i32) (local $clip_entry i32) (local $hwnd i32)
    (local.set $clipper (call $dx_surface_clipper_get (local.get $entry_wa)))
    (if (local.get $clipper)
      (then
        (local.set $clip_entry (call $dx_from_this (local.get $clipper)))
        (if (i32.eq (load.field DxObject type (local.get $clip_entry)) (i32.const 10))
          (then
            (local.set $hwnd (load.field DxObject misc0 (local.get $clip_entry)))
            (if (local.get $hwnd) (then (return (local.get $hwnd))))))))
    (call $dx_target_hwnd))

  (func $dx_cursor_reset (param $entry_wa i32)
    (local $state i32) (local $saved i32)
    (if (i32.eqz (local.get $entry_wa)) (then (return)))
    (local.set $state (call $dx_cursor_state_ptr (local.get $entry_wa)))
    (local.set $saved (i32.load (local.get $state)))
    (if (i32.gt_u (local.get $saved) (i32.const 1))
      (then (call $dib_free_wasm (local.get $saved))))
    (i64.store (local.get $state) (i64.const 0)))

  ;; The exact full-surface null-source WAIT marker used by MCM begins a new
  ;; overlay frame. The first marker arms cursor tracking; later markers put
  ;; back the 32x32 background saved immediately before the prior cursor draw.
  (func $dx_cursor_restore_or_arm (param $entry_wa i32)
    (local $state i32) (local $record i32) (local $saved i32) (local $dib i32)
    (local $pitch i32) (local $xy i32) (local $x i32) (local $y i32) (local $row i32)
    (local.set $state (call $dx_cursor_state_ptr (local.get $entry_wa)))
    (local.set $record (i32.load (local.get $state)))
    (if (i32.eqz (local.get $record))
      (then (i32.store (local.get $state) (i32.const 1)) (return)))
    (if (i32.eq (local.get $record) (i32.const 1)) (then (return)))
    (local.set $dib (i32.load offset=20 (local.get $entry_wa)))
    (local.set $pitch (i32.load16_u offset=18 (local.get $entry_wa)))
    (if (i32.eq (i32.load (local.get $record)) (local.get $dib))
      (then
        (local.set $xy (i32.load offset=4 (local.get $record)))
        (local.set $saved (i32.add (local.get $record) (i32.const 64))))
      (else
        (if (i32.eq (i32.load offset=8 (local.get $record)) (local.get $dib))
          (then
            (local.set $xy (i32.load offset=12 (local.get $record)))
            (local.set $saved (i32.add (local.get $record) (i32.const 2112))))
          (else (return)))))
    (local.set $x (i32.and (local.get $xy) (i32.const 0xFFFF)))
    (local.set $y (i32.shr_u (local.get $xy) (i32.const 16)))
    (block $done (loop $rows
      (br_if $done (i32.ge_u (local.get $row) (i32.const 32)))
      (call $memcpy
        (i32.add (local.get $dib)
          (i32.add (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $pitch))
                   (i32.shl (local.get $x) (i32.const 1))))
        (i32.add (local.get $saved) (i32.shl (local.get $row) (i32.const 6)))
        (i32.const 64))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rows))))

  ;; Save the pixels beneath the next keyed 32x32 cursor. This remains dormant
  ;; unless the destination first used MCM's legacy frame marker, so ordinary
  ;; 32x32 keyed sprites in other games are unchanged.
  (func $dx_cursor_save_background (param $entry_wa i32) (param $x i32) (param $y i32)
    (local $state i32) (local $record i32) (local $saved i32) (local $guest i32)
    (local $dib i32) (local $pitch i32) (local $xy_ptr i32) (local $row i32)
    (local.set $state (call $dx_cursor_state_ptr (local.get $entry_wa)))
    (local.set $record (i32.load (local.get $state)))
    (if (i32.eqz (local.get $record)) (then (return)))
    (if (i32.or
          (i32.gt_u (i32.add (local.get $x) (i32.const 32))
                    (i32.load16_u offset=12 (local.get $entry_wa)))
          (i32.gt_u (i32.add (local.get $y) (i32.const 32))
                    (i32.load16_u offset=14 (local.get $entry_wa))))
      (then (return)))
    (if (i32.eq (local.get $record) (i32.const 1))
      (then
        (local.set $guest (call $dib_alloc (i32.const 4160)))
        (if (i32.eqz (local.get $guest)) (then (return)))
        (local.set $record (call $g2w (local.get $guest)))
        (i32.store (local.get $state) (local.get $record))))
    (local.set $dib (i32.load offset=20 (local.get $entry_wa)))
    (local.set $pitch (i32.load16_u offset=18 (local.get $entry_wa)))
    (if (i32.eq (i32.load (local.get $record)) (local.get $dib))
      (then
        (local.set $xy_ptr (i32.add (local.get $record) (i32.const 4)))
        (local.set $saved (i32.add (local.get $record) (i32.const 64))))
      (else
        (if (i32.eq (i32.load offset=8 (local.get $record)) (local.get $dib))
          (then
            (local.set $xy_ptr (i32.add (local.get $record) (i32.const 12)))
            (local.set $saved (i32.add (local.get $record) (i32.const 2112))))
          (else
            (if (i32.eqz (i32.load (local.get $record)))
              (then
                (i32.store (local.get $record) (local.get $dib))
                (local.set $xy_ptr (i32.add (local.get $record) (i32.const 4)))
                (local.set $saved (i32.add (local.get $record) (i32.const 64))))
              (else
                (if (i32.eqz (i32.load offset=8 (local.get $record)))
                  (then
                    (i32.store offset=8 (local.get $record) (local.get $dib))
                    (local.set $xy_ptr (i32.add (local.get $record) (i32.const 12)))
                    (local.set $saved (i32.add (local.get $record) (i32.const 2112))))
                  (else (return)))))))))
    (block $done (loop $rows
      (br_if $done (i32.ge_u (local.get $row) (i32.const 32)))
      (call $memcpy
        (i32.add (local.get $saved) (i32.shl (local.get $row) (i32.const 6)))
        (i32.add (local.get $dib)
          (i32.add (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $pitch))
                   (i32.shl (local.get $x) (i32.const 1))))
        (i32.const 64))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rows)))
    (i32.store (local.get $xy_ptr)
      (i32.or (i32.and (local.get $x) (i32.const 0xFFFF))
              (i32.shl (local.get $y) (i32.const 16)))))

  (func $dx_surf_state_reset (param $entry_wa i32)
    (if (local.get $entry_wa)
      (then
        (call $vbdd_draw_state_reset (local.get $entry_wa))
        (call $dx_cursor_reset (local.get $entry_wa))
        (call $zero_memory (call $dx_surf_state_ptr (local.get $entry_wa)) (i32.const 32))
        (call $dx_surf_fmt_set (local.get $entry_wa) (i32.const 0))
        (i32.store (call $dx_surf_owner_ptr (local.get $entry_wa)) (i32.const 0)))))

  ;; Notify backing-page observers without changing the cursor restore epoch.
  (func $dx_surf_note_write (param $entry_wa i32)
    (if (i32.eqz (local.get $entry_wa)) (then (return)))
    (call $page_watch_write (load.field DxObject misc1 (local.get $entry_wa))
      (i32.mul (load.field DxObject pitch (local.get $entry_wa))
        (load.field DxObject height (local.get $entry_wa)))))

  ;; A successful Unlock publishes whatever the caller wrote through Lock's
  ;; lpSurface. Advance only this CPU epoch: sprite Blts after a background
  ;; save are precisely the writes that the later restore is meant to undo.
  (func $dx_surf_note_cpu_write (param $entry_wa i32)
    (local $state i32)
    (if (i32.eqz (local.get $entry_wa)) (then (return)))
    (call $dx_surf_note_write (local.get $entry_wa))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry_wa)))
    (i32.store (local.get $state)
      (i32.add (i32.load (local.get $state)) (i32.const 1)))
    (i32.store offset=4 (local.get $state) (i32.const 0)))

  (func $dx_surf_clear_copy (param $entry_wa i32)
    (if (local.get $entry_wa)
      (then (i32.store offset=4 (call $dx_surf_state_ptr (local.get $entry_wa)) (i32.const 0)))))

  ;; Record only a cursor-sized unscaled plain copy into a smaller surface.
  ;; The scratch allocation itself can be larger than the copied cursor rect;
  ;; full 280x140 AoE UI restores must remain ordinary drawing operations.
  (func $dx_surf_note_copy
    (param $dst_entry i32) (param $src_entry i32)
    (param $dx i32) (param $dy i32) (param $sx i32) (param $sy i32)
    (param $w i32) (param $h i32) (param $flags i32)
    (local $state i32) (local $dst_area i32) (local $src_area i32)
    (call $dx_surf_clear_copy (local.get $dst_entry))
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h))) (then (return)))
    ;; Only DDBLT_WAIT (0x01000000), or no flags, is compatible with a raw
    ;; save. Color keys, ROPs and effects are normal drawing operations.
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0xFEFFFFFF)) (i32.const 0))
      (then (return)))
    (if (i32.ne
          (load.field.memarg DxObject bpp (local.get $dst_entry))
          (load.field.memarg DxObject bpp (local.get $src_entry)))
      (then (return)))
    (local.set $dst_area
      (i32.mul (load.field.memarg DxObject width (local.get $dst_entry))
               (load.field.memarg DxObject height (local.get $dst_entry))))
    (local.set $src_area
      (i32.mul (load.field.memarg DxObject width (local.get $src_entry))
               (load.field.memarg DxObject height (local.get $src_entry))))
    (if (i32.or (i32.ge_u (local.get $dst_area) (local.get $src_area)) (i32.or (i32.gt_u (local.get $w) (i32.const 64)) (i32.gt_u (local.get $h) (i32.const 64)))) (then (return)))
    (local.set $state (call $dx_surf_state_ptr (local.get $dst_entry)))
    (i32.store offset=4 (local.get $state)
      (i32.add (call $dx_slot_of (local.get $src_entry)) (i32.const 1)))
    (i32.store offset=8 (local.get $state)
      (i32.load (call $dx_surf_state_ptr (local.get $src_entry))))
    (i32.store offset=12 (local.get $state) (local.get $sx))
    (i32.store offset=16 (local.get $state) (local.get $sy))
    (i32.store offset=20 (local.get $state) (local.get $dx))
    (i32.store offset=24 (local.get $state) (local.get $dy))
    (i32.store offset=28 (local.get $state)
      (i32.or (i32.and (local.get $w) (i32.const 0xFFFF))
              (i32.shl (local.get $h) (i32.const 16)))))

  ;; True when src is the exact inverse of its last background save, but the
  ;; original large surface has since been rewritten through Lock/Unlock.
  (func $dx_surf_stale_restore
    (param $dst_entry i32) (param $src_entry i32)
    (param $dx i32) (param $dy i32) (param $sx i32) (param $sy i32)
    (param $w i32) (param $h i32) (param $flags i32) (result i32)
    (local $state i32) (local $dst_state i32)
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0xFEFFFFFF)) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $state (call $dx_surf_state_ptr (local.get $src_entry)))
    (local.set $dst_state (call $dx_surf_state_ptr (local.get $dst_entry)))
    (if (i32.ne (i32.load offset=4 (local.get $state))
                (i32.add (call $dx_slot_of (local.get $dst_entry)) (i32.const 1)))
      (then (return (i32.const 0))))
    (if (i32.eq (i32.load offset=8 (local.get $state))
                (i32.load (local.get $dst_state)))
      (then (return (i32.const 0))))
    (if (i32.or
          (i32.or (i32.ne (i32.load offset=12 (local.get $state)) (local.get $dx))
                  (i32.ne (i32.load offset=16 (local.get $state)) (local.get $dy)))
          (i32.or (i32.ne (i32.load offset=20 (local.get $state)) (local.get $sx))
                  (i32.ne (i32.load offset=24 (local.get $state)) (local.get $sy))))
      (then (return (i32.const 0))))
    (i32.eq (i32.load offset=28 (local.get $state))
      (i32.or (i32.and (local.get $w) (i32.const 0xFFFF))
              (i32.shl (local.get $h) (i32.const 16)))))

  ;; Record the palette data WASM address for one surface entry.
  (func $dx_surf_pal_set (param $entry_wa i32) (param $pal_wa i32)
    (local $slot i32)
    (if (i32.eqz (local.get $entry_wa)) (then (return)))
    (local.set $slot (call $dx_slot_of (local.get $entry_wa)))
    (if (i32.ge_u (local.get $slot) (global.get $DX_MAX)) (then (return)))
    (i32.store (i32.add (global.get $DX_SURF_PAL) (i32.shl (local.get $slot) (i32.const 2)))
      (local.get $pal_wa)))

  ;; Palette data WASM address for one surface, falling back to the display
  ;; palette when that surface never had one attached.
  (func $dx_surf_pal_get (param $entry_wa i32) (result i32)
    (local $slot i32) (local $pal i32)
    (if (local.get $entry_wa)
      (then
        (local.set $slot (call $dx_slot_of (local.get $entry_wa)))
        (if (i32.lt_u (local.get $slot) (global.get $DX_MAX))
          (then
            (local.set $pal (i32.load
              (i32.add (global.get $DX_SURF_PAL) (i32.shl (local.get $slot) (i32.const 2)))))))))
    (if (local.get $pal) (then (return (local.get $pal))))
    (call $dx_primary_pal_get))

  ;; Return a guest pointer to a COM wrapper that reports the given vtbl and
  ;; points to the given DX_OBJECTS slot. If slot's primary wrapper already
  ;; has that vtbl, return it; otherwise find/alloc an aux wrapper with it.
  ;; Never mutates the primary wrapper's vtbl (callers may hold cached copies
  ;; of the primary wrapper pointer and expect its vtbl to be stable).
  (func $dx_get_wrapper_for_vtbl (param $slot i32) (param $vtbl_guest i32) (result i32)
    (local $r i32)
    (call $lock_acquire (global.get $LOCK_DX))
    (local.set $r (call $dx_get_wrapper_for_vtbl_locked
      (local.get $slot) (local.get $vtbl_guest)))
    (call $lock_release (global.get $LOCK_DX))
    (local.get $r))

  ;; Scan-then-append over the aux pool: held under $LOCK_DX so two threads
  ;; querying the same interface get one shared wrapper instead of two racing
  ;; appends into the same slot.
  (func $dx_get_wrapper_for_vtbl_locked (param $slot i32) (param $vtbl_guest i32) (result i32)
    (local $primary_wa i32) (local $aux_wa i32) (local $i i32) (local $n i32)
    (local.set $primary_wa (i32.add (global.get $COM_WRAPPERS)
      (i32.mul (local.get $slot) (i32.const 8))))
    ;; Primary hit?
    (if (i32.eq (i32.load (local.get $primary_wa)) (local.get $vtbl_guest)) (then
      (return (i32.add (i32.sub (local.get $primary_wa) (global.get $GUEST_BASE))
                       (global.get $image_base)))))
    ;; Scan aux pool for (vtbl, slot) match.
    (local.set $n (i32.load (global.get $COM_AUX_NEXT_SHARED)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $aux_wa (i32.add (global.get $COM_WRAPPERS_AUX)
        (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.and
            (i32.eq (i32.load (local.get $aux_wa)) (local.get $vtbl_guest))
            (i32.eq (i32.load (i32.add (local.get $aux_wa) (i32.const 4))) (local.get $slot)))
        (then (return (i32.add (i32.sub (local.get $aux_wa) (global.get $GUEST_BASE))
                               (global.get $image_base)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    ;; Miss — bump allocate.
    (if (i32.ge_u (local.get $n) (global.get $COM_WRAPPERS_AUX_MAX)) (then
      ;; Pool exhausted; fall back to primary and mutate (legacy behavior).
      (i32.store (local.get $primary_wa) (local.get $vtbl_guest))
      (return (i32.add (i32.sub (local.get $primary_wa) (global.get $GUEST_BASE))
                       (global.get $image_base)))))
    (local.set $aux_wa (i32.add (global.get $COM_WRAPPERS_AUX)
      (i32.mul (local.get $n) (i32.const 8))))
    (i32.store (local.get $aux_wa) (local.get $vtbl_guest))
    (i32.store (i32.add (local.get $aux_wa) (i32.const 4)) (local.get $slot))
    (i32.store (global.get $COM_AUX_NEXT_SHARED) (i32.add (local.get $n) (i32.const 1)))
    (i32.add (i32.sub (local.get $aux_wa) (global.get $GUEST_BASE))
             (global.get $image_base)))

  ;; Create a guest COM object using fixed COM_WRAPPERS area (not guest heap).
  ;; vtbl_guest is the guest address of the vtable (from DX_VTBL_* globals)
  ;; Returns guest address of the object
  (func $dx_create_com_obj (param $type i32) (param $vtbl_guest i32) (result i32)
    (local $entry_wa i32) (local $slot i32) (local $obj_wa i32)
    ;; Allocate DX_OBJECTS entry
    (local.set $entry_wa (call $dx_alloc (local.get $type)))
    (if (i32.eqz (local.get $entry_wa)) (then (return (i32.const 0))))
    (call $dx_surf_state_reset (local.get $entry_wa))
    ;; Compute slot index
    (local.set $slot (i32.div_u
      (i32.sub (local.get $entry_wa) (global.get $DX_OBJECTS))
      (i32.const 32)))
    ;; COM wrapper at fixed WASM address: COM_WRAPPERS + slot * 8
    (local.set $obj_wa (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $slot) (i32.const 8))))
    ;; Write lpVtbl (already a guest address)
    (i32.store (local.get $obj_wa) (local.get $vtbl_guest))
    ;; Write slot index
    (i32.store (i32.add (local.get $obj_wa) (i32.const 4)) (local.get $slot))
    ;; Return guest address: WASM_addr - GUEST_BASE + image_base
    (i32.add (i32.sub (local.get $obj_wa) (global.get $GUEST_BASE)) (global.get $image_base)))

  ;; Free a DX object. Keeps the COM wrapper (vtbl+slot) intact so dangling
  ;; guest ptrs still dispatch to valid handlers — some DX apps hold refs we
  ;; don't track (AddRef not propagated by every handler yet). The slot is
  ;; permanently retired: $dx_alloc skips slots with a live wrapper, even
  ;; when the DX_OBJECTS entry type is 0.
  (func $dx_free (param $entry_wa i32)
    (local $type i32)
    (if (i32.eq (global.get $dx_scroll_hold_wa) (local.get $entry_wa))
      (then (global.set $dx_scroll_hold_wa (i32.const 0))))
    (local.set $type (i32.load (local.get $entry_wa)))
    (if (i32.eq (local.get $type) (i32.const 2))
      (then (call $dx_surf_note_write (local.get $entry_wa))))
    ;; A DirectInput device's custom data-format map is a guest-heap block.
    (if (i32.eq (local.get $type) (i32.const 7))
      (then (call $di_format_map_drop (local.get $entry_wa))))
    (call $vbdd_draw_state_reset (local.get $entry_wa))
    ;; Zero the DX_OBJECTS entry type (marks it logically freed; wrapper stays).
    (i32.store (local.get $entry_wa) (i32.const 0))
    (i32.store (call $dx_surf_owner_ptr (local.get $entry_wa)) (i32.const 0))
    ;; Kind 22 lets the browser stop considering this slot immediately. A
    ;; later recycled allocation publishes kind 21 again.
    (if (i32.eq (local.get $type) (i32.const 2)) ;; DDSurface only
      (then (call $host_dx_trace
        (i32.const 22)
        (i32.div_u (i32.sub (local.get $entry_wa) (global.get $DX_OBJECTS)) (i32.const 32))
        (i32.const 0) (i32.const 0) (i32.const 0)))))

  ;; Generic IUnknown lifetime operations for DX_OBJECTS-backed interfaces.
  ;; The API table routes only interfaces with byte-identical lifetime rules
  ;; here; surfaces, buffers, devices, viewports and other owned objects keep
  ;; their named Release handlers so their final-release teardown still runs.
  (func $dx_com_addref (param $this i32) (result i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $rc
      (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (local.get $rc))

  (func $dx_com_release_basic (param $this i32) (result i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $rc
      (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (call $dx_free (local.get $entry))
        (return (i32.const 0))))
    (local.get $rc))

  ;; Shared dispatch endpoints. One stdcall argument: this.
  (func $handle_dx_com_addref (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dx_com_addref (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_dx_com_release_basic (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dx_com_release_basic (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; ── Init COM vtables ─────────────────────────────────────────
  ;; Allocate thunks for each COM method and populate the vtable blocks.
  ;; Called once from JS before guest code runs (via an exported init fn).
  ;; Each vtable entry gets a thunk in THUNK_BASE with:
  ;;   thunk+0 = marker 0xCACA0010 (COM method marker)
  ;;   thunk+4 = api_id of the COM method
  ;; $win32_dispatch reads the api_id and dispatches normally.

  ;; Allocate a vtable block from heap and fill it with thunk addresses.
  ;; Returns the guest address of the vtable.
  (func $init_com_vtable (param $base_api_id i32) (param $count i32) (result i32)
    (local $i i32) (local $thunk_wa i32) (local $thunk_guest i32)
    (local $vtbl_guest i32) (local $vtbl_wa i32)
    ;; IDirectDraw is always the first generated interface. Resetting here
    ;; makes repeated main-instance initialization deterministic.
    (if (i32.eq (local.get $base_api_id) (global.get $API_ID_IDirectDraw_BASE))
      (then (call $dx_vtable_registry_reset)))
    ;; Allocate vtable from heap (count * 4 bytes)
    (local.set $vtbl_guest (call $heap_alloc (i32.mul (local.get $count) (i32.const 4))))
    (local.set $vtbl_wa (call $g2w (local.get $vtbl_guest)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      ;; Compute thunk WASM addr
      (local.set $thunk_wa (i32.add (global.get $THUNK_BASE)
        (i32.mul (global.get $num_thunks) (i32.const 8))))
      ;; Write COM marker as name_rva
      (i32.store (local.get $thunk_wa) (i32.const 0xCACA0010))
      ;; Write api_id
      (i32.store (i32.add (local.get $thunk_wa) (i32.const 4))
        (i32.add (local.get $base_api_id) (local.get $i)))
      ;; Compute guest address of this thunk
      (local.set $thunk_guest (i32.add
        (i32.sub (local.get $thunk_wa) (global.get $GUEST_BASE))
        (global.get $image_base)))
      ;; Write guest thunk addr into vtable slot
      (i32.store (i32.add (local.get $vtbl_wa) (i32.mul (local.get $i) (i32.const 4)))
        (local.get $thunk_guest))
      (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (call $update_thunk_end)
    (call $dx_vtable_registry_append (local.get $vtbl_guest))
    (local.get $vtbl_guest))

  ;; api_table.json is append-only, while COM vtable slots have a fixed ABI.
  ;; Rewrite the API id stored in one generated thunk when a method was added
  ;; after the rest of its interface and therefore has a non-sequential id.
  (func $set_com_vtable_slot_api_id
      (param $vtbl_guest i32) (param $slot i32) (param $api_id i32)
    (local $thunk_guest i32)
    (local.set $thunk_guest
      (i32.load
        (i32.add
          (call $g2w (local.get $vtbl_guest))
          (i32.mul (local.get $slot) (i32.const 4)))))
    (i32.store offset=4
      (call $g2w (local.get $thunk_guest))
      (local.get $api_id)))

  ;; Extend a parent vtable: copy parent entries, append new thunks for extra methods.
  (func $extend_com_vtable (param $parent_vtbl i32) (param $parent_count i32)
                           (param $ext_api_id i32) (param $total_count i32) (result i32)
    (local $vtbl_guest i32) (local $vtbl_wa i32) (local $parent_wa i32)
    (local $i i32) (local $thunk_wa i32) (local $thunk_guest i32)
    (local.set $vtbl_guest (call $heap_alloc (i32.mul (local.get $total_count) (i32.const 4))))
    (local.set $vtbl_wa (call $g2w (local.get $vtbl_guest)))
    (local.set $parent_wa (call $g2w (local.get $parent_vtbl)))
    (call $memcpy (local.get $vtbl_wa) (local.get $parent_wa)
      (i32.mul (local.get $parent_count) (i32.const 4)))
    (local.set $i (local.get $parent_count))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $total_count)))
      (local.set $thunk_wa (i32.add (global.get $THUNK_BASE)
        (i32.mul (global.get $num_thunks) (i32.const 8))))
      (i32.store (local.get $thunk_wa) (i32.const 0xCACA0010))
      (i32.store (i32.add (local.get $thunk_wa) (i32.const 4))
        (i32.add (local.get $ext_api_id) (i32.sub (local.get $i) (local.get $parent_count))))
      (local.set $thunk_guest (i32.add
        (i32.sub (local.get $thunk_wa) (global.get $GUEST_BASE))
        (global.get $image_base)))
      (i32.store (i32.add (local.get $vtbl_wa) (i32.mul (local.get $i) (i32.const 4)))
        (local.get $thunk_guest))
      (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (call $update_thunk_end)
    (call $dx_vtable_registry_append (local.get $vtbl_guest))
    (local.get $vtbl_guest))

  ;; $init_dx_com_thunks is now auto-generated in 09b2-dispatch-table.generated.wat
  ;; by tools/gen_dispatch.js — COM vtable start IDs are computed from api_table.json

  ;; ════════════════════════════════════════════════════════════
  ;; CREATORS
  ;; ════════════════════════════════════════════════════════════

  ;; DirectDrawEnumerateA(lpCallback, lpContext) → HRESULT
  ;; Calls the callback once for the primary display driver, then returns DD_OK.
  ;; Callback: BOOL WINAPI cb(GUID *lpGUID, LPSTR lpDesc, LPSTR lpName, LPVOID lpCtx)
  (func $handle_DirectDrawEnumerateA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $desc i32) (local $desc_wa i32) (local $name i32) (local $name_wa i32) (local $ret_addr i32)
    ;; Save the original return address (on stack before our args)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    ;; Clean up stdcall args: 2 args + ret
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    ;; Allocate strings for description and driver name
    (local.set $desc (call $heap_alloc (i32.const 32))) (local.set $desc_wa (call $g2w (local.get $desc)))
    (local.set $name (call $heap_alloc (i32.const 16))) (local.set $name_wa (call $g2w (local.get $name)))
    ;; Write "Primary Display Driver\0"
    (i32.store (local.get $desc_wa) (i32.const 0x6d697250))  ;; "Prim"
    (i32.store offset=4 (local.get $desc_wa) (i32.const 0x20797261)) ;; "ary "
    (i32.store offset=8 (local.get $desc_wa) (i32.const 0x70736944)) ;; "Disp"
    (i32.store offset=12 (local.get $desc_wa) (i32.const 0x2079616c)) ;; "lay "
    (i32.store offset=16 (local.get $desc_wa) (i32.const 0x76697244)) ;; "Driv"
    (i32.store16 offset=20 (local.get $desc_wa) (i32.const 0x7265)) ;; "er"
    (i32.store8 offset=22 (local.get $desc_wa) (i32.const 0))
    ;; Write "display\0"
    (i32.store (local.get $name_wa) (i32.const 0x70736964))  ;; "disp"
    (i32.store offset=4 (local.get $name_wa) (i32.const 0x0079616c)) ;; "lay\0"
    ;; Save original return address first (highest on stack, popped by CACA0007 after callback ret)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    ;; Push callback args (right-to-left): lpContext, lpName, lpDesc, lpGUID(=NULL)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg1))  ;; lpContext
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $name))  ;; lpDriverName
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $desc))  ;; lpDriverDescription
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))  ;; lpGUID = NULL (primary)
    ;; Push continuation thunk as return address (lowest on stack = callback's return addr)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $ddenum_ret_thunk))
    ;; Jump to callback
    (global.set $eip (local.get $arg0))
    (global.set $steps (i32.const 0)))

  ;; DirectDrawEnumerateExA(lpCallback, lpContext, dwFlags) → HRESULT
  ;; Callback: BOOL WINAPI cb(GUID *lpGUID, LPSTR lpDesc, LPSTR lpName, LPVOID lpCtx, HMONITOR hm)
  (func $handle_DirectDrawEnumerateExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $desc i32) (local $desc_wa i32) (local $name i32) (local $name_wa i32) (local $ret_addr i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    ;; Clean up stdcall args: 3 args + ret
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    ;; Allocate strings for description and driver name
    (local.set $desc (call $heap_alloc (i32.const 32))) (local.set $desc_wa (call $g2w (local.get $desc)))
    (local.set $name (call $heap_alloc (i32.const 16))) (local.set $name_wa (call $g2w (local.get $name)))
    ;; Write "Primary Display Driver\0"
    (i32.store (local.get $desc_wa) (i32.const 0x6d697250))
    (i32.store offset=4 (local.get $desc_wa) (i32.const 0x20797261))
    (i32.store offset=8 (local.get $desc_wa) (i32.const 0x70736944))
    (i32.store offset=12 (local.get $desc_wa) (i32.const 0x2079616c))
    (i32.store offset=16 (local.get $desc_wa) (i32.const 0x76697244))
    (i32.store16 offset=20 (local.get $desc_wa) (i32.const 0x7265))
    (i32.store8 offset=22 (local.get $desc_wa) (i32.const 0))
    ;; Write "display\0"
    (i32.store (local.get $name_wa) (i32.const 0x70736964))
    (i32.store offset=4 (local.get $name_wa) (i32.const 0x0079616c))
    ;; Save original return address first (highest on stack, popped by CACA0007 after callback ret)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    ;; Push callback args (right-to-left): hMonitor, lpContext, lpName, lpDesc, lpGUID(=NULL)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))  ;; hMonitor = NULL
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg1))  ;; lpContext
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $name))  ;; lpDriverName
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $desc))  ;; lpDriverDescription
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))  ;; lpGUID = NULL (primary)
    ;; Push continuation thunk as return address (lowest on stack = callback's return addr)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $ddenum_ret_thunk))
    ;; Jump to callback
    (global.set $eip (local.get $arg0))
    (global.set $steps (i32.const 0)))

  ;; DX7VB's DirectX7 coclass is a dual interface used by VB6 games before
  ;; they ever call DDRAW.DLL directly. Keep the Automation prefix complete,
  ;; then bridge its first direct method to our IDirectDraw7-compatible object.
  (func $directx7_query_interface_wa (param $obj i32) (param $iid_wa i32)
      (param $out i32) (result i32)
    (if (i32.eqz (local.get $out))
      (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (if (i32.eqz (local.get $iid_wa))
      (then
        (call $gs32 (local.get $out) (i32.const 0))
        (return (i32.const 0x80004003))))
    ;; IUnknown, IDispatch, or IID_IDirectX7
    ;; {FAFA3599-8B72-11D2-90B2-00C04FC2C602}. In particular, reject the
    ;; VB runtime's optional IPersistStreamInit probe; returning this vtable
    ;; for that interface makes it invoke a nonexistent persistence method.
    (call $dx_query_interface_result
      (local.get $obj) (local.get $out)
      (i32.or
        (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0) (i32.const 0)
          (i32.const 0x000000C0) (i32.const 0x46000000))
        (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x00020400) (i32.const 0)
            (i32.const 0x000000C0) (i32.const 0x46000000))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0xFAFA3599) (i32.const 0x11D28B72)
            (i32.const 0xC000B290) (i32.const 0x02C6C24F))))))

  (func $directx7_query_interface (param $obj i32) (param $iid i32)
      (param $out i32) (result i32)
    (local $iid_wa i32)
    ;; Translate riid exactly once, then compare all four GUID words in-place.
    (if (local.get $iid)
      (then (local.set $iid_wa (call $g2w (local.get $iid)))))
    (call $directx7_query_interface_wa
      (local.get $obj) (local.get $iid_wa) (local.get $out)))

  (func $handle_IDirectX7_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $directx7_query_interface
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectX7_DirectSlot003 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirectX7_DirectDrawCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $obj_guest (call $dx_create_com_obj
      (i32.const 33) (call $init_vbdd34_vtable)))
    (if (i32.eqz (local.get $obj_guest))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)))
      (else
        (call $gs32 (local.get $arg2) (local.get $obj_guest))
        (global.set $dx_ddraw_this (local.get $obj_guest))
        (call $dx_coop_hwnd_set (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectX7_DirectInputCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; No current dropdown app requests the DX7VB DirectInput face.
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectX7_DirectSoundCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $native_obj i32) (local $entry i32) (local $slot i32) (local $wrapper i32)
    ;; The Automation method takes a BSTR device GUID; an empty/default BSTR
    ;; selects the primary device, matching a NULL native GUID.
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else
        (local.set $native_obj (call $dx_create_com_obj
          (i32.const 4) (global.get $DX_VTBL_DSOUND)))
        (if (i32.eqz (local.get $native_obj))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)))
          (else
            (call $dsound_mark_initialized (local.get $native_obj))
            (local.set $entry (call $dx_from_this (local.get $native_obj)))
            (local.set $slot (call $dx_slot_of (local.get $entry)))
            (local.set $wrapper (call $dx_get_wrapper_for_vtbl
              (local.get $slot) (call $init_com_vtable (i32.const 2574) (i32.const 11))))
            (call $gs32 (local.get $arg2) (local.get $wrapper))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectX7_DirectSlot007 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; DX7VB wraps native DirectDraw interfaces in typelib-specific vtables.
  ;; JigSaw's first observed wrapper method is CreateSurface at slot 7.
  (func $handle_IVBDirectDraw7_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectDraw_QueryInterface
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IVBDirectDraw7_CreateClipper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $native_obj i32) (local $entry i32) (local $slot i32) (local $wrapper i32)
    (local $vb_vtbl i32)
    (call $handle_IDirectDraw_CreateClipper
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0) (i32.const 0) (local.get $name_ptr))
    ;; DX7VB's typelib has eleven slots, ending in IsClipListChanged at 10.
    ;; That method is HRESULT(this, [out, retval] int*), ABI-compatible with
    ;; native slot 6, so share its thunk rather than inventing a second handler.
    (if (i32.and (i32.eqz (i32.load offset=0 (global.get $reg_base))) (i32.ne (local.get $arg2) (i32.const 0))) (then
      (local.set $native_obj (call $gl32 (local.get $arg2)))
      (if (local.get $native_obj) (then
        (local.set $entry (call $dx_from_this (local.get $native_obj)))
        (local.set $slot (call $dx_slot_of (local.get $entry)))
        (local.set $vb_vtbl (call $init_com_vtable (i32.const 2564) (i32.const 11)))
        ;; The first ten API ids are contiguous; the tail is not. Replace the
        ;; provisional final entry before publishing this wrapper to the guest.
        (call $gs32 (i32.add (local.get $vb_vtbl) (i32.const 40))
          (call $gl32 (i32.add (global.get $DX_VTBL_DDCLIP) (i32.const 24))))
        (local.set $wrapper (call $dx_get_wrapper_for_vtbl
          (local.get $slot) (local.get $vb_vtbl)))
        (call $gs32 (local.get $arg2) (local.get $wrapper))))))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_IVBDirectDraw7_CreateSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $vbdd_create_surface (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IVBDirectDraw7_SetCooperativeLevel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectDraw_SetCooperativeLevel
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IVBDirectDrawClipper_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; DX7VB typelib DirectDrawClipper, not the native IDirectDrawClipper ABI.
    ;; This wrapper is its own COM identity; never hand its vtable to native callers.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x9F76FDCA) (i32.const 0x11D18E92)
      (i32.const 0xC0000888) (i32.const 0x02C6C24F)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IVBDirectDrawClipper_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectDrawClipper_Release
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_vb_unsupported_stdcall (param $stack_bytes i32) (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $stack_bytes))))
  (func $handle_IVBDirectDrawClipper_SetHWnd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectDrawClipper_SetHWnd
      (local.get $arg0) (i32.const 0) (local.get $arg1)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    ;; Native SetHWnd includes dwFlags; the VB wrapper omits it.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_IVBDirectSound_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectSound_QueryInterface
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IVBDirectSound_DirectSlot (param $slot i32) (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IVBDirectSound_CreateSoundBufferFromFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32)
    ;; The app's UI sounds are optional, but VB still requires a real buffer
    ;; interface through the hidden retval before it can finish construction.
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else
        (local.set $obj (call $dx_create_com_obj
          (i32.const 5) (global.get $DX_VTBL_DSBUF)))
        (if (i32.eqz (local.get $obj))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)))
          (else
            (call $gs32 (local.get $arg2) (local.get $obj))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IVBDirectSound_SetCooperativeLevel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectSound_SetCooperativeLevel
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IVBDirectDrawSurface7_DirectSlot (param $slot i32) (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IVBDirectDrawSurface7_SetClipper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectDrawSurface_SetClipper
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; DirectXSetup(hwnd, rootPath, flags) -> DSETUPERR_SUCCESS. The emulator
  ;; already provides the DirectX runtime, so legacy redistributables must not
  ;; replace its system DLLs before continuing the application installer.
  (func $handle_DirectXSetup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; DirectDrawCreate(lpGUID, lplpDD, pUnkOuter) → HRESULT
  (func $handle_DirectDrawCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32)
    (local.set $obj_guest (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)) ;; E_FAIL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; *lplpDD = obj_guest
    (call $gs32 (local.get $arg1) (local.get $obj_guest))
    (global.set $dx_ddraw_this (local.get $obj_guest))
    (call $dx_coop_hwnd_set (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DD_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))) ;; stdcall 3 args

  ;; The generated registry has historically exposed one 24-slot
  ;; IDirectDraw2 superset for IID_IDirectDraw2/4/7. IDirectDraw4 adds four
  ;; methods, however, and IDirectDraw7 adds two more. A caller reaching slot
  ;; 27 on the short table enters the next generated COM vtable. Build the
  ;; compatible tails lazily so older v1/v2 pointers keep their exact ABI.
  (func $dx_get_ddraw4_vtbl (result i32)
    (if (i32.eqz (global.get $DX_VTBL_DDRAW4)) (then
      (global.set $DX_VTBL_DDRAW4 (call $extend_com_vtable
        (global.get $DX_VTBL_DDRAW2) (i32.const 24) (i32.const 3084) (i32.const 28)))))
    (global.get $DX_VTBL_DDRAW4))

  (func $dx_get_ddraw7_vtbl (result i32)
    (if (i32.eqz (global.get $DX_VTBL_DDRAW7)) (then
      (global.set $DX_VTBL_DDRAW7 (call $extend_com_vtable
        (call $dx_get_ddraw4_vtbl) (i32.const 28) (i32.const 3088) (i32.const 30)))))
    (global.get $DX_VTBL_DDRAW7))

  ;; DirectDrawCreateEx(lpGUID, lplpDD, riid, pUnkOuter) → HRESULT
  ;; DirectX 7 callers request IDirectDraw7 directly rather than creating the
  ;; v1 interface and calling QueryInterface. Unlike QueryInterface, the
  ;; documented factory contract accepts only IID_IDirectDraw7.
  (func $handle_DirectDrawCreateEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_wa i32) (local $obj_guest i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (if (local.get $arg3)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110)) ;; CLASS_E_NOAGGREGATION
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; E_INVALIDARG
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; Translate the caller's REFIID once, then compare all four GUID words.
    ;; IID_IDirectDraw7 {15E65EC0-3B9C-11D2-B92F-00609797EA5B}.
    (local.set $iid_wa (call $g2w (local.get $arg2)))
    (if (i32.eqz (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x15E65EC0) (i32.const 0x11D23B9C)
          (i32.const 0x60002FB9) (i32.const 0x5BEA9797)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $obj_guest
      (call $dx_create_com_obj (i32.const 1) (call $dx_get_ddraw7_vtbl)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)) ;; E_FAIL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (call $gs32 (local.get $arg1) (local.get $obj_guest))
    (global.set $dx_ddraw_this (local.get $obj_guest))
    (call $dx_coop_hwnd_set (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; DirectDrawCreateClipper(dwFlags, lplpDDClipper, pUnkOuter) → HRESULT
  ;; Standalone clipper factory — equivalent to IDirectDraw_CreateClipper.
  (func $handle_DirectDrawCreateClipper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 10) (global.get $DX_VTBL_DDCLIP)))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $arg1) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; DirectSoundCreate(lpGUID, lplpDS, pUnkOuter) → HRESULT
  (func $handle_DirectSoundCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32)
    (local.set $obj_guest (call $dx_create_com_obj (i32.const 4) (global.get $DX_VTBL_DSOUND)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $dsound_mark_initialized (local.get $obj_guest))
    (call $gs32 (local.get $arg1) (local.get $obj_guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DS_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; DirectSound8 inherits the eleven DirectSound methods and adds certification.
  (func $handle_DirectSoundCreate8 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32) (local $hr i32) (local $guid i32) (local $kind i32)
    (block $done
      (if (i32.eqz (local.get $arg1))
        (then (local.set $hr (i32.const 0x80070057)) (br $done)))
      (call $gs32 (local.get $arg1) (i32.const 0))
      (if (local.get $arg2)
        (then (local.set $hr (i32.const 0x80040110)) (br $done)))
      (if (local.get $arg0)
        (then
          (local.set $guid (call $g2w_affine_span (local.get $arg0) (i32.const 16)))
          (if (i32.eq (local.get $guid) (global.get $NULL_SENTINEL))
            (then (local.set $hr (i32.const 0x80070057)) (br $done)))
          (local.set $kind (i32.load (local.get $guid)))
          (if (i32.eqz (i32.or
                (call $guid_words_equal (local.get $guid) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
                (i32.and
                  (i32.or (i32.eq (local.get $kind) (i32.const 0xDEF00000))
                          (i32.eq (local.get $kind) (i32.const 0xDEF00002)))
                  (call $guid_words_equal (local.get $guid) (local.get $kind)
                    (i32.const 0x47ED9C6D) (i32.const 0xDA4DF1AA) (i32.const 0x035C2B8F)))))
            (then (local.set $hr (i32.const 0x88780078)) (br $done))))) ;; DSERR_NODRIVER
      (local.set $obj (call $dx_create_com_obj (i32.const 4) (global.get $DX_VTBL_DSOUND8)))
      (if (i32.eqz (local.get $obj))
        (then (local.set $hr (i32.const 0x8007000E)) (br $done)))
      (call $dsound_mark_initialized (local.get $obj))
      (call $gs32 (local.get $arg1) (local.get $obj)))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound8_VerifyCertification (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32) (local $entry i32)
    (block $done
      (local.set $entry (call $dx_from_this (local.get $arg0)))
      (if (i32.eqz (local.get $entry))
        (then (local.set $hr (i32.const 0x80070057)) (br $done)))
      (if (i32.eqz (load.field DxObject flags (local.get $entry)))
        (then (local.set $hr (i32.const 0x887800AA)) (br $done))) ;; DSERR_UNINITIALIZED
      (if (i32.eqz (local.get $arg1))
        (then (local.set $hr (i32.const 0x80070057)) (br $done)))
      (call $gs32 (local.get $arg1) (i32.const 1))) ;; DS_UNCERTIFIED: software device
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; DirectInputCreateA(hInstance, dwVersion, lplpDI, pUnkOuter) → HRESULT
  (func $handle_DirectInputCreateA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32) (local $entry i32)
    (local.set $obj_guest (call $dx_create_com_obj (i32.const 6) (global.get $DX_VTBL_DINPUT)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $obj_guest)))
    (store.field.memarg DxObject misc0 (local.get $entry) (local.get $arg1))
    (call $gs32 (local.get $arg2) (local.get $obj_guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DI_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))) ;; stdcall 4 args

  ;; Complete DirectInput interface classifier. A/W pairs share the same
  ;; wrapper shape here, but remain distinct complete COM identities.
  (func $dinput_iid_kind_wa (param $iid_wa i32) (result i32)
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0) (i32.const 0)
          (i32.const 0x000000C0) (i32.const 0x46000000))
      (then (return (i32.const 1)))) ;; IUnknown
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x89521360) (i32.const 0x11CFAA8A)
            (i32.const 0x4544C7BF) (i32.const 0x00005453))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x89521361) (i32.const 0x11CFAA8A)
            (i32.const 0x4544C7BF) (i32.const 0x00005453)))
      (then (return (i32.const 2)))) ;; IDirectInputA/W
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x5944E662) (i32.const 0x11CFAA8A)
            (i32.const 0x4544C7BF) (i32.const 0x00005453))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x5944E663) (i32.const 0x11CFAA8A)
            (i32.const 0x4544C7BF) (i32.const 0x00005453)))
      (then (return (i32.const 3)))) ;; IDirectInput2A/W
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x9A4CB684) (i32.const 0x11D3236D)
            (i32.const 0xC0009D8E) (i32.const 0xAE44684F))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x9A4CB685) (i32.const 0x11D3236D)
            (i32.const 0xC0009D8E) (i32.const 0xAE44684F)))
      (then (return (i32.const 4)))) ;; IDirectInput7A/W
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0xBF798030) (i32.const 0x4DA2483A)
            (i32.const 0x645D99AA) (i32.const 0x009736ED))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0xBF798031) (i32.const 0x4DA2483A)
            (i32.const 0x645D99AA) (i32.const 0x009736ED)))
      (then (return (i32.const 5)))) ;; IDirectInput8A/W
    (i32.const 0))

  ;; DirectInputCreateEx(hInstance, dwVersion, riid, ppvOut, pUnkOuter)
  ;; The dinput.dll 5/7 entry point apps reach by GetProcAddress. Same object
  ;; as DirectInputCreateA — IDirectInput2/7 only append methods after the
  ;; v1 vtable, which is what $DX_VTBL_DINPUT already provides.
  (func $handle_DirectInputCreateEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_wa i32) (local $kind i32) (local $vtbl i32)
    (local $obj_guest i32) (local $entry i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.eqz (local.get $arg3)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; E_INVALIDARG
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (local.get $arg4)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110)) ;; CLASS_E_NOAGGREGATION
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $iid_wa (call $g2w (local.get $arg2)))
    (local.set $kind (call $dinput_iid_kind_wa (local.get $iid_wa)))
    (if (i32.or (i32.lt_u (local.get $kind) (i32.const 2))
                (i32.gt_u (local.get $kind) (i32.const 4)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; E_NOINTERFACE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $vtbl
      (select (global.get $DX_VTBL_DINPUT7) (global.get $DX_VTBL_DINPUT)
        (i32.ge_u (local.get $kind) (i32.const 3))))
    (local.set $obj_guest
      (call $dx_create_com_obj (i32.const 6) (local.get $vtbl)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)) ;; E_FAIL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $obj_guest)))
    (store.field.memarg DxObject misc0 (local.get $entry) (local.get $arg1))
    (call $gs32 (local.get $arg3) (local.get $obj_guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DI_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; DirectInput8Create(hInstance, dwVersion, riidltf, ppvOut, pUnkOuter)
  ;; IDirectInput8 keeps the legacy methods at the front of its vtable, which
  ;; covers the device creation/input path currently implemented here.
  (func $handle_DirectInput8Create (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_wa i32) (local $obj_guest i32) (local $entry i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (if (local.get $arg4)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110)) ;; CLASS_E_NOAGGREGATION
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.eqz (local.get $arg3)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; E_INVALIDARG
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $iid_wa (call $g2w (local.get $arg2)))
    (if (i32.ne (call $dinput_iid_kind_wa (local.get $iid_wa)) (i32.const 5))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; E_NOINTERFACE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $obj_guest
      (call $dx_create_com_obj (i32.const 6) (global.get $DX_VTBL_DINPUT)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)) ;; E_FAIL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $obj_guest)))
    (store.field.memarg DxObject misc0 (local.get $entry) (i32.const 0x0800))
    (call $gs32 (local.get $arg3) (local.get $obj_guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectDraw methods
  ;; ════════════════════════════════════════════════════════════

  ;; All COM methods: arg0=this, arg1..arg4 from stack.
  ;; Stack layout: [ESP]=ret, [ESP+4]=this, [ESP+8]=arg1, ...
  ;; The dispatch already loaded 5 args from ESP+4..ESP+24.

  ;; Classify the complete Win98-era DirectDraw/Direct3D interface identities.
  ;; The result selects an ABI-compatible wrapper; zero means unsupported.
  (func $ddraw_iid_kind_wa (param $iid_wa i32) (result i32)
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0) (i32.const 0)
          (i32.const 0x000000C0) (i32.const 0x46000000))
      (then (return (i32.const 1)))) ;; IUnknown
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x6C14DB80) (i32.const 0x11CEA733)
          (i32.const 0x200021A5) (i32.const 0x60E50BAF))
      (then (return (i32.const 2)))) ;; IDirectDraw
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0xB3A6F3E0) (i32.const 0x11CF2B43)
          (i32.const 0xAA00DEA2) (i32.const 0x5633B900))
      (then (return (i32.const 3)))) ;; IDirectDraw2
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x9C59509A) (i32.const 0x11D139BD)
          (i32.const 0xC0004A8C) (i32.const 0xC530D94F))
      (then (return (i32.const 4)))) ;; IDirectDraw4
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x15E65EC0) (i32.const 0x11D23B9C)
          (i32.const 0x60002FB9) (i32.const 0x5BEA9797))
      (then (return (i32.const 5)))) ;; IDirectDraw7
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x3BBA0080) (i32.const 0x11CF2421)
          (i32.const 0xAA001AA3) (i32.const 0x5633B900))
      (then (return (i32.const 6)))) ;; IDirect3D
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x6AAE1EC1) (i32.const 0x11D0662A)
          (i32.const 0xAA009D88) (i32.const 0x6AB7BB00))
      (then (return (i32.const 7)))) ;; IDirect3D2
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0xBB223240) (i32.const 0x11D0E72B)
          (i32.const 0xAA00B4A9) (i32.const 0x3E99C000))
      (then (return (i32.const 8)))) ;; IDirect3D3
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0xF5049E77) (i32.const 0x11D24861)
          (i32.const 0xA00007A4) (i32.const 0xA82906C9))
      (then (return (i32.const 9)))) ;; IDirect3D7
    (i32.const 0))

  ;; CoCreateInstance(CLSID_DirectDraw, ..., riid, ppv) hands back a DirectDraw
  ;; object the caller then drives through IDirectDraw::Initialize — the route
  ;; Half-Life's hw.dll takes instead of calling DirectDrawCreate. Only the
  ;; DirectDraw family is reachable this way: Direct3D comes from a QI on an
  ;; already-initialized object, so kinds 6..9 are refused here rather than
  ;; manufacturing a D3D interface over an uninitialized device.
  ;; Returns an HRESULT and writes *ppv on success.
  (func $ddraw_cocreate_query_wa
      (param $obj_guest i32) (param $iid_wa i32) (param $ppv_guest i32) (result i32)
    (local $kind i32) (local $entry i32) (local $slot i32) (local $obj i32)
    (local.set $kind (call $ddraw_iid_kind_wa (local.get $iid_wa)))
    (if (i32.or (i32.eqz (local.get $kind)) (i32.gt_u (local.get $kind) (i32.const 5)))
      (then (return (i32.const 0x80004002)))) ;; E_NOINTERFACE
    (local.set $entry (call $dx_from_this (local.get $obj_guest)))
    (if (i32.eqz (local.get $entry))
      (then (return (i32.const 0x80004002))))
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (local.set $obj
          (i32.add
            (i32.sub
              (i32.add (global.get $COM_WRAPPERS)
                (i32.mul (local.get $slot) (i32.const 8)))
              (global.get $GUEST_BASE))
            (global.get $image_base)))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DDRAW)))))
    (if (i32.eq (local.get $kind) (i32.const 3))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DDRAW2)))))
    (if (i32.eq (local.get $kind) (i32.const 4))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (call $dx_get_ddraw4_vtbl)))))
    (if (i32.eq (local.get $kind) (i32.const 5))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (call $dx_get_ddraw7_vtbl)))))
    (if (i32.eqz (local.get $obj))
      (then (return (i32.const 0x80004002))))
    (store.field DxObject refcount (local.get $entry)
      (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (call $gs32 (local.get $ppv_guest) (local.get $obj))
    (i32.const 0))

  ;; QueryInterface(this, riid, ppvObj)
  ;; Accept DDraw and D3D family interfaces with proper vtables.
  (func $handle_IDirectDraw_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_wa i32) (local $kind i32) (local $entry i32)
    (local $slot i32) (local $obj i32) (local $child_entry i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Translate riid exactly once, then compare all four GUID words in-place.
    (local.set $iid_wa (call $g2w (local.get $arg1)))
    (local.set $kind (call $ddraw_iid_kind_wa (local.get $iid_wa)))
    (if (i32.eqz (local.get $kind))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; E_NOINTERFACE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Resolve this and its primary slot once. Every wrapper for this object
    ;; shares that entry; IUnknown must always return the controlling wrapper.
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (local.set $obj
          (i32.add
            (i32.sub
              (i32.add (global.get $COM_WRAPPERS)
                (i32.mul (local.get $slot) (i32.const 8)))
              (global.get $GUEST_BASE))
            (global.get $image_base)))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DDRAW)))))
    ;; IDirectDraw2/4/7 — return a distinct wrapper with the requested ABI.
    ;; Must NOT mutate the primary wrapper: apps like foxbear QI for
    ;; IDirectDraw2 but continue using the original pointer with v1-signature
    ;; calls (SetDisplayMode with 3 args, not 5). Upgrading in-place then
    ;; made SetDisplayMode pop 28 bytes (v2) when only 20 were pushed (v1),
    ;; corrupting ESP and jumping to 0.
    (if (i32.eq (local.get $kind) (i32.const 3))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DDRAW2)))))
    (if (i32.eq (local.get $kind) (i32.const 4))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (call $dx_get_ddraw4_vtbl)))))
    (if (i32.eq (local.get $kind) (i32.const 5))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (call $dx_get_ddraw7_vtbl)))))
    (if (local.get $obj)
      (then
        (store.field DxObject refcount (local.get $entry)
          (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
        (call $gs32 (local.get $arg2) (local.get $obj))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; IDirect3D{,2,3} — create a new child entry and link parent DDraw slot at +8
    ;; so that IDirect3D::QI(IID_IDirectDraw) can find the parent via the link
    ;; (rather than relying on a scan that misses after Release cycles).
    (if (i32.and (i32.ge_u (local.get $kind) (i32.const 6))
                 (i32.le_u (local.get $kind) (i32.const 8)))
      (then
        (if (i32.eq (local.get $kind) (i32.const 6))
          (then (local.set $obj (call $dx_create_com_obj (i32.const 8) (global.get $DX_VTBL_D3D))))
          (else (if (i32.eq (local.get $kind) (i32.const 7))
            (then (local.set $obj (call $dx_create_com_obj (i32.const 9) (global.get $DX_VTBL_D3D2))))
            (else (local.set $obj (call $dx_create_com_obj (i32.const 9) (global.get $DX_VTBL_D3D3)))))))
        (if (i32.eqz (local.get $obj))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; E_OUTOFMEMORY
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))
        ;; Store parent DDraw slot at child_entry+8.
        (local.set $child_entry (call $dx_from_this (local.get $obj)))
        (store.field DxObject misc0 (local.get $child_entry) (local.get $slot))
        (call $gs32 (local.get $arg2) (local.get $obj))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; IDirect3D7 — keep this separate so the legacy D3D1/2/3 path remains
    ;; unchanged for d3drm.dll, which is sensitive to QueryInterface HRESULTs.
    (if (i32.eq (local.get $kind) (i32.const 9))
      (then
        (local.set $obj (call $dx_create_com_obj (i32.const 9) (global.get $DX_VTBL_D3D7)))
        (if (i32.eqz (local.get $obj))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))
        (local.set $child_entry (call $dx_from_this (local.get $obj)))
        (store.field DxObject misc0 (local.get $child_entry) (local.get $slot))
        (call $gs32 (local.get $arg2) (local.get $obj))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Classification above makes this unreachable, but fail closed if a new
    ;; kind is added without a corresponding wrapper path.
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))



  ;; Compact — no-op
  (func $handle_IDirectDraw_Compact (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; CreateClipper — stub
  ;; CreateClipper(this, dwFlags, lplpDDClipper, pUnkOuter) — type 10 = DDClipper
  (func $handle_IDirectDraw_CreateClipper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 10) (global.get $DX_VTBL_DDCLIP)))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)) ;; E_FAIL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (call $gs32 (local.get $arg2) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DD_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; CreatePalette(this, dwFlags, lpDDColorArray, lplpDDPalette, pUnkOuter)
  (func $handle_IDirectDraw_CreatePalette (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32) (local $entry i32) (local $pal_wa i32) (local $pal_copy i32)
    ;; Allocate a DDPalette object
    (local.set $obj (call $dx_create_com_obj (i32.const 3) (global.get $DX_VTBL_DDPAL)))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; Copy 256 PALETTEENTRY entries (1024 bytes) to heap
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $pal_copy (call $heap_alloc (i32.const 1024))) (local.set $pal_wa (call $g2w (local.get $pal_copy)))
    (call $memcpy (local.get $pal_wa) (call $g2w (local.get $arg2)) (i32.const 1024))
    (store.field DxObject misc1 (local.get $entry) (local.get $pal_wa)) ;; dib_ptr = palette data WASM addr
    ;; *lplpDDPalette = obj
    (call $gs32 (local.get $arg3) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))) ;; 5 args (this + 4)

  ;; A mipmapped texture is a chain, not one surface: level N answers
  ;; GetAttachedSurface(DDSCAPS_TEXTURE|DDSCAPS_MIPMAP) with level N+1, and that
  ;; is how a renderer walks down to upload each level. Half-Life's hw.dll does
  ;; exactly that at hw+0x10038b35 and **ignores the HRESULT** — on real
  ;; hardware the chain always exists — so a missing attachment is not an error
  ;; it reports. It is a NULL it then calls IDirectDrawSurface::Lock through,
  ;; killing the guest a long way from the surface that never had the levels.
  ;;
  ;; Levels bill zero video memory on purpose: level 0 already books the whole
  ;; 4/3 pyramid estimate, and moving that would shift GetAvailableVidMem deltas
  ;; that apps calibrate their texture budgets against (MCM does).
  ;; SYSTEMMEMORY surfaces must not consume the fixed video/DIB arena.
  ;; Flag 0x400 records heap ownership independently of mutable surface caps.
  (func $dx_surface_storage_alloc (param $size i32) (param $flags i32) (result i32)
    (local $guest i32)
    (if (result i32) (i32.and (local.get $flags) (i32.const 0x400))
      (then
        (local.set $guest (call $heap_alloc (local.get $size)))
        (if (local.get $guest)
          (then
            ;; Renderers retain a linear WASM pixel pointer. A fragmented
            ;; sparse heap allocation cannot satisfy that contract.
            (if (i32.eq (call $g2w_affine_span (local.get $guest) (local.get $size))
                        (global.get $NULL_SENTINEL))
              (then
                (call $heap_free (local.get $guest))
                (local.set $guest (i32.const 0))))))
        (local.get $guest))
      (else (call $dib_alloc (local.get $size)))))

  (func $dx_surface_storage_free (param $wa i32) (param $flags i32)
    (if (i32.and (local.get $flags) (i32.const 0x200)) (then (return)))
    (if (i32.and (local.get $flags) (i32.const 0x400))
      (then (call $heap_free (call $w2g (local.get $wa))))
      (else (call $dib_free_wasm (local.get $wa)))))

  (func $dx_create_mip_chain
      (param $parent_obj i32) (param $owner i32) (param $caps i32)
      (param $w i32) (param $h i32) (param $bpp i32) (param $fmt i32)
      (param $want_levels i32)
    (local $obj i32) (local $entry i32) (local $prev_entry i32)
    (local $pitch i32) (local $size i32) (local $dib_guest i32) (local $dib_wa i32)
    (local $level i32) (local $storage_flags i32)
    (local.set $storage_flags
      (select (i32.const 0x400) (i32.const 0)
        (i32.and (local.get $caps) (i32.const 0x800))))
    (local.set $prev_entry (call $dx_from_this (local.get $parent_obj)))
    (if (i32.eqz (local.get $prev_entry)) (then (return)))
    (local.set $level (i32.const 1))
    (block $done
      (loop $next
        ;; A 1x1 level is the bottom of any pyramid.
        (br_if $done (i32.and
          (i32.eq (local.get $w) (i32.const 1))
          (i32.eq (local.get $h) (i32.const 1))))
        ;; 20 levels covers a 1048576-pixel edge; the bound is a guard, not a limit.
        (br_if $done (i32.gt_u (local.get $level) (i32.const 20)))
        ;; A caller that declared dwMipMapCount gets exactly that many levels.
        (br_if $done (i32.and
          (i32.ne (local.get $want_levels) (i32.const 0))
          (i32.ge_u (local.get $level) (local.get $want_levels))))
        (local.set $w (select (i32.shr_u (local.get $w) (i32.const 1)) (i32.const 1)
          (i32.gt_u (local.get $w) (i32.const 1))))
        (local.set $h (select (i32.shr_u (local.get $h) (i32.const 1)) (i32.const 1)
          (i32.gt_u (local.get $h) (i32.const 1))))
        (local.set $pitch (i32.and
          (i32.add (i32.mul (local.get $w) (i32.div_u (local.get $bpp) (i32.const 8)))
            (i32.const 3))
          (i32.const 0xFFFFFFFC)))
        (local.set $size (i32.mul (local.get $pitch) (local.get $h)))
        ;; Mip levels are bounded texture storage, not a display aperture.
        ;; Keep the small guard without charging sixteen unused rows per level.
        (local.set $dib_guest (call $dx_surface_storage_alloc
          (i32.add (local.get $size) (i32.const 64)) (local.get $storage_flags)))
        ;; An exhausted arena truncates the chain rather than failing the
        ;; texture — a short chain is what a card with less memory reports.
        (br_if $done (i32.eqz (local.get $dib_guest)))
        (local.set $dib_wa (call $g2w (local.get $dib_guest)))
        (call $zero_memory (local.get $dib_wa) (local.get $size))
        (local.set $obj (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF2)))
        (if (i32.eqz (local.get $obj))
          (then
            (call $dx_surface_storage_free (local.get $dib_wa) (local.get $storage_flags))
            (br $done)))
        (local.set $entry (call $dx_from_this (local.get $obj)))
        (call $zero_memory (call $dx_surf_meta_ptr (local.get $entry)) (i32.const 16))
        ;; The level carries its parent's caps, so the TEXTURE|MIPMAP request
        ;; GetAttachedSurface tests against is satisfied by the attachment.
        (i32.store (call $dx_surf_meta_ptr (local.get $entry)) (local.get $caps))
        (call $dx_surf_billed_set (local.get $entry) (i32.const 0))
        (i32.store (call $dx_surf_owner_ptr (local.get $entry)) (local.get $owner))
        (store.field DxObject width (local.get $entry) (local.get $w))
        (store.field DxObject height (local.get $entry) (local.get $h))
        (store.field DxObject bpp (local.get $entry) (local.get $bpp))
        (store.field DxObject pitch (local.get $entry) (local.get $pitch))
        (store.field DxObject misc1 (local.get $entry) (local.get $dib_wa))
        ;; misc2 on a surface is its colour key, so a fresh level leaves it 0.
        (store.field DxObject misc2 (local.get $entry) (i32.const 0))
        (store.field DxObject flags (local.get $entry)
          (i32.or (i32.const 4) (local.get $storage_flags))) ;; offscreen
        (call $dx_surf_fmt_set (local.get $entry) (local.get $fmt))
        (store.field DxObject misc0 (local.get $prev_entry) (local.get $obj))
        (local.set $prev_entry (local.get $entry))
        (local.set $level (i32.add (local.get $level) (i32.const 1)))
        (br $next))))

  ;; CreateSurface(this, lpDDSD, lplpDDSurface, pUnkOuter)
  (func $handle_IDirectDraw_CreateSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ddsd_wa i32) (local $caps i32) (local $w i32) (local $h i32) (local $bpp i32)
    (local $pitch i32) (local $dib_size i32) (local $dib_guest i32) (local $fmt i32) (local $dib_wa i32)
    (local $obj i32) (local $entry i32) (local $flags i32) (local $ddsd_flags i32)
    (local $back_obj i32) (local $back_entry i32) (local $vidmem_bytes i32)
    (local.set $ddsd_wa (call $g2w (local.get $arg1)))
    (local.set $ddsd_flags (i32.load offset=4 (local.get $ddsd_wa)))
    ;; DDSURFACEDESC:
    ;;   +0  dwSize (4)
    ;;   +4  dwFlags (4)
    ;;   +8  dwHeight (4)
    ;;   +12 dwWidth (4)
    ;;   +16 lPitch / dwLinearSize (4)
    ;;   +20 dwBackBufferCount (4)
    ;;   +24 dwMipMapCount / dwZBufferBitDepth / dwRefreshRate (4)
    ;;   +28 dwAlphaBitDepth (4)
    ;;   +32 dwReserved (4)
    ;;   +36 lpSurface (4)
    ;;   +40 ddckCKDestOverlay (8)
    ;;   +48 ddckCKDestBlt (8)
    ;;   +56 ddckCKSrcOverlay (8)
    ;;   +64 ddckCKSrcBlt (8)
    ;;   +72 ddpfPixelFormat (32)
    ;;   +104 ddsCaps (4)
    ;; ddsCaps flags: DDSCAPS_PRIMARYSURFACE=0x200, DDSCAPS_BACKBUFFER=0x4,
    ;;               DDSCAPS_OFFSCREENPLAIN=0x40, DDSCAPS_SYSTEMMEMORY=0x800,
    ;;               DDSCAPS_FLIP=0x10, DDSCAPS_COMPLEX=0x8
    (local.set $caps (i32.load (i32.add (local.get $ddsd_wa) (i32.const 104))))
    ;; Determine surface dimensions
    (if (i32.and (local.get $caps) (i32.const 0x200)) ;; PRIMARY
      (then
        (local.set $w (call $dx_display_w_get))
        (local.set $h (call $dx_display_h_get))
        ;; A windowed (non-exclusive) primary with no display mode selected
        ;; is the desktop itself, so it is as large as the screen metrics say.
        ;; Sized 640x480 on a larger desktop, a windowed D3D app's Blt to its
        ;; client rect in screen coordinates was cut at x=640/y=480 (Deus Ex
        ;; D3DDrv: grey strips along the right and bottom of the viewport).
        (if (i32.and (i32.eqz (call $dx_display_mode_get))
                     (i32.eqz (call $dx_exclusive_get)))
          (then
            (local.set $w (call $screen_metric_w))
            (local.set $h (call $screen_metric_h))))
        (local.set $bpp (call $dx_display_bpp_get))
        (local.set $flags (i32.const 1))) ;; flag=primary
      (else
        ;; Use dimensions from DDSURFACEDESC if provided
        (local.set $w (i32.load (i32.add (local.get $ddsd_wa) (i32.const 12))))
        (local.set $h (i32.load (i32.add (local.get $ddsd_wa) (i32.const 8))))
        (if (i32.eqz (local.get $w)) (then (local.set $w (call $dx_display_w_get))))
        (if (i32.eqz (local.get $h)) (then (local.set $h (call $dx_display_h_get))))
        ;; Use pixel format bpp from DDSURFACEDESC if DDSD_PIXELFORMAT (0x1000) is set
        (if (i32.and (local.get $ddsd_flags) (i32.const 0x1000))
          (then
            (local.set $bpp (i32.load (i32.add (local.get $ddsd_wa) (i32.const 84)))))
          (else
            (local.set $bpp (call $dx_display_bpp_get))))
        ;; Fallback: textures built from our (stub) EnumTextureFormats have ddpf
        ;; populated with zeros, so dwRGBBitCount=0. Use display bpp.
        (if (i32.eqz (local.get $bpp)) (then (local.set $bpp (call $dx_display_bpp_get))))
        (local.set $flags (i32.const 4)))) ;; flag=offscreen
    (local.set $fmt (call $dx_surf_fmt_default (local.get $bpp)))
    (if (i32.and (local.get $ddsd_flags) (i32.const 0x1000))
      (then (local.set $fmt
        (call $dx_surf_fmt_from_ddpf
          (i32.add (local.get $ddsd_wa) (i32.const 72)) (local.get $bpp)))))
    ;; A FOURCC format has dwRGBBitCount 0; the DXT blocks fit in 16bpp rows.
    (if (call $dx_fmt_is_dxt (local.get $fmt))
      (then (local.set $bpp (i32.const 16))))
    ;; Compute pitch (bytes per row, DWORD-aligned)
    (local.set $pitch (i32.and
      (i32.add (i32.mul (local.get $w) (i32.div_u (local.get $bpp) (i32.const 8))) (i32.const 3))
      (i32.const 0xFFFFFFFC)))
    ;; DDSD_PITCH: system-memory surfaces may have caller padding that every
    ;; subsequent Lock must preserve.
    (if (i32.and
          (i32.ne (i32.and (local.get $ddsd_flags) (i32.const 0x00000008)) (i32.const 0))
          (i32.ne (i32.load offset=16 (local.get $ddsd_wa)) (i32.const 0)))
      (then (local.set $pitch (i32.load offset=16 (local.get $ddsd_wa)))))
    ;; Allocate DIB, plus slack rows past the end.
    ;;
    ;; A real primary surface is the front of a video-memory aperture that
    ;; keeps going after the last visible scanline, so a guest that runs a few
    ;; rows long scribbles on nothing. Ours is a heap block with the next
    ;; allocation packed directly behind it, and that is not the same machine.
    ;; Diablo's Storm dialogs are 640x482 windows painted into a 640x480
    ;; primary: the two extra rows land 8 bytes past the end of the surface,
    ;; which is exactly where CreatePalette's 1024-byte copy of the colour
    ;; table had been allocated. Every entry became 0xefefefef -- the
    ;; background index 239 broadcast to a dword -- so from the moment you
    ;; picked a class the whole screen presented a real picture through a flat
    ;; grey palette. Nothing in the trace showed it: the pixels were right, no
    ;; SetEntries was called, and the surface never reported an error.
    ;;
    ;; Sixteen rows is far more than any overrun seen and costs 10KB on a
    ;; 640x480 primary. $dib_size stays the logical size, so pitch, vidmem
    ;; accounting and everything that reads the surface are unchanged.
    (local.set $dib_size (i32.mul (local.get $pitch) (local.get $h)))
    ;; DDSD_LPSURFACE lets a SYSTEMMEMORY surface alias storage owned by the
    ;; caller. FreeImage/Blitz uses this to expose its decoded ARGB rows to
    ;; DirectDraw before converting them into the display format. Replacing
    ;; that pointer with a fresh zeroed DIB turns every loaded image black.
    (if (i32.and
          (i32.ne (i32.and (local.get $ddsd_flags) (i32.const 0x00000800)) (i32.const 0))
          (i32.and
            (i32.ne (i32.and (local.get $caps) (i32.const 0x00000800)) (i32.const 0))
            (i32.ne (i32.load offset=36 (local.get $ddsd_wa)) (i32.const 0))))
      (then
        (local.set $dib_guest (i32.load offset=36 (local.get $ddsd_wa)))
        (local.set $dib_wa (call $g2w (local.get $dib_guest)))
        (local.set $flags (i32.or (local.get $flags) (i32.const 0x200)))
        (local.set $vidmem_bytes (i32.const 0)))
      (else
        (if (i32.and
              (i32.ne (i32.and (local.get $caps) (i32.const 0x800)) (i32.const 0))
              (i32.eqz (i32.and (local.get $caps) (i32.const 0x204))))
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x400)))))
        (local.set $dib_guest (call $dx_surface_storage_alloc
          (i32.add (local.get $dib_size)
            (i32.add
              (if (result i32) (i32.and (local.get $caps) (i32.const 0x204))
                (then (i32.mul (local.get $pitch) (i32.const 16)))
                (else (i32.const 0)))
              (i32.const 64))) (local.get $flags)))))
    ;; An exhausted heap returns 0, and g2w(0) is the base of the guest image --
    ;; zeroing a 640x480 surface from there wipes the first 300KB of the PE's
    ;; own code, so the app dies executing zeros a long way from the real cause.
    ;; Report the failure DirectDraw would report instead.
    (if (i32.eqz (local.get $dib_guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876017C)) ;; DDERR_OUTOFVIDEOMEMORY
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x200)))
      (then
        (local.set $dib_wa (call $g2w (local.get $dib_guest)))
        (call $zero_memory (local.get $dib_wa) (local.get $dib_size))))
    ;; Mipmap: the pyramid adds ~1/3 of level-0 bytes. DDSCAPS_MIPMAP=0x400000.
    ;; Only level 0 is allocated in RAM; extra pyramid bytes are accounted in
    ;; vidmem only so MCM's GetAvailableVidMem-delta footprint check matches.
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x600)))
      (then (local.set $vidmem_bytes (local.get $dib_size))))
    (if (i32.and
          (i32.eqz (i32.and (local.get $flags) (i32.const 0x600)))
          (i32.ne (i32.and (local.get $caps) (i32.const 0x400000)) (i32.const 0)))
      (then (local.set $vidmem_bytes
        (i32.div_u (i32.mul (local.get $dib_size) (i32.const 4)) (i32.const 3)))))
    (global.set $dx_vidmem_used (i32.add (global.get $dx_vidmem_used) (local.get $vidmem_bytes)))
    ;; Create COM object
    (local.set $obj (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF2)))
    (if (i32.eqz (local.get $obj))
      (then
        (call $dx_surface_storage_free (local.get $dib_wa) (local.get $flags))
        (global.set $dx_vidmem_used (i32.sub (global.get $dx_vidmem_used) (local.get $vidmem_bytes)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (call $zero_memory (call $dx_surf_meta_ptr (local.get $entry)) (i32.const 16))
    ;; The stored caps are what GetSurfaceDesc reports, so they must name
    ;; where DirectDraw put the surface, not only what was asked for. A
    ;; request with neither SYSTEMMEMORY nor VIDEOMEMORY lands in local video
    ;; memory. d3dapp (every DX5 SDK sample) creates its textures as
    ;; TEXTURE|ALLOCONLOAD, reads the caps back after Load, and on a hardware
    ;; driver releases any texture without VIDEOMEMORY -- Tunnel drew its
    ;; walls untextured.
    (if (i32.eqz (i32.and (local.get $caps) (i32.const 0x4800))) ;; SYSTEM|VIDEOMEMORY
      (then (local.set $caps (i32.or (local.get $caps) (i32.const 0x10004000))))) ;; LOCALVIDMEM|VIDEOMEMORY
    (i32.store (call $dx_surf_meta_ptr (local.get $entry)) (local.get $caps))
    (call $dx_surf_billed_set (local.get $entry) (local.get $vidmem_bytes))
    (i32.store (call $dx_surf_owner_ptr (local.get $entry))
      (i32.add (call $dx_slot_of (call $dx_from_this (local.get $arg0))) (i32.const 1)))
    ;; Fill entry
    (store.field DxObject width (local.get $entry) (local.get $w))
    (store.field DxObject height (local.get $entry) (local.get $h))
    (store.field DxObject bpp (local.get $entry) (local.get $bpp))
    (store.field DxObject pitch (local.get $entry) (local.get $pitch))
    (store.field DxObject misc1 (local.get $entry) (local.get $dib_wa))
    (store.field DxObject misc2 (local.get $entry) (local.get $vidmem_bytes))
    (store.field DxObject flags (local.get $entry) (local.get $flags))
    (call $dx_surf_fmt_set (local.get $entry) (local.get $fmt))
    ;; DDSCAPS_MIPMAP=0x400000. Build the rest of the pyramid now, while the
    ;; level-0 geometry and format are still in hand. DDSD_MIPMAPCOUNT=0x20000
    ;; makes dwMipMapCount at +24 the caller's declared total level count;
    ;; without it, run the pyramid down to 1x1.
    (if (i32.and
          (i32.ne (i32.and (local.get $caps) (i32.const 0x400000)) (i32.const 0))
          (i32.eqz (i32.and (local.get $flags) (i32.const 0x200)))) ;; not caller-owned bits
      (then (call $dx_create_mip_chain
        (local.get $obj)
        (i32.add (call $dx_slot_of (call $dx_from_this (local.get $arg0))) (i32.const 1))
        (local.get $caps) (local.get $w) (local.get $h) (local.get $bpp) (local.get $fmt)
        (select (i32.load offset=24 (local.get $ddsd_wa)) (i32.const 0)
          (i32.ne (i32.and (local.get $ddsd_flags) (i32.const 0x20000)) (i32.const 0))))))
    ;; *lplpDDSurface = obj
    (call $gs32 (local.get $arg2) (local.get $obj))
    ;; An exclusive primary owns the display, so its cooperative window follows
    ;; the surface dimensions. Keep the same fallback for borderless callers
    ;; such as donut, which create a 0x0 WS_POPUP and never call SetDisplayMode.
    ;;
    ;; Under DDSCL_NORMAL the primary is the desktop, not the application's
    ;; client area. Resizing an ordinary captioned window to the 640x480 primary
    ;; broke windowed D3DRM samples: Globe asked for 300x300 and created a
    ;; viewport for that client, then this path enlarged only its window and
    ;; left the rendered scene stranded in one corner.
    (if (i32.and (local.get $caps) (i32.const 0x200))
      (then (global.set $dx_primary_wa (local.get $entry))))
    (if (i32.and (local.get $caps) (i32.const 0x200))
      (then (if (call $dx_target_hwnd) (then
        (if (i32.or
              (i32.ne (call $dx_exclusive_get) (i32.const 0))
              (i32.eqz (i32.and
                (call $wnd_get_style (call $dx_target_hwnd))
                (i32.const 0x00C00000)))) ;; !WS_CAPTION
          (then
            (call $host_move_window (call $dx_target_hwnd)
              (i32.const 0) (i32.const 0)
              (local.get $w) (local.get $h) (i32.const 0))))))))
    ;; If primary with back buffer count > 0, create back buffer and link it
    (if (i32.and
          (i32.ne (i32.and (local.get $caps) (i32.const 0x200)) (i32.const 0))  ;; PRIMARY
          (i32.gt_u (i32.load (i32.add (local.get $ddsd_wa) (i32.const 20))) (i32.const 0))) ;; backbuf count
      (then
        (local.set $back_obj (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF2)))
        (if (local.get $back_obj) (then
          (local.set $back_entry (call $dx_from_this (local.get $back_obj)))
          (call $zero_memory (call $dx_surf_meta_ptr (local.get $back_entry)) (i32.const 16))
          (i32.store (call $dx_surf_owner_ptr (local.get $back_entry))
            (i32.add (call $dx_slot_of (call $dx_from_this (local.get $arg0))) (i32.const 1)))
          ;; The attached back buffer inherits the primary chain's allocation
          ;; and rendering caps.  Only its FRONT/PRIMARY identity changes.
          ;; SDK samples query this exact object and reject a hardware device
          ;; when VIDEOMEMORY or 3DDEVICE has been discarded here.
          (i32.store (call $dx_surf_meta_ptr (local.get $back_entry))
            (i32.or
              (i32.and (local.get $caps) (i32.const -513)) ;; ~DDSCAPS_PRIMARYSURFACE
              ;; Emulator-owned flip-chain storage is video memory even when
              ;; the caller omitted the optional placement hint.
              (i32.const 0x4004))) ;; DDSCAPS_VIDEOMEMORY|DDSCAPS_BACKBUFFER
          (store.field DxObject width (local.get $back_entry) (local.get $w))
          (store.field DxObject height (local.get $back_entry) (local.get $h))
          (store.field DxObject bpp (local.get $back_entry) (local.get $bpp))
          (store.field DxObject pitch (local.get $back_entry) (local.get $pitch))
          ;; Allocate separate DIB for back buffer, with the same slack rows as
          ;; the primary above -- an app that draws a couple of rows long does
          ;; it to whichever surface it is rendering into.
          (local.set $dib_guest (call $dib_alloc
            (i32.add (local.get $dib_size)
              (i32.add (i32.mul (local.get $pitch) (i32.const 16)) (i32.const 64)))))
          ;; Same guard as the primary above: never zero from g2w(0).
          (if (i32.eqz (local.get $dib_guest))
            (then
              (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876017C)) ;; DDERR_OUTOFVIDEOMEMORY
              (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
              (return)))
          (local.set $dib_wa (call $g2w (local.get $dib_guest))) (call $zero_memory (local.get $dib_wa) (local.get $dib_size))
          (global.set $dx_vidmem_used (i32.add (global.get $dx_vidmem_used) (local.get $dib_size)))
          (call $dx_surf_billed_set (local.get $back_entry) (local.get $dib_size))
          (store.field DxObject misc1 (local.get $back_entry) (local.get $dib_wa))
          (store.field DxObject misc2 (local.get $back_entry) (local.get $dib_size))
          (store.field DxObject flags (local.get $back_entry) (i32.const 2)) ;; flag=backbuf
          (call $dx_surf_fmt_set (local.get $back_entry) (local.get $fmt))
          ;; Store back buffer guest ptr in primary's misc0 field for GetAttachedSurface
          (store.field DxObject misc0 (local.get $entry) (local.get $back_obj))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))) ;; 4 args (this+3)

  ;; DuplicateSurface — stub
  (func $handle_IDirectDraw_DuplicateSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; EnumDisplayModes(this, dwFlags, lpDDSD, lpContext, lpEnumModesCallback)
  ;; Uses continuation thunk CACA0008 to iterate through a table of modes.
  ;; Mode table: (w, h, bpp) tuples — common Win98 modes.
  (func $handle_IDirectDraw_EnumDisplayModes (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $record i32) (local $wa i32)
    ;; Save state for continuation
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    ;; Clean up stdcall args: 5 args + ret = 24 bytes
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    ;; Owned record: callback/context/caller/index at +0/+4/+8/+12, followed
    ;; by an inline 108-byte DDSURFACEDESC. No process-global iteration state.
    (local.set $record (call $heap_alloc (i32.const 124)))
    (if (i32.eqz (local.get $record)) (then
      (global.set $eip (local.get $ret_addr))
      (i32.store (global.get $reg_base) (i32.const 0x8007000E))
      (return)))
    (local.set $wa (call $g2w (local.get $record)))
    (i32.store (local.get $wa) (local.get $arg4))
    (i32.store offset=4 (local.get $wa) (local.get $arg3))
    (i32.store offset=8 (local.get $wa) (local.get $ret_addr))
    (i32.store offset=12 (local.get $wa) (i32.const 0))
    ;; Start enumeration — call $enum_modes_dispatch for the first mode
    (call $enum_modes_dispatch (local.get $record)))

  ;; Width/height of resolution slot $r in the enumerated mode table.
  ;; Games that offer a resolution menu (Roller Coaster Tycoon) validate the
  ;; mode they are asked for against exactly this list and refuse anything not
  ;; in it, so the list is what caps their available resolutions.
  ;; Slot 5 is the host screen itself — a browser window is almost never one of
  ;; the five stock 4:3 modes, and a game whose resolution is a patchable pair
  ;; of immediates (see the RCT launchPrefs hook) can be pointed at exactly it,
  ;; but only if we enumerated it.
  ;;
  ;; Rounded down to a multiple of 8 in both axes and clamped to 640x480 ..
  ;; 1920x1080. The 8 is measured, not cosmetic: RCT repaints in blocks and a
  ;; 850-pixel-tall mode leaves the last two rows black forever, so the 8 stays
  ;; whatever the ceiling is. The ceiling itself is only about what a *game*
  ;; will draw into: RCT's engine stops drawing at x=1280, which is also the
  ;; widest mode it ships, and it never asks for the host slot unless something
  ;; points it there. Advertising a widescreen host slot costs RCT nothing
  ;; (it validates against the fixed 4:3 rows it knows) and is the only way a
  ;; 16:9 browser window can be offered at its true size.
  ;; `lib/app-profiles.js` rounds identically; the two must agree exactly or a
  ;; game refuses the mode it just asked for.
  (func $enum_mode_clamp (param $v i32) (param $lo i32) (param $hi i32) (result i32)
    (local.set $v (i32.and (local.get $v) (i32.const 0xFFF8)))
    (if (i32.lt_u (local.get $v) (local.get $lo)) (then (return (local.get $lo))))
    (if (i32.gt_u (local.get $v) (local.get $hi)) (then (return (local.get $hi))))
    (local.get $v))
  (func $enum_mode_host_w (result i32)
    (call $enum_mode_clamp
      (i32.and (call $host_get_screen_size) (i32.const 0xFFFF))
      (i32.const 640) (i32.const 1920)))
  (func $enum_mode_host_h (result i32)
    (call $enum_mode_clamp
      (i32.shr_u (call $host_get_screen_size) (i32.const 16))
      (i32.const 480) (i32.const 1080)))

  (func $enum_mode_res_w (param $r i32) (result i32)
    (if (i32.eq (local.get $r) (i32.const 1)) (then (return (i32.const 800))))
    (if (i32.eq (local.get $r) (i32.const 2)) (then (return (i32.const 1024))))
    (if (i32.eq (local.get $r) (i32.const 3)) (then (return (i32.const 1152))))
    (if (i32.eq (local.get $r) (i32.const 4)) (then (return (i32.const 1280))))
    (if (i32.eq (local.get $r) (i32.const 5)) (then (return (call $enum_mode_host_w))))
    ;; DirectDraw on Win9x exposes the palettized mode used by DOS-era and
    ;; early Windows cinematics. Keep it after the existing table so adding it
    ;; cannot change the preferred order of a game's ordinary resolution menu.
    (if (i32.eq (local.get $r) (i32.const 6)) (then (return (i32.const 320))))
    ;; Explicit 16:9 rows, appended after every pre-existing slot for the same
    ;; reason: a widescreen browser window is not one of the stock 4:3 modes,
    ;; and the host slot is a single moving target that a game's own resolution
    ;; menu cannot present as a stable choice.
    (if (i32.eq (local.get $r) (i32.const 7)) (then (return (i32.const 1280))))
    (if (i32.eq (local.get $r) (i32.const 8)) (then (return (i32.const 1600))))
    (if (i32.eq (local.get $r) (i32.const 9)) (then (return (i32.const 1920))))
    (i32.const 640))
  (func $enum_mode_res_h (param $r i32) (result i32)
    (if (i32.eq (local.get $r) (i32.const 1)) (then (return (i32.const 600))))
    (if (i32.eq (local.get $r) (i32.const 2)) (then (return (i32.const 768))))
    (if (i32.eq (local.get $r) (i32.const 3)) (then (return (i32.const 864))))
    (if (i32.eq (local.get $r) (i32.const 4)) (then (return (i32.const 1024))))
    (if (i32.eq (local.get $r) (i32.const 5)) (then (return (call $enum_mode_host_h))))
    (if (i32.eq (local.get $r) (i32.const 6)) (then (return (i32.const 200))))
    (if (i32.eq (local.get $r) (i32.const 7)) (then (return (i32.const 720))))
    (if (i32.eq (local.get $r) (i32.const 8)) (then (return (i32.const 900))))
    (if (i32.eq (local.get $r) (i32.const 9)) (then (return (i32.const 1080))))
    (i32.const 480))

  ;; ── The one mode table, shared by IDirectDraw::EnumDisplayModes and by
  ;; EnumDisplaySettingsA/W in `09a3-handlers-audio.wat`. Both walk it through
  ;; the helpers below; neither keeps a list of its own.
  ;;
  ;; A RAW index is (slot * 3 + depth) over the ten slots above, depth 0/1/2 =
  ;; 8/16/32 bpp — 30 raw indices, of which slot 6 (320x200) contributes only
  ;; its 8bpp member. Raw 19 and 20 are therefore holes: the 320x200x16 and
  ;; 320x200x32 modes never existed and inventing them would put two bogus rows
  ;; in a game's resolution menu.
  ;;
  ;; DirectDraw's callback loop tolerates holes (it just skips them). A caller
  ;; of EnumDisplaySettings does not — the documented loop runs iModeNum upward
  ;; until the call returns FALSE, so a hole truncates the list. That API walks
  ;; a DENSE index instead, 0..27, which $enum_mode_dense_to_raw maps back.
  (func $enum_mode_raw_count (result i32) (i32.const 30))
  (func $enum_mode_raw_skipped (param $raw i32) (result i32)
    (i32.and (i32.ge_u (local.get $raw) (i32.const 19))
             (i32.lt_u (local.get $raw) (i32.const 21))))
  (func $enum_mode_dense_count (result i32) (i32.const 28))
  (func $enum_mode_dense_to_raw (param $i i32) (result i32)
    (if (i32.lt_u (local.get $i) (i32.const 19)) (then (return (local.get $i))))
    (i32.add (local.get $i) (i32.const 2)))
  ;; 8 << depth, depth = raw % 3.
  (func $enum_mode_raw_bpp (param $raw i32) (result i32)
    (i32.shl (i32.const 8) (i32.rem_u (local.get $raw) (i32.const 3))))

  ;; Helper: fill DDSD for mode index $enum_modes_idx and jump to callback.
  ;; Mode table: the ten resolution slots × 8/16/32 bpp. idx/3 picks the
  ;; resolution and idx%3 the depth, so index 18 selects low-resolution slot 6
  ;; at its 8bpp member; raw 19/20 are skipped rather than advertising
  ;; historically inauthentic 320x200 16/32bpp variants.
  ;;
  ;; Every one of them is advertised, canvas size notwithstanding. This list is
  ;; what a game's own resolution menu offers — RCT validates the mode it is
  ;; asked for against exactly this list and refuses an exact-match miss — so
  ;; filtering it to the canvas silently deletes rows from that menu, and the
  ;; user picking "Full Screen 1024x768" on a smaller window got a mode change
  ;; that quietly fell back instead. A mode larger than the canvas is scaled to
  ;; fit when the primary surface is presented, so it costs sharpness, not
  ;; correctness.
  (func $enum_modes_dispatch (param $record i32)
    (local $ddsd_wa i32) (local $w i32) (local $h i32) (local $bpp i32)
    (local $pitch i32) (local $idx i32) (local $wa i32)
    (local.set $wa (call $g2w (local.get $record)))
    (local.set $idx (i32.load offset=12 (local.get $wa)))
    ;; Step over the raw holes (320x200 at 16/32bpp) before the end test, so a
    ;; hole can never be mistaken for the end of the table.
    (block $done
      (loop $skip
        (br_if $done (i32.eqz (call $enum_mode_raw_skipped (local.get $idx))))
        (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
        (br $skip)))
    (i32.store offset=12 (local.get $wa) (local.get $idx))
    ;; If past end of table, done — return DD_OK to caller
    (if (i32.ge_u (local.get $idx) (call $enum_mode_raw_count))
      (then
        (global.set $eip (i32.load offset=8 (local.get $wa)))
        (call $heap_free (local.get $record))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; DD_OK
        (return)))
    (local.set $w (call $enum_mode_res_w (i32.div_u (local.get $idx) (i32.const 3))))
    (local.set $h (call $enum_mode_res_h (i32.div_u (local.get $idx) (i32.const 3))))
    (local.set $bpp (call $enum_mode_raw_bpp (local.get $idx)))
    ;; Compute pitch: align (w * bytes_per_pixel) to 4 bytes
    (if (i32.eq (local.get $bpp) (i32.const 8))
      (then (local.set $pitch (i32.and (i32.add (local.get $w) (i32.const 3)) (i32.const 0xFFFFFFFC))))
      (else (if (i32.eq (local.get $bpp) (i32.const 16))
        (then (local.set $pitch (i32.and (i32.add (i32.mul (local.get $w) (i32.const 2)) (i32.const 3)) (i32.const 0xFFFFFFFC))))
        (else (local.set $pitch (i32.mul (local.get $w) (i32.const 4)))))))
    ;; Fill DDSURFACEDESC
    (local.set $ddsd_wa (i32.add (local.get $wa) (i32.const 16)))
    (call $zero_memory (local.get $ddsd_wa) (i32.const 108))
    (i32.store (local.get $ddsd_wa) (i32.const 108))  ;; dwSize
    ;; dwFlags = DDSD_WIDTH | DDSD_HEIGHT | DDSD_PIXELFORMAT | DDSD_PITCH
    (i32.store (i32.add (local.get $ddsd_wa) (i32.const 4)) (i32.const 0x1006))
    (i32.store (i32.add (local.get $ddsd_wa) (i32.const 8)) (local.get $h))     ;; dwHeight
    (i32.store (i32.add (local.get $ddsd_wa) (i32.const 12)) (local.get $w))    ;; dwWidth
    (i32.store (i32.add (local.get $ddsd_wa) (i32.const 16)) (local.get $pitch)) ;; lPitch
    ;; ddpfPixelFormat at offset 72
    (i32.store (i32.add (local.get $ddsd_wa) (i32.const 72)) (i32.const 32))  ;; dwSize
    (if (i32.eq (local.get $bpp) (i32.const 8))
      (then
        ;; 8bpp palettized: DDPF_RGB | DDPF_PALETTEINDEXED8
        (i32.store (i32.add (local.get $ddsd_wa) (i32.const 76)) (i32.const 0x60))
        (i32.store (i32.add (local.get $ddsd_wa) (i32.const 84)) (i32.const 8)))
      (else (if (i32.eq (local.get $bpp) (i32.const 16))
        (then
          ;; 16bpp RGB565
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 76)) (i32.const 0x40))
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 84)) (i32.const 16))
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 88)) (i32.const 0xF800))
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 92)) (i32.const 0x07E0))
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 96)) (i32.const 0x001F)))
        (else
          ;; 32bpp XRGB8888
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 76)) (i32.const 0x40))
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 84)) (i32.const 32))
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 88)) (i32.const 0x00FF0000))
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 92)) (i32.const 0x0000FF00))
          (i32.store (i32.add (local.get $ddsd_wa) (i32.const 96)) (i32.const 0x000000FF))))))
    ;; Carry the invocation record behind the callback's public arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $record))
    ;; Push callback args: lpContext, lpDDSD (right to left, __stdcall)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.load offset=4 (local.get $wa)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.add (local.get $record) (i32.const 16)))
    ;; Push continuation thunk as callback's return address
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $enum_modes_thunk))
    ;; Jump to callback
    (global.set $eip (i32.load (local.get $wa)))
    (global.set $steps (i32.const 0)))

  ;; CACA0008 continuation: callback returned, advance to next mode
  (func $enum_modes_continue
    (local $record i32) (local $wa i32)
    ;; The callback is __stdcall(2 args), so it already popped lpDDSD + lpContext (8 bytes).
    ;; Stack now has the invocation record pointer at ESP.
    (local.set $record (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $wa (call $g2w (local.get $record)))
    (call $host_log_i32 (i32.or (i32.const 0xED00000)
      (i32.or (i32.shl (i32.load offset=12 (local.get $wa)) (i32.const 8))
              (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFF)))))
    ;; Pop the private invocation pointer.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    ;; If callback returned 0 (DDENUMRET_CANCEL), stop enumeration
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then
        (global.set $eip (i32.load offset=8 (local.get $wa)))
        (call $heap_free (local.get $record))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; DD_OK
        (return)))
    ;; Advance to next mode
    (i32.store offset=12 (local.get $wa) (i32.add (i32.load offset=12 (local.get $wa)) (i32.const 1)))
    ;; Dispatch next mode (or finish if past end)
    (call $enum_modes_dispatch (local.get $record)))

  ;; ── IDirect3D{1,2,3}::EnumDevices ──
  ;; Win9x exposes Ramp/RGB/HAL to v1/v2 and RGB/HAL to v3.  The descriptor
  ;; pair matters as much as the GUID: software devices have no HW caps, while
  ;; HAL has a non-RGB HEL descriptor.  Some games (including MW3) deliberately
  ;; count only RGB HEL descriptors and assume one such entry per adapter.
  ;; Caller has captured the saved return addr and already popped stdcall args.
  ;; Dispatches callback N times via CACA000B continuation thunk.
  ;; Invocation-owned 588-byte record: cb/ctx/ret/index/version (20 bytes),
  ;; GUID (16), description (32), name (16), HW/caps7 (252), HEL (252).
  ;; The hidden stack slot owns it until cancellation or exhaustion.
  (func $d3d_enum_devices_invoke (param $cb i32) (param $ctx i32) (param $ret_addr i32) (param $version i32)
    (local $record i32) (local $state i32)
    (local.set $record (call $heap_alloc (i32.const 588)))
    (if (i32.eqz (local.get $record))
      (then
        (i32.store (global.get $reg_base) (i32.const 0x8007000E))
        (global.set $eip (local.get $ret_addr))
        (return)))
    (local.set $state (call $g2w (local.get $record)))
    (i32.store (local.get $state) (local.get $cb))
    (i32.store offset=4 (local.get $state) (local.get $ctx))
    (i32.store offset=8 (local.get $state) (local.get $ret_addr))
    (i32.store offset=12 (local.get $state) (i32.const 0))
    (i32.store offset=16 (local.get $state) (local.get $version))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $record))
    (if (i32.eq (local.get $version) (i32.const 7))
      (then (call $d3d_enum_devices7_dispatch (local.get $record)))
      (else (call $d3d_enum_devices_dispatch (local.get $record)))))

  (func $d3d_enum_devices_finish (param $record i32)
    (local $ret_addr i32)
    (local.set $ret_addr (call $gl32 (i32.add (local.get $record) (i32.const 8))))
    (call $heap_free (local.get $record))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (i32.store (global.get $reg_base) (i32.const 0))
    (global.set $eip (local.get $ret_addr)))

  ;; Fills per-device GUID/desc/name and invokes the guest callback.
  ;; If idx past end, frees the record and returns DD_OK to the caller.
  (func $d3d_enum_devices_dispatch (param $record i32)
    (local $state i32)
    (local $idx i32) (local $kind i32) (local $count i32)
    (local $guid i32) (local $desc i32) (local $name i32)
    (local $hw i32) (local $hel i32) (local $wa i32) (local $is_hal i32) (local $desc_wa i32) (local $name_wa i32)
    (local.set $state (call $g2w (local.get $record)))
    (local.set $idx (i32.load offset=12 (local.get $state)))
    ;; Device kinds: 0=Ramp, 1=RGB, 2=HAL.  D3D3 starts at RGB.
    (local.set $count
      (select (i32.const 3) (i32.const 2)
        (i32.le_u (i32.load offset=16 (local.get $state)) (i32.const 2))))
    (if (i32.ge_u (local.get $idx) (local.get $count))
      (then
        (call $d3d_enum_devices_finish (local.get $record))
        (return)))
    (local.set $kind
      (i32.add (local.get $idx)
        (select (i32.const 0) (i32.const 1)
          (i32.le_u (i32.load offset=16 (local.get $state)) (i32.const 2)))))
    (local.set $guid (i32.add (local.get $record) (i32.const 20)))
    (local.set $wa (i32.add (local.get $state) (i32.const 20)))
    (local.set $desc (i32.add (local.get $record) (i32.const 36)))
    (local.set $name (i32.add (local.get $record) (i32.const 68)))
    (local.set $desc_wa (i32.add (local.get $state) (i32.const 36)))
    (local.set $name_wa (i32.add (local.get $state) (i32.const 68)))
    (local.set $is_hal (i32.const 0))
    (if (i32.eq (local.get $kind) (i32.const 0))
      (then
        ;; IID_IDirect3DRampDevice {F2086B20-259F-11CF-A31A-00AA00B93356}
        (i32.store (local.get $wa)                      (i32.const 0xF2086B20))
        (i32.store (i32.add (local.get $wa) (i32.const 4))  (i32.const 0x11CF259F))
        (i32.store (i32.add (local.get $wa) (i32.const 8))  (i32.const 0xAA001AA3))
        (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0x5633B900))
        ;; "Ramp Emulation\0"
        (i32.store (local.get $desc_wa)                           (i32.const 0x706D6152))
        (i32.store offset=4 (local.get $desc_wa)                  (i32.const 0x6D452061))
        (i32.store offset=8 (local.get $desc_wa)                  (i32.const 0x74616C75))
        (i32.store offset=12 (local.get $desc_wa)                 (i32.const 0x006E6F69))
        ;; "ramp\0"
        (i32.store (local.get $name_wa) (i32.const 0x706D6172))
        (i32.store8 offset=4 (local.get $name_wa) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        ;; IID_IDirect3DRGBDevice {A4665C60-2673-11CF-A31A-00AA00B93356}
        (i32.store (local.get $wa)                      (i32.const 0xA4665C60))
        (i32.store (i32.add (local.get $wa) (i32.const 4))  (i32.const 0x11CF2673))
        (i32.store (i32.add (local.get $wa) (i32.const 8))  (i32.const 0xAA001AA3))
        (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0x5633B900))
        ;; "RGB Emulation\0"
        (i32.store (local.get $desc_wa)                           (i32.const 0x20424752))
        (i32.store offset=4 (local.get $desc_wa)                  (i32.const 0x6C756D45))
        (i32.store offset=8 (local.get $desc_wa)                  (i32.const 0x6F697461))
        (i32.store offset=12 (local.get $desc_wa)                 (i32.const 0x0000006E))
        ;; "rgb\0"
        (i32.store (local.get $name_wa) (i32.const 0x00626772))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then
        ;; IID_IDirect3DHALDevice {84E63DE0-46AA-11CF-816F-0000C020156E}
        (i32.store (local.get $wa)                      (i32.const 0x84E63DE0))
        (i32.store (i32.add (local.get $wa) (i32.const 4))  (i32.const 0x11CF46AA))
        (i32.store (i32.add (local.get $wa) (i32.const 8))  (i32.const 0x00006F81))
        (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0x6E1520C0))
        ;; "Direct3D HAL\0"
        (i32.store (local.get $desc_wa)                           (i32.const 0x65726944))
        (i32.store offset=4 (local.get $desc_wa)                  (i32.const 0x44337463))
        (i32.store offset=8 (local.get $desc_wa)                  (i32.const 0x4C414820))
        (i32.store8 offset=12 (local.get $desc_wa)                (i32.const 0))
        ;; "hal\0"
        (i32.store (local.get $name_wa) (i32.const 0x006C6168))
        (local.set $is_hal (i32.const 1))))
    ;; HW + HEL descs
    (local.set $hw (i32.add (local.get $record) (i32.const 84)))
    (call $fill_d3d_device_desc (local.get $hw)  (local.get $is_hal))
    (local.set $hel (i32.add (local.get $record) (i32.const 336)))
    (call $fill_d3d_device_desc (local.get $hel) (i32.const 0))
    ;; RGB/Ramp are software devices, so their HW descriptor is invalid.
    ;; HAL's HEL descriptor is valid fallback data but has no color model.
    (if (i32.eqz (local.get $is_hal))
      (then
        (call $gs32 (i32.add (local.get $hw) (i32.const 4)) (i32.const 0))
        (call $gs32 (i32.add (local.get $hw) (i32.const 8)) (i32.const 0)))
      (else
        (call $gs32 (i32.add (local.get $hel) (i32.const 8)) (i32.const 0))))
    ;; Ramp is monochrome; RGB is the sole RGB HEL device in the v3 list.
    (if (i32.eq (local.get $kind) (i32.const 0))
      (then (call $gs32 (i32.add (local.get $hel) (i32.const 8)) (i32.const 1))))
    ;; Push callback args right-to-left: ctx, helDesc, hwDesc, name, desc, guid
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.load offset=4 (local.get $state)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $hel))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $hw))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $name))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $desc))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $guid))
    ;; Push callback return = CACA000B
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $d3d_enum_dev_thunk))
    (global.set $eip (i32.load offset=0 (local.get $state)))
    (global.set $steps (i32.const 0)))

  ;; CACA000B: callback returned; callback popped 6 legacy args or 4 D3D7 args.
  ;; If callback returned DDENUMRET_CANCEL (0), stop; else advance idx.
  (func $d3d_enum_devices_continue
    (local $record i32) (local $state i32)
    (local.set $record (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (if (i32.eqz (i32.load (global.get $reg_base)))
      (then (call $d3d_enum_devices_finish (local.get $record)) (return)))
    (local.set $state (call $g2w (local.get $record)))
    (i32.store offset=12 (local.get $state) (i32.add (i32.load offset=12 (local.get $state)) (i32.const 1)))
    (if (i32.eq (i32.load offset=16 (local.get $state)) (i32.const 7))
      (then (call $d3d_enum_devices7_dispatch (local.get $record)))
      (else (call $d3d_enum_devices_dispatch (local.get $record)))))

  ;; D3D7 EnumDevices callback signature:
  ;; EnumDevicesCallback(lpDeviceDescription, lpDeviceName, lpD3DDeviceDesc7, lpContext).
  (func $d3d_enum_devices7_invoke (param $cb i32) (param $ctx i32) (param $ret_addr i32)
    (call $d3d_enum_devices_invoke (local.get $cb) (local.get $ctx) (local.get $ret_addr) (i32.const 7)))

  (func $d3d_enum_devices7_dispatch (param $record i32)
    (local $state i32)
    (local $idx i32) (local $desc i32) (local $name i32) (local $caps i32) (local $desc_wa i32) (local $name_wa i32)
    (local.set $state (call $g2w (local.get $record)))
    (local.set $idx (i32.load offset=12 (local.get $state)))
    ;; 0=HAL, 1=RGB software. D3D7 exposes no GUID in the callback.
    (if (i32.ge_u (local.get $idx) (i32.const 2))
      (then
        (call $d3d_enum_devices_finish (local.get $record))
        (return)))
    (local.set $desc (i32.add (local.get $record) (i32.const 36)))
    (local.set $name (i32.add (local.get $record) (i32.const 68)))
    (local.set $desc_wa (i32.add (local.get $state) (i32.const 36)))
    (local.set $name_wa (i32.add (local.get $state) (i32.const 68)))
    (if (i32.eq (local.get $idx) (i32.const 0))
      (then
        ;; "Direct3D HAL\0"
        (i32.store (local.get $desc_wa)                           (i32.const 0x65726944))
        (i32.store offset=4 (local.get $desc_wa)                  (i32.const 0x44337463))
        (i32.store offset=8 (local.get $desc_wa)                  (i32.const 0x4C414820))
        (i32.store8 offset=12 (local.get $desc_wa)                (i32.const 0))
        ;; "hal\0"
        (i32.store (local.get $name_wa) (i32.const 0x006C6168))))
    (if (i32.eq (local.get $idx) (i32.const 1))
      (then
        ;; "RGB Emulation\0"
        (i32.store (local.get $desc_wa)                           (i32.const 0x20424752))
        (i32.store offset=4 (local.get $desc_wa)                  (i32.const 0x6C756D45))
        (i32.store offset=8 (local.get $desc_wa)                  (i32.const 0x6F697461))
        (i32.store offset=12 (local.get $desc_wa)                 (i32.const 0x0000006E))
        ;; "rgb\0"
        (i32.store (local.get $name_wa) (i32.const 0x00626772))))
    (local.set $caps (i32.add (local.get $record) (i32.const 84)))
    (call $d3dim_fill_device_desc7 (local.get $caps))
    (if (i32.eq (local.get $idx) (i32.const 0))
      (then
        (i32.store offset=84 (local.get $state) (i32.const 0x8AEA0)))) ;; HAL-style dev caps
    ;; Push callback args right-to-left: ctx, caps7, name, desc.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.load offset=4 (local.get $state)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $caps))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $name))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $desc))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $d3d_enum_dev_thunk))
    (global.set $eip (i32.load offset=0 (local.get $state)))
    (global.set $steps (i32.const 0)))

  ;; ── IDirect3D3::EnumZBufferFormats — report a single 16-bit Z format ──
  ;; Callback signature: EnumZBufferFormatsCallback(lpDDPixelFormat, lpContext).
  (func $d3d_enum_zbuf_invoke (param $cb i32) (param $ctx i32) (param $ret_addr i32)
    (call $d3d_enum_format_begin (local.get $cb) (local.get $ctx) (local.get $ret_addr) (i32.const 2)))

  (func $d3d_enum_zbuf_continue
    (call $d3d_enum_format_continue))

  ;; ── IDirect3DDevice7::EnumTextureFormats — common RGB/ARGB formats ──
  ;; Callback signature: EnumTextureFormatsCallback(lpDDPixelFormat, lpContext).
  (func $d3d_fill_texture_format (param $fmt i32) (param $idx i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $fmt)))
    (call $zero_memory (local.get $wa) (i32.const 32))
    (i32.store (local.get $wa) (i32.const 32))                         ;; dwSize
    (if (i32.eq (local.get $idx) (i32.const 0))
      (then
        (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x40)) ;; DDPF_RGB
        (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 16))
        (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 0xF800))
        (i32.store (i32.add (local.get $wa) (i32.const 20)) (i32.const 0x07E0))
        (i32.store (i32.add (local.get $wa) (i32.const 24)) (i32.const 0x001F)))
      (else
        (if (i32.eq (local.get $idx) (i32.const 1))
          (then
            ;; Four alpha bits preserve the gradual HUD fades used by MCM.
            (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x41)) ;; DDPF_RGB|ALPHAPIXELS
            (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 16))
            (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 0x0F00))
            (i32.store (i32.add (local.get $wa) (i32.const 20)) (i32.const 0x00F0))
            (i32.store (i32.add (local.get $wa) (i32.const 24)) (i32.const 0x000F))
            (i32.store (i32.add (local.get $wa) (i32.const 28)) (i32.const 0xF000)))
          (else
            (if (i32.eq (local.get $idx) (i32.const 2))
              (then
                (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x41)) ;; DDPF_RGB|ALPHAPIXELS
                (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 16))
                (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 0x7C00))
                (i32.store (i32.add (local.get $wa) (i32.const 20)) (i32.const 0x03E0))
                (i32.store (i32.add (local.get $wa) (i32.const 24)) (i32.const 0x001F))
                (i32.store (i32.add (local.get $wa) (i32.const 28)) (i32.const 0x8000)))
              (else
                (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x40)) ;; DDPF_RGB
                (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 32))
                (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 0x00FF0000))
                (i32.store (i32.add (local.get $wa) (i32.const 20)) (i32.const 0x0000FF00))
                (i32.store (i32.add (local.get $wa) (i32.const 24)) (i32.const 0x000000FF)))))))))

  ;; Direct3D v1 EnumTextureFormats passes LPDDSURFACEDESC, not LPDDPIXELFORMAT.
  (func $d3d_fill_texture_desc (param $ddsd i32) (param $idx i32)
    (local $wa i32) (local $bpp i32) (local $pitch i32)
    (local.set $wa (call $g2w (local.get $ddsd)))
    (local.set $bpp (select (i32.const 16) (i32.const 32) (i32.lt_u (local.get $idx) (i32.const 3))))
    (local.set $pitch (i32.and
      (i32.add (i32.mul (i32.const 8) (i32.div_u (local.get $bpp) (i32.const 8))) (i32.const 3))
      (i32.const 0xFFFFFFFC)))
    (call $zero_memory (local.get $wa) (i32.const 108))
    (i32.store (local.get $wa) (i32.const 108))                         ;; dwSize
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x100F)) ;; CAPS|HEIGHT|WIDTH|PITCH|PIXELFORMAT
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (i32.const 8))    ;; dwHeight
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 8))   ;; dwWidth
    (i32.store (i32.add (local.get $wa) (i32.const 16)) (local.get $pitch))
    (call $d3d_fill_texture_format (i32.add (local.get $ddsd) (i32.const 72)) (local.get $idx))
    (i32.store (i32.add (local.get $wa) (i32.const 104)) (i32.const 0x1840))) ;; TEXTURE|SYSTEMMEMORY|OFFSCREENPLAIN

  ;; One owned allocation per invocation, including its callback payload:
  ;; +0 callback, +4 context, +8 caller return, +12 kind (0=pixel,1=desc,2=z),
  ;; +16 index, +20..127 payload (108 bytes maximum). The private pointer is
  ;; stacked behind callback arguments, so nested and interleaved callbacks
  ;; never consult or overwrite another invocation's state.
  (func $d3d_enum_format_begin (param $cb i32) (param $ctx i32) (param $ret i32) (param $kind i32)
    (local $record i32) (local $wa i32)
    (local.set $record (call $heap_alloc (i32.const 128)))
    (if (i32.eqz (local.get $record)) (then
      (i32.store (global.get $reg_base) (i32.const 0x8007000E))
      (global.set $eip (local.get $ret))
      (return)))
    (local.set $wa (call $g2w (local.get $record)))
    (i32.store (local.get $wa) (local.get $cb))
    (i32.store offset=4 (local.get $wa) (local.get $ctx))
    (i32.store offset=8 (local.get $wa) (local.get $ret))
    (i32.store offset=12 (local.get $wa) (local.get $kind))
    (i32.store offset=16 (local.get $wa) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base)
      (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $record))
    (call $d3d_enum_format_dispatch (local.get $record)))

  (func $d3d_enum_tex_invoke (param $cb i32) (param $ctx i32) (param $ret_addr i32)
    (call $d3d_enum_format_begin (local.get $cb) (local.get $ctx) (local.get $ret_addr) (i32.const 0)))

  (func $d3d_enum_tex_desc_invoke (param $cb i32) (param $ctx i32) (param $ret_addr i32)
    (call $d3d_enum_format_begin (local.get $cb) (local.get $ctx) (local.get $ret_addr) (i32.const 1)))

  (func $d3d_enum_format_dispatch (param $record i32)
    (local $wa i32) (local $format i32) (local $kind i32) (local $payload i32)
    (local.set $wa (call $g2w (local.get $record)))
    (local.set $format (i32.add (local.get $record) (i32.const 20)))
    (local.set $kind (i32.load offset=12 (local.get $wa)))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then
        (local.set $payload (i32.add (local.get $wa) (i32.const 20)))
        (call $zero_memory (local.get $payload) (i32.const 32))
        (i32.store (local.get $payload) (i32.const 32))
        (i32.store offset=4 (local.get $payload) (i32.const 0x400))
        (i32.store offset=12 (local.get $payload) (i32.const 16))
        (i32.store offset=16 (local.get $payload) (i32.const 0xFFFF)))
      (else
        (if (local.get $kind)
          (then (call $d3d_fill_texture_desc (local.get $format) (i32.load offset=16 (local.get $wa))))
          (else (call $d3d_fill_texture_format (local.get $format) (i32.load offset=16 (local.get $wa)))))))
    (i32.store offset=16 (global.get $reg_base)
      (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base))
      (select (global.get $d3d_enum_zbuf_thunk) (global.get $d3d_enum_tex_thunk)
        (i32.eq (local.get $kind) (i32.const 2))))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $format))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (i32.load offset=4 (local.get $wa)))
    (global.set $eip (i32.load (local.get $wa)))
    (global.set $steps (i32.const 0)))

  (func $d3d_enum_format_continue
    (local $record i32) (local $wa i32) (local $idx i32) (local $ret i32)
    (local.set $record (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $wa (call $g2w (local.get $record)))
    (local.set $idx (i32.add (i32.load offset=16 (local.get $wa)) (i32.const 1)))
    (if (i32.or
          (i32.eq (i32.load offset=12 (local.get $wa)) (i32.const 2))
          (i32.or (i32.eqz (i32.load (global.get $reg_base))) (i32.ge_u (local.get $idx) (i32.const 4))))
      (then
        (local.set $ret (i32.load offset=8 (local.get $wa)))
        (call $heap_free (local.get $record))
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (global.set $eip (local.get $ret))
        (i32.store (global.get $reg_base) (i32.const 0)))
      (else
        (i32.store offset=16 (local.get $wa) (local.get $idx))
        (call $d3d_enum_format_dispatch (local.get $record)))))

  (func $d3d_enum_tex_continue
    (call $d3d_enum_format_continue))

  ;; Fill D3DDEVICEDESC (DX5-style 252-byte layout).
  ;; is_hal=1 sets HWRASTERIZATION + vidmem caps; is_hal=0 is HEL (software).
  (func $fill_d3d_device_desc (param $p i32) (param $is_hal i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $p)))
    (call $zero_memory (local.get $wa) (i32.const 252))
    (i32.store (local.get $wa)                         (i32.const 252))       ;; dwSize
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x7FF))     ;; dwFlags: all v3 fields valid
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (i32.const 2))         ;; dcmColorModel = RGB
    ;; dwDevCaps
    (if (local.get $is_hal)
      (then (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0x8AEA0))) ;; HWRAST|DP2EX|DP2|DPTLV|TEXVID|EXECVID|TLVERTEXVID
      (else (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0x02A50))))  ;; DP2|DPTLV|TEXSYS|EXECSYS|TLVERTEXSYS
    ;; dtcTransformCaps (8 bytes) at +16
    (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 8))
    (i32.store (i32.add (local.get $wa) (i32.const 20)) (i32.const 1))        ;; D3DTRANSFORMCAPS_CLIP
    ;; bClipping at +24
    (i32.store (i32.add (local.get $wa) (i32.const 24)) (i32.const 1))
    ;; dlcLightingCaps (16) at +28
    (i32.store (i32.add (local.get $wa) (i32.const 28)) (i32.const 16))
    (i32.store (i32.add (local.get $wa) (i32.const 32)) (i32.const 7))        ;; POINT|SPOT|DIRECTIONAL
    (i32.store (i32.add (local.get $wa) (i32.const 36)) (i32.const 1))        ;; RGB lighting
    (i32.store (i32.add (local.get $wa) (i32.const 40)) (i32.const 8))        ;; num lights
    ;; dpcLineCaps (56) at +44
    (call $fill_primcaps (i32.add (local.get $p) (i32.const 44)))
    ;; dpcTriCaps (56) at +100
    (call $fill_primcaps (i32.add (local.get $p) (i32.const 100)))
    ;; Tail fields at +156
    (i32.store (i32.add (local.get $wa) (i32.const 156)) (i32.const 0xD00))   ;; DeviceRenderBitDepth = DDBD_8|16|32 (0x800|0x400|0x100)
    (i32.store (i32.add (local.get $wa) (i32.const 160)) (i32.const 0x500))   ;; DeviceZBufferBitDepth = DDBD_16|32
    (i32.store (i32.add (local.get $wa) (i32.const 164)) (i32.const 0))       ;; dwMaxBufferSize
    (i32.store (i32.add (local.get $wa) (i32.const 168)) (i32.const 0xFFFF))  ;; dwMaxVertexCount
    ;; DX5 extensions (+172..)
    (i32.store (i32.add (local.get $wa) (i32.const 172)) (i32.const 1))       ;; dwMinTextureWidth
    (i32.store (i32.add (local.get $wa) (i32.const 176)) (i32.const 1))       ;; dwMinTextureHeight
    (i32.store (i32.add (local.get $wa) (i32.const 180)) (i32.const 2048))    ;; dwMaxTextureWidth
    (i32.store (i32.add (local.get $wa) (i32.const 184)) (i32.const 2048)))   ;; dwMaxTextureHeight

  (func $fill_primcaps (param $p i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $p)))
    (i32.store (local.get $wa)                         (i32.const 56))        ;; dwSize
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x3F))      ;; dwMiscCaps
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (i32.const 0x07FF))    ;; dwRasterCaps
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0xFF))     ;; dwZCmpCaps (all 8)
    (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 0x1FFF))   ;; dwSrcBlendCaps
    (i32.store (i32.add (local.get $wa) (i32.const 20)) (i32.const 0x1FFF))   ;; dwDestBlendCaps
    (i32.store (i32.add (local.get $wa) (i32.const 24)) (i32.const 0xFF))     ;; dwAlphaCmpCaps
    (i32.store (i32.add (local.get $wa) (i32.const 28)) (i32.const 0x1FFFF))  ;; dwShadeCaps
    (i32.store (i32.add (local.get $wa) (i32.const 32)) (i32.const 0xFFFF))   ;; dwTextureCaps
    (i32.store (i32.add (local.get $wa) (i32.const 36)) (i32.const 0xFF))     ;; dwTextureFilterCaps
    (i32.store (i32.add (local.get $wa) (i32.const 40)) (i32.const 0xFFFF))   ;; dwTextureBlendCaps
    (i32.store (i32.add (local.get $wa) (i32.const 44)) (i32.const 0xFF))     ;; dwTextureAddressCaps
    (i32.store (i32.add (local.get $wa) (i32.const 48)) (i32.const 1))        ;; dwStippleWidth
    (i32.store (i32.add (local.get $wa) (i32.const 52)) (i32.const 1)))       ;; dwStippleHeight

  ;; Fill D3DFINDDEVICERESULT enough for legacy D3DRM callers. d3drm.dll uses
  ;; result.guid as the surface QI key when creating an IDirect3DDevice, so a
  ;; zero GUID aliases the surface IUnknown and later dispatches device methods
  ;; through the DDSurface vtable.
  (func $d3d_fill_find_device_result (param $p i32)
    (local $wa i32) (local $sz i32)
    (if (i32.eqz (local.get $p)) (then (return)))
    (local.set $wa (call $g2w (local.get $p)))
    (local.set $sz (i32.load (local.get $wa)))
    (if (i32.lt_u (local.get $sz) (i32.const 20)) (then (return)))
    ;; IID_IDirect3DRGBDevice {A4665C60-2673-11CF-A31A-00AA00B93356}
    (i32.store (i32.add (local.get $wa) (i32.const 4))  (i32.const 0xA4665C60))
    (i32.store (i32.add (local.get $wa) (i32.const 8))  (i32.const 0x11CF2673))
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0xAA001AA3))
    (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 0x5633B900))
    ;; DX5-era D3DFINDDEVICERESULT is 0x1ac bytes: GUID + two 0xcc-byte
    ;; D3DDEVICEDESCs. Populate those when the caller supplied that much room.
    (if (i32.ge_u (local.get $sz) (i32.const 428)) (then
      (call $gs32 (i32.add (local.get $p) (i32.const 20)) (i32.const 204))
      (call $d3dim_fill_device_desc (i32.add (local.get $p) (i32.const 20)))
      (call $gs32 (i32.add (local.get $p) (i32.const 224)) (i32.const 204))
      (call $d3dim_fill_device_desc (i32.add (local.get $p) (i32.const 224))))))

  ;; Compare the legacy fields selected by DDSURFACEDESC.dwFlags. The actual
  ;; descriptor is produced by $dx_fill_surface_desc, the same canonical path
  ;; used by GetSurfaceDesc and the callback itself.
  (func $dd_surface_desc_matches (param $want i32) (param $have i32) (result i32)
    (local $flags i32) (local $i i32)
    (local.set $flags (i32.load offset=4 (local.get $want)))
    ;; DDSD_CAPS: every requested capability must be present; extra actual
    ;; capabilities do not make a surface cease to match the request.
    (if (i32.and (local.get $flags) (i32.const 0x1)) (then
      (if (i32.ne
            (i32.and (i32.load offset=104 (local.get $have))
                     (i32.load offset=104 (local.get $want)))
            (i32.load offset=104 (local.get $want)))
        (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x2)) (then
      (if (i32.ne (i32.load offset=8 (local.get $want))
                  (i32.load offset=8 (local.get $have))) (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x4)) (then
      (if (i32.ne (i32.load offset=12 (local.get $want))
                  (i32.load offset=12 (local.get $have))) (then (return (i32.const 0))))))
    ;; PITCH and LINEARSIZE alias the same field in DDSURFACEDESC.
    (if (i32.and (local.get $flags) (i32.const 0x80008)) (then
      (if (i32.ne (i32.load offset=16 (local.get $want))
                  (i32.load offset=16 (local.get $have))) (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x20)) (then
      (if (i32.ne (i32.load offset=20 (local.get $want))
                  (i32.load offset=20 (local.get $have))) (then (return (i32.const 0))))))
    ;; MIPMAPCOUNT, ZBUFFERBITDEPTH and REFRESHRATE alias offset 24.
    (if (i32.and (local.get $flags) (i32.const 0x60040)) (then
      (if (i32.ne (i32.load offset=24 (local.get $want))
                  (i32.load offset=24 (local.get $have))) (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x80)) (then
      (if (i32.ne (i32.load offset=28 (local.get $want))
                  (i32.load offset=28 (local.get $have))) (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x800)) (then
      (if (i32.ne (i32.load offset=36 (local.get $want))
                  (i32.load offset=36 (local.get $have))) (then (return (i32.const 0))))))
    ;; The four color keys occupy offsets 40..71 and have one DDSD bit each.
    (if (i32.and (local.get $flags) (i32.const 0x2000)) (then
      (if (i32.or
            (i32.ne (i32.load offset=40 (local.get $want))
                    (i32.load offset=40 (local.get $have)))
            (i32.ne (i32.load offset=44 (local.get $want))
                    (i32.load offset=44 (local.get $have))))
        (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x4000)) (then
      (if (i32.or
            (i32.ne (i32.load offset=48 (local.get $want))
                    (i32.load offset=48 (local.get $have)))
            (i32.ne (i32.load offset=52 (local.get $want))
                    (i32.load offset=52 (local.get $have))))
        (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x8000)) (then
      (if (i32.or
            (i32.ne (i32.load offset=56 (local.get $want))
                    (i32.load offset=56 (local.get $have)))
            (i32.ne (i32.load offset=60 (local.get $want))
                    (i32.load offset=60 (local.get $have))))
        (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x10000)) (then
      (if (i32.or
            (i32.ne (i32.load offset=64 (local.get $want))
                    (i32.load offset=64 (local.get $have)))
            (i32.ne (i32.load offset=68 (local.get $want))
                    (i32.load offset=68 (local.get $have))))
        (then (return (i32.const 0))))))
    (if (i32.and (local.get $flags) (i32.const 0x1000)) (then
      (local.set $i (i32.const 0))
      (block $pf_done (loop $pf
        (br_if $pf_done (i32.ge_u (local.get $i) (i32.const 8)))
        (if (i32.ne
              (i32.load (i32.add (local.get $want)
                (i32.add (i32.const 72) (i32.shl (local.get $i) (i32.const 2)))))
              (i32.load (i32.add (local.get $have)
                (i32.add (i32.const 72) (i32.shl (local.get $i) (i32.const 2))))))
          (then (return (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $pf)))))
    (i32.const 1))

  ;; Stack-resident enumeration state. Callback stdcall cleanup leaves ESP on
  ;; the DDES magic, allowing CACA0007 to distinguish this reentrant iterator
  ;; from its older one-shot DirectDraw callbacks.
  ;;   +0 magic, +4 caller return, +8 callback, +12 context
  ;;   +16 owner slot+1, +20 flags, +24 next slot
  ;;   +32 requested DDSURFACEDESC, +140 callback DDSURFACEDESC; 256 bytes.
  (func $dd_enum_surfaces_finish
    (global.set $eip (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 256)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $dd_enum_surfaces_invoke (param $frame i32) (param $surface i32)
    (local $frame_wa i32)
    (local.set $frame_wa (call $g2w (local.get $frame)))
    ;; Callback(surface, descriptor, context), right-to-left under stdcall.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $frame) (i32.const 16)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $ddenum_ret_thunk))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $surface))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))
      (i32.add (local.get $frame) (i32.const 140)))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))
      (i32.load offset=12 (local.get $frame_wa)))
    (global.set $eip (i32.load offset=8 (local.get $frame_wa)))
    (global.set $steps (i32.const 0)))

  ;; CANBECREATED owns the temporary surface's initial reference. A callback
  ;; may AddRef it to retain the object; after the callback, release only our
  ;; reference. Be defensive if guest callback code already released it.
  (func $dd_enum_surfaces_drop_temp (param $frame i32)
    (local $frame_wa i32) (local $surface i32) (local $entry i32)
    (local.set $frame_wa (call $g2w (local.get $frame)))
    (local.set $surface (i32.load offset=248 (local.get $frame_wa)))
    (if (i32.eqz (local.get $surface)) (then (return)))
    (local.set $entry (call $dx_from_this (local.get $surface)))
    (if (i32.and
          (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 2))
          (i32.eq (i32.load (call $dx_surf_owner_ptr (local.get $entry)))
            (i32.load offset=16 (local.get $frame_wa))))
      (then
        (i32.store offset=16 (global.get $reg_base) (local.get $frame))
        (call $handle_IDirectDrawSurface_Release
          (local.get $surface) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (local.get $frame)))))

  (func $dd_enum_surfaces_continue
    (local $frame i32) (local $frame_wa i32) (local $slot i32)
    (local $entry i32) (local $selected i32) (local $matches i32)
    (local $surface i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (local.set $frame_wa (call $g2w (local.get $frame)))
    ;; CANBECREATED enumerates only the first temporary match. The callback's
    ;; return value does not change its one-shot lifecycle.
    (if (i32.and (i32.load offset=20 (local.get $frame_wa)) (i32.const 0x8))
      (then
        (call $dd_enum_surfaces_drop_temp (local.get $frame))
        (call $dd_enum_surfaces_finish)
        (return)))
    ;; DDENUMRET_CANCEL is zero. The reference passed to the just-finished
    ;; callback remains the caller's to Release, exactly as Microsoft documents.
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $dd_enum_surfaces_finish) (return)))
    (local.set $slot (i32.load offset=24 (local.get $frame_wa)))
    (local.set $selected (i32.const -1))
    (call $lock_acquire (global.get $LOCK_DX))
    (block $scan_done (loop $scan
      (br_if $scan_done (i32.ge_u (local.get $slot) (global.get $DX_MAX)))
      (local.set $entry (i32.add (global.get $DX_OBJECTS)
        (i32.shl (local.get $slot) (i32.const 5))))
      (i32.store offset=24 (local.get $frame_wa)
        (i32.add (local.get $slot) (i32.const 1)))
      (if (i32.and
            (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 2))
            (i32.eq (i32.load (call $dx_surf_owner_ptr (local.get $entry)))
              (i32.load offset=16 (local.get $frame_wa))))
        (then
          (call $dx_fill_surface_desc
            (i32.add (local.get $frame_wa) (i32.const 140)) (local.get $entry))
          (local.set $matches
            (call $dd_surface_desc_matches
              (i32.add (local.get $frame_wa) (i32.const 32))
              (i32.add (local.get $frame_wa) (i32.const 140))))
          (if (i32.or
                (i32.ne
                  (i32.and (i32.load offset=20 (local.get $frame_wa)) (i32.const 1))
                  (i32.const 0))
                (i32.or
                  (i32.and
                    (i32.ne
                      (i32.and (i32.load offset=20 (local.get $frame_wa)) (i32.const 2))
                      (i32.const 0))
                    (local.get $matches))
                  (i32.and
                    (i32.ne
                      (i32.and (i32.load offset=20 (local.get $frame_wa)) (i32.const 4))
                      (i32.const 0))
                    (i32.eqz (local.get $matches)))))
            (then
              ;; DOESEXIST gives the callback a new owned reference.
              (store.field.memarg DxObject refcount (local.get $entry) (i32.add (load.field.memarg DxObject refcount (local.get $entry)) (i32.const 1)))
              (local.set $selected (local.get $slot))
              (br $scan_done)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (call $lock_release (global.get $LOCK_DX))
    (if (i32.eq (local.get $selected) (i32.const -1))
      (then (call $dd_enum_surfaces_finish) (return)))
    (local.set $surface (call $w2g
      (i32.add (global.get $COM_WRAPPERS)
        (i32.shl (local.get $selected) (i32.const 3)))))
    (call $dd_enum_surfaces_invoke (local.get $frame) (local.get $surface)))

  ;; EnumSurfaces(this, flags, descriptor, context, callback).
  (func $handle_IDirectDraw_EnumSurfaces (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $ret i32) (local $frame i32) (local $frame_wa i32)
    (local $search i32) (local $match i32)
    (local $create_result i32) (local $temp i32) (local $saved_primary i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $search (i32.and (local.get $arg1) (i32.const 0x18)))
    (local.set $match (i32.and (local.get $arg1) (i32.const 0x7)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) (return))) ;; DDERR_INVALIDOBJECT
    (if (i32.eqz (local.get $arg4))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return))) ;; DDERR_INVALIDPARAMS
    (if (i32.ne (i32.and (local.get $arg1) (i32.const -32)) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (if (i32.and
          (i32.ne (local.get $search) (i32.const 0x8))
          (i32.ne (local.get $search) (i32.const 0x10)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (if (i32.and
          (i32.ne (local.get $match) (i32.const 0x1))
          (i32.and (i32.ne (local.get $match) (i32.const 0x2))
                   (i32.ne (local.get $match) (i32.const 0x4))))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (if (i32.and (i32.eq (local.get $search) (i32.const 0x8))
                 (i32.ne (local.get $match) (i32.const 0x2)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (if (i32.and (i32.ne (local.get $match) (i32.const 0x1))
                 (i32.eqz (local.get $arg2)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (if (i32.and (i32.ne (local.get $arg2) (i32.const 0))
          (i32.lt_u (call $gl32 (local.get $arg2)) (i32.const 108)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $frame (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 256)))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (local.set $frame_wa (call $g2w (local.get $frame)))
    (call $zero_memory (local.get $frame_wa) (i32.const 256))
    (i32.store (local.get $frame_wa) (i32.const 0x53454444)) ;; "DDES"
    (i32.store offset=4 (local.get $frame_wa) (local.get $ret))
    (i32.store offset=8 (local.get $frame_wa) (local.get $arg4))
    (i32.store offset=12 (local.get $frame_wa) (local.get $arg3))
    (i32.store offset=16 (local.get $frame_wa)
      (i32.add (call $dx_slot_of (local.get $entry)) (i32.const 1)))
    (i32.store offset=20 (local.get $frame_wa) (local.get $arg1))
    (if (local.get $arg2)
      (then (call $memcpy (i32.add (local.get $frame_wa) (i32.const 32))
        (call $g2w (local.get $arg2)) (i32.const 108))))
    (if (i32.eq (local.get $search) (i32.const 0x8))
      (then
        ;; Microsoft's contract describes a temporary creation attempt. Use
        ;; the real CreateSurface path so callback code receives a usable COM
        ;; object, but restore the prior primary selection immediately: this
        ;; probe must not replace the application's display surface.
        (local.set $saved_primary (global.get $dx_primary_wa))
        (i32.store offset=16 (global.get $reg_base) (local.get $frame))
        (call $handle_IDirectDraw_CreateSurface
          (local.get $arg0)
          (i32.add (local.get $frame) (i32.const 32))
          (i32.add (local.get $frame) (i32.const 248))
          (i32.const 0) (i32.const 0) (i32.const 0))
        (local.set $create_result (i32.load offset=0 (global.get $reg_base)))
        (global.set $dx_primary_wa (local.get $saved_primary))
        (i32.store offset=16 (global.get $reg_base) (local.get $frame))
        (local.set $temp (i32.load offset=248 (local.get $frame_wa)))
        ;; A description that cannot be created is a successful empty search,
        ;; not the old unconditional success that skipped every valid callback.
        (if (i32.or (local.get $create_result) (i32.eqz (local.get $temp)))
          (then
            (call $dd_enum_surfaces_drop_temp (local.get $frame))
            (call $dd_enum_surfaces_finish)
            (return)))
        (local.set $entry (call $dx_from_this (local.get $temp)))
        (call $dx_fill_surface_desc
          (i32.add (local.get $frame_wa) (i32.const 140)) (local.get $entry))
        (call $dd_enum_surfaces_invoke (local.get $frame) (local.get $temp))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)) ;; initial dispatch is not cancellation
    (call $dd_enum_surfaces_continue))

  ;; FlipToGDISurface — no-op
  (func $handle_IDirectDraw_FlipToGDISurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; GetCaps(this, lpDDDriverCaps, lpDDHELCaps)
  (func $handle_IDirectDraw_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $sz i32)
    ;; Fill driver caps if requested. CRITICAL: respect caller's dwSize —
    ;; DDraw v1 = 316, DDraw v5 = 380. Writing past it clobbers the caller's
    ;; stack frame (and return address). Read dwSize from [arg1], clamp.
    (if (local.get $arg1) (then
      (local.set $wa (call $g2w (local.get $arg1)))
      (local.set $sz (i32.load (local.get $wa)))
      (if (i32.or (i32.lt_u (local.get $sz) (i32.const 16))
                  (i32.gt_u (local.get $sz) (i32.const 380)))
        (then (local.set $sz (i32.const 380))))
      (call $zero_memory (local.get $wa) (local.get $sz))
      (i32.store (local.get $wa) (local.get $sz)) ;; preserve dwSize
      ;; dwCaps = DDCAPS_3D | DDCAPS_BLT | DDCAPS_BLTCOLORFILL | DDCAPS_COLORKEY.
      ;; DDCAPS_3D (bit 0) is required — MCM's acceptability gate at 0x00465441
      ;; tests `[DDCAPS.dwCaps] & 1` to decide whether the driver offers 3D.
      (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x24041))
      ;; dwCaps2 = DDCAPS2_CANRENDERWINDOWED: every D3D device here draws
      ;; into a window's canvas. Deus Ex's D3DDrv reads this bit and, without
      ;; it, refuses a -windowed viewport ("D3D Device: Fullscreen only").
      ;; | DDCAPS2_PRIMARYGAMMA (0x20000): IDirectDrawGammaControl's ramp is
      ;; applied when the primary is presented (lib/gamma-lut.js). Without it
      ;; D3DDrv logs "Gamma control not available" and its frame is darker
      ;; than the same scene through SoftDrv.
      (if (i32.gt_u (local.get $sz) (i32.const 8))
        (then (i32.store (i32.add (local.get $wa) (i32.const 8)) (i32.const 0xA0000))))
      ;; dwZBufferBitDepths = DDBD_16 (0x400) — MCM checks
      (if (i32.gt_u (local.get $sz) (i32.const 0x38))
        (then (i32.store (i32.add (local.get $wa) (i32.const 0x38)) (i32.const 0x400))))
      ;; dwVidMemTotal / dwVidMemFree — MCM caches [caps+0x3c] as budget
      (if (i32.gt_u (local.get $sz) (i32.const 0x3c))
        (then (i32.store (i32.add (local.get $wa) (i32.const 0x3c)) (global.get $DX_VIDMEM_TOTAL))))
      (if (i32.gt_u (local.get $sz) (i32.const 0x40))
        (then (i32.store (i32.add (local.get $wa) (i32.const 0x40)) (global.get $DX_VIDMEM_TOTAL))))))
    ;; Same for HEL caps
    (if (local.get $arg2) (then
      (local.set $wa (call $g2w (local.get $arg2)))
      (local.set $sz (i32.load (local.get $wa)))
      (if (i32.or (i32.lt_u (local.get $sz) (i32.const 16))
                  (i32.gt_u (local.get $sz) (i32.const 380)))
        (then (local.set $sz (i32.const 380))))
      (call $zero_memory (local.get $wa) (local.get $sz))
      (i32.store (local.get $wa) (local.get $sz))
      (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x24041))
      (if (i32.gt_u (local.get $sz) (i32.const 0x38))
        (then (i32.store (i32.add (local.get $wa) (i32.const 0x38)) (i32.const 0x400))))
      (if (i32.gt_u (local.get $sz) (i32.const 0x3c))
        (then (i32.store (i32.add (local.get $wa) (i32.const 0x3c)) (global.get $DX_VIDMEM_TOTAL))))
      (if (i32.gt_u (local.get $sz) (i32.const 0x40))
        (then (i32.store (i32.add (local.get $wa) (i32.const 0x40)) (global.get $DX_VIDMEM_TOTAL))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetDisplayMode(this, lpDDSD) — return current display mode
  (func $handle_IDirectDraw_GetDisplayMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (call $zero_memory (local.get $wa) (i32.const 108))
    (i32.store (local.get $wa) (i32.const 108))
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x1006))
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (call $dx_display_h_get))
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (call $dx_display_w_get))
    ;; Pitch and pixel format follow the mode's depth. This used to report a
    ;; 16bpp 5-6-5 mode with a width*2 pitch whatever SetDisplayMode chose;
    ;; Disciples sizes its 640x480x8 back buffer from these fields.
    (i32.store (i32.add (local.get $wa) (i32.const 16))
      (i32.and
        (i32.add
          (i32.mul (call $dx_display_w_get)
            (i32.shr_u (i32.add (call $dx_display_bpp_get) (i32.const 7)) (i32.const 3)))
          (i32.const 3))
        (i32.const 0xFFFFFFFC)))
    (call $dx_fill_pixel_format (i32.add (local.get $wa) (i32.const 72))
      (call $dx_display_bpp_get))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetFourCCCodes — return 0 codes
  (func $handle_IDirectDraw_GetFourCCCodes (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetGDISurface — stub
  (func $handle_IDirectDraw_GetGDISurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; GetMonitorFrequency(this, lpdwFreq)
  (func $handle_IDirectDraw_GetMonitorFrequency (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gs32 (local.get $arg1) (i32.const 60))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; ---- the 60 Hz vblank model ------------------------------------------
  ;; See the block comment on $vblank_counter in src/01-header.wat for why
  ;; the browser and the CLI drive this from different clocks.

  ;; Position within the current 1/60 s period, in thousandths (0..999).
  ;; now*60/1000 is the period index and the remainder is the phase, which
  ;; makes both of these exact integer arithmetic with no accumulated drift.
  ;; i64 because now*60 leaves the i32 range about 10 hours into a run.
  (func $vblank_phase_1k (param $now i32) (result i32)
    (i32.wrap_i64 (i64.rem_u
      (i64.mul (i64.extend_i32_u (local.get $now)) (i64.const 60))
      (i64.const 1000))))

  ;; The next 1/60 s boundary at or after `now`, as a guest millisecond.
  (func $vblank_next_boundary (param $now i32) (result i32)
    (local $period i64)
    (local.set $period (i64.add
      (i64.div_u (i64.mul (i64.extend_i32_u (local.get $now)) (i64.const 60))
                 (i64.const 1000))
      (i64.const 1)))
    (i32.wrap_i64 (i64.div_u
      (i64.add (i64.mul (local.get $period) (i64.const 1000)) (i64.const 59))
      (i64.const 60))))

  ;; A 525-line VGA-style frame: 480 visible, the rest is the blanking
  ;; interval. That is where GetScanLine's value and GetVerticalBlankStatus's
  ;; ~8% duty cycle both come from, so the two can never disagree.
  (func $vblank_scanline (param $now i32) (result i32)
    (i32.div_u (i32.mul (call $vblank_phase_1k (local.get $now)) (i32.const 525))
               (i32.const 1000)))

  (func $vblank_in_blank (param $now i32) (result i32)
    (i32.ge_u (call $vblank_scanline (local.get $now)) (i32.const 480)))

  ;; Park the calling API on the next vblank. Same contract as $io_block: the
  ;; stdcall frame is left untouched, EIP is put back on the thunk rather than
  ;; on the block that called it, and $handler_set_eip opts out of $run's
  ;; thunk-zone auto-pop -- without it the call would be spliced out entirely
  ;; and the guest would resume past its own WaitForVerticalBlank with the
  ;; arguments still on the stack. The host clears the yield when the display
  ;; says so, and the very same handler re-runs and re-tests.
  (func $vblank_block
    (global.set $handler_set_eip (i32.const 1))
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $yield_reason (i32.const 13))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; Has the vblank this call parked for happened yet? Arms the park on first
  ;; entry, so callers only ask this question.
  ;;
  ;; Wrap-safe: tick counts are unsigned and roll over, so deadlines are
  ;; compared as a signed difference rather than with ge_u.
  (func $vblank_wait_elapsed (result i32)
    (local $now i32)
    (local.set $now (call $host_get_ticks))
    (if (i32.eqz (global.get $vblank_wait_active))
      (then
        (global.set $vblank_wait_active (i32.const 1))
        (global.set $vblank_wait_counter (global.get $vblank_counter))
        (global.set $vblank_deadline_ms (call $vblank_next_boundary (local.get $now)))))
    (if (global.get $vblank_host_driven)
      (then
        ;; A real display tick ends the wait. The deadline is only the escape
        ;; hatch for a page that stopped getting rAF callbacks at all (hidden
        ;; tab, display asleep) -- 50 ms past the boundary is three refreshes,
        ;; far outside any jitter a live compositor produces.
        (return (i32.or
          (i32.ne (global.get $vblank_counter) (global.get $vblank_wait_counter))
          (i32.ge_s
            (i32.sub (local.get $now)
              (i32.add (global.get $vblank_deadline_ms) (i32.const 50)))
            (i32.const 0))))))
    (i32.ge_s (i32.sub (local.get $now) (global.get $vblank_deadline_ms)) (i32.const 0)))

  ;; GetScanLine(this, lpdwScanLine) — sweeps 0..524 across each period.
  ;; Real DirectDraw answers DDERR_VERTICALBLANKINPROGRESS while the beam is
  ;; retracing; we deliberately do not, because an app that loops until this
  ;; succeeds would then be gated on our clock granularity rather than on the
  ;; value it asked for. The line number already tells it what it needs.
  (func $handle_IDirectDraw_GetScanLine (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (call $vblank_scanline (call $host_get_ticks)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetVerticalBlankStatus(this, lpbIsInVB) — the real ~8% duty cycle. This
  ;; used to answer TRUE unconditionally, which makes "spin until vblank"
  ;; return instantly and "spin until NOT vblank" never return at all.
  (func $handle_IDirectDraw_GetVerticalBlankStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (call $vblank_in_blank (call $host_get_ticks)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; ---- present pacing -----------------------------------------------------
  ;; A game loop with no limiter of its own presents as fast as the machine
  ;; allows, and a display shows at most its refresh: everything past that is
  ;; guest work nobody sees, on the thread the page, the audio and the other
  ;; guest threads also need. $present_pace caps explicit frame ends at
  ;; $present_cap per second.
  ;;
  ;; It is a rate cap, not vsync. The deadline is one period after the
  ;; previous frame's, wherever that falls; a frame that arrives before it
  ;; sleeps out the rest, and a frame that arrives after it passes untouched.
  ;; So a loop slower than the cap is never slowed, and a frame that runs a
  ;; little long costs a little -- not the whole extra refresh that a
  ;; boundary-aligned wait costs (Moorhuhn 2 on a vsync'd Flip fell from ~75
  ;; to ~31 fps).
  ;;
  ;; Time is kept in units of ms*cap, where one period is exactly 1000, so a
  ;; 60 Hz cadence carries no rounding drift. A late frame may pull the next
  ;; one in by at most one period: the deadline never trails `now` by more,
  ;; so a stall is followed by one catch-up frame, not a burst of them.
  ;;
  ;; The wait is an ordinary Sleep taken after the present has completed --
  ;; every host already honours that on every thread -- so the frame is shown
  ;; at once and it is the NEXT frame's work that starts at the deadline. Call
  ;; it only from a path that completes the present; a handler that parks and
  ;; re-runs would pace twice.
  (global $present_cap (mut i32) (i32.const 0))          ;; frames/s, 0 = off
  (global $present_deadline_u (mut i64) (i64.const 0))  ;; ms*cap, 0 = unarmed
  (global $present_paced_ms (mut i32) (i32.const 0))    ;; total ms slept
  (global $present_paced_count (mut i32) (i32.const 0)) ;; frames that slept
  (global $present_lock_whole (mut i32) (i32.const 0))  ;; primary entry under a NULL-rect Lock

  ;; Which rule decides the wait: 1 = smooth (the default), 0 = deadline.
  (global $present_pace_mode (mut i32) (i32.const 1))
  ;; Smooth-mode state. The delay is a controller output in microseconds; the
  ;; previous frame end is in guest ms (0 = unarmed); the dither carries the
  ;; sub-millisecond remainder so the ms-granular Sleep averages to it.
  (global $present_smooth_delay_us (mut i32) (i32.const 0))
  (global $present_smooth_prev_ms (mut i32) (i32.const 0))
  (global $present_smooth_armed (mut i32) (i32.const 0))
  (global $present_smooth_dither_us (mut i32) (i32.const 0))
  ;; Schedule error in us, sum of (period - interval), held to +-one period:
  ;; > 0 ahead of the cap's schedule, < 0 behind it.
  (global $present_smooth_debt_us (mut i32) (i32.const 0))

  (func $present_set_cap (param $cap i32)
    (global.set $present_cap
      (select (i32.const 0) (local.get $cap) (i32.lt_s (local.get $cap) (i32.const 0))))
    (global.set $present_deadline_u (i64.const 0))
    (global.set $present_smooth_delay_us (i32.const 0))
    (global.set $present_smooth_armed (i32.const 0))
    (global.set $present_smooth_dither_us (i32.const 0))
    (global.set $present_smooth_debt_us (i32.const 0)))

  (func $present_set_pace_mode (param $mode i32)
    (global.set $present_pace_mode (i32.ne (local.get $mode) (i32.const 0)))
    (call $present_set_cap (global.get $present_cap)))

  ;; Hand the host the paced frame end (dx_trace kind 30): the wait asked
  ;; for, the guest ms it was decided at, the mode, and the smooth delay. One
  ;; JS call per frame, only while a cap is on, for the interval tools
  ;; (run.js --frame-stats, WinePerf.pacedFrames) -- a present count cannot
  ;; stand in for it, since some apps present twice per frame.
  (func $present_pace_note (param $wait i32) (param $now i32)
    (call $host_dx_trace (i32.const 30) (local.get $wait) (local.get $now)
      (global.get $present_pace_mode) (global.get $present_smooth_delay_us)))

  ;; Ask the host for a slice-yielding Sleep of $wait ms after this present.
  (func $present_pace_sleep (param $wait i32)
    (global.set $yield_flag (i32.const 1))
    (global.set $sleep_yielded (i32.const 1))
    (global.set $sleep_timeout (local.get $wait))
    (global.set $present_paced_ms
      (i32.add (global.get $present_paced_ms) (local.get $wait)))
    (global.set $present_paced_count
      (i32.add (global.get $present_paced_count) (i32.const 1))))

  (func $present_pace
    (if (i32.eqz (global.get $present_cap)) (then (return)))
    (if (global.get $present_pace_mode)
      (then (call $present_pace_smooth))
      (else (call $present_pace_deadline))))

  ;; ---- smooth mode ----------------------------------------------------------
  ;; The deadline rule is bang-bang: a frame that arrives early sleeps out the
  ;; WHOLE remainder, one that arrives late sleeps nothing, and the frame after
  ;; a late one (or after a frame whose work swung short) can sleep most of a
  ;; period in one go -- one visibly long frame between short ones.
  ;;
  ;; Smooth mode instead keeps ONE delay, slept after every frame, and nudges
  ;; it toward whatever keeps the frames on the cap's schedule:
  ;;
  ;;   err   = period - interval                    (this frame's rate error)
  ;;   debt  = clamp(debt + err, -2 periods, +2 periods)  (schedule error)
  ;;   delay += clamp(err/8 + debt/16, -STEP, +STEP), delay kept in [0, period]
  ;;
  ;; A PI controller on the rate: the err term follows the work, the debt term
  ;; is what makes the long-run average land ON the cap. Without it the STEP
  ;; clamp is asymmetric in effect -- a 50 ms overrun is -33 ms of error but
  ;; moves the delay by only -STEP -- and the rate settles under the cap
  ;; (dx_tunnel, whose D3D frames spike 6 -> 53 ms: 49.6/s at cap 60).
  ;; The clamp is what the user asked for: no frame's wait differs from the one
  ;; before it by more than STEP (1.5 ms), so a work spike or an overrun changes
  ;; the cadence by a little on each of several frames instead of a lot on one.
  ;; Debt is held to two periods: an overrun is repaid by at most that much in
  ;; all, spread over several slightly short frames (each wait still moves by
  ;; <= STEP), so there is no catch-up burst -- the deadline rule instead
  ;; repays its one-period carry with back-to-back unslept frames. With one
  ;; period the slower repayment left smooth mode ~3% under deadline's rate on
  ;; spiky work; gains 1/8, 1/16 are the fastest pair that does not overshoot
  ;; on the scenarios in test/test-present-pace-modes.js. A stall (a
  ;; gap over a second, or a clock that ran backwards) re-arms without touching
  ;; the delay or the debt. The sub-ms part of the delay is dithered across
  ;; frames, because a guest Sleep is whole milliseconds.
  (func $present_pace_smooth
    (local $now i32) (local $iv_us i32) (local $period_us i32) (local $err i32)
    (local $d i32) (local $wait i32) (local $debt i32) (local $bound i32)
    (local.set $now (call $host_get_ticks))
    (local.set $period_us (i32.div_u (i32.const 1000000) (global.get $present_cap)))
    (local.set $d (global.get $present_smooth_delay_us))
    (if (i32.and (i32.ne (global.get $present_smooth_armed) (i32.const 0))
                 (i32.le_u (i32.sub (local.get $now) (global.get $present_smooth_prev_ms))
                           (i32.const 1000)))
      (then
        (local.set $iv_us (i32.mul (i32.sub (local.get $now)
          (global.get $present_smooth_prev_ms)) (i32.const 1000)))
        (local.set $err (i32.sub (local.get $period_us) (local.get $iv_us)))
        (local.set $debt (i32.add (global.get $present_smooth_debt_us) (local.get $err)))
        (local.set $bound (i32.shl (local.get $period_us) (i32.const 1)))
        (if (i32.gt_s (local.get $debt) (local.get $bound)) (then (local.set $debt (local.get $bound))))
        (if (i32.lt_s (local.get $debt) (i32.sub (i32.const 0) (local.get $bound)))
          (then (local.set $debt (i32.sub (i32.const 0) (local.get $bound)))))
        (global.set $present_smooth_debt_us (local.get $debt))
        (local.set $err (i32.add (i32.shr_s (local.get $err) (i32.const 3))
          (i32.shr_s (local.get $debt) (i32.const 4))))
        (if (i32.gt_s (local.get $err) (i32.const 1500)) (then (local.set $err (i32.const 1500))))
        (if (i32.lt_s (local.get $err) (i32.const -1500)) (then (local.set $err (i32.const -1500))))
        (local.set $d (i32.add (local.get $d) (local.get $err)))
        (if (i32.lt_s (local.get $d) (i32.const 0)) (then (local.set $d (i32.const 0))))
        (if (i32.gt_s (local.get $d) (local.get $period_us)) (then (local.set $d (local.get $period_us))))
        (global.set $present_smooth_delay_us (local.get $d))))
    (global.set $present_smooth_armed (i32.const 1))
    (global.set $present_smooth_dither_us
      (i32.add (global.get $present_smooth_dither_us) (local.get $d)))
    (local.set $wait (i32.div_u (global.get $present_smooth_dither_us) (i32.const 1000)))
    (global.set $present_smooth_dither_us
      (i32.sub (global.get $present_smooth_dither_us) (i32.mul (local.get $wait) (i32.const 1000))))
    ;; The next interval is measured from here, and it includes the sleep.
    (global.set $present_smooth_prev_ms (local.get $now))
    (call $present_pace_note (local.get $wait) (local.get $now))
    (if (local.get $wait) (then (call $present_pace_sleep (local.get $wait)))))

  (func $present_pace_deadline
    (local $cap i64) (local $now_u i64) (local $ahead_u i64) (local $wait i32) (local $now i32)
    (local.set $cap (i64.extend_i32_u (global.get $present_cap)))
    (local.set $now (call $host_get_ticks))
    (local.set $now_u (i64.mul (i64.extend_i32_u (local.get $now)) (local.get $cap)))
    (local.set $ahead_u (i64.sub (global.get $present_deadline_u) (local.get $now_u)))
    ;; First frame, or a deadline more than two periods out (a clock that
    ;; stepped backwards, a cap just lowered): re-arm from now, never sleep
    ;; toward a deadline the guest did not earn.
    (if (i32.or (i64.eqz (global.get $present_deadline_u))
                (i64.gt_s (local.get $ahead_u) (i64.const 2000)))
      (then
        (global.set $present_deadline_u (i64.add (local.get $now_u) (i64.const 1000)))
        (call $present_pace_note (i32.const 0) (local.get $now))
        (return)))
    (if (i64.gt_s (local.get $ahead_u) (i64.const 0))
      (then
        ;; Early: sleep to the deadline (rounded up to whole ms), and the
        ;; next deadline is exactly one period on.
        (local.set $wait (i32.wrap_i64 (i64.div_u
          (i64.add (local.get $ahead_u) (i64.sub (local.get $cap) (i64.const 1)))
          (local.get $cap))))
        (call $present_pace_note (local.get $wait) (local.get $now))
        (call $present_pace_sleep (local.get $wait))
        (global.set $present_deadline_u
          (i64.add (global.get $present_deadline_u) (i64.const 1000))))
      (else
        (call $present_pace_note (i32.const 0) (local.get $now))
        ;; Late: no wait. Carry at most one period of the lateness forward.
        (global.set $present_deadline_u (i64.add (i64.const 1000)
          (select (global.get $present_deadline_u)
                  (i64.sub (local.get $now_u) (i64.const 1000))
                  (i64.gt_s (global.get $present_deadline_u)
                            (i64.sub (local.get $now_u) (i64.const 1000)))))))))

  ;; ---- which events are frame ends ----------------------------------------
  ;; Every present site calls $present_frame_end, never $present_pace. A
  ;; detected frame end is not always a logical frame. Fallout draws straight
  ;; into its only surface, the primary. Each dirty rect it copies is a
  ;; NULL-rect Lock, a memcpy and an Unlock (Falldemo.exe 0x489668), and one
  ;; turn of its main loop copies five of them between two PeekMessage calls.
  ;; Pacing every Unlock sleeps five periods per game frame, and the walk
  ;; took 1.6x longer at cap 60 (docs/re-notes/fallout-demo.md).
  ;;
  ;; A Win32 game loop pumps its message queue once per turn, so a frame is
  ;; bounded by the pump: the frame ends between two PeekMessage/GetMessage
  ;; calls are one frame. After a thread has been seen to pump between frame
  ;; ends, a frame end only marks the frame pending, and the pump that follows
  ;; paces it once ($present_pump). Until then, or on a thread that presents
  ;; and never pumps (a render thread, a loading screen), each frame end paces
  ;; at once, as before. For a loop that presents once per pump the cadence is
  ;; the same either way. Per instance, so per guest thread.
  ;;
  ;; The counters feed run.js --present-frames, which reports detected frame
  ;; ends against pump-bounded frames and flags a ratio above 1.
  (global $present_frame_pending (mut i32) (i32.const 0)) ;; a frame end since the last pump
  (global $present_pump_bounded (mut i32) (i32.const 0))  ;; 1 once this thread pumps between frames
  (global $present_frame_ends (mut i32) (i32.const 0))    ;; detected frame ends, capped or not
  (global $present_pump_frames (mut i32) (i32.const 0))   ;; pumps that closed >= 1 frame end

  (func $present_frame_end
    (global.set $present_frame_ends (i32.add (global.get $present_frame_ends) (i32.const 1)))
    (global.set $present_frame_pending (i32.const 1))
    (if (global.get $present_pump_bounded) (then (return)))
    (if (call $logical_frame_owns) (then (return)))
    (call $present_pace))

  ;; Called at the top of PeekMessage/GetMessage. Returns 1 when it parked the
  ;; call for the pace's sleep: the stdcall frame is untouched and EIP is back
  ;; on the thunk ($vblank_block's contract), so the same call runs again after
  ;; the sleep. Its message is read after the sleep, not before it. The frame
  ;; is no longer pending then, so the second run does not pace again.
  (func $present_pump (result i32)
    (local $slept i32)
    (if (i32.eqz (global.get $present_frame_pending)) (then (return (i32.const 0))))
    (global.set $present_frame_pending (i32.const 0))
    (global.set $present_pump_frames (i32.add (global.get $present_pump_frames) (i32.const 1)))
    ;; The first pump after a frame end is when this thread's loop shape is
    ;; learned. That frame was already paced at its end.
    (if (i32.eqz (global.get $present_pump_bounded))
      (then
        (global.set $present_pump_bounded (i32.const 1))
        (return (i32.const 0))))
    ;; The game step paces this thread's frames instead ($th_logical_frame).
    (if (call $logical_frame_owns) (then (return (i32.const 0))))
    (local.set $slept (global.get $sleep_yielded))
    (call $present_pace)
    (if (i32.or (local.get $slept) (i32.eqz (global.get $sleep_yielded)))
      (then (return (i32.const 0))))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $steps (i32.const 0))
    (i32.const 1))

  ;; ---- pacing on the app's own game step ------------------------------------
  ;; A present and a pump are both only proxies for a frame. StarCraft makes
  ;; ~97 presents/s for ~17 displayed frames, and its loop pumps several times
  ;; per game step, so either proxy paces the wrong event. When RE has found
  ;; the function that advances the game one step (lib/apps.js
  ;; perf.logicalFrame.address), the host hands it to this instance and the
  ;; limiter paces exactly once per call of it.
  ;;
  ;; How the step is seen, at no cost to any other block: $decode_block plants
  ;; handler 476 ($th_logical_frame, operand = the address) as the FIRST op of
  ;; the block whose entry EIP is $logical_frame_addr, and nowhere else. Every
  ;; way into a block lands on its first op -- $run's lookup, the $branch_end /
  ;; $jcc_end / $chain_end fast paths, a patched chain slot, an adjacent
  ;; fall-through in an address-ordered run -- so the marker runs on every
  ;; entry whether or not chaining is on. The --count hit counters were the
  ;; old way to see it, and they arm $dbg_any, which turns off chaining AND
  ;; the micro-op tier for the whole run. Three decoder rules keep the address
  ;; a block entry rather than an instruction some other block runs through:
  ;;   - a block being decoded ends just before the address (like a page seam),
  ;;   - $fuse_stop refuses to let a fold swallow it,
  ;;   - the marked block's op index is poisoned, so no whole-block matcher
  ;;     (loop folds, the region/block executors, run extension) rewrites the
  ;;     stream the marker heads.
  ;; The micro-op tier (07d/07e) would otherwise iterate a loop inside
  ;; $uop_run without re-entering threaded code: $uc_form_loop marks the
  ;; address unsupported, so a program never contains it. A head AT the
  ;; address is declined outright; a loop that reaches it (say, calling the
  ;; step) exits there, and the exit resolves the marked block like any other
  ;; transfer. The marker is emitted before the tier's enter op in any case.
  ;;
  ;; Parking. The marker runs before any of the block's instructions, so the
  ;; architectural state is exactly "about to execute the step": $eip is the
  ;; address and nothing of the block has happened. When the pace asks for a
  ;; sleep ($present_pace -> $present_pace_sleep: $yield_flag, $sleep_yielded,
  ;; $sleep_timeout -- the same Sleep every host already honours after a
  ;; present), the handler sets $eip to the address and returns WITHOUT
  ;; dispatching. Every dispatch is a tail call, so that return lands in
  ;; $run's loop with $resume_ip untouched; $run sees $yield_flag and halts,
  ;; the host sleeps the thread, and the next run() looks the block up again.
  ;; $logical_frame_resume holds the address across that gap, so the marker's
  ;; second run lets the step through without counting or pacing it twice.
  ;; (Setting $steps to 0 and dispatching instead would park $ip in
  ;; $resume_ip, and $run consumes that BEFORE it tests $yield_flag: the step
  ;; would run on and the sleep would land somewhere inside it.)
  ;;
  ;; Which thread. The marker is per instance, so each guest thread counts
  ;; its own steps. Once a thread has run the step within the last second of
  ;; guest time, its frame ends and pumps stop pacing ($logical_frame_owns);
  ;; before the first step (menus, loading screens) and after the game stops
  ;; stepping (back at a menu) the pump-bounded rule above applies as before.
  ;; An app without a logical frame never sets the address and nothing here
  ;; runs. $logical_frame_pace = 0 keeps the marker as a free counter
  ;; (run.js --present-frames, the perf HUD) without pacing on it -- the
  ;; `--present-at=pump` A/B arm.
  (global $logical_frame_addr (mut i32) (i32.const 0))    ;; guest EIP of the game step, 0 = off
  (global $logical_frame_pace (mut i32) (i32.const 0))    ;; 1 = the cap paces here
  (global $logical_frame_count (mut i32) (i32.const 0))   ;; steps entered on this thread
  (global $logical_frame_paced (mut i32) (i32.const 0))   ;; steps that slept
  (global $logical_frame_last_ms (mut i32) (i32.const 0)) ;; guest ms of the last step
  (global $logical_frame_seen (mut i32) (i32.const 0))    ;; 1 once this thread stepped
  (global $logical_frame_resume (mut i32) (i32.const 0))  ;; address parked on, 0 = none

  ;; Does the game step own this thread's pacing right now?
  (func $logical_frame_owns (result i32)
    (if (i32.or (i32.eqz (global.get $logical_frame_pace))
                (i32.eqz (global.get $logical_frame_seen)))
      (then (return (i32.const 0))))
    (i32.le_u (i32.sub (call $host_get_ticks) (global.get $logical_frame_last_ms))
              (i32.const 1000)))

  (func $logical_frame_set (param $addr i32) (param $pace i32)
    (global.set $logical_frame_pace (i32.ne (local.get $pace) (i32.const 0)))
    (if (i32.ne (local.get $addr) (global.get $logical_frame_addr))
      (then
        (global.set $logical_frame_addr (local.get $addr))
        (global.set $logical_frame_resume (i32.const 0))
        ;; Already-decoded code has no marker (or a stale one): recycle the
        ;; arena at the next block boundary, which re-decodes everything.
        (global.set $thread_flush_pending (i32.const 1)))))

  (func $th_logical_frame (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $slept i32)
    ;; The second run after a park: the step goes ahead, already paced.
    (if (i32.eq (global.get $logical_frame_resume) (local.get $op))
      (then
        (global.set $logical_frame_resume (i32.const 0))
        (dispatch-next)))
    ;; A stale marker (the address moved, or was switched off, after this
    ;; block was decoded) counts nothing.
    (if (i32.ne (local.get $op) (global.get $logical_frame_addr))
      (then (dispatch-next)))
    (global.set $logical_frame_count
      (i32.add (global.get $logical_frame_count) (i32.const 1)))
    (global.set $logical_frame_seen (i32.const 1))
    (global.set $logical_frame_last_ms (call $host_get_ticks))
    (if (i32.eqz (i32.and (i32.ne (global.get $logical_frame_pace) (i32.const 0))
                          (i32.ne (global.get $present_cap) (i32.const 0))))
      (then (dispatch-next)))
    ;; Did THIS pace ask for a sleep? Read it off the pacer's own counter, not
    ;; off $sleep_yielded: the host clears that flag only when it next checks
    ;; the main thread, so it can still be 1 from the previous park here. On
    ;; StarCraft at cap 15 a flag test missed 124 of 269 step sleeps, which
    ;; then landed at the next $run halt somewhere inside the step instead.
    (local.set $slept (global.get $present_paced_count))
    (call $present_pace)
    ;; No wait due: run on.
    (if (i32.eq (local.get $slept) (global.get $present_paced_count))
      (then (dispatch-next)))
    (global.set $logical_frame_paced
      (i32.add (global.get $logical_frame_paced) (i32.const 1)))
    (global.set $logical_frame_resume (local.get $op))
    (global.set $eip (local.get $op))
    (global.set $steps (i32.const 0)))

  ;; Pace a blit to the primary only when it covers most of the surface: that
  ;; is a back buffer being shown. A sprite drawn straight onto the primary is
  ;; one of many per frame, and pacing each of them would divide the frame
  ;; rate by the sprite count. A windowed primary is screen-sized and its
  ;; back buffer only ever covers the clipper window's client area, so there
  ;; the surface means that area (dx_tunnel: a clipped Blt of the viewport,
  ;; ~350 frames/s uncapped).
  (func $present_pace_full_blit (param $dst_entry i32) (param $w i32) (param $h i32)
    (local $need_w i32) (local $need_h i32) (local $clipper i32) (local $clip_entry i32)
    (local $hwnd i32)
    (local.set $need_w (load.field DxObject width (local.get $dst_entry)))
    (local.set $need_h (load.field DxObject height (local.get $dst_entry)))
    (local.set $clipper (call $dx_surface_clipper_get (local.get $dst_entry)))
    (if (local.get $clipper)
      (then
        (local.set $clip_entry (call $dx_from_this (local.get $clipper)))
        (if (i32.eq (load.field DxObject type (local.get $clip_entry)) (i32.const 10))
          (then (local.set $hwnd (load.field DxObject misc0 (local.get $clip_entry)))))))
    (if (local.get $hwnd)
      (then
        (local.set $need_w (select (call $wnd_client_w_for_clip (local.get $hwnd)) (local.get $need_w)
          (i32.lt_s (call $wnd_client_w_for_clip (local.get $hwnd)) (local.get $need_w))))
        (local.set $need_h (select (call $wnd_client_h_for_clip (local.get $hwnd)) (local.get $need_h)
          (i32.lt_s (call $wnd_client_h_for_clip (local.get $hwnd)) (local.get $need_h))))))
    ;; More than half the area, not all of it: a dirty-rect presenter shows
    ;; the 3D viewport and a small text strip as two blits (dx_tunnel), and
    ;; the strict half means at most one blit per frame can qualify.
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0)) (i32.le_s (local.get $h) (i32.const 0)))
      (then (return)))
    (if (i64.gt_u
          (i64.mul (i64.extend_i32_u (local.get $w)) (i64.extend_i32_u (local.get $h)))
          (i64.shr_u
            (i64.mul (i64.extend_i32_u (local.get $need_w)) (i64.extend_i32_u (local.get $need_h)))
            (i64.const 1)))
      (then (call $present_frame_end))))

  ;; Initialize — no-op
  (func $handle_IDirectDraw_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; RestoreDisplayMode — the surfaces stay as they are, but the mode is no
  ;; longer in effect, so the screen metrics go back to the host window.
  (func $handle_IDirectDraw_RestoreDisplayMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dx_display_mode_set (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; SetCooperativeLevel(this, hwnd, dwFlags) — store the presentation owner.
  (func $handle_IDirectDraw_SetCooperativeLevel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (store.field DxObject misc0 (local.get $entry) (local.get $arg1)) ;; store hwnd
    (call $dx_coop_hwnd_set (local.get $arg1))
    ;; DDSCL_EXCLUSIVE = 0x10 (Diablo passes 0x13 = EXCLUSIVE|FULLSCREEN|
    ;; ALLOWREBOOT). Dropping back to DDSCL_NORMAL clears it again.
    (call $dx_exclusive_set
      (i32.ne (i32.and (local.get $arg2) (i32.const 0x10)) (i32.const 0)))
    ;; Taking the screen exclusively puts the device window on it: real
    ;; DirectDraw sizes that window to the display and brings it forward, so
    ;; an app that never calls ShowWindow itself still shows its frames.
    ;; MechWarrior 3 is one -- it creates its window, goes exclusive,
    ;; and flips; without this the compositor saw no visible top-level window
    ;; at all ("path=normal windows=0") and the presented frames sat in a
    ;; layer nothing drew, so a game running at 240k lit pixels a frame
    ;; showed a bare desktop.
    (if (i32.and
          (i32.ne (i32.and (local.get $arg2) (i32.const 0x10)) (i32.const 0))
          (i32.ge_s (call $wnd_table_find (local.get $arg1)) (i32.const 0)))
      (then
        ;; Do not use the guest WS_VISIBLE bit as a proxy for host visibility.
        ;; SetWindowLong(GWL_STYLE) changes that bit without performing a
        ;; ShowWindow transition; Blitz then enters exclusive mode and expects
        ;; DirectDraw to reveal its device window. Repeating SW_SHOW for an
        ;; already-visible renderer window is harmless and keeps both views in
        ;; sync when the application changed only the guest-side style.
        (drop (call $host_show_window (local.get $arg1) (i32.const 5)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; SetDisplayMode(this, dwWidth, dwHeight, dwBPP, [dwRefreshRate, dwFlags])
  ;; IDirectDraw v1: 4 args (this+3). IDirectDraw2+: 6 args (this+5).
  ;; Method 21 is shared between both vtables, so we disambiguate at call
  ;; time by reading the object's vtable pointer [arg0]. Mispopping 8 bytes
  ;; corrupts ESP and the caller's return chain (see apps/mcm.md MCM-1).
  ;; Default 8bpp palette: 6×6×6 RGB cube (indexes 0..215) + 40-step grayscale ramp
  ;; (216..255). Installed when SetDisplayMode selects a ≤8bpp mode and the app
  ;; hasn't attached its own palette yet — DX samples like ddex1 use GetDC/TextOut
  ;; without calling CreatePalette and would otherwise render black.
  (func $install_default_dx_palette
    (local $pal_guest i32) (local $pal_wa i32) (local $i i32)
    (local $r i32) (local $g i32) (local $b i32) (local $lum i32)
    (if (i32.ne (call $dx_primary_pal_get) (i32.const 0)) (then (return)))
    (local.set $pal_guest (call $heap_alloc (i32.const 1024)))
    (local.set $pal_wa (call $g2w (local.get $pal_guest)))
    (call $zero_memory (local.get $pal_wa) (i32.const 1024))
    ;; Cube: idx = r*36 + g*6 + b, each channel ∈ {0,51,102,153,204,255}
    (local.set $i (i32.const 0))
    (block $cd (loop $cl
      (br_if $cd (i32.ge_u (local.get $i) (i32.const 216)))
      (local.set $r (i32.mul (i32.div_u (local.get $i) (i32.const 36)) (i32.const 51)))
      (local.set $g (i32.mul (i32.rem_u (i32.div_u (local.get $i) (i32.const 6)) (i32.const 6)) (i32.const 51)))
      (local.set $b (i32.mul (i32.rem_u (local.get $i) (i32.const 6)) (i32.const 51)))
      (i32.store8 (i32.add (local.get $pal_wa) (i32.shl (local.get $i) (i32.const 2))) (local.get $r))
      (i32.store8 (i32.add (i32.add (local.get $pal_wa) (i32.shl (local.get $i) (i32.const 2))) (i32.const 1)) (local.get $g))
      (i32.store8 (i32.add (i32.add (local.get $pal_wa) (i32.shl (local.get $i) (i32.const 2))) (i32.const 2)) (local.get $b))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cl)))
    ;; Grayscale ramp for remaining 40 slots
    (local.set $i (i32.const 216))
    (block $gd (loop $gl
      (br_if $gd (i32.ge_u (local.get $i) (i32.const 256)))
      (local.set $lum (i32.div_u (i32.mul (i32.sub (local.get $i) (i32.const 216)) (i32.const 255)) (i32.const 39)))
      (i32.store8 (i32.add (local.get $pal_wa) (i32.shl (local.get $i) (i32.const 2))) (local.get $lum))
      (i32.store8 (i32.add (i32.add (local.get $pal_wa) (i32.shl (local.get $i) (i32.const 2))) (i32.const 1)) (local.get $lum))
      (i32.store8 (i32.add (i32.add (local.get $pal_wa) (i32.shl (local.get $i) (i32.const 2))) (i32.const 2)) (local.get $lum))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $gl)))
    (call $dx_primary_pal_set (local.get $pal_wa)))

  (func $handle_IDirectDraw_SetDisplayMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $vtbl i32) (local $target_hwnd i32) (local $changed i32)
    (local $rect i32) (local $moved i32)
    ;; Windows announces a mode switch only when the mode actually switches:
    ;; asking for the mode that is already current is a no-op and no
    ;; WM_DISPLAYCHANGE goes out. Posting one unconditionally is a live-lock
    ;; for any app whose WM_DISPLAYCHANGE handler re-applies its video mode --
    ;; RollerCoaster Tycoon sets a "reinit display" flag from that message, and
    ;; its next frame tore the whole subsystem down (Release surfaces,
    ;; RestoreDisplayMode, DestroyWindow), rebuilt it, called SetDisplayMode
    ;; with the same 640x480x8, and got the message straight back. It never
    ;; reached its title screen; it just cycled until DX slots and heap ran out.
    ;; The comparison is against the last mode *asked for*, which
    ;; RestoreDisplayMode deliberately leaves in place: an app that restores the
    ;; desktop and immediately re-selects the mode it was already running has
    ;; not changed what is on screen here, and telling it otherwise restarts the
    ;; same cycle.
    (local.set $changed
      (i32.or
        (i32.ne (call $dx_display_w_get) (local.get $arg1))
        (i32.or
          (i32.ne (call $dx_display_h_get) (local.get $arg2))
          (i32.ne (call $dx_display_bpp_get) (local.get $arg3)))))
    (call $dx_display_w_set (local.get $arg1))
    (call $dx_display_h_set (local.get $arg2))
    (call $dx_display_bpp_set (local.get $arg3))
    (call $dx_display_mode_set (i32.const 1))
    (if (i32.le_u (local.get $arg3) (i32.const 8))
      (then (call $install_default_dx_palette)))
    ;; Resize the cooperative window to match the display mode so the back-canvas
    ;; matches the primary-surface dims. Without this, fullscreen DDraw apps
    ;; (MCM) that issued an earlier SetWindowPos to a chrome-only size end up
    ;; with an 8×47 back-canvas and nothing visible lands on it.
    ;; flags=0: apply both position (0,0) and size (arg1, arg2) — earlier
    ;; code passed 1 (SWP_NOSIZE) which actively dropped the size update.
    (local.set $target_hwnd (call $dx_target_hwnd))
    (if (local.get $target_hwnd) (then
      ;; Whether this *window* is about to change shape is a different question
      ;; from whether the display mode is changing, and the app has to be told
      ;; about both. RollerCoaster Tycoon creates its window at
      ;; SM_CXSCREEN x SM_CYSCREEN, then takes exclusive mode twice: once on a
      ;; first window, and again on the real game window after tearing the
      ;; first one down. The second SetDisplayMode asks for the 640x480x8 that
      ;; is already current, so $changed is 0 -- but the new window is still
      ;; canvas-sized, and the move below silently shrinks it to the mode. With
      ;; no WM_SIZE, RCT kept laying out and edge-testing against the window it
      ;; asked for: on a 1280x872 canvas the map scrolled left and up (limit 0,
      ;; reachable) and not right or down (limit screen-1 = 1279/871, and the
      ;; guest never sees a coordinate past 639/479). At a 640x480 canvas the
      ;; window is born the right size, nothing moves, and the bug disappears --
      ;; which is why every headless test passed.
      (local.set $rect (call $paint_scratch_take))
      (call $host_get_window_rect (local.get $target_hwnd) (local.get $rect))
      (local.set $moved
        (i32.or
          (i32.or
            (i32.ne (load.field PaintRect left (local.get $rect)) (i32.const 0))
            (i32.ne (load.field.memarg PaintRect top (local.get $rect)) (i32.const 0)))
          (i32.or
            (i32.ne (i32.sub (load.field.memarg PaintRect right (local.get $rect))
                             (load.field PaintRect left (local.get $rect)))
                    (local.get $arg1))
            (i32.ne (i32.sub (load.field.memarg PaintRect bottom (local.get $rect))
                             (load.field.memarg PaintRect top (local.get $rect)))
                    (local.get $arg2)))))
      (call $host_move_window (local.get $target_hwnd)
        (i32.const 0) (i32.const 0)
        (local.get $arg1) (local.get $arg2) (i32.const 0))
      (call $defwndproc_do_nccalcsize (local.get $target_hwnd))
      ;; Windows tells the application that its screen changed: a mode switch
      ;; delivers WM_DISPLAYCHANGE, and the window that was resized to match
      ;; gets the usual WM_MOVE/WM_SIZE pair. Caesar III recomputes the client
      ;; rect it scales the cursor against only from that pair — its wndproc
      ;; routes WM_MOVE and WM_SIZE to one SetRect(0, 0, SM_CXSCREEN,
      ;; SM_CYSCREEN) — so without them it keeps dividing by the pre-switch
      ;; desktop size and every click lands short of where it was aimed.
      ;;
      ;; WM_DISPLAYCHANGE stays gated on the mode alone. It is the message RCT
      ;; turns into a "reinit display" flag, and re-announcing an unchanged
      ;; mode is the live-lock described above. WM_MOVE/WM_SIZE describe the
      ;; window, so they go out whenever the window really did move or resize.
      (if (local.get $changed) (then
        (drop (call $post_queue_push (local.get $target_hwnd) (i32.const 0x007E)
          (local.get $arg3)
          (i32.or (i32.and (local.get $arg1) (i32.const 0xFFFF))
                  (i32.shl (local.get $arg2) (i32.const 16)))))))
      (if (i32.or (local.get $changed) (local.get $moved)) (then
        (drop (call $post_queue_push (local.get $target_hwnd) (i32.const 0x0003)
          (i32.const 0) (i32.const 0)))
        (drop (call $post_queue_push (local.get $target_hwnd) (i32.const 0x0005)
          (i32.const 0)
          (i32.or (i32.and (local.get $arg1) (i32.const 0xFFFF))
                  (i32.shl (local.get $arg2) (i32.const 16)))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (local.set $vtbl (call $gl32 (local.get $arg0)))
    (if (i32.or
          (i32.eq (local.get $vtbl) (global.get $DX_VTBL_DDRAW2))
          (i32.or
            (i32.eq (local.get $vtbl) (global.get $DX_VTBL_DDRAW4))
            (i32.eq (local.get $vtbl) (global.get $DX_VTBL_DDRAW7))))
      (then (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))) ;; v2+: this + 5 args
      (else (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))))) ;; v1: this + 3 args

  ;; WaitForVerticalBlank(this, dwFlags, hEvent) — blocks until the next
  ;; vblank boundary, which is the whole point of the call.
  ;;
  ;; The flags are honoured loosely on purpose: DDWAITVB_BLOCKBEGIN (0x01),
  ;; DDWAITVB_BLOCKBEGINEVENT (0x02) and DDWAITVB_BLOCKEND (0x04) all name a
  ;; point inside the same retrace, and the difference between "the start of
  ;; the blank" and "the end of it" is under a millisecond -- less than the
  ;; resolution of the clock either host gives us. So every flag waits to the
  ;; boundary rather than being rejected. BLOCKBEGINEVENT is supposed to
  ;; signal hEvent instead of blocking; blocking is the strictly safer answer
  ;; (the caller waits on the event next, and would hang on a signal we never
  ;; sent), so it takes the same path.
  (func $handle_IDirectDraw_WaitForVerticalBlank (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (call $vblank_wait_elapsed))
      (then (call $vblank_block) (return)))
    (global.set $vblank_wait_active (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetAvailableVidMem(this, lpDDSCaps, lpdwTotal, lpdwFree) — IDirectDraw2+ only
  ;; Total = $DX_VIDMEM_TOTAL (matches GetCaps dwVidMemTotal). Free = Total - used;
  ;; MCM uses the delta across CreateSurface/Release to measure texture bytes.
  (func $handle_IDirectDraw2_GetAvailableVidMem (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $free i32)
    (local.set $free (i32.sub (global.get $DX_VIDMEM_TOTAL) (global.get $dx_vidmem_used)))
    (if (i32.lt_s (local.get $free) (i32.const 0)) (then (local.set $free (i32.const 0))))
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (global.get $DX_VIDMEM_TOTAL))))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $free))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirectDraw4 tail (slots 24..27).
  (func $handle_IDirectDraw4_GetSurfaceFromDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; E_NOTIMPL
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectDraw4_RestoreAllSurfaces (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Surfaces in this software implementation never become lost, but still
    ;; validate the interface instead of accepting an arbitrary pointer.
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x88760096)
        (i32.ne (call $dx_from_this (local.get $arg0)) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirectDraw4_TestCooperativeLevel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Windowed mode is a valid implicit cooperative level. As above, reject a
    ;; stale/non-DirectDraw wrapper rather than turning this into a silent stub.
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x88760096)
        (i32.ne (call $dx_from_this (local.get $arg0)) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; GetDeviceIdentifier(this, LPDDDEVICEIDENTIFIER, flags). The DX6
  ;; structure is 560 bytes: two MAX_PATH ANSI strings, driver version,
  ;; four PCI ids, and a GUID. GTA2 calls this immediately after QI'ing
  ;; IID_IDirectDraw4 and only requires a stable software-device identity.
  (func $handle_IDirectDraw4_GetDeviceIdentifier (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; E_INVALIDARG
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (call $zero_memory (local.get $wa) (i32.const 560))
    ;; szDriver = "wine-assembly"
    (i32.store offset=0 (local.get $wa) (i32.const 0x656e6977))
    (i32.store offset=4 (local.get $wa) (i32.const 0x7373612d))
    (i32.store offset=8 (local.get $wa) (i32.const 0x6c626d65))
    (i32.store offset=12 (local.get $wa) (i32.const 0x00000079))
    ;; szDescription = "Wine Assembly DirectDraw"
    (i32.store offset=260 (local.get $wa) (i32.const 0x656e6957))
    (i32.store offset=264 (local.get $wa) (i32.const 0x73734120))
    (i32.store offset=268 (local.get $wa) (i32.const 0x6c626d65))
    (i32.store offset=272 (local.get $wa) (i32.const 0x69442079))
    (i32.store offset=276 (local.get $wa) (i32.const 0x74636572))
    (i32.store offset=280 (local.get $wa) (i32.const 0x77617244))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirectDraw7 tail (slots 28..29). Mode testing is advisory; the display
  ;; mode path remains authoritative.
  (func $handle_IDirectDraw7_StartModeTest (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Mode testing is advisory in DirectDraw 7. Accept a non-empty list on a
    ;; live object; invalid input fails before EvaluateMode can observe it.
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x80070057)
        (i32.and
          (i32.ne (call $dx_from_this (local.get $arg0)) (i32.const 0))
          (i32.and (i32.ne (local.get $arg1) (i32.const 0))
                   (i32.ne (local.get $arg2) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirectDraw7_EvaluateMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectDrawSurface methods
  ;; ════════════════════════════════════════════════════════════

  (func $handle_IDirectDrawSurface_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $iid0 i32) (local $vtbl i32) (local $wrapper i32) (local $device_vtbl i32)
    ;; Upgrade IID_IDirect3DTexture / IID_IDirect3DTexture2 to their own vtables —
    ;; the app needs correct per-method arg counts (GetHandle takes 2 args, while
    ;; DDSurface's slot 3 AddAttachedSurface takes 1, so a same-vtable alias
    ;; leaves ESP 4 bytes low across the call). Other IIDs (IDirectDrawSurface,
    ;; ...2/4 variants, IID_IUnknown) keep the DX3-compat same-vtable behavior.
    (local.set $iid0 (if (result i32) (local.get $arg1)
      (then (call $gl32 (local.get $arg1)))
      (else (i32.const 0))))
    (local.set $vtbl (i32.const 0))
    ;; IID_IDirectDrawSurface3 {DA044E00-69B2-11D0-A1D5-00AA00B8DFBB}.
    ;; Surface3 adds SetSurfaceDesc at slot 39, so returning the Surface2
    ;; wrapper here makes old SDL call one pointer beyond the vtable.
    (if (i32.eq (local.get $iid0) (i32.const 0xDA044E00)) (then
      (local.set $vtbl (global.get $DX_VTBL_DDSURF3))))
    ;; IID_IDirect3DTexture  {2cdcd9e0-25a0-11cf-a31a-00aa00b93356}
    (if (i32.eq (local.get $iid0) (i32.const 0x2cdcd9e0)) (then
      (local.set $vtbl (global.get $DX_VTBL_D3DTEX))))
    ;; IID_IDirect3DTexture2 {93281502-8cf8-11d0-89ab-00a0c9054129}
    (if (i32.eq (local.get $iid0) (i32.const 0x93281502)) (then
      (local.set $vtbl (global.get $DX_VTBL_D3DTEX2))))
    ;; IID_IDirectDrawGammaControl {69C11C3E-B46B-11D1-AD7A-00C04FC29B4E}.
    ;; Returning the surface vtable corrupts ESP because its slots 3/4 have
    ;; different signatures from GetGammaRamp/SetGammaRamp.
    (if (i32.eq (local.get $iid0) (i32.const 0x69C11C3E)) (then
      (local.set $vtbl (call $init_com_vtable (i32.const 3079) (i32.const 5)))))
    ;; D3DRM asks its render-target surface for a D3D device interface. Return
    ;; a real device wrapper bound to this surface; aliasing the DDSurface
    ;; vtable corrupts ESP when D3DRM later calls device-only callback methods.
    (local.set $device_vtbl (i32.const 0))
    ;; IID_IDirect3DDevice  {64108800-957d-11d0-89ab-00a0c9054129}
    (if (i32.eq (local.get $iid0) (i32.const 0x64108800)) (then
      (local.set $device_vtbl (global.get $DX_VTBL_D3DDEV1))))
    ;; IID_IDirect3DDevice2 {93281501-8cf8-11d0-89ab-00a0c9054129}
    (if (i32.eq (local.get $iid0) (i32.const 0x93281501)) (then
      (local.set $device_vtbl (global.get $DX_VTBL_D3DDEV2))))
    ;; IID_IDirect3DDevice3 {B0AB3B60-33D7-11D1-A981-00C04FD7B174}
    (if (i32.eq (local.get $iid0) (i32.const 0xB0AB3B60)) (then
      (local.set $device_vtbl (global.get $DX_VTBL_D3DDEV3))))
    ;; IID_IDirect3DDevice7 {F5049E79-4861-11D2-A407-00A0C90629A8}
    (if (i32.eq (local.get $iid0) (i32.const 0xF5049E79)) (then
      (local.set $device_vtbl (global.get $DX_VTBL_D3DDEV7))))
    ;; Legacy device class GUIDs from IDirect3D::FindDevice/EnumDevices
    ;; QueryInterface to an IDirect3DDevice v1 on the render-target surface.
    ;; IID_IDirect3DRampDevice {F2086B20-259F-11CF-A31A-00AA00B93356}
    (if (i32.eq (local.get $iid0) (i32.const 0xF2086B20)) (then
      (local.set $device_vtbl (global.get $DX_VTBL_D3DDEV1))))
    ;; IID_IDirect3DRGBDevice {A4665C60-2673-11CF-A31A-00AA00B93356}
    (if (i32.eq (local.get $iid0) (i32.const 0xA4665C60)) (then
      (local.set $device_vtbl (global.get $DX_VTBL_D3DDEV1))))
    ;; IID_IDirect3DHALDevice {84E63DE0-46AA-11CF-816F-0000C020156E}
    (if (i32.eq (local.get $iid0) (i32.const 0x84E63DE0)) (then
      (local.set $device_vtbl (global.get $DX_VTBL_D3DDEV1))))
    ;; IID_IDirect3DMMXDevice {881949A1-D6F3-11D0-89AB-00A0C9054129}
    (if (i32.eq (local.get $iid0) (i32.const 0x881949A1)) (then
      (local.set $device_vtbl (global.get $DX_VTBL_D3DDEV1))))
    (if (local.get $device_vtbl)
      (then
        (call $d3dim_create_device
          (i32.const 0)
          (local.get $arg0)
          (local.get $arg2)
          (local.get $device_vtbl))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (local.get $vtbl)
      (then
        (local.set $wrapper (call $dx_get_wrapper_for_vtbl
          (call $dx_slot_of (local.get $entry)) (local.get $vtbl)))
        (call $gs32 (local.get $arg2) (local.get $wrapper)))
      (else
        ;; Return same object for any other QI (DX3 compat)
        (call $gs32 (local.get $arg2) (local.get $arg0))))
    ;; COM rule: QI must AddRef the returned interface
    (store.field DxObject refcount (local.get $entry) (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  ;; One teardown path serves every COM view of a type-2 surface, including
  ;; IDirect3DSurface9. It returns the remaining reference count without
  ;; owning a handler stack frame, so device teardown can release its implicit
  ;; render-target reference directly.
  (func $dx_surface_release (param $this i32) (result i32)
    (local $entry i32) (local $rc i32) (local $surf_bytes i32) (local $dib_wa i32)
    (local $clipper i32) (local $attached i32) (local $owner i32) (local $child i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    ;; A nonfinal WebGL reference drop touches no pixels or resource lifetime.
    ;; Final teardown and queued software rendering retain their global fence.
    (if (i32.or (i32.eqz (global.get $d3dim_gpu_on))
                (i32.le_s (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
      (then (call $d3dim_worker_fence)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        ;; The billed figure, not misc2: SetColorKey rewrites misc2 on a live
        ;; surface, so a keyed surface would otherwise refund its colour key.
        (local.set $surf_bytes (call $dx_surf_billed_get (local.get $entry)))
        (call $dx_surf_billed_set (local.get $entry) (i32.const 0))
        (local.set $dib_wa (load.field DxObject misc1 (local.get $entry)))
        (global.set $dx_vidmem_used (i32.sub (global.get $dx_vidmem_used) (local.get $surf_bytes)))
        (if (i32.eq (local.get $entry) (global.get $dx_primary_wa))
          (then (global.set $dx_primary_wa (i32.const 0))))
        ;; SetClipper owns one reference until explicit detachment or this
        ;; surface's final release. Clear first so teardown cannot observe a
        ;; stale attachment if the clipper's own reference reaches zero.
        (local.set $clipper (call $dx_surface_clipper_get (local.get $entry)))
        (if (local.get $clipper)
          (then
            (i32.store (call $dx_surface_clipper_ptr (local.get $entry)) (i32.const 0))
            (drop (call $dx_com_release_basic (local.get $clipper)))))
        (call $dx_cursor_reset (local.get $entry))
        (call $dx_surface_storage_free (local.get $dib_wa)
          (load.field DxObject flags (local.get $entry)))
        ;; misc0 is the implicit attachment CreateSurface made: a flip
        ;; chain's back buffer or the next mip level. The complex surface
        ;; owns that object's initial reference, and destroying the front
        ;; destroys the chain, so drop it here. Without this every D3DRM
        ;; device rebuild (Organic Art savers change form by tearing the
        ;; whole device down) leaked a 640x480 back buffer from the DIB arena.
        ;; Same owning DirectDraw on both ends, so a recycled slot is never
        ;; mistaken for the attachment.
        (local.set $attached (load.field DxObject misc0 (local.get $entry)))
        (local.set $owner (i32.load (call $dx_surf_owner_ptr (local.get $entry))))
        (call $dx_free (local.get $entry))
        (if (local.get $attached)
          (then
            (local.set $child (call $ddraw_surface_entry_checked (local.get $attached)))
            (if (i32.and
                  (i32.ne (local.get $child) (i32.const 0))
                  (i32.eq (i32.load (call $dx_surf_owner_ptr (local.get $child)))
                          (local.get $owner)))
              (then (drop (call $dx_surface_release (local.get $attached)))))))))
    (select (local.get $rc) (i32.const 0) (i32.gt_s (local.get $rc) (i32.const 0))))

  (func $handle_IDirectDrawSurface_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dx_surface_release (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; AddAttachedSurface — retain the parent relationship on the child in the
  ;; per-surface metadata. D3DIM also checks the child's creation-time
  ;; DDSCAPS_ZBUFFER bit, because flipping chains and mipmaps use this method
  ;; too and are ordinary colour surfaces.
  (func $handle_IDirectDrawSurface_AddAttachedSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $parent i32) (local $child i32)
    (call $d3dim_worker_fence)
    (local.set $parent (call $dx_from_this (local.get $arg0)))
    (local.set $child (call $dx_from_this (local.get $arg1)))
    (if (i32.and
          (i32.eq (load.field DxObject type (local.get $parent)) (i32.const 2))
          (i32.eq (i32.load (local.get $child)) (i32.const 2)))
      (then
        (i32.store offset=4 (call $dx_surf_meta_ptr (local.get $child))
          (i32.add (call $dx_slot_of (local.get $parent)) (i32.const 1)))
        (i32.store offset=4 (local.get $child)
          (i32.add (i32.load offset=4 (local.get $child)) (i32.const 1)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectDrawSurface_AddOverlayDirtyRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DDERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Blt(this, lpDestRect, lpDDSrcSurface, lpSrcRect, dwFlags, lpDDBltFx)
  ;; Note: 6 args but we only get 5 from dispatch; 6th is at ESP+24
  (func $handle_IDirectDrawSurface_Blt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst_entry i32) (local $src_entry i32)
    (local $dst_dib i32) (local $src_dib i32)
    (local $dst_w i32) (local $dst_h i32) (local $dst_pitch i32)
    (local $src_w i32) (local $src_h i32) (local $src_pitch i32)
    (local $src_full_w i32) (local $src_full_h i32) (local $clip i32)
    (local $dx i32) (local $dy i32) (local $dw i32) (local $dh i32)
    (local $sx i32) (local $sy i32) (local $sw i32) (local $sh i32)
    (local $bpp i32) (local $bps i32) (local $row i32)
    (local $ckey i32) (local $col i32)
    (local $drblt_flags i32) (local $src_keyed i32)
    (local $clipper i32) (local $clip_entry i32) (local $clip_data i32)
    (local $scroll_viewport i32)
    (local.set $dst_entry (call $dx_from_this (local.get $arg0)))
    (call $host_dx_trace (i32.const 12) (call $dx_slot_of (local.get $dst_entry))
      (if (result i32) (local.get $arg2)
        (then (call $dx_slot_of (call $dx_from_this (local.get $arg2))))
        (else (i32.const -1)))
      (local.get $arg1) (local.get $arg3))
    (call $host_dx_trace (i32.const 3) (call $dx_slot_of (local.get $dst_entry))
      (if (result i32) (local.get $arg2)
        (then (call $dx_slot_of (call $dx_from_this (local.get $arg2))))
        (else (i32.const -1)))
      (load.field DxObject misc1 (local.get $dst_entry))
      (local.get $arg4))
    (call $d3dim_surface_fence (local.get $dst_entry))
    (if (local.get $arg2) (then
      (call $d3dim_surface_fence (call $dx_from_this (local.get $arg2)))))
    (local.set $dst_dib (load.field DxObject misc1 (local.get $dst_entry)))
    (local.set $dst_w (load.field DxObject width (local.get $dst_entry)))
    (local.set $dst_h (load.field DxObject height (local.get $dst_entry)))
    (local.set $dst_pitch (load.field DxObject pitch (local.get $dst_entry)))
    (local.set $bpp (load.field DxObject bpp (local.get $dst_entry)))
    (call $dx_surf_note_write (local.get $dst_entry))
    (local.set $bps (i32.div_u (local.get $bpp) (i32.const 8)))
    (local.set $drblt_flags (local.get $arg4))
    ;; HWND-backed clipping is enforced by the window compositor and stays on
    ;; the bulk-copy path. Only an attached explicit RGNDATA list needs
    ;; per-pixel membership checks inside the private surface framebuffer.
    (local.set $clipper (call $dx_surface_clipper_get (local.get $dst_entry)))
    (if (local.get $clipper)
      (then
        (local.set $clip_entry (call $dx_from_this (local.get $clipper)))
        (if (i32.or
              (i32.ne (load.field DxObject type (local.get $clip_entry)) (i32.const 10))
              (i32.ne (load.field DxObject misc0 (local.get $clip_entry)) (i32.const 0)))
          (then (local.set $clip_entry (i32.const 0)))
          (else
            (if (load.field DxObject misc1 (local.get $clip_entry))
              (then (local.set $clip_data
                (call $g2w (load.field DxObject misc1 (local.get $clip_entry)))))
              (else (local.set $clip_entry (i32.const 0))))))))
    ;; Parse dest rect
    (if (local.get $arg1)
      (then
        (local.set $dx (call $gl32 (local.get $arg1)))
        (local.set $dy (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
        (local.set $dw (i32.sub (call $gl32 (i32.add (local.get $arg1) (i32.const 8))) (local.get $dx)))
        (local.set $dh (i32.sub (call $gl32 (i32.add (local.get $arg1) (i32.const 12))) (local.get $dy))))
      (else
        (local.set $dx (i32.const 0)) (local.set $dy (i32.const 0))
        (local.set $dw (local.get $dst_w)) (local.set $dh (local.get $dst_h))))
    ;; DDBLT_COLORFILL and DDBLT_DEPTHFILL both take their native packed value
    ;; from DDBLTFX's union at +80. Depth surfaces must be cleared here too:
    ;; MW3 uses a reversed GREATEREQUAL Z buffer and resets it to zero with
    ;; DDBLT_DEPTHFILL before each frame.
    (if (i32.and (local.get $drblt_flags) (i32.const 0x02000400))
      (then
        (call $dx_surf_clear_copy (local.get $dst_entry))
        (local.set $row (call $gl32 (i32.add
          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) ;; lpDDBltFx arg6
          (i32.const 80)))) ;; DDBLTFX.dwFillColor at offset 80 (after dwSize..dwAlphaSrcConst)
        (call $host_dx_trace (i32.const 13) (call $dx_slot_of (local.get $dst_entry))
          (local.get $row) (local.get $dx) (local.get $dy))
        ;; A full-surface zero clear is the overwhelmingly common depth-buffer
        ;; path (including MW3's reversed-Z clear).  Let bulk memory.fill handle
        ;; it instead of running one interpreted store and branch per pixel.
        (if (i32.and
              (i32.and
                (i32.ne (local.get $dst_dib) (i32.const 0))
                (i32.eqz (local.get $clip_entry)))
              (i32.and
                (i32.and (i32.eqz (local.get $row)) (i32.eqz (local.get $dx)))
                (i32.and
                  (i32.and (i32.eqz (local.get $dy))
                           (i32.eq (local.get $dw) (local.get $dst_w)))
                  (i32.eq (local.get $dh) (local.get $dst_h)))))
          (then
            (call $zero_memory (local.get $dst_dib)
              (i32.mul (local.get $dst_pitch) (local.get $dst_h)))
            (local.set $sy (local.get $dh))))
        ;; Fill destination rect
        (block $fill_done
          ;; sy is already dh after the bulk-clear fast path above.
          (loop $fill_row
            (br_if $fill_done (i32.ge_u (local.get $sy) (local.get $dh)))
            (local.set $sx (i32.const 0))
            (loop $fill_col
              (if (i32.lt_u (local.get $sx) (local.get $dw)) (then
                (if (call $dx_clipper_contains
                      (local.get $clip_entry) (local.get $clip_data)
                      (i32.add (local.get $dx) (local.get $sx))
                      (i32.add (local.get $dy) (local.get $sy)))
                  (then
                    (if (i32.eq (local.get $bps) (i32.const 1))
                      (then
                        (i32.store8 (i32.add (local.get $dst_dib)
                          (i32.add (i32.mul (i32.add (local.get $dy) (local.get $sy)) (local.get $dst_pitch))
                                   (i32.add (local.get $dx) (local.get $sx))))
                          (local.get $row)))
                      (else (if (i32.eq (local.get $bps) (i32.const 2))
                        (then
                          (i32.store16 (i32.add (local.get $dst_dib)
                            (i32.add (i32.mul (i32.add (local.get $dy) (local.get $sy)) (local.get $dst_pitch))
                                     (i32.mul (i32.add (local.get $dx) (local.get $sx)) (i32.const 2))))
                            (local.get $row)))
                        (else
                          (i32.store (i32.add (local.get $dst_dib)
                            (i32.add (i32.mul (i32.add (local.get $dy) (local.get $sy)) (local.get $dst_pitch))
                                     (i32.mul (i32.add (local.get $dx) (local.get $sx)) (i32.const 4))))
                            (local.get $row))))))))
                (local.set $sx (i32.add (local.get $sx) (i32.const 1)))
                (br $fill_col))))
            (local.set $sy (i32.add (local.get $sy) (i32.const 1)))
            (br $fill_row)))
        (if (i32.and
              (i32.ne (i32.and (local.get $drblt_flags) (i32.const 0x02000000)) (i32.const 0))
              (i32.eqz (local.get $clip_entry)))
          (then (drop (call $d3dim_gpu_depth_fill (local.get $dst_entry) (local.get $row)
            (local.get $dx) (local.get $dy) (local.get $dw) (local.get $dh)))))
        ;; If dest is primary, present
        (if (i32.and (load.field DxObject flags (local.get $dst_entry)) (i32.const 1))
          (then (call $dx_present (local.get $dst_entry))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))) ;; 6 args + ret
        (return)))
    ;; Motocross Madness uses this exact null-source WAIT marker at the start of
    ;; each overlay frame. Restore the background saved beneath its prior keyed
    ;; cursor, leaving the static title art and all other null-source calls alone.
    (if (i32.and
          (i32.and (i32.eqz (local.get $arg2))
                   (i32.and (i32.ne (local.get $arg1) (i32.const 0))
                            (i32.ne (local.get $arg3) (i32.const 0))))
          (i32.and
            (i32.eq (i32.and (local.get $drblt_flags) (i32.const 0xFEFFFFFF))
                    (i32.const 0))
            (i32.and
              (i32.and (i32.eqz (local.get $dx)) (i32.eqz (local.get $dy)))
              (i32.and
                (i32.and (i32.eq (local.get $dw) (local.get $dst_w))
                         (i32.eq (local.get $dh) (local.get $dst_h)))
                (i32.and
                  (i32.and (i32.eqz (call $gl32 (local.get $arg3)))
                           (i32.eqz (call $gl32 (i32.add (local.get $arg3) (i32.const 4)))))
                  (i32.and
                    (i32.eq (call $gl32 (i32.add (local.get $arg3) (i32.const 8)))
                            (local.get $dst_w))
                    (i32.eq (call $gl32 (i32.add (local.get $arg3) (i32.const 12)))
                            (local.get $dst_h))))))))
      (then
        (call $dx_cursor_restore_or_arm (local.get $dst_entry))
        (if (i32.and (load.field DxObject flags (local.get $dst_entry)) (i32.const 1))
          (then (call $dx_present (local.get $dst_entry))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    ;; MCM's profile form normally copies a temporary black backing surface
    ;; over the title before drawing the editable name, instructions, and OK
    ;; button. In this legacy path the temporary wrapper can arrive as NULL;
    ;; treating every partial null-source Blt as a clear damaged unrelated
    ;; content, so key the fallback to MCM's exact 640x480 panel signature.
    (if (i32.and
          (i32.and
            (i32.eqz (local.get $arg2))
            (i32.and (i32.eqz (local.get $arg3))
                     (i32.eq (i32.and (local.get $drblt_flags) (i32.const 0xFEFFFFFF))
                             (i32.const 0x8000))))
          (i32.and
            (i32.and (i32.eq (local.get $dst_w) (i32.const 640))
                     (i32.eq (local.get $dst_h) (i32.const 480)))
            (i32.and
              (i32.and (i32.eq (local.get $dx) (i32.const 35))
                       (i32.eq (local.get $dy) (i32.const 44)))
              (i32.and (i32.eq (local.get $dw) (i32.const 271))
                       (i32.eq (local.get $dh) (i32.const 213))))))
      (then
        (call $dx_surf_clear_copy (local.get $dst_entry))
        (local.set $row (i32.const 0))
        (block $profile_clear_done (loop $profile_clear_rows
          (br_if $profile_clear_done (i32.ge_u (local.get $row) (local.get $dh)))
          (call $zero_memory
            (i32.add (local.get $dst_dib)
              (i32.add
                (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                (i32.mul (local.get $dx) (local.get $bps))))
            (i32.mul (local.get $dw) (local.get $bps)))
          (local.set $row (i32.add (local.get $row) (i32.const 1)))
          (br $profile_clear_rows)))
        (if (i32.and (load.field DxObject flags (local.get $dst_entry)) (i32.const 1))
          (then (call $dx_present (local.get $dst_entry))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    ;; Source surface blit
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (local.set $src_entry (call $dx_from_this (local.get $arg2)))
    (local.set $src_dib (load.field DxObject misc1 (local.get $src_entry)))
    (local.set $src_pitch (load.field DxObject pitch (local.get $src_entry)))
    (local.set $src_full_w (load.field DxObject width (local.get $src_entry)))
    (local.set $src_full_h (load.field DxObject height (local.get $src_entry)))
    ;; DXT source into an uncompressed destination: decompress, as the driver
    ;; does, into scratch laid out in the destination's own pixel format, then
    ;; let the ordinary copy below run over it.
    (if (i32.and
          (call $dx_fmt_is_dxt (call $dx_surf_fmt_get (local.get $src_entry)))
          (i32.and
            (i32.eqz (call $dx_fmt_is_dxt (call $dx_surf_fmt_get (local.get $dst_entry))))
            (i32.or (i32.eq (local.get $bpp) (i32.const 16)) (i32.eq (local.get $bpp) (i32.const 32)))))
      (then
        (local.set $src_pitch (i32.mul (local.get $src_full_w) (local.get $bps)))
        (local.set $src_dib (call $dx_dxt_scratch_get
          (i32.mul (local.get $src_pitch) (local.get $src_full_h))))
        (if (local.get $src_dib)
          (then (call $dx_dxt_decode_to (local.get $src_entry) (local.get $dst_entry)
            (local.get $src_dib) (local.get $src_pitch) (local.get $bpp))))))
    (local.set $ckey (load.field DxObject misc2 (local.get $src_entry)))
    (local.set $src_keyed
      (i32.and
        (i32.ne (i32.and (local.get $drblt_flags) (i32.const 0x8000)) (i32.const 0))
        (i32.ne
          (i32.and (load.field DxObject flags (local.get $src_entry)) (i32.const 0x100))
          (i32.const 0))))
    ;; Parse source rect
    (if (local.get $arg3)
      (then
        (local.set $sx (call $gl32 (local.get $arg3)))
        (local.set $sy (call $gl32 (i32.add (local.get $arg3) (i32.const 4))))
        (local.set $sw (i32.sub (call $gl32 (i32.add (local.get $arg3) (i32.const 8))) (local.get $sx)))
        (local.set $sh (i32.sub (call $gl32 (i32.add (local.get $arg3) (i32.const 12))) (local.get $sy))))
      (else
        (local.set $sx (i32.const 0)) (local.set $sy (i32.const 0))
        (local.set $sw (load.field DxObject width (local.get $src_entry)))
        (local.set $sh (load.field DxObject height (local.get $src_entry)))))
    ;; Heroes II temporarily stretches its 447-pixel map into the primary.
    (local.set $scroll_viewport
      (i32.and
        (i32.and (i32.eq (local.get $dst_w) (i32.const 640))
                 (i32.eq (local.get $dst_h) (i32.const 480)))
        (i32.and
          (i32.and (i32.eq (local.get $bpp) (i32.const 8))
                   (i32.eq (local.get $dx) (i32.const 0)))
          (i32.and
            (i32.and (i32.eq (local.get $dy) (i32.const 0))
                     (i32.eq (local.get $dw) (i32.const 640)))
            (i32.and
              (i32.and (i32.eq (local.get $dh) (i32.const 480))
                       (i32.eq (local.get $sy) (i32.const 0)))
              (i32.and (i32.eq (local.get $sw) (i32.const 447))
                       (i32.eq (local.get $sh) (i32.const 480))))))))
    (if (i32.and
          (local.get $scroll_viewport)
          (i32.and
            (i32.and (load.field DxObject flags (local.get $dst_entry)) (i32.const 1))
            (i32.ne (global.get $dx_scroll_hold_wa) (local.get $dst_entry))))
      (then (global.set $dx_scroll_hold_wa (local.get $dst_entry))))
    ;; A small surface copied from this destination is commonly a saved
    ;; software-cursor background. Once Lock/Unlock has redrawn the large
    ;; surface, replaying that exact inverse copy would stamp obsolete pixels
    ;; into the new frame. Treat the stale restore as a successful no-op.
    (if (call $dx_surf_stale_restore
          (local.get $dst_entry) (local.get $src_entry)
          (local.get $dx) (local.get $dy) (local.get $sx) (local.get $sy)
          (local.get $dw) (local.get $dh) (local.get $drblt_flags))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (if (i32.and
          (i32.and
            (i32.ne (i32.and (local.get $drblt_flags) (i32.const 0x8000)) (i32.const 0))
            (i32.and (i32.eq (local.get $bpp) (i32.const 16))
                     (i32.eq (load.field.memarg DxObject bpp (local.get $src_entry)) (i32.const 16))))
          (i32.and
            (i32.and (i32.eq (local.get $dw) (i32.const 32))
                     (i32.eq (local.get $dh) (i32.const 32)))
            (i32.and (i32.eq (local.get $sw) (i32.const 32))
                     (i32.eq (local.get $sh) (i32.const 32)))))
      (then (call $dx_cursor_save_background
        (local.get $dst_entry) (local.get $dx) (local.get $dy))))
    ;; If dst rect == src rect, fast row-copy; otherwise nearest-neighbor stretch.
    (if (i32.and (i32.eq (local.get $dw) (local.get $sw))
                 (i32.eq (local.get $dh) (local.get $sh)))
      (then
        ;; Blt is clipped by the destination's clipper below, but surface
        ;; bounds are mandatory before either the bulk or region-list path:
        ;; LF2 copies its 794x548 logical frame to a 640x480 primary at 23,43.
        ;; Keep source and destination origins paired while trimming so the
        ;; equal-size fast path cannot wrap an over-wide row into later rows.
        (if (i32.lt_s (local.get $dx) (i32.const 0))
          (then
            (local.set $clip (i32.sub (i32.const 0) (local.get $dx)))
            (local.set $dx (i32.const 0))
            (local.set $sx (i32.add (local.get $sx) (local.get $clip)))
            (local.set $dw (i32.sub (local.get $dw) (local.get $clip)))
            (local.set $sw (local.get $dw))))
        (if (i32.lt_s (local.get $dy) (i32.const 0))
          (then
            (local.set $clip (i32.sub (i32.const 0) (local.get $dy)))
            (local.set $dy (i32.const 0))
            (local.set $sy (i32.add (local.get $sy) (local.get $clip)))
            (local.set $dh (i32.sub (local.get $dh) (local.get $clip)))
            (local.set $sh (local.get $dh))))
        (if (i32.lt_s (local.get $sx) (i32.const 0))
          (then
            (local.set $clip (i32.sub (i32.const 0) (local.get $sx)))
            (local.set $sx (i32.const 0))
            (local.set $dx (i32.add (local.get $dx) (local.get $clip)))
            (local.set $dw (i32.sub (local.get $dw) (local.get $clip)))
            (local.set $sw (local.get $dw))))
        (if (i32.lt_s (local.get $sy) (i32.const 0))
          (then
            (local.set $clip (i32.sub (i32.const 0) (local.get $sy)))
            (local.set $sy (i32.const 0))
            (local.set $dy (i32.add (local.get $dy) (local.get $clip)))
            (local.set $dh (i32.sub (local.get $dh) (local.get $clip)))
            (local.set $sh (local.get $dh))))
        (if (i32.or
              (i32.or (i32.le_s (local.get $dw) (i32.const 0))
                      (i32.le_s (local.get $dh) (i32.const 0)))
              (i32.or
                (i32.or (i32.ge_u (local.get $dx) (local.get $dst_w))
                        (i32.ge_u (local.get $dy) (local.get $dst_h)))
                (i32.or (i32.ge_u (local.get $sx) (local.get $src_full_w))
                        (i32.ge_u (local.get $sy) (local.get $src_full_h)))))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
            (return)))
        (if (i32.gt_u (local.get $dw) (i32.sub (local.get $dst_w) (local.get $dx)))
          (then (local.set $dw (i32.sub (local.get $dst_w) (local.get $dx)))))
        (if (i32.gt_u (local.get $dw) (i32.sub (local.get $src_full_w) (local.get $sx)))
          (then (local.set $dw (i32.sub (local.get $src_full_w) (local.get $sx)))))
        (if (i32.gt_u (local.get $dh) (i32.sub (local.get $dst_h) (local.get $dy)))
          (then (local.set $dh (i32.sub (local.get $dst_h) (local.get $dy)))))
        (if (i32.gt_u (local.get $dh) (i32.sub (local.get $src_full_h) (local.get $sy)))
          (then (local.set $dh (i32.sub (local.get $src_full_h) (local.get $sy)))))
        (local.set $sw (local.get $dw))
        (local.set $sh (local.get $dh))
        (if (local.get $src_keyed)
          (then
            ;; Without a region list every pixel is inside the clip; the
            ;; vectorized copy is the scalar loop below, pixel for pixel.
            (if (i32.eqz (local.get $clip_entry))
              (then
                (call $dx_ckey_copy_rect
                  (local.get $dst_dib) (local.get $dst_pitch) (local.get $dx) (local.get $dy)
                  (local.get $src_dib) (local.get $src_pitch) (local.get $sx) (local.get $sy)
                  (local.get $dw) (local.get $dh) (local.get $bps) (local.get $ckey))
                (local.set $row (local.get $dh)))
              (else (local.set $row (i32.const 0))))
            (block $ckblit_done (loop $ckblit_row
              (br_if $ckblit_done (i32.ge_u (local.get $row) (local.get $dh)))
              (local.set $src_w (i32.const 0))
              (block $ckblit_col_done (loop $ckblit_col
                (br_if $ckblit_col_done (i32.ge_u (local.get $src_w) (local.get $dw)))
                (if (i32.eq (local.get $bps) (i32.const 1))
                  (then
                    (local.set $col (i32.load8_u
                      (i32.add (local.get $src_dib)
                        (i32.add (i32.mul (i32.add (local.get $sy) (local.get $row)) (local.get $src_pitch))
                                 (i32.add (local.get $sx) (local.get $src_w))))))
                    (if (i32.ne (local.get $col) (local.get $ckey))
                      (then (if (call $dx_clipper_contains
                            (local.get $clip_entry) (local.get $clip_data)
                            (i32.add (local.get $dx) (local.get $src_w))
                            (i32.add (local.get $dy) (local.get $row)))
                      (then (i32.store8
                        (i32.add (local.get $dst_dib)
                          (i32.add (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                                   (i32.add (local.get $dx) (local.get $src_w))))
                        (local.get $col)))))))
                  (else (if (i32.eq (local.get $bps) (i32.const 2))
                    (then
                      (local.set $col (i32.load16_u
                        (i32.add (local.get $src_dib)
                          (i32.add (i32.mul (i32.add (local.get $sy) (local.get $row)) (local.get $src_pitch))
                                   (i32.mul (i32.add (local.get $sx) (local.get $src_w)) (i32.const 2))))))
                      (if (i32.ne (local.get $col) (local.get $ckey))
                        (then (if (call $dx_clipper_contains
                              (local.get $clip_entry) (local.get $clip_data)
                              (i32.add (local.get $dx) (local.get $src_w))
                              (i32.add (local.get $dy) (local.get $row)))
                        (then (i32.store16
                          (i32.add (local.get $dst_dib)
                            (i32.add (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                                     (i32.mul (i32.add (local.get $dx) (local.get $src_w)) (i32.const 2))))
                          (local.get $col)))))))
                    (else
                      (local.set $col (i32.load
                        (i32.add (local.get $src_dib)
                          (i32.add (i32.mul (i32.add (local.get $sy) (local.get $row)) (local.get $src_pitch))
                                   (i32.mul (i32.add (local.get $sx) (local.get $src_w)) (i32.const 4))))))
                      (if (i32.ne (local.get $col) (local.get $ckey))
                        (then (if (call $dx_clipper_contains
                              (local.get $clip_entry) (local.get $clip_data)
                              (i32.add (local.get $dx) (local.get $src_w))
                              (i32.add (local.get $dy) (local.get $row)))
                        (then (i32.store
                          (i32.add (local.get $dst_dib)
                            (i32.add (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                                     (i32.mul (i32.add (local.get $dx) (local.get $src_w)) (i32.const 4))))
                          (local.get $col))))))))))
                (local.set $src_w (i32.add (local.get $src_w) (i32.const 1)))
                (br $ckblit_col)))
              (local.set $row (i32.add (local.get $row) (i32.const 1)))
              (br $ckblit_row)))
            ;; A primary copy may still contain a map-only intermediate frame.
            (if (i32.and (load.field DxObject flags (local.get $dst_entry)) (i32.const 1))
              (then
                (call $dx_present (local.get $dst_entry))
                (call $present_pace_full_blit (local.get $dst_entry) (local.get $dw) (local.get $dh))))
            (call $dx_surf_note_copy
              (local.get $dst_entry) (local.get $src_entry)
              (local.get $dx) (local.get $dy) (local.get $sx) (local.get $sy)
              (local.get $dw) (local.get $dh) (local.get $drblt_flags))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
            (return)))
        (if (local.get $clip_entry)
          (then
            ;; Explicit region lists can be disjoint. Keep the ordinary row
            ;; memcpy above/below completely untouched unless such a list is
            ;; actually attached.
            (local.set $row (i32.const 0))
            (block $clip_blit_done (loop $clip_blit_row
              (br_if $clip_blit_done (i32.ge_u (local.get $row) (local.get $dh)))
              (local.set $src_w (i32.const 0))
              (block $clip_blit_col_done (loop $clip_blit_col
                (br_if $clip_blit_col_done (i32.ge_u (local.get $src_w) (local.get $dw)))
                (if (call $dx_clipper_contains
                      (local.get $clip_entry) (local.get $clip_data)
                      (i32.add (local.get $dx) (local.get $src_w))
                      (i32.add (local.get $dy) (local.get $row)))
                  (then
                    (if (i32.eq (local.get $bps) (i32.const 1))
                      (then
                        (i32.store8
                          (i32.add (local.get $dst_dib)
                            (i32.add
                              (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                              (i32.add (local.get $dx) (local.get $src_w))))
                          (i32.load8_u
                            (i32.add (local.get $src_dib)
                              (i32.add
                                (i32.mul (i32.add (local.get $sy) (local.get $row)) (local.get $src_pitch))
                                (i32.add (local.get $sx) (local.get $src_w)))))))
                      (else (if (i32.eq (local.get $bps) (i32.const 2))
                        (then
                          (i32.store16
                            (i32.add (local.get $dst_dib)
                              (i32.add
                                (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                                (i32.mul (i32.add (local.get $dx) (local.get $src_w)) (i32.const 2))))
                            (i32.load16_u
                              (i32.add (local.get $src_dib)
                                (i32.add
                                  (i32.mul (i32.add (local.get $sy) (local.get $row)) (local.get $src_pitch))
                                  (i32.mul (i32.add (local.get $sx) (local.get $src_w)) (i32.const 2)))))))
                        (else
                          (i32.store
                            (i32.add (local.get $dst_dib)
                              (i32.add
                                (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                                (i32.mul (i32.add (local.get $dx) (local.get $src_w)) (i32.const 4))))
                            (i32.load
                              (i32.add (local.get $src_dib)
                                (i32.add
                                  (i32.mul (i32.add (local.get $sy) (local.get $row)) (local.get $src_pitch))
                                  (i32.mul (i32.add (local.get $sx) (local.get $src_w)) (i32.const 4))))))))))))
                (local.set $src_w (i32.add (local.get $src_w) (i32.const 1)))
                (br $clip_blit_col)))
              (local.set $row (i32.add (local.get $row) (i32.const 1)))
              (br $clip_blit_row))))
          (else
            (local.set $row (i32.const 0))
            (block $blit_done (loop $blit_row
              (br_if $blit_done (i32.ge_u (local.get $row) (local.get $dh)))
              (call $memcpy
                (i32.add (local.get $dst_dib)
                  (i32.add (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                           (i32.mul (local.get $dx) (local.get $bps))))
                (i32.add (local.get $src_dib)
                  (i32.add (i32.mul (i32.add (local.get $sy) (local.get $row)) (local.get $src_pitch))
                           (i32.mul (local.get $sx) (local.get $bps))))
                (i32.mul (local.get $dw) (local.get $bps)))
              (local.set $row (i32.add (local.get $row) (i32.const 1)))
              (br $blit_row))))))
      (else
        ;; Nearest-neighbor stretch. Reuses $row as dst-row; uses $src_w/$src_h as scratch
        ;; dst-col / src-col / src-row. Guard against zero dims.
        (if (i32.and (i32.and (i32.gt_u (local.get $dw) (i32.const 0))
                              (i32.gt_u (local.get $dh) (i32.const 0)))
                     (i32.and (i32.gt_u (local.get $sw) (i32.const 0))
                              (i32.gt_u (local.get $sh) (i32.const 0))))
          (then
            (local.set $row (i32.const 0))
            (block $str_done (loop $str_row
              (br_if $str_done (i32.ge_u (local.get $row) (local.get $dh)))
              ;; src row Y = sy + row * sh / dh
              (local.set $src_h
                (i32.add (local.get $sy)
                  (i32.div_u (i32.mul (local.get $row) (local.get $sh)) (local.get $dh))))
              (local.set $src_w (i32.const 0)) ;; dst col index
              (block $str_col_done (loop $str_col
                (br_if $str_col_done (i32.ge_u (local.get $src_w) (local.get $dw)))
                ;; src col X = sx + col * sw / dw (held in $bpp — $src_pitch/$bps still needed below)
                (local.set $bpp
                  (i32.add (local.get $sx)
                    (i32.div_u (i32.mul (local.get $src_w) (local.get $sw)) (local.get $dw))))
                ;; src addr = src_dib + src_h*src_pitch + bpp*bps
                ;; dst addr = dst_dib + (dy+row)*dst_pitch + (dx+col)*bps
                (if (i32.eq (local.get $bps) (i32.const 1))
                  (then
                    (local.set $col (i32.load8_u
                      (i32.add (local.get $src_dib)
                        (i32.add (i32.mul (local.get $src_h) (local.get $src_pitch))
                                 (local.get $bpp)))))
                    (if (i32.or (i32.eqz (local.get $src_keyed))
                                  (i32.ne (local.get $col) (local.get $ckey)))
                      (then (if (call $dx_clipper_contains
                            (local.get $clip_entry) (local.get $clip_data)
                            (i32.add (local.get $dx) (local.get $src_w))
                            (i32.add (local.get $dy) (local.get $row)))
                      (then (i32.store8
                        (i32.add (local.get $dst_dib)
                          (i32.add (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                                   (i32.add (local.get $dx) (local.get $src_w))))
                        (local.get $col)))))))
                  (else (if (i32.eq (local.get $bps) (i32.const 2))
                    (then
                      (local.set $col (i32.load16_u
                        (i32.add (local.get $src_dib)
                          (i32.add (i32.mul (local.get $src_h) (local.get $src_pitch))
                                   (i32.mul (local.get $bpp) (i32.const 2))))))
                      (if (i32.or (i32.eqz (local.get $src_keyed))
                                    (i32.ne (local.get $col) (local.get $ckey)))
                        (then (if (call $dx_clipper_contains
                              (local.get $clip_entry) (local.get $clip_data)
                              (i32.add (local.get $dx) (local.get $src_w))
                              (i32.add (local.get $dy) (local.get $row)))
                        (then (i32.store16
                          (i32.add (local.get $dst_dib)
                            (i32.add (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                                     (i32.mul (i32.add (local.get $dx) (local.get $src_w)) (i32.const 2))))
                          (local.get $col)))))))
                    (else
                      (local.set $col (i32.load
                        (i32.add (local.get $src_dib)
                          (i32.add (i32.mul (local.get $src_h) (local.get $src_pitch))
                                   (i32.mul (local.get $bpp) (i32.const 4))))))
                      (if (i32.or (i32.eqz (local.get $src_keyed))
                                    (i32.ne (local.get $col) (local.get $ckey)))
                        (then (if (call $dx_clipper_contains
                              (local.get $clip_entry) (local.get $clip_data)
                              (i32.add (local.get $dx) (local.get $src_w))
                              (i32.add (local.get $dy) (local.get $row)))
                        (then (i32.store
                          (i32.add (local.get $dst_dib)
                            (i32.add (i32.mul (i32.add (local.get $dy) (local.get $row)) (local.get $dst_pitch))
                                     (i32.mul (i32.add (local.get $dx) (local.get $src_w)) (i32.const 4))))
                          (local.get $col))))))))))
                (local.set $src_w (i32.add (local.get $src_w) (i32.const 1)))
                (br $str_col)))
              (local.set $row (i32.add (local.get $row) (i32.const 1)))
              (br $str_row)))))))
    (call $dx_surf_note_copy
      (local.get $dst_entry) (local.get $src_entry)
      (local.get $dx) (local.get $dy) (local.get $sx) (local.get $sy)
      (local.get $dw) (local.get $dh) (local.get $drblt_flags))
    ;; Preserve guest pixels; $dx_present holds scanout until the static
    ;; sidebar indices return, including through intervening palette updates.
    (if (i32.and (load.field DxObject flags (local.get $dst_entry)) (i32.const 1))
      (then
        (call $dx_present (local.get $dst_entry))
        (call $present_pace_full_blit (local.get $dst_entry) (local.get $dw) (local.get $dh))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; BltBatch — stub
  (func $handle_IDirectDrawSurface_BltBatch (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Source-colour-keyed rectangle copy between two surface DIBs: every source
  ;; pixel that is not $ckey is stored to the destination, keyed pixels leave
  ;; the destination alone. $dst_dib/$src_dib are the WASM address of each
  ;; surface base; surface DIBs come from $dib_alloc and are linear in WASM
  ;; memory, which every caller already assumed of misc1.
  ;;
  ;; This was a scalar loop that re-tested bytes-per-pixel on every pixel
  ;; (60% of Moorhuhn 3's gameplay CPU). The width is now dispatched once per
  ;; call, and each row runs 16 bytes at a time: an eq mask against the splat
  ;; key, then a straight store (no keyed lane), no store (all keyed) or a
  ;; bitselect against the destination. The scalar tail and the result are
  ;; the old loop's, pixel for pixel (coordinates are pixels, not bytes):
  ;;   * the key is compared against the zero-extended pixel, so an 8/16-bit
  ;;     surface whose key does not fit its width keys nothing;
  ;;   * a row whose source and destination bytes overlap (a surface blitting
  ;;     onto itself) runs the old forward scalar loop, because the order in
  ;;     which one pixel's store feeds a later pixel's load is observable there;
  ;;   * any width other than 1, 2 or 3 bytes is treated as 4, as before.
  ;; 24bpp used to fall into the 4-byte loop too (4-byte stride, past the
  ;; rectangle); it now steps 3 bytes and compares the low 24 bits of the key.
  (func $dx_ckey_copy_rect
      (param $dst_dib i32) (param $dst_pitch i32) (param $dx i32) (param $dy i32)
      (param $src_dib i32) (param $src_pitch i32) (param $sx i32) (param $sy i32)
      (param $w i32) (param $h i32) (param $bps i32) (param $ckey i32)
    (local $dst i32) (local $src i32)
    (local $row i32) (local $x i32) (local $bytes i32) (local $vbytes i32)
    (local $d i32) (local $s i32) (local $col i32) (local $m i32) (local $nokey i32)
    (local $kv v128) (local $v v128) (local $mask v128)
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h))) (then (return)))
    (if (i32.ne (local.get $bps) (i32.const 3))
      (then
        (if (i32.and (i32.ne (local.get $bps) (i32.const 1))
                     (i32.ne (local.get $bps) (i32.const 2)))
          (then (local.set $bps (i32.const 4))))))
    (local.set $dst (i32.add (local.get $dst_dib)
      (i32.add (i32.mul (local.get $dy) (local.get $dst_pitch))
               (i32.mul (local.get $dx) (local.get $bps)))))
    (local.set $src (i32.add (local.get $src_dib)
      (i32.add (i32.mul (local.get $sy) (local.get $src_pitch))
               (i32.mul (local.get $sx) (local.get $bps)))))
    (local.set $bytes (i32.mul (local.get $w) (local.get $bps)))
    (local.set $vbytes (i32.and (local.get $bytes) (i32.const -16)))
    ;; A key wider than the pixel can never match the zero-extended pixel.
    (if (i32.or
          (i32.and (i32.eq (local.get $bps) (i32.const 1))
                   (i32.gt_u (local.get $ckey) (i32.const 0xFF)))
          (i32.and (i32.eq (local.get $bps) (i32.const 2))
                   (i32.gt_u (local.get $ckey) (i32.const 0xFFFF))))
      (then (local.set $nokey (i32.const 1))))
    (if (i32.eq (local.get $bps) (i32.const 1))
      (then (local.set $kv (i8x16.splat (local.get $ckey)))))
    (if (i32.eq (local.get $bps) (i32.const 2))
      (then (local.set $kv (i16x8.splat (local.get $ckey)))))
    (if (i32.eq (local.get $bps) (i32.const 3))
      (then (local.set $ckey (i32.and (local.get $ckey) (i32.const 0xFFFFFF)))))
    (if (i32.eq (local.get $bps) (i32.const 4))
      (then (local.set $kv (i32x4.splat (local.get $ckey)))))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_u (local.get $row) (local.get $h)))
      (local.set $d (i32.add (local.get $dst)
        (i32.mul (local.get $row) (local.get $dst_pitch))))
      (local.set $s (i32.add (local.get $src)
        (i32.mul (local.get $row) (local.get $src_pitch))))
      (block $row_done
        ;; Overlapping row: the old per-pixel forward order, verbatim.
        (if (i32.and (i32.lt_u (local.get $d) (i32.add (local.get $s) (local.get $bytes)))
                     (i32.lt_u (local.get $s) (i32.add (local.get $d) (local.get $bytes))))
          (then
            (local.set $x (i32.const 0))
            (block $ov_done (loop $ov
              (br_if $ov_done (i32.ge_u (local.get $x) (local.get $bytes)))
              (if (i32.eq (local.get $bps) (i32.const 1))
                (then
                  (local.set $col (i32.load8_u (i32.add (local.get $s) (local.get $x))))
                  (if (i32.ne (local.get $col) (local.get $ckey))
                    (then (i32.store8 (i32.add (local.get $d) (local.get $x)) (local.get $col))))
                  (local.set $x (i32.add (local.get $x) (i32.const 1))))
                (else (if (i32.eq (local.get $bps) (i32.const 2))
                (then
                  (local.set $col (i32.load16_u (i32.add (local.get $s) (local.get $x))))
                  (if (i32.ne (local.get $col) (local.get $ckey))
                    (then (i32.store16 (i32.add (local.get $d) (local.get $x)) (local.get $col))))
                  (local.set $x (i32.add (local.get $x) (i32.const 2))))
                (else (if (i32.eq (local.get $bps) (i32.const 3))
                (then
                  (local.set $col (i32.or
                    (i32.load16_u (i32.add (local.get $s) (local.get $x)))
                    (i32.shl (i32.load8_u offset=2 (i32.add (local.get $s) (local.get $x)))
                             (i32.const 16))))
                  (if (i32.ne (local.get $col) (local.get $ckey))
                    (then
                      (i32.store16 (i32.add (local.get $d) (local.get $x)) (local.get $col))
                      (i32.store8 offset=2 (i32.add (local.get $d) (local.get $x))
                        (i32.shr_u (local.get $col) (i32.const 16)))))
                  (local.set $x (i32.add (local.get $x) (i32.const 3))))
                (else
                  (local.set $col (i32.load (i32.add (local.get $s) (local.get $x))))
                  (if (i32.ne (local.get $col) (local.get $ckey))
                    (then (i32.store (i32.add (local.get $d) (local.get $x)) (local.get $col))))
                  (local.set $x (i32.add (local.get $x) (i32.const 4)))))))))
              (br $ov)))
            (br $row_done)))
        (if (local.get $nokey)
          (then
            (memory.copy (local.get $d) (local.get $s) (local.get $bytes))
            (br $row_done)))
        (if (i32.eq (local.get $bps) (i32.const 3))
          (then
            (local.set $x (i32.const 0))
            (block $p3_done (loop $p3
              (br_if $p3_done (i32.ge_u (local.get $x) (local.get $bytes)))
              (local.set $col (i32.or
                (i32.load16_u (i32.add (local.get $s) (local.get $x)))
                (i32.shl (i32.load8_u offset=2 (i32.add (local.get $s) (local.get $x)))
                         (i32.const 16))))
              (if (i32.ne (local.get $col) (local.get $ckey))
                (then
                  (i32.store16 (i32.add (local.get $d) (local.get $x)) (local.get $col))
                  (i32.store8 offset=2 (i32.add (local.get $d) (local.get $x))
                    (i32.shr_u (local.get $col) (i32.const 16)))))
              (local.set $x (i32.add (local.get $x) (i32.const 3)))
              (br $p3)))
            (br $row_done)))
        ;; 1/2/4 bytes: 16-byte vectors, then the scalar tail.
        (local.set $x (i32.const 0))
        (block $v_done (loop $vl
          (br_if $v_done (i32.ge_u (local.get $x) (local.get $vbytes)))
          (local.set $v (v128.load (i32.add (local.get $s) (local.get $x))))
          (local.set $mask
            (if (result v128) (i32.eq (local.get $bps) (i32.const 1))
              (then (i8x16.eq (local.get $v) (local.get $kv)))
              (else (if (result v128) (i32.eq (local.get $bps) (i32.const 2))
                (then (i16x8.eq (local.get $v) (local.get $kv)))
                (else (i32x4.eq (local.get $v) (local.get $kv)))))))
          (local.set $m (i8x16.bitmask (local.get $mask)))
          (if (i32.eqz (local.get $m))
            (then (v128.store (i32.add (local.get $d) (local.get $x)) (local.get $v)))
            (else (if (i32.ne (local.get $m) (i32.const 0xFFFF))
              (then
                (v128.store (i32.add (local.get $d) (local.get $x))
                  (v128.bitselect
                    (v128.load (i32.add (local.get $d) (local.get $x)))
                    (local.get $v)
                    (local.get $mask)))))))
          (local.set $x (i32.add (local.get $x) (i32.const 16)))
          (br $vl)))
        (block $t_done (loop $tl
          (br_if $t_done (i32.ge_u (local.get $x) (local.get $bytes)))
          (if (i32.eq (local.get $bps) (i32.const 1))
            (then
              (local.set $col (i32.load8_u (i32.add (local.get $s) (local.get $x))))
              (if (i32.ne (local.get $col) (local.get $ckey))
                (then (i32.store8 (i32.add (local.get $d) (local.get $x)) (local.get $col)))))
            (else (if (i32.eq (local.get $bps) (i32.const 2))
              (then
                (local.set $col (i32.load16_u (i32.add (local.get $s) (local.get $x))))
                (if (i32.ne (local.get $col) (local.get $ckey))
                  (then (i32.store16 (i32.add (local.get $d) (local.get $x)) (local.get $col)))))
              (else
                (local.set $col (i32.load (i32.add (local.get $s) (local.get $x))))
                (if (i32.ne (local.get $col) (local.get $ckey))
                  (then (i32.store (i32.add (local.get $d) (local.get $x)) (local.get $col))))))))
          (local.set $x (i32.add (local.get $x) (local.get $bps)))
          (br $tl))))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rows))))

  ;; BltFast(this, dwX, dwY, lpDDSrcSurface, lpSrcRect, dwTrans)
  (func $handle_IDirectDrawSurface_BltFast (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst_entry i32) (local $src_entry i32)
    (local $dst_dib i32) (local $src_dib i32)
    (local $dst_w i32) (local $dst_h i32) (local $src_full_w i32) (local $src_full_h i32)
    (local $dst_pitch i32) (local $src_pitch i32)
    (local $sx i32) (local $sy i32) (local $sw i32) (local $sh i32)
    (local $bps i32) (local $row i32) (local $trans i32)
    (call $d3dim_worker_fence)
    (local.set $dst_entry (call $dx_from_this (local.get $arg0)))
    ;; Microsoft explicitly excludes clipping from BltFast. The receiver is
    ;; the destination surface, so any attached clipper makes this call fail;
    ;; callers that need clipping must use Blt.
    (if (call $dx_surface_clipper_get (local.get $dst_entry))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DDERR_UNSUPPORTED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (local.set $dst_dib (load.field DxObject misc1 (local.get $dst_entry)))
    (local.set $dst_w (load.field DxObject width (local.get $dst_entry)))
    (local.set $dst_h (load.field DxObject height (local.get $dst_entry)))
    (local.set $dst_pitch (load.field DxObject pitch (local.get $dst_entry)))
    (local.set $bps (i32.div_u (load.field DxObject bpp (local.get $dst_entry)) (i32.const 8)))
    (call $dx_surf_note_write (local.get $dst_entry))
    (if (i32.eqz (local.get $arg3))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (local.set $src_entry (call $dx_from_this (local.get $arg3)))
    (local.set $src_dib (load.field DxObject misc1 (local.get $src_entry)))
    (local.set $src_full_w (load.field DxObject width (local.get $src_entry)))
    (local.set $src_full_h (load.field DxObject height (local.get $src_entry)))
    (local.set $src_pitch (load.field DxObject pitch (local.get $src_entry)))
    (local.set $trans (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))) ;; dwTrans (6th arg)
    (call $host_dx_trace (i32.const 14) (call $dx_slot_of (local.get $dst_entry))
      (call $dx_slot_of (local.get $src_entry))
      (local.get $arg1) (local.get $arg2))
    (call $host_dx_trace (i32.const 11) (call $dx_slot_of (local.get $dst_entry))
      (call $dx_slot_of (local.get $src_entry))
      (load.field DxObject misc2 (local.get $src_entry))
      (local.get $trans))
    ;; Parse source rect
    (if (local.get $arg4)
      (then
        (local.set $sx (call $gl32 (local.get $arg4)))
        (local.set $sy (call $gl32 (i32.add (local.get $arg4) (i32.const 4))))
        (local.set $sw (i32.sub (call $gl32 (i32.add (local.get $arg4) (i32.const 8))) (local.get $sx)))
        (local.set $sh (i32.sub (call $gl32 (i32.add (local.get $arg4) (i32.const 12))) (local.get $sy))))
      (else
        (local.set $sx (i32.const 0)) (local.set $sy (i32.const 0))
        (local.set $sw (load.field DxObject width (local.get $src_entry)))
        (local.set $sh (load.field DxObject height (local.get $src_entry)))))
    ;; BltFast does not take a clipper. Treat fully out-of-bounds requests as
    ;; no-ops and clip partial requests so bad animation coordinates cannot
    ;; escape the surface DIB.
    (if (i32.or
          (i32.or
            (i32.ge_u (local.get $arg1) (local.get $dst_w))
            (i32.ge_u (local.get $arg2) (local.get $dst_h)))
          (i32.or
            (i32.ge_u (local.get $sx) (local.get $src_full_w))
            (i32.ge_u (local.get $sy) (local.get $src_full_h))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (if (i32.gt_u (local.get $sw) (i32.sub (local.get $src_full_w) (local.get $sx)))
      (then (local.set $sw (i32.sub (local.get $src_full_w) (local.get $sx)))))
    (if (i32.gt_u (local.get $sh) (i32.sub (local.get $src_full_h) (local.get $sy)))
      (then (local.set $sh (i32.sub (local.get $src_full_h) (local.get $sy)))))
    (if (i32.gt_u (local.get $sw) (i32.sub (local.get $dst_w) (local.get $arg1)))
      (then (local.set $sw (i32.sub (local.get $dst_w) (local.get $arg1)))))
    (if (i32.gt_u (local.get $sh) (i32.sub (local.get $dst_h) (local.get $arg2)))
      (then (local.set $sh (i32.sub (local.get $dst_h) (local.get $arg2)))))
    (if (i32.or (i32.eqz (local.get $sw)) (i32.eqz (local.get $sh)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    ;; DDBLTFAST_SRCCOLORKEY = 0x1, DDBLTFAST_DESTCOLORKEY = 0x2
    (if (i32.and (local.get $trans) (i32.const 0x01))
      (then
        ;; Source color key blit
        (call $dx_ckey_copy_rect
          (local.get $dst_dib) (local.get $dst_pitch) (local.get $arg1) (local.get $arg2)
          (local.get $src_dib) (local.get $src_pitch) (local.get $sx) (local.get $sy)
          (local.get $sw) (local.get $sh) (local.get $bps)
          (load.field DxObject misc2 (local.get $src_entry))))
      (else
        ;; No color key — fast row copies
        (local.set $row (i32.const 0))
        (block $bf_done (loop $bf_row
          (br_if $bf_done (i32.ge_u (local.get $row) (local.get $sh)))
          (call $memcpy
            (i32.add (local.get $dst_dib)
              (i32.add (i32.mul (i32.add (local.get $arg2) (local.get $row)) (local.get $dst_pitch))
                       (i32.mul (local.get $arg1) (local.get $bps))))
            (i32.add (local.get $src_dib)
              (i32.add (i32.mul (i32.add (local.get $sy) (local.get $row)) (local.get $src_pitch))
                       (i32.mul (local.get $sx) (local.get $bps))))
            (i32.mul (local.get $sw) (local.get $bps)))
          (local.set $row (i32.add (local.get $row) (i32.const 1)))
          (br $bf_row)))))
    ;; If dest is primary, present
    (if (i32.and (load.field DxObject flags (local.get $dst_entry)) (i32.const 1))
      (then
        (call $dx_present (local.get $dst_entry))
        (call $present_pace_full_blit (local.get $dst_entry) (local.get $sw) (local.get $sh))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))) ;; 6 args

  ;; DeleteAttachedSurface(this, dwFlags, lpDDSAttachedSurface). Only explicit
  ;; AddAttachedSurface relationships may be removed; DirectDraw-created flip
  ;; chains in misc0 are implicit and cannot be detached through this method.
  ;; Passing NULL removes every explicit child and releases the reference that
  ;; AddAttachedSurface retained for each one.
  (func $dx_surface_delete_attached
      (param $parent_guest i32) (param $flags i32) (param $child_guest i32)
      (result i32)
    (local $parent i32) (local $child i32) (local $slot i32) (local $parent_id i32)
    (call $d3dim_worker_fence)
    (if (local.get $flags)
      (then (return (i32.const 0x80070057)))) ;; DDERR_INVALIDPARAMS
    (local.set $parent (call $dx_from_this (local.get $parent_guest)))
    (if (i32.ne (load.field DxObject type (local.get $parent)) (i32.const 2))
      (then (return (i32.const 0x88760082)))) ;; DDERR_INVALIDOBJECT
    (local.set $parent_id
      (i32.add (call $dx_slot_of (local.get $parent)) (i32.const 1)))
    (if (local.get $child_guest)
      (then
        (local.set $child (call $dx_from_this (local.get $child_guest)))
        (if (i32.ne (load.field DxObject type (local.get $child)) (i32.const 2))
          (then (return (i32.const 0x88760082)))) ;; DDERR_INVALIDOBJECT
        (if (i32.eq (load.field DxObject misc0 (local.get $parent))
                    (local.get $child_guest))
          (then (return (i32.const 0x88760014)))) ;; DDERR_CANNOTDETACHSURFACE
        (if (i32.ne
              (i32.load offset=4 (call $dx_surf_meta_ptr (local.get $child)))
              (local.get $parent_id))
          (then (return (i32.const 0x887601CC)))) ;; DDERR_SURFACENOTATTACHED
        ;; Clear first: final Release may recycle this slot.
        (i32.store offset=4 (call $dx_surf_meta_ptr (local.get $child)) (i32.const 0))
        (drop (call $dx_surface_release (local.get $child_guest)))
        (return (i32.const 0)))) ;; DD_OK
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $slot) (global.get $DX_MAX)))
      (local.set $child (i32.add (global.get $DX_OBJECTS)
        (i32.shl (local.get $slot) (i32.const 5))))
      (if (i32.and
            (i32.eq (load.field DxObject type (local.get $child)) (i32.const 2))
            (i32.eq (i32.load offset=4 (call $dx_surf_meta_ptr (local.get $child)))
              (local.get $parent_id)))
        (then
          (i32.store offset=4 (call $dx_surf_meta_ptr (local.get $child)) (i32.const 0))
          (drop (call $dx_surface_release
            (call $w2g (i32.add (global.get $COM_WRAPPERS)
              (i32.shl (local.get $slot) (i32.const 3))))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0)) ;; DD_OK

  (func $handle_IDirectDrawSurface_DeleteAttachedSurface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dx_surface_delete_attached
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Enumerate the directly attached surface.  Our flip-chain model links one
  ;; backbuffer from entry+8; explicit AddAttachedSurface calls retain the
  ;; parent slot in DX_SURF_META, so scan for the first such direct child when
  ;; there is no implicit backbuffer.  Win9x AddRefs each interface handed to
  ;; the callback, which then owns that reference.
  (func $handle_IDirectDrawSurface_EnumAttachedSurfaces (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $parent i32) (local $child i32) (local $child_entry i32)
    (local $desc i32) (local $ret_addr i32) (local $slot i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $parent (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $parent)) (i32.const 2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $child (load.field.memarg DxObject misc0 (local.get $parent)))
    (if (i32.eqz (local.get $child))
      (then
        (block $found (loop $scan
          (br_if $found (i32.ge_u (local.get $slot) (global.get $DX_MAX)))
          (local.set $child_entry
            (i32.add (global.get $DX_OBJECTS)
              (i32.shl (local.get $slot) (i32.const 5))))
          (if (i32.and
                (i32.eq (i32.load (local.get $child_entry)) (i32.const 2))
                (i32.eq (i32.load offset=4 (call $dx_surf_meta_ptr (local.get $child_entry)))
                  (i32.add (call $dx_slot_of (local.get $parent)) (i32.const 1))))
            (then
              (local.set $child
                (call $w2g
                  (i32.add (global.get $COM_WRAPPERS)
                    (i32.shl (local.get $slot) (i32.const 3)))))
              (br $found)))
          (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
          (br $scan)))))
    (if (local.get $child)
      (then
        (local.set $child_entry (call $dx_from_this (local.get $child)))
        (if (i32.ne (i32.load (local.get $child_entry)) (i32.const 2))
          (then (local.set $child (i32.const 0))))))
    ;; No direct (or still-live) attachment is a successful empty enumeration.
    (if (i32.eqz (local.get $child))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $desc (call $heap_alloc (i32.const 108)))
    (if (i32.eqz (local.get $desc))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; E_OUTOFMEMORY
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $dx_fill_surface_desc (call $g2w (local.get $desc)) (local.get $child_entry))
    (i32.store offset=4 (local.get $child_entry)
      (i32.add (i32.load offset=4 (local.get $child_entry)) (i32.const 1)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    ;; Saved caller return, then callback args right-to-left: context,
    ;; DDSURFACEDESC, attached surface. CACA0007 finishes with DD_OK.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $desc))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $child))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $ddenum_ret_thunk))
    (global.set $eip (local.get $arg2))
    (global.set $steps (i32.const 0)))

  (func $handle_IDirectDrawSurface_EnumOverlayZOrders (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Flip(this, lpDDSurfaceTargetOverride, dwFlags)
  (func $handle_IDirectDrawSurface_Flip (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $back_guest i32) (local $back_entry i32)
    (local $tmp_dib i32)
    ;; Real hardware Flip blocks until the retrace unless DDFLIP_NOVSYNC
    ;; (0x00000008) is set. Ours does not, by default: making every Flip wait
    ;; changes the pacing of every Flip-presenting game in the corpus at once,
    ;; and the acceptance case for vsync (DX-Ball) does not need it -- it takes
    ;; its Flip path off the WaitForVerticalBlank calibration alone. So this is
    ;; opt-in ($dx_flip_vsync, --flip-vsync) until each of those games has been
    ;; measured with it on. The park has to happen BEFORE any of the work
    ;; below, because the handler re-runs from the top on resume.
    (if (i32.and (i32.ne (global.get $dx_flip_vsync) (i32.const 0))
                 (i32.eqz (i32.and (local.get $arg2) (i32.const 0x00000008))))
      (then
        (if (i32.eqz (call $vblank_wait_elapsed))
          (then
            ;; DDFLIP_DONOTWAIT (0x00000020): the caller explicitly asked not
            ;; to be blocked, so tell it the flip is still outstanding instead
            ;; of parking. Its retry loop comes back and eventually finds the
            ;; boundary passed.
            (if (i32.and (local.get $arg2) (i32.const 0x00000020))
              (then
                (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876021C)) ;; DDERR_WASSTILLDRAWING
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
                (return)))
            (call $vblank_block)
            (return)))
        (global.set $vblank_wait_active (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $back_guest (load.field DxObject misc0 (local.get $entry)))
    ;; With a render Worker still drawing this frame, queue the swap behind
    ;; those draws and return: the guest simulates the next frame while this
    ;; one rasterizes. The present waits for the next fence, and a second
    ;; Flip fences first, so at most one frame is ever in flight.
    (if (local.get $back_guest)
      (then
        (local.set $back_entry (call $dx_from_this (local.get $back_guest)))
        (if (call $d3dim_worker_try_flip (local.get $entry) (local.get $back_entry))
          (then
            (call $host_dx_trace (i32.const 6) (call $dx_slot_of (local.get $entry))
              (call $dx_slot_of (local.get $back_entry))
              (load.field DxObject misc1 (local.get $back_entry))
              (load.field DxObject misc1 (local.get $entry)))
            (call $present_frame_end)
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))))
    (call $d3dim_worker_fence)
    (if (local.get $back_guest)
      (then
        (local.set $back_entry (call $dx_from_this (local.get $back_guest)))
        ;; Swap DIB pointers
        (local.set $tmp_dib (load.field DxObject misc1 (local.get $entry)))
        (store.field DxObject misc1 (local.get $entry) (load.field DxObject misc1 (local.get $back_entry)))
        (store.field DxObject misc1 (local.get $back_entry) (local.get $tmp_dib))
        (call $host_dx_trace (i32.const 6) (call $dx_slot_of (local.get $entry))
          (call $dx_slot_of (local.get $back_entry))
          (load.field DxObject misc1 (local.get $entry))
          (local.get $tmp_dib))
        ;; Present front buffer
        (call $dx_present (local.get $entry))
        (call $present_frame_end)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetAttachedSurface(this, lpDDSCaps, lplpDDAttachedSurface)
  ;; Resolve only wrappers this runtime actually owns, without dx_from_this's
  ;; invalid-slot clamp (which can alias an unrelated live object in slot 0).
  (func $ddraw_surface_entry_checked (param $this i32) (result i32)
    (local $offset i32) (local $wa i32) (local $slot i32) (local $entry i32)
    (local.set $offset (i32.sub (local.get $this) (call $w2g (global.get $COM_WRAPPERS))))
    (if (i32.lt_u (local.get $offset) (global.get $COM_WRAPPERS_SIZE))
      (then (local.set $wa (i32.add (global.get $COM_WRAPPERS) (local.get $offset))))
      (else
        (local.set $offset (i32.sub (local.get $this) (call $w2g (global.get $COM_WRAPPERS_AUX))))
        (if (i32.ge_u (local.get $offset) (global.get $COM_WRAPPERS_AUX_SIZE))
          (then (return (i32.const 0))))
        (if (i32.ge_u (i32.shr_u (local.get $offset) (i32.const 3))
              (i32.load (global.get $COM_AUX_NEXT_SHARED)))
          (then (return (i32.const 0))))
        (local.set $wa (i32.add (global.get $COM_WRAPPERS_AUX) (local.get $offset)))))
    (if (i32.and (local.get $offset) (i32.const 7)) (then (return (i32.const 0))))
    (if (i32.eqz (i32.load (local.get $wa))) (then (return (i32.const 0))))
    (local.set $slot (i32.load offset=4 (local.get $wa)))
    (if (i32.ge_u (local.get $slot) (global.get $DX_MAX)) (then (return (i32.const 0))))
    (local.set $entry (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $slot) (i32.const 5))))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 2))
      (then (return (i32.const 0))))
    (if (i32.le_s (load.field DxObject refcount (local.get $entry)) (i32.const 0))
      (then (return (i32.const 0))))
    (local.get $entry))

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
    (local.set $child (load.field DxObject misc0 (local.get $entry)))
    (if (local.get $child)
      (then
        (local.set $child_entry (call $ddraw_surface_entry_checked (local.get $child)))
        (if (i32.eqz (local.get $child_entry)) (then (local.set $child (i32.const 0))))
        (local.set $requested (call $gl32 (local.get $arg1)))
        (if (local.get $child_entry)
          (then (local.set $actual (i32.load (call $dx_surf_meta_ptr (local.get $child_entry))))))))
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

  ;; Browser-backed blits complete before their handlers return, so either
  ;; documented status query succeeds immediately on a live surface. Reject
  ;; stale wrappers and malformed flags rather than extending that shortcut.
  (func $handle_IDirectDrawSurface_GetBltStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eqz (call $ddraw_surface_live (local.get $arg0)))
        (then (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (else
          (if (result i32)
              (i32.or
                (i32.eq (local.get $arg1) (i32.const 1)) ;; DDGBS_CANBLT
                (i32.eq (local.get $arg1) (i32.const 2))) ;; DDGBS_ISBLTDONE
            (then (i32.const 0)) ;; DD_OK
            (else (i32.const 0x80070057)))))) ;; DDERR_INVALIDPARAMS
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetCaps(this, lpDDSCaps): legacy Surface1/2/3 DDSCAPS is one dword.
  ;; Report the same allocation metadata as GetSurfaceDesc. Synthesizing caps
  ;; from primary/back/offscreen roles discarded VIDEOMEMORY and made SDL
  ;; reject successful hardware-surface creation as "No room in video memory".
  (func $handle_IDirectDrawSurface_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $hr i32)
    (if (i32.eqz (call $ddraw_surface_live (local.get $arg0)))
      (then (local.set $hr (i32.const 0x88760082))) ;; DDERR_INVALIDOBJECT
      (else
        ;; Four bytes cross at most one guest page boundary. Check both ends
        ;; without raising a guest access fault, then gs32 handles split pages.
        (if (i32.or
              (i32.or (i32.eqz (local.get $arg1))
                (i32.gt_u (local.get $arg1) (i32.const -4)))
              (i32.or (i32.eqz (call $guest_addr_mapped (local.get $arg1)))
                (i32.eqz (call $guest_addr_mapped (i32.add (local.get $arg1) (i32.const 3))))))
          (then (local.set $hr (i32.const 0x80070057))) ;; DDERR_INVALIDPARAMS
          (else
            (local.set $entry (call $dx_from_this (local.get $arg0)))
            (call $gs32 (local.get $arg1)
              (i32.load (call $dx_surf_meta_ptr (local.get $entry))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetClipper(this, lplpDDClipper) — return an independently owned COM
  ;; reference to the surface's current clipper.
  (func $handle_IDirectDrawSurface_GetClipper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $clipper i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $gs32 (local.get $arg1) (i32.const 0))
    (local.set $clipper (call $dx_surface_clipper_get (local.get $entry)))
    (if (i32.eqz (local.get $clipper))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760238)) ;; DDERR_NOCLIPPERATTACHED = MAKE_DDHRESULT(568)
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (drop (call $dx_com_addref (local.get $clipper)))
    (call $gs32 (local.get $arg1) (local.get $clipper))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetColorKey(this, dwFlags, lpDDColorKey)
  (func $handle_IDirectDrawSurface_GetColorKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 0x100))
      (then
        (call $gs32 (local.get $arg2) (load.field DxObject misc2 (local.get $entry)))
        (call $gs32 (i32.add (local.get $arg2) (i32.const 4)) (load.field DxObject misc2 (local.get $entry)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        ;; No key set: DDERR_NOCOLORKEY. Daytona USA Deluxe tolerates exactly
        ;; this code and treats any other failure as fatal.
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x887600D7))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetDC(this, lphDC) — return a synthetic HDC for GDI operations on the surface
  ;; HDC = 0x200000 + slot_index (unique range, doesn't conflict with hwnd-based DCs)
  (func $handle_IDirectDrawSurface_GetDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $slot i32) (local $hdc i32)
    ;; GDI reads and writes the surface bits directly.
    (call $d3dim_worker_fence)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $slot (i32.div_u
      (i32.sub (local.get $entry) (global.get $DX_OBJECTS))
      (i32.const 32)))
    (local.set $hdc (i32.add (i32.const 0x200000) (local.get $slot)))
    (if (call $gdi_dx_dc_bind (local.get $hdc))
      (then
        (call $gs32 (local.get $arg1) (local.get $hdc))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))) ;; DD_OK
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760096)))) ;; DDERR_GENERIC
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetFlipStatus — always DD_OK
  (func $handle_IDirectDrawSurface_GetFlipStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectDrawSurface_GetOverlayPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetPalette — return a fresh palette COM wrapper (d3drm dereferences the pointer, so null isn't safe;
  ;; and DDERR_NOPALETTEATTACHED propagates up as a fatal DXException in d3drm-based screensavers).
  ;; GetPalette(this, lplpDDPalette) — the returned object must be bound to the
  ;; palette this surface actually carries. Handing back a bare DDPAL object
  ;; with no data pointer makes the very next IDirectDrawPalette::GetEntries a
  ;; no-op, so the caller reads back an all-zero colour table and every pixel it
  ;; converts comes out black: that is why d3drm turned Organic Art's palettized
  ;; leaf textures into black silhouettes.
  (func $handle_IDirectDrawSurface_GetPalette (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32) (local $pal_wa i32)
    (local.set $pal_wa (call $dx_surf_pal_get (call $dx_from_this (local.get $arg0))))
    (if (i32.eqz (local.get $pal_wa))
      (then (local.set $pal_wa (call $dx_primary_pal_get))))
    (if (i32.eqz (local.get $pal_wa))
      (then
        (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
        ;; MAKE_DDHRESULT(572). d3drm's CreateDevice tolerates exactly this
        ;; value and treats every other failure as fatal, so an approximate
        ;; error code here reads to it as "this device cannot be created".
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876023C)) ;; DDERR_NOPALETTEATTACHED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $obj_guest (call $dx_create_com_obj (i32.const 3) (global.get $DX_VTBL_DDPAL)))
    (store.field DxObject misc1 (call $dx_from_this (local.get $obj_guest)) (local.get $pal_wa))
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (local.get $obj_guest))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Fill a 32-byte DDPIXELFORMAT at $pf_wa describing a surface of $bpp.
  ;; An 8bpp surface is DDPF_PALETTEINDEXED8, NOT DDPF_RGB with 5-6-5 masks:
  ;; a caller that believes the masks reads each index byte as if it were a
  ;; 565 word, which leaves R always 0, G in 0..7 and B in 0..31 -- dark blue
  ;; noise. That is exactly what d3drm produced when it converted Organic Art's
  ;; palettized leaf textures into the device's 16bpp texture surfaces, and why
  ;; every leaf in those screensavers came out flat blue and black.
  (func $dx_fill_pixel_format (param $pf_wa i32) (param $bpp i32)
    (call $zero_memory (local.get $pf_wa) (i32.const 32))
    (i32.store (local.get $pf_wa) (i32.const 32))                 ;; dwSize
    (i32.store (i32.add (local.get $pf_wa) (i32.const 8)) (i32.const 0)) ;; dwFourCC
    (i32.store (i32.add (local.get $pf_wa) (i32.const 12)) (local.get $bpp))
    (if (i32.eq (local.get $bpp) (i32.const 8)) (then
      ;; DDPF_RGB | DDPF_PALETTEINDEXED8
      (i32.store (i32.add (local.get $pf_wa) (i32.const 4)) (i32.const 0x60))
      (return)))
    (if (i32.eq (local.get $bpp) (i32.const 4)) (then
      ;; DDPF_RGB | DDPF_PALETTEINDEXED4
      (i32.store (i32.add (local.get $pf_wa) (i32.const 4)) (i32.const 0x48))
      (return)))
    (i32.store (i32.add (local.get $pf_wa) (i32.const 4)) (i32.const 0x40)) ;; DDPF_RGB
    (if (i32.eq (local.get $bpp) (i32.const 16))
      (then
        (i32.store (i32.add (local.get $pf_wa) (i32.const 16)) (i32.const 0xF800))
        (i32.store (i32.add (local.get $pf_wa) (i32.const 20)) (i32.const 0x07E0))
        (i32.store (i32.add (local.get $pf_wa) (i32.const 24)) (i32.const 0x001F)))
      (else
        (i32.store (i32.add (local.get $pf_wa) (i32.const 16)) (i32.const 0x00FF0000))
        (i32.store (i32.add (local.get $pf_wa) (i32.const 20)) (i32.const 0x0000FF00))
        (i32.store (i32.add (local.get $pf_wa) (i32.const 24)) (i32.const 0x000000FF)))))

  (func $dx_fill_surface_pixel_format (param $pf_wa i32) (param $entry i32)
    (local $bpp i32) (local $fmt i32)
    (local.set $bpp (load.field.memarg DxObject bpp (local.get $entry)))
    (local.set $fmt (call $dx_surf_fmt_get (local.get $entry)))
    (call $dx_fill_pixel_format (local.get $pf_wa) (local.get $bpp))
    (if (i32.eq (local.get $fmt) (i32.const 2)) (then
      (i32.store offset=16 (local.get $pf_wa) (i32.const 0x7C00))
      (i32.store offset=20 (local.get $pf_wa) (i32.const 0x03E0))
      (i32.store offset=24 (local.get $pf_wa) (i32.const 0x001F))
      (i32.store offset=28 (local.get $pf_wa) (i32.const 0))))
    (if (i32.eq (local.get $fmt) (i32.const 3)) (then
      (i32.store offset=4 (local.get $pf_wa) (i32.const 0x41))
      (i32.store offset=16 (local.get $pf_wa) (i32.const 0x7C00))
      (i32.store offset=20 (local.get $pf_wa) (i32.const 0x03E0))
      (i32.store offset=24 (local.get $pf_wa) (i32.const 0x001F))
      (i32.store offset=28 (local.get $pf_wa) (i32.const 0x8000))))
    (if (i32.eq (local.get $fmt) (i32.const 4)) (then
      (i32.store offset=4 (local.get $pf_wa) (i32.const 0x41))
      (i32.store offset=16 (local.get $pf_wa) (i32.const 0x0F00))
      (i32.store offset=20 (local.get $pf_wa) (i32.const 0x00F0))
      (i32.store offset=24 (local.get $pf_wa) (i32.const 0x000F))
      (i32.store offset=28 (local.get $pf_wa) (i32.const 0xF000))))
    (if (i32.eq (local.get $fmt) (i32.const 5)) (then
      (i32.store offset=4 (local.get $pf_wa) (i32.const 0x41))
      (i32.store offset=28 (local.get $pf_wa) (i32.const 0xFF000000)))))

  ;; Fill the legacy 108-byte DDSURFACEDESC used by DirectDraw 1-3 surface
  ;; methods and callbacks.  Keep one canonical layout so enumeration cannot
  ;; drift from GetSurfaceDesc.
  (func $dx_fill_surface_desc (param $wa i32) (param $entry i32)
    (call $zero_memory (local.get $wa) (i32.const 108))
    (i32.store (local.get $wa) (i32.const 108))
    (i32.store offset=4 (local.get $wa) (i32.const 0x100F))
    (i32.store offset=8 (local.get $wa) (load.field.memarg DxObject height (local.get $entry)))
    (i32.store offset=12 (local.get $wa) (load.field.memarg DxObject width (local.get $entry)))
    (i32.store offset=16 (local.get $wa) (load.field.memarg DxObject pitch (local.get $entry)))
    (call $dx_fill_surface_pixel_format (i32.add (local.get $wa) (i32.const 72))
      (local.get $entry))
    (if (i32.and (load.field.memarg DxObject flags (local.get $entry)) (i32.const 1))
      (then
        (if (load.field.memarg DxObject misc0 (local.get $entry))
          (then
            (i32.store offset=4 (local.get $wa) (i32.const 0x102F))
            (i32.store offset=20 (local.get $wa) (i32.const 1))))))
    (i32.store offset=104 (local.get $wa)
      (i32.load (call $dx_surf_meta_ptr (local.get $entry))))
    (call $dx_dxt_fix_desc (local.get $wa) (local.get $entry)))

  ;; GetPixelFormat(this, lpDDPixelFormat)
  (func $handle_IDirectDrawSurface_GetPixelFormat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $bpp i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $bpp (call $dx_display_bpp_get))
    (if (local.get $entry)
      (then (local.set $bpp (i32.and (i32.load (i32.add (local.get $entry) (i32.const 16))) (i32.const 0xFFFF)))))
    (if (i32.eqz (local.get $bpp)) (then (local.set $bpp (i32.const 16))))
    (if (local.get $entry)
      (then (call $dx_fill_surface_pixel_format (call $g2w (local.get $arg1)) (local.get $entry)))
      (else (call $dx_fill_pixel_format (call $g2w (local.get $arg1)) (local.get $bpp))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetSurfaceDesc(this, lpDDSD)
  (func $handle_IDirectDrawSurface_GetSurfaceDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $wa i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (call $dx_fill_surface_desc (local.get $wa) (local.get $entry))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; DirectDraw creates every surface already initialized. This COM-compliance
  ;; method therefore always rejects a second initialization attempt.
  (func $handle_IDirectDrawSurface_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760005)) ;; DDERR_ALREADYINITIALIZED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $ddraw_surface_live (param $this i32) (result i32)
    (local $entry i32)
    (if (i32.eqz (local.get $this)) (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 2)))

  ;; Browser-backed surface memory remains allocated for a live surface. A
  ;; stale or foreign COM wrapper is not a surface and must not inherit DD_OK.
  (func $handle_IDirectDrawSurface_IsLost (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (call $ddraw_surface_live (local.get $arg0))
        (then (i32.const 0)) ;; DD_OK: memory retained
        (else (i32.const 0x88760082)))) ;; DDERR_INVALIDOBJECT
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Lock(this, lpDestRect, lpDDSD, dwFlags, hEvent) — 5 args
  (func $handle_IDirectDrawSurface_Lock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $wa i32) (local $dib_wa i32) (local $dib_guest i32)
    (local $left i32) (local $top i32) (local $bpp i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (call $host_dx_trace (i32.const 1) (call $dx_slot_of (local.get $entry))
      (load.field DxObject flags (local.get $entry))
      (load.field DxObject misc1 (local.get $entry))
      (i32.const 0))
    (call $d3dim_lock_fence (local.get $entry))
    (local.set $wa (call $g2w (local.get $arg2)))
    ;; Fill DDSURFACEDESC
    (call $zero_memory (local.get $wa) (i32.const 108))
    (i32.store (local.get $wa) (i32.const 108))
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x100F))
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (load.field DxObject height (local.get $entry)))
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (load.field DxObject width (local.get $entry)))
    (i32.store (i32.add (local.get $wa) (i32.const 16)) (load.field DxObject pitch (local.get $entry)))
    ;; lpSurface points at the upper-left pixel of lpDestRect, while lPitch
    ;; remains the full surface stride. Callers can therefore treat (0,0) as
    ;; the requested rectangle's origin without losing the parent pitch.
    (local.set $dib_wa (load.field DxObject misc1 (local.get $entry)))
    (if (local.get $arg1)
      (then
        (local.set $left (call $gl32 (local.get $arg1)))
        (local.set $top (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
        (local.set $bpp (load.field DxObject bpp (local.get $entry)))
        (local.set $dib_wa
          (i32.add (local.get $dib_wa)
            (i32.add
              (i32.mul (local.get $top)
                (load.field DxObject pitch (local.get $entry)))
              (i32.div_u (i32.mul (local.get $left) (local.get $bpp))
                         (i32.const 8)))))))
    (local.set $dib_guest (call $w2g (local.get $dib_wa)))
    (i32.store (i32.add (local.get $wa) (i32.const 36)) (local.get $dib_guest))
    (call $dx_fill_surface_pixel_format (i32.add (local.get $wa) (i32.const 72)) (local.get $entry))
    (call $dx_dxt_fix_desc (local.get $wa) (local.get $entry))
    (global.set $present_lock_whole
      (select (local.get $entry) (i32.const 0)
        (i32.and (i32.eqz (local.get $arg1))
          (i32.ne (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1)) (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))) ;; 5 args

  ;; ReleaseDC drops transient HDC state, not the surface presentation cache.
  ;; WAT has already written
  ;; GDI output directly into the surface's native DIB.
  (func $handle_IDirectDrawSurface_ReleaseDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $slot i32)
    (call $d3dim_worker_fence)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (call $gdi_dx_dc_release (local.get $arg1))
    ;; If primary, present on ReleaseDC (mirrors Unlock). Apps like ddex2
    ;; draw via GetDC/StretchBlt/ReleaseDC without ever calling Lock/Unlock,
    ;; so without this the DIB update never reaches the screen.
    (if (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1))
      (then (call $dx_present (local.get $entry))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; A live browser-backed surface has retained memory, so restoring it is an
  ;; idempotent success. Invalid/released wrappers cannot be restored.
  (func $handle_IDirectDrawSurface_Restore (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (call $ddraw_surface_live (local.get $arg0))
        (then (i32.const 0)) ;; DD_OK
        (else (i32.const 0x88760082)))) ;; DDERR_INVALIDOBJECT
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; SetClipper(this, lpDDClipper) — the surface owns one clipper reference.
  ;; Repeating the same underlying object is neutral; replacement retains the
  ;; new object before releasing the old, and NULL detaches the current one.
  (func $handle_IDirectDrawSurface_SetClipper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $clipper_entry i32)
    (local $old_clipper i32) (local $old_entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $old_clipper (call $dx_surface_clipper_get (local.get $entry)))
    (if (i32.eqz (local.get $arg1))
      (then
        (if (i32.eqz (local.get $old_clipper))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760238)) ;; DDERR_NOCLIPPERATTACHED = MAKE_DDHRESULT(568)
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))
        (i32.store (call $dx_surface_clipper_ptr (local.get $entry)) (i32.const 0))
        (drop (call $dx_com_release_basic (local.get $old_clipper)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $clipper_entry (call $dx_from_this (local.get $arg1)))
    (if (i32.ne (load.field DxObject type (local.get $clipper_entry)) (i32.const 10))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (local.get $old_clipper)
      (then
        (local.set $old_entry (call $dx_from_this (local.get $old_clipper)))
        (if (i32.eq (local.get $old_entry) (local.get $clipper_entry))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))))
    (drop (call $dx_com_addref (local.get $arg1)))
    (i32.store (call $dx_surface_clipper_ptr (local.get $entry)) (local.get $arg1))
    (if (local.get $old_clipper)
      (then (drop (call $dx_com_release_basic (local.get $old_clipper)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetColorKey(this, dwFlags, lpDDColorKey)
  (func $handle_IDirectDrawSurface_SetColorKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $ck i32) (local $bpp i32)
    (call $d3dim_worker_fence)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    ;; DDCKEY_SRCBLT = 0x8, DDCKEY_DESTBLT = 0x2
    ;; Mask the key to the surface bit-depth: apps sometimes pass 0x0000FFFF
    ;; on 8bpp surfaces, but per-pixel compares load only `bpp` bits, so an
    ;; un-masked key would never match → no transparency.
    (local.set $ck (call $gl32 (local.get $arg2)))
    (local.set $bpp (load.field DxObject bpp (local.get $entry)))
    (if (i32.eq (local.get $bpp) (i32.const 8))
      (then (local.set $ck (i32.and (local.get $ck) (i32.const 0xFF))))
      (else (if (i32.eq (local.get $bpp) (i32.const 16))
        (then (local.set $ck (i32.and (local.get $ck) (i32.const 0xFFFF)))))))
    (store.field DxObject misc2 (local.get $entry) (local.get $ck)) ;; dwColorSpaceLowValue
    ;; Set has_colorkey flag
    (store.field DxObject flags (local.get $entry) (i32.or (load.field DxObject flags (local.get $entry)) (i32.const 0x100)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectDrawSurface_SetOverlayPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; DDSCL_NORMAL realizes logical DirectDraw colors into the system palette.
  ;; PC_NOCOLLAPSE uses the 236 dynamic slots; bitmap bytes are physical
  ;; indices (Microsoft Game SDK KB140588). Exclusive mode stays unremapped.
  (func $dx_sync_indexed_desktop_palette (param $entry i32)
    (if (i32.or (call $dx_exclusive_get)
          (i32.ne (call $gdi_display_bpp) (i32.const 8))) (then (return)))
    (drop (call $gdi_realize_palette_entries
      ;; High-bit tagged DX slots cannot collide with canonical GDI handles.
      (i32.or (i32.const 0x80000000) (call $dx_slot_of (local.get $entry)))
      (load.field DxObject misc1 (local.get $entry)) (i32.const 256) (i32.const 1))))

  ;; SetPalette(this, lpDDPalette) — associate palette with surface
  (func $handle_IDirectDrawSurface_SetPalette (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pal_entry i32) (local $surf_entry i32) (local $pal_wa i32)
    (call $d3dim_worker_fence)
    ;; arg0 = this (surface), arg1 = palette COM object guest ptr
    ;; Look up the palette entry and store its data pointer for 8bpp present
    (if (local.get $arg1)
      (then
        (local.set $pal_entry (call $dx_from_this (local.get $arg1)))
        (local.set $pal_wa (load.field DxObject misc1 (local.get $pal_entry)))
        ;; Per-surface, so an 8bpp texture's palette does not overwrite (or get
        ;; overwritten by) the display palette.
        (local.set $surf_entry (call $dx_from_this (local.get $arg0)))
        (call $dx_surf_pal_set (local.get $surf_entry) (local.get $pal_wa))
        (if (i32.ne
              (i32.and (load.field.memarg DxObject flags (local.get $surf_entry)) (i32.const 1))
              (i32.const 0))
          (then (call $dx_primary_pal_set (local.get $pal_wa))
            (call $dx_sync_indexed_desktop_palette (local.get $pal_entry))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Unlock(this, lpRect)
  (func $handle_IDirectDrawSurface_Unlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (call $host_dx_trace (i32.const 2) (call $dx_slot_of (local.get $entry))
      (load.field DxObject flags (local.get $entry))
      (load.field DxObject misc1 (local.get $entry))
      (i32.const 0))
    (if (i32.eqz (call $d3dim_lazy_unlock (local.get $entry)))
      (then (call $dx_surf_note_cpu_write (local.get $entry))))
    ;; If primary, present on unlock. Pace only the unlock that closes a
    ;; whole-surface Lock: that is a frame drawn straight into the primary
    ;; (Diablo, Elasto Mania's menus); a rect lock is one sprite of many.
    (if (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1))
      (then
        (call $dx_present (local.get $entry))
        (if (i32.eq (global.get $present_lock_whole) (local.get $entry))
          (then
            (global.set $present_lock_whole (i32.const 0))
            (call $present_frame_end)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectDrawSurface_UpdateOverlay (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_IDirectDrawSurface_UpdateOverlayDisplay (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectDrawSurface_UpdateOverlayZOrder (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirectDrawSurface2 extensions — slots 36-38 beyond IDirectDrawSurface's 36.
  ;; flip3dtl QI's the RT surface for IID_IDirectDrawSurface2 and calls slot 36.
  (func $handle_IDirectDrawSurface2_GetDDInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (global.get $dx_ddraw_this))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectDrawSurface2_PageLock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectDrawSurface2_PageUnlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirectDrawSurface3 extension — slot 39. SDL 1.2 allocates its own
  ;; framebuffer, then attaches it to the DirectDraw surface through this
  ;; method. dwFlags (arg2) is reserved; DDSURFACEDESC.dwFlags selects fields.
  (func $handle_IDirectDrawSurface3_SetSurfaceDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $desc i32) (local $flags i32) (local $pixels i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.and
          (i32.ne (local.get $entry) (i32.const 0))
          (i32.ne (local.get $arg1) (i32.const 0)))
      (then
        (local.set $desc (call $g2w (local.get $arg1)))
        (local.set $flags (i32.load offset=4 (local.get $desc)))
        ;; DDSD_PITCH
        ;; Drain using the OLD backing and extent before either field changes.
        ;; An untouched lazy Unlock may have left GPU-owned pixels pending;
        ;; the caller may immediately reuse the detached backing allocation.
        (if (i32.and (local.get $flags) (i32.const 0x00000808))
          (then (call $d3dim_surface_fence (local.get $entry))))
        (if (i32.and (local.get $flags) (i32.const 0x00000008))
          (then (store.field.memarg DxObject pitch (local.get $entry) (i32.load offset=16 (local.get $desc)))))
        ;; DDSD_LPSURFACE. A null pointer remains null rather than becoming
        ;; g2w(0), which is the mapped base of the guest image.
        (if (i32.and (local.get $flags) (i32.const 0x00000800))
          (then
            (local.set $pixels (i32.load offset=36 (local.get $desc)))
            (store.field.memarg DxObject misc1 (local.get $entry) (if (result i32) (local.get $pixels)
                (then (call $g2w (local.get $pixels)))
                (else (i32.const 0))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; ── Present helper: blit DIB to screen via SetDIBitsToDevice ─
  ;; Constructs a BITMAPINFOHEADER on the stack and calls the existing host import

  ;; Windowed DirectDraw and GDI children share a window surface. The exclusive
  ;; presentation owner instead retains separate primary and GDI child surfaces
  ;; in the compositor. Copying its primary through GDI and invalidating every
  ;; child on each present renews damage even after the guest validates it:
  ;; a child that presents while painting can never drain its message pump.
  (func $dx_window_surface_shared (param $hwnd i32) (result i32)
    (local $slot i32)
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const 0))))
    (if (i32.and
          (i32.ne (call $dx_exclusive_get) (i32.const 0))
          (i32.eq (local.get $hwnd) (call $dx_target_hwnd)))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $gdi_window_surface_record (local.get $hwnd) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $slot (i32.const 0))
    (block $done (loop $scan
      (local.set $slot (call $wnd_next_child_slot (local.get $hwnd) (local.get $slot)))
      (br_if $done (i32.lt_s (local.get $slot) (i32.const 0)))
      (if (call $wnd_is_effectively_visible (call $wnd_slot_hwnd (local.get $slot)))
        (then (return (i32.const 1))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Blit one DirectDraw surface's canonical DIB through GDI onto an
  ;; arbitrary device context. $dx_present uses it for the game window; the
  ;; window-surface seeder uses it for the ordinary top-level windows an app
  ;; stacks over an exclusive-fullscreen primary, which on real hardware share
  ;; that one framebuffer.
  ;; A windowed (non-exclusive) app Blts to its primary in SCREEN coordinates
  ;; -- that is what IDirectDrawClipper::SetHWnd means -- so presenting it
  ;; needs the sub-rect of the primary that lies under the window's client
  ;; area, landed at the client offset inside the window. $dx and $dy are
  ;; window-local destination, $sx/$sy the screen-coordinate source origin,
  ;; and $bw/$bh the size; pass 0,0,0,0 and the full surface size for the
  ;; exclusive case, where the primary IS the window.
  (func $dx_blit_entry_to_hdc (param $entry_wa i32) (param $hdc i32)
    (local $w i32) (local $h i32)
    (local.set $w (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 12))))
    (local.set $h (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 14))))
    (call $dx_blit_entry_rect_to_hdc (local.get $entry_wa) (local.get $hdc)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)
      (local.get $w) (local.get $h)))

  (func $dx_blit_entry_rect_to_hdc (param $entry_wa i32) (param $hdc i32)
      (param $dx i32) (param $dy i32) (param $sx i32) (param $sy i32)
      (param $bw i32) (param $bh i32)
    (local $w i32) (local $h i32) (local $bpp i32) (local $pitch i32)
    (local $dib_wa i32) (local $bmi_wa i32) (local $i i32) (local $val i32)
    (local.set $w (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 12))))
    (local.set $h (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 14))))
    (local.set $bpp (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 16))))
    (local.set $pitch (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 18))))
    (local.set $dib_wa (i32.load (i32.add (local.get $entry_wa) (i32.const 20))))
    (if (i32.eqz (local.get $dib_wa)) (then (return)))
    ;; Build BITMAPINFO in a private DirectDraw scratch area. PAINT_SCRATCH
    ;; at 0xAD40 is reused by window/control paint paths during presentation.
    (local.set $bmi_wa (i32.const 0x00011140))
    (call $zero_memory (local.get $bmi_wa) (i32.const 1064)) ;; 40 + 256*4
    (i32.store (local.get $bmi_wa) (i32.const 40)) ;; biSize
    (i32.store (i32.add (local.get $bmi_wa) (i32.const 4)) (local.get $w))
    ;; Negative height = top-down DIB (DirectDraw surfaces are top-down)
    (i32.store (i32.add (local.get $bmi_wa) (i32.const 8))
      (i32.sub (i32.const 0) (local.get $h)))
    (i32.store16 (i32.add (local.get $bmi_wa) (i32.const 12)) (i32.const 1)) ;; biPlanes
    (i32.store16 (i32.add (local.get $bmi_wa) (i32.const 14)) (local.get $bpp))
    ;; For 8bpp, convert PALETTEENTRY (R,G,B,flags) → RGBQUAD (B,G,R,0)
    (if (i32.and (i32.le_u (local.get $bpp) (i32.const 8)) (i32.ne (call $dx_primary_pal_get) (i32.const 0)))
      (then
        (local.set $i (i32.const 0))
        (block $pd (loop $pl
          (br_if $pd (i32.ge_u (local.get $i) (i32.const 256)))
          (local.set $val (i32.load (i32.add (call $dx_primary_pal_get)
            (i32.shl (local.get $i) (i32.const 2)))))
          ;; swap byte0 (R) and byte2 (B), keep byte1 (G), clear byte3
          (i32.store (i32.add (i32.add (local.get $bmi_wa) (i32.const 40))
              (i32.shl (local.get $i) (i32.const 2)))
            (i32.or (i32.or
              (i32.shl (i32.and (local.get $val) (i32.const 0xFF)) (i32.const 16))
              (i32.and (local.get $val) (i32.const 0xFF00)))
              (i32.and (i32.shr_u (local.get $val) (i32.const 16)) (i32.const 0xFF))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $pl)))))
    ;; A windowed indexed framebuffer holds physical system indices, not
    ;; indices into the logical palette returned by GetPalette/GetEntries.
    (if (i32.and (i32.eq (local.get $bpp) (i32.const 8))
          (i32.and (i32.eqz (call $dx_exclusive_get))
            (i32.eq (call $gdi_display_bpp) (i32.const 8))))
      (then (memory.copy (i32.add (local.get $bmi_wa) (i32.const 40))
        (call $gdi_system_palette) (i32.const 1024))))
    ;; For 16bpp, set BI_BITFIELDS compression and write masks after header
    (if (i32.eq (local.get $bpp) (i32.const 16))
      (then
        (i32.store (i32.add (local.get $bmi_wa) (i32.const 16)) (i32.const 3)) ;; BI_BITFIELDS
        (i32.store (i32.add (local.get $bmi_wa) (i32.const 40)) (i32.const 0xF800))   ;; R mask
        (i32.store (i32.add (local.get $bmi_wa) (i32.const 44)) (i32.const 0x07E0))   ;; G mask
        (i32.store (i32.add (local.get $bmi_wa) (i32.const 48)) (i32.const 0x001F)))) ;; B mask
    ;; Clamp the requested source rect to the surface: a window can be wider
    ;; than the display mode, or hang off the right/bottom edge of it.
    (if (i32.lt_s (local.get $sx) (i32.const 0)) (then (local.set $sx (i32.const 0))))
    (if (i32.lt_s (local.get $sy) (i32.const 0)) (then (local.set $sy (i32.const 0))))
    (if (i32.gt_s (i32.add (local.get $sx) (local.get $bw)) (local.get $w))
      (then (local.set $bw (i32.sub (local.get $w) (local.get $sx)))))
    (if (i32.gt_s (i32.add (local.get $sy) (local.get $bh)) (local.get $h))
      (then (local.set $bh (i32.sub (local.get $h) (local.get $sy)))))
    (if (i32.or (i32.le_s (local.get $bw) (i32.const 0))
                (i32.le_s (local.get $bh) (i32.const 0)))
      (then (return)))
    ;; Vertical source offset is applied to the bits pointer, not passed as
    ;; ySrc: SetDIBitsToDevice narrows the source descriptor's height to the
    ;; band it is given, so a non-zero ySrc would be clipped away against that
    ;; narrowed height. Rows are top-down here, so row $sy starts $sy pitches in.
    (call $gdi_native_set_dib_to_device
      (local.get $hdc)
      (local.get $dx) (local.get $dy) ;; xDest, yDest
      (local.get $bw) (local.get $bh) ;; w, h
      (local.get $sx) (i32.const 0) ;; xSrc, ySrc
      (i32.const 0) (local.get $bh) ;; startScan, cLines
      (i32.add (local.get $dib_wa) (i32.mul (local.get $sy) (local.get $pitch))) ;; bits WASM addr
      (local.get $bmi_wa) ;; bmi WASM addr
      (i32.const 0)) ;; colorUse = DIB_RGB_COLORS
    (drop)
  )


  ;; The DirectDraw surface currently standing in for the display.
  (func $dx_primary_entry (result i32)
    (local $i i32) (local $p i32)
    ;; The newest primary wins: on a mode change the older one is a lost
    ;; surface the app may never release, and it holds no pixels.
    (local.set $p (global.get $dx_primary_wa))
    (if (local.get $p)
      (then
        (if (i32.and
              (i32.and (i32.eq (i32.load (local.get $p)) (i32.const 2))
                (i32.ne (i32.and (i32.load offset=28 (local.get $p)) (i32.const 1)) (i32.const 0)))
              (i32.ne (i32.load offset=20 (local.get $p)) (i32.const 0)))
          (then (return (local.get $p))))
        (global.set $dx_primary_wa (i32.const 0))))
    (local.set $p (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DX_MAX)))
      (local.set $p (i32.add (global.get $DX_OBJECTS)
        (i32.mul (local.get $i) (global.get $DX_ENTRY_SIZE))))
      (if (i32.and
            (i32.and (i32.eq (i32.load (local.get $p)) (i32.const 2))
              (i32.ne (i32.and (i32.load offset=28 (local.get $p)) (i32.const 1)) (i32.const 0)))
            (i32.ne (i32.load offset=20 (local.get $p)) (i32.const 0)))
        (then (return (local.get $p))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Only borderless top-level popups use the exclusive primary as transparent
  ;; backing. Captioned windows paint a complete frame and client of their own;
  ;; reseeding one after that paint overwrites ordinary dialogs on every
  ;; DirectDraw Present. StarCraft exposed this with its fatal MessageBox: the
  ;; title survived a late NC paint while primary pixels replaced the client.
  (func $dx_overlay_needs_primary_seed (param $hwnd i32) (param $target i32) (result i32)
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $hwnd) (local.get $target))
      (then (return (i32.const 0))))
    (if (i32.ne (call $wnd_top_level (local.get $hwnd)) (local.get $hwnd))
      (then (return (i32.const 0))))
    ;; WS_CAPTION = WS_BORDER | WS_DLGFRAME. A borderless Storm menu remains
    ;; eligible; a MessageBox or other captioned dialog owns every pixel.
    (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00C00000))))

  ;; An app holding DDSCL_EXCLUSIVE owns the whole display, and borderless
  ;; windows it puts over the game window draw into that same framebuffer: on
  ;; real hardware the frame shows through wherever the window does not paint.
  ;; Diablo's menus are exactly this -- Storm hangs each one on a screen-sized
  ;; WS_POPUP owned by the game window and paints white text into it with
  ;; ordinary GDI -- so starting that window's surface at COLOR_BTNFACE puts a
  ;; grey slab over the game instead. Start it at the presented frame.
  ;; A popup need not start at screen (0,0). Copy the primary rectangle under
  ;; its window, not the top-left of the display (Diablo's notice starts at
  ;; y=162). Clip negative origins while preserving the destination offset.
  (func $dx_blit_entry_to_overlay (param $entry i32) (param $hwnd i32)
    (local $x i32) (local $y i32) (local $w i32) (local $h i32)
    (local $dx i32) (local $dy i32)
    (call $host_get_window_rect (local.get $hwnd) (global.get $WINDOW_RECT_SCRATCH))
    (local.set $x (i32.load (global.get $WINDOW_RECT_SCRATCH)))
    (local.set $y (i32.load offset=4 (global.get $WINDOW_RECT_SCRATCH)))
    (local.set $w (i32.sub (i32.load offset=8 (global.get $WINDOW_RECT_SCRATCH)) (local.get $x)))
    (local.set $h (i32.sub (i32.load offset=12 (global.get $WINDOW_RECT_SCRATCH)) (local.get $y)))
    (if (i32.lt_s (local.get $x) (i32.const 0))
      (then
        (local.set $dx (i32.sub (i32.const 0) (local.get $x)))
        (local.set $w (i32.add (local.get $w) (local.get $x)))
        (local.set $x (i32.const 0))))
    (if (i32.lt_s (local.get $y) (i32.const 0))
      (then
        (local.set $dy (i32.sub (i32.const 0) (local.get $y)))
        (local.set $h (i32.add (local.get $h) (local.get $y)))
        (local.set $y (i32.const 0))))
    (call $dx_blit_entry_rect_to_hdc (local.get $entry)
      (i32.add (local.get $hwnd) (i32.const 0x40000))
      (local.get $dx) (local.get $dy) (local.get $x) (local.get $y)
      (local.get $w) (local.get $h)))

  (func $dx_seed_overlay_surface (param $hwnd i32)
    (local $entry i32) (local $target i32)
    (if (i32.eqz (call $dx_exclusive_get)) (then (return)))
    (local.set $target (call $dx_target_hwnd))
    (if (i32.eqz (call $dx_overlay_needs_primary_seed
          (local.get $hwnd) (local.get $target)))
      (then (return)))
    (local.set $entry (call $dx_primary_entry))
    (if (i32.eqz (local.get $entry)) (then (return)))
    (call $dx_blit_entry_to_overlay (local.get $entry) (local.get $hwnd)))

  ;; Seeding an overlay once, at surface creation, freezes it on whatever was
  ;; on screen at that instant -- but the framebuffer it shares keeps being
  ;; presented into. Diablo builds its main-menu WS_POPUP while the intro is
  ;; still fading to black, so the seeded surface was black and stayed black,
  ;; covering every frame Storm drew for the rest of the session. Re-seed on
  ;; each present: that is what one shared framebuffer means.
  (func $dx_reseed_overlays (param $entry_wa i32)
    (local $i i32) (local $hwnd i32) (local $target i32)
    (if (i32.eqz (call $dx_exclusive_get)) (then (return)))
    (local.set $target (call $dx_target_hwnd))
    (if (i32.eqz (local.get $target)) (then (return)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (call $wnd_slot_hwnd (local.get $i)))
      ;; Nested, not one flat i32.and. WAT's i32.and is a bitwise operator and
      ;; does not short-circuit, so the flat form called BOTH $wnd_top_level and
      ;; $gdi_window_surface_record for every one of the 256 slots -- including
      ;; the ~250 empty ones whose hwnd is 0 -- and did it again on every
      ;; present. DX-Ball presents once per BltFast, which put 20% of its entire
      ;; wasm time inside a lookup for windows that do not exist. Letting the
      ;; two cheap comparisons gate the two calls costs nothing and skips them.
      (if (call $dx_overlay_needs_primary_seed
            (local.get $hwnd) (local.get $target))
        (then
          (if (call $gdi_window_surface_record (local.get $hwnd) (i32.const 0))
            (then
              (if (call $wnd_is_effectively_visible (local.get $hwnd))
                (then
                  (call $dx_blit_entry_to_overlay (local.get $entry_wa)
                    (local.get $hwnd))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  (func $dx_present (param $entry_wa i32)
    (local $w i32) (local $h i32) (local $bpp i32) (local $pitch i32)
    (local $dib_wa i32) (local $bmi_wa i32) (local $i i32) (local $val i32)
    (local $surface_id i32) (local $target_hwnd i32) (local $shared i32)
    (local $cl i32) (local $ct i32) (local $cx i32) (local $cy i32)
    (local $cw i32) (local $ch i32) (local $offset i32) (local $client_rel i32)
    (local.set $w (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 12))))
    (local.set $h (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 14))))
    (local.set $bpp (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 16))))
    (local.set $pitch (i32.load16_u (i32.add (local.get $entry_wa) (i32.const 18))))
    (local.set $dib_wa (i32.load (i32.add (local.get $entry_wa) (i32.const 20))))
    ;; Both points are in the right sidebar. The temporary map-only image has
    ;; index 0x23 there; complete frames use different indices as the palette
    ;; changes and must resume presentation immediately.
    (if (i32.eq (global.get $dx_scroll_hold_wa) (local.get $entry_wa))
      (then
        (if (i32.and
              (i32.eq (i32.load8_u (i32.add (local.get $dib_wa)
                (i32.add (i32.mul (i32.const 400) (local.get $pitch)) (i32.const 600))))
                (i32.const 0x23))
              (i32.eq (i32.load8_u (i32.add (local.get $dib_wa)
                (i32.add (i32.mul (i32.const 340) (local.get $pitch)) (i32.const 600))))
                (i32.const 0x23)))
          (then (return)))
        (global.set $dx_scroll_hold_wa (i32.const 0))))
    (call $host_dx_trace (i32.const 5) (call $dx_slot_of (local.get $entry_wa))
      (local.get $bpp) (local.get $dib_wa) (call $dx_primary_pal_get))
    ;; Present DirectDraw's own canonical DIB directly. The host keeps a
    ;; derived canvas for this 0x200000+slot surface and coalesces repeated
    ;; Unlock uploads until composition. This avoids copying 640x480 through
    ;; a second WAT window surface for every scanline of old-school fades.
    (local.set $surface_id
      (i32.add (i32.const 0x00200000) (call $dx_slot_of (local.get $entry_wa))))
    (local.set $target_hwnd (call $dx_surface_target_hwnd (local.get $entry_wa)))
    ;; ...but only while DirectDraw is the sole owner of the window. A window
    ;; that also has ordinary GDI children has a WAT window surface, and both
    ;; surfaces attach to the same hwnd, so whichever attaches last becomes
    ;; the composited one and the other's pixels vanish. Age of Empires' name
    ;; screen puts an EDIT child over a presented frame: the child's first
    ;; paint created the window surface, that surface won the attach, and the
    ;; screen went black for the rest of the session. Present through the
    ;; window surface in that case -- one surface holding frame and controls
    ;; together is what the real screen is -- and mark the children so they
    ;; land back on top of each new frame.
    (call $dx_reseed_overlays (local.get $entry_wa))
    (local.set $shared (call $dx_window_surface_shared (local.get $target_hwnd)))
    ;; A windowed (non-exclusive) app owns no more of the display than its
    ;; client area, and its Blts to the primary are in screen coordinates --
    ;; the clipper it attached with SetHWnd is what makes that legal. So its
    ;; primary is display-sized while the window is chrome-sized, and handing
    ;; the whole surface to the window (the exclusive fast path below) put a
    ;; 640x480 screen over a smaller window: dx_tunnel and dx_twist showed
    ;; caption and menus with an empty grey client while the frame sat in the
    ;; primary's top-left. Blit the sub-rect under the client area instead.
    (if (i32.and (i32.eqz (call $dx_exclusive_get))
                 (i32.ne (local.get $target_hwnd) (i32.const 0)))
      (then
        (local.set $cl (call $client_rect_get_l (local.get $target_hwnd)))
        (local.set $ct (call $client_rect_get_t (local.get $target_hwnd)))
        (local.set $cx (call $wnd_client_screen_x (local.get $target_hwnd)))
        (local.set $cy (call $wnd_client_screen_y (local.get $target_hwnd)))
        (local.set $cw (call $wnd_client_w_for_clip (local.get $target_hwnd)))
        (local.set $ch (call $wnd_client_h_for_clip (local.get $target_hwnd)))
        ;; ...but a windowed Direct3D 9 back buffer is CLIENT-relative: its
        ;; (0,0) is the client's top-left, not the display's, so the source
        ;; origin is 0,0 and the client's screen position says only where the
        ;; pixels land, which the client DC already knows.
        (local.set $client_rel
          (call $d3d9_present_client_relative (local.get $target_hwnd)))
        (if (local.get $client_rel)
          (then (local.set $cx (i32.const 0)) (local.set $cy (i32.const 0))))
        ;; A window that already covers the display exactly needs none of this,
        ;; and the direct attach below is far cheaper per frame.
        (if (i32.and (i32.gt_s (local.get $cw) (i32.const 0))
                     (i32.gt_s (local.get $ch) (i32.const 0)))
          (then
            (if (i32.or
                  (i32.or (i32.ne (local.get $cx) (i32.const 0))
                          (i32.ne (local.get $cy) (i32.const 0)))
                  (i32.or (i32.ne (local.get $cw) (local.get $w))
                          (i32.ne (local.get $ch) (local.get $h))))
              (then (local.set $offset (i32.const 1))))
            ;; A device window that is a CHILD owns no composited surface --
            ;; repaint() blits top-level back-canvases only -- so the attach
            ;; fast path below would hand the frame to a canvas nobody draws.
            ;; Its client DC, on the other hand, resolves to the top-level
            ;; surface at the child's offset. Pawn's device window is a
            ;; 1024x768 STATIC child of a 352x353 client, so this is the case
            ;; that has to blit even when nothing else forces it to.
            (if (i32.ne (call $wnd_top_level (local.get $target_hwnd))
                        (local.get $target_hwnd))
              (then (local.set $offset (i32.const 1))))))))
    (if (i32.and (i32.eqz (local.get $shared)) (i32.eqz (local.get $offset)))
      (then
        (if (call $gdi_dx_dc_bind (local.get $surface_id))
          (then
            (if (call $host_gdi_surface_attach (local.get $surface_id) (local.get $target_hwnd))
              (then
                (drop (call $host_gdi_surface_upload (local.get $surface_id)
                  (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)))
                (return)))))))
    (if (local.get $offset)
      (then
        (call $dx_blit_entry_rect_to_hdc (local.get $entry_wa)
          (i32.add (local.get $target_hwnd) (i32.const 0x40000))
          ;; hwnd|0x40000 is a client DC: it already offsets by the client
          ;; origin, so the destination here is client-relative (0,0).
          (i32.const 0) (i32.const 0)
          (local.get $cx) (local.get $cy)
          (local.get $cw) (local.get $ch)))
      (else
        (call $dx_blit_entry_to_hdc (local.get $entry_wa)
          (i32.add (local.get $target_hwnd) (i32.const 0x40000)))))
    ;; The frame just overwrote the whole window surface, controls included.
    ;; Repaint the children -- and only the children: the top-level's own
    ;; WM_PAINT is what renders the next frame, so marking it here would spin
    ;; the app's render loop as fast as it can present.
    (if (local.get $shared)
      (then
        (local.set $i (i32.const 0))
        (block $cdone (loop $cscan
          (local.set $i (call $wnd_next_child_slot (local.get $target_hwnd) (local.get $i)))
          (br_if $cdone (i32.lt_s (local.get $i) (i32.const 0)))
          (call $paint_mark_visible_tree (call $wnd_slot_hwnd (local.get $i)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $cscan))))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectDrawPalette methods
  ;; ════════════════════════════════════════════════════════════

  ;; Return 1 if any PALETTEENTRY in [start, start+count) has a non-zero RGB byte.
  (func $palette_entries_have_rgb (param $pal_wa i32) (param $start i32) (param $count i32) (result i32)
    (local $i i32) (local $p i32)
    (if (i32.eqz (local.get $pal_wa)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $p
        (i32.add (local.get $pal_wa)
          (i32.shl (i32.add (local.get $start) (local.get $i)) (i32.const 2))))
      (if (i32.or
            (i32.or
              (i32.load8_u (local.get $p))
              (i32.load8_u (i32.add (local.get $p) (i32.const 1))))
            (i32.load8_u (i32.add (local.get $p) (i32.const 2))))
        (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $handle_IDirectDrawPalette_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IDirectDrawPalette {6C14DB84-A733-11CE-A521-0020AF0BE560}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x6C14DB84) (i32.const 0x11CEA733)
      (i32.const 0x200021A5) (i32.const 0x60E50BAF)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  (func $handle_IDirectDrawPalette_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32)
    (call $d3dim_worker_fence)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (call $gdi_forget_realized_palette
          (i32.or (i32.const 0x80000000) (call $dx_slot_of (local.get $entry))))
        (call $dx_free (local.get $entry))))
    (i32.store offset=0 (global.get $reg_base) (select (local.get $rc) (i32.const 0) (i32.gt_s (local.get $rc) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirectDrawPalette_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gs32 (local.get $arg1) (i32.const 0x4)) ;; DDPCAPS_8BIT
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectDrawPalette_GetEntries (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $pal_wa i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $pal_wa (load.field DxObject misc1 (local.get $entry)))
    (if (local.get $pal_wa) (then
      (call $memcpy (call $g2w (local.get $arg4))
        (i32.add (local.get $pal_wa) (i32.mul (local.get $arg2) (i32.const 4)))
        (i32.mul (local.get $arg3) (i32.const 4)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; IDirectDrawPalette::Initialize — already initialized, just return DD_OK
  (func $handle_IDirectDrawPalette_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectDrawPalette_SetEntries (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $pal_wa i32) (local $src_wa i32) (local $skip_copy i32)
    (local $prim i32)
    (call $d3dim_worker_fence)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $pal_wa (load.field DxObject misc1 (local.get $entry)))
    (if (local.get $arg4)
      (then (local.set $src_wa (call $g2w (local.get $arg4)))))
    (if (i32.and
          (i32.ne (local.get $pal_wa) (i32.const 0))
          (i32.ne (local.get $src_wa) (i32.const 0))) (then
      (local.set $skip_copy (i32.const 0))
      ;; Some palette-cycling samples feed an all-black full table before their
      ;; animation buffer is populated; keep the nonblack CreatePalette state.
      (if (i32.and (i32.eqz (local.get $arg2)) (i32.eq (local.get $arg3) (i32.const 256)))
        (then
          (if (i32.and
                (i32.eqz (call $palette_entries_have_rgb (local.get $src_wa) (i32.const 0) (local.get $arg3)))
                (call $palette_entries_have_rgb (local.get $pal_wa) (local.get $arg2) (local.get $arg3)))
            (then (local.set $skip_copy (i32.const 1))))))
      (if (i32.eqz (local.get $skip_copy))
        (then
          (call $memcpy (i32.add (local.get $pal_wa) (i32.mul (local.get $arg2) (i32.const 4)))
            (local.get $src_wa)
            (i32.mul (local.get $arg3) (i32.const 4)))))))
    (call $host_dx_trace (i32.const 4) (call $dx_slot_of (local.get $entry))
      (local.get $arg2) (local.get $arg3) (local.get $pal_wa))
    ;; A hardware palette write changes what the display shows without the
    ;; program touching a single pixel of the framebuffer -- that is the whole
    ;; point of an 8bpp fade. Diablo's menus are drawn once and then faded in
    ;; over ~16 SetEntries calls on the primary's palette, so a present that
    ;; only fires on Unlock leaves the screen holding fade step 0 for good:
    ;; the artwork is in the surface, its palette entries are still black, and
    ;; the menu looks like nothing but the text drawn afterwards through GDI.
    ;; Re-present the primary whenever its own palette changes.
    (if (i32.and
          (i32.and
            (i32.eqz (local.get $skip_copy))
            (i32.ne (local.get $src_wa) (i32.const 0)))
          (i32.and
            (i32.ne (local.get $pal_wa) (i32.const 0))
            (i32.eq (local.get $pal_wa) (call $dx_primary_pal_get))))
      (then
        (call $dx_sync_indexed_desktop_palette (local.get $entry))
        (local.set $prim (call $dx_primary_entry))
        (if (local.get $prim)
          (then (call $dx_present (local.get $prim))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectDrawClipper methods
  ;; ════════════════════════════════════════════════════════════

  (func $handle_IDirectDrawClipper_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IDirectDrawClipper {6C14DB85-A733-11CE-A521-0020AF0BE560}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x6C14DB85) (i32.const 0x11CEA733)
      (i32.const 0x200021A5) (i32.const 0x60E50BAF)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  (func $handle_IDirectDrawClipper_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (call $dx_clipper_release_explicit (local.get $entry))
        (call $dx_free (local.get $entry))))
    (i32.store offset=0 (global.get $reg_base) (local.get $rc))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; GetClipList(this, lpRect, lpClipList, lpdwSize). Build a canonical
  ;; RGNDATA result, intersecting each retained rectangle with lpRect when one
  ;; is supplied. This preserves DirectDraw's two-call size negotiation and
  ;; reports the exact required size on DDERR_REGIONTOOSMALL.
  (func $handle_IDirectDrawClipper_GetClipList (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $hwnd i32) (local $data_guest i32) (local $data_wa i32)
    (local $source_count i32) (local $i i32) (local $rect i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32)
    (local $fl i32) (local $ft i32) (local $fr i32) (local $fb i32)
    (local $count i32) (local $required i32) (local $capacity i32)
    (local $bl i32) (local $bt i32) (local $br i32) (local $bb i32)
    (local $out i32) (local $out_index i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 10))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.eqz (local.get $arg3))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $capacity (call $gl32 (local.get $arg3)))
    (local.set $hwnd (load.field DxObject misc0 (local.get $entry)))
    (if (local.get $hwnd)
      (then
        (call $dx_clipper_refresh_hwnd (local.get $entry))
        (local.set $source_count (i32.const 1)))
      (else
        (local.set $data_guest (load.field DxObject misc1 (local.get $entry)))
        (if (i32.eqz (local.get $data_guest))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x887600CD)) ;; DDERR_NOCLIPLIST
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $data_wa (call $g2w (local.get $data_guest)))
        (local.set $source_count (i32.load offset=8 (local.get $data_wa)))))
    (if (local.get $arg1)
      (then
        (local.set $fl (call $gl32 (local.get $arg1)))
        (local.set $ft (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
        (local.set $fr (call $gl32 (i32.add (local.get $arg1) (i32.const 8))))
        (local.set $fb (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))))
    ;; First pass: count non-empty intersections and derive their bound.
    (block $count_done (loop $count_rects
      (br_if $count_done (i32.ge_u (local.get $i) (local.get $source_count)))
      (if (local.get $hwnd)
        (then
          (local.set $l (i32.load offset=12 (local.get $entry)))
          (local.set $t (i32.load offset=16 (local.get $entry)))
          (local.set $r (load.field DxObject misc1 (local.get $entry)))
          (local.set $b (load.field DxObject misc2 (local.get $entry))))
        (else
          (local.set $rect (i32.add (local.get $data_wa)
            (i32.add (i32.const 32) (i32.shl (local.get $i) (i32.const 4)))))
          (local.set $l (i32.load (local.get $rect)))
          (local.set $t (i32.load offset=4 (local.get $rect)))
          (local.set $r (i32.load offset=8 (local.get $rect)))
          (local.set $b (i32.load offset=12 (local.get $rect)))))
      (if (local.get $arg1)
        (then
          (if (i32.lt_s (local.get $l) (local.get $fl)) (then (local.set $l (local.get $fl))))
          (if (i32.lt_s (local.get $t) (local.get $ft)) (then (local.set $t (local.get $ft))))
          (if (i32.gt_s (local.get $r) (local.get $fr)) (then (local.set $r (local.get $fr))))
          (if (i32.gt_s (local.get $b) (local.get $fb)) (then (local.set $b (local.get $fb))))))
      (if (i32.and (i32.lt_s (local.get $l) (local.get $r))
                   (i32.lt_s (local.get $t) (local.get $b)))
        (then
          (if (i32.eqz (local.get $count))
            (then
              (local.set $bl (local.get $l)) (local.set $bt (local.get $t))
              (local.set $br (local.get $r)) (local.set $bb (local.get $b)))
            (else
              (if (i32.lt_s (local.get $l) (local.get $bl)) (then (local.set $bl (local.get $l))))
              (if (i32.lt_s (local.get $t) (local.get $bt)) (then (local.set $bt (local.get $t))))
              (if (i32.gt_s (local.get $r) (local.get $br)) (then (local.set $br (local.get $r))))
              (if (i32.gt_s (local.get $b) (local.get $bb)) (then (local.set $bb (local.get $b))))))
          (local.set $count (i32.add (local.get $count) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $count_rects)))
    (local.set $required (i32.add (i32.const 32) (i32.shl (local.get $count) (i32.const 4))))
    (call $gs32 (local.get $arg3) (local.get $required))
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.lt_u (local.get $capacity) (local.get $required))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760236)) ;; DDERR_REGIONTOOSMALL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; RGNDATAHEADER: sizeof, RDH_RECTANGLES, count, rectangle bytes, bound.
    (call $gs32 (local.get $arg2) (i32.const 32))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 4)) (i32.const 1))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 8)) (local.get $count))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 12))
      (i32.shl (local.get $count) (i32.const 4)))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 16)) (local.get $bl))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 20)) (local.get $bt))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 24)) (local.get $br))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 28)) (local.get $bb))
    ;; Second pass: publish the same intersections.
    (local.set $i (i32.const 0))
    (block $copy_done (loop $copy_rects
      (br_if $copy_done (i32.ge_u (local.get $i) (local.get $source_count)))
      (if (local.get $hwnd)
        (then
          (local.set $l (i32.load offset=12 (local.get $entry)))
          (local.set $t (i32.load offset=16 (local.get $entry)))
          (local.set $r (load.field DxObject misc1 (local.get $entry)))
          (local.set $b (load.field DxObject misc2 (local.get $entry))))
        (else
          (local.set $rect (i32.add (local.get $data_wa)
            (i32.add (i32.const 32) (i32.shl (local.get $i) (i32.const 4)))))
          (local.set $l (i32.load (local.get $rect)))
          (local.set $t (i32.load offset=4 (local.get $rect)))
          (local.set $r (i32.load offset=8 (local.get $rect)))
          (local.set $b (i32.load offset=12 (local.get $rect)))))
      (if (local.get $arg1)
        (then
          (if (i32.lt_s (local.get $l) (local.get $fl)) (then (local.set $l (local.get $fl))))
          (if (i32.lt_s (local.get $t) (local.get $ft)) (then (local.set $t (local.get $ft))))
          (if (i32.gt_s (local.get $r) (local.get $fr)) (then (local.set $r (local.get $fr))))
          (if (i32.gt_s (local.get $b) (local.get $fb)) (then (local.set $b (local.get $fb))))))
      (if (i32.and (i32.lt_s (local.get $l) (local.get $r))
                   (i32.lt_s (local.get $t) (local.get $b)))
        (then
          (local.set $out (i32.add (local.get $arg2)
            (i32.add (i32.const 32) (i32.shl (local.get $out_index) (i32.const 4)))))
          (call $gs32 (local.get $out) (local.get $l))
          (call $gs32 (i32.add (local.get $out) (i32.const 4)) (local.get $t))
          (call $gs32 (i32.add (local.get $out) (i32.const 8)) (local.get $r))
          (call $gs32 (i32.add (local.get $out) (i32.const 12)) (local.get $b))
          (local.set $out_index (i32.add (local.get $out_index) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy_rects)))
    (if (local.get $hwnd)
      (then (store.field DxObject flags (local.get $entry)
        (i32.and (load.field DxObject flags (local.get $entry)) (i32.const -3)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; GetHWnd(this, lphWnd)
  (func $handle_IDirectDrawClipper_GetHWnd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 10))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $gs32 (local.get $arg1) (load.field DxObject misc0 (local.get $entry)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Initialize(this, lpDD, dwFlags) — no-op
  (func $handle_IDirectDrawClipper_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IsClipListChanged is meaningful for an HWND-backed clipper. Keep the
  ;; change latched until GetClipList successfully copies the new list.
  (func $handle_IDirectDrawClipper_IsClipListChanged (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 10))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (load.field DxObject misc0 (local.get $entry))
      (then (call $dx_clipper_refresh_hwnd (local.get $entry))))
    (call $gs32 (local.get $arg1)
      (select (i32.const 1) (i32.const 0)
        (i32.ne (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 2))
                (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetClipList(this, lpClipList, dwFlags). Validate and canonicalize the
  ;; caller's rectangles before replacing the prior private copy.
  (func $handle_IDirectDrawClipper_SetClipList (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $source i32) (local $count i32) (local $bytes i32)
    (local $i i32) (local $rect i32) (local $l i32) (local $t i32)
    (local $r i32) (local $b i32) (local $bl i32) (local $bt i32)
    (local $br i32) (local $bb i32) (local $copy i32) (local $copy_wa i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 10))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.ne (local.get $arg2) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (load.field DxObject misc0 (local.get $entry))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760237)) ;; DDERR_CLIPPERISUSINGHWND
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.eqz (local.get $arg1))
      (then
        (call $dx_clipper_release_explicit (local.get $entry))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; RGNDATAHEADER is 32 bytes and DirectDraw accepts only RDH_RECTANGLES.
    (if (i32.or
          (i32.ne (call $gl32 (local.get $arg1)) (i32.const 32))
          (i32.ne (call $gl32 (i32.add (local.get $arg1) (i32.const 4))) (i32.const 1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876006E)) ;; DDERR_INVALIDCLIPLIST
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $count (call $gl32 (i32.add (local.get $arg1) (i32.const 8))))
    (if (i32.gt_u (local.get $count) (i32.const 4096))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876006E))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $bytes (i32.shl (local.get $count) (i32.const 4)))
    (if (i32.and
          (i32.ne (call $gl32 (i32.add (local.get $arg1) (i32.const 12))) (i32.const 0))
          (i32.lt_u (call $gl32 (i32.add (local.get $arg1) (i32.const 12)))
                    (local.get $bytes)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876006E))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $source (call $g2w_affine_span (local.get $arg1)
      (i32.add (i32.const 32) (local.get $bytes))))
    (if (i32.eq (local.get $source) (global.get $NULL_SENTINEL))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876006E))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Validate every RECT and recompute rcBound instead of trusting it.
    (block $validate_done (loop $validate
      (br_if $validate_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rect (i32.add (local.get $source)
        (i32.add (i32.const 32) (i32.shl (local.get $i) (i32.const 4)))))
      (local.set $l (i32.load (local.get $rect)))
      (local.set $t (i32.load offset=4 (local.get $rect)))
      (local.set $r (i32.load offset=8 (local.get $rect)))
      (local.set $b (i32.load offset=12 (local.get $rect)))
      (if (i32.or (i32.ge_s (local.get $l) (local.get $r))
                  (i32.ge_s (local.get $t) (local.get $b)))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876006E))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
          (return)))
      (if (i32.eqz (local.get $i))
        (then
          (local.set $bl (local.get $l)) (local.set $bt (local.get $t))
          (local.set $br (local.get $r)) (local.set $bb (local.get $b)))
        (else
          (if (i32.lt_s (local.get $l) (local.get $bl)) (then (local.set $bl (local.get $l))))
          (if (i32.lt_s (local.get $t) (local.get $bt)) (then (local.set $bt (local.get $t))))
          (if (i32.gt_s (local.get $r) (local.get $br)) (then (local.set $br (local.get $r))))
          (if (i32.gt_s (local.get $b) (local.get $bb)) (then (local.set $bb (local.get $b))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $validate)))
    (local.set $copy (call $heap_alloc (i32.add (i32.const 32) (local.get $bytes))))
    (if (i32.eqz (local.get $copy))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; DDERR_OUTOFMEMORY
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $copy_wa (call $g2w (local.get $copy)))
    (i32.store (local.get $copy_wa) (i32.const 32))
    (i32.store offset=4 (local.get $copy_wa) (i32.const 1))
    (i32.store offset=8 (local.get $copy_wa) (local.get $count))
    (i32.store offset=12 (local.get $copy_wa) (local.get $bytes))
    (i32.store offset=16 (local.get $copy_wa) (local.get $bl))
    (i32.store offset=20 (local.get $copy_wa) (local.get $bt))
    (i32.store offset=24 (local.get $copy_wa) (local.get $br))
    (i32.store offset=28 (local.get $copy_wa) (local.get $bb))
    (call $memcpy (i32.add (local.get $copy_wa) (i32.const 32))
      (i32.add (local.get $source) (i32.const 32)) (local.get $bytes))
    (call $dx_clipper_release_explicit (local.get $entry))
    (store.field DxObject misc1 (local.get $entry) (local.get $copy))
    (store.field DxObject misc2 (local.get $entry)
      (i32.add (i32.const 32) (local.get $bytes)))
    (store.field DxObject flags (local.get $entry) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; SetHWnd(this, dwFlags, hWnd) — retain the window whose visible client
  ;; region defines this clipper. GetClipList snapshots that live client region,
  ;; while surface presentation and browser composition enforce it onscreen.
  (func $handle_IDirectDrawClipper_SetHWnd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 10))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Microsoft documents dwFlags as reserved and required to be zero. An
    ;; explicit list and an HWND-derived list are mutually exclusive.
    (if (i32.or
          (i32.ne (local.get $arg1) (i32.const 0))
          (i32.eqz (call $window_handle_valid (local.get $arg2))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DDERR_INVALIDPARAMS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.and
          (i32.eqz (load.field DxObject misc0 (local.get $entry)))
          (i32.ne (load.field DxObject misc1 (local.get $entry)) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8876006E)) ;; DDERR_INVALIDCLIPLIST
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (store.field DxObject misc0 (local.get $entry) (local.get $arg2))
    (store.field DxObject flags (local.get $entry) (i32.const 0))
    (call $dx_clipper_refresh_hwnd (local.get $entry))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectSound methods
  ;; ════════════════════════════════════════════════════════════

  ;; A type-4 DirectSound root otherwise uses only misc0 (cooperative HWND)
  ;; and misc1 (DSSCL level). Keep initialization and speaker configuration in
  ;; its unused flags arm. The stored value is config+1 so DSSPEAKER_DIRECTOUT
  ;; (zero) remains distinct from a CoCreateInstance object awaiting Initialize.
  ;; A plain stereo request is normalized to the documented default WIDE
  ;; geometry; GetSpeakerConfig may return this packed form.
  (func $dsound_mark_initialized (param $this i32)
    (store.field DxObject flags (call $dx_from_this (local.get $this))
      (i32.const 0x00140005))) ;; DSSPEAKER_COMBINED(STEREO, WIDE) + 1

  (func $dsound_speaker_config_valid (param $config i32) (result i32)
    (local $kind i32) (local $geometry i32)
    ;; Only the low configuration byte and bits 16..23 geometry byte belong to
    ;; DSSPEAKER_COMBINED. Windows 98 supports the original values 0 through 7;
    ;; the later 5.1/7.1 SURROUND identifiers are deliberately not admitted.
    (if (i32.ne (i32.and (local.get $config) (i32.const 0xFF00FF00))
                (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $kind (i32.and (local.get $config) (i32.const 0xFF)))
    (local.set $geometry
      (i32.and (i32.shr_u (local.get $config) (i32.const 16))
               (i32.const 0xFF)))
    (if (i32.gt_u (local.get $kind) (i32.const 7))
      (then (return (i32.const 0))))
    (if (i32.ne (local.get $kind) (i32.const 4)) ;; DSSPEAKER_STEREO
      (then (return (i32.eqz (local.get $geometry)))))
    (i32.or
      (i32.or
        (i32.eqz (local.get $geometry))
        (i32.eq (local.get $geometry) (i32.const 5)))
      (i32.or
        (i32.eq (local.get $geometry) (i32.const 10))
        (i32.or
          (i32.eq (local.get $geometry) (i32.const 20))
          (i32.eq (local.get $geometry) (i32.const 180))))))

  (func $handle_IDirectSound_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0))
                (i32.eq (call $gl32 (local.get $arg0)) (global.get $DX_VTBL_DSOUND8)))
      (then
        (if (call $guid_words_equal (call $g2w (local.get $arg1))
              (i32.const 0xC50A7E93) (i32.const 0x4834F395)
              (i32.const 0xA97FF69E) (i32.const 0x6609E59D))
          (then
            (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_result
              (local.get $arg0) (local.get $arg2) (i32.const 1)))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))))
    ;; IID_IDirectSound {279AFA83-4981-11CE-A521-0020AF0BE560}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x279AFA83) (i32.const 0x11CE4981)
      (i32.const 0x200021A5) (i32.const 0x60E50BAF)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Validate the fixed PCM WAVEFORMATEX fields understood by the browser
  ;; voice bridge and return the translated address. NULL_SENTINEL means the
  ;; caller supplied an unreadable or internally inconsistent format.
  (func $ds_pcm_format_wa (param $format_guest i32) (result i32)
    (local $wa i32) (local $channels i32) (local $rate i32)
    (local $average i32) (local $align i32) (local $bits i32)
    (if (i32.eqz (local.get $format_guest))
      (then (return (global.get $NULL_SENTINEL))))
    (local.set $wa
      (call $g2w_affine_span (local.get $format_guest) (i32.const 18)))
    (if (i32.eq (local.get $wa) (global.get $NULL_SENTINEL))
      (then (return (global.get $NULL_SENTINEL))))
    (local.set $channels (i32.load16_u offset=2 (local.get $wa)))
    (local.set $rate (i32.load offset=4 (local.get $wa)))
    (local.set $average (i32.load offset=8 (local.get $wa)))
    (local.set $align (i32.load16_u offset=12 (local.get $wa)))
    (local.set $bits (i32.load16_u offset=14 (local.get $wa)))
    (if (i32.or
          (i32.ne (i32.load16_u (local.get $wa)) (i32.const 1)) ;; PCM
          (i32.or
            (i32.or (i32.eqz (local.get $channels))
                    (i32.gt_u (local.get $channels) (i32.const 2)))
            (i32.or
              (i32.eqz (local.get $rate))
              (i32.and (i32.ne (local.get $bits) (i32.const 8))
                       (i32.ne (local.get $bits) (i32.const 16))))))
      (then (return (global.get $NULL_SENTINEL))))
    (if (i32.or
          (i32.ne (local.get $align)
            (i32.div_u (i32.mul (local.get $channels) (local.get $bits))
                       (i32.const 8)))
          (i32.ne (local.get $average)
            (i32.mul (local.get $rate) (local.get $align))))
      (then (return (global.get $NULL_SENTINEL))))
    (local.get $wa))



  ;; CreateSoundBuffer(this, lpDSBufferDesc, lplpDirectSoundBuffer, pUnkOuter)
  (func $handle_IDirectSound_CreateSoundBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $root i32) (local $desc_wa i32) (local $desc_size i32)
    (local $flags i32) (local $buf_size i32) (local $fmt_guest i32)
    (local $fmt_wa i32) (local $obj i32) (local $entry i32)
    (local $state i32) (local $buf_guest i32) (local $buf_wa i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.ne (local.get $arg3) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110)) ;; DSERR_NOAGGREGATION
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $root (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $root)) (i32.const 4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $desc_wa
      (call $g2w_affine_span (local.get $arg1) (i32.const 20)))
    (if (i32.eq (local.get $desc_wa) (global.get $NULL_SENTINEL))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $desc_size (i32.load (local.get $desc_wa)))
    ;; Win98-era callers use DSBUFFERDESC1 (20 bytes) or the DirectX 7
    ;; DSBUFFERDESC with guid3DAlgorithm (36 bytes).
    (if (i32.and
          (i32.ne (local.get $desc_size) (i32.const 20))
          (i32.ne (local.get $desc_size) (i32.const 36)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; DSBUFFERDESC: +4 dwFlags, +8 dwBufferBytes, +12 dwReserved, +16 lpwfxFormat
    (local.set $flags (i32.load (i32.add (local.get $desc_wa) (i32.const 4))))
    (local.set $buf_size (i32.load (i32.add (local.get $desc_wa) (i32.const 8))))
    (local.set $fmt_guest (i32.load (i32.add (local.get $desc_wa) (i32.const 16))))
    (if (i32.ne (i32.load offset=12 (local.get $desc_wa)) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; The primary ring is device-owned: callers must not prescribe its size
    ;; or format in the descriptor. SetFormat changes it after creation.
    (if (i32.and
          (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))
          (i32.or (i32.ne (local.get $buf_size) (i32.const 0))
                  (i32.ne (local.get $fmt_guest) (i32.const 0))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.eq (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))
      (then
        ;; Secondary buffers are born with immutable storage and format.
        ;; SetFormat is a primary-buffer operation, so neither field can be
        ;; deferred until after creation.
        (if (i32.or (i32.eqz (local.get $buf_size))
                    (i32.eqz (local.get $fmt_guest)))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $fmt_wa (call $ds_pcm_format_wa (local.get $fmt_guest)))
        (if (i32.eq (local.get $fmt_wa) (global.get $NULL_SENTINEL))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x88780064)) ;; DSERR_BADFORMAT
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))))
    ;; Create DSBuffer COM object
    (local.set $obj (call $dx_create_com_obj (i32.const 5) (global.get $DX_VTBL_DSBUF)))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (i32.store (local.get $state)
      (i32.add (call $dx_slot_of (local.get $root)) (i32.const 1)))
    (i32.store offset=4 (local.get $state) (local.get $flags))
    (i32.store offset=8 (local.get $state)
      (load.field DxObject misc1 (local.get $root)))
    ;; DSBCAPS_PRIMARYBUFFER = 1
    (if (i32.and (local.get $flags) (i32.const 1))
      (then
        ;; A primary DS buffer is backed by device-owned memory even though its
        ;; DSBUFFERDESC requires dwBufferBytes=0.  Streamers query GetCaps and
        ;; Lock that memory directly; reporting a zero-byte ring makes their
        ;; first refill fail (Elasto Mania aborts with "buffsize < 20").
        ;; Model a common Win9x-era 64 KiB hardware ring in guest memory.
        (local.set $buf_size (i32.const 0x10000))
        (local.set $buf_guest (call $heap_alloc (local.get $buf_size)))
        (if (i32.eqz (local.get $buf_guest))
          (then
            (call $dx_free (local.get $entry))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; DSERR_OUTOFMEMORY
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $buf_wa (call $g2w (local.get $buf_guest)))
        (call $zero_memory (local.get $buf_wa) (local.get $buf_size))
        (store.field DxObject misc1 (local.get $entry) (local.get $buf_wa))
        (i32.store (i32.add (local.get $entry) (i32.const 12)) (local.get $buf_size))
        ;; Playback flags begin stopped. Primary identity lives in the
        ;; auxiliary creation-capability field, not DSBSTATUS_PLAYING bit 0.
        (store.field DxObject flags (local.get $entry) (i32.const 0)))
      (else
        ;; Secondary buffer — allocate guest memory for sound data
        (if (i32.gt_u (local.get $buf_size) (i32.const 0)) (then
          (local.set $buf_guest (call $heap_alloc (local.get $buf_size)))
          (if (i32.eqz (local.get $buf_guest))
            (then
              (call $dx_free (local.get $entry))
              (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; DSERR_OUTOFMEMORY
              (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
              (return)))
          (local.set $buf_wa (call $g2w (local.get $buf_guest)))
          (call $zero_memory (local.get $buf_wa) (local.get $buf_size))
          (store.field DxObject misc1 (local.get $entry) (local.get $buf_wa))))
        ;; Store buffer size in w/h fields
        (i32.store (i32.add (local.get $entry) (i32.const 12)) (local.get $buf_size))
        ;; Store format info from WAVEFORMATEX
        ;; Test the GUEST pointer for NULL, not the translated one: g2w(0) is a
        ;; perfectly ordinary WASM address, so a NULL lpwfxFormat used to read
        ;; channels/rate/bits out of whatever happens to live at the bottom of
        ;; the guest image -- a format nobody asked for, played as noise.
        (if (local.get $fmt_guest) (then
          ;; WAVEFORMATEX: +2 nChannels, +4 nSamplesPerSec, +14 wBitsPerSample
          (store.field DxObject bpp (local.get $entry) (i32.load16_u (i32.add (local.get $fmt_wa) (i32.const 2)))) ;; channels in bpp field
          (store.field DxObject pitch (local.get $entry) (i32.load16_u (i32.add (local.get $fmt_wa) (i32.const 14)))) ;; bits in pitch field
          (store.field DxObject misc2 (local.get $entry) (i32.load (i32.add (local.get $fmt_wa) (i32.const 4))))  ;; sampleRate in colorkey field
        ))))
    ;; *lplpDirectSoundBuffer = obj
    (call $gs32 (local.get $arg2) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; GetCaps(this, lpDSCaps)
  (func $handle_IDirectSound_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $sz i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    ;; Respect caller's dwSize — DSCAPS shrank/grew across DX versions; writing
    ;; past the caller's buffer clobbers their stack frame (see GetCaps fix).
    (local.set $sz (i32.load (local.get $wa)))
    (if (i32.or (i32.lt_u (local.get $sz) (i32.const 16))
                (i32.gt_u (local.get $sz) (i32.const 96)))
      (then (local.set $sz (i32.const 96))))
    (call $zero_memory (local.get $wa) (local.get $sz))
    (i32.store (local.get $wa) (local.get $sz))
    ;; dwFlags: PRIMARY{MONO,STEREO,8BIT,16BIT} (0x0F) | CONTINUOUSRATE (0x10)
    ;; | SECONDARY{MONO,STEREO,8BIT,16BIT} (0xF00). Never DSCAPS_EMULDRIVER
    ;; (0x20): Miles reads that bit as "no real driver", closes DirectSound and
    ;; reopens on waveOut, whose ~1.5s latency overflows Bink's audio sizing
    ;; divide (Arcanum's first movie).
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0xF1F))
    ;; DSCAPS: +8/+12 dwMin/MaxSecondarySampleRate (DSBFREQUENCY_MIN/MAX),
    ;; +16 dwPrimaryBuffers. The max used to be written at +56, which is
    ;; dwFreeHw3DAllBuffers, leaving the rate range 0..0.
    (if (i32.ge_u (local.get $sz) (i32.const 20))
      (then
        (i32.store offset=8 (local.get $wa) (i32.const 100))
        (i32.store offset=12 (local.get $wa) (i32.const 100000))
        (i32.store offset=16 (local.get $wa) (i32.const 1))))
    ;; Mixing and 3D voices: our voices are mixed and spatialized by the host,
    ;; not by the CPU in the guest, so report them as hardware buffers --
    ;; +20..+40 dwMax/FreeHwMixing{All,Static,Streaming}Buffers and +44..+64
    ;; dwMax/FreeHw3D{All,Static,Streaming}Buffers. Diablo II's d2sound keeps
    ;; 3D sound only when dwMaxHw3DAllBuffers >= 16, and otherwise refuses
    ;; every sound it flags as 3D.
    (if (i32.ge_u (local.get $sz) (i32.const 68))
      (then
        (i32.store offset=20 (local.get $wa) (i32.const 64))
        (i32.store offset=24 (local.get $wa) (i32.const 64))
        (i32.store offset=28 (local.get $wa) (i32.const 64))
        (i32.store offset=32 (local.get $wa) (i32.const 64))
        (i32.store offset=36 (local.get $wa) (i32.const 64))
        (i32.store offset=40 (local.get $wa) (i32.const 64))
        (i32.store offset=44 (local.get $wa) (i32.const 32))
        (i32.store offset=48 (local.get $wa) (i32.const 32))
        (i32.store offset=52 (local.get $wa) (i32.const 32))
        (i32.store offset=56 (local.get $wa) (i32.const 32))
        (i32.store offset=60 (local.get $wa) (i32.const 32))
        (i32.store offset=64 (local.get $wa) (i32.const 32))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; DuplicateSoundBuffer(this, pOriginalBuffer, ppDuplicateBuffer)
  (func $handle_IDirectSound_DuplicateSoundBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src_entry i32) (local $obj i32) (local $dst_entry i32)
    (local $buf_size i32) (local $buf_guest i32) (local $buf_wa i32)
    ;; Look up source buffer entry
    (local.set $src_entry (call $dx_from_this (local.get $arg1)))
    ;; Create new DSBuffer COM object
    (local.set $obj (call $dx_create_com_obj (i32.const 5) (global.get $DX_VTBL_DSBUF)))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $dst_entry (call $dx_from_this (local.get $obj)))
    (memory.copy
      (call $dx_surf_state_ptr (local.get $dst_entry))
      (call $dx_surf_state_ptr (local.get $src_entry))
      (i32.const 32))
    ;; DuplicateSoundBuffer copies the sample data and controls, but the new
    ;; object is stopped at the beginning of its own playback timeline.
    (i32.store offset=12 (call $dx_surf_state_ptr (local.get $dst_entry))
      (i32.const 0))
    ;; Copy format info from source: bufsize(+12), channels(+16), bits(+18), sampleRate(+24)
    (local.set $buf_size (i32.load (i32.add (local.get $src_entry) (i32.const 12))))
    (i32.store (i32.add (local.get $dst_entry) (i32.const 12)) (local.get $buf_size))
    (store.field DxObject bpp (local.get $dst_entry) (load.field DxObject bpp (local.get $src_entry)))
    (store.field DxObject pitch (local.get $dst_entry) (load.field DxObject pitch (local.get $src_entry)))
    (store.field DxObject misc2 (local.get $dst_entry) (load.field DxObject misc2 (local.get $src_entry)))
    ;; A duplicate starts stopped even if its source is currently playing.
    (store.field DxObject flags (local.get $dst_entry) (i32.const 0))
    ;; Allocate new buffer and copy data
    (if (i32.gt_u (local.get $buf_size) (i32.const 0)) (then
      (local.set $buf_guest (call $heap_alloc (local.get $buf_size))) (local.set $buf_wa (call $g2w (local.get $buf_guest)))
      (memory.copy
        (local.get $buf_wa)
        (load.field DxObject misc1 (local.get $src_entry))
        (local.get $buf_size))
      (store.field DxObject misc1 (local.get $dst_entry) (local.get $buf_wa))))
    ;; *ppDuplicateBuffer = obj
    (call $gs32 (local.get $arg2) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; SetCooperativeLevel(this, hwnd, level). DirectSound requires a live
  ;; top-level application window and one exact DSSCL_* value (1..4). Keep the
  ;; device state and refresh already-created buffers so SetFormat observes a
  ;; later promotion from NORMAL to PRIORITY, as native DirectSound does.
  (func $handle_IDirectSound_SetCooperativeLevel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $root i32) (local $owner i32) (local $i i32)
    (local $candidate i32) (local $state i32)
    (local.set $root (call $dx_from_this (local.get $arg0)))
    (if (i32.or
          (i32.ne (load.field DxObject type (local.get $root)) (i32.const 4))
          (i32.or
            (i32.eqz (call $window_handle_valid (local.get $arg1)))
            (i32.ne
              (i32.and (call $wnd_get_style (local.get $arg1))
                       (i32.const 0x40000000))
              (i32.const 0))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.or (i32.lt_u (local.get $arg2) (i32.const 1))
                (i32.gt_u (local.get $arg2) (i32.const 4)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (store.field DxObject misc0 (local.get $root) (local.get $arg1))
    (store.field DxObject misc1 (local.get $root) (local.get $arg2))
    (local.set $owner
      (i32.add (call $dx_slot_of (local.get $root)) (i32.const 1)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DX_MAX)))
      (local.set $candidate
        (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $i) (i32.const 5))))
      (if (i32.eq (load.field DxObject type (local.get $candidate)) (i32.const 5))
        (then
          (local.set $state (call $dx_surf_state_ptr (local.get $candidate)))
          (if (i32.eq (i32.load (local.get $state)) (local.get $owner))
            (then (i32.store offset=8 (local.get $state) (local.get $arg2))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Compact requires PRIORITY, EXCLUSIVE or WRITEPRIMARY. The browser has no
  ;; fragmented hardware heap to compact once that privilege check succeeds.
  (func $handle_IDirectSound_Compact (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $root i32) (local $level i32)
    (local.set $root (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $root)) (i32.const 4))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)))
      (else
        (local.set $level (load.field DxObject misc1 (local.get $root)))
        (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x88780046)
            (i32.and (i32.ge_u (local.get $level) (i32.const 2))
                     (i32.le_u (local.get $level) (i32.const 4)))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; GetSpeakerConfig(this, pdwSpeakerConfig). Microsoft documents a packed
  ;; configuration/geometry DWORD and INVALIDPARAM/UNINITIALIZED failures.
  (func $handle_IDirectSound_GetSpeakerConfig (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $root i32) (local $state i32) (local $out_wa i32)
    (local.set $root (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $root)) (i32.const 4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $state (load.field DxObject flags (local.get $root)))
    (if (i32.eqz (local.get $state))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x887800AA)) ;; DSERR_UNINITIALIZED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $out_wa
      (call $g2w_affine_span (local.get $arg1) (i32.const 4)))
    (if (i32.eq (local.get $out_wa) (global.get $NULL_SENTINEL))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store (local.get $out_wa) (i32.sub (local.get $state) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound_SetSpeakerConfig (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $root i32) (local $config i32)
    (local.set $root (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $root)) (i32.const 4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz (load.field DxObject flags (local.get $root)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x887800AA)) ;; DSERR_UNINITIALIZED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz (call $dsound_speaker_config_valid (local.get $arg1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $config (local.get $arg1))
    (if (i32.eq (local.get $config) (i32.const 4)) ;; stereo, no geometry
      (then (local.set $config (i32.const 0x00140004)))) ;; default WIDE
    (store.field DxObject flags (local.get $root)
      (i32.add (local.get $config) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $root i32)
    (local.set $root (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $root)) (i32.const 4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.ne (load.field DxObject flags (local.get $root)) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88780082)) ;; DSERR_ALREADYINITIALIZED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $dsound_mark_initialized (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectSoundBuffer methods
  ;; ════════════════════════════════════════════════════════════

  ;; Create a host voice early enough for IDirectSound3DBuffer setters, which
  ;; are normally issued before the first Play. The same voice is later used
  ;; by IDirectSoundBuffer::Play, so QI does not duplicate PCM or playback.
  (func $dsbuf_ensure_voice (param $entry i32) (result i32)
    (local $handle i32) (local $channels i32) (local $bits i32) (local $rate i32)
    (local $state i32)
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    (if (local.get $handle) (then (return (local.get $handle))))
    (local.set $channels (load.field DxObject bpp (local.get $entry)))
    (local.set $bits (load.field DxObject pitch (local.get $entry)))
    (local.set $rate (load.field DxObject misc2 (local.get $entry)))
    (if (i32.eqz (local.get $channels)) (then (local.set $channels (i32.const 1))))
    (if (i32.eqz (local.get $bits)) (then (local.set $bits (i32.const 16))))
    (if (i32.eqz (local.get $rate)) (then (local.set $rate (i32.const 22050))))
    (local.set $handle
      (call $host_voice_open (local.get $rate) (local.get $channels) (local.get $bits)))
    (store.field DxObject misc0 (local.get $entry) (local.get $handle))
    ;; Controls belong to the buffer, not the lazily-created browser voice.
    ;; This also restores them after SetFormat recreates a primary voice and
    ;; gives duplicates their copied controls before their first Play.
    (if (local.get $handle) (then
      (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
      (call $host_voice_set_volume_db (local.get $handle) (i32.load offset=16 (local.get $state)))
      (call $host_voice_set_pan (local.get $handle) (i32.load offset=20 (local.get $state)))
      (if (i32.load offset=24 (local.get $state)) (then
        (call $host_voice_set_freq (local.get $handle) (i32.load offset=24 (local.get $state)))))))
    (local.get $handle))

  ;; IID_IDirectSound3DBuffer = {279AFA86-4981-11CE-A521-0020AF0BE560}.
  ;; IID_IDirectSound3DListener = {279AFA84-4981-11CE-A521-0020AF0BE560}.
  ;; Complete DirectSound buffer-family interface classification. These four
  ;; GUIDs share a suffix, so compare all four words after one translation.
  (func $dsbuf_iid_kind_wa (param $iid_wa i32) (result i32)
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0) (i32.const 0)
          (i32.const 0x000000C0) (i32.const 0x46000000))
      (then (return (i32.const 1)))) ;; IUnknown
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x279AFA85) (i32.const 0x11CE4981)
          (i32.const 0x200021A5) (i32.const 0x60E50BAF))
      (then (return (i32.const 2)))) ;; IDirectSoundBuffer
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x279AFA86) (i32.const 0x11CE4981)
          (i32.const 0x200021A5) (i32.const 0x60E50BAF))
      (then (return (i32.const 3)))) ;; IDirectSound3DBuffer
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x279AFA84) (i32.const 0x11CE4981)
          (i32.const 0x200021A5) (i32.const 0x60E50BAF))
      (then (return (i32.const 4)))) ;; IDirectSound3DListener
    (i32.const 0))

  (func $handle_IDirectSoundBuffer_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_wa i32) (local $kind i32) (local $entry i32)
    (local $slot i32) (local $wrapper i32) (local $handle i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Translate riid exactly once, then classify the complete identity.
    (local.set $iid_wa (call $g2w (local.get $arg1)))
    (local.set $kind (call $dsbuf_iid_kind_wa (local.get $iid_wa)))
    (if (i32.eqz (local.get $kind))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; E_NOINTERFACE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        ;; All auxiliary 3D faces return the same controlling IUnknown.
        (local.set $wrapper
          (i32.add
            (i32.sub
              (i32.add (global.get $COM_WRAPPERS)
                (i32.mul (local.get $slot) (i32.const 8)))
              (global.get $GUEST_BASE))
            (global.get $image_base)))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then (local.set $wrapper (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DSBUF)))))
    (if (i32.eq (local.get $kind) (i32.const 3))
      (then
        (local.set $wrapper (call $dx_get_wrapper_for_vtbl
          (local.get $slot) (global.get $DX_VTBL_DS3DBUF)))
        (local.set $handle (call $dsbuf_ensure_voice (local.get $entry)))
        ;; Property 15 enables the default NORMAL spatial state without
        ;; resetting a buffer that has already received 3D parameters.
        (call $host_voice_3d_set
          (local.get $handle) (i32.const 15)
          (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 4))
      (then (local.set $wrapper (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DS3DLISTENER)))))
    (store.field DxObject refcount (local.get $entry)
      (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (call $gs32 (local.get $arg2) (local.get $wrapper))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  (func $handle_IDirectSoundBuffer_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32) (local $handle i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (local.set $handle (load.field DxObject misc0 (local.get $entry)))
        (if (local.get $handle) (then (drop (call $host_voice_close (local.get $handle)))))
        (call $dx_free (local.get $entry))))
    (i32.store offset=0 (global.get $reg_base) (select (local.get $rc) (i32.const 0) (i32.gt_s (local.get $rc) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; GetCaps(this, lpDSBCaps)
  (func $handle_IDirectSoundBuffer_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $wa i32) (local $state i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (call $zero_memory (local.get $wa) (i32.const 20))
    (i32.store (local.get $wa) (i32.const 20)) ;; dwSize
    ;; dwFlags reports the capabilities requested at creation. Playback status
    ;; is a separate field and must never leak into this value.
    (i32.store (i32.add (local.get $wa) (i32.const 4))
      (i32.load offset=4 (local.get $state)))
    ;; dwBufferBytes
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetCurrentPosition(this, lpdwCurrentPlayCursor, lpdwCurrentWriteCursor)
  (func $handle_IDirectSoundBuffer_GetCurrentPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $state i32) (local $handle i32) (local $pos i32)
    (local $size i32) (local $align i32) (local $lead i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (local.set $size (i32.load offset=12 (local.get $entry)))
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    ;; The host cursor is relative to the current snapshot. Add the position
    ;; at which that snapshot began; while stopped, the stored base itself is
    ;; the exact cursor that the next Play must use.
    (if (i32.and
          (i32.ne (i32.and (load.field DxObject flags (local.get $entry))
            (i32.const 1)) (i32.const 0))
          (i32.ne (local.get $handle) (i32.const 0)))
      (then (local.set $pos (call $host_voice_get_pos (local.get $handle))))
      (else (local.set $pos (i32.const 0))))
    (local.set $pos
      (i32.add (i32.load offset=12 (local.get $state)) (local.get $pos)))
    (if (i32.ne (local.get $size) (i32.const 0))
      (then (local.set $pos (i32.rem_u (local.get $pos) (local.get $size)))))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (local.get $pos))))
    ;; The write cursor is not the play cursor. DirectSound guarantees it leads
    ;; by whatever the driver has already committed to the DMA -- on Win98
    ;; hardware about 15ms -- and the bytes between the two are the one region
    ;; an app must never write, because they are already on their way out. We
    ;; reported the same value for both, so an app pacing its refills off the
    ;; write cursor was told that region was free.
    (if (local.get $arg2)
      (then
        ;; 15ms of this buffer's own format, truncated to a whole sample frame
        ;; so the lead never lands mid-sample.
        (local.set $align (i32.div_u
          (i32.mul (load.field DxObject bpp (local.get $entry))
                   (load.field DxObject pitch (local.get $entry)))
          (i32.const 8)))
        (local.set $lead (i32.const 0))
        (if (i32.and (i32.gt_u (local.get $size) (i32.const 0))
                     (i32.gt_u (local.get $align) (i32.const 0)))
          (then
            (local.set $lead (i32.mul
              (i32.div_u
                (i32.div_u (i32.mul (load.field DxObject misc2 (local.get $entry))
                                    (i32.mul (local.get $align) (i32.const 15)))
                           (i32.const 1000))
                (local.get $align))
              (local.get $align)))
            ;; A buffer shorter than the lead would wrap the write cursor past
            ;; the play cursor and mark the whole ring unsafe; keep it inside.
            (if (i32.ge_u (local.get $lead) (local.get $size))
              (then (local.set $lead (i32.const 0))))))
        (call $gs32 (local.get $arg2)
          (if (result i32) (local.get $size)
            (then (i32.rem_u (i32.add (local.get $pos) (local.get $lead)) (local.get $size)))
            (else (local.get $pos))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetFormat(this, pwfxFormat, dwSizeAllocated, pdwSizeWritten)
  ;;
  ;; Primary buffers are created without lpwfxFormat and receive their format
  ;; later through SetFormat.  Miles immediately asks the primary buffer for
  ;; that format and derives its DMA interval from nAvgBytesPerSec; returning
  ;; the old zero-filled stub made MSS32 divide by zero during startup.
  (func $handle_IDirectSoundBuffer_GetFormat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $wa i32) (local $channels i32)
    (local $bits i32) (local $rate i32) (local $align i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 18))))
    ;; A NULL format pointer is the documented size-query form.
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (select (i32.const 0x80070057) (i32.const 0)
            (i32.ne (local.get $arg2) (i32.const 0))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; Never write a partial WAVEFORMATEX across the caller's allocation.
    (if (i32.lt_u (local.get $arg2) (i32.const 18))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $channels
      (load.field DxObject bpp (local.get $entry)))
    (local.set $bits
      (load.field DxObject pitch (local.get $entry)))
    (local.set $rate (load.field DxObject misc2 (local.get $entry)))
    (local.set $align
      (i32.div_u (i32.mul (local.get $channels) (local.get $bits)) (i32.const 8)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (call $zero_memory (local.get $wa) (i32.const 18))
    (i32.store16 (local.get $wa) (i32.const 1)) ;; WAVE_FORMAT_PCM
    (i32.store16 (i32.add (local.get $wa) (i32.const 2)) (local.get $channels))
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (local.get $rate))
    (i32.store (i32.add (local.get $wa) (i32.const 8))
      (i32.mul (local.get $rate) (local.get $align))) ;; nAvgBytesPerSec
    (i32.store16 (i32.add (local.get $wa) (i32.const 12)) (local.get $align))
    (i32.store16 (i32.add (local.get $wa) (i32.const 14)) (local.get $bits))
    ;; cbSize remains zero for PCM.
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Volume/pan share validation and buffer-owned state. A missing creation
  ;; capability is not a successful no-op. CTRL3D buffers cannot be panned.
  (func $dsbuf_control_available (param $state i32) (param $pan i32) (result i32)
    (local $caps i32)
    (local.set $caps (i32.load offset=4 (local.get $state)))
    (i32.and
      (i32.ne (i32.and (local.get $caps)
        (select (i32.const 0x40) (i32.const 0x80) (local.get $pan))) (i32.const 0))
      (i32.eqz (i32.and (local.get $pan)
        (i32.ne (i32.and (local.get $caps) (i32.const 0x10)) (i32.const 0))))))

  (func $dsbuf_get_control (param $this i32) (param $out i32) (param $pan i32) (result i32)
    (local $entry i32) (local $state i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80070057))))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 5))
      (then (return (i32.const 0x80070057))))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (if (i32.eqz (call $dsbuf_control_available (local.get $state) (local.get $pan)))
      (then (return (i32.const 0x8878001E)))) ;; DSERR_CONTROLUNAVAIL
    (call $gs32 (local.get $out)
      (i32.load (i32.add (local.get $state)
        (select (i32.const 20) (i32.const 16) (local.get $pan)))))
    (i32.const 0))

  (func $dsbuf_set_control (param $this i32) (param $value i32) (param $pan i32) (result i32)
    (local $entry i32) (local $state i32) (local $handle i32)
    (if (i32.or (i32.lt_s (local.get $value) (i32.const -10000))
          (i32.gt_s (local.get $value)
            (select (i32.const 10000) (i32.const 0) (local.get $pan))))
      (then (return (i32.const 0x80070057))))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 5))
      (then (return (i32.const 0x80070057))))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (if (i32.eqz (call $dsbuf_control_available (local.get $state) (local.get $pan)))
      (then (return (i32.const 0x8878001E))))
    (i32.store (i32.add (local.get $state)
      (select (i32.const 20) (i32.const 16) (local.get $pan))) (local.get $value))
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    (if (local.get $handle) (then
      (if (local.get $pan)
        (then (call $host_voice_set_pan (local.get $handle) (local.get $value)))
        (else (call $host_voice_set_volume_db (local.get $handle) (local.get $value))))))
    (i32.const 0))

  (func $handle_IDirectSoundBuffer_GetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $dsbuf_get_control (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSoundBuffer_GetPan (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $dsbuf_get_control (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSoundBuffer_GetFrequency (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $state i32) (local $rate i32) (local $hr i32)
    (block $done
      (local.set $hr (i32.const 0x80070057))
      (br_if $done (i32.eqz (local.get $arg1)))
      (local.set $entry (call $dx_from_this (local.get $arg0)))
      (br_if $done (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 5)))
      (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
      (local.set $hr (i32.const 0x8878001E)) ;; DSERR_CONTROLUNAVAIL
      (br_if $done (i32.eqz (i32.and (i32.load offset=4 (local.get $state)) (i32.const 0x20))))
      (local.set $rate (i32.load offset=24 (local.get $state)))
      (if (i32.eqz (local.get $rate)) (then
        (local.set $rate (load.field DxObject misc2 (local.get $entry)))))
      (call $gs32 (local.get $arg1) (local.get $rate))
      (local.set $hr (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetStatus(this, lpdwStatus)
  (func $handle_IDirectSoundBuffer_GetStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $flags i32) (local $handle i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $flags (load.field DxObject flags (local.get $entry)))
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    ;; Web Audio ends non-looping sources asynchronously. Reflect that in the
    ;; guest-visible status so Miles can retire and reuse naturally-ended
    ;; samples instead of seeing DSBSTATUS_PLAYING forever.
    ;; Only a playing ONE-SHOT can end on its own: a looping buffer plays until
    ;; Stop, which clears these flags itself, and the host answers "playing"
    ;; for every looping snapshot. Nested ifs, not i32.and, so a stopped or
    ;; looping buffer never pays the host call -- in Worker mode that call is
    ;; a page round trip, and DX-Ball polls a looping ring once a frame.
    (if (i32.eq (i32.and (local.get $flags) (i32.const 5)) (i32.const 1))
      (then
        (if (local.get $handle)
          (then
            (if (i32.eqz (call $host_voice_is_playing (local.get $handle)))
              (then
                ;; DSBSTATUS_PLAYING=0x1, DSBSTATUS_LOOPING=0x4.
                (local.set $flags (i32.and (local.get $flags) (i32.const 0xFFFFFFFA)))
                (store.field DxObject flags (local.get $entry) (local.get $flags))))))))
    (if (local.get $arg1) (then
      (call $gs32 (local.get $arg1)
        (i32.and (local.get $flags) (i32.const 0x7)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Initialize — no-op
  (func $handle_IDirectSoundBuffer_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Lock(this, dwOffset, dwBytes, ppvAudioPtr1, pdwAudioBytes1, ppvAudioPtr2, pdwAudioBytes2, dwFlags)
  ;; 8 args! We only have 5 from dispatch. Read remaining from stack.
  (func $handle_IDirectSoundBuffer_Lock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $dib_wa i32) (local $buf_size i32)
    (local $buf_guest i32) (local $ppv2 i32) (local $pdw2 i32)
    (local $offset i32) (local $total i32) (local $len1 i32) (local $len2 i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $dib_wa (load.field DxObject misc1 (local.get $entry)))
    (local.set $buf_size (i32.load (i32.add (local.get $entry) (i32.const 12))))
    ;; Convert WASM addr to guest addr. The ring came from $heap_alloc, which
    ;; spills into the sparse VirtualAlloc backing once the guest heap is busy;
    ;; the direct-window inverse (wa - GUEST_BASE + image_base) is right only
    ;; inside that window. For a sparse ring it named unmapped guest memory, so
    ;; the game's mixer wrote into the NULL sentinel and every refresh played
    ;; the ring's zeros (Myth: The Fallen Lords silent in-level, 2.8M faults).
    (local.set $buf_guest (call $w2g (local.get $dib_wa)))
    ;; ppvAudioPtr2 and pdwAudioBytes2 (args 6,7 at ESP+24,ESP+28), flags at +32
    (local.set $ppv2 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $pdw2 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (local.set $offset (local.get $arg1))
    (if (local.get $buf_size)
      (then (local.set $offset (i32.rem_u (local.get $offset) (local.get $buf_size)))))
    ;; DSBLOCK_ENTIREBUFFER (0x2) means "ignore dwBytes, lock all of it".
    (local.set $total (select (local.get $buf_size) (local.get $arg2)
      (i32.and (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))) (i32.const 2))))
    (if (i32.gt_u (local.get $total) (local.get $buf_size))
      (then (local.set $total (local.get $buf_size))))
    ;; A lock that runs off the end of a ring comes back in TWO pieces: the tail
    ;; and then a second piece wrapped to the start. We used to report piece two
    ;; as a null pointer of length 0, so a streamer wrote only the tail and the
    ;; wrapped part of its span kept whatever the ring held there -- last lap's
    ;; audio, or on the first lap uninitialized guest memory, which comes out of
    ;; the speakers as a burst of noise. RollerCoaster Tycoon's menu music hits
    ;; this the first time its write span crosses the end of the buffer.
    (local.set $len1 (select (local.get $total)
                             (i32.sub (local.get $buf_size) (local.get $offset))
                             (i32.le_u (local.get $total)
                                       (i32.sub (local.get $buf_size) (local.get $offset)))))
    (local.set $len2 (i32.sub (local.get $total) (local.get $len1)))
    (call $gs32 (local.get $arg3) (i32.add (local.get $buf_guest) (local.get $offset)))
    (call $gs32 (local.get $arg4) (local.get $len1))
    (if (local.get $ppv2)
      (then (call $gs32 (local.get $ppv2)
        (select (local.get $buf_guest) (i32.const 0) (local.get $len2)))))
    (if (local.get $pdw2) (then (call $gs32 (local.get $pdw2) (local.get $len2))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))) ;; 8 args

  ;; Play(this, dwReserved1, dwReserved2, dwFlags)
  ;; Snapshot the buffer's PCM via voice_play_ring. Each DSBuffer owns its own
  ;; voice (allocated lazily here), so multiple buffers mix instead of clobbering
  ;; each other the way the old single-waveOut routing did.
  (func $handle_IDirectSoundBuffer_Play (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $handle i32) (local $dib_wa i32) (local $buf_size i32)
    (local $state i32) (local $loop i32) (local $start i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (local.set $dib_wa (load.field DxObject misc1 (local.get $entry)))
    (local.set $buf_size (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (local.set $handle (call $dsbuf_ensure_voice (local.get $entry)))
    ;; DSBPLAY_LOOPING = 1
    (local.set $loop (i32.and (local.get $arg3) (i32.const 1)))
    (local.set $start (i32.load offset=12 (local.get $state)))
    ;; Play on a buffer that is already playing does not move its play cursor
    ;; (DirectSound only takes the new flags). For a looping buffer asked to
    ;; keep looping there is nothing to take, so the host is not told at all:
    ;; a re-snapshot would restart the ring from $start and decode the whole
    ;; buffer again. DX-Ball re-Plays its 132KB looping buffer every frame.
    ;; Content changes still reach the host through Unlock's refresh.
    (if (i32.and
          (i32.eq (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 5))
                  (i32.const 5))
          (i32.ne (local.get $loop) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; Bitwise i32.and on (ptr, size) silently drops the play call whenever
    ;; their bits don't happen to overlap. Coerce both to 0/1 for logical AND.
    (if (i32.and (i32.ne (local.get $dib_wa) (i32.const 0))
                 (i32.ne (local.get $buf_size) (i32.const 0))) (then
      (drop (call $host_voice_play_ring
        (local.get $handle) (local.get $dib_wa) (local.get $buf_size)
        (local.get $start) (local.get $loop)))))
    (store.field DxObject flags (local.get $entry) (i32.or (i32.const 1) (i32.shl (local.get $loop) (i32.const 2))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; SetCurrentPosition(this, dwNewPosition). This is a DirectSound secondary-
  ;; buffer operation: a stopped buffer remembers where its next Play starts;
  ;; a live buffer immediately replaces its browser snapshot at that byte.
  (func $handle_IDirectSoundBuffer_SetCurrentPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $state i32) (local $size i32)
    (local $status i32) (local $handle i32) (local $loop i32)
    (local $dib_wa i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 5))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (if (i32.ne
          (i32.and (i32.load offset=4 (local.get $state)) (i32.const 1))
          (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88780032)) ;; DSERR_INVALIDCALL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $size (i32.load offset=12 (local.get $entry)))
    (if (i32.or (i32.eqz (local.get $size))
                (i32.ge_u (local.get $arg1) (local.get $size)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store offset=12 (local.get $state) (local.get $arg1))
    (local.set $status (load.field DxObject flags (local.get $entry)))
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    (if (i32.and
          (i32.ne (i32.and (local.get $status) (i32.const 1)) (i32.const 0))
          (i32.ne (local.get $handle) (i32.const 0)))
      (then
        (local.set $dib_wa (load.field DxObject misc1 (local.get $entry)))
        (local.set $loop
          (i32.ne (i32.and (local.get $status) (i32.const 4)) (i32.const 0)))
        (drop (call $host_voice_play_ring
          (local.get $handle) (local.get $dib_wa) (local.get $size)
          (local.get $arg1) (local.get $loop)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetFormat(this, pcfxFormat) — primary buffers are born without a format.
  ;; Keep the canonical PCM fields in the DS buffer entry so GetFormat,
  ;; SetFrequency and the eventual host voice all observe the same values.
  ;; Native DirectSound exposes this only on primary buffers and only after
  ;; DSSCL_PRIORITY (or stronger) has been established on their parent device.
  (func $handle_IDirectSoundBuffer_SetFormat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $state i32) (local $wa i32)
    (local $level i32) (local $status i32) (local $handle i32)
    (local $dib_wa i32) (local $buf_size i32) (local $loop i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DSERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 5))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (if (i32.eqz (i32.and (i32.load offset=4 (local.get $state)) (i32.const 1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88780032)) ;; DSERR_INVALIDCALL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $level (i32.load offset=8 (local.get $state)))
    (if (i32.or (i32.lt_u (local.get $level) (i32.const 2))
                (i32.gt_u (local.get $level) (i32.const 4)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88780046)) ;; DSERR_PRIOLEVELNEEDED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $status (load.field DxObject flags (local.get $entry)))
    ;; WRITEPRIMARY grants direct access, so the caller must stop its primary
    ;; buffer before changing format. PRIORITY/EXCLUSIVE perform the native
    ;; implicit stop/change/restart behavior below.
    (if (i32.and
          (i32.eq (local.get $level) (i32.const 4))
          (i32.ne (i32.and (local.get $status) (i32.const 1)) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88780032)) ;; DSERR_INVALIDCALL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $wa (call $ds_pcm_format_wa (local.get $arg1)))
    (if (i32.eq (local.get $wa) (global.get $NULL_SENTINEL))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x88780064)) ;; DSERR_BADFORMAT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    (if (i32.ne (local.get $handle) (i32.const 0))
      (then
        (drop (call $host_voice_close (local.get $handle)))
        (store.field DxObject misc0 (local.get $entry) (i32.const 0))))
    (store.field DxObject bpp (local.get $entry) (i32.load16_u (i32.add (local.get $wa) (i32.const 2)))) ;; nChannels
    (store.field DxObject pitch (local.get $entry) (i32.load16_u (i32.add (local.get $wa) (i32.const 14)))) ;; wBitsPerSample
    (store.field DxObject misc2 (local.get $entry) (i32.load (i32.add (local.get $wa) (i32.const 4)))) ;; nSamplesPerSec
    (if (i32.ne (i32.and (local.get $status) (i32.const 1)) (i32.const 0))
      (then
        (local.set $handle (call $dsbuf_ensure_voice (local.get $entry)))
        (local.set $dib_wa (load.field DxObject misc1 (local.get $entry)))
        (local.set $buf_size (i32.load offset=12 (local.get $entry)))
        (local.set $loop
          (i32.ne (i32.and (local.get $status) (i32.const 4)) (i32.const 0)))
        (if (i32.and
              (i32.ne (local.get $dib_wa) (i32.const 0))
              (i32.ne (local.get $buf_size) (i32.const 0)))
          (then
            (drop (call $host_voice_play_ring
              (local.get $handle) (local.get $dib_wa) (local.get $buf_size)
              (i32.const 0) (local.get $loop)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetVolume(this, lVolume) — DSOUND attenuation centibels (0=full, -10000=silent)
  (func $handle_IDirectSoundBuffer_SetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $dsbuf_set_control (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetPan(this, lPan) — centibels, -10000=left .. +10000=right
  (func $handle_IDirectSoundBuffer_SetPan (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $dsbuf_set_control (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetFrequency(this, dwFrequency) — playback rate in Hz; 0 = original
  (func $handle_IDirectSoundBuffer_SetFrequency (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $handle i32) (local $state i32) (local $caps i32) (local $hr i32)
    (block $done
      (local.set $hr (i32.const 0x80070057))
      ;; Legacy IDirectSoundBuffer range, not the newer 200 kHz extension.
      ;; Zero is DSBFREQUENCY_ORIGINAL and never changes the PCM format.
      (if (local.get $arg1) (then
        (br_if $done (i32.or (i32.lt_u (local.get $arg1) (i32.const 100))
                            (i32.gt_u (local.get $arg1) (i32.const 100000))))))
      (local.set $entry (call $dx_from_this (local.get $arg0)))
      (br_if $done (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 5)))
      (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
      (local.set $caps (i32.load offset=4 (local.get $state)))
      (local.set $hr (i32.const 0x8878001E))
      (br_if $done (i32.or (i32.eqz (i32.and (local.get $caps) (i32.const 0x20)))
                          (i32.ne (i32.and (local.get $caps) (i32.const 1)) (i32.const 0))))
      (i32.store offset=24 (local.get $state) (local.get $arg1))
      (local.set $handle (load.field DxObject misc0 (local.get $entry)))
      (if (local.get $handle) (then
        (call $host_voice_set_freq (local.get $handle) (local.get $arg1))))
      (local.set $hr (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Stop(this) — stop playback but keep the voice; Play() may be called again
  (func $handle_IDirectSoundBuffer_Stop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $state i32) (local $handle i32)
    (local $size i32) (local $position i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    ;; Stop freezes the live cursor. Leaving only the snapshot origin here
    ;; would make a subsequent Play jump backwards to its previous start.
    (if (i32.and
          (i32.ne (i32.and (load.field DxObject flags (local.get $entry))
            (i32.const 1)) (i32.const 0))
          (i32.ne (local.get $handle) (i32.const 0)))
      (then
        (local.set $size (i32.load offset=12 (local.get $entry)))
        (local.set $position
          (i32.add (i32.load offset=12 (local.get $state))
                   (call $host_voice_get_pos (local.get $handle))))
        (if (i32.ne (local.get $size) (i32.const 0))
          (then
            (local.set $position
              (i32.rem_u (local.get $position) (local.get $size)))))
        (i32.store offset=12 (local.get $state) (local.get $position))))
    (if (local.get $handle) (then
      (drop (call $host_voice_stop (local.get $handle)))))
    (store.field DxObject flags (local.get $entry) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Unlock(this, pvAudioPtr1, dwAudioBytes1, pvAudioPtr2, dwAudioBytes2)
  ;; A looping DirectSound buffer is commonly a software-mixer ring. Miles
  ;; rewrites it after Play and expects the live device to consume those new
  ;; bytes; refresh the existing host AudioBuffer in place without moving its
  ;; play cursor. Host loop mode 2 is internal and distinct from DSBPLAY_LOOPING.
  (func $handle_IDirectSoundBuffer_Unlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $handle i32) (local $dib_wa i32) (local $buf_size i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    (local.set $dib_wa (load.field DxObject misc1 (local.get $entry)))
    (local.set $buf_size (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (if (i32.and
          (i32.eq (i32.and (load.field DxObject flags (local.get $entry))
            (i32.const 5)) (i32.const 5))
          (i32.and (i32.ne (local.get $handle) (i32.const 0))
            (i32.and (i32.ne (local.get $dib_wa) (i32.const 0))
              (i32.ne (local.get $buf_size) (i32.const 0)))))
      (then
        (drop (call $host_voice_play_ring
          (local.get $handle) (local.get $dib_wa) (local.get $buf_size)
          (i32.const 0) (i32.const 2)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; Restore — no-op
  (func $handle_IDirectSoundBuffer_Restore (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectSound3DBuffer methods
  ;; The host owns canonical property state because it also owns PannerNode.
  ;; Float values remain raw IEEE-754 i32 bits across the import boundary.
  ;; ════════════════════════════════════════════════════════════

  (func $ds3d_voice_from_this (param $this i32) (result i32)
    (call $dsbuf_ensure_voice (call $dx_from_this (local.get $this))))

  (func $handle_IDirectSound3DBuffer_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectSoundBuffer_QueryInterface
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectSound3DBuffer_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_addref
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectSound3DBuffer_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectSoundBuffer_Release
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; DS3DBUFFER is 64 bytes: size, position, velocity, cone angles,
  ;; cone orientation, outside volume, min/max distance, and mode.
  (func $handle_IDirectSound3DBuffer_GetAllParameters (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else (if (i32.lt_u (call $gl32 (local.get $arg1)) (i32.const 64))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))) ;; DSERR_INVALIDPARAM
        (else
        (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
        (call $gs32 (local.get $arg1) (i32.const 64))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (call $host_voice_3d_get (local.get $handle) (i32.const 0)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 8)) (call $host_voice_3d_get (local.get $handle) (i32.const 1)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 12)) (call $host_voice_3d_get (local.get $handle) (i32.const 2)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 16)) (call $host_voice_3d_get (local.get $handle) (i32.const 3)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 20)) (call $host_voice_3d_get (local.get $handle) (i32.const 4)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 24)) (call $host_voice_3d_get (local.get $handle) (i32.const 5)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 28)) (call $host_voice_3d_get (local.get $handle) (i32.const 6)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 32)) (call $host_voice_3d_get (local.get $handle) (i32.const 7)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 36)) (call $host_voice_3d_get (local.get $handle) (i32.const 8)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 40)) (call $host_voice_3d_get (local.get $handle) (i32.const 9)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 44)) (call $host_voice_3d_get (local.get $handle) (i32.const 10)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 48)) (call $host_voice_3d_get (local.get $handle) (i32.const 11)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 52)) (call $host_voice_3d_get (local.get $handle) (i32.const 12)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 56)) (call $host_voice_3d_get (local.get $handle) (i32.const 13)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 60)) (call $host_voice_3d_get (local.get $handle) (i32.const 14)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DBuffer_GetConeAngles (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (call $host_voice_3d_get (local.get $handle) (i32.const 6)))))
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (call $host_voice_3d_get (local.get $handle) (i32.const 7)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DBuffer_GetConeOrientation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
    (if (local.get $arg1) (then
      (call $gs32 (local.get $arg1) (call $host_voice_3d_get (local.get $handle) (i32.const 8)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (call $host_voice_3d_get (local.get $handle) (i32.const 9)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 8)) (call $host_voice_3d_get (local.get $handle) (i32.const 10)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DBuffer_GetConeOutsideVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (call $host_voice_3d_get (local.get $handle) (i32.const 11)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DBuffer_GetMaxDistance (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (call $host_voice_3d_get (local.get $handle) (i32.const 13)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DBuffer_GetMinDistance (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (call $host_voice_3d_get (local.get $handle) (i32.const 12)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DBuffer_GetMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (call $host_voice_3d_get (local.get $handle) (i32.const 14)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DBuffer_GetPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
    (if (local.get $arg1) (then
      (call $gs32 (local.get $arg1) (call $host_voice_3d_get (local.get $handle) (i32.const 0)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (call $host_voice_3d_get (local.get $handle) (i32.const 1)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 8)) (call $host_voice_3d_get (local.get $handle) (i32.const 2)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DBuffer_GetVelocity (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
    (if (local.get $arg1) (then
      (call $gs32 (local.get $arg1) (call $host_voice_3d_get (local.get $handle) (i32.const 3)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (call $host_voice_3d_get (local.get $handle) (i32.const 4)))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 8)) (call $host_voice_3d_get (local.get $handle) (i32.const 5)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DBuffer_SetAllParameters (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else (if (i32.ne (call $gl32 (local.get $arg1)) (i32.const 64))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))) ;; DSERR_INVALIDPARAM
        (else
        (local.set $handle (call $ds3d_voice_from_this (local.get $arg0)))
        (call $host_voice_3d_set (local.get $handle) (i32.const 0)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 4)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 8)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))
        (call $host_voice_3d_set (local.get $handle) (i32.const 3)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 16)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 20)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 24))))
        (call $host_voice_3d_set (local.get $handle) (i32.const 6)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 28)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 32))) (i32.const 0))
        (call $host_voice_3d_set (local.get $handle) (i32.const 8)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 36)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 40)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 44))))
        (call $host_voice_3d_set (local.get $handle) (i32.const 11)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 48))) (i32.const 0) (i32.const 0))
        (call $host_voice_3d_set (local.get $handle) (i32.const 12)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 52))) (i32.const 0) (i32.const 0))
        (call $host_voice_3d_set (local.get $handle) (i32.const 13)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 56))) (i32.const 0) (i32.const 0))
        (call $host_voice_3d_set (local.get $handle) (i32.const 14)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 60))) (i32.const 0) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DBuffer_SetConeAngles (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (call $ds3d_voice_from_this (local.get $arg0)) (i32.const 6)
      (local.get $arg1) (local.get $arg2) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirectSound3DBuffer_SetConeOrientation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (call $ds3d_voice_from_this (local.get $arg0)) (i32.const 8)
      (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IDirectSound3DBuffer_SetConeOutsideVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (call $ds3d_voice_from_this (local.get $arg0)) (i32.const 11)
      (local.get $arg1) (i32.const 0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DBuffer_SetMaxDistance (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (call $ds3d_voice_from_this (local.get $arg0)) (i32.const 13)
      (local.get $arg1) (i32.const 0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DBuffer_SetMinDistance (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (call $ds3d_voice_from_this (local.get $arg0)) (i32.const 12)
      (local.get $arg1) (i32.const 0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DBuffer_SetMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (call $ds3d_voice_from_this (local.get $arg0)) (i32.const 14)
      (local.get $arg1) (i32.const 0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DBuffer_SetPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (call $ds3d_voice_from_this (local.get $arg0)) (i32.const 0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IDirectSound3DBuffer_SetVelocity (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (call $ds3d_voice_from_this (local.get $arg0)) (i32.const 3)
      (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectSound3DListener methods
  ;; ════════════════════════════════════════════════════════════

  (func $handle_IDirectSound3DListener_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectSoundBuffer_QueryInterface
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectSound3DListener_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_addref
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectSound3DListener_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectSoundBuffer_Release
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; Voice handle zero addresses the process-wide listener state in the audio
  ;; bridge. It remains shared by every primary-buffer interface wrapper.
  (func $ds3d_listener_get_vector (param $out i32) (param $property i32)
    (if (local.get $out) (then
      (call $gs32 (local.get $out)
        (call $host_voice_3d_get (i32.const 0) (local.get $property)))
      (call $gs32 (i32.add (local.get $out) (i32.const 4))
        (call $host_voice_3d_get (i32.const 0) (i32.add (local.get $property) (i32.const 1))))
      (call $gs32 (i32.add (local.get $out) (i32.const 8))
        (call $host_voice_3d_get (i32.const 0) (i32.add (local.get $property) (i32.const 2)))))))

  (func $handle_IDirectSound3DListener_GetAllParameters (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else (if (i32.lt_u (call $gl32 (local.get $arg1)) (i32.const 64))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))) ;; DSERR_INVALIDPARAM
        (else
        (call $gs32 (local.get $arg1) (i32.const 64))
        (call $ds3d_listener_get_vector (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0))
        (call $ds3d_listener_get_vector (i32.add (local.get $arg1) (i32.const 16)) (i32.const 3))
        (call $ds3d_listener_get_vector (i32.add (local.get $arg1) (i32.const 28)) (i32.const 6))
        (call $ds3d_listener_get_vector (i32.add (local.get $arg1) (i32.const 40)) (i32.const 9))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 52)) (call $host_voice_3d_get (i32.const 0) (i32.const 12)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 56)) (call $host_voice_3d_get (i32.const 0) (i32.const 13)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 60)) (call $host_voice_3d_get (i32.const 0) (i32.const 14)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DListener_GetDistanceFactor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then
        (call $gs32 (local.get $arg1) (call $host_voice_3d_get (i32.const 0) (i32.const 12)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DListener_GetDopplerFactor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then
        (call $gs32 (local.get $arg1) (call $host_voice_3d_get (i32.const 0) (i32.const 14)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DListener_GetOrientation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0)) (i32.ne (local.get $arg2) (i32.const 0)))
      (then
        (call $ds3d_listener_get_vector (local.get $arg1) (i32.const 6))
        (call $ds3d_listener_get_vector (local.get $arg2) (i32.const 9))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DListener_GetPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $ds3d_listener_get_vector (local.get $arg1) (i32.const 0)) (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DListener_GetRolloffFactor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then
        (call $gs32 (local.get $arg1) (call $host_voice_3d_get (i32.const 0) (i32.const 13)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DListener_GetVelocity (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $ds3d_listener_get_vector (local.get $arg1) (i32.const 3)) (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectSound3DListener_SetAllParameters (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else (if (i32.ne (call $gl32 (local.get $arg1)) (i32.const 64))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))) ;; DSERR_INVALIDPARAM
        (else
        (call $host_voice_3d_set (i32.const 0) (i32.const 0)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 4)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 8)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))
        (call $host_voice_3d_set (i32.const 0) (i32.const 3)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 16)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 20)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 24))))
        (call $host_voice_3d_set (i32.const 0) (i32.const 6)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 28)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 32)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 36))))
        (call $host_voice_3d_set (i32.const 0) (i32.const 9)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 40)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 44)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 48))))
        (call $host_voice_3d_set (i32.const 0) (i32.const 12)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 52))) (local.get $arg2) (i32.const 0))
        (call $host_voice_3d_set (i32.const 0) (i32.const 13)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 56))) (local.get $arg2) (i32.const 0))
        (call $host_voice_3d_set (i32.const 0) (i32.const 14)
          (call $gl32 (i32.add (local.get $arg1) (i32.const 60))) (local.get $arg2) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DListener_SetDistanceFactor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (i32.const 0) (i32.const 12) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DListener_SetDopplerFactor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (i32.const 0) (i32.const 14) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DListener_SetOrientation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (i32.const 0) (i32.const 6)
      (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (call $host_voice_3d_set (i32.const 0) (i32.const 9)
      (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  (func $handle_IDirectSound3DListener_SetPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (i32.const 0) (i32.const 0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IDirectSound3DListener_SetRolloffFactor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (i32.const 0) (i32.const 13) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectSound3DListener_SetVelocity (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (i32.const 0) (i32.const 3)
      (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IDirectSound3DListener_CommitDeferredSettings (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_voice_3d_set (i32.const 0) (i32.const 15) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectInput methods
  ;; ════════════════════════════════════════════════════════════

  (func $handle_IDirectInput_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_wa i32) (local $kind i32) (local $entry i32)
    (local $version i32) (local $slot i32) (local $obj i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Translate riid exactly once and classify the complete GUID.
    (local.set $iid_wa (call $g2w (local.get $arg1)))
    (local.set $kind (call $dinput_iid_kind_wa (local.get $iid_wa)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $version (load.field.memarg DxObject misc0 (local.get $entry)))
    (if (i32.eqz (local.get $version))
      (then (local.set $version (i32.const 0x0700))))
    ;; DirectInput8 is a separate class and cannot expose older interfaces.
    ;; Legacy objects likewise cannot be upgraded to IDirectInput8.
    (if (i32.or
          (i32.eqz (local.get $kind))
          (if (result i32) (i32.ge_u (local.get $version) (i32.const 0x0800))
            (then (i32.and
              (i32.ne (local.get $kind) (i32.const 1))
              (i32.ne (local.get $kind) (i32.const 5))))
            (else (i32.or
              (i32.eq (local.get $kind) (i32.const 5))
              (i32.or
                (i32.and (i32.eq (local.get $kind) (i32.const 3))
                  (i32.lt_u (local.get $version) (i32.const 0x0500)))
                (i32.and (i32.eq (local.get $kind) (i32.const 4))
                  (i32.lt_u (local.get $version) (i32.const 0x0700))))))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; E_NOINTERFACE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        ;; Return the primary wrapper as the one controlling IUnknown.
        (local.set $obj
          (i32.add
            (i32.sub
              (i32.add (global.get $COM_WRAPPERS)
                (i32.mul (local.get $slot) (i32.const 8)))
              (global.get $GUEST_BASE))
            (global.get $image_base)))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DINPUT)))))
    (if (i32.or (i32.eq (local.get $kind) (i32.const 3))
                (i32.eq (local.get $kind) (i32.const 4)))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DINPUT7)))))
    (if (i32.eq (local.get $kind) (i32.const 5))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DINPUT)))))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (store.field DxObject refcount (local.get $entry)
      (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (call $gs32 (local.get $arg2) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))



  ;; CreateDevice(this, rguid, lplpDirectInputDevice, pUnkOuter)
  ;; rguid: GUID_SysKeyboard = {6F1D2B61-D5A0-11CF-BFC7-444553540000}
  ;;         GUID_SysMouse    = {6F1D2B60-D5A0-11CF-BFC7-444553540000}
  (func $handle_IDirectInput_CreateDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32) (local $entry i32) (local $guid_first i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 7) (global.get $DX_VTBL_DIDEV2)))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (i32.store offset=16 (local.get $entry)
      (load.field.memarg DxObject misc0 (call $dx_from_this (local.get $arg0))))
    ;; Detect keyboard vs mouse from GUID first dword. Unknown devices
    ;; (joysticks, etc.) are present but inert.
    (local.set $guid_first (call $gl32 (local.get $arg1)))
    (store.field DxObject misc0 (local.get $entry) (i32.const 0))
    (if (i32.eq (local.get $guid_first) (i32.const 0x6F1D2B61))
      (then
        (store.field DxObject misc0 (local.get $entry) (i32.const 1)))) ;; keyboard
    (if (i32.eq (local.get $guid_first) (i32.const 0x6F1D2B60))
      (then
        (store.field DxObject misc0 (local.get $entry) (i32.const 2)))) ;; mouse
    (call $gs32 (local.get $arg2) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; IDirectInput2::FindDevice(this, rguidClass, ptszName, pguidInstance)
  ;; We expose exactly the system keyboard and mouse, neither of which is
  ;; found by name, so this reports "no such device" rather than handing back
  ;; an uninitialised GUID the caller would then create a device from.
  (func $handle_IDirectInput7_FindDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070002)) ;; DIERR_DEVICENOTREG
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Complete DirectInput device interface classifier. Device7/8 identities
  ;; are recognized so callers get an honest E_NOINTERFACE until their extra
  ;; vtable methods exist, rather than a successful pointer to a short table.
  (func $dinput_device_iid_kind_wa (param $iid_wa i32) (result i32)
    (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0) (i32.const 0)
          (i32.const 0x000000C0) (i32.const 0x46000000))
      (then (return (i32.const 1)))) ;; IUnknown
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x5944E680) (i32.const 0x11CFC92E)
            (i32.const 0x4544C7BF) (i32.const 0x00005453))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x5944E681) (i32.const 0x11CFC92E)
            (i32.const 0x4544C7BF) (i32.const 0x00005453)))
      (then (return (i32.const 2)))) ;; IDirectInputDeviceA/W
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x5944E682) (i32.const 0x11CFC92E)
            (i32.const 0x4544C7BF) (i32.const 0x00005453))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x5944E683) (i32.const 0x11CFC92E)
            (i32.const 0x4544C7BF) (i32.const 0x00005453)))
      (then (return (i32.const 3)))) ;; IDirectInputDevice2A/W
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x57D7C6BC) (i32.const 0x11D32356)
            (i32.const 0xC0009D8E) (i32.const 0xAE44684F))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x57D7C6BD) (i32.const 0x11D32356)
            (i32.const 0xC0009D8E) (i32.const 0xAE44684F)))
      (then (return (i32.const 4)))) ;; IDirectInputDevice7A/W
    (if (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x54D41080) (i32.const 0x4833DC15)
            (i32.const 0x8F741BA4) (i32.const 0x7981A373))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x54D41081) (i32.const 0x4833DC15)
            (i32.const 0x8F741BA4) (i32.const 0x7981A373)))
      (then (return (i32.const 5)))) ;; IDirectInputDevice8A/W
    (i32.const 0))

  ;; The device vtable a classifier kind asks for. v1/v2/v7 are nested
  ;; supersets, so the three faces differ only in length and every caller
  ;; gets the one it named. Kinds outside 1..4 never reach here -- each call
  ;; site rejects them with DIERR_NOINTERFACE first -- and IUnknown (1) takes
  ;; the v1 table, which is what its slots 0..2 are.
  (func $dinput_device_vtable_for_kind (param $kind i32) (result i32)
    (if (i32.eq (local.get $kind) (i32.const 4))
      (then (return (global.get $DX_VTBL_DIDEV7))))
    (if (i32.eq (local.get $kind) (i32.const 3))
      (then (return (global.get $DX_VTBL_DIDEV2))))
    (global.get $DX_VTBL_DIDEV))

  ;; IDirectInput7::CreateDeviceEx(this, rguid, riid, ppvOut, punkOuter)
  ;; Device1/2 are the complete ABI range implemented here. Device7 adds two
  ;; methods beyond that table, so do not manufacture a plausible wrong face.
  (func $handle_IDirectInput7_CreateDeviceEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_wa i32) (local $kind i32) (local $vtbl i32)
    (local $obj i32) (local $entry i32) (local $parent_entry i32)
    (local $guid_first i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (if (i32.or
          (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
          (i32.eqz (local.get $arg3)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; E_INVALIDARG
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (local.get $arg4)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110)) ;; CLASS_E_NOAGGREGATION
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; Translate riid exactly once and accept only implemented complete faces.
    (local.set $iid_wa (call $g2w (local.get $arg2)))
    (local.set $kind (call $dinput_device_iid_kind_wa (local.get $iid_wa)))
    (if (i32.or (i32.lt_u (local.get $kind) (i32.const 2))
                (i32.gt_u (local.get $kind) (i32.const 4)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; DIERR_NOINTERFACE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $vtbl (call $dinput_device_vtable_for_kind (local.get $kind)))
    (local.set $obj (call $dx_create_com_obj (i32.const 7) (local.get $vtbl)))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $parent_entry (call $dx_from_this (local.get $arg0)))
    (i32.store offset=16 (local.get $entry)
      (load.field.memarg DxObject misc0 (local.get $parent_entry)))
    (local.set $guid_first (call $gl32 (local.get $arg1)))
    (store.field DxObject misc0 (local.get $entry) (i32.const 0))
    (if (i32.eq (local.get $guid_first) (i32.const 0x6F1D2B61))
      (then (store.field DxObject misc0 (local.get $entry) (i32.const 1)))) ;; keyboard
    (if (i32.eq (local.get $guid_first) (i32.const 0x6F1D2B60))
      (then (store.field DxObject misc0 (local.get $entry) (i32.const 2)))) ;; mouse
    (call $gs32 (local.get $arg3) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; DirectInput enumeration uses the generic CACA0011 callback-return thunk.
  ;; The state is a typed frame on the guest stack, not mutable globals, so an
  ;; enumeration callback may start another enumeration without corrupting the
  ;; outer walk. Layout (624 bytes, descriptor begins at +40):
  ;;   +0 "DIEN", +4 caller return, +8 callback, +12 pvRef, +16 kind,
  ;;   +20 filter, +24 next index, +28 device kind, +32 flags, +36 DI version.
  (global $DI_ENUM_FRAME_SIZE i32 (i32.const 624))

  (func $di_fill_system_guid (param $dst i32) (param $data1 i32)
    (call $gs32 (local.get $dst) (local.get $data1))
    (i32.store16 (call $g2w (i32.add (local.get $dst) (i32.const 4))) (i32.const 0xD5A0))
    (i32.store16 (call $g2w (i32.add (local.get $dst) (i32.const 6))) (i32.const 0x11CF))
    (call $gs32 (i32.add (local.get $dst) (i32.const 8)) (i32.const 0x4544C7BF))
    (call $gs32 (i32.add (local.get $dst) (i32.const 12)) (i32.const 0x00005453)))

  (func $di_fill_object_guid (param $dst i32) (param $data1 i32)
    (call $gs32 (local.get $dst) (local.get $data1))
    (i32.store16 (call $g2w (i32.add (local.get $dst) (i32.const 4)))
      (select (i32.const 0xD33C) (i32.const 0xC9F3)
        (i32.eq (local.get $data1) (i32.const 0x55728220))))
    (i32.store16 (call $g2w (i32.add (local.get $dst) (i32.const 6))) (i32.const 0x11CF))
    (call $gs32 (i32.add (local.get $dst) (i32.const 8)) (i32.const 0x4544C7BF))
    (call $gs32 (i32.add (local.get $dst) (i32.const 12)) (i32.const 0x00005453)))

  (func $di_write_device_name (param $dst i32) (param $kind i32)
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then
        (call $gs32 (local.get $dst) (i32.const 0x73756F4D)) ;; "Mous"
        (i32.store16 (call $g2w (i32.add (local.get $dst) (i32.const 4))) (i32.const 0x0065)))
      (else
        (call $gs32 (local.get $dst) (i32.const 0x6279654B)) ;; "Keyb"
        (call $gs32 (i32.add (local.get $dst) (i32.const 4)) (i32.const 0x6472616F)) ;; "oard"
        (i32.store8 (call $g2w (i32.add (local.get $dst) (i32.const 8))) (i32.const 0)))))

  ;; DIDEVICEINSTANCEA. DirectX 3 callers receive the documented DX3 shape
  ;; (560 bytes); DirectInput 5/7/8 callers receive the full 580-byte shape.
  (func $di_fill_device_instance
        (param $dst i32) (param $kind i32) (param $version i32) (param $size i32)
    (local $dev_type i32)
    (call $zero_memory (call $g2w (local.get $dst)) (local.get $size))
    (call $gs32 (local.get $dst) (local.get $size))
    (call $di_fill_system_guid (i32.add (local.get $dst) (i32.const 4))
      (select (i32.const 0x6F1D2B60) (i32.const 0x6F1D2B61)
        (i32.eq (local.get $kind) (i32.const 2))))
    (call $di_fill_system_guid (i32.add (local.get $dst) (i32.const 20))
      (select (i32.const 0x6F1D2B60) (i32.const 0x6F1D2B61)
        (i32.eq (local.get $kind) (i32.const 2))))
    (if (i32.ge_u (local.get $version) (i32.const 0x0800))
      (then
        (local.set $dev_type
          (select (i32.const 0x0212) (i32.const 0x0413)
            (i32.eq (local.get $kind) (i32.const 2)))))
      (else
        (local.set $dev_type
          (select (i32.const 0x0202) (i32.const 0x0403)
            (i32.eq (local.get $kind) (i32.const 2))))))
    (call $gs32 (i32.add (local.get $dst) (i32.const 36)) (local.get $dev_type))
    (call $di_write_device_name (i32.add (local.get $dst) (i32.const 40)) (local.get $kind))
    (call $di_write_device_name (i32.add (local.get $dst) (i32.const 300)) (local.get $kind)))

  (func $di_hex_digit (param $v i32) (result i32)
    (if (result i32) (i32.lt_u (local.get $v) (i32.const 10))
      (then (i32.add (local.get $v) (i32.const 0x30)))
      (else (i32.add (local.get $v) (i32.const 0x37)))))

  ;; Canonical identity fields for the objects exposed by EnumObjects and
  ;; GetObjectInfo. Keeping these out of either API's control flow makes a
  ;; dwType returned by enumeration usable verbatim with DIPH_BYID.
  (func $di_object_offset (param $kind i32) (param $index i32) (result i32)
    (if (result i32) (i32.eq (local.get $kind) (i32.const 2))
      (then
        (if (result i32) (i32.lt_u (local.get $index) (i32.const 3))
          (then (i32.shl (local.get $index) (i32.const 2)))
          (else (i32.add (i32.const 12)
                  (i32.sub (local.get $index) (i32.const 3))))))
      (else (local.get $index))))

  (func $di_object_type (param $kind i32) (param $index i32) (result i32)
    (i32.or
      (select (i32.const 1) (i32.const 4)
        (i32.and (i32.eq (local.get $kind) (i32.const 2))
                 (i32.lt_u (local.get $index) (i32.const 3))))
      (i32.shl (local.get $index) (i32.const 8))))

  (func $di_object_exists (param $kind i32) (param $index i32) (result i32)
    (if (result i32) (i32.eq (local.get $kind) (i32.const 2))
      (then (i32.lt_u (local.get $index) (i32.const 6)))
      (else
        (i32.and
          (i32.eq (local.get $kind) (i32.const 1))
          (i32.and (i32.lt_u (local.get $index) (i32.const 256))
                   (i32.ne (call $di_dik_to_vk_strict (local.get $index))
                           (i32.const 0)))))))

  ;; DIDEVICEOBJECTINSTANCEA. Mouse offsets match DIMOUSESTATE; keyboard
  ;; offsets are DIK scan codes, which is the standard c_dfDIKeyboard layout.
  (func $di_fill_object_instance_size
        (param $dst i32) (param $kind i32) (param $index i32) (param $size i32)
    (local $data1 i32)
    (call $zero_memory (call $g2w (local.get $dst)) (local.get $size))
    (call $gs32 (local.get $dst) (local.get $size))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then
        (if (i32.lt_u (local.get $index) (i32.const 3))
          (then
            (local.set $data1 (i32.add (i32.const 0xA36D02E0) (local.get $index)))
            (if (i32.eqz (local.get $index))
              (then (call $gs32 (i32.add (local.get $dst) (i32.const 32)) (i32.const 0x78612D58))) ;; X-ax
              (else (if (i32.eq (local.get $index) (i32.const 1))
                (then (call $gs32 (i32.add (local.get $dst) (i32.const 32)) (i32.const 0x78612D59))) ;; Y-ax
                (else (call $gs32 (i32.add (local.get $dst) (i32.const 32)) (i32.const 0x65656857)))))) ;; Whee
            (if (i32.lt_u (local.get $index) (i32.const 2))
              (then
                (i32.store16 (call $g2w (i32.add (local.get $dst) (i32.const 36))) (i32.const 0x0073))) ;; s
              (else
                (i32.store16 (call $g2w (i32.add (local.get $dst) (i32.const 36))) (i32.const 0x006C))))) ;; l
          (else
            (local.set $data1 (i32.const 0xA36D02F0))
            (call $gs32 (i32.add (local.get $dst) (i32.const 32)) (i32.const 0x74747542)) ;; Butt
            (call $gs32 (i32.add (local.get $dst) (i32.const 36)) (i32.const 0x30206E6F)) ;; on 0
            (i32.store8 (call $g2w (i32.add (local.get $dst) (i32.const 39)))
              (i32.add (i32.const 0x30) (i32.sub (local.get $index) (i32.const 3)))))))
      (else
        (local.set $data1 (i32.const 0x55728220)) ;; GUID_Key
        (call $gs32 (i32.add (local.get $dst) (i32.const 32)) (i32.const 0x2079654B)) ;; "Key "
        (i32.store8 (call $g2w (i32.add (local.get $dst) (i32.const 36))) (i32.const 0x30))
        (i32.store8 (call $g2w (i32.add (local.get $dst) (i32.const 37))) (i32.const 0x78))
        (i32.store8 (call $g2w (i32.add (local.get $dst) (i32.const 38)))
          (call $di_hex_digit (i32.shr_u (local.get $index) (i32.const 4))))
        (i32.store8 (call $g2w (i32.add (local.get $dst) (i32.const 39)))
          (call $di_hex_digit (i32.and (local.get $index) (i32.const 15))))))
    (call $di_fill_object_guid (i32.add (local.get $dst) (i32.const 4)) (local.get $data1))
    (call $gs32 (i32.add (local.get $dst) (i32.const 20))
      (call $di_object_offset (local.get $kind) (local.get $index)))
    (call $gs32 (i32.add (local.get $dst) (i32.const 24))
      (call $di_object_type (local.get $kind) (local.get $index))))

  (func $di_fill_object_instance
        (param $dst i32) (param $kind i32) (param $index i32) (param $version i32)
    (call $di_fill_object_instance_size
      (local.get $dst) (local.get $kind) (local.get $index)
      (select (i32.const 292) (i32.const 316)
        (i32.le_u (local.get $version) (i32.const 0x0300)))))

  (func $di_enum_finish (param $frame i32)
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $frame) (global.get $DI_ENUM_FRAME_SIZE)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $di_enum_invoke (param $frame i32)
    (local $desc i32)
    (local.set $desc (i32.add (local.get $frame) (i32.const 40)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $frame) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (call $gl32 (i32.add (local.get $frame) (i32.const 12))))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $desc))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 8))))
    (global.set $steps (i32.const 0)))

  (func $di_enum_dispatch
    (local $frame i32) (local $kind i32) (local $filter i32) (local $index i32)
    (local $device_kind i32) (local $version i32) (local $flags i32) (local $obj_type i32)
    (local $desc i32) (local $match i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (local.set $kind (call $gl32 (i32.add (local.get $frame) (i32.const 16))))
    (local.set $filter (call $gl32 (i32.add (local.get $frame) (i32.const 20))))
    (local.set $version (call $gl32 (i32.add (local.get $frame) (i32.const 36))))
    (local.set $desc (i32.add (local.get $frame) (i32.const 40)))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (local.set $flags (call $gl32 (i32.add (local.get $frame) (i32.const 32))))
        (loop $devices
          (local.set $index (call $gl32 (i32.add (local.get $frame) (i32.const 24))))
          (if (i32.ge_u (local.get $index) (i32.const 2))
            (then (call $di_enum_finish (local.get $frame)) (return)))
          (call $gs32 (i32.add (local.get $frame) (i32.const 24))
            (i32.add (local.get $index) (i32.const 1)))
          (local.set $device_kind
            (select (i32.const 2) (i32.const 1) (i32.eqz (local.get $index))))
          (local.set $match (i32.eqz (local.get $filter)))
          (if (i32.ge_u (local.get $version) (i32.const 0x0800))
            (then
              (if (i32.eq (local.get $device_kind) (i32.const 2))
                (then (local.set $match (i32.or (local.get $match)
                  (i32.or (i32.eq (local.get $filter) (i32.const 2))
                          (i32.eq (local.get $filter) (i32.const 0x12))))))
                (else (local.set $match (i32.or (local.get $match)
                  (i32.or (i32.eq (local.get $filter) (i32.const 3))
                          (i32.eq (local.get $filter) (i32.const 0x13))))))))
            (else
              (local.set $match (i32.or (local.get $match)
                (i32.eq (local.get $filter)
                  (select (i32.const 2) (i32.const 3)
                    (i32.eq (local.get $device_kind) (i32.const 2))))))))
          ;; Neither system device supports force feedback.
          (if (i32.or (i32.eqz (local.get $match))
                      (i32.ne (i32.and (local.get $flags) (i32.const 0x100)) (i32.const 0)))
            (then (br $devices)))
          (call $di_fill_device_instance (local.get $desc) (local.get $device_kind)
            (local.get $version)
            (select (i32.const 560) (i32.const 580)
              (i32.le_u (local.get $version) (i32.const 0x0300))))
          (call $di_enum_invoke (local.get $frame))
          (return)))
      (else
        (local.set $device_kind (call $gl32 (i32.add (local.get $frame) (i32.const 28))))
        (loop $objects
          (local.set $index (call $gl32 (i32.add (local.get $frame) (i32.const 24))))
          (if (i32.eq (local.get $device_kind) (i32.const 2))
            (then
              (if (i32.ge_u (local.get $index) (i32.const 6))
                (then (call $di_enum_finish (local.get $frame)) (return)))
              (call $gs32 (i32.add (local.get $frame) (i32.const 24))
                (i32.add (local.get $index) (i32.const 1)))
              (local.set $obj_type
                (select (i32.const 1) (i32.const 4) (i32.lt_u (local.get $index) (i32.const 3)))))
            (else
              (loop $keys
                (if (i32.ge_u (local.get $index) (i32.const 256))
                  (then (call $di_enum_finish (local.get $frame)) (return)))
                (call $gs32 (i32.add (local.get $frame) (i32.const 24))
                  (i32.add (local.get $index) (i32.const 1)))
                (if (i32.eqz (call $di_dik_to_vk_strict (local.get $index)))
                  (then
                    (local.set $index (i32.add (local.get $index) (i32.const 1)))
                    (br $keys))))
              (local.set $obj_type (i32.const 4))))
          (if (i32.and (i32.ne (local.get $filter) (i32.const 0))
                       (i32.eqz (i32.and (local.get $filter) (local.get $obj_type))))
            (then (br $objects)))
          (call $di_fill_object_instance (local.get $desc) (local.get $device_kind)
            (local.get $index) (local.get $version))
          (call $di_enum_invoke (local.get $frame))
          (return)))))

  ;; Resume after a guest callback. DirectInput treats zero as DIENUM_STOP;
  ;; any nonzero value continues, as Win32 callback code commonly returns TRUE.
  (func $di_enum_continue
    (local $frame i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $di_enum_finish (local.get $frame)))
      (else (call $di_enum_dispatch))))

  ;; EnumDevices(this, dwDevType, callback, pvRef, dwFlags)
  (func $handle_IDirectInput_EnumDevices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32) (local $frame i32) (local $entry i32) (local $version i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $version (load.field.memarg DxObject misc0 (local.get $entry)))
    (if (i32.eqz (local.get $version)) (then (local.set $version (i32.const 0x0700))))
    (if (i32.or (i32.eqz (local.get $arg2))
          (i32.ne (i32.and (local.get $arg4) (i32.const 0xFEFAFEFE)) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return))) ;; DIERR_INVALIDPARAM
    (if (i32.lt_u (local.get $version) (i32.const 0x0800))
      (then
        (if (i32.gt_u (local.get $arg1) (i32.const 4))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return))))
      (else
        (if (i32.and (i32.gt_u (local.get $arg1) (i32.const 4))
                     (i32.or (i32.lt_u (local.get $arg1) (i32.const 0x11))
                             (i32.gt_u (local.get $arg1) (i32.const 0x1C))))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (global.get $DI_ENUM_FRAME_SIZE)))
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (call $gs32 (local.get $frame) (i32.const 0x4E454944)) ;; "DIEN"
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $ret))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $arg2))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $arg3))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (i32.const 1))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (local.get $arg1))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (i32.const 0))
    (call $gs32 (i32.add (local.get $frame) (i32.const 28)) (i32.const 0))
    (call $gs32 (i32.add (local.get $frame) (i32.const 32)) (local.get $arg4))
    (call $gs32 (i32.add (local.get $frame) (i32.const 36)) (local.get $version))
    (call $di_enum_dispatch))

  ;; GetDeviceStatus(rguidInstance). The browser-backed DirectInput root exposes
  ;; exactly the system keyboard and mouse enumerated above. Match the complete
  ;; GUID: Data1 alone is not a device identity.
  (func $handle_IDirectInput_GetDeviceStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $guid_wa i32)
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))) ;; DIERR_INVALIDPARAM
      (else
        (local.set $guid_wa (call $g2w (local.get $arg1)))
        (i32.store offset=0 (global.get $reg_base) (select
            (i32.const 0) ;; DI_OK
            (i32.const 1) ;; DI_NOTATTACHED
            (i32.or
              (call $guid_words_equal (local.get $guid_wa)
                (i32.const 0x6F1D2B60) (i32.const 0x11CFD5A0)
                (i32.const 0x4544C7BF) (i32.const 0x00005453))
              (call $guid_words_equal (local.get $guid_wa)
                (i32.const 0x6F1D2B61) (i32.const 0x11CFD5A0)
                (i32.const 0x4544C7BF) (i32.const 0x00005453)))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; RunControlPanel — no-op
  (func $handle_IDirectInput_RunControlPanel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectInput_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (store.field.memarg DxObject misc0 (call $dx_from_this (local.get $arg0)) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectInputDevice methods
  ;; ════════════════════════════════════════════════════════════

  (func $handle_IDirectInputDevice_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_wa i32) (local $kind i32) (local $entry i32)
    (local $version i32) (local $slot i32) (local $obj i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Translate riid exactly once and compare the complete device IID.
    (local.set $iid_wa (call $g2w (local.get $arg1)))
    (local.set $kind (call $dinput_device_iid_kind_wa (local.get $iid_wa)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $version (i32.load offset=16 (local.get $entry)))
    (if (i32.eqz (local.get $version))
      (then (local.set $version (i32.const 0x0700))))
    ;; Device1/2/7 have complete vtables here; Device8 (kind 5) does not, and
    ;; is still refused rather than answered with a shorter table. A face is
    ;; also only offered by a DirectInput of at least the version that defined
    ;; it, which is how a v3 caller is kept from acquiring a v7 pointer.
    (if (i32.or
          (i32.eqz (local.get $kind))
          (i32.or
            (i32.gt_u (local.get $kind) (i32.const 4))
            (i32.or
              (i32.and (i32.eq (local.get $kind) (i32.const 3))
                (i32.lt_u (local.get $version) (i32.const 0x0500)))
              (i32.and (i32.eq (local.get $kind) (i32.const 4))
                (i32.lt_u (local.get $version) (i32.const 0x0700))))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; E_NOINTERFACE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (local.set $obj
          (i32.add
            (i32.sub
              (i32.add (global.get $COM_WRAPPERS)
                (i32.mul (local.get $slot) (i32.const 8)))
              (global.get $GUEST_BASE))
            (global.get $image_base)))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DIDEV)))))
    (if (i32.eq (local.get $kind) (i32.const 3))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DIDEV2)))))
    (if (i32.eq (local.get $kind) (i32.const 4))
      (then (local.set $obj (call $dx_get_wrapper_for_vtbl
        (local.get $slot) (global.get $DX_VTBL_DIDEV7)))))
    (if (i32.eqz (local.get $obj))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; QI must AddRef even when returning the same object identity — MCM pairs
    ;; Release on the original while retaining the queried Device2 pointer.
    (store.field DxObject refcount (local.get $entry)
      (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (call $gs32 (local.get $arg2) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))



  ;; GetCapabilities — preserve the caller-selected DX3/full structure size
  ;; and report the pre-DX8 device type when used through a Win98-era face.
  (func $handle_IDirectInputDevice_GetCapabilities (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $entry i32) (local $size i32) (local $version i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $size (call $gl32 (local.get $arg1)))
    (if (i32.and (i32.ne (local.get $size) (i32.const 24))
                 (i32.ne (local.get $size) (i32.const 44)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $version (i32.load offset=16 (local.get $entry)))
    (if (i32.eqz (local.get $version)) (then (local.set $version (i32.const 0x0700))))
    (call $zero_memory (local.get $wa) (local.get $size))
    (i32.store (local.get $wa) (local.get $size))
    ;; DIDEVCAPS: flags4, type8, axes12, buttons16, POVs20. The browser
    ;; exposes attached system devices; Hype gates all polling on this flag.
    ;; https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee416607(v=vs.85)
    (if (i32.or
      (i32.eq (load.field DxObject misc0 (local.get $entry)) (i32.const 1))
      (i32.eq (load.field DxObject misc0 (local.get $entry)) (i32.const 2)))
      (then (i32.store offset=4 (local.get $wa) (i32.const 1)))) ;; DIDC_ATTACHED
    (if (i32.eq (load.field DxObject misc0 (local.get $entry)) (i32.const 1))
      (then
        (i32.store (i32.add (local.get $wa) (i32.const 8))
          (select (i32.const 0x0413) (i32.const 0x0403)
            (i32.ge_u (local.get $version) (i32.const 0x0800))))
        (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 256)))) ;; 256 keys
    (if (i32.eq (load.field DxObject misc0 (local.get $entry)) (i32.const 2))
      (then
        (i32.store (i32.add (local.get $wa) (i32.const 8))
          (select (i32.const 0x0212) (i32.const 0x0202)
            (i32.ge_u (local.get $version) (i32.const 0x0800))))
        (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 3)) ;; 3 axes
        (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 3)))) ;; 3 buttons
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; EnumObjects(this, callback, pvRef, dwFlags)
  (func $handle_IDirectInputDevice_EnumObjects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32) (local $frame i32) (local $entry i32) (local $version i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    ;; DIDFT_AXIS|BUTTON|POV|COLLECTION|NODATA are the documented filters.
    (if (i32.ne (i32.and (local.get $arg3) (i32.const 0xFFFFFF20)) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $version (i32.load offset=16 (local.get $entry)))
    (if (i32.eqz (local.get $version)) (then (local.set $version (i32.const 0x0700))))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (global.get $DI_ENUM_FRAME_SIZE)))
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (call $gs32 (local.get $frame) (i32.const 0x4E454944)) ;; "DIEN"
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $ret))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $arg1))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $arg2))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (i32.const 2))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (local.get $arg3))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (i32.const 0))
    (call $gs32 (i32.add (local.get $frame) (i32.const 28))
      (load.field.memarg DxObject misc0 (local.get $entry)))
    (call $gs32 (i32.add (local.get $frame) (i32.const 32)) (i32.const 0))
    (call $gs32 (i32.add (local.get $frame) (i32.const 36)) (local.get $version))
    (call $di_enum_dispatch))

  ;; GetProperty / SetProperty. DirectInput encodes predefined properties as
  ;; small REFGUID values. DIPROP_BUFFERSIZE is (REFGUID)1 and DIPROP_AXISMODE
  ;; is (REFGUID)2; both carry their value in DIPROPDWORD.dwData at +16 and
  ;; apply to the whole device. Keep queue capacity in misc1 and the uncommon
  ;; absolute-axis selection in an emulator-owned device flag (relative is the
  ;; default for our mouse path and therefore zero).
  (global $DIDEV_AXIS_ABSOLUTE i32 (i32.const 0x00000800))
  (func $di_valid_device_dword_property (param $header i32) (result i32)
    (if (result i32) (i32.eqz (local.get $header))
      (then (i32.const 0))
      (else
        (i32.and
          (i32.and
            (i32.eq (call $gl32 (local.get $header)) (i32.const 20))
            (i32.eq (call $gl32 (i32.add (local.get $header) (i32.const 4)))
                    (i32.const 16)))
          (i32.and
            (i32.eqz (call $gl32 (i32.add (local.get $header) (i32.const 8))))
            (i32.eqz (call $gl32 (i32.add (local.get $header) (i32.const 12)))))))))

  (func $handle_IDirectInputDevice_GetProperty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (if (i32.eqz (call $di_valid_device_dword_property (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.and
          (i32.ne (local.get $arg1) (i32.const 1)) ;; DIPROP_BUFFERSIZE
          (i32.ne (local.get $arg1) (i32.const 2))) ;; DIPROP_AXISMODE
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eq (local.get $arg1) (i32.const 1))
      (then
        (call $gs32 (i32.add (local.get $arg2) (i32.const 16))
          (i32.load offset=12 (local.get $entry))))
      (else
        (call $gs32 (i32.add (local.get $arg2) (i32.const 16))
          (i32.ne
            (i32.and (load.field DxObject flags (local.get $entry))
                     (global.get $DIDEV_AXIS_ABSOLUTE))
            (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectInputDevice_SetProperty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (if (i32.eqz (call $di_valid_device_dword_property (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.and
          (i32.ne (local.get $arg1) (i32.const 1)) ;; DIPROP_BUFFERSIZE
          (i32.ne (local.get $arg1) (i32.const 2))) ;; DIPROP_AXISMODE
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eq (local.get $arg1) (i32.const 1))
      (then
        (i32.store offset=12 (local.get $entry)
          (call $gl32 (i32.add (local.get $arg2) (i32.const 16)))))
      (else
        (if (i32.gt_u
              (call $gl32 (i32.add (local.get $arg2) (i32.const 16)))
              (i32.const 1))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))
        (store.field DxObject flags (local.get $entry)
          (i32.or
            (i32.and (load.field DxObject flags (local.get $entry))
                     (i32.const 0xFFFFF7FF))
            (i32.mul
              (call $gl32 (i32.add (local.get $arg2) (i32.const 16)))
              (global.get $DIDEV_AXIS_ABSOLUTE))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; DirectInput device lifecycle bits in the DIDev arm of DxObject.flags.
  ;; The low five bits retain DISCL_* from SetCooperativeLevel; these bits are
  ;; emulator-owned and never escape to the guest.
  (global $DIDEV_FORMAT_SET i32 (i32.const 0x00000100))
  (global $DIDEV_COOP_SET i32 (i32.const 0x00000200))
  (global $DIDEV_ACQUIRED i32 (i32.const 0x00000400))

  (func $di_device_is_acquired (param $entry i32) (result i32)
    (i32.ne
      (i32.and (load.field DxObject flags (local.get $entry))
               (global.get $DIDEV_ACQUIRED))
      (i32.const 0)))

  ;; Validate the standard formats that the browser implementation can return
  ;; faithfully. Applications pass their own copy of DIDATAFORMAT, so pointer
  ;; identity is meaningless: check its complete header and the object offsets
  ;; and kinds. Return dwDataSize on success, zero on failure.
  (func $di_standard_data_format_size
      (param $entry i32) (param $format_guest i32) (result i32)
    (local $format i32) (local $objects i32) (local $object i32)
    (local $kind i32) (local $data_size i32) (local $count i32)
    (local $i i32) (local $expected_offset i32) (local $expected_type i32)
    (if (i32.eqz (local.get $format_guest))
      (then (return (i32.const 0))))
    (local.set $format
      (call $g2w_affine_span (local.get $format_guest) (i32.const 24)))
    (if (i32.eq (local.get $format) (global.get $NULL_SENTINEL))
      (then (return (i32.const 0))))
    ;; DIDATAFORMAT: dwSize, dwObjSize, dwFlags, dwDataSize, dwNumObjs, rgodf.
    (if (i32.or
          (i32.ne (i32.load (local.get $format)) (i32.const 24))
          (i32.or
            (i32.ne (i32.load offset=4 (local.get $format)) (i32.const 16))
            (i32.ne (i32.load offset=8 (local.get $format)) (i32.const 2))))
      (then (return (i32.const 0)))) ;; DIDF_RELAXIS
    (local.set $data_size (i32.load offset=12 (local.get $format)))
    (local.set $count (i32.load offset=16 (local.get $format)))
    (local.set $kind (load.field DxObject misc0 (local.get $entry)))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (if (i32.or
              (i32.ne (local.get $data_size) (i32.const 256))
              (i32.ne (local.get $count) (i32.const 256)))
          (then (return (i32.const 0)))))
      (else
        (if (i32.ne (local.get $kind) (i32.const 2))
          (then (return (i32.const 0))))
        (if (i32.and
              (i32.or (i32.ne (local.get $data_size) (i32.const 16))
                      (i32.ne (local.get $count) (i32.const 7)))
              (i32.or (i32.ne (local.get $data_size) (i32.const 20))
                      (i32.ne (local.get $count) (i32.const 11))))
          (then (return (i32.const 0))))))
    (local.set $objects
      (call $g2w_affine_span
        (i32.load offset=20 (local.get $format))
        (i32.shl (local.get $count) (i32.const 4))))
    (if (i32.eq (local.get $objects) (global.get $NULL_SENTINEL))
      (then (return (i32.const 0))))
    (block $done (loop $objects_loop
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $object
        (i32.add (local.get $objects) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.eq (local.get $kind) (i32.const 1))
        (then
          (local.set $expected_offset (local.get $i))
          (local.set $expected_type (i32.const 0x0C))) ;; DIDFT_BUTTON
        (else
          (if (i32.lt_u (local.get $i) (i32.const 3))
            (then
              (local.set $expected_offset (i32.shl (local.get $i) (i32.const 2)))
              (local.set $expected_type (i32.const 0x03))) ;; DIDFT_AXIS
            (else
              (local.set $expected_offset (i32.add (local.get $i) (i32.const 9)))
              (local.set $expected_type (i32.const 0x0C))))))
      (if (i32.or
            (i32.ne (i32.load offset=4 (local.get $object))
                    (local.get $expected_offset))
            (i32.ne
              (i32.and (i32.load offset=8 (local.get $object)) (i32.const 0xFF))
              (local.get $expected_type)))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $objects_loop)))
    (local.get $data_size))

  ;; Application-defined DIDATAFORMATs. DirectInput matches each format object
  ;; to a device object by GUID and DIDFT type/instance and reports that
  ;; object at the format's dwOfs; device objects the format does not name are
  ;; not reported at all. LithTech (Blood 2) builds exactly such a format for
  ;; the keys a player has bound -- dwOfs = 4*i, each object named by the dwType
  ;; EnumObjects gave it -- after first setting one with no objects, and reads
  ;; dwOfs/4 back as an index into its own binding table.
  ;;
  ;; A device with a custom format keeps the guest address of its offset map
  ;; at +0 of its DX_SURF_STATE record ($dx_create_com_obj zeroes that record,
  ;; so 0 = one of the standard formats). The map is a guest-heap block of 256
  ;; i32 app offsets indexed by native object index ($di_object_exists
  ;; numbering: DIK code / mouse 0..5), -1 for an object the format omits.
  ;; $dx_free returns it; a heap block may sit in sparse guest memory, so it is
  ;; only ever read and written an entry at a time.
  (global $DI_FORMAT_MAP_BYTES i32 (i32.const 1024))

  ;; Guest address of this device's custom offset map, or 0 for a standard format.
  (func $di_format_map (param $entry i32) (result i32)
    (i32.load (call $dx_surf_state_ptr (local.get $entry))))

  ;; Install a fully built map, returning the one it replaces to the heap.
  (func $di_format_map_install (param $entry i32) (param $map i32)
    (call $di_format_map_drop (local.get $entry))
    (i32.store (call $dx_surf_state_ptr (local.get $entry)) (local.get $map)))

  ;; Back to a standard format (or the device is being freed).
  (func $di_format_map_drop (param $entry i32)
    (local $map i32)
    (local.set $map (call $di_format_map (local.get $entry)))
    (if (local.get $map)
      (then
        (call $heap_free (local.get $map))
        (i32.store (call $dx_surf_state_ptr (local.get $entry)) (i32.const 0)))))

  (func $di_format_map_get (param $map i32) (param $index i32) (result i32)
    (call $gl32 (i32.add (local.get $map) (i32.shl (local.get $index) (i32.const 2)))))

  (func $di_format_map_set (param $map i32) (param $index i32) (param $ofs i32)
    (call $gs32 (i32.add (local.get $map) (i32.shl (local.get $index) (i32.const 2)))
      (local.get $ofs)))

  ;; Data1 of the object's guidType (GUID_XAxis/YAxis/ZAxis, GUID_Button,
  ;; GUID_Key); the rest of each GUID is fixed, see $di_fill_object_guid.
  (func $di_object_guid_data1 (param $kind i32) (param $index i32) (result i32)
    (if (result i32) (i32.eq (local.get $kind) (i32.const 2))
      (then
        (if (result i32) (i32.lt_u (local.get $index) (i32.const 3))
          (then (i32.add (i32.const 0xA36D02E0) (local.get $index)))
          (else (i32.const 0xA36D02F0))))
      (else (i32.const 0x55728220))))

  (func $di_object_guid_matches (param $guid i32) (param $kind i32) (param $index i32) (result i32)
    (local $data1 i32)
    (local.set $data1 (call $di_object_guid_data1 (local.get $kind) (local.get $index)))
    (i32.and
      (i32.and
        (i32.eq (call $gl32 (local.get $guid)) (local.get $data1))
        (i32.eq (call $gl32 (i32.add (local.get $guid) (i32.const 4)))
          (i32.or (i32.const 0x11CF0000)
            (select (i32.const 0xD33C) (i32.const 0xC9F3)
              (i32.eq (local.get $data1) (i32.const 0x55728220))))))
      (i32.and
        (i32.eq (call $gl32 (i32.add (local.get $guid) (i32.const 8))) (i32.const 0x4544C7BF))
        (i32.eq (call $gl32 (i32.add (local.get $guid) (i32.const 12))) (i32.const 0x00005453)))))

  ;; Build $entry's map from a non-standard DIDATAFORMAT. Returns dwDataSize,
  ;; or -1 when DirectInput would refuse the format (a non-optional object
  ;; with no match, an offset outside the data, a misaligned axis).
  (func $di_custom_data_format (param $entry i32) (param $format_guest i32) (result i32)
    (local $format i32) (local $kind i32) (local $data_size i32) (local $count i32)
    (local $objects_guest i32) (local $object i32) (local $map i32)
    (local $i i32) (local $n i32) (local $limit i32) (local $want i32) (local $guid i32)
    (local $ofs i32) (local $type_bits i32) (local $inst i32) (local $found i32)
    (local $obj_type i32) (local $width i32)
    (if (i32.eqz (local.get $format_guest)) (then (return (i32.const -1))))
    (local.set $format (call $g2w_affine_span (local.get $format_guest) (i32.const 24)))
    (if (i32.eq (local.get $format) (global.get $NULL_SENTINEL))
      (then (return (i32.const -1))))
    (local.set $kind (load.field DxObject misc0 (local.get $entry)))
    (local.set $data_size (i32.load offset=12 (local.get $format)))
    (local.set $count (i32.load offset=16 (local.get $format)))
    (local.set $objects_guest (i32.load offset=20 (local.get $format)))
    ;; dwSize, dwObjSize, dwFlags (DIDF_ABSAXIS/DIDF_RELAXIS), dwDataSize.
    (if (i32.or
          (i32.or (i32.ne (i32.load (local.get $format)) (i32.const 24))
                  (i32.ne (i32.load offset=4 (local.get $format)) (i32.const 16)))
          (i32.or
            (i32.gt_u (i32.load offset=8 (local.get $format)) (i32.const 2))
            (i32.or (i32.ne (i32.and (local.get $data_size) (i32.const 3)) (i32.const 0))
                    (i32.gt_u (local.get $data_size) (i32.const 0x10000)))))
      (then (return (i32.const -1))))
    (if (i32.and (i32.ne (local.get $kind) (i32.const 1))
                 (i32.ne (local.get $kind) (i32.const 2)))
      (then (return (i32.const -1))))
    (if (i32.gt_u (local.get $count) (i32.const 256)) (then (return (i32.const -1))))
    (if (i32.and (i32.ne (local.get $count) (i32.const 0))
                 (i32.eqz (local.get $objects_guest)))
      (then (return (i32.const -1))))
    ;; Built in a fresh block and installed only once every object matched:
    ;; a refused SetDataFormat leaves the device's current format in force.
    (local.set $map (call $heap_alloc (global.get $DI_FORMAT_MAP_BYTES)))
    (if (i32.eqz (local.get $map)) (then (return (i32.const -1))))
    (block $cleared (loop $clear
      (br_if $cleared (i32.ge_u (local.get $n) (i32.const 256)))
      (call $di_format_map_set (local.get $map) (local.get $n) (i32.const -1))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $clear)))
    (local.set $limit (select (i32.const 6) (i32.const 256)
      (i32.eq (local.get $kind) (i32.const 2))))
    (block $done (loop $objects
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      ;; DIOBJECTDATAFORMAT: pguid, dwOfs, dwType, dwFlags.
      (local.set $object (i32.add (local.get $objects_guest) (i32.shl (local.get $i) (i32.const 4))))
      (local.set $guid (call $gl32 (local.get $object)))
      (local.set $ofs (call $gl32 (i32.add (local.get $object) (i32.const 4))))
      (local.set $want (call $gl32 (i32.add (local.get $object) (i32.const 8))))
      (local.set $type_bits (i32.and (local.get $want) (i32.const 0xFF)))
      (local.set $inst (i32.and (i32.shr_u (local.get $want) (i32.const 8)) (i32.const 0xFFFF)))
      (local.set $found (i32.const -1))
      (local.set $n (i32.const 0))
      (block $matched (loop $candidates
        (br_if $matched (i32.ge_u (local.get $n) (local.get $limit)))
        (local.set $obj_type (call $di_object_type (local.get $kind) (local.get $n)))
        (if (i32.and
              (i32.and
                (call $di_object_exists (local.get $kind) (local.get $n))
                ;; Each device object is assigned to at most one format object.
                (i32.eq (call $di_format_map_get (local.get $map) (local.get $n)) (i32.const -1)))
              (i32.and
                (i32.or (i32.eqz (local.get $type_bits))
                        (i32.ne (i32.and (local.get $obj_type) (local.get $type_bits)) (i32.const 0)))
                (i32.and
                  (i32.or (i32.eq (local.get $inst) (i32.const 0xFFFF))
                          (i32.eq (local.get $inst) (local.get $n)))
                  (i32.or (i32.eqz (local.get $guid))
                          (call $di_object_guid_matches (local.get $guid) (local.get $kind) (local.get $n))))))
          (then (local.set $found (local.get $n)) (br $matched)))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (br $candidates)))
      (if (i32.lt_s (local.get $found) (i32.const 0))
        (then
          ;; DIDFT_OPTIONAL objects may be absent from the device.
          (if (i32.eqz (i32.and (local.get $want) (i32.const 0x80000000)))
            (then (call $heap_free (local.get $map)) (return (i32.const -1)))))
        (else
          ;; An axis is a DWORD at a DWORD-aligned offset; a button is one byte.
          (local.set $width (select (i32.const 4) (i32.const 1)
            (i32.ne (i32.and (call $di_object_type (local.get $kind) (local.get $found)) (i32.const 3))
                    (i32.const 0))))
          (if (i32.or
                (i32.gt_u (i32.add (local.get $ofs) (local.get $width)) (local.get $data_size))
                (i32.and (i32.eq (local.get $width) (i32.const 4))
                         (i32.ne (i32.and (local.get $ofs) (i32.const 3)) (i32.const 0))))
            (then (call $heap_free (local.get $map)) (return (i32.const -1))))
          (call $di_format_map_set (local.get $map) (local.get $found) (local.get $ofs))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $objects)))
    (call $di_format_map_install (local.get $entry) (local.get $map))
    (local.get $data_size))

  ;; The offset at which this device reports native object $index, or -1 when
  ;; its data format leaves the object out. Standard formats report the
  ;; c_dfDIKeyboard / DIMOUSESTATE offsets.
  (func $di_format_offset (param $entry i32) (param $kind i32) (param $index i32) (result i32)
    (local $map i32)
    (local.set $map (call $di_format_map (local.get $entry)))
    (if (result i32) (local.get $map)
      (then (call $di_format_map_get (local.get $map) (local.get $index)))
      (else (call $di_object_offset (local.get $kind) (local.get $index)))))

  ;; Acquire is deliberately not reference-counted. A second call succeeds
  ;; with S_FALSE, and one Unacquire releases the device, matching DirectInput.
  (func $handle_IDirectInputDevice_Acquire (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $flags i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $flags (load.field DxObject flags (local.get $entry)))
    (if (i32.ne
          (i32.and (local.get $flags) (global.get $DIDEV_ACQUIRED))
          (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)) ;; S_FALSE: already acquired
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.ne
          (i32.and (local.get $flags)
            (i32.or (global.get $DIDEV_FORMAT_SET) (global.get $DIDEV_COOP_SET)))
          (i32.or (global.get $DIDEV_FORMAT_SET) (global.get $DIDEV_COOP_SET)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (store.field DxObject flags (local.get $entry)
      (i32.or (local.get $flags) (global.get $DIDEV_ACQUIRED)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DI_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirectInputDevice_Unacquire (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $flags i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $flags (load.field DxObject flags (local.get $entry)))
    (if (i32.eqz
          (i32.and (local.get $flags) (global.get $DIDEV_ACQUIRED)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)) ;; DI_NOEFFECT / S_FALSE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (store.field DxObject flags (local.get $entry)
      (i32.and (local.get $flags) (i32.const 0xFFFFFBFF)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DI_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; DIK scan code -> Win32 VK, one byte per scan code. 0 means the scan code
  ;; has no VK, which the buffered-keyboard scan uses to skip it. A table
  ;; rather than a comparison chain because GetDeviceData walks all 256 codes
  ;; on every poll, and an Allegro input thread polls continuously.
  (global $DI_DIK_VK_TABLE i32 (region.addr $DI_DIK_VK_TABLE 0))
  (global $DI_DIK_VK_TABLE_SIZE i32 (region.size $DI_DIK_VK_TABLE))
  (data (region.addr $DI_DIK_VK_TABLE 0)
    "\00\1b\31\32\33\34\35\36\37\38\39\30\bd\bb\08\09"  ;; DIK 00-0F
    "\51\57\45\52\54\59\55\49\4f\50\db\dd\0d\11\41\53"  ;; DIK 10-1F
    "\44\46\47\48\4a\4b\4c\ba\de\c0\10\dc\5a\58\43\56"  ;; DIK 20-2F
    "\42\4e\4d\bc\be\bf\10\6a\12\20\14\70\71\72\73\74"  ;; DIK 30-3F
    "\75\76\77\78\79\90\91\67\68\69\6d\64\65\66\6b\61"  ;; DIK 40-4F
    "\62\63\60\6e\00\00\00\7a\7b\00\00\00\00\00\00\00"  ;; DIK 50-5F
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"  ;; DIK 60-6F
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"  ;; DIK 70-7F
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"  ;; DIK 80-8F
    "\00\00\00\00\00\00\00\00\00\00\00\00\0d\11\00\00"  ;; DIK 90-9F
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"  ;; DIK A0-AF
    "\00\00\00\00\00\6f\00\00\12\00\00\00\00\00\00\00"  ;; DIK B0-BF
    "\00\00\00\00\00\00\00\24\26\21\00\25\00\27\00\23"  ;; DIK C0-CF
    "\28\22\2d\2e\00\00\00\00\00\00\00\00\00\00\00\00"  ;; DIK D0-DF
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"  ;; DIK E0-EF
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00") ;; DIK F0-FF

  ;; Strict lookup: 0 when this scan code has no VK. The buffered scan needs
  ;; that distinction, because $di_dik_to_vk below deliberately falls back to
  ;; the raw index for VK-shaped callers — a fallback that would otherwise make
  ;; DIK 0x28 (apostrophe) alias VK 0x28 (VK_DOWN) and report a phantom key.
  (func $di_dik_to_vk_strict (param $dik i32) (result i32)
    (if (i32.ge_u (local.get $dik) (global.get $DI_DIK_VK_TABLE_SIZE))
      (then (return (i32.const 0))))
    (i32.load8_u (i32.add (global.get $DI_DIK_VK_TABLE) (local.get $dik))))

  ;; The right-hand duplicates of keys that share one VK with their left-hand
  ;; twin. Reporting both would deliver every Shift press twice.
  (func $di_kbd_scan_skip (param $dik i32) (result i32)
    (i32.or
      (i32.or (i32.eq (local.get $dik) (i32.const 0x36))   ;; RSHIFT  -> VK_SHIFT
              (i32.eq (local.get $dik) (i32.const 0x9C)))  ;; NUMPADENTER -> VK_RETURN
      (i32.or (i32.eq (local.get $dik) (i32.const 0x9D))   ;; RCONTROL -> VK_CONTROL
              (i32.eq (local.get $dik) (i32.const 0xB8))))) ;; RMENU -> VK_MENU

  ;; Live host state for one scan code, as 0 or 1.
  (func $di_kbd_live (param $dik i32) (result i32)
    (local $vk i32)
    (local.set $vk (call $di_dik_to_vk_strict (local.get $dik)))
    (if (i32.eqz (local.get $vk)) (then (return (i32.const 0))))
    (i32.ne
      (i32.and (call $host_get_key_down_state (local.get $vk)) (i32.const 0x8000))
      (i32.const 0)))

  ;; Last state reported to the guest, as a 256-bit map across eight globals.
  (func $di_kbd_prev_word (param $idx i32) (result i32)
    (if (i32.eq (local.get $idx) (i32.const 0)) (then (return (global.get $di_kbd_prev0))))
    (if (i32.eq (local.get $idx) (i32.const 1)) (then (return (global.get $di_kbd_prev1))))
    (if (i32.eq (local.get $idx) (i32.const 2)) (then (return (global.get $di_kbd_prev2))))
    (if (i32.eq (local.get $idx) (i32.const 3)) (then (return (global.get $di_kbd_prev3))))
    (if (i32.eq (local.get $idx) (i32.const 4)) (then (return (global.get $di_kbd_prev4))))
    (if (i32.eq (local.get $idx) (i32.const 5)) (then (return (global.get $di_kbd_prev5))))
    (if (i32.eq (local.get $idx) (i32.const 6)) (then (return (global.get $di_kbd_prev6))))
    (global.get $di_kbd_prev7))

  (func $di_kbd_prev_store (param $idx i32) (param $word i32)
    (if (i32.eq (local.get $idx) (i32.const 0)) (then (global.set $di_kbd_prev0 (local.get $word)) (return)))
    (if (i32.eq (local.get $idx) (i32.const 1)) (then (global.set $di_kbd_prev1 (local.get $word)) (return)))
    (if (i32.eq (local.get $idx) (i32.const 2)) (then (global.set $di_kbd_prev2 (local.get $word)) (return)))
    (if (i32.eq (local.get $idx) (i32.const 3)) (then (global.set $di_kbd_prev3 (local.get $word)) (return)))
    (if (i32.eq (local.get $idx) (i32.const 4)) (then (global.set $di_kbd_prev4 (local.get $word)) (return)))
    (if (i32.eq (local.get $idx) (i32.const 5)) (then (global.set $di_kbd_prev5 (local.get $word)) (return)))
    (if (i32.eq (local.get $idx) (i32.const 6)) (then (global.set $di_kbd_prev6 (local.get $word)) (return)))
    (global.set $di_kbd_prev7 (local.get $word)))

  (func $di_kbd_prev_bit (param $dik i32) (result i32)
    (i32.and
      (i32.shr_u (call $di_kbd_prev_word (i32.shr_u (local.get $dik) (i32.const 5)))
                 (i32.and (local.get $dik) (i32.const 31)))
      (i32.const 1)))

  (func $di_kbd_prev_set (param $dik i32) (param $down i32)
    (local $idx i32) (local $mask i32) (local $word i32)
    (local.set $idx (i32.shr_u (local.get $dik) (i32.const 5)))
    (local.set $mask (i32.shl (i32.const 1) (i32.and (local.get $dik) (i32.const 31))))
    (local.set $word (call $di_kbd_prev_word (local.get $idx)))
    (call $di_kbd_prev_store (local.get $idx)
      (if (result i32) (local.get $down)
        (then (i32.or (local.get $word) (local.get $mask)))
        (else (i32.and (local.get $word) (i32.xor (local.get $mask) (i32.const -1)))))))

  ;; Fill up to $max buffered keyboard records at $rgdod (0 to count only) and
  ;; return how many edges were reported. When $commit is 0 the caller peeked,
  ;; so the reported state is left in place for the next read. Each record
  ;; carries the offset $entry's data format gives the key; a key the format
  ;; leaves out is not reported.
  (func $di_kbd_collect (param $entry i32) (param $rgdod i32) (param $cb i32) (param $max i32)
                        (param $commit i32) (result i32)
    (local $dik i32) (local $count i32) (local $live i32) (local $rec i32) (local $ofs i32)
    (local.set $dik (i32.const 0))
    (local.set $count (i32.const 0))
    ;; A DX5 DIDEVICEOBJECTDATA is 16 bytes. A caller that understates the
    ;; stride would otherwise stack every record on the first one.
    (if (i32.lt_u (local.get $cb) (i32.const 16))
      (then (local.set $cb (i32.const 16))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $dik) (i32.const 256)))
      (br_if $done (i32.ge_u (local.get $count) (local.get $max)))
      (local.set $ofs (call $di_format_offset (local.get $entry) (i32.const 1) (local.get $dik)))
      (if (i32.and
            (i32.and (i32.eqz (call $di_kbd_scan_skip (local.get $dik)))
                     (i32.ge_s (local.get $ofs) (i32.const 0)))
            (i32.ne (call $di_dik_to_vk_strict (local.get $dik)) (i32.const 0)))
        (then
          (local.set $live (call $di_kbd_live (local.get $dik)))
          (if (i32.ne (local.get $live) (call $di_kbd_prev_bit (local.get $dik)))
            (then
              (if (local.get $rgdod)
                (then
                  ;; DIDEVICEOBJECTDATA: dwOfs, dwData, dwTimeStamp, dwSequence.
                  (local.set $rec (i32.add (local.get $rgdod)
                    (i32.mul (local.get $count) (local.get $cb))))
                  (call $gs32 (local.get $rec) (local.get $ofs))
                  (call $gs32 (i32.add (local.get $rec) (i32.const 4))
                    (select (i32.const 0x80) (i32.const 0) (local.get $live)))
                  (call $gs32 (i32.add (local.get $rec) (i32.const 8)) (call $host_get_ticks))
                  (call $gs32 (i32.add (local.get $rec) (i32.const 12))
                    (global.get $di_kbd_data_sequence))))
              (if (local.get $commit)
                (then
                  (call $di_kbd_prev_set (local.get $dik) (local.get $live))
                  (global.set $di_kbd_data_sequence
                    (i32.add (global.get $di_kbd_data_sequence) (i32.const 1)))))
              (local.set $count (i32.add (local.get $count) (i32.const 1)))))))
      (local.set $dik (i32.add (local.get $dik) (i32.const 1)))
      (br $scan)))
    (local.get $count))

  ;; DirectInput keyboard state is indexed by DIK scan codes, while the host
  ;; renderer tracks browser/Win32 VK codes. Map the keys used by candidate
  ;; games, and fall back to the original index for VK-shaped callers.
  (func $di_dik_to_vk (param $dik i32) (result i32)
    (local $vk i32)
    (local.set $vk (call $di_dik_to_vk_strict (local.get $dik)))
    (if (local.get $vk) (then (return (local.get $vk))))
    (local.get $dik))

  ;; GetDeviceState under an application-defined format: each object the
  ;; format names, at its offset ($wa is the zeroed, dwDataSize-long buffer;
  ;; SetDataFormat already proved every offset fits). Wheel motion is never
  ;; produced by our hosts, so a mapped lZ stays 0.
  (func $di_custom_device_state (param $entry i32) (param $kind i32) (param $wa i32)
    (local $i i32) (local $ofs i32) (local $buttons i32)
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (block $done (loop $keys
          (br_if $done (i32.ge_u (local.get $i) (i32.const 256)))
          (local.set $ofs (call $di_format_offset (local.get $entry) (i32.const 1) (local.get $i)))
          (if (i32.and (i32.ge_s (local.get $ofs) (i32.const 0))
                       (call $di_kbd_live (local.get $i)))
            (then (i32.store8 (i32.add (local.get $wa) (local.get $ofs)) (i32.const 0x80))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $keys)))
        (return)))
    (local.set $ofs (call $di_format_offset (local.get $entry) (i32.const 2) (i32.const 0)))
    (if (i32.ge_s (local.get $ofs) (i32.const 0))
      (then (i32.store (i32.add (local.get $wa) (local.get $ofs)) (call $di_mouse_delta_take_x))))
    (local.set $ofs (call $di_format_offset (local.get $entry) (i32.const 2) (i32.const 1)))
    (if (i32.ge_s (local.get $ofs) (i32.const 0))
      (then (i32.store (i32.add (local.get $wa) (local.get $ofs)) (call $di_mouse_delta_take_y))))
    (local.set $buttons (call $host_get_mouse_buttons_live))
    (local.set $i (i32.const 0))
    (block $done (loop $mouse_buttons
      (br_if $done (i32.ge_u (local.get $i) (i32.const 2)))
      (local.set $ofs (call $di_format_offset (local.get $entry) (i32.const 2)
        (i32.add (local.get $i) (i32.const 3))))
      (if (i32.and (i32.ge_s (local.get $ofs) (i32.const 0))
                   (i32.ne (i32.and (local.get $buttons) (i32.shl (i32.const 1) (local.get $i)))
                           (i32.const 0)))
        (then (i32.store8 (i32.add (local.get $wa) (local.get $ofs)) (i32.const 0x80))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $mouse_buttons))))

  ;; GetDeviceState(this, cbData, lpvData)
  ;; For keyboard: fill 256-byte DirectInput DIK array with 0x80 for each pressed key
  ;; For mouse: fill DIMOUSESTATE (dx, dy, dz, rgbButtons[4]) = 16 bytes
  (func $handle_IDirectInputDevice_GetDeviceState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $dev_type i32) (local $wa i32) (local $i i32) (local $vk i32)
    (local $dx i32) (local $dy i32) (local $buttons i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (call $di_device_is_acquired (local.get $entry)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000C)) ;; DIERR_NOTACQUIRED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.or
          (i32.eqz (local.get $arg2))
          (i32.ne (local.get $arg1)
                  (load.field DxObject misc1 (local.get $entry))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $dev_type (load.field DxObject misc0 (local.get $entry)))
    (local.set $wa
      (call $g2w_affine_span (local.get $arg2) (local.get $arg1)))
    (if (i32.eq (local.get $wa) (global.get $NULL_SENTINEL))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $zero_memory (local.get $wa) (local.get $arg1))
    (if (call $di_format_map (local.get $entry))
      (then
        (call $di_custom_device_state (local.get $entry) (local.get $dev_type) (local.get $wa))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.eq (local.get $dev_type) (i32.const 1))
      (then
        ;; Keyboard — fill 256 bytes, key[dik] = 0x80 if pressed
        (local.set $i (i32.const 0))
        (block $kbd_done (loop $kbd_lp
          (br_if $kbd_done (i32.ge_u (local.get $i) (i32.const 256)))
          (local.set $vk (call $di_dik_to_vk (local.get $i)))
          (if (i32.and (call $host_get_key_down_state (local.get $vk)) (i32.const 0x8000))
            (then (i32.store8 (i32.add (local.get $wa) (local.get $i)) (i32.const 0x80))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $kbd_lp)))))
    (if (i32.eq (local.get $dev_type) (i32.const 2))
      (then
        ;; Mouse — DIMOUSESTATE: lX(4), lY(4), lZ(4), rgbButtons[4](4)
        (local.set $dx (call $di_mouse_delta_take_x))
        (local.set $dy (call $di_mouse_delta_take_y))
        (local.set $buttons (call $host_get_mouse_buttons_live))
        (if (i32.ge_u (local.get $arg1) (i32.const 4))
          (then (i32.store (local.get $wa) (local.get $dx))))
        (if (i32.ge_u (local.get $arg1) (i32.const 8))
          (then (i32.store offset=4 (local.get $wa) (local.get $dy))))
        (if (i32.ge_u (local.get $arg1) (i32.const 13))
          (then
            (if (i32.and (local.get $buttons) (i32.const 0x0001))
              (then (i32.store8 offset=12 (local.get $wa) (i32.const 0x80))))))
        (if (i32.ge_u (local.get $arg1) (i32.const 14))
          (then
            (if (i32.and (local.get $buttons) (i32.const 0x0002))
              (then (i32.store8 offset=13 (local.get $wa) (i32.const 0x80))))))
        ))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Native mouse object index ($di_object_exists numbering) for a
  ;; DIMOUSESTATE offset: lX/lY/lZ at 0/4/8, rgbButtons[i] at 12+i.
  (func $di_mouse_object_index (param $state_ofs i32) (result i32)
    (if (result i32) (i32.lt_u (local.get $state_ofs) (i32.const 12))
      (then (i32.shr_u (local.get $state_ofs) (i32.const 2)))
      (else (i32.sub (local.get $state_ofs) (i32.const 9)))))

  (func $di_mouse_data_write (param $base i32) (param $cb i32) (param $index i32)
                             (param $ofs i32) (param $data i32) (param $stamp i32)
    (local $rec i32)
    (local.set $rec (i32.add (local.get $base)
      (i32.mul (local.get $index) (local.get $cb))))
    ;; DIDEVICEOBJECTDATA (DX5): dwOfs, dwData, dwTimeStamp, dwSequence.
    (call $gs32 (local.get $rec) (local.get $ofs))
    (call $gs32 (i32.add (local.get $rec) (i32.const 4)) (local.get $data))
    (call $gs32 (i32.add (local.get $rec) (i32.const 8)) (local.get $stamp))
    (call $gs32 (i32.add (local.get $rec) (i32.const 12))
      (global.get $di_mouse_data_sequence)))

  ;; dwTimeStamp for one queued ring word. A button edge carries the GUEST
  ;; millisecond it was queued at in its low 28 bits (lib/renderer-input.js
  ;; stamps it with the host's own get_ticks clock), so the arithmetic below
  ;; is one clock throughout: now, less the low-28-bit distance back to the
  ;; stamp, which reconstructs the absolute tick the edge was queued at for
  ;; any age under 2^28 ms. It used to subtract host_real_time_ms instead,
  ;; mixing the wall clock into a guest-tick result -- under test/run.js's
  ;; batch-driven clock that made a fixed --input script produce a different
  ;; guest state on every run, according to how busy the box was, and it
  ;; misread edges queued across a browser pause. Everything drained in one
  ;; poll used
  ;; to carry the poll's own tick, and a game that measures a double-click by
  ;; the gap between two press records saw a gap of zero -- or, when the two
  ;; presses reached it a frame apart, a gap of one whole frame. Motion words
  ;; have no room for a stamp and keep the poll time, as does a bare button
  ;; code (the shape the tests push directly).
  (func $di_mouse_event_stamp (param $event i32) (param $event_type i32) (result i32)
    (local $now i32)
    (local.set $now (call $host_get_ticks))
    (if (i32.and (i32.gt_u (local.get $event) (i32.const 4))
                 (i32.le_u (local.get $event_type) (i32.const 4)))
      (then
        (return (i32.sub (local.get $now)
          (i32.and (i32.sub (local.get $now) (local.get $event))
                   (i32.const 0x0FFFFFFF))))))
    (local.get $now))

  (func $di_mouse_button_commit_state (param $event i32)
    (if (i32.eq (local.get $event) (i32.const 1))
      (then
        (global.set $di_mouse_data_last_buttons
          (i32.or (global.get $di_mouse_data_last_buttons) (i32.const 1)))
        (return)))
    (if (i32.eq (local.get $event) (i32.const 2))
      (then
        (global.set $di_mouse_data_last_buttons
          (i32.and (global.get $di_mouse_data_last_buttons) (i32.const -2)))
        (return)))
    (if (i32.eq (local.get $event) (i32.const 3))
      (then
        (global.set $di_mouse_data_last_buttons
          (i32.or (global.get $di_mouse_data_last_buttons) (i32.const 2)))
        (return)))
    (if (i32.eq (local.get $event) (i32.const 4))
      (then
        (global.set $di_mouse_data_last_buttons
          (i32.and (global.get $di_mouse_data_last_buttons) (i32.const -3))))))

  ;; GetDeviceData(this, cbObjectData, rgdod, pdwInOut, dwFlags)
  ;; Buffered mouse and keyboard. MCM peeks with rgdod=NULL/DIGDD_PEEK, then
  ;; reads one DIDEVICEOBJECTDATA record. Physical motion and button edges
  ;; share one FIFO, preserving the position-before-click ordering. The dx/dy
  ;; accumulators above independently serve GetDeviceState callers.
  (func $handle_IDirectInputDevice_GetDeviceData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $dev_type i32)
    (local $buttons i32) (local $diff i32) (local $ofs i32)
    (local $data i32) (local $requested i32) (local $available i32) (local $capacity i32)
    (local $delivered i32) (local $commit i32)
    (local $queued i32) (local $button_index i32) (local $event i32) (local $event_type i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (call $di_device_is_acquired (local.get $entry)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000C)) ;; DIERR_NOTACQUIRED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.or
          (i32.eqz (local.get $arg3))
          (i32.lt_u (local.get $arg1) (i32.const 16)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $dev_type (load.field DxObject misc0 (local.get $entry)))
    (local.set $capacity (i32.load offset=12 (local.get $entry)))
    (if (i32.eq (local.get $dev_type) (i32.const 1))
      (then
        ;; Keyboard. Allegro-based games read keys only through this buffer,
        ;; never through GetDeviceState, so an empty buffer freezes them.
        (local.set $requested
          (if (result i32) (local.get $arg3)
            (then (call $gl32 (local.get $arg3)))
            (else (i32.const 0))))
        (if (i32.and (i32.ne (local.get $capacity) (i32.const 0))
                     (i32.gt_u (local.get $requested) (local.get $capacity)))
          (then (local.set $requested (local.get $capacity))))
        (if (i32.eqz (local.get $arg2))
          (then
            ;; rgdod == NULL asks only how many records are pending. A count
            ;; query must not consume them, whatever DIGDD_PEEK says.
            (if (local.get $arg3)
              (then (call $gs32 (local.get $arg3)
                (call $di_kbd_collect (local.get $entry) (i32.const 0) (local.get $arg1)
                  (local.get $requested) (i32.const 0)))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (local.set $data (call $di_kbd_collect (local.get $entry) (local.get $arg2)
          (local.get $arg1) (local.get $requested)
          (i32.eqz (i32.and (local.get $arg4) (i32.const 1)))))
        (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $data))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.eq (local.get $dev_type) (i32.const 2))
      (then
        (local.set $buttons (call $host_get_mouse_buttons_live))
        (if (i32.eqz (global.get $di_mouse_data_initialized))
          (then
            (global.set $di_mouse_data_initialized (i32.const 1))
            (global.set $di_mouse_data_last_buttons (local.get $buttons))))
        (local.set $queued (call $di_mouse_event_count))
        (local.set $diff (i32.xor (local.get $buttons) (global.get $di_mouse_data_last_buttons)))
        (local.set $available
          (i32.add
            (local.get $queued)
            (if (result i32) (i32.eqz (local.get $queued))
              (then
                (i32.add (i32.ne (i32.and (local.get $diff) (i32.const 1)) (i32.const 0))
                         (i32.ne (i32.and (local.get $diff) (i32.const 2)) (i32.const 0))))
              (else (i32.const 0)))))
        (local.set $requested
          (if (result i32) (local.get $arg3)
            (then (call $gl32 (local.get $arg3)))
            (else (i32.const 0))))
        ;; A count-only DIGDD_PEEK is still bounded by the capacity selected
        ;; through DIPROP_BUFFERSIZE. MCM trusts that count when sizing the
        ;; following read; exposing the entire browser FIFO overwrites its
        ;; fixed 16-record stack buffer with DIDEVICEOBJECTDATA entries.
        (if (i32.and (i32.ne (local.get $capacity) (i32.const 0))
                     (i32.gt_u (local.get $requested) (local.get $capacity)))
          (then (local.set $requested (local.get $capacity))))
        (if (i32.eqz (local.get $arg2))
          (then
            (if (local.get $arg3)
              (then (call $gs32 (local.get $arg3)
                (select (local.get $available) (local.get $requested)
                  (i32.lt_u (local.get $available) (local.get $requested))))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (local.set $commit (i32.eqz (i32.and (local.get $arg4) (i32.const 1))))
        (local.set $delivered (i32.const 0))

        ;; Each packed FIFO word is either button code 1..4 or a signed 28-bit
        ;; motion delta with type 5 (X) / 6 (Y) in its high nibble.
        (local.set $button_index (i32.const 0))
        (block $buttons_done (loop $buttons_loop
          (br_if $buttons_done (i32.ge_u (local.get $button_index) (local.get $queued)))
          (br_if $buttons_done (i32.ge_u (local.get $delivered) (local.get $requested)))
          (local.set $event
            (if (result i32) (local.get $commit)
              (then (call $di_mouse_event_take))
              (else (call $di_mouse_event_peek (local.get $button_index)))))
          (br_if $buttons_done (i32.eqz (local.get $event)))
          (local.set $event_type
            (if (result i32) (i32.le_u (local.get $event) (i32.const 4))
              (then (local.get $event))
              (else (i32.shr_u (local.get $event) (i32.const 28)))))
          (local.set $ofs
            (if (result i32) (i32.eq (local.get $event_type) (i32.const 5))
              (then (i32.const 0))
              (else
                (if (result i32) (i32.eq (local.get $event_type) (i32.const 6))
                  (then (i32.const 4))
                  (else
                    (select (i32.const 12) (i32.const 13)
                      (i32.le_u (local.get $event_type) (i32.const 2))))))))
          (local.set $data
            (if (result i32) (i32.ge_u (local.get $event_type) (i32.const 5))
              (then
                (i32.shr_s (i32.shl (local.get $event) (i32.const 4)) (i32.const 4)))
              (else
                (select (i32.const 0x80) (i32.const 0)
                  (i32.ne (i32.and (local.get $event_type) (i32.const 1)) (i32.const 0))))))
          ;; $ofs is the DIMOUSESTATE offset; the device's format decides where
          ;; (and whether) the object is reported.
          (local.set $ofs (call $di_format_offset (local.get $entry) (i32.const 2)
            (call $di_mouse_object_index (local.get $ofs))))
          (if (i32.ge_s (local.get $ofs) (i32.const 0))
            (then
              (call $di_mouse_data_write (local.get $arg2) (local.get $arg1)
                (local.get $delivered) (local.get $ofs) (local.get $data)
                (call $di_mouse_event_stamp (local.get $event) (local.get $event_type)))))
          (if (local.get $commit)
            (then
              (if (i32.le_u (local.get $event_type) (i32.const 4))
                (then (call $di_mouse_button_commit_state (local.get $event_type))))
              (global.set $di_mouse_data_sequence
                (i32.add (global.get $di_mouse_data_sequence) (i32.const 1)))))
          (if (i32.ge_s (local.get $ofs) (i32.const 0))
            (then (local.set $delivered (i32.add (local.get $delivered) (i32.const 1)))))
          (local.set $button_index (i32.add (local.get $button_index) (i32.const 1)))
          (br $buttons_loop)))

        ;; Hosts without the shared browser queue still get live-state edges.
        (if (i32.and
              (i32.and (i32.eqz (local.get $queued))
                       (i32.lt_u (local.get $delivered) (local.get $requested)))
                     (i32.ne (i32.and (local.get $diff) (i32.const 1)) (i32.const 0)))
          (then
            (local.set $data (select (i32.const 0x80) (i32.const 0)
              (i32.ne (i32.and (local.get $buttons) (i32.const 1)) (i32.const 0))))
            (local.set $ofs (call $di_format_offset (local.get $entry) (i32.const 2) (i32.const 3)))
            (if (i32.ge_s (local.get $ofs) (i32.const 0))
              (then
                (call $di_mouse_data_write (local.get $arg2) (local.get $arg1)
                  (local.get $delivered) (local.get $ofs) (local.get $data) (call $host_get_ticks))
                (local.set $delivered (i32.add (local.get $delivered) (i32.const 1)))))
            (if (local.get $commit)
              (then
                (global.set $di_mouse_data_sequence
                  (i32.add (global.get $di_mouse_data_sequence) (i32.const 1)))
                (global.set $di_mouse_data_last_buttons
                  (i32.or (i32.and (global.get $di_mouse_data_last_buttons) (i32.const -2))
                          (i32.and (local.get $buttons) (i32.const 1))))))))
        (if (i32.and
              (i32.and (i32.eqz (local.get $queued))
                       (i32.lt_u (local.get $delivered) (local.get $requested)))
                     (i32.ne (i32.and (local.get $diff) (i32.const 2)) (i32.const 0)))
          (then
            (local.set $data (select (i32.const 0x80) (i32.const 0)
              (i32.ne (i32.and (local.get $buttons) (i32.const 2)) (i32.const 0))))
            (local.set $ofs (call $di_format_offset (local.get $entry) (i32.const 2) (i32.const 4)))
            (if (i32.ge_s (local.get $ofs) (i32.const 0))
              (then
                (call $di_mouse_data_write (local.get $arg2) (local.get $arg1)
                  (local.get $delivered) (local.get $ofs) (local.get $data) (call $host_get_ticks))
                (local.set $delivered (i32.add (local.get $delivered) (i32.const 1)))))
            (if (local.get $commit)
              (then
                (global.set $di_mouse_data_sequence
                  (i32.add (global.get $di_mouse_data_sequence) (i32.const 1)))
                (global.set $di_mouse_data_last_buttons
                  (i32.or (i32.and (global.get $di_mouse_data_last_buttons) (i32.const -3))
                          (i32.and (local.get $buttons) (i32.const 2))))))))
        (if (local.get $arg3)
          (then (call $gs32 (local.get $arg3) (local.get $delivered))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; SetDataFormat accepts the standard keyboard, DIMOUSESTATE and
  ;; DIMOUSESTATE2 layouts, and any application-defined format whose objects
  ;; the device has ($di_custom_data_format). The format may be replaced while
  ;; unacquired, but DirectInput rejects changes while acquired.
  (func $handle_IDirectInputDevice_SetDataFormat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $data_size i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (call $di_device_is_acquired (local.get $entry))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x800700AA)) ;; DIERR_ACQUIRED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $data_size
      (call $di_standard_data_format_size (local.get $entry) (local.get $arg1)))
    (if (local.get $data_size)
      (then (call $di_format_map_drop (local.get $entry)))
      (else
        (local.set $data_size
          (call $di_custom_data_format (local.get $entry) (local.get $arg1)))))
    (if (i32.lt_s (local.get $data_size) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (store.field DxObject misc1 (local.get $entry) (local.get $data_size))
    (store.field DxObject flags (local.get $entry)
      (i32.or (load.field DxObject flags (local.get $entry))
              (global.get $DIDEV_FORMAT_SET)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetEventNotification(this, hEvent) — remember the host event so renderer
  ;; input can wake DirectInput polling loops.
  (func $handle_IDirectInputDevice_SetEventNotification (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $dev_type i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $dev_type (load.field DxObject misc0 (local.get $entry)))
    (drop (call $host_di_set_event_notification (local.get $dev_type) (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetCooperativeLevel requires a process-owned top-level HWND and exactly
  ;; one foreground/background plus one exclusive/nonexclusive choice. The one
  ;; exception is hwnd NULL with exactly DISCL_NONEXCLUSIVE|DISCL_BACKGROUND,
  ;; which DirectInput binds to the desktop window (Wine does the same).
  ;; Populous: The Beginning's input threads pass exactly that; refusing it
  ;; left the mouse unacquired, so GetDeviceData said NOTACQUIRED forever.
  (func $handle_IDirectInputDevice_SetCooperativeLevel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $flags i32)
    (if (i32.and (i32.eqz (local.get $arg1)) (i32.eq (local.get $arg2) (i32.const 0x0A)))
      (then (local.set $arg1 (i32.const 0x10000)))) ;; GetDesktopWindow's HWND
    (if (i32.or
          (i32.eqz (call $window_handle_valid (local.get $arg1)))
          (i32.ne (call $wnd_top_level (local.get $arg1)) (local.get $arg1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070006)) ;; E_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.or
          (i32.ne (i32.and (local.get $arg2) (i32.const 0xFFFFFFE0)) (i32.const 0))
          (i32.or
            (i32.eq
              (i32.ne (i32.and (local.get $arg2) (i32.const 1)) (i32.const 0))
              (i32.ne (i32.and (local.get $arg2) (i32.const 2)) (i32.const 0)))
            (i32.eq
              (i32.ne (i32.and (local.get $arg2) (i32.const 4)) (i32.const 0))
              (i32.ne (i32.and (local.get $arg2) (i32.const 8)) (i32.const 0)))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $flags (load.field DxObject flags (local.get $entry)))
    (store.field DxObject misc2 (local.get $entry) (local.get $arg1))
    (store.field DxObject flags (local.get $entry)
      (i32.or
        (i32.and (local.get $flags) (i32.const 0xFFFFFFE0))
        (i32.or (local.get $arg2) (global.get $DIDEV_COOP_SET))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetObjectInfo(this, pdidoi, dwObj, dwHow). The system keyboard and mouse
  ;; use their standard data formats, so offsets are DIK_* values or DIMOFS_*.
  ;; They are legacy non-HID devices and consequently have no BYUSAGE match.
  (func $handle_IDirectInputDevice_GetObjectInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $kind i32) (local $size i32)
    (local $index i32) (local $match i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $size (call $gl32 (local.get $arg1)))
    (if (i32.or
          (i32.and (i32.ne (local.get $size) (i32.const 292))
                   (i32.ne (local.get $size) (i32.const 316)))
          (i32.or (i32.lt_u (local.get $arg3) (i32.const 1))
                  (i32.gt_u (local.get $arg3) (i32.const 3))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DIERR_INVALIDPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $kind (load.field.memarg DxObject misc0 (local.get $entry)))
    (block $not_found
      (loop $objects
        (if (i32.ge_u (local.get $index) (i32.const 256))
          (then (br $not_found)))
        (if (call $di_object_exists (local.get $kind) (local.get $index))
          (then
            (if (i32.eq (local.get $arg3) (i32.const 1)) ;; DIPH_BYOFFSET
              (then
                (local.set $match
                  (i32.eq (local.get $arg2)
                    (call $di_object_offset (local.get $kind) (local.get $index))))))
            (if (i32.eq (local.get $arg3) (i32.const 2)) ;; DIPH_BYID
              (then
                (local.set $match
                  (i32.eq (local.get $arg2)
                    (call $di_object_type (local.get $kind) (local.get $index))))))
            (if (local.get $match)
              (then
                (call $di_fill_object_instance_size
                  (local.get $arg1) (local.get $kind) (local.get $index) (local.get $size))
                (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DI_OK
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
                (return)))))
        (local.set $index (i32.add (local.get $index) (i32.const 1)))
        (br $objects)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070002)) ;; DIERR_OBJECTNOTFOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; GetDeviceInfo(this, DIDEVICEINSTANCEA*) accepts the full structure and
  ;; the explicit DirectX 3 compatibility shape selected by the caller.
  (func $handle_IDirectInputDevice_GetDeviceInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $size i32) (local $version i32) (local $kind i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $size (call $gl32 (local.get $arg1)))
    (if (i32.and (i32.ne (local.get $size) (i32.const 560))
                 (i32.ne (local.get $size) (i32.const 580)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $kind (load.field.memarg DxObject misc0 (local.get $entry)))
    (local.set $version (i32.load offset=16 (local.get $entry)))
    (if (i32.eqz (local.get $version)) (then (local.set $version (i32.const 0x0700))))
    (call $di_fill_device_instance (local.get $arg1) (local.get $kind)
      (local.get $version) (local.get $size))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; RunControlPanel — no-op
  (func $handle_IDirectInputDevice_RunControlPanel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Initialize — no-op
  (func $handle_IDirectInputDevice_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; ── IDirectInputDevice2 (slots 18..26) ────────────────────────────────
  ;; The devices we expose are the system keyboard and mouse: neither has
  ;; force feedback and neither needs polling. Real DirectInput answers a
  ;; force-feedback method on such a device with DIERR_UNSUPPORTED and Poll
  ;; with DI_OK, which is exactly what these return — so an app that probes
  ;; for effects correctly concludes there are none instead of hitting an
  ;; unrelated interface's thunk. MechWarrior 3 calls Poll (slot 25) on every
  ;; input tick after QI'ing to IID_IDirectInputDevice2A.

  ;; CreateEffect(this, rguid, lpeff, ppdeff, punkOuter)
  (func $handle_IDirectInputDevice2_CreateEffect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; EnumEffects(this, lpCallback, pvRef, dwEffType) — no effects to report,
  ;; so the callback never fires and the enumeration succeeds empty.
  (func $handle_IDirectInputDevice2_EnumEffects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; GetEffectInfo(this, pdei, rguid)
  (func $handle_IDirectInputDevice2_GetEffectInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetForceFeedbackState(this, pdwOut)
  (func $handle_IDirectInputDevice2_GetForceFeedbackState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SendForceFeedbackCommand(this, dwFlags)
  (func $handle_IDirectInputDevice2_SendForceFeedbackCommand (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; EnumCreatedEffectObjects(this, lpCallback, pvRef, fl) — we never create
  ;; an effect, so this enumeration is always empty and succeeds.
  (func $handle_IDirectInputDevice2_EnumCreatedEffectObjects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Escape(this, pesc) — driver-specific escape; no driver here.
  (func $handle_IDirectInputDevice2_Escape (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Poll(this) — keyboard and mouse do not require polling, but DirectInput
  ;; still requires acquisition before answering DI_NOEFFECT.
  (func $handle_IDirectInputDevice2_Poll (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 1) (i32.const 0x8007000C)
        (call $di_device_is_acquired (local.get $entry)))) ;; DI_NOEFFECT / DIERR_NOTACQUIRED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; SendDeviceData(this, cbObjectData, rgdod, pdwInOut, fl) — output devices
  ;; only; nothing here accepts device data.
  (func $handle_IDirectInputDevice2_SendDeviceData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; ── IDirectInputDevice7 (slots 27..28) ────────────────────────────────
  ;; The two methods v7 adds over v2 both move force-feedback effects between
  ;; a device and a .FFE file. The devices we expose are the system keyboard
  ;; and mouse, neither of which has effects to read or write, so both answer
  ;; DIERR_UNSUPPORTED exactly as the v2 effect methods above do. That is the
  ;; same answer real DirectInput gives for a device with no force feedback,
  ;; and it is what makes the v7 vtable honest rather than merely long enough.

  ;; EnumEffectsInFile(this, lpszFileName, pec, pvRef, dwFlags)
  (func $handle_IDirectInputDevice7_EnumEffectsInFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; WriteEffectToFile(this, lpszFileName, dwEntries, rgDiFileEft, dwFlags)
  (func $handle_IDirectInputDevice7_WriteEffectToFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; DIERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; IDirectPlay3A — bounded local/no-network COM object. Player/group state
  ;; is real state: IDs are unique, DPNAMEs are copied, membership survives
  ;; until removal, and enumeration calls back for every matching live entity.
  ;;
  ;; Entity entry (guest heap, 32 entries x 44 bytes):
  ;;   +0 id, +4 type (0 group, 1 player), +8 copied DPNAME,
  ;;   +12 create flags, +16 group-membership bitset, +20 live,
  ;;   +24 remote/shared data pointer, +28 remote size,
  ;;   +32 local-only data pointer, +36 local size,
  ;;   +40 explicitly assigned owner player ID (-1 if not assigned),
  ;;   +44 creator COM object, +48 borrowed receive event,
  ;;   +52 room address of the machine a remote player lives on (0 = here;
  ;;       see 09d4-dplay-net.wat).
  (global $DP_ENTITY_MAX i32 (i32.const 32))
  (global $DP_ENTITY_STRIDE i32 (i32.const 56))
  (global $dp_entity_table (mut i32) (i32.const 0))
  (global $dp_entity_next_id (mut i32) (i32.const 0x100))

  ;; Internal DP4 queue storage; transport and public flag/error contracts are
  ;; separate. Slots contain id/owner/from/to/payload/size/priority/kind.
  ;; kind 0 is pending send, kind 1 is received. IDs never recycle.
  (global $DP_MESSAGE_MAX i32 (i32.const 64))
  (global $DP_MESSAGE_STRIDE i32 (i32.const 32))
  (global $dp_message_table (mut i32) (i32.const 0))
  (global $dp_message_next_id (mut i32) (i32.const 1))
  (global $dp_message_bytes (mut i32) (i32.const 0))

  (func $dp_message_enqueue (param $owner i32) (param $from i32) (param $to i32)
      (param $data i32) (param $size i32) (param $priority i32) (param $kind i32) (result i32)
    (local $i i32) (local $entry i32) (local $payload i32) (local $id i32)
    (if (i32.eqz (local.get $owner)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $kind) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $dp_message_next_id)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $size) (i32.const 1048576)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $size)
          (i32.sub (i32.const 4194304) (global.get $dp_message_bytes)))
      (then (return (i32.const 0))))
    (if (local.get $size)
      (then (if (i32.eqz (local.get $data)) (then (return (i32.const 0))))))
    (if (i32.eqz (global.get $dp_message_table))
      (then
        (global.set $dp_message_table (call $heap_alloc
          (i32.mul (global.get $DP_MESSAGE_MAX) (global.get $DP_MESSAGE_STRIDE))))
        (if (i32.eqz (global.get $dp_message_table)) (then (return (i32.const 0))))
        (call $zero_memory (call $g2w (global.get $dp_message_table))
          (i32.mul (global.get $DP_MESSAGE_MAX) (global.get $DP_MESSAGE_STRIDE)))))
    (block $full (loop $scan
      (br_if $full (i32.ge_u (local.get $i) (global.get $DP_MESSAGE_MAX)))
      (local.set $entry (i32.add (global.get $dp_message_table)
        (i32.mul (local.get $i) (global.get $DP_MESSAGE_STRIDE))))
      (if (i32.eqz (call $gl32 (local.get $entry)))
        (then
          (if (local.get $size)
            (then
              (local.set $payload (call $heap_alloc (local.get $size)))
              (if (i32.eqz (local.get $payload)) (then (return (i32.const 0))))
              (call $guest_memmove (local.get $payload) (local.get $data)
                (local.get $size))))
          (local.set $id (global.get $dp_message_next_id))
          (global.set $dp_message_next_id (i32.add (local.get $id) (i32.const 1)))
          (call $gs32 (local.get $entry) (local.get $id))
          (call $gs32 (i32.add (local.get $entry) (i32.const 4)) (local.get $owner))
          (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $from))
          (call $gs32 (i32.add (local.get $entry) (i32.const 12)) (local.get $to))
          (call $gs32 (i32.add (local.get $entry) (i32.const 16)) (local.get $payload))
          (call $gs32 (i32.add (local.get $entry) (i32.const 20)) (local.get $size))
          (call $gs32 (i32.add (local.get $entry) (i32.const 24)) (local.get $priority))
          (call $gs32 (i32.add (local.get $entry) (i32.const 28)) (local.get $kind))
          (global.set $dp_message_bytes (i32.add (global.get $dp_message_bytes) (local.get $size)))
          (return (local.get $id))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $dp_message_find (param $owner i32) (param $id i32) (result i32)
    (local $i i32) (local $entry i32)
    (if (i32.eqz (global.get $dp_message_table)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $id)) (then (return (i32.const 0))))
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $i) (global.get $DP_MESSAGE_MAX)))
      (local.set $entry (i32.add (global.get $dp_message_table)
        (i32.mul (local.get $i) (global.get $DP_MESSAGE_STRIDE))))
      (if (i32.and (i32.eq (call $gl32 (local.get $entry)) (local.get $id))
            (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (local.get $owner)))
        (then (return (local.get $entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $dp_message_remove (param $owner i32) (param $id i32) (result i32)
    (local $entry i32) (local $payload i32)
    (local.set $entry (call $dp_message_find (local.get $owner) (local.get $id)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (local.set $payload (call $gl32 (i32.add (local.get $entry) (i32.const 16))))
    (if (local.get $payload) (then (call $heap_free (local.get $payload))))
    (global.set $dp_message_bytes (i32.sub (global.get $dp_message_bytes)
      (call $gl32 (i32.add (local.get $entry) (i32.const 20)))))
    (call $zero_memory (call $g2w (local.get $entry)) (global.get $DP_MESSAGE_STRIDE))
    (i32.const 1))

  ;; Query mode: 0 message count, 1 bytes, 2 oldest matching entry. Sender and
  ;; recipient zero are wildcards. Slot order is not FIFO after a cancellation.
  (func $dp_message_query (param $owner i32) (param $kind i32)
      (param $from i32) (param $to i32) (param $mode i32) (result i32)
    (call $dp_message_query_filtered (local.get $owner) (local.get $kind)
      (local.get $from) (local.get $to) (local.get $mode)
      (i32.or
        (i32.shl (i32.ne (local.get $from) (i32.const 0)) (i32.const 2))
        (i32.shl (i32.ne (local.get $to) (i32.const 0)) (i32.const 1)))))

  ;; Receive has explicit filter bits: FROMPLAYER must match even sender zero
  ;; (DPID_SYSMSG), unlike GetMessageQueue's zero-as-wildcard parameters.
  (func $dp_message_query_filtered (param $owner i32) (param $kind i32)
      (param $from i32) (param $to i32) (param $mode i32) (param $filters i32) (result i32)
    (local $i i32) (local $entry i32) (local $id i32) (local $result i32)
    (local $oldest i32)
    (if (i32.eqz (global.get $dp_message_table)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $mode) (i32.const 2)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_MESSAGE_MAX)))
      (local.set $entry (i32.add (global.get $dp_message_table)
        (i32.mul (local.get $i) (global.get $DP_MESSAGE_STRIDE))))
      (local.set $id (call $gl32 (local.get $entry)))
      (if (i32.and (i32.ne (local.get $id) (i32.const 0))
            (i32.and
              (i32.and (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (local.get $owner))
                (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 28))) (local.get $kind)))
              (i32.and
                (i32.or (i32.eqz (i32.and (local.get $filters) (i32.const 4)))
                  (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 8))) (local.get $from)))
                (i32.or (i32.eqz (i32.and (local.get $filters) (i32.const 2)))
                  (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 12))) (local.get $to))))))
        (then
          (if (i32.eq (local.get $mode) (i32.const 2))
            (then
              (if (i32.or (i32.eqz (local.get $oldest)) (i32.lt_u (local.get $id) (local.get $oldest)))
                (then (local.set $oldest (local.get $id)) (local.set $result (local.get $entry)))))
            (else (local.set $result (i32.add (local.get $result)
              (select (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 1)
                (local.get $mode))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $result))

  (func $dp_message_cancel_range (param $owner i32) (param $kind i32)
      (param $low i32) (param $high i32) (result i32)
    (local $i i32) (local $entry i32) (local $priority i32) (local $count i32)
    (if (i32.eqz (global.get $dp_message_table)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_MESSAGE_MAX)))
      (local.set $entry (i32.add (global.get $dp_message_table)
        (i32.mul (local.get $i) (global.get $DP_MESSAGE_STRIDE))))
      (local.set $priority (call $gl32 (i32.add (local.get $entry) (i32.const 24))))
      (if (i32.and
            (i32.and (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (local.get $owner))
              (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 28))) (local.get $kind)))
            (i32.and (i32.ge_u (local.get $priority) (local.get $low))
              (i32.le_u (local.get $priority) (local.get $high))))
        (then (local.set $count (i32.add (local.get $count)
          (call $dp_message_remove (local.get $owner) (call $gl32 (local.get $entry)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $count))

  (func $dp_messages_clear
    (local $i i32) (local $entry i32)
    (if (i32.eqz (global.get $dp_message_table)) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_MESSAGE_MAX)))
      (local.set $entry (i32.add (global.get $dp_message_table)
        (i32.mul (local.get $i) (global.get $DP_MESSAGE_STRIDE))))
      (drop (call $dp_message_remove
        (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (call $gl32 (local.get $entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  (func $dp_messages_clear_owner (param $owner i32)
    (drop (call $dp_message_cancel_range (local.get $owner) (i32.const 0)
      (i32.const 0) (i32.const -1)))
    (drop (call $dp_message_cancel_range (local.get $owner) (i32.const 1)
      (i32.const 0) (i32.const -1))))

  (func $dp_receive (param $owner i32) (param $from_ptr i32) (param $to_ptr i32)
      (param $flags i32) (param $data i32) (param $size_ptr i32) (result i32)
    (local $entry i32) (local $size i32) (local $capacity i32)
    (if (i32.or (i32.eqz (local.get $from_ptr))
          (i32.or (i32.eqz (local.get $to_ptr)) (i32.eqz (local.get $size_ptr))))
      (then (return (i32.const 0x80070057))))
    (if (i32.and (local.get $flags) (i32.const -16))
      (then (return (i32.const 0x88770078)))) ;; DPERR_INVALIDFLAGS
    (local.set $entry (call $dp_message_query_filtered (local.get $owner) (i32.const 1)
      (call $gl32 (local.get $from_ptr)) (call $gl32 (local.get $to_ptr))
      (i32.const 2) (local.get $flags)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0x887700BE))))
    (local.set $size (call $gl32 (i32.add (local.get $entry) (i32.const 20))))
    (local.set $capacity (call $gl32 (local.get $size_ptr)))
    (call $gs32 (local.get $size_ptr) (local.get $size))
    (if (i32.or (i32.eqz (local.get $data)) (i32.lt_u (local.get $capacity) (local.get $size)))
      (then (return (i32.const 0x8877001E)))) ;; DPERR_BUFFERTOOSMALL; retain message
    (call $guest_memmove (local.get $data)
      (call $gl32 (i32.add (local.get $entry) (i32.const 16))) (local.get $size))
    ;; DPMSG_SETPLAYERORGROUPDATA carries its data right after the 20-byte
    ;; header, and lpData points there in the buffer the app received.
    (if (i32.and
          (i32.and (i32.eqz (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
            (i32.ge_u (local.get $size) (i32.const 20)))
          (i32.eq (call $gl32 (local.get $data)) (i32.const 0x102)))
      (then (call $gs32 (i32.add (local.get $data) (i32.const 12))
        (i32.add (local.get $data) (i32.const 20)))))
    (call $gs32 (local.get $from_ptr) (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (call $gs32 (local.get $to_ptr) (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 8)))
      (then (drop (call $dp_message_remove (local.get $owner) (call $gl32 (local.get $entry))))))
    (i32.const 0))

  (func $dp_ensure_entities (result i32)
    (if (i32.eqz (global.get $dp_entity_table))
      (then
        (global.set $dp_entity_table
          (call $heap_alloc
            (i32.mul (global.get $DP_ENTITY_MAX) (global.get $DP_ENTITY_STRIDE))))
        (if (global.get $dp_entity_table)
          (then
            (call $zero_memory (call $g2w (global.get $dp_entity_table))
              (i32.mul (global.get $DP_ENTITY_MAX) (global.get $DP_ENTITY_STRIDE)))))))
    (global.get $dp_entity_table))

  (func $dp_clone_name (param $src i32) (result i32)
    (local $name i32)
    (local.set $name (call $heap_alloc (i32.const 16)))
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    (call $zero_memory (call $g2w (local.get $name)) (i32.const 16))
    (call $gs32 (local.get $name) (i32.const 16))
    (if (local.get $src)
      (then
        (call $gs32 (i32.add (local.get $name) (i32.const 4))
          (call $gl32 (i32.add (local.get $src) (i32.const 4))))
        (call $gs32 (i32.add (local.get $name) (i32.const 8))
          (call $guest_strdup
            (call $gl32 (i32.add (local.get $src) (i32.const 8)))))
        (call $gs32 (i32.add (local.get $name) (i32.const 12))
          (call $guest_strdup
            (call $gl32 (i32.add (local.get $src) (i32.const 12)))))))
    (local.get $name))

  (func $dp_free_name (param $name i32)
    (local $short i32) (local $long i32)
    (if (i32.eqz (local.get $name)) (then (return)))
    (local.set $short (call $gl32 (i32.add (local.get $name) (i32.const 8))))
    (local.set $long (call $gl32 (i32.add (local.get $name) (i32.const 12))))
    (if (local.get $short) (then (call $heap_free (local.get $short))))
    (if (i32.and (local.get $long) (i32.ne (local.get $long) (local.get $short)))
      (then (call $heap_free (local.get $long))))
    (call $heap_free (local.get $name)))

  (func $dp_find_entity (param $id i32) (param $type i32) (result i32)
    (local $i i32) (local $entry i32)
    (if (i32.eqz (global.get $dp_entity_table)) (then (return (i32.const 0))))
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (local.set $entry
        (i32.add (global.get $dp_entity_table)
          (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
      (if (i32.and
            (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 0))
            (i32.and
              (i32.eq (call $gl32 (local.get $entry)) (local.get $id))
              (i32.or (i32.lt_s (local.get $type) (i32.const 0))
                (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4)))
                  (local.get $type)))))
        (then (return (local.get $entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $dp_alloc_entity
      (param $type i32) (param $name i32) (param $flags i32) (result i32)
    (local $i i32) (local $entry i32) (local $id i32) (local $copy i32)
    (if (i32.eqz (call $dp_ensure_entities)) (then (return (i32.const 0))))
    (block $full (loop $scan
      (br_if $full (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (local.set $entry
        (i32.add (global.get $dp_entity_table)
          (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
      (if (i32.eqz (call $gl32 (i32.add (local.get $entry) (i32.const 20))))
        (then
          (local.set $copy (call $dp_clone_name (local.get $name)))
          (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
          (local.set $id (global.get $dp_entity_next_id))
          (global.set $dp_entity_next_id
            (i32.add (global.get $dp_entity_next_id) (i32.const 1)))
          (call $gs32 (local.get $entry) (local.get $id))
          (call $gs32 (i32.add (local.get $entry) (i32.const 4)) (local.get $type))
          (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $copy))
          ;; Everything in this process-local repository was created by this
          ;; DirectPlay object, so Win98 reports DPPLAYER/DPGROUP_LOCAL even
          ;; when the caller did not redundantly pass that output flag.
          (call $gs32 (i32.add (local.get $entry) (i32.const 12))
            (i32.or (local.get $flags) (i32.const 0x00000008)))
          (call $gs32 (i32.add (local.get $entry) (i32.const 16)) (i32.const 0))
          (call $gs32 (i32.add (local.get $entry) (i32.const 20)) (i32.const 1))
          (call $gs32 (i32.add (local.get $entry) (i32.const 40)) (i32.const -1))
          (call $gs32 (i32.add (local.get $entry) (i32.const 44)) (i32.const 0)) ;; creator COM object
          (call $gs32 (i32.add (local.get $entry) (i32.const 48)) (i32.const 0)) ;; borrowed receive event
          (call $gs32 (i32.add (local.get $entry) (i32.const 52)) (i32.const 0)) ;; lives here
          (return (local.get $entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Internal storage primitives. Public DP4 ownership policy and notification
  ;; delivery are separate from assigning an already-validated local identity.
  (func $dp_assign_group_owner (param $group_id i32) (param $player_id i32) (result i32)
    (local $group i32)
    (local.set $group (call $dp_find_entity (local.get $group_id) (i32.const 0)))
    (if (i32.eqz (local.get $group)) (then (return (i32.const 0))))
    (if (i32.eqz (call $dp_find_entity (local.get $player_id) (i32.const 1)))
      (then (return (i32.const 0))))
    (call $gs32 (i32.add (local.get $group) (i32.const 40)) (local.get $player_id))
    (i32.const 1))

  (func $dp_group_owner (param $group_id i32) (result i32)
    (local $group i32)
    (local.set $group (call $dp_find_entity (local.get $group_id) (i32.const 0)))
    (if (i32.eqz (local.get $group)) (then (return (i32.const -1))))
    (call $gl32 (i32.add (local.get $group) (i32.const 40))))

  (func $dp_replace_data
      (param $entry i32) (param $data i32) (param $size i32) (param $local_only i32)
      (result i32)
    (local $offset i32) (local $old i32) (local $copy i32)
    (if (i32.and
          (i32.ne (local.get $size) (i32.const 0))
          (i32.eqz (local.get $data)))
      (then (return (i32.const 0x80070057))))
    (if (local.get $size)
      (then
        (local.set $copy (call $heap_alloc (local.get $size)))
        (if (i32.eqz (local.get $copy))
          (then (return (i32.const 0x8007000E))))
        (memory.copy (call $g2w (local.get $copy)) (call $g2w (local.get $data))
          (local.get $size))))
    (local.set $offset
      (select (i32.const 32) (i32.const 24) (local.get $local_only)))
    (local.set $old (call $gl32 (i32.add (local.get $entry) (local.get $offset))))
    (if (local.get $old) (then (call $heap_free (local.get $old))))
    (call $gs32 (i32.add (local.get $entry) (local.get $offset)) (local.get $copy))
    (call $gs32
      (i32.add (local.get $entry) (i32.add (local.get $offset) (i32.const 4)))
      (local.get $size))
    (i32.const 0))

  (func $dp_invalid_entity (param $type i32) (result i32)
    (select
      (i32.const 0x8877009B) ;; DPERR_INVALIDGROUP
      (i32.const 0x88770096) ;; DPERR_INVALIDPLAYER
      (i32.eqz (local.get $type))))

  (func $dp_create_entity
      (param $out_id i32) (param $name i32) (param $data i32) (param $size i32)
      (param $flags i32) (param $type i32)
      (result i32)
    (local $entry i32) (local $hr i32)
    (if (i32.eqz (local.get $out_id)) (then (return (i32.const 0x80070057))))
    (call $gs32 (local.get $out_id) (i32.const 0))
    (local.set $entry
      (call $dp_alloc_entity (local.get $type) (local.get $name) (local.get $flags)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0x8007000E))))
    (local.set $hr
      (call $dp_replace_data
        (local.get $entry) (local.get $data) (local.get $size) (i32.const 0)))
    (if (local.get $hr)
      (then
        (call $dp_free_name (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
        (call $zero_memory (call $g2w (local.get $entry)) (global.get $DP_ENTITY_STRIDE))
        (return (local.get $hr))))
    (call $gs32 (local.get $out_id) (call $gl32 (local.get $entry)))
    (i32.const 0))

  (func $dp_group_bit (param $group i32) (result i32)
    (i32.shl (i32.const 1)
      (i32.div_u
        (i32.sub (local.get $group) (global.get $dp_entity_table))
        (global.get $DP_ENTITY_STRIDE))))

  (func $dp_bind_entity (param $id i32) (param $owner i32) (param $event i32)
    (local $entry i32)
    (local.set $entry (call $dp_find_entity (local.get $id) (i32.const -1)))
    (if (local.get $entry)
      (then
        (call $gs32 (i32.add (local.get $entry) (i32.const 44)) (local.get $owner))
        (call $gs32 (i32.add (local.get $entry) (i32.const 48)) (local.get $event)))))

  ;; A local send publishes all recipient copies before signaling any event.
  ;; The temporary ID list lets allocation failure undo only this send.
  (func $dp_send_local (param $owner i32) (param $from i32) (param $to i32)
      (param $flags i32) (param $data i32) (param $size i32) (result i32)
    (call $dp_send_local_priority (local.get $owner) (local.get $from) (local.get $to)
      (local.get $flags) (local.get $data) (local.get $size)
      (select (i32.const 65535) (i32.const 0) (i32.and (local.get $flags) (i32.const 2)))))

  (func $dp_send_local_priority (param $owner i32) (param $from i32) (param $to i32)
      (param $flags i32) (param $data i32) (param $size i32) (param $priority i32) (result i32)
    (local $entry i32) (local $target i32) (local $group_bit i32)
    (local $i i32) (local $recipients i32) (local $ids i32) (local $count i32)
    (local $id i32) (local $event i32)
    (if (i32.eqz (local.get $owner)) (then (return (i32.const 0x88770082))))
    (if (i32.and (local.get $flags) (i32.const 0xFFFFF904))
      (then (return (i32.const 0x88770078)))) ;; unknown DPSEND flags
    (if (i32.and (local.get $flags) (i32.const -4))
      (then (return (i32.const 0x80004001)))) ;; streams/security/async are not implemented
    (if (i32.gt_u (local.get $size) (i32.const 1048576))
      (then (return (i32.const 0x887700E6)))) ;; DPERR_SENDTOOBIG
    (if (i32.and (i32.ne (local.get $size) (i32.const 0)) (i32.eqz (local.get $data)))
      (then (return (i32.const 0x80070057))))
    (local.set $entry (call $dp_find_entity (local.get $from) (i32.const 1)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0x88770096))))
    (if (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 44))) (local.get $owner))
      (then (return (i32.const 0x88770096))))
    ;; A recipient on another machine is one frame on the wire; a send to
    ;; everyone goes to each peer and then on to the local players below.
    (if (call $dpn_send_data (local.get $owner) (local.get $from) (local.get $to)
          (local.get $data) (local.get $size))
      (then (return (i32.const 0))))
    (if (local.get $to)
      (then
        (local.set $target (call $dp_find_entity (local.get $to) (i32.const -1)))
        (if (i32.eqz (local.get $target)) (then (return (i32.const 0x88770096))))
        ;; Do not silently connect unrelated COM objects before session joining exists.
        (if (i32.ne (call $gl32 (i32.add (local.get $target) (i32.const 44))) (local.get $owner))
          (then (return (i32.const 0x887700AA)))) ;; DPERR_NOCONNECTION
        (if (i32.eqz (call $gl32 (i32.add (local.get $target) (i32.const 4))))
          (then (local.set $group_bit (call $dp_group_bit (local.get $target)))))))
    (block $selected (loop $select
      (br_if $selected (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (local.set $entry (i32.add (global.get $dp_entity_table)
        (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
      (if (i32.and
            (i32.and (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 0))
              (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (i32.const 1)))
            (i32.and
              (i32.and (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 44))) (local.get $owner))
                (i32.and (i32.ne (call $gl32 (local.get $entry)) (local.get $from))
                  (i32.eqz (call $dpn_is_remote (local.get $entry)))))
              (i32.or (i32.eqz (local.get $to))
                (i32.or (i32.eq (local.get $entry) (local.get $target))
                  (i32.ne (i32.and (call $gl32 (i32.add (local.get $entry) (i32.const 16)))
                    (local.get $group_bit)) (i32.const 0))))))
        (then (local.set $recipients (i32.or (local.get $recipients)
          (i32.shl (i32.const 1) (local.get $i))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $select)))
    (if (i32.eqz (local.get $recipients)) (then (return (i32.const 0))))
    (local.set $ids (call $heap_alloc (i32.mul (global.get $DP_ENTITY_MAX) (i32.const 4))))
    (if (i32.eqz (local.get $ids)) (then (return (i32.const 0x8007000E))))
    (local.set $i (i32.const 0))
    (block $queued (loop $enqueue
      (br_if $queued (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (if (i32.and (local.get $recipients) (i32.shl (i32.const 1) (local.get $i)))
        (then
          (local.set $entry (i32.add (global.get $dp_entity_table)
            (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
          (local.set $id (call $dp_message_enqueue (local.get $owner) (local.get $from)
            (call $gl32 (local.get $entry)) (local.get $data) (local.get $size)
            (local.get $priority)
            (i32.const 1)))
          (if (i32.eqz (local.get $id))
            (then
              (block $rolled_back (loop $rollback
                (br_if $rolled_back (i32.eqz (local.get $count)))
                (local.set $count (i32.sub (local.get $count) (i32.const 1)))
                (drop (call $dp_message_remove (local.get $owner)
                  (call $gl32 (i32.add (local.get $ids) (i32.shl (local.get $count) (i32.const 2))))))
                (br $rollback)))
              (call $heap_free (local.get $ids))
              (return (i32.const 0x8007000E))))
          (call $gs32 (i32.add (local.get $ids) (i32.shl (local.get $count) (i32.const 2))) (local.get $id))
          (local.set $count (i32.add (local.get $count) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $enqueue)))
    (call $heap_free (local.get $ids))
    (local.set $i (i32.const 0))
    (block $notified (loop $notify
      (br_if $notified (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (if (i32.and (local.get $recipients) (i32.shl (i32.const 1) (local.get $i)))
        (then
          (local.set $entry (i32.add (global.get $dp_entity_table)
            (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
          (local.set $event (call $gl32 (i32.add (local.get $entry) (i32.const 48))))
          (if (local.get $event) (then (drop (call $host_set_event (local.get $event)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $notify)))
    (i32.const 0))

  (func $dp_discard_player_messages (param $player i32)
    (local $i i32) (local $entry i32)
    (if (i32.eqz (global.get $dp_message_table)) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_MESSAGE_MAX)))
      (local.set $entry (i32.add (global.get $dp_message_table)
        (i32.mul (local.get $i) (global.get $DP_MESSAGE_STRIDE))))
      (if (i32.and (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 28))) (i32.const 1))
            (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 12))) (local.get $player)))
        (then (drop (call $dp_message_remove
          (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (call $gl32 (local.get $entry))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  (func $dp_close_owner (param $owner i32)
    (local $i i32) (local $entry i32)
    (call $dpn_close (local.get $owner))
    (call $dp_messages_clear_owner (local.get $owner))
    (if (i32.eqz (global.get $dp_entity_table)) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (local.set $entry (i32.add (global.get $dp_entity_table)
        (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
      (if (i32.and (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 0))
            (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 44))) (local.get $owner)))
        (then (drop (call $dp_destroy_entity (call $gl32 (local.get $entry))
          (call $gl32 (i32.add (local.get $entry) (i32.const 4)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; Player membership and group shortcuts share one bitset, but they are not
  ;; interchangeable identities.  DirectPlay keeps separate player/group ID
  ;; lists, and public methods report the invalid ID in its own namespace.
  ;; Checking the creator object here also prevents one process-local
  ;; IDirectPlay instance from mutating another instance's name table.
  (func $dp_update_membership
      (param $owner i32) (param $group_id i32) (param $member_id i32)
      (param $member_type i32) (param $add i32) (result i32)
    (local $member i32) (local $group i32) (local $bits i32) (local $bit i32)
    (local.set $group
      (call $dp_owned_entity
        (local.get $owner) (local.get $group_id) (i32.const 0)))
    (if (i32.eqz (local.get $group))
      (then (return (i32.const 0x8877009B)))) ;; DPERR_INVALIDGROUP
    (local.set $member
      (call $dp_owned_entity
        (local.get $owner) (local.get $member_id) (local.get $member_type)))
    (if (i32.eqz (local.get $member))
      (then (return (call $dp_invalid_entity (local.get $member_type)))))
    (if (i32.eq (local.get $member) (local.get $group))
      (then (return (i32.const 0x8877009B)))) ;; a group cannot contain itself
    (local.set $bit (call $dp_group_bit (local.get $group)))
    (local.set $bits (call $gl32 (i32.add (local.get $member) (i32.const 16))))
    (call $gs32 (i32.add (local.get $member) (i32.const 16))
      (select
        (i32.or (local.get $bits) (local.get $bit))
        (i32.and (local.get $bits) (i32.xor (local.get $bit) (i32.const -1)))
        (local.get $add)))
    (i32.const 0))

  ;; All four IDirectPlay3 membership methods are three-argument stdcall
  ;; front doors over the typed state transition above.  Keep the HRESULT and
  ;; stack epilogue together so their error paths cannot drift apart.
  (func $dp_handle_membership
      (param $owner i32) (param $group_id i32) (param $member_id i32)
      (param $member_type i32) (param $add i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_update_membership
        (local.get $owner) (local.get $group_id) (local.get $member_id)
        (local.get $member_type) (local.get $add)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $dp_destroy_entity (param $id i32) (param $type i32) (result i32)
    (local $entry i32) (local $i i32) (local $scan i32) (local $bit i32)
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $type) (i32.const 1))
      (then (call $dp_discard_player_messages (local.get $id))))
    (if (i32.eq (local.get $type) (i32.const 0))
      (then
        (local.set $bit (call $dp_group_bit (local.get $entry)))
        (block $done (loop $clear_members
          (br_if $done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
          (local.set $scan
            (i32.add (global.get $dp_entity_table)
              (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
          (call $gs32 (i32.add (local.get $scan) (i32.const 16))
            (i32.and (call $gl32 (i32.add (local.get $scan) (i32.const 16)))
              (i32.xor (local.get $bit) (i32.const -1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $clear_members))))
      (else
        (block $owners_done (loop $clear_owners
          (br_if $owners_done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
          (local.set $scan
            (i32.add (global.get $dp_entity_table)
              (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
          (if (i32.eq
                (call $gl32 (i32.add (local.get $scan) (i32.const 40)))
                (local.get $id))
            (then (call $gs32 (i32.add (local.get $scan) (i32.const 40)) (i32.const -1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $clear_owners)))))
    (call $dpw_forget (local.get $entry))
    (call $dp_free_name (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (if (call $gl32 (i32.add (local.get $entry) (i32.const 24)))
      (then (call $heap_free
        (call $gl32 (i32.add (local.get $entry) (i32.const 24))))))
    (if (call $gl32 (i32.add (local.get $entry) (i32.const 32)))
      (then (call $heap_free
        (call $gl32 (i32.add (local.get $entry) (i32.const 32))))))
    (call $zero_memory (call $g2w (local.get $entry)) (global.get $DP_ENTITY_STRIDE))
    (i32.const 1))

  (func $dp_replace_name
      (param $id i32) (param $type i32) (param $name i32) (result i32)
    (local $entry i32) (local $copy i32)
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (local.set $copy (call $dp_clone_name (local.get $name)))
    (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
    (call $dpw_forget (local.get $entry))
    (call $dp_free_name (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $copy))
    (i32.const 1))

  (func $dp_get_name
      (param $id i32) (param $type i32) (param $out i32) (param $size_ptr i32)
      (result i32)
    (local $entry i32) (local $name i32) (local $short i32) (local $long i32)
    (local $short_size i32) (local $long_size i32) (local $required i32)
    (local $cursor i32) (local $out_wa i32) (local $capacity i32)
    (if (i32.eqz (local.get $size_ptr))
      (then (return (i32.const 0x80070057))))
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry))
      (then
        (call $gs32 (local.get $size_ptr) (i32.const 0))
        (return (call $dp_invalid_entity (local.get $type)))))
    (local.set $name (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (local.set $short (call $gl32 (i32.add (local.get $name) (i32.const 8))))
    (local.set $long (call $gl32 (i32.add (local.get $name) (i32.const 12))))
    (if (local.get $short)
      (then (local.set $short_size
        (i32.add (call $guest_strlen (local.get $short)) (i32.const 1)))))
    (if (local.get $long)
      (then (local.set $long_size
        (i32.add (call $guest_strlen (local.get $long)) (i32.const 1)))))
    (local.set $required
      (i32.add (i32.const 16)
        (i32.add (local.get $short_size) (local.get $long_size))))
    (local.set $capacity (call $gl32 (local.get $size_ptr)))
    (call $gs32 (local.get $size_ptr) (local.get $required))
    (if (i32.or
          (i32.eqz (local.get $out))
          (i32.lt_u (local.get $capacity) (local.get $required)))
      (then (return (i32.const 0x8877001E)))) ;; DPERR_BUFFERTOOSMALL
    (local.set $out_wa (call $g2w (local.get $out))) (call $zero_memory (local.get $out_wa) (local.get $required))
    (i32.store (local.get $out_wa) (i32.const 16))
    (i32.store offset=4 (local.get $out_wa)
      (call $gl32 (i32.add (local.get $name) (i32.const 4))))
    (local.set $cursor (i32.add (local.get $out) (i32.const 16)))
    (if (local.get $short_size)
      (then
        (i32.store offset=8 (local.get $out_wa) (local.get $cursor))
        (memory.copy (call $g2w (local.get $cursor)) (call $g2w (local.get $short))
          (local.get $short_size))
        (local.set $cursor (i32.add (local.get $cursor) (local.get $short_size)))))
    (if (local.get $long_size)
      (then
        (i32.store offset=12 (local.get $out_wa) (local.get $cursor))
        (memory.copy (call $g2w (local.get $cursor)) (call $g2w (local.get $long))
          (local.get $long_size))))
    (i32.const 0))

  (func $dp_get_flags
      (param $id i32) (param $type i32) (param $out i32) (result i32)
    (local $entry i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80070057))))
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry))
      (then
        (call $gs32 (local.get $out) (i32.const 0))
        (return (call $dp_invalid_entity (local.get $type)))))
    (call $gs32 (local.get $out)
      (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
    (i32.const 0))

  (func $dp_set_data
      (param $id i32) (param $type i32) (param $data i32) (param $size i32)
      (param $flags i32) (result i32)
    (local $entry i32)
    ;; DPSET_LOCAL (1) selects the private copy; DPSET_GUARANTEED (2) is a
    ;; propagation request and has no extra work in this no-network session.
    (if (i32.ne
          (i32.and (local.get $flags) (i32.const 0xFFFFFFFC))
          (i32.const 0))
      (then (return (i32.const 0x88770078)))) ;; DPERR_INVALIDFLAGS
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry))
      (then (return (call $dp_invalid_entity (local.get $type)))))
    (call $dp_replace_data
      (local.get $entry) (local.get $data) (local.get $size)
      (i32.and (local.get $flags) (i32.const 1))))

  (func $dp_get_data
      (param $id i32) (param $type i32) (param $out i32) (param $size_ptr i32)
      (param $flags i32) (result i32)
    (local $entry i32) (local $offset i32) (local $data i32)
    (local $size i32) (local $capacity i32)
    (if (i32.eqz (local.get $size_ptr))
      (then (return (i32.const 0x80070057))))
    (if (i32.ne
          (i32.and (local.get $flags) (i32.const 0xFFFFFFFE))
          (i32.const 0))
      (then (return (i32.const 0x88770078)))) ;; DPERR_INVALIDFLAGS
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry))
      (then
        (call $gs32 (local.get $size_ptr) (i32.const 0))
        (return (call $dp_invalid_entity (local.get $type)))))
    (local.set $offset
      (select (i32.const 32) (i32.const 24)
        (i32.and (local.get $flags) (i32.const 1))))
    (local.set $data (call $gl32 (i32.add (local.get $entry) (local.get $offset))))
    (local.set $size
      (call $gl32
        (i32.add (local.get $entry) (i32.add (local.get $offset) (i32.const 4)))))
    (local.set $capacity (call $gl32 (local.get $size_ptr)))
    (call $gs32 (local.get $size_ptr) (local.get $size))
    (if (i32.eqz (local.get $size)) (then (return (i32.const 0))))
    (if (i32.or
          (i32.eqz (local.get $out))
          (i32.lt_u (local.get $capacity) (local.get $size)))
      (then (return (i32.const 0x8877001E)))) ;; DPERR_BUFFERTOOSMALL
    (memory.copy (call $g2w (local.get $out)) (call $g2w (local.get $data))
      (local.get $size))
    (i32.const 0))

  (func $dp_clear_entities
    (local $i i32) (local $entry i32)
    (call $dp_messages_clear)
    (if (i32.eqz (global.get $dp_entity_table)) (then (return)))
    (block $done (loop $clear
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (local.set $entry
        (i32.add (global.get $dp_entity_table)
          (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
      (if (call $gl32 (i32.add (local.get $entry) (i32.const 20)))
        (then
          (call $dpw_forget (local.get $entry))
    (call $dp_free_name (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
          (if (call $gl32 (i32.add (local.get $entry) (i32.const 24)))
            (then (call $heap_free
              (call $gl32 (i32.add (local.get $entry) (i32.const 24))))))
          (if (call $gl32 (i32.add (local.get $entry) (i32.const 32)))
            (then (call $heap_free
              (call $gl32 (i32.add (local.get $entry) (i32.const 32))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $clear)))
    (call $zero_memory (call $g2w (global.get $dp_entity_table))
      (i32.mul (global.get $DP_ENTITY_MAX) (global.get $DP_ENTITY_STRIDE))))

  ;; Reentrant enumeration frame at ESP after callback ret 20:
  ;; +0 'DPEN', +4 caller return, +8 callback, +12 context, +16 type,
  ;; +20 required membership bit, +24 next slot, +28 flags, +32 filter bool.
  (func $dp_enum_finish (param $frame i32)
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $frame) (i32.const 40)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $dp_enum_continue
    (local $frame i32) (local $i i32) (local $entry i32)
    (local $type i32) (local $entity_flags i32) (local $enum_flags i32)
    (local $criteria i32) (local $wname i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (local.set $wname (call $gl32 (i32.add (local.get $frame) (i32.const 36))))
    (if (i32.gt_u (local.get $wname) (i32.const 1)) (then
      (call $dp_free_name (local.get $wname))
      (call $gs32 (i32.add (local.get $frame) (i32.const 36)) (i32.const 1))))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $dp_enum_finish (local.get $frame)) (return)))
    (if (i32.eqz (global.get $dp_entity_table))
      (then (call $dp_enum_finish (local.get $frame)) (return)))
    (local.set $i (call $gl32 (i32.add (local.get $frame) (i32.const 24))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (local.set $entry
        (i32.add (global.get $dp_entity_table)
          (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (local.get $i))
      (local.set $type (call $gl32 (i32.add (local.get $entry) (i32.const 4))))
      (local.set $entity_flags
        (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
      (local.set $enum_flags
        (call $gl32 (i32.add (local.get $frame) (i32.const 28))))
      ;; Enumeration criteria are conjunctive. REMOTE matches exactly the
      ;; entities without LOCAL, which only the network provider creates.
      ;; GROUP and SESSION select the enumeration shape/session and are not
      ;; entity properties.
      (local.set $criteria
        (i32.and (local.get $enum_flags)
          (select
            (i32.const 0x00001C08) ;; LOCAL | SHORTCUT | STAGING | HIDDEN
            (i32.const 0x00002308) ;; LOCAL | SERVER | SPECTATOR | OWNER
            (i32.eqz (local.get $type)))))
      (if (i32.and
            (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 0))
            (i32.and
              (i32.and
                (i32.or
                  (i32.lt_s
                    (call $gl32 (i32.add (local.get $frame) (i32.const 16)))
                    (i32.const 0))
                  (i32.eq (local.get $type)
                    (call $gl32 (i32.add (local.get $frame) (i32.const 16)))))
                (i32.and
                  (i32.or
                    (i32.eqz (i32.and (local.get $enum_flags) (i32.const 0x00000010)))
                    (i32.eqz (i32.and (local.get $entity_flags) (i32.const 0x00000008))))
                  (i32.eq
                    (i32.and (local.get $entity_flags) (local.get $criteria))
                    (local.get $criteria))))
              (i32.or
                (i32.eqz (call $gl32 (i32.add (local.get $frame) (i32.const 32))))
                (i32.ne
                  (i32.and
                    (call $gl32 (i32.add (local.get $entry) (i32.const 16)))
                    (call $gl32 (i32.add (local.get $frame) (i32.const 20))))
                  (i32.const 0)))))
        (then
          (local.set $wname (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
          (if (call $gl32 (i32.add (local.get $frame) (i32.const 36))) (then
            (local.set $wname (call $dpw_snapshot (local.get $entry)))
            (if (i32.eqz (local.get $wname)) (then
              (call $dp_enum_finish (local.get $frame))
              (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
            (call $gs32 (i32.add (local.get $frame) (i32.const 36)) (local.get $wname))))
          ;; callback(id, type, name, flags, context), right-to-left.
          (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $frame) (i32.const 24)))
          (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))
            (call $gl32 (local.get $entry)))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))
            (call $gl32 (i32.add (local.get $entry) (i32.const 4))))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))
            (local.get $wname))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))
            (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))
            (call $gl32 (i32.add (local.get $frame) (i32.const 12))))
          (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 8))))
          (global.set $steps (i32.const 0))
          (return)))
      (br $scan)))
    (call $dp_enum_finish (local.get $frame)))

  (func $dp_enum_begin
      (param $ret_addr i32) (param $callback i32) (param $context i32)
      (param $type i32) (param $membership_bit i32) (param $flags i32)
      (param $filter_membership i32)
    (local $frame i32)
    (local.set $frame (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 40)))
    (call $zero_memory (call $g2w (local.get $frame)) (i32.const 40))
    (call $gs32 (local.get $frame) (i32.const 0x4E455044)) ;; 'DPEN'
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $ret_addr))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $callback))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $context))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (local.get $type))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (local.get $membership_bit))
    (call $gs32 (i32.add (local.get $frame) (i32.const 28)) (local.get $flags))
    (call $gs32 (i32.add (local.get $frame) (i32.const 32)) (local.get $filter_membership))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (call $dp_enum_continue))

  ;; Query the two bounded ANSI DirectPlay families that this runtime exposes.
  ;; family 0: IDirectPlay2A/3A/4A (upgraded to 53 slots for 4A); family 1:
  ;; IDirectPlayLobbyA/Lobby2A/Lobby3A (15/19 slots). Unicode IDirectPlay2/3/4
  ;; go to the IDirectPlay4W wrapper; Unicode Lobby/2/3 get the Lobby3W vtable,
  ;; whose methods here carry no strings (opaque address blobs, GUIDs, honest
  ;; NOTLOBBIED/unsupported results) except Connect, which returns a W object.
  ;; Anything else fails honestly.
  (func $dplay_query_interface_wa (param $obj i32) (param $iid_wa i32)
        (param $out i32) (param $family i32) (result i32)
    (local $supported i32)
    (if (i32.eqz (local.get $out))
      (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (if (i32.and (i32.eqz (local.get $family)) (i32.ne (local.get $iid_wa) (i32.const 0)))
      (then
        (if (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x0AB1C530) (i32.const 0x11D14745) (i32.const 0x0000A1A7) (i32.const 0xFCAB03F8))
          (then (return (call $dpw_query (local.get $obj) (local.get $out)))))
        ;; IID_IDirectPlay2 {2B74F7C0-9154-11CF-A9CD-00AA006886E3} and
        ;; IID_IDirectPlay3 {133EFE40-32DC-11D0-9CFB-00A0C90A43CB} are the
        ;; Unicode interfaces IDirectPlay4W extends slot for slot, so the 4W
        ;; wrapper serves them as a prefix (Populous TB's weanetr.dll asks
        ;; for IDirectPlay3).
        (if (i32.or
              (call $guid_words_equal (local.get $iid_wa)
                (i32.const 0x2B74F7C0) (i32.const 0x11CF9154) (i32.const 0xAA00CDA9) (i32.const 0xE3866800))
              (call $guid_words_equal (local.get $iid_wa)
                (i32.const 0x133EFE40) (i32.const 0x11D032DC) (i32.const 0xA000FB9C) (i32.const 0xCB430AC9)))
          (then (return (call $dpw_query (local.get $obj) (local.get $out)))))))
    (if (local.get $iid_wa)
      (then
        (local.set $supported
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0) (i32.const 0)
            (i32.const 0x000000C0) (i32.const 0x46000000)))
        (if (i32.eqz (local.get $family))
          (then
            ;; Upgrade the same COM identity, preserving all 47 inherited slots.
            (if (call $guid_words_equal (local.get $iid_wa)
                  (i32.const 0x0AB1C531) (i32.const 0x11D14745)
                  (i32.const 0x0000A1A7) (i32.const 0xFCAB03F8))
              (then
                (call $gs32 (local.get $obj) (global.get $DX_VTBL_DPLAY4))
                (local.set $supported (i32.const 1))))
            ;; IID_IDirectPlay2A {9D460580-A822-11CF-960C-0080C7534E82}.
            (local.set $supported (i32.or (local.get $supported)
              (call $guid_words_equal (local.get $iid_wa)
                (i32.const 0x9D460580) (i32.const 0x11CFA822)
                (i32.const 0x80000C96) (i32.const 0x824E53C7))))
            ;; IID_IDirectPlay3A {133EFE41-32DC-11D0-9CFB-00A0C90A43CB}.
            (local.set $supported (i32.or (local.get $supported)
              (call $guid_words_equal (local.get $iid_wa)
                (i32.const 0x133EFE41) (i32.const 0x11D032DC)
                (i32.const 0xA000FB9C) (i32.const 0xCB430AC9)))))
          (else
            (if (call $guid_words_equal (local.get $iid_wa)
                  (i32.const 0x2DB72491) (i32.const 0x11D1652C)
                  (i32.const 0x0000A8A7) (i32.const 0xFCAB03F8))
              (then
                (call $gs32 (local.get $obj) (global.get $DX_VTBL_DPLAYLOBBY3))
                (local.set $supported (i32.const 1))))
            ;; IID_IDirectPlayLobbyA {26C66A70-B367-11CF-A024-00AA006157AC}
            ;; and IID_IDirectPlayLobby2A {1BB4AF80-A303-11D0-9C4F-00A0C905425E}.
            ;; Both are prefixes of the Lobby3A vtable; pinning it here keeps
            ;; an object that was queried for a Unicode lobby earlier from
            ;; handing its W slots to an ANSI caller.
            (if (i32.or
                  (call $guid_words_equal (local.get $iid_wa)
                    (i32.const 0x26C66A70) (i32.const 0x11CFB367)
                    (i32.const 0xAA0024A0) (i32.const 0xAC576100))
                  (call $guid_words_equal (local.get $iid_wa)
                    (i32.const 0x1BB4AF80) (i32.const 0x11D0A303)
                    (i32.const 0xA0004F9C) (i32.const 0x5E4205C9)))
              (then
                (call $gs32 (local.get $obj) (global.get $DX_VTBL_DPLAYLOBBY3))
                (local.set $supported (i32.const 1))))
            ;; Unicode IID_IDirectPlayLobby {AF465C71-9588-11CF-A020-00AA006157AC},
            ;; IID_IDirectPlayLobby2 {0194C220-A303-11D0-9C4F-00A0C905425E} and
            ;; IID_IDirectPlayLobby3 {2DB72490-652C-11D1-A7A8-0000F803ABFC}:
            ;; one 19-slot W vtable, a prefix of each.
            (if (i32.or
                  (call $guid_words_equal (local.get $iid_wa)
                    (i32.const 0xAF465C71) (i32.const 0x11CF9588)
                    (i32.const 0xAA0020A0) (i32.const 0xAC576100))
                  (i32.or
                    (call $guid_words_equal (local.get $iid_wa)
                      (i32.const 0x0194C220) (i32.const 0x11D0A303)
                      (i32.const 0xA0004F9C) (i32.const 0x5E4205C9))
                    (call $guid_words_equal (local.get $iid_wa)
                      (i32.const 0x2DB72490) (i32.const 0x11D1652C)
                      (i32.const 0x0000A8A7) (i32.const 0xFCAB03F8))))
              (then
                (call $gs32 (local.get $obj) (global.get $DX_VTBL_DPLAYLOBBY3W))
                (local.set $supported (i32.const 1))))))))
    (call $dx_query_interface_result
      (local.get $obj) (local.get $out) (local.get $supported)))

  (func $dplay_query_interface (param $obj i32) (param $iid i32)
        (param $out i32) (param $family i32) (result i32)
    (local $iid_wa i32) (local $hr i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80004003))))
    (if (i32.gt_u (local.get $iid) (i32.const -16))
      (then (call $gs32 (local.get $out) (i32.const 0)) (return (i32.const 0x80004002))))
    (if (local.get $iid) (then (local.set $iid_wa (call $guest_span_in (local.get $iid) (i32.const 16)))))
    (local.set $hr (call $dplay_query_interface_wa
      (local.get $obj) (local.get $iid_wa) (local.get $out) (local.get $family)))
    (if (local.get $iid_wa) (then (call $guest_span_release (local.get $iid_wa) (i32.const 16))))
    (local.get $hr))

  (func $handle_IDirectPlay3_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dplay_query_interface
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $dp_owned_entity (param $owner i32) (param $id i32) (param $type i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (select (local.get $entry) (i32.const 0)
      (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 44))) (local.get $owner))))

  ;; Ownership notifications/migration are not yet implemented. Keep output
  ;; buffers untouched and fail explicitly instead of publishing guessed policy.
  (func $handle_IDirectPlay4_GetGroupOwner (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (if (i32.eqz (local.get $arg2)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (if (i32.eqz (call $dp_owned_entity (local.get $arg0) (local.get $arg1) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8877009B)))))

  (func $handle_IDirectPlay4_SetGroupOwner (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (if (i32.eqz (call $dp_owned_entity (local.get $arg0) (local.get $arg1) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8877009B)) (return)))
    (if (i32.eqz (call $dp_owned_entity (local.get $arg0) (local.get $arg2) (i32.const 1)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770096)))))

  (func $handle_IDirectPlay4_SendEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32) (local $priority i32)
    (local.set $size (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $priority (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44)))
    (if (i32.gt_u (local.get $priority) (i32.const 65535))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770186)) (return)))
    ;; Synchronous delivery has no pending-send ID or completion context.
    (i32.store offset=0 (global.get $reg_base) (call $dp_send_local_priority (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $size) (local.get $priority))))

  (func $handle_IDirectPlay4_GetMessageQueue (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $bytes i32) (local $kind i32)
    (call $dpn_poll)
    (local.set $bytes (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (if (i32.gt_u (local.get $arg3) (i32.const 2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770078)) (return)))
    (if (local.get $arg1)
      (then (if (i32.eqz (call $dp_owned_entity (local.get $arg0) (local.get $arg1) (i32.const 1)))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770096)) (return)))))
    (if (local.get $arg2)
      (then (if (i32.eqz (call $dp_owned_entity (local.get $arg0) (local.get $arg2) (i32.const 1)))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770096)) (return)))))
    (local.set $kind (i32.eq (local.get $arg3) (i32.const 2)))
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4)
      (call $dp_message_query (local.get $arg0) (local.get $kind) (local.get $arg1) (local.get $arg2) (i32.const 0)))))
    (if (local.get $bytes) (then (call $gs32 (local.get $bytes)
      (call $dp_message_query (local.get $arg0) (local.get $kind) (local.get $arg1) (local.get $arg2) (i32.const 1)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirectPlay4_CancelMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770078))
    (if (local.get $arg2) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg1))
      (then (drop (call $dp_message_cancel_range (local.get $arg0) (i32.const 0) (i32.const 0) (i32.const -1))) (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8877017C))
    (local.set $entry (call $dp_message_find (local.get $arg0) (local.get $arg1)))
    (if (i32.eqz (local.get $entry)) (then (return)))
    (if (call $gl32 (i32.add (local.get $entry) (i32.const 28))) (then (return)))
    (drop (call $dp_message_remove (local.get $arg0) (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IDirectPlay4_CancelPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770078))
    (if (local.get $arg3) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770186))
    (if (i32.gt_u (local.get $arg1) (local.get $arg2)) (then (return)))
    (if (i32.gt_u (local.get $arg2) (i32.const 65535)) (then (return)))
    (drop (call $dp_message_cancel_range (local.get $arg0) (i32.const 0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))


  ;; The Lobby3 ABI is callable, but application registration and external
  ;; lobby launch/settings handoff are not implemented. Never invent a connection.
  (func $handle_IDirectPlayLobby3_ConnectEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
    (if (i32.eqz (local.get $arg3)) (then (return)))
    (call $gs32 (local.get $arg3) (i32.const 0))
    (if (i32.eqz (local.get $arg2)) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110))
    (if (local.get $arg4) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)))

  (func $handle_dplobby3_application_unsupported (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770078))
    (if (local.get $arg1) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
    (if (i32.eqz (local.get $arg2)) (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)))

  (func $handle_IDirectPlayLobby3_WaitForConnectionSettings (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (if (i32.and (local.get $arg1) (i32.const -2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770078)))))

  (func $handle_IDirectPlay3_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (call $dp_close_owner (local.get $arg0))
        (call $dx_free (local.get $entry)) (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (store.field DxObject refcount (local.get $entry) (local.get $rc)) (i32.store offset=0 (global.get $reg_base) (local.get $rc))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirectPlay3_AddPlayerToGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dp_handle_membership
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 1) (i32.const 1)))
  (func $handle_IDirectPlay3_Close (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dp_close_owner (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirectPlay3_CreateGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $flags i32)
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (call $dp_create_entity
        (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
        (local.get $flags) (i32.const 0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $dp_bind_entity (call $gl32 (local.get $arg1)) (local.get $arg0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
  (func $handle_IDirectPlay3_CreatePlayer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32) (local $flags i32)
    (local.set $size (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=0 (global.get $reg_base) (call $dp_create_entity
        (local.get $arg1) (local.get $arg2) (local.get $arg4) (local.get $size)
        (local.get $flags) (i32.const 1)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then
        (call $dp_bind_entity (call $gl32 (local.get $arg1)) (local.get $arg0) (local.get $arg3))
        (call $dpn_player_created (local.get $arg0) (call $gl32 (local.get $arg1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
  (func $handle_IDirectPlay3_DeletePlayerFromGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dp_handle_membership
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 1) (i32.const 0)))
  (func $handle_IDirectPlay3_DestroyGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x80070057)
        (call $dp_destroy_entity (local.get $arg1) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectPlay3_DestroyPlayer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dpn_player_destroyed (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x80070057)
        (call $dp_destroy_entity (local.get $arg1) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectPlay3_EnumGroupPlayers (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $group i32) (local $flags i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $group (call $dp_find_entity (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (if (i32.or (i32.eqz (local.get $arg3)) (i32.eqz (local.get $group)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (call $dp_enum_begin
      (local.get $ret_addr) (local.get $arg3) (local.get $arg4) (i32.const 1)
      (call $dp_group_bit (local.get $group)) (local.get $flags) (i32.const 1)))
  (func $handle_IDirectPlay3_EnumGroups (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (call $dp_enum_begin
      (local.get $ret_addr) (local.get $arg2) (local.get $arg3) (i32.const 0)
      (i32.const 0) (local.get $arg4) (i32.const 0)))
  (func $handle_IDirectPlay3_EnumPlayers (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $type i32)
    (call $dpn_poll)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $type
      (select (i32.const -1) (i32.const 1)
        (i32.ne (i32.and (local.get $arg4) (i32.const 0x00000020)) (i32.const 0))))
    (call $dp_enum_begin
      (local.get $ret_addr) (local.get $arg2) (local.get $arg3) (local.get $type)
      (i32.const 0) (local.get $arg4) (i32.const 0)))
  ;; Sessions are found on the virtual LAN; see 09d4-dplay-net.wat.
  (func $handle_IDirectPlay3_EnumSessions (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dpn_enum_sessions (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 0)))
  ;; DPCAPS (40 bytes: dwSize, dwFlags, dwMaxBufferSize, dwMaxQueueSize,
  ;; dwMaxPlayers, dwHundredBaud, dwLatency, dwMaxLocalPlayers,
  ;; dwHeaderLength, dwTimeout) for the virtual-LAN TCP/IP provider. Written
  ;; only within the caller's dwSize: this used to zero 64 bytes, and Age of
  ;; Empires II keeps its DPCAPS in a 40-byte stack local, so GetPlayerCaps
  ;; overwrote its saved registers and return address and it returned to 0.
  (func $dp_fill_caps (param $caps i32) (result i32)
    (local $size i32)
    (if (i32.eqz (local.get $caps)) (then (return (i32.const 0x80070057))))
    (local.set $size (call $gl32 (local.get $caps)))
    (if (i32.lt_u (local.get $size) (i32.const 40)) (then (return (i32.const 0x80070057))))
    (call $gs32 (i32.add (local.get $caps) (i32.const 4))
      (i32.or (i32.const 0x40) ;; DPCAPS_GUARANTEEDSUPPORTED: the room wire is reliable
        (select (i32.const 0x2) (i32.const 0) (i32.eq (global.get $dpn_state) (i32.const 1))))) ;; DPCAPS_ISHOST
    (call $gs32 (i32.add (local.get $caps) (i32.const 8)) (i32.const 1400))     ;; dwMaxBufferSize
    (call $gs32 (i32.add (local.get $caps) (i32.const 12)) (i32.const 0))       ;; dwMaxQueueSize: unlimited
    (call $gs32 (i32.add (local.get $caps) (i32.const 16)) (i32.const 65536))   ;; dwMaxPlayers
    (call $gs32 (i32.add (local.get $caps) (i32.const 20)) (i32.const 100000))  ;; dwHundredBaud: 10 Mb/s LAN
    (call $gs32 (i32.add (local.get $caps) (i32.const 24)) (i32.const 50))      ;; dwLatency (ms)
    (call $gs32 (i32.add (local.get $caps) (i32.const 28)) (i32.const 65536))   ;; dwMaxLocalPlayers
    (call $gs32 (i32.add (local.get $caps) (i32.const 32)) (i32.const 20))      ;; dwHeaderLength
    (call $gs32 (i32.add (local.get $caps) (i32.const 36)) (i32.const 1000))    ;; dwTimeout (ms)
    (i32.const 0))
  (func $handle_IDirectPlay3_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_fill_caps (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectPlay3_GetGroupData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_get_data
        (local.get $arg1) (i32.const 0) (local.get $arg2) (local.get $arg3)
        (local.get $arg4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlay3_GetGroupName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_get_name
        (local.get $arg1) (i32.const 0) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectPlay3_GetMessageCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dpn_poll)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (local.get $arg2)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (if (local.get $arg1)
      (then (if (i32.eqz (call $dp_find_entity (local.get $arg1) (i32.const 1)))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88770096)) (return)))))
    (call $gs32 (local.get $arg2) (call $dp_message_query (local.get $arg0) (i32.const 1)
      (i32.const 0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
  (func $handle_IDirectPlay3_GetPlayerAddress (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectPlay3_GetPlayerCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (if (result i32) (call $dp_find_entity (local.get $arg1) (i32.const 1))
        (then (call $dp_fill_caps (local.get $arg2)))
        (else (i32.const 0x88770096)))) ;; DPERR_INVALIDPLAYER
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectPlay3_GetPlayerData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_get_data
        (local.get $arg1) (i32.const 1) (local.get $arg2) (local.get $arg3)
        (local.get $arg4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlay3_GetPlayerName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_get_name
        (local.get $arg1) (i32.const 1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectPlay3_GetSessionDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dpn_get_session_desc (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectPlay3_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectPlay3_Open (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    ;; -1: a join is waiting for the host and the call has been parked.
    (local.set $hr (call $dpn_open (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (if (i32.ne (local.get $hr) (i32.const -1))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $hr)))))
  (func $handle_IDirectPlay3_Receive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dpn_poll)
    (i32.store offset=0 (global.get $reg_base) (call $dp_receive (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
  (func $handle_IDirectPlay3_Send (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_send_local (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
  (func $handle_IDirectPlay3_SetGroupData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_set_data
        (local.get $arg1) (i32.const 0) (local.get $arg2) (local.get $arg3)
        (local.get $arg4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlay3_SetGroupName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x80070057)
        (call $dp_replace_name (local.get $arg1) (i32.const 0) (local.get $arg2))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectPlay3_SetPlayerData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32)
    (local.set $hr (call $dp_set_data
        (local.get $arg1) (i32.const 1) (local.get $arg2) (local.get $arg3)
        (local.get $arg4)))
    ;; Shared (not DPSET_LOCAL) data reaches every other machine in the session.
    (if (i32.and (i32.eqz (local.get $hr)) (i32.eqz (i32.and (local.get $arg4) (i32.const 1))))
      (then (call $dpn_player_data_changed (local.get $arg0) (local.get $arg1))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlay3_SetPlayerName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x80070057)
        (call $dp_replace_name (local.get $arg1) (i32.const 1) (local.get $arg2))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectPlay3_SetSessionDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectPlay3_AddGroupToGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dp_handle_membership
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0) (i32.const 1)))
  (func $handle_IDirectPlay3_CreateGroupInGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32) (local $flags i32) (local $hr i32) (local $id i32)
    (local.set $size (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (if (i32.eqz
          (call $dp_owned_entity
            (local.get $arg0) (local.get $arg1) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8877009B)) ;; DPERR_INVALIDGROUP
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (local.set $hr
      (call $dp_create_entity
        (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $size)
        (local.get $flags) (i32.const 0)))
    (if (i32.eqz (local.get $hr))
      (then
        (local.set $id (call $gl32 (local.get $arg2)))
        (call $dp_bind_entity (local.get $id) (local.get $arg0) (i32.const 0))
        (local.set $hr
          (call $dp_update_membership
            (local.get $arg0) (local.get $arg1) (local.get $id)
            (i32.const 0) (i32.const 1)))
        (if (local.get $hr)
          (then
            (drop (call $dp_destroy_entity (local.get $id) (i32.const 0)))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
  (func $handle_IDirectPlay3_DeleteGroupFromGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dp_handle_membership
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0) (i32.const 0)))
  (func $handle_IDirectPlay3_EnumConnections (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $guid i32) (local $guid_wa i32) (local $conn i32) (local $dpname i32) (local $dpname_wa i32) (local $label i32) (local $label_wa i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    ;; DPSPGUID_TCPIP {36E95EE0-8577-11cf-960C-0080C7534E82}.
    (local.set $guid (call $heap_alloc (i32.const 16))) (local.set $guid_wa (call $g2w (local.get $guid)))
    (i32.store (local.get $guid_wa) (i32.const 0x36E95EE0))
    (i32.store16 offset=4 (local.get $guid_wa) (i32.const 0x8577))
    (i32.store16 offset=6 (local.get $guid_wa) (i32.const 0x11CF))
    (i32.store offset=8 (local.get $guid_wa) (i32.const 0x80000C96))
    (i32.store offset=12 (local.get $guid_wa) (i32.const 0x824E53C7))
    ;; Dummy connection data; InitializeConnection is local/no-op.
    (local.set $conn (call $heap_alloc (i32.const 4)))
    (i32.store (call $g2w (local.get $conn)) (i32.const 0))
    ;; DPNAME with short/long ANSI strings both set to "TCP/IP".
    (local.set $label (call $heap_alloc (i32.const 8))) (local.set $label_wa (call $g2w (local.get $label)))
    (i32.store (local.get $label_wa) (i32.const 0x2F504354))
    (i32.store16 offset=4 (local.get $label_wa) (i32.const 0x5049))
    (i32.store8 offset=6 (local.get $label_wa) (i32.const 0))
    (local.set $dpname (call $heap_alloc (i32.const 16))) (local.set $dpname_wa (call $g2w (local.get $dpname)))
    (i32.store (local.get $dpname_wa) (i32.const 16))
    (i32.store offset=4 (local.get $dpname_wa) (i32.const 0))
    (i32.store offset=8 (local.get $dpname_wa) (local.get $label))
    (i32.store offset=12 (local.get $dpname_wa) (local.get $label))
    ;; Push saved caller return, then callback args right-to-left:
    ;; context, flags, name, connection size, connection, provider GUID.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $dpname))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 4))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $conn))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $guid))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $ddenum_ret_thunk))
    (global.set $eip (local.get $arg2))
    (global.set $steps (i32.const 0)))
  (func $handle_IDirectPlay3_EnumGroupsInGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $group i32) (local $flags i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $group (call $dp_find_entity (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (if (i32.or (i32.eqz (local.get $arg3)) (i32.eqz (local.get $group)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (call $dp_enum_begin
      (local.get $ret_addr) (local.get $arg3) (local.get $arg4) (i32.const 0)
      (call $dp_group_bit (local.get $group)) (local.get $flags) (i32.const 1)))
  (func $handle_IDirectPlay3_GetGroupConnectionSettings (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlay3_InitializeConnection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectPlay3_SecureOpen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlay3_SendChatMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlay3_SetGroupConnectionSettings (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectPlay3_StartSession (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectPlay3_GetGroupFlags (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_get_flags (local.get $arg1) (i32.const 0) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectPlay3_GetGroupParent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectPlay3_GetPlayerAccount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlay3_GetPlayerFlags (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dp_get_flags (local.get $arg1) (i32.const 1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirectPlayLobby2A — local/no-network lobby shim. Used by DX SDK samples
  ;; that create a lobby object during startup; no actual launched-from-lobby
  ;; state or transport providers are exposed.
  (func $handle_IDirectPlayLobby2_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dplay_query_interface
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))



  ;; Reentrant Lobby address enumeration state. Both callback shapes return
  ;; through CACA0011 and leave this typed frame at ESP:
  ;;   +0 tag ('DPLA' chunks / 'DPLT' types), +4 caller return,
  ;;   +8 callback, +12 context, +16 address/provider GUID,
  ;;   +20 total size, +24 next byte/index, +28 flags,
  ;;   +32 reserved, +36 scratch DPAID GUID (16 bytes), +52 reserved.
  (global $DPL_ENUM_FRAME_SIZE i32 (i32.const 56))

  (func $dpl_enum_finish (param $frame i32) (param $hr i32)
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $frame) (global.get $DPL_ENUM_FRAME_SIZE)))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr)))

  (func $dpl_enum_continue
    (local $frame i32) (local $tag i32) (local $offset i32)
    (local $remaining i32) (local $record i32) (local $data_size i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (local.set $tag (call $gl32 (local.get $frame)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $dpl_enum_finish (local.get $frame) (i32.const 0)) (return)))
    (if (i32.eq (local.get $tag) (i32.const 0x414C5044)) ;; 'DPLA'
      (then
        (local.set $offset (call $gl32 (i32.add (local.get $frame) (i32.const 24))))
        (if (i32.ge_u
              (local.get $offset)
              (call $gl32 (i32.add (local.get $frame) (i32.const 20))))
          (then (call $dpl_enum_finish (local.get $frame) (i32.const 0)) (return)))
        (local.set $remaining
          (i32.sub
            (call $gl32 (i32.add (local.get $frame) (i32.const 20)))
            (local.get $offset)))
        (if (i32.lt_u (local.get $remaining) (i32.const 20))
          (then
            (call $dpl_enum_finish
              (local.get $frame) (i32.const 0x80070057))
            (return)))
        (local.set $record
          (i32.add
            (call $gl32 (i32.add (local.get $frame) (i32.const 16)))
            (local.get $offset)))
        (local.set $data_size
          (call $gl32 (i32.add (local.get $record) (i32.const 16))))
        (if (i32.gt_u
              (local.get $data_size)
              (i32.sub (local.get $remaining) (i32.const 20)))
          (then
            (call $dpl_enum_finish
              (local.get $frame) (i32.const 0x80070057))
            (return)))
        (call $gs32 (i32.add (local.get $frame) (i32.const 24))
          (i32.add (local.get $offset)
            (i32.add (i32.const 20) (local.get $data_size))))
        ;; EnumAddressCallback(guid, size, data, context), right-to-left.
        (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $frame) (i32.const 20)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $record))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (local.get $data_size))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))
          (i32.add (local.get $record) (i32.const 20)))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))
          (call $gl32 (i32.add (local.get $frame) (i32.const 12))))
        (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 8))))
        (global.set $steps (i32.const 0))
        (return)))
    ;; The local TCP/IP provider has one required address type: DPAID_INet.
    (if (i32.ge_u
          (call $gl32 (i32.add (local.get $frame) (i32.const 24)))
          (i32.const 1))
      (then (call $dpl_enum_finish (local.get $frame) (i32.const 0)) (return)))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (i32.const 1))
    (call $gs32 (i32.add (local.get $frame) (i32.const 36))
      (i32.const 0xC4A54DA0))
    (call $gs32 (i32.add (local.get $frame) (i32.const 40))
      (i32.const 0x11CFE0AF))
    (call $gs32 (i32.add (local.get $frame) (i32.const 44))
      (i32.const 0xA0004E9C))
    (call $gs32 (i32.add (local.get $frame) (i32.const 48))
      (i32.const 0x5E4205C9))
    ;; EnumAddressTypesCallback(guid, context, flags), right-to-left.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $frame) (i32.const 16)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))
      (i32.add (local.get $frame) (i32.const 36)))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))
      (call $gl32 (i32.add (local.get $frame) (i32.const 12))))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (i32.const 0))
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 8))))
    (global.set $steps (i32.const 0)))

  (func $dpl_guid_is_tcpip (param $guid i32) (result i32)
    (if (result i32) (i32.eqz (local.get $guid))
      (then (i32.const 0))
      (else
        (i32.and
          (i32.and
            (i32.eq (call $gl32 (local.get $guid)) (i32.const 0x36E95EE0))
            (i32.eq (call $gl32 (i32.add (local.get $guid) (i32.const 4)))
              (i32.const 0x11CF8577)))
          (i32.and
            (i32.eq (call $gl32 (i32.add (local.get $guid) (i32.const 8)))
              (i32.const 0x80000C96))
            (i32.eq (call $gl32 (i32.add (local.get $guid) (i32.const 12)))
              (i32.const 0x824E53C7)))))))

  (func $dpl_enum_begin
      (param $tag i32) (param $ret i32) (param $callback i32)
      (param $context i32) (param $source i32) (param $size i32)
      (param $flags i32)
    (local $frame i32)
    (local.set $frame
      (i32.sub (i32.load offset=16 (global.get $reg_base)) (global.get $DPL_ENUM_FRAME_SIZE)))
    (call $zero_memory
      (call $g2w (local.get $frame)) (global.get $DPL_ENUM_FRAME_SIZE))
    (call $gs32 (local.get $frame) (local.get $tag))
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $ret))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $callback))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $context))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (local.get $source))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (local.get $size))
    (call $gs32 (i32.add (local.get $frame) (i32.const 28)) (local.get $flags))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (call $dpl_enum_continue))

  (func $handle_IDirectPlayLobby2_Connect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32)
    (if (local.get $arg2)
      (then
        (local.set $obj_guest (call $dx_create_com_obj (i32.const 26) (global.get $DX_VTBL_DPLAY3)))
        (call $gs32 (local.get $arg2) (local.get $obj_guest))))
    (if (i32.and
          (i32.ne (local.get $arg2) (i32.const 0))
          (i32.eqz (local.get $obj_guest)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Unicode lobby Connect hands back an IDirectPlay2 (W): the same fresh
  ;; DirectPlay object as the ANSI path, seen through its IDirectPlay4W
  ;; wrapper, which serves IDirectPlay2/3 W as a prefix. The creation reference
  ;; is released after the query, as CoCreateInstance does.
  (func $handle_IDirectPlayLobby3W_Connect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32) (local $hr i32)
    (local.set $hr (i32.const 0x80004003)) ;; E_POINTER
    (if (local.get $arg2)
      (then
        (call $gs32 (local.get $arg2) (i32.const 0))
        (local.set $obj_guest (call $dx_create_com_obj (i32.const 26) (global.get $DX_VTBL_DPLAY3)))
        (if (local.get $obj_guest)
          (then
            (local.set $hr (call $dpw_query (local.get $obj_guest) (local.get $arg2)))
            (drop (call $dx_com_release_basic (local.get $obj_guest))))
          (else (local.set $hr (i32.const 0x80004005))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirectPlayLobby2_CreateAddress (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size_ptr i32)
    (local.set $size_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (if (local.get $size_ptr) (then (call $gs32 (local.get $size_ptr) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_IDirectPlayLobby2_EnumAddress (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.or
          (i32.eqz (local.get $arg1))
          (i32.or (i32.eqz (local.get $arg2)) (i32.lt_u (local.get $arg3) (i32.const 20))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (return)))
    (call $dpl_enum_begin
      (i32.const 0x414C5044) (local.get $ret) (local.get $arg1)
      (local.get $arg4) (local.get $arg2) (local.get $arg3) (i32.const 0)))
  (func $handle_IDirectPlayLobby2_EnumAddressTypes (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.or
          (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
          (i32.or
            (i32.ne (local.get $arg4) (i32.const 0))
            (i32.eqz (call $dpl_guid_is_tcpip (local.get $arg2)))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (return)))
    (call $dpl_enum_begin
      (i32.const 0x544C5044) (local.get $ret) (local.get $arg1)
      (local.get $arg3) (local.get $arg2) (i32.const 0) (local.get $arg4)))
  (func $handle_IDirectPlayLobby2_EnumLocalApplications (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Win98 enumerates lobby-aware applications registered on the local
    ;; machine.  This browser machine has no DirectPlay application registry,
    ;; so a valid enumeration completes successfully without callbacks.  Do
    ;; still enforce the API contract: the callback is required and dwFlags is
    ;; reserved (zero), rather than letting every malformed call succeed.
    (if (i32.or
          (i32.eqz (local.get $arg1))
          (i32.ne (local.get $arg3) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirectPlayLobby2_GetConnectionSettings (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x8877042E))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirectPlayLobby2_ReceiveLobbyMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x887700BE)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
  (func $handle_IDirectPlayLobby2_RunApplication (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x887703FC)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlayLobby2_SendLobbyMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IDirectPlayLobby2_SetConnectionSettings (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectPlayLobby2_SetLobbyMessageEvent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirectPlayLobby2_CreateCompoundAddress (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $element i32) (local $data_size i32)
    (local $required i32) (local $out i32)
    ;; A compound address is a packed sequence of { GUID type, DWORD size,
    ;; BYTE data[size] } records built from 24-byte
    ;; DPCOMPOUNDADDRESSELEMENT inputs.  Callers use the standard two-call
    ;; pattern: a null/undersized output buffer must publish the required byte
    ;; count and return DPERR_BUFFERTOOSMALL.  Infinity Engine relies on that
    ;; result before allocating the buffer used by InitializeConnection.
    (block $size_done (loop $size_loop
      (br_if $size_done (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $element
        (i32.add (local.get $arg1) (i32.mul (local.get $i) (i32.const 24))))
      (local.set $data_size
        (call $gl32 (i32.add (local.get $element) (i32.const 16))))
      (local.set $required
        (i32.add (local.get $required)
          (i32.add (i32.const 20) (local.get $data_size))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $size_loop)))
    (if (i32.or
          (i32.eqz (local.get $arg3))
          (i32.lt_u (call $gl32 (local.get $arg4)) (local.get $required)))
      (then
        (call $gs32 (local.get $arg4) (local.get $required))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8877001E))) ;; DPERR_BUFFERTOOSMALL
      (else
        (local.set $i (i32.const 0))
        (local.set $out (local.get $arg3))
        (block $copy_done (loop $copy_loop
          (br_if $copy_done (i32.ge_u (local.get $i) (local.get $arg2)))
          (local.set $element
            (i32.add (local.get $arg1) (i32.mul (local.get $i) (i32.const 24))))
          (local.set $data_size
            (call $gl32 (i32.add (local.get $element) (i32.const 16))))
          (memory.copy
            (call $g2w (local.get $out))
            (call $g2w (local.get $element))
            (i32.const 16))
          (call $gs32 (i32.add (local.get $out) (i32.const 16)) (local.get $data_size))
          (if (i32.and
                (i32.ne (local.get $data_size) (i32.const 0))
                (i32.ne (call $gl32 (i32.add (local.get $element) (i32.const 20))) (i32.const 0)))
            (then
              (memory.copy
                (call $g2w (i32.add (local.get $out) (i32.const 20)))
                (call $g2w (call $gl32 (i32.add (local.get $element) (i32.const 20))))
                (local.get $data_size))))
          (local.set $out
            (i32.add (local.get $out) (i32.add (i32.const 20) (local.get $data_size))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy_loop)))
        (call $gs32 (local.get $arg4) (local.get $required))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; Direct3DRMCreate(lplpD3DRM) → HRESULT — 1 arg stdcall
  ;; D3D Retained Mode is not supported; return E_FAIL
  (func $handle_Direct3DRMCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0) (then
      (call $gs32 (local.get $arg0) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; D3DRMVectorRotate(r, v, axis, theta) -> r: v rotated by theta radians
  ;; about axis, returned as a unit vector. d3drm builds it as q*v*q^-1 with
  ;; q = (cos(theta/2), sin(theta/2)*axis/|axis|) and normalizes the product;
  ;; Rodrigues' formula below is the same rotation. A zero-length axis or
  ;; result normalizes to (1,0,0), as D3DRMVectorNormalize does. Motocross
  ;; Madness imports only this and Direct3DRMCreate from d3drm.dll.
  (func $handle_D3DRMVectorRotate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $a i32) (local $r i32)
    (local $vx f64) (local $vy f64) (local $vz f64) (local $nx f64) (local $ny f64) (local $nz f64)
    (local $x f64) (local $y f64) (local $z f64)
    (local $c f64) (local $s f64) (local $k f64) (local $dot f64) (local $len f64)
    (local.set $v (call $g2w (local.get $arg1)))
    (local.set $a (call $g2w (local.get $arg2)))
    (local.set $r (call $g2w (local.get $arg0)))
    (local.set $vx (f64.promote_f32 (f32.load offset=0 (local.get $v))))
    (local.set $vy (f64.promote_f32 (f32.load offset=4 (local.get $v))))
    (local.set $vz (f64.promote_f32 (f32.load offset=8 (local.get $v))))
    (local.set $nx (f64.promote_f32 (f32.load offset=0 (local.get $a))))
    (local.set $ny (f64.promote_f32 (f32.load offset=4 (local.get $a))))
    (local.set $nz (f64.promote_f32 (f32.load offset=8 (local.get $a))))
    (local.set $len (f64.sqrt (f64.add (f64.add (f64.mul (local.get $nx) (local.get $nx))
      (f64.mul (local.get $ny) (local.get $ny))) (f64.mul (local.get $nz) (local.get $nz)))))
    (if (f64.eq (local.get $len) (f64.const 0))
      (then (local.set $nx (f64.const 1)) (local.set $len (f64.const 1))))
    (local.set $nx (f64.div (local.get $nx) (local.get $len)))
    (local.set $ny (f64.div (local.get $ny) (local.get $len)))
    (local.set $nz (f64.div (local.get $nz) (local.get $len)))
    (local.set $c (call $host_math_cos (f64.promote_f32 (f32.reinterpret_i32 (local.get $arg3)))))
    (local.set $s (call $host_math_sin (f64.promote_f32 (f32.reinterpret_i32 (local.get $arg3)))))
    (local.set $k (f64.sub (f64.const 1) (local.get $c)))
    (local.set $dot (f64.add (f64.add (f64.mul (local.get $nx) (local.get $vx))
      (f64.mul (local.get $ny) (local.get $vy))) (f64.mul (local.get $nz) (local.get $vz))))
    ;; v' = v cos + (n x v) sin + n (n.v)(1 - cos)
    (local.set $x (f64.add (f64.add (f64.mul (local.get $vx) (local.get $c))
      (f64.mul (f64.sub (f64.mul (local.get $ny) (local.get $vz)) (f64.mul (local.get $nz) (local.get $vy))) (local.get $s)))
      (f64.mul (local.get $nx) (f64.mul (local.get $dot) (local.get $k)))))
    (local.set $y (f64.add (f64.add (f64.mul (local.get $vy) (local.get $c))
      (f64.mul (f64.sub (f64.mul (local.get $nz) (local.get $vx)) (f64.mul (local.get $nx) (local.get $vz))) (local.get $s)))
      (f64.mul (local.get $ny) (f64.mul (local.get $dot) (local.get $k)))))
    (local.set $z (f64.add (f64.add (f64.mul (local.get $vz) (local.get $c))
      (f64.mul (f64.sub (f64.mul (local.get $nx) (local.get $vy)) (f64.mul (local.get $ny) (local.get $vx))) (local.get $s)))
      (f64.mul (local.get $nz) (f64.mul (local.get $dot) (local.get $k)))))
    (local.set $len (f64.sqrt (f64.add (f64.add (f64.mul (local.get $x) (local.get $x))
      (f64.mul (local.get $y) (local.get $y))) (f64.mul (local.get $z) (local.get $z)))))
    (if (f64.eq (local.get $len) (f64.const 0))
      (then (local.set $x (f64.const 1)) (local.set $len (f64.const 1))))
    (f32.store offset=0 (local.get $r) (f32.demote_f64 (f64.div (local.get $x) (local.get $len))))
    (f32.store offset=4 (local.get $r) (f32.demote_f64 (f64.div (local.get $y) (local.get $len))))
    (f32.store offset=8 (local.get $r) (f32.demote_f64 (f64.div (local.get $z) (local.get $len))))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirect3D methods
  ;; ════════════════════════════════════════════════════════════

  ;; IDirect3D::QueryInterface(this, riid, ppvObj) — 3 args
  ;; Routes upgrades to v2/v3/v7 vtables on the same DX_OBJECTS slot.
  (func $handle_IDirect3D_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 1) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; AddRef/Release use the shared DX lifetime handlers via api_table aliases.

  ;; IDirect3D::Initialize(this, riid) — 2 args
  (func $handle_IDirect3D_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirect3D::EnumDevices(this, lpEnumDevicesCallback, lpUserArg) — 3 args
  ;; Invokes the callback once with a HAL device descriptor (shared with v2/v3).
  (func $handle_IDirect3D_EnumDevices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $d3d_enum_devices_invoke (local.get $arg1) (local.get $arg2) (local.get $ret_addr) (i32.const 1)))

  ;; IDirect3D::CreateLight — mirrors the IDirect3D3 pattern (DX type 24, vtbl D3DLIGHT)
  (func $handle_IDirect3D_CreateLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_create_child
      (local.get $arg1) (local.get $arg2)
      (i32.const 24) (global.get $DX_VTBL_D3DLIGHT)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D::CreateMaterial returns the legacy v1 material layout.
  ;; D3DRM calls GetHandle at vtable +0x18, which is not the v3 slot.
  (func $handle_IDirect3D_CreateMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 25) (global.get $DX_VTBL_D3DMAT1)))
    (if (i32.eqz (local.get $obj)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (call $gs32 (local.get $arg1) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D::CreateViewport — DX type 23, vtbl D3DVP1
  (func $handle_IDirect3D_CreateViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_create_child
      (local.get $arg1) (local.get $arg2)
      (i32.const 23) (global.get $DX_VTBL_D3DVP1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D::FindDevice — return a concrete legacy RGB device GUID. D3DRM
  ;; feeds result.guid back into surface QI to obtain IDirect3DDevice v1.
  (func $handle_IDirect3D_FindDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d_fill_find_device_result (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirect3D3 methods
  ;; ════════════════════════════════════════════════════════════

  ;; QueryInterface aliases IDirect3D_QueryInterface; AddRef/Release alias
  ;; the shared DX lifetime handlers in api_table.

  ;; IDirect3D3::EnumDevices(this, lpEnumDevicesCallback, lpUserArg) — 3 args
  (func $handle_IDirect3D3_EnumDevices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $d3d_enum_devices_invoke (local.get $arg1) (local.get $arg2) (local.get $ret_addr) (i32.const 3)))

  ;; IDirect3D3::CreateLight(this, lplpDirect3DLight, pUnkOuter) — 3 args
  (func $handle_IDirect3D3_CreateLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_create_child
      (local.get $arg1) (local.get $arg2)
      (i32.const 24) (global.get $DX_VTBL_D3DLIGHT)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D3::CreateMaterial(this, lplpDirect3DMaterial, pUnkOuter) — 3 args
  (func $handle_IDirect3D3_CreateMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 25) (global.get $DX_VTBL_D3DMAT3)))
    (if (i32.eqz (local.get $obj)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (call $gs32 (local.get $arg1) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D3::CreateViewport(this, lplpDirect3DViewport, pUnkOuter) — 3 args
  (func $handle_IDirect3D3_CreateViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_create_child
      (local.get $arg1) (local.get $arg2)
      (i32.const 23) (global.get $DX_VTBL_D3DVP3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3D3::FindDevice(this, lpD3DFDS, lpD3DFDR) — 3 args
  (func $handle_IDirect3D3_FindDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d_fill_find_device_result (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Device state block layout (guest heap, 1024 bytes, zero-init then defaults):
  ;;   +0    world matrix    (64 bytes, 4x4 f32, row-major D3D)
  ;;   +64   view matrix     (64)
  ;;   +128  projection      (64)
  ;;   +192  scratch matrix  (64)
  ;;   +256  render state   [256 × i32]  indexed by D3DRENDERSTATETYPE (max ~209)
  ;;   +1280... exceeds 1024 — we keep render-state at +256 size 768 bytes = 192 slots
  ;; Revised: allocate 2048 bytes; we have room.
  ;;   +0     matrices (4 × 64 = 256)
  ;;   +256   render state  [512 × i32]  (2048 bytes total when combined below)
  ;;   we'll use 2048 total: mats 256 + rstate 1024 + lightstate 512 + scratch 256.
  ;; Simpler layout used by handlers below:
  ;;   +0     4 matrices × 64 bytes = 256
  ;;   +256   render state: 512 i32 slots = 2048 bytes
  ;;   +2304  light state:  128 i32 slots = 512 bytes
  ;; → total 2816; round up to 4096.
  ;; D3DTRANSFORMSTATETYPE: 1=WORLD 2=VIEW 3=PROJECTION 4-6=WORLD1/2/3, 7+=TEXTURE0..
  ;; Map WORLD family → slot 0, VIEW → 1, PROJECTION → 2, else scratch slot 3.
  (func $d3ddev_matrix_slot (param $xform i32) (result i32)
    (if (i32.or (i32.eq (local.get $xform) (i32.const 1))
        (i32.or (i32.eq (local.get $xform) (i32.const 4))
        (i32.or (i32.eq (local.get $xform) (i32.const 5))
                (i32.eq (local.get $xform) (i32.const 6)))))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $xform) (i32.const 2)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $xform) (i32.const 3)) (then (return (i32.const 2))))
    (i32.const 3))

  (func $d3ddev_init_state (param $state_guest i32)
    (local $wa i32) (local $i i32)
    (local.set $wa (call $g2w (local.get $state_guest)))
    (call $zero_memory (local.get $wa) (i32.const 4096))
    ;; Identity matrices at world(+0), view(+64), projection(+128), scratch(+192).
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 4)))
      (f32.store (i32.add (local.get $wa) (i32.add (i32.mul (local.get $i) (i32.const 64)) (i32.const 0)))  (f32.const 1.0))
      (f32.store (i32.add (local.get $wa) (i32.add (i32.mul (local.get $i) (i32.const 64)) (i32.const 20))) (f32.const 1.0))
      (f32.store (i32.add (local.get $wa) (i32.add (i32.mul (local.get $i) (i32.const 64)) (i32.const 40))) (f32.const 1.0))
      (f32.store (i32.add (local.get $wa) (i32.add (i32.mul (local.get $i) (i32.const 64)) (i32.const 60))) (f32.const 1.0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    ;; Fixed-function depth defaults: writes enabled and LEQUAL comparison.
    ;; Keeping real defaults in the state block also lets an explicit
    ;; ZWRITEENABLE=FALSE remain distinguishable from an uninitialized slot.
    (i32.store offset=312 (local.get $wa) (i32.const 1))
    (i32.store offset=348 (local.get $wa) (i32.const 4)))

  ;; IDirect3D3::CreateDevice(this, refclsid, lpDDSurface, lplpD3DDevice, pUnkOuter) — 5 args
  ;; refclsid is the device-type GUID (HAL / RGB / etc). We ignore it and always
  ;; return a software RGB device. lpDDSurface is the render-target DD surface.
  ;; Device entry fields: +8 = current render-target slot, +12 = creator
  ;; D3D slot + 1 for GetDirect3D.
  (func $handle_IDirect3D3_CreateDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_create_device (local.get $arg0) (local.get $arg2) (local.get $arg3) (global.get $DX_VTBL_D3DDEV3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; Helper: given device "this", return guest addr of its state block (or 0).
  (func $d3ddev_state (param $this_guest i32) (result i32)
    (local $entry i32) (local $wa i32) (local $slot i32)
    (if (global.get $d3dim_state_override)
      (then (return (global.get $d3dim_state_override))))
    (local.set $wa (call $g2w (local.get $this_guest)))
    (local.set $slot (i32.load (i32.add (local.get $wa) (i32.const 4))))
    (if (i32.ge_u (local.get $slot) (global.get $DX_MAX)) (then
      (call $host_log_i32 (i32.const 0xD3DDBAD0))
      (call $host_log_i32 (local.get $this_guest))
      (call $host_log_i32 (local.get $slot))
      (return (i32.const 0))))
    (local.set $entry (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $slot) (i32.const 32))))
    (i32.load (i32.add (local.get $entry) (i32.const 16))))

  ;; IDirect3D3::CreateVertexBuffer(this, lpVBDesc, lplpD3DVertexBuffer, dwFlags, pUnkOuter) — 5 args
  (func $handle_IDirect3D3_CreateVertexBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_create_vb (local.get $arg1) (local.get $arg2) (global.get $DX_VTBL_D3DVB))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; IDirect3D3::EnumZBufferFormats(this, refclsid, lpCallback, lpContext)
  (func $handle_IDirect3D3_EnumZBufferFormats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (if (i32.eqz (local.get $arg2)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
      (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $d3d_enum_zbuf_invoke (local.get $arg2) (local.get $arg3) (local.get $ret_addr)))

  ;; IDirect3D3::EvictManagedTextures(this)
  (func $handle_IDirect3D3_EvictManagedTextures (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; ════════════════════════════════════════════════════════════
  ;; IDirectDrawFactory methods (from ddrawex.dll)
  ;; ════════════════════════════════════════════════════════════
  ;; CLSID_DirectDrawFactory = {4FD2A832-86C8-11D0-8FCA-00C04FD9189D}
  ;; IID_IDirectDrawFactory  = {4FD2A833-86C8-11D0-8FCA-00C04FD9189D} (ddrawex.h;
  ;; one above the CLSID. It was spelled ...823 here until 2026-10-06, and the
  ;; strict QueryInterface then refused every real caller: the four MFC theme
  ;; savers (CORBIS, FASHION, HORROR, WOTRAVEL) ask for ...833 and quit idle.)
  ;; The factory is a thin shim over DirectDrawCreate; CreateDirectDraw returns
  ;; the same IDirectDraw object DirectDrawCreate would, so reuses VTBL_DDRAW.

  ;; QueryInterface(this, riid, ppv) — 3 args
  (func $handle_IDirectDrawFactory_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IDirectDrawFactory {4FD2A833-86C8-11D0-8FCA-00C04FD9189D}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x4FD2A833) (i32.const 0x11D086C8)
      (i32.const 0xC000CA8F) (i32.const 0x9D18D94F)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; AddRef(this) — 1 arg

  ;; Release(this) — 1 arg
  (func $handle_IDirectDrawFactory_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.eqz (local.get $rc))
      (then (call $dx_free (local.get $entry))))
    (i32.store offset=0 (global.get $reg_base) (local.get $rc))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; CreateDirectDraw(this, pGUID, hWnd, dwCoopFlags, dwReserved, pUnkOuter, ppDirectDraw) — 6 args
  ;; The factory's coop level is supplied at creation time (vs DirectDrawCreate where SetCooperativeLevel
  ;; is called separately). We store hwnd in misc0 and ignore flags — the resulting IDirectDraw is
  ;; identical to what DirectDrawCreate yields.
  (func $handle_IDirectDrawFactory_CreateDirectDraw (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32) (local $entry_wa i32) (local $pp_dd i32)
    ;; ppDirectDraw is the 6th arg, beyond arg4 — read it from stack at ESP+24 (after this+5*arg).
    ;; Stack: [ESP]=ret, [ESP+4]=this, [ESP+8]=pGUID, [ESP+12]=hWnd, [ESP+16]=dwCoopFlags,
    ;;        [ESP+20]=dwReserved, [ESP+24]=pUnkOuter, [ESP+28]=ppDirectDraw
    (local.set $pp_dd (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (local.set $obj_guest (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))) ;; ret + this + 6 args
        (return)))
    ;; Stash hWnd in misc0 (DDraw entry layout: +8 = hwnd)
    (local.set $entry_wa (call $dx_from_this (local.get $obj_guest)))
    (i32.store (i32.add (local.get $entry_wa) (i32.const 8)) (local.get $arg2))
    (global.set $dx_ddraw_this (local.get $obj_guest))
    (call $dx_coop_hwnd_set (local.get $arg2))
    (call $gs32 (local.get $pp_dd) (local.get $obj_guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; DD_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; DirectDrawEnumerate(this, lpCallback, lpContext) — 2 args
  ;; Same payload as the standalone DirectDrawEnumerateA — fires once for the primary driver.
  ;; We can't share the helper easily (different ESP cleanup count), so inline a minimal version
  ;; that calls back with NULL guid and returns DD_OK without trampolining, since most callers
  ;; just care about the enumeration completing.
  (func $handle_IDirectDrawFactory_DirectDrawEnumerate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $desc i32) (local $desc_wa i32) (local $name i32) (local $name_wa i32) (local $ret_addr i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    ;; Pop this + 2 args + ret
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    ;; Build description/name strings
    (local.set $desc (call $heap_alloc (i32.const 32))) (local.set $desc_wa (call $g2w (local.get $desc)))
    (local.set $name (call $heap_alloc (i32.const 16))) (local.set $name_wa (call $g2w (local.get $name)))
    (i32.store   (local.get $desc_wa)           (i32.const 0x6d697250))
    (i32.store   offset=4  (local.get $desc_wa) (i32.const 0x20797261))
    (i32.store   offset=8  (local.get $desc_wa) (i32.const 0x70736944))
    (i32.store   offset=12 (local.get $desc_wa) (i32.const 0x2079616c))
    (i32.store   offset=16 (local.get $desc_wa) (i32.const 0x76697244))
    (i32.store16 offset=20 (local.get $desc_wa) (i32.const 0x7265))
    (i32.store8  offset=22 (local.get $desc_wa) (i32.const 0))
    (i32.store   (local.get $name_wa)           (i32.const 0x70736964))
    (i32.store   offset=4 (local.get $name_wa)  (i32.const 0x0079616c))
    ;; Save original return address so the existing $ddenum_ret_thunk path returns to caller
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    ;; Push callback args (right-to-left): lpContext, lpName, lpDesc, lpGUID(=NULL)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg2)) ;; lpContext
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $name))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $desc))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0)) ;; lpGUID = NULL
    ;; Push continuation thunk as callback's return addr
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $ddenum_ret_thunk))
    (global.set $eip (local.get $arg1))
    (global.set $steps (i32.const 0)))

  ;; ════════════════════════════════════════════════════════════
  ;; DirectAnimation IDispatch placeholders (danim.dll)
  ;; ════════════════════════════════════════════════════════════
  ;; The Plus!98 CORBIS/FASHION/HORROR/WOTRAVEL screensavers drive
  ;; DirectAnimation via OLE Automation. This is not a DA evaluator; it is a
  ;; small IDispatch-compatible object graph that lets those apps get past COM
  ;; activation and exposes member names in traces for the next compatibility
  ;; slices.

  (func $da_addref (param $this i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (store.field DxObject refcount (local.get $entry) (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (load.field DxObject refcount (local.get $entry)))

  (func $da_release (param $this i32) (result i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then (call $dx_free (local.get $entry))))
    (select (local.get $rc) (i32.const 0) (i32.gt_s (local.get $rc) (i32.const 0))))

  (func $da_iid_target_vtbl (param $iid_dword i32) (result i32)
    ;; DAView/DAStatics IIDs from the Plus!98 screensavers, plus common
    ;; DirectAnimation graph-node IIDs observed near the same typelib data.
    (if (i32.eq (local.get $iid_dword) (i32.const 0x283807B4))
      (then (return (global.get $DX_VTBL_DA_VIEW))))
    (if (i32.eq (local.get $iid_dword) (i32.const 0x542FB452))
      (then (return (global.get $DX_VTBL_DA_STATICS))))
    (if (i32.or
          (i32.or
            (i32.eq (local.get $iid_dword) (i32.const 0x283807B7))
            (i32.eq (local.get $iid_dword) (i32.const 0xC46C1BD3)))
          (i32.or
            (i32.eq (local.get $iid_dword) (i32.const 0xC46C1BC7))
            (i32.eq (local.get $iid_dword) (i32.const 0xC46C1BCD))))
      (then (return (global.get $DX_VTBL_DA_BEHAVIOR))))
    (if (i32.eq (local.get $iid_dword) (i32.const 0x4A933702))
      (then (return (global.get $DX_VTBL_DA_BEHAVIOR))))
    (i32.const 0))

  (func $da_qi (param $this i32) (param $riid i32) (param $ppv i32) (result i32)
    (local $iid_dword i32) (local $target_vtbl i32) (local $entry i32)
    (if (i32.eqz (local.get $ppv)) (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (local.set $iid_dword
      (if (result i32) (local.get $riid)
        (then (call $gl32 (local.get $riid)))
        (else (i32.const 0))))
    (local.set $target_vtbl (call $da_iid_target_vtbl (local.get $iid_dword)))
    ;; IUnknown, IDispatch, our two sentinel CLSIDs, and known DirectAnimation
    ;; direct interfaces used by the Plus!98 screensavers.
    (if (i32.or
          (i32.or
            (i32.eqz (local.get $iid_dword))
            (i32.eq (local.get $iid_dword) (i32.const 0x00020400)))
          (i32.or
            (i32.or (i32.eq (local.get $iid_dword) (i32.const 0xDA51DA01))
                    (i32.eq (local.get $iid_dword) (i32.const 0xDA57A71C)))
            (i32.ne (local.get $target_vtbl) (i32.const 0))))
      (then
        (if (local.get $target_vtbl)
          (then
            (local.set $entry (call $dx_from_this (local.get $this)))
            (call $gs32 (local.get $ppv)
              (call $dx_get_wrapper_for_vtbl
                (call $dx_slot_of (local.get $entry))
                (local.get $target_vtbl))))
          (else
            (call $gs32 (local.get $ppv) (local.get $this))))
        (drop (call $da_addref (local.get $this)))
        (return (i32.const 0))))
    (call $gs32 (local.get $ppv) (i32.const 0))
    (i32.const 0x80004002)) ;; E_NOINTERFACE

  (func $da_dispid_for_name (param $name_guest i32) (result i32)
    (local $name_wa i32)
    (if (i32.eqz (local.get $name_guest)) (then (return (i32.const 0x5000))))
    (local.set $name_wa (call $g2w (local.get $name_guest)))
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x31C0)) (then (return (i32.const 0x1001)))) ;; ImportImage
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x31D0)) (then (return (i32.const 0x1002)))) ;; ImportSound
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x31E0)) (then (return (i32.const 0x1003)))) ;; ModifiableBehavior
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x31F8)) (then (return (i32.const 0x1004)))) ;; NumberB
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x3200)) (then (return (i32.const 0x1005)))) ;; StringB
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x3208)) (then (return (i32.const 0x1006)))) ;; Compose2
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x3214)) (then (return (i32.const 0x1007)))) ;; DetectCollision
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x3228)) (then (return (i32.const 0x2001)))) ;; StartModel
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x3234)) (then (return (i32.const 0x2002)))) ;; Tick
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x323C)) (then (return (i32.const 0x2003)))) ;; Pause
    (if (call $wide_ascii_eq (local.get $name_wa) (i32.const 0x3244)) (then (return (i32.const 0x2004)))) ;; SetRenderTimeout
    ;; Stable enough for tracing and generic Invoke fallback: fold the first
    ;; two UTF-16 chars into a private DISPID range.
    (i32.or (i32.const 0x5000)
      (i32.and
        (i32.xor
          (i32.load16_u (local.get $name_wa))
          (i32.shl (i32.load16_u (i32.add (local.get $name_wa) (i32.const 2))) (i32.const 5)))
        (i32.const 0x0FFF))))

  (func $da_get_ids_of_names (param $rgszNames i32) (param $cNames i32) (param $rgDispId i32) (result i32)
    (local $i i32) (local $name_guest i32)
    (if (i32.eqz (local.get $rgDispId)) (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $cNames)))
      (local.set $name_guest
        (if (result i32) (local.get $rgszNames)
          (then (call $gl32 (i32.add (local.get $rgszNames) (i32.shl (local.get $i) (i32.const 2)))))
          (else (i32.const 0))))
      (call $gs32
        (i32.add (local.get $rgDispId) (i32.shl (local.get $i) (i32.const 2)))
        (call $da_dispid_for_name (local.get $name_guest)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (i32.const 0)) ;; S_OK

  (func $da_create_node (result i32)
    (call $dx_create_com_obj (i32.const 31) (global.get $DX_VTBL_DA_BEHAVIOR)))

  (func $da_write_out_node (param $out_ptr i32) (result i32)
    (local $obj_guest i32)
    (if (i32.eqz (local.get $out_ptr)) (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (local.set $obj_guest (call $da_create_node))
    (if (i32.eqz (local.get $obj_guest)) (then (return (i32.const 0x8007000E)))) ;; E_OUTOFMEMORY
    (call $gs32 (local.get $out_ptr) (local.get $obj_guest))
    (i32.const 0))

  (func $da_node_image_id (param $obj_guest i32) (result i32)
    (local $entry i32)
    (if (i32.eqz (local.get $obj_guest)) (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj_guest)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 31))
      (then (return (i32.const 0))))
    (load.field DxObject misc0 (local.get $entry)))

  (func $da_set_out_node_image (param $out_ptr i32) (param $image_id i32)
    (local $obj_guest i32) (local $entry i32)
    (if (i32.or (i32.eqz (local.get $out_ptr)) (i32.eqz (local.get $image_id)))
      (then (return)))
    (local.set $obj_guest (call $gl32 (local.get $out_ptr)))
    (if (i32.eqz (local.get $obj_guest)) (then (return)))
    (local.set $entry (call $dx_from_this (local.get $obj_guest)))
    (if (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 31))
      (then (store.field DxObject misc0 (local.get $entry) (local.get $image_id)))))

  (func $da_write_dispatch_variant (param $pVarResult i32) (result i32)
    (local $obj_guest i32) (local $result_wa i32)
    (if (i32.eqz (local.get $pVarResult)) (then (return (i32.const 0))))
    (local.set $result_wa (call $g2w (local.get $pVarResult)))
    (call $zero_memory (local.get $result_wa) (i32.const 16))
    (local.set $obj_guest (call $da_create_node))
    (if (i32.eqz (local.get $obj_guest)) (then (return (i32.const 0x8007000E)))) ;; E_OUTOFMEMORY
    (i32.store16 (local.get $result_wa) (i32.const 9)) ;; VT_DISPATCH
    (call $gs32 (i32.add (local.get $pVarResult) (i32.const 8)) (local.get $obj_guest))
    (i32.const 0))

  (func $da_invoke (param $this i32) (param $dispId i32) (param $wFlags i32) (param $pVarResult i32) (result i32)
    ;; Property puts and void-style DAView methods do not need a result.
    (if (i32.or
          (i32.and (local.get $wFlags) (i32.const 0x0C))
          (i32.and
            (i32.ge_u (local.get $dispId) (i32.const 0x2001))
            (i32.le_u (local.get $dispId) (i32.const 0x2004))))
      (then
        (if (local.get $pVarResult)
          (then (call $zero_memory (call $g2w (local.get $pVarResult)) (i32.const 16))))
        (return (i32.const 0))))
    (call $da_write_dispatch_variant (local.get $pVarResult)))

  (func $handle_IDirectAnimationDAView_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_qi (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectAnimationDAView_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_addref (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirectAnimationDAView_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_release (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirectAnimationDAView_GetTypeInfoCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectAnimationDAView_GetTypeInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; E_NOTIMPL
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectAnimationDAView_GetIDsOfNames (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_get_ids_of_names (local.get $arg2) (local.get $arg3) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
  (func $handle_IDirectAnimationDAView_Invoke (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_invoke
      (local.get $arg0)
      (local.get $arg1)
      (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40))))

  (func $handle_IDirectAnimationDAStatics_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_qi (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectAnimationDAStatics_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_addref (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirectAnimationDAStatics_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_release (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirectAnimationDAStatics_GetTypeInfoCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectAnimationDAStatics_GetTypeInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; E_NOTIMPL
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectAnimationDAStatics_GetIDsOfNames (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_get_ids_of_names (local.get $arg2) (local.get $arg3) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
  (func $handle_IDirectAnimationDAStatics_Invoke (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_invoke
      (local.get $arg0)
      (local.get $arg1)
      (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40))))

  (func $handle_IDirectAnimationDABehavior_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_qi (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectAnimationDABehavior_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_addref (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirectAnimationDABehavior_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_release (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IDirectAnimationDABehavior_GetTypeInfoCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IDirectAnimationDABehavior_GetTypeInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; E_NOTIMPL
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IDirectAnimationDABehavior_GetIDsOfNames (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_get_ids_of_names (local.get $arg2) (local.get $arg3) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
  (func $handle_IDirectAnimationDABehavior_Invoke (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_invoke
      (local.get $arg0)
      (local.get $arg1)
      (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40))))

  (func $da_view_direct_nargs (param $slot i32) (result i32)
    (if (i32.eq (local.get $slot) (i32.const 8)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $slot) (i32.const 12)) (then (return (i32.const 5))))
    (if (i32.or
          (i32.or (i32.eq (local.get $slot) (i32.const 15))
                  (i32.eq (local.get $slot) (i32.const 17)))
          (i32.eq (local.get $slot) (i32.const 21)))
      (then (return (i32.const 2))))
    (i32.const 1))

  (func $da_statics_direct_nargs (param $slot i32) (result i32)
    (if (i32.or (i32.eq (local.get $slot) (i32.const 18))
                (i32.eq (local.get $slot) (i32.const 32)))
      (then (return (i32.const 3))))
    (if (i32.or
          (i32.or
            (i32.or (i32.eq (local.get $slot) (i32.const 19))
                    (i32.eq (local.get $slot) (i32.const 65)))
            (i32.or (i32.eq (local.get $slot) (i32.const 67))
                    (i32.eq (local.get $slot) (i32.const 95))))
          (i32.or (i32.eq (local.get $slot) (i32.const 111))
                  (i32.eq (local.get $slot) (i32.const 347))))
      (then (return (i32.const 4))))
    (if (i32.or (i32.eq (local.get $slot) (i32.const 106))
                (i32.eq (local.get $slot) (i32.const 252)))
      (then (return (i32.const 2))))
    (i32.const 1))

  (func $da_behavior_direct_nargs (param $slot i32) (result i32)
    (if (i32.or
          (i32.or (i32.eq (local.get $slot) (i32.const 7))
                  (i32.eq (local.get $slot) (i32.const 12)))
          (i32.eq (local.get $slot) (i32.const 19)))
      (then (return (i32.const 2))))
    (if (i32.eq (local.get $slot) (i32.const 16))
      (then (return (i32.const 4))))
    (i32.const 1))

  (func $handle_IDirectAnimationDAView_DirectSlot (param $slot i32) (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $view_entry i32) (local $surface_guest i32) (local $surface_entry i32)
    (local $image_id i32) (local $rendered i32)
    (local.set $view_entry (call $dx_from_this (local.get $arg0)))
    ;; SetDirectDrawSurface(surface) binds the 800x600 offscreen surface which
    ;; the saver later GetDCs and StretchBlts to its 640x480 window.
    (if (i32.eq (local.get $slot) (i32.const 17))
      (then (store.field DxObject misc0 (local.get $view_entry) (local.get $arg1))))
    ;; StartModel(image, sound, ...) supplies the roots of the composed graph.
    ;; Preserve the first imported image identity propagated through either
    ;; root; host timeline selection advances across every resolved frame.
    (if (i32.eq (local.get $slot) (i32.const 12))
      (then
        (local.set $image_id (call $da_node_image_id (local.get $arg1)))
        (if (i32.eqz (local.get $image_id))
          (then (local.set $image_id (call $da_node_image_id (local.get $arg2)))))
        ;; RAW ON PURPOSE, and the gate agrees. +12 is a UNION: width+height for
        ;; a surface, one whole dword for everything else — here the DAView's
        ;; image id. `store.field DxObject width` would write two fields as one
        ;; and label an image id a width, byte-identically, so no oracle would
        ;; catch it. The access WIDTH is the only thing telling the arms apart,
        ;; and layout-migrate declines an i32 op against a u16 field for exactly
        ;; that reason. See the +12/+16 note at the head of this file.
        (i32.store (i32.add (local.get $view_entry) (i32.const 12)) (local.get $image_id))))
    ;; Tick(time, changed) evaluates the prepared image timeline directly into
    ;; the canonical DirectDraw DIB. The guest's following StretchBlt remains
    ;; responsible for presentation, exactly as in the original saver.
    (if (i32.eq (local.get $slot) (i32.const 8))
      (then
        (local.set $surface_guest (load.field DxObject misc0 (local.get $view_entry)))
        (if (local.get $surface_guest)
          (then
            (local.set $surface_entry (call $dx_from_this (local.get $surface_guest)))
            (local.set $rendered (call $host_da_image_blit
              ;; The DAView arm of +12 again — the image id stored above, read
              ;; back whole. Raw for the same reason, not an oversight.
              (i32.load (i32.add (local.get $view_entry) (i32.const 12)))
              (local.get $arg1) (local.get $arg2)
              (load.field DxObject misc1 (local.get $surface_entry))
              (load.field DxObject width (local.get $surface_entry))
              (load.field DxObject height (local.get $surface_entry))
              (load.field DxObject pitch (local.get $surface_entry))
              (load.field DxObject bpp (local.get $surface_entry))))))
        (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $rendered))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base))
        (i32.shl (i32.add (call $da_view_direct_nargs (local.get $slot)) (i32.const 1)) (i32.const 2)))))

  (func $handle_IDirectAnimationDAStatics_DirectSlot (param $slot i32) (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32) (local $image_id i32)
    (local.set $hr (i32.const 0))
    ;; Import/constructor methods return graph nodes through their final
    ;; out-parameter. Slots are from the shared Plus!98 MFC DirectAnimation
    ;; wrapper call sites.
    (if (i32.eq (local.get $slot) (i32.const 18))
      (then
        (local.set $hr (call $da_write_out_node (local.get $arg2)))
        (local.set $image_id (call $host_da_image_resolve (call $g2w (local.get $arg1))))
        (call $da_set_out_node_image (local.get $arg2) (local.get $image_id))))
    (if (i32.eq (local.get $slot) (i32.const 32))
      (then
        (local.set $hr (call $da_write_out_node (local.get $arg2)))
        (call $da_set_out_node_image (local.get $arg2)
          (call $da_node_image_id (local.get $arg1)))))
    (if (i32.eq (local.get $slot) (i32.const 19))
      (then
        (local.set $hr (call $da_write_out_node (local.get $arg3)))
        (local.set $image_id (call $host_da_image_resolve (call $g2w (local.get $arg1))))
        (call $da_set_out_node_image (local.get $arg3) (local.get $image_id))))
    (if (i32.or
          (i32.or
            (i32.or (i32.eq (local.get $slot) (i32.const 65))
                    (i32.eq (local.get $slot) (i32.const 67)))
            (i32.or (i32.eq (local.get $slot) (i32.const 95))
                    (i32.eq (local.get $slot) (i32.const 111))))
          (i32.eq (local.get $slot) (i32.const 347)))
      (then
        (local.set $hr (call $da_write_out_node (local.get $arg3)))
        (local.set $image_id (call $da_node_image_id (local.get $arg1)))
        (if (i32.eqz (local.get $image_id))
          (then (local.set $image_id (call $da_node_image_id (local.get $arg2)))))
        (call $da_set_out_node_image (local.get $arg3) (local.get $image_id))))
    (if (i32.or (i32.eq (local.get $slot) (i32.const 106))
                (i32.eq (local.get $slot) (i32.const 252)))
      (then (local.set $hr (call $da_write_out_node (local.get $arg1)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base))
        (i32.shl (i32.add (call $da_statics_direct_nargs (local.get $slot)) (i32.const 1)) (i32.const 2)))))

  (func $handle_IDirectAnimationDABehavior_DirectSlot (param $slot i32) (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32) (local $image_id i32)
    (local.set $hr (i32.const 0))
    (local.set $image_id (call $da_node_image_id (local.get $arg0)))
    (if (i32.eq (local.get $slot) (i32.const 7))
      (then
        (local.set $hr (call $da_write_out_node (local.get $arg1)))
        (call $da_set_out_node_image (local.get $arg1) (local.get $image_id))))
    (if (i32.eq (local.get $slot) (i32.const 16))
      (then
        (local.set $hr (call $da_write_out_node (local.get $arg3)))
        (call $da_set_out_node_image (local.get $arg3) (local.get $image_id))))
    (if (i32.eq (local.get $slot) (i32.const 19))
      (then
        (local.set $hr (call $da_write_out_node (local.get $arg1)))
        (call $da_set_out_node_image (local.get $arg1) (local.get $image_id))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base))
        (i32.shl (i32.add (call $da_behavior_direct_nargs (local.get $slot)) (i32.const 1)) (i32.const 2)))))

  ;; ── IMalloc returned by CoGetMalloc ─────────────────────────
  (func $handle_IMalloc_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_dword i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $iid_dword
      (if (result i32) (local.get $arg1)
        (then (call $gl32 (local.get $arg1)))
        (else (i32.const 0))))
    ;; IID_IUnknown or IID_IMalloc {00000002-0000-0000-C000-000000000046}
    (if (i32.or (i32.eqz (local.get $iid_dword))
                (i32.eq (local.get $iid_dword) (i32.const 0x00000002)))
      (then
        (call $gs32 (local.get $arg2) (local.get $arg0))
        (drop (call $da_addref (local.get $arg0)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; E_NOINTERFACE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IMalloc_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_addref (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IMalloc_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $da_release (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IMalloc_Alloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_alloc (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IMalloc_Realloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_realloc (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IMalloc_Free (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $heap_free (local.get $arg1))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IMalloc_GetSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Ownership is the arena's, not "below this instance's bump pointer": once
    ;; the allocator moves to another chunk every older live block used to
    ;; answer -1, and msvbvm60 does memset(p, 0, GetSize(p)) straight after
    ;; Alloc -- a 4 GB rep stosd that wiped the register file (JigSawedME).
    ;; HeapSize had the same bug; both now share $heap_block_size_checked.
    (local $size i32)
    (local.set $size (call $heap_block_size_checked (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base)
      (if (result i32) (local.get $size)
        (then (i32.sub (local.get $size) (i32.const 4)))
        (else (i32.const 0xFFFFFFFF))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IMalloc_DidAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (i32.ne (call $heap_block_size_checked (local.get $arg1)) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IMalloc_HeapMinimize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; ════════════════════════════════════════════════════════════
  ;; D3DIM Phase 0 — S_OK stubs (generated by scratch/gen-d3dim-phase0.js)
  ;; ════════════════════════════════════════════════════════════

  ;; ── IDirect3DDevice3 ─────────────────────────────────────────
  ;; IDirect3DDevice3::QueryInterface — routes upgrades across Device family (v1/v2/v3/v7).
  (func $handle_IDirect3DDevice3_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_qi (i32.const 2) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  (func $handle_IDirect3DDevice3_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_worker_fence)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_release (local.get $arg0)))






    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IDirect3DDevice3_GetCaps — 3 args (incl. this): (this, lpHWDesc, lpHELDesc)
  (func $handle_IDirect3DDevice3_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_fill_device_desc (local.get $arg1))
    (call $d3dim_fill_device_desc (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DDevice3_GetStats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_get_stats (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice3_AddViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_add_viewport (local.get $arg0) (local.get $arg1)))


    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice3_DeleteViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_delete_viewport (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice3_NextViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_next_viewport
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DDevice3_EnumTextureFormats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (if (i32.eqz (local.get $arg1)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $d3d_enum_tex_invoke (local.get $arg1) (local.get $arg2) (local.get $ret_addr)))

  (func $handle_IDirect3DDevice3_BeginScene (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_begin_scene (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DDevice3_EndScene (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_end_scene (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DDevice3_GetDirect3D (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_direct3d (local.get $arg0) (local.get $arg1) (global.get $DX_VTBL_D3D3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice3_SetCurrentViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; The viewport must already belong to this device through AddViewport;
    ;; the shared setter validates ownership and owns the current reference.




    (call $d3dim_set_current_viewport (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice3_GetCurrentViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_current_viewport (local.get $arg0) (local.get $arg1) (global.get $DX_VTBL_D3DVP3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice3_SetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_worker_fence)
    (call $d3dim_set_render_target (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DDevice3_GetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_render_target (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; ── Immediate mode: Begin / BeginIndexed / Vertex / Index / End ──
  ;;
  ;; This is a COMPLETE alternative way to draw, and none of it is
  ;; implemented. An app calls Begin, streams vertices through Vertex, then
  ;; End; every one of these returned S_OK and discarded its argument, so the
  ;; app drew nothing while every call reported success.
  ;;
  ;; That is the failure mode DrawIndexedPrimitiveVB had -- a silent-success
  ;; stub produces no trap, no unimplemented-API message and no wrong return
  ;; code, so the only symptom is missing geometry, which reads as a texture
  ;; or state bug anywhere but here. Diablo II's black ground cost a session
  ;; to that exact shape.
  ;;
  ;; So fail loudly instead, per the project rule: the next app that draws
  ;; this way names itself in the crash log instead of rendering blank. The
  ;; trap comes BEFORE the stack pop so the dump still shows the arguments.
  (func $handle_IDirect3DDevice3_Begin (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  (func $handle_IDirect3DDevice3_BeginIndexed (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  (func $handle_IDirect3DDevice3_Vertex (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  (func $handle_IDirect3DDevice3_Index (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  (func $handle_IDirect3DDevice3_End (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; GetRenderState(this, dwRenderStateType, lpdwRenderState) — 3 args
  (func $handle_IDirect3DDevice3_GetRenderState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32)
    (local.set $state (call $d3ddev_state (local.get $arg0)))
    (if (i32.and (i32.ne (local.get $state) (i32.const 0))
                 (i32.lt_u (local.get $arg1) (i32.const 512)))
      (then (call $gs32 (local.get $arg2)
              (call $gl32 (i32.add (local.get $state)
                (i32.add (i32.const 256) (i32.mul (local.get $arg1) (i32.const 4))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; SetRenderState(this, dwRenderStateType, dwRenderState) — 3 args
  (func $handle_IDirect3DDevice3_SetRenderState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Keep Device3 on the shared legacy fixed-pipeline path. In particular,
    ;; D3DRENDERSTATE_TEXTUREHANDLE (1) is also the stage-0 texture binding;
    ;; merely saving the render-state dword leaves indexed draws untextured.
    (call $d3dim_set_render_state (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetLightState(this, dwLightStateType, lpdwLightState) — 3 args
  (func $handle_IDirect3DDevice3_GetLightState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32)
    (local.set $state (call $d3ddev_state (local.get $arg0)))
    (if (i32.and (i32.ne (local.get $state) (i32.const 0))
                 (i32.lt_u (local.get $arg1) (i32.const 128)))
      (then (call $gs32 (local.get $arg2)
              (call $gl32 (i32.add (local.get $state)
                (i32.add (i32.const 2304) (i32.mul (local.get $arg1) (i32.const 4))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; SetLightState(this, dwLightStateType, dwLightState) — 3 args
  (func $handle_IDirect3DDevice3_SetLightState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32)
    (local.set $state (call $d3ddev_state (local.get $arg0)))
    (if (i32.and (i32.ne (local.get $state) (i32.const 0))
                 (i32.lt_u (local.get $arg1) (i32.const 128)))
      (then (call $gs32
              (i32.add (local.get $state)
                (i32.add (i32.const 2304) (i32.mul (local.get $arg1) (i32.const 4))))
              (local.get $arg2))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; SetTransform(this, dtstTransformStateType, lpD3DMATRIX) — 3 args
  ;; IDirect3DDevice3_SetTransform now dispatches to the canonical Device2
  ;; handler through api_table.json's "handler" field, exactly as the Device7
  ;; slot already did -- the wrapper that used to live here is gone. It was a
  ;; third copy of the same memcpy, and it had drifted in two ways that only
  ;; showed up from outside: it never unbound the execute-buffer matrix handle
  ;; for the slot it overwrote, so a later $d3dim_refresh_bound_matrix could
  ;; put the handle's matrix back over an explicit SetTransform; and it emitted
  ;; no trace, so a run whose API census counted 106 of these calls produced
  ;; not one Xform record and Half-Life's transform sequence read as pure
  ;; MultiplyTransform accumulation with no reset anywhere in it.

  ;; GetTransform(this, dtstTransformStateType, lpD3DMATRIX) — 3 args
  (func $handle_IDirect3DDevice3_GetTransform (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $slot i32)
    (local.set $state (call $d3ddev_state (local.get $arg0)))
    (if (i32.and (i32.ne (local.get $state) (i32.const 0)) (i32.ne (local.get $arg2) (i32.const 0))) (then
      (local.set $slot (call $d3ddev_matrix_slot (local.get $arg1)))
      (call $memcpy
        (call $g2w (local.get $arg2))
        (call $g2w (i32.add (local.get $state) (i32.mul (local.get $slot) (i32.const 64))))
        (i32.const 64))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DDevice3_MultiplyTransform (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_multiply_transform (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; IDirect3DDevice3::DrawPrimitive(primType, vertexTypeDesc, lpvVerts, dwVtxCount, dwFlags)
  ;; Device3 uses an FVF-style vertex descriptor. Pack it into the renderer's
  ;; canonical legacy layout. TEXCOORDINDEX selects which FVF coordinate set
  ;; feeds fixed-function stage 0.
  (func $handle_IDirect3DDevice3_DrawPrimitive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dwVertexCount i32) (local $vtxType i32) (local $packed i32)
    (local.set $dwVertexCount (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
    (local.set $vtxType (call $d3dim_fvf_vtxtype (local.get $arg2)))
    (call $host_dx_trace (i32.const 15) (local.get $arg1) (local.get $arg2)
      (local.get $dwVertexCount) (local.get $arg3))
    (local.set $packed
      (call $d3dim_pack_fvf_vertices
        (local.get $arg2) (local.get $arg3) (local.get $dwVertexCount)
        (call $d3dim_texcoord_index (local.get $arg0))))
    ;; The core queues on the render Worker when one is attached.
    (if (local.get $packed) (then
      (call $d3dim_draw_primitive (local.get $arg0) (local.get $arg1) (local.get $vtxType)
        (local.get $packed) (local.get $dwVertexCount))
      (call $heap_free (local.get $packed))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; Same eight-argument ABI as Device7, and the same FVF packing. Once the
  ;; two pops agreed these bodies were byte-identical, which the duplicate-WAT
  ;; gate caught; share one so a fix to either cannot drift by revision.
  (func $handle_IDirect3DDevice3_DrawIndexedPrimitive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice7_DrawIndexedPrimitive
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (local.get $name_ptr)))

  (func $handle_IDirect3DDevice3_SetClipStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_clip_status (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DDevice3_GetClipStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_clip_status (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Same six-argument ABI as Device7; the core queues on the render Worker.
  (func $handle_IDirect3DDevice3_DrawPrimitiveStrided (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice7_DrawPrimitiveStrided
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (local.get $name_ptr)))

  ;; Same eight-argument ABI as Device7.
  (func $handle_IDirect3DDevice3_DrawIndexedPrimitiveStrided (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice7_DrawIndexedPrimitiveStrided
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (local.get $name_ptr)))

  ;; IDirect3DDevice3::DrawPrimitiveVB(primType, lpVB, dwStartVertex,
  ;; dwNumVertices, dwFlags) — the same five arguments as the v7 form, so the
  ;; core takes $arg1..$arg4 straight through and the frame is 28 either way,
  ;; so share the v7 body rather than copy it.
  (func $handle_IDirect3DDevice3_DrawPrimitiveVB (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice7_DrawPrimitiveVB
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (local.get $name_ptr)))

  ;; IDirect3DDevice3::DrawIndexedPrimitiveVB(primType, lpVB, lpwIndices,
  ;; dwIndexCount, dwFlags) — 6 dwords with `this`, so 28. The v3 form has no
  ;; dwStartVertex/dwNumVertices; that pair is what makes the v7 form 8. This
  ;; popped 32, and four bytes is not a cosmetic error: the caller's epilogue
  ;; then pops one slot too high, `ret` takes the caller's first argument as a
  ;; return address, and the guest jumps to whatever that was. Diablo II's
  ;; Direct3D backend hits this during the Act I load and lands on 0x140 or
  ;; 0x280 -- its own screen coordinates, 320 and 640.
  ;;
  ;; Fixing that pop stopped the crash and left the body empty: it returned
  ;; S_OK and drew nothing. That is a silent-success stub, and it is why the
  ;; symptom was a *picture* rather than a trap -- Diablo II batches its floor
  ;; tiles through this entry point (d2direct3d+0x6457, vtable slot 35, a
  ;; TRIANGLELIST of 150 indices over a vertex buffer it Locks) while sprites
  ;; go through DrawPrimitive, which was implemented. So the units, the HUD
  ;; and the text all drew and the ground stayed black.
  ;;
  ;; The v3 form has no dwStartVertex/dwNumVertices, so the whole buffer is in
  ;; play: pass start 0 and a count the core clamps down to the buffer's real
  ;; capacity (size/stride), which is exactly what its `count > max - start`
  ;; guard is for.
  (func $handle_IDirect3DDevice3_DrawIndexedPrimitiveVB (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_vb_draw_indexed_primitive
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0) (i32.const -1)
      (local.get $arg3) (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_IDirect3DDevice3_ComputeSphereVisibility (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $out i32) (local $i i32)
    (local.set $out (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (if (local.get $out) (then
      (block $done (loop $lp
        (br_if $done (i32.ge_u (local.get $i) (local.get $arg3)))
        (call $gs32 (i32.add (local.get $out) (i32.mul (local.get $i) (i32.const 4))) (i32.const 0))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $lp)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_IDirect3DDevice3_GetTexture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_texture (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DDevice3_SetTexture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_texture (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DDevice3_GetTextureStageState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_get_tss (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DDevice3_SetTextureStageState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_set_tss (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DDevice3_ValidateDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 1))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; ── IDirect3DViewport3 ─────────────────────────────────────────
  ;; QueryInterface aliases IDirect3DViewport_QueryInterface.

  (func $handle_IDirect3DViewport3_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (call $d3dim_viewport_release_owned (local.get $arg0))
        (call $dx_free (local.get $entry))))
    (i32.store offset=0 (global.get $reg_base) (select (local.get $rc) (i32.const 0) (i32.gt_s (local.get $rc) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DViewport3_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_GetViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_get (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_SetViewport (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_set (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_TransformVertices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4)
      (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IDirect3DViewport3_LightElements (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) ;; E_NOTIMPL / DDERR_UNSUPPORTED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DViewport3_SetBackground (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_set_background (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_GetBackground (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_get_background (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DViewport3_SetBackgroundDepth (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_GetBackgroundDepth (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Clear(this, dwCount, lpRects, dwFlags) — 4 args. No color/z (uses background).
  ;; $d3dim_viewport_clear_full fences itself whenever the clear stays in
  ;; software; with the GPU executor a fence here would read back a frame
  ;; for a clear the GPU is about to take.
  (func $handle_IDirect3DViewport3_Clear (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $d3dim_gpu_on)) (then (call $d3dim_worker_fence)))
    (call $d3dim_viewport_clear_full (local.get $arg0) (local.get $arg3)
      (call $d3dim_viewport_background_color (local.get $arg0)) (f32.const 1.0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DViewport3_AddLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_add_light (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_DeleteLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_delete_light (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_NextLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_viewport_next_light
        (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirect3DViewport3_GetViewport2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_get2 (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_SetViewport2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_viewport_set2 (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_SetBackgroundDepth2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DViewport3_GetBackgroundDepth2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Clear2(this, dwCount, lpRects, dwFlags, dwColor, dvZ, dwStencil) — 6 args + this.
  ;; arg3=dwFlags, arg4=dwColor; dvZ and dwStencil are deeper on the stack.
  (func $handle_IDirect3DViewport3_Clear2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dvZ_bits i32)
    (if (i32.eqz (global.get $d3dim_gpu_on)) (then (call $d3dim_worker_fence)))
    ;; dvZ sits 1 dword past arg4 on the caller stack: [retaddr][a0][a1][a2][a3][a4=dwColor][dvZ][stencil]
    ;; esp currently still points at retaddr (we haven't popped yet).
    (local.set $dvZ_bits (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (call $d3dim_viewport_clear_full
      (local.get $arg0) (local.get $arg3) (local.get $arg4)
      (f32.reinterpret_i32 (local.get $dvZ_bits)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; ── IDirect3DLight ─────────────────────────────────────────
  ;; Each Light slot owns a 76-byte D3DLIGHT buffer on the guest heap;
  ;; its guest pointer lives at DX_OBJECTS entry +8 (misc0). Lazy-allocated
  ;; on first SetLight so CreateLight stays cheap for apps that never
  ;; configure a light.
  (func $dx_light_buf (param $entry i32) (result i32)
    (local $g i32)
    (local.set $g (load.field DxObject misc0 (local.get $entry)))
    (if (i32.eqz (local.get $g)) (then
      (local.set $g (call $heap_alloc (i32.const 76)))
      (if (local.get $g) (then
        (call $zero_memory (call $g2w (local.get $g)) (i32.const 76))
        (store.field DxObject misc0 (local.get $entry) (local.get $g))))))
    (local.get $g))

  (func $handle_IDirect3DLight_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $d3dim_child_qi (i32.const 7) (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  (func $handle_IDirect3DLight_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rc i32) (local $buf i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (local.set $buf (load.field DxObject misc0 (local.get $entry)))
        (if (local.get $buf) (then
          (call $heap_free (local.get $buf))
          (store.field DxObject misc0 (local.get $entry) (i32.const 0))))
        (call $dx_free (local.get $entry))))
    (i32.store offset=0 (global.get $reg_base) (select (local.get $rc) (i32.const 0) (i32.gt_s (local.get $rc) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Initialize(this, lpDirect3D) — advisory. Keep S_OK; the v1 glue is vestigial.
  (func $handle_IDirect3DLight_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; SetLight(this, lpLight) — copy caller's D3DLIGHT (first dword is dwSize) into
  ;; our per-slot buffer. Clamp to 76 (full D3DLIGHT2) to keep older/shorter
  ;; D3DLIGHT structs safe.
  (func $handle_IDirect3DLight_SetLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $buf i32) (local $dwSize i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $buf (call $dx_light_buf (local.get $entry)))
    (if (local.get $arg1) (then
      (if (local.get $buf) (then
        (local.set $dwSize (call $gl32 (local.get $arg1)))
        (if (i32.gt_u (local.get $dwSize) (i32.const 76)) (then (local.set $dwSize (i32.const 76))))
        (if (i32.lt_u (local.get $dwSize) (i32.const 4)) (then (local.set $dwSize (i32.const 76))))
        (call $memcpy
          (call $g2w (local.get $buf))
          (call $g2w (local.get $arg1))
          (local.get $dwSize))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetLight(this, lpLight) — caller provides D3DLIGHT* with dwSize prefilled.
  ;; Copy back min(dwSize, 76) bytes from our buffer. If no SetLight ever ran,
  ;; our buffer stays zeroed except the caller-visible dwSize echo.
  (func $handle_IDirect3DLight_GetLight (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $buf i32) (local $dwSize i32) (local $out_wa i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $buf (load.field DxObject misc0 (local.get $entry)))
    (if (local.get $arg1) (then (local.set $out_wa (call $g2w (local.get $arg1)))
      (local.set $dwSize (i32.load (local.get $out_wa)))
      (if (i32.gt_u (local.get $dwSize) (i32.const 76)) (then (local.set $dwSize (i32.const 76))))
      (if (i32.lt_u (local.get $dwSize) (i32.const 4)) (then (local.set $dwSize (i32.const 76))))
      (if (local.get $buf)
        (then
          (call $memcpy
            (local.get $out_wa)
            (call $g2w (local.get $buf))
            (local.get $dwSize)))
        (else
          ;; No stored light yet — zero the caller buffer then restore dwSize.
          (call $zero_memory (local.get $out_wa) (local.get $dwSize))
          (i32.store (local.get $out_wa) (local.get $dwSize))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; ── IDirect3DMaterial3 ─────────────────────────────────────────
  ;; QueryInterface aliases IDirect3DMaterial_QueryInterface.



  (func $handle_IDirect3DMaterial3_SetMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_set (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DMaterial3_GetMaterial (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_get (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirect3DMaterial3_GetHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3dim_material_get_handle (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirect3DMaterial3_Reserved1 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IDirect3DMaterial3_Reserved2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Video for Windows ICM (ICOpen/ICInfo/ICClose...) lives in 09a7g-video-icm.wat.

  ;; DirectPlay4 Unicode local interface. Names keep an optional lossless W
  ;; mirror; the established ANSI table/network representation is unchanged.
  (global $dpw_names (mut i32) (i32.const 0))
  (global $dpw_provider (mut i32) (i32.const 0))
  (func $dpw_owner (param $obj i32) (result i32)
    (i32.add (global.get $image_base)
      (i32.sub (i32.add (global.get $COM_WRAPPERS)
        (i32.mul (call $dx_slot_of (call $dx_from_this (local.get $obj))) (i32.const 8)))
        (global.get $GUEST_BASE))))
  (func $dpw_decode1252 (param $c i32) (result i32)
    (if (i32.eq (local.get $c) (i32.const 128)) (then (return (i32.const 8364))))
    (if (i32.eq (local.get $c) (i32.const 129)) (then (return (i32.const 129))))
    (if (i32.eq (local.get $c) (i32.const 130)) (then (return (i32.const 8218))))
    (if (i32.eq (local.get $c) (i32.const 131)) (then (return (i32.const 402))))
    (if (i32.eq (local.get $c) (i32.const 132)) (then (return (i32.const 8222))))
    (if (i32.eq (local.get $c) (i32.const 133)) (then (return (i32.const 8230))))
    (if (i32.eq (local.get $c) (i32.const 134)) (then (return (i32.const 8224))))
    (if (i32.eq (local.get $c) (i32.const 135)) (then (return (i32.const 8225))))
    (if (i32.eq (local.get $c) (i32.const 136)) (then (return (i32.const 710))))
    (if (i32.eq (local.get $c) (i32.const 137)) (then (return (i32.const 8240))))
    (if (i32.eq (local.get $c) (i32.const 138)) (then (return (i32.const 352))))
    (if (i32.eq (local.get $c) (i32.const 139)) (then (return (i32.const 8249))))
    (if (i32.eq (local.get $c) (i32.const 140)) (then (return (i32.const 338))))
    (if (i32.eq (local.get $c) (i32.const 141)) (then (return (i32.const 141))))
    (if (i32.eq (local.get $c) (i32.const 142)) (then (return (i32.const 381))))
    (if (i32.eq (local.get $c) (i32.const 143)) (then (return (i32.const 143))))
    (if (i32.eq (local.get $c) (i32.const 144)) (then (return (i32.const 144))))
    (if (i32.eq (local.get $c) (i32.const 145)) (then (return (i32.const 8216))))
    (if (i32.eq (local.get $c) (i32.const 146)) (then (return (i32.const 8217))))
    (if (i32.eq (local.get $c) (i32.const 147)) (then (return (i32.const 8220))))
    (if (i32.eq (local.get $c) (i32.const 148)) (then (return (i32.const 8221))))
    (if (i32.eq (local.get $c) (i32.const 149)) (then (return (i32.const 8226))))
    (if (i32.eq (local.get $c) (i32.const 150)) (then (return (i32.const 8211))))
    (if (i32.eq (local.get $c) (i32.const 151)) (then (return (i32.const 8212))))
    (if (i32.eq (local.get $c) (i32.const 152)) (then (return (i32.const 732))))
    (if (i32.eq (local.get $c) (i32.const 153)) (then (return (i32.const 8482))))
    (if (i32.eq (local.get $c) (i32.const 154)) (then (return (i32.const 353))))
    (if (i32.eq (local.get $c) (i32.const 155)) (then (return (i32.const 8250))))
    (if (i32.eq (local.get $c) (i32.const 156)) (then (return (i32.const 339))))
    (if (i32.eq (local.get $c) (i32.const 157)) (then (return (i32.const 157))))
    (if (i32.eq (local.get $c) (i32.const 158)) (then (return (i32.const 382))))
    (if (i32.eq (local.get $c) (i32.const 159)) (then (return (i32.const 376))))
    (local.get $c))
  (func $dpw_encode1252 (param $c i32) (result i32)
    (local $i i32)
    (block $none (loop $scan
      (br_if $none (i32.ge_u (local.get $i) (i32.const 256)))
      (if (i32.eq (call $dpw_decode1252 (local.get $i)) (local.get $c))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    (i32.const 63))
  ;; mode0=A->W, mode1=W->W, mode2=W->A. Independent allocations let the
  ;; established dp_free_name own every pointer. Reject overflow/overlong data.
  (func $dpw_clone_string (param $src i32) (param $mode i32) (result i32)
    (local $n i32) (local $i i32) (local $j i32) (local $c i32)
    (local $stride i32) (local $out_stride i32) (local $p i32) (local $out i32)
    (if (i32.eqz (local.get $src)) (then (return (i32.const 0))))
    (local.set $stride (select (i32.const 2) (i32.const 1) (local.get $mode)))
    (local.set $out_stride (select (i32.const 1) (i32.const 2) (i32.eq (local.get $mode) (i32.const 2))))
    (block $sized (loop $size
      (if (i32.ge_u (local.get $n) (i32.const 4096)) (then (return (i32.const 0))))
      (local.set $p (i32.add (local.get $src) (i32.mul (local.get $n) (local.get $stride))))
      (if (i32.or (i32.lt_u (local.get $p) (local.get $src))
        (i32.and (i32.eq (local.get $stride) (i32.const 2)) (i32.eq (local.get $p) (i32.const -1))))
        (then (return (i32.const 0))))
      (local.set $c (if (result i32) (local.get $mode)
        (then (call $gl16 (local.get $p))) (else (call $gl8 (local.get $p)))))
      (br_if $sized (i32.eqz (local.get $c)))
      (local.set $n (i32.add (local.get $n) (i32.const 1))) (br $size)))
    (local.set $out (call $heap_alloc (i32.mul (i32.add (local.get $n) (i32.const 1)) (local.get $out_stride))))
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $p (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $stride))))
      (local.set $c (if (result i32) (local.get $mode)
        (then (call $gl16 (local.get $p))) (else (call $dpw_decode1252 (call $gl8 (local.get $p))))))
      (if (i32.eq (local.get $mode) (i32.const 2))
        (then
          ;; One replacement for a valid unrepresentable surrogate pair.
          (if (i32.and (i32.and (i32.ge_u (local.get $c) (i32.const 0xD800)) (i32.le_u (local.get $c) (i32.const 0xDBFF)))
                (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $n)))
            (then (local.set $p (call $gl16 (i32.add (local.get $p) (i32.const 2))))
              (if (i32.and (i32.ge_u (local.get $p) (i32.const 0xDC00)) (i32.le_u (local.get $p) (i32.const 0xDFFF)))
                (then (local.set $i (i32.add (local.get $i) (i32.const 1)))))))
          (call $gs8 (i32.add (local.get $out) (local.get $j)) (call $dpw_encode1252 (local.get $c))))
        (else (call $gs16 (i32.add (local.get $out) (i32.mul (local.get $j) (i32.const 2))) (local.get $c))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $copy)))
    (if (i32.eq (local.get $out_stride) (i32.const 2))
      (then (call $gs16 (i32.add (local.get $out) (i32.mul (local.get $j) (i32.const 2))) (i32.const 0)))
      (else (call $gs8 (i32.add (local.get $out) (local.get $j)) (i32.const 0))))
    (local.get $out))
  (func $dpw_clone_name (param $src i32) (param $mode i32) (result i32)
    (local $name i32) (local $i i32) (local $p i32) (local $copy i32)
    (if (local.get $src)
      (then (if (i32.or (i32.gt_u (local.get $src) (i32.const -16))
                  (i32.ne (call $gl32 (local.get $src)) (i32.const 16)))
        (then (return (i32.const 0))))))
    (local.set $name (call $heap_alloc (i32.const 16)))
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    (call $zero_memory (call $g2w (local.get $name)) (i32.const 16))
    (call $gs32 (local.get $name) (i32.const 16))
    (if (local.get $src) (then
      (call $gs32 (i32.add (local.get $name) (i32.const 4)) (call $gl32 (i32.add (local.get $src) (i32.const 4))))
      (local.set $i (i32.const 8))
      (loop $fields
        (local.set $p (call $gl32 (i32.add (local.get $src) (local.get $i))))
        (if (local.get $p) (then
          (local.set $copy (call $dpw_clone_string (local.get $p) (local.get $mode)))
          (if (i32.eqz (local.get $copy))
            (then (call $dp_free_name (local.get $name)) (return (i32.const 0))))
          (call $gs32 (i32.add (local.get $name) (local.get $i)) (local.get $copy))))
        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br_if $fields (i32.lt_u (local.get $i) (i32.const 16))))))
    (local.get $name))
  (func $dpw_side (param $entry i32) (param $create i32) (result i32)
    (if (i32.and (i32.eqz (global.get $dpw_names)) (local.get $create)) (then
      (global.set $dpw_names (call $heap_alloc (i32.mul (global.get $DP_ENTITY_MAX) (i32.const 4))))
      (if (global.get $dpw_names) (then (call $zero_memory (call $g2w (global.get $dpw_names)) (i32.mul (global.get $DP_ENTITY_MAX) (i32.const 4)))))))
    (if (i32.eqz (global.get $dpw_names)) (then (return (i32.const 0))))
    (i32.add (global.get $dpw_names) (i32.mul (i32.div_u (i32.sub (local.get $entry) (global.get $dp_entity_table)) (global.get $DP_ENTITY_STRIDE)) (i32.const 4))))
  (func $dpw_forget (param $entry i32)
    (local $slot i32) (local $name i32)
    (local.set $slot (call $dpw_side (local.get $entry) (i32.const 0)))
    (if (local.get $slot) (then
      (local.set $name (call $gl32 (local.get $slot)))
      (if (local.get $name) (then (call $dp_free_name (local.get $name))))
      (call $gs32 (local.get $slot) (i32.const 0)))))
  (func $dpw_snapshot (param $entry i32) (result i32)
    (local $slot i32) (local $name i32)
    (local.set $slot (call $dpw_side (local.get $entry) (i32.const 0)))
    (if (local.get $slot) (then (local.set $name (call $gl32 (local.get $slot)))))
    (if (local.get $name) (then (return (call $dpw_clone_name (local.get $name) (i32.const 1)))))
    (if (i32.ne (global.get $ansi_code_page) (i32.const 1252)) (then (return (i32.const 0))))
    (call $dpw_clone_name (call $gl32 (i32.add (local.get $entry) (i32.const 8))) (i32.const 0)))
  (func $dpw_get_name (param $id i32) (param $type i32) (param $out i32) (param $size_ptr i32) (result i32)
    (local $entry i32) (local $name i32) (local $a i32) (local $b i32)
    (local $na i32) (local $nb i32) (local $need i32) (local $cap i32) (local $cur i32)
    (if (i32.eqz (local.get $size_ptr)) (then (return (i32.const 0x80070057))))
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry)) (then (call $gs32 (local.get $size_ptr) (i32.const 0)) (return (call $dp_invalid_entity (local.get $type)))))
    (if (i32.ne (global.get $ansi_code_page) (i32.const 1252)) (then (return (i32.const 0x80004001))))
    (local.set $name (call $dpw_snapshot (local.get $entry)))
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0x8007000E))))
    (local.set $a (call $gl32 (i32.add (local.get $name) (i32.const 8))))
    (local.set $b (call $gl32 (i32.add (local.get $name) (i32.const 12))))
    (if (local.get $a) (then (local.set $na (i32.mul (i32.add (call $guest_wcslen (local.get $a)) (i32.const 1)) (i32.const 2)))))
    (if (local.get $b) (then (local.set $nb (i32.mul (i32.add (call $guest_wcslen (local.get $b)) (i32.const 1)) (i32.const 2)))))
    (local.set $need (i32.add (i32.const 16) (i32.add (local.get $na) (local.get $nb))))
    (local.set $cap (call $gl32 (local.get $size_ptr))) (call $gs32 (local.get $size_ptr) (local.get $need))
    (if (i32.or (i32.eqz (local.get $out)) (i32.lt_u (local.get $cap) (local.get $need)))
      (then (call $dp_free_name (local.get $name)) (return (i32.const 0x8877001E))))
    (if (i32.lt_u (i32.add (local.get $out) (i32.sub (local.get $need) (i32.const 1))) (local.get $out))
      (then (call $dp_free_name (local.get $name)) (return (i32.const 0x80070057))))
    (call $gs32 (local.get $out) (i32.const 16))
    (call $gs32 (i32.add (local.get $out) (i32.const 4)) (call $gl32 (i32.add (local.get $name) (i32.const 4))))
    (call $gs32 (i32.add (local.get $out) (i32.const 8)) (i32.const 0))
    (call $gs32 (i32.add (local.get $out) (i32.const 12)) (i32.const 0))
    (local.set $cur (i32.add (local.get $out) (i32.const 16)))
    (if (local.get $na) (then
      (call $gs32 (i32.add (local.get $out) (i32.const 8)) (local.get $cur))
      (call $guest_memmove (local.get $cur) (local.get $a) (local.get $na))
      (local.set $cur (i32.add (local.get $cur) (local.get $na)))))
    (if (local.get $nb) (then
      (call $gs32 (i32.add (local.get $out) (i32.const 12)) (local.get $cur))
      (call $guest_memmove (local.get $cur) (local.get $b) (local.get $nb))))
    (call $dp_free_name (local.get $name)) (i32.const 0))
  (func $dpw_set_name (param $id i32) (param $type i32) (param $src i32) (result i32)
    (local $entry i32) (local $w i32) (local $a i32) (local $slot i32)
    (if (i32.or (global.get $dpn_state) (i32.ne (global.get $ansi_code_page) (i32.const 1252))) (then (return (i32.const 0x80004001))))
    (local.set $entry (call $dp_find_entity (local.get $id) (local.get $type)))
    (if (i32.eqz (local.get $entry)) (then (return (call $dp_invalid_entity (local.get $type)))))
    (local.set $w (call $dpw_clone_name (local.get $src) (i32.const 1)))
    (if (i32.eqz (local.get $w)) (then (return (i32.const 0x8007000E))))
    (local.set $a (call $dpw_clone_name (local.get $w) (i32.const 2)))
    (local.set $slot (call $dpw_side (local.get $entry) (i32.const 1)))
    (if (i32.or (i32.eqz (local.get $a)) (i32.eqz (local.get $slot))) (then
      (call $dp_free_name (local.get $w)) (call $dp_free_name (local.get $a)) (return (i32.const 0x8007000E))))
    (call $dpw_forget (local.get $entry))
    (call $dp_free_name (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $a))
    (call $gs32 (local.get $slot) (local.get $w)) (i32.const 0))
  (func $dpw_create (param $out i32) (param $src i32) (param $data i32) (param $size i32) (param $flags i32) (param $type i32) (result i32)
    (local $w i32) (local $a i32) (local $entry i32) (local $slot i32) (local $hr i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80070057))))
    (call $gs32 (local.get $out) (i32.const 0))
    ;; A network session is fine: the entity keeps its 1252 name for the wire
    ;; (the caller announces it, as the ANSI path does) and the W name rides
    ;; along as the lossless local mirror.
    (if (i32.ne (global.get $ansi_code_page) (i32.const 1252)) (then (return (i32.const 0x80004001))))
    (local.set $w (call $dpw_clone_name (local.get $src) (i32.const 1)))
    (if (i32.eqz (local.get $w)) (then (return (i32.const 0x8007000E))))
    (local.set $a (call $dpw_clone_name (local.get $w) (i32.const 2)))
    (if (i32.eqz (local.get $a)) (then (call $dp_free_name (local.get $w)) (return (i32.const 0x8007000E))))
    (local.set $hr (call $dp_create_entity (local.get $out) (local.get $a) (local.get $data) (local.get $size) (local.get $flags) (local.get $type)))
    (call $dp_free_name (local.get $a))
    (if (local.get $hr) (then (call $dp_free_name (local.get $w)) (return (local.get $hr))))
    (local.set $entry (call $dp_find_entity (call $gl32 (local.get $out)) (local.get $type)))
    (local.set $slot (call $dpw_side (local.get $entry) (i32.const 1)))
    (if (i32.eqz (local.get $slot)) (then
      (drop (call $dp_destroy_entity (call $gl32 (local.get $out)) (local.get $type)))
      (call $gs32 (local.get $out) (i32.const 0)) (call $dp_free_name (local.get $w)) (return (i32.const 0x8007000E))))
    (call $gs32 (local.get $slot) (local.get $w)) (i32.const 0))

  (func $dpw_wrapper_locked (param $slot i32) (param $vtbl_guest i32) (result i32)
    (local $primary_wa i32) (local $aux_wa i32) (local $i i32) (local $n i32)
    (local.set $primary_wa (i32.add (global.get $COM_WRAPPERS)
      (i32.mul (local.get $slot) (i32.const 8))))
    ;; Primary hit?
    (if (i32.eq (i32.load (local.get $primary_wa)) (local.get $vtbl_guest)) (then
      (return (i32.add (i32.sub (local.get $primary_wa) (global.get $GUEST_BASE))
                       (global.get $image_base)))))
    ;; Scan aux pool for (vtbl, slot) match.
    (local.set $n (i32.load (global.get $COM_AUX_NEXT_SHARED)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $aux_wa (i32.add (global.get $COM_WRAPPERS_AUX)
        (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.and
            (i32.eq (i32.load (local.get $aux_wa)) (local.get $vtbl_guest))
            (i32.eq (i32.load (i32.add (local.get $aux_wa) (i32.const 4))) (local.get $slot)))
        (then (return (i32.add (i32.sub (local.get $aux_wa) (global.get $GUEST_BASE))
                               (global.get $image_base)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    ;; Miss — bump allocate.
    (if (i32.ge_u (local.get $n) (global.get $COM_WRAPPERS_AUX_MAX)) (then
      (return (i32.const 0))))
    (local.set $aux_wa (i32.add (global.get $COM_WRAPPERS_AUX)
      (i32.mul (local.get $n) (i32.const 8))))
    (i32.store (local.get $aux_wa) (local.get $vtbl_guest))
    (i32.store (i32.add (local.get $aux_wa) (i32.const 4)) (local.get $slot))
    (i32.store (global.get $COM_AUX_NEXT_SHARED) (i32.add (local.get $n) (i32.const 1)))
    (i32.add (i32.sub (local.get $aux_wa) (global.get $GUEST_BASE))
             (global.get $image_base)))
  (func $dpw_query (param $obj i32) (param $out i32) (result i32)
    (local $w i32)
    (call $lock_acquire (global.get $LOCK_DX))
    (local.set $w (call $dpw_wrapper_locked (call $dx_slot_of (call $dx_from_this (local.get $obj))) (global.get $DX_VTBL_DPLAY4W)))
    (call $lock_release (global.get $LOCK_DX))
    (if (i32.eqz (local.get $w)) (then (call $gs32 (local.get $out) (i32.const 0)) (return (i32.const 0x8007000E))))
    (call $dx_query_interface_result (local.get $w) (local.get $out) (i32.const 1)))

  (func $dpw_enum_begin
      (param $ret_addr i32) (param $callback i32) (param $context i32)
      (param $type i32) (param $membership_bit i32) (param $flags i32)
      (param $filter_membership i32)
    (local $frame i32)
    (local.set $frame (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 40)))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (i32.const 0))
    (call $gs32 (local.get $frame) (i32.const 0x4E455044)) ;; 'DPEN'
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $ret_addr))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $callback))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $context))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (local.get $type))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (local.get $membership_bit))
    (call $gs32 (i32.add (local.get $frame) (i32.const 28)) (local.get $flags))
    (call $gs32 (i32.add (local.get $frame) (i32.const 32)) (local.get $filter_membership))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (call $gs32 (i32.add (local.get $frame) (i32.const 36)) (i32.const 1))
    (call $dp_enum_continue))

  (func $handle_IDirectPlay4W_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dplay_query_interface (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectPlay4W_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_addref (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_Release (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_AddPlayerToGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_AddPlayerToGroup (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; Session control on the virtual LAN (09d4-dplay-net.wat) through the
  ;; Unicode interface: same provider, same wire, UTF-16 session names at the
  ;; boundary. Age of Empires II drives DirectPlay only through this interface.
  (func $handle_IDirectPlay4W_Open (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    ;; -1: a join is waiting for the host and the call has been parked.
    (local.set $hr (call $dpn_open (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (if (i32.ne (local.get $hr) (i32.const -1))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $hr)))))

  (func $handle_IDirectPlay4W_EnumSessions (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dpn_enum_sessions (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 1)))

  ;; The entity's UTF-16 DPNAME mirror, made from its 1252 name the first time
  ;; it is needed (a remote player announced over the wire has only that).
  ;; dpw_forget frees it with the entity.
  (func $dpw_mirror (param $entry i32) (result i32)
    (local $slot i32) (local $name i32)
    (local.set $slot (call $dpw_side (local.get $entry) (i32.const 1)))
    (if (i32.eqz (local.get $slot)) (then (return (i32.const 0))))
    (local.set $name (call $gl32 (local.get $slot)))
    (if (local.get $name) (then (return (local.get $name))))
    (local.set $name (call $dpw_clone_name (call $gl32 (i32.add (local.get $entry) (i32.const 8))) (i32.const 0)))
    (if (local.get $name) (then (call $gs32 (local.get $slot) (local.get $name))))
    (local.get $name))

  ;; Receive through IDirectPlay4W. The queue holds the established messages;
  ;; a DPMSG_CREATEPLAYERORGROUP from DPID_SYSMSG names the entity through
  ;; DPNAME pointers, which a Unicode caller must find pointing at UTF-16.
  (func $handle_IDirectPlay4W_Receive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32) (local $entry i32) (local $w i32)
    (call $dpn_poll)
    (local.set $hr (call $dp_receive (call $dpw_owner (local.get $arg0)) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
    (if (i32.and (i32.eqz (local.get $hr))
          (i32.and (i32.ne (local.get $arg4) (i32.const 0)) (i32.eqz (call $gl32 (local.get $arg1)))))
      (then
        (if (i32.eq (call $gl32 (local.get $arg4)) (i32.const 3)) ;; DPSYS_CREATEPLAYERORGROUP
          (then
            (local.set $entry (call $dp_find_entity (call $gl32 (i32.add (local.get $arg4) (i32.const 8)))
              (select (i32.const 1) (i32.const 0)
                (i32.eq (call $gl32 (i32.add (local.get $arg4) (i32.const 4))) (i32.const 1)))))
            (if (local.get $entry) (then (local.set $w (call $dpw_mirror (local.get $entry)))))
            (call $gs32 (i32.add (local.get $arg4) (i32.const 32))
              (if (result i32) (local.get $w) (then (call $gl32 (i32.add (local.get $w) (i32.const 8)))) (else (i32.const 0))))
            (call $gs32 (i32.add (local.get $arg4) (i32.const 36))
              (if (result i32) (local.get $w) (then (call $gl32 (i32.add (local.get $w) (i32.const 12)))) (else (i32.const 0))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_IDirectPlay4W_GetSessionDesc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dpn_get_session_desc (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IDirectPlay4W_InitializeConnection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_InitializeConnection (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_StartSession (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_StartSession (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_GetCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_GetCaps (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_GetPlayerCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_GetPlayerCaps (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_Initialize (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_Close (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_Close (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_CreateGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $flags i32)
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (call $dpw_create
        (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
        (local.get $flags) (i32.const 0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $dp_bind_entity (call $gl32 (local.get $arg1)) (call $dpw_owner (local.get $arg0)) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_IDirectPlay4W_CreatePlayer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32) (local $flags i32)
    (local.set $size (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=0 (global.get $reg_base) (call $dpw_create
        (local.get $arg1) (local.get $arg2) (local.get $arg4) (local.get $size)
        (local.get $flags) (i32.const 1)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then
        (call $dp_bind_entity (call $gl32 (local.get $arg1)) (call $dpw_owner (local.get $arg0)) (local.get $arg3))
        (call $dpn_player_created (call $dpw_owner (local.get $arg0)) (call $gl32 (local.get $arg1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_IDirectPlay4W_DeletePlayerFromGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_DeletePlayerFromGroup (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_DestroyGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_DestroyGroup (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_DestroyPlayer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_DestroyPlayer (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_EnumGroupPlayers (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $group i32) (local $flags i32)
    (if (i32.ne (global.get $ansi_code_page) (i32.const 1252)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))) (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $group (call $dp_find_entity (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (if (i32.or (i32.eqz (local.get $arg3)) (i32.eqz (local.get $group)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (call $dpw_enum_begin
      (local.get $ret_addr) (local.get $arg3) (local.get $arg4) (i32.const 1)
      (call $dp_group_bit (local.get $group)) (local.get $flags) (i32.const 1)))

  (func $handle_IDirectPlay4W_EnumGroups (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (if (i32.ne (global.get $ansi_code_page) (i32.const 1252)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (call $dpw_enum_begin
      (local.get $ret_addr) (local.get $arg2) (local.get $arg3) (i32.const 0)
      (i32.const 0) (local.get $arg4) (i32.const 0)))

  (func $handle_IDirectPlay4W_EnumPlayers (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $type i32)
    (call $dpn_poll)
    (if (i32.ne (global.get $ansi_code_page) (i32.const 1252)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $type
      (select (i32.const -1) (i32.const 1)
        (i32.ne (i32.and (local.get $arg4) (i32.const 0x00000020)) (i32.const 0))))
    (call $dpw_enum_begin
      (local.get $ret_addr) (local.get $arg2) (local.get $arg3) (local.get $type)
      (i32.const 0) (local.get $arg4) (i32.const 0)))



  (func $handle_IDirectPlay4W_GetGroupData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_GetGroupData (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_GetGroupName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dpw_get_name (local.get $arg1) (i32.const 0) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirectPlay4W_GetMessageCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_GetMessageCount (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))



  (func $handle_IDirectPlay4W_GetPlayerData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_GetPlayerData (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_GetPlayerName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dpw_get_name (local.get $arg1) (i32.const 1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))





  ;; Payloads are bytes either way, so a networked session goes straight to
  ;; the ANSI path, which carries remote recipients over the room wire.
  (func $handle_IDirectPlay4W_Send (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_Send (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_SetGroupData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_SetGroupData (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_SetGroupName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)))
    (i32.store offset=0 (global.get $reg_base) (call $dpw_set_name (local.get $arg1) (i32.const 0) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IDirectPlay4W_SetPlayerData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_SetPlayerData (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_SetPlayerName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)))
    (i32.store offset=0 (global.get $reg_base) (call $dpw_set_name (local.get $arg1) (i32.const 1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))


  (func $handle_IDirectPlay4W_AddGroupToGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_AddGroupToGroup (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_CreateGroupInGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32) (local $flags i32) (local $hr i32) (local $id i32)
    (local.set $size (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (if (i32.eqz
          (call $dp_owned_entity
            (call $dpw_owner (local.get $arg0)) (local.get $arg1) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8877009B)) ;; DPERR_INVALIDGROUP
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (local.set $hr
      (call $dpw_create
        (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $size)
        (local.get $flags) (i32.const 0)))
    (if (i32.eqz (local.get $hr))
      (then
        (local.set $id (call $gl32 (local.get $arg2)))
        (call $dp_bind_entity (local.get $id) (call $dpw_owner (local.get $arg0)) (i32.const 0))
        (local.set $hr
          (call $dp_update_membership
            (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $id)
            (i32.const 0) (i32.const 1)))
        (if (local.get $hr)
          (then
            (drop (call $dp_destroy_entity (local.get $id) (i32.const 0)))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_IDirectPlay4W_DeleteGroupFromGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_DeleteGroupFromGroup (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_EnumConnections (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $guid i32) (local $guid_wa i32) (local $conn i32) (local $dpname i32) (local $dpname_wa i32) (local $label i32) (local $label_wa i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (return)))
    (if (i32.gt_u (local.get $arg4) (i32.const 1)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)) (return)))
    (if (i32.eqz (global.get $dpw_provider)) (then
      (global.set $dpw_provider (call $heap_alloc (i32.const 52)))
      (if (i32.eqz (global.get $dpw_provider)) (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
      (call $zero_memory (call $g2w (global.get $dpw_provider)) (i32.const 52))
      (call $gs32 (global.get $dpw_provider) (i32.const 0x36E95EE0))
      (call $gs32 (i32.add (global.get $dpw_provider) (i32.const 4)) (i32.const 0x11CF8577))
      (call $gs32 (i32.add (global.get $dpw_provider) (i32.const 8)) (i32.const 0x80000C96))
      (call $gs32 (i32.add (global.get $dpw_provider) (i32.const 12)) (i32.const 0x824E53C7))
      (call $gs16 (i32.add (global.get $dpw_provider) (i32.const 20)) (i32.const 84))
      (call $gs16 (i32.add (global.get $dpw_provider) (i32.const 22)) (i32.const 67))
      (call $gs16 (i32.add (global.get $dpw_provider) (i32.const 24)) (i32.const 80))
      (call $gs16 (i32.add (global.get $dpw_provider) (i32.const 26)) (i32.const 47))
      (call $gs16 (i32.add (global.get $dpw_provider) (i32.const 28)) (i32.const 73))
      (call $gs16 (i32.add (global.get $dpw_provider) (i32.const 30)) (i32.const 80))
      (call $gs32 (i32.add (global.get $dpw_provider) (i32.const 36)) (i32.const 16))
      (call $gs32 (i32.add (global.get $dpw_provider) (i32.const 44)) (i32.add (global.get $dpw_provider) (i32.const 20)))
      (call $gs32 (i32.add (global.get $dpw_provider) (i32.const 48)) (i32.add (global.get $dpw_provider) (i32.const 20)))))
    (local.set $guid (global.get $dpw_provider))
    (local.set $conn (i32.add (global.get $dpw_provider) (i32.const 16)))
    (local.set $dpname (i32.add (global.get $dpw_provider) (i32.const 36)))
    ;; Push saved caller return, then callback args right-to-left:
    ;; context, flags, name, connection size, connection, provider GUID.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $dpname))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 4))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $conn))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $guid))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $ddenum_ret_thunk))
    (global.set $eip (local.get $arg2))
    (global.set $steps (i32.const 0)))

  (func $handle_IDirectPlay4W_EnumGroupsInGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $group i32) (local $flags i32)
    (if (i32.ne (global.get $ansi_code_page) (i32.const 1252)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))) (return)))
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $group (call $dp_find_entity (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (if (i32.or (i32.eqz (local.get $arg3)) (i32.eqz (local.get $group)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (call $dpw_enum_begin
      (local.get $ret_addr) (local.get $arg3) (local.get $arg4) (i32.const 0)
      (call $dp_group_bit (local.get $group)) (local.get $flags) (i32.const 1)))







  (func $handle_IDirectPlay4W_GetGroupFlags (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_GetGroupFlags (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_GetGroupParent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_GetGroupParent (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))


  (func $handle_IDirectPlay4W_GetPlayerFlags (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay3_GetPlayerFlags (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_GetGroupOwner (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay4_GetGroupOwner (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_SetGroupOwner (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay4_SetGroupOwner (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_SendEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay4_SendEx (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_GetMessageQueue (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay4_GetMessageQueue (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_CancelMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay4_CancelMessage (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IDirectPlay4W_CancelPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirectPlay4_CancelPriority (call $dpw_owner (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (global $DX_VTBL_VBIMAGE7 (mut i32) (i32.const 0))
;; Internal contiguous buffers only; the guest front door validates
;; and marshal all 232 bytes with guest spans before using these adapters.
;; Original ce95fbf5 DLL: converters 7352be1a, 7352bdb4, 7352a286, 7352a3a5.
;; Return HRESULT; explicit RGB-only input support, never reinterpret 232 as 124.
(func $vbdd_desc_rgb_to_native (param $vb i32) (param $native i32) (result i32)
  (local $pf i32)
  (local.set $pf (i32.load offset=76 (local.get $vb)))
  ;; An explicitly requested non-RGB format requires a separate adapter.
  (if (i32.and (i32.load offset=4 (local.get $vb)) (i32.const 0x1000)) (then
    (if (i32.or (i32.eqz (i32.and (local.get $pf) (i32.const 0x40)))
          (i32.ne (i32.and (local.get $pf) (i32.const 0xFFFFFFBE)) (i32.const 0)))
      (then (return (i32.const 0x80004001))))))
  (memory.copy (local.get $native) (local.get $vb) (i32.const 124))
    (i32.store offset=0 (local.get $native) (i32.const 124))
  (if (i32.and (i32.load offset=4 (local.get $vb)) (i32.const 0x20000))
    (then (i32.store offset=24 (local.get $native) (i32.load offset=224 (local.get $vb))))
    (else (if (i32.and (i32.load offset=4 (local.get $vb)) (i32.const 0x40000))
      (then (i32.store offset=24 (local.get $native) (i32.load offset=228 (local.get $vb)))))))
  ;; Native union fields retain supplied internal values unless RGB selects them.
  (if (i32.and (local.get $pf) (i32.const 0x140)) (then
    (i32.store offset=84 (local.get $native) (i32.load offset=104 (local.get $vb)))
    (i32.store offset=88 (local.get $native) (i32.load offset=128 (local.get $vb)))
    (i32.store offset=92 (local.get $native) (i32.load offset=148 (local.get $vb)))
    (i32.store offset=96 (local.get $native) (i32.load offset=164 (local.get $vb)))
    (if (i32.and (local.get $pf) (i32.const 1))
      (then (i32.store offset=100 (local.get $native) (i32.load offset=180 (local.get $vb))))
      (else (if (i32.and (local.get $pf) (i32.const 0x2000))
        (then (i32.store offset=100 (local.get $native) (i32.load offset=192 (local.get $vb)))))))))
    (i32.store offset=72 (local.get $native) (i32.const 32))
  (memory.copy (i32.add (local.get $native) (i32.const 104))
    (i32.add (local.get $vb) (i32.const 200)) (i32.const 16))
  (i32.const 0))

;; Exact native reverse-converter expansion. It reports native size124/32
;; in expanded VB records; forcing sizes232/128 would differ from original.
(func $vbdd_desc_from_native (param $vb i32) (param $native i32)
  (memory.fill (local.get $vb) (i32.const 0) (i32.const 232))
  (memory.copy (local.get $vb) (local.get $native) (i32.const 124))
    (i32.store offset=224 (local.get $vb) (i32.load offset=24 (local.get $native)))
    (i32.store offset=228 (local.get $vb) (i32.load offset=24 (local.get $native)))
  (memory.copy (i32.add (local.get $vb) (i32.const 200))
    (i32.add (local.get $native) (i32.const 104)) (i32.const 16))
    (i32.store offset=104 (local.get $vb) (i32.load offset=84 (local.get $native)))
    (i32.store offset=112 (local.get $vb) (i32.load offset=84 (local.get $native)))
    (i32.store offset=116 (local.get $vb) (i32.load offset=84 (local.get $native)))
    (i32.store offset=120 (local.get $vb) (i32.load offset=84 (local.get $native)))
    (i32.store offset=124 (local.get $vb) (i32.load offset=84 (local.get $native)))
    (i32.store offset=128 (local.get $vb) (i32.load offset=88 (local.get $native)))
    (i32.store offset=132 (local.get $vb) (i32.load offset=88 (local.get $native)))
    (i32.store offset=136 (local.get $vb) (i32.load offset=88 (local.get $native)))
    (i32.store offset=140 (local.get $vb) (i32.load offset=88 (local.get $native)))
    (i32.store offset=144 (local.get $vb) (i32.load offset=88 (local.get $native)))
    (i32.store offset=148 (local.get $vb) (i32.load offset=92 (local.get $native)))
    (i32.store offset=152 (local.get $vb) (i32.load offset=92 (local.get $native)))
    (i32.store offset=156 (local.get $vb) (i32.load offset=92 (local.get $native)))
    (i32.store offset=160 (local.get $vb) (i32.load offset=92 (local.get $native)))
    (i32.store offset=164 (local.get $vb) (i32.load offset=96 (local.get $native)))
    (i32.store offset=168 (local.get $vb) (i32.load offset=96 (local.get $native)))
    (i32.store offset=172 (local.get $vb) (i32.load offset=96 (local.get $native)))
    (i32.store offset=176 (local.get $vb) (i32.load offset=96 (local.get $native)))
    (i32.store offset=180 (local.get $vb) (i32.load offset=100 (local.get $native)))
    (i32.store offset=184 (local.get $vb) (i32.load offset=100 (local.get $native)))
    (i32.store offset=188 (local.get $vb) (i32.load offset=100 (local.get $native)))
    (i32.store offset=192 (local.get $vb) (i32.load offset=100 (local.get $native)))
    (i32.store offset=196 (local.get $vb) (i32.load offset=100 (local.get $native)))
)

;; path_wa is an owned contiguous NUL-terminated UTF16 path.
  (func $vbdd_load_bmp24_wide (param $path_wa i32) (result i32)
    (local $handle i32) (local $size i32) (local $buf_ga i32) (local $buf_wa i32)
    (local $read_ga i32) (local $read_wa i32) (local $off i32) (local $hdr i32) (local $bmp i32) (local $width i32) (local $height i32) (local $extent i64)
    (local.set $handle (call $host_fs_create_file
      (local.get $path_wa) (i32.const 0x80000000)
      (i32.const 3) (i32.const 0x80) (i32.const 1)))
    (if (i32.eq (local.get $handle) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $size (call $host_fs_get_file_size (local.get $handle)))
    ;; 54 = BITMAPFILEHEADER + BITMAPINFOHEADER, the smallest legal BMP.
    (if (i32.or (i32.lt_u (local.get $size) (i32.const 54))
                (i32.gt_u (local.get $size) (i32.const 0x2000000)))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (return (i32.const 0))))
    (local.set $buf_ga (call $heap_alloc (local.get $size)))
    (local.set $read_ga (call $heap_alloc (i32.const 4)))
    (if (i32.or (i32.eqz (local.get $buf_ga)) (i32.eqz (local.get $read_ga)))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (if (local.get $buf_ga) (then (call $heap_free (local.get $buf_ga))))
        (if (local.get $read_ga) (then (call $heap_free (local.get $read_ga))))
        (return (i32.const 0))))
    (local.set $read_wa (call $g2w (local.get $read_ga))) (i32.store (local.get $read_wa) (i32.const 0))
    (drop (call $host_fs_read_file
      (local.get $handle) (local.get $buf_ga) (local.get $size) (local.get $read_ga)))
    (drop (call $host_fs_close_handle (local.get $handle)))
    (local.set $size (i32.load (local.get $read_wa)))
    (call $heap_free (local.get $read_ga))
    (local.set $buf_wa (call $g2w (local.get $buf_ga)))
    ;; 0x4D42 = 'BM'
    (if (i32.or (i32.lt_u (local.get $size) (i32.const 54))
                (i32.ne (i32.load16_u (local.get $buf_wa)) (i32.const 0x4D42)))
      (then
        (call $heap_free (local.get $buf_ga))
        (return (i32.const 0))))
    (local.set $hdr (i32.add (local.get $buf_wa) (i32.const 14)))
    (local.set $off (i32.load offset=10 (local.get $buf_wa)))  ;; bfOffBits

    ;; Intentionally bounded BI_RGB 24bpp BITMAPINFOHEADER subset. Reject
    ;; unsupported compression/headers and truncated rows before GDI reads.
    (local.set $width (i32.load offset=4 (local.get $hdr)))
    (local.set $height (i32.load offset=8 (local.get $hdr)))
    (if (i32.lt_s (local.get $height) (i32.const 0))
      (then (local.set $height (i32.sub (i32.const 0) (local.get $height)))))
    (if (i32.or
      (i32.or (i32.ne (i32.load (local.get $hdr)) (i32.const 40))
        (i32.ne (i32.load offset=16 (local.get $hdr)) (i32.const 0)))
      (i32.or (i32.ne (i32.load16_u offset=12 (local.get $hdr)) (i32.const 1))
        (i32.ne (i32.load16_u offset=14 (local.get $hdr)) (i32.const 24))))
      (then (call $heap_free (local.get $buf_ga)) (return (i32.const 0))))
    (if (i32.or
      (i32.or (i32.le_s (local.get $width) (i32.const 0)) (i32.gt_u (local.get $width) (i32.const 4096)))
      (i32.or (i32.le_s (local.get $height) (i32.const 0)) (i32.gt_u (local.get $height) (i32.const 4096))))
      (then (call $heap_free (local.get $buf_ga)) (return (i32.const 0))))
    (local.set $extent (i64.add (i64.extend_i32_u (local.get $off))
      (i64.mul (i64.extend_i32_u (i32.and (i32.add (i32.mul (local.get $width) (i32.const 3)) (i32.const 3)) (i32.const -4)))
        (i64.extend_i32_u (local.get $height)))))
    (if (i32.or (i32.lt_u (local.get $off) (i32.const 54))
      (i64.gt_u (local.get $extent) (i64.extend_i32_u (local.get $size))))
      (then (call $heap_free (local.get $buf_ga)) (return (i32.const 0))))
    (if (i32.const 1)
      (then
        (if (call $gdi_bitmap_plan_info (local.get $hdr) (global.get $GDI_BITMAP_PLAN))
          (then (local.set $bmp (call $gdi_bitmap_create_owned
            (global.get $GDI_BITMAP_PLAN)
            (i32.add (local.get $buf_wa) (local.get $off))
            (i32.const 1) (i32.const 1) (i32.const 1)
            (i32.const 0) (i32.const 0))))))
      (else
        (local.set $bmp (call $gdi_bitmap_create_dibitmap
          (i32.const 0) (local.get $hdr)
          (i32.add (local.get $buf_wa) (local.get $off))
          (i32.const 1) (i32.const 0)))))
    (call $heap_free (local.get $buf_ga))
    (local.get $bmp))


;; PRIVATE, not API-wired: create an owned native RGB offscreen surface from
;; an actual decoded bitmap. The caller still owns bitmap and descriptor.
;; native_desc is an emulator-owned contiguous 124-byte guest heap allocation.
;; Returning this native interface directly to a VB caller is prohibited.
(func $vbdd_bitmap_to_native_surface
    (param $owner i32) (param $bitmap i32) (param $native_desc i32) (result i32)
  (local $tmp_ga i32) (local $tmp i32) (local $src i32) (local $pf i32)
  (local $native i32) (local $obj i32) (local $entry i32)
  (local $saved_esp i32) (local $saved_eax i32) (local $hr i32)
  (local $w i32) (local $h i32) (local $sw i32) (local $sh i32)
  (local $x i32) (local $y i32) (local $color i32) (local $pixel i32)
  (local $bits i32) (local $pitch i32) (local $bpp i32) (local $ok i32)
  (local.set $tmp_ga (call $heap_alloc (i32.const 116)))
  (if (i32.eqz (local.get $tmp_ga)) (then (return (i32.const 0))))
  (local.set $tmp (call $g2w (local.get $tmp_ga)))
  (local.set $src (i32.add (local.get $tmp) (i32.const 4)))
  (local.set $pf (i32.add (local.get $tmp) (i32.const 84)))
  (local.set $native (call $g2w (local.get $native_desc)))
  (block $cleanup
    (br_if $cleanup (i32.eqz (call $gdi_raster_desc_from_bitmap (local.get $bitmap) (local.get $src))))
    (local.set $sw (i32.load offset=4 (local.get $src)))
    (local.set $sh (i32.load offset=8 (local.get $src)))
    (br_if $cleanup (i32.or (i32.le_s (local.get $sw) (i32.const 0)) (i32.le_s (local.get $sh) (i32.const 0))))
    ;; Only plain/system-memory offscreen surfaces; no implicit primary, chains,
    ;; caller lpSurface, overlays or texture semantics in this bounded path.
    (br_if $cleanup (i32.and (i32.load offset=104 (local.get $native)) (i32.const 0xFFFFF7BF)))
    (br_if $cleanup (i32.ne (i32.load offset=36 (local.get $native)) (i32.const 0)))
    (local.set $w (i32.load offset=12 (local.get $native)))
    (local.set $h (i32.load offset=8 (local.get $native)))
    (if (i32.eqz (local.get $w)) (then (local.set $w (local.get $sw))))
    (if (i32.eqz (local.get $h)) (then (local.set $h (local.get $sh))))
    (br_if $cleanup (i32.or (i32.gt_u (local.get $w) (i32.const 4096)) (i32.gt_u (local.get $h) (i32.const 4096))))
    (br_if $cleanup (i32.or (i32.gt_u (local.get $sw) (i32.const 4096)) (i32.gt_u (local.get $sh) (i32.const 4096))))
    (i32.store offset=12 (local.get $native) (local.get $w))
    (i32.store offset=8 (local.get $native) (local.get $h))
    (i32.store offset=4 (local.get $native) (i32.or (i32.load offset=4 (local.get $native)) (i32.const 6)))
    (i32.store (local.get $tmp) (i32.const 0))
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $saved_eax (i32.load (global.get $reg_base)))
    (call $handle_IDirectDraw_CreateSurface (local.get $owner) (local.get $native_desc)
      (local.get $tmp_ga) (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $hr (i32.load (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.store (global.get $reg_base) (local.get $saved_eax))
    (br_if $cleanup (local.get $hr))
    (local.set $obj (i32.load (local.get $tmp)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (br_if $cleanup (i32.eqz (local.get $entry)))
    (local.set $bits (load.field.memarg DxObject misc1 (local.get $entry)))
    (local.set $pitch (load.field.memarg DxObject pitch (local.get $entry)))
    (local.set $bpp (load.field.memarg DxObject bpp (local.get $entry)))
    (br_if $cleanup (i32.eqz (local.get $bits)))
    (br_if $cleanup (i32.eqz (i32.or (i32.eq (local.get $bpp) (i32.const 16))
      (i32.or (i32.eq (local.get $bpp) (i32.const 24)) (i32.eq (local.get $bpp) (i32.const 32))))))
    (call $dx_fill_surface_pixel_format (local.get $pf) (local.get $entry))
    (loop $rows
      (local.set $x (i32.const 0))
      (loop $columns
        (local.set $color (call $gdi_raster_read (local.get $src)
          (i32.div_u (i32.mul (local.get $x) (local.get $sw)) (local.get $w))
          (i32.div_u (i32.mul (local.get $y) (local.get $sh)) (local.get $h))))
        (br_if $cleanup (i32.eq (local.get $color) (i32.const -1)))
        (local.set $pixel (i32.add (local.get $bits) (i32.add
          (i32.mul (local.get $y) (local.get $pitch))
          (i32.mul (local.get $x) (i32.shr_u (local.get $bpp) (i32.const 3))))))
        (if (i32.eq (local.get $bpp) (i32.const 16))
          (then (i32.store16 (local.get $pixel) (i32.or
            (call $gdi_raster_pack_channel (i32.shr_u (local.get $color) (i32.const 16)) (i32.load offset=16 (local.get $pf)))
            (i32.or (call $gdi_raster_pack_channel (i32.shr_u (local.get $color) (i32.const 8)) (i32.load offset=20 (local.get $pf)))
              (call $gdi_raster_pack_channel (local.get $color) (i32.load offset=24 (local.get $pf)))))))
          (else
            (i32.store8 (local.get $pixel) (local.get $color))
            (i32.store8 offset=1 (local.get $pixel) (i32.shr_u (local.get $color) (i32.const 8)))
            (i32.store8 offset=2 (local.get $pixel) (i32.shr_u (local.get $color) (i32.const 16)))
            (if (i32.eq (local.get $bpp) (i32.const 32)) (then (i32.store8 offset=3 (local.get $pixel) (i32.const 0))))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $columns (i32.lt_u (local.get $x) (local.get $w))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $y) (local.get $h))))
    (call $dx_surf_note_cpu_write (local.get $entry))
    (local.set $ok (i32.const 1)))
  (if (i32.and (i32.eqz (local.get $ok)) (i32.ne (local.get $obj) (i32.const 0)))
    (then (drop (call $dx_surface_release (local.get $obj))) (local.set $obj (i32.const 0))))
  (call $heap_free (local.get $tmp_ga))
  (local.get $obj))

;; PRIVATE: guest front-door buffer validation without treating sparse pages
;; as contiguous. No output mutation until every page of the output is mapped.
(func $vbdd_guest_span_mapped (param $ptr i32) (param $length i32) (result i32)
  (local $chunk i32)
  (if (i32.or (i32.eqz (local.get $ptr))
        (i32.or (i32.eqz (local.get $length))
          (i64.gt_u (i64.add (i64.extend_i32_u (local.get $ptr)) (i64.extend_i32_u (local.get $length)))
            (i64.const 0x100000000)))) (then (return (i32.const 0))))
  (loop $pages
    (local.set $chunk (i32.sub (i32.const 4096) (i32.and (local.get $ptr) (i32.const 4095))))
    (if (i32.gt_u (local.get $chunk) (local.get $length)) (then (local.set $chunk (local.get $length))))
    (if (i32.eq (call $g2w_affine_span (local.get $ptr) (local.get $chunk)) (global.get $NULL_SENTINEL))
      (then (return (i32.const 0))))
    (local.set $ptr (i32.add (local.get $ptr) (local.get $chunk)))
    (local.set $length (i32.sub (local.get $length) (local.get $chunk)))
    (br_if $pages (local.get $length)))
  (i32.const 1))

;; Typelib VB slot40, HRESULT(this,DDSURFACEDESC2*), not native slot22.
;; This internal result helper deliberately leaves x86 register cleanup to its
;; eventual dispatch wrapper (12 bytes). Original native reverse converter is
;; responsible for expanded VB field layout, rather than a native struct cast.
(func $vbdd_surface_get_desc (param $obj i32) (param $out i32) (result i32)
  (local $entry i32) (local $scratch_ga i32) (local $native i32) (local $vb i32) (local $i i32)
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $out) (i32.const 232)))
    (then (return (i32.const 0x80004003))))
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $obj) (i32.const 8)))
    (then (return (i32.const 0x80070057))))
  (local.set $i (call $gl32 (i32.add (local.get $obj) (i32.const 4))))
  (if (i32.ge_u (local.get $i) (global.get $DX_MAX))
    (then (return (i32.const 0x80070057))))
  (local.set $entry (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $i) (i32.const 32))))
  (if (i32.or (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 2))
        (i32.le_s (load.field DxObject refcount (local.get $entry)) (i32.const 0)))
    (then (return (i32.const 0x80070057))))
  (local.set $scratch_ga (call $heap_alloc (i32.const 356)))
  (if (i32.eqz (local.get $scratch_ga)) (then (return (i32.const 0x8007000E))))
  (local.set $native (call $g2w (local.get $scratch_ga)))
  (local.set $vb (i32.add (local.get $native) (i32.const 124)))
  (memory.fill (local.get $native) (i32.const 0) (i32.const 124))
  (call $dx_fill_surface_desc (local.get $native) (local.get $entry))
  (i32.store (local.get $native) (i32.const 124))
  (call $vbdd_desc_from_native (local.get $vb) (local.get $native))
  (local.set $i (i32.const 0))
  (loop $write
    (call $gs8 (i32.add (local.get $out) (local.get $i))
      (i32.load8_u (i32.add (local.get $vb) (local.get $i))))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br_if $write (i32.lt_u (local.get $i) (i32.const 232))))
  (call $heap_free (local.get $scratch_ga))
  (i32.const 0))

;; The generator appends the complete dedicated
;; IVBImageSurface7 interface at the registry tail and declare this global.
(func $vbdd_surface_vtable (result i32) (global.get $DX_VTBL_VBIMAGE7))

(func $vbdd_surface_entry (param $obj i32) (result i32)
  (local $slot i32) (local $wa i32) (local $entry i32)
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $obj) (i32.const 8)))
    (then (return (i32.const 0))))
  (local.set $slot (call $gl32 (i32.add (local.get $obj) (i32.const 4))))
  (if (i32.ge_u (local.get $slot) (global.get $DX_MAX)) (then (return (i32.const 0))))
  (local.set $wa (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $slot) (i32.const 8))))
  ;; This identity only uses a fresh primary wrapper, never an auxiliary or
  ;; a caller-fabricated pair of DWORDs that happens to name a live slot.
  (if (i32.ne (local.get $obj) (call $w2g (local.get $wa))) (then (return (i32.const 0))))
  (if (i32.ne (i32.load (local.get $wa)) (global.get $DX_VTBL_VBIMAGE7))
    (then (return (i32.const 0))))
  (local.set $entry (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $slot) (i32.const 32))))
  (if (i32.or (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 2))
        (i32.le_s (load.field DxObject refcount (local.get $entry)) (i32.const 0)))
    (then (return (i32.const 0))))
  (local.get $entry))

(func $vbdd_surface_query (param $obj i32) (param $iid i32) (param $output i32) (result i32)
  (local $copy_ga i32) (local $copy i32) (local $i i32) (local $result i32)
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $output) (i32.const 4)))
    (then (return (i32.const 0x80004003))))
  (call $gs32 (local.get $output) (i32.const 0))
  (if (i32.eqz (call $vbdd_surface_entry (local.get $obj))) (then (return (i32.const 0x80070057))))
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $iid) (i32.const 16)))
    (then (return (i32.const 0x80004003))))
  (local.set $copy_ga (call $heap_alloc (i32.const 16)))
  (if (i32.eqz (local.get $copy_ga)) (then (return (i32.const 0x8007000E))))
  (local.set $copy (call $g2w (local.get $copy_ga)))
  (loop $copy_guid
    (i32.store8 (i32.add (local.get $copy) (local.get $i)) (call $gl8 (i32.add (local.get $iid) (local.get $i))))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br_if $copy_guid (i32.lt_u (local.get $i) (i32.const 16))))
  (local.set $result (call $dx_query_interface_single_wa
    (local.get $obj) (local.get $copy) (local.get $output)
    (i32.const 0x9F76FDE8) (i32.const 0x11D18E92) (i32.const 0xC0000888) (i32.const 0x02C6C24F)))
  (call $heap_free (local.get $copy_ga))
  (local.get $result))

(func $handle_VBImage_QueryInterface
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (i32.store (global.get $reg_base) (call $vbdd_surface_query (local.get $arg0) (local.get $arg1) (local.get $arg2)))
  (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

(func $handle_VBImage_AddRef
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (local $entry i32) (local.set $entry (call $vbdd_surface_entry (local.get $arg0)))
  (i32.store (global.get $reg_base) (i32.const 0))
  (if (local.get $entry) (then
    (store.field DxObject refcount (local.get $entry) (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (i32.store (global.get $reg_base) (load.field DxObject refcount (local.get $entry)))))
  (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

(func $handle_VBImage_Release
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (i32.store (global.get $reg_base)
    (if (result i32) (call $vbdd_surface_entry (local.get $arg0))
      (then (call $dx_surface_release (local.get $arg0))) (else (i32.const 0))))
  (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

(func $handle_VBImage_GetSurfaceDesc
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (i32.store (global.get $reg_base)
    (if (result i32) (call $vbdd_surface_entry (local.get $arg0))
      (then (call $vbdd_surface_get_desc (local.get $arg0) (local.get $arg1))) (else (i32.const 0x80070057))))
  (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

;; PRIVATE FRONT-DOOR DRAFT; not wired, not compiled. Requires a dedicated
;; correctly generated 71-slot $vbdd_surface_vtable before it can be published.
;; Returns HRESULT; the eventual API2542 dispatch wrapper advances ESP20.
(func $vbdd_create_surface_from_file
  (param $owner i32) (param $bstr i32) (param $descriptor i32) (param $output i32) (result i32)
  (local $scratch_ga i32) (local $scratch i32) (local $vb i32) (local $native_ga i32) (local $native i32)
  (local $path_ga i32) (local $path_wa i32) (local $path_bytes i32) (local $i i32)
  (local $bitmap i32) (local $surface i32) (local $entry i32) (local $vtbl i32)
  (local $hr i32)
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $output) (i32.const 4)))
    (then (return (i32.const 0x80004003))))
  (call $gs32 (local.get $output) (i32.const 0))
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $descriptor) (i32.const 232)))
    (then (return (i32.const 0x80004003))))
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $owner) (i32.const 8)))
    (then (return (i32.const 0x80070057))))
  (local.set $i (call $gl32 (i32.add (local.get $owner) (i32.const 4))))
  (if (i32.ge_u (local.get $i) (global.get $DX_MAX))
    (then (return (i32.const 0x80070057))))
  (local.set $entry (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $i) (i32.const 32))))
  ;; Existing IDirectX7::DirectDrawCreate owns a VB type33 object, not the
  ;; type1 native DirectDraw factory. Do not reject the actual registered ABI.
  (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 33))
    (then (return (i32.const 0x80070057))))
  ;; SysStringLen reads BSTR's byte prefix. Validate it before subtracting4;
  ;; empty/NULL file follows the original VB runtime file-not-found HRESULT.
  (if (i32.eqz (local.get $bstr)) (then (return (i32.const 0x800A0035))))
  (if (i32.lt_u (local.get $bstr) (i32.const 4)) (then (return (i32.const 0x80004003))))
  (if (i32.eqz (call $vbdd_guest_span_mapped (i32.sub (local.get $bstr) (i32.const 4)) (i32.const 4)))
    (then (return (i32.const 0x80004003))))
  (local.set $path_bytes (call $gl32 (i32.sub (local.get $bstr) (i32.const 4))))
  (if (i32.eqz (local.get $path_bytes)) (then (return (i32.const 0x800A0035))))
  (if (i32.or (i32.and (local.get $path_bytes) (i32.const 1))
        (i32.gt_u (local.get $path_bytes) (i32.const 65534)))
    (then (return (i32.const 0x80070057))))
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $bstr) (local.get $path_bytes)))
    (then (return (i32.const 0x80004003))))
  (local.set $hr (i32.const 0x8007000E))
  (local.set $scratch_ga (call $heap_alloc (i32.const 356)))
  (local.set $path_ga (call $heap_alloc (i32.add (local.get $path_bytes) (i32.const 2))))
  (block $cleanup
    (br_if $cleanup (i32.or (i32.eqz (local.get $scratch_ga)) (i32.eqz (local.get $path_ga))))
    (local.set $scratch (call $g2w (local.get $scratch_ga)))
    (local.set $vb (local.get $scratch))
    (local.set $native_ga (i32.add (local.get $scratch_ga) (i32.const 232)))
    (local.set $native (i32.add (local.get $scratch) (i32.const 232)))
    (local.set $path_wa (call $g2w (local.get $path_ga)))
    (local.set $i (i32.const 0))
    (loop $path
      (i32.store8 (i32.add (local.get $path_wa) (local.get $i))
        (call $gl8 (i32.add (local.get $bstr) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $path (i32.lt_u (local.get $i) (local.get $path_bytes))))
    (i32.store16 (i32.add (local.get $path_wa) (local.get $path_bytes)) (i32.const 0))
    (local.set $i (i32.const 0))
    (loop $descriptor
      (i32.store8 (i32.add (local.get $vb) (local.get $i))
        (call $gl8 (i32.add (local.get $descriptor) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $descriptor (i32.lt_u (local.get $i) (i32.const 232))))
    ;; Original73542ac8 writes +104 in the VB record on zero flags. Preserve
    ;; it only in staging; do not confuse that offset with VB caps at200.
    (if (i32.eqz (i32.load offset=4 (local.get $vb))) (then
      (i32.store offset=4 (local.get $vb) (i32.const 1))
      (i32.store offset=104 (local.get $vb) (i32.const 0x40))))
    (local.set $hr (call $vbdd_desc_rgb_to_native (local.get $vb) (local.get $native)))
    (br_if $cleanup (local.get $hr))
    (local.set $bitmap (call $vbdd_load_bmp24_wide (local.get $path_wa)))
    ;; A loader failure remains failure. Exact missing/invalid/OOM HRESULT
    ;; distinction is pending typed loader result; generic E_FAIL is honest.
    (local.set $hr (i32.const 0x80004005))
    (br_if $cleanup (i32.eqz (local.get $bitmap)))
    (local.set $surface (call $vbdd_bitmap_to_native_surface
      (local.get $owner) (local.get $bitmap) (local.get $native_ga)))
    (br_if $cleanup (i32.eqz (local.get $surface)))
    (local.set $vtbl (call $vbdd_surface_vtable))
    (br_if $cleanup (i32.eqz (local.get $vtbl)))
    ;; This object was just allocated, remains private, and has never been
    ;; returned to guest code. Never use this publication step on an existing
    ;; surface or change its vtable during QueryInterface.
    (call $gs32 (local.get $surface) (local.get $vtbl))
    (local.set $hr (call $vbdd_surface_get_desc (local.get $surface) (local.get $descriptor)))
    (br_if $cleanup (local.get $hr))
    (call $gs32 (local.get $output) (local.get $surface)))
  (if (local.get $bitmap) (then (drop (call $gdi_object_delete_full (local.get $bitmap)))))
  (if (i32.and (i32.ne (local.get $hr) (i32.const 0)) (i32.ne (local.get $surface) (i32.const 0)))
    (then (drop (call $dx_surface_release (local.get $surface)))))
  (if (local.get $path_ga) (then (call $heap_free (local.get $path_ga))))
  (if (local.get $scratch_ga) (then (call $heap_free (local.get $scratch_ga))))
  (local.get $hr))

(func $handle_VBDD_CreateSurfaceFromFile
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (i32.store (global.get $reg_base)
    (call $vbdd_create_surface_from_file (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
  (i32.store offset=16 (global.get $reg_base)
    (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

;; IDirectX7 slot44:HRESULT TickCount([out,retval] LONG*). The existing
;; host clock supplies the same guest milliseconds as GetTickCount.
(func $handle_IVBDirectX7_TickCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (local $hr i32)
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $arg1) (i32.const 4)))
    (then (local.set $hr (i32.const 0x80004003)))
    (else (call $gs32 (local.get $arg1) (call $host_get_ticks))))
  (i32.store offset=0 (global.get $reg_base) (local.get $hr))
  (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

;; VB Surface7 CreateSurface receives the expanded 232-byte VB descriptor.
;; Publish only a fresh owned primary wrapper with the same 71-slot identity
;; as CreateSurfaceFromFile; never retag a previously published native object.
(func $vbdd_create_surface (param $owner i32) (param $desc i32) (param $out i32) (result i32)
 (local $ga i32) (local $wa i32) (local $native i32) (local $obj i32)
 (local $slot i32) (local $entry i32) (local $i i32) (local $hr i32)
 (local $esp i32) (local $eax i32) (local $w i32) (local $h i32) (local $primary i32)
 (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $out) (i32.const 4))) (then (return (i32.const 0x80004003))))
 (call $gs32 (local.get $out) (i32.const 0))
 (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $desc) (i32.const 232))) (then (return (i32.const 0x80004003))))
 (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $owner) (i32.const 8))) (then (return (i32.const 0x80070057))))
 (local.set $slot (call $gl32 (i32.add (local.get $owner) (i32.const 4))))
 (if (i32.ge_u (local.get $slot) (global.get $DX_MAX)) (then (return (i32.const 0x80070057))))
 (if (i32.ne (local.get $owner) (call $w2g (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $slot) (i32.const 8))))) (then (return (i32.const 0x80070057))))
 (local.set $entry (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $slot) (i32.const 32))))
 (if (i32.or (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 33)) (i32.le_s (load.field DxObject refcount (local.get $entry)) (i32.const 0))) (then (return (i32.const 0x80070057))))
 (local.set $ga (call $heap_alloc (i32.const 360)))
 (if (i32.eqz (local.get $ga)) (then (return (i32.const 0x8007000E))))
 (local.set $wa (call $g2w (local.get $ga)))
 (local.set $native (i32.add (local.get $wa) (i32.const 232)))
 (loop $copy
  (i32.store8 (i32.add (local.get $wa) (local.get $i)) (call $gl8 (i32.add (local.get $desc) (local.get $i))))
  (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $copy (i32.lt_u (local.get $i) (i32.const 232))))
 (block $done
  (local.set $hr (call $vbdd_desc_rgb_to_native (local.get $wa) (local.get $native))) (br_if $done (local.get $hr))
  ;; Bounded plain offscreen or primary-only storage: no chains or foreign bits,
  ;; padding override, non-RGB, or unchecked dimensions/allocation arithmetic.
  (local.set $hr (i32.const 0x80004001))
  (local.set $primary (i32.eq (i32.load offset=104 (local.get $native)) (i32.const 0x200)))
  (if (i32.eqz (local.get $primary)) (then
   (br_if $done (i32.and (i32.load offset=104 (local.get $native)) (i32.const 0xFFFFF7BF)))))
  (br_if $done (i32.load offset=36 (local.get $native)))
  (br_if $done (i32.and (i32.load offset=4 (local.get $native)) (i32.const 0xFFFFEFF8)))
  (if (local.get $primary)
   (then
    ;; Match the real allocator: primary dimensions come from current process
    ;; display state, not descriptor fields or an application-specific size.
    (br_if $done (i32.ne (i32.load offset=4 (local.get $native)) (i32.const 1)))
    (local.set $w (call $dx_display_w_get)) (local.set $h (call $dx_display_h_get)))
   (else (local.set $w (i32.load offset=12 (local.get $native))) (local.set $h (i32.load offset=8 (local.get $native)))))
  (br_if $done (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h))))
  (br_if $done (i32.or (i32.gt_u (local.get $w) (i32.const 4096)) (i32.gt_u (local.get $h) (i32.const 4096))))
  (if (i32.and (i32.load offset=4 (local.get $native)) (i32.const 0x1000)) (then
   (local.set $i (i32.load offset=84 (local.get $native)))
   (br_if $done (i32.eqz (i32.or (i32.eq (local.get $i) (i32.const 16)) (i32.or (i32.eq (local.get $i) (i32.const 24)) (i32.eq (local.get $i) (i32.const 32))))))))
  (local.set $esp (i32.load offset=16 (global.get $reg_base))) (local.set $eax (i32.load (global.get $reg_base)))
  (i32.store offset=356 (local.get $wa) (i32.const 0))
  (call $handle_IDirectDraw_CreateSurface (local.get $owner) (i32.add (local.get $ga) (i32.const 232)) (i32.add (local.get $ga) (i32.const 356)) (i32.const 0) (i32.const 0) (i32.const 0))
  (local.set $hr (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (i32.store (global.get $reg_base) (local.get $eax))
  (br_if $done (local.get $hr))
  (local.set $obj (i32.load offset=356 (local.get $wa)))
  (if (i32.or (i32.eqz (local.get $obj)) (i32.eqz (call $vbdd_surface_vtable))) (then
   (local.set $hr (i32.const 0x80004005)) (br $done)))
  (call $gs32 (local.get $obj) (call $vbdd_surface_vtable))
  (call $gs32 (local.get $out) (local.get $obj)))
 (if (i32.and (i32.ne (local.get $hr) (i32.const 0)) (i32.ne (local.get $obj) (i32.const 0))) (then (drop (call $dx_surface_release (local.get $obj)))))
 (call $heap_free (local.get $ga)) (local.get $hr))

;; Native DX7VB 73544b16 treats a zero RECT as NULL/full extent. RECT's four
;; signed LONG fields are already native order; copy sparse guest fields into
;; owned contiguous storage, never infer width/height from the field names.
(func $vbdd_blt_rect (param $rect i32) (param $copy i32) (param $entry i32) (result i32)
 (local $l i32) (local $t i32) (local $r i32) (local $b i32)
 (local.set $r (load.field DxObject width (local.get $entry)))
 (local.set $b (load.field DxObject height (local.get $entry)))
 (if (local.get $rect) (then
  (local.set $l (call $gl32 (local.get $rect))) (local.set $t (call $gl32 (i32.add (local.get $rect) (i32.const 4))))
  (if (i32.or (i32.or (local.get $l) (local.get $t)) (i32.or (call $gl32 (i32.add (local.get $rect) (i32.const 8))) (call $gl32 (i32.add (local.get $rect) (i32.const 12))))) (then
   (local.set $r (call $gl32 (i32.add (local.get $rect) (i32.const 8)))) (local.set $b (call $gl32 (i32.add (local.get $rect) (i32.const 12))))))))
 (if (i32.or (i32.or (i32.lt_s (local.get $l) (i32.const 0)) (i32.lt_s (local.get $t) (i32.const 0)))
  (i32.or (i32.or (i32.le_s (local.get $r) (local.get $l)) (i32.le_s (local.get $b) (local.get $t)))
   (i32.or (i32.gt_u (local.get $r) (load.field DxObject width (local.get $entry))) (i32.gt_u (local.get $b) (load.field DxObject height (local.get $entry))))))
  (then (return (i32.const 0x80004001))))
 (call $gs32 (local.get $copy) (local.get $l)) (call $gs32 (i32.add (local.get $copy) (i32.const 4)) (local.get $t))
 (call $gs32 (i32.add (local.get $copy) (i32.const 8)) (local.get $r)) (call $gs32 (i32.add (local.get $copy) (i32.const 12)) (local.get $b)) (i32.const 0))

;; Blt alone clips destination bounds. Do not relax ColorFill/BltFast's
;; existing bounded helpers. Original DX7VB73544b47..78 maps zero RECT to NULL.
(func $vbdd_blt_null_rect (param $p i32) (result i32)
 (if (i32.eqz (local.get $p)) (then (return (i32.const 1))))
 (i32.eqz (i32.or (i32.or (call $gl32 (local.get $p)) (call $gl32 (i32.add (local.get $p) (i32.const 4))))
  (i32.or (call $gl32 (i32.add (local.get $p) (i32.const 8))) (call $gl32 (i32.add (local.get $p) (i32.const 12)))))))
(func $vbdd_blt_dest_rect (param $rect i32) (param $copy i32) (param $entry i32) (result i32)
 (local $l i32) (local $t i32) (local $r i32) (local $b i32)
 (local.set $r (load.field DxObject width (local.get $entry)))
 (local.set $b (load.field DxObject height (local.get $entry)))
 (if (i32.eqz (call $vbdd_blt_null_rect (local.get $rect))) (then
  (local.set $l (call $gl32 (local.get $rect))) (local.set $t (call $gl32 (i32.add (local.get $rect) (i32.const 4))))
  (local.set $r (call $gl32 (i32.add (local.get $rect) (i32.const 8)))) (local.set $b (call $gl32 (i32.add (local.get $rect) (i32.const 12))))))
 ;; Reject empty/inverted or signed-overflow extents before native arithmetic.
 (if (i32.or (i32.or (i32.le_s (local.get $r) (local.get $l)) (i32.le_s (local.get $b) (local.get $t)))
  (i32.or (i32.le_s (i32.sub (local.get $r) (local.get $l)) (i32.const 0)) (i32.le_s (i32.sub (local.get $b) (local.get $t)) (i32.const 0))))
  (then (return (i32.const 0x80004001))))
 (call $gs32 (local.get $copy) (local.get $l)) (call $gs32 (i32.add (local.get $copy) (i32.const 4)) (local.get $t))
 (call $gs32 (i32.add (local.get $copy) (i32.const 8)) (local.get $r)) (call $gs32 (i32.add (local.get $copy) (i32.const 12)) (local.get $b)) (i32.const 0))

(func $vbdd_blt (param $dst i32) (param $dr i32) (param $src i32) (param $sr i32) (param $flags i32) (param $out i32) (result i32)
 (local $de i32) (local $se i32) (local $tmp i32) (local $esp i32) (local $eax i32) (local $hr i32) (local $dp i32) (local $sp i32)
 (local.set $de (call $vbdd_surface_entry (local.get $dst))) (local.set $se (call $vbdd_surface_entry (local.get $src)))
 (if (i32.or (i32.eqz (local.get $de)) (i32.eqz (local.get $se))) (then (return (i32.const 0x80070057))))
 (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $out) (i32.const 4))) (then (return (i32.const 0x80004003))))
 (if (i32.and (i32.ne (local.get $dr) (i32.const 0)) (i32.eqz (call $vbdd_guest_span_mapped (local.get $dr) (i32.const 16)))) (then (return (i32.const 0x80004003))))
 (if (i32.and (i32.ne (local.get $sr) (i32.const 0)) (i32.eqz (call $vbdd_guest_span_mapped (local.get $sr) (i32.const 16)))) (then (return (i32.const 0x80004003))))
 ;; The Blt (not BltFx) ABI has no DDBLTFX. Support copy/WAIT only, same
 ;; format. Explicit unsupported status is a drawing result, not COM success
 ;; masquerading as completed drawing: original wrapper returns it via retval.
 (local.set $hr (i32.const 0x80004001))
 (block $done
  (br_if $done (i32.and (local.get $flags) (i32.const 0xFEFFFFFF)))
  (br_if $done (i32.ne (load.field DxObject bpp (local.get $de)) (load.field DxObject bpp (local.get $se))))
  (br_if $done (i32.ne (call $dx_surf_fmt_get (local.get $de)) (call $dx_surf_fmt_get (local.get $se))))
  (br_if $done (i32.eq (local.get $dst) (local.get $src)))
  (local.set $tmp (call $heap_alloc (i32.const 64)))
  (if (i32.eqz (local.get $tmp)) (then (local.set $hr (i32.const 0x8007000E)) (br $done)))
  (local.set $hr (call $vbdd_blt_dest_rect (local.get $dr) (i32.add (local.get $tmp) (i32.const 32)) (local.get $de))) (br_if $done (local.get $hr))
  (local.set $hr (call $vbdd_blt_rect (local.get $sr) (i32.add (local.get $tmp) (i32.const 48)) (local.get $se))) (br_if $done (local.get $hr))
  (local.set $dp (i32.add (local.get $tmp) (i32.const 32)))
  (local.set $sp (i32.add (local.get $tmp) (i32.const 48)))
  ;; Only the proved equal-size native clipping path is newly admitted.
  ;; Out-of-bounds stretch remains explicitly unsupported by this adapter.
  (if (i32.or (i32.or (i32.lt_s (call $gl32 (local.get $dp)) (i32.const 0)) (i32.lt_s (call $gl32 (i32.add (local.get $dp) (i32.const 4))) (i32.const 0)))
    (i32.or (i32.gt_s (call $gl32 (i32.add (local.get $dp) (i32.const 8))) (load.field DxObject width (local.get $de))) (i32.gt_s (call $gl32 (i32.add (local.get $dp) (i32.const 12))) (load.field DxObject height (local.get $de)))))
   (then
    (if (i32.or
      (i32.ne (i32.sub (call $gl32 (i32.add (local.get $dp) (i32.const 8))) (call $gl32 (local.get $dp))) (i32.sub (call $gl32 (i32.add (local.get $sp) (i32.const 8))) (call $gl32 (local.get $sp))))
      (i32.ne (i32.sub (call $gl32 (i32.add (local.get $dp) (i32.const 12))) (call $gl32 (i32.add (local.get $dp) (i32.const 4)))) (i32.sub (call $gl32 (i32.add (local.get $sp) (i32.const 12))) (call $gl32 (i32.add (local.get $sp) (i32.const 4))))))
     (then (local.set $hr (i32.const 0x80004001)) (br $done)))))
  (if (call $vbdd_blt_null_rect (local.get $dr)) (then (local.set $dp (i32.const 0))))
  (if (call $vbdd_blt_null_rect (local.get $sr)) (then (local.set $sp (i32.const 0))))
  ;; Native Blt reads optional FX from ESP+24. Supply a private frame with
  ;; NULL FX; never reinterpret caller statusOut as DDBLTFX or edit its stack.
  (call $gs32 (i32.add (local.get $tmp) (i32.const 24)) (i32.const 0))
  (local.set $esp (i32.load offset=16 (global.get $reg_base))) (local.set $eax (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $tmp))
  (call $handle_IDirectDrawSurface_Blt (local.get $dst) (local.get $dp) (local.get $src) (local.get $sp) (local.get $flags) (i32.const 0))
  (local.set $hr (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (i32.store (global.get $reg_base) (local.get $eax)))
 (if (local.get $tmp) (then (call $heap_free (local.get $tmp))))
 (call $gs32 (local.get $out) (local.get $hr)) (i32.const 0))
(func $handle_VBImage_Blt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (i32.store (global.get $reg_base) (call $vbdd_blt (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
 (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

;; Native73544d21 unwraps the optional VB clipper and returns native SetClipper's
;; HRESULT directly (unlike Blt's statusOut). Validate only allocated wrappers;
;; do not interpret a caller-fabricated pair of DWORDs as an owned clipper.
(func $vbdd_clipper_entry (param $obj i32) (result i32)
 (local $offset i32) (local $wa i32) (local $slot i32) (local $entry i32)
 (local.set $offset (i32.sub (local.get $obj) (call $w2g (global.get $COM_WRAPPERS))))
 (if (i32.lt_u (local.get $offset) (global.get $COM_WRAPPERS_SIZE))
  (then (local.set $wa (i32.add (global.get $COM_WRAPPERS) (local.get $offset))))
  (else
   (local.set $offset (i32.sub (local.get $obj) (call $w2g (global.get $COM_WRAPPERS_AUX))))
   (if (i32.ge_u (local.get $offset) (global.get $COM_WRAPPERS_AUX_SIZE)) (then (return (i32.const 0))))
   (if (i32.ge_u (i32.shr_u (local.get $offset) (i32.const 3)) (i32.load (global.get $COM_AUX_NEXT_SHARED))) (then (return (i32.const 0))))
   (local.set $wa (i32.add (global.get $COM_WRAPPERS_AUX) (local.get $offset)))))
 (if (i32.and (local.get $offset) (i32.const 7)) (then (return (i32.const 0))))
 (if (i32.eqz (i32.load (local.get $wa))) (then (return (i32.const 0))))
 (local.set $slot (i32.load offset=4 (local.get $wa)))
 (if (i32.ge_u (local.get $slot) (global.get $DX_MAX)) (then (return (i32.const 0))))
 (local.set $entry (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $slot) (i32.const 32))))
 (if (i32.or (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 10))
  (i32.le_s (load.field DxObject refcount (local.get $entry)) (i32.const 0))) (then (return (i32.const 0))))
 (local.get $entry))
(func $handle_VBImage_SetClipper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (if (i32.or (i32.eqz (call $vbdd_surface_entry (local.get $arg0)))
   (i32.and (i32.ne (local.get $arg1) (i32.const 0)) (i32.eqz (call $vbdd_clipper_entry (local.get $arg1)))))
  (then
   (i32.store (global.get $reg_base) (i32.const 0x88760082))
   (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (else (call $handle_IDirectDrawSurface_SetClipper (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))))

;; Original DX7VB7354329b: raw packed color -> DDBLTFX.dwFillColor at80,
;; zero RECT -> NULL, native Blt(COLORFILL|WAIT,NULL source), native result
;; -> statusOut, COM S_OK. Color is not an OLE_COLOR/RGB conversion request.
(func $vbdd_color_fill (param $obj i32) (param $rect i32) (param $color i32) (param $out i32) (result i32)
 (local $entry i32) (local $tmp i32) (local $fx i32) (local $hr i32) (local $esp i32) (local $eax i32) (local $bpp i32)
 (local.set $entry (call $vbdd_surface_entry (local.get $obj)))
 (if (i32.eqz (local.get $entry)) (then (return (i32.const 0x80070057))))
 (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $out) (i32.const 4))) (then (return (i32.const 0x80004003))))
 (if (i32.and (i32.ne (local.get $rect) (i32.const 0)) (i32.eqz (call $vbdd_guest_span_mapped (local.get $rect) (i32.const 16)))) (then (return (i32.const 0x80004003))))
 (local.set $hr (i32.const 0x80004001))
 (block $done
  (local.set $bpp (load.field DxObject bpp (local.get $entry)))
  ;; Existing native fill has byte/word/dword paths, but its 24bpp path is not
  ;; a three-byte fill. Do not falsely support that format through this ABI.
  (br_if $done (i32.eqz (i32.or (i32.eq (local.get $bpp) (i32.const 16)) (i32.eq (local.get $bpp) (i32.const 32)))))
  (local.set $tmp (call $heap_alloc (i32.const 148)))
  (if (i32.eqz (local.get $tmp)) (then (local.set $hr (i32.const 0x8007000E)) (br $done)))
  (local.set $hr (call $vbdd_blt_rect (local.get $rect) (i32.add (local.get $tmp) (i32.const 32)) (local.get $entry)))
  (br_if $done (local.get $hr))
  (local.set $fx (i32.add (local.get $tmp) (i32.const 48)))
  (call $zero_memory (call $g2w (local.get $fx)) (i32.const 100))
  (call $gs32 (local.get $fx) (i32.const 100))
  (call $gs32 (i32.add (local.get $fx) (i32.const 80)) (local.get $color))
  (call $gs32 (i32.add (local.get $tmp) (i32.const 24)) (local.get $fx))
  (local.set $esp (i32.load offset=16 (global.get $reg_base))) (local.set $eax (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $tmp))
  (call $handle_IDirectDrawSurface_Blt (local.get $obj) (i32.add (local.get $tmp) (i32.const 32)) (i32.const 0) (i32.const 0) (i32.const 0x01000400) (i32.const 0))
  (local.set $hr (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (i32.store (global.get $reg_base) (local.get $eax)))
 (if (local.get $tmp) (then (call $heap_free (local.get $tmp))))
 (call $gs32 (local.get $out) (local.get $hr)) (i32.const 0))
(func $handle_VBImage_BltColorFill (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (i32.store (global.get $reg_base) (call $vbdd_color_fill (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
 (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

;; DX7VB73543135 forwards SetColorKey(flags,key) unchanged to native slot29
;; and returns native HRESULT directly. Only SRCBLT single-key is supported
;; here: native storage/consumer has one low packed key, not ranges/dest keys.
(func $handle_VBImage_SetColorKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (local $entry i32) (local $hr i32) (local $bpp i32)
 (local.set $entry (call $vbdd_surface_entry (local.get $arg0)))
 (block $done
  (local.set $hr (i32.const 0x88760082))
  (br_if $done (i32.eqz (local.get $entry)))
  (local.set $hr (i32.const 0x80004001))
  (br_if $done (i32.ne (local.get $arg1) (i32.const 8)))
  (local.set $bpp (load.field DxObject bpp (local.get $entry)))
  (br_if $done (i32.eqz (i32.or (i32.eq (local.get $bpp) (i32.const 16)) (i32.eq (local.get $bpp) (i32.const 32)))))
  ;; NULL removes the source key. The old native setter dereferences NULL
  ;; and sets key0 instead; avoid claiming that behavior implements removal.
  (if (i32.eqz (local.get $arg2)) (then
   (call $d3dim_worker_fence)
   (store.field DxObject flags (local.get $entry) (i32.and (load.field DxObject flags (local.get $entry)) (i32.const -257)))
   (store.field DxObject misc2 (local.get $entry) (i32.const 0))
   (local.set $hr (i32.const 0)) (br $done)))
  (local.set $hr (i32.const 0x80004003))
  (br_if $done (i32.eqz (call $vbdd_guest_span_mapped (local.get $arg2) (i32.const 8))))
  ;; No COLORSPACE flag: high field is not a range; native masks the low
  ;; packed value to16bpp. It also owns fencing and the original ESP+16 ABI.
  (call $handle_IDirectDrawSurface_SetColorKey (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  (return))
 (i32.store (global.get $reg_base) (local.get $hr))
 (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

;; DX7VB735432ff: NULL source/RECT is COM E_INVALIDARG; zero-valued RECT
;; means full source. Native drawing result is statusOut, COM is S_OK.
;; Unlike the shared native helper's safety clipping, this front door rejects
;; OOB with DDERR_INVALIDRECT: BltFast is documented not to clip.
(func $vbdd_blt_fast (param $dst i32) (param $x i32) (param $y i32) (param $src i32) (param $rect i32) (param $flags i32) (param $out i32) (result i32)
 (local $de i32) (local $se i32) (local $tmp i32) (local $hr i32) (local $esp i32) (local $eax i32) (local $bpp i32) (local $rw i32) (local $rh i32)
 (local.set $de (call $vbdd_surface_entry (local.get $dst))) (local.set $se (call $vbdd_surface_entry (local.get $src)))
 (if (i32.or (i32.or (i32.eqz (local.get $de)) (i32.eqz (local.get $se))) (i32.eqz (local.get $rect))) (then (return (i32.const 0x80070057))))
 (if (i32.or (i32.eqz (call $vbdd_guest_span_mapped (local.get $rect) (i32.const 16))) (i32.eqz (call $vbdd_guest_span_mapped (local.get $out) (i32.const 4)))) (then (return (i32.const 0x80004003))))
 (local.set $hr (i32.const 0x80004001))
 (block $done
  (br_if $done (i32.and (local.get $flags) (i32.const -34))) ;; copy/WAIT/source-key only
  (local.set $bpp (load.field DxObject bpp (local.get $de)))
  (br_if $done (i32.eqz (i32.or (i32.eq (local.get $bpp) (i32.const 16)) (i32.eq (local.get $bpp) (i32.const 32)))))
  (br_if $done (i32.ne (local.get $bpp) (load.field DxObject bpp (local.get $se))))
  (br_if $done (i32.ne (call $dx_surf_fmt_get (local.get $de)) (call $dx_surf_fmt_get (local.get $se))))
  (br_if $done (i32.eq (local.get $dst) (local.get $src)))
  (br_if $done (call $dx_surface_clipper_get (local.get $de)))
  (local.set $hr (i32.const 0x887600D7)) ;; DDERR_NOCOLORKEY
  (br_if $done (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))
   (i32.eqz (i32.and (load.field DxObject flags (local.get $se)) (i32.const 0x100)))))
  (local.set $tmp (call $heap_alloc (i32.const 48)))
  (local.set $hr (i32.const 0x8007000E)) (br_if $done (i32.eqz (local.get $tmp)))
  (local.set $hr (i32.const 0x88760096)) ;; DDERR_INVALIDRECT
  (br_if $done (call $vbdd_blt_rect (local.get $rect) (i32.add (local.get $tmp) (i32.const 32)) (local.get $se)))
  (br_if $done (i32.ge_u (local.get $x) (load.field DxObject width (local.get $de))))
  (br_if $done (i32.ge_u (local.get $y) (load.field DxObject height (local.get $de))))
  (local.set $rw (i32.sub (call $gl32 (i32.add (local.get $tmp) (i32.const 40))) (call $gl32 (i32.add (local.get $tmp) (i32.const 32)))))
  (local.set $rh (i32.sub (call $gl32 (i32.add (local.get $tmp) (i32.const 44))) (call $gl32 (i32.add (local.get $tmp) (i32.const 36)))))
  (br_if $done (i32.gt_u (local.get $rw) (i32.sub (load.field DxObject width (local.get $de)) (local.get $x))))
  (br_if $done (i32.gt_u (local.get $rh) (i32.sub (load.field DxObject height (local.get $de)) (local.get $y))))
  (call $gs32 (i32.add (local.get $tmp) (i32.const 24)) (local.get $flags))
  (local.set $esp (i32.load offset=16 (global.get $reg_base))) (local.set $eax (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $tmp))
  (call $handle_IDirectDrawSurface_BltFast (local.get $dst) (local.get $x) (local.get $y) (local.get $src) (i32.add (local.get $tmp) (i32.const 32)) (i32.const 0))
  (local.set $hr (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (i32.store (global.get $reg_base) (local.get $eax)))
 (if (local.get $tmp) (then (call $heap_free (local.get $tmp))))
 (call $gs32 (local.get $out) (local.get $hr)) (i32.const 0))
(func $handle_VBImage_BltFast (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (i32.store (global.get $reg_base) (call $vbdd_blt_fast (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))))
 (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))


;; DX7VB73544f69: persist raw COLORREF before CreatePen; replace/delete the
;; previous owned pen only after allocation succeeds. Constructor73543c3e
;; defaults PS_SOLID=0, width=1, foreground=0. Style/width setters remain
;; E_NOTIMPL; no unsupported state can silently alter these defaults.
;; The previously unused +12 word in declared16-byte DX_SURF_META owns an
;; eight-byte heap state {raw COLORREF,pen}. No global layout/capacity grows.
;; Native creation already zeros all16bytes before publication. State is
;; shared by every interface view and freed on final surface retirement.
(func $vbdd_draw_state_ptr (param $entry i32) (result i32)
 (local $guest i32)
 (local.set $guest (i32.load offset=12 (call $dx_surf_meta_ptr (local.get $entry))))
 (if (result i32) (local.get $guest) (then (call $g2w (local.get $guest))) (else (i32.const 0))))
(func $vbdd_draw_state_ensure (param $entry i32) (result i32)
 (local $state i32) (local $guest i32)
 (local.set $state (call $vbdd_draw_state_ptr (local.get $entry)))
 (if (local.get $state) (then (return (local.get $state))))
 (local.set $guest (call $heap_alloc (i32.const 8)))
 (if (i32.eqz (local.get $guest)) (then (return (i32.const 0))))
 (local.set $state (call $g2w (local.get $guest)))
 (call $zero_memory (local.get $state) (i32.const 8))
 (i32.store offset=12 (call $dx_surf_meta_ptr (local.get $entry)) (local.get $guest))
 (local.get $state))
(func $vbdd_draw_state_reset (param $entry i32)
 (local $state i32) (local $pen i32) (local $guest i32)
 (local.set $guest (i32.load offset=12 (call $dx_surf_meta_ptr (local.get $entry))))
 (if (i32.eqz (local.get $guest)) (then (return)))
 (i32.store offset=12 (call $dx_surf_meta_ptr (local.get $entry)) (i32.const 0))
 (local.set $state (call $g2w (local.get $guest)))
 (local.set $pen (i32.load offset=4 (local.get $state)))
 (if (local.get $pen) (then (drop (call $gdi_object_delete_full (local.get $pen)))))
 (call $heap_free (local.get $guest)))
(func $vbdd_set_fore_color (param $obj i32) (param $color i32) (result i32)
 (local $entry i32) (local $state i32) (local $old i32) (local $pen i32)
 (local.set $entry (call $vbdd_surface_entry (local.get $obj)))
 (if (i32.eqz (local.get $entry)) (then (return (i32.const 0x80070057))))
 (local.set $state (call $vbdd_draw_state_ensure (local.get $entry)))
 (if (i32.eqz (local.get $state)) (then (return (i32.const 0x8007000E))))
 (i32.store (local.get $state) (local.get $color))
 (local.set $pen (call $gdi_object_alloc (i32.const 1) (i32.const 0) (i32.const 1) (local.get $color) (i32.const 0)))
 (if (i32.eqz (local.get $pen)) (then (return (i32.const 0x80070057))))
 (local.set $old (i32.load offset=4 (local.get $state)))
 (if (local.get $old) (then (drop (call $gdi_object_delete_full (local.get $old)))))
 (i32.store offset=4 (local.get $state) (local.get $pen))
 (i32.const 0))
(func $handle_VBImage_SetForeColor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (i32.store (global.get $reg_base) (call $vbdd_set_fore_color (local.get $arg0) (local.get $arg1)))
 (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

;; Native DX7VB73545219 DrawText: counted BSTR -> ExtTextOutW, default
;; transparent stock-font DC and persistent COLORREF. Low16 updateCP toggles
;; TA_UPDATECP. Native ignores raster BOOL and ReleaseDC HRESULT: S_OK alone
;; never proves pixels. Custom font/background setters remain unsupported.
(func $vbdd_draw_text (param $obj i32) (param $x i32) (param $y i32) (param $bstr i32) (param $update i32) (result i32)
 (local $entry i32) (local $bytes i32) (local $count i32) (local $text i32)
 (local $tmp i32) (local $esp i32) (local $eax i32) (local $hr i32) (local $hdc i32) (local $align i32)
 (if (i32.eqz (local.get $bstr)) (then (return (i32.const 0x80070057))))
 (local.set $entry (call $vbdd_surface_entry (local.get $obj)))
 (if (i32.eqz (local.get $entry)) (then (return (i32.const 0x80070057))))
 (if (i32.lt_u (local.get $bstr) (i32.const 4)) (then (return (i32.const 0x80004003))))
 (if (i32.eqz (call $vbdd_guest_span_mapped (i32.sub (local.get $bstr) (i32.const 4)) (i32.const 4))) (then (return (i32.const 0x80004003))))
 (local.set $bytes (call $gl32 (i32.sub (local.get $bstr) (i32.const 4))))
 (local.set $count (i32.shr_u (local.get $bytes) (i32.const 1)))
 ;; The actual GDI rasterizer accepts at most65536 UTF16 units. Reject the
 ;; unsupported larger contract before any DC/pixel change, rather than
 ;; silently making the rasterizer's early no-op look like implemented text.
 (if (i32.gt_u (local.get $count) (i32.const 65536)) (then (return (i32.const 0x80004001))))
 (local.set $bytes (i32.shl (local.get $count) (i32.const 1)))
 (if (local.get $bytes) (then
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $bstr) (local.get $bytes))) (then (return (i32.const 0x80004003))))
  (local.set $text (call $guest_span_in (local.get $bstr) (local.get $bytes)))
  (if (i32.eqz (local.get $text)) (then (return (i32.const 0x8007000E))))))
 (local.set $hr (i32.const 0x8007000E))
 (local.set $tmp (call $heap_alloc (i32.const 16)))
 (if (local.get $tmp) (then
  (local.set $esp (i32.load offset=16 (global.get $reg_base))) (local.set $eax (i32.load (global.get $reg_base)))
  (i32.store offset=16 (global.get $reg_base) (local.get $tmp))
  (call $handle_IDirectDrawSurface_GetDC (local.get $obj) (local.get $tmp) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (local.set $hr (i32.load (global.get $reg_base)))
  (if (i32.ge_s (local.get $hr) (i32.const 0)) (then
   (local.set $hdc (call $gl32 (local.get $tmp)))
   (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
   (drop (call $gdi_native_set_text_color (local.get $hdc) (if (result i32) (call $vbdd_draw_state_ptr (local.get $entry)) (then (i32.load (call $vbdd_draw_state_ptr (local.get $entry)))) (else (i32.const 0)))))
   (local.set $align (call $gdi_native_get_text_align (local.get $hdc)))
   (drop (call $gdi_native_set_text_align (local.get $hdc)
    (i32.or (i32.and (local.get $align) (i32.const -2)) (i32.ne (i32.and (local.get $update) (i32.const 65535)) (i32.const 0)))))
   (drop (call $gdi_native_ext_text_out (local.get $hdc) (local.get $x) (local.get $y) (i32.const 0) (i32.const 0) (local.get $text) (local.get $count) (i32.const 0) (i32.const 1)))
   (i32.store offset=16 (global.get $reg_base) (local.get $tmp))
   (call $handle_IDirectDrawSurface_ReleaseDC (local.get $obj) (local.get $hdc) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (local.set $hr (i32.const 0))))
  (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (i32.store (global.get $reg_base) (local.get $eax))
  (call $heap_free (local.get $tmp))))
 (if (local.get $text) (then (call $guest_span_release (local.get $text) (local.get $bytes))))
 (local.get $hr))
(func $handle_VBImage_DrawText (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (i32.store (global.get $reg_base) (call $vbdd_draw_text (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)))
 (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))


;; Full native DirectDraw7 table; old slots keep their established API IDs.
  (func $init_vbdd34_vtable (result i32)
    (local $i i32) (local $thunk_wa i32) (local $thunk_guest i32)
    (local $vtbl_guest i32) (local $vtbl_wa i32)
    ;; IDirectDraw is always the first generated interface. Resetting here
    ;; makes repeated main-instance initialization deterministic.
    (if (i32.eq (i32.const 2534) (global.get $API_ID_IDirectDraw_BASE))
      (then (call $dx_vtable_registry_reset)))
    ;; Allocate vtable from heap (count * 4 bytes)
    (local.set $vtbl_guest (call $heap_alloc (i32.mul (i32.const 34) (i32.const 4))))
    (local.set $vtbl_wa (call $g2w (local.get $vtbl_guest)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 34)))
      ;; Compute thunk WASM addr
      (local.set $thunk_wa (i32.add (global.get $THUNK_BASE)
        (i32.mul (global.get $num_thunks) (i32.const 8))))
      ;; Write COM marker as name_rva
      (i32.store (local.get $thunk_wa) (i32.const 0xCACA0010))
      ;; Write api_id
      (i32.store (i32.add (local.get $thunk_wa) (i32.const 4))
        (if (result i32) (i32.lt_u (local.get $i) (i32.const 30))
          (then (i32.add (i32.const 2534) (local.get $i)))
          (else (i32.add (i32.const 4089) (i32.sub (local.get $i) (i32.const 30))))))
      ;; Compute guest address of this thunk
      (local.set $thunk_guest (i32.add
        (i32.sub (local.get $thunk_wa) (global.get $GUEST_BASE))
        (global.get $image_base)))
      ;; Write guest thunk addr into vtable slot
      (i32.store (i32.add (local.get $vtbl_wa) (i32.mul (local.get $i) (i32.const 4)))
        (local.get $thunk_guest))
      (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (call $update_thunk_end)
    (call $dx_vtable_registry_append (local.get $vtbl_guest))
    (local.get $vtbl_guest))

;; Native DX7VB7354220f writes the native TestCooperativeLevel HRESULT to
;; statusOut and returns COM S_OK (RET8). Preserve that two-result contract.
(func $handle_IVBDirectDraw7_TestCooperativeLevel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (local $entry i32) (local $esp i32) (local $hr i32)
 (local.set $esp (i32.load offset=16 (global.get $reg_base)))
 (local.set $hr (i32.const 0x80070057))
 (block $done
  (br_if $done (i32.eqz (call $vbdd_guest_span_mapped (local.get $arg0) (i32.const 8))))
  (local.set $entry (call $dx_from_this (local.get $arg0)))
  (br_if $done (i32.eqz (local.get $entry)))
  (br_if $done (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 33)))
  ;; Only the actual primary wrapper published by the VB factory is valid.
  (br_if $done (i32.ne (local.get $arg0) (call $w2g (i32.add (global.get $COM_WRAPPERS) (i32.mul (call $dx_slot_of (local.get $entry)) (i32.const 8))))))
  (br_if $done (i32.le_s (load.field DxObject refcount (local.get $entry)) (i32.const 0)))
  (local.set $hr (i32.const 0x80004003))
  (br_if $done (i32.eqz (call $vbdd_guest_span_mapped (local.get $arg1) (i32.const 4))))
  (call $handle_IDirectDraw4_TestCooperativeLevel (local.get $arg0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (call $gs32 (local.get $arg1) (i32.load (global.get $reg_base)))
  (local.set $hr (i32.const 0)))
 (i32.store (global.get $reg_base) (local.get $hr))
 (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 12))))

;; Native IVBDirectX7 slot49: GetWindowRect(HWND, RECT*), HRESULT.
;; dx7vb7352d5ef forwards USER32 BOOL, mapping false to E_FAIL. Use the
;; existing Win32 geometry path into owned scratch, then sparse-safe writes.
(func $handle_IVBDirectX7_GetWindowRect
 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
 (local $sp i32) (local $scratch i32) (local $hr i32)
 (local.set $sp (i32.load offset=16 (global.get $reg_base)))
 (block $done
  (if (i32.eqz (call $vbdd_guest_span_mapped (local.get $arg2) (i32.const 16)))
   (then (local.set $hr (i32.const 0x80004003)) (br $done)))
  (local.set $scratch (call $heap_alloc (i32.const 16)))
  (if (i32.eqz (local.get $scratch))
   (then (local.set $hr (i32.const 0x8007000e)) (br $done)))
  (call $handle_GetWindowRect (local.get $arg1) (local.get $scratch) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (if (i32.eqz (i32.load (global.get $reg_base)))
   (then (local.set $hr (i32.const 0x80004005)))
   (else
    (call $gs32 (local.get $arg2) (call $gl32 (local.get $scratch)))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 4)) (call $gl32 (i32.add (local.get $scratch) (i32.const 4))))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 8)) (call $gl32 (i32.add (local.get $scratch) (i32.const 8))))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 12)) (call $gl32 (i32.add (local.get $scratch) (i32.const 12))))))
  (call $heap_free (local.get $scratch)))
 (i32.store (global.get $reg_base) (local.get $hr))
 (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $sp) (i32.const 16))))
