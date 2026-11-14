# GLTron native GL black startup frame, 2026-11-14

The original GLTron deliberately publishes a black cleared frame before its
startup texture loading finishes. The actual native `--headless-gl` path then
draws and publishes the original main menu without input or a production
change. A 20-second screenshot cuts this startup short. No lost-frame defect
was established, so adding a forced swap or changing GL state would be an
unsupported repair.

Evidence: ignored `scratch/runs/20261114-gltron-native-gl-frame/result.json`.
Four selected PNGs were individually inspected: native and SoftwareGL at
20 seconds (black) and 55 seconds (original Game/Video/Audio/Quit menu with
the GLTron logo and cycles). The two redundant shutdown PNGs were also
inspected, then removed. This is startup/menu evidence, not gameplay,
physical-GPU, browser, pixel parity or historical27 acceptance. Quake III
was not investigated.

## First meaningful boundaries

`native/boundaries.jsonl` records a passive, bounded public trace. Times below
are seconds since observer initialization in that process, not a promised
startup deadline on other machines.

| Boundary | Native WebGL | Matched SoftwareGL |
| --- | ---: | ---: |
| Successful context creation | 12.812 | 17.844 |
| Successful make-current | 12.816 | 17.847 |
| Initial clear and authentic guest swap command | 12.817 | 17.851 |
| Initial black native readback | 12.837 | Not a native backend |
| Initial successful present return | 12.858 | 17.853 |
| First packed geometry | 26.805 | 33.912 |
| First content-bearing native readback | 30.134 | Not a native backend |
| Next successful present return | 30.152 | 33.930 |
| Reviewed full compositor menu | 55-second capture | 55-second capture |

After the first clear/swap, GLTron creates and uploads textures before issuing
its first geometry. Both runs issue 172 texture-image uploads. At the native
20-second capture the visible 800×600 window's GPU publication sequence is
still **1**, the already-read black frame. The first nonblack readback advances
that sequence to **2** and the existing compositor repaints it. Native totals
are 4,830 executed draws, 57,960 vertices and 484 presents; these counts support
the inspected menu, rather than substituting for image review.

There is no first failing native context/draw/swap/readback/compositor boundary
in this experiment. The missing prerequisite in the earlier screenshot was
completion of ordinary startup work. The negative control is the matched
SoftwareGL run: the same original, clock, block budget and untouched UI also
publish black before rendering their menu. It creates no native context or
native readback, confirming that the observer distinguishes the two paths.

The predecessor logs already contain `SetWindowText "GLtron"` in both modes;
the earlier note's abbreviated window-event interpretation should not be read
as an exhaustive lifecycle trace. Their final main EIPs are inside relocated
zlib/libpng, consistent with incomplete asset work. Absence of a logged wgl
call there did **not** establish absence of a context: this experiment observes
a successful context and black swap before texture loading completes.

## Matched execution and provenance

Both actual launches used:

```sh
node test/run.js --app=gltron --no-build --no-threads \
  --real-ticks --max-batches=1000000000 --max-seconds=65 \
  --quiet-api --gl-census --stuck-after=0 --control-stdin --png-canvas \
  --png=RUN/MODE/final.png
```

Native adds `--headless-gl`; the comparison adds `--gl-renderer=software`.
Neither sets `--batch-size`, retaining the sweep's default **1,000 blocks**.
Per-batch logging remains enabled; the controller drains stdout continuously
and retains only its first/last register lines plus ordinary lifecycle output.
The only control commands request compositor PNGs. There are no key presses,
guest calls, memory/state/configuration edits, changed clocks, fake GL,
forced swaps or presentation calls. The older successful gameplay session's
200,000-block budget is not silently substituted into this comparison.

`observe.cjs` wraps existing bridge context creation/binding/present, native
context/readback and compositor entry points, preserving their arguments and
returns. The existing GL trace hook counts commands and logs only the first
three occurrences per name. It does not consume GL errors or issue draws,
swaps or extra readbacks. It checks RGB content only in the destination of an
already-requested native readback. `active.json` files retain exact commands;
the traces retain actual module reads.

Both actual originals loaded the same 2,199,488-byte module, SHA-256
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
The initial recorded main commit is `f938003e27a6356777efb6b7ecf469ba381176bf`.
`source.patch` and new-file patches preserve relevant foreign runtime WIP;
`source-pins.json` and `postflight-pins.json` report no changes in 300 pinned
runtime/build files across the experiments. Every overlapping pin in the
prior successful SoftwareGL session also matches. The 92 existing GLTron media
paths match their predecessor SHA-256 values before and after; none was copied
or downloaded. Git plus patches is the source archive.

Native dependencies reuse the predecessor's exact npm lock, glfw 7.4.1 and
webgl 6.0.3. Actual native shader/readback preflight passes on llvmpipe LLVM
20.1.2, WebGL 1.0 / GLSL 4.50. This includes drawing and compositor-read controls,
not merely context availability. A second preflight was inadvertently queued
after the first had already passed; it also passed, but adds no original-game
coverage. The first two attempts expired waiting for the shared lock and
loaded no runtime module; their waits are retained and excluded from coverage.

## Checks and cleanup

Two independent watchdog controls pass: deadline kill of an owned process
group with actual child wait/EOF, and normal disarm with actual wait/EOF.
The native and SoftwareGL originals each end normally at the harness's
65-second bound, actual wait 0, stdout EOF, stderr EOF and no residual group.
Each watchdog arms before its direct child, has an independent finite deadline
including lock queue time, and is joined with both EOFs. All heavy runtimes,
native controls and builds serialize on `/tmp/wine-heavy-runtime.lock`;
builds additionally take `/tmp/wine-build.lock`. Locks are released between
turns and during documentation work.

The attempted full build stopped at the active foreign ToyVM bundle
freshness gate. Its log is retained; no owned GL production code was changed,
and the bundle owner was notified to regenerate its files. No passing full
build is claimed. This publication changes documentation only; it does not
publish code through the failed gate. Artifact verification is recorded in
the result metadata.

Only the four result-named key PNGs, compact logs/JSON and small recovery
patches are retained. No source archive, media bundle, WASM dump, frame series,
browser or box was created. Box ID null, state `NOT_CREATED`, expiry null,
stop receipt `N/A`. Free space remains above the 1.5 GB floor. Foreign WIP
and ownership are preserved. There is no remaining GL repair requested by
this evidence; future startup checks should wait for actual menu content
rather than classify a fixed 20-second black image as a rendering defect.
