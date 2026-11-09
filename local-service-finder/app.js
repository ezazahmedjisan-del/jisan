(() => {
'use strict';
const app = document.getElementById('app');
const toastBox = document.getElementById('toast');
const cfg = window.APP_CONFIG || {};
const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
const db = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
let user = null;
let profile = null;
let categories = [];
let toastTimer = null;
let afterLoginPath = 'profile';

const icons = {'ইলেকট্রিশিয়ান':'💡','প্লাম্বার':'🚿','টিউটর':'📚','এসি মেকানিক':'❄️','ক্লিনিং':'🧹','পেইন্টার':'🖌️','কম্পিউটার সার্ভিস':'💻','মিস্ত্রি':'🧱','ফ্রিজ মেকানিক':'🧊','মোবাইল সার্ভিসিং':'📱','কার্পেন্টার / কাঠমিস্ত্রি':'🪚','ওয়েল্ডিং':'🛠️','টাইলস মিস্ত্রি':'🧱','গ্লাস ও অ্যালুমিনিয়াম':'🪟','সিসিটিভি ও নেটওয়ার্ক':'📹','সেলাই ও দর্জি':'🧵','গাড়ি মেরামত':'🚗','মোটরসাইকেল মেকানিক':'🏍️','জেনারেটর / আইপিএস সার্ভিস':'🔋','লন্ড্রি ও ইস্ত্রি':'👕','বাগান পরিচর্যা':'🌱','ক্যাটারিং / রান্নার সেবা':'🍲','ইভেন্ট সাজসজ্জা':'🎉','ফটোগ্রাফি / ভিডিও':'📷','গ্রাফিক ডিজাইন':'🎨','আইটি ও অনলাইন সাপোর্ট':'🖥️','বাসা বদল / মুভিং':'📦','সোলার প্যানেল সার্ভিস':'☀️','স্যানিটারি ও বাথরুম ফিটিং':'🚿','টিভি ও ইলেকট্রনিক্স মেরামত':'📺','পানির পাম্প সার্ভিস':'💧','ফার্নিচার মেরামত':'🛋️','সেলুন / পার্লার':'💇'};
const LOCAL_CATEGORIES = Object.keys(icons);
const bdLocations = window.BD_LOCATION_DATA || [];
const statusLabels = {pending:'অপেক্ষমাণ',approved:'অনুমোদিত',rejected:'বাতিল',paused:'বিরত',accepted:'গৃহীত',declined:'প্রত্যাখ্যাত',completed:'সম্পন্ন',cancelled:'বাতিল'};

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function money(value) {
  if (value === null || value === undefined || value === '') return 'আলোচনা সাপেক্ষে';
  return '৳ ' + Number(value).toLocaleString('bn-BD') + ' থেকে';
}
function toast(message) {
  toastBox.textContent = message;
  toastBox.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBox.classList.remove('show'), 3400);
}
function notice(message, type) {
  return '<div class="notice ' + (type || '') + '">' + esc(message) + '</div>';
}
function backendNotice() {
  if (db) return '';
  return '<div class="notice warn"><b>নিরাপদ অ্যাকাউন্ট ও ডেটাবেস সংযোগ এখনো সম্পূর্ণ হয়নি।</b><br>এই মুহূর্তে নিবন্ধন, লগইন, প্রোফাইল সংরক্ষণ, বুকিং বা লাইভ সেবাদাতার তালিকা চালু নেই। কোনো ডেমো অ্যাকাউন্ট বা ভুয়া সেবাদাতা দেখানো হচ্ছে না।</div>';
}
function route() {
  const raw = location.hash.replace(/^#/, '') || 'home';
  const pathOnly = raw.split('?')[0];
  const parts = pathOnly.split('/');
  return {name:parts[0], id:parts[1] || ''};
}
function go(path) { location.hash = path; }
function updateNav() {
  const login = document.getElementById('nav-login');
  const signup = document.getElementById('nav-signup');
  if (login) {
    login.textContent = user ? 'আমার প্রোফাইল' : 'লগইন';
    login.href = user ? '#profile' : '#login';
  }
  if (signup) {
    signup.textContent = user ? 'লগআউট' : 'অ্যাকাউন্ট খুলুন';
    signup.href = user ? '#logout' : '#signup-customer';
  }
}
function setupMenu() {
  const toggle = document.getElementById('menu-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) toggle.onclick = () => links.classList.toggle('open');
  if (links) links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}
async function loadSession() {
  if (!db) return;
  const result = await db.auth.getSession();
  user = result.data.session ? result.data.session.user : null;
  await ensureProfile();
}
async function loadProfile() {
  profile = null;
  if (!db || !user) return;
  const result = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!result.error) profile = result.data;
}
async function ensureProfile() {
  if (!db || !user) return;
  await loadProfile();
  if (profile) return;
  const meta = user.user_metadata || {};
  const inserted = await db.from('profiles').insert({
    id: user.id,
    full_name: String(meta.full_name || meta.name || ''),
    phone: String(meta.phone || ''),
    user_type: meta.user_type === 'provider' ? 'provider' : 'customer'
  });
  if (inserted.error) throw inserted.error;
  await loadProfile();
}
function formField(label, name, type, placeholder, required, extra) {
  return '<div class="field"><label for="' + esc(name) + '">' + esc(label) + '</label><input id="' + esc(name) + '" name="' + esc(name) + '" type="' + (type || 'text') + '" placeholder="' + esc(placeholder || '') + '"' + (required ? ' required' : '') + ' ' + (extra || '') + '></div>';
}
function selectField(label, name, options, required) {
  return '<div class="field"><label for="' + esc(name) + '">' + esc(label) + '</label><select id="' + esc(name) + '" name="' + esc(name) + '"' + (required ? ' required' : '') + '>' + options + '</select></div>';
}
function categoryOptions(selected) {
  return '<option value="">ক্যাটাগরি বেছে নিন</option>' + categories.map(c =>
    '<option value="' + esc(c.id) + '"' + (String(selected || '') === String(c.id) ? ' selected' : '') + '>' + esc(c.name) + '</option>'
  ).join('');
}

function districtSelectField(label, name, required, includeAll) {
  const first = includeAll ? '<option value="">সব জেলা</option>' : '<option value="">জেলা বেছে নিন</option>';
  const options = bdLocations.map(d => '<option value="' + esc(d.name) + '">' + esc(d.name) + '</option>').join('');
  return selectField(label, name, first + options, required);
}
function areaSelectField(label, name, required, includeAll) {
  const first = includeAll ? '<option value="">সব উপজেলা / থানা</option>' : '<option value="">উপজেলা / থানা বেছে নিন</option>';
  return selectField(label, name, first, required);
}
function areasForDistrict(districtName, allowAllAreas) {
  if (!districtName) return allowAllAreas ? bdLocations.flatMap(d => d.areas.map(a => ({name:a, district:d.name}))) : [];
  const district = bdLocations.find(d => d.name === districtName);
  return district ? district.areas.map(a => ({name:a, district:district.name})) : [];
}
function attachLocationSelectors(root, selectedDistrict, selectedArea, allowAllAreas) {
  if (!root) return;
  const district = root.querySelector('[name="district"]');
  const area = root.querySelector('[name="area"]');
  if (!district || !area) return;
  if (selectedDistrict) district.value = selectedDistrict;
  const fillAreas = preserveValue => {
    const keep = preserveValue !== undefined ? preserveValue : area.value;
    const rows = areasForDistrict(district.value, !!allowAllAreas);
    let html = '<option value="">' + (allowAllAreas ? 'সব উপজেলা / থানা' : 'উপজেলা / থানা বেছে নিন') + '</option>';
    html += rows.map(row => '<option value="' + esc(row.name) + '">' + esc(row.name) + '</option>').join('');
    if (keep && !rows.some(row => row.name === keep)) html += '<option value="' + esc(keep) + '">' + esc(keep) + ' (আগের তথ্য)</option>';
    area.innerHTML = html;
    area.disabled = !district.value && !allowAllAreas;
    if (keep) area.value = keep;
  };
  fillAreas(selectedArea || '');
  district.addEventListener('change', () => fillAreas(''));
}

function emptyState(title, text, icon) {
  return '<div class="empty-state"><div class="icon">' + (icon || '🔎') + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p></div>';
}
function serviceCard(item) {
  return '<article class="service-card"><div class="service-meta"><span class="tag">' + esc(item.category_name || 'সেবা') + '</span><span class="tag">' + esc(item.district || 'এলাকা উল্লেখ নেই') + '</span></div><h3>' + esc(item.title) + '</h3><p>' + esc(item.description || 'সেবার বিস্তারিত তথ্য দেওয়া হয়নি।') + '</p><div class="muted" style="font-size:12px;margin-bottom:12px">🧰 ' + esc(item.business_name || 'সেবাদাতা') + ' · ' + esc(item.area || 'এলাকা উল্লেখ নেই') + '</div><div class="card-bottom"><span class="price">' + esc(money(item.price_from)) + '</span><a class="btn btn-small" href="#service/' + encodeURIComponent(item.id) + '">বিস্তারিত</a></div></article>';
}
function homePage() {
  return '<section class="hero"><div class="container hero-grid"><div><div class="eyebrow">LOCAL SERVICE FINDER BD</div><h1>দরকারি সেবা,<br>এবার নিজের এলাকাতেই।</h1><p>ইলেকট্রিশিয়ান, প্লাম্বার, টিউটর থেকে শুরু করে নানা ধরনের স্থানীয় সেবাদাতার সঙ্গে যোগাযোগের সহজ প্ল্যাটফর্ম। কাজ খুঁজুন অথবা নিজের দক্ষতা দিয়ে কাজের সুযোগ তৈরি করুন।</p><div class="hero-actions"><a class="btn" href="#find">সেবা খুঁজে দেখুন <span>→</span></a><a class="btn btn-outline" href="#provider-start">সেবাদাতা হিসেবে যোগ দিন</a>' + (user ? '<a class="btn btn-quiet" href="#profile">Continue as ' + esc(profile && profile.full_name || user.email || 'আপনার অ্যাকাউন্ট') + ' →</a>' : '') + '</div><div class="hero-note">যাচাই ছাড়া কাউকে অনুমোদিত সেবাদাতা হিসেবে দেখানো হবে না।</div></div><div class="visual-panel"><div class="visual-pin">আপনার এলাকার সেবা</div><div class="visual-tile"><div class="icon">🔧</div><b>দক্ষ কারিগর</b><span>মেরামত ও রক্ষণাবেক্ষণ</span></div><div class="visual-tile"><div class="icon">📍</div><b>এলাকাভিত্তিক খোঁজ</b><span>জেলা ও এলাকা নির্বাচন</span></div><div class="visual-tile"><div class="icon">🤝</div><b>সরাসরি অনুরোধ</b><span>কাজের বিবরণ পাঠান</span></div><div class="visual-tile"><div class="icon">🛡️</div><b>যাচাইয়ের ধাপ</b><span>অনুমোদনের পর তালিকাভুক্ত</span></div></div></div></section><div class="trust-strip"><div class="container trust-grid"><div class="trust-item"><strong>01</strong> প্রয়োজন অনুযায়ী সেবা খুঁজুন</div><div class="trust-item"><strong>02</strong> এলাকার তথ্য মিলিয়ে নিন</div><div class="trust-item"><strong>03</strong> কাজের অনুরোধ পাঠান</div></div></div><section class="section"><div class="container"><div class="section-head"><div class="eyebrow">দুইভাবে ব্যবহার করুন</div><h2>আপনি কোন ভূমিকায় আছেন?</h2><p>নিজের প্রয়োজন অনুযায়ী সঠিক পথে শুরু করুন।</p></div><div class="role-grid"><article class="role-card"><div class="icon">🔎</div><h3>আমার সেবা প্রয়োজন</h3><p>এলাকা ও কাজের ধরন বেছে নিয়ে সেবাদাতাদের তালিকা দেখুন। প্রোফাইল যাচাই করে কাজের অনুরোধ পাঠান।</p><a class="text-link" href="#signup-customer">সেবাগ্রহীতা অ্যাকাউন্ট খুলুন →</a></article><article class="role-card"><div class="icon">🧰</div><h3>আমি সেবা দিতে চাই</h3><p>নিজের দক্ষতা, কাজের বিবরণ ও সার্ভিস এলাকা দিয়ে প্রোফাইল তৈরি করুন। যাচাই শেষে সেবার তালিকায় যুক্ত হোন।</p><a class="text-link" href="#signup-provider">সেবাদাতা হিসেবে যোগ দিন →</a></article></div></div></section><section class="section" style="background:#f0f5f0"><div class="container"><div class="section-head"><div class="eyebrow">জনপ্রিয় ক্যাটাগরি</div><h2>কোন সেবাটি খুঁজছেন?</h2><p>ক্যাটাগরি বেছে নিয়ে সেবার তালিকায় যান।</p></div><div class="category-grid">' + Object.keys(icons).slice(0,8).map(name => '<a class="category-card" href="#find?category=' + encodeURIComponent(name) + '"><span class="icon">' + icons[name] + '</span><b>' + esc(name) + '</b></a>').join('') + '</div></div></section><section class="section"><div class="container"><div class="cta-band"><div><h2>আপনার দক্ষতাই হতে পারে পরবর্তী সুযোগ</h2><p>সেবাদাতা হিসেবে নিবন্ধন করে নিজের কাজের পরিচিতি তৈরি করুন।</p></div><a class="btn" href="#provider-start">প্রোফাইল তৈরি করুন →</a></div></div></section>';
}
function authPage(kind) {
  const isProvider = kind === 'signup-provider';
  if (kind === 'login') {
    if (user) {
      const displayName = esc(profile && profile.full_name || user.email || 'আপনার অ্যাকাউন্ট');
      const emailLine = user.email ? '<p class="hint">' + esc(user.email) + '</p>' : '';
      return '<section class="page"><div class="container"><div class="panel form-card"><div class="page-head"><div class="eyebrow">WELCOME BACK</div><h1>আবার স্বাগতম!</h1><p>এই ব্রাউজারে আপনার অ্যাকাউন্ট আগে থেকেই লগইন করা আছে।</p></div><div class="profile-top" style="margin:22px 0"><div class="profile-avatar">' + esc((profile && profile.full_name || user.email || 'U').slice(0,1).toUpperCase()) + '</div><div><h2 style="margin:0;font-size:20px">' + displayName + '</h2>' + emailLine + '</div></div><div class="form-actions"><button class="btn" type="button" id="continue-session">প্রোফাইলে যান</button><button class="btn btn-outline" type="button" id="switch-account">অন্য অ্যাকাউন্ট ব্যবহার করুন</button></div><p class="hint" style="margin-top:16px">তোমার লগইন নিরাপদভাবে Supabase Auth পরিচালনা করে।</p></div></div></section>';
    }
    return '<section class="page"><div class="container"><div class="panel form-card"><div class="auth-tabs"><a href="#login" class="active">লগইন</a><a href="#signup-customer">নিবন্ধন</a></div><div class="page-head"><div class="eyebrow">WELCOME BACK</div><h1>সহজে লগইন করুন</h1><p>ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন।</p></div>' + backendNotice() + '<form id="login-form" class="form-grid"><div class="field full"><label for="login-email">ইমেইল ঠিকানা</label><input id="login-email" name="email" type="email" required autocomplete="email" placeholder="name@example.com"></div><div class="field full"><label for="login-password">পাসওয়ার্ড</label><input id="login-password" name="password" type="password" required autocomplete="current-password" placeholder="তোমার পাসওয়ার্ড"></div><div class="field full"><button class="btn btn-outline" type="button" id="show-login-password">পাসওয়ার্ড দেখুন</button></div><div class="field full"><button class="btn" type="submit" ' + (!db ? 'disabled' : '') + '>লগইন করুন</button></div></form><p class="hint">অ্যাকাউন্ট নেই? <a class="text-link" href="#signup-customer">নতুন অ্যাকাউন্ট খুলুন</a></p><p class="hint">অন্যের কম্পিউটারে লগইন করলে শেষে লগআউট করবে।</p></div></div></section>';
  }
  return '<section class="page"><div class="container"><div class="panel form-card"><div class="auth-tabs"><a href="#login">লগইন</a><a href="#signup-customer" class="' + (!isProvider ? 'active' : '') + '">সেবাগ্রহীতা</a><a href="#signup-provider" class="' + (isProvider ? 'active' : '') + '">সেবাদাতা</a></div><div class="page-head"><div class="eyebrow">CREATE ACCOUNT</div><h1>' + (isProvider ? 'সেবাদাতা অ্যাকাউন্ট তৈরি করুন' : 'সেবাগ্রহীতা অ্যাকাউন্ট তৈরি করুন') + '</h1><p>সঠিক তথ্য দিন। আপনার অ্যাকাউন্ট নিরাপদে তৈরি হবে।</p></div>' + backendNotice() + '<form id="signup-form" data-role="' + (isProvider ? 'provider' : 'customer') + '" class="form-grid">' + formField('পূর্ণ নাম','full_name','text','আপনার নাম',true,'autocomplete="name"') + formField('মোবাইল নম্বর','phone','tel','01XXXXXXXXX',true,'autocomplete="tel"') + '<div class="field full"><label>ইমেইল ঠিকানা</label><input name="email" type="email" required autocomplete="email" placeholder="name@example.com"></div><div class="field full"><label>পাসওয়ার্ড</label><input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="কমপক্ষে ৮ অক্ষর"></div><div class="field full"><label class="hint"><input type="checkbox" name="terms" required> আমি ব্যবহারের নিয়ম ও গোপনীয়তা নীতি মেনে নিচ্ছি।</label></div><div class="field full"><button class="btn" type="submit" ' + (!db ? 'disabled' : '') + '>অ্যাকাউন্ট তৈরি করুন</button></div></form><p class="hint">আগে থেকেই অ্যাকাউন্ট আছে? <a class="text-link" href="#login">লগইন করুন</a></p></div></div></section>';
}
async function findPage() {
  const parsed = route();
  const query = new URLSearchParams(location.hash.includes('?') ? location.hash.split('?')[1] : '');
  let cats = categories;
  if (!cats.length && db) {
    const cr = await db.from('categories').select('id,name,icon').order('name');
    if (!cr.error) { categories = cr.data || []; cats = categories; }
  }
  if (!cats.length) cats = LOCAL_CATEGORIES.map((name, i) => ({id:String(i + 1), name}));
  let html = '<section class="page"><div class="container"><div class="page-head"><div class="eyebrow">SERVICE DIRECTORY</div><h1>আপনার এলাকার সেবাদাতা খুঁজুন</h1><p>ক্যাটাগরি, জেলা বা কাজের নাম দিয়ে খুঁজুন।</p></div><form class="panel search-panel" id="search-form"><div class="search-grid">' +
    selectField('সেবার ধরন','category_id','<option value="">সব ক্যাটাগরি</option>' + cats.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join(''),false) +
    districtSelectField('জেলা','district',false,true) +
    areaSelectField('উপজেলা / থানা','area',false,true) +
    '<div class="field"><label>কাজ বা সেবার নাম</label><input name="q" placeholder="যেমন: বাসার ওয়্যারিং"></div><button class="btn" type="submit">খুঁজুন ⌕</button></div></form><div class="results-head"><div><h2>অনুমোদিত সেবা</h2><p id="results-count">সেবাদাতার তালিকা লোড হচ্ছে…</p></div></div><div id="service-results" class="service-grid"><div class="loading-screen"><span class="spinner"></span><p>সেবা খোঁজা হচ্ছে…</p></div></div></div></section>';
  app.innerHTML = html;
  const form = document.getElementById('search-form');
  attachLocationSelectors(form, query.get('district') || '', query.get('area') || '', true);
  if (query.get('category')) {
    const match = cats.find(c=>c.name===query.get('category'));
    if (match) form.elements.category_id.value = String(match.id);
  }
  form.addEventListener('submit', e => { e.preventDefault(); loadServices(); });
  await loadServices();
}
async function loadServices() {
  const results = document.getElementById('service-results');
  const count = document.getElementById('results-count');
  if (!db) {
    results.innerHTML = emptyState('সেবাদাতার তালিকা এখনো চালু হয়নি','ডেটাবেস সংযোগ সম্পূর্ণ হলে শুধু বাস্তব ও অনুমোদিত সেবাদাতারা এখানে দেখাবে।','🛠️');
    count.textContent = 'লাইভ ডেটাবেস সংযোগ বাকি';
    return;
  }
  const form = document.getElementById('search-form');
  const q = form.elements.q.value.trim();
  const district = form.elements.district.value;
  const area = form.elements.area.value.trim();
  const category = form.elements.category_id.value;
  let request = db.from('public_services').select('*').order('created_at',{ascending:false}).limit(60);
  if (q) request = request.or('title.ilike.%'+q+'%,description.ilike.%'+q+'%,business_name.ilike.%'+q+'%');
  if (district) request = request.eq('district',district);
  if (area) request = request.ilike('area','%'+area+'%');
  if (category) request = request.eq('category_id',category);
  const result = await request;
  if (result.error) {
    results.innerHTML = emptyState('তালিকাটি লোড করা যায়নি','ডেটাবেস সেটআপ ও অনুমতি যাচাই করুন।','⚠️');
    count.textContent = 'লোড করতে সমস্যা হয়েছে';
    return;
  }
  const rows = result.data || [];
  count.textContent = rows.length.toLocaleString('bn-BD') + 'টি অনুমোদিত সেবা পাওয়া গেছে';
  results.innerHTML = rows.length ? rows.map(serviceCard).join('') : emptyState('এখনো কোনো অনুমোদিত সেবা নেই','এই ফিল্টারে কোনো যাচাইকৃত সেবাদাতা পাওয়া যায়নি। পরে আবার খুঁজে দেখুন বা অন্য এলাকা বেছে নিন।','🔎');
}
async function servicePage(id) {
  app.innerHTML = '<section class="page"><div class="container"><div class="loading-screen"><span class="spinner"></span><p>সেবার তথ্য লোড হচ্ছে…</p></div></div></section>';
  if (!db) {
    app.innerHTML = '<section class="page"><div class="container">' + backendNotice() + emptyState('লাইভ সেবার তথ্য পাওয়া যাচ্ছে না','ডেটাবেস সংযোগ সম্পূর্ণ হলে অনুমোদিত প্রোফাইল এখানে দেখা যাবে।') + '</div></section>';
    return;
  }
  const result = await db.from('public_services').select('*').eq('id',id).maybeSingle();
  if (result.error || !result.data) {
    app.innerHTML = '<section class="page"><div class="container">' + emptyState('সেবাটি পাওয়া যায়নি','এই সেবা সরানো হয়েছে অথবা অনুমোদিত নয়।') + '<a class="btn" href="#find">সেবার তালিকায় ফিরুন</a></div></section>';
    return;
  }
  const s = result.data;
  app.innerHTML = '<section class="page"><div class="container"><div class="crumb"><a href="#find">সেবার তালিকা</a> / বিস্তারিত</div><div class="panel"><div class="service-meta"><span class="tag">'+esc(s.category_name)+'</span><span class="tag">'+esc(s.district || 'এলাকা উল্লেখ নেই')+'</span></div><div class="profile-top"><div class="profile-avatar">'+esc((s.business_name||'স').slice(0,1))+'</div><div><h1>'+esc(s.business_name)+'</h1><p>'+esc(s.area || '')+' · '+esc(s.experience_years || 0)+' বছরের অভিজ্ঞতা</p></div></div><hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><h2>'+esc(s.title)+'</h2><p>'+esc(s.description)+'</p><p><b>প্রারম্ভিক মূল্য:</b> '+esc(money(s.price_from))+'</p><p><b>সেবাদাতার পরিচিতি:</b> '+esc(s.bio || 'পরিচিতি দেওয়া হয়নি।')+'</p><div class="notice">যোগাযোগের ফোন নম্বর পাবলিক প্রোফাইলে দেখানো হয় না। কাজের অনুরোধ পাঠানোর পর সেবাদাতা আপনার সঙ্গে যোগাযোগের ব্যবস্থা করতে পারবেন।</div><div class="form-actions"><a class="btn" href="#request/'+encodeURIComponent(s.id)+'">কাজের অনুরোধ পাঠান</a><a class="btn btn-outline" href="#find">আরও সেবা দেখুন</a></div></div></div></section>';
}
async function requestPage(serviceId) {
  if (!user) { afterLoginPath='request/'+encodeURIComponent(serviceId); go('login'); toast('অনুরোধ পাঠাতে আগে লগইন করুন।'); return; }
  if (!db) { app.innerHTML = backendNotice(); return; }
  const result = await db.from('public_services').select('*').eq('id',serviceId).maybeSingle();
  if (result.error || !result.data) { app.innerHTML = emptyState('সেবাটি পাওয়া যায়নি','সেবাটির অনুমোদন বা তথ্য যাচাই করুন।'); return; }
  const s = result.data;
  app.innerHTML = '<section class="page"><div class="container"><div class="panel form-card"><div class="crumb"><a href="#service/'+encodeURIComponent(serviceId)+'">সেবার বিস্তারিত</a> / অনুরোধ</div><div class="page-head"><div class="eyebrow">SERVICE REQUEST</div><h1>কাজের অনুরোধ পাঠান</h1><p>'+esc(s.business_name)+' — '+esc(s.title)+'</p></div><form id="request-form" data-provider="'+esc(s.provider_id)+'" data-service="'+esc(s.id)+'" class="form-grid"><div class="field full"><label>কাজের বিস্তারিত</label><textarea name="message" required minlength="10" placeholder="কী কাজ প্রয়োজন, সমস্যাটি কোথায়, বিস্তারিত লিখুন…"></textarea></div>'+formField('আপনার যোগাযোগ নম্বর','contact_phone','tel','01XXXXXXXXX',true,'pattern="^(?:\\+?88)?01[3-9][0-9]{8}$" maxlength="14"') + formField('কাজের সম্ভাব্য তারিখ','preferred_date','date','',false) + districtSelectField('জেলা','district',true,false) + areaSelectField('উপজেলা / থানা','area',true,false) + '<div class="field full"><button class="btn" type="submit">অনুরোধ পাঠান</button></div></form><div class="hint">আপনার নম্বর শুধুমাত্র এই কাজের অনুরোধের সঙ্গে যুক্ত থাকবে। অন্যদের পাবলিক প্রোফাইলে দেখানো হবে না।</div></div></div></section>';
  attachLocationSelectors(document.getElementById('request-form'), profile && profile.district || '', profile && profile.area || '');
}
async function providerStartPage() {
  if (!user) {
    app.innerHTML = '<section class="page"><div class="container"><div class="panel form-card"><div class="page-head"><div class="eyebrow">BECOME A PROVIDER</div><h1>নিজের সেবার প্রোফাইল তৈরি করুন</h1><p>সেবাদাতা হিসেবে নিবন্ধন করে লগইন করুন, তারপর দক্ষতা ও কাজের তথ্য জমা দিন।</p></div><div class="form-actions"><a class="btn" href="#signup-provider">সেবাদাতা অ্যাকাউন্ট খুলুন</a><a class="btn btn-outline" href="#login">লগইন</a></div></div></div></section>';
    return;
  }
  if (!db) { app.innerHTML = backendNotice(); return; }
  await loadProfile();
  if (!profile || profile.user_type !== 'provider') {
    app.innerHTML = '<section class="page"><div class="container"><div class="panel form-card"><h1>সেবাদাতা অ্যাকাউন্ট প্রয়োজন</h1><p>আপনি সেবাগ্রহীতা হিসেবে লগইন করেছেন। সেবাদাতা প্রোফাইলের জন্য আলাদা সেবাদাতা অ্যাকাউন্ট তৈরি করুন।</p><a class="btn" href="#signup-provider">সেবাদাতা অ্যাকাউন্ট খুলুন</a></div></div></section>';
    return;
  }
  const existing = await db.from('provider_profiles').select('*').eq('user_id',user.id).maybeSingle();
  if (existing.data) {
    app.innerHTML = '<section class="page"><div class="container"><div class="panel form-card"><h1>আপনার সেবাদাতা প্রোফাইল</h1><p>'+esc(existing.data.business_name)+'</p>'+notice('প্রোফাইলের অবস্থা: '+(statusLabels[existing.data.approval_status] || existing.data.approval_status),existing.data.approval_status==='approved'?'success':'warn')+'<a class="btn" href="#dashboard">ড্যাশবোর্ডে যান</a></div></div></section>';
    return;
  }
  if (!categories.length) {
    const cr = await db.from('categories').select('id,name').order('name');
    if (!cr.error) categories = cr.data || [];
  }
  app.innerHTML = '<section class="page"><div class="container"><div class="panel form-card"><div class="page-head"><div class="eyebrow">PROVIDER PROFILE</div><h1>আপনার সেবার পরিচিতি দিন</h1><p>তথ্য জমা দিলে যাচাইয়ের জন্য অপেক্ষায় থাকবে। অনুমোদিত না হওয়া পর্যন্ত পাবলিক তালিকায় দেখাবে না।</p></div><form id="provider-form" class="form-grid">' + formField('প্রতিষ্ঠান / সেবার নাম','business_name','text','যেমন: জিসান ইলেকট্রিক সার্ভিস',true) + formField('অভিজ্ঞতা (বছর)','experience_years','number','যেমন: ৩',true,'min="0" max="60"') + districtSelectField('জেলা','district',true,false) + areaSelectField('উপজেলা / থানা','area',true,false) + '<div class="field full"><label>আপনার পরিচিতি ও দক্ষতা</label><textarea name="bio" required minlength="20" placeholder="কোন ধরনের কাজ করেন, কী অভিজ্ঞতা আছে…"></textarea></div>' + selectField('প্রধান সেবার ধরন','category_id',categoryOptions(),true) + formField('সেবার শিরোনাম','title','text','যেমন: বাসাবাড়ির বৈদ্যুতিক মেরামত',true) + '<div class="field full"><label>সেবার বিস্তারিত</label><textarea name="description" required minlength="20" placeholder="কী কী কাজ করেন এবং কীভাবে সেবা দেন…"></textarea></div>' + formField('শুরুর মূল্য (টাকা)','price_from','number','যেমন: ৫০০',false,'min="0" step="1"') + selectField('মূল্যের ধরন','price_type','<option value="negotiable">আলোচনা সাপেক্ষে</option><option value="starting">শুরু ৳… থেকে</option><option value="fixed">নির্দিষ্ট মূল্য</option>',true) + '<div class="field full"><button class="btn" type="submit">প্রোফাইল জমা দিন</button></div></form></div></div></section>';
  attachLocationSelectors(document.getElementById('provider-form'));
}
async function dashboardPage() {
  if (!user) { go('login'); return; }
  if (!db) { app.innerHTML = backendNotice(); return; }
  await loadProfile();
  const isProvider = profile && profile.user_type === 'provider';
  const received = await db.from('service_requests').select('id,status,message,created_at,area,district,service:services(title)').eq('provider_id',user.id).order('created_at',{ascending:false}).limit(30);
  const sent = await db.from('service_requests').select('id,status,message,created_at,area,district,service:services(title)').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(30);
  const myServices = isProvider ? await db.from('services').select('id,title,status').eq('provider_id',user.id).order('created_at',{ascending:false}) : {data:[]};
  const pp = isProvider ? await db.from('provider_profiles').select('approval_status,business_name').eq('user_id',user.id).maybeSingle() : {data:null};
  const requests = isProvider ? (received.data || []) : (sent.data || []);
  const services = myServices.data || [];
  const rows = requests.length ? '<div class="table-wrap"><table><thead><tr><th>সেবা</th><th>এলাকা</th><th>অবস্থা</th><th>তারিখ</th>'+(isProvider?'<th>গ্রাহকের নম্বর</th><th>কাজ</th>':'<th>যোগাযোগ</th>')+'</tr></thead><tbody>'+requests.map(r=>'<tr><td>'+esc(r.service && r.service.title || 'সেবা')+'</td><td>'+esc(r.area || '-')+'</td><td><span class="status '+esc(r.status)+'">'+esc(statusLabels[r.status] || r.status)+'</span></td><td>'+new Date(r.created_at).toLocaleDateString('bn-BD')+'</td>'+(isProvider?'<td>'+(r.status==='accepted'||r.status==='completed'?'<button class="btn btn-small" data-customer-contact="'+esc(r.id)+'">নম্বর দেখুন</button>':'গ্রহণের পর নম্বর পাওয়া যাবে')+'</td><td>'+(r.status==='pending'?'<button class="btn btn-small" data-request="'+esc(r.id)+'" data-next="accepted">গ্রহণ</button> <button class="btn btn-small btn-outline" data-request="'+esc(r.id)+'" data-next="declined">না</button>':r.status==='accepted'?'<button class="btn btn-small" data-request="'+esc(r.id)+'" data-next="completed">সম্পন্ন</button>':'—')+'</td>':'<td>'+(r.status==='accepted'?'<button class="btn btn-small" data-contact="'+esc(r.id)+'">নম্বর দেখুন</button>':'অনুমোদনের পর নম্বর পাওয়া যাবে')+'</td>')+'</tr>').join('')+'</tbody></table></div>' : emptyState('এখনো কোনো কাজের অনুরোধ নেই',isProvider?'কেউ কাজের অনুরোধ পাঠালে এখানে দেখতে পাবেন।':'সেবা খুঁজে কাজের অনুরোধ পাঠালে এখানে দেখা যাবে।','📬');
  app.innerHTML = '<section class="page"><div class="container"><div class="profile-top" style="margin-bottom:22px"><div class="profile-avatar">'+esc((profile && profile.full_name || user.email || 'U').slice(0,1))+'</div><div><div class="eyebrow">MY DASHBOARD</div><h1>' + esc(profile && profile.full_name || user.email) + '</h1><p>'+(isProvider?'সেবাদাতা অ্যাকাউন্ট':'সেবাগ্রহীতা অ্যাকাউন্ট')+' · '+esc(profile && profile.district || 'এলাকা সেট করা হয়নি')+'</p></div><button id="logout-btn" class="btn btn-outline right">লগআউট</button></div><div class="dashboard-grid"><nav class="side-nav"><a class="active" href="#dashboard">ড্যাশবোর্ড</a>'+(isProvider?'<a href="#provider-start">আমার সেবা</a>':'<a href="#find">সেবা খুঁজুন</a>')+'<a href="#account">প্রোফাইল সেটিংস</a></nav><div><div class="stats"><div class="stat"><strong>'+requests.length.toLocaleString('bn-BD')+'</strong><span>'+(isProvider?'পাওয়া অনুরোধ':'পাঠানো অনুরোধ')+'</span></div><div class="stat"><strong>'+services.length.toLocaleString('bn-BD')+'</strong><span>আমার সেবা</span></div><div class="stat"><strong>'+esc(pp.data?statusLabels[pp.data.approval_status] || pp.data.approval_status:'—')+'</strong><span>প্রোফাইল যাচাই</span></div></div><div class="panel"><div class="results-head"><div><h2>'+(isProvider?'আমার কাছে আসা অনুরোধ':'আমার পাঠানো অনুরোধ')+'</h2><p>সর্বশেষ কাজের আপডেট</p></div></div>'+rows+'</div>'+(isProvider?'<div class="panel" style="margin-top:16px"><div class="results-head"><div><h2>আমার সেবাসমূহ</h2><p>অ্যাডমিন যাচাইয়ের অবস্থা</p></div></div>'+(services.length?'<div class="table-wrap"><table><thead><tr><th>সেবা</th><th>অবস্থা</th></tr></thead><tbody>'+services.map(s=>'<tr><td>'+esc(s.title)+'</td><td><span class="status '+esc(s.status)+'">'+esc(statusLabels[s.status] || s.status)+'</span></td></tr>').join('')+'</tbody></table></div>':emptyState('সেবা যোগ করা হয়নি','আপনার সেবা-প্রোফাইল তৈরি করুন।'))+'</div>':'')+'</div></div></div></section>';
  document.getElementById('logout-btn').onclick = signOut;
  app.querySelectorAll('[data-request]').forEach(btn => btn.addEventListener('click', async () => {
    const result = await db.from('service_requests').update({status:btn.dataset.next}).eq('id',btn.dataset.request);
    if (result.error) toast('অনুরোধ আপডেট করা যায়নি: ' + result.error.message);
    else { toast('অনুরোধের অবস্থা আপডেট হয়েছে।'); dashboardPage(); }
  }));
  app.querySelectorAll('[data-customer-contact]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;btn.textContent='লোড হচ্ছে…';
    const result=await db.rpc('get_customer_contact',{p_request_id:btn.dataset.customerContact});
    if(result.error || !result.data){toast('গ্রাহকের নম্বর পাওয়া যায়নি। অনুরোধটি গৃহীত হয়েছে কি না দেখুন।');btn.disabled=false;btn.textContent='নম্বর দেখুন';return;}
    btn.outerHTML='<a class="btn btn-small" href="tel:'+encodeURIComponent(result.data)+'">'+esc(result.data)+'</a>';
  }));
  app.querySelectorAll('[data-contact]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;btn.textContent='লোড হচ্ছে…';
    const result=await db.rpc('get_provider_contact',{p_request_id:btn.dataset.contact});
    if(result.error || !result.data){toast('সেবাদাতার নম্বর পাওয়া যায়নি। অনুরোধটি অনুমোদিত কি না দেখুন।');btn.disabled=false;btn.textContent='নম্বর দেখুন';return;}
    btn.outerHTML='<a class="btn btn-small" href="tel:'+encodeURIComponent(result.data)+'">'+esc(result.data)+'</a>';
  }));
}
async function accountPage() {
  if (!user) { go('login'); return; }
  await loadProfile();
  const displayName = profile && profile.full_name || 'আপনার নাম';
  const roleLabel = profile && profile.user_type === 'provider' ? 'সেবাদাতা অ্যাকাউন্ট' : 'সেবাগ্রহীতা অ্যাকাউন্ট';
  const emailText = user.email || 'ইমেইল যুক্ত নেই';
  app.innerHTML = '<section class="page"><div class="container"><div class="panel form-card"><div class="profile-top" style="margin-bottom:18px"><div class="profile-avatar">'+esc(displayName.slice(0,1).toUpperCase())+'</div><div><div class="eyebrow">MY PROFILE</div><h1>'+esc(displayName)+'</h1><p>'+esc(emailText)+'</p><p class="hint">'+esc(roleLabel)+'</p></div></div><div class="form-actions" style="margin:0 0 22px"><a class="btn btn-outline" href="#dashboard">আমার ড্যাশবোর্ড</a><a class="btn btn-quiet" href="#logout">লগআউট</a></div><div class="page-head"><div class="eyebrow">PROFILE SETTINGS</div><h2>প্রোফাইল তথ্য</h2><p>আপনার নাম, যোগাযোগ ও এলাকার তথ্য হালনাগাদ করুন।</p></div><form id="account-form" class="form-grid">'+formField('পূর্ণ নাম','full_name','text','আপনার নাম',true) + formField('মোবাইল নম্বর','phone','tel','01XXXXXXXXX',false) + districtSelectField('জেলা','district',false,false) + areaSelectField('উপজেলা / থানা','area',false,false) + '<div class="field full"><button class="btn" type="submit">তথ্য সংরক্ষণ করুন</button></div></form></div></div></section>';
  const form=document.getElementById('account-form');
  attachLocationSelectors(form, profile && profile.district || '', profile && profile.area || '');
  form.elements.full_name.value=profile && profile.full_name || '';
  form.elements.phone.value=profile && profile.phone || '';
}
async function adminPage() {
  if (!user || !db) { go('login'); return; }
  const check = await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
  if (check.error || !check.data) {
    app.innerHTML='<section class="page"><div class="container">'+emptyState('অ্যাডমিন প্রবেশাধিকার নেই','এই পেজ শুধু অনুমোদিত অ্যাডমিনদের জন্য।','🔒')+'</div></section>';
    return;
  }
  const pending = await db.from('provider_profiles').select('user_id,business_name,bio,experience_years,district,area,created_at,profile:profiles(full_name)').eq('approval_status','pending').order('created_at');
  const pendingServices = await db.from('services').select('id,title,description,provider_id,category:categories(name),provider:provider_profiles(business_name,approval_status)').eq('status','pending').order('created_at');
  if (pending.error || pendingServices.error) { app.innerHTML=notice('অ্যাডমিন তালিকা লোড করা যায়নি: '+((pending.error||pendingServices.error).message),'error'); return; }
  const rows=pending.data||[];
  const serviceRows=pendingServices.data||[];
  app.innerHTML='<section class="page"><div class="container"><div class="page-head"><div class="eyebrow">ADMIN CONTROL</div><h1>অ্যাডমিন যাচাই কেন্দ্র</h1><p>প্রথমে সেবাদাতার পরিচিতি, তারপর তার প্রতিটি সেবা যাচাই করুন। দুটিই অনুমোদিত না হলে পাবলিক তালিকায় দেখাবে না।</p></div><div class="panel"><div class="results-head"><div><h2>সেবাদাতার প্রোফাইল</h2><p>নতুন সেবাদাতা যাচাই</p></div></div>'+(rows.length?'<div class="table-wrap"><table><thead><tr><th>নাম</th><th>ব্যবসা / কাজ</th><th>এলাকা</th><th>অভিজ্ঞতা</th><th>সিদ্ধান্ত</th></tr></thead><tbody>'+rows.map(p=>'<tr><td>'+esc(p.profile && p.profile.full_name || 'নাম নেই')+'</td><td>'+esc(p.business_name)+'</td><td>'+esc((p.district || '-')+' · '+(p.area || '-'))+'</td><td>'+esc(p.experience_years)+' বছর</td><td><button class="btn btn-small" data-provider="'+esc(p.user_id)+'" data-next="approved">অনুমোদন</button> <button class="btn btn-small btn-outline" data-provider="'+esc(p.user_id)+'" data-next="rejected">প্রত্যাখ্যান</button></td></tr>').join('')+'</tbody></table></div>':emptyState('কোনো অপেক্ষমাণ প্রোফাইল নেই','নতুন সেবাদাতা নিবন্ধন করলে এখানে আসবে।','✅'))+'</div><div class="panel" style="margin-top:16px"><div class="results-head"><div><h2>সেবা যাচাই</h2><p>সেবাদাতার প্রতিটি সেবা আলাদাভাবে অনুমোদন করুন</p></div></div>'+(serviceRows.length?'<div class="table-wrap"><table><thead><tr><th>সেবার নাম</th><th>ক্যাটাগরি</th><th>সেবাদাতা</th><th>প্রোফাইল</th><th>সিদ্ধান্ত</th></tr></thead><tbody>'+serviceRows.map(s=>'<tr><td>'+esc(s.title)+'</td><td>'+esc(s.category && s.category.name || '-')+'</td><td>'+esc(s.provider && s.provider.business_name || '-')+'</td><td><span class="status '+(s.provider && s.provider.approval_status==='approved'?'approved':'pending')+'">'+esc(statusLabels[s.provider && s.provider.approval_status] || 'অপেক্ষমাণ')+'</span></td><td><button class="btn btn-small" data-service="'+esc(s.id)+'" data-next="approved">অনুমোদন</button> <button class="btn btn-small btn-outline" data-service="'+esc(s.id)+'" data-next="rejected">প্রত্যাখ্যান</button></td></tr>').join('')+'</tbody></table></div>':emptyState('কোনো অপেক্ষমাণ সেবা নেই','সেবাদাতারা নতুন সেবা জমা দিলে এখানে আসবে।','✅'))+'</div></div></section>';
  app.querySelectorAll('[data-provider]').forEach(btn=>btn.addEventListener('click',async()=>{
    const r=await db.rpc('admin_set_provider_status',{p_user_id:btn.dataset.provider,p_status:btn.dataset.next});
    if(r.error || r.data !== true) toast('আপডেট হয়নি: '+(r.error ? r.error.message : 'অ্যাডমিন অনুমতি যাচাই করুন।')); else {toast('প্রোফাইলের সিদ্ধান্ত সংরক্ষিত হয়েছে।');adminPage();}
  }));
  app.querySelectorAll('[data-service]').forEach(btn=>btn.addEventListener('click',async()=>{
    const r=await db.rpc('admin_set_service_status',{p_service_id:btn.dataset.service,p_status:btn.dataset.next});
    if(r.error || r.data !== true) toast('সেবার সিদ্ধান্ত সংরক্ষিত হয়নি: '+(r.error ? r.error.message : 'অ্যাডমিন অনুমতি যাচাই করুন।')); else {toast('সেবার সিদ্ধান্ত সংরক্ষণ হয়েছে।');adminPage();}
  }));
}
async function howPage() {
  app.innerHTML='<section class="page"><div class="container"><div class="page-head"><div class="eyebrow">HOW IT WORKS</div><h1>ব্যবহার করার নিয়ম</h1><p>সেবাগ্রহীতা ও সেবাদাতার জন্য সহজ ধাপ।</p></div><div class="feature-grid"><article class="feature-card"><div class="icon">1️⃣</div><h3>অ্যাকাউন্ট তৈরি</h3><p>সেবাগ্রহীতা বা সেবাদাতা হিসেবে সঠিক তথ্য দিয়ে নিবন্ধন করুন।</p></article><article class="feature-card"><div class="icon">2️⃣</div><h3>সেবা বা প্রোফাইল যোগ</h3><p>সেবাগ্রহীতা এলাকা ও প্রয়োজন বেছে নেবেন। সেবাদাতা কাজের বিবরণ জমা দেবেন।</p></article><article class="feature-card"><div class="icon">3️⃣</div><h3>যাচাই ও অনুরোধ</h3><p>সেবাদাতার তথ্য যাচাইয়ের পর তালিকায় প্রকাশ হবে। তারপর কাজের অনুরোধ পাঠানো যাবে।</p></article></div><div class="notice warn">নিরাপত্তা: কাজ শুরুর আগে মূল্য, সময় ও কাজের পরিধি লিখিতভাবে ঠিক করুন। অপরিচিত কাউকে অগ্রিম টাকা বা সংবেদনশীল পরিচয়পত্রের তথ্য দেবেন না।</div></div></section>';
}
async function signUp(form) {
  if (!db) return;
  const data = new FormData(form);
  const role = form.dataset.role;
  if (!data.get('terms')) { toast('ব্যবহারের নিয়মে সম্মতি দিন।'); return; }
  const result = await db.auth.signUp({
    email:String(data.get('email')).trim(),
    password:String(data.get('password')),
    options:{
      data:{full_name:String(data.get('full_name')).trim(),phone:String(data.get('phone')).trim(),user_type:role},
      emailRedirectTo:window.location.origin
    }
  });
  if (result.error) { toast(result.error.message); return; }
  if (result.data.session) {
    user = result.data.user;
    await ensureProfile();
    toast('অ্যাকাউন্ট তৈরি হয়েছে।');
    go(role==='provider'?'provider-start':'find');
  } else {
    app.querySelector('.form-card').insertAdjacentHTML('afterbegin',notice('নিবন্ধনের লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইমেইল যাচাই করে তারপর লগইন করুন।','success'));
    form.reset();
  }
}
async function signInWithPassword(form) {
  if (!db) return;
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = String(data.get('password') || '');
  if (!email || !password) { toast('ইমেইল ও পাসওয়ার্ড লিখুন।'); return; }
  const result = await db.auth.signInWithPassword({ email, password });
  if (result.error) {
    if ((result.error.message || '').toLowerCase().includes('email not confirmed')) {
      toast('আগে ইমেইল যাচাই সম্পন্ন করুন।');
    } else {
      toast('ইমেইল বা পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন।');
    }
    return;
  }
  user = result.data.user;
  await ensureProfile();
  toast('লগইন সফল হয়েছে।');
  const destination = afterLoginPath || 'profile';
  afterLoginPath = 'profile';
  go(destination);
}
async function signOut() {
  if (!db) return;
  const result=await db.auth.signOut({scope:'local'});
  if(result.error){toast('লগআউট হয়নি: '+result.error.message);return;}
  user=null;profile=null;afterLoginPath='profile';
  toast('এই ডিভাইস থেকে লগআউট হয়েছে।');
  go('home');
}
async function saveProvider(form) {
  if (!db || !user) return;
  const d=new FormData(form);
  const locationUpdate=await db.from('profiles').update({district:String(d.get('district')).trim(),area:String(d.get('area')).trim()}).eq('id',user.id);
  if(locationUpdate.error){toast('এলাকার তথ্য সংরক্ষণ হয়নি: '+locationUpdate.error.message);return;}
  const provider={user_id:user.id,business_name:String(d.get('business_name')).trim(),bio:String(d.get('bio')).trim(),district:String(d.get('district')).trim(),area:String(d.get('area')).trim(),experience_years:Number(d.get('experience_years'))};
  const p=await db.from('provider_profiles').insert(provider);
  if(p.error){toast('প্রোফাইল তৈরি হয়নি: '+p.error.message);return;}
  const service={
    provider_id:user.id,category_id:Number(d.get('category_id')),
    title:String(d.get('title')).trim(),description:String(d.get('description')).trim(),
    price_from:d.get('price_from')?Number(d.get('price_from')):null,
    price_type:String(d.get('price_type')||'negotiable')
  };
  const s=await db.from('services').insert(service);
  if(s.error){toast('প্রোফাইল হয়েছে, কিন্তু সেবা যোগ হয়নি: '+s.error.message);go('dashboard');return;}
  toast('প্রোফাইল ও সেবা যাচাইয়ের জন্য জমা হয়েছে।');
  go('dashboard');
}
async function sendRequest(form) {
  if (!db || !user) return;
  const d=new FormData(form);
  const result=await db.from('service_requests').insert({
    customer_id:user.id,provider_id:form.dataset.provider,service_id:form.dataset.service,
    message:String(d.get('message')).trim(),contact_phone:String(d.get('contact_phone')).trim(),
    preferred_date:d.get('preferred_date')||null,district:String(d.get('district')).trim(),area:String(d.get('area')).trim()
  });
  if(result.error){toast('অনুরোধ পাঠানো যায়নি: '+result.error.message);return;}
  toast('কাজের অনুরোধ পাঠানো হয়েছে।');
  go('dashboard');
}
async function saveAccount(form) {
  if(!db||!user)return;
  const d=new FormData(form);
  const result=await db.from('profiles').update({
    full_name:String(d.get('full_name')).trim(),
    phone:String(d.get('phone')||'').trim(),
    district:String(d.get('district')||'').trim(),
    area:String(d.get('area')||'').trim()
  }).eq('id',user.id);
  if(result.error){toast('তথ্য সংরক্ষণ হয়নি: '+result.error.message);return;}
  if (profile && profile.user_type === 'provider') {
    const providerUpdate = await db.from('provider_profiles').update({district:String(d.get('district')||'').trim(),area:String(d.get('area')||'').trim()}).eq('user_id',user.id);
    if (providerUpdate.error) { toast('এলাকার তথ্য সেবাদাতা প্রোফাইলে আপডেট হয়নি: '+providerUpdate.error.message); return; }
  }
  await loadProfile();toast('প্রোফাইল আপডেট হয়েছে।');go('profile');
}
function bindForms() {
  const continueButton = document.getElementById('continue-session');
  if (continueButton) continueButton.addEventListener('click', () => {
    const destination = afterLoginPath || 'profile';
    afterLoginPath = 'profile';
    go(destination);
  });
  const showPass = document.getElementById('show-login-password');
  if (showPass) showPass.addEventListener('click', () => {
    const field = document.getElementById('login-password');
    if (!field) return;
    field.type = field.type === 'password' ? 'text' : 'password';
    showPass.textContent = field.type === 'password' ? 'পাসওয়ার্ড দেখুন' : 'পাসওয়ার্ড লুকান';
  });
  const switchButton = document.getElementById('switch-account');
  if (switchButton) switchButton.addEventListener('click', async () => {
    if (!db) return;
    const result = await db.auth.signOut({scope:'local'});
    if (result.error) { toast('অ্যাকাউন্ট বদলানো যায়নি: '+result.error.message); return; }
    user = null;
    profile = null;
    afterLoginPath = 'profile';
    toast('এই ডিভাইস থেকে লগআউট হয়েছে। অন্য অ্যাকাউন্ট দিয়ে ইমেইল ও পাসওয়ার্ড ব্যবহার করুন।');
    await render();
  });
  const handlers={
    'signup-form':signUp,'login-form':signInWithPassword,'provider-form':saveProvider,
    'request-form':sendRequest,'account-form':saveAccount
  };
  Object.keys(handlers).forEach(id=>{
    const form=document.getElementById(id);
    if(form) form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      if(button){button.disabled=true;button.dataset.old=button.textContent;button.textContent='প্রক্রিয়া চলছে…';}
      try{await handlers[id](form);}catch(err){toast('সমস্যা হয়েছে: '+(err.message||'আবার চেষ্টা করুন।'));}
      finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent=button.dataset.old||'জমা দিন';}}
    });
  });
}
async function render() {
  updateNav();
  const r=route();
  try {
    if (r.name==='home') app.innerHTML=homePage();
    else if (r.name==='find') await findPage();
    else if (r.name==='login'||r.name==='signup-customer'||r.name==='signup-provider') app.innerHTML=authPage(r.name);
    else if (r.name==='provider-start') await providerStartPage();
    else if (r.name==='service') await servicePage(decodeURIComponent(r.id));
    else if (r.name==='request') await requestPage(decodeURIComponent(r.id));
    else if (r.name==='dashboard') await dashboardPage();
    else if (r.name==='account' || r.name==='profile') await accountPage();
    else if (r.name==='admin') await adminPage();
    else if (r.name==='how') await howPage();
    else if (r.name==='logout') await signOut();
    else app.innerHTML=homePage();
    bindForms();
  } catch (err) {
    app.innerHTML='<section class="page"><div class="container">'+notice('পেজটি লোড করতে সমস্যা হয়েছে: '+(err.message||'অজানা ত্রুটি'),'error')+'<a class="btn" href="#home">হোমে ফিরুন</a></div></section>';
  }
}
async function init() {
  document.getElementById('year').textContent=String(new Date().getFullYear());
  setupMenu();
  if (db) {
    await loadSession();
    db.auth.onAuthStateChange((_event,session)=>{
      user=session?session.user:null;
      Promise.resolve().then(async()=>{
        await loadProfile();
        render();
      });
    });
    const cr=await db.from('categories').select('id,name,icon').order('name');
    if (!cr.error) categories=cr.data||[];
  }
  window.addEventListener('hashchange',render);
  await render();
}
init();
})();