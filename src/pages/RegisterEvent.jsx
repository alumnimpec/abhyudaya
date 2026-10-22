import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  FiCalendar,
  FiMapPin,
  FiVideo,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiCopy,
  FiCheck,
  FiX,
  FiArrowRight,
  FiRefreshCw,
  FiSearch,
  FiStar,
} from "react-icons/fi";
import { getEventsPage } from "../Firebase/eventService.js";
import {
  countRegistrations,
  createRegistration,
} from "../Firebase/registrationService.js";
import EventCountdown from "../components/EventCountdown.jsx";
import "./RegisterEvent.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s-]{7,15}$/;

const CATEGORIES = [
  "All Events",
  "Technical",
  "Workshops",
  "Literary",
  "Cultural",
  "Competitions",
];

function formatDateTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Strict eligibility check for the /register page:
 * - Only events with status "Published"
 * - registrationOpen === true
 * - Upcoming start/end date (no past/expired events)
 * - Registration deadline has not passed
 * - Registration start date has arrived (if specified)
 * - Capacity not exceeded
 */
export function isEventEligibleForRegistration(event, count = 0) {
  if (!event || typeof event !== "object") return false;

  // 1. Must be published
  if (event.status !== "Published") return false;

  // 2. Must be explicitly open
  if (event.registrationOpen !== true) return false;

  const now = new Date();

  // 3. Must be an upcoming event (exclude past / concluded events)
  if (event.eventEndDate) {
    const end = new Date(event.eventEndDate);
    if (!isNaN(end.getTime()) && now > end) return false;
  } else if (event.eventStartDate) {
    const start = new Date(event.eventStartDate);
    if (!isNaN(start.getTime()) && now > start) return false;
  }

  // 4. Registration deadline must not have passed
  if (event.registrationDeadline) {
    const deadline = new Date(event.registrationDeadline);
    if (!isNaN(deadline.getTime()) && now > deadline) return false;
  }

  // 5. Registration start date must have arrived (if defined)
  if (event.registrationStartDate) {
    const regStart = new Date(event.registrationStartDate);
    if (!isNaN(regStart.getTime()) && now < regStart) return false;
  }

  // 6. Must have capacity remaining
  if (event.maxRegistrations && count >= Number(event.maxRegistrations)) {
    return false;
  }

  return true;
}

function getEventRegStatus(event, count) {
  const now = new Date();

  if (event.status !== "Published") {
    return { status: "UNPUBLISHED", label: "Not Published", canRegister: false };
  }

  if (event.registrationOpen !== true) {
    return { status: "CLOSED", label: "Registration Closed", canRegister: false };
  }

  if (event.registrationStartDate) {
    const start = new Date(event.registrationStartDate);
    if (!isNaN(start.getTime()) && now < start) {
      return {
        status: "NOT_STARTED",
        label: `Opens ${formatDateTime(event.registrationStartDate)}`,
        canRegister: false,
      };
    }
  }

  if (event.registrationDeadline) {
    const deadline = new Date(event.registrationDeadline);
    if (!isNaN(deadline.getTime()) && now > deadline) {
      return { status: "EXPIRED", label: "Registration Closed", canRegister: false };
    }
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    if (!isNaN(deadline.getTime()) && deadline.getTime() - now.getTime() < twoDays) {
      return { status: "CLOSING_SOON", label: "Closing Soon", canRegister: true };
    }
  }

  if (event.maxRegistrations && count >= Number(event.maxRegistrations)) {
    return { status: "FULL", label: "Fully Booked", canRegister: false };
  }

  return { status: "OPEN", label: "Registration Open", canRegister: true };
}

function matchesCategory(event, category) {
  if (category === "All Events") return true;
  const target = category.toLowerCase();
  const cat = String(event.category || "").toLowerCase();
  const subtitle = String(event.subtitle || event.kind || "").toLowerCase();
  const title = String(event.title || "").toLowerCase();
  const desc = String(event.description || event.shortDescription || "").toLowerCase();
  const text = `${cat} ${subtitle} ${title} ${desc}`;

  if (target === "technical") {
    return cat === "technical" || text.includes("tech") || text.includes("coding") ||
      text.includes("software") || text.includes("ai") || text.includes("web") ||
      text.includes("robotics");
  }
  if (target === "workshops") {
    return cat === "workshop" || cat === "workshops" || text.includes("workshop") ||
      text.includes("hands-on") || text.includes("bootcamp") || text.includes("masterclass") ||
      text.includes("training");
  }
  if (target === "literary") {
    return cat === "literary" || text.includes("literary") || text.includes("debate") ||
      text.includes("quiz") || text.includes("mun") || text.includes("writing") ||
      text.includes("speech") || text.includes("communicraft");
  }
  if (target === "cultural") {
    return cat === "cultural" || text.includes("cultural") || text.includes("fest") ||
      text.includes("music") || text.includes("dance") || text.includes("drama") ||
      text.includes("art") || text.includes("creative");
  }
  if (target === "competitions") {
    return cat === "competition" || cat === "competitions" || text.includes("competition") ||
      text.includes("contest") || text.includes("spardha") || text.includes("challenge") ||
      text.includes("hackathon") || text.includes("quiztronix");
  }
  return cat.includes(target) || text.includes(target);
}

