# Mad Bomber midiStreamStop semantic blocker — 2026-10-20

**Blocked; no production fix or export was added.** A narrow stop handler
cannot correctly reuse the existing MIDI reset/completion machinery.
The missing prerequisites are per-stream ownership of pending headers and
callback registrations, a MIDI completion delivery path, and device-scoped
note stopping that does not invoke the shared synthesizer's all-sounds-off.
Those require changes to the existing MIDI lifecycle/host callback path,
beyond adding a stop handler and helpers. This is not a claim that MIDI
streaming is impossible to implement; it is the boundary of this assignment.

Tested source: fetched `origin/main`
`1262cbfcf8b5881543f2fb18c0f80b4bd9429306`.
The only committed changes are this report and its diagnostic JavaScript.
No API registration, production source, main merge, full build, original
rerun, browser, Boat, native execution, or other worker was used.

## Original instruction-level cause

The retained **original** `SDL_mixer.dll` has preferred image base
`0x10000000`. Its observed load base is `0x009da000`.
Thus original VA `0x10047cb9` maps to observed `0x00a21cb9`.
This is the unpacker's import-resolution loop, before the unpacked DLL
initializer, not a call to midiStreamStop itself:

```text
10047cae  push edi                 ; import name
10047cb2  push ebp                 ; loaded module
10047cb3  call [esi+0x4739c]        ; GetProcAddress
10047cb9  or eax,eax
10047cbb  jz 10047cc4
10047cbd  mov [ebx],eax            ; nonzero: save resolved import
10047cbf  add ebx,4
10047cc2  jmp 10047ca5             ; continue import resolution
10047cc4  popad
10047cc5  xor eax,eax
10047cc7  ret 0xc                 ; zero: return FALSE from DLL attach
```

The retained original log records API #707, `GetProcAddress` for
`midiStreamStop`, return address `0x00a21cb9`, result zero, immediately
followed by attach failure for module `0x9da000`. The branch above therefore
explains the observed failure exactly. A nonzero export would pass this
particular import check, **not establish SDL_mixer initialization or gameplay**.
No original instructions after that point were run here; callback mode and
later use by the original game remain unqualified.

The earlier qualification was on `ee139a0947c82e3a8eba4920508cb760d99882f5`,
module SHA-256
`5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21`.
That original log is historical evidence, separate from this source probe.

## Contract and actual prerequisites

Microsoft documents that
[midiStreamStop](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamstop)
returns pending stream/SysEx buffers through the callback mechanism, sets
MHDR_DONE, rejects invalid stream handles, and stops note-on-created notes.
[midiOutReset](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midioutreset)
also returns pending buffers, but has stronger note/sustain reset semantics.
It is not a substitute for stream stop.

1. `midiStreamOpen` hands callback, instance and flags to
   `host_midi_out_open`; the host retains them as inert object fields.
   The WAT stream state retains no callback registration or owner. Normal
   `midi_stream_service` only changes flags, never emits MIDI completion.
   `midiOutReset` only calls the host reset; it cannot see the WAT queue.
   The existing owner-authenticated wave callback export hardcodes WOM_DONE
   (`0x3bd`), not MOM_DONE (`0x3c9`), and is not a generic MIDI callback seam.
   Queue draining alone would silently skip required notifications.
2. WAT has one set of module-local stream globals. A second successful open
   overwrites the first stream and queue indices, while both host handles
   remain valid. The first pending header stays INQUEUE and its stream is
   then rejected by Restart. Stop cannot discover that lost header from
   these globals. Cross-instance/process ownership and lifecycle must be
   resolved before a general public stop implementation.
3. The actual TinySynth host path shares one synth across MIDI devices and
   does not retain device-attributed active notes for that path. Host reset
   calls allSoundOff on all 16 channels. A reset of one handle silences notes
   submitted through another. A WAT reset alias would inherit this behavior;
   adding a stream-only note list would still miss ordinary midiOutShortMsg
   calls using the same handle and could not separate overlapping synth voices.

The necessary follow-up is a bounded MIDI lifecycle/completion task with
explicit ownership of `lib/host-audio.js` and any callback delivery seam,
along with this audio fragment. It must preserve per-handle headers and
registration identity through stop/reset/close and deliver each completion
once on the appropriate owner. It must distinguish stopping note-on-created
notes from broad reset. No general audio redesign is proposed here.

## Executed diagnostic

`probe.js` compiles **1,275 bytes** of isolated Wasm from the actual current
Open/Out/Pause/Restart/Close/Reset/service bodies and stream globals using the
vendored compiler. It executes those bodies with the actual `createAudioHost`
MIDI imports. It uses one 64-KiB memory, identity guest addressing, a bounded
test heap, deterministic ticks, a recording synth double and notification
spies. It is not a fullVM, x86 dispatch, real audio-output, callback ABI or
native test. Open allocates actual host MIDI handles; no successful fake
stream handle is injected.

Seven diagnostic groups passed:

| Probe | Actual observation, not desired WinMM behavior |
|---|---|
| Public API table | midiStreamStop absent; no public ABI implementation exists |
| Queued stream + Reset | returns 0; flags stay PREPARED\|INQUEUE (18); restart emits stale note |
| Playing stream + Reset | same, including an already scheduled future event |
| Paused stream + Reset | same, including paused timing state |
| Normal completion after those resets | flags become PREPARED\|DONE (3), zero callback notifications |
| Second stream open | both host handles valid; first Restart returns 5; header orphaned INQUEUE |
| Invalid handles and note isolation controls | unopened NULL Restart incorrectly returns 0; foreign Restart/Reset return 5; targeted note-off preserves sibling, reset silences sibling |

Every executed handler call checks its actual stdcall ESP increment. A
`--require-conformance` negative run intentionally fails the documented reset
buffer-return assertion (`18 != 3`), independently of the missing stop export.
The targeted note-off control proves the recording synth can preserve another
channel's note; all-sounds-off is what removes it. These observations reject
the tempting reset-alias implementation. They are **not passing stop tests**.

No position-query contract is qualified: there is no midiStreamPosition
entry in the current API table. The probe covers scheduling and stale
playback, not an invented absolute position guarantee. Microsoft's
[Restart contract](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamrestart)
resumes paused output and does nothing to output already running;
[Open](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamopen)
starts paused and accepts multiple callback mechanisms. New implementation
tests must cover position/timing and each supported callback mode explicitly,
including event, window/thread and function notification, close/reopen and
reentrancy. This task does not replace those tests with source-text matching.

## Evidence and next qualification

Self-contained evidence:
`scratch/runs/20261020-madbomber-midi-stream-stop/`.
It contains the source/compiler snapshot, source Git/SHA identities,
`probe.js`, diagnostic and expected-failure logs, original DLL, original
launch/log/qualification receipt, disassembly, byte/branch verification,
report, task receipt, remote-ref verification and artifact hashes.

Replay without a build or dependencies:

```sh
node probe.js snapshot
node probe.js snapshot --require-conformance # expected exit 1, buffer-return assertion
node snapshot/tools/disasm_fn.js original/SDL_mixer.dll 10047c82 28 --linear
```

The original DLL is extracted from the retained qualification's
`original-assets.tar.gz`; the full original closure/recovery archive remains
there untouched. The evidence bundle includes the actual DLL needed for the
instruction analysis, so replay does not depend on ignored game files.

**Next step:** coordinator assigns the MIDI ownership/completion prerequisite
with the required host/callback scope, then reviews a real stop implementation
and public export/ABI tests. After integration, separately schedule a canonical
build, public x86/native fixture and one guarded original launch on the reserved
runtime. No native or gameplay claim follows from this diagnosis.
