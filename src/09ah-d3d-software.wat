;; Programmable software triangle slice, descriptor ABI1..5 (128 bytes).
;; +0 DSP1 magic, +4 ABI, +8 width,+12 height,+16 BGRA target,+20 pitch,
;; +24 f32 depth target,+28 depth pitch,+32 vertices,+36 count,+40 stride,
;; +44 optional U16 indices,+48 index count,+52 VS packet program,+56 PS program,
;; +60 VS AoS float4 constants,+64 count,+68 PS constants,+72 count,
;; +76 viewport X,+80 Y,+84 W,+88 H,+92 minZ,+96 maxZ,
;; +100 flags(depth-test1/write2/pretransformed-XYZ-RHW4/point-polygon8/point-list16),+104 D3DCMPFUNC,+108 RGBA write mask,
;; +112 D3DCULL,+116 packed VS input-register nibbles (position,color,tex;
;; zero defaults to0x210; FVF mapping v0/v5/v7 is0x750),+120/+124 reserved0.
;; ABI2: +120 UV input count1..4, +124 extra UV1/2/3 register nibbles.
;; ABI3 extends UV count to1..6 and extra UV1..5 nibbles (eight total inputs).
;; ABI4 appends PSIZE float4 after those inputs; +124 bits20..23 select its
;; register, bits24..31 reserved. It does not change the output snapshot ABI.
;; ABI5: +120 total float4 input count3..11; +116 maps first3 registers and
;; +124 maps inputs3..10. Semantics are compiler-owned: all six UVs, NORMAL,
;; SPECULAR and PSIZE can coexist. Older ABI field meanings are unchanged.
;; Unused mapping bits must be zero; all position/color/UV registers unique.
;; ABI2 input adds consecutive float4 UVs after the unchanged48-byte prefix.
;; Input vertex: position float4, diffuse float4, texture coordinate float4.
;; VS mapped inputs -> oPos/oD0/oT0..5; PS v0/t0..5 -> r0. Explicit sampler binding below
;; uses the VM sampler contract. Unsupported shaders reject in the VM.
;; Constructor snapshots descriptor, indices, transformed vertices and constants;
;; caller retains programs and target/depth allocations until completion/free.
;; All offsets are WASM pointers. Targets are native BGRA and normalized f32 Z.
;; Bounds (256 vertices/768 indices/2048 dimensions) are implementation limits,
;; NOT virtual adapter capabilities. Six-plane homogeneous clipping precedes
;; division; each input triangle expands to at most seven triangles. Creation
;; finishes validation/allocation/clipping before any target write.
;; Reference: https://learn.microsoft.com/en-us/windows/win32/dxtecharts/the-direct3d-transformation-pipeline
;; Clip half-spaces: w+x,w-x,w+y,w-y,z,w-z >=0. Boundary sample ownership is
;; then decided by the raster top-left rule, not by perturbing original vertices.
;; State: descriptor128, index cursor128, tile X132/Y136, status140,
;; VSctx144, PSctx148, vertices152, indices156, triangle pointers160/164/168,
;; area172, minX176/maxX180/minY184/maxY188, prepared192, allocation bytes196,
;; workspace200 (freed before publishing; then optional owned tagged point state), alpha state204,
;; depth scratch208..223, blend state224..239.
;; copied blend state224..239 (flags, RGB packed state, alpha state, ARGB factor).
;; Passed-sample counter240..247 (u64), owned stencil descriptor248.
;; Word252: CCW bit0, original-edge/point mask bits1..3, fill mode bits4..5
;; (zero remains legacy SOLID), LASTPIXEL bit6, resumable edge/point cursor bits7..8.
;; Only completed draws
;; publish this count; coverage/depth/kill/alpha rejects and helper lanes do not
;; contribute. Color/depth write masks and blending do not suppress counting.
;; Vertex snapshot160: screenX,Y,Z,invW,colorOverW float4,texOverW float4[6],
;; fogOverW,pad3,specularOverW float4. The second colour varying is oD1/v1 and
;; is carried unconditionally: a vertex shader that never writes oD1 leaves the
;; VM's zeroed output register, which is the same value the pixel VM served for
;; an unwritten v1 before. Black & White 2's terrain pass is what needs it --
;; its vertex shader ends `mov oD1.xyzw` and its pixel shader is `mov r0.xyz,
;; v1` / `mov r0.w, c0.w`, so the land is painted BY the interpolated specular
;; colour and serving zero would paint it black.
;; Context288+indexCount*1134 (POINT uses1162 with scalar oPts sidecar).
;; Fog enabled256/color260, interpolated four-lane factor264..279.
;; Owned table-fog descriptor280, owned scissor RECT284 (null disables).
;; Creation workspace3552+vertexCount*160+indexCount*2 (POINT adds vertexCount*4).
;; Deferred setup: status140=2; private flags100 bit131072 means160 owns
;; a64-byte setup record plus compact input copies. Record: phase4, vertex8,
;; original counts12/16, UVcount20, PSIZE24/register28, input map32:i64,
;; point-output40, VM-loaded44, clip cursor48. Status becomes1 only after
;; all vertices/clipping/compaction finish; then160 resumes triangle-pointer use.
;; Copied flags gain private65536 only when the VS program writes oPts.
;; Workspace includes two12-u32 provenance arrays. Emitted (not guest) U16
;; indices reserve high3bits of each triangle's first index for enabled edges;
;; all generated indices fit low13bits. Clipping-created edges stay disabled.
;; Private deferred_clipped adds six immutable clip-space equations. For a
;; nonzero mask, batches are limited to630 indices and reserve double output
;; capacity (14x; the mathematical fan bound is13x),16-vertex scratch arrays,
;; and96 plane bytes after the setup input snapshot. Setup52 mask,56 plane
;; pointer,60 output capacity; all die with setup, including cancellation.
;; Mask0 retains every old allocation size/limit. Compaction restores the
;; unchanged retained context layout. POSITIONT+user planes rejects explicitly.
;; https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dhal/ns-d3dhal-_d3dhal_clippedtrianglefan

;; Conservative peak payload reservation, including creation workspace even
;; after it is released. Keep the VM allocation size native-owned.
(func $d3d_software_allocation_bound (export "d3d_software_allocation_bound") (param $n i32) (param $count i32) (result i32)
  (if (i32.or (i32.lt_u (local.get $n) (i32.const 1))
    (i32.or (i32.gt_u (local.get $n) (i32.const 256))
    (i32.or (i32.lt_u (local.get $count) (i32.const 3))
    (i32.or (i32.gt_u (local.get $count) (i32.const 768))
      (i32.ne (i32.rem_u (local.get $count) (i32.const 3)) (i32.const 0))))))
    (then (return (i32.const 0))))
  (i32.add (i32.add (i32.const 4464) (i32.mul (local.get $count) (i32.const 1164)))
    (i32.add (i32.mul (local.get $n) (i32.const 164))
      (i32.mul (call $d3d_shader_vm_context_bytes) (i32.const 2)))))

;; Deferred preparation also owns copied active input vectors (at most11).
(func $d3d_software_deferred_allocation_bound (export "d3d_software_deferred_allocation_bound") (param $n i32) (param $count i32) (result i32)
  (local $base i32)
  (local.set $base (call $d3d_software_allocation_bound (local.get $n) (local.get $count)))
  (if (i32.eqz (local.get $base)) (then (return (i32.const 0))))
  (i32.add (local.get $base) (i32.mul (local.get $n) (i32.const 176))))

;; Private clipping batch limit210 triangles preserves packed13-bit indices.
;; Zero-mask callers keep the old768-index limit and identical reservation.
(func (export "d3d_software_clipped_allocation_bound") (param $n i32) (param $count i32) (param $mask i32) (result i32)
  (local $base i32)
  (if (i32.gt_u (local.get $mask) (i32.const 63)) (then (return (i32.const 0))))
  (if (local.get $mask) (then
    (if (i32.gt_u (local.get $count) (i32.const 630)) (then (return (i32.const 0))))))
  (local.set $base (call $d3d_software_deferred_allocation_bound (local.get $n) (local.get $count)))
  (if (i32.eqz (local.get $base)) (then (return (i32.const 0))))
  (i32.add (local.get $base) (select
    (i32.add (i32.const 1408) (i32.mul (local.get $count) (i32.const 1162)))
    (i32.const 0) (local.get $mask))))

;; Valid live contexts only. Deliberately retain the peak bound's VM/slack
;; allowance for later binders; this is a conservative reservation, not telemetry.
(func $d3d_software_retained_bound (export "d3d_software_retained_bound") (param $ctx i32) (result i32)
  (if (i32.eq (i32.load offset=140 (local.get $ctx)) (i32.const 2)) (then (return (i32.const 0))))
  (i32.add (i32.load offset=196 (local.get $ctx))
    (i32.add (i32.const 4016) (i32.mul (call $d3d_shader_vm_context_bytes) (i32.const 2)))))

(func $d3d_software_free (export "d3d_software_free") (param $ctx i32)
  (if (local.get $ctx) (then
    (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 131072)) (then
      (call $d3d_shader_vm_free (i32.load offset=160 (local.get $ctx)))))
    (call $d3d_shader_vm_free (i32.load offset=144 (local.get $ctx)))
    (call $d3d_shader_vm_free (i32.load offset=148 (local.get $ctx)))
    (call $d3d_shader_vm_free (i32.load offset=200 (local.get $ctx)))
    (call $d3d_shader_vm_free (i32.load offset=248 (local.get $ctx)))
    (call $d3d_shader_vm_free (i32.load offset=280 (local.get $ctx)))
    (call $d3d_shader_vm_free (i32.load offset=284 (local.get $ctx)))
    (call $d3d_shader_vm_free (local.get $ctx)))))

