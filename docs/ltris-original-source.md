# LTris 1.2.8 original Win32 source readiness

2026-10-18: source acquisition only. No guest/native runtime, build, browser,
installer, licence answer, gameplay qualification, or public deployment.

## Original package and recovery

Official URL: https://downloads.sourceforge.net/project/lgames/ltris/ltris-1.2.8-win32.zip

Archive: 2,379,795 bytes; SHA-256
`b64a817fd4031e5f3e0b31bad546b0876ac62ef6c6384eae396b2de127718622`.

Evidence root on Boat: `/home/user/wine-assembly/scratch/runs/20261018-ltris-source/`.
Original root: `original/ltris-1.2.8/`. Forty files, 7,361,674 bytes;
each extracted file was compared byte-for-byte by SHA-256 with its ZIP member.
`source-manifest.json` records all exact paths, sizes and SHA-256 pins.
`archive-listing.txt`, `pe-closure.json`, `verification.json`, `passive-plan.json`,
and the small JS acquisition/inspection scripts retain the recovery recipe.
Ignored payloads are not preserved by this documentation commit: recover using
the official URL, verify the archive pin, then extract without modification.

`COPYING.txt` is GPL version 2. The README describes SDL and optional SDL_mixer;
no installer or licence prompt was run. The original `ltris-window.bat` specifies
`ltris.exe -w`; fullscreen batch specifies its own launch option. Use the original
windowed option for the first passive launch.

## PE and data closure

`ltris.exe`: 572,618 bytes, SHA-256
`577c7fbdd026825ab50fe6009eab031f364f75aa8eb35253c91c82bf16e3a7d1`.
PE32 i386, image base 0x400000, entry RVA 0x13e0. Imports SDL.dll,
SDL_mixer.dll, KERNEL32.dll and msvcrt.dll.

Eleven original PE32 DLLs are bundled: SDL.dll, SDL_mixer.dll, iconv.dll,
libFLAC-8.dll, libgcc_s_sjlj-1.dll, libintl-8.dll, libmikmod-3.dll,
libogg-0.dll, libvorbis-0.dll, libvorbisfile-3.dll and libwinpthread-1.dll.
All non-system transitive DLL imports are supplied except the CRT, for which
existing authentic `/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll`
is available: 278,581 bytes, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
System imports are ADVAPI32, GDI32, KERNEL32, USER32, WINMM and DSOUND.
This is static closure, not a claim that every imported API works at runtime.

The JS PE reader records each imported symbol. Its eleven DLL import tables
agree with independent objdump output. objdump rejects the unmodified EXE;
`file` recognizes its PE32 i386 headers and the JS reader resolves its import
table. Preserve this tool limitation rather than rewriting the binary.

Mount every original file, preserving the gfx/ and sounds/ subdirectories.
No generated settings or substituted assets were added. Runtime data completeness
and optional game modes remain unproved until the original program is observed.

## Passive launch recipe, pending explicit runtime grant

Use the coordinator's current integration checkout, not the shared storage
checkout's detached HEAD. Refresh and independently verify runtime source/module
pins at grant time. The JSON plan provides forty exact original mounts and
12 DLL seeds (eleven bundled plus the authentic shared CRT).

Invoke `test/run.js` with the original EXE, `--exe-guest-path=C:\LTRIS\ltris.exe`,
`--cwd=C:\LTRIS`, `--args=-w`, one `--vfs-mount=HOST=GUEST` for each plan mount,
and one `--dll-seed=PATH` for each seed. Use existing canonical wasm with
`--no-build`, `--quiet-api`, `--no-close`, `--no-threads`, `--real-ticks`,
`--batch-size=200000`, `--max-batches=10000000`, `--max-seconds=60`,
`--control-stdin`, and a fresh output directory for captures.

Coordinator controller requirements: 65-second soft / 85-second hard process-group
guard; 8 MiB log cap; admission above 2 GiB +128 MiB and stop at 2 GiB +64 MiB;
no input. Capture periodic/final images. Record actual child/controller exits,
independent process absence and group emptiness, and unchanged source/module/
original pins. Review captures before publishing result.json; a menu is not
player-controlled gameplay.

Acquisition retained approximately 10.8 MB, below the authorized 50 MB cap;
free disk after preparation was 2,381,996,032 bytes. No full worktree was created;
the documentation branch uses a one-file sparse checkout.

## Passive startup, 2026-10-18

One root-authorized passive run used the original windowed option and all forty
original mounts: `20261018-ltris-passive-startup`. The first observed capture
shows the LTris main menu with New Game, Controls, Graphics, Audio and Quit.
No player input was sent. The decorated window extends below/right of the
640x480 captured desktop; controls are visible, but edge clipping is retained.

Launch source HEAD `19e0d9aab05a66f1e98113c1880a63a1fff9d136`; canonical module SHA-256
`fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`. CLI guest bound reached 60.000s;
child 2375256 and controller 2375223 exited 0. Independent postflight verified
both absent and their owned group empty, with all 3192 source/CRT pins, forty
original records, archive and module unchanged. Minimum free disk 2,377,474,048
bytes; log 13,397 bytes; no guard fired. All 7 captures are byte-identical;
sample-0 and final were personally inspected. `review.json` was published last.
Per ops/README.md, retain this unregistered evidence in investigation notes until
a candidate identity exists; no misleading dashboard result is attached to another
game. No second run or gameplay claim.

## Ordinary gameplay preparation (no runtime grant)

`scratch/runs/20261018-ltris-gameplay-prep/PLAN.json` and controller/helpers
prepare the next registered original route. Registration belongs to a separate
worker; proposed app ID `ltris_128` must be checked against its final result.
Refresh all runtime/fixture pins after integration, verify forty original mounts,
eleven original DLL seeds plus CRT, C:\LTRIS and `-w`, then obtain the sole
runtime grant. No gameplay run was launched during this preparation.

The original EXE's embedded controls help identifies horizontal Left/Right,
Rotate Left/Right, faster Down, instant Drop and modern-style Hold. These strings
do not establish the default key bindings. The next run must first read
Controls -> Player1 through ordinary UI, recording displayed bindings without
editing them. Then choose single-human Normal at level 0 and Start Game through
reviewed menus; Demo is not player control.

Qualify movement against automatic falling: capture an airborne piece during
no-input baseline, then apply its displayed Left binding for 100ms with an
independent keyup. Require a horizontal column change for the same piece;
released idle may continue falling vertically but must stop shifting. A separate
Right hold can provide the reverse comparison. Test rotation only on a visible
non-square piece, comparing orientation of the same piece before and after a
100ms reviewed rotation binding. A lock/new-piece transition or automatic fall
does not qualify. Never infer controls from score changes.

Every issued action requires a reviewed capture/hash. Helper tests passed six
normal/early-close cases, balanced releases, and invalid capture hash rejection;
missing runtime grant refuses before creating an output directory. The proposed
180s guest /185s soft /210s hard bounds close input at175s, retain the8MiB log cap
and2GiB+128MiB admission /2GiB+64MiB stop margins. No API tracing or guest writes.

No supported CLI desktop-size switch was found in test/run.js. Preserve the
observed clipping and original `-w` route; the original `-f` launcher is an
untested alternate route, not a desktop-size fix. If the necessary controls or
piece cannot be inspected, retain the limitation rather than qualifying unseen
behavior. Source-only preparation does not establish gameplay or default keys.
