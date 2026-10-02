import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
const supabase=createClient('https://pgniovlvofvkwjhyoqcg.supabase.co','sb_publishable_UghfMQF0mqMdDL3-i8TvUQ_t3pWFwoe');
const SITE_URL='https://kage049754.github.io/CampusOS-Web/';
let user=null,profile=null,assignment=null,announcements=[];
const CACHE_NAME='campusos-announcements-v1';
const CACHE_META_KEY='campusos-announcement-cache-meta';
const CACHE_DEFAULT_DAYS=7;
const CACHE_OPTIONS=[1,3,7,14,30,0];

function cacheDays(){const n=Number(localStorage.getItem('campusos-announcement-cache-days'));return Number.isFinite(n)?n:CACHE_DEFAULT_DAYS}
function cacheEnabled(){return localStorage.getItem('campusos-announcement-cache-enabled')!=='false'}
function cacheMeta(){try{return JSON.parse(localStorage.getItem(CACHE_META_KEY)||'{}')}catch{return{}}}
async function cleanupAnnouncementCache(){
  const days=cacheDays(),meta=cacheMeta();
  if(days===0)return;
  const cutoff=Date.now()-days*86400000;
  const c=await caches.open(CACHE_NAME);
  for(const [url,stamp] of Object.entries(meta)){if(Number(stamp)<cutoff){await c.delete(url);delete meta[url]}}
  localStorage.setItem(CACHE_META_KEY,JSON.stringify(meta));
}
async function cacheAnnouncementAsset(url){
  if(!cacheEnabled()||!url||!('caches' in window))return;
  try{const r=await fetch(url,{credentials:'include'});if(!r.ok)return;const c=await caches.open(CACHE_NAME);await c.put(url,r.clone());const m=cacheMeta();m[url]=Date.now();localStorage.setItem(CACHE_META_KEY,JSON.stringify(m))}catch{}
}
async function cacheAnnouncementsData(){
  if(!cacheEnabled())return;
  try{localStorage.setItem('campusos-announcements-data',JSON.stringify({savedAt:Date.now(),items:announcements}))}catch{}
}
async function readCachedAnnouncements(){
  if(!cacheEnabled())return null;
  try{const x=JSON.parse(localStorage.getItem('campusos-announcements-data')||'null');if(!x)return null;const d=cacheDays();if(d!==0&&Date.now()-x.savedAt>d*86400000){localStorage.removeItem('campusos-announcements-data');return null}return x.items||null}catch{return null}
}
async function clearAnnouncementCache(){
  localStorage.removeItem('campusos-announcements-data');localStorage.removeItem(CACHE_META_KEY);
  if('caches' in window)await caches.delete(CACHE_NAME);
}
function humanSize(n){if(!n)return '0 B';const u=['B','KB','MB','GB'];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return (n/Math.pow(1024,i)).toFixed(i?1:0)+' '+u[i]}
function isImage(a){return /^image\//.test(a.mime_type||'')}
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast=m=>{const x=$('toast');x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500)};
const initials=n=>(n||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const photo=(path)=>path?supabase.storage.from('campus-profiles').getPublicUrl(path).data.publicUrl:null;
const avatar=(path,name,cls)=>path?'<img class="'+(cls||'person-photo')+'" src="'+esc(photo(path))+'">':'<div class="'+(cls||'person-photo')+'">'+esc(initials(name))+'</div>';
function auth(mode){$('authView').classList.remove('hidden');$('appView').classList.add('hidden');document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.auth===mode));$('signupFields').classList.toggle('hidden',mode!=='signup');$('authSubmit').textContent=mode==='signup'?'Create account':'Sign in';$('authMessage').textContent=''}
function page(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('page-'+p).classList.add('active');document.querySelectorAll('.nav-item[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));$('pageTitle').textContent={home:'Home',announcements:'Announcements',people:'People & pages',profile:'My profile',admin:'Admin'}[p];render(p)}
async function load(){const r=await supabase.auth.getUser();user=r.data.user;if(!user){auth('login');return}const p=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();profile=p.data;const a=await supabase.from('leader_assignments').select('*').eq('user_id',user.id).eq('active',true).maybeSingle();assignment=a.data;$('authView').classList.add('hidden');$('appView').classList.remove('hidden');$('avatarButton').textContent=initials(profile?.full_name||user.email);$('adminNav').classList.toggle('hidden',profile?.role!=='admin');await loadAnnouncements();page('home')}
async function loadAnnouncements(){
  if(!profile||profile.status!=='approved'){announcements=[];return}
  await cleanupAnnouncementCache();
  const r=await supabase.from('announcements').select('*, announcement_images(id,storage_path,sort_order), announcement_links(id,url,sort_order), announcement_attachments(id,storage_path,file_name,mime_type,file_size,sort_order)').order('created_at',{ascending:false});
  if(r.error){
    const cached=await readCachedAnnouncements();
    if(cached){announcements=cached;return}
    return toast(r.error.message)
  }
  announcements=r.data||[];
  const paths=[];
  for(const a of announcements){
    for(const x of (a.announcement_images||[])){const z=await supabase.storage.from('campus-announcements').createSignedUrl(x.storage_path,86400);x.url=z.data?.signedUrl||null;if(x.url)paths.push(x.url)}
    for(const x of (a.announcement_attachments||[])){const z=await supabase.storage.from('campus-announcements').createSignedUrl(x.storage_path,86400);x.url=z.data?.signedUrl||null;if(x.url)paths.push(x.url)}
  }
  await cacheAnnouncementsData();
  if(cacheEnabled())await Promise.all(paths.map(cacheAnnouncementAsset));
}
function card(a){return '<article class="card announcement"><div class="announcement-head">'+avatar(a.author_page_photo_path,a.author_page_name||a.author_name)+'<div><b>'+esc(a.author_page_name||a.author_name)+'</b><div class="meta">'+esc(a.author_title||'CampusOS publisher')+'</div></div></div><div class="announcement-body">'+esc(a.body)+'</div></article>'}
function render(p){if(p==='home')return home();if(p==='announcements')return announcementsPage();if(p==='people')return people();if(p==='profile')return profilePage();if(p==='admin')return adminPage()}
function home(){$('page-home').innerHTML='<div class="welcome"><div><span class="eyebrow-sm">CampusOS</span><h1>Welcome, '+esc((profile?.full_name||user.email).split(' ')[0])+'.</h1><p class="muted">'+(profile?.status==='approved'?'Here is what is happening around campus.':'Your account is waiting for approval.')+'</p></div><button class="primary '+((profile?.role==='admin'||assignment?.can_announce)?'':'hidden')+'" onclick="openAnnouncement()">＋ New announcement</button></div><div class="grid grid-3"><div class="card"><span class="eyebrow-sm">Account</span><div class="stat">'+esc(profile?.status||'pending')+'</div></div><div class="card"><span class="eyebrow-sm">Role</span><div class="stat">'+esc(profile?.role||'student')+'</div><span class="muted">'+esc(assignment?.title||'Student')+'</span></div><div class="card"><span class="eyebrow-sm">Organization</span><div class="stat">'+esc(assignment?.organization_name||'—')+'</div><span class="muted">'+esc(assignment?.organization_type||'None')+'</span></div></div><div class="section-head"><h2 class="page-title">Latest announcements</h2><button class="ghost" onclick="page(\'announcements\')">View all</button></div><div class="grid">'+(announcements.slice(0,3).map(card).join('')||'<div class="card empty">No announcements yet.</div>')+'</div>'}
function announcementsPage(){$('page-announcements').innerHTML='<div class="welcome"><div><span class="eyebrow-sm">Campus feed</span><h1>Announcements</h1><p class="muted">Official updates and campus information.</p></div></div><div class="grid">'+(announcements.map(card).join('')||'<div class="card empty">There are no active announcements.</div>')+'</div>'}
async function people(){$('page-people').innerHTML='<div class="welcome"><div><span class="eyebrow-sm">Campus directory</span><h1>People & pages</h1><p class="muted">Organization pages and approved campus leaders.</p></div></div><div id="peopleGrid" class="grid grid-2"><div class="card empty">Loading…</div></div>';if(profile?.status!=='approved'){return $('peopleGrid').innerHTML='<div class="card empty">Available after account approval.</div>'}const r=await supabase.from('leader_assignments').select('*').eq('active',true).order('organization_name');if(r.error)return $('peopleGrid').textContent=r.error.message;$('peopleGrid').innerHTML=(r.data||[]).map(x=>'<article class="card people-card">'+avatar(x.page_photo_path,x.page_name||x.organization_name,'page-photo')+'<div><h3>'+esc(x.page_enabled&&x.page_name?x.page_name:x.organization_name||'Organization')+'</h3><div class="meta">'+esc(x.organization_type||'Organization')+' · '+esc(x.title||'Leader')+'</div></div></article>').join('')||'<div class="card empty">No organization pages yet.</div>'}
function profilePage(){$('page-profile').innerHTML='<div class="welcome"><div><span class="eyebrow-sm">Account</span><h1>My profile</h1><p class="muted">Manage your account identity.</p></div></div><div class="card profile-hero">'+avatar(profile?.profile_photo_path,profile?.full_name,'big-avatar')+'<div style="flex:1"><h2>'+esc(profile?.full_name||'Student')+'</h2><div class="muted">'+esc(profile?.school_id||'No school ID')+' · '+esc(profile?.year_section||'No section')+'</div><div class="actions"><span class="pill">'+esc(profile?.status||'pending')+'</span><span class="pill">'+esc(profile?.role||'student')+'</span></div></div><button class="ghost" onclick="openProfilePhoto()">Change photo</button></div>'+(profile&&(profile.role==='leader'||profile.role==='admin')&&assignment?'<div class="section-head"><h2 class="page-title">Campus page</h2></div><div class="card"><h3>'+esc(assignment.page_name||'Not named yet')+'</h3><p class="muted">'+esc(assignment.organization_name||'Organization')+' · '+esc(assignment.title||'Leader')+'</p><button class="primary" onclick="openPageEditor()">Edit page</button></div>':'')}
async function adminPage(){if(profile?.role!=='admin')return $('page-admin').innerHTML='<div class="card empty">Admin access required.</div>'; $('page-admin').innerHTML='<div class="welcome"><div><span class="eyebrow-sm">Control center</span><h1>Admin</h1><p class="muted">Approve accounts and manage leadership.</p></div></div><div class="card"><div id="adminUsers">Loading…</div></div>';const r=await supabase.from('profiles').select('*').order('created_at',{ascending:false});if(r.error)return $('adminUsers').textContent=r.error.message;$('adminUsers').innerHTML='<div style="overflow:auto"><table class="admin-table"><tr><th>Name</th><th>ID</th><th>Status</th><th>Role</th><th></th></tr>'+r.data.map(x=>'<tr><td>'+esc(x.full_name)+'</td><td>'+esc(x.school_id||'—')+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.role)+'</td><td><button class="ghost" onclick="editUser(\''+x.id+'\')">Manage</button></td></tr>').join('')+'</table></div>'}
function modal(h){$('modalContent').innerHTML=h;$('modal').classList.remove('hidden')}function closeModal(){$('modal').classList.add('hidden')}
window.openAnnouncement=()=>{
  if(!(profile?.role==='admin'||assignment?.can_announce))return toast('Publishing permission required.');
  modal('<h2>New announcement</h2><form id="af"><label>Message<textarea id="ab" rows="7" required></textarea></label><label>Expires at<input id="ae" type="datetime-local"></label><label>Images or files <span class="muted">(up to 4 images, 4 files, 20 MB each)</span><input id="aa" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip"></label><div id="uploadHint" class="meta">Images are compressed before upload when possible.</div><button class="primary wide">Publish</button></form>');
  $('af').onsubmit=async e=>{
    e.preventDefault();
    const chosen=[...($('aa').files||[])];
    const images=chosen.filter(f=>f.type.startsWith('image/')).slice(0,4);
    const files=chosen.filter(f=>!f.type.startsWith('image/')).slice(0,4);
    if(chosen.filter(f=>f.type.startsWith('image/')).length>4)return toast('Maximum 4 images.');
    if(chosen.filter(f=>!f.type.startsWith('image/')).length>4)return toast('Maximum 4 files.');
    if(chosen.some(f=>f.size>20971520))return toast('Each file must be 20 MB or smaller.');
    const r=await supabase.from('announcements').insert({author_id:user.id,author_name:profile.full_name,author_title:assignment?.title||'Admin',body:$('ab').value.trim(),expires_at:$('ae').value?new Date($('ae').value).toISOString():null,author_page_name:assignment?.page_enabled?assignment.page_name:'',author_page_photo_path:assignment?.page_enabled?assignment.page_photo_path:null}).select().single();
    if(r.error)return toast(r.error.message);
    const aid=r.data.id;
    for(let i=0;i<images.length;i++){
      let f=images[i];
      try{if(f.size>500000&&'createImageBitmap' in window){const b=await createImageBitmap(f);const max=1800;const scale=Math.min(1,max/Math.max(b.width,b.height));const c=document.createElement('canvas');c.width=Math.round(b.width*scale);c.height=Math.round(b.height*scale);c.getContext('2d').drawImage(b,0,0,c.width,c.height);const blob=await new Promise(res=>c.toBlob(res,'image/webp',.82));if(blob)f=new File([blob],f.name.replace(/\.[^.]+$/i,'.webp'),{type:'image/webp'})}}catch{}
      const path=user.id+'/announcements/'+aid+'/image-'+i+'-'+Date.now()+'.'+(f.type==='image/webp'?'webp':(f.type.split('/')[1]||'jpg'));
      const u=await supabase.storage.from('campus-announcements').upload(path,f,{contentType:f.type,cacheControl:'604800'});
      if(u.error)return toast('Image upload failed: '+u.error.message);
      const m=await supabase.from('announcement_images').insert({announcement_id:aid,storage_path:path,sort_order:i});
      if(m.error)return toast(m.error.message);
    }
    for(let i=0;i<files.length;i++){
      const f=files[i], safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path=user.id+'/announcements/'+aid+'/file-'+i+'-'+Date.now()+'-'+safe;
      const u=await supabase.storage.from('campus-announcements').upload(path,f,{contentType:f.type||'application/octet-stream',cacheControl:'604800'});
      if(u.error)return toast('File upload failed: '+u.error.message);
      const m=await supabase.from('announcement_attachments').insert({announcement_id:aid,storage_path:path,file_name:f.name,mime_type:f.type||'application/octet-stream',file_size:f.size,sort_order:i});
      if(m.error)return toast(m.error.message);
    }
    closeModal();await loadAnnouncements();page('announcements');toast('Announcement published.');
  };
};
window.openProfilePhoto=()=>{modal('<h2>Profile photo</h2><p class="muted">JPG, PNG or WebP, up to 2 MB.</p><form id="pf"><input id="file" type="file" accept="image/jpeg,image/png,image/webp" required><button class="primary wide">Upload</button></form>');$('pf').onsubmit=async e=>{e.preventDefault();const f=$('file').files[0];if(!f||f.size>2097152)return toast('Image must be 2 MB or smaller.');const path=user.id+'/profile-'+Date.now()+'.'+(f.type.split('/')[1]||'jpg');let r=await supabase.storage.from('campus-profiles').upload(path,f,{contentType:f.type});if(r.error)return toast(r.error.message);r=await supabase.rpc('set_own_profile_photo_path',{new_path:path});if(r.error)return toast(r.error.message);closeModal();await load();toast('Profile photo updated.')}};
window.openPageEditor=()=>{if(!assignment)return;modal('<h2>Edit campus page</h2><form id="pg"><label>Page name<input id="pn" value="'+esc(assignment.page_name||'')+'" required></label><label>Page photo<input id="pfile" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="primary wide">Save</button></form>');$('pg').onsubmit=async e=>{e.preventDefault();let path=assignment.page_photo_path||null;const f=$('pfile').files[0];if(f){if(f.size>2097152)return toast('Image must be 2 MB or smaller.');path=user.id+'/page/page-'+Date.now()+'.'+(f.type.split('/')[1]||'jpg');let r=await supabase.storage.from('campus-profiles').upload(path,f,{contentType:f.type});if(r.error)return toast(r.error.message)}const r=await supabase.rpc('update_own_page',{p_page_name:$('pn').value.trim(),p_page_photo_path:path});if(r.error)return toast(r.error.message);closeModal();await load();toast('Campus page updated.')}};
window.openSettings=()=>{modal('<h2>Offline announcements</h2><p class="muted">New announcements are cached automatically while you are online. Cached items are temporary; files you explicitly save/download are not removed by this cleanup.</p><label><input id="cacheEnabled" type="checkbox" style="width:auto"> Auto-cache announcements</label><label>Delete cached announcements after<select id="cacheDays"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="0">Never</option></select></label><div class="card cache-note"><b>Default: 7 days</b><div class="meta">Cache is stored by your browser on this device.</div></div><button class="ghost wide" id="clearAnnCache">Clear announcement cache</button><button class="ghost wide" id="clearAllOffline">Clear all offline data</button>');$('cacheEnabled').checked=cacheEnabled();$('cacheDays').value=String(cacheDays());$('cacheEnabled').onchange=()=>{localStorage.setItem('campusos-announcement-cache-enabled',$('cacheEnabled').checked?'true':'false')};$('cacheDays').onchange=async()=>{localStorage.setItem('campusos-announcement-cache-days',$('cacheDays').value);await cleanupAnnouncementCache();toast('Cache duration updated.')};$('clearAnnCache').onclick=async()=>{await clearAnnouncementCache();toast('Announcement cache cleared.')};$('clearAllOffline').onclick=async()=>{await clearAnnouncementCache();localStorage.removeItem('campusos-announcement-cache-days');localStorage.removeItem('campusos-announcement-cache-enabled');if('caches' in window){for(const n of await caches.keys())if(n.startsWith('campusos-'))await caches.delete(n)}toast('Offline data cleared.');closeModal()};};
window.editUser=async id=>{const p=(await supabase.from('profiles').select('*').eq('id',id).single()).data;const a=(await supabase.from('leader_assignments').select('*').eq('user_id',id).maybeSingle()).data;modal('<h2>Manage user</h2><p><b>'+esc(p.full_name)+'</b></p><form id="uf"><label>Status<select id="us"><option>pending</option><option>approved</option><option>denied</option><option>suspended</option></select></label><label>Role<select id="ur"><option>student</option><option>leader</option><option>admin</option></select></label><label>Organization type<input id="ot" value="'+esc(a?.organization_type||'Organization')+'"></label><label>Organization name<input id="on" value="'+esc(a?.organization_name||'')+'"></label><label>Position/title<input id="op" value="'+esc(a?.title||'')+'"></label><label><input id="ca" type="checkbox" style="width:auto"> Can publish announcements</label><label><input id="pe" type="checkbox" style="width:auto"> Enable page</label><button class="primary wide">Save</button></form>');$('us').value=p.status;$('ur').value=p.role;$('ca').checked=!!a?.can_announce;$('pe').checked=!!a?.page_enabled;$('uf').onsubmit=async e=>{e.preventDefault();let r=await supabase.from('profiles').update({status:$('us').value,role:$('ur').value}).eq('id',id);if(r.error)return toast(r.error.message);r=await supabase.rpc('grant_page_to_user',{p_user_id:id,p_org_type:$('ot').value,p_org_name:$('on').value,p_title:$('op').value,p_page_enabled:$('pe').checked});if(r.error)return toast(r.error.message);if($('ur').value!=='student')await supabase.from('leader_assignments').upsert({user_id:id,title:$('op').value||'Leader',can_announce:$('ca').checked,active:true,organization_type:$('ot').value||'Organization',organization_name:$('on').value,page_enabled:$('pe').checked,assigned_by:user.id},{onConflict:'user_id'});closeModal();adminPage();toast('User updated.')}};
document.querySelectorAll('.nav-item[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>auth(b.dataset.auth));$('avatarButton').onclick=()=>page('profile');$('closeModal').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};$('signOut').onclick=async()=>{await supabase.auth.signOut();auth('login')};$('authForm').onsubmit=async e=>{e.preventDefault();const email=$('email').value.trim(),password=$('password').value;if(document.querySelector('.tab.active').dataset.auth==='signup'){const r=await supabase.auth.signUp({email,password,options:{emailRedirectTo:SITE_URL,data:{full_name:$('fullName').value.trim(),school_id:$('schoolId').value.trim(),year_section:$('yearSection').value.trim()}}});if(r.error)return $('authMessage').textContent=r.error.message;$('authMessage').textContent='Check your email to confirm your account.';$('resendBtn').classList.remove('hidden')}else{const r=await supabase.auth.signInWithPassword({email,password});if(r.error)return $('authMessage').textContent=r.error.message;await load()}};$('resendBtn').onclick=async()=>{const r=await supabase.auth.resend({type:'signup',email:$('email').value.trim(),options:{emailRedirectTo:SITE_URL}});$('authMessage').textContent=r.error?r.error.message:'Confirmation email sent.'};supabase.auth.onAuthStateChange(()=>{if(!user)load()});load();
window.addEventListener('online',()=>loadAnnouncements());
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
