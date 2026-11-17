# Sims iKernel slot41 continuation diagnostic, 2026-11-17

Evidence: `scratch/runs/20261117-sims-slot41-native-continuation-installer-progress/result.json`.

No production repair is justified yet. The single authorized passive diagnostic
recovered the previously UNKNOWN saved and terminal callback frames. The precise
internal transfer into zero remains unresolved; no additional original was run.
Full T-db74d863, BW2 and IS11 criteria remain open and unchanged.

The original uses module SHA-256
`f3568ba6cd1c1982cf3c79eebada41823dd9c3d6a21cc6ac9e48491af4ed6c19`
and region map SHA-256
`8e15e720bcfded5902defa7e323661b824baf53ebc25de0fdcad3e8620982bf9`,
retained by the preceding VARIANT SAFEARRAY run. This diagnostic reuses those
exact artifacts. Launch Git SHA and relevant binary diff, source hashes, media
readbacks and the small passive require-hook are retained. No source archive,
media copy, genuine oleaut/stdole execution or registry seed was introduced.

IID wire `c34e8191f0b5d21180b900104b1f6cea`, slot41, resolves to native
`0x004210c4`. Independent native type metadata describes HRESULT and one
interface pointer, IID wire `68207eaa55cbd211809400104b1f9838`. Static inspection
of the pinned original iKernel (`985eb55e...fedb931`) finds the argument at
`[ebp+0xc]` and the common epilogue at `0x00421afe`: `ret 8`. This agrees with
the host's two words, `this` and interface. It is not evidence for changing
the argument count or relaxing the stack check.

The new diagnostic observes two real calls to that function. Token1018,
server `0x083f9c64`, argument `0x0054f4f4`, returns S_OK with exact ESP
`0x074ffe88`, restored callee-saved registers and original FS/SEH head.
Token1340, server `0x083f8534`, argument `0x00595d54`, fails:

| Field | Saved / expected | Before restoration |
| --- | --- | --- |
| ESP | `0x074ffe88` | `0x074ff4d0` |
| EBP | `0x074fff6c` | `0x074ff504` |
| EIP | suspended bridge `0x07504c28` | `0` |
| FS | `0x004ac60c` | same |
| FS:[0] | `0x074fffe8` | `0x074ff4f8` |
| Current thunk | `0x07504c28` | `0x07501dc8` |
| Native private IP | `0x1a1b91d8` | `0x1a2eafd0` |
| Yield reason | 23 | 0 |

The terminal stack is 2488 bytes below the expected caller, with callee state
still live. Its last native thunk is not the successful call's final thunk.
This localizes an early internal transfer/return but does **not** distinguish
an API's wrong return frame from an exception/unwind or continuation defect.
The passive observer did not retain that thunk's metadata or the final native
transfer source. No process-memory recovery or further original was attempted.
The old UNKNOWN ESP fields are superseded only for this new observed call;
the old original's missing frames remain missing.

Before the diagnostic, actual native controls passed for correct `ret 8`, real
error HRESULT, wrong `ret 4`/`ret 12`, an extra argument, changed callee-saved
register, native trap and retirement refusal. Every applicable control checked
parent restoration. The existing native yield12 suite also passed fourteen
I/O/nesting/error/cancellation/retirement/output-lifetime cases, stale-token
refusal and replacement-epoch non-restoration. No ESP/token/epoch/root/current
owner/cancel/retire/flags/SEH check was changed. No production code was changed,
so no new canonical-build or repaired-installer result is claimed.

The diagnostic's original sequence again crosses native VT12 SAFEARRAY creation
and its element operations before the slot41 failure. The client receives
`80010108`, and the personally reviewed whole 800x600 image shows the ordinary
support-file error `80004001`. Those HRESULTs do not establish a failure of
ordinals201/202. The installed overlay remains byte-identical; zero new installed
files and no usable startup are demonstrated.

There is an explicit diagnostic restriction violation: the reused launch recipe
retained the preceding run's `--trace-api-mem` options, producing bounded API
argument memory output. The new frame observer itself records registers and
SEH scalars only and preserves the native run budget and calls. A queued-cancel
attempt raced with launch; the supervisor recorded SIGTERM and the one original
still ran. This is not a preguest failure and does not authorize another run.
No physical input or forced guest call was sent. The one selected final whole
image was captured before requesting runtime shutdown.

An independent watchdog was armed before native launch. The genuine registrar
exited0. The embedding child required SIGKILL; its main-thread final provider
audit is absent, and guarded state merge was correctly refused. Child actual
waits and both EOFs precede parent shutdown. Parent, watchdog, supervisor and
outer actual waits complete; the parent exits0. This was host cancellation,
not native Quit or installer completion. No box was created (ID and expiry null,
state NOT_CREATED, stop receipt NOT_APPLICABLE). No workers or deployment.

Next work needs an authored native counterexample that identifies the terminal
transfer at thunk `0x07501dc8` before any causal repair. The current evidence
does not identify that thunk's API/continuation metadata. A further original
diagnostic would require renewed owner authorization; this worker stops with
the existing authorization consumed.
