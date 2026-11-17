# Native common-dialog focus, continuation and consumption

The Open/Save WIP now has independent heap-owned modal continuations. Each
frame retains its return PC, stack adjustment, nonvolatile registers, native
window generation, process/thread and full invocation/root/depth. Posted guest
callbacks execute on the owning x86 CPU and return through an exact stack and
invocation check. An inner common API restores its parent rather than clearing
its still-live modal. Retired or reused HWNDs cancel their own invocation and
never dispatch into or destroy the replacement. DestroyWindow preserves live
focus established by its destruction callback before considering its fallback.
If another CPU actor is selected while the pump is parked, it yields without
looking up that actor's invocation stack or running or unwinding the owner.

File dialogs focus their filename edit after construction. Their generation
checked focus lease disables an enabled owner and restores the saved live
focus on destruction, including cancellation from the filter combo. A
previously disabled owner stays disabled. Public read-only observations cover
bounded common-dialog, list, combo and popup state, with complete identity,
text and selection checks; unsupported or incomplete state remains refused.
Renderer shadows enqueue class-12 keys for the actual owning native pump.

Guarded modal consumption uses a distinct child invocation and a private MSG.
Before effects, the guard checks the immutable intent, memory/actor binding,
exact MSG, modal/owner/focus generations, callback frame and invocation. A
reserved word in the existing shared invocation slot publishes only the
currently active native consumer; read-only broker observation also checks the
shared epoch, root and child stack token. Native completion checks the actual
actor, frame, owner generation and synchronous return before publishing its
post-effect state. The guard matches the preclaim and actual return, retaining
strict deadlines and narrowly admitting native Tab and Enter/Escape effects.
Ordinary USER API returns keep their existing delivery-context checks.
There is no host dequeue acknowledgement or post-effect context waiver.

BUTTON routing refuses a foreign CPU before capture or native control effects.
A receipt requires the actual owning CPU's synchronous dispatch to return in
the same child/root invocation, process and thread. Capture release also checks
its saved HWND generation. Historical receipt fields are insufficient without
one matching new dispatch sequence and nonzero invocation identities.

Authored x86 main and actual CPUWorker tests cover nested accept/cancel,
owner disable/restore, inner destruction, handle reuse and outer retirement.
The strict physical controller confirms native Tab and Escape, restored main
focus and native Quit. Broker tests exercise exact token/MSG/actor/memory,
window generation, frame and invocation mismatches, late native effects without
acknowledgement, plus wrong actor 99 and a valid sibling CPU 2 refusing BUTTON
before effects. Only the owning CPU produces the invocation-fenced receipt.

Regression work also corrected two authored-fixture defects. Enlarging the
nested progress resource at RVA 0x1700 overwrote its import directory at
0x1800; the resource now occupies separate space and preserves import bytes.
Normal-exit/controller fixtures assumed uncapped Sleep used wall time; CLI
Sleep intentionally uses its batch clock there. Their authored guests now wait
on actual GetTickCount elapsed time under the existing --real-ticks setting.
Original executables, runtime clocks and the strict exit-after-independent-UP
contract are unchanged.

The installed launch path verifies the pinned earlier authentic recovery
manifest, all 86 blobs, 258 overlay records and 836 registry entries. A fresh
writable overlay references the verified existing media; it does not reinstall
or change preserved input bytes. The only authorized installed invocation uses
the genuine installed VB5CCE executable and bundled AxButton project. It must
follow complete CURRENT published-Git qualification, compile before its
1800-second native/1820-second independent watchdog, and reserve 180 seconds
for Quit. Input retains personal complete-image review, fresh nonce, 5-second
game/30-second menu freshness, 500-ms confirmation, independent physical UP
before 1750 ms and complete evidence before 3000 ms. UNKNOWN is terminal.

Current evidence and exact Git/module identities are recorded in
`scratch/runs/20261117-vb5-native-modal-continuation-fence-repair/result.json`.
Authored tests do not establish installed IDE/sample success. Original outcome,
actual waits, EOF, shutdown and absence remain distinct in that result. Earlier
UNKNOWN endpoints remain closed. Git and relevant binary patches are the
source archive; no source-tree snapshots or media bundles are used.
