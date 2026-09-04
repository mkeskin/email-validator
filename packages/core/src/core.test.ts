import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, validateEmail } from "./index.js";

test("normalizes a valid email", () => {
  const result = normalizeEmail("  User@Example.COM ");

  assert.deepEqual(result, {
    email: "user@example.com",
    domain: "example.com",
  });
});

test("rejects malformed addresses", async () => {
  const result = await validateEmail("not-an-email");

  assert.equal(result.valid, false);
  if (!result.valid) assert.equal(result.reason, "invalid");
});

test("checks disposable, allowlist, and blocklist domains", async () => {
  const disposable = await validateEmail("a@tempmail.com", { disposable: ["TempMail.com"] });

  assert.equal(disposable.valid, false);
  if (!disposable.valid) assert.equal(disposable.reason, "disposable");

  const notAllowed = await validateEmail("a@example.com", { allowlist: ["acme.test"] });

  assert.equal(notAllowed.valid, false);
  if (!notAllowed.valid) assert.equal(notAllowed.reason, "not-allowed");

  const blocked = await validateEmail("a@blocked.test", { blocklist: ["blocked.test"] });

  assert.equal(blocked.valid, false);
  if (!blocked.valid) assert.equal(blocked.reason, "blocked");

  const blacklisted = await validateEmail("Blocked.User@Example.com", {
    blacklist: ["blocked.user@example.com"],
  });

  assert.equal(blacklisted.valid, false);
  if (!blacklisted.valid) assert.equal(blacklisted.reason, "blacklisted");
});

test("does not run disposable checks without user configuration", async () => {
  const result = await validateEmail("a@tempmail.com");

  assert.equal(result.valid, true);
});

test("supports a dynamic disposable-domain check", async () => {
  const result = await validateEmail("a@temp.example", {
    disposable: async (domain) => domain.startsWith("temp."),
  });

  assert.equal(result.valid, false);
  if (!result.valid) assert.equal(result.reason, "disposable");
});

test("uses an injected MX resolver", async () => {
  const result = await validateEmail("a@example.com", {
    mx: true,
    resolver: async (domain) => domain === "example.com",
  });

  assert.equal(result.valid, true);
});
