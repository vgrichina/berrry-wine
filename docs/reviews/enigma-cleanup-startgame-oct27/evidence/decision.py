gate('decision')
f=json.loads((O/'new-menu-metadata.json').read_text());assert sha((O/'new-menu.png').read_bytes())==f['sha256'];assert sys.argv[-1]=='INSPECTED_ACTUAL_NEW_MENU_START_GAME_343_213'
d=dict(reviewed=True,safeStartGame=True,frameSHA256=f['sha256'],batch=f['batch'],x=343,y=213);save('decision.json',d)
code='import pathlib,json,time;p=pathlib.Path('+repr(str(O/'decision.json'))+');assert not p.exists();p.write_text('+repr(json.dumps(d))+');print(json.dumps(dict(deliveredAt=time.time(),frameSHA256='+repr(f['sha256'])+',batch='+str(f['batch'])+')))'
save('decision-delivery.json',json.loads(py(code)['stdout']));print('Exact newly inspected menu decision delivered')
