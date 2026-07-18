// Надёжное сохранение/шаринг файла. session 019.
// Проблема (ревью session 018): на Android WebView экспорт через blob + <a download> НЕ сохраняет файл.
// На телефоне пишем файл в Cache через @capacitor/filesystem и открываем системный «Поделиться»
// (@capacitor/share) — так бэкап реально уходит в «Файлы»/облако/мессенджер. На вебе — обычный download.
// Плагины импортируются СТАТИЧЕСКИ (landmine session 014: ленивый import Capacitor-плагинов виснет),
// на вебе не вызываются (guard isNativePlatform).
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function b64toBlob(b64, mime){
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// content: текст (base64:false) или base64-строка (base64:true, для бинарных .xlsx)
export async function saveOrShare(filename, content, { mime='application/octet-stream', base64=false } = {}){
  if(Capacitor.isNativePlatform()){
    const res = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      ...(base64 ? {} : { encoding: 'utf8' }),   // без encoding = запись бинаря из base64
    });
    try{
      await Share.share({ title: filename, url: res.uri, dialogTitle: 'Сохранить / поделиться бэкапом Life OS' });
    }catch(e){ /* пользователь закрыл шаринг — файл уже записан в Cache, это не ошибка */ }
    return { ok:true, native:true, uri:res.uri };
  }
  // веб: обычное скачивание
  const blob = base64 ? b64toBlob(content, mime) : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  return { ok:true, native:false };
}
