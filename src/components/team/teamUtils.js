/**
 * Helper utilities for classifying and normalizing Abhyudaya Team Members.
 * Ensures consistent structure between Static data and Firestore documents.
 *
 * This file is the single shared "team domain" module consumed by:
 *  - The public /team page (grouping + normalization)
 *  - The Admin Team form (controlled vocab for level/department/role)
 */

// ------------------------------------------------------------------
// Controlled vocabulary (single source of truth for level/department)
// ------------------------------------------------------------------

export const LEVELS = {
  FACULTY_ADVISOR: "faculty-advisor",
  LEADERSHIP: "leadership",
  CORE: "core",
  EXECUTIVE: "executive",
  WEB_DEV: "web-dev",
};

export const VALID_LEVELS = Object.values(LEVELS);

export const LEVEL_LABELS = {
  [LEVELS.FACULTY_ADVISOR]: "Faculty Advisor",
  [LEVELS.LEADERSHIP]: "The Leadership",
  [LEVELS.CORE]: "Core Team",
  [LEVELS.EXECUTIVE]: "Executive",
  [LEVELS.WEB_DEV]: "Abhyudaya Developers",
};

/**
 * ABHYUDAYA DEVELOPERS — Protected Common Section Constants
 * The Abhyudaya Developers section is permanent and common across ALL academic years.
 * Developer profiles are shared, year-agnostic, and must never be bound to a specific year.
 */
export const ABHYUDAYA_DEV_COMMON_YEAR = "common";
export const ABHYUDAYA_DEV_FIXED_YEAR = "common"; // Backward compatibility alias
export const ABHYUDAYA_DEV_SECTION_ID = "abhyudaya-developers";

/**
 * Checks whether a given member belongs to the permanent Abhyudaya Developers team.
 * Safe compatibility helper recognizing level, department, category, role, or common year.
 */
export function isAbhyudayaDeveloper(member) {
  if (!member) return false;
  const level = String(member.level || "").trim().toLowerCase();
  const lowerCat = String(member.category || "").toLowerCase();
  const lowerDept = String(member.department || "").toLowerCase();
  const lowerRole = String(member.role || "").toLowerCase();
  const memberYear = String(member.year ?? member.batch ?? "").trim().toLowerCase();

  return (
    level === "web-dev" ||
    lowerDept === "web development" ||
    lowerDept === "web dev" ||
    lowerCat.includes("web dev") ||
    lowerCat.includes("web development") ||
    lowerCat.includes("abhyudaya developer") ||
    lowerRole.includes("web developer") ||
    lowerRole.includes("frontend developer") ||
    lowerRole.includes("full stack developer") ||
    memberYear === "common"
  );
}

/**
 * Deduplicates team member profiles by ID or Name+Role so each person appears only once.
 */
