# Q3 explicit-box CLI contract: SSH permission refusal

Evidence: `scratch/runs/20261109-q3-explicit-box-stream-integration-2230/`.
Code commit: `dd079e9e9271eafd080bbe6358991bf34aec1004` on main, published
immediately using strict SSH pull/push.

The authenticated stream integration goal is **not established**. The sole
authorized finite-TTL allocation returned `bx_2rwgmhdz`. Its first live
provisioning phase invoked the installed Boat 1.0.96 CLI with that exact ID,
the production receiver, real binary stdin, and a 15-second connection bound.
It returned this stdout envelope before receiver readiness:

    {"code":"api_key_action_forbidden","error":"This API key cannot perform ssh.","event":"error","status":403}

The actual CLI exit was 1; stdout and stderr EOF were separately observed.
No file header or payload chunk was sent. The exact argv and bounded returned
envelope are durable in `prepared/actual-cli-contract.jsonl.gz`; the sticky
first-terminal record is retained separately. This establishes a concrete
CLI SSH authorization blocker. It does not demonstrate authenticated remote
stdin, a remote acknowledgement, or successful output framing. There was no
later remote protocol, full transfer, native fixture, original run, input,
capture, retry, quit, or guard extension. No images were returned. Arena entry,
alive play, firing, and displacement remain untested.

## Local validation and seal

The uploader now records its exact command and successful readiness, pin-ACK,
and session-seal replies. These observations preserve actual framing evidence
without changing admission, file bounds, diagnostics bounds, or retry policy.
The production provision consumer passes its real-pipe 46,853,694-byte transfer
and 13 negative controls: held writer, held readiness, refusal, CLI error
envelope, stdout wrapper, oversized stdout/stderr, malformed/wrong ACK,
nonzero final status, descriptor mutation, cancellation, and premature EOF.
All negative controls admit zero phase barriers and reap their sole child.
HTTP/TLS controls and the required locked build also pass.

Current controller, every-CONT full-prefix durability, first-unlinked EXIT,
both EXIT paths outside ESRCH, and current terminal-cleanup tests pass with
no local Chrome. An extra older startup-autoattach test fails its obsolete
expectation of `Browser.close` after terminal refusal; its actual retained
protocol stops at the refusal, as required by the current cleanup contract.
The initial invocation without that test's required destination also failed
locally; both diagnostics are retained. Neither failure is a live attempt.

Before allocation, all 946 providers were sealed. Both actual phase prelaunch
checks passed. Five independently reopened/decompressed staged manifests and
every provider SHA/size matched manifest
`b70ab4225b2a1bc8be9414ba355d3eb99343986348421b6d0a7e8f1369962d7a`.
The binary contract input was part of that seal. Git plus relevant small
patches records the source; no source/media archives were created.

## Lifecycle and evidence

The independently observed watchdog was armed before allocation, bound to UUID
`3250e4cf-49a1-4971-9324-da31139c9b3c`, with immutable deadline
2026-11-09 22:56:07.171 UTC. Initial API expiry was
2026-11-09T22:56:06.524Z (1499-second TTL). The deadline/config hash remained
unchanged. An independent SHA/size reread of 445 local evidence files,
including complete validation of 150 gzip streams, passed before shutdown.
There were zero unique remote artifacts: the CLI refused SSH before readiness
or any payload write; no retrieval protocol was attempted after that refusal.

Exactly one delegated normal stop was requested. API observation confirmed
`bx_2rwgmhdz` **archived**, receipt `stop_d9790943ef2de092`, status completed,
forced false, error null, ended 2026-11-09T22:31:57.383Z. Final archiveAfter
is null; the initial expiry above is preserved. The actual watchdog parent
wait returned status 0 with separate stdout/stderr EOFs and no forced signal.
No owned box remains live. Free disk remains above 1.5 GB.

Next work requires an SSH-authorized Boat CLI key and a newly authorized run;
this run permits no retry or second box. The stopped explicit box must not be
resumed as an implicit continuation. Single-task worker releases STOP.
