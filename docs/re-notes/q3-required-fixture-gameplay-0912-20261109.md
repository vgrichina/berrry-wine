# Q3 required fixture and gameplay, 0912

Prelaunch now requires exactly one HTTP pin for `/test/binaries/calc.exe`,
matching the literal required PE (94208 bytes, SHA256
`cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`).
The retained caller resolves this through its actual fixture server and checks
status, SHA and size before Chrome is created. The prepared manifest stages
all 923 providers. No shared host, WAT, custody or Redline source changed.

The composed caller and fixture remain byte-identical to accepted proof.
45 startup controls and 34 dependency controls are reused by exact source and
SHA/size/gzip CRC; the predecessor's 15 prelaunch controls are retained, with
three new missing/changed/duplicate HTTP-pin refusals tested freshly. Focused
dependency, 18 prelaunch and genuine input evidence checks plus locked build
pass. Native REVOKED, allwriters and edictABA remain UNKNOWN.

Evidence: `scratch/runs/20261109-q3-required-fixture-gameplay-0912/`.
Git base plus small patches and run inputs are retained; no source/media/module
archives. Initial offline preparation selected the predecessor's pre-correction
manifest; this was corrected to its final 923-provider manifest before allocation.
The Q20900 gate requires exact UUID `58edf026-2407-456f-8a64-9e5ce76dc817`,
ARCHIVED PHYSICAL_DRAINED receipt `stop_6bb0cfe8684bf5df`.

Runtime outcome will be appended after the sole authorized run and cleanup.
