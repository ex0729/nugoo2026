import { NextResponse } from "next/server";
import { getCurrentProfile } from "../../../../lib/auth";
import { isWebPushConfigured } from "../../../../lib/web-push";
import { createClient } from "../../../../lib/supabase/server";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { count, error } = await supabase.from("web_push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id);
  if (error) return NextResponse.json({ error: "subscription_unavailable" }, { status: 500 });
  return NextResponse.json({ configured: isWebPushConfigured(), subscribed: Boolean(count) });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys.auth) return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("web_push_subscriptions").upsert({
    user_id: profile.user_id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    user_agent: request.headers.get("user-agent"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "subscription_failed" }, { status: 400 });
  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("web_push_subscriptions").delete().eq("user_id", profile.user_id).eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: "unsubscribe_failed" }, { status: 400 });
  return NextResponse.json({ subscribed: false });
}
