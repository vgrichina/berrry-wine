# Blood II IMRT object lifetime observation

Evidence: `scratch/runs/20261118-blood2-imrt-object-lifetime-cause/`.

The retained fault is IMUSIC25 RVA `0x1c7f`, QueryInterface through the
real IMRT25 object whose primary word and reference count are zero.
`blood2-imusic-null-call-repair-20261118.md` establishes the authentic
secondary vtables and seven passing constructor/ownership cases. It does
not establish a final Release, free, reuse, or a responsible thread.

## Published observation preparation

`tools/blood2-object-lifetime-observer.cjs` reads the compiled emulator's
existing native block-entry and import boundaries. It records actual DLL
table rows and export names, constructor ECX, real registers/stack/thread,
allocation header and object words, QI/AddRef/Release/destructor boundaries,
and IMRT's allocator wrapper arguments. Constructor pointers pass to newly
created Node guest Workers through small evidence files; no guest-memory
publication or guest call is used. Reconstructed memory changes are explicitly
interval observations: concurrent writers and untraced blocks cannot be
assigned a writer from those differences alone. A stack word beyond a mapped
stack is recorded as null rather than read as a valid zero.

The observer has finite time, row, boundary and object bounds. An observation
error or exhausted row/boundary limit closes the original through its existing
owned cancellation path. It never injects input, invokes guest run, sets a
breakpoint, arms an instruction/store watch, patches an object, or changes
COM behavior. The existing trace setter changes dispatch strategy by disabling
optimized chaining/uops; timing and scheduling equivalence are not claimed.

Focused reader tests pass. Native on/off controls execute unmodified IMRT25
and IMUSIC25 constructor/QI/transfer code, the exact loading IID, and a final
Release through the real destructor/free path. Both arms return identical
contract results and freed object bytes. The observed arm records constructor
provenance, Release-to-zero branch and allocator free argument. These extend
and reuse the seven prior passing cases; they are no behavior-repair proof.
A separate real CLI/normal guest Worker/software-paint control has identical
whole-frame pixels and exit zero with observation on and off. Both arms have
actual native/watchdog waits, separate EOFs and containment `leaked:false`.

The controls reuse the exact `4808701de` sealed source graph: 1404 inventory
rows, unchanged 99 media pins and module SHA-256
`7d347a6a631ab77335a14935a533feb896be71aa2508fc5aa19b1e5df8f096ce`.
Main/Worker media and renderer dependencies pass the existing native preflights.
Preparation harness corrections are retained; missing preload path and a
stack-tail observation error were harness defects, not Blood II failures.

## Authorized original: observer failure before menu

Preparation was published as `697184394` after focused tests, native controls
and the locked full build, followed immediately by successful strict pull/push.
Exactly one original was launched, PID 2318565, at 02:53:55 UTC. Its actual
module table confirms IMUSIC25 base `0x00cd0000` and IMRT25 base `0x00d41000`.
The real constructor receives ECX `0x00c189ec`, allocation header 208, and
initially zero payload. Subsequent native observations show its genuine
primary/secondary vtables and retained references.

The trace contains 62 Release entries on actual exported thread IDs 1, 3 and
4. Return callers are IMA `0x00d2ee99`, `0x00d2eeb6`, `0x00d2eed4` and IMUSIC
`0x00cd2ef4`, `0x00cd2be7`. The music Workers repeatedly AddRef and Release
back to reference count 2. No Release-to-zero branch, destructor, allocator
free or primary-word invalidation was captured. This is measured shared-object
lifetime activity, not a cause for the previous T2/T3/main failures. Numeric
thread IDs here come from the native exports; the launcher uses separate
Worker labels.

At 02:54:09.899, the later audio Worker's observer (Node host thread 6) tried
to read the constructor-pointer evidence `.json`. The unchanged sealed-source
loader correctly rejected that unsealed JSON path. This is an authored
observer defect, not an emulator/game defect. The observer emitted
`UNKNOWN:unobservable` and requested owned cancellation. The native host stopped
after 13.353 seconds. The sole attempted menu capture was subsequently rejected
by the helper's local `native terminal` check before any endpoint request.
No screenshot, binding, Enter, movement, fire or Quit was requested or consumed.
The scope is closed: no endpoint requests, replay or additional original follow.

The diagnostic correction uses `.dat` for pointer evidence, preserving the
sealed loader's JS/JSON source policy and the exact source/module inventory.
An actual native sealed-loader regression reproduces the old JSON rejection
and passes the production DAT reader after a genuine constructor. Corrected
native lifetime on/off and normal guest Worker/software whole-pixel controls
also pass. This repairs only the observer. It supplies no behavior repair,
oldfail/newpass emulator claim, or authorization for a second original.

The cause remains unmeasured because the authorized original closed during
startup on its observer's late-Worker handoff. No genuine invalidating write,
final Release or free has been identified. No runtime source, COM behavior,
DLL, media, guest clock, input guard or held investigation was changed. World,
gameplay and ordinary Quit remain unproved.

Native and independent finite/disk watchdog actual waits are zero, with both
EOFs, no drain errors and containment `leaked:false`. Exit zero is host
cancellation, not ordinary game Quit. The original watchdog's minimum free
disk was 2,250,899,456 bytes; no RAM gate was used. Recovery is exact Git plus
the relevant unapplied diff and owned-file patches, the existing unique module,
99 existing media paths/hashes, and selected control PNGs. No source archives,
frame series, capture bundles or media copies were made. Final cleanup and
artifact readbacks are retained; `result.json` is written last.

No boxes or agents are created. Box ID null, state NOT_CREATED, expiry null,
stop receipt null. Held SimsD8 and other investigations are outside this task.
