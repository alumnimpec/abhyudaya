import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { club, socials } from "../data/club.js";
import BreadcrumbSchema from "../components/seo/schemas/BreadcrumbSchema.jsx";
import "./Contact.css";
import { submitContactMessage } from "../Firebase/contactService.js";

const SITE_URL = "https://www.abhyudayaclub.in";

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    items.forEach((item) => io.observe(item));
    return () => io.disconnect();
  }, []);
  return ref;
}

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

const ISSUE_OPTIONS = [
  {
    id: "bug",
    label: "Code Bug",
    subtitle: "It worked five minutes ago.",
    reaction: "Have you tried Googling the error, restarting VS Code, and blaming the compiler?",
    subjectPreload: "Bug Report: It worked five minutes ago",
    badge: "DEBUG",
  },
  {
    id: "event",
    label: "Event Idea",
    subtitle: "Hear me out, bro.",
    reaction: "How many volunteers, extension boards, and last-minute poster edits are we talking about?",
    subjectPreload: "Event Idea: Hear me out, bro",
    badge: "PITCH",
  },
  {
    id: "collab",
    label: "Collaboration",
    subtitle: "I bring ideas. And vibes.",
    reaction: "Please confirm that at least one team member will actually push the code.",
    subjectPreload: "Collaboration: I bring ideas. And vibes.",
    badge: "SYNERGY",
  },
  {
    id: "other",
    label: "Other Issue",
    subtitle: "Long story, short deadline.",
    reaction: "Tell us the lore. We'll debug the situation together.",
    subjectPreload: "Other Query: Long story, short deadline",
    badge: "CUSTOM",
  },
];

const FAQ_ITEMS = [
  {
    question: "Can I join if I don't know how to code?",
    answer: "Absolutely. Even the most experienced developer once searched 'how to center a div'. Curiosity matters more than your current skill level.",
  },
  {
    question: "My CGPA is fighting for its life. Can I still join?",
    answer: "Your CGPA doesn't define your personality. Bring your curiosity, teamwork, and willingness to contribute. Any specific academic eligibility rules still apply.",
  },
  {
    question: "How quickly will you reply?",
    answer: "Our target is 24–48 hours. We'd promise 2 milliseconds, but we're a student club, not a production server.",
  },
  {
    question: "Can I suggest an event even if I'm not an admin?",
    answer: "Of course! Great ideas don't require admin privileges. Send us your proposal; the team will review what can be done.",
  },
  {
    question: "What if my idea sounds completely crazy?",
    answer: "Please proceed. Just include enough details for us to tell the difference between an innovative workshop and a plan that requires three all-nighters.",
  },
  {
    question: "Why isn't my code working?",
    answer: "We'd love to help, but our contact form doesn't support mind-reading yet. Send us the error, what you expected, and what actually happened.",
  },
  {
    question: "Can I join just for the snacks?",
    answer: "We cannot guarantee snacks at every event. Checking the event details beforehand is a better strategy than arriving with an empty stomach.",
  },
  {
    question: "What if I submit a message twice?",
    answer: "Congratulations, you've discovered duplicate requests. We'll do our best to avoid duplicate follow-ups, but please give us a little time to respond.",
  },
];

