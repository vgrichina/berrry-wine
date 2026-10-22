#!/usr/bin/env bash
# Run only on a newly coordinator-assigned recovery host, never this coordinator.
set -euo pipefail
if [[ ${1:-} != --coordinator-assigned-remote || $# != 2 ]]; then
  echo 'Usage: recover-source.sh --coordinator-assigned-remote NEW_OUTPUT_DIRECTORY' >&2
  exit 2
fi
receipt_dir=$(cd -- "$(dirname -- "$0")" && pwd)
for tool in curl timeout python3 7z sha1sum sha256sum stat; do
  command -v "$tool" >/dev/null
done
[[ ! -e $2 ]]
python3 - "$2" <<'PY'
import os, pathlib, sys
p = pathlib.Path(sys.argv[1]).absolute().parent
v = os.statvfs(p)
# Two GiB projected additional allocation plus the mandatory free reserve.
assert v.f_bavail*v.f_frsize >= 2147483648 + 2982150144, 'Insufficient free disk'
PY
mkdir -- "$2"
cd -- "$2"
timeout --signal=TERM --kill-after=10s 20m curl --fail --location \
  --connect-timeout 20 --max-time 1180 --retry 0 \
  --output GS1199.iso.part \
  'https://archive.org/download/gsscda1999/1999-11/GS1199.iso'
[[ $(stat -c %s GS1199.iso.part) == 674328576 ]]
printf '%s\n' 'f985ca1349af958f886957aa662e87956a7db22d  GS1199.iso.part' | sha1sum -c -
mv -- GS1199.iso.part GS1199.iso
sha256sum GS1199.iso > iso-recovered.sha256
7z l -slt GS1199.iso > iso-listing.txt
timeout --signal=TERM --kill-after=10s 5m 7z x -y -osource GS1199.iso \
  'Demos/Shadowman/*' 'Diverses/Directx6/*' > extraction.log
python3 "$receipt_dir/verify.py" source/Demos/Shadowman > extracted-members.json
[[ $(stat -c %s source/Diverses/Directx6/Dx61ger.exe) == 7014176 ]]
sha256sum source/Diverses/Directx6/Dx61ger.exe > directx-recovered.sha256
echo 'SOURCE-RECOVERED: installation/runtime not performed'
