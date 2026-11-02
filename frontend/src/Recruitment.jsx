import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { loadOrganizationModuleData, saveOrganizationModuleData } from "./organizationModuleStorage";
import "./Recruitment.css";

const RECRUITMENT_SETTINGS_KEY = "recruitment";
const MASTERS_KEY = "organizationMasters";

const REQ_STATUSES = ["Draft", "Pending Approval", "Approved", "On Hold", "Partially Filled", "Filled", "Rejected", "Closed", "Cancelled"];
const CANDIDATE_STAGES = ["New", "Screening", "Shortlisted", "Interview Scheduled", "Interviewed", "Selected", "Hold", "Rejected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined", "Withdrawn", "No Show"];
const SOURCES = ["Naukri", "LinkedIn", "Referral", "Consultant", "Walk-in", "Website", "Campus", "Internal", "Other"];
const CATEGORIES = ["On Roll", "Off Roll", "Consultant"];
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
  title: "", department: "", location: "", category: "On Roll", vacancies: 1, employmentType: "Full Time", employeeGroup: "", qualification: "", experience: "", skills: "", minCtc: "", maxCtc: "", priority: "Medium", targetDate: "", hiringManager: "", approverId: "", approverEmployeeId: "", approverName: "", recruiter: "", reason: "New Position", status: "Draft", remarks: "",
};
const EMPTY_CANDIDATE = {
  name: "", mobile: "", email: "", location: "", currentCompany: "", currentDesignation: "", department: "", totalExperience: "", relevantExperience: "", qualification: "", qualificationYear: "", skills: "", currentCtc: "", expectedCtc: "", noticePeriod: "", lastWorkingDate: "", preferredLocation: "", willingToRelocate: "Yes", source: "Naukri", referredBy: "", consultant: "", category: "On Roll", recruiter: "", requirementId: "", stage: "New", stageUpdatedDate: "", rejectionReason: "", holdReason: "", followUpDate: "", nextAction: "", nextActionDate: "", owner: "", resumeName: "", updatedCvName: "", updatedCvData: "", cvStatus: "Missing", notes: "",
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
function normalizeOptions(items = []) { const seen = new Set(); return (Array.isArray(items) ? items : []).map((item, index) => { if (item && typeof item === "object") return { id: String(item.id ?? item.name ?? item.label ?? index), name: String(item.name ?? item.label ?? item.value ?? "").trim(), employeeId: item.employeeId }; return { id: String(item ?? index), name: String(item ?? "").trim() }; }).filter((x) => x.name).filter((x) => { const k = x.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); }
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

async function loadRecruitmentStore() {
  const [saved, masters] = await Promise.all([
    loadOrganizationModuleData(RECRUITMENT_SETTINGS_KEY, {}),
    loadOrganizationModuleData(MASTERS_KEY, {}),
  ]);

  return {
    masters: masters || {},
    requirements: Array.isArray(saved?.requirements) ? saved.requirements : [],
    candidates: Array.isArray(saved?.candidates) ? saved.candidates : [],
    interviews: Array.isArray(saved?.interviews) ? saved.interviews : [],
    offers: Array.isArray(saved?.offers) ? saved.offers : [],
    mappings: Array.isArray(saved?.mappings) ? saved.mappings : [],
    documents: Array.isArray(saved?.documents) ? saved.documents : [],
    bgv: Array.isArray(saved?.bgv) ? saved.bgv : [],
    joinings: Array.isArray(saved?.joinings) ? saved.joinings : [],
    activities: Array.isArray(saved?.activities) ? saved.activities : [],
    letters: Array.isArray(saved?.letters) ? saved.letters : [],
    letterTemplates: Array.isArray(saved?.letterTemplates) && saved.letterTemplates.length
      ? saved.letterTemplates
      : DEFAULT_LETTER_TEMPLATES,
  };
}

async function persistRecruitmentStore(store) {
  const nextRecruitment = {
    requirements: store.requirements || [],
    candidates: store.candidates || [],
    interviews: store.interviews || [],
    offers: store.offers || [],
    mappings: store.mappings || [],
    documents: store.documents || [],
    bgv: store.bgv || [],
    joinings: store.joinings || [],
    activities: store.activities || [],
    letters: store.letters || [],
    letterTemplates: store.letterTemplates || DEFAULT_LETTER_TEMPLATES,
    updatedAt: new Date().toISOString(),
  };

  await saveOrganizationModuleData(RECRUITMENT_SETTINGS_KEY, nextRecruitment);
}

export default function Recruitment({ employees = [], masters = {} }) {
  const [store, setStore] = useState({ requirements: [], candidates: [], interviews: [], offers: [], mappings: [], documents: [], bgv: [], joinings: [], activities: [], letters: [], letterTemplates: DEFAULT_LETTER_TEMPLATES });
  const [masterData, setMasterData] = useState(masters || {});
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("Dashboard"); const [search, setSearch] = useState(""); const [stageFilter, setStageFilter] = useState("All"); const [reqFilter, setReqFilter] = useState("All"); const [categoryFilter, setCategoryFilter] = useState("All");
  const [reqModal, setReqModal] = useState(false); const [candidateModal, setCandidateModal] = useState(false); const [interviewModal, setInterviewModal] = useState(false); const [feedbackModal, setFeedbackModal] = useState(false); const [offerModal, setOfferModal] = useState(false); const [mappingModal, setMappingModal] = useState(false); const [bgvModal, setBgvModal] = useState(false); const [joiningModal, setJoiningModal] = useState(false); const [candidateDetail, setCandidateDetail] = useState(null); const [letterModal, setLetterModal] = useState(false); const [templateModal, setTemplateModal] = useState(false);
  const [reqForm, setReqForm] = useState(EMPTY_REQ); const [candidateForm, setCandidateForm] = useState(EMPTY_CANDIDATE); const [interviewForm, setInterviewForm] = useState(EMPTY_INTERVIEW); const [feedbackForm, setFeedbackForm] = useState(EMPTY_FEEDBACK); const [offerForm, setOfferForm] = useState(EMPTY_OFFER); const [mappingForm, setMappingForm] = useState(EMPTY_MAPPING); const [bgvForm, setBgvForm] = useState(EMPTY_BGV); const [joiningForm, setJoiningForm] = useState(EMPTY_JOINING); const [letterForm, setLetterForm] = useState(EMPTY_LETTER); const [templateForm, setTemplateForm] = useState(DEFAULT_LETTER_TEMPLATES[0]); const [feedbackInterviewId, setFeedbackInterviewId] = useState(""); const [activeCandidateTab, setActiveCandidateTab] = useState("Overview");
  const [requirementActionId, setRequirementActionId] = useState("");
  const [requirementActionPosition, setRequirementActionPosition] = useState(null);
  const [requirementActionModal, setRequirementActionModal] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true); setLoadError(""); const data = await loadRecruitmentStore();
        if (!mounted) return;
        setStore(data); setMasterData({ ...(masters || {}), ...(data.masters || {}) });
      } catch (error) { if (mounted) setLoadError(error?.message || "Unable to load Recruitment data."); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const departments = useMemo(() => normalizeOptions(masterData.departments), [masterData.departments]);
  const locations = useMemo(() => normalizeOptions(masterData.locations), [masterData.locations]);
  const designations = useMemo(() => normalizeOptions(masterData.designations), [masterData.designations]);
  const employeeGroups = useMemo(() => normalizeOptions(masterData.employeeGroups || masterData.workforceCategories || masterData.employeeTypes), [masterData.employeeGroups, masterData.workforceCategories, masterData.employeeTypes]);
  const workforceCategories = useMemo(() => normalizeOptions(masterData.workforceCategories || masterData.employeeGroups), [masterData.workforceCategories, masterData.employeeGroups]);
  const payrollProfiles = useMemo(() => normalizeOptions(masterData.payrollProfiles), [masterData.payrollProfiles]);
  const employeeOptions = useMemo(() => (Array.isArray(employees) ? employees : []).filter((e) => e && e.status !== "Inactive").map((e, i) => ({ id: String(e.id ?? e.employeeId ?? i), employeeId: String(e.employeeId ?? e.id ?? ""), name: String(e.name ?? e.employeeName ?? "").trim(), department: String(e.department || ""), designation: String(e.designation || "") })).filter((e) => e.name), [employees]);
  const recruiterOptions = useMemo(() => employeeOptions.map((e) => e.name).filter((n, i, a) => a.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i), [employeeOptions]);

  const replaceAndSave = async (patch, activity) => {
    const next = { ...store, ...patch }; setStore(next); setSaving(true);
    try { await persistRecruitmentStore(next); if (activity) window.dispatchEvent(new CustomEvent("hrsyncRecruitmentUpdated")); }
    catch (error) { setLoadError(error?.message || "Unable to save Recruitment data."); }
    finally { setSaving(false); }
  };

  const addActivity = (candidateId, action, details = "") => ({ id: makeId("ACT"), candidateId, action, details, at: new Date().toISOString(), by: "Recruitment" });
  const candidateById = (id) => store.candidates.find((c) => c.id === id);
  const requirementById = (id) => store.requirements.find((r) => r.id === id);
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
    if (!candidateForm.name.trim() || !candidateForm.mobile.trim()) return alert("Candidate Name and Mobile are required.");
    if (!candidateForm.updatedCvData) return alert("Updated CV is mandatory. Please attach the candidate's latest / updated CV before saving.");
    if (candidateForm.stage !== "New" && (!candidateForm.nextAction.trim() || !candidateForm.nextActionDate || !candidateForm.owner.trim())) return alert("For an active candidate, Next Action, Next Action Date and Owner are mandatory.");
    const { updatedCvData, ...candidatePayload } = candidateForm;
    const item = {
      ...candidatePayload,
      id: makeId("CAN"),
      candidateNo: `CAND-${String(store.candidates.length + 1).padStart(4, "0")}`,
      cvStatus: "Received",
      stageUpdatedDate: todayISO(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const cvDocument = {
      id: makeId("DOC"),
      candidateId: item.id,
      type: "Updated CV",
      status: "Received",
      fileName: item.updatedCvName,
      fileData: item.updatedCvData,
      mandatory: true,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const activity = addActivity(item.id, "Candidate created", `Updated CV attached · ${item.updatedCvName}`);
    await replaceAndSave({
      candidates: [item, ...store.candidates],
      documents: [cvDocument, ...store.documents],
      activities: [activity, ...store.activities],
    }, true);
    setCandidateForm(EMPTY_CANDIDATE);
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
    const hasCv = docs.some((document) => /(?:updated\s*cv|cv\s*\/\s*resume|resume)/i.test(String(document.type || "")) && Boolean(document.fileData || document.fileUrl || document.url || document.data || ["Received", "Verified"].includes(document.status)));
    const mandatoryPending = MANDATORY_DOCUMENT_TYPES.filter((type) => type === "Updated CV" ? !hasCv : !docs.some((d) => d.type === type && ["Received", "Verified"].includes(d.status))).length;
    const verified = docs.filter((d) => d.status === "Verified").length;
    const optionalReceived = OPTIONAL_DOCUMENT_TYPES.filter((type) => docs.some((d) => d.type === type && ["Received", "Under Verification", "Verified"].includes(d.status))).length;
    return { verified, pending: mandatoryPending, mandatoryPending, optionalReceived, total: DOCUMENT_TYPES.length };
  };
  const hasMandatoryCv = (candidateId) => {
    const candidate = candidateById(candidateId);
    const hasUploadedCvDocument = store.documents.some((document) => document.candidateId === candidateId && /(?:updated\s*cv|cv\s*\/\s*resume|resume)/i.test(String(document.type || "")) && Boolean(document.fileData || document.fileUrl || document.url || document.data || ["Received", "Verified"].includes(document.status)));
    const candidateCvData = candidate?.updatedCvData || candidate?.cvData || candidate?.resumeData;
    const candidateCvName = candidate?.updatedCvName || candidate?.resumeName || candidate?.cvFileName;
    const candidateCvStatus = String(candidate?.cvStatus || "").trim().toLowerCase();
    const hasSavedCvMetadata = Boolean(candidateCvName && !["missing", "not uploaded", ""].includes(candidateCvStatus));
    return Boolean(hasUploadedCvDocument || candidateCvData || hasSavedCvMetadata);
  };

  const getActionRows = useMemo(() => store.candidates.filter((c) => c.stage !== "Rejected" && c.stage !== "Joined" || c.nextAction || c.bgvStatus).map((c) => {
    const doc = getDocumentSummary(c.id); const bgv = bgvByCandidate(c.id); const offer = offerByCandidate(c.id); const joining = joiningByCandidate(c.id); const req = requirementById(c.requirementId); const latestInterview = store.interviews.filter((i) => i.candidateId === c.id).sort((a,b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0];
    return { c, req, doc, bgv, offer, joining, latestInterview };
  }), [store.candidates, store.documents, store.bgv, store.offers, store.joinings, store.interviews, store.requirements]);

  const today = todayISO();
  // A newly saved requirement starts as Draft. It is still an active manpower
  // request, so it must be included in the dashboard and requirements metrics
  // until it is filled, closed, cancelled or rejected.
  const activeRequirements = store.requirements.filter((r) => ["Draft", "Approved", "Pending Approval", "Partially Filled", "On Hold"].includes(r.status));
  const filledStages = ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"];
  const openPositions = activeRequirements.reduce((sum, r) => sum + Math.max(0, Number(r.vacancies || 0) - store.candidates.filter((c) => c.requirementId === r.id && filledStages.includes(c.stage)).length), 0);
  const totalPositions = store.requirements.reduce((sum, r) => sum + Math.max(0, Number(r.vacancies || 0)), 0);
  const closedRequirements = store.requirements.filter((r) => ["Filled", "Closed", "Cancelled", "Rejected"].includes(r.status));
  const closedPositions = closedRequirements.reduce((sum, r) => sum + Math.max(0, Number(r.vacancies || 0)), 0);
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

  const filteredCandidates = useMemo(() => { const q = search.trim().toLowerCase(); return store.candidates.filter((c) => { const text = [c.id,c.candidateNo,c.name,c.mobile,c.email,c.currentCompany,c.currentDesignation,c.department,c.skills,c.source,c.recruiter,c.owner,c.location,c.preferredLocation,c.category].join(" ").toLowerCase(); return (!q || text.includes(q)) && (stageFilter === "All" || c.stage === stageFilter) && (categoryFilter === "All" || c.category === categoryFilter); }); }, [store.candidates, search, stageFilter, categoryFilter]);
  const filteredRequirements = store.requirements.filter((r) => reqFilter === "All" || r.status === reqFilter);

  // Bulk imports intentionally do not use saveCandidate(): individual candidate
  // entry keeps the Updated CV validation, while Excel onboarding lets HR add
  // the pipeline first and attach each CV later from the candidate profile.
  const readImportRows = (file, preferredNames) => new Promise((resolve, reject) => {
    if (!file) { resolve([]); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames.find((name) => preferredNames.some((needle) => name.toLowerCase().includes(needle))) || workbook.SheetNames[0];
        resolve(sheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" }) : []);
      } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(new Error("Unable to read the Excel file."));
    reader.readAsArrayBuffer(file);
  });

  const importValue = (row, keys) => {
    const found = Object.keys(row).find((key) => keys.some((candidate) => key.toLowerCase().trim() === candidate.toLowerCase().trim()));
    return found ? row[found] : "";
  };

  const importText = (row, keys, fallback = "") => {
    const value = importValue(row, keys);
    return value === null || value === undefined ? fallback : String(value).trim() || fallback;
  };

  const importNumber = (row, keys, fallback = 0) => {
    const value = Number(importValue(row, keys));
    return Number.isFinite(value) ? value : fallback;
  };

  const importDate = (row, keys) => {
    const value = importValue(row, keys);
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    return String(value).trim();
  };

  const requirementForImport = (row) => {
    const id = importText(row, ["Requirement ID", "Req ID", "Requirement No", "Position ID"]);
    const title = importText(row, ["Requirement", "Position", "Designation"]);
    const idMatch = id && store.requirements.find((item) => [item.id, item.requirementNo].some((value) => String(value || "").toLowerCase() === id.toLowerCase()));
    return idMatch || store.requirements.find((item) => title && String(item.title || "").toLowerCase() === title.toLowerCase()) || null;
  };

  const downloadTemplate = (type) => {
    const isCandidate = type === "candidates";
    const headers = isCandidate
      ? ["Candidate ID", "Candidate Name", "Mobile", "Email", "Current Company", "Current Designation", "Current Department", "Total Experience", "Relevant Experience", "Highest Qualification", "Passing Year", "Current CTC", "Expected CTC", "Notice Period", "Last Working Date", "Current Location", "Preferred Location", "Willing to Relocate", "Category", "Source", "Consultant", "Recruiter", "Requirement", "Requirement ID", "Stage", "Next Action", "Next Action Date", "Owner", "Key Skills", "Notes"]
      : ["Req ID", "Designation", "Department", "Site / Location", "Category", "Positions Required", "Employment Type", "Employee Group", "Qualification", "Experience", "Required Skills", "Min CTC (LPA)", "Max CTC (LPA)", "Priority", "Target Joining Date", "Hiring Manager", "Recruiter", "Reason", "Remarks"];
    const instructions = isCandidate
      ? [["BAUER HRMS — Candidate Bulk Import"], ["Candidate Name is required. Updated CV is optional in this import and can be uploaded later from the candidate profile."], ["Requirement can be matched using the exact Requirement ID or Position/Designation title."], ["Stage examples: New, Screening, Shortlisted, Interview Scheduled, Selected, Offer Released, Joined."], ["Keep one candidate per row. Do not change the header names."]]
      : [["BAUER HRMS — Requirement Bulk Import"], ["Designation and Department are required. Positions Required defaults to 1 when blank."], ["Imported requirements start as Draft so the normal Submit/Approve workflow remains available."], ["Keep one requirement per row. Do not change the header names."]];
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
    dataSheet["!cols"] = headers.map((header) => ({ wch: Math.min(28, Math.max(14, header.length + 2)) }));
    dataSheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }) };
    dataSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
    XLSX.utils.book_append_sheet(workbook, dataSheet, isCandidate ? "Candidates Import" : "Requirements Import");
    const infoSheet = XLSX.utils.aoa_to_sheet(instructions);
    infoSheet["!cols"] = [{ wch: 105 }];
    XLSX.utils.book_append_sheet(workbook, infoSheet, "Instructions");
    XLSX.writeFile(workbook, isCandidate ? "BAUER_Candidate_Import_Template.xlsx" : "BAUER_Requirement_Import_Template.xlsx");
  };

  const importCandidatesExcel = async (file) => {
    if (!file) return;
    try {
      const rows = await readImportRows(file, ["candidates import", "candidate tracker", "candidates", "candidate"]);
      const now = new Date().toISOString();
      const stageMap = { "CV Received": "New", "Interview Pending": "Interview Scheduled", "Interview Done": "Interviewed", "Mapping Pending": "Selected", "Documents Pending": "Selected", "Approval Pending": "Selected", "Offer Sent": "Offer Released", "Offer Accepted": "Offer Accepted", "Joining Pending": "Joining Scheduled", "Joined": "Joined", "Hold": "Hold", "Rejected": "Rejected", "No Show": "No Show", "Screening": "Screening", "Shortlisted": "Shortlisted" };
      const imported = [];
      let skipped = 0;
      rows.forEach((row, index) => {
        const name = importText(row, ["Candidate Name", "Name"]);
        if (!name) { skipped += 1; return; }
        const suppliedNo = importText(row, ["Candidate ID", "Candidate No", "Employee Code"]);
        const candidateNo = suppliedNo || `CAND-${String(store.candidates.length + index + 1).padStart(4, "0")}`;
        const existing = store.candidates.find((candidate) => String(candidate.candidateNo || "").toLowerCase() === candidateNo.toLowerCase() || (importText(row, ["Email", "Email ID", "Email Id"]) && String(candidate.email || "").toLowerCase() === importText(row, ["Email", "Email ID", "Email Id"]).toLowerCase()));
        const requirement = requirementForImport(row);
        const stageRaw = importText(row, ["Stage", "Current Stage"], "New");
        const stage = stageMap[stageRaw] || (CANDIDATE_STAGES.includes(stageRaw) ? stageRaw : "New");
        const category = importText(row, ["Category", "Workforce Category"], "On Roll");
        const mapped = {
          ...EMPTY_CANDIDATE,
          id: existing?.id || makeId("CAN"),
          candidateNo: existing?.candidateNo || candidateNo,
          name,
          mobile: importText(row, ["Mobile", "Contact No.", "Contact"]),
          email: importText(row, ["Email", "Email ID", "Email Id"]),
          currentCompany: importText(row, ["Current Company", "Company"]),
          currentDesignation: importText(row, ["Current Designation", "Current Role", "Designation"]),
          department: importText(row, ["Current Department", "Candidate Department", "Department"]),
          totalExperience: importText(row, ["Total Experience", "Total Exp.", "Experience"]),
          relevantExperience: importText(row, ["Relevant Experience", "Relevant Exp."]),
          qualification: importText(row, ["Highest Qualification", "Qualification"]),
          qualificationYear: importText(row, ["Passing Year", "Qualification Year"]),
          currentCtc: importText(row, ["Current CTC", "Current CTC (LPA)"]),
          expectedCtc: importText(row, ["Expected CTC", "Expected CTC (LPA)"]),
          noticePeriod: importText(row, ["Notice Period"]),
          lastWorkingDate: importDate(row, ["Last Working Date", "LWD"]),
          location: importText(row, ["Current Location", "Location", "Site / Location", "Site"]),
          preferredLocation: importText(row, ["Preferred Location"]),
          willingToRelocate: importText(row, ["Willing to Relocate"], "Yes"),
          category: CATEGORIES.includes(category) ? category : "On Roll",
          source: importText(row, ["Source", "Source / Remarks"], "Other").split("/")[0].trim() || "Other",
          consultant: importText(row, ["Consultant"]),
          recruiter: importText(row, ["Recruiter", "Owner"]),
          owner: importText(row, ["Owner", "Recruiter"]),
          requirementId: requirement?.id || "",
          stage,
          nextAction: importText(row, ["Next Action"]),
          nextActionDate: importDate(row, ["Next Action Date"]),
          skills: importText(row, ["Key Skills", "Skills", "Required Skills"]),
          notes: importText(row, ["Notes", "Remarks", "Source / Remarks"]),
          // CV is deliberately not fabricated from an Excel filename.
          updatedCvName: existing?.updatedCvName || "",
          updatedCvData: existing?.updatedCvData || "",
          cvStatus: existing?.cvStatus || "Missing",
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        imported.push(existing ? { ...existing, ...mapped, id: existing.id, candidateNo: existing.candidateNo || candidateNo, updatedCvName: existing.updatedCvName || "", updatedCvData: existing.updatedCvData || "", cvStatus: existing.cvStatus || "Missing" } : mapped);
      });
      const importedIds = new Set(imported.map((candidate) => candidate.id));
      const mergedCandidates = [...imported, ...store.candidates.filter((candidate) => !importedIds.has(candidate.id))];
      const activities = [...imported.map((candidate) => addActivity(candidate.id, "Candidate imported from Excel", `${file.name} · CV can be uploaded later`)), ...store.activities];
      await replaceAndSave({ candidates: mergedCandidates, activities }, true);
      alert(`Candidate import completed. ${imported.length} row(s) added/updated${skipped ? `, ${skipped} skipped` : ""}. Updated CV upload remains available from each candidate profile.`);
    } catch (error) { alert(`Candidate import failed: ${error?.message || "Invalid workbook"}`); }
  };

  const importRequirementsExcel = async (file) => {
    if (!file) return;
    try {
      const rows = await readImportRows(file, ["requirements import", "requirements", "open positions", "open position"]);
      const now = new Date().toISOString();
      const imported = [];
      let skipped = 0;
      rows.forEach((row, index) => {
        const title = importText(row, ["Designation", "Position", "Requirement"]);
        const department = importText(row, ["Department"]);
        if (!title || !department) { skipped += 1; return; }
        const suppliedNo = importText(row, ["Req ID", "Requirement ID", "Requirement No", "Position ID"]);
        const requirementNo = suppliedNo || `REQ-${String(store.requirements.length + index + 1).padStart(4, "0")}`;
        const existing = store.requirements.find((item) => String(item.requirementNo || "").toLowerCase() === requirementNo.toLowerCase() || (String(item.title || "").toLowerCase() === title.toLowerCase() && String(item.department || "").toLowerCase() === department.toLowerCase()));
        const statusRaw = importText(row, ["Status"], existing?.status || "Draft");
        const status = REQ_STATUSES.includes(statusRaw) ? statusRaw : "Draft";
        const mapped = {
          ...EMPTY_REQ,
          id: existing?.id || makeId("REQ"),
          requirementNo: existing?.requirementNo || requirementNo,
          title,
          department,
          location: importText(row, ["Site / Location", "Location", "Site"]),
          category: CATEGORIES.includes(importText(row, ["Category", "Workforce Category"], "On Roll")) ? importText(row, ["Category", "Workforce Category"], "On Roll") : "On Roll",
          vacancies: Math.max(1, importNumber(row, ["Positions Required", "Vacancies", "Required"], 1)),
          employmentType: importText(row, ["Employment Type"], "Full Time"),
          employeeGroup: importText(row, ["Employee Group", "Workforce Category"]),
          qualification: importText(row, ["Qualification"]),
          experience: importText(row, ["Experience"]),
          skills: importText(row, ["Required Skills", "Skills"]),
          minCtc: importText(row, ["Min CTC (LPA)", "Minimum CTC"]),
          maxCtc: importText(row, ["Max CTC (LPA)", "Maximum CTC"]),
          priority: importText(row, ["Priority"], "Medium"),
          targetDate: importDate(row, ["Target Joining Date", "Target Date"]),
          hiringManager: importText(row, ["Hiring Manager"]),
          recruiter: importText(row, ["Recruiter", "Owner"]),
          reason: importText(row, ["Reason"], "New Position"),
          remarks: importText(row, ["Remarks", "Notes"]),
          status,
          approvalStatus: status === "Approved" ? "Approved" : (existing?.approvalStatus || "Pending"),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        imported.push(existing ? { ...existing, ...mapped, id: existing.id, requirementNo: existing.requirementNo || requirementNo } : mapped);
      });
      const importedIds = new Set(imported.map((item) => item.id));
      const mergedRequirements = [...imported, ...store.requirements.filter((item) => !importedIds.has(item.id))];
      await replaceAndSave({ requirements: mergedRequirements }, true);
      alert(`Requirement import completed. ${imported.length} row(s) added/updated${skipped ? `, ${skipped} skipped (Designation and Department are required)` : ""}.`);
    } catch (error) { alert(`Requirement import failed: ${error?.message || "Invalid workbook"}`); }
  };

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
        const candidateRows = rowsFromSheet(["candidates import", "candidate tracker", "candidate", "current candidate"]);
        const requirementRows = rowsFromSheet(["requirements import", "requirements", "open position", "open positions"]);
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
          return { ...EMPTY_CANDIDATE, id: makeId("CAN"), candidateNo, name, mobile: String(norm(r,["Mobile","Contact No."]) || ""), email: String(norm(r,["Email","Email Id"]) || ""), currentCompany: String(norm(r,["Current Company","Company"]) || ""), currentDesignation: String(norm(r,["Current Designation","Current Role"]) || requirementTitle), department: String(norm(r,["Current Department","Candidate Department","Department"]) || ""), totalExperience: String(norm(r,["Total Experience","Total Exp.","Experience"]) || ""), relevantExperience: String(norm(r,["Relevant Experience","Relevant Exp."]) || ""), currentCtc: String(norm(r,["Current CTC","Current CTC (LPA)"]) || ""), expectedCtc: String(norm(r,["Expected CTC","Expected CTC (LPA)"]) || ""), noticePeriod: String(norm(r,["Notice Period"]) || ""), location: String(norm(r,["Site / Location","Location","Site"]) || ""), category: CATEGORIES.includes(categoryRaw) ? categoryRaw : "On Roll", stage, requirementId: requirement?.id || "", source: String(norm(r,["Source / Remarks","Source"]) || "Other").split("/")[0].trim() || "Other", recruiter: String(norm(r,["Owner","Recruiter"]) || ""), owner: String(norm(r,["Owner"]) || ""), nextAction: String(norm(r,["Next Action"]) || ""), nextActionDate: String(norm(r,["Next Action Date"]) || ""), mappingStatus: String(norm(r,["Mapping Status"]) || "Not Started"), documentsStatus: String(norm(r,["Documents Status"]) || "Pending"), bgvStatus: "Not Initiated", notes: String(norm(r,["Source / Remarks","Remarks"]) || ""), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        }).filter(Boolean);
        const importedRequirements = requirementRows.map((r, index) => {
          const title = String(norm(r,["Designation","Position","Requirement"]) || "").trim();
          if (!title) return null;
          const existing = store.requirements.find((x) => x.title.toLowerCase() === title.toLowerCase() && String(x.department).toLowerCase() === String(norm(r,["Department"])||"").toLowerCase());
          if (existing) return existing;
          return { ...EMPTY_REQ, id: makeId("REQ"), requirementNo: String(norm(r,["Req ID","Requirement ID"]) || `REQ-${String(store.requirements.length + index + 1).padStart(4,"0")}`), title, department: String(norm(r,["Department"]) || ""), location: String(norm(r,["Site / Location","Location","Site"]) || ""), category: String(norm(r,["Category","Workforce Category"]) || "On Roll"), vacancies: Number(norm(r,["Positions Required","Vacancies"]) || 1), experience: String(norm(r,["Experience"]) || ""), qualification: String(norm(r,["Qualification"]) || ""), targetDate: String(norm(r,["Target Joining Date","Target Date"]) || ""), recruiter: String(norm(r,["Recruiter","Owner"]) || ""), status: "Approved", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        }).filter(Boolean);
        const mergedRequirements = [...importedRequirements, ...store.requirements.filter((old) => !importedRequirements.some((n) => n.id === old.id || (n.title === old.title && n.department === old.department)))];
        const mergedCandidates = [...importedCandidates, ...store.candidates];
        await replaceAndSave({ requirements: mergedRequirements, candidates: mergedCandidates, activities: [...importedCandidates.map((c) => addActivity(c.id, "Imported from Excel", file.name)), ...store.activities] }, true);
        alert(`Import completed. Added ${importedCandidates.length} candidate record(s) and ${Math.max(0, importedRequirements.length - store.requirements.length)} requirement record(s).`);
      } catch (error) { alert(`Excel import failed: ${error?.message || "Invalid workbook"}`); }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportCSV = (rows, filename) => { if (!rows.length) return alert("No data to export."); const headers = Object.keys(rows[0]); const csv = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); };

  const exportRecruitmentMIS = (mode = "all") => {
    const reqRows = store.requirements.map((r) => {
      const selectedCount = store.candidates.filter((c) => c.requirementId === r.id && ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(c.stage)).length;
      return { "Requirement ID": r.requirementNo || r.id, "Position": r.title, "Department": r.department, "Location": r.location, "Category": r.category, "Vacancies": Number(r.vacancies || 0), "Selected / Joined Pipeline": selectedCount, "Balance Vacancies": Math.max(0, Number(r.vacancies || 0) - selectedCount), "Priority": r.priority, "Requirement Status": r.status, "Approval Status": r.approvalStatus || "", "Recruiter": r.recruiter, "Hiring Manager": r.hiringManager, "Target Date": r.targetDate, "Created Date": r.createdAt ? String(r.createdAt).slice(0, 10) : "", "Remarks": r.remarks || "" };
    });
    const candidateRows = store.candidates.map((c) => {
      const req = requirementById(c.requirementId), interview = store.interviews.filter((i) => i.candidateId === c.id).sort((a,b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0], offer = offerByCandidate(c.id), joining = joiningByCandidate(c.id), bgv = bgvByCandidate(c.id);
      return { "Candidate ID": c.candidateNo || c.id, "Candidate Name": c.name, "Contact No.": c.mobile, "Email ID": c.email, "Current Designation": c.currentDesignation, "Current Department": c.department || req?.department || "", "Current Company": c.currentCompany, "Current Location": c.location, "Total Experience": c.totalExperience, "Relevant Experience": c.relevantExperience, "Highest Qualification": c.qualification, "Passing Year": c.qualificationYear, "Current CTC": c.currentCtc, "Expected CTC": c.expectedCtc, "Notice Period": c.noticePeriod, "Last Working Date": c.lastWorkingDate, "Source": c.source, "Sourced Date": c.createdAt ? String(c.createdAt).slice(0,10) : "", "Recruiter": c.recruiter, "Requirement ID": req?.requirementNo || "", "Position": req?.title || "", "Department": req?.department || c.department || "", "Job Location": req?.location || c.preferredLocation || c.location || "", "CV Status": hasMandatoryCv(c.id) ? "Attached" : "Missing", "CV File": c.updatedCvName || "", "Candidate Stage": c.stage, "Stage Updated": c.stageUpdatedDate, "Interview Round": interview?.round || "", "Interview Date": interview?.date || "", "Interview Status": interview?.status || "Not Scheduled", "Interview Feedback": interview?.feedback?.recommendation || "", "Experience Mapping": c.mappingStatus || "Not Started", "Mapping Summary": c.experienceMappingSummary?.totalDocumentExperience || "", "Documents Status": getDocumentSummary(c.id).pending === 0 ? "Complete" : "Pending", "BGV Status": bgv?.status || "Not Initiated", "Offer Status": offer?.status || "Not Started", "Offer CTC": offer?.ctc || "", "Offer Issue Date": offer?.issueDate || "", "Offer Acceptance": offer?.status === "Accepted" ? "Accepted" : offer?.status || "", "Expected Joining": joining?.expectedDate || offer?.joiningDate || "", "Joining Status": joining?.status || "", "Actual Joining": joining?.actualDate || "", "Next Action": c.nextAction, "Next Action Date": c.nextActionDate, "Owner": c.owner || c.recruiter || "", "Remarks": c.notes || "" };
    });
    const interviewRows = store.interviews.map((i) => { const c = candidateById(i.candidateId), req = c ? requirementById(c.requirementId) : null; const offer = c ? offerByCandidate(c.id) : null; const joining = c ? joiningByCandidate(c.id) : null; return { "Candidate": c?.name || i.candidateId, "Candidate ID": c?.candidateNo || "", "Position": req?.title || c?.currentDesignation || "", "Department": req?.department || c?.department || "", "Interview Round": i.round, "Interview Date": i.date, "Interview Time": i.time, "Mode": i.mode, "Interviewer / Panel": i.panel, "Interview Status": i.status, "Recommendation": i.feedback?.recommendation || "", "Feedback": i.feedback?.comments || "", "Offer Status": offer?.status || "", "Offer CTC": offer?.ctc || "", "Expected Joining": joining?.expectedDate || "", "Joining Status": joining?.status || "" }; });
    const wb = XLSX.utils.book_new();
    const addSheet = (name, rows) => { const data = rows.length ? rows : [{ "No records": "" }]; const ws = XLSX.utils.json_to_sheet(data); const headers = Object.keys(data[0] || { "No records": "" }); ws["!cols"] = headers.map((key) => ({ wch: Math.min(32, Math.max(14, key.length + 2)) })); ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, data.length), c: Math.max(0, headers.length - 1) } }) }; ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" }; XLSX.utils.book_append_sheet(wb, ws, name); };
    if (mode === "candidate") addSheet("Candidate Tracker", candidateRows);
    else if (mode === "requirements") addSheet("Requirements", reqRows);
    else {
      addSheet("Candidate Tracker", candidateRows);
      addSheet("Open Positions", reqRows.filter((r) => ["Draft", "Pending Approval", "Approved", "On Hold", "Partially Filled"].includes(r["Requirement Status"]) && r["Balance Vacancies"] > 0));
      addSheet("Closed Positions", reqRows.filter((r) => ["Filled", "Closed", "Cancelled", "Rejected"].includes(r["Requirement Status"])));
      addSheet("Interview Offer Joining", interviewRows);
      addSheet("All Requirements", reqRows);
    }
    XLSX.writeFile(wb, `BAUER_Recruitment_${mode === "candidate" ? "Candidate_Tracker" : mode === "requirements" ? "Requirements" : "MIS"}_${today}.xlsx`);
  };

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
    const activeCandidates = store.candidates.filter((candidate) => !["Joined", "Rejected", "Withdrawn", "No Show"].includes(candidate.stage)).length;
    const offerReleased = store.offers.filter((offer) => ["Generated", "Sent", "Accepted"].includes(offer.status)).length;
    const backouts = store.candidates.filter((candidate) => ["Withdrawn", "No Show"].includes(candidate.stage)).length
      + store.offers.filter((offer) => ["Declined", "Withdrawn"].includes(offer.status)).length;
    const overviewCards = [
      ["Open Positions", stats.openPositions, "Open / balance vacancies", "briefcase", "blue", () => setView("Requirements")],
      ["Active Candidates", activeCandidates, "Across all stages", "people", "green", () => setView("Candidate Tracker")],
      ["Offers Released", offerReleased, "Generated, sent or accepted", "file", "amber", () => setView("Offers & Joining")],
      ["Joining Due", stats.joiningPending, "Expected / confirmed joining", "calendar", "orange", () => setView("Offers & Joining")],
      ["Joined", stats.joined, "Employee handoff ready", "check", "mint", () => setView("Offers & Joining")],
      ["Pre-Joining Backouts", backouts, "Declined, withdrawn or no-show", "backout", "red", () => setView("Candidate Tracker")],
    ];
    const overviewFunnel = [
      ["CV Received", store.candidates.length, "file", "blue"],
      ["Screening", store.candidates.filter((candidate) => ["Screening", "Shortlisted"].includes(candidate.stage)).length, "people", "purple"],
      ["Interview", store.candidates.filter((candidate) => ["Interview Scheduled", "Interviewed"].includes(candidate.stage)).length, "people", "violet"],
      ["Selected", store.candidates.filter((candidate) => candidate.stage === "Selected").length, "check", "green"],
      ["Offer Released", store.candidates.filter((candidate) => candidate.stage === "Offer Released").length, "file", "amber"],
      ["Offer Accepted", store.candidates.filter((candidate) => candidate.stage === "Offer Accepted").length, "people", "sky"],
      ["Joined", stats.joined, "check", "mint"],
      ["Backout", backouts, "backout", "red"],
    ];
    const trackerRows = getActionRows.filter((row) => {
      const text = `${row.c.name} ${row.c.candidateNo || ""} ${row.req?.title || ""} ${row.req?.location || ""}`.toLowerCase();
      return !search || text.includes(search.toLowerCase());
    }).slice(0, 10);

    return <>
      <div className="rec-overview-stats">
        {overviewCards.map(([label, value, note, icon, tone, onClick]) => <button type="button" className={`rec-overview-stat ${tone}`} onClick={onClick} key={label}>
          <span className="rec-overview-stat-icon">{icon === "briefcase" ? "▣" : icon === "people" ? "♙" : icon === "file" ? "▤" : icon === "calendar" ? "◷" : icon === "check" ? "✓" : "✕"}</span>
          <span><small>{label}</small><strong>{value || 0}</strong><em>{note}</em></span>
        </button>)}
      </div>

      <section className="rec-overview-funnel rec-card">
        <div className="rec-card-head"><div><h3>Recruitment Funnel</h3><p>See the live movement of candidates across each hiring stage.</p></div><button className="rec-link-btn" onClick={() => setView("Candidate Tracker")}>View candidates →</button></div>
        <div className="rec-overview-funnel-steps">
          {overviewFunnel.map(([label, value, icon, tone], index) => <div className="rec-overview-funnel-step" key={label}>
            <button type="button" className={`rec-overview-funnel-tile ${tone}`} onClick={() => setView("Candidate Tracker")}><span>{icon === "file" ? "▤" : icon === "check" ? "✓" : icon === "backout" ? "✕" : "♙"}</span><div><small>{label}</small><strong>{value || 0}</strong></div></button>
            {index < overviewFunnel.length - 1 && <b>→</b>}
          </div>)}
        </div>
      </section>

      <div className="rec-overview-main-grid">
        <section className="rec-card rec-overview-tracker">
          <div className="rec-card-head"><div><h3>Offer &amp; Joining Tracker</h3><p>Track candidate offers, expected joining and actual joining dates.</p></div><div className="rec-overview-actions"><label className="rec-overview-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate, code or position..." /></label><button className="rec-secondary" onClick={() => exportRecruitmentMIS("candidate")}>↓ Export</button></div></div>
          <div className="rec-table-wrap"><table className="rec-table rec-overview-table"><thead><tr><th>#</th><th>Candidate Name</th><th>Employee Code</th><th>Designation</th><th>Project / Site</th><th>Offer Date</th><th>Offer DOJ</th><th>Actual DOJ</th><th>Variance</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {trackerRows.map((row, index) => {
              const expectedDate = row.joining?.expectedDate || row.offer?.joiningDate;
              const actualDate = row.joining?.actualDate;
              const variance = expectedDate && actualDate ? Math.round((new Date(`${actualDate}T00:00:00`) - new Date(`${expectedDate}T00:00:00`)) / 86400000) : null;
              const status = row.joining?.status || row.offer?.status || row.c.stage;
              return <tr key={row.c.id}><td>{index + 1}</td><td><button className="rec-table-link" onClick={() => openCandidate(row.c)}><strong>{row.c.name}</strong><span className="rec-sub">{row.c.mobile || row.c.email || "Candidate"}</span></button></td><td>{row.c.candidateNo || row.c.id}</td><td>{row.req?.title || row.c.currentDesignation || "—"}</td><td>{row.req?.location || row.c.preferredLocation || row.c.location || "—"}</td><td>{formatDate(row.offer?.issueDate)}</td><td>{formatDate(expectedDate)}</td><td>{formatDate(actualDate)}</td><td className={variance > 0 ? "rec-variance-late" : ""}>{variance === null ? "—" : variance === 0 ? "On time" : `${variance > 0 ? "+" : ""}${variance} day${Math.abs(variance) === 1 ? "" : "s"}`}</td><td><StatusBadge>{status}</StatusBadge></td><td><div className="rec-overview-row-actions"><button type="button" onClick={() => openCandidate(row.c)} title="View candidate">◉</button><button type="button" onClick={() => openOfferForCandidate(row.c)} title="Manage offer">✎</button><button type="button" onClick={() => openCandidate(row.c, "Documents & BGV")} title="Documents">⋮</button></div></td></tr>;
            })}
          </tbody></table></div>
          {!trackerRows.length && <div className="rec-empty">No candidates match the current search.</div>}
          <div className="rec-overview-card-footer"><button className="rec-link-btn" onClick={() => setView("Candidate Tracker")}>View all candidates →</button><button className="rec-primary" onClick={() => setCandidateModal(true)}>＋ Add Candidate</button></div>
        </section>

        <aside className="rec-overview-attention rec-card">
          <div className="rec-card-head"><div><h3>Attention Required</h3><p>Items which need recruitment follow-up.</p></div></div>
          <button className="rec-attention-row overdue" onClick={() => setView("Offers & Joining")}><span>◷</span><b>Joining overdue</b><strong>{overdueActions}</strong><i>›</i></button>
          <button className="rec-attention-row due" onClick={() => setView("Offers & Joining")}><span>▣</span><b>Joining in next 7 days</b><strong>{stats.joiningPending}</strong><i>›</i></button>
          <button className="rec-attention-row backout" onClick={() => setView("Candidate Tracker")}><span>⚑</span><b>Backout cases</b><strong>{backouts}</strong><i>›</i></button>
          <button className="rec-attention-row mapping" onClick={() => setView("Selection & Mapping")}><span>✓</span><b>Experience mapping pending</b><strong>{stats.mappingPending}</strong><i>›</i></button>
          <button className="rec-attention-row documents" onClick={() => setView("Documents & BGV")}><span>▤</span><b>Documents / BGV pending</b><strong>{stats.docsPending + stats.bgvPending}</strong><i>›</i></button>
        </aside>
      </div>

      <div className="rec-overview-lower-grid">
        <section className="rec-card"><div className="rec-card-head"><div><h3>Open Positions</h3><p>Live vacancy and candidate-pipeline status.</p></div><button className="rec-link-btn" onClick={() => setView("Requirements")}>View all →</button></div><div className="rec-overview-position-list">{activeRequirements.slice(0, 5).map((requirement) => { const filled = store.candidates.filter((candidate) => candidate.requirementId === requirement.id && ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(candidate.stage)).length; const balance = Math.max(0, Number(requirement.vacancies || 0) - filled); return <button type="button" key={requirement.id} onClick={() => setView("Requirements")}><span><b>{requirement.title}</b><small>{requirement.department || "—"} · {requirement.location || "—"}</small></span><em>{filled}/{requirement.vacancies || 0} filled</em><strong className={balance ? "open" : "closed"}>{balance} open</strong></button>; })}{!activeRequirements.length && <div className="rec-empty">No open positions.</div>}</div></section>
        <section className="rec-card"><div className="rec-card-head"><div><h3>Priority Candidate Actions</h3><p>Next actions, reminders and pending decisions.</p></div><button className="rec-link-btn" onClick={() => setView("Candidate Tracker")}>Open tracker →</button></div><div className="rec-overview-action-list">{getActionRows.filter((row) => row.c.nextAction || row.c.nextActionDate).sort((a, b) => String(a.c.nextActionDate || "9999").localeCompare(String(b.c.nextActionDate || "9999"))).slice(0, 5).map((row) => <button type="button" key={row.c.id} onClick={() => openCandidate(row.c)}><span className="rec-avatar">{initials(row.c.name)}</span><span><b>{row.c.name}</b><small>{row.c.nextAction || "Review candidate"} · {formatDate(row.c.nextActionDate)}</small></span><StatusBadge tone={row.c.nextActionDate && row.c.nextActionDate < today ? "danger-badge" : "pending-badge"}>{row.c.nextActionDate && row.c.nextActionDate < today ? "Overdue" : "Action"}</StatusBadge></button>)}{!getActionRows.some((row) => row.c.nextAction || row.c.nextActionDate) && <div className="rec-empty">No pending candidate actions.</div>}</div></section>
      </div>
    </>;
  };

  const renderRequirements = () => {
    const visibleRequirements = filteredRequirements.filter((requirement) => !search || `${requirement.id} ${requirement.requirementNo || ""} ${requirement.title} ${requirement.department} ${requirement.location} ${requirement.recruiter}`.toLowerCase().includes(search.toLowerCase()));
    const filledPositions = store.candidates.filter((candidate) => ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(candidate.stage)).length;
    const targetThisMonth = activeRequirements.filter((requirement) => requirement.targetDate && requirement.targetDate.slice(0, 7) === today.slice(0, 7)).length;
    const requirementMetrics = [
      ["Active Requirements", activeRequirements.length, "Draft, pending, approved or on hold", "▣", "blue"],
      ["Open Positions", stats.openPositions, "Vacancies still to be filled", "◌", "orange"],
      ["Filled Pipeline", filledPositions, "Selected to joined candidates", "✓", "green"],
      ["Target This Month", targetThisMonth, "Requirements with a current target", "◷", "purple"],
    ];

    return <div className="rec-detail-page">
      <section className="rec-list-hero requirements"><div><span className="rec-eyebrow">MANPOWER PLANNING</span><h2>Open Positions</h2><p>Create, monitor and close requirements while keeping the vacancy pipeline visible.</p></div><button className="rec-primary rec-hero-add" onClick={() => setReqModal(true)}>＋ New Requirement</button></section>
      <div className="rec-list-metrics">{requirementMetrics.map(([label, value, note, icon, tone]) => <div className={`rec-list-metric ${tone}`} key={label}><span>{icon}</span><div><small>{label}</small><strong>{value || 0}</strong><em>{note}</em></div></div>)}</div>
      <section className="rec-card rec-list-card">
        <div className="rec-card-head"><div><h3>Requirements &amp; Candidate Pipeline</h3><p>Live requirement status, vacant positions and recruitment progress.</p></div><div className="rec-list-head-actions"><button className="rec-secondary" onClick={() => exportRecruitmentMIS("requirements")}>↓ Export Requirements</button><button className="rec-secondary" onClick={() => downloadTemplate("requirements")}>↓ Template</button><label className="rec-secondary rec-upload-button">↑ Import Requirements<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { importRequirementsExcel(event.target.files?.[0]); event.target.value = ""; }} /></label><button className="rec-primary" onClick={() => setReqModal(true)}>＋ Add Position</button></div></div>
        <div className="rec-list-toolbar"><label className="rec-list-search">⌕<input placeholder="Search requirement, position, department or site..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><select value={reqFilter} onChange={(event) => setReqFilter(event.target.value)}><option value="All">All statuses</option>{REQ_STATUSES.map((status) => <option key={status}>{status}</option>)}</select><span className="rec-list-count">{visibleRequirements.length} requirement{visibleRequirements.length === 1 ? "" : "s"}</span></div>
        <div className="rec-table-wrap"><table className="rec-table rec-requirement-table"><thead><tr><th>#</th><th>Position</th><th>Requirement ID</th><th>Department</th><th>Project / Site</th><th>Required</th><th>Pipeline</th><th>Open</th><th>Target joining</th><th>Recruiter</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {visibleRequirements.map((requirement, index) => {
            const filled = store.candidates.filter((candidate) => candidate.requirementId === requirement.id && ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(candidate.stage)).length;
            const balance = Math.max(0, Number(requirement.vacancies || 0) - filled);
            const candidateCount = store.candidates.filter((candidate) => candidate.requirementId === requirement.id).length;
            return <tr key={requirement.id}><td>{index + 1}</td><td><button className="rec-table-link" onClick={() => setView("Candidate Tracker")}><strong>{requirement.title}</strong><span className="rec-sub">{requirement.reason || "New position"} · {candidateCount} candidate{candidateCount === 1 ? "" : "s"}</span></button></td><td>{requirement.requirementNo || requirement.id}</td><td>{requirement.department || "—"}</td><td>{requirement.location || "—"}</td><td><b>{requirement.vacancies || 0}</b></td><td><span className="rec-pipeline-count"><b>{filled}</b> filled</span></td><td><b className={balance ? "rec-open-count" : "rec-filled-count"}>{balance}</b></td><td>{formatDate(requirement.targetDate)}</td><td>{requirement.recruiter || "Unassigned"}</td><td><StatusBadge>{requirement.status}</StatusBadge></td><td><div className="rec-list-row-actions">{requirement.status === "Draft" && <button type="button" onClick={() => updateRequirementStatus(requirement.id, "Pending Approval")}>Submit</button>}{requirement.status === "Pending Approval" && <button type="button" onClick={() => updateRequirementStatus(requirement.id, "Approved")}>Approve</button>}<button type="button" onClick={() => { setCandidateForm({ ...EMPTY_CANDIDATE, requirementId: requirement.id, category: requirement.category || "On Roll", stage: "New", recruiter: requirement.recruiter || "" }); setCandidateModal(true); }}>＋ Candidate</button><button type="button" className="more" aria-label={`More actions for ${requirement.title}`} onClick={(event) => { event.stopPropagation(); setRequirementActionModal(requirement); }}>•••</button></div></td></tr>;
          })}
        </tbody></table></div>
        {!visibleRequirements.length && <div className="rec-empty-state"><span>▣</span><h4>No requirements yet</h4><p>Create the first open position to start building your candidate pipeline.</p><button className="rec-primary" onClick={() => setReqModal(true)}>＋ Create Requirement</button></div>}
      </section>
    </div>;
  };

  const renderCandidates = () => {
    const candidateMetrics = [
      ["All Candidates", store.candidates.length, "Across all open positions", "♙", "blue"],
      ["In Screening", store.candidates.filter((candidate) => ["New", "Screening", "Shortlisted"].includes(candidate.stage)).length, "New and under review", "⌕", "purple"],
      ["Interview Stage", store.candidates.filter((candidate) => ["Interview Scheduled", "Interviewed"].includes(candidate.stage)).length, "Scheduled or feedback pending", "◷", "amber"],
      ["Offer / Joining", store.candidates.filter((candidate) => ["Offer Released", "Offer Accepted", "Joining Scheduled"].includes(candidate.stage)).length, "Candidates nearing joining", "✓", "green"],
    ];
    const exportCandidateCsv = () => exportCSV(filteredCandidates.map((candidate) => {
      const requirement = requirementById(candidate.requirementId);
      const offer = offerByCandidate(candidate.id);
      const joining = joiningByCandidate(candidate.id);
      return { "Candidate ID": candidate.candidateNo || candidate.id, Name: candidate.name, Mobile: candidate.mobile, Email: candidate.email, Position: requirement?.title || candidate.currentDesignation || "", Site: requirement?.location || candidate.location || "", Source: candidate.source || "", Stage: candidate.stage || "", "Offer DOJ": offer?.joiningDate || "", "Actual DOJ": joining?.actualDate || "", Owner: candidate.owner || candidate.recruiter || "" };
    }), `BAUER_Recruitment_Candidate_Tracker_${today}.csv`);

    return <div className="rec-detail-page">
      <section className="rec-list-hero candidates"><div><span className="rec-eyebrow">CANDIDATE TRACKER</span><h2>Candidate Control Tower</h2><p>Review every candidate from CV received to offer, joining and employee handoff.</p></div><button className="rec-primary rec-hero-add" onClick={() => setCandidateModal(true)}>＋ Add Candidate</button></section>
      <div className="rec-list-metrics">{candidateMetrics.map(([label, value, note, icon, tone]) => <div className={`rec-list-metric ${tone}`} key={label}><span>{icon}</span><div><small>{label}</small><strong>{value || 0}</strong><em>{note}</em></div></div>)}</div>
      <section className="rec-card rec-list-card">
        <div className="rec-card-head"><div><h3>Candidates <span className="rec-heading-muted">(All Positions)</span></h3><p>Click a candidate to open their complete recruitment profile. CV can be attached after bulk import.</p></div><div className="rec-list-head-actions"><button className="rec-secondary" onClick={() => exportRecruitmentMIS("candidate")}>↓ Export Candidate Excel</button><button className="rec-secondary" onClick={exportCandidateCsv}>↓ Export CSV</button><button className="rec-secondary" onClick={() => downloadTemplate("candidates")}>↓ Template</button><label className="rec-secondary rec-upload-button">↑ Import Candidates<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { importCandidatesExcel(event.target.files?.[0]); event.target.value = ""; }} /></label><button className="rec-primary" onClick={() => setCandidateModal(true)}>＋ Add Candidate</button></div></div>
        <div className="rec-list-toolbar candidate-filters"><label className="rec-list-search">⌕<input placeholder="Search candidate, mobile, company, designation or position..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="All">All stages</option>{CANDIDATE_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="All">All categories</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><span className="rec-list-count">{filteredCandidates.length} candidate{filteredCandidates.length === 1 ? "" : "s"}</span></div>
        <div className="rec-table-wrap"><table className="rec-table rec-candidate-table"><thead><tr><th>#</th><th>Candidate</th><th>Employee code</th><th>Position</th><th>Project / Site</th><th>Source</th><th>CV received</th><th>Current stage</th><th>Offer DOJ</th><th>Actual DOJ</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {filteredCandidates.map((candidate, index) => {
            const requirement = requirementById(candidate.requirementId);
            const latestInterview = store.interviews.filter((interview) => interview.candidateId === candidate.id).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0];
            const offer = offerByCandidate(candidate.id);
            const joining = joiningByCandidate(candidate.id);
            const documentSummary = getDocumentSummary(candidate.id);
            return <tr key={candidate.id}><td>{index + 1}</td><td><button className="rec-table-link rec-candidate-cell" onClick={() => openCandidate(candidate)}><span className="rec-avatar">{initials(candidate.name)}</span><span><strong>{candidate.name}</strong><small>{candidate.candidateNo || candidate.id} · {candidate.mobile || "No mobile"}</small></span></button></td><td>{candidate.candidateNo || candidate.id}</td><td>{requirement?.title || candidate.currentDesignation || "—"}</td><td>{requirement?.location || candidate.preferredLocation || candidate.location || "—"}</td><td>{candidate.source || "—"}</td><td><StatusBadge>{hasMandatoryCv(candidate.id) ? "Attached" : "Missing"}</StatusBadge></td><td><StatusBadge>{candidate.stage || "New"}</StatusBadge><span className="rec-sub">{latestInterview?.status || "No interview"}</span></td><td>{formatDate(offer?.joiningDate)}</td><td>{formatDate(joining?.actualDate)}</td><td><StatusBadge>{joining?.status || offer?.status || candidate.stage || "—"}</StatusBadge><span className="rec-sub">Docs: {documentSummary.pending === 0 ? "Complete" : "Pending"}</span></td><td><div className="rec-list-row-actions"><button type="button" onClick={() => openCandidate(candidate)}>View</button><button type="button" onClick={() => openOfferForCandidate(candidate)}>Offer</button><button type="button" className="more" onClick={() => openCandidate(candidate, "Documents & BGV")}>•••</button></div></td></tr>;
          })}
        </tbody></table></div>
        {!filteredCandidates.length && <div className="rec-empty-state"><span>♙</span><h4>No candidates match these filters</h4><p>Add a candidate or change the active filters to see recruitment activity here.</p><button className="rec-primary" onClick={() => setCandidateModal(true)}>＋ Add Candidate</button></div>}
      </section>
    </div>;
  };

  const FeatureHero = ({ eyebrow, title, description, tone = "", children }) => <section className={`rec-feature-hero ${tone}`}><div><span className="rec-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{children && <div className="rec-feature-hero-actions">{children}</div>}</section>;
  const renderFeatureMetrics = (items) => <div className="rec-feature-metrics">{items.map(([label, value, note, icon, tone]) => <div className={`rec-feature-metric ${tone}`} key={label}><span>{icon}</span><div><small>{label}</small><strong>{value || 0}</strong><em>{note}</em></div></div>)}</div>;

  const renderInterviews = () => {
    const scheduled = store.interviews.filter((interview) => interview.status === "Scheduled").length;
    const feedbackPending = store.interviews.filter((interview) => interview.status === "Feedback Pending" || interview.status === "Completed" && !interview.feedback?.recommendation).length;
    const completed = store.interviews.filter((interview) => interview.status === "Completed").length;
    const noShow = store.interviews.filter((interview) => interview.status === "No Show").length;
    return <div className="rec-detail-page"><FeatureHero eyebrow="INTERVIEW MANAGEMENT" title="Interview Tracker" description="Schedule rounds, assign panels and close feedback without losing candidate context." tone="interviews"><button className="rec-primary" onClick={() => setInterviewModal(true)}>＋ Schedule Interview</button></FeatureHero>{renderFeatureMetrics([["Scheduled", scheduled, "Upcoming interview rounds", "◷", "blue"], ["Feedback Pending", feedbackPending, "Rounds awaiting a decision", "◌", "amber"], ["Completed", completed, "Feedback recorded", "✓", "green"], ["No Show", noShow, "Candidate did not attend", "!", "red"]])}<section className="rec-card rec-feature-card"><div className="rec-card-head"><div><h3>Interview Schedule</h3><p>Candidate, panel, mode and feedback progress in one place.</p></div><button className="rec-secondary" onClick={() => setInterviewModal(true)}>＋ Add Interview</button></div><div className="rec-interview-grid">{store.interviews.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((interview) => { const candidate = candidateById(interview.candidateId); return <div className="rec-interview-card" key={interview.id}><div className="rec-interview-top"><span>{interview.round}</span><StatusBadge>{interview.status}</StatusBadge></div><h4>{candidate?.name || interview.candidateId}</h4><p>{candidate?.currentDesignation || "Candidate"} · {candidate?.mobile || "No mobile"}</p><div className="rec-interview-meta"><span>◷ {formatDate(interview.date)} · {interview.time}</span><span>⌁ {interview.mode} {interview.location || interview.meetingLink || ""}</span><span>♙ {interview.panel || "Panel not assigned"}</span><span>Coordinator: {interview.coordinator || "—"}</span></div><div className="rec-interview-actions">{interview.mode === "Online" && interview.meetingLink && <a href={interview.meetingLink} target="_blank" rel="noreferrer">Meeting ↗</a>}<button onClick={() => openCandidate(candidate, "Interview")}>Candidate</button><button onClick={() => openFeedback(interview)}>Feedback</button></div></div>})}</div>{!store.interviews.length && <div className="rec-empty-state"><span>◷</span><h4>No interviews scheduled</h4><p>Schedule an interview round when a candidate reaches the screening or shortlisted stage.</p><button className="rec-primary" onClick={() => setInterviewModal(true)}>＋ Schedule Interview</button></div>}</section></div>;
  };

  const renderSelectionMapping = () => {
    const selectedCandidates = store.candidates.filter((candidate) => ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(candidate.stage));
    const mappingPending = selectedCandidates.filter((candidate) => candidate.mappingStatus !== "Verified").length;
    const mappingVerified = selectedCandidates.filter((candidate) => candidate.mappingStatus === "Verified").length;
    const mappingMismatch = selectedCandidates.filter((candidate) => candidate.mappingStatus === "Mismatch").length;
    return <div className="rec-detail-page"><FeatureHero eyebrow="SELECTION CONTROL" title="Selection & Experience Mapping" description="Verify employment history and supporting documents before a candidate moves to offer-ready." tone="mapping">{selectedCandidates.length > 0 && <button className="rec-secondary" onClick={() => openMappingForCandidate(selectedCandidates[0])}>✎ Open Mapping</button>}</FeatureHero>{renderFeatureMetrics([["Selected Candidates", selectedCandidates.length, "Candidates ready for validation", "♙", "blue"], ["Mapping Pending", mappingPending, "Awaiting experience review", "◌", "amber"], ["Verified", mappingVerified, "Ready to move forward", "✓", "green"], ["Mismatch", mappingMismatch, "Needs HR attention", "!", "red"]])}<section className="rec-card rec-feature-card"><div className="rec-card-head"><div><h3>Experience Verification Queue</h3><p>Compare CV experience, submitted certificates and HR validation in one workflow.</p></div><button className="rec-secondary" onClick={() => setView("Candidate Tracker")}>View Candidates</button></div><div className="rec-table-wrap"><table className="rec-table rec-feature-table"><thead><tr><th>Candidate</th><th>Requirement</th><th>Stage</th><th>Mapping status</th><th>Certificate</th><th>Relevant experience</th><th>Verified by</th><th>Action</th></tr></thead><tbody>{selectedCandidates.map((candidate) => { const latest = mappingByCandidate(candidate.id)[0]; return <tr key={candidate.id}><td><button className="rec-table-link" onClick={() => openCandidate(candidate, "Mapping")}><strong>{candidate.name}</strong><span className="rec-sub">{candidate.candidateNo || candidate.id}</span></button></td><td>{requirementById(candidate.requirementId)?.title || candidate.currentDesignation || "—"}</td><td><StatusBadge>{candidate.stage}</StatusBadge></td><td><StatusBadge>{latest?.mappingStatus || candidate.mappingStatus || "Not Started"}</StatusBadge></td><td>{latest?.certificateStatus || "Pending Certificate"}</td><td>{latest?.relevantExperience || candidate.relevantExperience || "—"}</td><td>{latest?.verifiedBy || "—"}</td><td><button className="rec-inline-action" onClick={() => openMappingForCandidate(candidate)}>Update Mapping</button></td></tr>; })}</tbody></table></div>{!selectedCandidates.length && <div className="rec-empty-state"><span>✓</span><h4>No candidates awaiting mapping</h4><p>Selected candidates will appear here for experience and document verification.</p><button className="rec-secondary" onClick={() => setView("Candidate Tracker")}>Open Candidate Tracker</button></div>}</section></div>;
  };

  const renderDocumentsBGV = () => {
    const documentCandidates = store.candidates.filter((candidate) => !["New", "Rejected", "Withdrawn"].includes(candidate.stage));
    const documentsPending = documentCandidates.filter((candidate) => getDocumentSummary(candidate.id).pending > 0).length;
    const bgvInProgress = store.bgv.filter((item) => ["Initiated", "Documents Awaited", "Submitted", "In Progress"].includes(item.status)).length;
    const bgvClear = store.bgv.filter((item) => item.status === "Clear").length;
    return <div className="rec-detail-page"><FeatureHero eyebrow="DOCUMENT CONTROL" title="Documents & BGV" description="Keep pre-joining documents, verification status and candidate follow-ups under control." tone="documents"><button className="rec-secondary" onClick={() => setBgvModal(true)}>＋ Start BGV</button></FeatureHero>{renderFeatureMetrics([["In Document Control", documentCandidates.length, "Candidates requiring records", "▤", "blue"], ["Documents Pending", documentsPending, "Mandatory document follow-up", "◌", "amber"], ["BGV In Progress", bgvInProgress, "Agency / HR verification", "◷", "purple"], ["BGV Clear", bgvClear, "Ready for offer workflow", "✓", "green"]])}<section className="rec-card rec-feature-card"><div className="rec-card-head"><div><h3>Document &amp; Background Check Queue</h3><p>Review document availability, verification progress and next required action.</p></div><button className="rec-primary" onClick={() => setBgvModal(true)}>＋ BGV</button></div><div className="rec-table-wrap"><table className="rec-table rec-feature-table"><thead><tr><th>Candidate</th><th>Stage</th><th>Documents</th><th>Pending</th><th>BGV</th><th>Last follow-up</th><th>Next action</th><th>Actions</th></tr></thead><tbody>{documentCandidates.map((candidate) => { const documentSummary = getDocumentSummary(candidate.id); const bgv = bgvByCandidate(candidate.id); return <tr key={candidate.id}><td><button className="rec-table-link" onClick={() => openCandidate(candidate, "Documents & BGV")}><strong>{candidate.name}</strong><span className="rec-sub">{candidate.candidateNo || candidate.id}</span></button></td><td><StatusBadge>{candidate.stage}</StatusBadge></td><td><StatusBadge>{documentSummary.pending === 0 ? "Complete" : "Pending"}</StatusBadge><span className="rec-sub">{documentSummary.verified}/{documentSummary.total} verified</span></td><td>{documentSummary.pending}</td><td><StatusBadge>{bgv?.status || "Not Initiated"}</StatusBadge></td><td>{formatDate(candidate.followUpDate)}</td><td>{candidate.nextAction || "Follow up"}<span className="rec-sub">{formatDate(candidate.nextActionDate)}</span></td><td><div className="rec-list-row-actions"><button onClick={() => openCandidate(candidate, "Documents & BGV")}>Manage</button><button onClick={() => { setBgvForm(bgv ? { ...EMPTY_BGV, ...bgv } : { ...EMPTY_BGV, candidateId: candidate.id }); setBgvModal(true); }}>BGV</button></div></td></tr>; })}</tbody></table></div>{!documentCandidates.length && <div className="rec-empty-state"><span>▤</span><h4>No document controls pending</h4><p>Eligible candidates will appear here as they progress through recruitment.</p><button className="rec-secondary" onClick={() => setView("Candidate Tracker")}>Open Candidate Tracker</button></div>}</section></div>;
  };

  const renderOffersJoining = () => {
    const offerCandidates = store.candidates.filter((candidate) => ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(candidate.stage));
    const offersPending = offerCandidates.filter((candidate) => !offerByCandidate(candidate.id) || !["Accepted"].includes(offerByCandidate(candidate.id)?.status)).length;
    const joiningDue = store.joinings.filter((joining) => ["Expected", "Confirmed", "Rescheduled", "Delayed"].includes(joining.status)).length;
    return <div className="rec-detail-page"><FeatureHero eyebrow="OFFER & ONBOARDING" title="Offers & Joining" description="Create offers, confirm joining dates and hand joined candidates to Employee Master." tone="offers"><button className="rec-secondary" onClick={() => setOfferModal(true)}>＋ Offer</button><button className="rec-primary" onClick={() => setJoiningModal(true)}>＋ Joining</button></FeatureHero>{renderFeatureMetrics([["Offer-ready Candidates", offerCandidates.length, "Selected through joined pipeline", "♙", "blue"], ["Offer Follow-up", offersPending, "Offer pending or not accepted", "◌", "amber"], ["Joining Due", joiningDue, "Expected / confirmed dates", "◷", "orange"], ["Joined", stats.joined, "Ready for employee handoff", "✓", "green"]])}<section className="rec-card rec-feature-card"><div className="rec-card-head"><div><h3>Offer &amp; Joining Control</h3><p>Monitor offer status, joining confirmation and employee handoff readiness.</p></div><div className="rec-list-head-actions"><button className="rec-secondary" onClick={() => setOfferModal(true)}>＋ Offer</button><button className="rec-primary" onClick={() => setJoiningModal(true)}>＋ Joining</button></div></div><div className="rec-table-wrap"><table className="rec-table rec-feature-table"><thead><tr><th>Candidate</th><th>Designation</th><th>Category</th><th>CTC</th><th>Offer</th><th>Joining</th><th>Expected joining</th><th>Actions</th></tr></thead><tbody>{offerCandidates.map((candidate) => { const offer = offerByCandidate(candidate.id); const joining = joiningByCandidate(candidate.id); return <tr key={candidate.id}><td><button className="rec-table-link" onClick={() => openCandidate(candidate, "Offer")}><strong>{candidate.name}</strong><span className="rec-sub">{candidate.candidateNo || candidate.id}</span></button></td><td>{offer?.designation || candidate.currentDesignation || "—"}</td><td>{candidate.category}</td><td>{money(offer?.ctc)}</td><td><StatusBadge>{offer?.status || "Not Started"}</StatusBadge></td><td><StatusBadge>{joining?.status || "Not Started"}</StatusBadge></td><td>{formatDate(joining?.expectedDate || offer?.joiningDate)}</td><td><div className="rec-list-row-actions"><button onClick={() => openOfferForCandidate(candidate)}>Offer</button><button onClick={() => { setJoiningForm(joining ? { ...EMPTY_JOINING, ...joining } : { ...EMPTY_JOINING, candidateId: candidate.id, expectedDate: offer?.joiningDate || "", location: offer?.location || "", reportingManager: offer?.reportingManager || "" }); setJoiningModal(true); }}>Joining</button>{candidate.stage === "Joined" && <button onClick={() => completeEmployeeConversion(candidate)}>Employee</button>}<button className="more" onClick={() => openLetter("Offer Letter", candidate.id)}>•••</button></div></td></tr>; })}</tbody></table></div>{!offerCandidates.length && <div className="rec-empty-state"><span>⇢</span><h4>No offer-ready candidates</h4><p>Candidates will appear here after selection and experience validation.</p><button className="rec-secondary" onClick={() => setView("Selection & Mapping")}>Open Selection Control</button></div>}</section></div>;
  };

  const renderLetters = () => <div className="rec-detail-page"><FeatureHero eyebrow="HR DOCUMENTS" title="Letters & Templates" description="Maintain approved letter formats and generate candidate or employee documents quickly." tone="letters"><button className="rec-secondary" onClick={() => { setTemplateForm(DEFAULT_LETTER_TEMPLATES[0]); setTemplateModal(true); }}>＋ New Template</button></FeatureHero>{renderFeatureMetrics([["Active Templates", store.letterTemplates.filter((template) => template.active).length, "Available fixed formats", "▤", "blue"], ["Offer Letters", store.letters.filter((letter) => letter.type === "Offer Letter").length, "Generated offer documents", "⇢", "amber"], ["Appointment Letters", store.letters.filter((letter) => letter.type === "Appointment Letter").length, "Employee onboarding documents", "✓", "green"], ["Total Issued", store.letters.length, "All generated letters", "◷", "purple"]])}<section className="rec-card rec-feature-card"><div className="rec-card-head"><div><h3>Generate Letter</h3><p>Select a standard format to generate and preview a merged document.</p></div></div><div className="rec-letter-type-grid">{LETTER_TYPES.map((type) => <div className="rec-letter-type-card" key={type}><span className="rec-eyebrow">{type.replace(" Letter", "")}</span><h4>{type}</h4><p>{type === "Offer Letter" ? "Generate directly from selected or joining candidate details." : type === "Appointment Letter" ? "Generate after joining using employee and onboarding details." : "Generate after an approved exit or termination decision."}</p><button className="rec-primary" onClick={() => openLetter(type)}>Generate {type}</button></div>)}</div></section><div className="rec-feature-two-col"><section className="rec-card rec-feature-card nested"><div className="rec-card-head"><div><span className="rec-eyebrow">TEMPLATES</span><h3>Fixed Letter Formats</h3></div></div>{store.letterTemplates.map((template) => <div className="rec-setting-row" key={template.id}><span><b>{template.name}</b><small>{template.type} · {template.letterheadImage ? "Letterhead uploaded" : "No letterhead uploaded"}</small></span><div className="rec-table-actions"><StatusBadge>{template.active ? "Active" : "Inactive"}</StatusBadge><button className="rec-inline-action" onClick={() => { setTemplateForm({ ...template }); setTemplateModal(true); }}>Edit</button></div></div>)}</section><section className="rec-card rec-feature-card nested"><div className="rec-card-head"><div><span className="rec-eyebrow">GENERATED LETTERS</span><h3>Issue History</h3></div></div>{store.letters.slice(0, 10).map((letter) => <div className="rec-setting-row" key={letter.id}><span><b>{letter.type} · {candidateById(letter.candidateId)?.name || letter.candidateId}</b><small>{formatDate(letter.issueDate)} · {letter.id}</small></span><button className="rec-inline-action" onClick={() => { setLetterForm(letter); setLetterModal(true); }}>Open</button></div>)}{!store.letters.length && <div className="rec-empty-state compact"><span>▤</span><h4>No letters generated</h4><p>Generated documents will be available here.</p></div>}</section></div></div>;

  const renderReports = () => {
    const sourceCounts = SOURCES.map((source) => [source, store.candidates.filter((candidate) => candidate.source === source).length]).filter(([, count]) => count);
    const stageCounts = CANDIDATE_STAGES.map((stage) => [stage, store.candidates.filter((candidate) => candidate.stage === stage).length]).filter(([, count]) => count);
    const categoryCounts = CATEGORIES.map((category) => [category, store.candidates.filter((candidate) => candidate.category === category).length]).filter(([, count]) => count);
    const mappingCandidates = store.candidates.filter((candidate) => ["Selected", "Offer Released", "Offer Accepted", "Joining Scheduled", "Joined"].includes(candidate.stage));
    const controlledCandidates = store.candidates.filter((candidate) => !["New", "Rejected", "Withdrawn"].includes(candidate.stage));
    return <div className="rec-detail-page"><FeatureHero eyebrow="RECRUITMENT ANALYTICS" title="Reports & MIS" description="View pipeline health, hiring demand and export a complete recruitment workbook." tone="reports"><button className="rec-primary" onClick={() => exportRecruitmentMIS("all")}>↓ Export Complete MIS (.xlsx)</button></FeatureHero>{renderFeatureMetrics([["Total Candidates", store.candidates.length, "All recruitment records", "♙", "blue"], ["Selected", stats.selected, "Selection and offer pipeline", "✓", "green"], ["Joining Due", stats.joiningPending, "Expected / confirmed joining", "◷", "amber"], ["Open Positions", stats.openPositions, "Vacancy demand remaining", "▣", "orange"]])}<div className="rec-report-grid"><div className="rec-card rec-mis-export"><div className="rec-card-head"><div><span className="rec-eyebrow">EXPORT CENTER</span><h3>Recruitment MIS Export</h3><p>Download one Excel workbook with candidate pipeline, open positions, interviews, offers and joining records.</p></div><button className="rec-primary" onClick={() => exportRecruitmentMIS("all")}>↓ Export Complete MIS (.xlsx)</button></div></div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">SOURCE PERFORMANCE</span><h3>Candidate Source Analysis</h3></div></div>{sourceCounts.length ? sourceCounts.map(([source, count]) => <div className="rec-report-row" key={source}><span>{source}<small>{count} candidate{count === 1 ? "" : "s"}</small></span><b>{count}</b></div>) : <div className="rec-empty">No source data yet.</div>}</div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">PIPELINE ANALYSIS</span><h3>Stage Distribution</h3></div></div>{stageCounts.length ? stageCounts.map(([stage, count]) => <div className="rec-report-row" key={stage}><span>{stage}</span><b>{count}</b></div>) : <div className="rec-empty">No pipeline data yet.</div>}</div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">CATEGORY ANALYSIS</span><h3>Workforce Category</h3></div></div>{categoryCounts.length ? categoryCounts.map(([category, count]) => <div className="rec-report-row" key={category}><span>{category}</span><b>{count}</b></div>) : <div className="rec-empty">No category data yet.</div>}</div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">EXPERIENCE MAPPING</span><h3>Mapping Control</h3></div></div>{[["Not Started", mappingCandidates.filter((candidate) => !candidate.mappingStatus || candidate.mappingStatus === "Not Started").length], ["In Progress", mappingCandidates.filter((candidate) => candidate.mappingStatus === "In Progress").length], ["Verified", mappingCandidates.filter((candidate) => candidate.mappingStatus === "Verified").length], ["Mismatch", mappingCandidates.filter((candidate) => candidate.mappingStatus === "Mismatch").length]].map(([label, count]) => <div className="rec-report-row" key={label}><span>{label}</span><b>{count}</b></div>)}</div><div className="rec-card"><div className="rec-card-head"><div><span className="rec-eyebrow">DOCUMENTS / BGV</span><h3>Document &amp; BGV Control</h3></div></div>{[["Documents Pending", controlledCandidates.filter((candidate) => getDocumentSummary(candidate.id).pending > 0).length], ["BGV Not Initiated", controlledCandidates.filter((candidate) => !bgvByCandidate(candidate.id)).length], ["BGV In Progress", store.bgv.filter((item) => ["Initiated", "Documents Awaited", "Submitted", "In Progress"].includes(item.status)).length], ["BGV Clear", store.bgv.filter((item) => item.status === "Clear").length]].map(([label, count]) => <div className="rec-report-row" key={label}><span>{label}</span><b>{count}</b></div>)}</div></div></div>;
  };

  const renderSettings = () => <div className="rec-detail-page"><FeatureHero eyebrow="RECRUITMENT SETTINGS" title="Configuration & Controls" description="Review recruitment masters, connected HRMS modules and operational control rules." tone="settings"><button className="rec-secondary" onClick={() => setView("Reports")}>View Reports</button></FeatureHero>{renderFeatureMetrics([["Candidate Sources", SOURCES.length, "Configured sourcing channels", "♙", "blue"], ["Candidate Stages", CANDIDATE_STAGES.length, "Pipeline progression stages", "⇢", "purple"], ["Document Types", DOCUMENT_TYPES.length, "Pre-joining document checklist", "▤", "amber"], ["Letter Types", LETTER_TYPES.length, "Available HR documents", "✓", "green"]])}<div className="rec-settings-grid rec-feature-settings"><section className="rec-card"><span className="rec-eyebrow">MASTERS</span><h3>Recruitment Configuration</h3>{[["Candidate Sources", SOURCES.length], ["Candidate Stages", CANDIDATE_STAGES.length], ["Interview Rounds", INTERVIEW_ROUNDS.length], ["Document Types", DOCUMENT_TYPES.length], ["Letter Types", LETTER_TYPES.length]].map(([label, value]) => <div className="rec-setting-row" key={label}><span>{label}</span><b>{value}</b></div>)}</section><section className="rec-card"><span className="rec-eyebrow">INTEGRATION</span><h3>HRMS Connections</h3><div className="rec-integration"><span>Employee Master</span><StatusBadge tone="connected">Connected</StatusBadge></div><div className="rec-integration"><span>Organization Masters</span><StatusBadge tone="connected">Connected</StatusBadge></div><div className="rec-integration"><span>Payroll / Policy Management</span><StatusBadge tone="ready">Ready for handoff</StatusBadge></div><div className="rec-integration"><span>Data Persistence</span><StatusBadge tone="connected">Supabase</StatusBadge></div></section><section className="rec-card"><span className="rec-eyebrow">SLA / CONTROL</span><h3>Recruitment SLA</h3>{[["Interview Feedback SLA", "24 hrs"], ["Experience Mapping SLA", "2 days"], ["BGV SLA", "5 days"], ["Offer SLA", "2 days"]].map(([label, value]) => <div className="rec-setting-row" key={label}><span>{label}</span><b>{value}</b></div>)}</section><section className="rec-card"><span className="rec-eyebrow">DAILY DISCIPLINE</span><h3>Control Rules</h3><div className="rec-rule-list"><p>• Every active candidate must have exactly one current stage.</p><p>• Every active candidate must have one next action and next action date.</p><p>• Selected candidates must be mapped before offer readiness.</p><p>• Shortlisted or selected candidates must have document and BGV visibility.</p><p>• Joined candidates can be handed off to Employee Master.</p></div></section></div></div>;

  const renderCandidateDetail = () => { if (!currentCandidate) return null; const c=currentCandidate; const req=requirementById(c.requirementId); const offer=offerByCandidate(c.id); const joining=joiningByCandidate(c.id); const bgv=bgvByCandidate(c.id); const docs=documentsByCandidate(c.id); const maps=mappingByCandidate(c.id); const interviews=store.interviews.filter(i=>i.candidateId===c.id); return <Modal title={`${c.name} · ${c.candidateNo||c.id}`} onClose={()=>setCandidateDetail(null)} wide><div className="rec-profile-head"><div className="rec-avatar large">{initials(c.name)}</div><div><h3>{c.name}</h3><p>{c.currentDesignation||req?.title||"Candidate"} · {req?.department||"—"} · {req?.location||c.location||"—"}</p><div className="rec-profile-badges"><StatusBadge>{c.stage}</StatusBadge><StatusBadge>{c.category}</StatusBadge><span className="rec-sub">Owner: {c.owner||c.recruiter||"—"}</span></div></div><div className="rec-profile-actions"><button className="rec-primary" onClick={()=>openOfferForCandidate(c)}>Offer</button><button className="rec-secondary" onClick={()=>openLetter("Offer Letter",c.id)}>Offer Letter</button></div></div><div className="rec-profile-tabs">{["Overview","Interview","Mapping","Documents & BGV","Offer","Joining","Activity"].map(t=><button key={t} className={activeCandidateTab===t?"active":""} onClick={()=>setActiveCandidateTab(t)}>{t}</button>)}</div>{activeCandidateTab==="Overview"&&<div className="rec-detail-grid"><div className="rec-detail-section"><h4>Candidate</h4><Info label="Mobile" value={c.mobile}/><Info label="Email" value={c.email}/><Info label="Current Company" value={c.currentCompany}/><Info label="Current Designation" value={c.currentDesignation}/><Info label="Total Experience" value={c.totalExperience}/><Info label="Relevant Experience" value={c.relevantExperience}/><Info label="Qualification" value={c.qualification}/><Info label="Skills" value={c.skills}/><Info label="Updated CV" value={c.updatedCvName || "Missing"}/></div><div className="rec-detail-section"><h4>Recruitment</h4><Info label="Requirement" value={req?.title||c.requirementId}/><Info label="Source" value={`${c.source}${c.consultant?` · ${c.consultant}`:""}`}/><Info label="Recruiter" value={c.recruiter}/><Info label="Category" value={c.category}/><Info label="Current CTC" value={c.currentCtc}/><Info label="Expected CTC" value={c.expectedCtc}/><Info label="Notice Period" value={c.noticePeriod}/><Info label="Next Action" value={`${c.nextAction||"—"} · ${formatDate(c.nextActionDate)}`}/></div></div>}{activeCandidateTab==="Interview"&&<div><div className="rec-detail-toolbar"><button className="rec-primary" onClick={()=>{setInterviewForm({...EMPTY_INTERVIEW,candidateId:c.id});setInterviewModal(true);}}>＋ Schedule Round</button></div>{interviews.map(i=><div className="rec-detail-list-row" key={i.id}><div><b>{i.round}</b><span>{formatDate(i.date)} · {i.time} · {i.mode}</span></div><StatusBadge>{i.status}</StatusBadge><button className="rec-inline-action" onClick={()=>openFeedback(i)}>Feedback</button></div>)}{!interviews.length&&<div className="rec-empty">No interview rounds.</div>}</div>}{activeCandidateTab==="Mapping"&&<div><div className="rec-detail-toolbar"><button className="rec-primary" onClick={()=>openMappingForCandidate(c)}>✎ Open / Update Mapping</button>{maps.length>0&&<button className="rec-secondary" onClick={()=>exportExperienceMapping(c)}>↓ Export Mapping Excel</button>}</div>{(()=>{const summary=getMappingSummary(c.id);return <div className="rec-mapping-summary-grid"><div><span>CV Experience</span><b>{summary.cvExperience}</b></div><div><span>Document Supported</span><b>{summary.documentExperience}</b></div><div><span>Difference</span><b>{monthsToYearsMonths(Math.max(0,summary.cvMonths-summary.documentMonths))}</b></div><div><span>Rows</span><b>{maps.length}</b></div></div>})()}<div className="rec-mapping-preview-table"><table className="rec-table"><thead><tr><th>Company / Qualification</th><th>Designation as per CV</th><th>Designation as per Documents</th><th>Period as per CV</th><th>Period as per Documents</th><th>Document</th><th>Status</th></tr></thead><tbody>{maps.map(m=><tr key={m.id}><td>{m.company||m.qualification||"—"}</td><td>{m.designationAsPerCV||m.designation||"—"}</td><td>{m.designationAsPerDocuments||"—"}</td><td>{m.periodAsPerCV||mappingPeriodLabel(m.fromDate,m.toDate)}</td><td>{m.periodAsPerDocuments||mappingPeriodLabel(m.documentFromDate,m.documentToDate)}</td><td>{m.documentAvailable||"No document provided"}</td><td><StatusBadge>{m.comparisonStatus||m.mappingStatus}</StatusBadge></td></tr>)}</tbody></table></div>{!maps.length&&<div className="rec-empty">Experience mapping not started.</div>}</div>}{activeCandidateTab==="Documents & BGV"&&<div className="rec-detail-grid"><div className="rec-detail-section"><div className="rec-required-doc-banner"><b>Mandatory:</b> Updated CV must be attached. All other documents below are optional unless your internal process makes them required.</div><h4>Mandatory Document</h4>{MANDATORY_DOCUMENT_TYPES.map(type=>{const d=docs.find(x=>x.type===type);return <div className="rec-document-row mandatory" key={type}><span><b>{type}</b><small>Required for candidate progression</small></span><StatusBadge>{d?.status||"Missing"}</StatusBadge><label className="rec-file-mini">Upload<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e)=>handleDocumentFile(c.id,type,e.target.files?.[0])} /></label>{d?.fileData&&<button type="button" className="rec-inline-action" onClick={()=>downloadDocument(d)}>View</button>}</div>})}<h4 className="rec-optional-doc-heading">Additional / Optional Documents</h4>{OPTIONAL_DOCUMENT_TYPES.map(type=>{const d=docs.find(x=>x.type===type);return <div className="rec-document-row" key={type}><span>{type}<small>Optional</small></span><StatusBadge>{d?.status||"Not Uploaded"}</StatusBadge><label className="rec-file-mini">Upload<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e)=>handleDocumentFile(c.id,type,e.target.files?.[0])} /></label>{d?.fileData&&<button type="button" className="rec-inline-action" onClick={()=>downloadDocument(d)}>View</button>}</div>})}</div><div className="rec-detail-section"><h4>Background Verification</h4><Info label="Status" value={bgv?.status||"Not Initiated"}/><Info label="Agency" value={bgv?.agency||"—"}/><Info label="Reference" value={bgv?.referenceNo||"—"}/><Info label="Submitted" value={formatDate(bgv?.submittedDate)}/><button className="rec-primary" onClick={()=>{setBgvForm(bgv?{...EMPTY_BGV,...bgv}:{...EMPTY_BGV,candidateId:c.id});setBgvModal(true);}}>Update BGV</button></div></div>}{activeCandidateTab==="Offer"&&<div className="rec-detail-section"><h4>Offer</h4><Info label="Status" value={offer?.status||"Not Started"}/><Info label="Offer No." value={offer?.offerNumber||"—"}/><Info label="Designation" value={offer?.designation||"—"}/><Info label="Department" value={offer?.department||"—"}/><Info label="CTC" value={money(offer?.ctc)}/><Info label="Joining" value={formatDate(offer?.joiningDate)}/><div className="rec-detail-toolbar"><button className="rec-primary" onClick={()=>openOfferForCandidate(c)}>Create / Update Offer</button><button className="rec-secondary" onClick={()=>openLetter("Offer Letter",c.id)}>Generate Offer Letter</button></div></div>}{activeCandidateTab==="Joining"&&<div className="rec-detail-section"><h4>Joining Control</h4><Info label="Status" value={joining?.status||"Not Started"}/><Info label="Expected Date" value={formatDate(joining?.expectedDate||offer?.joiningDate)}/><Info label="Actual Date" value={formatDate(joining?.actualDate)}/><Info label="Location" value={joining?.location||offer?.location||"—"}/><div className="rec-detail-toolbar"><button className="rec-primary" onClick={()=>{setJoiningForm(joining?{...EMPTY_JOINING,...joining}:{...EMPTY_JOINING,candidateId:c.id,expectedDate:offer?.joiningDate||""});setJoiningModal(true);}}>{joining?"Update Joining":"Add Joining"}</button>{c.stage==="Joined"&&<button className="rec-secondary" onClick={()=>completeEmployeeConversion(c)}>Employee Master Handoff</button>}</div></div>}{activeCandidateTab==="Activity"&&<div>{store.activities.filter(a=>a.candidateId===c.id).sort((a,b)=>b.at.localeCompare(a.at)).map(a=><div className="rec-timeline-row" key={a.id}><span className="rec-timeline-dot"/><div><b>{a.action}</b><span>{a.details||""}</span><small>{new Date(a.at).toLocaleString("en-IN")}</small></div></div>)}{!store.activities.some(a=>a.candidateId===c.id)&&<div className="rec-empty">No activity recorded.</div>}</div>}</Modal>; };

  const renderContent = () => { if(view==="Requirements")return renderRequirements(); if(view==="Candidate Tracker")return renderCandidates(); if(view==="Interviews")return renderInterviews(); if(view==="Selection & Mapping")return renderSelectionMapping(); if(view==="Documents & BGV")return renderDocumentsBGV(); if(view==="Offers & Joining")return renderOffersJoining(); if(view==="Letters")return renderLetters(); if(view==="Reports")return renderReports(); if(view==="Settings")return renderSettings(); return renderDashboard(); };

  if (loading) return <section className="recruitment-module"><div className="rec-loading"><div className="rec-spinner"/><h3>Loading Recruitment Control Tower</h3><p>Reading recruitment data from Supabase...</p></div></section>;

  return <section className="recruitment-module">
    <div className="rec-page-head"><div><div className="rec-eyebrow">TALENT ACQUISITION</div><h1>Recruitment Management</h1><p>Track open positions, manage candidates, monitor offers, joining and backouts.</p></div><div className="rec-page-actions"><span className="rec-save-indicator">{saving?"Saving…":"Synced"}</span><label className="rec-secondary rec-upload-button">↑ Import Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>{importRecruitmentExcel(e.target.files?.[0]);e.target.value="";}}/></label><button className="rec-secondary" onClick={()=>setReqModal(true)}>＋ Requirement</button><button className="rec-primary" onClick={()=>setCandidateModal(true)}>＋ Candidate</button></div></div>
    {loadError&&<div className="rec-error-banner">{loadError}</div>}
    <div className="rec-nav">{navItems.map(([item,icon])=><button key={item} className={view===item?"active":""} onClick={()=>setView(item)}><span>{icon}</span>{item}</button>)}</div>
    {renderContent()}

    {requirementActionModal&&<Modal title={requirementActionModal.title + " · Actions"} onClose={()=>setRequirementActionModal(null)}><div className="rec-requirement-action-modal"><p className="rec-modal-help">Choose an action for requirement {requirementActionModal.requirementNo || requirementActionModal.id}.</p><div className="rec-form-actions"><button className="rec-secondary" type="button" onClick={()=>{setSearch("");setView("Candidate Tracker");setRequirementActionModal(null);}}>View candidates</button>{requirementActionModal.status === "Draft"&&<button className="rec-secondary" type="button" onClick={async()=>{await updateRequirementStatus(requirementActionModal.id,"Pending Approval");setRequirementActionModal(null);}}>Submit for approval</button>}{requirementActionModal.status === "Pending Approval"&&<button className="rec-primary" type="button" onClick={async()=>{await updateRequirementStatus(requirementActionModal.id,"Approved");setRequirementActionModal(null);}}>Approve requirement</button>}{["Approved","Partially Filled"].includes(requirementActionModal.status)&&<button className="rec-secondary" type="button" onClick={async()=>{await updateRequirementStatus(requirementActionModal.id,"On Hold");setRequirementActionModal(null);}}>Put on hold</button>}{requirementActionModal.status === "On Hold"&&<button className="rec-secondary" type="button" onClick={async()=>{await updateRequirementStatus(requirementActionModal.id,"Approved");setRequirementActionModal(null);}}>Re-open requirement</button>}{!["Closed","Cancelled","Rejected","Filled"].includes(requirementActionModal.status)&&<button className="rec-secondary" type="button" onClick={async()=>{await updateRequirementStatus(requirementActionModal.id,"Closed");setRequirementActionModal(null);}}>Close requirement</button>}<button className="rec-danger-button" type="button" onClick={async()=>{setRequirementActionModal(null);await deleteRequirement(requirementActionModal.id);}}>Delete requirement</button></div></div></Modal>}

    {reqModal&&<Modal title="New Manpower Requirement" onClose={()=>setReqModal(false)} wide><form className="rec-form-grid" onSubmit={saveRequirement}><label>Position *<select value={reqForm.title} onChange={(e)=>setReqForm({...reqForm,title:e.target.value})} required><option value="">Select Position</option>{designations.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Department *<select value={reqForm.department} onChange={(e)=>setReqForm({...reqForm,department:e.target.value})} required><option value="">Select</option>{departments.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Site / Location<select value={reqForm.location} onChange={(e)=>setReqForm({...reqForm,location:e.target.value})}><option value="">Select</option>{locations.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Category<select value={reqForm.category} onChange={(e)=>setReqForm({...reqForm,category:e.target.value})}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label><label>Positions Required *<input type="number" min="1" value={reqForm.vacancies} onChange={(e)=>setReqForm({...reqForm,vacancies:e.target.value})}/></label><label>Employment Type<select value={reqForm.employmentType} onChange={(e)=>setReqForm({...reqForm,employmentType:e.target.value})}><option>Full Time</option><option>Part Time</option><option>Contract</option></select></label><label>Employee Group<select value={reqForm.employeeGroup} onChange={(e)=>setReqForm({...reqForm,employeeGroup:e.target.value})}><option value="">Select</option>{employeeGroups.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label><label>Qualification<input value={reqForm.qualification} onChange={(e)=>setReqForm({...reqForm,qualification:e.target.value})} placeholder="e.g. B.Tech Civil"/></label><label>Experience<select value={reqForm.experience} onChange={(e)=>setReqForm({...reqForm,experience:e.target.value})}><option value="">Select</option>{EXPERIENCE_OPTIONS.map(x=><option key={x}>{x} Years</option>)}</select></label><label className="full">Required Skills<input value={reqForm.skills} onChange={(e)=>setReqForm({...reqForm,skills:e.target.value})} placeholder="e.g. AutoCAD, execution, site management"/></label><label>Min CTC (LPA)<select value={reqForm.minCtc} onChange={(e)=>setReqForm({...reqForm,minCtc:e.target.value})}><option value="">Select</option>{CTC_LPA_OPTIONS.map(x=><option key={x}>{x} LPA</option>)}</select></label><label>Max CTC (LPA)<select value={reqForm.maxCtc} onChange={(e)=>setReqForm({...reqForm,maxCtc:e.target.value})}><option value="">Select</option>{CTC_LPA_OPTIONS.map(x=><option key={x}>{x} LPA</option>)}</select></label><label>Priority<select value={reqForm.priority} onChange={(e)=>setReqForm({...reqForm,priority:e.target.value})}><option>High</option><option>Medium</option><option>Low</option></select></label><label>Target Joining Date<input type="date" value={reqForm.targetDate} onChange={(e)=>setReqForm({...reqForm,targetDate:e.target.value})}/></label><label>Hiring Manager<input value={reqForm.hiringManager} onChange={(e)=>setReqForm({...reqForm,hiringManager:e.target.value})}/></label><label>Approving HOD *<SearchableEmployeeSelect options={employeeOptions} value={reqForm.approverId} onChange={(value)=>{const e=employeeOptions.find(x=>x.id===value);setReqForm({...reqForm,approverId:e?.id||"",approverEmployeeId:e?.employeeId||"",approverName:e?.name||""})}} placeholder="Select HOD"/></label><label>Recruiter<select value={reqForm.recruiter} onChange={(e)=>setReqForm({...reqForm,recruiter:e.target.value})}><option value="">Select</option>{recruiterOptions.map(x=><option key={x}>{x}</option>)}</select></label><label>Reason<select value={reqForm.reason} onChange={(e)=>setReqForm({...reqForm,reason:e.target.value})}><option>New Position</option><option>Replacement</option><option>Expansion</option><option>Attrition</option></select></label><label className="full">Remarks<textarea rows="3" value={reqForm.remarks} onChange={(e)=>setReqForm({...reqForm,remarks:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setReqModal(false)}>Cancel</button><button className="rec-primary">Save Requirement</button></div></form></Modal>}

    {candidateModal&&<Modal title="Add Candidate" onClose={()=>setCandidateModal(false)} wide><form className="rec-form-grid" onSubmit={saveCandidate}><label>Candidate Name *<input required value={candidateForm.name} onChange={(e)=>setCandidateForm({...candidateForm,name:e.target.value})}/></label><label>Mobile *<input required inputMode="numeric" value={candidateForm.mobile} onChange={(e)=>setCandidateForm({...candidateForm,mobile:e.target.value.replace(/\D/g,"").slice(0,10)})}/></label><label>Email<input type="email" value={candidateForm.email} onChange={(e)=>setCandidateForm({...candidateForm,email:e.target.value})}/></label><label>Current Location<input value={candidateForm.location} onChange={(e)=>setCandidateForm({...candidateForm,location:e.target.value})}/></label><label>Current Company<input value={candidateForm.currentCompany} onChange={(e)=>setCandidateForm({...candidateForm,currentCompany:e.target.value})}/></label><label>Current Designation<input value={candidateForm.currentDesignation} onChange={(e)=>setCandidateForm({...candidateForm,currentDesignation:e.target.value})}/></label><label>Current Department<input value={candidateForm.department} onChange={(e)=>setCandidateForm({...candidateForm,department:e.target.value})} placeholder="e.g. Quality / Procurement / Civil"/></label><label>Total Experience<input value={candidateForm.totalExperience} onChange={(e)=>setCandidateForm({...candidateForm,totalExperience:e.target.value})}/></label><label>Relevant Experience<input value={candidateForm.relevantExperience} onChange={(e)=>setCandidateForm({...candidateForm,relevantExperience:e.target.value})}/></label><label>Highest Qualification<input value={candidateForm.qualification} onChange={(e)=>setCandidateForm({...candidateForm,qualification:e.target.value})}/></label><label>Passing Year<input value={candidateForm.qualificationYear} onChange={(e)=>setCandidateForm({...candidateForm,qualificationYear:e.target.value})}/></label><div className="rec-required-upload full"><div><b>Updated CV *</b><span>Latest CV is mandatory and must be attached before saving the candidate.</span></div><label className="rec-upload-button rec-primary">↑ Attach Updated CV<input required type="file" accept=".pdf,.doc,.docx" onChange={(e)=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1500000)return alert("Please keep the Updated CV below 1.5 MB for the current Supabase settings storage.");const reader=new FileReader();reader.onload=()=>setCandidateForm({...candidateForm,updatedCvName:file.name,updatedCvData:String(reader.result||""),cvStatus:"Received"});reader.readAsDataURL(file);}}/></label>{candidateForm.updatedCvName&&<span className="rec-upload-file">✓ {candidateForm.updatedCvName}</span>}</div><label className="full">Key Skills<input value={candidateForm.skills} onChange={(e)=>setCandidateForm({...candidateForm,skills:e.target.value})}/></label><label>Current CTC<input value={candidateForm.currentCtc} onChange={(e)=>setCandidateForm({...candidateForm,currentCtc:e.target.value})}/></label><label>Expected CTC<input value={candidateForm.expectedCtc} onChange={(e)=>setCandidateForm({...candidateForm,expectedCtc:e.target.value})}/></label><label>Notice Period<input value={candidateForm.noticePeriod} onChange={(e)=>setCandidateForm({...candidateForm,noticePeriod:e.target.value})}/></label><label>Last Working Date<input type="date" value={candidateForm.lastWorkingDate} onChange={(e)=>setCandidateForm({...candidateForm,lastWorkingDate:e.target.value})}/></label><label>Preferred Location<input value={candidateForm.preferredLocation} onChange={(e)=>setCandidateForm({...candidateForm,preferredLocation:e.target.value})}/></label><label>Willing to Relocate<select value={candidateForm.willingToRelocate} onChange={(e)=>setCandidateForm({...candidateForm,willingToRelocate:e.target.value})}><option>Yes</option><option>No</option></select></label><label>Category<select value={candidateForm.category} onChange={(e)=>setCandidateForm({...candidateForm,category:e.target.value})}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label><label>Source<select value={candidateForm.source} onChange={(e)=>setCandidateForm({...candidateForm,source:e.target.value})}>{SOURCES.map(x=><option key={x}>{x}</option>)}</select></label><label>Consultant<input value={candidateForm.consultant} onChange={(e)=>setCandidateForm({...candidateForm,consultant:e.target.value})}/></label><label>Recruiter<select value={candidateForm.recruiter} onChange={(e)=>setCandidateForm({...candidateForm,recruiter:e.target.value})}><option value="">Select</option>{recruiterOptions.map(x=><option key={x}>{x}</option>)}</select></label><label>Requirement<select value={candidateForm.requirementId} onChange={(e)=>setCandidateForm({...candidateForm,requirementId:e.target.value})}><option value="">Select</option>{store.requirements.filter(r=>r.status!=="Closed"&&r.status!=="Rejected").map(r=><option key={r.id} value={r.id}>{r.title} · {r.requirementNo||r.id}</option>)}</select></label><label>Owner<input value={candidateForm.owner} onChange={(e)=>setCandidateForm({...candidateForm,owner:e.target.value})}/></label><label>Initial Stage<select value={candidateForm.stage} onChange={(e)=>setCandidateForm({...candidateForm,stage:e.target.value})}><option>New</option><option>Screening</option></select></label><label>Next Action<input value={candidateForm.nextAction} onChange={(e)=>setCandidateForm({...candidateForm,nextAction:e.target.value})}/></label><label>Next Action Date<input type="date" value={candidateForm.nextActionDate} onChange={(e)=>setCandidateForm({...candidateForm,nextActionDate:e.target.value})}/></label><label className="full">Notes<textarea rows="3" value={candidateForm.notes} onChange={(e)=>setCandidateForm({...candidateForm,notes:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setCandidateModal(false)}>Cancel</button><button className="rec-primary">Save Candidate</button></div></form></Modal>}

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

    {joiningModal&&<Modal title="Joining Control" onClose={()=>setJoiningModal(false)}><form className="rec-form-grid" onSubmit={saveJoining}><label className="full">Candidate *<select required value={joiningForm.candidateId} onChange={(e)=>setJoiningForm({...joiningForm,candidateId:e.target.value})}><option value="">Select</option>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled","Joined"].includes(c.stage)).map(c=><option key={c.id} value={c.id}>{c.name} · {c.candidateNo||c.id}</option>)}</select></label><label>Expected Joining Date *<input required type="date" value={joiningForm.expectedDate} onChange={(e)=>setJoiningForm({...joiningForm,expectedDate:e.target.value})}/></label><label>Status<select value={joiningForm.status} onChange={(e)=>setJoiningForm({...joiningForm,status:e.target.value})}>{JOINING_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label><label>Actual Joining Date<input type="date" value={joiningForm.actualDate} onChange={(e)=>setJoiningForm({...joiningForm,actualDate:e.target.value})}/></label><label>Location<input value={joiningForm.location} onChange={(e)=>setJoiningForm({...joiningForm,location:e.target.value})}/></label><label>Reporting Manager<input value={joiningForm.reportingManager} onChange={(e)=>setJoiningForm({...joiningForm,reportingManager:e.target.value})}/></label><label className="full">Remarks<textarea rows="3" value={joiningForm.remarks} onChange={(e)=>setJoiningForm({...joiningForm,remarks:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setJoiningModal(false)}>Cancel</button><button className="rec-primary">Save Joining</button></div></form></Modal>}

    {offerModal&&<Modal title="Offer Management" onClose={()=>setOfferModal(false)} wide><form className="rec-form-grid" onSubmit={saveOffer}><label>Candidate *<select required value={offerForm.candidateId} onChange={(e)=>{const id=e.target.value;const c=candidateById(id);const r=requirementById(c?.requirementId);setOfferForm({...offerForm,candidateId:id,designation:c?.currentDesignation||r?.title||offerForm.designation,department:r?.department||offerForm.department,location:r?.location||c?.preferredLocation||offerForm.location});}}><option value="">Select Candidate</option>{store.candidates.filter(c=>["Selected","Offer Released","Offer Accepted","Joining Scheduled"].includes(c.stage)).map(c=><option key={c.id} value={c.id}>{c.name} · {c.currentDesignation||"Candidate"}</option>)}</select></label><label>Offer No.<input value={offerForm.offerNumber} onChange={(e)=>setOfferForm({...offerForm,offerNumber:e.target.value})}/></label><label>Designation *<input required value={offerForm.designation} onChange={(e)=>setOfferForm({...offerForm,designation:e.target.value})}/></label><label>Department<select value={offerForm.department} onChange={(e)=>setOfferForm({...offerForm,department:e.target.value})}><option value="">Select</option>{departments.map(x=><option key={x.id}>{x.name}</option>)}</select></label><label>Location<select value={offerForm.location} onChange={(e)=>setOfferForm({...offerForm,location:e.target.value})}><option value="">Select</option>{locations.map(x=><option key={x.id}>{x.name}</option>)}</select></label><label>Joining Date<input type="date" value={offerForm.joiningDate} onChange={(e)=>setOfferForm({...offerForm,joiningDate:e.target.value})}/></label><label>Annual CTC *<input required type="number" value={offerForm.ctc} onChange={(e)=>setOfferForm({...offerForm,ctc:e.target.value})}/></label><label>Basic<input type="number" value={offerForm.basic} onChange={(e)=>setOfferForm({...offerForm,basic:e.target.value})}/></label><label>HRA<input type="number" value={offerForm.hra} onChange={(e)=>setOfferForm({...offerForm,hra:e.target.value})}/></label><label>Other Components<input type="number" value={offerForm.other} onChange={(e)=>setOfferForm({...offerForm,other:e.target.value})}/></label><label>Probation<select value={offerForm.probation} onChange={(e)=>setOfferForm({...offerForm,probation:e.target.value})}><option>3 Months</option><option>6 Months</option><option>12 Months</option></select></label><label>Notice Period<input value={offerForm.noticePeriod} onChange={(e)=>setOfferForm({...offerForm,noticePeriod:e.target.value})}/></label><label>Reporting Manager<input value={offerForm.reportingManager} onChange={(e)=>setOfferForm({...offerForm,reportingManager:e.target.value})}/></label><label>Approval Status<select value={offerForm.approvalStatus} onChange={(e)=>setOfferForm({...offerForm,approvalStatus:e.target.value})}><option>Pending</option><option>Approved</option><option>Rejected</option></select></label><label>Status<select value={offerForm.status} onChange={(e)=>setOfferForm({...offerForm,status:e.target.value})}>{OFFER_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setOfferModal(false)}>Cancel</button><button type="button" className="rec-secondary" onClick={()=>{if(!offerForm.candidateId)return alert("Select candidate first.");const c=candidateById(offerForm.candidateId);setOfferModal(false);openLetter("Offer Letter",c.id);}}>Generate Letter</button><button className="rec-primary">Save Offer</button></div></form></Modal>}

    {letterModal&&<Modal title={`${letterForm.type} · Generate / Preview`} onClose={()=>setLetterModal(false)} wide><div className="rec-letter-layout"><div className="rec-letter-controls"><div className="rec-form-grid"><label>Letter Type<select value={letterForm.type} onChange={(e)=>{const type=e.target.value;const t=store.letterTemplates.find(x=>x.type===type&&x.active)||store.letterTemplates.find(x=>x.type===type);setLetterForm({...letterForm,type,templateId:t?.id||"",subject:t?.subject||"",body:t?.bodyTemplate||letterForm.body});}}>{LETTER_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>{letterForm.type === "Termination Letter" ? <label>Employee<select value={letterForm.employeeId} onChange={(e)=>{const id=e.target.value;setLetterForm({...letterForm,employeeId:id,candidateId:""});}}><option value="">Select Employee</option>{employeeOptions.map(e=><option key={e.id} value={e.id}>{e.name} · {e.employeeId}</option>)}</select></label> : <label>Candidate<select value={letterForm.candidateId} onChange={(e)=>setLetterForm({...letterForm,candidateId:e.target.value,employeeId:""})}><option value="">Select</option>{store.candidates.map(c=><option key={c.id} value={c.id}>{c.name} · {c.candidateNo||c.id}</option>)}</select></label>}<label>Template<select value={letterForm.templateId} onChange={(e)=>{const t=store.letterTemplates.find(x=>x.id===e.target.value);setLetterForm({...letterForm,templateId:e.target.value,subject:t?.subject||"",body:t?.bodyTemplate||""});}}>{store.letterTemplates.filter(t=>t.type===letterForm.type).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Issue Date<input type="date" value={letterForm.issueDate} onChange={(e)=>setLetterForm({...letterForm,issueDate:e.target.value})}/></label>{letterForm.type==="Termination Letter"&&<><label>Termination Date<input type="date" value={letterForm.terminationDate} onChange={(e)=>setLetterForm({...letterForm,terminationDate:e.target.value})}/></label><label className="full">Termination Reason<input value={letterForm.terminationReason} onChange={(e)=>setLetterForm({...letterForm,terminationReason:e.target.value})}/></label></>}<label className="full">Subject<input value={letterForm.subject} onChange={(e)=>setLetterForm({...letterForm,subject:e.target.value})}/></label><label className="full">Letter Text<textarea rows="15" value={letterForm.body} onChange={(e)=>setLetterForm({...letterForm,body:e.target.value})}/></label></div><div className="rec-letter-actions"><button className="rec-secondary" type="button" onClick={regenerateLetterBody}>↻ Auto Fill Fields</button><button className="rec-secondary" type="button" onClick={()=>saveLetter(false)}>Save Draft</button><button className="rec-secondary" type="button" onClick={shareLetter}>Share / Copy</button><button className="rec-primary" type="button" onClick={()=>saveLetter(true)}>Generate & Print / Save PDF</button></div></div><div className="rec-letter-preview" id="recruitment-letter-preview">{(()=>{const t=store.letterTemplates.find(x=>x.id===letterForm.templateId);return <><div className="rec-letter-page">{t?.letterheadImage&&<img className="rec-letterhead" src={t.letterheadImage} alt="Letterhead"/>}<div className="rec-letter-body"><div className="rec-letter-subject">{letterForm.subject}</div>{letterForm.body.split("\n").map((line,i)=><p key={i}>{line||" "}</p>)}</div>{t?.footerText&&<div className="rec-letter-footer">{t.footerText}</div>}</div></>})()}</div></div></Modal>}

    {templateModal&&<Modal title="Letter Template" onClose={()=>setTemplateModal(false)} wide><form className="rec-form-grid" onSubmit={saveTemplate}><label>Template Type<select value={templateForm.type} onChange={(e)=>setTemplateForm({...templateForm,type:e.target.value})}>{LETTER_TYPES.map(x=><option key={x}>{x}</option>)}</select></label><label>Template Name<input required value={templateForm.name} onChange={(e)=>setTemplateForm({...templateForm,name:e.target.value})}/></label><label>Subject<input value={templateForm.subject} onChange={(e)=>setTemplateForm({...templateForm,subject:e.target.value})}/></label><label>Fixed Letterhead Image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>uploadLetterhead(e.target.files?.[0])}/></label>{templateForm.letterheadImage&&<div className="rec-letterhead-thumb full"><img src={templateForm.letterheadImage} alt="Uploaded letterhead"/></div>}<label className="full">Fixed Text Template<textarea required rows="18" value={templateForm.bodyTemplate} onChange={(e)=>setTemplateForm({...templateForm,bodyTemplate:e.target.value})}/></label><div className="rec-placeholder-box full"><b>Available auto fields</b><span>{"{{DATE}} {{EMPLOYEE_NAME}} {{EMPLOYEE_ID}} {{FATHER_NAME}} {{ADDRESS}} {{DESIGNATION}} {{DEPARTMENT}} {{LOCATION}} {{JOINING_DATE}} {{ACTUAL_JOINING_DATE}} {{CTC}} {{MONTHLY_CTC}} {{BASIC}} {{HRA}} {{REPORTING_MANAGER}} {{PROBATION}} {{NOTICE_PERIOD}} {{TERMINATION_DATE}} {{TERMINATION_REASON}} {{COMPANY_NAME}}"}</span></div><label className="full">Footer / Disclaimer<textarea rows="3" value={templateForm.footerText} onChange={(e)=>setTemplateForm({...templateForm,footerText:e.target.value})}/></label><div className="rec-form-actions full"><button type="button" className="rec-secondary" onClick={()=>setTemplateModal(false)}>Cancel</button><button className="rec-primary">Save Template</button></div></form></Modal>}
    {candidateDetail&&renderCandidateDetail()}
  </section>;
}

function Info({ label, value }) { return <div className="rec-info-row"><span>{label}</span><b>{value || "—"}</b></div>; }
