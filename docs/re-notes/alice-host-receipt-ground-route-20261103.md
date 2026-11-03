# Alice original host receipt, ground capture and route — 2026-11-03

Run: `scratch/runs/20261103-alice-host-receipt-ground-route/` (ignored evidence).
This is one task on one fresh boat, `bx_974w85x2`, originally expiring
2026-11-03T20:09:42.170Z. No predecessor boat was operated.

## Exact input and evidence boundaries

The staged tracked input is commit `277f9a32c984562ef33b2d32a5c13df949b5f87a`,
including Alice fault retention `0c2bc2da5641695157703a778a377e6f44b16d74`.
The matching-input check refused reuse of the older `0a58fd7b…` module:
compile inputs differed. Compilation of the exact staged input produced
2,125,777 bytes, SHA256
`065267ce7c208cb369b1fa930425627b3a238c9e184e5aa46d8ef16143b8b5b8`.
The 43 original/dependency pins, actual game manifest, pngjs, stdole2.tlb,
imports and startup were verified before original runtime. No compilation
archive was downloaded. Later sessions reused this module only after unchanged
compile-input and full source/module verification. Each process has its own
host module receipt matching compiled and instantiated bytes and PID.

Inherited post-stop capture/contact/request/failure repairs, startup readiness,
and module receipts were pinned from the three predecessor repair manifests.
The old accepted cave/menu/readiness fixtures were not repeated as acceptance
work. Every new session used original NewGame/Easy and the natural opening.
The control entrypoint waits for the same live PID/start tick and the actual
server.listen callback before command one. Module bytes are read from host
receipts; no `actual_module`/`wasmBytes` evaluator submission was made.

## First failures and bounded repairs

Session one (PID 6511) reached the original cave at batch 4104. Its first
movement-return capture failed `movement argument record mismatch`. Full raw
native module/lifecycle tables, stack, selected Player diagnostics and first
error were retained. The reserved world classifier had not yet executed.
Original callback instruction `10097a7e: mov [ebp+8],ecx` overwrites the first
incoming argument with an event temporary. At cdecl return `00452f63`, that
stack slot therefore cannot be required to equal the incoming record. The
second stack slot remains the command pointer. The first attempt did not read
those pointed command bytes before failure; they cannot be reconstructed from
the separately retained engine copy.

The task-local repair retains the complete return stack and event scratch,
reads the actual pointed 20-byte command and independent engine client copy,
and requires byte equality. It does not invent incoming argument bytes.
Synthetic controls, the actual retained first stack, and the original mapped
overwrite instruction test this repair; these are offline controls, not new
native qualification.

Session two (PID 13919) reached the natural cave but an optional pre-call
breakpoint targeted instruction `00452f60` inside a decoded block. One credit
completed with the gate still armed and unheld. A host assertion expecting a
hold failed; no native fault was reported. The original gate could not replace
an unheld arm. The session was stopped ordinarily with its diagnostics intact.

The second task-local repair permits replacing an unheld arm after validating
the replacement signature. Held/failed gates remain immutable. Five focused
controls passed locally and on the same boat, including invalid replacement
preserving the prior arm, held replacement rejection, normal release and
duplicate release. Session three (PID 21137) uses this tested gate and the
command-stack repair. No tracked runtime, compiler or Jedi source was changed.

## Native outcome

Session three is PID 21137, session
`b29fff6e-9f1e-4876-9c59-8d00131eda90`, actual DLL base `0x02d40000`.
Native held movement-return captures passed 56 relocated windows and 377
relocation operands each. The complete loader table (capacity 64), lifecycle
table (64-byte stride), raw stack and command copies accompany each capture.

| Held epoch / batch | Origin | Ground number / walking / plane | Contact |
| --- | --- | --- | --- |
| 1 / 4106 | (-4183.4814, 5999.9497, 32.125) | 1022 / true / true | reserved world, water 0 |
| 3 / 4147 | (-4178.5610, 5993.1230, 32.125) | 1022 / true / true | reserved world, water 0 |
| 4 / 4176 | (-4178.2803, 5972.3833, 128.2834) | 1023 / false / false | null ground/contact, water 0 |

