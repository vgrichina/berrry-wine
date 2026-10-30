# Original GLTron 0.70 exact API trap — 2026-10-30

This task did **not** establish or repair the causal runtime boundary. The single
permitted repaired-candidate retest reproduced the identical original trap.
The candidate production changes are retained as an uncommitted experiment in
the task recovery archive, not included in this commit.

The original executable is 180224 bytes, SHA-256
`85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec`.
Pinned `objdump -d/-p` establishes CALL at `0x42282a`, return `0x42282f`,
trampoline `0x423592: ff 25 b0 41 42 00`, IAT slot `0x4241b0`, and named
`MSVCR70.dll!abs` (hint 645). The caller pushes one signed integer (`-5` in the
actual trap) and pops its argument after return: cdecl, integer EAX result.
The executable import is not an ordinal import. This does not identify the
runtime-resolved thunk, forwarded target, or failing metadata at that slot.

Parent `d19e5e32e95d1fccb684917eb08e623c12ef39fa` has neither an `abs` API table
entry nor a CRT handler. An experimental integer abs handler, appended cdecl
table entry, and generated hash/dispatch tables passed focused behavior tests
including `abs(-5)==5`, signed boundary values, return-address-only ESP cleanup,
and preservation of other memory/registers. The unchanged parent's missing
registration and a zero-result mutant were both rejected. Both generators'
`--check` modes passed, with their literal relative helper closure staged.

Canonical compile used `/usr/bin/node --max-old-space-size=512
tools/build-compile-wat.js`, rooted at `src/main.watx`, with no symbol/harness
substitution. Experimental wasm: 1883006 bytes, SHA-256
`8bf90b62c1d1a074dab2f6051e93ba349c776b711487d13bce1fb08e7e8b68f4`;
compat: 1885579 bytes, SHA-256
`2eed7e853097b247ec04d06d744ea2645ea5ffbbb01e60f1dced686d0ff572b0`.

The one original retest started `2026-10-30T16:25:04.917443Z`, with the unchanged
production runner SHA-256
`e01db98dddc51a9f4e65de9a1844010800ef2bfa74815e22610b68b7df8e0243`, registered
GLTron distribution and all 92 original files. It exited 1 after 0.242 seconds:
same null/ordinal trap EIP `0x423592`, ESP `0x074ff16c`, return `0x42282f`,
first argument `0xfffffffb`. No PNG was produced, and no gameplay is qualified.
There was no diagnostic game run, additional retest, or subsequent API repair.
The msvcrt.dll warning remains an observation, not proof of the failing API.

Retained evidence is under
`/tmp/gltron-exact-ordinal-production-repair-oct30/`: exact identities, static
disassembly, selected bounded test/control/build/retest logs, source experiment,
and recovery/readback records. The actual runtime IAT value and thunk metadata
were not captured by this non-observing retest. A future separately assigned
task must prove that boundary before another causal production repair; adding
the independently missing named abs API alone did not fix it.

Authorized donor `bx_hy375wz2` snapshot `2026-10-30T16:11:18.741Z` was immutable.
Finite-TTL fork `bx_35gudj8u` had the independent watchdog armed before first
remote exec; explicit shutdown delegation was used. Snapshot completed
`2026-10-30T16:26:13.651Z`, then STOPPED was verified. Original expiry was
`2026-10-30T16:53:49.388Z`.

Publication remains PENDING under the unchanged trusted SSH public-key denial;
no GitHub push/ls-remote was attempted and no remote backup is claimed. No shared
root/main changes, public deployment, Telegram, or worker launch occurred.
