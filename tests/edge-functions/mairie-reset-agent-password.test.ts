import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "supabase/edge-functions-source/mairie-reset-agent-password/index.ts"),
  "utf8",
);

describe("mairie-reset-agent-password authorization", () => {
  it("requires a valid caller session", () => {
    expect(source).toContain('req.headers.get("authorization")');
    expect(source).toContain("admin.auth.getUser(token)");
  });

  it("extracts a Bearer access token without retaining its prefix", () => {
    expect(source).toContain('.replace(/^Bearer\\s+/i, "").trim()');

    const token = "Bearer test-access-token".replace(/^Bearer\\s+/i, "").trim();
    expect(token).toBe("test-access-token");
  });

  it("only accepts an active, approved mairie account", () => {
    expect(source).toContain('.eq("account_user_id", user.id)');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain('.eq("approval_status", "approved")');
  });

  it("scopes the target agent to the authenticated mairie", () => {
    expect(source).toContain('.eq("id", agentId)');
    expect(source).toContain('.eq("mairie_id", mairie.id)');
    expect(source).toContain("admin.auth.admin.updateUserById(agent.user_id, { password })");
  });

  it("does not send SMS or email and enforces a password length limit", () => {
    expect(source).toContain("password.length < 8 || password.length > 128");
    expect(source).not.toMatch(/sendEmail|sendSms|twilio|otp/i);
  });
});
