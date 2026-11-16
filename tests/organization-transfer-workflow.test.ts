import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Mairie to NIGELEC/NDE central-to-agency workflow", () => {
  const mairieService = readSource("src/pcs/services/mairie.ts");
  const organizationService = readSource("src/pcs/services/organization.ts");
  const organizationPage = readSource("src/pcs/pages/OrganizationDashboard.tsx");
  const migration = readSource(
    "supabase/migrations/20261116140000_central_agency_assignment_workflow.sql",
  );

  it("removes pending and accepted transfers from the mairie work queue", () => {
    expect(mairieService).toContain('.from("report_organization_transfers")');
    expect(mairieService).toContain('.in("status", ["pending", "accepted", "completed"])');
    expect(mairieService).toContain("!transferredIds.has(report.id)");
  });

  it("lets the mairie transmit only to the NIGELEC or NDE central unit", () => {
    expect(migration).toContain("central.unit_type = 'central'");
    expect(migration).toContain("La mairie doit transmettre uniquement à la centrale NIGELEC ou NDE");
    expect(migration).not.toContain("target_unit.unit_type = 'agency'");
  });

  it("lets the central office accept a transfer without creating an agency mission", () => {
    const acceptStart = migration.indexOf("create or replace function public.organization_accept_transfer");
    const assignStart = migration.indexOf("create or replace function public.organization_assign_agency");
    expect(acceptStart).toBeGreaterThanOrEqual(0);
    expect(assignStart).toBeGreaterThan(acceptStart);
    expect(migration.slice(acceptStart, assignStart)).not.toContain("insert into public.report_unit_assignments");
    expect(migration).toContain("La centrale");
  });

  it("lets the central office choose an active agency after acceptance", () => {
    expect(organizationService).toContain("export async function assignOrganizationAgency");
    expect(organizationPage).toContain("Attribuer à cette agence");
    expect(organizationPage).toContain("Choisir une agence locale");
    expect(migration).toContain("create or replace function public.organization_assign_agency");
    expect(migration).toContain("insert into public.report_unit_assignments");
    expect(migration).toContain("organization_unit_id = p_agency_unit_id");
  });

  it("leaves field-agent assignment to the receiving agency", () => {
    expect(organizationService).toContain("agency_assign_report_to_agent");
    expect(organizationPage).toContain("Affecter un agent…");
    expect(organizationPage).toContain("assignAgencyMissionToAgent");
  });

  it("prevents retransmitting pending, accepted, or completed reports", () => {
    expect(migration).toContain("status in ('pending', 'accepted', 'completed')");
  });
});