(func $d3d_software_constants (param $vm i32) (param $src i32) (param $count i32)
  (local $i i32) (local $j i32) (local $dst i32)
  (block $done (loop $next
    (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
    ;; c128+ live in the VM's appended bank, not over a0/output registers.
    (local.set $dst (i32.add (local.get $vm)
      (if (result i32) (i32.lt_u (local.get $i) (i32.const 128))
        (then (i32.add (i32.const 16416) (i32.shl (local.get $i) (i32.const 6))))
        (else (i32.add (i32.const 65568) (i32.shl (i32.sub (local.get $i) (i32.const 128)) (i32.const 6)))))))
    (local.set $j (i32.const 0))
    (loop $components
      (v128.store (i32.add (local.get $dst) (i32.shl (local.get $j) (i32.const 4)))
        (f32x4.splat (f32.load (i32.add (local.get $src) (i32.add (i32.shl (local.get $i) (i32.const 4)) (i32.shl (local.get $j) (i32.const 2)))))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br_if $components (i32.lt_u (local.get $j) (i32.const 4))))
    (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $next))))

(func $d3d_software_clear (export "d3d_software_clear")
  (param $target i32) (param $width i32) (param $height i32) (param $pitch i32)
  (param $color i32) (param $depth i32) (param $depth_pitch i32) (param $z f32) (param $flags i32) (result i32)
  (call $d3d_software_clear_masked (local.get $target) (local.get $width) (local.get $height)
    (local.get $pitch) (local.get $color) (local.get $depth) (local.get $depth_pitch)
    (local.get $z) (local.get $flags) (i32.const -1)))

(func $d3d_software_clear_masked (export "d3d_software_clear_masked")
  (param $target i32) (param $width i32) (param $height i32) (param $pitch i32)
  (param $color i32) (param $depth i32) (param $depth_pitch i32) (param $z f32) (param $flags i32)
  (param $mask i32) (result i32)
  (local $x i32) (local $y i32) (local $pixel i32) (local $value i32)
  (if (i32.or (i32.eqz (local.get $width))
    (i32.or (i32.eqz (local.get $height))
    (i32.or (i32.gt_u (local.get $width) (i32.const 2048))
    (i32.or (i32.gt_u (local.get $height) (i32.const 2048))
      (i32.gt_u (local.get $flags) (i32.const 3)))))) (then (return (i32.const -1))))
  (if (i32.and (local.get $flags) (i32.const 1)) (then
    (if (i32.or (i32.lt_u (local.get $pitch) (i32.shl (local.get $width) (i32.const 2)))
      (i32.gt_u (local.get $pitch) (i32.const 8192))) (then (return (i32.const -1))))
    (if (i32.eqz (call $d3d_shader_vm_range (local.get $target)
      (i32.add (i32.mul (local.get $pitch) (i32.sub (local.get $height) (i32.const 1))) (i32.shl (local.get $width) (i32.const 2))))) (then (return (i32.const -1))))))
  (if (i32.and (local.get $flags) (i32.const 2)) (then
    (if (i32.or (i32.lt_u (local.get $depth_pitch) (i32.shl (local.get $width) (i32.const 2)))
      (i32.gt_u (local.get $depth_pitch) (i32.const 8192))) (then (return (i32.const -1))))
    (if (i32.eqz (i32.and (f32.ge (local.get $z) (f32.const 0)) (f32.le (local.get $z) (f32.const 1)))) (then (return (i32.const -1))))
    (if (i32.eqz (call $d3d_shader_vm_range (local.get $depth)
      (i32.add (i32.mul (local.get $depth_pitch) (i32.sub (local.get $height) (i32.const 1))) (i32.shl (local.get $width) (i32.const 2))))) (then (return (i32.const -1))))))
  (loop $rows
    (local.set $x (i32.const 0))
    (loop $pixels
      (if (i32.and (local.get $flags) (i32.const 1)) (then
        (local.set $pixel (i32.add (local.get $target) (i32.add (i32.mul (local.get $y) (local.get $pitch)) (i32.shl (local.get $x) (i32.const 2)))))
        (local.set $value (local.get $color))
        (if (i32.ne (local.get $mask) (i32.const -1)) (then
          (local.set $value (i32.or (i32.and (local.get $value) (local.get $mask))
            (i32.and (i32.load (local.get $pixel)) (i32.xor (local.get $mask) (i32.const -1)))))))
        (i32.store (local.get $pixel) (local.get $value))))
      (if (i32.and (local.get $flags) (i32.const 2)) (then
        (f32.store (i32.add (local.get $depth) (i32.add (i32.mul (local.get $y) (local.get $depth_pitch)) (i32.shl (local.get $x) (i32.const 2)))) (local.get $z))))
      (local.set $x (i32.add (local.get $x) (i32.const 1))) (br_if $pixels (i32.lt_u (local.get $x) (local.get $width))))
    (local.set $y (i32.add (local.get $y) (i32.const 1))) (br_if $rows (i32.lt_u (local.get $y) (local.get $height))))
  (i32.const 0))

(func $d3d_software_create (export "d3d_software_create") (param $desc i32) (result i32)
  (call $d3d_software_create_typed (local.get $desc) (i32.const 0)))

;; Optional640-byte immutable constant snapshot: VS ivec4[16], BOOL[16],
;; PS ivec4[16], BOOL[16]. Copy before constructor vertex execution; retain no
;; pointer to the caller's storage. The existing128-byte draw ABI is unchanged.
(func $d3d_software_create_typed (export "d3d_software_create_typed") (param $desc i32) (param $typed i32) (result i32)
  (call $d3d_software_create_mode (local.get $desc) (local.get $typed) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "d3d_software_create_deferred") (param $desc i32) (param $typed i32) (result i32)
  (call $d3d_software_create_mode (local.get $desc) (local.get $typed) (i32.const 1) (i32.const 0) (i32.const 0)))
(func (export "d3d_software_create_deferred_clipped") (param $desc i32) (param $typed i32) (param $planes i32) (param $mask i32) (result i32)
  (call $d3d_software_create_mode (local.get $desc) (local.get $typed) (i32.const 1) (local.get $planes) (local.get $mask)))
(func $d3d_software_create_mode (param $desc i32) (param $typed i32) (param $deferred i32) (param $planes i32) (param $mask i32) (result i32)
  (local $ctx i32) (local $n i32) (local $count i32) (local $i i32) (local $j i32)
  (local $lane i32) (local $bank i32) (local $vm i32) (local $src i32) (local $dst i32)
  (local $out i32) (local $v i32) (local $bits i32) (local $map i32) (local $x f32) (local $y f32)
  (local $z f32) (local $w f32) (local $iw f32) (local $bytes i32) (local $point_base i32) (local $point_size f32)
  (local $uvs i32) (local $used i32) (local $register i32) (local $psize i32) (local $psreg i32)
  (local $setup i32) (local $stride i32) (local $status i32) (local $capacity i32) (local $scratch_bytes i32)
  (local $wide i64)
  (if (local.get $typed) (then
    (if (i32.eqz (call $d3d_shader_vm_range (local.get $typed) (i32.const 640))) (then (return (i32.const 0))))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 128))) (then (return (i32.const 0))))
  (if (i32.gt_u (local.get $mask) (i32.const 63)) (then (return (i32.const 0))))
  (local.set $scratch_bytes (select (i32.const 5248) (i32.const 3936) (local.get $mask)))
  (if (local.get $mask) (then
    (if (i32.or (i32.ne (i32.and (i32.load offset=100 (local.get $desc)) (i32.const 4)) (i32.const 0))
      (i32.gt_u (i32.load offset=48 (local.get $desc)) (i32.const 630))) (then (return (i32.const 0))))
    (if (i32.eqz (call $d3d_shader_vm_range (local.get $planes) (i32.const 96))) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (loop $validate_planes
      (if (i32.eqz (f32.le (f32.abs (f32.load (i32.add (local.get $planes) (local.get $i)))) (f32.const 3.4028234663852886e38)))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $validate_planes (i32.lt_u (local.get $i) (i32.const 96))))))
  (if (i32.or (i32.ne (i32.load (local.get $desc)) (i32.const 0x44535031))
    (i32.or (i32.lt_u (i32.load offset=4 (local.get $desc)) (i32.const 1))
      (i32.gt_u (i32.load offset=4 (local.get $desc)) (i32.const 5)))) (then (return (i32.const 0))))
  (local.set $psize (i32.eq (i32.load offset=4 (local.get $desc)) (i32.const 4)))
  (local.set $psreg (i32.and (i32.shr_u (i32.load offset=124 (local.get $desc)) (i32.const 20)) (i32.const 15)))
  (if (i32.or (i32.eqz (i32.load offset=8 (local.get $desc)))
    (i32.or (i32.gt_u (i32.load offset=8 (local.get $desc)) (i32.const 2048))
    (i32.or (i32.eqz (i32.load offset=12 (local.get $desc)))
      (i32.gt_u (i32.load offset=12 (local.get $desc)) (i32.const 2048))))) (then (return (i32.const 0))))
  (if (i32.or (i32.lt_u (i32.load offset=20 (local.get $desc)) (i32.shl (i32.load offset=8 (local.get $desc)) (i32.const 2)))
    (i32.gt_u (i32.load offset=20 (local.get $desc)) (i32.const 8192))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (i32.load offset=16 (local.get $desc))
    (i32.mul (i32.load offset=20 (local.get $desc)) (i32.load offset=12 (local.get $desc))))) (then (return (i32.const 0))))
  (if (i32.and (i32.ne (i32.and (i32.load offset=100 (local.get $desc)) (i32.const 16)) (i32.const 0))
    (i32.eqz (i32.and (i32.load offset=100 (local.get $desc)) (i32.const 8)))) (then (return (i32.const 0))))
  (if (i32.or (i32.gt_u (i32.load offset=100 (local.get $desc)) (i32.const 31))
    (i32.or (i32.eq (i32.and (i32.load offset=100 (local.get $desc)) (i32.const 3)) (i32.const 2))
    (i32.or (i32.lt_u (i32.load offset=104 (local.get $desc)) (i32.const 1))
    (i32.or (i32.gt_u (i32.load offset=104 (local.get $desc)) (i32.const 8))
    (i32.or (i32.gt_u (i32.load offset=108 (local.get $desc)) (i32.const 15))
    (i32.or (i32.lt_u (i32.load offset=112 (local.get $desc)) (i32.const 1))
      (i32.gt_u (i32.load offset=112 (local.get $desc)) (i32.const 3)))))))) (then (return (i32.const 0))))
  (local.set $uvs (i32.const 1))
  (if (i32.eq (i32.load offset=4 (local.get $desc)) (i32.const 5)) (then
    (local.set $uvs (i32.sub (i32.load offset=120 (local.get $desc)) (i32.const 2)))
    (if (i32.or (i32.lt_u (local.get $uvs) (i32.const 1)) (i32.gt_u (local.get $uvs) (i32.const 9))) (then (return (i32.const 0))))
    (if (i32.lt_u (local.get $uvs) (i32.const 9)) (then
      (if (i32.shr_u (i32.load offset=124 (local.get $desc)) (i32.shl (i32.sub (local.get $uvs) (i32.const 1)) (i32.const 2))) (then (return (i32.const 0)))))))
  (else (if (i32.eq (i32.load offset=4 (local.get $desc)) (i32.const 1))
    (then (if (i32.or (i32.load offset=120 (local.get $desc)) (i32.load offset=124 (local.get $desc))) (then (return (i32.const 0)))))
    (else
      (local.set $uvs (i32.load offset=120 (local.get $desc)))
      (if (i32.or (i32.lt_u (local.get $uvs) (i32.const 1)) (i32.gt_u (local.get $uvs)
        (select (i32.const 6) (i32.const 4) (i32.ge_u (i32.load offset=4 (local.get $desc)) (i32.const 3))))) (then (return (i32.const 0))))
      (if (i32.and (i32.ne (local.get $psize) (i32.const 0)) (i32.ne (i32.shr_u (i32.load offset=124 (local.get $desc)) (i32.const 24)) (i32.const 0))) (then (return (i32.const 0))))
      (if (i32.shr_u (i32.and (i32.load offset=124 (local.get $desc)) (select (i32.const 1048575) (i32.const -1) (local.get $psize))) (i32.shl (i32.sub (local.get $uvs) (i32.const 1)) (i32.const 2))) (then (return (i32.const 0))))))))
  (local.set $map (i32.load offset=116 (local.get $desc)))
  (if (i32.eqz (local.get $map)) (then (local.set $map (i32.const 528))))
  (if (i32.gt_u (local.get $map) (i32.const 4095)) (then (return (i32.const 0))))
  (local.set $wide (i64.or (i64.extend_i32_u (local.get $map)) (i64.shl (i64.extend_i32_u (i32.load offset=124 (local.get $desc))) (i64.const 12))))
  (loop $mapping
    (local.set $register (i32.shl (i32.const 1) (i32.and (i32.wrap_i64 (i64.shr_u (local.get $wide) (i64.extend_i32_u (i32.shl (local.get $j) (i32.const 2))))) (i32.const 15))))
    (if (i32.and (local.get $used) (local.get $register)) (then (return (i32.const 0))))
    (local.set $used (i32.or (local.get $used) (local.get $register)))
    (local.set $j (i32.add (local.get $j) (i32.const 1)))
    (br_if $mapping (i32.lt_u (local.get $j) (i32.add (local.get $uvs) (i32.const 2)))))
  (if (i32.and (i32.ne (local.get $psize) (i32.const 0)) (i32.ne (i32.and (local.get $used) (i32.shl (i32.const 1) (local.get $psreg))) (i32.const 0))) (then (return (i32.const 0))))
  (if (i32.and (i32.load offset=100 (local.get $desc)) (i32.const 1)) (then
    (if (i32.or (i32.lt_u (i32.load offset=28 (local.get $desc)) (i32.shl (i32.load offset=8 (local.get $desc)) (i32.const 2)))
      (i32.gt_u (i32.load offset=28 (local.get $desc)) (i32.const 8192))) (then (return (i32.const 0))))
    (if (i32.eqz (call $d3d_shader_vm_range (i32.load offset=24 (local.get $desc))
      (i32.mul (i32.load offset=28 (local.get $desc)) (i32.load offset=12 (local.get $desc))))) (then (return (i32.const 0))))))
  (if (i32.or (i32.eqz (i32.load offset=84 (local.get $desc))) (i32.eqz (i32.load offset=88 (local.get $desc)))) (then (return (i32.const 0))))
  (if (i32.or (i64.gt_u (i64.add (i64.extend_i32_u (i32.load offset=76 (local.get $desc))) (i64.extend_i32_u (i32.load offset=84 (local.get $desc)))) (i64.extend_i32_u (i32.load offset=8 (local.get $desc))))
    (i64.gt_u (i64.add (i64.extend_i32_u (i32.load offset=80 (local.get $desc))) (i64.extend_i32_u (i32.load offset=88 (local.get $desc)))) (i64.extend_i32_u (i32.load offset=12 (local.get $desc))))) (then (return (i32.const 0))))
  (if (i32.eqz (i32.and (f32.ge (f32.load offset=92 (local.get $desc)) (f32.const 0))
    (i32.and (f32.le (f32.load offset=96 (local.get $desc)) (f32.const 1))
      (f32.le (f32.load offset=92 (local.get $desc)) (f32.load offset=96 (local.get $desc)))))) (then (return (i32.const 0))))
  (local.set $n (i32.load offset=36 (local.get $desc)))
  (local.set $count (i32.load offset=48 (local.get $desc)))
  (if (i32.or (i32.lt_u (local.get $n) (select (i32.const 1) (i32.const 3)
      (i32.and (i32.load offset=100 (local.get $desc)) (i32.const 16))))
    (i32.or (i32.gt_u (local.get $n) (i32.const 256))
    (i32.or (i32.lt_u (local.get $count) (i32.const 3))
    (i32.or (i32.gt_u (local.get $count) (i32.const 768))
      (i32.ne (i32.rem_u (local.get $count) (i32.const 3)) (i32.const 0)))))) (then (return (i32.const 0))))
  (if (i32.or (i32.lt_u (i32.load offset=40 (local.get $desc)) (i32.shl (i32.add (i32.add (local.get $uvs) (i32.const 2)) (local.get $psize)) (i32.const 4)))
    (i32.gt_u (i32.load offset=40 (local.get $desc)) (i32.const 4096))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (i32.load offset=32 (local.get $desc)) (i32.mul (local.get $n) (i32.load offset=40 (local.get $desc))))) (then (return (i32.const 0))))
  (if (i32.load offset=44 (local.get $desc))
    (then (if (i32.eqz (call $d3d_shader_vm_range (i32.load offset=44 (local.get $desc)) (i32.shl (local.get $count) (i32.const 1)))) (then (return (i32.const 0)))))
    (else (if (i32.ne (local.get $n) (local.get $count)) (then (return (i32.const 0))))))
  (if (i32.or (i32.gt_u (i32.load offset=64 (local.get $desc)) (i32.const 256))
    (i32.gt_u (i32.load offset=72 (local.get $desc)) (i32.const 8))) (then (return (i32.const 0))))
  (if (i32.load offset=64 (local.get $desc)) (then
    (if (i32.eqz (call $d3d_shader_vm_range (i32.load offset=60 (local.get $desc)) (i32.shl (i32.load offset=64 (local.get $desc)) (i32.const 4)))) (then (return (i32.const 0))))))
  (if (i32.load offset=72 (local.get $desc)) (then
    (if (i32.eqz (call $d3d_shader_vm_range (i32.load offset=68 (local.get $desc)) (i32.shl (i32.load offset=72 (local.get $desc)) (i32.const 4)))) (then (return (i32.const 0))))))
  (local.set $capacity (i32.mul (local.get $count) (select (i32.const 2) (i32.const 1) (local.get $mask))))
  (local.set $bytes (i32.add (i32.const 288) (i32.mul (local.get $capacity)
    (select (i32.const 1162) (i32.const 1134) (i32.ne (i32.and (i32.load offset=100 (local.get $desc)) (i32.const 8)) (i32.const 0))))))
  (local.set $ctx (call $heap_alloc (local.get $bytes)))
  (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
  (local.set $ctx (call $g2w (local.get $ctx)))
  (memory.fill (local.get $ctx) (i32.const 0) (local.get $bytes))
  (memory.copy (local.get $ctx) (local.get $desc) (i32.const 128))
  (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 8)) (then
    (i32.store offset=252 (local.get $ctx) (i32.const 16))
    (if (call $d3d_shader_vm_has_point_size (i32.load offset=52 (local.get $ctx))) (then
      (i32.store offset=100 (local.get $ctx) (i32.or (i32.load offset=100 (local.get $ctx)) (i32.const 65536)))))))
  (i32.store offset=196 (local.get $ctx) (local.get $bytes))
  (i32.store offset=140 (local.get $ctx) (i32.const 1))
  (i32.store offset=152 (local.get $ctx) (i32.add (local.get $ctx) (i32.const 288)))
  (i32.store offset=156 (local.get $ctx) (i32.add (i32.add (local.get $ctx) (i32.const 288)) (i32.mul (local.get $capacity) (i32.const 1120))))
  (block $failure
    (local.set $out (call $heap_alloc (i32.add (local.get $scratch_bytes)
      (i32.add (i32.mul (local.get $n) (select (i32.const 164) (i32.const 160)
        (i32.ne (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 8)) (i32.const 0)))) (i32.shl (local.get $count) (i32.const 1))))))
    (br_if $failure (i32.eqz (local.get $out)))
    (local.set $out (call $g2w (local.get $out)))
    (i32.store offset=200 (local.get $ctx) (local.get $out))
    (local.set $point_base (i32.add (local.get $out) (i32.add (local.get $scratch_bytes)
      (i32.add (i32.mul (local.get $n) (i32.const 160)) (i32.shl (local.get $count) (i32.const 1))))))
    (local.set $i (i32.const 0))
    (loop $indices
      (local.set $v (local.get $i))
      (if (i32.load offset=44 (local.get $ctx)) (then (local.set $v (i32.load16_u (i32.add (i32.load offset=44 (local.get $ctx)) (i32.shl (local.get $i) (i32.const 1)))))))
      (br_if $failure (i32.ge_u (local.get $v) (local.get $n)))
      (i32.store16 (i32.add (i32.add (local.get $out) (i32.mul (local.get $n) (i32.const 160))) (i32.shl (local.get $i) (i32.const 1))) (local.get $v))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $indices (i32.lt_u (local.get $i) (local.get $count))))
    (i32.store offset=144 (local.get $ctx) (call $d3d_shader_vm_context (i32.load offset=52 (local.get $ctx)) (i32.const 15)))
    (br_if $failure (i32.eqz (i32.load offset=144 (local.get $ctx))))
    (i32.store offset=148 (local.get $ctx) (call $d3d_shader_vm_context (i32.load offset=56 (local.get $ctx)) (i32.const 15)))
    (br_if $failure (i32.eqz (i32.load offset=148 (local.get $ctx))))
    (call $d3d_software_constants (i32.load offset=144 (local.get $ctx)) (i32.load offset=60 (local.get $ctx)) (i32.load offset=64 (local.get $ctx)))
    (call $d3d_software_constants (i32.load offset=148 (local.get $ctx)) (i32.load offset=68 (local.get $ctx)) (i32.load offset=72 (local.get $ctx)))
    (if (local.get $typed) (then
      (local.set $bank (i32.const 0))
      (loop $typed_banks
        (local.set $vm (i32.load (i32.add (local.get $ctx) (i32.add (i32.const 144) (i32.shl (local.get $bank) (i32.const 2))))))
        (local.set $src (i32.add (local.get $typed) (i32.mul (local.get $bank) (i32.const 320))))
        (memory.copy (i32.add (local.get $vm) (i32.const 73760)) (local.get $src) (i32.const 256))
        (local.set $j (i32.const 0))
        (loop $typed_booleans
          (i32.store (i32.add (local.get $vm) (i32.add (i32.const 74016) (i32.shl (local.get $j) (i32.const 2))))
            (i32.ne (i32.load (i32.add (local.get $src) (i32.add (i32.const 256) (i32.shl (local.get $j) (i32.const 2))))) (i32.const 0)))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $typed_booleans (i32.lt_u (local.get $j) (i32.const 16))))
        (local.set $bank (i32.add (local.get $bank) (i32.const 1))) (br_if $typed_banks (i32.lt_u (local.get $bank) (i32.const 2))))))

    ;; Pending-only tagged setup owner in160; raster triangle pointers are
    ;; unavailable until setup finishes. Status2 rejects all geometry binders.
    (local.set $stride (i32.shl (i32.add (i32.add (local.get $uvs) (i32.const 2)) (local.get $psize)) (i32.const 4)))
    (local.set $setup (call $heap_alloc (i32.add (select (i32.const 160) (i32.const 64) (local.get $mask))
      (select (i32.mul (local.get $n) (local.get $stride)) (i32.const 0) (local.get $deferred)))))
    (br_if $failure (i32.eqz (local.get $setup)))
    (local.set $setup (call $g2w (local.get $setup)))
    (memory.fill (local.get $setup) (i32.const 0) (i32.const 64))
    (i32.store (local.get $setup) (i32.const 0x44535050))
    (i32.store offset=12 (local.get $setup) (local.get $n))
    (i32.store offset=16 (local.get $setup) (local.get $count))
    (i32.store offset=20 (local.get $setup) (local.get $uvs))
    (i32.store offset=24 (local.get $setup) (local.get $psize))
    (i32.store offset=28 (local.get $setup) (local.get $psreg))
    (i64.store offset=32 (local.get $setup) (local.get $wide))
    (i32.store offset=40 (local.get $setup) (local.get $point_base))
    ;;52 mask,56 owned plane snapshot pointer,60 reserved output capacity.
    (i32.store offset=52 (local.get $setup) (local.get $mask))
    (i32.store offset=60 (local.get $setup) (local.get $capacity))
    (if (local.get $mask) (then
      (local.set $dst (i32.add (i32.add (local.get $setup) (i32.const 64)) (i32.mul (local.get $n) (local.get $stride))))
      (memory.copy (local.get $dst) (local.get $planes) (i32.const 96))
      (i32.store offset=56 (local.get $setup) (local.get $dst))))
    (i32.store offset=160 (local.get $ctx) (local.get $setup))
    (i32.store offset=100 (local.get $ctx) (i32.or (i32.load offset=100 (local.get $ctx)) (i32.const 131072)))
    (i32.store offset=140 (local.get $ctx) (i32.const 2))
    (if (local.get $deferred) (then
      (local.set $i (i32.const 0))
      (loop $snapshot
        (memory.copy (i32.add (i32.add (local.get $setup) (i32.const 64)) (i32.mul (local.get $i) (local.get $stride)))
          (i32.add (i32.load offset=32 (local.get $ctx)) (i32.mul (local.get $i) (i32.load offset=40 (local.get $ctx)))) (local.get $stride))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $snapshot (i32.lt_u (local.get $i) (local.get $n))))
      (i32.store offset=32 (local.get $ctx) (i32.add (local.get $setup) (i32.const 64)))
      (i32.store offset=40 (local.get $ctx) (local.get $stride))
      (return (local.get $ctx))))
    ;; Compatibility entry points remain synchronous. The deferred path never
    ;; enters this wrapper loop; its caller schedules each bounded prepare step.
    (loop $sync
      (local.set $status (call $d3d_software_prepare_step (local.get $ctx) (i32.const 8192) (i32.const 256)))
      (br_if $sync (i32.eq (local.get $status) (i32.const 1))))
    (br_if $failure (i32.ne (local.get $status) (i32.const 0)))
    (return (local.get $ctx)))
  (call $d3d_software_free (local.get $ctx)) (i32.const 0))

