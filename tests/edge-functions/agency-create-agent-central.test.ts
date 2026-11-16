import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("central and agency creation of their own field agents", () => {
  const edgeFunction = readSource(
    "supabase/edge-functions-source/agency-create-agent/index.ts",
  );
  const organizationService = readSource("src/pcs/services/organization.ts");
  const organizationPage = readSource("src/pcs/pages/OrganizationDashboard.tsx");

  it("requires an active central or agency administrator or supervisor", () => {
    expect(edgeFunction).toContain('.in("role", ["admin", "supervisor"])');
    expect(edgeFunction).toContain('.in("unit_type", ["central", "agency"])');
    expect(edgeFunction).toContain("responsable d'une centrale ou d'une agence active");
  });

  it("derives the agent's agency from the authenticated membership", () => {
    expect(edgeFunction).toContain("organization_unit_id: membership.unit_id");
    expect(edgeFunction).not.toContain("body.organization_unit_id");
    expect(organizationService).not.toContain("organization_unit_id: string;");
  });

  it("shows agent creation in both central and agency dashboards", () => {
    expect(organizationPage).toContain("Créer un agent terrain de la centrale");
    expect(organizationPage).toContain("Vous créez ici les comptes des agents rattachés à votre agence.");
    expect(organizationPage).toContain("createAgencyAgent({ ...agentForm })");
    expect(organizationPage).not.toContain("organization_unit_id: membership!.unit_id!");
    expect(organizationPage).not.toContain("Agence de rattachement");
  });
});
