  ;; ---- AVIFile (AVIFIL32): the RIFF 'AVI ' reader ----------------------
  ;;
  ;; AVIFileOpenA/AVIFileGetStream/AVIStreamOpenFromFileA and the AVIStream*
  ;; read side, over a WAT parse of the file: 'hdrl' for the stream headers
  ;; and formats, 'idx1' (or, without one, a scan of 'movi') for where every
  ;; chunk is. Chunk bytes are read on demand with positional reads straight
  ;; into the caller's buffer. See docs/video-support-design.md.
  ;;
  ;; A read on a provider-backed file that is not resident yet parks the call
  ;; ($io_block) and the whole API call runs again; every handler here is
  ;; written to be restartable, freeing what it allocated before it parks.
  ;;
  ;; $AVI_TABLE:
  ;;   +0x000  file records, $AVI_FILES x 32
  ;;   +0x100  stream records, $AVI_STREAMS x 32
  ;;   +0x500  hdrl parse scratch, $AVIF_MAX_STREAMS x 16 {strh, strf, strf len}
  ;;   +0x580  AVISTREAMINFOA being built (140 bytes)
  ;;
  ;; file record:   +0 refs  +4 host handle  +8 stream count  +12 workspace wa
  ;;                +16 guest object +20 owned memory bytes +24 memory size
  ;; stream record: +0 refs  +4 file slot  +8 stream index  +12 guest object
  ;;
  ;; A file's workspace ($dib_alloc) is $AVIF_MAX_STREAMS stream blocks of
  ;; $AVI_SBLOCK bytes, then each stream's data-chunk and palette-change
  ;; tables, 16 bytes an entry {file offset of the data, size, idx1 flags, aux}.
  ;; aux is the running byte total for a data entry, and for a palette change
  ;; the number of data entries before it (the sample it applies from).
  ;;
  ;; stream block: +0x00 strh (56 bytes)  +0x40 format length
  ;;   +0x44 data table wa  +0x48 data count  +0x4C pc table wa  +0x50 pc count
  ;;   +0x54 samples  +0x58 bytes per sample (0 = one chunk per sample)
  ;;   +0x5C total bytes  +0x60 largest chunk  +0x80 format (<= 4 KB)
  (global $AVI_TABLE i32 (region.addr $AVI_TABLE 0))
  (global $AVI_TABLE_SIZE i32 (region.size $AVI_TABLE))
  (global $AVI_FILES i32 (i32.const 8))
  (global $AVI_STREAMS i32 (i32.const 32))
  (global $AVIF_MAX_STREAMS i32 (i32.const 8))
  (global $AVI_SBLOCK i32 (i32.const 0x1080))
  (global $AVI_FORMAT_MAX i32 (i32.const 0x1000))

  (global $AVI_MAGIC_FILE i32 (i32.const 0x46495641))     ;; 'AVIF'
  (global $AVI_MAGIC_STREAM i32 (i32.const 0x53495641))   ;; 'AVIS'

  (global $AVIERR_BADFORMAT i32 (i32.const 0x80044066))
  (global $AVIERR_MEMORY i32 (i32.const 0x80044067))
  (global $AVIERR_BADFLAGS i32 (i32.const 0x80044069))
  (global $AVIERR_BADPARAM i32 (i32.const 0x8004406A))
  (global $AVIERR_BADHANDLE i32 (i32.const 0x8004406C))
  (global $AVIERR_FILEREAD i32 (i32.const 0x8004406D))
  (global $AVIERR_FILEOPEN i32 (i32.const 0x8004406F))
  (global $AVIERR_NODATA i32 (i32.const 0x80044073))
  (global $AVIERR_BUFFERTOOSMALL i32 (i32.const 0x80044074))

  ;; $avi_read's "the file is not resident yet, park and retry".
  (global $AVI_PENDING i32 (i32.const -2))

  (func $avi_file_rec (param $slot i32) (result i32)
    (i32.add (region.addr $AVI_TABLE 0) (i32.shl (local.get $slot) (i32.const 5))))
  (func $avi_stream_rec (param $slot i32) (result i32)
    (i32.add (region.addr $AVI_TABLE 0x100) (i32.shl (local.get $slot) (i32.const 5))))

  (func $avi_dib_wa (param $ga i32) (result i32)
    (i32.add (global.get $DIB_BACKING_BASE) (i32.sub (local.get $ga) (global.get $DIB_GUEST_BASE))))

  ;; A memory-backed source (an "AVI" resource already mapped in the guest
  ;; image, for the Animate control) has handle $AVI_MEM_TAG|slot in place of
  ;; a host file handle; its bytes are the guest range at file record +20
  ;; (address) / +24 (length).
  (global $AVI_MEM_TAG i32 (i32.const 0x4D454D00))
  (func $avi_is_mem_handle (param $h i32) (result i32)
    (i32.eq (i32.and (local.get $h) (i32.const 0xFFFFFF00)) (global.get $AVI_MEM_TAG)))

  ;; Guest-to-guest copy that re-translates at every 4KB page boundary on
  ;; either side, since adjacent guest pages need not be adjacent in WASM.
  (func $avi_mem_copy (param $dst i32) (param $src i32) (param $n i32)
    (local $k i32) (local $t i32)
    (block $done (loop $chunk
      (br_if $done (i32.le_s (local.get $n) (i32.const 0)))
      (local.set $k (i32.sub (i32.const 0x1000) (i32.and (local.get $src) (i32.const 0xFFF))))
      (local.set $t (i32.sub (i32.const 0x1000) (i32.and (local.get $dst) (i32.const 0xFFF))))
      (if (i32.lt_u (local.get $t) (local.get $k)) (then (local.set $k (local.get $t))))
      (if (i32.lt_u (local.get $n) (local.get $k)) (then (local.set $k (local.get $n))))
      (memory.copy (call $g2w (local.get $dst)) (call $g2w (local.get $src)) (local.get $k))
      (local.set $dst (i32.add (local.get $dst) (local.get $k)))
      (local.set $src (i32.add (local.get $src) (local.get $k)))
      (local.set $n (i32.sub (local.get $n) (local.get $k)))
      (br $chunk))))

  ;; Positional read into a guest buffer: bytes read, $AVI_PENDING, or -1.
  (func $avi_read (param $h i32) (param $pos i32) (param $ga i32) (param $n i32) (result i32)
    (local $nr i32) (local $err i32)
    (if (call $avi_is_mem_handle (local.get $h))
      (then
        (local.set $nr (call $avi_file_rec (i32.and (local.get $h) (i32.const 0xFF))))
        (local.set $err (i32.load offset=24 (local.get $nr)))
        (if (i32.ge_u (local.get $pos) (local.get $err)) (then (return (i32.const 0))))
        (local.set $err (i32.sub (local.get $err) (local.get $pos)))
        (if (i32.lt_u (local.get $err) (local.get $n)) (then (local.set $n (local.get $err))))
        (call $avi_mem_copy (local.get $ga)
          (i32.add (i32.load offset=20 (local.get $nr)) (local.get $pos)) (local.get $n))
        (return (local.get $n))))
    (local.set $nr (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $err (call $host_fs_read_file_at (local.get $h) (local.get $ga) (local.get $n)
      (local.get $nr) (local.get $pos) (i32.const 0)))
    (if (i32.eq (local.get $err) (i32.const 997)) (then (return (global.get $AVI_PENDING))))
    (if (i32.and (i32.ne (local.get $err) (i32.const 0)) (i32.ne (local.get $err) (i32.const 38)))
      (then (return (i32.const -1))))
    (call $gl32 (local.get $nr)))

  ;; Two ASCII digits of a chunk id → stream number, or -1.
  (func $avi_ckid_stream (param $ckid i32) (result i32)
    (local $a i32) (local $b i32)
    (local.set $a (i32.sub (i32.and (local.get $ckid) (i32.const 0xFF)) (i32.const 0x30)))
    (local.set $b (i32.sub (i32.and (i32.shr_u (local.get $ckid) (i32.const 8)) (i32.const 0xFF)) (i32.const 0x30)))
    (if (i32.or (i32.gt_u (local.get $a) (i32.const 9)) (i32.gt_u (local.get $b) (i32.const 9)))
      (then (return (i32.const -1))))
    (i32.add (i32.mul (local.get $a) (i32.const 10)) (local.get $b)))

  (func $avi_is_pc (param $ckid i32) (result i32)
    (i32.eq (i32.shr_u (local.get $ckid) (i32.const 16)) (i32.const 0x6370)))   ;; 'pc'

  ;; ---- the parse ------------------------------------------------------
  ;; Walk hdrl's 'strl' lists into the scratch table; the stream count.
  (func $avi_scan_hdrl (param $p i32) (param $len i32) (result i32)
    (local $end i32) (local $id i32) (local $size i32) (local $n i32)
    (local $q i32) (local $qend i32) (local $sid i32) (local $ssize i32) (local $ent i32)
    (local.set $end (i32.add (local.get $p) (local.get $len)))
    (call $zero_memory (region.addr $AVI_TABLE 0x500) (i32.const 0x80))
    (block $done (loop $walk
      (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 8)) (local.get $end)))
      (local.set $id (i32.load (local.get $p)))
      (local.set $size (i32.load offset=4 (local.get $p)))
      (br_if $done (i32.gt_u (local.get $size) (i32.sub (local.get $end) (i32.add (local.get $p) (i32.const 8)))))
      (if (i32.and (i32.eq (local.get $id) (i32.const 0x5453494C))              ;; LIST
                   (i32.eq (i32.load offset=8 (local.get $p)) (i32.const 0x6C727473)))   ;; strl
        (then
          (if (i32.lt_u (local.get $n) (global.get $AVIF_MAX_STREAMS))
            (then
              (local.set $ent (i32.add (region.addr $AVI_TABLE 0x500) (i32.shl (local.get $n) (i32.const 4))))
              (local.set $q (i32.add (local.get $p) (i32.const 12)))
              (local.set $qend (i32.add (local.get $p) (i32.add (i32.const 8) (local.get $size))))
              (block $sdone (loop $sub
                (br_if $sdone (i32.gt_u (i32.add (local.get $q) (i32.const 8)) (local.get $qend)))
                (local.set $sid (i32.load (local.get $q)))
                (local.set $ssize (i32.load offset=4 (local.get $q)))
                (br_if $sdone (i32.gt_u (local.get $ssize)
                  (i32.sub (local.get $qend) (i32.add (local.get $q) (i32.const 8)))))
                (if (i32.and (i32.eq (local.get $sid) (i32.const 0x68727473))      ;; strh
                             (i32.ge_u (local.get $ssize) (i32.const 48)))
                  (then (i32.store (local.get $ent) (i32.add (local.get $q) (i32.const 8)))
                        (i32.store offset=12 (local.get $ent) (local.get $ssize))))
                (if (i32.eq (local.get $sid) (i32.const 0x66727473))               ;; strf
                  (then (i32.store offset=4 (local.get $ent) (i32.add (local.get $q) (i32.const 8)))
                        (i32.store offset=8 (local.get $ent) (local.get $ssize))))
                (local.set $q (i32.add (local.get $q) (i32.add (i32.const 8)
                  (i32.and (i32.add (local.get $ssize) (i32.const 1)) (i32.const -2)))))
                (br $sub)))
              (if (i32.load (local.get $ent)) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))))))
      (local.set $p (i32.add (local.get $p) (i32.add (i32.const 8)
        (i32.and (i32.add (local.get $size) (i32.const 1)) (i32.const -2)))))
      (br $walk)))
    (local.get $n))

  ;; No idx1: build one (absolute offsets) by reading the chunk headers of
  ;; 'movi', descending into 'rec ' lists. Returns entries, or a status < 0.
  (func $avi_scan_movi (param $h i32) (param $pos i32) (param $end i32)
                       (param $hdr_ga i32) (param $out_wa i32) (param $cap i32) (result i32)
    (local $r i32) (local $id i32) (local $size i32) (local $n i32) (local $e i32)
    (block $done (loop $walk
      (br_if $done (i32.gt_u (i32.add (local.get $pos) (i32.const 8)) (local.get $end)))
      (br_if $done (i32.ge_u (local.get $n) (local.get $cap)))
      (local.set $r (call $avi_read (local.get $h) (local.get $pos) (local.get $hdr_ga) (i32.const 12)))
      (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (return (global.get $AVI_PENDING))))
      (br_if $done (i32.lt_s (local.get $r) (i32.const 8)))
      (local.set $id (call $gl32 (local.get $hdr_ga)))
      (local.set $size (call $gl32 (i32.add (local.get $hdr_ga) (i32.const 4))))
      (if (i32.eq (local.get $id) (i32.const 0x5453494C))   ;; LIST 'rec ': step inside
        (then (local.set $pos (i32.add (local.get $pos) (i32.const 12))) (br $walk)))
      (local.set $e (i32.add (local.get $out_wa) (i32.shl (local.get $n) (i32.const 4))))
      (i32.store (local.get $e) (local.get $id))
      (i32.store offset=4 (local.get $e) (i32.const 0x10))   ;; every chunk a key frame
      (i32.store offset=8 (local.get $e) (local.get $pos))
      (i32.store offset=12 (local.get $e) (local.get $size))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (local.set $pos (i32.add (local.get $pos) (i32.add (i32.const 8)
        (i32.and (i32.add (local.get $size) (i32.const 1)) (i32.const -2)))))
      (br $walk)))
    (local.get $n))

  (func $avi_sblock (param $ws i32) (param $i i32) (result i32)
    (i32.add (local.get $ws) (i32.mul (local.get $i) (global.get $AVI_SBLOCK))))

  ;; Parse the open file into a workspace. 0, $AVI_PENDING, or an AVIERR.
  (func $avi_load (param $frec i32) (param $h i32) (result i32)
    (local $hdr i32) (local $r i32) (local $riff_end i32) (local $pos i32)
    (local $id i32) (local $size i32) (local $type i32)
    (local $hdrl i32) (local $hdrl_len i32) (local $idx i32) (local $idx_n i32)
    (local $movi_pos i32) (local $movi_end i32) (local $base i32)
    (local $ns i32) (local $i i32) (local $e i32) (local $s i32) (local $kind i32)
    (local $ws_ga i32) (local $ws i32) (local $sb i32) (local $ent i32) (local $t i32)
    (local $len i32) (local $fmtlen i32) (local $ss i32) (local $status i32)
    (local.set $status (global.get $AVIERR_BADFORMAT))
    (local.set $hdr (call $dib_alloc (i32.const 0x1000)))
    (if (i32.eqz (local.get $hdr)) (then (return (global.get $AVIERR_MEMORY))))
    (block $fail
      (local.set $r (call $avi_read (local.get $h) (i32.const 0) (local.get $hdr) (i32.const 12)))
      (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (local.set $status (local.get $r)) (br $fail)))
      (br_if $fail (i32.ne (local.get $r) (i32.const 12)))
      (br_if $fail (i32.ne (call $gl32 (local.get $hdr)) (i32.const 0x46464952)))                          ;; RIFF
      (br_if $fail (i32.ne (call $gl32 (i32.add (local.get $hdr) (i32.const 8))) (i32.const 0x20495641)))   ;; 'AVI '
      (local.set $riff_end (i32.add (i32.const 8) (call $gl32 (i32.add (local.get $hdr) (i32.const 4)))))
      (local.set $pos (i32.const 12))
      (block $top (loop $chunks
        (br_if $top (i32.gt_u (i32.add (local.get $pos) (i32.const 8)) (local.get $riff_end)))
        (local.set $r (call $avi_read (local.get $h) (local.get $pos) (local.get $hdr) (i32.const 12)))
        (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (local.set $status (local.get $r)) (br $fail)))
        (br_if $top (i32.lt_s (local.get $r) (i32.const 8)))
        (local.set $id (call $gl32 (local.get $hdr)))
        (local.set $size (call $gl32 (i32.add (local.get $hdr) (i32.const 4))))
        (local.set $type (call $gl32 (i32.add (local.get $hdr) (i32.const 8))))
        (if (i32.and (i32.eq (local.get $id) (i32.const 0x5453494C))
                     (i32.and (i32.eq (local.get $type) (i32.const 0x6C726468))    ;; hdrl
                              (i32.eqz (local.get $hdrl))))
          (then
            (br_if $fail (i32.or (i32.lt_u (local.get $size) (i32.const 4)) (i32.gt_u (local.get $size) (i32.const 0x100000))))
            (local.set $hdrl_len (i32.sub (local.get $size) (i32.const 4)))
            (local.set $hdrl (call $dib_alloc (i32.add (local.get $hdrl_len) (i32.const 8))))
            (if (i32.eqz (local.get $hdrl)) (then (local.set $status (global.get $AVIERR_MEMORY)) (br $fail)))
            (local.set $r (call $avi_read (local.get $h) (i32.add (local.get $pos) (i32.const 12))
              (local.get $hdrl) (local.get $hdrl_len)))
            (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (local.set $status (local.get $r)) (br $fail)))
            (br_if $fail (i32.ne (local.get $r) (local.get $hdrl_len)))))
        (if (i32.and (i32.eq (local.get $id) (i32.const 0x5453494C))
                     (i32.eq (local.get $type) (i32.const 0x69766F6D)))           ;; movi
          (then
            (local.set $movi_pos (i32.add (local.get $pos) (i32.const 8)))
            (local.set $movi_end (i32.add (local.get $movi_pos) (local.get $size)))))
        (if (i32.and (i32.eq (local.get $id) (i32.const 0x31786469))              ;; idx1
                     (i32.eqz (local.get $idx)))
          (then
            (local.set $idx_n (i32.shr_u (local.get $size) (i32.const 4)))
            (if (local.get $idx_n)
              (then
                (local.set $idx (call $dib_alloc (i32.shl (local.get $idx_n) (i32.const 4))))
                (if (i32.eqz (local.get $idx)) (then (local.set $status (global.get $AVIERR_MEMORY)) (br $fail)))
                (local.set $r (call $avi_read (local.get $h) (i32.add (local.get $pos) (i32.const 8))
                  (local.get $idx) (i32.shl (local.get $idx_n) (i32.const 4))))
                (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (local.set $status (local.get $r)) (br $fail)))
                (local.set $idx_n (i32.shr_u (select (local.get $r) (i32.const 0) (i32.gt_s (local.get $r) (i32.const 0))) (i32.const 4)))))))
        (local.set $pos (i32.add (local.get $pos) (i32.add (i32.const 8)
          (i32.and (i32.add (local.get $size) (i32.const 1)) (i32.const -2)))))
        (br $chunks)))
      (br_if $fail (i32.or (i32.eqz (local.get $hdrl)) (i32.eqz (local.get $movi_pos))))
      (local.set $ns (call $avi_scan_hdrl (call $avi_dib_wa (local.get $hdrl)) (local.get $hdrl_len)))
      (br_if $fail (i32.eqz (local.get $ns)))
      ;; idx1 offsets are relative to the 'movi' fourcc in almost every file
      ;; and absolute in some; the first entry's chunk header says which. An
      ;; interleaved file's first entry is a 'rec ' list, indexed by its type
      ;; but stored on disk as 'LIST' (Dark Colony's intro.avi).
      (if (local.get $idx_n)
        (then
          (local.set $e (call $avi_dib_wa (local.get $idx)))
          (local.set $base (local.get $movi_pos))
          (local.set $r (call $avi_read (local.get $h)
            (i32.add (local.get $movi_pos) (i32.load offset=8 (local.get $e))) (local.get $hdr) (i32.const 4)))
          (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (local.set $status (local.get $r)) (br $fail)))
          (if (i32.or (i32.ne (local.get $r) (i32.const 4))
                      (i32.ne (call $gl32 (local.get $hdr))
                        (select (i32.const 0x5453494C) (i32.load (local.get $e))
                          (i32.eq (i32.load (local.get $e)) (i32.const 0x20636572)))))   ;; 'rec ' -> 'LIST'
            (then (local.set $base (i32.const 0)))))
        (else
          (local.set $idx_n (i32.const 0x10000))
          (local.set $idx (call $dib_alloc (i32.shl (local.get $idx_n) (i32.const 4))))
          (if (i32.eqz (local.get $idx)) (then (local.set $status (global.get $AVIERR_MEMORY)) (br $fail)))
          (local.set $idx_n (call $avi_scan_movi (local.get $h) (i32.add (local.get $movi_pos) (i32.const 4))
            (local.get $movi_end) (local.get $hdr) (call $avi_dib_wa (local.get $idx)) (local.get $idx_n)))
          (if (i32.eq (local.get $idx_n) (global.get $AVI_PENDING)) (then (local.set $status (local.get $idx_n)) (br $fail)))
          (local.set $base (i32.const 0))))
      ;; Count each stream's data and palette-change entries.
      (local.set $len (i32.mul (global.get $AVIF_MAX_STREAMS) (global.get $AVI_SBLOCK)))
      (local.set $e (call $avi_dib_wa (local.get $idx)))
      (local.set $i (i32.const 0))
      (block $c_done (loop $count
        (br_if $c_done (i32.ge_u (local.get $i) (local.get $idx_n)))
        (local.set $s (call $avi_ckid_stream (i32.load (local.get $e))))
        (if (i32.lt_u (local.get $s) (local.get $ns))
          (then (local.set $len (i32.add (local.get $len) (i32.const 16)))))
        (local.set $e (i32.add (local.get $e) (i32.const 16)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $count)))
      (local.set $ws_ga (call $dib_alloc (local.get $len)))
      (if (i32.eqz (local.get $ws_ga)) (then (local.set $status (global.get $AVIERR_MEMORY)) (br $fail)))
      (local.set $ws (call $avi_dib_wa (local.get $ws_ga)))
      ;; Stream blocks: header, format, and the tables' places.
      (local.set $t (i32.add (local.get $ws) (i32.mul (global.get $AVIF_MAX_STREAMS) (global.get $AVI_SBLOCK))))
      (local.set $s (i32.const 0))
      (block $s_done (loop $streams
        (br_if $s_done (i32.ge_u (local.get $s) (local.get $ns)))
        (local.set $sb (call $avi_sblock (local.get $ws) (local.get $s)))
        (local.set $ent (i32.add (region.addr $AVI_TABLE 0x500) (i32.shl (local.get $s) (i32.const 4))))
        (memory.copy (local.get $sb) (i32.load (local.get $ent))
          (select (i32.const 56) (i32.load offset=12 (local.get $ent))
            (i32.gt_u (i32.load offset=12 (local.get $ent)) (i32.const 56))))
        (local.set $fmtlen (i32.load offset=8 (local.get $ent)))
        (if (i32.gt_u (local.get $fmtlen) (global.get $AVI_FORMAT_MAX))
          (then (local.set $fmtlen (global.get $AVI_FORMAT_MAX))))
        (if (local.get $fmtlen)
          (then (memory.copy (i32.add (local.get $sb) (i32.const 0x80)) (i32.load offset=4 (local.get $ent)) (local.get $fmtlen))))
        (i32.store offset=0x40 (local.get $sb) (local.get $fmtlen))
        ;; Data entries first, then palette changes, both counted below.
        (local.set $e (call $avi_dib_wa (local.get $idx)))
        (local.set $i (i32.const 0))
        (local.set $r (i32.const 0))    ;; data count
        (local.set $kind (i32.const 0)) ;; pc count
        (block $n_done (loop $n_each
          (br_if $n_done (i32.ge_u (local.get $i) (local.get $idx_n)))
          (if (i32.eq (call $avi_ckid_stream (i32.load (local.get $e))) (local.get $s))
            (then (if (call $avi_is_pc (i32.load (local.get $e)))
              (then (local.set $kind (i32.add (local.get $kind) (i32.const 1))))
              (else (local.set $r (i32.add (local.get $r) (i32.const 1)))))))
          (local.set $e (i32.add (local.get $e) (i32.const 16)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $n_each)))
        (i32.store offset=0x44 (local.get $sb) (local.get $t))
        (local.set $t (i32.add (local.get $t) (i32.shl (local.get $r) (i32.const 4))))
        (i32.store offset=0x4C (local.get $sb) (local.get $t))
        (local.set $t (i32.add (local.get $t) (i32.shl (local.get $kind) (i32.const 4))))
        (local.set $s (i32.add (local.get $s) (i32.const 1)))
        (br $streams)))
      ;; Fill the tables in file order.
      (local.set $e (call $avi_dib_wa (local.get $idx)))
      (local.set $i (i32.const 0))
      (block $f_done (loop $fill
        (br_if $f_done (i32.ge_u (local.get $i) (local.get $idx_n)))
        (local.set $s (call $avi_ckid_stream (i32.load (local.get $e))))
        (if (i32.lt_u (local.get $s) (local.get $ns))
          (then
            (local.set $sb (call $avi_sblock (local.get $ws) (local.get $s)))
            (local.set $size (i32.load offset=12 (local.get $e)))
            (if (call $avi_is_pc (i32.load (local.get $e)))
              (then
                (local.set $ent (i32.add (i32.load offset=0x4C (local.get $sb))
                  (i32.shl (i32.load offset=0x50 (local.get $sb)) (i32.const 4))))
                (i32.store offset=12 (local.get $ent) (i32.load offset=0x48 (local.get $sb)))
                (i32.store offset=0x50 (local.get $sb) (i32.add (i32.load offset=0x50 (local.get $sb)) (i32.const 1))))
              (else
                (local.set $ent (i32.add (i32.load offset=0x44 (local.get $sb))
                  (i32.shl (i32.load offset=0x48 (local.get $sb)) (i32.const 4))))
                (i32.store offset=12 (local.get $ent) (i32.load offset=0x5C (local.get $sb)))
                (i32.store offset=0x48 (local.get $sb) (i32.add (i32.load offset=0x48 (local.get $sb)) (i32.const 1)))
                (i32.store offset=0x5C (local.get $sb) (i32.add (i32.load offset=0x5C (local.get $sb)) (local.get $size)))
                (if (i32.gt_u (local.get $size) (i32.load offset=0x60 (local.get $sb)))
                  (then (i32.store offset=0x60 (local.get $sb) (local.get $size))))))
            (i32.store (local.get $ent) (i32.add (i32.add (local.get $base) (i32.load offset=8 (local.get $e))) (i32.const 8)))
            (i32.store offset=4 (local.get $ent) (local.get $size))
            (i32.store offset=8 (local.get $ent) (i32.load offset=4 (local.get $e)))))
        (local.set $e (i32.add (local.get $e) (i32.const 16)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $fill)))
      ;; Sample counts: a chunk per frame for video; for audio the byte total
      ;; over dwSampleSize (or the format's nBlockAlign when that is 0).
      (local.set $s (i32.const 0))
      (block $l_done (loop $lengths
        (br_if $l_done (i32.ge_u (local.get $s) (local.get $ns)))
        (local.set $sb (call $avi_sblock (local.get $ws) (local.get $s)))
        (local.set $ss (i32.const 0))
        (if (i32.eq (i32.load (local.get $sb)) (i32.const 0x73647561))    ;; auds
          (then
            (local.set $ss (i32.load offset=44 (local.get $sb)))
            (if (i32.and (i32.eqz (local.get $ss)) (i32.ge_u (i32.load offset=0x40 (local.get $sb)) (i32.const 14)))
              (then (local.set $ss (i32.load16_u offset=0x8C (local.get $sb)))))))
        (i32.store offset=0x58 (local.get $sb) (local.get $ss))
        (i32.store offset=0x54 (local.get $sb)
          (if (result i32) (local.get $ss)
            (then (i32.div_u (i32.load offset=0x5C (local.get $sb)) (local.get $ss)))
            (else (i32.load offset=0x48 (local.get $sb)))))
        (local.set $s (i32.add (local.get $s) (i32.const 1)))
        (br $lengths)))
      (i32.store offset=8 (local.get $frec) (local.get $ns))
      (i32.store offset=12 (local.get $frec) (local.get $ws))
      (local.set $status (i32.const 0)))
    (call $dib_free_wasm (call $avi_dib_wa (local.get $hdr)))
    (if (local.get $hdrl) (then (call $dib_free_wasm (call $avi_dib_wa (local.get $hdrl)))))
    (if (local.get $idx) (then (call $dib_free_wasm (call $avi_dib_wa (local.get $idx)))))
    (local.get $status))

  ;; ---- objects --------------------------------------------------------
  ;; PAVIFILE / PAVISTREAM are guest blocks {lpVtbl 0, magic, slot}. Apps
  ;; here reach the objects only through the AVIFile API; a vtable call
  ;; through one jumps to 0 and fails loudly.
  (func $avi_new_object (param $magic i32) (param $slot i32) (result i32)
    (local $obj i32)
    (local.set $obj (call $heap_alloc (i32.const 16)))
    (if (local.get $obj)
      (then
        (call $gs32 (local.get $obj) (i32.const 0))
        (call $gs32 (i32.add (local.get $obj) (i32.const 4)) (local.get $magic))
        (call $gs32 (i32.add (local.get $obj) (i32.const 8)) (local.get $slot))))
    (local.get $obj))

  (func $avi_file_of (param $obj i32) (result i32)
    (local $slot i32) (local $rec i32)
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $obj) (i32.const 4))) (global.get $AVI_MAGIC_FILE))
      (then (return (i32.const 0))))
    (local.set $slot (call $gl32 (i32.add (local.get $obj) (i32.const 8))))
    (if (i32.ge_u (local.get $slot) (global.get $AVI_FILES)) (then (return (i32.const 0))))
    (local.set $rec (call $avi_file_rec (local.get $slot)))
    (if (i32.or (i32.eqz (i32.load (local.get $rec)))
                (i32.ne (i32.load offset=16 (local.get $rec)) (local.get $obj)))
      (then (return (i32.const 0))))
    (local.get $rec))

  (func $avi_stream_of (param $obj i32) (result i32)
    (local $slot i32) (local $rec i32)
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $obj) (i32.const 4))) (global.get $AVI_MAGIC_STREAM))
      (then (return (i32.const 0))))
    (local.set $slot (call $gl32 (i32.add (local.get $obj) (i32.const 8))))
    (if (i32.ge_u (local.get $slot) (global.get $AVI_STREAMS)) (then (return (i32.const 0))))
    (local.set $rec (call $avi_stream_rec (local.get $slot)))
    (if (i32.or (i32.eqz (i32.load (local.get $rec)))
                (i32.ne (i32.load offset=12 (local.get $rec)) (local.get $obj)))
      (then (return (i32.const 0))))
    (local.get $rec))

  ;; A stream's block in its file's workspace.
  (func $avi_stream_block (param $srec i32) (result i32)
    (call $avi_sblock
      (i32.load offset=12 (call $avi_file_rec (i32.load offset=4 (local.get $srec))))
      (i32.load offset=8 (local.get $srec))))

  (func $avi_file_release (param $rec i32) (result i32)
    (local $refs i32)
    (local.set $refs (i32.sub (i32.load (local.get $rec)) (i32.const 1)))
    (i32.store (local.get $rec) (local.get $refs))
    (if (i32.eqz (local.get $refs))
      (then
        (if (i32.eqz (call $avi_is_mem_handle (i32.load offset=4 (local.get $rec))))
          (then (drop (call $host_fs_close_handle (i32.load offset=4 (local.get $rec))))))
        (call $dib_free_wasm (i32.load offset=12 (local.get $rec)))
        (call $heap_free (i32.load offset=16 (local.get $rec)))
        (if (call $avi_is_mem_handle (i32.load offset=4 (local.get $rec)))
          (then (call $heap_free (i32.load offset=20 (local.get $rec)))))
        (memory.fill (local.get $rec) (i32.const 0) (i32.const 32))))
    (local.get $refs))

  ;; Open and parse a file into a free slot: the file record, or a status
  ;; (<= 0 as i32: $AVI_PENDING, or an AVIERR) in $avi_open_status.
  (global $avi_open_status (mut i32) (i32.const 0))
  ;; The handle whose read parked the last open. Closing a handle cancels its
  ;; pending read (lib/filesystem.js closeHandle), so it stays open until the
  ;; host has filled the chunk and the call comes round again.
  (global $avi_parked_handle (mut i32) (i32.const 0))
  (func $avi_open (param $path i32) (result i32)
    (local $slot i32) (local $rec i32) (local $h i32) (local $r i32) (local $obj i32)
    (if (global.get $avi_parked_handle)
      (then (drop (call $host_fs_close_handle (global.get $avi_parked_handle)))
            (global.set $avi_parked_handle (i32.const 0))))
    (global.set $avi_open_status (global.get $AVIERR_MEMORY))
    (block $found (loop $scan
      (if (i32.ge_u (local.get $slot) (global.get $AVI_FILES)) (then (return (i32.const 0))))
      (local.set $rec (call $avi_file_rec (local.get $slot)))
      (br_if $found (i32.eqz (i32.load (local.get $rec))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (local.set $h (call $host_fs_create_file (call $g2w (local.get $path))
      (i32.const 0x80000000) (i32.const 3) (i32.const 0x80) (i32.const 0)))
    (if (i32.or (i32.eqz (local.get $h)) (i32.eq (local.get $h) (i32.const -1)))
      (then (global.set $avi_open_status (global.get $AVIERR_FILEOPEN)) (return (i32.const 0))))
    (local.set $r (call $avi_load (local.get $rec) (local.get $h)))
    (if (i32.eqz (local.get $r))
      (then (local.set $obj (call $avi_new_object (global.get $AVI_MAGIC_FILE) (local.get $slot)))
            (if (i32.eqz (local.get $obj))
              (then (call $dib_free_wasm (i32.load offset=12 (local.get $rec)))
                    (local.set $r (global.get $AVIERR_MEMORY))))))
    (if (local.get $r)
      (then
        (if (i32.eq (local.get $r) (global.get $AVI_PENDING))
          (then (global.set $avi_parked_handle (local.get $h)))
          (else (drop (call $host_fs_close_handle (local.get $h)))))
        (global.set $avi_open_status (local.get $r))
        (return (i32.const 0))))
    (i32.store offset=4 (local.get $rec) (local.get $h))
    (i32.store offset=16 (local.get $rec) (local.get $obj))
    (i32.store (local.get $rec) (i32.const 1))
    (global.set $avi_open_status (i32.const 0))
    (local.get $rec))

  ;; Open an AVI held in guest memory (a resource): same record, workspace
  ;; and status contract as $avi_open, read through $avi_read's memory branch.
  (func $avi_open_memory (param $ga i32) (param $len i32) (result i32)
    (local $slot i32) (local $rec i32) (local $h i32) (local $r i32) (local $obj i32) (local $copy i32)
    (global.set $avi_open_status (global.get $AVIERR_MEMORY))
    (block $found (loop $scan
      (if (i32.ge_u (local.get $slot) (global.get $AVI_FILES)) (then (return (i32.const 0))))
      (local.set $rec (call $avi_file_rec (local.get $slot)))
      (br_if $found (i32.eqz (i32.load (local.get $rec))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (local.set $h (i32.or (global.get $AVI_MEM_TAG) (local.get $slot)))
    ;; Playback reads frames after ACM_OPEN returns. A module resource is
    ;; only pinned for that API call, so the AVI record owns a byte copy until
    ;; its last file/stream reference is released.
    (if (local.get $len)
      (then
        (local.set $copy (call $heap_alloc (local.get $len)))
        (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
        (call $avi_mem_copy (local.get $copy) (local.get $ga) (local.get $len))))
    (i32.store offset=20 (local.get $rec) (local.get $copy))
    (i32.store offset=24 (local.get $rec) (local.get $len))
    (local.set $r (call $avi_load (local.get $rec) (local.get $h)))
    (if (i32.eqz (local.get $r))
      (then (local.set $obj (call $avi_new_object (global.get $AVI_MAGIC_FILE) (local.get $slot)))
            (if (i32.eqz (local.get $obj))
              (then (call $dib_free_wasm (i32.load offset=12 (local.get $rec)))
                    (local.set $r (global.get $AVIERR_MEMORY))))))
    (if (local.get $r)
      (then
        (global.set $avi_open_status (local.get $r))
        (if (local.get $copy) (then (call $heap_free (local.get $copy))))
        (memory.fill (local.get $rec) (i32.const 0) (i32.const 32))
        (return (i32.const 0))))
    (i32.store offset=4 (local.get $rec) (local.get $h))
    (i32.store offset=16 (local.get $rec) (local.get $obj))
    (i32.store (local.get $rec) (i32.const 1))
    (global.set $avi_open_status (i32.const 0))
    (local.get $rec))

  ;; The lParam'th stream of fccType (0 = any) as a new PAVISTREAM, holding a
  ;; reference on its file. 0 with $avi_open_status set when there is none.
  (func $avi_get_stream (param $frec i32) (param $fcc i32) (param $nth i32) (result i32)
    (local $i i32) (local $ws i32) (local $slot i32) (local $srec i32) (local $obj i32)
    (local.set $ws (i32.load offset=12 (local.get $frec)))
    (local.set $i (i32.const -1))
    (block $found (loop $scan
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (if (i32.ge_u (local.get $i) (i32.load offset=8 (local.get $frec)))
        (then (global.set $avi_open_status (global.get $AVIERR_NODATA)) (return (i32.const 0))))
      (br_if $scan (i32.and (i32.ne (local.get $fcc) (i32.const 0))
        (i32.ne (i32.load (call $avi_sblock (local.get $ws) (local.get $i))) (local.get $fcc))))
      (br_if $found (i32.eqz (local.get $nth)))
      (local.set $nth (i32.sub (local.get $nth) (i32.const 1)))
      (br $scan)))
    (block $free (loop $slots
      (if (i32.ge_u (local.get $slot) (global.get $AVI_STREAMS))
        (then (global.set $avi_open_status (global.get $AVIERR_MEMORY)) (return (i32.const 0))))
      (local.set $srec (call $avi_stream_rec (local.get $slot)))
      (br_if $free (i32.eqz (i32.load (local.get $srec))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $slots)))
    (local.set $obj (call $avi_new_object (global.get $AVI_MAGIC_STREAM) (local.get $slot)))
    (if (i32.eqz (local.get $obj))
      (then (global.set $avi_open_status (global.get $AVIERR_MEMORY)) (return (i32.const 0))))
    (i32.store offset=4 (local.get $srec)
      (i32.shr_u (i32.sub (local.get $frec) (call $avi_file_rec (i32.const 0))) (i32.const 5)))
    (i32.store offset=8 (local.get $srec) (local.get $i))
    (i32.store offset=12 (local.get $srec) (local.get $obj))
    (i32.store (local.get $srec) (i32.const 1))
    (i32.store (local.get $frec) (i32.add (i32.load (local.get $frec)) (i32.const 1)))
    (global.set $avi_open_status (i32.const 0))
    (local.get $obj))

  ;; ---- API front doors ------------------------------------------------
  (func $avi_arg (param $k i32) (result i32)
    (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base))
      (i32.add (i32.const 4) (i32.shl (local.get $k) (i32.const 2))))))

  ;; AVIFileOpenA(ppfile, szFile, uMode, lpHandler) -> HRESULT
  (func $handle_AVIFileOpenA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32)
    ;; OF_WRITE / OF_READWRITE / OF_CREATE: the writer side is not here.
    (if (i32.and (local.get $arg2) (i32.const 0x1003))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (call $amstream_finish (global.get $AVIERR_BADPARAM) (i32.const 20)) (return)))
    (call $gs32 (local.get $arg0) (i32.const 0))
    (local.set $rec (call $avi_open (local.get $arg1)))
    (if (i32.eq (global.get $avi_open_status) (global.get $AVI_PENDING))
      (then (call $io_block (i32.const 0)) (return)))
    (if (local.get $rec)
      (then (call $gs32 (local.get $arg0) (i32.load offset=16 (local.get $rec)))))
    (call $amstream_finish (global.get $avi_open_status) (i32.const 20)))

  ;; AVIFileGetStream(pfile, ppavi, fccType, lParam) -> HRESULT
  (func $handle_AVIFileGetStream (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $frec i32) (local $obj i32)
    (local.set $frec (call $avi_file_of (local.get $arg0)))
    (if (i32.or (i32.eqz (local.get $frec)) (i32.eqz (local.get $arg1)))
      (then (call $amstream_finish (global.get $AVIERR_BADHANDLE) (i32.const 20)) (return)))
    (local.set $obj (call $avi_get_stream (local.get $frec) (local.get $arg2) (local.get $arg3)))
    (call $gs32 (local.get $arg1) (local.get $obj))
    (call $amstream_finish (global.get $avi_open_status) (i32.const 20)))

  ;; AVIFileRelease(pfile) -> remaining references
  (func $handle_AVIFileRelease (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $frec i32)
    (local.set $frec (call $avi_file_of (local.get $arg0)))
    (call $amstream_finish (if (result i32) (local.get $frec) (then (call $avi_file_release (local.get $frec))) (else (i32.const 0))) (i32.const 8)))

  ;; AVIStreamOpenFromFileA(ppavi, szFile, fccType, lParam, mode, pclsid)
  (func $handle_AVIStreamOpenFromFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $frec i32) (local $obj i32) (local $status i32)
    (if (i32.and (local.get $arg4) (i32.const 0x1003))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (call $amstream_finish (global.get $AVIERR_BADPARAM) (i32.const 28)) (return)))
    (call $gs32 (local.get $arg0) (i32.const 0))
    (local.set $frec (call $avi_open (local.get $arg1)))
    (if (i32.eq (global.get $avi_open_status) (global.get $AVI_PENDING))
      (then (call $io_block (i32.const 0)) (return)))
    (local.set $status (global.get $avi_open_status))
    (if (local.get $frec)
      (then
        (local.set $obj (call $avi_get_stream (local.get $frec) (local.get $arg2) (local.get $arg3)))
        (local.set $status (global.get $avi_open_status))
        ;; The stream now holds the only reference the caller will release.
        (drop (call $avi_file_release (local.get $frec)))
        (call $gs32 (local.get $arg0) (local.get $obj))))
    (call $amstream_finish (local.get $status) (i32.const 28)))

  ;; AVIStreamRelease(pavi) -> remaining references
  (func $handle_AVIStreamRelease (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32) (local $refs i32)
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (if (local.get $srec)
      (then
        (local.set $refs (i32.sub (i32.load (local.get $srec)) (i32.const 1)))
        (i32.store (local.get $srec) (local.get $refs))
        (if (i32.eqz (local.get $refs))
          (then
            (drop (call $avi_file_release (call $avi_file_rec (i32.load offset=4 (local.get $srec)))))
            (call $heap_free (i32.load offset=12 (local.get $srec)))
            (i32.store offset=12 (local.get $srec) (i32.const 0))))))
    (call $amstream_finish (local.get $refs) (i32.const 8)))

  ;; AVIStreamInfoA(pavi, psi, lSize) -> HRESULT. AVISTREAMINFOA is 140 bytes.
  (func $handle_AVIStreamInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32) (local $sb i32) (local $tmp i32) (local $n i32) (local $l i32) (local $t i32)
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (if (i32.eqz (local.get $srec))
      (then (call $amstream_finish (global.get $AVIERR_BADHANDLE) (i32.const 16)) (return)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.lt_s (local.get $arg2) (i32.const 0)))
      (then (call $amstream_finish (global.get $AVIERR_BADPARAM) (i32.const 16)) (return)))
    (local.set $sb (call $avi_stream_block (local.get $srec)))
    ;; Built in $AVI_TABLE scratch, then copied out clamped to lSize.
    (local.set $tmp (region.addr $AVI_TABLE 0x580))
    (call $zero_memory (local.get $tmp) (i32.const 140))
    (i32.store (local.get $tmp) (i32.load (local.get $sb)))                         ;; fccType
    (i32.store offset=4 (local.get $tmp) (i32.load offset=4 (local.get $sb)))       ;; fccHandler
    (i32.store offset=8 (local.get $tmp) (i32.load offset=8 (local.get $sb)))       ;; dwFlags
    (i32.store offset=12 (local.get $tmp) (i32.const 1))                            ;; dwCaps: AVIFILECAPS_CANREAD
    (i32.store offset=16 (local.get $tmp) (i32.load offset=12 (local.get $sb)))     ;; wPriority, wLanguage
    (i32.store offset=20 (local.get $tmp) (i32.load offset=20 (local.get $sb)))     ;; dwScale
    (i32.store offset=24 (local.get $tmp) (i32.load offset=24 (local.get $sb)))     ;; dwRate
    (i32.store offset=28 (local.get $tmp) (i32.load offset=28 (local.get $sb)))     ;; dwStart
    (i32.store offset=32 (local.get $tmp) (i32.load offset=0x54 (local.get $sb)))   ;; dwLength
    (i32.store offset=36 (local.get $tmp) (i32.load offset=16 (local.get $sb)))     ;; dwInitialFrames
    (local.set $n (i32.load offset=36 (local.get $sb)))
    (if (i32.lt_u (local.get $n) (i32.load offset=0x60 (local.get $sb)))
      (then (local.set $n (i32.load offset=0x60 (local.get $sb)))))
    (i32.store offset=40 (local.get $tmp) (local.get $n))                           ;; dwSuggestedBufferSize
    (i32.store offset=44 (local.get $tmp) (i32.load offset=40 (local.get $sb)))     ;; dwQuality
    (i32.store offset=48 (local.get $tmp) (i32.load offset=0x58 (local.get $sb)))   ;; dwSampleSize
    ;; rcFrame: strh's four shorts, or the picture size when they are empty.
    (i32.store offset=52 (local.get $tmp) (i32.load16_s offset=48 (local.get $sb)))
    (i32.store offset=56 (local.get $tmp) (i32.load16_s offset=50 (local.get $sb)))
    (i32.store offset=60 (local.get $tmp) (i32.load16_s offset=52 (local.get $sb)))
    (i32.store offset=64 (local.get $tmp) (i32.load16_s offset=54 (local.get $sb)))
    (if (i32.and (i32.eqz (i32.load offset=60 (local.get $tmp)))
          (i32.and (i32.eq (i32.load (local.get $sb)) (i32.const 0x73646976))       ;; vids
                   (i32.ge_u (i32.load offset=0x40 (local.get $sb)) (i32.const 12))))
      (then
        (i32.store offset=60 (local.get $tmp) (i32.load offset=0x84 (local.get $sb)))
        (local.set $t (i32.load offset=0x88 (local.get $sb)))
        (i32.store offset=64 (local.get $tmp) (select (i32.sub (i32.const 0) (local.get $t)) (local.get $t)
          (i32.lt_s (local.get $t) (i32.const 0))))))
    (i32.store offset=72 (local.get $tmp) (i32.load offset=0x50 (local.get $sb)))   ;; dwFormatChangeCount
    (local.set $l (select (i32.const 140) (local.get $arg2) (i32.gt_u (local.get $arg2) (i32.const 140))))
    (call $icm_put_guest (local.get $arg1) (local.get $tmp) (local.get $l))
    (call $amstream_finish (i32.const 0) (i32.const 16)))

  ;; AVIStreamStart / AVIStreamLength (pavi) -> LONG, -1 for a bad stream
  (func $handle_AVIStreamStart (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32)
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (call $amstream_finish (if (result i32) (local.get $srec) (then (i32.load offset=28 (call $avi_stream_block (local.get $srec)))) (else (i32.const -1))) (i32.const 8)))

  (func $handle_AVIStreamLength (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32)
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (call $amstream_finish (if (result i32) (local.get $srec) (then (i32.load offset=0x54 (call $avi_stream_block (local.get $srec)))) (else (i32.const -1))) (i32.const 8)))

  ;; AVIStreamReadFormat(pavi, lPos, lpFormat, lpcbFormat) -> HRESULT. The
  ;; format at lPos: the stream's own, with every palette change the stream
  ;; carries up to and including that sample applied to its colour table.
  (func $handle_AVIStreamReadFormat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32) (local $sb i32) (local $fmtlen i32) (local $cb i32) (local $n i32)
    (local $pc i32) (local $i i32) (local $scratch i32) (local $r i32) (local $sw i32)
    (local $first i32) (local $count i32) (local $k i32) (local $pal i32) (local $e i32) (local $pos i32)
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (if (i32.or (i32.eqz (local.get $srec)) (i32.eqz (local.get $arg3)))
      (then (call $amstream_finish (global.get $AVIERR_BADHANDLE) (i32.const 20)) (return)))
    (local.set $sb (call $avi_stream_block (local.get $srec)))
    (local.set $fmtlen (i32.load offset=0x40 (local.get $sb)))
    (if (i32.eqz (local.get $arg2))
      (then (call $gs32 (local.get $arg3) (local.get $fmtlen))
            (call $amstream_finish (i32.const 0) (i32.const 20)) (return)))
    (local.set $cb (call $gl32 (local.get $arg3)))
    (local.set $n (select (local.get $fmtlen) (local.get $cb) (i32.lt_u (local.get $fmtlen) (local.get $cb))))
    (call $icm_put_guest (local.get $arg2) (i32.add (local.get $sb) (i32.const 0x80)) (local.get $n))
    (local.set $pos (i32.sub (local.get $arg1) (i32.load offset=28 (local.get $sb))))
    (if (i32.and (i32.gt_s (local.get $pos) (i32.const 0))
          (i32.and (i32.ne (i32.load offset=0x50 (local.get $sb)) (i32.const 0))
                   (i32.ge_u (local.get $n) (i32.const 40))))
      (then
        (local.set $scratch (call $dib_alloc (i32.const 0x1000)))
        (if (i32.eqz (local.get $scratch))
          (then (call $amstream_finish (global.get $AVIERR_MEMORY) (i32.const 20)) (return)))
        (local.set $sw (call $avi_dib_wa (local.get $scratch)))
        (local.set $pal (i32.add (local.get $arg2) (i32.load offset=0x80 (local.get $sb))))
        (local.set $pc (i32.load offset=0x4C (local.get $sb)))
        (block $done (loop $each
          (br_if $done (i32.ge_u (local.get $i) (i32.load offset=0x50 (local.get $sb))))
          (local.set $e (i32.add (local.get $pc) (i32.shl (local.get $i) (i32.const 4))))
          (br_if $done (i32.gt_s (i32.load offset=12 (local.get $e)) (local.get $pos)))
          (local.set $r (call $avi_read (i32.load offset=4 (call $avi_file_rec (i32.load offset=4 (local.get $srec))))
            (i32.load (local.get $e)) (local.get $scratch)
            (select (i32.const 0x1000) (i32.load offset=4 (local.get $e))
              (i32.gt_u (i32.load offset=4 (local.get $e)) (i32.const 0x1000)))))
          (if (i32.eq (local.get $r) (global.get $AVI_PENDING))
            (then (call $dib_free_wasm (local.get $sw)) (call $io_block (i32.const 0)) (return)))
          ;; AVIPALCHANGE {bFirstEntry, bNumEntries (0 = 256), wFlags, peNew[]}
          (if (i32.ge_s (local.get $r) (i32.const 4))
            (then
              (local.set $first (i32.load8_u (local.get $sw)))
              (local.set $count (i32.load8_u offset=1 (local.get $sw)))
              (if (i32.eqz (local.get $count)) (then (local.set $count (i32.const 256))))
              (local.set $k (i32.const 0))
              (block $k_done (loop $entries
                (br_if $k_done (i32.ge_u (local.get $k) (local.get $count)))
                (br_if $k_done (i32.gt_s (i32.add (i32.const 8) (i32.shl (local.get $k) (i32.const 2))) (local.get $r)))
                (br_if $k_done (i32.gt_u (i32.add (i32.load offset=0x80 (local.get $sb))
                  (i32.shl (i32.add (local.get $first) (i32.add (local.get $k) (i32.const 1))) (i32.const 2))) (local.get $n)))
                (local.set $e (i32.add (local.get $sw) (i32.add (i32.const 4) (i32.shl (local.get $k) (i32.const 2)))))
                (call $gs32 (i32.add (local.get $pal) (i32.shl (i32.add (local.get $first) (local.get $k)) (i32.const 2)))
                  (i32.or (i32.or (i32.shl (i32.load8_u (local.get $e)) (i32.const 16))
                                  (i32.shl (i32.load8_u offset=1 (local.get $e)) (i32.const 8)))
                          (i32.load8_u offset=2 (local.get $e))))
                (local.set $k (i32.add (local.get $k) (i32.const 1)))
                (br $entries)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $each)))
        (call $dib_free_wasm (local.get $sw))))
    (call $gs32 (local.get $arg3) (local.get $n))
    (call $amstream_finish (select (i32.const 0) (global.get $AVIERR_BUFFERTOOSMALL) (i32.ge_u (local.get $cb) (local.get $fmtlen))) (i32.const 20)))

  ;; Which data entry holds byte $b of an audio stream (binary search on aux).
  (func $avi_entry_for_byte (param $sb i32) (param $b i32) (result i32)
    (local $lo i32) (local $hi i32) (local $mid i32) (local $t i32)
    (local.set $t (i32.load offset=0x44 (local.get $sb)))
    (local.set $hi (i32.load offset=0x48 (local.get $sb)))
    (block $done (loop $search
      (br_if $done (i32.ge_u (i32.add (local.get $lo) (i32.const 1)) (local.get $hi)))
      (local.set $mid (i32.shr_u (i32.add (local.get $lo) (local.get $hi)) (i32.const 1)))
      (if (i32.le_u (i32.load offset=12 (i32.add (local.get $t) (i32.shl (local.get $mid) (i32.const 4)))) (local.get $b))
        (then (local.set $lo (local.get $mid)))
        (else (local.set $hi (local.get $mid))))
      (br $search)))
    (local.get $lo))

  ;; AVIStreamRead(pavi, lStart, lSamples, lpBuffer, cbBuffer, plBytes,
  ;;               plSamples) -> HRESULT
  (func $handle_AVIStreamRead (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32) (local $sb i32) (local $h i32) (local $pl_bytes i32) (local $pl_samples i32)
    (local $pos i32) (local $e i32) (local $size i32) (local $r i32) (local $ss i32)
    (local $b0 i32) (local $b1 i32) (local $i i32) (local $at i32) (local $take i32) (local $done i32)
    (local.set $pl_bytes (call $avi_arg (i32.const 5)))
    (local.set $pl_samples (call $avi_arg (i32.const 6)))
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (if (i32.eqz (local.get $srec))
      (then (call $amstream_finish (global.get $AVIERR_BADHANDLE) (i32.const 32)) (return)))
    (local.set $sb (call $avi_stream_block (local.get $srec)))
    (local.set $h (i32.load offset=4 (call $avi_file_rec (i32.load offset=4 (local.get $srec)))))
    (if (local.get $pl_bytes) (then (call $gs32 (local.get $pl_bytes) (i32.const 0))))
    (if (local.get $pl_samples) (then (call $gs32 (local.get $pl_samples) (i32.const 0))))
    (local.set $pos (i32.sub (local.get $arg1) (i32.load offset=28 (local.get $sb))))
    (if (i32.or (i32.lt_s (local.get $pos) (i32.const 0))
                (i32.ge_s (local.get $pos) (i32.load offset=0x54 (local.get $sb))))
      (then (call $amstream_finish (global.get $AVIERR_NODATA) (i32.const 32)) (return)))
    (local.set $ss (i32.load offset=0x58 (local.get $sb)))
    (if (i32.eqz (local.get $ss))
      (then
        ;; One chunk is one sample.
        (local.set $e (i32.add (i32.load offset=0x44 (local.get $sb)) (i32.shl (local.get $pos) (i32.const 4))))
        (local.set $size (i32.load offset=4 (local.get $e)))
        (if (i32.eqz (local.get $arg3))
          (then
            (if (local.get $pl_bytes) (then (call $gs32 (local.get $pl_bytes) (local.get $size))))
            (if (local.get $pl_samples) (then (call $gs32 (local.get $pl_samples) (i32.const 1))))
            (call $amstream_finish (i32.const 0) (i32.const 32)) (return)))
        (if (i32.lt_u (local.get $arg4) (local.get $size))
          (then
            (if (local.get $pl_bytes) (then (call $gs32 (local.get $pl_bytes) (local.get $size))))
            (call $amstream_finish (global.get $AVIERR_BUFFERTOOSMALL) (i32.const 32)) (return)))
        (if (local.get $size)
          (then
            (local.set $r (call $avi_read (local.get $h) (i32.load (local.get $e)) (local.get $arg3) (local.get $size)))
            (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (call $io_block (i32.const 0)) (return)))
            (if (i32.ne (local.get $r) (local.get $size))
              (then (call $amstream_finish (global.get $AVIERR_FILEREAD) (i32.const 32)) (return)))))
        (if (local.get $pl_bytes) (then (call $gs32 (local.get $pl_bytes) (local.get $size))))
        (if (local.get $pl_samples) (then (call $gs32 (local.get $pl_samples) (i32.const 1))))
        (call $amstream_finish (i32.const 0) (i32.const 32)) (return)))
    ;; Fixed-size samples: a byte range across however many chunks it spans.
    ;; AVISTREAMREAD_CONVENIENT (-1) means to the end of the current chunk.
    (local.set $b0 (i32.mul (local.get $pos) (local.get $ss)))
    (local.set $i (call $avi_entry_for_byte (local.get $sb) (local.get $b0)))
    (if (i32.eq (local.get $arg2) (i32.const -1))
      (then
        (local.set $e (i32.add (i32.load offset=0x44 (local.get $sb)) (i32.shl (local.get $i) (i32.const 4))))
        (local.set $arg2 (i32.div_u
          (i32.sub (i32.add (i32.load offset=12 (local.get $e)) (i32.load offset=4 (local.get $e))) (local.get $b0))
          (local.get $ss)))))
    (if (i32.gt_u (local.get $arg2) (i32.sub (i32.load offset=0x54 (local.get $sb)) (local.get $pos)))
      (then (local.set $arg2 (i32.sub (i32.load offset=0x54 (local.get $sb)) (local.get $pos)))))
    (if (i32.and (i32.ne (local.get $arg3) (i32.const 0))
                 (i32.gt_u (i32.mul (local.get $arg2) (local.get $ss)) (local.get $arg4)))
      (then (local.set $arg2 (i32.div_u (local.get $arg4) (local.get $ss)))))
    (if (i32.and (i32.ne (local.get $arg3) (i32.const 0)) (i32.eqz (local.get $arg2)))
      (then
        (if (local.get $pl_bytes) (then (call $gs32 (local.get $pl_bytes) (local.get $ss))))
        (call $amstream_finish (global.get $AVIERR_BUFFERTOOSMALL) (i32.const 32)) (return)))
    (local.set $b1 (i32.add (local.get $b0) (i32.mul (local.get $arg2) (local.get $ss))))
    (if (local.get $arg3)
      (then
        (local.set $at (local.get $b0))
        (block $copied (loop $chunks
          (br_if $copied (i32.ge_u (local.get $at) (local.get $b1)))
          (br_if $copied (i32.ge_u (local.get $i) (i32.load offset=0x48 (local.get $sb))))
          (local.set $e (i32.add (i32.load offset=0x44 (local.get $sb)) (i32.shl (local.get $i) (i32.const 4))))
          (local.set $take (i32.sub (i32.add (i32.load offset=12 (local.get $e)) (i32.load offset=4 (local.get $e)))
                                    (local.get $at)))
          (if (i32.gt_u (local.get $take) (i32.sub (local.get $b1) (local.get $at)))
            (then (local.set $take (i32.sub (local.get $b1) (local.get $at)))))
          (if (local.get $take)
            (then
              (local.set $r (call $avi_read (local.get $h)
                (i32.add (i32.load (local.get $e)) (i32.sub (local.get $at) (i32.load offset=12 (local.get $e))))
                (i32.add (local.get $arg3) (local.get $done)) (local.get $take)))
              (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (call $io_block (i32.const 0)) (return)))
              (if (i32.ne (local.get $r) (local.get $take))
                (then (call $amstream_finish (global.get $AVIERR_FILEREAD) (i32.const 32)) (return)))))
          (local.set $done (i32.add (local.get $done) (local.get $take)))
          (local.set $at (i32.add (local.get $at) (local.get $take)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $chunks)))))
    (if (local.get $pl_bytes)
      (then (call $gs32 (local.get $pl_bytes) (i32.sub (local.get $b1) (local.get $b0)))))
    (if (local.get $pl_samples) (then (call $gs32 (local.get $pl_samples) (local.get $arg2))))
    (call $amstream_finish (i32.const 0) (i32.const 32)))

  ;; AVIStreamFindSample(pavi, lPos, lFlags) -> sample position, or -1.
  (func $handle_AVIStreamFindSample (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32) (local $sb i32) (local $pos i32) (local $n i32) (local $start i32)
    (local $t i32) (local $dir i32) (local $type i32) (local $step i32) (local $e i32) (local $hit i32) (local $i i32)
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (if (i32.eqz (local.get $srec)) (then (call $amstream_finish (i32.const -1) (i32.const 16)) (return)))
    ;; Only FIND_POS answers are returned here.
    (if (i32.and (local.get $arg2) (i32.const 0xF000))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (local.set $sb (call $avi_stream_block (local.get $srec)))
    (local.set $start (i32.load offset=28 (local.get $sb)))
    (local.set $n (i32.load offset=0x54 (local.get $sb)))
    (local.set $dir (i32.and (local.get $arg2) (i32.const 0x0F)))
    (local.set $type (i32.and (local.get $arg2) (i32.const 0xF0)))
    (local.set $pos (i32.sub (local.get $arg1) (local.get $start)))
    (if (i32.and (local.get $dir) (i32.const 8)) (then (local.set $pos (i32.const 0)) (local.set $dir (i32.const 1))))
    (if (i32.eqz (local.get $dir)) (then (local.set $dir (i32.const 1))))   ;; FIND_NEXT
    (local.set $step (select (i32.const -1) (i32.const 1) (i32.eq (local.get $dir) (i32.const 4))))
    (local.set $hit (i32.const -1))
    (if (i32.eq (local.get $type) (i32.const 0x40))
      (then
        ;; FIND_FORMAT: the last format change at or before (or first after) lPos.
        (if (i32.eq (local.get $step) (i32.const -1)) (then (local.set $hit (i32.const 0))))
        (local.set $t (i32.load offset=0x4C (local.get $sb)))
        (block $f_done (loop $f
          (br_if $f_done (i32.ge_u (local.get $i) (i32.load offset=0x50 (local.get $sb))))
          (local.set $e (i32.load offset=12 (i32.add (local.get $t) (i32.shl (local.get $i) (i32.const 4)))))
          (if (i32.eq (local.get $step) (i32.const -1))
            (then (if (i32.le_s (local.get $e) (local.get $pos)) (then (local.set $hit (local.get $e)))))
            (else (if (i32.ge_s (local.get $e) (local.get $pos)) (then (local.set $hit (local.get $e)) (br $f_done)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $f)))
        (call $amstream_finish (select (i32.const -1) (i32.add (local.get $hit) (local.get $start)) (i32.lt_s (local.get $hit) (i32.const 0))) (i32.const 16))
        (return)))
    (if (i32.and (i32.ne (local.get $type) (i32.const 0x10)) (i32.ne (local.get $type) (i32.const 0x20)))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    ;; Fixed-size (audio) samples are all key and all present.
    (if (i32.load offset=0x58 (local.get $sb))
      (then
        (call $amstream_finish (select (i32.add (local.get $pos) (local.get $start)) (i32.const -1) (i32.and (i32.ge_s (local.get $pos) (i32.const 0)) (i32.lt_s (local.get $pos) (local.get $n)))) (i32.const 16))
        (return)))
    (if (i32.ge_s (local.get $pos) (local.get $n))
      (then (local.set $pos (select (i32.sub (local.get $n) (i32.const 1)) (local.get $n)
        (i32.eq (local.get $step) (i32.const -1))))))
    (local.set $t (i32.load offset=0x44 (local.get $sb)))
    (block $found (loop $walk
      (br_if $found (i32.or (i32.lt_s (local.get $pos) (i32.const 0)) (i32.ge_s (local.get $pos) (local.get $n))))
      (local.set $e (i32.add (local.get $t) (i32.shl (local.get $pos) (i32.const 4))))
      (if (i32.eq (local.get $type) (i32.const 0x10))
        (then (if (i32.and (i32.load offset=8 (local.get $e)) (i32.const 0x10))
          (then (local.set $hit (local.get $pos)) (br $found))))
        (else (if (i32.load offset=4 (local.get $e))
          (then (local.set $hit (local.get $pos)) (br $found)))))
      (local.set $pos (i32.add (local.get $pos) (local.get $step)))
      (br $walk)))
    (call $amstream_finish (select (i32.const -1) (i32.add (local.get $hit) (local.get $start)) (i32.lt_s (local.get $hit) (i32.const 0))) (i32.const 16)))

  ;; Sample <-> millisecond conversion, clamped to the stream, as VfW rounds
  ;; it: down for rates under 1000 per second, up for faster (audio) ones.

  ;; AVIStreamSampleToTime(pavi, lSample) -> ms
  (func $handle_AVIStreamSampleToTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32) (local $sb i32) (local $scale i64) (local $rate i64) (local $s i32) (local $num i64)
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (if (i32.eqz (local.get $srec)) (then (call $amstream_finish (i32.const -1) (i32.const 12)) (return)))
    (local.set $sb (call $avi_stream_block (local.get $srec)))
    (local.set $scale (i64.extend_i32_u (i32.load offset=20 (local.get $sb))))
    (local.set $rate (i64.extend_i32_u (i32.load offset=24 (local.get $sb))))
    (if (i32.or (i64.eqz (local.get $rate)) (i64.eqz (local.get $scale)))
      (then (call $amstream_finish (i32.const -1) (i32.const 12)) (return)))
    (local.set $s (local.get $arg1))
    (if (i32.lt_s (local.get $s) (i32.load offset=28 (local.get $sb)))
      (then (local.set $s (i32.load offset=28 (local.get $sb)))))
    (if (i32.gt_s (local.get $s) (i32.add (i32.load offset=28 (local.get $sb)) (i32.load offset=0x54 (local.get $sb))))
      (then (local.set $s (i32.add (i32.load offset=28 (local.get $sb)) (i32.load offset=0x54 (local.get $sb))))))
    (local.set $num (i64.mul (i64.mul (i64.extend_i32_s (local.get $s)) (local.get $scale)) (i64.const 1000)))
    (if (i64.ge_u (i64.div_u (local.get $rate) (local.get $scale)) (i64.const 1000))
      (then (local.set $num (i64.add (local.get $num) (i64.sub (local.get $rate) (i64.const 1))))))
    (call $amstream_finish (i32.wrap_i64 (i64.div_s (local.get $num) (local.get $rate))) (i32.const 12)))

  ;; AVIStreamTimeToSample(pavi, lTime) -> sample
  (func $handle_AVIStreamTimeToSample (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $srec i32) (local $sb i32) (local $scale i64) (local $rate i64) (local $s i32) (local $num i64) (local $den i64)
    (local.set $srec (call $avi_stream_of (local.get $arg0)))
    (if (i32.eqz (local.get $srec)) (then (call $amstream_finish (i32.const -1) (i32.const 12)) (return)))
    (local.set $sb (call $avi_stream_block (local.get $srec)))
    (local.set $scale (i64.extend_i32_u (i32.load offset=20 (local.get $sb))))
    (local.set $rate (i64.extend_i32_u (i32.load offset=24 (local.get $sb))))
    (if (i32.or (i64.eqz (local.get $rate)) (i64.eqz (local.get $scale)))
      (then (call $amstream_finish (i32.const -1) (i32.const 12)) (return)))
    (local.set $den (i64.mul (local.get $scale) (i64.const 1000)))
    (local.set $num (i64.mul (local.get $rate) (i64.extend_i32_s (local.get $arg1))))
    (if (i64.ge_u (i64.div_u (local.get $rate) (local.get $scale)) (i64.const 1000))
      (then (local.set $num (i64.add (local.get $num) (i64.sub (local.get $den) (i64.const 1))))))
    (local.set $s (i32.wrap_i64 (i64.div_s (local.get $num) (local.get $den))))
    (if (i32.lt_s (local.get $s) (i32.load offset=28 (local.get $sb)))
      (then (local.set $s (i32.load offset=28 (local.get $sb)))))
    (if (i32.gt_s (local.get $s) (i32.add (i32.load offset=28 (local.get $sb)) (i32.load offset=0x54 (local.get $sb))))
      (then (local.set $s (i32.add (i32.load offset=28 (local.get $sb)) (i32.load offset=0x54 (local.get $sb))))))
    (call $amstream_finish (local.get $s) (i32.const 12)))
