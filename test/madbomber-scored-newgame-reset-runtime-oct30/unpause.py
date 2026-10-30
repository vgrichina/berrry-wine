import pathlib,json,time
p=pathlib.Path('/home/user/madbomber-runtime/commands-reset.jsonl')
def send(e):
 with p.open('a') as f:f.write(json.dumps(e)+'\n')
send({'cmd':'mousemove:308:400'});send({'cmd':'keydown:32'});time.sleep(.2);send({'cmd':'keyup:32'});print('ordinary Space and aim sent')
