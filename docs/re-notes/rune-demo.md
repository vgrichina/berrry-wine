# Rune (Human Head, 2000) Windows demo

## 2026-10-31: media preflight stopped at disk prerequisite

**Outcome: blocked before recovery.** `/home` already had less than the requested
2,000,000,000 free bytes before this worker claimed paths: initial `df -B1 /home`
reported 1,419,689,984 bytes available; the saved preflight later reported
1,582,256,128. No archive was downloaded, copied or extracted. No other worker's
artifacts were deleted to make room. This is the first genuine prerequisite
blocker, not a finding about Rune compatibility or source availability.

Examined main was `239b5e25917a336f2ffaf6a61c836c568e31a211` (the requested base).
Evidence is retained privately in
`scratch/runs/20261031T2252Z-rune-demo-original-recovery/`:
`preflight.json`, `host-preflight.json`, `local-media-search.txt`, and
`RECOVERY.txt`. These are preflight records, not gameplay evidence.

## Identity and existing status

The requested title is the original Human Head **Rune (2000)** Windows demo.
It is unrelated to **Runenlegen**, whose registry entry points to
`binaries/wep32-community/Runenlegen/Runenlegen.exe`; its board-game notes and
input evidence do not qualify Rune.

At preflight, `lib/apps.js` exported 46 public `DESKTOP_APPS` and 184 local
candidate rows. No Human Head Rune row was present in public, local or debug
lists, or as a Rune app ID in `APPS`. No Rune/Human Head match was found in
`test/candidate-corpus/manifest.json` or `docs/gl-d3d-corpus-status.md`.
The existing reverse-engineering Markdown search found only `runenlegen.md`.
The append-only messageboard contained Runenlegen history and the coordinator's
new Rune assignment, with no competing Human Head Rune ownership or prior
qualification/hold found. Thus no existing qualified or held Rune lane was
identified in the checked records before this worker claimed this note.

## Local media search and unverified pins

Before considering a download, ran:

```sh
rg --files --hidden -g '!node_modules' -g '!.git' /home/user
```

Filtering the returned paths case-insensitively for `rune` found only the
Runenlegen note and handoff. No matching original Rune archive or installed
payload was located. This was a filename/path search, including ignored files;
it did not inspect arbitrarily named compilation archives, other mount points,
or archive members. It is not proof that every possible local medium is absent.

Recovery stopped at the disk floor. No direct-source search or download was
attempted after that blocker. Package provenance, upstream checksums, actual
package SHA-256, original executable path/SHA-256, complete payload inventory,
original documentation/license, installer format, and reproducible extraction
recipe remain **unknown/unverified**. There are no recovered media paths or
original-file pins to hand off. No redistribution authorization is inferred.

## Current host route: checked infrastructure, pending title manifest

Cheap Node checks loaded only `lib/apps.js` and `lib/app-files.js` and verified
the registry exclusions, Runenlegen identity, and availability of
`mergeLocalManifestFiles`, `normalizeLazyFiles`, `validateLocalManifestSync`
and `validateLocalManifestAsync`. Source SHA-256 values are in `preflight.json`.
No browser, guest, installer, build or game was started.

Static inspection of `lib/browser-shell.js` and `test/run.js` confirms the
ordinary `localFileManifest` route: schema version 1 with `files`, companion
URLs resolved relative to the host manifest, and explicit `vfsPath`/`size`
metadata. `lib/app-files.js` supplies merge, integrity and loading-policy
helpers. Its eager classes include original DLLs and INI/INT configuration;
other assets may stream according to the shared policy. Exact eager/lazy
results cannot be checked without Rune's real inventory.

A concrete Rune launch entry cannot honestly be supplied before the actual
executable, directory layout, shipped configuration, imports and assets are
recovered. No executable name, arguments, working directory, renderer, registry
requirements or dependencies are asserted from the title alone. The future
manifest must map the entire verified original payload, retain its relative
paths and original documentation/license, and distinguish package provenance
hashes from hashes of the actual executable and every installed member.
Do not create substitute guest files/configuration, registry/version resources,
or patched guest bytes to bypass a dependency failure.

## Next prerequisite and bounded continuation

Restore free disk above 2 GB, with enough additional headroom for the selected
small demo archive and its advertised expanded size, before any media recovery.
Then repeat local-media/ownership checks, identify a provenance-backed direct
original-demo source, and claim precise ignored archive/extraction destinations
before writing them. Avoid duplicate archives and multi-GB compilations. Pin
the package separately from the complete extracted payload, preserve original
docs/license, and record reproducible extraction commands and a title-specific
ordinary launch/dependency plan using the existing host helpers. Stop at the
first real extraction or prerequisite failure. Browser availability remains a
separate future prerequisite; it was not investigated or retried here.

Boat/runtime allocation, box ID/state/expiry: **N/A**. No remote lifecycle,
engine, registry, guest bytes, public app list or deployment was changed.
