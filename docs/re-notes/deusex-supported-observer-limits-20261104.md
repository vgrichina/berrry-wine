# Supported finite owning-Worker Draw interval

The owning Draw observer now accepts **10,000,000 blocks / 120,000 ms** with
explicit `limitProfile: 'extended'`. Ordinary execution still leaves the observer
disabled. Omitted limits remain **50,000 blocks / 1,000 ms** in either profile;
the default `standard` profile retains maxima **2,000,000 / 15,000**.

```js
await wine.guestWorker.link._ask({
  t: 'drawObserver', action: 'start',
  options: { limitProfile: 'extended', maxBlocks: 10000000, maxMs: 120000 }
});
```

This command belongs after the existing genuine-candidate, native GIsRunning,
visible-window and owning-Worker identity gates. It does not establish readiness.
The shipped Worker already forwards `msg.options` directly to the constructor;
no Worker forwarding or cache-version change was necessary. The terminal now
records the accepted profile alongside its exact limits. No clamping remains.
`validateLimits` is the same exported validation used by the actual constructor,
not a subclass that avoids guest memory. Validation happens before guest reads.

Only `standard` and `extended` profiles are supported. Explicit limits must be
positive safe-integer numbers within the selected profile's ceiling. Null,
undefined fields, strings, booleans, zero, negative, fractional, overflow and
nonfinite bounds reject. Null/non-object/array options and unknown profiles also
reject. Omitted options/fields retain defaults. Unrelated diagnostic metadata
continues to confer no authority. Rejected starts leave no active collector.

The deadline and block budget are finite stopping bounds, subject to the existing
synchronous WASM quantum and Worker event-loop scheduling. They do not guarantee
that all requested blocks retire before the deadline. Native readiness, module
lifecycle/identity, thread ownership, original Draw signature, Render ESP code,
edge, frame and restoration guards remain in force. No scheduling, guest writes,
injected calls, breakpoint handling or lifetime qualification was added.

## Offline verification

Evidence and small runnable helpers are in
`scratch/runs/20261104-deusex-supported-observer-limits/`.

- `flock /tmp/wine-build.lock bash tools/build.sh` passed, producing normal and
  compatibility WASM. The initial callback census hash rejection was resolved
  by reviewing only the observer's existing host-file row; its ownership remains
  pending. Callback census reconciliation tests passed.
- `test/test-deusex-owning-draw-observer.js` passed with both actual modules,
  locally and through the shipped owning Worker. It exercises defaults, exact
  old/new maxima, malformed profiles/options and invalid bounds for both fields
  under both profiles. Each module/ownership fixture retires **2,000,002 actual
  blocks**, remains active past **15 seconds**, then stops under exact 10M/120s
  bounds. This proves continuation beyond both former caps, not 10M retired blocks.
- Exact original EXE/Engine PE loading and relocation, original virtual-call and
  SEH epilogue instructions, full original Draw zero-guard route, original Render
  ESP save/reuse/restore instructions, and live code/frame/generation negatives
  passed. Extended-profile stop, short deadline expiry with a 10M block budget,
  trap/frozen-terminal cleanup and existing pending execution protections passed.
- The complete next driver passed offline with modeled DOM/native readiness and
  actual serialized page commands, real WorkerLink and actual WASM scheduling.
  Its actual collection command requests the extended maxima; its assessment
  rejects terminals reporting different limits. No browser or natural game ran.
- Cache checker self-tests/current source graph passed. Helper tests cover an
  absent checker failing before launch, explicit staging of the actual checker
  with byte equality, actual collection forwarding and identity/terminal negatives.

The tested normal WASM SHA-256 is
`129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52`;
compatibility WASM is
`3fde0fc42ecd0d9d5096d0b9eb83cd3086cb74aab8ac3f7b9f3fd15f5783fe6a`.
Original media is referenced by existing path and SHA in `preflight-output/preflight.json`;
no media, module or source-tree archive was copied into evidence. Git commit SHA,
relevant binary diff and owned new-input patches preserve source provenance.

## Reproduce and prepare a future natural interval

Run from the actual candidate root containing this published revision, built
WASM, focused test and existing original media. Paths below are existing local
inputs; stage only these small helpers into a future runtime's own run directory.

```bash
RUN="$PWD/scratch/runs/20261104-deusex-supported-observer-limits"
node "$RUN/helper-test.cjs"
node "$RUN/preflight.cjs" "$PWD" "$RUN/preflight-output"
WINE_ASSEMBLY_WASM=build/wine-assembly.compat.wasm \
  node test/test-deusex-owning-draw-observer.js
```

`preflight.cjs` checks the actual candidate's exact contract, runs the cache
checker and actual WASM/owning-Worker/original-instruction suite, and records actual
input hashes. If the optional cache checker is absent from a future staged root,
pass its **tested revision's** `tools/check-browser-cache-versions.js` as argument
4: the helper stages that single small file before running it. With no explicit
source it fails immediately. The root must also contain the test directory needed
by the checker and suite. No browser is launched by this preflight.

`collection.cjs` and `next-driver.cjs` are the small successor inputs. The latter
preserves the predecessor's actual selector, measured native/window gates and
ordinary execution; it reserves 125 seconds for the extended observation and
terminal recovery. Its existing helper dependencies are
`20261104-deusex-corrected-launch-observer` and
`20261104-deusex-measured-readiness-draw`. To reproduce full offline driver coverage:

```bash
DEUSEX_COLLECTION_DRIVER="$RUN/collection.cjs" \
  node "$RUN/preflight.cjs" "$PWD" "$RUN/preflight-with-driver"
```

A separately authorized natural task must regenerate served pins for the actual
published candidate/dependencies and built module, verify the HTTP graph and
Puppeteer CJS/ESM imports **before** any Chrome launch, and require successful
preflight before invoking the driver. Reusing the historical manifest or module
as if it included this repair is invalid. Preserve the existing original media,
native support paths and readiness gates; the collection helper sends only
start/status/stop, never guest pulses or input. Natural Unlock remains future
work; this repair makes no Draw completion or gameplay claim.

No box, browser, gameCLI, lifecycle, subworker or deployment was used here.
`bx_jaqh7yas` was not accessed. Coordinator retains its sole custody; reported
state RUNNING and expiry **2026-11-04T08:39:09.654Z** are inherited, not reverified.
