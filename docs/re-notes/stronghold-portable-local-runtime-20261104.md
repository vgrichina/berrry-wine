# Stronghold explicit local runtime, 2026-11-04

The missing launch dependencies are repaired. One fresh original-driver attempt
launched Chrome, reached the title dialog, and stopped at the first new blocker:
the unchanged retained title helper rejected its fresh capture with
`original title dialog required`. No title Enter, game-menu input, Custom Game
gesture, preset or gameplay input followed. Callback/scene/setup history remains
**UNKNOWN**. The recognizer was neither changed nor bypassed, and no retry ran.

Evidence: `scratch/runs/20261104-stronghold-portable-local-runtime/`.
Inputs are the published owning observer `321b8adc0` and prerequisite note
`5af3bc2be`. The tested NEW current-main candidate starts at
`d22dfbef885c1686ab253b1fdd572e52ec1effac`, with recorded relevant binary diff
and patches for this worker's new files. It is not historical cffc/580f.

## Dependency repair

Both actual `require('puppeteer')` and `import('puppeteer')` pass for declared
version25.7.0. The root npm dry run would also install unrelated declared
packages; it was not executed. A second inspected dry run targeted only
Puppeteer and its27-package closure under `node_modules/.stronghold-runtime`.
Installation and the root `node_modules/puppeteer` symlink were serialized with
`flock /tmp/wine-node-deps.lock`. Downloads of browsers and package scripts were
disabled. Existing pngjs/wabt remain usable; package.json/package-lock.json are
unchanged. No node_modules snapshot exists. The import success was acknowledged
on the board before the MDK lane used it.

Recovery, from the same checkout with the private directory created first:

```sh
flock /tmp/wine-node-deps.lock env PUPPETEER_SKIP_DOWNLOAD=true npm install \
  --prefix node_modules/.stronghold-runtime --no-save --package-lock=false \
  --ignore-scripts puppeteer@25.7.0
ln -s .stronghold-runtime/node_modules/puppeteer node_modules/puppeteer
```

The symlink command applies only when the root Puppeteer entry is absent.
Chrome is the existing `/opt/google/chrome/chrome`.

## Local release contract

`tools/stronghold-local-runtime.cjs` composes the published observer's `prepare`
output and still executes the actual retained30-helper `compileClosure`.
Only the leased-box launch guard is translated into an explicit local-process
variant. There is no fabricated `bx_` identifier or leased TTL.

The local record requires the original authorization, this task's authorization,
coordinator shutdown ownership, actual hostname, Linux boot ID, PID and process
start ticks, UID, real checkout and Node executable. A fresh random nonce is
embedded in this exact prepared entry. The record binds the absolute run and
manifest paths, manifest SHA-256 and actual normal/compatibility module hashes.
The original whole-manifest filesystem verification and HTTP pin checks remain.
Foreign/stale contracts, box/local mixing, missing authorization, expired or
infinite deadlines and insufficient runtime/cleanup reserve are rejected.

The issue-to-browser limit is360 seconds; command deadlines remain40 seconds.
The bootstrap has an overall60-second bound starting before Chrome launch.
Starting requires a full360-second browser window and180-second cleanup reserve
within the explicit17:40Z Chrome/17:43Z cleanup cutoffs. This task's dated
authorization cannot silently authorize a later attempt. A capture-bound personal
selector review is added before the original Launch click.

The original input, capture, controls, personal review, fresh exact binding and
64-step ACK checks remain, with navigation16384/route4096/arrival3072 caps.
The observer retains pre-first-script installation, slot0/endpoint1/thread1
requirements, exact historical shell RGBA check, first plus at most3 further
256-step input-free samples, scene20/fault/cap/deadline stops and denied
preset/Start/install-native/readiness paths. The live attempt never reached the
point where the owning attachment is armed and qualified for the Custom Game
gesture; preloader installation alone is not claimed as that qualification.

## Actual bounded result

All1856 original media references match, including EXE
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
Actual filesystem pins and164 independent full HTTP body/hash/header checks
passed before launch. During the attempt1007 served-file checks matched.

| Module | Tested SHA-256 |
| --- | --- |
| normal | `b74179b7570e3d9b87b088b53fb106aaba321cd6b256445bcbb362e634f1d1ea` |
| compatibility | `716275cc2d6dee5a00941c1686e0ccb69cd7411c423dac5e8506cb62226ff724` |

The page actually fetched, compiled and sent the normal module with that hash.
Worker bootstrap receipts record injection before the first script's execution
in its actual CDP context.104 consecutive complete64-step ACKs reached6656
steps. All eight fresh PNGs were personally inspected: the selector, black
startup, loading/artwork, splash, title dialog, and the helper's rejected title
capture. The only physical mouse sequence was the reviewed page Launch click.

The fresh `browser/title-boundary-0.png` visibly contains Enter Your Title,
Lord Crusader and the title-screen Start Game button. Its retained helper's
exact500x250 RGB crop hashes to
`dbb5e3a89f1372c93e13dd1c03aafabb6032b3d329e6a1b874a7fdc1309330ff`,
which matches neither original title pin. This is the demonstrated rejection;
the reason for the image mismatch is not established. The helper failed before
requesting its personal review or sending Enter. No original callback, scene20,
setup completion, shell, readiness or gameplay conclusion follows.

ChromePID802480 exited0 normally at17:23:43Z; the Node driver also exited.
Port40395 refused a fresh connection. The local flock was released normally and
the MDK lane was notified at17:24:17Z. The inherited cleanup JSON contains a
legacy `boxLeftRunning` field; the separate local closure proof explicitly
records no box, exited local PIDs and a closed server. No boat/API/box SSH,
allocation, closed-box access, shutdown or lifecycle operation occurred.
Box ID/state/expiry are NA; future boxes remain the coordinator's responsibility.

## Validation and evidence

The focused contract test passes28 mutated negative contracts, actual foreign
child-process rejection, actual composed-entry guard acceptance/rejection,
30-helper declaration compilation and unchanged-cap assertions. The published
owning-observer executable fixtures pass on both modules, including their
trace/control parity, binding/ACK/input/review/route rejection controls. The
locked full build passes before publication; its final run is separate from the
recorded live candidate because peers may edit this shared main after closure.

Small logs, eight captures, stable SHA/size seals, exact Git SHA, relevant binary
diff and new-file patches are retained. Modules/media are path/hash references;
no source tree, media or module copies/tars were staged. The retained driver's
automatic close snapshot contained only duplicate run evidence: every file was
verified against the canonical browser evidence, its manifest retained, and the
duplicate directory removed. The closed Chrome profile was removed normally.

Next: inspect the measured title-image/pinned-recognizer mismatch offline before
any separately authorized fresh game attempt. This single assignment stops at
that new demonstrated blocker after publishing its tested implementation.
