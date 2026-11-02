'use strict';
let messages = [], selected = null, busy = false, lastChecked = null, previewRequest = 0;
const selectedMessages = new Set(), selectedAttachments = new Set(), sourceHandles = new Map(), expanded = new Map();
const $ = id => document.getElementById(id);
const url = (id, part) => `/${window.VIEWER_TOKEN}/${id}/${part}`;
const attachmentKey = (id, index) => `${id}:${index}`;

function matchesQuery(m, query) {
  const terms = query.match(/(?:[^\s"]|"[^"]*")+/g) || [];
  const fields = {to:m.to, from:m.sender, cc:m.cc, subject:m.subject,
    body:m.bodyText || m.plain, content:m.bodyText || m.plain, attachment:m.attachments.map(a=>a.name).join(' ')};
  const all = Object.values(fields).join(' ').toLowerCase();
  return terms.every(term => {
    term = term.replace(/"/g, '').toLowerCase();
    const match = /^(to|from|cc|subject|body|content|attachment|has):(.*)$/.exec(term);
    if (!match) return all.includes(term);
    const [, field, value] = match;
    if (field === 'has') {
      if (['attachment','attachments'].includes(value)) return m.attachments.length > 0;
      if (['noattachment','noattachments'].includes(value)) return m.attachments.length === 0;
      return false;
    }
    return String(fields[field] || '').toLowerCase().includes(value);
  });
}

function filterMessages(items, query, from, to) {
  return items.filter(m => matchesQuery(m, query) && (!from || (m.dateKey && m.dateKey >= from)) &&
    (!to || (m.dateKey && m.dateKey <= to))).sort((a,b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
}

function filteredMessages() { return filterMessages(messages, $('search').value, $('dateFrom').value, $('dateTo').value); }
function setStatus(text) { $('status').textContent = text; }
function setReaderStatus(text,error=false) {
  $('readerStatus').textContent=text;$('readerStatus').hidden=!text;
  $('readerStatus').classList.toggle('error',error);setStatus(text);
}
function nextAfterDeletion(previousIds,deletedId,remaining) {
  const byId=new Map(remaining.map(m=>[m.id,m]));
  const index=previousIds.indexOf(deletedId);
  const candidates=index<0?[]:[...previousIds.slice(index+1),...previousIds.slice(0,index).reverse()];
  return candidates.map(id=>byId.get(id)).find(Boolean)||remaining[0]||null;
}
function resetReader() {
  selected = null; $('reader').hidden = true; $('empty').hidden = false;
  $('html').removeAttribute('src'); $('attachments').replaceChildren();
}
function updateSelectionCount() {
  $('selectionCount').textContent = `${selectedMessages.size} emails · ${selectedAttachments.size} attachments selected`;
  $('deleteCurrent').disabled = busy || !selected;
  const visible=filteredMessages(),index=visible.findIndex(m=>m.id===selected);
  $('nextEmail').disabled = busy || !selected || index>=visible.length-1;
  $('deleteCurrent').title = $('deleteMode').value === 'originals' ? 'Delete this email from its original file on disk' : 'Remove this email from this session only';
  for (const id of ['deleteMessages','selectMessageAttachments','exportMessages']) $(id).disabled = busy || !selectedMessages.size;
  for (const id of ['deleteAttachments','exportAttachments']) $(id).disabled = busy || !selectedAttachments.size;
}
function setBusy(value) {
  busy = value;
  for (const id of ['open','folder','uploadFolder','clear','deleteMode']) $(id).disabled = value;
  document.querySelectorAll('#list input,#attachments input').forEach(input=>input.disabled=value);
  updateSelectionCount();
}

function render() {
  const filtered = filteredMessages();
  $('count').textContent = `${filtered.length} of ${messages.length} messages`;
  $('list').replaceChildren();
  if (!filtered.length) {
    const p=document.createElement('p');p.className='empty-result';p.textContent='No messages match the current filters.';$('list').append(p);
  }
  const groups = new Map(), years = new Map(), months = new Map();
  for(const m of filtered) {
    const year=m.dateKey?m.dateKey.slice(0,4):'Undated',month=m.dateKey?m.dateKey.slice(0,7):'Undated';
    if(!years.has(year))years.set(year,[]);years.get(year).push(m);
    if(!months.has(month))months.set(month,[]);months.get(month).push(m);
  }
  function group(parent, key, title, members, month=false) {
    if (groups.has(key)) return groups.get(key);
    const detail=document.createElement('details'), summary=document.createElement('summary'), label=document.createElement('label'), check=document.createElement('input');
    detail.className=month?'month-group':'year-group';detail.open=expanded.get(key)??true;
    detail.addEventListener('toggle',()=>expanded.set(key,detail.open));
    summary.append(document.createTextNode(`${title} (${members.length})`));check.type='checkbox';check.disabled=busy;
    check.setAttribute('aria-label',`Select ${title}`);check.checked=members.every(m=>selectedMessages.has(m.id));
    check.indeterminate=!check.checked&&members.some(m=>selectedMessages.has(m.id));
    label.append(check,document.createTextNode('Select group'));label.addEventListener('click',e=>e.stopPropagation());
    check.onchange=()=>{members.forEach(m=>check.checked?selectedMessages.add(m.id):selectedMessages.delete(m.id));render()};
    summary.append(label);detail.append(summary);parent.append(detail);groups.set(key,detail);return detail;
  }
  for (const m of filtered) {
    let parent=$('list');const year=m.dateKey?m.dateKey.slice(0,4):'Undated', month=m.dateKey?m.dateKey.slice(0,7):'Undated';
    if ($('groupBy').value!=='none') {
      parent=group(parent,year,year,years.get(year));
      if ($('groupBy').value==='month'&&m.dateKey) {
        const title=new Date(`${month}-01T12:00:00`).toLocaleString(undefined,{month:'long',year:'numeric'});
        parent=group(parent,month,title,months.get(month),true);
      }
    }
    const row=document.createElement('div'), check=document.createElement('input'), button=document.createElement('button');
    row.className='mail-row';check.type='checkbox';check.disabled=busy;check.checked=selectedMessages.has(m.id);check.setAttribute('aria-label',`Select ${m.subject}`);
    check.onclick=e=>{
      if(e.shiftKey&&lastChecked&&filtered.some(x=>x.id===lastChecked)) {
        const a=filtered.findIndex(x=>x.id===lastChecked), b=filtered.indexOf(m);
        filtered.slice(Math.min(a,b),Math.max(a,b)+1).forEach(x=>check.checked?selectedMessages.add(x.id):selectedMessages.delete(x.id));
      } else { check.checked?selectedMessages.add(m.id):selectedMessages.delete(m.id); }
      lastChecked=m.id;render();
    };
    button.className='message'+(m.id===selected?' active':'');
    for(const [tag,text] of [['strong',m.subject],['span',m.sender||'Unknown sender'],['span',`${m.dateKey||'Undated'} · ${m.attachments.length} attachment(s)`]]) {
      const element=document.createElement(tag);element.textContent=text;button.append(element);
    }
    button.onclick=()=>show(m);row.append(check,button);parent.append(row);
  }
  updateSelectionCount();
}

function setView(html) {
  $('html').hidden=!html;$('body').hidden=html;
  $('htmlTab').setAttribute('aria-pressed',String(html));$('textTab').setAttribute('aria-pressed',String(!html));
  if(html) $('html').src=url(selected,'html');
}
function renderAttachments(m) {
  $('attachments').replaceChildren();
  m.attachments.forEach((a,index)=>{
    const card=document.createElement('div'), check=document.createElement('input'), name=document.createElement('span');
    check.type='checkbox';check.disabled=busy;check.checked=selectedAttachments.has(attachmentKey(m.id,index));
    check.setAttribute('aria-label',`Select attachment ${a.name}`);
    check.onchange=()=>{check.checked?selectedAttachments.add(attachmentKey(m.id,index)):selectedAttachments.delete(attachmentKey(m.id,index));updateSelectionCount()};
    name.textContent=`${a.name} (${(a.size/1024).toFixed(1)} KB)`;card.append(check,name);
    if(a.preview) {const view=document.createElement('button');view.textContent='Preview';view.onclick=()=>previewAttachment(m,a,index);card.append(view)}
    const link=document.createElement('a');link.className='button';link.href=url(m.id,index);link.textContent='↓ Save';card.append(link);$('attachments').append(card);
  });
}
function show(m) {
  $('readerStatus').hidden=true;
  selected=m.id;$('empty').hidden=true;$('reader').hidden=false;$('subject').textContent=m.subject;$('meta').replaceChildren();
  for(const [label,value] of [['From',m.sender],['To',m.to],['Cc',m.cc],['Date',m.date]]) {
    if(!value)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('meta').append(dt,dd);
  }
  $('body').textContent=m.plain||m.bodyText||'No readable message body.';
  $('html').removeAttribute('src');$('htmlTab').disabled=!m.hasHtml;$('original').href=url(m.id,'original');
  setView(m.hasHtml);renderAttachments(m);render();
}

async function api(path,payload) {
  const response=await fetch(path,{method:'POST',headers:{'X-Viewer-Token':window.VIEWER_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok) {
    if(response.status===404)throw Error('The running Postbox server does not support this action. Stop it with Ctrl+C, restart from the updated package, and reopen your emails.');
    let error={};try{error=await response.json()}catch(ignore){}
    throw Error(error.error||`Request failed (${response.status}).`);
  }
  return response;
}
async function importOne(file,handle=null,parent=null) {
  if(handle)for(const existing of sourceHandles.values())if(await handle.isSameEntry(existing.handle))return 0;
  const response=await fetch('/import',{method:'POST',headers:{'X-Viewer-Token':window.VIEWER_TOKEN,'X-Filename':encodeURIComponent(file.name)},body:file});
  const imported=await response.json();if(!response.ok)throw Error(imported.error||'Import failed');
  for(const m of imported) {messages.push(m);if(handle)sourceHandles.set(m.sourceId,{handle,parent,name:file.name})}
  return imported.length;
}
async function loadFiles(files) {
  if(busy)return;setBusy(true);let count=0,failed=0;
  try {
    const accepted=[...files].filter(f=>/\.(eml|mbox|mbx)$/i.test(f.name));
    for(const file of accepted) {
      setStatus(`Opening ${file.name}…`);
      try {count+=await importOne(file)}catch(e){failed++}
    }
    if(!selected&&messages.length)show(messages[0]);else render();
    setStatus(`${count} messages opened${failed?`; ${failed} file(s) failed (100 MB maximum per file)`:''}. Imported copies: use a managed folder to edit originals.`);
  } finally {setBusy(false);$('files').value='';$('folders').value=''}
}
async function openFiles() {
  if(!window.showOpenFilePicker){$('files').click();return}
  try {
    const handles=await window.showOpenFilePicker({multiple:true,types:[{description:'Email exports',accept:{'application/octet-stream':['.eml','.mbox','.mbx']}}]});
    setBusy(true);let count=0,failed=0;
    for(const handle of handles) {try{count+=await importOne(await handle.getFile(),handle)}catch(e){failed++}}
    if(!selected&&messages.length)show(messages[0]);else render();
    setStatus(`${count} messages opened${failed?`; ${failed} files failed`:''}. For deleting .eml originals, select their containing folder when asked.`);
  }catch(e){if(e.name!=='AbortError')setStatus(e.message)}finally{setBusy(false)}
}
async function openFolder() {
  if(!window.showDirectoryPicker){$('folders').click();return}
  try {
    const folder=await window.showDirectoryPicker({mode:'readwrite'});setBusy(true);let count=0,failed=0;
    async function walk(directory) {
      for await(const entry of directory.values()) {
        if(entry.kind==='directory')await walk(entry);
        else if(/\.(eml|mbox|mbx)$/i.test(entry.name)) {
          setStatus(`Opening ${entry.name}…`);
          try{count+=await importOne(await entry.getFile(),entry,directory)}catch(e){failed++}
        }
      }
    }
    await walk(folder);if(!selected&&messages.length)show(messages[0]);else render();
    setStatus(`${count} messages opened from managed files${failed?`; ${failed} files failed`:''}. Original-file editing is available.`);
  }catch(e){if(e.name!=='AbortError')setStatus(e.message)}finally{setBusy(false)}
}

async function previewAttachment(m,a,index) {
  const request=++previewRequest,source=url(m.id,'preview/'+index),container=$('previewContent');
  $('previewTitle').textContent=a.name;$('previewDownload').href=url(m.id,index);container.replaceChildren();$('previewDialog').showModal();
  if(a.preview==='text') {
    container.textContent='Preparing text preview…';
    try{const response=await fetch(source),text=await response.text();if(request!==previewRequest)return;const pre=document.createElement('pre');pre.textContent=text;container.replaceChildren(pre)}catch(e){if(request===previewRequest)container.textContent='Preview failed. Download the original file to open it.'}
  }else {
    const tag={image:'img',video:'video',audio:'audio',pdf:'iframe'}[a.preview];if(!tag)return;
    const element=document.createElement(tag);element.src=source;
    if(tag==='img')element.alt=a.name;
    if(tag==='iframe'){element.title=a.name;element.referrerPolicy='no-referrer'}
    if(tag==='audio'||tag==='video'){element.controls=true;element.preload='metadata'}
    element.onerror=()=>{container.textContent='Your browser could not preview this format. Download the original to open it.'};container.append(element);
  }
}

function attachmentSelection(allFromSelectedMessages=false) {
  const result={};
  for(const m of messages) {
    const indices=m.attachments.map((_,i)=>i).filter(i=>allFromSelectedMessages?selectedMessages.has(m.id):selectedAttachments.has(attachmentKey(m.id,i)));
    if(indices.length)result[m.id]=indices;
  }
  return result;
}
function safeName(name) {
  let result=name.replace(/\\/g,'/').split('/').pop().replace(/[\x00-\x1f<>:"/\\|?*]/g,'_').replace(/[. ]+$/g,'').slice(0,150)||'attachment';
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result))result='_'+result;
  return result;
}
async function uniqueFile(directory,name) {
  const dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';
  for(let i=0;i<10000;i++) {
    const candidate=i?`${stem} (${i})${ext}`:name;
    try{await directory.getFileHandle(candidate)}catch(e){if(e.name==='NotFoundError')return directory.getFileHandle(candidate,{create:true});throw e}
  }
  throw Error('Too many duplicate filenames in the export folder.');
}
async function writeFile(handle,data) {
  const writer=await handle.createWritable();
  try{await writer.write(data);await writer.close()}catch(e){try{await writer.abort()}catch(ignore){}throw e}
}
async function exportAttachments(allFromMessages) {
  if(busy)return;const attachments=attachmentSelection(allFromMessages);
  const count=Object.values(attachments).reduce((sum,list)=>sum+list.length,0);
  if(!count){setStatus('No attachments in this selection.');return}
  let saved=0;
  try {
    if(window.showDirectoryPicker) {
      const root=await window.showDirectoryPicker({mode:'readwrite'});setBusy(true);
      for(const [id,indices] of Object.entries(attachments)) {
        const m=messages.find(x=>x.id===id),year=m.dateKey?.slice(0,4)||'Undated',month=m.dateKey?.slice(5,7)||'Unknown month';
        const yearFolder=await root.getDirectoryHandle(year,{create:true});
        const monthFolder=await yearFolder.getDirectoryHandle(month,{create:true});
        const folder=await monthFolder.getDirectoryHandle(safeName(`${m.dateKey||'undated'}_${m.subject.slice(0,55)}_${id}`),{create:true});
        for(const index of indices) {
          setStatus(`Exporting ${saved+1} of ${count} attachments…`);
          const response=await fetch(url(id,index));if(!response.ok)throw Error('An attachment is no longer available.');
          const file=await uniqueFile(folder,safeName(m.attachments[index].name));await writeFile(file,await response.blob());saved++;
        }
      }
      setStatus(`Exported ${saved} attachments to the chosen folder, organized by year/month/email. Existing files were kept.`);
    }else {
      setBusy(true);const response=await api('/export',{attachments});const blob=await response.blob(),href=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=href;link.download='Postbox-attachments.zip';link.click();setTimeout(()=>URL.revokeObjectURL(href),60000);
      setStatus(`Exported ${count} attachments as a ZIP. Extract it into your chosen folder.`);
    }
  }catch(e){if(e.name!=='AbortError')setStatus(`Export stopped after ${saved} attachments: ${e.message}`)}finally{setBusy(false)}
}

async function sha256(file) {const bytes=await file.arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')}
function decodeData(encoded) {return Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))}

async function connectOriginals(changes,action) {
  const missing=changes.filter(change=>{
    const info=sourceHandles.get(change.sourceId);
    return !info||(action==='messages'&&change.delete&&!info.parent);
  });
  if(missing.length) {
    if(!window.showDirectoryPicker)throw Error('This browser cannot edit original files. Open this localhost address in Chrome or Edge and choose the original folder, or explicitly choose "This session only". No files were deleted.');
    setReaderStatus('Choose the folder containing the original email files. Files will be checked before deletion.');
    const root=await window.showDirectoryPicker({mode:'readwrite'});
    const names=new Set(missing.map(change=>change.filename)),candidates=new Map();
    async function walk(directory) {
      for await(const entry of directory.values()) {
        if(entry.kind==='directory')await walk(entry);
        else if(names.has(entry.name)) {
          const list=candidates.get(entry.name)||[];list.push({handle:entry,parent:directory,name:entry.name});candidates.set(entry.name,list);
        }
      }
    }
    await walk(root);
    const resolved=[];
    for(const change of missing) {
      const matches=[],known=sourceHandles.get(change.sourceId);
      for(const candidate of candidates.get(change.filename)||[]) {
        if(known&&!await candidate.handle.isSameEntry(known.handle))continue;
        if(await sha256(await candidate.handle.getFile())===change.oldDigest)matches.push(candidate);
      }
      if(matches.length!==1)throw Error(matches.length>1?`More than one identical "${change.filename}" was found. Retry and choose its exact containing folder. No files were deleted.`:`Could not find the unchanged original "${change.filename}" in this folder. Choose its original folder, or reimport it if it was edited. No files were deleted.`);
      resolved.push([change.sourceId,matches[0]]);
    }
    for(const [sid,info] of resolved)sourceHandles.set(sid,info);
  }
  const seen=[];
  for(const change of changes) {
    const info=sourceHandles.get(change.sourceId);
    for(const previous of seen)if(await info.handle.isSameEntry(previous))throw Error('The same original file was imported more than once. Clear the session and open it once before deleting. No files were deleted.');
    seen.push(info.handle);
    const target=info.parent||info.handle;
    if(await target.requestPermission({mode:'readwrite'})!=='granted')throw Error('Write permission was not granted. No files were deleted.');
  }
}

async function deleteSelected(action, messageIds=null) {
  if(busy)return;
  const attachments=attachmentSelection(false),ids=action==='messages'?(messageIds??[...selectedMessages]):Object.keys(attachments);
  if(!ids.length)return;
  const originals=$('deleteMode').value==='originals';
  const previousIds=filteredMessages().map(m=>m.id),previousReader=selected;
  const currentMessage=messageIds&&messages.find(m=>m.id===ids[0]);
  const amount=currentMessage?`this email: "${currentMessage.subject}" and all its embedded attachments`:action==='messages'?`${ids.length} selected email(s) and all their embedded attachments`:`${Object.values(attachments).reduce((sum,x)=>sum+x.length,0)} selected attachment(s)`;
  const description=originals?'This permanently deletes .eml files or rewrites .eml/MBOX files on disk. Removing an attachment changes its source email. Separately saved attachments are unaffected.':'This removes items only from this session; files on disk stay unchanged.';
  if(!confirm(`Delete ${amount}?\n\n${description}\n\nThis cannot be undone in Postbox.`)){setReaderStatus('Deletion cancelled. No files were changed.');return}
  let completed=0,committed=0,resultText='',failed=false;
  setBusy(true);setReaderStatus('Preparing deletion…');
  try {
    const plan=await (await api('/plan',{action,messageIds:ids,attachments})).json();
    if(originals)await connectOriginals(plan.changes,action);
    // Check every source before the first disk mutation, then check it again
    // immediately before its write/delete in case another application edits it.
    if(originals)for(const change of plan.changes) {
      const file=await sourceHandles.get(change.sourceId).handle.getFile();
      if(await sha256(file)!==change.oldDigest)throw Error(`${change.filename} changed since import. Reimport it before deleting.`);
    }
    for(const change of plan.changes) {
      if(originals) {
        const info=sourceHandles.get(change.sourceId),current=await info.handle.getFile();
        if(await sha256(current)!==change.oldDigest)throw Error(`${change.filename} changed since import. Reimport it before deleting.`);
        if(change.delete) {
          const entry=await info.parent.getFileHandle(info.name);
          if(!await entry.isSameEntry(info.handle))throw Error('The source entry changed. Reimport it before deleting.');
          await info.parent.removeEntry(info.name);
        }else {await writeFile(info.handle,decodeData(change.data))}
        completed++;
      }
      const result=await (await api('/commit',{planId:plan.planId,sourceId:change.sourceId})).json();
      committed++;
      const old=new Set(result.removedIds);messages=messages.filter(m=>!old.has(m.id));messages.push(...result.messages);
      if(!originals||change.delete)sourceHandles.delete(change.sourceId);
    }
    resultText=currentMessage?`Deleted "${currentMessage.subject}" and its embedded attachments${originals?' from the original file':' from this session'}.`:`Deletion complete for ${committed} source file(s)${originals?' on disk':' in this session'}.`;
  }catch(e) {
    failed=e.name!=='AbortError';
    resultText=e.name==='AbortError'?'Deletion cancelled. No further files were changed.':`Deletion stopped: ${e.message} ${committed} source(s) completed.${completed>committed?' A disk change completed before the session update failed; reimport that source.':''}`;
  }finally {
    if(messageIds) {
      const remaining=new Set(messages.map(m=>m.id));
      for(const id of selectedMessages)if(!remaining.has(id))selectedMessages.delete(id);
      for(const key of selectedAttachments)if(!remaining.has(key.split(':')[0]))selectedAttachments.delete(key);
    }else {selectedMessages.clear();selectedAttachments.clear()}
    const current=messages.find(m=>m.id===selected);
    const next=!current&&action==='messages'?nextAfterDeletion(previousIds,previousReader,filteredMessages()):null;
    if(current)show(current);else if(next){
      if(next.dateKey){expanded.set(next.dateKey.slice(0,4),true);expanded.set(next.dateKey.slice(0,7),true)}
      show(next);
    }else resetReader();
    render();setBusy(false);setReaderStatus(resultText,failed);
  }
}

function init() {
  $('open').onclick=openFiles;$('folder').onclick=openFolder;$('uploadFolder').onclick=()=>$('folders').click();
  $('files').onchange=e=>loadFiles(e.target.files);$('folders').onchange=e=>loadFiles(e.target.files);
  for(const id of ['search','dateFrom','dateTo','groupBy'])$(id).addEventListener('input',()=>{lastChecked=null;render()});
  $('resetFilters').onclick=()=>{$('search').value='';$('dateFrom').value='';$('dateTo').value='';render()};
  $('selectVisible').onclick=()=>{filteredMessages().forEach(m=>selectedMessages.add(m.id));render()};
  $('deselect').onclick=()=>{selectedMessages.clear();selectedAttachments.clear();render();const m=messages.find(m=>m.id===selected);if(m)renderAttachments(m)};
  $('selectMessageAttachments').onclick=()=>{for(const m of messages)if(selectedMessages.has(m.id))m.attachments.forEach((_,i)=>selectedAttachments.add(attachmentKey(m.id,i)));const m=messages.find(m=>m.id===selected);if(m)renderAttachments(m);updateSelectionCount()};
  $('selectCurrentAttachments').onclick=()=>{const m=messages.find(m=>m.id===selected);if(m){m.attachments.forEach((_,i)=>selectedAttachments.add(attachmentKey(m.id,i)));renderAttachments(m);updateSelectionCount()}};
  $('deselectAttachments').onclick=()=>{selectedAttachments.clear();const m=messages.find(m=>m.id===selected);if(m)renderAttachments(m);updateSelectionCount()};
  $('deleteMessages').onclick=()=>deleteSelected('messages');$('deleteAttachments').onclick=()=>deleteSelected('attachments');
  $('deleteCurrent').onclick=()=>{if(selected)return deleteSelected('messages',[selected])};
  $('nextEmail').onclick=()=>{
    if(busy||!selected)return;
    const visible=filteredMessages(),index=visible.findIndex(m=>m.id===selected),next=visible[index+1];
    if(next){
      if(next.dateKey){expanded.set(next.dateKey.slice(0,4),true);expanded.set(next.dateKey.slice(0,7),true)}
      show(next);
    }
  };
  $('deleteMode').addEventListener('change',updateSelectionCount);
  $('exportMessages').onclick=()=>exportAttachments(true);$('exportAttachments').onclick=()=>exportAttachments(false);
  $('textTab').onclick=()=>setView(false);$('htmlTab').onclick=()=>setView(true);
  $('previewClose').onclick=()=>$('previewDialog').close();$('previewDialog').addEventListener('close',()=>{previewRequest++;$('previewContent').replaceChildren()});
  $('clear').onclick=async()=>{
    if(busy)return;setBusy(true);
    try{await api('/clear',{});messages=[];selectedMessages.clear();selectedAttachments.clear();sourceHandles.clear();expanded.clear();resetReader();render();setStatus('Session cleared. Files on disk were kept.')}catch(e){setStatus(e.message)}finally{setBusy(false)}
  };
  document.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drag')});
  document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('drag')});
  document.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drag');loadFiles(e.dataTransfer.files)});
  if(!window.showDirectoryPicker)$('folder').textContent='Import folder';
  render();
}
if(typeof document!=='undefined')init();
if(typeof module!=='undefined')module.exports={matchesQuery,filterMessages,safeName,attachmentSelection,nextAfterDeletion};
