# Pawn startup NULL: initializer trace, unresolved original result

**No causal repair established; no production edit or browser attempt.**
Run `20261109-pawn-null-initializer-repair-1723` traced the original executable
offline. The missing dependency is the original owning worker's factory,
callback and allocation history, not another CLI gameplay result.

The retained [original failure](20261109-pawn-browser-backends-gameplay-1655.md)
is slice 38: EIP=0, EAX=0, previous `0x41c100`, caller `0x410501`.
This confirms the final NULL indirect call but does **not** prove that
`0x41c0b4` took its zero-result cleanup branch.

## Intended callback and pointer lifetime

Disassembly of registered `binaries/wep32-community/Pawn/Pawn.exe`
(SHA-256 `21f78408e306d77103484bc90accfd511a141131ed1e14990380ecea19de5a58`):

| Address | Behavior |
|---|---|
| `0x4104f6` | Calls factory `0x414ffe`, then passes its result to wrapper `0x41c0b4`. |
| `0x415005` | Factory returns NULL immediately if global `0x42380c` is nonzero. |
| `0x41501e` | Calls `[surface-vtable+0x3c]` (Surface9 slot 15, GetDC), with surface from global `0x423fc0` and output at `[ebp-4]`. Nonzero HRESULT returns NULL **before allocation or initializer callback**. |
| `0x415025` | Calls constructor `0x41d1cd` after HRESULT zero. |
| `0x41d1cd` | HeapAlloc of `0xe4` zeroed bytes; stores pointer into TLS and global `0x4240c0`; installs callback `0x41d0ba` at object `+0x58`. |
| `0x41503d` | Factory stores returned HDC into object `+0xb0`. Sets callbacks `+0xa8=0x414f5b`, `+0xac=0x414fa5`, cleanup `+0x68=0x414f1c`. |
| `0x41c0c1` | Wrapper calls `[object+0x58](object)`. |
| `0x41d0ba` | Intended initializer creates/selects GDI objects; final `0x41d157` loads object `+0xb0` into EAX and returns with `ret 4`. It returns an HDC, not a Boolean copied from the last GDI call. |
| `0x41c0c4` | Nonzero callback result preserves object/global/TLS. Zero invokes optional cleanup with `(object,0)`, HeapFree, TlsSetValue(index,0), then clears global. Wrapper also uses `ret 4`. |
| `0x41c0be` | A NULL factory result skips the callback and cleanup entirely; wrapper returns zero without clearing the global itself. |
| `0x410501` | Caller ignores the wrapper result and calls `0x41c100(1)` unconditionally; this dereferences `[global+0x20]`. |

Cleanup `0x414f1c` releases a nonzero object `+0xb0` through the surface's
ReleaseDC slot, clears that field, and unlocks/clears `+0x9c` if present.
Other explicit global-clearing paths also exist; their xrefs are retained.
Neither the terminal EAX nor terminal ESI identifies the factory's earlier
return or the initializer's object.

## What the original evidence lacks

The retained CDP evaluations and stopped-worker slice contain no factory
return, GetDC HRESULT/output, object bytes, callback entry/result, or ordered
global/TLS/heap writes. The guest worker had detached before those inspections;
the prior box is already archived. Static control flow therefore cannot
choose between factory refusal/failure, callback zero result, or a later
pointer-lifetime event. Source review of HeapAlloc/HeapFree, TLS setters and
the existing nested-send Present handling supplies no original dynamic values.
Historical GetDC/synchronous-send failures do not establish this event's cause.

Needed evidence: owning-worker observations at `0x415021` (HRESULT and output
HDC), `0x41508b` (factory return), `0x41c0c1/0x41c0c4` (object, callback and
return), plus ordered allocation/free, TLS/global writes and nested-send
completion. These are a missing diagnostic dependency, not authorization for
an unchanged replay under this task's repair-first condition.

## Validation and stop

Offline audit passed 10 instruction-byte assertions and seven retained-file
SHA/size comparisons, including the original executable, relevant production
sources and core module `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
Source identity: prior Git base `f30074132e799518492fb1103234c043310ecf0a`;
this diagnosis started at `64f689fb1fe87b0e639158e81e3c126486fdd082`.
Relevant source diff is empty. Evidence contains the audit script/result,
selected disassembly, xrefs, hashes and Git patches, without source/media
snapshots. Existing CLI success is reused only as prior CLI evidence.

No callback success/failure runtime test or repair acceptance is claimed;
there is no supported candidate repair to test. No build or gameplay test was
rerun. Software legal drag/reply and owning WebGL remain unverified. No source
files were claimed; ABI, nested sends, deadlines and guards are unchanged.
No Chrome, original startup, inherited box, new box or watchdog was launched.
Task box ID/state/expiry/stop receipt: **N/A (no allocation)**. This worker
stops at the concrete missing original trace.
