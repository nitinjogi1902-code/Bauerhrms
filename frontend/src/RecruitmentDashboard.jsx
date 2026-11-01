import { useEffect, useMemo, useState } from "react";
import "./RecruitmentDashboard.css";

const COMPLETED_STAGES = ["Joined", "Rejected", "Withdrawn", "No Show"];
const FILLED_STAGES = ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"];

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    people: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M17 11a3 3 0 1 0-1.6-5.5M21 20v-1.5a4.5 4.5 0 0 0-2.7-4.1" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
    userCheck: <><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 19l2 2 4-5" /></>,
    userX: <><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M18 15l4 4M22 15l-4 4" /></>,
    filter: <><path d="M4 5h16l-6 7v5l-4 2v-7z" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></>,
    edit: <><path d="m13 5 6 6M4 20l4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20z" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    paperclip: <><path d="m21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l9.1-9.1a4 4 0 0 1 5.7 5.7l-9.1 9.1a2 2 0 0 1-2.8-2.8l8.4-8.4" /></>,
  };

  return <svg {...common}>{paths[name] || paths.file}</svg>;
}

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function statusTone(value = "") {
  const text = String(value).toLowerCase();
  if (/(joined|accepted|selected|verified|complete|open|clear)/.test(text)) return "success";
  if (/(backout|withdrawn|rejected|declined|no show|delayed|missing)/.test(text)) return "danger";
  if (/(due|pending|hold|scheduled|released|in progress|screening)/.test(text)) return "warning";
  return "info";
}

function Badge({ children }) {
  return <span className={`rh-status rh-status--${statusTone(children)}`}>{children || "—"}</span>;
}

