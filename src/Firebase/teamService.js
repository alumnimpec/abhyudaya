import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { uploadImage } from "../Admin/pages/services/imageUpload";
import {
  CATEGORY_BY_LEVEL,
  LEVELS,
  VALID_LEVELS,
  isValidUrl,
  ABHYUDAYA_DEV_COMMON_YEAR,
  isAbhyudayaDeveloper,
} from "../components/team/teamUtils";

const teamRef = collection(db, "team");
const teamMetaYearsDoc = doc(db, "team_meta", "years");

export const DEFAULT_TEAM_YEARS = ["2025", "2026", "2027", "2028"];

/**
 * Retrieves all configured team academic/executive years.
 * Reads configured years from Firestore `team_meta/years`,
 * scans existing `team` documents for any year values,
 * and merges them with default base years.
 */
export async function getTeamYears() {
  const yearsSet = new Set(DEFAULT_TEAM_YEARS);

  try {
    const metaSnap = await getDoc(teamMetaYearsDoc);
    if (metaSnap.exists()) {
      const data = metaSnap.data();
      if (Array.isArray(data.years)) {
        data.years.forEach((yr) => {
          if (yr && String(yr).trim()) {
            yearsSet.add(String(yr).trim());
          }
        });
      }
    }
  } catch (err) {
    console.warn("Could not fetch team_meta/years doc:", err.message);
  }

  try {
    const snapshot = await getDocs(teamRef);
    snapshot.docs.forEach((d) => {
      const data = d.data();
      const yr = data.year ?? data.batch ?? data.session ?? data.academicYear ?? data.teamYear;
      if (yr && String(yr).trim()) {
        yearsSet.add(String(yr).trim());
      }
    });
  } catch (err) {
    console.warn("Could not scan team collection for unique years:", err.message);
  }

  // Sort years numerically if 4-digit years, otherwise alphabetically
  return Array.from(yearsSet).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
}

/**
 * Initializes a new team year in Firestore so that the Super Admin
 * can configure upcoming years (2027, 2028, 2029...) dynamically.
 */
