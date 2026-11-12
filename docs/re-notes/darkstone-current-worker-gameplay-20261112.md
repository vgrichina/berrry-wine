# Darkstone: current Worker gameplay, Town healing and native Save/Load

Run `scratch/runs/20261112-darkstone-current-worker-gameplay-0119/` continued
the original registered installed demo on both normal browser backends. Software
advanced native victories **9+0 → 10+0**; WebGL continued the earned save and
advanced **10+0 → 11+0**. Both runs showed hero locomotion, native combat, a
native **New Save**, and normal **Load** returning to a living Level 1 hero with
the earned victory count. No emulator defect was demonstrated and no production
code changed. The full GLD3D corpus of 27 remains open.

## Exact runtime and original media

Software ran source `199cf5b4e91762688b72a64247d5be177fe94a83`, including
the brokerless Worker optional lifecycle-hook fix. WebGL ran
`a3c04c2da365814f82a0fb9022a26460166d505b`; the intervening commit changed
documentation only. Both actual guest and owning renderer Worker module bytes
matched canonical module SHA-256
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`
(2,189,682 bytes).

The production fixture remains
`test/binaries/win98-games-a-d/DarkstoneDemo-D3D/installed`. Its complete
historical installation is usable through the registered route; the obsolete
installer-test Setup.exe guard does not apply. The executable SHA-256 is
`b43db5e1b835eb1e93688a1f3f1d9c814517be6fc8110c7fb6e024d467ee721b`.
Media paths/hashes, HTTP responses, current source/module identities, relevant
dirty patches, the 199cf5b4e patch, and run-helper new-file patches are retained.
No source/media archive or repeated game-media evidence copy was made.

Authoritative software pins are `software-executed-runtime-pins.json` (660
entries, reconstructed against and exactly matching the uploaded manifest SHA).
`runtime-pins.json` is the final WebGL run's 665-entry manifest.
`software-runtime-pins.json` is an intermediate preparation snapshot, **not** the
software execution manifest. `initial-runtime-pins.json`,
`webgl-initial-runtime-pins.json`, and refresh records preserve the earlier
attempts. Runtime source had no relevant dirty hunks; unrelated shared edits
were left alone.

## Native progress and backend evidence

Software case `software-inline` is a historical harness label: this successful
case actually used a separate legacy **software renderer Worker**, endpoint 1,
with no GPU adapter and positive advancing native software draw completions.
The hero ran from a clear floor click; a reviewed BAT hover preceded a bounded
native attack. Inventory changed from 9+0 victories / life25/35 to 10+0 /
life22/35. Gold remained1713; one level point was available. Combat can also
auto-engage, so this is an earned native victory without claiming sole
attribution to one attack pulse. Native New Save preserved the old de53 map and
created `game641d_6af517ab.sav`; normal Load retained victory10 and returned
alive at9/35. No further combat was attempted on that low-health reload.

WebGL case `webgl-current` mounted the earned software save through normal
production `loadFiles` and native Load. Its initial inventory showed victory10,
life18/35, level2, and the helmet. A single balanced floor destination click
displaced the hero relative to the wall/timber, followed by BAT engagement,
blood/damage feedback, and victory11 / life14/35. There were no camera-key
inputs. Native New Save created `game641d_6af51b49.sav`; normal Load returned
to the earned position with victory11 and life9/35. Gameplay ended there;
neither death nor a new objective completion was claimed.

Both cases used actual guest Workers, endpoint1/slot0, and actual owning
renderer Workers. The live WebGL target was640×480 with
`WebGL2RenderingContext`; native stats reported WebGL2 / ANGLE Intel Mesa UHD
620, advancing draw/fence counts, and zero native software completions. The
page's presentation canvas was2D. The backend conclusion comes from the owning
render target and producer bindings, not the toolbar or presentation canvas.
No physical-GPU, FPS, audio, or visual-parity qualification is inferred.

Full original images were retrieved, hash-checked, and reviewed separately
before dependent input. Each native key/button pulse had an independently armed
release and acknowledged down/up. The final verification covered42 bound
captures and28 balanced pulses across the two successful routes. Useful images
are under `live-review/software-inline/` (`baseline-panel`,
`post-combat-panel`, `restored-panel`) and `live-review/webgl-current/`
(`baseline-panel`, `walked-world`, `post-walk-panel`, `normal-load-preview`,
`restored-panel`), all PNGs.

## Native files and continuation

Original de53 input pair was recovered unchanged before gameplay:

| Native file | Bytes | SHA-256 |
|---|---:|---|
| characters.lpl |1342324|`2c78a17064029385dee4206c9314673debb4de05205ae63d2ff144b9e6081546`|
| game641d_6af0de53.sav |3204341|`cb2ca8093b2ffe45133cda87e3eea9ceafad66fd82246684ec40dd97306e66fc`|

The earned software character/map pair is retained by
`earned-software-recovery.json`; the newest native WebGL pair is retained by
`earned-webgl-recovery.json`:

| Native file | Bytes | SHA-256 |
|---|---:|---|
| characters.lpl |1342340|`faa2de2b01c0ccc863efe79e73d909f81d3de87201421b7841da56ff77d76a0d`|
| game641d_6af51b49.sav |3204341|`551e1127dad968e8749ef86aec035a93c497c76596188e825e985eb67da3bd9f`|

`continuation-whole-file-set.json` references the current character file plus
all three retained native maps (de53,517ab,51b49), with raw sizes/SHA-256 and
compressed SHA-256. This union preserves every original; its newest map was
normally loaded in this run, while the four-file union itself was not separately
replayed. The earlier517ab map remained unchanged, SHA-256
`cf3e16cb8fc4de6477e4a1bba4052e312bfce9688e37e682154d10335b39d3bd`.
Never mix an older character index into the newest save set or overwrite the
prior originals. Prefer a short, reviewed continuation from51b49 with the
low-health limit; seek native healing or safe retreat before another fight.

## Harness failures, checks, and shutdown

All failed attempts remain in evidence. The first launch lacked a staged lease
file and failed before Chrome. A known malformed process-status request also
closed that caller phase. The next software observer bound inline before the
normal renderer endpoint appeared; it refused the identity transition before
game input. Its corrected startup guard waits for the actual endpoint.

The first WebGL observer concatenated historical GL contexts, mistaking native
Load's legitimate render-target replacement for an owner change. It stopped
after the completed native Load click and normal Chrome close. A fresh process
used a passive observer associated with the actual D3DIMGpu adapter and live
targets; stable endpoint/Worker/module identity remained enforced. No failed or
unknown input was replayed. These are run-harness corrections, with focused
old-fails/new-passes tests, absent-owner and replacement-owner negatives.

Checks passed: `ops/browser-native-input.test.cjs`, actual-Worker
`test/test-d3dim-producer-publication-identity.js`, run-local startup and live
context binding regressions, and locked `tools/build.sh`. The first locked build
stalled during region-gate teardown after PASS; its logs and terminated own
process remain recorded. An independent region-gate rerun and the full locked
build retry passed, preserving exact module bytes.

Files-only recovery independently reread remote files and locally verified
**607 references /512 unique hashes**, including original PNGs, actual module
bytes, native saves, source/media pins, and runtime closure. Both successful
Chrome processes and actual runtime parents waited with exit0 and separate
stdout/stderr EOF; no owned runtime processes remained.

Private box **bx_pute8wsm** was created01:21:58Z with initial
expiry02:21:57.835Z. A prearmed independent deadline watchdog and additional
90-second expiry-margin guard were observable. Following verified recovery,
normal delegated stop completed **01:53:41.784Z**: state **archived**, current
expiry **null**, receipt **stop_12299660867789e2**, `forced:false`, `error:null`.
Lifecycle client, durable owner/watchdog, and expiry guard all completed actual
wait/EOF; guards did not fire. No workers or public deployment were launched.
Free/home space remained above the decimal1,500,000,000-byte floor.

## Successor0907: native Town retreat, rest healing, new Save/Load and movement

Run `scratch/runs/20261112-darkstone-native-healing-quest-successor-0907/`
completed the healing objective on the original registered demo using the
published `8a834a3dc7affc8c6e53245beab56e87a32b81e8` runtime closure. Actual
guest and owning renderer Worker modules both matched
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`
(2,189,863 bytes). The original EXE hash above is unchanged. No emulator defect
or production change was demonstrated; the older199cf/a3+1165 fallback was
not substituted.

