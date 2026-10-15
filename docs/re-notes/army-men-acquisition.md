# Army Men original demo acquisition recipe

Task `NEW-GAME-ARMY-MEN-DEMO-20261015`, 2026-10-15. Source pins and
identity caveats are in [army-men-demo.md](army-men-demo.md).

`tools/acquire-army-men-demo.js` is remote-only acquisition, never a launcher.
After the coordinator grants exclusive `bx_9ef2wdsw` ownership and the previous
owner releases it, transfer this small script with Boat file APIs and invoke:

```sh
node /home/user/acquire-army-men-demo.js /home/user/army-men-original-acquisition-20261015
```

The directory must not exist and needs 512 MiB free. One HTTPS download is
bounded to 120 seconds and 20 MiB, pinned to 18,373,265 bytes and SHA-256
`dd1faca49d6e5adc0a3db58831039274930b468caa713f1c0fb4fe074754908f`.
The outer ZIP must contain only `a.exe` (18,418,688 bytes). Existing `7z`
lists, CRC-tests and extracts archives within a shared 60-second deadline,
5,000 members and 256 MiB expanded-size cap. Supported inner archive types
are ZIP, 7z, CAB and NSIS; a plain PE or unsupported installer stops with its
listing preserved. No installer or extracted EXE is executed.

Retain the package, extracted payload and listings remotely. Recover only
compact receipt, inventories, original readme/licence and setup metadata.
Review original version/copyright and normal setup/game route before any
execution request. Acquisition does not establish authenticity, gameplay,
licence acceptance, or authorization to skip the installer. A missing or
unsupported inner archive is a terminal acquisition blocker, not permission
to execute its self-extractor.

Record remote process exit and postflight active-process state, package and
payload hash rechecks and free space. Preserve local free space above 2 GiB;
do not download binaries, build locally, use SSH/scp, or publish/register.
The initial source checkpoint was not remotely executed; the acquisition
results below supersede that checkpoint.

## Acquired and inspected, 2026-10-15

Exclusive coordinator grant followed independently reviewed Outlaws release
at 14:10:55 UTC. Remote acquisition directory:
`bx_9ef2wdsw:/home/user/army-men-original-acquisition-20261015`.
Compact receipts recovered locally to
`scratch/runs/20261015-army-men-original-acquisition/` (ignored; retain this
recipe and the remote assets separately).

The downloaded ZIP matched the published size and SHA-256 exactly. Its single
`a.exe` is 18,418,688 bytes, SHA-256
`5b0db6d109d49818ce617cd539451c73273f09a98f8089065b10107790777752`.
7z identifies an x86 Windows GUI PE wrapper with an embedded `_winzip_` ZIP.
The ZIP has 211 entries: 187 files and 24 directories, 43,721,065 file bytes.
CRC tests and complete size/path/hash inventory succeeded. The warning about
463 trailing bytes is preserved in `inner-listing.txt` and the CRC log.

Initial script stopped with `unsupported archive type PE` at 14:13:29 because
it selected the wrapper header. Inspection of the full listing revealed the
supported nested ZIP. The corrected parser selects the final archive header
and handles 7z's trailing warning-count line. `--extract-existing` revalidates
both pinned package and self-extractor without another download; it requires
the `payload` directory not to exist. Corrected extraction command
`cmd_i2lo7p6xqy93` exited 0 at 14:15:20.723. Initial command `150884` exited 1;
both receipts remain. An earlier transfer quoting failure and missing-script
launch executed no acquisition; recovery preserves its diagnostic.

Original `ReadMe.txt` identifies **Army Men(TM) Demo, July 1998**, copyright
1998 The 3DO Company. It recommends Boot Camp before missions and includes
strategies for Enemy Mines and Ghost Train. `License.txt` identifies **The
3DO Company / Software Product: Army Men Demo** and describes a YES-button
assent. `SETUP.INI` names Army Men and enables the language dialog;
`setup.lid` specifies language 0009. These match the intended original demo,
not Army Men RTS or the excluded beta lead. They establish package identity,
not independent publisher authentication or an internally verified numeric
game version. The catalogue's September date differs from the readme's July
label and is not asserted as the build date.

The extracted game is `payload/ArmymenDemo.exe`, 770,560 bytes, SHA-256
`dea8303de872789553f3190ad64e80bf3c0528a5d9d3cb18ad85e0c40664078c`,
PE32 x86, image base `0x400000`, entry RVA 458464. Its PE timestamp is
898701614; this is recorded metadata, not a trusted version/date. Installer
`payload/SETUP.EXE` is 59,904 bytes, SHA-256
`feb61b7f007c8857ca8ae3a2b9d951bae0a52218cba8896291c14ccc9a77593e`.
The normal distribution includes InstallShield setup files, CABs and assets.
Neither the readme nor acquisition proves a direct-launch installation bypass;
installed directory, registry and normal post-install launch remain to be
observed. Original setup must be reviewed through its ordinary UI under a
separate execution grant, stopping at any licence choice. No answer, silent
install, guessed arguments, registration or deployment is authorized here.

Final postflight at **14:15:59.849 UTC** verified all 187 payload hashes and
unchanged ZIP/self-extractor, no active acquisition/game/browser processes,
42,755,571,712 remote free bytes. The sole remote lane was released to the
coordinator. No original executable, browser or build was run.

## Remaining gameplay proof

After ordinary setup and any required user licence decision, observe the
normal launch and visible menu. The original controls are Numpad 8 forward,
2 backward, 4/6 turn, and Space or left mouse to fire (hold to aim, release
to fire except automatic rifle/flamethrower). Follow the readme's Boot Camp
recommendation, demonstrate controlled movement and release, then a distinct
aim/fire action with reviewed before/after images and input evidence. No
menu coordinates or mission command-line options are inferred. An installer,
licence screen or title screen is not gameplay completion.

Validation: script syntax, positive and unsafe-path/oversize/duplicate/type
parser checks, real nested-listing parse, remote CRC/size checks, full final
hash recheck, terminal receipt and idle postflight. No emulator compatibility,
FPS, audio or playability claim is made.
