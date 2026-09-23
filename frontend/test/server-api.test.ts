import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { bodyText, mutationGuard, pagination, validId } from "../src/lib/server-api";

function request(path = "/api/tasks", init: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(`http://taskflow.test${path}`, init);
}

test("mutation guard accepts only the workspace origin", async () => {
  const accepted = request("/api/tasks", {
    method: "POST",
    headers: { host: "taskflow.test", origin: "http://taskflow.test", "sec-fetch-site": "same-origin" },
  });
  assert.equal(mutationGuard(accepted), undefined);

  for (const headers of [
    new Headers({ host: "taskflow.test", "sec-fetch-site": "same-origin" }),
    new Headers({ host: "taskflow.test", origin: "http://attacker.test", "sec-fetch-site": "cross-site" }),
  ]) {
    const response = mutationGuard(request("/api/tasks", { method: "POST", headers }));
    assert.equal(response?.status, 403);
    assert.deepEqual(await response?.json(), {
      error: "This request must come from your TaskFlow workspace.",
    });
  }
});

test("bodyText accepts valid JSON and rejects unsafe bodies", async () => {
  const valid = request("/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ title: "Ship safely" }),
  });
  assert.equal(await bodyText(valid), '{"title":"Ship safely"}');

  await assert.rejects(
    bodyText(request("/api/tasks", { method: "POST", body: "plain text" })),
    /Expected a JSON request/,
  );
  await assert.rejects(
    bodyText(request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "65537" },
      body: "{}",
    })),
    /too large/,
  );
  await assert.rejects(
    bodyText(request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid",
    })),
    SyntaxError,
  );
});

test("pagination forwards only supported query parameters", () => {
  assert.equal(pagination(request("/api/tasks?limit=20&offset=40&admin=true")), "limit=20&offset=40");
});

test("validId accepts UUIDs without weakening their shape", () => {
  assert.equal(validId("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(validId("123e4567-e89b-12d3-a456"), false);
  assert.equal(validId("../../admin"), false);
});
