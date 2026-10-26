  ;; ---- Video for Windows decoders (docs/video-support-design.md) ----
  ;;
  ;; Pure functions over WASM linear-memory addresses: no guest pointers, no
  ;; globals, no host calls. The ICM layer translates guest buffers and owns
  ;; the state blocks; tools/avi-player/ compiles this same file into a
  ;; standalone module to check it against ffmpeg and to play corpus movies.
  ;;
  ;; Every decoder writes a persistent top-down frame of 32-bit pixels in DIB
  ;; byte order (B, G, R, 0 — the RGBQUAD layout), so an inter frame paints
  ;; over the previous picture exactly as a codec's retained buffer does.
  ;; Palettes are 256 RGBQUADs in the same order.

  (func $vid_be16 (param $p i32) (result i32)
    (i32.or (i32.shl (i32.load8_u (local.get $p)) (i32.const 8))
            (i32.load8_u offset=1 (local.get $p))))

  (func $vid_be24 (param $p i32) (result i32)
    (i32.or (i32.shl (i32.load8_u (local.get $p)) (i32.const 16))
            (call $vid_be16 (i32.add (local.get $p) (i32.const 1)))))

  (func $vid_be32 (param $p i32) (result i32)
    (i32.or (i32.shl (call $vid_be16 (local.get $p)) (i32.const 16))
            (call $vid_be16 (i32.add (local.get $p) (i32.const 2)))))

  (func $vid_clamp8 (param $v i32) (result i32)
    (if (result i32) (i32.lt_s (local.get $v) (i32.const 0))
      (then (i32.const 0))
      (else (select (i32.const 255) (local.get $v)
              (i32.gt_s (local.get $v) (i32.const 255))))))

  ;; ---- Cinepak ('cvid') ----
  ;;
  ;; Frame: {flags8, size24, w16, h16, strips16} then strips
  ;; {id16, size16, y1, x1, y2, x2} (a zero y1 is relative to the previous
  ;; strip) holding chunks {id8, size24}. Codebook entries are 2x2 blocks:
  ;; Y0..Y3 plus signed U,V (or Y only in the 4-byte grey form), converted as
  ;; R = Y + 2V, G = Y - U/2 - V (truncating), B = Y + 2U. Big-endian
  ;; throughout.
  ;;
  ;; State block: $VID_CVID_STATE_SIZE bytes, zeroed before the first frame.
  ;;   +64 + i*8192  strip i: +0 V4 book, +4096 V1 book,
  ;;                 256 entries x 4 pixels x 4 bytes each.
  ;; Books persist per strip index across frames; strip i > 0 starts from
  ;; strip i-1's books unless frame flag bit 0 is set.
  (global $VID_CVID_MAX_STRIPS i32 (i32.const 32))
  (global $VID_CVID_STATE_SIZE i32 (i32.const 262208)) ;; 64 + 32 * 8192

  ;; Chunks 0x20..0x27: bit 0 = partial (32-bit update bitmaps select the
  ;; entries present), bit 2 = 4-byte grey entries instead of 6-byte colour.
  (func $vid_cvid_codebook (param $cb i32) (param $id i32) (param $p i32) (param $end i32)
    (local $n i32) (local $partial i32) (local $flag i32) (local $mask i32)
    (local $i i32) (local $e i32) (local $k i32) (local $y i32)
    (local $u i32) (local $v i32) (local $hu i32)
    (local.set $n (select (i32.const 4) (i32.const 6)
      (i32.ne (i32.and (local.get $id) (i32.const 4)) (i32.const 0))))
    (local.set $partial (i32.and (local.get $id) (i32.const 1)))
    (block $done
      (loop $entry
        (br_if $done (i32.ge_u (local.get $i) (i32.const 256)))
        (block $next
          (if (local.get $partial)
            (then
              (local.set $mask (i32.shr_u (local.get $mask) (i32.const 1)))
              (if (i32.eqz (local.get $mask))
                (then
                  (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)))
                  (local.set $flag (call $vid_be32 (local.get $p)))
                  (local.set $p (i32.add (local.get $p) (i32.const 4)))
                  (local.set $mask (i32.const 0x80000000))))
              (br_if $next (i32.eqz (i32.and (local.get $flag) (local.get $mask))))))
          (br_if $done (i32.gt_u (i32.add (local.get $p) (local.get $n)) (local.get $end)))
          (local.set $e (i32.add (local.get $cb) (i32.shl (local.get $i) (i32.const 4))))
          (if (i32.eq (local.get $n) (i32.const 6))
            (then
              (local.set $u (i32.load8_s offset=4 (local.get $p)))
              (local.set $v (i32.load8_s offset=5 (local.get $p)))
              (local.set $hu (i32.div_s (local.get $u) (i32.const 2)))))
          (local.set $k (i32.const 0))
          (loop $pix
            (local.set $y (i32.load8_u (i32.add (local.get $p) (local.get $k))))
            (i32.store (i32.add (local.get $e) (i32.shl (local.get $k) (i32.const 2)))
              (if (result i32) (i32.eq (local.get $n) (i32.const 4))
                (then (i32.mul (local.get $y) (i32.const 0x010101)))
                (else
                  (i32.or
                    (i32.or
                      (i32.shl (call $vid_clamp8 (i32.add (local.get $y) (i32.shl (local.get $v) (i32.const 1))))
                               (i32.const 16))
                      (i32.shl (call $vid_clamp8
                                 (i32.sub (i32.sub (local.get $y) (local.get $hu)) (local.get $v)))
                               (i32.const 8)))
                    (call $vid_clamp8 (i32.add (local.get $y) (i32.shl (local.get $u) (i32.const 1))))))))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br_if $pix (i32.lt_u (local.get $k) (i32.const 4))))
          (local.set $p (i32.add (local.get $p) (local.get $n))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $entry))))

  ;; One pixel of the frame, clipped to the picture.
  (func $vid_put (param $frame i32) (param $w i32) (param $h i32)
                 (param $x i32) (param $y i32) (param $c i32)
    (if (i32.and (i32.lt_u (local.get $x) (local.get $w))
                 (i32.lt_u (local.get $y) (local.get $h)))
      (then
        (i32.store
          (i32.add (local.get $frame)
            (i32.shl (i32.add (i32.mul (local.get $y) (local.get $w)) (local.get $x)) (i32.const 2)))
          (local.get $c)))))

  ;; Chunks 0x30 (intra: one bit per 4x4 block, 1 = V4, 0 = V1), 0x31 (inter:
  ;; a keep/update bit first, then the V4/V1 bit) and 0x32 (V1 only, no bits).
  ;; V1 blows one entry up to 4x4; V4 tiles four entries TL, TR, BL, BR.
  (func $vid_cvid_vectors (param $strip i32) (param $id i32) (param $p i32) (param $end i32)
                          (param $x1 i32) (param $y1 i32) (param $x2 i32) (param $y2 i32)
                          (param $frame i32) (param $w i32) (param $h i32)
    (local $flag i32) (local $mask i32) (local $x i32) (local $y i32)
    (local $e i32) (local $b i32) (local $k i32) (local $bx i32) (local $by i32) (local $c i32)
    (local.set $y (local.get $y1))
    (block $done
      (loop $rows
        (br_if $done (i32.ge_s (local.get $y) (local.get $y2)))
        (local.set $x (local.get $x1))
        (block $row_done
          (loop $cols
            (br_if $row_done (i32.ge_s (local.get $x) (local.get $x2)))
            (block $next
              (if (i32.and (local.get $id) (i32.const 1))
                (then
                  (local.set $mask (i32.shr_u (local.get $mask) (i32.const 1)))
                  (if (i32.eqz (local.get $mask))
                    (then
                      (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)))
                      (local.set $flag (call $vid_be32 (local.get $p)))
                      (local.set $p (i32.add (local.get $p) (i32.const 4)))
                      (local.set $mask (i32.const 0x80000000))))
                  ;; inter: a clear bit keeps the block from the last frame
                  (br_if $next (i32.eqz (i32.and (local.get $flag) (local.get $mask))))))
              (if (i32.eqz (i32.and (local.get $id) (i32.const 2)))
                (then
                  (local.set $mask (i32.shr_u (local.get $mask) (i32.const 1)))
                  (if (i32.eqz (local.get $mask))
                    (then
                      (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)))
                      (local.set $flag (call $vid_be32 (local.get $p)))
                      (local.set $p (i32.add (local.get $p) (i32.const 4)))
                      (local.set $mask (i32.const 0x80000000))))))
              (if (i32.or (i32.ne (i32.and (local.get $id) (i32.const 2)) (i32.const 0))
                          (i32.eqz (i32.and (local.get $flag) (local.get $mask))))
                (then
                  ;; V1: entry pixel k fills the 2x2 quadrant k.
                  (br_if $done (i32.ge_u (local.get $p) (local.get $end)))
                  (local.set $e (i32.add (i32.add (local.get $strip) (i32.const 4096))
                    (i32.shl (i32.load8_u (local.get $p)) (i32.const 4))))
                  (local.set $p (i32.add (local.get $p) (i32.const 1)))
                  (local.set $k (i32.const 0))
                  (loop $quad
                    (local.set $c (i32.load (i32.add (local.get $e) (i32.shl (local.get $k) (i32.const 2)))))
                    (local.set $bx (i32.add (local.get $x) (i32.shl (i32.and (local.get $k) (i32.const 1)) (i32.const 1))))
                    (local.set $by (i32.add (local.get $y) (i32.and (local.get $k) (i32.const 2))))
                    (call $vid_put (local.get $frame) (local.get $w) (local.get $h) (local.get $bx) (local.get $by) (local.get $c))
                    (call $vid_put (local.get $frame) (local.get $w) (local.get $h)
                      (i32.add (local.get $bx) (i32.const 1)) (local.get $by) (local.get $c))
                    (call $vid_put (local.get $frame) (local.get $w) (local.get $h)
                      (local.get $bx) (i32.add (local.get $by) (i32.const 1)) (local.get $c))
                    (call $vid_put (local.get $frame) (local.get $w) (local.get $h)
                      (i32.add (local.get $bx) (i32.const 1)) (i32.add (local.get $by) (i32.const 1)) (local.get $c))
                    (local.set $k (i32.add (local.get $k) (i32.const 1)))
                    (br_if $quad (i32.lt_u (local.get $k) (i32.const 4)))))
                (else
                  ;; V4: entry b covers 2x2 quadrant b, one pixel per entry pixel.
                  (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)))
                  (local.set $b (i32.const 0))
                  (loop $quads
                    (local.set $e (i32.add (local.get $strip)
                      (i32.shl (i32.load8_u (i32.add (local.get $p) (local.get $b))) (i32.const 4))))
                    (local.set $bx (i32.add (local.get $x) (i32.shl (i32.and (local.get $b) (i32.const 1)) (i32.const 1))))
                    (local.set $by (i32.add (local.get $y) (i32.and (local.get $b) (i32.const 2))))
                    (local.set $k (i32.const 0))
                    (loop $pix
                      (call $vid_put (local.get $frame) (local.get $w) (local.get $h)
                        (i32.add (local.get $bx) (i32.and (local.get $k) (i32.const 1)))
                        (i32.add (local.get $by) (i32.shr_u (local.get $k) (i32.const 1)))
                        (i32.load (i32.add (local.get $e) (i32.shl (local.get $k) (i32.const 2)))))
                      (local.set $k (i32.add (local.get $k) (i32.const 1)))
                      (br_if $pix (i32.lt_u (local.get $k) (i32.const 4))))
                    (local.set $b (i32.add (local.get $b) (i32.const 1)))
                    (br_if $quads (i32.lt_u (local.get $b) (i32.const 4))))
                  (local.set $p (i32.add (local.get $p) (i32.const 4))))))
            (local.set $x (i32.add (local.get $x) (i32.const 4)))
            (br $cols)))
        (local.set $y (i32.add (local.get $y) (i32.const 4)))
        (br $rows))))

  (func $vid_cvid_strip (param $strip i32) (param $p i32) (param $end i32)
                        (param $x1 i32) (param $y1 i32) (param $x2 i32) (param $y2 i32)
                        (param $frame i32) (param $w i32) (param $h i32)
    (local $id i32) (local $size i32)
    (block $done
      (loop $chunk
        (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)))
        (local.set $id (i32.load8_u (local.get $p)))
        (local.set $size (i32.sub (call $vid_be24 (i32.add (local.get $p) (i32.const 1))) (i32.const 4)))
        (local.set $p (i32.add (local.get $p) (i32.const 4)))
        (br_if $done (i32.lt_s (local.get $size) (i32.const 0)))
        (if (i32.gt_u (i32.add (local.get $p) (local.get $size)) (local.get $end))
          (then (local.set $size (i32.sub (local.get $end) (local.get $p)))))
        (if (i32.eq (i32.and (local.get $id) (i32.const 0xF8)) (i32.const 0x20))
          (then
            (call $vid_cvid_codebook
              (select (i32.add (local.get $strip) (i32.const 4096)) (local.get $strip)
                (i32.ne (i32.and (local.get $id) (i32.const 2)) (i32.const 0)))
              (local.get $id) (local.get $p) (i32.add (local.get $p) (local.get $size)))))
        (if (i32.and (i32.ge_u (local.get $id) (i32.const 0x30))
                     (i32.le_u (local.get $id) (i32.const 0x32)))
          (then
            (call $vid_cvid_vectors (local.get $strip) (local.get $id)
              (local.get $p) (i32.add (local.get $p) (local.get $size))
              (local.get $x1) (local.get $y1) (local.get $x2) (local.get $y2)
              (local.get $frame) (local.get $w) (local.get $h))
            (br $done)))
        (local.set $p (i32.add (local.get $p) (local.get $size)))
        (br $chunk))))

  ;; Decode one frame into $frame (w*h pixels). An empty chunk (a drop
  ;; marker) leaves the previous picture. Returns 1 when a frame header was
  ;; present, 0 for an empty chunk, -1 for a malformed strip.
  (func $vid_cvid_decode (param $state i32) (param $src i32) (param $len i32)
                         (param $frame i32) (param $w i32) (param $h i32) (result i32)
    (local $flags i32) (local $n i32) (local $p i32) (local $end i32) (local $i i32)
    (local $strip i32) (local $x1 i32) (local $y1 i32) (local $x2 i32) (local $y2 i32)
    (local $y0 i32) (local $size i32)
    (if (i32.lt_u (local.get $len) (i32.const 10)) (then (return (i32.const 0))))
    (local.set $flags (i32.load8_u (local.get $src)))
    (local.set $n (call $vid_be16 (i32.add (local.get $src) (i32.const 8))))
    (if (i32.gt_u (local.get $n) (global.get $VID_CVID_MAX_STRIPS))
      (then (local.set $n (global.get $VID_CVID_MAX_STRIPS))))
    (local.set $p (i32.add (local.get $src) (i32.const 10)))
    (local.set $end (i32.add (local.get $src) (local.get $len)))
    (block $done
      (loop $strips
        (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
        (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 12)) (local.get $end)))
        (local.set $strip (i32.add (i32.add (local.get $state) (i32.const 64))
          (i32.shl (local.get $i) (i32.const 13))))
        (if (i32.and (i32.ne (local.get $i) (i32.const 0))
                     (i32.eqz (i32.and (local.get $flags) (i32.const 1))))
          (then (memory.copy (local.get $strip)
                  (i32.sub (local.get $strip) (i32.const 8192)) (i32.const 8192))))
        (local.set $y1 (call $vid_be16 (i32.add (local.get $p) (i32.const 4))))
        (local.set $x1 (call $vid_be16 (i32.add (local.get $p) (i32.const 6))))
        (local.set $y2 (call $vid_be16 (i32.add (local.get $p) (i32.const 8))))
        (local.set $x2 (call $vid_be16 (i32.add (local.get $p) (i32.const 10))))
        (if (i32.eqz (local.get $y1))
          (then (local.set $y1 (local.get $y0))
                (local.set $y2 (i32.add (local.get $y0) (local.get $y2)))))
        (local.set $size (i32.sub (call $vid_be24 (i32.add (local.get $p) (i32.const 1))) (i32.const 12)))
        (local.set $p (i32.add (local.get $p) (i32.const 12)))
        (if (i32.lt_s (local.get $size) (i32.const 0)) (then (return (i32.const -1))))
        (if (i32.gt_u (i32.add (local.get $p) (local.get $size)) (local.get $end))
          (then (local.set $size (i32.sub (local.get $end) (local.get $p)))))
        (call $vid_cvid_strip (local.get $strip) (local.get $p) (i32.add (local.get $p) (local.get $size))
          (local.get $x1) (local.get $y1) (local.get $x2) (local.get $y2)
          (local.get $frame) (local.get $w) (local.get $h))
        (local.set $p (i32.add (local.get $p) (local.get $size)))
        (local.set $y0 (local.get $y2))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $strips)))
    (i32.const 1))

  ;; ---- BI_RLE8 ----
  ;;
  ;; Pairs (n, c): n copies of index c. After n = 0: 0 end of line, 1 end of
  ;; frame, 2 dx dy skip, 3..255 literal bytes padded to a word. An AVI delta
  ;; frame encodes only what changed, so $plane (w*h indices, top-down) is
  ;; retained between frames and never cleared here.
  (func $vid_rle8_decode (param $plane i32) (param $src i32) (param $len i32)
                         (param $w i32) (param $h i32)
    (local $p i32) (local $end i32) (local $x i32) (local $y i32)
    (local $n i32) (local $c i32) (local $i i32)
    (local.set $p (local.get $src))
    (local.set $end (i32.add (local.get $src) (local.get $len)))
    (block $done
      (loop $pair
        (br_if $done (i32.ge_u (i32.add (local.get $p) (i32.const 1)) (local.get $end)))
        (local.set $n (i32.load8_u (local.get $p)))
        (local.set $c (i32.load8_u offset=1 (local.get $p)))
        (local.set $p (i32.add (local.get $p) (i32.const 2)))
        (if (local.get $n)
          (then
            (local.set $i (i32.const 0))
            (loop $run
              (call $vid_rle8_put (local.get $plane) (local.get $w) (local.get $h)
                (local.get $x) (local.get $y) (local.get $c))
              (local.set $x (i32.add (local.get $x) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br_if $run (i32.lt_u (local.get $i) (local.get $n))))
            (br $pair)))
        (br_if $done (i32.eq (local.get $c) (i32.const 1)))
        (if (i32.eqz (local.get $c))
          (then (local.set $x (i32.const 0))
                (local.set $y (i32.add (local.get $y) (i32.const 1)))
                (br $pair)))
        (if (i32.eq (local.get $c) (i32.const 2))
          (then
            (br_if $done (i32.ge_u (i32.add (local.get $p) (i32.const 1)) (local.get $end)))
            (local.set $x (i32.add (local.get $x) (i32.load8_u (local.get $p))))
            (local.set $y (i32.add (local.get $y) (i32.load8_u offset=1 (local.get $p))))
            (local.set $p (i32.add (local.get $p) (i32.const 2)))
            (br $pair)))
        (local.set $i (i32.const 0))
        (loop $lit
          (br_if $done (i32.ge_u (local.get $p) (local.get $end)))
          (call $vid_rle8_put (local.get $plane) (local.get $w) (local.get $h)
            (local.get $x) (local.get $y) (i32.load8_u (local.get $p)))
          (local.set $x (i32.add (local.get $x) (i32.const 1)))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $lit (i32.lt_u (local.get $i) (local.get $c))))
        (local.set $p (i32.add (local.get $p) (i32.and (local.get $c) (i32.const 1))))
        (br $pair))))

  ;; RLE rows count bottom-up; the plane is stored top-down.
  (func $vid_rle8_put (param $plane i32) (param $w i32) (param $h i32)
                      (param $x i32) (param $y i32) (param $c i32)
    (if (i32.and (i32.lt_u (local.get $x) (local.get $w))
                 (i32.lt_u (local.get $y) (local.get $h)))
      (then
        (i32.store8
          (i32.add (local.get $plane)
            (i32.add (i32.mul (i32.sub (i32.sub (local.get $h) (i32.const 1)) (local.get $y))
                              (local.get $w))
                     (local.get $x)))
          (local.get $c)))))

  ;; Expand $count palette indices into frame pixels.
  (func $vid_index_to_bgrx (param $plane i32) (param $pal i32) (param $frame i32) (param $count i32)
    (local $i i32)
    (block $done
      (loop $px
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        (i32.store (i32.add (local.get $frame) (i32.shl (local.get $i) (i32.const 2)))
          (i32.and (i32.load (i32.add (local.get $pal)
                     (i32.shl (i32.load8_u (i32.add (local.get $plane) (local.get $i))) (i32.const 2))))
                   (i32.const 0x00FFFFFF)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $px))))

  ;; ---- BI_RGB ----
  ;;
  ;; Rows padded to 4 bytes, bottom-up unless $top_down. 8 bpp through $pal,
  ;; 16 bpp RGB555 widened as (v << 3) | (v >> 2), 24 bpp BGR, 32 bpp BGRX.
  (func $vid_raw_decode (param $src i32) (param $len i32) (param $pal i32) (param $bpp i32)
                        (param $w i32) (param $h i32) (param $top_down i32) (param $frame i32)
    (local $stride i32) (local $x i32) (local $y i32) (local $row i32) (local $o i32)
    (local $v i32) (local $r i32) (local $g i32) (local $b i32)
    (local.set $stride (i32.shl (i32.shr_u (i32.add (i32.mul (local.get $w) (local.get $bpp))
      (i32.const 31)) (i32.const 5)) (i32.const 2)))
    (block $done
      (loop $rows
        (br_if $done (i32.ge_u (local.get $y) (local.get $h)))
        (local.set $row (i32.mul (local.get $stride)
          (select (local.get $y) (i32.sub (i32.sub (local.get $h) (i32.const 1)) (local.get $y))
            (local.get $top_down))))
        (br_if $done (i32.gt_u (i32.add (local.get $row) (local.get $stride)) (local.get $len)))
        (local.set $row (i32.add (local.get $src) (local.get $row)))
        (local.set $o (i32.add (local.get $frame)
          (i32.shl (i32.mul (local.get $y) (local.get $w)) (i32.const 2))))
        (local.set $x (i32.const 0))
        (block $row_done
          (loop $cols
            (br_if $row_done (i32.ge_u (local.get $x) (local.get $w)))
            (if (i32.eq (local.get $bpp) (i32.const 8))
              (then (local.set $v (i32.and (i32.load (i32.add (local.get $pal)
                      (i32.shl (i32.load8_u (i32.add (local.get $row) (local.get $x))) (i32.const 2))))
                      (i32.const 0x00FFFFFF)))))
            (if (i32.eq (local.get $bpp) (i32.const 16))
              (then
                (local.set $v (i32.load16_u (i32.add (local.get $row) (i32.shl (local.get $x) (i32.const 1)))))
                (local.set $r (i32.and (i32.shr_u (local.get $v) (i32.const 10)) (i32.const 31)))
                (local.set $g (i32.and (i32.shr_u (local.get $v) (i32.const 5)) (i32.const 31)))
                (local.set $b (i32.and (local.get $v) (i32.const 31)))
                (local.set $v (i32.or (i32.or
                  (i32.shl (i32.or (i32.shl (local.get $r) (i32.const 3)) (i32.shr_u (local.get $r) (i32.const 2))) (i32.const 16))
                  (i32.shl (i32.or (i32.shl (local.get $g) (i32.const 3)) (i32.shr_u (local.get $g) (i32.const 2))) (i32.const 8)))
                  (i32.or (i32.shl (local.get $b) (i32.const 3)) (i32.shr_u (local.get $b) (i32.const 2)))))))
            (if (i32.eq (local.get $bpp) (i32.const 24))
              (then (local.set $v (i32.or (i32.load16_u (i32.add (local.get $row) (i32.mul (local.get $x) (i32.const 3))))
                      (i32.shl (i32.load8_u offset=2 (i32.add (local.get $row) (i32.mul (local.get $x) (i32.const 3))))
                               (i32.const 16))))))
            (if (i32.eq (local.get $bpp) (i32.const 32))
              (then (local.set $v (i32.and (i32.load (i32.add (local.get $row) (i32.shl (local.get $x) (i32.const 2))))
                      (i32.const 0x00FFFFFF)))))
            (i32.store (i32.add (local.get $o) (i32.shl (local.get $x) (i32.const 2))) (local.get $v))
            (local.set $x (i32.add (local.get $x) (i32.const 1)))
            (br $cols)))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br $rows))))

  ;; '##pc' AVIPALCHANGE: {first8, count8 (0 = 256), flags16, PALETTEENTRY
  ;; {r, g, b, flags}[count]} into the RGBQUAD palette at $pal.
  (func $vid_palette_change (param $pal i32) (param $src i32) (param $len i32)
    (local $first i32) (local $count i32) (local $i i32) (local $s i32)
    (if (i32.lt_u (local.get $len) (i32.const 4)) (then (return)))
    (local.set $first (i32.load8_u (local.get $src)))
    (local.set $count (i32.load8_u offset=1 (local.get $src)))
    (if (i32.eqz (local.get $count)) (then (local.set $count (i32.const 256))))
    (block $done
      (loop $entry
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $s (i32.add (local.get $src) (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 2)))))
        (br_if $done (i32.gt_u (i32.add (local.get $s) (i32.const 4)) (i32.add (local.get $src) (local.get $len))))
        (i32.store (i32.add (local.get $pal)
                     (i32.shl (i32.and (i32.add (local.get $first) (local.get $i)) (i32.const 255)) (i32.const 2)))
          (i32.or (i32.or (i32.shl (i32.load8_u (local.get $s)) (i32.const 16))
                          (i32.shl (i32.load8_u offset=1 (local.get $s)) (i32.const 8)))
                  (i32.load8_u offset=2 (local.get $s))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $entry))))

  ;; ---- Microsoft Video 1 ('CRAM' / 'MSVC' / 'WHAM') ----
  ;;
  ;; 4x4 blocks, block rows bottom-up, left to right. Each block opens with a
  ;; little-endian flags word, bytes a then b:
  ;;   b & 0xFC == 0x84  skip ((b - 0x84) << 8 | a) blocks, this one included
  ;;                     (a count of 0 skips the rest of the frame)
  ;;   b < 0x80          two colours C0 C1 follow; flag bit k set = C0.
  ;;                     16 bpp: bit 15 of C0 set means eight colours follow,
  ;;                     one pair per 2x2 quadrant (bottom-left, bottom-right,
  ;;                     top-left, top-right)
  ;;   otherwise         16 bpp: the flags word is the one colour;
  ;;                     8 bpp: 0x90 and up = eight index bytes as above,
  ;;                     else index a fills the block
  ;; Flag bits run from the block's bottom row up, left to right in each row.
  ;; 16 bpp colours are RGB555 (bit 15 ignored) and go straight to $dst as
  ;; frame pixels; 8 bpp writes palette indices into $dst, a w*h top-down
  ;; plane, which $vid_index_to_bgrx then paints (as RLE8 does). Both are
  ;; retained: a skipped block keeps the previous frame's pixels.
  (func $vid_rgb555_bgrx (param $v i32) (result i32)
    (local $r i32) (local $g i32) (local $b i32)
    (local.set $r (i32.and (i32.shr_u (local.get $v) (i32.const 10)) (i32.const 31)))
    (local.set $g (i32.and (i32.shr_u (local.get $v) (i32.const 5)) (i32.const 31)))
    (local.set $b (i32.and (local.get $v) (i32.const 31)))
    (i32.or (i32.or
      (i32.shl (i32.or (i32.shl (local.get $r) (i32.const 3)) (i32.shr_u (local.get $r) (i32.const 2))) (i32.const 16))
      (i32.shl (i32.or (i32.shl (local.get $g) (i32.const 3)) (i32.shr_u (local.get $g) (i32.const 2))) (i32.const 8)))
      (i32.or (i32.shl (local.get $b) (i32.const 3)) (i32.shr_u (local.get $b) (i32.const 2)))))

  ;; $bpp is 8 or 16. A short chunk stops the frame where the data runs out.
  (func $vid_cram_decode (param $dst i32) (param $src i32) (param $len i32)
                         (param $w i32) (param $h i32) (param $bpp i32)
    (local $p i32) (local $end i32) (local $wide i32) (local $bx i32) (local $by i32)
    (local $x0 i32) (local $y0 i32) (local $skip i32) (local $a i32) (local $b i32)
    (local $flags i32) (local $mode i32) (local $colors i32) (local $wide16 i32)
    (local $k i32) (local $px i32) (local $py i32) (local $idx i32) (local $v i32) (local $o i32)
    (local.set $wide16 (i32.eq (local.get $bpp) (i32.const 16)))
    (local.set $wide (i32.shr_u (local.get $w) (i32.const 2)))
    (local.set $p (local.get $src))
    (local.set $end (i32.add (local.get $src) (local.get $len)))
    (block $done
      (loop $rows
        (br_if $done (i32.ge_u (local.get $by) (i32.shr_u (local.get $h) (i32.const 2))))
        ;; top row of this block row in the top-down picture
        (local.set $y0 (i32.sub (i32.sub (local.get $h) (i32.const 4))
                                (i32.shl (local.get $by) (i32.const 2))))
        (local.set $bx (i32.const 0))
        (block $row_done
          (loop $cols
            (br_if $row_done (i32.ge_u (local.get $bx) (local.get $wide)))
            (block $next
              (if (local.get $skip)
                (then (local.set $skip (i32.sub (local.get $skip) (i32.const 1)))
                      (br $next)))
              (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 2)) (local.get $end)))
              (local.set $a (i32.load8_u (local.get $p)))
              (local.set $b (i32.load8_u offset=1 (local.get $p)))
              (local.set $p (i32.add (local.get $p) (i32.const 2)))
              (local.set $flags (i32.or (i32.shl (local.get $b) (i32.const 8)) (local.get $a)))
              (if (i32.eq (i32.and (local.get $b) (i32.const 0xFC)) (i32.const 0x84))
                (then
                  (local.set $skip (i32.sub (i32.add (i32.shl (i32.sub (local.get $b) (i32.const 0x84)) (i32.const 8))
                                                     (local.get $a))
                                            (i32.const 1)))
                  (br $next)))
              ;; mode 0 = one colour ($v), 1 = two colours, 2 = eight, at $colors
              (local.set $mode (i32.const 0))
              (local.set $v (select (local.get $flags) (local.get $a) (local.get $wide16)))
              (local.set $colors (local.get $p))
              (if (i32.lt_u (local.get $b) (i32.const 0x80))
                (then
                  (local.set $mode (i32.const 1))
                  (if (local.get $wide16)
                    (then
                      (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)))
                      (if (i32.ne (i32.and (i32.load8_u offset=1 (local.get $p)) (i32.const 0x80)) (i32.const 0))
                        (then (local.set $mode (i32.const 2)))))))
                (else
                  (if (i32.and (i32.eqz (local.get $wide16)) (i32.ge_u (local.get $b) (i32.const 0x90)))
                    (then (local.set $mode (i32.const 2))))))
              (if (i32.eq (local.get $mode) (i32.const 1))
                (then (local.set $o (i32.shl (i32.const 2) (local.get $wide16)))))
              (if (i32.eq (local.get $mode) (i32.const 2))
                (then (local.set $o (i32.shl (i32.const 8) (local.get $wide16)))))
              (if (local.get $mode)
                (then
                  (br_if $done (i32.gt_u (i32.add (local.get $p) (local.get $o)) (local.get $end)))
                  (local.set $p (i32.add (local.get $p) (local.get $o)))))
              (local.set $x0 (i32.shl (local.get $bx) (i32.const 2)))
              (local.set $k (i32.const 0))
              (loop $pix
                (local.set $px (i32.and (local.get $k) (i32.const 3)))
                (local.set $py (i32.shr_u (local.get $k) (i32.const 2)))   ;; 0 = bottom row
                (if (local.get $mode)
                  (then
                    (local.set $idx (i32.xor (i32.and (i32.shr_u (local.get $flags) (local.get $k)) (i32.const 1))
                                             (i32.const 1)))
                    (if (i32.eq (local.get $mode) (i32.const 2))
                      (then (local.set $idx (i32.add (local.get $idx)
                              (i32.add (i32.shl (i32.and (local.get $py) (i32.const 2)) (i32.const 1))
                                       (i32.and (local.get $px) (i32.const 2)))))))
                    (local.set $v
                      (if (result i32) (local.get $wide16)
                        (then (i32.load16_u (i32.add (local.get $colors) (i32.shl (local.get $idx) (i32.const 1)))))
                        (else (i32.load8_u (i32.add (local.get $colors) (local.get $idx))))))))
                (local.set $o (i32.add
                  (i32.mul (i32.sub (i32.add (local.get $y0) (i32.const 3)) (local.get $py)) (local.get $w))
                  (i32.add (local.get $x0) (local.get $px))))
                (if (local.get $wide16)
                  (then (i32.store (i32.add (local.get $dst) (i32.shl (local.get $o) (i32.const 2)))
                          (call $vid_rgb555_bgrx (local.get $v))))
                  (else (i32.store8 (i32.add (local.get $dst) (local.get $o)) (local.get $v))))
                (local.set $k (i32.add (local.get $k) (i32.const 1)))
                (br_if $pix (i32.lt_u (local.get $k) (i32.const 16)))))
            (local.set $bx (i32.add (local.get $bx) (i32.const 1)))
            (br $cols)))
        (local.set $by (i32.add (local.get $by) (i32.const 1)))
        (br $rows))))
