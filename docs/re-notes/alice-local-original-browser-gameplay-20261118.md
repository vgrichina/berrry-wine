# Alice original demo: local browser registration and reviewed startup

The already-local American McGee's Alice **demo** is registered as `alice_demo`.
On the local browser page, enable the existing experimental candidate picker
with `?candidates`, select “American McGee's Alice Demo (2000, experimental)”
and use ordinary Launch. The public inventory fence remains intact. This is
not a retail qualification or a deployment.

Evidence is in `scratch/runs/20261118-alice-local-original-browser-gameplay/`.
The executable is 1,454,142 bytes, SHA256
`61857b521eb7260c28b3ae6960fa8ee18d4d3679b6190f5221131e382e0f3a72`.
Its version resources report FileVersion/ProductVersion 1.0, comment 1.0a2;
the PDB path identifies demo_release, the readme is dated November 27, 2000,
and the PE timestamp is November 28. All fourteen declared companion files
were present and individually pinned, including the original pak0.pk3 and
both game DLLs. Existing media was unchanged. No replacement assets,
configuration, registry changes, launch commands or downloads were introduced.

Registration uses the existing browser manifest, required-file validation and
relative mouse support. Main and ordinary Worker preflights validate all
mounts before guest execution. An actual browser selector inspection confirms
the option and registry fields. Actual guest and renderer Worker WebAssembly
byte readbacks match the tested module, SHA256
`46c9b8e4af91a8770d454ff529e21d6a17553c31ad57aea30ca4a8aa6bf3e311`.
The graph was frozen from committed revision `2b8ba1b675a6fc0ce286d48a6261dc04acef62dd`
with only the published Alice registration/helper overrides. Shared foreign
WIP and the concurrently generated build module were not adopted for runtime.

An authored browser GL control reached initialized publication, but public
capture exceeded its three-second display deadline. That browser scope closed
UNKNOWN, without input or later endpoint requests. It is not a successful
browser capture qualification. The independent native software GL-stream
route passed personally reviewed authored before/after pixels, a consumed W
pulse, independent physical UP acknowledgement and ordinary Escape exit.
Hardware OpenGL packages were unavailable, so this is no hardware GL claim.

Registration and the finite input helper were published as `b12608a7b` after
focused tests and a locked full build. The first original reached the console
and game window, but premature presentation capture exhausted its unchanged
three-second readiness budget with `focus.mainTopLevel`. It closed without a
capture, binding or input. No endpoint was queried after UNKNOWN.

A separate finite passive startup wait was then added to the Alice helper.
It calls only the existing startup-readiness observer, retains complete
snapshots and verifies process identity, physical UP, screen and ordinary USER
ownership. It cannot capture, bind, focus, pump guest messages or deliver
input. Its deadline is at most sixty seconds and precedes the fixed Quit
reserve. The original three-second capture and input deadlines are unchanged.
An authored executable spends 4.5 seconds in an ordinary GetTickCount loop
before creating its window: immediate capture fails at three seconds, while
passive wait followed by a new bounded capture passes. Both runs use identical
executable bytes and no input. Unit controls also reject foreign PID and held
input. These tests and the locked full build passed before publication as
`98ff811e9` and the one permitted additional original.

The additional original produced a personally reviewed whole startup-console
PNG (`affected-extra/main-menu.png`; despite the filename, this is **not** a
menu). Startup then created the separate live, visible game HWND 0x10007 and
naturally focused it. Initially the live, visible console HWND 0x10001 remained main.
The initial passive readiness samples reject precisely
`focus.mainTopLevel`: focusTopLevel is 0x10007 while mainHwnd is 0x10001.
Both windows have the same process/thread identity; initially ordinary USER
ownership and actor context are healthy. Later the original naturally hides
the console, still retained as main, causing `main.visible` and
`owner.ordinaryUSER` failures. It then acquires mouse capture on 0x10007,
adding `input.capture`. Physical keys remain UP. The helper closes on that
capture transition after 510 passive samples (about 55 seconds), rather than
waiting out or extending its deadline. The console reports successful GL
context creation, renderer/client initialization and sound initialization. This establishes
a concrete admission blocker, not a claim that rendering or game loading has
failed. Native scene admission requires focus to belong to main when no modal
exists (`lib/cli-native-scene.js`); window creation retains the first top-level
as main and ShowWindow does not replace an already visible ordinary main
(`src/09a5-handlers-window.wat`). No focus/main promotion or identity fence was
changed to bypass this condition. Gameplay pixels, movement, jump, enemy
consequence and ordinary original Quit remain unverified.

Both originals use normal Workers, real ticks, the exact frozen module and
unchanged original media, with native supervision at 900 seconds, an
independent 920-second watchdog and a 180-second Quit reserve. Closed scopes
are cancelled through the owned supervisor and actual native/watchdog waits
and both EOFs are retained. No original input was bound or delivered. There
were exactly two originals, and neither is eligible for replay. No test boxes
were created: ID, expiry and stop receipt are null, state NOT_CREATED.

Recovery uses Git, not a source archive: restore the graph from revision
2b8ba1b675a6fc0ce286d48a6261dc04acef62dd in memory, apply only Alice's published
registration/helper changes, compile with the recorded compiler and verify the
module hash above. The retained preparation scripts, module source hash list,
source-read receipts, media pins and own Git patches document those inputs.
The original local media must pass those pins; no media copy is retained.

Evidence retention limitation: final verification found all run PNGs and
module/authored binary files absent, although they existed and the named
frames above were personally reviewed during the task. The cause of their
disappearance is UNKNOWN. Captures were not recreated and closed originals
were not reopened. Surviving capture JSON records contain their hashes and
snapshots; logs and source/module/media identity receipts remain. The result
records this loss and lists no available screenshots. Git and the retained
preparation scripts permit binary recovery, but cannot recover original
screenshot pixels. This limits independent visual review of this run.
