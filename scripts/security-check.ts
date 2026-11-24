import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getLastDiagnostics,
  resetDiagnosticsForTests,
  runWithDiagnostics,
  setLastEndpoint,
  setLastError,
  setLastStatus,
} from "../src/diagnostics/index.ts";
import {
  assertSafeApiBaseUrl,
  escapeHtml,
  escapeRegExp,
  maskEmail,
  redactSecrets,
  resolveCallbackHost,
} from "../src/utils/index.ts";

assert.equal(maskEmail("user@example.com"), "u***r@example.com");
assert.equal(maskEmail("ab@example.com"), "a***@example.com");
assert.equal(maskEmail("invalid-email"), "[redacted-email]");
assert.equal(maskEmail(undefined), undefined);

assert.equal(resolveCallbackHost("127.0.0.1"), "127.0.0.1");
assert.equal(resolveCallbackHost("localhost"), "127.0.0.1");
assert.equal(resolveCallbackHost("::1"), "::1");
assert.throws(() => resolveCallbackHost("0.0.0.0"), /loopback/i);
assert.throws(() => resolveCallbackHost("192.168.1.1"), /loopback/i);

assert.equal(
  assertSafeApiBaseUrl("https://cloudcode-pa.googleapis.com/"),
  "https://cloudcode-pa.googleapis.com",
);
assert.throws(() => assertSafeApiBaseUrl("http://cloudcode-pa.googleapis.com"), /https/i);
assert.throws(() => assertSafeApiBaseUrl("https://evil.example.com"), /not allowed/i);
assert.throws(
  () => assertSafeApiBaseUrl("https://user:pass@cloudcode-pa.googleapis.com"),
  /credentials/i,
);
assert.throws(() => assertSafeApiBaseUrl("https://aiplatform.googleapis.com"), /Vertex AI/);
assert.throws(() => assertSafeApiBaseUrl("https://us-central1-aiplatform.googleapis.com"), /Vertex AI/);
assert.throws(() => assertSafeApiBaseUrl("https://AIPlatform.googleapis.com/v1"), /Vertex AI/);

// Enterprise usage must stay on the Gemini Enterprise license pool; see CLAUDE.md.
const VERTEX_AI_CALL_PATTERNS = [
  /https:\/\/[^"'`\s]*aiplatform\.googleapis\.com/i,
  /publishers\/google\/models/i,
];
const srcDir = join(import.meta.dirname, "..", "src");
for (const file of readdirSync(srcDir, { recursive: true, encoding: "utf8" })) {
  if (!file.endsWith(".ts")) continue;
  const source = readFileSync(join(srcDir, file), "utf8");
  for (const pattern of VERTEX_AI_CALL_PATTERNS) {
    assert.doesNotMatch(source, pattern, `src/${file} must not call Vertex AI (see CLAUDE.md)`);
  }
}

assert.match(escapeHtml(`<script>alert("x")</script>`), /&lt;script&gt;/);
assert.equal(escapeRegExp("a.b*c?"), String.raw`a\.b\*c\?`);

const prefix = "ya29";
const dummyToken = [prefix, "a0AfH6SMC-test"].join(".");
const dummyToken2 = [prefix, "abc"].join(".");
const dummyRefresh = ["1", "abcdefghijklmnopqrstuvwxyz12"].join("/");
const leaked = redactSecrets(
  `Bearer ${dummyToken} token="${dummyToken2}" refresh_token=${dummyRefresh}`,
);
assert.doesNotMatch(leaked, /ya29\./);
assert.doesNotMatch(leaked, /1\/abcdefgh/);
assert.match(leaked, /\[redacted/);

resetDiagnosticsForTests();
await Promise.all([
  runWithDiagnostics(async () => {
    setLastEndpoint("https://a.example");
    setLastStatus(200);
    await new Promise((r) => setTimeout(r, 20));
    setLastError("error-a");
  }),
  runWithDiagnostics(async () => {
    setLastEndpoint("https://b.example");
    setLastStatus(429);
    await new Promise((r) => setTimeout(r, 5));
    setLastError("error-b");
  }),
]);

const last = getLastDiagnostics();
assert.ok(last.endpoint === "https://a.example" || last.endpoint === "https://b.example");
if (last.endpoint === "https://a.example") {
  assert.equal(last.status, 200);
  assert.equal(last.error, "error-a");
} else {
  assert.equal(last.status, 429);
  assert.equal(last.error, "error-b");
}

console.log("security-check: ok");
