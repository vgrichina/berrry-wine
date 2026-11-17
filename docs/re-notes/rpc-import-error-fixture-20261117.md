# Current RPC import-error regression, November 17

`test/test-guest-rpc-import-throw.js` failed on the removed direct D3D9 capability opcode `0x30017`, after its real file-import throw assertion had passed. The unchanged broker correctly refuses that retired route. The test now requires local refusal for both old format arguments and verifies neither reaches the page handler.

The current OpenGL pre-GDI materialization opcode `0x10002` supplies the positive route: a host TypeError must surface in the caller, preserve its original stack for the main-side observer, and leave the caller slot reusable for a following successful request. The original file-import failure/recovery and ordered asynchronous control-trace assertions remain.

Evidence: `scratch/runs/20261117-coordinator-rpc-import-error-fixture/result.json`. Baseline exit1 and failure stack, candidate exact diff/source hashes and actual subprocess waits/EOFs are retained. The corrected test passes; the error-observer suite passes21/21 and caller-ESP test passes. These are exported-broker JavaScript tests over shared memory, without an actual guest Worker or native-game execution. No production files changed. A full native build was not rerun for this test-only correction.
