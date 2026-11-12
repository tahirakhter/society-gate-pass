import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_REDIRECT, getSafeRedirect } from "../../lib/safe-redirect.ts";

test("keeps same-origin relative paths", () => {
  assert.equal(getSafeRedirect("/passes"), "/passes");
  assert.equal(getSafeRedirect("/admin/users?tab=owners#top"), "/admin/users?tab=owners#top");
});

test("falls back to the dashboard when no redirect is given", () => {
  assert.equal(getSafeRedirect(null), DEFAULT_REDIRECT);
  assert.equal(getSafeRedirect(undefined), DEFAULT_REDIRECT);
  assert.equal(getSafeRedirect(""), DEFAULT_REDIRECT);
});

test("rejects absolute URLs to other sites", () => {
  assert.equal(getSafeRedirect("https://evil.example/fake-login"), DEFAULT_REDIRECT);
  assert.equal(getSafeRedirect("javascript:alert(1)"), DEFAULT_REDIRECT);
});

test("rejects protocol-relative URLs", () => {
  assert.equal(getSafeRedirect("//evil.example"), DEFAULT_REDIRECT);
  assert.equal(getSafeRedirect("/\\evil.example"), DEFAULT_REDIRECT);
});

test("rejects relative paths that do not start at the root", () => {
  assert.equal(getSafeRedirect("dashboard"), DEFAULT_REDIRECT);
});
