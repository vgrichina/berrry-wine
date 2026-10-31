Current 2026-10-31T17:36:24.811261+00:00 — coordinator 01a19022-1426-76b3-ae98-6265fb15fd66.

Evolva’s browser-worker DLL registry fix is published on main (9eff3d372), with a failing-before/passing-after regression and full build. Original DLL registration progresses; the game canvas remains white. Its worker is tracing rendered pixels through readback and presentation.

Slave Zero’s reviewed current trace (e66f51be5) reaches NEW GAME difficulty, then retires during inferred null mip-surface traversal. A fresh worker will capture the exact surface descriptor and HRESULT before attempting a generic repair. Audio event waits completed before close; no valid-use audio defect was proved. The orphan-handle patch remains held.

Neither new title has qualified gameplay. UT2003 has reviewed normal-menu movement, look and firing on software and WebGL. Full27 coverage and crash sweep remain open.

Two workers; serialized browser/heavy CLI; disk above2GB. No public deployment.
