// REUNITE SERVER GUIDE
// This file runs the local Express server, handles sessions, reads/writes the JSON database,
// and exposes API routes used by app.js. Keep route paths in sync with the HTML forms.
// Main sections: imports/AI knowledge, helpers/database, authentication, API routes, server start.

const fs0 = require('fs'), path0 = require('path');
// Load optional KEY=VALUE pairs from .env (already-set environment variables win). No extra package needed.
try {
  for (const line of fs0.readFileSync(path0.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');
const INDIA_DISTRICTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'india-districts.json'), 'utf8'));
const dogKnowledge = JSON.parse(fs.readFileSync(path.join(__dirname, 'dog-knowledge.json'), 'utf8'));
const reuniteHelp = JSON.parse(fs.readFileSync(path.join(__dirname, 'reunite-help.json'), 'utf8'));

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function findLocalKnowledge(message, mode) {
  const text = normalizeText(message);
  const pools = [];
  if (mode === 'app' || mode === 'general') pools.push(...reuniteHelp.topics);
  if (mode === 'health' || mode === 'general') pools.push(...dogKnowledge.emergencies, ...dogKnowledge.topics);
  // Emergency rules always get priority, even if the user chose another mode.
  const emergency = dogKnowledge.emergencies.find(item => item.keys.some(k => text.includes(normalizeText(k))));
  if (emergency) return { answer: emergency.answer, source: 'local', emergency: true };
  let best = null, bestScore = 0;
  for (const item of pools) {
    let score = 0;
    for (const key of item.keys) {
      const k = normalizeText(key);
      if (k && text.includes(k)) score += k.length >= 6 ? 3 : 1;
    }
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return best && bestScore >= 1 ? { answer: best.answer, source: 'local', emergency: false } : null;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
function getLanIp() {
  // Pick the address a phone on the same Wi-Fi can actually reach.
  // Manual override: set REUNITE_LAN_IP (for example 192.168.1.20) if the wrong adapter is chosen.
  const forced = String(process.env.REUNITE_LAN_IP || '').trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(forced)) return forced;
  const virtualName = /virtual|vmware|virtualbox|hyper-v|vethernet|wsl|docker|vpn|tun|tap|tailscale|zerotier|loopback|bluetooth|utun|br-|veth/i;
  const realName = /wi-?fi|wlan|wireless|ethernet|^en\d|^eth\d/i;
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) for (const info of (entries || [])) {
    if ((info.family !== 'IPv4' && info.family !== 4) || info.internal) continue;
    const a = info.address;
    if (a.startsWith('169.254.')) continue; // link-local: no DHCP address
    let score = 0;
    if (a.startsWith('192.168.')) score += 30; else if (a.startsWith('10.')) score += 20; else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(a)) score += 10;
    if (virtualName.test(name)) score -= 100;
    if (realName.test(name)) score += 15;
    candidates.push({ a, score });
  }
  candidates.sort((x, y) => y.score - x.score);
  return candidates.length ? candidates[0].a : 'localhost';
}
const LAN_IP = getLanIp();
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'reunite-db.json');
fs.mkdirSync(dataDir, { recursive: true });

