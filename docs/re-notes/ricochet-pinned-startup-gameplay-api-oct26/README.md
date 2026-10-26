Ricochet pinned startup recovery and bounded real guest observation

Transferred only the exact723350-byte pinned API table SHA256562acd9c5870750d29cc88ed1ec12112c9da7164b8d9c3fe470a109842d39486 with source mode preserved. Canonical module f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75 verified in place and never retransferred.509 runtime files/modes verified including required IFC22.dll, executable and supplied cache. Production source/runner/argv/parser/limits unchanged. No build or full staging.

One actual production run reached guest, IFC22 DllMain,900 batches and576847 API calls. Inspected three640x480 lossless captures: Reflexive splash at200, loading at700 and900 (latter two byte-identical). Play Game/Anonymous Guest/round/paddle-ball gameplay NOT reached. No gameplay input sent to unverified UI. No trap observed; this bounded loading result does not prove a hang.

First operational failure retained:500-batch control request timed out10s after submission. Original request was never replayed; snapshots showed its credits counting down to0 at700 before200 additional batches were released and acknowledged. No overlapping step. Final900 snapshot had0credits. Quit normally at87.73s supervisor wall,35.79s sampled tree CPU,257617920-byte sampled peak tree RSS. Capture transfer/inspection and frozen coordination consumed wall time. No extra guest launch with only2.27s remaining in90s allowance.

Fresh192MiB full admission passed including retained local/remote state, own Git/session/events, positive WAL growth once,32MiB prospective growth and8MiB reserve. Historical64MiB shortfalls remain explicitly recorded. Cache counted once. Receipt and operations archive preserve exact evidence/recipes, first historical ENOENT, initial resource gate, command/environment/limits, controller request/responses and cleanup. No original game, source or module binaries published.

Box bx_ex22dvm8 remains RUNNING, owned guest children none. Watch3114879 untouched. Coordinator owns22:00UTC snapshot-stop; expiry22:31:02.949Z. No main merge/public deployment/Boat SSH. Further guest runtime requires a new coordinator assignment.
