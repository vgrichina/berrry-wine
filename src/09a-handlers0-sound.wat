;; ---- PlaySound / sndPlaySound shared core --------------------------------
  ;; sndPlaySoundA, PlaySoundA and PlaySoundW all end up doing one thing: hand
  ;; a complete RIFF/WAVE image to $host_play_sound. They differ only in how
  ;; the caller *names* that image — a file on the VFS, a memory block it owns,
  ;; or a WAVE resource in the module — so each naming form resolves to a
  ;; (wasm address, byte length) pair here and they share one validator, one
  ;; flag decision and one playback call.

  ;; A blob is only worth handing to the host if it opens with the RIFF/WAVE
  ;; container header. Anything shorter than a minimal 44-byte canonical WAV,
  ;; or carrying a different fourcc, is a caller error that has to report FALSE
  ;; — never a silent success that leaves the app waiting for audio.
  (func $sound_wav_is_valid (param $data_wa i32) (param $size i32) (result i32)
    (if (i32.lt_u (local.get $size) (i32.const 44)) (then (return (i32.const 0))))
    ;; "RIFF" at +0 and "WAVE" at +8
    (if (i32.ne (i32.load (local.get $data_wa)) (i32.const 0x46464952))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.load (i32.add (local.get $data_wa) (i32.const 8))) (i32.const 0x45564157))
      (then (return (i32.const 0))))
    (i32.const 1))

  ;; One place hands a validated WAV image to the host, so one place owns the
  ;; handle that comes back. The host plays it on a voice it keeps; remembering
  ;; that voice is what makes the *next* PlaySound, SND_PURGE and
  ;; PlaySound(NULL) able to stop this one instead of merely claiming to.
  ;; A host with no audio output returns 0 — that is "nothing to stop later",
  ;; not a failure of the call, so the caller still gets TRUE.
  (func $sound_start (param $data_wa i32) (param $size i32) (param $loop i32)
        (result i32)
    (call $sound_stop_current)
    (global.set $sound_voice
      (call $host_play_sound (local.get $data_wa) (local.get $size)
        (i32.ne (local.get $loop) (i32.const 0))))
    (i32.const 1))

  ;; Stop and release whatever this process last started through PlaySound.
  ;; voice_close is stop-and-free: the voice is a one-shot nobody will ask
  ;; about again, and leaving the slot behind leaks one per sound played.
  (func $sound_stop_current
    (if (global.get $sound_voice)
      (then
        (drop (call $host_voice_close (global.get $sound_voice)))
        (global.set $sound_voice (i32.const 0)))))

  ;; SND_MEMORY: pszSound points at a complete WAV image the caller owns. The
  ;; API carries no length, so the RIFF chunk size at +4 (plus the 8-byte RIFF
  ;; header it excludes) is the only length there is.
  (func $sound_play_memory (param $img_guest i32) (param $loop i32) (result i32)
    (local $data_wa i32) (local $size i32)
    (if (i32.eqz (local.get $img_guest)) (then (return (i32.const 0))))
    (local.set $data_wa (call $g2w (local.get $img_guest)))
    (local.set $size (i32.add
      (i32.load (i32.add (local.get $data_wa) (i32.const 4))) (i32.const 8)))
    (if (i32.eqz (call $sound_wav_is_valid (local.get $data_wa) (local.get $size)))
      (then (return (i32.const 0))))
    (call $sound_start (local.get $data_wa) (local.get $size) (local.get $loop)))

  ;; SND_FILENAME (and the no-flag default): pszSound is a path. Read it
  ;; through the same VFS bridge every other file API uses, into a temporary
  ;; heap block whose first dword doubles as fs_read_file's bytes-read out
  ;; parameter. $host_play_sound copies the bytes out synchronously, so the
  ;; block is freed as soon as it returns. A path that does not resolve returns
  ;; FALSE, which is exactly what Win98 reports for a missing sound file.
  ;;
  ;; A streamed (lazy) file whose bytes are not resident yet returns -2,
  ;; "parked": the Win32 handlers then park the call on IO_WAIT and the host
  ;; re-runs it once the chunk is in, as _lread does. That is what lets sound
  ;; files load on demand instead of all being fetched before the guest
  ;; starts (lib/app-files.js). The Win16 bridge cannot park its scratch frame,
  ;; so there a nonresident sound is simply not played.
  (func $sound_play_file (param $path_guest i32) (param $wide i32) (param $loop i32)
        (result i32)
    (local $handle i32) (local $size i32) (local $blk i32)
    (local $data_guest i32) (local $data_wa i32) (local $ok i32)
    (if (i32.eqz (local.get $path_guest)) (then (return (i32.const 0))))
    (call $lazy_park_release)
    (local.set $handle (call $host_fs_create_file
      (call $g2w (local.get $path_guest))
      (i32.const 0x80000000)   ;; GENERIC_READ
      (i32.const 3)            ;; OPEN_EXISTING
      (i32.const 0x80)         ;; FILE_ATTRIBUTE_NORMAL
      (local.get $wide)))
    (if (i32.eq (local.get $handle) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $size (call $host_fs_get_file_size (local.get $handle)))
    ;; 16 MB is far past any Win98-era effect or jingle; refuse rather than
    ;; hand the heap an attacker-sized allocation from a guest string.
    (if (i32.or (i32.lt_s (local.get $size) (i32.const 44))
                (i32.gt_u (local.get $size) (i32.const 0x01000000)))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (return (i32.const 0))))
    (local.set $blk (call $heap_alloc (i32.add (local.get $size) (i32.const 4))))
    (if (i32.eqz (local.get $blk))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (return (i32.const 0))))
    (local.set $data_guest (i32.add (local.get $blk) (i32.const 4)))
    (i32.store (call $g2w (local.get $blk)) (i32.const 0))
    (local.set $ok (call $host_fs_read_file (local.get $handle)
      (local.get $data_guest) (local.get $size) (local.get $blk)))
    ;; Ask only after a failure, as _lread does: the pending flag describes
    ;; the last failed read, and closing the handle clears it.
    (if (i32.and (i32.eqz (local.get $ok)) (i32.eqz (global.get $win16_in_call32)))
      (then
        (if (i32.eq (call $host_fs_read_pending) (i32.const 1))
          (then
            ;; Held open, not closed: see $lazy_park_hold.
            (call $lazy_park_hold (local.get $handle))
            (call $heap_free (local.get $blk))
            (return (i32.const -2))))))
    (drop (call $host_fs_close_handle (local.get $handle)))
    (if (i32.or (i32.eqz (local.get $ok))
                (i32.ne (i32.load (call $g2w (local.get $blk))) (local.get $size)))
      (then
        (call $heap_free (local.get $blk))
        (return (i32.const 0))))
    (local.set $data_wa (call $g2w (local.get $data_guest)))
    (if (i32.eqz (call $sound_wav_is_valid (local.get $data_wa) (local.get $size)))
      (then
        (call $heap_free (local.get $blk))
        (return (i32.const 0))))
    (drop (call $sound_start (local.get $data_wa) (local.get $size) (local.get $loop)))
    (call $heap_free (local.get $blk))
    (i32.const 1))

  ;; SND_RESOURCE: pszSound is MAKEINTRESOURCE(id) naming a WAVE resource in
  ;; the module's own resource directory.
  (func $sound_play_resource (param $name_id i32) (param $loop i32) (result i32)
    (local $hrsrc i32) (local $entry_wa i32) (local $rva i32) (local $size i32)
    (local $data_wa i32)
    (if (i32.eqz (global.get $rsrc_rva)) (then (return (i32.const 0))))
    (local.set $hrsrc (call $find_resource_named_type (local.get $name_id)))
    (if (i32.eqz (local.get $hrsrc)) (then (return (i32.const 0))))
    (local.set $entry_wa (call $g2w (i32.add (global.get $image_base) (local.get $hrsrc))))
    (local.set $rva (i32.load (local.get $entry_wa)))
    (local.set $size (i32.load (i32.add (local.get $entry_wa) (i32.const 4))))
    (if (i32.eqz (local.get $size)) (then (return (i32.const 0))))
    (local.set $data_wa (call $g2w (i32.add (global.get $image_base) (local.get $rva))))
    (call $sound_start (local.get $data_wa) (local.get $size) (local.get $loop)))

  ;; fdwSound decides which naming form applies, and the order of the tests is
  ;; load-bearing: SND_RESOURCE is 0x00040004, i.e. it *contains* SND_MEMORY,
  ;; so the resource test has to run first or every resource id gets
  ;; dereferenced as a pointer to a WAV image.
  ;;
  ;; The flags that do not pick a form:
  ;;   SND_SYNC (0) / SND_ASYNC (0x1) — the host voice plays on its own clock,
  ;;     so both play and return immediately. A synchronous caller therefore
  ;;     resumes early rather than blocking the whole emulator inside an API
  ;;     call.
  ;;   SND_LOOP (0x8) — passed to the host voice, which repeats the image until
  ;;     the next stop.
  ;;   SND_NODEFAULT (0x2), SND_NOWAIT (0x2000) — we never substitute a default
  ;;     sound and never block, so both are already satisfied by construction.
  (func $sound_play_dispatch (param $name_id i32) (param $flags i32) (param $wide i32)
        (result i32)
    (local $loop i32)
    (local.set $loop (i32.and (local.get $flags) (i32.const 0x8)))
    ;; NULL name, or SND_PURGE (0x40): "stop whatever this process started
    ;; through PlaySound". The host hands back a voice for every sound started
    ;; here, so this is a real stop now, not a claim that one happened.
    (if (i32.or (i32.eqz (local.get $name_id))
                (i32.ne (i32.and (local.get $flags) (i32.const 0x40)) (i32.const 0)))
      (then
        (call $sound_stop_current)
        (return (i32.const 1))))
    ;; SND_NOSTOP (0x10): the caller would rather have nothing than interrupt.
    ;; Windows returns FALSE immediately when the sound device is busy with a
    ;; sound this process already started, and plays nothing. Everything below
    ;; goes through $sound_start, which stops the previous voice first — that
    ;; is PlaySound's default "one sound at a time per process" behaviour.
    (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0))
                 (i32.ne (global.get $sound_voice) (i32.const 0)))
      (then
        (if (call $host_voice_is_playing (global.get $sound_voice))
          (then (return (i32.const 0))))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x40000)) (i32.const 0))
      (then (return (call $sound_play_resource (local.get $name_id) (local.get $loop)))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x4)) (i32.const 0))
      (then (return (call $sound_play_memory (local.get $name_id) (local.get $loop)))))
    ;; SND_ALIAS (0x10000) / SND_ALIAS_ID (0x110000) name an entry in the
    ;; registry's AppEvents sound scheme. This machine ships no scheme, so
    ;; every alias resolves to "no sound is assigned" — which Win98 reports as
    ;; FALSE. Say so instead of claiming a sound was played.
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x10000)) (i32.const 0))
      (then
        (call $host_log_i32 (i32.const 0x50534E41))  ;; 'PSNA': alias, no scheme installed
        (call $host_log_i32 (local.get $name_id))
        (return (i32.const 0))))
    ;; Everything left names a file: SND_FILENAME (0x20000) says so outright,
    ;; and a bare fdwSound of 0 / SND_SYNC / SND_ASYNC means a filename too —
    ;; that is sndPlaySound's default and PlaySound's documented fallback.
    (call $sound_play_file (local.get $name_id) (local.get $wide) (local.get $loop)))

  ;; 65: sndPlaySoundA(pszSound, fuSound) — legacy 2-arg sound API. Same
  ;; naming forms as PlaySound minus the module handle, so it shares the core.
  (func $handle_sndPlaySoundA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sound_play_dispatch
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -2))
      (then (call $io_block (i32.const 12))))
  )

  ;; 863: PlaySoundW(pszSound, hmod, fdwSound) — 3 args stdcall. hmod only
  ;; matters for SND_RESOURCE out of a loaded DLL; we resolve WAVE resources
  ;; from the running image, so it is not consulted. The one A/W difference
  ;; that reaches the core is how the filename form spells its path.
  (func $handle_PlaySoundW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sound_play_dispatch
      (local.get $arg0) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -2))
      (then (call $io_block (i32.const 16))))
  )

  ;; PlaySoundA(pszSound, hmod, fdwSound) — 3 args stdcall, ANSI path form.
  (func $handle_PlaySoundA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sound_play_dispatch
      (local.get $arg0) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -2))
      (then (call $io_block (i32.const 16))))
  )

