import {WebSocketServer} from 'ws';
import * as Y from 'yjs';
import {randomUUID} from 'node:crypto';
import {digest} from './security.mjs';
import {createClient} from 'redis';
export async function attachRealtime({server,store,sessionUser,membership,origins,redisUrl}){
 const instance=randomUUID(),rooms=new Map();let pub,sub,redisReady=false;
 const send=(ws,data)=>{if(ws.readyState===1){if(ws.bufferedAmount>2*1024*1024)return ws.close(1013,'Slow connection');ws.send(JSON.stringify(data))}};
 const broadcast=(room,data,except)=>{for(const ws of room.clients)if(ws!==except)send(ws,data)};
 const syncRows=async room=>{for(const row of await store.sql('SELECT seq,id,data FROM updates WHERE document_id=? AND seq>? ORDER BY seq',[room.id,room.cursor])){if(!room.seen.has(row.id)){Y.applyUpdate(room.doc,Buffer.from(row.data,'base64'));broadcast(room,{type:'update',update:row.data})}room.seen.delete(row.id);room.cursor=Math.max(room.cursor,Number(row.seq));}};
 const queue=(room,fn)=>{room.queue=room.queue.then(fn).catch(e=>console.error('Room operation failed:',e.message));return room.queue};
 const roomFor=async id=>{let room=rooms.get(id);if(!room){room={id,doc:new Y.Doc(),seen:new Set(),cursor:0,clients:new Set(),queue:Promise.resolve(),idle:Date.now()};rooms.set(id,room);room.ready=queue(room,()=>syncRows(room))}await room.ready;return room};
 if(redisUrl){pub=createClient({url:redisUrl});sub=pub.duplicate();for(const client of [pub,sub])client.on('error',e=>{redisReady=false;console.error('Redis unavailable:',e.message)});await pub.connect();await sub.connect();await sub.subscribe('teamsync:updates',raw=>{try{const event=JSON.parse(raw);if(event.instance===instance)return;const room=rooms.get(event.document);if(room)queue(room,()=>syncRows(room))}catch{}});redisReady=true;}
 const wss=new WebSocketServer({noServer:true,maxPayload:512*1024,perMessageDeflate:false});
 server.on('upgrade',async(req,socket,head)=>{try{if(!origins.has(req.headers.origin))throw Error('origin');const url=new URL(req.url,'http://localhost');if(url.pathname!=='/live')throw Error('path');const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('ts_session='))?.slice(11);const user=await sessionUser(token);if(!user)throw Error('auth');const document=await store.one('SELECT * FROM documents WHERE id=?',[url.searchParams.get('document')]);if(!document)throw Error('document');const m=await membership(user.id,document.workspace_id);if(!m)throw Error('membership');if(rooms.size>=200&&!rooms.has(document.id))throw Error('capacity');const room=await roomFor(document.id);wss.handleUpgrade(req,socket,head,ws=>{ws.user=user;ws.session=digest(token);ws.workspace=document.workspace_id;ws.role=m.role;ws.kind=document.kind;ws.room=room;wss.emit('connection',ws,req)})}catch{socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy()}});
 wss.on('connection',ws=>{
 const room=ws.room;room.clients.add(ws);ws.alive=true;ws.messages=0;ws.window=Date.now();
 send(ws,{type:'ready',update:Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString('base64'),role:ws.role});
 const presence=()=>broadcast(room,{type:'presence',users:[...new Map([...room.clients].map(client=>[client.user.id,{id:client.user.id,name:client.user.name,editing:client.editing||false}])).values()]});presence();
 ws.on('pong',()=>ws.alive=true);
 ws.on('message',raw=>{queue(room,async()=>{try{
 if(Date.now()>ws.user.expires)return ws.close(1008,'Session expired');
 if(Date.now()-ws.window>1000){ws.messages=0;ws.window=Date.now()}if(++ws.messages>80)return ws.close(1008,'Too many updates');
 const msg=JSON.parse(raw.toString());
 if(msg.type==='presence'){ws.editing=!!msg.editing;presence();return}
 if(msg.type!=='update'||typeof msg.update!=='string'||msg.update.length>680000||typeof msg.id!=='string'||msg.id.length>80)throw Error('Invalid update');
 const m=await membership(ws.user.id,ws.workspace);if(!m||m.role==='viewer')return send(ws,{type:'error',message:'This workspace is read-only.'});
 const bytes=Buffer.from(msg.update,'base64');if(!bytes.length)throw Error('Empty update');
 const check=new Y.Doc();try{Y.applyUpdate(check,Y.encodeStateAsUpdate(room.doc));Y.applyUpdate(check,bytes);if(Y.encodeStateAsUpdate(check).byteLength>256*1024)throw Error('Document size limit reached');if(ws.kind==='document'){check.getText('content').toString()}else{const tasks=check.getMap('tasks');if(tasks.size>500)throw Error('Too many tasks');for(const [key,item] of tasks){if(!/^[a-zA-Z0-9-]{1,80}$/.test(key)||!(item instanceof Y.Map)||typeof item.get('title')!=='string'||!item.get('title').trim()||item.get('title').length>150||typeof item.get('tag')!=='string'||item.get('tag').length>30||!['todo','progress','done'].includes(item.get('status')))throw Error('Invalid task')}}}finally{check.destroy()}
 // Server generates storage IDs. Client IDs only correlate acknowledgements.
 const id=randomUUID();await store.appendUpdate(room.id,msg.update,id);
 Y.applyUpdate(room.doc,bytes);room.seen.add(id);await store.sql('UPDATE documents SET updated=? WHERE id=?',[Date.now(),room.id]);
 broadcast(room,{type:'update',update:msg.update},ws);send(ws,{type:'ack',id:msg.id});
 if(pub?.isReady)pub.publish('teamsync:updates',JSON.stringify({instance,document:room.id})).catch(()=>{});
 }catch(e){send(ws,{type:'error',message:e.message==='Document size limit reached'?e.message:'Could not save this update. Reconnect to retry.'})}})});
 ws.on('error',()=>{});ws.on('close',()=>{room.clients.delete(ws);room.idle=Date.now();presence()});
 });
 const compaction=setInterval(()=>{for(const room of rooms.values())queue(room,async()=>{await store.compact(room.id);await syncRows(room)})},60000);compaction.unref();
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive||Date.now()>ws.user.expires){ws.terminate();continue}ws.alive=false;ws.ping()}},30000);heartbeat.unref();
 // Durable anti-entropy catches missed Redis notifications and reconnect races.
 const recovery=setInterval(()=>{for(const [id,room] of rooms){if(!room.clients.size&&Date.now()-room.idle>60000){queue(room,()=>{if(!room.clients.size){room.doc.destroy();rooms.delete(id)}});continue}queue(room,()=>syncRows(room))}},5000);recovery.unref();
 return {health:()=>({rooms:rooms.size,connections:wss.clients.size,redis:redisUrl?(redisReady&&pub.isReady?'connected':'degraded'):'single-instance'}),disconnectUserSession:session=>{for(const ws of wss.clients)if(ws.session===session)ws.close(1008,'Signed out')},close:async()=>{clearInterval(compaction);clearInterval(heartbeat);clearInterval(recovery);for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await Promise.all([...rooms.values()].map(r=>r.queue));for(const room of rooms.values())room.doc.destroy();if(pub)await pub.quit();if(sub)await sub.quit()}};
}
