import assert from "node:assert/strict";
import test from "node:test";
import { add, multiply } from "./math_ops.js";

test("add", () => {
  assert.equal(add(2, 3), 5);
});

test("multiply", () => {
  assert.equal(multiply(4, 5), 20);
});
