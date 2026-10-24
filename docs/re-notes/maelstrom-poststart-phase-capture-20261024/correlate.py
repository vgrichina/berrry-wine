import pathlib,json,importlib.util,struct,re
H=pathlib.Path(__file__).parent;spec=importlib.util.spec_from_file_location('proof','/tmp/maelstrom-poststart-state-cause-oct24/repo/tools/maelstrom-poststart-proof.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
G=pathlib.Path('/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6');exe=p.PE((G/'Maelstrom.exe').read_bytes());sdl=p.PE((G/'SDL.dll').read_bytes());snaps=json.load(open(H/'state-analysis.json'));e=[]
# Match candidate return values to an actual decoded E8 instruction ending there.
for slot,ret,call,target,mod in [(0x74ffea4,0x40637d,0x406378,0x4019a0,'exe'),(0x74ffe98,0x4019a8,0x4019a3,0x402850,'exe'),(0x74ffe74,0x40287d,0x402878,0x413426,'exe'),(0x74ffe60,0x67df75,0x10017f70,0x10017cd0,'sdl'),(0x74ffe34,0x67ddbb,0x10017db6,0x10022a70,'sdl')]:
 pe=exe if mod=='exe' else sdl;b=pe.read(call,5);assert b[0]==0xe8 and call+5+struct.unpack('<i',b[1:])[0]==target
 runtimeReturn=call+5 if mod=='exe' else 0x666000+call+5-0x10000000;assert runtimeReturn==ret
 for batch in ['39000','41900']:assert dict((int(v['slot'],16),int(v['value'],16)) for v in snaps[batch]['stackCandidates'])[slot]==ret
 e.append(dict(slot=hex(slot),runtimeReturn=hex(ret),originalCall=hex(call),bytes=b.hex(),target=hex(target),module=mod,snapshots=[39000,41900]))
assert exe.imports()[0x419150][-1]=='SDL_PollEvent'
exports=sdl.exports();assert exports['SDL_PollEvent']==0x10017f60 and exports['SDL_PeepEvents']==0x10017cd0
# Values deeper than the coherent call chain can be stale, including 0x4019b0.
r=dict(passCorrelation=True,EXEbase='0x400000',SDLbase='0x666000',SDLpreferred='0x10000000',calls=e,exePollImport=exe.imports()[0x419150],SDLexports={k:hex(exports[k]) for k in ['SDL_PollEvent','SDL_PeepEvents']},qualification='Snapshots and counters establish first HandleEvents/PollEvent drain pending; no formal unwinder, innermost thunk/API or permanent nontermination proof. Do not interpret arbitrary stack words as active frames.')
(H/'call-correlation.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
