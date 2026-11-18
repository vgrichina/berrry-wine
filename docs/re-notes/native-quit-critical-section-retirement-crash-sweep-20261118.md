# Native Quit critical-section retirement sweep

No critical-section retirement defect was reproduced on current main. The
retained LMarbles original remains a proved native Quit status 0 with an
unexplained held-main-section diagnostic. This task adds native regression
coverage; it makes no runtime repair and launches no original game.

Evidence: `scratch/runs/20261118-native-quit-critical-section-retirement-crash-sweep/`.
The final `result.json` records publication, exact source/module identities,
foreign diffs, checks and process cleanup. Git plus those diffs is the source
recovery recipe; the generated module and logs are retained separately.

## Historical comparison and actual observation

Dispatch main was `9191d4afbcd7eb6d84139fef87502f9273ae8d2f`. The prior run used
source `a00eb35bebb621ebb3f2b42b6af18f1bd874b9f6` and module SHA-256
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
Its `original/native.stdout.log` records, in order:

1. Worker 2 exits with yield 2; waveOut closes; process Exit code 0.
2. One registered section is still held by main, lock 0, recursion 1.
3. Final thread reporting still lists worker 1 active.
4. Worker 1 reports `slice failed: Callback owner retired`, then an unexpected
   `sliceDone` message. Native stderr is empty. The original lifecycle receipt
   reports native exit 0 and no known surviving owned process or listener.

`src/09a-handlers3-sync.wat`, including `$cs_release_owned`, is byte-identical
between that pin and dispatch. The ThreadManager retirement fanout and CS
release hook are also unchanged; the intervening scheduler changes concern
Worker in-flight ownership, clock boot holds and D3DIM parking. The exact
historical-to-dispatch diff and current foreign WIP are retained. This is not
evidence that a later CS repair fixed the historical warning.

The held-section report in `test/run.js` reads the registry before final
Worker shutdown. It reports ownership, not a Wasm trap or host exit failure.
Main process termination does not call the worker-thread retirement hook for
main's section. Shared memory and endpoint destruction subsequently discard
that process's state; releasing main's locks merely to silence this report
would not establish a repair.

The requested `win16-native-quit-post-exit-crash-repair-20261115.md` is absent
from this checkout and its Git path history. The existing
`win16-native-quit-exit-20261115.md` was read instead. That investigation proves
a different defect: a real far callback resumed after DOS3Call termination and
the host exited 1. Its real native regression remains part of this sweep's
focused checks. That diagnosis cannot be transferred to LMarbles from a
warning string.

## New native coverage

Run `node test/test-native-quit-critical-section-retirement.cjs`. It compiles
the full canonical WAT closure and generates its own small PE and x86 code.
It uses production host imports, ThreadManager, GuestMainOwner and real Node
Workers, with no retained-run dependency or substituted retirement functions.
The tested module is SHA-256
`fef4be45c6072558a6f94d12b8b163523abd2ddae3651390b797626e4033e0b7`
(2,408,726 bytes). Source and host-library hashes are in `tested-source.json`.
The locked build emits SHA-256
`7d347a6a631ab77335a14935a533feb896be71aa2508fc5aa19b1e5df8f096ce`.
Removing only its 37-byte region-layout custom section produces the tested
module byte for byte (`canonical-module-equivalence.json`).

All 24 controls pass:

- Local and Worker main owners execute EnterCriticalSection followed by
  ExitProcess(0), a seeded root callback return, or a deliberate UD2 trap.
  Clean ExitProcess leaves its post-exit marker untouched and reports exactly
  one exit 0. Root return reports no process exit. Both preserve the same held
  main-section state as the warning. The genuine trap remains a failure with
  no process-exit notification. Main-return coverage is the seeded callback
  return contract, not an original executable's CRT shutdown sequence.
- On cooperative and native Worker schedulers, an owner recursively acquires
  an aligned or packed section and sleeps. A second real guest thread parks
  on it. ThreadProc return, ExitThread(37), UD2, and TerminateThread(23) each
  retire ownership once; the actual parked waiter then acquires, writes its
  progress marker and releases. Exact exit status and cleanup completion are
  asserted; a duplicate release cannot change the section.
- For aligned and packed sections, an actual pending `_runWorkerThread`
  slice races GuestThreadHost STOP. The scheduler records `worker-error`,
  releases the section once, and does not resume the stopped waiter. A
  borrowed callback endpoint rejects late admission. Both Workers are joined
  and the owner endpoint has no remaining native Worker.

The STOP controls naturally reproduce both `Callback owner retired` and the
late `sliceDone` diagnostic while the test process exits 0 and the supervisor
confirms no leaked process. This supplies a concrete shutdown-race control
for the retained wording. It does **not** prove the original game's exact
interleaving or explain why its main section was held.

The first three development attempts exposed fixture assumptions, not runtime
repairs: Win32 ExitProcess does not set Win16's yield reason 2; cooperative
scheduling clears yield 9 after recording a park; and late admission must be
tested on the retained link because the host removes its link on STOP. These
logs and their finite cleanup receipts are retained, separately from the
passing final control.

## Validation and limits

The focused checks cover critical-section struct semantics, concurrent packed
and aligned ownership, exit callback cleanup, ThreadProc return/fault status,
and the native Win16 Quit regression. All five focused suites and the canonical
locked build pass. Exact commands, exits and logs are retained in the run.

Every new native fixture uses finally-owned Worker shutdown. An independent
parent process kills a stuck fixture after 120 seconds, including synchronous
compilation; `native-supervise.cjs` supplies a separate process-group deadline
and cleanup receipt. No Wine, boxes, worker agents, deployment, media copies
or held investigations were used. Disk observations stay above 1.5 GB; there
is no RAM gate. Box ID, expiry and stop receipt are null (not created).

No production source changed and no actual repair was warranted by these
observations. Consequently there is no old-fail/new-pass repair claim and no
unchanged original retry. The precise origin of LMarbles' held-main-section
state remains unproved; the new result establishes current retirement and
shutdown-race behavior within the authored native scope.
