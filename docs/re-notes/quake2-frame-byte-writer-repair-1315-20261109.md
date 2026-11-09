# Quake II frame+0xe8 writer, offline 1315

`frame+0xe8`, address **0xa9cf80**, is the received frame's **entity
count** (`num_entities`, an inferred semantic name). It is not playerstate,
health, padding, a render counter or an acceptance flag. The original delta
entity routine increments it at **0x402a9f**, before decoding that entity.
No production repair is justified: the retained rejection fits native parser
work before publication, which the current reader deliberately rejects.

Implemented `tools/quake2-frame-field.cjs` and its offline test. The CLI checks
the existing retrieval receipt's stored and decompressed SHA/size, checks gzip
CRC, selects the first armed health terminal without skipping HP loss/death or
UNKNOWN, decodes complete frames, and reports every changed byte. It verifies
the canonical executable SHA and records hashes of 19 instruction windows,
including writers, publication, render/prediction readers and signed HUD health.
It writes a fresh output exclusively. It invokes no guest reader or runtime.

Evidence: `scratch/runs/20261109-quake2-frame-byte-writer-repair-1315/`.
`git-base.txt` plus `owned.patch` is source recovery. The exact binary remains
at `test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/quake2.exe`,
SHA256 `2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
Small disassembly extracts are retained; no source tree, executable, media or
module was copied. Matching original C source is unavailable locally; names
below come from actual instructions/data flow, not a different Q2 source layout.

## Exact1265 result

The decoder consumes the original1265 receipt/history in place. Stored history
SHA256 `d142b399321787256cc41a497ea3d049a42f71129dedaf63b0af3a2f17a6872c`,
uncompressed SHA256 `9a45cda91fd24966389c3a9c06ac04ec2e0269381fb49b59e84ee63804741433`.
Row1462 of1463 is the first armed terminal. `motionEqual:false` executed;
`motionPublishedMatches` and `damageRingEqual` did not execute. The new report
preserves that distinction instead of treating an offline comparison as a check
that ran in the original invocation.

| Field | Current first | Current second | Published, both |
|---|---:|---:|---:|
| valid | 1 | 1 | 1 |
| frame | 586 | 586 | 570 |
| time ms | 58600 | 58600 | 57000 |
| delta frame | 585 | 585 | 569 |
| signed health | 100 | 100 | 100 |
| entity count, +0xe8 | 5 | 9 | 15 |
| entity cursor, +0xec | 7915 | 7915 | 7675 |

Both state values are4. Slot `0xa9d8ec` is
`0xa9cf8c+(586&15)*240`, still holding frame570 (one16-slot wrap earlier).
The sole current/current difference is offset232 byte5→9. Both published
copies and both3840-byte damage-ring copies are identical. Full32-bit count
decode confirms5→9; this is not an isolated-byte interpretation. The common
damage-ring SHA is `55ed43772b30a4d98c4ea17df7bb0f916635c70cc163915ac4ea2742496e2cc9`.

## Actual writer and reader ordering

| Actual executable boundary | Evidence and effect |
|---|---|
| 0x409200 / 0x409210–221 | Client reset clears0x92d6 dwords at0xa9c7c0; range includes cursor, current frame and published ring. This is a separate lifecycle writer. |
| 0x403333–342 | ParseFrame clears all60 dwords of current frame at0xa9ce98, including count/cursor. |
| 0x403351–377 | Stores serverframe/deltaframe, then derives servertime=serverframe*100. |
| 0x4033d3 or0x403445 | Sets valid1 **before** playerstate/entity parsing. Delta path checks prior slot number and entity cursor age (limit0x380). Valid is not a commit marker. |
| 0x4034b8–be →0x402eb0 | Passes current frame as second argument to playerstate parser. Playerstate starts+0x30; signed stats[1] is+0xaa. Stats end before+0xe8. |
| 0x4034f8–fe →0x402bd0 | Passes the same current frame to packet entities, after playerstate returns. |
| 0x402bd5–bed | Takes global entity cursor0xa9c7d8, stores it to new frame+0xec, resets new frame+0xe8 to0. |
| 0x402cb3,0x402d9c,0x402e21,0x402e5b →0x402a50 | Unchanged/changed old entities, baseline entities, and remaining old entities all call the same delta-entity routine with the new frame argument. Removed entities skip that call. Old-frame+0xe8/+0xec are read to walk prior entities. |
| 0x402a57–80 | Uses `(globalCursor&1023)*84+0xa87760` as destination and advances global cursor. |
| 0x402a89–9f | Loads new-frame argument into EAX, loads `[EAX+0xe8]`, increments ESI, stores it back. **This is the count increment writer.** |
| 0x402aad →0x4027e0 | Entity delta decode occurs **after** count increment; count is not proof that all entity bytes have finished. Subsequent copies update centity state at0xa41a40; those are different destinations. |
| 0x402ea7 →0x403503 | Packet-entity return precedes ring publication. |
| 0x403503–527 | Computes `(serverframe&15)*240+0xa9cf8c`; `rep movsd` copies60 dwords from current. This includes count/cursor. It is a multiword copy, not an atomic publish. |
| 0x4035f1 →0x4032c0 | After publication, entity events read current count/cursor and walk entity states. |
| 0x4041a1 →0x403610 | Rendering passes current frame. 0x403676/68c and0x403c85 read count/cursor for iteration. Render construction writes local render entities/centity effects, not this frame's count. |
| 0x403e00–31 | View rendering selects prior valid ring frame or current fallback and reads playerstate; it does not publish the current frame. |
| 0x40b766/784/8e7,0x40b9c1/d5,0x40ba24 | Prediction collision/trace reads current count/cursor; no count stores here. |
| 0x425981/991/9fd/0x425a36/59/b4/0x425b36 | Sound entity-list iteration reads current count/cursor. |
| 0x40d4a5 | HUD uses signed16-bit load from0xa9cf42 = frame+0xaa. |

The whole-EXE text scan retained in `frame-xrefs.txt` also contains unrelated
`+0xe8` accesses (BSP structures and indirect function tables). Those are not
aliases of frame+0xe8. The explicit count increment, packet reset, whole-frame
clear, client reset and ring copy above account for the identified paths;
arbitrary pointer aliases and **all runtime writers remain UNKNOWN**.

The actual page reader (`tools/quake2-passive-attack.cjs`, pinned1265 revision
`6bc4d87eb87de45b39b25b1eed62c6b9518874fd`, current file SHA256
`754f911c40224b57e20f385a57f068793e10dde2b29a4f85a39e14fd2fd6aa35`) reads:
owner/memory/canonical checks; motionFirst(state/number/current/published);
damageFirst; attackFirst; bindings; physical keys; bindingsAgain; attackSecond;
motionSecond; damageSecond; owner/memory/canonical checks; motion equality;
only then active/valid/time/pmType/publication checks, and damage decoding.
All these are point copies of shared memory while the owning CPU may run.

Thus the count can advance5→9 during that observation while the playerstate
and frame header already agree. This is a **static-order inference consistent
with the snapshots**, not proof that0x402a9f executed between the two original
copies. No EIP or writer/copy correlation was retained. The mismatch is not
evidence that the emulator published an incomplete native frame.

Ignoring count, switching to frame570/585, postponing UNKNOWN or rereading
would change the stated acceptance/first-health-loss contract. An atomic native
publication protocol or owner-thread observation would need additional actual
ordering evidence and different implementation scope. No such repair is claimed.

## Validation and precise next boundary

`decoder-controls-02/result.json` passes exact1265 decode and replay of its
retained first/second bytes through the **unchanged serialized production
reader**. The replay still rejects `motionEqual` and never executes publication
validation. It is an authored scheduling seam, not original writer execution.
Actual binary-byte assertions cover increment/reset/calls/publication/client
clear. SHA/size/CRC, missing/invalid snapshots, signedHP−1, death0, first loss,
first UNKNOWN and exclusive-output refusal controls pass.

Existing passive attack/damage suites and all18 rejected-frame controls pass,
including exact shared read count/order, owner/memory rebind, signed death,
UNKNOWN, full generated1205 consumer, terminal ticker zero reads and independent
UP/sticky first failure. Locked `flock /tmp/wine-build.lock bash tools/build.sh`
passes. The production reader, health consumer and input/capture/terminal paths
are unchanged; no acceptance relaxation or read retry was introduced.

The next missing boundary is specific: an owning-CPU instruction/order witness
for **0x402a9f** (destination frame and generation), **0x402aad** (entity decode),
packet return **0x402ea7**, publish **0x403527→0x403529**, and reset/clear,
correlated with the existing first/second shared-memory copy boundaries. It must
distinguish one packet parse from reset/reentry/other aliases without adding
samples, rereads or post-terminal work. This task implements the offline decoder
only; it authorizes no new native experiment. Native cause/lifetime/all-writers/
edict ABA remain UNKNOWN; native remains REVOKED.

No new Box, browser, guest, worker, agent or deployment. Prior1265 box
`bx_vkc8ygzp`, UUID73881327-5a8f-45e1-8654-be4b78254b9b, remains untouched;
inherited API receipt says ARCHIVED/PHYSICAL_DRAINED, unforced completed
`stop_22c93d116b808404` at2026-11-09T12:15:24.514Z. Initial expiry was
12:33:37.727Z, final archiveAfter null, expiresAt not returned. There is no new
stop receipt. Free /home remains above1.5GB. SingleTaskSTOP.
