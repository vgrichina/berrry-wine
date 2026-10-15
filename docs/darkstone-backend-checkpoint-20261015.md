# Darkstone staged backend capture

Initial source-only preparation, October 15. At preparation time no browser,
game, remote command or full build had run for this controller. The installed payload's 15 paths match
`7379dca78b373080febeb6fce4282c284faa234deec8185870041e508cc3f673`.
The historical Town screenshots remain unavailable locally.

`tools/darkstone-backend-checkpoint.js` captures only the proposed menu
checkpoint using the existing `web-input-probe.js`. It makes no menu clicks.
The recorded menu is unreviewed until a reviewer inspects the image; a logo,
launcher, loading screen, or crash ends the attempt without blind inputs.
The next ordinary-route controller is deliberately deferred until that review.

After the coordinator grants the sole runtime lane, stage a dedicated full
checkout on `bx_9ef2wdsw` through Boat exec/file API using the scoped key.
Do not use SSH/scp, modify the IW donor, or stage dependencies/payload copies
on the local host. Preserve source inventory, approved dependency hashes,
the installed fixture, and module identity in the run bundle. The matching
verified IW donor is `/home/user/wa-iw-combined-native` at `6c22121e`; its
canonical module SHA is
`04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
Production equivalence to main `3fdb2937` / `7deb622c` is documented by the
integration receipt; verify the staged physical inputs before using the donor
module. No source compilation fallback or compatibility module qualifies.

Start only a private isolated loopback dev server from that dedicated tree.
Require an independent idle process census, adequate TTL/disk, and preserved
donor/fixture pins before launching. Set `CHROME` to the remote browser's
verified executable path. From the staged checkout:

```sh
node tools/darkstone-backend-checkpoint.js \
  --root=/home/user/wa-darkstone-validation \
  --out=/home/user/darkstone-menu-software-UNIQUE \
  --origin=http://127.0.0.1:PORT --backend=software
```

The output directory must not exist and its parent must exist. The controller
checks disk and HTTP module bytes and every HTTP fixture file before launching, captures the SHA belonging
to the actual `wine._wasmModule` object compiled by the page, and verifies
fixture and disk-module hashes afterward. Its compile observer preserves compile arguments
and hashes a copy of the input; it never calls guest exports. An unobserved
module is unknown and fails the identity check. The observer adds startup
hashing overhead, so this is not a timing experiment.

The browser probe gets 180 seconds under GNU timeout plus 10 seconds to kill;
the synchronous controller has a 195-second guard. Probe cleanup uses its
existing browser-close finally block. Independently inspect the owned process
tree after termination, terminate only owned leftovers, and recheck fixture,
source and preserved module pins before releasing the lane. A timeout may
bypass probe finally; `summary.json` never claims independent cleanup.

Review `menu.png`, `output.log`, `console.log`, module identity and both
completed main-Worker slice reports. Do not infer backend use from `--gpu`,
the query, page counters, replay-command counts, or a screenshot. Software
rasterization must have live owning-worker draw-consumption evidence. WebGL
must have advancing owning-renderer draws plus fallback/error review. The
current collector may lack software draw consumption or child-thread render
ownership; leave backend unknown in that case. Run WebGL separately only
after reviewing the software arm and confirming the runtime lane.

For the subsequent reviewed ordinary route, use the existing Darkstone re-note
coordinates and inspect each menu/party checkpoint before proceeding. Town
requires the blue mana HUD, followed by before/5-second idle/held ArrowRight
landmarks showing fixed road or gate rotation. This establishes camera control
only. No FPS, audio, combat, locomotion, physical GPU, or full-game claim follows.

Recover all artifacts as ordinary files into a unique shared
`scratch/runs/<id>/` directory, record actual source and HTTP-loaded module,
then publish `result.json` last per `ops/README.md`. Never label an uninspected
capture reviewed. Root owns TODO/STATUS updates.

Offline checks passed: Node syntax, whitespace, exact installed inventory,
plan rejection of public origins/step injection, absence of menu clicks, and
actual tiny WebAssembly Module identity hashing with an unknown-object
negative. These checks do not validate browser timing or gameplay.

The later software-requested menu capture completed and was reviewed; see
`docs/re-notes/darkstone-demo.md` for the actual module identity, evidence hash,
independent release and limits. It reached a 640×480 main menu, so the older
800×600 route coordinates require new live geometry review. The replay-only
Worker counters leave software rasterization unqualified. The complete
executed staging/controller recipe is retained in the hashed run archive.
