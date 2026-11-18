# Darkstone earned Town → Ardyl: missing complete checkpoint

The authorized onward attempt stopped before browser/runtime preparation on
2026-11-18. The full earned Town checkpoint is unavailable locally. No game was
launched, no input was dispatched, and no quest/combat consequence, new Save,
normal Load or native Quit is claimed. Earlier accepted progress remains
historical evidence: victories11, Food82, Gold393, sword equipped, AC6 and
LIFE35/35. No older checkpoint was substituted.

Read the current AGENTS.md, CLAUDE.md, recent messageboard and
`docs/re-notes/darkstone-current-worker-gameplay-20261112.md`, including its
food/sword and bank0/service sections. The later1045 manifest also selects the
same supplied checkpoint and explicitly records no new Save. That run's
unsupported-Tab helper failure does not establish an emulator defect or supply
a newer earned continuation.

Run evidence: `scratch/runs/20261118-darkstone-earned-town-ardyl-onward/`.
`checkpoint-audit.json` records exact manifest hashes, per-file checks and the
local payload search. Each of these three predecessor directories has the same
six expected compressed save names under `recovered/webgl-current/`:

- `scratch/runs/20261112-darkstone-town-food-equipment-0925/`
- `scratch/runs/20261112-darkstone-town-quest-equipment-funding-0959/`
- `scratch/runs/20261112-darkstone-ardyl-quest-recovery-route-1045/`

All18 recorded paths return ENOENT. The exact filename for each row below is
`save-<complete raw SHA-256>.bin.gz`; each manifest additionally records the
compressed SHA-256. None of the six required raw hashes was recovered by the
local search.

| Native path | Raw bytes | Required raw SHA-256 |
|---|---:|---|
| `c:\dsave\characters\characters.lpl` |1342356|`ef58a000a453f5917909f794552800a487337f781c8c2e9d5ff129696b2168f4`|
| `c:\dsave\games\game641d_6af517ab.sav` |3204341|`cf3e16cb8fc4de6477e4a1bba4052e312bfce9688e37e682154d10335b39d3bd`|
| `c:\dsave\games\game641d_6af51b49.sav` |3204341|`551e1127dad968e8749ef86aec035a93c497c76596188e825e985eb67da3bd9f`|
| `c:\dsave\games\game641d_6af0de53.sav` |3204341|`cb2ca8093b2ffe45133cda87e3eea9ceafad66fd82246684ec40dd97306e66fc`|
| `c:\dsave\games\game641d_6af58371.sav` |3204341|`4f638503d433e404f84156ee2a96e7b6d9ce4d563c72e4565fc53fd84a173710`|
| `c:\dsave\games\game641d_6af58b24.sav` |3204385|`8032bfe798828bcd6b8f3a15b77b6ba1cf859c66ff7446707da541f6d7427131`|

The run-local JavaScript audit used `rg --files --hidden --no-ignore /home/user`
and hashed79 candidate payloads from Darkstone-named locations, selecting raw
files of the required sizes and gzip files (decompressed in memory). Zero
required raw hashes matched. This is a local availability finding, not a claim
that no copy exists elsewhere. The first audit invocation exceeded its buffered
file-list capacity before writing a report; the retained helper streams the
listing and its completed search exited0. No runtime scope existed during either
invocation.

The original installed executable remains at
`test/binaries/win98-games-a-d/DarkstoneDemo-D3D/installed/darkstonedemo.exe`,
1298432 bytes, SHA-256
`b43db5e1b835eb1e93688a1f3f1d9c814517be6fc8110c7fb6e024d467ee721b`,
matching the owner pin. No download, installer, media copy, archive, save/state
edit, service retry or gameplay macro was used. No runtime defect or code repair
was demonstrated; this documentation-only change requires no locked build.

Dependency for a future authorized continuation: recover all six authentic
whole files above and verify every raw size/hash, then mount through normal
loadFiles/nativeLoad. The historical manifest alone cannot recreate earned
game state. Do not combine an older character index with these maps. Identify
the supplied Town slot by its native preview and live readings rather than row
number. Direction/quest inspection and Ardyl consequence remain unattempted in
this task.

No browser, game process, renderer, endpoint, watchdog, box or worker was
created. Actual runtime module/guest/renderer identities, whole PNGs and native
waits are therefore null/empty. The messageboard watcher was the sole owned
long-lived process and was terminated and waited during cleanup. Box ID null,
state NOT_CREATED, expiry null, stop receipt null. Free/home samples stayed
above1.5GB; no RAM gate was used. Exact Git/patch records, dependency audit,
publication and cleanup receipts precede the final result.json.
