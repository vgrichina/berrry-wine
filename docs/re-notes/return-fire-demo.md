# Return Fire demo

User priority from X post 2108357606242918686, linking https://archive.org/details/Rfire.

## Original media and registration

RFIRE.zip: 942701 bytes; SHA256 8e55e2761753d1773cbf52d86eb30900a977f7b281ccc920ffb80fbb5b5e56be. Original RFIRE/DEMO.EXE: 323072 bytes; SHA256 b3407ec82d5e8d181116d2bb7a4998ff180773f3b6f91e98e7156979f3859a63. Extract unchanged into test/binaries/candidates/return-fire-demo/. All 57 supporting files remain mounted through .wine-assembly-browser.json. No installer or guest edits. Local-only app return_fire_demo uses the existing real desktopColorDepth:8 indexed surface; no public desktop promotion.

## Verified native route, 2026-10-09

Temporary boat bx_5jcbe4c6. Canonical module 65f1f98d4b3545f5141b0be2816e1c9353729dbfa477013fc4baafa3b95ae1a4, runtime source b636d43c7 plus app registration. Native CLI no threads, software renderer, frozen stepping, batch size 100000. These steps do not measure real-time FPS.

Default 32-bit desktop fails the original 256-color requirement: run 20261009T2009Z-return-fire-32bit-control. Real 8-bit desktop reaches normal One Player/Easy launcher. Click Play (175,312), then acknowledge the second informational graphics warning (315,278). Full-screen bunker appears. H (VK72) selects the vehicle; W (VK87) moves it away from the bunker. Terrain scrolls and fuel falls. Further H input reduces ammunition. Enter and Up were tried first but did not deploy the vehicle; the original RFIRE.HLP identifies H/J/K and WASD for player one, Enter/numpad for player two.

Run 20261009T2010Z-return-fire-gameplay retains all numbered input requests, responses, screenshots, log, original controller and hashes. Reviewed step-8.png shows deployed vehicle, step-10.png shows movement into terrain, step-12.png shows subsequent ammunition change. Controller/guest exited cleanly at 20:15:38Z. identity.json describes initial startup only; numbered request files are authoritative for subsequent input.

## Open work

- Browser launch/input on a temporary box; no browser qualification yet.
- The second renderer warning still says it is not in 8-bit mode despite indexed desktop. Full-screen path works, but its separate depth query needs tracing. String VA00472504, reference around00424a2a; do not fake caps or assume DirectDraw without inspecting.
- Sound, logical gameplay FPS, sustained play and additional vehicles remain unverified.
- Build run 20261009T2008Z-return-fire-build pins canonical build and original extraction.

## Browser baseline and depth-query diagnosis

Registered browser route with default guest Worker and WebGL backend also reaches gameplay using trusted Play/OK pointer events, H deployment and five ordinary W keypresses. Browser run 20261009T2018Z-return-fire-browser records before/after movement screenshots. No guest writes or runtime overrides.

The second warning follows IDirectDraw::GetDisplayMode (vtable offset0x30) at00424a0a, comparing DDSURFACEDESC+84 dwRGBBitCount with8 at00424a11. The module's dx_display_bpp_get defaults16 before SetDisplayMode, independently of gdi_desktop_bpp. This identifies the source mismatch, not a tested fix. A regression should cover initial indexed desktop, initial32-bit desktop, and explicit mode overrides; do not call gdi_display_bpp from dx_display_bpp_get (it recurses after mode selection).

Initial browser harness failed on an original zero-byte asset because createReadStream received end=-1. Both controller22191 and Chrome22203 confirmed terminal; retry serves empty files with an empty200 response. This was a harness defect, not a game crash.

Browser controller22557/Chrome22569 stopped cleanly at20:20:38Z. A30.19s sample counted132548.5 presentation events/s and47.00 uploads/s; the inflated presentation counter clearly cannot stand for gameplay FPS. Logical FPS and audible output remain unverified.
