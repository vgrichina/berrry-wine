# GTA2 demo gameplay qualification — blocked before guest

The task pinned accepted production revision `1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba`. The authorized API exec preflight found the intended Node executable on assigned Boat `bx_c35ty8f8`. No Node startup check, canonical build, guest, input dispatch, screenshot or gameplay qualification occurred.

The first execution resource guard was the trusted local staging supervisor’s 120-second wall deadline. It stopped the source-transfer operation after eight complete batches (320 source files). Its physical peak was 95,752,192 bytes, aggregate CPU 55.673008 seconds, and cleanup completed. This is a staging workload/wrapper failure, not a platform access denial or a census regression. The original failed request is not replayed and no guard allowance is reset. Partial remote staging is preserved for coordinator reconciliation.

`result.json` and `request-ledger.json` bind the exact source pin, failures, command hashes, original request statuses, completed transfer pins, lifecycle and remaining acceptance gates. Distinct stdout/stderr and supervisor receipts retain setup and staging failures. Original complete API command payloads and responses remain under `/tmp/gta2-census-cleared-driving-oct27/ops/{commands,requests,responses}`; they are not copied again into Git. Remote staging is at the same owned prefix. No source implementation was changed; this task branch must never be merged wholesale.

The coordinator owns snapshot/shutdown. Worker made no lifecycle changes, handed back immediately and left the assigned Boat running. Scheduled cutoff13:08UTC, handback13:11UTC, shutdown13:14UTC, expiry13:21:00.618UTC remain unchanged.
