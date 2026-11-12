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

## Successor0925: native food, sword purchase, supplied Town Save/Load

Run `scratch/runs/20261112-darkstone-town-food-equipment-0925/` advanced the
healed Town continuation through native purchases before any combat. Runtime
remains `8a834a3dc7affc8c6e53245beab56e87a32b81e8`, executing module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Original EXE/media are unchanged. No production change or emulator defect was
demonstrated. This evidence-only work required no build; the coordinator
subsequently reviewed and published the completed documentation.

All **664** inputs passed full remote size/hash readback and the provision
process joined successfully before browser launch. Production `loadFiles`
mounted the preferred current character and all four authentic maps. PublicFS
raw readback matched all five whole files. Native fourth-slot Town preview,
ordinary Load and live panel confirmed **LIFE35/35, Food0, Gold1713, AC6,
Victories11+0**, helmet only. A fresh floor click displaced the hero before
approaching town services. No older-map rollback was substituted.

The native route passed Elmeric's counter and Larsac's storefront to **Perry
the Publican**, beside the green cup sign. Elmeric's stock was inspected
without purchase. Perry's Buy stock showed Gold1713 and hovered **Food
(Gold120), Food20**. Purchase confirmation debited **1713→1593** and added
roasted food to the empty bag. Current panel then showed **LIFE21/35, Food0**:
hunger had continued during navigation. Native hover said **Right click to
eat**. One balanced right click removed the purchased item and changed numeric
**Food0→99**, with Life21/35 and Gold1593 unchanged. The stock's Food20 and
observed99 are both retained; the discrepancy has no demonstrated cause or
emulator fix. The permanent apple icon is not used as numeric food evidence.

Native **To rest** healed **21→35/35**, consuming **Food99→88**, with
Gold1593 unchanged and **You are in full health again** displayed. Later
movement retained35/35 life as food declined normally.

**Gunther the Blacksmith → Buy → Warrior** showed:

| Item | Gold | Native properties |
|---|---:|---|
| Sword |1200|Damage1–5, durability10/10, required20STR|
| Shield |1350|Armour4, durability15/15|
| Rags |900|Armour2, durability20/20|
| Axe |2250|Unaffordable with1593 gold|

Two early review strings misread sword requirement10STR; the full stock and
equipped images prove20STR, matching hero20STR. The **Buy Sword /1200 Gold
Pieces** confirmation debited **1593→393**. Native panel proved automatic
equipment: an equipped sword and helmet-shaped paperdoll graphic, empty bag,
damage **2–2→2–6**,
LIFE35/35, Food82, Gold393, Victories11+0 and AC6. No extra equip input or
fight was used. **Shield and body armour remain absent**:393 gold cannot buy
Shield1350 or Rags900. Full equipment recovery/combat readiness is not claimed;
stay in Town for legitimate quest/funding/recovery before combat.

Native **Save a Game → New Save** created:

| Native file | Bytes | SHA-256 |
|---|---:|---|
| characters.lpl |1342356|`ef58a000a453f5917909f794552800a487337f781c8c2e9d5ff129696b2168f4`|
| game641d_6af58b24.sav |3204385|`8032bfe798828bcd6b8f3a15b77b6ba1cf859c66ff7446707da541f6d7427131`|

`earned-town-food-sword-recovery.json` selects the new pair;
`continuation-whole-file-set.json` references current character plus all five
maps with raw/compressed hashes. All four older maps, including healed Town
58371, remained byte-identical. Older characters remain in predecessor runs;
do not mix older character indexes with this map set. Native fifth/newest
slot preview and ordinary Load, without remount, restored living Town by
Gunther with **35/35 life, Food82, Gold393,11 victories,sword equipped,AC6**.
The later0959 check could not establish the helmet graphic as an actual item.
One fresh reviewed pavement click visibly displaced hero/shop/fence. Final
unsaved capture retained **35/35 life, Food80**. Save precedes that walk.

