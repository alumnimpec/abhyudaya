import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contactJsxPath = path.resolve(__dirname, "../src/pages/Contact.jsx");
const contactCssPath = path.resolve(__dirname, "../src/pages/Contact.css");

console.log("🔍 Running verification on Contact module files...");

const jsxContent = fs.readFileSync(contactJsxPath, "utf-8");
const cssContent = fs.readFileSync(contactCssPath, "utf-8");

// 1. Hero copy tests
assert.ok(
  jsxContent.includes("It works on our machine."),
  "Hero primary heading missing: 'It works on our machine.'"
);
assert.ok(
  jsxContent.includes("Let's see what happens on yours."),
  "Hero secondary heading missing: 'Let's see what happens on yours.'"
);
assert.ok(
  jsxContent.includes("Got an idea, spotted a bug, want to organize an event, or just have something to say? Don't leave us on read before we've even met."),
  "Hero supporting copy missing"
);
assert.ok(
  jsxContent.includes("ABHYUDAYA.EXE / CONTACT MODULE"),
  "Terminal eyebrow badge missing: 'ABHYUDAYA.EXE / CONTACT MODULE'"
);
assert.ok(
  jsxContent.includes("./start_conversation.sh"),
  "Terminal command missing: './start_conversation.sh'"
);
assert.ok(
  jsxContent.includes("Human connection initialized. No semicolons required."),
  "Terminal initialization message missing"
);

console.log("✅ Hero section copy and terminal elements verified");

// 2. Issue selector cards
const issueChecks = [
  { label: "Code Bug", subtitle: "It worked five minutes ago.", reaction: "Have you tried Googling the error, restarting VS Code, and blaming the compiler?" },
  { label: "Event Idea", subtitle: "Hear me out, bro.", reaction: "How many volunteers, extension boards, and last-minute poster edits are we talking about?" },
  { label: "Collaboration", subtitle: "I bring ideas. And vibes.", reaction: "Please confirm that at least one team member will actually push the code." },
  { label: "Other Issue", subtitle: "Long story, short deadline.", reaction: "Tell us the lore. We'll debug the situation together." },
];

for (const issue of issueChecks) {
  assert.ok(jsxContent.includes(issue.label), `Issue label missing: ${issue.label}`);
  assert.ok(jsxContent.includes(issue.subtitle), `Issue subtitle missing: ${issue.subtitle}`);
  assert.ok(jsxContent.includes(issue.reaction), `Issue reaction missing: ${issue.reaction}`);
}

console.log("✅ All 4 Issue selector cards, subtitles, and reactions verified");

// 3. Form fields and placeholders
assert.ok(
  jsxContent.includes("Who's behind this commit?"),
  "Full Name label missing: Who's behind this commit?"
);
assert.ok(
  jsxContent.includes("Where can we push our reply?"),
  "Email Address label missing: Where can we push our reply?"
);
assert.ok(
  jsxContent.includes("Emergency contact (optional, no viva calls)"),
  "Phone label missing: Emergency contact (optional, no viva calls)"
);
assert.ok(
  jsxContent.includes("What's the plot?"),
  "Subject label missing: What's the plot?"
);
assert.ok(
  jsxContent.includes("Drop the lore here..."),
  "Message label missing: Drop the lore here..."
);
assert.ok(
  jsxContent.includes("Explain your idea, report the bug, pitch your event, or tell us why your code worked yesterday but not today."),
  "Message placeholder missing"
);
assert.ok(
  jsxContent.includes('git commit -m &quot;reached out&quot;'),
  "Submit button commit text missing"
);

console.log("✅ All form CSE labels, placeholders, and submit button verified");

