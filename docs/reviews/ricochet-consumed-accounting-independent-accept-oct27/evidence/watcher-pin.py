import pathlib,json
O=pathlib.Path(__file__).parent
p=pathlib.Path('/proc/4044731');raw=(p/'stat').read_text();s=raw[raw.rindex(')')+2:].split()
assert s[1]=='4043861'
assert (p/'cmdline').read_bytes().split(b'\0')[:-1]==[b'tail',b'-n',b'0',b'-f',b'messageboard.txt']
(O/'board-watcher.json').write_text(json.dumps(dict(pid=4044731,parent=4043861,start=s[19],argv=['tail','-n','0','-f','messageboard.txt'])))
print('owned watcher identity pinned')
