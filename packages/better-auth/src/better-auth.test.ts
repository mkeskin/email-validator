import { test } from "node:test";
import assert from "node:assert/strict";
import { emailGuard } from "./index.js";

test("adapter delegates validation and rejects disposable email", async () => {
  const hook = emailGuard({ disposable: ["tempmail.com"] });
  await assert.rejects(() => hook.before({ email: "a@tempmail.com" }), /disposable/);
  await hook.before({ email: "a@example.com" });
});