Early/per-capture binding identified actual guest endpoint1/slot0 and its
owning legacy WebGL renderer Worker, both on the exact module above. Live
640×480 targets reported WebGL2RenderingContext; renderer error0 and native
software completions0. Normal Load's legitimate live GL target replacements
were accepted with owner/module guards retained. Page canvas2D and reported
Intel/Mesa strings do not establish physical GPU execution. No FPS/audio/
parity/second-backend/full27 qualification is claimed.

Recovery independently reread and locally verified **903 references /819
unique hashes**, including **82 bound full captures,54 balanced pulses and
165 trusted events**, executing module, native files and runtime disposal.
Large unique output logs/module were compressed remotely before transfer;
local exact duplicates were hardlinked without dropping unique evidence.
Git commit/diff/helper patches provide source recovery; no source/media
archive was created. Native-input tests passed6/6; `verify-recovery.py` passed.

Private box **bx_q55uqfez** had an initial55-minute lease expiring
**2026-11-12T10:19:37.383Z** and an independently prearmed watchdog. Runtime/
Chrome actual parent waits returned0 with separate stdout/stderr EOF and
owned PIDs absent. After verified retrieval, normal delegated stop completed
**09:52:50.292Z**: **archived**, expiry **null**, receipt
**stop_7ff1a4931f887b2f**, `forced:false`, `error:null`. Lifecycle client,
durable owner and watchdog actual waits/EOF completed0; watchdog did not fire.
No workers/public deployment; free/home stayed above1,500,000,000 bytes.


## Successor0959: Town funding and service checks; consequence blocked

Run `scratch/runs/20261112-darkstone-town-quest-equipment-funding-0959/`
replayed the preferred0925 supplied checkpoint, then inspected native Town
funding, dialogue and equipment-service options. **No new quest receipt,
journal entry, funding gain or equipment improvement was demonstrated. No new
Save was created.** This is a concrete Town-route blocker, not an earned new
checkpoint. The prior food/sword purchases are not counted again.

Runtime remains exact `8a834a3dc7affc8c6e53245beab56e87a32b81e8`, with
actual guest and owning renderer modules both SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
All666 provisioned inputs passed remote full raw size/hash readback and the
provision call joined successfully before browser launch; exact box identity,
idle state and lease were checked. GitPinBytes overrides were0. Original
EXE/media pins are unchanged. No production change or emulator defect was
shown; no build was required for this evidence-only documentation.

Production `loadFiles` mounted current character ef58a000 and all five maps,
and publicFS raw readback matched all six complete authentic files. Equal
restored file dates made row position unreliable: the initially highlighted
fifth row previewed the **older healed Town**, Gold1713, and fourth previewed
a dungeon BAT. Neither was loaded. **Third row** previewed the actual newest
suppliedTown by Gunther, Gold393, Food82, LIFE35/35,11 victories, AC6 and sword
damage2–6. Ordinary Load and live inventory confirmed those values; a fresh
pavement click visibly displaced hero/shop/fence before further exploration.
Future workers must identify the newest state by preview and live readings,
not assume a fifth-row position after remount.

Native quill tooltip identified adventure history (H MODE). Opening it before
and after dialogue produced no visible entry/panel. Gunther's **Talk to** and
Larsac's **Talk to** each returned to services after native dialogue delay,
without visible quest receipt or reward. Krym's performer interaction likewise
demonstrated no quest change. No audio/dialogue-content claim is made.