const defaultDb = { nextUserId: 1, nextPetId: 1, nextMemorialId: 1, nextMessageId: 1, nextReviewId: 1, users: [], pets: [], memorials: [], messages: [], reviews: [] };
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
function loadDb() {
  if (!fs.existsSync(dbFile)) { fs.writeFileSync(dbFile, JSON.stringify(defaultDb, null, 2)); return structuredClone(defaultDb); }
  try { return { ...structuredClone(defaultDb), ...JSON.parse(fs.readFileSync(dbFile, 'utf8')) }; }
  catch (err) {
    // Never silently overwrite a damaged database: keep a copy so no data is lost.
    try { fs.copyFileSync(dbFile, path.join(dataDir, `reunite-db.corrupt-${Date.now()}.json`)); } catch {}
    console.error('WARNING: data/reunite-db.json could not be read. A backup copy was saved in the data folder.', err.message);
    return structuredClone(defaultDb);
  }
}
let db = loadDb();
function saveDb() { const tmp = dbFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, dbFile); }
function findUser(id) { return db.users.find(u => u.id === Number(id)); }
function findPet(id) { return db.pets.find(p => p.id === Number(id)); }
function ownPet(req, id) { return db.pets.find(p => p.id === Number(id) && p.owner_id === Number(req.session.userId)); }
const STATE_CODES = new Set(['AP','AR','AS','BR','CG','GA','GJ','HR','HP','JH','KA','KL','MP','MH','MN','ML','MZ','NL','OD','PB','RJ','SK','TN','TS','TR','UP','UK','WB','AN','CH','DH','DL','JK','LA','LD','PY']);
function makeQrId(ownerId) {
  const owner = findUser(ownerId);
  const code = STATE_CODES.has(String(owner?.state_code || '').toUpperCase()) ? String(owner.state_code).toUpperCase() : 'IN';
  let q;
  do q = `REUNITE-${code}-${String(crypto.randomInt(0, 1000000)).padStart(6, '0')}`;
  while (db.pets.some(p => p.qr_id === q));
  return q;
}
function requireLogin(req, res, next) { if (!req.session.userId) return res.redirect('/login.html'); next(); }
function currentUser(req) { return findUser(req.session.userId); }
function isAdmin(req) { const user=currentUser(req); const adminEmail=String(process.env.REUNITE_ADMIN_EMAIL||'').trim().toLowerCase(); return !!user && (user.role==='admin' || (adminEmail && user.email===adminEmail)); }
function requireAdmin(req,res,next) { if(!req.session.userId) return res.redirect('/login.html'); if(!isAdmin(req)) return res.status(403).send('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReUnite | Access denied</title><link rel="stylesheet" href="/css/style.css"></head><body class="auth-page"><main class="auth-card"><div class="page-icon">🔒</div><h1>Admin access only</h1><p class="muted">This area is restricted to the ReUnite administrator.</p><a class="btn btn-primary btn-wide" href="/home.html">Back to ReUnite</a></main></body></html>'); next(); }
// Pet types offered in the forms. Anything else is stored as the custom text the user typed under "Other".
const PET_TYPES = ['Dog', 'Cat', 'Horse', 'Goat', 'Cow'];
function resolvePetType(body) {
  const t = String(body.pet_type || 'Dog').trim();
  const known = PET_TYPES.find(x => x.toLowerCase() === t.toLowerCase());
  if (known) return known;
  if (/^others?$/i.test(t)) {
    const custom = String(body.other_pet_type || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!custom) return null;
    return PET_TYPES.find(x => x.toLowerCase() === custom.toLowerCase()) || custom;
  }
  return null;
}
// City / district: must be one of the state's districts, or typed manually via the "not listed" option.
function resolveCity(stateCode, body) {
  const raw = String(body.city || '').trim();
  if (raw === '__other__') return String(body.city_other || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  return (INDIA_DISTRICTS[stateCode] || []).includes(raw) ? raw : '';
}
function deletePhotoFile(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/') || url.includes('..')) return;
  try { fs.unlinkSync(path.join(uploadsDir, path.basename(url))); } catch {}
}
function savePhotoData(petId, dataUrl) {
  if(!dataUrl || typeof dataUrl!=='string') return null;
  const m=dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if(!m) return null;
  const ext=m[1].toLowerCase()==='jpg'?'jpg':m[1].toLowerCase();
  const buffer=Buffer.from(m[2],'base64');
  if(buffer.length>2*1024*1024) return null;
  const filename=`pet-${petId}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir,filename),buffer);
  return `/uploads/${filename}`;
}
function savePetPhotoSet(petId, primaryData, listRaw) {
  let extras=[];
  try { extras=listRaw ? JSON.parse(listRaw) : []; } catch { return { error: 'The selected photos could not be read. Please select them again.' }; }
  if(!Array.isArray(extras)) return { error: 'Invalid photo selection. Please select your photos again.' };
  const all=[primaryData,...extras].filter(Boolean);
  if(all.length>9) return { error: 'Please choose no more than 9 photos.' };
  const photos=[];
  for(let i=0;i<all.length;i++) {
    const saved=savePhotoData(`${petId}-${i}`,all[i]);
    if(!saved) {
      photos.forEach(url=>{ try { fs.unlinkSync(path.join(__dirname,url)); } catch {} });
      return { error: 'Each photo must be a valid JPG, PNG or WebP image under 2 MB. Please select them again.' };
    }
    photos.push(saved);
  }
  return { photos };
}
function qrPublicBaseUrl(req) {
  // 1) An explicit REUNITE_PUBLIC_URL (deployed site) always wins.
  // 2) If ReUnite was opened through a real address (LAN IP / domain), reuse exactly that address, port included.
  // 3) If it was opened as localhost, swap in the computer's Wi-Fi address WITH the port - another device cannot use "localhost".
  const configured = String(process.env.REUNITE_PUBLIC_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const hostHeader = String(req?.get?.('host') || '').trim();
  const m = hostHeader.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  const hostname = (m ? m[1] : hostHeader).replace(/^\[|\]$/g, '').toLowerCase();
  const port = (m && m[2]) || String(PORT);
  const isLocal = !hostname || ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname) || hostname.endsWith('.localhost');
  if (isLocal) return `http://${LAN_IP}:${port}`;
  const proto = String(req?.get?.('x-forwarded-proto') || req?.protocol || 'http').split(',')[0].trim() || 'http';
  return `${proto}://${hostHeader}`.replace(/\/+$/, '');
}
function qrTargetUrl(req, pet) { return `${qrPublicBaseUrl(req)}/p/${encodeURIComponent(pet.qr_id)}`; }
function pageMessage(res, title, message, link='/index.html') { res.status(400).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReUnite</title><link rel="stylesheet" href="/css/style.css"></head><body class="auth-page"><main class="auth-card"><div class="page-icon">🐾</div><h1>${title}</h1><p class="muted">${message}</p><a class="btn btn-primary btn-wide" href="${link}">Continue</a></main></body></html>`); }

app.use(express.urlencoded({ extended: true, limit: '30mb' }));
app.use(express.json({ limit: '30mb' }));
function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(dataDir, '.session-secret');
  try { const saved = fs.readFileSync(file, 'utf8').trim(); if (saved.length >= 32) return saved; } catch {}
  const created = crypto.randomBytes(48).toString('hex');
  try { fs.writeFileSync(file, created, { mode: 0o600 }); } catch {}
  return created;
}
app.use(session({ secret: getSessionSecret(), resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax' } }));
// SECURITY: the project folder is served as the website, so private files must never be downloadable
// (anyone on the same Wi-Fi could otherwise open /data/reunite-db.json and read accounts and password hashes).
const PRIVATE_PATH = /^\/(data|node_modules|\.git|\.env[^/]*|server\.js|package(-lock)?\.json|readme[^/]*|code-guide[^/]*|dog-knowledge\.json|reunite-help\.json)(\/|$)|\.(tgz|zip|md|bak|tmp|log)$/i;
app.use((req, res, next) => {
  let p; try { p = decodeURIComponent(req.path); } catch { return res.status(400).send('Bad request'); }
  p = path.posix.normalize(p.replace(/\\/g, '/'));
  if (PRIVATE_PATH.test(p) || p.split('/').some(seg => seg.startsWith('.') && seg.length > 1)) return res.status(404).send('Not found');
  next();
});
app.use(express.static(__dirname, { dotfiles: 'ignore' }));
app.use('/uploads', express.static(uploadsDir));

// AUTH ROUTES: create an account and start the password setup flow.
app.post('/signup', (req,res) => {
  const first_name=(req.body.first_name||'').trim(), last_name=(req.body.last_name||'').trim(), email=(req.body.email||'').trim().toLowerCase(), state_code=String(req.body.state_code||'').trim().toUpperCase();
  if (!first_name || !last_name || !email || !STATE_CODES.has(state_code)) return pageMessage(res,'Missing details','Please enter your name, email and select a valid state or union territory.','/signup.html');
  if (db.users.some(u=>u.email===email)) return pageMessage(res,'Account already exists','That email is already registered. Try logging in.','/login.html');
  const city=resolveCity(state_code,req.body); if(!city)return pageMessage(res,'City / District required','Please select your city / district from the list for your state.','/signup.html');
  const user={id:db.nextUserId++,first_name,last_name,email,state_code,city,password_hash:null,suggested_by:null,created_at:new Date().toISOString()}; db.users.push(user); saveDb();
  req.session.pendingUserId=user.id; res.redirect('/password.html');
});
app.post('/create-password', async (req,res)=>{
  if(!req.session.pendingUserId) return res.redirect('/signup.html');
  const password=req.body.password||'', confirm=req.body.confirm_password||'';
  if(password.length<6) return pageMessage(res,'Password too short','Use at least 6 characters.','/password.html');
  if(password!==confirm) return pageMessage(res,'Passwords do not match','Please enter the same password twice.','/password.html');
  const user=findUser(req.session.pendingUserId); if(!user) return res.redirect('/signup.html');
  user.password_hash=await bcrypt.hash(password,12); saveDb(); req.session.userId=user.id; delete req.session.pendingUserId; res.redirect('/suggested-by.html');
});
// Password recovery: issue a single-use, time-limited reset token. Configure an email provider before production; local mode prints the link to the server console.
app.post('/forgot-password', (req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(), user=db.users.find(u=>u.email===email);
  if(user){const token=crypto.randomBytes(32).toString('hex');user.reset_token_hash=crypto.createHash('sha256').update(token).digest('hex');user.reset_expires=Date.now()+30*60*1000;saveDb();console.log(`[ReUnite password reset] ${email}: http://localhost:${PORT}/forgot-password.html?token=${token}`);}
  res.send('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/style.css"></head><body class="auth-page"><main class="auth-card"><h1>Check your inbox</h1><p class="muted">If that email is registered, password reset instructions have been generated. In local development, check the server terminal for the reset link.</p><a class="btn btn-primary btn-wide" href="/login.html">Back to login</a></main></body></html>');
});
app.post('/reset-password',async(req,res)=>{const token=String(req.body.token||''),user=db.users.find(u=>u.reset_token_hash&&u.reset_token_hash===crypto.createHash('sha256').update(token).digest('hex')&&u.reset_expires>Date.now());if(!user)return pageMessage(res,'Reset link expired','Request a new password reset link.','/forgot-password.html');const pw=String(req.body.password||''),confirm=String(req.body.confirm_password||'');if(pw.length<8||pw!==confirm)return pageMessage(res,'Password not accepted','Use at least 8 characters and make both fields match.','/forgot-password.html?token='+encodeURIComponent(token));user.password_hash=await bcrypt.hash(pw,12);delete user.reset_token_hash;delete user.reset_expires;saveDb();res.redirect('/login.html');});
app.post('/change-password',requireLogin,async(req,res)=>{const user=currentUser(req),old=String(req.body.current_password||''),pw=String(req.body.password||''),confirm=String(req.body.confirm_password||'');if(!await bcrypt.compare(old,user.password_hash||''))return pageMessage(res,'Current password incorrect','Enter your existing password.','/change-password.html');if(pw.length<8||pw!==confirm)return pageMessage(res,'Password not accepted','New password must be at least 8 characters and both fields must match.','/change-password.html');user.password_hash=await bcrypt.hash(pw,12);saveDb();res.redirect('/account.html');});
// AUTH ROUTES: verify credentials and start a signed-in session.
app.post('/login', async (req,res)=>{
  const email=(req.body.email||'').trim().toLowerCase(), password=req.body.password||''; const user=db.users.find(u=>u.email===email);
  if(!user || !user.password_hash || !(await bcrypt.compare(password,user.password_hash))) return pageMessage(res,'Login failed','Email or password is incorrect.','/login.html');
  req.session.userId=user.id; res.redirect('/suggested-by.html');
});
app.post('/suggested-by',(req,res)=>{
  const user=currentUser(req);
  if(!user) return res.redirect('/login.html');
  if(String(req.body.skip||'')==='1'){
    return res.redirect('/home.html');
  }
  let suggestedBy=String(req.body.suggested_by||'').trim().replace(/\s+/g,' ');
  if(suggestedBy.length>120) suggestedBy=suggestedBy.slice(0,120);
  user.suggested_by=suggestedBy || null;
  saveDb();
  res.redirect('/home.html');
});
// AUTH ROUTES: end the current session.
app.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/index.html')));

