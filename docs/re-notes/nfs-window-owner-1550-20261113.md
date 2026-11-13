# NFS CLI input owner: guest thread ownership contract

The CLI guarded snapshot incorrectly treated slot 0's thread-local
`get_main_hwnd()` as the process window. NFS1535's original log records guest
thread 1 spawning before `CreateWindow hwnd=0x18001`, followed by ShowWindow
and no logged DestroyWindow. ThreadManager assigns that guest thread the
0x18000 HWND range. Its actual creator/visible renderer window is therefore
consistent with the main instance reporting zero throughout the prior run;
zero alone is not evidence of a lost window. Guest main HWNDs and their
callback stacks must remain local to their threads.

`lib/cli-input-owner.js` now supplies the production run.js guard snapshot.
It retains the local main HWND when present. If that is zero, it reads the
existing shared production presentation target, then requires its shared
window-table thread ID to identify one registered, active cooperative guest
instance whose own main HWND exactly matches. Slot 0 and the UI owner both
need live EIPs and no quit flag. The snapshot binds the actor registration,
instance, exports and thread ID in addition to every previous renderer,
window, memory, device, buffer and input-handler reference. An absent,
exited, ambiguous or mismatched actor fails closed. The strict protocol in
`lib/cli-guarded-input.js` is unchanged, including nonce, deadline, delivery
rechecks, independent release and terminal UNKNOWN behavior. No guest globals,
registry, clock, input queue, presentation or renderer selection are patched.
No window handle, title or geometry is hardcoded in production.

Evidence: `scratch/runs/20261113-nfs-window-owner-1550/`.
The narrow regression instantiates two real WASM instances over shared memory,
uses the production window table/adoption/destruction lifecycle, and reproduces
slot 0 HWND zero with the second instance owning a visible main window. The
unchanged extracted snapshot failed `guard.bind()` with the original error
(`regression-red.log`). The repaired snapshot passes binding and guarded
consumption, window destruction/recreation, actor and renderer-window
replacement, duplicate actor registration, quit/EIP refusal and ordinary slot 0
ownership (`regression-green.log`). This is a focused contract regression;
it does not establish a fresh original NFS bind or gameplay consequence.

`flock /tmp/wine-build.lock bash tools/build.sh` passed, as did the three changed
JavaScript syntax checks and own-path diff whitespace check. No broad historical
suite was rerun. Existing WASM production source and the WebGL8321c5172 renderer
changes remain unchanged. Git SHA, relevant binary diff, new-file patches,
module/media hashes and prior log reference are retained without source/media
archives.

After LMarbles1550 resource completion and runtime release, the prepared
original launch acquired the heavy lock, found no actual heavy children and
verified all 448 frozen path hashes, including the unchanged native chooser
registry export/media dependencies. Its fresh disk decision was
1,494,978,560 available bytes, below the strict 1,500,000,000 floor. It refused
before creating the native process or watchdog; there was no native runtime,
input, bind attempt or replay in this task. The original application's current
creator lifetime and live guarded binding remain unverified. Native two-frame
Pause/Continue, worldtimer and reviewed >=1500 ms held driving are UNPROVED.
This is software CLI work, with no WebGL application or 27-app acceptance claim.

Next: sustained disk headroom, unchanged setup/chooser export import, frozen
current original NFS launch with independently prearmed deadline/disk watchdog,
and inspect both slot 0 and the registered UI instance before guarded bind.
Only a safely bound, manually reviewed native frame authorizes the next input.

Box ID NONE; state NOT_CREATED; expiry null; stop receipt N/A. No workers,
remote boxes or private provision were created. No existing runtime was stopped.
