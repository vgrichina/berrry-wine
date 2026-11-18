# Windows 9x wiki corpus gaps — 2026-11-18

Of **150 source-backed indexed title rows, 103 have no identified registry or local-media match**. Another 42 have demo, trial, shareware, edition or DOS-wrapper coverage only. Two base-title registrations have their declared media available; Civilization II has incomplete declared disc media; two titles have unregistered local media. These are availability findings, not playability results.

## Source and limits

Source: [Windows 9X Compatibility List](https://emulation.gametechwiki.com/index.php/Windows_9X_Compatibility_List), search-indexed [revision 151531](https://emulation.gametechwiki.com/index.php?title=Windows_9X_Compatibility_List&oldid=151531), retrieved 2026-11-18. Direct page, revision, printable and API routes returned HTTP 403. **The inaccessible current live page was not fully checked.** Six independently issued indexed-query responses recovered all 131 supplied titles and 19 additional factual first-column title rows. Individual responses omit different rows; the 150-row union is the supported comparison universe, not proof that no further rows exist in the revision or current page.

The 19 additions are Fallout 2; Fatal Racing (Whiplash); FIFA 2000; FIFA 2001; FIFA 2002; FIFA World Cup 2002; Full Throttle; Gangsters: Organized Crime; X-Tension; I Have No Mouth, and I Must Scream; Icewind Dale; Jagged Alliance 2; Jane’s F-15; MechWarrior 2; Midtown Madness; Trophy Bass; Unreal; Unreal Tournament; Ultima Online. Each has an indexed-response line reference. The literal first-cell text `Street Fighter Alpha: Warriors' DreamsStreet Fighter Zero` remains one row: its concatenated regional names were not split into invented rows. Source compatibility ratings are not adopted as evidence about this runtime.

## Availability comparison

Categories are exclusive per wiki title. A same-title demo remains category 5 even when its media is complete. Category 2 applies when a base-title registration exists but its required media is incomplete. Auxiliary installer failures remain visible per registration even if an installed demo is available.

| Category | Supported union | Original 131 | Meaning |
| --- | ---: | ---: | --- |
| 1. Registered, available | 2 | 2 | DX-Ball; Moorhuhn 2 |
| 2. Registration, missing media | 1 | 1 | Civilization II: both registered editions lack declared Track 01 BINs |
| 3. Local media, unregistered | 2 | 2 | American McGee’s Alice demo; The Sims collection disc/installer |
| 4. No identified corpus/media match | 103 | 88 | Full prioritized list below |
| 5. Ambiguous or variant-only | 42 | 38 | Demo/trial/shareware, separate edition or DOS wrapper; no full retail match established |
| Total | 150 | 131 | All supplied titles preserved |

Across categories, **44 titles have available registered media**, represented by 54 available matched registrations. Five matched registrations have missing media. These registration counts include renderer configurations, installers and setup utilities, not 59 distinct games.

The audit loaded the actual `APPS` (367 entries), `DESKTOP_APPS` (48) and `LOCAL_CANDIDATE_APPS` (197) exports from `lib/apps.js`. It checked executable existence and hashes, inline assets, DLLs, merged browser manifests and referenced CUE members. Declared optional assets do not cause an availability failure. Source Git HEAD was `d7321705a1480a0c0d9ec8ba63905b8bdf433acd`; exact source-file hashes are in the run’s `source-state.json`. Git and the retained source diff identify the inspected shared-tree version.

Media inspection covered 76,861 paths under `test/binaries`, `packages`, `scratch/game-media`, `scratch/media`, `scratch/recovery`, `build/nfs2se-demo`, Downloads and Documents; `binaries` resolves to `test/binaries`. Another 3,388 retained-run executable, COM, ISO, CUE and browser-manifest paths were reviewed. Registry membership alone, candidate download recipes and old remote-run notes do not establish present media. This is not a whole-disk or opaque-archive absence assertion.

## First actions

1. **Restore declared Civilization II disc members.** `civ2_win16` and `civ2_mge` have executables, extracted assets and valid browser manifests, but their CUEs reference absent data tracks:
   - `test/binaries/candidates/civilization-2-win16/Sid Meier's Civilization II (USA) (En,Fr,De) (Track 01).bin`
   - `test/binaries/candidates/civilization-2-mge-win32/Civilization II - Multiplayer Gold Edition (USA) (Track 01).bin`
   The mixed-mode provider opens all referenced parts; extracted files and remaining audio tracks do not make these registered launch configurations complete. Base Win16 retail and Multiplayer Gold remain separate editions.
2. **Review already-local unregistered media.** Alice has `test/binaries/candidates/alice-demo/alice.exe` and a manifest with all 14 declared files present. The Sims has `test/binaries/sims-complete-collection/static/Disc1/Sims.exe`, setup executable and `data1.hdr`, but no browser manifest. That Sims executable is a disc front-end; the installed-overlay index contains only IKernel files, not an established installed game. Neither title has an `APPS` entry. Both remain edition-limited.
3. **Recover the two documented missing demos first:** Command & Conquer: Tiberian Sun and Star Wars Jedi Knight: Dark Forces II. Historical notes provide recovery leads, not present media. The inspected external `jedi-recovery.tar.gz` contains a notepad fixture and no Jedi game executable.
4. **Treat installer-only gaps separately.** `diablo2_demo_installer` lacks `DiabloIIDemo.exe`; `halflife_uplink_installer` lacks `hluplink.exe`; `quake2_demo_installer` lacks `q2-314-demo-x86.exe`. Their installed demo registrations are available. Exact full paths are in `matches.csv` and `comparison.json`.

The 42 variant-only titles are listed in the complete table with exact app IDs and executable paths. Daggerfall specifically hosts `DOSBOX/DOSBox.exe` around DOS/CauseWay `FALL.EXE`; it does not establish a native Windows Daggerfall port. Uplink does not supply Counter-Strike or Team Fortress; Quake II/III do not supply Quake; Thief II does not supply Thief; Tomb Raider II/III do not supply Tomb Raider or The Last Revelation. Original 1998 Army Men staging does not supply Toys in Space. Driver’s positive match is `driver_demo`’s actual `game.exe`, not a driver script. Unreal Special Edition OEM demo and Tournament 348 demo are separate entries; later Tournament sequels do not substitute for either. A concurrent board update added four GOTY retail runtime files under `scratch/runs/20261118-owner-compatibility-issue30/ut-goty-selected/`; their existence and SHA256s were checked and recorded in `additionalLocalVariantMedia`. They lack complete game assets and a browser manifest, so category 5 remains unchanged. This later evidence supplements the earlier media-path scan.

## Prioritized missing-title list

All 103 category-4 titles follow, with original source spelling preserved. P1 means a documented earlier demo offers a recovery lead; P2 means establish the exact Windows port/edition before sourcing because DOS variants are easy to confuse; P3 means identify period Windows media. This is an acquisition/identity worklist, not an instruction to launch games or a compatibility ranking. P2 is illustrative rather than an exhaustive list of titles with DOS variants.

| Priority | Wiki title |
| --- | --- |
| P1 | Command & Conquer: Tiberian Sun |
| P1 | Star Wars Jedi Knight: Dark Forces II |
| P2 | Blood |
| P2 | Descent |
| P2 | Descent II |
| P2 | Duke Nukem 3D |
| P2 | Fatal Racing (Whiplash) |
| P2 | Hexen |
| P2 | Screamer |
| P2 | Shadow Warrior |
| P2 | Shannara |
| P2 | Strife |
| P2 | Terra Nova: Strike Force Centauri |
| P2 | The Dig |
| P2 | The Settlers II |
| P2 | Tomb Raider |
| P2 | Tyrian |
| P2 | Warcraft: Orcs & Humans |
| P3 | Airfix Dogfighter |
| P3 | Alien Nations |
| P3 | Alone in the Dark 3 |
| P3 | Anno 1503 & 1503 A.D |
| P3 | Army Men: Toys in Space |
| P3 | Bad Mojo |
| P3 | Beach Life |
| P3 | Bermuda Syndrome |
| P3 | Black & White |
| P3 | Blackout |
| P3 | Blade Runner |
| P3 | Carmageddon |
| P3 | Close Combat |
| P3 | Command & Conquer: Red Alert 2 |
| P3 | Deadlock: Planetary Conquest |
| P3 | Desperados |
| P3 | Earth 2150 |
| P3 | eRacer |
| P3 | Eradicator |
| P3 | Europa Universalis |
| P3 | EverQuest |
| P3 | F1 2000 |
| P3 | Fallout 2 |
| P3 | FIFA 2000 |
| P3 | FIFA 2001 |
| P3 | FIFA 2002 |
| P3 | FIFA World Cup 2002 |
| P3 | Full Throttle |
| P3 | Gangsters: Organized Crime |
| P3 | Gothic |
| P3 | Gothic II |
| P3 | Grand Prix 3 |
| P3 | Grim Fandango |
| P3 | Half-Life: Counter-Strike |
| P3 | Harry Potter and the Philosopher's Stone |
| P3 | Hot Wheels Jetz |
| P3 | I Have No Mouth, and I Must Scream |
| P3 | Jagged Alliance 2 |
| P3 | Jane’s F-15 |
| P3 | Magic: The Gathering |
| P3 | MechWarrior 2 |
| P3 | Meridian 59 |
| P3 | Midtown Madness 2 |
| P3 | Mortal Kombat 4 |
| P3 | NASCAR Heat |
| P3 | NBA Live 2001 |
| P3 | NHL 2001 |
| P3 | NHL 2002 |
| P3 | Panzer Elite |
| P3 | Planescape: Torment |
| P3 | POD |
| P3 | Postal |
| P3 | Quake |
| P3 | Resident Evil |
| P3 | Resident Evil 3: Nemesis |
| P3 | Sanitarium |
| P3 | Silent Hunter |
| P3 | SimCity 3000 |
| P3 | SimCity 4 Deluxe |
| P3 | Space Empires IV |
| P3 | Spider-Man (Neversoft) |
| P3 | Star Control 3 |
| P3 | Steel Panthers |
| P3 | Street Fighter Alpha: Warriors' DreamsStreet Fighter Zero |
| P3 | Sudden Strike |
| P3 | SWAT 3 |
| P3 | Syberia |
| P3 | Team Fortress 1.5 |
| P3 | The Beast Within: A Gabriel Knight Mystery |
| P3 | The House of the Dead |
| P3 | The House of the Dead 2 |
| P3 | The Last Express |
| P3 | The Pandora Directive |
| P3 | The Settlers III |
| P3 | The Settlers IV |
| P3 | The Wheel of Time |
| P3 | Thief: The Dark Project |
| P3 | Tomb Raider The Last Revelation |
| P3 | Trophy Bass |
| P3 | Ultima Online |
| P3 | Vangers |
| P3 | Viper Racing |
| P3 | Warcraft II |
| P3 | Warlords III |
| P3 | X-Tension |

## Evidence and reproduction

Complete artifacts are retained in [`scratch/runs/20261118-win9x-wiki-corpus-gaps/`](../scratch/runs/20261118-win9x-wiki-corpus-gaps/):

- [Complete JSON](../scratch/runs/20261118-win9x-wiki-corpus-gaps/comparison.json) and [complete CSV](../scratch/runs/20261118-win9x-wiki-corpus-gaps/comparison.csv): all 150 titles, categories, exact app IDs, paths, actual existence, manifest availability, missing members, match basis, rejected sequels/variants, source and historical evidence references.
- [Per-registration CSV](../scratch/runs/20261118-win9x-wiki-corpus-gaps/matches.csv) and [prioritized missing CSV](../scratch/runs/20261118-win9x-wiki-corpus-gaps/missing-titles.csv).
- `wiki-universe.json`, six `indexed-validation*.json` responses and `public-route-checks.json`: revision, all original and added titles, literal indexed row references and 403 limitations. JSON response files encode response text; line references address the decoded text.
- `registry-audit.json.gz`: full derived asset/DLL/CUE inventory; `manual-media-review.json`: per-title decisions; media path lists and `jedi-recovery-members.txt`: bounded local inspection.
- `source-state.json`, `relevant-source.diff`, `helper-source.patch`, `report.patch`, publication receipts and final `result.json`: version, recovery and publication evidence. Run helpers are retained as `audit.cjs`, `enrich.cjs` and `validate.cjs`; use the recorded Git source and currently available media to reproduce. Recovery needs the named external media and indexed inputs, not source snapshots.

Run-local validation passed: 150 unique rows, all 131 originals independently recovered, 591 indexed row references, 59 executable records, 32 manifest checks, 12,984 file/stat checks, stable source and historical-note hashes, category totals, sequel/DOS exclusions and CSV round-trips. No tracked tests read scratch. This documentation-only change requires no full code build.

`retainedEvidence` is separate from availability: existing notes are linked with hashes and bounded summaries; their underlying runtime captures were not revalidated. All current playability values remain **UNKNOWN**. No new launch, gameplay test, media download, registry edit, Wine reference run, worker, box or deployment occurred. Box ID, expiry and stop receipt are null; state is `NOT_CREATED`.
