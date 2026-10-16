import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { useToast } from "../components/Toast";
import {
  LEVELS,
  LEVEL_LABELS,
  DEPARTMENT_OPTIONS,
  EXECUTIVE_DEPARTMENTS,
  ROLE_PRESETS,
  isValidUrl,
  ABHYUDAYA_DEV_COMMON_YEAR,
  ABHYUDAYA_DEV_FIXED_YEAR,
  isAbhyudayaDeveloper,
} from "../../components/team/teamUtils";
import {
  getTeamMembers,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  setTeamMemberActive,
  getTeamYears,
  addTeamYear,
  DEFAULT_TEAM_YEARS,
  batchUpdateTeamMembersActive,
  batchMoveTeamMembersYear,
  batchDeleteTeamMembers,
} from "./services/teamService";
import {
  FaLinkedin,
  FaGithub,
  FaPlus,
  FaSearch,
  FaTimes,
  FaTrash,
  FaEdit,
  FaToggleOn,
  FaToggleOff,
  FaUserTie,
  FaUsers,
  FaUpload,
  FaImage,
  FaCrown,
  FaUserCheck,
  FaChalkboardTeacher,
  FaAward,
  FaThLarge,
  FaList,
  FaExternalLinkAlt,
  FaExclamationTriangle,
  FaEnvelope,
  FaFilter,
  FaRedo,
  FaLaptopCode,
  FaCalendarAlt,
  FaCalendarPlus,
  FaCheck,
  FaFileCsv,
  FaPrint,
  FaCheckSquare,
  FaSquare,
  FaExchangeAlt,
  FaInstagram,
  FaGlobe,
  FaQuoteLeft,
  FaStar,
} from "react-icons/fa";
import "./style/admin.css";
import "./Team.css";

const INITIAL_FORM_STATE = {
  name: "",
  role: "President",
  level: LEVELS.LEADERSHIP,
  department: "Leadership",
  category: "Executive Board",
  linkedin: "",
  github: "",
  instagram: "",
  website: "",
  email: "",
  bio: "",
  quote: "",
  featured: false,
  order: 1,
  image: "",
  active: true,
  year: "2026",
};

