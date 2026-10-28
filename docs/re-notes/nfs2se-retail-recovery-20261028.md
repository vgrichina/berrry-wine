# Original Need for Speed II SE retail recovery (2026-10-28)

The original CD is recovered and intact, but the software executable is **not
qualified for direct launch from the CD tree**. An original installer capture
is the next prerequisite. No retail app registration, installed layout,
configuration file, executable patch, or gameplay result was manufactured.

## Original media and executable identity

Source: `e2f39b5e48fe9d2e5c0dfd26fe65f6afc3f640f9`, candidate
`need-for-speed-2-se-full` in `test/candidate-corpus/manifest.json`.
The existing recipe downloads `Need%20for%20Speed%20II%20SE.iso` from the
`need-for-speed-ii-se` Archive.org item and extracts it into `cd`.
The original pinned package and extraction recipe are unchanged.

| Artifact | Bytes | Digest |
| --- | ---: | --- |
| Original ISO | 592379904 | SHA-1 `07beaf879ce3f5a33c2d96fa4783bf9fad34f751` |
| Original ISO | 592379904 | SHA-256 `7615e456a859ab1f59c1b329afc6b6039112dc7535b77fe53a09ee828dc9c3df` |
| `cd/NFS2SEN.EXE` | 900096 | SHA-256 `746ef7a56346e11aaef6a89bf0b327f8789d69ee5948ac04b548405d4c1a56b5` |
| `cd/INSTALL.NFS` | 774 | SHA-256 `f09624b49af85547be924abb6fa3a7af310243db6b900cdcdffc74825ff031ea` |

The ISO was hashed before extraction. Python 3.12.3 with task-local
`pycdlib==1.14.0` extracted the ISO-9660 namespace: **1543 files,
590082515 bytes**. A complete preflight rejected traversal, links, and
case-folded collisions and checked the total against the remote allocation
before writing. Each extracted file has an original-media path, byte count,
and SHA-256 in the private remote inventory. This preserves original uppercase
CD names; Windows mixed-case references must later be mapped explicitly.

`NFS2SEA.EXE` is the separate Glide variant. This investigation concerns the
original `NFS2SEN.EXE` software variant, not the demo, original non-SE release,
or a patched community executable. Earlier demo gameplay does not qualify it.

## Concrete installation prerequisite

The complete recovered tree contains **no `INSTALL.WIN` at any case or path**.
It contains `INSTALL.NFS`, an original language/local/path template, and the
original English InstallShield setup at `SETUP/ENGLISH/SETUP.EXE`, with
`SETUP.INS`, `SETUP.PKG`, `_INST32I.EX_`, and `_SETUP.LIB` beside it.
`SETUP.INI` identifies “Need For Speed II SE”. The setup script names
`install.nfs`, `install.win`, `config.dat`, and both renderer executables.
These are static observations; the setup script was not executed or decompiled
into an asserted complete installation recipe.

Bounded static disassembly of the exact software executable establishes:

- At `0x4720c0`, startup calls `0x472390` before the later configuration
  loading call at `0x472159` to `0x44ff30`.
- At `0x47239b`, the check loads the `install.win` string at `0x4bd2c0`;
  the mode at `0x4bd2bc` is `r`. It calls the file-opening routine at
  `0x47f65e`, tests the returned handle, and branches on zero to
  `0x47252a`, which calls the process termination helper at `0x48b3e5`.
- The successful-open path reads the configuration's language prefix;
  `english` is at `0x4bd2cc`. The later loader at `0x44ff30` also names
  `install.win` (`0x4bafb4`) and parses its path records.
- The executable also contains an explicit message requiring installation
  before play (`0x4bd368`). Its presence is supporting evidence, not a
  screenshot or a claim that this particular message was displayed.

Tool: GNU objdump (GNU Binutils for Ubuntu) 2.42. Exact bounded commands,
disassembly, statuses, and stderr are retained privately on the Boat.

The next task must run the **original installer** in an authorized environment
and preserve its generated `INSTALL.WIN`, configuration/save defaults, any
registry writes and installed files, plus the original CD dependency. Do not
rename `INSTALL.NFS`, synthesize path records, or infer an installed layout.
Only after that capture can the software route and complete companion manifest
be registered and tested against actual installed files. Game startup, menu,
race entry, controls and ordinary exit remain separate gameplay gates.

## Evidence and retention

Canonical private receipt:
`scratch/usage-watch/nfs2se-retail-recovery-registration-oct28/receipt.json`.
It binds source/main reconciliation, media and tool identities, original file
inventory hashes, focused test results, source delta, publication and lifecycle.
Registration/route completeness acceptance is blocked by the installer
prerequisite; generic manifest regressions do not establish game startup.

Focused checks passed: the existing `test/test-debug-game-apps.js`,
`test/test-candidate-browser-manifest.js`, and `test/test-app-files-policy.js`.
The production `lib/apps.js` resolves no entry referring to this retail
fixture; the candidate retains `localOnly: true` and has no `browser` or `cli`
route. An actual read-only open of the missing original `INSTALL.WIN` rejects
with `ENOENT`; exact PE section-aware byte checks bind that absence to the
static startup check above. This is a static prerequisite control, not a
guest execution or a qualified manifest route. The first byte-check helper
used incorrect VA-to-file arithmetic and failed an assertion; its original
stderr is preserved. The corrected helper uses the actual PE section table
and passes, without changing the executable or repeating game execution.

Original ISO, original extracted files and detailed evidence remain on
`bx_2vzvzz78` under
`/home/user/nfs2se-retail-recovery-registration-oct28/` for coordinator snapshot.
The Boat is handed back running, expiry `2026-10-28T12:23:36Z`; the coordinator
owns snapshot-stop at 12:15 UTC. The fixture was absent from the root worktree
at assignment; this remote recovery does not restore it locally. The receipt
and recovery scripts survive outside `/tmp`; the commercial ISO and extracted
assets must never be committed or publicly deployed.

This task owns only the released `GAMEPLAY-need-for-speed-2-se-full` recovery
assignment. It does not reclaim or complete the historical Claude-owned
`NFS2SE-INSTALL-ICON-VERIFY` screenshot/runtime task.
