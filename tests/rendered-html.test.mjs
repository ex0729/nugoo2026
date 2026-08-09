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

test("protects the operations dashboard behind authentication", async () => {
  const response = await render();
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
  const [entry, dashboard, signout] = await Promise.all([
    readFile(new URL("../app/instructor/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/instructor/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/signout/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(entry, /profile\.status === "active"\) redirect\("\/instructor\/dashboard"\)/);
  assert.match(dashboard, /profile\.status !== "active"\) redirect\("\/instructor"\)/);
  assert.match(dashboard, /새 수업 요청/);
  assert.match(dashboard, /다가오는 확정 일정/);
  assert.match(signout, /requestedNext === "\/instructor\/login"/);
});

test("ships project metadata and a bespoke social card", async () => {
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /강사 배정 운영 플랫폼/);
  assert.match(layout, /\/og\.png/);
  assert.match(page, /ClassFlowApp/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
