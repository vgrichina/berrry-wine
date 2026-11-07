# Formula One Grand Prix / World Circuit DOS demo

Owner request: Telegram177, 2026-11-07, linked
https://x.com/exQUIZitely/status/2119024815440822593 . The post names Geoff
Crammond’s Formula One Grand Prix. The archive source is the contemporary
North American **World Circuit Demo**, not a modern remake or full retail disk.

Source: https://archive.org/details/WorldCircuit_1020 . Internet Archive metadata
labels it MicroProse, DOS, 1992, and supplies `F1GP/F1GPDEMO.EXE` as emulator entry.
The original post’s release-anniversary claim is not used as demo version evidence.

## Recovery and identity

`node tools/fetch-dos-game-corpus.js --id=world-circuit-demo`

The pinned package is `https://archive.org/download/WorldCircuit_1020/f1gp.zip`,
181661 bytes, SHA-1 `449c9daca44620be82b3b299418e5b530ba37d19`, SHA-256
`48c65c989875f8eb04ef9a61eb7ce33fdb03aefe2247eb329b52718bf6d52c61`.
Downloaded bytes match archive metadata size/SHA-1. Original executable:
`test/binaries/dos-games/world-circuit-demo/F1GP/F1GPDEMO.EXE`, 343002 bytes,
SHA-256 `5c88d286945690fc7340ce98aaab0ca51912e7b0cc1ed1f89754fa0e82721511`.
Keep `ADLIB.CAT` and `XSOUND.BIN` alongside it. Those are the package’s only
three files; there is no README or batch file. Entry comes from archive metadata,
not an invented command-line option. The complete payload is hash-pinned in
`test/toyvm-dos-corpus/titles.json` and its generated file list.

The local package and media are ignored. No redistribution permission or public
deployment is claimed. This entry belongs in the DOS corpus; it is not a Win32
PE app or a Windows DOSBox wrapper registration.

## Validation and remaining work

Fetcher recovery validates package hashes and finds the executable. Selected
ToyVM manifest generation and `--check` pass with three original files. Static
assessment initially reported untested without a static blocker. Subsequent
startup work published CPU saved-divide-fault-IP repair `90e01588d`, with76
regressions and the locked build passing. The native original now renders a
320×200 cockpit, cars, track and starting lights. Root reviewed the capture;
neutral0MPH is not driving proof. Controls, movement, sound, FPS and playability
remain unverified. [Startup evidence and remaining boundary](world-circuit-startup-20261107.md).

Evidence: `scratch/runs/20261107-world-circuit-corpus/` retains source metadata
and fixture hashes. Next: a separately assigned bounded native ToyVM startup and
ordinary driving probe, retaining the first concrete CPU/device/API blocker.


Period control references: [MicroProse DOS technical booklet](https://archive.org/details/f1gp-begleitheft)
and [German DOS manual](https://archive.org/details/f1gp-handbuch), both archived
as1993. Their standard keyboard table documents A acceleration, Z braking,
angle-bracket steering keys, and Space gear selection. These retail references
are candidates for the1992demo control investigation, not proof of this demo’s
interactivity or an instruction to patch its configuration.
