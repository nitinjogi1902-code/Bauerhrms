import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./Recruitment.css";

const ORGANIZATION_STORAGE_KEY = "bauerHrmsOrganizationMasters";

const DEFAULT_DESIGNATIONS = [
  "Engineer",
  "Senior Engineer",
  "Assistant Manager",
  "Manager",
  "Senior Manager",
  "AGM",
  "GM",
  "VP",
  "Senior VP",
];

const REQ_KEY = "bauerHrmsRecruitmentRequirements";
const CANDIDATE_KEY = "bauerHrmsRecruitmentCandidates";
const INTERVIEW_KEY = "bauerHrmsRecruitmentInterviews";
const OFFER_KEY = "bauerHrmsRecruitmentOffers";

const REQ_STATUSES = ["Draft", "Pending Approval", "Approved", "Rejected", "Closed"];
const CANDIDATE_STAGES = [
  "New",
  "Screening",
  "Shortlisted",
  "Interview Scheduled",
  "Interviewed",
  "Selected",
  "Hold",
  "Rejected",
  "Offer Released",
  "Offer Accepted",
  "Joining Scheduled",
  "Joined",
];
const SOURCES = ["Naukri", "LinkedIn", "Referral", "Consultant", "Walk-in", "Website", "Campus", "Other"];
const INTERVIEW_MODES = ["Face to Face", "Online", "Telephonic"];
const INTERVIEW_ROUNDS = ["HR Screening", "Technical", "Managerial", "Final HR"];
const RECOMMENDATIONS = ["Strong Hire", "Hire", "Hold", "Reject"];

const EXPERIENCE_OPTIONS = [
  "0-2",
  "2-4",
  "5-8",
  "8-10",
  "10-12",
  "12-15",
  "15-20",
  "20-25",
  "25-30",
  "30+",
];

const CTC_LPA_OPTIONS = [
  "0-2",
  "2-4",
  "5-8",
  "8-10",
  "10-12",
  "12-15",
  "15-20",
  "20-25",
  "25-30",
  "30+",
];

const EMPTY_REQ = {
  title: "",
  department: "",
  location: "",
  vacancies: 1,
  employmentType: "Full Time",
  employeeGroup: "",
  qualification: "",
  experience: "",
  skills: "",
  minCtc: "",
  maxCtc: "",
  priority: "Medium",
  targetDate: "",
  hiringManager: "",
  approverId: "",
  approverEmployeeId: "",
  approverName: "",
  recruiter: "",
  reason: "New Position",
  status: "Draft",
};

const EMPTY_CANDIDATE = {
  name: "",
  mobile: "",
  email: "",
  location: "",
  currentCompany: "",
  currentDesignation: "",
  totalExperience: "",
  relevantExperience: "",
  qualification: "",
  skills: "",
  currentCtc: "",
  expectedCtc: "",
  noticePeriod: "",
  preferredLocation: "",
  willingToRelocate: "Yes",
  source: "Naukri",
  referredBy: "",
  recruiter: "",
  requirementId: "",
  stage: "New",
  rejectionReason: "",
  holdReason: "",
  followUpDate: "",
  resume: "",
  notes: "",
};

const EMPTY_INTERVIEW = {
  candidateId: "",
  round: "HR Screening",
  date: "",
  time: "",
  mode: "Online",
  location: "",
  meetingLink: "",
  panel: "",
  coordinator: "",
  status: "Scheduled",
  remarks: "",
};

const EMPTY_FEEDBACK = {
  technical: 0,
  communication: 0,
  experience: 0,
  problemSolving: 0,
  behaviour: 0,
  leadership: 0,
  cultureFit: 0,
  recommendation: "",
  comments: "",
};

const EMPTY_OFFER = {
  candidateId: "",
  designation: "",
  department: "",
  location: "",
  joiningDate: "",
  ctc: "",
  basic: "",
  hra: "",
  other: "",
  probation: "6 Months",
  noticePeriod: "As per policy",
  reportingManager: "",
  status: "Draft",
};

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function money(value) {
  const n = Number(value || 0);
  return n ? `₹${n.toLocaleString("en-IN")}` : "—";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ children, tone = "" }) {
  return <span className={`rec-status ${tone || String(children).toLowerCase().replace(/\s+/g, "-")}`}>{children}</span>;
}

