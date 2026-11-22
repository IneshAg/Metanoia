import {isTauri, invoke} from '@tauri-apps/api/core';

export function normalizeNotionUrl(url: string): { desktopUri: string; webUrl: string } {
  const trimmed = url.trim();
  if (!trimmed) return { desktopUri: '', webUrl: '' };

  let clean = trimmed;
  clean = clean.replace(/^(https?:\/\/|notion:\/\/)/i, '');
  clean = clean.replace(/^(app\.notion\.com\/p\/|www\.notion\.so\/|notion\.so\/|[^/]+\.notion\.site\/)/i, '');

  const desktopUri = `notion://www.notion.so/${clean}`;
  const webUrl = `https://www.notion.so/${clean}`;
  return { desktopUri, webUrl };
}

export async function openExternal(url: string){
 const trimmed = url.trim();
 if(!trimmed) return;
 if(isTauri()){
   await invoke('open_external', {url: trimmed});
 } else {
   window.open(trimmed, '_blank', 'noopener,noreferrer');
 }
}

export async function openNotion(url: string){
 const trimmed = url.trim();
 if(!trimmed) return;
 const { desktopUri, webUrl } = normalizeNotionUrl(trimmed);

 if(isTauri()){
   try {
     await invoke('open_notion', {url: desktopUri});
   } catch {
     try {
       await invoke('open_external', {url: webUrl});
     } catch {
       window.open(webUrl, '_blank', 'noopener,noreferrer');
     }
   }
 } else {
   try {
     window.location.href = desktopUri;
   } catch {
     window.open(webUrl, '_blank', 'noopener,noreferrer');
   }
 }
}
