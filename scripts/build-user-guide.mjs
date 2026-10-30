#!/usr/bin/env node
/*
 * build-user-guide.mjs — generate a self-contained (base64-embedded) HTML
 * client user guide from the screenshots in .claude/documentation/user-guide-assets/.
 *
 * Usage:  node code-web-app/scripts/build-user-guide.mjs
 * Output: .claude/documentation/spazehaus-user-guide.html   (open / print to PDF / share)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");                 // Spazehaus/
const ASSETS = resolve(ROOT, ".claude/documentation/user-guide-assets");
const OUT = resolve(ROOT, ".claude/documentation/spazehaus-user-guide.html");

const img = (file) => {
  const b64 = readFileSync(resolve(ASSETS, file)).toString("base64");
  return `data:image/png;base64,${b64}`;
};

// Each step: title, what it's for, the "where to click" hint, and screenshot(s).
const STEPS = [
  {
    t: "Sign in",
    d: "Open the app link and enter your work email, then tap <b>Send Magic Link</b>. We email you a one-tap sign-in link — no password to remember.",
    where: "Type your email → <b>Send Magic Link</b> → open the email → tap the link.",
    img: ["02-login.png"],
  },
  {
    t: "Your home dashboard",
    d: "After signing in you land on Home. It shows your active projects, what needs attention (Checkpoints), and <b>Quick Actions</b> for the things you do most.",
    where: "Use the left menu — <b>Home · Projects · Company · Calendar · Profile</b> — to move around.",
    img: ["01-home.png"],
  },
  {
    t: "See all projects",
    d: "The Projects page lists every project with its status and progress. Use the tabs (All / Active / Review / Done) or search to find one.",
    where: "Tap the round <b>+</b> button (bottom-right) to start a new project.",
    img: ["03-projects.png"],
  },
  {
    t: "Create a new project",
    d: "The wizard walks you through 4 short steps — client details, property, scope and review. Fill each page and tap <b>Continue</b>.",
    where: "Step 1 is the client. You can also link an existing customer, or pick a <b>Lead Source</b> (how they found you).",
    img: ["05-new-project.png"],
  },
  {
    t: "Open a project",
    d: "A project opens on its Overview. The tab bar underneath is where everything lives: <b>Overview · Lifecycle · Tasks · Quotations · Photos · Team</b>.",
    where: "Tap <b>Cover</b> (top-right of the photo) to change the project's cover image.",
    img: ["06-project-detail.png"],
  },
  {
    t: "Add your team to a project  ⭐",
    d: "Before you can assign tasks, put people on the project. Open the <b>Team</b> tab, then tap <b>Manage Team</b> to set the Lead Designer, Project Manager and members.",
    where: "Project → <b>Team</b> tab → <b>Manage Team</b> button (top of the team list) → tick members → <b>Save Team</b>.",
    img: ["07-team-tab.png", "08-manage-team.png"],
  },
  {
    t: "Add & assign tasks",
    d: "Open the <b>Tasks</b> tab and tap <b>+ Add Task</b>. Give it a title, pick the <b>Assignee</b>, and save. Only people on the project team appear in the assignee list — that's why you add the team first.",
    where: "Project → <b>Tasks</b> tab → <b>+ Add Task</b> → choose <b>Assignee</b> → <b>Add Task</b>.",
    img: ["09-tasks-tab.png", "10-new-task.png"],
  },
  {
    t: "Track payments & documents",
    d: "The <b>Lifecycle</b> tab shows the payment schedule (how much is collected) and the document sign-offs, plus the project's stage timeline.",
    where: "Project → <b>Lifecycle</b> tab.",
    img: ["11-lifecycle.png"],
  },
  {
    t: "Customers & enquiries",
    d: "The Customer Database holds every enquiry and where it sits in your pipeline, with win-rate and pipeline value at the top.",
    where: "Left menu isn't needed — reach it from Home → <b>Customers</b>, or the Projects page.",
    img: ["12-customers.png"],
  },
  {
    t: "Turn an enquiry into a project",
    d: "Open a customer who's ready and tap <b>Convert to Project</b>. It creates the project and marks the enquiry as awarded.",
    where: "Open the customer → scroll down → <b>Convert to Project</b> (admins & project managers only).",
    img: ["13-customer-convert.png"],
  },
  {
    t: "Quotations & invoices",
    d: "Create quotations, proformas and invoices. Once saved, open one to export a branded PDF to send to the client.",
    where: "Quotations page → round <b>+</b> button (bottom-right) → New.",
    img: ["14-quotations.png"],
  },
  {
    t: "Calendar",
    d: "See meetings and site visits by day. You can connect Google Calendar so events sync automatically.",
    where: "Calendar page → <b>+ Event</b> to add, or <b>Sync Google</b> (top-right) to connect.",
    img: ["15-calendar.png"],
  },
  {
    t: "Company & staff",
    d: "The Company hub shows your team at a glance. Open <b>Staff Directory</b> to view everyone, and add a new staff member.",
    where: "Company → <b>Staff Directory</b> → round <b>+</b> button to add someone.",
    img: ["16-company.png", "17-staff.png"],
  },
  {
    t: "The client portal",
    d: "Every project has a private web page for the client — no login needed. It shows progress, payments, document sign-offs and recent photos, all branded as Spazehaus.",
    where: "On a project's Overview, tap <b>Share Client Portal</b> to copy the private link and send it by WhatsApp or email.",
    img: ["18-portal.png"],
  },
  {
    t: "Clients can leave a review",
    d: "At the bottom of the portal, your client can rate their experience and leave a comment. Their review appears back in the project.",
    where: "Client taps the stars → writes a note → <b>Submit Review</b>.",
    img: ["19-portal-review.png"],
  },
  {
    t: "Your profile & settings",
    d: "Your profile shows your details, leave balance and app settings (notifications, light/dark mode). It's also where you <b>Sign Out</b>.",
    where: "Left menu → <b>Profile</b>.",
    img: ["20-profile.png"],
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
    <div class="shots ${s.img.length > 1 ? "two" : "one"}">
      ${s.img.map((f) => `<figure><img loading="lazy" src="${img(f)}" alt="${s.t}"></figure>`).join("")}
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spazehaus App — User Guide</title>
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
  .where{display:flex;gap:8px;align-items:flex-start;margin:0 0 14px;padding:10px 12px;
    background:#faf4ec;border:1px solid #ecdfce;border-radius:10px;font-size:13.5px;color:#574b3b;}
  .pin{flex:none;}
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
    <h1>Management App — User Guide</h1>
    <p>A simple, step-by-step walkthrough of everything the app does.</p>
  </header>
  <div class="lead">
    This guide covers signing in, running projects, adding your team, assigning tasks,
    quotations, the calendar, staff, and the client portal. Each step shows exactly where to tap.
  </div>
  <div class="toc">
    <h3>WHAT'S INSIDE</h3>
    <ol>${STEPS.map((s) => `<li>${s.t.replace(/\s*⭐/, "")}</li>`).join("")}</ol>
  </div>
  <div class="wrap">
    ${STEPS.map(stepHtml).join("")}
    <footer>
      <div class="b">SPAZEHAUS</div>
      <p>Interior Design · Johor Bahru · Management App v1.0</p>
    </footer>
  </div>
</body>
</html>`;

writeFileSync(OUT, html);
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`✓ Wrote ${OUT} (${kb} KB, ${STEPS.length} steps)`);
