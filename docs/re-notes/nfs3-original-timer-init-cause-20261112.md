# NFS3 original timer investigation: local Chrome preflight blocker

The first real-Chrome observer preflight failed before Chrome published its
DevTools endpoint. No Worker, original-game launch, initializer trace or
matched observer control was reached. The original timer abort's cause remains
**UNKNOWN**. No runtime defect was proved or production change made.

Evidence: `scratch/runs/20261112-nfs3-original-timer-init-cause-1715/`.
Source anchor: main `eec0398723f94568c7d524e9a94e791ad407651f`, with relevant
uncommitted source diff and binary patches for the new run inputs. Git remains
the source archive; no source-tree or media archive was created.

The starting evidence is the [original startup abort](nfs3-native-race-lap-20261112.md)
at `aef26b28e`, with `mmTimerThread=true`, `asyncMultimediaTimer=false`,
executing guest module SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`,
no owning D3D endpoint and zero driving inputs. The
[historical isolated fixture](nfs3-native-timer-cause-0724-20261109.md)
does not reproduce Chrome Worker scheduling or whole-game startup history.
Neither source establishes the cause of the original abort.

The existing final caller's actual `--staged-import-check` branch passed
against the current registered app, complete 133-file installed manifest,
original EXE and current CPU module. Separate negative controls rejected
missing mandatory static-server and app-registry imports. `inputs.json`
records SHA-256 and size for every installed manifest input and the module.
The original EXE is unchanged: 1,577,984 bytes, SHA-256
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`.
These are data/import checks, not execution of the game.

A run-local observer was prepared to wrap the existing `log_eip`, API-entry
and API-exit imports before instantiation, retain native API returns and
read-only register/counter snapshots, and enable the built-in block trace.
Its planned test uses the actual production Worker bootstrap, RPC import
builder and CPU module with a small synthetic PE containing known stores.
This synthetic PE is not NFS3 and invokes no original routine. The observer
and test inputs pass JavaScript syntax checks only. They remain unvalidated:
no successful attachment, observer installation, CPU instantiation, hook
delivery, argument/return pairing, store observation or passivity comparison
was obtained. They must not be used as an accepted original-game observer
without completing the real Chrome Worker test.

The one local attempt used the explicit Chrome ELF
`/opt/google/chrome/chrome` with a fresh run-local profile. Endpoint polling
ran 200 times at 25 ms, then failed `complete endpoint publication`.
Chrome stdout and stderr were empty. This establishes an endpoint-publication
timeout within that five-second window; it does not establish a permanent
Chrome failure, its underlying cause, debugger causation, a timer-policy bug
or a defect in the observer. No CDP connection, Worker creation, guest API,
guest write, forced original routine call, native input or screenshot occurred.
There was no retry, original allocation or corner/lap attempt. The separately
qualified prior paired-driving evidence remains unchanged.

Chrome received SIGTERM because no DevTools endpoint was available for
`Browser.close`; its parent observed exit by SIGTERM and both stdout/stderr
EOFs. The independent local 55-second watchdog was started after Chrome
spawn, terminated by SIGTERM and actually joined. This is not a preallocation
two-hour box-watchdog receipt. No box was allocated, so that gate was never
entered. Native normal quit was unavailable because no guest launched.

Actual `/home` samples stayed above 1.5 billion free bytes; no RAM gate was
used. New box ID: none; state: **NOT_CREATED**; expiry: N/A; stop receipt: N/A.
No preexisting box was resumed, stopped or deleted. No workers or deployment
were launched. No production build or regression was warranted by this
preflight-only failure.

The next prerequisite is a successful real Chrome endpoint/Worker observer
preflight. Only then can an independently guarded private original run and
matched control observe `0x48dad0`, caller `0x4f6e2e`, public API returns,
callback-counter progress and the actual clearing/abort branch from startup.
No native timer fix, race, corner, lap, FPS, audio, parity or broad crash-free
claim follows from this run. This single-task attempt stops at its first
specific blocker.