;; Setup steps budget shader packets and ORIGINAL input triangles independently.
;; 1 pending,0 ready,-1 invalid execution,-2 cancelled. No target writes here.
(func $d3d_software_prepare_step (export "d3d_software_prepare_step")
  (param $ctx i32) (param $packet_budget i32) (param $primitive_budget i32) (result i32)
  (local $setup i32) (local $status i32) (local $n i32) (local $count i32) (local $i i32) (local $j i32)
  (local $vm i32) (local $out i32) (local $point_base i32) (local $uvs i32) (local $psize i32) (local $psreg i32)
  (local $lane i32) (local $bank i32) (local $src i32) (local $dst i32) (local $bits i32)
  (local $x f32) (local $y f32) (local $z f32) (local $w f32) (local $point_size f32) (local $wide i64)
  (local $bad i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 288))) (then (return (i32.const -1))))
  (if (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031)) (then (return (i32.const -1))))
  (local.set $status (i32.load offset=140 (local.get $ctx)))
  (if (i32.lt_s (local.get $status) (i32.const 0)) (then (return (local.get $status))))
  (if (i32.ne (local.get $status) (i32.const 2)) (then (return (i32.const 0))))
  (local.set $setup (i32.load offset=160 (local.get $ctx)))
  (block $failure
    (br_if $failure (i32.eqz (call $d3d_shader_vm_range (local.get $setup) (i32.const 64))))
    (br_if $failure (i32.ne (i32.load (local.get $setup)) (i32.const 0x44535050)))
    (local.set $n (i32.load offset=12 (local.get $setup))) (local.set $count (i32.load offset=16 (local.get $setup)))
    (local.set $out (i32.load offset=200 (local.get $ctx)))
    (local.set $uvs (i32.load offset=20 (local.get $setup))) (local.set $psize (i32.load offset=24 (local.get $setup)))
    (local.set $psreg (i32.load offset=28 (local.get $setup))) (local.set $wide (i64.load offset=32 (local.get $setup)))
    (local.set $point_base (i32.load offset=40 (local.get $setup)))
    (if (i32.eqz (i32.load offset=4 (local.get $setup))) (then
      (if (i32.le_s (local.get $packet_budget) (i32.const 0)) (then (return (i32.const 1))))
    (local.set $vm (i32.load offset=144 (local.get $ctx)))
    (local.set $i (i32.load offset=8 (local.get $setup)))
    (if (i32.eqz (i32.load offset=44 (local.get $setup))) (then
      (memory.fill (i32.add (local.get $vm) (i32.const 32)) (i32.const 0) (i32.const 16384))
      (memory.fill (i32.add (local.get $vm) (i32.const 24608)) (i32.const 0) (i32.const 32768))
      (local.set $lane (i32.const 0)) (local.set $bits (i32.const 0))
      (block $filled (loop $fill
        (br_if $filled (i32.ge_u (i32.add (local.get $i) (local.get $lane)) (local.get $n)))
        (local.set $src (i32.add (i32.load offset=32 (local.get $ctx)) (i32.mul (i32.add (local.get $i) (local.get $lane)) (i32.load offset=40 (local.get $ctx)))))
        (local.set $j (i32.const 0))
        (loop $attributes
          (f32.store (i32.add (i32.add (local.get $vm) (i32.const 8224))
            (i32.add (i32.shl (i32.and (i32.wrap_i64 (i64.shr_u (local.get $wide) (i64.extend_i32_u (i32.and (local.get $j) (i32.const 60))))) (i32.const 15)) (i32.const 6))
              (i32.add (i32.shl (i32.and (local.get $j) (i32.const 3)) (i32.const 4)) (i32.shl (local.get $lane) (i32.const 2)))))
            (f32.load (i32.add (local.get $src) (i32.shl (local.get $j) (i32.const 2)))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $attributes (i32.lt_u (local.get $j) (i32.shl (i32.add (local.get $uvs) (i32.const 2)) (i32.const 2)))))
        (if (local.get $psize) (then
          (local.set $j (i32.const 0))
          (loop $point_input
            (f32.store (i32.add (i32.add (local.get $vm) (i32.const 8224))
              (i32.add (i32.shl (local.get $psreg) (i32.const 6)) (i32.add (i32.shl (local.get $j) (i32.const 4)) (i32.shl (local.get $lane) (i32.const 2)))))
              (f32.load (i32.add (local.get $src) (i32.add (i32.shl (i32.add (local.get $uvs) (i32.const 2)) (i32.const 4)) (i32.shl (local.get $j) (i32.const 2))))))
            (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $point_input (i32.lt_u (local.get $j) (i32.const 4))))))
        (local.set $bits (i32.or (local.get $bits) (i32.shl (i32.const 1) (local.get $lane))))
        (local.set $lane (i32.add (local.get $lane) (i32.const 1))) (br_if $fill (i32.lt_u (local.get $lane) (i32.const 4)))))
      (i32.store offset=8 (local.get $vm) (i32.const 0)) (i32.store offset=12 (local.get $vm) (i32.const 1))
      (i32.store offset=16 (local.get $vm) (local.get $bits))
      (i32.store offset=44 (local.get $setup) (i32.const 1))))
      (local.set $status (call $d3d_shader_vm_run (local.get $vm) (local.get $packet_budget)))
      (if (i32.eq (local.get $status) (i32.const -2)) (then
        (i32.store offset=140 (local.get $ctx) (i32.const -2)) (return (i32.const -2))))
      (if (i32.eq (local.get $status) (i32.const 1)) (then (return (i32.const 1))))
      (br_if $failure (i32.ne (local.get $status) (i32.const 0)))
      (local.set $lane (i32.const 0))
      (block $stored (loop $store
        (br_if $stored (i32.ge_u (i32.add (local.get $i) (local.get $lane)) (local.get $n)))
        (local.set $src (i32.add (i32.add (local.get $vm) (i32.const 32800)) (i32.shl (local.get $lane) (i32.const 2))))
        (local.set $x (f32.load (local.get $src))) (local.set $y (f32.load offset=16 (local.get $src)))
        (local.set $z (f32.load offset=32 (local.get $src))) (local.set $w (f32.load offset=48 (local.get $src)))
        ;; A non-finite post-VS position is a property of ONE vertex, not of the
        ;; draw. Real hardware rasterizes nothing for a triangle it cannot
        ;; order and carries on; refusing here instead ended rendering for the
        ;; whole run, because the producer's queue error is sticky. Black &
        ;; White 2's land pass writes NaN into the Y of four vertices of one
        ;; 56-vertex batch (measured: command9233, vertices48-51) and every
        ;; other vertex in it is ordinary. Mark the vertex and let
        ;; $d3d_software_clip_range drop the triangles that reference it.
        (local.set $bad (i32.eqz (i32.and
          (i32.and (f32.le (f32.abs (local.get $x)) (f32.const 3.4028234663852886e38)) (f32.le (f32.abs (local.get $y)) (f32.const 3.4028234663852886e38)))
          (i32.and (f32.le (f32.abs (local.get $z)) (f32.const 3.4028234663852886e38)) (f32.le (f32.abs (local.get $w)) (f32.const 3.4028234663852886e38))))))
        (local.set $dst (i32.add (local.get $out) (i32.mul (i32.add (local.get $i) (local.get $lane)) (i32.const 160))))
        (f32.store (local.get $dst) (local.get $x)) (f32.store offset=4 (local.get $dst) (local.get $y))
        (f32.store offset=8 (local.get $dst) (local.get $z)) (f32.store offset=12 (local.get $dst) (local.get $w))
        (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 65536)) (then
          (local.set $point_size (f32.load (i32.add (i32.add (local.get $vm) (i32.const 32928)) (i32.shl (local.get $lane) (i32.const 2)))))
          ;; A NaN point size is the same class of per-vertex defect.
          (local.set $bad (i32.or (local.get $bad)
            (f32.ne (local.get $point_size) (local.get $point_size))))
          (f32.store (i32.add (local.get $point_base) (i32.shl (i32.add (local.get $i) (local.get $lane)) (i32.const 2))) (local.get $point_size))))
        (local.set $j (i32.const 0))
        (loop $varyings
          (local.set $bank (select (i32.const 40992)
            (i32.add (i32.const 49184) (i32.shl (i32.and (i32.sub (local.get $j) (i32.const 4)) (i32.const 28)) (i32.const 4)))
            (i32.lt_u (local.get $j) (i32.const 4))))
          (f32.store (i32.add (i32.add (local.get $dst) (i32.const 16)) (i32.shl (local.get $j) (i32.const 2)))
            (f32.load (i32.add (i32.add (local.get $vm) (local.get $bank))
              (i32.add (i32.shl (i32.and (local.get $j) (i32.const 3)) (i32.const 4)) (i32.shl (local.get $lane) (i32.const 2))))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $varyings (i32.lt_u (local.get $j) (i32.const 28))))
        ;; oFog output is flat513, scalar X in the VS SoA register bank.
        (f32.store offset=128 (local.get $dst)
          (f32.load (i32.add (i32.add (local.get $vm) (i32.const 32864)) (i32.shl (local.get $lane) (i32.const 2)))))
        (memory.fill (i32.add (local.get $dst) (i32.const 132)) (i32.const 0) (i32.const 12))
        ;; The first of the three reserved words carries the per-vertex verdict.
        (i32.store offset=132 (local.get $dst) (local.get $bad))
        ;; oD1, the second colour output, is bank5 register1 -- one register
        ;; past oD0, so32+ (5*128+1)*64 = 41056 in the VS context. The bank is
        ;; zero-filled before every packet, so a shader that never writes oD1
        ;; lands four zeroes here, which is exactly what the pixel VM served for
        ;; an unwritten v1 before this varying existed.
        (local.set $j (i32.const 0))
        (loop $specular
          (f32.store (i32.add (i32.add (local.get $dst) (i32.const 144)) (i32.shl (local.get $j) (i32.const 2)))
            (f32.load (i32.add (i32.add (local.get $vm) (i32.const 41056))
              (i32.add (i32.shl (local.get $j) (i32.const 4)) (i32.shl (local.get $lane) (i32.const 2))))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $specular (i32.lt_u (local.get $j) (i32.const 4))))
        (local.set $lane (i32.add (local.get $lane) (i32.const 1))) (br_if $store (i32.lt_u (local.get $lane) (i32.const 4)))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (i32.store offset=8 (local.get $setup) (local.get $i)) (i32.store offset=44 (local.get $setup) (i32.const 0))
      (if (i32.lt_u (local.get $i) (local.get $n)) (then (return (i32.const 1))))

      (call $d3d_shader_vm_free (i32.load offset=144 (local.get $ctx))) (i32.store offset=144 (local.get $ctx) (i32.const 0))
      (i32.store offset=4 (local.get $setup) (i32.const 1))
      (i32.store offset=36 (local.get $ctx) (i32.const 0)) (i32.store offset=48 (local.get $ctx) (i32.const 0))))
    (if (i32.le_s (local.get $primitive_budget) (i32.const 0)) (then (return (i32.const 1))))
    (local.set $i (i32.load offset=48 (local.get $setup)))
    (local.set $j (i32.add (local.get $i) (i32.mul
      (select (local.get $primitive_budget) (i32.const 256) (i32.lt_u (local.get $primitive_budget) (i32.const 256))) (i32.const 3))))
    (if (i32.gt_u (local.get $j) (local.get $count)) (then (local.set $j (local.get $count))))
    (local.set $status (call $d3d_software_clip_range (local.get $ctx) (local.get $n) (local.get $count)
      (local.get $i) (local.get $j) (i32.load offset=48 (local.get $ctx))))
    (br_if $failure (i32.lt_s (local.get $status) (i32.const 0)))
    (i32.store offset=48 (local.get $setup) (local.get $j))
    (if (i32.lt_u (local.get $j) (local.get $count)) (then (return (i32.const 1))))
    (call $d3d_shader_vm_free (i32.load offset=200 (local.get $ctx))) (i32.store offset=200 (local.get $ctx) (i32.const 0))
    (local.set $count (i32.load offset=60 (local.get $setup)))
    (call $d3d_shader_vm_free (local.get $setup)) (i32.store offset=160 (local.get $ctx) (i32.const 0))
    (i32.store offset=100 (local.get $ctx) (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const -131073)))
    (br_if $failure (i32.eqz (call $d3d_software_compact (local.get $ctx) (local.get $count))))
    (i32.store offset=140 (local.get $ctx) (i32.const 1)) (return (i32.const 0)))
  (i32.store offset=140 (local.get $ctx) (i32.const -1)) (i32.const -1))

(func $d3d_software_clip_distance (param $v i32) (param $plane i32) (result f64)
  (local $w f64)
  (local.set $w (f64.promote_f32 (f32.load offset=12 (local.get $v))))
  (block $far (block $near (block $top (block $bottom (block $right (block $left
    (br_table $left $right $bottom $top $near $far $far (local.get $plane)))
    (return (f64.add (local.get $w) (f64.promote_f32 (f32.load (local.get $v))))))
    (return (f64.sub (local.get $w) (f64.promote_f32 (f32.load (local.get $v))))))
    (return (f64.add (local.get $w) (f64.promote_f32 (f32.load offset=4 (local.get $v))))))
    (return (f64.sub (local.get $w) (f64.promote_f32 (f32.load offset=4 (local.get $v))))))
    (return (f64.promote_f32 (f32.load offset=8 (local.get $v)))))
  (f64.sub (local.get $w) (f64.promote_f32 (f32.load offset=8 (local.get $v)))))

(func $d3d_software_clip_distance_user (param $v i32) (param $plane i32) (param $setup i32) (result f64)
  (local $p i32) (local $i i32) (local $sum f64)
  (if (i32.lt_u (local.get $plane) (i32.const 6))
    (then (return (call $d3d_software_clip_distance (local.get $v) (local.get $plane)))))
  (local.set $plane (i32.sub (local.get $plane) (i32.const 6)))
  (if (i32.eqz (i32.and (i32.load offset=52 (local.get $setup)) (i32.shl (i32.const 1) (local.get $plane))))
    (then (return (f64.const 1))))
  (local.set $p (i32.add (i32.load offset=56 (local.get $setup)) (i32.shl (local.get $plane) (i32.const 4))))
  (loop $dot
    (local.set $sum (f64.add (local.get $sum) (f64.mul
      (f64.promote_f32 (f32.load (i32.add (local.get $v) (local.get $i))))
      (f64.promote_f32 (f32.load (i32.add (local.get $p) (local.get $i)))))))
    (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $dot (i32.lt_u (local.get $i) (i32.const 16))))
  (local.get $sum))

(func $d3d_software_intersection (param $a i32) (param $b i32) (param $da f64) (param $db f64) (param $out i32) (param $plane i32)
  (local $i i32) (local $den f64)
  (local.set $den (f64.sub (local.get $db) (local.get $da)))
  ;; Symmetric intersection expression gives the same bits for a shared edge
  ;; traversed in either direction. f64 intermediates prevent f32 distance and
  ;; product overflow for finite shader outputs; stored semantics remain f32.
  (loop $attributes
    (f32.store (i32.add (local.get $out) (local.get $i))
      (f32.demote_f64 (f64.div (f64.sub
        (f64.mul (f64.promote_f32 (f32.load (i32.add (local.get $a) (local.get $i)))) (local.get $db))
        (f64.mul (f64.promote_f32 (f32.load (i32.add (local.get $b) (local.get $i)))) (local.get $da))) (local.get $den))))
    (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $attributes (i32.lt_u (local.get $i) (i32.const 160))))
  ;; This is the constructed intersection's defining plane, not a clamp of an
  ;; original vertex. Preserve it exactly after rounding the interpolated W.
  (if (i32.lt_u (local.get $plane) (i32.const 4))
    (then (f32.store (i32.add (local.get $out) (i32.shl (i32.shr_u (local.get $plane) (i32.const 1)) (i32.const 2)))
      (f32.mul (f32.load offset=12 (local.get $out))
        (select (f32.const 1) (f32.const -1) (i32.and (local.get $plane) (i32.const 1))))))
    (else (if (i32.lt_u (local.get $plane) (i32.const 6)) (then (f32.store offset=8 (local.get $out)
      (select (f32.const 0) (f32.load offset=12 (local.get $out)) (i32.eq (local.get $plane) (i32.const 4)))))))))

(func $d3d_software_project (param $ctx i32) (param $src i32) (param $dst i32) (result i32)
  (local $w f32) (local $iw f32) (local $i i32)
  (local.set $w (f32.load offset=12 (local.get $src)))
  (local.set $iw (if (result f32) (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 4))
    (then (local.get $w)) (else (f32.div (f32.const 1) (local.get $w)))))
  (if (i32.eqz (i32.and (f32.gt (local.get $w) (f32.const 0))
    (f32.le (local.get $iw) (f32.const 3.4028234663852886e38)))) (then (return (i32.const 0))))
  (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 4))
    (then (memory.copy (local.get $dst) (local.get $src) (i32.const 12)))
    (else
  (f32.store (local.get $dst) (f32.add (f32.convert_i32_u (i32.load offset=76 (local.get $ctx)))
    (f32.mul (f32.mul (f32.add (f32.div (f32.load (local.get $src)) (local.get $w)) (f32.const 1)) (f32.const 0.5)) (f32.convert_i32_u (i32.load offset=84 (local.get $ctx))))))
  (f32.store offset=4 (local.get $dst) (f32.add (f32.convert_i32_u (i32.load offset=80 (local.get $ctx)))
    (f32.mul (f32.mul (f32.sub (f32.const 1) (f32.div (f32.load offset=4 (local.get $src)) (local.get $w))) (f32.const 0.5)) (f32.convert_i32_u (i32.load offset=88 (local.get $ctx))))))
  (f32.store offset=8 (local.get $dst) (f32.add (f32.load offset=92 (local.get $ctx))
    (f32.mul (f32.div (f32.load offset=8 (local.get $src)) (local.get $w)) (f32.sub (f32.load offset=96 (local.get $ctx)) (f32.load offset=92 (local.get $ctx))))))))
  (f32.store offset=12 (local.get $dst) (local.get $iw))
  (local.set $i (i32.const 16))
  (loop $varyings
    (f32.store (i32.add (local.get $dst) (local.get $i)) (f32.mul (f32.load (i32.add (local.get $src) (local.get $i))) (local.get $iw)))
    (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $varyings (i32.lt_u (local.get $i) (i32.const 160))))
  (i32.const 1))

(func $d3d_software_clip (param $ctx i32) (param $vertex_count i32) (param $index_count i32) (result i32)
  (i32.ge_s (call $d3d_software_clip_range (local.get $ctx) (local.get $vertex_count) (local.get $index_count)
    (i32.const 0) (local.get $index_count) (i32.const 0)) (i32.const 0)))
