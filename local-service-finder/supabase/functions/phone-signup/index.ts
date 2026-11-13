const SITE_ORIGIN = "https://local-service-finder-bd.vercel.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};
function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function readDefaultKey(value: string | undefined): string | null {
  if (!value) return null;
  try { const parsed = JSON.parse(value); return typeof parsed?.default === "string" ? parsed.default : null; } catch { return null; }
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || readDefaultKey(Deno.env.get("SUPABASE_SECRET_KEYS"));
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") || readDefaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
const attempts = new Map<string, { count: number; resetAt: number }>();
function isLimited(key: string): boolean {
  const now = Date.now(); const old = attempts.get(key);
  if (!old || old.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + 30 * 60 * 1000 }); return false; }
  old.count += 1; return old.count > 6;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response(405, { error: "Method not allowed." });
  const origin = req.headers.get("origin");
  if (origin && origin !== SITE_ORIGIN && !origin.startsWith("http://localhost:")) return response(403, { error: "Origin not allowed." });
  if (!SUPABASE_URL || !SERVICE_KEY || !PUBLIC_KEY) return response(503, { error: "Signup service is not configured." });
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 80);
  if (isLimited(ip)) return response(429, { error: "অনেকবার চেষ্টা হয়েছে। ৩০ মিনিট পর আবার চেষ্টা করুন।" });

  let input: { full_name?: unknown; username?: unknown; phone?: unknown; password?: unknown; user_type?: unknown };
  try { input = await req.json(); } catch { return response(400, { error: "সব তথ্য সঠিকভাবে দিন।" }); }
  const fullName = String(input.full_name || "").trim();
  const username = String(input.username || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  const password = String(input.password || "");
  const userType = input.user_type === "provider" ? "provider" : "customer";
  if (fullName.length < 2 || fullName.length > 100 || !/^[a-z0-9_]{4,20}$/.test(username)
      || !/^\+8801[3-9][0-9]{8}$/.test(phone) || password.length < 8 || password.length > 72) {
    return response(400, { error: "নাম, ইউজারনেম, বাংলাদেশি মোবাইল নম্বর বা পাসওয়ার্ডের তথ্য সঠিক নয়।" });
  }

  try {
    const profileUrl = new URL("/rest/v1/profiles", SUPABASE_URL);
    profileUrl.searchParams.set("select", "id");
    profileUrl.searchParams.set("username", "eq." + username);
    profileUrl.searchParams.set("limit", "1");
    const existing = await fetch(profileUrl, { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } });
    if (!existing.ok) return response(503, { error: "অ্যাকাউন্ট সেবা সাময়িকভাবে পাওয়া যাচ্ছে না।" });
    const existingRows = await existing.json();
    if (Array.isArray(existingRows) && existingRows.length) return response(409, { error: "এই ইউজারনেমটি আগে থেকেই নেওয়া হয়েছে। অন্যটি বেছে নিন।" });
    
    const phoneUrl = new URL("/rest/v1/profiles", SUPABASE_URL);
    phoneUrl.searchParams.set("select", "id");
    phoneUrl.searchParams.set("phone", "eq." + phone);
    phoneUrl.searchParams.set("limit", "1");
    const phoneExisting = await fetch(phoneUrl, { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } });
    if (!phoneExisting.ok) return response(503, { error: "অ্যাকাউন্ট সেবা সাময়িকভাবে পাওয়া যাচ্ছে না।" });
    const phoneRows = await phoneExisting.json();
    if (Array.isArray(phoneRows) && phoneRows.length) return response(409, { error: "এই মোবাইল নম্বরটি আগে থেকেই একটি অ্যাকাউন্টে ব্যবহার করা হয়েছে। লগইন করুন।" });

    // Internal email is deliberately under the reserved .invalid TLD: it cannot receive mail.
    // The actual login identifier remains the user's phone number or username.
    const internalEmail = "phone." + phone.replace(/\D/g, "") + "@accounts.local-service-finder.invalid";
    const createdResponse = await fetch(new URL("/auth/v1/admin/users", SUPABASE_URL), {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: internalEmail, password, email_confirm: true,
        user_metadata: { full_name: fullName, username, user_type: userType, phone }
      })
    });
    const created = await createdResponse.json().catch(() => ({}));
    const authUser = created.user || created;
    const userId = authUser?.id;
    if (!createdResponse.ok || !userId) {
      if (createdResponse.status === 422 || createdResponse.status === 409) return response(409, { error: "এই মোবাইল নম্বর দিয়ে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।" });
      return response(503, { error: "অ্যাকাউন্ট তৈরি করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।" });
    }

    const profileResponse = await fetch(new URL("/rest/v1/profiles?on_conflict=id", SUPABASE_URL), {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: userId, full_name: fullName, username, user_type: userType, phone, phone_verified_at: null })
    });
    if (!profileResponse.ok) {
      const profileError = await profileResponse.json().catch(() => ({}));
      await fetch(new URL("/auth/v1/admin/users/" + encodeURIComponent(userId), SUPABASE_URL), { method: "DELETE", headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } });
      if (profileResponse.status === 409 || profileError.code === "23505") {
        return response(409, { error: "এই মোবাইল নম্বরটি আগে থেকেই একটি অ্যাকাউন্টে ব্যবহার করা হয়েছে। লগইন করুন।" });
      }
      return response(503, { error: "প্রোফাইল সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।" });
    }

    const tokenResponse = await fetch(new URL("/auth/v1/token?grant_type=password", SUPABASE_URL), {
      method: "POST", headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: internalEmail, password })
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token || !tokenData.refresh_token) {
      await fetch(new URL("/auth/v1/admin/users/" + encodeURIComponent(userId), SUPABASE_URL), { method: "DELETE", headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } });
      return response(503, { error: "অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু স্বয়ংক্রিয় লগইন চালু হয়নি। লগইন পেজে একই নম্বর ও পাসওয়ার্ড দিন।" });
    }
    return response(200, { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, token_type: tokenData.token_type, expires_in: tokenData.expires_in, user: { id: userId } });
  } catch {
    return response(503, { error: "অ্যাকাউন্ট সেবা সাময়িকভাবে পাওয়া যাচ্ছে না।" });
  }
});