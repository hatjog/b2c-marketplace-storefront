import assert from "node:assert/strict"
import test from "node:test"

test("wallet telemetry source defines idempotent pass_saved and PII sanitizer", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/lib/telemetry/wallet.ts", import.meta.url), "utf8")
  )

  assert.match(source, /wallet\.pass_saved/)
  assert.match(source, /wallet_saved_\$\{props\.entitlement_instance_id\}/)
  assert.match(source, /<redacted_email>/)
  assert.match(source, /<redacted_phone>/)
  assert.match(source, /<entitlement_id>/)
})
