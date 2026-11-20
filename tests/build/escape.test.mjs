import assert from "node:assert/strict";
import { test } from "node:test";
import * as escapeModule from "../../site/templates/escape.mjs";

const { esc } = escapeModule;

test("replaces each of & < > \" '", () => {
  assert.equal(esc("&"), "&amp;");
  assert.equal(esc("<"), "&lt;");
  assert.equal(esc(">"), "&gt;");
  assert.equal(esc('"'), "&quot;");
  assert.equal(esc("'"), "&#39;");
});

test("escapes combinations in one pass, ampersand first", () => {
  assert.equal(esc(`<a href="x?a=1&b='2'">`), "&lt;a href=&quot;x?a=1&amp;b=&#39;2&#39;&quot;&gt;");
});

test("treats input as raw text, so existing entities are escaped again", () => {
  assert.equal(esc("&amp;"), "&amp;amp;");
  assert.equal(esc("&lt;b&gt;"), "&amp;lt;b&amp;gt;");
  assert.equal(esc("&#39;"), "&amp;#39;");
});

test("leaves text without special characters unchanged", () => {
  assert.equal(esc("pstack for Codex 0.15.46"), "pstack for Codex 0.15.46");
  assert.equal(esc("日本語のテキスト → OK"), "日本語のテキスト → OK");
  assert.equal(esc(""), "");
});

test("coerces non-string values to strings before escaping", () => {
  assert.equal(esc(110), "110");
  assert.equal(esc(0), "0");
  assert.equal(esc(false), "false");
  assert.equal(esc(null), "null");
  assert.equal(esc(undefined), "undefined");
  assert.equal(esc({ toString: () => "<x>" }), "&lt;x&gt;");
});

test("exports esc only, with no raw-HTML escape hatch", () => {
  assert.deepEqual(Object.keys(escapeModule), ["esc"]);
});