// ReUnite AI Assistant — server-side AI proxy. Keep the API key off the browser.
// AI ASSISTANT ROUTE: return guided ReUnite or pet-care help.
app.post('/api/ai-chat', async (req,res)=>{
  try{
    const message=String(req.body?.message||'').trim();
    const mode=String(req.body?.mode||'general').trim();
    const history=Array.isArray(req.body?.history)?req.body.history.slice(-8):[];
    if(!message)return res.status(400).json({error:'Please enter a message.'});
    if(message.length>1500)return res.status(400).json({error:'Please keep your message under 1500 characters.'});
    const local = findLocalKnowledge(message, mode);
    if (local) return res.json(local);

    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey){
      return res.json({
        answer:'I could not find a specific answer in my ReUnite knowledge base yet. For dog-health concerns, especially urgent symptoms, please contact a qualified veterinarian. You can also ask me about ReUnite features such as pets, QR, scanner, Lost/Found, or finder chat.',
        source:'local-fallback',
        setup:true
      });
    }
    const modeText={
      health:'The user is asking about dog health. Give general educational guidance, not a diagnosis. Do not prescribe prescription medicines or exact medication dosages. Ask useful follow-up questions when needed. Clearly flag urgent/emergency symptoms and advise contacting a qualified veterinarian promptly. Never delay emergency care.',
      lost:'The user may be dealing with a lost dog. Give practical, calm ReUnite-oriented steps: mark the pet lost, verify QR information, share the QR, check finder messages, and document the last-seen details. Do not expose private owner information.',
      app:'The user is asking about the ReUnite website/app. Explain the known features: accounts, pets, permanent QR identity, scanner, lost/found status, finder-owner chat for lost pets, and account settings. If a feature is not known, say so instead of inventing it.',
      general:'Answer general questions related to dogs, pet safety, lost/found pets, or using ReUnite.'
    }[mode]||'Answer general questions related to dogs, pet safety, lost/found pets, or using ReUnite.';
    const instructions=`You are ReUnite AI Assistant, a warm, concise and safety-first helper inside a lost-dog reunification website. ${modeText} Use simple language suitable for everyday users. If the user describes breathing difficulty, collapse, severe bleeding, poisoning, seizures, heatstroke, unconsciousness, or another potentially life-threatening situation, put an obvious EMERGENCY warning first and tell them to contact an emergency veterinarian immediately. Do not claim to be a veterinarian. Never invent ReUnite features.`;
    const input=[...history.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content})),{role:'user',content:message}];
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-6-luna',instructions,input,max_output_tokens:700})
    });
    const data=await response.json();
    if(!response.ok)return res.status(502).json({error:data?.error?.message||'The AI service could not answer right now.'});
    const answer=String(data.output_text||'').trim();
    if(!answer)return res.status(502).json({error:'The AI returned an empty response.'});
    res.json({answer});
  }catch(err){
    console.error('AI chat error:',err.message);
    res.status(500).json({error:'AI assistant is temporarily unavailable. Please try again.'});
  }
});

// SIGNED-IN USER API: return current user data and their pet lists.
app.get('/api/me', requireLogin, (req,res)=>{
  const user=findUser(req.session.userId); if(!user) return res.status(401).json({error:'Not logged in'});
  const pets=db.pets.filter(p=>p.owner_id===user.id && !p.is_community).sort((a,b)=>b.id-a.id);
  const communityPets=db.pets.filter(p=>p.owner_id===user.id && p.is_community).sort((a,b)=>b.id-a.id);
  const memorials=(db.memorials||[]).filter(m=>m.owner_id===user.id).sort((a,b)=>b.id-a.id);
  res.json({user:{id:user.id,first_name:user.first_name,last_name:user.last_name,email:user.email,state_code:user.state_code||'IN',city:user.city||'',suggested_by:user.suggested_by||'',created_at:user.created_at},pets,communityPets,memorials,is_admin:isAdmin(req)});
});
// Public community reports: only pet details intended for discovery are returned; owner IDs and contact data stay private.
// PUBLIC REPORTS API: return report-safe lost/reunited pet details.
app.get('/api/reports', (req,res)=>{
  const publicReport = p => ({
    id:p.id, name:p.name, pet_type:p.pet_type||'Dog', breed:p.breed||'', photo_url:p.photo_url||'', state_code:findUser(p.owner_id)?.state_code||'',
    status:p.status, lost_date:p.lost_date||null, lost_time:p.lost_time||null,
    last_seen_location:p.last_seen_location||'', lost_info:p.lost_info||'',
    lost_reported_at:p.lost_reported_at||null, reunited_at:p.reunited_at||null
  });
  const lost=db.pets.filter(p=>!p.is_community && p.status==='lost').sort((a,b)=>String(b.lost_reported_at||b.created_at).localeCompare(String(a.lost_reported_at||a.created_at))).map(publicReport);
  const saved=db.pets.filter(p=>!p.is_community && p.status!=='lost' && !!p.reunited_at).sort((a,b)=>String(b.reunited_at).localeCompare(String(a.reunited_at))).map(publicReport);
  res.set('Cache-Control','no-store'); res.json({lost,saved});
});
// OWNED PET ROUTES: read a pet profile belonging to the signed-in user.
app.get('/api/pets/:id', requireLogin, (req,res)=>{ const pet=ownPet(req,req.params.id); if(!pet||pet.is_community)return res.status(404).json({error:'Pet not found'}); res.json({...pet,qr_url:qrTargetUrl(req,pet),qr_is_local_only:/\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(qrPublicBaseUrl(req))}); });
// OWNED PET COMMENT SETTINGS: only the pet owner can enable/disable comments and view the moderation list.
app.get('/api/pets/:id/reviews',requireLogin,(req,res)=>{
  const pet=ownPet(req,req.params.id);if(!pet)return res.status(404).json({error:'Pet not found'});
  const reviews=(db.reviews||[]).filter(r=>r.pet_id===pet.id&&!r.hidden).sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)));
  res.json({enabled:true,reviews});
});
// MEMORY PET ROUTES: read a memorial owned by the signed-in user.
app.get('/api/memorials/:id',requireLogin,(req,res)=>{const m=(db.memorials||[]).find(x=>x.id===Number(req.params.id)&&x.owner_id===Number(req.session.userId));if(!m)return res.status(404).json({error:'Memorial not found'});res.json(m);});
app.post('/memorials',requireLogin,(req,res)=>{const name=String(req.body.name||'').trim(),story=String(req.body.story||'').trim();if(!name||!story)return pageMessage(res,'A memory to keep','Please add your beloved pet’s name and story.','/add-memorial.html');if(name.length>100||story.length>5000)return pageMessage(res,'Please shorten your story','Name must be under 100 characters and story under 5,000 characters.','/add-memorial.html');const memorial={id:db.nextMemorialId||1,owner_id:Number(req.session.userId),name,pet_type:String(req.body.pet_type||'Pet').slice(0,40),birth_date:String(req.body.birth_date||'').slice(0,20),remembrance_date:String(req.body.remembrance_date||'').slice(0,20),story,photo_url:null,created_at:new Date().toISOString()};db.nextMemorialId=memorial.id+1;const photo=savePhotoData('memorial-'+memorial.id,req.body.photo_data);if(req.body.photo_data&&!photo)return pageMessage(res,'Photo could not be saved','Please choose a JPG, PNG or WebP image under 2 MB.','/add-memorial.html');memorial.photo_url=photo;(db.memorials||(db.memorials=[])).push(memorial);saveDb();res.redirect('/memorial-details.html?id='+memorial.id);});
app.post('/memorials/:id/delete',requireLogin,(req,res)=>{const i=(db.memorials||[]).findIndex(m=>m.id===Number(req.params.id)&&m.owner_id===Number(req.session.userId));if(i<0)return pageMessage(res,'Memorial not found','This memory could not be found.','/pet.html');const m=db.memorials[i];if(m.photo_url&&m.photo_url.startsWith('/uploads/')){try{fs.unlinkSync(path.join(__dirname,m.photo_url))}catch{}}db.memorials.splice(i,1);saveDb();res.redirect('/pet.html');});
// Short, stable QR destination for owned and community pet profiles.
app.get('/p/:qrId',(req,res)=>{
  const qrId=String(req.params.qrId||'').trim().toUpperCase();
  const exists=db.pets.some(p=>String(p.qr_id||'').trim().toUpperCase()===qrId && p.status!=='disabled');
  if(!exists) return res.status(404).send('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReUnite QR not found</title><body style="font-family:system-ui;padding:32px;text-align:center"><h1>Pet profile not found</h1><p>This QR identity is not registered or is no longer active. Please ask the owner for a fresh QR code.</p></body></html>');
  res.redirect(302,`/public-pet.html?qr=${encodeURIComponent(qrId)}`);
});

