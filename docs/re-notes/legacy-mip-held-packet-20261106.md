# Public legacy mip matrix and held production packets

Run: `scratch/runs/20261106-legacy-mip-held-packet/`.

The run stopped at the first failing spatial WebGL1 observation. All ten solid
cells pass on both shipped modules, and canonical software spatial passes.
The full spatial rendered matrix remains incomplete. The held-declaration
adaptation in `b9bb8c5de` is unchanged; no production code was repaired.

The public mip runner now accepts an explicit source/module hash manifest for
the current locked build and covers solid and spatial analytical plans in
software, direct WebGL1/2, and owning Worker WebGL1/2 on both shipped modules.
Held batches retain their real queue packets: sequence, header, 4096-byte state,
Atomics completion before/after live public sampler mutations and after drain,
and immutable captured state are observed. Production guest/render Workers,
public Lock fences, resource releases and render heap retirement remain active.
RGB tolerance remains 2 and direct GL alpha must remain 255. Expected pixels
come from the existing independent quotient-rule and authored-texel oracle.

The locked full build, mirror software/Worker plans, public mip plan and server
controls pass. The rectangular, keyed and keyed-format emitted fixture anchors
also pass source assembly. Native/compiler sources remain identical across
the build and checks. Tested Git is `1ae7869caf6760b56790fbd8ed36ebebcf098472`
plus `tested-source.patch` and `newfilepatches.patch` in the run. The two exact
unmodified production modules are retained in `matrix/`:

- Standard: `ab1ce417568573f42448f031ab6cb4d8c7db0d33adb7727ca97b7e3a5be3a692`, 2,178,864 bytes.
- Compatibility: `4b94ed4d8851472227a00debf7148f3d4bba12c8f362bdaf381b57488eee2bd2`, 2,181,510 bytes.

Eleven complete cells produce **226 passing pixel observations**, with maximum
RGB error 1.8713 at unchanged tolerance 2. Solid coverage includes all public
NONE/POINT/LINEAR transitions, footprint extremes, perspective samples and
child Lock/Unlock overwrite. All four solid owning Worker cells have three
real held packets each, immutable 4096-byte state, completion below the packet
sequence through live sampler changes, and completion after drain. Each has
21 draws/fences/readback syncs, six texture uploads, zero errors/fallbacks and
zero native/fallback software draws. Each acknowledges `render-stopped` and
adopts its retired heap. All **29 executed negative controls** reject wrong
actual pixels: 28 solid level-zero/stale-filter/stale-upload controls and the
canonical software spatial nearest-only control.

Canonical direct spatial WebGL1 passes MAG POINT, MAG LINEAR, restored MAG POINT
and MIN POINT, then fails MIN LINEAR at `(2,3)`:

```
actual RGB / actual GL RGB: 121,50,107
independent analytical RGB: 113.752,42.28,103.404992
actual GL alpha: 255; GL error: 0
```

The same numeric mismatch was previously observed in queued Worker WebGL1 in
`docs/re-notes/legacy-public-mip-nonsolid-filter-20261104.md`. This attempt
confirms it in direct WebGL1 on current main. It does not isolate or repair
the existing coverage/interpolation displacement. No oracle shift, tolerance
change, backend option, fixed LOD, fallback or unchanged retry was introduced.
The failing frame and full DIB/GL readback are retained. Standard spatial
WebGL2/Worker1/Worker2 and all five compatibility spatial cells remain
unexecuted; the failed direct cell is partial. Nine planned negative controls
also remain unexecuted. The separate generated-projected seam is untouched.

One Chrome 151.0.7922.108 ran 10:54:06.942–10:54:27.858 UTC, after the three
required ordered releases and independent cleanup. CDP reports SwiftShader;
the actual context reports Intel/Mesa ANGLE. Both identities are retained,
without physical GPU attribution. Runtime ownership was
10:53:38.456802–10:54:29.330070 UTC including cleanup, inside the 45-minute bound.
All 138 observed runtime PIDs, three ports, one profile and four locks are
clean; the source watcher and controller also exited. Free disk exceeds 4.8 GB.
There are no boxes (ID/state/expiry N/A), deployments or nested Codex workers.

Next: separately resolve the independently reproduced spatial interpolation
mismatch while retaining top-left ownership, then execute the remaining
spatial cells. This task stops at the concrete pixel failure.