export function deduplicateMembers(members = []) {
  const seen = new Set();
  return members.filter((m) => {
    const key = m.id || `${(m.name || "").trim().toLowerCase()}-${(m.role || "").trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Canonical department labels used consistently by Admin + Public.
export const DEPARTMENT_OPTIONS = [
  "Leadership",
  "Operations",
  "Technical",
  "PR",
  "Web Development",
  "Faculty Advisory",
];

// Departments an Executive / Core / Web Dev member can belong to.
export const EXECUTIVE_DEPARTMENTS = ["Operations", "Technical", "PR", "Web Development"];

export const DEPARTMENTS = {
  ALL: "ALL",
  OPERATIONS: "OPERATIONS",
  TECHNICAL: "TECHNICAL",
  PR: "PR",
  WEB_DEV: "WEB_DEV",
};

export const DEFAULT_TEAM_YEARS = ["2025", "2026", "2027", "2028"];

// Fixed role presets an admin can pick for Faculty / Leadership / Core / Web Dev.
// Selecting one of these auto-locks level + department.
export const ROLE_PRESETS = [
  {
    label: "Faculty Advisor",
    value: "Faculty Advisor",
    level: LEVELS.FACULTY_ADVISOR,
    department: "Faculty Advisory",
    category: "Faculty Co-ordinators",
  },
  {
    label: "President (Leadership)",
    value: "President",
    level: LEVELS.LEADERSHIP,
    department: "Leadership",
    category: "Executive Board",
  },
  {
    label: "Vice President (Leadership)",
    value: "Vice President",
    level: LEVELS.LEADERSHIP,
    department: "Leadership",
    category: "Executive Board",
  },
  {
    label: "General Secretary (Leadership)",
    value: "General Secretary",
    level: LEVELS.LEADERSHIP,
    department: "Leadership",
    category: "Executive Board",
  },
  {
    label: "Operations Lead (Core)",
    value: "Operations Lead",
    level: LEVELS.CORE,
    department: "Operations",
    category: "Core Team",
  },
  {
    label: "Technical Lead (Core)",
    value: "Technical Lead",
    level: LEVELS.CORE,
    department: "Technical",
    category: "Core Team",
  },
  {
    label: "PR Lead (Core)",
    value: "PR Lead",
    level: LEVELS.CORE,
    department: "PR",
    category: "Core Team",
  },
  {
    label: "Web Developer (Abhyudaya Developers)",
    value: "Web Developer",
    level: LEVELS.WEB_DEV,
    department: "Web Development",
    category: "Abhyudaya Developers",
  },
  {
    label: "Frontend Developer (Abhyudaya Developers)",
    value: "Frontend Developer",
    level: LEVELS.WEB_DEV,
    department: "Web Development",
    category: "Abhyudaya Developers",
  },
  {
    label: "Full Stack Developer (Abhyudaya Developers)",
    value: "Full Stack Developer",
    level: LEVELS.WEB_DEV,
    department: "Web Development",
    category: "Abhyudaya Developers",
  },
  {
    label: "Operations Executive (Executive)",
    value: "Operations Executive",
    level: LEVELS.EXECUTIVE,
    department: "Operations",
    category: "Domain Leads",
  },
  {
    label: "Technical Executive (Executive)",
    value: "Technical Executive",
    level: LEVELS.EXECUTIVE,
    department: "Technical",
    category: "Domain Leads",
  },
  {
    label: "PR Executive (Executive)",
    value: "PR Executive",
    level: LEVELS.EXECUTIVE,
    department: "PR",
    category: "Domain Leads",
  },
];

// Legacy `category` field mapping, kept for backward compatibility with
// any existing document/reader relying on it.
export const CATEGORY_BY_LEVEL = {
  [LEVELS.FACULTY_ADVISOR]: "Faculty Co-ordinators",
  [LEVELS.LEADERSHIP]: "Executive Board",
  [LEVELS.CORE]: "Core Team",
  [LEVELS.EXECUTIVE]: "Domain Leads",
  [LEVELS.WEB_DEV]: "Abhyudaya Developers",
};

/**
 * Validates an optional URL field (LinkedIn / GitHub).
 * Empty string / undefined is considered valid (field is optional).
 */
export function isValidUrl(value) {
  if (!value || typeof value !== "string" || value.trim() === "") return true;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const KNOWN_DEPARTMENTS = DEPARTMENT_OPTIONS;

/**
 * Normalizes member category, level, and department from either static data or Firestore docs.
 * Explicit `level`/`department` values written by Admin form always take precedence.
 */
export function normalizeMember(member, index = 0) {
  const role = (member.role || "").trim();
  const lowerRole = role.toLowerCase();
  const lowerCategory = (member.category || "").toLowerCase();
  const explicitDept = (member.department || "").trim();
  const hasExplicitDept = KNOWN_DEPARTMENTS.includes(explicitDept);
  const hasExplicitLevel = VALID_LEVELS.includes(member.level);

  let level = hasExplicitLevel ? member.level : LEVELS.EXECUTIVE;
  const isDev = isAbhyudayaDeveloper(member);

  if (isDev) {
    level = LEVELS.WEB_DEV;
  }

  let department = explicitDept;

  // Legacy inference — only runs when the document has no controlled `level`.
  if (!hasExplicitLevel && !isDev) {
    if (
      lowerRole.includes("faculty") ||
      lowerRole.includes("advisor") ||
      lowerCategory.includes("faculty")
    ) {
      level = LEVELS.FACULTY_ADVISOR;
    } else if (
      lowerRole.includes("president") ||
      lowerRole.includes("general secretary") ||
      lowerRole.includes("gen sec") ||
      lowerCategory.includes("executive board") ||
      lowerCategory.includes("leadership")
    ) {
      if (!lowerRole.includes("lead") || lowerRole.includes("president")) {
        level = LEVELS.LEADERSHIP;
      }
    }

    if (
      lowerRole.includes("lead") ||
      lowerCategory.includes("domain lead") ||
      lowerCategory.includes("core lead")
    ) {
      level = LEVELS.CORE;
    }
  }

  // Department inference — only runs when no trusted explicit department is set.
  if (!hasExplicitDept || isDev) {
    if (isDev) {
      department = "Web Development";
    } else if (level === LEVELS.FACULTY_ADVISOR) {
      department = "Faculty Advisory";
    } else if (level === LEVELS.LEADERSHIP) {
      department = "Leadership";
    } else if (level === LEVELS.CORE || level === LEVELS.EXECUTIVE) {
      if (lowerRole.includes("operation") || lowerRole.includes("ops")) {
        department = "Operations";
      } else if (
        lowerRole.includes("tech") ||
        lowerRole.includes("code") ||
        lowerRole.includes("dev") ||
        lowerRole.includes("web")
      ) {
        department = "Technical";
      } else if (
        lowerRole.includes("pr") ||
        lowerRole.includes("public") ||
        lowerRole.includes("media") ||
        lowerRole.includes("outreach") ||
        lowerRole.includes("design")
      ) {
        department = "PR";
      } else {
        const defaultDepts = ["Technical", "Operations", "PR", "Web Development"];
        department = defaultDepts[index % defaultDepts.length];
      }
    }
  }

  // Active flag: defaults to true so legacy documents without this field
  // remain visible on the public site.
  const active = member.active === false ? false : true;

  // Year: Abhyudaya Developers are permanent and common across all years
  const assignedYear = isDev
    ? ABHYUDAYA_DEV_COMMON_YEAR
    : String(member.year ?? member.batch ?? member.session ?? member.academicYear ?? member.teamYear ?? "2026").trim();

  return {
    id: member.id || `member-${member.name}-${index}`,
    name: member.name || "Abhyudaya Member",
    role: role || (isDev ? "Web Developer" : "Team Member"),
    department: department || "Operations",
    level,
    image: member.image || "",
    linkedin: (member.linkedin || "").trim(),
    github: (member.github || "").trim(),
    instagram: (member.instagram || "").trim(),
    website: (member.website || "").trim(),
    bio: member.bio || "",
    quote: member.quote || "",
    featured: Boolean(member.featured),
    order:
      member.order !== undefined && member.order !== null && member.order !== ""
        ? Number(member.order)
        : index + 1,
    active,
    category: isDev ? "Abhyudaya Developers" : (member.category || CATEGORY_BY_LEVEL[level] || "Executive Board"),
    year: assignedYear,
    batch: assignedYear,
  };
}

/**
 * Groups a flat array of members (from Firestore or static) into hierarchical tiers.
 * Only members with `active !== false` are included — deactivated members are
 * preserved in Firestore but excluded from the public site.
 */
export function groupTeamMembers(members = []) {
  const normalized = members
    .map((m, idx) => normalizeMember(m, idx))
    .filter((m) => m.active !== false);

  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

  const faculty = normalized
    .filter((m) => m.level === LEVELS.FACULTY_ADVISOR)
    .sort(byOrder);
  const leadership = normalized
    .filter((m) => m.level === LEVELS.LEADERSHIP)
    .sort(byOrder);
  const core = normalized
    .filter((m) => m.level === LEVELS.CORE && !isAbhyudayaDeveloper(m))
    .sort(byOrder);
  const executives = normalized
    .filter(
      (m) =>
        m.level === LEVELS.EXECUTIVE &&
        !isAbhyudayaDeveloper(m)
    )
    .sort(byOrder);
  const webDev = deduplicateMembers(
    normalized
      .filter((m) => isAbhyudayaDeveloper(m))
  ).sort(byOrder);

  return {
    faculty,
    leadership,
    core,
    executives,
    webDev,
  };
}