function Modal({ title, children, onClose, wide = false }) {
  const modal = (
    <div
      className="rec-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`rec-modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="rec-modal-head">
          <div>
            <div className="rec-eyebrow">RECRUITMENT</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="rec-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}


function SearchableEmployeeSelect({ options, value, onChange, placeholder = "Select HOD" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selected = options.find((item) => String(item.id) === String(value));

  const filtered = options.filter((item) => {
    const text = `${item.name || ""} ${item.employeeId || ""}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });

  return (
    <div className="rec-search-select" ref={wrapRef}>
      <button
        type="button"
        className={`rec-search-select-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? "" : "placeholder"}>
          {selected
            ? `${selected.name}${selected.employeeId ? ` · ${selected.employeeId}` : ""}`
            : placeholder}
        </span>
        <span className="rec-search-select-arrow">⌄</span>
      </button>

      {open && (
        <div className="rec-search-select-menu">
          <div className="rec-search-select-search">
            <span>⌕</span>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or employee code..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="rec-search-select-options">
            <button
              type="button"
              className="rec-search-select-option muted"
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
            >
              {placeholder}
            </button>

            {filtered.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`rec-search-select-option ${
                  String(item.id) === String(value) ? "selected" : ""
                }`}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {item.name}
                {item.employeeId ? ` · ${item.employeeId}` : ""}
              </button>
            ))}

            {!filtered.length && (
              <div className="rec-search-select-empty">No employee found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Recruitment({ employees = [], masters = {} }) {
  const [requirements, setRequirements] = useState(() => readJSON(REQ_KEY, []));
  const [candidates, setCandidates] = useState(() => readJSON(CANDIDATE_KEY, []));
  const [interviews, setInterviews] = useState(() => readJSON(INTERVIEW_KEY, []));
  const [offers, setOffers] = useState(() => readJSON(OFFER_KEY, []));

  const [view, setView] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [reqFilter, setReqFilter] = useState("All");

  const [reqModal, setReqModal] = useState(false);
  const [candidateModal, setCandidateModal] = useState(false);
  const [interviewModal, setInterviewModal] = useState(false);
  const [offerModal, setOfferModal] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);

  const [reqForm, setReqForm] = useState(EMPTY_REQ);
  const [candidateForm, setCandidateForm] = useState(EMPTY_CANDIDATE);
  const [interviewForm, setInterviewForm] = useState(EMPTY_INTERVIEW);
  const [feedbackForm, setFeedbackForm] = useState(EMPTY_FEEDBACK);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
  const [feedbackInterviewId, setFeedbackInterviewId] = useState("");

  useEffect(() => {
    localStorage.setItem(REQ_KEY, JSON.stringify(requirements));
    localStorage.setItem(CANDIDATE_KEY, JSON.stringify(candidates));
    localStorage.setItem(INTERVIEW_KEY, JSON.stringify(interviews));
    localStorage.setItem(OFFER_KEY, JSON.stringify(offers));

    // Keep the global sidebar badge in sync whenever recruitment data changes.
    window.dispatchEvent(new CustomEvent("bauerHrmsRecruitmentUpdated"));
  }, [requirements, candidates, interviews, offers]);

  useEffect(() => {
    const refresh = () => {
      setRequirements(readJSON(REQ_KEY, []));
      setCandidates(readJSON(CANDIDATE_KEY, []));
      setInterviews(readJSON(INTERVIEW_KEY, []));
      setOffers(readJSON(OFFER_KEY, []));
    };
    window.addEventListener("bauerHrmsRecruitmentUpdated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("bauerHrmsRecruitmentUpdated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const normalizeMasterOptions = (items, fallback) => {
    const source = Array.isArray(items) && items.length ? items : fallback;
    const seen = new Set();

    return source
      .map((item, index) => {
        if (item && typeof item === "object") {
          return {
            id: String(item.id ?? item.name ?? index),
            name: String(item.name ?? item.label ?? item.value ?? "").trim(),
          };
        }
        return {
          id: String(item ?? index),
          name: String(item ?? "").trim(),
        };
      })
      .filter((item) => item.name)
      .filter((item) => {
        const key = item.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  // Department must always come from Organization > Department.
  // No hard-coded/fallback departments are used here.
  const departments = useMemo(() => {
    let storedMasters = {};

    try {
      const saved = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
      storedMasters = saved ? JSON.parse(saved) || {} : {};
    } catch {
      storedMasters = {};
    }

    return normalizeMasterOptions(
      Array.isArray(storedMasters?.departments)
        ? storedMasters.departments
        : [],
      []
    );
  }, []);

  // Location is driven only by Organization > Zone / Location.
  const locations = useMemo(() => {
    let storedMasters = {};

    try {
      const saved = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
      storedMasters = saved ? JSON.parse(saved) || {} : {};
    } catch {
      storedMasters = {};
    }

    return normalizeMasterOptions(
      Array.isArray(storedMasters?.locations) ? storedMasters.locations : [],
      []
    );
  }, []);

  // Position uses the Organization > Designations master.
  // Read localStorage directly as well so Recruitment always gets the
  // latest designations even if Dashboard's organization prop is stale.
  const designations = useMemo(() => {
    let storedMasters = {};

    try {
      const saved = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
      storedMasters = saved ? JSON.parse(saved) || {} : {};
    } catch {
      storedMasters = {};
    }

    // IMPORTANT: Organization Master is the single source of truth.
    // Do NOT prefer Dashboard's `masters` prop because it can contain
    // an older/default designation list (for example Senior VP).
    const masterItems =
      Array.isArray(storedMasters?.designations)
        ? storedMasters.designations
        : [];

    const seen = new Set();

    return masterItems
      .filter((item) => {
        if (item && typeof item === "object") return item.active !== false;
        return Boolean(item);
      })
      .map((item, index) => {
        if (item && typeof item === "object") {
          return {
            id: String(item.id ?? item.name ?? item.label ?? index),
            name: String(
              item.name ?? item.label ?? item.value ?? item.designation ?? ""
            ).trim(),
          };
        }

        return {
          id: String(item ?? index),
          name: String(item ?? "").trim(),
        };
      })
      .filter((item) => item.name)
      .filter((item) => {
        const key = item.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, []);

  // Employee Group is driven only by Organization > Employee Group.
  const employeeGroups = useMemo(() => {
    let storedMasters = {};

    try {
      const saved = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
      storedMasters = saved ? JSON.parse(saved) || {} : {};
    } catch {
      storedMasters = {};
    }

    return normalizeMasterOptions(
      Array.isArray(storedMasters?.employeeGroups)
        ? storedMasters.employeeGroups
        : [],
      []
    );
  }, []);

  const approverOptions = useMemo(() => {
    const seen = new Set();

    return employees
      .filter((employee) => employee && employee.status !== "Inactive")
      .map((employee, index) => {
        const id = String(employee.id ?? employee.employeeId ?? index);
        const employeeId = String(employee.employeeId ?? employee.id ?? "");
        const name = String(employee.name ?? employee.employeeName ?? "").trim();
        const department = String(employee.department ?? "").trim();
        const designation = String(employee.designation ?? "").trim();

        return { id, employeeId, name, department, designation };
      })
      .filter((employee) => employee.name && !seen.has(employee.id))
      .filter((employee) => {
        seen.add(employee.id);
        return true;
      })
      .sort((a, b) => {
        // Put employees from the selected requirement department first.
        const dept = String(reqForm.department || "").toLowerCase();
        const aMatch = dept && a.department.toLowerCase() === dept ? 0 : 1;
        const bMatch = dept && b.department.toLowerCase() === dept ? 0 : 1;
        return aMatch - bMatch || a.name.localeCompare(b.name);
      });
  }, [employees, reqForm.department]);

  const recruiterOptions = useMemo(() => {
    const seen = new Set();
    return employees
      .map((e) => (e && typeof e === "object" ? e?.name ?? e?.employeeName : e))
      .map((name) => String(name ?? "").trim())
      .filter((name) => name && !seen.has(name.toLowerCase()))
      .filter((name) => {
        seen.add(name.toLowerCase());
        return true;
      });
  }, [employees]);

  // Approved/Pending requirements count toward open vacancies.
  // Draft requirements are also shown on the Dashboard so newly created
  // manpower requests are immediately visible to HR.
  const activeRequirements = requirements.filter(
    (r) => r.status === "Approved" || r.status === "Pending Approval"
  );

  const dashboardRequirements = requirements.filter(
    (r) => r.status !== "Closed" && r.status !== "Rejected"
  );

  const openVacancies = activeRequirements.reduce(
    (sum, r) => sum + Math.max(0, Number(r.vacancies || 0)),
    0
  );

  const stats = {
    openPositions: openVacancies,
    totalCandidates: candidates.length,
    interviews: interviews.filter((i) => i.status === "Scheduled").length,
    pendingInterviews: interviews.filter((i) => i.status === "Scheduled" && i.date >= new Date().toISOString().slice(0, 10)).length,
    selected: candidates.filter((c) => ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(c.stage)).length,
    offers: offers.filter((o) => ["Generated", "Sent", "Accepted"].includes(o.status)).length,
    joined: candidates.filter((c) => c.stage === "Joined").length,
    rejected: candidates.filter((c) => c.stage === "Rejected").length,
  };

  const funnel = [
    ["Sourced", candidates.length],
    ["Screening", candidates.filter((c) => ["Screening", "Shortlisted"].includes(c.stage)).length],
    ["Interview", candidates.filter((c) => ["Interview Scheduled", "Interviewed"].includes(c.stage)).length],
    ["Selected", stats.selected],
    ["Offer", candidates.filter((c) => ["Offer Released", "Offer Accepted"].includes(c.stage)).length],
    ["Joined", stats.joined],
  ];

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      const text = [
        c.id, c.name, c.mobile, c.email, c.currentCompany, c.currentDesignation,
        c.skills, c.source, c.recruiter, c.location, c.preferredLocation,
      ].join(" ").toLowerCase();
      return (!q || text.includes(q)) && (stageFilter === "All" || c.stage === stageFilter);
    });
  }, [candidates, search, stageFilter]);

  const filteredRequirements = requirements.filter((r) => reqFilter === "All" || r.status === reqFilter);

  const candidateById = (id) => candidates.find((c) => c.id === id);

  const updateCandidateStage = (id, stage) => {
    setCandidates((prev) => prev.map((c) => c.id === id ? { ...c, stage } : c));
  };

  const deleteRequirement = (id) => {
    const requirement = requirements.find((r) => r.id === id);
    if (!requirement) return;

    const confirmed = window.confirm(
      `Delete requirement "${requirement.title || id}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setRequirements((prev) => prev.filter((r) => r.id !== id));
  };

  const selectRequirementApprover = (value) => {
    const approver = approverOptions.find((employee) => employee.id === value);

    setReqForm((prev) => ({
      ...prev,
      approverId: approver?.id || "",
      approverEmployeeId: approver?.employeeId || "",
      approverName: approver?.name || "",
    }));
  };

  const updateRequirementStatus = (id, status) => {
    setRequirements((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        const approvalStatus =
          status === "Pending Approval"
            ? "Pending"
            : status === "Approved"
              ? "Approved"
              : status === "Rejected"
                ? "Rejected"
                : r.approvalStatus || "Pending";

        return {
          ...r,
          status,
          approvalStatus,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const saveRequirement = (e) => {
    e.preventDefault();
    if (!reqForm.title.trim() || !reqForm.department || !reqForm.vacancies) {
      alert("Position, Department and Vacancies are required.");
      return;
    }
    if (!reqForm.approverId || !reqForm.approverEmployeeId) {
      alert("Please select the Approving HOD.");
      return;
    }

    const item = {
      ...reqForm,
      id: makeId("REQ"),
      approvalStatus: "Pending",
      approvalAssignedToId: reqForm.approverId,
      approvalAssignedToEmployeeId: reqForm.approverEmployeeId,
      approvalAssignedToName: reqForm.approverName,
      createdAt: new Date().toISOString(),
    };
    setRequirements((prev) => [item, ...prev]);
    setReqForm(EMPTY_REQ);
    setReqModal(false);
  };

  const saveCandidate = (e) => {
    e.preventDefault();
    if (!candidateForm.name.trim() || !candidateForm.mobile.trim()) {
      alert("Candidate Name and Mobile are required.");
      return;
    }
    const item = {
      ...candidateForm,
      id: makeId("CAN"),
      createdAt: new Date().toISOString(),
    };
    setCandidates((prev) => [item, ...prev]);
    setCandidateForm(EMPTY_CANDIDATE);
    setCandidateModal(false);
  };

  const saveInterview = (e) => {
    e.preventDefault();
    if (!interviewForm.candidateId || !interviewForm.date || !interviewForm.time) {
      alert("Candidate, date and time are required.");
      return;
    }
    const item = {
      ...interviewForm,
      id: makeId("INT"),
      createdAt: new Date().toISOString(),
    };
    setInterviews((prev) => [item, ...prev]);
    updateCandidateStage(interviewForm.candidateId, "Interview Scheduled");
    setInterviewForm(EMPTY_INTERVIEW);
    setInterviewModal(false);
  };

  const openFeedback = (interview) => {
    setFeedbackInterviewId(interview.id);
    setFeedbackForm(interview.feedback || EMPTY_FEEDBACK);
    setFeedbackModal(true);
  };

  const saveFeedback = (e) => {
    e.preventDefault();
    const interview = interviews.find((i) => i.id === feedbackInterviewId);
    if (!interview) return;
    setInterviews((prev) => prev.map((i) => i.id === feedbackInterviewId
      ? { ...i, feedback: feedbackForm, status: "Completed" }
      : i
    ));
    if (feedbackForm.recommendation === "Strong Hire" || feedbackForm.recommendation === "Hire") {
      updateCandidateStage(interview.candidateId, "Selected");
    } else if (feedbackForm.recommendation === "Hold") {
      updateCandidateStage(interview.candidateId, "Hold");
    } else if (feedbackForm.recommendation === "Reject") {
      updateCandidateStage(interview.candidateId, "Rejected");
    } else {
      updateCandidateStage(interview.candidateId, "Interviewed");
    }
    setFeedbackModal(false);
  };

  const saveOffer = (e) => {
    e.preventDefault();
    if (!offerForm.candidateId || !offerForm.designation || !offerForm.ctc) {
      alert("Candidate, Designation and CTC are required.");
      return;
    }
    const item = { ...offerForm, id: makeId("OFF"), createdAt: new Date().toISOString() };
    setOffers((prev) => [item, ...prev]);
    updateCandidateStage(offerForm.candidateId, "Offer Released");
    setOfferForm(EMPTY_OFFER);
    setOfferModal(false);
  };

  const convertToEmployee = (candidate) => {
    if (!candidate) return;
    if (candidate.stage !== "Joined") {
      alert("Candidate must be in Joined stage before converting to Employee.");
      return;
    }
    alert(`Candidate ${candidate.name} is ready for Employee Master conversion. Connect this action to your Employee Master backend/localStorage.`);
  };

  const exportCandidates = () => {
    const header = ["Candidate ID", "Name", "Mobile", "Email", "Company", "Designation", "Experience", "Source", "Recruiter", "Stage"];
    const rows = candidates.map((c) => [c.id, c.name, c.mobile, c.email, c.currentCompany, c.currentDesignation, c.totalExperience, c.source, c.recruiter, c.stage]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BAUER_Recruitment_Candidates_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navItems = [
    ["Dashboard", "⌂"],
    ["Requirements", "▣"],
    ["Candidates", "♙"],
    ["Interviews", "◷"],
    ["Offers", "▤"],
    ["Joining", "✓"],
    ["Reports", "▥"],
    ["Settings", "⚙"],
  ];

  const renderDashboard = () => (
    <>
      <div className="rec-summary-grid">
        {[
          ["Open Positions", stats.openPositions, "Open approved / pending vacancies"],
          ["Total Candidates", stats.totalCandidates, "Candidate master records"],
          ["Interviews Scheduled", stats.interviews, "Upcoming / scheduled"],
          ["Selected", stats.selected, "Selected candidates"],
          ["Offers", stats.offers, "Active offer pipeline"],
          ["Joined", stats.joined, "Converted / joined candidates"],
        ].map(([label, value, sub]) => (
          <div className="rec-summary-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>

      <div className="rec-grid-2">
        <div className="rec-card">
          <div className="rec-card-head">
            <div><span className="rec-eyebrow">PIPELINE</span><h3>Recruitment Funnel</h3></div>
          </div>
          <div className="rec-funnel">
            {funnel.map(([label, value], index) => (
              <div className="rec-funnel-item" key={label}>
                <div className="rec-funnel-number">{value}</div>
                <div className="rec-funnel-bar"><span style={{ width: `${Math.max(8, stats.totalCandidates ? (value / stats.totalCandidates) * 100 : 0)}%` }} /></div>
                <small>{label}</small>
                {index < funnel.length - 1 && <b>›</b>}
              </div>
            ))}
          </div>
        </div>

        <div className="rec-card">
          <div className="rec-card-head">
            <div><span className="rec-eyebrow">TODAY / UPCOMING</span><h3>Interview Schedule</h3></div>
            <button className="rec-link-btn" onClick={() => setView("Interviews")}>View all →</button>
          </div>
          <div className="rec-mini-list">
            {interviews.filter((i) => i.status === "Scheduled").sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 5).map((i) => {
              const c = candidateById(i.candidateId);
              return <div className="rec-mini-row" key={i.id}><div className="rec-date-box"><b>{i.date ? new Date(`${i.date}T00:00:00`).getDate() : "—"}</b><span>{i.date ? new Date(`${i.date}T00:00:00`).toLocaleString("en", { month: "short" }) : ""}</span></div><div><strong>{c?.name || i.candidateId}</strong><span>{i.round} · {i.time} · {i.mode}</span></div><StatusBadge>Scheduled</StatusBadge></div>;
            })}
            {!interviews.filter((i) => i.status === "Scheduled").length && <div className="rec-empty">No interviews scheduled.</div>}
          </div>
        </div>
      </div>

      <div className="rec-grid-2">
        <div className="rec-card">
          <div className="rec-card-head"><div><span className="rec-eyebrow">OPEN HIRING</span><h3>Open Requirements</h3></div><button className="rec-link-btn" onClick={() => setView("Requirements")}>View all →</button></div>
          <div className="rec-simple-table">
            {dashboardRequirements.slice(0, 6).map((r) => (
              <div className="rec-simple-row" key={r.id}>
                <div>
                  <strong>{r.title}</strong>
                  <span>{r.department} · {r.location || "—"} · {r.recruiter || "Unassigned"}</span>
                  <small>{r.status}</small>
                </div>
                <b>{r.vacancies} opening{Number(r.vacancies) === 1 ? "" : "s"}</b>
              </div>
            ))}
            {!dashboardRequirements.length && <div className="rec-empty">No open requirements. Create the first manpower requirement.</div>}
          </div>
        </div>

        <div className="rec-card">
          <div className="rec-card-head"><div><span className="rec-eyebrow">RECENT</span><h3>Candidate Activity</h3></div><button className="rec-link-btn" onClick={() => setView("Candidates")}>View all →</button></div>
          <div className="rec-simple-table">
            {candidates.slice(0, 6).map((c) => <div className="rec-simple-row" key={c.id}><div><strong>{c.name}</strong><span>{c.currentDesignation || "Candidate"} · {c.source} · {formatDate(c.createdAt?.slice(0, 10))}</span></div><StatusBadge>{c.stage}</StatusBadge></div>)}
            {!candidates.length && <div className="rec-empty">No candidates added yet.</div>}
          </div>
        </div>
      </div>
    </>
  );

  const renderRequirements = () => (
    <div className="rec-card">
      <div className="rec-card-head">
        <div><span className="rec-eyebrow">MANPOWER PLANNING</span><h3>Manpower Requirements</h3><p>Raise, approve and track hiring requirements.</p></div>
        <button className="rec-primary" onClick={() => setReqModal(true)}>＋ New Requirement</button>
      </div>
      <div className="rec-toolbar">
        <input placeholder="Search position, department, recruiter..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={reqFilter} onChange={(e) => setReqFilter(e.target.value)}><option value="All">All Status</option>{REQ_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Requirement</th><th>Department</th><th>Location</th><th>Vacancies</th><th>Priority</th><th>Recruiter</th><th>Target Date</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {filteredRequirements.filter((r) => !search || `${r.id} ${r.title} ${r.department} ${r.recruiter} ${r.location}`.toLowerCase().includes(search.toLowerCase())).map((r) => <tr key={r.id}><td><strong>{r.title}</strong><span className="rec-sub">{r.id}</span></td><td>{r.department}</td><td>{r.location || "—"}</td><td><b>{r.vacancies}</b></td><td><StatusBadge tone={`priority-${String(r.priority).toLowerCase()}`}>{r.priority}</StatusBadge></td><td>{r.recruiter || "—"}</td><td>{formatDate(r.targetDate)}</td><td>
              <StatusBadge>{r.status}</StatusBadge>
              {r.approvalAssignedToName && <span className="rec-sub">HOD: {r.approvalAssignedToName}</span>}
            </td><td>
              <div className="rec-table-actions">
                {r.status === "Draft" && <button className="rec-inline-action" onClick={() => updateRequirementStatus(r.id, "Pending Approval")}>Submit</button>}
                {r.status === "Pending Approval" && <>
                  <button className="rec-inline-action approve" onClick={() => updateRequirementStatus(r.id, "Approved")}>Approve</button>
                  <button className="rec-inline-action reject" onClick={() => updateRequirementStatus(r.id, "Rejected")}>Reject</button>
                </>}
                {r.status === "Approved" && <button className="rec-inline-action close" onClick={() => updateRequirementStatus(r.id, "Closed")}>Close</button>}
                {r.status === "Rejected" && <button className="rec-inline-action" onClick={() => updateRequirementStatus(r.id, "Draft")}>Reopen</button>}
                {r.status === "Closed" && <span className="rec-sub">Closed</span>}
                <button
                  className="rec-inline-action delete"
                  onClick={() => deleteRequirement(r.id)}
                >
                  Delete
                </button>
              </div>
            </td></tr>)}
      </tbody></table>{!filteredRequirements.length && <div className="rec-empty">No requirements found.</div>}</div>
    </div>
  );

  const renderCandidates = () => (
    <div className="rec-card">
      <div className="rec-card-head">
        <div><span className="rec-eyebrow">CANDIDATE MASTER</span><h3>Candidates</h3><p>Manage the complete candidate lifecycle.</p></div>
        <div className="rec-head-actions"><button className="rec-secondary" onClick={exportCandidates}>↓ Export CSV</button><button className="rec-primary" onClick={() => setCandidateModal(true)}>＋ Add Candidate</button></div>
      </div>
      <div className="rec-toolbar"><input placeholder="Search candidate, mobile, company, skill..." value={search} onChange={(e) => setSearch(e.target.value)} /><select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}><option value="All">All Stages</option>{CANDIDATE_STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Candidate</th><th>Position</th><th>Experience</th><th>Source</th><th>Recruiter</th><th>Stage</th><th>Action</th></tr></thead><tbody>
        {filteredCandidates.map((c) => <tr key={c.id}><td><div className="rec-person"><div className="rec-avatar">{String(c.name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("")}</div><div><strong>{c.name}</strong><span>{c.mobile} · {c.email || "No email"}</span></div></div></td><td>{c.requirementId ? requirements.find((r) => r.id === c.requirementId)?.title || c.requirementId : c.currentDesignation || "—"}</td><td>{c.totalExperience || "—"}</td><td>{c.source}</td><td>{c.recruiter || "—"}</td><td><StatusBadge>{c.stage}</StatusBadge></td><td><select className="rec-inline-select" value={c.stage} onChange={(e) => updateCandidateStage(c.id, e.target.value)}>{CANDIDATE_STAGES.map((s) => <option key={s}>{s}</option>)}</select></td></tr>)}
      </tbody></table>{!filteredCandidates.length && <div className="rec-empty">No candidates match the selected filters.</div>}</div>
    </div>
  );

  const renderInterviews = () => (
    <div className="rec-card">
      <div className="rec-card-head"><div><span className="rec-eyebrow">INTERVIEW MANAGEMENT</span><h3>Interviews</h3><p>Schedule panels, capture feedback and move candidates through rounds.</p></div><button className="rec-primary" onClick={() => setInterviewModal(true)}>＋ Schedule Interview</button></div>
      <div className="rec-interview-grid">
        {interviews.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((i) => {
          const c = candidateById(i.candidateId);
          return <div className="rec-interview-card" key={i.id}><div className="rec-interview-top"><span>{i.round}</span><StatusBadge>{i.status}</StatusBadge></div><h4>{c?.name || i.candidateId}</h4><p>{c?.currentDesignation || "Candidate"} · {c?.mobile || ""}</p><div className="rec-interview-meta"><span>◷ {formatDate(i.date)} · {i.time}</span><span>⌁ {i.mode}</span><span>♙ {i.panel || "Panel not assigned"}</span></div><div className="rec-interview-actions">{i.mode === "Online" && i.meetingLink && <a href={i.meetingLink} target="_blank" rel="noreferrer">Meeting ↗</a>}<button onClick={() => openFeedback(i)}>Feedback</button></div></div>;
        })}
        {!interviews.length && <div className="rec-empty">No interviews scheduled yet.</div>}
      </div>
    </div>
  );

  const renderOffers = () => (
    <div className="rec-card">
      <div className="rec-card-head"><div><span className="rec-eyebrow">OFFER MANAGEMENT</span><h3>Offers</h3><p>Generate and track candidate offers.</p></div><button className="rec-primary" onClick={() => setOfferModal(true)}>＋ Create Offer</button></div>
      <div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Candidate</th><th>Designation</th><th>Department</th><th>CTC</th><th>Joining Date</th><th>Reporting Manager</th><th>Status</th></tr></thead><tbody>
        {offers.map((o) => { const c = candidateById(o.candidateId); return <tr key={o.id}><td><strong>{c?.name || o.candidateId}</strong><span className="rec-sub">{o.id}</span></td><td>{o.designation}</td><td>{o.department || "—"}</td><td>{money(o.ctc)}</td><td>{formatDate(o.joiningDate)}</td><td>{o.reportingManager || "—"}</td><td><StatusBadge>{o.status}</StatusBadge></td></tr>; })}
      </tbody></table>{!offers.length && <div className="rec-empty">No offers created yet.</div>}</div>
    </div>
  );

  const renderJoining = () => {
    const joiningCandidates = candidates.filter((c) => ["Offer Accepted", "Joining Scheduled", "Joined"].includes(c.stage));
    return <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">ONBOARDING HANDOFF</span><h3>Joining</h3><p>Track accepted offers through joining and Employee Master handoff.</p></div></div><div className="rec-joining-grid">
      {joiningCandidates.map((c) => { const offer = offers.find((o) => o.candidateId === c.id); return <div className="rec-joining-card" key={c.id}><div className="rec-person"><div className="rec-avatar">{String(c.name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("")}</div><div><strong>{c.name}</strong><span>{c.mobile} · {c.email || "No email"}</span></div></div><div className="rec-joining-info"><span>Position <b>{offer?.designation || c.currentDesignation || "—"}</b></span><span>Joining Date <b>{formatDate(offer?.joiningDate)}</b></span><span>CTC <b>{money(offer?.ctc)}</b></span></div><div className="rec-joining-actions"><select value={c.stage} onChange={(e) => updateCandidateStage(c.id, e.target.value)}><option>Offer Accepted</option><option>Joining Scheduled</option><option>Joined</option></select>{c.stage === "Joined" && <button onClick={() => convertToEmployee(c)}>Convert to Employee</button>}</div></div>})}
      {!joiningCandidates.length && <div className="rec-empty">No candidates are currently in the joining pipeline.</div>}
    </div></div>;
  };

  const renderReports = () => {
    const sourceCounts = SOURCES.map((source) => [source, candidates.filter((c) => c.source === source).length]).filter(([, count]) => count);
    const stageCounts = CANDIDATE_STAGES.map((stage) => [stage, candidates.filter((c) => c.stage === stage).length]).filter(([, count]) => count);
    return <div className="rec-report-grid"><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">ANALYTICS</span><h3>Recruitment Performance</h3></div></div><div className="rec-kpi-report">{[["Total Candidates", candidates.length], ["Interviewed", candidates.filter((c) => ["Interviewed", "Selected", "Rejected", "Hold", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(c.stage)).length], ["Selection", stats.selected], ["Offers", offers.length], ["Joined", stats.joined], ["Rejected", stats.rejected]].map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div></div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">SOURCE ANALYSIS</span><h3>Candidate Sources</h3></div></div>{sourceCounts.length ? sourceCounts.map(([label, count]) => <div className="rec-report-bar" key={label}><span>{label}</span><div><i style={{ width: `${Math.max(6, (count / Math.max(1, candidates.length)) * 100)}%` }} /></div><b>{count}</b></div>) : <div className="rec-empty">Add candidates to see source analytics.</div>}</div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">PIPELINE ANALYSIS</span><h3>Stage Distribution</h3></div></div>{stageCounts.length ? stageCounts.map(([label, count]) => <div className="rec-report-row" key={label}><span>{label}</span><b>{count}</b></div>) : <div className="rec-empty">No candidate pipeline data yet.</div>}</div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">HIRING DEMAND</span><h3>Open Requirements</h3></div></div>{activeRequirements.length ? activeRequirements.map((r) => <div className="rec-report-row" key={r.id}><span>{r.title}<small>{r.department} · {r.location || "—"}</small></span><b>{r.vacancies}</b></div>) : <div className="rec-empty">No open requirements.</div>}</div></div>;
  };

  const renderSettings = () => (
    <div className="rec-settings-grid">
      <div className="rec-card"><span className="rec-eyebrow">MASTERS</span><h3>Recruitment Configuration</h3><div className="rec-setting-row"><span>Candidate Sources</span><b>{SOURCES.length}</b></div><div className="rec-setting-row"><span>Interview Rounds</span><b>{INTERVIEW_ROUNDS.length}</b></div><div className="rec-setting-row"><span>Candidate Stages</span><b>{CANDIDATE_STAGES.length}</b></div><div className="rec-setting-row"><span>Recommendation Types</span><b>{RECOMMENDATIONS.length}</b></div></div>
      <div className="rec-card"><span className="rec-eyebrow">INTEGRATION</span><h3>HRMS Connections</h3><div className="rec-integration"><span>Employee Master</span><StatusBadge tone="connected">Connected</StatusBadge></div><div className="rec-integration"><span>Organization Masters</span><StatusBadge tone="connected">Connected</StatusBadge></div><div className="rec-integration"><span>Attendance / Leave / Payroll</span><StatusBadge tone="ready">Ready for Employee Handoff</StatusBadge></div></div>
    </div>
  );

  const renderContent = () => {
    if (view === "Requirements") return renderRequirements();
    if (view === "Candidates") return renderCandidates();
    if (view === "Interviews") return renderInterviews();
    if (view === "Offers") return renderOffers();
    if (view === "Joining") return renderJoining();
    if (view === "Reports") return renderReports();
    if (view === "Settings") return renderSettings();
    return renderDashboard();
  };

  return (
    <section className="recruitment-module">
      <div className="rec-page-head">
        <div>
          <div className="rec-eyebrow">WORKFORCE ACQUISITION</div>
          <h1>Recruitment</h1>
          <p>End-to-end hiring management from manpower requirement to employee joining.</p>
        </div>
        <div className="rec-page-actions">
          <button className="rec-secondary" onClick={() => setReqModal(true)}>＋ Requirement</button>
          <button className="rec-primary" onClick={() => setCandidateModal(true)}>＋ Candidate</button>
        </div>
      </div>

      <div className="rec-nav">
        {navItems.map(([item, icon]) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}><span>{icon}</span>{item}</button>)}
      </div>

      {renderContent()}

      {reqModal && <Modal title="New Manpower Requirement" onClose={() => setReqModal(false)} wide><form className="rec-form-grid" onSubmit={saveRequirement}>
        <label>Position *
          <select
            value={reqForm.title}
            onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
            required
          >
            <option value="">Select Position</option>
            {designations.map((x) => (
              <option key={x.id} value={x.name}>{x.name}</option>
            ))}
          </select>
          {!designations.length && (
            <small className="rec-form-help">No designations are configured in Organization Masters.</small>
          )}
        </label>
        <label>Department *<select value={reqForm.department} onChange={(e) => setReqForm({ ...reqForm, department: e.target.value })}><option value="">Select</option>{departments.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</select></label>
        <label>Location<select value={reqForm.location} onChange={(e) => setReqForm({ ...reqForm, location: e.target.value })}><option value="">Select</option>{locations.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</select></label>
        <label>Vacancies *<input type="number" min="1" value={reqForm.vacancies} onChange={(e) => setReqForm({ ...reqForm, vacancies: e.target.value })} /></label>
        <label>Employment Type<select value={reqForm.employmentType} onChange={(e) => setReqForm({ ...reqForm, employmentType: e.target.value })}><option>Full Time</option><option>Part Time</option></select></label>
        <label>Employee Group
          <select value={reqForm.employeeGroup} onChange={(e) => setReqForm({ ...reqForm, employeeGroup: e.target.value })}>
            <option value="">Select</option>
            {employeeGroups.map((x) => (
              <option key={x.id} value={x.name}>{x.name}</option>
            ))}
          </select>
        </label>
        <label>Qualification<input value={reqForm.qualification} onChange={(e) => setReqForm({ ...reqForm, qualification: e.target.value })} placeholder="e.g. B.Tech Civil" /></label>
        <label>Experience
          <select value={reqForm.experience} onChange={(e) => setReqForm({ ...reqForm, experience: e.target.value })}>
            {EXPERIENCE_OPTIONS.map((x) => (
              <option key={x} value={x}>{x === "30+" ? "30+ Years" : `${x} Years`}</option>
            ))}
          </select>
        </label>
        <label className="full">Required Skills<input value={reqForm.skills} onChange={(e) => setReqForm({ ...reqForm, skills: e.target.value })} placeholder="e.g. AutoCAD, execution, site management" /></label>
        <label>Min CTC (LPA)
          <select value={reqForm.minCtc} onChange={(e) => setReqForm({ ...reqForm, minCtc: e.target.value })}>
            {CTC_LPA_OPTIONS.map((x) => (
              <option key={x} value={x}>{x === "30+" ? "30+ LPA" : `${x} LPA`}</option>
            ))}
          </select>
        </label>
        <label>Max CTC (LPA)
          <select value={reqForm.maxCtc} onChange={(e) => setReqForm({ ...reqForm, maxCtc: e.target.value })}>
            {CTC_LPA_OPTIONS.map((x) => (
              <option key={x} value={x}>{x === "30+" ? "30+ LPA" : `${x} LPA`}</option>
            ))}
          </select>
        </label>
        <label>Priority<select value={reqForm.priority} onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></label>
        <label>Target Joining Date<input type="date" value={reqForm.targetDate} onChange={(e) => setReqForm({ ...reqForm, targetDate: e.target.value })} /></label>
        <label>Hiring Manager<input value={reqForm.hiringManager} onChange={(e) => setReqForm({ ...reqForm, hiringManager: e.target.value })} /></label>
        <label>Approving HOD *
          <SearchableEmployeeSelect
            options={approverOptions}
            value={reqForm.approverId}
            onChange={selectRequirementApprover}
            placeholder="Select HOD"
          />
        </label>
        <label>Recruiter<select value={reqForm.recruiter} onChange={(e) => setReqForm({ ...reqForm, recruiter: e.target.value })}><option value="">Select</option>{recruiterOptions.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
        <label>Reason<select value={reqForm.reason} onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}><option>New Position</option><option>Replacement</option><option>Expansion</option><option>Attrition</option></select></label>
        <div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={() => setReqModal(false)}>Cancel</button><button className="rec-primary">Save Requirement</button></div>
      </form></Modal>}

      {candidateModal && <Modal title="Add Candidate" onClose={() => setCandidateModal(false)} wide><form className="rec-form-grid" onSubmit={saveCandidate}>
        <label>Candidate Name *<input value={candidateForm.name} onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })} /></label>
        <label>Mobile *<input inputMode="numeric" value={candidateForm.mobile} onChange={(e) => setCandidateForm({ ...candidateForm, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} /></label>
        <label>Email<input type="email" value={candidateForm.email} onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} /></label>
        <label>Current Location<input value={candidateForm.location} onChange={(e) => setCandidateForm({ ...candidateForm, location: e.target.value })} /></label>
        <label>Current Company<input value={candidateForm.currentCompany} onChange={(e) => setCandidateForm({ ...candidateForm, currentCompany: e.target.value })} /></label>
        <label>Current Designation<input value={candidateForm.currentDesignation} onChange={(e) => setCandidateForm({ ...candidateForm, currentDesignation: e.target.value })} /></label>
        <label>Total Experience<input value={candidateForm.totalExperience} onChange={(e) => setCandidateForm({ ...candidateForm, totalExperience: e.target.value })} placeholder="e.g. 5 Years" /></label>
        <label>Relevant Experience<input value={candidateForm.relevantExperience} onChange={(e) => setCandidateForm({ ...candidateForm, relevantExperience: e.target.value })} /></label>
        <label>Qualification<input value={candidateForm.qualification} onChange={(e) => setCandidateForm({ ...candidateForm, qualification: e.target.value })} /></label>
        <label>Skills<input value={candidateForm.skills} onChange={(e) => setCandidateForm({ ...candidateForm, skills: e.target.value })} /></label>
        <label>Current CTC<input value={candidateForm.currentCtc} onChange={(e) => setCandidateForm({ ...candidateForm, currentCtc: e.target.value })} /></label>
        <label>Expected CTC<input value={candidateForm.expectedCtc} onChange={(e) => setCandidateForm({ ...candidateForm, expectedCtc: e.target.value })} /></label>
        <label>Notice Period<input value={candidateForm.noticePeriod} onChange={(e) => setCandidateForm({ ...candidateForm, noticePeriod: e.target.value })} /></label>
        <label>Preferred Location<input value={candidateForm.preferredLocation} onChange={(e) => setCandidateForm({ ...candidateForm, preferredLocation: e.target.value })} /></label>
        <label>Willing to Relocate<select value={candidateForm.willingToRelocate} onChange={(e) => setCandidateForm({ ...candidateForm, willingToRelocate: e.target.value })}><option>Yes</option><option>No</option></select></label>
        <label>Source<select value={candidateForm.source} onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Recruiter<select value={candidateForm.recruiter} onChange={(e) => setCandidateForm({ ...candidateForm, recruiter: e.target.value })}><option value="">Select</option>{recruiterOptions.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
        <label>Requirement<select value={candidateForm.requirementId} onChange={(e) => setCandidateForm({ ...candidateForm, requirementId: e.target.value })}><option value="">Select</option>{requirements.filter((r) => r.status !== "Closed").map((r) => <option key={r.id} value={r.id}>{r.title} · {r.id}</option>)}</select></label>
        <label>Initial Stage<select value={candidateForm.stage} onChange={(e) => setCandidateForm({ ...candidateForm, stage: e.target.value })}><option>New</option><option>Screening</option></select></label>
        <label className="full">Notes<textarea rows="3" value={candidateForm.notes} onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })} /></label>
        <div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={() => setCandidateModal(false)}>Cancel</button><button className="rec-primary">Save Candidate</button></div>
      </form></Modal>}

      {interviewModal && <Modal title="Schedule Interview" onClose={() => setInterviewModal(false)}><form className="rec-form-grid" onSubmit={saveInterview}>
        <label className="full">Candidate *<select value={interviewForm.candidateId} onChange={(e) => setInterviewForm({ ...interviewForm, candidateId: e.target.value })}><option value="">Select Candidate</option>{candidates.filter((c) => !["Rejected", "Joined"].includes(c.stage)).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.currentDesignation || "Candidate"}</option>)}</select></label>
        <label>Round<select value={interviewForm.round} onChange={(e) => setInterviewForm({ ...interviewForm, round: e.target.value })}>{INTERVIEW_ROUNDS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Mode<select value={interviewForm.mode} onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}>{INTERVIEW_MODES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Date *<input type="date" value={interviewForm.date} onChange={(e) => setInterviewForm({ ...interviewForm, date: e.target.value })} /></label>
        <label>Time *<input type="time" value={interviewForm.time} onChange={(e) => setInterviewForm({ ...interviewForm, time: e.target.value })} /></label>
        <label>Panel / Interviewer<input value={interviewForm.panel} onChange={(e) => setInterviewForm({ ...interviewForm, panel: e.target.value })} /></label>
        <label>Coordinator<input value={interviewForm.coordinator} onChange={(e) => setInterviewForm({ ...interviewForm, coordinator: e.target.value })} /></label>
        <label className="full">Meeting Link / Location<input value={interviewForm.mode === "Online" ? interviewForm.meetingLink : interviewForm.location} onChange={(e) => setInterviewForm({ ...interviewForm, [interviewForm.mode === "Online" ? "meetingLink" : "location"]: e.target.value })} placeholder={interviewForm.mode === "Online" ? "https://..." : "Interview location"} /></label>
        <label className="full">Remarks<textarea rows="3" value={interviewForm.remarks} onChange={(e) => setInterviewForm({ ...interviewForm, remarks: e.target.value })} /></label>
        <div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={() => setInterviewModal(false)}>Cancel</button><button className="rec-primary">Schedule Interview</button></div>
      </form></Modal>}

      {feedbackModal && <Modal title="Interview Feedback" onClose={() => setFeedbackModal(false)} wide><form onSubmit={saveFeedback}><div className="rec-rating-grid">
        {["technical", "communication", "experience", "problemSolving", "behaviour", "leadership", "cultureFit"].map((key) => <label key={key}>{key.replace(/([A-Z])/g, " $1")}<select value={feedbackForm[key]} onChange={(e) => setFeedbackForm({ ...feedbackForm, [key]: Number(e.target.value) })}><option value="0">Not Rated</option><option value="1">1 — Poor</option><option value="2">2 — Below Average</option><option value="3">3 — Average</option><option value="4">4 — Good</option><option value="5">5 — Excellent</option></select></label>)}
      </div><div className="rec-form-grid"><label>Recommendation<select value={feedbackForm.recommendation} onChange={(e) => setFeedbackForm({ ...feedbackForm, recommendation: e.target.value })}><option value="">Select</option>{RECOMMENDATIONS.map((x) => <option key={x}>{x}</option>)}</select></label><label className="full">Comments<textarea rows="4" value={feedbackForm.comments} onChange={(e) => setFeedbackForm({ ...feedbackForm, comments: e.target.value })} /></label></div><div className="rec-form-actions"><button type="button" className="rec-secondary" onClick={() => setFeedbackModal(false)}>Cancel</button><button className="rec-primary">Submit Feedback</button></div></form></Modal>}

      {offerModal && <Modal title="Create Offer" onClose={() => setOfferModal(false)} wide><form className="rec-form-grid" onSubmit={saveOffer}>
        <label>Candidate *<select value={offerForm.candidateId} onChange={(e) => setOfferForm({ ...offerForm, candidateId: e.target.value })}><option value="">Select Candidate</option>{candidates.filter((c) => ["Selected", "Offer Released", "Offer Accepted"].includes(c.stage)).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.currentDesignation || "Candidate"}</option>)}</select></label>
        <label>Designation *<input value={offerForm.designation} onChange={(e) => setOfferForm({ ...offerForm, designation: e.target.value })} /></label>
        <label>Department<select value={offerForm.department} onChange={(e) => setOfferForm({ ...offerForm, department: e.target.value })}><option value="">Select</option>{departments.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</select></label>
        <label>Location<select value={offerForm.location} onChange={(e) => setOfferForm({ ...offerForm, location: e.target.value })}><option value="">Select</option>{locations.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</select></label>
        <label>Joining Date<input type="date" value={offerForm.joiningDate} onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })} /></label>
        <label>Annual CTC *<input type="number" value={offerForm.ctc} onChange={(e) => setOfferForm({ ...offerForm, ctc: e.target.value })} /></label>
        <label>Basic<input type="number" value={offerForm.basic} onChange={(e) => setOfferForm({ ...offerForm, basic: e.target.value })} /></label>
        <label>HRA<input type="number" value={offerForm.hra} onChange={(e) => setOfferForm({ ...offerForm, hra: e.target.value })} /></label>
        <label>Other Components<input type="number" value={offerForm.other} onChange={(e) => setOfferForm({ ...offerForm, other: e.target.value })} /></label>
        <label>Probation<select value={offerForm.probation} onChange={(e) => setOfferForm({ ...offerForm, probation: e.target.value })}><option>3 Months</option><option>6 Months</option><option>12 Months</option></select></label>
        <label>Notice Period<input value={offerForm.noticePeriod} onChange={(e) => setOfferForm({ ...offerForm, noticePeriod: e.target.value })} /></label>
        <label>Reporting Manager<input value={offerForm.reportingManager} onChange={(e) => setOfferForm({ ...offerForm, reportingManager: e.target.value })} /></label>
        <div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={() => setOfferModal(false)}>Cancel</button><button className="rec-primary">Create Offer</button></div>
      </form></Modal>}
    </section>
  );
}