// PUBLIC QR ROUTES: return safe profile details for a scanned QR code.
app.get('/api/public-pets/:qrId',(req,res)=>{
  const qrId=String(req.params.qrId||'').trim().toUpperCase();
  const pet=db.pets.find(p=>String(p.qr_id||'').trim().toUpperCase()===qrId);
  if(!pet || pet.status==='disabled') return res.status(404).json({error:'This ReUnite QR identity was not found. Please check the QR code or ask the owner to generate a fresh one.'});
  const {owner_id,...publicPet}=pet;
  const owner=findUser(owner_id);
  publicPet.owner_city=owner?.city||'';
  if(pet.is_community){ publicPet.status='community'; publicPet.lost_date=null; publicPet.lost_time=null; publicPet.last_seen_location=''; publicPet.lost_info=''; }
  res.set('Cache-Control','no-store');
  res.json(publicPet);
});

// PET COMMUNITY REVIEWS: public read, one review per signed-in member per pet.
app.get('/api/public-pets/:qrId/reviews',(req,res)=>{
  const pet=db.pets.find(p=>p.qr_id===req.params.qrId && p.status!=='disabled');
  if(!pet)return res.status(404).json({error:'Pet not found'});
  const enabled=true;
  const reviews=enabled?(db.reviews||[]).filter(r=>r.pet_id===pet.id && !r.hidden).sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at))).map(r=>({id:r.id,member_name:r.member_name,body:r.body,created_at:r.created_at,updated_at:r.updated_at||null})): [];
  const mine=req.session.userId ? (db.reviews||[]).find(r=>r.pet_id===pet.id&&r.user_id===Number(req.session.userId)&&!r.hidden) : null;
  res.json({enabled,reviews,mine:mine?{id:mine.id,body:mine.body,created_at:mine.created_at,updated_at:mine.updated_at||null,next_edit_at:new Date(new Date(mine.updated_at||mine.created_at).getTime()+30*24*60*60*1000).toISOString()}:null,logged_in:!!req.session.userId});
});
app.post('/api/public-pets/:qrId/reviews',requireLogin,(req,res)=>{
  const pet=db.pets.find(p=>p.qr_id===req.params.qrId && p.status!=='disabled');
  if(!pet)return res.status(404).json({error:'Pet not found'});
  
  const body=String(req.body.body||'').trim();
  if(!body)return res.status(400).json({error:'Please write a comment.'});
  if(body.length>500)return res.status(400).json({error:'Comment must be 500 characters or less.'});
  const user=findUser(req.session.userId); if(!user)return res.status(401).json({error:'Please log in again.'});
  const existing=(db.reviews||[]).find(r=>r.pet_id===pet.id&&r.user_id===user.id);
  if(existing){if(existing.hidden)return res.status(409).json({error:'Your comment was removed. Contact support if you need help.'});return res.status(409).json({error:'You have already commented on this pet. Edit your existing comment instead.'});}
  const review={id:db.nextReviewId||1,pet_id:pet.id,user_id:user.id,member_name:[user.first_name,user.last_name].filter(Boolean).join(' ')||'ReUnite Member',body,created_at:new Date().toISOString(),updated_at:null,hidden:false};
  db.nextReviewId=review.id+1;(db.reviews||(db.reviews=[])).push(review);saveDb();res.status(201).json({review:{id:review.id,member_name:review.member_name,body:review.body,created_at:review.created_at,updated_at:null}});
});
app.put('/api/public-pets/:qrId/reviews/:id',requireLogin,(req,res)=>{
  const pet=db.pets.find(p=>p.qr_id===req.params.qrId);if(!pet)return res.status(404).json({error:'Pet not found'});
  
  const review=(db.reviews||[]).find(r=>r.id===Number(req.params.id)&&r.pet_id===pet.id&&r.user_id===Number(req.session.userId)&&!r.hidden);
  if(!review)return res.status(404).json({error:'Your comment was not found.'});
  const lastEdit=new Date(review.updated_at||review.created_at).getTime();
  const editAfter=lastEdit+30*24*60*60*1000;
  if(Date.now()<editAfter)return res.status(403).json({error:'You can edit this comment after '+new Date(editAfter).toLocaleDateString()+'.'});
  const body=String(req.body.body||'').trim();if(!body)return res.status(400).json({error:'Comment cannot be empty.'});if(body.length>500)return res.status(400).json({error:'Comment must be 500 characters or less.'});
  review.body=body;review.updated_at=new Date().toISOString();saveDb();res.json({ok:true});
});
app.post('/api/public-pets/:qrId/reviews/:id/report',requireLogin,(req,res)=>{
  const pet=db.pets.find(p=>p.qr_id===req.params.qrId);const review=(db.reviews||[]).find(r=>pet&&r.id===Number(req.params.id)&&r.pet_id===pet.id&&!r.hidden);
  if(!review)return res.status(404).json({error:'Comment not found.'});
  (db.reviewReports||(db.reviewReports=[])).push({review_id:review.id,reporter_id:Number(req.session.userId),reason:String(req.body.reason||'Inappropriate content').slice(0,200),created_at:new Date().toISOString()});saveDb();res.json({ok:true,message:'Comment reported. Thank you.'});
});


// Public lost-pet chat. Finder does not need an account; a random conversation token
// identifies the finder-side conversation without exposing the owner's contact details.
app.get('/api/public-pets/:qrId/messages',(req,res)=>{
  const pet=db.pets.find(p=>p.qr_id===req.params.qrId);
  if(!pet)return res.status(404).json({error:'Pet not found'});
  if(pet.is_community)return res.status(403).json({error:'Community pets do not use Lost/Found chat.'});
  if(pet.status!=='lost')return res.status(403).json({error:'Chat is available only while this pet is lost.'});
  const token=String(req.query.token||'');
  if(!token)return res.json({messages:[]});
  const messages=db.messages.filter(m=>m.pet_id===pet.id&&m.finder_token===token).sort((a,b)=>a.id-b.id).map(m=>({id:m.id,sender:m.sender,body:m.body,created_at:m.created_at}));
  res.json({messages});
});
app.post('/api/public-pets/:qrId/messages',(req,res)=>{
  const pet=db.pets.find(p=>p.qr_id===req.params.qrId);
  if(!pet)return res.status(404).json({error:'Pet not found'});
  if(pet.is_community)return res.status(403).json({error:'Community pets do not use Lost/Found chat.'});
  if(pet.status!=='lost')return res.status(403).json({error:'Chat is available only while this pet is lost.'});
  const body=String(req.body.body||'').trim();
  const finderName=String(req.body.finder_name||'').trim().slice(0,80);
  const finderContact=String(req.body.finder_contact||'').trim().slice(0,120);
  let token=String(req.body.token||'').trim();
  if(!body)return res.status(400).json({error:'Message cannot be empty.'});
  if(body.length>1000)return res.status(400).json({error:'Message is too long.'});
  if(!token)token=crypto.randomBytes(24).toString('hex');
  const hasConversation=db.messages.some(m=>m.pet_id===pet.id&&m.finder_token===token);
  if(!hasConversation&&!finderName)return res.status(400).json({error:'Please enter your name.'});
  if(!hasConversation){
    // Keep finder details only inside the private conversation; they are never returned by the public pet API.
  }
  const message={id:db.nextMessageId++,pet_id:pet.id,owner_id:pet.owner_id,finder_token:token,finder_name:finderName||null,finder_contact:finderContact||null,sender:'finder',body,created_at:new Date().toISOString()};
  db.messages.push(message); saveDb();
  res.json({ok:true,token,message:{id:message.id,sender:message.sender,body:message.body,created_at:message.created_at}});
});
// MESSAGE ROUTES: show conversations available to the signed-in owner.
app.get('/api/messages',requireLogin,(req,res)=>{
  const mine=db.messages.filter(m=>m.owner_id===Number(req.session.userId)).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const grouped=[];
  for(const m of mine){
    let c=grouped.find(x=>x.pet_id===m.pet_id&&x.finder_token===m.finder_token);
    if(!c){ const pet=findPet(m.pet_id); c={pet_id:m.pet_id,pet_name:pet?.name||'Pet',qr_id:pet?.qr_id||'',finder_token:m.finder_token,finder_name:m.finder_name||'Finder',finder_contact:m.finder_contact||'',messages:[]}; grouped.push(c); }
    c.messages.push({id:m.id,sender:m.sender,body:m.body,created_at:m.created_at,finder_token:m.finder_token});
    if(m.finder_name)c.finder_name=m.finder_name;
    if(m.finder_contact)c.finder_contact=m.finder_contact;
  }
  res.json({conversations:grouped});
});
app.post('/api/messages/reply',requireLogin,(req,res)=>{
  const petId=Number(req.body.pet_id), token=String(req.body.token||'').trim(), body=String(req.body.body||'').trim();
  const pet=ownPet(req,petId);
  if(!pet||!token)return res.status(404).json({error:'Conversation not found.'});
  if(!body)return res.status(400).json({error:'Reply cannot be empty.'});
  if(body.length>1000)return res.status(400).json({error:'Reply is too long.'});
  const conversation=db.messages.find(m=>m.pet_id===pet.id&&m.finder_token===token);
  if(!conversation)return res.status(404).json({error:'Conversation not found.'});
  const message={id:db.nextMessageId++,pet_id:pet.id,owner_id:pet.owner_id,finder_token:token,finder_name:conversation.finder_name||null,finder_contact:conversation.finder_contact||null,sender:'owner',body,created_at:new Date().toISOString()};
  db.messages.push(message); saveDb(); res.json({ok:true,message:{id:message.id,sender:message.sender,body:message.body,created_at:message.created_at}});
});
// ADMIN ROUTES: summary and moderation tools restricted to admins.
app.get('/api/admin/summary',requireAdmin,(req,res)=>{
  const users=db.users.map(u=>({id:u.id,name:`${u.first_name} ${u.last_name}`,email:u.email,state_code:u.state_code||'IN',suggested_by:u.suggested_by||'',created_at:u.created_at,pet_count:db.pets.filter(p=>p.owner_id===u.id).length}));
  const pets=db.pets.map(p=>({id:p.id,name:p.name,breed:p.breed||'',status:p.status,owner_id:p.owner_id,qr_id:p.qr_id,photo_url:p.photo_url||'',created_at:p.created_at}));
  const messages=db.messages.map(m=>({id:m.id,pet_id:m.pet_id,pet_name:findPet(m.pet_id)?.name||'Pet',sender:m.sender,body:m.body,created_at:m.created_at}));
  res.json({is_admin:true,stats:{users:db.users.length,pets:db.pets.length,lost:db.pets.filter(p=>p.status==='lost').length,safe:db.pets.filter(p=>p.status!=='lost').length,messages:db.messages.length},users,pets,messages});
});
app.post('/api/admin/pets/:id/status',requireAdmin,(req,res)=>{
  const pet=findPet(req.params.id); if(!pet)return res.status(404).json({error:'Pet not found'});
  const status=String(req.body.status||'').trim(); if(!['safe','lost','disabled'].includes(status))return res.status(400).json({error:'Invalid status'});
  pet.status=status; saveDb(); res.json({ok:true,pet:{id:pet.id,status:pet.status}});
});

