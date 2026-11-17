# Delphi 5 Enterprise 60-Day Evaluation

2026-11-16: original trial installation media recovered and inspected in response
to owner Telegram201. **Installation and IDE execution in the emulator remain
unproved.** No installer or emulator was launched for this inspection.

## Media and recovery

- [Archive item](https://archive.org/details/hdt-50-vb), titled Delphi 5.0
  Enterprise 60-Day Evaluation, attributed to Inprise, dated 2000.
- [Original ISO](https://archive.org/download/hdt-50-vb/HDT50VB.iso),
  81,330,176 bytes. Local ignored path:
  `test/binaries/candidates/delphi5-60day-eval/HDT50VB.iso`.
- SHA-1: `a06e88d770ec4d93429788392a74b8bf9b944d25`, matching Archive metadata.
- SHA-256: `bcd14e38635f4b3b4c7656f1ce884c26ba60224d7876681a7e3b7382e5c38b0e`.

Recover the ISO from that URL and verify its size and hashes before using it.
Use `7z l` to inspect the directory; `7z x -so ISO INSTALL/INSTALL.TXT` and
`INSTALL/README.TXT` recover the original installation and release notes.
Evidence: `scratch/runs/20261116-delphi5-evaluation-media-inspection/result.json`.

## Static findings and next step

The media's installation notes and release notes identify the trial edition,
and its license is specifically for trial software. The documented entry is
`INSTALL.EXE` at the CD root. The disc also contains
`INSTALL/SETUP.EXE`, an InstallShield script and cabinets. The default destination
is `C:\Program Files\Borland\Delphi5`; the instructions call for a reboot after
installation. The release notes require Internet Explorer 4 or later on
Windows 95/95B and describe possible premature trial expiry.

Installation notes do not describe a serial or authorization procedure, but
strings in `INSTALL/SETUP.INS` include serial-number and trial-password branches.
Their reachability is unknown. **Do not infer that installation is credential
free from the documentation alone.** A future bounded ordinary installation
must establish the actual prompts and requirements, preserve the trial's expiry
behavior, and report the first unsupported API or installer barrier. No supplied
registration credentials were found or tested in this inspection.

An alternative, larger archive item is the
[1999 Borland Development Tools Evaluation Kit](https://archive.org/details/hdtsbor.-r-1-c).
Its metadata lists Delphi 5 Enterprise alongside other Borland tools. Its
670,121,984-byte ISO was not downloaded or tested here.
