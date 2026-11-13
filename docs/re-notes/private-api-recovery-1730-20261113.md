# Private recovery API refusal; no capacity recovered

The documented file-write API refused the existing credential with HTTP **401
unauthorized**. No encoded log was uploaded, changed, recompressed or removed.
No material recovery or NFS UI actor/Pause/driving acceptance is claimed.
Evidence is in `scratch/runs/20261113-private-api-recovery-1730/`.

The installed production `boat` CLI supports `exec` over the API. Its
`exec true` probe succeeded on a new empty box. Official CLI documentation
states that `push` uses SSH, so it was not invoked. The published
`https://docs.boat.dev/openapi/boat-v1.yaml` documents
`PUT /api/v1/sandboxes/{sandboxId}/files`; that distinct operation was tried
once on a second new empty box, using the existing `ASCII_TOKEN` unchanged.
The response request ID is `req_6b29408bf5fa470eba019529ebe1c39e`.
The exact response is retained in `file-api/file-probe.json`.
After that denial, no alternate credentials, endpoint retries, exec-based
transfer, SSH/scp, old-box resume or cleanup was attempted.

The two capability probes each had an independent process acknowledged alive
before creation, with an absolute deadline copied into its argv, a read-only
script and a finite service TTL. The first probe used 900 seconds of TTL;
the second used 1,200 seconds. Both boxes were stopped normally immediately
after their probe. Each stop completed with `forced:false`, `error:null`;
each watchdog has an actual successful parent wait and closed output files.
No agent or worker was launched.

| Box | Final state | Normal stop receipt | Completed snapshot | Default 14-day expiry, derived from observed stoppedAt |
| --- | --- | --- | --- | --- |
| `bx_djd65nvv` | stopped | `stop_806c189578a53e2a` | `c8968a88-421f-4aa5-9e17-89484a34800d` | 2026-11-27T03:55:44.435Z |
| `bx_tdhujnvj` | stopped | `stop_4c317f162d05d72e` | `66246a29-3a4b-43c2-a33b-7c0f7a258186` | 2026-11-27T03:57:00.661Z |

Creation requested private visibility and no stored environment secrets;
the returned personal boxes have `org:null`, `visibility:null`. Neither box
contains an uploaded log or unique task evidence. Snapshot metadata was read;
actual snapshot content readback was not attempted. These snapshots are
temporary empty probe artifacts, not qualified recovery copies. Neither box
was deleted, resumed, shared or publicly deployed.

A metadata-only inventory found 57,239 local regular encoded log-named files,
totalling 1,157,441,767 apparent bytes. This is an inventory, **not an eligible
pool**: canonical identity, root/transitive dependency exclusions, foreign
claims and privileged FD/maps/cmdline closure were not qualified. Consequently
no candidate payload paths were claimed for mutation. Inventory did not decode
or interpret payloads. Existing recovery helpers, metadata and archives remain
untouched. There was no local unlink, RAM restore, READY_TO_REMOVE notice or
owner-retention acknowledgement to qualify.

The observed `/home` free space before probes was 1,488,711,680 bytes, below
the required strictly greater than 1,500,000,000. No capacity was reclaimed;
the original runtime phase was not started and no unchanged-floor launch was
retried. The coordinator received the concrete refusal on the append-only
message board. Next work requires a legitimately authorized recovery transport
or a separately authorized material capacity change; this worker stops here.

Only this note is committed. Source provenance is Git
`59c572055b104b785b284e3c65ac3ca2330cbc79`, plus the owned note and run-script
patches retained with the evidence. No source/media tree archive was created.
Checks cover script syntax, precreation guard ordering, exact API refusal,
normal stop completion, snapshot metadata, watchdog waits and evidence hashes.
No production code changed, so no production build was needed.
