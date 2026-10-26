  ;; ============================================================
  ;; WINMM MIXER HANDLERS
  ;; mixerOpen/Close/GetDevCaps/GetLineInfo/GetLineControls/GetControlDetails and
  ;; their A/W pairs. Audio, filed next to 09a3-handlers-audio.wat's neighbours
  ;; rather than at the end of the dispatch file.
  ;; ============================================================

  ;; WINMM mixer model: speaker master with separate wave and MIDI sources.
  ;; mixerOpen returns opaque handles, not the device id. Keep 32 live handles
  ;; per instance: enough for Win98 applications while making close invalidate
  ;; exactly the handle it consumes instead of accepting every integer forever.
  (global $mixer_open_mask (mut i32) (i32.const 0))

  (func $mixer_handle_is_live (param $handle i32) (result i32)
    (local $slot i32) (local $bit i32)
    (local.set $slot (i32.sub (local.get $handle) (i32.const 0x00090001)))
    (if (i32.ge_u (local.get $slot) (i32.const 32))
      (then (return (i32.const 0))))
    (local.set $bit (i32.shl (i32.const 1) (local.get $slot)))
    (i32.ne
      (i32.and (global.get $mixer_open_mask) (local.get $bit))
      (i32.const 0)))

  (func $mixer_alloc_handle (result i32)
    (local $slot i32) (local $bit i32)
    (block $full
      (loop $scan
        (br_if $full (i32.ge_u (local.get $slot) (i32.const 32)))
        (local.set $bit (i32.shl (i32.const 1) (local.get $slot)))
        (if (i32.eqz (i32.and (global.get $mixer_open_mask) (local.get $bit)))
          (then
            (global.set $mixer_open_mask
              (i32.or (global.get $mixer_open_mask) (local.get $bit)))
            (return (i32.add (i32.const 0x00090001) (local.get $slot)))))
        (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
        (br $scan)))
    (i32.const 0))

  (func $mixer_close_handle (param $handle i32) (result i32)
    (local $slot i32) (local $bit i32)
    (if (i32.eqz (call $mixer_handle_is_live (local.get $handle)))
      (then (return (i32.const 5)))) ;; MMSYSERR_INVALHANDLE
    (local.set $slot (i32.sub (local.get $handle) (i32.const 0x00090001)))
    (local.set $bit (i32.shl (i32.const 1) (local.get $slot)))
    (global.set $mixer_open_mask
      (i32.and (global.get $mixer_open_mask) (i32.xor (local.get $bit) (i32.const -1))))
    (i32.const 0))

  ;; The browser exposes one mixer device, id 0.  mixerGetDevCaps also accepts
  ;; an HMIXER directly, and the object-taking calls accept that handle even
  ;; when MIXER_OBJECTF_HMIXER is omitted.
  (func $mixer_validate_device (param $device i32) (result i32)
    (local $slot i32)
    (if (i32.eqz (local.get $device)) (then (return (i32.const 0))))
    (local.set $slot (i32.sub (local.get $device) (i32.const 0x00090001)))
    (if (i32.lt_u (local.get $slot) (i32.const 32))
      (then
        (return (select (i32.const 0) (i32.const 5)
          (call $mixer_handle_is_live (local.get $device))))))
    (i32.const 2)) ;; MMSYSERR_BADDEVICEID

  ;; Low nibble is the per-call query; bits 28..30 select the multimedia
  ;; object type and bit 31 says handle.  The browser models mixer objects plus
  ;; its real wave-out and MIDI-out device identifiers; other device classes
  ;; have no mixer driver behind them.
  (func $mixer_validate_object_flags
    (param $object i32) (param $flags i32) (param $max_query i32) (result i32)
    (local $type i32) (local $is_handle i32)
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x0ffffff0)) (i32.const 0))
      (then (return (i32.const 10)))) ;; MMSYSERR_INVALFLAG
    (if (i32.gt_u (i32.and (local.get $flags) (i32.const 0xf)) (local.get $max_query))
      (then (return (i32.const 10))))
    (local.set $type (i32.and (local.get $flags) (i32.const 0x70000000)))
    (local.set $is_handle (i32.and (local.get $flags) (i32.const 0x80000000)))
    (if (i32.eq (local.get $type) (i32.const 0x10000000))           ;; WAVEOUT
      (then
        (if (local.get $is_handle)
          (then
            (return (select (i32.const 0) (i32.const 5)
              (i32.and
                (i32.ne (local.get $object) (i32.const 0))
                (i32.eq (local.get $object) (i32.load (region.addr $WAVE_OUT_SHARED 0))))))))
        (return (select (i32.const 0) (i32.const 2) (i32.eqz (local.get $object))))))
    (if (i32.eq (local.get $type) (i32.const 0x30000000))           ;; MIDIOUT
      (then
        (if (local.get $is_handle)
          (then (return (i32.const 5))))                            ;; no retained HMIDIOUT identity
        (return (select (i32.const 0) (i32.const 2)
          (i32.lt_u (local.get $object) (call $host_midi_num_devs))))))
    (if (i32.ne (local.get $type) (i32.const 0))
      (then (return (i32.const 6))))                                ;; MMSYSERR_NODRIVER
    (if (local.get $is_handle)
      (then
        (return (select (i32.const 0) (i32.const 5)
          (call $mixer_handle_is_live (local.get $object))))))
    (call $mixer_validate_device (local.get $object)))

  (func $fill_mixer_caps (param $p i32) (param $wide i32) (param $cb i32)
    (local $size i32)
    (if (i32.eqz (local.get $p)) (then (return)))
    (local.set $size (select (i32.const 80) (i32.const 48) (local.get $wide)))
    (if (i32.lt_u (local.get $cb) (local.get $size))
      (then (local.set $size (local.get $cb))))
    (call $zero_memory (local.get $p) (local.get $size))
    ;; Write only nonzero bytes so partial-structure copies remain bounded.
    (if (i32.gt_u (local.get $size) (i32.const 0))
      (then (i32.store8 offset=0 (local.get $p) (i32.const 1))))        ;; wMid
    (if (i32.gt_u (local.get $size) (i32.const 2))
      (then (i32.store8 offset=2 (local.get $p) (i32.const 1))))        ;; wPid
    (if (i32.gt_u (local.get $size) (i32.const 5))
      (then (i32.store8 offset=5 (local.get $p) (i32.const 4))))        ;; v4.00
    (if (local.get $wide)
      (then
        (if (i32.gt_u (local.get $size) (i32.const 8))
          (then (i32.store8 offset=8 (local.get $p) (i32.const 0x57))))
        (if (i32.gt_u (local.get $size) (i32.const 10))
          (then (i32.store8 offset=10 (local.get $p) (i32.const 0x69))))
        (if (i32.gt_u (local.get $size) (i32.const 12))
          (then (i32.store8 offset=12 (local.get $p) (i32.const 0x6e))))
        (if (i32.gt_u (local.get $size) (i32.const 14))
          (then (i32.store8 offset=14 (local.get $p) (i32.const 0x65))))
        (if (i32.gt_u (local.get $size) (i32.const 76))
          (then (i32.store8 offset=76 (local.get $p) (i32.const 1)))))  ;; cDestinations
      (else
        (if (i32.gt_u (local.get $size) (i32.const 8))
          (then (i32.store8 offset=8 (local.get $p) (i32.const 0x57))))
        (if (i32.gt_u (local.get $size) (i32.const 9))
          (then (i32.store8 offset=9 (local.get $p) (i32.const 0x69))))
        (if (i32.gt_u (local.get $size) (i32.const 10))
          (then (i32.store8 offset=10 (local.get $p) (i32.const 0x6e))))
        (if (i32.gt_u (local.get $size) (i32.const 11))
          (then (i32.store8 offset=11 (local.get $p) (i32.const 0x65))))
        (if (i32.gt_u (local.get $size) (i32.const 44))
          (then (i32.store8 offset=44 (local.get $p) (i32.const 1))))))) ;; cDestinations

  (func $fill_mixer_name (param $short i32) (param $long i32) (param $wide i32) (param $line_id i32)
    (if (local.get $wide)
      (then
        (if (i32.eq (local.get $line_id) (i32.const 1))
          (then
            (i64.store (local.get $short) (i64.const 0x0065007600610057))
            (i64.store (local.get $long) (i64.const 0x0065007600610057))
            (return)))
        (if (i32.eq (local.get $line_id) (i32.const 2))
          (then
            (i64.store (local.get $short) (i64.const 0x004900440049004d))
            (i64.store (local.get $long) (i64.const 0x004900440049004d))
            (return)))
        (i64.store (local.get $short) (i64.const 0x0075006c006f0056))
        (i64.store offset=8 (local.get $short) (i64.const 0x000000000065006d))
        (i64.store (local.get $long) (i64.const 0x0075006c006f0056))
        (i64.store offset=8 (local.get $long) (i64.const 0x004300200065006d))
        (i64.store offset=16 (local.get $long) (i64.const 0x00720074006e006f))
        (i64.store offset=24 (local.get $long) (i64.const 0x00000000006c006f))
        (return)))
    (if (i32.eq (local.get $line_id) (i32.const 1))
      (then
        (i32.store (local.get $short) (i32.const 0x65766157))
        (i32.store (local.get $long) (i32.const 0x65766157))
        (return)))
    (if (i32.eq (local.get $line_id) (i32.const 2))
      (then
        (i32.store (local.get $short) (i32.const 0x4944494d))
        (i32.store (local.get $long) (i32.const 0x4944494d))
        (return)))
    (i32.store (local.get $short) (i32.const 0x756c6f56))
    (i32.store offset=4 (local.get $short) (i32.const 0x0000656d))
    (i64.store (local.get $long) (i64.const 0x4320656d756c6f56))
    (i64.store offset=8 (local.get $long) (i64.const 0x00006c6f72746e6f)))

  (func $fill_mixer_line (param $p i32) (param $wide i32) (param $line_id i32)
    (local $is_source i32) (local $size i32) (local $target i32) (local $component i32)
    (if (i32.eqz (local.get $p)) (then (return)))
    (local.set $is_source (i32.ne (local.get $line_id) (i32.const 0)))
    (local.set $component (i32.const 4))                                ;; DST_SPEAKERS
    (if (i32.eq (local.get $line_id) (i32.const 1))
      (then (local.set $component (i32.const 0x1008))))                 ;; SRC_WAVEOUT
    (if (i32.eq (local.get $line_id) (i32.const 2))
      (then (local.set $component (i32.const 0x1004))))                 ;; SRC_SYNTHESIZER
    (local.set $size (i32.const 168))
    (local.set $target (i32.add (local.get $p) (i32.const 120)))
    (if (local.get $wide)
      (then
        (local.set $size (i32.const 280))
        (local.set $target (i32.add (local.get $p) (i32.const 200)))))
    (call $zero_memory (local.get $p) (local.get $size))
    (i32.store offset=0 (local.get $p) (local.get $size))
    (i32.store offset=4 (local.get $p) (i32.const 0))                   ;; dwDestination
    (if (local.get $is_source)
      (then (i32.store offset=8 (local.get $p) (i32.sub (local.get $line_id) (i32.const 1)))))
    (i32.store offset=12 (local.get $p) (local.get $line_id))           ;; dwLineID
    (if (local.get $is_source)
      (then
        (i32.store offset=16 (local.get $p) (i32.const 0x80000001))      ;; SOURCE|ACTIVE
        (i32.store offset=24 (local.get $p) (local.get $component))
        (i32.store offset=28 (local.get $p) (i32.const 2))               ;; cChannels
        (i32.store offset=36 (local.get $p) (i32.const 3)))              ;; cControls
      (else
        (i32.store offset=16 (local.get $p) (i32.const 1))               ;; ACTIVE
        (i32.store offset=24 (local.get $p) (i32.const 4))               ;; DST_SPEAKERS
        (i32.store offset=28 (local.get $p) (i32.const 2))               ;; cChannels
        (i32.store offset=32 (local.get $p) (i32.const 2))               ;; cConnections
        (i32.store offset=36 (local.get $p) (i32.const 3))))             ;; cControls
    (if (local.get $wide)
      (then (call $fill_mixer_name (i32.add (local.get $p) (i32.const 40)) (i32.add (local.get $p) (i32.const 72)) (i32.const 1) (local.get $line_id)))
      (else (call $fill_mixer_name (i32.add (local.get $p) (i32.const 40)) (i32.add (local.get $p) (i32.const 56)) (i32.const 0) (local.get $line_id))))
    (i32.store offset=0 (local.get $target) (select (i32.const 3) (i32.const 1) (i32.eq (local.get $line_id) (i32.const 2))))
    (i32.store offset=4 (local.get $target) (i32.const 0))               ;; dwDeviceID
    (i32.store16 offset=8 (local.get $target) (i32.const 1))             ;; wMid
    (i32.store16 offset=10 (local.get $target) (i32.const 1))            ;; wPid
    (i32.store offset=12 (local.get $target) (i32.const 0x0400)))        ;; vDriverVersion

  ;; kind: 0=volume, 1=mute, 2=peak meter.
  (func $fill_mixer_control (param $p i32) (param $wide i32) (param $line_id i32) (param $kind i32)
    (local $size i32) (local $bounds i32) (local $metrics i32)
    (if (i32.eqz (local.get $p)) (then (return)))
    (local.set $size (i32.const 148))
    (local.set $bounds (i32.add (local.get $p) (i32.const 100)))
    (local.set $metrics (i32.add (local.get $p) (i32.const 124)))
    (if (local.get $wide)
      (then
        (local.set $size (i32.const 228))
        (local.set $bounds (i32.add (local.get $p) (i32.const 180)))
        (local.set $metrics (i32.add (local.get $p) (i32.const 204)))))
    (call $zero_memory (local.get $p) (local.get $size))
    (i32.store offset=0 (local.get $p) (local.get $size))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (i32.store offset=4 (local.get $p) (i32.add (i32.const 0x2000) (local.get $line_id)))
        (i32.store offset=8 (local.get $p) (i32.const 0x20010002))       ;; BOOLEAN MUTE
        (i32.store offset=12 (local.get $p) (i32.const 1)))              ;; UNIFORM
      (else
        (if (i32.eq (local.get $kind) (i32.const 2))
          (then
            (i32.store offset=4 (local.get $p) (i32.add (i32.const 0x3000) (local.get $line_id)))
            (i32.store offset=8 (local.get $p) (i32.const 0x10020001))   ;; SIGNED PEAKMETER
            (i32.store offset=12 (local.get $p) (i32.const 1)))          ;; UNIFORM
          (else
            (i32.store offset=4 (local.get $p) (i32.add (i32.const 0x1000) (local.get $line_id)))
            (i32.store offset=8 (local.get $p) (i32.const 0x50030001)))))) ;; UNSIGNED VOLUME
    (if (local.get $wide)
      (then (call $fill_mixer_name (i32.add (local.get $p) (i32.const 20)) (i32.add (local.get $p) (i32.const 52)) (i32.const 1) (local.get $line_id)))
      (else (call $fill_mixer_name (i32.add (local.get $p) (i32.const 20)) (i32.add (local.get $p) (i32.const 36)) (i32.const 0) (local.get $line_id))))
    (i32.store offset=0 (local.get $bounds)
      (select (i32.const -32768) (i32.const 0) (i32.eq (local.get $kind) (i32.const 2)))) ;; min
    (i32.store offset=4 (local.get $bounds)
      (select (i32.const 1)
        (select (i32.const 32767) (i32.const 0xffff) (i32.eq (local.get $kind) (i32.const 2)))
        (i32.eq (local.get $kind) (i32.const 1))))
    (i32.store offset=0 (local.get $metrics)
      (select (i32.const 1) (i32.const 0xffff) (i32.eq (local.get $kind) (i32.const 1)))))

  (func $mixer_get_dev_caps (param $device i32) (param $out_g i32) (param $cb i32) (param $wide i32) (result i32)
    (local $result i32)
    (local.set $result (call $mixer_validate_device (local.get $device)))
    (if (local.get $result)
      (then (return (local.get $result))))
    (if (local.get $cb)
      (then
        (if (i32.eqz (local.get $out_g))
          (then (return (i32.const 11))))                           ;; MMSYSERR_INVALPARAM
        (call $fill_mixer_caps (call $g2w (local.get $out_g)) (local.get $wide) (local.get $cb))))
    (i32.const 0))

  (func $handle_mixerGetDevCapsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mixer_get_dev_caps (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_mixerGetDevCapsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mixer_get_dev_caps (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; mixerGetLineInfo{A,W}(hmxobj, pmxl, fdwInfo) -> MMRESULT. Picking the line
  ;; is the same walk in both spellings; $wide only decides how the names in
  ;; the MIXERLINE are written back.
  (func $mixer_get_line_info (param $p i32) (param $fdw i32) (param $wide i32) (result i32)
    (local $component i32) (local $line_id i32) (local $query i32) (local $target i32)
    (local.set $query (i32.and (local.get $fdw) (i32.const 0xf)))
    (if (i32.eq (local.get $query) (i32.const 0))                 ;; DESTINATION
      (then
        (if (i32.or
              (i32.ne (i32.load offset=4 (local.get $p)) (i32.const 0))
              (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 0)))
          (then (return (i32.const 1024))))))                      ;; MIXERR_INVALLINE
    (if (i32.eq (local.get $query) (i32.const 1))                 ;; SOURCE
      (then
        (if (i32.or
              (i32.ne (i32.load offset=4 (local.get $p)) (i32.const 0))
              (i32.ge_u (i32.load offset=8 (local.get $p)) (i32.const 2)))
          (then (return (i32.const 1024))))
        (local.set $line_id (i32.add (i32.load offset=8 (local.get $p)) (i32.const 1)))))
    (if (i32.eq (local.get $query) (i32.const 2))                 ;; LINEID
      (then
        (local.set $line_id (i32.load offset=12 (local.get $p)))
        (if (i32.gt_u (local.get $line_id) (i32.const 2))
          (then (return (i32.const 1024))))))
    (if (i32.eq (local.get $query) (i32.const 3))                 ;; COMPONENTTYPE
      (then
        (local.set $component (i32.load offset=24 (local.get $p)))
        (if (i32.eq (local.get $component) (i32.const 4))
          (then (local.set $line_id (i32.const 0)))
          (else
            (if (i32.eq (local.get $component) (i32.const 0x1008))
              (then (local.set $line_id (i32.const 1)))
              (else
                (if (i32.eq (local.get $component) (i32.const 0x1004))
                  (then (local.set $line_id (i32.const 2)))
                  (else (return (i32.const 1024))))))))))
    (if (i32.eq (local.get $query) (i32.const 4))                 ;; TARGETTYPE
      (then
        (local.set $target (i32.add (local.get $p)
          (select (i32.const 200) (i32.const 120) (local.get $wide))))
        (if (i32.eq (i32.load (local.get $target)) (i32.const 1))
          (then (local.set $line_id (i32.const 1)))                ;; WAVEOUT
          (else
            (if (i32.eq (i32.load (local.get $target)) (i32.const 3))
              (then (local.set $line_id (i32.const 2)))            ;; MIDIOUT
              (else (return (i32.const 1024))))))))
    (call $fill_mixer_line (local.get $p) (local.get $wide) (local.get $line_id))
    (i32.const 0))

  (func $mixer_get_line_info_entry (param $object i32) (param $line_g i32) (param $flags i32) (param $wide i32) (result i32)
    (local $result i32) (local $p i32)
    (local.set $result (call $mixer_validate_object_flags (local.get $object) (local.get $flags) (i32.const 4)))
    (if (local.get $result) (then (return (local.get $result))))
    (if (i32.eqz (local.get $line_g)) (then (return (i32.const 11))))
    (local.set $p (call $g2w (local.get $line_g)))
    (if (i32.ne (i32.load (local.get $p))
          (select (i32.const 280) (i32.const 168) (local.get $wide)))
      (then (return (i32.const 11))))
    (call $mixer_get_line_info (local.get $p) (local.get $flags) (local.get $wide)))

  (func $handle_mixerGetLineInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mixer_get_line_info_entry (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 825: mixerGetLineInfoW(hmxobj, pmxl, fdwInfo) -> MMRESULT
  (func $handle_mixerGetLineInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mixer_get_line_info_entry (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; mixerGetLineControls{A,W}(hmxobj, pmxlc, fdwControls) -> MMRESULT. The only
  ;; difference between the spellings is the width of the names written into
  ;; each MIXERCONTROL, and hence its default size.
  (func $mixer_get_line_controls (param $p i32) (param $fdw i32) (param $wide i32) (result i32)
    (local $ctrl i32) (local $line_id i32) (local $kind i32)
    (local $cb i32) (local $query i32) (local $control i32)
    (if (i32.ne (i32.load (local.get $p)) (i32.const 24))
      (then (return (i32.const 11))))                               ;; MMSYSERR_INVALPARAM
    (local.set $cb (i32.load offset=16 (local.get $p)))
    (if (i32.ne (local.get $cb) (select (i32.const 228) (i32.const 148) (local.get $wide)))
      (then (return (i32.const 11))))
    (if (i32.eqz (i32.load offset=20 (local.get $p)))
      (then (return (i32.const 11))))
    (local.set $ctrl (call $g2w (i32.load offset=20 (local.get $p))))
    (local.set $query (i32.and (local.get $fdw) (i32.const 0xf)))
    (local.set $line_id (i32.load offset=4 (local.get $p)))
    (if (i32.eqz (local.get $query))                                ;; ALL
      (then
        (if (i32.gt_u (local.get $line_id) (i32.const 2))
          (then (return (i32.const 1024))))                          ;; MIXERR_INVALLINE
        (if (i32.ne (i32.load offset=12 (local.get $p)) (i32.const 3))
          (then (return (i32.const 11))))
        (call $fill_mixer_control (local.get $ctrl) (local.get $wide) (local.get $line_id) (i32.const 0))
        (call $fill_mixer_control (i32.add (local.get $ctrl) (local.get $cb)) (local.get $wide) (local.get $line_id) (i32.const 1))
        (call $fill_mixer_control (i32.add (local.get $ctrl) (i32.mul (local.get $cb) (i32.const 2))) (local.get $wide) (local.get $line_id) (i32.const 2))
        (return (i32.const 0))))
    (if (i32.ne (i32.load offset=12 (local.get $p)) (i32.const 1))
      (then (return (i32.const 11))))
    (if (i32.eq (local.get $query) (i32.const 1))                  ;; ONEBYID
      (then
        (local.set $control (i32.load offset=8 (local.get $p)))
        (if (i32.and
              (i32.ge_u (local.get $control) (i32.const 0x1000))
              (i32.le_u (local.get $control) (i32.const 0x1002)))
          (then
            (local.set $kind (i32.const 0))
            (local.set $line_id (i32.sub (local.get $control) (i32.const 0x1000))))
          (else
            (if (i32.and
                  (i32.ge_u (local.get $control) (i32.const 0x2000))
                  (i32.le_u (local.get $control) (i32.const 0x2002)))
              (then
                (local.set $kind (i32.const 1))
                (local.set $line_id (i32.sub (local.get $control) (i32.const 0x2000))))
              (else
                (if (i32.and
                      (i32.ge_u (local.get $control) (i32.const 0x3000))
                      (i32.le_u (local.get $control) (i32.const 0x3002)))
                  (then
                    (local.set $kind (i32.const 2))
                    (local.set $line_id (i32.sub (local.get $control) (i32.const 0x3000))))
                  (else (return (i32.const 1025))))))))))           ;; MIXERR_INVALCONTROL
    (if (i32.eq (local.get $query) (i32.const 2))                  ;; ONEBYTYPE
      (then
        (if (i32.gt_u (local.get $line_id) (i32.const 2))
          (then (return (i32.const 1024))))
        (local.set $control (i32.load offset=8 (local.get $p)))
        (if (i32.eq (local.get $control) (i32.const 0x50030001))
          (then (local.set $kind (i32.const 0)))
          (else
            (if (i32.eq (local.get $control) (i32.const 0x20010002))
              (then (local.set $kind (i32.const 1)))
              (else
                (if (i32.eq (local.get $control) (i32.const 0x10020001))
                  (then (local.set $kind (i32.const 2)))
                  (else (return (i32.const 1025))))))))))
    (call $fill_mixer_control (local.get $ctrl) (local.get $wide) (local.get $line_id) (local.get $kind))
    (i32.const 0))

  (func $mixer_get_line_controls_entry (param $object i32) (param $controls_g i32) (param $flags i32) (param $wide i32) (result i32)
    (local $result i32) (local $p i32)
    (local.set $result (call $mixer_validate_object_flags (local.get $object) (local.get $flags) (i32.const 2)))
    (if (local.get $result) (then (return (local.get $result))))
    (if (i32.eqz (local.get $controls_g)) (then (return (i32.const 11))))
    (local.set $p (call $g2w (local.get $controls_g)))
    (call $mixer_get_line_controls (local.get $p) (local.get $flags) (local.get $wide)))

  (func $handle_mixerGetLineControlsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mixer_get_line_controls_entry (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_mixerGetLineControlsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mixer_get_line_controls_entry (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; MIXER_GETCONTROLDETAILSF_VALUE writes numeric detail records, so its A/W
  ;; entry points have no encoding-dependent work. Keep that behavior in one
  ;; implementation; LISTTEXT remains a separate, currently unsupported case.
  (func $mixer_control_id_valid (param $control i32) (result i32)
    (i32.or
      (i32.or
        (i32.and
          (i32.ge_u (local.get $control) (i32.const 0x1000))
          (i32.le_u (local.get $control) (i32.const 0x1002)))
        (i32.and
          (i32.ge_u (local.get $control) (i32.const 0x2000))
          (i32.le_u (local.get $control) (i32.const 0x2002))))
      (i32.and
        (i32.ge_u (local.get $control) (i32.const 0x3000))
        (i32.le_u (local.get $control) (i32.const 0x3002)))))

  (func $mixer_validate_control_details (param $p i32) (result i32)
    (local $channels i32)
    (if (i32.ne (i32.load (local.get $p)) (i32.const 24))
      (then (return (i32.const 11))))
    (if (i32.eqz (call $mixer_control_id_valid (i32.load offset=4 (local.get $p))))
      (then (return (i32.const 1025))))                             ;; MIXERR_INVALCONTROL
    (local.set $channels (i32.load offset=8 (local.get $p)))
    (if (i32.or
          (i32.eqz (local.get $channels))
          (i32.gt_u (local.get $channels) (i32.const 2)))
      (then (return (i32.const 11))))
    (if (i32.or
          (i32.ne (i32.load offset=12 (local.get $p)) (i32.const 0))
          (i32.ne (i32.load offset=16 (local.get $p)) (i32.const 4)))
      (then (return (i32.const 11))))
    (if (i32.eqz (i32.load offset=20 (local.get $p)))
      (then (return (i32.const 11))))
    (i32.const 0))

  (func $mixer_get_control_details_value (param $p i32)
    (local $details i32) (local $channels i32) (local $volume i32) (local $control i32)
    (local.set $channels (i32.load offset=8 (local.get $p)))
    (local.set $details (call $g2w (i32.load offset=20 (local.get $p))))
    (local.set $control (i32.load offset=4 (local.get $p)))
    (if (i32.ge_u (local.get $control) (i32.const 0x3000))
      (then (local.set $volume (call $host_audio_mixer_get_peak (i32.sub (local.get $control) (i32.const 0x3000)))))
      (else
        (if (i32.ge_u (local.get $control) (i32.const 0x2000))
          (then (local.set $volume (call $host_audio_mixer_get_mute (i32.sub (local.get $control) (i32.const 0x2000)))))
          (else (local.set $volume (call $host_audio_mixer_get_volume (i32.sub (local.get $control) (i32.const 0x1000))))))))
    (if (local.get $details)
      (then
        (i32.store offset=0 (local.get $details) (i32.and (local.get $volume) (i32.const 0xffff)))
        (if (i32.gt_u (local.get $channels) (i32.const 1))
          (then (i32.store offset=4 (local.get $details)
            (select (local.get $volume) (i32.shr_u (local.get $volume) (i32.const 16))
              (i32.ge_u (local.get $control) (i32.const 0x3000)))))))))

  (func $mixer_get_control_details_entry (param $object i32) (param $details_g i32) (param $flags i32) (result i32)
    (local $result i32) (local $p i32)
    (local.set $result (call $mixer_validate_object_flags (local.get $object) (local.get $flags) (i32.const 1)))
    (if (local.get $result) (then (return (local.get $result))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0xf)) (i32.const 0))
      (then (return (i32.const 8))))                                ;; LISTTEXT unsupported
    (if (i32.eqz (local.get $details_g)) (then (return (i32.const 11))))
    (local.set $p (call $g2w (local.get $details_g)))
    (local.set $result (call $mixer_validate_control_details (local.get $p)))
    (if (local.get $result) (then (return (local.get $result))))
    (call $mixer_get_control_details_value (local.get $p))
    (i32.const 0))

  (func $handle_mixerGetControlDetailsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mixer_get_control_details_entry (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_mixerGetControlDetailsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; VALUE queries contain no strings; LISTTEXT is rejected by the shared
    ;; entry point, so the A handler is the complete implementation here too.
    (call $handle_mixerGetControlDetailsA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_mixerSetControlDetails (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $details i32) (local $channels i32) (local $left i32) (local $right i32) (local $control i32) (local $result i32)
    (local.set $result (call $mixer_validate_object_flags (local.get $arg0) (local.get $arg2) (i32.const 1)))
    (if (i32.eqz (local.get $result))
      (then
        (if (i32.ne (i32.and (local.get $arg2) (i32.const 0xf)) (i32.const 0))
          (then (local.set $result (i32.const 8)))                  ;; CUSTOM unsupported
          (else
            (if (i32.eqz (local.get $arg1))
              (then (local.set $result (i32.const 11)))
              (else
                (local.set $p (call $g2w (local.get $arg1)))
                (local.set $result
                  (call $mixer_validate_control_details (local.get $p)))))))))
    (if (local.get $result)
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $result))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $channels (i32.load offset=8 (local.get $p)))
    (local.set $details (call $g2w (i32.load offset=20 (local.get $p))))
    (local.set $control (i32.load offset=4 (local.get $p)))
    (if (i32.ge_u (local.get $control) (i32.const 0x3000))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 8))                                ;; MMSYSERR_NOTSUPPORTED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (local.get $details)
      (then
        (local.set $left (i32.and (i32.load (local.get $details)) (i32.const 0xffff)))
        (local.set $right (local.get $left))
        (if (i32.gt_u (local.get $channels) (i32.const 1))
          (then (local.set $right (i32.and (i32.load offset=4 (local.get $details)) (i32.const 0xffff)))))
        (if (i32.ge_u (local.get $control) (i32.const 0x2000))
          (then (call $host_audio_mixer_set_mute
            (i32.sub (local.get $control) (i32.const 0x2000)) (local.get $left)))
          (else (call $host_audio_mixer_set_volume
            (i32.sub (local.get $control) (i32.const 0x1000))
            (i32.or (local.get $left) (i32.shl (local.get $right) (i32.const 16))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_mixerOpen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 11)) ;; MMSYSERR_INVALPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.ne (local.get $arg1) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 2)) ;; MMSYSERR_BADDEVICEID
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $handle (call $mixer_alloc_handle))
    (if (i32.eqz (local.get $handle))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 7)) ;; MMSYSERR_NOMEM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (i32.store (call $g2w (local.get $arg0)) (local.get $handle))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_mixerClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mixer_close_handle (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_mixerMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; mixerMessage is for driver-private messages (uMsg >= MXDM_USER), and it
    ;; requires a device id rather than an HMIXER.  The virtual mixer exposes
    ;; no private driver protocol, so valid requests fail explicitly.
    (if (i32.lt_u (local.get $arg1) (i32.const 0x4000))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 11)))                       ;; MMSYSERR_INVALPARAM
      (else
        (if (i32.eqz (local.get $arg0))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 8)))                    ;; MMSYSERR_NOTSUPPORTED
          (else
            (if (call $mixer_handle_is_live (local.get $arg0))
              (then (i32.store offset=0 (global.get $reg_base) (i32.const 8)))                ;; handle not accepted here
              (else (i32.store offset=0 (global.get $reg_base) (i32.const 5))))))))           ;; MMSYSERR_INVALHANDLE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
