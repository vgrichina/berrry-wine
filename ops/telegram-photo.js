#!/usr/bin/env node
'use strict';
// Send one or more images to the owner's Telegram chat.
// Usage: node ops/telegram-photo.js <png> [caption] [<png> [caption] ...]
// Uses the same bot token and owner chat as ops/telegram.js.
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
  const args=process.argv.slice(2);if(!args.length)throw Error('usage: telegram-photo.js <png> [caption] ...');
  const token=(await fs.readFile(process.env.TELEGRAM_TOKEN_FILE||path.join(root,'scratch/telegram-token.txt'),'utf8')).trim();
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid bot token file');
  const state=JSON.parse(await fs.readFile(path.join(root,'scratch/telegram/state.json'),'utf8'));
  const chatId=state.owner&&state.owner.chatId;if(!chatId)throw Error('No owner chat in scratch/telegram/state.json');
  const items=[];for(let i=0;i<args.length;i++){const file=args[i];const caption=args[i+1]&&!/\.(png|jpe?g|webp)$/i.test(args[i+1])?args[++i]:'';items.push({file,caption});}
  for(const {file,caption} of items){
    const form=new FormData();form.set('chat_id',String(chatId));if(caption)form.set('caption',caption.slice(0,1024));
    form.set('photo',new Blob([await fs.readFile(file)],{type:'image/png'}),path.basename(file));
    const response=await fetch('https://api.telegram.org/bot'+token+'/sendPhoto',{method:'POST',body:form,signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!data.ok)throw Error('sendPhoto failed ('+response.status+'): '+(data.description||''));
    console.log(JSON.stringify({file,messageId:data.result.message_id}));
  }
})().catch(e=>{console.error(e.message);process.exitCode=1});
