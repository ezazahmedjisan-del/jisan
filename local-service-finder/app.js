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
let pendingPhoneE164 = null;

const icons = {'ইলেকট্রিশিয়ান':'💡','প্লাম্বার':'🚿','টিউটর':'📚','এসি মেকানিক':'❄️','ক্লিনিং':'🧹','পেইন্টার':'🖌️','কম্পিউটার সার্ভিস':'💻','মিস্ত্রি':'🧱','ফ্রিজ মেকানিক':'🧊','মোবাইল সার্ভিসিং':'📱','কার্পেন্টার / কাঠমিস্ত্রি':'🪚','ওয়েল্ডিং':'🛠️','টাইলস মিস্ত্রি':'🧱','গ্লাস ও অ্যালুমিনিয়াম':'🪟','সিসিটিভি ও নেটওয়ার্ক':'📹','সেলাই ও দর্জি':'🧵','গাড়ি মেরামত':'🚗','মোটরসাইকেল মেকানিক':'🏍️','জেনারেটর / আইপিএস সার্ভিস':'🔋','লন্ড্রি ও ইস্ত্রি':'👕','বাগান পরিচর্যা':'🌱','ক্যাটারিং / রান্নার সেবা':'🍲','ইভেন্ট সাজসজ্জা':'🎉','ফটোগ্রাফি / ভিডিও':'📷','গ্রাফিক ডিজাইন':'🎨','আইটি ও অনলাইন সাপোর্ট':'🖥️','বাসা বদল / মুভিং':'📦','সোলার প্যানেল সার্ভিস':'☀️','স্যানিটারি ও বাথরুম ফিটিং':'🚿','টিভি ও ইলেকট্রনিক্স মেরামত':'📺','পানির পাম্প সার্ভিস':'💧','ফার্নিচার মেরামত':'🛋️','সেলুন / পার্লার':'💇'};
const LOCAL_CATEGORIES = Object.keys(icons);
const bdLocations = window.BD_LOCATION_DATA || [];
const statusLabels = {pending:'অপেক্ষমাণ',approved:'অনুমোদিত',rejected:'বাতিল',paused:'বিরত',accepted:'গৃহীত',declined:'প্রত্যাখ্যাত',completed:'সম্পন্ন',cancelled:'বাতিল'};
const SUGGESTED_PROVIDER_SKILLS = [
  'গ্রাফিক ডিজাইন','ভিডিও এডিটিং','মোশন গ্রাফিক্স','ওয়েব ডিজাইন','ওয়েব ডেভেলপমেন্ট',
  'SEO','ডিজিটাল মার্কেটিং','কনটেন্ট রাইটিং','ডেটা এন্ট্রি','ফটোগ্রাফি',
  'কম্পিউটার সার্ভিসিং','ইলেকট্রিক্যাল কাজ','প্লাম্বিং','এসি সার্ভিসিং','টিউটরিং',
  'সেলাই ও দর্জি','মোবাইল সার্ভিসিং','কার্পেন্ট্রি','পেইন্টিং','ক্লিনিং'
];

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
  const fallbackName = meta.full_name || meta.name || user.phone || (user.email ? user.email.split('@')[0] : 'নতুন ব্যবহারকারী');
  const suggested = String(meta.username || ('user_' + user.id.slice(0,8))).toLowerCase();
  const inserted = await db.from('profiles').insert({
    id: user.id,
    full_name: String(meta.full_name || meta.name || fallbackName),
    phone: user.user_metadata && user.user_metadata.phone || user.phone || null,
    username: /^[a-z0-9_]{4,20}$/.test(suggested) ? suggested : ('user_' + user.id.slice(0,8)),
    user_type: meta.user_type === 'provider' ? 'provider' : 'customer'
  });
  if (inserted.error && inserted.error.code !== '23505') throw inserted.error;
  await loadProfile();
}
function normalizeBangladeshPhone(value) {
  const raw = String(value || '').trim().replace(/[\s()-]/g, '');
  if (/^01[3-9][0-9]{8}$/.test(raw)) return raw;
  if (/^\+?8801[3-9][0-9]{8}$/.test(raw)) return '0' + raw.replace(/^\+?880/, '');
  return '';
}
function toE164BangladeshPhone(value) {
  const local = normalizeBangladeshPhone(value);
  return local ? '+880' + local.slice(1) : '';
}
function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}
function validUsername(value) {
  return /^[a-z0-9_]{4,20}$/.test(normalizeUsername(value));
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
  const handle = item.username ? '@' + item.username : 'সেবাদাতা';
  const phoneBadge = item.phone_verified
    ? '<span class="verify-pill"><span class="verify-dot">✓</span> মোবাইল যাচাইকৃত</span>'
    : '';
  return '<article class="service-card"><div class="service-meta"><span class="tag">' + esc(item.category_name || 'সেবা') + '</span><span class="tag">' + esc(item.district || 'এলাকা উল্লেখ নেই') + '</span></div><h3>' + esc(item.title) + '</h3><p>' + esc(item.description || 'সেবার বিস্তারিত তথ্য দেওয়া হয়নি।') + '</p><div class="service-owner"><b>' + esc(item.business_name || 'সেবাদাতা') + '</b><span>' + esc(handle) + ' · ' + esc(item.area || 'এলাকা উল্লেখ নেই') + '</span>' + phoneBadge + '</div><div class="card-bottom"><span class="price">' + esc(money(item.price_from)) + '</span><a class="btn btn-small" href="#service/' + encodeURIComponent(item.id) + '">বিস্তারিত</a></div></article>';
}