(func $d3d_software_clip_range (param $ctx i32) (param $vertex_count i32) (param $index_count i32)
  (param $triangle i32) (param $end i32) (param $emitted i32) (result i32)
  (local $raw i32) (local $indices i32) (local $scratch i32) (local $a i32) (local $b i32) (local $tmp i32)
  (local $count i32) (local $outcount i32) (local $i i32) (local $j i32) (local $plane i32)
  (local $prev i32) (local $current i32) (local $da f64) (local $db f64) (local $dst i32)
  (local $ma i32) (local $mb i32) (local $previous_mask i32) (local $current_mask i32) (local $edge_mask i32) (local $point_mask i32)
  (local $setup i32) (local $user_mask i32) (local $slots i32) (local $limit i32) (local $capacity i32)
  (local $bad i32)
  (local.set $setup (i32.load offset=160 (local.get $ctx)))
  (local.set $user_mask (i32.load offset=52 (local.get $setup)))
  (local.set $slots (select (i32.const 16) (i32.const 12) (local.get $user_mask)))
  (local.set $limit (select (i32.const 12) (i32.const 6) (local.get $user_mask)))
  (local.set $capacity (i32.load offset=60 (local.get $setup)))
  (local.set $raw (i32.load offset=200 (local.get $ctx)))
  (local.set $indices (i32.add (local.get $raw) (i32.mul (local.get $vertex_count) (i32.const 160))))
  (local.set $scratch (i32.add (local.get $indices) (i32.shl (local.get $index_count) (i32.const 1))))
  (loop $triangles
    (local.set $a (local.get $scratch)) (local.set $b (i32.add (local.get $scratch) (i32.mul (local.get $slots) (i32.const 160))))
    (local.set $ma (i32.add (local.get $scratch) (i32.mul (local.get $slots) (i32.const 320))))
    (local.set $mb (i32.add (local.get $ma) (i32.shl (local.get $slots) (i32.const 2))))
    ;; Membership in ORIGINAL triangle edges AB=1, BC=2, CA=4. An
    ;; intersection inherits only shared memberships, never a new clip edge.
    (i32.store (local.get $ma) (i32.const 5)) (i32.store offset=4 (local.get $ma) (i32.const 3))
    (i32.store offset=8 (local.get $ma) (i32.const 6))
    (local.set $i (i32.const 0)) (local.set $bad (i32.const 0))
    (loop $input
      (memory.copy (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 160)))
        (i32.add (local.get $raw) (i32.mul (i32.load16_u (i32.add (local.get $indices)
          (i32.shl (i32.add (local.get $triangle) (local.get $i)) (i32.const 1)))) (i32.const 160))) (i32.const 160))
      ;; +132 is the per-vertex verdict $d3d_software_prepare_step wrote: the
      ;; post-VS position (or point size) was not finite. Such a triangle has no
      ;; orderable projection, so it contributes nothing -- which is what the
      ;; hardware produces too. Drop it and keep clipping the rest of the batch.
      (local.set $bad (i32.or (local.get $bad)
        (i32.load offset=132 (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 160))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $input (i32.lt_u (local.get $i) (i32.const 3))))
    (block $dropped
    (br_if $dropped (local.get $bad))
    (local.set $count (i32.const 3)) (local.set $plane (i32.const 0))
    (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 8)) (then (local.set $plane (i32.const 4))))
    (block $clipped (loop $planes
      ;; POSITIONT from ordinary vertex buffers is already in screen space.
      ;; Raster viewport bounds still apply; do not roundtrip or homogeneously
      ;; clip it. ProcessVertices-origin clipping remains a frontend distinction.
      (br_if $clipped (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 4)))
      (br_if $clipped (i32.eqz (local.get $count)))
      (local.set $outcount (i32.const 0)) (local.set $i (i32.const 0))
      (local.set $prev (i32.add (local.get $a) (i32.mul (i32.sub (local.get $count) (i32.const 1)) (i32.const 160))))
      (local.set $da (call $d3d_software_clip_distance_user (local.get $prev) (local.get $plane) (local.get $setup)))
      (local.set $previous_mask (i32.load (i32.add (local.get $ma) (i32.shl (i32.sub (local.get $count) (i32.const 1)) (i32.const 2)))))
      (loop $edges
        (local.set $current (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 160))))
        (local.set $db (call $d3d_software_clip_distance_user (local.get $current) (local.get $plane) (local.get $setup)))
        (local.set $current_mask (i32.load (i32.add (local.get $ma) (i32.shl (local.get $i) (i32.const 2)))))
        ;; A vertex exactly on-plane is copied once, not emitted twice as an
        ;; intersection and endpoint. This keeps the convex n+1/plane bound.
        (if (i32.or (i32.and (f64.lt (local.get $da) (f64.const 0)) (f64.gt (local.get $db) (f64.const 0)))
          (i32.and (f64.gt (local.get $da) (f64.const 0)) (f64.lt (local.get $db) (f64.const 0)))) (then
          (if (i32.ge_u (local.get $outcount) (local.get $slots)) (then (return (i32.const -1))))
          (call $d3d_software_intersection (local.get $prev) (local.get $current) (local.get $da) (local.get $db)
            (i32.add (local.get $b) (i32.mul (local.get $outcount) (i32.const 160))) (local.get $plane))
          (i32.store (i32.add (local.get $mb) (i32.shl (local.get $outcount) (i32.const 2)))
            (i32.and (local.get $previous_mask) (local.get $current_mask)))
          (local.set $outcount (i32.add (local.get $outcount) (i32.const 1)))))
        (if (f64.ge (local.get $db) (f64.const 0)) (then
          (if (i32.ge_u (local.get $outcount) (local.get $slots)) (then (return (i32.const -1))))
          (memory.copy (i32.add (local.get $b) (i32.mul (local.get $outcount) (i32.const 160))) (local.get $current) (i32.const 160))
          (i32.store (i32.add (local.get $mb) (i32.shl (local.get $outcount) (i32.const 2))) (local.get $current_mask))
          (local.set $outcount (i32.add (local.get $outcount) (i32.const 1)))))
        (local.set $prev (local.get $current)) (local.set $da (local.get $db)) (local.set $previous_mask (local.get $current_mask))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $edges (i32.lt_u (local.get $i) (local.get $count))))
      (local.set $tmp (local.get $a)) (local.set $a (local.get $b)) (local.set $b (local.get $tmp))
      (local.set $tmp (local.get $ma)) (local.set $ma (local.get $mb)) (local.set $mb (local.get $tmp))
      (local.set $count (local.get $outcount))
      (local.set $plane (i32.add (local.get $plane) (i32.const 1))) (br_if $planes (i32.lt_u (local.get $plane) (local.get $limit)))))
    ;; After all six half-spaces, W=0 implies X=Y=Z=0: the homogeneous zero
    ;; vector has no projected area. Removing it leaves the convex hull of the
    ;; positive-W vertices, without inventing an epsilon clip plane or clamp.
    (local.set $i (i32.const 0)) (local.set $outcount (i32.const 0))
    (block $positive (loop $compact
      (br_if $positive (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $current (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 160))))
      (if (f32.gt (f32.load offset=12 (local.get $current)) (f32.const 0)) (then
        (memory.copy (i32.add (local.get $a) (i32.mul (local.get $outcount) (i32.const 160))) (local.get $current) (i32.const 160))
        (i32.store (i32.add (local.get $ma) (i32.shl (local.get $outcount) (i32.const 2)))
          (i32.load (i32.add (local.get $ma) (i32.shl (local.get $i) (i32.const 2)))))
        (local.set $outcount (i32.add (local.get $outcount) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $compact)))
    (local.set $count (local.get $outcount))
    (if (i32.gt_u (local.get $count) (select (i32.const 15) (i32.const 9) (local.get $user_mask))) (then (return (i32.const -1))))
    (local.set $i (i32.const 1))
    (block $fan_done (loop $fan
      (br_if $fan_done (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $count)))
      (local.set $previous_mask (i32.load (local.get $ma)))
      (local.set $current_mask (i32.load (i32.add (local.get $ma) (i32.shl (local.get $i) (i32.const 2)))))
      (local.set $tmp (i32.load (i32.add (local.get $ma) (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 2)))))
      (local.set $edge_mask (i32.or (i32.ne (i32.and (local.get $previous_mask) (local.get $current_mask)) (i32.const 0))
        (i32.or (i32.shl (i32.ne (i32.and (local.get $current_mask) (local.get $tmp)) (i32.const 0)) (i32.const 1))
          (i32.shl (i32.ne (i32.and (local.get $tmp) (local.get $previous_mask)) (i32.const 0)) (i32.const 2)))))
      ;; Only original vertices (two edge memberships) own POINT samples.
      ;; Fan-shared vertices are emitted once per original input triangle.
      (local.set $point_mask (i32.or
        (i32.and (i32.eq (local.get $i) (i32.const 1)) (i32.gt_u (i32.popcnt (local.get $previous_mask)) (i32.const 1)))
        (i32.or (i32.shl (i32.and (i32.eq (local.get $i) (i32.const 1)) (i32.gt_u (i32.popcnt (local.get $current_mask)) (i32.const 1))) (i32.const 1))
          (i32.shl (i32.gt_u (i32.popcnt (local.get $tmp)) (i32.const 1)) (i32.const 2)))))
      ;; A point-list work record repeats one index in all three slots. The
      ;; existing clipper therefore rejects/retains the whole point without
      ;; inventing intersections. Only the first slot owns its raster sample.
      (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 16))
        (then (local.set $point_mask (i32.const 1))))
      (local.set $j (i32.const 0))
      (loop $vertex
        (if (i32.or (i32.ge_u (local.get $emitted) (i32.const 8192))
          (i32.ge_u (local.get $emitted) (i32.mul (local.get $index_count) (select (i32.const 13) (i32.const 7) (local.get $user_mask)))))
          (then (return (i32.const -1))))
        (local.set $current (local.get $a))
        (if (local.get $j) (then (local.set $current (i32.add (local.get $a)
          (i32.mul (i32.sub (i32.add (local.get $i) (local.get $j)) (i32.const 1)) (i32.const 160))))))
        (local.set $dst (i32.add (i32.load offset=152 (local.get $ctx)) (i32.mul (local.get $emitted) (i32.const 160))))
        (if (i32.eqz (call $d3d_software_project (local.get $ctx) (local.get $current) (local.get $dst))) (then (return (i32.const -1))))
        (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 65536)) (then
          (local.set $current_mask (i32.load (i32.add (local.get $ma)
            (i32.shl (i32.div_u (i32.sub (local.get $current) (local.get $a)) (i32.const 160)) (i32.const 2)))))
          (if (i32.gt_u (i32.popcnt (local.get $current_mask)) (i32.const 1)) (then
            (local.set $tmp (i32.load16_u (i32.add (local.get $indices) (i32.shl (i32.add (local.get $triangle)
              (select (i32.const 0) (select (i32.const 1) (i32.const 2) (i32.eq (local.get $current_mask) (i32.const 3)))
                (i32.eq (local.get $current_mask) (i32.const 5)))) (i32.const 1)))))
            (f32.store (i32.add (i32.add (local.get $ctx) (i32.add (i32.const 288) (i32.mul (local.get $capacity) (i32.const 1134))))
              (i32.shl (local.get $emitted) (i32.const 2)))
              (f32.load (i32.add (i32.load offset=40 (local.get $setup)) (i32.shl (local.get $tmp) (i32.const 2)))))))))
        (i32.store16 (i32.add (i32.load offset=156 (local.get $ctx)) (i32.shl (local.get $emitted) (i32.const 1)))
          (i32.or (local.get $emitted) (select (i32.shl (local.get $edge_mask) (i32.const 13))
            (select (i32.shl (local.get $point_mask) (i32.const 13)) (i32.const 0) (i32.eq (local.get $j) (i32.const 1))) (i32.eqz (local.get $j)))))
        (local.set $emitted (i32.add (local.get $emitted) (i32.const 1)))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $vertex (i32.lt_u (local.get $j) (i32.const 3))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $fan))))
    (local.set $triangle (i32.add (local.get $triangle) (i32.const 3))) (br_if $triangles (i32.lt_u (local.get $triangle) (local.get $end))))
  (i32.store offset=36 (local.get $ctx) (local.get $emitted))
  (i32.store offset=48 (local.get $ctx) (local.get $emitted))
  (local.get $emitted))

;; Clipping needs worst-case sevenfold output space only while preparing. Keep
;; the established layout formula with the smallest capacity that contains all
;; emitted vertices; this also preserves the POINT sidecar addressing contract.
;; No reallocation, vertex shader reexecution or post-write OOM is introduced.
(func $d3d_software_compact (param $ctx i32) (param $old_capacity i32) (result i32)
  (local $emitted i32) (local $capacity i32) (local $indices i32) (local $bytes i32) (local $point i32)
  (local.set $emitted (i32.load offset=48 (local.get $ctx)))
  (local.set $capacity (i32.div_u (i32.add (local.get $emitted) (i32.const 6)) (i32.const 7)))
  (local.set $point (i32.ne (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 8)) (i32.const 0)))
  (local.set $indices (i32.add (i32.add (local.get $ctx) (i32.const 288)) (i32.mul (local.get $capacity) (i32.const 1120))))
  (memory.copy (local.get $indices) (i32.load offset=156 (local.get $ctx)) (i32.shl (local.get $emitted) (i32.const 1)))
  (if (local.get $point) (then
    (memory.copy (i32.add (i32.add (local.get $ctx) (i32.const 288)) (i32.mul (local.get $capacity) (i32.const 1134)))
      (i32.add (i32.add (local.get $ctx) (i32.const 288)) (i32.mul (local.get $old_capacity) (i32.const 1134)))
      (i32.shl (local.get $emitted) (i32.const 2)))))
  (local.set $bytes (i32.add (i32.const 288) (i32.mul (local.get $capacity)
    (select (i32.const 1162) (i32.const 1134) (local.get $point)))))
  (if (i32.eqz (call $heap_shrink (call $w2g (local.get $ctx)) (local.get $bytes))) (then (return (i32.const 0))))
  (i32.store offset=156 (local.get $ctx) (local.get $indices))
  (i32.store offset=196 (local.get $ctx) (local.get $bytes))
  (i32.const 1))

(func $d3d_software_edge (param $a i32) (param $b i32) (param $x f32) (param $y f32) (result f32)
  (f32.sub (f32.mul (f32.sub (f32.load (local.get $b)) (f32.load (local.get $a))) (f32.sub (local.get $y) (f32.load offset=4 (local.get $a))))
    (f32.mul (f32.sub (f32.load offset=4 (local.get $b)) (f32.load offset=4 (local.get $a))) (f32.sub (local.get $x) (f32.load (local.get $a))))))

(func $d3d_software_inside (param $a i32) (param $b i32) (param $e f32) (result i32)
  (i32.or (f32.gt (local.get $e) (f32.const 0))
    (i32.and (f32.eq (local.get $e) (f32.const 0))
      (i32.or (f32.lt (f32.load offset=4 (local.get $b)) (f32.load offset=4 (local.get $a)))
        (i32.and (f32.eq (f32.load offset=4 (local.get $b)) (f32.load offset=4 (local.get $a)))
          (f32.gt (f32.load (local.get $b)) (f32.load (local.get $a))))))))

(func $d3d_software_interp (param $a i32) (param $b i32) (param $c i32) (param $offset i32) (param $u f32) (param $v f32) (param $w f32) (result f32)
  (f32.add (f32.add (f32.mul (local.get $u) (f32.load (i32.add (local.get $a) (local.get $offset))))
    (f32.mul (local.get $v) (f32.load (i32.add (local.get $b) (local.get $offset)))))
    (f32.mul (local.get $w) (f32.load (i32.add (local.get $c) (local.get $offset))))))

(func $d3d_software_depth_pass (param $fn i32) (param $z f32) (param $old f32) (result i32)
  (block $always (block $ge (block $ne (block $gt (block $le (block $eq (block $lt (block $never
    (br_table $never $never $lt $eq $le $gt $ne $ge $always $never (local.get $fn)))
    (return (i32.const 0))) (return (f32.lt (local.get $z) (local.get $old))))
    (return (f32.eq (local.get $z) (local.get $old)))) (return (f32.le (local.get $z) (local.get $old))))
    (return (f32.gt (local.get $z) (local.get $old)))) (return (f32.ne (local.get $z) (local.get $old))))
    (return (f32.ge (local.get $z) (local.get $old)))) (i32.const 1))

(func $d3d_software_channel (param $v f32) (result i32)
  (if (f32.ne (local.get $v) (local.get $v)) (then (return (i32.const 0))))
  (i32.trunc_f32_u (f32.add (f32.mul (f32.min (f32.max (local.get $v) (f32.const 0)) (f32.const 1)) (f32.const 255)) (f32.const 0.5))))

