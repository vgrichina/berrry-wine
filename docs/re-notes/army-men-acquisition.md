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
No remote actions have been performed for this source checkpoint.