// QR ROUTES: generate the QR code for a user-owned pet.
app.get('/api/pets/:id/qr',requireLogin,async(req,res)=>{ const pet=ownPet(req,req.params.id); if(!pet||pet.is_community)return res.status(404).send('Pet not found');
  const target=qrTargetUrl(req,pet);
  try{res.set('Cache-Control','no-store');res.type('svg').send(await QRCode.toString(target,{type:'svg',margin:3,width:320,errorCorrectionLevel:'H'}));}catch(e){res.status(500).send('QR generation failed');} });

// Adoption board: owners may voluntarily list pets; public viewers see safe pet data only.
app.get('/api/adoptions',(req,res)=>{const pets=db.pets.filter(p=>!p.is_community&&p.available_for_adoption).map(p=>({id:p.id,name:p.name,pet_type:p.pet_type,breed:p.breed,photo_url:p.photo_url,photo_urls:p.photo_urls||[],city:findUser(p.owner_id)?.city||'',temperament:p.temperament||'',description:p.adoption_description||''}));res.json({pets});});
app.post('/api/adoption/requests',requireLogin,(req,res)=>{const pet=db.pets.find(p=>p.id===Number(req.body.pet_id)&&p.available_for_adoption&&!p.is_community);if(!pet)return res.status(404).json({error:'This pet is not listed for adoption.'});if(pet.owner_id===Number(req.session.userId))return res.status(400).json({error:'You cannot apply to adopt your own pet.'});const message=String(req.body.message||'').trim(),contact=String(req.body.contact||'').trim();if(!message||!contact)return res.status(400).json({error:'Add a message and safe contact method.'});db.adoptionRequests=db.adoptionRequests||[];db.adoptionRequests.push({id:db.nextAdoptionRequestId||1,pet_id:pet.id,pet_name:pet.name,owner_id:pet.owner_id,applicant_id:Number(req.session.userId),applicant_name:[currentUser(req).first_name,currentUser(req).last_name].join(' '),message:message.slice(0,1500),contact:contact.slice(0,160),created_at:new Date().toISOString()});db.nextAdoptionRequestId=(db.nextAdoptionRequestId||1)+1;saveDb();res.status(201).json({ok:true});});
app.get('/api/adoption/requests',requireLogin,(req,res)=>{const uid=Number(req.session.userId);const requests=(db.adoptionRequests||[]).filter(x=>x.owner_id===uid||x.applicant_id===uid).map(x=>({...x,contact:x.owner_id===uid?x.contact:'Private until owner responds'}));res.json({requests});});
app.post('/pets/:id/adoption',requireLogin,(req,res)=>{const pet=ownPet(req,req.params.id);if(!pet||pet.is_community)return res.status(404).send('Pet not found');pet.available_for_adoption=req.body.available==='1';pet.adoption_description=String(req.body.description||'').slice(0,1000);saveDb();res.redirect('/pet-details.html?id='+pet.id);});
app.post('/pets/:id/reissue-qr',requireLogin,(req,res)=>{const pet=ownPet(req,req.params.id);if(!pet)return res.status(404).send('Pet not found');pet.previous_qr_ids=[...(pet.previous_qr_ids||[]),pet.qr_id];pet.qr_id=makeQrId(req.session.userId);saveDb();res.redirect('/pet-details.html?id='+pet.id);});
app.post('/community-pets/:id/health-log',requireLogin,(req,res)=>{const pet=ownPet(req,req.params.id);if(!pet||!pet.is_community)return res.status(404).send('Community pet not found');pet.health_logs=pet.health_logs||[];pet.health_logs.push({date:String(req.body.date||''),type:String(req.body.type||'').slice(0,40),notes:String(req.body.notes||'').slice(0,500),created_at:new Date().toISOString()});saveDb();res.redirect('/community-pet-details.html?id='+pet.id);});
// COMMUNITY PET ROUTES: create/update local community-animal profiles.
app.post('/community-pets',requireLogin,(req,res)=>{
  const name=String(req.body.name||'').trim();
  const petType=resolvePetType(req.body);
  const usualLocation=String(req.body.usual_location||'').trim();
  if(!name||!petType||!usualLocation)return pageMessage(res,'Missing details','Please enter the local name, pet type (type the animal name if you chose Other) and usual location.','/add-community-pet.html');
  if(name.length>100||petType.length>40||usualLocation.length>240)return pageMessage(res,'Details too long','Please shorten the pet details and location.','/add-community-pet.html');
  const pet={id:db.nextPetId++,owner_id:req.session.userId,name,pet_type:petType,breed:'',age:'',gender:'',identifying_info:'',usual_location:usualLocation,photo_url:null,qr_id:makeQrId(req.session.userId),status:'community',is_community:true,lost_date:null,lost_time:null,last_seen_location:'',lost_info:'',created_at:new Date().toISOString()};
  const photo=savePhotoData(pet.id,req.body.photo_data); if(req.body.photo_data&&!photo)return pageMessage(res,'Photo could not be saved','Please choose a JPG, PNG or WebP image under 2 MB.','/add-community-pet.html');
  pet.photo_url=photo; db.pets.push(pet); saveDb(); res.redirect('/community-pet-details.html?id='+pet.id);
});
app.get('/api/community-pets/:id',requireLogin,(req,res)=>{const pet=ownPet(req,req.params.id);if(!pet||!pet.is_community)return res.status(404).json({error:'Community pet not found'});res.json({...pet,qr_url:qrTargetUrl(req,pet)});});
app.get('/api/community-pets/:id/qr',requireLogin,async(req,res)=>{const pet=ownPet(req,req.params.id);if(!pet||!pet.is_community)return res.status(404).send('Community pet not found');const target=qrTargetUrl(req,pet);try{res.set('Cache-Control','no-store');res.type('svg').send(await QRCode.toString(target,{type:'svg',margin:3,width:320,errorCorrectionLevel:'H'}));}catch(e){res.status(500).send('QR generation failed');}});
app.post('/community-pets/:id/update',requireLogin,(req,res)=>{const pet=ownPet(req,req.params.id);if(!pet||!pet.is_community)return pageMessage(res,'Community pet not found','This profile is not available.','/pet.html');const name=String(req.body.name||'').trim(),type=resolvePetType(req.body),loc=String(req.body.usual_location||'').trim();if(!name||!type||!loc)return pageMessage(res,'Missing details','Please enter the local name, pet type and usual location.','/community-pet-details.html?id='+pet.id);pet.name=name.slice(0,100);pet.pet_type=type.slice(0,40);pet.usual_location=loc.slice(0,240);if(req.body.photo_data){const photo=savePhotoData(pet.id,req.body.photo_data);if(!photo)return pageMessage(res,'Photo could not be saved','Please choose a JPG, PNG or WebP image under 2 MB.','/community-pet-details.html?id='+pet.id);pet.photo_url=photo;}saveDb();res.redirect('/community-pet-details.html?id='+pet.id);});