(func $d3d_software_prepare (param $ctx i32) (result i32)
  (local $a i32) (local $b i32) (local $c i32) (local $tmp i32) (local $idx i32) (local $base i32)
  (local $area f32) (local $lo f32) (local $hi f32) (local $size f32) (local $edges i32) (local $edge i32) (local $wire i32) (local $point i32) (local $outline i32)
  (loop $retry_prepare
  (local.set $base (i32.load offset=152 (local.get $ctx)))
  (local.set $idx (i32.add (i32.load offset=156 (local.get $ctx)) (i32.shl (i32.load offset=128 (local.get $ctx)) (i32.const 1))))
  (local.set $edges (i32.shr_u (i32.load16_u (local.get $idx)) (i32.const 13)))
  (local.set $point (i32.eq (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 48)) (i32.const 16)))
  (local.set $size (f32.const 1))
  (if (i32.ne (i32.load offset=200 (local.get $ctx)) (i32.const 0)) (then
    (local.set $size (f32.load offset=8 (i32.load offset=200 (local.get $ctx))))))
  (if (local.get $point) (then (local.set $edges (i32.shr_u (i32.load16_u offset=2 (local.get $idx)) (i32.const 13)))))
  (local.set $a (i32.add (local.get $base) (i32.mul (i32.and (i32.load16_u (local.get $idx)) (i32.const 8191)) (i32.const 160))))
  (local.set $b (i32.add (local.get $base) (i32.mul (i32.and (i32.load16_u offset=2 (local.get $idx)) (i32.const 8191)) (i32.const 160))))
  (local.set $c (i32.add (local.get $base) (i32.mul (i32.and (i32.load16_u offset=4 (local.get $idx)) (i32.const 8191)) (i32.const 160))))
  ;; Points have no polygon area or winding; their repeated index record is
  ;; not a degenerate triangle. Polygon POINT fill keeps ordinary culling.
  (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 16))
    (then (local.set $area (f32.const 1)))
    (else
  (local.set $area (call $d3d_software_edge (local.get $a) (local.get $b) (f32.load (local.get $c)) (f32.load offset=4 (local.get $c))))
  (if (f32.eq (local.get $area) (f32.const 0)) (then (return (i32.const 0))))
  (if (i32.or (i32.and (i32.eq (i32.load offset=112 (local.get $ctx)) (i32.const 2)) (f32.gt (local.get $area) (f32.const 0)))
    (i32.and (i32.eq (i32.load offset=112 (local.get $ctx)) (i32.const 3)) (f32.lt (local.get $area) (f32.const 0)))) (then (return (i32.const 0))))))
  (i32.store offset=252 (local.get $ctx) (i32.or (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 496))
    (i32.or (f32.lt (local.get $area) (f32.const 0)) (i32.shl (local.get $edges) (i32.const 1)))))
  (if (f32.lt (local.get $area) (f32.const 0)) (then
    (if (local.get $point) (then
      (i32.store offset=252 (local.get $ctx) (i32.or (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 497))
        (i32.or (i32.shl (i32.and (local.get $edges) (i32.const 1)) (i32.const 1))
          (i32.or (i32.shl (i32.and (local.get $edges) (i32.const 2)) (i32.const 2)) (i32.and (local.get $edges) (i32.const 4)))))))
    (else
    (i32.store offset=252 (local.get $ctx) (i32.or (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 497))
      (i32.or (i32.shl (i32.and (local.get $edges) (i32.const 1)) (i32.const 3))
        (i32.or (i32.shl (i32.and (local.get $edges) (i32.const 2)) (i32.const 1)) (i32.shr_u (i32.and (local.get $edges) (i32.const 4)) (i32.const 1))))))))
    (local.set $tmp (local.get $b)) (local.set $b (local.get $c)) (local.set $c (local.get $tmp))
    (local.set $area (f32.neg (local.get $area)))))
  (local.set $wire (i32.eq (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 48)) (i32.const 32)))
  (local.set $outline (i32.or (local.get $wire) (local.get $point)))
  (if (local.get $outline) (then
    (local.set $edge (i32.shr_u (i32.load offset=252 (local.get $ctx)) (i32.const 7)))
    (block $found (loop $find_edge
      (if (i32.ge_u (local.get $edge) (i32.const 3)) (then (return (i32.const 0))))
      ;; The cursor remains in original AB,BC,CA order. A filled-triangle
      ;; winding swap reverses edge slots, not the order of line effects.
      (local.set $tmp (select (i32.sub (i32.const 2) (local.get $edge)) (local.get $edge)
        (i32.and (local.get $wire) (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 1)))))
      (br_if $found (i32.and (i32.load offset=252 (local.get $ctx)) (i32.shl (i32.const 2) (local.get $tmp))))
      (local.set $edge (i32.add (local.get $edge) (i32.const 1))) (br $find_edge)))
    (i32.store offset=252 (local.get $ctx) (i32.or (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 127)) (i32.shl (local.get $edge) (i32.const 7))))
    (local.set $edge (local.get $tmp))
    (if (local.get $point) (then
      (local.set $a (select (local.get $a) (select (local.get $b) (local.get $c) (i32.eq (local.get $edge) (i32.const 1))) (i32.eqz (local.get $edge))))
      (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 65536)) (then
        ;; POINT-only geometry appends one scalar per emitted vertex. The
        ;; source value is retained across clipping, never interpolated onto
        ;; newly generated vertices (which do not own polygon points).
        (local.set $size (f32.load (i32.add
          (i32.add (local.get $ctx) (i32.add (i32.const 288)
            (i32.mul (i32.div_u (i32.sub (i32.load offset=196 (local.get $ctx)) (i32.const 288)) (i32.const 1162)) (i32.const 1134))))
          (i32.shl (i32.div_u (i32.sub (local.get $a) (i32.load offset=152 (local.get $ctx))) (i32.const 160)) (i32.const 2)))))
        (local.set $tmp (i32.load offset=200 (local.get $ctx)))
        (if (local.get $tmp)
          (then (local.set $size (f32.min (f32.min (f32.load offset=16 (local.get $tmp)) (f32.load offset=20 (local.get $tmp)))
            (f32.max (f32.load offset=12 (local.get $tmp)) (local.get $size)))))
          (else (local.set $size (f32.const 1))))))
      (if (i32.or (f32.lt (f32.load offset=8 (local.get $a)) (f32.load offset=92 (local.get $ctx)))
        (f32.gt (f32.load offset=8 (local.get $a)) (f32.load offset=96 (local.get $ctx)))) (then
        (i32.store offset=252 (local.get $ctx) (i32.add (i32.load offset=252 (local.get $ctx)) (i32.const 128))) (br $retry_prepare)))
      (local.set $b (local.get $a))) (else
    (if (i32.eq (local.get $edge) (i32.const 1)) (then (local.set $a (local.get $b)) (local.set $b (local.get $c))))
    (if (i32.eq (local.get $edge) (i32.const 2)) (then (local.set $b (local.get $a)) (local.set $a (local.get $c))))
    ;; Restore original edge direction after the filled-triangle winding swap.
    (if (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 1)) (then
      (local.set $tmp (local.get $a)) (local.set $a (local.get $b)) (local.set $b (local.get $tmp))))))
    (local.set $c (local.get $a))))
  (i32.store offset=160 (local.get $ctx) (local.get $a)) (i32.store offset=164 (local.get $ctx) (local.get $b))
  (i32.store offset=168 (local.get $ctx) (local.get $c)) (f32.store offset=172 (local.get $ctx) (select (local.get $size) (local.get $area) (local.get $point)))
  (local.set $lo (f32.min (f32.load (local.get $a)) (f32.min (f32.load (local.get $b)) (f32.load (local.get $c)))))
  (local.set $hi (f32.max (f32.load (local.get $a)) (f32.max (f32.load (local.get $b)) (f32.load (local.get $c)))))
  (if (local.get $wire) (then (local.set $lo (f32.floor (f32.add (local.get $lo) (f32.const 0.5)))) (local.set $hi (f32.floor (f32.add (local.get $hi) (f32.const 0.5))))))
  (if (local.get $point) (then (local.set $lo (f32.sub (local.get $lo) (f32.mul (local.get $size) (f32.const 0.5)))) (local.set $hi (f32.sub (f32.ceil (f32.add (local.get $hi) (f32.mul (local.get $size) (f32.const 0.5)))) (f32.const 1)))))
  (local.set $lo (f32.max (f32.ceil (local.get $lo)) (f32.convert_i32_u (i32.load offset=76 (local.get $ctx)))))
  (local.set $hi (f32.min (local.get $hi) (f32.convert_i32_u (i32.sub (i32.add (i32.load offset=76 (local.get $ctx)) (i32.load offset=84 (local.get $ctx))) (i32.const 1)))))
  (if (f32.gt (local.get $lo) (local.get $hi)) (then
    (if (local.get $outline) (then
      (i32.store offset=252 (local.get $ctx) (i32.add (i32.load offset=252 (local.get $ctx)) (i32.const 128))) (br $retry_prepare)))
    (return (i32.const 0))))
  (i32.store offset=176 (local.get $ctx) (i32.and (i32.trunc_f32_u (local.get $lo)) (i32.const -2)))
  (i32.store offset=180 (local.get $ctx) (i32.trunc_f32_u (local.get $hi)))
  (local.set $lo (f32.min (f32.load offset=4 (local.get $a)) (f32.min (f32.load offset=4 (local.get $b)) (f32.load offset=4 (local.get $c)))))
  (local.set $hi (f32.max (f32.load offset=4 (local.get $a)) (f32.max (f32.load offset=4 (local.get $b)) (f32.load offset=4 (local.get $c)))))
  (if (local.get $wire) (then (local.set $lo (f32.floor (f32.add (local.get $lo) (f32.const 0.5)))) (local.set $hi (f32.floor (f32.add (local.get $hi) (f32.const 0.5))))))
  (if (local.get $point) (then (local.set $lo (f32.sub (local.get $lo) (f32.mul (local.get $size) (f32.const 0.5)))) (local.set $hi (f32.sub (f32.ceil (f32.add (local.get $hi) (f32.mul (local.get $size) (f32.const 0.5)))) (f32.const 1)))))
  (local.set $lo (f32.max (f32.ceil (local.get $lo)) (f32.convert_i32_u (i32.load offset=80 (local.get $ctx)))))
  (local.set $hi (f32.min (local.get $hi) (f32.convert_i32_u (i32.sub (i32.add (i32.load offset=80 (local.get $ctx)) (i32.load offset=88 (local.get $ctx))) (i32.const 1)))))
  (if (f32.gt (local.get $lo) (local.get $hi)) (then
    (if (local.get $outline) (then
      (i32.store offset=252 (local.get $ctx) (i32.add (i32.load offset=252 (local.get $ctx)) (i32.const 128))) (br $retry_prepare)))
    (return (i32.const 0))))
  (i32.store offset=184 (local.get $ctx) (i32.and (i32.trunc_f32_u (local.get $lo)) (i32.const -2)))
  (i32.store offset=188 (local.get $ctx) (i32.trunc_f32_u (local.get $hi)))
  (i32.store offset=132 (local.get $ctx) (i32.load offset=176 (local.get $ctx)))
  (i32.store offset=136 (local.get $ctx) (i32.load offset=184 (local.get $ctx)))
  (i32.store offset=192 (local.get $ctx) (i32.const 1)) (return (i32.const 1))) (i32.const 0))

(func $d3d_software_samples (export "d3d_software_samples") (param $ctx i32) (result i64)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256)))
    (then (return (i64.const -1))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
      (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 0)))
    (then (return (i64.const -1))))
  (i64.load offset=240 (local.get $ctx)))

(func $d3d_software_cancel (export "d3d_software_cancel") (param $ctx i32)
  (if (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256)) (then
    (if (i32.eq (i32.load (local.get $ctx)) (i32.const 0x44535031))
      (then (i32.store offset=140 (local.get $ctx) (i32.const -2))
        (if (i32.load offset=144 (local.get $ctx)) (then
          (call $d3d_shader_vm_cancel (i32.load offset=144 (local.get $ctx))))))))))

(func $d3d_software_bind_texture (export "d3d_software_bind_texture") (param $ctx i32) (param $stage i32) (param $desc i32) (result i32)
  ;; Texture metadata can be snapshotted only before the first tile; the command
  ;; owner retains the immutable pixel allocation until completion/cancellation.
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.ne (i32.load offset=128 (local.get $ctx)) (i32.const 0))
      (i32.ne (i32.load offset=192 (local.get $ctx)) (i32.const 0))))) (then (return (i32.const 0))))
  (call $d3d_shader_vm_bind_texture (i32.load offset=148 (local.get $ctx)) (local.get $stage) (local.get $desc)))

(func $d3d_software_bind_texture_mips (export "d3d_software_bind_texture_mips") (param $ctx i32) (param $stage i32) (param $desc i32) (result i32)
  ;; Texture metadata can be snapshotted only before the first tile; the command
  ;; owner retains the immutable pixel allocation until completion/cancellation.
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.ne (i32.load offset=128 (local.get $ctx)) (i32.const 0))
      (i32.ne (i32.load offset=192 (local.get $ctx)) (i32.const 0))))) (then (return (i32.const 0))))
  (call $d3d_shader_vm_bind_texture_mips (i32.load offset=148 (local.get $ctx)) (local.get $stage) (local.get $desc)))

(func (export "d3d_software_bind_projection") (param $ctx i32) (param $stage i32) (param $count i32) (result i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.ne (i32.load offset=128 (local.get $ctx)) (i32.const 0))
      (i32.ne (i32.load offset=192 (local.get $ctx)) (i32.const 0))))) (then (return (i32.const 0))))
  (call $d3d_shader_vm_bind_projection (i32.load offset=148 (local.get $ctx)) (local.get $stage) (local.get $count)))

(func $d3d_software_bind_bump (export "d3d_software_bind_bump") (param $ctx i32) (param $stage i32) (param $desc i32) (result i32)
  ;; Versioned VM bump coefficients are copied before raster execution begins.
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.ne (i32.load offset=128 (local.get $ctx)) (i32.const 0))
      (i32.ne (i32.load offset=192 (local.get $ctx)) (i32.const 0))))) (then (return (i32.const 0))))
  (call $d3d_shader_vm_bind_bump (i32.load offset=148 (local.get $ctx)) (local.get $stage) (local.get $desc)))

;; Stencil descriptor64, all u32: version1, flags(enabled1/two-sided2),
;; byte-plane pointer,pitch,ref,readMask,writeMask, CW fail/zfail/pass/func,
;; CCW fail/zfail/pass/func,reserved0. State is copied, pixels retained.
(func $d3d_software_bind_stencil (export "d3d_software_bind_stencil") (param $ctx i32) (param $desc i32) (result i32)
  (local $i i32) (local $copy i32) (local $pitch i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.load offset=128 (local.get $ctx)) (i32.load offset=192 (local.get $ctx))))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 64))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $desc)) (i32.const 1))
    (i32.or (i32.gt_u (i32.load offset=4 (local.get $desc)) (i32.const 3)) (i32.load offset=60 (local.get $desc)))) (then (return (i32.const 0))))
  (local.set $i (i32.const 28))
  (loop $validate
    (if (i32.ge_u (i32.sub (i32.load (i32.add (local.get $desc) (local.get $i))) (i32.const 1)) (i32.const 8))
      (then (return (i32.const 0))))
    (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $validate (i32.lt_u (local.get $i) (i32.const 60))))
  (if (i32.and (i32.load offset=4 (local.get $desc)) (i32.const 1)) (then
    (if (i32.ne (i32.shr_u (i32.load offset=204 (local.get $ctx)) (i32.const 16)) (i32.const 75)) (then (return (i32.const 0))))
    (local.set $pitch (i32.load offset=12 (local.get $desc)))
    (if (i32.or (i32.lt_u (local.get $pitch) (i32.load offset=8 (local.get $ctx))) (i32.gt_u (local.get $pitch) (i32.const 2048))) (then (return (i32.const 0))))
    (if (i32.eqz (call $d3d_shader_vm_range (i32.load offset=8 (local.get $desc))
      (i32.mul (local.get $pitch) (i32.load offset=12 (local.get $ctx))))) (then (return (i32.const 0))))))
  (local.set $copy (call $heap_alloc (i32.const 64))) (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
  (local.set $copy (call $g2w (local.get $copy)))
  (memory.copy (local.get $copy) (local.get $desc) (i32.const 64))
  (call $d3d_shader_vm_free (i32.load offset=248 (local.get $ctx)))
  (i32.store offset=248 (local.get $ctx) (local.get $copy)) (i32.const 1))

(func $d3d_software_stencil_op (param $op i32) (param $old i32) (param $ref i32) (result i32)
  (block $decr (block $incr (block $invert (block $decrsat (block $incrsat (block $replace (block $zero (block $keep
    (br_table $keep $keep $zero $replace $incrsat $decrsat $invert $incr $decr $keep (local.get $op)))
    (return (local.get $old))) (return (i32.const 0))) (return (i32.and (local.get $ref) (i32.const 255))))
    (return (select (local.get $old) (i32.add (local.get $old) (i32.const 1)) (i32.eq (local.get $old) (i32.const 255)))))
    (return (select (i32.sub (local.get $old) (i32.const 1)) (i32.const 0) (local.get $old))))
    (return (i32.xor (local.get $old) (i32.const 255))))
    (return (i32.and (i32.add (local.get $old) (i32.const 1)) (i32.const 255))))
    (i32.and (i32.sub (local.get $old) (i32.const 1)) (i32.const 255)))

;; Called only after coverage, shader kill and alpha acceptance. Stencil FAIL
;; precedes ZFAIL; a disabled depth test passes for stencil operation selection.
(func $d3d_software_fragment_pass (param $ctx i32) (param $x i32) (param $y i32) (param $z f32) (result i32)
  (local $s i32) (local $p i32) (local $old i32) (local $mask i32) (local $ref i32)
  (local $face i32) (local $op i32) (local $pass i32)
  (local.set $s (i32.load offset=248 (local.get $ctx)))
  (if (local.get $s) (then
    (if (i32.eqz (i32.and (i32.load offset=4 (local.get $s)) (i32.const 1))) (then (local.set $s (i32.const 0))))))
  (local.set $pass (i32.const 1))
  (if (local.get $s) (then
    (local.set $p (i32.add (i32.load offset=8 (local.get $s))
      (i32.add (i32.mul (local.get $y) (i32.load offset=12 (local.get $s))) (local.get $x))))
    (local.set $old (i32.load8_u (local.get $p)))
    (local.set $mask (i32.and (i32.load offset=20 (local.get $s)) (i32.const 255)))
    (local.set $ref (i32.and (i32.load offset=16 (local.get $s)) (i32.const 255)))
    (local.set $face (i32.add (local.get $s) (select (i32.const 16) (i32.const 0)
      (i32.and (i32.ne (i32.and (i32.load offset=4 (local.get $s)) (i32.const 2)) (i32.const 0)) (i32.ne (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 1)) (i32.const 0))))))
    (local.set $pass (call $d3d_software_depth_pass (i32.load offset=40 (local.get $face))
      (f32.convert_i32_u (i32.and (local.get $ref) (local.get $mask)))
      (f32.convert_i32_u (i32.and (local.get $old) (local.get $mask)))))
    (local.set $op (i32.load offset=28 (local.get $face)))))
  (if (local.get $pass) (then
    (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 1)) (then
      (local.set $pass (call $d3d_software_depth_pass (i32.load offset=104 (local.get $ctx)) (local.get $z)
        (f32.load (i32.add (i32.load offset=24 (local.get $ctx))
          (i32.add (i32.mul (local.get $y) (i32.load offset=28 (local.get $ctx))) (i32.shl (local.get $x) (i32.const 2)))))))))
    (if (local.get $s) (then (local.set $op (select (i32.load offset=36 (local.get $face)) (i32.load offset=32 (local.get $face)) (local.get $pass)))))))
  (if (local.get $s) (then
    (local.set $mask (i32.and (i32.load offset=24 (local.get $s)) (i32.const 255)))
    (i32.store8 (local.get $p) (i32.or (i32.and (local.get $old) (i32.xor (local.get $mask) (i32.const 255)))
      (i32.and (call $d3d_software_stencil_op (local.get $op) (local.get $old) (local.get $ref)) (local.get $mask))))))
  (local.get $pass))

(func $d3d_software_clear_stencil (export "d3d_software_clear_stencil") (param $p i32) (param $w i32) (param $h i32) (param $pitch i32) (param $value i32) (result i32)
  (local $y i32)
  (if (i32.or (i32.eqz (local.get $w)) (i32.or (i32.eqz (local.get $h))
    (i32.or (i32.gt_u (local.get $w) (local.get $pitch)) (i32.or (i32.gt_u (local.get $pitch) (i32.const 2048)) (i32.gt_u (local.get $h) (i32.const 2048)))))) (then (return (i32.const -1))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $p) (i32.add (i32.mul (i32.sub (local.get $h) (i32.const 1)) (local.get $pitch)) (local.get $w)))) (then (return (i32.const -1))))
  (loop $rows
    (memory.fill (i32.add (local.get $p) (i32.mul (local.get $y) (local.get $pitch))) (local.get $value) (local.get $w))
    (local.set $y (i32.add (local.get $y) (i32.const 1))) (br_if $rows (i32.lt_u (local.get $y) (local.get $h)))) (i32.const 0))

