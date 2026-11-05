'use strict';
(() => {
  let socket, terminal, target, mode='view', epoch=0;
  const el=id=>document.getElementById(id);
  const drawer=el('terminal-drawer'),status=el('terminal-status'),modeButton=el('terminal-mode');
  const send=message=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));};
  function disconnect(){epoch++;const old=socket;socket=null;old?.close();terminal?.dispose();terminal=null;mode='view';modeButton.disabled=true;}
  async function connect() {
    disconnect();const attempt=epoch;
    status.textContent='Connecting…';modeButton.textContent='Enable control';
    el('terminal-notice').textContent='View only. Closing this drawer leaves the agent running.';
    el('terminal-screen').replaceChildren();
    try {
      if(!window.Terminal)throw Error('The terminal viewer (xterm.js) did not load, so the live pane cannot be shown. On the dashboard host run: npm ci --prefix ops --ignore-scripts, then reload this page. The agent keeps running either way.');
      const response=await fetch('/api/terminal-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:target.id})});
      if(!response.ok)throw Error(await response.text());
      const grant=await response.json();if(attempt!==epoch)return;
      terminal=new Terminal({disableStdin:true,cursorBlink:false,fontSize:13,fontFamily:'Menlo, Consolas, monospace',scrollback:3000,theme:{background:'#070d0a',foreground:'#d2e3d7',cursor:'#b6f569'}});
      terminal.open(el('terminal-screen'));
      terminal.onData(data=>{if(mode==='control')send({type:'input',data});});
      socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/terminal?ticket=${encodeURIComponent(grant.token)}`);
      socket.onmessage=event=>{
        if(attempt!==epoch)return;
        const message=JSON.parse(event.data);
        if(message.type==='output')terminal.write(Uint8Array.from(atob(message.data),c=>c.charCodeAt(0)));
        else if(message.type==='geometry')terminal.resize(message.cols,message.rows);
        else if(message.type==='mode') {
          mode=message.mode;terminal.options.disableStdin=mode!=='control';terminal.options.cursorBlink=mode==='control';
          status.textContent=mode==='control'?'● Control enabled':'● Connected · View only';
          modeButton.disabled=false;modeButton.textContent=mode==='control'?'Switch to view':'Enable control';
          el('terminal-notice').textContent=mode==='control'?'Your keystrokes go directly to this pane. Closing detaches only this viewer.':'View only · original pane size. Closing leaves the agent running.';
          drawer.classList.toggle('terminal-controlling',mode==='control');if(mode==='control')terminal.focus();
        } else if(message.type==='error') {status.textContent=message.message;modeButton.disabled=false;}
        else if(message.type==='ended')status.textContent=message.message;
      };
      socket.onclose=()=>{if(attempt!==epoch)return;mode='view';terminal.options.disableStdin=true;modeButton.disabled=true;status.textContent='Disconnected · Reconnect to view';drawer.classList.remove('terminal-controlling');};
      socket.onerror=()=>{if(attempt===epoch)status.textContent='Connection failed · Reconnect to view';};
    } catch(error) {
      if(attempt!==epoch)return;
      status.textContent='Unavailable';
      // Say why in the drawer itself, not only in the small status line.
      const note=document.createElement('p');note.className='terminal-unavailable';note.textContent=error.message;
      el('terminal-screen').replaceChildren(note);
    }
  }
  window.OpsTerminal={open(value){target=value;el('terminal-title').textContent=`Terminal / ${value.session}`;if(!drawer.open)drawer.showModal();connect();}};
  modeButton.onclick=()=>{modeButton.disabled=true;send({type:'mode',mode:mode==='control'?'view':'control'});};
  el('terminal-close').onclick=()=>drawer.close();
  el('terminal-reconnect').onclick=()=>connect();
  el('terminal-expand').onclick=()=>{drawer.classList.toggle('terminal-expanded');el('terminal-expand').textContent=drawer.classList.contains('terminal-expanded')?'Restore':'Expand';};
  drawer.addEventListener('close',()=>{disconnect();drawer.classList.remove('terminal-controlling');});
  drawer.addEventListener('cancel',event=>{if(mode==='control')event.preventDefault();});
  window.addEventListener('pagehide',disconnect);
})();
