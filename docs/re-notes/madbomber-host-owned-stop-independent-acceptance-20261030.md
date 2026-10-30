# Independent host-owned midiStreamStop acceptance — 2026-10-30

Decision: ACCEPT within the production JavaScript host-import boundary at candidate
`6667b2a8b6fb5ac80e609bcb490535d103db9e10`. No counterexample was found.
Production code is unchanged. This acceptance does not establish browser audio,
guest/WAT callback frames, gameplay, or full WinMM conformance.

## Source and oracle

The new independent oracle is `test/test-midi-stream-stop-independent.js`.
Normal execution requires the complete, untransformed production
`createAudioHost` module. It asserts host-audio SHA256
`00e02890ff3010cb514bbff3e946d9cbc8c00d8cba2d2966a16950e585574bdb`.
It neither imports nor extracts setup from the existing three-case regression.

Expectations come from the pinned production source:
- `_midiComplete` (lines 2238–2244) marks each submission done, releases pending
  ownership, changes DONE/INQUEUE, and notifies using the guest header.
- `_midiDrain` (2245–2257) detaches the invocation before notification and clears
  running/deadline/remainder/pause state.
- `_midiStopNotes` (2275–2285) emits counted note-offs per channel, retaining
  controller state; `_midiClose` retires handles and drains remaining work.
- Callback registration captures its receiving VM (2170–2194).
  `_pumpMidiCallbacks` (2218–2237) rejects a changed owner, retains an item on
  false return/throw, and guards nested pumps.
- Stream control (3923–3944) acts on the selected stream; header submission
  (3963–4009) owns each invocation independently of delayed callback delivery.

The receiver is a deterministic acceptance/backpressure/exception fixture.
The synthesizer records MIDI messages; it does not synthesize sound, simulate
sustain acoustics, or assert audible silence. Exact note-off counts and retained
controller state are the stop checks.

## Results

Five independent cases pass:
1. Counted same-pitch notes on two channels receive matching note-offs; a sibling
   stream's messages, pending header, and later deadline remain unchanged.
2. A header is requeued before old callback delivery. Two false-return attempts,
   reentrant stop/close, and a nested pump preserve exactly one accepted callback
   per submission and one close notification.
3. Changing the receiving VM fails before foreign delivery. Restoring it and
   surviving a receiver exception preserves the original callback/instance/guest
   header after close and opening a new handle.
4. A synchronous event receiver requeues the first header during a two-buffer
   drain. The fresh invocation survives, runs on its own timeline, and signals
   once; redundant stop/close adds no completion.
5. Stop clears a fractional deadline paused across DWORD clock wrap. Reusing
   the header executes only the fresh event at its fresh deadline.

Four in-memory production mutations fail at the intended assertions:
| Mutation | Observed distinguishing failure |
|---|---|
| Omit stop drain | Pending header flags 18 instead of 3 |
| Omit note shutdown | Missing three counted per-channel note-offs |
| Drain/stop every live device | Sibling header flags 3 instead of 18 |
| Deliver WASM instead of guest header | Header 512 instead of 6291968 |

Each mutant exits 1, checked against its specific assertion text. Production
execution exits 0 with five passes. No production file is modified by mutation.

Run using Node with `--max-old-space-size=192`:
```sh
node --max-old-space-size=192 test/test-midi-stream-stop-independent.js
node --max-old-space-size=192 test/test-midi-stream-stop-independent.js --mutant=drain
node --max-old-space-size=192 test/test-midi-stream-stop-independent.js --mutant=notes
node --max-old-space-size=192 test/test-midi-stream-stop-independent.js --mutant=ownership
node --max-old-space-size=192 test/test-midi-stream-stop-independent.js --mutant=identity
```

The existing regression was attempted once as baseline and failed before any
case because `lib/audio-worklet-host.js` was not materialized. That dependency
was then recovered exactly from the candidate Git object (14592 bytes, SHA256
`710fe1ede2bfcebbf0378109a755705f68a5792881669937e08430ec3d49cd14`).
Independent execution subsequently loaded the production module successfully.
The existing suite was not retried and is not independent acceptance evidence.
No WAT closure recovery or lifecycle suite was attempted.

## Controls and publication

All behavioral and Git commands ran under the task-owned `ops.py`, with explicit
owned repository CWD. Startup verified Node v24.18.1 with heap flag 192 MiB,
inherited unlimited DATA/address space, CPU 60 seconds and file cap 12 MiB.
The supervisor monitors group RSS 512 MiB, parent RSS 128 MiB, wall 90 seconds,
capture 512 KiB and evidence 1 MiB; Python DATA is 128 MiB and Git child DATA
256 MiB. A heap flag is not a total-process memory limit. Each operation retains
its fresh physical-memory/disk admission record. The 24 MiB allocation includes
an 8 MiB reserve retained through coordinator closeout.

No checkout, mounts, Boat, browser, guest or game runtime was used. There is no
filename-bearing mount argv to validate. Strict pinned GitHub SSH configuration
is supplied by the supervisor; publication uses an explicit SSH Git URL.
No root/donor Git mutation or main integration is authorized.

Canonical receipt, recovery patch/recipe, command results and coordinator board
note live in `/tmp/madbomber-host-owned-stop-independent-accept-oct30/`.
The receipt records exact commit, branch and independently queried remote SHA.
Live finalizer stdout is excluded from its evidence manifest. The predecessor
closeout-stdout correction (322 bytes, SHA256
`279526ed4391ffe6f7f0a813a3d79fdace21189501f1eda00382af3babf0ed83`)
is inherited context, not a new verification of all predecessor evidence.
Coordinator owns messageboard append, integration and reservation release.
No test box was allocated; shutdown ownership remains with the coordinator.

Publication fixture limitation: normal porcelain commit failed on inherited missing
blob fa892149d9df88d9cbb0e4e01893cfbe91ed0fac (docs/re-notes/half-life-uplink.md).
The sparse index retains candidate entries; no missing production closure is
recovered. Commit construction uses Git write-tree --missing-ok and commit-tree,
after verifying only the two new acceptance files differ from the pinned parent.
Both new blobs are present and checked; inherited missing references are retained
unchanged. The initial premature push published only the candidate; final remote
verification must match the acceptance child commit. All resource/access controls
remain unchanged.
