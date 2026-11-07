import { ACCOUNTS } from "../support/accounts";

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONAL — Customers CRM against the REAL local backend (Phase 5 model).
//   • A customer holds many opportunities (inquiries); the list is per-customer.
//   • Convert: the convert dialog on an opportunity runs the REAL
//     convert_inquiry_to_project RPC — creates a project, sets Gate ① collected,
//     flips the inquiry to "awarded".
//   • An already-awarded opportunity offers no convert action.
//
// Seed: CUS001 (Wong Family) → INQ001 (showroom-meet, convertible) …
//       CUS004 (Lim Holdings) → INQ004 (awarded → PRJ002).
// After db:reset the convert allocates PRJ003.
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN = ACCOUNTS.admin; // principal → OPS tier (can convert)

describe("Customers (real local backend)", { retries: { runMode: 1, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.task("db:reset");
    cy.loginCached(ADMIN);
  });

  it("lists customers and opens one", () => {
    cy.visit("/customers");
    cy.get("[data-testid=customer-card]").should("have.length.at.least", 5);
    cy.get("[data-customer-id=CUS001]").should("contain", "Wong Family").click();
    cy.location("pathname").should("eq", "/customers/CUS001");
  });

  it("redirects an old inquiry-id link to the owning customer", () => {
    cy.visit("/customers/INQ001");
    cy.location("pathname", { timeout: 10000 }).should("eq", "/customers/CUS001");
  });

  it("converts an opportunity into a real project via the dialog (RPC)", () => {
    cy.task("db:query", "select stage from inquiries where id='INQ001'").should("eq", "showroom-meet");

    cy.visit("/customers/CUS001");
    cy.get("[data-testid=open-convert-dialog]").click();
    // Explicitly pick designer + PM (`.select` retries until the options exist,
    // i.e. staff have loaded) so the form is deterministically valid.
    cy.get("[data-testid=convert-designer]").select("Jamie Tan");
    cy.get("[data-testid=convert-pm]").select("Priya Menon");
    cy.get("[data-testid=convert-submit]").click();

    // Navigates to the freshly-created project's lifecycle.
    cy.location("pathname", { timeout: 15000 }).should("eq", "/projects/PRJ003");

    // REAL DB effects of the RPC.
    cy.task("db:query", "select stage from inquiries where id='INQ001'").should("eq", "awarded");
    cy.task("db:query", "select awarded_project_id from inquiries where id='INQ001'").should("eq", "PRJ003");
    cy.task("db:query", "select count(*) from projects where id='PRJ003'").should("eq", "1");
    cy.task("db:query", "select status from payment_records where project_id='PRJ003' and gate=1")
      .should("eq", "completed"); // Gate ① collected on convert
  });

  it("an already-awarded opportunity offers no convert action", () => {
    cy.visit("/customers/CUS004"); // its only opportunity INQ004 is awarded → PRJ002
    cy.get("[data-testid=open-convert-dialog]").should("not.exist");
  });
});
