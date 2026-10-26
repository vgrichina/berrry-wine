  ;; =========================================================================
  ;; GL software rasterization -- lower WAT-native GL draws onto the D3DIM
  ;; rasterizer, with no JS anywhere in the path.
  ;;
  ;; WHY THIS EXISTS, AND WHY IT IS NOT THE DSP1 PIPELINE.
  ;; docs/gl-software-path-design.md steps 3-5 route GL through the D3D9
  ;; software backend: assemble a DFX1, cascade it into a DSP1, hand that to
  ;; the shader VM.  Surveyed 2026-09-22 (write-up committed in that doc),
  ;; three of those pieces do not exist in WAT at all.  Nothing in WAT
  ;; consumes a DFX1 or a DLT1 -- $gl_dfx1_transform and $gl_dlt1_lighting are
  ;; test-only exports -- every descriptor the WAT rasterizer has ever seen was
  ;; assembled in JS by lib/d3d9-software-backend.js, and DSP1 wants raw BGRA
  ;; and f32 depth pointers that GL has no render target to supply.
  ;;
  ;; D3DIM already has all of that, driven straight from WAT with zero JS
  ;; crossings: $rasterize_triangle_textured samples a DxObject texture,
  ;; interpolates colour, Z and perspective-correct UVs, and does blending,
  ;; alpha test and depth test into a DxObject target; $d3d9_create_surface
  ;; hands those surfaces out.  A DxObject target is also what makes --png,
  ;; --dx-surfaces, --dx-slot and the browser present path see the frame, so
  ;; the "GL render target" the survey said did not exist is the surface
  ;; record D3DIM and D3D9 already share.  GL textures become ARGB8888
  ;; DxObject surfaces for the same reason.
  ;;
  ;; STATE.  The JS frontend keeps its own copy of GL state to answer the
  ;; guest's queries; this file keeps the part that decides pixels, fed by
  ;; $gl_sw_observe from the same encoder call site as the matrix mirror, so
  ;; the two cannot see different call streams.  glPushAttrib/glPopAttrib are
  ;; honoured per group for the fields kept here.
  ;;
  ;; CULLING FOLLOWS GL, NOT D3D.  GL_CULL_FACE is off by default; D3D's
  ;; default is D3DCULL_CCW, which 8b227b5c made this emulator honour.  So
  ;; this must NOT route through $d3dim_draw_tl_triangle_textured, whose
  ;; state comes from a D3D device's render-state block -- there is no D3D
  ;; device here.  It calls the rasterizer directly with GL's state.
  ;;
  ;; Primitives are clipped against the near and far planes; one wholly
  ;; outside either (or that a non-frustum projection leaves at w <= 0) is
  ;; dropped and counted in gl_sw_clipped. The side planes need no clip: the
  ;; rasterizer clips spans to the target and coordinates are saturated.
  ;;
  ;; Points and lines go through the same state, sampler, depth test and fog
  ;; as triangles, as spans handed straight to the D3DIM span writer: a point
  ;; is a glPointSize square, a line is walked along its major axis with its
  ;; last pixel left off and widened to glLineWidth across the minor one.
  ;; Antialiased (smooth) points and lines draw aliased.
  ;;
  ;; Texgen is GL_SPHERE_MAP on S and T together, the one mode the WebGL
  ;; backend draws; any other mode leaves the vertex's coordinates, as it
  ;; does there.
  ;;
  ;; NOT DONE YET, each one visible rather than silent: the second texture
  ;; unit, and texture formats other than 8-bit RGBA/RGB/BGRA/
  ;; LUMINANCE/ALPHA/LUMINANCE_ALPHA (counted in gl_sw_tex_unsupported; such
  ;; a texture samples as white).
  ;; =========================================================================

  (global $GL_SW_SCRATCH i32 (region.addr $GL_SW_SCRATCH 0))
  ;; Where this instance's scratch and state block live. The region is the
  ;; guest instance's; a D3D render Worker drawing queued GL records points
  ;; both at private memory of its own, because the region is shared memory
  ;; and the guest keeps using it while the Worker rasterizes.
  (global $gl_sw_scratch (mut i32) (region.addr $GL_SW_SCRATCH 0))
  (global $gl_sw_st (mut i32) (region.addr $GL_SW_STATE 0))
  (global $GL_SW_SCRATCH_SIZE i32 (region.size $GL_SW_SCRATCH))
  (global $GL_SW_STATE i32 (region.addr $GL_SW_STATE 0))
  (global $GL_SW_STATE_SIZE i32 (region.size $GL_SW_STATE))
  (global $GL_SW_TEXTURES i32 (region.addr $GL_SW_TEXTURES 0))
  (global $GL_SW_TEXTURES_SIZE i32 (region.size $GL_SW_TEXTURES))
  (global $GL_SW_MIPS i32 (region.addr $GL_SW_MIPS 0))
  (global $GL_SW_MIPS_SIZE i32 (region.size $GL_SW_MIPS))

  ;; Off unless a host asks for it: with a JS GL backend present, both paths
  ;; drawing at once is two pictures, not one.
  (global $gl_sw_enabled (mut i32) (i32.const 0))
  ;; DxObject entry addresses of the colour target and its 16bpp depth
  ;; surface, 0 until first use. Draws land in $gl_sw_rt, the back buffer;
  ;; SwapBuffers copies it to $gl_sw_front, the primary everything else
  ;; displays. Drawing into the displayed surface directly would let a capture
  ;; or a browser repaint show a frame half drawn -- Quake II's menu came out
  ;; with its plaque and two of five items missing exactly that way.
  (global $gl_sw_rt (mut i32) (i32.const 0))
  (global $gl_sw_front (mut i32) (i32.const 0))
  ;; 1 when the target's row 0 is the TOP scanline (every surface we allocate,
  ;; and a top-down DIB), 0 for a bottom-up DIB, whose row 0 is GL's bottom.
  (global $gl_sw_flip_y (mut i32) (i32.const 1))
  (global $gl_sw_bitmap (mut i32) (i32.const 0))
  (global $gl_sw_presents (mut i32) (i32.const 0))
  (global $gl_sw_zbuf (mut i32) (i32.const 0))
  ;; The COM objects (guest `this`) behind the surfaces this file allocated,
  ;; kept so a target outgrown by a later glViewport, or a depth buffer
  ;; replaced by a rebind, is released rather than leaked. 0 for a surface
  ;; this file did not allocate (a bound DIB describes the guest's own bits).
  (global $gl_sw_front_obj (mut i32) (i32.const 0))
  ;; The drawable's size, which GL makes the viewport when a context is first
  ;; made current. An app may rely on that and never call glViewport -- ptct
  ;; does -- so a draw with no viewport set maps through this instead of the
  ;; mirror's all-zero one, which collapses every triangle to nothing. The
  ;; host sets it from the window's client area; a bound DIB sets its own.
  (global $gl_sw_default_w (mut i32) (i32.const 640))
  (global $gl_sw_default_h (mut i32) (i32.const 480))
  ;; Set once the host has reported the window's client size: from then on
  ;; our own target is exactly that size, and follows it when the window
  ;; resizes (the host reports again after every present).
  (global $gl_sw_drawable_known (mut i32) (i32.const 0))
  ;; glActiveTextureARB's unit, and the name bound on the units above 0. Only
  ;; unit 0 is rasterized, so while another unit is active its TEXTURE_2D
  ;; enable, its env mode and its binding must not land in unit 0's state --
  ;; Warcraft III selects unit 1 and disables texturing there around nearly
  ;; every draw, which read as "texturing off" and drew its whole menu white.
  ;; Uploads still go to the texture that unit has bound: names are shared.
  (global $gl_sw_active_unit (mut i32) (i32.const 0))
  ;; GL fog (glFog*, GL_FOG = cap bit 64), GL's own defaults: EXP, density 1,
  ;; linear range [0,1], colour (0,0,0,0).
  (global $gl_sw_fog_mode (mut i32) (i32.const 0x0800))
  (global $gl_sw_fog_density (mut f32) (f32.const 1))
  (global $gl_sw_fog_start (mut f32) (f32.const 0))
  (global $gl_sw_fog_end (mut f32) (f32.const 1))
  (global $gl_sw_fog_color (mut i32) (i32.const 0))
  ;; Fog as the span rasterizer sees it: on/off, the colour, and the fog
  ;; factor as a screen-space plane f = a*x + b*y + c for the triangle being
  ;; drawn. GL allows the per-vertex factor to be interpolated without
  ;; perspective correction, so a plane is exact to what it asks for. Only
  ;; GL sets it, and only for the one rasterize call it makes; the D3D path
  ;; never turns it on.
  (global $rast_fog_on (mut i32) (i32.const 0))
  (global $rast_fog_color (mut i32) (i32.const 0))
  (global $rast_fog_a (mut f32) (f32.const 0))
  (global $rast_fog_b (mut f32) (f32.const 0))
  (global $rast_fog_c (mut f32) (f32.const 1))
  (global $gl_sw_other_bound (mut i32) (i32.const 0))
  ;; Texture unit 1 as the span rasterizer sees it, set by $gl_sw_t1_setup
  ;; for the one triangle it draws: the texture, D3DTOP (4 MODULATE, 2 the
  ;; texture), sampler, and u*q, v*q and q as screen-space planes so the span
  ;; divides back per pixel. Unit 1 is combined after unit 0 and before fog,
  ;; which is the order the WebGL frontend's fragment shader has.
  ;; Unit0 triangle texture Q/w, separate from position 1/w. Enabled only
  ;; around a GL triangle draw; D3D spans retain their supplied denominator.
  (global $rast_t0_q_on (mut i32) (i32.const 0))
  (global $rast_t0_qa (mut f32) (f32.const 0))
  (global $rast_t0_qb (mut f32) (f32.const 0))
  (global $rast_t0_qc (mut f32) (f32.const 1))
  (global $rast_t1_on (mut i32) (i32.const 0))
  (global $rast_t1_entry (mut i32) (i32.const 0))
  (global $rast_t1_op (mut i32) (i32.const 4))
  (global $rast_t1_addr_u (mut i32) (i32.const 1))
  (global $rast_t1_addr_v (mut i32) (i32.const 1))
  (global $rast_t1_linear (mut i32) (i32.const 0))
  (global $rast_t1_border (mut i32) (i32.const 0))
  (global $rast_t1_ua (mut f32) (f32.const 0))
  (global $rast_t1_ub (mut f32) (f32.const 0))
  (global $rast_t1_uc (mut f32) (f32.const 0))
  (global $rast_t1_va (mut f32) (f32.const 0))
  (global $rast_t1_vb (mut f32) (f32.const 0))
  (global $rast_t1_vc (mut f32) (f32.const 0))
  (global $rast_t1_qa (mut f32) (f32.const 0))
  (global $rast_t1_qb (mut f32) (f32.const 0))
  (global $rast_t1_qc (mut f32) (f32.const 1))
  ;; $rast_plane's result: f(x, y) = a*x + b*y + c.
  (global $rast_pa (mut f32) (f32.const 0))
  (global $rast_pb (mut f32) (f32.const 0))
  (global $rast_pc (mut f32) (f32.const 0))
  ;; Unit 1's texture matrix (stack 3) for this draw, 0 when identity.
  (global $gl_sw_texmtx1 (mut i32) (i32.const 0))
  (global $gl_sw_rt_obj (mut i32) (i32.const 0))
  (global $gl_sw_zbuf_obj (mut i32) (i32.const 0))
  ;; A 1x1 opaque white texture: an untextured triangle is drawn as this
  ;; texture MODULATEd by its vertex colours, which is exactly Gouraud colour
  ;; through the same depth, blend and alpha-test path as a textured one.
  (global $gl_sw_white (mut i32) (i32.const 0))
  ;; Census, so a test and --gl-census can tell "we drew nothing" from "we
  ;; were never asked to draw" from "we dropped it".
  (global $gl_sw_triangles (mut i32) (i32.const 0))
  (global $gl_sw_lines (mut i32) (i32.const 0))
  (global $gl_sw_points (mut i32) (i32.const 0))
  ;; glPointSize / glLineWidth, in pixels as GL passed them.
  (global $gl_sw_point_size (mut f32) (f32.const 1))
  (global $gl_sw_line_width (mut f32) (f32.const 1))
  ;; glTexGen modes for unit 0: S in the low half, T in the high half.
  ;; GL's default for both is EYE_LINEAR (0x2400).
  (global $gl_sw_texgen_modes (mut i32) (i32.const 0x24002400))
  ;; Set per draw: both S and T generate SPHERE_MAP.
  (global $gl_sw_sphere (mut i32) (i32.const 0))
  (global $gl_sw_clipped (mut i32) (i32.const 0))
  (global $gl_sw_culled (mut i32) (i32.const 0))
  (global $gl_sw_tex_uploads (mut i32) (i32.const 0))
  (global $gl_sw_tex_unsupported (mut i32) (i32.const 0))
  ;; GL's default clear colour is (0,0,0,0).
  (global $gl_sw_clear_color (mut i32) (i32.const 0))
  ;; glClearDepth's value as a 16-bit depth: GL's default 1.0 is 0xFFFF.
  (global $gl_sw_clear_depth_value (mut i32) (i32.const 0xFFFF))
  ;; glPushAttrib depth, 0..16. GL requires at least 16.
  (global $gl_sw_attrib_depth (mut i32) (i32.const 0))

  ;; $GL_SW_STATE: the current state block (+0..+63), then the attrib stack
  ;; at +64, sixteen 96-byte frames of { mask, copy of the block }.
  ;;   +0  caps: 1 TEXTURE_2D, 2 BLEND, 4 ALPHA_TEST, 8 DEPTH_TEST, 16 CULL_FACE,
  ;;       32 SCISSOR_TEST, 64 FOG, 128 LIGHTING, 0xFF00 LIGHT0..7,
  ;;       0x10000 COLOR_MATERIAL, 0x20000/0x40000 TEXTURE_GEN_S/_T,
  ;;       0x80000 TEXTURE_2D on unit 1, 0x100000 unit 1's env is REPLACE
  ;;       (both kept here so glPushAttrib saves them with the rest)
  ;;   +4  source blend (D3DBLEND)        +8  destination blend (D3DBLEND)
  ;;   +12 alpha func (D3DCMP)            +16 alpha reference, 0..255
  ;;   +20 depth func (D3DCMP)            +24 depth mask, 0/1
  ;;   +28 cull face (GL enum)            +32 front face is CCW, 0/1
  ;;   +36 texture env (D3DTOP: 4 MODULATE, 2 SELECTARG1 = texture)
  ;;   +40 bound TEXTURE_2D name          +44 unpack alignment
  ;;   +48 scissor box x, +52 y (GL, bottom-up), +56 w, +60 h; w < 0 means
  ;;       never set, which GL defines as the whole drawable
  (func $gl_sw_state_defaults
    (local $s i32)
    (local.set $s (global.get $gl_sw_st))
    (i32.store offset=0 (local.get $s) (i32.const 0))
    (i32.store offset=4 (local.get $s) (i32.const 2))       ;; GL_ONE
    (i32.store offset=8 (local.get $s) (i32.const 1))       ;; GL_ZERO
    (i32.store offset=12 (local.get $s) (i32.const 8))      ;; GL_ALWAYS
    (i32.store offset=16 (local.get $s) (i32.const 0))
    (i32.store offset=20 (local.get $s) (i32.const 2))      ;; GL_LESS
    (i32.store offset=24 (local.get $s) (i32.const 1))
    (i32.store offset=28 (local.get $s) (i32.const 0x405))  ;; GL_BACK
    (i32.store offset=32 (local.get $s) (i32.const 1))      ;; GL_CCW
    (i32.store offset=36 (local.get $s) (i32.const 4))      ;; GL_MODULATE
    (i32.store offset=40 (local.get $s) (i32.const 0))
    (i32.store offset=44 (local.get $s) (i32.const 4))
    (i32.store offset=48 (local.get $s) (i32.const 0))
    (i32.store offset=52 (local.get $s) (i32.const 0))
    (i32.store offset=56 (local.get $s) (i32.const -1))
    (i32.store offset=60 (local.get $s) (i32.const -1))
    (global.set $gl_sw_point_size (f32.const 1))
    (global.set $gl_sw_line_width (f32.const 1))
    (global.set $gl_sw_texgen_modes (i32.const 0x24002400))
    (global.set $gl_sw_attrib_depth (i32.const 0)))

  (func $gl_sw_cap_bit (param $cap i32) (result i32)
    (if (i32.eq (local.get $cap) (i32.const 0x0DE1)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $cap) (i32.const 0x0BE2)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $cap) (i32.const 0x0BC0)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $cap) (i32.const 0x0B71)) (then (return (i32.const 8))))
    (if (i32.eq (local.get $cap) (i32.const 0x0B44)) (then (return (i32.const 16))))
    (if (i32.eq (local.get $cap) (i32.const 0x0C11)) (then (return (i32.const 32))))
    (if (i32.eq (local.get $cap) (i32.const 0x0B60)) (then (return (i32.const 64))))
    (if (i32.eq (local.get $cap) (i32.const 0x0B50)) (then (return (i32.const 128))))
    ;; GL_LIGHT0..7 are bits 8..15, GL_COLOR_MATERIAL bit 16.
    (if (i32.lt_u (i32.sub (local.get $cap) (i32.const 0x4000)) (i32.const 8))
      (then (return (i32.shl (i32.const 256) (i32.sub (local.get $cap) (i32.const 0x4000))))))
    (if (i32.eq (local.get $cap) (i32.const 0x0B57)) (then (return (i32.const 0x10000))))
    ;; GL_TEXTURE_GEN_S / _T, bits 17 and 18.
    (if (i32.eq (local.get $cap) (i32.const 0x0C60)) (then (return (i32.const 0x20000))))
    (if (i32.eq (local.get $cap) (i32.const 0x0C61)) (then (return (i32.const 0x40000))))
    (i32.const 0))

  ;; GL comparison (0x200 NEVER .. 0x207 ALWAYS) to D3DCMP (1 .. 8).
  (func $gl_sw_cmp (param $gl i32) (result i32)
    (if (i32.gt_u (i32.sub (local.get $gl) (i32.const 0x200)) (i32.const 7))
      (then (return (i32.const 8))))
    (i32.sub (local.get $gl) (i32.const 0x1FF)))

  ;; GL blend factor to D3DBLEND: ZERO 1, ONE 2, then SRC_COLOR (0x300) ..
  ;; SRC_ALPHA_SATURATE (0x308) are 3 .. 11 in the same order.
  (func $gl_sw_blend (param $gl i32) (param $fallback i32) (result i32)
    (if (i32.eqz (local.get $gl)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $gl) (i32.const 1)) (then (return (i32.const 2))))
    (if (i32.le_u (i32.sub (local.get $gl) (i32.const 0x300)) (i32.const 8))
      (then (return (i32.add (i32.sub (local.get $gl) (i32.const 0x300)) (i32.const 3)))))
    (local.get $fallback))

  ;; glPushAttrib/glPopAttrib for the fields kept here, per attribute group.
  (func $gl_sw_push_attrib (param $mask i32)
    (local $frame i32)
    ;; Past GL's required depth the push is dropped; the matching pop is then
    ;; dropped too, by the depth test in $gl_sw_pop_attrib.
    (if (i32.ge_u (global.get $gl_sw_attrib_depth) (i32.const 16)) (then (return)))
    (local.set $frame (i32.add (global.get $gl_sw_st)
      (i32.add (i32.const 64) (i32.mul (global.get $gl_sw_attrib_depth) (i32.const 96)))))
    (i32.store (local.get $frame) (local.get $mask))
    (call $memcpy (i32.add (local.get $frame) (i32.const 4)) (global.get $gl_sw_st) (i32.const 64))
    ;; Point size and line width sit outside the 64-byte block, at +1600.
    (local.set $frame (call $gl_sw_attrib_sizes (global.get $gl_sw_attrib_depth)))
    (f32.store (local.get $frame) (global.get $gl_sw_point_size))
    (f32.store offset=4 (local.get $frame) (global.get $gl_sw_line_width))
    ;; Texgen modes, one word per level after the sizes (+1728).
    (i32.store (call $gl_sw_attrib_texgen (global.get $gl_sw_attrib_depth))
      (global.get $gl_sw_texgen_modes))
    (global.set $gl_sw_attrib_depth (i32.add (global.get $gl_sw_attrib_depth) (i32.const 1))))

  ;; Level $depth's saved point size (+0) and line width (+4).
  (func $gl_sw_attrib_sizes (param $depth i32) (result i32)
    (i32.add (global.get $gl_sw_st)
      (i32.add (i32.const 1600) (i32.shl (local.get $depth) (i32.const 3)))))

  ;; Level $depth's saved texgen modes, after the sizes: +1728 + 4 * depth,
  ;; which ends exactly at the region's 0x700.
  (func $gl_sw_attrib_texgen (param $depth i32) (result i32)
    (i32.add (global.get $gl_sw_st)
      (i32.add (i32.const 1728) (i32.shl (local.get $depth) (i32.const 2)))))

  ;; Restore one caps bit from a saved frame.
  (func $gl_sw_restore_caps (param $saved i32) (param $bits i32)
    (local $s i32)
    (local.set $s (global.get $gl_sw_st))
    (i32.store (local.get $s) (i32.or
      (i32.and (i32.load (local.get $s)) (i32.xor (local.get $bits) (i32.const -1)))
      (i32.and (i32.load (local.get $saved)) (local.get $bits)))))

  (func $gl_sw_pop_attrib
    (local $frame i32) (local $mask i32) (local $saved i32) (local $s i32)
    (if (i32.eqz (global.get $gl_sw_attrib_depth)) (then (return)))
    (global.set $gl_sw_attrib_depth (i32.sub (global.get $gl_sw_attrib_depth) (i32.const 1)))
    (local.set $frame (i32.add (global.get $gl_sw_st)
      (i32.add (i32.const 64) (i32.mul (global.get $gl_sw_attrib_depth) (i32.const 96)))))
    (local.set $mask (i32.load (local.get $frame)))
    (local.set $saved (i32.add (local.get $frame) (i32.const 4)))
    (local.set $s (global.get $gl_sw_st))
    ;; GL_POINT_BIT, GL_LINE_BIT.
    (if (i32.and (local.get $mask) (i32.const 0x2))
      (then (global.set $gl_sw_point_size (f32.load
        (call $gl_sw_attrib_sizes (global.get $gl_sw_attrib_depth))))))
    (if (i32.and (local.get $mask) (i32.const 0x4))
      (then (global.set $gl_sw_line_width (f32.load offset=4
        (call $gl_sw_attrib_sizes (global.get $gl_sw_attrib_depth))))))
    ;; GL_ENABLE_BIT: every enable this file tracks.
    (if (i32.and (local.get $mask) (i32.const 0x2000))
      (then (call $gl_sw_restore_caps (local.get $saved) (i32.const 0xFFFFF))))
    ;; GL_LIGHTING_BIT: the lighting, light and colour-material enables. The
    ;; light parameters themselves are the matrix mirror's (09a8f).
    (if (i32.and (local.get $mask) (i32.const 0x40))
      (then (call $gl_sw_restore_caps (local.get $saved) (i32.const 0x1FF80))))
    ;; GL_SCISSOR_BIT: the scissor enable and box.
    (if (i32.and (local.get $mask) (i32.const 0x80000))
      (then
        (call $gl_sw_restore_caps (local.get $saved) (i32.const 32))
        (call $memcpy (i32.add (local.get $s) (i32.const 48))
          (i32.add (local.get $saved) (i32.const 48)) (i32.const 16))))
    ;; GL_COLOR_BUFFER_BIT: blend and alpha-test enables, functions, reference.
    (if (i32.and (local.get $mask) (i32.const 0x4000))
      (then
        (call $gl_sw_restore_caps (local.get $saved) (i32.const 6))
        (call $memcpy (i32.add (local.get $s) (i32.const 4))
          (i32.add (local.get $saved) (i32.const 4)) (i32.const 16))))
    ;; GL_DEPTH_BUFFER_BIT: depth test enable, function and mask.
    (if (i32.and (local.get $mask) (i32.const 0x100))
      (then
        (call $gl_sw_restore_caps (local.get $saved) (i32.const 8))
        (call $memcpy (i32.add (local.get $s) (i32.const 20))
          (i32.add (local.get $saved) (i32.const 20)) (i32.const 8))))
    ;; GL_POLYGON_BIT: cull enable, cull face, front face.
    (if (i32.and (local.get $mask) (i32.const 0x8))
      (then
        (call $gl_sw_restore_caps (local.get $saved) (i32.const 16))
        (call $memcpy (i32.add (local.get $s) (i32.const 28))
          (i32.add (local.get $saved) (i32.const 28)) (i32.const 8))))
    ;; GL_TEXTURE_BIT: TEXTURE_2D enable, texture env, binding.
    (if (i32.and (local.get $mask) (i32.const 0x40000))
      (then
        (call $gl_sw_restore_caps (local.get $saved) (i32.const 0x1E0001))
        (global.set $gl_sw_texgen_modes (i32.load
          (call $gl_sw_attrib_texgen (global.get $gl_sw_attrib_depth))))
        (call $memcpy (i32.add (local.get $s) (i32.const 36))
          (i32.add (local.get $saved) (i32.const 36)) (i32.const 8)))))

  ;; ---- textures ---------------------------------------------------------
  ;; $GL_SW_TEXTURES: one 8-byte slot per texture name below 4096,
  ;;   +0 the surface's COM object (guest pointer), 0 = no image yet
  ;;   +4 flags: 1 linear (MAG_FILTER), 2 clamp S, 4 clamp T, 8 flags
  ;;      initialised, 16 opaque, 32 MIN_FILTER uses mipmaps, 64 MIN_FILTER
  ;;      samples linearly within a level, 128 GL_CLAMP S, 256 GL_CLAMP T
  ;; A name at or above 4096 has no slot and samples as white. Levels 1..12
  ;; live in $GL_SW_MIPS, 48 bytes per name.
  (func $gl_sw_tex_slot (param $name i32) (result i32)
    (if (i32.ge_u (local.get $name) (i32.const 4096)) (then (return (i32.const 0))))
    (i32.add (global.get $GL_SW_TEXTURES) (i32.mul (local.get $name) (i32.const 8))))

  ;; Keep the queried floating-point color, not its raster quantization.
  ;; Allocate only when an application sets a border. Defaults need no heap.
  (global $gl_sw_border_colors (mut i32) (i32.const 0))
  (global $gl_sw_border_set_failed (mut i32) (i32.const 0))
  (func $gl_sw_border_ptr (param $slot i32) (result i32)
    (if (i32.or (i32.eqz (local.get $slot)) (i32.eqz (global.get $gl_sw_border_colors)))
      (then (return (i32.const 0))))
    (i32.add (global.get $gl_sw_border_colors)
      (i32.shl (i32.sub (local.get $slot) (global.get $GL_SW_TEXTURES)) (i32.const 1))))

  ;; Returns failure to the caller on allocation failure; never pretend the
  ;; requested color was installed. $values is a validated Wasm RGBA pointer.
  (func $gl_sw_border_set (param $slot i32) (param $values i32) (result i32)
    (local $p i32) (local $g i32) (local $i i32) (local $v f32)
    (if (i32.eqz (local.get $slot)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $gl_sw_border_colors)) (then
      (local.set $g (call $gl_alloc_affine (i32.const 65536)))
      (if (i32.eqz (local.get $g)) (then (return (i32.const 0))))
      (global.set $gl_sw_border_colors (call $g2w (local.get $g)))
      (memory.fill (global.get $gl_sw_border_colors) (i32.const 0) (i32.const 65536))))
    (local.set $p (call $gl_sw_border_ptr (local.get $slot)))
    (loop $components
      (local.set $v (f32.load (i32.add (local.get $values) (local.get $i))))
      (if (f32.ne (local.get $v) (local.get $v)) (then (local.set $v (f32.const 0))))
      (f32.store (i32.add (local.get $p) (local.get $i))
        (f32.max (f32.const 0) (f32.min (f32.const 1) (local.get $v))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br_if $components (i32.lt_u (local.get $i) (i32.const 16))))
    (i32.const 1))

  (func $gl_sw_border_color (param $slot i32) (param $flags i32) (result i32)
    (local $p i32) (local $color i32)
    (local.set $p (call $gl_sw_border_ptr (local.get $slot)))
    (if (local.get $p) (then
      (local.set $color (call $gl_sw_color (i32.sub (local.get $p) (i32.const 12))))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 16)) (i32.const 0))
      (then (local.set $color (i32.or (local.get $color) (i32.const 0xFF000000)))))
    (local.get $color))

  (func $gl_sw_draw_border (param $slot i32) (param $unit i32) (param $flags i32) (result i32)
    (if (global.get $gl_sw_in_worker)
      (then (return (select (global.get $gl_sw_wk_border1) (global.get $gl_sw_wk_border0)
        (local.get $unit)))))
    (call $gl_sw_border_color (local.get $slot) (local.get $flags)))

  ;; Resolve one filter tap without ever forming an out-of-image address.
  ;; Wrap enums are GL enums, not D3D address modes. The caller supplies the
  ;; texture's format-adjusted border color as immutable draw state.
  (func $gl_sw_border_tap
    (param $tw i32) (param $th i32) (param $bpp i32) (param $pitch i32)
    (param $dib i32) (param $fmt i32) (param $pal i32) (param $pal_alpha i32)
    (param $x i32) (param $y i32) (param $ws i32) (param $wt i32)
    (param $border i32) (result i32)
    (if (i32.or
      (i32.and (i32.or (i32.eq (local.get $ws) (i32.const 0x2900))
                       (i32.eq (local.get $ws) (i32.const 0x812D)))
               (i32.ge_u (local.get $x) (local.get $tw)))
      (i32.and (i32.or (i32.eq (local.get $wt) (i32.const 0x2900))
                       (i32.eq (local.get $wt) (i32.const 0x812D)))
               (i32.ge_u (local.get $y) (local.get $th))))
      (then (return (local.get $border))))
    (call $d3dim_texture_fetch_prepared
      (local.get $bpp) (local.get $pitch) (local.get $dib) (local.get $fmt) (local.get $pal) (local.get $pal_alpha)
      (call $d3dim_address_texel (local.get $x) (local.get $tw)
        (select (i32.const 3) (select (i32.const 2) (i32.const 1)
          (i32.eq (local.get $ws) (i32.const 0x8370)))
          (i32.eq (local.get $ws) (i32.const 0x812F))))
      (call $d3dim_address_texel (local.get $y) (local.get $th)
        (select (i32.const 3) (select (i32.const 2) (i32.const 1)
          (i32.eq (local.get $wt) (i32.const 0x8370)))
          (i32.eq (local.get $wt) (i32.const 0x812F))))))

  ;; GL_CLAMP clamps the coordinate before filtering, while CLAMP_TO_BORDER
  ;; allows a footprint wholly outside the image. EDGE clamps each tap.
  ;; No mutable sampler globals: queued draws must pass their captured color.
  (func $gl_sw_border_sample
    (param $tw i32) (param $th i32) (param $bpp i32) (param $pitch i32)
    (param $dib i32) (param $fmt i32) (param $pal i32) (param $pal_alpha i32)
    (param $u f32) (param $v f32) (param $ws i32) (param $wt i32)
    (param $linear i32) (param $border i32) (result i32)
    (local $sx f32) (local $sy f32) (local $fx f32) (local $fy f32)
    (local $x i32) (local $y i32)
    (if (i32.or (i32.eqz (local.get $tw)) (i32.eqz (local.get $th)))
      (then (return (local.get $border))))
    (if (f32.ne (f32.mul (local.get $u) (f32.const 0)) (f32.const 0))
      (then (local.set $u (f32.const 0))))
    (if (f32.ne (f32.mul (local.get $v) (f32.const 0)) (f32.const 0))
      (then (local.set $v (f32.const 0))))
    (if (i32.eq (local.get $ws) (i32.const 0x2900))
      (then (local.set $u (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $u))))))
    (if (i32.eq (local.get $wt) (i32.const 0x2900))
      (then (local.set $v (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $v))))))
    ;; A full border footprint has the same color however far out it lies;
    ;; bounding it avoids saturated integer indices wrapping on the +1 tap.
    (if (i32.eq (local.get $ws) (i32.const 0x812D))
      (then (local.set $u (f32.min (f32.const 2) (f32.max (f32.const -1) (local.get $u))))))
    (if (i32.eq (local.get $wt) (i32.const 0x812D))
      (then (local.set $v (f32.min (f32.const 2) (f32.max (f32.const -1) (local.get $v))))))
    (if (i32.eqz (local.get $linear))
      (then
        ;; NEAREST GL_CLAMP selects the nearest edge texel, including u=1.
        (if (i32.eq (local.get $ws) (i32.const 0x2900))
          (then (local.set $ws (i32.const 0x812F))))
        (if (i32.eq (local.get $wt) (i32.const 0x2900))
          (then (local.set $wt (i32.const 0x812F))))
        (return (call $gl_sw_border_tap
          (local.get $tw) (local.get $th) (local.get $bpp) (local.get $pitch)
          (local.get $dib) (local.get $fmt) (local.get $pal) (local.get $pal_alpha)
          (i32.trunc_sat_f32_s (f32.floor (f32.mul (local.get $u) (f32.convert_i32_u (local.get $tw)))))
          (i32.trunc_sat_f32_s (f32.floor (f32.mul (local.get $v) (f32.convert_i32_u (local.get $th)))))
          (local.get $ws) (local.get $wt) (local.get $border)))))
    (local.set $sx (f32.sub (f32.mul (local.get $u) (f32.convert_i32_u (local.get $tw))) (f32.const 0.5)))
    (local.set $sy (f32.sub (f32.mul (local.get $v) (f32.convert_i32_u (local.get $th))) (f32.const 0.5)))
    (local.set $x (i32.trunc_sat_f32_s (f32.floor (local.get $sx))))
    (local.set $y (i32.trunc_sat_f32_s (f32.floor (local.get $sy))))
    (local.set $fx (f32.sub (local.get $sx) (f32.floor (local.get $sx))))
    (local.set $fy (f32.sub (local.get $sy) (f32.floor (local.get $sy))))
    (call $d3dim_bilerp
      (call $gl_sw_border_tap (local.get $tw) (local.get $th) (local.get $bpp) (local.get $pitch)
        (local.get $dib) (local.get $fmt) (local.get $pal) (local.get $pal_alpha) (local.get $x) (local.get $y)
        (local.get $ws) (local.get $wt) (local.get $border))
      (call $gl_sw_border_tap (local.get $tw) (local.get $th) (local.get $bpp) (local.get $pitch)
        (local.get $dib) (local.get $fmt) (local.get $pal) (local.get $pal_alpha) (i32.add (local.get $x) (i32.const 1)) (local.get $y)
        (local.get $ws) (local.get $wt) (local.get $border))
      (call $gl_sw_border_tap (local.get $tw) (local.get $th) (local.get $bpp) (local.get $pitch)
        (local.get $dib) (local.get $fmt) (local.get $pal) (local.get $pal_alpha) (local.get $x) (i32.add (local.get $y) (i32.const 1))
        (local.get $ws) (local.get $wt) (local.get $border))
      (call $gl_sw_border_tap (local.get $tw) (local.get $th) (local.get $bpp) (local.get $pitch)
        (local.get $dib) (local.get $fmt) (local.get $pal) (local.get $pal_alpha) (i32.add (local.get $x) (i32.const 1)) (i32.add (local.get $y) (i32.const 1))
        (local.get $ws) (local.get $wt) (local.get $border))
      (local.get $fx) (local.get $fy)))

  ;; The shared raster interface uses D3D address values except for the
  ;; explicit GL_CLAMP tag. Existing D3D modes retain their original sampler.
  (func $gl_sw_address_enum (param $mode i32) (result i32)
    (if (i32.eq (local.get $mode) (i32.const 0x2900)) (then (return (local.get $mode))))
    (if (i32.eq (local.get $mode) (i32.const 3)) (then (return (i32.const 0x812F))))
    (if (i32.eq (local.get $mode) (i32.const 2)) (then (return (i32.const 0x8370))))
    (i32.const 0x2901))

  (func $gl_sw_sample_prepared
    (param $tw i32) (param $th i32) (param $bpp i32) (param $pitch i32)
    (param $dib i32) (param $fmt i32) (param $pal i32) (param $pal_alpha i32)
    (param $u f32) (param $v f32) (param $au i32) (param $av i32)
    (param $linear i32) (param $border i32) (result i32)
    (if (i32.or (i32.eq (local.get $au) (i32.const 0x2900))
                 (i32.eq (local.get $av) (i32.const 0x2900)))
      (then (return (call $gl_sw_border_sample
        (local.get $tw) (local.get $th) (local.get $bpp) (local.get $pitch)
        (local.get $dib) (local.get $fmt) (local.get $pal) (local.get $pal_alpha) (local.get $u) (local.get $v)
        (call $gl_sw_address_enum (local.get $au)) (call $gl_sw_address_enum (local.get $av))
        (local.get $linear) (local.get $border)))))
    (call $d3dim_texture_sample_prepared
      (local.get $tw) (local.get $th) (local.get $bpp) (local.get $pitch)
      (local.get $dib) (local.get $fmt) (local.get $pal) (local.get $pal_alpha) (local.get $u) (local.get $v)
      (local.get $au) (local.get $av) (local.get $linear)))

  ;; GL's defaults are MAG_FILTER LINEAR, MIN_FILTER NEAREST_MIPMAP_LINEAR
  ;; and REPEAT in both directions.
  (func $gl_sw_tex_flags (param $slot i32) (result i32)
    (if (i32.eqz (i32.and (i32.load offset=4 (local.get $slot)) (i32.const 8)))
      (then (i32.store offset=4 (local.get $slot) (i32.const 41))))
    (i32.load offset=4 (local.get $slot)))

  ;; Address of level $level's object (1..12) for texture slot $slot.
  (func $gl_sw_mip_at (param $slot i32) (param $level i32) (result i32)
    (i32.add (global.get $GL_SW_MIPS)
      (i32.add
        (i32.mul (i32.shr_u (i32.sub (local.get $slot) (global.get $GL_SW_TEXTURES)) (i32.const 3))
                 (i32.const 48))
        (i32.shl (i32.sub (local.get $level) (i32.const 1)) (i32.const 2)))))

  ;; Every level above 0 of $slot, released.
  (func $gl_sw_mips_release (param $slot i32)
    (local $level i32) (local $p i32)
    (local.set $level (i32.const 1))
    (loop $lp
      (local.set $p (call $gl_sw_mip_at (local.get $slot) (local.get $level)))
      (if (i32.load (local.get $p))
        (then
          (drop (call $dx_surface_release (i32.load (local.get $p))))
          (i32.store (local.get $p) (i32.const 0))))
      (local.set $level (i32.add (local.get $level) (i32.const 1)))
      (br_if $lp (i32.le_u (local.get $level) (i32.const 12)))))

  ;; glTexParameter for TEXTURE_2D: MAG_FILTER picks linear sampling for a
  ;; magnified face, MIN_FILTER whether a minified one steps down the mip
  ;; chain and how it samples there. WRAP_S/WRAP_T preserve GL_CLAMP's border
  ;; taps separately from CLAMP_TO_EDGE.
  (func $gl_sw_tex_param (param $pname i32) (param $value i32)
    (local $slot i32) (local $flags i32) (local $bit i32) (local $border_bit i32)
    ;; The host reports INVALID_ENUM. The software mirror must leave the old
    ;; state unchanged on the same invalid calls instead of selecting NEAREST.
    (if (i32.eq (local.get $pname) (i32.const 0x2800)) (then
      (if (i32.and (i32.ne (local.get $value) (i32.const 0x2600))
                   (i32.ne (local.get $value) (i32.const 0x2601))) (then (return)))))
    (if (i32.eq (local.get $pname) (i32.const 0x2801)) (then
      (if (i32.and
        (i32.and (i32.ne (local.get $value) (i32.const 0x2600))
                 (i32.ne (local.get $value) (i32.const 0x2601)))
        (i32.or (i32.lt_u (local.get $value) (i32.const 0x2700))
                (i32.gt_u (local.get $value) (i32.const 0x2703)))) (then (return)))))
    (if (i32.or (i32.eq (local.get $pname) (i32.const 0x2802))
               (i32.eq (local.get $pname) (i32.const 0x2803))) (then
      (if (i32.and
        (i32.and (i32.ne (local.get $value) (i32.const 0x2900))
                 (i32.ne (local.get $value) (i32.const 0x2901)))
        (i32.and (i32.ne (local.get $value) (i32.const 0x812F))
                 (i32.ne (local.get $value) (i32.const 0x8370)))) (then (return)))))
    (local.set $slot (call $gl_sw_tex_slot (i32.load offset=40 (global.get $gl_sw_st))))
    (if (i32.eqz (local.get $slot)) (then (return)))
    (local.set $flags (call $gl_sw_tex_flags (local.get $slot)))
    (if (i32.eq (local.get $pname) (i32.const 0x2800))
      (then
        (local.set $flags (i32.and (local.get $flags) (i32.const -2)))
        (if (i32.eq (local.get $value) (i32.const 0x2601))
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 1)))))))
    ;; NEAREST 0x2600, LINEAR 0x2601, then the four *_MIPMAP_* at 0x2700..3:
    ;; bit 0 of the low byte is the within-level filter.
    (if (i32.eq (local.get $pname) (i32.const 0x2801))
      (then
        (local.set $flags (i32.and (local.get $flags) (i32.const -97)))
        (if (i32.le_u (i32.sub (local.get $value) (i32.const 0x2700)) (i32.const 3))
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 32)))))
        (if (i32.and (i32.or
                       (i32.le_u (i32.sub (local.get $value) (i32.const 0x2700)) (i32.const 3))
                       (i32.le_u (i32.sub (local.get $value) (i32.const 0x2600)) (i32.const 1)))
                     (i32.and (local.get $value) (i32.const 1)))
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 64)))))))
    (if (i32.or (i32.eq (local.get $pname) (i32.const 0x2802))
                (i32.eq (local.get $pname) (i32.const 0x2803)))
      (then
        (local.set $bit (select (i32.const 2) (i32.const 4)
          (i32.eq (local.get $pname) (i32.const 0x2802))))
        (local.set $border_bit (i32.shl (local.get $bit) (i32.const 6)))
        (local.set $flags (i32.and (local.get $flags)
          (i32.xor (i32.or (local.get $bit) (local.get $border_bit)) (i32.const -1))))
        (if (i32.eq (local.get $value) (i32.const 0x2900))
          (then (local.set $flags (i32.or (local.get $flags) (local.get $border_bit)))))
        (if (i32.or (i32.eq (local.get $value) (i32.const 0x2900))
                    (i32.eq (local.get $value) (i32.const 0x812F)))
          (then (local.set $flags (i32.or (local.get $flags) (local.get $bit)))))))
    (i32.store offset=4 (local.get $slot) (local.get $flags)))

  ;; Bytes per pixel of an 8-bit client format, 0 for one not converted.
  (func $gl_sw_format_bytes (param $format i32) (result i32)
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x1908))       ;; RGBA
                (i32.eq (local.get $format) (i32.const 0x80E1)))      ;; BGRA_EXT
      (then (return (i32.const 4))))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x1907))       ;; RGB
                (i32.eq (local.get $format) (i32.const 0x80E0)))      ;; BGR_EXT
      (then (return (i32.const 3))))
    (if (i32.eq (local.get $format) (i32.const 0x190A)) (then (return (i32.const 2))))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x1909))       ;; LUMINANCE
                (i32.eq (local.get $format) (i32.const 0x1906)))      ;; ALPHA
      (then (return (i32.const 1))))
    (i32.const 0))

  ;; One client pixel as 0xAARRGGBB.
  (func $gl_sw_texel (param $p i32) (param $format i32) (result i32)
    (local $a i32) (local $r i32) (local $g i32) (local $b i32)
    (local.set $a (i32.const 255))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x1908))
                (i32.eq (local.get $format) (i32.const 0x1907)))
      (then
        (local.set $r (i32.load8_u (local.get $p)))
        (local.set $g (i32.load8_u offset=1 (local.get $p)))
        (local.set $b (i32.load8_u offset=2 (local.get $p)))
        (if (i32.eq (local.get $format) (i32.const 0x1908))
          (then (local.set $a (i32.load8_u offset=3 (local.get $p)))))))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x80E1))
                (i32.eq (local.get $format) (i32.const 0x80E0)))
      (then
        (local.set $b (i32.load8_u (local.get $p)))
        (local.set $g (i32.load8_u offset=1 (local.get $p)))
        (local.set $r (i32.load8_u offset=2 (local.get $p)))
        (if (i32.eq (local.get $format) (i32.const 0x80E1))
          (then (local.set $a (i32.load8_u offset=3 (local.get $p)))))))
    (if (i32.eq (local.get $format) (i32.const 0x1909))
      (then
        (local.set $r (i32.load8_u (local.get $p)))
        (local.set $g (local.get $r)) (local.set $b (local.get $r))))
    (if (i32.eq (local.get $format) (i32.const 0x190A))
      (then
        (local.set $r (i32.load8_u (local.get $p)))
        (local.set $g (local.get $r)) (local.set $b (local.get $r))
        (local.set $a (i32.load8_u offset=1 (local.get $p)))))
    ;; GL_ALPHA reads as (0,0,0,A) in GL 1.x's texture environment table.
    (if (i32.eq (local.get $format) (i32.const 0x1906))
      (then (local.set $a (i32.load8_u (local.get $p)))))
    (i32.or (i32.or (i32.shl (local.get $a) (i32.const 24)) (i32.shl (local.get $r) (i32.const 16)))
            (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b))))

  ;; An internal format with no alpha channel keeps whatever alpha the client
  ;; data carried out of the result: 3, GL_RGB and the sized RGB4..RGB16.
  (func $gl_sw_internal_opaque (param $internal i32) (result i32)
    (i32.or
      (i32.or (i32.eq (local.get $internal) (i32.const 3))
              (i32.eq (local.get $internal) (i32.const 0x1907)))
      (i32.le_u (i32.sub (local.get $internal) (i32.const 0x804F)) (i32.const 5))))

  ;; Convert a w x h rectangle of client pixels at guest $pixels into the
  ;; texture surface $entry at (x, y). Rows are $gl_sw unpack-aligned. Each
  ;; row is gathered through $guest_span_in because a texture is routinely
  ;; larger than one guest page and adjacent sparse pages need not be
  ;; adjacent in WASM memory.
  (func $gl_sw_tex_store (param $entry i32) (param $x i32) (param $y i32)
      (param $w i32) (param $h i32) (param $format i32) (param $pixels i32)
      (param $opaque i32)
    (call $gl_sw_tex_store_to (load.field DxObject misc1 (local.get $entry))
      (load.field DxObject pitch (local.get $entry))
      (load.field DxObject width (local.get $entry))
      (load.field DxObject height (local.get $entry))
      (local.get $x) (local.get $y) (local.get $w) (local.get $h)
      (local.get $format) (local.get $pixels) (local.get $opaque)))

  ;; The conversion itself, into any ARGB block: texel (x+col, y+row) lands
  ;; at $dib + (y+row)*$pitch + (x+col)*4 when it is inside $tw x $th.
  (func $gl_sw_tex_store_to (param $dib i32) (param $pitch i32) (param $tw i32) (param $th i32)
      (param $x i32) (param $y i32)
      (param $w i32) (param $h i32) (param $format i32) (param $pixels i32)
      (param $opaque i32)
    (local $bpp i32) (local $align i32) (local $stride i32) (local $len i32)
    (local $src i32) (local $row i32) (local $col i32)
    (local $dst i32) (local $px i32)
    (local.set $bpp (call $gl_sw_format_bytes (local.get $format)))
    (local.set $align (i32.load offset=44 (global.get $gl_sw_st)))
    (if (i32.eqz (local.get $align)) (then (local.set $align (i32.const 4))))
    (local.set $stride (i32.and
      (i32.add (i32.mul (local.get $w) (local.get $bpp)) (i32.sub (local.get $align) (i32.const 1)))
      (i32.sub (i32.const 0) (local.get $align))))
    (local.set $len (i32.mul (local.get $stride) (local.get $h)))
    (if (i32.or (i32.eqz (local.get $len)) (i32.eqz (local.get $pixels))) (then (return)))
    ;; One row at a time: a whole level need not be linear in wasm memory,
    ;; and at 32KB+ it does not fit the span scratch that would gather it
    ;; (Warcraft III's first 128x64 RGBA upload trapped there). A row of the
    ;; largest texture we accept is at most 4096 texels.
    (local.set $row (i32.const 0))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_s (local.get $row) (local.get $h)))
      (local.set $src (call $guest_span_in
        (i32.add (local.get $pixels) (i32.mul (local.get $row) (local.get $stride)))
        (local.get $stride)))
      (local.set $col (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_s (local.get $col) (local.get $w)))
        (if (i32.and
              (i32.lt_u (i32.add (local.get $x) (local.get $col)) (local.get $tw))
              (i32.lt_u (i32.add (local.get $y) (local.get $row)) (local.get $th)))
          (then
            (local.set $px (call $gl_sw_texel
              (i32.add (local.get $src) (i32.mul (local.get $col) (local.get $bpp)))
              (local.get $format)))
            (if (local.get $opaque)
              (then (local.set $px (i32.or (local.get $px) (i32.const 0xFF000000)))))
            (local.set $dst (i32.add (local.get $dib)
              (i32.add (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $pitch))
                       (i32.shl (i32.add (local.get $x) (local.get $col)) (i32.const 2)))))
            (i32.store (local.get $dst) (local.get $px))))
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br $cols)))
      (call $guest_span_release (local.get $src) (local.get $stride))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rows))))

  (func $gl_sw_tex_release (param $slot i32)
    (local $obj i32)
    (local.set $obj (i32.load (local.get $slot)))
    (if (i32.eqz (local.get $obj)) (then (return)))
    (i32.store (local.get $slot) (i32.const 0))
    (drop (call $dx_surface_release (local.get $obj))))

  ;; glTexImage2D / gluBuild2DMipmaps into the bound name. Level 0 lives in
  ;; the slot, levels 1..12 in $GL_SW_MIPS; each is its own ARGB surface.
  (func $gl_sw_tex_image (param $level i32) (param $internal i32)
      (param $w i32) (param $h i32) (param $format i32) (param $type i32)
      (param $pixels i32)
    (local $slot i32) (local $obj i32) (local $entry i32) (local $opaque i32)
    (local $at i32)
    (if (i32.gt_u (local.get $level) (i32.const 12)) (then (return)))
    (local.set $slot (call $gl_sw_tex_slot (i32.load offset=40 (global.get $gl_sw_st))))
    (if (i32.eqz (local.get $slot)) (then (return)))
    (drop (call $gl_sw_tex_flags (local.get $slot)))
    (local.set $at (local.get $slot))
    (if (local.get $level)
      (then (local.set $at (call $gl_sw_mip_at (local.get $slot) (local.get $level)))))
    (call $gl_sw_tex_release (local.get $at))
    (if (i32.or (i32.ne (local.get $type) (i32.const 0x1401))           ;; UNSIGNED_BYTE
                (i32.eqz (call $gl_sw_format_bytes (local.get $format))))
      (then
        (global.set $gl_sw_tex_unsupported
          (i32.add (global.get $gl_sw_tex_unsupported) (i32.const 1)))
        (return)))
    (if (i32.or (i32.lt_s (local.get $w) (i32.const 1)) (i32.lt_s (local.get $h) (i32.const 1)))
      (then (return)))
    (if (i32.or (i32.gt_s (local.get $w) (i32.const 4096)) (i32.gt_s (local.get $h) (i32.const 4096)))
      (then (return)))
    (local.set $obj (call $d3d9_create_surface (local.get $w) (local.get $h)
      (i32.const 32) (i32.const 4)))
    (if (i32.eqz (local.get $obj)) (then (return)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (call $dx_surf_fmt_set (local.get $entry) (i32.const 5))       ;; ARGB8888
    (i32.store (local.get $at) (local.get $obj))
    (local.set $opaque (call $gl_sw_internal_opaque (local.get $internal)))
    ;; The opaque decision is re-derived at sub-image time from this bit;
    ;; level 0's internal format is the texture's.
    (if (i32.eqz (local.get $level))
      (then (i32.store offset=4 (local.get $slot) (i32.or
        (i32.and (i32.load offset=4 (local.get $slot)) (i32.const -17))
        (i32.shl (local.get $opaque) (i32.const 4))))))
    (call $gl_sw_tex_store (local.get $entry) (i32.const 0) (i32.const 0)
      (local.get $w) (local.get $h) (local.get $format) (local.get $pixels)
      (local.get $opaque))
    (global.set $gl_sw_tex_uploads (i32.add (global.get $gl_sw_tex_uploads) (i32.const 1))))

  (func $gl_sw_tex_sub_image (param $level i32) (param $x i32) (param $y i32)
      (param $w i32) (param $h i32) (param $format i32) (param $type i32)
      (param $pixels i32)
    (local $slot i32) (local $obj i32)
    (if (i32.gt_u (local.get $level) (i32.const 12)) (then (return)))
    (local.set $slot (call $gl_sw_tex_slot (i32.load offset=40 (global.get $gl_sw_st))))
    (if (i32.eqz (local.get $slot)) (then (return)))
    (local.set $obj (i32.load (select (call $gl_sw_mip_at (local.get $slot) (local.get $level))
      (local.get $slot) (local.get $level))))
    (if (i32.eqz (local.get $obj)) (then (return)))
    (if (i32.or (i32.ne (local.get $type) (i32.const 0x1401))
                (i32.eqz (call $gl_sw_format_bytes (local.get $format))))
      (then
        (global.set $gl_sw_tex_unsupported
          (i32.add (global.get $gl_sw_tex_unsupported) (i32.const 1)))
        (return)))
    (if (i32.or (i32.lt_s (local.get $x) (i32.const 0)) (i32.lt_s (local.get $y) (i32.const 0)))
      (then (return)))
    (if (call $gl_sw_worker_tex (call $dx_from_this (local.get $obj))
          (local.get $x) (local.get $y) (local.get $w) (local.get $h)
          (local.get $format) (local.get $pixels)
          (i32.ne (i32.and (i32.load offset=4 (local.get $slot)) (i32.const 16)) (i32.const 0)))
      (then (return)))
    (call $d3dim_worker_fence)
    (call $gl_sw_tex_store (call $dx_from_this (local.get $obj))
      (local.get $x) (local.get $y) (local.get $w) (local.get $h)
      (local.get $format) (local.get $pixels)
      (i32.ne (i32.and (i32.load offset=4 (local.get $slot)) (i32.const 16)) (i32.const 0))))

  (func $gl_sw_delete_textures (param $n i32) (param $names i32)
    (local $i i32) (local $slot i32)
    (if (i32.or (i32.le_s (local.get $n) (i32.const 0)) (i32.eqz (local.get $names)))
      (then (return)))
    (block $done (loop $lp
      (br_if $done (i32.ge_s (local.get $i) (local.get $n)))
      (local.set $slot (call $gl_sw_tex_slot
        (call $gl32 (i32.add (local.get $names) (i32.shl (local.get $i) (i32.const 2))))))
      (if (local.get $slot)
        (then
          (call $gl_sw_tex_release (local.get $slot))
          (call $gl_sw_mips_release (local.get $slot))
          (if (call $gl_sw_border_ptr (local.get $slot))
            (then (memory.fill (call $gl_sw_border_ptr (local.get $slot)) (i32.const 0) (i32.const 16))))
          (i32.store offset=4 (local.get $slot) (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; ---- small helpers ------------------------------------------------------
  ;; Scratch: +0 the MVP, +64 one object-space vec4, +128 three screen
  ;; records, +256 three clip records, +512 up to four near-clipped ones,
  ;; +0x300 the default viewport $gl_sw_consume substitutes when none is
  ;; set, +0x680 up to five far-clipped records (ends at 0x7AC, inside 0x800).
  ;; Clip record, 60 bytes: +0 x, +4 y, +8 z, +12 w, +16 u, +20 v, then
  ;; r, g, b, a at +24..+36, unit 1's u, v at +40, +44, q0/q1 at +48/+52
  ;; and the eye-space fog distance at +56 -- all f32, so clipping lerps
  ;; fifteen floats alike.
  (func $gl_sw_clip_at (param $k i32) (result i32)
    (i32.add (global.get $gl_sw_scratch)
      (i32.add (i32.const 256) (i32.mul (local.get $k) (i32.const 60)))))
  (func $gl_sw_poly_at (param $k i32) (result i32)
    (i32.add (global.get $gl_sw_scratch)
      (i32.add (i32.const 512) (i32.mul (local.get $k) (i32.const 60)))))
  ;; Signed distance to GL's near clip plane, z >= -w.
  (func $gl_sw_near_d (param $c i32) (result f32)
    (f32.add (f32.load offset=8 (local.get $c)) (f32.load offset=12 (local.get $c))))
  ;; Signed distance to the near plane, or with $far to the far one (z <= w).
  ;; Without the far clip a sky dome past the far plane drew as z > 1 --
  ;; Warcraft III's menu sky came out white where WebGL discards it.
  (func $gl_sw_plane_d (param $c i32) (param $far i32) (result f32)
    (if (result f32) (local.get $far)
      (then (f32.sub (f32.load offset=12 (local.get $c)) (f32.load offset=8 (local.get $c))))
      (else (call $gl_sw_near_d (local.get $c)))))
  ;; $dst = $a + ($b - $a) * $t over a whole clip record. Clip space is
  ;; linear, so this is exact for position and perspective-correct for
  ;; everything else once the rasterizer divides by w.
  (func $gl_sw_lerp_into (param $dst i32) (param $a i32) (param $b i32) (param $t f32)
    (local $i i32) (local $x f32)
    (loop $lp
      (local.set $x (f32.load (i32.add (local.get $a) (local.get $i))))
      (f32.store (i32.add (local.get $dst) (local.get $i))
        (f32.add (local.get $x)
          (f32.mul (f32.sub (f32.load (i32.add (local.get $b) (local.get $i))) (local.get $x))
                   (local.get $t))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br_if $lp (i32.lt_u (local.get $i) (i32.const 60)))))
  ;; Per-vertex screen record, 32 bytes: +0 x, +4 y (i32), +8 z, +12 rhw,
  ;; +16 u, +20 v (f32), +24 colour (0xAARRGGBB).
  (func $gl_sw_screen_at (param $k i32) (result i32)
    (i32.add (global.get $gl_sw_scratch)
      (i32.add (i32.const 128) (i32.mul (local.get $k) (i32.const 32)))))

  ;; A GL colour component (f32, nominally 0..1) as a byte.
  (func $gl_sw_u8 (param $f f32) (result i32)
    (if (f32.ne (local.get $f) (local.get $f)) (then (return (i32.const 0))))
    (if (f32.le (local.get $f) (f32.const 0)) (then (return (i32.const 0))))
    (if (f32.ge (local.get $f) (f32.const 1)) (then (return (i32.const 255))))
    ;; trunc_sat and not trunc: a guest float reaches this, and a plain
    ;; i32.trunc_f32_s traps the whole module on a value the guards above
    ;; have not already excluded.
    (i32.trunc_sat_f32_s (f32.add (f32.mul (local.get $f) (f32.const 255)) (f32.const 0.5))))

  ;; The 60-byte GL vertex at $v carries r,g,b,a as f32 at +12..+24. The
  ;; rasterizer wants one D3DCOLOR.
  (func $gl_sw_color (param $v i32) (result i32)
    (i32.or
      (i32.or
        (i32.shl (call $gl_sw_u8 (f32.load offset=24 (local.get $v))) (i32.const 24))
        (i32.shl (call $gl_sw_u8 (f32.load offset=12 (local.get $v))) (i32.const 16)))
      (i32.or
        (i32.shl (call $gl_sw_u8 (f32.load offset=16 (local.get $v))) (i32.const 8))
        (call $gl_sw_u8 (f32.load offset=20 (local.get $v))))))

  ;; A screen coordinate, saturated into a range the span walker can loop
  ;; over. The rasterizer clips each span, but it still iterates y from the
  ;; top vertex to the bottom one, so an unbounded coordinate is a hang
  ;; rather than a wrong pixel.
  (func $gl_sw_coord (param $f f32) (result i32)
    (if (f32.ne (local.get $f) (local.get $f)) (then (return (i32.const 0))))
    (if (f32.le (local.get $f) (f32.const -16384)) (then (return (i32.const -16384))))
    (if (f32.ge (local.get $f) (f32.const 16384)) (then (return (i32.const 16384))))
    (i32.trunc_sat_f32_s (f32.floor (f32.add (local.get $f) (f32.const 0.5)))))

  ;; Perspective divide, viewport map and depth-range map for one clip-space
  ;; vertex, written into its screen record.
  (func $gl_sw_project (param $clip i32) (param $vp i32) (param $out i32)
    (local $w f32) (local $rhw f32) (local $n f32) (local $f f32) (local $b i32) (local $row i32)
    (local.set $w (f32.load offset=12 (local.get $clip)))
    (local.set $rhw (f32.div (f32.const 1) (local.get $w)))
    (i32.store (local.get $out) (i32.add (i32.load (local.get $vp))
      (call $gl_sw_coord (f32.mul
        (f32.mul (f32.add (f32.mul (f32.load (local.get $clip)) (local.get $rhw))
                          (f32.const 1))
                 (f32.const 0.5))
        (f32.convert_i32_s (i32.load offset=8 (local.get $vp)))))))
    ;; GL's window origin is bottom-left and a surface's row 0 is its top, so
    ;; y is flipped here and nowhere else -- except into a bottom-up DIB,
    ;; whose row 0 already is GL's bottom. glViewport's y is bottom-up too.
    (local.set $row (i32.add (i32.load offset=4 (local.get $vp))
      (call $gl_sw_coord (f32.mul
        (f32.mul (f32.add (f32.mul (f32.load offset=4 (local.get $clip)) (local.get $rhw))
                          (f32.const 1))
                 (f32.const 0.5))
        (f32.convert_i32_s (i32.load offset=12 (local.get $vp)))))))
    (i32.store offset=4 (local.get $out)
      (select
        (i32.sub (load.field DxObject height (global.get $gl_sw_rt)) (local.get $row))
        (local.get $row)
        (global.get $gl_sw_flip_y)))
    ;; glDepthRange, which the mirror keeps beside the viewport. A block never
    ;; given one reads (0,0); that is legal GL but also exactly what "never
    ;; set" looks like, and far more often the latter, so it reads as (0,1).
    (local.set $b (call $gl_mtx_block))
    (local.set $n (f32.load offset=9024 (local.get $b)))
    (local.set $f (f32.load offset=9028 (local.get $b)))
    (if (i32.and (f32.eq (local.get $n) (f32.const 0)) (f32.eq (local.get $f) (f32.const 0)))
      (then (local.set $f (f32.const 1))))
    (f32.store offset=8 (local.get $out)
      (f32.add (local.get $n) (f32.mul (f32.sub (local.get $f) (local.get $n))
        (f32.mul (f32.add (f32.mul (f32.load offset=8 (local.get $clip)) (local.get $rhw))
                          (f32.const 1))
                 (f32.const 0.5)))))
    (f32.store offset=12 (local.get $out) (local.get $rhw)))

  ;; ---- surfaces -----------------------------------------------------------
  ;; The surface GL software draws land on, created on first use at the
  ;; viewport's size, with its depth surface. Flags 1 marks it primary
  ;; because a GL app has no other primary -- that is what makes a --png
  ;; capture and the browser present path find it without being told a slot.
  (func $gl_sw_target (result i32)
    (local $vp i32) (local $w i32) (local $h i32) (local $obj i32) (local $px i32)
    (local $cw i32) (local $ch i32)
    (local.set $vp (call $gl_mtx_export_viewport_ptr))
    (local.set $w (i32.add (i32.load (local.get $vp)) (i32.load offset=8 (local.get $vp))))
    (local.set $h (i32.add (i32.load offset=4 (local.get $vp)) (i32.load offset=12 (local.get $vp))))
    (if (global.get $gl_sw_rt)
      (then
        ;; A bound DIB is the size it is; only our own target can grow.
        (if (i32.eqz (global.get $gl_sw_rt_obj)) (then (return (global.get $gl_sw_rt))))
        (local.set $cw (load.field DxObject width (global.get $gl_sw_rt)))
        (local.set $ch (load.field DxObject height (global.get $gl_sw_rt)))
        (if (global.get $gl_sw_drawable_known)
          (then
            ;; The host told us the drawable: the target IS it, exactly as a
            ;; WebGL canvas is the window's client area. A viewport bigger
            ;; than it is clipped, not honoured -- Warcraft III sets 800x600
            ;; once on a 640x480 client before settling on 640x480, and
            ;; growing for it left the menu in one corner of a black frame.
            (if (i32.and (i32.eq (global.get $gl_sw_default_w) (local.get $cw))
                         (i32.eq (global.get $gl_sw_default_h) (local.get $ch)))
              (then (return (global.get $gl_sw_rt))))
            (local.set $w (global.get $gl_sw_default_w))
            (local.set $h (global.get $gl_sw_default_h)))
          (else
            ;; No host (a unit test driving the exports): the target is sized
            ;; from the viewport, and that need not be the final one --
            ;; Half-Life draws its loading plaque under a 320x240 viewport
            ;; before the 640x480 one it plays in. Grow, never shrink (a small
            ;; viewport is as often a sub-view as a mode), start clean.
            (if (i32.or (i32.or (i32.lt_s (local.get $w) (i32.const 1))
                                (i32.gt_s (local.get $w) (i32.const 4096)))
                        (i32.or (i32.lt_s (local.get $h) (i32.const 1))
                                (i32.gt_s (local.get $h) (i32.const 4096))))
              (then (return (global.get $gl_sw_rt))))
            (if (i32.and (i32.le_s (local.get $w) (local.get $cw))
                         (i32.le_s (local.get $h) (local.get $ch)))
              (then (return (global.get $gl_sw_rt))))
            (if (i32.lt_s (local.get $w) (local.get $cw)) (then (local.set $w (local.get $cw))))
            (if (i32.lt_s (local.get $h) (local.get $ch)) (then (local.set $h (local.get $ch))))))
        (call $d3dim_worker_fence)
        (call $gl_sw_drop_surface (global.get $gl_sw_front_obj))
        (call $gl_sw_drop_surface (global.get $gl_sw_rt_obj))
        (global.set $gl_sw_front_obj (i32.const 0))
        (global.set $gl_sw_rt_obj (i32.const 0))
        (global.set $gl_sw_front (i32.const 0))
        (global.set $gl_sw_rt (i32.const 0))))
    (if (global.get $gl_sw_drawable_known)
      (then
        (local.set $w (global.get $gl_sw_default_w))
        (local.set $h (global.get $gl_sw_default_h))))
    ;; A context given no glViewport yet reports all zeroes; fall back to the
    ;; drawable's size, which is GL's own default viewport, and refuse the
    ;; absurd rather than allocate it.
    (if (i32.or (i32.lt_s (local.get $w) (i32.const 1))
                (i32.gt_s (local.get $w) (i32.const 4096)))
      (then (local.set $w (global.get $gl_sw_default_w))))
    (if (i32.or (i32.lt_s (local.get $h) (i32.const 1))
                (i32.gt_s (local.get $h) (i32.const 4096)))
      (then (local.set $h (global.get $gl_sw_default_h))))
    ;; Front first: it is the primary a capture or the browser shows, and a
    ;; front without a back is still a picture, where the reverse is not.
    (local.set $obj (call $d3d9_create_surface
      (local.get $w) (local.get $h) (i32.const 32) (i32.const 1)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (global.set $gl_sw_front_obj (local.get $obj))
    (global.set $gl_sw_front (call $dx_from_this (local.get $obj)))
    (local.set $obj (call $d3d9_create_surface
      (local.get $w) (local.get $h) (i32.const 32) (i32.const 4)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (global.set $gl_sw_rt_obj (local.get $obj))
    (global.set $gl_sw_rt (call $dx_from_this (local.get $obj)))
    (call $gl_sw_aux_surfaces (local.get $w) (local.get $h))
    (global.get $gl_sw_rt))

  ;; Final release of a surface this file allocated; 0 is no surface.
  (func $gl_sw_drop_surface (param $obj i32)
    (if (local.get $obj)
      (then (drop (call $dx_surface_release (local.get $obj))))))

  ;; The depth surface for a w x h target, and the shared white texel.
  (func $gl_sw_aux_surfaces (param $w i32) (param $h i32)
    (local $obj i32)
    (call $gl_stencil_release)
    (call $gl_sw_drop_surface (global.get $gl_sw_zbuf_obj))
    (global.set $gl_sw_zbuf_obj (i32.const 0))
    (global.set $gl_sw_zbuf (i32.const 0))
    ;; 16bpp depth: the rasterizer stores z * 65535, so a clear to all-ones
    ;; bytes is exactly GL's default clear depth of 1.0.
    (local.set $obj (call $d3d9_create_surface
      (local.get $w) (local.get $h) (i32.const 16) (i32.const 4)))
    (if (local.get $obj)
      (then
        (global.set $gl_sw_zbuf_obj (local.get $obj))
        (global.set $gl_sw_zbuf (call $dx_from_this (local.get $obj)))
        (call $gl_sw_clear_depth)))
    (drop (call $rast_white_texel)))

  ;; The shared 1x1 opaque white texture, made on first use. GL draws an
  ;; untextured triangle as it; D3DIM does too when a vertex-fogged
  ;; untextured triangle needs the interpolating span. 0 if it cannot be made.
  (func $rast_white_texel (result i32)
    (local $obj i32)
    (if (i32.eqz (global.get $gl_sw_white))
      (then
        (local.set $obj (call $d3d9_create_surface (i32.const 1) (i32.const 1)
          (i32.const 32) (i32.const 4)))
        (if (local.get $obj)
          (then
            (global.set $gl_sw_white (call $dx_from_this (local.get $obj)))
            (call $dx_surf_fmt_set (global.get $gl_sw_white) (i32.const 5))
            (i32.store (load.field DxObject misc1 (global.get $gl_sw_white))
              (i32.const 0xFFFFFFFF))))))
    (global.get $gl_sw_white))

  ;; PFD_DRAW_TO_BITMAP: draw straight into the DIB selected into the memory
  ;; DC the context was created on. The DIB *is* the colour buffer there --
  ;; the app composes GDI into the same bits between frames and blits them
  ;; around itself (SimGolf, docs/re-notes/simgolf-demo.md) -- so rasterizing
  ;; in place is both the cheapest and the only correct option: a copy from a
  ;; private target would overwrite the guest's own GDI with our background.
  ;; The DxObject made here only DESCRIBES the bitmap's bits; it owns none of
  ;; them and bills no video memory, and nothing ever releases it.
  ;; A bottom-up DIB stores GL's bottom row first, so it needs no y flip.
  ;; Returns 1 when bound, 0 for a bitmap the rasterizer cannot target.
  (func $gl_sw_export_bind_bitmap (export "gl_sw_bind_bitmap") (param $hbmp i32) (result i32)
    (local $rec i32) (local $bpp i32) (local $obj i32) (local $entry i32)
    (local $w i32) (local $h i32) (local $stride i32)
    (call $d3dim_worker_fence)
    (local.set $rec (call $gdi_object_record (local.get $hbmp)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (if (i32.eqz (call $gdi_bitmap_record_valid (local.get $rec))) (then (return (i32.const 0))))
    (local.set $bpp (load.field.memarg GdiBitmap bpp (local.get $rec)))
    (local.set $w (load.field.memarg GdiBitmap width (local.get $rec)))
    (local.set $h (load.field.memarg GdiBitmap height (local.get $rec)))
    (local.set $stride (load.field.memarg GdiBitmap stride (local.get $rec)))
    ;; The rasterizer writes 16- and 32-bit targets only.
    (if (i32.and (i32.ne (local.get $bpp) (i32.const 16)) (i32.ne (local.get $bpp) (i32.const 32)))
      (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $stride) (i32.const 0xFFFF))
      (then (return (i32.const 0))))
    (local.set $obj (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF2)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject width (local.get $entry) (local.get $w))
    (store.field DxObject height (local.get $entry) (local.get $h))
    (store.field DxObject bpp (local.get $entry) (local.get $bpp))
    (store.field DxObject pitch (local.get $entry) (local.get $stride))
    (store.field DxObject misc1 (local.get $entry) (load.field.memarg GdiBitmap bits (local.get $rec)))
    (store.field DxObject misc2 (local.get $entry) (i32.const 0))
    (store.field DxObject flags (local.get $entry) (i32.const 4))
    ;; A BI_RGB 16bpp DIB is X1R5G5B5.
    (if (i32.eq (local.get $bpp) (i32.const 16))
      (then (call $dx_surf_fmt_set (local.get $entry) (i32.const 2))))
    (call $gl_sw_drop_surface (global.get $gl_sw_front_obj))
    (call $gl_sw_drop_surface (global.get $gl_sw_rt_obj))
    (global.set $gl_sw_front_obj (i32.const 0))
    (global.set $gl_sw_rt_obj (i32.const 0))
    (global.set $gl_sw_rt (local.get $entry))
    (global.set $gl_sw_default_w (local.get $w))
    (global.set $gl_sw_default_h (local.get $h))
    (global.set $gl_sw_bitmap (local.get $hbmp))
    (global.set $gl_sw_front (i32.const 0))
    (global.set $gl_sw_flip_y (i32.ne
      (i32.and (load.field.memarg GdiBitmap flags (local.get $rec)) (i32.const 2)) (i32.const 0)))
    (call $gl_sw_aux_surfaces (local.get $w) (local.get $h))
    (i32.const 1))

  ;; Stop targeting borrowed bitmap bits without resetting GL state. The
  ;; next window draw allocates its ordinary drawable and depth surfaces.
  (func (export "gl_sw_unbind_bitmap")
    (if (i32.eqz (global.get $gl_sw_bitmap)) (then (return)))
    (call $d3dim_worker_fence)
    (global.set $gl_sw_bitmap (i32.const 0))
    (global.set $gl_sw_rt (i32.const 0))
    (global.set $gl_sw_front (i32.const 0))
    (global.set $gl_sw_flip_y (i32.const 1)))

  (func $gl_sw_clear_depth
    (call $gl_sw_fill_depth (global.get $gl_sw_zbuf)))

  ;; glClearDepth's value (1.0 unless set) over a 16bpp depth surface or a
  ;; view into one, row by row so a scissor view leaves the rest of each row
  ;; alone. Both bytes alike (1.0 is 0xFFFF) is one fill per row.
  (func $gl_sw_fill_depth (param $z i32)
    (local $y i32) (local $h i32) (local $row i32) (local $pitch i32) (local $bytes i32)
    (local $v i32) (local $x i32)
    (if (i32.eqz (local.get $z)) (then (return)))
    (local.set $v (global.get $gl_sw_clear_depth_value))
    (local.set $h (load.field DxObject height (local.get $z)))
    (local.set $pitch (load.field DxObject pitch (local.get $z)))
    (local.set $bytes (i32.shl (load.field DxObject width (local.get $z)) (i32.const 1)))
    (local.set $row (load.field DxObject misc1 (local.get $z)))
    (block $done (loop $lp
      (br_if $done (i32.ge_s (local.get $y) (local.get $h)))
      (if (i32.eq (i32.and (local.get $v) (i32.const 0xFF)) (i32.shr_u (local.get $v) (i32.const 8)))
        (then (memory.fill (local.get $row) (i32.and (local.get $v) (i32.const 0xFF)) (local.get $bytes)))
        (else
          (local.set $x (i32.const 0))
          (block $row_done (loop $px
            (br_if $row_done (i32.ge_u (local.get $x) (local.get $bytes)))
            (i32.store16 (i32.add (local.get $row) (local.get $x)) (local.get $v))
            (local.set $x (i32.add (local.get $x) (i32.const 2)))
            (br $px)))))
      (local.set $row (i32.add (local.get $row) (local.get $pitch)))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $lp))))

  ;; ---- scissor ------------------------------------------------------------
  ;; GL_SCISSOR_TEST is honoured by drawing through a VIEW: a descriptor-only
  ;; DxObject whose bits start at the box's top-left pixel, sized to the box,
  ;; with the parent's pitch. The span walker already clips every span to its
  ;; target's width and height, so a view scissors triangles and clears alike
  ;; with no per-pixel test. The two views (colour, depth) own no memory, are
  ;; never released, and are refilled on every use.
  (global $gl_sw_sc_view (mut i32) (i32.const 0))
  (global $gl_sw_sc_zview (mut i32) (i32.const 0))
  ;; The box's origin in surface pixels, row 0 = the surface's first row.
  (global $gl_sw_sc_x (mut i32) (i32.const 0))
  (global $gl_sw_sc_y (mut i32) (i32.const 0))

  (func $gl_sw_view_entry (result i32)
    (local $obj i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF2)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (call $dx_from_this (local.get $obj)))

  ;; Point $view at the $x,$y,$w,$h rectangle of surface $parent.
  (func $gl_sw_view_fill (param $view i32) (param $parent i32)
    (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (store.field DxObject width (local.get $view) (local.get $w))
    (store.field DxObject height (local.get $view) (local.get $h))
    (store.field DxObject bpp (local.get $view) (load.field DxObject bpp (local.get $parent)))
    (store.field DxObject pitch (local.get $view) (load.field DxObject pitch (local.get $parent)))
    (store.field DxObject misc1 (local.get $view)
      (i32.add (load.field DxObject misc1 (local.get $parent))
        (i32.add (i32.mul (local.get $y) (load.field DxObject pitch (local.get $parent)))
          (i32.mul (local.get $x)
            (i32.shr_u (load.field DxObject bpp (local.get $parent)) (i32.const 3))))))
    (store.field DxObject misc2 (local.get $view) (i32.const 0))
    ;; Not offscreen, not primary: nothing that walks the DX table for a
    ;; picture should ever mistake a view for one.
    (store.field DxObject flags (local.get $view) (i32.const 0))
    (call $dx_surf_fmt_set (local.get $view) (call $dx_surf_fmt_get (local.get $parent))))

  ;; The colour view for the current scissor box, clamped to the target, with
  ;; the depth view beside it when there is a depth surface; 0 when the box is
  ;; empty, which draws nothing, exactly as GL does.
  (func $gl_sw_scissor_view (result i32)
    (local $s i32) (local $rt i32) (local $tw i32) (local $th i32)
    (local $x i32) (local $y i32) (local $w i32) (local $h i32) (local $x1 i32) (local $y1 i32)
    (local.set $s (global.get $gl_sw_st))
    (local.set $rt (global.get $gl_sw_rt))
    (if (i32.eqz (local.get $rt)) (then (return (i32.const 0))))
    (local.set $tw (load.field DxObject width (local.get $rt)))
    (local.set $th (load.field DxObject height (local.get $rt)))
    (local.set $w (i32.load offset=56 (local.get $s)))
    (local.set $h (i32.load offset=60 (local.get $s)))
    (if (i32.lt_s (local.get $w) (i32.const 0)) (then (return (local.get $rt))))
    (local.set $x (i32.load offset=48 (local.get $s)))
    ;; GL's box is bottom-up; a flipped target's row 0 is the top.
    (local.set $y (select
      (i32.sub (local.get $th) (i32.add (i32.load offset=52 (local.get $s)) (local.get $h)))
      (i32.load offset=52 (local.get $s))
      (global.get $gl_sw_flip_y)))
    (local.set $x1 (i32.add (local.get $x) (local.get $w)))
    (local.set $y1 (i32.add (local.get $y) (local.get $h)))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then (local.set $x (i32.const 0))))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then (local.set $y (i32.const 0))))
    (if (i32.gt_s (local.get $x1) (local.get $tw)) (then (local.set $x1 (local.get $tw))))
    (if (i32.gt_s (local.get $y1) (local.get $th)) (then (local.set $y1 (local.get $th))))
    (if (i32.or (i32.le_s (local.get $x1) (local.get $x)) (i32.le_s (local.get $y1) (local.get $y)))
      (then (return (i32.const 0))))
    (if (i32.eqz (global.get $gl_sw_sc_view))
      (then (global.set $gl_sw_sc_view (call $gl_sw_view_entry))))
    (if (i32.eqz (global.get $gl_sw_sc_view)) (then (return (local.get $rt))))
    (call $gl_sw_view_fill (global.get $gl_sw_sc_view) (local.get $rt) (local.get $x) (local.get $y)
      (i32.sub (local.get $x1) (local.get $x)) (i32.sub (local.get $y1) (local.get $y)))
    (if (global.get $gl_sw_zbuf)
      (then
        (if (i32.eqz (global.get $gl_sw_sc_zview))
          (then (global.set $gl_sw_sc_zview (call $gl_sw_view_entry))))
        (if (global.get $gl_sw_sc_zview)
          (then (call $gl_sw_view_fill (global.get $gl_sw_sc_zview) (global.get $gl_sw_zbuf)
            (local.get $x) (local.get $y)
            (i32.sub (local.get $x1) (local.get $x)) (i32.sub (local.get $y1) (local.get $y)))))))
    (global.set $gl_sw_sc_x (local.get $x))
    (global.set $gl_sw_sc_y (local.get $y))
    (global.get $gl_sw_sc_view))

  ;; ---- the call stream ------------------------------------------------------
  ;; Every GL call on its way into the stream, seen beside $gl_mtx_observe.
  ;; Only calls that change what the software target holds are read. Argument
  ;; i of a call lives at $stack + 4 + 4*i; GLfloat arguments are f32 there.
  (func $gl_sw_observe (param $op i32) (param $stack i32)
    (local $s i32) (local $rt i32) (local $bit i32) (local $mask i32) (local $zv i32)
    (global.set $gl_sw_border_set_failed (i32.const 0))
    (if (i32.eqz (global.get $gl_sw_enabled)) (then (return)))
    (local.set $s (global.get $gl_sw_st))
    ;; A render Worker may still be drawing from the surfaces and texture
    ;; slots these change: 2 glClear, 43 glDeleteTextures, 45 glTexImage2D,
    ;; 55 SwapBuffers, 61 gluBuild2DMipmaps. glTexSubImage2D queues its texels
    ;; behind the draws instead (below). Everything else, glTexParameter
    ;; included, only changes state a queued draw carries its own copy of.
    (if (global.get $d3dim_worker_pending)
      (then (if (i32.or (i32.or (i32.eq (local.get $op) (i32.const 2))
                                (i32.eq (local.get $op) (i32.const 55)))
                  (i32.or (i32.or (i32.eq (local.get $op) (i32.const 43))
                                  (i32.eq (local.get $op) (i32.const 45)))
                          (i32.eq (local.get $op) (i32.const 61))))
        (then (call $d3dim_worker_fence)))))
    ;; A frame that found no Worker tries again on the next one.
    (if (i32.eq (local.get $op) (i32.const 55))
      (then (if (i32.eq (global.get $gl_sw_worker_ok) (i32.const 2))
        (then (global.set $gl_sw_worker_ok (i32.const 0))))))
    ;; 105 glActiveTextureARB(GL_TEXTURE0_ARB + unit)
    (if (i32.eq (local.get $op) (i32.const 105))
      (then (global.set $gl_sw_active_unit
          (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x84C0)))
        (return)))
    (if (global.get $gl_sw_active_unit)
      (then
        ;; Another unit is active: its texture state is not unit 0's. Unit
        ;; 1's TEXTURE_2D enable and env mode are its own cap bits; units
        ;; above 1 are not rasterized at all.
        (if (i32.and (i32.eq (global.get $gl_sw_active_unit) (i32.const 1))
                     (i32.or (i32.eq (local.get $op) (i32.const 10)) (i32.eq (local.get $op) (i32.const 8))))
          (then (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
            (then
              (i32.store (local.get $s) (select
                (i32.or (i32.load (local.get $s)) (i32.const 0x80000))
                (i32.and (i32.load (local.get $s)) (i32.const 0xFFF7FFFF))
                (i32.eq (local.get $op) (i32.const 10))))
              (return)))))
        (if (i32.and (i32.eq (global.get $gl_sw_active_unit) (i32.const 1))
                     (i32.or (i32.eq (local.get $op) (i32.const 44)) (i32.eq (local.get $op) (i32.const 82))))
          (then
            (if (i32.and (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x2300))
                         (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x2200)))
              (then
                (local.set $mask (select
                  (i32.trunc_sat_f32_s (f32.load offset=12 (local.get $stack)))
                  (i32.load offset=12 (local.get $stack))
                  (i32.eq (local.get $op) (i32.const 44))))
                (i32.store (local.get $s) (select
                  (i32.or (i32.load (local.get $s)) (i32.const 0x100000))
                  (i32.and (i32.load (local.get $s)) (i32.const 0xFFEFFFFF))
                  (i32.or (i32.eq (local.get $mask) (i32.const 0x1E01))
                          (i32.eq (local.get $mask) (i32.const 0x2101)))))))
            (return)))
        (if (i32.or (i32.eq (local.get $op) (i32.const 10)) (i32.eq (local.get $op) (i32.const 8)))
          (then (if (i32.or (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
                            (i32.lt_u (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x0C60))
                                      (i32.const 4)))
              (then (return)))))
        (if (i32.lt_u (i32.sub (local.get $op) (i32.const 83)) (i32.const 3))
          (then (return)))
        (if (i32.or (i32.eq (local.get $op) (i32.const 44)) (i32.eq (local.get $op) (i32.const 82)))
          (then (return)))
        (if (i32.eq (local.get $op) (i32.const 42))
          (then
            (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
              (then (global.set $gl_sw_other_bound (i32.load offset=8 (local.get $stack)))))
            (return)))
        ;; Texture uploads and parameters go to the name this unit has bound.
        (if (i32.or (i32.or (i32.eq (local.get $op) (i32.const 45)) (i32.eq (local.get $op) (i32.const 47)))
                    (i32.or (i32.or (i32.eq (local.get $op) (i32.const 46)) (i32.eq (local.get $op) (i32.const 96)))
                            (i32.eq (local.get $op) (i32.const 61))))
          (then
            (local.set $bit (i32.load offset=40 (local.get $s)))
            (i32.store offset=40 (local.get $s) (global.get $gl_sw_other_bound))
            (global.set $gl_sw_active_unit (i32.const 0))
            (call $gl_sw_observe (local.get $op) (local.get $stack))
            (global.set $gl_sw_active_unit (i32.const 1))
            (i32.store offset=40 (local.get $s) (local.get $bit))
            (return)))))
    ;; 79 glFogf / 80 glFogi (pname, value) / 78 glFogfv (pname, params)
    (if (i32.eq (local.get $op) (i32.const 79))
      (then (call $gl_sw_fog_param (i32.load offset=4 (local.get $stack))
          (f32.load offset=8 (local.get $stack)) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $op) (i32.const 80))
      (then (call $gl_sw_fog_param (i32.load offset=4 (local.get $stack))
          (f32.convert_i32_s (i32.load offset=8 (local.get $stack))) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $op) (i32.const 78))
      (then
        (if (i32.load offset=8 (local.get $stack))
          (then (call $gl_sw_fog_param (i32.load offset=4 (local.get $stack))
            (f32.reinterpret_i32 (call $gl32 (i32.load offset=8 (local.get $stack))))
            (i32.load offset=8 (local.get $stack)))))
        (return)))
    ;; 83 glTexGeni / 84 glTexGenf / 85 glTexGenfv (coord, GL_TEXTURE_GEN_MODE,
    ;; mode). Only S and T are kept; R and Q have no effect on a 2D lookup.
    (if (i32.lt_u (i32.sub (local.get $op) (i32.const 83)) (i32.const 3))
      (then
        (if (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x2500))
          (then
            (local.set $mask (if (result i32) (i32.eq (local.get $op) (i32.const 83))
              (then (i32.load offset=12 (local.get $stack)))
              (else (if (result i32) (i32.eq (local.get $op) (i32.const 84))
                (then (i32.trunc_sat_f32_s (f32.load offset=12 (local.get $stack))))
                (else (if (result i32) (i32.load offset=12 (local.get $stack))
                  (then (i32.trunc_sat_f32_s (f32.reinterpret_i32
                    (call $gl32 (i32.load offset=12 (local.get $stack))))))
                  (else (i32.const 0))))))))
            (local.set $mask (i32.and (local.get $mask) (i32.const 0xFFFF)))
            (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x2000))   ;; GL_S
              (then (global.set $gl_sw_texgen_modes (i32.or
                (i32.and (global.get $gl_sw_texgen_modes) (i32.const 0xFFFF0000))
                (local.get $mask)))))
            (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x2001))   ;; GL_T
              (then (global.set $gl_sw_texgen_modes (i32.or
                (i32.and (global.get $gl_sw_texgen_modes) (i32.const 0xFFFF))
                (i32.shl (local.get $mask) (i32.const 16))))))))
        (return)))
    ;; 15 glPointSize(size) / 94 glLineWidth(width). GL ignores a size
    ;; that is not positive (GL_INVALID_VALUE).
    (if (i32.or (i32.eq (local.get $op) (i32.const 15)) (i32.eq (local.get $op) (i32.const 94)))
      (then
        (if (f32.gt (f32.load offset=4 (local.get $stack)) (f32.const 0))
          (then (if (i32.eq (local.get $op) (i32.const 15))
            (then (global.set $gl_sw_point_size (f32.load offset=4 (local.get $stack))))
            (else (global.set $gl_sw_line_width (f32.load offset=4 (local.get $stack)))))))
        (return)))
    ;; 10 glEnable / 8 glDisable
    (if (i32.or (i32.eq (local.get $op) (i32.const 10)) (i32.eq (local.get $op) (i32.const 8)))
      (then
        (local.set $bit (call $gl_sw_cap_bit (i32.load offset=4 (local.get $stack))))
        (i32.store (local.get $s) (select
          (i32.or (i32.load (local.get $s)) (local.get $bit))
          (i32.and (i32.load (local.get $s)) (i32.xor (local.get $bit) (i32.const -1)))
          (i32.eq (local.get $op) (i32.const 10))))
        (return)))
    ;; 1 glBlendFunc(src, dst)
    (if (i32.eq (local.get $op) (i32.const 1))
      (then
        (i32.store offset=4 (local.get $s)
          (call $gl_sw_blend (i32.load offset=4 (local.get $stack)) (i32.const 2)))
        (i32.store offset=8 (local.get $s)
          (call $gl_sw_blend (i32.load offset=8 (local.get $stack)) (i32.const 1)))
        (return)))
    ;; 0 glAlphaFunc(func, GLclampf ref)
    (if (i32.eqz (local.get $op))
      (then
        (i32.store offset=12 (local.get $s) (call $gl_sw_cmp (i32.load offset=4 (local.get $stack))))
        (i32.store offset=16 (local.get $s) (call $gl_sw_u8 (f32.load offset=8 (local.get $stack))))
        (return)))
    ;; 5 glDepthFunc, 6 glDepthMask, 4 glCullFace, 81 glFrontFace
    (if (i32.eq (local.get $op) (i32.const 5))
      (then (i32.store offset=20 (local.get $s) (call $gl_sw_cmp (i32.load offset=4 (local.get $stack))))
        (return)))
    (if (i32.eq (local.get $op) (i32.const 6))
      (then (i32.store offset=24 (local.get $s)
          (i32.ne (i32.and (i32.load offset=4 (local.get $stack)) (i32.const 0xFF)) (i32.const 0)))
        (return)))
    (if (i32.eq (local.get $op) (i32.const 4))
      (then (i32.store offset=28 (local.get $s) (i32.load offset=4 (local.get $stack))) (return)))
    (if (i32.eq (local.get $op) (i32.const 81))
      (then (i32.store offset=32 (local.get $s)
          (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x901)))
        (return)))
    ;; 44 glTexEnvf / 82 glTexEnvi (GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, mode).
    ;; REPLACE and DECAL both take the texture's colour; DECAL's blend by
    ;; texture alpha is not modelled. Any other target is GL_INVALID_ENUM and
    ;; changes nothing: SimGolf passes GL_TEXTURE_2D 474 times asking for
    ;; REPLACE, and real GL keeps MODULATE, so its terrain stays lit.
    (if (i32.or (i32.eq (local.get $op) (i32.const 44)) (i32.eq (local.get $op) (i32.const 82)))
      (then
        (if (i32.and (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x2300))
                     (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x2200)))
          (then
            (local.set $mask (select
              (i32.trunc_sat_f32_s (f32.load offset=12 (local.get $stack)))
              (i32.load offset=12 (local.get $stack))
              (i32.eq (local.get $op) (i32.const 44))))
            (i32.store offset=36 (local.get $s)
              (select (i32.const 2) (i32.const 4)
                (i32.or (i32.eq (local.get $mask) (i32.const 0x1E01))
                        (i32.eq (local.get $mask) (i32.const 0x2101)))))))
        (return)))
    ;; 42 glBindTexture(target, name), TEXTURE_2D only.
    (if (i32.eq (local.get $op) (i32.const 42))
      (then
        (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
          (then (i32.store offset=40 (local.get $s) (i32.load offset=8 (local.get $stack)))))
        (return)))
    ;; 112 glTexParameterfv: read the guest span bytewise so a vector crossing
    ;; sparse pages is not mistaken for one contiguous Wasm allocation.
    (if (i32.eq (local.get $op) (i32.const 112)) (then
      (local.set $bit (call $gl_tex_parameter_bytes (local.get $stack)))
      (if (i32.eqz (local.get $bit)) (then (return)))
      (call $gl_copy_from_guest (global.get $gl_sw_scratch)
        (i32.load offset=12 (local.get $stack)) (local.get $bit))
      (if (i32.eq (local.get $bit) (i32.const 16))
        (then (global.set $gl_sw_border_set_failed (i32.eqz
          (call $gl_sw_border_set
            (call $gl_sw_tex_slot (i32.load offset=40 (local.get $s)))
            (global.get $gl_sw_scratch)))))
        (else (call $gl_sw_tex_param (i32.load offset=8 (local.get $stack))
          (i32.trunc_sat_f32_s (f32.floor (f32.add
            (f32.load (global.get $gl_sw_scratch)) (f32.const 0.5)))))))
      (return)))
    ;; 46 glTexParameterf / 96 glTexParameteri
    (if (i32.or (i32.eq (local.get $op) (i32.const 46)) (i32.eq (local.get $op) (i32.const 96)))
      (then
        (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
          (then (call $gl_sw_tex_param (i32.load offset=8 (local.get $stack))
            (select
              (i32.trunc_sat_f32_s (f32.floor (f32.add
                (f32.load offset=12 (local.get $stack)) (f32.const 0.5))))
              (i32.load offset=12 (local.get $stack))
              (i32.eq (local.get $op) (i32.const 46))))))
        (return)))
    ;; 45 glTexImage2D(target, level, internal, w, h, border, format, type, pixels)
    (if (i32.eq (local.get $op) (i32.const 45))
      (then
        (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
          (then (call $gl_sw_tex_image
            (i32.load offset=8 (local.get $stack)) (i32.load offset=12 (local.get $stack))
            (i32.load offset=16 (local.get $stack)) (i32.load offset=20 (local.get $stack))
            (i32.load offset=28 (local.get $stack)) (i32.load offset=32 (local.get $stack))
            (i32.load offset=36 (local.get $stack)))))
        (return)))
    ;; 61 gluBuild2DMipmaps(target, components, w, h, format, type, data)
    (if (i32.eq (local.get $op) (i32.const 61))
      (then
        (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
          (then (call $gl_sw_tex_image (i32.const 0)
            (i32.load offset=8 (local.get $stack))
            (i32.load offset=12 (local.get $stack)) (i32.load offset=16 (local.get $stack))
            (i32.load offset=20 (local.get $stack)) (i32.load offset=24 (local.get $stack))
            (i32.load offset=28 (local.get $stack)))))
        (return)))
    ;; 47 glTexSubImage2D(target, level, x, y, w, h, format, type, pixels)
    (if (i32.eq (local.get $op) (i32.const 47))
      (then
        (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
          (then (call $gl_sw_tex_sub_image
            (i32.load offset=8 (local.get $stack))
            (i32.load offset=12 (local.get $stack)) (i32.load offset=16 (local.get $stack))
            (i32.load offset=20 (local.get $stack)) (i32.load offset=24 (local.get $stack))
            (i32.load offset=28 (local.get $stack)) (i32.load offset=32 (local.get $stack))
            (i32.load offset=36 (local.get $stack)))))
        (return)))
    ;; 43 glDeleteTextures(n, names)
    (if (i32.eq (local.get $op) (i32.const 43))
      (then (call $gl_sw_delete_textures (i32.load offset=4 (local.get $stack))
          (i32.load offset=8 (local.get $stack)))
        (return)))
    ;; 73 glPixelStorei(GL_UNPACK_ALIGNMENT, n)
    (if (i32.eq (local.get $op) (i32.const 73))
      (then
        (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0CF5))
          (then
            (local.set $mask (i32.load offset=8 (local.get $stack)))
            (if (i32.or (i32.or (i32.eq (local.get $mask) (i32.const 1)) (i32.eq (local.get $mask) (i32.const 2)))
                        (i32.or (i32.eq (local.get $mask) (i32.const 4)) (i32.eq (local.get $mask) (i32.const 8))))
              (then (i32.store offset=44 (local.get $s) (local.get $mask))))))
        (return)))
    ;; 76 glPushAttrib(mask) / 77 glPopAttrib
    (if (i32.eq (local.get $op) (i32.const 76))
      (then (call $gl_sw_push_attrib (i32.load offset=4 (local.get $stack))) (return)))
    (if (i32.eq (local.get $op) (i32.const 77))
      (then (call $gl_sw_pop_attrib) (return)))
    ;; 110 glClearDepth(GLclampd): clamped to [0,1], kept as 16-bit depth.
    (if (i32.eq (local.get $op) (i32.const 110))
      (then
        (global.set $gl_sw_clear_depth_value (i32.trunc_sat_f64_u (f64.add
          (f64.mul (f64.min (f64.max (f64.load offset=4 (local.get $stack)) (f64.const 0)) (f64.const 1))
                   (f64.const 65535))
          (f64.const 0.5))))
        (return)))
    ;; 3 glClearColor(four GLclampf)
    (if (i32.eq (local.get $op) (i32.const 3))
      (then
        (global.set $gl_sw_clear_color (i32.or
          (i32.or
            (i32.shl (call $gl_sw_u8 (f32.load offset=16 (local.get $stack))) (i32.const 24))
            (i32.shl (call $gl_sw_u8 (f32.load offset=4 (local.get $stack))) (i32.const 16)))
          (i32.or
            (i32.shl (call $gl_sw_u8 (f32.load offset=8 (local.get $stack))) (i32.const 8))
            (call $gl_sw_u8 (f32.load offset=12 (local.get $stack))))))
        (return)))
    ;; 55 SwapBuffers / wglSwapLayerBuffers: the back buffer becomes the
    ;; picture.
    (if (i32.eq (local.get $op) (i32.const 55))
      (then
        (if (i32.and (i32.ne (global.get $gl_sw_rt) (i32.const 0))
                     (i32.ne (global.get $gl_sw_front) (i32.const 0)))
          (then
            (call $memcpy (load.field DxObject misc1 (global.get $gl_sw_front))
              (load.field DxObject misc1 (global.get $gl_sw_rt))
              (i32.mul (load.field DxObject pitch (global.get $gl_sw_rt))
                       (load.field DxObject height (global.get $gl_sw_rt))))
            ;; Then clear the back's colour to (0,0,0,0), which is what the
            ;; WebGL backend's drawing buffer does after every composite
            ;; (preserveDrawingBuffer is off). GoldSrc never calls glClear --
            ;; its world covers the screen -- so during Half-Life's black
            ;; intro fade a kept back showed the loading plaque's leftovers
            ;; as a strip down the right edge that the WebGL picture lacks.
            ;; Depth is deliberately kept: the z-trick alternates halves of
            ;; the depth range precisely so it never has to clear it.
            (memory.fill (load.field DxObject misc1 (global.get $gl_sw_rt)) (i32.const 0)
              (i32.mul (load.field DxObject pitch (global.get $gl_sw_rt))
                       (load.field DxObject height (global.get $gl_sw_rt))))
            (global.set $gl_sw_presents (i32.add (global.get $gl_sw_presents) (i32.const 1)))))
        (return)))
    ;; 18 glScissor(x, y, w, h)
    (if (i32.eq (local.get $op) (i32.const 18))
      (then
        (call $memcpy (i32.add (local.get $s) (i32.const 48))
          (i32.add (local.get $stack) (i32.const 4)) (i32.const 16))
        (return)))
    ;; 2 glClear(mask): COLOR_BUFFER_BIT 0x4000, DEPTH_BUFFER_BIT 0x100.
    (if (i32.eq (local.get $op) (i32.const 2))
      (then
        (local.set $mask (i32.load offset=4 (local.get $stack)))
        (local.set $rt (call $gl_sw_target))
        (if (i32.eqz (local.get $rt)) (then (return)))
        ;; glClear is scissored too.
        (local.set $zv (global.get $gl_sw_zbuf))
        (if (i32.and (i32.load (local.get $s)) (i32.const 32))
          (then
            (local.set $rt (call $gl_sw_scissor_view))
            (if (i32.eqz (local.get $rt)) (then (return)))
            (if (i32.ne (local.get $rt) (global.get $gl_sw_rt))
              (then (local.set $zv (global.get $gl_sw_sc_zview))))))
        (if (i32.and (local.get $mask) (i32.const 0x4000))
          (then (call $gl_color_clear (local.get $rt))))
        (if (i32.and (local.get $mask) (i32.const 0x100))
          (then (call $gl_sw_fill_depth (local.get $zv))))
        (if (i32.and (local.get $mask) (i32.const 0x400))
          (then (call $gl_stencil_clear (local.get $rt)))))))

  ;; ---- lighting -------------------------------------------------------------
  ;; GL 1.x fixed-function lighting per vertex, from the matrix mirror's lights
  ;; (already in eye space: glLightfv transformed them), material and light
  ;; model ambient. Warcraft III lights its terrain and sky with emission and
  ;; ambient; without this every lit surface came out glColor white.
  ;;
  ;; Not modelled: spot cutoffs and distance attenuation (every positional
  ;; light is unattenuated), two-sided lighting, a local viewer, and
  ;; glColorMaterial's mode -- COLOR_MATERIAL always tracks AMBIENT_AND_DIFFUSE,
  ;; GL's default. Normals are always renormalized.
  (global $gl_sw_lit (mut i32) (i32.const 0))
  (global $gl_sw_light_block (mut i32) (i32.const 0))

  (func $gl_sw_m3 (param $m i32) (param $r i32) (param $c i32) (result f32)
    (f32.load (i32.add (local.get $m)
      (i32.shl (i32.add (i32.shl (local.get $c) (i32.const 2)) (local.get $r)) (i32.const 2)))))

  ;; The normal matrix: the cofactor matrix of the modelview's upper 3x3,
  ;; which is its inverse-transpose times the determinant. Normals are
  ;; renormalized after, so only the determinant's sign matters.
  (func $gl_sw_light_setup (param $b i32)
    (local $m i32) (local $n i32) (local $det f32)
    (global.set $gl_sw_light_block (local.get $b))
    (local.set $m (call $gl_mtx_stack_top (local.get $b) (i32.const 0)))
    (local.set $n (i32.add (global.get $gl_sw_scratch) (i32.const 0x400)))
    (f32.store offset=0 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 1)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 2)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 2)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 1)))))
    (f32.store offset=4 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 2)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 0)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 0)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 2)))))
    (f32.store offset=8 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 0)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 1)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 1)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 0)))))
    (f32.store offset=12 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 2)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 1)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 1)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 2)))))
    (f32.store offset=16 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 0)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 2)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 2)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 0)))))
    (f32.store offset=20 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 1)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 0)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 0)) (call $gl_sw_m3 (local.get $m) (i32.const 2) (i32.const 1)))))
    (f32.store offset=24 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 1)) (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 2)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 2)) (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 1)))))
    (f32.store offset=28 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 2)) (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 0)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 0)) (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 2)))))
    (f32.store offset=32 (local.get $n) (f32.sub
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 0)) (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 1)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 1)) (call $gl_sw_m3 (local.get $m) (i32.const 1) (i32.const 0)))))
    ;; det = row 0 of the matrix dotted with row 0 of its cofactors.
    (local.set $det (f32.add (f32.add
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 0)) (f32.load offset=0 (local.get $n)))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 1)) (f32.load offset=4 (local.get $n))))
      (f32.mul (call $gl_sw_m3 (local.get $m) (i32.const 0) (i32.const 2)) (f32.load offset=8 (local.get $n)))))
    (f32.store offset=36 (local.get $n)
      (select (f32.const -1) (f32.const 1) (f32.lt (local.get $det) (f32.const 0)))))

  ;; Normalize the three f32 at $v in place; a zero vector is left alone.
  (func $gl_sw_normalize3 (param $v i32)
    (local $len f32)
    (local.set $len (f32.sqrt (f32.add (f32.add
      (f32.mul (f32.load (local.get $v)) (f32.load (local.get $v)))
      (f32.mul (f32.load offset=4 (local.get $v)) (f32.load offset=4 (local.get $v))))
      (f32.mul (f32.load offset=8 (local.get $v)) (f32.load offset=8 (local.get $v))))))
    (if (f32.gt (local.get $len) (f32.const 0))
      (then
        (f32.store (local.get $v) (f32.div (f32.load (local.get $v)) (local.get $len)))
        (f32.store offset=4 (local.get $v) (f32.div (f32.load offset=4 (local.get $v)) (local.get $len)))
        (f32.store offset=8 (local.get $v) (f32.div (f32.load offset=8 (local.get $v)) (local.get $len))))))

  (func $gl_sw_dot3 (param $a i32) (param $b i32) (result f32)
    (f32.add (f32.add
      (f32.mul (f32.load (local.get $a)) (f32.load (local.get $b)))
      (f32.mul (f32.load offset=4 (local.get $a)) (f32.load offset=4 (local.get $b))))
      (f32.mul (f32.load offset=8 (local.get $a)) (f32.load offset=8 (local.get $b)))))

  ;; The lit colour of the 60-byte GL vertex $v (position +0, colour +12,
  ;; normal +36) as four f32 at $dst. Scratch at +0x430: eye normal, eye
  ;; position, light vector, half vector, 16 bytes each.
  (func $gl_sw_light_vertex (param $v i32) (param $dst i32)
    (local $b i32) (local $nm i32) (local $t i32) (local $mask i32) (local $i i32)
    (local $light i32) (local $amb i32) (local $dif i32) (local $spec i32) (local $c i32)
    (local $ndl f32) (local $ndh f32) (local $sp f32) (local $w f32) (local $k i32)
    (local $has_spec i32)
    (local.set $b (global.get $gl_sw_light_block))
    (local.set $nm (i32.add (global.get $gl_sw_scratch) (i32.const 0x400)))
    (local.set $t (i32.add (global.get $gl_sw_scratch) (i32.const 0x430)))
    ;; Eye normal.
    (local.set $k (i32.const 0))
    (loop $rows
      (f32.store (i32.add (local.get $t) (i32.shl (local.get $k) (i32.const 2)))
        (f32.mul (f32.load offset=36 (local.get $nm))
          (f32.add (f32.add
            (f32.mul (f32.load (i32.add (local.get $nm) (i32.mul (local.get $k) (i32.const 12))))
                     (f32.load offset=36 (local.get $v)))
            (f32.mul (f32.load offset=4 (i32.add (local.get $nm) (i32.mul (local.get $k) (i32.const 12))))
                     (f32.load offset=40 (local.get $v))))
            (f32.mul (f32.load offset=8 (i32.add (local.get $nm) (i32.mul (local.get $k) (i32.const 12))))
                     (f32.load offset=44 (local.get $v))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $k) (i32.const 3))))
    (call $gl_sw_normalize3 (local.get $t))
    ;; Material ambient and diffuse: the vertex colour under COLOR_MATERIAL.
    (local.set $amb (i32.add (local.get $b) (i32.const 8880)))
    (local.set $dif (i32.add (local.get $b) (i32.const 8896)))
    (if (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 0x10000))
      (then
        (local.set $amb (i32.add (local.get $v) (i32.const 12)))
        (local.set $dif (local.get $amb))))
    (local.set $spec (i32.add (local.get $b) (i32.const 8912)))
    (local.set $has_spec (i32.or (i32.or
      (f32.ne (f32.load (local.get $spec)) (f32.const 0))
      (f32.ne (f32.load offset=4 (local.get $spec)) (f32.const 0)))
      (f32.ne (f32.load offset=8 (local.get $spec)) (f32.const 0))))
    ;; Eye position, only for positional lights.
    (call $gl_mtx_set4 (i32.add (local.get $t) (i32.const 64))
      (f32.load (local.get $v)) (f32.load offset=4 (local.get $v))
      (f32.load offset=8 (local.get $v)) (f32.load offset=56 (local.get $v)))
    (call $gl_mtx_transform4 (i32.add (local.get $t) (i32.const 16))
      (call $gl_mtx_stack_top (local.get $b) (i32.const 0))
      (i32.add (local.get $t) (i32.const 64)))
    ;; A projective vertex's eye point is xyz / w (w = 0 stays a direction).
    (call $gl_sw_dehomogenize (i32.add (local.get $t) (i32.const 16)))
    ;; emission + material ambient * light model ambient
    (local.set $k (i32.const 0))
    (loop $init
      (local.set $c (i32.shl (local.get $k) (i32.const 2)))
      (f32.store (i32.add (local.get $dst) (local.get $c))
        (f32.add (f32.load offset=8928 (i32.add (local.get $b) (local.get $c)))
          (f32.mul (f32.load (i32.add (local.get $amb) (local.get $c)))
                   (f32.load offset=8352 (i32.add (local.get $b) (local.get $c))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $init (i32.lt_u (local.get $k) (i32.const 3))))
    (local.set $mask (i32.and (i32.shr_u (i32.load (global.get $gl_sw_st)) (i32.const 8))
      (i32.const 255)))
    (local.set $i (i32.const 0))
    (block $lights_done (loop $lights
      (br_if $lights_done (i32.eqz (local.get $mask)))
      (if (i32.and (local.get $mask) (i32.const 1))
        (then
          (local.set $light (call $gl_mtx_light_slot (local.get $b) (local.get $i)))
          ;; Light vector: the direction for w == 0, else toward the position.
          (local.set $w (f32.load offset=12 (local.get $light)))
          (if (f32.eq (local.get $w) (f32.const 0))
            (then (call $gl_mtx_set4 (i32.add (local.get $t) (i32.const 32))
              (f32.load (local.get $light)) (f32.load offset=4 (local.get $light))
              (f32.load offset=8 (local.get $light)) (f32.const 0)))
            (else (call $gl_mtx_set4 (i32.add (local.get $t) (i32.const 32))
              (f32.sub (f32.div (f32.load (local.get $light)) (local.get $w))
                       (f32.load offset=16 (local.get $t)))
              (f32.sub (f32.div (f32.load offset=4 (local.get $light)) (local.get $w))
                       (f32.load offset=20 (local.get $t)))
              (f32.sub (f32.div (f32.load offset=8 (local.get $light)) (local.get $w))
                       (f32.load offset=24 (local.get $t)))
              (f32.const 0))))
          (call $gl_sw_normalize3 (i32.add (local.get $t) (i32.const 32)))
          (local.set $ndl (f32.max (f32.const 0)
            (call $gl_sw_dot3 (local.get $t) (i32.add (local.get $t) (i32.const 32)))))
          (local.set $sp (f32.const 0))
          (if (i32.and (local.get $has_spec) (f32.gt (local.get $ndl) (f32.const 0)))
            (then
              ;; Blinn half vector with GL's default infinite viewer (0,0,1).
              (call $gl_mtx_set4 (i32.add (local.get $t) (i32.const 48))
                (f32.load offset=32 (local.get $t)) (f32.load offset=36 (local.get $t))
                (f32.add (f32.load offset=40 (local.get $t)) (f32.const 1)) (f32.const 0))
              (call $gl_sw_normalize3 (i32.add (local.get $t) (i32.const 48)))
              (local.set $ndh (f32.max (f32.const 0)
                (call $gl_sw_dot3 (local.get $t) (i32.add (local.get $t) (i32.const 48)))))
              (local.set $sp (f32.demote_f64 (call $host_math_pow
                (f64.promote_f32 (local.get $ndh))
                (f64.promote_f32 (f32.load offset=8944 (local.get $b))))))))
          (local.set $k (i32.const 0))
          (loop $ch
            (local.set $c (i32.shl (local.get $k) (i32.const 2)))
            (f32.store (i32.add (local.get $dst) (local.get $c))
              (f32.add (f32.load (i32.add (local.get $dst) (local.get $c)))
                (f32.add (f32.add
                  (f32.mul (f32.load (i32.add (local.get $amb) (local.get $c)))
                           (f32.load offset=16 (i32.add (local.get $light) (local.get $c))))
                  (f32.mul (local.get $ndl)
                    (f32.mul (f32.load (i32.add (local.get $dif) (local.get $c)))
                             (f32.load offset=32 (i32.add (local.get $light) (local.get $c))))))
                  (f32.mul (local.get $sp)
                    (f32.mul (f32.load (i32.add (local.get $spec) (local.get $c)))
                             (f32.load offset=48 (i32.add (local.get $light) (local.get $c))))))))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br_if $ch (i32.lt_u (local.get $k) (i32.const 3))))))
      (local.set $mask (i32.shr_u (local.get $mask) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lights)))
    ;; Alpha is the material diffuse's.
    (f32.store offset=12 (local.get $dst) (f32.load offset=12 (local.get $dif))))

  ;; ---- texgen ---------------------------------------------------------------
  ;; GL_SPHERE_MAP on S and T, the one texgen mode the WebGL backend draws, by
  ;; the same formula: reflect the eye vector about the eye normal, then
  ;; s,t = r.xy / (2 sqrt(rx^2 + ry^2 + (rz+1)^2)) + 0.5. The texture matrix
  ;; still applies after. Scratch +0x600: eye normal, eye position, a vec4.
  (func $gl_sw_sphere_map (param $v i32) (param $clip i32)
    (local $nm i32) (local $t i32) (local $k i32) (local $d f32)
    (local $rx f32) (local $ry f32) (local $rz f32) (local $m f32)
    (local.set $nm (i32.add (global.get $gl_sw_scratch) (i32.const 0x400)))
    (local.set $t (i32.add (global.get $gl_sw_scratch) (i32.const 0x600)))
    (loop $rows
      (f32.store (i32.add (local.get $t) (i32.shl (local.get $k) (i32.const 2)))
        (f32.mul (f32.load offset=36 (local.get $nm))
          (f32.add (f32.add
            (f32.mul (f32.load (i32.add (local.get $nm) (i32.mul (local.get $k) (i32.const 12))))
                     (f32.load offset=36 (local.get $v)))
            (f32.mul (f32.load offset=4 (i32.add (local.get $nm) (i32.mul (local.get $k) (i32.const 12))))
                     (f32.load offset=40 (local.get $v))))
            (f32.mul (f32.load offset=8 (i32.add (local.get $nm) (i32.mul (local.get $k) (i32.const 12))))
                     (f32.load offset=44 (local.get $v))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $k) (i32.const 3))))
    (call $gl_sw_normalize3 (local.get $t))
    (call $gl_mtx_set4 (i32.add (local.get $t) (i32.const 32))
      (f32.load (local.get $v)) (f32.load offset=4 (local.get $v))
      (f32.load offset=8 (local.get $v)) (f32.load offset=56 (local.get $v)))
    (call $gl_mtx_transform4 (i32.add (local.get $t) (i32.const 16))
      (call $gl_mtx_stack_top (global.get $gl_sw_light_block) (i32.const 0))
      (i32.add (local.get $t) (i32.const 32)))
    (call $gl_sw_normalize3 (i32.add (local.get $t) (i32.const 16)))
    ;; r = e - 2 (n . e) n
    (local.set $d (f32.mul (f32.const 2)
      (call $gl_sw_dot3 (local.get $t) (i32.add (local.get $t) (i32.const 16)))))
    (local.set $rx (f32.sub (f32.load offset=16 (local.get $t)) (f32.mul (local.get $d) (f32.load (local.get $t)))))
    (local.set $ry (f32.sub (f32.load offset=20 (local.get $t)) (f32.mul (local.get $d) (f32.load offset=4 (local.get $t)))))
    (local.set $rz (f32.add (f32.sub (f32.load offset=24 (local.get $t))
      (f32.mul (local.get $d) (f32.load offset=8 (local.get $t)))) (f32.const 1)))
    (local.set $m (f32.mul (f32.const 2) (f32.sqrt (f32.add
      (f32.add (f32.mul (local.get $rx) (local.get $rx)) (f32.mul (local.get $ry) (local.get $ry)))
      (f32.mul (local.get $rz) (local.get $rz))))))
    (if (f32.gt (local.get $m) (f32.const 0.000001))
      (then
        (f32.store offset=16 (local.get $clip) (f32.add (f32.div (local.get $rx) (local.get $m)) (f32.const 0.5)))
        (f32.store offset=20 (local.get $clip) (f32.add (f32.div (local.get $ry) (local.get $m)) (f32.const 0.5))))))

  ;; xyz /= w in place for a homogeneous eye point; w = 1 and w = 0 are kept.
  (func $gl_sw_dehomogenize (param $p i32)
    (local $w f32)
    (local.set $w (f32.load offset=12 (local.get $p)))
    (if (i32.or (f32.eq (local.get $w) (f32.const 1)) (f32.eq (local.get $w) (f32.const 0))) (then (return)))
    (f32.store (local.get $p) (f32.div (f32.load (local.get $p)) (local.get $w)))
    (f32.store offset=4 (local.get $p) (f32.div (f32.load offset=4 (local.get $p)) (local.get $w)))
    (f32.store offset=8 (local.get $p) (f32.div (f32.load offset=8 (local.get $p)) (local.get $w)))
    (f32.store offset=12 (local.get $p) (f32.const 1)))

  ;; ---- texture matrix -------------------------------------------------------
  ;; Top of texture unit 0's stack while a draw is consumed, or 0 for identity.
  (global $gl_sw_texmtx (mut i32) (i32.const 0))

  (func $gl_sw_mtx_is_identity (param $m i32) (result i32)
    (local $i i32) (local $want f32)
    (loop $lp
      (local.set $want (select (f32.const 1) (f32.const 0)
        (i32.eqz (i32.rem_u (local.get $i) (i32.const 5)))))
      (if (f32.ne (f32.load (i32.add (local.get $m) (i32.shl (local.get $i) (i32.const 2))))
                  (local.get $want))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $lp (i32.lt_u (local.get $i) (i32.const 16))))
    (i32.const 1))

  ;; The full (s, t, r, q) -- s, t at $p, r and q given -- through the
  ;; column-major texture matrix $m, kept homogeneous: S and T replace s and t
  ;; at $p and Q goes to $qp. Every primitive divides per fragment (triangles
  ;; and lines interpolate S/w, T/w and Q/w; a point's one sample divides
  ;; once), so neither a projective matrix nor glTexCoord4f's q is reduced to
  ;; an affine approximation by dividing at the vertices.
  (func $gl_sw_tex_transform_homogeneous (param $m i32) (param $p i32) (param $qp i32)
      (param $r f32) (param $q f32)
    (local $s f32) (local $t f32)
    (local.set $s (f32.load (local.get $p)))
    (local.set $t (f32.load offset=4 (local.get $p)))
    (f32.store (local.get $qp) (call $gl_sw_mtx_row (local.get $m) (i32.const 12)
      (local.get $s) (local.get $t) (local.get $r) (local.get $q)))
    (f32.store (local.get $p) (call $gl_sw_mtx_row (local.get $m) (i32.const 0)
      (local.get $s) (local.get $t) (local.get $r) (local.get $q)))
    (f32.store offset=4 (local.get $p) (call $gl_sw_mtx_row (local.get $m) (i32.const 4)
      (local.get $s) (local.get $t) (local.get $r) (local.get $q))))

  ;; One row of column-major $m (row byte offset $row: 0, 4, 8, 12) times
  ;; (s, t, r, q).
  (func $gl_sw_mtx_row (param $m i32) (param $row i32)
      (param $s f32) (param $t f32) (param $r f32) (param $q f32) (result f32)
    (local.set $m (i32.add (local.get $m) (local.get $row)))
    (f32.add
      (f32.add (f32.mul (f32.load (local.get $m)) (local.get $s))
               (f32.mul (f32.load offset=16 (local.get $m)) (local.get $t)))
      (f32.add (f32.mul (f32.load offset=32 (local.get $m)) (local.get $r))
               (f32.mul (f32.load offset=48 (local.get $m)) (local.get $q)))))

  ;; GL's fog coordinate: the eye-space distance |z_e / w_e| of the object
  ;; point at $p, through the modelview matrix $gl_sw_mv. Clip w equals it
  ;; only under a perspective projection; an orthographic one gives w = 1
  ;; for every vertex, and Oni's menu (glOrtho, linear fog 0.975..1) came
  ;; out entirely fog-coloured gray while WebGL drew it clear.
  (global $gl_sw_mv (mut i32) (i32.const 0))
  (func $gl_sw_eye_distance (param $p i32) (result f32)
    (local $ze f32) (local $we f32) (local $x f32) (local $y f32) (local $z f32) (local $w f32)
    (local.set $x (f32.load (local.get $p)))
    (local.set $y (f32.load offset=4 (local.get $p)))
    (local.set $z (f32.load offset=8 (local.get $p)))
    (local.set $w (f32.load offset=12 (local.get $p)))
    (local.set $ze (call $gl_sw_mtx_row (global.get $gl_sw_mv) (i32.const 8)
      (local.get $x) (local.get $y) (local.get $z) (local.get $w)))
    (local.set $we (call $gl_sw_mtx_row (global.get $gl_sw_mv) (i32.const 12)
      (local.get $x) (local.get $y) (local.get $z) (local.get $w)))
    (if (f32.ne (local.get $we) (f32.const 0))
      (then (local.set $ze (f32.div (local.get $ze) (local.get $we)))))
    (f32.abs (local.get $ze)))

  ;; One 76-byte GL vertex at $src into clip record $k: transformed, texture
  ;; matrix applied, lit or its colour copied. Returns 1 when it is on the
  ;; inside of the near plane, | 2 when on the inside of the far one.
  (func $gl_sw_xform_vertex (param $mvp i32) (param $src i32) (param $k i32) (result i32)
    (local $clip i32) (local $tmp i32) (local $bits i32)
    (local.set $tmp (i32.add (global.get $gl_sw_scratch) (i32.const 64)))
    ;; (x, y, z, w): w is 1 except for projective vertices (glVertex4f/4fv),
    ;; and the clip and divide below are already homogeneous.
    (call $gl_mtx_set4 (local.get $tmp)
      (f32.load (local.get $src))
      (f32.load offset=4 (local.get $src))
      (f32.load offset=8 (local.get $src))
      (f32.load offset=56 (local.get $src)))
    (local.set $clip (call $gl_sw_clip_at (local.get $k)))
    (call $gl_mtx_transform4 (local.get $clip) (local.get $mvp) (local.get $tmp))
    (f32.store offset=56 (local.get $clip) (call $gl_sw_eye_distance (local.get $tmp)))
    (f32.store offset=16 (local.get $clip) (f32.load offset=28 (local.get $src)))
    (f32.store offset=20 (local.get $clip) (f32.load offset=32 (local.get $src)))
    (if (global.get $gl_sw_sphere)
      (then (call $gl_sw_sphere_map (local.get $src) (local.get $clip))))
    ;; Without a texture matrix Q is the vertex's own q (vertex +64: 1 unless
    ;; glTexCoord4f set it); with one, the matrix takes the full (s, t, r, q).
    (f32.store offset=48 (local.get $clip) (f32.load offset=64 (local.get $src)))
    (if (global.get $gl_sw_texmtx)
      (then (call $gl_sw_tex_transform_homogeneous (global.get $gl_sw_texmtx)
        (i32.add (local.get $clip) (i32.const 16))
        (i32.add (local.get $clip) (i32.const 48))
        (f32.load offset=60 (local.get $src)) (f32.load offset=64 (local.get $src)))))
    ;; Unit 1's S/T (vertex +48) and Q (r, q at +68, +72) ride in the clip
    ;; record, so clipping interpolates all three with everything else.
    (f32.store offset=40 (local.get $clip) (f32.load offset=48 (local.get $src)))
    (f32.store offset=44 (local.get $clip) (f32.load offset=52 (local.get $src)))
    (f32.store offset=52 (local.get $clip) (f32.load offset=72 (local.get $src)))
    (if (global.get $gl_sw_texmtx1)
      (then (call $gl_sw_tex_transform_homogeneous (global.get $gl_sw_texmtx1)
        (i32.add (local.get $clip) (i32.const 40))
        (i32.add (local.get $clip) (i32.const 52))
        (f32.load offset=68 (local.get $src)) (f32.load offset=72 (local.get $src)))))
    (if (global.get $gl_sw_lit)
      (then (call $gl_sw_light_vertex (local.get $src) (i32.add (local.get $clip) (i32.const 24))))
      (else (call $memcpy (i32.add (local.get $clip) (i32.const 24))
        (i32.add (local.get $src) (i32.const 12)) (i32.const 16))))
    (if (f32.ge (call $gl_sw_near_d (local.get $clip)) (f32.const 0))
      (then (local.set $bits (i32.const 1))))
    (if (f32.ge (call $gl_sw_plane_d (local.get $clip) (i32.const 1)) (f32.const 0))
      (then (local.set $bits (i32.or (local.get $bits) (i32.const 2)))))
    (local.get $bits))

  ;; ---- triangles ----------------------------------------------------------
  ;; One triangle: three 60-byte GL vertices starting at $v0. Transformed to
  ;; clip space, clipped against the near plane, and fanned out to $gl_sw_emit.
  ;; Without the clip, a triangle with a vertex behind the eye had to be
  ;; dropped whole (dividing by a negative w mirrors it about the origin), and
  ;; Half-Life's corridor lost a wedge of floor at every step.
  (func $gl_sw_triangle (param $mvp i32) (param $vp i32) (param $v0 i32)
    (local $k i32) (local $bits i32)
    (local $inside i32) (local $n i32)
    (local $far_in i32) (local $poly i32)
    (local.set $k (i32.const 0))
    (loop $lp
      (local.set $bits (call $gl_sw_xform_vertex (local.get $mvp)
        (i32.add (local.get $v0) (i32.mul (local.get $k) (i32.const 76))) (local.get $k)))
      (if (i32.and (local.get $bits) (i32.const 1))
        (then (local.set $inside (i32.or (local.get $inside)
          (i32.shl (i32.const 1) (local.get $k))))))
      (if (i32.and (local.get $bits) (i32.const 2))
        (then (local.set $far_in (i32.or (local.get $far_in)
          (i32.shl (i32.const 1) (local.get $k))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $lp (i32.lt_u (local.get $k) (i32.const 3))))
    ;; GL_FLAT takes every colour from the provoking vertex, which for a GL
    ;; triangle is the LAST one -- decided before clipping invents vertices.
    (if (i32.eq (global.get $gl_shade_model) (i32.const 0x1D00))
      (then
        (call $memcpy (i32.add (call $gl_sw_clip_at (i32.const 0)) (i32.const 24))
          (i32.add (call $gl_sw_clip_at (i32.const 2)) (i32.const 24)) (i32.const 16))
        (call $memcpy (i32.add (call $gl_sw_clip_at (i32.const 1)) (i32.const 24))
          (i32.add (call $gl_sw_clip_at (i32.const 2)) (i32.const 24)) (i32.const 16))))
    (if (i32.and (i32.eq (local.get $inside) (i32.const 7))
                 (i32.eq (local.get $far_in) (i32.const 7)))
      (then
        (call $gl_sw_emit (local.get $vp) (call $gl_sw_clip_at (i32.const 0))
          (call $gl_sw_clip_at (i32.const 1)) (call $gl_sw_clip_at (i32.const 2)))
        (return)))
    (if (i32.or (i32.eqz (local.get $inside)) (i32.eqz (local.get $far_in)))
      (then
        (global.set $gl_sw_clipped (i32.add (global.get $gl_sw_clipped) (i32.const 1)))
        (return)))
    ;; Sutherland-Hodgman against near, then far: a triangle becomes at most
    ;; a pentagon, and every pass keeps the input winding.
    (local.set $poly (call $gl_sw_clip_at (i32.const 0)))
    (local.set $n (i32.const 3))
    (if (i32.ne (local.get $inside) (i32.const 7))
      (then
        (local.set $n (call $gl_sw_clip_pass (local.get $poly) (local.get $n)
          (call $gl_sw_poly_at (i32.const 0)) (i32.const 0)))
        (local.set $poly (call $gl_sw_poly_at (i32.const 0)))))
    (if (i32.ne (local.get $far_in) (i32.const 7))
      (then
        (local.set $n (call $gl_sw_clip_pass (local.get $poly) (local.get $n)
          (i32.add (global.get $gl_sw_scratch) (i32.const 0x680)) (i32.const 1)))
        (local.set $poly (i32.add (global.get $gl_sw_scratch) (i32.const 0x680)))))
    (local.set $k (i32.const 1))
    (block $done (loop $fan
      (br_if $done (i32.ge_s (i32.add (local.get $k) (i32.const 1)) (local.get $n)))
      (call $gl_sw_emit (local.get $vp) (local.get $poly)
        (i32.add (local.get $poly) (i32.mul (local.get $k) (i32.const 60)))
        (i32.add (local.get $poly) (i32.mul (i32.add (local.get $k) (i32.const 1)) (i32.const 60))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $fan))))

  ;; One Sutherland-Hodgman pass of the $n-gon at $src into $dst against the
  ;; near plane (z >= -w) or, with $far, the far plane (z <= w). Returns the
  ;; output count, at most $n + 1.
  (func $gl_sw_clip_pass (param $src i32) (param $n i32) (param $dst i32) (param $far i32)
      (result i32)
    (local $k i32) (local $m i32) (local $a i32) (local $b i32)
    (local $da f32) (local $db f32)
    (loop $edge
      (local.set $a (i32.add (local.get $src) (i32.mul (local.get $k) (i32.const 60))))
      (local.set $b (i32.add (local.get $src) (i32.mul
        (select (i32.const 0) (i32.add (local.get $k) (i32.const 1))
          (i32.eq (i32.add (local.get $k) (i32.const 1)) (local.get $n)))
        (i32.const 60))))
      (local.set $da (call $gl_sw_plane_d (local.get $a) (local.get $far)))
      (local.set $db (call $gl_sw_plane_d (local.get $b) (local.get $far)))
      (if (f32.ge (local.get $da) (f32.const 0))
        (then
          (call $memcpy (i32.add (local.get $dst) (i32.mul (local.get $m) (i32.const 60)))
            (local.get $a) (i32.const 60))
          (local.set $m (i32.add (local.get $m) (i32.const 1)))))
      (if (i32.ne (f32.ge (local.get $da) (f32.const 0)) (f32.ge (local.get $db) (f32.const 0)))
        (then
          (call $gl_sw_lerp_into (i32.add (local.get $dst) (i32.mul (local.get $m) (i32.const 60)))
            (local.get $a) (local.get $b)
            (f32.div (local.get $da) (f32.sub (local.get $da) (local.get $db))))
          (local.set $m (i32.add (local.get $m) (i32.const 1)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $edge (i32.lt_u (local.get $k) (local.get $n))))
    (local.get $m))

  ;; One glFog parameter. $v is the (first) value; $params is the guest
  ;; array glFogfv passed, needed for GL_FOG_COLOR's four floats, else 0.
  (func $gl_sw_fog_param (param $pname i32) (param $v f32) (param $params i32)
    (if (i32.eq (local.get $pname) (i32.const 0x0B65))          ;; GL_FOG_MODE
      (then (global.set $gl_sw_fog_mode (i32.trunc_sat_f32_s (local.get $v))) (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x0B62))          ;; GL_FOG_DENSITY
      (then (global.set $gl_sw_fog_density (local.get $v)) (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x0B63))          ;; GL_FOG_START
      (then (global.set $gl_sw_fog_start (local.get $v)) (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x0B64))          ;; GL_FOG_END
      (then (global.set $gl_sw_fog_end (local.get $v)) (return)))
    (if (i32.and (i32.eq (local.get $pname) (i32.const 0x0B66)) ;; GL_FOG_COLOR
                 (i32.ne (local.get $params) (i32.const 0)))
      (then (global.set $gl_sw_fog_color (i32.or
        (i32.or
          (i32.shl (call $gl_sw_u8 (f32.reinterpret_i32
            (call $gl32 (i32.add (local.get $params) (i32.const 12))))) (i32.const 24))
          (i32.shl (call $gl_sw_u8 (local.get $v)) (i32.const 16)))
        (i32.or
          (i32.shl (call $gl_sw_u8 (f32.reinterpret_i32
            (call $gl32 (i32.add (local.get $params) (i32.const 4))))) (i32.const 8))
          (call $gl_sw_u8 (f32.reinterpret_i32
            (call $gl32 (i32.add (local.get $params) (i32.const 8)))))))))))

  ;; GL's fog factor for eye distance $d, clamped to [0,1]: 1 is no fog.
  (func $gl_sw_fog_factor (param $d f32) (result f32)
    (local $f f32) (local $range f32)
    (if (i32.eq (global.get $gl_sw_fog_mode) (i32.const 0x2601))  ;; GL_LINEAR
      (then
        (local.set $range (f32.sub (global.get $gl_sw_fog_end) (global.get $gl_sw_fog_start)))
        (local.set $f (if (result f32) (f32.eq (local.get $range) (f32.const 0))
          (then (f32.const 1))
          (else (f32.div (f32.sub (global.get $gl_sw_fog_end) (local.get $d)) (local.get $range))))))
      (else
        (local.set $f (f32.mul (global.get $gl_sw_fog_density) (local.get $d)))
        (if (i32.eq (global.get $gl_sw_fog_mode) (i32.const 0x0801)) ;; GL_EXP2
          (then (local.set $f (f32.mul (local.get $f) (local.get $f)))))
        (local.set $f (f32.demote_f64 (call $host_math_pow (f64.const 2.718281828459045)
          (f64.promote_f32 (f32.neg (local.get $f))))))))
    (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $f))))

  ;; The span rasterizer's fog step: blend a combined fragment toward the fog
  ;; colour by the triangle's plane at (x, y). Alpha is the fragment's own.
  (func $rast_apply_fog (param $color i32) (param $x i32) (param $y i32) (result i32)
    (local $f f32)
    (local.set $f (f32.min (f32.const 1) (f32.max (f32.const 0)
      (f32.add (global.get $rast_fog_c)
        (f32.add (f32.mul (global.get $rast_fog_a) (f32.convert_i32_s (local.get $x)))
                 (f32.mul (global.get $rast_fog_b) (f32.convert_i32_s (local.get $y))))))))
    (call $d3dim_color_lerp
      (i32.or (i32.and (global.get $rast_fog_color) (i32.const 0x00FFFFFF))
              (i32.and (local.get $color) (i32.const 0xFF000000)))
      (local.get $color) (local.get $f)))

  ;; The span rasterizer's fog plane f(x, y) = a*x + b*y + c through three
  ;; screen points' fog factors (1 = unfogged), with $color the fog colour.
  ;; A degenerate triangle gets the first vertex's factor everywhere. Shared
  ;; by GL fog and D3D vertex fog (specular alpha), which have the same sense.
  (func $rast_fog_plane
    (param $x0 i32) (param $y0 i32) (param $f0 f32)
    (param $x1 i32) (param $y1 i32) (param $f1 f32)
    (param $x2 i32) (param $y2 i32) (param $f2 f32) (param $color i32)
    (call $rast_plane (local.get $x0) (local.get $y0) (local.get $f0)
      (local.get $x1) (local.get $y1) (local.get $f1)
      (local.get $x2) (local.get $y2) (local.get $f2))
    (global.set $rast_fog_a (global.get $rast_pa))
    (global.set $rast_fog_b (global.get $rast_pb))
    (global.set $rast_fog_c (global.get $rast_pc))
    (global.set $rast_fog_color (local.get $color))
    (global.set $rast_fog_on (i32.const 1)))

  ;; The plane f(x, y) = a*x + b*y + c through three screen points, into
  ;; $rast_pa/$rast_pb/$rast_pc. A degenerate triangle gets f0 everywhere.
  (func $rast_plane
    (param $x0 i32) (param $y0 i32) (param $f0 f32)
    (param $x1 i32) (param $y1 i32) (param $f1 f32)
    (param $x2 i32) (param $y2 i32) (param $f2 f32)
    (local $dx1 f32) (local $dy1 f32) (local $dx2 f32) (local $dy2 f32)
    (local $df1 f32) (local $df2 f32) (local $det f32)
    (local.set $dx1 (f32.convert_i32_s (i32.sub (local.get $x1) (local.get $x0))))
    (local.set $dy1 (f32.convert_i32_s (i32.sub (local.get $y1) (local.get $y0))))
    (local.set $dx2 (f32.convert_i32_s (i32.sub (local.get $x2) (local.get $x0))))
    (local.set $dy2 (f32.convert_i32_s (i32.sub (local.get $y2) (local.get $y0))))
    (local.set $df1 (f32.sub (local.get $f1) (local.get $f0)))
    (local.set $df2 (f32.sub (local.get $f2) (local.get $f0)))
    (local.set $det (f32.sub (f32.mul (local.get $dx1) (local.get $dy2))
                             (f32.mul (local.get $dx2) (local.get $dy1))))
    (if (f32.eq (local.get $det) (f32.const 0))
      (then
        (global.set $rast_pa (f32.const 0))
        (global.set $rast_pb (f32.const 0)))
      (else
        (global.set $rast_pa (f32.div
          (f32.sub (f32.mul (local.get $df1) (local.get $dy2)) (f32.mul (local.get $df2) (local.get $dy1)))
          (local.get $det)))
        (global.set $rast_pb (f32.div
          (f32.sub (f32.mul (local.get $dx1) (local.get $df2)) (f32.mul (local.get $dx2) (local.get $df1)))
          (local.get $det)))))
    (global.set $rast_pc (f32.sub (local.get $f0)
      (f32.add (f32.mul (global.get $rast_pa) (f32.convert_i32_s (local.get $x0)))
               (f32.mul (global.get $rast_pb) (f32.convert_i32_s (local.get $y0)))))))

  ;; The span rasterizer's texture unit 1 step at (x, y): sample unit 1 at
  ;; its perspective-divided coordinates and combine with the fragment.
  (func $rast_apply_t1 (param $color i32) (param $x i32) (param $y i32) (result i32)
    (local $fx f32) (local $fy f32) (local $q f32) (local $e i32) (local $bpp i32)
    (local.set $fx (f32.convert_i32_s (local.get $x)))
    (local.set $fy (f32.convert_i32_s (local.get $y)))
    (local.set $q (f32.add (global.get $rast_t1_qc)
      (f32.add (f32.mul (global.get $rast_t1_qa) (local.get $fx))
               (f32.mul (global.get $rast_t1_qb) (local.get $fy)))))
    (if (f32.eq (local.get $q) (f32.const 0)) (then (return (local.get $color))))
    (local.set $e (global.get $rast_t1_entry))
    (local.set $bpp (i32.load16_u offset=16 (local.get $e)))
    (call $d3dim_texture_stage_combine
      (call $gl_sw_sample_prepared
        (i32.load16_u offset=12 (local.get $e)) (i32.load16_u offset=14 (local.get $e))
        (local.get $bpp) (i32.load16_u offset=18 (local.get $e))
        (i32.load offset=20 (local.get $e)) (call $dx_surf_fmt_get (local.get $e))
        (if (result i32) (i32.eq (local.get $bpp) (i32.const 8))
          (then (call $dx_surf_pal_get (local.get $e))) (else (i32.const 0)))
        (call $dx_surf_pal_alpha (local.get $e))
        (f32.div (f32.add (global.get $rast_t1_uc)
          (f32.add (f32.mul (global.get $rast_t1_ua) (local.get $fx))
                   (f32.mul (global.get $rast_t1_ub) (local.get $fy)))) (local.get $q))
        (f32.div (f32.add (global.get $rast_t1_vc)
          (f32.add (f32.mul (global.get $rast_t1_va) (local.get $fx))
                   (f32.mul (global.get $rast_t1_vb) (local.get $fy)))) (local.get $q))
        (global.get $rast_t1_addr_u) (global.get $rast_t1_addr_v) (global.get $rast_t1_linear) (global.get $rast_t1_border))
      (local.get $color) (global.get $rast_t1_op) (global.get $rast_t1_op)))

  ;; The fog plane through the three screen records' (x, y, factor at +28).
  (func $gl_sw_fog_plane (param $s0 i32) (param $s1 i32) (param $s2 i32)
    (call $rast_fog_plane
      (i32.load (local.get $s0)) (i32.load offset=4 (local.get $s0)) (f32.load offset=28 (local.get $s0))
      (i32.load (local.get $s1)) (i32.load offset=4 (local.get $s1)) (f32.load offset=28 (local.get $s1))
      (i32.load (local.get $s2)) (i32.load offset=4 (local.get $s2)) (f32.load offset=28 (local.get $s2))
      (global.get $gl_sw_fog_color)))

  ;; One clip record's screen record, slot $k. 0 when it has no screen
  ;; position: after the near clip w is at least the near distance for any
  ;; frustum, so this is left only for projections whose near plane is not in
  ;; front of the eye, where a divide would still mirror the geometry.
  (func $gl_sw_emit_vertex (param $c i32) (param $vp i32) (param $k i32) (result i32)
    (local $out i32)
    (if (f32.le (f32.load offset=12 (local.get $c)) (f32.const 0.0001))
      (then (return (i32.const 0))))
    (local.set $out (call $gl_sw_screen_at (local.get $k)))
    (call $gl_sw_project (local.get $c) (local.get $vp) (local.get $out))
    (f32.store offset=16 (local.get $out) (f32.load offset=16 (local.get $c)))
    (f32.store offset=20 (local.get $out) (f32.load offset=20 (local.get $c)))
    ;; $gl_sw_color reads r,g,b,a at +12..+24 of a GL vertex; the clip
    ;; record keeps them twelve bytes further on.
    (i32.store offset=24 (local.get $out)
      (call $gl_sw_color (i32.add (local.get $c) (i32.const 12))))
    ;; Fog distance: the eye-space |z| the clip record carries (+56). Clip w
    ;; is the same number only under a perspective projection.
    (if (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 64))
      (then (f32.store offset=28 (local.get $out)
        (call $gl_sw_fog_factor (f32.load offset=56 (local.get $c))))))
    (i32.const 1))

  ;; ---- the raster state every primitive shares ---------------------------
  ;; Resolved once per primitive by $gl_sw_raster_state: target (the scissor
  ;; box's view when GL_SCISSOR_TEST is on), texture and its sampler flags,
  ;; packed alpha test, depth surface, and the offset screen records must be
  ;; shifted by to land in the view's own coordinates.
  (global $gl_sw_r_rt (mut i32) (i32.const 0))
  (global $gl_sw_r_tex (mut i32) (i32.const 0))
  (global $gl_sw_r_flags (mut i32) (i32.const 0))
  (global $gl_sw_r_border (mut i32) (i32.const 0))
  (global $gl_sw_r_alpha (mut i32) (i32.const 0))
  (global $gl_sw_r_zbuf (mut i32) (i32.const 0))
  (global $gl_sw_r_dx (mut i32) (i32.const 0))
  (global $gl_sw_r_dy (mut i32) (i32.const 0))

  ;; 0 when the primitive has nowhere to go: no texture surface, or a
  ;; scissor box with no area.
  (func $gl_sw_raster_state (result i32)
    (local $s i32) (local $caps i32) (local $slot i32) (local $tex i32) (local $flags i32)
    (local $zbuf i32) (local $rt i32)
    (local.set $s (global.get $gl_sw_st))
    (local.set $caps (i32.load (local.get $s)))
    ;; Texture: the bound name's surface when TEXTURE_2D is on and it has an
    ;; image, otherwise the white texel, which MODULATE reduces to the
    ;; vertex colour.
    (local.set $tex (global.get $gl_sw_white))
    (local.set $flags (i32.const 9))
    (if (i32.and (local.get $caps) (i32.const 1))
      (then
        (local.set $slot (call $gl_sw_tex_slot (i32.load offset=40 (local.get $s))))
        (if (local.get $slot)
          (then (if (i32.load (local.get $slot))
            (then
              (local.set $tex (call $dx_from_this (i32.load (local.get $slot))))
              (local.set $flags (call $gl_sw_draw_flags (local.get $slot) (i32.const 0)))))))))
    (if (i32.eqz (local.get $tex)) (then (return (i32.const 0))))
    (global.set $gl_sw_r_alpha (i32.const 0))
    (if (i32.and (i32.ne (i32.and (local.get $caps) (i32.const 4)) (i32.const 0))
                 (i32.ne (i32.load offset=12 (local.get $s)) (i32.const 8)))
      (then (global.set $gl_sw_r_alpha (i32.or (i32.load offset=12 (local.get $s))
        (i32.shl (i32.load offset=16 (local.get $s)) (i32.const 8))))))
    (if (i32.and (local.get $caps) (i32.const 8))
      (then (local.set $zbuf (global.get $gl_sw_zbuf))))
    (local.set $rt (global.get $gl_sw_rt))
    (global.set $gl_sw_r_dx (i32.const 0))
    (global.set $gl_sw_r_dy (i32.const 0))
    ;; GL_SCISSOR_TEST: draw through the box's view, in the view's own
    ;; coordinates.
    (if (i32.and (local.get $caps) (i32.const 32))
      (then
        (local.set $rt (call $gl_sw_scissor_view))
        (if (i32.eqz (local.get $rt)) (then (return (i32.const 0))))
        (if (i32.ne (local.get $rt) (global.get $gl_sw_rt))
          (then
            (if (local.get $zbuf) (then (local.set $zbuf (global.get $gl_sw_sc_zview))))
            (global.set $gl_sw_r_dx (global.get $gl_sw_sc_x))
            (global.set $gl_sw_r_dy (global.get $gl_sw_sc_y))))))
    (global.set $gl_sw_r_rt (local.get $rt))
    (global.set $gl_sw_r_tex (local.get $tex))
    (global.set $gl_sw_r_flags (local.get $flags))
    (global.set $gl_sw_r_border (call $gl_sw_draw_border (local.get $slot) (i32.const 0) (local.get $flags)))
    (global.set $gl_sw_r_zbuf (local.get $zbuf))
    (i32.const 1))

  ;; Screen records 0..$n-1 moved into the scissor view's coordinates.
  (func $gl_sw_shift_screen (param $n i32)
    (local $k i32) (local $r i32)
    (loop $shift
      (local.set $r (call $gl_sw_screen_at (local.get $k)))
      (i32.store (local.get $r) (i32.sub (i32.load (local.get $r)) (global.get $gl_sw_r_dx)))
      (i32.store offset=4 (local.get $r) (i32.sub (i32.load offset=4 (local.get $r)) (global.get $gl_sw_r_dy)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $shift (i32.lt_u (local.get $k) (local.get $n)))))

  ;; Preserve GL_CLAMP as a tagged GL enum through the shared span interface;
  ;; D3D's CLAMP means GL_CLAMP_TO_EDGE and cannot represent border taps.
  (func $gl_sw_flags_address (param $flags i32) (param $bit i32) (result i32)
    (if (i32.ne (i32.and (local.get $flags) (i32.shl (local.get $bit) (i32.const 6))) (i32.const 0))
      (then (return (i32.const 0x2900))))
    (select (i32.const 3) (i32.const 1)
      (i32.ne (i32.and (local.get $flags) (local.get $bit)) (i32.const 0))))

  (func $gl_sw_r_address (param $bit i32) (result i32)
    (call $gl_sw_flags_address (global.get $gl_sw_r_flags) (local.get $bit)))

  ;; The texture env as D3DTOP. An untextured draw modulates white by the
  ;; vertex colour whatever the env says; REPLACE on white would erase it.
  (func $gl_sw_r_env (result i32)
    (select (i32.const 4) (i32.load offset=36 (global.get $gl_sw_st))
      (i32.eq (global.get $gl_sw_r_tex) (global.get $gl_sw_white))))

  ;; One span of a line or point on row $y: columns $xa up to but not
  ;; including $xb, attributes from screen records $pa and $pb at those two
  ;; ends. Same state, same sampler, same depth and fog as a triangle's span.
  (func $gl_sw_span (param $y i32) (param $xa i32) (param $pa i32) (param $xb i32) (param $pb i32)
    (local $s i32) (local $caps i32) (local $qa f32) (local $qb f32)
    (local.set $s (global.get $gl_sw_st))
    (local.set $caps (i32.load (local.get $s)))
    (local.set $qa (f32.load offset=12 (local.get $pa)))
    (local.set $qb (f32.load offset=12 (local.get $pb)))
    (call $viewport_draw_textured_span
      (global.get $gl_sw_r_rt) (global.get $gl_sw_r_tex)
      (i32.ne (i32.and (local.get $caps) (i32.const 2)) (i32.const 0))
      (i32.load offset=4 (local.get $s)) (i32.load offset=8 (local.get $s))
      (call $gl_sw_r_address (i32.const 2)) (call $gl_sw_r_address (i32.const 4))
      (i32.and (global.get $gl_sw_r_flags) (i32.const 1))
      (call $gl_sw_r_env) (call $gl_sw_r_env)
      (i32.const 0) (global.get $gl_sw_r_alpha) (i32.const 0) (i32.const 0)
      (local.get $y)
      ;; The span interpolates u*rhw, v*rhw and rhw, and divides back.
      (local.get $xa)
      (f32.mul (f32.load offset=16 (local.get $pa)) (local.get $qa))
      (f32.mul (f32.load offset=20 (local.get $pa)) (local.get $qa))
      (local.get $qa) (i32.load offset=24 (local.get $pa)) (f32.load offset=8 (local.get $pa))
      (local.get $xb)
      (f32.mul (f32.load offset=16 (local.get $pb)) (local.get $qb))
      (f32.mul (f32.load offset=20 (local.get $pb)) (local.get $qb))
      (local.get $qb) (i32.load offset=24 (local.get $pb)) (f32.load offset=8 (local.get $pb))
      (global.get $gl_sw_r_zbuf)
      (i32.load offset=20 (local.get $s))
      (i32.load offset=24 (local.get $s))))

  ;; One clip-space triangle, already in front of the near plane: project,
  ;; cull, pick the texture and rasterize with GL's state.
  ;; Texture unit 1 for the triangle whose clip records are $c0..$c2 and
  ;; whose screen records are 0..2, when TEXTURE_2D is on there and its
  ;; binding has an image. Unit 1 with no image is skipped, as GL does.
  ;; Unit 1's texture and sampler for the primitive about to be drawn; 0 when
  ;; unit 1 is off or its binding has no image, and it is then skipped.
  (func $gl_sw_t1_bind (result i32)
    (local $caps i32) (local $slot i32) (local $flags i32)
    (local.set $caps (i32.load (global.get $gl_sw_st)))
    (if (i32.eqz (i32.and (local.get $caps) (i32.const 0x80000))) (then (return (i32.const 0))))
    (local.set $slot (call $gl_sw_tex_slot (global.get $gl_sw_other_bound)))
    (if (i32.eqz (local.get $slot)) (then (return (i32.const 0))))
    (if (i32.eqz (i32.load (local.get $slot))) (then (return (i32.const 0))))
    (global.set $rast_t1_entry (call $dx_from_this (i32.load (local.get $slot))))
    (if (i32.eqz (global.get $rast_t1_entry)) (then (return (i32.const 0))))
    (local.set $flags (call $gl_sw_draw_flags (local.get $slot) (i32.const 1)))
    (global.set $rast_t1_addr_u (call $gl_sw_flags_address (local.get $flags) (i32.const 2)))
    (global.set $rast_t1_addr_v (call $gl_sw_flags_address (local.get $flags) (i32.const 4)))
    (global.set $rast_t1_border (call $gl_sw_draw_border (local.get $slot) (i32.const 1) (local.get $flags)))
    (global.set $rast_t1_linear (i32.and (local.get $flags) (i32.const 1)))
    (global.set $rast_t1_op (select (i32.const 2) (i32.const 4)
      (i32.ne (i32.and (local.get $caps) (i32.const 0x100000)) (i32.const 0))))
    (i32.const 1))

  ;; Unit 1 along the line from screen record 0 to 1 (clip records $a, $b),
  ;; or at the single point in screen record 0 when $b is 0. Each plane is
  ;; constant across the line and runs along it -- the plane $gl_sw_fog_line
  ;; builds -- over S*rhw, T*rhw and Q*rhw, so the span's per-pixel
  ;; S/Q, T/Q is perspective-correct and projective along the line.
  (func $gl_sw_t1_line_setup (param $a i32) (param $b i32)
    (local $s0 i32) (local $s1 i32) (local $qa f32) (local $qb f32)
    (if (i32.eqz (call $gl_sw_t1_bind)) (then (return)))
    (local.set $s0 (call $gl_sw_screen_at (i32.const 0)))
    (local.set $qa (f32.load offset=12 (local.get $s0)))
    (if (local.get $b)
      (then
        (local.set $s1 (call $gl_sw_screen_at (i32.const 1)))
        (local.set $qb (f32.load offset=12 (local.get $s1))))
      (else (local.set $b (local.get $a)) (local.set $s1 (local.get $s0)) (local.set $qb (local.get $qa))))
    (call $gl_sw_line_plane (local.get $s0) (local.get $s1)
      (f32.mul (f32.load offset=52 (local.get $a)) (local.get $qa))
      (f32.mul (f32.load offset=52 (local.get $b)) (local.get $qb)))
    (global.set $rast_t1_qa (global.get $rast_pa))
    (global.set $rast_t1_qb (global.get $rast_pb))
    (global.set $rast_t1_qc (global.get $rast_pc))
    (call $gl_sw_line_plane (local.get $s0) (local.get $s1)
      (f32.mul (f32.load offset=40 (local.get $a)) (local.get $qa))
      (f32.mul (f32.load offset=40 (local.get $b)) (local.get $qb)))
    (global.set $rast_t1_ua (global.get $rast_pa))
    (global.set $rast_t1_ub (global.get $rast_pb))
    (global.set $rast_t1_uc (global.get $rast_pc))
    (call $gl_sw_line_plane (local.get $s0) (local.get $s1)
      (f32.mul (f32.load offset=44 (local.get $a)) (local.get $qa))
      (f32.mul (f32.load offset=44 (local.get $b)) (local.get $qb)))
    (global.set $rast_t1_va (global.get $rast_pa))
    (global.set $rast_t1_vb (global.get $rast_pb))
    (global.set $rast_t1_vc (global.get $rast_pc))
    (global.set $rast_t1_on (i32.const 1)))

  ;; The plane through screen records $sa and $sb with values $va, $vb there:
  ;; its gradient runs along the segment and it is flat across it. One
  ;; record, or two at the same pixel, give the constant $va.
  (func $gl_sw_line_plane (param $sa i32) (param $sb i32) (param $va f32) (param $vb f32)
    (local $dx f32) (local $dy f32) (local $l2 f32) (local $dv f32)
    (local.set $dx (f32.convert_i32_s (i32.sub (i32.load (local.get $sb)) (i32.load (local.get $sa)))))
    (local.set $dy (f32.convert_i32_s (i32.sub (i32.load offset=4 (local.get $sb)) (i32.load offset=4 (local.get $sa)))))
    (local.set $l2 (f32.add (f32.mul (local.get $dx) (local.get $dx)) (f32.mul (local.get $dy) (local.get $dy))))
    (local.set $dv (f32.sub (local.get $vb) (local.get $va)))
    (if (f32.eq (local.get $l2) (f32.const 0))
      (then
        (global.set $rast_pa (f32.const 0))
        (global.set $rast_pb (f32.const 0)))
      (else
        (global.set $rast_pa (f32.div (f32.mul (local.get $dv) (local.get $dx)) (local.get $l2)))
        (global.set $rast_pb (f32.div (f32.mul (local.get $dv) (local.get $dy)) (local.get $l2)))))
    (global.set $rast_pc (f32.sub (local.get $va)
      (f32.add (f32.mul (global.get $rast_pa) (f32.convert_i32_s (i32.load (local.get $sa))))
               (f32.mul (global.get $rast_pb) (f32.convert_i32_s (i32.load offset=4 (local.get $sa))))))))

  (func $gl_sw_t1_setup (param $c0 i32) (param $c1 i32) (param $c2 i32)
    (local $s0 i32) (local $s1 i32) (local $s2 i32)
    (local $q0 f32) (local $q1 f32) (local $q2 f32)
    (if (i32.eqz (call $gl_sw_t1_bind)) (then (return)))
    (local.set $s0 (call $gl_sw_screen_at (i32.const 0)))
    (local.set $s1 (call $gl_sw_screen_at (i32.const 1)))
    (local.set $s2 (call $gl_sw_screen_at (i32.const 2)))
    (local.set $q0 (f32.load offset=12 (local.get $s0)))
    (local.set $q1 (f32.load offset=12 (local.get $s1)))
    (local.set $q2 (f32.load offset=12 (local.get $s2)))
    (call $rast_plane
      (i32.load (local.get $s0)) (i32.load offset=4 (local.get $s0))
      (f32.mul (f32.load offset=52 (local.get $c0)) (local.get $q0))
      (i32.load (local.get $s1)) (i32.load offset=4 (local.get $s1))
      (f32.mul (f32.load offset=52 (local.get $c1)) (local.get $q1))
      (i32.load (local.get $s2)) (i32.load offset=4 (local.get $s2))
      (f32.mul (f32.load offset=52 (local.get $c2)) (local.get $q2)))
    (global.set $rast_t1_qa (global.get $rast_pa))
    (global.set $rast_t1_qb (global.get $rast_pb))
    (global.set $rast_t1_qc (global.get $rast_pc))
    (call $rast_plane
      (i32.load (local.get $s0)) (i32.load offset=4 (local.get $s0))
      (f32.mul (f32.load offset=40 (local.get $c0)) (local.get $q0))
      (i32.load (local.get $s1)) (i32.load offset=4 (local.get $s1))
      (f32.mul (f32.load offset=40 (local.get $c1)) (local.get $q1))
      (i32.load (local.get $s2)) (i32.load offset=4 (local.get $s2))
      (f32.mul (f32.load offset=40 (local.get $c2)) (local.get $q2)))
    (global.set $rast_t1_ua (global.get $rast_pa))
    (global.set $rast_t1_ub (global.get $rast_pb))
    (global.set $rast_t1_uc (global.get $rast_pc))
    (call $rast_plane
      (i32.load (local.get $s0)) (i32.load offset=4 (local.get $s0))
      (f32.mul (f32.load offset=44 (local.get $c0)) (local.get $q0))
      (i32.load (local.get $s1)) (i32.load offset=4 (local.get $s1))
      (f32.mul (f32.load offset=44 (local.get $c1)) (local.get $q1))
      (i32.load (local.get $s2)) (i32.load offset=4 (local.get $s2))
      (f32.mul (f32.load offset=44 (local.get $c2)) (local.get $q2)))
    (global.set $rast_t1_va (global.get $rast_pa))
    (global.set $rast_t1_vb (global.get $rast_pb))
    (global.set $rast_t1_vc (global.get $rast_pc))
    (global.set $rast_t1_on (i32.const 1)))

  ;; Mip selection for the triangle in screen records 0..2, once per face:
  ;; rho^2 is its area in level-0 texels over its area in pixels, and the
  ;; level is round(log2(rho)) -- level L once rho^2 reaches 2^(2L-1). A
  ;; missing level falls back to the deepest one uploaded below it, so a
  ;; texture with only level 0 draws as it always did. A minified face takes
  ;; MIN_FILTER's within-level filter, a magnified one MAG_FILTER's. The
  ;; choice is per face, not per pixel: a long floor in perspective gets one
  ;; level for its whole length.
  (func $gl_sw_mip_select
    (local $s i32) (local $slot i32) (local $flags i32) (local $entry i32)
    (local $r0 i32) (local $r1 i32) (local $r2 i32)
    (local $px f32) (local $tx f32) (local $ratio f32) (local $step f32)
    (local $level i32) (local $want i32) (local $obj i32)
    (if (i32.eq (global.get $gl_sw_r_tex) (global.get $gl_sw_white)) (then (return)))
    (local.set $s (global.get $gl_sw_st))
    (local.set $slot (call $gl_sw_tex_slot (i32.load offset=40 (local.get $s))))
    (if (i32.eqz (local.get $slot)) (then (return)))
    (local.set $flags (global.get $gl_sw_r_flags))
    (local.set $entry (global.get $gl_sw_r_tex))
    (local.set $r0 (call $gl_sw_screen_at (i32.const 0)))
    (local.set $r1 (call $gl_sw_screen_at (i32.const 1)))
    (local.set $r2 (call $gl_sw_screen_at (i32.const 2)))
    (local.set $px (f32.abs (f32.convert_i32_s (i32.sub
      (i32.mul (i32.sub (i32.load (local.get $r1)) (i32.load (local.get $r0)))
               (i32.sub (i32.load offset=4 (local.get $r2)) (i32.load offset=4 (local.get $r0))))
      (i32.mul (i32.sub (i32.load (local.get $r2)) (i32.load (local.get $r0)))
               (i32.sub (i32.load offset=4 (local.get $r1)) (i32.load offset=4 (local.get $r0))))))))
    (local.set $tx (f32.mul
      (f32.abs (f32.sub
        (f32.mul (f32.sub (f32.load offset=16 (local.get $r1)) (f32.load offset=16 (local.get $r0)))
                 (f32.sub (f32.load offset=20 (local.get $r2)) (f32.load offset=20 (local.get $r0))))
        (f32.mul (f32.sub (f32.load offset=16 (local.get $r2)) (f32.load offset=16 (local.get $r0)))
                 (f32.sub (f32.load offset=20 (local.get $r1)) (f32.load offset=20 (local.get $r0))))))
      (f32.convert_i32_u (i32.mul (load.field DxObject width (local.get $entry))
                                  (load.field DxObject height (local.get $entry))))))
    ;; A degenerate face has no pixels to minify into; leave it on level 0.
    (if (f32.le (local.get $px) (f32.const 0)) (then (return)))
    (local.set $ratio (f32.div (local.get $tx) (local.get $px)))
    (if (f32.le (local.get $ratio) (f32.const 1)) (then (return)))
    ;; Minified: MIN_FILTER's within-level filter replaces MAG_FILTER's.
    (global.set $gl_sw_r_flags (i32.or (i32.and (local.get $flags) (i32.const -2))
      (i32.ne (i32.and (local.get $flags) (i32.const 64)) (i32.const 0))))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 32))) (then (return)))
    (local.set $step (f32.const 2))
    (block $sized (loop $up
      (br_if $sized (f32.lt (local.get $ratio) (local.get $step)))
      (br_if $sized (i32.ge_u (local.get $want) (i32.const 12)))
      (local.set $want (i32.add (local.get $want) (i32.const 1)))
      (local.set $step (f32.mul (local.get $step) (f32.const 4)))
      (br $up)))
    (local.set $level (local.get $want))
    (block $found (loop $down
      (br_if $found (i32.eqz (local.get $level)))
      (local.set $obj (i32.load (call $gl_sw_mip_at (local.get $slot) (local.get $level))))
      (if (local.get $obj)
        (then
          (global.set $gl_sw_r_tex (call $dx_from_this (local.get $obj)))
          (br $found)))
      (local.set $level (i32.sub (local.get $level) (i32.const 1)))
      (br $down))))

  (func $gl_sw_emit (param $vp i32) (param $c0 i32) (param $c1 i32) (param $c2 i32)
    (local $s i32) (local $caps i32) (local $area i32) (local $front i32) (local $cull i32)
    (local $s0 i32) (local $s1 i32) (local $s2 i32)
    (if (i32.eqz (i32.and
          (i32.and (call $gl_sw_emit_vertex (local.get $c0) (local.get $vp) (i32.const 0))
                   (call $gl_sw_emit_vertex (local.get $c1) (local.get $vp) (i32.const 1)))
          (call $gl_sw_emit_vertex (local.get $c2) (local.get $vp) (i32.const 2))))
      (then
        (global.set $gl_sw_clipped (i32.add (global.get $gl_sw_clipped) (i32.const 1)))
        (return)))
    (local.set $s (global.get $gl_sw_st))
    (local.set $caps (i32.load (local.get $s)))
    (local.set $s0 (call $gl_sw_screen_at (i32.const 0)))
    (local.set $s1 (call $gl_sw_screen_at (i32.const 1)))
    (local.set $s2 (call $gl_sw_screen_at (i32.const 2)))
    ;; Face culling. In screen space (y down) a triangle GL calls CCW has a
    ;; negative signed area, because the y flip reverses every winding.
    (if (i32.and (local.get $caps) (i32.const 16))
      (then
        (local.set $area (i32.sub
          (i32.mul (i32.sub (i32.load (local.get $s1)) (i32.load (local.get $s0)))
                   (i32.sub (i32.load offset=4 (local.get $s2)) (i32.load offset=4 (local.get $s0))))
          (i32.mul (i32.sub (i32.load (local.get $s2)) (i32.load (local.get $s0)))
                   (i32.sub (i32.load offset=4 (local.get $s1)) (i32.load offset=4 (local.get $s0))))))
        ;; Unflipped (a bottom-up DIB), screen winding is GL's own.
        (local.set $front (i32.eq
          (i32.xor (i32.lt_s (local.get $area) (i32.const 0)) (i32.eqz (global.get $gl_sw_flip_y)))
          (i32.load offset=32 (local.get $s))))
        (local.set $cull (i32.load offset=28 (local.get $s)))
        (if (i32.or
              (i32.eq (local.get $cull) (i32.const 0x408))
              (i32.or
                (i32.and (i32.eq (local.get $cull) (i32.const 0x405)) (i32.eqz (local.get $front)))
                (i32.and (i32.eq (local.get $cull) (i32.const 0x404)) (local.get $front))))
          (then
            (global.set $gl_sw_culled (i32.add (global.get $gl_sw_culled) (i32.const 1)))
            (return)))))
    (if (i32.eqz (call $gl_sw_raster_state)) (then (return)))
    (if (i32.or (global.get $gl_sw_r_dx) (global.get $gl_sw_r_dy))
      (then (call $gl_sw_shift_screen (i32.const 3))))
    (local.set $s0 (call $gl_sw_screen_at (i32.const 0)))
    (global.set $gl_sw_triangles (i32.add (global.get $gl_sw_triangles) (i32.const 1)))
    ;; After the scissor shift, so the plane is in the coordinates the span
    ;; rasterizer will hand back.
    (if (i32.and (local.get $caps) (i32.const 64))
      (then (call $gl_sw_fog_plane (local.get $s0)
        (call $gl_sw_screen_at (i32.const 1)) (call $gl_sw_screen_at (i32.const 2)))))
    (call $gl_sw_t1_setup (local.get $c0) (local.get $c1) (local.get $c2))
    (call $gl_sw_mip_select)
    ;; Unit0's numerator remains S/w,T/w in the shared rasterizer. Its
    ;; denominator is the independent texture Q/w plane, never vertex w.
    (if (i32.or (i32.ne (global.get $gl_sw_texmtx) (i32.const 0))
          (i32.or (f32.ne (f32.load offset=48 (local.get $c0)) (f32.const 1))
            (i32.or (f32.ne (f32.load offset=48 (local.get $c1)) (f32.const 1))
              (f32.ne (f32.load offset=48 (local.get $c2)) (f32.const 1))))) (then
      (call $rast_plane
        (i32.load (local.get $s0)) (i32.load offset=4 (local.get $s0))
        (f32.mul (f32.load offset=48 (local.get $c0)) (f32.load offset=12 (local.get $s0)))
        (i32.load (local.get $s1)) (i32.load offset=4 (local.get $s1))
        (f32.mul (f32.load offset=48 (local.get $c1)) (f32.load offset=12 (local.get $s1)))
        (i32.load (local.get $s2)) (i32.load offset=4 (local.get $s2))
        (f32.mul (f32.load offset=48 (local.get $c2)) (f32.load offset=12 (local.get $s2))))
      (global.set $rast_t0_qa (global.get $rast_pa))
      (global.set $rast_t0_qb (global.get $rast_pb))
      (global.set $rast_t0_qc (global.get $rast_pc))
      (global.set $rast_t0_q_on (i32.const 1))))
    (call $rasterize_triangle_textured
      (global.get $gl_sw_r_rt) (global.get $gl_sw_r_tex)
      (i32.ne (i32.and (local.get $caps) (i32.const 2)) (i32.const 0))
      (i32.load offset=4 (local.get $s)) (i32.load offset=8 (local.get $s))
      (call $gl_sw_r_address (i32.const 2)) (call $gl_sw_r_address (i32.const 4))
      (i32.and (global.get $gl_sw_r_flags) (i32.const 1))
      (call $gl_sw_r_env) (call $gl_sw_r_env)
      (i32.const 0)                                  ;; no colour key in GL
      (global.get $gl_sw_r_alpha)
      (i32.const 0) (i32.const 0)                    ;; dither, antialias
      (i32.load (local.get $s0)) (i32.load offset=4 (local.get $s0))
      (f32.load offset=16 (local.get $s0)) (f32.load offset=20 (local.get $s0))
      (f32.load offset=12 (local.get $s0)) (i32.load offset=24 (local.get $s0))
      (f32.load offset=8 (local.get $s0))
      (i32.load (local.get $s1)) (i32.load offset=4 (local.get $s1))
      (f32.load offset=16 (local.get $s1)) (f32.load offset=20 (local.get $s1))
      (f32.load offset=12 (local.get $s1)) (i32.load offset=24 (local.get $s1))
      (f32.load offset=8 (local.get $s1))
      (i32.load (local.get $s2)) (i32.load offset=4 (local.get $s2))
      (f32.load offset=16 (local.get $s2)) (f32.load offset=20 (local.get $s2))
      (f32.load offset=12 (local.get $s2)) (i32.load offset=24 (local.get $s2))
      (f32.load offset=8 (local.get $s2))
      (global.get $gl_sw_r_zbuf)
      (i32.load offset=20 (local.get $s))
      (i32.load offset=24 (local.get $s)))
    (global.set $rast_t0_q_on (i32.const 0))
    (global.set $rast_t1_on (i32.const 0))
    (global.set $rast_fog_on (i32.const 0)))

  ;; ---- lines and points ---------------------------------------------------
  ;; A GL width or size as whole pixels, 1..64. GL rounds a non-antialiased
  ;; width to the nearest integer and never goes below one pixel.
  (func $gl_sw_pixels (param $f f32) (result i32)
    (local $n i32)
    (local.set $n (i32.trunc_sat_f32_s (f32.add (local.get $f) (f32.const 0.5))))
    (if (i32.lt_s (local.get $n) (i32.const 1)) (then (return (i32.const 1))))
    (if (i32.gt_s (local.get $n) (i32.const 64)) (then (return (i32.const 64))))
    (local.get $n))

  ;; Screen record $dst at fraction $t of the way from screen record 0 to 1.
  ;; rhw, u*rhw and v*rhw are linear in screen space, so u and v come out
  ;; perspective-correct; depth, colour and fog are lerped as the triangle
  ;; walker lerps them.
  ;; With a projective texture Q the screen records carry homogeneous S and T
  ;; (divided by nothing), and $gl_sw_line sets unit 0's Q plane along the
  ;; line, so the span divides S*rhw by Q*rhw at every pixel.
  (func $gl_sw_line_at (param $dst i32) (param $t f32)
    (local $a i32) (local $b i32) (local $qa f32) (local $qb f32) (local $q f32)
    (local.set $a (call $gl_sw_screen_at (i32.const 0)))
    (local.set $b (call $gl_sw_screen_at (i32.const 1)))
    (local.set $qa (f32.load offset=12 (local.get $a)))
    (local.set $qb (f32.load offset=12 (local.get $b)))
    (local.set $q (f32.add (local.get $qa) (f32.mul (f32.sub (local.get $qb) (local.get $qa)) (local.get $t))))
    (f32.store offset=8 (local.get $dst) (f32.add (f32.load offset=8 (local.get $a))
      (f32.mul (f32.sub (f32.load offset=8 (local.get $b)) (f32.load offset=8 (local.get $a))) (local.get $t))))
    (f32.store offset=12 (local.get $dst) (local.get $q))
    (f32.store offset=16 (local.get $dst) (f32.div
      (f32.add (f32.mul (f32.load offset=16 (local.get $a)) (local.get $qa))
        (f32.mul (f32.sub (f32.mul (f32.load offset=16 (local.get $b)) (local.get $qb))
                          (f32.mul (f32.load offset=16 (local.get $a)) (local.get $qa))) (local.get $t)))
      (local.get $q)))
    (f32.store offset=20 (local.get $dst) (f32.div
      (f32.add (f32.mul (f32.load offset=20 (local.get $a)) (local.get $qa))
        (f32.mul (f32.sub (f32.mul (f32.load offset=20 (local.get $b)) (local.get $qb))
                          (f32.mul (f32.load offset=20 (local.get $a)) (local.get $qa))) (local.get $t)))
      (local.get $q)))
    (i32.store offset=24 (local.get $dst) (call $d3dim_color_lerp
      (i32.load offset=24 (local.get $a)) (i32.load offset=24 (local.get $b)) (local.get $t))))

  ;; Fog along a line: the plane through both ends whose gradient runs along
  ;; the line and is flat across it, so a wide line is fogged by how far
  ;; along it a pixel is.
  (func $gl_sw_fog_line
    (local $a i32) (local $b i32) (local $dx f32) (local $dy f32) (local $l2 f32) (local $df f32)
    (local.set $a (call $gl_sw_screen_at (i32.const 0)))
    (local.set $b (call $gl_sw_screen_at (i32.const 1)))
    (local.set $dx (f32.convert_i32_s (i32.sub (i32.load (local.get $b)) (i32.load (local.get $a)))))
    (local.set $dy (f32.convert_i32_s (i32.sub (i32.load offset=4 (local.get $b)) (i32.load offset=4 (local.get $a)))))
    (local.set $l2 (f32.add (f32.mul (local.get $dx) (local.get $dx)) (f32.mul (local.get $dy) (local.get $dy))))
    (local.set $df (f32.sub (f32.load offset=28 (local.get $b)) (f32.load offset=28 (local.get $a))))
    (if (f32.eq (local.get $l2) (f32.const 0))
      (then
        (global.set $rast_fog_a (f32.const 0))
        (global.set $rast_fog_b (f32.const 0)))
      (else
        (global.set $rast_fog_a (f32.div (f32.mul (local.get $df) (local.get $dx)) (local.get $l2)))
        (global.set $rast_fog_b (f32.div (f32.mul (local.get $df) (local.get $dy)) (local.get $l2)))))
    (global.set $rast_fog_c (f32.sub (f32.load offset=28 (local.get $a))
      (f32.add (f32.mul (global.get $rast_fog_a) (f32.convert_i32_s (i32.load (local.get $a))))
               (f32.mul (global.get $rast_fog_b) (f32.convert_i32_s (i32.load offset=4 (local.get $a)))))))
    (global.set $rast_fog_color (global.get $gl_sw_fog_color))
    (global.set $rast_fog_on (i32.const 1)))

  ;; The steps [$lo, $hi] of a line's major axis that can touch a target
  ;; $limit pixels long, given a start of $m0, direction $dir (+1/-1), $n
  ;; steps in all and a $pad of line width. Packed $lo | $hi << 16; a line
  ;; that never reaches the target comes back with $lo > $hi.
  (func $gl_sw_step_range (param $m0 i32) (param $dir i32) (param $n i32) (param $limit i32)
      (param $pad i32) (result i32)
    (local $lo i32) (local $hi i32)
    (if (i32.gt_s (local.get $dir) (i32.const 0))
      (then
        (local.set $lo (i32.sub (i32.sub (i32.const 0) (local.get $pad)) (local.get $m0)))
        (local.set $hi (i32.sub (i32.add (local.get $limit) (local.get $pad)) (local.get $m0))))
      (else
        (local.set $lo (i32.sub (i32.sub (local.get $m0) (local.get $limit)) (local.get $pad)))
        (local.set $hi (i32.add (local.get $m0) (local.get $pad)))))
    (if (i32.lt_s (local.get $lo) (i32.const 0)) (then (local.set $lo (i32.const 0))))
    (if (i32.gt_s (local.get $hi) (i32.sub (local.get $n) (i32.const 1)))
      (then (local.set $hi (i32.sub (local.get $n) (i32.const 1)))))
    (if (i32.gt_s (local.get $lo) (local.get $hi)) (then (return (i32.const 1))))
    (i32.or (local.get $lo) (i32.shl (local.get $hi) (i32.const 16))))

  ;; One line: two 60-byte GL vertices at $v0. Clipped against the near and
  ;; far planes parametrically, projected, and walked along its major axis
  ;; with the last pixel left off -- GL's diamond-exit rule in the form that
  ;; matters, so a strip the encoder expanded into pairs does not draw each
  ;; shared vertex twice (which a blended strip would show). An x-major line
  ;; goes out as one span per run of pixels on a row, widened by repeating
  ;; the run on neighbouring rows; a y-major one as one span per row,
  ;; widened sideways.
  ;; After a line or point: no fog plane, no unit 0 Q plane, no unit 1 planes.
  (func $gl_sw_prim_done
    (global.set $rast_fog_on (i32.const 0))
    (global.set $rast_t0_q_on (i32.const 0))
    (global.set $rast_t1_on (i32.const 0)))

  (func $gl_sw_line (param $mvp i32) (param $vp i32) (param $v0 i32)
    (local $a i32) (local $b i32) (local $far i32) (local $da f32) (local $db f32)
    (local $xa i32) (local $ya i32) (local $dx i32) (local $dy i32) (local $n i32)
    (local $sx i32) (local $sy i32) (local $w i32) (local $off i32) (local $range i32)
    (local $i i32) (local $hi i32) (local $minor i32) (local $row i32) (local $run i32)
    (local $j i32) (local $c0 i32) (local $c1 i32) (local $p i32) (local $q i32)
    (local $xmajor i32) (local $col i32)
    (drop (call $gl_sw_xform_vertex (local.get $mvp) (local.get $v0) (i32.const 0)))
    (drop (call $gl_sw_xform_vertex (local.get $mvp)
      (i32.add (local.get $v0) (i32.const 76)) (i32.const 1)))
    ;; GL_FLAT: a line's provoking vertex is its second.
    (if (i32.eq (global.get $gl_shade_model) (i32.const 0x1D00))
      (then (call $memcpy (i32.add (call $gl_sw_clip_at (i32.const 0)) (i32.const 24))
        (i32.add (call $gl_sw_clip_at (i32.const 1)) (i32.const 24)) (i32.const 16))))
    (local.set $a (call $gl_sw_clip_at (i32.const 0)))
    (local.set $b (call $gl_sw_clip_at (i32.const 1)))
    (loop $plane
      (local.set $da (call $gl_sw_plane_d (local.get $a) (local.get $far)))
      (local.set $db (call $gl_sw_plane_d (local.get $b) (local.get $far)))
      (if (i32.and (f32.lt (local.get $da) (f32.const 0)) (f32.lt (local.get $db) (f32.const 0)))
        (then
          (global.set $gl_sw_clipped (i32.add (global.get $gl_sw_clipped) (i32.const 1)))
          (return)))
      (if (f32.lt (local.get $da) (f32.const 0))
        (then
          (call $gl_sw_lerp_into (call $gl_sw_poly_at (i32.const 0)) (local.get $a) (local.get $b)
            (f32.div (local.get $da) (f32.sub (local.get $da) (local.get $db))))
          (local.set $a (call $gl_sw_poly_at (i32.const 0)))))
      (if (f32.lt (local.get $db) (f32.const 0))
        (then
          (call $gl_sw_lerp_into (call $gl_sw_poly_at (i32.const 1)) (local.get $b) (local.get $a)
            (f32.div (local.get $db) (f32.sub (local.get $db) (local.get $da))))
          (local.set $b (call $gl_sw_poly_at (i32.const 1)))))
      (local.set $far (i32.add (local.get $far) (i32.const 1)))
      (br_if $plane (i32.lt_u (local.get $far) (i32.const 2))))
    (if (i32.eqz (i32.and
          (call $gl_sw_emit_vertex (local.get $a) (local.get $vp) (i32.const 0))
          (call $gl_sw_emit_vertex (local.get $b) (local.get $vp) (i32.const 1))))
      (then
        (global.set $gl_sw_clipped (i32.add (global.get $gl_sw_clipped) (i32.const 1)))
        (return)))
    (if (i32.eqz (call $gl_sw_raster_state)) (then (return)))
    (if (i32.or (global.get $gl_sw_r_dx) (global.get $gl_sw_r_dy))
      (then (call $gl_sw_shift_screen (i32.const 2))))
    (global.set $gl_sw_lines (i32.add (global.get $gl_sw_lines) (i32.const 1)))
    (if (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 64))
      (then (call $gl_sw_fog_line)))
    ;; Unit 0's texture Q (clip +48, after clipping) as a plane along the
    ;; line over Q*rhw: the span's per-pixel denominator. Q = 1 at both ends
    ;; is the plain perspective divide, and needs no plane.
    (if (i32.or (f32.ne (f32.load offset=48 (local.get $a)) (f32.const 1))
                (f32.ne (f32.load offset=48 (local.get $b)) (f32.const 1)))
      (then
        (call $gl_sw_line_plane (call $gl_sw_screen_at (i32.const 0)) (call $gl_sw_screen_at (i32.const 1))
          (f32.mul (f32.load offset=48 (local.get $a)) (f32.load offset=12 (call $gl_sw_screen_at (i32.const 0))))
          (f32.mul (f32.load offset=48 (local.get $b)) (f32.load offset=12 (call $gl_sw_screen_at (i32.const 1)))))
        (global.set $rast_t0_qa (global.get $rast_pa))
        (global.set $rast_t0_qb (global.get $rast_pb))
        (global.set $rast_t0_qc (global.get $rast_pc))
        (global.set $rast_t0_q_on (i32.const 1))))
    (call $gl_sw_t1_line_setup (local.get $a) (local.get $b))
    (local.set $xa (i32.load (call $gl_sw_screen_at (i32.const 0))))
    (local.set $ya (i32.load offset=4 (call $gl_sw_screen_at (i32.const 0))))
    (local.set $dx (i32.sub (i32.load (call $gl_sw_screen_at (i32.const 1))) (local.get $xa)))
    (local.set $dy (i32.sub (i32.load offset=4 (call $gl_sw_screen_at (i32.const 1))) (local.get $ya)))
    (local.set $sx (select (i32.const -1) (i32.const 1) (i32.lt_s (local.get $dx) (i32.const 0))))
    (local.set $sy (select (i32.const -1) (i32.const 1) (i32.lt_s (local.get $dy) (i32.const 0))))
    (local.set $xmajor (i32.ge_s (i32.mul (local.get $dx) (local.get $sx))
                                 (i32.mul (local.get $dy) (local.get $sy))))
    (local.set $n (select (i32.mul (local.get $dx) (local.get $sx))
                          (i32.mul (local.get $dy) (local.get $sy)) (local.get $xmajor)))
    ;; Zero length: the diamond-exit rule leaves it with no pixels at all.
    (if (i32.eqz (local.get $n)) (then (call $gl_sw_prim_done) (return)))
    (local.set $w (call $gl_sw_pixels (global.get $gl_sw_line_width)))
    (local.set $off (i32.shr_s (i32.sub (local.get $w) (i32.const 1)) (i32.const 1)))
    (local.set $p (call $gl_sw_screen_at (i32.const 2)))
    (local.set $q (call $gl_sw_screen_at (i32.const 3)))
    (local.set $range (if (result i32) (local.get $xmajor)
      (then (call $gl_sw_step_range (local.get $xa) (local.get $sx) (local.get $n)
        (load.field DxObject width (global.get $gl_sw_r_rt)) (local.get $w)))
      (else (call $gl_sw_step_range (local.get $ya) (local.get $sy) (local.get $n)
        (load.field DxObject height (global.get $gl_sw_r_rt)) (local.get $w)))))
    (local.set $i (i32.and (local.get $range) (i32.const 0xFFFF)))
    (local.set $hi (i32.shr_u (local.get $range) (i32.const 16)))
    (if (i32.gt_s (local.get $i) (local.get $hi))
      (then (call $gl_sw_prim_done) (return)))
    (if (local.get $xmajor)
      (then
        ;; Runs: step $run is where the current row's run started.
        (local.set $run (local.get $i))
        (local.set $row (i32.add (local.get $ya) (call $gl_sw_coord (f32.div
          (f32.convert_i32_s (i32.mul (local.get $i) (local.get $dy)))
          (f32.convert_i32_s (local.get $n))))))
        (loop $step
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (if (i32.le_s (local.get $i) (local.get $hi))
            (then (local.set $minor (i32.add (local.get $ya) (call $gl_sw_coord (f32.div
              (f32.convert_i32_s (i32.mul (local.get $i) (local.get $dy)))
              (f32.convert_i32_s (local.get $n))))))))
          (if (i32.or (i32.gt_s (local.get $i) (local.get $hi))
                      (i32.ne (local.get $minor) (local.get $row)))
            (then
              ;; Steps $run .. $i-1 are on $row: columns from the lower of
              ;; the two ends to one past the higher.
              (local.set $c0 (i32.add (local.get $xa) (i32.mul (local.get $run) (local.get $sx))))
              (local.set $c1 (i32.add (local.get $xa)
                (i32.mul (i32.sub (local.get $i) (i32.const 1)) (local.get $sx))))
              (if (i32.gt_s (local.get $c0) (local.get $c1))
                (then (local.set $j (local.get $c0)) (local.set $c0 (local.get $c1)) (local.set $c1 (local.get $j))))
              (local.set $c1 (i32.add (local.get $c1) (i32.const 1)))
              (call $gl_sw_line_at (local.get $p) (f32.div
                (f32.convert_i32_s (i32.sub (local.get $c0) (local.get $xa))) (f32.convert_i32_s (local.get $dx))))
              (call $gl_sw_line_at (local.get $q) (f32.div
                (f32.convert_i32_s (i32.sub (local.get $c1) (local.get $xa))) (f32.convert_i32_s (local.get $dx))))
              (local.set $j (i32.const 0))
              (loop $thick
                (call $gl_sw_span (i32.add (i32.sub (local.get $row) (local.get $off)) (local.get $j))
                  (local.get $c0) (local.get $p) (local.get $c1) (local.get $q))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br_if $thick (i32.lt_s (local.get $j) (local.get $w))))
              (local.set $run (local.get $i))
              (local.set $row (local.get $minor))))
          (br_if $step (i32.le_s (local.get $i) (local.get $hi)))))
      (else
        (loop $step
          (local.set $row (i32.add (local.get $ya) (i32.mul (local.get $i) (local.get $sy))))
          (local.set $col (i32.add (local.get $xa) (call $gl_sw_coord (f32.div
            (f32.convert_i32_s (i32.mul (local.get $i) (local.get $dx)))
            (f32.convert_i32_s (local.get $n))))))
          (call $gl_sw_line_at (local.get $p) (f32.div
            (f32.convert_i32_s (local.get $i)) (f32.convert_i32_s (local.get $n))))
          (call $gl_sw_span (local.get $row)
            (i32.sub (local.get $col) (local.get $off)) (local.get $p)
            (i32.add (i32.sub (local.get $col) (local.get $off)) (local.get $w)) (local.get $p))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $step (i32.le_s (local.get $i) (local.get $hi))))))
    (call $gl_sw_prim_done))

  ;; One point: a square of glPointSize pixels centred on the vertex, every
  ;; pixel taking the vertex's colour, depth and texture coordinate.
  (func $gl_sw_point (param $mvp i32) (param $vp i32) (param $v0 i32)
    (local $r i32) (local $x i32) (local $y i32) (local $size i32) (local $off i32) (local $j i32)
    (if (i32.ne (call $gl_sw_xform_vertex (local.get $mvp) (local.get $v0) (i32.const 0)) (i32.const 3))
      (then
        (global.set $gl_sw_clipped (i32.add (global.get $gl_sw_clipped) (i32.const 1)))
        (return)))
    (if (i32.eqz (call $gl_sw_emit_vertex (call $gl_sw_clip_at (i32.const 0)) (local.get $vp) (i32.const 0)))
      (then
        (global.set $gl_sw_clipped (i32.add (global.get $gl_sw_clipped) (i32.const 1)))
        (return)))
    (if (i32.eqz (call $gl_sw_raster_state)) (then (return)))
    (if (i32.or (global.get $gl_sw_r_dx) (global.get $gl_sw_r_dy))
      (then (call $gl_sw_shift_screen (i32.const 1))))
    (global.set $gl_sw_points (i32.add (global.get $gl_sw_points) (i32.const 1)))
    (local.set $r (call $gl_sw_screen_at (i32.const 0)))
    ;; A point has one texture sample: unit 0's S/Q, T/Q exactly, and unit
    ;; 1's from constant planes.
    (if (f32.ne (f32.load offset=48 (call $gl_sw_clip_at (i32.const 0))) (f32.const 0))
      (then
        (f32.store offset=16 (local.get $r) (f32.div (f32.load offset=16 (local.get $r))
          (f32.load offset=48 (call $gl_sw_clip_at (i32.const 0)))))
        (f32.store offset=20 (local.get $r) (f32.div (f32.load offset=20 (local.get $r))
          (f32.load offset=48 (call $gl_sw_clip_at (i32.const 0)))))))
    (call $gl_sw_t1_line_setup (call $gl_sw_clip_at (i32.const 0)) (i32.const 0))
    (if (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 64))
      (then
        (global.set $rast_fog_a (f32.const 0))
        (global.set $rast_fog_b (f32.const 0))
        (global.set $rast_fog_c (f32.load offset=28 (local.get $r)))
        (global.set $rast_fog_color (global.get $gl_sw_fog_color))
        (global.set $rast_fog_on (i32.const 1))))
    (local.set $size (call $gl_sw_pixels (global.get $gl_sw_point_size)))
    (local.set $off (i32.shr_s (i32.sub (local.get $size) (i32.const 1)) (i32.const 1)))
    (local.set $x (i32.sub (i32.load (local.get $r)) (local.get $off)))
    (local.set $y (i32.sub (i32.load offset=4 (local.get $r)) (local.get $off)))
    (loop $rows
      (call $gl_sw_span (i32.add (local.get $y) (local.get $j))
        (local.get $x) (local.get $r) (i32.add (local.get $x) (local.get $size)) (local.get $r))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br_if $rows (i32.lt_s (local.get $j) (local.get $size))))
    (call $gl_sw_prim_done))

  ;; Called from $gl_packed_finish once a packed draw record is complete.
  ;; That is the one funnel every immediate-mode and vertex-array path goes
  ;; through, and by the time it runs the topology has already been expanded
  ;; down to points, lines and triangles.
  (func $gl_sw_consume (param $start i32) (param $vertices i32)
    (local $mode i32) (local $step i32)
    (if (i32.eqz (global.get $gl_sw_enabled)) (then (return)))
    ;; The encoder has already expanded strips, loops and fans: mode 0 is
    ;; single points, 1 separate lines, 4 separate triangles.
    (local.set $mode (i32.load offset=8 (local.get $start)))
    (if (i32.eq (local.get $mode) (i32.const 0x10000)) (then
      (call $gl_bitmap_sw_draw (local.get $start) (local.get $vertices)) (return)))
    (local.set $step (if (result i32) (i32.eqz (local.get $mode))
      (then (i32.const 1))
      (else (if (result i32) (i32.eq (local.get $mode) (i32.const 1))
        (then (i32.const 2))
        (else (if (result i32) (i32.eq (local.get $mode) (i32.const 4))
          (then (i32.const 3))
          (else (i32.const 0))))))))
    (if (i32.eqz (local.get $step)) (then (return)))
    (if (i32.lt_u (local.get $vertices) (local.get $step)) (then (return)))
    ;; State we know we failed to track produces a confident wrong picture;
    ;; refusing is the same contract $gl_dfx1_transform holds to.
    (if (call $gl_mtx_export_untrusted) (then (return)))
    (if (i32.eqz (call $gl_sw_target)) (then (return)))
    (if (i32.eqz (call $gl_stencil_prepare)) (then (return)))
    ;; With a render Worker attached the draw is queued there; otherwise
    ;; anything already queued must land first, since this draws in place.
    (if (call $gl_sw_worker_try (local.get $start) (local.get $vertices))
      (then (return)))
    (call $d3dim_worker_fence)
    (call $gl_sw_draw (local.get $start) (local.get $vertices) (local.get $step)))

  ;; The draw itself, from a complete packed record. Everything it reads is
  ;; either shared and fenced before the guest changes it (surfaces, texture
  ;; slots, mips) or reached through $gl_sw_st, $gl_sw_scratch and
  ;; $gl_mtx_block, which a render Worker points at its own copy.
  (func $gl_sw_draw (param $start i32) (param $vertices i32) (param $step i32)
    (local $b i32) (local $mvp i32) (local $vp i32) (local $i i32) (local $base i32)
    (local $v i32)
    (global.set $rast_stencil_state (call $gl_stencil_state))
    (global.set $rast_color_mask (call $gl_color_mask_bits (global.get $gl_sw_rt)))
    (if (global.get $rast_stencil_state) (then
      (if (i32.eqz (i32.load (global.get $rast_stencil_state)))
        (then (global.set $rast_stencil_state (i32.const 0))))))
    (local.set $b (call $gl_mtx_block))
    (local.set $mvp (global.get $gl_sw_scratch))
    ;; Stacks BY NAME -- 0 modelview, 1 projection -- and not "the current
    ;; matrix", which is correct only for as long as an app happens to leave
    ;; GL_MODELVIEW selected.
    (call $gl_mtx_mul_into (local.get $mvp)
      (call $gl_mtx_stack_top (local.get $b) (i32.const 1))
      (call $gl_mtx_stack_top (local.get $b) (i32.const 0)))
    (global.set $gl_sw_mv (call $gl_mtx_stack_top (local.get $b) (i32.const 0)))
    (global.set $gl_sw_lit (i32.ne (i32.and (i32.load (global.get $gl_sw_st))
      (i32.const 128)) (i32.const 0)))
    (global.set $gl_sw_sphere (i32.and
      (i32.eq (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 0x60000)) (i32.const 0x60000))
      (i32.eq (global.get $gl_sw_texgen_modes) (i32.const 0x24022402))))  ;; SPHERE_MAP x2
    ;; The normal matrix serves lighting and the sphere map alike.
    (if (i32.or (global.get $gl_sw_lit) (global.get $gl_sw_sphere))
      (then (call $gl_sw_light_setup (local.get $b))))
    ;; Texture unit 0's matrix (stack 2). WC3 loads one every frame to
    ;; scroll and scale its sky; identity is the common case and costs nothing.
    (global.set $gl_sw_texmtx (call $gl_mtx_stack_top (local.get $b) (i32.const 2)))
    (if (call $gl_sw_mtx_is_identity (global.get $gl_sw_texmtx))
      (then (global.set $gl_sw_texmtx (i32.const 0))))
    (global.set $gl_sw_texmtx1 (call $gl_mtx_stack_top (local.get $b) (i32.const 3)))
    (if (call $gl_sw_mtx_is_identity (global.get $gl_sw_texmtx1))
      (then (global.set $gl_sw_texmtx1 (i32.const 0))))
    (local.set $vp (call $gl_mtx_export_viewport_ptr))
    ;; No glViewport yet: GL's default is the whole drawable.
    (if (i32.or (i32.le_s (i32.load offset=8 (local.get $vp)) (i32.const 0))
                (i32.le_s (i32.load offset=12 (local.get $vp)) (i32.const 0)))
      (then
        (local.set $vp (i32.add (global.get $gl_sw_scratch) (i32.const 0x300)))
        (i32.store (local.get $vp) (i32.const 0))
        (i32.store offset=4 (local.get $vp) (i32.const 0))
        (i32.store offset=8 (local.get $vp) (global.get $gl_sw_default_w))
        (i32.store offset=12 (local.get $vp) (global.get $gl_sw_default_h))))
    (local.set $base (i32.add (local.get $start) (i32.const 32)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.gt_u (i32.add (local.get $i) (local.get $step)) (local.get $vertices)))
      (local.set $v (i32.add (local.get $base) (i32.mul (local.get $i) (i32.const 76))))
      (if (i32.eq (local.get $step) (i32.const 3))
        (then (call $gl_sw_triangle (local.get $mvp) (local.get $vp) (local.get $v)))
        (else (if (i32.eq (local.get $step) (i32.const 2))
          (then (call $gl_sw_line (local.get $mvp) (local.get $vp) (local.get $v)))
          (else (call $gl_sw_point (local.get $mvp) (local.get $vp) (local.get $v))))))
      (local.set $i (i32.add (local.get $i) (local.get $step)))
      (br $lp)))
    (global.set $rast_stencil_state (i32.const 0))
    (global.set $rast_color_mask (i32.const -1)))

  ;; ---- render Worker -------------------------------------------------------
  ;; With a D3D render Worker attached (--d3d-worker, and Threads mode in the
  ;; browser) a draw is queued there instead of rasterized here, exactly as
  ;; D3DIM's are: the guest runs on while the Worker draws. The record is a
  ;; 1092-byte snapshot of everything $gl_sw_draw reads that the guest may
  ;; change before the Worker gets to it, then the packed draw record itself:
  ;;   +0    state block (+0..+63 of $gl_sw_st)
  ;;   +64   top of each matrix stack, 0..3, 64 bytes each
  ;;   +320  lights and material, block +8352..+8960
  ;;   +928  viewport and depth range, block +9008..+9032
  ;;   +952  rt, zbuf, flip_y, white, fog mode, density, start, end, colour,
  ;;         point size, line width, texgen modes, shade model, default w, h,
  ;;         scissor view, depth view, unit 1's bound name
  ;;   +1024 the sampling flags of unit 0's and unit 1's bound textures, so
  ;;         glTexParameter between draws needs no fence
  ;;   +1032 resolved border colors for both units, independent of later setters
  ;; What it does not copy is shared and fenced before the guest changes it:
  ;; surfaces (clear, swap, resize), texture slots and mips (every upload,
  ;; parameter and delete). A DIB target is never queued: GDI reads those bits
  ;; whenever it likes, with no fence to stop it.
  (global $gl_sw_in_worker (mut i32) (i32.const 0))
  ;; 0 not yet known, 1 a Worker took the last draw, 2 none took one this
  ;; frame -- don't build another snapshot until the next SwapBuffers.
  (global $gl_sw_worker_ok (mut i32) (i32.const 0))
  (global $gl_sw_snap (mut i32) (i32.const 0))
  ;; The Worker's own scissor views: it refills a view per draw, and must not
  ;; refill the one a guest-side glClear is using.
  (global $gl_sw_wk_view (mut i32) (i32.const 0))
  (global $gl_sw_wk_zview (mut i32) (i32.const 0))
  (global $gl_sw_wk_block (mut i32) (i32.const 0))
  (global $gl_sw_wk_flags0 (mut i32) (i32.const 0))
  (global $gl_sw_wk_flags1 (mut i32) (i32.const 0))
  (global $gl_sw_wk_border0 (mut i32) (i32.const 0))
  (global $gl_sw_wk_border1 (mut i32) (i32.const 0))

  ;; The sampling flags a draw uses for texture unit $unit's slot: the live
  ;; slot's on the guest thread, the queued draw's own copy in the Worker.
  (func $gl_sw_draw_flags (param $slot i32) (param $unit i32) (result i32)
    (if (global.get $gl_sw_in_worker)
      (then (return (select (global.get $gl_sw_wk_flags1) (global.get $gl_sw_wk_flags0)
        (local.get $unit)))))
    (call $gl_sw_tex_flags (local.get $slot)))

  ;; glTexSubImage2D while draws are in flight: those draws must still sample
  ;; the old texels, so rather than wait for them, convert the rectangle here
  ;; into a staging block and queue the copy into $entry behind them (0x20006,
  ;; a descriptor of staging, bytes, entry, x, y, w, h). Result 1 when queued;
  ;; 0 leaves the caller to fence and store synchronously.
  (global $gl_sw_tex_stage (mut i32) (i32.const 0))
  (func $gl_sw_worker_tex (param $entry i32) (param $x i32) (param $y i32)
      (param $w i32) (param $h i32) (param $format i32) (param $pixels i32)
      (param $opaque i32) (result i32)
    (local $bytes i32) (local $d i32) (local $g i32)
    (if (i32.eqz (global.get $d3dim_worker_pending)) (then (return (i32.const 0))))
    (if (i32.ne (global.get $gl_sw_worker_ok) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0)) (i32.le_s (local.get $h) (i32.const 0)))
      (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $w) (i32.const 1024)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $h) (i32.const 1024)) (then (return (i32.const 0))))
    (local.set $bytes (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2)))
    ;; 1MB of texels: a 512x512 rectangle, far above any per-frame upload.
    (if (i32.gt_u (local.get $bytes) (i32.const 0x100000)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $gl_sw_tex_stage)) (then
      (local.set $g (call $gl_alloc_affine (i32.const 0x100020)))
      (if (i32.eqz (local.get $g)) (then (return (i32.const 0))))
      (global.set $gl_sw_tex_stage (call $g2w (local.get $g)))))
    ;; Staging is the rectangle alone, pitch w*4, clipped as the texture is.
    (call $gl_sw_tex_store_to
      (i32.sub (global.get $gl_sw_tex_stage)
        (i32.add (i32.mul (local.get $y) (i32.shl (local.get $w) (i32.const 2)))
                 (i32.shl (local.get $x) (i32.const 2))))
      (i32.shl (local.get $w) (i32.const 2))
      (load.field DxObject width (local.get $entry))
      (load.field DxObject height (local.get $entry))
      (local.get $x) (local.get $y) (local.get $w) (local.get $h)
      (local.get $format) (local.get $pixels) (local.get $opaque))
    (local.set $d (i32.add (global.get $gl_sw_tex_stage) (i32.const 0x100000)))
    (i32.store offset=0 (local.get $d) (global.get $gl_sw_tex_stage))
    (i32.store offset=4 (local.get $d) (local.get $bytes))
    (i32.store offset=8 (local.get $d) (local.get $entry))
    (i32.store offset=12 (local.get $d) (local.get $x))
    (i32.store offset=16 (local.get $d) (local.get $y))
    (i32.store offset=20 (local.get $d) (local.get $w))
    (i32.store offset=24 (local.get $d) (local.get $h))
    (i32.ne (call $host_gpu_gl_call (i32.const 0x20006) (local.get $d) (i32.const 0))
      (i32.const 0)))

  ;; The render Worker's half of $gl_sw_worker_tex: copy the staged rectangle
  ;; into the surface entry, clipped exactly as the conversion was.
  (func (export "gl_sw_worker_tex_copy") (param $stage i32) (param $entry i32)
      (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (local $tw i32) (local $th i32) (local $cw i32) (local $row i32) (local $pitch i32)
    (local.set $tw (load.field DxObject width (local.get $entry)))
    (local.set $th (load.field DxObject height (local.get $entry)))
    (local.set $pitch (load.field DxObject pitch (local.get $entry)))
    (if (i32.ge_u (local.get $x) (local.get $tw)) (then (return)))
    (local.set $cw (i32.sub (local.get $tw) (local.get $x)))
    (if (i32.gt_u (local.get $cw) (local.get $w)) (then (local.set $cw (local.get $w))))
    (block $done (loop $rows
      (br_if $done (i32.ge_u (local.get $row) (local.get $h)))
      (br_if $done (i32.ge_u (i32.add (local.get $y) (local.get $row)) (local.get $th)))
      (memory.copy
        (i32.add (load.field DxObject misc1 (local.get $entry))
          (i32.add (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $pitch))
                   (i32.shl (local.get $x) (i32.const 2))))
        (i32.add (local.get $stage)
          (i32.mul (local.get $row) (i32.shl (local.get $w) (i32.const 2))))
        (i32.shl (local.get $cw) (i32.const 2)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rows))))

  ;; Result 1 when the render Worker took the draw.
  (func $gl_sw_worker_try (param $start i32) (param $vertices i32) (result i32)
    (local $snap i32) (local $b i32) (local $d i32) (local $g i32)
    (if (global.get $gl_sw_in_worker) (then (return (i32.const 0))))
    (if (i32.eq (global.get $gl_sw_worker_ok) (i32.const 2)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $gl_sw_snap)) (then
      (local.set $g (call $gl_alloc_affine (i32.const 1108)))
      (if (i32.eqz (local.get $g)) (then
        (global.set $gl_sw_worker_ok (i32.const 2))
        (return (i32.const 0))))
      (global.set $gl_sw_snap (call $g2w (local.get $g)))))
    (if (i32.eqz (global.get $gl_sw_wk_view)) (then
      (global.set $gl_sw_wk_view (call $gl_sw_view_entry))
      (global.set $gl_sw_wk_zview (call $gl_sw_view_entry))))
    (local.set $snap (global.get $gl_sw_snap))
    (local.set $b (call $gl_mtx_block))
    (memory.copy (local.get $snap) (global.get $gl_sw_st) (i32.const 64))
    (memory.copy (i32.add (local.get $snap) (i32.const 64))
      (call $gl_mtx_stack_top (local.get $b) (i32.const 0)) (i32.const 64))
    (memory.copy (i32.add (local.get $snap) (i32.const 128))
      (call $gl_mtx_stack_top (local.get $b) (i32.const 1)) (i32.const 64))
    (memory.copy (i32.add (local.get $snap) (i32.const 192))
      (call $gl_mtx_stack_top (local.get $b) (i32.const 2)) (i32.const 64))
    (memory.copy (i32.add (local.get $snap) (i32.const 256))
      (call $gl_mtx_stack_top (local.get $b) (i32.const 3)) (i32.const 64))
    (memory.copy (i32.add (local.get $snap) (i32.const 320))
      (i32.add (local.get $b) (i32.const 8352)) (i32.const 608))
    (memory.copy (i32.add (local.get $snap) (i32.const 928))
      (i32.add (local.get $b) (i32.const 9008)) (i32.const 24))
    (i32.store offset=952 (local.get $snap) (global.get $gl_sw_rt))
    (i32.store offset=956 (local.get $snap) (global.get $gl_sw_zbuf))
    (i32.store offset=960 (local.get $snap) (global.get $gl_sw_flip_y))
    (i32.store offset=964 (local.get $snap) (global.get $gl_sw_white))
    (i32.store offset=968 (local.get $snap) (global.get $gl_sw_fog_mode))
    (f32.store offset=972 (local.get $snap) (global.get $gl_sw_fog_density))
    (f32.store offset=976 (local.get $snap) (global.get $gl_sw_fog_start))
    (f32.store offset=980 (local.get $snap) (global.get $gl_sw_fog_end))
    (i32.store offset=984 (local.get $snap) (global.get $gl_sw_fog_color))
    (f32.store offset=988 (local.get $snap) (global.get $gl_sw_point_size))
    (f32.store offset=992 (local.get $snap) (global.get $gl_sw_line_width))
    (i32.store offset=996 (local.get $snap) (global.get $gl_sw_texgen_modes))
    (i32.store offset=1000 (local.get $snap) (global.get $gl_shade_model))
    (i32.store offset=1004 (local.get $snap) (global.get $gl_sw_default_w))
    (i32.store offset=1008 (local.get $snap) (global.get $gl_sw_default_h))
    (i32.store offset=1012 (local.get $snap) (global.get $gl_sw_wk_view))
    (i32.store offset=1016 (local.get $snap) (global.get $gl_sw_wk_zview))
    (i32.store offset=1020 (local.get $snap) (global.get $gl_sw_other_bound))
    (local.set $g (call $gl_sw_tex_slot (i32.load offset=40 (global.get $gl_sw_st))))
    (i32.store offset=1024 (local.get $snap)
      (if (result i32) (local.get $g) (then (call $gl_sw_tex_flags (local.get $g))) (else (i32.const 0))))
    (i32.store offset=1032 (local.get $snap)
      (call $gl_sw_border_color (local.get $g) (i32.load offset=1024 (local.get $snap))))
    (local.set $g (call $gl_sw_tex_slot (global.get $gl_sw_other_bound)))
    (i32.store offset=1028 (local.get $snap)
      (if (result i32) (local.get $g) (then (call $gl_sw_tex_flags (local.get $g))) (else (i32.const 0))))
    (i32.store offset=1036 (local.get $snap)
      (call $gl_sw_border_color (local.get $g) (i32.load offset=1028 (local.get $snap))))
    ;; +1040 stencil state, then drawable attachment pointer and dimensions.
    (local.set $g (call $gl_stencil_state))
    (memory.fill (i32.add (local.get $snap) (i32.const 1040)) (i32.const 0) (i32.const 36))
    (if (local.get $g) (then
      (memory.copy (i32.add (local.get $snap) (i32.const 1040)) (local.get $g) (i32.const 36))))
    (i32.store offset=1076 (local.get $snap) (global.get $gl_stencil_pixels))
    (i32.store offset=1080 (local.get $snap) (global.get $gl_stencil_pitch))
    (i32.store offset=1084 (local.get $snap) (global.get $gl_stencil_height))
    (i32.store offset=1088 (local.get $snap) (call $gl_color_mask))
    ;; 0x20005's descriptor: snapshot, its length, packed record, its length.
    (local.set $d (i32.add (local.get $snap) (i32.const 1092)))
    (i32.store offset=0 (local.get $d) (local.get $snap))
    (i32.store offset=4 (local.get $d) (i32.const 1092))
    (i32.store offset=8 (local.get $d) (local.get $start))
    (i32.store offset=12 (local.get $d)
      (i32.add (i32.mul (local.get $vertices) (i32.const 76)) (i32.const 32)))
    (if (i32.eqz (call $host_gpu_gl_call (i32.const 0x20005) (local.get $d) (i32.const 0)))
      (then
        (global.set $gl_sw_worker_ok (i32.const 2))
        (return (i32.const 0))))
    (global.set $gl_sw_worker_ok (i32.const 1))
    (global.set $d3dim_worker_pending (i32.const 1))
    ;; A DIB is directly visible to guest memory and GDI immediately after
    ;; this draw returns. Keep its historical synchronous visibility while
    ;; moving the raster loop onto the common renderer owner.
    (if (global.get $gl_sw_bitmap) (then (call $d3dim_worker_fence)))
    (i32.const 1))

  ;; The render Worker's half: install a snapshot $gl_sw_worker_try took and
  ;; draw the packed record at $rec. Both are wasm addresses in memory this
  ;; instance owns. The first call gives the instance private scratch, state
  ;; and matrix block; the regions those normally live in are the guest's.
  ;; Result 0 only if that private memory could not be had.
  (func (export "gl_sw_worker_draw") (param $snap i32) (param $rec i32) (result i32)
    (local $blk i32) (local $g i32) (local $mode i32) (local $step i32) (local $n i32)
    (if (i32.eqz (global.get $gl_sw_wk_block)) (then
      (local.set $g (call $gl_alloc_affine (i32.const 0x800)))
      (if (i32.eqz (local.get $g)) (then (return (i32.const 0))))
      (global.set $gl_sw_scratch (call $g2w (local.get $g)))
      (local.set $g (call $gl_alloc_affine (i32.const 0x700)))
      (if (i32.eqz (local.get $g)) (then (return (i32.const 0))))
      (global.set $gl_sw_st (call $g2w (local.get $g)))
      (local.set $g (call $gl_alloc_affine (i32.const 10832)))
      (if (i32.eqz (local.get $g)) (then (return (i32.const 0))))
      (local.set $blk (call $g2w (local.get $g)))
      ;; Every stack is one deep, so each top is its stack's first entry.
      (memory.fill (local.get $blk) (i32.const 0) (i32.const 10832))
      (global.set $gl_sw_wk_block (local.get $blk))
      (global.set $gl_mtx_block_override (local.get $blk))
      (global.set $gl_sw_in_worker (i32.const 1))
      (global.set $gl_sw_enabled (i32.const 1))))
    (local.set $blk (global.get $gl_sw_wk_block))
    (memory.copy (global.get $gl_sw_st) (local.get $snap) (i32.const 64))
    (memory.copy (call $gl_mtx_base (local.get $blk) (i32.const 0))
      (i32.add (local.get $snap) (i32.const 64)) (i32.const 64))
    (memory.copy (call $gl_mtx_base (local.get $blk) (i32.const 1))
      (i32.add (local.get $snap) (i32.const 128)) (i32.const 64))
    (memory.copy (call $gl_mtx_base (local.get $blk) (i32.const 2))
      (i32.add (local.get $snap) (i32.const 192)) (i32.const 64))
    (memory.copy (call $gl_mtx_base (local.get $blk) (i32.const 3))
      (i32.add (local.get $snap) (i32.const 256)) (i32.const 64))
    (memory.copy (i32.add (local.get $blk) (i32.const 8352))
      (i32.add (local.get $snap) (i32.const 320)) (i32.const 608))
    (memory.copy (i32.add (local.get $blk) (i32.const 9008))
      (i32.add (local.get $snap) (i32.const 928)) (i32.const 24))
    (global.set $gl_sw_rt (i32.load offset=952 (local.get $snap)))
    (global.set $gl_sw_zbuf (i32.load offset=956 (local.get $snap)))
    (global.set $gl_sw_flip_y (i32.load offset=960 (local.get $snap)))
    (global.set $gl_sw_white (i32.load offset=964 (local.get $snap)))
    (global.set $gl_sw_fog_mode (i32.load offset=968 (local.get $snap)))
    (global.set $gl_sw_fog_density (f32.load offset=972 (local.get $snap)))
    (global.set $gl_sw_fog_start (f32.load offset=976 (local.get $snap)))
    (global.set $gl_sw_fog_end (f32.load offset=980 (local.get $snap)))
    (global.set $gl_sw_fog_color (i32.load offset=984 (local.get $snap)))
    (global.set $gl_sw_point_size (f32.load offset=988 (local.get $snap)))
    (global.set $gl_sw_line_width (f32.load offset=992 (local.get $snap)))
    (global.set $gl_sw_texgen_modes (i32.load offset=996 (local.get $snap)))
    (global.set $gl_shade_model (i32.load offset=1000 (local.get $snap)))
    (global.set $gl_sw_default_w (i32.load offset=1004 (local.get $snap)))
    (global.set $gl_sw_default_h (i32.load offset=1008 (local.get $snap)))
    (global.set $gl_sw_sc_view (i32.load offset=1012 (local.get $snap)))
    (global.set $gl_sw_sc_zview (i32.load offset=1016 (local.get $snap)))
    (global.set $gl_sw_other_bound (i32.load offset=1020 (local.get $snap)))
    (global.set $gl_sw_wk_flags0 (i32.load offset=1024 (local.get $snap)))
    (global.set $gl_sw_wk_flags1 (i32.load offset=1028 (local.get $snap)))
    (global.set $gl_sw_wk_border0 (i32.load offset=1032 (local.get $snap)))
    (global.set $gl_sw_wk_border1 (i32.load offset=1036 (local.get $snap)))
    (local.set $mode (i32.load offset=8 (local.get $rec)))
    (local.set $step (select (i32.const 1)
      (select (i32.const 2) (i32.const 3) (i32.eq (local.get $mode) (i32.const 1)))
      (i32.eqz (local.get $mode))))
    (local.set $n (i32.div_u (i32.load offset=20 (local.get $rec)) (i32.const 76)))
    (global.set $gl_stencil_worker_state (i32.add (local.get $snap) (i32.const 1040)))
    (global.set $gl_stencil_pixels (i32.load offset=1076 (local.get $snap)))
    (global.set $gl_stencil_pitch (i32.load offset=1080 (local.get $snap)))
    (global.set $gl_stencil_height (i32.load offset=1084 (local.get $snap)))
    (global.set $gl_color_mask_worker (i32.load offset=1088 (local.get $snap)))
    (call $gl_sw_draw (local.get $rec) (local.get $n) (local.get $step))
    (i32.const 1))

  ;; ---- exports --------------------------------------------------------------
  (func $gl_sw_export_set_enabled (export "gl_sw_set_enabled") (param $on i32)
    (call $d3dim_worker_fence)
    (if (i32.and (i32.ne (local.get $on) (i32.const 0)) (i32.eqz (global.get $gl_sw_enabled)))
      (then (call $gl_sw_state_defaults)))
    (global.set $gl_sw_enabled (i32.ne (local.get $on) (i32.const 0))))
  (func $gl_sw_export_enabled (export "gl_sw_enabled") (result i32)
    (global.get $gl_sw_enabled))
  (func $gl_sw_export_triangles (export "gl_sw_triangles") (result i32)
    (global.get $gl_sw_triangles))
  (func $gl_sw_export_lines (export "gl_sw_lines") (result i32)
    (global.get $gl_sw_lines))
  (func $gl_sw_export_points (export "gl_sw_points") (result i32)
    (global.get $gl_sw_points))
  (func $gl_sw_export_clipped (export "gl_sw_clipped") (result i32)
    (global.get $gl_sw_clipped))
  (func $gl_sw_export_culled (export "gl_sw_culled") (result i32)
    (global.get $gl_sw_culled))
  (func $gl_sw_export_tex_uploads (export "gl_sw_tex_uploads") (result i32)
    (global.get $gl_sw_tex_uploads))
  (func $gl_sw_export_tex_unsupported (export "gl_sw_tex_unsupported") (result i32)
    (global.get $gl_sw_tex_unsupported))
  ;; The DX slot of the presented (front) surface, or -1 before the first
  ;; draw, so a test or a capture can name it without guessing.
  ;; With a bitmap target there is no front, and this names the descriptor
  ;; over the DIB instead, so --dx-slot can still capture what GL drew.
  (func $gl_sw_export_slot (export "gl_sw_slot") (result i32)
    (local $e i32)
    (local.set $e (select (global.get $gl_sw_front) (global.get $gl_sw_rt)
      (i32.ne (global.get $gl_sw_front) (i32.const 0))))
    (if (i32.eqz (local.get $e)) (then (return (i32.const -1))))
    (i32.div_u (i32.sub (local.get $e) (global.get $DX_OBJECTS))
               (i32.const 32)))
  ;; The HBITMAP a PFD_DRAW_TO_BITMAP context is drawing into, 0 otherwise.
  (func $gl_sw_export_bitmap (export "gl_sw_bitmap") (result i32)
    (global.get $gl_sw_bitmap))
  ;; The back buffer's DxObject entry -- where draws land -- or 0 before the
  ;; first draw. The record is the one $d3d9_create_surface documents at
  ;; 09ad-handlers-d3d9: +12 w, +14 h, +16 bpp, +18 pitch, +20 DIB (WASM
  ;; address), +28 flags.
  (func $gl_sw_export_entry (export "gl_sw_entry") (result i32)
    (global.get $gl_sw_rt))
  (func $gl_sw_export_front (export "gl_sw_front") (result i32)
    (global.get $gl_sw_front))
  (func $gl_sw_export_presents (export "gl_sw_presents") (result i32)
    (global.get $gl_sw_presents))

  ;; Put the presented frame on screen: blit the front surface into $hwnd's
  ;; client area, as a GDI BitBlt of the frame would. SwapBuffers only swaps
  ;; surfaces, and nothing composites a GL window from a DirectDraw surface
  ;; -- the CLI's --png finds the surface by slot, which is why the frames
  ;; were right there and a browser window stayed black. The frame is
  ;; client-sized with (0,0) at the client origin, so a client DC is exact.
  ;; Result 1 when a frame was blitted.
  (func (export "gl_sw_present_window") (param $hwnd i32) (result i32)
    (if (i32.or (i32.eqz (global.get $gl_sw_front)) (i32.eqz (local.get $hwnd)))
      (then (return (i32.const 0))))
    (call $dx_blit_entry_to_hdc (global.get $gl_sw_front)
      (i32.or (local.get $hwnd) (i32.const 0x40000)))
    (i32.const 1))
  ;; The drawable size the host last reported, (w << 16) | h, or 0 when none
  ;; has been: the target then sizes itself from the viewport instead.
  (func $gl_sw_export_drawable (export "gl_sw_drawable") (result i32)
    (if (result i32) (global.get $gl_sw_drawable_known)
      (then (i32.or (i32.shl (global.get $gl_sw_default_w) (i32.const 16))
                    (global.get $gl_sw_default_h)))
      (else (i32.const 0))))

  ;; Push $vertices 60-byte GL vertices through the REAL packed-draw funnel.
  ;; A test that called $gl_sw_consume directly would exercise a private copy
  ;; of the lowering and prove nothing about the hook; this goes through
  ;; $gl_packed_begin/$gl_packed_finish, which is where production draws
  ;; arrive.
  ;; These two take the original 15-float (60-byte) vertex and widen it with
  ;; r = 0, q = 1 for both units, the values every two-component call gives.
  (func $gl_sw_export_emit_triangles (export "gl_sw_emit_triangles")
      (param $src i32) (param $vertices i32)
    (call $gl_sw_export_emit_packed (local.get $src) (local.get $vertices) (i32.const 4)))
  ;; The same for any packed mode: 0 points, 1 lines, 4 triangles.
  (func $gl_sw_export_emit_packed (export "gl_sw_emit_packed")
      (param $src i32) (param $vertices i32) (param $mode i32)
    (local $start i32) (local $i i32) (local $d i32)
    (if (i32.eqz (local.get $vertices)) (then (return)))
    (local.set $start (call $gl_packed_begin (local.get $mode)))
    (block $done (loop $each
      (br_if $done (i32.ge_u (local.get $i) (local.get $vertices)))
      (local.set $d (i32.add (local.get $start)
        (i32.add (i32.const 32) (i32.mul (local.get $i) (i32.const 76)))))
      (call $memcpy (local.get $d)
        (i32.add (local.get $src) (i32.mul (local.get $i) (i32.const 60))) (i32.const 60))
      (f32.store offset=60 (local.get $d) (f32.const 0))
      (f32.store offset=64 (local.get $d) (f32.const 1))
      (f32.store offset=68 (local.get $d) (f32.const 0))
      (f32.store offset=72 (local.get $d) (f32.const 1))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $each)))
    (call $gl_packed_finish (local.get $start) (local.get $vertices)))
  ;; Full 19-float (76-byte) vertices, r and q included.
  (func $gl_sw_export_emit_packed19 (export "gl_sw_emit_packed19")
      (param $src i32) (param $vertices i32) (param $mode i32)
    (local $start i32)
    (if (i32.eqz (local.get $vertices)) (then (return)))
    (local.set $start (call $gl_packed_begin (local.get $mode)))
    (call $memcpy (i32.add (local.get $start) (i32.const 32))
      (local.get $src) (i32.mul (local.get $vertices) (i32.const 76)))
    (call $gl_packed_finish (local.get $start) (local.get $vertices)))

  ;; Feed one GL call to the state observer, exactly as the encoder does, so a
  ;; test can set state (glEnable, glTexImage2D...) through the real decoder.
  (func $gl_sw_export_observe (export "gl_sw_observe") (param $op i32) (param $stack i32)
    (call $gl_sw_observe (local.get $op) (local.get $stack)))

  ;; The host's word on the window a context draws into: its client size.
  (func $gl_sw_export_set_default_size (export "gl_sw_set_default_size")
    (param $w i32) (param $h i32)
    (if (i32.and (i32.and (i32.gt_s (local.get $w) (i32.const 0)) (i32.le_s (local.get $w) (i32.const 4096)))
                 (i32.and (i32.gt_s (local.get $h) (i32.const 0)) (i32.le_s (local.get $h) (i32.const 4096))))
      (then
        (global.set $gl_sw_drawable_known (i32.const 1))
        (global.set $gl_sw_default_w (local.get $w))
        (global.set $gl_sw_default_h (local.get $h)))))

  (func $gl_sw_export_reset (export "gl_sw_reset")
    (call $d3dim_worker_fence)
    (call $gl_stencil_release)
    (global.set $gl_sw_worker_ok (i32.const 0))
    (global.set $gl_sw_drawable_known (i32.const 0))
    (global.set $gl_sw_active_unit (i32.const 0))
    (global.set $gl_sw_other_bound (i32.const 0))
    (global.set $gl_sw_rt (i32.const 0))
    (global.set $gl_sw_front (i32.const 0))
    (global.set $gl_sw_flip_y (i32.const 1))
    (global.set $gl_sw_bitmap (i32.const 0))
    (global.set $gl_sw_presents (i32.const 0))
    (global.set $gl_sw_zbuf (i32.const 0))
    (global.set $gl_sw_front_obj (i32.const 0))
    (global.set $gl_sw_rt_obj (i32.const 0))
    (global.set $gl_sw_zbuf_obj (i32.const 0))
    (global.set $gl_sw_triangles (i32.const 0))
    (global.set $gl_sw_clipped (i32.const 0))
    (global.set $gl_sw_culled (i32.const 0))
    (global.set $gl_sw_clear_color (i32.const 0))
    (global.set $gl_sw_clear_depth_value (i32.const 0xFFFF))
    (call $gl_sw_state_defaults))
