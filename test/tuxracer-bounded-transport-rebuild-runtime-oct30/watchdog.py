import pathlib,json,time
O=pathlib.Path(__file__).parent
deadline=json.loads((O/'boat-assignment.json').read_text())['shutdownEpoch']
while time.time()<deadline:
 if (O/'snapshot-stop-proof.json').exists():raise SystemExit(0)
 time.sleep(min(10,max(0,deadline-time.time())))
if not (O/'snapshot-stop-proof.json').exists():
 from lifecycle import closeout
 closeout()
