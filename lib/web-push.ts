import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StoredPushSubscription = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

export function isWebPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
}

export async function sendWebPush(subscriptions: StoredPushSubscription[], payload: PushPayload) {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { sent: 0, failed: 0, unavailable: subscriptions.length };

  webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:nugoona2021@naver.com", publicKey, privateKey);
  const results = await Promise.allSettled(subscriptions.map(subscription => webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  }, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: "high", topic: payload.tag?.slice(0, 32) })));
  return {
    sent: results.filter(result => result.status === "fulfilled").length,
    failed: results.filter(result => result.status === "rejected").length,
    unavailable: 0,
  };
}

export async function deliverClassNotifications(
  supabase: SupabaseClient,
  classId: string,
  userIds: string[],
  type: "class_request" | "assignment_confirmed",
) {
  if (!userIds.length) return { sent: 0, failed: 0, unavailable: 0 };
  const [{ data: notificationData }, { data: subscriptionData }] = await Promise.all([
    supabase.from("internal_notifications").select("user_id,title,body,action_url").eq("class_id", classId).eq("type", type).in("user_id", userIds),
    supabase.rpc("get_push_subscriptions_for_users", { target_user_ids: userIds }),
  ]);
  const notifications = (notificationData ?? []) as Array<{ user_id: string; title: string; body: string; action_url: string }>;
  const subscriptions = (subscriptionData ?? []) as StoredPushSubscription[];
  const results = await Promise.all(notifications.map(notification => sendWebPush(
    subscriptions.filter(subscription => subscription.user_id === notification.user_id),
    { title: notification.title, body: notification.body, url: notification.action_url, tag: `${type}-${classId.slice(0, 8)}` },
  )));
  return results.reduce((sum, result) => ({ sent: sum.sent + result.sent, failed: sum.failed + result.failed, unavailable: sum.unavailable + result.unavailable }), { sent: 0, failed: 0, unavailable: 0 });
}
