# Expanded registered startup crash sweep, 7 November 2026

The actual registered Hexen II, Heretic II and Forsaken originals were each
run once under cooperative scheduling and once with the real-worker backend.
All six reached the harness deadline without an escaped emulator trap,
unimplemented API, guest exit, setup error or external timeout. This establishes
bounded startup outcomes only: Hexen II remained at its opening notice;
Heretic II and Forsaken reached their original menus. Sweep exit zero does
not establish that all cases pass gameplay or graphics requirements.

Evidence: `scratch/runs/20261107-graphics-expanded-crash/`.
Predecessors: [native GL failure and repair](graphics-gl-backed-sweep-20261107.md)
and [repaired native originals](graphics-repaired-native-sweep-20261107.md).
No production source, guest setting, installation registry, clock override,
media or configuration was changed. No nested worker or Claude pane was used.

## Inputs and preflight

The pinned actual-main source was
`df08c786ca331adeb21b76c122b8b99cefcc8888`, including the native shader and
presentation repairs and the subsequently published owning-Worker MIDI repair
`abf1b8c5b31c501e81871392256740ffafdcd138`. The relevant tracked binary diff
is empty. The existing untracked `lib/wininit-boot.js` is preserved as its own
new-file patch; run-specific inputs have an owned-input patch. Git supplies
the source archive. No source tree or media archive was made.

The actual registry/media closure was checked before allocation and again
remotely before any guest: Hexen II 16 paths, Heretic II 1,826, Forsaken 873.
The manifest entries, registered executable and static-import DLLs are included.
`registry-media-closure.json` records registrations, original paths, sizes and
SHA-256 references without copying media into evidence. All manifest size/hash
constraints matched. No known title prerequisite was unmet. Heretic II retained
its registered 1998 clock and OpenGL arguments; Hexen II retained its root
executable layout avoiding the bundled MiniGL. The opening Hexen notice still
requires an ordinary OK action to proceed; the requested no-input sweep does
not dismiss it. The earlier browser MIDI failure is repaired, but this run
does not reach MIDI initialization or requalify that repair.

All 3,166 staged runtime/input pins matched before guests and after completion.
The 856 observed JS/JSON/WASM reads match their runtime/native pins, with no
unmatched read. Each of the six guests actually read the standard module:
2,182,493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Both standard and compatibility modules were recovered; the latter was not
executed. Read provenance is in `retrieved/loaded-audit.json`.

Native dependencies were installed separately: `@node-3d/glfw` 7.4.1 and
`@node-3d/webgl` 6.0.3. Node v24.22.1, display `:0`, Mesa llvmpipe LLVM 20.1.2,
WebGL 1.0 and GLSL 4.50 were observed. A real native context returned red
RGBA `[255,0,0,255]`, GL error zero, and zero live contexts after destruction.
The actual headless-GL test and real WGL fixed-function creation/MakeCurrent/
red-readback regression passed before any original. The 162 native dependency
pins and Node binary hash are recorded; native binaries were recovered
individually. No held-lane retry or RAM gate was used.

## Serial paired outcomes

```sh
node tools/crash-sweep.js \
  --apps=hexen2_demo,heretic2_demo,forsaken_demo --modes=coop,threads \
  --headless-gl --jobs=1 --seconds=20 --stuck-after=0 --no-build \
  --jsonl=<run>/actual3/sweep.jsonl
```

The JSONL was fresh. The six guests ran serially from 15:35:31 to 15:37:34 UTC,
with one heavy runtime at a time. An external preload retained each individual
raw log, PNG and PCM before sweep cleanup, recorded actual module reads and
observed the existing GL bridge and scheduler without changing guest behavior.

