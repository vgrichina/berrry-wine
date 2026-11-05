# AoE3 demo: genuine XP DirectX 9c setup input recovered, 2026-11-05

**The missing setup input is recovered. Installation has not been executed.**
The complete Microsoft February 2010 DirectX redistributable is retained at
`scratch/game-media/aoe3-dx9c-20261105/directx_feb2010_redist.exe`:

- Size: **109,072,752 bytes**.
- SHA-256: **`f6d191e89a963d7cca34f169d30f49eab99c1ed3bb92da73ec43617caaa1e93f`**.
- Evidence and offline recovery/check scripts:
  `scratch/runs/20261105-aoe3-genuine-dx9-inputs/`.
- This is an authentic Microsoft redistributable with the XP core payload,
  including `dxnt.cab`; it is not another game's installed state.

The predecessor's [prerequisite note](aoe3-recovered-runtime-prerequisite-20261105.md)
at `c2f7658a527c22fbdee6f7cb0e44e2fb2592271a` establishes the original readme's
DX9c requirement and ConfigDetect's major-version gate. Its 208-file verification
was read and reused, not repeated. No historical diagnostic session was replayed.

## Provenance and verification

The retired Microsoft 2004 and February 2010 download URLs returned HTTP 404.
The February package was recovered from an **archived original Microsoft URL**:

```text
https://web.archive.org/web/20101224202650id_/http://download.microsoft.com/download/E/E/1/EE17FF74-6C45-4575-9CF4-7FC2597ACD18/directx_feb2010_redist.exe
```

