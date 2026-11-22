import Database from '@tauri-apps/plugin-sql';
import {isTauri} from '@tauri-apps/api/core';
import {applyAction,mergeGoalSnapshot,mergeLessonSnapshot,mergeTaskRemotes,migrateState,type Action,type Lesson,type Settings,type State,type TaskGoalSnapshot} from './domain';
let csrf='';let database:Database|null=null;
function legacySettings():Partial<Settings>{const storedMinutes=Number(localStorage.getItem('metanoia-focus-minutes'));return {theme:localStorage.getItem('metanoia-theme')==='dark'?'dark':'light',palette:(localStorage.getItem('metanoia-palette')||'forest') as Settings['palette'],motion:localStorage.getItem('metanoia-motion')!=='off',focusMinutes:storedMinutes||25}}
async function localDb(){if(database)return database;const db=await Database.load('sqlite:metanoia-v2.sqlite3');await db.execute('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id=1), json TEXT NOT NULL)');await db.execute('CREATE TABLE IF NOT EXISTS music_taste (track_key TEXT PRIMARY KEY, rating INTEGER NOT NULL CHECK (rating IN (-1,1)))');
await db.execute('CREATE TABLE IF NOT EXISTS music_tracks (path TEXT PRIMARY KEY, name TEXT NOT NULL, added_at TEXT NOT NULL)');database=db;return db}
export async function load():Promise<State>{if(isTauri()){const db=await localDb();let rows=await db.select<{json:string}[]>('SELECT json FROM app_state WHERE id=1');if(!rows.length){const r=await fetch('/initial-state.json');if(!r.ok)throw Error('The initial workspace could not be read.');const initial=await r.text();await db.execute('INSERT INTO app_state (id,json) VALUES (1,$1)',[initial]);rows=[{json:initial}]}let state=migrateState(JSON.parse(rows[0].json) as State,legacySettings());const lessonResponse=await fetch('/initial-lessons.json');if(lessonResponse.ok)state=mergeLessonSnapshot(state,await lessonResponse.json() as Lesson[]);const goalResponse=await fetch('/initial-goals.json');if(goalResponse.ok)state=mergeGoalSnapshot(state,await goalResponse.json() as TaskGoalSnapshot[]);const remotesResponse=await fetch('/initial-task-remotes.json');if(remotesResponse.ok)state=mergeTaskRemotes(state,await remotesResponse.json() as Record<string,string>);const migrated=JSON.stringify(state);if(migrated!==rows[0].json)await db.execute('UPDATE app_state SET json=$1 WHERE id=1',[migrated]);return state}
 const r=await fetch('/api/state');if(!r.ok)throw Error('The local data service is unavailable.');const data=await r.json();csrf=data.csrf;return data.state}
let writeQueue = Promise.resolve();

export function send(action:Action):Promise<State>{
  const run = async (): Promise<State> => {
    if(isTauri()){
      const db=await localDb();
      const previous=await load();
      const next=applyAction(previous,action);
      await db.execute('UPDATE app_state SET json=$1 WHERE id=1',[JSON.stringify(next)]);
      return next;
    }
    const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json','x-metanoia-csrf':csrf},body:JSON.stringify(action)});
    const data=await r.json();
    if(!r.ok)throw Error(data.error||'Could not save.');
    return data.state;
  };
  const task = writeQueue.then(run, run);
  writeQueue = task.then(()=>{}, ()=>{});
  return task;
}

export async function loadMusicTaste():Promise<Record<string,1|-1>>{if(isTauri()){const db=await localDb();let rows=await db.select<{track_key:string;rating:number}[]>('SELECT track_key,rating FROM music_taste');if(!rows.length){try{const old=JSON.parse(localStorage.getItem('metanoia-music-taste')||'{}') as Record<string,number>;for(const [key,rating] of Object.entries(old)){if(rating===1||rating===-1)await db.execute('INSERT OR REPLACE INTO music_taste (track_key,rating) VALUES ($1,$2)',[key,rating]);}localStorage.removeItem('metanoia-music-taste');rows=await db.select<{track_key:string;rating:number}[]>('SELECT track_key,rating FROM music_taste')}catch{}}return Object.fromEntries(rows.map(row=>[row.track_key,row.rating])) as Record<string,1|-1>}try{return JSON.parse(localStorage.getItem('metanoia-music-taste')||'{}')}catch{return {}}}
export async function saveMusicTaste(key:string,rating:1|-1|0):Promise<void>{if(isTauri()){const db=await localDb();if(rating===0)await db.execute('DELETE FROM music_taste WHERE track_key=$1',[key]);else await db.execute('INSERT INTO music_taste (track_key,rating) VALUES ($1,$2) ON CONFLICT(track_key) DO UPDATE SET rating=excluded.rating',[key,rating]);return}const taste=await loadMusicTaste();if(rating===0)delete taste[key];else taste[key]=rating;localStorage.setItem('metanoia-music-taste',JSON.stringify(taste))}


export interface SavedTrack {
  path: string;
  name: string;
}

export async function loadMusicTracks(): Promise<SavedTrack[]> {
  if (isTauri()) {
    const db = await localDb();
    const rows = await db.select<SavedTrack[]>('SELECT path, name FROM music_tracks ORDER BY added_at ASC');
    return rows;
  }
  try {
    return JSON.parse(localStorage.getItem('metanoia-music-tracks') || '[]');
  } catch {
    return [];
  }
}

export async function saveMusicTracks(tracks: SavedTrack[]): Promise<void> {
  if (isTauri()) {
    const db = await localDb();
    const now = new Date().toISOString();
    for (const t of tracks) {
      await db.execute(
        'INSERT OR REPLACE INTO music_tracks (path, name, added_at) VALUES ($1, $2, $3)',
        [t.path, t.name, now]
      );
    }
    return;
  }
  try {
    const existing = await loadMusicTracks();
    const map = new Map(existing.map(t => [t.path, t]));
    for (const t of tracks) map.set(t.path, t);
    localStorage.setItem('metanoia-music-tracks', JSON.stringify(Array.from(map.values())));
  } catch {}
}

export async function removeMusicTrack(path: string): Promise<void> {
  if (isTauri()) {
    const db = await localDb();
    await db.execute('DELETE FROM music_tracks WHERE path = $1', [path]);
    await db.execute('DELETE FROM music_taste WHERE track_key = $1', [path.toLowerCase()]);
    return;
  }
  try {
    const existing = await loadMusicTracks();
    const next = existing.filter(t => t.path !== path);
    localStorage.setItem('metanoia-music-tracks', JSON.stringify(next));
  } catch {}
}
