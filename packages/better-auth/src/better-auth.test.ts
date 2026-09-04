import { test } from "node:test";
import assert from "node:assert/strict";
import { emailValidator } from "./index.js";

test("adapter exposes Better Auth before hooks for email endpoints", () => {
  const plugin = emailValidator({ disposable: ["tempmail.com"] });
  const beforeHook = plugin.hooks.before[0];

  assert.equal(plugin.id, "email-validator");
  assert.equal(beforeHook.matcher({ path: "/sign-up/email" } as never), true);
  assert.equal(beforeHook.matcher({ path: "/sign-in/email" } as never), true);
  assert.equal(beforeHook.matcher({ path: "/get-session" } as never), false);
});
