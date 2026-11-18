# UT GOTY retained DialogBox input return and normal installation progress

Repair `8e295597b` is published. Evidence is in
`scratch/runs/20261118-ut-goty-next-transition-install/`; `result.json` is the final
index. The locked build and focused tests pass. The original unchanged installer
now completes welcome Next, I Agree, and default-destination Next with actual
native callback-return receipts and independent physical UP acknowledgements.
It reaches component-page creation. Installation remains gated on expanded-space
review, which the next capture blocker prevents.

The original old-module reproduction is `trace-context`. Its exact context diff
contains six changes: focus `0x10013` → `0x10002`, focus-window HWND and generation
`19` → `2`, capture `0` → `0x10002`, Next button flags `0` → `1549`, and old focus
button flags `12` → `0`. The enclosing dialog, its creation identity, process,
thread and generations do not change. The DOWN producer returned; the native
DialogBox CACA0004 pump dequeued it and entered the real guest subclass. This
pump previously issued neither a native input validation/return receipt nor an
invocation claim. The subsequent context comparison canceled the pending DOWN.
License controls appear in the log after independent UP, so their creation is
not evidence that the DOWN callback had completed before cancellation. No old
`CANCELLED/consumed:false` result is reclassified, replayed or subsequently queried.

The repair adds entry and return boundaries to that real pump. Entry verifies the
actual actor's immutable DialogBox creation identity before effects and publishes
one retained frame with token, exact message, raw target procedure, resolved
callback, target/dialog/parent generations, process/thread, invocation/root/depth,
epoch and entry ESP. The guard claims that exact frame without consuming the
intent. While it remains the current invocation, it owns its callback's focus,
capture and page changes. All unclaimed input keeps the original full context
predicate. The callback's existing stdcall/cdecl sentinel unwind must reach the
same entry ESP and invocation before return can consume the intent. The current
dialog creation identity and post-focus lifetime are checked again. A destroyed
input target is allowed; a different generation under its numeric HWND is not.
The native frame and shared publication are restored on disposal. Nested native
modal keys preserve the enclosing publication. Deadline, renderer binding,
process/thread, original physical-release references and terminal states remain
enforced. This does not change guest paint or dispatch routing.

`authored-old` proves old failure with an ordinary authored modal wizard: Next
chains its real guest BUTTON subclass, destroys old child page controls, creates
license controls and moves focus during the callback. `native-tests-pass` runs
the same authored source on the final module, both directly and on actual
CPUWorker RPC, with and without destruction of Next itself. Entry is never
completion; actual callback return succeeds; late actual return preserves the
effect but is unconsumed. All eight cases pass, with 38 rejected malformed proofs
per case and cleared native publication after return. Unit negatives additionally
cover context changes without a claim, foreign actor/process/thread, stale token,
target reuse including retired reuse, enclosing owner retirement/reuse, parent
retirement, invocation/epoch/frame/callback/stack/message changes, foreign/reused
focus, callback replacement, inspection error, early return and canceled return.
The original physical release occurs once. Existing CLI guard, pointer mapping,
producer/broker owner, printable pair, native modal invocation and listbox
observation regressions pass. `build-actor-proof.log` is the final locked build.

Fresh `original-fixed` uses the unique retained disc
`20261118-ut-goty-original-range-media-startup/UT_GOTY_CD1.iso`, SHA256
`e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`, normal
read-only import of `D:\System\Setup.exe`, inherited D-root cwd confirmed in
the actual runtime log, and an initially empty normal writable overlay. The
whole welcome, license and destination images were personally reviewed. Welcome
Next returns at the new native boundary 73 ms after the producer's handler
application, with target generation 2, dialog generation 1, process 1000/thread 1,
invocation 30/root 2/depth 1/epoch 1 and the actual Window.dll callback. The
independent UP then advances the normal wizard. I Agree and destination Next
also return through the new boundary and receive independent UP acknowledgements.

The immediate capture after destination Next still shows the destination while
the guest continues processing UP. The next bounded capture refuses with
`control.unsupportedClass`, actual child `0x10030`, reported class 4. The log
proves creation/showing of the component page and the normal overlay contains
only its created `C:\UnrealTournament` directory. The scope closes at this refusal;
there are no subsequent endpoint requests, invented control state, capture guard
bypass or unreviewed input. Required expanded space is unknown, Install was not
pressed, and no installed game/startup is claimed. Ordinary Cancel is unavailable
after scope closure; filesystem stop has actual native, supervisor, watchdog and
enclosing-owner waits with both EOF and no containment leak. Minimum free disk
for that scope is 2,320,486,400 bytes, above the 1.5 GB floor.

Earlier baseline scopes retain native/supervisor/watchdog waits and owner
completion but lack an enclosing-owner wait; that gap is explicit in the final
index. An exploratory authored Cancel exited normally, but its local helper
mistakenly requested a post-exit capture; it is not counted as reviewed Cancel
acceptance. No browser was launched in this task. The previously observed idle
browser presentation loss and differing cwd remain separate unknowns and are
not offered as causes of native cancellation. `RECOVERY.md`, exact patches,
module delta/hash verification and the final index describe recovery without
media copies or source snapshots. No boxes were created.
