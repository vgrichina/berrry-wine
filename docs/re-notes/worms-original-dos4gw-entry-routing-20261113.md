# Original DOS4GW: entry and interrupt-routing context boundary

2026-11-13 — **NO_NATIVE_RESULT**. The exact root DOS4GW.EXE was recovered
into RAM and verified before static analysis. Its actual MZ entry is ordinary
16-bit startup. Original bytes establish a conditional external-DPMI entry
path, a separate path constructing its own interrupt gates, and a real-mode
procedure wrapper using INT31/0302h. They do **not** yet connect WRMS's protected
INT21/AH30, conditional FF00/INT31/0006 or INT33 frame dispatch to their final
handlers. There is no demonstrated DPMI/MSCDEX incompatibility.

This extends the [WRMS LE entry evidence](worms-original-le-entry-service-path-20261113.md)
and [retained CD/DOS callpaths](worms-original-cd-service-call-paths-20261113.md),
using the [original launch contract](worms-original-dos-launch-contract-20261113.md).
The SETUP investigation remains separate. Original installation, extender
operation, startup success, gameplay, audio and native screenshots remain unproved.

## Input and bounded recovery

Run: `scratch/runs/20261113-worms-dos4gw-routing-1720/`.
The complete-CD manifest in `20261113-worms-cd-stream-0810/manifest.json`, SHA-256
`ab192a904b8e37d898b679405ac3103481b9a67ace676b3fe561264b4c4dcec0`, pins:

| Member | Extent | Length | SHA-256 |
|---|---:|---:|---|
| root `DOS4GW.EXE;1` | LBA 34 | 265420 | `dd9f4f342533f99570475b62e53231a468de2e3d83e4fc31e80c27d3a7d6b49c` |

`recover.py` checks that manifest and makes six ordinary public HTTPS requests to
<https://archive.org/download/worms_team17/CDWORMS.bin>, exclusively in the root
member's raw extent. Five requests contain 56448 bytes; the last contains 22412.
The raw interval is `[79968,384620)`. Each response passed HTTP 206, exact
Content-Range total 578432064, Content-Length and received-length checks.
`http.json` preserves headers, redirect destinations and raw-response hashes.
No failed or denied retry occurred. No FMV duplicate, SETUP, WRMS, whole-image,
CUE or other member request was made.

For member offset `x`, raw address is `(34 + x//2048)*2352 + 16 + x%2048`.
Sector sync and Mode 1 are required; payload extraction excludes headers,
trailers and final padding. The final range ends at the last member byte.
Complete length/SHA-256 passed before analysis (`member.json`). Media existed
only at `/dev/shm/worms-dos4gw-routing-1720.exe`; it was removed after retaining
selected windows, hashes and this recipe. No complete member/image was written
to `/home`. Retained hexadecimal code windows total 2250 bytes.

Reproduce from the checkout root, with a fresh RAM path:

```sh
timeout --signal=TERM --kill-after=5s 360s python3 -u scratch/runs/20261113-worms-dos4gw-routing-1720/recover.py
python3 scratch/runs/20261113-worms-dos4gw-routing-1720/analyze.py
python3 scratch/runs/20261113-worms-dos4gw-routing-1720/check.py
```

`analyze.py` requires the exact original member. It emits bounded disassembly
through static GNU objdump, never executes its instructions. `check.py` also
works offline against the retained receipts, bytes and disassembly columns.
The fetch was guarded by an independent GNU timeout TERM/KILL deadline.

## MZ layout, relocation and appended-format boundary

`mz.json` parses the 512-byte MZ header and all 78 relocation entries. Declared
MZ file end is **F474h (62580)**; the remaining **202840** member bytes are outside
that DOS-loaded image. Exactly at F474h is `BW`, retained as a 176-byte **data**
header with its hash. A reachable-format reader at entry-segment `30D8h` calls
`304Fh` to obtain B0h bytes, then explicitly compares header bytes with `B`,`W`
at `3129h`/`3130h`. This corroborates an appended-format boundary; it does not
validate a BW segment table, compression scheme or unpacked mapping.
Other literal signatures were not promoted into executable headers.

Header CS:IP = **01BD:2382**, SS:SP = **0121:0340**. Thus entry is load-image
`3F52h`, **file `4152h`**, beyond the old 1000h prefix. For assembly below,
addresses are offsets relative to entry segment **01BDh**, unless explicitly
stated. Their file mapping is `200h + 1BD0h + offset`. A far call to **0000:0B12**
instead maps to file **D12h**. Confusing these two contexts produces a false
allocator decode. Protected selectors are never treated as paragraph addresses.

