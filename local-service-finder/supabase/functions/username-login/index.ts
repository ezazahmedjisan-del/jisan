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
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;
function limited(ip: string): boolean {
  const now = Date.now(); const item = attempts.get(ip);
  if (!item || item.resetAt <= now) { attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  item.count += 1; return item.count > MAX_ATTEMPTS;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response(405, { error: "Method not allowed." });
  const origin = req.headers.get("origin");
  if (origin && origin !== SITE_ORIGIN && !origin.startsWith("http://localhost:")) return response(403, { error: "Origin not allowed." });
  if (!SUPABASE_URL || !SERVICE_KEY || !PUBLIC_KEY) return response(503, { error: "Login service is not configured." });
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 80);
  if (limited(ip)) return response(429, { error: "Too many login attempts. Please try again later." });

  let input: { username?: unknown; password?: unknown };
  try { input = await req.json(); } catch { return response(400, { error: "Enter your username, phone, or email and password." }); }
  const identifier = String(input.username || "").trim().toLowerCase();
  const password = String(input.password || "");
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isUsername = /^[a-z0-9_]{4,20}$/.test(identifier);
  const isPhone = /^\+8801[3-9][0-9]{8}$/.test(identifier);
  if ((!isEmail && !isUsername && !isPhone) || password.length < 1 || password.length > 256) {
    return response(401, { error: "Username/email/phone or password is incorrect." });
  }

  try {
    let email = isEmail ? identifier : null;
    let userId: string | null = null;

    if (isUsername || isPhone) {
      const profileUrl = new URL("/rest/v1/profiles", SUPABASE_URL);
      profileUrl.searchParams.set("select", "id");
      profileUrl.searchParams.set(isPhone ? "phone" : "username", "eq." + identifier);
      profileUrl.searchParams.set("limit", "1");
      const profileResponse = await fetch(profileUrl, {
        headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY }
      });
      if (!profileResponse.ok) return response(503, { error: "Login service is temporarily unavailable." });
      const rows = await profileResponse.json();
      userId = Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : null;
      if (!userId) return response(401, { error: "Username/email/phone or password is incorrect." });

      const userResponse = await fetch(new URL("/auth/v1/admin/users/" + encodeURIComponent(userId), SUPABASE_URL), {
        headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY }
      });
      if (!userResponse.ok) return response(401, { error: "Username/email/phone or password is incorrect." });
      const authUser = await userResponse.json();
      email = authUser?.email || authUser?.user?.email || null;
      if (!email) return response(401, { error: "Username/email/phone or password is incorrect." });
    }

    const tokenResponse = await fetch(new URL("/auth/v1/token?grant_type=password", SUPABASE_URL), {
      method: "POST", headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      if (tokenResponse.status === 429) return response(429, { error: "Too many login attempts. Please wait and try again." });
      return response(401, { error: "Username/phone/email or password is incorrect." });
    }
    const authenticatedId = tokenData?.user?.id || userId;
    if (!authenticatedId || !tokenData.access_token || !tokenData.refresh_token) return response(503, { error: "Login service returned an incomplete session. Please try again." });
    return response(200, {
      access_token: tokenData.access_token, refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type, expires_in: tokenData.expires_in, user: { id: authenticatedId }
    });
  } catch {
    return response(503, { error: "Login service is temporarily unavailable." });
  }
});