All659 remote inputs passed complete raw size/hash readback and the provision
process joined successfully before browser launch. The prior four-file union
was mounted through production `loadFiles`; public VFS raw readback exactly
matched the authentic current character and all three preserved maps. Native
Load listed three slots with equal restored file dates. The initially selected
bottom slot proved to be the older10-victory map; no floor movement or attack
was issued from it. Native selection of the middle row showed the11-victory
preview and loaded the actual newest51b49 position. `eleven-panel.png` proves
**Victories11+0, LIFE8/35, MANA25/25, Food25, Gold1713, AC14**, helmet,
sword, cape and shield. This replaces the historical9/35 and gold assumption
with current native readings. A short southeast floor hover had no enemy name
or health bar; one independently released floor click displaced the hero
relative to the wall/timber (`fresh-floor-step.png`). No BAT attack was issued.

Native **Escape → Restart in Town → OK** moved the living hero to the bright
**Town** entrance. This has a material cost: the first Town panel showed
**LIFE2/35, AC6**, empty weapon/cape/shield slots and the helmet remaining.
Gold1713 and victories11 remained. These are observed consequences after the
native restart; equipment recovery and a cost-free retreat are not claimed.
No death screen was observed. Every older authentic save remains available.

The native **To rest** tooltip identified the Z button. One ordinary click
started rest. Full reviewed panels show **LIFE2 →24 →35/35** and
**Food24 →7 →0**, with mana25/25, gold1713 and victories11 unchanged.
No health, inventory, save, config, media, clock or private guest-state writes,
forced guest calls or extra fight were used. `rest-completion.png` proves full
native healing. Hunger subsequently caused a visible1-point loss; food0 is a
real continuation constraint, not a fully supplied character.

