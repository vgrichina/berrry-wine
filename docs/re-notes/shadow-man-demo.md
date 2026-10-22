# Shadow Man original demo — InstallShield bootstrap

Offline investigation2026-10-22, lane NEW-GAME-SHADOW-MAN-DEMO-20261013. Full sealed analysis, original identities, bounded recovery and next capture contract: [Error112 report](../../scratch/runs/20261022-shadow-man-error112-cause/REPORT.md).

Original GS1199.iso Setup.exe SHA2565656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52; original VAs below, base0x400000. Reproduce with report's analyze.py/objdump, no runtime needed.

- Authentic separate `_Setup.dll` resource **0x1b98 contains literal Error112**, matching preserved dialog. It is not an observed Win32 GetLastError code. Error101/resource0x1b97 is the distinct temporary disk-location/free-space message.
- `_INST32I.EX_`: magicd879ab2a/version100, header82 B, four20-byte records with two WORD-length-prefixed names. First `INSTALL.EXE → _INS5576._MP`: compressed offset10b/length3cd7c, expanded88000 (557056 B). Separate resource DLL is not this member. Exact whole-member hashes and remaining table in analysis.json.
- `40507a →404080` opens/validates archive; failures show0x1b98 at4051a8. `4064e6 →404278` member extraction failure shows it at40657c. Actual captured caller unknown (`--quiet-api`).
- Decoder407210 uses reader4046da/writer404750. WriteFile404773, actual-count4107e8 vs requested compare404789; mismatch sets4107f4=-4 at40478e; extraction returns4107f4 at4043b3. GetLastError404779 is saved separately4107ec; stale error alone does not trigger count check. Decoder return not directly tested by404278.
- Reader404544 refills via absolute SetFilePointer404566 and ReadFile40457d (request1830 B). Progress4065b5/message pump40626f can yield cancellation; reader sets4107f4=-11 at40473e. Capture these alongside count failures, not imports alone.
- Preserved historical c26252c4/modulef644bbb2 single launch left69632 B partial `_INS5576._MP`, never licence/child/gameplay. No saved API invocation proves the mismatch. Do not infer host disk shortage or17 write calls from size.
- Historicalc26252c4 and accepted main324cc4f have identical relevant filesystem.js and09a0 WAT blobs. Host-only fixture crosses69632 B to557056 B and rejects invalid handles; no simple VFS ceiling reproduced. It does not validate guest translation/decoder or establish actual failing primitive. No fix warranted from available trace.

Next work requires coordinator-assigned one-run capture, quota gating and exact PCs/API inputs/outputs listed in report; no run performed/authorized by this note. acceptedInGuest=false.