export default function Contact() {
  const gridRef = useReveal();
  const faqRef = useReveal();

  const [formState, setFormState] = useState(INITIAL_FORM);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [activeReaction, setActiveReaction] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState(null);
  const [openFaqIndices, setOpenFaqIndices] = useState(() => new Set());

  const breadcrumbItems = [
    { name: "Home", url: SITE_URL },
    { name: "Contact", url: `${SITE_URL}/contact` },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const validate = () => {
    const newErrors = {};
    const nameTrim = formState.name.trim();
    const emailTrim = formState.email.trim();
    const messageTrim = formState.message.trim();

    if (!nameTrim) {
      newErrors.name = "Who's authoring this commit? Full name is required.";
    } else if (nameTrim.length < 2) {
      newErrors.name = "Name must be at least 2 characters.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailTrim) {
      newErrors.email = "Where should we push replies? Email address is required.";
    } else if (!emailRegex.test(emailTrim)) {
      newErrors.email = "Please enter a valid email address (e.g. name@domain.com).";
    }

    if (formState.phone.trim()) {
      const phoneClean = formState.phone.replace(/[\s\-()]/g, "");
      if (phoneClean.length < 7 || phoneClean.length > 15) {
        newErrors.phone = "Please enter a valid phone number (7-15 digits).";
      }
    }

    if (!messageTrim) {
      newErrors.message = "Error 400: Message missing. Even our AI can't guess what you're thinking.";
    } else if (messageTrim.length < 5) {
      newErrors.message = "Message must be at least 5 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleSelectIssue = (issue) => {
    if (selectedIssue === issue.id) {
      // Toggle off if clicked again
      setSelectedIssue(null);
      setActiveReaction(null);
    } else {
      setSelectedIssue(issue.id);
      setActiveReaction(issue.reaction);
      // Automatically populate subject
      setFormState((prev) => ({
        ...prev,
        subject: issue.subjectPreload,
      }));
    }
  };

  const handleFormSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Prevent duplicate submissions while in progress
    if (submitting) return;

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setSubmittedStatus(null);

    try {
      await submitContactMessage(formState);
      setSubmittedStatus({
        success: true,
        title: "Build successful!",
        message: "Your message has been deployed to our inbox. Let's hope it doesn't get stuck in the spam folder.",
      });
      setFormState(INITIAL_FORM);
      setSelectedIssue(null);
      setActiveReaction(null);
      setErrors({});
    } catch (err) {
      console.error("Error submitting contact message:", err);
      setSubmittedStatus({
        success: false,
        title: "Runtime error: Your message couldn't be delivered.",
        message: err.message || "Your message hasn't gone through. Please try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFaq = (index) => {
    setOpenFaqIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const mapQuery = encodeURIComponent(`${club.institute}, ${club.department}`);

  return (
    <>
      <Helmet>
        <title>Contact Us | Abhyudaya Club — MPEC Kanpur</title>
        <meta
          name="description"
          content="Contact Abhyudaya Club at MPEC Kanpur. Reach out for collaborations, sponsorships, bug reports, event ideas, or to connect with the team."
        />
        <link rel="canonical" href={`${SITE_URL}/contact`} />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />

        <meta property="og:type" content="website" />
        <meta property="og:title" content="Contact Abhyudaya Club | MPEC Kanpur" />
        <meta
          property="og:description"
          content="It works on our machine. Let's see what happens on yours. Reach out to Abhyudaya Club at MPEC Kanpur."
        />
        <meta property="og:url" content={`${SITE_URL}/contact`} />
        <meta property="og:image" content={`${SITE_URL}/abhyudaya-logo.png`} />
        <meta property="og:locale" content="en_IN" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Contact Abhyudaya Club | MPEC Kanpur" />
        <meta
          name="twitter:description"
          content="It works on our machine. Let's see what happens on yours. Reach out to Abhyudaya Club at MPEC Kanpur."
        />
        <meta name="twitter:image" content={`${SITE_URL}/abhyudaya-logo.png`} />

        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <BreadcrumbSchema items={breadcrumbItems} />

      {/* Redesigned Hero Section */}
      <header className="page-hero contact-hero" aria-label="Contact Module Hero">
        <div className="wrap contact-hero__wrap">
          <div className="contact-hero__content">
            <div className="contact-hero__badge" role="doc-subtitle">
              <span className="contact-hero__badge-pulse" aria-hidden="true" />
              <span className="contact-hero__badge-text">ABHYUDAYA.EXE / CONTACT MODULE</span>
            </div>

            <h1 className="contact-hero__title">
              It works on our machine.
              <span className="contact-hero__subtitle">{"Let's see what happens on yours."}</span>
            </h1>

            <p className="contact-hero__lede">
              {"Got an idea, spotted a bug, want to organize an event, or just have something to say? Don't leave us on read before we've even met."}
            </p>

            {/* Terminal Interface Console */}
            <div className="contact-terminal" aria-label="Terminal output greeting">
              <div className="contact-terminal__bar">
                <div className="terminal-dots" aria-hidden="true">
                  <span className="terminal-dot terminal-dot--red" />
                  <span className="terminal-dot terminal-dot--yellow" />
                  <span className="terminal-dot terminal-dot--green" />
                </div>
                <span className="contact-terminal__title">bash ~ contact-session</span>
              </div>
              <div className="contact-terminal__body">
                <div className="terminal-line terminal-line--cmd">
                  <span className="terminal-prompt">root@abhyudaya:~$</span>
                  <span className="terminal-exec">./start_conversation.sh</span>
                </div>
                <div className="terminal-line terminal-line--output">
                  <span className="terminal-out-arrow" aria-hidden="true">↳</span>
                  <span className="terminal-out-msg">Human connection initialized. No semicolons required.</span>
                  <span className="terminal-cursor" aria-hidden="true">_</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="page-hero__horizon" />
      </header>

      {/* Main Content Grid */}
      <section className="section contact-section">
        <div className="wrap contact-grid" ref={gridRef}>
          {/* Left Column: Campus Node & Channels */}
          <aside className="contact-info">
            {/* Campus Location & Map Card */}
            <div className="contact-info__block contact-location-card reveal">
              <div className="contact-location-info">
                <p className="eyebrow contact-eyebrow">📍 Physical Server Location</p>
                <h2 className="contact-location-title">{club.institute}</h2>
                <p className="contact-info__text">{club.department}</p>
              </div>

              {/* Map */}
              <div className="contact-map">
                <iframe
                  title="Club location map"
                  className="contact-map__frame"
                  src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

            {/* Direct Inquiries & Social Channels Card */}
            <div className="contact-info__block contact-channels-card reveal">
              <div className="contact-channel-item">
                <p className="eyebrow contact-eyebrow">📧 Direct Email Channel</p>
                <a
                  href={`mailto:${socials.email}`}
                  className="contact-info__email"
                  aria-label={`Send email to ${socials.email}`}
                >
                  {socials.email}
                </a>
                <span className="contact-response-badge">Avg. response ping: 24–48 hours</span>
              </div>

              <div className="contact-channel-divider" />

              <div className="contact-channel-item">
                <p className="eyebrow contact-eyebrow">🌐 Social Endpoints</p>
                <div className="contact-info__socials">
                  <a
                    href={socials.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-pill social-pill--instagram"
                  >
                    Instagram
                  </a>
                  <a
                    href={socials.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-pill social-pill--linkedin"
                  >
                    LinkedIn
                  </a>
                  {socials.twitter && (
                    <a
                      href={socials.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-pill"
                    >
                      Twitter / X
                    </a>
                  )}
                  {socials.whatsapp && (
                    <a
                      href={socials.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-pill"
                    >
                      WhatsApp
                    </a>
                  )}
                  {socials.youtube && (
                    <a
                      href={socials.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-pill"
                    >
                      YouTube
                    </a>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Right Column: CSE Contact Inquiry Form Card */}
          <main className="join-card contact-form-card reveal">
            <div className="contact-card-header">
              <div className="inbox-status-badge">
                <span className="inbox-status-dot" aria-hidden="true" />
                <span className="inbox-status-text">INBOX STATUS: AWAITING YOUR LORE</span>
              </div>
              <h2 className="contact-card-title">Transmit Telemetry</h2>
              <p className="contact-card-sub">
                Select an issue archetype below or jump straight into the form. All inputs are sanitized, respected, and checked by human developers.
              </p>
            </div>

            {/* Interactive Issue Selector */}
            <div className="issue-selector-wrapper" role="radiogroup" aria-label="Select inquiry category">
              <span className="issue-selector-label">SELECT ISSUE ARCHETYPE:</span>
              <div className="issue-selector-grid">
                {ISSUE_OPTIONS.map((item) => {
                  const isSelected = selectedIssue === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`issue-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectIssue(item)}
                    >
                      <div className="issue-card__top">
                        <span className="issue-card__badge">{item.badge}</span>
                        <span className="issue-card__indicator" aria-hidden="true">
                          {isSelected ? "●" : "○"}
                        </span>
                      </div>
                      <strong className="issue-card__title">{item.label}</strong>
                      <span className="issue-card__subtitle">{item.subtitle}</span>
                    </button>
                  );
                })}
              </div>

              {activeReaction && (
                <div className="issue-reaction-box" role="status" aria-live="polite">
                  <span className="reaction-prefix">{"// Debug Advice:"}</span>
                  <p className="reaction-text">{activeReaction}</p>
                </div>
              )}
            </div>

            {/* Submission Alerts */}
            {submittedStatus && (
              <div
                className={`contact-alert ${
                  submittedStatus.success ? "contact-alert--success" : "contact-alert--error"
                }`}
                role="alert"
              >
                <div className="contact-alert__icon" aria-hidden="true">
                  {submittedStatus.success ? "✓" : "⚠"}
                </div>
                <div className="contact-alert__content">
                  <strong className="contact-alert__title">{submittedStatus.title}</strong>
                  <p>{submittedStatus.message}</p>
                  {!submittedStatus.success && (
                    <button
                      type="button"
                      onClick={handleFormSubmit}
                      className="contact-retry-btn"
                    >
                      Retry git push ↺
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Contact Form */}
            <form onSubmit={handleFormSubmit} className="contact-form" noValidate>
              <div className="form-group form-group--name">
                <label htmlFor="contact-name" className="form-label">
                  <span>{"Who's behind this commit?"}</span>
                  <span className="req" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  value={formState.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Linus Torvalds or Anurag Verma"
                  className={`contact-input ${errors.name ? "has-error" : ""}`}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  disabled={submitting}
                  required
                />
                {errors.name && (
                  <span id="name-error" className="field-error" role="alert">
                    {errors.name}
                  </span>
                )}
              </div>

              <div className="form-group form-group--email">
                <label htmlFor="contact-email" className="form-label">
                  <span>Where can we push our reply?</span>
                  <span className="req" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  value={formState.email}
                  onChange={handleInputChange}
                  placeholder="e.g. dev@domain.com"
                  className={`contact-input ${errors.email ? "has-error" : ""}`}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  disabled={submitting}
                  required
                />
                {errors.email && (
                  <span id="email-error" className="field-error" role="alert">
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="form-group form-group--phone">
                <label htmlFor="contact-phone" className="form-label">
                  <span>Emergency contact (optional, no viva calls)</span>
                  <span className="opt">Optional</span>
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  name="phone"
                  value={formState.phone}
                  onChange={handleInputChange}
                  placeholder="e.g. +91 98765 43210"
                  className={`contact-input ${errors.phone ? "has-error" : ""}`}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  disabled={submitting}
                />
                {errors.phone && (
                  <span id="phone-error" className="field-error" role="alert">
                    {errors.phone}
                  </span>
                )}
              </div>

              <div className="form-group form-group--subject">
                <label htmlFor="contact-subject" className="form-label">
                  <span>{"What's the plot?"}</span>
                  <span className="opt">Optional</span>
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  name="subject"
                  value={formState.subject}
                  onChange={handleInputChange}
                  placeholder="e.g. Event Collaboration, Bug Report, Workshop..."
                  className="contact-input"
                  disabled={submitting}
                />
              </div>

              <div className="form-group form-group--message form-group--full">
                <label htmlFor="contact-message" className="form-label">
                  <span>Drop the lore here...</span>
                  <span className="req" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="contact-message"
                  rows="5"
                  name="message"
                  value={formState.message}
                  onChange={handleInputChange}
                  placeholder="Explain your idea, report the bug, pitch your event, or tell us why your code worked yesterday but not today."
                  className={`contact-input contact-textarea ${errors.message ? "has-error" : ""}`}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "message-error" : undefined}
                  disabled={submitting}
                  required
                />
                {errors.message && (
                  <span id="message-error" className="field-error" role="alert">
                    {errors.message}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="btn btn--solid register-btn contact-submit-btn"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>Compiling your message...</span>
                  </span>
                ) : (
                  <span className="contact-submit-text">
                    <span>git commit -m &quot;reached out&quot;</span>
                    <span className="contact-submit-arrow" aria-hidden="true">
                      →
                    </span>
                  </span>
                )}
              </button>
            </form>

            <div className="contact-card-footer">
              <span className="footer-terminal-char" aria-hidden="true">{"//"}</span>
              <p className="contact-card-footer-note">
                Made with curiosity, caffeine, and at least one unresolved Git conflict.
              </p>
            </div>
          </main>
        </div>
      </section>

      {/* CSE-Themed FAQ Accordion Section */}
      <section className="section faq-section" aria-labelledby="faq-heading">
        <div className="wrap">
          <div className="faq-card" ref={faqRef}>
            <div className="faq-header">
              <span className="faq-badge">KNOWLEDGE_BASE.LOG</span>
              <h2 id="faq-heading" className="faq-title">Frequently Asked Questions</h2>
              <p className="faq-sub">
                Answers to edge cases, CGPA queries, sanity checks, and snack policies.
              </p>
            </div>

            <div className="faq-accordion" role="region" aria-label="FAQ Accordion">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndices.has(idx);
                const buttonId = `faq-btn-${idx}`;
                const panelId = `faq-panel-${idx}`;
                return (
                  <div
                    key={idx}
                    className={`faq-accordion-item${isOpen ? " is-open" : ""}`}
                  >
                    <button
                      type="button"
                      id={buttonId}
                      className="faq-accordion-trigger"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggleFaq(idx)}
                    >
                      <span className="faq-accordion-q">
                        <span className="faq-q-num">Q{idx + 1}.</span>
                        <span className="faq-q-text">{item.question}</span>
                      </span>
                      <span className="faq-accordion-icon" aria-hidden="true">
                        <span className="faq-icon-line faq-icon-line--h" />
                        <span className="faq-icon-line faq-icon-line--v" />
                      </span>
                    </button>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className="faq-accordion-content"
                    >
                      <div className="faq-accordion-inner">
                        <p>{item.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
