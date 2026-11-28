// REUNITE FRONT-END GUIDE
// This file connects HTML pages to the Express API and adds page interactions.
// Tip: search for "function init" to find the setup function for a particular page.
// Shared helpers (API, URL query, safe text) are at the top; page-specific code follows.

// Shared helpers: API request, URL parameters, safe text and HTML escaping.
async function loadMe(){const r=await fetch('/api/me');if(!r.ok)throw new Error('Not logged in');return r.json();}
function q(name){return new URLSearchParams(location.search).get(name);}
function getPublicQrTarget(qr){return '/public-pet.html?qr='+encodeURIComponent(qr);}
function setText(s,v){const e=document.querySelector(s);if(e)e.textContent=v??'';}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
// Referral page: pre-fills the referral answer for the signed-in user.
async function initSuggestedBy(){try{const{user}=await loadMe();const input=document.querySelector('[name=suggested_by]');if(input)input.value=user.suggested_by||'';}catch{location.href='/login.html';}}
// Home dashboard: loads the user greeting and pet count.
async function initHome(){try{const{user,pets}=await loadMe();setText('[data-user-name]',user.first_name);setText('[data-pet-count]',pets.length);setText('[data-avatar]',((user.first_name[0]||'')+(user.last_name[0]||'')).toUpperCase());}catch{location.href='/login.html';}}
// Pet hub: renders My Pets, Community Pets, and Memory Pets lists.
async function initPets(){try{const{pets,communityPets=[],memorials=[]}=await loadMe(),list=document.querySelector('[data-pet-list]'),empty=document.querySelector('[data-empty-pets]'),communityList=document.querySelector('[data-community-pet-list]'),emptyCommunity=document.querySelector('[data-empty-community]');list.innerHTML='';if(!pets.length){empty.hidden=false}else{empty.hidden=true;pets.forEach(p=>{const a=document.createElement('a');a.className='pet-card';a.href='/pet-details.html?id='+p.id;a.innerHTML=`<div class="pet-photo">${p.photo_url?`<img src="${esc(p.photo_url)}" alt="">`:'🐾'}</div><div class="pet-card-info"><h3>${esc(p.name)}</h3><p>${esc(p.pet_type||'Dog')}${p.breed?' · '+esc(p.breed):''}</p><span class="status ${p.status==='lost'?'status-lost':'status-safe'}">${p.status==='lost'?'LOST':'SAFE'}</span></div><span class="arrow">→</span>`;list.appendChild(a);});}if(communityList){communityList.innerHTML='';if(!communityPets.length){emptyCommunity.hidden=false}else{emptyCommunity.hidden=true;communityPets.forEach(p=>{const a=document.createElement('a');a.className='pet-card';a.href='/community-pet-details.html?id='+p.id;a.innerHTML=`<div class="pet-photo">${p.photo_url?`<img src="${esc(p.photo_url)}" alt="">`:'🐾'}</div><div class="pet-card-info"><h3>${esc(p.name)}</h3><p>${esc(p.pet_type||'Animal')} · ${esc(p.usual_location||'Location not added')}</p><span class="status status-safe">COMMUNITY PET</span></div><span class="arrow">→</span>`;communityList.appendChild(a);});}}const memorialList=document.querySelector('[data-memorial-list]'),emptyMemorials=document.querySelector('[data-empty-memorials]');if(memorialList){memorialList.innerHTML='';if(!memorials.length){emptyMemorials.hidden=false}else{emptyMemorials.hidden=true;memorials.forEach(m=>{const a=document.createElement('a');a.className='pet-card memorial-pet-card';a.href='/memorial-details.html?id='+m.id;a.innerHTML=`<div class="pet-photo memorial-photo">${m.photo_url?`<img src="${esc(m.photo_url)}" alt="">`:'🕊️'}</div><div class="pet-card-info"><h3>${esc(m.name)}</h3><p>${esc(m.pet_type||'Beloved pet')} · Remembered with love</p><span class="status status-memorial">MEMORIAL</span></div><span class="arrow">→</span>`;memorialList.appendChild(a);});}}}catch{location.href='/login.html';}}
// Account page: displays account details and admin link visibility.
async function initAccount(){try{const{user,is_admin}=await loadMe();const adminLink=document.querySelector('[data-admin-link]');if(adminLink)adminLink.hidden=!is_admin;setText('[data-account-name]',user.first_name+' '+user.last_name);setText('[data-account-email]',user.email);setText('[data-account-avatar]',((user.first_name[0]||'')+(user.last_name[0]||'')).toUpperCase());}catch{location.href='/login.html';}}
// Edit-user page: fills the form with saved account details.
async function initEditUser(){try{const{user}=await loadMe();document.querySelector('[name=first_name]').value=user.first_name||'';document.querySelector('[name=last_name]').value=user.last_name||'';document.querySelector('[name=email]').value=user.email||'';const stateSel=document.querySelector('#state-code'),citySel=document.querySelector('#city-select'),otherCity=document.querySelector('#city-other');const known=[...stateSel.options].some(o=>o.value&&o.value===user.state_code);if(window.initStateDistrict)await window.initStateDistrict({state:stateSel,city:citySel,other:otherCity,initialCity:''}).then(h=>h&&h.set(known?user.state_code:'',user.city||''));}catch{location.href='/login.html';}}
// Owned-pet details: displays profile, QR code, lost status, and actions.
async function initPetDetails(){try{const id=q('id');if(!id)throw Error();const r=await fetch('/api/pets/'+encodeURIComponent(id));if(!r.ok)throw Error();const p=await r.json();setText('[data-pet-name]',p.name);const ownerPhoto=document.querySelector('[data-pet-photo]');if(ownerPhoto){const photos=p.photo_urls?.length?p.photo_urls:(p.photo_url?[p.photo_url]:[]);ownerPhoto.classList.toggle('pet-photo-gallery',photos.length>1);ownerPhoto.innerHTML=photos.length?photos.map((src,i)=>`<img src="${esc(src)}" alt="${esc(p.name)} photo ${i+1}" loading="lazy">`).join(''):'🐶';}setText('[data-pet-summary]',`${p.pet_type||'Dog'} · ${p.breed||'Breed not added'} · ${p.year_acquired?'Acquired '+p.year_acquired:'Year acquired not added'} · ${p.gender||'Gender not added'}`);setText('[data-qr-id]',p.qr_id);setText('[data-breed]',p.pet_type ? (p.breed ? p.pet_type+' · '+p.breed : p.pet_type) : (p.breed||'—'));setText('[data-age]',p.year_acquired||'—');setText('[data-gender]',p.gender||'—');setText('[data-identifying]',p.identifying_info||'—');setText('[data-med-allergies]',p.allergies||'Not specified');setText('[data-med-medications]',p.medications||'Not specified');setText('[data-med-vax]',p.vaccination_status||'Unknown');setText('[data-med-rabies]',p.rabies_status||'Unknown');setText('[data-med-vet]',p.vet_contact||'Not provided');setText('[data-med-temperament]',p.temperament||'Not specified');const status=document.querySelector('[data-status]');status.textContent=p.status==='lost'?'● LOST':'● SAFE';status.className='status '+(p.status==='lost'?'status-lost':'status-safe');const lost=document.querySelector('[data-lost-info]');if(lost)lost.hidden=p.is_community||p.status!=='lost';if(lost&&p.status==='lost')lost.innerHTML=`<div class="detail-row"><span>Date Lost</span><strong>${esc(p.lost_date||'—')}</strong></div><div class="detail-row"><span>Time</span><strong>${esc(p.lost_time||'—')}</strong></div><div class="detail-row"><span>Last Seen</span><strong>${esc(p.last_seen_location||'—')}</strong></div><div class="detail-row"><span>Additional Info</span><strong>${esc(p.lost_info||'—')}</strong></div>`;const qrImg=document.querySelector('[data-qr-image]');if(qrImg)qrImg.src='/api/pets/'+p.id+'/qr';const qrNote=document.querySelector('[data-qr-url]');if(qrNote){qrNote.textContent=p.qr_url?'This QR opens: '+p.qr_url+(p.qr_is_local_only?'  ⚠ No Wi-Fi address was found, so only this computer can open it.':''):'';qrNote.classList.toggle('qr-warn',!!p.qr_is_local_only);}const qrDownload=document.querySelector('[data-qr-download]');if(qrDownload){qrDownload.href='/api/pets/'+p.id+'/qr';qrDownload.textContent='Download QR (SVG)';}const printLink=document.querySelector('[data-qr-print]');if(printLink)printLink.href='/qr-print.html?id='+p.id;const adoptionForm=document.querySelector('[data-adoption-form]');if(adoptionForm){adoptionForm.action='/pets/'+p.id+'/adoption';adoptionForm.elements.available.value=p.available_for_adoption?'1':'0';if(adoptionForm.elements.description)adoptionForm.elements.description.value=p.adoption_description||'';}const qrReissue=document.querySelector('[data-reissue-qr]');if(qrReissue)qrReissue.action='/pets/'+p.id+'/reissue-qr';const lostLink=document.querySelector('[data-lost-link]');if(lostLink)lostLink.href='/lost-pet.html?id='+p.id;const edit=document.querySelector('[data-edit-pet]');if(edit)edit.href='/edit-pet.html?id='+p.id;const found=document.querySelector('[data-found-form]');if(found){found.action='/pets/'+p.id+'/found';found.hidden=p.status!=='lost';}const deleteForm=document.querySelector('[data-delete-pet]');if(deleteForm)deleteForm.action='/pets/'+p.id+'/delete';const commentsPanel=document.querySelector('[data-owner-comments]');if(commentsPanel){const reviewList=commentsPanel.querySelector('[data-owner-review-list]');try{const rr=await fetch('/api/pets/'+p.id+'/reviews',{cache:'no-store'});const dd=await rr.json();if(!rr.ok)throw Error(dd.error||'Could not load comments.');renderOwnerComments(reviewList,dd.reviews||[]);}catch(e){reviewList.textContent=e.message;}}}catch{location.href='/pet.html';}}
// Edit-pet page: loads existing details into the edit form.
async function initEditPet(){try{const id=q('id');const r=await fetch('/api/pets/'+encodeURIComponent(id));if(!r.ok)throw Error();const p=await r.json();const form=document.querySelector('form');document.querySelector('[name=name]').value=p.name||'';setPetTypeValue(form,p.pet_type||'Dog');document.querySelector('[name=breed]').value=p.breed||'';document.querySelector('[name=year_acquired]').value=p.year_acquired||'';document.querySelector('[name=gender]').value=p.gender||'Male';document.querySelector('[name=identifying_info]').value=p.identifying_info||'';for(const k of ['allergies','medications','vaccination_status','rabies_status','vet_contact','temperament'])if(document.querySelector('[name='+k+']'))document.querySelector('[name='+k+']').value=p[k]||'';form.action='/pets/'+p.id+'/update';if(window.__petPhotoGrid)window.__petPhotoGrid.setExisting(p.photo_urls?.length?p.photo_urls:(p.photo_url?[p.photo_url]:[]));}catch{location.href='/pet.html';}}
// Lost-pet form: connects the form to the selected pet.
async function initLost(){try{const id=q('id');const r=await fetch('/api/pets/'+encodeURIComponent(id));if(!r.ok)throw Error();const p=await r.json();setText('[data-lost-pet-name]',p.name);const f=document.querySelector('form');f.action='/pets/'+p.id+'/lost';}catch{location.href='/pet.html';}}
// Resize an image file in the browser (max 1200px) and return a JPEG data URL.
function resizeImageFile(file){return new Promise((resolve,reject)=>{const img=new Image(),reader=new FileReader();reader.onload=()=>{img.onload=()=>{const max=1200,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.78));};img.onerror=reject;img.src=reader.result;};reader.onerror=reject;reader.readAsDataURL(file);});}