function formatShortDate(value, fallback = "—") {
  if (!value) return fallback;
  const parsed = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Visual dashboard only. The existing Recruitment component remains the source
 * of truth for forms, storage and workflow transitions.
 */
export default function RecruitmentDashboard({
  requirements = [],
  candidates = [],
  offers = [],
  joinings = [],
  documents = [],
  stats,
  onAddCandidate,
  onAddPosition,
  onNavigate,
  onOpenCandidate,
  onExport,
}) {
  const [siteFilter, setSiteFilter] = useState("All Sites");
  const [candidateFilter, setCandidateFilter] = useState("All Stages");
  const [positionQuery, setPositionQuery] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [selectedId, setSelectedId] = useState(candidates[0]?.id || "");

  useEffect(() => {
    if (!candidates.some((candidate) => candidate.id === selectedId)) {
      setSelectedId(candidates[0]?.id || "");
    }
  }, [candidates, selectedId]);

  const requirementFor = (candidate) => requirements.find((requirement) => requirement.id === candidate?.requirementId);
  const offerFor = (candidateId) => offers.find((offer) => offer.candidateId === candidateId && offer.status !== "Withdrawn");
  const joiningFor = (candidateId) => joinings.find((joining) => joining.candidateId === candidateId);
  const documentsFor = (candidateId) => documents.filter((document) => document.candidateId === candidateId);
  const sites = useMemo(() => [...new Set(requirements.map((requirement) => requirement.location).filter(Boolean))], [requirements]);

  const activeCandidates = candidates.filter((candidate) => !COMPLETED_STAGES.includes(candidate.stage)).length;
  const offersReleased = offers.filter((offer) => ["Generated", "Sent", "Accepted"].includes(offer.status)).length;
  const backouts = candidates.filter((candidate) => ["Withdrawn", "No Show"].includes(candidate.stage)).length
    + offers.filter((offer) => ["Declined", "Withdrawn"].includes(offer.status)).length;
  const dashboardStats = stats || {};
  const cards = [
    { label: "Open Positions", value: dashboardStats.openPositions || 0, note: "Open / balance vacancies", icon: "briefcase", tone: "blue", action: () => onNavigate?.("Requirements") },
    { label: "Active Candidates", value: activeCandidates, note: "Across all stages", icon: "people", tone: "green", action: () => onNavigate?.("Candidate Tracker") },
    { label: "Offers Released", value: offersReleased, note: "Generated, sent or accepted", icon: "file", tone: "amber", action: () => onNavigate?.("Offers & Joining") },
    { label: "Joining Due", value: dashboardStats.joiningPending || 0, note: "Expected / confirmed joinings", icon: "calendar", tone: "orange", action: () => onNavigate?.("Offers & Joining") },
    { label: "Joined", value: dashboardStats.joined || 0, note: "This recruitment cycle", icon: "userCheck", tone: "mint", action: () => onNavigate?.("Offers & Joining") },
    { label: "Pre-Joining Backouts", value: backouts, note: "Withdrawn, declined or no-show", icon: "userX", tone: "red", action: () => onNavigate?.("Candidate Tracker") },
  ];

  const funnel = [
    { label: "CV Received", stages: ["New"], icon: "file", tone: "blue" },
    { label: "Screening", stages: ["Screening", "Shortlisted"], icon: "people", tone: "purple" },
    { label: "Interview", stages: ["Interview Scheduled", "Interviewed"], icon: "people", tone: "violet" },
    { label: "Selected", stages: ["Selected"], icon: "userCheck", tone: "green" },
    { label: "Offer Released", stages: ["Offer Released"], icon: "file", tone: "amber" },
    { label: "Offer Accepted", stages: ["Offer Accepted"], icon: "people", tone: "sky" },
    { label: "Joined", stages: ["Joining Scheduled", "Joined"], icon: "userCheck", tone: "mint" },
    { label: "Backout", stages: ["Withdrawn", "No Show", "Rejected"], icon: "userX", tone: "red" },
  ].map((item) => ({ ...item, value: candidates.filter((candidate) => item.stages.includes(candidate.stage)).length }));

  const filteredPositions = requirements.filter((requirement) => {
    const matchesSite = siteFilter === "All Sites" || requirement.location === siteFilter;
    const text = `${requirement.requirementNo || ""} ${requirement.title || ""} ${requirement.department || ""} ${requirement.location || ""}`.toLowerCase();
    return matchesSite && (!positionQuery || text.includes(positionQuery.toLowerCase()));
  });

  const filteredCandidates = candidates.filter((candidate) => {
    const requirement = requirementFor(candidate);
    const matchesSite = siteFilter === "All Sites" || requirement?.location === siteFilter || candidate.location === siteFilter;
    const matchesStage = candidateFilter === "All Stages" || candidate.stage === candidateFilter;
    const text = `${candidate.name || ""} ${candidate.candidateNo || ""} ${candidate.currentDesignation || ""} ${candidate.source || ""} ${requirement?.title || ""}`.toLowerCase();
    return matchesSite && matchesStage && (!candidateQuery || text.includes(candidateQuery.toLowerCase()));
  });

  const selected = candidates.find((candidate) => candidate.id === selectedId);
  const selectedRequirement = requirementFor(selected);
  const selectedOffer = offerFor(selected?.id);
  const selectedJoining = joiningFor(selected?.id);
  const selectedDocuments = documentsFor(selected?.id);
  const supportedDocs = selectedDocuments.filter((document) => ["Received", "Under Verification", "Verified"].includes(document.status));
  const mappingSummary = selected?.experienceMappingSummary;

  const chooseCandidate = (candidate) => setSelectedId(candidate.id);

  return <div className="rh-dashboard">
    <section className="rh-metric-grid" aria-label="Recruitment overview">
      {cards.map((card) => <button type="button" key={card.label} className={`rh-metric rh-metric--${card.tone}`} onClick={card.action}>
        <span className="rh-metric__icon"><Icon name={card.icon} size={31} /></span>
        <span className="rh-metric__copy"><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></span>
      </button>)}
    </section>

    <section className="rh-funnel-card">
      <div className="rh-section-title"><div><h2>Recruitment Funnel</h2><p>See exactly where every candidate is in the hiring journey.</p></div><button type="button" className="rh-text-button" onClick={() => onNavigate?.("Candidate Tracker")}>View candidates <Icon name="arrow" size={14} /></button></div>
      <div className="rh-funnel">
        {funnel.map((item, index) => <div className="rh-funnel__step" key={item.label}>
          <button type="button" className={`rh-funnel__tile rh-funnel__tile--${item.tone}`} onClick={() => onNavigate?.("Candidate Tracker")}>
            <span><Icon name={item.icon} size={23} /></span><div><small>{item.label}</small><strong>{item.value}</strong></div>
          </button>
          {index < funnel.length - 1 && <span className="rh-funnel__arrow"><Icon name="arrow" size={15} /></span>}
        </div>)}
      </div>
    </section>

    <div className="rh-workspace">
      <main className="rh-workspace__tables">
        <section className="rh-panel">
          <div className="rh-panel__head"><div><h2>Open Positions &amp; Candidate Pipeline</h2><p>Recruitment requirements with live vacancy status.</p></div><div className="rh-toolbar"><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option>All Sites</option>{sites.map((site) => <option key={site}>{site}</option>)}</select><label className="rh-search"><Icon name="search" size={15} /><input value={positionQuery} onChange={(event) => setPositionQuery(event.target.value)} placeholder="Search position..." /></label><button type="button" className="rh-compact-button" onClick={onExport}><Icon name="download" size={15} /> Export</button></div></div>
          <div className="rh-table-scroll"><table className="rh-table rh-positions-table"><thead><tr><th>#</th><th>Position ID</th><th>Designation</th><th>Project / Site</th><th>Department</th><th>Required</th><th>Filled</th><th>Open</th><th>Total candidates</th><th>Source</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>
            {filteredPositions.slice(0, 6).map((requirement, index) => {
              const positionCandidates = candidates.filter((candidate) => candidate.requirementId === requirement.id);
              const filled = positionCandidates.filter((candidate) => FILLED_STAGES.includes(candidate.stage)).length;
              const open = Math.max(0, Number(requirement.vacancies || 0) - filled);
              return <tr key={requirement.id}><td>{index + 1}</td><td className="rh-code">{requirement.requirementNo || requirement.id}</td><td><button type="button" className="rh-name-button" onClick={() => onNavigate?.("Requirements")}>{requirement.title || "—"}</button></td><td>{requirement.location || "—"}</td><td>{requirement.department || "—"}</td><td>{requirement.vacancies || 0}</td><td>{filled}</td><td className={open ? "rh-number--danger" : "rh-number--success"}>{open}</td><td>{positionCandidates.length}</td><td>{requirement.recruiter || "Direct Company"}</td><td><Badge>{requirement.status || "Open"}</Badge></td><td><button type="button" className="rh-icon-button" title="Add candidate" onClick={() => onAddCandidate?.(requirement)}><Icon name="plus" size={16} /></button></td></tr>;
            })}
          </tbody></table></div>
          {!filteredPositions.length && <div className="rh-empty">No positions match the current filter.</div>}
          <div className="rh-panel__foot"><button type="button" onClick={() => onNavigate?.("Requirements")}>View all positions</button><button type="button" className="rh-primary-button" onClick={onAddPosition}><Icon name="plus" size={16} /> Add open position</button></div>
        </section>

        <section className="rh-panel rh-candidates-panel">
          <div className="rh-panel__head"><div><h2>Candidates <span>(All Positions)</span></h2><p>Click a row to review its full profile on the right.</p></div><div className="rh-toolbar"><select value={candidateFilter} onChange={(event) => setCandidateFilter(event.target.value)}><option>All Stages</option>{[...new Set(candidates.map((candidate) => candidate.stage).filter(Boolean))].map((stage) => <option key={stage}>{stage}</option>)}</select><label className="rh-search"><Icon name="search" size={15} /><input value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="Search candidate..." /></label><button type="button" className="rh-compact-button" onClick={onExport}><Icon name="download" size={15} /> Export</button></div></div>
          <div className="rh-table-scroll"><table className="rh-table rh-candidates-table"><thead><tr><th>#</th><th>Candidate name</th><th>Employee code</th><th>Position</th><th>Project / Site</th><th>Source</th><th>CV received</th><th>Current stage</th><th>Offer DOJ</th><th>Actual DOJ</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>
            {filteredCandidates.slice(0, 10).map((candidate, index) => {
              const requirement = requirementFor(candidate);
              const offer = offerFor(candidate.id);
              const joining = joiningFor(candidate.id);
              return <tr key={candidate.id} className={candidate.id === selectedId ? "is-selected" : ""} onClick={() => chooseCandidate(candidate)}><td>{index + 1}</td><td><button type="button" className="rh-candidate-button" onClick={(event) => { event.stopPropagation(); chooseCandidate(candidate); }}><span className="rh-avatar">{initials(candidate.name)}</span><span>{candidate.name || "Unnamed candidate"}<small>{candidate.mobile || candidate.email || "No contact details"}</small></span></button></td><td className="rh-code">{candidate.candidateNo || candidate.id}</td><td>{requirement?.title || candidate.currentDesignation || "—"}</td><td>{requirement?.location || candidate.preferredLocation || candidate.location || "—"}</td><td>{candidate.source || "—"}</td><td>{formatShortDate(candidate.createdAt)}</td><td><Badge>{candidate.stage || "New"}</Badge></td><td>{formatShortDate(offer?.joiningDate)}</td><td>{formatShortDate(joining?.actualDate)}</td><td><Badge>{joining?.status || candidate.stage || "—"}</Badge></td><td><button type="button" className="rh-icon-button" title="Open candidate" onClick={(event) => { event.stopPropagation(); onOpenCandidate?.(candidate); }}><Icon name="more" size={17} /></button></td></tr>;
            })}
          </tbody></table></div>
          {!filteredCandidates.length && <div className="rh-empty">No candidates match the current filters.</div>}
          <div className="rh-panel__foot"><button type="button" onClick={() => onNavigate?.("Candidate Tracker")}>View all candidates</button><button type="button" className="rh-primary-button" onClick={() => onAddCandidate?.()}><Icon name="plus" size={16} /> Add candidate</button></div>
        </section>
      </main>

      <aside className="rh-profile" aria-label="Candidate profile">
        {selected ? <>
          <div className="rh-profile__head"><div><span>Candidate Profile</span><button type="button" className="rh-close-profile" onClick={() => setSelectedId("")}>×</button></div><div className="rh-person"><span className="rh-person__avatar">{initials(selected.name)}</span><div><h2>{selected.name}</h2><Badge>{selected.stage || "New"}</Badge><p>{selected.candidateNo || selected.id} <i /> {selectedRequirement?.title || selected.currentDesignation || "Candidate"} <i /> {selectedRequirement?.department || selected.department || "—"}</p><p>{selectedRequirement?.location || selected.location || "—"} <i /> {selected.mobile || "No mobile"}</p></div></div><div className="rh-profile__actions"><button type="button" className="rh-outline-button" onClick={() => onOpenCandidate?.(selected)}><Icon name="edit" size={15} /> Edit</button><button type="button" className="rh-primary-button" onClick={() => onOpenCandidate?.(selected, "Overview")}>Open profile</button></div></div>
          <div className="rh-profile__tabs"><button className="is-active" type="button">Candidate details</button><button type="button" onClick={() => onOpenCandidate?.(selected, "Documents & BGV")}>CV &amp; documents</button><button type="button" onClick={() => onOpenCandidate?.(selected, "Mapping")}>Experience mapping</button></div>
          <div className="rh-profile__body">
            <section className="rh-profile-card"><h3>Recruitment snapshot</h3><div className="rh-detail-grid"><div><span>Source</span><b>{selected.source || "—"}</b></div><div><span>Recruiter</span><b>{selected.recruiter || selected.owner || "—"}</b></div><div><span>Offer DOJ</span><b>{formatShortDate(selectedOffer?.joiningDate)}</b></div><div><span>Actual DOJ</span><b>{formatShortDate(selectedJoining?.actualDate)}</b></div></div></section>
            <section className="rh-profile-card rh-experience"><div className="rh-card-title"><h3>Experience mapping</h3><button type="button" onClick={() => onOpenCandidate?.(selected, "Mapping")}>Review</button></div><div className="rh-experience-grid"><div><span>As per CV</span><b>{mappingSummary?.totalCvExperience || selected.totalExperience || "—"}</b></div><div><span>Supported by docs</span><b>{mappingSummary?.totalDocumentExperience || "—"}</b></div><div className="rh-experience-grid__difference"><span>Pending review</span><b>{mappingSummary?.pendingVerificationRows ?? 0} rows</b></div></div></section>
            <section className="rh-profile-card"><div className="rh-card-title"><h3>Documents (Pre-Joining)</h3><button type="button" onClick={() => onOpenCandidate?.(selected, "Documents & BGV")}>Manage</button></div><div className="rh-document-list">{supportedDocs.slice(0, 5).map((document) => <div key={document.id}><span className="rh-document-icon"><Icon name="paperclip" size={14} /></span><span>{document.type}<small>{document.fileName || "File attached"}</small></span><Badge>{document.status}</Badge></div>)}{!supportedDocs.length && <div className="rh-empty rh-empty--small">No documents uploaded yet.</div>}</div></section>
          </div>
        </> : <div className="rh-profile__blank"><span><Icon name="people" size={34} /></span><h2>Select a candidate</h2><p>Choose any candidate row to see their profile, documents and experience validation here.</p></div>}
      </aside>
    </div>
  </div>;
}
