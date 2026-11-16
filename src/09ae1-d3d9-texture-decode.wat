  ;; ============================================================
  ;; D3D9/D3D8 texture upload decode: guest texel formats -> A8B8G8R8.
  ;; ============================================================
  ;; GPU stream v2 slice 9.1. The executor contract (docs/gpu-stream-v2-
  ;; migration.md section 0, "Formats") accepts only A8B8G8R8 colour, so WAT
  ;; converts every guest texture format at upload. This replaces the JS
  ;; decoders that lived in lib/d3d9-texture.js (DXT) and inline in
  ;; lib/d3d9-host.js captureDraw (every uncompressed format); the outputs are
  ;; bit-exact with those (test/test-d3d9-texture-decode-wat.js replays a
  ;; fixture generated from the old JS before it was deleted).
  ;;
  ;; Guest storage stays in its own format: decoding is an upload conversion,
  ;; never an edit of the authoritative bytes.
  ;;
  ;; This fragment is deliberately PURE: wasm addresses in, wasm addresses out,
  ;; no globals, no regions and no calls outside itself, so a unit test can
  ;; compile it on its own into a tiny module (test/helpers/wat-texture-
  ;; decoder.js). The level/scratch plumbing that the host calls lives in
  ;; 09ae-d3d9-resources.wat ($d3d9_texture_decode_level_rows).
  ;;
  ;; Output pixel = one little-endian u32  R | G<<8 | B<<16 | A<<24, i.e. bytes
  ;; R,G,B,A in memory order, rows tightly packed at width*4.

  ;; The $bits-wide field of $v at bit $shift, replicated into 8 bits (high
  ;; bits copied into the low ones) so an all-ones field reaches 255. Only the
  ;; 5- and 6-bit widths occur: (f << (8-bits)) | (f >> (2*bits-8)).
  (func $d3d9_tex_widen (param $v i32) (param $shift i32) (param $bits i32) (result i32)
    (local $f i32)
    (local.set $f (i32.and (i32.shr_u (local.get $v) (local.get $shift))
      (i32.sub (i32.shl (i32.const 1) (local.get $bits)) (i32.const 1))))
    (i32.or (i32.shl (local.get $f) (i32.sub (i32.const 8) (local.get $bits)))
      (i32.shr_u (local.get $f) (i32.sub (i32.shl (local.get $bits) (i32.const 1)) (i32.const 8)))))

  ;; RGB565 -> packed opaque RGBA.
  (func $d3d9_tex_565 (param $c i32) (result i32)
    (i32.or (i32.or
      (call $d3d9_tex_widen (local.get $c) (i32.const 11) (i32.const 5))
      (i32.shl (call $d3d9_tex_widen (local.get $c) (i32.const 5) (i32.const 6)) (i32.const 8)))
      (i32.or
        (i32.shl (call $d3d9_tex_widen (local.get $c) (i32.const 0) (i32.const 5)) (i32.const 16))
        (i32.const 0xFF000000))))

  ;; Per-channel blend of two packed opaque colours: floor((wa*a + wb*b + bias)
  ;; / div) on R, G and B; alpha forced to 255. Matches the JS
  ;; Math.floor((2*v+o+1)/3), ((v+2*o+1)/3) and ((v+o)/2) forms exactly.
  (func $d3d9_tex_mix (param $a i32) (param $b i32) (param $wa i32) (param $wb i32)
    (param $bias i32) (param $div i32) (result i32)
    (local $sh i32) (local $out i32)
    (local.set $out (i32.const 0xFF000000))
    (loop $ch
      (local.set $out (i32.or (local.get $out) (i32.shl
        (i32.div_u (i32.add (i32.add
          (i32.mul (local.get $wa) (i32.and (i32.shr_u (local.get $a) (local.get $sh)) (i32.const 255)))
          (i32.mul (local.get $wb) (i32.and (i32.shr_u (local.get $b) (local.get $sh)) (i32.const 255))))
          (local.get $bias)) (local.get $div))
        (local.get $sh))))
      (local.set $sh (i32.add (local.get $sh) (i32.const 8)))
      (br_if $ch (i32.lt_u (local.get $sh) (i32.const 24))))
    (local.get $out))

  ;; DXT5 (and DXT4) interpolated alpha for a 3-bit selector.
  (func $d3d9_tex_dxt5_alpha (param $sel i32) (param $a0 i32) (param $a1 i32) (result i32)
    (local $i i32)
    (if (i32.eqz (local.get $sel)) (then (return (local.get $a0))))
    (if (i32.eq (local.get $sel) (i32.const 1)) (then (return (local.get $a1))))
    (local.set $i (i32.sub (local.get $sel) (i32.const 1)))
    (if (i32.gt_u (local.get $a0) (local.get $a1)) (then
      (return (i32.div_u (i32.add (i32.add
        (i32.mul (i32.sub (i32.const 7) (local.get $i)) (local.get $a0))
        (i32.mul (local.get $i) (local.get $a1))) (i32.const 3)) (i32.const 7)))))
    (if (i32.eq (local.get $sel) (i32.const 6)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $sel) (i32.const 7)) (then (return (i32.const 255))))
    (i32.div_u (i32.add (i32.add
      (i32.mul (i32.sub (i32.const 5) (local.get $i)) (local.get $a0))
      (i32.mul (local.get $i) (local.get $a1))) (i32.const 2)) (i32.const 5)))

  ;; 0 = not block compressed, 1 = DXT1, 3 = DXT2/DXT3 (explicit 4-bit alpha),
  ;; 5 = DXT4/DXT5 (interpolated alpha). DXT2/DXT4 are the premultiplied
  ;; spellings; a D3D sampler returns the stored (premultiplied) colour, so they
  ;; decode exactly like DXT3/DXT5.
  (func $d3d9_tex_dxt_kind (param $format i32) (result i32)
    (if (i32.eq (local.get $format) (i32.const 0x31545844)) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x32545844))
                (i32.eq (local.get $format) (i32.const 0x33545844))) (then (return (i32.const 3))))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x34545844))
                (i32.eq (local.get $format) (i32.const 0x35545844))) (then (return (i32.const 5))))
    (i32.const 0))

  ;; Decode pixel rows [$y0, $y0+$rows) of a DXT level into $dst. $pitch is the
  ;; byte pitch of one row of 4x4 blocks. Pixels outside the level (partial
  ;; edge blocks) and outside the requested band are not written.
  (func $d3d9_tex_decode_dxt (param $src i32) (param $pitch i32) (param $kind i32)
    (param $width i32) (param $height i32) (param $y0 i32) (param $rows i32) (param $dst i32)
    (local $bx i32) (local $by i32) (local $cols i32) (local $by_end i32) (local $y_end i32)
    (local $blk i32) (local $c i32) (local $c0 i32) (local $c1 i32)
    (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $p3 i32)
    (local $idx i32) (local $abits i64) (local $a0 i32) (local $a1 i32)
    (local $i i32) (local $x i32) (local $y i32) (local $sel i32) (local $px i32) (local $bytes i32)
    (local.set $bytes (select (i32.const 8) (i32.const 16) (i32.eq (local.get $kind) (i32.const 1))))
    (local.set $cols (i32.shr_u (i32.add (local.get $width) (i32.const 3)) (i32.const 2)))
    (local.set $y_end (i32.add (local.get $y0) (local.get $rows)))
    (if (i32.gt_u (local.get $y_end) (local.get $height)) (then (local.set $y_end (local.get $height))))
    (if (i32.ge_u (local.get $y0) (local.get $y_end)) (then (return)))
    (local.set $by (i32.shr_u (local.get $y0) (i32.const 2)))
    (local.set $by_end (i32.shr_u (i32.add (local.get $y_end) (i32.const 3)) (i32.const 2)))
    (loop $block_rows
      (local.set $bx (i32.const 0))
      (loop $blocks
        (local.set $blk (i32.add (i32.add (local.get $src) (i32.mul (local.get $by) (local.get $pitch)))
          (i32.mul (local.get $bx) (local.get $bytes))))
        (local.set $c (select (local.get $blk) (i32.add (local.get $blk) (i32.const 8))
          (i32.eq (local.get $kind) (i32.const 1))))
        (local.set $c0 (i32.load16_u (local.get $c)))
        (local.set $c1 (i32.load16_u offset=2 (local.get $c)))
        (local.set $p0 (call $d3d9_tex_565 (local.get $c0)))
        (local.set $p1 (call $d3d9_tex_565 (local.get $c1)))
        ;; Only DXT1 spends the c0<=c1 ordering on a 1-bit alpha mode; the
        ;; explicit-alpha formats always interpolate all four colours.
        (if (i32.or (i32.gt_u (local.get $c0) (local.get $c1)) (i32.ne (local.get $kind) (i32.const 1)))
          (then
            (local.set $p2 (call $d3d9_tex_mix (local.get $p0) (local.get $p1) (i32.const 2) (i32.const 1) (i32.const 1) (i32.const 3)))
            (local.set $p3 (call $d3d9_tex_mix (local.get $p0) (local.get $p1) (i32.const 1) (i32.const 2) (i32.const 1) (i32.const 3))))
          (else
            (local.set $p2 (call $d3d9_tex_mix (local.get $p0) (local.get $p1) (i32.const 1) (i32.const 1) (i32.const 0) (i32.const 2)))
            (local.set $p3 (i32.const 0))))
        (local.set $idx (i32.load offset=4 (local.get $c)))
        (local.set $abits (i64.load (local.get $blk)))
        (local.set $a0 (i32.load8_u (local.get $blk)))
        (local.set $a1 (i32.load8_u offset=1 (local.get $blk)))
        (local.set $i (i32.const 0))
        (loop $texels
          (local.set $x (i32.add (i32.shl (local.get $bx) (i32.const 2)) (i32.and (local.get $i) (i32.const 3))))
          (local.set $y (i32.add (i32.shl (local.get $by) (i32.const 2)) (i32.shr_u (local.get $i) (i32.const 2))))
          (if (i32.and (i32.lt_u (local.get $x) (local.get $width))
                (i32.and (i32.ge_u (local.get $y) (local.get $y0)) (i32.lt_u (local.get $y) (local.get $y_end))))
            (then
              (local.set $sel (i32.and (i32.shr_u (local.get $idx) (i32.shl (local.get $i) (i32.const 1))) (i32.const 3)))
              (local.set $px
                (if (result i32) (i32.lt_u (local.get $sel) (i32.const 2))
                  (then (select (local.get $p1) (local.get $p0) (local.get $sel)))
                  (else (select (local.get $p3) (local.get $p2) (i32.eq (local.get $sel) (i32.const 3))))))
              (if (i32.eq (local.get $kind) (i32.const 5)) (then
                ;; 48-bit little-endian selector field in bytes 2..7.
                (local.set $px (i32.or (i32.and (local.get $px) (i32.const 0x00FFFFFF))
                  (i32.shl (call $d3d9_tex_dxt5_alpha
                    (i32.wrap_i64 (i64.and (i64.shr_u (local.get $abits)
                      (i64.extend_i32_u (i32.add (i32.const 16) (i32.mul (local.get $i) (i32.const 3))))) (i64.const 7)))
                    (local.get $a0) (local.get $a1)) (i32.const 24))))))
              (if (i32.eq (local.get $kind) (i32.const 3)) (then
                ;; Sixteen explicit 4-bit alphas, low nibble first, x17.
                (local.set $px (i32.or (i32.and (local.get $px) (i32.const 0x00FFFFFF))
                  (i32.shl (i32.mul (i32.wrap_i64 (i64.and (i64.shr_u (local.get $abits)
                      (i64.extend_i32_u (i32.shl (local.get $i) (i32.const 2)))) (i64.const 15)))
                    (i32.const 17)) (i32.const 24))))))
              (i32.store (i32.add (local.get $dst)
                (i32.shl (i32.add (i32.mul (i32.sub (local.get $y) (local.get $y0)) (local.get $width)) (local.get $x)) (i32.const 2)))
                (local.get $px))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $texels (i32.lt_u (local.get $i) (i32.const 16))))
        (local.set $bx (i32.add (local.get $bx) (i32.const 1)))
        (br_if $blocks (i32.lt_u (local.get $bx) (local.get $cols))))
      (local.set $by (i32.add (local.get $by) (i32.const 1)))
      (br_if $block_rows (i32.lt_u (local.get $by) (local.get $by_end)))))

  ;; One uncompressed texel at $s -> packed RGBA, or -1 for an unknown format.
  ;; Formats (D3DFORMAT): 20 R8G8B8, 21 A8R8G8B8, 22 X8R8G8B8, 23 R5G6B5,
  ;; 24 X1R5G5B5, 25 A1R5G5B5, 26 A4R4G4B4, 28 A8, 50 L8, 51 A8L8, 62 X8L8V8U8,
  ;; 63 Q8W8V8U8, 81 L16. The signed pair keeps its raw bytes: the bias that
  ;; makes them unsigned belongs to the sampler, not to upload.
  (func $d3d9_tex_texel (param $s i32) (param $format i32) (result i32)
    (local $v i32)
    (block $unknown
      (if (i32.or (i32.eq (local.get $format) (i32.const 21)) (i32.eq (local.get $format) (i32.const 22))) (then
        (local.set $v (i32.load (local.get $s)))
        ;; BGRA in memory -> RGBA: swap bytes 0 and 2.
        (local.set $v (i32.or (i32.and (local.get $v) (i32.const 0xFF00FF00))
          (i32.or (i32.and (i32.shr_u (local.get $v) (i32.const 16)) (i32.const 0xFF))
                  (i32.shl (i32.and (local.get $v) (i32.const 0xFF)) (i32.const 16)))))
        (return (select (i32.or (local.get $v) (i32.const 0xFF000000)) (local.get $v)
          (i32.eq (local.get $format) (i32.const 22))))))
      (if (i32.or (i32.eq (local.get $format) (i32.const 62)) (i32.eq (local.get $format) (i32.const 63)))
        (then (return (i32.load (local.get $s)))))
      (if (i32.eq (local.get $format) (i32.const 20)) (then
        (return (i32.or (i32.or (i32.load8_u offset=2 (local.get $s))
          (i32.shl (i32.load8_u offset=1 (local.get $s)) (i32.const 8)))
          (i32.or (i32.shl (i32.load8_u (local.get $s)) (i32.const 16)) (i32.const 0xFF000000))))))
      (if (i32.eq (local.get $format) (i32.const 23)) (then
        (return (call $d3d9_tex_565 (i32.load16_u (local.get $s))))))
      (if (i32.or (i32.eq (local.get $format) (i32.const 24)) (i32.eq (local.get $format) (i32.const 25))) (then
        (local.set $v (i32.load16_u (local.get $s)))
        (return (i32.or (i32.or
          (call $d3d9_tex_widen (local.get $v) (i32.const 10) (i32.const 5))
          (i32.shl (call $d3d9_tex_widen (local.get $v) (i32.const 5) (i32.const 5)) (i32.const 8)))
          (i32.or (i32.shl (call $d3d9_tex_widen (local.get $v) (i32.const 0) (i32.const 5)) (i32.const 16))
            ;; A1 reads the top bit; X1 ignores it and is opaque.
            (select (i32.const 0xFF000000)
              (select (i32.const 0xFF000000) (i32.const 0) (i32.shr_u (local.get $v) (i32.const 15)))
              (i32.eq (local.get $format) (i32.const 24))))))))
      (if (i32.eq (local.get $format) (i32.const 26)) (then
        (local.set $v (i32.load16_u (local.get $s)))
        ;; Each nibble x17 spans 0..255 exactly.
        (return (i32.or (i32.or
          (i32.mul (i32.and (i32.shr_u (local.get $v) (i32.const 8)) (i32.const 15)) (i32.const 17))
          (i32.shl (i32.mul (i32.and (i32.shr_u (local.get $v) (i32.const 4)) (i32.const 15)) (i32.const 17)) (i32.const 8)))
          (i32.or (i32.shl (i32.mul (i32.and (local.get $v) (i32.const 15)) (i32.const 17)) (i32.const 16))
                  (i32.shl (i32.mul (i32.shr_u (local.get $v) (i32.const 12)) (i32.const 17)) (i32.const 24)))))))
      (if (i32.or (i32.eq (local.get $format) (i32.const 50)) (i32.eq (local.get $format) (i32.const 81))) (then
        ;; Luminance on all three colour channels, opaque. L16 keeps its high
        ;; byte, which is what an 8-bit-per-channel sampler can show.
        (local.set $v (select (i32.load8_u offset=1 (local.get $s)) (i32.load8_u (local.get $s))
          (i32.eq (local.get $format) (i32.const 81))))
        (return (i32.or (i32.mul (local.get $v) (i32.const 0x010101)) (i32.const 0xFF000000)))))
      (if (i32.eq (local.get $format) (i32.const 51)) (then
        ;; A8L8: luminance low byte, alpha high byte.
        (return (i32.or (i32.mul (i32.load8_u (local.get $s)) (i32.const 0x010101))
          (i32.shl (i32.load8_u offset=1 (local.get $s)) (i32.const 24))))))
      (if (i32.eq (local.get $format) (i32.const 28)) (then
        ;; A8: alpha only; colour reads black, as a D3D sampler returns it.
        (return (i32.shl (i32.load8_u (local.get $s)) (i32.const 24))))))
    (i32.const -1))

  ;; Bytes per uncompressed texel, 0 for an unknown format.
  (func $d3d9_tex_decode_texel_bytes (param $format i32) (result i32)
    (if (i32.or (i32.eq (local.get $format) (i32.const 50)) (i32.eq (local.get $format) (i32.const 28)))
      (then (return (i32.const 1))))
    (if (i32.or (i32.or (i32.or (i32.eq (local.get $format) (i32.const 23)) (i32.eq (local.get $format) (i32.const 24)))
                        (i32.or (i32.eq (local.get $format) (i32.const 25)) (i32.eq (local.get $format) (i32.const 26))))
                (i32.or (i32.eq (local.get $format) (i32.const 51)) (i32.eq (local.get $format) (i32.const 81))))
      (then (return (i32.const 2))))
    (if (i32.eq (local.get $format) (i32.const 20)) (then (return (i32.const 3))))
    (if (i32.or (i32.or (i32.eq (local.get $format) (i32.const 21)) (i32.eq (local.get $format) (i32.const 22)))
                (i32.or (i32.eq (local.get $format) (i32.const 62)) (i32.eq (local.get $format) (i32.const 63))))
      (then (return (i32.const 4))))
    (i32.const 0))

  ;; Decode rows [$y0, $y0+$rows) of one level (clipped to $height) into $dst,
  ;; packed at $width*4 per row. $pitch is the source row pitch (a block row for
  ;; DXT). Returns 1, or 0 for a format this decoder does not know -- the caller
  ;; fails fast rather than uploading garbage.
  (func $d3d9_tex_decode (export "d3d9_tex_decode")
    (param $src i32) (param $pitch i32) (param $format i32) (param $width i32) (param $height i32)
    (param $y0 i32) (param $rows i32) (param $dst i32) (result i32)
    (local $kind i32) (local $texel i32) (local $x i32) (local $y i32) (local $y_end i32)
    (local $s i32) (local $d i32)
    (local.set $kind (call $d3d9_tex_dxt_kind (local.get $format)))
    (if (local.get $kind) (then
      (call $d3d9_tex_decode_dxt (local.get $src) (local.get $pitch) (local.get $kind)
        (local.get $width) (local.get $height) (local.get $y0) (local.get $rows) (local.get $dst))
      (return (i32.const 1))))
    (local.set $texel (call $d3d9_tex_decode_texel_bytes (local.get $format)))
    (if (i32.eqz (local.get $texel)) (then (return (i32.const 0))))
    (local.set $y_end (i32.add (local.get $y0) (local.get $rows)))
    (if (i32.gt_u (local.get $y_end) (local.get $height)) (then (local.set $y_end (local.get $height))))
    (if (i32.ge_u (local.get $y0) (local.get $y_end)) (then (return (i32.const 1))))
    (if (i32.eqz (local.get $width)) (then (return (i32.const 1))))
    (local.set $d (local.get $dst))
    (local.set $y (local.get $y0))
    (loop $rows_loop
      (local.set $s (i32.add (local.get $src) (i32.mul (local.get $y) (local.get $pitch))))
      (local.set $x (i32.const 0))
      (loop $cols
        (i32.store (local.get $d) (call $d3d9_tex_texel (local.get $s) (local.get $format)))
        (local.set $s (i32.add (local.get $s) (local.get $texel)))
        (local.set $d (i32.add (local.get $d) (i32.const 4)))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $cols (i32.lt_u (local.get $x) (local.get $width))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $rows_loop (i32.lt_u (local.get $y) (local.get $y_end))))
    (i32.const 1))