// Photo helper for single-photo forms (community pet, memorial): validates, resizes, and previews one uploaded image.
function initPhotoUpload(){
  if(document.querySelector('[data-photo-grid]'))return; // pet forms use the multi-photo grid below
  const input=document.querySelector('#pet-photo-input'), hidden=document.querySelector('[data-photo-data]'), preview=document.querySelector('[data-photo-preview]'), multi=document.querySelector('#photo-data-list');
  if(!input||!hidden||!preview)return;
  input.addEventListener('change',async()=>{const files=[...(input.files||[])];if(!files.length)return;if(files.length>9||files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){alert('Choose up to 9 JPG, PNG or WebP images, each under 5 MB.');input.value='';hidden.value='';if(multi)multi.value='[]';preview.textContent='📷';return;}
    try{const data=await Promise.all(files.map(resizeImageFile));hidden.value=data[0]||'';if(multi)multi.value=JSON.stringify(data.slice(1));preview.innerHTML=data.map((d,i)=>`<img src="${d}" alt="Pet photo ${i+1}" title="Photo ${i+1}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;margin:3px">`).join('');}catch{hidden.value='';if(multi)multi.value='[]';input.value='';preview.textContent='📷';alert('Could not read one of the selected photos. Please choose the images again.');}
  });
}

// Multi-photo grid for Add Pet / Edit Pet: every photo is a tile (with a remove button) and a "+" tile
// appears after it so more photos can be added, up to 9. Saved photos (edit page) and new photos are kept apart:
//   keep_photos = saved photos to keep, photo_data + photo_data_list = newly added photos.
function initPetPhotoGrid(){
  const grid=document.querySelector('[data-photo-grid]'); if(!grid)return;
  const input=document.querySelector('#pet-photo-input'), hidden=document.querySelector('[data-photo-data]'), multi=document.querySelector('#photo-data-list'), keepField=document.querySelector('#keep-photos'), hint=document.querySelector('[data-photo-hint]'), form=grid.closest('form');
  if(!input||!hidden||!multi)return;
  const MAX=Number(grid.dataset.max)||9, ALLOWED=['image/jpeg','image/png','image/webp'], defaultHint=hint?hint.textContent:'';
  let existing=[], fresh=[], busy=0;
  function sync(){hidden.value=fresh[0]||'';multi.value=JSON.stringify(fresh.slice(1));if(keepField)keepField.value=JSON.stringify(existing);const n=existing.length+fresh.length;if(hint)hint.textContent=n?`${n} of ${MAX} photos • the first photo is the main one • tap × to remove`:defaultHint;}
  function render(){
    grid.innerHTML='';
    const items=[...existing.map((src,i)=>({src,kind:'saved',i})),...fresh.map((src,i)=>({src,kind:'new',i}))];
    items.forEach((it,idx)=>{
      const tile=document.createElement('div');tile.className='photo-tile';
      const img=document.createElement('img');img.src=it.src;img.alt='Pet photo '+(idx+1);
      const rm=document.createElement('button');rm.type='button';rm.className='photo-remove';rm.setAttribute('aria-label','Remove photo '+(idx+1));rm.textContent='×';
      rm.addEventListener('click',()=>{if(it.kind==='saved')existing.splice(it.i,1);else fresh.splice(it.i,1);render();});
      tile.append(img,rm);
      if(idx===0){const b=document.createElement('span');b.className='photo-main-badge';b.textContent='Main';tile.appendChild(b);}
      grid.appendChild(tile);
    });
    if(items.length<MAX){
      const add=document.createElement('button');add.type='button';add.className='photo-add'+(items.length?'':' photo-add-first');
      add.setAttribute('aria-label',items.length?'Add another photo':'Upload pet photo');
      add.innerHTML=items.length?'<span class="photo-add-plus">+</span><small>Add more</small>':'<span class="photo-add-plus">📷</span><strong>Upload pet photo</strong><small>JPG, PNG or WebP</small>';
      add.addEventListener('click',()=>input.click());
      grid.appendChild(add);
    }
    sync();
  }
  input.addEventListener('change',async()=>{
    const files=[...(input.files||[])];input.value='';if(!files.length)return;
    const room=MAX-existing.length-fresh.length, notes=[];
    const bad=files.filter(f=>!ALLOWED.includes(f.type)||f.size>5*1024*1024);
    let good=files.filter(f=>!bad.includes(f));
    if(bad.length)notes.push(`${bad.length} file(s) skipped: only JPG, PNG or WebP images under 5 MB are allowed.`);
    if(good.length>room){notes.push(`A pet can have up to ${MAX} photos, so ${good.length-room} photo(s) were skipped.`);good=good.slice(0,room);}
    if(notes.length)alert(notes.join('\n'));
    if(!good.length)return;
    busy++;if(hint)hint.textContent='Preparing photos…';
    try{fresh.push(...await Promise.all(good.map(resizeImageFile)));}
    catch{alert('Could not read one of the selected photos. Please try again.');}
    finally{busy--;render();}
  });
  if(form)form.addEventListener('submit',e=>{if(busy){e.preventDefault();alert('Photos are still being prepared. Please wait a moment and press Save again.');}});
  window.__petPhotoGrid={setExisting(urls){existing=[...(urls||[])].filter(Boolean);render();}};
  render();
}


