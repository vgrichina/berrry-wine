# DirectX SDK Bellhop

Run `20261031T0351Z-bellhop-startup` launches the registered original
`dx_bellhop` through `test/run.js`, with the cooperative scheduler and no
source changes. It reaches an inspected **Choose A Connection** dialog:
the provider combo says **Select a lobby provider**, the session list is
empty, and both join buttons are disabled. This is a connection prerequisite,
not a demonstrated 3D-rendering or gameplay failure.

The bounded run exits normally after 100,000 batches (5.054 seconds), with
216 API calls and no observed trap. No input was sent. The log warns that
`ole32.dll` is not on disk; it does not encounter an ordinal-import trap.
Before/after hashes cover the registered inputs and local runtime files.
The loaded local module hash is recorded in the run; its compiled source
identity is unknown. No browser, server, or Boat was created.

Next investigation: inspect the provider choices and original lobby setup
before attempting a session. An idle connection dialog is not gameplay proof.

## Not a graphics sample (2026-11-18)

bellhop.exe imports only KERNEL32, USER32, GDI32, ole32 and COMCTL32: no
DirectDraw or Direct3D, so it has no GPU-stream readbacks or uploads to
measure. A headless census run that "ends early" is the CLI stuck detector
(`--stuck-after`, default 10 batches) firing on the idle Choose A Connection
dialog (TCP/IP is enumerated by IDirectPlay3_EnumConnections); no trap or
unimplemented API is involved. Run `scratch/runs/20261118-glide-stats-early-exit`.