// 4. Submission states & Microcopy
assert.ok(
  jsxContent.includes("Compiling your message..."),
  "Loading message missing: Compiling your message..."
);
assert.ok(
  jsxContent.includes("Build successful!"),
  "Success title missing: Build successful!"
);
assert.ok(
  jsxContent.includes("Your message has been deployed to our inbox. Let's hope it doesn't get stuck in the spam folder."),
  "Success message text missing"
);
assert.ok(
  jsxContent.includes("Runtime error: Your message couldn't be delivered."),
  "Failure error title missing"
);
assert.ok(
  jsxContent.includes("Your message hasn't gone through. Please try again in a moment."),
  "Failure error message text missing"
);
assert.ok(
  jsxContent.includes("Retry git push"),
  "Retry action button missing"
);
assert.ok(
  jsxContent.includes("INBOX STATUS: AWAITING YOUR LORE"),
  "Status label missing: INBOX STATUS: AWAITING YOUR LORE"
);
assert.ok(
  jsxContent.includes("Made with curiosity, caffeine, and at least one unresolved Git conflict."),
  "Footer note missing: Made with curiosity, caffeine..."
);
assert.ok(
  jsxContent.includes("Error 400: Message missing. Even our AI can't guess what you're thinking."),
  "Validation error text missing: Error 400: Message missing..."
);

console.log("✅ Submission states, retry action, and microcopy verified");

// 5. FAQ Questions and Answers
const faqChecks = [
  {
    q: "Can I join if I don't know how to code?",
    a: "Absolutely. Even the most experienced developer once searched 'how to center a div'. Curiosity matters more than your current skill level.",
  },
  {
    q: "My CGPA is fighting for its life. Can I still join?",
    a: "Your CGPA doesn't define your personality. Bring your curiosity, teamwork, and willingness to contribute. Any specific academic eligibility rules still apply.",
  },
  {
    q: "How quickly will you reply?",
    a: "Our target is 24–48 hours. We'd promise 2 milliseconds, but we're a student club, not a production server.",
  },
  {
    q: "Can I suggest an event even if I'm not an admin?",
    a: "Of course! Great ideas don't require admin privileges. Send us your proposal; the team will review what can be done.",
  },
  {
    q: "What if my idea sounds completely crazy?",
    a: "Please proceed. Just include enough details for us to tell the difference between an innovative workshop and a plan that requires three all-nighters.",
  },
  {
    q: "Why isn't my code working?",
    a: "We'd love to help, but our contact form doesn't support mind-reading yet. Send us the error, what you expected, and what actually happened.",
  },
  {
    q: "Can I join just for the snacks?",
    a: "We cannot guarantee snacks at every event. Checking the event details beforehand is a better strategy than arriving with an empty stomach.",
  },
  {
    q: "What if I submit a message twice?",
    a: "Congratulations, you've discovered duplicate requests. We'll do our best to avoid duplicate follow-ups, but please give us a little time to respond.",
  },
];

for (const faq of faqChecks) {
  assert.ok(jsxContent.includes(faq.q), `FAQ question missing: ${faq.q}`);
  assert.ok(jsxContent.includes(faq.a), `FAQ answer missing: ${faq.a}`);
}

console.log("✅ All 8 CSE FAQ questions and answers verified");

// 6. CSS Styles verification
assert.ok(cssContent.includes(".contact-hero"), "CSS missing .contact-hero");
assert.ok(cssContent.includes(".contact-terminal"), "CSS missing .contact-terminal");
assert.ok(cssContent.includes(".terminal-cursor"), "CSS missing .terminal-cursor animation");
assert.ok(cssContent.includes(".issue-card"), "CSS missing .issue-card");
assert.ok(cssContent.includes(".issue-card.is-selected"), "CSS missing .issue-card.is-selected");
assert.ok(cssContent.includes(".issue-reaction-box"), "CSS missing .issue-reaction-box");
assert.ok(cssContent.includes(".faq-accordion-trigger"), "CSS missing .faq-accordion-trigger");
assert.ok(cssContent.includes(".faq-accordion-content"), "CSS missing .faq-accordion-content");
assert.ok(cssContent.includes("@media (prefers-reduced-motion: reduce)"), "CSS missing reduced-motion accessibility rules");
assert.ok(cssContent.includes("@media (max-width: 768px)"), "CSS missing 768px mobile breakpoint");
assert.ok(cssContent.includes("@media (max-width: 480px)"), "CSS missing 480px small mobile breakpoint");

console.log("✅ CSS tokens, animations, responsive breakpoints, and accessibility verified");

console.log("\n🎉 ALL CONTACT MODULE TESTS PASSED PERFECTLY!");
