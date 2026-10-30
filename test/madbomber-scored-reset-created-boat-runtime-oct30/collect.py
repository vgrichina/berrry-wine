import pathlib,json,os
r=pathlib.Path("/home/user/madbomber-runtime");o=r/"capture-local-controller-oct30"
e=json.loads((o/"runtime-evidence.json").read_text());pid=json.loads((o/"live.json").read_text())["pid"]
try:os.killpg(pid,0);alive=True
except ProcessLookupError:alive=False
print(json.dumps({"runtime":e,"nodeStartup":json.loads((o/"node-startup.json").read_text()),"stdout":(o/"stdout.log").read_text(),"stderr":(o/"stderr.log").read_text(),"supervisorError":(r/"local-supervisor.stderr").read_text(),"cleanup":{"guestPID":pid,"processGroupExists":alive}}))