// MY PET ROUTES: register, edit, delete, or update a personally owned pet.
app.post('/pets',requireLogin,(req,res)=>{
  const name=(req.body.name||'').trim(); if(!name)return pageMessage(res,'Pet name required',"Please enter your pet's name.",'/add-pet.html');
  const petType=resolvePetType(req.body); if(!petType)return pageMessage(res,'Pet type needed','Please choose a pet type. If you chose Other, type the animal name in the box that appears.','/add-pet.html');
  const pet={id:db.nextPetId,owner_id:req.session.userId,name,pet_type:petType,breed:(req.body.breed||'').trim(),year_acquired:String(req.body.year_acquired||'').trim(),gender:req.body.gender||'',identifying_info:(req.body.identifying_info||'').trim(),allergies:(req.body.allergies||'').trim(),medications:(req.body.medications||'').trim(),vaccination_status:(req.body.vaccination_status||'').trim(),rabies_status:(req.body.rabies_status||'').trim(),vet_contact:(req.body.vet_contact||'').trim(),temperament:(req.body.temperament||'').trim(),photo_urls:[],photo_url:null,qr_id:makeQrId(req.session.userId),status:'safe',is_community:false,lost_date:null,lost_time:null,last_seen_location:'',lost_info:'',created_at:new Date().toISOString()};
  const photoSet=savePetPhotoSet(pet.id,req.body.photo_data,req.body.photo_data_list);
  if(photoSet.error)return pageMessage(res,'Photos could not be saved',photoSet.error,'/add-pet.html');
  pet.photo_urls=photoSet.photos;pet.photo_url=photoSet.photos[0]||null;
  db.nextPetId++;db.pets.push(pet);saveDb();res.redirect('/pet-details.html?id='+pet.id);
});
app.post('/pets/:id/delete',requireLogin,(req,res)=>{
  const pet=ownPet(req,req.params.id);
  if(!pet || pet.is_community) return pageMessage(res,'Pet not found','This pet does not belong to your account.','/pet.html');
  for(const photo of new Set([pet.photo_url,...(pet.photo_urls||[])].filter(Boolean))) deletePhotoFile(photo);
  // Remove conversations/messages associated with this pet so deleted profiles do not leave orphaned chat data.
  if(Array.isArray(db.messages)) db.messages=db.messages.filter(m=>Number(m.pet_id)!==Number(pet.id));
  if(Array.isArray(db.chats)) db.chats=db.chats.filter(c=>Number(c.pet_id)!==Number(pet.id));
  db.pets=db.pets.filter(p=>Number(p.id)!==Number(pet.id));
  saveDb();
  res.redirect('/pet.html');
});
app.post('/pets/:id/update',requireLogin,(req,res)=>{
  const pet=ownPet(req,req.params.id); if(!pet)return pageMessage(res,'Pet not found','This pet does not belong to the logged-in account.','/pet.html');
  if(pet.is_community)return pageMessage(res,'Community pet','Use the community pet form to edit this profile.','/pet.html');
  const back='/edit-pet.html?id='+pet.id;
  const petType=resolvePetType(req.body); if(!petType)return pageMessage(res,'Pet type needed','Please choose a pet type. If you chose Other, type the animal name in the box that appears.',back);
  // Photos: keep_photos = existing photos the owner kept; photo_data + photo_data_list = newly added photos.
  const existing=(Array.isArray(pet.photo_urls)&&pet.photo_urls.length)?[...pet.photo_urls]:(pet.photo_url?[pet.photo_url]:[]);
  let keep=existing, extras=[];
  try{
    if(req.body.keep_photos!==undefined&&req.body.keep_photos!==''){const k=JSON.parse(req.body.keep_photos);if(!Array.isArray(k))throw new Error('bad');keep=existing.filter(u=>k.includes(u));}
    if(req.body.photo_data_list){extras=JSON.parse(req.body.photo_data_list);if(!Array.isArray(extras))throw new Error('bad');}
  }catch{return pageMessage(res,'Photos could not be read','Please select your photos again.',back);}
  const incoming=[req.body.photo_data,...extras].filter(Boolean);
  if(keep.length+incoming.length>9)return pageMessage(res,'Too many photos','A pet can have up to 9 photos. Remove a photo or choose fewer new ones.',back);
  const saved=[];
  for(let i=0;i<incoming.length;i++){const url=savePhotoData(`${pet.id}-edit-${i}`,incoming[i]);if(!url){saved.forEach(deletePhotoFile);return pageMessage(res,'Photo could not be saved','Each photo must be a valid JPG, PNG or WebP image under 2 MB.',back);}saved.push(url);}
  existing.filter(u=>!keep.includes(u)).forEach(deletePhotoFile);
  pet.photo_urls=[...keep,...saved]; pet.photo_url=pet.photo_urls[0]||null;
  pet.name=(req.body.name||'').trim()||pet.name; pet.pet_type=petType; pet.breed=(req.body.breed||'').trim(); pet.year_acquired=String(req.body.year_acquired||'').trim(); pet.gender=req.body.gender||''; pet.identifying_info=(req.body.identifying_info||'').trim(); pet.allergies=(req.body.allergies||'').trim(); pet.medications=(req.body.medications||'').trim(); pet.vaccination_status=(req.body.vaccination_status||'').trim(); pet.rabies_status=(req.body.rabies_status||'').trim(); pet.vet_contact=(req.body.vet_contact||'').trim(); pet.temperament=(req.body.temperament||'').trim();
  saveDb(); res.redirect('/pet-details.html?id='+pet.id);
});
app.post('/pets/:id/lost',requireLogin,(req,res)=>{
  const pet=ownPet(req,req.params.id); if(!pet||pet.is_community)return pageMessage(res,'Pet not found','Lost/Found status is only available for owned pets.','/pet.html');
  pet.status='lost'; pet.lost_reported_at=new Date().toISOString(); pet.reunited_at=null; pet.lost_date=req.body.lost_date||null; pet.lost_time=req.body.lost_time||null; pet.last_seen_location=(req.body.last_seen_location||'').trim(); pet.lost_info=(req.body.lost_info||'').trim(); saveDb(); res.redirect('/pet-details.html?id='+pet.id);
});
app.post('/pets/:id/found',requireLogin,(req,res)=>{ const pet=ownPet(req,req.params.id); if(!pet||pet.is_community)return pageMessage(res,'Pet not found','Lost/Found status is only available for owned pets.','/pet.html'); pet.status='safe'; pet.reunited_at=new Date().toISOString(); pet.lost_date=null; pet.lost_time=null; pet.last_seen_location=''; pet.lost_info=''; saveDb(); res.redirect('/pet-details.html?id='+pet.id); });

app.post('/user/update',requireLogin,(req,res)=>{
  const user=findUser(req.session.userId); if(!user)return res.redirect('/login.html');
  const first=(req.body.first_name||'').trim(), last=(req.body.last_name||'').trim(), email=(req.body.email||'').trim().toLowerCase();
  if(!first||!last||!email)return pageMessage(res,'Missing details','Please fill all user details.','/edit-user.html');
  if(db.users.some(u=>u.id!==user.id&&u.email===email))return pageMessage(res,'Email already used','Please use another email address.','/edit-user.html');
  const stateCode=String(req.body.state_code||user.state_code||'').trim().toUpperCase();
  if(!STATE_CODES.has(stateCode))return pageMessage(res,'State required','Please select a valid state or union territory.','/edit-user.html');
  const city=resolveCity(stateCode,req.body); if(!city)return pageMessage(res,'City / District required','Please select your city / district from the list for your state.','/edit-user.html');
  user.first_name=first; user.last_name=last; user.email=email; user.state_code=stateCode; user.city=city; saveDb(); res.redirect('/account.html');
});