Epochs 1 and 3 have identical neutral command input fields, with different
command times; there is small XY drift, so exact stationary coordinates are
not claimed. Epoch 4 follows ordinary Space input and retains its actual
20-byte command including upmove 127. Airborne classification follows native
flags/records and height, independently of screenshots.
The actual API has live count 208 and capacity 1024: reserved world 1022 is
handled separately from ordinary live entity bounds, repairing the original
rejection against live 208.

Epoch 2 stopped at the actual DLL callback entry. Its raw stack contains
return `00452f63`, selected record `7ddb0014`, and the actual command pointer;
the pointed command and engine copy agree. This entry and epoch 3 are different
movement invocations. They are not presented as a paired call/return trace.

All three return captures select Player `03aea628`, raw allocation `03aea614`,
in the same PID/session/module generation and backlink chain. The passive
native allocator log has 106,170 events through the first route movement,
zero observer errors, and one matching allocation: sequence 88,497, batch
3302, requested 2048 bytes/tag 4, aligned block 2068 bytes. No matching free
occurs through the sample interval. Three same-held header/tail reads match
the block size, DLL size, sentinel `000facc2`, and relocated Player vtable.
Native allocator/free, DLL wrapper, deleting destructor and vtable bytes match
the exact original PE bytes with relocations applied. This establishes the
same observed Player allocation lifetime across the samples. The original
capture helper's conservative `allocationGenerationProven:false` and
`usableForFooting:false` fields are preserved; the separate
`attempt3/native-sample-assessment.json` records the joined native evidence.

Ordinary W, strafing and relative mouse input traversed the cave/timber bends
and reached the first gnome's “Ride the wind” sequence, observed by batch 6238.
The inspected capture at 7838 shows the HUD returned. Native epoch 11 then
records `(-4974.8232, 5419.0796, -119.875)`, heading -180, dry reserved-world
support. The subsequent west/south approach overshot into the steam basin:
epoch 12 is `(-5165.0708, 5061.2246, -379.4069)`, water level 3. This is below
the authentic wind trigger's lower bound -320. One ordinary Space attempt
does not establish a lift: epoch 13 remains underwater on the basin floor,
`(-5172.9214, 5077.1572, -383.875)`. The timber plank and steam were inspected
in screenshots, but wind lift, crossing, far-side landing and knife acquisition
remain unverified. No attack was dispatched.

At closeout, an avoidable auxiliary `input-state` request was rejected because
the launch did not enable `--trace-input-dispatch`. Its first error is retained,
and it triggered ordinary exit 0 after 1479.511 seconds. Final fault-status and
snapshot preceded that rejection. The native samples and gameplay above were
already complete. A separate offline closeout-plan guard removes that request
for this launch and tests missing/declared flag cases; it is not native-qualified.
Another full natural opening plus recovery could not fit the remaining lifetime; none
was launched just to repeat this auxiliary diagnostic. Read-only retirement
checks confirm game/supervisor/helper PIDs absent and control port 8123 closed.
The final native fault receipt is armed, failed false, terminated false, fault
null. It distinguishes the host diagnostic rejection from a native guest fault.

## Recovery and shutdown

The run's `RECOVERY.md` specifies complete source/module/evidence restoration.
Large payloads remain in one complete archive rather than duplicate binary
trees. Every archived payload is streamed through size and full SHA256
verification locally before the explicitly delegated ordinary boat STOP.
Synthetic recovery controls reject changed bytes, duplicate members and path
traversal. The complete archive contains 7,456 payloads, 168,726,074 bytes,
SHA256 `3ce6777c1245653c68b02e0535019b757b7c049356b65a5f1a4f4f6953b6af34`.
All payload sizes and full hashes passed locally before STOP. Final source
checks passed 5,931 / 5,964 / 5,964 pins for sessions one / two / three.
Boat state is confirmed **stopped**. Stop `stop_00dc1ca82c143018` completed
2026-11-03T20:00:35.847Z, error null, forced false; the available snapshot
completed and verified at 20:00:33.613Z. No resume or successor was created.

Only this note is committed; executable repairs and full evidence remain in
the ignored run and complete archive with recovery instructions. No tracked
source changed, so a new repository build was not required. Focused scratch
controls, actual original compilation, native captures, full recovery checks
and documentation whitespace checks are recorded separately. Remaining
gameplay limitation is the basin-to-wind crossing, followed by the far-side
plank/knife route; neither crossing nor weapon readiness is claimed.