// Community-pet details: loads profile, QR code, and edit form.
function renderOwnerComments(container,rows){if(!container)return;container.innerHTML='';if(!rows.length){container.innerHTML='<p class="muted">No comments yet.</p>';return;}rows.forEach(item=>{const article=document.createElement('article');article.className='review-item';article.innerHTML=`<div class="review-meta"><strong>${esc(item.member_name)}</strong><small>${esc(new Date(item.updated_at||item.created_at).toLocaleDateString())}</small></div><p>${esc(item.body)}</p>`;container.appendChild(article);});}
async function initCommunityPetDetails(){try{const id=q('id');if(!id)throw Error();const r=await fetch('/api/community-pets/'+encodeURIComponent(id));if(!r.ok)throw Error();const p=await r.json();setText('[data-community-name]',p.name);setText('[data-community-summary]',`${p.pet_type||'Animal'} · Usually seen: ${p.usual_location||'—'}`);const photo=document.querySelector('[data-community-photo]');if(photo)photo.innerHTML=p.photo_url?`<img src="${esc(p.photo_url)}" alt="${esc(p.name)}">`:'🐾';const qr='/api/community-pets/'+p.id+'/qr';document.querySelector('[data-community-qr]').src=qr;document.querySelector('[data-community-qr-download]').href=qr;setText('[data-qr-url]',p.qr_url?'This QR opens: '+p.qr_url:'');const health=document.querySelector('[data-health-log]');if(health)health.action='/community-pets/'+p.id+'/health-log';const history=document.querySelector('[data-health-history]');if(history)history.innerHTML=(p.health_logs||[]).map(x=>`<p><b>${esc(x.date)} · ${esc(x.type)}</b><br>${esc(x.notes||'')}</p>`).join('')||'<p class="muted">No health logs yet.</p>';const form=document.querySelector('[data-community-edit-form]');form.action='/community-pets/'+p.id+'/update';form.elements.name.value=p.name;setPetTypeValue(form,p.pet_type||'Dog');form.elements.usual_location.value=p.usual_location||'';const comments=document.querySelector('[data-community-owner-comments] [data-community-owner-review-list]');if(comments){const cr=await fetch('/api/pets/'+p.id+'/reviews',{cache:'no-store'});const cd=await cr.json();if(!cr.ok)throw Error(cd.error||'Could not load comments.');renderOwnerComments(comments,cd.reviews||[]);}}catch{location.href='/pet.html';}}
// Pet form helper: shows the custom type field when “Others” is selected.
const PET_TYPE_LIST=['Dog','Cat','Horse','Goat','Cow'];
// Shows the "Which animal is it?" box only when "Other" is selected.
function syncPetTypeOther(select){const form=select.closest('form'),input=form&&form.querySelector('[name=other_pet_type]');if(!input)return;const group=input.closest('[data-other-type]')||input,on=select.value==='Other';group.hidden=!on;input.required=on;if(!on)input.value='';}
// Used by edit pages: pick the matching type, or "Other" + the saved custom name (e.g. an old Bird/Fish/Turtle pet).
function setPetTypeValue(form,type){const select=form&&form.querySelector('[name=pet_type]');if(!select)return;const input=form.querySelector('[name=other_pet_type]'),known=PET_TYPE_LIST.find(t=>t.toLowerCase()===String(type||'Dog').toLowerCase());select.value=known||'Other';syncPetTypeOther(select);if(!known&&input&&!/^others?$/i.test(String(type||'')))input.value=String(type||'');}
function initPetTypeOther(){document.querySelectorAll('select[name=pet_type]').forEach(select=>{syncPetTypeOther(select);select.addEventListener('change',()=>{syncPetTypeOther(select);const i=select.closest('form')?.querySelector('[name=other_pet_type]');if(select.value==='Other'&&i)i.focus();});});}