;; Wireframe edges use integer Bresenham coverage, matching non-AA GDI lines.
;; Closed-form minor-axis advance avoids an unbounded line walk per quad.
(func $d3d_software_line_inside (param $a i32) (param $b i32) (param $x i32) (param $y i32) (param $last i32) (result i32)
  (local $x0 i32) (local $y0 i32) (local $dx i32) (local $dy i32) (local $sx i32) (local $sy i32) (local $k i32) (local $minor i32)
  (local.set $x0 (i32.trunc_f32_s (f32.floor (f32.add (f32.load (local.get $a)) (f32.const 0.5)))))
  (local.set $y0 (i32.trunc_f32_s (f32.floor (f32.add (f32.load offset=4 (local.get $a)) (f32.const 0.5)))))
  (local.set $dx (i32.sub (i32.trunc_f32_s (f32.floor (f32.add (f32.load (local.get $b)) (f32.const 0.5)))) (local.get $x0)))
  (local.set $dy (i32.sub (i32.trunc_f32_s (f32.floor (f32.add (f32.load offset=4 (local.get $b)) (f32.const 0.5)))) (local.get $y0)))
  (local.set $sx (select (i32.const -1) (i32.const 1) (i32.lt_s (local.get $dx) (i32.const 0))))
  (local.set $sy (select (i32.const -1) (i32.const 1) (i32.lt_s (local.get $dy) (i32.const 0))))
  (local.set $dx (i32.mul (local.get $dx) (local.get $sx))) (local.set $dy (i32.mul (local.get $dy) (local.get $sy)))
  (if (i32.eqz (i32.or (local.get $dx) (local.get $dy))) (then
    (return (i32.and (i32.ne (local.get $last) (i32.const 0)) (i32.and (i32.eq (local.get $x) (local.get $x0)) (i32.eq (local.get $y) (local.get $y0)))))))
  (if (i32.ge_u (local.get $dx) (local.get $dy)) (then
    (local.set $k (i32.mul (i32.sub (local.get $x) (local.get $x0)) (local.get $sx)))
    (if (i32.gt_u (local.get $k) (local.get $dx)) (then (return (i32.const 0))))
    (if (i32.and (i32.eqz (local.get $last)) (i32.eq (local.get $k) (local.get $dx))) (then (return (i32.const 0))))
    (local.set $minor (i32.wrap_i64 (i64.div_u (i64.add (i64.mul (i64.mul (i64.extend_i32_u (local.get $k)) (i64.extend_i32_u (local.get $dy))) (i64.const 2)) (i64.extend_i32_u (local.get $dx))) (i64.extend_i32_u (i32.mul (local.get $dx) (i32.const 2))))))
    (return (i32.eq (local.get $y) (i32.add (local.get $y0) (i32.mul (local.get $minor) (local.get $sy)))))))
  (local.set $k (i32.mul (i32.sub (local.get $y) (local.get $y0)) (local.get $sy)))
  (if (i32.gt_u (local.get $k) (local.get $dy)) (then (return (i32.const 0))))
  (if (i32.and (i32.eqz (local.get $last)) (i32.eq (local.get $k) (local.get $dy))) (then (return (i32.const 0))))
  (local.set $minor (i32.wrap_i64 (i64.div_u (i64.add (i64.mul (i64.mul (i64.extend_i32_u (local.get $k)) (i64.extend_i32_u (local.get $dx))) (i64.const 2)) (i64.extend_i32_u (local.get $dy))) (i64.extend_i32_u (i32.mul (local.get $dy) (i32.const 2))))))
  (i32.eq (local.get $x) (i32.add (local.get $x0) (i32.mul (local.get $minor) (local.get $sx)))))

;; Point state32: version1,flags(sprite1),f32 size,min,max,adapterCap,0,0.
;; ctx200 is a creation-only workspace until create returns; afterward it may
;; own this tagged copied descriptor. Shared free covers either lifetime.
(func $d3d_software_bind_points (export "d3d_software_bind_points") (param $ctx i32) (param $desc i32) (result i32)
  (local $copy i32) (local $old i32) (local $i i32) (local $size f32) (local $min f32) (local $max f32) (local $cap f32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.eqz (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 8)))
    (i32.or (i32.load offset=128 (local.get $ctx)) (i32.load offset=192 (local.get $ctx)))))) (then (return (i32.const 0))))
  (local.set $old (i32.load offset=200 (local.get $ctx)))
  (if (local.get $old) (then (if (i32.ne (i32.load (local.get $old)) (i32.const 0x44535053)) (then (return (i32.const 0))))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 32))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $desc)) (i32.const 1))
    (i32.or (i32.gt_u (i32.load offset=4 (local.get $desc)) (i32.const 1))
    (i32.or (i32.load offset=24 (local.get $desc)) (i32.load offset=28 (local.get $desc))))) (then (return (i32.const 0))))
  (local.set $i (i32.const 8))
  (loop $finite
    (local.set $size (f32.load (i32.add (local.get $desc) (local.get $i))))
    (if (i32.eqz (i32.and (f32.ge (local.get $size) (f32.const 0)) (f32.le (local.get $size) (f32.const 2048)))) (then (return (i32.const 0))))
    (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $finite (i32.lt_u (local.get $i) (i32.const 24))))
  (local.set $min (f32.load offset=12 (local.get $desc))) (local.set $max (f32.load offset=16 (local.get $desc))) (local.set $cap (f32.load offset=20 (local.get $desc)))
  (if (i32.or (f32.eq (local.get $cap) (f32.const 0)) (i32.or (f32.gt (local.get $min) (local.get $max)) (f32.gt (local.get $min) (local.get $cap)))) (then (return (i32.const 0))))
  (local.set $size (f32.min (f32.min (local.get $max) (local.get $cap)) (f32.max (local.get $min) (f32.load offset=8 (local.get $desc)))))
  (local.set $copy (call $heap_alloc (i32.const 32))) (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
  (local.set $copy (call $g2w (local.get $copy))) (memory.copy (local.get $copy) (local.get $desc) (i32.const 32))
  (i32.store (local.get $copy) (i32.const 0x44535053)) (f32.store offset=8 (local.get $copy) (local.get $size))
  (call $d3d_shader_vm_free (local.get $old)) (i32.store offset=200 (local.get $ctx) (local.get $copy)) (i32.const 1))

(func $d3d_software_bind_fill (export "d3d_software_bind_fill") (param $ctx i32) (param $mode i32) (param $last i32) (result i32)
  (local $i i32) (local $v i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.load offset=128 (local.get $ctx)) (i32.load offset=192 (local.get $ctx))))) (then (return (i32.const 0))))
  (if (i32.or (i32.gt_u (i32.sub (local.get $mode) (i32.const 1)) (i32.const 2)) (i32.gt_u (local.get $last) (i32.const 1))) (then (return (i32.const 0))))
  (if (i32.ne (i32.eq (local.get $mode) (i32.const 1))
    (i32.ne (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 8)) (i32.const 0))) (then (return (i32.const 0))))
  ;; Explicit implementation bound for pretransformed offscreen line endpoints.
  ;; Validate every endpoint before publishing the mode or writing any pixels.
  (if (i32.ne (local.get $mode) (i32.const 3)) (then
    (block $validated (loop $vertices
      (br_if $validated (i32.ge_u (local.get $i) (i32.load offset=36 (local.get $ctx))))
      (local.set $v (i32.add (i32.load offset=152 (local.get $ctx)) (i32.mul (local.get $i) (i32.const 160))))
      (if (i32.eqz (i32.and (f32.le (f32.abs (f32.load (local.get $v))) (f32.const 1048576))
        (f32.le (f32.abs (f32.load offset=4 (local.get $v))) (f32.const 1048576)))) (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $vertices)))))
  (i32.store offset=252 (local.get $ctx) (i32.or (i32.shl (local.get $mode) (i32.const 4)) (i32.shl (local.get $last) (i32.const 6)))) (i32.const 1))