The archive identifies the original server as Microsoft-IIS/7.5, original
Last-Modified `2010-02-05T17:17:57Z`, and capture `2010-12-24T20:26:50Z`.
The bytes match the independent SHA-256 in the upstream
[Winetricks recovery recipe](https://github.com/Winetricks/winetricks/blob/f3890f670867b5ffbc3938726db45c0f7d16c8ba/src/winetricks),
commit `f3890f670867b5ffbc3938726db45c0f7d16c8ba`. No mirror package was downloaded.
HTTP metadata and the exact helper excerpt are retained in the run directory.
The archived package is the redistributable itself, not a source-tree archive.

`7z t` passes for the complete redistributable, `dxnt.cab`, and `dxupdate.cab`.
`verify-legacy-signature.py` independently checks the PE image digest, signed
content digest, Microsoft's RSA signature, timestamp countersignature and its
content digest, all four certificate issuer signatures, and certificate dates
at the signed timestamp **2010-02-05T17:18:45Z**. The signer is Microsoft
Corporation, MOPR; the timestamp signer is Microsoft Time-Stamp Service.

There is a specific verification limit: native osslsigncode/OpenSSL 3 chain
validation fails `invalid CA certificate` with this legacy chain. Initial checks
also lacked its root. These failures are retained. The separate cryptographic
check terminates at Microsoft Root Authority SHA-256
`f38406e540d7a9d90cb4a9479299640ffb6df9e224ecc7a01c0d9558d8dad77d`, pinned by
[Microsoft's CCADB certificate report](https://ccadb.my.salesforce-sites.com/microsoft/includedcacertificatereportformsft).
After Microsoft's old root endpoints failed and crt.sh returned 502, the
certificate bytes were obtained from a public certificate snapshot and matched
that SHA-256. This root is currently disabled in the report. This establishes
historical cryptographic provenance, **not current Windows trust or revocation
policy acceptance**. No certificate was added to system or guest trust.

The current [official June 2010 download](https://www.microsoft.com/en-us/download/details.aspx?id=8109)
was also checked: 100,275,120 bytes, SHA-256
`053f76dcbb28802e23341b6a787e3b0791c0fa5c8d4d011b1044172dbf89c73b`.
Its Microsoft signature and timestamp pass with roots fetched from Microsoft,
but this currently served package lacks `dxnt.cab`. Microsoft describes it as
optional libraries and lists XP SP2/SP3 support. Its listing, provenance and
signature logs are retained; the rejected download was removed after inspection.
It is not the core-update input selected for the recovered guest.

## XP suitability and retained setup material

The older package contains `dxxp.inf`, `dxnt.inf`, `dxver.inf`, `dxdllreg.inf`,
`dxxp.cat`, the core binaries and the setup engine. `dxxp.inf` explicitly defines
`WINXP_INSTALL`, XP system/driver/cache/INF destinations, and its DX9c version
string. The read-only extracted `d3d9.dll` and `dxdiagn.dll` samples are x86,
PE OS version 5.1, file/product version **5.3.1.904**; DXSETUP is x86 with
version **4.9.0.904**. These establish XP-targeted input, not successful execution
under the current interpreter.

[Microsoft's setup guidance](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/directx-setup-for-game-developers)
distinguishes core runtime installation from optional SDK components. It identifies
`dxnt.cab` for XP/XP SP1 core updates; XP SP2 already includes DX9c. It names
DXSETUP, DSETUP, DSETUP32 and DXUPDATE as the base setup files, with component
cabinets added as needed. The complete recovered package avoids guessing an
AoE3-specific reduced cabinet set.

Six setup members were extracted with stock 7-Zip into `feb2010-selected/`:

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| `DXSETUP.exe` | 525,656 | `cdfdc371a373cd0f0daa00db46bae7e19258dd8ef7e521e57be96cbacdbb242f` |
| `DSETUP.dll` | 94,040 | `e533560fca67b31433cf30be935a88151180feafc4e0f50b80ba569f04111722` |
| `dsetup32.dll` | 1,691,480 | `ce9d7814ee5b52d554199d434d654bacc2e7ae5c8efa05e6218fbfef9e8e33c7` |
| `dxupdate.cab` | 95,820 | `54d68f154058433865708ee0dbf3ecf2d609ffbd618e84a1056440379494d9fd` |
| `dxnt.cab` | 13,264,168 | `8254beb9724139e01503ec65e7682da593cc4e81ec4bff431e5fd37ce5656034` |
| `dxdllreg_x86.cab` | 44,448 | `273eeab645ef719e69a04c8c365774b4222bc98602400ce859ddf3bef6d60ed4` |

`manifests/` holds selected unmodified INF/CIF/catalog members; `core-samples/`
holds only the two unmodified inspection DLLs. All retained paths, lengths and
hashes are in `verified-inputs.json`. These directories are inspection outputs,
not an installed Windows directory or a proven sufficient reduced installer.

## Recovery and actual installation recipe

To recheck the retained input without installing anything:

```sh
python3 scratch/runs/20261105-aoe3-genuine-dx9-inputs/verify-recovered-input.py
python3 scratch/runs/20261105-aoe3-genuine-dx9-inputs/verify-legacy-signature.py
```

If the package is lost, `download-feb2010.py` recovers the exact archived URL and
asserts its length and SHA-256. It intentionally refuses to overwrite an existing
file, and guards free disk above 5 GB throughout streaming. No source snapshot or
copy of the retained AoE3 installer is required.

For a **separately authorized installation task**, first expand the complete
verified redistributable into a fresh setup directory with stock `7z x`; keep all
its setup files and cabinets together. This full expansion was not performed
here. On the actual XP target, run that directory's ordinary `DXSETUP.exe`,
complete the genuine setup interaction and any requested restart. Microsoft also
documents `DXSETUP.exe /silent` for unattended installation; neither invocation
was executed in this task. Use the same target's resulting state for the game.

The outputs needed before the original AoE3 launch can be called ready are:

1. The actual setup result and DirectX setup/error logs, including selected OS
   branches, component results, file-in-use/pending replacements and restart
   completion where requested. Capture the log paths actually created.
2. The files installed or retained by setup, resolved through its real Windows
   directories. `dxxp.inf` names system files, system drivers, Driver Cache/i386
   and INF destinations; `dxnt.cab` additionally contains the genuine D3D9 and
   DxDiag binaries. Record resulting paths, versions and hashes rather than
   treating the two inspection DLLs as an installation.
3. The registration and registry state actually produced by setup and its
   registration helper. `dxdllreg.inf` includes DirectShow, DirectSound,
   DirectPlay, DirectInput and DxDiag registration. `dxxp.inf` references the
   RegisteredPackages helper and startup registration path. `dxver.inf` and
   `dxxp.inf` contain real version/InstalledVersion writes. Those are source
   manifest facts, **not instructions to author equivalent registry values**;
   capture the setup-produced delta and pending work instead.
4. A subsequent genuine-provider/runtime observation and the game's unmodified
   checks on that same completed target. Version checks alone do not establish
   GPU capabilities, AttemptToRun results, acceptance or gameplay.

The historical launch registry is not a post-installation artifact. Reimporting
it wholesale after setup could overwrite setup's actual state. No installation
state is supplied or invented by this recovery; the authentic setup must create
it. No borrowed game registry, fabricated capability/version/AttemptToRun value,
or guest-binary modification is part of the recipe.

## Original installer boundary and task closeout

The retained AoE3 installer was rehashed in place against its existing pin.
A minimal read-only inspection identified eight outer InstallShield records by
312-byte headers and seeks, validated through the final record boundary. They
include `Age of Empires III Trial.msi` with a 375,136,768-byte stored payload,
Windows Installer/ISScript bootstrap inputs and configuration. No standalone
DirectX setup member is exposed at that level. **The inner MSI remains undecoded;
this does not prove DirectX is absent inside it.** The header parser and offsets
are retained. No repeated opaque 7-Zip listing, full inventory or protection
bypass was attempted.

All extraction was bounded inspection of the small redistributable members:
the six-file extraction took 0.13 seconds, with 125,568 KiB peak RSS. No heavy
game/whole-package extraction or runtime ownership was taken while the
Shadow1800 → Conan1840 → Aranna1850 release gate remained pending. No build,
installer, guest, browser, box operation, shared-source edit or subworker ran.
No platform rejection occurred. Disk stayed above 5 GB during downloads.

The input-recovery objective is met; **completed installation evidence remains
outstanding** and belongs to the next installation task. The predecessor's
unexecuted game launch remains unready for that reason. Evidence preserves exact
Git SHA, relevant binary diff and this owned new-file patch, with no source
archive or repeated game media. All owned commands have exited; no server,
watcher, profile, port or runtime lock was created. Box ID/state/expiry **N/A**;
coordinator lifecycle ownership and laptop Heroes II remain untouched.