function getStatusPriority(statusInfo) {
  if (statusInfo.canRegister) {
    if (statusInfo.status === "CLOSING_SOON") return 1;
    return 2;
  }
  if (statusInfo.status === "NOT_STARTED") return 3;
  if (statusInfo.status === "CLOSED" || statusInfo.status === "EXPIRED") return 4;
  if (statusInfo.status === "FULL") return 5;
  return 6;
}

function compareEvents(a, b) {
  const pA = getStatusPriority(a.statusInfo);
  const pB = getStatusPriority(b.statusInfo);
  if (pA !== pB) return pA - pB;
  const dateA = a.eventStartDate ? new Date(a.eventStartDate).getTime() : Infinity;
  const dateB = b.eventStartDate ? new Date(b.eventStartDate).getTime() : Infinity;
  if (dateA !== dateB) return dateA - dateB;
  return (a.title || "").localeCompare(b.title || "");
}

/* ── Resolve status badge class ── */
function statusBadgeClass(status) {
  if (status === "OPEN") return "open";
  if (status === "CLOSING_SOON") return "closing-soon";
  if (status === "FULL") return "full";
  if (status === "CLOSED" || status === "EXPIRED" || status === "UNPUBLISHED") return "closed";
  if (status === "NOT_STARTED") return "upcoming";
  return "closed";
}

