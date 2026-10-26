  ;; ============================================================
  ;; AUDIO/WAVE API HANDLERS
  ;; ============================================================

  ;; AVIFileInit() / AVIFileExit() initialize and release the process-wide
  ;; AVIFile library. Microsoft documents a balanced library reference count:
  ;; every initialization must have a matching exit. Keep the count in shared
  ;; memory so calls from distinct guest-thread WASM instances participate in
  ;; one process state. An unmatched exit leaves a fresh process uninitialized
  ;; instead of wrapping the counter and fabricating billions of references.
  (func $handle_AVIFileInit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (i32.atomic.rmw.add
      (global.get $AVIFILE_STATE) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_AVIFileExit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $old i32) (local $seen i32)
    (block $done
      (loop $retry
        (local.set $old (i32.atomic.load (global.get $AVIFILE_STATE)))
        (br_if $done (i32.eqz (local.get $old)))
        (local.set $seen (i32.atomic.rmw.cmpxchg
          (global.get $AVIFILE_STATE)
          (local.get $old)
          (i32.sub (local.get $old) (i32.const 1))))
        (br_if $done (i32.eq (local.get $seen) (local.get $old)))
        (br $retry)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; acmMetrics(hao, uMetric, pMetric) reports Audio Compression Manager
  ;; inventory and sizing information.  The emulator exposes the built-in PCM
  ;; converter and the two ADPCM codecs a stock Win98 installs (MS-ADPCM,
  ;; IMA ADPCM; decode only), and no filters.  ACM_METRIC_MAX_SIZE_FORMAT (50)
  ;; must include the cbSize word and the codec extension: the largest format
  ;; is MS-ADPCM's, 18 + 32 bytes (samples per block, coefficient count and
  ;; seven coefficient pairs). Callers allocate a WAVEFORMATEX from it.
  (func $acm_metrics (param $hao i32) (param $metric i32) (param $out i32) (result i32)
    (local $value i32)
    (if (i32.eqz (local.get $out))
      (then (return (i32.const 11))))                       ;; MMSYSERR_INVALPARAM
    (if (i32.eq (local.get $metric) (i32.const 50))
      (then (call $gs32 (local.get $out) (i32.const 50))    ;; MS-ADPCM WAVEFORMATEX
            (return (i32.const 0))))
    (if (i32.eq (local.get $metric) (i32.const 51))
      (then (call $gs32 (local.get $out) (i32.const 0))     ;; no ACM filters
            (return (i32.const 0))))
    (if (i32.or
          (i32.eq (local.get $metric) (i32.const 1))        ;; COUNT_DRIVERS
          (i32.eq (local.get $metric) (i32.const 20)))      ;; COUNT_LOCAL_DRIVERS
      (then (call $gs32 (local.get $out) (i32.const 3))
            (return (i32.const 0))))
    (if (i32.or
          (i32.eq (local.get $metric) (i32.const 2))        ;; COUNT_CODECS
          (i32.eq (local.get $metric) (i32.const 21)))      ;; COUNT_LOCAL_CODECS
      (then (call $gs32 (local.get $out) (i32.const 2))
            (return (i32.const 0))))
    (if (i32.or
          (i32.eq (local.get $metric) (i32.const 3))        ;; COUNT_CONVERTERS
          (i32.eq (local.get $metric) (i32.const 22)))      ;; COUNT_LOCAL_CONVERTERS
      (then (call $gs32 (local.get $out) (i32.const 1))
            (return (i32.const 0))))
    (if (i32.or
          (i32.le_u (local.get $metric) (i32.const 6))
          (i32.or
            (i32.and (i32.ge_u (local.get $metric) (i32.const 20))
                     (i32.le_u (local.get $metric) (i32.const 25)))
            (i32.and (i32.ge_u (local.get $metric) (i32.const 30))
                     (i32.le_u (local.get $metric) (i32.const 34)))))
      (then (call $gs32 (local.get $out) (i32.const 0))
            (return (i32.const 0))))
    (i32.const 10))                                         ;; MMSYSERR_INVALFLAG

  (func $handle_acmMetrics (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $acm_metrics
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) ;; 3 args stdcall
  )

  ;; acmFormatTagDetailsA(had, paftd, fdwDetails) — describe one format tag.
  ;;
  ;; ACMFORMATTAGDETAILS is 24 bytes of fields then a 48-byte name:
  ;;   +0  cbStruct   +4  dwFormatTagIndex   +8  dwFormatTag
  ;;   +12 cbFormatSize   +16 fdwSupport   +20 cStandardFormats
  ;;   +24 szFormatTag[48]
  ;;
  ;; The low nibble of fdwDetails selects what identifies the tag: INDEX(0)
  ;; means dwFormatTagIndex, FORMATTAG(1) means dwFormatTag. This emulator
  ;; converts nothing, so there is exactly one tag to describe -- PCM -- and
  ;; anything else is ACMERR_NOTPOSSIBLE, which is the same answer a machine
  ;; with no codecs installed gives. cbFormatSize 16 is sizeof(WAVEFORMATEX)
  ;; without the cbSize word, which is what PCM uses.
  ;;
  ;; Sound Recorder asks this to name the format in its About box, and used to
  ;; crash there.
  ;; The A and W entry points differ only in whether the name at the end of the
  ;; struct is written as ASCII or as UTF-16, so both call this. XP's Sound
  ;; Recorder is the W caller; Win98's is the A caller.
  ;; Three tags, in index order: PCM (the converter), MS-ADPCM and IMA ADPCM
  ;; (the two codecs, decode only). The ADPCM tags list no standard formats
  ;; because acmFormatDetails describes PCM only.
  (func $acm_format_tag_details (param $paftd i32) (param $fdw i32) (param $wide i32) (result i32)
    (local $wa i32) (local $query i32) (local $index i32) (local $tag i32) (local $len i32)
    (if (i32.eqz (local.get $paftd))
      (then (return (i32.const 0x00000057))))     ;; MMSYSERR_INVALPARAM
    (local.set $wa (call $g2w (local.get $paftd)))
    (local.set $query (i32.and (local.get $fdw) (i32.const 0x0000000F)))
    (local.set $index (i32.const -1))
    (if (i32.eqz (local.get $query))              ;; ACM_FORMATTAGDETAILSF_INDEX
      (then (local.set $index (i32.load offset=4 (local.get $wa)))))
    (if (i32.eq (local.get $query) (i32.const 1)) ;; ACM_FORMATTAGDETAILSF_FORMATTAG
      (then
        (local.set $tag (i32.load offset=8 (local.get $wa)))
        (if (i32.eq (local.get $tag) (i32.const 1)) (then (local.set $index (i32.const 0))))
        (if (i32.eq (local.get $tag) (i32.const 2)) (then (local.set $index (i32.const 1))))
        (if (i32.eq (local.get $tag) (i32.const 0x11)) (then (local.set $index (i32.const 2))))))
    (if (i32.gt_u (local.get $index) (i32.const 2))
      (then (return (i32.const 512))))            ;; ACMERR_NOTPOSSIBLE
    ;; Keep the caller's cbStruct — it declares the size it allocated. The
    ;; name field is 48 chars, so a wide one runs to +24+96.
    (call $zero_memory (i32.add (local.get $wa) (i32.const 4))
      (select (i32.const 116) (i32.const 68) (local.get $wide)))
    (i32.store offset=4 (local.get $wa) (local.get $index))
    (if (i32.eqz (local.get $index))
      (then
        (i32.store offset=8  (local.get $wa) (i32.const 1))    ;; WAVE_FORMAT_PCM
        (i32.store offset=12 (local.get $wa) (i32.const 16))   ;; PCM WAVEFORMATEX
        (i32.store offset=16 (local.get $wa) (i32.const 0x04)) ;; SUPPORTF_CONVERTER
        ;; 4 sample rates x 8/16 bit x mono/stereo, the set waveOutGetDevCaps
        ;; below reports as supported.
        (i32.store offset=20 (local.get $wa) (i32.const 16))
        (i32.store offset=24 (local.get $wa) (i32.const 0x004D4350))  ;; "PCM\0"
        (local.set $len (i32.const 3))))
    (if (i32.eq (local.get $index) (i32.const 1))
      (then
        (i32.store offset=8  (local.get $wa) (i32.const 2))    ;; WAVE_FORMAT_ADPCM
        (i32.store offset=12 (local.get $wa) (i32.const 50))   ;; with 7 coefficient pairs
        (i32.store offset=16 (local.get $wa) (i32.const 0x01)) ;; SUPPORTF_CODEC
        (i32.store offset=24 (local.get $wa) (i32.const 0x7263694D))  ;; "Micr"
        (i32.store offset=28 (local.get $wa) (i32.const 0x666F736F))  ;; "osof"
        (i32.store offset=32 (local.get $wa) (i32.const 0x44412074))  ;; "t AD"
        (i32.store offset=36 (local.get $wa) (i32.const 0x004D4350))  ;; "PCM\0"
        (local.set $len (i32.const 15))))
    (if (i32.eq (local.get $index) (i32.const 2))
      (then
        (i32.store offset=8  (local.get $wa) (i32.const 0x11)) ;; WAVE_FORMAT_IMA_ADPCM
        (i32.store offset=12 (local.get $wa) (i32.const 20))   ;; + wSamplesPerBlock
        (i32.store offset=16 (local.get $wa) (i32.const 0x01)) ;; SUPPORTF_CODEC
        (i32.store offset=24 (local.get $wa) (i32.const 0x20414D49))  ;; "IMA "
        (i32.store offset=28 (local.get $wa) (i32.const 0x43504441))  ;; "ADPC"
        (i32.store offset=32 (local.get $wa) (i32.const 0x0000004D))  ;; "M\0"
        (local.set $len (i32.const 9))))
    (if (local.get $wide)
      (then (call $acm_widen_in_place
              (i32.add (local.get $paftd) (i32.const 24)) (local.get $len))))
    (i32.const 0))                                 ;; MMSYSERR_NOERROR

  (func $handle_acmFormatTagDetailsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $acm_format_tag_details
      (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args stdcall
  )

  (func $handle_acmFormatTagDetailsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $acm_format_tag_details
      (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; The standard PCM formats this emulator offers, in the order ACM
  ;; enumerates them: sample rate slowest first, then 8 before 16 bit, then
  ;; mono before stereo. 4 x 2 x 2 = the 16 that acmFormatTagDetailsA reports
  ;; as cStandardFormats, and the same set waveOutGetDevCaps advertises.
  (func $acm_pcm_rate (param $index i32) (result i32)
    (local $slot i32)
    (local.set $slot (i32.shr_u (local.get $index) (i32.const 2)))
    (if (i32.eqz (local.get $slot)) (then (return (i32.const 8000))))
    (if (i32.eq (local.get $slot) (i32.const 1)) (then (return (i32.const 11025))))
    (if (i32.eq (local.get $slot) (i32.const 2)) (then (return (i32.const 22050))))
    (i32.const 44100))
  (func $acm_pcm_bits (param $index i32) (result i32)
    (select (i32.const 16) (i32.const 8)
      (i32.and (i32.shr_u (local.get $index) (i32.const 1)) (i32.const 1))))
  (func $acm_pcm_channels (param $index i32) (result i32)
    (i32.add (i32.and (local.get $index) (i32.const 1)) (i32.const 1)))

  ;; "22.050 kHz, 16 Bit, Stereo" — how Windows names a PCM format in Sound
  ;; Recorder's format list. The rate is written as kHz with three decimals,
  ;; which for these rates is the sample rate with a dot after the thousands.
  ;; $dst is a GUEST address: this writes through $gs8/$gs32 because
  ;; $write_uint does, and mixing the two address spaces in one buffer reads a
  ;; WASM offset as a guest one and lands outside memory entirely.
  (func $acm_pcm_format_name (param $dst i32) (param $index i32) (result i32)
    (local $p i32) (local $rate i32)
    (local.set $p (local.get $dst))
    (local.set $rate (call $acm_pcm_rate (local.get $index)))
    (local.set $p (i32.add (local.get $p)
      (call $write_uint (local.get $p) (i32.div_u (local.get $rate) (i32.const 1000)))))
    (call $gs8 (local.get $p) (i32.const 0x2E))                  ;; '.'
    (local.set $p (i32.add (local.get $p) (i32.const 1)))
    ;; three digits, zero padded — 8000 is ".000", 11025 is ".025"
    (call $gs8 (local.get $p)
      (i32.add (i32.const 0x30)
        (i32.rem_u (i32.div_u (local.get $rate) (i32.const 100)) (i32.const 10))))
    (call $gs8 (i32.add (local.get $p) (i32.const 1))
      (i32.add (i32.const 0x30)
        (i32.rem_u (i32.div_u (local.get $rate) (i32.const 10)) (i32.const 10))))
    (call $gs8 (i32.add (local.get $p) (i32.const 2))
      (i32.add (i32.const 0x30) (i32.rem_u (local.get $rate) (i32.const 10))))
    (local.set $p (i32.add (local.get $p) (i32.const 3)))
    ;; " kHz, " and " Bit, " written as their bytes rather than as data
    ;; segments: the ordinal-import tables address 01-header's segment by
    ;; absolute offset, so adding a string there shifts every later entry.
    (call $gs32 (local.get $p) (i32.const 0x7A486B20))                     ;; " kHz"
    (call $gs16 (i32.add (local.get $p) (i32.const 4)) (i32.const 0x202C)) ;; ", "
    (local.set $p (i32.add (local.get $p) (i32.const 6)))
    (local.set $p (i32.add (local.get $p)
      (call $write_uint (local.get $p) (call $acm_pcm_bits (local.get $index)))))
    (call $gs32 (local.get $p) (i32.const 0x74694220))                     ;; " Bit"
    (call $gs16 (i32.add (local.get $p) (i32.const 4)) (i32.const 0x202C)) ;; ", "
    (local.set $p (i32.add (local.get $p) (i32.const 6)))
    (if (i32.eq (call $acm_pcm_channels (local.get $index)) (i32.const 2))
      (then
        (call $gs32 (local.get $p) (i32.const 0x72657453))                     ;; "Ster"
        (call $gs16 (i32.add (local.get $p) (i32.const 4)) (i32.const 0x6F65)) ;; "eo"
        (local.set $p (i32.add (local.get $p) (i32.const 6))))
      (else
        (call $gs32 (local.get $p) (i32.const 0x6F6E6F4D))                     ;; "Mono"
        (local.set $p (i32.add (local.get $p) (i32.const 4)))))
    (call $gs8 (local.get $p) (i32.const 0))
    (i32.sub (local.get $p) (local.get $dst)))

  ;; Expand an ASCII string already written at $dst into UTF-16 in place.
  ;; Walking backwards means each character is read before the wide character
  ;; that will sit on top of it is written, so no copy buffer is needed -- and
  ;; the wide field these land in is always at least twice the ASCII length.
  (func $acm_widen_in_place (param $dst i32) (param $len i32)
    (local $i i32)
    (call $gs16 (i32.add (local.get $dst) (i32.shl (local.get $len) (i32.const 1)))
      (i32.const 0))
    (local.set $i (local.get $len))
    (block $done (loop $back
      (br_if $done (i32.eqz (local.get $i)))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (call $gs16 (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 1)))
        (call $gl8 (i32.add (local.get $dst) (local.get $i))))
      (br $back))))

  ;; acmFormatDetailsA(had, pafd, fdwDetails) — describe one format.
  ;;
  ;; ACMFORMATDETAILS is 24 bytes then a 128-byte name:
  ;;   +0  cbStruct   +4  dwFormatIndex   +8  dwFormatTag   +12 fdwSupport
  ;;   +16 pwfx (caller's WAVEFORMATEX buffer)   +20 cbwfx   +24 szFormat[128]
  ;;
  ;; INDEX(0) means "fill in the n-th format of dwFormatTag"; FORMAT(1) means
  ;; the caller already put a WAVEFORMATEX in pwfx and wants it named. Both
  ;; write szFormat, which is the part an app puts in front of a user.
  (func $acm_format_details (param $pafd i32) (param $fdw i32) (param $wide i32) (result i32)
    (local $wa i32) (local $query i32) (local $index i32)
    (local $pwfx i32) (local $cbwfx i32) (local $rate i32) (local $bits i32) (local $ch i32)
    (if (i32.eqz (local.get $pafd))
      (then (return (i32.const 0x00000057))))     ;; MMSYSERR_INVALPARAM
    (local.set $wa (call $g2w (local.get $pafd)))
    (local.set $query (i32.and (local.get $fdw) (i32.const 0x0000000F)))
    (local.set $index (i32.load offset=4 (local.get $wa)))
    (local.set $pwfx (i32.load offset=16 (local.get $wa)))
    (local.set $cbwfx (i32.load offset=20 (local.get $wa)))
    ;; PCM is the only tag; tag 0 (WAVE_FORMAT_UNKNOWN) means "any".
    (if (i32.and
          (i32.ne (i32.load offset=8 (local.get $wa)) (i32.const 1))
          (i32.ne (i32.load offset=8 (local.get $wa)) (i32.const 0)))
      (then (return (i32.const 512))))            ;; ACMERR_NOTPOSSIBLE
    (if (i32.eqz (local.get $query))
      (then
        (if (i32.ge_u (local.get $index) (i32.const 16))
          (then (return (i32.const 512))))        ;; past the last format
        (local.set $rate (call $acm_pcm_rate (local.get $index)))
        (local.set $bits (call $acm_pcm_bits (local.get $index)))
        (local.set $ch   (call $acm_pcm_channels (local.get $index)))
        (if (i32.and (i32.ne (local.get $pwfx) (i32.const 0))
              (i32.ge_u (local.get $cbwfx) (i32.const 16)))
          (then
            (local.set $pwfx (call $g2w (local.get $pwfx)))
            (i32.store16 (local.get $pwfx) (i32.const 1))              ;; WAVE_FORMAT_PCM
            (i32.store16 offset=2 (local.get $pwfx) (local.get $ch))
            (i32.store offset=4 (local.get $pwfx) (local.get $rate))
            (i32.store offset=8 (local.get $pwfx)                       ;; nAvgBytesPerSec
              (i32.mul (local.get $rate)
                (i32.mul (local.get $ch) (i32.shr_u (local.get $bits) (i32.const 3)))))
            (i32.store16 offset=12 (local.get $pwfx)                    ;; nBlockAlign
              (i32.mul (local.get $ch) (i32.shr_u (local.get $bits) (i32.const 3))))
            (i32.store16 offset=14 (local.get $pwfx) (local.get $bits))
            (if (i32.ge_u (local.get $cbwfx) (i32.const 18))
              (then (i32.store16 offset=16 (local.get $pwfx) (i32.const 0))))))
        (i32.store offset=8 (local.get $wa) (i32.const 1)))
      (else
        ;; Name the caller's own format. Read it back rather than trusting the
        ;; index, and find the matching standard entry for the name.
        (if (i32.eqz (local.get $pwfx))
          (then (return (i32.const 0x00000057))))
        (local.set $pwfx (call $g2w (local.get $pwfx)))
        (local.set $rate (i32.load offset=4 (local.get $pwfx)))
        (local.set $bits (i32.load16_u offset=14 (local.get $pwfx)))
        (local.set $ch   (i32.load16_u offset=2 (local.get $pwfx)))
        (local.set $index
          (i32.or
            (i32.shl
              (select (i32.const 3)
                (select (i32.const 2)
                  (select (i32.const 1) (i32.const 0)
                    (i32.ge_u (local.get $rate) (i32.const 11025)))
                  (i32.ge_u (local.get $rate) (i32.const 22050)))
                (i32.ge_u (local.get $rate) (i32.const 44100)))
              (i32.const 2))
            (i32.or
              (i32.shl (select (i32.const 1) (i32.const 0)
                (i32.ge_u (local.get $bits) (i32.const 16))) (i32.const 1))
              (select (i32.const 1) (i32.const 0)
                (i32.ge_u (local.get $ch) (i32.const 2))))))))
    (i32.store offset=12 (local.get $wa) (i32.const 0x04))   ;; SUPPORTF_CONVERTER
    (local.set $index (call $acm_pcm_format_name
      (i32.add (local.get $pafd) (i32.const 24)) (local.get $index)))
    (if (local.get $wide)
      (then (call $acm_widen_in_place
              (i32.add (local.get $pafd) (i32.const 24)) (local.get $index))))
    (i32.const 0))                                           ;; MMSYSERR_NOERROR

  (func $handle_acmFormatDetailsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $acm_format_details
      (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args stdcall
  )

  (func $handle_acmFormatDetailsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $acm_format_details
      (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; acmFormatSuggest(had, pwfxSrc, pwfxDst, cbwfxDst, fdwSuggest) — pick a
  ;; destination format the installed converters can reach from pwfxSrc.
  ;; With only the PCM converter, the source must be 8- or 16-bit PCM and the
  ;; answer is PCM; each ACM_FORMATSUGGESTF_* bit pins that field to what the
  ;; caller already put in pwfxDst, the rest are copied from the source.
  ;;   WFORMATTAG 0x10000  NCHANNELS 0x20000  NSAMPLESPERSEC 0x40000
  ;;   WBITSPERSAMPLE 0x80000
  (func $acm_format_suggest (param $src i32) (param $dst i32) (param $cb i32) (param $fdw i32) (result i32)
    (local $sw i32) (local $dw i32) (local $ch i32) (local $rate i32) (local $bits i32)
    (if (i32.or (i32.eqz (local.get $src)) (i32.eqz (local.get $dst)))
      (then (return (i32.const 11))))                       ;; MMSYSERR_INVALPARAM
    (if (i32.lt_u (local.get $cb) (i32.const 16))
      (then (return (i32.const 11))))
    (local.set $sw (call $g2w (local.get $src)))
    (local.set $dw (call $g2w (local.get $dst)))
    ;; An ADPCM source: the codecs decode to 16-bit (or, pinned, 8-bit) PCM
    ;; at the source's rate and channel count, and nothing else (they do not
    ;; resample or remix). Every field the caller pins must agree with that.
    (if (call $acm_adpcm_samples_per_block (local.get $src))
      (then
        (local.set $ch (i32.load16_u offset=2 (local.get $sw)))
        (local.set $rate (i32.load offset=4 (local.get $sw)))
        (if (i32.or
              (i32.or
                (i32.and (i32.ne (i32.and (local.get $fdw) (i32.const 0x10000)) (i32.const 0))
                         (i32.ne (i32.load16_u (local.get $dw)) (i32.const 1)))
                (i32.and (i32.ne (i32.and (local.get $fdw) (i32.const 0x20000)) (i32.const 0))
                         (i32.ne (i32.load16_u offset=2 (local.get $dw)) (local.get $ch))))
              (i32.or
                (i32.and (i32.ne (i32.and (local.get $fdw) (i32.const 0x40000)) (i32.const 0))
                         (i32.ne (i32.load offset=4 (local.get $dw)) (local.get $rate)))
                (i32.and (i32.ne (i32.and (local.get $fdw) (i32.const 0x80000)) (i32.const 0))
                         (i32.and (i32.ne (i32.load16_u offset=14 (local.get $dw)) (i32.const 16))
                                  (i32.ne (i32.load16_u offset=14 (local.get $dw)) (i32.const 8))))))
          (then (return (i32.const 512))))                  ;; ACMERR_NOTPOSSIBLE
        (local.set $bits (select (i32.const 8) (i32.const 16)
          (i32.and (i32.ne (i32.and (local.get $fdw) (i32.const 0x80000)) (i32.const 0))
                   (i32.eq (i32.load16_u offset=14 (local.get $dw)) (i32.const 8)))))
        (call $acm_write_pcm16_format (local.get $dst) (local.get $cb)
          (local.get $ch) (local.get $rate))
        (if (i32.eq (local.get $bits) (i32.const 8))
          (then
            (call $gs32 (i32.add (local.get $dst) (i32.const 8)) (i32.mul (local.get $rate) (local.get $ch)))
            (call $gs16 (i32.add (local.get $dst) (i32.const 12)) (local.get $ch))
            (call $gs16 (i32.add (local.get $dst) (i32.const 14)) (i32.const 8))))
        (return (i32.const 0))))
    (if (i32.ne (i32.load16_u (local.get $sw)) (i32.const 1))
      (then (return (i32.const 512))))                      ;; ACMERR_NOTPOSSIBLE
    (if (i32.and (i32.ne (i32.and (local.get $fdw) (i32.const 0x10000)) (i32.const 0))
                 (i32.ne (i32.load16_u (local.get $dw)) (i32.const 1)))
      (then (return (i32.const 512))))
    (local.set $ch (select (i32.load16_u offset=2 (local.get $dw))
                           (i32.load16_u offset=2 (local.get $sw))
                           (i32.ne (i32.and (local.get $fdw) (i32.const 0x20000)) (i32.const 0))))
    (local.set $rate (select (i32.load offset=4 (local.get $dw))
                             (i32.load offset=4 (local.get $sw))
                             (i32.ne (i32.and (local.get $fdw) (i32.const 0x40000)) (i32.const 0))))
    (local.set $bits (select (i32.load16_u offset=14 (local.get $dw))
                             (i32.load16_u offset=14 (local.get $sw))
                             (i32.ne (i32.and (local.get $fdw) (i32.const 0x80000)) (i32.const 0))))
    (if (i32.and (i32.ne (local.get $bits) (i32.const 8)) (i32.ne (local.get $bits) (i32.const 16)))
      (then (return (i32.const 512))))
    (if (i32.or (i32.eqz (local.get $ch)) (i32.gt_u (local.get $ch) (i32.const 2)))
      (then (return (i32.const 512))))
    (if (i32.eqz (local.get $rate))
      (then (return (i32.const 512))))
    (i32.store16 (local.get $dw) (i32.const 1))                 ;; WAVE_FORMAT_PCM
    (i32.store16 offset=2 (local.get $dw) (local.get $ch))
    (i32.store offset=4 (local.get $dw) (local.get $rate))
    (i32.store offset=8 (local.get $dw)                          ;; nAvgBytesPerSec
      (i32.mul (local.get $rate)
        (i32.mul (local.get $ch) (i32.shr_u (local.get $bits) (i32.const 3)))))
    (i32.store16 offset=12 (local.get $dw)                       ;; nBlockAlign
      (i32.mul (local.get $ch) (i32.shr_u (local.get $bits) (i32.const 3))))
    (i32.store16 offset=14 (local.get $dw) (local.get $bits))
    (if (i32.ge_u (local.get $cb) (i32.const 18))
      (then (i32.store16 offset=16 (local.get $dw) (i32.const 0))))
    (i32.const 0))

  (func $handle_acmFormatSuggest (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $acm_format_suggest
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; 5 args stdcall
  )

  ;; The three ACM drivers acmMetrics counts, under fixed HACMDRIVERIDs: the
  ;; built-in PCM converter, and the MS-ADPCM and IMA ADPCM codecs a stock
  ;; Win98 installs (decode to PCM only; see the stream table below). Tomb
  ;; Raider III looks the MS-ADPCM codec up by its short name.
  (func $acm_pcm_driver_id (result i32) (i32.const 0x0ACD0001))
  (func $acm_driver_id (param $index i32) (result i32)
    (i32.add (i32.const 0x0ACD0001) (local.get $index)))
  ;; fdwSupport of driver $index: CONVERTER (0x2) for PCM, CODEC (0x1) else,
  ;; plus ACMDRIVERDETAILS_SUPPORTF_DISABLED (0x80000000) while
  ;; acmDriverPriority has it disabled.
  (func $acm_driver_support (param $index i32) (result i32)
    (i32.or
      (select (i32.const 0x2) (i32.const 0x1) (i32.eqz (local.get $index)))
      (select (i32.const 0x80000000) (i32.const 0)
        (call $acm_driver_disabled (local.get $index)))))

  ;; Shared per-driver state ($ACM_DRIVER_STATE): bit 31 disabled, low byte
  ;; priority. A zero byte is the boot order, priority = index + 1, so the
  ;; zero-filled region needs no initialisation.
  (global $ACM_DRIVER_STATE i32 (region.addr $ACM_DRIVER_STATE 0))
  (global $ACM_DRIVER_STATE_SIZE i32 (region.size $ACM_DRIVER_STATE))
  (func $acm_driver_state (param $index i32) (result i32)
    (i32.add (global.get $ACM_DRIVER_STATE) (i32.shl (local.get $index) (i32.const 2))))
  (func $acm_driver_disabled (param $index i32) (result i32)
    (i32.ne (i32.and (i32.load (call $acm_driver_state (local.get $index)))
                     (i32.const 0x80000000)) (i32.const 0)))
  (func $acm_driver_priority (param $index i32) (result i32)
    (local $p i32)
    (local.set $p (i32.and (i32.load (call $acm_driver_state (local.get $index))) (i32.const 0xFF)))
    (select (i32.add (local.get $index) (i32.const 1)) (local.get $p) (i32.eqz (local.get $p))))
  (func $acm_driver_set_priority (param $index i32) (param $p i32)
    (local $a i32)
    (local.set $a (call $acm_driver_state (local.get $index)))
    (i32.store (local.get $a)
      (i32.or (i32.and (i32.load (local.get $a)) (i32.const 0xFFFFFF00)) (local.get $p))))
  ;; Driver index holding priority $p (1..3).
  (func $acm_driver_at_priority (param $p i32) (result i32)
    (local $i i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (i32.const 3)))
      (if (i32.eq (call $acm_driver_priority (local.get $i)) (local.get $p))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; acmDriverPriority(hadid, dwPriority, fdwPriority) -> MMRESULT, after
  ;; Wine's msacm32 and the Win98 contract. ENABLE 0x1 / DISABLE 0x2 change a
  ;; driver's enabled state; BEGIN 0x10000 / END 0x20000 only bracket a batch
  ;; of changes (notification deferral) and must come alone, with no driver
  ;; and no priority. dwPriority 0 keeps the priority, -1 makes it the
  ;; lowest, 1..3 moves the driver there and shifts the others. FreeSpace
  ;; calls it after enumerating the ADPCM codecs (dc7e8454d added them).
  (func $acm_driver_priority_set (param $hadid i32) (param $prio i32) (param $fdw i32) (result i32)
    (local $index i32) (local $old i32) (local $i i32) (local $p i32) (local $a i32)
    (if (i32.and (local.get $fdw) (i32.const 0xFFFCFFFC)) (then (return (i32.const 10))))  ;; INVALFLAG
    (if (i32.eq (i32.and (local.get $fdw) (i32.const 0x3)) (i32.const 0x3)) (then (return (i32.const 10))))
    (if (i32.eq (i32.and (local.get $fdw) (i32.const 0x30000)) (i32.const 0x30000)) (then (return (i32.const 10))))
    (if (i32.and (local.get $fdw) (i32.const 0x30000))
      (then
        (if (i32.or (i32.ne (i32.and (local.get $fdw) (i32.const 0x3)) (i32.const 0))
              (i32.or (i32.ne (local.get $prio) (i32.const 0)) (i32.ne (local.get $hadid) (i32.const 0))))
          (then (return (i32.const 11))))                                    ;; INVALPARAM
        (return (i32.const 0))))
    (local.set $index (i32.sub (local.get $hadid) (call $acm_pcm_driver_id)))
    (if (i32.gt_u (local.get $index) (i32.const 2)) (then (return (i32.const 5))))  ;; INVALHANDLE
    (if (i32.eq (local.get $prio) (i32.const -1)) (then (local.set $prio (i32.const 3))))
    (if (i32.gt_u (local.get $prio) (i32.const 3)) (then (return (i32.const 11))))
    (local.set $a (call $acm_driver_state (local.get $index)))
    (if (i32.and (local.get $fdw) (i32.const 0x1))
      (then (i32.store (local.get $a) (i32.and (i32.load (local.get $a)) (i32.const 0x7FFFFFFF)))))
    (if (i32.and (local.get $fdw) (i32.const 0x2))
      (then (i32.store (local.get $a) (i32.or (i32.load (local.get $a)) (i32.const 0x80000000)))))
    (if (local.get $prio)
      (then
        ;; Move $index from $old to $prio; drivers between them shift by one.
        (local.set $old (call $acm_driver_priority (local.get $index)))
        (local.set $i (i32.const 0))
        (block $done (loop $shift
          (br_if $done (i32.ge_u (local.get $i) (i32.const 3)))
          (local.set $p (call $acm_driver_priority (local.get $i)))
          (if (i32.ne (local.get $i) (local.get $index))
            (then
              (if (i32.and (i32.lt_u (local.get $old) (local.get $prio))
                    (i32.and (i32.gt_u (local.get $p) (local.get $old)) (i32.le_u (local.get $p) (local.get $prio))))
                (then (call $acm_driver_set_priority (local.get $i) (i32.sub (local.get $p) (i32.const 1)))))
              (if (i32.and (i32.gt_u (local.get $old) (local.get $prio))
                    (i32.and (i32.ge_u (local.get $p) (local.get $prio)) (i32.lt_u (local.get $p) (local.get $old))))
                (then (call $acm_driver_set_priority (local.get $i) (i32.add (local.get $p) (i32.const 1)))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $shift)))
        (call $acm_driver_set_priority (local.get $index) (local.get $prio))))
    (i32.const 0))

  (func $handle_acmDriverPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $acm_driver_priority_set (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))  ;; 3 args stdcall

  ;; acmDriverEnum(fnCallback, dwInstance, fdwEnum) calls
  ;; fnCallback(hadid, dwInstance, fdwSupport) per driver until the callback
  ;; returns FALSE, then returns MMSYSERR_NOERROR. The iterator lives on the
  ;; guest stack (tagged like DirectSoundEnumerate's, so the CACA0007
  ;; continuation finds it): +0 tag 'ACME', +4 caller return, +8 callback,
  ;; +12 dwInstance, +16 priority (1..3) of the driver just reported, +20
  ;; fdwEnum. Drivers are reported in acmDriverPriority order. NOLOCAL
  ;; (0x40000000) removes nothing (every driver here is global); without
  ;; DISABLED (0x80000000) a disabled driver is skipped.
  ;; First priority >= $p whose driver the enumeration reports, or 0.
  (func $acm_driver_enum_next (param $p i32) (param $fdw i32) (result i32)
    (block $done (loop $scan
      (br_if $done (i32.gt_u (local.get $p) (i32.const 3)))
      (if (i32.or (i32.ne (i32.and (local.get $fdw) (i32.const 0x80000000)) (i32.const 0))
                  (i32.eqz (call $acm_driver_disabled (call $acm_driver_at_priority (local.get $p)))))
        (then (return (local.get $p))))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $acm_driver_enum_invoke (param $frame i32)
    (local $sp i32) (local $index i32)
    (local.set $index (call $acm_driver_at_priority
      (call $gl32 (i32.add (local.get $frame) (i32.const 16)))))
    (local.set $sp (i32.sub (local.get $frame) (i32.const 16)))
    (call $gs32 (local.get $sp) (global.get $ddenum_ret_thunk))
    (call $gs32 (i32.add (local.get $sp) (i32.const 4)) (call $acm_driver_id (local.get $index)))
    (call $gs32 (i32.add (local.get $sp) (i32.const 8))
      (call $gl32 (i32.add (local.get $frame) (i32.const 12))))
    (call $gs32 (i32.add (local.get $sp) (i32.const 12)) (call $acm_driver_support (local.get $index)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 8))))
    (global.set $steps (i32.const 0)))

  (func $acm_driver_enum_continue
    (local $frame i32) (local $next i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (local.set $next (call $acm_driver_enum_next
      (i32.add (call $gl32 (i32.add (local.get $frame) (i32.const 16))) (i32.const 1))
      (call $gl32 (i32.add (local.get $frame) (i32.const 20)))))
    (if (i32.and (i32.ne (i32.load (global.get $reg_base)) (i32.const 0))
                 (i32.ne (local.get $next) (i32.const 0)))
      (then
        (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (local.get $next))
        (call $acm_driver_enum_invoke (local.get $frame))
        (return)))
    ;; Return to the caller past the 24-byte iterator, the return address and
    ;; the 3-argument stdcall frame.
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $frame) (i32.const 40)))
    (i32.store (global.get $reg_base) (i32.const 0)))

  (func $handle_acmDriverEnum (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $frame i32) (local $result i32)
    (local.set $result (i32.const 0))
    (if (i32.eqz (local.get $arg0))
      (then (local.set $result (i32.const 11))))                          ;; MMSYSERR_INVALPARAM
    (if (i32.and (local.get $arg2) (i32.const 0x3FFFFFFF))
      (then (local.set $result (i32.const 10))))                          ;; MMSYSERR_INVALFLAG
    (if (local.get $result)
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $result))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Every driver disabled and DISABLED not asked for: nothing to report.
    (local.set $result (call $acm_driver_enum_next (i32.const 1) (local.get $arg2)))
    (if (i32.eqz (local.get $result))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; The iterator sits just below the caller's frame (ESP -> return address).
    (local.set $frame (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (call $gs32 (local.get $frame) (i32.const 0x454D4341))               ;; 'ACME'
    (call $gs32 (i32.add (local.get $frame) (i32.const 4))
      (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $arg0))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $arg1))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (local.get $result))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (local.get $arg2))
    (call $acm_driver_enum_invoke (local.get $frame)))

  ;; One dword of ACMDRIVERDETAILS, written only if it lies inside the
  ;; caller's cbStruct: a short struct is valid and gets just its prefix.
  (func $acm_dd_put32 (param $padd i32) (param $cb i32) (param $off i32) (param $value i32)
    (if (i32.le_u (i32.add (local.get $off) (i32.const 4)) (local.get $cb))
      (then (call $gs32 (i32.add (local.get $padd) (local.get $off)) (local.get $value)))))

  ;; acmDriverDetailsA(hadid, padd, fdwDetails). ACMDRIVERDETAILSA is 920
  ;; bytes: +0 cbStruct +4 fccType +8 fccComp +12 wMid/wPid +16 vdwACM
  ;; +20 vdwDriver +24 fdwSupport +28 cFormatTags +32 cFilterTags +36 hicon
  ;; +40 szShortName[32] +72 szLongName[128] +200 szCopyright[80]
  ;; +280 szLicensing[128] +408 szFeatures[512]. cbStruct is the caller's
  ;; and is kept; everything else up to it is rewritten. The guest address
  ;; is written field by field, so the struct may straddle pages.
  (func $acm_driver_details (param $hadid i32) (param $padd i32) (param $fdw i32) (result i32)
    (local $cb i32) (local $i i32) (local $index i32)
    (if (local.get $fdw) (then (return (i32.const 10))))                   ;; MMSYSERR_INVALFLAG
    (local.set $index (i32.sub (local.get $hadid) (call $acm_pcm_driver_id)))
    (if (i32.gt_u (local.get $index) (i32.const 2))
      (then (return (i32.const 5))))                                       ;; MMSYSERR_INVALHANDLE
    (if (i32.eqz (local.get $padd)) (then (return (i32.const 11))))        ;; MMSYSERR_INVALPARAM
    (local.set $cb (call $gl32 (local.get $padd)))
    (if (i32.lt_u (local.get $cb) (i32.const 4)) (then (return (i32.const 11))))
    (if (i32.gt_u (local.get $cb) (i32.const 920)) (then (local.set $cb (i32.const 920))))
    (local.set $i (i32.const 4))
    (block $done (loop $zero
      (br_if $done (i32.ge_u (local.get $i) (local.get $cb)))
      (call $gs8 (i32.add (local.get $padd) (local.get $i)) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $zero)))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 4) (i32.const 0x63647561))  ;; 'audc'
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 16) (i32.const 0x03320000)) ;; ACM 3.50
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 20) (i32.const 0x03320000))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 24)
      (call $acm_driver_support (local.get $index)))
    (if (local.get $index)
      (then
        ;; wMid MM_MICROSOFT (1), wPid MM_MSFT_ACM_MSADPCM (33) / _IMAADPCM (34);
        ;; each codec knows PCM and its own tag.
        (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 12)
          (i32.or (i32.const 1) (i32.shl (i32.add (i32.const 32) (local.get $index)) (i32.const 16))))
        (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 28) (i32.const 2))
        (if (i32.eq (local.get $index) (i32.const 1))
          (then
            ;; "MS-ADPCM" / "Microsoft ADPCM CODEC"
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 40) (i32.const 0x412D534D))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 44) (i32.const 0x4D435044))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 72) (i32.const 0x7263694D))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 76) (i32.const 0x666F736F))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 80) (i32.const 0x44412074))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 84) (i32.const 0x204D4350))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 88) (i32.const 0x45444F43))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 92) (i32.const 0x00000043)))
          (else
            ;; "MS-IMA ADPCM" / "Microsoft IMA ADPCM CODEC"
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 40) (i32.const 0x492D534D))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 44) (i32.const 0x4120414D))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 48) (i32.const 0x4D435044))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 72) (i32.const 0x7263694D))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 76) (i32.const 0x666F736F))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 80) (i32.const 0x4D492074))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 84) (i32.const 0x44412041))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 88) (i32.const 0x204D4350))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 92) (i32.const 0x45444F43))
            (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 96) (i32.const 0x00000043))))
        (return (i32.const 0))))
    ;; wMid MM_MICROSOFT (1), wPid MM_MSFT_ACM_PCM (38)
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 12) (i32.const 0x00260001))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 28) (i32.const 1))          ;; PCM tag only
    ;; "MS-PCM"
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 40) (i32.const 0x502D534D))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 44) (i32.const 0x00004D43))
    ;; "Microsoft PCM Converter"
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 72) (i32.const 0x7263694D))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 76) (i32.const 0x666F736F))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 80) (i32.const 0x43502074))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 84) (i32.const 0x6F43204D))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 88) (i32.const 0x7265766E))
    (call $acm_dd_put32 (local.get $padd) (local.get $cb) (i32.const 92) (i32.const 0x00726574))
    (i32.const 0))

  ;; acmGetVersion() -> 0xAABBCCCC: major, minor, build of MSACM32. Windows 98
  ;; ships ACM 4.00 (msacm32.dll 4.00.1998); FreeSpace asks before it opens
  ;; any stream. No arguments, so only the return address is popped.
  (func $handle_acmGetVersion (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x040007CE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; acmDriverOpen(phad, hadid, fdwOpen) / acmDriverClose(had, fdwClose).
  ;; An open driver handle (HACMDRIVER) names one of the three drivers:
  ;; 0x0ACE0001 + index, parallel to the HACMDRIVERIDs. Opening one costs no
  ;; state here (each codec is a stateless function of its stream), so Close
  ;; only validates. Tomb Raider III opens the MS-ADPCM codec it found by name
  ;; and passes the handle to acmStreamOpen.
  (func $acm_open_driver_index (param $had i32) (result i32)
    (i32.sub (local.get $had) (i32.const 0x0ACE0001)))

  (func $handle_acmDriverOpen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $index i32)
    (local.set $index (i32.sub (local.get $arg1) (call $acm_pcm_driver_id)))
    (local.set $result (i32.const 0))
    (if (i32.gt_u (local.get $index) (i32.const 2)) (then (local.set $result (i32.const 5))))  ;; INVALHANDLE
    (if (i32.and (i32.eqz (local.get $result)) (call $acm_driver_disabled (local.get $index)))
      (then (local.set $result (i32.const 12))))                                              ;; NOTENABLED
    (if (i32.eqz (local.get $arg0)) (then (local.set $result (i32.const 11))))                ;; INVALPARAM
    (if (local.get $arg2) (then (local.set $result (i32.const 10))))                          ;; INVALFLAG
    (if (i32.eqz (local.get $result))
      (then (call $gs32 (local.get $arg0) (i32.add (i32.const 0x0ACE0001) (local.get $index)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args stdcall
  )

  (func $handle_acmDriverClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (local.set $result (i32.const 0))
    (if (i32.gt_u (call $acm_open_driver_index (local.get $arg0)) (i32.const 2))
      (then (local.set $result (i32.const 5))))                                               ;; INVALHANDLE
    (if (i32.and (i32.eqz (local.get $result)) (i32.ne (local.get $arg1) (i32.const 0)))
      (then (local.set $result (i32.const 10))))                                              ;; INVALFLAG
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; 2 args stdcall
  )

  (func $handle_acmDriverDetailsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $acm_driver_details
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args stdcall
  )

  ;; ---- ACM streams: MS-ADPCM and IMA ADPCM decode to 16-bit PCM ----
  ;;
  ;; QMixer (Outwars) and Tomb Raider III expect the ADPCM codecs a stock
  ;; Win98 installs. Both decode one block at a time; a block starts with a
  ;; per-channel header and then packs 4-bit samples. The stream handle is a
  ;; guest-heap record (HACMSTREAM):
  ;;   +0 'ACMS' +4 wFormatTag +8 nChannels +12 nSamplesPerSec
  ;;   +16 nBlockAlign +20 samples per block +24 coefficient count
  ;;   +28 coefficient pairs (MS-ADPCM only: int16 coef1, int16 coef2 each)
  ;; Encoding is not provided; an app that asks for it gets ACMERR_NOTPOSSIBLE,
  ;; as from a codec without that direction.

  (func $acm_s16 (param $g i32) (result i32)
    (i32.extend16_s (call $gl16 (local.get $g))))

  ;; Samples per block if $fmt (guest WAVEFORMATEX) is a well-formed MS-ADPCM
  ;; or IMA ADPCM format, else 0. The extension's wSamplesPerBlock must match
  ;; what nBlockAlign holds: MS-ADPCM spends 7 bytes per channel on the header
  ;; and puts two samples there, IMA 4 bytes and one sample.
  (func $acm_adpcm_samples_per_block (param $fmt i32) (result i32)
    (local $tag i32) (local $ch i32) (local $align i32) (local $cb i32)
    (local $spb i32) (local $ncoef i32) (local $hdr i32)
    (if (i32.eqz (local.get $fmt)) (then (return (i32.const 0))))
    (local.set $tag (call $gl16 (local.get $fmt)))
    (if (i32.and (i32.ne (local.get $tag) (i32.const 2)) (i32.ne (local.get $tag) (i32.const 0x11)))
      (then (return (i32.const 0))))
    (local.set $ch (call $gl16 (i32.add (local.get $fmt) (i32.const 2))))
    (if (i32.or (i32.eqz (local.get $ch)) (i32.gt_u (local.get $ch) (i32.const 2)))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl16 (i32.add (local.get $fmt) (i32.const 14))) (i32.const 4))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $gl32 (i32.add (local.get $fmt) (i32.const 4))))
      (then (return (i32.const 0))))
    (local.set $align (call $gl16 (i32.add (local.get $fmt) (i32.const 12))))
    (local.set $cb (call $gl16 (i32.add (local.get $fmt) (i32.const 16))))
    (if (i32.lt_u (local.get $cb) (i32.const 2)) (then (return (i32.const 0))))
    (local.set $spb (call $gl16 (i32.add (local.get $fmt) (i32.const 18))))
    (local.set $hdr (i32.mul (local.get $ch) (select (i32.const 7) (i32.const 4)
      (i32.eq (local.get $tag) (i32.const 2)))))
    (if (i32.le_u (local.get $align) (local.get $hdr)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $tag) (i32.const 2))
      (then
        (if (i32.lt_u (local.get $cb) (i32.const 4)) (then (return (i32.const 0))))
        (local.set $ncoef (call $gl16 (i32.add (local.get $fmt) (i32.const 20))))
        (if (i32.or (i32.eqz (local.get $ncoef)) (i32.gt_u (local.get $ncoef) (i32.const 256)))
          (then (return (i32.const 0))))
        (if (i32.lt_u (local.get $cb) (i32.add (i32.const 4) (i32.shl (local.get $ncoef) (i32.const 2))))
          (then (return (i32.const 0))))
        (if (i32.ne (local.get $spb)
              (i32.add (i32.div_u (i32.shl (i32.sub (local.get $align) (local.get $hdr)) (i32.const 1))
                                  (local.get $ch)) (i32.const 2)))
          (then (return (i32.const 0)))))
      (else
        ;; IMA data comes in 4-byte runs per channel.
        (if (i32.rem_u (i32.sub (local.get $align) (local.get $hdr))
                       (i32.shl (local.get $ch) (i32.const 2)))
          (then (return (i32.const 0))))
        (if (i32.ne (local.get $spb)
              (i32.add (i32.div_u (i32.shl (i32.sub (local.get $align) (local.get $hdr)) (i32.const 1))
                                  (local.get $ch)) (i32.const 1)))
          (then (return (i32.const 0))))))
    (local.get $spb))

  ;; Write a 16-bit PCM WAVEFORMATEX(+cbSize when the buffer holds it).
  (func $acm_write_pcm16_format (param $dst i32) (param $cb i32) (param $ch i32) (param $rate i32)
    (call $gs16 (local.get $dst) (i32.const 1))                               ;; WAVE_FORMAT_PCM
    (call $gs16 (i32.add (local.get $dst) (i32.const 2)) (local.get $ch))
    (call $gs32 (i32.add (local.get $dst) (i32.const 4)) (local.get $rate))
    (call $gs32 (i32.add (local.get $dst) (i32.const 8))
      (i32.mul (local.get $rate) (i32.shl (local.get $ch) (i32.const 1))))
    (call $gs16 (i32.add (local.get $dst) (i32.const 12)) (i32.shl (local.get $ch) (i32.const 1)))
    (call $gs16 (i32.add (local.get $dst) (i32.const 14)) (i32.const 16))
    (if (i32.ge_u (local.get $cb) (i32.const 18))
      (then (call $gs16 (i32.add (local.get $dst) (i32.const 16)) (i32.const 0)))))

  ;; Is $dst the one PCM format an ADPCM $src decodes to?
  ;; PCM of the source's rate and channels at 16 or 8 bits: what msadp32 and
  ;; imaadp32 decode to. FreeSpace asks for 8-bit mono 22050 Hz.
  (func $acm_is_pcm16_of (param $dst i32) (param $src i32) (result i32)
    (i32.and
      (i32.and
        (i32.eq (call $gl16 (local.get $dst)) (i32.const 1))
        (i32.or
          (i32.eq (call $gl16 (i32.add (local.get $dst) (i32.const 14))) (i32.const 16))
          (i32.eq (call $gl16 (i32.add (local.get $dst) (i32.const 14))) (i32.const 8))))
      (i32.and
        (i32.eq (call $gl16 (i32.add (local.get $dst) (i32.const 2)))
                (call $gl16 (i32.add (local.get $src) (i32.const 2))))
        (i32.eq (call $gl32 (i32.add (local.get $dst) (i32.const 4)))
                (call $gl32 (i32.add (local.get $src) (i32.const 4)))))))

  (func $acm_clamp16 (param $v i32) (result i32)
    (if (i32.lt_s (local.get $v) (i32.const -32768)) (then (return (i32.const -32768))))
    (if (i32.gt_s (local.get $v) (i32.const 32767)) (then (return (i32.const 32767))))
    (local.get $v))

  ;; IMA ADPCM step sizes (index 0..88; the caller clamps the index).
  (func $ima_step_size (param $i i32) (result i32)
    (block $c88
    (block $c87
    (block $c86
    (block $c85
    (block $c84
    (block $c83
    (block $c82
    (block $c81
    (block $c80
    (block $c79
    (block $c78
    (block $c77
    (block $c76
    (block $c75
    (block $c74
    (block $c73
    (block $c72
    (block $c71
    (block $c70
    (block $c69
    (block $c68
    (block $c67
    (block $c66
    (block $c65
    (block $c64
    (block $c63
    (block $c62
    (block $c61
    (block $c60
    (block $c59
    (block $c58
    (block $c57
    (block $c56
    (block $c55
    (block $c54
    (block $c53
    (block $c52
    (block $c51
    (block $c50
    (block $c49
    (block $c48
    (block $c47
    (block $c46
    (block $c45
    (block $c44
    (block $c43
    (block $c42
    (block $c41
    (block $c40
    (block $c39
    (block $c38
    (block $c37
    (block $c36
    (block $c35
    (block $c34
    (block $c33
    (block $c32
    (block $c31
    (block $c30
    (block $c29
    (block $c28
    (block $c27
    (block $c26
    (block $c25
    (block $c24
    (block $c23
    (block $c22
    (block $c21
    (block $c20
    (block $c19
    (block $c18
    (block $c17
    (block $c16
    (block $c15
    (block $c14
    (block $c13
    (block $c12
    (block $c11
    (block $c10
    (block $c9
    (block $c8
    (block $c7
    (block $c6
    (block $c5
    (block $c4
    (block $c3
    (block $c2
    (block $c1
    (block $c0
    (br_table $c0 $c1 $c2 $c3 $c4 $c5 $c6 $c7 $c8 $c9 $c10 $c11 $c12 $c13 $c14 $c15 $c16 $c17 $c18 $c19 $c20 $c21 $c22 $c23 $c24 $c25 $c26 $c27 $c28 $c29 $c30 $c31 $c32 $c33 $c34 $c35 $c36 $c37 $c38 $c39 $c40 $c41 $c42 $c43 $c44 $c45 $c46 $c47 $c48 $c49 $c50 $c51 $c52 $c53 $c54 $c55 $c56 $c57 $c58 $c59 $c60 $c61 $c62 $c63 $c64 $c65 $c66 $c67 $c68 $c69 $c70 $c71 $c72 $c73 $c74 $c75 $c76 $c77 $c78 $c79 $c80 $c81 $c82 $c83 $c84 $c85 $c86 $c87 $c88 (local.get $i)))
    (return (i32.const 7)))
    (return (i32.const 8)))
    (return (i32.const 9)))
    (return (i32.const 10)))
    (return (i32.const 11)))
    (return (i32.const 12)))
    (return (i32.const 13)))
    (return (i32.const 14)))
    (return (i32.const 16)))
    (return (i32.const 17)))
    (return (i32.const 19)))
    (return (i32.const 21)))
    (return (i32.const 23)))
    (return (i32.const 25)))
    (return (i32.const 28)))
    (return (i32.const 31)))
    (return (i32.const 34)))
    (return (i32.const 37)))
    (return (i32.const 41)))
    (return (i32.const 45)))
    (return (i32.const 50)))
    (return (i32.const 55)))
    (return (i32.const 60)))
    (return (i32.const 66)))
    (return (i32.const 73)))
    (return (i32.const 80)))
    (return (i32.const 88)))
    (return (i32.const 97)))
    (return (i32.const 107)))
    (return (i32.const 118)))
    (return (i32.const 130)))
    (return (i32.const 143)))
    (return (i32.const 157)))
    (return (i32.const 173)))
    (return (i32.const 190)))
    (return (i32.const 209)))
    (return (i32.const 230)))
    (return (i32.const 253)))
    (return (i32.const 279)))
    (return (i32.const 307)))
    (return (i32.const 337)))
    (return (i32.const 371)))
    (return (i32.const 408)))
    (return (i32.const 449)))
    (return (i32.const 494)))
    (return (i32.const 544)))
    (return (i32.const 598)))
    (return (i32.const 658)))
    (return (i32.const 724)))
    (return (i32.const 796)))
    (return (i32.const 876)))
    (return (i32.const 963)))
    (return (i32.const 1060)))
    (return (i32.const 1166)))
    (return (i32.const 1282)))
    (return (i32.const 1411)))
    (return (i32.const 1552)))
    (return (i32.const 1707)))
    (return (i32.const 1878)))
    (return (i32.const 2066)))
    (return (i32.const 2272)))
    (return (i32.const 2499)))
    (return (i32.const 2749)))
    (return (i32.const 3024)))
    (return (i32.const 3327)))
    (return (i32.const 3660)))
    (return (i32.const 4026)))
    (return (i32.const 4428)))
    (return (i32.const 4871)))
    (return (i32.const 5358)))
    (return (i32.const 5894)))
    (return (i32.const 6484)))
    (return (i32.const 7132)))
    (return (i32.const 7845)))
    (return (i32.const 8630)))
    (return (i32.const 9493)))
    (return (i32.const 10442)))
    (return (i32.const 11487)))
    (return (i32.const 12635)))
    (return (i32.const 13899)))
    (return (i32.const 15289)))
    (return (i32.const 16818)))
    (return (i32.const 18500)))
    (return (i32.const 20350)))
    (return (i32.const 22385)))
    (return (i32.const 24623)))
    (return (i32.const 27086)))
    (return (i32.const 29794)))
    (i32.const 32767))

  ;; MS-ADPCM delta adaptation factors, indexed by the unsigned nibble.
  (func $msadpcm_adapt (param $i i32) (result i32)
    (block $c15
    (block $c14
    (block $c13
    (block $c12
    (block $c11
    (block $c10
    (block $c9
    (block $c8
    (block $c7
    (block $c6
    (block $c5
    (block $c4
    (block $c3
    (block $c2
    (block $c1
    (block $c0
    (br_table $c0 $c1 $c2 $c3 $c4 $c5 $c6 $c7 $c8 $c9 $c10 $c11 $c12 $c13 $c14 $c15 (local.get $i)))
    (return (i32.const 230)))
    (return (i32.const 230)))
    (return (i32.const 230)))
    (return (i32.const 230)))
    (return (i32.const 307)))
    (return (i32.const 409)))
    (return (i32.const 512)))
    (return (i32.const 614)))
    (return (i32.const 768)))
    (return (i32.const 614)))
    (return (i32.const 512)))
    (return (i32.const 409)))
    (return (i32.const 307)))
    (return (i32.const 230)))
    (return (i32.const 230)))
    (i32.const 230))

  ;; One MS-ADPCM block -> spb*ch samples at $dst (Wine msadp32's arithmetic:
  ;; prediction (s1*c1 + s2*c2) / 256 truncated, plus nibble*delta, clamped;
  ;; delta = max(16, adapt[nibble]*delta / 256)). The header holds each
  ;; channel's predictor index, delta and the block's first two samples
  ;; (sample2 is played first). Stereo nibbles alternate, left in the high one.
  (func $msadpcm_decode_block (param $st i32) (param $src i32) (param $dst i32)
    (local $ch i32) (local $spb i32) (local $ncoef i32) (local $n i32) (local $total i32)
    (local $nib i32) (local $c i32) (local $p i32) (local $byte i32)
    (local $d0 i32) (local $d1 i32) (local $a0 i32) (local $a1 i32) (local $b0 i32) (local $b1 i32)
    (local $c10 i32) (local $c20 i32) (local $c11 i32) (local $c21 i32)
    (local $pred i32) (local $s i32) (local $data i32) (local $out i32)
    (local.set $ch (call $gl32 (i32.add (local.get $st) (i32.const 8))))
    (local.set $spb (call $gl32 (i32.add (local.get $st) (i32.const 20))))
    (local.set $ncoef (call $gl32 (i32.add (local.get $st) (i32.const 24))))
    ;; predictor indices -> coefficient pairs (an index past the table uses
    ;; the first pair rather than reading beyond it)
    (local.set $p (call $gl8 (local.get $src)))
    (if (i32.ge_u (local.get $p) (local.get $ncoef)) (then (local.set $p (i32.const 0))))
    (local.set $c10 (call $acm_s16 (i32.add (local.get $st) (i32.add (i32.const 28) (i32.shl (local.get $p) (i32.const 2))))))
    (local.set $c20 (call $acm_s16 (i32.add (local.get $st) (i32.add (i32.const 30) (i32.shl (local.get $p) (i32.const 2))))))
    (if (i32.eq (local.get $ch) (i32.const 1))
      (then
        (local.set $d0 (call $acm_s16 (i32.add (local.get $src) (i32.const 1))))
        (local.set $a0 (call $acm_s16 (i32.add (local.get $src) (i32.const 3))))
        (local.set $b0 (call $acm_s16 (i32.add (local.get $src) (i32.const 5))))
        (call $gs16 (local.get $dst) (local.get $b0))
        (call $gs16 (i32.add (local.get $dst) (i32.const 2)) (local.get $a0))
        (local.set $data (i32.add (local.get $src) (i32.const 7)))
        (local.set $out (i32.add (local.get $dst) (i32.const 4))))
      (else
        (local.set $p (call $gl8 (i32.add (local.get $src) (i32.const 1))))
        (if (i32.ge_u (local.get $p) (local.get $ncoef)) (then (local.set $p (i32.const 0))))
        (local.set $c11 (call $acm_s16 (i32.add (local.get $st) (i32.add (i32.const 28) (i32.shl (local.get $p) (i32.const 2))))))
        (local.set $c21 (call $acm_s16 (i32.add (local.get $st) (i32.add (i32.const 30) (i32.shl (local.get $p) (i32.const 2))))))
        (local.set $d0 (call $acm_s16 (i32.add (local.get $src) (i32.const 2))))
        (local.set $d1 (call $acm_s16 (i32.add (local.get $src) (i32.const 4))))
        (local.set $a0 (call $acm_s16 (i32.add (local.get $src) (i32.const 6))))
        (local.set $a1 (call $acm_s16 (i32.add (local.get $src) (i32.const 8))))
        (local.set $b0 (call $acm_s16 (i32.add (local.get $src) (i32.const 10))))
        (local.set $b1 (call $acm_s16 (i32.add (local.get $src) (i32.const 12))))
        (call $gs16 (local.get $dst) (local.get $b0))
        (call $gs16 (i32.add (local.get $dst) (i32.const 2)) (local.get $b1))
        (call $gs16 (i32.add (local.get $dst) (i32.const 4)) (local.get $a0))
        (call $gs16 (i32.add (local.get $dst) (i32.const 6)) (local.get $a1))
        (local.set $data (i32.add (local.get $src) (i32.const 14)))
        (local.set $out (i32.add (local.get $dst) (i32.const 8)))))
    (local.set $total (i32.mul (i32.sub (local.get $spb) (i32.const 2)) (local.get $ch)))
    (block $done (loop $each
      (br_if $done (i32.ge_u (local.get $n) (local.get $total)))
      (local.set $byte (call $gl8 (i32.add (local.get $data) (i32.shr_u (local.get $n) (i32.const 1)))))
      (local.set $nib (select (i32.shr_u (local.get $byte) (i32.const 4))
                              (i32.and (local.get $byte) (i32.const 15))
                              (i32.eqz (i32.and (local.get $n) (i32.const 1)))))
      (local.set $c (i32.and (i32.and (local.get $n) (i32.const 1)) (i32.eq (local.get $ch) (i32.const 2))))
      (if (local.get $c)
        (then
          (local.set $pred (i32.div_s (i32.add (i32.mul (local.get $a1) (local.get $c11))
                                               (i32.mul (local.get $b1) (local.get $c21))) (i32.const 256)))
          (local.set $s (call $acm_clamp16 (i32.add (local.get $pred)
            (i32.mul (i32.sub (local.get $nib) (i32.shl (i32.shr_u (local.get $nib) (i32.const 3)) (i32.const 4)))
                     (local.get $d1)))))
          (local.set $b1 (local.get $a1)) (local.set $a1 (local.get $s))
          (local.set $d1 (i32.div_s (i32.mul (call $msadpcm_adapt (local.get $nib)) (local.get $d1)) (i32.const 256)))
          (if (i32.lt_s (local.get $d1) (i32.const 16)) (then (local.set $d1 (i32.const 16)))))
        (else
          (local.set $pred (i32.div_s (i32.add (i32.mul (local.get $a0) (local.get $c10))
                                               (i32.mul (local.get $b0) (local.get $c20))) (i32.const 256)))
          (local.set $s (call $acm_clamp16 (i32.add (local.get $pred)
            (i32.mul (i32.sub (local.get $nib) (i32.shl (i32.shr_u (local.get $nib) (i32.const 3)) (i32.const 4)))
                     (local.get $d0)))))
          (local.set $b0 (local.get $a0)) (local.set $a0 (local.get $s))
          (local.set $d0 (i32.div_s (i32.mul (call $msadpcm_adapt (local.get $nib)) (local.get $d0)) (i32.const 256)))
          (if (i32.lt_s (local.get $d0) (i32.const 16)) (then (local.set $d0 (i32.const 16))))))
      (call $gs16 (i32.add (local.get $out) (i32.shl (local.get $n) (i32.const 1))) (local.get $s))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $each))))

  ;; One IMA ADPCM block -> spb*ch samples at $dst. Each channel's 4-byte
  ;; header holds its first sample (played as sample 0) and step index; the
  ;; rest comes in 4-byte runs per channel, low nibble first. The difference
  ;; is the classic bit-accumulated step/8 + step/4 + step/2 + step.
  (func $imaadpcm_decode_block (param $st i32) (param $src i32) (param $dst i32)
    (local $ch i32) (local $spb i32) (local $c i32) (local $s i32) (local $idx i32)
    (local $k i32) (local $nruns i32) (local $j i32) (local $byte i32) (local $nib i32)
    (local $step i32) (local $diff i32) (local $pos i32) (local $half i32)
    (local.set $ch (call $gl32 (i32.add (local.get $st) (i32.const 8))))
    (local.set $spb (call $gl32 (i32.add (local.get $st) (i32.const 20))))
    (local.set $nruns (i32.shr_u (i32.sub (local.get $spb) (i32.const 1)) (i32.const 3)))
    (local.set $c (i32.const 0))
    (block $chans_done (loop $chans
      (br_if $chans_done (i32.ge_u (local.get $c) (local.get $ch)))
      (local.set $s (call $acm_s16 (i32.add (local.get $src) (i32.shl (local.get $c) (i32.const 2)))))
      (local.set $idx (call $gl8 (i32.add (local.get $src) (i32.add (i32.shl (local.get $c) (i32.const 2)) (i32.const 2)))))
      (if (i32.gt_u (local.get $idx) (i32.const 88)) (then (local.set $idx (i32.const 88))))
      (call $gs16 (i32.add (local.get $dst) (i32.shl (local.get $c) (i32.const 1))) (local.get $s))
      (local.set $pos (i32.const 1))
      (local.set $k (i32.const 0))
      (block $runs_done (loop $runs
        (br_if $runs_done (i32.ge_u (local.get $k) (local.get $nruns)))
        (local.set $j (i32.const 0))
        (block $bytes_done (loop $bytes
          (br_if $bytes_done (i32.ge_u (local.get $j) (i32.const 8)))
          (local.set $byte (call $gl8 (i32.add (local.get $src)
            (i32.add (i32.shl (local.get $ch) (i32.const 2))
              (i32.add (i32.shl (i32.add (i32.mul (local.get $k) (local.get $ch)) (local.get $c)) (i32.const 2))
                       (i32.shr_u (local.get $j) (i32.const 1)))))))
          (local.set $nib (select (i32.shr_u (local.get $byte) (i32.const 4))
                                  (i32.and (local.get $byte) (i32.const 15))
                                  (i32.and (local.get $j) (i32.const 1))))
          (local.set $step (call $ima_step_size (local.get $idx)))
          (local.set $diff (i32.shr_u (local.get $step) (i32.const 3)))
          (if (i32.and (local.get $nib) (i32.const 4)) (then (local.set $diff (i32.add (local.get $diff) (local.get $step)))))
          (if (i32.and (local.get $nib) (i32.const 2)) (then (local.set $diff (i32.add (local.get $diff) (i32.shr_u (local.get $step) (i32.const 1))))))
          (if (i32.and (local.get $nib) (i32.const 1)) (then (local.set $diff (i32.add (local.get $diff) (i32.shr_u (local.get $step) (i32.const 2))))))
          (local.set $s (call $acm_clamp16
            (select (i32.sub (local.get $s) (local.get $diff)) (i32.add (local.get $s) (local.get $diff))
                    (i32.and (local.get $nib) (i32.const 8)))))
          (local.set $half (i32.and (local.get $nib) (i32.const 7)))
          (local.set $idx (i32.add (local.get $idx)
            (select (i32.sub (i32.shl (local.get $half) (i32.const 1)) (i32.const 6)) (i32.const -1)
                    (i32.ge_u (local.get $half) (i32.const 4)))))
          (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (local.set $idx (i32.const 0))))
          (if (i32.gt_s (local.get $idx) (i32.const 88)) (then (local.set $idx (i32.const 88))))
          (call $gs16 (i32.add (local.get $dst)
            (i32.shl (i32.add (i32.mul (local.get $pos) (local.get $ch)) (local.get $c)) (i32.const 1)))
            (local.get $s))
          (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br $bytes)))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $runs)))
      (local.set $c (i32.add (local.get $c) (i32.const 1)))
      (br $chans))))

  ;; The live stream record behind $has, or 0. Handles are guest-heap
  ;; pointers carrying the 'ACMS' tag; Close clears it.
  (func $acm_stream_lookup (param $has i32) (result i32)
    (if (i32.eqz (call $heap_block_size_checked (local.get $has))) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (local.get $has)) (i32.const 0x534D4341)) (then (return (i32.const 0))))
    (local.get $has))

  ;; acmStreamOpen(phas, had, pwfxSrc, pwfxDst, pwfltr, dwCallback,
  ;;               dwInstance, fdwOpen) — 8 args stdcall.
  ;; ADPCM -> 16-bit PCM of the same rate and channels is decoded here. Every
  ;; other pair is ACMERR_NOTPOSSIBLE, as on a machine without that codec,
  ;; except PCM-to-PCM, the built-in converter's job, which does not exist
  ;; yet: fail fast. QUERY (0x1) answers without opening; ASYNC (0x2) is
  ;; NOTPOSSIBLE because these codecs are not asynchronous.
  (func $handle_acmStreamOpen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $fdw i32) (local $spb i32) (local $st i32) (local $ncoef i32) (local $i i32)
    (local.set $fdw (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    (local.set $result (i32.const 11))                      ;; MMSYSERR_INVALPARAM
    (if (i32.and (i32.ne (local.get $arg2) (i32.const 0)) (i32.ne (local.get $arg3) (i32.const 0)))
      (then
        (local.set $result (i32.const 512))                 ;; ACMERR_NOTPOSSIBLE
        (local.set $spb (call $acm_adpcm_samples_per_block (local.get $arg2)))
        ;; A named driver (had from acmDriverOpen) must be the codec for this
        ;; tag: MS-ADPCM is driver 1, IMA ADPCM driver 2.
        (if (i32.and (i32.ne (local.get $spb) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
          (then
            (if (i32.ne (call $acm_open_driver_index (local.get $arg1))
                        (select (i32.const 1) (i32.const 2)
                          (i32.eq (call $gl16 (local.get $arg2)) (i32.const 2))))
              (then (local.set $spb (i32.const 0))))))
        ;; With no driver named, ACM picks among ENABLED codecs only: a codec
        ;; acmDriverPriority disabled leaves the conversion impossible.
        (if (i32.and (i32.ne (local.get $spb) (i32.const 0)) (i32.eqz (local.get $arg1)))
          (then
            (if (call $acm_driver_disabled
                  (select (i32.const 1) (i32.const 2) (i32.eq (call $gl16 (local.get $arg2)) (i32.const 2))))
              (then (local.set $spb (i32.const 0))))))
        (if (i32.and
              (i32.and (i32.ne (local.get $spb) (i32.const 0))
                       (call $acm_is_pcm16_of (local.get $arg3) (local.get $arg2)))
              (i32.and (i32.eqz (local.get $arg4))
                       (i32.eqz (i32.and (local.get $fdw) (i32.const 0x2)))))
          (then
            (local.set $result (i32.const 0))
            (if (i32.eqz (i32.and (local.get $fdw) (i32.const 0x1)))
              (then
                (local.set $ncoef (select (call $gl16 (i32.add (local.get $arg2) (i32.const 20))) (i32.const 0)
                  (i32.eq (call $gl16 (local.get $arg2)) (i32.const 2))))
                (local.set $st (call $heap_alloc (i32.add (i32.const 28) (i32.shl (local.get $ncoef) (i32.const 2)))))
                (if (i32.eqz (local.get $st))
                  (then (local.set $result (i32.const 7)))  ;; MMSYSERR_NOMEM
                  (else
                    (call $gs32 (local.get $st) (i32.const 0x534D4341))   ;; 'ACMS'
                    ;; +4: wFormatTag, | 0x10000 when the output is 8-bit PCM.
                    (call $gs32 (i32.add (local.get $st) (i32.const 4))
                      (i32.or (call $gl16 (local.get $arg2))
                        (select (i32.const 0x10000) (i32.const 0)
                          (i32.eq (call $gl16 (i32.add (local.get $arg3) (i32.const 14))) (i32.const 8)))))
                    (call $gs32 (i32.add (local.get $st) (i32.const 8)) (call $gl16 (i32.add (local.get $arg2) (i32.const 2))))
                    (call $gs32 (i32.add (local.get $st) (i32.const 12)) (call $gl32 (i32.add (local.get $arg2) (i32.const 4))))
                    (call $gs32 (i32.add (local.get $st) (i32.const 16)) (call $gl16 (i32.add (local.get $arg2) (i32.const 12))))
                    (call $gs32 (i32.add (local.get $st) (i32.const 20)) (local.get $spb))
                    (call $gs32 (i32.add (local.get $st) (i32.const 24)) (local.get $ncoef))
                    (local.set $i (i32.const 0))
                    (block $copied (loop $copy
                      (br_if $copied (i32.ge_u (local.get $i) (local.get $ncoef)))
                      (call $gs32 (i32.add (local.get $st) (i32.add (i32.const 28) (i32.shl (local.get $i) (i32.const 2))))
                        (call $gl32 (i32.add (local.get $arg2) (i32.add (i32.const 22) (i32.shl (local.get $i) (i32.const 2))))))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $copy)))))))))
        (if (i32.and
              (i32.eq (call $gl16 (local.get $arg2)) (i32.const 1))
              (i32.eq (call $gl16 (local.get $arg3)) (i32.const 1)))
          (then (call $crash_unimplemented (local.get $name_ptr))))))
    (if (i32.ne (local.get $arg0) (i32.const 0))
      (then (call $gs32 (local.get $arg0) (select (local.get $st) (i32.const 0) (i32.eqz (local.get $result))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
  )

  ;; acmStreamClose(has, fdwClose)
  (func $handle_acmStreamClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $result i32)
    (local.set $st (call $acm_stream_lookup (local.get $arg0)))
    (local.set $result (i32.const 5))                       ;; MMSYSERR_INVALHANDLE
    (if (local.get $st)
      (then
        (call $gs32 (local.get $st) (i32.const 0))
        (call $heap_free (local.get $st))
        (local.set $result (i32.const 0))))
    (if (i32.and (i32.eqz (local.get $result)) (i32.ne (local.get $arg1) (i32.const 0)))
      (then (local.set $result (i32.const 10))))            ;; MMSYSERR_INVALFLAG (closed anyway)
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Bytes of 16-bit PCM one block of stream $st decodes to.
  ;; 1 when the stream decodes to 8-bit PCM (see acmStreamOpen's +4).
  (func $acm_stream_out8 (param $st i32) (result i32)
    (i32.ne (i32.and (call $gl32 (i32.add (local.get $st) (i32.const 4))) (i32.const 0x10000)) (i32.const 0)))
  ;; Decoded bytes of one block in the stream's output format.
  (func $acm_stream_pcm_block_bytes (param $st i32) (result i32)
    (i32.shl (i32.mul (call $gl32 (i32.add (local.get $st) (i32.const 20)))
                      (call $gl32 (i32.add (local.get $st) (i32.const 8))))
             (i32.eqz (call $acm_stream_out8 (local.get $st)))))

  ;; acmStreamSize(has, cbInput, pdwOutputBytes, fdwSize). Whole blocks only:
  ;; SOURCE (0) gives the PCM bytes cbInput of ADPCM decodes to, DESTINATION
  ;; (1) the ADPCM bytes needed to fill cbInput of PCM. Less than one block
  ;; is ACMERR_NOTPOSSIBLE, with *pdwOutputBytes already 0: msacm32 clears
  ;; it before asking the driver (Wine's acmStreamSize does the same).
  ;; FreeSpace ignores the error at the tail of a voice stream (DESTINATION
  ;; 1792 < one 2024-byte block) and passes the output straight to mmioRead;
  ;; left unwritten, a stale 0x8D659 read 579 KB over its ship models
  ;; ("Illegal subsystem type", AiCode.cpp:8931).
  (func $handle_acmStreamSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $result i32) (local $blocks i32) (local $out i32)
    (local.set $st (call $acm_stream_lookup (local.get $arg0)))
    (local.set $result (i32.const 5))                       ;; MMSYSERR_INVALHANDLE
    (if (local.get $st)
      (then
        (local.set $result (i32.const 0))
        (if (i32.eqz (local.get $arg2)) (then (local.set $result (i32.const 11))))
        (if (i32.gt_u (i32.and (local.get $arg3) (i32.const 0xF)) (i32.const 1))
          (then (local.set $result (i32.const 10))))
        (if (i32.eqz (local.get $result))
          (then
            (call $gs32 (local.get $arg2) (i32.const 0))
            (if (i32.and (local.get $arg3) (i32.const 1))
              (then
                (local.set $blocks (i32.div_u (local.get $arg1) (call $acm_stream_pcm_block_bytes (local.get $st))))
                (local.set $out (i32.mul (local.get $blocks) (call $gl32 (i32.add (local.get $st) (i32.const 16))))))
              (else
                (local.set $blocks (i32.div_u (local.get $arg1) (call $gl32 (i32.add (local.get $st) (i32.const 16)))))
                (local.set $out (i32.mul (local.get $blocks) (call $acm_stream_pcm_block_bytes (local.get $st))))))
            (if (i32.eqz (local.get $blocks))
              (then (local.set $result (i32.const 512)))
              (else (call $gs32 (local.get $arg2) (local.get $out))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; ACMSTREAMHEADER: +0 cbStruct(>=84) +4 fdwStatus +8 dwUser +12 pbSrc
  ;; +16 cbSrcLength +20 cbSrcLengthUsed +24 dwSrcUser +28 pbDst
  ;; +32 cbDstLength +36 cbDstLengthUsed +40 dwDstUser +44 dwReservedDriver[10].
  ;; fdwStatus: DONE 0x10000, PREPARED 0x20000, INQUEUE 0x100000.
  ;; Common checks for the three header calls: a live stream, a header of at
  ;; least ACMSTREAMHEADER size, and no flags beyond $allowed. Returns 0 or an
  ;; MMRESULT.
  (func $acm_header_check (param $has i32) (param $pash i32) (param $fdw i32) (param $allowed i32) (result i32)
    (if (i32.eqz (call $acm_stream_lookup (local.get $has))) (then (return (i32.const 5))))
    (if (i32.eqz (local.get $pash)) (then (return (i32.const 11))))
    (if (i32.lt_u (call $gl32 (local.get $pash)) (i32.const 84)) (then (return (i32.const 11))))
    (if (i32.and (local.get $fdw) (i32.xor (local.get $allowed) (i32.const -1)))
      (then (return (i32.const 10))))
    (i32.const 0))

  ;; acmStreamPrepareHeader(has, pash, fdwPrepare): marks the header
  ;; prepared and records its buffers in dwReservedDriver, as the ACM does.
  (func $handle_acmStreamPrepareHeader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $status i32)
    (local.set $result (call $acm_header_check (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (if (i32.eqz (local.get $result))
      (then
        (local.set $status (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 4))
          (i32.or (i32.and (local.get $status) (i32.const 0xFFFEFFFF)) (i32.const 0x20000)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 44)) (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 48)) (call $gl32 (i32.add (local.get $arg1) (i32.const 16))))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 52)) (call $gl32 (i32.add (local.get $arg1) (i32.const 28))))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 56)) (call $gl32 (i32.add (local.get $arg1) (i32.const 32))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; acmStreamUnprepareHeader(has, pash, fdwUnprepare)
  (func $handle_acmStreamUnprepareHeader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $status i32)
    (local.set $result (call $acm_header_check (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (if (i32.eqz (local.get $result))
      (then
        (local.set $status (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
        (if (i32.eqz (i32.and (local.get $status) (i32.const 0x20000)))
          (then (local.set $result (i32.const 514)))        ;; ACMERR_UNPREPARED
          (else
            (call $gs32 (i32.add (local.get $arg1) (i32.const 4))
              (i32.and (local.get $status) (i32.const 0xFFFDFFFF)))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; acmStreamConvert(has, pash, fdwConvert). Decodes every whole block of
  ;; the source that fits the destination, synchronously, and reports what it
  ;; used. BLOCKALIGN (0x4), START (0x10) and END (0x20) are accepted; whole
  ;; blocks are all these codecs ever convert, and each block is independent,
  ;; so none changes the result.
  (func $handle_acmStreamConvert (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $st i32) (local $status i32) (local $align i32) (local $pcm i32)
    (local $blocks i32) (local $room i32) (local $i i32) (local $src i32) (local $dst i32)
    (local $scratch i32) (local $out i32) (local $k i32)
    (local.set $result (call $acm_header_check (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0x34)))
    (if (i32.eqz (local.get $result))
      (then
        (local.set $status (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
        (if (i32.eqz (i32.and (local.get $status) (i32.const 0x20000)))
          (then (local.set $result (i32.const 514))))))     ;; ACMERR_UNPREPARED
    (if (i32.eqz (local.get $result))
      (then
        (local.set $st (call $acm_stream_lookup (local.get $arg0)))
        (local.set $align (call $gl32 (i32.add (local.get $st) (i32.const 16))))
        (local.set $pcm (call $acm_stream_pcm_block_bytes (local.get $st)))
        (local.set $src (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))
        (local.set $dst (call $gl32 (i32.add (local.get $arg1) (i32.const 28))))
        (local.set $blocks (i32.div_u (call $gl32 (i32.add (local.get $arg1) (i32.const 16))) (local.get $align)))
        (local.set $room (i32.div_u (call $gl32 (i32.add (local.get $arg1) (i32.const 32))) (local.get $pcm)))
        (if (i32.lt_u (local.get $room) (local.get $blocks)) (then (local.set $blocks (local.get $room))))
        ;; 8-bit output: each block decodes to 16-bit samples in a scratch
        ;; block, then narrows into the caller's buffer, which is sized for
        ;; 8-bit (acmStreamSize). Unsigned 8-bit PCM is the high byte + 128.
        (if (i32.and (i32.ne (local.get $blocks) (i32.const 0))
                     (i32.ne (call $acm_stream_out8 (local.get $st)) (i32.const 0)))
          (then
            (local.set $scratch (call $heap_alloc (i32.shl (local.get $pcm) (i32.const 1))))
            (if (i32.eqz (local.get $scratch)) (then (local.set $blocks (i32.const 0))))))
        (block $decoded (loop $each
          (br_if $decoded (i32.ge_u (local.get $i) (local.get $blocks)))
          (local.set $out (select (local.get $scratch)
            (i32.add (local.get $dst) (i32.mul (local.get $i) (local.get $pcm)))
            (i32.ne (local.get $scratch) (i32.const 0))))
          (if (i32.eq (i32.and (call $gl32 (i32.add (local.get $st) (i32.const 4))) (i32.const 0xFFFF)) (i32.const 2))
            (then (call $msadpcm_decode_block (local.get $st)
                    (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $align)))
                    (local.get $out)))
            (else (call $imaadpcm_decode_block (local.get $st)
                    (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $align)))
                    (local.get $out))))
          (if (local.get $scratch)
            (then
              (local.set $k (i32.const 0))
              (block $narrowed (loop $narrow
                (br_if $narrowed (i32.ge_u (local.get $k) (local.get $pcm)))
                (call $gs8 (i32.add (i32.add (local.get $dst) (i32.mul (local.get $i) (local.get $pcm))) (local.get $k))
                  (i32.add (i32.shr_s (call $acm_s16 (i32.add (local.get $scratch) (i32.shl (local.get $k) (i32.const 1))))
                                      (i32.const 8))
                           (i32.const 128)))
                (local.set $k (i32.add (local.get $k) (i32.const 1)))
                (br $narrow)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $each)))
        (if (local.get $scratch) (then (call $heap_free (local.get $scratch))))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 20)) (i32.mul (local.get $blocks) (local.get $align)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 36)) (i32.mul (local.get $blocks) (local.get $pcm)))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 4))
          (i32.or (i32.and (local.get $status) (i32.const 0xFFEFFFFF)) (i32.const 0x10000)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; mciGetErrorStringA(fdwError, lpszErrorText, cchErrorText). As in the
  ;; Win16 ordinal 706: no MCI failure here carries a message, so the buffer
  ;; comes back empty and the call reports FALSE, its answer for an unknown code.
  (func $handle_mciGetErrorStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0)) (i32.ne (local.get $arg2) (i32.const 0)))
      (then (call $gs8 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Error descriptions accept MMSYSERR 0..21 and WAVERR 32..35. cch is in
  ;; characters, including the terminator; a zero capacity is a successful no-op.
  (func $wave_error_text (param $code i32) (param $out i32) (param $cch i32)
      (param $wide i32) (result i32)
    (local $wa i32) (local $size i32) (local $result i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 11))))
    (if (i32.eqz (local.get $cch)) (then (return (i32.const 0))))
    (if (i32.and (i32.gt_u (local.get $code) (i32.const 21))
          (i32.gt_u (i32.sub (local.get $code) (i32.const 32)) (i32.const 3)))
      (then (return (i32.const 9))))
    ;; Query the exact written prefix; never gather/write unrelated bytes after
    ;; the terminator when the caller advertises a much larger buffer.
    (local.set $size (call $host_wave_error_text (local.get $code) (i32.const 0) (i32.const 0) (i32.const 2)))
    (if (i32.lt_u (local.get $cch) (local.get $size))
      (then (local.set $size (local.get $cch))))
    (local.set $size (i32.shl (local.get $size) (local.get $wide)))
    (local.set $wa (call $guest_span_in (local.get $out) (local.get $size)))
    (local.set $result (call $host_wave_error_text (local.get $code) (local.get $wa)
      (local.get $cch) (local.get $wide)))
    (call $guest_span_writeback (local.get $out) (local.get $wa) (local.get $size))
    (local.get $result))

  (func $handle_waveOutGetErrorTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $wave_error_text (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )
  (func $handle_waveOutGetErrorTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $wave_error_text (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Store only the bytes present in the caller-sized capability prefix.
  (func $wave_caps_byte (param $wa i32) (param $size i32) (param $offset i32) (param $value i32)
    (if (i32.lt_u (local.get $offset) (local.get $size))
      (then (i32.store8 (i32.add (local.get $wa) (local.get $offset)) (local.get $value)))))

  ;; WAVE{IN,OUT}CAPS share the header, name, formats and channels. Build only
  ;; min(cb, sizeof(caps)) bytes; short and zero-length queries are valid.
  ;; One bounded span handles sparse backing without a second guest owner.
  (func $wave_dev_caps_fill (param $caps_g i32) (param $cb i32)
      (param $wide i32) (param $capture i32) (result i32)
    (local $wa i32) (local $size i32) (local $stride i32) (local $tail i32)
    (if (i32.eqz (local.get $cb)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $caps_g)) (then (return (i32.const 11))))
    (local.set $tail (select (i32.const 72) (i32.const 40) (local.get $wide)))
    (local.set $size (i32.add (local.get $tail)
      (select (i32.const 8) (i32.const 12) (local.get $capture))))
    (if (i32.lt_u (local.get $cb) (local.get $size))
      (then (local.set $size (local.get $cb))))
    (local.set $wa (call $guest_span_in (local.get $caps_g) (local.get $size)))
    (call $zero_memory (local.get $wa) (local.get $size))
    (call $wave_caps_byte (local.get $wa) (local.get $size) (i32.const 0) (i32.const 1)) ;; wMid
    (call $wave_caps_byte (local.get $wa) (local.get $size) (i32.const 2) (i32.const 1)) ;; wPid
    (call $wave_caps_byte (local.get $wa) (local.get $size) (i32.const 5) (i32.const 4)) ;; v4.00
    (local.set $stride (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (if (local.get $capture)
      (then ;; Microphone
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 0))) (i32.const 77))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 1))) (i32.const 105))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 2))) (i32.const 99))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 3))) (i32.const 114))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 4))) (i32.const 111))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 5))) (i32.const 112))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 6))) (i32.const 104))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 7))) (i32.const 111))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 8))) (i32.const 110))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 9))) (i32.const 101))
      )
      (else ;; Audio
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 0))) (i32.const 65))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 1))) (i32.const 117))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 2))) (i32.const 100))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 3))) (i32.const 105))
        (call $wave_caps_byte (local.get $wa) (local.get $size)
          (i32.add (i32.const 8) (i32.mul (local.get $stride) (i32.const 4))) (i32.const 111))
      ))
    (call $wave_caps_byte (local.get $wa) (local.get $size) (local.get $tail) (i32.const 255)) ;; dwFormats
    (call $wave_caps_byte (local.get $wa) (local.get $size)
      (i32.add (local.get $tail) (i32.const 1)) (i32.const 15))
    (call $wave_caps_byte (local.get $wa) (local.get $size)
      (i32.add (local.get $tail) (i32.const 4)) (i32.const 2)) ;; stereo
    (if (i32.eqz (local.get $capture)) (then
      (call $wave_caps_byte (local.get $wa) (local.get $size)
        (i32.add (local.get $tail) (i32.const 8)) (i32.const 12)))) ;; VOLUME|LRVOLUME
    (call $guest_span_writeback (local.get $caps_g) (local.get $wa) (local.get $size))
    (i32.const 0))
  (func $handle_waveOutGetDevCapsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wave_dev_caps_fill
      (local.get $arg1) (local.get $arg2) (i32.const 0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args stdcall
  )

  ;; waveOutGetDevCapsW(uDeviceID, lpCaps, cbCaps) — wide-char variant
  (func $handle_waveOutGetDevCapsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wave_dev_caps_fill
      (local.get $arg1) (local.get $arg2) (i32.const 1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; waveOutGetID(hwo, puDeviceID) — this runtime exposes one waveOut device.
  ;; The current handle lives in shared memory because a worker-owned Miles
  ;; callback can query the handle opened by the main instance.
  (func $handle_waveOutGetID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 11)) ;; MMSYSERR_INVALPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.or (i32.eqz (local.get $arg0))
                (i32.ne (local.get $arg0) (i32.load (region.addr $WAVE_OUT_SHARED 0))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 5)) ;; MMSYSERR_INVALHANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $gs32 (local.get $arg1) (i32.const 0)) ;; sole device ID
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; MMSYSERR_NOERROR
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 795: waveOutOpen(phwo, uDeviceID, lpFormat, dwCallback, dwInstance, fdwOpen)
  ;; WAVEFORMATEX: +0 wFormatTag(2), +2 nChannels(2), +4 nSamplesPerSec(4),
  ;;   +8 nAvgBytesPerSec(4), +12 nBlockAlign(2), +14 wBitsPerSample(2)
  (func $handle_waveOutOpen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $fmt_wa i32) (local $rate i32) (local $ch i32) (local $bits i32)
    (local $handle i32) (local $fdwOpen i32) (local $cbType i32)
    ;; arg0=phwo, arg1=uDeviceID, arg2=lpFormat, arg3=dwCallback, arg4=dwInstance
    ;; fdwOpen is 6th arg at [esp+24]
    (local.set $fdwOpen (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    ;; Read WAVEFORMATEX
    (local.set $fmt_wa (call $g2w (local.get $arg2)))
    (local.set $rate (i32.load (i32.add (local.get $fmt_wa) (i32.const 4))))
    (local.set $ch (i32.load16_u (i32.add (local.get $fmt_wa) (i32.const 2))))
    (local.set $bits (i32.load16_u (i32.add (local.get $fmt_wa) (i32.const 14))))
    ;; Callback type from fdwOpen bits 16-18:
    ;; 0=none, 1=window, 2=thread, 3=function, 5=event
    (local.set $cbType (i32.and (i32.shr_u (local.get $fdwOpen) (i32.const 16)) (i32.const 7)))
    ;; If WAVE_FORMAT_QUERY (0x01), just check support, don't open
    (if (i32.and (local.get $fdwOpen) (i32.const 1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    ;; Open via host
    (local.set $handle (call $host_wave_out_open
      (local.get $rate) (local.get $ch) (local.get $bits) (local.get $cbType)
      (local.get $arg3) (local.get $arg4)))
    ;; Store callback info in WAVE_OUT_SHARED (cross-thread accessible)
    ;; +0: handle, +4: callback, +8: instance, +12: cb_type
    (global.set $wave_out_handle (local.get $handle))
    (i32.store (region.addr $WAVE_OUT_SHARED 0) (local.get $handle))
    (i32.store (region.addr $WAVE_OUT_SHARED 4) (local.get $arg3))
    (i32.store (region.addr $WAVE_OUT_SHARED 8) (local.get $arg4))
    (i32.store (region.addr $WAVE_OUT_SHARED 12) (local.get $cbType))
    ;; If phwo != NULL, store handle
    (if (local.get $arg0)
      (then (call $gs32 (local.get $arg0) (local.get $handle))))
    (if (i32.eq (local.get $cbType) (i32.const 1))
      (then
        ;; CALLBACK_WINDOW: MM_WOM_OPEN(hwnd, hwo, 0)
        (drop (call $post_queue_push
          (local.get $arg3)
          (i32.const 0x03BB)
          (local.get $handle)
          (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; MMSYSERR_NOERROR
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; 6 args stdcall
  )

  ;; 796: waveOutClose(hwo) — 1 arg stdcall
  (func $handle_waveOutClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (local.set $result (call $host_wave_out_close (local.get $arg0)))
    (if (local.get $result)
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $result))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Flush deferred WHDR_DONE slot
    (i32.store (i32.const 0xAD98) (i32.const 0))
    (if (i32.eq (i32.load (region.addr $WAVE_OUT_SHARED 12)) (i32.const 1))
      (then
        ;; CALLBACK_WINDOW: MM_WOM_CLOSE(hwnd, hwo, 0)
        (drop (call $post_queue_push
          (i32.load (region.addr $WAVE_OUT_SHARED 4))
          (i32.const 0x03BC)
          (local.get $arg0)
          (i32.const 0)))))
    (global.set $wave_out_handle (i32.const 0))
    ;; Invalidate the cross-instance handle too.  waveOutGetID may execute in
    ;; a native Miles worker whose own mutable global is not the opener's.
    (i32.store (region.addr $WAVE_OUT_SHARED 0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 797: waveOutPrepareHeader — return MMSYSERR_NOERROR, set WHDR_PREPARED flag
  (func $handle_waveOutPrepareHeader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Set dwFlags |= WHDR_PREPARED (0x02) in WAVEHDR at arg1+16
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (i32.store (i32.add (local.get $wa) (i32.const 16))
      (i32.or (i32.load (i32.add (local.get $wa) (i32.const 16))) (i32.const 2)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 798: waveOutUnprepareHeader — return MMSYSERR_NOERROR, clear WHDR_PREPARED/INQUEUE and mark DONE
  (func $handle_waveOutUnprepareHeader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (i32.store (i32.add (local.get $wa) (i32.const 16))
      (i32.and
        (i32.or
          (i32.and (i32.load (i32.add (local.get $wa) (i32.const 16))) (i32.const 0xFFFFFFFD))
          (i32.const 1))
        (i32.const 0xFFFFFFEF)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 799: waveOutWrite(hwo, lpWaveHdr, cbWaveHdr) — 3 args stdcall
  ;; WAVEHDR: +0 lpData(4), +4 dwBufferLength(4), +8 dwBytesRecorded(4),
  ;;   +12 dwUser(4), +16 dwFlags(4), +20 dwLoops(4), +24 lpNext(4), +28 reserved(4)
  ;;
  ;; Async WHDR_DONE: real Windows marks WHDR_DONE only after the buffer
  ;; finishes playing. The host schedules that completion against the audio
  ;; clock; 0xAD98 keeps the last WAVEHDR available for Reset/Close flushes.
  (func $handle_waveOutWrite (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $data_ga i32) (local $data_len i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    ;; Read lpData and dwBufferLength from WAVEHDR
    (local.set $data_ga (i32.load (local.get $wa)))
    (local.set $data_len (i32.load (i32.add (local.get $wa) (i32.const 4))))
    ;; Send PCM data to host for playback. Use logical-and (coerce both to 0/1)
    ;; — bare i32.and is BITWISE and silently drops calls where data_ga and
    ;; data_len happen not to share any 1-bits (e.g. lpData=0x78521c & len=0x2d00 = 0).
    (if (i32.and (i32.ne (local.get $data_ga) (i32.const 0))
                 (i32.ne (local.get $data_len) (i32.const 0)))
      (then
        ;; Submitted buffers are no longer DONE and remain INQUEUE until the
        ;; scheduled audio-clock completion fires.
        (i32.store (i32.add (local.get $wa) (i32.const 16))
          (i32.or
            (i32.and (i32.load (i32.add (local.get $wa) (i32.const 16))) (i32.const 0xFFFFFFFE))
            (i32.const 0x10)))
        (drop (call $host_wave_out_write
          (local.get $arg0)
          (call $g2w (local.get $data_ga))
          (local.get $data_len)))
        (drop (call $host_wave_out_schedule_done
          (local.get $arg0)
          (local.get $wa)
          (local.get $arg1)
          (local.get $data_len)))))
    ;; Save this buffer's guest address so Reset/Close can flush if needed.
    (i32.store (i32.const 0xAD98) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 800: waveOutReset — cancel queued host playback, flush WHDR_DONE, return MMSYSERR_NOERROR
  (func $handle_waveOutReset (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (local.set $result (call $host_wave_out_reset (local.get $arg0)))
    (if (local.get $result)
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $result))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (i32.store (i32.const 0xAD98) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; waveOutPause freezes queued playback, its byte cursor and WOM_DONE timing.
  (func $handle_waveOutPause (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_wave_out_pause (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; waveOutRestart resumes the unplayed tail of every queued buffer.
  (func $handle_waveOutRestart (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_wave_out_restart (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 840: waveOutGetVolume(hwo, lpdwVolume) — 2 args stdcall
  ;; dwVolume: low word = left channel, high word = right channel (0x0000–0xFFFF)
  (func $handle_waveOutGetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (global.get $wave_out_volume))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 841: waveOutSetVolume(hwo, dwVolume) — 2 args stdcall
  (func $handle_waveOutSetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $wave_out_volume (local.get $arg1))
    ;; Pass max of left/right channel to host (0–65535)
    (call $host_wave_out_set_volume (local.get $arg0)
      (if (result i32) (i32.gt_u
        (i32.and (local.get $arg1) (i32.const 0xFFFF))
        (i32.shr_u (local.get $arg1) (i32.const 16)))
        (then (i32.and (local.get $arg1) (i32.const 0xFFFF)))
        (else (i32.shr_u (local.get $arg1) (i32.const 16)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 803: waveOutGetPosition(hwo, lpInfo, cbInfo) — fill MMTIME struct
  (func $handle_waveOutGetPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    ;; MMTIME.wType = TIME_BYTES (4), u.cb = bytes played
    (i32.store (local.get $wa) (i32.const 4))
    (i32.store (i32.add (local.get $wa) (i32.const 4))
      (call $host_wave_out_get_pos (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 804: mmioOpenA(lpszFileName, lpmmioinfo, dwOpenFlags) — 3 args stdcall
  ;; Opens a file for RIFF I/O. Returns HMMIO (file handle) or 0 on failure.
  ;; dwOpenFlags: MMIO_READ=0x0000, MMIO_WRITE=0x0001, MMIO_CREATE=0x1000,
  ;;              MMIO_ALLOCBUF=0x10000, MMIO_DELETE=0x0200
  (func $handle_mmioOpenA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local $creation i32)
    (local $access i32)
    ;; arg0 = filename (guest ptr to string)
    ;; arg1 = lpmmioinfo (can be NULL)
    ;; arg2 = dwOpenFlags
    ;; Determine creation disposition from flags
    ;; MMIO_CREATE (0x1000) → CREATE_ALWAYS (2), else OPEN_EXISTING (3)
    ;; A memory file never touches the filesystem: lpmmioinfo names FOURCC_MEM
    ;; with no custom IOProc, and the buffer it describes is the file.
    ;; SimGolf's sound.dll streams into a 128 KB one; opened as a path instead,
    ;; mmioGetInfo bound it an 8 KB default and the stream overran that by
    ;; 120 KB into textures and the GL command buffer.
    (if (i32.ne (local.get $arg1) (i32.const 0))
      (then
        (if (i32.and
              (i32.eq (call $gl32 (i32.add (local.get $arg1) (i32.const 4))) (i32.const 0x204D454D))
              (i32.eqz (call $gl32 (i32.add (local.get $arg1) (i32.const 8)))))
          (then
            (i32.store offset=0 (global.get $reg_base)
              (call $mmio_open_mem (local.get $arg1) (local.get $arg2) (local.get $name_ptr)))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))))
    (local.set $creation (i32.const 3))  ;; OPEN_EXISTING
    (if (i32.and (local.get $arg2) (i32.const 0x1000))
      (then (local.set $creation (i32.const 2))))  ;; CREATE_ALWAYS
    (local.set $access (i32.const 0x80000000)) ;; MMIO_READ
    (if (i32.eq (i32.and (local.get $arg2) (i32.const 3)) (i32.const 1))
      (then (local.set $access (i32.const 0x40000000)))) ;; MMIO_WRITE
    (if (i32.or (i32.eq (i32.and (local.get $arg2) (i32.const 3)) (i32.const 2))
                (i32.eq (local.get $creation) (i32.const 2)))
      (then (local.set $access (i32.const 0xc0000000)))) ;; READWRITE / CREATE
    ;; Open via host filesystem
    (local.set $handle (call $host_fs_create_file
      (call $g2w (local.get $arg0))  ;; pathWA
      (local.get $access)
      (local.get $creation)
      (i32.const 0x80)                ;; FILE_ATTRIBUTE_NORMAL
      (i32.const 0)))                 ;; isWide=0
    ;; If lpmmioinfo is non-NULL, report the result in wErrorRet (+12).
    (if (local.get $arg1)
      (then
        (call $gs32 (i32.add (local.get $arg1) (i32.const 12))
          (select (i32.const 0) (i32.const 257) (i32.ne (local.get $handle) (i32.const 0)))))) ;; MMIOERR_FILENOTFOUND
    (i32.store offset=0 (global.get $reg_base) (local.get $handle))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 805: mmioClose(hmmio, wFlags) — 2 args stdcall
  (func $handle_mmioClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $mmio_mem_slot (local.get $arg0))
      (then (call $mmio_buf_release (local.get $arg0)))
      (else
        (call $mmio_buf_release (local.get $arg0))
        (drop (call $host_fs_close_handle (local.get $arg0)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; mmioStringToFOURCCA(sz, uFlags) — pack four bytes, padding with spaces.
  ;; MMIO_TOUPPER (0x10) applies ASCII case folding before packing.
  (func $handle_mmioStringToFOURCCA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src i32) (local $i i32) (local $ch i32)
    (local $fourcc i32) (local $ended i32)
    (if (local.get $arg0)
      (then (local.set $src (call $g2w (local.get $arg0))))
      (else (local.set $ended (i32.const 1))))
    (block $done
      (loop $pack
        (br_if $done (i32.ge_u (local.get $i) (i32.const 4)))
        (local.set $ch (i32.const 0x20))
        (if (i32.eqz (local.get $ended))
          (then
            (local.set $ch (i32.load8_u
              (i32.add (local.get $src) (local.get $i))))
            (if (i32.eqz (local.get $ch))
              (then
                (local.set $ended (i32.const 1))
                (local.set $ch (i32.const 0x20)))
              (else
                (if (i32.and
                      (i32.ne (i32.and (local.get $arg1) (i32.const 0x10))
                              (i32.const 0))
                      (i32.and
                        (i32.ge_u (local.get $ch) (i32.const 0x61))
                        (i32.le_u (local.get $ch) (i32.const 0x7A))))
                  (then
                    (local.set $ch
                      (i32.sub (local.get $ch) (i32.const 0x20)))))))))
        (local.set $fourcc
          (i32.or (local.get $fourcc)
            (i32.shl (local.get $ch)
              (i32.mul (local.get $i) (i32.const 8)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $pack)))
    (i32.store offset=0 (global.get $reg_base) (local.get $fourcc))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 806: mmioDescend(hmmio, lpck, lpckParent, wFlags) — 4 args stdcall
  ;; Descends into a RIFF chunk. Reads 8-byte chunk header (ckid + cksize).
  ;; MMCKINFO struct: +0 ckid, +4 cksize, +8 fccType, +12 dwDataOffset, +16 dwFlags
  ;; wFlags: MMIO_FINDCHUNK=0x10, MMIO_FINDRIFF=0x20, MMIO_FINDLIST=0x40
  (func $handle_mmioDescend (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ck_wa i32) (local $pos i32) (local $ckid i32) (local $cksize i32)
    (local $search_id i32) (local $search_type i32) (local $fcc_type i32)
    (local $end_pos i32) (local $bytes_read_ga i32) (local $bytes_read_wa i32)
    (local $data_offset i32) (local $parent_wa i32)
    (local $start_pos i32) (local $saved_id i32) (local $saved_type i32) (local $ok i32)
    ;; A memory file (FOURCC_MEM) walks its own buffer; the RIFF parsing below
    ;; reads through the host filesystem.
    (if (call $mmio_mem_slot (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base)
          (call $mmio_mem_descend (call $mmio_mem_slot (local.get $arg0))
            (local.get $arg1) (local.get $arg2) (local.get $arg3)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $ck_wa (call $g2w (local.get $arg1)))
    ;; arg3 = wFlags (passed as 5th stack arg), read from [esp+24] in caller
    ;; Actually arg3 = wFlags since dispatcher reads 5 args
    ;; Save search criteria if FIND flags are set
    (if (local.get $arg3)
      (then
        ;; For FINDCHUNK/FINDRIFF/FINDLIST, save the target ckid/fccType
        (local.set $search_id (i32.load (local.get $ck_wa)))       ;; ckid to find
        (local.set $search_type (i32.load (i32.add (local.get $ck_wa) (i32.const 8)))) ;; fccType to find
      ))
    ;; Determine end position from parent chunk (if present)
    (local.set $end_pos (i32.const 0x7FFFFFFF))  ;; no limit if no parent
    (if (local.get $arg2)
      (then
        (local.set $parent_wa (call $g2w (local.get $arg2)))
        (local.set $end_pos (i32.add
          (i32.load offset=12 (local.get $parent_wa))  ;; parent dwDataOffset
          (i32.load offset=4 (local.get $parent_wa))))))  ;; + parent cksize
    ;; A streamed (lazy) file whose header bytes are not resident parks the
    ;; call and reruns it once the host has them (Little Fighter 2 reported
    ;; "Could not Descend into Wave File"). The search moves the file pointer
    ;; and writes into lpck as it goes, so the rerun must start from exactly
    ;; what the caller handed us: remember both, restore both before parking.
    (local.set $start_pos (call $host_fs_set_file_pointer (local.get $arg0) (i32.const 0) (i32.const 1)))
    (local.set $saved_id (i32.load (local.get $ck_wa)))
    (local.set $saved_type (i32.load (i32.add (local.get $ck_wa) (i32.const 8))))
    ;; Scratch area for bytesRead on stack
    (local.set $bytes_read_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (local.set $bytes_read_wa (call $g2w (local.get $bytes_read_ga)))
    ;; Search loop: read chunk headers until we find the target or EOF
    (block $done
      (loop $search
        ;; Get current file position
        (local.set $pos (call $host_fs_set_file_pointer (local.get $arg0) (i32.const 0) (i32.const 1)))
        ;; Check if past end of parent chunk
        (br_if $done (i32.ge_u (local.get $pos) (local.get $end_pos)))
        ;; Read 8 bytes: ckid (4) + cksize (4) into the MMCKINFO struct
        (i32.store (local.get $bytes_read_wa) (i32.const 0))
        (local.set $ok (call $host_fs_read_file
          (local.get $arg0)
          (local.get $arg1)  ;; write directly into MMCKINFO (guest addr)
          (i32.const 8)
          (local.get $bytes_read_ga)))
        (if (i32.eqz (local.get $ok))
          (then
            (if (i32.eq (call $host_fs_read_pending) (i32.const 1))
              (then
                (drop (call $host_fs_set_file_pointer (local.get $arg0) (local.get $start_pos) (i32.const 0)))
                (i32.store (local.get $ck_wa) (local.get $saved_id))
                (i32.store offset=8 (local.get $ck_wa) (local.get $saved_type))
                (call $io_block (i32.const 0))
                (return)))))
        ;; Check if we read 8 bytes
        (br_if $done (i32.lt_u (i32.load (local.get $bytes_read_wa)) (i32.const 8)))
        (local.set $ckid (i32.load (local.get $ck_wa)))
        (local.set $cksize (i32.load (i32.add (local.get $ck_wa) (i32.const 4))))
        ;; For RIFF and LIST chunks, read 4 more bytes for fccType.
        ;; dwDataOffset is always the byte after cksize (pos+8) — for a RIFF/LIST
        ;; chunk the data area *starts with* the form type, so it is not skipped
        ;; here even though the file pointer is left past it. Apps rely on both
        ;; halves of that: the MSDN idiom seeks to `dwDataOffset + sizeof(FOURCC)`
        ;; to reach the first subchunk, and mmioAscend adds cksize (which counts
        ;; the form type) to dwDataOffset to find the chunk end.
        (local.set $fcc_type (i32.const 0))
        (local.set $data_offset (i32.add (local.get $pos) (i32.const 8)))
        (if (i32.or
              (i32.eq (local.get $ckid) (i32.const 0x46464952))  ;; "RIFF"
              (i32.eq (local.get $ckid) (i32.const 0x5453494C))) ;; "LIST"
          (then
            ;; Read fccType (4 bytes) into MMCKINFO+8
            (i32.store (local.get $bytes_read_wa) (i32.const 0))
            (local.set $ok (call $host_fs_read_file
              (local.get $arg0)
              (i32.add (local.get $arg1) (i32.const 8))  ;; fccType field (guest addr)
              (i32.const 4)
              (local.get $bytes_read_ga)))
            (if (i32.eqz (local.get $ok))
              (then
                (if (i32.eq (call $host_fs_read_pending) (i32.const 1))
                  (then
                    (drop (call $host_fs_set_file_pointer (local.get $arg0) (local.get $start_pos) (i32.const 0)))
                    (i32.store (local.get $ck_wa) (local.get $saved_id))
                    (i32.store offset=8 (local.get $ck_wa) (local.get $saved_type))
                    (call $io_block (i32.const 0))
                    (return)))))
            (local.set $fcc_type (i32.load (i32.add (local.get $ck_wa) (i32.const 8))))
          ))
        ;; Store dwDataOffset
        (i32.store (i32.add (local.get $ck_wa) (i32.const 12)) (local.get $data_offset))
        ;; Store dwFlags = 0
        (i32.store (i32.add (local.get $ck_wa) (i32.const 16)) (i32.const 0))
        ;; If no FIND flags, accept first chunk
        (if (i32.eqz (local.get $arg3))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; MMSYSERR_NOERROR
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        ;; MMIO_FINDRIFF (0x20): match fccType
        (if (i32.and (local.get $arg3) (i32.const 0x20))
          (then
            (if (i32.and
                  (i32.eq (local.get $ckid) (i32.const 0x46464952))  ;; "RIFF"
                  (i32.eq (local.get $fcc_type) (local.get $search_type)))
              (then
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
                (return)))))
        ;; MMIO_FINDLIST (0x40): match fccType in LIST
        (if (i32.and (local.get $arg3) (i32.const 0x40))
          (then
            (if (i32.and
                  (i32.eq (local.get $ckid) (i32.const 0x5453494C))  ;; "LIST"
                  (i32.eq (local.get $fcc_type) (local.get $search_type)))
              (then
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
                (return)))))
        ;; MMIO_FINDCHUNK (0x10): match ckid
        (if (i32.and (local.get $arg3) (i32.const 0x10))
          (then
            (if (i32.eq (local.get $ckid) (local.get $search_id))
              (then
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
                (return)))))
        ;; Not found — skip this chunk's data and try next
        ;; Seek past cksize bytes (word-aligned)
        (drop (call $host_fs_set_file_pointer
          (local.get $arg0)
          (i32.add (local.get $pos) (i32.add (i32.const 8)
            (i32.and (i32.add (local.get $cksize) (i32.const 1)) (i32.const 0xFFFFFFFE))))
          (i32.const 0)))  ;; SEEK_SET
        (br $search)
      )
    )
    ;; Not found
    (i32.store offset=0 (global.get $reg_base) (i32.const 514))  ;; MMIOERR_CHUNKNOTFOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 807: mmioRead(hmmio, pch, cch) — 3 args stdcall
  ;; Its signed-count and return contracts match _hread: EOF is zero, a read
  ;; failure is -1, and provider-backed reads park rather than inventing EOF.
  (func $handle_mmioRead (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $n i32) (local $pos i32)
    (local.set $slot (call $mmio_mem_slot (local.get $arg0)))
    (if (local.get $slot)
      (then
        (local.set $pos (i32.load offset=20 (local.get $slot)))
        (local.set $n (i32.sub (i32.load offset=24 (local.get $slot)) (local.get $pos)))
        (if (i32.lt_s (local.get $arg2) (i32.const 0))
          (then (local.set $n (i32.const -1)))
          (else
            (if (i32.lt_u (local.get $arg2) (local.get $n)) (then (local.set $n (local.get $arg2))))
            (call $guest_memmove (local.get $arg1)
              (i32.add (i32.load offset=4 (local.get $slot)) (local.get $pos)) (local.get $n))
            (i32.store offset=20 (local.get $slot) (i32.add (local.get $pos) (local.get $n)))))
        (i32.store offset=0 (global.get $reg_base) (local.get $n))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $handle__hread
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; mmioWrite(hmmio, pch, cch): fixed memory files accept only the bytes
  ;; remaining in their buffer. Commit position/length only after the copy;
  ;; preflight both guest ranges so a bad tail cannot leave a partial write.
  ;; File handles use the same synchronous host writer as _hwrite.
  (func $handle_mmioWrite (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $pos i32) (local $n i32) (local $dst i32)
    (local $result i32)
    (local.set $result (i32.const -1))
    (block $done
      (br_if $done (i32.lt_s (local.get $arg2) (i32.const 0)))
      (local.set $slot (call $mmio_mem_slot (local.get $arg0)))
      (if (i32.eqz (local.get $slot))
        (then
          (br_if $done (call $ptr_range_access_bad (local.get $arg1) (local.get $arg2) (i32.const 0)))
          ;; Validate even zero-length writes without passing a zero count to
          ;; _hwrite, whose legacy contract may truncate a disk file.
          (br_if $done (i32.eq (call $host_fs_set_file_pointer
            (local.get $arg0) (i32.const 0) (i32.const 1)) (i32.const -1)))
          (if (i32.eqz (local.get $arg2))
            (then (local.set $result (i32.const 0)) (br $done)))
          (call $handle__hwrite (local.get $arg0) (local.get $arg1) (local.get $arg2)
            (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
          (return)))
      (br_if $done (i32.eqz (i32.and (i32.load offset=28 (local.get $slot)) (i32.const 3))))
      (local.set $pos (i32.load offset=20 (local.get $slot)))
      (br_if $done (i32.gt_u (local.get $pos) (i32.load offset=8 (local.get $slot))))
      (local.set $n (i32.sub (i32.load offset=8 (local.get $slot)) (local.get $pos)))
      (if (i32.lt_u (local.get $arg2) (local.get $n)) (then (local.set $n (local.get $arg2))))
      (local.set $result (i32.const 0))
      (br_if $done (i32.eqz (local.get $n)))
      (local.set $result (i32.const -1))
      (local.set $dst (i32.add (i32.load offset=4 (local.get $slot)) (local.get $pos)))
      (br_if $done (i32.lt_u (local.get $dst) (i32.load offset=4 (local.get $slot))))
      (br_if $done (call $ptr_range_access_bad (local.get $arg1) (local.get $n) (i32.const 0)))
      (br_if $done (call $ptr_range_access_bad (local.get $dst) (local.get $n) (i32.const 1)))
      (call $guest_memmove (local.get $dst) (local.get $arg1) (local.get $n))
      (local.set $pos (i32.add (local.get $pos) (local.get $n)))
      (i32.store offset=20 (local.get $slot) (local.get $pos))
      (if (i32.gt_u (local.get $pos) (i32.load offset=24 (local.get $slot)))
        (then (i32.store offset=24 (local.get $slot) (local.get $pos))))
      ;; The memory buffer is the backing store: data is already committed,
      ;; matching mmioGetInfo's existing clear-DIRTY memory-file contract.
      (local.set $result (local.get $n)))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 808: mmioAscend(hmmio, lpck, wFlags) — 3 args stdcall
  ;; Ascends out of a chunk — seeks past remaining chunk data
  (func $handle_mmioAscend (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ck_wa i32) (local $end_pos i32) (local $slot i32) (local $cksize i32)
    ;; A memory file ascends by moving its buffer position to the same end.
    (local.set $slot (call $mmio_mem_slot (local.get $arg0)))
    (if (local.get $slot)
      (then
        (local.set $cksize (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
        (i32.store offset=20 (local.get $slot)
          (i32.add (i32.add (call $gl32 (i32.add (local.get $arg1) (i32.const 12)))
                            (local.get $cksize))
                   (i32.and (local.get $cksize) (i32.const 1))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $ck_wa (call $g2w (local.get $arg1)))
    ;; End of chunk = dwDataOffset + cksize, plus the pad byte when cksize is
    ;; odd. The padding is relative to the chunk, not the file: Daytona USA
    ;; Deluxe packs WAVE files back to back at odd offsets, and aligning the
    ;; absolute position landed one byte past 'fmt ' so 'data' was never found.
    (local.set $end_pos
      (i32.add
        (i32.add
          (i32.load (i32.add (local.get $ck_wa) (i32.const 12)))  ;; dwDataOffset
          (i32.load (i32.add (local.get $ck_wa) (i32.const 4))))  ;; cksize
        (i32.and (i32.load (i32.add (local.get $ck_wa) (i32.const 4))) (i32.const 1))))
    (drop (call $host_fs_set_file_pointer (local.get $arg0) (local.get $end_pos) (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; mmioSeek(hmmio, lOffset, iOrigin) — 3 args stdcall. A file handle has
  ;; _llseek's offset/origin/result contract; a memory file seeks inside its
  ;; buffer and cannot move past its end (-1, as a failed seek).
  (func $handle_mmioSeek (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $pos i32)
    (local.set $slot (call $mmio_mem_slot (local.get $arg0)))
    (if (i32.eqz (local.get $slot))
      (then
        (call $handle__llseek (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (return)))
    (local.set $pos (local.get $arg1))
    (if (i32.eq (local.get $arg2) (i32.const 1))                     ;; SEEK_CUR
      (then (local.set $pos (i32.add (local.get $pos) (i32.load offset=20 (local.get $slot))))))
    (if (i32.eq (local.get $arg2) (i32.const 2))                     ;; SEEK_END
      (then (local.set $pos (i32.add (local.get $pos) (i32.load offset=24 (local.get $slot))))))
    (if (i32.or (i32.gt_u (local.get $arg2) (i32.const 2))
                (i32.gt_u (local.get $pos) (i32.load offset=8 (local.get $slot))))
      (then (local.set $pos (i32.const -1)))
      (else (i32.store offset=20 (local.get $slot) (local.get $pos))))
    (i32.store offset=0 (global.get $reg_base) (local.get $pos))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; --- MMIO buffered I/O ------------------------------------------------
  ;; MMIOINFO: +0 dwFlags, +4 fccIOProc, +8 pIOProc, +12 wErrorRet, +16 htask,
  ;;   +20 cchBuffer, +24 pchBuffer, +28 pchNext, +32 pchEndRead,
  ;;   +36 pchEndWrite, +40 lBufOffset, +44 lDiskOffset, +48 adwInfo[3],
  ;;   +60 dwReserved1, +64 dwReserved2, +68 hmmio.
  ;; The app reads straight out of pchBuffer and calls mmioAdvance to refill,
  ;; so the buffer must be a real guest block that stays put for the life of
  ;; the handle. $mmio_buf_for binds a default 8KB block per HMMIO unless
  ;; mmioSetBuffer has selected a caller-owned or differently-sized buffer.
  ;; Slot layout (32 bytes, wasm addresses in the shared region):
  ;;   +0 hmmio, +4 buffer (guest), +8 buffer size, +12 owned (we allocated it),
  ;;   +16 kind (1 = memory file), +20 memory-file position,
  ;;   +24 memory-file data length, +28 open flags.
  (func $mmio_slot_addr (param $slot i32) (result i32)
    (i32.add (global.get $MMIO_BUF_TABLE)
      (i32.mul (local.get $slot) (global.get $MMIO_SLOT_BYTES))))

  ;; Returns the slot for $h, optionally allocating a new binding.
  (func $mmio_slot_for (param $h i32) (param $create i32) (result i32)
    (local $i i32) (local $addr i32) (local $free i32)
    (if (i32.eqz (local.get $h)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MMIO_BUF_SLOTS)))
      (local.set $addr (call $mmio_slot_addr (local.get $i)))
      (if (i32.eq (i32.load (local.get $addr)) (local.get $h))
        (then (return (local.get $addr))))
      (if (i32.and (i32.eqz (local.get $free)) (i32.eqz (i32.load (local.get $addr))))
        (then (local.set $free (local.get $addr))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.and (i32.ne (local.get $create) (i32.const 0))
                 (i32.ne (local.get $free) (i32.const 0)))
      (then
        (i32.store (local.get $free) (local.get $h))
        (return (local.get $free))))
    (i32.const 0))

  ;; The slot of an open memory file (mmioOpen with fccIOProc FOURCC_MEM), or 0.
  (func $mmio_mem_slot (param $h i32) (result i32)
    (local $addr i32)
    (local.set $addr (call $mmio_slot_for (local.get $h) (i32.const 0)))
    (if (result i32)
        (i32.and (i32.ne (local.get $addr) (i32.const 0))
                 (i32.eq (i32.load offset=16 (local.get $addr)) (i32.const 1)))
      (then (local.get $addr))
      (else (i32.const 0))))

  ;; mmioDescend over a memory file: the same walk as the file-backed handler,
  ;; reading chunk headers out of the guest buffer at the slot's position.
  ;; QBob loads its sounds this way and stopped at "New Game" on the old crash.
  ;; dwDataOffset is pos+8 for every chunk (RIFF/LIST data starts with the form
  ;; type), the position is left after the header (+4 for RIFF/LIST), and a
  ;; non-matching chunk is skipped word-aligned. Returns the MMRESULT.
  (func $mmio_mem_descend (param $slot i32) (param $ck i32) (param $parent i32)
      (param $flags i32) (result i32)
    (local $buf i32) (local $end i32) (local $pos i32) (local $ckid i32)
    (local $cksize i32) (local $fcc i32) (local $next i32) (local $form i32)
    (local $search_id i32) (local $search_type i32)
    (local.set $buf (i32.load offset=4 (local.get $slot)))
    (local.set $end (i32.load offset=24 (local.get $slot)))
    (local.set $search_id (call $gl32 (local.get $ck)))
    (local.set $search_type (call $gl32 (i32.add (local.get $ck) (i32.const 8))))
    (if (local.get $parent)
      (then
        (local.set $pos (i32.add (call $gl32 (i32.add (local.get $parent) (i32.const 12)))
                                 (call $gl32 (i32.add (local.get $parent) (i32.const 4)))))
        (if (i32.lt_u (local.get $pos) (local.get $end))
          (then (local.set $end (local.get $pos))))))
    (block $missing (loop $search
      (local.set $pos (i32.load offset=20 (local.get $slot)))
      (br_if $missing (i32.gt_u (i32.add (local.get $pos) (i32.const 8)) (local.get $end)))
      (local.set $ckid (call $gl32 (i32.add (local.get $buf) (local.get $pos))))
      (local.set $cksize (call $gl32 (i32.add (local.get $buf) (i32.add (local.get $pos) (i32.const 4)))))
      (local.set $next (i32.add (local.get $pos) (i32.const 8)))
      (local.set $form (i32.or (i32.eq (local.get $ckid) (i32.const 0x46464952))   ;; "RIFF"
                               (i32.eq (local.get $ckid) (i32.const 0x5453494C)))) ;; "LIST"
      (local.set $fcc (i32.const 0))
      (if (local.get $form)
        (then
          (br_if $missing (i32.gt_u (i32.add (local.get $next) (i32.const 4)) (local.get $end)))
          (local.set $fcc (call $gl32 (i32.add (local.get $buf) (local.get $next))))
          (call $gs32 (i32.add (local.get $ck) (i32.const 8)) (local.get $fcc))
          (local.set $next (i32.add (local.get $next) (i32.const 4)))))
      (call $gs32 (local.get $ck) (local.get $ckid))
      (call $gs32 (i32.add (local.get $ck) (i32.const 4)) (local.get $cksize))
      (call $gs32 (i32.add (local.get $ck) (i32.const 12)) (i32.add (local.get $pos) (i32.const 8)))
      (call $gs32 (i32.add (local.get $ck) (i32.const 16)) (i32.const 0))
      (i32.store offset=20 (local.get $slot) (local.get $next))
      (if (i32.eqz (local.get $flags)) (then (return (i32.const 0))))
      (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 0x20)) (i32.const 0))  ;; MMIO_FINDRIFF
                   (i32.and (i32.eq (local.get $ckid) (i32.const 0x46464952))
                            (i32.eq (local.get $fcc) (local.get $search_type))))
        (then (return (i32.const 0))))
      (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 0x40)) (i32.const 0))  ;; MMIO_FINDLIST
                   (i32.and (i32.eq (local.get $ckid) (i32.const 0x5453494C))
                            (i32.eq (local.get $fcc) (local.get $search_type))))
        (then (return (i32.const 0))))
      (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0))  ;; MMIO_FINDCHUNK
                   (i32.eq (local.get $ckid) (local.get $search_id)))
        (then (return (i32.const 0))))
      (i32.store offset=20 (local.get $slot)
        (i32.add (i32.add (local.get $pos) (i32.const 8))
                 (i32.and (i32.add (local.get $cksize) (i32.const 1)) (i32.const 0xFFFFFFFE))))
      (br $search)))
    (i32.const 514))                                                    ;; MMIOERR_CHUNKNOTFOUND

  ;; Returns the guest buffer bound to $h, binding a default internal buffer on
  ;; first use. 0 if the slot table or heap is exhausted.
  (func $mmio_buf_for (param $h i32) (result i32)
    (local $addr i32) (local $buf i32)
    (local.set $addr (call $mmio_slot_for (local.get $h) (i32.const 1)))
    (if (i32.eqz (local.get $addr)) (then (return (i32.const 0))))
    (local.set $buf (i32.load offset=4 (local.get $addr)))
    (if (i32.eqz (local.get $buf))
      (then
        (local.set $buf (call $heap_alloc (global.get $MMIO_BUF_SIZE)))
        (if (i32.eqz (local.get $buf)) (then (return (i32.const 0))))
        (i32.store offset=4 (local.get $addr) (local.get $buf))
        (i32.store offset=8 (local.get $addr) (global.get $MMIO_BUF_SIZE))
        (i32.store offset=12 (local.get $addr) (i32.const 1))))
    (local.get $buf))

  ;; Drops the handle->buffer binding and releases an internally-owned block.
  (func $mmio_buf_release (param $h i32)
    (local $addr i32)
    (local.set $addr (call $mmio_slot_for (local.get $h) (i32.const 0)))
    (if (i32.eqz (local.get $addr)) (then (return)))
    (if (i32.and
          (i32.ne (i32.load offset=12 (local.get $addr)) (i32.const 0))
          (i32.ne (i32.load offset=4 (local.get $addr)) (i32.const 0)))
      (then (call $heap_free (i32.load offset=4 (local.get $addr)))))
    (call $zero_memory (local.get $addr) (global.get $MMIO_SLOT_BYTES)))

  ;; A memory file keeps its whole contents in the buffer, so the app's own
  ;; MMIOINFO is the authority on how far it got: pchNext is the position and
  ;; anything it read or dirtied past the recorded length extends the file.
  (func $mmio_mem_sync (param $slot i32) (param $info i32)
    (local $wa i32) (local $buf i32) (local $size i32) (local $pos i32) (local $end i32)
    (local.set $wa (call $guest_span_in (local.get $info) (i32.const 72)))
    (local.set $buf (i32.load offset=4 (local.get $slot)))
    (local.set $size (i32.load offset=8 (local.get $slot)))
    (local.set $pos (i32.sub (i32.load offset=28 (local.get $wa)) (local.get $buf)))
    (if (i32.gt_u (local.get $pos) (local.get $size)) (then (local.set $pos (local.get $size))))
    (i32.store offset=20 (local.get $slot) (local.get $pos))
    (local.set $end (i32.sub (i32.load offset=32 (local.get $wa)) (local.get $buf)))
    (if (i32.ne (i32.and (i32.load (local.get $wa)) (i32.const 0x10000000)) (i32.const 0)) ;; MMIO_DIRTY
      (then (if (i32.gt_u (local.get $pos) (local.get $end))
        (then (local.set $end (local.get $pos))))))
    (if (i32.gt_u (local.get $end) (local.get $size)) (then (local.set $end (local.get $size))))
    (if (i32.gt_u (local.get $end) (i32.load offset=24 (local.get $slot)))
      (then (i32.store offset=24 (local.get $slot) (local.get $end))))
    (call $guest_span_release (local.get $wa) (i32.const 72)))

  ;; Fills lpmmioinfo for a memory file: the buffer is the file, lBufOffset is
  ;; always 0 and pchEndRead marks the end of the data written so far.
  (func $mmio_mem_fill_info (param $slot i32) (param $info i32) (param $h i32)
    (local $wa i32) (local $buf i32)
    (local.set $wa (call $guest_span_in (local.get $info) (i32.const 72)))
    (local.set $buf (i32.load offset=4 (local.get $slot)))
    (call $zero_memory (local.get $wa) (i32.const 72))
    (i32.store (local.get $wa)
      (i32.and (i32.load offset=28 (local.get $slot)) (i32.const 0x0FFFFFFF)))    ;; dwFlags, DIRTY clear
    (i32.store offset=4 (local.get $wa) (i32.const 0x204D454D))                   ;; fccIOProc "MEM "
    (i32.store offset=20 (local.get $wa) (i32.load offset=8 (local.get $slot)))   ;; cchBuffer
    (i32.store offset=24 (local.get $wa) (local.get $buf))                        ;; pchBuffer
    (i32.store offset=28 (local.get $wa)
      (i32.add (local.get $buf) (i32.load offset=20 (local.get $slot))))          ;; pchNext
    (i32.store offset=32 (local.get $wa)
      (i32.add (local.get $buf) (i32.load offset=24 (local.get $slot))))          ;; pchEndRead
    (i32.store offset=36 (local.get $wa)
      (i32.add (local.get $buf) (i32.load offset=8 (local.get $slot))))           ;; pchEndWrite
    (i32.store offset=44 (local.get $wa) (i32.load offset=24 (local.get $slot)))  ;; lDiskOffset
    (i32.store offset=68 (local.get $wa) (local.get $h))                          ;; hmmio
    (call $guest_span_writeback (local.get $info) (local.get $wa) (i32.const 72)))

  ;; mmioOpen on a memory file: lpmmioinfo names FOURCC_MEM and supplies the
  ;; buffer (or, with a NULL pchBuffer, its size for us to allocate). Without
  ;; MMIO_CREATE the buffer's whole contents are the file. Returns the HMMIO,
  ;; or 0 with wErrorRet set.
  (func $mmio_open_mem (param $info i32) (param $flags i32) (param $name_ptr i32) (result i32)
    (local $wa i32) (local $result i32)
    ;; One bounded translation, including every early wErrorRet return below.
    (local.set $wa (call $guest_span_in (local.get $info) (i32.const 72)))
    (local.set $result (call $mmio_open_mem_span
      (local.get $wa) (local.get $flags) (local.get $name_ptr)))
    (call $guest_span_writeback (local.get $info) (local.get $wa) (i32.const 72))
    (local.get $result))

  (func $mmio_open_mem_span (param $wa i32) (param $flags i32) (param $name_ptr i32) (result i32)
    (local $i i32) (local $h i32) (local $slot i32)
    (local $buf i32) (local $size i32) (local $owned i32)
    (local.set $size (i32.load offset=20 (local.get $wa)))
    (local.set $buf (i32.load offset=24 (local.get $wa)))
    (if (i32.ne (i32.load offset=48 (local.get $wa)) (i32.const 0))
      ;; adwInfo[0] is the growth increment of an expandable memory file.
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (if (i32.le_s (local.get $size) (i32.const 0))
      (then
        (i32.store offset=12 (local.get $wa) (i32.const 5))                       ;; MMSYSERR_INVALPARAM
        (return (i32.const 0))))
    ;; Handles below the host filesystem's 0x70000001 range, one per slot.
    (block $found (loop $scan
      (if (i32.ge_u (local.get $i) (global.get $MMIO_BUF_SLOTS))
        (then
          (i32.store offset=12 (local.get $wa) (i32.const 258))                   ;; MMIOERR_OUTOFMEMORY
          (return (i32.const 0))))
      (local.set $slot (call $mmio_slot_addr (local.get $i)))
      (br_if $found (i32.eqz (i32.load (local.get $slot))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.set $h (i32.or (i32.const 0x6D4D0010) (local.get $i)))
    (if (i32.eqz (local.get $buf))
      (then
        (local.set $buf (call $heap_alloc (local.get $size)))
        (if (i32.eqz (local.get $buf))
          (then
            (i32.store offset=12 (local.get $wa) (i32.const 258))                 ;; MMIOERR_OUTOFMEMORY
            (return (i32.const 0))))
        (local.set $owned (i32.const 1))))
    (call $zero_memory (local.get $slot) (global.get $MMIO_SLOT_BYTES))
    (i32.store (local.get $slot) (local.get $h))
    (i32.store offset=4 (local.get $slot) (local.get $buf))
    (i32.store offset=8 (local.get $slot) (local.get $size))
    (i32.store offset=12 (local.get $slot) (local.get $owned))
    (i32.store offset=16 (local.get $slot) (i32.const 1))
    (i32.store offset=24 (local.get $slot)
      (select (i32.const 0) (local.get $size)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x1000)) (i32.const 0))))   ;; MMIO_CREATE: empty
    (i32.store offset=28 (local.get $slot) (local.get $flags))
    (i32.store offset=12 (local.get $wa) (i32.const 0))
    (local.get $h))

  ;; Refills lpmmioinfo's buffer from the file. The app's own pchNext says how
  ;; much of the previous fill it consumed, so the next disk read starts there.
  (func $mmio_refill (param $h i32) (param $info i32) (result i32)
    (local $info_wa i32) (local $buf i32) (local $pos i32)
    (local $read_ga i32) (local $read_wa i32) (local $got i32)
    (local.set $info_wa (call $guest_span_in (local.get $info) (i32.const 72)))
    (local.set $buf (i32.load (i32.add (local.get $info_wa) (i32.const 24))))
    (if (i32.eqz (local.get $buf)) (then
      (call $guest_span_release (local.get $info_wa) (i32.const 72))
      (return (i32.const 259))))  ;; MMIOERR_UNBUFFERED
    (local.set $pos (i32.add
      (i32.load (i32.add (local.get $info_wa) (i32.const 40)))       ;; lBufOffset
      (i32.sub (i32.load (i32.add (local.get $info_wa) (i32.const 28)))  ;; pchNext
               (local.get $buf))))
    (drop (call $host_fs_set_file_pointer (local.get $h) (local.get $pos) (i32.const 0)))
    (local.set $read_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $read_wa (call $g2w (local.get $read_ga)))
    (i32.store (local.get $read_wa) (i32.const 0))
    (drop (call $host_fs_read_file
      (local.get $h)
      (local.get $buf)
      (i32.load (i32.add (local.get $info_wa) (i32.const 20)))       ;; cchBuffer
      (local.get $read_ga)))
    (local.set $got (i32.load (local.get $read_wa)))
    (i32.store (i32.add (local.get $info_wa) (i32.const 28)) (local.get $buf))          ;; pchNext
    (i32.store (i32.add (local.get $info_wa) (i32.const 32))
      (i32.add (local.get $buf) (local.get $got)))                                      ;; pchEndRead
    (i32.store (i32.add (local.get $info_wa) (i32.const 40)) (local.get $pos))          ;; lBufOffset
    (i32.store (i32.add (local.get $info_wa) (i32.const 44))
      (i32.add (local.get $pos) (local.get $got)))                                      ;; lDiskOffset
    (call $guest_span_writeback (local.get $info) (local.get $info_wa) (i32.const 72))
    (i32.const 0))

  ;; mmioGetInfo(hmmio, lpmmioinfo, wFlags) — 3 args stdcall
  (func $handle_mmioGetInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $info_wa i32) (local $buf i32) (local $pos i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 5)) (return)))                ;; MMSYSERR_INVALPARAM
    (if (call $mmio_mem_slot (local.get $arg0))
      (then
        (call $mmio_mem_fill_info (call $mmio_mem_slot (local.get $arg0)) (local.get $arg1) (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $buf (call $mmio_buf_for (local.get $arg0)))
    (if (i32.eqz (local.get $buf))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 7)) (return)))                ;; MMSYSERR_NOMEM
    (local.set $pos (call $host_fs_set_file_pointer (local.get $arg0) (i32.const 0) (i32.const 1)))
    (local.set $info_wa (call $guest_span_in (local.get $arg1) (i32.const 72)))
    (call $zero_memory (local.get $info_wa) (i32.const 72))
    (i32.store (local.get $info_wa) (i32.const 0x00010000))           ;; dwFlags = MMIO_ALLOCBUF
    (i32.store (i32.add (local.get $info_wa) (i32.const 4)) (i32.const 0x454C4946))  ;; fccIOProc "FILE"
    (i32.store (i32.add (local.get $info_wa) (i32.const 20))
      (i32.load offset=8 (call $mmio_slot_for (local.get $arg0) (i32.const 0))))
    (i32.store (i32.add (local.get $info_wa) (i32.const 24)) (local.get $buf))       ;; pchBuffer
    ;; Buffer starts empty: pchNext == pchEndRead makes the app call mmioAdvance.
    (i32.store (i32.add (local.get $info_wa) (i32.const 28)) (local.get $buf))       ;; pchNext
    (i32.store (i32.add (local.get $info_wa) (i32.const 32)) (local.get $buf))       ;; pchEndRead
    (i32.store (i32.add (local.get $info_wa) (i32.const 36))
      (i32.add (local.get $buf) (i32.load (i32.add (local.get $info_wa) (i32.const 20))))) ;; pchEndWrite
    (i32.store (i32.add (local.get $info_wa) (i32.const 40)) (local.get $pos))       ;; lBufOffset
    (i32.store (i32.add (local.get $info_wa) (i32.const 44)) (local.get $pos))       ;; lDiskOffset
    (i32.store (i32.add (local.get $info_wa) (i32.const 68)) (local.get $arg0))      ;; hmmio
    (call $guest_span_writeback (local.get $arg1) (local.get $info_wa) (i32.const 72))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; mmioAdvance(hmmio, lpmmioinfo, fuAdvance) — 3 args stdcall
  (func $handle_mmioAdvance (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $slot i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 5)) (return)))                ;; MMSYSERR_INVALPARAM
    ;; A memory file has nothing behind its buffer: reading on finds only the
    ;; data already there, and writing past a full fixed-size buffer fails.
    (local.set $slot (call $mmio_mem_slot (local.get $arg0)))
    (if (local.get $slot)
      (then
        (call $mmio_mem_sync (local.get $slot) (local.get $arg1))
        (if (i32.and
              (i32.eq (local.get $arg2) (i32.const 1))                                  ;; MMIO_WRITE
              (i32.ge_u (i32.load offset=20 (local.get $slot)) (i32.load offset=8 (local.get $slot))))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 268)) (return)))  ;; MMIOERR_CANNOTEXPAND
        (call $mmio_mem_fill_info (local.get $slot) (local.get $arg1) (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $result (call $mmio_refill (local.get $arg0) (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    ;; Buffered ISO input has the same asynchronous provider boundary as
    ;; mmioRead. A successful MMIO refill with no resident bytes may mean the
    ;; provider is fetching the next extent, not end-of-file. Retry the whole
    ;; API thunk after IO_WAIT so a transient empty buffer cannot terminate a
    ;; movie at the first lazy chunk boundary.
    (if (i32.and
          (i32.eqz (local.get $result))
          (i32.eq (call $host_fs_read_pending) (i32.const 1)))
      (then (call $io_block (i32.const 16))))
  )

  ;; mmioSetInfo(hmmio, lpmmioinfo, wFlags) — 3 args stdcall
  ;; Hands buffered I/O back. The file pointer has to end up where the app's
  ;; pchNext left off, or a following mmioRead/mmioSeek reads from the wrong
  ;; place — mmioAdvance leaves it a whole buffer ahead.
  (func $handle_mmioSetInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $info_wa i32) (local $buf i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 5)) (return)))                ;; MMSYSERR_INVALPARAM
    (if (call $mmio_mem_slot (local.get $arg0))
      (then
        (call $mmio_mem_sync (call $mmio_mem_slot (local.get $arg0)) (local.get $arg1))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $info_wa (call $guest_span_in (local.get $arg1) (i32.const 72)))
    (local.set $buf (i32.load (i32.add (local.get $info_wa) (i32.const 24))))
    (if (local.get $buf)
      (then
        (drop (call $host_fs_set_file_pointer (local.get $arg0)
          (i32.add
            (i32.load (i32.add (local.get $info_wa) (i32.const 40)))  ;; lBufOffset
            (i32.sub (i32.load (i32.add (local.get $info_wa) (i32.const 28)))
                     (local.get $buf)))                               ;; + consumed
          (i32.const 0)))))
    (call $guest_span_release (local.get $info_wa) (i32.const 72))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; mmioSetBuffer(hmmio, pchBuffer, cchBuffer, fuBuffer) — 4 args stdcall.
  ;; Bind caller storage, allocate internal storage for NULL+size, or disable
  ;; buffering for NULL+zero. Alpha Centauri requests a 16 KiB internal buffer.
  (func $handle_mmioSetBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $buf i32) (local $owned i32) (local $old i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.or (local.get $arg3) (i32.lt_s (local.get $arg2) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 5)) (return)))               ;; MMSYSERR_INVALPARAM
    ;; A memory file's buffer is its contents; replacing it is not modeled.
    (if (call $mmio_mem_slot (local.get $arg0))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (if (i32.eqz (local.get $arg2))
      (then
        (call $mmio_buf_release (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $slot (call $mmio_slot_for (local.get $arg0) (i32.const 1)))
    (if (i32.eqz (local.get $slot))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 258)) (return)))             ;; MMIOERR_OUTOFMEMORY
    (local.set $buf (local.get $arg1))
    (if (i32.eqz (local.get $buf))
      (then
        (local.set $buf (call $heap_alloc (local.get $arg2)))
        (if (i32.eqz (local.get $buf))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 258)) (return)))         ;; MMIOERR_OUTOFMEMORY
        (local.set $owned (i32.const 1))))
    (local.set $old (i32.load offset=4 (local.get $slot)))
    (if (i32.and
          (i32.ne (i32.load offset=12 (local.get $slot)) (i32.const 0))
          (i32.and (i32.ne (local.get $old) (i32.const 0))
                   (i32.ne (local.get $old) (local.get $buf))))
      (then (call $heap_free (local.get $old))))
    (i32.store offset=4 (local.get $slot) (local.get $buf))
    (i32.store offset=8 (local.get $slot) (local.get $arg2))
    (i32.store offset=12 (local.get $slot) (local.get $owned))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $mci_slot_addr (param $slot i32) (result i32)
    (i32.add (global.get $MCI_DEVICE_TABLE)
      (i32.mul (local.get $slot) (i32.const 16))))

  (func $mci_alloc_slot (result i32)
    (local $slot i32)
    (local.set $slot (i32.const 1))
    (block $done
      (loop $scan
        (br_if $done (i32.ge_u (local.get $slot) (i32.const 16)))
        (if (i32.eqz (i32.load (call $mci_slot_addr (local.get $slot))))
          (then (return (local.get $slot))))
        (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
        (br $scan)))
    (i32.const 0))

  ;; mciGetDeviceIDA(alias) returns the MCI device opened by a prior
  ;; mciSendStringA "open ... alias ..." command. String-command aliases live
  ;; in the host MCI backend, so resolve them at that same boundary.
  (func $handle_mciGetDeviceIDA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $id i32)
    (if (local.get $arg0)
      (then
        ;; MCIAVI devices (09a7h) are opened in WAT, not by the host backend.
        (local.set $id (call $mciavi_device_id (call $g2w (local.get $arg0))))
        (if (i32.eqz (local.get $id))
          (then (local.set $id (call $host_mci_get_device_id (call $g2w (local.get $arg0))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $id))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 809: mciSendCommandA(mciId, uMsg, fdwCommand, dwParam)
  (func $handle_mciSendCommandA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $params_wa i32)
    (local $slot i32)
    (local $slot_addr i32)
    (local $host_id i32)
    (local $type_val i32)
    (local $type_arg i32)
    (local $element_wa i32)
    (local $err i32)
    ;; MCI_SYSINFO is handled by MCI itself and accepts MCI_ALL_DEVICE_ID (-1),
    ;; so it must run before the per-open-device validation below. Advertise
    ;; exactly the two device classes backed by the host audio implementation.
    (if (i32.eq (local.get $arg1) (i32.const 0x0810))
      (then
        (if (i32.eqz (local.get $arg3))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x105)) ;; MCIERR_MISSING_PARAMETER
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $params_wa (call $g2w (local.get $arg3)))
        (local.set $element_wa (call $g2w (i32.load offset=4 (local.get $params_wa))))
        (if (i32.and (local.get $arg2) (i32.const 0x100)) ;; MCI_SYSINFO_QUANTITY
          (then
            (i32.store (local.get $element_wa)
              (if (result i32) (i32.and (local.get $arg2) (i32.const 0x200))
                (then (i32.const 0)) ;; no devices are open during discovery
                (else (i32.const 2))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (if (i32.and (local.get $arg2) (i32.const 0x400)) ;; MCI_SYSINFO_NAME
          (then
            (if (i32.eq (i32.load offset=12 (local.get $params_wa)) (i32.const 1))
              (then
                (i32.store (local.get $element_wa) (i32.const 0x65766177)) ;; wave
                (i32.store offset=4 (local.get $element_wa) (i32.const 0x69647561)) ;; audi
                (i32.store offset=8 (local.get $element_wa) (i32.const 0x0000006f))) ;; o
              (else
                (i32.store (local.get $element_wa) (i32.const 0x75716573)) ;; sequ
                (i32.store offset=4 (local.get $element_wa) (i32.const 0x65636e65)) ;; ence
                (i32.store offset=8 (local.get $element_wa) (i32.const 0x00000072)))) ;; r
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x105))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; MCI_OPEN = 0x0803. MCI_OPEN_PARMSA: +4 wDeviceID, +8 lpstrDeviceType,
    ;; +12 lpstrElementName.
    (if (i32.eq (local.get $arg1) (i32.const 0x0803))
      (then
        (if (i32.eqz (local.get $arg3))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x106)) ;; MCIERR_INVALID_DEVICE_ID
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $params_wa (call $g2w (local.get $arg3)))
        (local.set $type_val (i32.load (i32.add (local.get $params_wa) (i32.const 8))))
        (local.set $type_arg
          (if (result i32)
            (i32.and (local.get $arg2) (i32.const 0x1000)) ;; MCI_OPEN_TYPE_ID
            (then (local.get $type_val))
            (else
              (if (result i32) (local.get $type_val)
                (then (call $g2w (local.get $type_val)))
                (else (i32.const 0))))))
        (local.set $element_wa
          (if (result i32) (i32.load (i32.add (local.get $params_wa) (i32.const 12)))
            (then (call $g2w (i32.load (i32.add (local.get $params_wa) (i32.const 12)))))
            (else (i32.const 0))))
        (local.set $host_id (call $host_mci_open
          (local.get $type_arg)
          (local.get $element_wa)
          (local.get $arg2)))
        (if (i32.eqz (local.get $host_id))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x107)) ;; MCIERR_UNRECOGNIZED_KEYWORD / generic open failure
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $slot (call $mci_alloc_slot))
        (if (i32.eqz (local.get $slot))
          (then
            (drop (call $host_mci_command (local.get $host_id) (i32.const 0x0804) (i32.const 0) (i32.const 0)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x109)) ;; MCIERR_OUT_OF_MEMORY-ish
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $slot_addr (call $mci_slot_addr (local.get $slot)))
        (i32.store (local.get $slot_addr) (local.get $host_id))
        (i32.store (i32.add (local.get $params_wa) (i32.const 4)) (local.get $slot))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $slot (local.get $arg0))
    (if (i32.or (i32.eqz (local.get $slot)) (i32.ge_u (local.get $slot) (i32.const 16)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x101)) ;; MCIERR_INVALID_DEVICE_ID
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $slot_addr (call $mci_slot_addr (local.get $slot)))
    (local.set $host_id (i32.load (local.get $slot_addr)))
    (if (i32.eqz (local.get $host_id))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x101)) ;; MCIERR_INVALID_DEVICE_ID
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $params_wa
      (if (result i32) (local.get $arg3)
        (then (call $g2w (local.get $arg3)))
        (else (i32.const 0))))
    (local.set $err (call $host_mci_command
      (local.get $host_id)
      (local.get $arg1)
      (local.get $arg2)
      (local.get $params_wa)))
    (if (i32.eq (local.get $arg1) (i32.const 0x0804)) ;; MCI_CLOSE
      (then (i32.store (local.get $slot_addr) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $err))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 855: mciSendCommandW — wide version, same behavior
  (func $handle_mciSendCommandW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $params_wa i32)
    (local $slot i32)
    (local $slot_addr i32)
    (local $host_id i32)
    (local $type_val i32)
    (local $type_arg i32)
    (local $element_wa i32)
    (local $err i32)
    (if (i32.eq (local.get $arg1) (i32.const 0x0810)) ;; MCI_SYSINFO
      (then
        (if (i32.eqz (local.get $arg3))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x105))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $params_wa (call $g2w (local.get $arg3)))
        (local.set $element_wa (call $g2w (i32.load offset=4 (local.get $params_wa))))
        (if (i32.and (local.get $arg2) (i32.const 0x100)) ;; MCI_SYSINFO_QUANTITY
          (then
            (i32.store (local.get $element_wa)
              (if (result i32) (i32.and (local.get $arg2) (i32.const 0x200))
                (then (i32.const 0))
                (else (i32.const 2))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (if (i32.and (local.get $arg2) (i32.const 0x400)) ;; MCI_SYSINFO_NAME
          (then
            (if (i32.eq (i32.load offset=12 (local.get $params_wa)) (i32.const 1))
              (then
                (i32.store16 (local.get $element_wa) (i32.const 0x77)) ;; waveaudio
                (i32.store16 offset=2 (local.get $element_wa) (i32.const 0x61))
                (i32.store16 offset=4 (local.get $element_wa) (i32.const 0x76))
                (i32.store16 offset=6 (local.get $element_wa) (i32.const 0x65))
                (i32.store16 offset=8 (local.get $element_wa) (i32.const 0x61))
                (i32.store16 offset=10 (local.get $element_wa) (i32.const 0x75))
                (i32.store16 offset=12 (local.get $element_wa) (i32.const 0x64))
                (i32.store16 offset=14 (local.get $element_wa) (i32.const 0x69))
                (i32.store16 offset=16 (local.get $element_wa) (i32.const 0x6f))
                (i32.store16 offset=18 (local.get $element_wa) (i32.const 0)))
              (else
                (i32.store16 (local.get $element_wa) (i32.const 0x73)) ;; sequencer
                (i32.store16 offset=2 (local.get $element_wa) (i32.const 0x65))
                (i32.store16 offset=4 (local.get $element_wa) (i32.const 0x71))
                (i32.store16 offset=6 (local.get $element_wa) (i32.const 0x75))
                (i32.store16 offset=8 (local.get $element_wa) (i32.const 0x65))
                (i32.store16 offset=10 (local.get $element_wa) (i32.const 0x6e))
                (i32.store16 offset=12 (local.get $element_wa) (i32.const 0x63))
                (i32.store16 offset=14 (local.get $element_wa) (i32.const 0x65))
                (i32.store16 offset=16 (local.get $element_wa) (i32.const 0x72))
                (i32.store16 offset=18 (local.get $element_wa) (i32.const 0))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x105))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.eq (local.get $arg1) (i32.const 0x0803))
      (then
        (if (i32.eqz (local.get $arg3))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x106))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $params_wa (call $g2w (local.get $arg3)))
        (local.set $type_val (i32.load (i32.add (local.get $params_wa) (i32.const 8))))
        (local.set $type_arg
          (if (result i32)
            (i32.and (local.get $arg2) (i32.const 0x1000))
            (then (local.get $type_val))
            (else
              (if (result i32) (local.get $type_val)
                (then (call $g2w (local.get $type_val)))
                (else (i32.const 0))))))
        (local.set $element_wa
          (if (result i32) (i32.load (i32.add (local.get $params_wa) (i32.const 12)))
            (then (call $g2w (i32.load (i32.add (local.get $params_wa) (i32.const 12)))))
            (else (i32.const 0))))
        (local.set $host_id (call $host_mci_open_w
          (local.get $type_arg)
          (local.get $element_wa)
          (local.get $arg2)))
        (if (i32.eqz (local.get $host_id))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x107))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $slot (call $mci_alloc_slot))
        (if (i32.eqz (local.get $slot))
          (then
            (drop (call $host_mci_command (local.get $host_id) (i32.const 0x0804) (i32.const 0) (i32.const 0)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x109))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $slot_addr (call $mci_slot_addr (local.get $slot)))
        (i32.store (local.get $slot_addr) (local.get $host_id))
        (i32.store (i32.add (local.get $params_wa) (i32.const 4)) (local.get $slot))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $slot (local.get $arg0))
    (if (i32.or (i32.eqz (local.get $slot)) (i32.ge_u (local.get $slot) (i32.const 16)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x101)) ;; MCIERR_INVALID_DEVICE_ID
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $slot_addr (call $mci_slot_addr (local.get $slot)))
    (local.set $host_id (i32.load (local.get $slot_addr)))
    (if (i32.eqz (local.get $host_id))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x101)) ;; MCIERR_INVALID_DEVICE_ID
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $params_wa
      (if (result i32) (local.get $arg3)
        (then (call $g2w (local.get $arg3)))
        (else (i32.const 0))))
    (local.set $err (call $host_mci_command
      (local.get $host_id)
      (local.get $arg1)
      (local.get $arg2)
      (local.get $params_wa)))
    (if (i32.eq (local.get $arg1) (i32.const 0x0804))
      (then (i32.store (local.get $slot_addr) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $err))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 810: GetSystemPaletteEntries(hdc, iStart, nEntries, lppe) — 4 args stdcall
  ;; Fill the 20 reserved Windows system-palette entries (indices 0-9 and 246-255)
  ;; with the standard Win98 colors, zero elsewhere. Apps (e.g. RCT) use these to
  ;; confirm we're on a palettized display; returning all zeros makes them quit.
  (func $handle_GetSystemPaletteEntries (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32)      ;; wasm addr of caller buffer
    (local $i i32)        ;; index inside buffer (0..nEntries)
    (local $pal i32)      ;; palette index (iStart + i)
    (local $rgb i32)      ;; packed 0x00BBGGRR
    (if (i32.eqz (local.get $arg3))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 256))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $buf (call $g2w (local.get $arg3)))
    (call $zero_memory (local.get $buf) (i32.mul (local.get $arg2) (i32.const 4)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $pal (i32.add (local.get $arg1) (local.get $i)))
      (local.set $rgb (i32.const 0))
      (if (i32.lt_u (local.get $pal) (i32.const 10))
        (then
          (block $f
            (if (i32.eq (local.get $pal) (i32.const 0)) (then (local.set $rgb (i32.const 0x000000)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 1)) (then (local.set $rgb (i32.const 0x000080)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 2)) (then (local.set $rgb (i32.const 0x008000)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 3)) (then (local.set $rgb (i32.const 0x008080)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 4)) (then (local.set $rgb (i32.const 0x800000)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 5)) (then (local.set $rgb (i32.const 0x800080)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 6)) (then (local.set $rgb (i32.const 0x808000)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 7)) (then (local.set $rgb (i32.const 0xC0C0C0)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 8)) (then (local.set $rgb (i32.const 0xC0DCC0)) (br $f)))
            (if (i32.eq (local.get $pal) (i32.const 9)) (then (local.set $rgb (i32.const 0xF0CAA6)) (br $f)))
          )))
      (if (i32.ge_u (local.get $pal) (i32.const 246))
        (then
          (block $g
            (if (i32.eq (local.get $pal) (i32.const 246)) (then (local.set $rgb (i32.const 0xF0FBFF)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 247)) (then (local.set $rgb (i32.const 0xA4A0A0)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 248)) (then (local.set $rgb (i32.const 0x808080)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 249)) (then (local.set $rgb (i32.const 0x0000FF)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 250)) (then (local.set $rgb (i32.const 0x00FF00)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 251)) (then (local.set $rgb (i32.const 0x00FFFF)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 252)) (then (local.set $rgb (i32.const 0xFF0000)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 253)) (then (local.set $rgb (i32.const 0xFF00FF)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 254)) (then (local.set $rgb (i32.const 0xFFFF00)) (br $g)))
            (if (i32.eq (local.get $pal) (i32.const 255)) (then (local.set $rgb (i32.const 0xFFFFFF)) (br $g)))
          )))
      (if (i32.and (i32.eq (call $gdi_display_bpp) (i32.const 8)) (i32.lt_u (local.get $pal) (i32.const 256)))
        (then (local.set $rgb (call $gdi_swap_rb (i32.load (i32.add (call $gdi_system_palette)
          (i32.shl (local.get $pal) (i32.const 2))))))))
      (call $gs32 (i32.add (local.get $arg3) (i32.mul (local.get $i) (i32.const 4))) (local.get $rgb))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 811: SetSystemPaletteUse(hdc, uUsage) — 2 args stdcall
  (func $handle_SetSystemPaletteUse (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.lt_u (local.get $arg1) (i32.const 1))
          (i32.gt_u (local.get $arg1) (i32.const 3)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (call $gdi_dc_meta_set
        (local.get $arg0) (i32.const 12) (local.get $arg1) (i32.const 1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 812: ChangeDisplaySettingsA(lpDevMode, dwFlags) — 2 args stdcall.
  ;;
  ;; Two things are recorded. The *intent*: CDS_FULLSCREEN (0x4) with a mode is
  ;; an app taking the display, and a NULL lpDevMode is the documented "go back
  ;; to the registry mode" call that ends it. That flag is the only explicit
  ;; fullscreen signal a non-DirectDraw app gives, so the compositor uses it
  ;; instead of guessing from window geometry.
  ;;
  ;; And the *mode*. This used to answer DISP_CHANGE_SUCCESSFUL and drop the
  ;; resolution on the floor, which is a lie an app then builds on. SimGolf is
  ;; the case that names the cost: it creates a 640x480 window, maximizes it
  ;; (so the renderer hands it the whole browser desktop, 940x734), asks for
  ;; 800x600 here, is told yes, and renders its course with
  ;; glViewport(0, 0, 800, 600). GL's origin is bottom-left, so the scene lands
  ;; in the bottom-left 800x600 of a 940x734 drawable and the remaining L —
  ;; 134 rows above, 140 columns right — is never written by anything. Its GDI
  ;; interface meanwhile lays itself out against the real 940-wide client, so
  ;; the two halves of one frame disagree about where the screen is.
  ;;
  ;; A mode is applied the same way IDirectDraw::SetDisplayMode applies one:
  ;; the display state the screen metrics read, then the owning window resized
  ;; to it, then the messages Windows sends. There is deliberately no second
  ;; notion of "the current mode" here — SM_CXSCREEN has to give one answer.
  (func $change_display_settings_core (param $devmode i32) (param $flags i32)
    (local $fields i32) (local $w i32) (local $h i32) (local $bpp i32)
    (local $changed i32) (local $target i32)
    ;; Taking the display is decided by whether a MODE IS APPLIED, not by
    ;; CDS_FULLSCREEN. That flag used to gate this, and reading it as "the app
    ;; is going fullscreen" is a misreading of the API: CDS_FULLSCREEN means
    ;; the mode is *temporary* -- do not write it to the registry, drop it when
    ;; the process ends. dwFlags==0 is the permanent dynamic change, and it
    ;; takes the display at least as hard. On a real machine both of them move
    ;; the monitor, and the app's window then fills a screen that is now the
    ;; size it asked for.
    ;;
    ;; SimGolf is what named the cost: jgl+0x100401e2 pushes `0` for dwFlags
    ;; and a DEVMODE with dmFields 0x5C0000, so the old gate left
    ;; $display_fullscreen at 0, lib/renderer.js never entered its exclusive
    ;; path, and an 800x600 game sat in the corner of a 1280x872 desktop with
    ;; Win98 wallpaper and icons around it. The guest was right about
    ;; everything -- SM_CXSCREEN already reports the mode -- the compositor
    ;; just never heard that the display had changed hands.
    ;;
    ;; Set below, once the mode has actually been accepted, so a DEVMODE that
    ;; names no resolution and a mode no display has both leave it alone.
    (if (i32.eqz (local.get $devmode))
      (then (call $dx_display_fullscreen_set (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; DISP_CHANGE_SUCCESSFUL
    ;; NULL lpDevMode is the documented "back to the registry mode" call, and
    ;; it deliberately does NOT clear the display state here. That state is
    ;; shared with IDirectDraw::SetDisplayMode, and a DirectDraw app that ends
    ;; its own fullscreen through this spelling still owns a mode; tearing it
    ;; down took Pinball's restored menu with it. RestoreDisplayMode is the
    ;; call that ends a DirectDraw mode.
    (if (i32.eqz (local.get $devmode)) (then (return)))
    (local.set $fields (call $gl32 (i32.add (local.get $devmode) (i32.const 40))))
    ;; DM_PELSWIDTH | DM_PELSHEIGHT. A DEVMODE that names neither is asking for
    ;; something else (a refresh rate, an orientation) and leaves the mode be.
    (if (i32.ne (i32.and (local.get $fields) (i32.const 0x00180000))
                (i32.const 0x00180000))
      (then (return)))
    (local.set $w (call $gl32 (i32.add (local.get $devmode) (i32.const 108))))
    (local.set $h (call $gl32 (i32.add (local.get $devmode) (i32.const 112))))
    ;; Refuse a mode no display has rather than resizing the window to it.
    (if (i32.or
          (i32.or (i32.lt_u (local.get $w) (i32.const 64))
                  (i32.gt_u (local.get $w) (i32.const 8192)))
          (i32.or (i32.lt_u (local.get $h) (i32.const 64))
                  (i32.gt_u (local.get $h) (i32.const 8192))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -2))  ;; DISP_CHANGE_BADMODE
        (return)))
    (local.set $bpp (call $dx_display_bpp_get))
    (if (i32.ne (i32.and (local.get $fields) (i32.const 0x00040000)) (i32.const 0))
      (then (local.set $bpp (call $gl32 (i32.add (local.get $devmode) (i32.const 104))))))
    (if (i32.eqz (local.get $bpp)) (then (local.set $bpp (i32.const 32))))
    (local.set $changed
      (i32.or
        (i32.eqz (call $dx_display_mode_get))
        (i32.or (i32.ne (call $dx_display_w_get) (local.get $w))
                (i32.ne (call $dx_display_h_get) (local.get $h)))))
    (call $dx_display_w_set (local.get $w))
    (call $dx_display_h_set (local.get $h))
    (call $dx_display_bpp_set (local.get $bpp))
    (call $dx_display_mode_set (i32.const 1))
    ;; The mode is real and applied: the display is this app's now. Before the
    ;; early return below, so a second call asking for the mode already in
    ;; effect still says so rather than silently dropping the claim.
    (call $dx_display_fullscreen_set (i32.const 1))
    (if (i32.eqz (local.get $changed)) (then (return)))
    ;; The window that owns the display follows the mode, exactly as it does
    ;; for a DirectDraw mode switch: an app that maximized before the switch is
    ;; sitting on the pre-switch desktop, and every client-relative thing it
    ;; does next — a GL viewport, a UI layout, a hit test — is computed from
    ;; the size it is told it has.
    (local.set $target (global.get $main_hwnd))
    (if (i32.eqz (local.get $target)) (then (return)))
    (call $host_move_window (local.get $target)
      (i32.const 0) (i32.const 0) (local.get $w) (local.get $h) (i32.const 0))
    (call $defwndproc_do_nccalcsize (local.get $target))
    ;; WM_DISPLAYCHANGE(bpp, w | h<<16), then the WM_MOVE/WM_SIZE pair the
    ;; resize itself owes the app.
    (drop (call $post_queue_push (local.get $target) (i32.const 0x007E)
      (local.get $bpp)
      (i32.or (i32.and (local.get $w) (i32.const 0xFFFF))
              (i32.shl (local.get $h) (i32.const 16)))))
    (drop (call $post_queue_push (local.get $target) (i32.const 0x0003)
      (i32.const 0) (i32.const 0)))
    (drop (call $post_queue_push (local.get $target) (i32.const 0x0005)
      (i32.const 0)
      (i32.or (i32.and (local.get $w) (i32.const 0xFFFF))
              (i32.shl (local.get $h) (i32.const 16)))))
    ;; And the window is dirty. A real mode switch throws the framebuffer away,
    ;; and so does this one — resizing the drawable reallocates it — so an app
    ;; that only redraws what it is asked to redraw has to be asked. SimGolf
    ;; renders its course on demand: after the switch its GL buffer was empty
    ;; and it had no reason to fill it again, so the whole course area stayed
    ;; black behind a correctly placed interface.
    (call $invalidate_hwnd (local.get $target)))

  (func $handle_ChangeDisplaySettingsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $change_display_settings_core (local.get $arg0) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; ChangeDisplaySettingsExA(lpszDeviceName, lpDevMode, hwnd, dwFlags, lParam)
  ;; — 5 args. The device name is ignored: there is one display. Warcraft III's
  ;; OpenGL path takes the screen through this spelling rather than the short
  ;; one, so both have to record the same fullscreen intent.
  (func $handle_ChangeDisplaySettingsExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $change_display_settings_core (local.get $arg1) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; EnumDisplaySettingsA(lpszDeviceName, iModeNum, lpDevMode) — 3 args stdcall.
  ;; ENUM_CURRENT_SETTINGS (-1) reports the host canvas at 32bpp. iModeNum >= 0
  ;; walks the *same* mode table IDirectDraw::EnumDisplayModes enumerates —
  ;; `$enum_mode_res_w` / `$enum_mode_res_h` / `$enum_mode_raw_bpp` in
  ;; `09a8-handlers-directx.wat`, reached through the dense index there, since a
  ;; caller of this API loops until FALSE and a hole would truncate the list.
  ;; There is deliberately no second copy of the resolutions here: two lists
  ;; drift, and a display an app can set through one API but not find through
  ;; the other is exactly the failure that produces.
  ;; dmFields bits: PELSWIDTH=0x80000, PELSHEIGHT=0x100000, BITSPERPEL=0x40000, DISPLAYFREQUENCY=0x400000.
  (func $handle_EnumDisplaySettingsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32) (local $screen i32) (local $size i32)
    (local $legacy i32) (local $w i32) (local $h i32) (local $bpp i32) (local $raw i32)
    (local $len i32)
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    ;; dmSize is read off the guest address, because the span to gather is not
    ;; known until it has been read; the buffer itself is then gathered, since
    ;; a DEVMODE spanning two sparsely-backed guest pages is not contiguous in
    ;; WASM memory and every field below is written through $buf.
    (local.set $size (call $gl16 (i32.add (local.get $arg2) (i32.const 36))))
    ;; Win9x accepts a zero-initialized DEVMODE. Compact intros including PTCT
    ;; depend on that leniency while still walking the complete mode list.
    ;; An unset stack structure can contain a return address in dmSize rather
    ;; than literal zero.  No Win32 DEVMODEA layout exceeds 220 bytes, so treat
    ;; larger values as the same undeclared legacy buffer instead of clearing
    ;; through adjacent stack locals.
    (local.set $legacy
      (i32.or (i32.eqz (local.get $size))
              (i32.gt_u (local.get $size) (i32.const 220))))
    (if (local.get $legacy)
      (then (local.set $size (i32.const 156))))
    (if (i32.eq (local.get $arg1) (i32.const -1))
      (then
        (local.set $screen (call $host_get_screen_size))
        (local.set $w (i32.and (local.get $screen) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $screen) (i32.const 16)))
        (local.set $bpp (call $gdi_display_bpp)))
      (else
        ;; Any other negative index (ENUM_REGISTRY_SETTINGS, -2) is unsigned-large
        ;; here and ends the enumeration, as it did before.
        (if (i32.ge_u (local.get $arg1) (call $enum_mode_dense_count))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
        (local.set $raw (call $enum_mode_dense_to_raw (local.get $arg1)))
        (local.set $w (call $enum_mode_res_w (i32.div_u (local.get $raw) (i32.const 3))))
        (local.set $h (call $enum_mode_res_h (i32.div_u (local.get $raw) (i32.const 3))))
        (local.set $bpp (call $enum_mode_raw_bpp (local.get $raw)))))
    ;; Windows accepts the 124-byte Win95 DEVMODEA as well as today's
    ;; 156-byte layout. All display fields we return fit in that old prefix.
    (if (i32.lt_u (local.get $size) (i32.const 124))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    ;; Gather exactly what is about to be touched: the fields below end at 124,
    ;; and the clear covers at most 156. Nothing past that is read or written,
    ;; so nothing past that is copied back either.
    (local.set $len
      (select (i32.const 124)
        (select (local.get $size) (i32.const 156)
          (i32.lt_u (local.get $size) (i32.const 156)))
        (local.get $legacy)))
    (local.set $buf (call $guest_span_in (local.get $arg2) (local.get $len)))
    ;; A zero-size legacy buffer has no declared extent.  Populate only the
    ;; display fields below; clearing a guessed 156 bytes can overwrite the
    ;; caller's stack immediately past its shorter Win95-era structure.
    (if (i32.eqz (local.get $legacy))
      (then
        (memory.fill (local.get $buf) (i32.const 0)
          (select (local.get $size) (i32.const 156)
            (i32.lt_u (local.get $size) (i32.const 156))))))
    ;; Keep zero as the caller's compatibility marker across an enumeration
    ;; loop; promoting it in the output would turn the second call into the
    ;; modern multi-row contract and overflow old intros' one-entry storage.
    (i32.store16 offset=36 (local.get $buf)
      (select (i32.const 0) (local.get $size) (local.get $legacy)))
    (i32.store offset=40 (local.get $buf) (i32.const 0x5C0000))  ;; dmFields
    (i32.store offset=104 (local.get $buf) (local.get $bpp))     ;; dmBitsPerPel
    (i32.store offset=108 (local.get $buf) (local.get $w))       ;; dmPelsWidth
    (i32.store offset=112 (local.get $buf) (local.get $h))       ;; dmPelsHeight
    (i32.store offset=120 (local.get $buf) (i32.const 60))       ;; dmDisplayFrequency
    (call $guest_span_writeback (local.get $arg2) (local.get $buf) (local.get $len))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; EnumDisplaySettingsW has the same enumeration policy as the ANSI API — the
  ;; same shared mode table, the same dense index — but the 32-WCHAR device name
  ;; moves DEVMODEW's display fields 32 bytes.
  (func $handle_EnumDisplaySettingsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32) (local $screen i32) (local $size i32)
    (local $legacy i32) (local $w i32) (local $h i32) (local $bpp i32) (local $raw i32)
    (local $len i32)
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    ;; As in the ANSI twin: dmSize off the guest address, then gather the buffer.
    (local.set $size (call $gl16 (i32.add (local.get $arg2) (i32.const 68))))
    (local.set $legacy
      (i32.or (i32.eqz (local.get $size))
              (i32.gt_u (local.get $size) (i32.const 220))))
    (if (local.get $legacy)
      (then (local.set $size (i32.const 220))))
    (if (i32.eq (local.get $arg1) (i32.const -1))
      (then
        (local.set $screen (call $host_get_screen_size))
        (local.set $w (i32.and (local.get $screen) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $screen) (i32.const 16)))
        (local.set $bpp (call $gdi_display_bpp)))
      (else
        (if (i32.ge_u (local.get $arg1) (call $enum_mode_dense_count))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
        (local.set $raw (call $enum_mode_dense_to_raw (local.get $arg1)))
        (local.set $w (call $enum_mode_res_w (i32.div_u (local.get $raw) (i32.const 3))))
        (local.set $h (call $enum_mode_res_h (i32.div_u (local.get $raw) (i32.const 3))))
        (local.set $bpp (call $enum_mode_raw_bpp (local.get $raw)))))
    ;; The Win95 DEVMODEW prefix is 156 bytes; later versions grew to 188
    ;; and 220 bytes. The current-mode fields exist in every one of them.
    (if (i32.lt_u (local.get $size) (i32.const 156))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    ;; The fields below end at 156 and the clear covers at most 220.
    (local.set $len
      (select (i32.const 156)
        (select (local.get $size) (i32.const 220)
          (i32.lt_u (local.get $size) (i32.const 220)))
        (local.get $legacy)))
    (local.set $buf (call $guest_span_in (local.get $arg2) (local.get $len)))
    (if (i32.eqz (local.get $legacy))
      (then
        (memory.fill (local.get $buf) (i32.const 0)
          (select (local.get $size) (i32.const 220)
            (i32.lt_u (local.get $size) (i32.const 220))))))
    (i32.store16 offset=68 (local.get $buf) ;; dmSize
      (select (i32.const 0) (local.get $size) (local.get $legacy)))
    (i32.store offset=72 (local.get $buf) (i32.const 0x5C0000)) ;; dmFields
    (i32.store offset=136 (local.get $buf) (local.get $bpp))    ;; dmBitsPerPel
    (i32.store offset=140 (local.get $buf) (local.get $w))      ;; dmPelsWidth
    (i32.store offset=144 (local.get $buf) (local.get $h))      ;; dmPelsHeight
    (i32.store offset=152 (local.get $buf) (i32.const 60))      ;; dmDisplayFrequency
    (call $guest_span_writeback (local.get $arg2) (local.get $buf) (local.get $len))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; EnumDisplayDevicesW(lpDevice, iDevNum, lpDisplayDevice, dwFlags).
  ;; Expose the fixed host surface as one primary desktop adapter and one
  ;; active monitor. DISPLAY_DEVICEW is 0x348 bytes on 32-bit Windows:
  ;; cb, DeviceName[32], DeviceString[128], StateFlags, DeviceID[128],
  ;; DeviceKey[128]. SDL2 uses both enumeration levels during video startup.
  ;; EnumDisplayDevicesA(lpDevice, iDevNum, lpDisplayDevice, dwFlags) — the
  ;; ANSI twin of the handler below. DISPLAY_DEVICEA is 424 (0x1A8) bytes:
  ;; cb, DeviceName[32], DeviceString[128], StateFlags, DeviceID[128],
  ;; DeviceKey[128]. Warcraft III's OpenGL path enumerates adapters here before
  ;; it will create a window.
  (func $edd_fill_ansi (param $arg0 i32) (param $arg2 i32) (result i32)
    (local $dst i32)
    ;; cb off the guest address, then the whole 424-byte record gathered: it is
    ;; written through $dst below and may straddle two sparse guest pages.
    (if (i32.lt_u (call $gl32 (local.get $arg2)) (i32.const 0x1A8))
      (then (return (i32.const 0))))
    (local.set $dst (call $guest_span_in (local.get $arg2) (i32.const 0x1A8)))
    (memory.fill (local.get $dst) (i32.const 0) (i32.const 0x1A8))
    (i32.store (local.get $dst) (i32.const 0x1A8))
    (if (i32.eqz (local.get $arg0))
      (then
        ;; DeviceName = "\\\\.\\DISPLAY1"
        (i32.store offset=4  (local.get $dst) (i32.const 0x5C2E5C5C))
        (i32.store offset=8  (local.get $dst) (i32.const 0x4C505349))
        (i32.store offset=12 (local.get $dst) (i32.const 0x00315941))
        ;; DeviceString = "Wine-Assembly Display"
        (i32.store offset=36 (local.get $dst) (i32.const 0x656E6957))
        (i32.store offset=40 (local.get $dst) (i32.const 0x7373412D))
        (i32.store offset=44 (local.get $dst) (i32.const 0x6C626D65))
        (i32.store offset=48 (local.get $dst) (i32.const 0x69442079))
        (i32.store offset=52 (local.get $dst) (i32.const 0x616C7073))
        (i32.store offset=56 (local.get $dst) (i32.const 0x00000079))
        ;; DISPLAY_DEVICE_ATTACHED_TO_DESKTOP | PRIMARY_DEVICE.
        (i32.store offset=164 (local.get $dst) (i32.const 0x5)))
      (else
        ;; DeviceName = "\\\\.\\DISPLAY1\\Monitor0"
        (i32.store offset=4  (local.get $dst) (i32.const 0x5C2E5C5C))
        (i32.store offset=8  (local.get $dst) (i32.const 0x4C505349))
        (i32.store offset=12 (local.get $dst) (i32.const 0x5C315941))
        (i32.store offset=16 (local.get $dst) (i32.const 0x696E6F4D))
        (i32.store offset=20 (local.get $dst) (i32.const 0x30726F74))
        ;; DeviceString = "Default Monitor"
        (i32.store offset=36 (local.get $dst) (i32.const 0x61666544))
        (i32.store offset=40 (local.get $dst) (i32.const 0x20746C75))
        (i32.store offset=44 (local.get $dst) (i32.const 0x696E6F4D))
        (i32.store offset=48 (local.get $dst) (i32.const 0x00726F74))
        ;; DISPLAY_DEVICE_ACTIVE (same bit value as ATTACHED_TO_DESKTOP).
        (i32.store offset=164 (local.get $dst) (i32.const 0x1))))
    (call $guest_span_writeback (local.get $arg2) (local.get $dst) (i32.const 0x1A8))
    (i32.const 1)
  )

  (func $handle_EnumDisplayDevicesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $enum_display_devices_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_EnumDisplayDevicesW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $enum_display_devices_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Both spellings land here: one display adapter with one monitor on it, the
  ;; second and later iDevNum answering FALSE. Only the record layout differs —
  ;; DISPLAY_DEVICEA is 0x1A8 bytes of ANSI, DISPLAY_DEVICEW 0x348 of UTF-16 —
  ;; so the ANSI record is filled by $edd_fill_ansi and the wide one below.
  ;; The stdcall cleanup is the same 4 arguments either way and happens here.
  (func $enum_display_devices_core
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $wide i32)
    (local $dst i32)
    (if (i32.or
          (i32.ne (local.get $arg1) (i32.const 0))
          (i32.eqz (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (local.get $wide))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $edd_fill_ansi (local.get $arg0) (local.get $arg2)))
        (return)))
    (if (i32.lt_u (call $gl32 (local.get $arg2)) (i32.const 0x348))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    ;; 840 bytes is a fifth of a page: this record straddles readily.
    (local.set $dst (call $guest_span_in (local.get $arg2) (i32.const 0x348)))
    (memory.fill (local.get $dst) (i32.const 0) (i32.const 0x348))
    (i32.store (local.get $dst) (i32.const 0x348))
    (if (i32.eqz (local.get $arg0))
      (then
        ;; DeviceName = L"\\\\.\\DISPLAY1"
        (i32.store offset=4  (local.get $dst) (i32.const 0x005c005c))
        (i32.store offset=8  (local.get $dst) (i32.const 0x005c002e))
        (i32.store offset=12 (local.get $dst) (i32.const 0x00490044))
        (i32.store offset=16 (local.get $dst) (i32.const 0x00500053))
        (i32.store offset=20 (local.get $dst) (i32.const 0x0041004c))
        (i32.store offset=24 (local.get $dst) (i32.const 0x00310059))
        ;; DeviceString = L"Wine-Assembly Display"
        (i32.store offset=68  (local.get $dst) (i32.const 0x00690057))
        (i32.store offset=72  (local.get $dst) (i32.const 0x0065006e))
        (i32.store offset=76  (local.get $dst) (i32.const 0x0041002d))
        (i32.store offset=80  (local.get $dst) (i32.const 0x00730073))
        (i32.store offset=84  (local.get $dst) (i32.const 0x006d0065))
        (i32.store offset=88  (local.get $dst) (i32.const 0x006c0062))
        (i32.store offset=92  (local.get $dst) (i32.const 0x00200079))
        (i32.store offset=96  (local.get $dst) (i32.const 0x00690044))
        (i32.store offset=100 (local.get $dst) (i32.const 0x00700073))
        (i32.store offset=104 (local.get $dst) (i32.const 0x0061006c))
        (i32.store offset=108 (local.get $dst) (i32.const 0x00000079))
        ;; DISPLAY_DEVICE_ATTACHED_TO_DESKTOP | PRIMARY_DEVICE.
        (i32.store offset=324 (local.get $dst) (i32.const 0x5)))
      (else
        ;; DeviceName = L"\\\\.\\DISPLAY1\\Monitor0"
        (i32.store offset=4  (local.get $dst) (i32.const 0x005c005c))
        (i32.store offset=8  (local.get $dst) (i32.const 0x005c002e))
        (i32.store offset=12 (local.get $dst) (i32.const 0x00490044))
        (i32.store offset=16 (local.get $dst) (i32.const 0x00500053))
        (i32.store offset=20 (local.get $dst) (i32.const 0x0041004c))
        (i32.store offset=24 (local.get $dst) (i32.const 0x00310059))
        (i32.store offset=28 (local.get $dst) (i32.const 0x004d005c))
        (i32.store offset=32 (local.get $dst) (i32.const 0x006e006f))
        (i32.store offset=36 (local.get $dst) (i32.const 0x00740069))
        (i32.store offset=40 (local.get $dst) (i32.const 0x0072006f))
        (i32.store offset=44 (local.get $dst) (i32.const 0x00000030))
        ;; DeviceString = L"Default Monitor"
        (i32.store offset=68 (local.get $dst) (i32.const 0x00650044))
        (i32.store offset=72 (local.get $dst) (i32.const 0x00610066))
        (i32.store offset=76 (local.get $dst) (i32.const 0x006c0075))
        (i32.store offset=80 (local.get $dst) (i32.const 0x00200074))
        (i32.store offset=84 (local.get $dst) (i32.const 0x006f004d))
        (i32.store offset=88 (local.get $dst) (i32.const 0x0069006e))
        (i32.store offset=92 (local.get $dst) (i32.const 0x006f0074))
        (i32.store offset=96 (local.get $dst) (i32.const 0x00000072))
        ;; DISPLAY_DEVICE_ACTIVE (same bit value as ATTACHED_TO_DESKTOP).
        (i32.store offset=324 (local.get $dst) (i32.const 0x1))))
    (call $guest_span_writeback (local.get $arg2) (local.get $dst) (i32.const 0x348))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; 757: waveOutGetNumDevs() — return 1 (one audio device available)
  (func $handle_waveOutGetNumDevs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))  ;; 1 device
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; midiOutGetNumDevs() — 0 args, return 1 (one MIDI device)
  (func $handle_midiOutGetNumDevs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_midi_num_devs))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; auxGetNumDevs() — 0 args. Report zero aux devices (no line-in/CD volume).
  (func $handle_auxGetNumDevs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; Keep the no-device result centralized so the capabilities, volume, and
  ;; private-message front doors cannot disagree with auxGetNumDevs.
  (func $aux_bad_device (result i32)
    (i32.const 2)  ;; MMSYSERR_BADDEVICEID
  )

  ;; auxGetDevCapsA(uDeviceID, lpCaps, cbCaps) — 3 args. MMSYSERR_BADDEVICEID (2).
  (func $handle_auxGetDevCapsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $aux_bad_device))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; auxGetVolume(uDeviceID, lpdwVolume) — 2 args. With no advertised aux
  ;; devices every identifier, including AUX_MAPPER, is out of range.
  (func $handle_auxGetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $aux_bad_device))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; auxSetVolume(uDeviceID, dwVolume) — 2 args.
  (func $handle_auxSetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $aux_bad_device))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; auxOutMessage(uDeviceID, uMsg, dw1, dw2) — 4 args. The API checks the
  ;; device identifier before dispatching a driver-private message.
  (func $handle_auxOutMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $aux_bad_device))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; midiOutGetDevCapsA(uDeviceID, lpMidiOutCaps, cbMidiOutCaps) — 3 args
  ;; Fill MIDIOUTCAPSA struct with basic info, return MMSYSERR_NOERROR (0)
  (func $handle_midiOutGetDevCapsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $caps i32)
    (local $n i32)
    (local.set $n (call $host_midi_num_devs))
    (if (i32.or
          (i32.eqz (local.get $arg1))
          (i32.and
            (i32.ne (local.get $arg0) (i32.const -1))
            (i32.ge_u (local.get $arg0) (local.get $n))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 2)) ;; MMSYSERR_BADDEVICEID
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $caps (call $g2w (local.get $arg1)))
    ;; Zero out the struct
    (memory.fill (local.get $caps) (i32.const 0) (local.get $arg2))
    ;; wMid (manufacturer ID) = 1 (MM_MICROSOFT)
    (i32.store16 (local.get $caps) (i32.const 1))
    ;; wPid = 1
    (i32.store16 (i32.add (local.get $caps) (i32.const 2)) (i32.const 1))
    ;; wTechnology at offset 40 = MOD_MIDIPORT (1)
    ;; (szPname[MAXPNAMELEN=32] runs from +8 through +39)
    (i32.store16 (i32.add (local.get $caps) (i32.const 40)) (i32.const 1))
    ;; dwSupport at offset 48 = 0
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; MMSYSERR_NOERROR
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; midiOutOpen(lphmo, uDeviceID, dwCallback, dwCallbackInstance, dwFlags) — 5 args
  (func $handle_midiOutOpen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hmo i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 11)) ;; MMSYSERR_INVALPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $hmo (call $host_midi_out_open
      (local.get $arg1)
      (local.get $arg2)
      (local.get $arg3)
      (local.get $arg4)))
    (if (i32.eqz (local.get $hmo))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 2)) ;; MMSYSERR_BADDEVICEID
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (local.get $arg0)
      (then (call $gs32 (local.get $arg0) (local.get $hmo))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; MMSYSERR_NOERROR
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; midiOutClose(hmo) — 1 arg
  (func $handle_midiOutClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_midi_out_close (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; midiOutShortMsg(hmo, dwMsg) — 2 args
  (func $handle_midiOutShortMsg (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_midi_out_short_msg (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; midiOutLongMsg validates handle/header ownership through the same host
  ;; path. Unsupported SysEx transport must fail explicitly, not claim DONE
  ;; for a buffer whose contents were never consumed.
  (func $handle_midiOutLongMsg (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdr i32) (local $data i32)
    (if (local.get $arg1)
      (then
        (local.set $hdr (call $g2w (local.get $arg1)))
        (if (i32.load (local.get $hdr))
          (then (local.set $data (call $g2w (i32.load (local.get $hdr))))))))
    (i32.store (global.get $reg_base)
      (call $host_midi_header (local.get $arg0) (local.get $hdr)
        (local.get $arg1) (local.get $data) (local.get $arg2) (i32.const 3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))


  ;; midiOutReset(hmo) — 1 arg
  (func $handle_midiOutReset (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_midi_out_reset (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; midiOutGetVolume(hmo, lpdwVolume) — 2 args; report max volume both channels
  (func $handle_midiOutGetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 11)) ;; MMSYSERR_INVALPARAM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $host_midi_out_get_volume (local.get $arg0) (call $g2w (local.get $arg1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; midiOutSetVolume(hmo, dwVolume) — 2 args; accept silently
  (func $handle_midiOutSetVolume (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_midi_out_set_volume (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; Stream queues, registrations and clocks live with the host device.
  ;; No module-global selected stream can overwrite another live handle.
  (func $midi_stream_service (param $now i32)
    (call $host_midi_stream_service (local.get $now)))

  (func $handle_midiStreamOpen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (if (i32.or (i32.ne (local.get $arg2) (i32.const 1))
          (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1))))
      (then (i32.store (global.get $reg_base) (i32.const 11)))
      (else
        (local.set $handle (call $host_midi_stream_open
          (call $gl32 (local.get $arg1)) (local.get $arg3) (local.get $arg4)
          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
        (if (i32.lt_s (local.get $handle) (i32.const 0))
          (then (i32.store (global.get $reg_base) (i32.sub (i32.const 0) (local.get $handle))))
          (else
            (call $gs32 (local.get $arg0) (local.get $handle))
            (i32.store (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
  (func $handle_midiStreamClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $host_midi_stream_control (local.get $arg0) (i32.const 0) (call $host_get_ticks)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_midiStreamPause (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $host_midi_stream_control (local.get $arg0) (i32.const 1) (call $host_get_ticks)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_midiStreamRestart (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $host_midi_stream_control (local.get $arg0) (i32.const 2) (call $host_get_ticks)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_midiStreamStop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $host_midi_stream_control (local.get $arg0) (i32.const 3) (call $host_get_ticks)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_midiStreamProperty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $host_midi_stream_property (local.get $arg0)
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_midiOutPrepareHeader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdr i32) (local $data i32)
    (if (local.get $arg1)
      (then
        (local.set $hdr (call $g2w (local.get $arg1)))
        (if (i32.load (local.get $hdr))
          (then (local.set $data (call $g2w (i32.load (local.get $hdr))))))))
    (i32.store (global.get $reg_base)
      (call $host_midi_header (local.get $arg0) (local.get $hdr)
        (local.get $arg1) (local.get $data) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_midiOutUnprepareHeader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdr i32) (local $data i32)
    (if (local.get $arg1)
      (then
        (local.set $hdr (call $g2w (local.get $arg1)))
        (if (i32.load (local.get $hdr))
          (then (local.set $data (call $g2w (i32.load (local.get $hdr))))))))
    (i32.store (global.get $reg_base)
      (call $host_midi_header (local.get $arg0) (local.get $hdr)
        (local.get $arg1) (local.get $data) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_midiStreamOut (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdr i32) (local $data i32)
    (if (local.get $arg1)
      (then
        (local.set $hdr (call $g2w (local.get $arg1)))
        (if (i32.load (local.get $hdr))
          (then (local.set $data (call $g2w (i32.load (local.get $hdr))))))))
    (i32.store (global.get $reg_base)
      (call $host_midi_header (local.get $arg0) (local.get $hdr)
        (local.get $arg1) (local.get $data) (local.get $arg2) (i32.const 2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; joyGetPos(uJoyID, lpInfo) — Win98 accepts IDs 0..15 and requires an
  ;; output JOYINFO pointer. A well-formed request reaches the absent device.
  (func $handle_joyGetPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or
          (i32.gt_u (local.get $arg0) (i32.const 15))
          (i32.eqz (local.get $arg1)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 11)))  ;; MMSYSERR_INVALPARAM
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 167)))  ;; JOYERR_UNPLUGGED
    )
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; joyGetPosEx(uJoyID, lpInfo) — Win98 accepts IDs 0..15 and requires the
  ;; caller to initialize the 52-byte JOYINFOEX version and request flags.
  (func $handle_joyGetPosEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.gt_u (local.get $arg0) (i32.const 15))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 2)))  ;; MMSYSERR_BADDEVICEID
      (else
        (if (i32.eqz (local.get $arg1))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 11)))  ;; MMSYSERR_INVALPARAM
          (else
            (if (i32.or
                  (i32.ne (i32.load (local.get $arg1)) (i32.const 52))
                  (i32.eqz (i32.load offset=4 (local.get $arg1))))
              (then (i32.store offset=0 (global.get $reg_base) (i32.const 11)))  ;; MMSYSERR_INVALPARAM
              (else (i32.store offset=0 (global.get $reg_base) (i32.const 167)))  ;; JOYERR_UNPLUGGED
            )
          )
        )
      )
    )
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; joyGetNumDevs() — 0 args, return 0 (no joysticks)
  (func $handle_joyGetNumDevs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; joyGetDevCapsA(uJoyID, lpCaps, cbCaps) — Win98 accepts IDs -1 and 0..15,
  ;; requires lpCaps, and ignores an unusual cbCaps value. A well-formed probe
  ;; reports no driver so legacy games retain keyboard/mouse input.
  (func $handle_joyGetDevCapsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or
          (i32.eqz (local.get $arg1))
          (i32.and
            (i32.ne (local.get $arg0) (i32.const -1))
            (i32.gt_u (local.get $arg0) (i32.const 15))))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 11)))  ;; MMSYSERR_INVALPARAM
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 6)))  ;; MMSYSERR_NODRIVER
    )
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; joySetCapture(hwnd, uJoyID, period, changed) — 4 args. Win98 supports
  ;; joystick IDs 0..15 and rejects a NULL notification window before trying
  ;; the (absent) joystick driver.
  (func $handle_joySetCapture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or
          (i32.eqz (local.get $arg0))
          (i32.gt_u (local.get $arg1) (i32.const 15)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 11)))  ;; MMSYSERR_INVALPARAM
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 167)))  ;; JOYERR_UNPLUGGED
    )
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; joyReleaseCapture(uJoyID) is harmless when no capture exists, but Win98
  ;; still rejects IDs outside its documented JOYSTICKID1..15 range.
  (func $handle_joyReleaseCapture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.le_u (local.get $arg0) (i32.const 15))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))  ;; JOYERR_NOERROR
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 11)))) ;; MMSYSERR_INVALPARAM
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; SetProcessWorkingSetSize(hProcess, min, max). Fixed WASM memory cannot be
  ;; paged by the host OS, so a well-formed request is advisory. Still validate
  ;; the process and documented size relationship before reporting success.
  (func $handle_SetProcessWorkingSetSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (call $current_process_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    ;; SIZE_T(-1), SIZE_T(-1) is the documented trim-working-set request.
    (if (i32.and
          (i32.eq (local.get $arg1) (i32.const -1))
          (i32.eq (local.get $arg2) (i32.const -1)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)) (return)))
    ;; Otherwise minimum must be positive and no greater than maximum; the
    ;; maximum itself must cover at least the documented thirteen 4 KiB pages.
    (if (i32.or
          (i32.or
            (i32.eqz (local.get $arg1))
            (i32.lt_u (local.get $arg2) (i32.const 0x0000d000)))
          (i32.or
            (i32.eq (local.get $arg1) (i32.const -1))
            (i32.or
              (i32.eq (local.get $arg2) (i32.const -1))
              (i32.gt_u (local.get $arg1) (local.get $arg2)))))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)) ;; TRUE: advisory request accepted
  )

  ;; GetProcessWorkingSetSize(hProcess, *min, *max) — report the fixed guest
  ;; address-space budget. The values are advisory; callers such as Unreal 1
  ;; only use them for startup diagnostics before requesting their own limits.
  (func $handle_GetProcessWorkingSetSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (i32.store (call $g2w (local.get $arg1)) (i32.const 0x00100000))))
    (if (local.get $arg2)
      (then (i32.store (call $g2w (local.get $arg2)) (i32.const 0x10000000))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))  ;; TRUE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 853: waveInOpen(lphWaveIn, device, format, callback, instance, flags)
  (func $handle_waveInOpen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $fmt_wa i32) (local $rate i32) (local $ch i32) (local $bits i32)
    (local $flags i32) (local $cbType i32) (local $handle i32)
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    ;; WAVE_FORMAT_QUERY validates only and must not acquire microphone access.
    (if (i32.and (local.get $flags) (i32.const 1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (local.set $fmt_wa (call $g2w (local.get $arg2)))
    (local.set $rate (i32.load offset=4 (local.get $fmt_wa)))
    (local.set $ch (i32.load16_u offset=2 (local.get $fmt_wa)))
    (local.set $bits (i32.load16_u offset=14 (local.get $fmt_wa)))
    (local.set $cbType (i32.and (i32.shr_u (local.get $flags) (i32.const 16)) (i32.const 7)))
    (local.set $handle (call $host_wave_in_open
      (local.get $rate) (local.get $ch) (local.get $bits)
      (local.get $arg3) (local.get $arg4) (local.get $cbType)))
    (if (local.get $arg0)
      (then (call $gs32 (local.get $arg0) (local.get $handle))))
    (if (i32.eq (local.get $cbType) (i32.const 1))
      (then
        (drop (call $post_queue_push
          (local.get $arg3) (i32.const 0x03BE) (local.get $handle) (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; 854: waveInClose
  (func $handle_waveInClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $host_wave_in_close (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 855: waveInStart
  (func $handle_waveInStart (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_wave_in_start (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 856: waveInStop
  (func $handle_waveInStop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_wave_in_stop (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 857: waveInReset
  (func $handle_waveInReset (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_wave_in_reset (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 858: waveInPrepareHeader — set WHDR_PREPARED
  (func $handle_waveInPrepareHeader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (i32.store offset=16 (local.get $wa)
      (i32.or (i32.load offset=16 (local.get $wa)) (i32.const 2)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 859: waveInUnprepareHeader — clear PREPARED/INQUEUE, retain DONE
  (func $handle_waveInUnprepareHeader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (i32.store offset=16 (local.get $wa)
      (i32.and (i32.load offset=16 (local.get $wa)) (i32.const 0xFFFFFFED)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 860: waveInAddBuffer — queue the guest WAVEHDR for capture
  (func $handle_waveInAddBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $data_ga i32) (local $length i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $data_ga (i32.load (local.get $wa)))
    (local.set $length (i32.load offset=4 (local.get $wa)))
    (i32.store offset=8 (local.get $wa) (i32.const 0))
    (i32.store offset=16 (local.get $wa)
      (i32.or
        (i32.and (i32.load offset=16 (local.get $wa)) (i32.const 0xFFFFFFFE))
        (i32.const 0x12))) ;; PREPARED | INQUEUE
    (i32.store offset=0 (global.get $reg_base) (call $host_wave_in_add_buffer
      (local.get $arg0) (local.get $wa) (local.get $arg1)
      (call $g2w (local.get $data_ga)) (local.get $length)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 861: waveInGetNumDevs — return 1 (one input device)
  (func $handle_waveInGetNumDevs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; Capture-device validation remains separate from the common bounded writer.
  (func $wave_in_dev_caps (param $device i32) (param $caps_g i32) (param $cb i32) (param $wide i32) (result i32)
    (if (local.get $device)
      (then (return (i32.const 2)))) ;; MMSYSERR_BADDEVICEID
    (call $wave_dev_caps_fill (local.get $caps_g) (local.get $cb) (local.get $wide) (i32.const 1)))

  (func $handle_waveInGetDevCapsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wave_in_dev_caps
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_waveInGetDevCapsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wave_in_dev_caps
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 1246: timeSetEvent(uDelay, uResolution, lpTimeProc, dwUser, fuEvent)
  ;; Returns timer ID (non-zero) on success, 0 on error
  (func $handle_timeSetEvent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tid i32) (local $i i32) (local $slot i32)
    ;; Take the first free slot. Windows lets a client hold several timers at
    ;; once and Smacker relies on it (periodic mixer + one-shot per buffer),
    ;; so evicting an existing timer here would silently kill a live one.
    (block $found (loop $scan
      (if (i32.ge_u (local.get $i) (global.get $MM_TIMER_MAX))
        (then
          ;; Out of slots — TIMERR_NOCANDO, reported as a 0 timer id.
          (i32.store offset=0 (global.get $reg_base) (i32.const 0))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
          (return)))
      (local.set $slot (call $mm_timer_slot (local.get $i)))
      (br_if $found (i32.eqz (i32.load (local.get $slot))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.set $tid (i32.load (global.get $MM_TIMER_NEXT_ID)))
    (if (i32.eqz (local.get $tid)) (then (local.set $tid (i32.const 1))))
    (i32.store (global.get $MM_TIMER_NEXT_ID) (i32.add (local.get $tid) (i32.const 1)))
    (i32.store          (local.get $slot) (local.get $tid))
    (i32.store offset=4 (local.get $slot) (local.get $arg0))
    (i32.store offset=8 (local.get $slot) (local.get $arg2))
    (i32.store offset=12 (local.get $slot) (local.get $arg3))
    (i32.store offset=16 (local.get $slot) (call $host_get_ticks))
    ;; +20: bit 0 = one-shot (TIME_PERIODIC clear); bits 0x10/0x20 keep
    ;; TIME_CALLBACK_EVENT_SET/_PULSE, where lpTimeProc is an event HANDLE to
    ;; signal, never code ($mm_timer_due_slot). Collapse! Crunch's timer
    ;; thread jumped to its event handle 0xE0000 and died with 0xC000DE05.
    (i32.store offset=20 (local.get $slot)
      (i32.or
        (i32.eqz (i32.and (local.get $arg4) (i32.const 1)))
        (i32.and (local.get $arg4) (i32.const 0x30))))
    (call $mm_timer_thread_ensure)
    (i32.store offset=0 (global.get $reg_base) (local.get $tid))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 1247: timeKillEvent(uTimerID)
  ;; Returns TIMERR_NOERROR (0) if found, MMSYSERR_INVALPARAM (11) if not
  (func $handle_timeKillEvent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32)
    (local.set $slot (call $mm_timer_find (local.get $arg0)))
    (if (local.get $slot)
      (then
        (i32.store (local.get $slot) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.const 11))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; --- BASS 2.x PCM compatibility --------------------------------------
  ;; Pocket Tanks 1.6 loads its effects through BASS_SampleLoad and then
  ;; obtains short-lived HCHANNELs. These are real, typed handles backed by the
  ;; shared host VoiceManager; tracker music and compressed streams remain
  ;; truthful failures until the emulator has decoders for those formats.
  ;;
  ;; BASS_STATE layout:
  ;;   +0 initialized, +4 output started, +8 global sample volume (0..10000)
  ;;   +12 sample generation, +16 channel generation, +20 play serial
  ;;   +24 config 5, +28 config 6, +32 init frequency
  ;;   +0x40 sixteen per-thread BASS error dwords
  ;;   +0x80 64 Sample records (40 bytes)
  ;;   +0xA80 128 Channel records (28 bytes)
  ;; Sample:  handle, allocation, PCM guest ptr/len, rate, chans, bits, max, flags
  ;; Channel: handle, sample, host voice, byte position, state, serial, volume
  (global $BASS_STATE i32 (region.addr $BASS_STATE 0))
  (global $BASS_STATE_SIZE i32 (i32.const 0x1900))
  (global $BASS_SAMPLE_MAX i32 (i32.const 64))
  (global $BASS_CHANNEL_MAX i32 (i32.const 128))
  (global $BASS_SAMPLE_STRIDE i32 (i32.const 40))
  (global $BASS_CHANNEL_STRIDE i32 (i32.const 28))

  (func $bass_error_addr (result i32)
    (local $slot i32)
    (local.set $slot (i32.sub (global.get $current_thread_id) (i32.const 1)))
    (if (i32.ge_u (local.get $slot) (i32.const 16))
      (then (local.set $slot (i32.const 0))))
    (i32.add (global.get $BASS_STATE)
      (i32.add (i32.const 0x40) (i32.shl (local.get $slot) (i32.const 2)))))

  (func $bass_set_error (param $error i32)
    (i32.store (call $bass_error_addr) (local.get $error)))

  (func $bass_sample_addr (param $slot i32) (result i32)
    (i32.add (global.get $BASS_STATE)
      (i32.add (i32.const 0x80)
        (i32.mul (local.get $slot) (global.get $BASS_SAMPLE_STRIDE)))))

  (func $bass_channel_addr (param $slot i32) (result i32)
    (i32.add (global.get $BASS_STATE)
      (i32.add (i32.const 0xA80)
        (i32.mul (local.get $slot) (global.get $BASS_CHANNEL_STRIDE)))))

  ;; Exact-record equality is the generation check: freeing and reallocating a
  ;; slot produces a new handle, so a stale HSAMPLE/HCHANNEL cannot name its
  ;; replacement.
  (func $bass_sample_from_handle (param $handle i32) (result i32)
    (local $slot i32) (local $record i32)
    (if (i32.ne (i32.and (local.get $handle) (i32.const 0xFF000000))
                (i32.const 0xB1000000))
      (then (return (i32.const 0))))
    (local.set $slot (i32.sub (i32.and (local.get $handle) (i32.const 0xFF))
                             (i32.const 1)))
    (if (i32.ge_u (local.get $slot) (global.get $BASS_SAMPLE_MAX))
      (then (return (i32.const 0))))
    (local.set $record (call $bass_sample_addr (local.get $slot)))
    (if (i32.ne (i32.load (local.get $record)) (local.get $handle))
      (then (return (i32.const 0))))
    (local.get $record))

  (func $bass_channel_from_handle (param $handle i32) (result i32)
    (local $slot i32) (local $record i32)
    (if (i32.ne (i32.and (local.get $handle) (i32.const 0xFF000000))
                (i32.const 0xB2000000))
      (then (return (i32.const 0))))
    (local.set $slot (i32.sub (i32.and (local.get $handle) (i32.const 0xFF))
                             (i32.const 1)))
    (if (i32.ge_u (local.get $slot) (global.get $BASS_CHANNEL_MAX))
      (then (return (i32.const 0))))
    (local.set $record (call $bass_channel_addr (local.get $slot)))
    (if (i32.ne (i32.load (local.get $record)) (local.get $handle))
      (then (return (i32.const 0))))
    (local.get $record))

  (func $bass_next_handle (param $kind i32) (param $slot i32) (result i32)
    (local $seq_addr i32) (local $seq i32)
    (local.set $seq_addr (i32.add (global.get $BASS_STATE)
      (select (i32.const 16) (i32.const 12) (i32.eq (local.get $kind) (i32.const 2)))))
    (local.set $seq (i32.and (i32.add (i32.load (local.get $seq_addr)) (i32.const 1))
                            (i32.const 0xFFFF)))
    (if (i32.eqz (local.get $seq)) (then (local.set $seq (i32.const 1))))
    (i32.store (local.get $seq_addr) (local.get $seq))
    (i32.or
      (select (i32.const 0xB2000000) (i32.const 0xB1000000)
        (i32.eq (local.get $kind) (i32.const 2)))
      (i32.or (i32.shl (local.get $seq) (i32.const 8))
              (i32.add (local.get $slot) (i32.const 1)))))

  (func $bass_close_channel_record (param $record i32) (param $release i32)
    (local $voice i32)
    (local.set $voice (i32.load offset=8 (local.get $record)))
    (if (local.get $voice)
      (then
        (if (local.get $release)
          (then (drop (call $host_voice_close (local.get $voice))))
          (else (drop (call $host_voice_stop (local.get $voice)))))))
    (if (local.get $release)
      (then (call $zero_memory (local.get $record) (global.get $BASS_CHANNEL_STRIDE)))
      (else
        (i32.store offset=12 (local.get $record) (i32.const 0))
        (i32.store offset=16 (local.get $record) (i32.const 1)))))

  (func $bass_effective_volume (param $channel i32) (result i32)
    (i32.div_u
      (i32.mul (i32.load offset=24 (local.get $channel))
               (i32.load offset=8 (global.get $BASS_STATE)))
      (i32.const 10000)))

  (func $bass_start_channel (param $channel i32) (result i32)
    (local $sample i32) (local $voice i32)
    (local.set $sample
      (call $bass_sample_from_handle (i32.load offset=4 (local.get $channel))))
    (if (i32.eqz (local.get $sample)) (then (return (i32.const 0))))
    (local.set $voice (i32.load offset=8 (local.get $channel)))
    (if (i32.eqz (local.get $voice))
      (then
        (local.set $voice (call $host_voice_open
          (i32.load offset=16 (local.get $sample))
          (i32.load offset=20 (local.get $sample))
          (i32.load offset=24 (local.get $sample))))
        (if (i32.eqz (local.get $voice)) (then (return (i32.const 0))))
        (i32.store offset=8 (local.get $channel) (local.get $voice))))
    (call $host_voice_set_volume_linear
      (local.get $voice) (call $bass_effective_volume (local.get $channel)))
    (drop (call $host_voice_play_ring
      (local.get $voice)
      (call $g2w (i32.load offset=8 (local.get $sample)))
      (i32.load offset=12 (local.get $sample))
      (i32.load offset=12 (local.get $channel))
      (i32.ne (i32.and (i32.load offset=36 (local.get $sample)) (i32.const 4))
              (i32.const 0))))
    (i32.store offset=16 (local.get $channel) (i32.const 2))
    (i32.const 1))

  ;; Returns 1 for a bounded RIFF/WAVE PCM image and writes the raw PCM offset,
  ;; byte length, sample rate, channel count and bits/sample into out+0..16.
  (func $bass_parse_pcm_wave (param $data i32) (param $size i32) (param $out i32)
        (result i32)
    (local $riff_size i32) (local $limit i32) (local $off i32) (local $id i32) (local $chunk i32)
    (local $next i32) (local $fmt i32) (local $pcm i32) (local $rate i32)
    (local $channels i32) (local $bits i32) (local $align i32)
    (if (i32.lt_u (local.get $size) (i32.const 12)) (then (return (i32.const 0))))
    (if (i32.or
          (i32.ne (i32.load (local.get $data)) (i32.const 0x46464952))
          (i32.ne (i32.load offset=8 (local.get $data)) (i32.const 0x45564157)))
      (then (return (i32.const 0))))
    (local.set $riff_size (i32.load offset=4 (local.get $data)))
    (if (i32.or (i32.lt_u (local.get $riff_size) (i32.const 4))
                (i32.gt_u (local.get $riff_size) (i32.sub (local.get $size) (i32.const 8))))
      (then (return (i32.const 0))))
    (local.set $limit (i32.add (local.get $riff_size) (i32.const 8)))
    (local.set $off (i32.const 12))
    (block $done (loop $chunks
      (br_if $done (i32.gt_u (i32.add (local.get $off) (i32.const 8)) (local.get $limit)))
      (local.set $id (i32.load (i32.add (local.get $data) (local.get $off))))
      (local.set $chunk (i32.load (i32.add (local.get $data)
        (i32.add (local.get $off) (i32.const 4)))))
      (if (i32.gt_u (local.get $chunk)
                    (i32.sub (local.get $limit) (i32.add (local.get $off) (i32.const 8))))
        (then (return (i32.const 0))))
      (if (i32.eq (local.get $id) (i32.const 0x20746D66)) ;; "fmt "
        (then
          (if (i32.lt_u (local.get $chunk) (i32.const 16))
            (then (return (i32.const 0))))
          (local.set $fmt (i32.add (local.get $data)
            (i32.add (local.get $off) (i32.const 8))))
          (if (i32.ne (i32.load16_u (local.get $fmt)) (i32.const 1))
            (then (return (i32.const -1))))
          (local.set $channels (i32.load16_u offset=2 (local.get $fmt)))
          (local.set $rate (i32.load offset=4 (local.get $fmt)))
          (local.set $align (i32.load16_u offset=12 (local.get $fmt)))
          (local.set $bits (i32.load16_u offset=14 (local.get $fmt)))
          (if (i32.or
                (i32.or (i32.lt_u (local.get $channels) (i32.const 1))
                        (i32.gt_u (local.get $channels) (i32.const 2)))
                (i32.or (i32.lt_u (local.get $rate) (i32.const 1000))
                        (i32.gt_u (local.get $rate) (i32.const 192000))))
            (then (return (i32.const -1))))
          (if (i32.and (i32.ne (local.get $bits) (i32.const 8))
                       (i32.ne (local.get $bits) (i32.const 16)))
            (then (return (i32.const -1))))
          (if (i32.ne (local.get $align)
                (i32.mul (local.get $channels) (i32.div_u (local.get $bits) (i32.const 8))))
            (then (return (i32.const -1))))
          (local.set $pcm (i32.const 1))))
      (if (i32.eq (local.get $id) (i32.const 0x61746164)) ;; "data"
        (then
          (if (i32.eqz (local.get $chunk)) (then (return (i32.const -2))))
          (i32.store (local.get $out) (i32.add (local.get $off) (i32.const 8)))
          (i32.store offset=4 (local.get $out) (local.get $chunk))))
      (local.set $next (i32.add (i32.add (local.get $off) (i32.const 8))
        (i32.add (local.get $chunk) (i32.and (local.get $chunk) (i32.const 1)))))
      (br_if $done (i32.le_u (local.get $next) (local.get $off)))
      (if (i32.gt_u (local.get $next) (local.get $limit))
        (then (return (i32.const 0))))
      (local.set $off (local.get $next))
      (br $chunks)))
    (if (i32.or (i32.eqz (local.get $fmt))
                (i32.eqz (i32.load offset=4 (local.get $out))))
      (then (return (i32.const 0))))
    (i32.store offset=8 (local.get $out) (local.get $rate))
    (i32.store offset=12 (local.get $out) (local.get $channels))
    (i32.store offset=16 (local.get $out) (local.get $bits))
    (i32.const 1))

  (func $handle_BASS_Init (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.load (global.get $BASS_STATE))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (call $bass_set_error (i32.const 14))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.and (i32.ne (local.get $arg0) (i32.const -1))
                 (i32.gt_u (local.get $arg0) (i32.const 1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (call $bass_set_error (i32.const 23))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.or (i32.lt_u (local.get $arg1) (i32.const 8000))
                (i32.gt_u (local.get $arg1) (i32.const 192000)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (call $bass_set_error (i32.const 20))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (call $zero_memory (global.get $BASS_STATE) (global.get $BASS_STATE_SIZE))
    (i32.store (global.get $BASS_STATE) (i32.const 1))
    (i32.store offset=4 (global.get $BASS_STATE) (i32.const 1))
    (i32.store offset=8 (global.get $BASS_STATE) (i32.const 10000))
    (i32.store offset=32 (global.get $BASS_STATE) (local.get $arg1))
    (call $bass_set_error (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_BASS_PluginLoad (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg0))
      (then (call $bass_set_error (i32.const 20)))
      (else
        (local.set $handle (call $host_fs_create_file
          (call $g2w (local.get $arg0)) (i32.const 0x80000000)
          (i32.const 3) (i32.const 0x80) (i32.const 0)))
        (if (i32.eq (local.get $handle) (i32.const -1))
          (then (call $bass_set_error (i32.const 2)))
          (else
            (drop (call $host_fs_close_handle (local.get $handle)))
            (call $bass_set_error (i32.const 41))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_BASS_Start (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $channel i32)
    (if (i32.eqz (i32.load (global.get $BASS_STATE)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (call $bass_set_error (i32.const 8)))
      (else
        (i32.store offset=4 (global.get $BASS_STATE) (i32.const 1))
        (loop $resume
          (local.set $channel (call $bass_channel_addr (local.get $i)))
          (if (i32.eq (i32.load offset=16 (local.get $channel)) (i32.const 2))
            (then (drop (call $bass_start_channel (local.get $channel)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $resume (i32.lt_u (local.get $i) (global.get $BASS_CHANNEL_MAX))))
        (call $bass_set_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_BASS_SetConfig (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $channel i32) (local $voice i32)
    (if (i32.eqz (i32.load (global.get $BASS_STATE)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (call $bass_set_error (i32.const 8))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eq (local.get $arg0) (i32.const 4))
      (then
        (if (i32.gt_u (local.get $arg1) (i32.const 10000))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (call $bass_set_error (i32.const 20))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))
        (i32.store offset=8 (global.get $BASS_STATE) (local.get $arg1))
        (loop $volume
          (local.set $channel (call $bass_channel_addr (local.get $i)))
          (local.set $voice (i32.load offset=8 (local.get $channel)))
          (if (local.get $voice)
            (then (call $host_voice_set_volume_linear
              (local.get $voice) (call $bass_effective_volume (local.get $channel)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $volume (i32.lt_u (local.get $i) (global.get $BASS_CHANNEL_MAX)))))
      (else
        (if (i32.eq (local.get $arg0) (i32.const 5))
          (then (i32.store offset=24 (global.get $BASS_STATE) (local.get $arg1)))
          (else
            (if (i32.eq (local.get $arg0) (i32.const 6))
              (then (i32.store offset=28 (global.get $BASS_STATE) (local.get $arg1)))
              (else
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (call $bass_set_error (i32.const 20))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
                (return)))))))
    (call $bass_set_error (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; BASS_SampleLoad(mem, file, offset:QWORD, length, max, flags) -> HSAMPLE.
  ;; The VFS bytes are copied into an owned heap block before validation; host
  ;; playback receives only the bounded raw PCM subrange inside that copy.
  (func $handle_BASS_SampleLoad (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $max i32) (local $flags i32) (local $handle i32) (local $file_size i32)
    (local $size i32) (local $blk i32) (local $data_guest i32) (local $data i32)
    (local $ok i32) (local $parse i32) (local $out i32) (local $i i32)
    (local $record i32) (local $sample_handle i32) (local $parked i32)
    (call $lazy_park_release)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (local.set $max (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (if (i32.or (i32.ne (local.get $arg0) (i32.const 0))
                  (i32.eqz (local.get $arg1)))
        (then (call $bass_set_error (i32.const 20)) (br $done)))
      (if (i32.or (i32.eqz (local.get $max))
                  (i32.gt_u (local.get $max) (global.get $BASS_CHANNEL_MAX)))
        (then (call $bass_set_error (i32.const 20)) (br $done)))
      (if (local.get $arg3)
        (then (call $bass_set_error (i32.const 20)) (br $done)))
      (local.set $handle (call $host_fs_create_file
        (call $g2w (local.get $arg1)) (i32.const 0x80000000)
        (i32.const 3) (i32.const 0x80) (i32.const 0)))
      (if (i32.eq (local.get $handle) (i32.const -1))
        (then (call $bass_set_error (i32.const 2)) (br $done)))
      (local.set $file_size (call $host_fs_get_file_size (local.get $handle)))
      (if (i32.or (i32.eq (local.get $file_size) (i32.const -1))
                  (i32.gt_u (local.get $arg2) (local.get $file_size)))
        (then
          (drop (call $host_fs_close_handle (local.get $handle)))
          (call $bass_set_error (i32.const 20)) (br $done)))
      (local.set $size (select (local.get $arg4)
        (i32.sub (local.get $file_size) (local.get $arg2))
        (i32.ne (local.get $arg4) (i32.const 0))))
      (if (i32.or
            (i32.or (i32.lt_u (local.get $size) (i32.const 12))
                    (i32.gt_u (local.get $size) (i32.const 0x01000000)))
            (i32.gt_u (local.get $size) (i32.sub (local.get $file_size) (local.get $arg2))))
        (then
          (drop (call $host_fs_close_handle (local.get $handle)))
          (call $bass_set_error (i32.const 41)) (br $done)))
      (drop (call $host_fs_set_file_pointer (local.get $handle) (local.get $arg2) (i32.const 0)))
      (local.set $blk (call $heap_alloc (i32.add (local.get $size) (i32.const 24))))
      (if (i32.eqz (local.get $blk))
        (then
          (drop (call $host_fs_close_handle (local.get $handle)))
          (call $bass_set_error (i32.const 1)) (br $done)))
      (local.set $data_guest (i32.add (local.get $blk) (i32.const 24)))
      (i32.store (call $g2w (local.get $blk)) (i32.const 0))
      (local.set $ok (call $host_fs_read_file
        (local.get $handle) (local.get $data_guest) (local.get $size) (local.get $blk)))
      ;; A streamed sample file not resident yet: park on IO_WAIT and rerun
      ;; once the host has the bytes, as _lread and PlaySound do. Ask before
      ;; the close, which clears the pending-read state.
      (if (i32.eqz (local.get $ok))
        (then
          (if (i32.eq (call $host_fs_read_pending) (i32.const 1))
            (then (local.set $parked (i32.const 1))))))
      ;; A parked read keeps its handle open for the host fill ($lazy_park_hold).
      (if (local.get $parked)
        (then (call $lazy_park_hold (local.get $handle)))
        (else (drop (call $host_fs_close_handle (local.get $handle)))))
      (if (local.get $parked)
        (then
          (call $heap_free (local.get $blk))
          (br $done)))
      (if (i32.or (i32.eqz (local.get $ok))
                  (i32.ne (i32.load (call $g2w (local.get $blk))) (local.get $size)))
        (then
          (call $heap_free (local.get $blk))
          (call $bass_set_error (i32.const 2)) (br $done)))
      (local.set $data (call $g2w (local.get $data_guest)))
      (local.set $out (i32.add (local.get $data) (i32.const -20)))
      (local.set $parse (call $bass_parse_pcm_wave
        (local.get $data) (local.get $size) (local.get $out)))
      (if (i32.ne (local.get $parse) (i32.const 1))
        (then
          (call $heap_free (local.get $blk))
          (call $bass_set_error
            (select
              (select (i32.const 31) (i32.const 6)
                (i32.eq (local.get $parse) (i32.const -2)))
              (i32.const 41)
              (i32.ne (local.get $parse) (i32.const 0))))
          (br $done)))
      (block $found (loop $slots
        (local.set $record (call $bass_sample_addr (local.get $i)))
        (br_if $found (i32.eqz (i32.load (local.get $record))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $slots (i32.lt_u (local.get $i) (global.get $BASS_SAMPLE_MAX)))))
      (if (i32.ge_u (local.get $i) (global.get $BASS_SAMPLE_MAX))
        (then
          (call $heap_free (local.get $blk))
          (call $bass_set_error (i32.const 1)) (br $done)))
      (local.set $sample_handle (call $bass_next_handle (i32.const 1) (local.get $i)))
      (i32.store (local.get $record) (local.get $sample_handle))
      (i32.store offset=4 (local.get $record) (local.get $blk))
      (i32.store offset=8 (local.get $record)
        (i32.add (local.get $data_guest) (i32.load (local.get $out))))
      (i32.store offset=12 (local.get $record) (i32.load offset=4 (local.get $out)))
      (i32.store offset=16 (local.get $record) (i32.load offset=8 (local.get $out)))
      (i32.store offset=20 (local.get $record) (i32.load offset=12 (local.get $out)))
      (i32.store offset=24 (local.get $record) (i32.load offset=16 (local.get $out)))
      (i32.store offset=28 (local.get $record) (local.get $max))
      (i32.store offset=36 (local.get $record) (local.get $flags))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (local.get $sample_handle)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
    (if (local.get $parked) (then (call $io_block (i32.const 32)))))

  (func $handle_BASS_SampleGetChannel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sample i32) (local $i i32) (local $channel i32) (local $free i32)
    (local $count i32) (local $oldest i32) (local $old_serial i32)
    (local $handle i32) (local $voice i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (local.set $sample (call $bass_sample_from_handle (local.get $arg0)))
      (if (i32.eqz (local.get $sample))
        (then (call $bass_set_error (i32.const 5)) (br $done)))
      (loop $scan
        (local.set $channel (call $bass_channel_addr (local.get $i)))
        (if (i32.eqz (i32.load (local.get $channel)))
          (then (if (i32.eqz (local.get $free)) (then (local.set $free (local.get $channel)))))
          (else
            ;; Reap completed one-shots before enforcing this sample's max.
            (if (i32.and
                  (i32.eq (i32.load offset=16 (local.get $channel)) (i32.const 2))
                  (i32.and
                    (i32.ne (i32.load offset=8 (local.get $channel)) (i32.const 0))
                    (i32.and
                      (i32.ne (i32.load offset=4 (global.get $BASS_STATE)) (i32.const 0))
                      (i32.eqz (call $host_voice_is_playing
                        (i32.load offset=8 (local.get $channel)))))))
              (then
                (call $bass_close_channel_record (local.get $channel) (i32.const 1))
                (if (i32.eqz (local.get $free)) (then (local.set $free (local.get $channel))))))
            (if (i32.eq (i32.load offset=4 (local.get $channel)) (local.get $arg0))
              (then
                (local.set $count (i32.add (local.get $count) (i32.const 1)))
                (if (i32.or (i32.eqz (local.get $oldest))
                            (i32.lt_u (i32.load offset=20 (local.get $channel)) (local.get $old_serial)))
                  (then
                    (local.set $oldest (local.get $channel))
                    (local.set $old_serial (i32.load offset=20 (local.get $channel)))))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $scan (i32.lt_u (local.get $i) (global.get $BASS_CHANNEL_MAX))))
      (if (i32.ge_u (local.get $count) (i32.load offset=28 (local.get $sample)))
        (then
          (if (local.get $arg1)
            (then (call $bass_set_error (i32.const 18)) (br $done)))
          (local.set $free (local.get $oldest))
          (call $bass_close_channel_record (local.get $free) (i32.const 1))))
      (if (i32.eqz (local.get $free))
        (then (call $bass_set_error (i32.const 18)) (br $done)))
      (local.set $i (i32.div_u
        (i32.sub (local.get $free) (region.addr $BASS_STATE 0xA80))
        (global.get $BASS_CHANNEL_STRIDE)))
      (local.set $handle (call $bass_next_handle (i32.const 2) (local.get $i)))
      (i32.store (local.get $free) (local.get $handle))
      (i32.store offset=4 (local.get $free) (local.get $arg0))
      (i32.store offset=16 (local.get $free) (i32.const 1))
      (i32.store offset=20 (local.get $free)
        (i32.add (i32.load offset=20 (global.get $BASS_STATE)) (i32.const 1)))
      (i32.store offset=20 (global.get $BASS_STATE)
        (i32.load offset=20 (local.get $free)))
      (i32.store offset=24 (local.get $free) (i32.const 65535))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (local.get $handle)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_BASS_SampleStop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sample i32) (local $i i32) (local $channel i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (local.set $sample (call $bass_sample_from_handle (local.get $arg0)))
      (if (i32.eqz (local.get $sample))
        (then (call $bass_set_error (i32.const 5)) (br $done)))
      (loop $stop
        (local.set $channel (call $bass_channel_addr (local.get $i)))
        (if (i32.eq (i32.load offset=4 (local.get $channel)) (local.get $arg0))
          (then (call $bass_close_channel_record (local.get $channel) (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $stop (i32.lt_u (local.get $i) (global.get $BASS_CHANNEL_MAX))))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_BASS_SampleFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sample i32) (local $i i32) (local $channel i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (local.set $sample (call $bass_sample_from_handle (local.get $arg0)))
      (if (i32.eqz (local.get $sample))
        (then (call $bass_set_error (i32.const 5)) (br $done)))
      (loop $release
        (local.set $channel (call $bass_channel_addr (local.get $i)))
        (if (i32.eq (i32.load offset=4 (local.get $channel)) (local.get $arg0))
          (then (call $bass_close_channel_record (local.get $channel) (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $release (i32.lt_u (local.get $i) (global.get $BASS_CHANNEL_MAX))))
      (call $heap_free (i32.load offset=4 (local.get $sample)))
      (call $zero_memory (local.get $sample) (global.get $BASS_SAMPLE_STRIDE))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_BASS_ChannelPlay (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $channel i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (local.set $channel (call $bass_channel_from_handle (local.get $arg0)))
      (if (i32.eqz (local.get $channel))
        (then (call $bass_set_error (i32.const 5)) (br $done)))
      ;; restart=FALSE on an already-playing channel leaves its cursor alone.
      (if (i32.and (i32.eqz (local.get $arg1))
            (i32.and
              (i32.eq (i32.load offset=16 (local.get $channel)) (i32.const 2))
              (i32.and
                (i32.ne (i32.load offset=4 (global.get $BASS_STATE)) (i32.const 0))
                (i32.and
                  (i32.ne (i32.load offset=8 (local.get $channel)) (i32.const 0))
                  (i32.ne (call $host_voice_is_playing
                    (i32.load offset=8 (local.get $channel))) (i32.const 0))))))
        (then
          (call $bass_set_error (i32.const 0))
          (i32.store offset=0 (global.get $reg_base) (i32.const 1))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
          (return)))
      (if (local.get $arg1)
        (then
          (if (i32.load offset=8 (local.get $channel))
            (then (drop (call $host_voice_stop (i32.load offset=8 (local.get $channel))))))
          (i32.store offset=12 (local.get $channel) (i32.const 0))))
      (i32.store offset=16 (local.get $channel) (i32.const 2))
      (if (i32.load offset=4 (global.get $BASS_STATE))
        (then
          (if (i32.eqz (call $bass_start_channel (local.get $channel)))
            (then (call $bass_set_error (i32.const 3)) (br $done)))))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_BASS_ChannelPause (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $channel i32) (local $voice i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (local.set $channel (call $bass_channel_from_handle (local.get $arg0)))
      (if (i32.eqz (local.get $channel))
        (then (call $bass_set_error (i32.const 5)) (br $done)))
      (if (i32.ne (i32.load offset=16 (local.get $channel)) (i32.const 2))
        (then (call $bass_set_error (i32.const 24)) (br $done)))
      (local.set $voice (i32.load offset=8 (local.get $channel)))
      (if (local.get $voice)
        (then
          (i32.store offset=12 (local.get $channel) (call $host_voice_get_pos (local.get $voice)))
          (drop (call $host_voice_stop (local.get $voice)))))
      (i32.store offset=16 (local.get $channel) (i32.const 3))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_BASS_ChannelStop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $channel i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (local.set $channel (call $bass_channel_from_handle (local.get $arg0)))
      (if (i32.eqz (local.get $channel))
        (then (call $bass_set_error (i32.const 5)) (br $done)))
      (call $bass_close_channel_record (local.get $channel) (i32.const 0))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_BASS_ChannelSetPosition (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $channel i32) (local $sample i32) (local $was_playing i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (local.set $channel (call $bass_channel_from_handle (local.get $arg0)))
      (if (i32.eqz (local.get $channel))
        (then (call $bass_set_error (i32.const 5)) (br $done)))
      (local.set $sample (call $bass_sample_from_handle (i32.load offset=4 (local.get $channel))))
      (if (i32.or (i32.or (local.get $arg2) (local.get $arg3))
                  (i32.gt_u (local.get $arg1) (i32.load offset=12 (local.get $sample))))
        (then (call $bass_set_error (i32.const 7)) (br $done)))
      (local.set $was_playing
        (i32.eq (i32.load offset=16 (local.get $channel)) (i32.const 2)))
      (if (i32.load offset=8 (local.get $channel))
        (then (drop (call $host_voice_stop (i32.load offset=8 (local.get $channel))))))
      (i32.store offset=12 (local.get $channel) (local.get $arg1))
      (if (i32.and (local.get $was_playing)
                   (i32.ne (i32.load offset=4 (global.get $BASS_STATE)) (i32.const 0)))
        (then (drop (call $bass_start_channel (local.get $channel)))))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_BASS_ChannelSetAttribute (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $channel i32) (local $value f32) (local $volume i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (i32.load (global.get $BASS_STATE)))
        (then (call $bass_set_error (i32.const 8)) (br $done)))
      (local.set $channel (call $bass_channel_from_handle (local.get $arg0)))
      (if (i32.eqz (local.get $channel))
        (then (call $bass_set_error (i32.const 5)) (br $done)))
      (local.set $value (f32.reinterpret_i32 (local.get $arg2)))
      (if (i32.or (i32.ne (local.get $arg1) (i32.const 2))
                  (i32.eqz (i32.and (f32.ge (local.get $value) (f32.const 0))
                                    (f32.le (local.get $value) (f32.const 1)))))
        (then (call $bass_set_error (i32.const 20)) (br $done)))
      (local.set $volume
        (i32.trunc_sat_f32_u (f32.mul (local.get $value) (f32.const 65535))))
      (i32.store offset=24 (local.get $channel) (local.get $volume))
      (if (i32.load offset=8 (local.get $channel))
        (then (call $host_voice_set_volume_linear
          (i32.load offset=8 (local.get $channel))
          (call $bass_effective_volume (local.get $channel)))))
      (call $bass_set_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Compressed streams and tracker modules are deliberately unavailable: a
  ;; nonzero token would promise audio that this build cannot decode.
  (func $handle_BASS_StreamCreateFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $bass_set_error (select (i32.const 41) (i32.const 8)
      (i32.ne (i32.load (global.get $BASS_STATE)) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_BASS_MusicLoad (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $bass_set_error (select (i32.const 41) (i32.const 8)
      (i32.ne (i32.load (global.get $BASS_STATE)) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_BASS_StreamFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $bass_set_error (select (i32.const 5) (i32.const 8)
      (i32.ne (i32.load (global.get $BASS_STATE)) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_BASS_MusicFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $bass_set_error (select (i32.const 5) (i32.const 8)
      (i32.ne (i32.load (global.get $BASS_STATE)) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $bass_pause_all
    (local $i i32) (local $channel i32) (local $voice i32)
    (loop $pause
      (local.set $channel (call $bass_channel_addr (local.get $i)))
      (if (i32.eq (i32.load offset=16 (local.get $channel)) (i32.const 2))
        (then
          (local.set $voice (i32.load offset=8 (local.get $channel)))
          (if (local.get $voice)
            (then
              (i32.store offset=12 (local.get $channel)
                (call $host_voice_get_pos (local.get $voice)))
              (drop (call $host_voice_stop (local.get $voice)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $pause (i32.lt_u (local.get $i) (global.get $BASS_CHANNEL_MAX)))))

  (func $handle_BASS_Pause (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (i32.load (global.get $BASS_STATE)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (call $bass_set_error (i32.const 8)))
      (else
        (call $bass_pause_all)
        (i32.store offset=4 (global.get $BASS_STATE) (i32.const 0))
        (call $bass_set_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_BASS_Stop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $channel i32)
    (if (i32.eqz (i32.load (global.get $BASS_STATE)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (call $bass_set_error (i32.const 8)))
      (else
        (loop $stop
          (local.set $channel (call $bass_channel_addr (local.get $i)))
          (if (i32.load (local.get $channel))
            (then (call $bass_close_channel_record (local.get $channel) (i32.const 0))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $stop (i32.lt_u (local.get $i) (global.get $BASS_CHANNEL_MAX))))
        (i32.store offset=4 (global.get $BASS_STATE) (i32.const 0))
        (call $bass_set_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_BASS_ErrorGetCode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.load (call $bass_error_addr)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_BASS_Free (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $record i32)
    (if (i32.eqz (i32.load (global.get $BASS_STATE)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (call $bass_set_error (i32.const 8)))
      (else
        (loop $channels
          (local.set $record (call $bass_channel_addr (local.get $i)))
          (if (i32.load (local.get $record))
            (then (call $bass_close_channel_record (local.get $record) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $channels (i32.lt_u (local.get $i) (global.get $BASS_CHANNEL_MAX))))
        (local.set $i (i32.const 0))
        (loop $samples
          (local.set $record (call $bass_sample_addr (local.get $i)))
          (if (i32.load (local.get $record))
            (then (call $heap_free (i32.load offset=4 (local.get $record)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $samples (i32.lt_u (local.get $i) (global.get $BASS_SAMPLE_MAX))))
        (call $zero_memory (global.get $BASS_STATE) (global.get $BASS_STATE_SIZE))
        (call $bass_set_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
