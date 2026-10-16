import { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { team as staticTeam } from '../data/club.js';
import {
  getTeamMembers,
  getTeamYears,
  DEFAULT_TEAM_YEARS,
} from '../Admin/pages/services/teamService.js';
import BreadcrumbSchema from '../components/seo/schemas/BreadcrumbSchema.jsx';

// Modular Subcomponents
import TeamHero from '../components/team/TeamHero.jsx';
import FacultyAdvisorSection from '../components/team/FacultyAdvisorSection.jsx';
import LeadershipSection from '../components/team/LeadershipSection.jsx';
import OrganizationStructure from '../components/team/OrganizationStructure.jsx';
import CoreTeamSection from '../components/team/CoreTeamSection.jsx';
import ExecutiveSection from '../components/team/ExecutiveSection.jsx';
import WebDevTeamSection from '../components/team/WebDevTeamSection.jsx';
import TeamClosing from '../components/team/TeamClosing.jsx';
import ProfileModal from '../components/team/ProfileModal.jsx';
import { groupTeamMembers } from '../components/team/teamUtils.js';
import { markPrerenderReady } from '../utils/prerender.js';

import './Team.css';

const SITE_URL = 'https://www.abhyudayaclub.in';

export default function Team() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialYear = searchParams.get('year') || '2026';

  const [dbMembers, setDbMembers] = useState([]);
  const [availableYears, setAvailableYears] = useState(DEFAULT_TEAM_YEARS);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  const breadcrumbItems = [
    { name: 'Home', url: SITE_URL },
    { name: 'Team', url: `${SITE_URL}/team` },
  ];

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [membersData, yearsData] = await Promise.all([
          getTeamMembers(),
          getTeamYears(),
        ]);
        if (isMounted) {
          if (Array.isArray(membersData)) {
            setDbMembers(membersData);
          }
          if (Array.isArray(yearsData) && yearsData.length > 0) {
            setAvailableYears(yearsData);
          }
        }
      } catch (err) {
        console.error('Error loading team members from Firestore:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          markPrerenderReady();
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleYearChange = (year) => {
    setSelectedYear(year);
    if (year === '2026') {
      searchParams.delete('year');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ year });
    }
  };

  // Process and group team data for the selected year
  const {
    faculty,
    mainLeadership,
    verticalLeads,
    core,
    executives,
    associates,
    webDev,
    hasMembers,
  } = useMemo(() => {
    let rawFaculty = [];
    let rawLeadership = [];
    let rawCore = [];
    let rawExecutives = [];
    let rawAssociates = [];
    let rawWebDev = [];
    let dataFound = false;

    // Filter Firestore members strictly for the currently selected year
    const yearMembers = dbMembers.filter((m) => {
      const memberYear = String(
        m.year ?? m.batch ?? m.session ?? m.academicYear ?? m.teamYear ?? '2026'
      ).trim();
      return memberYear === selectedYear;
    });

    if (yearMembers.length > 0) {
      const grouped = groupTeamMembers(yearMembers);
      rawFaculty = grouped.faculty || [];
      rawLeadership = grouped.leadership || [];
      rawCore = grouped.core || [];
      rawExecutives = grouped.executives || [];
      rawAssociates = grouped.associates || [];
      rawWebDev = grouped.webDev || [];
      dataFound = true;
    } else if (selectedYear === '2026' && dbMembers.length === 0) {
      // Backward compatibility fallback to static 2026 team only if DB is empty
      rawFaculty = staticTeam.faculty || [];
      rawLeadership = staticTeam.leadership || [];
      rawCore = staticTeam.core || [];
      rawExecutives = staticTeam.executives || [];
      rawAssociates = staticTeam.associates || staticTeam.associateExecutives || [];
      rawWebDev = staticTeam.webDev || [];
      dataFound = true;
    }

    // Filter vertical leads ("Technical Lead", "Operations Lead", "PR Lead") from main student leadership
    const mainL = rawLeadership.filter(
      (m) => !m.role.toLowerCase().includes('lead')
    );
    const vertL = rawLeadership.filter(
      (m) => m.role.toLowerCase().includes('lead')
    );

    return {
      faculty: rawFaculty,
      mainLeadership: mainL,
      verticalLeads: vertL,
      core: rawCore,
      executives: rawExecutives,
      associates: rawAssociates,
      webDev: rawWebDev,
      hasMembers: dataFound,
    };
  }, [dbMembers, selectedYear]);

  const primaryAdvisor = faculty?.[0] || null;

  return (
    <div className="team-page-wrapper team-page-centered">
      <Helmet>
        <title>Our Team {selectedYear} | Abhyudaya Club — Faculty &amp; Student Leaders at MPEC Kanpur</title>
        <meta
          name="description"
          content={`Meet the Abhyudaya Club ${selectedYear} team — dedicated faculty advisor, student leadership, core team, executives, and web development team at MPEC Kanpur.`}
        />
        <link rel="canonical" href={`${SITE_URL}/team`} />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
        <meta property="og:title" content={`Our Team ${selectedYear} | Abhyudaya Club — MPEC Kanpur`} />
        <meta property="og:description" content={`Meet the faculty advisor, student leaders, executives, and web development team of Abhyudaya Club at MPEC Kanpur.`} />
        <meta property="og:url" content={`${SITE_URL}/team`} />
        <meta property="og:image" content={`${SITE_URL}/abhyudaya-logo.png`} />
        <meta property="og:locale" content="en_IN" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Our Team ${selectedYear} | Abhyudaya Club`} />
        <meta name="twitter:description" content={`Meet the faculty advisor, student leaders, and web development team of Abhyudaya Club at MPEC Kanpur.`} />
        <meta name="twitter:image" content={`${SITE_URL}/abhyudaya-logo.png`} />
      </Helmet>

      <BreadcrumbSchema items={breadcrumbItems} />

      {/* 1. HERO */}
      <TeamHero selectedYear={selectedYear} />

      {/* DYNAMIC YEAR SELECTOR */}
      <div className="team-year-filter-wrap">
        <label className="team-year-filter">
          <span>Team Year</span>
          <select
            value={selectedYear}
            onChange={(event) => handleYearChange(event.target.value)}
            aria-label="Select team year"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year} {year === '2026' ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <section className="section team-loading">
          <div className="wrap">
            <p>Loading team members...</p>
          </div>
        </section>
      ) : !hasMembers ? (
        /* EMPTY STATE: "No data found for that year." */
        <section className="section team-empty-section">
          <div className="wrap">
            <div className="team-year-empty-card">
              <div className="team-year-empty-icon" aria-hidden="true">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#eeb84a"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h2 className="team-year-empty-heading">Team Roster • {selectedYear}</h2>
              <p className="team-year-empty">No data found for that year.</p>
              <p className="team-year-empty-sub">
                The student leadership and executive profiles for {selectedYear} have not been published yet. Please choose another academic year from the selector above.
              </p>
              {selectedYear !== '2026' && (
                <button
                  type="button"
                  className="team-empty-switch-btn"
                  onClick={() => handleYearChange('2026')}
                >
                  View 2026 Team Roster →
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* 2. FACULTY COORDINATOR */}
          {primaryAdvisor && (
            <FacultyAdvisorSection
              advisor={primaryAdvisor}
              onSelectMember={setSelectedMember}
            />
          )}

          {/* 3. STUDENT LEADERSHIP (President, VP, etc. - Styled on Dark BG) */}
          {mainLeadership.length > 0 && (
            <div className="section-theme-wrapper section--dark">
              <LeadershipSection
                title="Student Leadership"
                eyebrow="Executive Officers"
                members={mainLeadership}
                selectedYear={selectedYear}
                onSelectMember={setSelectedMember}
              />
            </div>
          )}

          {/* 4. DOMAIN & VERTICAL LEADS (Tech, Ops, PR Leads - Directly below Leadership on Dark BG) */}
          {verticalLeads.length > 0 && (
            <div className="section-theme-wrapper section--dark section-border-top">
              <LeadershipSection
                title="Domain &amp; Vertical Leads"
                eyebrow="Functional Directors"
                members={verticalLeads}
                selectedYear={selectedYear}
                onSelectMember={setSelectedMember}
              />
            </div>
          )}

          {/* 5. CORE TEAM (Domain Leadership & Core Leads on Warm Cream BG) */}
          {core.length > 0 && (
            <CoreTeamSection
              members={core}
              selectedYear={selectedYear}
              onSelectMember={setSelectedMember}
            />
          )}

          {/* 6. HOW ABHYUDAYA WORKS (Interactive Organizational Flow) */}
          {(mainLeadership.length > 0 || core.length > 0) && (
            <OrganizationStructure
              leadership={mainLeadership}
              core={core}
            />
          )}

          {/* 7. EXECUTIVE COMMITTEE */}
          {executives.length > 0 && (
            <ExecutiveSection
              title="Executive Committee"
              eyebrow="Executives"
              members={executives}
              selectedYear={selectedYear}
              onSelectMember={setSelectedMember}
            />
          )}

          {/* 8. ASSOCIATE EXECUTIVES (Centered grid) */}
          {associates.length > 0 && (
            <div className="section-theme-wrapper section--dark">
              <ExecutiveSection
                title="Associate Executives"
                eyebrow="Support Team"
                members={associates}
                selectedYear={selectedYear}
                onSelectMember={setSelectedMember}
              />
            </div>
          )}

          {/* 9. ABHYUDAYA DEVELOPERS — Only visible under AY 2026 */}
          {webDev.length > 0 && selectedYear === '2026' && (
            <WebDevTeamSection
              members={webDev}
              onSelectMember={setSelectedMember}
            />
          )}

          {/* 10. CLOSING CALL TO ACTION */}
          <TeamClosing />
        </>
      )}

      {/* MODAL DETAILED POPUP */}
      <ProfileModal
        member={selectedMember}
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}

