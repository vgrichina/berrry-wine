# NFS II SE original installer reference attempt (2026-10-28)

**Blocked before the original installer ran.** The native compatibility package
operation was rejected by its aggregate CPU90 guard. No ISO was downloaded on
this task's Boat, no Wine prefix was created, and no game installer or game
executable was invoked. There is no generated `INSTALL.WIN`, configuration,
save, registry, installed-file inventory, or installer UI result to qualify.

This is the bounded prerequisite for `GAMEPLAY-need-for-speed-2-se-full`, not
the historical Claude `NFS2SE-INSTALL-ICON-VERIFY` assignment. It provides no
registration, project build, browser execution, or gameplay acceptance.

## Inputs reused

The accepted recovery is documented in
[nfs2se-retail-recovery-20261028.md](nfs2se-retail-recovery-20261028.md).
Its source commit is `e56772ffe92bf3fe55a43840b4d28bd06ef9826f`, a two-file
delta over `e2f39b5e48fe9d2e5c0dfd26fe65f6afc3f640f9`. The predecessor's
canonical receipt SHA-256 is
`0d7a95816cabadccf8028de6d7dc341270f0129a978e2e21a2c0acde0909b5dc`.
The coordinator-reviewed source delta and available `source-payload.tar` were
reused without another payload census. Main `4b7cf2b2bb` changes Telegram ops
only; this branch neither integrates main nor changes the recovery candidate.

The original media remains the pinned 592379904-byte ISO, SHA-1
`07beaf879ce3f5a33c2d96fa4783bf9fad34f751`, SHA-256
`7615e456a859ab1f59c1b329afc6b6039112dc7535b77fe53a09ee828dc9c3df`.
The untouched software executable is `NFS2SEN.EXE`, 900096 bytes, SHA-256
`746ef7a56346e11aaef6a89bf0b327f8789d69ee5948ac04b548405d4c1a56b5`.
These are predecessor pins, **not newly recovered files on this Boat**.
The next unexecuted media step is the predecessor's verified-ISO,
`pycdlib==1.14.0` safe extraction recipe, followed by the original
`SETUP/ENGLISH/SETUP.EXE` with its original companions. No silent switch,
response file, installer success, or CD/path contract was guessed.

## Actual native preparation and first blocker

The assigned Boat `bx_nnnajdp9` reported Ubuntu 24.04.4 LTS, amd64, working
`sudo -n`, 58449379328 free bytes and approximately 3.16 GB MemAvailable.
Wine and Xvfb were absent. After admission, normal `dpkg --add-architecture
i386` and bounded `apt-get update` completed. Metadata net disk growth was
75296768 bytes; no game assets were transferred.

The first package simulation could not locate `wine32:i386` before enabling
i386 metadata. With metadata present, the next simulation found a multiarch
version conflict: installed amd64 `libgd3` was
`2.3.3-13+ubuntu24.04.1+deb.sury.org+1` from the existing PHP PPA, while Ubuntu's
i386 candidate was `2.3.3-9ubuntu5`. A changed simulation explicitly selecting
Ubuntu's matching `libgd3` pair succeeded with zero removals. Selecting only
32-bit Wine avoided an unnecessary amd64 Wine installation.

The exact final payload plan was obtained without downloading packages:

```sh
apt-get --print-uris --download-only --assume-yes --allow-downgrades \
  --no-install-recommends install wine wine32:i386 xvfb \
  libgd3=2.3.3-9ubuntu5 libgd3:i386=2.3.3-9ubuntu5
```

It listed 213 archives totaling **194173784 bytes**, 104 upgrades, 108 new
packages, one downgrade, zero removals, and approximately 709 MB additional
installed space. The recorded remote projection was below the task's 6 GiB
allocation and retained the 2 GiB host floor. The admitted native operation was:

```sh
sudo -n env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l \
  apt-get -y --allow-downgrades --no-install-recommends \
  -o Acquire::Retries=0 -o Acquire::http::Timeout=35 \
  -o Acquire::https::Timeout=35 install wine wine32:i386 xvfb \
  libgd3=2.3.3-9ubuntu5 libgd3:i386=2.3.3-9ubuntu5
```

This is a record of the **rejected preparation**, not a passing installation
recipe. It ran under the task-owned remote Python supervisor with distinct
stdout/stderr from process creation, a 512 MiB whole-descendant physical RSS
cap, aggregate CPU90, wall300, output2 MiB, remote disk6 GiB and floor2 GiB.
The remote supervisor is the pinned trusted supervisor with only its file-size
cap adapted to the explicitly allowed 1 GiB remote media-transfer ceiling;
local operations retain file24 MiB. DATA/AS limits were not applied to Python
or Node. The Git-only DATA limit remains 512 MiB.

| Package operation result | Recorded value |
| --- | ---: |
| Stop reason | `aggregate CPU limit` |
| Supervised child exit | `-15` |
| Boat detached command exit | `1` |
| Accounted CPU seconds | 126.655995 |
| Wall seconds | 46.489179183999966 |
| Peak sampled aggregate RSS bytes | 442646528 |
| Cleanup complete | true |

The supervisor conservatively accounts observed own and waited CPU; its
accounted total is not an exact unduplicated workload CPU measurement. Its
CPU90 rejection remains authoritative. No guard was reset and no Wine,
package repair, installer, alternate runtime, or unchanged retry followed it.

Package stdout reached Wine setup and system triggers. Read-only postfailure
`dpkg-query` lists Wine/wine32/libwine `9.0~repack-4build3`, Xvfb
`2:21.1.12-1ubuntu1.9`, and both libgd3 architectures `2.3.3-9ubuntu5` as `ii`.
`dpkg --audit` exited zero with empty stdout/stderr. This does not turn the
rejected operation into a qualified environment or authorize installer use.
No owned package-operation process identity remained live at closeout.

## Retention and unfulfilled acceptance

Canonical private receipt:
`scratch/usage-watch/nfs2se-original-installer-output-oct28/receipt.json`.
It binds the predecessor, source/configuration and tool identities, package
plans, exact guard outcome, diagnostic hashes, publication and cleanup.
The remote evidence archive SHA-256 is
`fb4a2eb34f6ab0fc6a7c6838cbdcb770104c79f11e36fba62c3d06fac9c47bdc`;
its 45 sealed evidence files were individually verified after transfer.

Private remote state is retained at
`/home/user/nfs2se-original-installer-output-oct28` on `bx_nnnajdp9`.
The archive contains preparation scripts, package identities, plans and
diagnostics, not commercial media or installed game files. There is no
generated-file hash or actual installed software-game identity in this task.
Installer stdout/stderr/exit, UI status, before/after game registry/file
inventories, defaults, CD/path dependencies and a successful reproducible
reference installation recipe all remain **unfulfilled**.

The box is handed back running (API state `idle`, health `ok`), with native
package state preserved. No installer/display processes were started; owned
package descendants were cleaned. The coordinator owns snapshot-stop at
12:50 UTC, expiry 13:00:20 UTC, with handback before 12:45 UTC. The worker
does not stop, delete or resume it, and selects no replacement task.
