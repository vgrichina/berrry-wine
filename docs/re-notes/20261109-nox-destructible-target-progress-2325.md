# Nox destructible-target attempt: terminal Conjurer navigation stall

Run `scratch/runs/20261109-nox-destructible-target-progress-2325/` stopped at
the Conjurer selection screen. The separately reviewed image returned after
native Enter (`review/step-012-conjurer-enter.png`) still shows Conjurer and
Accept, rather than Jack customization. This is the concrete navigation
blocker for this attempt. No staff was equipped, no attack occurred, and no
target hit, destruction, or alive-player gameplay result is established.
The cause is unknown; successful native transport ACKs do not prove that the
guest acted on the requested control.

The preceding handoff and its pickup/shot images were separately reviewed.
They show the labeled Force of Nature Staff of Recharge pickup, equipped
staff with charge 3, and green particles with charge 2 near an intact wooden
door. They establish no target damage. Their existing paths, sizes and hashes
are retained in `retained-route.json`; the images were not copied.

The live route reached Network → Host Game → default Conjurer. Initial menu
animation and cursor positioning followed the retained route. At Conjurer,
the fresh visible Accept point, the retained native mouse point, and native
Enter returned the same selection screen. The worker stopped conservatively
at that navigation stall. There was no gameplay movement or attack, including
no long RIGHT hold. All 13 returned images were separately model-viewed before
dependent action. `model-review-index.json` binds their exact labels, SHA-256
and identities; two reviews preceding passive menu-settling captures were
recorded locally retrospectively and are explicitly marked as such.

The terminal review was recorded locally and the owning kernel-custody
supervisor received native SIGTERM at 23:41:04.850Z. No later game protocol,
input, capture, retry, quit or deadline change followed. Original custody
completed with exit -15 and 351 owned/351 reaped tasks, no remaining or
unreaped tasks. Its parent recorded actual wait 1 with separate stdout/stderr
EOFs. The fixture had passed beforehand with Chrome/parent exit 0, zero
original launches, 145 owned/145 reaped tasks and separate EOFs. Independent
cleanup confirmed the named processes and both phases' ports absent/closed
and their profiles absent.

The locked build passed, as did three native-input tests and all 27 actual
generated-consumer controls. Before allocation, the actual task builder's
37-command route passed through the generated consumer against the offline
Node browser peer, including unique labels, returned-image identity binding
to the next review, and a LEFT/150ms independent-release receipt. This is
control-flow proof, not guest gameplay proof. One preallocation check was
invoked before the route result existed and failed locally on that missing
file; its error and the subsequent passing check are both retained. The
accepted provider, custody adapter and repository tools were unchanged.

Both immutable phase manifests were independently reread before allocation:
858 pins per phase; remote staging verified 862 inputs. Exactly one changed
fixture and one conditional original ran on the sole box. Source recovery
uses Git `e08eeb58d12edffcf5f18634a449d1c164bbf235`, the empty relevant
uncommitted-source diff, generated provenance patches, and `run-inputs.patch`.
Primary wasm SHA-256 is
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
No source-tree or media archive was created.

All 206 remote artifact entries (170 unique contents) were independently
retrieved and SHA-256/size verified, with gzip/PNG validation and zero content
errors. A separate full reread preceded the sole delegated normal unforced
stop. Box `bx_exsx27u5` is archived; stop receipt
`stop_8d40e882dc6593b9` completed at 2026-11-09T23:41:55.720Z, forced false.
Independent API reads confirmed both state and the exact returned operation
status URL. Initial API expiry was 2026-11-10T00:01:56.048Z; final expiry is
null after archival. Watchdog UUID `eaa445bc-1e50-4a79-a73a-a4364dbac936`
retained its immutable deadline 2026-11-10T00:01:47.942537Z. Its supervisor
recorded actual wait 0 and separate stdout/stderr EOFs.

Next work requires a separately assigned diagnosis of native menu acceptance,
then recovery of the staff route and a freshly identified visible target.
This single-task worker leaves no owned live box and stops after publication.
