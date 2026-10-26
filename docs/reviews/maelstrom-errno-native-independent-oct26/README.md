# Scoped native acceptance, 2026-10-26

ACCEPT for controlled compiled-native latch evidence at candidate `792025867aa3cf190f76ee5199a3bee608f4b948`, tree `71ef6dbff77d714e6b36aec86792598fc1461ab2`.

Both retained modules match the published SHA-256 and source ABI oracle: 291 imports, 2267 function exports, 269 inventory entries and layout `9a3bc9149d58209c`. No WAT compilation or module rewrite occurred. Original source, fixture and oracles are unchanged.

26 final native cases pass: errno0/4/37, prior select start, foreign CALL thread/register-bank, foreign RET thread/register-bank, postframe mismatch, unsafe caller span, code16/uop start and second owner indirect CALL, each in tailcall and compat. Foreign ownership leaves the latch unchanged; rejecting invalid cases report status5. Successful capture reports event3 at PC0x7a3366, CMP count0 and errno0/4/37. OFF/ON equality compares normalized registers, lazy flags, initialized fixture memory, imports/API calls, counters, budget and yields. The original seven negative native controls and eight ABI controls remain accepted exact-revision evidence from the candidate report.

This is fixture equivalence. The CRT base0x522000 and `_getptd` provider are explicitly synthetic. Authentic errno CALL/ADD/RET and network MOV/CALL EDI/CMP bytes are verified against original pinned files. No original game ran; no caller/gameplay or full-memory equivalence is claimed.

Post-completion stale-token/private-global mutation still has source/model coverage only: the retained binary exports getters, and the single-completion select observer cannot create a second native completion. The modules were not patched to manufacture private setters. Mode changes after arming, native park/cap exhaustion, performance and original loader behavior remain outside this acceptance.

`source-tested.json`, `coverage-results.json` and `retained-identity.json` are the consolidated coverage receipts. `remote-evidence.json.gz` is a JSON map of relative evidence names to base64 bytes; verify compressed SHA and per-file SHA using `remote-evidence-manifest.json`, then inspect the native results and mode receipts. Read in chunks <=64KiB and transfer captures <=2MiB. Final accepted26 cases use the original8MiB module-constructor guard. Preliminary9 cases are excluded; resource/capture incidents are explicit in `incidents.json`.

Recovery inputs remain at `/home/user/maelstrom-errno-api-canonical-native-oct25` on `bx_k38z8byn`. Final fixtures are staged at `/home/user/maelstrom-errno-native-independent-oct26-v2`; run the committed recipe supervisor there with one case argument and optional `--compat`, within a fresh resource receipt, one heavy owner,512MiB arena+512MiB heap,CPU90/wall60/file24MiB/capture128KiB. The immutable test fixtures refer to the original ops anchors/ABI/modules. No mount arguments are used; exact empty argv was checked with the canonical parser. Do not compile again to reproduce these fixtures. Local reviewer branch owns new test/evidence paths only.

Box stays RUNNING; coordinator owns snapshot/stop01:20UTC, expiry01:39:12UTC. Execution cutoff01:05 and handback01:10 remain authoritative. No main integration, trust changes, SSH runtime, public deployment, workers, or successors.
