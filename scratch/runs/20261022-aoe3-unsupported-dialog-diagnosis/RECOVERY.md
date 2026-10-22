# Offline diagnosis recovery

The committed report and focused evidence are self-contained for review. Input commit is `e8c6728be1de7763b01e6661011e43b2f1df4b26`; input donor and complete package-recovery procedure are documented in input/RECOVERY.md. Original full executable/XML are intentionally not committed.

Local reproduction, requiring only Python3, Git and objdump (no guest or build):

```sh
python3 scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/analyze.py
```

It requires `original/age3.exe` and `original/stringtable.xml` beside the script with the full hashes in REPORT.md, plus access to historical Git source commit `c26252c4a95babe583ade1d1c6e2da0c050be45c`. The script validates both full originals before analysis. Its default mode makes no remote calls.

If these ignored local originals are lost, recover them from the exact original installer/installed package using the donor recipe. While the assigned running box remains available **and only with renewed coordinator authorization**, `analyze.py fetch` performs the same bounded read-only acquisition from `/home/user/aoe3-original-oct22/installed/Age of Empires III/age3.exe` and `data/stringtable.xml`. Create its local original directory first. It uses Boat exec Python byte reads; does not start the guest, write remotely, acquire other files, or manage the box. Do not retry denied SSH, create/resume/fork a box, or access another task's directory to recover these bytes. Existing acquisition.json receipts are evidence, not an executable/blob backup.

Source excerpt files contain historical line numbers; source-pins.json records complete Git-blob identities and SHA256. The .asm files are read-only objdump output of the verified original, not patched assembly. dialog177.bin is only432 bytes. Input-manifest.json records exact copies matched to the input Git commit. controls.json records positive identity checks and negative controls; seals.json hashes the saved evidence set. allocation.json records final local usage and reserve.
