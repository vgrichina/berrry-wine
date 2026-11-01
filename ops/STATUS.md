Current 2026-11-01T16:07:38.718754+00:00 — Urban Chaos reproduced a generic WaitForMultipleObjects defect through the production WAT API: an infinite wait-any fails before consuming an already-signaled auto-reset event when another valid named event is present. Original startup still has no Setup or gameplay; six owned processes independently absent, note4d9446b48 published.

Fresh worker 01a197dd-7049-7a51-87a3-1f151d3299b5 owns bounded ready-event repair, real API regression tests, locked build and original retest. It waits for Battlezone black-dialog worker to release source/build/runtime. Battlezone runtime deadline16:22:55UTC; two production workers maximum, overall18:00UTC. Existing callback/concurrency/SEH holds remain.

D3D9 COM→queue→native WAT→Present pixel test passed18.422s with273 recorded inputs unchanged, published32c49ed87. Full27/GPU/FPS/audio coverage remains open. No public deployment.
