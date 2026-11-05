# Conan demo: WORLD writer provenance, 2026-11-05

Task: `NEW-GAME-CONAN-DEMO-20261010`. Evidence is in
`scratch/runs/20261105-conan-world-writer/`; Git is the source archive.

This investigation follows `bfba3542a` and
[the first-draw findings](conan-first-draw-20261105.md). The predecessor captured
device 136450064/generation 1, queue 62083, with a zero WORLD upper 3x3,
nonzero translation, NORMAL input, lighting and specular enabled. WORLD slot 10
agreed between the producer and executor. Those facts did not identify a writer.

## Scope and diagnostic

The ordered legacy-alpha16, AoW2 callback and Aranna releases were observed at
21:29:42Z, 21:50:39Z and 22:10:42Z. Independent cleanup verified 611 absent
PIDs, 215 refused ports, 74 absent profiles, four free locks and no heavy runtime.
The gate was 22:11:54Z; the hard deadline is 22:56:54Z. Before that gate only
run-owned helpers were prepared; no shared code, tests, builds or guests ran.

The diagnostic is disabled by default. An existing capability query enables
value-only packets on the existing trace import. The actual owning CPU copies
16 source and destination words, per-instance sequence, device, owning program
or block, guest source address, EIP, thunk, entry ESP and return address. There
is no added guest export, live-export call, guest write, matrix substitution or
change to the strict renderer failure.

Operations: 1/2 live SetTransform before/after; 3/4 recorded SetTransform;
5/6 Apply; 7/8 Capture; 9/10 MultiplyTransform; 11 reset program replacement;
12 initial program attachment. CreateDevice retires its 32-byte stdcall frame
before attachment, so that route reconstructs the entry ESP when recording
caller context. Other routes retain their original API frames.

Host storage is bounded: 32 incomplete packets, 16 device histories of 32 rows,
64 block origins and 16 last live writers. Draw lowering copies WORLD words and
history independently of the render payload. The actual submission receipt
attaches generation and sequence; each device keeps 32 such snapshots plus
its first zero-upper-3x3 draw. Rows and snapshots are deeply frozen. The last
live writer survives unrelated later recorded writes; Apply retains a copied
recorded/captured source origin when that origin remains in the bounded map.
Sequences are per owning CPU instance; cross-thread total mutation order is
not claimed. Missing origins and packet errors must remain explicit.

## Semantics and controls

