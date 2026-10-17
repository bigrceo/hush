import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, csvCell } from "../src/lib/csv.ts";
test("quotes commas, quotes and newlines", () => {
  assert.equal(toCsv(["a", "b"], [["x,y", 'say "hi"'], [1, null]]), 'a,b\r\n"x,y","say ""hi"""\r\n1,\r\n');
});
test("neutralises spreadsheet formulas but keeps negative numbers", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("-0.5"), "-0.5");
  assert.equal(csvCell("@sum"), "'@sum");
});