Master Dalsin's actual teaching panel offered **Trade Level1(800)** and
**Repair Level1(800)** against Gold393. Larsac's coin-sign storefront led to
**Bank Account → current balance0 gold pieces**, with Deposit/Withdraw/Exit;
no transaction was made. This corrects the prior request-string label
"Larsac the Sorcerer": the native heading is **Larsac the Usurer**. The
[original manual](https://dsdb.it-taucher.at/attachments/212_Darkstone%20Manual.pdf)
identifies Larsac's bank, describes blacksmith enhancement's durability cost,
and directs initial quest exploration into Ardyl after leaving Town. Manual
pages25,27,30 were individually reviewed; no quest beyond Town was attempted.

Gunther's **Repair** grid was empty. **Upgrade** produced no visible
transition, price or property change, both with sword equipped and after
ordinary inventory clicks moved the same sword into the bag. Its tooltip
proved **damage1–5, durability10/10, required20STR**. The bag-transfer check
was made beside Gunther after a second ordinary Load of the **same supplied
map**, discarding unsaved navigation only; no remount or older-map rollback
occurred. Native inventory clicks then re-equipped the retained sword,
restoring panel damage2–6 and leaving the bag empty. No sale, repurchase,
resource edit, forced guest call, combat or new native Save occurred.

The helmet-shaped paperdoll graphic from earlier notes did not yield item
properties or respond to centered selection; this run cannot independently
qualify it as a selectable retained helmet. The sword was positively selected,
bagged and re-equipped with corresponding damage readings. Do not count the
graphic alone as a recovered armour item. AC remained6 throughout.

The observed blocker is **bank0 / carried393**, compared with previously
observed Rags900 and Shield1350 and newly observed skills800; no repair
candidate, no visible Upgrade response even with bagged pristine sword, and
no visible Town quest receipt. The cause of Upgrade's unavailable response is
unproven; no demo limitation or emulator defect is inferred. A native Ardyl
quest/funding/recovery route remains a possible next task, requiring careful
planning around absent armour/shield and the retained sword. Random combat
alone is not a substitute for that objective.

Final fresh native pavement movement again displaced the hero. The final
unsaved panel showed **LIFE35/35, Food77, Gold393,11 victories, AC6,
damage2–6**, sword equipped, empty bag. Final publicFS raw readback matched
**all six input files byte-for-byte**, including the current character and all
five older/newest maps; the saved supplied checkpoint still hasFood82.
`continuation-whole-file-set.json` will describe that unchanged checkpoint,
not a new earned save. Older character indexes remain separate in predecessor
evidence and must not be mixed into this set.

Recovery verified 1101 remote references /998 unique
hashes,101 bound full captures,74 balanced pulses and223 trusted events. All
six authentic files remained unchanged. The existing native-input suite passed
6/6 and documentation diffcheck passed. Per-frame bindings retained actual
guest endpoint1/slot0 and owning legacy WebGL renderer Worker/module identity,
accepting native Load's legitimate live target replacements. No physical-GPU,
FPS,audio,parity,second-backend or full27 qualification is inferred. Unique
large outputs were remotely compressed before transfer; no source/media
archive was created. Git SHA/diff/helper patches provide source recovery.

Private box **bx_b3wyase6** began with55-minute expiry
**2026-11-12T10:54:36.686Z**, with independently prearmed observable watchdog.
After verified recovery, normal delegated stop completed
**2026-11-12T10:40:27.175Z**: state**archived**, expiry**null**, receipt
**stop_7e54932022b6490b**, `forced:false`, `error:null`. Remote runtime and
Chrome actual parent waits were0 with separate output EOF and PIDs absent.
Local durable command/watchdog actual parent-wait records and outer drains
reported0/EOF; the independent deadline watchdog also joined0 and did not
fire. **The outer tool launcher session55848 returned143**, with no
`lifecycle-client-wait.json` or wrapper-owner wait record. Its cause and full
outer-client wait are unproven; recorded lifecycle PIDs were absent. This
local launcher discrepancy is preserved separately from the successful remote
runtime waits and verified normal box stop. No worker/public deployment was
launched; free/home remained above1,500,000,000 bytes.

Main HEAD at handoff is `81e4c9b27cfba18286809236bbaa0bd600a14c0f`; no new commit was created under the explicit
evidence-only constraint. RESULT.md, RECOVERY.md, retrieval-verified.json,
SHA256SUMS.json and the unchanged continuation manifest are retained in the
run. The coordinator subsequently verified the recovered references and full
bank/final inventory images and adopted this whole-file documentation.
