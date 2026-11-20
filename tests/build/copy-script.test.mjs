import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { repoRoot } from "./helpers/build.mjs";

const COPY_JS = path.join(repoRoot, "site/static/copy.js");

test("F4: copy.js is one external file under 1KB", () => {
  assert.ok(fs.statSync(COPY_JS).size < 1024, `${fs.statSync(COPY_JS).size} bytes`);
});

test("F4: copy.js touches no network, storage or dynamic code", () => {
  const source = fs.readFileSync(COPY_JS, "utf8");
  for (const banned of [/fetch\(/, /XMLHttpRequest/, /sendBeacon/, /localStorage|sessionStorage|document\.cookie/, /\beval\(|new Function/, /innerHTML|outerHTML|insertAdjacentHTML/]) {
    assert.doesNotMatch(source, banned);
  }
});