/* ── Fallback SVG emblem (star/award icon) ── */
function FallbackEmblem() {
  return (
    <svg viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17 3L20.5 12.5H31L22.5 18.5L25.5 28L17 22L8.5 28L11.5 18.5L3 12.5H13.5L17 3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RegisterEvent() {
  const [events, setEvents] = useState([]);
  const [regCounts, setRegCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState("All Events");
  const [searchQuery, setSearchQuery] = useState("");

  const [modalEvent, setModalEvent] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    collegeEmail: "",
    rollNumber: "",
    department: "",
    year: "",
    phone: "",
    customAnswers: {},
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [registrationResult, setRegistrationResult] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const loadEventsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getEventsPage({ pageSize: 40, onlyPublished: true });
      const publishedEvents = res.events || [];
      setEvents(publishedEvents);

      const counts = {};
      await Promise.all(
        publishedEvents.map(async (ev) => {
          try {
            counts[ev.id] = await countRegistrations(ev.id);
          } catch {
            counts[ev.id] = 0;
          }
        })
      );
      setRegCounts(counts);
    } catch (err) {
      console.error("Error loading events for registration:", err);
      setError("Unable to load events at this moment. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEventsData(); }, [loadEventsData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && modalEvent) closeRegistrationModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalEvent]);

  const eligibleEvents = useMemo(() => {
    return events
      .filter((ev) => isEventEligibleForRegistration(ev, regCounts[ev.id] || 0))
      .map((ev) => {
        const count = regCounts[ev.id] || 0;
        const statusInfo = getEventRegStatus(ev, count);
        const maxLimit = ev.maxRegistrations ? Number(ev.maxRegistrations) : null;
        const remainingSeats = maxLimit !== null ? Math.max(0, maxLimit - count) : null;
        const percentFilled = maxLimit ? Math.min(100, Math.round((count / maxLimit) * 100)) : 0;
        return { ...ev, count, statusInfo, maxLimit, remainingSeats, percentFilled };
      });
  }, [events, regCounts]);

  const hasEligibleEvents = eligibleEvents.length > 0;

  const filteredEvents = useMemo(() => {
    const matches = eligibleEvents.filter((ev) => {
      if (!matchesCategory(ev, selectedCategory)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        String(ev.title || "").toLowerCase().includes(q) ||
        String(ev.description || ev.shortDescription || ev.tagline || "").toLowerCase().includes(q) ||
        String(ev.venue || ev.location || "").toLowerCase().includes(q) ||
        String(ev.category || ev.subtitle || "").toLowerCase().includes(q)
      );
    });
    return [...matches].sort(compareEvents);
  }, [eligibleEvents, selectedCategory, searchQuery]);

  const featuredEvent = filteredEvents[0] || null;
  const remainingEvents = filteredEvents.slice(1);

  const openRegistrationModal = (ev) => {
    setModalEvent(ev);
    setFormData({ name: "", email: "", collegeEmail: "", rollNumber: "", department: "", year: "", phone: "", customAnswers: {} });
    setFormErrors({});
    setSubmitError("");
    setRegistrationResult(null);
    setCopiedId(false);
  };

  const closeRegistrationModal = () => {
    setModalEvent(null);
    setRegistrationResult(null);
    setSubmitError("");
  };

  const validateForm = () => {
    const errs = {};
    const ff = modalEvent?.formFields || {};

    if (!formData.name.trim()) errs.name = "Full name is required.";
    if (!formData.email.trim()) errs.email = "Email address is required.";
    else if (!EMAIL_REGEX.test(formData.email.trim())) errs.email = "Please enter a valid email address.";

    if (ff.collegeEmail?.enabled !== false && ff.collegeEmail?.required) {
      if (!formData.collegeEmail.trim()) errs.collegeEmail = "College email is required.";
      else if (!EMAIL_REGEX.test(formData.collegeEmail.trim())) errs.collegeEmail = "Please enter a valid college email address.";
    }
    if (ff.rollNumber?.enabled !== false && ff.rollNumber?.required) {
      if (!formData.rollNumber.trim()) errs.rollNumber = "Roll number / Student ID is required.";
    }
    if (ff.departmentYear?.enabled !== false && ff.departmentYear?.required) {
      if (!formData.department.trim()) errs.department = "Department / Branch is required.";
      if (!formData.year.trim()) errs.year = "Year / Semester is required.";
    }
    if (ff.phone?.enabled !== false && ff.phone?.required) {
      if (!formData.phone.trim()) errs.phone = "Phone number is required.";
      else if (!PHONE_REGEX.test(formData.phone.trim())) errs.phone = "Please enter a valid phone number.";
    }

    (ff.customQuestions || []).forEach((q) => {
      if (q.required) {
        const val = (formData.customAnswers[q.label] || "").trim();
        if (!val) errs[`q_${q.id || q.label}`] = `"${q.label}" is required.`;
      }
    });

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const payload = {
        eventId: modalEvent.id,
        eventTitle: modalEvent.title,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        collegeEmail: formData.collegeEmail.trim().toLowerCase() || formData.email.trim().toLowerCase(),
        rollNumber: formData.rollNumber.trim(),
        department: formData.department.trim(),
        year: formData.year.trim(),
        branch: formData.department.trim(),
        semester: formData.year.trim(),
        phone: formData.phone.trim(),
        customAnswers: formData.customAnswers,
        isPaid: false,
      };

      const result = await createRegistration(payload);
      setRegCounts((prev) => ({ ...prev, [modalEvent.id]: (prev[modalEvent.id] || 0) + 1 }));
      setRegistrationResult({
        registrationId: result.registrationId,
        id: result.id,
        name: formData.name.trim(),
        eventTitle: modalEvent.title,
        venue: modalEvent.venue || modalEvent.location || "Venue TBA",
        date: modalEvent.eventStartDate || "",
      });
    } catch (err) {
      console.error("Registration error:", err);
      setSubmitError(err.message || "Unable to complete registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = () => {
    if (registrationResult?.registrationId) {
      navigator.clipboard.writeText(registrationResult.registrationId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  return (
    <div className="dlux-page">
      <Helmet>
        <title>Event Registrations | Abhyudaya Club — MPEC Kanpur</title>
        <meta
          name="description"
          content="Discover upcoming competitions, technical events, and campus experiences at Abhyudaya Club MPEC. Find your next opportunity and reserve your place."
        />
        <meta name="robots" content="index,follow" />
      </Helmet>

      {/* ============================================================
          PREMIUM HERO
         ============================================================ */}
      <section className="dlux-hero" aria-label="Registration page header">
        <div className="dlux-hero-inner">
          <div className="dlux-hero-eyebrow">
            <span className="dlux-hero-eyebrow-dot" aria-hidden="true" />
            ABHYUDAYA CLUB • MPEC KANPUR
            <span className="dlux-hero-eyebrow-dot" aria-hidden="true" />
          </div>

          <h1 className="dlux-hero-h1">
            Experiences Worth{" "}
            <span className="dlux-hero-h1-italic">Being Part Of.</span>
          </h1>

          <div className="dlux-hero-rule" aria-hidden="true">
            <span className="dlux-hero-rule-line" />
            <span className="dlux-hero-rule-gem">◆◆◆</span>
            <span className="dlux-hero-rule-line" />
          </div>

          <p className="dlux-hero-desc">
            Discover upcoming competitions, technical events, and campus experiences.
            Find your next opportunity and reserve your place.
          </p>
        </div>
      </section>

      {/* ============================================================
          MAIN CONTENT
         ============================================================ */}
      <main id="events-hub" className="dlux-main">

        {/* ── TOOLBAR ── */}
        {!loading && !error && hasEligibleEvents && (
          <div className="dlux-toolbar">
            <div className="dlux-filter-row" role="tablist" aria-label="Event categories">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`dlux-filter-pill${isActive ? " is-active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="dlux-search-wrap">
              <FiSearch className="dlux-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="dlux-search-input"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search events"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="dlux-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <FiX />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── CONTENT STATES ── */}

        {loading ? (
          /* Loading skeleton */
          <div className="dlux-skeleton-grid" aria-label="Loading events">
            <div className="dlux-skeleton-featured">
              <div className="dlux-skeleton-img" />
              <div className="dlux-skeleton-body">
                <div className="dlux-skel-line dlux-skel-tag" />
                <div className="dlux-skel-line dlux-skel-title" />
                <div className="dlux-skel-line dlux-skel-title-2" />
                <div className="dlux-skel-line dlux-skel-desc" />
                <div className="dlux-skel-line dlux-skel-meta" />
                <div className="dlux-skel-line dlux-skel-btn" />
              </div>
            </div>
          </div>

        ) : error ? (
          /* Error state */
          <div className="dlux-error-card" role="alert">
            <div className="dlux-error-icon-wrap">
              <FiAlertCircle />
            </div>
            <h3 className="dlux-state-heading">Unable to Load Events</h3>
            <p className="dlux-state-desc">{error}</p>
            <button type="button" className="dlux-btn-utility" onClick={loadEventsData}>
              <FiRefreshCw />
              <span>Retry Connection</span>
            </button>
          </div>

        ) : !hasEligibleEvents ? (
          /* No registrations open */
          <div className="dlux-empty-card" aria-label="No registrations available">
            <div className="dlux-empty-emblem" aria-hidden="true">
              <svg viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="44" cy="44" r="43" stroke="rgba(232,181,71,0.18)" strokeWidth="1.5" />
                <circle cx="44" cy="44" r="35" stroke="rgba(232,181,71,0.1)" strokeWidth="1" />
                <path
                  d="M44 20L48.5 33H63L51.5 41L56 54L44 46L32 54L36.5 41L25 33H39.5L44 20Z"
                  stroke="#E8B547"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  fill="rgba(232,181,71,0.06)"
                />
                <circle cx="44" cy="68" r="3" fill="rgba(232,181,71,0.25)" />
              </svg>
            </div>
            <h3 className="dlux-state-heading">The Next Experience Awaits.</h3>
            <p className="dlux-state-desc">
              There are no open registrations right now. Stay tuned for upcoming Abhyudaya events.
            </p>
            <div className="dlux-empty-actions">
              <Link to="/events" className="dlux-btn-utility">
                <span>Explore All Events</span>
                <FiArrowRight />
              </Link>
            </div>
          </div>

        ) : filteredEvents.length === 0 ? (
          /* Search / filter no results */
          <div className="dlux-empty-card" role="status">
            <div className="dlux-empty-emblem" aria-hidden="true">
              <svg viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="44" cy="44" r="43" stroke="rgba(232,181,71,0.12)" strokeWidth="1.5" />
                <circle cx="38" cy="38" r="16" stroke="rgba(232,181,71,0.5)" strokeWidth="1.5" />
                <path d="M50 50L62 62" stroke="rgba(232,181,71,0.5)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="dlux-state-heading">No Matching Events</h3>
            <p className="dlux-state-desc">
              We couldn't find any events matching{" "}
              {searchQuery ? <strong>"{searchQuery}"</strong> : "your filter"}{" "}
              in <em>{selectedCategory}</em>.
            </p>
            <div className="dlux-empty-actions">
              <button
                type="button"
                className="dlux-btn-utility"
                onClick={() => { setSelectedCategory("All Events"); setSearchQuery(""); }}
              >
                Reset Filters
              </button>
            </div>
          </div>

        ) : (
          <>
            {/* ============================================================
                FEATURED DARK LUXURY CARD — First eligible event
               ============================================================ */}
            {featuredEvent && (() => {
              const ev = featuredEvent;
              const { statusInfo, maxLimit, remainingSeats, percentFilled } = ev;
              const imgSrc = ev.banner || ev.image;
              const badgeClass = statusBadgeClass(statusInfo.status);
              const isUrgent = statusInfo.status === "CLOSING_SOON";
              const fillClass = remainingSeats !== null && remainingSeats <= 10 ? "urgent" : "normal";

              return (
                <div className="dlux-featured-wrap">
                  <div className="dlux-section-header">
                    <div className="dlux-live-badge">
                      <span className="dlux-live-dot" aria-hidden="true" />
                      <span>REGISTRATIONS OPEN NOW</span>
                    </div>
                    <h2 className="dlux-section-title">Registrations Open Now</h2>
                    <p className="dlux-section-subtitle">
                      Your next experience is waiting. Explore events and secure your spot.
                    </p>
                  </div>

                  <article
                    className="dlux-featured-card"
                    aria-label={`Featured event: ${ev.title}`}
                  >
                    {/* ── Image Panel ── */}
                    <div className="dlux-featured-img-panel">
                      {imgSrc ? (
                        <>
                          <img
                            src={imgSrc}
                            alt={ev.title}
                            className="dlux-featured-img"
                            loading="eager"
                          />
                          <div className="dlux-featured-img-scrim" aria-hidden="true" />
                        </>
                      ) : (
                        <div className="dlux-featured-fallback" aria-hidden="true">
                          <div className="dlux-featured-fallback-emblem">
                            <FallbackEmblem />
                          </div>
                          <span className="dlux-featured-fallback-label">
                            {ev.category || "Abhyudaya Club"}
                          </span>
                        </div>
                      )}

                      {/* Overlays */}
                      <div className="dlux-featured-overlay-top">
                        <span className="dlux-featured-cat-pill">
                          {ev.category || ev.subtitle || "Event"}
                        </span>
                        <span className={`dlux-status-badge ${badgeClass}`}>
                          {statusInfo.status === "OPEN" || statusInfo.status === "CLOSING_SOON" ? (
                            <span className="dlux-status-glow-dot" aria-hidden="true" />
                          ) : null}
                          {isUrgent ? "CLOSING SOON" : "REGISTRATION OPEN"}
                        </span>
                      </div>
                    </div>

                    {/* ── Info Panel ── */}
                    <div className="dlux-featured-info">
                      <div className="dlux-featured-info-cat">
                        {ev.category || "Featured Event"}
                      </div>

                      <h3 className="dlux-featured-title">{ev.title}</h3>

                      <p className="dlux-featured-desc">
                        {ev.tagline || ev.shortDescription || ev.description ||
                          "Join this flagship session organized by Abhyudaya Club, MPEC Kanpur."}
                      </p>

                      <div className="dlux-meta-stack">
                        <div className="dlux-meta-row">
                          <FiCalendar className="dlux-meta-icon" aria-hidden="true" />
                          <span>
                            {ev.eventStartDate
                              ? formatDateTime(ev.eventStartDate)
                              : "Date to be announced"}
                          </span>
                        </div>

                        <div className="dlux-meta-row">
                          {ev.meetingLink ? (
                            <FiVideo className="dlux-meta-icon" aria-hidden="true" />
                          ) : (
                            <FiMapPin className="dlux-meta-icon" aria-hidden="true" />
                          )}
                          <span>
                            {ev.venue || ev.location ||
                              (ev.meetingLink ? "Virtual Meeting" : "MPEC Campus, Kanpur")}
                          </span>
                        </div>

                        {ev.registrationDeadline && (
                          <div className="dlux-meta-row dlux-meta-deadline">
                            <FiClock className="dlux-meta-icon" aria-hidden="true" />
                            <span>Closes: {formatDateTime(ev.registrationDeadline)}</span>
                          </div>
                        )}
                      </div>

                      <div className="dlux-info-divider" aria-hidden="true" />

                      {/* Countdown */}
                      {ev.countdownEnabled && (ev.countdownTarget || ev.eventStartDate) && (
                        <div className="dlux-featured-countdown">
                          <EventCountdown
                            targetDate={ev.countdownTarget || ev.eventStartDate}
                            title="Event Starts In"
                            variant="card"
                          />
                        </div>
                      )}

                      {/* Seats */}
                      {maxLimit !== null && (
                        <div className="dlux-seats-box">
                          <div className="dlux-seats-row">
                            <span className="dlux-seats-label">Available Seats</span>
                            <span className="dlux-seats-count">
                              <strong>{remainingSeats}</strong> / {maxLimit}
                            </span>
                          </div>
                          <div className="dlux-seats-track">
                            <div
                              className={`dlux-seats-fill ${fillClass}`}
                              style={{ width: `${percentFilled}%` }}
                            />
                          </div>
                          <span className={`dlux-seats-note${fillClass === "urgent" ? " urgent" : ""}`}>
                            {remainingSeats <= 10
                              ? `Only ${remainingSeats} seats remaining`
                              : "Open for registration"}
                          </span>
                        </div>
                      )}

                      <div className="dlux-featured-spacer" />

                      {/* Actions */}
                      <div className="dlux-featured-actions">
                        {statusInfo.canRegister ? (
                          <button
                            type="button"
                            className="dlux-btn-gold"
                            onClick={() => openRegistrationModal(ev)}
                          >
                            <span>Register Now →</span>
                          </button>
                        ) : (
                          <span className="dlux-btn-disabled">
                            {statusInfo.label}
                          </span>
                        )}
                        <Link
                          to={`/events/${ev.slug || ev.id}`}
                          className="dlux-btn-ghost"
                        >
                          <span>View Details</span>
                          <FiArrowRight />
                        </Link>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })()}

            {/* ============================================================
                REMAINING EVENTS GRID
               ============================================================ */}
            {remainingEvents.length > 0 && (
              <div className="dlux-grid-section">
                <p className="dlux-grid-eyebrow">MORE OPEN EVENTS</p>
                <h2 className="dlux-grid-heading">Also Open for Registration</h2>

                <div className="dlux-grid">
                  {remainingEvents.map((ev) => {
                    const { statusInfo, maxLimit, remainingSeats, percentFilled } = ev;
                    const imgSrc = ev.banner || ev.image;
                    const badgeClass = statusBadgeClass(statusInfo.status);
                    const fillClass = remainingSeats !== null && remainingSeats <= 10 ? "urgent" : "normal";

                    return (
                      <article
                        key={ev.id}
                        className="dlux-card"
                        aria-label={`Event: ${ev.title}`}
                      >
                        {/* Card image */}
                        <div className="dlux-card-media">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={ev.title}
                              className="dlux-card-img"
                              loading="lazy"
                            />
                          ) : (
                            <div className="dlux-card-fallback" aria-hidden="true">
                              <div className="dlux-card-fallback-icon">
                                <FallbackEmblem />
                              </div>
                            </div>
                          )}

                          <div className="dlux-card-overlay">
                            <span className="dlux-card-cat">
                              {ev.category || ev.subtitle || "Event"}
                            </span>
                            <span className={`dlux-status-badge ${badgeClass}`}>
                              {statusInfo.status === "OPEN" && (
                                <span className="dlux-status-glow-dot" aria-hidden="true" />
                              )}
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="dlux-card-body">
                          <h3 className="dlux-card-title">{ev.title}</h3>
                          <p className="dlux-card-desc">
                            {ev.tagline || ev.shortDescription || ev.description || ""}
                          </p>

                          <div className="dlux-card-meta">
                            <div className="dlux-card-meta-item">
                              <FiCalendar className="dlux-card-meta-icon" aria-hidden="true" />
                              <span>
                                {ev.eventStartDate
                                  ? formatDateTime(ev.eventStartDate)
                                  : "Date TBA"}
                              </span>
                            </div>
                            <div className="dlux-card-meta-item">
                              {ev.meetingLink ? (
                                <FiVideo className="dlux-card-meta-icon" aria-hidden="true" />
                              ) : (
                                <FiMapPin className="dlux-card-meta-icon" aria-hidden="true" />
                              )}
                              <span className="dlux-card-meta-truncate">
                                {ev.venue || ev.location ||
                                  (ev.meetingLink ? "Virtual" : "MPEC Campus")}
                              </span>
                            </div>
                            {ev.registrationDeadline && (
                              <div className="dlux-card-meta-item dlux-card-deadline-item">
                                <FiClock className="dlux-card-meta-icon" aria-hidden="true" />
                                <span>Closes: {formatDateTime(ev.registrationDeadline)}</span>
                              </div>
                            )}
                          </div>

                          {/* Countdown */}
                          {ev.countdownEnabled && (ev.countdownTarget || ev.eventStartDate) && (
                            <div className="dlux-card-countdown-wrap">
                              <EventCountdown
                                targetDate={ev.countdownTarget || ev.eventStartDate}
                                title="Starts In"
                                variant="compact"
                              />
                            </div>
                          )}

                          {/* Capacity */}
                          {maxLimit !== null && (
                            <div className="dlux-card-capacity">
                              <div className="dlux-card-cap-header">
                                <span className="dlux-card-cap-label">Seats</span>
                                <span className="dlux-card-cap-count">
                                  {remainingSeats} / {maxLimit}
                                </span>
                              </div>
                              <div className="dlux-card-cap-track">
                                <div
                                  className={`dlux-card-cap-fill ${fillClass}`}
                                  style={{ width: `${percentFilled}%` }}
                                />
                              </div>
                              <span className={`dlux-card-cap-note${fillClass === "urgent" ? " urgent" : ""}`}>
                                {remainingSeats <= 10
                                  ? `${remainingSeats} seats left`
                                  : "Open"}
                              </span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="dlux-card-actions">
                            {statusInfo.canRegister ? (
                              <button
                                type="button"
                                className="dlux-card-btn-primary"
                                onClick={() => openRegistrationModal(ev)}
                              >
                                Register →
                              </button>
                            ) : (
                              <span className="dlux-card-btn-closed">
                                {statusInfo.label}
                              </span>
                            )}
                            <Link
                              to={`/events/${ev.slug || ev.id}`}
                              className="dlux-card-btn-details"
                            >
                              Details
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ============================================================
          REGISTRATION MODAL
         ============================================================ */}
      {modalEvent && (
        <div
          className="dlux-modal-backdrop"
          onClick={closeRegistrationModal}
          role="presentation"
        >
          <div
            className="dlux-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dlux-modal-title"
          >
            {/* Header */}
            <div className="dlux-modal-header">
              <div className="dlux-modal-header-text">
                <span className="dlux-modal-eyebrow">ABHYUDAYA REGISTRATION</span>
                <h2 id="dlux-modal-title" className="dlux-modal-title">
                  {modalEvent.title}
                </h2>
                <div className="dlux-modal-meta">
                  {modalEvent.eventStartDate && (
                    <span>📅 {formatDateTime(modalEvent.eventStartDate)}</span>
                  )}
                  {modalEvent.venue && (
                    <span>📍 {modalEvent.venue}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="dlux-modal-close"
                onClick={closeRegistrationModal}
                aria-label="Close registration form"
              >
                <FiX />
              </button>
            </div>

            {/* Body */}
            {registrationResult ? (
              /* Success view */
              <div className="dlux-success-view">
                <div className="dlux-success-icon-ring" aria-hidden="true">
                  <FiCheckCircle className="dlux-success-check" />
                </div>

                <h3 className="dlux-success-heading">Registration Confirmed</h3>
                <p className="dlux-success-subtext">
                  Welcome aboard, <strong>{registrationResult.name}</strong>! Your spot for{" "}
                  <strong>{registrationResult.eventTitle}</strong> is officially reserved.
                </p>

                <div className="dlux-pass-card">
                  <span className="dlux-pass-label">OFFICIAL REGISTRATION PASS</span>
                  <div className="dlux-pass-code-row">
                    <span className="dlux-pass-code">
                      {registrationResult.registrationId}
                    </span>
                    <button
                      type="button"
                      className="dlux-pass-copy-btn"
                      onClick={handleCopyId}
                      title="Copy Pass ID"
                    >
                      {copiedId ? <FiCheck /> : <FiCopy />}
                      <span>{copiedId ? "Copied" : "Copy ID"}</span>
                    </button>
                  </div>
                  <p className="dlux-pass-hint">
                    Take a screenshot or note this pass ID. You may be asked to present it at entry.
                  </p>
                </div>

                <div className="dlux-success-actions">
                  <button
                    type="button"
                    className="dlux-btn-utility"
                    onClick={closeRegistrationModal}
                  >
                    Done &amp; Close
                  </button>
                </div>
              </div>

            ) : (
              /* Registration form */
              <form onSubmit={handleSubmitRegistration} className="dlux-modal-form" noValidate>
                {submitError && (
                  <div className="dlux-form-error-banner" role="alert">
                    <FiAlertCircle />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="dlux-form-scroll">
                  {/* Full Name */}
                  <div className="dlux-form-group">
                    <label htmlFor="dlux-name" className="dlux-form-label">
                      Full Name <span className="dlux-required">*</span>
                    </label>
                    <input
                      id="dlux-name"
                      type="text"
                      className={`dlux-form-input${formErrors.name ? " has-error" : ""}`}
                      placeholder="e.g. Aryan Sharma"
                      value={formData.name}
                      onChange={(e) => { setFormData((p) => ({ ...p, name: e.target.value })); setFormErrors((p) => ({ ...p, name: "" })); }}
                      disabled={submitting}
                    />
                    {formErrors.name && <span className="dlux-field-error">{formErrors.name}</span>}
                  </div>

                  {/* Primary Email */}
                  <div className="dlux-form-group">
                    <label htmlFor="dlux-email" className="dlux-form-label">
                      Personal Email <span className="dlux-required">*</span>
                    </label>
                    <input
                      id="dlux-email"
                      type="email"
                      className={`dlux-form-input${formErrors.email ? " has-error" : ""}`}
                      placeholder="e.g. aryan@gmail.com"
                      value={formData.email}
                      onChange={(e) => { setFormData((p) => ({ ...p, email: e.target.value })); setFormErrors((p) => ({ ...p, email: "" })); }}
                      disabled={submitting}
                    />
                    {formErrors.email && <span className="dlux-field-error">{formErrors.email}</span>}
                  </div>

                  {/* College Email */}
                  {modalEvent.formFields?.collegeEmail?.enabled !== false && (
                    <div className="dlux-form-group">
                      <label htmlFor="dlux-college-email" className="dlux-form-label">
                        College Email{" "}
                        {modalEvent.formFields?.collegeEmail?.required && (
                          <span className="dlux-required">*</span>
                        )}
                      </label>
                      <input
                        id="dlux-college-email"
                        type="email"
                        className={`dlux-form-input${formErrors.collegeEmail ? " has-error" : ""}`}
                        placeholder="e.g. aryan.21cs@mpgi.edu.in"
                        value={formData.collegeEmail}
                        onChange={(e) => { setFormData((p) => ({ ...p, collegeEmail: e.target.value })); setFormErrors((p) => ({ ...p, collegeEmail: "" })); }}
                        disabled={submitting}
                      />
                      {formErrors.collegeEmail && <span className="dlux-field-error">{formErrors.collegeEmail}</span>}
                    </div>
                  )}

                  {/* Roll Number */}
                  {modalEvent.formFields?.rollNumber?.enabled !== false && (
                    <div className="dlux-form-group">
                      <label htmlFor="dlux-roll" className="dlux-form-label">
                        Roll Number / Student ID{" "}
                        {modalEvent.formFields?.rollNumber?.required && (
                          <span className="dlux-required">*</span>
                        )}
                      </label>
                      <input
                        id="dlux-roll"
                        type="text"
                        className={`dlux-form-input${formErrors.rollNumber ? " has-error" : ""}`}
                        placeholder="e.g. 2101640100045"
                        value={formData.rollNumber}
                        onChange={(e) => { setFormData((p) => ({ ...p, rollNumber: e.target.value })); setFormErrors((p) => ({ ...p, rollNumber: "" })); }}
                        disabled={submitting}
                      />
                      {formErrors.rollNumber && <span className="dlux-field-error">{formErrors.rollNumber}</span>}
                    </div>
                  )}

                  {/* Department & Year */}
                  {modalEvent.formFields?.departmentYear?.enabled !== false && (
                    <div className="dlux-form-row">
                      <div className="dlux-form-group">
                        <label htmlFor="dlux-dept" className="dlux-form-label">
                          Department{" "}
                          {modalEvent.formFields?.departmentYear?.required && (
                            <span className="dlux-required">*</span>
                          )}
                        </label>
                        <input
                          id="dlux-dept"
                          type="text"
                          className={`dlux-form-input${formErrors.department ? " has-error" : ""}`}
                          placeholder="e.g. CSE, IT, ME"
                          value={formData.department}
                          onChange={(e) => { setFormData((p) => ({ ...p, department: e.target.value })); setFormErrors((p) => ({ ...p, department: "" })); }}
                          disabled={submitting}
                        />
                        {formErrors.department && <span className="dlux-field-error">{formErrors.department}</span>}
                      </div>

                      <div className="dlux-form-group">
                        <label htmlFor="dlux-year" className="dlux-form-label">
                          Year{" "}
                          {modalEvent.formFields?.departmentYear?.required && (
                            <span className="dlux-required">*</span>
                          )}
                        </label>
                        <select
                          id="dlux-year"
                          className={`dlux-form-select${formErrors.year ? " has-error" : ""}`}
                          value={formData.year}
                          onChange={(e) => { setFormData((p) => ({ ...p, year: e.target.value })); setFormErrors((p) => ({ ...p, year: "" })); }}
                          disabled={submitting}
                        >
                          <option value="">Select Year</option>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                          <option value="MCA / M.Tech">MCA / M.Tech</option>
                          <option value="Faculty / Other">Faculty / Other</option>
                        </select>
                        {formErrors.year && <span className="dlux-field-error">{formErrors.year}</span>}
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {modalEvent.formFields?.phone?.enabled !== false && (
                    <div className="dlux-form-group">
                      <label htmlFor="dlux-phone" className="dlux-form-label">
                        WhatsApp / Contact Number{" "}
                        {modalEvent.formFields?.phone?.required && (
                          <span className="dlux-required">*</span>
                        )}
                      </label>
                      <input
                        id="dlux-phone"
                        type="tel"
                        className={`dlux-form-input${formErrors.phone ? " has-error" : ""}`}
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => { setFormData((p) => ({ ...p, phone: e.target.value })); setFormErrors((p) => ({ ...p, phone: "" })); }}
                        disabled={submitting}
                      />
                      {formErrors.phone && <span className="dlux-field-error">{formErrors.phone}</span>}
                    </div>
                  )}

                  {/* Custom Questions */}
                  {(modalEvent.formFields?.customQuestions || []).map((q) => {
                    const qKey = `q_${q.id || q.label}`;
                    const currentVal = formData.customAnswers[q.label] || "";
                    const opts = q.options
                      ? q.options.split(",").map((o) => o.trim()).filter(Boolean)
                      : [];

                    return (
                      <div key={q.id || q.label} className="dlux-form-group">
                        <label htmlFor={qKey} className="dlux-form-label">
                          {q.label} {q.required && <span className="dlux-required">*</span>}
                        </label>

                        {q.type === "select" ? (
                          <select
                            id={qKey}
                            className={`dlux-form-select${formErrors[qKey] ? " has-error" : ""}`}
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({ ...p, customAnswers: { ...p.customAnswers, [q.label]: val } }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
                            disabled={submitting}
                          >
                            <option value="">Select an option</option>
                            {opts.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : q.type === "textarea" ? (
                          <textarea
                            id={qKey}
                            rows={3}
                            className={`dlux-form-textarea${formErrors[qKey] ? " has-error" : ""}`}
                            placeholder="Type your response..."
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({ ...p, customAnswers: { ...p.customAnswers, [q.label]: val } }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
                            disabled={submitting}
                          />
                        ) : (
                          <input
                            id={qKey}
                            type="text"
                            className={`dlux-form-input${formErrors[qKey] ? " has-error" : ""}`}
                            placeholder="Your answer"
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({ ...p, customAnswers: { ...p.customAnswers, [q.label]: val } }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
                            disabled={submitting}
                          />
                        )}

                        {formErrors[qKey] && <span className="dlux-field-error">{formErrors[qKey]}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="dlux-modal-footer">
                  <button
                    type="button"
                    className="dlux-modal-btn-cancel"
                    onClick={closeRegistrationModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="dlux-modal-btn-submit"
                    disabled={submitting}
                  >
                    {submitting ? "Registering..." : "Confirm & Register"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