| Registered title | Cooperative | Real-worker backend | Personally inspected final display |
|---|---|---|---|
| `hexen2_demo` | `ok/content`, 20.3 s, 440,009 batches | `ok/content`, 20.3 s, 428,888 batches | Both show the original GLHexen2 accelerated-version notice with OK focused. No menu or GL context reached. |
| `heretic2_demo` | `ok/content`, 21.5 s, 31,623 batches | `ok/content`, 20.6 s, 35,055 batches | Both show the original book menu: Game, Multiplayer, Options, Video/Sound Settings, Quit. |
| `forsaken_demo` | `ok/content`, 20.4 s, 40,333 batches | `ok/content`, 20.4 s, 41,764 batches | Both show SINGLE PLAYER / DEATH MATCH / SETUP BIKER / PLAY DEMO / OPTIONS / EXIT GAME over the 3D backdrop. |

All six PNGs were personally inspected and decoded. Hexen II's pair is
byte-identical, as is Heretic II's pair; Forsaken's attract/menu backdrop
differs slightly. No blank capture occurred. All six audio signals are
`none`, zero bytes; no audio-quality conclusion follows.

Heretic II created and made current a genuine native GL context in each mode,
with nonzero WGL results and the observed llvmpipe provider. There was no
recorded GL bridge exception or software fallback. Hexen II never passed its
notice, so native capability preflight is not title-level GL execution proof.
Forsaken used the registered inline software Direct3D route (`dx slot 6`),
not native GL; the availability of the factory did not change that route.

Actual scheduler observations confirm `cooperative` and `worker` backends
respectively. Hexen II and Heretic II created no auxiliary guest threads on
these observed paths: their threaded arms establish backend selection, not
concurrent auxiliary guest execution. Forsaken's cooperative arm ended with
two active auxiliary instances, advanced EIPs and a sleeping thread's 7,056
sleep observations. Its worker arm actually executed three auxiliary guest
threads in slots 2, 5 and 6, with 20,060, 8,691 and 18,488 completed slices.
One had exited by the final snapshot. The two still-live Node worker IDs were
4 and 8 before cleanup; the exited worker's final ID was unavailable. Slice
counts include parking/empty work and are not throughput measurements.

No unexpected real emulator crash was demonstrated, so there was no justified
cause-based production repair or fail-before/pass-after regression to add.
Unequal batch counts were not treated as a scheduler or rendering defect.
The retained complete raw logs contain no escaped crash, unimplemented API or
error line. These observations do not qualify graphics parity, audio quality,
FPS, gameplay, historical27 membership or broad crash freedom.

## Recovery, checks and lifecycle

Recovery verified 54 artifact references / 46 unique hashes, including all six
individual raw logs, six PNGs, empty PCM artifacts, both WASM modules and seven
native binaries. Large logs are retained losslessly as gzip, with local
restoration hashes/lengths. Runtime and native postflight mismatches are zero.
The crash-sweep regression script passed 20/20 tests. One initially attempted
nonexistent focused-test filename is retained separately; it ran no test.
The corrected test invocation and JavaScript syntax checks passed. No production
code changed, so this documentation-only publication required no new build;
the requested sweep reused the pinned module with `--no-build`.
All three title result records pass schema, artifact existence and containment
checks. The global evidence checker retains unrelated preexisting Alice and
Tunnel Twist failures; no global pass is claimed.

A separate local lifecycle watchdog was armed before the one fresh allocation,
with a 25-minute cap and delegated normal-stop authority. A persisted UUID
Idempotency-Key created `bx_kku6pzkp` at 15:33:38 UTC, original expiry
**15:58:38.545 UTC**. No old box was resumed. After artifact retrieval and hash
verification, normal stop `stop_6365d3a6fe0723ac` completed at
**15:38:07.334 UTC**, `forced:false`, error null. The box is **archived**,
stoppedAt 15:38:07.318 UTC, active expiry/archiveAfter null. No running box
ownership remains to hand back.

Terminal checks found no owned runtime process and removed the owned temporary
directory. No browser, profile, input writer or control port was created.
System listener/socket censuses are retained. Local lifecycle/messageboard
watchers were closed. Sampled shared `/home` free space stayed above 2 GB;
no peer data was deleted. The task ends with no original replay.

The remaining startup-coverage prerequisite is a separately scoped ordinary
OK dismissal for Hexen II before assessing its post-notice native GL/MIDI
startup under both schedulers. Heretic II and Forsaken menu startup is covered;
further gameplay or rendering qualification requires its own evidence.
