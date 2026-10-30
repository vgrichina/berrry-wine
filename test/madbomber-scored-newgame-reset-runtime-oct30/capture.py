import pathlib,json,time
p=pathlib.Path('/home/user/madbomber-runtime/commands-reset.jsonl')
def send(e):
 with p.open('a') as f:f.write(json.dumps(e)+'\n')
send({'action':'png','path':'/home/user/madbomber-runtime/capture-reset-oct30/resumed.png'});print('capture sent')
