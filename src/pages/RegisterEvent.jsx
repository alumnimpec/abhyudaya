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
  FiArrowDown,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import { getEventsPage } from "../Firebase/eventService.js";
import {
  countRegistrations,
  createRegistration,
} from "../Firebase/registrationService.js";
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

  return { status: "OPEN", label: "Register Now", canRegister: true };
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
    return (
      cat === "technical" ||
      text.includes("tech") ||
      text.includes("coding") ||
      text.includes("software") ||
      text.includes("ai") ||
      text.includes("web") ||
      text.includes("robotics")
    );
  }
  if (target === "workshops") {
    return (
      cat === "workshop" ||
      cat === "workshops" ||
      text.includes("workshop") ||
      text.includes("hands-on") ||
      text.includes("bootcamp") ||
      text.includes("masterclass") ||
      text.includes("training")
    );
  }
  if (target === "literary") {
    return (
      cat === "literary" ||
      text.includes("literary") ||
      text.includes("debate") ||
      text.includes("quiz") ||
      text.includes("mun") ||
      text.includes("writing") ||
      text.includes("speech") ||
      text.includes("communicraft")
    );
  }
  if (target === "cultural") {
    return (
      cat === "cultural" ||
      text.includes("cultural") ||
      text.includes("fest") ||
      text.includes("music") ||
      text.includes("dance") ||
      text.includes("drama") ||
      text.includes("art") ||
      text.includes("creative")
    );
  }
  if (target === "competitions") {
    return (
      cat === "competition" ||
      cat === "competitions" ||
      text.includes("competition") ||
      text.includes("contest") ||
      text.includes("spardha") ||
      text.includes("challenge") ||
      text.includes("hackathon") ||
      text.includes("quiztronix")
    );
  }

  return cat.includes(target) || text.includes(target);
}

// Status hierarchy priority:
// 1: Closing Soon (Open & urgent)
// 2: Open (Accepting registrations)
// 3: Not Started (Upcoming, will open soon)
// 4: Closed / Expired
// 5: Fully Booked (Capacity reached)
// 6: Other
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
  if (pA !== pB) {
    return pA - pB;
  }
  // Secondary sort: nearest upcoming event date first
  const dateA = a.eventStartDate ? new Date(a.eventStartDate).getTime() : Infinity;
  const dateB = b.eventStartDate ? new Date(b.eventStartDate).getTime() : Infinity;
  if (dateA !== dateB) {
    return dateA - dateB;
  }
  return (a.title || "").localeCompare(b.title || "");
}

