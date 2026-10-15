# Army Men original setup first startup

Source preparation for `NEW-GAME-ARMY-MEN-DEMO-20261015`. No installation or
player control is established. The complete 187-file original July 1998
payload is pinned in `army-men-setup-manifest.json`; acquisition and original
readme/licence provenance remain in `army-men-acquisition.md`.

Under the coordinator's exclusive remote grant only:

```
node tools/army-men-setup-first-launch.js ROOT PAYLOAD NEW_OUTPUT
```

The physical runtime root is the historical remote checkout, not current main.
Its complete tracked source hashes and index are saved before execution and
rechecked afterward. The 142 compiler closure pins and canonical module
`937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`
are independently required. No build is run. Source/runtime equivalence to
current main is not asserted.

The controller checks actual SETUP.EXE MZ/e_lfanew and NE or i386 PE header,
then launches it with empty arguments at `C:\ARMYMEN`, with the complete
original file tree. The acquisition recorded only MZ, so NE is not assumed.
The original setup is used, never ArmymenDemo.exe directly. Cooperative
headless `--no-threads` is explicit; no browser/default Worker claim follows.
Guest/controller bounds are 120/150 seconds; no guest inputs or licence
answers. Text-detected licence/crash requests capture and stop, otherwise
periodic full screenshots and final output are retained for inspection.

`--capture-launch` retains any real installer-generated executable handoff;
`--save-vfs` and `--reg-export` retain final state. Capture is not an automatic
replay: a child requires review of actual header, arguments, directory,
registry timing, and another grant. Original License.txt and ReadMe.txt stay
in the mounted tree and acquisition receipts for the actual UI decision.
Output contains exact argv, terminal state, original/source hash checks and
owned process-group postflight. Independent whole-host postflight is required
before releasing the lane. Any unexpected failure stops this allocation.

Source checks: Node syntax; all 187 safe unique Windows paths and hashes;
142 compiler pins; synthetic NE acceptance, bad header and missing payload
rejection. These checks execute no guest and do not establish compatibility.

## Actual bootstrap capture, 2026-10-15

After Outlaws' 14:19:27.170 release and independent 14:22:13.465 idle inventory,
Boat controller `155403` ran at 14:22:14.702–14:22:15.855, exit 0. Guest
terminal was 14:22:15.643, exit 0, no signal. Actual source HEAD was historical
`03641536b256ec78527fee514ea2dfa4c31639e4`; 6,527 physical source file hashes
and the 142 compiler/module pins were retained. This is not current-main host
validation. SETUP.EXE is **NE**, header offset 3584; its original size/hash
matched the acquisition pin.

The ordinary bootstrap emitted WinExec for
`C:\WINDOWS\TEMP\_INS576._MP`, then B0071612 and the existing ShellExecute
capture fallback. The full log also records `thread 1 window cleanup failed:
unreachable`; a zero bootstrap exit does not erase that warning or establish
installation. No child executed through the fallback. The actual capture
receipt contains empty arguments, cwd `c:\armymen`, executable path
`windows/temp/_ins576._mp`, and 246 files. Header inspection confirms i386 PE,
offset 128, 648,704 bytes, SHA-256
`48141f38085b79f09e6e34d6c835ca3fefe970141b6f8435cf70ee7046c028c0`.
No licence answer or other input was sent. No automatic retry/replay occurred.

The reviewed final 640x480 image is uniformly teal after bootstrap exit,
SHA-256 `cf54108b7650531aeaa719b810d53cd2c624323b760ba730b7897261efad2d68`.
It proves neither installer UI success nor gameplay. No transient installer
screen was captured: the whole bootstrap finished before the first periodic
sample. The full output retains its window creation and handoff events.

Independent postflight at **14:22:59.767** found no active runtime processes,
all 6,527 physical source hashes, 187 original payload files, and canonical
module unchanged. The downloaded outer ZIP/self-extractor were not rehashed
in this execution allocation; their acquisition postflight remains separate.
The coordinator received the clean lane release then. Original and generated
bytes remain remotely under `/home/user/army-men-original-setup-20261015/`;
`run/capture-seal.json` hashes every captured file, and final VFS/registry are
retained alongside the capture. Launch-time VFS is a shallow map snapshot,
while registry is end-of-run state: review timing before any child replay.

Compact evidence was recovered to
`scratch/runs/20261015-army-men-original-setup/`, including full log, final PNG,
source identity, controller, original manifest, terminal/postflight, actual
child receipt/header and full capture hash seal. `evidence.tar.gz` is 612,171
bytes, SHA-256
`758764c8dc11454ed32b7bbe7f92b115ead83ada23b9934458127dc12ec92c6d`.
The archive deliberately excludes generated binaries and complete VFS copies;
those remain in the remote run. No dashboard candidate is invented.

Next: review the captured genuine child and final registry timing, then a
separately granted bounded original installer-child replay with complete
captured tree and exact receipt argv/cwd, stopping at its first licence choice
or failure. There is still no installed game route or player-control proof.
