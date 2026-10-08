import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import "./PolicyManagement.css";
const POLICY_TYPES = [
  {
    value: "attendance",
    label: "Attendance",
    description: "Attendance and daily working rules",
  },
  {
    value: "shift",
    label: "Shift",
    description: "Shift and working-hour rules",
  },
  {
    value: "leave",
    label: "Leave",
    description: "Leave types, accrual and approval",
  },
  {
    value: "holiday",
    label: "Holiday",
    description: "Holiday calendars and working days",
  },
  {
    value: "overtime",
    label: "Overtime",
    description: "OT eligibility and calculation",
  },
  {
    value: "comp_off",
    label: "Comp-Off",
    description: "Compensatory off rules",
  },
  {
    value: "regularization",
    label: "Regularization",
    description: "Attendance correction rules",
  },
  {
    value: "payroll",
    label: "Payroll",
    description: "Payroll processing and controls",
  },
  {
    value: "statutory",
    label: "Statutory",
    description: "PF, ESI, Professional Tax and LWF rules",
  },
  {
    value: "salary_structure",
    label: "Salary Structure",
    description: "Salary components and formulas",
  },
  {
    value: "lop",
    label: "LOP",
    description: "Loss of pay rules",
  },
  {
    value: "recruitment",
    label: "Recruitment",
    description: "Hiring and approval rules",
  },
  {
    value: "onboarding",
    label: "Onboarding",
    description: "Joining and onboarding rules",
  },
  {
    value: "probation",
    label: "Probation",
    description: "Probation and confirmation rules",
  },
  {
    value: "pms",
    label: "PMS / Appraisal",
    description: "Performance and appraisal rules",
  },
  {
    value: "training",
    label: "Training",
    description: "Training and certification rules",
  },
  {
    value: "expense",
    label: "Expense",
    description: "Expense and reimbursement rules",
  },
  {
    value: "travel",
    label: "Travel",
    description: "Travel eligibility and limits",
  },
  {
    value: "wfh",
    label: "WFH / Remote",
    description: "Remote work rules",
  },
  {
    value: "exit",
    label: "Exit / F&F",
    description: "Exit and full & final rules",
  },
];
const EMPLOYEE_TYPES = [
  "Staff",
  "Third Party",
  "Consultant",
  "Intern / Trainee",
  "Expat",
];
const DEPARTMENTS = [
  "All Departments",
  "HR & Administration",
  "Finance",
  "Projects",
  "Engineering",
  "Procurement",
  "Quality",
  "Planning",
  "IT",
];
const LOCATIONS = [
  "All Locations",
  "Gurgaon HO",
  "Gurgaon Yard",
  "NPCIL",
  "Polavaram COW",
  "Pakaldul",
  "Teesta",
];
const DEFAULT_STATUTORY_RULES = {
  companyRuleName: "India Statutory FY 2026-27",
  ruleVersion: "STAT-2026-27-V2",
  pf: {
    enabled: true,
    employeeRate: "12",
    employerRate: "12",
    wageCeiling: "25000",
    wageBasis: "Basic + DA + Special Allowance",
    higherWageContribution: false,
    includeBasicDa: true,
  },
  esi: {
    enabled: true,
    employeeRate: "0.75",
    employerRate: "3.25",
    wageCeiling: "21000",
    contributionBasis: "Basic + DA + Special Allowance",
    includeBasicDa: false,
    rounding: "Next Rupee",
  },
  pt: {
    enabled: true,
    state: "Haryana",
    mode: "State-wise Automatic",
    manualAmount: "",
    slabs: [
      { min: "0", max: "15000", employeeAmount: "0" },
      { min: "15001", max: "25000", employeeAmount: "0" },
      { min: "25001", max: "999999999", employeeAmount: "0" },
    ],
  },
  lwf: {
    enabled: true,
    employeeAmount: "0",
    employerAmount: "0",
    frequency: "MONTHLY",
  },
  wageDefinition: {
    excludeHra: true,
    excludeOvertime: true,
    excludeBonus: true,
    excludeConveyance: true,
    excludeGratuity: true,
  },
};

