# Half-Life: native Pause translation and matched original proof

Run `scratch/runs/20261112-halflife-native-pause-2000/`; sibling
`-before/` holds the old-renderer original run and `-control/` the private
lifecycle/blank control. General input fix **ae83f8d550685f98de2f0bd75acf4c7e10a875f4**
is published on main. No game-specific mapping or configuration change is used.

Microsoft's [keyboard overview](https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input)
distinguishes Pause hardware E1 1D 45 from its legacy scan 0045, and NumLock's
legacy E045. Message bit 24 represents E0. Thus Pause must carry scan 45 without
KF_EXTENDED; NumLock carries scan 45 with KF_EXTENDED. Both DOM Pause and numeric
VK19 previously delivered scan zero. The minimal renderer mapping fixes both
paths and distinguishes NumLock without changing either virtual key.

`before-renderer-queue.log` and `before-guest-worker.log` retain failing actual
queue/owning Worker tests before repair. `after-keyboard.log` passes the actual
Win32 PeekMessage test, not merely a DOM/Worker echo. Independent literal
expectations cover down 00450001, repeat 40450001 and up C0450001; NumLock,
ArrowUp, right Control and numpad Enter cover neighboring extended mappings.
`chrome-queue-tests.json` separately proves these before/after guest MSG values
through trusted Chrome DOM input and numeric fallback, the production renderer,
host RPC and owning Worker. Its first scratch probe incorrectly included a
WM_CHAR while awaiting numpad Enter UP; the retained fixture-failure log and
corrected keyboard-message-range probe make this test correction explicit.

Focused keyboard, input slots/wake/focus, focus seed, buffered DirectInput and
modeless routing checks pass, as does `flock /tmp/wine-build.lock bash tools/build.sh`.
The callback census source pin is refreshed without lifetime changes. The older
untracked `test-renderer-worker-menu-escape.js` fails 65537 versus 0 identically
against the pre-fix renderer; `menu-baseline.log` records that existing failure.
The qualified module stays SHA256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

The published 1930 semantic-capture note and selector were read and preserved.
`selector-tests.json` repeats the mtime/lexical regression through actual
delivery/transport/extracted consumer. Twenty-one existing consumer controls
pass. Eleven finite cycle controls pass both extracted execute/transport and
actual Chrome, including failure at resume, action, frame and pause. Each
ordinary DOWN has an independently prearmed UP; failure permits cleanup only.
The cycle resumes, performs one bounded ordinary action, retains its original
full consequence frame, then pauses. No adaptive decision occurs inside it.
881 runtime pins (883 uploads including manifests) and all helpers are frozen
before allocation, joined provision and full remote import/hash gates pass
before either original launch. Source Git SHA, relevant binary diff and owned
new helper patches are retained; media is referenced, not archived.

Both fresh original browsers mount all 13 records of the earned checkpoint,
758472 compressed bytes, SHA256
`df8d61b2fcdd285a6a28e2e180930e6ee60eff388cd9bf31c557d3409dd18e51`,
2342063 decoded bytes. Both use the same 65 qualified media, current runtime,
normal 640x480 mode UI and bottom 03:18 native Load. The baseline serves the
exact pre-fix renderer bytes from a hash-asserted inverse patch in memory;
the candidate serves the repaired renderer. All other runtime pins match.

Old input: `n16-bound` shows the full living corridor at 35/0.
`n17-old-pause` shows no PAUSED text at 30/0; passive `n18-old-unpaused`
falls to 25/0. The closing read-only export at 15/0 independently matches all
13 original save records and decoded bytes (`whole13-preserved.json`).

Repaired input: `a17-bound` shows the full original corridor at 35/0.
`a18-native-pause` visibly shows **PAUSED, 35/0**. Passive
`a19-paused-stability`, captured 7.916 seconds later, retains the same game
scene and health. `a20-lookdown-cycle` resumes normally, lowers the camera
with PageDown700ms and captures the full **unpaused** consequence at 30/0
before pausing again. This proves fresh ordinary movement after resume.
`a21-face-crab` performs one reviewed left300ms cycle toward the visible
lower-left headcrab. Its immediate frame precedes the final paused rendering;
the passive `a22-cycle-state` explicitly shows PAUSED at 30/0. Input ACK alone
is not treated as proof that a displayed frame has already reached pause.

The next reviewed turn is refused **locally before dispatch** because actual
/home free space is 1499492352 bytes, below the owner 1500000000-byte floor.
`disk-samples.jsonl` and `combat-blocker.json` preserve the blocker. There is
no retry, attack, death, kill, new Save or useful successor checkpoint. Aimed
combat and safe guard-room progress remain unfinished. The original whole13
source is unchanged; the candidate issues no native Save. No continuous disk
floor compliance is claimed. Reserve remains unchanged; no RAM gate applies.

Blank control: 23 SHA-verified references, 133/133 owned processes reaped.
Old original: 241 references, 191/191 reaped, actual outer parent wait0 and
command EOF. Repaired original: 291 references, 375/375 reaped, actual outer
parent wait0, both EOFs and allJoined. Normal quit ACK23 precedes recovery.
`-control/all-task-retrieval-verified.json` rechecks all three recovered sets
before stop. The rejected turn never reaches the numbered command stream.

Single private box **bx_x57qdmqr** was created after an observed independent
two-hour watchdog; initial expiry **2026-11-12T22:06:47.201Z**.
It is now **archived, expiry null**, stopped **20:22:42.967Z**.
Stop **stop_d3a198a4f9c8c2e6** completed, forced false, error null. The local
manager session47318 returned143 without manager-parent or watchdog-parent
wait receipts: those waits remain **UNKNOWN**. The independent watchdog stayed
alive and later records terminal confirmation. A delegated fallback normal
stop child has actual parent wait0 and both EOFs; it is not relabeled as the
missing original manager wait. No old box was resumed, deleted or reused.

Next: restore adequate shared disk headroom before another fresh qualified
allocation, then continue one visually reviewed finite aimed attack or safe
doorway cycle from the unchanged earned whole13. No full27/parity/FPS/audio or
general crash-free claim follows from this run.
