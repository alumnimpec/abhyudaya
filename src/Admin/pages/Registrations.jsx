import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  FiGrid,
  FiCalendar,
  FiUsers,
  FiCheckCircle,
  FiXCircle,
  FiEdit2,
  FiTrash2,
  FiDownload,
  FiSearch,
  FiFilter,
  FiExternalLink,
  FiLock,
  FiUnlock,
  FiEye,
  FiArchive,
  FiRefreshCw,
  FiPlus,
  FiClock,
  FiMapPin,
  FiVideo,
  FiMail,
  FiPhone,
  FiUser,
  FiX,
  FiAlertTriangle,
} from "react-icons/fi";
import {
  getAllRegistrations,
  updateRegistrationStatus,
  deleteRegistration,
  countRegistrations,
} from "../../Firebase/registrationService";
import {
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadEventImage,
  toggleEventRegistration,
  setEventStatus,
} from "../../Firebase/eventService";
import { formatDateTime } from "../../utils/registrationStatus";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { useToast } from "../components/Toast";

import "./style/admin.css";
import "./Registrations.css";

/* ── Status badges & labels ── */
const STATUS_OPTIONS = ["registered", "confirmed", "pending", "cancelled"];

const STATUS_LABELS = {
  registered: "Registered",
  confirmed: "Confirmed",
  pending: "Pending",
  cancelled: "Cancelled",
  free: "Free",
  paid: "Paid",
};

const STATUS_COLORS = {
  registered: "#3b82f6",
  confirmed: "#22c55e",
  pending: "#f59e0b",
  cancelled: "#ef4444",
  free: "#8b5cf6",
  paid: "#0ea5e9",
};