// Reports page: loads lost/reunited reports and displays the report cards.
async function initReports(){
  const list=document.querySelector('[data-reports-list]'), empty=document.querySelector('[data-reports-empty]');
  let reports={lost:[],saved:[]}, active='lost';
  const fmtDate=v=>{if(!v)return 'Date not provided';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});};
  function render(){
    const rows=reports[active]||[]; document.querySelectorAll('[data-report-tab]').forEach(b=>{const on=b.dataset.reportTab===active;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
    list.innerHTML=''; empty.hidden=rows.length>0;
    if(!rows.length){document.querySelector('[data-empty-title]').textContent=active==='lost'?'No lost pets reported':'No reunited pets reported yet';document.querySelector('[data-empty-copy]').textContent=active==='lost'?'There are no lost pets listed right now. If you see a lost pet, please help by checking its QR or sharing this page.':'When a family marks a lost pet as safely found, it will appear here to celebrate the reunion.';return;}
    rows.forEach(p=>{const card=document.createElement('article');card.className='report-card';const isLost=active==='lost';card.innerHTML=`<div class="report-photo">${p.photo_url?`<img src="${esc(p.photo_url)}" alt="Photo of ${esc(p.name)}" loading="lazy">`:'🐾'}</div><div class="report-card-body"><div class="report-card-top"><span class="status ${isLost?'status-lost':'status-safe'}">${isLost?'LOST':'REUNITED / SAFE'}</span><small>${isLost?'Reported':'Reunited'} ${fmtDate(isLost?(p.lost_reported_at||p.lost_date):(p.reunited_at))}</small></div><h2>${esc(p.name)}</h2><p class="report-type">${esc(p.pet_type||'Pet')}${p.breed?' · '+esc(p.breed):''}</p>${isLost?`<div class="report-detail"><b>Last seen</b><span>${esc(p.last_seen_location||'Location not provided')}</span></div>${p.lost_date?`<div class="report-detail"><b>Date lost</b><span>${esc(p.lost_date)}${p.lost_time?' · '+esc(p.lost_time):''}</span></div>`:''}${p.lost_info?`<p class="report-description">${esc(p.lost_info)}</p>`:''}`:`<p class="report-description">This pet has been marked safely found by their family. Thank you to everyone who helped.</p>`}<p class="report-contact-note">${isLost?'🔒 Reports are view-only. To contact the owner, scan this pet’s physical ReUnite QR code.':'💛 This pet has been marked safe by their family.'}</p></div>`;list.appendChild(card);});
  }
  document.querySelectorAll('[data-report-tab]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.reportTab;render();}));
  try{const r=await fetch('/api/reports',{cache:'no-store'});if(!r.ok)throw Error('Could not load reports');reports=await r.json();document.querySelector('[data-lost-count]').textContent=reports.lost.length;document.querySelector('[data-saved-count]').textContent=reports.saved.length;render();}
  catch{list.innerHTML='<div class="empty-state"><h2>Reports could not load</h2><p class="muted">Please refresh the page and try again.</p></div>';empty.hidden=true;}
}

document.addEventListener('DOMContentLoaded',()=>{const p=document.body.dataset.page;initPetPhotoGrid();initPetTypeOther();if(p==='public-pet')initPublicPet();if(p==='adoption')initAdoption();if(p==='lost-pets')initLostPets();if(p==='suggested-by')initSuggestedBy();if(p==='home')initHome();if(p==='reports')initReports();if(p==='pets')initPets();if(p==='memorial-details')initMemorialDetails();if(p==='community-pet-details')initCommunityPetDetails();if(p==='account')initAccount();if(p==='edit-user')initEditUser();if(p==='pet-details')initPetDetails();if(p==='edit-pet')initEditPet();if(p==='lost-pet')initLost();if(p==='admin')initAdmin();initPhotoUpload();});

// Public QR page: shows the pet profile returned for a scanned QR code.
async function initPublicPet(){
  try{
    const qr=q('qr'); if(!qr)throw Error();
    const r=await fetch('/api/public-pets/'+encodeURIComponent(qr),{cache:'no-store'});
    if(!r.ok){let detail='Pet profile could not be loaded.';try{const problem=await r.json();detail=problem.error||detail;}catch{}throw Error(detail);}
    const p=await r.json();
    const publicPhoto=document.querySelector('[data-public-photo]'); if(publicPhoto){const photos=p.photo_urls?.length?p.photo_urls:(p.photo_url?[p.photo_url]:[]);publicPhoto.classList.toggle('pet-photo-gallery',photos.length>1);publicPhoto.innerHTML=photos.length?photos.map((src,i)=>`<img src="${esc(src)}" alt="${esc(p.name)} photo ${i+1}" loading="lazy">`).join(''):'🐶';}
    setText('[data-public-name]',p.name);const communityHealth=document.querySelector('[data-community-health]');if(communityHealth&&p.is_community){communityHealth.hidden=false;const h=communityHealth.querySelector('[data-community-health-list]');h.innerHTML=(p.health_logs||[]).map(x=>`<p><b>${esc(x.date)} · ${esc(x.type)}</b><br>${esc(x.notes||'')}</p>`).join('')||'<p class="muted">No community care records yet.</p>';}const city=document.querySelector('[data-owner-city]');if(city)city.textContent=p.owner_city?'Owner city: '+p.owner_city:'';const medical=document.querySelector('[data-medical-strip]');if(medical&&!p.is_community){medical.hidden=false;medical.innerHTML=`<h3>🚨 Emergency Medical & Temperament</h3><p><b>Allergies:</b> ${esc(p.allergies||'Not specified')}</p><p><b>Medications:</b> ${esc(p.medications||'Not specified')}</p><p><b>Vaccination:</b> ${esc(p.vaccination_status||'Unknown')} · <b>Rabies:</b> ${esc(p.rabies_status||'Unknown')}</p><p><b>Vet:</b> ${esc(p.vet_contact||'Not provided')}</p><p><b>Temperament:</b> ${esc(p.temperament||'Not specified')}</p>`;}const vet=document.querySelector('[data-emergency-vet]');if(vet)vet.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('veterinary clinic near '+(p.owner_city||'me'));const language=document.querySelector('[data-language]');if(language)language.addEventListener('change',()=>{const hi=language.value==='hi';document.querySelector('[data-language-help]').textContent=hi?'कृपया शांत रहें। जानवर को धीरे से पास आएँ, उसे दौड़ाएँ या डराएँ नहीं। आपात स्थिति में नज़दीकी पशु चिकित्सक से संपर्क करें।':'Stay calm. Approach slowly and do not chase or frighten the animal. Contact a nearby veterinarian in an emergency.';});
    setText('[data-public-summary]',p.is_community?`${p.pet_type||'Animal'} · Community Pet`:`${p.pet_type||'Dog'} · ${p.breed||'Breed not added'} · ${p.year_acquired?'Acquired '+p.year_acquired:'Year acquired not added'} · ${p.gender||'Gender not added'}`);
    setText('[data-public-breed]',p.is_community?(p.pet_type||'Animal'):(p.breed||'—'));
    setText('[data-public-age]',p.is_community?(p.usual_location||'—'):(p.year_acquired||'—'));
    setText('[data-public-gender]',p.is_community?'Community animal':(p.gender||'—'));
    setText('[data-public-identifying]',p.is_community?'Known by this local name; no owner/contact details are shown.':(p.identifying_info||'—'));
    const detailCard=document.querySelector('[data-public-details-card]'); if(detailCard)detailCard.querySelectorAll('[data-owned-only]').forEach(el=>el.hidden=!!p.is_community);
    if(p.is_community){const status=document.querySelector('[data-public-status]');status.textContent='● COMMUNITY PET';status.className='status status-safe';}
    const st=document.querySelector('[data-public-status]');
    st.textContent=p.is_community?'● COMMUNITY PET':(p.status==='lost'?'● LOST':'● SAFE');
    st.className='status '+(p.status==='lost'&&!p.is_community?'status-lost':'status-safe');
    const ageLabel=document.querySelector('[data-age-label]');if(ageLabel)ageLabel.textContent=p.is_community?'Usually seen near':'Year Acquired';
    const typeLabel=document.querySelector('[data-type-label]');if(typeLabel)typeLabel.textContent=p.is_community?'Pet type':'Breed / Type';
    const identifyingLabel=document.querySelector('[data-identifying-label]');if(identifyingLabel)identifyingLabel.textContent=p.is_community?'About':'Identifying Info';
    const lost=document.querySelector('[data-public-lost]');
    if(lost)lost.hidden=p.is_community||p.status!=='lost';
    if(lost&&p.status==='lost')lost.innerHTML=`<div class="detail-row"><span>Date Lost</span><strong>${esc(p.lost_date||'—')}</strong></div><div class="detail-row"><span>Approx. Time</span><strong>${esc(p.lost_time||'—')}</strong></div><div class="detail-row"><span>Last Seen</span><strong>${esc(p.last_seen_location||'—')}</strong></div><div class="detail-row"><span>Additional Info</span><strong>${esc(p.lost_info||'—')}</strong></div>`;
    const chat=document.querySelector('[data-public-chat]');
    if(chat)chat.hidden=!!p.is_community||p.status!=='lost';
    if(!p.is_community&&p.status==='lost') initPublicChat(qr);
    initPetReviews(qr);
  }catch(error){setText('[data-public-name]','Pet profile unavailable');setText('[data-public-error]',error?.message||'Could not load this pet profile. Check that the phone is connected to the same Wi-Fi and try again.');}
}

// Public pet reviews: readable by everyone; posting/editing requires a ReUnite account.
async function initPetReviews(qr){
  const section=document.querySelector('[data-pet-reviews]');if(!section)return;section.hidden=false;
  const list=section.querySelector('[data-review-list]'),form=section.querySelector('[data-review-form]'),login=section.querySelector('[data-review-login]'),error=section.querySelector('[data-review-error]'),textarea=section.querySelector('textarea');
  let mine=null;
  const dateLabel=v=>{try{return new Date(v).toLocaleDateString([], {dateStyle:'medium'});}catch{return '';}};
  async function refresh(){
    const r=await fetch('/api/public-pets/'+encodeURIComponent(qr)+'/reviews',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Could not load comments.');mine=data.mine;
    section.hidden=false;
    list.innerHTML='';
    if(!(data.reviews||[]).length)list.innerHTML='<p class="muted">No comments yet. Be the first to appreciate this pet!</p>';
    (data.reviews||[]).forEach(review=>{const item=document.createElement('article');item.className='review-item';const own=mine&&mine.id===review.id;item.innerHTML=`<div class="review-meta"><strong>${esc(review.member_name)}</strong><small>${esc(dateLabel(review.updated_at||review.created_at))}${review.updated_at?' · edited':''}</small></div><p>${esc(review.body)}</p><div class="review-actions">${own?'<button type="button" class="btn btn-secondary btn-small" data-edit-review>Edit my comment</button>':''}<button type="button" class="text-button" data-report-review>Report</button></div>`;if(own){const editBtn=item.querySelector('[data-edit-review]'),next=mine?.next_edit_at,ready=!next||Date.now()>=new Date(next).getTime();if(editBtn){editBtn.disabled=!ready;editBtn.textContent=ready?'Edit my comment':'Edit available '+dateLabel(next);}}item.querySelector('[data-edit-review]')?.addEventListener('click',()=>{textarea.value=review.body;form.dataset.editId=String(review.id);form.querySelector('button[type=submit]').textContent='Save Changes';form.scrollIntoView({behavior:'smooth',block:'center'});});item.querySelector('[data-report-review]')?.addEventListener('click',async()=>{if(!data.logged_in){location.href='login.html';return;}if(!confirm('Report this comment to ReUnite?'))return;const rr=await fetch(`/api/public-pets/${encodeURIComponent(qr)}/reviews/${review.id}/report`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'Inappropriate content'})});const rd=await rr.json();alert(rd.message||rd.error||'Report submitted.');});list.appendChild(item);});
    if(data.logged_in){form.hidden=false;login.hidden=true;const submit=form.querySelector('button[type=submit]');if(mine){if(!form.dataset.editId)textarea.value=mine.body;form.dataset.editId=String(mine.id);submit.textContent='Save Changes';const next=mine.next_edit_at,ready=!next||Date.now()>=new Date(next).getTime();textarea.disabled=!ready;submit.disabled=!ready;const note=form.querySelector('small');if(note)note.textContent=ready?'One comment per member. You may edit again after 30 days.':'You have already commented. Editing unlocks on '+dateLabel(next)+'.';}else{form.dataset.editId='';textarea.disabled=false;submit.disabled=false;submit.textContent='Post Comment';}}
    else{form.hidden=true;login.hidden=false;}
  }
  try{await refresh();}catch(e){list.textContent=e.message;return;}
  form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';const body=textarea.value.trim();const id=form.dataset.editId;const url='/api/public-pets/'+encodeURIComponent(qr)+'/reviews'+(id?'/'+encodeURIComponent(id):'');const r=await fetch(url,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body})});const data=await r.json();if(!r.ok){error.textContent=data.error||'Could not save comment.';return;}delete form.dataset.editId;textarea.value='';form.querySelector('button[type=submit]').textContent='Post Comment';await refresh();
  });
}