(func $d3d_software_step (export "d3d_software_step") (param $ctx i32) (param $budget i32) (result i32)
  (local $vm i32) (local $a i32) (local $b i32) (local $c i32) (local $lane i32)
  (local $x i32) (local $y i32) (local $bits i32) (local $j i32) (local $dst i32)
  (local $bank i32) (local $offset i32) (local $e0 f32) (local $e1 f32) (local $e2 f32)
  (local $u f32) (local $v f32) (local $w f32) (local $iw f32) (local $riw f32) (local $z f32)
  (local $output i32) (local $wire i32) (local $point i32) (local $sprite i32) (local $dx f32) (local $dy f32) (local $half f32) (local $value f32)
  (local $vmask i32) (local $glide i32) (local $glide_q f32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const -1))))
  (if (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031)) (then (return (i32.const -1))))
  (if (i32.le_s (i32.load offset=140 (local.get $ctx)) (i32.const 0)) (then (return (i32.load offset=140 (local.get $ctx)))))
  (if (i32.eq (i32.load offset=140 (local.get $ctx)) (i32.const 2)) (then (return (i32.const 1))))
  (local.set $vm (i32.load offset=148 (local.get $ctx)))
  (local.set $glide (i32.load offset=280 (local.get $ctx)))
  (if (local.get $glide) (then
    (if (i32.ne (i32.load offset=4 (local.get $glide)) (i32.const 4)) (then (local.set $glide (i32.const 0))))))
  (block $done (loop $tiles
    (br_if $done (i32.ge_u (i32.load offset=128 (local.get $ctx)) (i32.load offset=48 (local.get $ctx))))
    (if (i32.le_s (local.get $budget) (i32.const 0)) (then (return (i32.const 1))))
    (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
    (if (i32.eqz (i32.load offset=192 (local.get $ctx))) (then
      (if (i32.eqz (call $d3d_software_prepare (local.get $ctx))) (then
        (i32.store offset=252 (local.get $ctx) (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 127)))
        (i32.store offset=128 (local.get $ctx) (i32.add (i32.load offset=128 (local.get $ctx)) (i32.const 3)))
        (br $tiles)))))
    (local.set $a (i32.load offset=160 (local.get $ctx)))
    (local.set $b (i32.load offset=164 (local.get $ctx)))
    (local.set $c (i32.load offset=168 (local.get $ctx)))
    (local.set $wire (i32.eq (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 48)) (i32.const 32)))
    (local.set $point (i32.eq (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 48)) (i32.const 16)))
    (local.set $half (f32.mul (f32.load offset=172 (local.get $ctx)) (f32.const 0.5)))
    (local.set $sprite (i32.const 0))
    (if (local.get $point) (then
      (if (i32.load offset=200 (local.get $ctx)) (then
        (local.set $sprite (i32.and (i32.load offset=4 (i32.load offset=200 (local.get $ctx))) (i32.const 1)))))))
    ;; Clear only the temp registers this program can name, not all 128. The
    ;; bank is 8192 bytes and a ps_1_1 shader may reach two registers of it, so
    ;; the constant was clearing 2KB per pixel -- about 630MB per 640x480 draw,
    ;; and a measurable fraction of an untextured pixel. The span is computed
    ;; once when the VM context is created and can never exceed the bank.
    (memory.fill (i32.add (local.get $vm) (i32.const 32)) (i32.const 0)
      (call $d3d_shader_vm_temp_bytes (local.get $vm)))
    ;; The varying loop below is a FIXED 28 iterations and the specular loop a
    ;; fixed 4, run for all four lanes of every quad whether the lane is inside
    ;; the triangle or not -- and a pixel shader that reads one varying pays for
    ;; all 32. There is no count of the varyings a program actually uses (the
    ;; compiled program in src/09ag-d3d-shader-vm.wat records no input mask), so
    ;; bound it by the data instead: a varying that is +0 at all three vertices
    ;; interpolates to zero at every pixel of this triangle, whatever the
    ;; weights. Scan the three vertices once per quad -- 32 integer loads,
    ;; against the interpolate-and-scale it saves four times over -- and store a
    ;; literal zero for those instead of calling $d3d_software_interp.
    ;;
    ;; The store stays unconditional. Skipping it would leave the previous
    ;; triangle's value in the register bank, which is the trap here: this VM
    ;; (ctx+148) keeps its varying banks across triangles and nothing else
    ;; clears them -- the memory.fill above covers vm+32..vm+8224 and the
    ;; varying banks start at vm+8224.
    ;;
    ;; The test is on the raw bits being +0, not f32.eq to zero, so a -0 vertex
    ;; still takes the arithmetic path. What it does not preserve is the SIGN of
    ;; a zero result: 0*u for a negative barycentric is -0, so an all-+0 varying
    ;; could interpolate to -0 on an outside helper lane and now reads +0. That
    ;; is visible only to a shader that divides by such a varying and cares
    ;; which infinity it gets.
    (local.set $vmask (i32.const 0)) (local.set $j (i32.const 0))
    (loop $scan
      (local.set $offset (i32.add (i32.const 16) (i32.shl (local.get $j) (i32.const 2))))
      (if (i32.eqz (i32.and
          (i32.and (i32.eqz (i32.load (i32.add (local.get $a) (local.get $offset))))
            (i32.eqz (i32.load (i32.add (local.get $b) (local.get $offset)))))
          (i32.eqz (i32.load (i32.add (local.get $c) (local.get $offset))))))
        (then (local.set $vmask (i32.or (local.get $vmask) (i32.shl (i32.const 1) (local.get $j))))))
      (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $scan (i32.lt_u (local.get $j) (i32.const 28))))
    (local.set $j (i32.const 0))
    (loop $scan_specular
      (local.set $offset (i32.add (i32.const 144) (i32.shl (local.get $j) (i32.const 2))))
      (if (i32.eqz (i32.and
          (i32.and (i32.eqz (i32.load (i32.add (local.get $a) (local.get $offset))))
            (i32.eqz (i32.load (i32.add (local.get $b) (local.get $offset)))))
          (i32.eqz (i32.load (i32.add (local.get $c) (local.get $offset))))))
        (then (local.set $vmask (i32.or (local.get $vmask) (i32.shl (i32.const 1) (i32.add (local.get $j) (i32.const 28)))))))
      (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $scan_specular (i32.lt_u (local.get $j) (i32.const 4))))
    (local.set $lane (i32.const 0)) (local.set $bits (i32.const 0))
    (loop $lanes
      (local.set $x (i32.add (i32.load offset=132 (local.get $ctx)) (i32.and (local.get $lane) (i32.const 1))))
      (local.set $y (i32.add (i32.load offset=136 (local.get $ctx)) (i32.shr_u (local.get $lane) (i32.const 1))))
        ;; D3D9 pixel centers are integer screen coordinates. Adjacent triangles
        ;; use the same top-left ownership rule, including the shared diagonal.
        (local.set $e0 (call $d3d_software_edge (local.get $b) (local.get $c) (f32.convert_i32_u (local.get $x)) (f32.convert_i32_u (local.get $y))))
        (local.set $e1 (call $d3d_software_edge (local.get $c) (local.get $a) (f32.convert_i32_u (local.get $x)) (f32.convert_i32_u (local.get $y))))
        (local.set $e2 (call $d3d_software_edge (local.get $a) (local.get $b) (f32.convert_i32_u (local.get $x)) (f32.convert_i32_u (local.get $y))))
        (local.set $u (f32.div (local.get $e0) (f32.load offset=172 (local.get $ctx))))
        (local.set $v (f32.div (local.get $e1) (f32.load offset=172 (local.get $ctx))))
        (local.set $w (f32.div (local.get $e2) (f32.load offset=172 (local.get $ctx))))
        (if (local.get $wire) (then
          (local.set $dx (f32.sub (f32.load (local.get $b)) (f32.load (local.get $a))))
          (local.set $dy (f32.sub (f32.load offset=4 (local.get $b)) (f32.load offset=4 (local.get $a))))
          (local.set $v (f32.const 0))
          (if (f32.ge (f32.abs (local.get $dx)) (f32.abs (local.get $dy)))
            (then (if (f32.ne (local.get $dx) (f32.const 0)) (then
              (local.set $v (f32.div (f32.sub (f32.convert_i32_u (local.get $x)) (f32.load (local.get $a))) (local.get $dx))))))
            (else (local.set $v (f32.div (f32.sub (f32.convert_i32_u (local.get $y)) (f32.load offset=4 (local.get $a))) (local.get $dy)))))
          (local.set $u (f32.sub (f32.const 1) (local.get $v))) (local.set $w (f32.const 0))))
        (if (local.get $point) (then (local.set $u (f32.const 1)) (local.set $v (f32.const 0)) (local.set $w (f32.const 0))))
        (local.set $z (call $d3d_software_quantize_depth
          (i32.shr_u (i32.load offset=204 (local.get $ctx)) (i32.const 16))
          (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c) (i32.const 8) (local.get $u) (local.get $v) (local.get $w))))
        ;; Glide keeps global oow in the third texture-coordinate lane. The
        ;; fourth lane is TMU-oow for PS1.4 projected sampling.
        (if (local.get $glide) (then
          (local.set $glide_q (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c)
            (i32.const 40) (local.get $u) (local.get $v) (local.get $w)))
          (if (i32.eq (i32.load offset=12 (local.get $glide)) (i32.const 2)) (then
            (local.set $z (f32.div (f32.min (f32.const 65535) (f32.max (f32.const 0)
              (f32.add (call $d3d_software_glide_w (local.get $glide_q)) (f32.load offset=16 (local.get $glide))))) (f32.const 65535)))))))
        (f32.store (i32.add (i32.add (local.get $ctx) (i32.const 208)) (i32.shl (local.get $lane) (i32.const 2))) (local.get $z))
        (local.set $iw (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c) (i32.const 12) (local.get $u) (local.get $v) (local.get $w)))
        ;; Every varying is perspective-corrected by the SAME interpolated 1/W,
        ;; and there are 33 of them per lane (fog, 28 varyings, 4 specular). One
        ;; reciprocal and 33 multiplies instead of 33 divides: an f32.div is an
        ;; order of magnitude more expensive than an f32.mul here, and this loop
        ;; is the measured bulk of the per-quad setup that runs before coverage
        ;; is even known (tools/bench-raster.js, `sliver` arm). The result can
        ;; differ from the divide in the last ulp; it is then quantized to 8
        ;; bits by $d3d_software_channel, which is why the golden-image tests
        ;; are the check that this is invisible rather than an argument that it
        ;; must be.
        (local.set $riw (f32.div (f32.const 1) (local.get $iw)))
        (f32.store (i32.add (i32.add (local.get $ctx) (i32.const 264)) (i32.shl (local.get $lane) (i32.const 2)))
          (if (result f32) (local.get $glide)
            (then (call $d3d_software_glide_fog (local.get $glide) (local.get $glide_q)
              (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c) (i32.const 8) (local.get $u) (local.get $v) (local.get $w))
              (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c) (i32.const 28) (local.get $u) (local.get $v) (local.get $w))))
            (else (if (result f32) (i32.load offset=280 (local.get $ctx))
            (then (call $d3d_software_table_fog_factor (i32.load offset=280 (local.get $ctx))
              (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c) (i32.const 8) (local.get $u) (local.get $v) (local.get $w)) (local.get $iw)))
            (else (f32.mul (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c) (i32.const 128) (local.get $u) (local.get $v) (local.get $w)) (local.get $riw)))))))
        (local.set $j (i32.const 0))
        (loop $varyings
          (local.set $bank (select (i32.const 8224)
            (i32.add (i32.const 24608) (i32.shl (i32.and (i32.sub (local.get $j) (i32.const 4)) (i32.const 28)) (i32.const 4)))
            (i32.lt_u (local.get $j) (i32.const 4))))
          (local.set $value (if (result f32) (i32.and (i32.shr_u (local.get $vmask) (local.get $j)) (i32.const 1))
            (then (f32.mul (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c)
              (i32.add (i32.const 16) (i32.shl (local.get $j) (i32.const 2))) (local.get $u) (local.get $v) (local.get $w)) (local.get $riw)))
            (else (f32.const 0))))
          (if (i32.and (i32.ne (local.get $sprite) (i32.const 0)) (i32.ge_u (local.get $j) (i32.const 4))) (then
            (local.set $value (select (f32.const 1) (f32.const 0) (i32.eq (i32.and (local.get $j) (i32.const 3)) (i32.const 3))))
            (if (i32.eqz (i32.and (local.get $j) (i32.const 3))) (then
              (local.set $value (f32.div (f32.sub (f32.convert_i32_u (local.get $x)) (f32.sub (f32.load (local.get $a)) (local.get $half))) (f32.load offset=172 (local.get $ctx))))))
            (if (i32.eq (i32.and (local.get $j) (i32.const 3)) (i32.const 1)) (then
              (local.set $value (f32.div (f32.sub (f32.convert_i32_u (local.get $y)) (f32.sub (f32.load offset=4 (local.get $a)) (local.get $half))) (f32.load offset=172 (local.get $ctx))))))))
          (f32.store (i32.add (i32.add (local.get $vm) (local.get $bank))
            (i32.add (i32.shl (i32.and (local.get $j) (i32.const 3)) (i32.const 4)) (i32.shl (local.get $lane) (i32.const 2))))
            (local.get $value))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $varyings (i32.lt_u (local.get $j) (i32.const 28))))
        ;; The second colour varying, snapshot bytes144..159, lands in v1 --
        ;; pixel bank1 register1, one register past v0, so8224+64 = 8288.
        ;; Perspective-corrected like every other varying: the snapshot stores
        ;; it over W and the interpolated value is divided by the interpolated
        ;; 1/W. A vertex shader that never wrote oD1 stored zeroes, so v1 still
        ;; reads zero here, exactly as it did before the varying existed.
        (local.set $j (i32.const 0))
        (loop $specular
          (f32.store (i32.add (i32.add (local.get $vm) (i32.const 8288))
            (i32.add (i32.shl (local.get $j) (i32.const 4)) (i32.shl (local.get $lane) (i32.const 2))))
            (if (result f32) (i32.and (i32.shr_u (local.get $vmask) (i32.add (local.get $j) (i32.const 28))) (i32.const 1))
              (then (f32.mul (call $d3d_software_interp (local.get $a) (local.get $b) (local.get $c)
                (i32.add (i32.const 144) (i32.shl (local.get $j) (i32.const 2))) (local.get $u) (local.get $v) (local.get $w)) (local.get $riw)))
              (else (f32.const 0))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $specular (i32.lt_u (local.get $j) (i32.const 4))))
      (block $outside
        (br_if $outside (i32.or (i32.lt_u (local.get $x) (i32.load offset=76 (local.get $ctx)))
          (i32.or (i32.lt_u (local.get $y) (i32.load offset=80 (local.get $ctx)))
          (i32.or (i32.ge_u (local.get $x) (i32.add (i32.load offset=76 (local.get $ctx)) (i32.load offset=84 (local.get $ctx))))
            (i32.ge_u (local.get $y) (i32.add (i32.load offset=80 (local.get $ctx)) (i32.load offset=88 (local.get $ctx))))))))
        (if (local.get $point) (then
          (br_if $outside (i32.eqz (i32.and
            (i32.and (f32.ge (f32.convert_i32_u (local.get $x)) (f32.sub (f32.load (local.get $a)) (local.get $half)))
              (f32.lt (f32.convert_i32_u (local.get $x)) (f32.add (f32.load (local.get $a)) (local.get $half))))
            (i32.and (f32.ge (f32.convert_i32_u (local.get $y)) (f32.sub (f32.load offset=4 (local.get $a)) (local.get $half)))
              (f32.lt (f32.convert_i32_u (local.get $y)) (f32.add (f32.load offset=4 (local.get $a)) (local.get $half))))))))
        (else (if (local.get $wire) (then
          (br_if $outside (i32.eqz (call $d3d_software_line_inside (local.get $a) (local.get $b) (local.get $x) (local.get $y)
            (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 64)))))) (else
        (br_if $outside (i32.eqz (i32.and (call $d3d_software_inside (local.get $b) (local.get $c) (local.get $e0))
          (i32.and (call $d3d_software_inside (local.get $c) (local.get $a) (local.get $e1))
            (call $d3d_software_inside (local.get $a) (local.get $b) (local.get $e2))))))))))
        (local.set $bits (i32.or (local.get $bits) (i32.shl (i32.const 1) (local.get $lane)))))
      (local.set $lane (i32.add (local.get $lane) (i32.const 1))) (br_if $lanes (i32.lt_u (local.get $lane) (i32.const 4))))
    (if (local.get $bits) (then
      (i32.store offset=8 (local.get $vm) (i32.const 0)) (i32.store offset=12 (local.get $vm) (i32.const 1))
      (i32.store offset=16 (local.get $vm) (local.get $bits))
      ;; Derivative helper lanes execute but coverage/depth remain output-only.
      (i32.store offset=24 (local.get $vm) (i32.const 15))
      (if (i32.ne (call $d3d_shader_vm_run (local.get $vm) (i32.const 8192)) (i32.const 0))
        (then (i32.store offset=140 (local.get $ctx) (i32.const -1)) (return (i32.const -1))))
      (local.set $bits (i32.and (local.get $bits) (call $d3d_shader_vm_live_mask (local.get $vm))))
      ;; Shader-written PS1.3 depth replaces interpolated Z before the existing
      ;; post-shader alpha/stencil/depth tests and their sample accounting.
      (if (call $d3d_shader_vm_depth_valid (local.get $vm)) (then
        (local.set $lane (i32.const 0))
        (loop $shader_depth
          (f32.store (i32.add (i32.add (local.get $ctx) (i32.const 208)) (i32.shl (local.get $lane) (i32.const 2)))
            (call $d3d_software_quantize_depth (i32.shr_u (i32.load offset=204 (local.get $ctx)) (i32.const 16))
              (call $d3d_shader_vm_depth (local.get $vm) (local.get $lane))))
          (local.set $lane (i32.add (local.get $lane) (i32.const 1)))
          (br_if $shader_depth (i32.lt_u (local.get $lane) (i32.const 4))))))
      (local.set $lane (i32.const 0))
      (loop $write
        (if (i32.ne (i32.and (local.get $bits) (i32.shl (i32.const 1) (local.get $lane))) (i32.const 0)) (then
          (block $rejected
          (local.set $x (i32.add (i32.load offset=132 (local.get $ctx)) (i32.and (local.get $lane) (i32.const 1))))
          (local.set $y (i32.add (i32.load offset=136 (local.get $ctx)) (i32.shr_u (local.get $lane) (i32.const 1))))
          (br_if $rejected (i32.eqz (call $d3d_software_scissor_pass (i32.load offset=284 (local.get $ctx)) (local.get $x) (local.get $y))))
          (br_if $rejected (i32.eqz (call $d3d_software_alpha_pass (i32.load offset=204 (local.get $ctx))
            (f32.load (i32.add (i32.add (local.get $vm) (i32.const 80)) (i32.shl (local.get $lane) (i32.const 2)))))))
          (br_if $rejected (i32.eqz (call $d3d_software_fragment_pass (local.get $ctx) (local.get $x) (local.get $y)
            (f32.load (i32.add (i32.add (local.get $ctx) (i32.const 208)) (i32.shl (local.get $lane) (i32.const 2)))))))
          (i64.store offset=240 (local.get $ctx)
            (i64.add (i64.load offset=240 (local.get $ctx)) (i64.const 1)))
          (local.set $dst (i32.add (i32.load offset=16 (local.get $ctx))
            (i32.add (i32.mul (local.get $y) (i32.load offset=20 (local.get $ctx))) (i32.shl (local.get $x) (i32.const 2)))))
          (local.set $output (call $d3d_software_output (local.get $ctx)
            (i32.add (i32.add (local.get $vm) (i32.const 32)) (i32.shl (local.get $lane) (i32.const 2)))
            (i32.load (local.get $dst))))
          (local.set $j (i32.const 0))
          (loop $channels
            (if (i32.and (i32.load offset=108 (local.get $ctx)) (i32.shl (i32.const 1) (local.get $j))) (then
              (local.set $offset (select (i32.sub (i32.const 2) (local.get $j)) (i32.const 3) (i32.lt_u (local.get $j) (i32.const 3))))
              (i32.store8 (i32.add (local.get $dst) (local.get $offset))
                (i32.shr_u (local.get $output) (i32.shl (local.get $offset) (i32.const 3))))))
            (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $channels (i32.lt_u (local.get $j) (i32.const 4))))
          (if (i32.and (i32.load offset=100 (local.get $ctx)) (i32.const 2)) (then
            (f32.store (i32.add (i32.load offset=24 (local.get $ctx))
              (i32.add (i32.mul (local.get $y) (i32.load offset=28 (local.get $ctx))) (i32.shl (local.get $x) (i32.const 2))))
              (f32.load (i32.add (i32.add (local.get $ctx) (i32.const 208)) (i32.shl (local.get $lane) (i32.const 2))))))))))
        (local.set $lane (i32.add (local.get $lane) (i32.const 1))) (br_if $write (i32.lt_u (local.get $lane) (i32.const 4))))))
    (i32.store offset=132 (local.get $ctx) (i32.add (i32.load offset=132 (local.get $ctx)) (i32.const 2)))
    (if (i32.gt_u (i32.load offset=132 (local.get $ctx)) (i32.load offset=180 (local.get $ctx))) (then
      (i32.store offset=132 (local.get $ctx) (i32.load offset=176 (local.get $ctx)))
      (i32.store offset=136 (local.get $ctx) (i32.add (i32.load offset=136 (local.get $ctx)) (i32.const 2)))))
    (if (i32.gt_u (i32.load offset=136 (local.get $ctx)) (i32.load offset=188 (local.get $ctx))) (then
      (i32.store offset=192 (local.get $ctx) (i32.const 0))
      (if (i32.and (i32.or (local.get $wire) (local.get $point)) (i32.lt_u (i32.shr_u (i32.load offset=252 (local.get $ctx)) (i32.const 7)) (i32.const 2)))
        (then (i32.store offset=252 (local.get $ctx) (i32.add (i32.load offset=252 (local.get $ctx)) (i32.const 128))))
        (else (i32.store offset=252 (local.get $ctx) (i32.and (i32.load offset=252 (local.get $ctx)) (i32.const 127)))
          (i32.store offset=128 (local.get $ctx) (i32.add (i32.load offset=128 (local.get $ctx)) (i32.const 3)))))))
    (br $tiles)))
  (i32.store offset=140 (local.get $ctx) (i32.const 0)) (i32.const 0))

;; Native output blend state: copied before first tile, immutable afterward.
;; Descriptor36: version1, flags(enabled1/separateAlpha2), src,dst,op,
;; srcAlpha,dstAlpha,opAlpha,ARGB constant. D3D9Ex dual-source factors rejected.
;; References: https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dblend
;; https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dblendop
(func $d3d_software_blend_pack (param $s i32) (param $d i32) (param $op i32) (result i32)
  (if (i32.or (i32.gt_u (i32.sub (local.get $s) (i32.const 1)) (i32.const 14))
    (i32.or (i32.gt_u (i32.sub (local.get $d) (i32.const 1)) (i32.const 14))
      (i32.gt_u (i32.sub (local.get $op) (i32.const 1)) (i32.const 4)))) (then (return (i32.const -1))))
  (if (i32.or (i32.eq (local.get $d) (i32.const 12)) (i32.eq (local.get $d) (i32.const 13))) (then (return (i32.const -1))))
  (if (i32.eq (local.get $s) (i32.const 12)) (then (local.set $s (i32.const 5)) (local.set $d (i32.const 6))))
  (if (i32.eq (local.get $s) (i32.const 13)) (then (local.set $s (i32.const 6)) (local.set $d (i32.const 5))))
  (i32.or (local.get $s) (i32.or (i32.shl (local.get $d) (i32.const 4)) (i32.shl (local.get $op) (i32.const 8)))))
;; D3D9 alpha testing skips all framebuffer processing on failure.
;; ALPHAREF is the low8 bits of its DWORD; compare shader alpha against ref/255.
;; https://learn.microsoft.com/en-us/windows/win32/direct3d9/alpha-testing-state
;; https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3drenderstatetype
;; The docs do not mandate sub-UNORM8 incoming-alpha quantization. This path
;; compares clamped f32 (matching current GLSL); native precision parity remains
;; a reference gate, not an assertion of bit-identical hardware behavior.
(func $d3d_software_scissor_pass (param $rect i32) (param $x i32) (param $y i32) (result i32)
  (if (i32.eqz (local.get $rect)) (then (return (i32.const 1))))
  (i32.and (i32.and (i32.ge_s (local.get $x) (i32.load (local.get $rect))) (i32.lt_s (local.get $x) (i32.load offset=8 (local.get $rect))))
    (i32.and (i32.ge_s (local.get $y) (i32.load offset=4 (local.get $rect))) (i32.lt_s (local.get $y) (i32.load offset=12 (local.get $rect))))))
(func (export "d3d_software_bind_scissor") (param $ctx i32) (param $enabled i32) (param $left i32) (param $top i32) (param $right i32) (param $bottom i32) (result i32)
  (local $copy i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 288))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
      (i32.or (i32.ne (i32.load offset=128 (local.get $ctx)) (i32.const 0))
        (i32.ne (i32.load offset=192 (local.get $ctx)) (i32.const 0))))) (then (return (i32.const 0))))
  (if (i32.gt_u (local.get $enabled) (i32.const 1)) (then (return (i32.const 0))))
  (if (local.get $enabled) (then
    (if (i32.or (i32.lt_s (local.get $left) (i32.const 0)) (i32.or (i32.lt_s (local.get $top) (i32.const 0))
      (i32.or (i32.lt_s (local.get $right) (local.get $left)) (i32.or (i32.lt_s (local.get $bottom) (local.get $top))
        (i32.or (i32.gt_u (local.get $right) (i32.load offset=8 (local.get $ctx)))
          (i32.gt_u (local.get $bottom) (i32.load offset=12 (local.get $ctx)))))))) (then (return (i32.const 0))))
    (local.set $copy (call $heap_alloc (i32.const 16)))
    (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
    (local.set $copy (call $g2w (local.get $copy)))
    (i32.store (local.get $copy) (local.get $left)) (i32.store offset=4 (local.get $copy) (local.get $top))
    (i32.store offset=8 (local.get $copy) (local.get $right)) (i32.store offset=12 (local.get $copy) (local.get $bottom))))
  (call $d3d_shader_vm_free (i32.load offset=284 (local.get $ctx)))
  (i32.store offset=284 (local.get $ctx) (local.get $copy)) (i32.const 1))

(func (export "d3d_software_bind_alpha") (param $ctx i32) (param $desc i32) (result i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.ne (i32.load offset=128 (local.get $ctx)) (i32.const 0))
      (i32.ne (i32.load offset=192 (local.get $ctx)) (i32.const 0))))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 16))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $desc)) (i32.const 1))
    (i32.or (i32.gt_u (i32.load offset=4 (local.get $desc)) (i32.const 1))
      (i32.gt_u (i32.sub (i32.load offset=8 (local.get $desc)) (i32.const 1)) (i32.const 7)))) (then (return (i32.const 0))))
  (i32.store offset=204 (local.get $ctx) (i32.or (i32.and (i32.load offset=204 (local.get $ctx)) (i32.const 0xffff0000)) (i32.or (i32.load offset=4 (local.get $desc))
    (i32.or (i32.shl (i32.load offset=8 (local.get $desc)) (i32.const 1))
      (i32.shl (i32.and (i32.load offset=12 (local.get $desc)) (i32.const 255)) (i32.const 8))))))
  (i32.const 1))
;; D16/D24 values are rounded on both Clear and raster writes. Normalized
;; f32 storage preserves each 16/24-bit representable value; f64 scaling avoids
;; premature f32 rounding at quantization boundaries. Format0 is legacy f32.
(func $d3d_software_quantize_depth (export "d3d_software_quantize_depth") (param $format i32) (param $z f32) (result f32)
  (local $scale f64)
  (if (i32.or (i32.eq (local.get $format) (i32.const 80)) (i32.eq (local.get $format) (i32.const 70)))
    (then (local.set $scale (f64.const 65535))))
  (if (i32.or (i32.eq (local.get $format) (i32.const 75)) (i32.eq (local.get $format) (i32.const 77)))
    (then (local.set $scale (f64.const 16777215))))
  (if (f64.eq (local.get $scale) (f64.const 0)) (then (return (local.get $z))))
  (f32.demote_f64 (f64.div (f64.floor (f64.add (f64.const 0.5)
    (f64.mul (f64.promote_f32 (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $z)))) (local.get $scale)))) (local.get $scale))))
(func (export "d3d_software_bind_depth_format") (param $ctx i32) (param $format i32) (result i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.load offset=128 (local.get $ctx)) (i32.load offset=192 (local.get $ctx))))) (then (return (i32.const 0))))
  (if (i32.eqz (i32.or (i32.eqz (local.get $format))
    (i32.or (i32.eq (local.get $format) (i32.const 80))
    (i32.or (i32.eq (local.get $format) (i32.const 70))
    (i32.or (i32.eq (local.get $format) (i32.const 75))
      (i32.eq (local.get $format) (i32.const 77))))))) (then (return (i32.const 0))))
  (i32.store offset=204 (local.get $ctx) (i32.or (i32.and (i32.load offset=204 (local.get $ctx)) (i32.const 65535))
    (i32.shl (local.get $format) (i32.const 16))))
  (i32.const 1))