function StatusBadge({ status }) {
  const s = (status || "registered").toLowerCase();
  const color = STATUS_COLORS[s] || "#6b7280";
  const label = STATUS_LABELS[s] || status || "—";
  return (
    <span
      className="reg-status-badge"
      style={{ background: `${color}15`, color, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "Not set";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isRegistrationCurrentlyOpen(event, count) {
  if (event.status !== "Published") return false;
  if (event.registrationOpen !== true) return false;
  const now = new Date();
  if (event.registrationStartDate) {
    const start = new Date(event.registrationStartDate);
    if (!isNaN(start.getTime()) && now < start) return false;
  }
  if (event.registrationDeadline) {
    const deadline = new Date(event.registrationDeadline);
    if (!isNaN(deadline.getTime()) && now > deadline) return false;
  }
  if (event.maxRegistrations && count >= Number(event.maxRegistrations)) {
    return false;
  }
  return true;
}

export default function Registrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEventFilter = searchParams.get("event") || "";
  const initialTab = searchParams.get("tab") === "participants" ? "participants" : "events";

  const toast = useToast();

  /* ── Main Data ── */
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [regCounts, setRegCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  /* ── Tab View: 'events' | 'participants' ── */
  const [activeTab, setActiveTab] = useState(initialTab);

  /* ── Event Filters ── */
  const [eventSearch, setEventSearch] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState("All");

  /* ── Participant Filters ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState(initialEventFilter);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  /* ── Participant Detail Modal ── */
  const [selectedReg, setSelectedReg] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  /* ── Deletion Modals ── */
  const [deleteTargetReg, setDeleteTargetReg] = useState(null);
  const [deletingReg, setDeletingReg] = useState(false);

  const [deleteTargetEvent, setDeleteTargetEvent] = useState(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  /* ── Create / Edit Event Form Modal ── */
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventFormSaving, setEventFormSaving] = useState(false);
  const [eventFormData, setEventFormData] = useState({
    title: "",
    subtitle: "Special Event",
    category: "Special Event",
    tagline: "",
    shortDescription: "",
    longDescription: "",
    venue: "",
    location: "Kanpur, UP",
    meetingLink: "",
    eventStartDate: "",
    eventEndDate: "",
    registrationStartDate: "",
    registrationDeadline: "",
    maxRegistrations: "",
    status: "Published",
    registrationOpen: true,
    coordinatorName: "",
    coordinatorEmail: "",
    coordinatorPhone: "",
    banner: "",
    formFields: {
      collegeEmail: { enabled: true, required: false },
      rollNumber: { enabled: true, required: false },
      departmentYear: { enabled: true, required: false },
      phone: { enabled: true, required: true },
      customQuestions: [],
    },
  });

  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);

  /* ── Load Data ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [regs, evts] = await Promise.all([
        getAllRegistrations({ sortOrder }),
        getAllEvents(),
      ]);
      setRegistrations(regs);
      setEvents(evts);

      // Compute registration counts
      const counts = {};
      regs.forEach((r) => {
        if (r.eventId && r.registrationStatus !== "cancelled") {
          counts[r.eventId] = (counts[r.eventId] || 0) + 1;
        }
      });
      setRegCounts(counts);
    } catch (err) {
      console.error("Failed to load registration hub data:", err);
      setError(true);
      toast.error("Unable to load registration data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortOrder, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  /* ── Event Map ── */
  const eventMap = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [events]);

  /* ── Stats computation ── */
  const stats = useMemo(() => {
    const totalEvents = events.filter((e) => e.status !== "Trashed").length;
    let openCount = 0;
    let closedCount = 0;

    events.forEach((ev) => {
      if (ev.status === "Trashed") return;
      const c = regCounts[ev.id] || 0;
      if (isRegistrationCurrentlyOpen(ev, c)) {
        openCount++;
      } else {
        closedCount++;
      }
    });

    const totalParticipants = registrations.filter(
      (r) => r.registrationStatus !== "cancelled"
    ).length;

    return {
      totalEvents,
      openRegistrations: openCount,
      totalParticipants,
      closedEvents: closedCount,
    };
  }, [events, registrations, regCounts]);

  /* ── Filtered Events ── */
  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return events.filter((ev) => {
      if (ev.status === "Trashed") return false;

      // Status filter
      const count = regCounts[ev.id] || 0;
      const isOpen = isRegistrationCurrentlyOpen(ev, count);

      if (eventStatusFilter === "Open" && !isOpen) return false;
      if (eventStatusFilter === "Closed" && isOpen) return false;
      if (eventStatusFilter === "Published" && ev.status !== "Published") return false;
      if (eventStatusFilter === "Draft" && ev.status !== "Draft") return false;

      if (!q) return true;
      return (
        (ev.title || "").toLowerCase().includes(q) ||
        (ev.category || "").toLowerCase().includes(q) ||
        (ev.venue || "").toLowerCase().includes(q) ||
        (ev.location || "").toLowerCase().includes(q)
      );
    });
  }, [events, eventSearch, eventStatusFilter, regCounts]);

  /* ── Filtered Participants ── */
  const filteredRegistrations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return registrations.filter((r) => {
      if (eventFilter && r.eventId !== eventFilter) return false;
      const rs = (r.registrationStatus || r.paymentStatus || "registered").toLowerCase();
      if (statusFilter && rs !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.collegeEmail || "").toLowerCase().includes(q) ||
        (r.rollNumber || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q) ||
        (r.registrationId || "").toLowerCase().includes(q)
      );
    });
  }, [registrations, searchQuery, eventFilter, statusFilter]);

  /* ── Quick Actions on Event ── */
  const handleToggleRegistration = async (event, e) => {
    e?.stopPropagation();
    const newStatus = !event.registrationOpen;
    try {
      await toggleEventRegistration(event.id, newStatus);
      setEvents((prev) =>
        prev.map((item) =>
          item.id === event.id ? { ...item, registrationOpen: newStatus } : item
        )
      );
      toast.success(
        newStatus
          ? `🟢 Registrations opened for "${event.title}"!`
          : `🔴 Registrations closed for "${event.title}".`
      );
    } catch (err) {
      console.error("Toggle registration failed:", err);
      toast.error("Failed to toggle registration state.");
    }
  };

  const handleTogglePublish = async (event, e) => {
    e?.stopPropagation();
    const newStatus = event.status === "Published" ? "Draft" : "Published";
    try {
      await setEventStatus(event.id, newStatus);
      setEvents((prev) =>
        prev.map((item) =>
          item.id === event.id ? { ...item, status: newStatus } : item
        )
      );
      toast.success(
        newStatus === "Published"
          ? `🚀 Event published successfully!`
          : `💾 Event moved to Drafts.`
      );
    } catch (err) {
      console.error("Toggle publish failed:", err);
      toast.error("Failed to change event publication status.");
    }
  };

  /* ── Jump to Participants View for Event ── */
  const handleViewParticipants = (eventId) => {
    setEventFilter(eventId);
    setActiveTab("participants");
    setSearchParams({ tab: "participants", event: eventId });
  };

  /* ── Open Event Form Modal ── */
  const openCreateEventModal = () => {
    setEditingEvent(null);
    setBannerFile(null);
    setBannerPreview("");
    setEventFormData({
      title: "",
      subtitle: "Special Event",
      category: "Special Event",
      tagline: "",
      shortDescription: "",
      longDescription: "",
      venue: "",
      location: "Kanpur, UP",
      meetingLink: "",
      eventStartDate: "",
      eventEndDate: "",
      registrationStartDate: "",
      registrationDeadline: "",
      maxRegistrations: "",
      status: "Published",
      registrationOpen: true,
      coordinatorName: "",
      coordinatorEmail: "",
      coordinatorPhone: "",
      banner: "",
      formFields: {
        collegeEmail: { enabled: true, required: false },
        rollNumber: { enabled: true, required: false },
        departmentYear: { enabled: true, required: false },
        phone: { enabled: true, required: true },
        customQuestions: [],
      },
    });
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (event, e) => {
    e?.stopPropagation();
    setEditingEvent(event);
    setBannerFile(null);
    setBannerPreview(event.banner || event.image || "");
    setEventFormData({
      title: event.title || "",
      subtitle: event.subtitle || event.category || "Special Event",
      category: event.category || event.subtitle || "Special Event",
      tagline: event.tagline || "",
      shortDescription: event.shortDescription || event.description || "",
      longDescription: event.longDescription || "",
      venue: event.venue || "",
      location: event.location || "Kanpur, UP",
      meetingLink: event.meetingLink || "",
      eventStartDate: event.eventStartDate || "",
      eventEndDate: event.eventEndDate || "",
      registrationStartDate: event.registrationStartDate || "",
      registrationDeadline: event.registrationDeadline || "",
      maxRegistrations: event.maxRegistrations ? String(event.maxRegistrations) : "",
      status: event.status || "Published",
      registrationOpen: Boolean(event.registrationOpen),
      coordinatorName: event.coordinatorName || "",
      coordinatorEmail: event.coordinatorEmail || "",
      coordinatorPhone: event.coordinatorPhone || "",
      banner: event.banner || event.image || "",
      formFields: event.formFields || {
        collegeEmail: { enabled: true, required: false },
        rollNumber: { enabled: true, required: false },
        departmentYear: { enabled: true, required: false },
        phone: { enabled: true, required: true },
        customQuestions: [],
      },
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventFormData.title.trim()) {
      toast.error("Please enter an event title.");
      return;
    }

    setEventFormSaving(true);
    try {
      let finalBanner = eventFormData.banner;
      if (bannerFile) {
        setUploadingBanner(true);
        finalBanner = await uploadEventImage(bannerFile);
        setUploadingBanner(false);
      }

      const payload = {
        ...eventFormData,
        banner: finalBanner,
        image: finalBanner,
        thumbnail: finalBanner,
        maxRegistrations: eventFormData.maxRegistrations
          ? Number(eventFormData.maxRegistrations)
          : null,
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
        toast.success("✅ Event registration details updated!");
      } else {
        await createEvent(payload);
        toast.success("🚀 New event registration form created!");
      }

      setIsEventModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Save event failed:", err);
      toast.error(err.message || "Failed to save event.");
    } finally {
      setEventFormSaving(false);
      setUploadingBanner(false);
    }
  };

  /* ── Delete / Archive Event ── */
  const handleArchiveOrDeleteEvent = async (permanent = false) => {
    if (!deleteTargetEvent) return;
    setDeletingEvent(true);
    try {
      if (permanent) {
        await deleteEvent(deleteTargetEvent.id);
        setEvents((prev) => prev.filter((e) => e.id !== deleteTargetEvent.id));
        toast.success(`Event "${deleteTargetEvent.title}" permanently deleted.`);
      } else {
        await setEventStatus(deleteTargetEvent.id, "Draft");
        setEvents((prev) =>
          prev.map((e) =>
            e.id === deleteTargetEvent.id ? { ...e, status: "Draft", registrationOpen: false } : e
          )
        );
        toast.info(`Event "${deleteTargetEvent.title}" archived as Draft.`);
      }
      setDeleteTargetEvent(null);
    } catch (err) {
      console.error("Delete event failed:", err);
      toast.error("Failed to update or delete event.");
    } finally {
      setDeletingEvent(false);
    }
  };

  /* ── Delete Participant ── */
  const handleDeleteParticipant = async () => {
    if (!deleteTargetReg) return;
    setDeletingReg(true);
    try {
      await deleteRegistration(deleteTargetReg.id);
      setRegistrations((prev) => prev.filter((r) => r.id !== deleteTargetReg.id));
      if (selectedReg?.id === deleteTargetReg.id) setSelectedReg(null);
      setDeleteTargetReg(null);
      toast.success("Registration record removed.");
    } catch (err) {
      console.error("Delete registration failed:", err);
      toast.error("Failed to delete registration.");
    } finally {
      setDeletingReg(false);
    }
  };

  /* ── Update Registration Status ── */
  const handleUpdateParticipantStatus = async () => {
    if (!selectedReg || !newStatus) return;
    setUpdatingStatus(true);
    try {
      await updateRegistrationStatus(selectedReg.id, newStatus);
      setRegistrations((prev) =>
        prev.map((r) => (r.id === selectedReg.id ? { ...r, registrationStatus: newStatus } : r))
      );
      setSelectedReg((prev) => ({ ...prev, registrationStatus: newStatus }));
      toast.success("Status updated to " + STATUS_LABELS[newStatus]);
    } catch (err) {
      console.error("Failed to update registration status:", err);
      toast.error("Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ── CSV Export ── */
  const handleExportCSV = (specificEventId = null) => {
    const targetRegs = specificEventId
      ? registrations.filter((r) => r.eventId === specificEventId)
      : filteredRegistrations;

    if (targetRegs.length === 0) {
      toast.info("No participant records to export.");
      return;
    }

    const headers = [
      "Registration ID",
      "Full Name",
      "Email",
      "College Email",
      "Roll Number",
      "Department",
      "Year",
      "Phone",
      "Event Title",
      "Status",
      "Submitted At",
      "Custom Question Responses",
    ];

    const rows = targetRegs.map((r) => {
      const customText = r.customAnswers
        ? Object.entries(r.customAnswers)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ")
        : "";

      const eventTitle =
        eventMap[r.eventId]?.title || r.eventTitle || r.eventId || "Untitled Event";

      return [
        r.registrationId || "",
        r.name || "",
        r.email || "",
        r.collegeEmail || "",
        r.rollNumber || "",
        r.department || r.branch || "",
        r.year || r.semester || "",
        r.phone || "",
        eventTitle,
        r.registrationStatus || "registered",
        formatDateTime(r.createdAt),
        customText,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = specificEventId
      ? (eventMap[specificEventId]?.title || "event").replace(/[^a-z0-9]/gi, "-").toLowerCase()
      : eventFilter
      ? (eventMap[eventFilter]?.title || "event").replace(/[^a-z0-9]/gi, "-").toLowerCase()
      : "all-events";
    a.download = `abhyudaya-participants-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV file downloaded successfully!");
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar />

        <div className="dashboard-content">
          <div className="reg-page">
            {/* ── Page Header ── */}
            <div className="reg-hub-header">
              <div>
                <h1 className="reg-hub-title">📋 Event Registration Management</h1>
                <p className="reg-hub-subtitle">
                  Configure event registration forms, set participant limits, monitor remaining seats, and manage attendees.
                </p>
              </div>

              <div className="reg-hub-header-actions">
                <button
                  type="button"
                  className="reg-hub-btn reg-hub-btn-refresh"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Reload events and registrations"
                >
                  <FiRefreshCw className={refreshing ? "spin-icon" : ""} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  className="reg-hub-btn reg-hub-btn-primary"
                  onClick={openCreateEventModal}
                >
                  <FiPlus />
                  <span>Create Event Registration Form</span>
                </button>
              </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="reg-stats-grid">
              <div className="reg-stat-card">
                <div className="reg-stat-icon-wrapper" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                  <FiCalendar />
                </div>
                <div className="reg-stat-info">
                  <span className="reg-stat-value">{stats.totalEvents}</span>
                  <span className="reg-stat-label">Total Events</span>
                </div>
              </div>

              <div className="reg-stat-card highlight-green">
                <div className="reg-stat-icon-wrapper" style={{ background: "#ecfdf5", color: "#10b981" }}>
                  <FiCheckCircle />
                </div>
                <div className="reg-stat-info">
                  <span className="reg-stat-value">{stats.openRegistrations}</span>
                  <span className="reg-stat-label">Open Registrations</span>
                </div>
              </div>

              <div className="reg-stat-card highlight-blue">
                <div className="reg-stat-icon-wrapper" style={{ background: "#eef2ff", color: "#6366f1" }}>
                  <FiUsers />
                </div>
                <div className="reg-stat-info">
                  <span className="reg-stat-value">{stats.totalParticipants}</span>
                  <span className="reg-stat-label">Total Participants</span>
                </div>
              </div>

              <div className="reg-stat-card">
                <div className="reg-stat-icon-wrapper" style={{ background: "#fef2f2", color: "#ef4444" }}>
                  <FiLock />
                </div>
                <div className="reg-stat-info">
                  <span className="reg-stat-value">{stats.closedEvents}</span>
                  <span className="reg-stat-label">Closed Events</span>
                </div>
              </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div className="reg-nav-tabs">
              <button
                type="button"
                className={`reg-nav-tab ${activeTab === "events" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("events");
                  setSearchParams({ tab: "events" });
                }}
              >
                <FiCalendar />
                <span>Events &amp; Registration Forms</span>
                <span className="reg-tab-badge">{filteredEvents.length}</span>
              </button>

              <button
                type="button"
                className={`reg-nav-tab ${activeTab === "participants" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("participants");
                  setSearchParams({ tab: "participants" });
                }}
              >
                <FiUsers />
                <span>Registered Participants</span>
                <span className="reg-tab-badge">{filteredRegistrations.length}</span>
              </button>
            </div>

            {/* ============================================================
                TAB 1: EVENTS & REGISTRATION FORMS
               ============================================================ */}
            {activeTab === "events" && (
              <div className="reg-tab-content">
                {/* Event Toolbar */}
                <div className="reg-toolbar">
                  <div className="reg-search-box">
                    <FiSearch className="reg-search-icon" />
                    <input
                      type="text"
                      className="reg-input-field"
                      placeholder="Search event title, category, venue..."
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                    />
                  </div>

                  <div className="reg-filter-group">
                    <FiFilter className="reg-filter-icon" />
                    <select
                      className="reg-select-field"
                      value={eventStatusFilter}
                      onChange={(e) => setEventStatusFilter(e.target.value)}
                      aria-label="Filter events by status"
                    >
                      <option value="All">All Event Statuses</option>
                      <option value="Open">🟢 Registration Open Now</option>
                      <option value="Closed">🔴 Registration Closed</option>
                      <option value="Published">🚀 Published Only</option>
                      <option value="Draft">📝 Draft Only</option>
                    </select>
                  </div>
                </div>

                {loading ? (
                  <div className="reg-loading-container">
                    <div className="reg-spinner" />
                    <p>Loading events and registration forms...</p>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="reg-empty-card">
                    <span className="reg-empty-emoji">📅</span>
                    <h3>No Events Found</h3>
                    <p>
                      {events.length === 0
                        ? "No events exist yet. Create your first event registration form!"
                        : "No events match the selected filters."}
                    </p>
                    <button
                      type="button"
                      className="reg-hub-btn reg-hub-btn-primary"
                      onClick={openCreateEventModal}
                    >
                      <FiPlus />
                      <span>Create Event Registration Form</span>
                    </button>
                  </div>
                ) : (
                  <div className="reg-events-grid">
                    {filteredEvents.map((ev) => {
                      const count = regCounts[ev.id] || 0;
                      const maxLimit = ev.maxRegistrations ? Number(ev.maxRegistrations) : null;
                      const remainingSeats = maxLimit !== null ? Math.max(0, maxLimit - count) : null;
                      const percentFilled = maxLimit ? Math.min(100, Math.round((count / maxLimit) * 100)) : null;
                      const isOpen = isRegistrationCurrentlyOpen(ev, count);
                      const isFull = maxLimit !== null && count >= maxLimit;

                      return (
                        <div key={ev.id} className="reg-event-card">
                          {/* Banner & Header */}
                          <div className="reg-event-banner-wrap">
                            {ev.banner || ev.image ? (
                              <img
                                src={ev.banner || ev.image}
                                alt={ev.title}
                                className="reg-event-banner-img"
                              />
                            ) : (
                              <div className="reg-event-banner-fallback">
                                <span>{ev.icon || "📅"}</span>
                              </div>
                            )}
                            <div className="reg-event-badges-row">
                              <span className={`reg-badge-pill ${ev.status === "Published" ? "pill-published" : "pill-draft"}`}>
                                {ev.status || "Draft"}
                              </span>
                              <span className={`reg-badge-pill ${isOpen ? "pill-open" : isFull ? "pill-full" : "pill-closed"}`}>
                                {isOpen ? "🟢 Open" : isFull ? "⚠️ Full" : "🔒 Closed"}
                              </span>
                            </div>
                          </div>

                          {/* Event Body */}
                          <div className="reg-event-card-body">
                            <span className="reg-event-category">{ev.category || ev.subtitle || "Event"}</span>
                            <h3 className="reg-event-title">{ev.title}</h3>
                            {ev.tagline && <p className="reg-event-tagline">{ev.tagline}</p>}

                            <div className="reg-event-meta-list">
                              <div className="reg-meta-item">
                                <FiCalendar />
                                <span>{ev.eventStartDate ? formatDate(ev.eventStartDate) : "Date TBA"}</span>
                              </div>

                              <div className="reg-meta-item">
                                {ev.meetingLink ? <FiVideo /> : <FiMapPin />}
                                <span>{ev.venue || ev.location || (ev.meetingLink ? "Online Event" : "Venue TBA")}</span>
                              </div>

                              {ev.registrationDeadline && (
                                <div className="reg-meta-item">
                                  <FiClock />
                                  <span>Deadline: {formatDate(ev.registrationDeadline)}</span>
                                </div>
                              )}
                            </div>

                            {/* Capacity Bar */}
                            <div className="reg-capacity-section">
                              <div className="reg-capacity-header">
                                <span className="reg-capacity-label">Capacity &amp; Seats</span>
                                <span className="reg-capacity-count">
                                  <strong>{count}</strong> / {maxLimit ? maxLimit : "∞"} registered
                                </span>
                              </div>

                              {maxLimit !== null ? (
                                <>
                                  <div className="reg-progress-bar-bg">
                                    <div
                                      className={`reg-progress-bar-fill ${percentFilled >= 100 ? "fill-red" : percentFilled >= 75 ? "fill-amber" : "fill-green"}`}
                                      style={{ width: `${percentFilled}%` }}
                                    />
                                  </div>
                                  <div className="reg-seats-remaining">
                                    {remainingSeats === 0 ? (
                                      <span className="text-red">❌ Capacity reached (0 seats left)</span>
                                    ) : (
                                      <span className="text-emerald">✨ {remainingSeats} seats remaining ({100 - percentFilled}%)</span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="reg-seats-remaining text-emerald">
                                  ✨ Unlimited seats available
                                </div>
                              )}
                            </div>

                            {/* Action Bar */}
                            <div className="reg-card-actions">
                              <button
                                type="button"
                                className="reg-btn-action"
                                onClick={(e) => handleToggleRegistration(ev, e)}
                                title={ev.registrationOpen ? "Close registrations manually" : "Open registrations manually"}
                              >
                                {ev.registrationOpen ? <FiLock /> : <FiUnlock />}
                                <span>{ev.registrationOpen ? "Close Reg" : "Open Reg"}</span>
                              </button>

                              <button
                                type="button"
                                className="reg-btn-action"
                                onClick={() => handleViewParticipants(ev.id)}
                                title="View registered participants"
                              >
                                <FiUsers />
                                <span>Participants ({count})</span>
                              </button>

                              <button
                                type="button"
                                className="reg-btn-action"
                                onClick={(e) => openEditEventModal(ev, e)}
                                title="Edit event and registration form settings"
                              >
                                <FiEdit2 />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                className="reg-btn-action"
                                onClick={() => handleExportCSV(ev.id)}
                                title="Download participant CSV for this event"
                              >
                                <FiDownload />
                              </button>

                              <button
                                type="button"
                                className="reg-btn-action text-red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTargetEvent(ev);
                                }}
                                title="Archive or delete event"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================
                TAB 2: REGISTERED PARTICIPANTS
               ============================================================ */}
            {activeTab === "participants" && (
              <div className="reg-tab-content">
                {/* Toolbar */}
                <div className="reg-toolbar">
                  <div className="reg-search-box">
                    <FiSearch className="reg-search-icon" />
                    <input
                      type="text"
                      className="reg-input-field"
                      placeholder="Search name, email, roll number, department, or reg ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    className="reg-select-field"
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    aria-label="Filter by event"
                  >
                    <option value="">All Events</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({regCounts[ev.id] || 0})
                      </option>
                    ))}
                  </select>

                  <select
                    className="reg-select-field"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by registration status"
                  >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>

                  <select
                    className="reg-select-field"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    aria-label="Sort participants"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                    <option value="name">Name A–Z</option>
                  </select>

                  <button
                    type="button"
                    className="reg-hub-btn reg-hub-btn-primary"
                    onClick={() => handleExportCSV()}
                    disabled={filteredRegistrations.length === 0}
                  >
                    <FiDownload />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="reg-count-info">
                  Showing <strong>{filteredRegistrations.length}</strong> of <strong>{registrations.length}</strong> participants
                  {eventFilter && eventMap[eventFilter] && (
                    <span className="reg-active-filter-tag">
                      Event: {eventMap[eventFilter].title}
                      <button
                        type="button"
                        onClick={() => setEventFilter("")}
                        aria-label="Clear event filter"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="reg-loading-container">
                    <div className="reg-spinner" />
                    <p>Loading participants...</p>
                  </div>
                ) : filteredRegistrations.length === 0 ? (
                  <div className="reg-empty-card">
                    <span className="reg-empty-emoji">📋</span>
                    <h3>No Participants Found</h3>
                    <p>
                      {registrations.length === 0
                        ? "No participant registrations have been received yet."
                        : "Try adjusting your search criteria or filters."}
                    </p>
                  </div>
                ) : (
                  <div className="reg-table-container">
                    <table className="reg-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Participant</th>
                          <th>Roll Number</th>
                          <th>Department / Year</th>
                          <th>Event</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Registered At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRegistrations.map((r, idx) => (
                          <tr
                            key={r.id}
                            className="reg-table-row"
                            onClick={() => {
                              setSelectedReg(r);
                              setNewStatus(r.registrationStatus || "registered");
                            }}
                          >
                            <td className="reg-idx-col">{idx + 1}</td>
                            <td>
                              <div className="reg-user-cell">
                                <span className="reg-user-name">{r.name || "—"}</span>
                                <span className="reg-user-email">{r.email || ""}</span>
                                {r.collegeEmail && r.collegeEmail !== r.email && (
                                  <span className="reg-user-subemail">College: {r.collegeEmail}</span>
                                )}
                              </div>
                            </td>
                            <td>{r.rollNumber || "—"}</td>
                            <td>
                              {r.department || r.branch ? (
                                <span>
                                  {r.department || r.branch}
                                  {r.year || r.semester ? ` · ${r.year || r.semester}` : ""}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="reg-event-title-col">
                              {eventMap[r.eventId]?.title || r.eventTitle || r.eventId || "—"}
                            </td>
                            <td>{r.phone || "—"}</td>
                            <td>
                              <StatusBadge status={r.registrationStatus || "registered"} />
                            </td>
                            <td className="reg-date-col">{formatDateTime(r.createdAt)}</td>
                            <td>
                              <div className="reg-row-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="reg-action-icon-btn"
                                  onClick={() => {
                                    setSelectedReg(r);
                                    setNewStatus(r.registrationStatus || "registered");
                                  }}
                                  title="View submitted details"
                                >
                                  <FiEye />
                                </button>
                                <button
                                  type="button"
                                  className="reg-action-icon-btn delete"
                                  onClick={() => setDeleteTargetReg(r)}
                                  title="Delete record"
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          MODAL: CREATE / EDIT EVENT REGISTRATION FORM
         ============================================================ */}
      {isEventModalOpen && (
        <div className="reg-modal-backdrop" onClick={() => setIsEventModalOpen(false)}>
          <div className="reg-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="reg-modal-header">
              <div>
                <h2>{editingEvent ? "✏️ Edit Event & Registration Form" : "✨ Create Event Registration Form"}</h2>
                <p>Configure event details, registration dates, capacity limit, and attendee fields.</p>
              </div>
              <button
                type="button"
                className="reg-modal-close-btn"
                onClick={() => setIsEventModalOpen(false)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="reg-event-form">
              <div className="reg-form-scrollable">
                {/* 1. Basic Details */}
                <div className="reg-form-section">
                  <h3 className="reg-form-section-title">1. Event Overview</h3>
                  <div className="reg-form-grid-2">
                    <div className="reg-form-field full-width">
                      <label>Event Title <span className="req">*</span></label>
                      <input
                        type="text"
                        required
                        className="reg-input-field"
                        placeholder="e.g. TechBloom 2026: Annual Technical Fest"
                        value={eventFormData.title}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, title: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Category / Track</label>
                      <input
                        type="text"
                        className="reg-input-field"
                        placeholder="e.g. Flagship Festival, Workshop, Hackathon"
                        value={eventFormData.category}
                        onChange={(e) =>
                          setEventFormData((p) => ({
                            ...p,
                            category: e.target.value,
                            subtitle: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Short Tagline</label>
                      <input
                        type="text"
                        className="reg-input-field"
                        placeholder="e.g. Explore, innovate, and excel"
                        value={eventFormData.tagline}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, tagline: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field full-width">
                      <label>Short Description</label>
                      <textarea
                        rows={2}
                        className="reg-input-field"
                        placeholder="Concise 1-2 sentence summary displayed on event cards..."
                        value={eventFormData.shortDescription}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, shortDescription: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field full-width">
                      <label>Banner Image URL (or upload below)</label>
                      <input
                        type="url"
                        className="reg-input-field"
                        placeholder="https://images.unsplash.com/... or Cloudinary URL"
                        value={eventFormData.banner}
                        onChange={(e) => {
                          setEventFormData((p) => ({ ...p, banner: e.target.value }));
                          setBannerPreview(e.target.value);
                        }}
                      />
                      <div className="reg-file-upload-box">
                        <label className="reg-file-label">
                          <span>📁 Select Image File from Device</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setBannerFile(e.target.files[0]);
                                setBannerPreview(URL.createObjectURL(e.target.files[0]));
                              }
                            }}
                          />
                        </label>
                        {bannerPreview && (
                          <div className="reg-banner-preview">
                            <img src={bannerPreview} alt="Banner Preview" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Venue & Date */}
                <div className="reg-form-section">
                  <h3 className="reg-form-section-title">2. Venue &amp; Schedule</h3>
                  <div className="reg-form-grid-2">
                    <div className="reg-form-field">
                      <label>Venue / Location</label>
                      <input
                        type="text"
                        className="reg-input-field"
                        placeholder="e.g. Main Auditorium, MPEC"
                        value={eventFormData.venue}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, venue: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Virtual Meeting Link (optional)</label>
                      <input
                        type="url"
                        className="reg-input-field"
                        placeholder="e.g. https://meet.google.com/abc-defg-hij"
                        value={eventFormData.meetingLink}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, meetingLink: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Event Start Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        className="reg-input-field"
                        value={eventFormData.eventStartDate}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, eventStartDate: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Event End Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        className="reg-input-field"
                        value={eventFormData.eventEndDate}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, eventEndDate: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Registration Window & Capacity */}
                <div className="reg-form-section">
                  <h3 className="reg-form-section-title">3. Registration Settings &amp; Capacity</h3>
                  <div className="reg-form-grid-2">
                    <div className="reg-form-field">
                      <label>Registration Opens At</label>
                      <input
                        type="datetime-local"
                        className="reg-input-field"
                        value={eventFormData.registrationStartDate}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, registrationStartDate: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Registration Deadline (Closes At)</label>
                      <input
                        type="datetime-local"
                        className="reg-input-field"
                        value={eventFormData.registrationDeadline}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, registrationDeadline: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Maximum Participant Limit</label>
                      <input
                        type="number"
                        min="1"
                        className="reg-input-field"
                        placeholder="Leave blank for unlimited capacity"
                        value={eventFormData.maxRegistrations}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, maxRegistrations: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Registration Publication Status</label>
                      <select
                        className="reg-select-field"
                        value={eventFormData.status}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, status: e.target.value }))
                        }
                      >
                        <option value="Published">Published (Visible to Students)</option>
                        <option value="Draft">Draft (Admin Only)</option>
                      </select>
                    </div>

                    <div className="reg-form-field full-width">
                      <label className="reg-checkbox-label">
                        <input
                          type="checkbox"
                          checked={eventFormData.registrationOpen}
                          onChange={(e) =>
                            setEventFormData((p) => ({ ...p, registrationOpen: e.target.checked }))
                          }
                        />
                        <span>
                          <strong>Registration Window is Active (Open)</strong> — unchecked means registrations are manually closed.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 4. Coordinator Contact Information */}
                <div className="reg-form-section">
                  <h3 className="reg-form-section-title">4. Coordinator Contact Information</h3>
                  <div className="reg-form-grid-3">
                    <div className="reg-form-field">
                      <label>Coordinator Name</label>
                      <input
                        type="text"
                        className="reg-input-field"
                        placeholder="e.g. Prof. R. K. Sharma"
                        value={eventFormData.coordinatorName}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, coordinatorName: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Coordinator Email</label>
                      <input
                        type="email"
                        className="reg-input-field"
                        placeholder="coordinator@abhyudayampec.in"
                        value={eventFormData.coordinatorEmail}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, coordinatorEmail: e.target.value }))
                        }
                      />
                    </div>

                    <div className="reg-form-field">
                      <label>Coordinator Phone</label>
                      <input
                        type="tel"
                        className="reg-input-field"
                        placeholder="+91 98765 43210"
                        value={eventFormData.coordinatorPhone}
                        onChange={(e) =>
                          setEventFormData((p) => ({ ...p, coordinatorPhone: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Participant Form Fields Configuration */}
                <div className="reg-form-section">
                  <h3 className="reg-form-section-title">5. Participant Form Fields</h3>
                  <p className="reg-section-hint">
                    Choose which fields participants must complete when submitting their registration.
                  </p>

                  <div className="reg-form-fields-grid">
                    <div className="reg-field-toggle-card static-req">
                      <div className="field-title">Full Name</div>
                      <span className="field-badge-req">Always Required</span>
                    </div>

                    <div className="reg-field-toggle-card">
                      <div className="field-title">College Email</div>
                      <div className="field-toggles">
                        <label>
                          <input
                            type="checkbox"
                            checked={eventFormData.formFields?.collegeEmail?.enabled !== false}
                            onChange={(e) =>
                              setEventFormData((p) => ({
                                ...p,
                                formFields: {
                                  ...p.formFields,
                                  collegeEmail: {
                                    ...p.formFields?.collegeEmail,
                                    enabled: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Enabled</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(eventFormData.formFields?.collegeEmail?.required)}
                            onChange={(e) =>
                              setEventFormData((p) => ({
                                ...p,
                                formFields: {
                                  ...p.formFields,
                                  collegeEmail: {
                                    ...p.formFields?.collegeEmail,
                                    required: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Required</span>
                        </label>
                      </div>
                    </div>

                    <div className="reg-field-toggle-card">
                      <div className="field-title">Roll Number</div>
                      <div className="field-toggles">
                        <label>
                          <input
                            type="checkbox"
                            checked={eventFormData.formFields?.rollNumber?.enabled !== false}
                            onChange={(e) =>
                              setEventFormData((p) => ({
                                ...p,
                                formFields: {
                                  ...p.formFields,
                                  rollNumber: {
                                    ...p.formFields?.rollNumber,
                                    enabled: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Enabled</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(eventFormData.formFields?.rollNumber?.required)}
                            onChange={(e) =>
                              setEventFormData((p) => ({
                                ...p,
                                formFields: {
                                  ...p.formFields,
                                  rollNumber: {
                                    ...p.formFields?.rollNumber,
                                    required: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Required</span>
                        </label>
                      </div>
                    </div>

                    <div className="reg-field-toggle-card">
                      <div className="field-title">Department &amp; Year</div>
                      <div className="field-toggles">
                        <label>
                          <input
                            type="checkbox"
                            checked={eventFormData.formFields?.departmentYear?.enabled !== false}
                            onChange={(e) =>
                              setEventFormData((p) => ({
                                ...p,
                                formFields: {
                                  ...p.formFields,
                                  departmentYear: {
                                    ...p.formFields?.departmentYear,
                                    enabled: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Enabled</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(eventFormData.formFields?.departmentYear?.required)}
                            onChange={(e) =>
                              setEventFormData((p) => ({
                                ...p,
                                formFields: {
                                  ...p.formFields,
                                  departmentYear: {
                                    ...p.formFields?.departmentYear,
                                    required: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Required</span>
                        </label>
                      </div>
                    </div>

                    <div className="reg-field-toggle-card">
                      <div className="field-title">Phone Number</div>
                      <div className="field-toggles">
                        <label>
                          <input
                            type="checkbox"
                            checked={eventFormData.formFields?.phone?.enabled !== false}
                            onChange={(e) =>
                              setEventFormData((p) => ({
                                ...p,
                                formFields: {
                                  ...p.formFields,
                                  phone: {
                                    ...p.formFields?.phone,
                                    enabled: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Enabled</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(eventFormData.formFields?.phone?.required)}
                            onChange={(e) =>
                              setEventFormData((p) => ({
                                ...p,
                                formFields: {
                                  ...p.formFields,
                                  phone: {
                                    ...p.formFields?.phone,
                                    required: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Required</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Custom Questions */}
                  <div className="reg-custom-questions-wrap">
                    <div className="custom-q-header">
                      <h4>Custom Questions</h4>
                      <button
                        type="button"
                        className="reg-add-q-btn"
                        onClick={() =>
                          setEventFormData((p) => ({
                            ...p,
                            formFields: {
                              ...p.formFields,
                              customQuestions: [
                                ...(p.formFields?.customQuestions || []),
                                {
                                  id: `q_${Date.now()}`,
                                  label: "",
                                  type: "text",
                                  required: false,
                                  options: "",
                                },
                              ],
                            },
                          }))
                        }
                      >
                        <FiPlus /> <span>Add Question</span>
                      </button>
                    </div>

                    {(eventFormData.formFields?.customQuestions || []).map((q, idx) => (
                      <div key={q.id || idx} className="custom-q-row">
                        <span className="q-index-pill">Q{idx + 1}</span>
                        <input
                          type="text"
                          className="reg-input-field q-label-input"
                          placeholder="Question Prompt (e.g. T-Shirt Size, Team Members, Dietary Preference)"
                          value={q.label}
                          onChange={(e) => {
                            const updated = [...(eventFormData.formFields?.customQuestions || [])];
                            updated[idx].label = e.target.value;
                            setEventFormData((p) => ({
                              ...p,
                              formFields: { ...p.formFields, customQuestions: updated },
                            }));
                          }}
                        />

                        <select
                          className="reg-select-field q-type-select"
                          value={q.type}
                          onChange={(e) => {
                            const updated = [...(eventFormData.formFields?.customQuestions || [])];
                            updated[idx].type = e.target.value;
                            setEventFormData((p) => ({
                              ...p,
                              formFields: { ...p.formFields, customQuestions: updated },
                            }));
                          }}
                        >
                          <option value="text">Short Text</option>
                          <option value="textarea">Paragraph</option>
                          <option value="select">Dropdown</option>
                        </select>

                        <label className="q-req-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(q.required)}
                            onChange={(e) => {
                              const updated = [...(eventFormData.formFields?.customQuestions || [])];
                              updated[idx].required = e.target.checked;
                              setEventFormData((p) => ({
                                ...p,
                                formFields: { ...p.formFields, customQuestions: updated },
                              }));
                            }}
                          />
                          <span>Required</span>
                        </label>

                        <button
                          type="button"
                          className="q-delete-btn"
                          onClick={() => {
                            const updated = (eventFormData.formFields?.customQuestions || []).filter(
                              (_, i) => i !== idx
                            );
                            setEventFormData((p) => ({
                              ...p,
                              formFields: { ...p.formFields, customQuestions: updated },
                            }));
                          }}
                          title="Remove this question"
                        >
                          <FiTrash2 />
                        </button>

                        {q.type === "select" && (
                          <div className="q-options-full">
                            <input
                              type="text"
                              className="reg-input-field"
                              placeholder="Comma-separated options: S, M, L, XL, XXL"
                              value={q.options || ""}
                              onChange={(e) => {
                                const updated = [...(eventFormData.formFields?.customQuestions || [])];
                                updated[idx].options = e.target.value;
                                setEventFormData((p) => ({
                                  ...p,
                                  formFields: { ...p.formFields, customQuestions: updated },
                                }));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="reg-modal-footer">
                <button
                  type="button"
                  className="reg-hub-btn reg-hub-btn-secondary"
                  onClick={() => setIsEventModalOpen(false)}
                  disabled={eventFormSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="reg-hub-btn reg-hub-btn-primary"
                  disabled={eventFormSaving || uploadingBanner}
                >
                  {eventFormSaving ? "Saving..." : editingEvent ? "Save Changes" : "Create Event Form"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: PARTICIPANT DETAILS & STATUS UPDATE
         ============================================================ */}
      {selectedReg && (
        <div className="reg-modal-backdrop" onClick={() => setSelectedReg(null)}>
          <div className="reg-modal-dialog participant-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reg-modal-header">
              <div>
                <h2>👤 Participant Details</h2>
                <p>Registration ID: <strong>{selectedReg.registrationId || selectedReg.id}</strong></p>
              </div>
              <button
                type="button"
                className="reg-modal-close-btn"
                onClick={() => setSelectedReg(null)}
              >
                <FiX />
              </button>
            </div>

            <div className="reg-modal-body">
              <div className="reg-detail-grid">
                <div className="reg-detail-item">
                  <span className="label">Full Name</span>
                  <span className="val">{selectedReg.name || "—"}</span>
                </div>

                <div className="reg-detail-item">
                  <span className="label">Primary Email</span>
                  <span className="val">{selectedReg.email || "—"}</span>
                </div>

                <div className="reg-detail-item">
                  <span className="label">College Email</span>
                  <span className="val">{selectedReg.collegeEmail || selectedReg.email || "—"}</span>
                </div>

                <div className="reg-detail-item">
                  <span className="label">Phone Number</span>
                  <span className="val">{selectedReg.phone || "—"}</span>
                </div>

                <div className="reg-detail-item">
                  <span className="label">Roll Number</span>
                  <span className="val">{selectedReg.rollNumber || "—"}</span>
                </div>

                <div className="reg-detail-item">
                  <span className="label">Department / Year</span>
                  <span className="val">
                    {selectedReg.department || selectedReg.branch || "—"}
                    {selectedReg.year || selectedReg.semester ? ` · ${selectedReg.year || selectedReg.semester}` : ""}
                  </span>
                </div>

                <div className="reg-detail-item full-width">
                  <span className="label">Registered Event</span>
                  <span className="val highlight">
                    {eventMap[selectedReg.eventId]?.title || selectedReg.eventTitle || selectedReg.eventId}
                  </span>
                </div>

                <div className="reg-detail-item">
                  <span className="label">Registration Timestamp</span>
                  <span className="val">{formatDateTime(selectedReg.createdAt)}</span>
                </div>

                <div className="reg-detail-item">
                  <span className="label">Current Status</span>
                  <span className="val">
                    <StatusBadge status={selectedReg.registrationStatus || "registered"} />
                  </span>
                </div>

                {/* Custom Answers */}
                {selectedReg.customAnswers && Object.keys(selectedReg.customAnswers).length > 0 && (
                  <div className="reg-detail-item full-width custom-answers-box">
                    <span className="label">Custom Question Answers</span>
                    <div className="custom-qa-list">
                      {Object.entries(selectedReg.customAnswers).map(([key, val]) => (
                        <div key={key} className="custom-qa-item">
                          <span className="qa-key">{key}:</span>
                          <span className="qa-val">{String(val || "—")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Updater */}
              <div className="reg-status-updater-box">
                <h4>Update Status</h4>
                <div className="reg-status-updater-row">
                  <select
                    className="reg-select-field"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="reg-hub-btn reg-hub-btn-primary"
                    onClick={handleUpdateParticipantStatus}
                    disabled={updatingStatus || newStatus === selectedReg.registrationStatus}
                  >
                    {updatingStatus ? "Updating..." : "Update Status"}
                  </button>
                </div>
              </div>
            </div>

            <div className="reg-modal-footer">
              <button
                type="button"
                className="reg-delete-confirm-btn"
                onClick={() => {
                  setDeleteTargetReg(selectedReg);
                }}
              >
                <FiTrash2 /> <span>Delete Registration</span>
              </button>

              <button
                type="button"
                className="reg-hub-btn reg-hub-btn-secondary"
                onClick={() => setSelectedReg(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: CONFIRM DELETE PARTICIPANT
         ============================================================ */}
      {deleteTargetReg && (
        <div className="reg-modal-backdrop" onClick={() => setDeleteTargetReg(null)}>
          <div className="reg-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reg-confirm-icon">⚠️</div>
            <h3>Delete Participant Registration?</h3>
            <p>
              Are you sure you want to delete the registration for <strong>{deleteTargetReg.name}</strong> ({deleteTargetReg.email})?
            </p>
            <p className="reg-confirm-warning">
              This action cannot be undone. The participant will lose their registration ID.
            </p>
            <div className="reg-confirm-actions">
              <button
                type="button"
                className="reg-cancel-btn"
                onClick={() => setDeleteTargetReg(null)}
                disabled={deletingReg}
              >
                Cancel
              </button>
              <button
                type="button"
                className="reg-delete-confirm-btn"
                onClick={handleDeleteParticipant}
                disabled={deletingReg}
              >
                {deletingReg ? "Deleting..." : "Yes, Delete Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: CONFIRM ARCHIVE / DELETE EVENT
         ============================================================ */}
      {deleteTargetEvent && (
        <div className="reg-modal-backdrop" onClick={() => setDeleteTargetEvent(null)}>
          <div className="reg-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reg-confirm-icon">🗑️</div>
            <h3>Manage Event Deletion or Archival</h3>
            <p>
              What would you like to do with <strong>"{deleteTargetEvent.title}"</strong>?
            </p>
            <p className="reg-confirm-warning">
              Archiving moves the event to Drafts and closes public registrations. Permanent deletion deletes the event document permanently.
            </p>
            <div className="reg-confirm-actions flex-column">
              <button
                type="button"
                className="reg-hub-btn reg-hub-btn-secondary full-btn"
                onClick={() => handleArchiveOrDeleteEvent(false)}
                disabled={deletingEvent}
              >
                <FiArchive />
                <span>Archive to Drafts (Recommended)</span>
              </button>

              <button
                type="button"
                className="reg-delete-confirm-btn full-btn"
                onClick={() => handleArchiveOrDeleteEvent(true)}
                disabled={deletingEvent}
              >
                <FiTrash2 />
                <span>Permanently Delete Event</span>
              </button>

              <button
                type="button"
                className="reg-cancel-btn"
                onClick={() => setDeleteTargetEvent(null)}
                disabled={deletingEvent}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}