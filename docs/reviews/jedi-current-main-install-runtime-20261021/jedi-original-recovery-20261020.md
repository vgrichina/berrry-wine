# Jedi Knight original demo recovery — 2026-10-20

Original media recovery passed on `bx_6czhvg6m`, using file operations only.
No installer, emulator, browser or build ran. `acceptedInGuest=false`;
ordinary licence acceptance was authorized on 2026-10-18 but remains unobserved.
No installed layout, playable state or current-main runtime qualification is claimed.

The [bounded manifest](jedi-original-recovery-20261020.json) contains every
original member's size, offset and SHA-256, the supporting files, retained
source hashes, precise missing paths and remote receipt times.

## Original identity and location

Download: `https://archive.org/download/jedi-knight/jedidemo.exe`.
HTTP 200 on 2026-10-20 at 15:22:19 UTC; effective URL:
`https://dn721808.ca.archive.org/0/items/jedi-knight/jedidemo.exe`.

* Size: **21,195,858 bytes**.
* SHA-1: `ed285053d8c267b5fe9aa1ec5728fa37936b3689`.
* SHA-256: `8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.
* MD5 (additional historical cross-check): `637fb311e8c7c0383056f20b6b6a6694`.

Size/SHA-1/MD5 agree with retained `source/archive-metadata.json`; SHA-256
and every extracted member agree with both retained preflight inventories.
All **39 files, 40,812,035 bytes** match. The executable contains concatenated
single-file ZIP records; `unzip -l` lists only the last member. It is not a
complete inventory method for this package.

Remote root: `/home/user/jedi-original-recovery-oct20`.
Original package: `jedidemo.exe`; extracted original files: `original/`.
These are runtime-local payloads, not Git backups. Runtime TTL was
**2026-10-20 15:53:12 UTC**; the coordinator must preserve or recover them
as appropriate. This worker neither stops nor extends the shared runtime.
The durable Git material is the report, full manifest and extraction recipe.

## Support closure and retained capture

The unchanged package supplies all 39 original setup/game assets, including
`setup.exe`, `_INST32I.EX_`, `_setup.lib`, `_SETUP.DLL`, `_ISDEL.EXE`,
`SETUP.INI`, `setup.ins`, bitmaps, the demo licence, original game/launcher,
three GOB archives, Smacker library/movie, controller files and readmes.
The flat archive output is not an observed installed-game directory.

`_setup.lib` was unpacked with repository `tools/is3-extract.js` and
`tools/mpq.js` into remote `setup-library/`. All six hashes match the
historical child artifact manifest:
`CTL3D32.DLL`, `CTL3D32S.DLL`, `corecomp.ini`, `uninst.exe`, `_isres.dll`
(historically extracted as `1847.dll`), and `License.txt`.
The setup-library licence is distinct from original `License.txt`.
Exact tool identities are in local `support-transfer.json`.

The retained capture archive is 644,121 bytes, SHA-256
`df8a7ff64f8961da38afb8f95165bc1e73ba274aa725c5d208831e8502a0411c`.
It was transferred via authorized exec APIs and selectively extracted under
remote `retained/`. All nine capture members present in that archive match
the historical seal: `launch.json`, three Windows INIs, and five files under
`windows/temp/`. Its registry matches SHA-256
`be14b34b94e82b0391aab0ef2bae87188c0b1b108abfc36992f125a6474b4a11`.
Registry timing was bootstrap exit, not a launch-time snapshot.

The original generated child is PE32/i386, 674,816 bytes, SHA-256
`12a2929a615924e212490f4ef3a1cbb36ecebddafea0f358991a0fc57b7cab84`.
Its receipt gives `c:\windows\temp\_ins0432._mp`, empty arguments, and
`C:\` working directory. The genuine `_ins0432.ini` must accompany it;
do not substitute guessed command-line options.

The sealed capture has **97 entries including launch.json** (receipt
`files=96`). Nine are restored in `retained/run/capture`; 40 original/app
aliases can be supplied from the verified 39 original files, and 48
host-supplied font/system paths remain unmaterialized there. The manifest
lists all 88 unmaterialized paths and hashes, including the original aliases.
This partial historical capture is **not ready for direct replay**.
Prefer a fresh ordinary bootstrap to regenerate its complete closure.

Local historical payload directories
`/home/user/jedi-knight-demo-preflight-20261015/original` and
`/home/user/jedi-installer-capture-20261015/run/capture` remain `ENOENT`.
No missing file is silently treated as recovered.

## Recovery and next ordinary acceptance recipe

1. On a subsequently authorized runtime, create a unique directory with room
   for at least the package plus 40,812,035 expanded bytes and runtime outputs.
   Download the original URL with `curl --fail --location --retry 0`; record
   the HTTP receipt. Verify the exact size, SHA-1 and SHA-256 above before use.
   A retrieval or identity failure is a blocker, not permission to substitute
   a package or repeatedly retry.
2. Run the committed [JavaScript extractor](jedi-original-recovery-20261020.js)
   with that absolute directory as its sole argument. It reads `jedidemo.exe`,
   pins its SHA-256 and validates all 39 names, sizes, offsets and output
   hashes against the historical inventory before declaring success.
   This is file extraction only. The equivalent historical extractor is
   `tools/extract-jedi-knight-demo.js` in commit
   `bdc4dfdce4bcd426f2e8e7eb4818b06ca75fbe33`.
3. After the coordinator assigns the sole runtime lease, identify the selected
   source and canonical module. The old source tree
   `42c76ec08136d55337151f7c8156a18fb3f6a618` and module
   `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`
   describe historical evidence only. They do not qualify current main.
4. The ordinary bootstrap launch is the following command shape, from the
   selected source checkout, with absolute task-owned paths:

   ```text
   node test/run.js --exe=<recovery>/original/setup.exe
     --no-build --wasm=<qualified-module>
     --quiet-api --no-close --no-threads --batch-size=200000
     --max-batches=10000000 --max-seconds=120
     --vfs-tree=<recovery>/original --capture-launch=<fresh-capture>
     --save-vfs=<output>/bootstrap/vfs
     --reg-export=<output>/bootstrap/registry.json
     --png=<output>/bootstrap/final.png --control=<assigned-free-port>
   ```

5. Inspect and seal the **new** capture/registry/terminal receipt. If a child
   handoff is required, use its actual `guestExe`, `exe`, `args` and
   `directory`. The historical command used
   `--exe=<capture>/windows/temp/_ins0432._mp --vfs-tree=<capture>`
   `--exe-guest-path=c:\windows\temp\_ins0432._mp --cwd=C:\ --args=`
   and `--reg-import=<output>/bootstrap/registry.json`, retaining the same
   bounded launch flags. Validate the complete tree, not just the child hash.
6. Observe the original licence screen and perform the authorized ordinary
   Accept/Yes action. Record the actual input and resulting screen before
   setting `acceptedInGuest=true`. Then observe installation and its actual
   payload/registry contract. Do not patch originals, fabricate registry
   state, skip to gameplay or replay held diagnostics.

## Evidence and scope

Local evidence: `scratch/runs/20261020-jedi-original-recovery/`, principally
`preflight.json`, `download-command.json`, `extract-command.json`,
`support-command.json`, `support-transfer.json`, `manifest.json` and
`receipt.json`. API receipts have exit 0 and untruncated stdout.
All six library hashes were independently compared with the retained child
manifest. No new image or gameplay evidence exists.

Shared HEAD/index/config and unrelated WIP are preserved. No broad checkout,
main merge, worker launch, SSH, public deployment or ownership transfer was
performed. Local admission used floor 2,210,398,208 bytes plus 32 MiB reserve
and 24 MiB aggregate active caps; this task's cap is 4 MiB.
