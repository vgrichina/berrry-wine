# MadBomber restart acceptance: launch blocked

No guest started. Game Over, ordinary restart, score/lives reset, resumed catching,
and ordinary Quit remain **unqualified**. There are no captures or gameplay claims.

All 378 pinned runtime targets (18,611,136 bytes) passed independent remote size
and SHA-256 verification. The source is historical `72e7a30d`; the retained module
is historical `728e1de8`, accepted build source `30a2c3fb`. This is not a current-main
qualification. Existing initial gameplay/scoring receipts were reused, not rerun.

The exact Node24.22.1 executable, `--max-old-space-size=512`, clean environment,
150s CPU/wall supervisor, 2GiB physical process-tree cap, and 4MiB per-file ceiling
passed startup. DATA and address-space limits were unlimited. The old-space flag
is not a total RSS cap. The canonical pinned CLI parser found no explicit mounts;
all 149 registered asset paths exist, with no comma-bearing names. That separate
parser invocation had CPU/file limits but no physical RSS supervision; it does
not establish guest execution or gameplay acceptance.

The sole `boat exec --json --detach --timeout 170` launch returned1 with empty
stdout. Its wrapper failed to retain stderr, leaving the cause unknown. No retry
was attempted. Subsequent supported read-only API exec confirmed no output
directory, guest, or controller process. The prepared controller is unexecuted.
The earlier local manifest chunk-size assertion and its bounded repair are
retained in stage.log and stage-supervision.json.

Box `bx_auvzp2av` is RUNNING by successful API execution, expiry03:37:20UTC.
The verified staged closure remains `/home/user/madbomber-restart-oct27`.
No owned runtime processes remain. Early handback is to the coordinator, who owns
snapshot-stop03:20UTC and may stop earlier. No box lifecycle action was taken.

See result.json for exact commands, limitations and remaining gates;
runtime-manifest.json for every immutable source/member/target/size/hash;
remote-configuration.json and selected/ for startup limits and transfer receipts.
No production patch, build, synthetic game state, main merge or public deployment.
