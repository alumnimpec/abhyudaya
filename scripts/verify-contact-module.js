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
  jsxContent.includes("Big idea, random doubt, or just bored?"),
  "Hero primary heading missing: 'Big idea, random doubt, or just bored?'"
);
assert.ok(
  jsxContent.includes("We're here."),
  "Hero secondary heading missing: 'We're here.'"
);
assert.ok(
  jsxContent.includes("Got a science question, a story to tell, an event idea, spotted a bug on our website, or just want to talk? Don't overthink it. Drop us a message — no formal speech required."),
  "Hero supporting copy missing"
);
assert.ok(
  jsxContent.includes("ABHYUDAYA.EXE / CONTACT MODULE"),
  "Terminal eyebrow badge missing: 'ABHYUDAYA.EXE / CONTACT MODULE'"
);
assert.ok(
  jsxContent.includes("./say_hello.sh"),
  "Terminal command missing: './say_hello.sh'"
);
assert.ok(
  jsxContent.includes("Oh hey, you made it! 👋"),
  "Terminal greeting message missing: 'Oh hey, you made it! 👋'"
);
assert.ok(
  jsxContent.includes("What's the scene? We're listening."),
  "Terminal prompt message missing: 'What\\'s the scene? We\\'re listening.'"
);

console.log("✅ Hero section copy and terminal elements verified");

// 2. Issue selector cards
const issueChecks = [
  { label: "Code Bug", subtitle: "Something's broken on the website.", reaction: "Have you tried Googling the error, restarting VS Code, and blaming the compiler?" },
  { label: "Event Idea", subtitle: "I've got an idea. Hear me out.", reaction: "How many volunteers, extension boards, and last-minute poster edits are we talking about?" },
  { label: "Collaboration", subtitle: "Let's make something happen.", reaction: "Please confirm that at least one team member will actually push the code." },
  { label: "Other Issue", subtitle: "It's a bit of a long story.", reaction: "Tell us the lore. We'll debug the situation together." },
];

for (const issue of issueChecks) {
  assert.ok(jsxContent.includes(issue.label), `Issue label missing: ${issue.label}`);
  assert.ok(jsxContent.includes(issue.subtitle), `Issue subtitle missing: ${issue.subtitle}`);
  assert.ok(jsxContent.includes(issue.reaction), `Issue reaction missing: ${issue.reaction}`);
}

console.log("✅ All 4 Issue selector cards, subtitles, and reactions verified");

// 3. Form fields and placeholders
assert.ok(
  jsxContent.includes("Your name"),
  "Full Name label missing: Your name"
);
assert.ok(
  jsxContent.includes("Email address"),
  "Email Address label missing: Email address"
);
assert.ok(
  jsxContent.includes("Phone number (optional)"),
  "Phone label missing: Phone number (optional)"
);
assert.ok(
  jsxContent.includes("Subject"),
  "Subject label missing: Subject"
);
assert.ok(
  jsxContent.includes("Your message"),
  "Message label missing: Your message"
);
assert.ok(
  jsxContent.includes('`git commit -m "${formState.subject || ""}"`'),
  "Submit button dynamic git commit template missing"
);

console.log("✅ All form labels, placeholders, and submit button verified");

// 4. Submission states & Microcopy
assert.ok(
  jsxContent.includes("Sending your message..."),
  "Loading message missing: Sending your message..."
);
assert.ok(
  jsxContent.includes("Message sent!"),
  "Success title missing: Message sent!"
);
assert.ok(
  jsxContent.includes("Thanks for reaching out! We've received your note and will get back to you soon."),
  "Success message text missing"
);
assert.ok(
  jsxContent.includes("Message couldn't be sent"),
  "Failure error title missing"
);
assert.ok(
  jsxContent.includes("Try again"),
  "Retry action button missing"
);
assert.ok(
  jsxContent.includes("What's on your mind?"),
  "Card title missing: What's on your mind?"
);
assert.ok(
  jsxContent.includes("Pick a topic or skip straight to the form. Science, literature, events, website bugs — it's all welcome."),
  "Card subtext missing"
);

console.log("✅ Submission states, retry action, and card headers verified");

// 5. FAQ Questions and Answers
const faqChecks = [
  {
    q: "Do I need technical skills to join Abhyudaya?",
    a: "Not really. We need people who can code, design, manage events, handle PR, and occasionally reply to messages. Being useful comes in many forms.",
  },
  {
    q: "My CGPA is fighting for its life. Can I still join?",
    a: "Yes. Abhyudaya is a club, not a supplementary exam. Just learn to manage your time before your deadlines start managing you.",
  },
  {
    q: "How quickly will you reply?",
    a: "Usually within 24–48 hours. Unless assignments and attendance decide otherwise.",
  },
  {
    q: "Can I suggest an event even if I'm not an admin?",
    a: "Of course. You don't need admin access to have ideas. Getting everyone to agree on them is the actual boss level.",
  },
  {
    q: "What if my idea sounds completely crazy?",
    a: "Pitch it. We've heard worse ideas in group projects. Just bring something more convincing than “bro, trust me.”",
  },
  {
    q: "Can I contribute if I have no experience?",
    a: "Yes. Experience comes with doing things. Confidence without contribution is just a LinkedIn headline.",
  },
  {
    q: "Can I join just for the snacks?",
    a: "We respect the honesty. But this is a Science & Literary Club, not a food court. Snacks are a possibility, not a placement guarantee.",
  },
  {
    q: "What if I submit a message twice?",
    a: "We'll probably receive it twice. Give us time to reply before turning one enquiry into a follow-up campaign.",
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
