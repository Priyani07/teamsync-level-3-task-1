import {DatabaseSync} from 'node:sqlite';
import pg from 'pg';
import * as Y from 'yjs';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
const schema=[
`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires BIGINT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,created BIGINT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS members(workspace_id TEXT NOT NULL REFERENCES workspaces(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(workspace_id,user_id))`,
`CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),title TEXT NOT NULL,kind TEXT NOT NULL,created BIGINT NOT NULL,updated BIGINT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS updates(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,document_id TEXT NOT NULL REFERENCES documents(id),data TEXT NOT NULL,created BIGINT NOT NULL)`,
`CREATE INDEX IF NOT EXISTS updates_document ON updates(document_id)`,
`CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),role TEXT NOT NULL,expires BIGINT NOT NULL)`];
export async function createStore(url=process.env.DATABASE_URL,path='data/teamsync.db'){
 let sql,pool,sqlite;
 if(url){pool=new pg.Pool({connectionString:url,max:10});sql=async(q,p=[])=>{let n=0;const result=await pool.query(q.replace(/\?/g,()=>'$'+(++n)),p);return result.rows}}
 else{mkdirSync('data',{recursive:true});sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');sql=async(q,p=[])=>{const s=sqlite.prepare(q);return /^\s*(SELECT|.*RETURNING)/i.test(q)?s.all(...p):(s.run(...p),[])}};
 for(const q of schema) await sql(url?q.replace("seq INTEGER PRIMARY KEY AUTOINCREMENT","seq BIGSERIAL PRIMARY KEY"):q);
 const locked=async(document,fn)=>{if(!pool)return fn(null);const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[document]);const result=await fn(client);await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}};
 const appendUpdate=async(document,data,id=randomUUID())=>locked(document,async client=>{if(client)await client.query('INSERT INTO updates(id,document_id,data,created) VALUES($1,$2,$3,$4)',[id,document,data,Date.now()]);else sqlite.prepare('INSERT INTO updates(id,document_id,data,created) VALUES(?,?,?,?)').run(id,document,data,Date.now());return id});
 const compact=async document=>locked(document,async client=>{let rows;if(client)rows=(await client.query('SELECT seq,data FROM updates WHERE document_id=$1 ORDER BY seq',[document])).rows;else rows=sqlite.prepare('SELECT seq,data FROM updates WHERE document_id=? ORDER BY seq').all(document);if(rows.length<100)return false;const doc=new Y.Doc();let state;try{for(const row of rows)Y.applyUpdate(doc,Buffer.from(row.data,'base64'));state=Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')}finally{doc.destroy()}const cutoff=rows.at(-1).seq,id=randomUUID();if(client){await client.query('INSERT INTO updates(id,document_id,data,created) VALUES($1,$2,$3,$4)',[id,document,state,Date.now()]);await client.query('DELETE FROM updates WHERE document_id=$1 AND seq<=$2',[document,cutoff])}else{sqlite.exec('BEGIN IMMEDIATE');try{sqlite.prepare('INSERT INTO updates(id,document_id,data,created) VALUES(?,?,?,?)').run(id,document,state,Date.now());sqlite.prepare('DELETE FROM updates WHERE document_id=? AND seq<=?').run(document,cutoff);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}}return true});
 return {sql,appendUpdate,compact,one:async(q,p=[])=>(await sql(q,p))[0],close:async()=>pool?pool.end():sqlite.close()};
}
