import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import { loadOrganizationMasters } from "./organizationStorage";
import "./Recruitment.css";

const ORGANIZATION_CODE = "BAUERE";
const RECRUITMENT_SETTINGS_KEY = "recruitment";

const REQ_STATUSES = ["Draft", "Pending Approval", "Approved", "On Hold", "Partially Filled", "Filled", "Rejected", "Closed", "Cancelled"];
const CANDIDATE_STAGES = ["New", "Screening", "Shortlisted", "Interview Scheduled", "Interviewed", "Selected", "Hold", "Rejected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined", "Withdrawn", "No Show"];
const REQUIREMENT_VISIBLE_STAGES = ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"];
const SOURCES = ["Naukri", "LinkedIn", "Referral", "Consultant", "Walk-in", "Website", "Campus", "Internal", "Other"];
const INTERVIEW_MODES = ["Face to Face", "Online", "Telephonic"];
const INTERVIEW_ROUNDS = ["HR Screening", "Technical", "Managerial", "Final HR", "Client / Project"];
const INTERVIEW_STATUSES = ["Not Scheduled", "Scheduled", "Rescheduled", "Completed", "Feedback Pending", "Feedback Received", "Cancelled", "No Show"];
const RECOMMENDATIONS = ["Strong Hire", "Hire", "Hold", "Reject"];
const MAPPING_STATUSES = ["Not Started", "In Progress", "Pending Certificate", "Mapped", "Verified", "Mismatch", "Rejected"];
const DOC_STATUSES = ["Not Started", "Requested", "Pending", "Received", "Under Verification", "Verified", "Rejected", "Not Applicable"];
const BGV_STATUSES = ["Not Initiated", "Initiated", "Documents Awaited", "Submitted", "In Progress", "Clear", "Discrepancy", "Failed", "Closed"];
const OFFER_STATUSES = ["Draft", "Approval Pending", "Generated", "Sent", "Accepted", "Declined", "Withdrawn"];
const JOINING_STATUSES = ["Expected", "Confirmed", "Rescheduled", "Joined", "Delayed", "No Show", "Cancelled"];
const DOCUMENT_TYPES = ["Updated CV", "Aadhaar Card", "PAN Card", "Passport Photo", "Address Proof", "Educational Certificate", "Experience Certificate", "Relieving Letter", "Salary Proof", "Bank Proof", "Medical / Fitness", "Other"];
const MANDATORY_DOCUMENT_TYPES = ["Updated CV"];
const OPTIONAL_DOCUMENT_TYPES = DOCUMENT_TYPES.filter((type) => !MANDATORY_DOCUMENT_TYPES.includes(type));
const LETTER_TYPES = ["Offer Letter", "Appointment Letter", "Termination Letter"];
const EXPERIENCE_OPTIONS = ["0-2", "2-4", "5-8", "8-10", "10-12", "12-15", "15-20", "20-25", "25-30", "30+"];
const CTC_LPA_OPTIONS = ["0-2", "2-4", "5-8", "8-10", "10-12", "12-15", "15-20", "20-25", "25-30", "30+"];

const DEFAULT_LETTER_TEMPLATES = [
  {
    id: "TPL-OFFER",
    type: "Offer Letter",
    name: "Standard Offer Letter",
    subject: "Offer of Employment",
    letterheadImage: "",
    bodyTemplate: `Date: {{DATE}}\n\nTo,\n{{EMPLOYEE_NAME}}\n{{ADDRESS}}\n\nSubject: Offer of Employment\n\nDear {{EMPLOYEE_NAME}},\n\nWe are pleased to offer you the position of {{DESIGNATION}} in the {{DEPARTMENT}} department at {{LOCATION}} with effect from {{JOINING_DATE}}. Your annual CTC will be {{CTC}}. You will report to {{REPORTING_MANAGER}}.\n\nYour employment will be subject to the terms and conditions of the Company, including the applicable probation and notice period policies.\n\nWe look forward to your contribution and wish you a successful career with the organization.\n\nFor {{COMPANY_NAME}}\n\nAuthorized Signatory`,
    footerText: "This is a system-generated document. Please sign and issue through the authorized HR process.",
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "TPL-APPOINTMENT",
    type: "Appointment Letter",
    name: "Standard Appointment Letter",
    subject: "Appointment Letter",
    letterheadImage: "",
    bodyTemplate: `Date: {{DATE}}\n\nTo,\n{{EMPLOYEE_NAME}}\n{{ADDRESS}}\n\nSubject: Appointment Letter\n\nDear {{EMPLOYEE_NAME}},\n\nWith reference to your selection and the offer extended to you, we are pleased to appoint you as {{DESIGNATION}} in the {{DEPARTMENT}} department at {{LOCATION}} with effect from {{JOINING_DATE}}.\n\nYour annual CTC will be {{CTC}} and you will report to {{REPORTING_MANAGER}}. Your probation period will be {{PROBATION}}.\n\nThis appointment is subject to the Company's applicable policies, rules and conditions of service.\n\nFor {{COMPANY_NAME}}\n\nAuthorized Signatory`,
    footerText: "This is a system-generated document. Please sign and issue through the authorized HR process.",
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "TPL-TERMINATION",
    type: "Termination Letter",
    name: "Standard Termination Letter",
    subject: "Termination of Employment",
    letterheadImage: "",
    bodyTemplate: `Date: {{DATE}}\n\nTo,\n{{EMPLOYEE_NAME}}\n{{ADDRESS}}\n\nSubject: Termination of Employment\n\nDear {{EMPLOYEE_NAME}},\n\nThis is to formally inform you that your employment with {{COMPANY_NAME}} as {{DESIGNATION}} in the {{DEPARTMENT}} department stands terminated with effect from {{TERMINATION_DATE}} due to {{TERMINATION_REASON}}.\n\nYou are required to complete the applicable handover and exit formalities with HR and your reporting manager.\n\nWe wish you well in your future endeavors.\n\nFor {{COMPANY_NAME}}\n\nAuthorized Signatory`,
    footerText: "This is a system-generated document. Please issue only after the required approval is completed.",
    active: true,
    updatedAt: new Date().toISOString(),
  },
];

const EMPTY_REQ = {
  title: "", department: "", location: "", category: "On Roll", vacancies: 1, employmentType: "Full Time", employeeGroup: "", qualification: "", experience: "", skills: "", minCtc: "", maxCtc: "", priority: "Medium", targetDate: "", hiringManager: "", approverId: "", approverEmployeeId: "", approverName: "", recruiter: "", reason: "New Position", status: "Draft", remarks: "", jdFileName: "", jdFileData: "",
};
const EMPTY_CANDIDATE = {
  name: "", mobile: "", email: "", location: "", department: "", currentCompany: "", currentDesignation: "", totalExperience: "", relevantExperience: "", qualification: "", qualificationYear: "", skills: "", currentCtc: "", expectedCtc: "", noticePeriod: "", lastWorkingDate: "", preferredLocation: "", willingToRelocate: "Yes", source: "Naukri", referredBy: "", consultant: "", category: "On Roll", recruiter: "", requirementId: "", stage: "New", stageUpdatedDate: "", rejectionReason: "", holdReason: "", followUpDate: "", nextAction: "", nextActionDate: "", owner: "", resumeName: "", updatedCvName: "", updatedCvData: "", cvStatus: "Missing", notes: "",
};
const EMPTY_INTERVIEW = { candidateId: "", round: "HR Screening", date: "", time: "", mode: "Online", location: "", meetingLink: "", panel: "", coordinator: "", status: "Scheduled", remarks: "" };
const EMPTY_FEEDBACK = { technical: 0, communication: 0, experience: 0, problemSolving: 0, behaviour: 0, leadership: 0, cultureFit: 0, recommendation: "", comments: "" };
const EMPTY_OFFER = { candidateId: "", designation: "", department: "", location: "", joiningDate: "", ctc: "", basic: "", hra: "", other: "", probation: "6 Months", noticePeriod: "As per policy", reportingManager: "", status: "Draft", approvalStatus: "Pending", issueDate: "", offerNumber: "" };
const EMPTY_MAPPING = {
  candidateId: "",
  mappingType: "Company",
  company: "",
  qualification: "",
  qualificationYear: "",
  designation: "",
  designationAsPerCV: "",
  designationAsPerDocuments: "",
  fromDate: "",
  toDate: "",
  documentFromDate: "",
  documentToDate: "",
  duration: "",
  documentDuration: "",
  periodAsPerCV: "",
  periodAsPerDocuments: "",
  documentAvailable: "No document provided",
  documentType: "",
  documentDetails: "",
  comparisonStatus: "⚠️ Certificate Pending",
  project: "",
  role: "",
  relevantExperience: "",
  certificateStatus: "Pending Certificate",
  mappingStatus: "Not Started",
  verifiedBy: "",
  verificationDate: "",
  remarks: "",
};
const EMPTY_BGV = { candidateId: "", agency: "", initiatedDate: "", submittedDate: "", status: "Not Initiated", referenceNo: "", remarks: "" };
const EMPTY_JOINING = { candidateId: "", expectedDate: "", status: "Expected", actualDate: "", reportingManager: "", location: "", remarks: "" };
const EMPTY_LETTER = { templateId: "", type: "Offer Letter", candidateId: "", employeeId: "", issueDate: "", terminationDate: "", terminationReason: "", subject: "", body: "", status: "Draft" };

