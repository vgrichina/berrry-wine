import pathlib,json,time
p=pathlib.Path('/home/user/madbomber-runtime/commands-reset.jsonl')
def send(e):
 with p.open('a') as f:f.write(json.dumps(e)+'\n')
send({'cmd':'mousemove:0:400'});time.sleep(5);send({'action':'png','path':'/home/user/madbomber-runtime/capture-reset-oct30/after-score.png'});print('ordinary bucket move and capture sent')
