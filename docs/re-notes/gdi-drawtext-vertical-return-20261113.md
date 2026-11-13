# DrawText vertical alignment return value

`gdi_bitmap_draw_text` positioned single-line DT_VCENTER/DT_BOTTOM text correctly
but always returned its cell height. Win32 specifies the distance from the input
rectangle top to the drawn text bottom for those flags:
<https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-drawtextw>.
The menu-label diagnostic in `20261113-gdi-menu-layout-2300` observed 13 instead
of 36/59 for 24 ANSI/UTF-16 calls.

The helper now converts the completed device-space span to logical units when
single-line vertical alignment is active. It leaves the drawing positions,
CALCRECT early return and unaligned/multiline height behavior intact.

Validation in `scratch/runs/20261113-coordinator-drawtext-return-repair/`:

- The retained pre-fix module rejects the new bottom-return assertion (8 vs 16).
- The updated deterministic bitmap test covers ANSI/UTF-16 top/center/bottom,
  ignored multiline vertical flags, unchanged RECT, CALCRECT without painting,
  and 2x anisotropic Y mapping with nonzero window and viewport origins.
- Five focused tests pass: bitmap layout, bitmap compatibility, DrawTextEx,
  TA_UPDATECP and text mapping.
- The unchanged predecessor menu oracle, with only its module input changed to
  the new canonical build, reports zero return failures across 36 cases.
  Its actual PNG is byte-identical to the predecessor. Twelve separate one-pixel
  horizontal-centering differences remain unchanged and are not qualified here.
- `flock /tmp/wine-build.lock bash tools/build.sh` passes. Its first attempt
  exposed stale generated app sizes for 95 present files; regenerating the table
  updates three DirectX SDK entries and adds 92 GLTron entries. The generator
  check and focused app-size policy test pass.

Tested canonical module SHA-256:
`cd27b7b284e7ca1454bc52c317e8a9ec92d71180c11e2e1f140a26e7fa0dafdd`.
This is native API fixture evidence, not original-game or browser acceptance.