export default function Team() {
  const toast = useToast();

  // Data State
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  // Year State & Modal
  const [availableYears, setAvailableYears] = useState(DEFAULT_TEAM_YEARS);
  const [selectedYear, setSelectedYear] = useState("2026");
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYearInput, setNewYearInput] = useState("");
  const [isAddingYear, setIsAddingYear] = useState(false);

  // Search, Filter, Sort & View Mode
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("ALL"); // ALL, LEADERSHIP, CORE, EXECUTIVE, FACULTY, ACTIVE, INACTIVE, WEB_DEV
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, INACTIVE
  const [sortBy, setSortBy] = useState("order"); // order, name_asc, name_desc, role, dept
  const [viewMode, setViewMode] = useState("grid"); // grid | table

  // Multi-Selection State
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [showMoveYearModal, setShowMoveYearModal] = useState(false);
  const [targetMoveYear, setTargetMoveYear] = useState("");
  const [isMovingYear, setIsMovingYear] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Drawer / Form State
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState("President");
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Image Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Confirmation Modals State
  const [deleteModalMember, setDeleteModalMember] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // Clear selections when switching academic year
  useEffect(() => {
    setSelectedMemberIds([]);
  }, [selectedYear]);

  // Load team data & years from Firestore
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersData, yearsData] = await Promise.all([
        getTeamMembers(),
        getTeamYears(),
      ]);
      setMembers(membersData || []);
      if (Array.isArray(yearsData) && yearsData.length > 0) {
        setAvailableYears(yearsData);
      }
    } catch (err) {
      console.error("Failed to load team data:", err);
      toast.error("Failed to load team data from database.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    const fetchInitialData = async () => {
      try {
        const [membersData, yearsData] = await Promise.all([
          getTeamMembers(),
          getTeamYears(),
        ]);
        if (active) {
          setMembers(membersData || []);
          if (Array.isArray(yearsData) && yearsData.length > 0) {
            setAvailableYears(yearsData);
          }
        }
      } catch (err) {
        if (active) {
          console.error("Failed to load team data:", err);
          toast.error("Failed to load team data from database.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchInitialData();
    return () => {
      active = false;
    };
  }, [toast]);

  // Year-filtered members: includes year-specific roster PLUS permanent common Abhyudaya Developers
  const yearMembers = useMemo(() => {
    return members.filter((m) => {
      if (isAbhyudayaDeveloper(m)) {
        return true; // Abhyudaya Developers are permanent and common across all academic years
      }
      const memberYear = String(
        m.year ?? m.batch ?? m.session ?? m.academicYear ?? m.teamYear ?? "2026"
      ).trim();
      return memberYear === selectedYear;
    });
  }, [members, selectedYear]);

  // Dynamic Statistics scoped to the currently selected year (including common developers)
  const stats = useMemo(() => {
    const total = yearMembers.length;
    const activeCount = yearMembers.filter((m) => m.active !== false).length;
    const leadershipCount = yearMembers.filter((m) => m.level === LEVELS.LEADERSHIP).length;
    const coreCount = yearMembers.filter((m) => m.level === LEVELS.CORE).length;
    const execCount = yearMembers.filter((m) => m.level === LEVELS.EXECUTIVE).length;
    const webDevCount = yearMembers.filter(isAbhyudayaDeveloper).length;
    const facultyCount = yearMembers.filter((m) => m.level === LEVELS.FACULTY_ADVISOR).length;
    return { total, activeCount, leadershipCount, coreCount, execCount, webDevCount, facultyCount };
  }, [yearMembers]);

  // Tab count helper scoped to year
  const getTabCount = useCallback(
    (tabId) => {
      switch (tabId) {
        case "ALL":
          return yearMembers.length;
        case "ACTIVE":
          return stats.activeCount;
        case "INACTIVE":
          return yearMembers.length - stats.activeCount;
        case "LEADERSHIP":
          return stats.leadershipCount;
        case "CORE":
          return stats.coreCount;
        case "EXECUTIVE":
          return stats.execCount;
        case "WEB_DEV":
          return stats.webDevCount;
        case "FACULTY":
          return stats.facultyCount;
        default:
          return 0;
      }
    },
    [yearMembers.length, stats]
  );

  // Filter & Search Logic
  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const list = yearMembers.filter((m) => {
      // Search matching (name, role, department, email, bio)
      if (query) {
        const nameMatch = (m.name || "").toLowerCase().includes(query);
        const roleMatch = (m.role || "").toLowerCase().includes(query);
        const deptMatch = (m.department || "").toLowerCase().includes(query);
        const emailMatch = (m.email || "").toLowerCase().includes(query);
        const bioMatch = (m.bio || "").toLowerCase().includes(query);
        if (!nameMatch && !roleMatch && !deptMatch && !emailMatch && !bioMatch) {
          return false;
        }
      }

      // Department filter
      if (selectedDept !== "ALL" && m.department !== selectedDept) {
        return false;
      }

      // Status filter dropdown
      if (statusFilter === "ACTIVE" && m.active === false) return false;
      if (statusFilter === "INACTIVE" && m.active !== false) return false;

      // Tab filter
      if (activeTab === "ALL") return true;
      if (activeTab === "ACTIVE") return m.active !== false;
      if (activeTab === "INACTIVE") return m.active === false;
      if (activeTab === "LEADERSHIP") return m.level === LEVELS.LEADERSHIP;
      if (activeTab === "CORE") return m.level === LEVELS.CORE;
      if (activeTab === "EXECUTIVE") return m.level === LEVELS.EXECUTIVE;
      if (activeTab === "WEB_DEV") {
        return isAbhyudayaDeveloper(m);
      }
      if (activeTab === "FACULTY") return m.level === LEVELS.FACULTY_ADVISOR;

      return true;
    });

    // Apply sort
    return [...list].sort((a, b) => {
      if (sortBy === "order") {
        return (Number(a.order) || 99) - (Number(b.order) || 99);
      }
      if (sortBy === "name_asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "name_desc") {
        return (b.name || "").localeCompare(a.name || "");
      }
      if (sortBy === "role") {
        return (a.role || "").localeCompare(b.role || "");
      }
      if (sortBy === "dept") {
        return (a.department || "").localeCompare(b.department || "");
      }
      return 0;
    });
  }, [yearMembers, searchTerm, selectedDept, statusFilter, activeTab, sortBy]);

  const hasActiveFilters =
    searchTerm !== "" ||
    activeTab !== "ALL" ||
    selectedDept !== "ALL" ||
    statusFilter !== "ALL" ||
    sortBy !== "order";

  const handleResetFilters = () => {
    setSearchTerm("");
    setActiveTab("ALL");
    setSelectedDept("ALL");
    setStatusFilter("ALL");
    setSortBy("order");
  };

  // Multi-Selection Handlers
  const handleToggleSelectMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredMembers.map((m) => m.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedMemberIds.includes(id));
    if (allSelected) {
      setSelectedMemberIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedMemberIds([]);
  };

  // Bulk Status Update (Activate / Deactivate)
  const handleBatchToggleActive = async (newActive) => {
    if (selectedMemberIds.length === 0) return;
    try {
      await batchUpdateTeamMembersActive(selectedMemberIds, newActive);
      setMembers((prev) =>
        prev.map((m) =>
          selectedMemberIds.includes(m.id) ? { ...m, active: newActive } : m
        )
      );
      toast.success(
        newActive
          ? `Activated ${selectedMemberIds.length} member(s).`
          : `Unpublished/Hidden ${selectedMemberIds.length} member(s).`
      );
    } catch (err) {
      console.error("Batch toggle active error:", err);
      toast.error("Failed to update status for selected members.");
    }
  };

  // Bulk Move Year Handler with Strict Abhyudaya Developers Protection
  const handleOpenMoveYearModal = () => {
    const selectedMembers = yearMembers.filter((m) => selectedMemberIds.includes(m.id));
    const allAreDevs = selectedMembers.every(isAbhyudayaDeveloper);

    if (allAreDevs) {
      toast.error(
        "Abhyudaya Developers profiles are permanent and common across all academic years and cannot be moved or assigned to a specific year."
      );
      return;
    }

    const defaultTarget = availableYears.find((y) => y !== selectedYear) || "2027";
    setTargetMoveYear(defaultTarget);
    setShowMoveYearModal(true);
  };

  const handleConfirmMoveYear = async () => {
    const selectedMembers = yearMembers.filter((m) => selectedMemberIds.includes(m.id));
    const eligibleMembers = selectedMembers.filter((m) => !isAbhyudayaDeveloper(m));
    const devMembers = selectedMembers.filter(isAbhyudayaDeveloper);

    if (eligibleMembers.length === 0) {
      toast.error(
        "Abhyudaya Developers profiles are permanent and common across all academic years and cannot be moved."
      );
      setShowMoveYearModal(false);
      return;
    }

    try {
      setIsMovingYear(true);
      await batchMoveTeamMembersYear(eligibleMembers, targetMoveYear);

      // Update local state
      setMembers((prev) =>
        prev.map((m) => {
          if (eligibleMembers.some((em) => em.id === m.id)) {
            return { ...m, year: targetMoveYear, batch: targetMoveYear };
          }
          return m;
        })
      );

      setSelectedMemberIds([]);
      setShowMoveYearModal(false);

      if (devMembers.length > 0) {
        toast.info(
          `Moved ${eligibleMembers.length} member(s) to AY ${targetMoveYear}. Note: ${devMembers.length} Abhyudaya Developer profile(s) were protected as common across all years.`
        );
      } else {
        toast.success(`Successfully moved ${eligibleMembers.length} member(s) to AY ${targetMoveYear}.`);
      }
    } catch (err) {
      console.error("Batch move error:", err);
      toast.error(err.message || "Failed to move members to target year.");
    } finally {
      setIsMovingYear(false);
    }
  };

  // Bulk Delete Handler
  const handleConfirmBatchDelete = async () => {
    if (selectedMemberIds.length === 0) return;
    try {
      setIsBatchDeleting(true);
      await batchDeleteTeamMembers(selectedMemberIds);
      setMembers((prev) => prev.filter((m) => !selectedMemberIds.includes(m.id)));
      toast.success(`Permanently deleted ${selectedMemberIds.length} member(s).`);
      setSelectedMemberIds([]);
      setShowBatchDeleteModal(false);
    } catch (err) {
      console.error("Batch delete error:", err);
      toast.error(err.message || "Failed to delete selected members.");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (yearMembers.length === 0) {
      toast.info(`No team members to export for ${selectedYear}.`);
      return;
    }
    const headers = [
      "ID",
      "Name",
      "Role",
      "Level",
      "Department",
      "Academic Year",
      "Email",
      "Display Order",
      "Status",
      "LinkedIn",
      "GitHub",
      "Instagram",
      "Website",
    ];
    const escapeCsv = (val) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const rows = yearMembers.map((m) => [
      m.id || "",
      m.name || "",
      m.role || "",
      m.level || "",
      m.department || "",
      m.year || selectedYear,
      m.email || "",
      m.order ?? 99,
      m.active !== false ? "Active" : "Inactive",
      m.linkedin || "",
      m.github || "",
      m.instagram || "",
      m.website || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `abhyudaya-team-${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${yearMembers.length} profiles for AY ${selectedYear} to CSV.`);
  };

  // Form Management
  const resetForm = () => {
    const nextOrder =
      yearMembers.length > 0
        ? Math.max(...yearMembers.map((m) => Number(m.order) || 0)) + 1
        : 1;

    setSelectedPreset("President");
    setFormData({
      ...INITIAL_FORM_STATE,
      year: selectedYear,
      order: nextOrder,
    });
    setSelectedFile(null);
    setImagePreview("");
    setEditingMember(null);
    setIsFormDirty(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenDrawer = (member = null) => {
    if (member) {
      setEditingMember(member);
      const matchingPreset = ROLE_PRESETS.find((p) => p.value === member.role);
      setSelectedPreset(matchingPreset ? matchingPreset.value : "custom");

      const isDev = isAbhyudayaDeveloper(member);
      const memberYear = isDev
        ? ABHYUDAYA_DEV_COMMON_YEAR
        : String(
            member.year ?? member.batch ?? member.session ?? member.academicYear ?? selectedYear
          ).trim();

      setFormData({
        name: member.name || "",
        role: member.role || "",
        level: isDev ? LEVELS.WEB_DEV : (member.level || LEVELS.EXECUTIVE),
        department: isDev ? "Web Development" : (member.department || "Operations"),
        category: isDev ? "Abhyudaya Developers" : (member.category || "Domain Leads"),
        year: memberYear,
        linkedin: member.linkedin || "",
        github: member.github || "",
        instagram: member.instagram || "",
        website: member.website || "",
        email: member.email || "",
        bio: member.bio || "",
        quote: member.quote || "",
        featured: Boolean(member.featured),
        order: member.order !== undefined && member.order !== null ? Number(member.order) : 1,
        image: member.image || "",
        active: member.active === false ? false : true,
      });
      setImagePreview(member.image || "");
      setSelectedFile(null);
    } else {
      resetForm();
    }
    setIsFormDirty(false);
    setShowDrawer(true);
  };

  // Add New Year Dialog Handlers
  const handleOpenAddYearModal = () => {
    const numericYears = availableYears
      .map((y) => parseInt(y, 10))
      .filter((n) => !isNaN(n));
    const nextSuggested = numericYears.length > 0 ? String(Math.max(...numericYears) + 1) : "2027";
    setNewYearInput(nextSuggested);
    setShowAddYearModal(true);
  };

  const handleConfirmAddYear = async (e) => {
    if (e) e.preventDefault();
    const clean = newYearInput.trim();
    if (!clean) {
      toast.error("Please enter a valid academic/executive year.");
      return;
    }
    if (availableYears.includes(clean)) {
      toast.info(`Year "${clean}" is already in your year list.`);
      setSelectedYear(clean);
      setShowAddYearModal(false);
      return;
    }

    setIsAddingYear(true);
    try {
      await addTeamYear(clean);
      setAvailableYears((prev) => {
        const nextYears = Array.from(new Set([...prev, clean]));
        return nextYears.sort((a, b) => {
          const numA = parseInt(a, 10);
          const numB = parseInt(b, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
        });
      });
      setSelectedYear(clean);
      setShowAddYearModal(false);
      toast.success(`Year ${clean} initialized successfully! You can now add members for ${clean}.`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to initialize new year.");
    } finally {
      setIsAddingYear(false);
    }
  };

  const handleCloseDrawer = () => {
    if (isFormDirty) {
      setShowUnsavedModal(true);
    } else {
      setShowDrawer(false);
      resetForm();
    }
  };

  const confirmDiscardChanges = () => {
    setShowUnsavedModal(false);
    setShowDrawer(false);
    resetForm();
  };

  // Preset Role Change
  const handlePresetChange = (presetValue) => {
    setSelectedPreset(presetValue);
    setIsFormDirty(true);

    if (presetValue === "custom") {
      setFormData((prev) => ({
        ...prev,
        level: LEVELS.EXECUTIVE,
        department:
          prev.department && EXECUTIVE_DEPARTMENTS.includes(prev.department)
            ? prev.department
            : "Operations",
      }));
      return;
    }

    const preset = ROLE_PRESETS.find((p) => p.value === presetValue);
    if (preset) {
      const isDevPreset = preset.level === LEVELS.WEB_DEV;
      setFormData((prev) => ({
        ...prev,
        role: preset.value,
        level: preset.level,
        department: preset.department,
        category: preset.category,
        github: preset.level === LEVELS.FACULTY_ADVISOR ? "" : prev.github,
        // Common year across all academic years for Abhyudaya Developers
        year: isDevPreset
          ? ABHYUDAYA_DEV_COMMON_YEAR
          : prev.year === ABHYUDAYA_DEV_COMMON_YEAR
          ? selectedYear
          : prev.year,
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setIsFormDirty(true);

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
      // Auto-set common year when level is switched to Abhyudaya Developers
      if (name === "level") {
        if (value === LEVELS.WEB_DEV) {
          updated.year = ABHYUDAYA_DEV_COMMON_YEAR;
          updated.department = "Web Development";
          updated.category = "Abhyudaya Developers";
        } else if (prev.level === LEVELS.WEB_DEV) {
          updated.year = selectedYear;
        }
      }
      return updated;
    });

    if (name === "image") {
      setImagePreview(value);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WEBP, etc.).");
      return;
    }
    setSelectedFile(file);
    setIsFormDirty(true);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setImagePreview("");
    setFormData((prev) => ({ ...prev, image: "" }));
    setIsFormDirty(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Member full name is required.");
      return;
    }
    if (!formData.role.trim()) {
      toast.error("Member designation / role is required.");
      return;
    }
    if (!formData.image && !selectedFile) {
      toast.error("Please upload a profile photo or enter an image URL.");
      return;
    }
    if (formData.linkedin && !isValidUrl(formData.linkedin)) {
      toast.error("Please enter a valid LinkedIn URL (e.g. https://linkedin.com/in/username).");
      return;
    }
    if (formData.github && !isValidUrl(formData.github)) {
      toast.error("Please enter a valid GitHub URL (e.g. https://github.com/username).");
      return;
    }
    if (formData.instagram && !isValidUrl(formData.instagram)) {
      toast.error("Please enter a valid Instagram URL (e.g. https://instagram.com/username).");
      return;
    }
    if (formData.website && !isValidUrl(formData.website)) {
      toast.error("Please enter a valid Website URL (e.g. https://example.com).");
      return;
    }

    setSaving(true);
    // Abhyudaya Developers: permanent and common across all academic years
    const isDev =
      formData.level === LEVELS.WEB_DEV ||
      formData.department === "Web Development" ||
      formData.category === "Abhyudaya Developers";

    const targetYear = isDev
      ? ABHYUDAYA_DEV_COMMON_YEAR
      : String(formData.year || selectedYear).trim();

    const payload = {
      ...formData,
      year: targetYear,
      ...(isDev
        ? {
            level: LEVELS.WEB_DEV,
            department: "Web Development",
            category: "Abhyudaya Developers",
            batch: "common",
          }
        : {}),
    };

    try {
      if (editingMember) {
        await updateTeamMember(editingMember.id, payload, selectedFile);
        toast.success(
          isDev
            ? `Updated developer profile "${formData.name}" (Common across all academic years) successfully!`
            : `Updated "${formData.name}" for year ${targetYear} successfully!`
        );
      } else {
        await addTeamMember(payload, selectedFile);
        toast.success(
          isDev
            ? `Added developer profile "${formData.name}" (Common across all academic years) successfully!`
            : `Added "${formData.name}" to team ${targetYear} successfully!`
        );
      }
      setShowDrawer(false);
      resetForm();
      if (!isDev && targetYear !== selectedYear) {
        setSelectedYear(targetYear);
      }
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save team member.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active / Inactive
  const handleToggleActive = async (member, e) => {
    if (e) e.stopPropagation();
    const newStatus = member.active === false ? true : false;
    try {
      setStatusUpdatingId(member.id);
      await setTeamMemberActive(member.id, newStatus);
      toast.success(
        newStatus
          ? `Activated "${member.name}" — now visible on public site.`
          : `Deactivated "${member.name}" — hidden from public site.`
      );
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update member status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Delete Action via Modal
  const openDeleteModal = (member, e) => {
    if (e) e.stopPropagation();
    setDeleteModalMember(member);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalMember) return;
    setIsDeleting(true);
    try {
      await deleteTeamMember(deleteModalMember.id);
      toast.success(`Permanently deleted "${deleteModalMember.name}".`);
      setDeleteModalMember(null);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to delete team member.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalDeactivate = async () => {
    if (!deleteModalMember) return;
    setIsDeleting(true);
    try {
      await setTeamMemberActive(deleteModalMember.id, false);
      toast.success(`Deactivated "${deleteModalMember.name}" — hidden from public site.`);
      setDeleteModalMember(null);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to deactivate member.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isFacultyRole = formData.level === LEVELS.FACULTY_ADVISOR;
  /** Abhyudaya Developers members are permanent and common across all academic years. */
  const isAbhyudayaDev =
    formData.level === LEVELS.WEB_DEV ||
    formData.department === "Web Development" ||
    formData.category === "Abhyudaya Developers";

  // Helper for tier color badges
  const getTierBadgeClass = (level) => {
    switch (level) {
      case LEVELS.FACULTY_ADVISOR:
        return "badge-faculty";
      case LEVELS.LEADERSHIP:
        return "badge-leadership";
      case LEVELS.CORE:
        return "badge-core";
      case LEVELS.WEB_DEV:
        return "badge-webdev";
      default:
        return "badge-exec";
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar />

        <div className="dashboard-content">
          <div className="admin-team-page">
            {/* 1. Header with Breadcrumb, Year Selector & Primary CTA */}
            <div className="team-header-container">
              <div className="team-header-main">
                <nav className="team-breadcrumb" aria-label="Breadcrumb">
                  <Link to="/admin/dashboard">Dashboard</Link>
                  <span className="team-breadcrumb-sep">/</span>
                  <span>Team Management</span>
                  <span className="team-breadcrumb-sep">/</span>
                  <span className="team-year-badge-breadcrumb">AY {selectedYear}</span>
                </nav>
                <div className="team-title-row">
                  <h1 className="team-heading">Team Management</h1>
                  <span className="team-count-badge">
                    <FaUsers /> {yearMembers.length} {yearMembers.length === 1 ? "Member" : "Members"} &bull; AY {selectedYear}
                  </span>
                </div>
                <p className="team-header-desc">
                  Institutional administration directory for faculty advisors, student leadership, domain leads, and executive committees for academic year {selectedYear}.
                </p>
              </div>

              <div className="team-header-actions">
                {/* Academic Year Control Group */}
                <div className="team-year-picker-container">
                  <label htmlFor="team-year-selector-admin" className="team-year-picker-label">
                    <FaCalendarAlt /> Academic Year:
                  </label>
                  <div className="team-year-select-wrap">
                    <select
                      id="team-year-selector-admin"
                      className="team-year-picker-select"
                      value={selectedYear}
                      onChange={(e) => {
                        if (e.target.value === "__add_new__") {
                          handleOpenAddYearModal();
                        } else {
                          setSelectedYear(e.target.value);
                        }
                      }}
                      title="Choose academic or executive year to manage"
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          AY {yr} {yr === "2026" ? "(Current)" : ""}
                        </option>
                      ))}
                      <option value="__add_new__">+ Add New Year...</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="team-btn-add-year"
                    onClick={handleOpenAddYearModal}
                    title="Initialize a new academic or executive year"
                  >
                    <FaCalendarPlus /> Add Year
                  </button>
                </div>

                <div className="team-export-dropdown-wrap">
                  <button
                    type="button"
                    className="team-btn-secondary"
                    onClick={handleExportCSV}
                    title="Export academic year roster to CSV"
                  >
                    <FaFileCsv /> Export CSV
                  </button>
                  <button
                    type="button"
                    className="team-btn-secondary"
                    onClick={() => window.print()}
                    title="Print or export PDF of roster"
                  >
                    <FaPrint /> Print
                  </button>
                </div>

                <a
                  href={`/team?year=${selectedYear}`}
                  target="_blank"
                  rel="noreferrer"
                  className="team-btn-secondary"
                  title="Preview official public team page for this year"
                >
                  <FaExternalLinkAlt /> View Public Page
                </a>
                <button
                  type="button"
                  className="team-btn-primary"
                  onClick={() => handleOpenDrawer()}
                >
                  <FaPlus /> Add Member ({selectedYear})
                </button>
              </div>
            </div>

            {/* 2. Compact Institutional Summary Section */}
            <div className="team-roster-summary" role="region" aria-label="Team Summary Statistics">
              <div
                className={`team-summary-item ${activeTab === "ALL" && !hasActiveFilters ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("ALL");
                  setSelectedDept("ALL");
                }}
                role="button"
                tabIndex={0}
                title="View total roster"
              >
                <div className="team-summary-icon icon-total">
                  <FaUsers />
                </div>
                <div className="team-summary-data">
                  <span className="team-summary-num">{stats.total}</span>
                  <span className="team-summary-label">Total Roster</span>
                </div>
              </div>

              <div className="team-summary-divider" />

              <div
                className={`team-summary-item ${activeTab === "ACTIVE" ? "active" : ""}`}
                onClick={() => setActiveTab("ACTIVE")}
                role="button"
                tabIndex={0}
                title="Filter active public members"
              >
                <div className="team-summary-icon icon-active">
                  <FaUserCheck />
                </div>
                <div className="team-summary-data">
                  <span className="team-summary-num">{stats.activeCount}</span>
                  <span className="team-summary-label">Active / Public</span>
                </div>
              </div>

              <div className="team-summary-divider" />

              <div
                className={`team-summary-item ${activeTab === "LEADERSHIP" ? "active" : ""}`}
                onClick={() => setActiveTab("LEADERSHIP")}
                role="button"
                tabIndex={0}
                title="Filter student leadership"
              >
                <div className="team-summary-icon icon-leadership">
                  <FaCrown />
                </div>
                <div className="team-summary-data">
                  <span className="team-summary-num">{stats.leadershipCount}</span>
                  <span className="team-summary-label">Leadership</span>
                </div>
              </div>

              <div className="team-summary-divider" />

              <div
                className={`team-summary-item ${activeTab === "CORE" ? "active" : ""}`}
                onClick={() => setActiveTab("CORE")}
                role="button"
                tabIndex={0}
                title="Filter core domain leads"
              >
                <div className="team-summary-icon icon-core">
                  <FaUserTie />
                </div>
                <div className="team-summary-data">
                  <span className="team-summary-num">{stats.coreCount}</span>
                  <span className="team-summary-label">Core Leads</span>
                </div>
              </div>

              <div className="team-summary-divider" />

              <div
                className={`team-summary-item ${activeTab === "EXECUTIVE" ? "active" : ""}`}
                onClick={() => setActiveTab("EXECUTIVE")}
                role="button"
                tabIndex={0}
                title="Filter domain executives"
              >
                <div className="team-summary-icon icon-exec">
                  <FaAward />
                </div>
                <div className="team-summary-data">
                  <span className="team-summary-num">{stats.execCount}</span>
                  <span className="team-summary-label">Executives</span>
                </div>
              </div>

              <div className="team-summary-divider" />

              <div
                className={`team-summary-item ${activeTab === "WEB_DEV" ? "active" : ""}`}
                onClick={() => setActiveTab("WEB_DEV")}
                role="button"
                tabIndex={0}
                title="Filter Abhyudaya Developers"
              >
                <div className="team-summary-icon icon-webdev">
                  <FaLaptopCode />
                </div>
                <div className="team-summary-data">
                  <span className="team-summary-num">{stats.webDevCount}</span>
                  <span className="team-summary-label">Abhyudaya Developers</span>
                </div>
              </div>

              <div className="team-summary-divider" />

              <div
                className={`team-summary-item ${activeTab === "FACULTY" ? "active" : ""}`}
                onClick={() => setActiveTab("FACULTY")}
                role="button"
                tabIndex={0}
                title="Filter faculty advisors"
              >
                <div className="team-summary-icon icon-faculty">
                  <FaChalkboardTeacher />
                </div>
                <div className="team-summary-data">
                  <span className="team-summary-num">{stats.facultyCount}</span>
                  <span className="team-summary-label">Faculty</span>
                </div>
              </div>
            </div>

            {/* 3. Controls Bar: Category Tabs, Search, Dept filter, and View toggle */}
            <div className="team-controls-panel">
              {/* Category Filter Tabs */}
              <div className="team-controls-top">
                <div className="team-filter-tabs">
                  {[
                    { id: "ALL", label: "All Members" },
                    { id: "LEADERSHIP", label: "Leadership" },
                    { id: "CORE", label: "Core Leads" },
                    { id: "EXECUTIVE", label: "Executives" },
                    { id: "WEB_DEV", label: "Abhyudaya Developers" },
                    { id: "FACULTY", label: "Faculty" },
                    { id: "ACTIVE", label: "Active" },
                    { id: "INACTIVE", label: "Inactive" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`team-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <span className="team-tab-label">{tab.label}</span>
                      <span className="team-tab-count">{getTabCount(tab.id)}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={loadData}
                  className="team-btn-refresh"
                  title="Synchronize team members from database"
                >
                  <FaRedo /> Refresh
                </button>
              </div>

              {/* Search, Department Filter, and View Mode Toggle */}
              <div className="team-controls-bottom">
                <div className="team-search-dept-wrap">
                  <div className="team-search-box">
                    <FaSearch className="team-search-icon" />
                    <input
                      type="text"
                      className="team-search-input"
                      placeholder="Search member name, role, department, bio..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        className="team-search-clear"
                        onClick={() => setSearchTerm("")}
                        title="Clear search query"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>

                  <select
                    className="team-dept-select"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    title="Filter by Department / Vertical"
                  >
                    <option value="ALL">All Departments</option>
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  <select
                    className="team-status-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    title="Filter by Status"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active (Public)</option>
                    <option value="INACTIVE">Inactive (Hidden)</option>
                  </select>

                  <select
                    className="team-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    title="Sort members roster"
                  >
                    <option value="order">Sort: Display Order</option>
                    <option value="name_asc">Sort: Name (A – Z)</option>
                    <option value="name_desc">Sort: Name (Z – A)</option>
                    <option value="role">Sort: Designation</option>
                    <option value="dept">Sort: Department</option>
                  </select>
                </div>

                <div className="team-view-actions">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="team-reset-btn"
                      onClick={handleResetFilters}
                      title="Clear all active filters"
                    >
                      <FaFilter /> Reset Filters
                    </button>
                  )}

                  <div className="team-view-toggle">
                    <button
                      type="button"
                      className={`team-view-btn ${viewMode === "grid" ? "active" : ""}`}
                      onClick={() => setViewMode("grid")}
                      title="Grid Card View"
                    >
                      <FaThLarge />
                    </button>
                    <button
                      type="button"
                      className={`team-view-btn ${viewMode === "table" ? "active" : ""}`}
                      onClick={() => setViewMode("table")}
                      title="Table List View"
                    >
                      <FaList />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Content Listing (Loading Skeleton, Empty State, Grid View, or Table View) */}
            {loading ? (
              <div className="team-skeleton-grid">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="team-skeleton-card">
                    <div className="team-skeleton-img skeleton-shimmer" />
                    <div className="team-skeleton-body">
                      <div className="team-skeleton-line skeleton-shimmer" style={{ width: "60%" }} />
                      <div className="team-skeleton-line skeleton-shimmer" style={{ width: "85%" }} />
                      <div className="team-skeleton-line skeleton-shimmer" style={{ width: "40%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="team-empty-state">
                <div className="team-empty-icon">
                  <FaUsers />
                </div>
                <h3 className="team-empty-title">
                  {hasActiveFilters
                    ? `No matching team members in ${selectedYear}`
                    : `No team members found for ${selectedYear}`}
                </h3>
                <p className="team-empty-desc">
                  {hasActiveFilters
                    ? "Try adjusting your search terms, changing the department, or resetting filters."
                    : `No profiles have been added for the ${selectedYear} team roster yet. You can initialize this year's roster now.`}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="team-btn-secondary"
                    onClick={handleResetFilters}
                  >
                    Clear All Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    className="team-btn-primary"
                    onClick={() => handleOpenDrawer()}
                  >
                    <FaPlus /> Add First Member for {selectedYear}
                  </button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              /* GRID VIEW */
              <div className="team-members-grid">
                {filteredMembers.map((member) => {
                  const isActive = member.active !== false;
                  const tierClass = getTierBadgeClass(member.level);
                  const isSelected = selectedMemberIds.includes(member.id);

                  return (
                    <div
                      key={member.id}
                      className={`team-card ${!isActive ? "inactive-card" : ""} ${isSelected ? "selected-card" : ""}`}
                    >
                      {/* Selection Checkbox */}
                      <div
                        className={`team-card-select-btn ${isSelected ? "selected" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectMember(member.id);
                        }}
                        title={isSelected ? "Deselect member" : "Select member"}
                      >
                        {isSelected ? <FaCheckSquare /> : <FaSquare />}
                      </div>

                      {/* Image & Header Badges */}
                      <div className="team-card-image-wrap">
                        {member.image ? (
                          <img
                            src={member.image}
                            alt={member.name}
                            className="team-card-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="team-card-avatar-fallback">
                            <FaUserTie />
                          </div>
                        )}

                        {/* Tier Badge */}
                        <span className={`team-badge-tier ${tierClass}`}>
                          {LEVEL_LABELS[member.level] || member.level}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`team-badge-status ${
                            isActive ? "status-active" : "status-inactive"
                          }`}
                        >
                          <span className="team-badge-status-dot" />
                          {isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="team-card-body">
                        <div className="team-card-meta-row">
                          <span className="team-dept-pill">
                            {member.department || "General"}
                          </span>
                          <span className="team-order-pill">Order: #{member.order ?? 99}</span>
                        </div>

                        <h3 className="team-card-name">{member.name}</h3>
                        <div className="team-card-role">{member.role}</div>

                        {member.bio ? (
                          <p className="team-card-bio">{member.bio}</p>
                        ) : (
                          <div style={{ minHeight: "18px" }} />
                        )}

                        <div className="team-card-socials">
                          {member.email && (
                            <a
                              href={`mailto:${member.email}`}
                              className="team-email-link"
                              title={`Email: ${member.email}`}
                            >
                              <FaEnvelope style={{ marginRight: "4px" }} />
                              {member.email}
                            </a>
                          )}

                          <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                            {member.linkedin && (
                              <a
                                href={member.linkedin}
                                target="_blank"
                                rel="noreferrer"
                                className="team-social-icon-btn"
                                title={`LinkedIn: ${member.linkedin}`}
                              >
                                <FaLinkedin />
                              </a>
                            )}
                            {member.github && (
                              <a
                                href={member.github}
                                target="_blank"
                                rel="noreferrer"
                                className="team-social-icon-btn"
                                title={`GitHub: ${member.github}`}
                              >
                                <FaGithub />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="team-card-footer">
                        <button
                          type="button"
                          className={`team-toggle-active-btn ${
                            isActive ? "btn-is-active" : "btn-is-inactive"
                          }`}
                          onClick={(e) => handleToggleActive(member, e)}
                          disabled={statusUpdatingId === member.id}
                          title={isActive ? "Deactivate member" : "Activate member"}
                        >
                          {isActive ? <FaToggleOn /> : <FaToggleOff />}
                          <span>{isActive ? "Active" : "Hidden"}</span>
                        </button>

                        <div className="team-action-buttons">
                          <button
                            type="button"
                            className="team-action-edit-btn"
                            onClick={() => handleOpenDrawer(member)}
                            title="Edit member details"
                          >
                            <FaEdit /> Edit
                          </button>
                          <button
                            type="button"
                            className="team-action-delete-btn"
                            onClick={(e) => openDeleteModal(member, e)}
                            title="Delete or deactivate member"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="team-table-container">
                <div className="team-table-wrap">
                  <table className="team-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: "36px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={
                              filteredMembers.length > 0 &&
                              filteredMembers.every((m) => selectedMemberIds.includes(m.id))
                            }
                            onChange={handleSelectAllVisible}
                            title="Select or deselect all visible members"
                          />
                        </th>
                        <th>Member</th>
                        <th>Role &amp; Tier</th>
                        <th>Department</th>
                        <th>Order</th>
                        <th>Status</th>
                        <th>Profiles</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((member) => {
                        const isActive = member.active !== false;
                        const tierClass = getTierBadgeClass(member.level);
                        const isSelected = selectedMemberIds.includes(member.id);

                        return (
                          <tr
                            key={member.id}
                            className={`${!isActive ? "inactive-row" : ""} ${isSelected ? "selected-row" : ""}`}
                          >
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectMember(member.id)}
                                title={isSelected ? "Deselect member" : "Select member"}
                              />
                            </td>
                            <td>
                              <div className="team-table-member-cell">
                                {member.image ? (
                                  <img
                                    src={member.image}
                                    alt={member.name}
                                    className="team-table-thumb"
                                  />
                                ) : (
                                  <div className="team-table-thumb-fallback">
                                    <FaUserTie />
                                  </div>
                                )}
                                <div className="team-table-name-wrap">
                                  <span className="team-table-name">{member.name}</span>
                                  {member.email && (
                                    <span className="team-table-email">{member.email}</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="team-table-role">
                                {member.role}
                              </div>
                              <span
                                className={`team-badge-tier ${tierClass}`}
                                style={{
                                  position: "static",
                                  display: "inline-block",
                                  marginTop: "4px",
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                }}
                              >
                                {LEVEL_LABELS[member.level] || member.level}
                              </span>
                            </td>

                            <td>
                              <span className="team-dept-pill">
                                {member.department || "General"}
                              </span>
                            </td>

                            <td>
                              <span className="team-order-pill">#{member.order ?? 99}</span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className={`team-toggle-active-btn ${
                                  isActive ? "btn-is-active" : "btn-is-inactive"
                                }`}
                                onClick={(e) => handleToggleActive(member, e)}
                                disabled={statusUpdatingId === member.id}
                                title={isActive ? "Deactivate member" : "Activate member"}
                              >
                                {isActive ? <FaToggleOn /> : <FaToggleOff />}
                                <span>{isActive ? "Active" : "Hidden"}</span>
                              </button>
                            </td>

                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {member.linkedin && (
                                  <a
                                    href={member.linkedin}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="team-social-icon-btn"
                                    title={`LinkedIn: ${member.linkedin}`}
                                  >
                                    <FaLinkedin />
                                  </a>
                                )}
                                {member.github && (
                                  <a
                                    href={member.github}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="team-social-icon-btn"
                                    title={`GitHub: ${member.github}`}
                                  >
                                    <FaGithub />
                                  </a>
                                )}
                              </div>
                            </td>

                            <td style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <button
                                  type="button"
                                  className="team-action-edit-btn"
                                  onClick={() => handleOpenDrawer(member)}
                                >
                                  <FaEdit /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="team-action-delete-btn"
                                  onClick={(e) => openDeleteModal(member, e)}
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Multi-Select Floating Action Bar */}
            {selectedMemberIds.length > 0 && (
              <div
                className="team-multiselect-bar"
                role="toolbar"
                aria-label="Bulk actions for selected members"
              >
                <div className="team-multiselect-left">
                  <span className="team-multiselect-count-badge">
                    {selectedMemberIds.length}
                  </span>
                  <span className="team-multiselect-text">
                    {selectedMemberIds.length === 1
                      ? "1 member selected"
                      : `${selectedMemberIds.length} members selected`}
                  </span>
                </div>

                <div className="team-multiselect-actions">
                  <button
                    type="button"
                    className="team-multiselect-btn btn-publish"
                    onClick={() => handleBatchToggleActive(true)}
                    title="Publish/Activate selected members"
                  >
                    <FaToggleOn /> Publish Selected
                  </button>

                  <button
                    type="button"
                    className="team-multiselect-btn btn-unpublish"
                    onClick={() => handleBatchToggleActive(false)}
                    title="Unpublish/Hide selected members"
                  >
                    <FaToggleOff /> Unpublish Selected
                  </button>

                  <button
                    type="button"
                    className="team-multiselect-btn btn-move"
                    onClick={handleOpenMoveYearModal}
                    title="Move selected members to another academic year (Abhyudaya Developers are protected)"
                  >
                    <FaExchangeAlt /> Move Year
                  </button>

                  <button
                    type="button"
                    className="team-multiselect-btn btn-delete"
                    onClick={() => setShowBatchDeleteModal(true)}
                    title="Delete selected members"
                  >
                    <FaTrash /> Delete Selected
                  </button>

                  <button
                    type="button"
                    className="team-multiselect-btn btn-clear"
                    onClick={handleClearSelection}
                    title="Deselect all"
                  >
                    <FaTimes /> Deselect
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. ADD / EDIT TEAM MEMBER DRAWER */}
          {showDrawer && (
            <>
              <div className="team-drawer-backdrop" onClick={handleCloseDrawer} />

              <div className="team-drawer-panel">
                <div className="team-drawer-header">
                  <div className="team-drawer-title-wrap">
                    <div className="team-drawer-icon">
                      {editingMember ? <FaEdit /> : <FaPlus />}
                    </div>
                    <div>
                      <h2 className="team-drawer-title">
                        {editingMember ? "Edit Team Member" : "Add New Team Member"}
                      </h2>
                      <p className="team-drawer-subtitle">
                        {editingMember
                          ? `Updating profile for ${editingMember.name}`
                          : "Fill out member details and public role."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="team-drawer-close-btn"
                    onClick={handleCloseDrawer}
                    title="Close form"
                  >
                    <FaTimes />
                  </button>
                </div>

                <form className="team-drawer-body" onSubmit={handleSubmit}>
                  {/* SECTION 1: PROFILE DETAILS */}
                  <div className="team-form-section">
                    <div className="team-form-section-header">
                      <span>01.</span> Profile Details
                    </div>

                    {/* Image Dropzone & Preview */}
                    <div className="team-form-group">
                      <label className="team-form-label">
                        Profile Photo <span className="team-form-required">*</span>
                      </label>

                      <div
                        className={`team-image-uploader ${isDragOver ? "dragover" : ""}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <div className="team-image-preview-box">
                          {imagePreview ? (
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="team-image-preview-img"
                            />
                          ) : (
                            <FaImage className="team-image-placeholder-icon" />
                          )}
                        </div>

                        <div className="team-image-controls">
                          <div className="team-image-buttons">
                            <label className="team-upload-btn-label">
                              <FaUpload /> Upload Image
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileInputChange}
                                style={{ display: "none" }}
                              />
                            </label>

                            {imagePreview && (
                              <button
                                type="button"
                                className="team-image-clear-btn"
                                onClick={handleClearImage}
                              >
                                Clear Photo
                              </button>
                            )}
                          </div>
                          <span className="team-form-hint">
                            {selectedFile
                              ? `Selected: ${selectedFile.name}`
                              : "Drag & drop image or provide a direct image URL below:"}
                          </span>
                        </div>
                      </div>

                      <input
                        type="url"
                        name="image"
                        className="team-form-input"
                        placeholder="https://example.com/photo.jpg"
                        value={formData.image}
                        onChange={handleInputChange}
                        style={{ marginTop: "6px" }}
                      />
                    </div>

                    <div className="team-form-row">
                      <div className="team-form-group">
                        <label className="team-form-label">
                          Full Name <span className="team-form-required">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          className="team-form-input"
                          placeholder="e.g. Virat Mishra"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>

                      <div className="team-form-group">
                        <label className="team-form-label">Email Address</label>
                        <input
                          type="email"
                          name="email"
                          className="team-form-input"
                          placeholder="e.g. virat@abhyudaya.org"
                          value={formData.email}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="team-form-group">
                      <label className="team-form-label">Short Bio / Description</label>
                      <textarea
                        name="bio"
                        className="team-form-textarea"
                        rows="3"
                        placeholder="Brief summary of their focus, responsibilities, or background..."
                        value={formData.bio}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="team-form-group">
                      <label className="team-form-label">
                        <FaQuoteLeft style={{ marginRight: "6px", color: "var(--admin-gold)" }} />
                        Personal Quote / Motto
                      </label>
                      <input
                        type="text"
                        name="quote"
                        className="team-form-input"
                        placeholder='e.g. "Innovate, build, and inspire the future."'
                        value={formData.quote || ""}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* SECTION 2: ROLE & VERTICAL */}
                  <div className="team-form-section">
                    <div className="team-form-section-header">
                      <span>02.</span> Role &amp; Hierarchy
                    </div>

                    <div className="team-form-group">
                      <label className="team-form-label">Quick Role Preset</label>
                      <select
                        className="team-form-select"
                        value={selectedPreset}
                        onChange={(e) => handlePresetChange(e.target.value)}
                      >
                        <optgroup label="Faculty Advisory">
                          <option value="Faculty Advisor">Faculty Advisor</option>
                        </optgroup>
                        <optgroup label="The Leadership">
                          <option value="President">President</option>
                          <option value="Vice President">Vice President</option>
                          <option value="General Secretary">General Secretary</option>
                        </optgroup>
                        <optgroup label="The Core Team (Domain Leads)">
                          <option value="Operations Lead">Operations Lead</option>
                          <option value="Technical Lead">Technical Lead</option>
                          <option value="PR Lead">PR Lead</option>
                        </optgroup>
                        <optgroup label="Abhyudaya Developers">
                          <option value="Web Developer">Web Developer</option>
                          <option value="Frontend Developer">Frontend Developer</option>
                          <option value="Full Stack Developer">Full Stack Developer</option>
                        </optgroup>
                        <optgroup label="Department Executives">
                          <option value="Operations Executive">Operations Executive</option>
                          <option value="Technical Executive">Technical Executive</option>
                          <option value="PR Executive">PR Executive</option>
                          <option value="custom">Custom Role / Other Executive</option>
                        </optgroup>
                      </select>
                      <span className="team-form-hint">
                        Selecting a preset automatically sets appropriate tier and department.
                      </span>
                    </div>

                    <div className="team-form-group">
                      <label className="team-form-label">
                        Role / Designation Title <span className="team-form-required">*</span>
                      </label>
                      <input
                        type="text"
                        name="role"
                        className="team-form-input"
                        placeholder="e.g. Technical Lead"
                        value={formData.role}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="team-form-row">
                      <div className="team-form-group">
                        <label className="team-form-label">
                          Tier Level <span className="team-form-required">*</span>
                        </label>
                        <select
                          name="level"
                          className="team-form-select"
                          value={formData.level}
                          onChange={handleInputChange}
                        >
                          <option value={LEVELS.FACULTY_ADVISOR}>Faculty Advisor</option>
                          <option value={LEVELS.LEADERSHIP}>The Leadership</option>
                          <option value={LEVELS.CORE}>Core Team</option>
                          <option value={LEVELS.EXECUTIVE}>Executive</option>
                          <option value={LEVELS.WEB_DEV}>Abhyudaya Developers</option>
                        </select>
                      </div>

                      <div className="team-form-group">
                        <label className="team-form-label">
                          Department / Vertical <span className="team-form-required">*</span>
                        </label>
                        <select
                          name="department"
                          className="team-form-select"
                          value={formData.department}
                          onChange={handleInputChange}
                        >
                          {DEPARTMENT_OPTIONS.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="team-form-row">
                      <div className="team-form-group">
                        <label className="team-form-label">
                          Academic / Team Year <span className="team-form-required">*</span>
                        </label>
                        {isAbhyudayaDev ? (
                          /* Abhyudaya Developers are permanent and common across all academic years */
                          <div className="team-form-locked-field">
                            <span className="team-form-locked-value">Common Across All Years</span>
                            <span className="team-form-locked-badge">Permanent</span>
                          </div>
                        ) : (
                          <select
                            name="year"
                            className="team-form-select"
                            value={formData.year}
                            onChange={handleInputChange}
                          >
                            {availableYears.map((yr) => (
                              <option key={yr} value={yr}>
                                {yr} {yr === "2026" ? "(Current)" : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        <span className="team-form-hint">
                          {isAbhyudayaDev
                            ? "Abhyudaya Developers are permanent and common across all academic years."
                            : `Profile will be published under the ${formData.year} roster.`}
                        </span>
                      </div>

                      <div className="team-form-group">
                        <label className="team-form-label">Display Order Priority</label>
                        <input
                          type="number"
                          name="order"
                          className="team-form-input"
                          min="1"
                          placeholder="1, 2, 3..."
                          value={formData.order}
                          onChange={handleInputChange}
                        />
                        <span className="team-form-hint">
                          Lower numbers appear first within the same tier.
                        </span>
                      </div>
                    </div>

                    <div className="team-form-row">
                      <div className="team-form-group">
                        <label className="team-form-label">Public Status</label>
                        <select
                          name="active"
                          className="team-form-select"
                          value={formData.active ? "true" : "false"}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              active: e.target.value === "true",
                            }))
                          }
                          style={{
                            color: formData.active ? "#4ade80" : "#f87171",
                            fontWeight: "600",
                          }}
                        >
                          <option value="true">Active (Visible on public site)</option>
                          <option value="false">Inactive (Hidden from public site)</option>
                        </select>
                      </div>

                      <div className="team-form-group">
                        <label className="team-form-label">
                          <FaStar style={{ marginRight: "4px", color: "var(--admin-gold)" }} />
                          Featured Spotlight
                        </label>
                        <select
                          name="featured"
                          className="team-form-select"
                          value={formData.featured ? "true" : "false"}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              featured: e.target.value === "true",
                            }))
                          }
                        >
                          <option value="false">Standard Member</option>
                          <option value="true">Featured (Showcase Spotlight)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: PUBLIC PROFILE & SOCIAL LINKS */}
                  <div className="team-form-section">
                    <div className="team-form-section-header">
                      <span>03.</span> Public Profile &amp; Social Links
                    </div>

                    <div className="team-form-group">
                      <label className="team-form-label">
                        <FaLinkedin style={{ color: "#0077b5" }} /> LinkedIn Profile URL
                      </label>
                      <input
                        type="url"
                        name="linkedin"
                        className="team-form-input"
                        placeholder="https://www.linkedin.com/in/username"
                        value={formData.linkedin}
                        onChange={handleInputChange}
                      />
                    </div>

                    {!isFacultyRole && (
                      <div className="team-form-group">
                        <label className="team-form-label">
                          <FaGithub /> GitHub Profile URL
                        </label>
                        <input
                          type="url"
                          name="github"
                          className="team-form-input"
                          placeholder="https://github.com/username"
                          value={formData.github}
                          onChange={handleInputChange}
                        />
                      </div>
                    )}

                    <div className="team-form-group">
                      <label className="team-form-label">
                        <FaInstagram style={{ color: "#e1306c" }} /> Instagram Profile URL
                      </label>
                      <input
                        type="url"
                        name="instagram"
                        className="team-form-input"
                        placeholder="https://instagram.com/username"
                        value={formData.instagram}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="team-form-group">
                      <label className="team-form-label">
                        <FaGlobe style={{ color: "#38bdf8" }} /> Portfolio / Personal Website URL
                      </label>
                      <input
                        type="url"
                        name="website"
                        className="team-form-input"
                        placeholder="https://viratmishra.dev"
                        value={formData.website}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Drawer Footer Actions */}
                  <div className="team-drawer-footer">
                    <button
                      type="button"
                      className="team-drawer-btn-cancel"
                      onClick={handleCloseDrawer}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="team-drawer-btn-save"
                      disabled={saving}
                    >
                      {saving ? (
                        "Saving to Firebase..."
                      ) : editingMember ? (
                        "Save Changes"
                      ) : (
                        "Add Team Member"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* 6. DELETE / DEACTIVATE CONFIRMATION MODAL */}
          {deleteModalMember && (
            <div
              className="team-modal-backdrop"
              onClick={() => setDeleteModalMember(null)}
            >
              <div
                className="team-modal-box"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div className="team-modal-icon-wrap modal-icon-danger">
                    <FaExclamationTriangle />
                  </div>
                  <div>
                    <h3 className="team-modal-title">
                      Remove &ldquo;{deleteModalMember.name}&rdquo;?
                    </h3>
                    <p className="team-modal-desc">
                      Choose whether to hide this member from the public website or permanently delete their record.
                    </p>
                  </div>
                </div>

                <div className="team-modal-info-box">
                  <strong>Role:</strong> {deleteModalMember.role} ({deleteModalMember.department || "No Department"})
                  <br />
                  <strong>Current Status:</strong>{" "}
                  <span className={deleteModalMember.active !== false ? "modal-status-active" : "modal-status-inactive"}>
                    {deleteModalMember.active !== false ? "Active (Visible)" : "Inactive (Hidden)"}
                  </span>
                </div>

                <div className="team-modal-actions">
                  <button
                    type="button"
                    className="team-modal-btn-cancel"
                    onClick={() => setDeleteModalMember(null)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>

                  {deleteModalMember.active !== false && (
                    <button
                      type="button"
                      className="team-modal-btn-deactivate"
                      onClick={handleModalDeactivate}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Updating..." : "Deactivate (Hide)"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="team-modal-btn-danger"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete Permanently"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 7. UNSAVED CHANGES CONFIRMATION MODAL */}
          {showUnsavedModal && (
            <div
              className="team-modal-backdrop"
              onClick={() => setShowUnsavedModal(false)}
            >
              <div
                className="team-modal-box"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div className="team-modal-icon-wrap modal-icon-warning">
                    <FaExclamationTriangle />
                  </div>
                  <div>
                    <h3 className="team-modal-title">Unsaved Changes</h3>
                    <p className="team-modal-desc">
                      You have unsaved changes in the team member form. Are you sure you want to discard them and close?
                    </p>
                  </div>
                </div>

                <div className="team-modal-actions">
                  <button
                    type="button"
                    className="team-modal-btn-cancel"
                    onClick={() => setShowUnsavedModal(false)}
                  >
                    Keep Editing
                  </button>
                  <button
                    type="button"
                    className="team-modal-btn-danger"
                    onClick={confirmDiscardChanges}
                  >
                    Discard Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 8. INITIALIZE NEW YEAR MODAL */}
          {showAddYearModal && (
            <div
              className="team-modal-backdrop"
              onClick={() => !isAddingYear && setShowAddYearModal(false)}
            >
              <div
                className="team-modal-box team-add-year-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div className="team-modal-icon-wrap modal-icon-primary">
                    <FaCalendarPlus />
                  </div>
                  <div>
                    <h3 className="team-modal-title">Initialize New Team Year</h3>
                    <p className="team-modal-desc">
                      Create a new academic or executive roster year (e.g. 2027, 2028, 2029) to manage its leadership and domain team profiles.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleConfirmAddYear}>
                  <div className="team-form-group" style={{ marginTop: "16px" }}>
                    <label className="team-form-label">
                      Academic / Executive Year <span className="team-form-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="team-form-input"
                      placeholder="e.g. 2027 or 2027-28"
                      value={newYearInput}
                      onChange={(e) => setNewYearInput(e.target.value)}
                      autoFocus
                      required
                    />
                    <div className="team-quick-year-pills">
                      <span className="team-form-hint">Quick suggestions:</span>
                      {["2027", "2028", "2029", "2030"]
                        .filter((y) => !availableYears.includes(y))
                        .slice(0, 3)
                        .map((suggestedYear) => (
                          <button
                            key={suggestedYear}
                            type="button"
                            className="team-year-suggestion-pill"
                            onClick={() => setNewYearInput(suggestedYear)}
                          >
                            +{suggestedYear}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="team-modal-actions" style={{ marginTop: "20px" }}>
                    <button
                      type="button"
                      className="team-modal-btn-cancel"
                      onClick={() => setShowAddYearModal(false)}
                      disabled={isAddingYear}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="team-btn-primary"
                      disabled={isAddingYear || !newYearInput.trim()}
                      style={{ padding: "8px 18px", fontSize: "13px" }}
                    >
                      {isAddingYear ? (
                        "Initializing..."
                      ) : (
                        <>
                          <FaCheck /> Initialize Year
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 9. MOVE YEAR MODAL WITH ABHYUDAYA DEVELOPERS PROTECTION */}
          {showMoveYearModal && (
            <div
              className="team-modal-backdrop"
              onClick={() => !isMovingYear && setShowMoveYearModal(false)}
            >
              <div
                className="team-modal-box team-add-year-modal"
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const selectedMembers = yearMembers.filter((m) =>
                    selectedMemberIds.includes(m.id)
                  );
                  const devMembers = selectedMembers.filter(isAbhyudayaDeveloper);
                  const eligibleMembers = selectedMembers.filter(
                    (m) => !isAbhyudayaDeveloper(m)
                  );

                  return (
                    <>
                      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                        <div className="team-modal-icon-wrap modal-icon-primary">
                          <FaExchangeAlt />
                        </div>
                        <div>
                          <h3 className="team-modal-title">Move Members to Another Year</h3>
                          <p className="team-modal-desc">
                            Reassign selected member profiles from Academic Year {selectedYear} to an upcoming academic roster.
                          </p>
                        </div>
                      </div>

                      {devMembers.length > 0 && (
                        <div
                          style={{
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            padding: "10px 14px",
                            borderRadius: "var(--admin-radius)",
                            marginTop: "14px",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px",
                          }}
                        >
                          <FaExclamationTriangle
                            style={{ color: "#d97706", marginTop: "2px", flexShrink: 0 }}
                          />
                          <div style={{ fontSize: "12px", color: "#92400e", lineHeight: "1.45" }}>
                            <strong>Abhyudaya Developers Protection Notice:</strong>
                            <br />
                            {devMembers.length} selected member(s) ({devMembers.map((d) => d.name).join(", ")}) belong to
                            Abhyudaya Developers. They are permanently common across all academic years and will remain protected. Only the other {eligibleMembers.length} member(s) will be moved.
                          </div>
                        </div>
                      )}

                      <div className="team-form-group" style={{ marginTop: "16px" }}>
                        <label className="team-form-label">
                          Destination Academic Year ({eligibleMembers.length} members to move)
                        </label>
                        <select
                          className="team-form-select"
                          value={targetMoveYear}
                          onChange={(e) => setTargetMoveYear(e.target.value)}
                          disabled={isMovingYear}
                        >
                          {availableYears
                            .filter((y) => y !== selectedYear)
                            .map((yr) => (
                              <option key={yr} value={yr}>
                                Academic Year {yr}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="team-modal-actions" style={{ marginTop: "20px" }}>
                        <button
                          type="button"
                          className="team-modal-btn-cancel"
                          onClick={() => setShowMoveYearModal(false)}
                          disabled={isMovingYear}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="team-btn-primary"
                          onClick={handleConfirmMoveYear}
                          disabled={isMovingYear || eligibleMembers.length === 0}
                          style={{ padding: "8px 18px", fontSize: "13px" }}
                        >
                          {isMovingYear ? "Moving..." : `Move to AY ${targetMoveYear}`}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 10. BATCH DELETE CONFIRMATION MODAL */}
          {showBatchDeleteModal && (
            <div
              className="team-modal-backdrop"
              onClick={() => !isBatchDeleting && setShowBatchDeleteModal(false)}
            >
              <div
                className="team-modal-box team-add-year-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div className="team-modal-icon-wrap modal-icon-danger">
                    <FaTrash />
                  </div>
                  <div>
                    <h3 className="team-modal-title">
                      Delete {selectedMemberIds.length} Selected Members?
                    </h3>
                    <p className="team-modal-desc">
                      Are you sure you want to permanently remove {selectedMemberIds.length} selected team members from Academic Year {selectedYear}?
                    </p>
                  </div>
                </div>

                <div className="team-modal-info-box" style={{ marginTop: "14px" }}>
                  This action is permanent and cannot be undone. To remove members from public display without deleting their records, use &ldquo;Unpublish Selected&rdquo; instead.
                </div>

                <div className="team-modal-actions" style={{ marginTop: "20px" }}>
                  <button
                    type="button"
                    className="team-modal-btn-cancel"
                    onClick={() => setShowBatchDeleteModal(false)}
                    disabled={isBatchDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="team-modal-btn-danger"
                    onClick={handleConfirmBatchDelete}
                    disabled={isBatchDeleting}
                  >
                    {isBatchDeleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
