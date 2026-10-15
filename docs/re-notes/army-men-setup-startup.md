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