Let `L` denote the unknown MZ load segment. DOS relocations add `L` to the
listed words; raw immediates are not runtime segment values. Entry's `MOV DI,0`
operand at file 4153h relocates to `L`; `MOV SI,01BDh` at 415Ch relocates to
`L+01BDh`. Entry sets SS from DI and later DS from SS. No actual load address,
PSP, selector value or host result is asserted. `windows.json` preserves which
exact file bytes each selected decode uses, with raw hex and SHA-256.

## Concrete startup and routing evidence

These are bounded candidate paths, assuming called services/helpers return.
Environmental tests and untraced helpers prevent execution or exhaustive-call
claims. Only selected entry points and direct transfers justify the code below;
neighboring banners/data are not traversed by linear disassembly.

| Entry-segment path | What the original bytes establish |
|---|---|
| `2382 → 23FC` | Relocated stack/data setup; INT21/AH4A at 23B0, AH30 at 23CA; AX4400 handle probes at 23D5; CALL 2460 then CALL 2D9C. These are extender **real-mode startup** services, distinct from WRMS's protected AH30. |
| `2460 → 25EA` | Parses PSP/environment/arguments; saves the caller's return offset in DS:0D10 and jumps through it at 25EA. The unusual POP/JMP return does not turn the following data into code. |
| `2D9C → 2EAA → 3ED8`, then `2EC2 → 627F` | Main chooses environment-dependent initialization, then restores SP, records SMSW at 6283, and tests state byte DS:002E. Earlier helper effects and branches are not assumed successful. |
| `627F`, state nonzero | Calls 199A (descriptor base preparation), conditional 641D/64B7, then **016C**, which fills 256 eight-byte interrupt gates at DS:00C0, selector 0070 and attributes 8E00h. It overrides specific entries: **INT21**'s offset at DS:01C8 becomes **05EBh**, with default selector 0070. INT31's offset at DS:0248 becomes **44D6h**. INT20 at DS:01C0 becomes 0018:0C80. This is extender-owned gate construction, not a request for an external host to supply its default handlers. |
| `627F → 62C6 → 1280` | Copies 4Eh words from real-mode address 0000:0020 (vectors 08h–2Eh inclusive) into the supplied SS-relative buffer. This snapshots existing real-mode vectors; copying alone does not install new vectors. |
| `62E2`, state zero → `7290` | Conditional external-host lane. Saves a selected existing real-mode vector with INT21/AH35 at 72D3 and installs CS:7273 using AH25 at 72E4. The vector number comes from DS:0034, not a hardcoded claim about INT21/33. Calls **6E20** at 72EE. |
| `3ED8` environment selection → `41FA → 6D9C` | AX1687h/INT2F; on successful AX=0 stores SI at CS:6D64 and returned ES:DI into the **far CALL operands at CS:6E86/6E88**. Its returned processor/version state participates in selection. This is evidence of a DPMI-host probe, not a mandatory host requirement. |
| `6E20 → 6E85` | DOS AH48 allocations, then AX=1 and **far CALL through those patched operands**; carry set takes failure path. The original static operand 01BD:6DC2 is overwritten on successful probe. Decoding that original operand as the selected runtime callee would be wrong. |
| `6F28 → 6F2D` | AX0204/BL21 INT31 saves the host's prior protected INT21 selector:offset at CS:6D66/6D6A, with selector also saved through SS:0C42. It does not prove how that host implements DOS. |
| `6F9F` and `707D → 70BF` | Uses AX0205 INT31 to install extender-selected protected vectors. The loop from BL10h through 2Eh omits 16h,1Bh,1Ch,23h,24h (2Fh comparison is present but beyond the final bound). **70BA overrides INT21 with offset 0C9Eh in current CX**, which was loaded from DS at 707D. DS was changed at 7046 after a descriptor built using DS:0A10 and helper 1F24. Thus this handler is **not** at entry segment 01BD:0C9E. INT33 is outside this bounded installation loop; its ownership is unresolved. |
| `6F61 → 7364` | Publishes a wrapper pointer to CS:7364. That wrapper constructs a 32h-byte real-mode register frame, chooses a vector target, clears BX/CX and calls **INT31/AX0302** at 73DA, then copies results back. This is an explicit call to an external real-mode procedure service, not proof of a WRMS caller or automatic translation of every protected interrupt. |

