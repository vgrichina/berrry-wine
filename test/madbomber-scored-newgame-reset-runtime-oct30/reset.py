import pathlib,json,time
p=pathlib.Path('/home/user/madbomber-runtime/commands-reset.jsonl')
def send(e):
 with p.open('a') as f:f.write(json.dumps(e)+'\n')
send({'cmd':'keydown:13'});time.sleep(.2);send({'cmd':'keyup:13'});time.sleep(.8);send({'cmd':'keydown:13'});time.sleep(.2);send({'cmd':'keyup:13'});time.sleep(.8);send({'action':'png','path':'/home/user/madbomber-runtime/capture-reset-oct30/newgame-final.png'});print('ordinary Enter twice and fresh-game capture')