// Public finder chat: helpers for chat token and message rendering.
function chatStorageKey(qr){return 'reunite-chat-token:'+qr;}
function formatChatTime(value){try{return new Date(value).toLocaleString([], {dateStyle:'short',timeStyle:'short'});}catch{return '';}}
function renderPublicMessages(messages){
  const box=document.querySelector('[data-chat-messages]'); if(!box)return;
  box.innerHTML='';
  if(!messages.length){box.innerHTML='<p class="chat-empty">Start the conversation by telling the owner where you found their pet.</p>';return;}
  messages.forEach(m=>{const div=document.createElement('div');div.className='chat-bubble '+(m.sender==='finder'?'chat-finder':'chat-owner');div.innerHTML=`<div>${esc(m.body)}</div><small>${m.sender==='finder'?'You':'Owner'} · ${esc(formatChatTime(m.created_at))}</small>`;box.appendChild(div);});
  box.scrollTop=box.scrollHeight;
}
// Public finder chat: loads and sends messages for a scanned pet QR.
async function initPublicChat(qr){
  const form=document.querySelector('[data-chat-form]'), error=document.querySelector('[data-chat-error]'), fields=document.querySelector('[data-chat-first-fields]');
  if(!form)return;
  let token=localStorage.getItem(chatStorageKey(qr))||'';
  async function refresh(){
    const petResponse=await fetch('/api/public-pets/'+encodeURIComponent(qr));
    const petData=await petResponse.json();
    if(!petResponse.ok||petData.status!=='lost'){
      const chat=document.querySelector('[data-public-chat]'); if(chat)chat.hidden=true;
      return;
    }
    const url='/api/public-pets/'+encodeURIComponent(qr)+'/messages'+(token?'?token='+encodeURIComponent(token):'');
    const r=await fetch(url); const data=await r.json();
    if(!r.ok){error.textContent=data.error||'Unable to load chat.';return;}
    renderPublicMessages(data.messages||[]);
    if(fields)fields.hidden=!!token && (data.messages||[]).length>0;
  }
  await refresh();
  form.addEventListener('submit',async e=>{
    e.preventDefault(); error.textContent='';
    const fd=new FormData(form); const payload={token,body:String(fd.get('body')||'').trim(),finder_name:String(fd.get('finder_name')||'').trim(),finder_contact:String(fd.get('finder_contact')||'').trim()};
    const r=await fetch('/api/public-pets/'+encodeURIComponent(qr)+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await r.json();
    if(!r.ok){error.textContent=data.error||'Could not send message.';return;}
    if(data.token){token=data.token;localStorage.setItem(chatStorageKey(qr),token);}
    form.reset();
    await refresh();
  });
  setInterval(refresh,5000);
}


// QR scanner: manages camera permission, scanning, and manual fallback.
async function initScanner(){
  const video=document.querySelector('[data-scanner-video]');
  const openBtn=document.querySelector('[data-open-camera]');
  const message=document.querySelector('[data-scan-message]');
  const manualForm=document.querySelector('[data-manual-form]');
  const manualInput=manualForm?.querySelector('[name=qr]');
  const frame=document.querySelector('.scanner-frame');
  const ID_RE=/REUNITE-(?:[A-Z]{2}|DOG)-\d{6}/i;
  let stream=null, scanning=false, detector=null, work=null, lastWarn=0;

  function setMessage(t){if(message)message.textContent=t;}
  // Accepts a ReUnite link (http://192.168.x.x:3000/p/REUNITE-UP-123456), a ?qr= link, or the bare ID.
  function extractQrId(raw){
    const text=String(raw||'').trim(); if(!text)return '';
    const m=text.match(ID_RE); if(m)return m[0].toUpperCase();
    const p=text.match(/[?&]qr=([^&#]+)/i);
    if(p){try{const id=decodeURIComponent(p[1]).trim().toUpperCase();if(new RegExp('^'+ID_RE.source+'$','i').test(id))return id;}catch{}}
    return '';
  }
  function goToQr(raw){
    const id=extractQrId(raw);
    if(!id){setMessage('That QR code is not a ReUnite pet QR. Please scan the QR on a ReUnite tag or profile.');return false;}
    setMessage('QR found. Opening pet profile...');
    location.href=getPublicQrTarget(id);
    return true;
  }
  function stop(){
    scanning=false;
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
    if(video){video.srcObject=null;video.hidden=true;}
    if(frame)frame.classList.remove('scanner-active');
  }

  if(manualForm){
    manualForm.addEventListener('submit',e=>{
      e.preventDefault();
      const qr=String(manualInput?.value||'').trim().toUpperCase();
      if(!new RegExp('^'+ID_RE.source+'$','i').test(qr)){
        setMessage('Please enter a valid Pet QR Identity, e.g. REUNITE-UP-123456.');
        return;
      }
      goToQr(qr);
    });
  }

  // Reads one frame of the live video: native BarcodeDetector when present, otherwise jsQR on a canvas.
  async function readFrame(){
    if(detector){const codes=await detector.detect(video);return codes[0]?.rawValue||'';}
    if(window.jsQR&&video.videoWidth){
      work=work||document.createElement('canvas');
      const scale=Math.min(1,720/Math.max(video.videoWidth,video.videoHeight));
      work.width=Math.max(1,Math.round(video.videoWidth*scale));work.height=Math.max(1,Math.round(video.videoHeight*scale));
      const ctx=work.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(video,0,0,work.width,work.height);
      const img=ctx.getImageData(0,0,work.width,work.height);
      return window.jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'})?.data||'';
    }
    return '';
  }
  async function scanLoop(){
    if(!scanning||!video)return;
    try{
      if(video.readyState>=2){
        const value=await readFrame();
        if(value){
          if(extractQrId(value)){stop();goToQr(value);return;}
          if(Date.now()-lastWarn>2500){lastWarn=Date.now();setMessage('That QR code is not a ReUnite pet QR. Keep scanning or try another.');}
        }
      }
    }catch(e){}
    if(scanning)requestAnimationFrame(scanLoop);
  }

  async function startLiveCamera(){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('camera-api');
    if(!window.isSecureContext)throw new Error('secure-context');
    detector=null;
    if('BarcodeDetector' in window){try{detector=new BarcodeDetector({formats:['qr_code']});}catch{detector=null;}}
    if(!detector&&!window.jsQR)throw new Error('no-decoder');
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream;video.hidden=false;
    if(frame)frame.classList.add('scanner-active');
    await video.play();
    scanning=true;
    setMessage('Camera is on. Point it at the ReUnite QR code.');
    requestAnimationFrame(scanLoop);
  }

  // Decodes a QR from a photo. Tries full size first, then smaller copies (large phone photos can confuse jsQR).
  async function decodeFile(file){
    const bitmap=await createImageBitmap(file);
    if(!window.jsQR&&!('BarcodeDetector' in window))throw new Error('no-decoder');
    for(const max of [1600,900,500]){
      const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      if(window.jsQR){const image=ctx.getImageData(0,0,canvas.width,canvas.height);const code=window.jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'});if(code?.data)return code.data;}
      if('BarcodeDetector' in window){try{const d=new BarcodeDetector({formats:['qr_code']});const codes=await d.detect(canvas);if(codes?.[0]?.rawValue)return codes[0].rawValue;}catch{}}
    }
    return '';
  }
  // Fallback when live video is blocked (plain-HTTP Wi-Fi testing): the phone's camera app takes a photo and we read it.
  async function openCaptureCamera(){
    let input=document.querySelector('[data-qr-capture]');
    if(!input){
      input=document.createElement('input');
      input.type='file'; input.accept='image/*'; input.capture='environment';
      input.setAttribute('data-qr-capture',''); input.hidden=true;
      document.body.appendChild(input);
      input.addEventListener('change',async()=>{
        const file=input.files?.[0]; if(!file)return;
        setMessage('Reading QR code...');
        try{
          const value=await decodeFile(file);
          if(value)goToQr(value);
          else setMessage('QR not detected. Take a clear, close photo of the whole QR code and try again.');
        }catch(e){
          setMessage(e.message==='no-decoder'
            ?'The QR reader could not load (it needs internet once). You can scan the QR with your phone’s normal camera app, or type the Pet ID below.'
            :'Could not read that photo. Take a clear photo of the QR, or enter the Pet ID below.');
        }
        input.value='';
      });
    }
    input.click();
  }

  openBtn?.addEventListener('click',async()=>{
    setMessage('Starting camera...');
    try{await startLiveCamera();}
    catch(e){
      stop();
      if(e.message==='secure-context'){
        setMessage('Live scanning needs HTTPS. Opening your phone camera to take a photo of the QR instead...');
        await openCaptureCamera();
      }else if(e.message==='no-decoder'){
        setMessage('Live QR scanning is not supported by this browser. Opening phone camera capture...');
        await openCaptureCamera();
      }else{
        setMessage('Camera could not start. Check camera permission, then try again.');
      }
    }
  });
}

// Signed-in messages: loads conversations and handles replies.
async function initMessages(){
  const list=document.querySelector('[data-conversation-list]'), empty=document.querySelector('[data-message-empty]');
  try{
    const r=await fetch('/api/messages'); if(!r.ok)throw Error();
    const data=await r.json(); list.innerHTML='';
    if(!data.conversations.length){empty.hidden=false;return;}
    empty.hidden=true;
    data.conversations.forEach(c=>{
      const card=document.createElement('section'); card.className='card owner-chat-card';
      const messages=c.messages||[];
      card.innerHTML=`<div class="chat-head"><div><h3>🐾 ${esc(c.pet_name)}</h3><p class="muted">${esc(c.finder_name||'Finder')}${c.finder_contact?' · '+esc(c.finder_contact):''}</p></div><span class="status status-lost">LOST CHAT</span></div><div class="chat-messages owner-chat-messages"></div><form class="stack-form owner-reply-form"><textarea name="body" maxlength="1000" placeholder="Reply to the finder..." required></textarea><button class="btn btn-primary btn-wide" type="submit">Reply</button><p class="center muted reply-error"></p></form>`;
      const box=card.querySelector('.owner-chat-messages');
      messages.forEach(m=>{const div=document.createElement('div');div.className='chat-bubble '+(m.sender==='owner'?'chat-owner':'chat-finder');div.innerHTML=`<div>${esc(m.body)}</div><small>${m.sender==='owner'?'You':esc(c.finder_name||'Finder')} · ${esc(formatChatTime(m.created_at))}</small>`;box.appendChild(div);});
      box.scrollTop=box.scrollHeight;
      card.querySelector('.owner-reply-form').addEventListener('submit',async e=>{
        e.preventDefault();const f=e.currentTarget, err=f.querySelector('.reply-error');err.textContent='';const body=String(new FormData(f).get('body')||'').trim();
        const rr=await fetch('/api/messages/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pet_id:c.pet_id,token:c.messages.length?getConversationToken(c):'',body})});
        const d=await rr.json(); if(!rr.ok){err.textContent=d.error||'Could not send reply.';return;} f.reset(); await initMessages();
      });
      // Token is not sent to the browser API response above for owner conversations, so attach it safely as a data attribute below.
      card.dataset.token=c.messages.length?c.messages[0].finder_token:'';
      list.appendChild(card);
    });
  }catch{location.href='/login.html';}
}
// Messages helper: retrieves the finder token for a conversation.
function getConversationToken(c){return c.messages&&c.messages[0]&&c.messages[0].finder_token||'';}
if(document.body.dataset.page==='public-pet')initPublicPet();if(document.body.dataset.page==='scanner')initScanner();if(document.body.dataset.page==='messages')initMessages();

/* ReUnite AI Assistant — guided option-based assistant */
// ReUnite AI assistant: handles guided topic choices and help requests.
function initReUniteAI(){
  if(document.querySelector('[data-reunite-ai]')) return;
  const style=document.createElement('style');
  style.textContent=`
  .ru-ai-launcher{position:fixed;right:22px;bottom:94px;width:58px;height:58px;border:0;border-radius:20px;background:linear-gradient(135deg,#2f8f73,#58b38f);color:#fff;font-size:26px;box-shadow:0 14px 32px rgba(35,112,87,.28);cursor:pointer;z-index:60;transition:.2s;display:grid;place-items:center}.ru-ai-launcher:hover{transform:translateY(-3px) scale(1.03)}
  .ru-ai-window{position:fixed;right:22px;bottom:162px;width:min(410px,calc(100vw - 28px));height:min(650px,calc(100vh - 190px));background:rgba(255,255,255,.97);backdrop-filter:blur(18px);border:1px solid rgba(47,143,115,.16);border-radius:26px;box-shadow:0 24px 70px rgba(25,72,60,.22);z-index:59;display:none;overflow:hidden;flex-direction:column}.ru-ai-window.open{display:flex}
  .ru-ai-head{padding:16px 17px;background:linear-gradient(135deg,#eaf8f2,#f6f3fb);border-bottom:1px solid #e4eee9;display:flex;align-items:center;gap:11px}.ru-ai-avatar{width:42px;height:42px;border-radius:14px;background:#2f8f73;color:#fff;display:grid;place-items:center;font-size:21px}.ru-ai-head strong{display:block;font-size:14px}.ru-ai-head small{color:#667a72;font-size:11px}.ru-ai-close{margin-left:auto;border:0;background:transparent;font-size:21px;color:#71817b;cursor:pointer}
  .ru-ai-quick{padding:11px 12px 2px;display:flex;gap:7px;overflow:auto}.ru-ai-quick button{white-space:nowrap;border:1px solid #dcebe4;background:#f6fbf8;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;color:#2f6f5b;cursor:pointer}
  .ru-ai-messages{flex:1;overflow:auto;padding:13px;display:flex;flex-direction:column;gap:9px;background:linear-gradient(180deg,#fcfefd,#f8fbfa)}
  .ru-ai-msg{max-width:90%;padding:10px 12px;border-radius:16px;font-size:13px;line-height:1.45;white-space:pre-wrap}.ru-ai-msg.bot{align-self:flex-start;background:#eaf7f1;color:#24483d;border-bottom-left-radius:5px}.ru-ai-msg.user{align-self:flex-end;background:#2f8f73;color:#fff;border-bottom-right-radius:5px}.ru-ai-msg.emergency{border:1px solid #f2b4a7;background:#fff1ed;color:#71372e}.ru-ai-typing{font-size:11px;color:#789087;padding:0 3px}
  .ru-ai-options{display:flex;flex-direction:column;gap:8px;margin-top:2px}.ru-ai-option{width:100%;text-align:left;border:1px solid #d7e9e1;background:#fff;border-radius:14px;padding:10px 12px;color:#285e4e;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 3px 12px rgba(32,83,68,.05);transition:.15s}.ru-ai-option:hover{border-color:#79b69f;background:#f4fbf8;transform:translateY(-1px)}.ru-ai-option .ru-ai-option-sub{display:block;font-size:10px;font-weight:500;color:#788b84;margin-top:2px}
  .ru-ai-back{border:0;background:transparent;color:#658078;font-size:11px;font-weight:800;padding:2px 4px;cursor:pointer;text-align:left}
  .ru-ai-form{display:flex;gap:8px;padding:11px;border-top:1px solid #e6eee9;background:#fff}.ru-ai-form textarea{flex:1;resize:none;min-height:42px;max-height:100px;border:1px solid #dce8e2;border-radius:14px;padding:11px;font:inherit;font-size:13px;outline:none}.ru-ai-form textarea:focus{border-color:#65a990;box-shadow:0 0 0 3px rgba(47,143,115,.08)}.ru-ai-send{width:46px;border:0;border-radius:14px;background:#2f8f73;color:#fff;font-size:18px;cursor:pointer}.ru-ai-note{padding:0 12px 9px;font-size:9px;color:#82928b;background:#fff}
  @media(max-width:600px){.ru-ai-launcher{right:14px;bottom:82px;width:54px;height:54px}.ru-ai-window{right:8px;bottom:72px;width:calc(100vw - 16px);height:min(680px,calc(100vh - 92px));border-radius:23px}.ru-ai-window.open~.ru-ai-launcher{display:none}}
  `;
  document.head.appendChild(style);

  const wrap=document.createElement('div');wrap.setAttribute('data-reunite-ai','');wrap.innerHTML=`
    <button class="ru-ai-launcher" aria-label="Open ReUnite AI Assistant">🐾</button>
    <section class="ru-ai-window" aria-label="ReUnite AI Assistant">
      <header class="ru-ai-head"><div class="ru-ai-avatar">🐶</div><div><strong>ReUnite AI Assistant</strong><small>Guided help • Dog care • ReUnite</small></div><button class="ru-ai-close" aria-label="Close">×</button></header>
      <div class="ru-ai-quick"></div>
      <div class="ru-ai-messages"></div>
      <div class="ru-ai-note">Health guidance is educational. For emergencies, contact a qualified veterinarian immediately.</div>
      <form class="ru-ai-form"><textarea maxlength="1500" placeholder="Choose an option above, or ask your own question…"></textarea><button class="ru-ai-send" type="submit">➤</button></form>
    </section>`;
  document.body.appendChild(wrap);

  const launcher=wrap.querySelector('.ru-ai-launcher'),win=wrap.querySelector('.ru-ai-window'),close=wrap.querySelector('.ru-ai-close');
  const box=wrap.querySelector('.ru-ai-messages'),form=wrap.querySelector('.ru-ai-form'),input=form.querySelector('textarea'),quick=wrap.querySelector('.ru-ai-quick');
  let mode='general', history=[];

  const trees={
    health:{title:'🐶 Dog Health',items:[
      ['🤮 Vomiting','My dog is vomiting. What should I do?'],['💩 Diarrhea','My dog has diarrhea. What should I do?'],['🍽️ Not Eating','My dog is not eating. What should I do?'],['💧 Dehydration','How can I tell if my dog is dehydrated?'],['😮 Breathing Problem','My dog is having difficulty breathing.'],['🩸 Severe Bleeding','My dog has severe bleeding that will not stop.'],['⚡ Seizure','My dog is having a seizure.'],['☠️ Poisoning / Toxic Food','My dog may have eaten something poisonous.'],['🌡️ Heatstroke','My dog may have heatstroke.'],['🎈 Bloated Stomach','My dog has a swollen or painful stomach.'],['🦟 Fleas / Ticks','My dog has fleas or ticks.'],['👂 Ear Problem','My dog has an ear problem.'],['👁️ Eye Problem','My dog has an eye problem.'],['🩹 Wound / Injury','My dog has a wound or injury.'],['🐾 Paw / Limping','My dog has a paw injury or is limping.'],['🦷 Teeth / Bad Breath','My dog has dental or bad-breath problems.'],['💉 Vaccination','I need help understanding dog vaccination.'],['🪱 Deworming','I need help understanding dog deworming.'],['🥣 Food / Nutrition','What should my dog eat?'],['🚫 Toxic Foods','Which foods are unsafe for dogs?'],['🐕 Puppy Care','I need basic puppy-care help.'],['🧓 Senior Dog','I need care advice for an older dog.'],['✂️ Grooming','I need dog grooming advice.'],['🏃 Exercise','How much exercise does my dog need?'],['🧠 Behavior','My dog has a barking, aggression, or biting behavior problem.'],['☀️ Hot Weather','How can I keep my dog safe in hot weather?'],['🚗 Travel','How can I travel safely with my dog?'],
      ['❓ Other',''] ]},
    lost:{title:'🚨 Lost / Found Dog',items:[
      ['🚨 My dog is lost','My dog is lost. What should I do in ReUnite?'],['📍 Mark my dog as Lost','How do I mark my dog as lost?'],['📱 QR after loss','What happens when someone scans my lost dog QR?'],['💬 Check Finder Messages','How do I check finder messages?'],['🐕 I found my dog','How do I mark my dog as found or safe?'],['❓ Other',''] ]},
    app:{title:'📱 ReUnite App Help',items:[
      ['🐾 Add a Pet','How do I add a pet in ReUnite?'],['🔖 QR Code / QR Identity','How does the ReUnite QR identity work?'],['📷 Scanner / Camera','My ReUnite scanner or camera is not working.'],['🆔 Pet ID Search','How do I search a pet using Pet ID?'],['💬 Finder Chat','How does finder-owner chat work?'],['👤 Login / Signup','How do login and signup work?'],['💾 Where is my data saved?','Where is my ReUnite data saved in local testing?'],['📱 Phone / Wi-Fi Testing','How do I use ReUnite on my phone over Wi-Fi?'],['❓ Other',''] ]},
    general:{title:'💬 General Help',items:[
      ['🐶 Dog Safety','How can I keep my dog safe in hot weather and everyday situations?'],['🥣 Dog Food','Give me general dog food and nutrition guidance.'],['🧠 Dog Behavior','Give me general dog behavior guidance.'],['🚨 Lost Dog','What should I do if my dog is lost?'],['📱 ReUnite Help','How does the ReUnite QR identity work?'],['❓ Ask My Own Question',''] ]}
  };

  function add(text,who='bot',extra=''){const d=document.createElement('div');d.className='ru-ai-msg '+who+' '+extra;d.textContent=text;box.appendChild(d);box.scrollTop=box.scrollHeight;return d;}
  function clearOptions(){quick.innerHTML='';}
  function addOption(label,sub,onClick){const b=document.createElement('button');b.type='button';b.className='ru-ai-option';b.innerHTML=`${esc(label)}${sub?`<span class="ru-ai-option-sub">${esc(sub)}</span>`:''}`;b.addEventListener('click',onClick);quick.appendChild(b);return b;}
  function showCategories(){
    clearOptions();
    addOption('🐶 Dog Health','Symptoms, care, food, emergencies',()=>showTree('health'));
    addOption('🚨 Lost / Found Dog','Lost status, QR, finder messages',()=>showTree('lost'));
    addOption('📱 ReUnite App Help','Pets, QR, scanner, account and testing',()=>showTree('app'));
    addOption('💬 General Help','General dog or ReUnite questions',()=>showTree('general'));
  }
  function showTree(nextMode){
    mode=nextMode; const tree=trees[nextMode]; clearOptions();
    const back=document.createElement('button');back.type='button';back.className='ru-ai-back';back.textContent='← Back to main categories';back.addEventListener('click',showCategories);quick.appendChild(back);
    tree.items.forEach(([label,query])=>addOption(label,query?`Get a focused answer about this topic.`:'Ask something not listed here.',()=>{
      if(!query){input.focus();input.placeholder='Type your question here…';add('Sure 🐾 What would you like to ask?','bot');return;}
      ask(query,label);
    }));
  }
  async function ask(message,label){
    add(label,'user'); history.push({role:'user',content:message});
    const typing=add('Finding the best answer…','bot');typing.classList.add('ru-ai-typing');
    clearOptions();
    try{
      const r=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,mode,history:history.slice(-8)})});
      const data=await r.json(); typing.remove();
      if(!r.ok){const d=add(data.error||'I could not answer right now. Please try again.','bot');if(data.setup)d.classList.add('ru-ai-unavailable');showTree(mode);return;}
      const isEmergency=String(data.answer||'').includes('🚨');
      add(data.answer||'I could not find an answer.','bot',isEmergency?'emergency':'');
      history.push({role:'assistant',content:data.answer||''});
      showTree(mode);
    }catch(err){typing.remove();add('I’m having trouble connecting right now. Please try again.','bot');showTree(mode);}
  }
  function open(){win.classList.add('open');if(!box.children.length){add('Hi! I’m ReUnite AI 🐾\nChoose what you need help with below. I’ll guide you to the right answer instead of making you search for the topic.','bot');showCategories();}input.focus();}

  launcher.addEventListener('click',open);close.addEventListener('click',()=>win.classList.remove('open'));
  form.addEventListener('submit',async e=>{e.preventDefault();const message=input.value.trim();if(!message)return;input.value='';await ask(message,'✍️ My Question');});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
}

document.addEventListener('DOMContentLoaded',initReUniteAI);

// Admin dashboard: loads summary data and moderation controls.
async function initAdmin(){
  try{const r=await fetch('/api/admin/summary'); if(!r.ok)throw Error(); const d=await r.json();
    const s=d.stats||{}; ['users','pets','lost','safe','messages'].forEach(k=>setText(`[data-admin-${k}-count]`,s[k]??0));
    const users=document.querySelector('[data-admin-users]'); if(users) users.innerHTML=(d.users||[]).map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.suggested_by ? esc(u.suggested_by) : '<span class=\"muted\">Not provided</span>'}</td><td>${u.pet_count}</td><td>${formatDate(u.created_at)}</td></tr>`).join('')||'<tr><td colspan="5">No users yet.</td></tr>';
    const pets=document.querySelector('[data-admin-pets]'); if(pets) pets.innerHTML=(d.pets||[]).map(p=>`<tr><td>${p.photo_url?`<img class="admin-thumb" src="${esc(p.photo_url)}" alt="">`:'🐕'}</td><td><strong>${esc(p.name)}</strong><small>${esc(p.breed||'')}</small></td><td>${esc(p.qr_id)}</td><td><span class="status ${p.status==='lost'?'status-lost':'status-safe'}">${esc(p.status.toUpperCase())}</span></td><td><button class="admin-status-btn" data-id="${p.id}" data-status="${p.status==='lost'?'safe':'lost'}">Mark ${p.status==='lost'?'Safe':'Lost'}</button></td></tr>`).join('')||'<tr><td colspan="5">No pets yet.</td></tr>';
    pets?.querySelectorAll('.admin-status-btn').forEach(btn=>btn.addEventListener('click',async()=>{const rr=await fetch('/api/admin/pets/'+btn.dataset.id+'/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:btn.dataset.status})});if(rr.ok)initAdmin();else alert('Could not update pet status.');}));
  }catch{location.href='/home.html';}
}
// Formatting helper: makes timestamps easier to read.
function formatDate(v){try{return new Date(v).toLocaleString();}catch{return v||'—';}}

// Memorial details: shows the saved story and delete action.
async function initMemorialDetails(){try{const id=q('id');if(!id)throw Error();const r=await fetch('/api/memorials/'+encodeURIComponent(id));if(!r.ok)throw Error();const m=await r.json();setText('[data-memorial-name]',m.name);setText('[data-memorial-meta]',[m.pet_type,m.birth_date?'Born '+m.birth_date:'',m.remembrance_date?'Remembered '+m.remembrance_date:''].filter(Boolean).join(' · '));setText('[data-memorial-story]',m.story);const photo=document.querySelector('[data-memorial-photo]');if(photo)photo.innerHTML=m.photo_url?`<img src="${esc(m.photo_url)}" alt="${esc(m.name)}">`:'🕊️';const form=document.querySelector('[data-memorial-delete]');if(form)form.action='/memorials/'+m.id+'/delete';}catch{location.href='/pet.html';}}

async function initAdoption(){const list=document.querySelector('[data-adoption-list]');try{const r=await fetch('/api/adoptions');const d=await r.json();list.innerHTML='';(d.pets||[]).forEach(p=>{const c=document.createElement('article');c.className='card';c.innerHTML=`${p.photo_url?`<img src="${esc(p.photo_url)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px">`:''}<h3>${esc(p.name)}</h3><p>${esc(p.pet_type||'Pet')} · ${esc(p.breed||'Breed not specified')}</p><p>📍 ${esc(p.city||'City not shared')}</p><p>${esc(p.description||'Looking for a caring home.')}</p><p>${esc(p.temperament||'Temperament not provided')}</p><form class="adopt-request"><input type="hidden" name="pet_id" value="${p.id}"><textarea name="message" placeholder="Tell the owner why you can offer this pet a home" required></textarea><input name="contact" placeholder="Your phone or email" required><button class="btn btn-primary btn-wide">Request adoption</button><small class="muted">Your contact is shared only with this pet's owner.</small></form></article>`;list.appendChild(c);const f=c.querySelector('form');f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(f);const rr=await fetch('/api/adoption/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(fd))});const out=await rr.json();alert(rr.ok?'Adoption request sent.':(out.error||'Please log in to request adoption.'));});});if(!d.pets?.length)list.innerHTML='<p class="muted">No pets listed for adoption yet.</p>';}catch{list.textContent='Adoption listings could not load.';}}

async function initLostPets(){const list=document.querySelector('[data-lost-list]'),type=document.querySelector('#animal-type'),state=document.querySelector('#state-code'),search=document.querySelector('#lost-search');let rows=[];function render(){const qv=search.value.toLowerCase();const filtered=rows.filter(p=>(!type.value||(type.value==='Other'?!PET_TYPE_LIST.includes(p.pet_type):p.pet_type===type.value))&&(!state.value||p.state_code===state.value)&&(!qv||(p.name+' '+p.breed+' '+p.last_seen_location).toLowerCase().includes(qv)));list.innerHTML=filtered.map(p=>`<article class="card"><h3>${esc(p.name)}</h3><p>${esc(p.pet_type)} · ${esc(p.breed||'Breed unknown')} · ${esc(p.state_code)}</p><p>Last seen: ${esc(p.last_seen_location||'Not provided')}</p><span class="status status-lost">LOST</span></article>`).join('')||'<p class="muted">No matching lost pets.</p>'; }try{const r=await fetch('/api/reports');const d=await r.json();rows=d.lost||[];[type,state,search].forEach(e=>e.addEventListener('input',render));render();}catch{list.textContent='Lost-pet list unavailable.';}}
