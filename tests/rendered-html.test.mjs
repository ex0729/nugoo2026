import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the public landing and role selection", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /수업 요청부터/);
  assert.match(html, /운영센터와 강사를 하나로 연결/);
  assert.match(html, /무료로 시작하기/);

  const start = await render("/start");
  assert.equal(start.status, 200);
  const startHtml = await start.text();
  assert.match(startHtml, /운영센터 로그인/);
  assert.match(startHtml, /강사 로그인/);

  const [landingSource, startSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/start/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(landingSource, /HardNavigationLink className="landing-primary" href=\{portal\.href\}/);
  assert.match(startSource, /HardNavigationLink className="portal-option operations" href="\/login"/);
  const hardNavigation = await readFile(new URL("../components/HardNavigationLink.tsx", import.meta.url), "utf8");
  assert.match(hardNavigation, /window\.location\.assign\(href\)/);
});

test("protects the operations dashboard behind authentication", async () => {
  const response = await render("/operations");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/login");
});

test("server-renders the ClassFlow administrator login", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /클래스플로우/);
  assert.match(html, /운영센터 로그인/);
  assert.match(html, /비밀번호/);
  assert.match(html, />로그인</);
  assert.doesNotMatch(html, /로그인 링크 받기/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("server-renders the instructor login", async () => {
  const response = await render("/instructor/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /강사 로그인/);
  assert.match(html, /아직 강사 계정이 없으신가요/);
});

test("server-renders the instructor signup", async () => {
  const response = await render("/instructor/signup");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /강사 회원가입/);
  assert.match(html, /강사로 가입하기/);
  assert.match(html, /개인정보 수집/);
});

test("routes approved instructors into a protected dashboard", async () => {
  const [entry, dashboard, dashboardClient, signout] = await Promise.all([
    readFile(new URL("../app/instructor/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/instructor/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/instructor/dashboard/InstructorDashboardClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/signout/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(entry, /profile\.status === "active"\) redirect\("\/instructor\/dashboard"\)/);
  assert.match(dashboard, /profile\.status !== "active"\) redirect\("\/instructor"\)/);
  assert.match(dashboardClient, /새 수업 요청/);
  assert.match(dashboardClient, /api\/instructor\/requests/);
  assert.match(signout, /requestedNext === "\/instructor\/login"/);
});

test("shows real Supabase instructor members without the demo instructor directory", async () => {
  const app = await readFile(new URL("../app/ClassFlowApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /const instructors = \[/);
  assert.match(app, /fetch\("\/api\/admin\/members", \{ cache: "no-store" \}\)/);
  assert.match(app, /data\.members\.filter\(member => member\.role === "instructor"\)/);
  assert.match(app, /실제 가입 강사 정보를 불러오는 중입니다/);
});

test("protects administrator settings and ships its management workflows", async () => {
  const response = await render("/settings");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/login");
  const [settings, inviteApi, migration] = await Promise.all([
    readFile(new URL("../app/settings/SettingsClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/invitations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608090001_admin_settings.sql", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /관리자 관리/);
  assert.match(settings, /보안·활동 기록/);
  assert.match(settings, /다른 기기에서 로그아웃/);
  assert.match(inviteApi, /create_admin_invitation/);
  assert.match(migration, /current_admin_sessions/);
  assert.match(migration, /only_super_admin_can_manage_admins/);
});

test("persists newly registered classes and uses a reliable settings navigation", async () => {
  const [app, api, migration] = await Promise.all([
    readFile(new URL("../app/ClassFlowApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/classes/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608100001_persist_classes.sql", import.meta.url), "utf8"),
  ]);
  assert.match(app, /<a className="settings" href="\/settings">/);
  assert.match(app, /top-settings-button" href="\/settings">설정/);
  assert.match(app, /fetch\("\/api\/admin\/classes"/);
  assert.match(app, /onCreated\(result\.class\)/);
  assert.match(api, /\.from\("classes"\)\.insert/);
  assert.match(migration, /alter table public\.classes enable row level security/);
  assert.match(migration, /classes_insert_active_admin/);
});

test("connects each persisted class to recruitment, responses, and final assignment", async () => {
  const [app, classApi, recruitmentApi, assignmentApi, migration] = await Promise.all([
    readFile(new URL("../app/ClassFlowApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/classes/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/classes/[id]/recruitment/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/classes/[id]/assignments/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260812025334_class_assignment_workflow.sql", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(app, /storedClasses\.map\(storedClassToListItem\).*demoClasses/);
  assert.match(app, /수업 운영 콘솔/);
  assert.match(app, /openClass\(item/);
  assert.match(classApi, /loadClassOperations/);
  assert.match(recruitmentApi, /set_class_recruitment/);
  assert.match(assignmentApi, /finalize_class_assignment/);
  assert.match(migration, /class_recruitment_targets/);
  assert.match(migration, /class_recruitment_responses/);
  assert.match(migration, /class_assignments/);
});

test("stores internal notifications and supports web push reminders", async () => {
  const [app, dashboard, reminderApi, notificationApi, pushApi, serviceWorker, migration] = await Promise.all([
    readFile(new URL("../app/ClassFlowApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/instructor/dashboard/InstructorDashboardClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/classes/[id]/reminders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/subscriptions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260812090000_notification_channels.sql", import.meta.url), "utf8"),
  ]);
  assert.match(app, /실시간 응답 현황/);
  assert.match(app, /카카오톡으로 공유/);
  assert.match(reminderApi, /create_class_reminders/);
  assert.match(notificationApi, /internal_notifications/);
  assert.match(pushApi, /web_push_subscriptions/);
  assert.match(dashboard, /무료 웹 푸시 켜기/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /pending_target_required/);
});

test("ships project metadata and a bespoke social card", async () => {
  const [layout, page, operations, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operations/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /수업 요청부터 배정까지/);
  assert.match(layout, /\/og\.png/);
  assert.match(page, /landing-hero/);
  assert.match(page, /운영센터로 이동/);
  assert.match(operations, /ClassFlowApp/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