(func $d3d_software_alpha_pass (param $state i32) (param $alpha f32) (result i32)
  (if (i32.eqz (i32.and (local.get $state) (i32.const 1))) (then (return (i32.const 1))))
  (call $d3d_software_depth_pass (i32.and (i32.shr_u (local.get $state) (i32.const 1)) (i32.const 15))
    (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $alpha)))
    (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $state) (i32.const 8)) (i32.const 255))) (f32.const 255))))

(func (export "d3d_software_bind_blend") (param $ctx i32) (param $desc i32) (result i32)
  (local $rgb i32) (local $alpha i32) (local $flags i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 256))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
    (i32.or (i32.ne (i32.load offset=128 (local.get $ctx)) (i32.const 0))
      (i32.ne (i32.load offset=192 (local.get $ctx)) (i32.const 0))))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 36))) (then (return (i32.const 0))))
  (if (i32.ne (i32.load (local.get $desc)) (i32.const 1)) (then (return (i32.const 0))))
  (local.set $flags (i32.load offset=4 (local.get $desc)))
  (if (i32.gt_u (local.get $flags) (i32.const 3)) (then (return (i32.const 0))))
  (local.set $rgb (call $d3d_software_blend_pack (i32.load offset=8 (local.get $desc)) (i32.load offset=12 (local.get $desc)) (i32.load offset=16 (local.get $desc))))
  (local.set $alpha (call $d3d_software_blend_pack (i32.load offset=20 (local.get $desc)) (i32.load offset=24 (local.get $desc)) (i32.load offset=28 (local.get $desc))))
  (if (i32.or (i32.eq (local.get $rgb) (i32.const -1)) (i32.eq (local.get $alpha) (i32.const -1))) (then (return (i32.const 0))))
  (i32.store offset=224 (local.get $ctx) (local.get $flags))
  (i32.store offset=228 (local.get $ctx) (local.get $rgb))
  (i32.store offset=232 (local.get $ctx) (local.get $alpha))
  (i32.store offset=236 (local.get $ctx) (i32.load offset=32 (local.get $desc)))
  (i32.const 1))
(func $d3d_software_rgba (param $bits i32) (result v128)
  (local $v v128)
  (local.set $v (f32x4.replace_lane 0 (local.get $v) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $bits) (i32.const 16)) (i32.const 255))) (f32.const 255))))
  (local.set $v (f32x4.replace_lane 1 (local.get $v) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $bits) (i32.const 8)) (i32.const 255))) (f32.const 255))))
  (local.set $v (f32x4.replace_lane 2 (local.get $v) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $bits) (i32.const 0)) (i32.const 255))) (f32.const 255))))
  (local.set $v (f32x4.replace_lane 3 (local.get $v) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $bits) (i32.const 24)) (i32.const 255))) (f32.const 255))))
  (local.get $v))
(func $d3d_software_blend_factor (param $kind i32) (param $s v128) (param $d v128) (param $k v128) (result v128)
  (if (i32.eq (local.get $kind) (i32.const 1)) (then (return (v128.const f32x4 0 0 0 0))))
  (if (i32.eq (local.get $kind) (i32.const 2)) (then (return (v128.const f32x4 1 1 1 1))))
  (if (i32.eq (local.get $kind) (i32.const 3)) (then (return (local.get $s))))
  (if (i32.eq (local.get $kind) (i32.const 4)) (then (return (f32x4.sub (v128.const f32x4 1 1 1 1) (local.get $s)))))
  (if (i32.eq (local.get $kind) (i32.const 5)) (then (return (f32x4.splat (f32x4.extract_lane 3 (local.get $s))))))
  (if (i32.eq (local.get $kind) (i32.const 6)) (then (return (f32x4.splat (f32.sub (f32.const 1) (f32x4.extract_lane 3 (local.get $s)))))))
  (if (i32.eq (local.get $kind) (i32.const 7)) (then (return (f32x4.splat (f32x4.extract_lane 3 (local.get $d))))))
  (if (i32.eq (local.get $kind) (i32.const 8)) (then (return (f32x4.splat (f32.sub (f32.const 1) (f32x4.extract_lane 3 (local.get $d)))))))
  (if (i32.eq (local.get $kind) (i32.const 9)) (then (return (local.get $d))))
  (if (i32.eq (local.get $kind) (i32.const 10)) (then (return (f32x4.sub (v128.const f32x4 1 1 1 1) (local.get $d)))))
  (if (i32.eq (local.get $kind) (i32.const 11)) (then (return (f32x4.replace_lane 3 (f32x4.splat (f32.min (f32x4.extract_lane 3 (local.get $s)) (f32.sub (f32.const 1) (f32x4.extract_lane 3 (local.get $d))))) (f32.const 1)))))
  (if (i32.eq (local.get $kind) (i32.const 14)) (then (return (local.get $k))))
  (f32x4.sub (v128.const f32x4 1 1 1 1) (local.get $k)))
(func $d3d_software_blend_eval (param $state i32) (param $s v128) (param $d v128) (param $k v128) (result v128)
  (local $op i32) (local $a v128) (local $b v128)
  (local.set $op (i32.shr_u (local.get $state) (i32.const 8)))
  (if (i32.eq (local.get $op) (i32.const 4)) (then (return (f32x4.min (local.get $s) (local.get $d)))))
  (if (i32.eq (local.get $op) (i32.const 5)) (then (return (f32x4.max (local.get $s) (local.get $d)))))
  (local.set $a (f32x4.mul (local.get $s) (call $d3d_software_blend_factor (i32.and (local.get $state) (i32.const 15)) (local.get $s) (local.get $d) (local.get $k))))
  (local.set $b (f32x4.mul (local.get $d) (call $d3d_software_blend_factor (i32.and (i32.shr_u (local.get $state) (i32.const 4)) (i32.const 15)) (local.get $s) (local.get $d) (local.get $k))))
  (if (i32.eq (local.get $op) (i32.const 2)) (then (return (f32x4.sub (local.get $a) (local.get $b)))))
  (if (i32.eq (local.get $op) (i32.const 3)) (then (return (f32x4.sub (local.get $b) (local.get $a)))))
  (f32x4.add (local.get $a) (local.get $b)))
;; Glide uses an opt-in owned 96-byte descriptor in the existing table-fog
;; allocation: version1, mode4, ARGBcolor, depthMode0/1/2, bias:f32,
;; fogMode0/1(alpha)/2(table)/3(Z), two reserved zeroes, table[64].
;; This is internal shader lowering, never a guest D3D capability.
(func $d3d_software_glide_w (export "d3d_software_glide_w") (param $q f32) (result f32)
  (local $e i32)
  ;; Voodoo 12-bit mantissa/four-bit exponent W encoding. Equivalent to
  ;; MAME voodoo_render.cpp compute_wfloat, after Glide oow's 2^48 scale.
  (if (f32.ge (local.get $q) (f32.const 1)) (then (return (f32.const 0))))
  (if (f32.le (local.get $q) (f32.const 0.0000152587890625)) (then (return (f32.const 65535))))
  (if (f32.ne (local.get $q) (local.get $q)) (then (return (f32.const 65535))))
  (block $ready (loop $exponent
    (br_if $ready (f32.ge (local.get $q) (f32.const 0.5)))
    (local.set $q (f32.mul (local.get $q) (f32.const 2)))
    (local.set $e (i32.add (local.get $e) (i32.const 1))) (br $exponent)))
  (f32.min (f32.const 65535) (f32.max (f32.const 0)
    (f32.sub (f32.convert_i32_u (i32.add (i32.shl (local.get $e) (i32.const 12)) (i32.const 8192)))
      (f32.floor (f32.mul (local.get $q) (f32.const 8192)))))))
(func $d3d_software_glide_fog (param $state i32) (param $q f32) (param $z f32) (param $alpha f32) (result f32)
  (local $mode i32) (local $value f32) (local $f f32) (local $i i32) (local $a f32) (local $b f32)
  (local.set $mode (i32.load offset=20 (local.get $state)))
  (if (i32.eqz (local.get $mode)) (then (return (f32.const 1))))
  (local.set $value (local.get $alpha))
  (if (i32.eq (local.get $mode) (i32.const 3)) (then (local.set $value (local.get $z))))
  (if (i32.eq (local.get $mode) (i32.const 2)) (then
    (local.set $f (f32.min (f32.const 63) (f32.max (f32.const 0)
      (f32.div (f32.add (call $d3d_software_glide_w (local.get $q)) (f32.load offset=16 (local.get $state))) (f32.const 1024)))))
    (local.set $i (i32.trunc_sat_f32_u (local.get $f)))
    (local.set $a (f32.convert_i32_u (i32.load8_u (i32.add (i32.add (local.get $state) (i32.const 32)) (local.get $i)))))
    (local.set $b (f32.convert_i32_u (i32.load8_u (i32.add (i32.add (local.get $state) (i32.const 32))
      (select (local.get $i) (i32.add (local.get $i) (i32.const 1)) (i32.eq (local.get $i) (i32.const 63)))))))
    (local.set $value (f32.div (f32.add (local.get $a) (f32.mul (f32.sub (local.get $b) (local.get $a))
      (f32.sub (local.get $f) (f32.convert_i32_u (local.get $i))))) (f32.const 255)))))
  (f32.sub (f32.const 1) (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $value)))))
(func (export "d3d_software_bind_glide") (param $ctx i32) (param $desc i32) (result i32)
  (local $copy i32)
  (if (i32.eqz (i32.and (call $d3d_shader_vm_range (local.get $ctx) (i32.const 288))
    (call $d3d_shader_vm_range (local.get $desc) (i32.const 96)))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
      (i32.or (i32.load offset=128 (local.get $ctx)) (i32.load offset=192 (local.get $ctx))))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $desc)) (i32.const 1))
    (i32.or (i32.ne (i32.load offset=4 (local.get $desc)) (i32.const 4))
      (i32.or (i32.gt_u (i32.load offset=12 (local.get $desc)) (i32.const 2))
        (i32.or (i32.gt_u (i32.load offset=20 (local.get $desc)) (i32.const 3))
          (i32.or (i32.load offset=24 (local.get $desc)) (i32.load offset=28 (local.get $desc))))))) (then (return (i32.const 0))))
  (if (i32.eqz (f32.le (f32.abs (f32.load offset=16 (local.get $desc))) (f32.const 65535))) (then (return (i32.const 0))))
  (local.set $copy (call $heap_alloc (i32.const 96))) (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
  (local.set $copy (call $g2w (local.get $copy))) (memory.copy (local.get $copy) (local.get $desc) (i32.const 96))
  (call $d3d_shader_vm_free (i32.load offset=280 (local.get $ctx)))
  (i32.store offset=280 (local.get $ctx) (local.get $copy))
  (i32.store offset=256 (local.get $ctx) (i32.ne (i32.load offset=20 (local.get $copy)) (i32.const 0)))
  (i32.store offset=260 (local.get $ctx) (i32.load offset=8 (local.get $copy))) (i32.const 1))

;; Owned table-fog state32: version1, mode1..3, ARGBcolor, depthMode0=Z/1=W,
;; float start/end/density, reserved0. W mode is a private conformance path;
;; the host currently advertises no WFOG and always supplies device-Z mode.
(func (export "d3d_software_bind_table_fog") (param $ctx i32) (param $desc i32) (result i32)
  (local $copy i32) (local $mode i32)
  (if (i32.eqz (i32.and (call $d3d_shader_vm_range (local.get $ctx) (i32.const 288))
    (call $d3d_shader_vm_range (local.get $desc) (i32.const 32)))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
      (i32.or (i32.load offset=128 (local.get $ctx)) (i32.load offset=192 (local.get $ctx))))) (then (return (i32.const 0))))
  (local.set $mode (i32.load offset=4 (local.get $desc)))
  (if (i32.or (i32.ne (i32.load (local.get $desc)) (i32.const 1))
    (i32.or (i32.gt_u (i32.sub (local.get $mode) (i32.const 1)) (i32.const 2))
      (i32.or (i32.gt_u (i32.load offset=12 (local.get $desc)) (i32.const 1)) (i32.load offset=28 (local.get $desc))))) (then (return (i32.const 0))))
  (if (i32.eq (local.get $mode) (i32.const 3)) (then
    (if (i32.eqz (i32.and (i32.and
      (f32.le (f32.abs (f32.load offset=16 (local.get $desc))) (f32.const 3.4028234663852886e38))
      (f32.le (f32.abs (f32.load offset=20 (local.get $desc))) (f32.const 3.4028234663852886e38)))
      (f32.ne (f32.load offset=16 (local.get $desc)) (f32.load offset=20 (local.get $desc))))) (then (return (i32.const 0)))))
  (else (if (i32.eqz (f32.le (f32.abs (f32.load offset=24 (local.get $desc))) (f32.const 3.4028234663852886e38))) (then (return (i32.const 0))))))
  (local.set $copy (call $heap_alloc (i32.const 32))) (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
  (local.set $copy (call $g2w (local.get $copy))) (memory.copy (local.get $copy) (local.get $desc) (i32.const 32))
  (call $d3d_shader_vm_free (i32.load offset=280 (local.get $ctx)))
  (i32.store offset=280 (local.get $ctx) (local.get $copy)) (i32.store offset=256 (local.get $ctx) (i32.const 1))
  (i32.store offset=260 (local.get $ctx) (i32.load offset=8 (local.get $copy))) (i32.const 1))
(func $d3d_software_table_fog_factor (param $state i32) (param $z f32) (param $iw f32) (result f32)
  (local $value f32) (local $distance f32)
  (local.set $distance (if (result f32) (i32.load offset=12 (local.get $state))
    (then (f32.div (f32.const 1) (local.get $iw))) (else (local.get $z))))
  (if (i32.eq (i32.load offset=4 (local.get $state)) (i32.const 3)) (then
    (local.set $value (f32.div (f32.sub (f32.load offset=20 (local.get $state)) (local.get $distance))
      (f32.sub (f32.load offset=20 (local.get $state)) (f32.load offset=16 (local.get $state))))))
  (else
    (local.set $value (f32.mul (local.get $distance) (f32.load offset=24 (local.get $state))))
    (if (i32.eq (i32.load offset=4 (local.get $state)) (i32.const 2)) (then (local.set $value (f32.mul (local.get $value) (local.get $value)))))
    (local.set $value (f32x4.extract_lane 0 (call $d3d_shader_vm_exp2 (f32x4.splat (f32.mul (local.get $value) (f32.const -1.4426950408889634))))))))
  (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $value))))
(func (export "d3d_software_bind_fog") (param $ctx i32) (param $enabled i32) (param $color i32) (result i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $ctx) (i32.const 288))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $ctx)) (i32.const 0x44535031))
    (i32.or (i32.gt_u (local.get $enabled) (i32.const 1))
      (i32.or (i32.ne (i32.load offset=140 (local.get $ctx)) (i32.const 1))
        (i32.or (i32.load offset=128 (local.get $ctx)) (i32.load offset=192 (local.get $ctx)))))) (then (return (i32.const 0))))
  (call $d3d_shader_vm_free (i32.load offset=280 (local.get $ctx))) (i32.store offset=280 (local.get $ctx) (i32.const 0))
  (i32.store offset=256 (local.get $ctx) (local.get $enabled)) (i32.store offset=260 (local.get $ctx) (local.get $color)) (i32.const 1))
(func $d3d_software_output (param $ctx i32) (param $src i32) (param $dest i32) (result i32)
  (local $s v128) (local $d v128) (local $k v128) (local $v v128) (local $packed i32)
  (local.set $s (f32x4.replace_lane 0 (local.get $s) (f32.load offset=0 (local.get $src))))
  (local.set $s (f32x4.replace_lane 1 (local.get $s) (f32.load offset=16 (local.get $src))))
  (local.set $s (f32x4.replace_lane 2 (local.get $s) (f32.load offset=32 (local.get $src))))
  (local.set $s (f32x4.replace_lane 3 (local.get $s) (f32.load offset=48 (local.get $src))))
  (if (i32.load offset=256 (local.get $ctx)) (then
    (local.set $k (f32x4.splat (f32.min (f32.const 1) (f32.max (f32.const 0)
      (f32.load (i32.add (i32.add (local.get $ctx) (i32.const 264))
        (i32.sub (local.get $src) (i32.add (i32.load offset=148 (local.get $ctx)) (i32.const 32)))))))))
    (local.set $v (f32x4.add (f32x4.mul (local.get $s) (local.get $k))
      (f32x4.mul (call $d3d_software_rgba (i32.load offset=260 (local.get $ctx))) (f32x4.sub (v128.const f32x4 1 1 1 1) (local.get $k)))))
    (local.set $s (f32x4.replace_lane 3 (local.get $v) (f32x4.extract_lane 3 (local.get $s))))))
  (local.set $v (local.get $s))
  (if (i32.and (i32.load offset=224 (local.get $ctx)) (i32.const 1)) (then
    (local.set $s (f32x4.min (v128.const f32x4 1 1 1 1) (f32x4.max (v128.const f32x4 0 0 0 0) (local.get $s))))
    (local.set $d (call $d3d_software_rgba (local.get $dest)))
    (local.set $k (call $d3d_software_rgba (i32.load offset=236 (local.get $ctx))))
    (local.set $v (call $d3d_software_blend_eval (i32.load offset=228 (local.get $ctx)) (local.get $s) (local.get $d) (local.get $k)))
    (if (i32.and (i32.load offset=224 (local.get $ctx)) (i32.const 2)) (then
      (local.set $v (f32x4.replace_lane 3 (local.get $v) (f32x4.extract_lane 3
        (call $d3d_software_blend_eval (i32.load offset=232 (local.get $ctx)) (local.get $s) (local.get $d) (local.get $k)))))))))
  (local.set $packed (i32.or (local.get $packed) (i32.shl (call $d3d_software_channel (f32x4.extract_lane 0 (local.get $v))) (i32.const 16))))
  (local.set $packed (i32.or (local.get $packed) (i32.shl (call $d3d_software_channel (f32x4.extract_lane 1 (local.get $v))) (i32.const 8))))
  (local.set $packed (i32.or (local.get $packed) (i32.shl (call $d3d_software_channel (f32x4.extract_lane 2 (local.get $v))) (i32.const 0))))
  (local.set $packed (i32.or (local.get $packed) (i32.shl (call $d3d_software_channel (f32x4.extract_lane 3 (local.get $v))) (i32.const 24))))
  (local.get $packed))
