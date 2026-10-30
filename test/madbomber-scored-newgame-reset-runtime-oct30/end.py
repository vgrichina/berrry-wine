import pathlib,json,time
p=pathlib.Path('/home/user/madbomber-runtime/commands-reset.jsonl')
def send(e):
 with p.open('a') as f:f.write(json.dumps(e)+'\n')
send({'cmd':'keydown:32'});time.sleep(.2);send({'cmd':'keyup:32'});time.sleep(4);send({'action':'png','path':'/home/user/madbomber-runtime/capture-reset-oct30/gameover-check.png'});print('ordinary Space and Game Over check')
