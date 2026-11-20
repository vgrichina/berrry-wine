# Quake III hidden console and native input scene, 2026-11-20

Evidence: `scratch/runs/20261120-quake3-hidden-console-native-scene-causal-repair/`.

The closed initial-publication run recorded 1,341 native-scene samples and 55
new observation timestamps. Its main HWND stayed 65537 while native focus and
capture advanced to gameplay HWND 65543. The retained final display record
identifies 65537 as hidden and 65543 as the visible viewport. This is a repeated
selection mismatch, with a separate freshness failure on the final sample.
It is not evidence that a stale sample should become ready.

`lib/guest-rpc.js` assembles the ten scene words on the executing CPU Worker
inside `check_input`, `input_validate`, `input_consumed`, and the existing
message-wait observation. It selected `get_main_hwnd()`, a per-instance
convenience latch for the first top-level window. Native message routing uses
focus/capture separately; a program may keep its hidden console as main.
The page shadow's main HWND is not authority for the executing Worker.

An authored x86 PE reproduced this using actual RegisterClassA,
CreateWindowExA, ShowWindow, SetFocus, SetCapture and PeekMessageA calls, with
the unchanged 128b4c19 native module in a real Worker. The old producer sent
`[1,1000,65537,65538,0,65538,1,0,2,0]`. The candidate sent
`[1,1000,65538,65538,0,65538,2,0,2,0]`; the shadow main remained zero.
The first diagnostic helper unnecessarily waited for three samples and timed
out after retaining the decisive first observation. That closed Worker was
terminated and joined. A separate candidate launch initially failed module
resolution before native setup; its corrected loader resolves dependencies
against the real library directory. Both failures are retained.

The repair selects native focus only when the existing main is live but
hidden, and focus is a live, visible, unowned top-level on the same native
thread. It reads the selected window's own generation. Missing exports,
children, owned windows, another thread, or a visible main do not qualify
for this substitution. It never writes main, focus, capture or guest state.
Transport, freshness, deadlines, readiness and ticket guards are unchanged.

`test/test-guest-rpc-native-scene.js` executes the authored PE through actual
native USER handlers and the production Worker broker. It checks readiness
with the real shared native lookup/capture exports and tests wrong process,
hidden target, replaced memory, retired actor, stale observation, changed
focus and retired native HWND refusals. Separate native application variants
check that a visible main and hidden viewport do not qualify. The fixture
has no original-game or retained-run input dependency.

The narrow repair proves scene selection for this lifecycle. It does not
establish Windows parity, game consumption or gameplay. Fresh-original
outcome and publication status are recorded in the run's final result.

The literal locked build passed and reproduced module SHA-256
`128b4c19ffd10351ba94075efa9bb2ecc33f71b57f423a1132887760d6f22285`.
The actual HOME check then found 1,175,339,008 bytes free, below the required
1,500,000,000-byte floor. Runtime scope closed before any fresh original,
binding, input, capture or gameplay. No later runtime requests or replay are
permitted in this task even if space recovers. Foreign files were preserved.
