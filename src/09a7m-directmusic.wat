  ;; DirectMusic 8: IDirectMusicPerformance8, IDirectMusicLoader8,
  ;; IDirectMusicSegment8, IDirectMusicAudioPath8, IDirectMusicSegmentState8.
  ;;
  ;; Who needs it: the Game Maker 7/8 runner (Delphi) probes for a sound device
  ;; by CoCreateInstance(CLSID_DirectMusicPerformance, IID_IDirectMusic-
  ;; Performance8) + CoCreateInstance(CLSID_DirectMusicLoader, IID_IDirect-
  ;; MusicLoader8) + InitAudio(DMUS_APATH_DYNAMIC_STEREO, 64 pchannels,
  ;; DMUS_AUDIOF_ALL). Any failure shows "No sound device detected. Sounds
  ;; might not play." (Spelunky Classic, docs/re-notes/spelunky-classic.md).
  ;; The runner's sound unit (Spelunky.exe 0x485100..0x486500) then uses
  ;; exactly what is implemented here: per sound one CreateStandardAudioPath,
  ;; Loader GetObject(DMUS_OBJ_CLASS|DMUS_OBJ_MEMORY) or LoadObjectFromFile,
  ;; Segment SetParam(GUID_StandardMIDIFile)/Download/Unload/SetRepeats,
  ;; PlaySegmentEx (DMUS_SEGF_DEFAULT for background music, SECONDARY for
  ;; effects) returning a segment state, StopEx, IsPlaying, AudioPath
  ;; SetVolume, SetGlobalParam(GUID_PerfMasterVolume / GUID_PerfMasterTempo),
  ;; Loader ReleaseObjectByUnknown/CollectGarbage and CloseDown.
  ;;
  ;; Playback: segments are Standard MIDI Files (format 0/1, raw or RMID),
  ;; parsed and validated here at load. A playing segment is an instance in the
  ;; performance record; $dmusic_service, run once per run() slice, walks every
  ;; track's cursor and sends each due channel message through the same host
  ;; MIDI-out device midiOutShortMsg uses ($host_midi_out_short_msg; the
  ;; browser renders it with webaudio-tinysynth). Time is the guest clock
  ;; ($host_get_ticks), tempo comes from the file's tempo map scaled by
  ;; GUID_PerfMasterTempo, and volume (master + audiopath, centibels) scales
  ;; channel volume (CC7). A segment loops its whole length SetRepeats times.
  ;;
  ;; Deliberate limits, each a crash with a clear name rather than silence:
  ;; WAVE (.wav) and DirectMusic Producer (.sgt) segments, SMPTE timing,
  ;; format 2, transitions, non-immediate start/stop times, a caller-supplied
  ;; DirectSound, DMUS_AUDIOPARAMS, and every method no caller has reached.
  ;; CoCreateInstance only activates these classes for the DirectX 8 IIDs:
  ;; a DirectX 6/7 caller asking for IDirectMusicPerformance first would go on
  ;; to Init/AddPort, which are not implemented, and keeps the class-not-
  ;; registered answer it had before.
  ;;
  ;; Objects are DxObjects (one interface each, so QueryInterface returns the
  ;; same pointer): 61 performance, 62 loader, 63 segment, 64 audiopath,
  ;; 65 segment state. Larger state lives in guest-heap records:
  ;;   performance  misc0 MIDI handle, misc1 record, misc2 default audiopath,
  ;;                flags bit0 InitAudio done.
  ;;     record +0 master volume (cB) +4 master tempo (f32) +8 serial counter
  ;;            +64 eight 64-byte instances:
  ;;            +0 segment (ref held) +4 audiopath (ref held) +8 DMUS_SEGF flags
  ;;            +12 repeats left +16 tempo us/qn +20 serial +24 base ms (f64)
  ;;            +32 base tick +36 cursor block +40 CC7 per channel (16 bytes)
  ;;            +56 channels touched +60 gain (f32)
  ;;     cursor (16 bytes per track) +0 offset +4 next tick +8 running status
  ;;            +12 track end offset (0 = track finished)
  ;;   segment      misc1 record: +0 data +4 length +8 format +12 tracks
  ;;                +16 division +20 track table ({start,end} per track)
  ;;                +24 repeats +28 total ticks +32 downloaded +36 GM flag
  ;;   loader       misc1 record: +0 count +4.. cached objects (ref held)
  ;;   audiopath    misc0 volume (cB) misc1 DMUS_APATH type misc2 performance
  ;;                flags bit0 active
  ;;   state        misc0 performance misc1 instance index misc2 serial

  (global $DMUSIC_PERF_VTBL (mut i32) (i32.const 0))
  (global $DMUSIC_LOADER_VTBL (mut i32) (i32.const 0))
  (global $DMUSIC_SEG_VTBL (mut i32) (i32.const 0))
  (global $DMUSIC_PATH_VTBL (mut i32) (i32.const 0))
  (global $DMUSIC_STATE_VTBL (mut i32) (i32.const 0))
  ;; The initialized performance this instance's run() services (0 = none).
  (global $dmusic_perf (mut i32) (i32.const 0))
  ;; Channel messages sent to the host since start (diagnostics/tests).
  (global $dmusic_events_sent (mut i32) (i32.const 0))
  ;; Scratch outputs of $dm_vlq / $dm_parse_event.
  (global $dm_vpos (mut i32) (i32.const 0))
  (global $dm_ev_status (mut i32) (i32.const 0))
  (global $dm_ev_d1 (mut i32) (i32.const 0))
  (global $dm_ev_d2 (mut i32) (i32.const 0))
  (global $dm_ev_mtype (mut i32) (i32.const 0))
  (global $dm_ev_mpos (mut i32) (i32.const 0))
  (global $dm_ev_mlen (mut i32) (i32.const 0))

  (func $dmusic_init_vtables
    (if (i32.eqz (global.get $DMUSIC_PERF_VTBL))
      (then
        (global.set $DMUSIC_PERF_VTBL
          (call $init_com_vtable (global.get $API_ID_IDirectMusicPerformance8_BASE) (i32.const 54)))
        (global.set $DMUSIC_LOADER_VTBL
          (call $init_com_vtable (global.get $API_ID_IDirectMusicLoader8_BASE) (i32.const 15)))
        (global.set $DMUSIC_SEG_VTBL
          (call $init_com_vtable (global.get $API_ID_IDirectMusicSegment8_BASE) (i32.const 31)))
        (global.set $DMUSIC_PATH_VTBL
          (call $init_com_vtable (global.get $API_ID_IDirectMusicAudioPath8_BASE) (i32.const 7)))
        (global.set $DMUSIC_STATE_VTBL
          (call $init_com_vtable (global.get $API_ID_IDirectMusicSegmentState8_BASE) (i32.const 10))))))

  ;; ---- small helpers ------------------------------------------------------

  ;; Stack argument $i (0 = this) of the current stdcall frame.
  (func $dm_arg (param $i i32) (result i32)
    (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base))
      (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 2)))))

  ;; The DxObject entry of $obj when it is one of our COM wrappers of DX type
  ;; $type, else 0. Never dereferences a foreign pointer's slot field.
  (func $dm_entry (param $obj i32) (param $type i32) (result i32)
    (local $wa i32) (local $entry i32)
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $obj)))
    (if (i32.lt_u (local.get $wa) (global.get $COM_WRAPPERS)) (then (return (i32.const 0))))
    (if (i32.ge_u (i32.sub (local.get $wa) (global.get $COM_WRAPPERS))
          (i32.mul (global.get $DX_MAX) (i32.const 8)))
      (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (local.get $type))
      (then (return (i32.const 0))))
    (local.get $entry))

  (func $dm_tag (param $wa i32) (param $tag i32) (result i32)
    (i32.eq (i32.load (local.get $wa)) (local.get $tag)))

  ;; IUnknown, then up to three interface ids answered by one vtable.
  (func $dm_qi (param $obj i32) (param $iid i32) (param $out i32)
      (param $a0 i32) (param $a1 i32) (param $a2 i32) (param $a3 i32)
      (param $b0 i32) (param $b1 i32) (param $b2 i32) (param $b3 i32)
      (param $c0 i32) (param $c1 i32) (param $c2 i32) (param $c3 i32) (result i32)
    (local $wa i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80004003))))
    (if (i32.eqz (local.get $iid))
      (then
        (call $gs32 (local.get $out) (i32.const 0))
        (return (i32.const 0x80004003))))
    (local.set $wa (call $g2w (local.get $iid)))
    (call $dx_query_interface_result (local.get $obj) (local.get $out)
      (i32.or
        (i32.or
          (call $guid_words_equal (local.get $wa)
            (i32.const 0) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000))
          (call $guid_words_equal (local.get $wa)
            (local.get $a0) (local.get $a1) (local.get $a2) (local.get $a3)))
        (i32.or
          (call $guid_words_equal (local.get $wa)
            (local.get $b0) (local.get $b1) (local.get $b2) (local.get $b3))
          (call $guid_words_equal (local.get $wa)
            (local.get $c0) (local.get $c1) (local.get $c2) (local.get $c3))))))

  ;; IID_IDirectMusicPerformance8 {679C4137-C62E-4147-B2B4-9D569ACB254C}.
  (func $dm_is_perf8_iid (param $wa i32) (result i32)
    (call $guid_words_equal (local.get $wa)
      (i32.const 0x679C4137) (i32.const 0x4147C62E) (i32.const 0x569DB4B2) (i32.const 0x4C25CB9A)))
  ;; IID_IDirectMusicLoader8 {19E7C08C-0A44-4E6A-A116-595A7CD5DE8C}.
  (func $dm_is_loader8_iid (param $wa i32) (result i32)
    (call $guid_words_equal (local.get $wa)
      (i32.const 0x19E7C08C) (i32.const 0x4E6A0A44) (i32.const 0x5A5916A1) (i32.const 0x8CDED57C)))
  ;; {D2AC28xx-B39B-11D1-8704-00600893B1BD}: the DirectMusic CLSID/GUID family.
  (func $dm_is_d2ac (param $wa i32) (param $d0 i32) (result i32)
    (call $guid_words_equal (local.get $wa)
      (local.get $d0) (i32.const 0x11D1B39B) (i32.const 0x60000487) (i32.const 0xBDB19308)))

  ;; IUnknown / IDirectMusicSegment / Segment2 / Segment8 for a riid WA.
  (func $dm_is_segment_iid (param $wa i32) (result i32)
    (i32.or
      (i32.or
        (call $guid_words_equal (local.get $wa)
          (i32.const 0) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000))
        (call $guid_words_equal (local.get $wa)
          (i32.const 0xF96029A2) (i32.const 0x11D24282) (i32.const 0x60001787) (i32.const 0xBDB19308)))
      (i32.or
        (call $guid_words_equal (local.get $wa)
          (i32.const 0xD38894D1) (i32.const 0x11D2C052) (i32.const 0x60002F87) (i32.const 0xBDB19308))
        (call $guid_words_equal (local.get $wa)
          (i32.const 0xC6784488) (i32.const 0x418F41A3) (i32.const 0x50B315AA) (i32.const 0xD442BA93)))))

  ;; ---- object creation ----------------------------------------------------

  (func $dmusic_perf_create (result i32)
    (local $obj i32) (local $entry i32) (local $rec i32) (local $wa i32)
    (call $dmusic_init_vtables)
    (local.set $rec (call $heap_alloc (i32.const 576)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $rec)))
    (call $zero_memory (local.get $wa) (i32.const 576))
    (f32.store offset=4 (local.get $wa) (f32.const 1))
    (local.set $obj (call $dx_create_com_obj (i32.const 61) (global.get $DMUSIC_PERF_VTBL)))
    (if (i32.eqz (local.get $obj))
      (then (call $heap_free (local.get $rec)) (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject refcount (local.get $entry) (i32.const 1))
    (store.field DxObject misc0 (local.get $entry) (i32.const 0))
    (store.field DxObject misc1 (local.get $entry) (local.get $rec))
    (store.field DxObject misc2 (local.get $entry) (i32.const 0))
    (store.field DxObject flags (local.get $entry) (i32.const 0))
    (local.get $obj))

  (func $dmusic_loader_create (result i32)
    (local $obj i32) (local $entry i32) (local $rec i32)
    (call $dmusic_init_vtables)
    (local.set $rec (call $heap_alloc (i32.const 1028)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $zero_memory (call $g2w (local.get $rec)) (i32.const 1028))
    (local.set $obj (call $dx_create_com_obj (i32.const 62) (global.get $DMUSIC_LOADER_VTBL)))
    (if (i32.eqz (local.get $obj))
      (then (call $heap_free (local.get $rec)) (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject refcount (local.get $entry) (i32.const 1))
    (store.field DxObject misc1 (local.get $entry) (local.get $rec))
    (local.get $obj))

  (func $dm_path_create (param $perf i32) (param $type i32) (param $active i32) (result i32)
    (local $obj i32) (local $entry i32)
    (call $dmusic_init_vtables)
    (local.set $obj (call $dx_create_com_obj (i32.const 64) (global.get $DMUSIC_PATH_VTBL)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject refcount (local.get $entry) (i32.const 1))
    (store.field DxObject misc0 (local.get $entry) (i32.const 0))
    (store.field DxObject misc1 (local.get $entry) (local.get $type))
    (store.field DxObject misc2 (local.get $entry) (local.get $perf))
    (store.field DxObject flags (local.get $entry) (i32.ne (local.get $active) (i32.const 0)))
    (local.get $obj))

  (func $dm_valid_path_type (param $type i32) (result i32)
    (i32.or (i32.eq (local.get $type) (i32.const 1))
      (i32.and (i32.ge_u (local.get $type) (i32.const 6)) (i32.le_u (local.get $type) (i32.const 8)))))

  ;; ---- Standard MIDI File parsing -----------------------------------------

  ;; Variable-length quantity at $pos (< $end). Value, or -1 when malformed;
  ;; the next offset goes to $dm_vpos.
  (func $dm_vlq (param $data i32) (param $pos i32) (param $end i32) (result i32)
    (local $v i32) (local $b i32) (local $n i32)
    (loop $more
      (if (i32.ge_u (local.get $pos) (local.get $end)) (then (return (i32.const -1))))
      (local.set $b (i32.load8_u (i32.add (local.get $data) (local.get $pos))))
      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
      (local.set $v (i32.or (i32.shl (local.get $v) (i32.const 7))
        (i32.and (local.get $b) (i32.const 0x7F))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (if (i32.and (local.get $b) (i32.const 0x80))
        (then
          (if (i32.ge_u (local.get $n) (i32.const 4)) (then (return (i32.const -1))))
          (br $more))))
    (global.set $dm_vpos (local.get $pos))
    (local.get $v))

  ;; One event (no delta) at $pos. Returns the next offset or -1. Channel
  ;; messages leave status/d1/d2 in globals; meta events leave type, payload
  ;; offset and length; SysEx is skipped (status 0xF0/0xF7).
  (func $dm_parse_event (param $data i32) (param $pos i32) (param $end i32)
      (param $running i32) (result i32)
    (local $b i32) (local $status i32) (local $hi i32) (local $len i32)
    (if (i32.ge_u (local.get $pos) (local.get $end)) (then (return (i32.const -1))))
    (local.set $b (i32.load8_u (i32.add (local.get $data) (local.get $pos))))
    (if (i32.and (local.get $b) (i32.const 0x80))
      (then
        (local.set $status (local.get $b))
        (local.set $pos (i32.add (local.get $pos) (i32.const 1))))
      (else
        (if (i32.eqz (local.get $running)) (then (return (i32.const -1))))
        (local.set $status (local.get $running))))
    (global.set $dm_ev_status (local.get $status))
    (global.set $dm_ev_d2 (i32.const 0))
    (if (i32.lt_u (local.get $status) (i32.const 0xF0))
      (then
        (local.set $hi (i32.and (local.get $status) (i32.const 0xF0)))
        (local.set $len (select (i32.const 1) (i32.const 2)
          (i32.or (i32.eq (local.get $hi) (i32.const 0xC0)) (i32.eq (local.get $hi) (i32.const 0xD0)))))
        (if (i32.gt_u (i32.add (local.get $pos) (local.get $len)) (local.get $end))
          (then (return (i32.const -1))))
        (global.set $dm_ev_d1 (i32.and (i32.load8_u (i32.add (local.get $data) (local.get $pos))) (i32.const 0x7F)))
        (if (i32.eq (local.get $len) (i32.const 2))
          (then (global.set $dm_ev_d2 (i32.and
            (i32.load8_u offset=1 (i32.add (local.get $data) (local.get $pos))) (i32.const 0x7F)))))
        (return (i32.add (local.get $pos) (local.get $len)))))
    (if (i32.eq (local.get $status) (i32.const 0xFF))
      (then
        (if (i32.ge_u (local.get $pos) (local.get $end)) (then (return (i32.const -1))))
        (global.set $dm_ev_mtype (i32.load8_u (i32.add (local.get $data) (local.get $pos))))
        (local.set $len (call $dm_vlq (local.get $data) (i32.add (local.get $pos) (i32.const 1)) (local.get $end)))
        (if (i32.lt_s (local.get $len) (i32.const 0)) (then (return (i32.const -1))))
        (global.set $dm_ev_mpos (global.get $dm_vpos))
        (global.set $dm_ev_mlen (local.get $len))
        (if (i32.gt_u (i32.add (global.get $dm_vpos) (local.get $len)) (local.get $end))
          (then (return (i32.const -1))))
        (return (i32.add (global.get $dm_vpos) (local.get $len)))))
    (if (i32.or (i32.eq (local.get $status) (i32.const 0xF0)) (i32.eq (local.get $status) (i32.const 0xF7)))
      (then
        (local.set $len (call $dm_vlq (local.get $data) (local.get $pos) (local.get $end)))
        (if (i32.lt_s (local.get $len) (i32.const 0)) (then (return (i32.const -1))))
        (if (i32.gt_u (i32.add (global.get $dm_vpos) (local.get $len)) (local.get $end))
          (then (return (i32.const -1))))
        (return (i32.add (global.get $dm_vpos) (local.get $len)))))
    (i32.const -1))

  ;; Walk one track to its end: total ticks, or -1 when malformed.
  (func $dm_track_ticks (param $data i32) (param $pos i32) (param $end i32) (result i32)
    (local $tick i32) (local $delta i32) (local $running i32) (local $guard i32)
    (block $done (loop $ev
      (br_if $done (i32.ge_u (local.get $pos) (local.get $end)))
      (local.set $delta (call $dm_vlq (local.get $data) (local.get $pos) (local.get $end)))
      (if (i32.lt_s (local.get $delta) (i32.const 0)) (then (return (i32.const -1))))
      (local.set $tick (i32.add (local.get $tick) (local.get $delta)))
      (if (i32.lt_s (local.get $tick) (i32.const 0)) (then (return (i32.const -1))))
      (local.set $pos (call $dm_parse_event (local.get $data) (global.get $dm_vpos)
        (local.get $end) (local.get $running)))
      (if (i32.lt_s (local.get $pos) (i32.const 0)) (then (return (i32.const -1))))
      (if (i32.lt_u (global.get $dm_ev_status) (i32.const 0xF0))
        (then (local.set $running (global.get $dm_ev_status))))
      (br_if $done (i32.and (i32.eq (global.get $dm_ev_status) (i32.const 0xFF))
        (i32.eq (global.get $dm_ev_mtype) (i32.const 0x2F))))
      (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
      (br $ev)))
    (local.get $tick))

  ;; Build a segment record from $len bytes at heap block $data_gp, which the
  ;; record then owns. Returns the record (guest), or an HRESULT error as a
  ;; negative value. Unsupported container kinds crash with their name.
  (func $dm_segment_record (param $data_gp i32) (param $len i32) (result i32)
    (local $data i32) (local $smf i32) (local $smf_end i32) (local $pos i32)
    (local $clen i32) (local $hdr i32) (local $format i32) (local $ntracks i32)
    (local $division i32) (local $tracks i32) (local $twa i32) (local $found i32)
    (local $start i32) (local $tend i32) (local $ticks i32) (local $total i32)
    (local $rec i32) (local $rwa i32) (local $i i32)
    (local.set $data (call $g2w (local.get $data_gp)))
    (if (i32.lt_u (local.get $len) (i32.const 14)) (then (return (i32.const 0x88781150))))
    (local.set $smf_end (local.get $len))
    ;; "RIFF": RMID wraps an SMF in its "data" chunk; WAVE and DMSG are other
    ;; DirectMusic object kinds this implementation does not play.
    (if (call $dm_tag (local.get $data) (i32.const 0x46464952))
      (then
        (if (call $dm_tag (i32.add (local.get $data) (i32.const 8)) (i32.const 0x45564157))
          (then (call $crash_unimplemented "DirectMusic segment from RIFF WAVE (wave playback)")))
        (if (call $dm_tag (i32.add (local.get $data) (i32.const 8)) (i32.const 0x47534D44))
          (then (call $crash_unimplemented "DirectMusic segment file (RIFF DMSG .sgt)")))
        (if (i32.eqz (call $dm_tag (i32.add (local.get $data) (i32.const 8)) (i32.const 0x44494D52)))
          (then (return (i32.const 0x88781150)))) ;; DMUS_E_UNSUPPORTED_STREAM
        (local.set $pos (i32.const 12))
        (local.set $smf (i32.const -1))
        (block $found_data (loop $chunk
          (br_if $found_data (i32.gt_u (i32.add (local.get $pos) (i32.const 8)) (local.get $len)))
          (local.set $clen (i32.load offset=4 (i32.add (local.get $data) (local.get $pos))))
          (if (call $dm_tag (i32.add (local.get $data) (local.get $pos)) (i32.const 0x61746164))
            (then
              (local.set $smf (i32.add (local.get $pos) (i32.const 8)))
              (local.set $smf_end (i32.add (local.get $smf) (local.get $clen)))
              (if (i32.or (i32.gt_u (local.get $smf_end) (local.get $len))
                    (i32.lt_u (local.get $smf_end) (local.get $smf)))
                (then (local.set $smf_end (local.get $len))))
              (br $found_data)))
          (local.set $pos (i32.add (local.get $pos)
            (i32.add (i32.const 8) (i32.and (i32.add (local.get $clen) (i32.const 1)) (i32.const -2)))))
          (br_if $found_data (i32.lt_u (local.get $pos) (i32.const 12)))
          (br $chunk)))
        (if (i32.lt_s (local.get $smf) (i32.const 0)) (then (return (i32.const 0x88781200)))))
      (else (local.set $smf (i32.const 0))))
    ;; "MThd", header length >= 6, then format / ntracks / division.
    (if (i32.gt_u (i32.add (local.get $smf) (i32.const 14)) (local.get $smf_end))
      (then (return (i32.const 0x88781200))))
    (if (i32.eqz (call $dm_tag (i32.add (local.get $data) (local.get $smf)) (i32.const 0x6468544D)))
      (then (return (i32.const 0x88781150)))) ;; DMUS_E_UNSUPPORTED_STREAM
    (local.set $hdr (call $vid_be32 (i32.add (local.get $data) (i32.add (local.get $smf) (i32.const 4)))))
    (local.set $format (call $vid_be16 (i32.add (local.get $data) (i32.add (local.get $smf) (i32.const 8)))))
    (local.set $ntracks (call $vid_be16 (i32.add (local.get $data) (i32.add (local.get $smf) (i32.const 10)))))
    (local.set $division (call $vid_be16 (i32.add (local.get $data) (i32.add (local.get $smf) (i32.const 12)))))
    (if (i32.or (i32.lt_u (local.get $hdr) (i32.const 6))
          (i32.or (i32.eqz (local.get $ntracks)) (i32.eqz (local.get $division))))
      (then (return (i32.const 0x88781200)))) ;; DMUS_E_INVALIDFILE
    (if (i32.and (local.get $division) (i32.const 0x8000))
      (then (call $crash_unimplemented "DirectMusic SMF with SMPTE time division")))
    (if (i32.gt_u (local.get $format) (i32.const 1))
      (then (call $crash_unimplemented "DirectMusic SMF format 2")))
    (local.set $tracks (call $heap_alloc (i32.shl (local.get $ntracks) (i32.const 3))))
    (if (i32.eqz (local.get $tracks)) (then (return (i32.const 0x8007000E))))
    (local.set $twa (call $g2w (local.get $tracks)))
    ;; Track chunks; others are skipped. A chunk length running past the file
    ;; is clipped to it, as players commonly do for truncated files.
    (local.set $pos (i32.add (local.get $smf) (i32.add (i32.const 8) (local.get $hdr))))
    (block $chunks_done (loop $chunks
      (br_if $chunks_done (i32.ge_u (local.get $found) (local.get $ntracks)))
      (br_if $chunks_done (i32.gt_u (i32.add (local.get $pos) (i32.const 8)) (local.get $smf_end)))
      (local.set $clen (call $vid_be32 (i32.add (local.get $data) (i32.add (local.get $pos) (i32.const 4)))))
      (local.set $start (i32.add (local.get $pos) (i32.const 8)))
      (local.set $tend (i32.add (local.get $start) (local.get $clen)))
      (if (i32.or (i32.gt_u (local.get $tend) (local.get $smf_end)) (i32.lt_u (local.get $tend) (local.get $start)))
        (then (local.set $tend (local.get $smf_end))))
      (if (call $dm_tag (i32.add (local.get $data) (local.get $pos)) (i32.const 0x6B72544D))
        (then
          (local.set $ticks (call $dm_track_ticks (local.get $data) (local.get $start) (local.get $tend)))
          (if (i32.lt_s (local.get $ticks) (i32.const 0))
            (then (call $heap_free (local.get $tracks)) (return (i32.const 0x88781200))))
          (if (i32.gt_u (local.get $ticks) (local.get $total)) (then (local.set $total (local.get $ticks))))
          (i32.store (i32.add (local.get $twa) (i32.shl (local.get $found) (i32.const 3))) (local.get $start))
          (i32.store offset=4 (i32.add (local.get $twa) (i32.shl (local.get $found) (i32.const 3))) (local.get $tend))
          (local.set $found (i32.add (local.get $found) (i32.const 1)))))
      (local.set $pos (local.get $tend))
      (br $chunks)))
    (if (i32.eqz (local.get $found))
      (then (call $heap_free (local.get $tracks)) (return (i32.const 0x88781200))))
    (local.set $rec (call $heap_alloc (i32.const 64)))
    (if (i32.eqz (local.get $rec))
      (then (call $heap_free (local.get $tracks)) (return (i32.const 0x8007000E))))
    (local.set $rwa (call $g2w (local.get $rec)))
    (call $zero_memory (local.get $rwa) (i32.const 64))
    (i32.store offset=0 (local.get $rwa) (local.get $data_gp))
    (i32.store offset=4 (local.get $rwa) (local.get $len))
    (i32.store offset=8 (local.get $rwa) (local.get $format))
    (i32.store offset=12 (local.get $rwa) (local.get $found))
    (i32.store offset=16 (local.get $rwa) (local.get $division))
    (i32.store offset=20 (local.get $rwa) (local.get $tracks))
    (i32.store offset=28 (local.get $rwa) (local.get $total))
    (local.get $rec))

  ;; Wrap a heap SMF buffer in a segment object (refcount 1). Frees the
  ;; buffer on failure. Result: object, or a negative HRESULT.
  (func $dm_segment_from_heap (param $data_gp i32) (param $len i32) (result i32)
    (local $rec i32) (local $obj i32) (local $entry i32)
    (local.set $rec (call $dm_segment_record (local.get $data_gp) (local.get $len)))
    (if (i32.lt_s (local.get $rec) (i32.const 0))
      (then (call $heap_free (local.get $data_gp)) (return (local.get $rec))))
    (call $dmusic_init_vtables)
    (local.set $obj (call $dx_create_com_obj (i32.const 63) (global.get $DMUSIC_SEG_VTBL)))
    (if (i32.eqz (local.get $obj))
      (then
        (call $dm_segment_record_free (local.get $rec))
        (return (i32.const 0x8007000E))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject refcount (local.get $entry) (i32.const 1))
    (store.field DxObject misc1 (local.get $entry) (local.get $rec))
    (local.get $obj))

  (func $dm_segment_record_free (param $rec i32)
    (local $wa i32)
    (if (i32.eqz (local.get $rec)) (then (return)))
    (local.set $wa (call $g2w (local.get $rec)))
    (if (i32.load offset=0 (local.get $wa)) (then (call $heap_free (i32.load offset=0 (local.get $wa)))))
    (if (i32.load offset=20 (local.get $wa)) (then (call $heap_free (i32.load offset=20 (local.get $wa)))))
    (call $heap_free (local.get $rec)))

  ;; Copy $len guest bytes (any mapping) into a fresh heap block, then parse.
  (func $dm_segment_from_guest (param $src i32) (param $len i32) (result i32)
    (local $buf i32) (local $wa i32) (local $i i32)
    (if (i32.or (i32.eqz (local.get $src)) (i32.eqz (local.get $len)))
      (then (return (i32.const 0x80070057))))
    (local.set $buf (call $heap_alloc (local.get $len)))
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 0x8007000E))))
    (local.set $wa (call $g2w (local.get $buf)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (i32.store8 (i32.add (local.get $wa) (local.get $i))
        (call $gl8 (i32.add (local.get $src) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $dm_segment_from_heap (local.get $buf) (local.get $len)))

  ;; Read a whole file named by a guest wide string, then parse it.
  (func $dm_segment_from_file (param $path i32) (result i32)
    (local $handle i32) (local $size i32) (local $buf i32) (local $got i32) (local $ok i32)
    (local.set $handle (call $host_fs_create_file (call $g2w (local.get $path))
      (i32.const 0x80000000) (i32.const 3) (i32.const 0x80) (i32.const 1)))
    (if (i32.eq (local.get $handle) (i32.const -1)) (then (return (i32.const 0x88781182))))
    (local.set $size (call $host_fs_get_file_size (local.get $handle)))
    (if (i32.or (i32.le_s (local.get $size) (i32.const 0)) (i32.gt_u (local.get $size) (i32.const 0x01000000)))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (return (i32.const 0x88781200))))
    (local.set $buf (call $heap_alloc (local.get $size)))
    (local.set $got (call $heap_alloc (i32.const 4)))
    (if (i32.or (i32.eqz (local.get $buf)) (i32.eqz (local.get $got)))
      (then
        (if (local.get $buf) (then (call $heap_free (local.get $buf))))
        (if (local.get $got) (then (call $heap_free (local.get $got))))
        (drop (call $host_fs_close_handle (local.get $handle)))
        (return (i32.const 0x8007000E))))
    (call $gs32 (local.get $got) (i32.const 0))
    (local.set $ok (call $host_fs_read_file (local.get $handle) (local.get $buf)
      (local.get $size) (local.get $got)))
    (if (i32.and (i32.eqz (local.get $ok)) (i32.ne (call $host_fs_read_pending) (i32.const 0)))
      (then (call $crash_unimplemented "DirectMusic LoadObjectFromFile on a lazily mounted file")))
    (drop (call $host_fs_close_handle (local.get $handle)))
    (if (i32.or (i32.eqz (local.get $ok)) (i32.ne (call $gl32 (local.get $got)) (local.get $size)))
      (then
        (call $heap_free (local.get $buf))
        (call $heap_free (local.get $got))
        (return (i32.const 0x88781182))))
    (call $heap_free (local.get $got))
    (call $dm_segment_from_heap (local.get $buf) (local.get $size)))

  ;; ---- reference counting -------------------------------------------------

  (func $dm_segment_release (param $obj i32) (result i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.gt_s (local.get $rc) (i32.const 0)) (then (return (local.get $rc))))
    (call $dm_segment_record_free (load.field DxObject misc1 (local.get $entry)))
    (store.field DxObject misc1 (local.get $entry) (i32.const 0))
    (call $dx_free (local.get $entry))
    (i32.const 0))

  ;; Release any object this file created, through its own teardown.
  (func $dmusic_release (param $obj i32) (result i32)
    (if (call $dm_entry (local.get $obj) (i32.const 63))
      (then (return (call $dm_segment_release (local.get $obj)))))
    (if (call $dm_entry (local.get $obj) (i32.const 61))
      (then (return (call $dm_perf_release (local.get $obj)))))
    (if (call $dm_entry (local.get $obj) (i32.const 62))
      (then (return (call $dm_loader_release (local.get $obj)))))
    (call $dx_com_release_basic (local.get $obj)))

  (func $dm_loader_release (param $obj i32) (result i32)
    (local $entry i32) (local $rc i32) (local $wa i32) (local $i i32) (local $n i32)
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.gt_s (local.get $rc) (i32.const 0)) (then (return (local.get $rc))))
    (local.set $wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (local.set $n (i32.load (local.get $wa)))
    (i32.store (local.get $wa) (i32.const 0))
    (block $done (loop $drop_cache
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (drop (call $dmusic_release
        (i32.load offset=4 (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 2))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $drop_cache)))
    (call $heap_free (load.field DxObject misc1 (local.get $entry)))
    (call $dx_free (local.get $entry))
    (i32.const 0))

  (func $dm_perf_release (param $obj i32) (result i32)
    (local $entry i32) (local $rc i32)
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $rc (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.gt_s (local.get $rc) (i32.const 0)) (then (return (local.get $rc))))
    (call $dm_perf_close (local.get $obj))
    (call $heap_free (load.field DxObject misc1 (local.get $entry)))
    (call $dx_free (local.get $entry))
    (i32.const 0))

  ;; ---- the sequencer ------------------------------------------------------

  (func $dm_now (result f64)
    (f64.convert_i32_u (call $host_get_ticks)))

  (func $dm_inst (param $rec_wa i32) (param $i i32) (result i32)
    (i32.add (local.get $rec_wa) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 6)))))

  ;; Milliseconds per tick for an instance of a segment with $division.
  (func $dm_mspt (param $rec_wa i32) (param $inst i32) (param $division i32) (result f64)
    (f64.div (f64.convert_i32_u (i32.load offset=16 (local.get $inst)))
      (f64.mul (f64.mul (f64.convert_i32_u (local.get $division)) (f64.const 1000))
        (f64.promote_f32 (f32.load offset=4 (local.get $rec_wa))))))

  ;; Linear gain of master + audiopath volume (centibels; 0 = unity).
  (func $dm_gain (param $rec_wa i32) (param $path i32) (result f32)
    (local $cb i32) (local $pe i32)
    (local.set $cb (i32.load offset=0 (local.get $rec_wa)))
    (local.set $pe (call $dm_entry (local.get $path) (i32.const 64)))
    (if (local.get $pe)
      (then (local.set $cb (i32.add (local.get $cb) (load.field DxObject misc0 (local.get $pe))))))
    (if (i32.ge_s (local.get $cb) (i32.const 0)) (then (return (f32.const 1))))
    (if (i32.le_s (local.get $cb) (i32.const -9600)) (then (return (f32.const 0))))
    (f32.demote_f64 (call $host_math_pow (f64.const 10)
      (f64.div (f64.convert_i32_s (local.get $cb)) (f64.const 2000)))))

  (func $dm_scaled (param $inst i32) (param $v i32) (result i32)
    (local $s i32)
    (local.set $s (i32.trunc_sat_f32_s (f32.add (f32.const 0.5)
      (f32.mul (f32.convert_i32_u (local.get $v)) (f32.load offset=60 (local.get $inst))))))
    (select (i32.const 127) (local.get $s) (i32.gt_s (local.get $s) (i32.const 127))))

  (func $dm_short (param $handle i32) (param $msg i32)
    (global.set $dmusic_events_sent (i32.add (global.get $dmusic_events_sent) (i32.const 1)))
    (drop (call $host_midi_out_short_msg (local.get $handle) (local.get $msg))))

  ;; Send one channel message for an instance. The first message on a channel
  ;; first sets its scaled default volume; CC7 is scaled by the gain.
  (func $dm_send (param $handle i32) (param $inst i32) (param $status i32)
      (param $d1 i32) (param $d2 i32)
    (local $ch i32) (local $bit i32)
    (local.set $ch (i32.and (local.get $status) (i32.const 0x0F)))
    (local.set $bit (i32.shl (i32.const 1) (local.get $ch)))
    (if (i32.eqz (i32.and (i32.load offset=56 (local.get $inst)) (local.get $bit)))
      (then
        (i32.store offset=56 (local.get $inst)
          (i32.or (i32.load offset=56 (local.get $inst)) (local.get $bit)))
        (call $dm_short (local.get $handle) (i32.or (i32.or (i32.const 0x07B0) (local.get $ch))
          (i32.shl (call $dm_scaled (local.get $inst)
            (i32.load8_u offset=40 (i32.add (local.get $inst) (local.get $ch)))) (i32.const 16))))))
    (if (i32.and (i32.eq (i32.and (local.get $status) (i32.const 0xF0)) (i32.const 0xB0))
          (i32.eq (local.get $d1) (i32.const 7)))
      (then
        (i32.store8 offset=40 (i32.add (local.get $inst) (local.get $ch)) (local.get $d2))
        (local.set $d2 (call $dm_scaled (local.get $inst) (local.get $d2)))))
    (call $dm_short (local.get $handle)
      (i32.or (local.get $status)
        (i32.or (i32.shl (local.get $d1) (i32.const 8)) (i32.shl (local.get $d2) (i32.const 16))))))

  ;; Point every track cursor at its first event (tempo back to 120 bpm).
  (func $dm_inst_rewind (param $inst i32) (param $seg_wa i32)
    (local $data i32) (local $twa i32) (local $cur i32) (local $c i32) (local $t i32)
    (local $n i32) (local $start i32) (local $end i32) (local $delta i32)
    (local.set $data (call $g2w (i32.load offset=0 (local.get $seg_wa))))
    (local.set $twa (call $g2w (i32.load offset=20 (local.get $seg_wa))))
    (local.set $cur (call $g2w (i32.load offset=36 (local.get $inst))))
    (local.set $n (i32.load offset=12 (local.get $seg_wa)))
    (i32.store offset=16 (local.get $inst) (i32.const 500000))
    (block $done (loop $tracks
      (br_if $done (i32.ge_u (local.get $t) (local.get $n)))
      (local.set $c (i32.add (local.get $cur) (i32.shl (local.get $t) (i32.const 4))))
      (local.set $start (i32.load (i32.add (local.get $twa) (i32.shl (local.get $t) (i32.const 3)))))
      (local.set $end (i32.load offset=4 (i32.add (local.get $twa) (i32.shl (local.get $t) (i32.const 3)))))
      (i32.store offset=8 (local.get $c) (i32.const 0))
      (local.set $delta (call $dm_vlq (local.get $data) (local.get $start) (local.get $end)))
      (if (i32.lt_s (local.get $delta) (i32.const 0))
        (then (i32.store offset=12 (local.get $c) (i32.const 0)))
        (else
          (i32.store offset=0 (local.get $c) (global.get $dm_vpos))
          (i32.store offset=4 (local.get $c) (local.get $delta))
          (i32.store offset=12 (local.get $c) (local.get $end))))
      (local.set $t (i32.add (local.get $t) (i32.const 1)))
      (br $tracks))))

  ;; Silence what this instance sounded, drop its references, free its slot.
  (func $dm_inst_stop (param $handle i32) (param $inst i32)
    (local $ch i32) (local $mask i32) (local $seg i32) (local $path i32) (local $cur i32)
    (local.set $seg (i32.load offset=0 (local.get $inst)))
    (if (i32.eqz (local.get $seg)) (then (return)))
    (local.set $mask (i32.load offset=56 (local.get $inst)))
    (block $done (loop $chans
      (br_if $done (i32.ge_u (local.get $ch) (i32.const 16)))
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $ch)))
        (then
          ;; Sustain off, then All Notes Off.
          (call $dm_short (local.get $handle) (i32.or (i32.const 0x40B0) (local.get $ch)))
          (call $dm_short (local.get $handle) (i32.or (i32.const 0x7BB0) (local.get $ch)))))
      (local.set $ch (i32.add (local.get $ch) (i32.const 1)))
      (br $chans)))
    (local.set $path (i32.load offset=4 (local.get $inst)))
    (local.set $cur (i32.load offset=36 (local.get $inst)))
    (call $zero_memory (local.get $inst) (i32.const 64))
    (if (local.get $cur) (then (call $heap_free (local.get $cur))))
    (drop (call $dm_segment_release (local.get $seg)))
    (if (local.get $path) (then (drop (call $dx_com_release_basic (local.get $path))))))

  ;; Deliver an instance's due events up to $now; loop or finish at its end.
  (func $dm_inst_service (param $handle i32) (param $rec_wa i32) (param $inst i32) (param $now f64)
    (local $seg_wa i32) (local $data i32) (local $cur i32) (local $n i32) (local $div i32)
    (local $t i32) (local $best i32) (local $best_tick i32) (local $c i32) (local $tick i32)
    (local $ev_ms f64) (local $end_ms f64) (local $reps i32) (local $total i32)
    (local $pos i32) (local $guard i32) (local $hi i32) (local $delta i32)
    (local.set $seg_wa (call $g2w (load.field DxObject misc1
      (call $dx_from_this (i32.load offset=0 (local.get $inst))))))
    (local.set $data (call $g2w (i32.load offset=0 (local.get $seg_wa))))
    (local.set $n (i32.load offset=12 (local.get $seg_wa)))
    (local.set $div (i32.load offset=16 (local.get $seg_wa)))
    (local.set $total (i32.load offset=28 (local.get $seg_wa)))
    (local.set $cur (call $g2w (i32.load offset=36 (local.get $inst))))
    (block $out (loop $ev
      (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
      (br_if $out (i32.gt_u (local.get $guard) (i32.const 65536)))
      (local.set $best (i32.const -1))
      (local.set $best_tick (i32.const -1))
      (local.set $t (i32.const 0))
      (block $scanned (loop $scan
        (br_if $scanned (i32.ge_u (local.get $t) (local.get $n)))
        (local.set $c (i32.add (local.get $cur) (i32.shl (local.get $t) (i32.const 4))))
        (if (i32.and (i32.ne (i32.load offset=12 (local.get $c)) (i32.const 0))
              (i32.lt_u (i32.load offset=4 (local.get $c)) (local.get $best_tick)))
          (then
            (local.set $best (local.get $t))
            (local.set $best_tick (i32.load offset=4 (local.get $c)))))
        (local.set $t (i32.add (local.get $t) (i32.const 1)))
        (br $scan)))
      (if (i32.lt_s (local.get $best) (i32.const 0))
        (then
          ;; Every track has ended: the segment ends at its last event.
          (local.set $end_ms (f64.add (f64.load offset=24 (local.get $inst))
            (f64.mul (f64.convert_i32_s (i32.sub (local.get $total) (i32.load offset=32 (local.get $inst))))
              (call $dm_mspt (local.get $rec_wa) (local.get $inst) (local.get $div)))))
          (br_if $out (f64.gt (local.get $end_ms) (local.get $now)))
          (local.set $reps (i32.load offset=12 (local.get $inst)))
          (if (i32.or (i32.eqz (local.get $reps)) (i32.eqz (local.get $total)))
            (then
              (call $dm_inst_stop (local.get $handle) (local.get $inst))
              (br $out)))
          (if (i32.ne (local.get $reps) (i32.const -1))
            (then (i32.store offset=12 (local.get $inst) (i32.sub (local.get $reps) (i32.const 1)))))
          (call $dm_inst_rewind (local.get $inst) (local.get $seg_wa))
          (f64.store offset=24 (local.get $inst) (local.get $end_ms))
          (i32.store offset=32 (local.get $inst) (i32.const 0))
          (br $ev)))
      (local.set $c (i32.add (local.get $cur) (i32.shl (local.get $best) (i32.const 4))))
      (local.set $tick (local.get $best_tick))
      (local.set $ev_ms (f64.add (f64.load offset=24 (local.get $inst))
        (f64.mul (f64.convert_i32_s (i32.sub (local.get $tick) (i32.load offset=32 (local.get $inst))))
          (call $dm_mspt (local.get $rec_wa) (local.get $inst) (local.get $div)))))
      (br_if $out (f64.gt (local.get $ev_ms) (local.get $now)))
      (local.set $pos (call $dm_parse_event (local.get $data) (i32.load offset=0 (local.get $c))
        (i32.load offset=12 (local.get $c)) (i32.load offset=8 (local.get $c))))
      (if (i32.lt_s (local.get $pos) (i32.const 0))
        (then (i32.store offset=12 (local.get $c) (i32.const 0)) (br $ev)))
      (if (i32.lt_u (global.get $dm_ev_status) (i32.const 0xF0))
        (then
          (i32.store offset=8 (local.get $c) (global.get $dm_ev_status))
          (local.set $hi (i32.and (global.get $dm_ev_status) (i32.const 0xF0)))
          ;; A note-on more than a second late (the guest stalled) is dropped
          ;; rather than sounded in a burst; everything else still applies.
          (if (i32.eqz (i32.and
                (i32.and (i32.eq (local.get $hi) (i32.const 0x90)) (i32.ne (global.get $dm_ev_d2) (i32.const 0)))
                (f64.gt (f64.sub (local.get $now) (local.get $ev_ms)) (f64.const 1000))))
            (then (call $dm_send (local.get $handle) (local.get $inst)
              (global.get $dm_ev_status) (global.get $dm_ev_d1) (global.get $dm_ev_d2))))))
      (if (i32.eq (global.get $dm_ev_status) (i32.const 0xFF))
        (then
          (if (i32.eq (global.get $dm_ev_mtype) (i32.const 0x2F))
            (then (i32.store offset=12 (local.get $c) (i32.const 0)) (br $ev)))
          ;; Set Tempo: rebase the clock at this event.
          (if (i32.and (i32.eq (global.get $dm_ev_mtype) (i32.const 0x51))
                (i32.ge_u (global.get $dm_ev_mlen) (i32.const 3)))
            (then
              (local.set $delta (i32.or (i32.shl (i32.load8_u (i32.add (local.get $data) (global.get $dm_ev_mpos))) (i32.const 16))
                (i32.or (i32.shl (i32.load8_u offset=1 (i32.add (local.get $data) (global.get $dm_ev_mpos))) (i32.const 8))
                  (i32.load8_u offset=2 (i32.add (local.get $data) (global.get $dm_ev_mpos))))))
              (if (local.get $delta)
                (then
                  (f64.store offset=24 (local.get $inst) (local.get $ev_ms))
                  (i32.store offset=32 (local.get $inst) (local.get $tick))
                  (i32.store offset=16 (local.get $inst) (local.get $delta))))))))
      (if (i32.ge_u (local.get $pos) (i32.load offset=12 (local.get $c)))
        (then (i32.store offset=12 (local.get $c) (i32.const 0)) (br $ev)))
      (local.set $delta (call $dm_vlq (local.get $data) (local.get $pos) (i32.load offset=12 (local.get $c))))
      (if (i32.lt_s (local.get $delta) (i32.const 0))
        (then (i32.store offset=12 (local.get $c) (i32.const 0)) (br $ev)))
      (i32.store offset=0 (local.get $c) (global.get $dm_vpos))
      (i32.store offset=4 (local.get $c) (i32.add (local.get $tick) (local.get $delta)))
      (br $ev))))

  (func $dm_perf_service (param $perf i32) (param $now f64)
    (local $entry i32) (local $rec_wa i32) (local $i i32) (local $inst i32)
    (local.set $entry (call $dm_entry (local.get $perf) (i32.const 61)))
    (if (i32.eqz (local.get $entry)) (then (return)))
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (block $done (loop $insts
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (local.set $inst (call $dm_inst (local.get $rec_wa) (local.get $i)))
      (if (i32.load offset=0 (local.get $inst))
        (then (call $dm_inst_service (load.field DxObject misc0 (local.get $entry))
          (local.get $rec_wa) (local.get $inst) (local.get $now))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $insts))))

  ;; Called at each run() slice entry (13-exports.wat).
  (func $dmusic_service
    (if (global.get $dmusic_perf)
      (then (call $dm_perf_service (global.get $dmusic_perf) (call $dm_now)))))

  ;; Recompute every instance's gain; re-send the scaled CC7 of each channel
  ;; it has touched so a volume change is heard mid-note.
  (func $dm_refresh_gain (param $entry i32)
    (local $rec_wa i32) (local $i i32) (local $inst i32) (local $ch i32)
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (block $done (loop $insts
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (local.set $inst (call $dm_inst (local.get $rec_wa) (local.get $i)))
      (if (i32.load offset=0 (local.get $inst))
        (then
          (f32.store offset=60 (local.get $inst)
            (call $dm_gain (local.get $rec_wa) (i32.load offset=4 (local.get $inst))))
          (local.set $ch (i32.const 0))
          (block $chans_done (loop $chans
            (br_if $chans_done (i32.ge_u (local.get $ch) (i32.const 16)))
            (if (i32.and (i32.load offset=56 (local.get $inst)) (i32.shl (i32.const 1) (local.get $ch)))
              (then (call $dm_short (load.field DxObject misc0 (local.get $entry))
                (i32.or (i32.or (i32.const 0x07B0) (local.get $ch))
                  (i32.shl (call $dm_scaled (local.get $inst)
                    (i32.load8_u offset=40 (i32.add (local.get $inst) (local.get $ch)))) (i32.const 16))))))
            (local.set $ch (i32.add (local.get $ch) (i32.const 1)))
            (br $chans)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $insts))))

  ;; Before the master tempo changes: re-anchor each instance at the tick it
  ;; has reached now, so elapsed time is not re-scaled by the new tempo.
  (func $dm_rebase (param $entry i32) (param $now f64)
    (local $rec_wa i32) (local $i i32) (local $inst i32) (local $seg_wa i32)
    (local $mspt f64) (local $ticks i32)
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (block $done (loop $insts
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (local.set $inst (call $dm_inst (local.get $rec_wa) (local.get $i)))
      (if (i32.load offset=0 (local.get $inst))
        (then
          (local.set $seg_wa (call $g2w (load.field DxObject misc1
            (call $dx_from_this (i32.load offset=0 (local.get $inst))))))
          (local.set $mspt (call $dm_mspt (local.get $rec_wa) (local.get $inst)
            (i32.load offset=16 (local.get $seg_wa))))
          (if (f64.gt (local.get $now) (f64.load offset=24 (local.get $inst)))
            (then
              (local.set $ticks (i32.trunc_sat_f64_s (f64.div
                (f64.sub (local.get $now) (f64.load offset=24 (local.get $inst))) (local.get $mspt))))
              (f64.store offset=24 (local.get $inst) (f64.add (f64.load offset=24 (local.get $inst))
                (f64.mul (f64.convert_i32_s (local.get $ticks)) (local.get $mspt))))
              (i32.store offset=32 (local.get $inst)
                (i32.add (i32.load offset=32 (local.get $inst)) (local.get $ticks)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $insts))))

  ;; Stop everything, drop the default path, close the MIDI device.
  (func $dm_perf_close (param $perf i32)
    (local $entry i32) (local $rec_wa i32) (local $i i32) (local $handle i32)
    (local.set $entry (call $dx_from_this (local.get $perf)))
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (local.set $handle (load.field DxObject misc0 (local.get $entry)))
    (block $done (loop $insts
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (call $dm_inst_stop (local.get $handle) (call $dm_inst (local.get $rec_wa) (local.get $i)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $insts)))
    (if (load.field DxObject misc2 (local.get $entry))
      (then (drop (call $dx_com_release_basic (load.field DxObject misc2 (local.get $entry))))))
    (store.field DxObject misc2 (local.get $entry) (i32.const 0))
    (if (local.get $handle) (then (drop (call $host_midi_out_close (local.get $handle)))))
    (store.field DxObject misc0 (local.get $entry) (i32.const 0))
    (store.field DxObject flags (local.get $entry) (i32.const 0))
    (if (i32.eq (global.get $dmusic_perf) (local.get $perf))
      (then (global.set $dmusic_perf (i32.const 0)))))

  ;; Stop the instances matching segment / state / audiopath ($obj, of DX
  ;; type $type), or every instance when $type is 0.
  (func $dm_stop_matching (param $entry i32) (param $obj i32) (param $type i32)
    (local $rec_wa i32) (local $i i32) (local $inst i32) (local $hit i32) (local $se i32)
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (if (i32.eq (local.get $type) (i32.const 65))
      (then (local.set $se (call $dx_from_this (local.get $obj)))))
    (block $done (loop $insts
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (local.set $inst (call $dm_inst (local.get $rec_wa) (local.get $i)))
      (local.set $hit (i32.ne (i32.load offset=0 (local.get $inst)) (i32.const 0)))
      (if (i32.eq (local.get $type) (i32.const 63))
        (then (local.set $hit (i32.and (local.get $hit)
          (i32.eq (i32.load offset=0 (local.get $inst)) (local.get $obj))))))
      (if (i32.eq (local.get $type) (i32.const 64))
        (then (local.set $hit (i32.and (local.get $hit)
          (i32.eq (i32.load offset=4 (local.get $inst)) (local.get $obj))))))
      (if (i32.eq (local.get $type) (i32.const 65))
        (then (local.set $hit (i32.and (local.get $hit)
          (i32.and (i32.eq (load.field DxObject misc1 (local.get $se)) (local.get $i))
            (i32.eq (load.field DxObject misc2 (local.get $se)) (i32.load offset=20 (local.get $inst))))))))
      (if (local.get $hit)
        (then (call $dm_inst_stop (load.field DxObject misc0 (local.get $entry)) (local.get $inst))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $insts))))

  ;; ---- IDirectMusicPerformance8 -------------------------------------------

  (func $dm_perf_qi_wa (param $obj i32) (param $iid_wa i32) (param $out i32) (result i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80004003))))
    (call $dx_query_interface_result (local.get $obj) (local.get $out)
      (i32.or
        (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000))
          (call $dm_is_perf8_iid (local.get $iid_wa)))
        (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x07D43D03) (i32.const 0x11D26523) (i32.const 0x60001D87) (i32.const 0xBDB19308))
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x6FC2CAE0) (i32.const 0x11D2BC78) (i32.const 0xAA00A6AF) (i32.const 0xB6D82400))))))

  (func $handle_IDirectMusicPerformance8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then
        (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
        (call $amstream_finish (i32.const 0x80004003) (i32.const 16))
        (return)))
    (call $amstream_finish (call $dm_perf_qi_wa (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $arg2))
      (i32.const 16)))

  (func $handle_IDirectMusicPerformance8_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (call $dm_perf_release (local.get $arg0)) (i32.const 8)))

  ;; InitAudio(ppDirectMusic, ppDirectSound, hWnd, dwDefaultPathType,
  ;;           dwPChannelCount, dwFlags, pParams)
  (func $handle_IDirectMusicPerformance8_InitAudio (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $handle i32) (local $dm i32) (local $path i32) (local $pchannels i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1))
      (then (call $amstream_finish (i32.const 0x88781151) (i32.const 36)) (return))) ;; DMUS_E_ALREADY_INITED
    (if (i32.ne (local.get $arg2) (i32.const 0))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_InitAudio with ppDirectSound")))
    (if (i32.ne (call $dm_arg (i32.const 7)) (i32.const 0))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_InitAudio with DMUS_AUDIOPARAMS")))
    (if (i32.and (i32.ne (local.get $arg4) (i32.const 0))
          (i32.eqz (call $dm_valid_path_type (local.get $arg4))))
      (then (call $amstream_finish (i32.const 0x80070057) (i32.const 36)) (return)))
    (if (i32.and (i32.ne (global.get $dmusic_perf) (i32.const 0))
          (i32.ne (global.get $dmusic_perf) (local.get $arg0)))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_InitAudio: second live performance")))
    ;; MIDI_MAPPER, no callback: the device midiOutShortMsg plays through.
    (local.set $handle (call $host_midi_out_open (i32.const -1) (i32.const 0) (i32.const 0) (i32.const 0)))
    (if (i32.eqz (local.get $handle))
      (then (call $amstream_finish (i32.const 0x88781101) (i32.const 36)) (return))) ;; DMUS_E_DRIVER_FAILED
    ;; ppDirectMusic: hand back (or accept) the IDirectMusic it runs on.
    (if (local.get $arg1)
      (then
        (if (i32.eqz (call $gl32 (local.get $arg1)))
          (then
            (local.set $dm (call $dx_create_com_obj (i32.const 35) (call $directmusic_vtable)))
            (if (local.get $dm)
              (then (store.field DxObject refcount (call $dx_from_this (local.get $dm)) (i32.const 1))))
            (call $gs32 (local.get $arg1) (local.get $dm))))))
    (local.set $pchannels (call $dm_arg (i32.const 5)))
    (if (local.get $arg4)
      (then
        (local.set $path (call $dm_path_create (local.get $arg0) (local.get $arg4) (i32.const 1)))
        (if (i32.eqz (local.get $path))
          (then
            (drop (call $host_midi_out_close (local.get $handle)))
            (call $amstream_finish (i32.const 0x8007000E) (i32.const 36)) (return)))))
    (store.field DxObject misc0 (local.get $entry) (local.get $handle))
    (store.field DxObject misc2 (local.get $entry) (local.get $path))
    (store.field DxObject flags (local.get $entry) (i32.const 1))
    (i32.store offset=12 (call $g2w (load.field DxObject misc1 (local.get $entry))) (local.get $pchannels))
    (global.set $dmusic_perf (local.get $arg0))
    (call $amstream_finish (i32.const 0) (i32.const 36)))

  ;; CreateStandardAudioPath(dwType, dwPChannelCount, fActivate, ppNewPath)
  (func $handle_IDirectMusicPerformance8_CreateStandardAudioPath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $path i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (local.get $arg4)) (then (call $amstream_finish (i32.const 0x80004003) (i32.const 24)) (return)))
    (call $gs32 (local.get $arg4) (i32.const 0))
    (if (i32.eqz (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1)))
      (then (call $amstream_finish (i32.const 0x88781162) (i32.const 24)) (return))) ;; DMUS_E_NOT_INIT
    (if (i32.eqz (call $dm_valid_path_type (local.get $arg1)))
      (then (call $amstream_finish (i32.const 0x80070057) (i32.const 24)) (return)))
    (local.set $path (call $dm_path_create (local.get $arg0) (local.get $arg1) (local.get $arg3)))
    (if (i32.eqz (local.get $path)) (then (call $amstream_finish (i32.const 0x8007000E) (i32.const 24)) (return)))
    (call $gs32 (local.get $arg4) (local.get $path))
    (call $amstream_finish (i32.const 0) (i32.const 24)))

  (func $handle_IDirectMusicPerformance8_SetDefaultAudioPath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $old i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1)))
      (then (call $amstream_finish (i32.const 0x88781162) (i32.const 12)) (return)))
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0))
          (i32.eqz (call $dm_entry (local.get $arg1) (i32.const 64))))
      (then (call $amstream_finish (i32.const 0x80070057) (i32.const 12)) (return)))
    (if (local.get $arg1) (then (drop (call $dx_com_addref (local.get $arg1)))))
    (local.set $old (load.field DxObject misc2 (local.get $entry)))
    (store.field DxObject misc2 (local.get $entry) (local.get $arg1))
    (if (local.get $old) (then (drop (call $dx_com_release_basic (local.get $old)))))
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  (func $handle_IDirectMusicPerformance8_GetDefaultAudioPath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $path i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.eqz (local.get $arg1)) (then (call $amstream_finish (i32.const 0x80004003) (i32.const 12)) (return)))
    (call $gs32 (local.get $arg1) (i32.const 0))
    (if (i32.eqz (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1)))
      (then (call $amstream_finish (i32.const 0x88781162) (i32.const 12)) (return)))
    (local.set $path (load.field DxObject misc2 (local.get $entry)))
    (if (i32.eqz (local.get $path)) (then (call $amstream_finish (i32.const 0x8878122C) (i32.const 12)) (return))) ;; DMUS_E_NO_AUDIOPATH
    (drop (call $dx_com_addref (local.get $path)))
    (call $gs32 (local.get $arg1) (local.get $path))
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  ;; PlaySegmentEx(pSource, pwzSegmentName, pTransition, dwFlags,
  ;;               i64StartTime, ppSegmentState, pFrom, pAudioPath)
  (func $handle_IDirectMusicPerformance8_PlaySegmentEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rec_wa i32) (local $seg_entry i32) (local $seg_wa i32)
    (local $pp_state i32) (local $from i32) (local $path i32) (local $i i32) (local $inst i32)
    (local $slot i32) (local $cur i32) (local $serial i32) (local $state i32) (local $se i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $pp_state (call $dm_arg (i32.const 7)))
    (local.set $from (call $dm_arg (i32.const 8)))
    (local.set $path (call $dm_arg (i32.const 9)))
    (if (local.get $pp_state) (then (call $gs32 (local.get $pp_state) (i32.const 0))))
    (if (i32.eqz (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1)))
      (then (call $amstream_finish (i32.const 0x88781162) (i32.const 44)) (return)))
    (local.set $seg_entry (call $dm_entry (local.get $arg1) (i32.const 63)))
    (if (i32.eqz (local.get $seg_entry))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_PlaySegmentEx: source is not a MIDI segment")))
    (if (i32.or (i32.ne (local.get $arg3) (i32.const 0)) (i32.ne (local.get $arg2) (i32.const 0)))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_PlaySegmentEx with a transition or segment name")))
    (if (i32.or (i32.ne (call $dm_arg (i32.const 5)) (i32.const 0)) (i32.ne (call $dm_arg (i32.const 6)) (i32.const 0)))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_PlaySegmentEx at a scheduled start time")))
    (if (i32.eqz (local.get $path)) (then (local.set $path (load.field DxObject misc2 (local.get $entry)))))
    (if (i32.eqz (local.get $path))
      (then (call $amstream_finish (i32.const 0x8878122C) (i32.const 44)) (return))) ;; DMUS_E_NO_AUDIOPATH
    (if (i32.eqz (call $dm_entry (local.get $path) (i32.const 64)))
      (then (call $amstream_finish (i32.const 0x80070057) (i32.const 44)) (return)))
    (if (i32.eqz (i32.and (load.field DxObject flags (call $dx_from_this (local.get $path))) (i32.const 1)))
      (then (call $amstream_finish (i32.const 0x88781229) (i32.const 44)) (return))) ;; DMUS_E_AUDIOPATH_INACTIVE
    (call $dmusic_service)
    ;; pFrom: the segment or state this one replaces.
    (if (local.get $from)
      (then
        (if (call $dm_entry (local.get $from) (i32.const 63))
          (then (call $dm_stop_matching (local.get $entry) (local.get $from) (i32.const 63))))
        (if (call $dm_entry (local.get $from) (i32.const 65))
          (then (call $dm_stop_matching (local.get $entry) (local.get $from) (i32.const 65))))))
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    ;; A primary segment replaces the primary that is playing.
    (if (i32.eqz (i32.and (local.get $arg4) (i32.const 0x80)))
      (then
        (local.set $i (i32.const 0))
        (block $done (loop $prim
          (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
          (local.set $inst (call $dm_inst (local.get $rec_wa) (local.get $i)))
          (if (i32.and (i32.ne (i32.load offset=0 (local.get $inst)) (i32.const 0))
                (i32.eqz (i32.and (i32.load offset=8 (local.get $inst)) (i32.const 0x80))))
            (then (call $dm_inst_stop (load.field DxObject misc0 (local.get $entry)) (local.get $inst))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $prim)))))
    (local.set $slot (i32.const -1))
    (local.set $i (i32.const 0))
    (block $found (loop $free
      (br_if $found (i32.ge_u (local.get $i) (i32.const 8)))
      (if (i32.eqz (i32.load offset=0 (call $dm_inst (local.get $rec_wa) (local.get $i))))
        (then (local.set $slot (local.get $i)) (br $found)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $free)))
    (if (i32.lt_s (local.get $slot) (i32.const 0))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_PlaySegmentEx: more than 8 segments playing")))
    (local.set $seg_wa (call $g2w (load.field DxObject misc1 (local.get $seg_entry))))
    (local.set $cur (call $heap_alloc (i32.shl (i32.load offset=12 (local.get $seg_wa)) (i32.const 4))))
    (if (i32.eqz (local.get $cur)) (then (call $amstream_finish (i32.const 0x8007000E) (i32.const 44)) (return)))
    (local.set $serial (i32.add (i32.load offset=8 (local.get $rec_wa)) (i32.const 1)))
    (i32.store offset=8 (local.get $rec_wa) (local.get $serial))
    (local.set $inst (call $dm_inst (local.get $rec_wa) (local.get $slot)))
    (call $zero_memory (local.get $inst) (i32.const 64))
    (drop (call $dx_com_addref (local.get $arg1)))
    (drop (call $dx_com_addref (local.get $path)))
    (i32.store offset=0 (local.get $inst) (local.get $arg1))
    (i32.store offset=4 (local.get $inst) (local.get $path))
    (i32.store offset=8 (local.get $inst) (local.get $arg4))
    (i32.store offset=12 (local.get $inst) (i32.load offset=24 (local.get $seg_wa)))
    (i32.store offset=20 (local.get $inst) (local.get $serial))
    (f64.store offset=24 (local.get $inst) (call $dm_now))
    (i32.store offset=36 (local.get $inst) (local.get $cur))
    ;; GM's default channel volume.
    (memory.fill (i32.add (local.get $inst) (i32.const 40)) (i32.const 100) (i32.const 16))
    (f32.store offset=60 (local.get $inst) (call $dm_gain (local.get $rec_wa) (local.get $path)))
    (call $dm_inst_rewind (local.get $inst) (local.get $seg_wa))
    (if (local.get $pp_state)
      (then
        (call $dmusic_init_vtables)
        (local.set $state (call $dx_create_com_obj (i32.const 65) (global.get $DMUSIC_STATE_VTBL)))
        (if (local.get $state)
          (then
            (local.set $se (call $dx_from_this (local.get $state)))
            (store.field DxObject refcount (local.get $se) (i32.const 1))
            (store.field DxObject misc0 (local.get $se) (local.get $arg0))
            (store.field DxObject misc1 (local.get $se) (local.get $slot))
            (store.field DxObject misc2 (local.get $se) (local.get $serial))
            (call $gs32 (local.get $pp_state) (local.get $state))))))
    ;; Events at the segment's start sound now, not a slice later.
    (call $dm_inst_service (load.field DxObject misc0 (local.get $entry))
      (local.get $rec_wa) (local.get $inst) (call $dm_now))
    (call $amstream_finish (i32.const 0) (i32.const 44)))

  ;; StopEx(pObjectToStop, i64StopTime, dwFlags)
  (func $handle_IDirectMusicPerformance8_StopEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $type i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.or (local.get $arg2) (local.get $arg3))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_StopEx at a scheduled stop time")))
    (if (local.get $arg1)
      (then
        (if (call $dm_entry (local.get $arg1) (i32.const 63)) (then (local.set $type (i32.const 63))))
        (if (call $dm_entry (local.get $arg1) (i32.const 64)) (then (local.set $type (i32.const 64))))
        (if (call $dm_entry (local.get $arg1) (i32.const 65)) (then (local.set $type (i32.const 65))))
        (if (i32.eqz (local.get $type))
          (then (call $crash_unimplemented "IDirectMusicPerformance8_StopEx of an object that is not a segment, state or audiopath")))))
    (if (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1))
      (then (call $dm_stop_matching (local.get $entry) (local.get $arg1) (local.get $type))))
    (call $amstream_finish (i32.const 0) (i32.const 24)))

  ;; IsPlaying(pSegment, pSegState): S_OK while a match plays, else S_FALSE.
  (func $handle_IDirectMusicPerformance8_IsPlaying (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $rec_wa i32) (local $i i32) (local $inst i32) (local $hit i32)
    (local $se i32) (local $hr i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.and (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then (call $amstream_finish (i32.const 0x80004003) (i32.const 16)) (return)))
    (if (i32.eqz (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1)))
      (then (call $amstream_finish (i32.const 0x88781162) (i32.const 16)) (return)))
    (call $dm_perf_service (local.get $arg0) (call $dm_now))
    (local.set $se (call $dm_entry (local.get $arg2) (i32.const 65)))
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (local.set $hr (i32.const 1))
    (block $done (loop $insts
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (local.set $inst (call $dm_inst (local.get $rec_wa) (local.get $i)))
      (local.set $hit (i32.ne (i32.load offset=0 (local.get $inst)) (i32.const 0)))
      (if (local.get $arg1)
        (then (local.set $hit (i32.and (local.get $hit)
          (i32.eq (i32.load offset=0 (local.get $inst)) (local.get $arg1))))))
      (if (local.get $arg2)
        (then (local.set $hit (i32.and (local.get $hit)
          (i32.and (i32.ne (local.get $se) (i32.const 0))
            (i32.and (i32.eq (load.field DxObject misc1 (local.get $se)) (local.get $i))
              (i32.eq (load.field DxObject misc2 (local.get $se)) (i32.load offset=20 (local.get $inst)))))))))
      (if (local.get $hit) (then (local.set $hr (i32.const 0)) (br $done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $insts)))
    (call $amstream_finish (local.get $hr) (i32.const 16)))

  ;; 0 unsupported, 1 GUID_PerfMasterVolume, 2 GUID_PerfMasterTempo.
  (func $dm_global_param_kind (param $guid i32) (result i32)
    (local $wa i32)
    (if (i32.eqz (local.get $guid)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $guid)))
    (if (call $dm_is_d2ac (local.get $wa) (i32.const 0xD2AC28B1)) (then (return (i32.const 1))))
    (if (call $dm_is_d2ac (local.get $wa) (i32.const 0xD2AC28B0)) (then (return (i32.const 2))))
    (i32.const 0))

  ;; SetGlobalParam(rguidType, pParam, dwSize)
  (func $handle_IDirectMusicPerformance8_SetGlobalParam (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $kind i32) (local $rec_wa i32) (local $tempo f32) (local $vol i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $kind (call $dm_global_param_kind (local.get $arg1)))
    (if (i32.eqz (local.get $kind))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_SetGlobalParam of a GUID other than master volume/tempo")))
    (if (i32.eqz (local.get $arg2)) (then (call $amstream_finish (i32.const 0x80004003) (i32.const 20)) (return)))
    (if (i32.lt_u (local.get $arg3) (i32.const 4)) (then (call $amstream_finish (i32.const 0x80070057) (i32.const 20)) (return)))
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (call $dm_perf_service (local.get $arg0) (call $dm_now))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        ;; DMUS_VOLUME_MIN/MAX: -20000..+2000 centibels.
        (local.set $vol (call $gl32 (local.get $arg2)))
        (if (i32.lt_s (local.get $vol) (i32.const -20000)) (then (local.set $vol (i32.const -20000))))
        (if (i32.gt_s (local.get $vol) (i32.const 2000)) (then (local.set $vol (i32.const 2000))))
        (i32.store offset=0 (local.get $rec_wa) (local.get $vol))
        (call $dm_refresh_gain (local.get $entry))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then
        ;; DMUS_MASTERTEMPO_MIN/MAX: 0.01..100.
        (local.set $tempo (f32.reinterpret_i32 (call $gl32 (local.get $arg2))))
        (if (i32.eqz (f32.ge (local.get $tempo) (f32.const 0.01))) (then (local.set $tempo (f32.const 0.01))))
        (if (f32.gt (local.get $tempo) (f32.const 100)) (then (local.set $tempo (f32.const 100))))
        (call $dm_rebase (local.get $entry) (call $dm_now))
        (f32.store offset=4 (local.get $rec_wa) (local.get $tempo))))
    (call $amstream_finish (i32.const 0) (i32.const 20)))

  ;; GetGlobalParam(rguidType, pParam, dwSize)
  (func $handle_IDirectMusicPerformance8_GetGlobalParam (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $kind i32) (local $rec_wa i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $kind (call $dm_global_param_kind (local.get $arg1)))
    (if (i32.eqz (local.get $kind))
      (then (call $crash_unimplemented "IDirectMusicPerformance8_GetGlobalParam of a GUID other than master volume/tempo")))
    (if (i32.eqz (local.get $arg2)) (then (call $amstream_finish (i32.const 0x80004003) (i32.const 20)) (return)))
    (if (i32.lt_u (local.get $arg3) (i32.const 4)) (then (call $amstream_finish (i32.const 0x80070057) (i32.const 20)) (return)))
    (local.set $rec_wa (call $g2w (load.field DxObject misc1 (local.get $entry))))
    (call $gs32 (local.get $arg2) (i32.load (i32.add (local.get $rec_wa)
      (select (i32.const 0) (i32.const 4) (i32.eq (local.get $kind) (i32.const 1))))))
    (call $amstream_finish (i32.const 0) (i32.const 20)))

  (func $handle_IDirectMusicPerformance8_CloseDown (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $dm_perf_close (local.get $arg0))
    (call $amstream_finish (i32.const 0) (i32.const 8)))

  ;; ---- IDirectMusicLoader8 ------------------------------------------------

  (func $dm_loader_qi_wa (param $obj i32) (param $iid_wa i32) (param $out i32) (result i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80004003))))
    (call $dx_query_interface_result (local.get $obj) (local.get $out)
      (i32.or
        (i32.or
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000))
          (call $dm_is_loader8_iid (local.get $iid_wa)))
        (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0x2FFAACA2) (i32.const 0x11D25DCA) (i32.const 0xAA00A6AF) (i32.const 0xB6D82400)))))

  (func $handle_IDirectMusicLoader8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then
        (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
        (call $amstream_finish (i32.const 0x80004003) (i32.const 16))
        (return)))
    (call $amstream_finish (call $dm_loader_qi_wa (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $arg2))
      (i32.const 16)))

  (func $handle_IDirectMusicLoader8_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (call $dm_loader_release (local.get $arg0)) (i32.const 8)))

  ;; The loader caches what it loads (DirectMusic's default for every class)
  ;; and holds one reference until ReleaseObjectByUnknown or its own release.
  (func $dm_loader_cache (param $loader i32) (param $obj i32)
    (local $wa i32) (local $n i32)
    (local.set $wa (call $g2w (load.field DxObject misc1 (call $dx_from_this (local.get $loader)))))
    (local.set $n (i32.load (local.get $wa)))
    (if (i32.ge_u (local.get $n) (i32.const 256))
      (then (call $crash_unimplemented "IDirectMusicLoader8: more than 256 cached objects")))
    (drop (call $dx_com_addref (local.get $obj)))
    (i32.store offset=4 (i32.add (local.get $wa) (i32.shl (local.get $n) (i32.const 2))) (local.get $obj))
    (i32.store (local.get $wa) (i32.add (local.get $n) (i32.const 1))))

  ;; Finish a load: cache, hand the caller its reference. $obj may be a
  ;; negative HRESULT from the parser.
  (func $dm_loader_finish (param $loader i32) (param $obj i32) (param $out i32) (result i32)
    (if (i32.lt_s (local.get $obj) (i32.const 0)) (then (return (local.get $obj))))
    (call $dm_loader_cache (local.get $loader) (local.get $obj))
    (call $gs32 (local.get $out) (local.get $obj))
    (i32.const 0))

  ;; GetObject(pDesc, riid, ppv)
  (func $handle_IDirectMusicLoader8_GetObject (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $valid i32) (local $obj i32)
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg3)))
      (then
        (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
        (call $amstream_finish (i32.const 0x80004003) (i32.const 20)) (return)))
    (call $gs32 (local.get $arg3) (i32.const 0))
    (local.set $valid (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
    (if (i32.eqz (i32.and (local.get $valid) (i32.const 0x2)))
      (then (call $amstream_finish (i32.const 0x88781180) (i32.const 20)) (return))) ;; DMUS_E_LOADER_NOCLASSID
    (if (i32.eqz (call $dm_is_d2ac (call $g2w (i32.add (local.get $arg1) (i32.const 0x18))) (i32.const 0xD2AC2882)))
      (then (call $crash_unimplemented "IDirectMusicLoader8_GetObject of a class other than CLSID_DirectMusicSegment")))
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.eqz (call $dm_is_segment_iid (call $g2w (local.get $arg2)))))
      (then (call $crash_unimplemented "IDirectMusicLoader8_GetObject for an interface other than IDirectMusicSegment*")))
    (if (i32.and (local.get $valid) (i32.const 0x400))
      (then
        (if (call $gl32 (i32.add (local.get $arg1) (i32.const 0x344)))
          (then (call $amstream_finish (i32.const 0x80070057) (i32.const 20)) (return)))
        (local.set $obj (call $dm_segment_from_guest
          (call $gl32 (i32.add (local.get $arg1) (i32.const 0x348)))
          (call $gl32 (i32.add (local.get $arg1) (i32.const 0x340)))))
        (call $amstream_finish (call $dm_loader_finish (local.get $arg0) (local.get $obj) (local.get $arg3)) (i32.const 20))
        (return)))
    (if (i32.and (local.get $valid) (i32.const 0x800))
      (then (call $crash_unimplemented "IDirectMusicLoader8_GetObject from an IStream")))
    (if (i32.and (local.get $valid) (i32.const 0x10))
      (then
        ;; Without DMUS_OBJ_FULLPATH the name is relative to the search
        ;; directory; none is ever set here, so both resolve from the cwd.
        (local.set $obj (call $dm_segment_from_file (i32.add (local.get $arg1) (i32.const 0x138))))
        (call $amstream_finish (call $dm_loader_finish (local.get $arg0) (local.get $obj) (local.get $arg3)) (i32.const 20))
        (return)))
    (call $amstream_finish (i32.const 0x88781186) (i32.const 20))) ;; DMUS_E_LOADER_NOFILENAME

  ;; LoadObjectFromFile(rguidClassID, iidInterfaceID, pwzFilePath, ppObject)
  (func $handle_IDirectMusicLoader8_LoadObjectFromFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (local.get $arg4)) (i32.or (i32.eqz (local.get $arg3)) (i32.eqz (local.get $arg1))))
      (then
        (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
        (call $amstream_finish (i32.const 0x80004003) (i32.const 24)) (return)))
    (call $gs32 (local.get $arg4) (i32.const 0))
    (if (i32.eqz (call $dm_is_d2ac (call $g2w (local.get $arg1)) (i32.const 0xD2AC2882)))
      (then (call $crash_unimplemented "IDirectMusicLoader8_LoadObjectFromFile of a class other than CLSID_DirectMusicSegment")))
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.eqz (call $dm_is_segment_iid (call $g2w (local.get $arg2)))))
      (then (call $crash_unimplemented "IDirectMusicLoader8_LoadObjectFromFile for an interface other than IDirectMusicSegment*")))
    (call $amstream_finish (call $dm_loader_finish (local.get $arg0)
      (call $dm_segment_from_file (local.get $arg3)) (local.get $arg4)) (i32.const 24)))

  ;; ReleaseObjectByUnknown(pObject): drop the cache's reference.
  (func $handle_IDirectMusicLoader8_ReleaseObjectByUnknown (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $n i32) (local $i i32) (local $hr i32)
    (local.set $wa (call $g2w (load.field DxObject misc1 (call $dx_from_this (local.get $arg0)))))
    (local.set $n (i32.load (local.get $wa)))
    (local.set $hr (i32.const 0x88781185)) ;; DMUS_E_LOADER_OBJECTNOTFOUND
    (block $done (loop $find
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (if (i32.eq (i32.load offset=4 (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 2))))
            (local.get $arg1))
        (then
          ;; Close the gap with the last entry, then release.
          (local.set $n (i32.sub (local.get $n) (i32.const 1)))
          (i32.store offset=4 (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 2)))
            (i32.load offset=4 (i32.add (local.get $wa) (i32.shl (local.get $n) (i32.const 2)))))
          (i32.store (local.get $wa) (local.get $n))
          (drop (call $dmusic_release (local.get $arg1)))
          (local.set $hr (i32.const 0))
          (br $done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $find)))
    (call $amstream_finish (local.get $hr) (i32.const 12)))

  ;; CollectGarbage(): frees unreferenced cycles between cached objects.
  ;; Segments here reference no other loader object, so there are none.
  (func $handle_IDirectMusicLoader8_CollectGarbage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $dm_entry (local.get $arg0) (i32.const 62)))
    (call $amstream_finish (i32.load offset=0 (global.get $reg_base)) (i32.const 8)))

  ;; ---- IDirectMusicSegment8 -----------------------------------------------

  (func $handle_IDirectMusicSegment8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then
        (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
        (call $amstream_finish (i32.const 0x80004003) (i32.const 16))
        (return)))
    (call $amstream_finish (call $dx_query_interface_result (local.get $arg0) (local.get $arg2)
      (call $dm_is_segment_iid (call $g2w (local.get $arg1)))) (i32.const 16)))

  (func $handle_IDirectMusicSegment8_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (call $dm_segment_release (local.get $arg0)) (i32.const 8)))

  (func $dm_seg_wa (param $obj i32) (result i32)
    (call $g2w (load.field DxObject misc1 (call $dx_from_this (local.get $obj)))))

  ;; GetLength(pmtLength): music time, DMUS_PPQ (768) per quarter note.
  (func $handle_IDirectMusicSegment8_GetLength (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (if (i32.eqz (local.get $arg1)) (then (call $amstream_finish (i32.const 0x80004003) (i32.const 12)) (return)))
    (local.set $wa (call $dm_seg_wa (local.get $arg0)))
    (call $gs32 (local.get $arg1) (i32.wrap_i64 (i64.div_u
      (i64.mul (i64.extend_i32_u (i32.load offset=28 (local.get $wa))) (i64.const 768))
      (i64.extend_i32_u (i32.load offset=16 (local.get $wa))))))
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  (func $handle_IDirectMusicSegment8_GetRepeats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1)) (then (call $amstream_finish (i32.const 0x80004003) (i32.const 12)) (return)))
    (call $gs32 (local.get $arg1) (i32.load offset=24 (call $dm_seg_wa (local.get $arg0))))
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  ;; SetRepeats(dwRepeats): DMUS_SEG_REPEAT_INFINITE (-1) loops forever. Takes
  ;; effect for the next PlaySegmentEx, as in DirectMusic.
  (func $handle_IDirectMusicSegment8_SetRepeats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=24 (call $dm_seg_wa (local.get $arg0)) (local.get $arg1))
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  ;; SetParam(rguidType, dwGroupBits, dwIndex, mtTime, pParam)
  (func $handle_IDirectMusicSegment8_SetParam (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GUID_StandardMIDIFile {06621075-E92E-11D1-A8C5-00C04FA3726E}: play the
    ;; file as General MIDI, which is the only way this sequencer plays.
    (if (i32.or (i32.eqz (local.get $arg1))
          (i32.eqz (call $guid_words_equal (call $g2w (local.get $arg1))
            (i32.const 0x06621075) (i32.const 0x11D1E92E) (i32.const 0xC000C5A8) (i32.const 0x6E72A34F))))
      (then (call $crash_unimplemented "IDirectMusicSegment8_SetParam of a GUID other than GUID_StandardMIDIFile")))
    (i32.store offset=36 (call $dm_seg_wa (local.get $arg0)) (i32.const 1))
    (call $amstream_finish (i32.const 0) (i32.const 28)))

  ;; Download/Unload(pAudioPath or performance): the instruments are the host
  ;; synth's General MIDI set, so there is nothing to transfer; the state is
  ;; recorded.
  (func $handle_IDirectMusicSegment8_Download (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1)) (then (call $amstream_finish (i32.const 0x80004003) (i32.const 12)) (return)))
    (i32.store offset=32 (call $dm_seg_wa (local.get $arg0)) (i32.const 1))
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  (func $handle_IDirectMusicSegment8_Unload (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1)) (then (call $amstream_finish (i32.const 0x80004003) (i32.const 12)) (return)))
    (i32.store offset=32 (call $dm_seg_wa (local.get $arg0)) (i32.const 0))
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  ;; ---- IDirectMusicAudioPath8 ---------------------------------------------

  (func $handle_IDirectMusicAudioPath8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IDirectMusicAudioPath (== AudioPath8) {C87631F5-23BE-4986-8836-05832FCC48F9}.
    (call $amstream_finish (call $dm_qi (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0xC87631F5) (i32.const 0x498623BE) (i32.const 0x83053688) (i32.const 0xF948CC2F)
      (i32.const 0xC87631F5) (i32.const 0x498623BE) (i32.const 0x83053688) (i32.const 0xF948CC2F)
      (i32.const 0xC87631F5) (i32.const 0x498623BE) (i32.const 0x83053688) (i32.const 0xF948CC2F))
      (i32.const 16)))

  (func $handle_IDirectMusicAudioPath8_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (call $dx_com_release_basic (local.get $arg0)) (i32.const 8)))

  (func $handle_IDirectMusicAudioPath8_Activate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (store.field DxObject flags (call $dx_from_this (local.get $arg0))
      (i32.ne (local.get $arg1) (i32.const 0)))
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  ;; SetVolume(lVolume, dwDuration): -9600..0 centibels. Applied at once; the
  ;; fade duration is not ramped.
  (func $handle_IDirectMusicAudioPath8_SetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $perf i32) (local $pe i32)
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.or (i32.gt_s (local.get $arg1) (i32.const 0)) (i32.lt_s (local.get $arg1) (i32.const -9600)))
      (then (call $amstream_finish (i32.const 0x80070057) (i32.const 16)) (return)))
    (store.field DxObject misc0 (local.get $entry) (local.get $arg1))
    (local.set $perf (load.field DxObject misc2 (local.get $entry)))
    (local.set $pe (call $dm_entry (local.get $perf) (i32.const 61)))
    (if (local.get $pe)
      (then
        (call $dm_perf_service (local.get $perf) (call $dm_now))
        (call $dm_refresh_gain (local.get $pe))))
    (call $amstream_finish (i32.const 0) (i32.const 16)))

  ;; ---- IDirectMusicSegmentState8 ------------------------------------------

  (func $handle_IDirectMusicSegmentState8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IDirectMusicSegmentState {A3AFDCC7-D3EE-11D1-BC8D-00A0C922E6EB},
    ;; IID_IDirectMusicSegmentState8 {A50E4730-0AE4-48A7-9839-BC04BFE07772}.
    (call $amstream_finish (call $dm_qi (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0xA3AFDCC7) (i32.const 0x11D1D3EE) (i32.const 0xA0008DBC) (i32.const 0xEBE622C9)
      (i32.const 0xA50E4730) (i32.const 0x48A70AE4) (i32.const 0x04BC3998) (i32.const 0x7277E0BF)
      (i32.const 0xA50E4730) (i32.const 0x48A70AE4) (i32.const 0x04BC3998) (i32.const 0x7277E0BF))
      (i32.const 16)))