export default function RegisterEvent() {
  const [events, setEvents] = useState([]);
  const [regCounts, setRegCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── Filter and Search State ── */
  const [selectedCategory, setSelectedCategory] = useState("All Events");
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Registration Modal State ── */
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

  /* ── Load Published Events and Counts ── */
  const loadEventsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getEventsPage({ pageSize: 40, onlyPublished: true });
      const publishedEvents = res.events || [];
      setEvents(publishedEvents);

      // Fetch registration count for each event
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

  useEffect(() => {
    loadEventsData();
  }, [loadEventsData]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && modalEvent) {
        closeRegistrationModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalEvent]);

  /* ── Events with Status Computations ── */
  const eventsWithStatus = useMemo(() => {
    return events.map((ev) => {
      const count = regCounts[ev.id] || 0;
      const statusInfo = getEventRegStatus(ev, count);
      const maxLimit = ev.maxRegistrations ? Number(ev.maxRegistrations) : null;
      const remainingSeats = maxLimit !== null ? Math.max(0, maxLimit - count) : null;
      const percentFilled = maxLimit ? Math.min(100, Math.round((count / maxLimit) * 100)) : 0;

      return {
        ...ev,
        count,
        statusInfo,
        maxLimit,
        remainingSeats,
        percentFilled,
      };
    });
  }, [events, regCounts]);

  /* ── Global Open / Upcoming Events Check ── */
  const hasOpenOrUpcomingEvents = useMemo(() => {
    return eventsWithStatus.some(
      (e) => e.statusInfo.canRegister || e.statusInfo.status === "NOT_STARTED"
    );
  }, [eventsWithStatus]);

  /* ── Filtered and Strictly Prioritized Events ── */
  const filteredEvents = useMemo(() => {
    const matches = eventsWithStatus.filter((ev) => {
      const matchesCat = matchesCategory(ev, selectedCategory);
      if (!matchesCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const title = String(ev.title || "").toLowerCase();
      const desc = String(ev.description || ev.shortDescription || ev.tagline || "").toLowerCase();
      const venue = String(ev.venue || ev.location || "").toLowerCase();
      const category = String(ev.category || ev.subtitle || "").toLowerCase();

      return (
        title.includes(q) ||
        desc.includes(q) ||
        venue.includes(q) ||
        category.includes(q)
      );
    });

    // Enforce priority ordering: Open first -> Upcoming next -> Closed -> Fully booked
    return [...matches].sort(compareEvents);
  }, [eventsWithStatus, selectedCategory, searchQuery]);

  /* ── Segregate Open Events for Prominent Featured Section ── */
  const openFilteredEvents = useMemo(() => {
    return filteredEvents.filter((e) => e.statusInfo.canRegister);
  }, [filteredEvents]);

  const remainingFilteredEvents = useMemo(() => {
    return filteredEvents.filter((e) => !e.statusInfo.canRegister);
  }, [filteredEvents]);

  /* ── Registration Modal Actions ── */
  const openRegistrationModal = (ev) => {
    setModalEvent(ev);
    setFormData({
      name: "",
      email: "",
      collegeEmail: "",
      rollNumber: "",
      department: "",
      year: "",
      phone: "",
      customAnswers: {},
    });
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

  /* ── Form Validation ── */
  const validateForm = () => {
    const errs = {};
    const ff = modalEvent?.formFields || {};

    if (!formData.name.trim()) {
      errs.name = "Full name is required.";
    }

    if (!formData.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      errs.email = "Please enter a valid email address.";
    }

    if (ff.collegeEmail?.enabled !== false && ff.collegeEmail?.required) {
      if (!formData.collegeEmail.trim()) {
        errs.collegeEmail = "College email is required.";
      } else if (!EMAIL_REGEX.test(formData.collegeEmail.trim())) {
        errs.collegeEmail = "Please enter a valid college email address.";
      }
    }

    if (ff.rollNumber?.enabled !== false && ff.rollNumber?.required) {
      if (!formData.rollNumber.trim()) {
        errs.rollNumber = "Roll number / Student ID is required.";
      }
    }

    if (ff.departmentYear?.enabled !== false && ff.departmentYear?.required) {
      if (!formData.department.trim()) {
        errs.department = "Department / Branch is required.";
      }
      if (!formData.year.trim()) {
        errs.year = "Year / Semester is required.";
      }
    }

    if (ff.phone?.enabled !== false && ff.phone?.required) {
      if (!formData.phone.trim()) {
        errs.phone = "Phone number is required.";
      } else if (!PHONE_REGEX.test(formData.phone.trim())) {
        errs.phone = "Please enter a valid phone number.";
      }
    }

    const customQuestions = ff.customQuestions || [];
    customQuestions.forEach((q) => {
      if (q.required) {
        const val = (formData.customAnswers[q.label] || "").trim();
        if (!val) {
          errs[`q_${q.id || q.label}`] = `"${q.label}" is required.`;
        }
      }
    });

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Submit Registration ── */
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
        collegeEmail:
          formData.collegeEmail.trim().toLowerCase() ||
          formData.email.trim().toLowerCase(),
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

      // Increment count locally so UI updates in real-time
      setRegCounts((prev) => ({
        ...prev,
        [modalEvent.id]: (prev[modalEvent.id] || 0) + 1,
      }));

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
      setSubmitError(
        err.message || "Unable to complete registration. Please try again."
      );
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
    <div className="reg-editorial-page">
      <Helmet>
        <title>Event Registrations | Abhyudaya Club — MPEC Kanpur</title>
        <meta
          name="description"
          content="Discover inspiring conversations, technical workshops, flagship festivals, and competitions at Abhyudaya Club MPEC. Secure your seat today."
        />
        <meta name="robots" content="index,follow" />
      </Helmet>

      {/* ============================================================
          1. EDITORIAL HERO SECTION
         ============================================================ */}
      <section className="reg-editorial-hero" aria-label="Registration Introduction">
        <div className="reg-hero-bg-overlay" aria-hidden="true" />
        <div className="reg-hero-container">
          {/* Eyebrow */}
          <div className="reg-hero-eyebrow-wrap">
            <span className="reg-hero-sparkle" aria-hidden="true">✦</span>
            <span className="reg-hero-eyebrow">ABHYUDAYA PRESENTS</span>
            <span className="reg-hero-sparkle" aria-hidden="true">✦</span>
          </div>

          {/* Main Heading */}
          <h1 className="reg-hero-heading">
            Find Your Next <span className="reg-hero-heading-italic">Experience.</span>
          </h1>

          {/* Subtle Gold Divider */}
          <div className="reg-hero-divider" aria-hidden="true">
            <span className="reg-hero-divider-line" />
            <span className="reg-hero-divider-diamond">◆</span>
            <span className="reg-hero-divider-line" />
          </div>

          {/* Description */}
          <p className="reg-hero-description">
            From inspiring conversations to hands-on workshops, discover the
            experiences that bring our campus together.
          </p>

          {/* Hero Actions */}
          <div className="reg-hero-actions">
            <a href="#events-hub" className="reg-hero-btn reg-hero-btn-primary">
              <span>Explore Events</span>
              <FiArrowDown className="reg-btn-icon-bounce" />
            </a>
            <Link to="/events" className="reg-hero-btn reg-hero-btn-ghost">
              <span>Past Highlights</span>
              <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          2. UPCOMING EXPERIENCES HUB & TOOLBAR
         ============================================================ */}
      <main id="events-hub" className="reg-editorial-main">
        <div className="reg-main-container">
          {/* Search & Category Filter Toolbar */}
          <div className="reg-toolbar">
            {/* Category Filter Pills */}
            <div className="reg-filter-scroll" role="tablist" aria-label="Event Categories">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`reg-filter-pill ${isSelected ? "is-active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input Box */}
            <div className="reg-search-box">
              <FiSearch className="reg-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="reg-search-input"
                placeholder="Search by title, topic, or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search events"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="reg-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search query"
                >
                  <FiX />
                </button>
              )}
            </div>
          </div>

          {/* ============================================================
              3. CONTENT STATES & PRIORITY EVENT SECTIONS
             ============================================================ */}
          {loading ? (
            /* Loading Skeletons */
            <div className="reg-grid-skeleton" aria-label="Loading events">
              {[1, 2, 3].map((n) => (
                <div key={n} className="reg-card-skeleton">
                  <div className="reg-skeleton-media" />
                  <div className="reg-skeleton-body">
                    <div className="reg-skeleton-line reg-skel-tag" />
                    <div className="reg-skeleton-line reg-skel-title" />
                    <div className="reg-skeleton-line reg-skel-desc" />
                    <div className="reg-skeleton-line reg-skel-meta" />
                    <div className="reg-skeleton-line reg-skel-btn" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            /* Error Card */
            <div className="reg-editorial-empty-card" role="alert">
              <div className="reg-empty-icon-wrap">
                <FiAlertCircle className="reg-empty-icon text-amber" />
              </div>
              <h3 className="reg-empty-heading">Unable to Load Events</h3>
              <p className="reg-empty-desc">{error}</p>
              <button
                type="button"
                className="reg-btn-editorial-gold"
                onClick={loadEventsData}
              >
                <FiRefreshCw />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : !hasOpenOrUpcomingEvents && eventsWithStatus.length === 0 ? (
            /* Polished Editorial Empty State (No Open Registrations) */
            <div className="reg-editorial-empty-card" aria-label="No registrations available">
              <div className="reg-calendar-illustration" aria-hidden="true">
                <svg
                  width="120"
                  height="120"
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="reg-calendar-svg"
                >
                  <rect
                    x="20"
                    y="28"
                    width="80"
                    height="76"
                    rx="14"
                    fill="#10182D"
                    fillOpacity="0.08"
                    transform="translate(0, 4)"
                  />
                  <rect
                    x="20"
                    y="24"
                    width="80"
                    height="76"
                    rx="14"
                    fill="#FAF4E9"
                    stroke="#10182D"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M20 38C20 30.268 26.268 24 34 24H86C93.732 24 100 30.268 100 38V44H20V38Z"
                    fill="#10182D"
                  />
                  <rect x="36" y="16" width="6" height="14" rx="3" fill="#E7B544" />
                  <rect x="57" y="16" width="6" height="14" rx="3" fill="#E7B544" />
                  <rect x="78" y="16" width="6" height="14" rx="3" fill="#E7B544" />
                  <circle cx="38" cy="58" r="3.5" fill="#10182D" fillOpacity="0.3" />
                  <circle cx="60" cy="58" r="3.5" fill="#10182D" fillOpacity="0.3" />
                  <circle cx="82" cy="58" r="3.5" fill="#10182D" fillOpacity="0.3" />
                  <circle cx="38" cy="74" r="3.5" fill="#10182D" fillOpacity="0.3" />
                  <path
                    d="M60 67L62.094 71.748L67.243 72.316L63.407 75.787L64.462 80.854L60 78.27L55.538 80.854L56.593 75.787L52.757 72.316L57.906 71.748L60 67Z"
                    fill="#E7B544"
                  />
                  <circle cx="82" cy="74" r="3.5" fill="#10182D" fillOpacity="0.3" />
                  <path
                    d="M96 16L97.5 21L102.5 22.5L97.5 24L96 29L94.5 24L89.5 22.5L94.5 21L96 16Z"
                    fill="#E7B544"
                  />
                </svg>
              </div>

              <h3 className="reg-empty-heading">Something Worth Looking Forward To</h3>
              <p className="reg-empty-desc">
                From technical deep-dives to vibrant cultural gatherings, our next
                series of campus experiences is currently being curated. Check back
                soon or browse our archive of celebrated past events.
              </p>

              <div className="reg-empty-actions">
                <Link to="/events" className="reg-btn-editorial-gold">
                  <span>← Back to Events</span>
                </Link>
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            /* Search / Filter Yielded No Results */
            <div className="reg-editorial-empty-card" role="status">
              <span className="reg-empty-symbol">🔍</span>
              <h3 className="reg-empty-heading">No Matching Experiences</h3>
              <p className="reg-empty-desc">
                We couldn't find any events matching{" "}
                {searchQuery ? <strong>"{searchQuery}"</strong> : "your filter"}{" "}
                in the <em>{selectedCategory}</em> category.
              </p>
              <button
                type="button"
                className="reg-btn-editorial-gold"
                onClick={() => {
                  setSelectedCategory("All Events");
                  setSearchQuery("");
                }}
              >
                <span>Reset All Filters</span>
              </button>
            </div>
          ) : (
            <>
              {/* ============================================================
                  3A. FEATURED SECTION: "REGISTRATIONS OPEN NOW"
                  Prominently displays every event currently accepting registrations
                 ============================================================ */}
              {openFilteredEvents.length > 0 && (
                <section
                  className="reg-featured-open-section"
                  aria-labelledby="featured-open-heading"
                >
                  <div className="reg-featured-section-header">
                    <div className="reg-live-eyebrow">
                      <span className="reg-live-pulse-dot" aria-hidden="true" />
                      <span>ACTIVE REGISTRATIONS</span>
                    </div>
                    <h2
                      id="featured-open-heading"
                      className="reg-featured-section-title"
                    >
                      Registrations Open Now
                    </h2>
                    <p className="reg-featured-section-subtitle">
                      Your next experience is waiting. Explore events and secure your spot.
                    </p>
                  </div>

                  <div
                    className={`reg-featured-grid ${
                      openFilteredEvents.length === 1 ? "single-featured" : ""
                    }`}
                  >
                    {openFilteredEvents.map((event) => {
                      const {
                        statusInfo,
                        maxLimit,
                        remainingSeats,
                        percentFilled,
                      } = event;

                      return (
                        <article
                          key={event.id}
                          className="reg-featured-card"
                          aria-label={`Featured open event: ${event.title}`}
                        >
                          {/* Large Media Banner */}
                          <div className="reg-featured-media">
                            {event.banner || event.image ? (
                              <img
                                src={event.banner || event.image}
                                alt={event.title}
                                className="reg-featured-img"
                                loading="eager"
                              />
                            ) : (
                              <div className="reg-featured-fallback-banner">
                                <span className="reg-featured-fallback-icon">
                                  {event.icon || "🏛️"}
                                </span>
                              </div>
                            )}

                            {/* Prominent High-Contrast Registration Open Badge */}
                            <div className="reg-featured-badge-wrap">
                              <span className="reg-featured-badge-open">
                                <span className="reg-badge-glow-dot" aria-hidden="true" />
                                <span>REGISTRATION OPEN</span>
                              </span>
                            </div>

                            {/* Category Pill */}
                            <span className="reg-featured-category-pill">
                              {event.category || event.subtitle || "Featured Experience"}
                            </span>
                          </div>

                          {/* Featured Card Content */}
                          <div className="reg-featured-body">
                            {/* Metadata */}
                            <div className="reg-featured-meta-row">
                              <div className="reg-featured-meta-pill">
                                <FiCalendar className="reg-meta-icon" />
                                <span>
                                  {event.eventStartDate
                                    ? formatDateTime(event.eventStartDate)
                                    : "Date to be announced"}
                                </span>
                              </div>

                              <div className="reg-featured-meta-pill">
                                {event.meetingLink ? (
                                  <FiVideo className="reg-meta-icon" />
                                ) : (
                                  <FiMapPin className="reg-meta-icon" />
                                )}
                                <span className="reg-meta-venue-truncate">
                                  {event.venue ||
                                    event.location ||
                                    (event.meetingLink ? "Virtual Meeting" : "MPEC Campus")}
                                </span>
                              </div>

                              {event.registrationDeadline && (
                                <div className="reg-featured-meta-pill reg-meta-deadline">
                                  <FiClock className="reg-meta-icon" />
                                  <span>
                                    Closes: {formatDateTime(event.registrationDeadline)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Title & Description */}
                            <h3 className="reg-featured-title">{event.title}</h3>
                            <p className="reg-featured-desc">
                              {event.tagline ||
                                event.shortDescription ||
                                event.description ||
                                "Join this flagship session organized by Abhyudaya Club."}
                            </p>

                            {/* Available Seats Indicator (Only when verified by capacity limit data) */}
                            {maxLimit !== null && (
                              <div className="reg-featured-seats-box">
                                <div className="reg-featured-seats-header">
                                  <span className="reg-seats-label">Available Seats</span>
                                  <span className="reg-seats-count">
                                    <strong>{remainingSeats}</strong> left of {maxLimit}
                                  </span>
                                </div>

                                <div className="reg-featured-seats-track">
                                  <div
                                    className={`reg-featured-seats-fill ${
                                      remainingSeats <= 10 ? "urgent" : "normal"
                                    }`}
                                    style={{ width: `${percentFilled}%` }}
                                  />
                                </div>

                                <span className="reg-seats-subtext">
                                  {remainingSeats <= 10
                                    ? `🔥 High demand: Only ${remainingSeats} seats remaining`
                                    : `⚡ Open for registration`}
                                </span>
                              </div>
                            )}

                            {/* Highly Visible Gold Call To Action Button */}
                            <div className="reg-featured-actions">
                              <button
                                type="button"
                                className="reg-featured-btn-register"
                                onClick={() => openRegistrationModal(event)}
                              >
                                <span>Register Now →</span>
                              </button>

                              <Link
                                to={`/events/${event.slug || event.id}`}
                                className="reg-featured-btn-details"
                              >
                                <span>View Details</span>
                              </Link>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ============================================================
                  3B. GENERAL / ALL EXPERIENCES SECTION
                  Sorted by status priority: Open -> Upcoming -> Closed -> Fully Booked
                 ============================================================ */}
              <section
                className="reg-general-section"
                aria-labelledby="general-experiences-heading"
              >
                <div className="reg-section-header">
                  <div className="reg-section-eyebrow">
                    {openFilteredEvents.length > 0
                      ? "ALL CAMPUS CALENDAR"
                      : "CAMPUS EXPERIENCES"}
                  </div>
                  <h2
                    id="general-experiences-heading"
                    className="reg-section-title"
                  >
                    {openFilteredEvents.length > 0
                      ? "All Experiences & Schedule"
                      : "Upcoming Experiences"}
                  </h2>
                  <p className="reg-section-subtitle">
                    {openFilteredEvents.length > 0
                      ? "Explore the comprehensive event schedule, upcoming sessions, and recent archives."
                      : "Reserve your place in upcoming club gatherings, technical intensives, and flagship competitions."}
                  </p>
                </div>

                <div className="reg-editorial-grid">
                  {filteredEvents.map((event) => {
                    const {
                      statusInfo,
                      maxLimit,
                      remainingSeats,
                      percentFilled,
                    } = event;
                    const isEventOpen = statusInfo.canRegister;

                    return (
                      <article key={event.id} className="reg-event-card">
                        {/* Media Banner */}
                        <div className="reg-card-media">
                          {event.banner || event.image ? (
                            <img
                              src={event.banner || event.image}
                              alt={event.title}
                              className="reg-card-img"
                              loading="lazy"
                            />
                          ) : (
                            <div className="reg-card-fallback-banner">
                              <span className="reg-fallback-icon">
                                {event.icon || "🏛️"}
                              </span>
                            </div>
                          )}

                          {/* Floating Category Pill */}
                          <span className="reg-card-category-pill">
                            {event.category || event.subtitle || "Abhyudaya"}
                          </span>

                          {/* Floating Status Badge */}
                          <span
                            className={`reg-card-status-badge status-${statusInfo.status.toLowerCase()}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>

                        {/* Card Content */}
                        <div className="reg-card-content">
                          {/* Meta: Date & Venue */}
                          <div className="reg-card-meta">
                            <div className="reg-meta-item">
                              <FiCalendar className="reg-meta-icon" />
                              <span>
                                {event.eventStartDate
                                  ? formatDateTime(event.eventStartDate)
                                  : "Date to be announced"}
                              </span>
                            </div>

                            <div className="reg-meta-item">
                              {event.meetingLink ? (
                                <FiVideo className="reg-meta-icon" />
                              ) : (
                                <FiMapPin className="reg-meta-icon" />
                              )}
                              <span className="reg-meta-venue-truncate">
                                {event.venue ||
                                  event.location ||
                                  (event.meetingLink ? "Virtual Meeting" : "MPEC Campus")}
                              </span>
                            </div>

                            {event.registrationDeadline && (
                              <div className="reg-meta-item reg-deadline-item">
                                <FiClock className="reg-meta-icon" />
                                <span>
                                  Deadline: {formatDateTime(event.registrationDeadline)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Title & Tagline */}
                          <h3 className="reg-card-title">{event.title}</h3>
                          {event.tagline ? (
                            <p className="reg-card-tagline">{event.tagline}</p>
                          ) : event.shortDescription || event.description ? (
                            <p className="reg-card-tagline">
                              {event.shortDescription || event.description}
                            </p>
                          ) : null}

                          {/* Available Seats Indicator */}
                          {maxLimit !== null && (
                            <div className="reg-card-capacity-wrap">
                              <div className="reg-capacity-header">
                                <span className="reg-capacity-label">Available Seats</span>
                                <span className="reg-capacity-numbers">
                                  <strong>{remainingSeats}</strong> left of {maxLimit}
                                </span>
                              </div>

                              <div className="reg-capacity-progress-track">
                                <div
                                  className={`reg-capacity-progress-fill ${
                                    remainingSeats === 0
                                      ? "is-full"
                                      : remainingSeats <= 10
                                      ? "is-urgent"
                                      : "is-normal"
                                  }`}
                                  style={{ width: `${percentFilled}%` }}
                                />
                              </div>

                              <div className="reg-capacity-badge-row">
                                {remainingSeats === 0 ? (
                                  <span className="reg-capacity-badge-pill is-full">
                                    Capacity Reached
                                  </span>
                                ) : remainingSeats <= 10 ? (
                                  <span className="reg-capacity-badge-pill is-urgent">
                                    Only {remainingSeats} seats remaining
                                  </span>
                                ) : (
                                  <span className="reg-capacity-badge-pill is-normal">
                                    Open registration active
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Card Footer Actions */}
                          <div className="reg-card-footer">
                            {isEventOpen ? (
                              <button
                                type="button"
                                className="reg-card-btn-primary"
                                onClick={() => openRegistrationModal(event)}
                              >
                                <span>Register Now</span>
                                <FiArrowRight className="reg-btn-arrow" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="reg-card-btn-disabled"
                                disabled
                              >
                                <span>{statusInfo.label}</span>
                              </button>
                            )}

                            <Link
                              to={`/events/${event.slug || event.id}`}
                              className="reg-card-btn-details"
                            >
                              <span>View Details</span>
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* ============================================================
          4. REGISTRATION FORM MODAL & PASS
         ============================================================ */}
      {modalEvent && (
        <div
          className="reg-modal-backdrop"
          onClick={closeRegistrationModal}
          role="presentation"
        >
          <div
            className="reg-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reg-modal-title"
          >
            {/* Modal Header */}
            <div className="reg-modal-header">
              <div className="reg-modal-header-text">
                <span className="reg-modal-eyebrow">ABHYUDAYA REGISTRATION</span>
                <h2 id="reg-modal-title" className="reg-modal-title">
                  {modalEvent.title}
                </h2>
                <div className="reg-modal-meta-row">
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
                className="reg-modal-close-btn"
                onClick={closeRegistrationModal}
                aria-label="Close registration form"
              >
                <FiX />
              </button>
            </div>

            {/* Modal Body: Either Success View or Interactive Form */}
            {registrationResult ? (
              /* Success View */
              <div className="reg-modal-success-view">
                <div className="reg-success-icon-badge" aria-hidden="true">
                  <FiCheckCircle className="reg-success-icon" />
                </div>

                <h3 className="reg-success-heading">Registration Confirmed</h3>
                <p className="reg-success-subtext">
                  Welcome aboard, <strong>{registrationResult.name}</strong>! Your
                  spot for <strong>{registrationResult.eventTitle}</strong> is
                  officially reserved.
                </p>

                {/* Registration ID Pass Card */}
                <div className="reg-pass-card">
                  <span className="reg-pass-label">OFFICIAL REGISTRATION PASS</span>
                  <div className="reg-pass-code-row">
                    <span className="reg-pass-code">
                      {registrationResult.registrationId}
                    </span>
                    <button
                      type="button"
                      className="reg-pass-copy-btn"
                      onClick={handleCopyId}
                      title="Copy Pass ID to clipboard"
                    >
                      {copiedId ? <FiCheck /> : <FiCopy />}
                      <span>{copiedId ? "Copied" : "Copy ID"}</span>
                    </button>
                  </div>
                  <p className="reg-pass-hint">
                    Please take a screenshot or keep note of this pass. You may be
                    prompted to present it at the entry desk.
                  </p>
                </div>

                <div className="reg-success-actions">
                  <button
                    type="button"
                    className="reg-btn-editorial-gold"
                    onClick={closeRegistrationModal}
                  >
                    Done &amp; Close
                  </button>
                </div>
              </div>
            ) : (
              /* Registration Form */
              <form
                onSubmit={handleSubmitRegistration}
                className="reg-modal-form"
                noValidate
              >
                {submitError && (
                  <div className="reg-form-error-banner" role="alert">
                    <FiAlertCircle className="reg-error-icon" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="reg-form-fields-scroll">
                  {/* Full Name */}
                  <div className="reg-form-group">
                    <label htmlFor="reg-name" className="reg-form-label">
                      Full Name <span className="reg-required">*</span>
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      className={`reg-form-input ${
                        formErrors.name ? "has-error" : ""
                      }`}
                      placeholder="e.g. Aryan Sharma"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData((p) => ({ ...p, name: e.target.value }));
                        setFormErrors((p) => ({ ...p, name: "" }));
                      }}
                      disabled={submitting}
                    />
                    {formErrors.name && (
                      <span className="reg-field-error-msg">{formErrors.name}</span>
                    )}
                  </div>

                  {/* Primary Email */}
                  <div className="reg-form-group">
                    <label htmlFor="reg-email" className="reg-form-label">
                      Personal / Verified Email <span className="reg-required">*</span>
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      className={`reg-form-input ${
                        formErrors.email ? "has-error" : ""
                      }`}
                      placeholder="e.g. aryan@gmail.com"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData((p) => ({ ...p, email: e.target.value }));
                        setFormErrors((p) => ({ ...p, email: "" }));
                      }}
                      disabled={submitting}
                    />
                    {formErrors.email && (
                      <span className="reg-field-error-msg">{formErrors.email}</span>
                    )}
                  </div>

                  {/* College Email (if enabled) */}
                  {modalEvent.formFields?.collegeEmail?.enabled !== false && (
                    <div className="reg-form-group">
                      <label htmlFor="reg-college-email" className="reg-form-label">
                        College Email{" "}
                        {modalEvent.formFields?.collegeEmail?.required && (
                          <span className="reg-required">*</span>
                        )}
                      </label>
                      <input
                        id="reg-college-email"
                        type="email"
                        className={`reg-form-input ${
                          formErrors.collegeEmail ? "has-error" : ""
                        }`}
                        placeholder="e.g. aryan.21cs@mpgi.edu.in"
                        value={formData.collegeEmail}
                        onChange={(e) => {
                          setFormData((p) => ({
                            ...p,
                            collegeEmail: e.target.value,
                          }));
                          setFormErrors((p) => ({ ...p, collegeEmail: "" }));
                        }}
                        disabled={submitting}
                      />
                      {formErrors.collegeEmail && (
                        <span className="reg-field-error-msg">
                          {formErrors.collegeEmail}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Roll Number (if enabled) */}
                  {modalEvent.formFields?.rollNumber?.enabled !== false && (
                    <div className="reg-form-group">
                      <label htmlFor="reg-roll" className="reg-form-label">
                        College Roll Number / Student ID{" "}
                        {modalEvent.formFields?.rollNumber?.required && (
                          <span className="reg-required">*</span>
                        )}
                      </label>
                      <input
                        id="reg-roll"
                        type="text"
                        className={`reg-form-input ${
                          formErrors.rollNumber ? "has-error" : ""
                        }`}
                        placeholder="e.g. 2101640100045"
                        value={formData.rollNumber}
                        onChange={(e) => {
                          setFormData((p) => ({
                            ...p,
                            rollNumber: e.target.value,
                          }));
                          setFormErrors((p) => ({ ...p, rollNumber: "" }));
                        }}
                        disabled={submitting}
                      />
                      {formErrors.rollNumber && (
                        <span className="reg-field-error-msg">
                          {formErrors.rollNumber}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Department & Year (if enabled) */}
                  {modalEvent.formFields?.departmentYear?.enabled !== false && (
                    <div className="reg-form-row">
                      <div className="reg-form-group">
                        <label htmlFor="reg-dept" className="reg-form-label">
                          Department / Branch{" "}
                          {modalEvent.formFields?.departmentYear?.required && (
                            <span className="reg-required">*</span>
                          )}
                        </label>
                        <input
                          id="reg-dept"
                          type="text"
                          className={`reg-form-input ${
                            formErrors.department ? "has-error" : ""
                          }`}
                          placeholder="e.g. CSE, IT, ME, ECE"
                          value={formData.department}
                          onChange={(e) => {
                            setFormData((p) => ({
                              ...p,
                              department: e.target.value,
                            }));
                            setFormErrors((p) => ({ ...p, department: "" }));
                          }}
                          disabled={submitting}
                        />
                        {formErrors.department && (
                          <span className="reg-field-error-msg">
                            {formErrors.department}
                          </span>
                        )}
                      </div>

                      <div className="reg-form-group">
                        <label htmlFor="reg-year" className="reg-form-label">
                          Year / Semester{" "}
                          {modalEvent.formFields?.departmentYear?.required && (
                            <span className="reg-required">*</span>
                          )}
                        </label>
                        <select
                          id="reg-year"
                          className={`reg-form-select ${
                            formErrors.year ? "has-error" : ""
                          }`}
                          value={formData.year}
                          onChange={(e) => {
                            setFormData((p) => ({ ...p, year: e.target.value }));
                            setFormErrors((p) => ({ ...p, year: "" }));
                          }}
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
                        {formErrors.year && (
                          <span className="reg-field-error-msg">
                            {formErrors.year}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Phone Number (if enabled) */}
                  {modalEvent.formFields?.phone?.enabled !== false && (
                    <div className="reg-form-group">
                      <label htmlFor="reg-phone" className="reg-form-label">
                        WhatsApp / Contact Number{" "}
                        {modalEvent.formFields?.phone?.required && (
                          <span className="reg-required">*</span>
                        )}
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        className={`reg-form-input ${
                          formErrors.phone ? "has-error" : ""
                        }`}
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, phone: e.target.value }));
                          setFormErrors((p) => ({ ...p, phone: "" }));
                        }}
                        disabled={submitting}
                      />
                      {formErrors.phone && (
                        <span className="reg-field-error-msg">
                          {formErrors.phone}
                        </span>
                      )}
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
                      <div key={q.id || q.label} className="reg-form-group">
                        <label htmlFor={qKey} className="reg-form-label">
                          {q.label}{" "}
                          {q.required && <span className="reg-required">*</span>}
                        </label>

                        {q.type === "select" ? (
                          <select
                            id={qKey}
                            className={`reg-form-select ${
                              formErrors[qKey] ? "has-error" : ""
                            }`}
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({
                                ...p,
                                customAnswers: {
                                  ...p.customAnswers,
                                  [q.label]: val,
                                },
                              }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
                            disabled={submitting}
                          >
                            <option value="">Select an option</option>
                            {opts.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : q.type === "textarea" ? (
                          <textarea
                            id={qKey}
                            rows={3}
                            className={`reg-form-textarea ${
                              formErrors[qKey] ? "has-error" : ""
                            }`}
                            placeholder="Type your response..."
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({
                                ...p,
                                customAnswers: {
                                  ...p.customAnswers,
                                  [q.label]: val,
                                },
                              }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
                            disabled={submitting}
                          />
                        ) : (
                          <input
                            id={qKey}
                            type="text"
                            className={`reg-form-input ${
                              formErrors[qKey] ? "has-error" : ""
                            }`}
                            placeholder="Your answer"
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({
                                ...p,
                                customAnswers: {
                                  ...p.customAnswers,
                                  [q.label]: val,
                                },
                              }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
                            disabled={submitting}
                          />
                        )}

                        {formErrors[qKey] && (
                          <span className="reg-field-error-msg">
                            {formErrors[qKey]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Modal Footer Actions */}
                <div className="reg-modal-footer">
                  <button
                    type="button"
                    className="reg-modal-btn-cancel"
                    onClick={closeRegistrationModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="reg-modal-btn-submit"
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
