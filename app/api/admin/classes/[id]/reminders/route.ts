import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ADMIN_ROLES, getCurrentProfile } from "../../../../../../lib/auth";
import { sendWebPush, type StoredPushSubscription } from "../../../../../../lib/web-push";
import { createClient } from "../../../../../../lib/supabase/server";

type CreatedNotification = { notification_id: string; user_id: string; title: string; body: string; action_url: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !ADMIN_ROLES.includes(profile.role)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { targetIds?: string[]; requestKey?: string } | null;
  const targetIds = [...new Set(body?.targetIds ?? [])];
  if (!targetIds.length || targetIds.length > 100) return NextResponse.json({ error: "invalid_targets" }, { status: 400 });
  const requestKey = /^[0-9a-f-]{36}$/i.test(body?.requestKey ?? "") ? body!.requestKey! : randomUUID();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_class_reminders", { target_class_id: id, target_ids: targetIds, request_key: requestKey });
  if (error) return NextResponse.json({ error: error.message.includes("pending_target_required") ? "pending_target_required" : "reminder_failed" }, { status: 400 });
  const notifications = (data ?? []) as CreatedNotification[];
  if (!notifications.length) return NextResponse.json({ internal: targetIds.length, push: { sent: 0, failed: 0, unavailable: targetIds.length }, duplicate: true });

  const userIds = [...new Set(notifications.map(item => item.user_id))];
  const { data: subscriptionData } = await supabase.rpc("get_push_subscriptions_for_users", { target_user_ids: userIds });
  const subscriptions = (subscriptionData ?? []) as StoredPushSubscription[];
  const notificationByUser = new Map(notifications.map(item => [item.user_id, item]));
  const pushResults = await Promise.all(userIds.map(async userId => {
    const item = notificationByUser.get(userId)!;
    return sendWebPush(subscriptions.filter(subscription => subscription.user_id === userId), {
      title: item.title,
      body: item.body,
      url: item.action_url,
      tag: `reminder-${id.slice(0, 8)}`,
    });
  }));
  return NextResponse.json({
    internal: notifications.length,
    push: pushResults.reduce((sum, result) => ({ sent: sum.sent + result.sent, failed: sum.failed + result.failed, unavailable: sum.unavailable + result.unavailable }), { sent: 0, failed: 0, unavailable: 0 }),
  });
}
