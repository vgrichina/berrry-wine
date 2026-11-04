# MDK2 level1 request: measured decode progress and passive main observer

The original at step3392 is **inside the archive output callback**, with
184320/192320 output bytes copied. Its current callback requests4096 bytes;
8000 bytes remain uncopied. Main is independently polling completion. This
is observed work in progress, not evidence of an emulator stall or gameplay.
No emulator repair is justified by these captures.

This follows [df3674a57's measured Escape/New Game/Medium](mdk2-measured-escape-original-20261104.md)
and the [main-Worker observation](mdk2-main-construction-observation-20261104.md).
Their achievements remain accepted. Black construction adds no gameplay claim.
RUN is `scratch/runs/20261104-mdk2-lua-construction-cause/`; preparation HEAD is
`df3674a573efd825f2baa9125c7589c27cea7595`. This assignment is offline: no
Chrome/game, remote API, runtime allocation, input, guest Lua write, injected
callback, budget extension or lifecycle operation occurred. Box ID/state/expiry
are NA; coordinator retains lifecycle ownership.

## Original bytes and retained state

Media is referenced in place, never copied:

| Path | SHA-256 |
| --- | --- |
| `test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe` | `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1` |
| adjacent `data/scripts.zip` | `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8` |

RUN's `audit.cjs` checks14 native byte spans, decodes only two selected archive
entries in memory, and verifies six paired original main/file/capture records
against the recovery inventory. The committed test also verifies that inventory
against the measured run's seal before reading its original captures. If a
capture is gzip-only, gunzip must pass CRC/length validation and decoded bytes
must match the original inventory size/SHA before JSON parsing. Original gzip
files are preserved. No source archives, decoded script trees or module/media
copies are created. The historical execution module remains `cffca869…4bcee`;
today's qualification modules are separately hashed in `native-results.json`.

The final main stack starts `4522d7,10,44fb84,5e3840,…,44fc91,…,41fceb`.
The file stack starts `45774a,0,305,7eff71a4,100,45c80f,7eff81d4,7eff7154,7eff718c`.
Both sampled PCs are4515cd, the return from the original SleepEx call. Different
return addresses, arguments, stacks, thread exports1/2 and ESPs074ffc24/7eff7120
identify distinct execution:

| Native boundary | Contract from original bytes |
| --- | --- |
| `4522d0 → 4515c0`, return `4522d7` | Main calls alertable SleepEx(10,TRUE), then reads completion at4b87d0. It cannot finish the file request itself. |
| `457740 → 4515c0`, return `45774a` | Archive output callback calls alertable SleepEx(0,TRUE), then copies decoded output. This is an ordinary native callback, not evidence of a missing host/APC callback. |
| `45c7fa–45c80f` | Decoder passes context, a pointer to count4096 and an output-buffer pointer to its native write callback. Current file stack's return45c80f and arguments match this call. |
| `45774a–457789` | Context+0c is output capacity, +10 output copied, +14 destination. Copy count is min(capacity−copied, *countPointer); native REP MOVS copies it and adds count to context+10. |
| `457700–45773f` | Separate input callback uses context+4 compressed size and +8 bytes read, and updates +8 after the native read. |
| `452114–45213b`, `451f51` | Archive return clears archive globals and adds entry size to5ce08c; only after the worker's4520b0 call returns does it write completion1. The aggregate byte counter is not a streaming cursor. |
| `44fbd4 → 44f4a0 → 44f515`, return `44fbe9` | Main consumes completion, writes entry status2, dispatches type10 to `pop esi; ret`, then clears active at4b7d14. This resource finalizer executes no Lua. |
| `41fce5 → 44fc40`, return `41fceb`; `41fcf9 → 444f80` | Original custom dofile demands the resource, then supplies its buffer and size to the original Lua buffer loader. Completion/finalization and Lua execution are distinct boundaries. |

The context at7eff718c is completely within the captured48-word file stack.
Its six words at step3392 are stream4b5078, compressedSize32571,
compressedRead32571, outputSize192320, outputCopied184320, destination00e080c4.
The destination equals the main sidecar's request buffer. The count pointer
7eff7154 contains4096. These are pointer-derived fields, not guesses from
unlabelled values elsewhere on the stack.

| Step | File callback | Compressed bytes read | Output bytes copied |
| --- | --- | ---: | ---: |
| 3344 | output45774a | 6144 | 40960 |
| 3360 | input457708 | 14336 | 90112 |
| 3376 | input457708 | 22528 | 139264 |
| 3392 | output45774a | 32571 | 184320 |

The same request remains pending/completion0 and aggregate982692. The two output
samples establish actual progress; no throughput, required slice count, stall
or future completion time is inferred. Reading all compressed input does not
mean all output or the decoder/checksum/return path has completed.

The main raw request words at entry+0c now directly supply ASCII `level1`.
This improves the older size-based inference: the actual request name is
captured. The archive's192320-byte `level1.lua` decodes to
`7d7de7b115b6fb1deb6290791c222e59c2726c607324095d3ba4c6136d9c08fe`.
Its first statement is `Level = {}`, followed by scenegraph/file`l1`/loadscreen
assignments. Original `mdk2.lua:373–398` clears Level before demanding that
script. Nil Level is expected until original script execution creates it.

## Implemented observer and qualification

`tools/mdk2-lua-construction-observer.cjs` exports a small pre-instantiation
`attach` adapter around the owning main Worker's existing `host.log_block`.
Supply the actual exports through a closure after instantiation. The adapter
never calls run, setters, guest Lua, callback helpers, timers or trace arming.
It forwards the original import result/throw, bounds reads/records/blocks by the
caller’s original deadline, and becomes inert on unsupported evidence.
No production host/Worker/emulator path was edited.

The caller must independently bind the hashed module bytes to the actual init
Module and install before instantiation; changing an imports object afterward
does not replace an already instantiated WASM import. Existing block tracing
must already be authorized and armed by the caller. `check()` rejects zero
delivered boundaries. The observer cannot invent trace history from snapshots.

Events distinguish poll return, native type10 finalizer entry/return, completion
consumption, original dofile demand return and original script-buffer entry.
Stack/arguments/request/type/status and original bytes are checked. Missing
history prevents corresponding return/entry claims. `sample()` reads the actual
Lua3 interned `Level` tag/table without executing Lua. A nil→table transition
is reported only across two observed samples; an initial table is not called a
creation. This locates creation between samples, not the exact assignment PC,
the `l1` field, loading artwork or gameplay. Existing selection sidecars retain
those separate fields. Parser/execution instruction landmarks remain in the
earlier note; this small observer makes no parser-return coverage claim.

`decodeFileSnapshot(main,file)` interprets independently obtained frozen file
readbacks. It requires correct main/file identity, matching frozen counters,
supported Sleep return/argument, bounded stack context and request buffer/size.
It distinguishes idle, input and output callbacks and reports both cursors.
It does not read the page instance as a substitute for the owning Worker.
The caller retains the existing all-Worker frozen capture barrier; this observer
does not create an atomic snapshot of concurrently executing sibling Workers.

`node test/test-mdk2-lua-construction-observer.js` qualifies original native
fragments in the actual shipped queued Worker with the optional production
observer paths disabled. Normal and compat each compare an ordinary traced
control against the same traced execution with this import observer. Each arm
executes the unchanged native type10 finalizer, synchronous completion branch,
real SleepEx poll, original demand-return path, buffer setup and memory-stream
initializer. Execution stops before protected parse/run: no Lua state/program
or callback is synthesized. Full512MB hashes, registers, lazy flags, returned
slice fields, queued commands and final trap agree; only measured host duration
is excluded. Actual loaded Worker source and module hashes must agree between
arms. This is native-fragment qualification, not a new original game run or
proof of transparency against an untraced execution.

Wrong bytes/loader/thread/request/type/completion branch, missing poll/finalizer/
demand/buffer history and missing trace are rejected. Sealed real sidecars
exercise both callback branches and reject foreign ownership/counter history/
return branch/destination. Immutable getter-only Level readback models test
nil→table, initial-table unknown history, changed instance and deadline. These
models are not a claim of newly executing original Level creation. Focused
qualification and `flock /tmp/wine-build.lock bash tools/build.sh` passed.
Each native arm used28 queued commands. The tested normal/compat module hashes
are `4417305d…c0a6b` / `07fb4e75…4ed34`; loaded Worker source is
`1a444957…738e1`. Full hashes, stable-source/module checks, logs, preparation
and tested Git SHAs, relevant binary diff and owned new-file patches are in RUN.

## Exact next original action

At the retained boundary, the next native file action is return from the current
zero-delay SleepEx into45774a, copy4096 bytes to destination+184320 and update
context+10. Another3904 output bytes remain after that copy. Completing the
decoder/checksum and original return path is still required before the aggregate
adds192320 and completion becomes1. This is a work requirement, not a prediction
that a particular16-slice quantum suffices, or a promise of decoder success.

The closed df3674a57 attempt must not be resumed. A coordinator-authorized
future runtime must bind/install this observer before the owning main instance,
retain the existing measured Escape/New Game/Medium and personal-review guards,
then use the existing input-free16-slice construction observation under its
unchanged bounds. Collect correlated frozen main/file sidecars; observe cursor
progress, completion and byte delta separately from main finalization/dofile
buffer consumption and nil→Level-table creation. No callback, game key, Lua
write, budget extension or fresh attempt is authorized by this offline result.