function homePage() {
  return '<section class="hero"><div class="container hero-grid"><div><div class="eyebrow">LOCAL SERVICE FINDER BD</div><h1>দক্ষ মানুষের সঙ্গে<br>কাজ শুরু করুন।</h1><p>গ্রাফিক ডিজাইন, ভিডিও এডিটিং, ওয়েব ডেভেলপমেন্টসহ বিভিন্ন দক্ষতার মানুষের সঙ্গে কাজ শুরু করুন। নিজের সার্ভিস প্রকাশ করুন অথবা প্রয়োজনের সঠিক পেশাদার খুঁজে নিন।</p><div class="hero-actions"><a class="btn" href="#find">সেবা খুঁজে দেখুন <span>→</span></a><a class="btn btn-outline" href="#provider-start">সেবাদাতা হিসেবে যোগ দিন</a>' + (user ? '<a class="btn btn-quiet" href="#profile">Continue as ' + esc(profile && profile.full_name || profile && profile.phone || 'আপনার অ্যাকাউন্ট') + ' →</a>' : '') + '</div><div class="hero-note">যাচাই ছাড়া কাউকে অনুমোদিত সেবাদাতা হিসেবে দেখানো হবে না।</div></div><div class="visual-panel"><div class="visual-pin">আপনার এলাকার সেবা</div><div class="visual-tile"><div class="icon">🔧</div><b>দক্ষ কারিগর</b><span>মেরামত ও রক্ষণাবেক্ষণ</span></div><div class="visual-tile"><div class="icon">📍</div><b>এলাকাভিত্তিক খোঁজ</b><span>জেলা ও এলাকা নির্বাচন</span></div><div class="visual-tile"><div class="icon">🤝</div><b>সরাসরি অনুরোধ</b><span>কাজের বিবরণ পাঠান</span></div><div class="visual-tile"><div class="icon">🛡️</div><b>যাচাইয়ের ধাপ</b><span>অনুমোদনের পর তালিকাভুক্ত</span></div></div></div></section><div class="trust-strip"><div class="container trust-grid"><div class="trust-item"><strong>01</strong> প্রয়োজন অনুযায়ী সেবা খুঁজুন</div><div class="trust-item"><strong>02</strong> এলাকার তথ্য মিলিয়ে নিন</div><div class="trust-item"><strong>03</strong> কাজের অনুরোধ পাঠান</div></div></div><section class="section"><div class="container"><div class="section-head"><div class="eyebrow">দুইভাবে ব্যবহার করুন</div><h2>আপনি কোন ভূমিকায় আছেন?</h2><p>নিজের প্রয়োজন অনুযায়ী সঠিক পথে শুরু করুন।</p></div><div class="role-grid"><article class="role-card"><div class="icon">🔎</div><h3>আমার সেবা প্রয়োজন</h3><p>এলাকা ও কাজের ধরন বেছে নিয়ে সেবাদাতাদের তালিকা দেখুন। প্রোফাইল যাচাই করে কাজের অনুরোধ পাঠান।</p><a class="text-link" href="#signup-customer">সেবাগ্রহীতা অ্যাকাউন্ট খুলুন →</a></article><article class="role-card"><div class="icon">🧰</div><h3>আমি সেবা দিতে চাই</h3><p>নিজের দক্ষতা, কাজের বিবরণ ও সার্ভিস এলাকা দিয়ে প্রোফাইল তৈরি করুন। যাচাই শেষে সেবার তালিকায় যুক্ত হোন।</p><a class="text-link" href="#signup-provider">সেবাদাতা হিসেবে যোগ দিন →</a></article></div></div></section><section class="section" style="background:#f0f5f0"><div class="container"><div class="section-head"><div class="eyebrow">জনপ্রিয় ক্যাটাগরি</div><h2>কোন সেবাটি খুঁজছেন?</h2><p>ক্যাটাগরি বেছে নিয়ে সেবার তালিকায় যান।</p></div><div class="category-grid">' + Object.keys(icons).slice(0,8).map(name => '<a class="category-card" href="#find?category=' + encodeURIComponent(name) + '"><span class="icon">' + icons[name] + '</span><b>' + esc(name) + '</b></a>').join('') + '</div></div></section><section class="section"><div class="container"><div class="cta-band"><div><h2>আপনার দক্ষতাই হতে পারে পরবর্তী সুযোগ</h2><p>সেবাদাতা হিসেবে নিবন্ধন করে নিজের কাজের পরিচিতি তৈরি করুন।</p></div><a class="btn" href="#provider-start">প্রোফাইল তৈরি করুন →</a></div></div></section>';
}
function authPage(kind) {
  const isProvider = kind === 'signup-provider';
  if (kind === 'login') {
    if (user) {
      const displayName = esc(profile && (profile.username || profile.full_name) || 'আপনার অ্যাকাউন্ট');
      const accountLine = profile && profile.phone ? esc(profile.phone) : esc(user.phone || '');
      return '<section class="page"><div class="container"><div class="panel form-card"><div class="page-head"><div class="eyebrow">WELCOME BACK</div><h1>আবার স্বাগতম!</h1><p>আপনি ইতিমধ্যে লগইন করা আছেন।</p></div><div class="profile-top" style="margin:22px 0"><div class="profile-avatar">' + esc(displayName.slice(0,1).toUpperCase()) + '</div><div><h2 style="margin:0;font-size:20px">' + displayName + '</h2><p class="hint">' + accountLine + '</p></div></div><div class="form-actions"><button class="btn" type="button" id="continue-session">প্রোফাইলে যান</button><button class="btn btn-outline" type="button" id="switch-account">অন্য অ্যাকাউন্ট ব্যবহার করুন</button></div></div></div></section>';
    }
    return '<section class="page"><div class="container"><div class="panel form-card"><div class="auth-tabs"><a href="#login" class="active">লগইন</a><a href="#signup-customer">নিবন্ধন</a></div><div class="page-head"><div class="eyebrow">WELCOME BACK</div><h1>আপনার অ্যাকাউন্টে প্রবেশ করুন</h1><p>মোবাইল নম্বর অথবা ইউজারনেম ও পাসওয়ার্ড ব্যবহার করুন।</p></div>' + backendNotice() + '<form id="login-form" class="form-grid"><div class="field full"><label for="login-username">মোবাইল নম্বর / ইউজারনেম</label><input id="login-username" name="username" type="text" required maxlength="254" autocomplete="username" placeholder="01XXXXXXXXX অথবা username"></div><div class="field full"><label for="login-password">পাসওয়ার্ড</label><input id="login-password" name="password" type="password" required autocomplete="current-password" placeholder="আপনার পাসওয়ার্ড"></div><div class="field full"><button class="btn btn-outline" type="button" id="show-login-password">পাসওয়ার্ড দেখুন</button></div><div class="field full"><button class="btn" type="submit" ' + (!db ? 'disabled' : '') + '>লগইন করুন</button></div></form><p class="hint">অ্যাকাউন্ট নেই? <a class="text-link" href="#signup-customer">নতুন অ্যাকাউন্ট খুলুন</a></p><p class="hint">পুরোনো ইমেইলভিত্তিক অ্যাকাউন্ট থাকলে ইমেইল দিয়েও লগইন করা যাবে।</p></div></div></section>';
  }
  return '<section class="page"><div class="container"><div class="panel form-card"><div class="auth-tabs"><a href="#login">লগইন</a><a href="#signup-customer" class="' + (!isProvider ? 'active' : '') + '">সেবাগ্রহীতা</a><a href="#signup-provider" class="' + (isProvider ? 'active' : '') + '">ফ্রিল্যান্সার / সেবাদাতা</a></div><div class="page-head"><div class="eyebrow">CREATE ACCOUNT</div><h1>' + (isProvider ? 'ফ্রিল্যান্সার অ্যাকাউন্ট খুলুন' : 'সেবাগ্রহীতার অ্যাকাউন্ট খুলুন') + '</h1><p>মোবাইল নম্বর, ইউজারনেম ও পাসওয়ার্ড দিয়েই অ্যাকাউন্ট তৈরি হবে। Gmail লাগবে না।</p></div>' + backendNotice() + '<form id="signup-form" data-role="' + (isProvider ? 'provider' : 'customer') + '" class="form-grid">' + formField('পূর্ণ নাম','full_name','text','আপনার নাম',true,'autocomplete="name" maxlength="100"') + formField('ইউজারনেম','username','text','৪–২০ অক্ষর; ইংরেজি, সংখ্যা বা _',true,'minlength="4" maxlength="20" pattern="[A-Za-z0-9_]{4,20}" autocomplete="username"') + formField('বাংলাদেশি মোবাইল নম্বর','phone','tel','01XXXXXXXXX',true,'autocomplete="tel" inputmode="tel" maxlength="14" pattern="(01[3-9][0-9]{8}|\\+?8801[3-9][0-9]{8})"') + '<div class="field full"><label for="signup-password">পাসওয়ার্ড</label><input id="signup-password" name="password" type="password" required minlength="8" maxlength="72" autocomplete="new-password" placeholder="কমপক্ষে ৮ অক্ষর"></div><div class="field full"><div class="notice warn">মোবাইল নম্বরটি সঠিক ফরম্যাটে দিতে হবে। এখনই অ্যাকাউন্ট খুলতে SMS বা Gmail লাগবে না। তবে OTP যাচাই না হওয়া পর্যন্ত নম্বরের মালিকানা যাচাইকৃত হিসেবে দেখানো হবে না।</div></div><div class="field full"><label class="hint"><input type="checkbox" name="terms" required> আমি ব্যবহারের নিয়ম ও গোপনীয়তা নীতি মেনে নিচ্ছি।</label></div><div class="field full"><button class="btn" type="submit" ' + (!db ? 'disabled' : '') + '>অ্যাকাউন্ট তৈরি করুন</button></div></form><p class="hint">আগে থেকেই অ্যাকাউন্ট আছে? <a class="text-link" href="#login">লগইন করুন</a></p></div></div></section>';
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
  let html = '<section class="page"><div class="container"><div class="page-head"><div class="eyebrow">FREELANCE MARKETPLACE</div><h1>দক্ষ ফ্রিল্যান্সার ও সেবাদাতা খুঁজুন</h1><p>ক্যাটাগরি, জেলা বা কাজের নাম দিয়ে খুঁজুন।</p></div><form class="panel search-panel" id="search-form"><div class="search-grid">' +
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
  const service = result.data;
  const [skillResult, experienceResult] = await Promise.all([
    db.from('provider_skills').select('skill_name,skill_level,years_experience,verification_status').eq('user_id',service.provider_id).order('skill_name'),
    db.from('provider_experiences').select('role_title,organization,location,start_date,end_date,currently_working,description,verification_status').eq('user_id',service.provider_id).eq('verification_status','verified').order('start_date',{ascending:false})
  ]);
  const skills = (skillResult.data || []).map(skill =>
    '<span class="skill-tag">' + esc(skill.skill_name) + (skill.verification_status === 'verified' ? ' <b class="skill-verified">✓ যাচাইকৃত</b>' : ' <small>স্ব-ঘোষিত</small>') + '</span>'
  ).join('');
  const experiences = (experienceResult.data || []).map(item => {
    const period = (item.start_date ? new Date(item.start_date).toLocaleDateString('bn-BD',{year:'numeric',month:'short'}) : '') +
      (item.currently_working ? ' — বর্তমানে' : (item.end_date ? ' — ' + new Date(item.end_date).toLocaleDateString('bn-BD',{year:'numeric',month:'short'}) : ''));
    return '<article class="experience-card"><b>' + esc(item.role_title) + '</b><div class="muted">' + esc(item.organization || 'স্বাধীন কাজ') + (item.location ? ' · ' + esc(item.location) : '') + '</div><small class="muted">' + esc(period) + '</small><p>' + esc(item.description || '') + '</p><span class="verify-pill"><span class="verify-dot">✓</span> অভিজ্ঞতা যাচাইকৃত</span></article>';
  }).join('');
  const handle = service.username ? '@' + service.username : 'ইউজারনেম নেই';
  const phoneBadge = service.phone_verified ? '<span class="verify-pill"><span class="verify-dot">✓</span> মোবাইল নম্বর যাচাইকৃত</span>' : '';
  app.innerHTML = '<section class="page"><div class="container"><div class="crumb"><a href="#find">সেবার তালিকা</a> / বিস্তারিত</div><div class="panel"><div class="service-meta"><span class="tag">'+esc(service.category_name)+'</span><span class="tag">'+esc(service.district || 'এলাকা উল্লেখ নেই')+'</span></div><div class="profile-top"><div class="profile-avatar">'+esc((service.business_name||'স').slice(0,1))+'</div><div><h1>'+esc(service.business_name)+'</h1><p>'+esc(service.professional_title || 'সেবাদাতা')+' · '+esc(service.area || '')+' · '+esc(service.experience_years || 0)+' বছরের অভিজ্ঞতা</p><p class="muted">'+esc(handle)+'</p>'+phoneBadge+'</div></div><hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><h2>'+esc(service.title)+'</h2><p>'+esc(service.description)+'</p><p><b>প্রারম্ভিক মূল্য:</b> '+esc(money(service.price_from))+'</p><p><b>সেবাদাতার পরিচিতি:</b> '+esc(service.bio || service.profile_overview || 'পরিচিতি দেওয়া হয়নি।')+'</p>'+(skills?'<section class="profile-section"><h3>দক্ষতা</h3><div class="skill-tags">' + skills + '</div></section>':'')+(experiences?'<section class="profile-section"><h3>যাচাইকৃত কাজের অভিজ্ঞতা</h3><div class="experience-list">'+experiences+'</div></section>':'')+'<div class="notice">যোগাযোগের ফোন নম্বর পাবলিক প্রোফাইলে দেখানো হয় না। কাজের অনুরোধ পাঠানোর পর অনুমোদিত প্রক্রিয়ায় যোগাযোগ করা যাবে।</div><div class="form-actions"><a class="btn" href="#request/'+encodeURIComponent(service.id)+'">কাজের অনুরোধ পাঠান</a><a class="btn btn-outline" href="#find">আরও সেবা দেখুন</a></div></div></div></section>';
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
  app.innerHTML = '<section class="page"><div class="container"><div class="profile-top" style="margin-bottom:22px"><div class="profile-avatar">'+esc((profile && profile.full_name || profile && profile.phone || 'U').slice(0,1))+'</div><div><div class="eyebrow">MY DASHBOARD</div><h1>' + esc(profile && profile.full_name || user.phone || user.email || 'আপনার অ্যাকাউন্ট') + '</h1><p>'+(isProvider?'সেবাদাতা অ্যাকাউন্ট':'সেবাগ্রহীতা অ্যাকাউন্ট')+' · '+esc(profile && profile.district || 'এলাকা সেট করা হয়নি')+'</p></div><button id="logout-btn" class="btn btn-outline right">লগআউট</button></div><div class="dashboard-grid"><nav class="side-nav"><a class="active" href="#dashboard">ড্যাশবোর্ড</a>'+(isProvider?'<a href="#provider-start">আমার সেবা</a>':'<a href="#find">সেবা খুঁজুন</a>')+'<a href="#account">প্রোফাইল সেটিংস</a></nav><div><div class="stats"><div class="stat"><strong>'+requests.length.toLocaleString('bn-BD')+'</strong><span>'+(isProvider?'পাওয়া অনুরোধ':'পাঠানো অনুরোধ')+'</span></div><div class="stat"><strong>'+services.length.toLocaleString('bn-BD')+'</strong><span>আমার সেবা</span></div><div class="stat"><strong>'+esc(pp.data?statusLabels[pp.data.approval_status] || pp.data.approval_status:'—')+'</strong><span>প্রোফাইল যাচাই</span></div></div><div class="panel"><div class="results-head"><div><h2>'+(isProvider?'আমার কাছে আসা অনুরোধ':'আমার পাঠানো অনুরোধ')+'</h2><p>সর্বশেষ কাজের আপডেট</p></div></div>'+rows+'</div>'+(isProvider?'<div class="panel" style="margin-top:16px"><div class="results-head"><div><h2>আমার সেবাসমূহ</h2><p>অ্যাডমিন যাচাইয়ের অবস্থা</p></div></div>'+(services.length?'<div class="table-wrap"><table><thead><tr><th>সেবা</th><th>অবস্থা</th></tr></thead><tbody>'+services.map(s=>'<tr><td>'+esc(s.title)+'</td><td><span class="status '+esc(s.status)+'">'+esc(statusLabels[s.status] || s.status)+'</span></td></tr>').join('')+'</tbody></table></div>':emptyState('সেবা যোগ করা হয়নি','আপনার সেবা-প্রোফাইল তৈরি করুন।'))+'</div>':'')+'</div></div></div></section>';
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
async function completeProfilePage() {
  if (!user) { go('login'); return; }
  await ensureProfile();
  if (profile && profile.phone_verified_at) { go(profile.user_type === 'provider' ? 'provider-start' : 'profile'); return; }
  const meta = user.user_metadata || {};
  const displayName = profile && profile.full_name || meta.full_name || 'আপনার নাম';
  const suggestedUsername = profile && profile.username || meta.username || '';
  const emailText = profile && profile.phone || (user.user_metadata && user.user_metadata.phone) || (user.email && !user.email.endsWith('.local-service-finder.invalid') ? user.email : '');
  app.innerHTML = '<section class="page"><div class="container"><div class="panel form-card"><div class="page-head"><div class="eyebrow">YOUR LOCAL SERVICE FINDER PROFILE</div><h1>নিজস্ব প্রোফাইল সম্পূর্ণ করুন</h1><p>একটি ইউজারনেম নিশ্চিত করুন, মোবাইল নম্বর দিন এবং SMS কোড দিয়ে নম্বরের মালিকানা যাচাই করুন।</p></div><div class="profile-top" style="margin:18px 0 22px"><div class="profile-avatar">' + esc(displayName.slice(0,1).toUpperCase()) + '</div><div><h2 style="margin:0;font-size:19px">' + esc(displayName) + '</h2><p class="hint">' + esc(emailText) + '</p></div></div><form id="initial-profile-form" class="form-grid">' + formField('ইউজারনেম','username','text','৪–২০ অক্ষর; ইংরেজি, সংখ্যা বা _',true,'minlength="4" maxlength="20" pattern="[A-Za-z0-9_]{4,20}" autocomplete="username"') + formField('মোবাইল নম্বর','phone','tel','01XXXXXXXXX',true,'autocomplete="tel" inputmode="tel" maxlength="14"') + '<div class="field full"><label for="initial-user-type">আপনি কীভাবে ব্যবহার করবেন?</label><select id="initial-user-type" name="user_type" required><option value="customer">আমি সেবা খুঁজব</option><option value="provider">আমি নিজের সেবা / দক্ষতা দিয়ে কাজ দিতে চাই</option></select><p class="hint">সেবাদাতা হলে পরের ধাপে দক্ষতা, কাজের অভিজ্ঞতা ও সার্টিফিকেট যোগ করতে পারবেন।</p></div>' + formField('পেশাগত পরিচয় (ঐচ্ছিক)','professional_title','text','যেমন: গ্রাফিক ডিজাইনার / ইলেকট্রিশিয়ান',false) + '<div class="field full"><label for="initial-overview">নিজের সম্পর্কে সংক্ষেপে</label><textarea id="initial-overview" name="overview" rows="3" placeholder="আপনার দক্ষতা, আগ্রহ ও কাজের ধরন…"></textarea></div><div class="field full"><button class="btn" type="submit">মোবাইলে OTP পাঠান</button></div></form><div id="phone-otp-panel" class="notice warn hidden"><b>যাচাইকরণ কোড পাঠানো হয়েছে</b><p>মোবাইলে পাওয়া ৬ সংখ্যার কোডটি লিখুন।</p><form id="phone-otp-form" class="form-grid">' + formField('৬ সংখ্যার OTP','token','text','123456',true,'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"') + '<div class="field full"><button class="btn" type="submit">নম্বর যাচাই করুন</button></div></form></div><p class="hint">OTP সফল না হওয়া পর্যন্ত নম্বরটি Verified হবে না। নম্বর যাচাইয়ের জন্য সাইটে SMS সেবা সক্রিয় থাকা প্রয়োজন।</p></div></div></section>';
  const form = document.getElementById('initial-profile-form');
  form.elements.username.value = suggestedUsername;
  form.elements.user_type.value = profile && profile.user_type || meta.user_type || 'customer';
  form.elements.professional_title.value = profile && profile.professional_title || '';
  form.elements.overview.value = profile && profile.overview || '';
  if (profile && profile.phone) form.elements.phone.value = profile.phone;
}
async function completeInitialProfile(form) {
  if (!db || !user) return;
  const data = new FormData(form);
  const username = normalizeUsername(data.get('username'));
  const phone = toE164BangladeshPhone(data.get('phone'));
  const role = data.get('user_type') === 'provider' ? 'provider' : 'customer';
  const title = String(data.get('professional_title') || '').trim();
  const overview = String(data.get('overview') || '').trim();
  if (!validUsername(username)) { toast('সঠিক ইউজারনেম দিন: ৪–২০ অক্ষর, ইংরেজি/সংখ্যা/underscore।'); return; }
  if (!phone) { toast('সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন, যেমন 01XXXXXXXXX।'); return; }

  const profileUpdate = await db.from('profiles').update({
    username,
    user_type: role,
    professional_title: title,
    overview
  }).eq('id', user.id);
  if (profileUpdate.error) {
    const message = (profileUpdate.error.message || '').toLowerCase();
    toast(message.includes('duplicate') ? 'এই ইউজারনেমটি আগে থেকেই নেওয়া হয়েছে।' : 'প্রোফাইল তথ্য সংরক্ষণ হয়নি। আবার চেষ্টা করুন।');
    return;
  }
  const authUpdate = await db.auth.updateUser({ phone });
  if (authUpdate.error) {
    toast('SMS OTP পাঠানো যায়নি। Supabase-এ SMS Provider সেটআপ না থাকলে নম্বর যাচাই শুরু হবে না।');
    return;
  }
  pendingPhoneE164 = phone;
  const panel = document.getElementById('phone-otp-panel');
  if (panel) panel.classList.remove('hidden');
  toast('OTP পাঠানোর অনুরোধ হয়েছে। SMS এলে কোডটি লিখুন।');
}
async function verifyProfilePhone(form) {
  if (!db || !user || !pendingPhoneE164) return;
  const data = new FormData(form);
  const token = String(data.get('token') || '').trim();
  if (!/^[0-9]{6}$/.test(token)) { toast('৬ সংখ্যার OTP লিখুন।'); return; }
  const verified = await db.auth.verifyOtp({
    phone: pendingPhoneE164,
    token,
    type: 'phone_change'
  });
  if (verified.error) { toast('OTP সঠিক নয় বা মেয়াদ শেষ হয়েছে। আবার চেষ্টা করুন।'); return; }
  user = verified.data.user || user;
  const saved = await db.from('profiles').update({ phone: pendingPhoneE164 }).eq('id', user.id);
  if (saved.error) {
    toast('নম্বর যাচাই হয়েছে, কিন্তু প্রোফাইলে সংরক্ষণ হয়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
    return;
  }
  pendingPhoneE164 = null;
  await loadProfile();
  toast('মোবাইল নম্বর যাচাই সম্পন্ন হয়েছে।');
  if (profile && profile.user_type === 'provider') go('provider-start');
  else go('profile');
}


async function accountPage() {
  if (!user) { go('login'); return; }
  await loadProfile();
  const displayName = profile && profile.full_name || 'আপনার নাম';
  const roleLabel = profile && profile.user_type === 'provider' ? 'সেবাদাতা অ্যাকাউন্ট' : 'সেবাগ্রহীতা অ্যাকাউন্ট';
  const emailText = profile && profile.phone || (user.user_metadata && user.user_metadata.phone) || user.phone || (user.email && !user.email.endsWith('.local-service-finder.invalid') ? user.email : 'মোবাইল নম্বর যুক্ত নেই');
  const phoneStatus = profile && profile.phone_verified_at
    ? '<span class="status approved">মোবাইল মালিকানা যাচাইকৃত</span>'
    : (profile && profile.phone ? '<span class="status pending">OTP দিয়ে মালিকানা যাচাই হয়নি</span>' : '<span class="status pending">মোবাইল নম্বর যোগ করা হয়নি</span>');
  app.innerHTML = '<section class="page"><div class="container"><div class="panel form-card"><div class="profile-top" style="margin-bottom:18px"><div class="profile-avatar">' + esc(displayName.slice(0,1).toUpperCase()) + '</div><div><div class="eyebrow">MY PROFILE</div><h1>' + esc(displayName) + '</h1><p>@' + esc(profile && profile.username || '') + '</p><p>' + esc(emailText) + '</p><p class="hint">' + esc(roleLabel) + '</p></div></div><div class="form-actions" style="margin:0 0 22px"><a class="btn btn-outline" href="#dashboard">আমার ড্যাশবোর্ড</a><a class="btn btn-quiet" href="#logout">লগআউট</a></div><div class="notice"><b>মোবাইল নম্বর:</b> ' + esc(profile && profile.phone || 'এখনো যোগ করা হয়নি') + ' ' + phoneStatus + '' + '</div><div class="page-head"><div class="eyebrow">PROFILE SETTINGS</div><h2>প্রোফাইল তথ্য</h2><p>আপনার পরিচিতি ও এলাকার তথ্য হালনাগাদ করুন। অ্যাকাউন্টে থাকা যোগাযোগের নম্বরটি এখানে দেখানো হয়; OTP যাচাই না হওয়া পর্যন্ত এটি Verified নয়।</p></div><form id="account-form" class="form-grid">' + formField('পূর্ণ নাম','full_name','text','আপনার নাম',true) + formField('ইউজারনেম','username','text','৪–২০ অক্ষর; ইংরেজি, সংখ্যা বা _',true,'minlength="4" maxlength="20" pattern="[A-Za-z0-9_]{4,20}"') + formField('পেশাগত পরিচয়','professional_title','text','যেমন: ভিডিও এডিটর / টিউটর',false) + '<div class="field full"><label for="account-overview">নিজের সম্পর্কে</label><textarea id="account-overview" name="overview" rows="4" placeholder="দক্ষতা, কাজের অভিজ্ঞতা ও আগ্রহ…"></textarea></div>' + districtSelectField('জেলা','district',false,false) + areaSelectField('উপজেলা / থানা','area',false,false) + '<div class="field full"><button class="btn" type="submit">তথ্য সংরক্ষণ করুন</button></div></form><p class="hint">সার্টিফিকেট/অভিজ্ঞতার প্রমাণপত্র আপনার ব্যক্তিগত ফাইলে থাকবে; অনুমোদন না হওয়া পর্যন্ত Verified দেখাবে না।</p></div></div></section>';
  const form = document.getElementById('account-form');
  attachLocationSelectors(form, profile && profile.district || '', profile && profile.area || '');
  form.elements.full_name.value = profile && profile.full_name || '';
  form.elements.username.value = profile && profile.username || '';
  form.elements.professional_title.value = profile && profile.professional_title || '';
  form.elements.overview.value = profile && profile.overview || '';
}

async function adminPage() {
  if (!user || !db) { go('login'); return; }
  const check = await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
  if (check.error || !check.data) {
    app.innerHTML='<section class="page"><div class="container">'+emptyState('অ্যাডমিন প্রবেশাধিকার নেই','এই পেজ শুধু অনুমোদিত অ্যাডমিনদের জন্য।','🔒')+'</div></section>';
    return;
  }

  const [providerResult, serviceResult, documentResult, skillResult, experienceResult] = await Promise.all([
    db.from('provider_profiles').select('user_id,business_name,bio,experience_years,district,area,created_at,profile:profiles(full_name,username,phone_verified_at)').eq('approval_status','pending').order('created_at'),
    db.from('services').select('id,title,description,provider_id,category:categories(name),provider:provider_profiles(business_name,approval_status)').eq('status','pending').order('created_at'),
    db.from('provider_documents').select('id,user_id,document_type,title,issuer,description,file_path,verification_status,created_at,profile:profiles(full_name,username)').eq('verification_status','pending').order('created_at'),
    db.from('provider_skills').select('id,user_id,skill_name,skill_level,years_experience,verification_status,profile:profiles(full_name,username)').in('verification_status',['unverified','pending']).order('created_at'),
    db.from('provider_experiences').select('id,user_id,role_title,organization,location,start_date,end_date,currently_working,description,verification_status,profile:profiles(full_name,username)').in('verification_status',['unverified','pending']).order('created_at')
  ]);
  const firstError = [providerResult,serviceResult,documentResult,skillResult,experienceResult].find(r=>r.error);
  if (firstError) {
    app.innerHTML='<section class="page"><div class="container">'+notice('অ্যাডমিন যাচাই তালিকা লোড করা যায়নি: '+firstError.error.message,'error')+'</div></section>';
    return;
  }

  const providers = providerResult.data || [];
  const services = serviceResult.data || [];
  const documents = documentResult.data || [];
  const skills = skillResult.data || [];
  const experiences = experienceResult.data || [];

  const docsWithLinks = await Promise.all(documents.map(async doc => {
    const signed = await db.storage.from('provider-evidence').createSignedUrl(doc.file_path,600);
    return {...doc, signedUrl: signed.data && signed.data.signedUrl || ''};
  }));

  const providerRows = providers.length ? '<div class="table-wrap"><table><thead><tr><th>পরিচয়</th><th>এলাকা</th><th>অভিজ্ঞতা</th><th>ফোন</th><th>সিদ্ধান্ত</th></tr></thead><tbody>' +
    providers.map(p => {
      const verified = !!(p.profile && p.profile.phone_verified_at);
      return '<tr><td><b>' + esc(p.profile && p.profile.full_name || 'নাম নেই') + '</b><br><small>@' + esc(p.profile && p.profile.username || '') + '</small><br>' + esc(p.business_name) + '</td><td>' + esc((p.district || '-')+' · '+(p.area || '-')) + '</td><td>' + esc(p.experience_years) + ' বছর</td><td><span class="status '+(verified?'approved':'pending')+'">'+(verified?'যাচাইকৃত':'যাচাই বাকি')+'</span></td><td><button class="btn btn-small" data-provider="'+esc(p.user_id)+'" data-next="approved" '+(!verified?'disabled title="ফোন যাচাই প্রয়োজন"':'')+'>অনুমোদন</button> <button class="btn btn-small btn-outline" data-provider="'+esc(p.user_id)+'" data-next="rejected">প্রত্যাখ্যান</button></td></tr>';
    }).join('') + '</tbody></table></div>' : emptyState('কোনো অপেক্ষমাণ প্রোফাইল নেই','নতুন সেবাদাতা নিবন্ধন করলে এখানে আসবে।','✅');

  const serviceRows = services.length ? '<div class="table-wrap"><table><thead><tr><th>সেবা</th><th>ক্যাটাগরি</th><th>সেবাদাতা</th><th>সিদ্ধান্ত</th></tr></thead><tbody>' +
    services.map(item => '<tr><td>'+esc(item.title)+'</td><td>'+esc(item.category && item.category.name || '-')+'</td><td>'+esc(item.provider && item.provider.business_name || '-')+'</td><td><button class="btn btn-small" data-service="'+esc(item.id)+'" data-next="approved">অনুমোদন</button> <button class="btn btn-small btn-outline" data-service="'+esc(item.id)+'" data-next="rejected">প্রত্যাখ্যান</button></td></tr>').join('') +
    '</tbody></table></div>' : emptyState('কোনো অপেক্ষমাণ সেবা নেই','সেবাদাতারা নতুন সেবা জমা দিলে এখানে আসবে।','✅');

  const documentCards = docsWithLinks.length ? '<div class="review-grid">' + docsWithLinks.map(doc => {
    const type = doc.document_type === 'certificate' ? 'সার্টিফিকেট' : doc.document_type === 'experience' ? 'অভিজ্ঞতার প্রমাণ' : 'কাজের নমুনা';
    return '<article class="review-card"><div class="review-card-head"><span class="tag">'+type+'</span><span class="status pending">যাচাই বাকি</span></div><h3>'+esc(doc.title)+'</h3><p class="muted">'+esc(doc.profile && doc.profile.full_name || 'ব্যবহারকারী')+' · @'+esc(doc.profile && doc.profile.username || '')+'</p>'+(doc.issuer?'<p><b>প্রদানকারী:</b> '+esc(doc.issuer)+'</p>':'')+'<p class="muted">'+new Date(doc.created_at).toLocaleDateString('bn-BD')+'</p>'+(doc.signedUrl?'<a class="btn btn-outline btn-small" href="'+esc(doc.signedUrl)+'" target="_blank" rel="noopener">ফাইল খুলুন</a>':'<p class="notice warn">ফাইল খোলা যাচ্ছে না; Storage permission পরীক্ষা করুন।</p>')+'<input class="review-note-input" type="text" maxlength="300" placeholder="রিভিউ নোট (ঐচ্ছিক)" data-doc-note="'+esc(doc.id)+'"><div class="form-actions"><button class="btn btn-small" data-doc-review="'+esc(doc.id)+'" data-next="verified">যাচাই অনুমোদন</button><button class="btn btn-small btn-outline" data-doc-review="'+esc(doc.id)+'" data-next="rejected">প্রত্যাখ্যান</button></div></article>';
  }).join('') + '</div>' : emptyState('কোনো অপেক্ষমাণ ফাইল নেই','নতুন সার্টিফিকেট বা অভিজ্ঞতার প্রমাণ জমা হলে এখানে দেখা যাবে।','📎');

  const skillRows = skills.length ? '<div class="table-wrap"><table><thead><tr><th>দক্ষতা</th><th>ব্যবহারকারী</th><th>স্তর</th><th>অভিজ্ঞতা</th><th>সিদ্ধান্ত</th></tr></thead><tbody>' +
    skills.map(item=>'<tr><td><b>'+esc(item.skill_name)+'</b></td><td>'+esc(item.profile && item.profile.full_name || 'ব্যবহারকারী')+'<br><small>@'+esc(item.profile && item.profile.username || '')+'</small></td><td>'+esc(item.skill_level)+'</td><td>'+esc(item.years_experience)+' বছর</td><td><button class="btn btn-small" data-skill-review="'+esc(item.id)+'" data-next="verified">যাচাই</button> <button class="btn btn-small btn-outline" data-skill-review="'+esc(item.id)+'" data-next="rejected">প্রত্যাখ্যান</button></td></tr>').join('') +
    '</tbody></table></div>' : emptyState('কোনো অপেক্ষমাণ দক্ষতা নেই','নতুন দক্ষতা জমা হলে এখানে দেখা যাবে।','🧩');

  const experienceRows = experiences.length ? '<div class="review-grid">' + experiences.map(item=>'<article class="review-card"><span class="tag">কাজের অভিজ্ঞতা</span><h3>'+esc(item.role_title)+'</h3><p>'+esc(item.profile && item.profile.full_name || 'ব্যবহারকারী')+' · @'+esc(item.profile && item.profile.username || '')+'</p><p><b>প্রতিষ্ঠান:</b> '+esc(item.organization || 'উল্লেখ নেই')+'</p><p>'+esc(item.description || '')+'</p><div class="form-actions"><button class="btn btn-small" data-exp-review="'+esc(item.id)+'" data-next="verified">যাচাই</button><button class="btn btn-small btn-outline" data-exp-review="'+esc(item.id)+'" data-next="rejected">প্রত্যাখ্যান</button></div></article>').join('') + '</div>' : emptyState('কোনো অপেক্ষমাণ অভিজ্ঞতা নেই','নতুন অভিজ্ঞতা জমা হলে এখানে দেখা যাবে।','🗂️');

  app.innerHTML = '<section class="page"><div class="container"><div class="page-head"><div class="eyebrow">ADMIN CONTROL</div><h1>অ্যাডমিন যাচাই কেন্দ্র</h1><p>ফোন নম্বর, দক্ষতা, কাজের অভিজ্ঞতা ও প্রমাণপত্র দেখে যাচাই করুন। ডকুমেন্টগুলো private; public profile-এ আসল ফাইল দেখানো হয় না।</p></div><div class="panel"><div class="results-head"><div><h2>সেবাদাতা প্রোফাইল</h2><p>ফোন যাচাই ছাড়া কোনো প্রোফাইল অনুমোদন করা যাবে না।</p></div></div>'+providerRows+'</div><div class="panel" style="margin-top:16px"><div class="results-head"><div><h2>সার্টিফিকেট ও প্রমাণপত্র</h2><p>ফাইল private storage থেকে সাময়িক signed link দিয়ে দেখা যাবে।</p></div></div>'+documentCards+'</div><div class="panel" style="margin-top:16px"><div class="results-head"><div><h2>দক্ষতা যাচাই</h2><p>শুধু প্রমাণ দেখে নিশ্চিত হওয়া দক্ষতাকেই Verified করুন।</p></div></div>'+skillRows+'</div><div class="panel" style="margin-top:16px"><div class="results-head"><div><h2>কাজের অভিজ্ঞতা যাচাই</h2></div></div>'+experienceRows+'</div><div class="panel" style="margin-top:16px"><div class="results-head"><div><h2>সেবা যাচাই</h2><p>অনুমোদিত সেবাদাতার সেবাগুলো প্রকাশ করুন।</p></div></div>'+serviceRows+'</div></div></section>';

  app.querySelectorAll('[data-provider]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    const r=await db.rpc('admin_set_provider_status',{p_user_id:btn.dataset.provider,p_status:btn.dataset.next});
    if(r.error || r.data !== true) { toast('অনুমোদন হয়নি। ফোন যাচাই ও অন্তত একটি দক্ষতা জমা আছে কি না দেখুন।'); btn.disabled=false; }
    else { toast('প্রোফাইলের সিদ্ধান্ত সংরক্ষিত হয়েছে।'); adminPage(); }
  }));
  app.querySelectorAll('[data-service]').forEach(btn=>btn.addEventListener('click',async()=>{
    const r=await db.rpc('admin_set_service_status',{p_service_id:btn.dataset.service,p_status:btn.dataset.next});
    if(r.error || r.data !== true) toast('সেবার সিদ্ধান্ত সংরক্ষণ হয়নি: '+(r.error ? r.error.message : 'অ্যাডমিন অনুমতি যাচাই করুন।'));
    else { toast('সেবার সিদ্ধান্ত সংরক্ষিত হয়েছে।'); adminPage(); }
  }));
  app.querySelectorAll('[data-doc-review]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    const noteField=app.querySelector('[data-doc-note="'+btn.dataset.docReview+'"]');
    const result=await db.from('provider_documents').update({
      verification_status:btn.dataset.next,
      reviewer_note:noteField ? noteField.value.trim() || null : null,
      reviewed_by:user.id,
      reviewed_at:new Date().toISOString()
    }).eq('id',btn.dataset.docReview);
    if(result.error) { toast('ডকুমেন্টের সিদ্ধান্ত সংরক্ষণ হয়নি: '+result.error.message); btn.disabled=false; }
    else { toast('ডকুমেন্ট রিভিউ সংরক্ষণ হয়েছে।'); adminPage(); }
  }));
  app.querySelectorAll('[data-skill-review]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    const result=await db.from('provider_skills').update({verification_status:btn.dataset.next}).eq('id',btn.dataset.skillReview);
    if(result.error) { toast('দক্ষতার সিদ্ধান্ত সংরক্ষণ হয়নি: '+result.error.message); btn.disabled=false; }
    else { toast('দক্ষতার যাচাই আপডেট হয়েছে।'); adminPage(); }
  }));
  app.querySelectorAll('[data-exp-review]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    const result=await db.from('provider_experiences').update({verification_status:btn.dataset.next}).eq('id',btn.dataset.expReview);
    if(result.error) { toast('অভিজ্ঞতার সিদ্ধান্ত সংরক্ষণ হয়নি: '+result.error.message); btn.disabled=false; }
    else { toast('অভিজ্ঞতার যাচাই আপডেট হয়েছে।'); adminPage(); }
  }));
}