// SERVER START: listen on the local port and show the Wi-Fi address.

// GLOBAL SOCIAL COMMUNITY: public read access; every write requires a registered member session.
app.get('/api/global/members', (req,res)=>{
  const members=db.users.map(u=>{const owned=db.pets.filter(p=>p.owner_id===u.id&&!p.is_community),community=db.pets.filter(p=>p.owner_id===u.id&&p.is_community),reunions=owned.filter(p=>p.reunited_at).length,points=owned.length*10+community.length*15+reunions*100;return {id:u.id,name:[u.first_name,u.last_name].filter(Boolean).join(' '),state_code:u.state_code||'',city:u.city||'',joined_at:u.created_at,registered_pets:owned.length,community_pets:community.length,reunions,points,badge:reunions?'Reunion Champion':community.length?'Community Helper':'Pet Guardian'};}).sort((a,b)=>b.points-a.points||a.id-b.id).map((m,i)=>({...m,rank:i+1}));
  res.json({members,logged_in:!!req.session.userId});
});
app.get('/api/global/feed',(req,res)=>{
  const uid=Number(req.session.userId||0), blocked=new Set((db.userBlocks||[]).filter(x=>x.blocker_id===uid||x.blocked_id===uid).map(x=>x.blocker_id===uid?x.blocked_id:x.blocker_id));
  const posts=(db.posts||[]).filter(p=>!blocked.has(p.user_id)).slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,100).map(p=>{const u=findUser(p.user_id);return {...p,author_name:u?[u.first_name,u.last_name].filter(Boolean).join(' '):'ReUnite member',like_count:(db.postLikes||[]).filter(x=>x.post_id===p.id).length,comment_count:(db.postComments||[]).filter(x=>x.post_id===p.id).length,liked:!!uid&&(db.postLikes||[]).some(x=>x.post_id===p.id&&x.user_id===uid),can_edit:!!uid&&p.user_id===uid,following:!!uid&&(db.follows||[]).some(x=>x.follower_id===uid&&x.following_id===p.user_id),author_id:p.user_id,pet_name:p.pet_id&&findPet(p.pet_id)?findPet(p.pet_id).name:null};});
  res.json({posts,logged_in:!!uid,user_id:uid});
});
app.post('/api/global/posts',requireLogin,(req,res)=>{
  const body=String(req.body.body||'').trim(),category=String(req.body.category||'My Pet').slice(0,40);if(!body)return res.status(400).json({error:'Please write something before posting.'});if(body.length>3000)return res.status(400).json({error:'Post must be 3,000 characters or less.'});
  const id=db.nextPostId||1;db.nextPostId=id+1;let photo_url=null;if(req.body.photo_data){const m=String(req.body.photo_data).match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);if(!m)return res.status(400).json({error:'Use a JPG, PNG or WebP image.'});const b=Buffer.from(m[2],'base64');if(b.length>2*1024*1024)return res.status(400).json({error:'Photo must be under 2 MB.'});const ext=m[1].toLowerCase()==='jpeg'?'jpg':m[1].toLowerCase(),name=`post-${id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;fs.writeFileSync(path.join(uploadsDir,name),b);photo_url='/uploads/'+name;}
  const petId=Number(req.body.pet_id||0);if(petId&&!ownPet(req,petId))return res.status(400).json({error:'You can only attach one of your own pets.'});const post={id,user_id:Number(req.session.userId),body,category,pet_id:petId||null,photo_url,created_at:new Date().toISOString()};(db.posts||(db.posts=[])).push(post);saveDb();res.status(201).json({post});
});
app.delete('/api/global/posts/:id',requireLogin,(req,res)=>{const id=Number(req.params.id),i=(db.posts||[]).findIndex(p=>p.id===id&&p.user_id===Number(req.session.userId));if(i<0)return res.status(404).json({error:'Post not found or not yours.'});const [p]=db.posts.splice(i,1);db.postLikes=(db.postLikes||[]).filter(x=>x.post_id!==id);db.postComments=(db.postComments||[]).filter(x=>x.post_id!==id);if(p.photo_url){try{fs.unlinkSync(path.join(__dirname,p.photo_url))}catch{}}saveDb();res.json({ok:true});});
app.post('/api/global/posts/:id/like',requireLogin,(req,res)=>{const id=Number(req.params.id);if(!(db.posts||[]).some(p=>p.id===id))return res.status(404).json({error:'Post not found.'});db.postLikes=db.postLikes||[];const i=db.postLikes.findIndex(x=>x.post_id===id&&x.user_id===Number(req.session.userId));if(i>=0)db.postLikes.splice(i,1);else{db.postLikes.push({post_id:id,user_id:Number(req.session.userId)});const post=db.posts.find(p=>p.id===id),uid=Number(req.session.userId);if(post&&post.user_id!==uid){db.notifications=db.notifications||[];db.notifications.push({id:db.nextNotificationId||1,user_id:post.user_id,actor_id:uid,type:'like',message:'liked your post',created_at:new Date().toISOString(),read:false});db.nextNotificationId=(db.nextNotificationId||1)+1;}}saveDb();res.json({liked:i<0,like_count:db.postLikes.filter(x=>x.post_id===id).length});});
app.get('/api/global/posts/:id/comments',(req,res)=>{const id=Number(req.params.id);if(!(db.posts||[]).some(p=>p.id===id))return res.status(404).json({error:'Post not found.'});const comments=(db.postComments||[]).filter(c=>c.post_id===id).map(c=>{const u=findUser(c.user_id);return {...c,author_name:u?[u.first_name,u.last_name].filter(Boolean).join(' '):'Member',can_delete:!!req.session.userId&&c.user_id===Number(req.session.userId)}});res.json({comments,logged_in:!!req.session.userId});});
app.post('/api/global/posts/:id/comments',requireLogin,(req,res)=>{const id=Number(req.params.id),body=String(req.body.body||'').trim();if(!(db.posts||[]).some(p=>p.id===id))return res.status(404).json({error:'Post not found.'});if(!body||body.length>1000)return res.status(400).json({error:'Comment must be 1–1,000 characters.'});db.postComments=db.postComments||[];const c={id:db.nextPostCommentId||1,post_id:id,user_id:Number(req.session.userId),body,created_at:new Date().toISOString()};db.nextPostCommentId=c.id+1;db.postComments.push(c);const post=db.posts.find(p=>p.id===id),uid=Number(req.session.userId);if(post&&post.user_id!==uid){db.notifications=db.notifications||[];db.notifications.push({id:db.nextNotificationId||1,user_id:post.user_id,actor_id:uid,type:'comment',message:'commented on your post',created_at:new Date().toISOString(),read:false});db.nextNotificationId=(db.nextNotificationId||1)+1;}saveDb();res.status(201).json({comment:c});});
app.put('/api/global/comments/:id',requireLogin,(req,res)=>{const c=(db.postComments||[]).find(x=>x.id===Number(req.params.id)&&x.user_id===Number(req.session.userId));if(!c)return res.status(404).json({error:'Comment not found or not yours.'});const body=String(req.body.body||'').trim();if(!body||body.length>1000)return res.status(400).json({error:'Comment must contain 1–1,000 characters.'});c.body=body;c.updated_at=new Date().toISOString();saveDb();res.json({comment:c});});
app.delete('/api/global/comments/:id',requireLogin,(req,res)=>{const i=(db.postComments||[]).findIndex(c=>c.id===Number(req.params.id)&&c.user_id===Number(req.session.userId));if(i<0)return res.status(404).json({error:'Comment not found or not yours.'});db.postComments.splice(i,1);saveDb();res.json({ok:true});});


// Social profiles, follows, notifications, reports, blocks and post editing.
app.get('/api/global/my-pets',requireLogin,(req,res)=>{const pets=db.pets.filter(p=>p.owner_id===Number(req.session.userId)&&!p.is_community).map(p=>({id:p.id,name:p.name,pet_type:p.pet_type}));res.json({pets});});
app.get('/api/global/profile/:id',(req,res)=>{
  const id=Number(req.params.id),u=findUser(id); if(!u)return res.status(404).json({error:'Member not found.'});
  const owned=db.pets.filter(p=>p.owner_id===id&&!p.is_community),community=db.pets.filter(p=>p.owner_id===id&&p.is_community);
  const posts=(db.posts||[]).filter(p=>p.user_id===id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,30).map(p=>({...p,like_count:(db.postLikes||[]).filter(x=>x.post_id===p.id).length,comment_count:(db.postComments||[]).filter(x=>x.post_id===p.id).length}));
  const uid=Number(req.session.userId||0);
  res.json({profile:{id,name:[u.first_name,u.last_name].filter(Boolean).join(' '),bio:u.community_bio||'',avatar_url:u.community_avatar||null,state_code:u.state_code||'',city:u.city||'',joined_at:u.created_at,registered_pets:owned.length,community_pets:community.length,reunions:owned.filter(p=>p.reunited_at).length,pets:owned.map(p=>({id:p.id,name:p.name,pet_type:p.pet_type,photo_url:p.photo_url||null,status:p.status||'safe'})),posts},logged_in:!!uid,is_self:uid===id,following:!!uid&&(db.follows||[]).some(x=>x.follower_id===uid&&x.following_id===id),followers:(db.follows||[]).filter(x=>x.following_id===id).length,following_count:(db.follows||[]).filter(x=>x.follower_id===id).length,blocked:!!uid&&(db.userBlocks||[]).some(x=>x.blocker_id===uid&&x.blocked_id===id)});
});
app.put('/api/global/profile',(req,res)=>{
  const u=currentUser(req); if(!u)return res.status(401).json({error:'Please log in.'});
  const bio=String(req.body.bio||'').trim(); if(bio.length>300)return res.status(400).json({error:'Bio must be 300 characters or less.'});
  u.community_bio=bio;if(req.body.avatar_data){const m=String(req.body.avatar_data).match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);if(!m)return res.status(400).json({error:'Use a JPG, PNG or WebP profile photo.'});const b=Buffer.from(m[2],'base64');if(b.length>2*1024*1024)return res.status(400).json({error:'Profile photo must be under 2 MB.'});const ext=m[1].toLowerCase()==='jpeg'?'jpg':m[1].toLowerCase(),name='community-avatar-'+u.id+'-'+Date.now()+'.'+ext;fs.writeFileSync(path.join(uploadsDir,name),b);u.community_avatar='/uploads/'+name;}saveDb(); res.json({ok:true,bio,avatar_url:u.community_avatar||null});
});
app.post('/api/global/follow/:id',requireLogin,(req,res)=>{
  const target=Number(req.params.id),uid=Number(req.session.userId);
  if(!findUser(target)||target===uid)return res.status(400).json({error:'Invalid member.'});
  db.follows=db.follows||[]; const i=db.follows.findIndex(x=>x.follower_id===uid&&x.following_id===target);
  if(i>=0)db.follows.splice(i,1);else{db.follows.push({follower_id:uid,following_id:target,created_at:new Date().toISOString()});db.notifications=db.notifications||[];db.notifications.push({id:db.nextNotificationId||1,user_id:target,actor_id:uid,type:'follow',message:'started following you',created_at:new Date().toISOString(),read:false});db.nextNotificationId=(db.nextNotificationId||1)+1;}
  saveDb();res.json({following:i<0});
});
app.get('/api/global/notifications',requireLogin,(req,res)=>{
  const uid=Number(req.session.userId);const items=(db.notifications||[]).filter(n=>n.user_id===uid).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,100).map(n=>({...n,actor_name:(()=>{const u=findUser(n.actor_id);return u?[u.first_name,u.last_name].filter(Boolean).join(' '):'ReUnite member';})()}));
  res.json({notifications:items,unread:items.filter(n=>!n.read).length});
});
app.post('/api/global/notifications/read',requireLogin,(req,res)=>{const uid=Number(req.session.userId);(db.notifications||[]).forEach(n=>{if(n.user_id===uid)n.read=true;});saveDb();res.json({ok:true});});
app.put('/api/global/posts/:id',requireLogin,(req,res)=>{
  const p=(db.posts||[]).find(x=>x.id===Number(req.params.id)&&x.user_id===Number(req.session.userId));if(!p)return res.status(404).json({error:'Post not found or not yours.'});
  const body=String(req.body.body||'').trim();if(!body||body.length>3000)return res.status(400).json({error:'Post must contain 1–3,000 characters.'});
  p.body=body;p.updated_at=new Date().toISOString();saveDb();res.json({post:p});
});
app.post('/api/global/reports',requireLogin,(req,res)=>{
  const uid=Number(req.session.userId),type=String(req.body.target_type||''),id=Number(req.body.target_id),reason=String(req.body.reason||'').trim().slice(0,500);
  if(!['post','comment','member'].includes(type)||!id||!reason)return res.status(400).json({error:'Choose a valid item and report reason.'});
  const exists=type==='post'?(db.posts||[]).some(x=>x.id===id):type==='comment'?(db.postComments||[]).some(x=>x.id===id):!!findUser(id);
  if(!exists)return res.status(404).json({error:'Reported item not found.'});
  db.reports=db.reports||[];if(db.reports.some(x=>x.reporter_id===uid&&x.target_type===type&&x.target_id===id&&x.status==='open'))return res.status(409).json({error:'You have already reported this item.'});
  db.reports.push({id:db.nextReportId||1,reporter_id:uid,target_type:type,target_id:id,reason,status:'open',created_at:new Date().toISOString()});db.nextReportId=(db.nextReportId||1)+1;saveDb();res.status(201).json({ok:true});
});
app.post('/api/global/block/:id',requireLogin,(req,res)=>{
  const target=Number(req.params.id),uid=Number(req.session.userId);if(!findUser(target)||target===uid)return res.status(400).json({error:'Invalid member.'});
  db.userBlocks=db.userBlocks||[];const i=db.userBlocks.findIndex(x=>x.blocker_id===uid&&x.blocked_id===target);
  if(i>=0)db.userBlocks.splice(i,1);else db.userBlocks.push({blocker_id:uid,blocked_id:target,created_at:new Date().toISOString()});
  saveDb();res.json({blocked:i<0});
});
app.get('/api/global/admin/reports',requireAdmin,(req,res)=>{const reports=(db.reports||[]).filter(x=>x.status==='open').map(x=>({...x,reporter_name:(()=>{const u=findUser(x.reporter_id);return u?[u.first_name,u.last_name].filter(Boolean).join(' '):'Member';})()}));res.json({reports});});
app.post('/api/global/admin/reports/:id/resolve',requireAdmin,(req,res)=>{const r=(db.reports||[]).find(x=>x.id===Number(req.params.id));if(!r)return res.status(404).json({error:'Report not found.'});r.status='resolved';r.resolved_at=new Date().toISOString();r.resolved_by=Number(req.session.userId);if(req.body.action==='remove'){if(r.target_type==='post'){const p=(db.posts||[]).find(x=>x.id===r.target_id);if(p&&p.photo_url){try{fs.unlinkSync(path.join(__dirname,p.photo_url));}catch{}}db.posts=(db.posts||[]).filter(x=>x.id!==r.target_id);db.postLikes=(db.postLikes||[]).filter(x=>x.post_id!==r.target_id);db.postComments=(db.postComments||[]).filter(x=>x.post_id!==r.target_id);}else if(r.target_type==='comment')db.postComments=(db.postComments||[]).filter(x=>x.id!==r.target_id);}saveDb();res.json({ok:true});});

app.listen(PORT,'0.0.0.0',()=>{
  console.log(`ReUnite running at http://localhost:${PORT}`);
  console.log(`Phone/Wi-Fi access: http://${LAN_IP}:${PORT}`);
  console.log(`QR codes will open: ${process.env.REUNITE_PUBLIC_URL || `http://${LAN_IP}:${PORT}`}/p/<PET-ID>`);
  if (LAN_IP === 'localhost' && !process.env.REUNITE_PUBLIC_URL) console.log('WARNING: no Wi-Fi/LAN address was found, so QR codes only work on this computer. Connect to Wi-Fi, or set REUNITE_LAN_IP in .env.');
  console.log('Phone cannot open it? Allow Node.js through the firewall (Private networks), and make sure both devices use the same Wi-Fi (not a guest network).');
  console.log(`Local database: ${dbFile}`);
});
