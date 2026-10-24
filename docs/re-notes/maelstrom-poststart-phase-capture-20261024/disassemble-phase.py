import subprocess,pathlib,json
H=pathlib.Path(__file__).parent;G=pathlib.Path('/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6');ranges=[('Maelstrom.exe',0x4019a0,0x4019d0),('Maelstrom.exe',0x406373,0x406390),('Maelstrom.exe',0x402850,0x40289e),('Maelstrom.exe',0x413420,0x41343e),('SDL.dll',0x10017cd0,0x10017de0),('SDL.dll',0x10017f60,0x10017f82),('SDL.dll',0x10022a70,0x10022aaa)]
out=''
for n,a,b in ranges:out+=subprocess.check_output(['objdump','-d','-Mintel','--start-address='+hex(a),'--stop-address='+hex(b),str(G/n)],text=True)
(H/'phase-call-sites.asm').write_text(out)
(H/'instruction-read-accounting.json').write_text(json.dumps(dict(previousConservative=30000,firstExtraDisassemblyBytes=0x340,finalDisassemblyBytes=sum(b-a for _,a,b in ranges),additionalSourceExcerptsConservative=12000,projectedTotal=44000,cap=65536,passBudget=True),indent=2))