Native **Save a Game → New Save** created this complete successor:

| Native file | Bytes | SHA-256 |
|---|---:|---|
| characters.lpl |1342348|`21c4f2d1b4b2e1b92e99e771a6220b1d7df7619a48eb8908021dd04a4a9d55cb`|
| game641d_6af58371.sav |3204341|`4f638503d433e404f84156ee2a96e7b6d9ce4d563c72e4565fc53fd84a173710`|

`earned-town-recovery.json` selects the new pair;
`continuation-whole-file-set.json` references the current character plus all
four maps, with raw and compressed hashes. All three older map hashes remained
unchanged. Older character variants remain in the predecessor evidence; do
not combine an older character index with the new map set. The entire five-file
set was present during the successful ordinary native Load. The selected newest
Town preview showed35/35; `town-reload-health.png` proves the living Town hero
at **35/35, victories11, gold1713, food0, AC6** after normal Load, without any
remount or restoration write. One fresh reviewed southeast floor click then
visibly displaced the cave/trees/building (`town-fresh-walk.png`). Final native
panel at that unsaved position shows **34/35**. The saved continuation remains
the Town entrance; the later verification movement was not saved over it.

The native backend was bound early and alongside complete scene captures to
actual guest endpoint1/slot0 and its owning legacy WebGL renderer Worker. Live
D3DIMGpu targets reported640×480/WebGL2RenderingContext with advancing
renderer completions and zero native software completions. Native Load's live
target replacements were accepted while owner/module replacement guards
remained active. The page presentation canvas was2D. Reported Intel/Mesa
strings do not establish physical GPU execution; no physical-GPU, FPS, audio,
parity, second-backend or full27 qualification is claimed.

Recovery independently reread remote files and locally verified **411
references /373 unique hashes**, including **36 bound full captures,25
balanced pulses,67 trusted input events**, executing module, native files and
runtime disposal. Large unique output logs/module were gzip-compressed before
transfer; source/media were not archived. The existing native-input focused
suite passed6/6; `verify-recovery.py` passed. No production code changed, so
no new build was required. A run-local prelaunch assertion initially omitted
the provider's legitimate `idle` state; it refused before browser launch and
was corrected only after the successful provision join and exact box readback.
No unknown/failed native input was replayed.

Private box **bx_jyjbmap2** had an initial55-minute lease, expiry
**2026-11-12T10:00:26.653Z**, and an observable independently prearmed
watchdog. Runtime and Chrome actual parent waits returned0 with separate
stdout/stderr EOF and their processes absent. Following verified retrieval,
normal delegated stop completed **09:19:02.054Z**: **archived**, expiry**null**,
receipt **stop_d0c0df290c3671f7**, `forced:false`, `error:null`. Lifecycle
client, durable owner and watchdog actual waits/EOF also completed0; the
watchdog did not fire. No workers or public deployment were launched; free/home
space stayed above1,500,000,000 bytes.

Next: load the new Town successor, obtain native food with a fresh gold/UI
reading, and address missing equipment or its recovery before returning to
combat. The older51b49 equipped dungeon continuation is preserved as an
alternative, with its original low-health risk.
