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

No emulator behavior repair is justified at preparation. The explicitly
authorized single fresh causal original follows publication of this tested
observer, with the existing manual review/input guards unchanged. Its measured
outcome and closure will be appended here after the original ends.

No boxes or agents are created. Box ID null, state NOT_CREATED, expiry null,
stop receipt null. Held SimsD8 and other investigations are outside this task.
