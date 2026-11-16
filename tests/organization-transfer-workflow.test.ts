import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Mairie to NIGELEC/NDE transfer workflow", () => {
  const mairieService = readSource("src/pcs/services/mairie.ts");
  const organizationService = readSource("src/pcs/services/organization.ts");
  const organizationPage = readSource("src/pcs/pages/OrganizationDashboard.tsx");
  const migration = readSource(
    "supabase/migrations/20261116110000_fix_local_organization_transfer_visibility.sql",
  );

  it("removes pending and accepted transfers from the mairie work queue", () => {
    expect(mairieService).toContain('.from("report_organization_transfers")');
    expect(mairieService).toContain('.in("status", ["pending", "accepted", "completed"])');
    expect(mairieService).toContain("!transferredIds.has(report.id)");
  });

  it("loads the local destination on each organization transfer", () => {
    expect(organizationService).toContain(
      'select("id,report_id,organization_id,organization_unit_id,from_mairie_id,status,transmitted_at,response_note")',
    );
    expect(organizationPage).toContain("t.organization_unit_id");
    expect(organizationPage).toContain("Mission créée automatiquement dans l’unité locale destinataire.");
  });

  it("allows central NIGELEC and NDE managers to see local transfers", () => {
    expect(migration).toContain("ou.unit_id is null");
    expect(migration).toContain("central_unit.unit_type = 'central'");
    expect(migration).toContain("('NIGELEC', 'NDE')");
  });

  it("allows central acceptance and refusal and automatically creates the target unit assignment", () => {
    expect(migration).toContain("v_is_central");
    expect(migration).toContain("v_is_local");
    expect(migration).toContain("create or replace function public.organization_decline_transfer");
    expect(migration).toContain("insert into public.report_unit_assignments");
    expect(migration).toContain("v_transfer.organization_unit_id");
  });

  it("prevents retransmitting pending, accepted, or completed reports", () => {
    expect(migration).toContain("status in ('pending', 'accepted', 'completed')");
  });
});
