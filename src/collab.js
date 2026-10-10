import * as Y from 'yjs';
import {IndexeddbPersistence} from 'y-indexeddb';
export const encode=bytes=>{let str='';for(const byte of bytes)str+=String.fromCharCode(byte);return btoa(str)};
export const decode=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
export async function openDocument({id,user,onChange,onState,onPresence,onError,allowWrite=true}){
 const doc=new Y.Doc(),persistence=new IndexeddbPersistence(`teamsync:${user.id}:${id}`,doc);await persistence.whenSynced;
 let ws,timer,attempt=0,closed=false,dirty=localStorage.getItem(`dirty:${user.id}:${id}`)==='1',synced=false;const pending=new Set();
 const state=()=>onState({online:ws?.readyState===1,synced,pending:pending.size,dirty});
 const markDirty=value=>{dirty=value;localStorage.setItem(`dirty:${user.id}:${id}`,value?'1':'0')};
 const sendUpdate=update=>{if(ws?.readyState!==1||!allowWrite)return;const key=crypto.randomUUID();pending.add(key);ws.send(JSON.stringify({type:'update',id:key,update:encode(update)}));state()};
 doc.on('update',(update,origin)=>{onChange(doc);if(origin==='remote'||origin===persistence)return;markDirty(true);sendUpdate(update);state()});
 const connect=()=>{if(closed||!navigator.onLine)return state();ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/live?document=${id}`);ws.onopen=()=>{attempt=0;state()};ws.onmessage=event=>{try{const msg=JSON.parse(event.data);if(msg.type==='ready'){allowWrite=msg.role!=='viewer';Y.applyUpdate(doc,decode(msg.update),'remote');synced=true;if(allowWrite)sendUpdate(Y.encodeStateAsUpdate(doc));state()}
 if(msg.type==='update')Y.applyUpdate(doc,decode(msg.update),'remote');if(msg.type==='ack'){pending.delete(msg.id);if(!pending.size)markDirty(false);state()};if(msg.type==='presence')onPresence(msg.users);if(msg.type==='error'){onError(msg.message);state()}}catch{onError('Unable to sync. Your local copy is still saved.')}};
 ws.onclose=event=>{synced=false;pending.clear();onPresence([]);state();if(closed)return;if(event.code===1008){onError('Session ended. Sign in again to reconnect.');return}timer=setTimeout(connect,Math.min(15000,700*2**attempt++)+Math.random()*300)};ws.onerror=()=>{};};
 const online=()=>{clearTimeout(timer);if(!ws||ws.readyState>1)connect()};const offline=()=>{ws?.close();state()};window.addEventListener('online',online);window.addEventListener('offline',offline);connect();onChange(doc);state();
 return {doc,get writable(){return allowWrite},presence:editing=>{if(ws?.readyState===1)ws.send(JSON.stringify({type:'presence',editing}))},close:async()=>{closed=true;clearTimeout(timer);window.removeEventListener('online',online);window.removeEventListener('offline',offline);ws?.close();await persistence.destroy();doc.destroy()}};
}
export function editText(text,value){const old=text.toString();let start=0;while(start<old.length&&start<value.length&&old[start]===value[start])start++;let end=0;while(end<old.length-start&&end<value.length-start&&old[old.length-1-end]===value[value.length-1-end])end++;text.doc.transact(()=>{const length=old.length-start-end;if(length)text.delete(start,length);const inserted=value.slice(start,value.length-end);if(inserted)text.insert(start,inserted)},'typing')}
export {Y};