const STEPS = [
  {
    number: 1,
    title: "Basic Information",
    short: "Basic",
  },
  {
    number: 2,
    title: "Applicability",
    short: "Assign",
  },
  {
    number: 3,
    title: "Rules",
    short: "Rules",
  },
  {
    number: 4,
    title: "Approval",
    short: "Workflow",
  },
  {
    number: 5,
    title: "Review & Publish",
    short: "Publish",
  },
];
const getInitialPolicy = () => ({
  name: "",
  code: "",
  type: "",
  description: "",
  effectiveFrom: "",
  effectiveTo: "",
  status: "Draft",
  employeeTypes: [],
  departments: [],
  locations: [],
  designation: "",
  grade: "",
  workforceCategories: [],
  payrollProfileIds: [],
  ...DEFAULT_STATUTORY_RULES,
  workingHours: "9",
  graceMinutes: "15",
  halfDayHours: "4.5",
  absentHours: "2",
  approvalRequired: true,
  approverLevel1: "Reporting Manager",
  approverLevel2: "HR",
});
const POLICY_SETTINGS_KEY = "policyManagement";
const MASTERS_SETTINGS_KEY = "organizationMasters";
const ORGANIZATION_CODE = "BAUERE";
async function getOrganizationRecord() {
  let { data, error } = await supabase
    .from("organizations")
    .select("id, code, settings")
    .eq("code", ORGANIZATION_CODE)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const fallback = await supabase
      .from("organizations")
      .select("id, code, settings")
      .limit(1)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }
  if (!data) throw new Error("No organization record was found.");
  return data;
}
function normalizePolicyStore(store) {
  return {
    policies: Array.isArray(store?.policies) ? store.policies : [],
    versions: Array.isArray(store?.versions) ? store.versions : [],
    audit: Array.isArray(store?.audit) ? store.audit : [],
  };
}
function nextVersionNumber(policies, versions, policyCode) {
  const code = String(policyCode || "").toLowerCase();
  const numbers = [
    ...policies.filter((item) => String(item?.code || "").toLowerCase() === code).map((item) => Number(item.version)).filter(Number.isFinite),
    ...versions.filter((item) => String(item?.policyCode || "").toLowerCase() === code).map((item) => Number(item.version)).filter(Number.isFinite),
  ];
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
export default function PolicyManagement({ onClose }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [policy, setPolicy] =
    useState(getInitialPolicy);
  const [errors, setErrors] = useState({});
  const [savedMessage, setSavedMessage] =
    useState("");
  const [search, setSearch] = useState("");
  const [policies, setPolicies] = useState([]);
  const [versions, setVersions] = useState([]);
  const [audit, setAudit] = useState([]);
  const [masters, setMasters] = useState({
    locations: [],
    departments: [],
    workforceCategories: [],
    payrollProfiles: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dataError, setDataError] = useState("");
  const loadPolicyData = async () => {
    setLoading(true);
    setDataError("");
    try {
      const organization = await getOrganizationRecord();
      const settings = organization.settings || {};
      const masterData = settings[MASTERS_SETTINGS_KEY] || {};
      const policyStore = normalizePolicyStore(settings[POLICY_SETTINGS_KEY]);
      setMasters({
        locations: Array.isArray(masterData.locations) ? masterData.locations : [],
        departments: Array.isArray(masterData.departments) ? masterData.departments : [],
        workforceCategories: Array.isArray(masterData.workforceCategories) ? masterData.workforceCategories : [],
        payrollProfiles: Array.isArray(masterData.payrollProfiles) ? masterData.payrollProfiles : [],
      });
      setPolicies(policyStore.policies);
      setVersions(policyStore.versions);
      setAudit(policyStore.audit);
    } catch (error) {
      console.error("Unable to load policy management data:", error);
      setDataError(error?.message || "Unable to load Policy Management data.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadPolicyData(); }, []);
  const persistPolicyStore = async (nextStore) => {
    const organization = await getOrganizationRecord();
    const currentSettings = organization.settings || {};
    const { error } = await supabase
      .from("organizations")
      .update({
        settings: { ...currentSettings, [POLICY_SETTINGS_KEY]: normalizePolicyStore(nextStore) },
        updated_at: new Date().toISOString(),
      })
      .eq("id", organization.id);
    if (error) throw error;
  };
  const employeeTypeOptions = useMemo(() => {
    const values = masters.workforceCategories.filter((item) => item && item.active !== false).map((item) => item.name).filter(Boolean);
    return values.length ? values : EMPLOYEE_TYPES;
  }, [masters.workforceCategories]);
  const departmentOptions = useMemo(() => {
    const values = masters.departments.filter((item) => item && item.active !== false).map((item) => item.name).filter(Boolean);
    return values.length ? values : DEPARTMENTS;
  }, [masters.departments]);
  const locationOptions = useMemo(() => {
    const values = masters.locations.filter((item) => item && item.active !== false).map((item) => item.name).filter(Boolean);
    return values.length ? values : LOCATIONS;
  }, [masters.locations]);
  const workforceCategoryOptions = useMemo(() => {
    return masters.workforceCategories
      .filter((item) => item && item.active !== false && item.id && item.name)
      .map((item) => ({ id: item.id, name: item.name }));
  }, [masters.workforceCategories]);

  const payrollProfileOptions = useMemo(() => {
    return masters.payrollProfiles
      .filter((item) => item && item.active !== false && item.id && item.name)
      .map((item) => ({ id: item.id, name: item.name, code: item.code || "" }));
  }, [masters.payrollProfiles]);

  /* =========================================================
     HELPERS
     ========================================================= */
  const selectedType =
    POLICY_TYPES.find(
      (item) => item.value === policy.type
    );
  const updatePolicy = (field, value) => {
    setPolicy((prev) => ({
      ...prev,
      [field]: value,
    }));
    setErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };
  const toggleArrayValue = (
    field,
    value
  ) => {
    setPolicy((prev) => {
      const current = prev[field] || [];
      const exists =
        current.includes(value);
      return {
        ...prev,
        [field]: exists
          ? current.filter(
              (item) => item !== value
            )
          : [...current, value],
      };
    });
  };
  const updateStatutorySection = (section, field, value) => {
    setPolicy((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [field]: value,
      },
    }));
    setErrors((prev) => ({ ...prev, [section]: "" }));
  };

  const updatePTSlab = (index, field, value) => {
    setPolicy((prev) => ({
      ...prev,
      pt: {
        ...prev.pt,
        slabs: (prev.pt?.slabs || []).map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row
        ),
      },
    }));
  };

  const addPTSlab = () => {
    setPolicy((prev) => ({
      ...prev,
      pt: {
        ...prev.pt,
        slabs: [
          ...(prev.pt?.slabs || []),
          { min: "0", max: "0", employeeAmount: "0" },
        ],
      },
    }));
  };

  const removePTSlab = (index) => {
    setPolicy((prev) => ({
      ...prev,
      pt: {
        ...prev.pt,
        slabs: (prev.pt?.slabs || []).filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  };

  const resetWizard = () => {
    setStep(1);
    setPolicy(getInitialPolicy());
    setErrors({});
    setSavedMessage("");
  };
  const openWizard = (policyType = "") => {
    resetWizard();
    if (policyType) {
      setPolicy((prev) => ({ ...prev, type: policyType }));
    }
    setShowWizard(true);
  };
  const closeWizard = () => {
    setShowWizard(false);
    resetWizard();
  };
  /* =========================================================
     VALIDATION
     ========================================================= */
  const validateStep = () => {
    const nextErrors = {};
    if (step === 1) {
      if (!policy.name.trim()) {
        nextErrors.name =
          "Policy name is required.";
      }
      if (!policy.code.trim()) {
        nextErrors.code =
          "Policy code is required.";
      }
      if (!policy.type) {
        nextErrors.type =
          "Please select a policy type.";
      }
      if (!policy.effectiveFrom) {
        nextErrors.effectiveFrom =
          "Effective date is required.";
      }
    }
    if (step === 2) {
      if (policy.type === "statutory") {
        if (!policy.workforceCategories?.length) {
          nextErrors.workforceCategories = "Select at least one workforce category.";
        }
        if (!policy.payrollProfileIds?.length) {
          nextErrors.payrollProfileIds = "Link at least one Payroll Profile.";
        }
      } else {
        if (policy.employeeTypes.length === 0) {
          nextErrors.employeeTypes = "Select at least one employee type.";
        }
        if (policy.departments.length === 0) {
          nextErrors.departments = "Select at least one department.";
        }
        if (policy.locations.length === 0) {
          nextErrors.locations = "Select at least one location.";
        }
      }
    }
    setErrors(nextErrors);
    return (
      Object.keys(nextErrors).length === 0
    );
  };
  const nextStep = () => {
    if (!validateStep()) return;
    setStep((prev) =>
      Math.min(5, prev + 1)
    );
  };
  const previousStep = () => {
    setStep((prev) =>
      Math.max(1, prev - 1)
    );
  };
  const validateAllSteps = () => {
    const nextErrors = {};
    if (!policy.name.trim()) nextErrors.name = "Policy name is required.";
    if (!policy.code.trim()) nextErrors.code = "Policy code is required.";
    if (!policy.type) nextErrors.type = "Please select a policy type.";
    if (!policy.effectiveFrom) nextErrors.effectiveFrom = "Effective date is required.";
    if (policy.effectiveTo && policy.effectiveTo < policy.effectiveFrom) nextErrors.effectiveTo = "Effective To cannot be earlier than Effective From.";
    if (policy.type !== "statutory") {
      if (!policy.employeeTypes.length) nextErrors.employeeTypes = "Select at least one employee type.";
      if (!policy.departments.length) nextErrors.departments = "Select at least one department.";
      if (!policy.locations.length) nextErrors.locations = "Select at least one location.";
    }
    if (policies.some((item) => item.id !== policy.id && String(item.code || "").trim().toLowerCase() === String(policy.code || "").trim().toLowerCase())) nextErrors.code = "Policy code already exists.";

    if (policy.type === "statutory") {
      if (!policy.workforceCategories?.length) nextErrors.workforceCategories = "Select at least one workforce category.";
      if (!policy.payrollProfileIds?.length) nextErrors.payrollProfileIds = "Link at least one Payroll Profile.";
      if (policy.pf?.enabled) {
        if (!(Number(policy.pf.employeeRate) > 0)) nextErrors.pf = "PF employee contribution rate is required.";
        if (!(Number(policy.pf.employerRate) > 0)) nextErrors.pf = "PF employer contribution rate is required.";
        if (!(Number(policy.pf.wageCeiling) > 0)) nextErrors.pf = "PF wage ceiling is required.";
      }
      if (policy.esi?.enabled) {
        if (!(Number(policy.esi.employeeRate) >= 0)) nextErrors.esi = "ESI employee contribution rate is required.";
        if (!(Number(policy.esi.employerRate) > 0)) nextErrors.esi = "ESI employer contribution rate is required.";
        if (!(Number(policy.esi.wageCeiling) > 0)) nextErrors.esi = "ESI wage ceiling is required.";
      }
      if (policy.pt?.enabled && policy.pt.mode === "Manual" && !(Number(policy.pt.manualAmount) >= 0)) {
        nextErrors.pt = "Manual PT amount is required.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const persistStatutoryPayrollLink = async (nextPolicy) => {
    if (nextPolicy.type !== "statutory" || nextPolicy.status !== "Active") return;

    const organization = await getOrganizationRecord();
    const currentSettings = organization.settings || {};
    const currentMasters = currentSettings[MASTERS_SETTINGS_KEY] || {};

    const statutoryPolicy = {
      id: nextPolicy.id,
      name: nextPolicy.name,
      code: nextPolicy.code,
      effectiveFrom: nextPolicy.effectiveFrom || "",
      effectiveTo: nextPolicy.effectiveTo || "",
      ruleVersion: nextPolicy.ruleVersion || `STAT-${nextPolicy.code}-V${nextPolicy.version || 1}`,
      active: true,
      workforceCategories: Array.isArray(nextPolicy.workforceCategories) ? nextPolicy.workforceCategories : [],
      pf: {
        ...(nextPolicy.pf || {}),
        employeeRate: Number(nextPolicy.pf?.employeeRate || 0),
        employerRate: Number(nextPolicy.pf?.employerRate || 0),
        wageCeiling: Number(nextPolicy.pf?.wageCeiling || 0),
      },
      esi: {
        ...(nextPolicy.esi || {}),
        employeeRate: Number(nextPolicy.esi?.employeeRate || 0),
        employerRate: Number(nextPolicy.esi?.employerRate || 0),
        wageCeiling: Number(nextPolicy.esi?.wageCeiling || 0),
      },
      pt: {
        ...(nextPolicy.pt || {}),
        slabs: (nextPolicy.pt?.slabs || []).map((row) => ({
          min: Number(row.min || 0),
          max: Number(row.max || 0),
          employeeAmount: Number(row.employeeAmount || 0),
        })),
      },
      lwf: {
        ...(nextPolicy.lwf || {}),
        employeeAmount: Number(nextPolicy.lwf?.employeeAmount || 0),
        employerAmount: Number(nextPolicy.lwf?.employerAmount || 0),
      },
      payrollProfileIds: Array.isArray(nextPolicy.payrollProfileIds) ? nextPolicy.payrollProfileIds : [],
      source: "Policy Management",
      sourcePolicyId: nextPolicy.id,
      version: nextPolicy.version || 1,
      updatedAt: new Date().toISOString(),
    };

    const currentStatutoryPolicies = Array.isArray(currentMasters.statutoryPolicies)
      ? currentMasters.statutoryPolicies
      : [];

    const nextStatutoryPolicies = [
      statutoryPolicy,
      ...currentStatutoryPolicies.filter((item) => item?.id !== statutoryPolicy.id),
    ];

    const selectedProfileIds = new Set(statutoryPolicy.payrollProfileIds);
    const currentProfiles = Array.isArray(currentMasters.payrollProfiles)
      ? currentMasters.payrollProfiles
      : [];

    const nextProfiles = currentProfiles.map((profile) => {
      const existingIds = Array.isArray(profile.statutoryPolicyIds)
        ? profile.statutoryPolicyIds.filter((id) => id !== statutoryPolicy.id)
        : [];

      if (selectedProfileIds.has(profile.id)) {
        return {
          ...profile,
          statutoryPolicyIds: [statutoryPolicy.id, ...existingIds],
        };
      }

      return {
        ...profile,
        statutoryPolicyIds: existingIds,
      };
    });

    const nextMasters = {
      ...currentMasters,
      statutoryPolicies: nextStatutoryPolicies,
      payrollProfiles: nextProfiles,
    };

    const { error } = await supabase
      .from("organizations")
      .update({
        settings: {
          ...currentSettings,
          [MASTERS_SETTINGS_KEY]: nextMasters,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", organization.id);

    if (error) throw error;
  };

  const savePolicy = async (status) => {
    setSaving(true);
    setDataError("");
    try {
      const now = new Date().toISOString();
      const existing = policies.find((item) => item.id === policy.id);
      const id = policy.id || `policy-${Date.now()}`;
      const nextPolicy = {
        ...policy,
        id,
        code: String(policy.code || "").trim().toUpperCase(),
        name: String(policy.name || "").trim(),
        status,
        updatedAt: now,
        createdAt: existing?.createdAt || now,
        ...(status === "Active" ? { publishedAt: now } : {}),
      };
      const nextPolicies = existing ? policies.map((item) => item.id === id ? nextPolicy : item) : [nextPolicy, ...policies];
      let nextVersions = versions;
      let nextAudit;
      if (status === "Active") {
        const version = nextVersionNumber(nextPolicies, versions, nextPolicy.code);
        nextPolicy.version = version;
        nextVersions = [{
          id: `version-${Date.now()}`,
          policyId: id,
          policyCode: nextPolicy.code,
          policyName: nextPolicy.name,
          version,
          status: "Active",
          effectiveFrom: nextPolicy.effectiveFrom,
          publishedAt: now,
          snapshot: nextPolicy,
        }, ...versions];
        const updatedPolicies = nextPolicies.map((item) => item.id === id ? nextPolicy : item);
        nextAudit = [{
          id: `audit-${Date.now()}`,
          policyId: id,
          action: existing ? "PUBLISHED_UPDATE" : "PUBLISHED",
          policyCode: nextPolicy.code,
          policyName: nextPolicy.name,
          version,
          timestamp: now,
        }, ...audit];
        await persistPolicyStore({ policies: updatedPolicies, versions: nextVersions, audit: nextAudit });
        await persistStatutoryPayrollLink(nextPolicy);
        setPolicies(updatedPolicies);
      } else {
        nextAudit = [{
          id: `audit-${Date.now()}`,
          policyId: id,
          action: existing ? "DRAFT_UPDATED" : "DRAFT_CREATED",
          policyCode: nextPolicy.code,
          policyName: nextPolicy.name || "Untitled Policy",
          timestamp: now,
        }, ...audit];
        await persistPolicyStore({ policies: nextPolicies, versions: nextVersions, audit: nextAudit });
        setPolicies(nextPolicies);
      }
      setVersions(nextVersions);
      setAudit(nextAudit);
      setPolicy(nextPolicy);
      setSavedMessage(status === "Active" ? "Policy published successfully." : "Policy saved as draft successfully.");
      setTimeout(() => setSavedMessage(""), 2500);
      if (status === "Active") setTimeout(() => { setShowWizard(false); resetWizard(); }, 1000);
    } catch (error) {
      console.error("Unable to save policy:", error);
      setDataError(error?.message || "Unable to save policy to the database.");
      setSavedMessage("");
    } finally {
      setSaving(false);
    }
  };
  const saveDraft = async () => savePolicy("Draft");
  const publishPolicy = async () => {
    if (!validateAllSteps()) {
      setStep(1);
      return;
    }
    await savePolicy("Active");
  };
  const editPolicy = (item) => {
    setPolicy({ ...getInitialPolicy(), ...item });
    setErrors({});
    setStep(1);
    setShowWizard(true);
  };
  /* =========================================================
     WIZARD
     ========================================================= */
  if (showWizard) {
    return (
      <section className="policy-page">
        <div className="policy-wizard-header">
          <button
            type="button"
            className="policy-back-btn"
            onClick={closeWizard}
          >
            ← Back to Policies
          </button>
          <div>
            <span className="policy-eyebrow">
              POLICY MANAGEMENT
            </span>
            <h1>Create New Policy</h1>
            <p>
              Configure the policy details,
              applicability and rules.
            </p>
          </div>
        </div>
        {/* STEP INDICATOR */}
        <div className="policy-stepper">
          {STEPS.map((item) => {
            const completed =
              step > item.number;
            const active =
              step === item.number;
            return (
              <div
                key={item.number}
                className={`policy-step ${
                  active
                    ? "active"
                    : completed
                    ? "completed"
                    : ""
                }`}
              >
                <div className="step-number">
                  {completed
                    ? "✓"
                    : item.number}
                </div>
                <div className="step-label">
                  <strong>
                    {item.title}
                  </strong>
                  <span>
                    {item.short}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {/* ALERT */}
        {savedMessage && (
          <div className="policy-success">
            ✓ {savedMessage}
          </div>
        )}
        {/* WIZARD BODY */}
        <div className="policy-wizard-layout">
          <main className="policy-wizard-card">
            {/* =============================================
                STEP 1
                ============================================= */}
            {step === 1 && (
              <div className="wizard-section">
                <div className="wizard-section-header">
                  <div className="wizard-section-icon">
                    01
                  </div>
                  <div>
                    <h2>
                      Basic Information
                    </h2>
                    <p>
                      Define the identity and
                      validity of this policy.
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-field full">
                    <label>
                      Policy Name
                      <b>\*</b>
                    </label>
                    <input
                      value={policy.name}
                      onChange={(e) =>
                        updatePolicy(
                          "name",
                          e.target.value
                        )
                      }
                      placeholder="e.g. Gurgaon Staff Attendance Policy"
                    />
                    {errors.name && (
                      <small className="field-error">
                        {errors.name}
                      </small>
                    )}
                  </div>
                  <div className="form-field">
                    <label>
                      Policy Code
                      <b>\*</b>
                    </label>
                    <input
                      value={policy.code}
                      onChange={(e) =>
                        updatePolicy(
                          "code",
                          e.target.value
                            .toUpperCase()
                            .replace(
                              /\s/g,
                              "-"
                            )
                        )
                      }
                      placeholder="e.g. ATT-GGN-001"
                    />
                    {errors.code && (
                      <small className="field-error">
                        {errors.code}
                      </small>
                    )}
                  </div>
                  <div className="form-field">
                    <label>
                      Policy Type
                      <b>\*</b>
                    </label>
                    <select
                      value={policy.type}
                      onChange={(e) =>
                        updatePolicy(
                          "type",
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Select policy type
                      </option>
                      {POLICY_TYPES.map(
                        (type) => (
                          <option
                            key={type.value}
                            value={
                              type.value
                            }
                          >
                            {type.label}
                          </option>
                        )
                      )}
                    </select>
                    {errors.type && (
                      <small className="field-error">
                        {errors.type}
                      </small>
                    )}
                  </div>
                  <div className="form-field full">
                    <label>
                      Description
                    </label>
                    <textarea
                      value={
                        policy.description
                      }
                      onChange={(e) =>
                        updatePolicy(
                          "description",
                          e.target.value
                        )
                      }
                      placeholder="Describe the purpose of this policy..."
                      rows={4}
                    />
                  </div>
                  <div className="form-field">
                    <label>
                      Effective From
                      <b>\*</b>
                    </label>
                    <input
                      type="date"
                      value={
                        policy.effectiveFrom
                      }
                      onChange={(e) =>
                        updatePolicy(
                          "effectiveFrom",
                          e.target.value
                        )
                      }
                    />
                    {errors.effectiveFrom && (
                      <small className="field-error">
                        {
                          errors.effectiveFrom
                        }
                      </small>
                    )}
                  </div>
                  <div className="form-field">
                    <label>
                      Effective To
                    </label>
                    <input
                      type="date"
                      value={
                        policy.effectiveTo
                      }
                      onChange={(e) =>
                        updatePolicy(
                          "effectiveTo",
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
                {selectedType && (
                  <div className="policy-type-preview">
                    <div className="preview-icon">
                      ✓
                    </div>
                    <div>
                      <strong>
                        {selectedType.label}
                      </strong>
                      <span>
                        {selectedType.description}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* =============================================
                STEP 2
                ============================================= */}
            {step === 2 && (
              <div className="wizard-section">
                <div className="wizard-section-header">
                  <div className="wizard-section-icon">
                    02
                  </div>
                  <div>
                    <h2>
                      Policy Applicability
                    </h2>
                    <p>
                      Define which employees
                      should receive this policy.
                    </p>
                  </div>
                </div>
                {policy.type !== "statutory" && (
                  <>
                {/* EMPLOYEE TYPE */}
                <div className="selection-group">
                  <div className="selection-heading">
                    <div>
                      <strong>
                        Employee Type
                      </strong>
                      <span>
                        Select applicable
                        employee categories.
                      </span>
                    </div>
                    <small>
                      {policy.employeeTypes.length}{" "}
                      selected
                    </small>
                  </div>
                  <div className="selection-grid">
                    {employeeTypeOptions.map(
                      (type) => (
                        <label
                          key={type}
                          className={`selection-item ${
                            policy.employeeTypes.includes(
                              type
                            )
                              ? "selected"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={policy.employeeTypes.includes(
                              type
                            )}
                            onChange={() =>
                              toggleArrayValue(
                                "employeeTypes",
                                type
                              )
                            }
                          />
                          <span className="check-box">
                            ✓
                          </span>
                          <span>
                            {type}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                  {errors.employeeTypes && (
                    <small className="field-error">
                      {errors.employeeTypes}
                    </small>
                  )}
                </div>
                {/* DEPARTMENT */}
                <div className="selection-group">
                  <div className="selection-heading">
                    <div>
                      <strong>
                        Department
                      </strong>
                      <span>
                        Choose departments
                        covered by this policy.
                      </span>
                    </div>
                    <small>
                      {policy.departments.length}{" "}
                      selected
                    </small>
                  </div>
                  <div className="selection-grid">
                    {departmentOptions.map(
                      (department) => (
                        <label
                          key={department}
                          className={`selection-item ${
                            policy.departments.includes(
                              department
                            )
                              ? "selected"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={policy.departments.includes(
                              department
                            )}
                            onChange={() =>
                              toggleArrayValue(
                                "departments",
                                department
                              )
                            }
                          />
                          <span className="check-box">
                            ✓
                          </span>
                          <span>
                            {department}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                  {errors.departments && (
                    <small className="field-error">
                      {errors.departments}
                    </small>
                  )}
                </div>
                {/* LOCATION */}
                <div className="selection-group">
                  <div className="selection-heading">
                    <div>
                      <strong>
                        Location / Site
                      </strong>
                      <span>
                        Define where the policy
                        will apply.
                      </span>
                    </div>
                    <small>
                      {policy.locations.length}{" "}
                      selected
                    </small>
                  </div>
                  <div className="selection-grid">
                    {locationOptions.map(
                      (location) => (
                        <label
                          key={location}
                          className={`selection-item ${
                            policy.locations.includes(
                              location
                            )
                              ? "selected"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={policy.locations.includes(
                              location
                            )}
                            onChange={() =>
                              toggleArrayValue(
                                "locations",
                                location
                              )
                            }
                          />
                          <span className="check-box">
                            ✓
                          </span>
                          <span>
                            {location}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                  {errors.locations && (
                    <small className="field-error">
                      {errors.locations}
                    </small>
                  )}
                </div>
                {/* DESIGNATION / GRADE */}
                <div className="form-grid">
                  <div className="form-field">
                    <label>
                      Designation
                    </label>
                    <input
                      value={
                        policy.designation
                      }
                      onChange={(e) =>
                        updatePolicy(
                          "designation",
                          e.target.value
                        )
                      }
                      placeholder="All designations"
                    />
                  </div>
                  <div className="form-field">
                    <label>
                      Grade
                    </label>
                    <input
                      value={policy.grade}
                      onChange={(e) =>
                        updatePolicy(
                          "grade",
                          e.target.value
                        )
                      }
                      placeholder="All grades"
                    />
                  </div>
                </div>
                  </>
                )}
              {policy.type === "statutory" && (
                <div className="statutory-link-panel">
                  <div className="statutory-link-header">
                    <div>
                      <span>PAYROLL LINKAGE</span>
                      <h3>Link this Statutory Policy to Payroll</h3>
                      <p>
                        Select the workforce categories and Payroll Profiles that should use
                        this statutory policy when Payroll is processed.
                      </p>
                    </div>
                    <div className="statutory-link-badge">Required for Payroll</div>
                  </div>

                  <div className="statutory-selection-grid">
                    <div className="statutory-selection-card">
                      <div className="selection-heading">
                        <div>
                          <strong>Workforce Categories</strong>
                          <span>Payroll uses these IDs to resolve the applicable policy.</span>
                        </div>
                        <small>{policy.workforceCategories?.length || 0} selected</small>
                      </div>

                      <div className="selection-grid">
                        {workforceCategoryOptions.map((item) => (
                          <label
                            key={item.id}
                            className={`selection-item ${
                              policy.workforceCategories?.includes(item.id) ? "selected" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={policy.workforceCategories?.includes(item.id) || false}
                              onChange={() => toggleArrayValue("workforceCategories", item.id)}
                            />
                            <span className="check-box">✓</span>
                            <span>{item.name}</span>
                          </label>
                        ))}
                      </div>

                      {!workforceCategoryOptions.length && (
                        <div className="statutory-empty-note">
                          No active Workforce Categories are available in Organization Masters.
                        </div>
                      )}

                      {errors.workforceCategories && (
                        <small className="field-error">{errors.workforceCategories}</small>
                      )}
                    </div>

                    <div className="statutory-selection-card">
                      <div className="selection-heading">
                        <div>
                          <strong>Payroll Profiles</strong>
                          <span>Publishing will write this policy ID into selected profiles.</span>
                        </div>
                        <small>{policy.payrollProfileIds?.length || 0} linked</small>
                      </div>

                      <div className="selection-grid">
                        {payrollProfileOptions.map((item) => (
                          <label
                            key={item.id}
                            className={`selection-item ${
                              policy.payrollProfileIds?.includes(item.id) ? "selected" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={policy.payrollProfileIds?.includes(item.id) || false}
                              onChange={() => toggleArrayValue("payrollProfileIds", item.id)}
                            />
                            <span className="check-box">✓</span>
                            <span>
                              {item.name}
                              {item.code ? ` (${item.code})` : ""}
                            </span>
                          </label>
                        ))}
                      </div>

                      {!payrollProfileOptions.length && (
                        <div className="statutory-empty-note">
                          No active Payroll Profiles are available in Organization Masters.
                        </div>
                      )}

                      {errors.payrollProfileIds && (
                        <small className="field-error">{errors.payrollProfileIds}</small>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}
            {/* =============================================
                STEP 3 — RULES
                ============================================= */}
            {step === 3 && (
              <div className="wizard-section">
                <div className="wizard-section-header">
                  <div className="wizard-section-icon">
                    03
                  </div>
                  <div>
                    <h2>
                      Policy Rules
                    </h2>
                    <p>
                      Configure the operational
                      rules for this policy.
                    </p>
                  </div>
                </div>
                {policy.type ===
                  "attendance" ||
                policy.type ===
                  "shift" ? (
                  <>
                    <div className="rule-group">
                      <div className="rule-group-title">
                        Working Hours
                      </div>
                      <div className="rule-grid">
                        <div className="form-field">
                          <label>
                            Full Day Hours
                          </label>
                          <div className="input-suffix">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={
                                policy.workingHours
                              }
                              onChange={(e) =>
                                updatePolicy(
                                  "workingHours",
                                  e.target.value
                                )
                              }
                            />
                            <span>
                              Hours
                            </span>
                          </div>
                        </div>
                        <div className="form-field">
                          <label>
                            Grace Period
                          </label>
                          <div className="input-suffix">
                            <input
                              type="number"
                              min="0"
                              value={
                                policy.graceMinutes
                              }
                              onChange={(e) =>
                                updatePolicy(
                                  "graceMinutes",
                                  e.target.value
                                )
                              }
                            />
                            <span>
                              Minutes
                            </span>
                          </div>
                        </div>
                        <div className="form-field">
                          <label>
                            Half Day Threshold
                          </label>
                          <div className="input-suffix">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={
                                policy.halfDayHours
                              }
                              onChange={(e) =>
                                updatePolicy(
                                  "halfDayHours",
                                  e.target.value
                                )
                              }
                            />
                            <span>
                              Hours
                            </span>
                          </div>
                        </div>
                        <div className="form-field">
                          <label>
                            Absent Threshold
                          </label>
                          <div className="input-suffix">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={
                                policy.absentHours
                              }
                              onChange={(e) =>
                                updatePolicy(
                                  "absentHours",
                                  e.target.value
                                )
                              }
                            />
                            <span>
                              Hours
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rule-group">
                      <div className="rule-group-title">
                        Attendance Conditions
                      </div>
                      <div className="condition-rule">
                        <span>
                          If Late In exceeds
                        </span>
                        <strong>
                          {policy.graceMinutes}{" "}
                          minutes
                        </strong>
                        <span>
                          → Mark as Late
                        </span>
                      </div>
                      <div className="condition-rule">
                        <span>
                          If worked hours are
                          below
                        </span>
                        <strong>
                          {policy.absentHours}{" "}
                          hours
                        </strong>
                        <span>
                          → Mark as Absent
                        </span>
                      </div>
                    </div>
                  </>
                ) : policy.type === "statutory" ? (
                  <div className="statutory-rules">
                    <div className="statutory-rule-intro">
                      <div>
                        <span>STATUTORY ENGINE</span>
                        <h3>{policy.companyRuleName || "Statutory Policy"}</h3>
                        <p>
                          Configure PF, ESI, Professional Tax and LWF here. Payroll will consume
                          the published version of this policy.
                        </p>
                      </div>
                      <div className="statutory-version-chip">
                        {policy.ruleVersion || "STAT-RULE-V1"}
                      </div>
                    </div>

                    <div className="statutory-rule-grid">
                      <div className="statutory-rule-card">
                        <div className="statutory-rule-title">
                          <div>
                            <b>PF</b>
                            <small>Employee + employer contribution</small>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(policy.pf?.enabled)}
                            onChange={(e) => updateStatutorySection("pf", "enabled", e.target.checked)}
                          />
                        </div>

                        <div className="statutory-fields">
                          <label>
                            Employee %
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={policy.pf?.employeeRate ?? ""}
                              onChange={(e) => updateStatutorySection("pf", "employeeRate", e.target.value)}
                            />
                          </label>
                          <label>
                            Employer %
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={policy.pf?.employerRate ?? ""}
                              onChange={(e) => updateStatutorySection("pf", "employerRate", e.target.value)}
                            />
                          </label>
                          <label>
                            Wage Ceiling
                            <input
                              type="number"
                              min="0"
                              value={policy.pf?.wageCeiling ?? ""}
                              onChange={(e) => updateStatutorySection("pf", "wageCeiling", e.target.value)}
                            />
                          </label>
                          <label>
                            Contribution Wage Basis
                            <select
                              value={policy.pf?.wageBasis || "Basic + DA + Special Allowance"}
                              onChange={(e) => updateStatutorySection("pf", "wageBasis", e.target.value)}
                            >
                              <option>Basic + DA</option>
                              <option>Basic + DA + Special Allowance</option>
                              <option>Gross</option>
                            </select>
                          </label>
                        </div>

                        <label className="statutory-check-field">
                          <input
                            type="checkbox"
                            checked={Boolean(policy.pf?.higherWageContribution)}
                            onChange={(e) => updateStatutorySection("pf", "higherWageContribution", e.target.checked)}
                          />
                          Calculate above the configured ceiling
                        </label>

                        <div className="statutory-rule-note">
                          <span>PF Calculation Basis</span>
                          <strong>{policy.pf?.wageBasis || "Basic + DA + Special Allowance"}</strong>
                          <small>
                            {policy.pf?.higherWageContribution
                              ? "Ceiling is informational; contribution continues on the selected wage basis."
                              : `Contribution base is capped at ₹${Number(policy.pf?.wageCeiling || 0).toLocaleString("en-IN")}.`}
                          </small>
                        </div>

                        {errors.pf && <small className="field-error">{errors.pf}</small>}
                      </div>

                      <div className="statutory-rule-card">
                        <div className="statutory-rule-title">
                          <div>
                            <b>ESI</b>
                            <small>Employee + employer contribution</small>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(policy.esi?.enabled)}
                            onChange={(e) => updateStatutorySection("esi", "enabled", e.target.checked)}
                          />
                        </div>

                        <div className="statutory-fields">
                          <label>
                            Employee %
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={policy.esi?.employeeRate ?? ""}
                              onChange={(e) => updateStatutorySection("esi", "employeeRate", e.target.value)}
                            />
                          </label>
                          <label>
                            Employer %
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={policy.esi?.employerRate ?? ""}
                              onChange={(e) => updateStatutorySection("esi", "employerRate", e.target.value)}
                            />
                          </label>
                          <label>
                            Wage Ceiling
                            <input
                              type="number"
                              min="0"
                              value={policy.esi?.wageCeiling ?? ""}
                              onChange={(e) => updateStatutorySection("esi", "wageCeiling", e.target.value)}
                            />
                          </label>
                          <label>
                            Contribution Wage Basis
                            <select
                              value={policy.esi?.contributionBasis || "Basic + DA + Special Allowance"}
                              onChange={(e) => updateStatutorySection("esi", "contributionBasis", e.target.value)}
                            >
                              <option>Basic + DA</option>
                              <option>Basic + DA + Special Allowance</option>
                              <option>Gross</option>
                            </select>
                          </label>
                          <label>
                            Rounding
                            <select
                              value={policy.esi?.rounding || "Next Rupee"}
                              onChange={(e) => updateStatutorySection("esi", "rounding", e.target.value)}
                            >
                              <option>Next Rupee</option>
                              <option>Nearest Rupee</option>
                              <option>Down Rupee</option>
                            </select>
                          </label>
                        </div>

                        <div className="statutory-rule-note">
                          <span>ESI Coverage</span>
                          <strong>Configured wage ceiling</strong>
                          <small>
                            Coverage is checked against ₹{Number(policy.esi?.wageCeiling || 0).toLocaleString("en-IN")}.
                          </small>
                        </div>

                        {errors.esi && <small className="field-error">{errors.esi}</small>}
                      </div>

                      <div className="statutory-rule-card statutory-wide-card">
                        <div className="statutory-rule-title">
                          <div>
                            <b>Professional Tax (PT)</b>
                            <small>State-wise employee deduction slabs</small>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(policy.pt?.enabled)}
                            onChange={(e) => updateStatutorySection("pt", "enabled", e.target.checked)}
                          />
                        </div>

                        <div className="statutory-fields pt-top-fields">
                          <label>
                            State
                            <input
                              value={policy.pt?.state || ""}
                              onChange={(e) => updateStatutorySection("pt", "state", e.target.value)}
                              placeholder="e.g. Haryana"
                            />
                          </label>
                          <label>
                            Mode
                            <select
                              value={policy.pt?.mode || "State-wise Automatic"}
                              onChange={(e) => updateStatutorySection("pt", "mode", e.target.value)}
                            >
                              <option>State-wise Automatic</option>
                              <option>Manual</option>
                            </select>
                          </label>
                          {policy.pt?.mode === "Manual" && (
                            <label>
                              Manual PT Amount
                              <input
                                type="number"
                                min="0"
                                value={policy.pt?.manualAmount ?? ""}
                                onChange={(e) => updateStatutorySection("pt", "manualAmount", e.target.value)}
                              />
                            </label>
                          )}
                        </div>

                        <div className="pt-slab-table">
                          <div className="pt-slab-head">
                            <span>Min Gross</span>
                            <span>Max Gross</span>
                            <span>Employee PT</span>
                            <span />
                          </div>
                          {(policy.pt?.slabs || []).map((slab, index) => (
                            <div className="pt-slab-row" key={index}>
                              <input
                                type="number"
                                min="0"
                                value={slab.min}
                                onChange={(e) => updatePTSlab(index, "min", e.target.value)}
                              />
                              <input
                                type="number"
                                min="0"
                                value={slab.max}
                                onChange={(e) => updatePTSlab(index, "max", e.target.value)}
                              />
                              <input
                                type="number"
                                min="0"
                                value={slab.employeeAmount}
                                onChange={(e) => updatePTSlab(index, "employeeAmount", e.target.value)}
                              />
                              <button
                                type="button"
                                className="icon-delete"
                                onClick={() => removePTSlab(index)}
                                disabled={(policy.pt?.slabs || []).length <= 1}
                                aria-label="Remove PT slab"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>

                        <button type="button" className="add-slab-btn" onClick={addPTSlab}>
                          + Add PT Slab
                        </button>

                        {errors.pt && <small className="field-error">{errors.pt}</small>}
                      </div>

                      <div className="statutory-rule-card">
                        <div className="statutory-rule-title">
                          <div>
                            <b>LWF</b>
                            <small>Labour Welfare Fund contribution</small>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(policy.lwf?.enabled)}
                            onChange={(e) => updateStatutorySection("lwf", "enabled", e.target.checked)}
                          />
                        </div>

                        <div className="statutory-fields">
                          <label>
                            Employee Amount
                            <input
                              type="number"
                              min="0"
                              value={policy.lwf?.employeeAmount ?? ""}
                              onChange={(e) => updateStatutorySection("lwf", "employeeAmount", e.target.value)}
                            />
                          </label>
                          <label>
                            Employer Amount
                            <input
                              type="number"
                              min="0"
                              value={policy.lwf?.employerAmount ?? ""}
                              onChange={(e) => updateStatutorySection("lwf", "employerAmount", e.target.value)}
                            />
                          </label>
                          <label>
                            Frequency
                            <select
                              value={policy.lwf?.frequency || "MONTHLY"}
                              onChange={(e) => updateStatutorySection("lwf", "frequency", e.target.value)}
                            >
                              <option value="MONTHLY">Monthly</option>
                              <option value="QUARTERLY">Quarterly</option>
                              <option value="HALF_YEARLY">Half-Yearly</option>
                              <option value="YEARLY">Yearly</option>
                            </select>
                          </label>
                        </div>
                      </div>

                      <div className="statutory-rule-card statutory-wide-card">
                        <div className="statutory-rule-title">
                          <div>
                            <b>Wage Definition</b>
                            <small>Components excluded from the statutory base</small>
                          </div>
                        </div>

                        <div className="statutory-exclusion-grid">
                          {[
                            ["excludeHra", "Exclude HRA"],
                            ["excludeOvertime", "Exclude Overtime"],
                            ["excludeBonus", "Exclude Bonus"],
                            ["excludeConveyance", "Exclude Conveyance"],
                            ["excludeGratuity", "Exclude Gratuity"],
                          ].map(([field, label]) => (
                            <label key={field} className="statutory-check-field">
                              <input
                                type="checkbox"
                                checked={Boolean(policy.wageDefinition?.[field])}
                                onChange={(e) => updateStatutorySection("wageDefinition", field, e.target.checked)}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="coming-rule-box">
                    <div className="coming-rule-icon">⚙</div>
                    <div>
                      <strong>{selectedType?.label || "Policy"} Rules</strong>
                      <p>
                        The dedicated rule builder for this policy type will be configured here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* =============================================
                STEP 4 — APPROVAL
                ============================================= */}
            {step === 4 && (
              <div className="wizard-section">
                <div className="wizard-section-header">
                  <div className="wizard-section-icon">
                    04
                  </div>
                  <div>
                    <h2>
                      Approval Workflow
                    </h2>
                    <p>
                      Define who reviews and
                      approves this policy.
                    </p>
                  </div>
                </div>
                <div className="approval-toggle">
                  <div>
                    <strong>
                      Approval Required
                    </strong>
                    <span>
                      Policy must be approved
                      before activation.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`toggle ${
                      policy.approvalRequired
                        ? "on"
                        : ""
                    }`}
                    onClick={() =>
                      updatePolicy(
                        "approvalRequired",
                        !policy.approvalRequired
                      )
                    }
                  >
                    <span />
                  </button>
                </div>
                {policy.approvalRequired && (
                  <div className="workflow-preview">
                    <div className="workflow-step">
                      <div className="workflow-number">
                        1
                      </div>
                      <div>
                        <small>
                          LEVEL 1
                        </small>
                        <strong>
                          Reporting Manager
                        </strong>
                      </div>
                    </div>
                    <div className="workflow-line" />
                    <div className="workflow-step">
                      <div className="workflow-number">
                        2
                      </div>
                      <div>
                        <small>
                          LEVEL 2
                        </small>
                        <strong>
                          HR
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* =============================================
                STEP 5 — REVIEW
                ============================================= */}
            {step === 5 && (
              <div className="wizard-section">
                <div className="wizard-section-header">
                  <div className="wizard-section-icon">
                    05
                  </div>
                  <div>
                    <h2>
                      Review &amp; Publish
                    </h2>
                    <p>
                      Review the complete policy
                      before publishing.
                    </p>
                  </div>
                </div>
                <div className="review-card">
                  <div className="review-title">
                    <div>
                      <span>
                        POLICY
                      </span>
                      <h3>
                        {policy.name ||
                          "Untitled Policy"}
                      </h3>
                    </div>
                    <span className="draft-badge">
                      DRAFT
                    </span>
                  </div>
                  <div className="review-grid">
                    <div>
                      <span>
                        Policy Code
                      </span>
                      <strong>
                        {policy.code ||
                          "—"}
                      </strong>
                    </div>
                    <div>
                      <span>
                        Policy Type
                      </span>
                      <strong>
                        {selectedType
                          ?.label || "—"}
                      </strong>
                    </div>
                    <div>
                      <span>
                        Effective From
                      </span>
                      <strong>
                        {policy.effectiveFrom ||
                          "—"}
                      </strong>
                    </div>
                    <div>
                      <span>
                        Effective To
                      </span>
                      <strong>
                        {policy.effectiveTo ||
                          "No expiry"}
                      </strong>
                    </div>
                  </div>
                  <div className="review-divider" />
                  <div className="review-block">
                    <span>
                      APPLICABILITY
                    </span>
                    <p>
                      {policy.employeeTypes.join(
                        ", "
                      ) || "—"}
                    </p>
                    <p>
                      {policy.departments.join(
                        ", "
                      ) || "—"}
                    </p>
                    <p>
                      {policy.locations.join(
                        ", "
                      ) || "—"}
                    </p>
                  </div>
                  <div className="review-divider" />
                  <div className="review-block">
                    <span>
                      RULE SUMMARY
                    </span>
                    {policy.type === "attendance" ? (
                      <p>
                        {policy.workingHours}{" "}
                        working hours · {policy.graceMinutes}{" "}
                        minutes grace · {policy.halfDayHours}{" "}
                        hours half-day threshold
                      </p>
                    ) : policy.type === "statutory" ? (
                      <div className="statutory-review-summary">
                        <p>
                          PF: {policy.pf?.enabled ? `${policy.pf.employeeRate}% employee · ${policy.pf.employerRate}% employer · ₹${Number(policy.pf.wageCeiling || 0).toLocaleString("en-IN")} ceiling` : "Not applicable"}
                        </p>
                        <p>
                          ESI: {policy.esi?.enabled ? `${policy.esi.employeeRate}% employee · ${policy.esi.employerRate}% employer · ₹${Number(policy.esi.wageCeiling || 0).toLocaleString("en-IN")} ceiling` : "Not applicable"}
                        </p>
                        <p>
                          PT: {policy.pt?.enabled ? `${policy.pt.state || "State"} · ${policy.pt.mode || "State-wise Automatic"}` : "Not applicable"} · LWF: {policy.lwf?.enabled ? `${policy.lwf.employeeAmount || 0} employee / ${policy.lwf.employerAmount || 0} employer` : "Not applicable"}
                        </p>
                        <p>
                          Payroll Profiles linked: {policy.payrollProfileIds?.length || 0}
                        </p>
                      </div>
                    ) : (
                      <p>
                        Rules configured for {selectedType?.label || "this policy"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="publish-warning">
                  <strong>
                    Before publishing
                  </strong>
                  <span>
                    Published policies can affect
                    HR transactions. Always verify
                    applicability, rules and effective
                    dates before activation.
                  </span>
                </div>
              </div>
            )}
            {/* =============================================
                FOOTER
                ============================================= */}
            <div className="wizard-footer">
              <button
                type="button"
                className="wizard-secondary-btn"
                onClick={
                  step === 1
                    ? closeWizard
                    : previousStep
                }
              >
                {step === 1
                  ? "Cancel"
                  : "← Previous"}
              </button>
              <div className="wizard-footer-right">
                <button
                  type="button"
                  className="wizard-draft-btn"
                  onClick={saveDraft} disabled={saving}
                >
                  Save Draft
                </button>
                {step < 5 ? (
                  <button
                    type="button"
                    className="wizard-primary-btn"
                    onClick={nextStep}
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wizard-primary-btn"
                    onClick={publishPolicy} disabled={saving}
                  >
                    Publish Policy
                  </button>
                )}
              </div>
            </div>
          </main>
          {/* ===============================================
              SIDE SUMMARY
              =============================================== */}
          <aside className="policy-wizard-sidebar">
            <div className="sidebar-card">
              <span className="sidebar-eyebrow">
                POLICY SUMMARY
              </span>
              <h3>
                {policy.name ||
                  "New Policy"}
              </h3>
              <div className="sidebar-status">
                <span />
                Draft
              </div>
              <div className="sidebar-divider" />
              <div className="sidebar-item">
                <span>Type</span>
                <strong>
                  {selectedType?.label ||
                    "Not selected"}
                </strong>
              </div>
              {policy.type === "statutory" && (
                <>
                  <div className="sidebar-item">
                    <span>PF / ESI</span>
                    <strong>
                      {policy.pf?.enabled ? "PF" : ""}
                      {policy.pf?.enabled && policy.esi?.enabled ? " + " : ""}
                      {policy.esi?.enabled ? "ESI" : ""}
                      {!policy.pf?.enabled && !policy.esi?.enabled ? "None" : ""}
                    </strong>
                  </div>
                  <div className="sidebar-item">
                    <span>Payroll Profiles</span>
                    <strong>{policy.payrollProfileIds?.length || 0}</strong>
                  </div>
                </>
              )}
              <div className="sidebar-item">
                <span>Effective From</span>
                <strong>
                  {policy.effectiveFrom ||
                    "Not set"}
                </strong>
              </div>
              <div className="sidebar-item">
                <span>Employee Types</span>
                <strong>
                  {policy.employeeTypes.length}
                </strong>
              </div>
              <div className="sidebar-item">
                <span>Departments</span>
                <strong>
                  {policy.departments.length}
                </strong>
              </div>
              <div className="sidebar-item">
                <span>Locations</span>
                <strong>
                  {policy.locations.length}
                </strong>
              </div>
            </div>
            <div className="sidebar-help">
              <div className="help-icon">
                ?
              </div>
              <div>
                <strong>
                  Need help?
                </strong>
                <p>
                  Policies control how HRSYNC
                  processes HR transactions.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    );
  }
  /* =========================================================
     POLICY DASHBOARD
     ========================================================= */
  const filteredCategories =
    POLICY_TYPES.filter((item) =>
      `${item.label} ${item.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  return (
    <section className="policy-page">
      {/* HEADER */}
      <header className="policy-header">
        <div>
          <span className="policy-eyebrow">
            HRSYNC · ADMINISTRATION
          </span>
          <h1>
            Policy Management
          </h1>
          <p>
            Create, assign, version and
            manage HR policies across the
            organisation.
          </p>
        </div>
        <div className="policy-header-actions">
          <button
            type="button"
            className="settings-return-btn"
            onClick={onClose}
          >
            ← Settings
          </button>
          <button
            type="button"
            className="create-policy-btn"
            onClick={() => openWizard()}
          >
            + Create Policy
          </button>
        </div>
      </header>
      {/* TABS */}
      <div className="policy-tabs">
        {[
          ["dashboard", "Dashboard"],
          ["all", "All Policies"],
          ["assignment", "Policy Assignment"],
          ["versions", "Versions & Audit"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={
              activeTab === value
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab(value)
            }
          >
            {label}
          </button>
        ))}
      </div>
      {dataError && (
        <div className="policy-success" style={{ background: "#fff7f7", color: "#9b3f4a", borderColor: "#f0c8ce" }}>
          {dataError}
        </div>
      )}
      {loading && !showWizard && (
        <div className="policy-success">Loading policies from database...</div>
      )}
      {/* SEARCH */}
      {activeTab === "all" && (
        <div className="policy-search-box">
          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search policies..."
          />
        </div>
      )}
      {/* KPI */}
      <div className="policy-kpi-grid">
        <div className="policy-kpi">
          <div className="kpi-icon purple">
            ▦
          </div>
          <div>
            <span>Total Policies</span>
            <strong>{policies.length}</strong>
          </div>
        </div>
        <div className="policy-kpi">
          <div className="kpi-icon green">
            ✓
          </div>
          <div>
            <span>Active Policies</span>
            <strong>{policies.filter((item) => item.status === "Active").length}</strong>
          </div>
        </div>
        <div className="policy-kpi">
          <div className="kpi-icon amber">
            ◷
          </div>
          <div>
            <span>Draft Policies</span>
            <strong>{policies.filter((item) => item.status === "Draft").length}</strong>
          </div>
        </div>
        <div className="policy-kpi">
          <div className="kpi-icon blue">
            —
          </div>
          <div>
            <span>Inactive</span>
            <strong>{policies.filter((item) => item.status !== "Active" && item.status !== "Draft").length}</strong>
          </div>
        </div>
      </div>
      {/* ALL POLICIES */}
      {activeTab === "all" ? (
        <div className="all-policy-card">
          <div className="section-heading"><div><span>POLICY LIBRARY</span><h2>All Policies</h2></div></div>
          <div className="policy-table">
            <div className="policy-table-head"><span>Policy</span><span>Type</span><span>Applicability</span><span>Status</span></div>
            {policies.filter((item) => `${item.name || ""} ${item.code || ""} ${item.type || ""}`.toLowerCase().includes(search.toLowerCase())).map((item) => {
              const typeLabel = POLICY_TYPES.find((type) => type.value === item.type)?.label || item.type || "—";
              const applicability = [...(item.locations || []), ...(item.departments || [])].filter(Boolean).slice(0, 2).join(" · ") || "All Employees";
              return <div className="policy-table-row" key={item.id}>
                <strong>{item.name || "Untitled Policy"}<small>{item.code || "—"}</small></strong>
                <span>{typeLabel}</span><span>{applicability}</span>
                <b className={item.status === "Active" ? "status-active" : "status-draft"}>{item.status || "Draft"}</b>
              </div>;
            })}
            {!loading && policies.length === 0 && <div className="policy-empty-state">No policies have been created yet.</div>}
          </div>
        </div>
      ) : activeTab === "assignment" ? (
        <div className="all-policy-card">
          <div className="section-heading"><div><span>POLICY CONTROL</span><h2>Policy Assignment</h2></div></div>
          <div className="policy-table">
            <div className="policy-table-head"><span>Policy</span><span>Type</span><span>Locations</span><span>Departments</span></div>
            {policies.map((item) => <div className="policy-table-row" key={item.id}>
              <strong>{item.name || "Untitled Policy"}<small>{item.code || "—"}</small></strong>
              <span>{POLICY_TYPES.find((type) => type.value === item.type)?.label || item.type || "—"}</span>
              <span>
                {item.type === "statutory"
                  ? (item.payrollProfileIds || [])
                      .map((id) => payrollProfileOptions.find((profile) => profile.id === id)?.name || id)
                      .join(", ") || "No Payroll Link"
                  : (item.locations || []).join(", ") || "All Locations"}
              </span>
              <span>
                {item.type === "statutory"
                  ? (item.workforceCategories || []).map((id) => workforceCategoryOptions.find((item) => item.id === id)?.name || id).join(", ") || "No Workforce Category"
                  : (item.departments || []).join(", ") || "All Departments"}
              </span>
            </div>)}
            {!loading && policies.length === 0 && <div className="policy-empty-state">No policy assignments available.</div>}
          </div>
        </div>
      ) : activeTab === "versions" ? (
        <div className="all-policy-card">
          <div className="section-heading"><div><span>GOVERNANCE</span><h2>Versions & Audit</h2></div></div>
          <div className="policy-table">
            <div className="policy-table-head"><span>Policy</span><span>Version / Action</span><span>Status</span><span>Timestamp</span></div>
            {versions.map((item) => <div className="policy-table-row" key={item.id}>
              <strong>{item.policyName || "Policy"}<small>{item.policyCode || "—"}</small></strong>
              <span>v{item.version}</span><b className="status-active">{item.status || "Active"}</b>
              <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleString("en-IN") : "—"}</span>
            </div>)}
            {audit.slice(0, 10).map((item) => <div className="policy-table-row" key={item.id}>
              <strong>{item.policyName || "Policy Audit"}<small>{item.policyCode || "—"}</small></strong>
              <span>{item.action}</span><span>Audit</span>
              <span>{item.timestamp ? new Date(item.timestamp).toLocaleString("en-IN") : "—"}</span>
            </div>)}
            {!loading && versions.length === 0 && audit.length === 0 && <div className="policy-empty-state">No policy versions or audit activity available.</div>}
          </div>
        </div>
      ) : (
        <>
          <div className="policy-main-grid">
            <div className="policy-category-card">
              <div className="section-heading"><div><span>POLICY CONTROL</span><h2>Policy Categories</h2></div><button type="button" onClick={() => setActiveTab("all")}>View All</button></div>
              <div className="category-grid">
                {filteredCategories.slice(0, 10).map((item) => <button key={item.value} type="button" className="category-item" onClick={() => openWizard(item.value)}>
                  <div><strong>{item.label}</strong><span>{item.description}</span></div><b>→</b>
                </button>)}
              </div>
            </div>
            <div className="quick-actions-card">
              <div className="section-heading"><div><span>QUICK ACTIONS</span><h2>Manage Policies</h2></div></div>
              <button type="button" className="quick-action" onClick={() => openWizard()}><div>+</div><span><strong>Create New Policy</strong><small>Create a module-specific HR policy.</small></span></button>
              <button type="button" className="quick-action" onClick={() => setActiveTab("assignment")}><div>◎</div><span><strong>Assign Policies</strong><small>Review where policies apply.</small></span></button>
              <button type="button" className="quick-action" onClick={() => setActiveTab("versions")}><div>↻</div><span><strong>Policy Versions</strong><small>Track published versions and audit history.</small></span></button>
            </div>
          </div>
          <div className="recent-policy-card">
            <div className="section-heading"><div><span>RECENT ACTIVITY</span><h2>Recent Policies</h2></div><button type="button" onClick={() => setActiveTab("all")}>View All</button></div>
            <div className="recent-policy-list">
              {policies.slice(0, 5).map((item) => <div className="recent-policy-row" key={item.id}>
                <div className="recent-policy-name"><div className="recent-icon">{(item.name || "P").charAt(0).toUpperCase()}</div><div><strong>{item.name || "Untitled Policy"}</strong><span>{POLICY_TYPES.find((type) => type.value === item.type)?.label || item.type || "Policy"} · {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("en-IN") : "Recently updated"}</span></div></div>
                <span className={item.status === "Active" ? "status-active" : "status-draft"}>{item.status || "Draft"}</span>
              </div>)}
              {!loading && policies.length === 0 && <div className="policy-empty-state">No recent policies.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}