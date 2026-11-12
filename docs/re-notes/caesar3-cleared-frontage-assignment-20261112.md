# Caesar III demo: cleared frontage and Senate attempt, 2026-11-12

The changed native layout reached **133 residents**, versus the parent run's 76, but did **not** reach 150 or transition assignments. The final reviewed city was **116 residents, 933 denarii, March 499 BC**. No emulator mismatch was demonstrated and no production code changed.

Evidence: `scratch/runs/20261112-caesar3-cleared-frontage-assignment-1030/` (`fresh/` is the played run). Preserve the parent `20261112-caesar3-current-population-assignment-0927/RESULT.md`; this note does not replace its evidence or the root-owned `caesar3-demo.md`.

## Native progress and causal limits

Started through the original title, unchanged approved name C, Assignment 1, and To the city. Used Space pause and the native speed dialog at 100%; no clock/resource/population/config writes, forced calls, patch, or Save workaround. This is 2D city gameplay.

While paused, placed 34 housing plots along cleared road frontage and six wells. Small tents held five people. After live service updates, an occupied tent reported water resolved, spare capacity, and a desirability requirement suggesting gardens (`post-water-house-panel`). A later five-occupant tent still requested desirability (`branch-vacancy-panel`). The Population advisor says “Not available in this assignment!” (`population-conditions`).

At the first-fire unlock, built two prefectures. Both showed 6/6 employees and a prefect out patrolling in August 500 BC (`west-prefecture-panel`, `east-prefecture-panel`). Population passed 100, reached 114, then fell after the first collapse. Immediately after the collapse unlock, placed an Engineer's Post. Fire and collapse damage left ruins and reduced occupied capacity; staffing alone did not establish walker coverage of every house.

Cleared a separate northern 5-by-5 forest area using individual balanced clicks while paused, reviewed the green native Senate preview, and built the Senate for 200 denarii (`senate-cleared-preview`, `senate-built`). No occupied housing was demolished and the Senate was not demolished. An earlier misidentified Undo removed one vacant plot only, with its refund; this was not the clear-land tool. The original 180 ms construction pulses sometimes had no effect; the frozen parent 1,500 ms balanced native-click helper then produced the reviewed builds. Both outcomes are retained.

Built a western bypass, fourteen replacement plots on cleared frontage, two more wells, a second Engineer's Post, and a third prefecture. A candidate road-branch house proved occupied, so the road went around it. The replacement housing attracted migrants and population reached **133 in October 500 BC**, triggering the native Pleasing the Gods tutorial (`replacement-growth-20`). The group stopped on that unexpected modal. Further fires coincided with 125 in December, 128 in February 499 BC, and a paused 127 before the final interval.

The decisive reviewed conditions were:

| Native evidence | Observation |
| --- | --- |
| `engineer-west-staff`, `engineer-central-panel` | Both posts: 5 employees, 5 needed; engineer out working, no downtime. |
| `prefecture-upper-actual` | New bypass prefecture: 6 employees, 6 needed; prefect out patrolling, roster full. |
| `northern-vacant-actual` | Vacant lot: no people in locality; migrants may arrive if the city has food and jobs. |
| `branch-vacancy-panel` | Occupied small tent: five occupants, desirability/gardens requirement; some crime, nothing serious. |
| `prefecture-upper-panel` | This was actually a Well panel, not prefecture evidence: well-water neighbourhoods are undesirable. Correct ground-tile inspection is `prefecture-upper-actual`. |
| `senate-staff-panel` | Senate not operational: no adjacent road, no employee access, 0/30 employees. |
| `senate-gap-road`, `final-growth-30` | Native Senate hover: unemployment 63%, then 62%. |
| `senate-final-panel` | After one more paid road cell and a live interval, still no adjacent road and 0/30 employees; city 116/933, March 499 BC. |

The bypass visibly reached the Senate area, but did not satisfy the native footprint's adjacency rule, even after the additional cell. **The Senate road connection remained unresolved.** Do not describe it as operational or road-connected. The population blocker is a combination of damaged occupied capacity, vacant plots, poor desirability, and high unemployment; the native panels support these conditions, but do not isolate a single immigration formula or prove a food shortage. No legitimate housing upgrade was achieved. No 150/assignment-transition or save acceptance claim is made.

Next native attempt should first verify actual Senate ground-footprint road adjacency and employees, provide jobs/desirability near compact housing, and inspect walker coverage before extending the road network or advancing years. A compact protected block would avoid spreading walkers along this long bypass.

## Provenance, evidence, and lifecycle

Runtime source base: `8a834a3dc7affc8c6e53245beab56e87a32b81e8`. The run records exact Git provenance and relevant uncommitted binary diff; Git remains the source archive. Original registered `caesar3_demo` EXE/DLL plus 112 data files were pinned. EXE SHA-256: `d7c73f21d3837b1fc465a6035f4fea6ab5a7eddf62907c72c4dd076a5193d236`. Captured module SHA-256: `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

Frozen parent helpers were checked before launch (`parent-frozen-helpers-verified.json`, `fresh/slowclick-frozen-verified.json`). Run-local derivations, including pointer-only preview and lossless evidence storage, are retained as patches; they do not change the emulator. Provisioning completed and its actual parent joined successfully before browser launch: 688 provisioned files, 686 runtime pins. Final remote runtime hashes passed unchanged. One early pre-provision launch request failed its local gate without launching a browser.

`fresh/retrieval-manifest.json` records **2,012** unique recovered files with independent remote rereads. All local recovered raw/gzip hashes passed. **293** captures had already been retrieved and SHA-verified by the frame helper; their exact encoded PNG bytes are retained losslessly in `fresh/capture-bytes.xz`, indexed by original path, byte offset, size, and SHA-256 in `capture-byte-index.json`. To recover a named image, decompress the pack, take the indexed byte slice, verify its SHA-256, and write those bytes as PNG. This is a capture-only byte pack, not a source/media archive. Final runtime module and logs are gzip-compressed with raw and stored hashes. `retrieval-verified.json`, `local-compression-map.json`, and run `SHA256SUMS` document verification.

Shared writes took `/home` below the 1.5 GB floor during the final interval. Gameplay stopped; own evidence was compressed without discarding unique captures. Free space recovered above 1.5 GB before finishing. The breach and cleanup are retained rather than treated as a passed continuous disk-floor check.

Two fresh private boxes were created with a prearmed independent 55-minute watchdog:

- `bx_86wshecg`: pre-browser upload timeout, no replay or browser launch. Normal stop archived at 10:29:42.699 UTC; `stop_8f2bedb39388bbea`, completed, unforced, no error, expiry null. Manager parent and watchdog actually joined with code 0 and both EOFs.
- `bx_hfrtyg2v`: played run; initial expiry **11:24:39.897 UTC**. Unique evidence retrieval and local hashes completed before the normal delegated stop request. Archived **11:24:24.581 UTC**, expiry null, `stop_8951151fd887ad60`, completed, unforced, no error. Browser closed with Chrome code 0; actual runtime parent wait code 0 with both EOFs, all runtime PIDs absent, profile removed, server port closed. Watchdog actual wait code 0 with both EOFs.

The played run's outer tool session 49621 returned **143**; `manager-parent-wait.json` was absent. Its cause is unknown. Manager/watchdog processes were subsequently absent, and normal stop plus actual watchdog join are independently recorded, but **a successful local manager-parent join is not proved**. `local-launcher-join.json` preserves this lifecycle limitation. No box remains running or was retained, resumed, deleted, or publicly deployed.