function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function money(value) { const n = Number(value || 0); return n ? `₹${n.toLocaleString("en-IN")}` : "—"; }
function calculateInclusiveMonths(startDate, endDate) {
  if (!startDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = endDate ? new Date(`${endDate}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}
function monthsToYearsMonths(months) {
  const total = Math.max(0, Number(months || 0));
  const years = Math.floor(total / 12);
  const remainder = total % 12;
  if (!years && !remainder) return "0 Months";
  if (!years) return `${remainder} Month${remainder === 1 ? "" : "s"}`;
  if (!remainder) return `${years} Year${years === 1 ? "" : "s"}`;
  return `${years} Year${years === 1 ? "" : "s"} ${remainder} Month${remainder === 1 ? "" : "s"}`;
}
function mappingPeriodLabel(startDate, endDate) {
  if (!startDate) return "—";
  return `${formatDate(startDate)} – ${endDate ? formatDate(endDate) : "Present"}`;
}
function normalizeMappingText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function getExperienceComparisonStatus(row) {
  if (row.mappingType === "Qualification") {
    return row.documentAvailable === "No document provided" ? "⚠️ Document Not Provided" : "✓ Qualification Recorded";
  }
  if (!row.documentAvailable || row.documentAvailable === "No document provided") return "⚠️ Certificate Pending";
  const cvDesignation = normalizeMappingText(row.designationAsPerCV || row.designation);
  const documentDesignation = normalizeMappingText(row.designationAsPerDocuments);
  const designationDiff = cvDesignation && documentDesignation && cvDesignation !== documentDesignation;
  const cvStart = row.fromDate || "";
  const cvEnd = row.toDate || "";
  const docStart = row.documentFromDate || "";
  const docEnd = row.documentToDate || "";
  const dateDiff = docStart && cvStart && docStart !== cvStart || docEnd && cvEnd && docEnd !== cvEnd;
  if (designationDiff && dateDiff) return "⚠️ Date & Designation Difference";
  if (designationDiff) return "⚠️ Designation Difference";
  if (dateDiff) return "⚠️ Date Difference";
  if (!row.documentDetails && !row.documentFromDate) return "⚠️ Document Details Pending";
  return "✓ Matched";
}
function formatDate(value) { if (!value) return "—"; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function initials(name) { return String(name || "?").split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase(); }
function normalizeOptions(items = []) { const seen = new Set(); return (Array.isArray(items) ? items : []).filter((item) => typeof item === "string" || item?.active !== false).map((item, index) => { if (item && typeof item === "object") return { id: String(item.id ?? item.name ?? item.label ?? index), name: String(item.name ?? item.label ?? item.value ?? "").trim(), employeeId: item.employeeId }; return { id: String(item ?? index), name: String(item ?? "").trim() }; }).filter((x) => x.name).filter((x) => { const k = x.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); }
function StatusBadge({ children, tone = "" }) { return <span className={`rec-status ${tone || String(children).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{children}</span>; }

function Modal({ title, children, onClose, wide = false }) {
  return createPortal(<div className="rec-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className={`rec-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="rec-modal-head"><div><div className="rec-eyebrow">RECRUITMENT</div><h2>{title}</h2></div><button type="button" className="rec-close" onClick={onClose}>×</button></div>{children}</div></div>, document.body);
}

function SearchableEmployeeSelect({ options, value, onChange, placeholder = "Select employee" }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState(""); const ref = useRef(null);
  useEffect(() => { const fn = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setSearch(""); } }; document.addEventListener("mousedown", fn); return () => document.removeEventListener("mousedown", fn); }, []);
  const selected = options.find((x) => String(x.id) === String(value)); const filtered = options.filter((x) => `${x.name} ${x.employeeId || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="rec-search-select" ref={ref}><button type="button" className="rec-search-select-trigger" onClick={() => setOpen((v) => !v)}><span className={selected ? "" : "placeholder"}>{selected ? `${selected.name}${selected.employeeId ? ` · ${selected.employeeId}` : ""}` : placeholder}</span><span>⌄</span></button>{open && <div className="rec-search-select-menu"><div className="rec-search-select-search"><input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." /></div><button type="button" className="rec-search-select-option muted" onClick={() => { onChange(""); setOpen(false); }}>Clear selection</button>{filtered.map((x) => <button type="button" key={x.id} className="rec-search-select-option" onClick={() => { onChange(x.id); setOpen(false); setSearch(""); }}>{x.name}{x.employeeId ? ` · ${x.employeeId}` : ""}</button>)}{!filtered.length && <div className="rec-search-select-empty">No employee found.</div>}</div>}</div>;
}

async function getOrganizationRecord() {
  let result = await supabase.from("organizations").select("id, code, name, settings").eq("code", ORGANIZATION_CODE).maybeSingle();
  if (!result.data && !result.error) result = await supabase.from("organizations").select("id, code, name, settings").limit(1).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("No organization record found.");
  return result.data;
}

async function loadRecruitmentStore() {
  // Recruitment workflow data is stored under its own settings key.
  // Organisation masters must always be loaded through organizationStorage,
  // the same shared source used by the Organisation module.
  const organization = await getOrganizationRecord();
  const saved = (organization.settings || {})[RECRUITMENT_SETTINGS_KEY] || {};
  return {
    organization,
    requirements: Array.isArray(saved.requirements) ? saved.requirements : [],
    candidates: Array.isArray(saved.candidates) ? saved.candidates : [],
    interviews: Array.isArray(saved.interviews) ? saved.interviews : [],
    offers: Array.isArray(saved.offers) ? saved.offers : [],
    mappings: Array.isArray(saved.mappings) ? saved.mappings : [],
    documents: Array.isArray(saved.documents) ? saved.documents : [],
    bgv: Array.isArray(saved.bgv) ? saved.bgv : [],
    joinings: Array.isArray(saved.joinings) ? saved.joinings : [],
    activities: Array.isArray(saved.activities) ? saved.activities : [],
    letters: Array.isArray(saved.letters) ? saved.letters : [],
    letterTemplates: Array.isArray(saved.letterTemplates) && saved.letterTemplates.length ? saved.letterTemplates : DEFAULT_LETTER_TEMPLATES,
  };
}

async function persistRecruitmentStore(store) {
  const organization = await getOrganizationRecord();
  const currentSettings = organization.settings || {};
  const nextRecruitment = {
    requirements: store.requirements || [], candidates: store.candidates || [], interviews: store.interviews || [], offers: store.offers || [], mappings: store.mappings || [], documents: store.documents || [], bgv: store.bgv || [], joinings: store.joinings || [], activities: store.activities || [], letters: store.letters || [], letterTemplates: store.letterTemplates || DEFAULT_LETTER_TEMPLATES,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("organizations").update({ settings: { ...currentSettings, [RECRUITMENT_SETTINGS_KEY]: nextRecruitment }, updated_at: new Date().toISOString() }).eq("id", organization.id);
  if (error) throw error;
}

export default function Recruitment({ employees = [], masters = {} }) {
  const [store, setStore] = useState({ requirements: [], candidates: [], interviews: [], offers: [], mappings: [], documents: [], bgv: [], joinings: [], activities: [], letters: [], letterTemplates: DEFAULT_LETTER_TEMPLATES });
  const [masterData, setMasterData] = useState(masters || {});
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("Dashboard"); const [search, setSearch] = useState(""); const [dashboardSearch, setDashboardSearch] = useState(""); const [stageFilter, setStageFilter] = useState("All"); const [reqFilter, setReqFilter] = useState("All"); const [categoryFilter, setCategoryFilter] = useState("All"); const [requirementFilter, setRequirementFilter] = useState("All");
  const [reqModal, setReqModal] = useState(false); const [candidateModal, setCandidateModal] = useState(false); const [editingCandidateId, setEditingCandidateId] = useState(""); const [assignmentModal, setAssignmentModal] = useState(false); const [assignmentRequirementId, setAssignmentRequirementId] = useState(""); const [assignmentCandidateId, setAssignmentCandidateId] = useState(""); const [interviewModal, setInterviewModal] = useState(false); const [feedbackModal, setFeedbackModal] = useState(false); const [offerModal, setOfferModal] = useState(false); const [mappingModal, setMappingModal] = useState(false); const [bgvModal, setBgvModal] = useState(false); const [joiningModal, setJoiningModal] = useState(false); const [candidateDetail, setCandidateDetail] = useState(null); const [letterModal, setLetterModal] = useState(false); const [templateModal, setTemplateModal] = useState(false);
  const [reqForm, setReqForm] = useState(EMPTY_REQ); const [candidateForm, setCandidateForm] = useState(EMPTY_CANDIDATE); const [interviewForm, setInterviewForm] = useState(EMPTY_INTERVIEW); const [feedbackForm, setFeedbackForm] = useState(EMPTY_FEEDBACK); const [offerForm, setOfferForm] = useState(EMPTY_OFFER); const [mappingForm, setMappingForm] = useState(EMPTY_MAPPING); const [bgvForm, setBgvForm] = useState(EMPTY_BGV); const [joiningForm, setJoiningForm] = useState(EMPTY_JOINING); const [letterForm, setLetterForm] = useState(EMPTY_LETTER); const [templateForm, setTemplateForm] = useState(DEFAULT_LETTER_TEMPLATES[0]); const [feedbackInterviewId, setFeedbackInterviewId] = useState(""); const [activeCandidateTab, setActiveCandidateTab] = useState("Overview");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setLoadError("");
        const [data, latestMasters] = await Promise.all([
          loadRecruitmentStore(),
          loadOrganizationMasters(masters || {}),
        ]);
        if (!mounted) return;
        setStore(data);
        // Replace the snapshot instead of merging it. This ensures deactivated
        // or deleted Organisation masters disappear from every Recruitment dropdown.
        setMasterData(latestMasters || masters || {});
      } catch (error) {
        if (mounted) setLoadError(error?.message || "Unable to load Recruitment data.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const refreshOrganizationMasters = async () => {
      try {
        const latest = await loadOrganizationMasters(masters || {});
        if (mounted) {
          // A full replacement is intentional: no stale values remain after
          // an Organisation master is renamed, deactivated or deleted.
          setMasterData(latest || {});
        }
      } catch (error) {
        console.error("Unable to refresh Recruitment Organisation Masters:", error);
      }
    };

    const handleOrganizationDataUpdated = (event) => {
      const moduleKey = event?.detail?.moduleKey;
      if (!moduleKey || /organization.?masters/i.test(String(moduleKey))) {
        const eventMasters = event?.detail?.masters;
        if (eventMasters && mounted) setMasterData(eventMasters);
        refreshOrganizationMasters();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshOrganizationMasters();
    };

    // organizationStorage emits this shared event. The second event is kept
    // for compatibility with existing Bauer HRMS modules.
    window.addEventListener("organizationModuleDataUpdated", handleOrganizationDataUpdated);
    window.addEventListener("bauerHrmsOrganizationMastersUpdated", handleOrganizationDataUpdated);
    window.addEventListener("focus", refreshOrganizationMasters);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      window.removeEventListener("organizationModuleDataUpdated", handleOrganizationDataUpdated);
      window.removeEventListener("bauerHrmsOrganizationMastersUpdated", handleOrganizationDataUpdated);
      window.removeEventListener("focus", refreshOrganizationMasters);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const departments = useMemo(() => normalizeOptions(masterData.departments), [masterData.departments]);
  const locations = useMemo(() => normalizeOptions(masterData.locations), [masterData.locations]);
  const designations = useMemo(() => normalizeOptions(masterData.designations), [masterData.designations]);

  // Organisation.jsx stores workforce category records under workforceCategories
  // (not employeeGroups). Keep the old aliases as a migration fallback only.
  const workforceCategories = useMemo(
    () => normalizeOptions(masterData.workforceCategories ?? masterData.employeeGroups ?? []),
    [masterData.workforceCategories, masterData.employeeGroups]
  );
  // Category Type is a separate Organisation master from Workforce Category.
  // Requirement/Candidate Category dropdowns must use Category Type values
  // (On Roll, Third Party, Expatriate, Consultant, Other / Custom), while the
  // separate Employee Group field continues to use workforceCategories.
  const categoryTypes = useMemo(
    () => normalizeOptions(masterData.categoryTypes || []),
    [masterData.categoryTypes]
  );
  const employeeGroups = workforceCategories;
  const recruitmentCategories = categoryTypes;
  const recruitmentJobTypes = useMemo(() => normalizeOptions(masterData.jobTypes), [masterData.jobTypes]);
  const consultantOptions = useMemo(() => normalizeOptions(masterData.jobRoles), [masterData.jobRoles]);
  const payrollProfiles = useMemo(() => normalizeOptions(masterData.payrollProfiles), [masterData.payrollProfiles]);
  const employeeOptions = useMemo(() => (Array.isArray(employees) ? employees : []).filter((e) => e && e.status !== "Inactive").map((e, i) => ({ id: String(e.id ?? e.employeeId ?? i), employeeId: String(e.employeeId ?? e.id ?? ""), name: String(e.name ?? e.employeeName ?? "").trim(), department: String(e.department || ""), designation: String(e.designation || "") })).filter((e) => e.name), [employees]);
  const recruiterOptions = useMemo(() => employeeOptions.map((e) => e.name).filter((n, i, a) => a.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i), [employeeOptions]);

  const openNewRequirement = () => {
    setReqForm({
      ...EMPTY_REQ,
      category: recruitmentCategories[0]?.name || "",
      employmentType: recruitmentJobTypes[0]?.name || "",
      employeeGroup: workforceCategories[0]?.name || "",
    });
    setReqModal(true);
  };
  const candidateDepartmentOptions = useMemo(
    () => normalizeOptions([...departments, candidateForm.department || ""]),
    [departments, candidateForm.department]
  );
  const candidateDesignationOptions = useMemo(
    () => normalizeOptions([...designations, candidateForm.currentDesignation || ""]),
    [designations, candidateForm.currentDesignation]
  );
  const candidateLocationOptions = useMemo(
    () => normalizeOptions([...locations, candidateForm.location || "", candidateForm.preferredLocation || ""]),
    [locations, candidateForm.location, candidateForm.preferredLocation]
  );
  const candidateRequirementOptions = useMemo(
    () => store.requirements.filter((r) => !["Closed", "Rejected", "Cancelled"].includes(r.status) || r.id === candidateForm.requirementId),
    [store.requirements, candidateForm.requirementId]
  );

  const openNewCandidate = () => {
    setEditingCandidateId("");
    setCandidateForm({
      ...EMPTY_CANDIDATE,
      category: recruitmentCategories[0]?.name || "",
    });
    setCandidateModal(true);
  };

  const replaceAndSave = async (patch, activity) => {
    const next = { ...store, ...patch }; setStore(next); setSaving(true);
    try { await persistRecruitmentStore(next); if (activity) window.dispatchEvent(new CustomEvent("hrsyncRecruitmentUpdated")); }
    catch (error) { setLoadError(error?.message || "Unable to save Recruitment data."); }
    finally { setSaving(false); }
  };

  const addActivity = (candidateId, action, details = "") => ({ id: makeId("ACT"), candidateId, action, details, at: new Date().toISOString(), by: "Recruitment" });
  const candidateById = (id) => store.candidates.find((c) => c.id === id);
  const requirementById = (id) => store.requirements.find((r) => r.id === id);
  const candidateRequirementIds = (candidate) => candidate?.requirementId ? [candidate.requirementId] : [];
  const candidateRequirements = (candidate) => candidateRequirementIds(candidate).map((id) => requirementById(id)).filter(Boolean);
  const candidateRequirementLabels = (candidate) => candidateRequirements(candidate).map((r) => `${r.title} (${r.requirementNo || r.id})`).join(", ");
  const candidateHasRequirement = (candidate, requirementId) => candidate?.requirementId === requirementId;
  const offerByCandidate = (id) => store.offers.find((o) => o.candidateId === id && o.status !== "Withdrawn");
  const mappingByCandidate = (id) => store.mappings.filter((m) => m.candidateId === id);
  const documentsByCandidate = (id) => store.documents.filter((d) => d.candidateId === id);
  const bgvByCandidate = (id) => store.bgv.find((b) => b.candidateId === id);
  const joiningByCandidate = (id) => store.joinings.find((j) => j.candidateId === id);

  const setCandidatePatch = async (id, patch, activityText = "Candidate updated") => {
    const current = candidateById(id); if (!current) return;
    const nextCandidate = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await replaceAndSave({ candidates: store.candidates.map((c) => c.id === id ? nextCandidate : c), activities: [...store.activities, addActivity(id, activityText)] }, true);
  };

  const updateCandidateStage = async (id, stage) => {
    await setCandidatePatch(id, { stage, stageUpdatedDate: todayISO() }, `Stage changed to ${stage}`);
  };

  const openCandidateAssignment = (requirement) => {
    setAssignmentRequirementId(requirement.id);
    setAssignmentCandidateId("");
    setAssignmentModal(true);
  };

  const assignExistingCandidate = async () => {
    const candidate = candidateById(assignmentCandidateId);
    const targetRequirement = requirementById(assignmentRequirementId);
    if (!candidate || !targetRequirement) return alert("Please select a valid candidate and requirement.");
    if (["Closed", "Rejected", "Cancelled"].includes(targetRequirement.status)) return alert("This requirement is closed or cancelled. Reopen it before assigning a candidate.");
    if (candidate.requirementId === targetRequirement.id) return alert(`${candidate.name} is already assigned to ${targetRequirement.title}.`);
    if (candidate.stage === "Joined") return alert(`${candidate.name} has already joined and cannot be reassigned from this screen.`);

    const previousRequirement = requirementById(candidate.requirementId);
    const updatedCandidate = { ...candidate, requirementId: targetRequirement.id, updatedAt: new Date().toISOString() };
    const action = previousRequirement ? "Candidate reassigned to requirement" : "Candidate assigned to requirement";
    const details = previousRequirement
      ? `Reassigned from ${previousRequirement.title} (${previousRequirement.requirementNo || previousRequirement.id}) to ${targetRequirement.title} (${targetRequirement.requirementNo || targetRequirement.id}). The same Candidate Tracker record was retained; no duplicate was created.`
      : `Assigned to ${targetRequirement.title} (${targetRequirement.requirementNo || targetRequirement.id})`;

    await replaceAndSave({
      candidates: store.candidates.map((item) => item.id === candidate.id ? updatedCandidate : item),
      activities: [addActivity(candidate.id, action, details), ...store.activities],
    }, true);
    setAssignmentModal(false);
    setAssignmentCandidateId("");
    setAssignmentRequirementId("");
  };

  const downloadRequirementJD = (requirement) => {
    if (!requirement?.jdFileData) return alert("No Job Description file is attached to this requirement.");
    const link = document.createElement("a");
    link.href = requirement.jdFileData;
    link.download = requirement.jdFileName || `${requirement.title || "Job_Description"}`;
    link.click();
  };

  const saveRequirement = async (e) => {
    e.preventDefault();
    if (!reqForm.title.trim() || !reqForm.department || !Number(reqForm.vacancies)) return alert("Position, Department and Vacancies are required.");
    if (!reqForm.approverId || !reqForm.approverEmployeeId) return alert("Please select the Approving HOD.");
    const item = { ...reqForm, id: makeId("REQ"), requirementNo: `REQ-${String(store.requirements.length + 1).padStart(4, "0")}`, vacancies: Number(reqForm.vacancies), approvalStatus: "Pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await replaceAndSave({ requirements: [item, ...store.requirements] }, true); setReqForm(EMPTY_REQ); setReqModal(false);
  };

  const updateRequirementStatus = async (id, status) => {
    const item = requirementById(id); if (!item) return;
    const approvalStatus = status === "Pending Approval" ? "Pending" : status === "Approved" ? "Approved" : status === "Rejected" ? "Rejected" : item.approvalStatus || "Pending";
    await replaceAndSave({ requirements: store.requirements.map((r) => r.id === id ? { ...r, status, approvalStatus, updatedAt: new Date().toISOString() } : r) }, true);
  };

  const deleteRequirement = async (id) => { const item = requirementById(id); if (!item || !window.confirm(`Delete requirement "${item.title}"?`)) return; await replaceAndSave({ requirements: store.requirements.filter((r) => r.id !== id) }, true); };

  const saveCandidate = async (e) => {
    e.preventDefault();
    const isEditing = Boolean(editingCandidateId);
    const existing = isEditing ? candidateById(editingCandidateId) : null;
    if (isEditing && !existing) return alert("This candidate record could not be found. Please refresh the tracker and try again.");
    if (!candidateForm.name.trim() || !candidateForm.mobile.trim()) return alert("Candidate Name and Mobile are required.");

    const normalizedMobile = String(candidateForm.mobile || "").replace(/\D/g, "");
    const normalizedEmail = String(candidateForm.email || "").trim().toLowerCase();
    const duplicateCandidate = store.candidates.find((candidate) => candidate.id !== editingCandidateId && (
      (normalizedMobile && String(candidate.mobile || "").replace(/\D/g, "") === normalizedMobile) ||
      (normalizedEmail && String(candidate.email || "").trim().toLowerCase() === normalizedEmail)
    ));
    if (duplicateCandidate) return alert(`This candidate already exists in Candidate Tracker as ${duplicateCandidate.name} (${duplicateCandidate.candidateNo || duplicateCandidate.id}). Edit the existing record instead of creating a duplicate.`);
    if (isEditing && existing.requirementId !== candidateForm.requirementId) {
      if (existing.stage === "Joined") return alert("A Joined candidate cannot be reassigned to another requirement from Candidate Tracker.");
      const oldRequirement = requirementById(existing.requirementId);
      const newRequirement = requirementById(candidateForm.requirementId);
      const fromLabel = oldRequirement?.title || "General Candidate Pool";
      const toLabel = newRequirement?.title || "General Candidate Pool";
      if (!window.confirm(`Change ${existing.name}'s requirement association from \"${fromLabel}\" to \"${toLabel}\"? The same candidate record will be retained.`)) return;
    }

    const hasExistingCv = isEditing && hasMandatoryCv(existing.id);
    if (!candidateForm.updatedCvData && !hasExistingCv) return alert("Updated CV is mandatory. Please attach the candidate's latest / updated CV before saving.");
    if (candidateForm.stage !== "New" && (!candidateForm.nextAction.trim() || !candidateForm.nextActionDate || !candidateForm.owner.trim()) && (!isEditing || candidateForm.stage !== existing.stage)) {
      return alert("For an active candidate, Next Action, Next Action Date and Owner are mandatory.");
    }

    const { updatedCvData, ...candidatePayload } = candidateForm;
    const now = new Date().toISOString();

    if (isEditing) {
      const updatedCandidate = {
        ...existing,
        ...candidatePayload,
        id: existing.id,
        candidateNo: existing.candidateNo,
        createdAt: existing.createdAt,
        cvStatus: updatedCvData ? "Received" : (existing.cvStatus || candidateForm.cvStatus || "Received"),
        updatedCvName: updatedCvData ? candidateForm.updatedCvName : (existing.updatedCvName || candidateForm.updatedCvName || ""),
        updatedAt: now,
      };

      let documents = [...store.documents];
      if (updatedCvData) {
        const cvIndex = documents.findIndex((doc) => doc.candidateId === existing.id && doc.type === "Updated CV" && doc.mandatory);
        const previousCv = cvIndex >= 0 ? documents[cvIndex] : null;
        const cvDocument = {
          ...(previousCv || {}),
          id: previousCv?.id || makeId("DOC"),
          candidateId: existing.id,
          type: "Updated CV",
          status: "Received",
          fileName: candidateForm.updatedCvName,
          fileData: updatedCvData,
          mandatory: true,
          uploadedAt: now,
          updatedAt: now,
        };
        if (cvIndex >= 0) documents[cvIndex] = cvDocument;
        else documents = [cvDocument, ...documents];
      }

      const oldRequirement = requirementById(existing.requirementId);
      const newRequirement = requirementById(updatedCandidate.requirementId);
      const requirementChange = existing.requirementId !== updatedCandidate.requirementId
        ? ` Requirement association: ${oldRequirement?.title || "Unassigned"} → ${newRequirement?.title || "Unassigned"}.`
        : "";
      const activity = addActivity(existing.id, "Candidate profile updated", `Candidate details updated from Candidate Tracker.${requirementChange}${updatedCvData ? ` Updated CV replaced: ${candidateForm.updatedCvName}.` : ""}`);

      await replaceAndSave({
        candidates: store.candidates.map((candidate) => candidate.id === existing.id ? updatedCandidate : candidate),
        documents,
        activities: [activity, ...store.activities],
      }, true);
    } else {
      if (!updatedCvData) return alert("Updated CV is mandatory. Please attach the candidate's latest / updated CV before saving.");
      const item = {
        ...candidatePayload,
        id: makeId("CAN"),
        candidateNo: `CAND-${String(store.candidates.length + 1).padStart(4, "0")}`,
        cvStatus: "Received",
        stageUpdatedDate: todayISO(),
        createdAt: now,
        updatedAt: now,
      };
      const cvDocument = {
        id: makeId("DOC"),
        candidateId: item.id,
        type: "Updated CV",
        status: "Received",
        fileName: item.updatedCvName,
        fileData: updatedCvData,
        mandatory: true,
        uploadedAt: now,
        updatedAt: now,
      };
      const activity = addActivity(item.id, "Candidate created", `Updated CV attached · ${item.updatedCvName || "CV received"}${item.requirementId ? ` · Requirement: ${requirementById(item.requirementId)?.title || item.requirementId}` : " · General candidate pool"}`);
      await replaceAndSave({
        candidates: [item, ...store.candidates],
        documents: [cvDocument, ...store.documents],
        activities: [activity, ...store.activities],
      }, true);
    }

    setCandidateForm(EMPTY_CANDIDATE);
    setEditingCandidateId("");
    setCandidateModal(false);
  };


  const saveInterview = async (e) => {
    e.preventDefault();
    if (!interviewForm.candidateId || !interviewForm.date || !interviewForm.time) return alert("Candidate, date and time are required.");
    const interviewCandidate = candidateById(interviewForm.candidateId);
    if (!hasMandatoryCv(interviewCandidate?.id)) return alert("Updated CV is mandatory before scheduling an interview.");
    const item = { ...interviewForm, id: makeId("INT"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const candidates = store.candidates.map((c) => c.id === item.candidateId ? { ...c, stage: "Interview Scheduled", stageUpdatedDate: todayISO() } : c);
    await replaceAndSave({ interviews: [item, ...store.interviews], candidates, activities: [addActivity(item.candidateId, "Interview scheduled", `${item.round} · ${formatDate(item.date)} ${item.time}`), ...store.activities] }, true); setInterviewForm(EMPTY_INTERVIEW); setInterviewModal(false);
  };

  const openFeedback = (interview) => { setFeedbackInterviewId(interview.id); setFeedbackForm(interview.feedback || EMPTY_FEEDBACK); setFeedbackModal(true); };
  const saveFeedback = async (e) => {
    e.preventDefault(); const interview = store.interviews.find((i) => i.id === feedbackInterviewId); if (!interview) return;
    if (!hasMandatoryCv(interview.candidateId)) return alert("Updated CV is mandatory before interview feedback can be finalized.");
    const recommendation = feedbackForm.recommendation; const nextStage = recommendation === "Strong Hire" || recommendation === "Hire" ? "Selected" : recommendation === "Hold" ? "Hold" : recommendation === "Reject" ? "Rejected" : "Interviewed";
    const interviews = store.interviews.map((i) => i.id === feedbackInterviewId ? { ...i, feedback: feedbackForm, status: "Completed", feedbackSubmittedAt: new Date().toISOString() } : i);
    const candidates = store.candidates.map((c) => c.id === interview.candidateId ? { ...c, stage: nextStage, stageUpdatedDate: todayISO(), nextAction: nextStage === "Selected" ? "Complete experience mapping and documents" : "Review interview decision", nextActionDate: todayISO() } : c);
    await replaceAndSave({ interviews, candidates, activities: [addActivity(interview.candidateId, "Interview feedback recorded", recommendation || "No recommendation"), ...store.activities] }, true); setFeedbackModal(false);
  };

  const saveMapping = async (e) => {
    e.preventDefault();
    const rows = Array.isArray(mappingForm.rows) ? mappingForm.rows : [];
    if (!mappingForm.candidateId || !rows.length) return alert("Candidate and at least one experience / qualification row are required.");
    const validRows = rows.filter((row) => String(row.company || row.qualification || "").trim());
    if (!validRows.length) return alert("Please add at least one Company / Qualification row.");
    const timestamp = new Date().toISOString();
    const newMappings = validRows.map((row, index) => ({
      ...EMPTY_MAPPING,
      ...row,
      id: row.id || makeId("MAP"),
      candidateId: mappingForm.candidateId,
      mappingFormatVersion: 2,
      sequence: index + 1,
      periodAsPerCV: row.periodAsPerCV || mappingPeriodLabel(row.fromDate, row.toDate),
      periodAsPerDocuments: row.periodAsPerDocuments || mappingPeriodLabel(row.documentFromDate, row.documentToDate),
      duration: row.duration || monthsToYearsMonths(calculateInclusiveMonths(row.fromDate, row.toDate)),
      documentDuration: row.documentDuration || monthsToYearsMonths(calculateInclusiveMonths(row.documentFromDate, row.documentToDate)),
      comparisonStatus: getExperienceComparisonStatus(row),
      updatedAt: timestamp,
      createdAt: row.createdAt || timestamp,
    }));
    const existingForCandidate = store.mappings.filter((m) => m.candidateId !== mappingForm.candidateId);
    const totalCvMonths = newMappings.reduce((sum, row) => sum + calculateInclusiveMonths(row.fromDate, row.toDate), 0);
    const totalDocumentMonths = newMappings.reduce((sum, row) => sum + calculateInclusiveMonths(row.documentFromDate, row.documentToDate), 0);
    const mappingSummary = {
      asOnDate: mappingForm.asOnDate || todayISO(),
      totalCvMonths,
      totalDocumentMonths,
      totalCvExperience: monthsToYearsMonths(totalCvMonths),
      totalDocumentExperience: monthsToYearsMonths(totalDocumentMonths),
      pendingVerificationRows: newMappings.filter((row) => row.mappingStatus !== "Verified" || row.documentAvailable === "No document provided").length,
      updatedAt: timestamp,
    };
    const overallStatus = newMappings.every((row) => row.mappingStatus === "Verified") ? "Verified" : newMappings.some((row) => row.mappingStatus === "Mismatch") ? "Mismatch" : "In Progress";
    const candidates = store.candidates.map((c) => c.id === mappingForm.candidateId ? {
      ...c,
      mappingStatus: overallStatus,
      experienceMappingSummary: mappingSummary,
      nextAction: overallStatus === "Verified" ? "Complete documents / BGV" : "Complete experience mapping / document verification",
      nextActionDate: todayISO(),
    } : c);
    await replaceAndSave({
      mappings: [...newMappings, ...existingForCandidate],
      candidates,
      activities: [addActivity(mappingForm.candidateId, "Experience mapping updated", `${mappingSummary.totalCvExperience} CV · ${mappingSummary.totalDocumentExperience} document-supported · ${overallStatus}`), ...store.activities],
    }, true);
    setMappingForm(EMPTY_MAPPING);
    setMappingModal(false);
  };

  const saveBGV = async (e) => {
    e.preventDefault(); if (!bgvForm.candidateId) return alert("Select candidate.");
    const existing = bgvByCandidate(bgvForm.candidateId); const item = { ...bgvForm, id: existing?.id || makeId("BGV"), updatedAt: new Date().toISOString(), createdAt: existing?.createdAt || new Date().toISOString() };
    const bgv = existing ? store.bgv.map((b) => b.id === existing.id ? item : b) : [item, ...store.bgv];
    const candidates = store.candidates.map((c) => c.id === item.candidateId ? { ...c, bgvStatus: item.status, nextAction: item.status === "Clear" ? "Complete offer / joining" : "Follow up BGV", nextActionDate: todayISO() } : c);
    await replaceAndSave({ bgv, candidates, activities: [addActivity(item.candidateId, "BGV updated", item.status), ...store.activities] }, true); setBgvForm(EMPTY_BGV); setBgvModal(false);
  };

  const saveJoining = async (e) => {
    e.preventDefault(); if (!joiningForm.candidateId || !joiningForm.expectedDate) return alert("Candidate and expected joining date are required.");
    const existing = joiningByCandidate(joiningForm.candidateId); const item = { ...joiningForm, id: existing?.id || makeId("JOIN"), updatedAt: new Date().toISOString(), createdAt: existing?.createdAt || new Date().toISOString() };
    const joinings = existing ? store.joinings.map((j) => j.id === existing.id ? item : j) : [item, ...store.joinings];
    const nextStage = item.status === "Joined" ? "Joined" : item.status === "Confirmed" || item.status === "Expected" || item.status === "Rescheduled" ? "Joining Scheduled" : item.status === "No Show" ? "No Show" : "Joining Scheduled";
    const candidates = store.candidates.map((c) => c.id === item.candidateId ? { ...c, stage: nextStage, stageUpdatedDate: todayISO(), nextAction: item.status === "Joined" ? "Convert to Employee" : "Confirm joining", nextActionDate: item.expectedDate } : c);
    await replaceAndSave({ joinings, candidates, activities: [addActivity(item.candidateId, "Joining updated", `${item.status} · ${formatDate(item.expectedDate)}`), ...store.activities] }, true); setJoiningForm(EMPTY_JOINING); setJoiningModal(false);
  };

  const saveOffer = async (e) => {
    e.preventDefault();
    if (!offerForm.candidateId || !offerForm.designation || !offerForm.ctc) return alert("Candidate, Designation and CTC are required.");
    if (!hasMandatoryCv(offerForm.candidateId)) return alert("Updated CV is mandatory before an offer can be processed.");
    const existing = offerByCandidate(offerForm.candidateId); const item = { ...offerForm, id: existing?.id || makeId("OFF"), offerNumber: offerForm.offerNumber || existing?.offerNumber || `OFF-${String(store.offers.length + 1).padStart(4, "0")}`, issueDate: offerForm.issueDate || todayISO(), createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const offers = existing ? store.offers.map((o) => o.id === existing.id ? item : o) : [item, ...store.offers];
    const candidates = store.candidates.map((c) => c.id === item.candidateId ? { ...c, stage: item.status === "Accepted" ? "Offer Accepted" : "Offer Released", stageUpdatedDate: todayISO(), nextAction: item.status === "Accepted" ? "Confirm joining" : "Follow up offer", nextActionDate: item.joiningDate || todayISO() } : c);
    await replaceAndSave({ offers, candidates, activities: [addActivity(item.candidateId, "Offer updated", `${item.status} · ${money(item.ctc)}`), ...store.activities] }, true); setOfferForm(EMPTY_OFFER); setOfferModal(false);
  };

  const openOfferForCandidate = (candidate) => {
    const req = requirementById(candidate.requirementId); const existing = offerByCandidate(candidate.id);
    setOfferForm(existing || { ...EMPTY_OFFER, candidateId: candidate.id, designation: candidate.currentDesignation || req?.title || "", department: req?.department || "", location: req?.location || candidate.preferredLocation || "", joiningDate: joiningByCandidate(candidate.id)?.expectedDate || "", reportingManager: req?.hiringManager || "", status: "Draft" }); setOfferModal(true);
  };

  const updateDocument = async (candidateId, type, status, fileName = "", fileData = "") => {
    const existing = store.documents.find((d) => d.candidateId === candidateId && d.type === type);
    const item = { id: existing?.id || makeId("DOC"), candidateId, type, status, mandatory: MANDATORY_DOCUMENT_TYPES.includes(type), fileName: fileName || existing?.fileName || "", fileData: fileData || existing?.fileData || "", uploadedAt: status === "Received" || status === "Verified" ? new Date().toISOString() : existing?.uploadedAt || "", updatedAt: new Date().toISOString() };
    const documents = existing ? store.documents.map((d) => d.id === existing.id ? item : d) : [item, ...store.documents];
    const nextCandidateStatus = status === "Verified" ? "In Progress" : status === "Pending" ? "Pending" : "In Progress";
    const candidates = store.candidates.map((c) => c.id === candidateId ? { ...c, documentsStatus: nextCandidateStatus, nextAction: status === "Verified" ? "Complete remaining documents / BGV" : "Complete pending documents", nextActionDate: todayISO() } : c);
    await replaceAndSave({ documents, candidates, activities: [addActivity(candidateId, "Document updated", `${type} · ${status}${fileName ? ` · ${fileName}` : ""}`), ...store.activities] }, true);
  };

  const handleDocumentFile = (candidateId, type, file) => {
    if (!file) return;
    if (file.size > 1500000) return alert("For this settings-based storage version, please keep each recruitment document below 1.5 MB. A Supabase Storage bucket can be connected later for larger files.");
    const reader = new FileReader();
    reader.onload = async () => {
      await updateDocument(candidateId, type, "Received", file.name, String(reader.result || ""));
      if (type === "Updated CV") {
        await setCandidatePatch(candidateId, { updatedCvName: file.name, cvStatus: "Received" }, "Updated CV attached");
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadDocument = (documentItem) => {
    if (!documentItem?.fileData) return alert("No uploaded file is available for this document.");
    const a = document.createElement("a"); a.href = documentItem.fileData; a.download = documentItem.fileName || documentItem.type; a.click();
  };

  const completeEmployeeConversion = async (candidate) => {
    if (!candidate || candidate.stage !== "Joined") return alert("Candidate must be in Joined stage before Employee Master handoff.");
    const employee = { employeeId: candidate.candidateNo, name: candidate.name, mobile: candidate.mobile, personalEmail: candidate.email, doj: joiningByCandidate(candidate.id)?.actualDate || joiningByCandidate(candidate.id)?.expectedDate || todayISO(), location: joiningByCandidate(candidate.id)?.location || candidate.preferredLocation || candidate.location, designation: offerByCandidate(candidate.id)?.designation || candidate.currentDesignation, department: offerByCandidate(candidate.id)?.department || requirementById(candidate.requirementId)?.department, employeeGroup: candidate.category, source: "Recruitment", recruitmentCandidateId: candidate.id, status: "Active" };
    await setCandidatePatch(candidate.id, { employeeHandoffStatus: "Ready for Employee Master", employeeDraft: employee, nextAction: "Create Employee Master record", nextActionDate: todayISO() }, "Employee Master handoff prepared");
    alert(`${candidate.name} is ready for Employee Master conversion. The prefilled employee payload is available in the candidate profile.`);
  };

  const getDocumentSummary = (candidateId) => {
    const docs = documentsByCandidate(candidateId);
    const mandatoryPending = MANDATORY_DOCUMENT_TYPES.filter((type) => !docs.some((d) => d.type === type && ["Received", "Verified"].includes(d.status))).length;
    const verified = docs.filter((d) => d.status === "Verified").length;
    const optionalReceived = OPTIONAL_DOCUMENT_TYPES.filter((type) => docs.some((d) => d.type === type && ["Received", "Under Verification", "Verified"].includes(d.status))).length;
    return { verified, pending: mandatoryPending, mandatoryPending, optionalReceived, total: DOCUMENT_TYPES.length };
  };
  const hasMandatoryCv = (candidateId) => {
    const candidate = candidateById(candidateId);
    return Boolean(store.documents.some((d) => d.candidateId === candidateId && d.type === "Updated CV" && d.fileData));
  };

  const getActionRows = useMemo(() => store.candidates.filter((c) => c.stage !== "Rejected" && c.stage !== "Joined" || c.nextAction || c.bgvStatus).map((c) => {
    const doc = getDocumentSummary(c.id); const bgv = bgvByCandidate(c.id); const offer = offerByCandidate(c.id); const joining = joiningByCandidate(c.id); const req = requirementById(c.requirementId); const latestInterview = store.interviews.filter((i) => i.candidateId === c.id).sort((a,b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0];
    return { c, req, doc, bgv, offer, joining, latestInterview };
  }), [store.candidates, store.documents, store.bgv, store.offers, store.joinings, store.interviews, store.requirements]);

  const today = todayISO();
  // Shared by Dashboard and Offers & Joining; keep this outside individual render functions.
  const next7DayJoiningsCount = store.joinings.filter((j) =>
    j.expectedDate &&
    j.expectedDate >= today &&
    j.expectedDate <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) &&
    !["Joined", "Cancelled", "No Show"].includes(j.status)
  ).length;
  const activeRequirements = store.requirements.filter((r) => ["Approved", "Pending Approval", "Partially Filled", "On Hold"].includes(r.status));
  const openPositions = activeRequirements.reduce((sum, r) => sum + Math.max(0, Number(r.vacancies || 0) - store.candidates.filter((c) => candidateHasRequirement(c, r.id) && ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(c.stage)).length), 0);
  const overdueActions = store.candidates.filter((c) => c.nextActionDate && c.nextActionDate < today && !["Joined", "Rejected", "Withdrawn"].includes(c.stage)).length;
  const stats = {
    openPositions, totalCandidates: store.candidates.length, interviews: store.interviews.filter((i) => i.status === "Scheduled").length, interviewPending: store.interviews.filter((i) => ["Scheduled", "Feedback Pending"].includes(i.status)).length,
    selected: store.candidates.filter((c) => ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(c.stage)).length, mappingPending: store.candidates.filter((c) => !["Verified"].includes(c.mappingStatus) && ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled"].includes(c.stage)).length,
    docsPending: store.candidates.filter((c) => getDocumentSummary(c.id).pending > 0 && ["Shortlisted", "Interviewed", "Selected", "Offer Released", "Offer Accepted", "Joining Scheduled"].includes(c.stage)).length,
    bgvPending: store.bgv.filter((b) => !["Clear", "Closed"].includes(b.status)).length,
    offers: store.offers.filter((o) => ["Approval Pending", "Generated", "Sent", "Accepted"].includes(o.status)).length, joiningPending: store.joinings.filter((j) => ["Expected", "Confirmed", "Rescheduled", "Delayed"].includes(j.status)).length,
    joined: store.candidates.filter((c) => c.stage === "Joined").length, rejected: store.candidates.filter((c) => c.stage === "Rejected").length,
  };
  const funnel = [["Sourced", store.candidates.length], ["Screening", store.candidates.filter((c) => ["Screening", "Shortlisted"].includes(c.stage)).length], ["Interview", store.candidates.filter((c) => ["Interview Scheduled", "Interviewed"].includes(c.stage)).length], ["Selected", stats.selected], ["Offer", store.candidates.filter((c) => ["Offer Released", "Offer Accepted"].includes(c.stage)).length], ["Joined", stats.joined]];

  const filteredCandidates = useMemo(() => { const q = search.trim().toLowerCase(); return store.candidates.filter((c) => { const text = [c.id,c.candidateNo,c.name,c.mobile,c.email,c.currentCompany,c.currentDesignation,c.skills,c.source,c.recruiter,c.owner,c.location,c.preferredLocation,c.category,requirementById(c.requirementId)?.title].join(" ").toLowerCase(); return (!q || text.includes(q)) && (stageFilter === "All" || c.stage === stageFilter) && (categoryFilter === "All" || c.category === categoryFilter) && (requirementFilter === "All" || c.requirementId === requirementFilter); }); }, [store.candidates, store.requirements, search, stageFilter, categoryFilter, requirementFilter]);
  const filteredRequirements = store.requirements.filter((r) => reqFilter === "All" || r.status === reqFilter);

  const importRecruitmentExcel = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: "array", cellDates: true });
        const rowsFromSheet = (names) => {
          const sheetName = workbook.SheetNames.find((name) => names.some((needle) => name.toLowerCase().includes(needle)));
          if (!sheetName) return [];
          return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        };
        const candidateRows = rowsFromSheet(["candidate tracker", "candidate", "current candidate"]);
        const requirementRows = rowsFromSheet(["requirements", "open position", "open positions"]);
        const norm = (row, keys) => { const found = Object.keys(row).find((k) => keys.some((key) => k.toLowerCase().trim() === key.toLowerCase().trim())); return found ? row[found] : ""; };
        const importedCandidates = candidateRows.map((r, index) => {
          const stageRaw = String(norm(r,["Current Stage","Stage"]) || "New").trim();
          const stageMap = { "CV Received":"New", "Interview Pending":"Interview Scheduled", "Interview Done":"Interviewed", "Mapping Pending":"Selected", "Documents Pending":"Selected", "Approval Pending":"Selected", "Offer Sent":"Offer Released", "Offer Accepted":"Offer Accepted", "Joining Pending":"Joining Scheduled", "Joined":"Joined", "Hold":"Hold", "Rejected":"Rejected", "No Show":"No Show", "Screening":"Screening", "Shortlisted":"Shortlisted" };
          const stage = stageMap[stageRaw] || (CANDIDATE_STAGES.includes(stageRaw) ? stageRaw : "New");
          const candidateNo = String(norm(r,["Candidate ID","Candidate No"]) || `CAND-${String(store.candidates.length + index + 1).padStart(4,"0")}`);
          const name = String(norm(r,["Candidate Name","Name"]) || "").trim();
          if (!name) return null;
          const requirementTitle = String(norm(r,["Designation","Position"]) || "").trim();
          const requirement = store.requirements.find((x) => String(x.title).toLowerCase() === requirementTitle.toLowerCase());
          const categoryRaw = String(norm(r,["Category","Workforce Category"]) || "On Roll");
          return { ...EMPTY_CANDIDATE, id: makeId("CAN"), candidateNo, name, mobile: String(norm(r,["Mobile","Contact No."]) || ""), email: String(norm(r,["Email","Email Id"]) || ""), currentCompany: String(norm(r,["Current Company","Company"]) || ""), currentDesignation: requirementTitle, location: String(norm(r,["Site / Location","Location","Site"]) || ""), category: recruitmentCategories.some((item) => item.name.toLowerCase() === String(categoryRaw).toLowerCase()) ? recruitmentCategories.find((item) => item.name.toLowerCase() === String(categoryRaw).toLowerCase()).name : (recruitmentCategories[0]?.name || ""), stage, requirementId: requirement?.id || "", source: String(norm(r,["Source / Remarks","Source"]) || "Other").split("/")[0].trim() || "Other", recruiter: String(norm(r,["Owner","Recruiter"]) || ""), owner: String(norm(r,["Owner"]) || ""), nextAction: String(norm(r,["Next Action"]) || ""), nextActionDate: String(norm(r,["Next Action Date"]) || ""), mappingStatus: String(norm(r,["Mapping Status"]) || "Not Started"), documentsStatus: String(norm(r,["Documents Status"]) || "Pending"), bgvStatus: "Not Initiated", notes: String(norm(r,["Source / Remarks","Remarks"]) || ""), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        }).filter(Boolean);
        const importedRequirements = requirementRows.map((r, index) => {
          const title = String(norm(r,["Designation","Position","Requirement"]) || "").trim();
          if (!title) return null;
          const existing = store.requirements.find((x) => x.title.toLowerCase() === title.toLowerCase() && String(x.department).toLowerCase() === String(norm(r,["Department"])||"").toLowerCase());
          if (existing) return existing;
          const categoryRaw = String(norm(r,["Category","Category Type"]) || recruitmentCategories[0]?.name || "");
          const category = recruitmentCategories.find((item) => item.name.toLowerCase() === categoryRaw.toLowerCase())?.name || recruitmentCategories[0]?.name || "";
          return { ...EMPTY_REQ, id: makeId("REQ"), requirementNo: String(norm(r,["Req ID","Requirement ID"]) || `REQ-${String(store.requirements.length + index + 1).padStart(4,"0")}`), title, department: String(norm(r,["Department"]) || ""), location: String(norm(r,["Site / Location","Location","Site"]) || ""), category, vacancies: Number(norm(r,["Positions Required","Vacancies"]) || 1), experience: String(norm(r,["Experience"]) || ""), qualification: String(norm(r,["Qualification"]) || ""), targetDate: String(norm(r,["Target Joining Date","Target Date"]) || ""), recruiter: String(norm(r,["Recruiter","Owner"]) || ""), status: "Approved", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        }).filter(Boolean);
        const mergedRequirements = [...importedRequirements, ...store.requirements.filter((old) => !importedRequirements.some((n) => n.id === old.id || (n.title === old.title && n.department === old.department)))];
        const mergedCandidates = [...importedCandidates, ...store.candidates];
        await replaceAndSave({ requirements: mergedRequirements, candidates: mergedCandidates, activities: [...importedCandidates.map((c) => addActivity(c.id, "Imported from Excel", file.name)), ...store.activities] }, true);
        alert(`Import completed. Added ${importedCandidates.length} candidate record(s) and ${Math.max(0, importedRequirements.length - store.requirements.length)} requirement record(s).`);
      } catch (error) { alert(`Excel import failed: ${error?.message || "Invalid workbook"}`); }
    };
    reader.readAsArrayBuffer(file);
  };

  // Candidate import template is deliberately generated from a simple header array.
  // Avoid post-processing XLSX ZIP/XML: that was the source of blank/corrupt templates.
  const CANDIDATE_IMPORT_HEADERS = [
    "Candidate ID", "Candidate Name", "Mobile", "Email", "Current Location",
    "Current Department", "Current Company", "Current Designation", "Total Experience",
    "Relevant Experience", "Highest Qualification", "Passing Year", "Key Skills",
    "Current CTC", "Expected CTC", "Notice Period", "Last Working Date",
    "Preferred Location", "Willing to Relocate", "Category", "Source", "Referred By",
    "Consultant", "Recruiter", "Requirement", "Requirement ID", "Stage", "Next Action",
    "Next Action Date", "Follow-up Date", "Owner", "Rejection Reason", "Hold Reason", "Notes"
  ];

  const downloadCandidateTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const candidateSheet = XLSX.utils.aoa_to_sheet([
      CANDIDATE_IMPORT_HEADERS,
      Array(CANDIDATE_IMPORT_HEADERS.length).fill("")
    ]);
    candidateSheet["!cols"] = CANDIDATE_IMPORT_HEADERS.map((header) => ({
      wch: Math.min(34, Math.max(18, header.length + 3))
    }));
    candidateSheet["!autofilter"] = {
      ref: `A1:${XLSX.utils.encode_col(CANDIDATE_IMPORT_HEADERS.length - 1)}2`
    };
    candidateSheet["!freeze"] = {
      xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen"
    };
    XLSX.utils.book_append_sheet(workbook, candidateSheet, "Candidates Import");

    const instructions = [
      ["HRSYNC HRMS – CANDIDATE BULK IMPORT"],
      ["Required fields", "Candidate Name, Mobile"],
      ["Updated CV", "Excel cannot attach a CV file. Import candidates first, then open each candidate profile and attach the Updated CV."],
      ["Requirement mapping", "Fill Requirement ID or Requirement title. Requirement ID is preferred and must match an existing requirement."],
      ["Candidate Stage", CANDIDATE_STAGES.join(" | ")],
      ["Category Type", recruitmentCategories.map((x) => x.name).join(" | ") || "Configure Category Type in Organisation → Master Data"],
      ["Source", SOURCES.join(" | ")],
      ["Date format", "Use YYYY-MM-DD (example: 2026-11-18)."],
      ["Duplicate handling", "Rows matching an existing Candidate ID, Mobile or Email are skipped to protect existing records."],
      ["Active stage rule", "For stages other than New, provide Next Action, Next Action Date and Owner."],
      ["Important", "Do not rename the Candidates Import worksheet or the column headers."]
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionSheet["!cols"] = [{ wch: 25 }, { wch: 105 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions");
    XLSX.writeFile(workbook, "HRSYNC_Candidate_Import_Template.xlsx", { compression: true });
  };

  const importCandidatesExcel = async (file) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().includes("candidate")) || workbook.SheetNames[0];
      if (!sheetName) throw new Error("No worksheet found in the selected Excel file.");
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: true });
      if (!rows.length) throw new Error("The selected worksheet has no candidate rows. Please use the downloaded template and enter data below the header row.");

      const normalizeKey = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      const valueOf = (row, aliases) => {
        const aliasSet = new Set(aliases.map(normalizeKey));
        const key = Object.keys(row).find((column) => aliasSet.has(normalizeKey(column)));
        return key === undefined ? "" : row[key];
      };
      const textOf = (row, aliases, fallback = "") => {
        const value = valueOf(row, aliases);
        return value === null || value === undefined ? fallback : String(value).trim() || fallback;
      };
      const dateOf = (value) => {
        if (!value) return "";
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          const y = value.getFullYear(); const m = String(value.getMonth() + 1).padStart(2, "0"); const d = String(value.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
        if (typeof value === "number") {
          const parsed = XLSX.SSF.parse_date_code(value);
          if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
        const raw = String(value).trim();
        const dmy = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
        if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return "";
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      };
      const normalizeChoice = (raw, options, fallback) => {
        const found = options.find((option) => String(option).toLowerCase() === String(raw || "").trim().toLowerCase());
        return found || fallback;
      };
      const existingIds = new Set(store.candidates.map((c) => String(c.candidateNo || c.id || "").toLowerCase()));
      const existingMobiles = new Set(store.candidates.map((c) => String(c.mobile || "").replace(/\D/g, "")).filter(Boolean));
      const existingEmails = new Set(store.candidates.map((c) => String(c.email || "").trim().toLowerCase()).filter(Boolean));
      const imported = [];
      const skipped = [];
      const now = new Date().toISOString();

      rows.forEach((row, index) => {
        const excelRow = index + 2;
        const name = textOf(row, ["Candidate Name", "Name"]);
        const mobile = textOf(row, ["Mobile", "Contact No.", "Phone"] ).replace(/\D/g, "");
        if (!name || !mobile) { skipped.push(`Row ${excelRow}: Candidate Name and Mobile are required.`); return; }
        const candidateNoInput = textOf(row, ["Candidate ID", "Candidate No", "Employee Code"]);
        const email = textOf(row, ["Email", "Email ID"]).toLowerCase();
        if ((candidateNoInput && existingIds.has(candidateNoInput.toLowerCase())) || existingMobiles.has(mobile) || (email && existingEmails.has(email))) {
          skipped.push(`Row ${excelRow}: Duplicate Candidate ID, Mobile or Email.`); return;
        }
        const rawStage = textOf(row, ["Stage", "Initial Stage", "Current Stage"], "New");
        const stageAliases = { "cv received": "New", "interview pending": "Interview Scheduled", "interview done": "Interviewed", "offer sent": "Offer Released", "offer accepted": "Offer Accepted", "joining pending": "Joining Scheduled", "hold": "Hold", "no show": "No Show" };
        const stage = stageAliases[rawStage.toLowerCase()] || normalizeChoice(rawStage, CANDIDATE_STAGES, "New");
        const nextAction = textOf(row, ["Next Action"]);
        const nextActionDate = dateOf(valueOf(row, ["Next Action Date"]));
        const owner = textOf(row, ["Owner", "Recruiter"]);
        if (stage !== "New" && (!nextAction || !nextActionDate || !owner)) {
          skipped.push(`Row ${excelRow}: ${stage} requires Next Action, Next Action Date and Owner.`); return;
        }
        const requirementIdInput = textOf(row, ["Requirement ID", "Req ID", "Requirement No"]);
        const requirementTitle = textOf(row, ["Requirement", "Position", "Designation"]);
        const requirement = store.requirements.find((item) => [item.id, item.requirementNo].some((id) => String(id || "").toLowerCase() === requirementIdInput.toLowerCase()))
          || store.requirements.find((item) => requirementTitle && String(item.title || "").toLowerCase() === requirementTitle.toLowerCase());
        const categoryRaw = textOf(row, ["Category", "Workforce Category"], recruitmentCategories[0]?.name || "");
        const category = recruitmentCategories.find((item) => item.name.toLowerCase() === categoryRaw.toLowerCase())?.name || recruitmentCategories[0]?.name || "";
        const source = normalizeChoice(textOf(row, ["Source"], "Other"), SOURCES, "Other");
        const candidateNo = candidateNoInput || `CAND-${String(store.candidates.length + imported.length + 1).padStart(4, "0")}`;
        const candidate = {
          ...EMPTY_CANDIDATE,
          id: makeId("CAN"), candidateNo, name, mobile, email,
          location: textOf(row, ["Current Location", "Location"]),
          department: textOf(row, ["Current Department", "Department"]),
          currentCompany: textOf(row, ["Current Company", "Company"]),
          currentDesignation: textOf(row, ["Current Designation", "Designation"]),
          totalExperience: textOf(row, ["Total Experience", "Experience"]),
          relevantExperience: textOf(row, ["Relevant Experience"]),
          qualification: textOf(row, ["Highest Qualification", "Qualification"]),
          qualificationYear: textOf(row, ["Passing Year", "Qualification Year"]),
          skills: textOf(row, ["Key Skills", "Skills"]),
          currentCtc: textOf(row, ["Current CTC"]), expectedCtc: textOf(row, ["Expected CTC"]),
          noticePeriod: textOf(row, ["Notice Period"]), lastWorkingDate: dateOf(valueOf(row, ["Last Working Date"])),
          preferredLocation: textOf(row, ["Preferred Location"]),
          willingToRelocate: normalizeChoice(textOf(row, ["Willing to Relocate"], "Yes"), ["Yes", "No"], "Yes"),
          category, source, referredBy: textOf(row, ["Referred By"]), consultant: textOf(row, ["Consultant"]),
          recruiter: textOf(row, ["Recruiter"]), owner, requirementId: requirement?.id || "", stage,
          stageUpdatedDate: todayISO(), nextAction, nextActionDate,
          followUpDate: dateOf(valueOf(row, ["Follow-up Date", "Follow Up Date"])),
          rejectionReason: textOf(row, ["Rejection Reason"]), holdReason: textOf(row, ["Hold Reason"]),
          notes: textOf(row, ["Notes", "Remarks"]), cvStatus: "Missing", updatedCvName: "", updatedCvData: "",
          createdAt: now, updatedAt: now,
        };
        imported.push(candidate);
        existingIds.add(candidateNo.toLowerCase()); existingMobiles.add(mobile); if (email) existingEmails.add(email);
      });

      if (!imported.length) {
        alert(`No candidates imported. ${skipped.length} row(s) skipped.\n\n${skipped.slice(0, 12).join("\n")}`);
        return;
      }
      const nextStore = {
        ...store,
        candidates: [...imported, ...store.candidates],
        activities: [...imported.map((candidate) => addActivity(candidate.id, "Candidate imported from Excel", file.name)), ...store.activities]
      };
      setSaving(true);
      try {
        await persistRecruitmentStore(nextStore);
        setStore(nextStore);
        window.dispatchEvent(new CustomEvent("hrsyncRecruitmentUpdated"));
      } catch (saveError) {
        setLoadError(saveError?.message || "Unable to save imported candidates to Supabase.");
        throw saveError;
      } finally {
        setSaving(false);
      }
      alert(`Candidate import completed.\nAdded: ${imported.length}\nSkipped: ${skipped.length}\n\nUpdated CV is marked Missing for bulk-imported candidates. Attach the CV from each candidate profile before scheduling interviews.${skipped.length ? `\n\nFirst skipped rows:\n${skipped.slice(0, 10).join("\n")}` : ""}`);
    } catch (error) {
      console.error("Candidate Excel import failed:", error);
      alert(`Candidate Excel import failed: ${error?.message || "Please check the workbook format."}`);
    }
  };

  const exportCandidatesExcel = () => {
    const rows = filteredCandidates.map((c) => ({
      "Candidate ID": c.candidateNo || c.id, "Candidate Name": c.name, "Mobile": c.mobile,
      "Email": c.email, "Current Location": c.location, "Current Department": c.department,
      "Current Company": c.currentCompany, "Current Designation": c.currentDesignation,
      "Total Experience": c.totalExperience, "Relevant Experience": c.relevantExperience,
      "Highest Qualification": c.qualification, "Passing Year": c.qualificationYear,
      "Key Skills": c.skills, "Current CTC": c.currentCtc, "Expected CTC": c.expectedCtc,
      "Notice Period": c.noticePeriod, "Last Working Date": c.lastWorkingDate,
      "Preferred Location": c.preferredLocation, "Willing to Relocate": c.willingToRelocate,
      "Category": c.category, "Source": c.source, "Referred By": c.referredBy,
      "Consultant": c.consultant, "Recruiter": c.recruiter,
      "Requirement": candidateRequirements(c).map((r) => r.title).join("; "),
      "Requirement ID": candidateRequirements(c).map((r) => r.requirementNo || r.id).join("; "),
      "Stage": c.stage, "Next Action": c.nextAction, "Next Action Date": c.nextActionDate,
      "Follow-up Date": c.followUpDate, "Owner": c.owner, "Rejection Reason": c.rejectionReason,
      "Hold Reason": c.holdReason, "Updated CV Status": hasMandatoryCv(c.id) ? "Attached" : "Missing",
      "Updated CV File Name": c.updatedCvName, "Notes": c.notes
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(CANDIDATE_IMPORT_HEADERS.map((header) => [header, ""]))]);
    worksheet["!cols"] = Object.keys(rows[0] || {}).map((header) => ({ wch: Math.min(34, Math.max(18, header.length + 3)) }));
    if (rows.length) worksheet["!autofilter"] = { ref: worksheet["!ref"] };
    XLSX.utils.book_append_sheet(workbook, worksheet, "Candidate Tracker");
    XLSX.writeFile(workbook, `HRSYNC_Candidate_Tracker_${todayISO()}.xlsx`, { compression: true });
  };

  const exportCSV = (rows, filename) => { if (!rows.length) return alert("No data to export."); const headers = Object.keys(rows[0]); const csv = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); };

  const openMappingForCandidate = (candidate) => {
    if (!candidate) return;
    const existing = mappingByCandidate(candidate.id).sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
    const rows = existing.length ? existing.map((row) => ({
      ...EMPTY_MAPPING,
      ...row,
      designationAsPerCV: row.designationAsPerCV || row.designation || "",
      periodAsPerCV: row.periodAsPerCV || mappingPeriodLabel(row.fromDate, row.toDate),
      periodAsPerDocuments: row.periodAsPerDocuments || mappingPeriodLabel(row.documentFromDate, row.documentToDate),
    })) : [{ ...EMPTY_MAPPING }];
    setMappingForm({
      candidateId: candidate.id,
      asOnDate: candidate.experienceMappingSummary?.asOnDate || todayISO(),
      rows,
    });
    setMappingModal(true);
  };
  const addMappingRow = (type = "Company") => {
    setMappingForm((prev) => ({ ...prev, rows: [...(prev.rows || []), { ...EMPTY_MAPPING, mappingType: type }] }));
  };
  const updateMappingRow = (index, patch) => {
    setMappingForm((prev) => ({
      ...prev,
      rows: (prev.rows || []).map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
    }));
  };
  const removeMappingRow = (index) => {
    setMappingForm((prev) => ({ ...prev, rows: (prev.rows || []).filter((_, rowIndex) => rowIndex !== index) }));
  };
  const getMappingSummary = (candidateId) => {
    const rows = mappingByCandidate(candidateId);
    const cvMonths = rows.reduce((sum, row) => sum + calculateInclusiveMonths(row.fromDate, row.toDate), 0);
    const documentMonths = rows.reduce((sum, row) => sum + calculateInclusiveMonths(row.documentFromDate, row.documentToDate), 0);
    return { rows, cvMonths, documentMonths, cvExperience: monthsToYearsMonths(cvMonths), documentExperience: monthsToYearsMonths(documentMonths) };
  };
  const exportExperienceMapping = (candidate) => {
    if (!candidate) return;
    const rows = mappingByCandidate(candidate.id).sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
    if (!rows.length) return alert("No experience mapping has been saved for this candidate.");
    const summary = getMappingSummary(candidate.id);
    const aoa = [
      ["1. Experience Summary – As per CV"],
      ["Sr. No.", "Organization", "Designation", "Period as per CV", "Duration"],
      ...rows.map((r, i) => [i + 1, r.company || r.qualification || "—", r.designationAsPerCV || r.designation || "—", r.periodAsPerCV || mappingPeriodLabel(r.fromDate, r.toDate), r.duration || monthsToYearsMonths(calculateInclusiveMonths(r.fromDate, r.toDate))]),
      ["", "", "", "Total Experience as per CV", summary.cvExperience],
      [],
      ["2. Experience Calculation – As per CV"],
      ["A (Start Date)", "B (End Date)", "Total Years of Exp. in Each", "In Months"],
      ...rows.filter((r) => r.fromDate).map((r) => [r.fromDate, r.toDate || "Present", r.duration || monthsToYearsMonths(calculateInclusiveMonths(r.fromDate, r.toDate)), calculateInclusiveMonths(r.fromDate, r.toDate)]),
      ["", "", "Total", `${summary.cvMonths} Months`],
      ["", "", summary.cvExperience],
      [],
      ["Qualification"],
      ["Qualification", "Completion Year", "Experience After Qualification"],
      ...rows.filter((r) => r.mappingType === "Qualification" || r.qualification).map((r) => [r.qualification || r.company || "—", r.qualificationYear || "—", summary.cvExperience]),
      [],
      ["3. CV vs. Document Experience Mapping"],
      ["Sr.", "Company / Qualification", "Designation as per CV", "Designation as per Documents", "Period as per CV", "Period as per Documents", "Document Available", "Period / Details in Document", "Status"],
      ...rows.map((r, i) => [i + 1, r.company || r.qualification || "—", r.designationAsPerCV || r.designation || "—", r.designationAsPerDocuments || "—", r.periodAsPerCV || mappingPeriodLabel(r.fromDate, r.toDate), r.periodAsPerDocuments || mappingPeriodLabel(r.documentFromDate, r.documentToDate), r.documentAvailable || "No document provided", r.documentDetails || "—", r.comparisonStatus || (r.mappingStatus === "Verified" ? "✓ Verified" : r.remarks || "⚠️ Pending Verification")]),
      [],
      ["4. Experience Calculation – As per Available Documents"],
      ["A (Start Date)", "B (End Date)", "Total Years of Exp. in Each", "In Months"],
      ...rows.filter((r) => r.documentFromDate).map((r) => [r.documentFromDate, r.documentToDate || "Present", r.documentDuration || monthsToYearsMonths(calculateInclusiveMonths(r.documentFromDate, r.documentToDate)), calculateInclusiveMonths(r.documentFromDate, r.documentToDate)]),
      ["", "", "Total Document-Supported Period", `${summary.documentMonths} Months`],
      ["", "", summary.documentExperience],
      [],
      ["5. Final Experience Comparison"],
      ["Basis", "Experience"],
      ["Total Experience as per CV", summary.cvExperience],
      ["Experience supported by submitted documents", summary.documentExperience],
      ["Pending verification / certificates", rows.filter((r) => r.documentAvailable === "No document provided" || r.mappingStatus !== "Verified").map((r) => r.company || r.qualification).join(", ") || "None"],
      ["Current Employment", candidate.currentCompany ? `${candidate.currentCompany} – ${candidate.currentDesignation || "Current role"}` : "—"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 24 }, { wch: 42 }, { wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 65 }, { wch: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Experience Mapping");
    XLSX.writeFile(wb, `${candidate.name.replace(/[^a-z0-9]+/gi, "_")}_Experience_Mapping.xlsx`);
  };
  const openCandidate = (candidate, tab = "Overview") => { setCandidateDetail(candidate); setActiveCandidateTab(tab); };
  const openEditCandidate = (candidate) => {
    if (!candidate) return;
    setEditingCandidateId(candidate.id);
    setCandidateForm({
      ...EMPTY_CANDIDATE,
      ...candidate,
      updatedCvData: "",
      updatedCvName: documentsByCandidate(candidate.id).find((doc) => doc.type === "Updated CV" && doc.mandatory)?.fileName || candidate.updatedCvName || "",
      cvStatus: hasMandatoryCv(candidate.id) ? "Received" : (candidate.cvStatus || "Missing"),
    });
    setCandidateDetail(null);
    setCandidateModal(true);
  };
  const currentCandidate = candidateDetail ? candidateById(candidateDetail.id) : null;

  const buildTemplateData = (candidate, offer, joining, type, form) => {
    const req = requirementById(candidate?.requirementId); const employee = employeeOptions.find((e) => String(e.id) === String(form?.employeeId));
    const name = candidate?.name || employee?.name || ""; const designation = offer?.designation || candidate?.currentDesignation || req?.title || ""; const department = offer?.department || req?.department || employee?.department || ""; const location = offer?.location || joining?.location || candidate?.preferredLocation || candidate?.location || req?.location || "";
    const data = { DATE: formatDate(form?.issueDate || todayISO()), EMPLOYEE_NAME: name, EMPLOYEE_ID: employee?.employeeId || candidate?.candidateNo || candidate?.employeeId || "", FATHER_NAME: candidate?.fatherName || employee?.fatherName || "", ADDRESS: candidate?.address || candidate?.location || employee?.address || employee?.location || "", DESIGNATION: designation || employee?.designation || "", DEPARTMENT: department || employee?.department || "", LOCATION: location || employee?.location || "", JOINING_DATE: formatDate(offer?.joiningDate || joining?.expectedDate || employee?.doj || ""), ACTUAL_JOINING_DATE: formatDate(joining?.actualDate || employee?.doj || ""), CTC: money(offer?.ctc || employee?.ctc), MONTHLY_CTC: money(Number(offer?.ctc || employee?.ctc || 0) / 12), BASIC: money(offer?.basic), HRA: money(offer?.hra), REPORTING_MANAGER: offer?.reportingManager || joining?.reportingManager || employee?.reportingManager || "", PROBATION: offer?.probation || "", NOTICE_PERIOD: offer?.noticePeriod || "", TERMINATION_DATE: formatDate(form?.terminationDate || todayISO()), TERMINATION_REASON: form?.terminationReason || "", COMPANY_NAME: "BAUER Engineering India Pvt. Ltd." };
    return data;
  };
  const applyTemplate = (template, data) => String(template || "").replace(/{{([A-Z0-9_]+)}}/g, (_, key) => data[key] ?? "");

  const openLetter = (type, candidateId = "") => {
    const template = store.letterTemplates.find((t) => t.type === type && t.active) || store.letterTemplates.find((t) => t.type === type) || DEFAULT_LETTER_TEMPLATES.find((t) => t.type === type);
    const candidate = candidateById(candidateId) || store.candidates.find((c) => ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(c.stage)); const offer = candidate ? offerByCandidate(candidate.id) : null; const joining = candidate ? joiningByCandidate(candidate.id) : null; const employee = type === "Termination Letter" ? employeeOptions[0] : null;
    const form = { ...EMPTY_LETTER, templateId: template?.id || "", type, candidateId: candidate?.id || "", issueDate: todayISO(), subject: template?.subject || "" };
    const data = buildTemplateData(candidate, offer, joining, type, { ...form, employeeId: employee?.id || "" }); form.body = applyTemplate(template?.bodyTemplate, data); setLetterForm(form); setLetterModal(true);
  };

  const regenerateLetterBody = () => {
    const template = store.letterTemplates.find((t) => t.id === letterForm.templateId); const candidate = candidateById(letterForm.candidateId); const offer = candidate ? offerByCandidate(candidate.id) : null; const joining = candidate ? joiningByCandidate(candidate.id) : null; if (!template) return;
    const data = buildTemplateData(candidate, offer, joining, letterForm.type, letterForm); setLetterForm((prev) => ({ ...prev, body: applyTemplate(template.bodyTemplate, data), subject: template.subject }));
  };

  const saveLetter = async (printAfter = false) => {
    if ((!letterForm.candidateId && !letterForm.employeeId) || !letterForm.body.trim()) return alert("Candidate / Employee and letter body are required.");
    const item = { ...letterForm, id: makeId("LTR"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await replaceAndSave({ letters: [item, ...store.letters], activities: [addActivity(letterForm.candidateId, `${letterForm.type} generated`, letterForm.status), ...store.activities] }, true);
    if (printAfter) setTimeout(() => window.print(), 150); else setLetterModal(false);
  };

  const shareLetter = async () => {
    const title = `${letterForm.type} - ${candidateById(letterForm.candidateId)?.name || employeeOptions.find((e) => String(e.id) === String(letterForm.employeeId))?.name || "Employee"}`;
    if (navigator.share) {
      try { await navigator.share({ title, text: `${letterForm.subject || letterForm.type}\n\n${letterForm.body}` }); } catch {}
    } else {
      await navigator.clipboard?.writeText(`${letterForm.subject || letterForm.type}\n\n${letterForm.body}`);
      alert("Letter text copied to clipboard.");
    }
  };

  const saveTemplate = async (e) => {
    e.preventDefault(); if (!templateForm.name.trim() || !templateForm.type || !templateForm.bodyTemplate.trim()) return alert("Template name, type and fixed text are required.");
    const item = { ...templateForm, id: templateForm.id || makeId("TPL"), updatedAt: new Date().toISOString(), active: true }; const templates = store.letterTemplates.some((t) => t.id === item.id) ? store.letterTemplates.map((t) => t.id === item.id ? item : t) : [item, ...store.letterTemplates]; await replaceAndSave({ letterTemplates: templates }, true); setTemplateModal(false);
  };

  const uploadLetterhead = (file) => {
    if (!file) return; if (!file.type.startsWith("image/")) return alert("For automatic field merging, upload the fixed letterhead as PNG/JPG/WebP image."); if (file.size > 2 * 1024 * 1024) return alert("Please keep the letterhead image below 2 MB."); const reader = new FileReader(); reader.onload = () => setTemplateForm((prev) => ({ ...prev, letterheadImage: reader.result })); reader.readAsDataURL(file);
  };

  const navItems = [["Dashboard","⌂"],["Requirements","▣"],["Candidate Tracker","♙"],["Interviews","◷"],["Selection & Mapping","✓"],["Documents & BGV","▤"],["Offers & Joining","⇢"],["Letters","▤"],["Reports","▥"],["Settings","⚙"]];

  const renderDashboard = () => {
    const backouts = store.candidates.filter((c) => ["Withdrawn","No Show"].includes(c.stage)).length;
    const trackerCandidates = store.candidates.filter((c) => !dashboardSearch || `${c.name} ${c.candidateNo||c.id} ${c.currentDesignation} ${c.currentCompany}`.toLowerCase().includes(dashboardSearch.toLowerCase())).slice(0,30);
    const stages = [
      ["CV Received", store.candidates.length, "blue", "▤"],
      ["Screening", store.candidates.filter(c=>["Screening","Shortlisted"].includes(c.stage)).length, "purple", "♙"],
      ["Interview", store.candidates.filter(c=>["Interview Scheduled","Interviewed"].includes(c.stage)).length, "violet", "♟"],
      ["Selected", stats.selected, "green", "✓"],
      ["Offer Released", store.candidates.filter(c=>["Offer Released","Offer Accepted"].includes(c.stage)).length, "amber", "▤"],
      ["Offer Accepted", store.candidates.filter(c=>["Offer Accepted","Joining Scheduled"].includes(c.stage)).length, "sky", "♟"],
      ["Joined", stats.joined, "mint", "✓"],
      ["Backout", backouts, "red", "×"],
    ];
    const attention = [
      ["Joining overdue", store.joinings.filter(j=>j.expectedDate && j.expectedDate<today && !["Joined","Cancelled","No Show"].includes(j.status)).length, "overdue", "◷", "Offers & Joining"],
      ["Joining in next 7 days", next7DayJoiningsCount, "due", "◷", "Offers & Joining"],
      ["Backout cases", backouts, "backout", "×", "Candidate Tracker"],
      ["Experience mapping pending", stats.mappingPending, "mapping", "✓", "Selection & Mapping"],
      ["Documents / BGV pending", stats.docsPending+stats.bgvPending, "documents", "▤", "Documents & BGV"],
    ];
    return <>
      <div className="rec-overview-stats">
        {[["Open Positions",stats.openPositions,"Open / balance vacancies","blue","▣"],["Active Candidates",store.candidates.filter(c=>!['Rejected','Joined','Withdrawn','No Show'].includes(c.stage)).length,"Across all stages","green","♙"],["Offers Released",stats.offers,"Generated, sent or accepted","amber","▤"],["Joining Due",stats.joiningPending,"Expected / confirmed joining","orange","◷"],["Joined",stats.joined,"Employee handoff ready","mint","✓"],["Pre-joining Backouts",backouts,"Declined, withdrawn or no-show","red","×"]].map(([label,value,sub,tone,icon])=><div className={`rec-overview-stat ${tone}`} key={label}><span className="rec-overview-stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{sub}</em></div></div>)}
      </div>
      <div className="rec-card rec-overview-funnel"><div className="rec-card-head"><div><h3>Recruitment Funnel</h3><p>See the live movement of candidates across each hiring stage.</p></div><button className="rec-link-btn" onClick={()=>setView("Candidate Tracker")}>View candidates →</button></div><div className="rec-overview-funnel-steps">{stages.map(([label,value,tone,icon],i)=><div className="rec-overview-funnel-step" key={label}><div className={`rec-overview-funnel-tile ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>{i<stages.length-1&&<b>→</b>}</div>)}</div></div>
      <div className="rec-overview-main-grid">
        <div className="rec-card rec-overview-tracker"><div className="rec-card-head"><div><h3>Offer & Joining Tracker</h3><p>Track candidate offers, expected joining and actual joining dates.</p></div><div className="rec-overview-actions"><label className="rec-overview-search">⌕<input placeholder="Search candidate, code or position..." value={dashboardSearch} onChange={e=>setDashboardSearch(e.target.value)}/></label><button className="rec-secondary" onClick={exportCandidatesExcel}>↓ Export</button></div></div><div className="rec-table-wrap"><table className="rec-table rec-overview-table"><thead><tr><th>#</th><th>Candidate Name</th><th>Employee Code</th><th>Designation</th><th>Project / Site</th><th>Offer Date</th><th>Offer DOJ</th><th>Actual DOJ</th><th>Variance</th><th>Status</th><th>Actions</th></tr></thead><tbody>{trackerCandidates.map((c,i)=>{const offer=offerByCandidate(c.id);const joining=joiningByCandidate(c.id);const expected=joining?.expectedDate||offer?.joiningDate||"";const actual=joining?.actualDate||"";let variance="—";if(expected&&actual){const diff=Math.round((new Date(`${actual}T00:00:00`)-new Date(`${expected}T00:00:00`))/86400000);variance=diff===0?"On Time":`${diff>0?"+":""}${diff} days`;}const site=joining?.location||offer?.location||requirementById(c.requirementId)?.location||"—";const status=joining?.status||offer?.status||c.stage;return <tr key={c.id}><td>{i+1}</td><td><button className="rec-table-link" onClick={()=>openCandidate(c)}><strong>{c.name}</strong><span className="rec-sub">Candidate</span></button></td><td>{c.employeeCode||c.employeeId||c.candidateNo||"—"}</td><td>{offer?.designation||c.currentDesignation||requirementById(c.requirementId)?.title||"—"}</td><td>{site}</td><td>{formatDate(offer?.issueDate||offer?.createdAt?.slice?.(0,10))}</td><td>{formatDate(expected)}</td><td>{formatDate(actual)}</td><td className={variance.startsWith("+")?"rec-variance-late":""}>{variance}</td><td><StatusBadge>{status}</StatusBadge></td><td><div className="rec-overview-row-actions"><button title="View candidate" onClick={()=>openCandidate(c)}>◉</button><button title="Offer / joining details" onClick={()=>{setView("Offers & Joining");setSearch(c.name);}}>✎</button><button title="More candidate actions" onClick={()=>openCandidate(c)}>⋮</button></div></td></tr>})}{!trackerCandidates.length&&<tr><td colSpan="11"><div className="rec-empty">No matching candidates.</div></td></tr>}</tbody></table></div><div className="rec-overview-card-footer"><span className="rec-sub">Showing up to 30 candidates</span><button className="rec-link-btn" onClick={()=>setView("Candidate Tracker")}>View all candidates →</button></div></div>
        <div className="rec-card rec-overview-attention"><div className="rec-card-head"><div><span className="rec-eyebrow">ATTENTION REQUIRED</span><h3>Items which need recruitment follow-up.</h3></div></div>{attention.map(([label,count,tone,icon,target])=><button className={`rec-attention-row ${tone}`} key={label} onClick={()=>setView(target)}><span>{icon}</span><b>{label}</b><strong>{count}</strong><i>›</i></button>)}</div>
      </div>
      <div className="rec-overview-lower-grid"><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">HIRING DEMAND</span><h3>Open Requirements</h3></div><button className="rec-link-btn" onClick={()=>setView("Requirements")}>View all →</button></div><div className="rec-overview-position-list">{activeRequirements.slice(0,6).map(r=>{const filled=store.candidates.filter(c=>candidateHasRequirement(c,r.id)&&["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).length;const balance=Math.max(0,Number(r.vacancies||0)-filled);return <button key={r.id} onClick={()=>setView("Requirements")}><div><b>{r.title}</b><small>{r.department} · {r.location||"—"}</small></div><em>{filled}/{r.vacancies} filled</em><strong className={balance?"open":"closed"}>{balance?`${balance} Open`:"Filled"}</strong></button>})}{!activeRequirements.length&&<div className="rec-empty">No open requirements.</div>}</div></div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">ACTION CENTER</span><h3>Priority Candidate Actions</h3></div><button className="rec-link-btn" onClick={()=>setView("Candidate Tracker")}>Open tracker →</button></div><div className="rec-overview-action-list">{getActionRows.filter(x=>x.c.nextAction||x.c.nextActionDate).sort((a,b)=>String(a.c.nextActionDate||"9999").localeCompare(String(b.c.nextActionDate||"9999"))).slice(0,6).map(x=><button key={x.c.id} onClick={()=>openCandidate(x.c)}><span className="rec-avatar">{initials(x.c.name)}</span><div><b>{x.c.name}</b><small>{x.req?.title||x.c.currentDesignation||"Candidate"} · {x.c.nextAction||"Follow-up"}</small></div><StatusBadge tone={x.c.nextActionDate&&x.c.nextActionDate<today?"danger-badge":"pending-badge"}>{x.c.nextActionDate&&x.c.nextActionDate<today?"Overdue":"Action"}</StatusBadge></button>)}{!getActionRows.some(x=>x.c.nextAction||x.c.nextActionDate)&&<div className="rec-empty">No priority actions.</div>}</div></div></div>
    </>;
  };

  const pageExcel = (rows, fileName, sheetName = "Data") => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName, { compression: true });
  };
  const pageTemplate = (headers, fileName, sheetName, instructions = []) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, Array(headers.length).fill("")]);
    ws["!cols"] = headers.map(h => ({ wch: Math.max(18, Math.min(32, String(h).length + 4)) }));
    ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}2` };
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    if (instructions.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Instructions"], ...instructions.map(x=>[x])]), "Instructions");
    XLSX.writeFile(wb, fileName, { compression: true });
  };
  const pageImport = async (file, page) => {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
      if (!rows.length) throw new Error("No data rows found. Fill the downloaded template below the header row.");
      const norm = (row, ...keys) => { const m=Object.fromEntries(Object.entries(row).map(([k,v])=>[String(k).trim().toLowerCase(),v])); for(const k of keys){const v=m[String(k).trim().toLowerCase()];if(v!==undefined&&v!=="")return v;} return ""; };
      const byCandidate = (row) => store.candidates.find(c => String(c.candidateNo||c.id).toLowerCase()===String(norm(row,"Candidate ID","Candidate No","ID")).toLowerCase() || (norm(row,"Candidate Name","Name") && c.name.toLowerCase()===String(norm(row,"Candidate Name","Name")).toLowerCase()));
      const stamp = new Date().toISOString();
      if (page === "Requirements") {
        const imported=rows.map((r,i)=>{const title=String(norm(r,"Position","Requirement","Designation")).trim();if(!title)return null;const dept=String(norm(r,"Department")).trim();const existing=store.requirements.find(x=>x.title.toLowerCase()===title.toLowerCase()&&String(x.department||"").toLowerCase()===dept.toLowerCase());if(existing)return existing;const categoryRaw=String(norm(r,"Category","Category Type")||recruitmentCategories[0]?.name||"");const category=recruitmentCategories.find(item=>item.name.toLowerCase()===categoryRaw.toLowerCase())?.name||recruitmentCategories[0]?.name||"";return {...EMPTY_REQ,id:makeId("REQ"),requirementNo:String(norm(r,"Requirement ID","Req ID")||`REQ-${String(store.requirements.length+i+1).padStart(4,"0")}`),title,department:dept,location:String(norm(r,"Project / Site","Site","Location")),category,vacancies:Number(norm(r,"Required","Positions Required","Vacancies")||1),experience:String(norm(r,"Experience")),qualification:String(norm(r,"Qualification")),targetDate:String(norm(r,"Target Joining","Target Date")),recruiter:String(norm(r,"Recruiter")),status:String(norm(r,"Status")||"Approved"),jdFileName:String(norm(r,"JD File Name")||""),jdFileData:"",createdAt:stamp,updatedAt:stamp};}).filter(Boolean);
        await replaceAndSave({requirements:[...imported,...store.requirements.filter(old=>!imported.some(n=>n.id===old.id||n.title===old.title&&n.department===old.department))]},true); alert(`Requirements import completed. ${imported.length} row(s) processed.`);
      } else if (page === "Interviews") {
        const imported=rows.map(r=>{const c=byCandidate(r);if(!c)return null;return {...EMPTY_INTERVIEW,id:makeId("INT"),candidateId:c.id,round:String(norm(r,"Round","Interview Round")||INTERVIEW_ROUNDS[0]),date:String(norm(r,"Date","Interview Date")),time:String(norm(r,"Time")),mode:String(norm(r,"Mode")||"In Person"),panel:String(norm(r,"Panel","Interview Panel")),coordinator:String(norm(r,"Coordinator")),location:String(norm(r,"Location","Meeting Link")),meetingLink:String(norm(r,"Meeting Link")),status:String(norm(r,"Status")||"Scheduled"),feedback:EMPTY_FEEDBACK,createdAt:stamp};}).filter(Boolean);
        await replaceAndSave({interviews:[...imported,...store.interviews]},true);alert(`Interview import completed. ${imported.length} interview row(s) added.`);
      } else if (page === "Selection & Mapping") {
        const updated=store.candidates.map(c=>{const row=rows.find(r=>String(norm(r,"Candidate ID","Candidate No")).toLowerCase()===String(c.candidateNo||c.id).toLowerCase()||String(norm(r,"Candidate Name","Name")).toLowerCase()===c.name.toLowerCase());return row?{...c,mappingStatus:String(norm(row,"Mapping Status","Status")||c.mappingStatus),updatedAt:stamp}:c;});
        await replaceAndSave({candidates:updated},true);alert(`Mapping import completed. ${rows.filter(r=>byCandidate(r)).length} candidate row(s) updated.`);
      } else if (page === "Documents & BGV") {
        const newDocs=[];const bgvUpdates=[];
        rows.forEach(r=>{const c=byCandidate(r);if(!c)return;const type=String(norm(r,"Document Type","Document"));const status=String(norm(r,"Document Status","Status")||"Pending");if(type)newDocs.push({id:makeId("DOC"),candidateId:c.id,type,status,fileName:"",fileData:"",uploadedAt:stamp,notes:String(norm(r,"Notes"))});const bstatus=String(norm(r,"BGV Status"));if(bstatus){const existing=bgvByCandidate(c.id);bgvUpdates.push({...EMPTY_BGV,...existing,id:existing?.id||makeId("BGV"),candidateId:c.id,status:bstatus,agency:String(norm(r,"Agency")),referenceNo:String(norm(r,"Reference No","Reference")),submittedDate:String(norm(r,"Submitted Date")),updatedAt:stamp});}});
        await replaceAndSave({documents:[...newDocs,...store.documents],bgv:[...bgvUpdates,...store.bgv.filter(old=>!bgvUpdates.some(n=>n.candidateId===old.candidateId))]},true);alert(`Documents/BGV import completed. ${newDocs.length} document status row(s) and ${bgvUpdates.length} BGV row(s) processed.`);
      } else if (page === "Offers & Joining") {
        const newOffers=[],newJoinings=[],candidateUpdates=[];
        rows.forEach(r=>{const c=byCandidate(r);if(!c)return;const offerStatus=String(norm(r,"Offer Status","Offer")||"Not Started");const joiningStatus=String(norm(r,"Joining Status","Joining")||"Not Started");const offerExisting=offerByCandidate(c.id);const joiningExisting=joiningByCandidate(c.id);const offer={...EMPTY_OFFER,...offerExisting,id:offerExisting?.id||makeId("OFF"),candidateId:c.id,offerNumber:String(norm(r,"Offer Number","Offer No")),designation:String(norm(r,"Designation","Position")||c.currentDesignation),department:String(norm(r,"Department")||c.department),ctc:String(norm(r,"CTC")),status:offerStatus,issueDate:String(norm(r,"Offer Date","Issue Date")),joiningDate:String(norm(r,"Expected DOJ","Joining Date")),location:String(norm(r,"Project / Site","Location")),updatedAt:stamp};const joining={...EMPTY_JOINING,...joiningExisting,id:joiningExisting?.id||makeId("JOIN"),candidateId:c.id,expectedDate:String(norm(r,"Expected DOJ","Joining Date")),actualDate:String(norm(r,"Actual DOJ","Actual Joining Date")),location:String(norm(r,"Project / Site","Location")),status:joiningStatus,updatedAt:stamp};newOffers.push(offer);newJoinings.push(joining);candidateUpdates.push({...c,stage:joiningStatus==="Joined"?"Joined":offerStatus==="Offer Accepted"?"Offer Accepted":offerStatus==="Offer Released"?"Offer Released":c.stage,updatedAt:stamp});});
        await replaceAndSave({offers:[...newOffers,...store.offers.filter(o=>!newOffers.some(n=>n.candidateId===o.candidateId))],joinings:[...newJoinings,...store.joinings.filter(j=>!newJoinings.some(n=>n.candidateId===j.candidateId))],candidates:store.candidates.map(c=>candidateUpdates.find(u=>u.id===c.id)||c)},true);alert(`Offer & Joining import completed. ${newOffers.length} candidate row(s) processed.`);
      } else if (page === "Letters") {
        const imported=rows.map(r=>{const name=String(norm(r,"Template Name","Name")).trim();const type=String(norm(r,"Letter Type","Type"));const body=String(norm(r,"Body Template","Body","Template Text"));if(!name||!type||!body)return null;const id=String(norm(r,"Template ID","ID")||makeId("TPL"));return {id,name,type,subject:String(norm(r,"Subject")),bodyTemplate:body,footerText:String(norm(r,"Footer Text","Footer")),letterheadImage:"",active:String(norm(r,"Active")||"true").toLowerCase()!=="false",updatedAt:stamp};}).filter(Boolean);
        await replaceAndSave({letterTemplates:[...imported,...store.letterTemplates.filter(old=>!imported.some(n=>n.id===old.id||n.name===old.name&&n.type===old.type))]},true);alert(`Letter template import completed. ${imported.length} template(s) processed.`);
      } else alert("Import is not supported for this page yet. Use the downloaded template as a data-format guide.");
    } catch(error) { alert(`Import failed: ${error?.message||"Please check the Excel file and template headers."}`); }
  };
  const importControl = (page) => <label className="rec-secondary rec-upload-button">↑ Import Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{pageImport(e.target.files?.[0],page);e.target.value="";}}/></label>;
  const pageControlButtons = (page, rows, headers, filePrefix, sheet = page) => <div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageTemplate(headers,`HRSYNC_${filePrefix}_Import_Template.xlsx`,sheet,["Use the first worksheet and keep column headers unchanged.","Use Candidate ID for candidate-linked records; candidate name is a fallback.","Dates should be YYYY-MM-DD.","Import will append or update records without deleting existing recruitment data."])}>↓ Template</button>{importControl(page)}<button className="rec-secondary" onClick={()=>pageExcel(rows,`HRSYNC_${filePrefix}_Export_${today}.xlsx`,sheet)}>↓ Export Excel</button></div>;

  const renderRequirements = () => {
    const reqRows=store.requirements.map(r=>{
      const candidatesAdded=store.candidates.filter(c=>candidateHasRequirement(c,r.id)).length;
      const selectedCount=store.candidates.filter(c=>candidateHasRequirement(c,r.id)&&REQUIREMENT_VISIBLE_STAGES.includes(c.stage)).length;
      return {"Requirement ID":r.requirementNo||r.id,"Position":r.title,"Department":r.department,"Project / Site":r.location,"Category":r.category,"Required":r.vacancies,"Candidates Added":candidatesAdded,"Selected / Advanced":selectedCount,"Open Vacancies":Math.max(0,Number(r.vacancies||0)-selectedCount),"Experience":r.experience,"Qualification":r.qualification,"Target Joining":r.targetDate,"Recruiter":r.recruiter,"Status":r.status,"Approver":r.approverName||"","JD File Name":r.jdFileName||""};
    });
    const reqHeaders=["Requirement ID","Position","Department","Project / Site","Category","Required","Experience","Qualification","Target Joining","Recruiter","Status","Approver","JD File Name"];
    const reqTemplate=()=>pageTemplate(reqHeaders,"HRSYNC_Requirements_Import_Template.xlsx","Requirements Import",["Fill Position and Department at minimum.","Dates should be YYYY-MM-DD.","JD File Name is optional metadata; upload the actual JD from the requirement form.","Keep the headers unchanged."]);
    return <div className="rec-detail-page"><div className="rec-feature-hero"><div><span className="rec-eyebrow">MANPOWER PLANNING</span><h2>Open Positions</h2><p>Create, monitor and close requirements while keeping the vacancy pipeline visible.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={reqTemplate}>↓ Template</button><label className="rec-secondary rec-upload-button">↑ Import Requirements<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{pageImport(e.target.files?.[0],"Requirements");e.target.value="";}}/></label><button className="rec-secondary" onClick={()=>pageExcel(reqRows,"HRSYNC_Requirements_Export.xlsx","Requirements")}>↓ Export Excel</button><button className="rec-primary" onClick={openNewRequirement}>＋ New Requirement</button></div></div>
    <div className="rec-feature-metrics"><div className="rec-feature-metric blue"><span>▣</span><div><small>Active Requirements</small><strong>{store.requirements.filter(r=>!['Closed','Rejected'].includes(r.status)).length}</strong><em>Draft, pending, approved or on hold</em></div></div><div className="rec-feature-metric orange"><span>◌</span><div><small>Open Positions</small><strong>{openPositions}</strong><em>Vacancies still to be filled</em></div></div><div className="rec-feature-metric green"><span>✓</span><div><small>Filled Pipeline</small><strong>{stats.selected}</strong><em>Selected to joined candidates</em></div></div><div className="rec-feature-metric purple"><span>◷</span><div><small>Target This Month</small><strong>{store.requirements.filter(r=>r.targetDate&&r.targetDate.slice(0,7)===today.slice(0,7)).length}</strong><em>Requirements with current target</em></div></div></div>
    <div className="rec-card rec-feature-card"><div className="rec-card-head"><div><h3>Requirements & Candidate Pipeline</h3><p>Live requirement status, vacancies and recruitment progress.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageExcel(reqRows,"HRSYNC_Requirements_Export.xlsx","Requirements")}>↓ Export Requirements</button><button className="rec-secondary" onClick={reqTemplate}>↓ Template</button><label className="rec-secondary rec-upload-button">↑ Import<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{pageImport(e.target.files?.[0],"Requirements");e.target.value="";}}/></label><button className="rec-primary" onClick={openNewRequirement}>＋ Add Position</button></div></div><div className="rec-toolbar"><input placeholder="Search requirement, position, department, site..." value={search} onChange={e=>setSearch(e.target.value)} /><select value={reqFilter} onChange={e=>setReqFilter(e.target.value)}><option value="All">All statuses</option>{REQ_STATUSES.map(x=><option key={x}>{x}</option>)}</select></div><div className="rec-table-wrap"><table className="rec-table rec-feature-table"><thead><tr><th>Position</th><th>Requirement ID</th><th>Department</th><th>Project / Site</th><th>Required</th><th>Candidates Added</th><th>Selected / Advanced</th><th>Open</th><th>Target Joining</th><th>Recruiter</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredRequirements.filter(r=>!search||`${r.id} ${r.title} ${r.department} ${r.location} ${r.recruiter}`.toLowerCase().includes(search.toLowerCase())).map(r=>{const candidatesAdded=store.candidates.filter(c=>candidateHasRequirement(c,r.id)).length;const selectedCount=store.candidates.filter(c=>candidateHasRequirement(c,r.id)&&REQUIREMENT_VISIBLE_STAGES.includes(c.stage)).length;const balance=Math.max(0,Number(r.vacancies||0)-selectedCount);return <tr key={r.id}><td><strong>{r.title}</strong><span className="rec-sub">{r.reason||""}</span>{r.jdFileData&&<button type="button" className="rec-table-link small rec-jd-link" onClick={()=>downloadRequirementJD(r)}>↓ JD · {r.jdFileName||"Download"}</button>}</td><td>{r.requirementNo||r.id}</td><td>{r.department}</td><td>{r.location||"—"}</td><td>{r.vacancies}</td><td><button type="button" className="rec-link-btn rec-requirement-count" title={`View ${candidatesAdded} candidates mapped to this requirement`} onClick={()=>{setSearch("");setStageFilter("All");setCategoryFilter("All");setRequirementFilter(r.id);setView("Candidate Tracker");}}>{candidatesAdded} · View</button></td><td><StatusBadge>{selectedCount}</StatusBadge></td><td><b className={balance?"rec-open-count":"rec-filled-count"}>{balance}</b></td><td>{formatDate(r.targetDate)}</td><td>{r.recruiter||"—"}</td><td><StatusBadge>{r.status}</StatusBadge></td><td><div className="rec-table-actions">{r.status==="Draft"&&<button className="rec-inline-action" onClick={()=>updateRequirementStatus(r.id,"Pending Approval")}>Submit</button>}{r.status==="Pending Approval"&&<><button className="rec-inline-action approve" onClick={()=>updateRequirementStatus(r.id,"Approved")}>Approve</button><button className="rec-inline-action reject" onClick={()=>updateRequirementStatus(r.id,"Rejected")}>Reject</button></>}{r.status==="Approved"&&<button className="rec-inline-action close" onClick={()=>updateRequirementStatus(r.id,"Closed")}>Close</button>}<button className="rec-inline-action" onClick={()=>openCandidateAssignment(r)}>＋ Assign Candidate</button><button className="rec-inline-action delete" onClick={()=>deleteRequirement(r.id)}>Delete</button></div></td></tr>})}</tbody></table>{!filteredRequirements.length&&<div className="rec-empty-state"><span>▣</span><h4>No requirements yet</h4><p>Create the first open position to start building your candidate pipeline.</p><button className="rec-primary" onClick={openNewRequirement}>＋ Create Requirement</button></div>}</div></div></div>;
  };
  const renderCandidates = () => <div className="rec-detail-page"><div className="rec-list-hero candidates"><div><span className="rec-eyebrow">CANDIDATE TRACKER</span><h2>Candidate Control Tower</h2><p>Review candidates from CV received through offer, joining and handoff.</p></div><div className="rec-list-head-actions"><button className="rec-secondary" onClick={downloadCandidateTemplate}>↓ Template</button><label className="rec-secondary rec-upload-button">↑ Import Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{importCandidatesExcel(e.target.files?.[0]);e.target.value="";}}/></label><button className="rec-secondary" onClick={exportCandidatesExcel}>↓ Export Excel</button><button className="rec-primary" onClick={openNewCandidate}>＋ Add Candidate</button></div></div><div className="rec-list-metrics"><div className="rec-list-metric blue"><span>♙</span><div><small>All Candidates</small><strong>{store.candidates.length}</strong><em>Across all open positions</em></div></div><div className="rec-list-metric purple"><span>⌕</span><div><small>In Screening</small><strong>{store.candidates.filter(c=>["New","Screening"].includes(c.stage)).length}</strong><em>New and under review</em></div></div><div className="rec-list-metric amber"><span>◷</span><div><small>Interview Stage</small><strong>{store.candidates.filter(c=>["Interview","Interviewed","Hold"].includes(c.stage)).length}</strong><em>Scheduled or feedback pending</em></div></div><div className="rec-list-metric green"><span>✓</span><div><small>Offer / Joining</small><strong>{store.candidates.filter(c=>["Offer Released","Offer Accepted","Joining Scheduled"].includes(c.stage)).length}</strong><em>Candidates nearing joining</em></div></div></div><div className="rec-card rec-list-card"><div className="rec-card-head"><div><span className="rec-eyebrow">CANDIDATE TRACKER</span><h3>Candidates <span className="rec-heading-muted">(All Positions)</span></h3><p>Track candidate profiles and stage movement through the recruitment process.</p></div><div className="rec-head-actions"><button className="rec-secondary" onClick={downloadCandidateTemplate}>↓ Template</button><label className="rec-secondary rec-upload-button">↑ Import Candidates<input type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>{importCandidatesExcel(e.target.files?.[0]);e.target.value="";}}/></label><button className="rec-secondary" onClick={exportCandidatesExcel}>↓ Export Candidate Excel</button><button className="rec-secondary" onClick={()=>exportCSV(filteredCandidates.map(c=>({"Candidate ID":c.candidateNo||c.id,"Name":c.name,"Updated CV":hasMandatoryCv(c.id)?"Attached":"Missing","CV File":c.updatedCvName||"","Optional Docs":getDocumentSummary(c.id).optionalReceived,"Requirement":candidateRequirements(c).map(r=>r.title).join("; "),"Department":candidateRequirements(c).map(r=>r.department).filter(Boolean).join("; "),"Location":c.location,"Category":c.category,"Stage":c.stage,"Interview":store.interviews.find(i=>i.candidateId===c.id)?.status||"Not Scheduled","Mapping":c.mappingStatus||"Not Started","Documents":getDocumentSummary(c.id).pending===0?"Complete":"Pending","BGV":bgvByCandidate(c.id)?.status||"Not Initiated","Offer":offerByCandidate(c.id)?.status||"Not Started","Joining":joiningByCandidate(c.id)?.status||"—","Next Action":c.nextAction,"Owner":c.owner||c.recruiter||""})),`HRSYNC_Recruitment_Candidate_Tracker_${today}.csv`)}>↓ Export CSV</button><button className="rec-primary" onClick={openNewCandidate}>＋ Add Candidate</button></div></div><div className="rec-toolbar"><input placeholder="Search candidate, mobile, company, designation, requirement, site..." value={search} onChange={(e)=>setSearch(e.target.value)} /><select value={stageFilter} onChange={(e)=>setStageFilter(e.target.value)}><option value="All">All Stages</option>{CANDIDATE_STAGES.map((x)=><option key={x}>{x}</option>)}</select><select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)}><option value="All">All Category Types</option>{recruitmentCategories.map((x)=><option key={x.id} value={x.name}>{x.name}</option>)}</select><select value={requirementFilter} onChange={(e)=>setRequirementFilter(e.target.value)}><option value="All">All Requirements</option>{store.requirements.map(r=><option key={r.id} value={r.id}>{r.title} · {r.requirementNo||r.id}</option>)}</select></div><div className="rec-table-wrap"><table className="rec-table rec-control-table"><thead><tr><th>Candidate</th><th>Updated CV</th><th>Optional Docs</th><th>Requirement</th><th>Site</th><th>Category Type</th><th>Stage</th><th>Interview</th><th>Mapping</th><th>Docs</th><th>BGV</th><th>Offer</th><th>Joining</th><th>Next Action</th><th>Actions</th></tr></thead><tbody>{filteredCandidates.map((c)=>{const req=requirementById(c.requirementId);const showRequirement=REQUIREMENT_VISIBLE_STAGES.includes(c.stage);const interview=store.interviews.filter(i=>i.candidateId===c.id).sort((a,b)=>`${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0];const doc=getDocumentSummary(c.id);const bgv=bgvByCandidate(c.id);const offer=offerByCandidate(c.id);const joining=joiningByCandidate(c.id);return <tr key={c.id}><td><button className="rec-table-link" onClick={()=>openCandidate(c)}><span className="rec-person"><span className="rec-avatar">{initials(c.name)}</span><span><strong>{c.name}</strong><small>{c.candidateNo||c.id} · {c.mobile}</small></span></span></button></td><td><StatusBadge>{hasMandatoryCv(c.id)?"Attached":"Missing"}</StatusBadge></td><td>{doc.optionalReceived}/{OPTIONAL_DOCUMENT_TYPES.length}</td><td>{showRequirement?(req?.title||"Requirement not found"):("—")}</td><td>{showRequirement?(req?.location||joining?.location||offer?.location||c.preferredLocation||c.location||"—"):(c.preferredLocation||c.location||"—")}</td><td>{c.category}</td><td><StatusBadge>{c.stage}</StatusBadge></td><td><StatusBadge>{interview?.status||"Not Scheduled"}</StatusBadge></td><td><StatusBadge>{c.mappingStatus||"Not Started"}</StatusBadge></td><td><StatusBadge>{doc.pending===0?"Complete":"Pending"}</StatusBadge></td><td><StatusBadge>{bgv?.status||"Not Initiated"}</StatusBadge></td><td><StatusBadge>{offer?.status||"Not Started"}</StatusBadge></td><td>{joining?.expectedDate?formatDate(joining.expectedDate):"—"}</td><td><button className="rec-table-link small" onClick={()=>openCandidate(c,"Overview")}>{c.nextAction||"Open"}<small>{formatDate(c.nextActionDate)}</small></button></td><td><div className="rec-table-actions"><button className="rec-inline-action" onClick={()=>openEditCandidate(c)}>Edit</button><button className="rec-inline-action" onClick={()=>openCandidate(c)}>View</button></div></td></tr>})}</tbody></table>{!filteredCandidates.length&&<div className="rec-empty">No candidates match the selected filters.</div>}</div></div></div>;
  const renderInterviews = () => <div className="rec-detail-page"><div className="rec-feature-hero"><div><span className="rec-eyebrow">INTERVIEW MANAGEMENT</span><h2>Interview Tracker</h2><p>Schedule rounds, assign panels and close feedback without losing candidate context.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageTemplate(["Candidate ID","Candidate Name","Round","Date","Time","Mode","Panel","Coordinator","Location","Meeting Link","Status"],"HRSYNC_Interview_Import_Template.xlsx","Interviews Import")}>↓ Template</button>{importControl("Interviews")}<button className="rec-secondary" onClick={()=>pageExcel(store.interviews.map(i=>({"Candidate ID":candidateById(i.candidateId)?.candidateNo||i.candidateId,"Candidate Name":candidateById(i.candidateId)?.name,"Round":i.round,"Date":i.date,"Time":i.time,"Mode":i.mode,"Panel":i.panel,"Coordinator":i.coordinator,"Location":i.location,"Meeting Link":i.meetingLink,"Status":i.status})),"HRSYNC_Interviews_Export.xlsx","Interviews")}>↓ Export Excel</button><button className="rec-primary" onClick={()=>setInterviewModal(true)}>＋ Schedule Interview</button></div></div><div className="rec-feature-metrics"><div className="rec-feature-metric blue"><span>◷</span><div><small>Scheduled</small><strong>{store.interviews.filter(i=>i.status==="Scheduled").length}</strong><em>Upcoming interview rounds</em></div></div><div className="rec-feature-metric amber"><span>◌</span><div><small>Feedback Pending</small><strong>{store.interviews.filter(i=>i.status==="Feedback Pending"||i.status==="Completed"&&!i.feedback?.recommendation).length}</strong><em>Rounds awaiting a decision</em></div></div><div className="rec-feature-metric green"><span>✓</span><div><small>Completed</small><strong>{store.interviews.filter(i=>i.status==="Completed").length}</strong><em>Feedback recorded</em></div></div><div className="rec-feature-metric red"><span>!</span><div><small>No Show</small><strong>{store.interviews.filter(i=>i.status==="No Show").length}</strong><em>Candidate did not attend</em></div></div></div><div className="rec-card rec-feature-card"><div className="rec-card-head"><div><span className="rec-eyebrow">INTERVIEW MANAGEMENT</span><h3>Interview Schedule</h3><p>Candidate, panel, mode and feedback progress in one place.</p></div><button className="rec-primary" onClick={()=>setInterviewModal(true)}>＋ Schedule Interview</button></div><div className="rec-interview-grid">{store.interviews.sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((i)=>{const c=candidateById(i.candidateId);return <div className="rec-interview-card" key={i.id}><div className="rec-interview-top"><span>{i.round}</span><StatusBadge>{i.status}</StatusBadge></div><h4>{c?.name||i.candidateId}</h4><p>{c?.currentDesignation||"Candidate"} · {c?.mobile||""}</p><div className="rec-interview-meta"><span>◷ {formatDate(i.date)} · {i.time}</span><span>⌁ {i.mode} {i.location||i.meetingLink||""}</span><span>♙ {i.panel||"Panel not assigned"}</span><span>Coordinator: {i.coordinator||"—"}</span></div><div className="rec-interview-actions">{i.mode==="Online"&&i.meetingLink&&<a href={i.meetingLink} target="_blank" rel="noreferrer">Meeting ↗</a>}<button onClick={()=>openCandidate(c,"Interview")}>Candidate</button><button onClick={()=>openFeedback(i)}>Feedback</button></div></div>})}{!store.interviews.length&&<div className="rec-empty">No interviews scheduled yet.</div>}</div></div></div>;
  const renderSelectionMapping = () => <div className="rec-detail-page"><div className="rec-feature-hero mapping"><div><span className="rec-eyebrow">SELECTION CONTROL</span><h2>Selection & Experience Mapping</h2><p>Verify employment history and supporting documents before a candidate moves to offer-ready.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageTemplate(["Candidate ID","Candidate Name","Mapping Status","Certificate Status","Relevant Experience","Verified By","Notes"],"HRSYNC_Experience_Mapping_Template.xlsx","Mapping Import")}>↓ Template</button>{importControl("Selection & Mapping")}<button className="rec-secondary" onClick={()=>pageExcel(store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).map(c=>({"Candidate ID":c.candidateNo||c.id,"Candidate Name":c.name,"Requirement":requirementById(c.requirementId)?.title||c.currentDesignation,"Stage":c.stage,"Mapping Status":c.mappingStatus||"Not Started","Relevant Experience":c.relevantExperience,"Verified By":mappingByCandidate(c.id)[0]?.verifiedBy||""})),"HRSYNC_Experience_Mapping_Export.xlsx","Mapping")}>↓ Export Excel</button></div></div><div className="rec-feature-metrics"><div className="rec-feature-metric blue"><span>♙</span><div><small>Selected Candidates</small><strong>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).length}</strong><em>Ready for validation</em></div></div><div className="rec-feature-metric amber"><span>◌</span><div><small>Mapping Pending</small><strong>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)&&(!c.mappingStatus||c.mappingStatus==="Not Started")).length}</strong><em>Awaiting experience review</em></div></div><div className="rec-feature-metric green"><span>✓</span><div><small>Verified</small><strong>{store.candidates.filter(c=>c.mappingStatus==="Verified").length}</strong><em>Ready to move forward</em></div></div><div className="rec-feature-metric red"><span>!</span><div><small>Mismatch</small><strong>{store.candidates.filter(c=>c.mappingStatus==="Mismatch").length}</strong><em>Needs HR attention</em></div></div></div><div className="rec-card rec-feature-card"><div className="rec-card-head"><div><span className="rec-eyebrow">SELECTION CONTROL</span><h3>Experience Verification Queue</h3><p>Compare CV experience, submitted documents and HR validation in one workflow.</p></div></div><div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Candidate</th><th>Requirement</th><th>Stage</th><th>Mapping</th><th>Certificate</th><th>Relevant Exp.</th><th>Verified By</th><th>Action</th></tr></thead><tbody>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).map(c=>{const mappings=mappingByCandidate(c.id);const latest=mappings[0];return <tr key={c.id}><td><button className="rec-table-link" onClick={()=>openCandidate(c,"Mapping")}><strong>{c.name}</strong><small>{c.candidateNo||c.id}</small></button></td><td>{requirementById(c.requirementId)?.title||c.currentDesignation||"—"}</td><td><StatusBadge>{c.stage}</StatusBadge></td><td><StatusBadge>{latest?.mappingStatus||c.mappingStatus||"Not Started"}</StatusBadge></td><td>{latest?.certificateStatus||"Pending Certificate"}</td><td>{latest?.relevantExperience||c.relevantExperience||"—"}</td><td>{latest?.verifiedBy||"—"}</td><td><button className="rec-inline-action" onClick={()=>openMappingForCandidate(c)}>Update Mapping</button></td></tr>})}</tbody></table></div></div></div>;
  const renderDocumentsBGV = () => <div className="rec-detail-page"><div className="rec-feature-hero documents"><div><span className="rec-eyebrow">DOCUMENT CONTROL</span><h2>Documents & BGV</h2><p>Keep pre-joining documents, verification status and follow-ups under control.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageTemplate(["Candidate ID","Candidate Name","Document Type","Document Status","BGV Status","Agency","Reference No","Submitted Date","Notes"],"HRSYNC_Documents_BGV_Template.xlsx","Documents Import")}>↓ Template</button>{importControl("Documents & BGV")}<button className="rec-secondary" onClick={()=>pageExcel(store.candidates.filter(c=>!["New","Rejected","Withdrawn"].includes(c.stage)).map(c=>({"Candidate ID":c.candidateNo||c.id,"Candidate Name":c.name,"Stage":c.stage,"Documents Pending":getDocumentSummary(c.id).pending,"BGV Status":bgvByCandidate(c.id)?.status||"Not Initiated","Agency":bgvByCandidate(c.id)?.agency||"","Reference No":bgvByCandidate(c.id)?.referenceNo||""})),"HRSYNC_Documents_BGV_Export.xlsx","Documents BGV")}>↓ Export Excel</button><button className="rec-primary" onClick={()=>setBgvModal(true)}>＋ Start BGV</button></div></div><div className="rec-feature-metrics"><div className="rec-feature-metric blue"><span>▤</span><div><small>In Document Control</small><strong>{store.candidates.filter(c=>!["New","Rejected","Withdrawn"].includes(c.stage)).length}</strong><em>Candidates requiring records</em></div></div><div className="rec-feature-metric amber"><span>◌</span><div><small>Documents Pending</small><strong>{stats.docsPending}</strong><em>Mandatory document follow-up</em></div></div><div className="rec-feature-metric purple"><span>◷</span><div><small>BGV In Progress</small><strong>{store.bgv.filter(b=>["Initiated","Documents Awaited","Submitted","In Progress"].includes(b.status)).length}</strong><em>Agency / HR verification</em></div></div><div className="rec-feature-metric green"><span>✓</span><div><small>BGV Clear</small><strong>{store.bgv.filter(b=>b.status==="Clear").length}</strong><em>Ready for offer workflow</em></div></div></div><div className="rec-card rec-feature-card"><div className="rec-card-head"><div><span className="rec-eyebrow">DOCUMENT CONTROL</span><h3>Document & Background Check Queue</h3><p>Review document availability, verification progress and next required action.</p></div><div className="rec-head-actions"><button className="rec-secondary" onClick={()=>setBgvModal(true)}>＋ BGV</button></div></div><div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Candidate</th><th>Stage</th><th>Documents</th><th>Pending</th><th>BGV</th><th>Last Follow-up</th><th>Next Action</th><th>Action</th></tr></thead><tbody>{store.candidates.filter(c=>!["New","Rejected","Withdrawn"].includes(c.stage)).map(c=>{const d=getDocumentSummary(c.id);const b=bgvByCandidate(c.id);return <tr key={c.id}><td><button className="rec-table-link" onClick={()=>openCandidate(c,"Documents & BGV")}><strong>{c.name}</strong><small>{c.candidateNo||c.id}</small></button></td><td><StatusBadge>{c.stage}</StatusBadge></td><td><StatusBadge>{d.pending===0?"Complete":"Pending"}</StatusBadge><span className="rec-sub">{d.verified}/{d.total} verified</span></td><td>{d.pending}</td><td><StatusBadge>{b?.status||"Not Initiated"}</StatusBadge></td><td>{formatDate(c.followUpDate)}</td><td>{c.nextAction||"Follow up"}<span className="rec-sub">{formatDate(c.nextActionDate)}</span></td><td><button className="rec-inline-action" onClick={()=>openCandidate(c,"Documents & BGV")}>Manage</button><button className="rec-inline-action" onClick={()=>{setBgvForm(b?{...EMPTY_BGV,...b}:{...EMPTY_BGV,candidateId:c.id});setBgvModal(true);}}>BGV</button></td></tr>})}</tbody></table></div></div></div>;
  const renderOffersJoining = () => <div className="rec-detail-page"><div className="rec-feature-hero offers"><div><span className="rec-eyebrow">OFFER & ONBOARDING</span><h2>Offers & Joining</h2><p>Create offers, confirm joining dates and hand joined candidates to Employee Master.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageTemplate(["Candidate ID","Candidate Name","Offer Number","Designation","Department","CTC","Offer Status","Offer Date","Expected DOJ","Actual DOJ","Project / Site","Joining Status"],"HRSYNC_Offers_Joining_Template.xlsx","Offers Joining Import")}>↓ Template</button>{importControl("Offers & Joining")}<button className="rec-secondary" onClick={()=>pageExcel(store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).map(c=>({"Candidate ID":c.candidateNo||c.id,"Candidate Name":c.name,"Designation":offerByCandidate(c.id)?.designation||c.currentDesignation,"Department":offerByCandidate(c.id)?.department||c.department,"CTC":offerByCandidate(c.id)?.ctc||c.expectedCtc,"Offer Number":offerByCandidate(c.id)?.offerNumber||"","Offer Status":offerByCandidate(c.id)?.status||"Not Started","Offer Date":offerByCandidate(c.id)?.issueDate||"","Expected DOJ":joiningByCandidate(c.id)?.expectedDate||offerByCandidate(c.id)?.joiningDate||"","Actual DOJ":joiningByCandidate(c.id)?.actualDate||"","Project / Site":joiningByCandidate(c.id)?.location||offerByCandidate(c.id)?.location||"","Joining Status":joiningByCandidate(c.id)?.status||"Not Started"})),"HRSYNC_Offers_Joining_Export.xlsx","Offers Joining")}>↓ Export Excel</button><button className="rec-primary" onClick={()=>setOfferModal(true)}>＋ Offer</button><button className="rec-primary" onClick={()=>setJoiningModal(true)}>＋ Joining</button></div></div><div className="rec-feature-metrics"><div className="rec-feature-metric blue"><span>♙</span><div><small>Offer-ready Candidates</small><strong>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).length}</strong><em>Selected through joining pipeline</em></div></div><div className="rec-feature-metric amber"><span>◌</span><div><small>Offer Follow-up</small><strong>{store.offers.filter(o=>["Draft","Released","Pending","Not Started"].includes(o.status)).length}</strong><em>Offer pending or not accepted</em></div></div><div className="rec-feature-metric orange"><span>◷</span><div><small>Joining Due</small><strong>{next7DayJoiningsCount}</strong><em>Expected / confirmed dates</em></div></div><div className="rec-feature-metric green"><span>✓</span><div><small>Joined</small><strong>{stats.joined}</strong><em>Ready for employee handoff</em></div></div></div><div className="rec-card rec-feature-card"><div className="rec-card-head"><div><span className="rec-eyebrow">OFFER & ONBOARDING</span><h3>Offer & Joining Control</h3><p>Monitor offer status, joining confirmation and employee handoff readiness.</p></div><div className="rec-head-actions"><button className="rec-secondary" onClick={()=>setOfferModal(true)}>＋ Offer</button><button className="rec-primary" onClick={()=>setJoiningModal(true)}>＋ Joining</button></div></div><div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Candidate</th><th>Designation</th><th>Category</th><th>CTC</th><th>Offer</th><th>Joining</th><th>Expected</th><th>Action</th></tr></thead><tbody>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).map(c=>{const o=offerByCandidate(c.id);const j=joiningByCandidate(c.id);return <tr key={c.id}><td><button className="rec-table-link" onClick={()=>openCandidate(c,"Offer")}><strong>{c.name}</strong><small>{c.candidateNo||c.id}</small></button></td><td>{o?.designation||c.currentDesignation||"—"}</td><td>{c.category}</td><td>{money(o?.ctc)}</td><td><StatusBadge>{o?.status||"Not Started"}</StatusBadge></td><td><StatusBadge>{j?.status||"Not Started"}</StatusBadge></td><td>{formatDate(j?.expectedDate||o?.joiningDate)}</td><td><div className="rec-table-actions"><button className="rec-inline-action" onClick={()=>openOfferForCandidate(c)}>Offer</button><button className="rec-inline-action" onClick={()=>{setJoiningForm(j?{...EMPTY_JOINING,...j}:{...EMPTY_JOINING,candidateId:c.id,expectedDate:o?.joiningDate||"",location:o?.location||"",reportingManager:o?.reportingManager||""});setJoiningModal(true);}}>Joining</button>{c.stage==="Joined"&&<button className="rec-inline-action approve" onClick={()=>completeEmployeeConversion(c)}>Employee</button>}<button className="rec-inline-action" onClick={()=>openLetter("Offer Letter",c.id)}>Offer Letter</button>{c.stage === "Joined" && <button className="rec-inline-action" onClick={()=>openLetter("Appointment Letter",c.id)}>Appointment</button>}</div></td></tr>})}</tbody></table>{!store.candidates.some(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage))&&<div className="rec-empty">No selected / joining candidates.</div>}</div></div></div>;
  const renderLetters = () => <div className="rec-detail-page"><div className="rec-feature-hero letters"><div><span className="rec-eyebrow">HR DOCUMENTS</span><h2>Letters & Templates</h2><p>Maintain approved letter formats and generate candidate or employee documents quickly.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageTemplate(["Template ID","Template Name","Letter Type","Subject","Body Template","Footer Text","Active"],"HRSYNC_Letters_Template.xlsx","Letters Templates")}>↓ Template</button><label className="rec-secondary rec-upload-button">↑ Import Templates<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{pageImport(e.target.files?.[0],"Letters");e.target.value="";}}/></label><button className="rec-secondary" onClick={()=>pageExcel(store.letterTemplates.map(t=>({"Template ID":t.id,"Template Name":t.name,"Letter Type":t.type,"Subject":t.subject,"Body Template":t.bodyTemplate,"Footer Text":t.footerText,"Active":t.active})),"HRSYNC_Letter_Templates_Export.xlsx","Templates")}>↓ Export Templates</button><button className="rec-secondary" onClick={()=>pageExcel(store.letters.map(l=>({"Letter ID":l.id,"Letter Type":l.type,"Candidate ID":l.candidateId,"Candidate Name":candidateById(l.candidateId)?.name||"","Issue Date":l.issueDate,"Subject":l.subject,"Status":l.status||"Generated"})),"HRSYNC_Generated_Letters_Export.xlsx","Generated Letters")}>↓ Export Letters</button><button className="rec-primary" onClick={()=>{setTemplateForm(DEFAULT_LETTER_TEMPLATES[0]);setTemplateModal(true);}}>＋ New Template</button></div></div><div className="rec-feature-metrics"><div className="rec-feature-metric blue"><span>▤</span><div><small>Active Templates</small><strong>{store.letterTemplates.filter(t=>t.active).length}</strong><em>Available fixed formats</em></div></div><div className="rec-feature-metric amber"><span>→</span><div><small>Offer Letters</small><strong>{store.letters.filter(l=>l.type==="Offer Letter").length}</strong><em>Generated offer documents</em></div></div><div className="rec-feature-metric green"><span>✓</span><div><small>Appointment Letters</small><strong>{store.letters.filter(l=>l.type==="Appointment Letter").length}</strong><em>Employee onboarding</em></div></div><div className="rec-feature-metric purple"><span>◷</span><div><small>Total Issued</small><strong>{store.letters.length}</strong><em>All generated letters</em></div></div></div><div className="rec-card rec-feature-card"><div className="rec-card-head"><div><span className="rec-eyebrow">HR DOCUMENTS</span><h3>Letters & Templates</h3><p>Keep fixed letterhead and fixed text templates here. Candidate/employee fields are merged automatically.</p></div><div className="rec-head-actions"><button className="rec-secondary" onClick={()=>{setTemplateForm(DEFAULT_LETTER_TEMPLATES[0]);setTemplateModal(true);}}>＋ New Template</button></div></div><div className="rec-letter-type-grid">{LETTER_TYPES.map((type)=><div className="rec-letter-type-card" key={type}><span className="rec-eyebrow">{type.replace(" Letter","")}</span><h4>{type}</h4><p>{type==="Offer Letter"?"Generate directly from selected / joining candidate details.":type==="Appointment Letter"?"Generate after joining using employee and joining details.":"Generate after approved exit / termination decision."}</p><button className="rec-primary" onClick={()=>openLetter(type)}>Generate {type}</button></div>)}</div><div className="rec-grid-2"><div className="rec-card nested"><div className="rec-card-head"><div><span className="rec-eyebrow">TEMPLATES</span><h3>Fixed Letter Formats</h3></div></div>{store.letterTemplates.map(t=><div className="rec-setting-row" key={t.id}><span><b>{t.name}</b><small>{t.type} · {t.letterheadImage?"Letterhead uploaded":"No letterhead uploaded"}</small></span><div className="rec-table-actions"><StatusBadge>{t.active?"Active":"Inactive"}</StatusBadge><button className="rec-inline-action" onClick={()=>{setTemplateForm({...t});setTemplateModal(true);}}>Edit</button></div></div>)}</div><div className="rec-card nested"><div className="rec-card-head"><div><span className="rec-eyebrow">GENERATED LETTERS</span><h3>Issue History</h3></div></div>{store.letters.slice(0,10).map(l=><div className="rec-setting-row" key={l.id}><span><b>{l.type} · {candidateById(l.candidateId)?.name||l.candidateId}</b><small>{formatDate(l.issueDate)} · {l.id}</small></span><button className="rec-inline-action" onClick={()=>{setLetterForm(l);setLetterModal(true);}}>Open</button></div>)}{!store.letters.length&&<div className="rec-empty">No letters generated yet.</div>}</div></div></div></div>;
  const renderReports = () => {
    const sourceCounts=SOURCES.map(s=>[s,store.candidates.filter(c=>c.source===s).length]).filter(([,n])=>n);
    const stageCounts=CANDIDATE_STAGES.map(s=>[s,store.candidates.filter(c=>c.stage===s).length]).filter(([,n])=>n);
    const catCounts=recruitmentCategories.map((item)=>[item.name,store.candidates.filter(c=>c.category===item.name).length]).filter(([,n])=>n);
    const mappingRows=store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage));
    const documentRows=store.candidates.filter(c=>!["New","Rejected","Withdrawn"].includes(c.stage));
    const offerRows=store.offers;
    const joiningRows=store.joinings;
    const reportRows=store.candidates.map(c=>({"Candidate ID":c.candidateNo||c.id,"Candidate Name":c.name,"Stage":c.stage,"Category":c.category,"Source":c.source,"Requirement":requirementById(c.requirementId)?.title||c.currentDesignation,"Department":requirementById(c.requirementId)?.department||c.department,"Site":requirementById(c.requirementId)?.location||c.location,"Mapping":c.mappingStatus||"Not Started","Documents Pending":getDocumentSummary(c.id).pending,"BGV":bgvByCandidate(c.id)?.status||"Not Initiated","Offer":offerByCandidate(c.id)?.status||"Not Started","Joining":joiningByCandidate(c.id)?.status||"Not Started","Expected DOJ":joiningByCandidate(c.id)?.expectedDate||offerByCandidate(c.id)?.joiningDate||"","Actual DOJ":joiningByCandidate(c.id)?.actualDate||""}));
    return <div className="rec-detail-page"><div className="rec-feature-hero reports"><div><span className="rec-eyebrow">RECRUITMENT ANALYTICS</span><h2>Reports & MIS</h2><p>View pipeline health, hiring demand, source performance and export complete recruitment MIS.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageExcel(reportRows,"HRSYNC_Recruitment_Candidate_MIS.xlsx","Candidate MIS")}>↓ Export Candidate MIS</button><button className="rec-primary" onClick={()=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(reportRows.length?reportRows:[{}]),"Candidate MIS");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(store.requirements.map(r=>({"Requirement ID":r.requirementNo||r.id,"Position":r.title,"Department":r.department,"Site":r.location,"Required":r.vacancies,"Candidates Added":store.candidates.filter(c=>candidateHasRequirement(c,r.id)).length,"Selected / Advanced":store.candidates.filter(c=>candidateHasRequirement(c,r.id)&&REQUIREMENT_VISIBLE_STAGES.includes(c.stage)).length,"Open Vacancies":Math.max(0,Number(r.vacancies||0)-store.candidates.filter(c=>candidateHasRequirement(c,r.id)&&REQUIREMENT_VISIBLE_STAGES.includes(c.stage)).length),"Status":r.status,"Target Date":r.targetDate}))),"Requirements");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(store.interviews.map(i=>({"Candidate":candidateById(i.candidateId)?.name,"Round":i.round,"Date":i.date,"Status":i.status,"Panel":i.panel}))),"Interviews");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(store.offers.map(o=>({"Candidate":candidateById(o.candidateId)?.name,"Offer No":o.offerNumber,"Status":o.status,"CTC":o.ctc,"Joining Date":o.joiningDate}))),"Offers");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(store.joinings.map(j=>({"Candidate":candidateById(j.candidateId)?.name,"Expected DOJ":j.expectedDate,"Actual DOJ":j.actualDate,"Status":j.status,"Location":j.location}))),"Joinings");XLSX.writeFile(wb,"HRSYNC_Recruitment_Complete_MIS.xlsx",{compression:true});}}>↓ Export Complete MIS</button></div></div><div className="rec-feature-metrics"><div className="rec-feature-metric blue"><span>♙</span><div><small>Total Candidates</small><strong>{store.candidates.length}</strong><em>All recruitment records</em></div></div><div className="rec-feature-metric green"><span>✓</span><div><small>Selected</small><strong>{stats.selected}</strong><em>Selection and offer pipeline</em></div></div><div className="rec-feature-metric amber"><span>◷</span><div><small>Joining Due</small><strong>{next7DayJoiningsCount}</strong><em>Expected / confirmed joining</em></div></div><div className="rec-feature-metric orange"><span>▣</span><div><small>Open Positions</small><strong>{openPositions}</strong><em>Vacancy demand remaining</em></div></div></div><div className="rec-report-grid">
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">ANALYTICS</span><h3>Recruitment Performance</h3></div></div><div className="rec-kpi-report">{[["Total Candidates",store.candidates.length],["Interviewed",store.candidates.filter(c=>["Interviewed","Selected","Rejected","Hold","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).length],["Selection",stats.selected],["Offers",offerRows.length],["Joined",stats.joined],["Rejected",stats.rejected]].map(([l,v])=><div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div></div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">SOURCE PERFORMANCE</span><h3>Candidate Source Analysis</h3></div></div>{sourceCounts.length?sourceCounts.map(([l,n])=>{const selected=store.candidates.filter(c=>c.source===l&&["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).length;const joined=store.candidates.filter(c=>c.source===l&&c.stage==="Joined").length;return <div className="rec-report-row" key={l}><span>{l}<small>{n} candidates · {selected} selected · {joined} joined</small></span><b>{n?Math.round((joined/n)*100):0}%</b></div>}):<div className="rec-empty">No source data.</div>}</div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">PIPELINE ANALYSIS</span><h3>Stage Distribution</h3></div></div>{stageCounts.length?stageCounts.map(([l,n])=><div className="rec-report-row" key={l}><span>{l}</span><b>{n}</b></div>):<div className="rec-empty">No pipeline data.</div>}</div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">CATEGORY ANALYSIS</span><h3>Workforce Category</h3></div></div>{catCounts.map(([l,n])=><div className="rec-report-row" key={l}><span>{l}</span><b>{n}</b></div>)}</div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">EXPERIENCE MAPPING</span><h3>Mapping Control</h3></div></div>{[["Not Started",mappingRows.filter(c=>!c.mappingStatus||c.mappingStatus==="Not Started").length],["In Progress",mappingRows.filter(c=>c.mappingStatus==="In Progress").length],["Verified",mappingRows.filter(c=>c.mappingStatus==="Verified").length],["Mismatch",mappingRows.filter(c=>c.mappingStatus==="Mismatch").length]].map(([l,n])=><div className="rec-report-row" key={l}><span>{l}</span><b>{n}</b></div>)}</div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">DOCUMENTS / BGV</span><h3>Document & BGV Control</h3></div></div>{[["Documents Pending",documentRows.filter(c=>getDocumentSummary(c.id).pending>0).length],["BGV Not Initiated",documentRows.filter(c=>!bgvByCandidate(c.id)).length],["BGV In Progress",store.bgv.filter(b=>["Initiated","Documents Awaited","Submitted","In Progress"].includes(b.status)).length],["BGV Clear",store.bgv.filter(b=>b.status==="Clear").length],["BGV Discrepancy",store.bgv.filter(b=>b.status==="Discrepancy").length]].map(([l,n])=><div className="rec-report-row" key={l}><span>{l}</span><b>{n}</b></div>)}</div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">OFFER REPORT</span><h3>Offer Status</h3></div></div>{OFFER_STATUSES.map(status=>{const n=offerRows.filter(o=>o.status===status).length;return <div className="rec-report-row" key={status}><span>{status}</span><b>{n}</b></div>})}</div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">JOINING REPORT</span><h3>Joining Status</h3></div></div>{JOINING_STATUSES.map(status=>{const n=joiningRows.filter(j=>j.status===status).length;return <div className="rec-report-row" key={status}><span>{status}</span><b>{n}</b></div>})}</div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">HIRING DEMAND</span><h3>Open Requirements</h3></div></div>{activeRequirements.length?activeRequirements.map(r=><div className="rec-report-row" key={r.id}><span>{r.title}<small>{r.department} · {r.location||"—"} · {r.category||"—"}</small></span><b>{r.vacancies}</b></div>):<div className="rec-empty">No open requirements.</div>}</div>
      <div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">UPCOMING JOININGS</span><h3>Joining Control</h3></div></div>{joiningRows.filter(j=>j.expectedDate&&j.status!=="Joined").sort((a,b)=>a.expectedDate.localeCompare(b.expectedDate)).slice(0,10).map(j=><div className="rec-report-row" key={j.id}><span>{candidateById(j.candidateId)?.name||j.candidateId}<small>{formatDate(j.expectedDate)} · {j.location||"—"}</small></span><b>{j.status}</b></div>)}{!joiningRows.length&&<div className="rec-empty">No joining records.</div>}</div>
    </div></div>;
  };

  const renderSettings = () => <div className="rec-detail-page"><div className="rec-feature-hero settings"><div><span className="rec-eyebrow">CONFIGURATION</span><h2>Recruitment Settings</h2><p>Manage recruitment controls, integrations, SLAs and operational rules.</p></div><div className="rec-feature-hero-actions"><button className="rec-secondary" onClick={()=>pageExcel([{Setting:"Candidate Sources",Values:SOURCES.join(" | ")},{Setting:"Candidate Stages",Values:CANDIDATE_STAGES.join(" | ")},{Setting:"Interview Rounds",Values:INTERVIEW_ROUNDS.join(" | ")},{Setting:"Document Types",Values:DOCUMENT_TYPES.join(" | ")},{Setting:"Letter Types",Values:LETTER_TYPES.join(" | ")}],"HRSYNC_Recruitment_Settings_Export.xlsx","Settings")}>↓ Export Settings</button></div></div><div className="rec-feature-metrics"><div className="rec-feature-metric blue"><span>♙</span><div><small>Candidate Sources</small><strong>{SOURCES.length}</strong><em>Configured sourcing channels</em></div></div><div className="rec-feature-metric purple"><span>✓</span><div><small>Candidate Stages</small><strong>{CANDIDATE_STAGES.length}</strong><em>Pipeline options</em></div></div><div className="rec-feature-metric amber"><span>◷</span><div><small>Interview Rounds</small><strong>{INTERVIEW_ROUNDS.length}</strong><em>Round types configured</em></div></div><div className="rec-feature-metric green"><span>▤</span><div><small>Document Types</small><strong>{DOCUMENT_TYPES.length}</strong><em>Mandatory and optional</em></div></div></div><div className="rec-settings-grid"><div className="rec-card"><span className="rec-eyebrow">MASTERS</span><h3>Recruitment Configuration</h3>{[["Candidate Sources",SOURCES.length],["Candidate Stages",CANDIDATE_STAGES.length],["Interview Rounds",INTERVIEW_ROUNDS.length],["Document Types",DOCUMENT_TYPES.length],["Letter Types",LETTER_TYPES.length]].map(([l,v])=><div className="rec-setting-row" key={l}><span>{l}</span><b>{v}</b></div>)}</div><div className="rec-card"><span className="rec-eyebrow">INTEGRATION</span><h3>HRMS Connections</h3><div className="rec-integration"><span>Employee Master</span><StatusBadge tone="connected">Connected</StatusBadge></div><div className="rec-integration"><span>Organization Masters</span><StatusBadge tone="connected">Connected</StatusBadge></div><div className="rec-integration"><span>Payroll / Policy Management</span><StatusBadge tone="ready">Ready for handoff</StatusBadge></div><div className="rec-integration"><span>Data Persistence</span><StatusBadge tone="connected">Supabase</StatusBadge></div></div><div className="rec-card"><span className="rec-eyebrow">SLA / CONTROL</span><h3>Recruitment SLA</h3><div className="rec-setting-row"><span>Interview Feedback SLA</span><b>24 hrs</b></div><div className="rec-setting-row"><span>Experience Mapping SLA</span><b>2 days</b></div><div className="rec-setting-row"><span>BGV SLA</span><b>5 days</b></div><div className="rec-setting-row"><span>Offer SLA</span><b>2 days</b></div></div><div className="rec-card"><span className="rec-eyebrow">DAILY DISCIPLINE</span><h3>Control Rules</h3><div className="rec-rule-list"><p>• Every active candidate must have exactly one current stage.</p><p>• Every active candidate must have one next action and next action date.</p><p>• Selected candidates must be mapped before offer readiness.</p><p>• Shortlisted/selected candidates must have document and BGV visibility.</p><p>• Joined candidates can be handed off to Employee Master.</p></div></div></div></div>;

  const renderCandidateDetail = () => { if (!currentCandidate) return null; const c=currentCandidate; const req=requirementById(c.requirementId); const offer=offerByCandidate(c.id); const joining=joiningByCandidate(c.id); const bgv=bgvByCandidate(c.id); const docs=documentsByCandidate(c.id); const maps=mappingByCandidate(c.id); const interviews=store.interviews.filter(i=>i.candidateId===c.id); return <Modal title={`${c.name} · ${c.candidateNo||c.id}`} onClose={()=>setCandidateDetail(null)} wide><div className="rec-profile-head"><div className="rec-avatar large">{initials(c.name)}</div><div><h3>{c.name}</h3><p>{c.currentDesignation||req?.title||"Candidate"} · {req?.department||"—"} · {req?.location||c.location||"—"}</p><div className="rec-profile-badges"><StatusBadge>{c.stage}</StatusBadge><StatusBadge>{c.category}</StatusBadge><span className="rec-sub">Owner: {c.owner||c.recruiter||"—"}</span></div></div><div className="rec-profile-actions"><button className="rec-secondary" onClick={()=>openEditCandidate(c)}>Edit Details</button><button className="rec-primary" onClick={()=>openOfferForCandidate(c)}>Offer</button><button className="rec-secondary" onClick={()=>openLetter("Offer Letter",c.id)}>Offer Letter</button></div></div><div className="rec-profile-tabs">{["Overview","Interview","Mapping","Documents & BGV","Offer","Joining","Activity"].map(t=><button key={t} className={activeCandidateTab===t?"active":""} onClick={()=>setActiveCandidateTab(t)}>{t}</button>)}</div>{activeCandidateTab==="Overview"&&<div className="rec-detail-grid"><div className="rec-detail-section"><h4>Candidate</h4><Info label="Mobile" value={c.mobile}/><Info label="Email" value={c.email}/><Info label="Current Company" value={c.currentCompany}/><Info label="Current Designation" value={c.currentDesignation}/><Info label="Current Department" value={c.department}/><Info label="Current Location" value={c.location}/><Info label="Preferred Location" value={c.preferredLocation}/><Info label="Total Experience" value={c.totalExperience}/><Info label="Relevant Experience" value={c.relevantExperience}/><Info label="Qualification" value={c.qualification}/><Info label="Skills" value={c.skills}/><Info label="Updated CV" value={c.updatedCvName || "Missing"}/></div><div className="rec-detail-section"><h4>Recruitment</h4><Info label="Requirement" value={candidateRequirementLabels(c)||c.requirementId||"Not assigned"}/><Info label="Source" value={`${c.source}${c.consultant?` · ${c.consultant}`:""}`}/><Info label="Recruiter" value={c.recruiter}/><Info label="Category" value={c.category}/><Info label="Current CTC" value={c.currentCtc}/><Info label="Expected CTC" value={c.expectedCtc}/><Info label="Notice Period" value={c.noticePeriod}/><Info label="Next Action" value={`${c.nextAction||"—"} · ${formatDate(c.nextActionDate)}`}/></div></div>}{activeCandidateTab==="Interview"&&<div><div className="rec-detail-toolbar"><button className="rec-primary" onClick={()=>{setInterviewForm({...EMPTY_INTERVIEW,candidateId:c.id});setInterviewModal(true);}}>＋ Schedule Round</button></div>{interviews.map(i=><div className="rec-detail-list-row" key={i.id}><div><b>{i.round}</b><span>{formatDate(i.date)} · {i.time} · {i.mode}</span></div><StatusBadge>{i.status}</StatusBadge><button className="rec-inline-action" onClick={()=>openFeedback(i)}>Feedback</button></div>)}{!interviews.length&&<div className="rec-empty">No interview rounds.</div>}</div>}{activeCandidateTab==="Mapping"&&<div><div className="rec-detail-toolbar"><button className="rec-primary" onClick={()=>openMappingForCandidate(c)}>✎ Open / Update Mapping</button>{maps.length>0&&<button className="rec-secondary" onClick={()=>exportExperienceMapping(c)}>↓ Export Mapping Excel</button>}</div>{(()=>{const summary=getMappingSummary(c.id);return <div className="rec-mapping-summary-grid"><div><span>CV Experience</span><b>{summary.cvExperience}</b></div><div><span>Document Supported</span><b>{summary.documentExperience}</b></div><div><span>Difference</span><b>{monthsToYearsMonths(Math.max(0,summary.cvMonths-summary.documentMonths))}</b></div><div><span>Rows</span><b>{maps.length}</b></div></div>})()}<div className="rec-mapping-preview-table"><table className="rec-table"><thead><tr><th>Company / Qualification</th><th>Designation as per CV</th><th>Designation as per Documents</th><th>Period as per CV</th><th>Period as per Documents</th><th>Document</th><th>Status</th></tr></thead><tbody>{maps.map(m=><tr key={m.id}><td>{m.company||m.qualification||"—"}</td><td>{m.designationAsPerCV||m.designation||"—"}</td><td>{m.designationAsPerDocuments||"—"}</td><td>{m.periodAsPerCV||mappingPeriodLabel(m.fromDate,m.toDate)}</td><td>{m.periodAsPerDocuments||mappingPeriodLabel(m.documentFromDate,m.documentToDate)}</td><td>{m.documentAvailable||"No document provided"}</td><td><StatusBadge>{m.comparisonStatus||m.mappingStatus}</StatusBadge></td></tr>)}</tbody></table></div>{!maps.length&&<div className="rec-empty">Experience mapping not started.</div>}</div>}{activeCandidateTab==="Documents & BGV"&&<div className="rec-detail-grid"><div className="rec-detail-section"><div className="rec-required-doc-banner"><b>Mandatory:</b> Updated CV must be attached. All other documents below are optional unless your internal process makes them required.</div><h4>Mandatory Document</h4>{MANDATORY_DOCUMENT_TYPES.map(type=>{const d=docs.find(x=>x.type===type);return <div className="rec-document-row mandatory" key={type}><span><b>{type}</b><small>Required for candidate progression</small></span><StatusBadge>{d?.status||"Missing"}</StatusBadge><label className="rec-file-mini">Upload<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e)=>handleDocumentFile(c.id,type,e.target.files?.[0])} /></label>{d?.fileData&&<button type="button" className="rec-inline-action" onClick={()=>downloadDocument(d)}>View</button>}</div>})}<h4 className="rec-optional-doc-heading">Additional / Optional Documents</h4>{OPTIONAL_DOCUMENT_TYPES.map(type=>{const d=docs.find(x=>x.type===type);return <div className="rec-document-row" key={type}><span>{type}<small>Optional</small></span><StatusBadge>{d?.status||"Not Uploaded"}</StatusBadge><label className="rec-file-mini">Upload<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e)=>handleDocumentFile(c.id,type,e.target.files?.[0])} /></label>{d?.fileData&&<button type="button" className="rec-inline-action" onClick={()=>downloadDocument(d)}>View</button>}</div>})}</div><div className="rec-detail-section"><h4>Background Verification</h4><Info label="Status" value={bgv?.status||"Not Initiated"}/><Info label="Agency" value={bgv?.agency||"—"}/><Info label="Reference" value={bgv?.referenceNo||"—"}/><Info label="Submitted" value={formatDate(bgv?.submittedDate)}/><button className="rec-primary" onClick={()=>{setBgvForm(bgv?{...EMPTY_BGV,...bgv}:{...EMPTY_BGV,candidateId:c.id});setBgvModal(true);}}>Update BGV</button></div></div>}{activeCandidateTab==="Offer"&&<div className="rec-detail-section"><h4>Offer</h4><Info label="Status" value={offer?.status||"Not Started"}/><Info label="Offer No." value={offer?.offerNumber||"—"}/><Info label="Designation" value={offer?.designation||"—"}/><Info label="Department" value={offer?.department||"—"}/><Info label="CTC" value={money(offer?.ctc)}/><Info label="Joining" value={formatDate(offer?.joiningDate)}/><div className="rec-detail-toolbar"><button className="rec-primary" onClick={()=>openOfferForCandidate(c)}>Create / Update Offer</button><button className="rec-secondary" onClick={()=>openLetter("Offer Letter",c.id)}>Generate Offer Letter</button></div></div>}{activeCandidateTab==="Joining"&&<div className="rec-detail-section"><h4>Joining Control</h4><Info label="Status" value={joining?.status||"Not Started"}/><Info label="Expected Date" value={formatDate(joining?.expectedDate||offer?.joiningDate)}/><Info label="Actual Date" value={formatDate(joining?.actualDate)}/><Info label="Location" value={joining?.location||offer?.location||"—"}/><div className="rec-detail-toolbar"><button className="rec-primary" onClick={()=>{setJoiningForm(joining?{...EMPTY_JOINING,...joining}:{...EMPTY_JOINING,candidateId:c.id,expectedDate:offer?.joiningDate||""});setJoiningModal(true);}}>{joining?"Update Joining":"Add Joining"}</button>{c.stage==="Joined"&&<button className="rec-secondary" onClick={()=>completeEmployeeConversion(c)}>Employee Master Handoff</button>}</div></div>}{activeCandidateTab==="Activity"&&<div>{store.activities.filter(a=>a.candidateId===c.id).sort((a,b)=>b.at.localeCompare(a.at)).map(a=><div className="rec-timeline-row" key={a.id}><span className="rec-timeline-dot"/><div><b>{a.action}</b><span>{a.details||""}</span><small>{new Date(a.at).toLocaleString("en-IN")}</small></div></div>)}{!store.activities.some(a=>a.candidateId===c.id)&&<div className="rec-empty">No activity recorded.</div>}</div>}</Modal>; };

  const renderContent = () => { if(view==="Requirements")return renderRequirements(); if(view==="Candidate Tracker")return renderCandidates(); if(view==="Interviews")return renderInterviews(); if(view==="Selection & Mapping")return renderSelectionMapping(); if(view==="Documents & BGV")return renderDocumentsBGV(); if(view==="Offers & Joining")return renderOffersJoining(); if(view==="Letters")return renderLetters(); if(view==="Reports")return renderReports(); if(view==="Settings")return renderSettings(); return renderDashboard(); };

  if (loading) return <section className="recruitment-module"><div className="rec-loading"><div className="rec-spinner"/><h3>Loading Recruitment Control Tower</h3><p>Reading recruitment data from Supabase...</p></div></section>;

  return <section className="recruitment-module">
    <div className="rec-page-head"><div><div className="rec-eyebrow">TALENT ACQUISITION</div><h1>Recruitment Management</h1><p>Track open positions, manage candidates, monitor offers, joining and backouts.</p></div><div className="rec-page-actions"><span className="rec-save-indicator">{saving?"Saving…":"Synced"}</span><label className="rec-secondary rec-upload-button">↑ Import Excel<input type="file" accept=".xlsx,.xls" onChange={(e)=>importRecruitmentExcel(e.target.files?.[0])}/></label><button className="rec-secondary" onClick={openNewRequirement}>＋ Requirement</button><button className="rec-primary" onClick={openNewCandidate}>＋ Candidate</button></div></div>
    {loadError&&<div className="rec-error-banner">{loadError}</div>}
    <div className="rec-nav">{navItems.map(([item,icon])=><button key={item} className={view===item?"active":""} onClick={()=>setView(item)}><span>{icon}</span>{item}</button>)}</div>
    <div className={`rec-page-view rec-view-${view.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{renderContent()}</div>

    {assignmentModal&&<Modal title="Assign Candidate from Candidate Tracker" onClose={()=>{setAssignmentModal(false);setAssignmentCandidateId("");setAssignmentRequirementId("");}}><div className="rec-assignment-modal"><div className="rec-assignment-target"><span className="rec-eyebrow">TARGET REQUIREMENT</span><strong>{requirementById(assignmentRequirementId)?.title||"Requirement"}</strong><small>{requirementById(assignmentRequirementId)?.department||""} · {requirementById(assignmentRequirementId)?.requirementNo||requirementById(assignmentRequirementId)?.id||""}</small></div><label className="rec-assignment-select-label">Select an existing candidate *<select value={assignmentCandidateId} onChange={(e)=>setAssignmentCandidateId(e.target.value)}><option value="">Choose from Candidate Tracker</option>{store.candidates.map(candidate=>{const assigned=requirementById(candidate.requirementId);const assignmentText=assigned?`Already assigned: ${assigned.title}`:"Not assigned";return <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.candidateNo||candidate.id} · {assignmentText}</option>;})}</select></label>{assignmentCandidateId&&(()=>{const candidate=candidateById(assignmentCandidateId);const assigned=requirementById(candidate?.requirementId);const target=requirementById(assignmentRequirementId);const alreadyOnTarget=candidate?.requirementId===assignmentRequirementId;const canAssign=candidate?.stage!=="Joined";return <div className={`rec-assignment-notice ${alreadyOnTarget?"already":assigned?"conflict":"ready"}`}>{alreadyOnTarget?<><strong>Already assigned to this requirement</strong><p>{candidate?.name} is already linked to {target?.title}. No duplicate assignment has been created.</p></>:assigned?<><strong>Candidate already assigned to another requirement</strong><p><b>{candidate?.name}</b> is currently assigned to <b>{assigned.title}</b> ({assigned.requirementNo||assigned.id}). Reassigning will move the same Candidate Tracker record to <b>{target?.title}</b> and remove the link from the previous requirement. No duplicate candidate will be created.</p>{!canAssign&&<p>This candidate is already marked Joined and cannot be reassigned here.</p>}</>:<><strong>Candidate is available</strong><p>{candidate?.name} is not currently linked to another requirement.</p></>}{!alreadyOnTarget&&<div className="rec-assignment-actions"><button type="button" className="rec-secondary" onClick={()=>{setAssignmentCandidateId("");}}>Cancel Selection</button><button type="button" className="rec-primary" disabled={!canAssign} onClick={assignExistingCandidate}>{assigned?"Confirm Reassignment":"Assign Candidate"}</button></div>}</div>;})()}{!store.candidates.length&&<div className="rec-empty">No candidates are available yet. Add candidates in Candidate Tracker first.</div>}<div className="rec-assignment-footer"><button type="button" className="rec-secondary" onClick={()=>{setAssignmentModal(false);setAssignmentCandidateId("");setAssignmentRequirementId("");}}>Close</button></div></div></Modal>}

    {reqModal&&<Modal title="New Manpower Requirement" onClose={()=>setReqModal(false)} wide><form className="rec-form-grid" onSubmit={saveRequirement}><label>Position *<select value={reqForm.title} onChange={(e)=>setReqForm({...reqForm,title:e.target.value})} required><option value="">Select Position</option>{designations.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Department *<select value={reqForm.department} onChange={(e)=>setReqForm({...reqForm,department:e.target.value})} required><option value="">Select</option>{departments.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Site / Location<select value={reqForm.location} onChange={(e)=>setReqForm({...reqForm,location:e.target.value})}><option value="">Select</option>{locations.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Category Type<select value={reqForm.category} onChange={(e)=>setReqForm({...reqForm,category:e.target.value})}><option value="">Select Category Type</option>{recruitmentCategories.map((x)=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Positions Required *<input type="number" min="1" value={reqForm.vacancies} onChange={(e)=>setReqForm({...reqForm,vacancies:e.target.value})}/></label><label>Job Type<select value={reqForm.employmentType} onChange={(e)=>setReqForm({...reqForm,employmentType:e.target.value})}>{recruitmentJobTypes.map((x)=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Employee Group<select value={reqForm.employeeGroup} onChange={(e)=>setReqForm({...reqForm,employeeGroup:e.target.value})}><option value="">Select</option>{employeeGroups.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Qualification<input value={reqForm.qualification} onChange={(e)=>setReqForm({...reqForm,qualification:e.target.value})} placeholder="e.g. B.Tech Civil"/></label><label>Experience<select value={reqForm.experience} onChange={(e)=>setReqForm({...reqForm,experience:e.target.value})}><option value="">Select</option>{EXPERIENCE_OPTIONS.map(x=><option key={x}>{x} Years</option>)}</select></label><label className="full">Required Skills<input value={reqForm.skills} onChange={(e)=>setReqForm({...reqForm,skills:e.target.value})} placeholder="e.g. AutoCAD, execution, site management"/></label><div className="rec-required-upload full rec-jd-upload"><div><b>Job Description (JD) — Optional</b><span>Attach the approved JD for this position. PDF, DOC or DOCX; maximum 1.5 MB.</span>{reqForm.jdFileName&&<span className="rec-upload-file">✓ {reqForm.jdFileName}</span>}</div><label className="rec-upload-button rec-secondary">↑ {reqForm.jdFileName?"Replace JD":"Attach JD"}<input type="file" accept=".pdf,.doc,.docx" onChange={(e)=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1500000){alert("Please keep the JD file below 1.5 MB for the current Supabase settings storage.");e.target.value="";return;}const reader=new FileReader();reader.onload=()=>setReqForm(current=>({...current,jdFileName:file.name,jdFileData:String(reader.result||"")}));reader.onerror=()=>alert("Unable to read the selected JD file.");reader.readAsDataURL(file);e.target.value="";}}/></label></div><label>Min CTC (LPA)<select value={reqForm.minCtc} onChange={(e)=>setReqForm({...reqForm,minCtc:e.target.value})}><option value="">Select</option>{CTC_LPA_OPTIONS.map(x=><option key={x}>{x} LPA</option>)}</select></label><label>Max CTC (LPA)<select value={reqForm.maxCtc} onChange={(e)=>setReqForm({...reqForm,maxCtc:e.target.value})}><option value="">Select</option>{CTC_LPA_OPTIONS.map(x=><option key={x}>{x} LPA</option>)}</select></label><label>Priority<select value={reqForm.priority} onChange={(e)=>setReqForm({...reqForm,priority:e.target.value})}><option>High</option><option>Medium</option><option>Low</option></select></label><label>Target Joining Date<input type="date" value={reqForm.targetDate} onChange={(e)=>setReqForm({...reqForm,targetDate:e.target.value})}/></label><label>Hiring Manager<input value={reqForm.hiringManager} onChange={(e)=>setReqForm({...reqForm,hiringManager:e.target.value})}/></label><label>Approving HOD *<SearchableEmployeeSelect options={employeeOptions} value={reqForm.approverId} onChange={(value)=>{const e=employeeOptions.find(x=>x.id===value);setReqForm({...reqForm,approverId:e?.id||"",approverEmployeeId:e?.employeeId||"",approverName:e?.name||""})}} placeholder="Select HOD"/></label><label>Recruiter<select value={reqForm.recruiter} onChange={(e)=>setReqForm({...reqForm,recruiter:e.target.value})}><option value="">Select</option>{recruiterOptions.map(x=><option key={x}>{x}</option>)}</select></label><label>Reason<select value={reqForm.reason} onChange={(e)=>setReqForm({...reqForm,reason:e.target.value})}><option>New Position</option><option>Replacement</option><option>Expansion</option><option>Attrition</option></select></label><label className="full">Remarks<textarea rows="3" value={reqForm.remarks} onChange={(e)=>setReqForm({...reqForm,remarks:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setReqModal(false)}>Cancel</button><button className="rec-primary">Save Requirement</button></div></form></Modal>}

    {candidateModal&&<Modal title={editingCandidateId?"Edit Candidate Details":"Add Candidate"} onClose={()=>{setCandidateModal(false);setEditingCandidateId("");setCandidateForm(EMPTY_CANDIDATE);}} wide><form className="rec-form-grid" onSubmit={saveCandidate}><label>Candidate Name *<input required value={candidateForm.name} onChange={(e)=>setCandidateForm({...candidateForm,name:e.target.value})}/></label><label>Mobile *<input required inputMode="numeric" value={candidateForm.mobile} onChange={(e)=>setCandidateForm({...candidateForm,mobile:e.target.value.replace(/\D/g,"").slice(0,10)})}/></label><label>Email<input type="email" value={candidateForm.email} onChange={(e)=>setCandidateForm({...candidateForm,email:e.target.value})}/></label><label>Current Location<select value={candidateForm.location} onChange={(e)=>setCandidateForm({...candidateForm,location:e.target.value})}><option value="">Select Location</option>{candidateLocationOptions.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Current Department<select value={candidateForm.department||""} onChange={(e)=>setCandidateForm({...candidateForm,department:e.target.value})}><option value="">Select Department</option>{candidateDepartmentOptions.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Current Company<input value={candidateForm.currentCompany} onChange={(e)=>setCandidateForm({...candidateForm,currentCompany:e.target.value})}/></label><label>Current Designation<select value={candidateForm.currentDesignation} onChange={(e)=>setCandidateForm({...candidateForm,currentDesignation:e.target.value})}><option value="">Select Designation</option>{candidateDesignationOptions.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Total Experience<input value={candidateForm.totalExperience} onChange={(e)=>setCandidateForm({...candidateForm,totalExperience:e.target.value})}/></label><label>Relevant Experience<input value={candidateForm.relevantExperience} onChange={(e)=>setCandidateForm({...candidateForm,relevantExperience:e.target.value})}/></label><label>Highest Qualification<input value={candidateForm.qualification} onChange={(e)=>setCandidateForm({...candidateForm,qualification:e.target.value})}/></label><label>Passing Year<input value={candidateForm.qualificationYear} onChange={(e)=>setCandidateForm({...candidateForm,qualificationYear:e.target.value})}/></label><div className="rec-required-upload full"><div><b>{editingCandidateId&&hasMandatoryCv(editingCandidateId)?"Updated CV — Replace (Optional)":"Updated CV *"}</b><span>{editingCandidateId&&hasMandatoryCv(editingCandidateId)?"An existing CV is on record. Attach a file only when you need to replace it.":"Latest CV is mandatory before saving the candidate."}</span></div><label className="rec-upload-button rec-primary">↑ {candidateForm.updatedCvData?"Replace Selected CV":"Attach / Replace Updated CV"}<input required={!editingCandidateId||!hasMandatoryCv(editingCandidateId)} type="file" accept=".pdf,.doc,.docx" onChange={(e)=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1500000){alert("Please keep the Updated CV below 1.5 MB for the current Supabase settings storage.");e.target.value="";return;}const reader=new FileReader();reader.onload=()=>setCandidateForm(current=>({...current,updatedCvName:file.name,updatedCvData:String(reader.result||""),cvStatus:"Received"}));reader.onerror=()=>alert("Unable to read the selected CV file.");reader.readAsDataURL(file);}}/></label>{candidateForm.updatedCvName&&<span className="rec-upload-file">✓ {candidateForm.updatedCvName}{candidateForm.updatedCvData?" · New file selected":" · Current file"}</span>}</div><label className="full">Key Skills<input value={candidateForm.skills} onChange={(e)=>setCandidateForm({...candidateForm,skills:e.target.value})}/></label><label>Current CTC<input value={candidateForm.currentCtc} onChange={(e)=>setCandidateForm({...candidateForm,currentCtc:e.target.value})}/></label><label>Expected CTC<input value={candidateForm.expectedCtc} onChange={(e)=>setCandidateForm({...candidateForm,expectedCtc:e.target.value})}/></label><label>Notice Period<input value={candidateForm.noticePeriod} onChange={(e)=>setCandidateForm({...candidateForm,noticePeriod:e.target.value})}/></label><label>Last Working Date<input type="date" value={candidateForm.lastWorkingDate} onChange={(e)=>setCandidateForm({...candidateForm,lastWorkingDate:e.target.value})}/></label><label>Preferred Location<select value={candidateForm.preferredLocation} onChange={(e)=>setCandidateForm({...candidateForm,preferredLocation:e.target.value})}><option value="">Select Preferred Location</option>{candidateLocationOptions.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Willing to Relocate<select value={candidateForm.willingToRelocate} onChange={(e)=>setCandidateForm({...candidateForm,willingToRelocate:e.target.value})}><option>Yes</option><option>No</option></select></label><label>Category Type<select value={candidateForm.category} onChange={(e)=>setCandidateForm({...candidateForm,category:e.target.value})}><option value="">Select Category Type</option>{recruitmentCategories.map((x)=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Source<select value={candidateForm.source} onChange={(e)=>setCandidateForm({...candidateForm,source:e.target.value})}>{SOURCES.map(x=><option key={x}>{x}</option>)}</select></label><label>Consultant / Vendor<select value={candidateForm.consultant} onChange={(e)=>setCandidateForm({...candidateForm,consultant:e.target.value})}><option value="">Select Consultant / Vendor</option>{consultantOptions.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Recruiter<select value={candidateForm.recruiter} onChange={(e)=>setCandidateForm({...candidateForm,recruiter:e.target.value})}><option value="">Select</option>{recruiterOptions.map(x=><option key={x}>{x}</option>)}</select></label><label className="full">Requirement Applied Against<select value={candidateForm.requirementId} onChange={(e)=>setCandidateForm({...candidateForm,requirementId:e.target.value})}><option value="">General Candidate Pool / Not Linked</option>{candidateRequirementOptions.map(r=><option key={r.id} value={r.id}>{r.title} · {r.requirementNo||r.id} · {r.department||"Department not set"}{r.location?` · ${r.location}`:""}</option>)}</select><small className="rec-field-hint">Select the vacancy this candidate is being sourced for. This link is saved for requirement-wise candidate counts and becomes visible in the tracker once the candidate is Selected.</small></label><label>Owner<input value={candidateForm.owner} onChange={(e)=>setCandidateForm({...candidateForm,owner:e.target.value})}/></label><label>{editingCandidateId?"Candidate Stage":"Initial Stage"}<select value={candidateForm.stage} onChange={(e)=>setCandidateForm({...candidateForm,stage:e.target.value})}>{(editingCandidateId?CANDIDATE_STAGES:["New","Screening"]).map(stage=><option key={stage}>{stage}</option>)}</select></label><label>Next Action<input value={candidateForm.nextAction} onChange={(e)=>setCandidateForm({...candidateForm,nextAction:e.target.value})}/></label><label>Next Action Date<input type="date" value={candidateForm.nextActionDate} onChange={(e)=>setCandidateForm({...candidateForm,nextActionDate:e.target.value})}/></label><label className="full">Notes<textarea rows="3" value={candidateForm.notes} onChange={(e)=>setCandidateForm({...candidateForm,notes:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>{setCandidateModal(false);setEditingCandidateId("");setCandidateForm(EMPTY_CANDIDATE);}}>Cancel</button><button className="rec-primary">{editingCandidateId?"Save Changes":"Save Candidate"}</button></div></form></Modal>}

    {interviewModal&&<Modal title="Schedule Interview" onClose={()=>setInterviewModal(false)}><form className="rec-form-grid" onSubmit={saveInterview}><label className="full">Candidate *<select required value={interviewForm.candidateId} onChange={(e)=>setInterviewForm({...interviewForm,candidateId:e.target.value})}><option value="">Select Candidate</option>{store.candidates.filter(c=>!["Rejected","Joined","Withdrawn"].includes(c.stage)).map(c=><option key={c.id} value={c.id}>{c.name} · {c.currentDesignation||"Candidate"}</option>)}</select></label><label>Round<select value={interviewForm.round} onChange={(e)=>setInterviewForm({...interviewForm,round:e.target.value})}>{INTERVIEW_ROUNDS.map(x=><option key={x}>{x}</option>)}</select></label><label>Mode<select value={interviewForm.mode} onChange={(e)=>setInterviewForm({...interviewForm,mode:e.target.value})}>{INTERVIEW_MODES.map(x=><option key={x}>{x}</option>)}</select></label><label>Date *<input required type="date" value={interviewForm.date} onChange={(e)=>setInterviewForm({...interviewForm,date:e.target.value})}/></label><label>Time *<input required type="time" value={interviewForm.time} onChange={(e)=>setInterviewForm({...interviewForm,time:e.target.value})}/></label><label>Panel / Interviewer<input value={interviewForm.panel} onChange={(e)=>setInterviewForm({...interviewForm,panel:e.target.value})}/></label><label>Coordinator<input value={interviewForm.coordinator} onChange={(e)=>setInterviewForm({...interviewForm,coordinator:e.target.value})}/></label><label className="full">{interviewForm.mode==="Online"?"Meeting Link":"Interview Location"}<input value={interviewForm.mode==="Online"?interviewForm.meetingLink:interviewForm.location} onChange={(e)=>setInterviewForm({...interviewForm,[interviewForm.mode==="Online"?"meetingLink":"location"]:e.target.value})}/></label><label className="full">Remarks<textarea rows="3" value={interviewForm.remarks} onChange={(e)=>setInterviewForm({...interviewForm,remarks:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setInterviewModal(false)}>Cancel</button><button className="rec-primary">Schedule Interview</button></div></form></Modal>}

    {feedbackModal&&<Modal title="Interview Feedback" onClose={()=>setFeedbackModal(false)} wide><form onSubmit={saveFeedback}><div className="rec-rating-grid">{["technical","communication","experience","problemSolving","behaviour","leadership","cultureFit"].map(k=><label key={k}>{k.replace(/([A-Z])/g," $1")}<select value={feedbackForm[k]} onChange={(e)=>setFeedbackForm({...feedbackForm,[k]:Number(e.target.value)})}><option value="0">Not Rated</option><option value="1">1 — Poor</option><option value="2">2 — Below Average</option><option value="3">3 — Average</option><option value="4">4 — Good</option><option value="5">5 — Excellent</option></select></label>)}</div><div className="rec-form-grid"><label>Recommendation *<select required value={feedbackForm.recommendation} onChange={(e)=>setFeedbackForm({...feedbackForm,recommendation:e.target.value})}><option value="">Select</option>{RECOMMENDATIONS.map(x=><option key={x}>{x}</option>)}</select></label><label className="full">Comments<textarea rows="4" value={feedbackForm.comments} onChange={(e)=>setFeedbackForm({...feedbackForm,comments:e.target.value})}/></label></div><div className="rec-form-actions"><button type="button" className="rec-secondary" onClick={()=>setFeedbackModal(false)}>Cancel</button><button className="rec-primary">Submit Feedback</button></div></form></Modal>}

    {mappingModal&&<Modal title="Experience Mapping — CV vs Documents" onClose={()=>setMappingModal(false)} wide>
      <form className="rec-mapping-editor" onSubmit={saveMapping}>
        <div className="rec-mapping-editor-head">
          <div>
            <span className="rec-eyebrow">STANDARD FORMAT</span>
            <h3>Experience Mapping as per CV & as per Documents</h3>
            <p>One row for each company / qualification. This follows the uploaded Experience Mapping Format workbook.</p>
          </div>
          <label>As on Date<input type="date" value={mappingForm.asOnDate||todayISO()} onChange={(e)=>setMappingForm({...mappingForm,asOnDate:e.target.value})}/></label>
        </div>
        <div className="rec-mapping-editor-actions">
          <button type="button" className="rec-secondary" onClick={()=>addMappingRow("Company")}>＋ Company Row</button>
          <button type="button" className="rec-secondary" onClick={()=>addMappingRow("Qualification")}>＋ Qualification Row</button>
          <span className="rec-mapping-hint">CV period and document period are tracked separately. Missing certificates are not treated as document-supported experience.</span>
        </div>
        <div className="rec-mapping-row-stack">
          {(mappingForm.rows||[]).map((row,index)=><div className="rec-mapping-row-card" key={row.id||index}>
            <div className="rec-mapping-row-head"><b>Row {index+1}</b><select value={row.mappingType||"Company"} onChange={(e)=>updateMappingRow(index,{mappingType:e.target.value})}><option>Company</option><option>Qualification</option></select><button type="button" className="rec-inline-action danger" onClick={()=>removeMappingRow(index)}>Remove</button></div>
            <div className="rec-form-grid">
              <label>Company / Qualification *<input required value={row.mappingType==="Qualification"?(row.qualification||""):(row.company||"")} onChange={(e)=>updateMappingRow(index,row.mappingType==="Qualification"?{qualification:e.target.value}:{company:e.target.value})}/></label>
              {row.mappingType==="Qualification"&&<label>Completion Year<input value={row.qualificationYear||""} onChange={(e)=>updateMappingRow(index,{qualificationYear:e.target.value})}/></label>}
              <label>Designation as per CV<input value={row.designationAsPerCV||row.designation||""} onChange={(e)=>updateMappingRow(index,{designationAsPerCV:e.target.value,designation:e.target.value})}/></label>
              <label>Designation as per Documents<input value={row.designationAsPerDocuments||""} onChange={(e)=>updateMappingRow(index,{designationAsPerDocuments:e.target.value})}/></label>
              <label>CV Start Date<input type="date" value={row.fromDate||""} onChange={(e)=>updateMappingRow(index,{fromDate:e.target.value,periodAsPerCV:mappingPeriodLabel(e.target.value,row.toDate)})}/></label>
              <label>CV End Date<input type="date" value={row.toDate||""} onChange={(e)=>updateMappingRow(index,{toDate:e.target.value,periodAsPerCV:mappingPeriodLabel(row.fromDate,e.target.value)})}/></label>
              <label>CV Duration<input value={row.duration||monthsToYearsMonths(calculateInclusiveMonths(row.fromDate,row.toDate))} onChange={(e)=>updateMappingRow(index,{duration:e.target.value})}/></label>
              <label>Document Start Date<input type="date" value={row.documentFromDate||""} onChange={(e)=>updateMappingRow(index,{documentFromDate:e.target.value,periodAsPerDocuments:mappingPeriodLabel(e.target.value,row.documentToDate)})}/></label>
              <label>Document End Date<input type="date" value={row.documentToDate||""} onChange={(e)=>updateMappingRow(index,{documentToDate:e.target.value,periodAsPerDocuments:mappingPeriodLabel(row.documentFromDate,e.target.value)})}/></label>
              <label>Document Duration<input value={row.documentDuration||monthsToYearsMonths(calculateInclusiveMonths(row.documentFromDate,row.documentToDate))} onChange={(e)=>updateMappingRow(index,{documentDuration:e.target.value})}/></label>
              <label>Document Available<select value={row.documentAvailable||"No document provided"} onChange={(e)=>updateMappingRow(index,{documentAvailable:e.target.value})}><option>Yes – Experience Certificate</option><option>Yes – Service Certificate</option><option>Yes – Appointment Letter</option><option>Yes – Relieving Letter</option><option>Yes – Other Document</option><option>No document provided</option></select></label>
              <label>Document Type<input value={row.documentType||""} onChange={(e)=>updateMappingRow(index,{documentType:e.target.value})}/></label>
              <label className="full">Period / Details in Document<textarea rows="2" value={row.documentDetails||""} onChange={(e)=>updateMappingRow(index,{documentDetails:e.target.value})}/></label>
              <label>Project / Work Scope<input value={row.project||""} onChange={(e)=>updateMappingRow(index,{project:e.target.value})}/></label>
              <label>Role<input value={row.role||""} onChange={(e)=>updateMappingRow(index,{role:e.target.value})}/></label>
              <label>Relevant Experience<input value={row.relevantExperience||""} onChange={(e)=>updateMappingRow(index,{relevantExperience:e.target.value})}/></label>
              <label>Mapping Status<select value={row.mappingStatus||"Not Started"} onChange={(e)=>updateMappingRow(index,{mappingStatus:e.target.value})}>{MAPPING_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Verified By<input value={row.verifiedBy||""} onChange={(e)=>updateMappingRow(index,{verifiedBy:e.target.value})}/></label>
              <label>Verification Date<input type="date" value={row.verificationDate||""} onChange={(e)=>updateMappingRow(index,{verificationDate:e.target.value})}/></label>
              <label className="full">Remarks / Difference<textarea rows="2" value={row.remarks||""} onChange={(e)=>updateMappingRow(index,{remarks:e.target.value})}/></label>
            </div>
          </div>)}
          {!(mappingForm.rows||[]).length&&<div className="rec-empty">No mapping rows. Add Company Row or Qualification Row.</div>}
        </div>
        <div className="rec-form-actions">
          <button type="button" className="rec-secondary" onClick={()=>setMappingModal(false)}>Cancel</button>
          <button className="rec-primary">Save CV vs Document Mapping</button>
        </div>
      </form>
    </Modal>}

    {bgvModal&&<Modal title="Background Verification" onClose={()=>setBgvModal(false)}><form className="rec-form-grid" onSubmit={saveBGV}><label className="full">Candidate *<select required value={bgvForm.candidateId} onChange={(e)=>setBgvForm({...bgvForm,candidateId:e.target.value})}><option value="">Select</option>{store.candidates.map(c=><option key={c.id} value={c.id}>{c.name} · {c.candidateNo||c.id}</option>)}</select></label><label>Agency<input value={bgvForm.agency} onChange={(e)=>setBgvForm({...bgvForm,agency:e.target.value})}/></label><label>Reference No.<input value={bgvForm.referenceNo} onChange={(e)=>setBgvForm({...bgvForm,referenceNo:e.target.value})}/></label><label>Initiated Date<input type="date" value={bgvForm.initiatedDate} onChange={(e)=>setBgvForm({...bgvForm,initiatedDate:e.target.value})}/></label><label>Submitted Date<input type="date" value={bgvForm.submittedDate} onChange={(e)=>setBgvForm({...bgvForm,submittedDate:e.target.value})}/></label><label>Status<select value={bgvForm.status} onChange={(e)=>setBgvForm({...bgvForm,status:e.target.value})}>{BGV_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label><label className="full">Remarks<textarea rows="3" value={bgvForm.remarks} onChange={(e)=>setBgvForm({...bgvForm,remarks:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setBgvModal(false)}>Cancel</button><button className="rec-primary">Save BGV</button></div></form></Modal>}

    {joiningModal&&<Modal title="Joining Control" onClose={()=>setJoiningModal(false)}><form className="rec-form-grid" onSubmit={saveJoining}><label className="full">Candidate *<select required value={joiningForm.candidateId} onChange={(e)=>setJoiningForm({...joiningForm,candidateId:e.target.value})}><option value="">Select</option>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).map(c=><option key={c.id} value={c.id}>{c.name} · {c.candidateNo||c.id}</option>)}</select></label><label>Expected Joining Date *<input required type="date" value={joiningForm.expectedDate} onChange={(e)=>setJoiningForm({...joiningForm,expectedDate:e.target.value})}/></label><label>Status<select value={joiningForm.status} onChange={(e)=>setJoiningForm({...joiningForm,status:e.target.value})}>{JOINING_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label><label>Actual Joining Date<input type="date" value={joiningForm.actualDate} onChange={(e)=>setJoiningForm({...joiningForm,actualDate:e.target.value})}/></label><label>Location<select value={joiningForm.location} onChange={(e)=>setJoiningForm({...joiningForm,location:e.target.value})}><option value="">Select Location</option>{locations.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Reporting Manager<input value={joiningForm.reportingManager} onChange={(e)=>setJoiningForm({...joiningForm,reportingManager:e.target.value})}/></label><label className="full">Remarks<textarea rows="3" value={joiningForm.remarks} onChange={(e)=>setJoiningForm({...joiningForm,remarks:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setJoiningModal(false)}>Cancel</button><button className="rec-primary">Save Joining</button></div></form></Modal>}

    {offerModal&&<Modal title="Offer Management" onClose={()=>setOfferModal(false)} wide><form className="rec-form-grid" onSubmit={saveOffer}><label>Candidate *<select required value={offerForm.candidateId} onChange={(e)=>{const id=e.target.value;const c=candidateById(id);const r=requirementById(c?.requirementId);setOfferForm({...offerForm,candidateId:id,designation:c?.currentDesignation||r?.title||offerForm.designation,department:r?.department||offerForm.department,location:r?.location||c?.preferredLocation||offerForm.location});}}><option value="">Select Candidate</option>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled"].includes(c.stage)).map(c=><option key={c.id} value={c.id}>{c.name} · {c.currentDesignation||"Candidate"}</option>)}</select></label><label>Offer No.<input value={offerForm.offerNumber} onChange={(e)=>setOfferForm({...offerForm,offerNumber:e.target.value})}/></label><label>Designation *<select required value={offerForm.designation} onChange={(e)=>setOfferForm({...offerForm,designation:e.target.value})}><option value="">Select Designation</option>{designations.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Department<select value={offerForm.department} onChange={(e)=>setOfferForm({...offerForm,department:e.target.value})}><option value="">Select</option>{departments.map(x=><option key={x.id}>{x.name}</option>)}</select></label><label>Location<select value={offerForm.location} onChange={(e)=>setOfferForm({...offerForm,location:e.target.value})}><option value="">Select</option>{locations.map(x=><option key={x.id}>{x.name}</option>)}</select></label><label>Joining Date<input type="date" value={offerForm.joiningDate} onChange={(e)=>setOfferForm({...offerForm,joiningDate:e.target.value})}/></label><label>Annual CTC *<input required type="number" value={offerForm.ctc} onChange={(e)=>setOfferForm({...offerForm,ctc:e.target.value})}/></label><label>Basic<input type="number" value={offerForm.basic} onChange={(e)=>setOfferForm({...offerForm,basic:e.target.value})}/></label><label>HRA<input type="number" value={offerForm.hra} onChange={(e)=>setOfferForm({...offerForm,hra:e.target.value})}/></label><label>Other Components<input type="number" value={offerForm.other} onChange={(e)=>setOfferForm({...offerForm,other:e.target.value})}/></label><label>Probation<select value={offerForm.probation} onChange={(e)=>setOfferForm({...offerForm,probation:e.target.value})}><option>3 Months</option><option>6 Months</option><option>12 Months</option></select></label><label>Notice Period<input value={offerForm.noticePeriod} onChange={(e)=>setOfferForm({...offerForm,noticePeriod:e.target.value})}/></label><label>Reporting Manager<input value={offerForm.reportingManager} onChange={(e)=>setOfferForm({...offerForm,reportingManager:e.target.value})}/></label><label>Approval Status<select value={offerForm.approvalStatus} onChange={(e)=>setOfferForm({...offerForm,approvalStatus:e.target.value})}><option>Pending</option><option>Approved</option><option>Rejected</option></select></label><label>Status<select value={offerForm.status} onChange={(e)=>setOfferForm({...offerForm,status:e.target.value})}>{OFFER_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setOfferModal(false)}>Cancel</button><button type="button" className="rec-secondary" onClick={()=>{if(!offerForm.candidateId)return alert("Select candidate first.");const c=candidateById(offerForm.candidateId);setOfferModal(false);openLetter("Offer Letter",c.id);}}>Generate Letter</button><button className="rec-primary">Save Offer</button></div></form></Modal>}

    {letterModal&&<Modal title={`${letterForm.type} · Generate / Preview`} onClose={()=>setLetterModal(false)} wide><div className="rec-letter-layout"><div className="rec-letter-controls"><div className="rec-form-grid"><label>Letter Type<select value={letterForm.type} onChange={(e)=>{const type=e.target.value;const t=store.letterTemplates.find(x=>x.type===type&&x.active)||store.letterTemplates.find(x=>x.type===type);setLetterForm({...letterForm,type,templateId:t?.id||"",subject:t?.subject||"",body:t?.bodyTemplate||letterForm.body});}}>{LETTER_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>{letterForm.type === "Termination Letter" ? <label>Employee<select value={letterForm.employeeId} onChange={(e)=>{const id=e.target.value;setLetterForm({...letterForm,employeeId:id,candidateId:""});}}><option value="">Select Employee</option>{employeeOptions.map(e=><option key={e.id} value={e.id}>{e.name} · {e.employeeId}</option>)}</select></label> : <label>Candidate<select value={letterForm.candidateId} onChange={(e)=>setLetterForm({...letterForm,candidateId:e.target.value,employeeId:""})}><option value="">Select</option>{store.candidates.map(c=><option key={c.id} value={c.id}>{c.name} · {c.candidateNo||c.id}</option>)}</select></label>}<label>Template<select value={letterForm.templateId} onChange={(e)=>{const t=store.letterTemplates.find(x=>x.id===e.target.value);setLetterForm({...letterForm,templateId:e.target.value,subject:t?.subject||"",body:t?.bodyTemplate||""});}}>{store.letterTemplates.filter(t=>t.type===letterForm.type).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Issue Date<input type="date" value={letterForm.issueDate} onChange={(e)=>setLetterForm({...letterForm,issueDate:e.target.value})}/></label>{letterForm.type==="Termination Letter"&&<><label>Termination Date<input type="date" value={letterForm.terminationDate} onChange={(e)=>setLetterForm({...letterForm,terminationDate:e.target.value})}/></label><label className="full">Termination Reason<input value={letterForm.terminationReason} onChange={(e)=>setLetterForm({...letterForm,terminationReason:e.target.value})}/></label></>}<label className="full">Subject<input value={letterForm.subject} onChange={(e)=>setLetterForm({...letterForm,subject:e.target.value})}/></label><label className="full">Letter Text<textarea rows="15" value={letterForm.body} onChange={(e)=>setLetterForm({...letterForm,body:e.target.value})}/></label></div><div className="rec-letter-actions"><button className="rec-secondary" type="button" onClick={regenerateLetterBody}>↻ Auto Fill Fields</button><button className="rec-secondary" type="button" onClick={()=>saveLetter(false)}>Save Draft</button><button className="rec-secondary" type="button" onClick={shareLetter}>Share / Copy</button><button className="rec-primary" type="button" onClick={()=>saveLetter(true)}>Generate & Print / Save PDF</button></div></div><div className="rec-letter-preview" id="recruitment-letter-preview">{(()=>{const t=store.letterTemplates.find(x=>x.id===letterForm.templateId);return <><div className="rec-letter-page">{t?.letterheadImage&&<img className="rec-letterhead" src={t.letterheadImage} alt="Letterhead"/>}<div className="rec-letter-body"><div className="rec-letter-subject">{letterForm.subject}</div>{letterForm.body.split("\n").map((line,i)=><p key={i}>{line||" "}</p>)}</div>{t?.footerText&&<div className="rec-letter-footer">{t.footerText}</div>}</div></>})()}</div></div></Modal>}

    {templateModal&&<Modal title="Letter Template" onClose={()=>setTemplateModal(false)} wide><form className="rec-form-grid" onSubmit={saveTemplate}><label>Template Type<select value={templateForm.type} onChange={(e)=>setTemplateForm({...templateForm,type:e.target.value})}>{LETTER_TYPES.map(x=><option key={x}>{x}</option>)}</select></label><label>Template Name<input required value={templateForm.name} onChange={(e)=>setTemplateForm({...templateForm,name:e.target.value})}/></label><label>Subject<input value={templateForm.subject} onChange={(e)=>setTemplateForm({...templateForm,subject:e.target.value})}/></label><label>Fixed Letterhead Image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>uploadLetterhead(e.target.files?.[0])}/></label>{templateForm.letterheadImage&&<div className="rec-letterhead-thumb full"><img src={templateForm.letterheadImage} alt="Uploaded letterhead"/></div>}<label className="full">Fixed Text Template<textarea required rows="18" value={templateForm.bodyTemplate} onChange={(e)=>setTemplateForm({...templateForm,bodyTemplate:e.target.value})}/></label><div className="rec-placeholder-box full"><b>Available auto fields</b><span>{"{{DATE}} {{EMPLOYEE_NAME}} {{EMPLOYEE_ID}} {{FATHER_NAME}} {{ADDRESS}} {{DESIGNATION}} {{DEPARTMENT}} {{LOCATION}} {{JOINING_DATE}} {{ACTUAL_JOINING_DATE}} {{CTC}} {{MONTHLY_CTC}} {{BASIC}} {{HRA}} {{REPORTING_MANAGER}} {{PROBATION}} {{NOTICE_PERIOD}} {{TERMINATION_DATE}} {{TERMINATION_REASON}} {{COMPANY_NAME}}"}</span></div><label className="full">Footer / Disclaimer<textarea rows="3" value={templateForm.footerText} onChange={(e)=>setTemplateForm({...templateForm,footerText:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setTemplateModal(false)}>Cancel</button><button className="rec-primary">Save Template</button></div></form></Modal>}
    {candidateDetail&&renderCandidateDetail()}
  </section>;
}

function Info({ label, value }) { return <div className="rec-info-row"><span>{label}</span><b>{value || "—"}</b></div>; }