export async function addTeamYear(year) {
  const cleanYear = String(year || "").trim();
  if (!cleanYear) {
    throw new Error("Year cannot be empty.");
  }
  if (cleanYear.length < 4 || cleanYear.length > 9) {
    throw new Error("Please enter a valid academic/executive year (e.g. 2027 or 2027-28).");
  }

  try {
    await setDoc(
      teamMetaYearsDoc,
      {
        years: arrayUnion(cleanYear),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Failed to add team year in Firestore:", err);
    throw new Error(`Failed to save year to database: ${err.message}`);
  }

  return cleanYear;
}

/**
 * Removes an initialized team year from metadata if needed.
 * Base academic year 2026 is protected.
 */
export async function deleteTeamYear(year) {
  const cleanYear = String(year || "").trim();
  if (cleanYear === "2026") {
    throw new Error("Base year 2026 cannot be removed.");
  }

  try {
    await updateDoc(teamMetaYearsDoc, {
      years: arrayRemove(cleanYear),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Could not remove year from team_meta/years:", err.message);
  }

  return cleanYear;
}

/**
 * Retrieves team members, ensuring backwards compatibility for older records
 * lacking a `year` field by defaulting safely to '2026'.
 * If `year` argument is specified, filters results to that academic year.
 */
export async function getTeamMembers(year = null) {
  let docs = [];
  try {
    const q = query(teamRef, orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const snapshot = await getDocs(teamRef);
    docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const normalized = docs.map((m) => {
    const isDev = isAbhyudayaDeveloper(m);
    const memberYear = isDev
      ? ABHYUDAYA_DEV_COMMON_YEAR
      : String(m.year ?? m.batch ?? m.session ?? m.academicYear ?? m.teamYear ?? "2026").trim();
    return {
      ...m,
      level: isDev ? LEVELS.WEB_DEV : (m.level || LEVELS.EXECUTIVE),
      department: isDev ? "Web Development" : (m.department || "Operations"),
      category: isDev ? "Abhyudaya Developers" : (m.category || "Executive Board"),
      year: memberYear,
      batch: memberYear,
    };
  });

  if (year) {
    const target = String(year).trim();
    if (target === ABHYUDAYA_DEV_COMMON_YEAR || target === LEVELS.WEB_DEV) {
      return normalized.filter((m) => isAbhyudayaDeveloper(m));
    }
    return normalized.filter((m) => m.year === target);
  }

  return normalized;
}

/**
 * Retrieves the shared Abhyudaya Developers roster common across all academic years.
 */
export async function getAbhyudayaDevelopers() {
  const all = await getTeamMembers();
  return all.filter(isAbhyudayaDeveloper);
}

/**
 * Validates a team member payload before it is written to Firestore.
 * Throws a descriptive Error if validation fails so the Admin UI can
 * surface it via a toast instead of silently corrupting data.
 */
function validateTeamMemberData(data) {
  if (!data.name || !String(data.name).trim()) {
    throw new Error("Member name is required.");
  }
  if (!data.role || !String(data.role).trim()) {
    throw new Error("Role is required.");
  }
  if (!data.level || !VALID_LEVELS.includes(data.level)) {
    throw new Error("A valid level (faculty-advisor, leadership, core, executive, web-dev) is required.");
  }
  if (data.level === LEVELS.EXECUTIVE || data.level === LEVELS.CORE || data.level === LEVELS.WEB_DEV) {
    if (!data.department || !String(data.department).trim()) {
      throw new Error("Department is required for Core, Executive, and Web Development members.");
    }
  }
  // Abhyudaya Developers are permanent and common across all academic years.
  // Reject any attempt to bind a developer profile to an individual academic year.
  if (data.level === LEVELS.WEB_DEV || isAbhyudayaDeveloper(data)) {
    const requestedYear = String(data.year || "").trim();
    if (requestedYear && requestedYear !== ABHYUDAYA_DEV_COMMON_YEAR && requestedYear !== "2026") {
      throw new Error(
        `Abhyudaya Developers profiles are permanent and common across all academic years. ` +
        `They cannot be assigned to an individual academic year like "${requestedYear}".`
      );
    }
  }
  if (!isValidUrl(data.linkedin)) {
    throw new Error("LinkedIn URL is not valid. Please provide a full https:// URL or leave it empty.");
  }
  if (!isValidUrl(data.github)) {
    throw new Error("GitHub URL is not valid. Please provide a full https:// URL or leave it empty.");
  }
  if (!isValidUrl(data.instagram)) {
    throw new Error("Instagram URL is not valid. Please provide a full https:// URL or leave it empty.");
  }
  if (!isValidUrl(data.website)) {
    throw new Error("Portfolio/Website URL is not valid. Please provide a full https:// URL or leave it empty.");
  }
  if (data.order !== undefined && data.order !== null && data.order !== "" && Number.isNaN(Number(data.order))) {
    throw new Error("Display order must be a valid number.");
  }
}

/**
 * Builds the canonical Firestore payload from admin form data.
 * `category` is derived automatically from `level` purely for backward
 * compatibility with any older reader that might still rely on it.
 * `year` and `batch` associate the profile with the academic year.
 */
function buildTeamMemberPayload(data, image) {
  const isDev = data.level === LEVELS.WEB_DEV || isAbhyudayaDeveloper(data);
  const level = isDev ? LEVELS.WEB_DEV : (data.level || LEVELS.EXECUTIVE);
  // Abhyudaya Developers are common across all academic years
  const year = isDev
    ? ABHYUDAYA_DEV_COMMON_YEAR
    : String(data.year || "2026").trim();

  return {
    name: String(data.name).trim(),
    role: String(data.role).trim(),
    level,
    department: isDev ? "Web Development" : (data.department ? String(data.department).trim() : ""),
    category: isDev
      ? "Abhyudaya Developers"
      : (data.category || CATEGORY_BY_LEVEL[level] || "Executive Board"),
    year,
    batch: year,
    image,
    linkedin: (data.linkedin || "").trim(),
    github: (data.github || "").trim(),
    instagram: (data.instagram || "").trim(),
    website: (data.website || "").trim(),
    email: (data.email || "").trim(),
    bio: (data.bio || "").trim(),
    quote: (data.quote || "").trim(),
    featured: Boolean(data.featured),
    order: data.order !== undefined && data.order !== null && data.order !== "" ? Number(data.order) : 99,
    active: data.active === false ? false : true,
  };
}

export async function addTeamMember(data, imageFile) {
  validateTeamMemberData(data);

  let image = data.image || "";
  if (imageFile) {
    image = await uploadImage(imageFile);
  }

  if (!image) {
    throw new Error("A profile image is required. Please upload an image or provide an image URL.");
  }

  const payload = buildTeamMemberPayload(data, image);

  const ref = await addDoc(teamRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTeamMember(id, data, imageFile) {
  validateTeamMemberData(data);

  const memberRef = doc(db, "team", id);
  let image = data.image || "";
  if (imageFile) {
    image = await uploadImage(imageFile);
  }

  if (!image) {
    throw new Error("A profile image is required. Please upload an image or provide an image URL.");
  }

  const payload = buildTeamMemberPayload(data, image);

  await updateDoc(memberRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Toggles a member's active status without deleting the Firestore document,
 * so the member can be restored later from the Admin Panel.
 */
export async function setTeamMemberActive(id, active) {
  const memberRef = doc(db, "team", id);
  await updateDoc(memberRef, {
    active: Boolean(active),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTeamMember(id) {
  await deleteDoc(doc(db, "team", id));
}

/**
 * Batch updates active status for multiple team members at once.
 */
export async function batchUpdateTeamMembersActive(ids, active) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const memberRef = doc(db, "team", id);
    batch.update(memberRef, {
      active: Boolean(active),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Batch moves multiple team members to a target academic year.
 * STRICT ENFORCEMENT: Abhyudaya Developers can NEVER be moved from AY 2026.
 */
export async function batchMoveTeamMembersYear(membersList, targetYear) {
  if (!Array.isArray(membersList) || membersList.length === 0) return;
  const cleanTargetYear = String(targetYear || "").trim();
  if (!cleanTargetYear) {
    throw new Error("Please select a target academic year.");
  }

  // Check for any Abhyudaya Developers in the batch
  const devMembers = membersList.filter(isAbhyudayaDeveloper);

  if (devMembers.length > 0) {
    const devNames = devMembers.map((m) => m.name).join(", ");
    throw new Error(
      `Abhyudaya Developers profiles (${devNames}) are permanent across all academic years and cannot be assigned or moved to academic year ${cleanTargetYear}.`
    );
  }

  const batch = writeBatch(db);
  membersList.forEach((m) => {
    // Skip Abhyudaya Developers as they are permanent across all years
    if (isAbhyudayaDeveloper(m)) {
      return;
    }
    const memberRef = doc(db, "team", m.id);
    batch.update(memberRef, {
      year: cleanTargetYear,
      batch: cleanTargetYear,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Batch deletes multiple team members at once.
 */
export async function batchDeleteTeamMembers(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const memberRef = doc(db, "team", id);
    batch.delete(memberRef);
  });
  await batch.commit();
}


