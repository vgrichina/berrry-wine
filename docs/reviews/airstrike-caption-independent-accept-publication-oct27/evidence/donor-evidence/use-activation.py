import run as c
for name in ['tools/airstrike-menu-controller.py','tools/airstrike-observation-bridge.py','test/test-airstrike-console-obscuration.py']:
 p=c.R/name;b=p.read_bytes();(c.H/('superseded-minimize-'+p.name)).write_bytes(b)
 s=b.decode().replace('consoleMinimize','consoleObstruction')
 if name.startswith('tools/airstrike-menu'):
  s=s.replace('self.dispatch(\'caption-click:\' + target[\'hwnd\'] + \':min\', o[\'startupSnapshot\'])',"self.dispatch(activation_command(o, o['startupSnapshot']), o['startupSnapshot'])")
  s=s.replace('# A minimize ACK says nothing', '# An activation ACK says nothing')
  start=s.index('def execution_log(');end=s.index('\n\nclass Controller:',start)
  s=s[:start]+'''def activation_command(observation, snapshot):
    target = console_target(observation, snapshot)
    main = next(w for w in snapshot['windows'] if w['hwnd'] == snapshot['mainHwnd'])
    if any(type(main.get(k)) is not int for k in ('x', 'y', 'w', 'h')):
        raise Refusal('unknown Airstrike caption geometry')
    # The retained frame exposes Airstrike's caption to the right of Console.
    # Keep clear of the system menu, border and all three caption buttons.
    x, y = target['x'] + target['w'] + 8, main['y'] + 13
    if (not main['x'] + 24 <= x < main['x'] + main['w'] - 64
            or not 0 <= x < snapshot['screen']['w']
            or not 0 <= y < snapshot['screen']['h']
            or (target['x'] <= x < target['x'] + target['w']
                and target['y'] <= y < target['y'] + target['h'])):
        raise Refusal('no safe exposed Airstrike caption point')
    return f'click:{x}:{y}'


def execution_log(command, batch, snapshot=None):
    parts = command.split(':')
    if len(parts) == 3 and parts[0] == 'click':
        return f'[input] click {parts[1]},{parts[2]} at batch {batch}'
    action, vk = parts
    return f'[input] {action} vk={vk} at batch {batch}'
'''+s[end:]
 elif name.startswith('tools/airstrike-observation'):
  s=s.replace("caption = cmd['cmd'].startswith('caption-click:')","activation = cmd['cmd'].startswith('click:')")
  s=s.replace('if caption:', 'if activation:').replace('or caption:', 'or activation:').replace('if caption and', 'if activation and')
  s=s.replace("if cmd['cmd'] != 'caption-click:' + target['hwnd'] + ':min':", "if cmd['cmd'] != self.module.activation_command(self.console_review, self.reviewed_capture[1]['snapshot']):")
  s=s.replace("('keyup:', 'caption-click:')", "('keyup:', 'click:')")
  s=s.replace('caption action','activation action').replace('caption input','activation input').replace('Console minimize','Airstrike activation')
 else:
  s=s.replace('caption-click:0x10002:min','click:656:33')
  s=s.replace('[input] caption-click min hwnd=0x10002 at 602,21','[input] click 656,33')
  s=s.replace("['caption-click:0x10001:min','caption-click:0x10002:close','caption-click:0x10002:max']","['click:32:32','click:634:21','click:616:21']")
  s=s.replace("if pending=='click:656:33':snapshot['windows'][1]['visible']=False", "if pending=='click:656:33':assert snapshot['focus']==snapshot['mainHwnd']")
  s=s.replace('minimize','activation').replace('caption_frozen','activation_frozen')
  # The contract oracle must match the actual click path, not the old minimize path.
  start=s.index('        for s in [');end=s.index('\n            self.assertIn(s,source)',start)
  s=s[:start]+'''        for s in ["kind === 'click'", "const evs = parseInputEntries([`${tickState.batch | 0}:${entry}`]);", "ev.action === 'click' && renderer && renderer.handleMouseDown", "renderer.handleMouseDown(ev.x, ev.y, 1);", "renderer.handleMouseUp(ev.x, ev.y, 1);", "return { queued: true, batch: tickState.batch | 0 };"]:'''+s[end:]
 p.write_text(s)
# Pin the final controller for the actual bridge entry.
p=c.R/'tools/airstrike-observation-bridge.py';s=p.read_text();import re,hashlib
s=re.sub(r"CONTROLLER_SHA256 = '[0-9a-f]+'", "CONTROLLER_SHA256 = '"+hashlib.sha256((c.R/'tools/airstrike-menu-controller.py').read_bytes()).hexdigest()+"'",s);p.write_text(s)
print('Selected exposed Airstrike titlebar activation; superseded minimize source retained.')