The DPMI function names above follow the published DPMI specification:
[INT2F/1687](https://www.delorie.com/djgpp/doc/dpmi/api/2f1687.html),
[INT31/0204](https://www.delorie.com/djgpp/doc/dpmi/api/310204.html),
[INT31/0302](https://www.delorie.com/djgpp/doc/dpmi/api/310302.html).
Those definitions explain the service ABI; only the recovered bytes establish
that this member uses these instructions. No host implementation is inferred.

Separately, routine **02FCh** contains LGDT, LIDT, LMSW and far JMP 0018:0334.
This is internal protected-mode transition machinery. Its indirect caller choice
at DS:09BA remains conditional; it is not assigned to every environment.
Routine **6250h** explicitly rewrites CS:031F from prefix 3Eh to **66h** for
processor state >=3, changing the LGDT operand size. The saved window is the
**original 16-bit file decode**, not the later modified instruction stream.
The switch's descriptor bases and its destination's runtime mode need that
mutation/loader context before following further.

## Exact next context boundary

The nonzero-state IDT setup gives **INT21 = 0070:05EB** (not 0084h; DS:01B8 is
INT1F's entry). Its selector-0070 offsets advance by four initially; a routine
at **2081h**, called from gate setup, itself far-jumps **0070:5593**. These
addresses do not map by `200h + 1BD0h + offset`.
The DPMI lane likewise sets INT21 to replacement descriptor **CX:0C9E**, after
changing DS at 7046. Both point into a separately mapped context whose file
mapping is not established here. Reading entry-segment bytes at 0C9E would
even begin with an unrelated inline byte, a concrete warning against guessing.

The next static work is to validate the BW loader's header/segment/relocation
mapping through **304Fh**, **31B3h** and the file-opening/reading helpers, and
connect **DS:0A10**, helper **1F24h**, descriptor selector 0070 and the replacement
DPMI CX to exact payload bytes. Then trace handlers **0070:05EB**, **0070:44D6**,
**CX:0C9E**, plus the INT33 route. Packing of appended bytes is unresolved;
there is no reason to assume a decompressed address map from the MZ entry alone.
A runtime continuation would additionally need selected state DS:002E, GDT/IDT
bases/descriptors, returned DPMI ES:DI, patched call operands, service results,
and WRMS's actual CS/DS/SS/frame selectors. None was observed here.

Therefore WRMS's recovered protected callframes remain **separate evidence**.
Its AH30/FF00/INT31-0006 logic cannot yet be assigned a returned version or
selector base. Its frame-dispatched INT33 cannot yet be assigned to the 7364
real-mode wrapper, a host default gate or an extender-owned handler. No reachable
MSCDEX AX15xx caller/request frame has been added. Neither a protected-buffer
refusal in current host source nor the existence of INT31 instructions establishes
an incompatibility; original routing and buffer translation must be traced first.

## Validation and custody

`check.py` passed **70 checks with RAM present**: exact member identity/parser
reproduction, 16 bounded window byte hashes and independently reconstructed
objdump columns, entry relocation operands, MZ/BW bounds, HTTP receipt mutants,
Mode 1 extraction/header mutants, malformed MZ magic/header/entry/relocation
bounds, changed original BW bytes, and original entry/probe/call opcode mutants
rejected by full identity. The **42 offline checks** revalidate retained windows/receipts;
they do not claim to refetch or rehash removed media.

Selected SHA-256 values (complete list in `windows.json`):

| Window | Bytes | SHA-256 |
|---|---:|---|
| entry 2382h | 123 | `c8f2661cac7c2bbbf8113d937dd0b58fbd91de6feb9d3a25e594aa34ea8893ff` |
| DPMI probe 6D9Ch | 38 | `ce1a25908c830dbeeaf50020ed02498bac51a1b691e18afb24c8068fb704015b` |
| real-mode wrapper 7364h | 181 | `3bab3ad94bd19828861a6ace012f8161df997f9d7495858f597e0e8cf2eaadf7` |
| original switch 02FCh | 59 | `843d951e471b4c574c6498a553ac6a1295d92b3ac254701201f57098f5dc7d5d` |

Exact Git SHA, relevant uncommitted DOS/media source diffs and new-file patches,
owned document/helper patches, version, checks and SHA-256 seals are retained
in the run. Production files were read only. Publication is docs-only whitespace
validation and strict pull/push; no build was invoked.
No Machine, VM, DOS guest, WASM, native/browser/game run, archive or worker was
created. Box ID **none**, state **NOT_CREATED**, expiry null, stop receipt N/A.
The fetch deadline completed; the task-local messageboard watcher was stopped.
