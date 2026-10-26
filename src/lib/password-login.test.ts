import { expect, test } from "bun:test";
import { passwordLoginUsername } from "./password-login";

test("password-only login selects the sole existing account without a supplied username", () => {
  expect(passwordLoginUsername([{ username: "marketing" }])).toBe("marketing");
});

test("password-only login cannot select an account when multiple accounts exist", () => {
  expect(passwordLoginUsername([{ username: "marketing" }, { username: "other" }])).toBeNull();
  expect(passwordLoginUsername([])).toBeNull();
});