[SetTransform](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-settransform)
sets the selected transformation state.
[State blocks](https://learn.microsoft.com/en-us/windows/win32/direct3d9/state-blocks-save-and-restore-state)
capture or record state; Apply changes only captured states.
[MultiplyTransform](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-multiplytransform)
must multiply the supplied matrix by the selected state. The existing emulator
handler succeeds without multiplying. That separate source gap is not proof
that Conan uses it or that it caused this failure; this diagnostic preserves
the existing behavior and distinguishes its before/after state.

Published diagnostic: `ffe79b45f` on main. Focused stateblock tests passed,
including copied words, all mutation routes, bounded history and last-live-writer
retention across later recorded writes. The required locked full build passed
after the caller-context correction. The existing real owning-WebGL-Worker
strict-normal diagnostic passed all 24 controls.

The generated ordinary x86 PE calls imported D3D9 creation and actual COM
vtables, including Set/Get/MultiplyTransform, Begin/EndStateBlock, Apply/Capture,
Reset and lit DrawPrimitiveUP. The production owning guest Worker and actual
shared renderer Worker passed disabled and enabled cases. All 12 operation
codes, original guest return addresses, copied input words after caller-memory
overwrites, Apply source origins and exact device/generation/sequence correlation
were checked. A preceding healthy draw snapshot still contains identity WORLD
after the later zero-WORLD write; the failing snapshot contains zero WORLD.
Both snapshots are deeply immutable. Strict singular failure remains identical.

Earlier generated-control attempts exposed two helper mistakes (returning code
instead of the completed PE, and assuming a synthetic boolean lighting flag)
and the CreateDevice trace-context error described above. Failed logs and
correction notes are retained; none used original media. The final strengthened
control passed with exit 0. No broken source was committed.

The genuine 37-file Conan installation and registry were rehashed in place.
Manifest SHA-256: `adf7c78e9ab56519edd53479b2151f04e18496668dec450ba2af12cc0b90cd38`;
registry SHA-256: `64969ff6f94d58b54431e18f937af3374bda5755e233ad62517840e1611d8de3`.
Media remains at `scratch/game-media/conan-installed-20261105/`.

## Single original session

The sole changed-diagnostic original was started at 22:23:19Z after publication
and all controls. It closed normally at 22:43:30Z. This was the only original session.
The actual owning-Worker module was 2,174,894 bytes, SHA-256
`d55b0003873cf0fe7c340c61d98e0bd21dc57190252822eba9acb7c02297111a`,
matching the public controls. Its unique bytes are retained in the run. The
original used diagnostic commit `ffe79b45f`; the later passive guard below was
not exercised by a second original.

Personally reviewed captures show logos, menu, Warrior selection, Kordava
loading and the town/rooftop/street/temple cinematic. Escape did not skip it.
No player movement or second player control response was reached. FPS and
audio remain UNKNOWN.

`first-failing-provenance.json` and asserted `causal-boundary.json` identify
device 136450064, generation 1, endpoint 1, queue **66517**. The completed prefix
is 66516. This is also the first lowered zero-upper-3x3 WORLD draw. Subsequent
lowering through 66519 does not overwrite the retained failed snapshot.

The last live writer is **SetTransform**, operation 2, serial 112385; its before
packet is operation 1, serial 112384. Guest instruction `0x41cd03` calls vtable
slot 44; return address `0x41cd09`, decoded-block EIP `0x41ccee`, thunk
`0x7502aa0`, entry ESP `0x74ff0dc`, guest thread 1, owning Worker slot 0. The
source matrix is guest stack address **0x74ff2d0**; destination program
`0x6d71d4`. The preceding WORLD has identity upper 3x3 and translation
(48.4705047607, 256.5792236328, 4.7315182686), determinant 1.

The caller already supplies twelve +0 words followed by
`[1109070214, 1131938626, 1099106956, 1065353216]`: translation
(38.7671127319, 248.0127258301, 16.3801498413), homogeneous 1. Copied caller
bits equal the before packet's source, after packet's destination, lowered
WORLD and executor WORLD, exactly. No packet errors or incomplete packets were
observed. Lighting and specular are enabled, normals are present; the failing
draw is 12 triangles, stride 32. Strict singular failure remains intact.

**No divergent emulator transformation is proved.** This SetTransform copy is
faithful to its input. The exact unresolved boundary is the upstream guest
producer of stack matrix `0x74ff2d0`. The bounded disassembly in
`guest-failing-world-writer.txt` shows `0x41ccee` loading that pointer from
`[esp+0xe4]`, then passing WORLD (`0x100`) at `0x41ccfd`. It does not explain
why the matrix was already zero before entry. The last writer is neither Apply
nor reset. The retained 32-row tail contains SetTransform before/after only;
this does not prove that Conan never used MultiplyTransform earlier.

## Passive guard and handoff

Review found that the diagnostic's MultiplyTransform source lookup used `g2w`
even though the existing success-noop handler never read that source. A focused
negative control with unmapped pointer `0xf0000000` reproduces a changed quiet-
miss sentinel even with diagnostics disabled (`passive-negative-before.log`).
The guard replaces that lookup with a read-only mapped-page probe across all
64 bytes; it neither faults pages in nor requests lazy DIB materialization.
Unavailable source packets are reported as two explicit collector errors when
enabled. They are never fabricated from sentinel contents. This is a diagnostic
passiveness repair, not a claimed cause of Conan's singular matrix.

Published passive guard: `b487c7514` on main. The regression checks disabled and enabled cases, preserves the sentinel and
existing success result, and checks explicit unavailable-source reporting.
The public x86/owning-Worker controls additionally call MultiplyTransform with
an unmapped pointer, preserve WORLD and continue through all mutation routes
and both healthy/failing draws. Their actual module is 2,175,008 bytes, SHA-256
`3d59cca0579d2ccfdec1561d7403c371af771943f6c8385ce814eacb008c6821`.
Final focused tests, public controls and the
required locked full build are recorded separately from the original controls.

Recovery uses Git commits and `passive-guard.binarydiff`, not a source archive.
`diagnostic-source.json`, source pins, exact module hashes, in-place media hash
verification, command logs, screenshots and original terminal evidence remain
in the run. `owned-runtime-cleanup.json` records independently checked absent
PIDs/profiles, refused ports and free locks after all work. No test box was
created, stopped, deleted or resumed; box ID/state/expiry are not applicable.
The next investigation should trace the guest matrix producer upstream of
`0x41ccee`, preserving this exact SetTransform-to-executor boundary.
