#!/usr/bin/env node
/*
 * build-lifecycle2-guide.mjs — self-contained HTML guide for PROJECT LIFECYCLE 2
 * (the two-project Design → Renovation workflow). Screenshots are base64-embedded
 * from .claude/documentation/lifecycle2-guide-assets/ (captured from the local sandbox).
 *
 * Usage:  node code-web-app/scripts/build-lifecycle2-guide.mjs
 * Output: .claude/documentation/spazehaus-lifecycle2-guide.html  (open / print to PDF / share)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../.."); // Spazehaus/
const ASSETS = resolve(ROOT, ".claude/documentation/lifecycle2-guide-assets");
const OUT = resolve(ROOT, ".claude/documentation/spazehaus-lifecycle2-guide.html");

const img = (file) => {
  const b64 = readFileSync(resolve(ASSETS, file)).toString("base64");
  return `data:image/jpeg;base64,${b64}`;
};

// Each step: title, what it's for (d), the "where to tap" hint, screenshot(s),
// and an optional "coming" note for features still in review.
const STEPS = [
  {
    t: "Start a new project",
    d: "Every job begins here. Fill the client's name and contact, and pick a <b>Lead Source</b> — so later you can see whether they came from social media, the website, a walk-in or a referral. You can also link an existing customer.",
    where: "Home → <b>New Project</b> (or Projects → the <b>+</b> button) → Step 1 “Client Details”.",
    img: ["01-new-project-client.jpg"],
  },
  {
    t: "Pick the service type — the big change  ⭐",
    d: "A job is now split by what you're doing. <b>Design</b> opens as ID26 and becomes <b>SD26</b> once the design contract is signed. <b>Renovation</b> becomes <b>SR26</b>. Choose <b>Both</b> when a job has both sides. Project name and <b>Budget</b> are required.",
    where: "Step 2 “Project Details” → <b>Service Type: Design · Renovation · Both</b>.",
    img: ["01b-service-type.jpg"],
  },
  {
    t: "Your project workspace",
    d: "Each project opens on its <b>Overview</b>. The tab bar — Overview · <b>Lifecycle</b> · Tasks · Quotations · Drawings · Photos · Reports · Team — is where everything lives. The <b>Lifecycle</b> tab is the heart of the project.",
    where: "Open a project → tap the <b>Lifecycle</b> tab.",
    img: ["02-project-overview.jpg"],
  },
  {
    t: "The Lifecycle tab at a glance",
    d: "The top shows <b>Payment Collected</b> (how much of the budget is in) and <b>Documents Signed</b>. Below, the whole job runs as stages grouped into phases: <b>INQUIRY → DESIGN → PRE-BUILD → BUILD → CLOSEOUT</b>.",
    where: "Each stage shows a status on the right (Pending / Completed). Tap <b>Set est. date</b> to schedule one.",
    img: ["03-lifecycle-top.jpg"],
  },
  {
    t: "Inquiry → first meet-up → the deposit that starts design",
    d: "Log the inquiry, pick the <b>first meet-up type</b> (Showroom / Zoom / Site / Others), then collect the <b>Proposal Deposit</b> — that is what <b>triggers design work</b>. Track every <b>Design Proposal</b> version with <b>Add version</b>.",
    where: "DESIGN → <b>Proposal Deposit Collected</b>. Design Proposal → <b>Add version</b> (Version 1, Revision 1…).",
    img: ["04-inquiry-design-start.jpg"],
  },
  {
    t: "Design contract → the project becomes SD26",
    d: "At <b>Design Contract Signed</b>, collect the <b>Design Contract Fee</b> (tap <b>Collect</b>) and sign the contract (<b>Sign</b>). This mints the <b>SD26</b> number. <b>Design Progressive Payment</b> lets you bill the design side in instalments — tap <b>Add payment</b>, name each, set its date and amount, attach the invoice. Each instalment has its own <b>Mark as paid</b> button: marking it collected counts that payment once (the Design Contract Fee stays separate) and moves on to the next.",
    where: "DESIGN → <b>Design Contract Signed</b> → <b>Collect</b> + <b>Sign</b>. Progressive payment → <b>Add payment</b> → <b>Mark as paid</b> when collected.",
    img: ["05-design-contract-payment.jpg"],
  },
  {
    t: "Flow-2 extras: commission & storage handbook",
    d: "Two new sign-offs on the design side: the <b>Design Commission Contract</b> (add a column per signatory with <b>Add sign-off</b>) and the optional <b>Storage Handbook From Client</b> (<b>Add document</b>).",
    where: "DESIGN → <b>Design Commission Contract Signed</b> and <b>Storage Handbook From Client</b>.",
    img: ["06-commission-storage.jpg"],
  },
  {
    t: "Pre-build: 3D, quotation, 2D & material board",
    d: "<b>3D Design</b> merges the old 3D drawing + meeting + revisions into one — add each version with <b>Add submission</b>. The <b>Renovation Quotation</b> now has its own multi-revision grid — tap <b>Add revision</b> and attach each quote. Then the <b>2D Drawings & Material Board</b> — signing this off <b>kicks off the Renovation side</b>.",
    where: "PRE-BUILD → <b>3D Design — Signed</b> (Add submission) → <b>Renovation Quotation</b> (Add revision) → <b>2D Drawings & Material Board</b> (Add item → Sign).",
    img: ["07-prebuild-3d-2d.jpg"],
  },
  {
    t: "Renovation contract → the project becomes SR26",
    d: "Sign the <b>Renovation Contract</b> (mints <b>SR26</b>), add the <b>Renovation Commission Contract</b> sign-off, and collect the <b>Renovation Deposit (50%)</b> with <b>Collect</b>.",
    where: "<b>Renovation Contract Signed</b> → <b>Renovation Deposit Collected</b> → <b>Collect</b>.",
    img: ["08-renovation-contract-deposit.jpg"],
  },
  {
    t: "Build phase: schedule, approvals, site marking",
    d: "Upload the <b>Site Work Schedule</b> (signed by both the Project Manager and the owner), log <b>CIDB / Authority / Insurance</b> in one step, then <b>Site Marking</b> and <b>Contractor Briefing</b>.",
    where: "BUILD → each stage → <b>Add sign-off</b> / <b>Add submission</b>.",
    img: ["09-build-site-schedule-cidb.jpg"],
  },
  {
    t: "Site inspections, site reports & progressive payment",
    d: "Log each <b>Site Inspection</b> (<b>Add inspection</b>). Post a <b>Site Report</b> before each payment — it appears in the client portal. The <b>Progressive Payment</b> splits the build bill into 2–6 staff-entered instalments (<b>Add payment</b>). Each one has a <b>Mark as paid</b> button — marking it collected counts the payment once and shows the client their <b>next payment due</b> in the portal.",
    where: "BUILD → <b>Site Report</b> and <b>Progressive Payment</b> → <b>Add payment</b> → <b>Mark as paid</b> when collected.",
    img: ["10-site-report-progressive-payment.jpg"],
  },
  {
    t: "Closeout & handover",
    d: "<b>Client Site Inspection</b>, <b>Supplier Delivery & Installation</b>, the <b>Handover Document / As-Built</b> (issued early so the client acknowledges the wiring layout), the <b>Handover Meeting</b>, and the <b>Final Payment</b>.",
    where: "CLOSEOUT → each stage → <b>Collect</b> / <b>Sign</b> / <b>Add document</b>.",
    img: ["11-closeout-handover.jpg"],
  },
  {
    t: "Warranty follow-up & splitting a two-sided job",
    d: "<b>Warranty follow-up</b> replaces the old “defect period” — it holds the <b>6-month</b> and <b>12-month</b> check-ins. Log any <b>Variation Order</b> here. For a job that has both sides, <b>Split into Design + Renovation</b> turns it into the linked two-project pair.",
    where: "Bottom of Lifecycle → <b>Warranty follow-up</b> and <b>Split into Design + Renovation</b>.",
    img: ["12-closeout-warranty-split.jpg"],
  },
  {
    t: "The client portal — what your client sees",
    d: "Every project has a private, <b>read-only</b> web page for the client — no login needed. It shows the project team, contract value and a <b>progress</b> summary by phase (Inquiry → Design → Pre-build → Build → Closeout).",
    where: "Project <b>Overview</b> → <b>Share Client Portal</b> to copy the private link → send by WhatsApp or email.",
    img: ["13-portal-top.jpg"],
  },
  {
    t: "Portal: payments & documents",
    d: "The client sees every <b>payment</b> (collected vs pending) and the <b>documents</b> waiting to be signed — so they always know what's paid and what's next. Nothing for them to fill in.",
    where: "The client just scrolls — the portal updates itself from your project.",
    img: ["14-portal-payments-documents.jpg"],
  },
  {
    t: "Portal: weekly site reports (one-way)",
    d: "Your <b>weekly site report</b> auto-publishes here. The portal is <b>one-way</b> — it keeps the client informed (progress, next payment, what to prepare, e.g. paint colour or fittings); there is no feedback form. They can see who to contact on the team.",
    where: "Nothing to do — posting a Site Report in the project publishes it to the portal automatically.",
    img: ["15-portal-reports-contact.jpg"],
  },
];

const stepHtml = (s, i) => `
  <section class="step">
    <div class="step-head">
      <span class="num">${i + 1}</span>
      <h2>${s.t}</h2>
    </div>
    <p class="desc">${s.d}</p>
    <p class="where"><span class="pin">👉</span> <span><b>Where:</b> ${s.where}</span></p>
    ${s.note ? `<p class="note"><span class="soon">SOON</span> <span>${s.note}</span></p>` : ""}
    <div class="shots ${s.img.length > 1 ? "two" : "one"}">
      ${s.img.map((f) => `<figure><img loading="lazy" src="${img(f)}" alt="${s.t}"></figure>`).join("")}
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spazehaus — Project Lifecycle 2 Guide</title>
<style>
  :root{
    --gold:#b07d4e; --gold-soft:#c89a6b; --ink:#1c1813; --muted:#6b645b;
    --cream:#f4efe8; --card:#ffffff; --line:#e7ded2;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;background:var(--cream);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.55;}
  .wrap{max-width:860px;margin:0 auto;padding:0 20px 64px;}
  header.cover{background:linear-gradient(135deg,#241f18,#3a3025);color:#fff;
    padding:52px 20px 44px;text-align:center;margin-bottom:8px;}
  header.cover .brand{color:var(--gold-soft);letter-spacing:.32em;font-size:12px;font-weight:700;}
  header.cover h1{font-size:30px;margin:12px 0 6px;font-weight:700;}
  header.cover p{color:#d9cfc1;margin:0;font-size:15px;}
  header.cover .tag{display:inline-block;margin-top:14px;padding:5px 14px;border:1px solid #6b5a44;
    border-radius:999px;color:var(--gold-soft);font-size:11px;letter-spacing:.16em;font-weight:700;}
  .lead{max-width:860px;margin:22px auto 10px;padding:0 20px;color:var(--muted);font-size:15px;}
  .toc{max-width:860px;margin:4px auto 26px;padding:16px 20px;background:var(--card);
    border:1px solid var(--line);border-radius:14px;}
  .toc h3{margin:0 0 10px;font-size:12px;letter-spacing:.14em;color:var(--gold);font-weight:700;}
  .toc ol{margin:0;padding-left:20px;columns:2;column-gap:28px;font-size:14px;color:var(--ink);}
  .toc li{margin:3px 0;break-inside:avoid;}
  .step{background:var(--card);border:1px solid var(--line);border-radius:16px;
    padding:22px 22px 20px;margin:16px 0;box-shadow:0 1px 10px rgba(0,0,0,.03);}
  .step-head{display:flex;align-items:center;gap:12px;margin-bottom:6px;}
  .num{flex:none;width:30px;height:30px;border-radius:9px;background:var(--gold);color:#fff;
    display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;}
  h2{font-size:19px;margin:0;font-weight:700;}
  .desc{margin:8px 0 10px;font-size:15px;color:#2d2822;}
  .where{display:flex;gap:8px;align-items:flex-start;margin:0 0 12px;padding:10px 12px;
    background:#faf4ec;border:1px solid #ecdfce;border-radius:10px;font-size:13.5px;color:#574b3b;}
  .pin{flex:none;}
  .note{display:flex;gap:8px;align-items:flex-start;margin:0 0 14px;padding:9px 12px;
    background:#fbf7ef;border:1px dashed #d9c3a1;border-radius:10px;font-size:13px;color:#7a6a52;}
  .soon{flex:none;background:var(--gold);color:#fff;border-radius:6px;padding:2px 7px;
    font-size:10px;font-weight:700;letter-spacing:.08em;}
  .shots{display:grid;gap:12px;}
  .shots.two{grid-template-columns:1fr 1fr;}
  figure{margin:0;}
  img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:10px;
    box-shadow:0 2px 14px rgba(0,0,0,.06);}
  footer{text-align:center;color:var(--muted);font-size:12px;margin-top:34px;}
  footer .b{color:var(--gold);letter-spacing:.28em;font-size:13px;font-weight:700;}
  @media(max-width:620px){
    .shots.two{grid-template-columns:1fr;}
    .toc ol{columns:1;}
    header.cover h1{font-size:24px;}
  }
  @media print{
    body{background:#fff;}
    .step,.toc{box-shadow:none;break-inside:avoid;}
    header.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
</style>
</head>
<body>
  <header class="cover">
    <div class="brand">SPAZEHAUS</div>
    <h1>Project Lifecycle 2 — User Guide</h1>
    <p>The two-project Design → Renovation workflow, step by step.</p>
    <div class="tag">DESIGN (SD26) · RENOVATION (SR26) · CLIENT PORTAL</div>
  </header>
  <div class="lead">
    This guide walks the new project lifecycle: starting a project and choosing its
    <b>service type</b>, running the stages from inquiry through design, pre-build, build
    and handover, collecting payments and signatures along the way, and what your client
    sees in the <b>read-only client portal</b>. Each step shows exactly where to tap.
  </div>
  <div class="toc">
    <h3>WHAT'S INSIDE</h3>
    <ol>${STEPS.map((s) => `<li>${s.t.replace(/\s*⭐/, "")}</li>`).join("")}</ol>
  </div>
  <div class="wrap">
    ${STEPS.map(stepHtml).join("")}
    <footer>
      <div class="b">SPAZEHAUS</div>
      <p>Design &amp; Renovation Workflow · 5 Payment Gates · 6 Document Signatures · Johor Bahru</p>
    </footer>
  </div>
</body>
</html>`;

writeFileSync(OUT, html);
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`✓ Wrote ${OUT} (${kb} KB, ${STEPS.length} steps)`);
