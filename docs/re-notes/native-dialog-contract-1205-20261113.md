# Native Open/Save result buffer contract, 2026-11-13

Evidence: `scratch/runs/20261113-native-dialog-contract-1205/`.
Prior work reviewed: published `81a430d5004437f9e9ff52a4d55a51434f22d804`,
its `finding.json` / `publication.json`, source diff, and
`native-dialog-input-1115-20261113.md`. Its initial-filename repair is retained.

The unmodified production dialog reproduced a distinct result conversion
bug. Native EDIT text is process-ANSI bytes, but acceptance used its byte
length for W capacity, required-size reporting, offsets, and a second NUL
write. Under ACP 950, `C:\細.pgn` requires nine WCHAR slots including NUL;
the old public Open W path reported ten. A nine-slot Save W buffer was
rejected despite fitting. With spare capacity the old path also wrote an
extra NUL beyond the converted result. Parsing individual bytes mistook
`么`'s Big5 trail byte (0x5C) for a path separator, including for ANSI calls.
These are general common-dialog defects, without a Pawn-specific workaround.

Acceptance now assembles the private ANSI path, walks decoded characters,
and computes A byte / W WCHAR capacity and offsets before touching caller
memory. A short buffer receives only the documented required-size WORD and
FNERR_BUFFERTOOSMALL. Success copies exactly the complete result and one
terminator. The existing modal error bridge and Cancel paths are unchanged.
The temporary path is freed on both failure and success.

The existing buffer test now calls all four public handlers, using two real
WAT instances sharing memory and native EDIT messages. Both Big5 filenames
cover short, exact, and spare capacity; output canaries; required-size units;
leaf/extension offsets; cancellation after editing; and error reset on retry.
Unterminated initial inputs with nMaxFile 0, 1, and 4 initialize no edit text
and Cancel preserves the entire caller buffer. The original proposed-name
and ASCII regressions remain. Zero-capacity acceptance and invalid pointers
are outside the repaired conversion defect; no new Windows error code is
invented for these malformed inputs.

Microsoft's OPENFILENAME contract specifies WCHAR units for W capacity and
offsets, byte offsets for A, and a required-size WORD on buffer overflow:
https://learn.microsoft.com/en-us/windows/win32/api/commdlg/ns-commdlg-openfilenamew

Validation: the original buffer and extended-error tests passed before edits.
The new test first failed against unchanged production on required size
(10 instead of 9). Supplemental negative controls compile the released
production dialog fragment through the canonical closure without modifying
the checkout. They isolate exact-capacity rejection, the extra terminator,
and the DBCS trail-byte offset failure. The modified regression passes.
Focused checks: extended error, dialog filter, common-dialog Worker modal,
modal key posting, Worker key routing, and Big5 conversion. The required
locked build also passes; exact commands and logs are retained in the run.

This is fixture evidence, not authentic Pawn save/history/second-turn proof.
No original game, browser, box, worker agent, or Codex worker was launched.
Disk remained below the 1.5 GB native-launch floor. Next: retain regression
coverage and, when sustained headroom permits, obtain an authentic Pawn
Save As witness before attributing its history or turn behavior to dialogs.
Box ID none; state NOT_CREATED; expiry none; stop receipt not applicable.
