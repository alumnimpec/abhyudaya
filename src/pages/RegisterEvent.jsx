import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  FiCalendar,
  FiMapPin,
  FiVideo,
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiCopy,
  FiCheck,
  FiX,
  FiArrowRight,
  FiRefreshCw,
} from "react-icons/fi";
import PageHero from "../components/PageHero.jsx";
import { getEventsPage } from "../Firebase/eventService.js";
import {
  countRegistrations,
  createRegistration,
} from "../Firebase/registrationService.js";
import "./RegisterEvent.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s-]{7,15}$/;

function formatDateTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
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
    return { status: "CLOSED", label: "Registrations Closed", canRegister: false };
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

export default function RegisterEvent() {
  const [events, setEvents] = useState([]);
  const [regCounts, setRegCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  /* ── Load Published Events and Realtime Counts ── */
  const loadEventsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getEventsPage({ pageSize: 30, onlyPublished: true });
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

  /* ── Open Events count (for empty state decision) ── */
  const hasOpenEvents = useMemo(() => {
    return eventsWithStatus.some((e) => e.statusInfo.canRegister);
  }, [eventsWithStatus]);

  /* ── Open Registration Modal for an Event ── */
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

    // Full name is always required
    if (!formData.name.trim()) {
      errs.name = "Full name is required.";
    }

    // Email is always required
    if (!formData.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      errs.email = "Please enter a valid email address.";
    }

    // College Email (if enabled & required)
    if (ff.collegeEmail?.enabled !== false && ff.collegeEmail?.required) {
      if (!formData.collegeEmail.trim()) {
        errs.collegeEmail = "College email is required.";
      } else if (!EMAIL_REGEX.test(formData.collegeEmail.trim())) {
        errs.collegeEmail = "Please enter a valid college email address.";
      }
    }

    // Roll Number (if enabled & required)
    if (ff.rollNumber?.enabled !== false && ff.rollNumber?.required) {
      if (!formData.rollNumber.trim()) {
        errs.rollNumber = "Roll number / Student ID is required.";
      }
    }

    // Department & Year (if enabled & required)
    if (ff.departmentYear?.enabled !== false && ff.departmentYear?.required) {
      if (!formData.department.trim()) {
        errs.department = "Department / Branch is required.";
      }
      if (!formData.year.trim()) {
        errs.year = "Year / Semester is required.";
      }
    }

    // Phone Number (if enabled & required)
    if (ff.phone?.enabled !== false && ff.phone?.required) {
      if (!formData.phone.trim()) {
        errs.phone = "Phone number is required.";
      } else if (!PHONE_REGEX.test(formData.phone.trim())) {
        errs.phone = "Please enter a valid phone number (10 digits).";
      }
    }

    // Custom Questions Validation
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
    <>
      <Helmet>
        <title>Open Event Registrations | Abhyudaya Club</title>
        <meta
          name="description"
          content="Explore and register for upcoming college events, workshops, hackathons, and cultural fests at Abhyudaya Club MPEC."
        />
        <meta name="robots" content="index,follow" />
      </Helmet>

      <PageHero
        eyebrow="Get Involved"
        title="Open Event Registrations"
        lede="Explore upcoming flagship fests, technical workshops, and competitions. Register online to secure your seat."
      />

      <div className="pub-reg-container">
        {loading ? (
          <div className="pub-reg-loading">
            <div className="pub-reg-spinner" />
            <p>Loading open registrations...</p>
          </div>
        ) : error ? (
          <div className="pub-reg-empty-card">
            <span className="pub-reg-empty-icon">⚠️</span>
            <h2>Unable to load events</h2>
            <p>{error}</p>
            <button
              type="button"
              className="pub-reg-btn pub-reg-btn-primary"
              onClick={loadEventsData}
            >
              <FiRefreshCw /> <span>Retry Loading</span>
            </button>
          </div>
        ) : !hasOpenEvents ? (
          <div className="pub-reg-empty-card">
            <span className="pub-reg-empty-icon">📅</span>
            <h2>No Open Registrations</h2>
            <p>
              There are currently no events accepting new registrations. Upcoming events will be published here as soon as registrations open.
            </p>
            <Link to="/events" className="pub-reg-btn pub-reg-btn-primary">
              ← Back to Events
            </Link>
          </div>
        ) : (
          <div className="pub-reg-events-grid">
            {eventsWithStatus.map((event) => {
              const { statusInfo, count, maxLimit, remainingSeats, percentFilled } = event;
              const isEventOpen = statusInfo.canRegister;

              return (
                <div key={event.id} className="pub-event-card">
                  {/* Banner Header */}
                  <div className="pub-card-banner">
                    {event.banner || event.image ? (
                      <img
                        src={event.banner || event.image}
                        alt={event.title}
                        className="pub-card-img"
                        loading="lazy"
                      />
                    ) : (
                      <div className="pub-card-img-fallback">
                        <span>{event.icon || "📅"}</span>
                      </div>
                    )}
                    <div className="pub-card-badges">
                      <span className="pub-category-badge">
                        {event.category || event.subtitle || "Club Event"}
                      </span>
                      <span
                        className={`pub-status-badge ${
                          isEventOpen
                            ? statusInfo.status === "CLOSING_SOON"
                              ? "status-closing"
                              : "status-open"
                            : "status-closed"
                        }`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="pub-card-body">
                    <h3 className="pub-card-title">{event.title}</h3>
                    {event.tagline && <p className="pub-card-tagline">{event.tagline}</p>}

                    {/* Metadata Items */}
                    <div className="pub-card-meta">
                      <div className="pub-meta-row">
                        <FiCalendar className="pub-meta-icon" />
                        <span>
                          {event.eventStartDate
                            ? formatDateTime(event.eventStartDate)
                            : "Date to be announced"}
                        </span>
                      </div>

                      <div className="pub-meta-row">
                        {event.meetingLink ? (
                          <FiVideo className="pub-meta-icon" />
                        ) : (
                          <FiMapPin className="pub-meta-icon" />
                        )}
                        <span>
                          {event.venue ||
                            event.location ||
                            (event.meetingLink ? "Online / Virtual Meet" : "Venue to be announced")}
                        </span>
                      </div>

                      {event.registrationDeadline && (
                        <div className="pub-meta-row deadline-highlight">
                          <FiClock className="pub-meta-icon" />
                          <span>
                            Closes: {formatDateTime(event.registrationDeadline)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Seats & Capacity Section */}
                    <div className="pub-capacity-box">
                      <div className="pub-capacity-header">
                        <span className="pub-capacity-label">Available Seats</span>
                        <span className="pub-capacity-ratio">
                          {maxLimit !== null ? (
                            <>
                              <strong>{remainingSeats}</strong> left of {maxLimit}
                            </>
                          ) : (
                            <span className="text-emerald">Unlimited</span>
                          )}
                        </span>
                      </div>

                      {maxLimit !== null && (
                        <div className="pub-progress-track">
                          <div
                            className={`pub-progress-fill ${
                              percentFilled >= 100
                                ? "fill-red"
                                : percentFilled >= 75
                                ? "fill-amber"
                                : "fill-emerald"
                            }`}
                            style={{ width: `${percentFilled}%` }}
                          />
                        </div>
                      )}

                      <div className="pub-seat-alert">
                        {maxLimit !== null ? (
                          remainingSeats === 0 ? (
                            <span className="alert-full">❌ Capacity reached</span>
                          ) : remainingSeats <= 10 ? (
                            <span className="alert-urgent">🔥 Hurry! Only {remainingSeats} seats left!</span>
                          ) : (
                            <span className="alert-available">⚡ {remainingSeats} seats available</span>
                          )
                        ) : (
                          <span className="alert-available">✨ Open to all participants</span>
                        )}
                      </div>
                    </div>

                    {/* Register Action Button */}
                    <div className="pub-card-actions">
                      {isEventOpen ? (
                        <button
                          type="button"
                          className="pub-register-btn"
                          onClick={() => openRegistrationModal(event)}
                        >
                          <span>Register Now</span>
                          <FiArrowRight />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="pub-register-btn disabled"
                          disabled
                        >
                          <span>{statusInfo.label}</span>
                        </button>
                      )}

                      <Link
                        to={`/events/${event.slug || event.id}`}
                        className="pub-details-link"
                      >
                        Event Details
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================
          REGISTRATION MODAL
         ============================================================ */}
      {modalEvent && (
        <div className="pub-modal-backdrop" onClick={closeRegistrationModal}>
          <div
            className="pub-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reg-modal-title"
          >
            <div className="pub-modal-header">
              <div>
                <span className="pub-modal-eyebrow">Event Registration</span>
                <h2 id="reg-modal-title">{modalEvent.title}</h2>
                <div className="pub-modal-submeta">
                  {modalEvent.eventStartDate && (
                    <span>📅 {formatDateTime(modalEvent.eventStartDate)}</span>
                  )}
                  {modalEvent.venue && <span>📍 {modalEvent.venue}</span>}
                </div>
              </div>
              <button
                type="button"
                className="pub-modal-close-btn"
                onClick={closeRegistrationModal}
                aria-label="Close form"
              >
                <FiX />
              </button>
            </div>

            {registrationResult ? (
              /* Success View */
              <div className="pub-success-view">
                <div className="pub-success-icon-wrap">
                  <FiCheckCircle className="pub-success-icon" />
                </div>
                <h3>Registration Successful!</h3>
                <p className="pub-success-desc">
                  Congratulations <strong>{registrationResult.name}</strong>, your seat for{" "}
                  <strong>{registrationResult.eventTitle}</strong> is confirmed.
                </p>

                <div className="pub-reg-id-card">
                  <span className="id-label">Your Registration Pass ID</span>
                  <div className="id-code-row">
                    <span className="id-code">{registrationResult.registrationId}</span>
                    <button
                      type="button"
                      className="pub-copy-btn"
                      onClick={handleCopyId}
                      title="Copy Registration ID"
                    >
                      {copiedId ? <FiCheck /> : <FiCopy />}
                      <span>{copiedId ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="id-hint">
                    Please take a screenshot or note this ID. You may be asked to show it at the event venue.
                  </p>
                </div>

                <div className="pub-success-actions">
                  <button
                    type="button"
                    className="pub-reg-btn pub-reg-btn-primary"
                    onClick={closeRegistrationModal}
                  >
                    Done &amp; Close
                  </button>
                </div>
              </div>
            ) : (
              /* Registration Form */
              <form onSubmit={handleSubmitRegistration} className="pub-modal-form" noValidate>
                {submitError && (
                  <div className="pub-form-error-banner">
                    <FiAlertCircle />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="pub-form-body">
                  {/* Full Name */}
                  <div className="pub-form-group">
                    <label htmlFor="reg-name">
                      Full Name <span className="req">*</span>
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      className={`pub-input ${formErrors.name ? "has-error" : ""}`}
                      placeholder="e.g. Aryan Sharma"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData((p) => ({ ...p, name: e.target.value }));
                        setFormErrors((p) => ({ ...p, name: "" }));
                      }}
                    />
                    {formErrors.name && (
                      <span className="pub-err-msg">{formErrors.name}</span>
                    )}
                  </div>

                  {/* Primary Email */}
                  <div className="pub-form-group">
                    <label htmlFor="reg-email">
                      Personal / Verified Email <span className="req">*</span>
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      className={`pub-input ${formErrors.email ? "has-error" : ""}`}
                      placeholder="e.g. aryan@gmail.com"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData((p) => ({ ...p, email: e.target.value }));
                        setFormErrors((p) => ({ ...p, email: "" }));
                      }}
                    />
                    {formErrors.email && (
                      <span className="pub-err-msg">{formErrors.email}</span>
                    )}
                  </div>

                  {/* College Email (if enabled) */}
                  {modalEvent.formFields?.collegeEmail?.enabled !== false && (
                    <div className="pub-form-group">
                      <label htmlFor="reg-college-email">
                        College Email{" "}
                        {modalEvent.formFields?.collegeEmail?.required && (
                          <span className="req">*</span>
                        )}
                      </label>
                      <input
                        id="reg-college-email"
                        type="email"
                        className={`pub-input ${formErrors.collegeEmail ? "has-error" : ""}`}
                        placeholder="e.g. aryan.21cs@mpgi.edu.in"
                        value={formData.collegeEmail}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, collegeEmail: e.target.value }));
                          setFormErrors((p) => ({ ...p, collegeEmail: "" }));
                        }}
                      />
                      {formErrors.collegeEmail && (
                        <span className="pub-err-msg">{formErrors.collegeEmail}</span>
                      )}
                    </div>
                  )}

                  {/* Roll Number (if enabled) */}
                  {modalEvent.formFields?.rollNumber?.enabled !== false && (
                    <div className="pub-form-group">
                      <label htmlFor="reg-roll">
                        College Roll Number / Student ID{" "}
                        {modalEvent.formFields?.rollNumber?.required && (
                          <span className="req">*</span>
                        )}
                      </label>
                      <input
                        id="reg-roll"
                        type="text"
                        className={`pub-input ${formErrors.rollNumber ? "has-error" : ""}`}
                        placeholder="e.g. 2101640100045"
                        value={formData.rollNumber}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, rollNumber: e.target.value }));
                          setFormErrors((p) => ({ ...p, rollNumber: "" }));
                        }}
                      />
                      {formErrors.rollNumber && (
                        <span className="pub-err-msg">{formErrors.rollNumber}</span>
                      )}
                    </div>
                  )}

                  {/* Department & Year (if enabled) */}
                  {modalEvent.formFields?.departmentYear?.enabled !== false && (
                    <div className="pub-form-row">
                      <div className="pub-form-group">
                        <label htmlFor="reg-dept">
                          Department / Branch{" "}
                          {modalEvent.formFields?.departmentYear?.required && (
                            <span className="req">*</span>
                          )}
                        </label>
                        <input
                          id="reg-dept"
                          type="text"
                          className={`pub-input ${formErrors.department ? "has-error" : ""}`}
                          placeholder="e.g. CSE, IT, ME, ECE"
                          value={formData.department}
                          onChange={(e) => {
                            setFormData((p) => ({ ...p, department: e.target.value }));
                            setFormErrors((p) => ({ ...p, department: "" }));
                          }}
                        />
                        {formErrors.department && (
                          <span className="pub-err-msg">{formErrors.department}</span>
                        )}
                      </div>

                      <div className="pub-form-group">
                        <label htmlFor="reg-year">
                          Year / Semester{" "}
                          {modalEvent.formFields?.departmentYear?.required && (
                            <span className="req">*</span>
                          )}
                        </label>
                        <select
                          id="reg-year"
                          className={`pub-select ${formErrors.year ? "has-error" : ""}`}
                          value={formData.year}
                          onChange={(e) => {
                            setFormData((p) => ({ ...p, year: e.target.value }));
                            setFormErrors((p) => ({ ...p, year: "" }));
                          }}
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
                          <span className="pub-err-msg">{formErrors.year}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Phone Number (if enabled) */}
                  {modalEvent.formFields?.phone?.enabled !== false && (
                    <div className="pub-form-group">
                      <label htmlFor="reg-phone">
                        WhatsApp / Phone Number{" "}
                        {modalEvent.formFields?.phone?.required && (
                          <span className="req">*</span>
                        )}
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        className={`pub-input ${formErrors.phone ? "has-error" : ""}`}
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, phone: e.target.value }));
                          setFormErrors((p) => ({ ...p, phone: "" }));
                        }}
                      />
                      {formErrors.phone && (
                        <span className="pub-err-msg">{formErrors.phone}</span>
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
                      <div key={q.id || q.label} className="pub-form-group">
                        <label htmlFor={qKey}>
                          {q.label} {q.required && <span className="req">*</span>}
                        </label>

                        {q.type === "select" ? (
                          <select
                            id={qKey}
                            className={`pub-select ${formErrors[qKey] ? "has-error" : ""}`}
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({
                                ...p,
                                customAnswers: { ...p.customAnswers, [q.label]: val },
                              }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
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
                            className={`pub-input ${formErrors[qKey] ? "has-error" : ""}`}
                            placeholder="Type your response..."
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({
                                ...p,
                                customAnswers: { ...p.customAnswers, [q.label]: val },
                              }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
                          />
                        ) : (
                          <input
                            id={qKey}
                            type="text"
                            className={`pub-input ${formErrors[qKey] ? "has-error" : ""}`}
                            placeholder="Your answer"
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((p) => ({
                                ...p,
                                customAnswers: { ...p.customAnswers, [q.label]: val },
                              }));
                              setFormErrors((p) => ({ ...p, [qKey]: "" }));
                            }}
                          />
                        )}

                        {formErrors[qKey] && (
                          <span className="pub-err-msg">{formErrors[qKey]}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pub-modal-footer">
                  <button
                    type="button"
                    className="pub-btn-cancel"
                    onClick={closeRegistrationModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="pub-btn-submit"
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
    </>
  );
}
