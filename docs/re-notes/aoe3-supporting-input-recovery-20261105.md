# Age of Empires III trial supporting inputs recovered — 2026-11-05

Recovered and independently rehashed **208 files / 572,051,434 bytes** in
`scratch/game-media/aoe3-installed-20261105/`. The original installer stays at
`scratch/game-media/aoe3-demo-20261105/aoe3trial.exe`; its existing 383,598,224 bytes
and SHA-256 `4ef69289dfa0817ec14942d85ef597835a9d2b09e1506c60b9938b20daa274ad`
were verified in place. No installer copy, extraction or execution occurred.

| Canonical relative directory | Verified files | Bytes |
| --- | ---: | ---: |
| `installed/` | 174 | 569,072,090 |
| `dependencies/test/binaries/` | 3 | 576,565 |
| `dependencies/runner/node_modules/` | 28 | 650,518 |
| `native-dxdiag/` | 2 | 1,736,373 |
| `configuration/` | 1 | 15,888 |

The executable is `installed/Age of Empires III/age3.exe`, **8,826,880 bytes**,
SHA-256 `5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256`.
All 174 installed paths, sizes and hashes match the original installed manifest,
including game DLLs/assets and `System:System/{msxml4.dll,msxml4r.dll}`.
The three runtime fixtures are the original `msvcrt.dll`, Explorer98
`shlwapi.dll`, and `stdole2.tlb`; their exact subpaths and pins are in the inventory.
The 28 runner dependency files reproduce the recorded PNGJS dependency manifest.

Evidence is `scratch/runs/20261105-aoe3-supporting-input-recovery/`:

- `inventory.json` enumerates every canonical file, hash, size and verification;
  `missing` is empty. Root free space after verification was **8,247,525,376 bytes**,
  above the required 5 GB floor, also checked during streaming.
- `installed-manifest.json`, `runtime-pins.json` and `runner-manifest.json` are
  exact recovered manifests, respectively SHA-256
  `833ea4033ba01bc09d94881dfd7ea43417d8ea6c861e150e620a29abcbaee17c`,
  `e732bd46f1777d9b0e9ee0e5532da9e48e6c9b132c15a3522c91f2236ed0f699`, and
  `3256de364b0fe5785c7265e8ce89ba3d0df87e409cf7c69a0ad95709e83b786c`.
- Historical **373 pins = 199 runtime + 174 installed** remain distinct from
  the 208 recovered supporting files. The historical runtime source/module tree
  was not copied. `runtime-pins.json` also matches the 199 rows recovered from Git.
- `historical/` contains 21 small targeted Git recipes/manifests, 151,992 bytes;
  `git-recovery-provenance.json` records their exact commits/paths/hashes.
  Starting anchors were `5551b0272cdc2efa4cf9f9c13961a25ef1cbfd18` and
  `6146c8862d5a30c800e5e32915cd240fceaecb9f`; the closure reference was
  `c036c893d060859e34cf734ea1320b463fa9861a`. No historical source archive was restored.
- `operations.jsonl` records named-member HTTP status, byte count and SHA-256.
  The snapshot is **097df491-64f6-42db-8424-e1337eb61732**, from recorded
  `bx_h44kbrcy`, completed `2026-10-22T14:28:37.466Z`.
  Member roots are `aoe3-original-oct22/{installed,runtime,runner}` and
  `aoe3-native-dxdiag-retest-oct22/overlay`. A single metadata GET for the earlier
  `bx_32262dnp` also found snapshot `21a36e76-9520-4226-a041-4ce8c89421c5`;
  no files were requested from that snapshot. All recovery used the first source.

`native-dxdiag/dxdiagn.dll` is the recorded genuine provider, 1,720,320 bytes,
SHA-256 `50e31067ca6872ae0b7b35a65bf2a9d07c1de539b2d603a9472a48f5375c8307`.
Its historical registry overlay adds only its real CLSID registration.
`configuration/original-launch-registry.json` was reconstructed by removing that
single recorded registration from the recovered overlay; the resulting bytes
match the historical original SHA-256
`69fd648e03a5d4f1f25c41dcdbb2f976f813ca36a1dbdd3d9db5d05280f45cfe` exactly.
`original-registry-reconstruction.json` records this check. Neither registry was
imported into a guest. DirectX Version remains **4.07.00.0700**. Historical native
properties reported DirectX 7, below the original helper's DirectX 9 threshold;
actual DX9/GPU sufficiency and gameplay remain unresolved. No versions or caps
were invented, and this recovery adds no acceptance or gameplay observation.

The next executable step is the offline recheck:

```sh
python3 scratch/runs/20261105-aoe3-supporting-input-recovery/verify-inventory.py
```

For a separately assigned gameplay lane, use the canonical installed executable
and working directory above, current repository runner/build, XP profile, and the
recorded native DLL seeds. The exact historical argument recipe is retained in
`historical/20261022-aoe3-native-dxdiag-retest/guest/launch.json`; translate its
paths to this canonical tree and current runner after reviewing the applicable
launch contract. Its old runner, module, diagnostic tracing and lifecycle actions
are historical references, not commands to replay. Resolve the genuine DirectX
prerequisite before claiming gameplay progress. No supporting media is missing
from the requested installed/dependency set.

Validation was file/path/size/SHA-256 and registry-delta accuracy checks only;
no tests, build, browser, guest, subworkers, runtime commands or shared source
changes. Recorded snapshot metadata and historical stop receipts do not establish
current box runtime state or expiry. No box was assigned, created, resumed,
forked, stopped or deleted; lifecycle remains with the coordinator. The local
Lords1635 → Aranna1710 queue was untouched. Evidence records Git SHA plus the
owned note patch and relevant diff only; media and run artifacts remain ignored.
