import { NextResponse } from "next/server";
import { getCurrentProfile } from "../../../../lib/auth";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const actor = await getCurrentProfile();
  if (!actor || actor.status !== "active" || actor.role !== "super_admin") {
    return NextResponse.json({ error: "only_super_admin_can_invite" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_admin_invitation", {
    invite_email: email,
    invite_token: token,
  });

  if (error) {
    const code = error.message.includes("already_active_admin") ? "already_active_admin" : "invitation_failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const url = new URL("/admin-invite", request.url);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return NextResponse.json({ invitation: Array.isArray(data) ? data[0] : data, inviteUrl: url.toString() });
}