async function howPage() {
  app.innerHTML='<section class="page"><div class="container"><div class="page-head"><div class="eyebrow">HOW IT WORKS</div><h1>ব্যবহার করার নিয়ম</h1><p>সেবাগ্রহীতা ও সেবাদাতার জন্য সহজ ধাপ।</p></div><div class="feature-grid"><article class="feature-card"><div class="icon">1️⃣</div><h3>অ্যাকাউন্ট তৈরি</h3><p>সেবাগ্রহীতা বা সেবাদাতা হিসেবে সঠিক তথ্য দিয়ে নিবন্ধন করুন।</p></article><article class="feature-card"><div class="icon">2️⃣</div><h3>সেবা বা প্রোফাইল যোগ</h3><p>সেবাগ্রহীতা এলাকা ও প্রয়োজন বেছে নেবেন। সেবাদাতা কাজের বিবরণ জমা দেবেন।</p></article><article class="feature-card"><div class="icon">3️⃣</div><h3>যাচাই ও অনুরোধ</h3><p>সেবাদাতার তথ্য যাচাইয়ের পর তালিকায় প্রকাশ হবে। তারপর কাজের অনুরোধ পাঠানো যাবে।</p></article></div><div class="notice warn">নিরাপত্তা: কাজ শুরুর আগে মূল্য, সময় ও কাজের পরিধি লিখিতভাবে ঠিক করুন। অপরিচিত কাউকে অগ্রিম টাকা বা সংবেদনশীল পরিচয়পত্রের তথ্য দেবেন না।</div></div></section>';
}
async function signUp(form) {
  if (!db) return;
  const data = new FormData(form);
  const role = form.dataset.role === 'provider' ? 'provider' : 'customer';
  const username = normalizeUsername(data.get('username'));
  const fullName = String(data.get('full_name') || '').trim();
  const phone = toE164BangladeshPhone(data.get('phone'));
  const password = String(data.get('password') || '');
  if (!fullName || fullName.length < 2 || fullName.length > 100) { toast('পূর্ণ নাম ২–১০০ অক্ষরের মধ্যে লিখুন।'); return; }
  if (!validUsername(username)) { toast('ইউজারনেম ৪–২০ অক্ষরের হতে হবে; শুধু ইংরেজি অক্ষর, সংখ্যা ও _ ব্যবহার করুন।'); return; }
  if (!phone) { toast('সঠিক বাংলাদেশি মোবাইল নম্বর দিন, যেমন 01XXXXXXXXX।'); return; }
  if (password.length < 8 || password.length > 72) { toast('পাসওয়ার্ড ৮–৭২ অক্ষরের মধ্যে হতে হবে।'); return; }
  if (!data.get('terms')) { toast('ব্যবহারের নিয়মে সম্মতি দিন।'); return; }
  const result = await db.functions.invoke('phone-signup', {
    body: { full_name: fullName, username, phone, password, user_type: role }
  });
  const session = result.data;
  if (result.error || !session || !session.access_token || !session.refresh_token) {
    toast((session && session.error) || 'অ্যাকাউন্ট তৈরি হয়নি। নম্বরটি বা ইউজারনেমটি আগে ব্যবহার করা হয়েছে কি না দেখুন।');
    return;
  }
  const saved = await db.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (saved.error || !saved.data.session) {
    toast('অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু লগইন সেশন চালু হয়নি। একই নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন।');
    return;
  }
  user = saved.data.user || saved.data.session.user;
  await ensureProfile();
  await loadProfile();
  toast('অ্যাকাউন্ট তৈরি হয়েছে। স্বাগতম!');
  go(role === 'provider' ? 'provider-start' : 'profile');
}
async function signInWithUsername(form) {
  if (!db) return;
  const data = new FormData(form);
  const rawIdentifier = String(data.get('username') || '').trim().toLowerCase();
  const phone = toE164BangladeshPhone(rawIdentifier);
  const identifier = phone || rawIdentifier;
  const password = String(data.get('password') || '');
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  if ((!phone && !isEmail && !validUsername(identifier)) || !password) {
    toast('সঠিক মোবাইল নম্বর, ইউজারনেম অথবা ইমেইল এবং পাসওয়ার্ড লিখুন।');
    return;
  }
  const result = await db.functions.invoke('username-login', { body: { username: identifier, password } });
  const session = result.data;
  if (result.error || !session || !session.access_token || !session.refresh_token) {
    toast((session && session.error) || 'নম্বর/ইউজারনেম অথবা পাসওয়ার্ড সঠিক নয়।');
    return;
  }
  const saved = await db.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (saved.error || !saved.data.session) {
    toast('লগইন সেশন তৈরি হয়নি। আবার চেষ্টা করুন।');
    return;
  }
  user = saved.data.user || saved.data.session.user;
  await ensureProfile();
  await loadProfile();
  toast('লগইন সফল হয়েছে।');
  const destination = afterLoginPath || 'profile';
  afterLoginPath = 'profile';
  if (profile && profile.user_type === 'provider') {
    const provider = await db.from('provider_profiles').select('user_id').eq('user_id',user.id).maybeSingle();
    if (!provider.data) { go('provider-start'); return; }
  }
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
async function uploadProviderDocuments(fileList, documentType, issuer) {
  const files = Array.from(fileList || []);
  if (!files.length) return 0;
  const allowed = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
  if (files.length > 5) throw new Error('এক ধাপে সর্বোচ্চ ৫টি ফাইল আপলোড করতে পারবেন।');
  let uploaded = 0;
  for (const file of files) {
    if (!allowed.has(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error('ফাইলের ধরন বা সাইজ ঠিক নয়: ' + file.name);
    }
    const safeName = file.name.normalize('NFKD').replace(/[^A-Za-z0-9._-]/g,'_').slice(-90) || 'document';
    const filePath = user.id + '/' + crypto.randomUUID() + '-' + safeName;
    const stored = await db.storage.from('provider-evidence').upload(filePath,file,{
      contentType:file.type,
      upsert:false
    });
    if (stored.error) throw new Error('ফাইল আপলোড হয়নি: ' + stored.error.message);
    const row = await db.from('provider_documents').insert({
      user_id:user.id,
      document_type:documentType,
      title:file.name.slice(0,140),
      issuer:issuer || null,
      file_path:filePath,
      verification_status:'pending'
    });
    if (row.error) {
      await db.storage.from('provider-evidence').remove([filePath]);
      throw new Error('ফাইলের তথ্য সংরক্ষণ হয়নি: ' + row.error.message);
    }
    uploaded += 1;
  }
  return uploaded;
}
async function saveProvider(form) {
  if (!db || !user) return;
  const d = new FormData(form);
  let skills = [];
  try {
    const parsedSkills = JSON.parse(String(d.get('skills') || '[]'));
    skills = Array.isArray(parsedSkills) ? parsedSkills.map(x=>String(x).trim()).filter(Boolean) : [];
  } catch {
    skills = String(d.get('skills') || '').split(/[,،;\r\n]+/).map(x=>x.trim()).filter(Boolean);
  }
  skills = Array.from(new Map(skills.map(x=>[x.toLowerCase(),x])).values());
  if (!skills.length) { toast('কমপক্ষে একটি দক্ষতা যোগ করুন।'); return; }
  if (skills.length > 20) { toast('সর্বোচ্চ ২০টি দক্ষতা যোগ করতে পারবেন।'); return; }
  const title = String(d.get('professional_title') || '').trim();
  const locationUpdate = await db.from('profiles').update({
    district:String(d.get('district')).trim(),
    area:String(d.get('area')).trim(),
    professional_title:title,
    overview:String(d.get('bio')).trim()
  }).eq('id',user.id);
  if (locationUpdate.error) { toast('প্রোফাইলের তথ্য সংরক্ষণ হয়নি: '+locationUpdate.error.message); return; }

  const provider = {
    user_id:user.id,
    business_name:String(d.get('business_name')).trim(),
    bio:String(d.get('bio')).trim(),
    district:String(d.get('district')).trim(),
    area:String(d.get('area')).trim(),
    experience_years:Number(d.get('experience_years'))
  };
  const p = await db.from('provider_profiles').insert(provider);
  if (p.error) { toast('সেবাদাতা প্রোফাইল তৈরি হয়নি: '+p.error.message); return; }

  const skillRows = skills.map(skill=>({
    user_id:user.id,
    skill_name:skill,
    skill_level:String(d.get('skill_level') || 'intermediate'),
    years_experience:Number(d.get('experience_years')) || 0,
    verification_status:'unverified'
  }));
  const skillSave = await db.from('provider_skills').insert(skillRows);
  if (skillSave.error) { toast('প্রোফাইল হয়েছে, কিন্তু দক্ষতার তালিকা সংরক্ষণ হয়নি: '+skillSave.error.message); return; }

  const experienceRole = String(d.get('experience_role') || '').trim();
  const experienceDescription = String(d.get('experience_description') || '').trim();
  if (experienceRole && experienceDescription) {
    const exp = await db.from('provider_experiences').insert({
      user_id:user.id,
      role_title:experienceRole,
      organization:String(d.get('experience_organization') || '').trim() || null,
      description:experienceDescription,
      verification_status:'unverified'
    });
    if (exp.error) { toast('অভিজ্ঞতার তথ্য সংরক্ষণ হয়নি: '+exp.error.message); return; }
  }

  const issuer = String(d.get('document_issuer') || '').trim();
  let certificateCount = 0, experienceFileCount = 0;
  try {
    certificateCount = await uploadProviderDocuments(form.elements.certificate_files.files,'certificate',issuer);
    experienceFileCount = await uploadProviderDocuments(form.elements.experience_files.files,'experience',issuer);
  } catch(err) {
    toast(err.message || 'প্রমাণপত্র আপলোড হয়নি।');
    return;
  }

  const service = {
    provider_id:user.id,
    category_id:Number(d.get('category_id')),
    title:String(d.get('title')).trim(),
    description:String(d.get('description')).trim(),
    price_from:d.get('price_from')?Number(d.get('price_from')):null,
    price_type:String(d.get('price_type')||'negotiable')
  };
  const serviceSave = await db.from('services').insert(service);
  if (serviceSave.error) { toast('প্রোফাইল ও প্রমাণপত্র সংরক্ষিত, কিন্তু সেবা যোগ হয়নি: '+serviceSave.error.message); go('dashboard'); return; }
  toast('প্রোফাইল জমা হয়েছে। দক্ষতা স্ব-ঘোষিত; ' + (certificateCount+experienceFileCount) + 'টি প্রমাণপত্র অ্যাডমিন যাচাইয়ের অপেক্ষায়।');
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
  if (!db || !user) return;
  const d = new FormData(form);
  const username = normalizeUsername(d.get('username'));
  if (!validUsername(username)) { toast('সঠিক ইউজারনেম দিন: ৪–২০ অক্ষর, ইংরেজি/সংখ্যা/underscore।'); return; }
  const result = await db.from('profiles').update({
    username,
    full_name:String(d.get('full_name')).trim(),
    professional_title:String(d.get('professional_title') || '').trim(),
    overview:String(d.get('overview') || '').trim(),
    district:String(d.get('district') || '').trim(),
    area:String(d.get('area') || '').trim()
  }).eq('id',user.id);
  if (result.error) {
    toast((result.error.message || '').toLowerCase().includes('duplicate') ? 'এই ইউজারনেমটি অন্য কেউ ব্যবহার করছে।' : 'তথ্য সংরক্ষণ হয়নি: '+result.error.message);
    return;
  }
  if (profile && profile.user_type === 'provider') {
    const providerUpdate = await db.from('provider_profiles').update({
      district:String(d.get('district') || '').trim(),
      area:String(d.get('area') || '').trim()
    }).eq('user_id',user.id);
    if (providerUpdate.error) { toast('এলাকার তথ্য সেবাদাতা প্রোফাইলে আপডেট হয়নি: '+providerUpdate.error.message); return; }
  }
  await loadProfile();
  toast('প্রোফাইল আপডেট হয়েছে।');
  go('profile');
}

function bindForms() {
  const skillPicker = document.getElementById('provider-skill-picker');
  if (skillPicker) {
    const valueField = document.getElementById('provider-skills-value');
    const tagsBox = document.getElementById('selected-skill-tags');
    const customField = document.getElementById('custom-provider-skill');
    const readSkills = () => {
      try { const value=JSON.parse(valueField.value || '[]'); return Array.isArray(value)?value:[]; }
      catch { return []; }
    };
    const paint = list => {
      valueField.value = JSON.stringify(list);
      tagsBox.innerHTML = list.length ? list.map(skill=>'<span class="skill-tag">'+esc(skill)+' <button type="button" data-remove-skill="'+esc(skill)+'" aria-label="দক্ষতা সরান">×</button></span>').join('') : '<span class="hint">এখনো কোনো দক্ষতা যোগ করা হয়নি।</span>';
      skillPicker.querySelectorAll('[data-add-skill]').forEach(button=>{
        const chosen=list.some(item=>item.toLowerCase()===button.dataset.addSkill.toLowerCase());
        button.classList.toggle('selected',chosen);
        button.disabled=chosen;
      });
    };
    const addSkill = raw => {
      const skill=String(raw || '').trim().replace(/\s+/g,' ');
      if (skill.length < 2 || skill.length > 60) { toast('দক্ষতার নাম ২–৬০ অক্ষরের মধ্যে দিন।'); return; }
      const list=readSkills();
      if (list.some(item=>item.toLowerCase()===skill.toLowerCase())) { toast('এই দক্ষতাটি আগে যোগ করা হয়েছে।'); return; }
      if (list.length>=20) { toast('সর্বোচ্চ ২০টি দক্ষতা যোগ করতে পারবেন।'); return; }
      list.push(skill);
      paint(list);
      if (customField) customField.value='';
    };
    skillPicker.addEventListener('click',event=>{
      const add=event.target.closest('[data-add-skill]');
      const remove=event.target.closest('[data-remove-skill]');
      if (add) addSkill(add.dataset.addSkill);
      if (remove) paint(readSkills().filter(item=>item!==remove.dataset.removeSkill));
      if (event.target.closest('#add-custom-provider-skill')) addSkill(customField.value);
    });
    if (customField) customField.addEventListener('keydown',event=>{
      if (event.key==='Enter') { event.preventDefault(); addSkill(customField.value); }
    });
    paint(readSkills());
  }

  const initialProfileForm = document.getElementById('initial-profile-form');
  if (initialProfileForm) initialProfileForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = initialProfileForm.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'প্রোফাইল তৈরি হচ্ছে…'; }
    try { await completeInitialProfile(initialProfileForm); }
    catch (err) { toast('প্রোফাইল তৈরি হয়নি। আবার চেষ্টা করুন।'); }
    finally { if (button && document.body.contains(button)) { button.disabled = false; button.textContent = 'প্রোফাইল তৈরি করুন'; } }
  });
  const phoneOtpForm = document.getElementById('phone-otp-form');
  if (phoneOtpForm) phoneOtpForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = phoneOtpForm.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'যাচাই হচ্ছে…'; }
    try { await verifyProfilePhone(phoneOtpForm); }
    catch (err) { toast('নম্বর যাচাই হয়নি। আবার চেষ্টা করুন।'); }
    finally { if (button && document.body.contains(button)) { button.disabled = false; button.textContent = 'নম্বর যাচাই করুন'; } }
  });
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
    toast('এই ডিভাইস থেকে লগআউট হয়েছে। অন্য অ্যাকাউন্টের ইউজারনেম ও পাসওয়ার্ড ব্যবহার করুন।');
    await render();
  });
  const handlers={
    'signup-form':signUp,'login-form':signInWithUsername,'provider-form':saveProvider,
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
    else if (r.name==='complete-profile') await completeProfilePage();
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
    db.auth.onAuthStateChange((event,session)=>{
      user=session?session.user:null;
      Promise.resolve().then(async()=>{
        if (user) await ensureProfile();
        else profile = null;
        await render();
      }).catch(() => toast('অ্যাকাউন্টের প্রোফাইল লোড করা যায়নি। পেজটি রিফ্রেশ করুন।'));
    });
    const cr=await db.from('categories').select('id,name,icon').order('name');
    if (!cr.error) categories=cr.data||[];
  }
  window.addEventListener('hashchange',render);
  await render();
}
init();
})();