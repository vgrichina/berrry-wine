Independent acceptance: ACCEPT source transaction boundary

Candidate `742baebdcde0b0261e6d29818751d9f0866707e9`. Unchanged exact-production no-advance oracle passes. Three independently instrumented real CLI/transport cases pass: consumed ACK mutation after durable cursor write; after durable journal write; and after attempted request publication with missing ACK. Competing CLI ownership and poisoned same/alternate-state restart rejection verified. Old-ordering and rollback-omission negative controls fail the unchanged next63 assertions. Unchanged producer five focused tests pass; other exact-input receipts reused.

No claim of atomicity against arbitrary external writers. Instrumentation wraps original atomic writes and calls unmodified controller.main; production ACK/scheduling extraction is byte exact with stubbed host observations/batch execution. No gameplay/guest execution or historical request12 replay. No source repair, main integration or runtime authorization.

Canonical receipt-manifest.json binds exact pins, portable indexed evidence, results, reuse, resources and lifecycle. Final publication refs and watcher cleanup are retained in external ops/publication-closeout.json.
