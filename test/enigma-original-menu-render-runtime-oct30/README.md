# Original Enigma production menu runtime, 2026-10-30

The pinned original production runner rendered a visible Enigma Main Menu.
A click on the visible Start Game button (343,213), followed by ordinary
Enter down/up, received successful production control ACKs. Captures after
both inputs were identical to the initial menu. The final real snapshot
still reports Enigma - Main Menu. Gameplay progression is not accepted.

One original runtime invocation ran for 84.416 seconds and exited 0 after
the controller requested quit. Initial frozen ping and unfreeze were ACKed
before input. All original DLL initializers returned. This is the historical
accepted host/module pairing, not a current integrated source claim.

summary.json records identities, PNG hashes, the remaining input/progression
gate, and snapshot location. runtime-evidence.json includes actual Node
startup limits and production ACKs. PNGs and compact logs remain outside Git
in the artifactDirectory and in the stopped Boat snapshot. No build, source
repair, synthetic runner, npm install, or gameplay acceptance was performed.

Recovery: use the retained archive parts listed in the task-owned archive.json;
concatenate and verify SHA256 43dcac837bfe6b2eaa1c3aa4c2a3a63ea42ffeed54f1128ef192c2cbd5e757c3.
Extract beneath /home/user/enigma-original, preserving target paths. Transfer
the retained guest-args.json and guest-render.py with native API chunks <=48KiB.
The script enforces a 116-second hard wall, CPU150/155, Node heap512, group
RSS2GiB, available-memory floor2.5GiB, log2MiB and file4MiB. Provisioning or
re-execution requires a new coordinator assignment and fresh admission.
Never resume this task's stopped Boat without authorization.
