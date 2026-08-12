self.addEventListener("push", event => {
  let payload = { title: "NGN-X 수업 알림", body: "새 알림을 확인해 주세요.", url: "/instructor/dashboard", tag: "ngn-x" };
  try { payload = { ...payload, ...event.data.json() }; } catch { payload = { ...payload }; }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/favicon.svg",
    tag: payload.tag,
    renotify: true,
    data: { url: payload.url },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/instructor/dashboard", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => client.url.startsWith(self.location.origin));
    return existing ? existing.focus().then(() => existing.navigate(target)) : clients.openWindow(target);
  }));
});
