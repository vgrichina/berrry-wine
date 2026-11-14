# Neverhood COMMCTRL candidate rejected — 2026-11-14

The repository-recorded Windows 98 SE OEM candidate is **not the required
companion** for original Neverhood COMCTL32. Its NE module name is `COMMCTRL`,
but its complete export table lacks `Cctl1632_ThunkData16`. This closes the
authorized source route with a concrete dependency mismatch. No native
connection operation, installer rerun, UI, or connection success is claimed.

Evidence: `scratch/runs/20261114-neverhood-commctrl-connection/result.json`.

## Verified source and extraction

No existing matching local media or companion was found. The only downloaded
OS source was the already recorded
[Windows 98 Second Edition OEM X05-29232](https://archive.org/details/microsoft-windows-98-second-edition-oem-x05-29232).
The complete ISO matches both recorded properties:

- Size: 655591424 bytes.
- SHA-1: `fa040cd3f7fd472e9612b1721bc72d7b82538450`.
- Additional SHA-256: `2adfb46df8a9c7bbd2f67bff07461cc2f9d9ec8e01f0e112cb044c9e3e62f607`.
- Retained locally as `scratch/media/win98se-oem-x05-29232.iso`.

The recorded `BASE4.CAB` starting point follows additional BASE/NET/DRIVER
cabinets and PRECOPY cabinets, beyond the described WIN98_21–74 range.
Initial partial-chain extraction produced no companion; those warnings are
retained. Completing that same ISO's chain recovered the file. A bounded
single-cabinet listing of the staged cabinets identified its unique actual
member in **`WIN98/PRECOPY1.CAB`**, not BASE4 itself. A second extraction using
`cabextract -s -q -F commctrl.dll` directly on PRECOPY1 produced identical
bytes without merging cabinets. PRECOPY1 SHA-256 is
`81aa96efa1c0bdc665e46738f9c72439e46360193a6d7c5574c794aad41a25cf`.

The minimal recovery recipe from the verified ISO is:

```sh
7z e -y -oDEST scratch/media/win98se-oem-x05-29232.iso win98/PRECOPY1.CAB
cabextract -s -q -F commctrl.dll -d DEST DEST/PRECOPY1.CAB
sha256sum DEST/commctrl.dll
```

Only COMMCTRL was expanded from the cabinets. No stock OS binary is committed
or deployed. The rejected file is isolated at
`scratch/media/neverhood-commctrl-candidate/commctrl.dll`; it is absent from
`scratch/win16-system/commctrl.dll` and was never selected for execution.

## Exact mismatch

The recovered file is 48112 bytes, SHA-256
`070d5cd5fc011e5de48fda3ce093e75a85c6bd1b36187272bc75581e7cf6fc12`.
It has an MZ/NE header, module `COMMCTRL`, description
`COMMCTRL - Custom controls`, and 21 named entry points. The repository's
NE entry parser and an independent bounded resident/nonresident name-table
walk agree: the required data export is absent. A complete byte scan also
finds no `LS01`, `SL01`, or `LB01` marker. Consequently there is **no exported
thunk header or actual companion checksum to validate**; its checksum is
recorded as null, never inferred from the module name.

The pinned original 577808-byte COMCTL32 retains SHA-256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
Its unique LS01 header at file offset 430828 independently confirms checksum
`0x1e9a`, LB01, and relay offsets `0x24` / `0x44`, agreeing with the
predecessor's actual parked six-argument request.

## Scope and next boundary

Per the task's mismatch stop condition, the released predecessor primitive,
request, tests and census remain uncommitted and unchanged by this task.
Relevant incoming tracked and new-file patches plus their exact Git baseline
are recorded in the run; no source tree archive was made. No foreign WIP is
published. The reduced transaction fixture remains outside this stopped
route; its predecessor missing-import failure is not relabeled as passing.

Validation covered complete ISO identity, single-cabinet byte equality, NE
module/entry/name tables, absence of required thunk markers, and the pinned
original contract. This is a documentation-only publication; no production
code or build output changed and no emulator/full build was run here.
The last actual original boundary remains the predecessor's
`Missing NE image COMMCTRL`, before UI. A matching, provenance-backed companion
is still needed before persistent binding/lifetime and QT/FT work can proceed.

All extraction/download children have independent finite deadlines, actual
waits and both-pipe EOF receipts. No screenshot, input, browser, or box was
created. Box ID none; state NOT_CREATED; expiry null; stop receipt N/A.
