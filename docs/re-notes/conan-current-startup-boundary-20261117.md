# Conan current startup and hidden Worker frames, 2026-11-17

The current black startup reaches real WebGL draws, presents, and Conan's
main menu. The selected 640×480 presenter wholeimage contains the menu while
the reviewed browser wholeimages remain black. Startup is doing real work:
native completed slices/EIPs, uploaded resources and executed draws advance.
The prior `0x4b012e` sample is inside stereo ADPCM decoding at `0x4aff50`;
its caller at `0x4cd37d` names `SoundInterface.cpp` and reports `ADPCM codec
failed !!`. The decoder uses the 89-entry step table at `0x546228` and clamps
the step index to 0–88. This identifies the sampled instruction, not a hang
or a faulty sound file.

A reproduced integration defect hides accepted D3D9 Worker frames. The
host's `layer.stale()` asks the idle page WASM instance for
`d3d9_gps_active()`. That getter reads an instance-local ring global, which
is zero when a different CPU Worker instance owns the live ring. The
compositor rejects the layer, even though the render endpoint has produced
its menu pixels. The focused regression fails on that exact rejection
before the correction. Worker frames now use the accepting render endpoint
and bridge epoch to check retirement, replacement, closure and failure.
The local execution route retains its native activity check. No raster,
normal-matrix guard, draw packet, media or guest state was changed.

Validation: the existing renderer Worker repaint boundary regression fails
before this correction and passes afterward, including failure, endpoint
closure, retirement, replacement and the unchanged local-ring check. The
shared-render-worker routing regression passes. The canonical locked build
passes after the required host-imports producer lifetime review is updated.

The initial local original used published `b063d11ee` JavaScript and the
previously tested `87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`
module. A bounded false conditional breakpoint retained one successful
DRAW_UP's actual renderer state; it does not establish a failing draw or
resource lifetime generation. The first observer used an unavailable
Puppeteer target route, and its corrected Worker route captured the draw
but its explicit CDP detach failed. Both errors remain evidence.

The initial outer execution session ended with status 143 before its
supervisor wrote terminal wait receipts. A later observer connection failed;
no runtime queries or guest input followed it. Recorded native PIDs were
already absent at OS cleanup and the disposable profile was removed.
Native/driver actual waits and both EOFs for that run remain UNKNOWN; process
absence is not substituted for them. The preserved old UNKNOWN evidence is
unchanged. No box was created.

Evidence: `scratch/runs/20261117-conan-current-startup-boundary-visible-progress/`.
Correction `da9ac26cc` was tested and published before the authorized extra
fresh run. That attempt ended at a 20-second CDP `Page.navigate` protocol
timeout before `launchApp` or any Conan input. It is terminal UNKNOWN; no
runtime queries or retries followed. Chrome exited 0, driver 1, watchdog 0,
and supervisor 1, with actual waits and both pipe EOFs. The watchdog did not
fire; the owned scope and child list were empty. Its detached keeper's own
parent wait is unavailable and remains UNKNOWN. The exact receipts were
retrieved, hash-verified, and the own disposable profile removed.

The next missing boundary is a successful bounded page startup with this
published correction, then a personally reviewed visible menu and ordinary
input. Post-fix menu visibility, movement, second response and native Quit
remain unproved. The initial internal presenter menu alone does not establish
visible player control. No current failing draw was found, so historical
normal-matrix and collapsed-color hypotheses remain untested hypotheses.
