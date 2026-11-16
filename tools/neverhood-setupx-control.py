"""Explicit, single personally reviewed intents on the qualified native route."""
import pathlib, runpy, sys, os, time
ROOT=pathlib.Path(__file__).resolve().parent.parent
api=runpy.run_path(str(ROOT/'tools/disciples2-current-controller.py'),run_name='neverhood_setupx_control')
api['QUIT_ROUTES'].clear();api['QUIT_ROUTES'].update({'exit-launcher':None,'cancel-install':None,'confirm-exit':None,'game-escape':'keydown:27'})
if __name__=='__main__':
    command=sys.argv[1]
    if command=='capture':print(api['capture'](sys.argv[2]))
    elif command=='bind':api['bind'](sys.argv[2])
    elif command=='review':
        name,description,scope,target=sys.argv[2:6];assert scope in ('menu','game')
        rr=api['read'](name+'.json')
        api['save'](name+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],observation=description,
          scope=scope,targetHwnd=target,contract=api['CONTEXT_CONTRACT'],quitRoute=sys.argv[6] if len(sys.argv)>6 else None))
    elif command in ('pulse','quit-pulse'):
        name,key,ms,review,description=sys.argv[2:7]
        print(api['pulse'](name,[key],int(ms),review,description,final='final' in sys.argv[8:],
          intent='quit' if command=='quit-pulse' else 'gameplay',route=sys.argv[7] if command=='quit-pulse' else None))
    else:raise ValueError('explicit capture/review/bind/pulse/quit-pulse only')
