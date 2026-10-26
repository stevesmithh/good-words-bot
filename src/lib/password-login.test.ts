import { test } from "node:test";
import { strict as assert } from "node:assert";
import { passwordLoginUsername } from "./password-login";

test("password-only login selects the sole existing account without a supplied username", () => {
  assert.equal(passwordLoginUsername([{ username: "marketing" }]), "marketing");
});

test("password-only login cannot select an account when multiple accounts exist", () => {
  assert.equal(passwordLoginUsername([{ username: "marketing" }, { username: "other" }]), null);
  assert.equal(passwordLoginUsername([]), null);
});