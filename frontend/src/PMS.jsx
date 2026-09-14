import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./PMS.css";

/**
 * BAUER HRMS — PMS
 * Performance Management System
 *
 * Role values:
 *   hr      -> HR / Admin
 *   employee
 *   reviewer1
 *   reviewer2
 *
 * Existing Employee Master data is read from:
 *   bauerHrmsEmployees
 *
 * PMS data is persisted in:
 *   bauerHrmsPmsCycles
 *   bauerHrmsPmsEligibility
 *   bauerHrmsPmsKraLibrary
 *   bauerHrmsPmsTemplates
 *   bauerHrmsPmsAssignments
 *   bauerHrmsPmsEvaluations
 *   bauerHrmsPmsSettings
 */

const EMPLOYEE_KEY = "bauerHrmsEmployees";
const CYCLES_KEY = "bauerHrmsPmsCycles";
const ELIGIBILITY_KEY = "bauerHrmsPmsEligibility";
const KRA_KEY = "bauerHrmsPmsKraLibrary";
const TEMPLATE_KEY = "bauerHrmsPmsTemplates";
const ASSIGNMENT_KEY = "bauerHrmsPmsAssignments";
const EVALUATION_KEY = "bauerHrmsPmsEvaluations";
const SETTINGS_KEY = "bauerHrmsPmsSettings";

const RATING_SCALE = [
  { value: 5, label: "Outstanding", pct: "81–100%" },
  { value: 4, label: "Excellent", pct: "61–80%" },
  { value: 3, label: "Good / Meets Expectations", pct: "41–60%" },
  { value: 2, label: "Needs Improvement", pct: "21–40%" },
  { value: 1, label: "Very Poor", pct: "0–20%" },
];

const DEFAULT_SETTINGS = {
  selfWeight: 33.34,
  reviewer1Weight: 33.33,
  reviewer2Weight: 33.33,
  yesNoYesRating: 5,
  yesNoNoRating: 1,
};

const DEFAULT_CYCLES = [
  {
    id: "PMS-2026-27",
    name: "FY 2026–27 Performance Cycle",
    financialYear: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    eligibilityDate: "2026-09-30",
    goalStart: "2026-04-01",
    goalEnd: "2026-09-30",
    selfStart: "2026-09-15",
    selfEnd: "2026-10-15",
    reviewer1Start: "2026-10-16",
    reviewer1End: "2026-11-15",
    reviewer2Start: "2026-11-16",
    reviewer2End: "2026-12-15",
    status: "Active",
  },
];

const DEFAULT_KRAS = [
  {
    id: "KRA-HR-001",
    department: "HR & Admin",
    title: "Attendance & Payroll Accuracy",
    description: "Maintain accurate attendance and payroll coordination with minimal errors.",
    type: "MCQ",
    options: RATING_SCALE.map((r) => r.label),
    weight: 20,
    mandatory: true,
    active: true,
  },
  {
    id: "KRA-HR-002",
    department: "HR & Admin",
    title: "Employee Query Resolution",
    description: "Resolve employee queries within agreed timelines and service standards.",
    type: "Target Based",
    target: 95,
    unit: "%",
    higherIsBetter: true,
    weight: 15,
    mandatory: true,
    active: true,
  },
  {
    id: "KRA-HR-003",
    department: "HR & Admin",
    title: "Statutory Compliance",
    description: "Complete statutory submissions within required timelines.",
    type: "Yes / No",
    weight: 15,
    mandatory: true,
    active: true,
  },
];

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function employeeName(employee) {
  return (
    employee?.name ||
    employee?.employeeName ||
    employee?.fullName ||
    [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
    "Unnamed Employee"
  );
}

function employeeCode(employee) {
  return String(
    employee?.employeeCode ??
      employee?.empCode ??
      employee?.employeeId ??
      employee?.id ??
      ""
  );
}

function employeeDepartment(employee) {
  return employee?.department || employee?.departmentName || "Not Assigned";
}

function employeeDOJ(employee) {
  return (
    employee?.doj ||
    employee?.dateOfJoining ||
    employee?.joiningDate ||
    employee?.date_joining ||
    ""
  );
}

function scoreToPercent(score) {
  return Number(((Number(score || 0) / 5) * 100).toFixed(2));
}

function ratingMeta(score) {
  const s = Math.max(1, Math.min(5, Math.round(Number(score || 0))));
  return RATING_SCALE.find((item) => item.value === s) || RATING_SCALE[4];
}

function weightedScore(parts, settings) {
  const available = parts.filter((p) => Number.isFinite(Number(p.score)));
  if (!available.length) return 0;
  const weightMap = {
    self: Number(settings.selfWeight || 0),
    reviewer1: Number(settings.reviewer1Weight || 0),
    reviewer2: Number(settings.reviewer2Weight || 0),
  };
  const totalWeight = available.reduce((sum, p) => sum + (weightMap[p.role] || 0), 0);
  if (!totalWeight) {
    return Number(
      (
        available.reduce((sum, p) => sum + Number(p.score), 0) /
        available.length
      ).toFixed(2)
    );
  }
  return Number(
    (
      available.reduce((sum, p) => sum + Number(p.score) * (weightMap[p.role] || 0), 0) /
      totalWeight
    ).toFixed(2)
  );
}

function evaluateTarget(actual, target, higherIsBetter = true) {
  const a = Number(actual);
  const t = Number(target);
  if (!Number.isFinite(a) || !Number.isFinite(t) || t === 0) return 0;
  const ratio = higherIsBetter ? a / t : t / a;
  if (ratio >= 1) return 5;
  if (ratio >= 0.9) return 4;
  if (ratio >= 0.75) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}

function statusClass(status) {
  return String(status || "Neutral").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function byNewest(a, b) {
  return String(b.createdAt || b.updatedAt || "").localeCompare(
    String(a.createdAt || a.updatedAt || "")
  );
}


function downloadText(content, fileName, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

export default function PMS({
  role = "hr",
  currentUserId = "",
  currentEmployeeId = "",
}) {
  const [activeView, setActiveView] = useState(
    role === "employee"
      ? "My Performance"
      : role === "reviewer1" || role === "reviewer2"
      ? "Team Evaluation"
      : "Dashboard"
  );

  const [employees, setEmployees] = useState(() =>
    readJSON(EMPLOYEE_KEY, [])
  );
  const [cycles, setCycles] = useState(() =>
    readJSON(CYCLES_KEY, DEFAULT_CYCLES)
  );
  const [eligibility, setEligibility] = useState(() =>
    readJSON(ELIGIBILITY_KEY, [])
  );
  const [kras, setKras] = useState(() =>
    readJSON(KRA_KEY, DEFAULT_KRAS)
  );
  const [templates, setTemplates] = useState(() =>
    readJSON(TEMPLATE_KEY, [])
  );
  const [assignments, setAssignments] = useState(() =>
    readJSON(ASSIGNMENT_KEY, [])
  );
  const [evaluations, setEvaluations] = useState(() =>
    readJSON(EVALUATION_KEY, [])
  );
  const [settings, setSettings] = useState(() =>
    readJSON(SETTINGS_KEY, DEFAULT_SETTINGS)
  );

  const [selectedCycleId, setSelectedCycleId] = useState(
    cycles[0]?.id || ""
  );
  const [toast, setToast] = useState("");
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [showKraModal, setShowKraModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingKra, setEditingKra] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [selectedEmployeeForEvaluation, setSelectedEmployeeForEvaluation] =
    useState("");
  const [evaluationRole, setEvaluationRole] = useState(
    role === "reviewer2" ? "reviewer2" : role === "reviewer1" ? "reviewer1" : "self"
  );
  const [search, setSearch] = useState("");

  const activeCycle =
    cycles.find((cycle) => cycle.id === selectedCycleId) || cycles[0] || null;

  const persist = (key, value, setter, message) => {
    setter(value);
    writeJSON(key, value);
    if (message) {
      setToast(message);
      window.setTimeout(() => setToast(""), 2600);
    }
  };

  useEffect(() => {
    const refresh = () => {
      setEmployees(readJSON(EMPLOYEE_KEY, []));
    };
    window.addEventListener("bauerHrmsEmployeesUpdated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("bauerHrmsEmployeesUpdated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const employeeById = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => {
      map.set(String(employee.id ?? employee.employeeId ?? employee.employeeCode), employee);
    });
    return map;
  }, [employees]);

  const eligibleRows = useMemo(() => {
    if (!activeCycle) return [];
    const cutoff = activeCycle.eligibilityDate;
    return employees.map((employee) => {
      const id = String(employee.id ?? employee.employeeId ?? employee.employeeCode);
      const override = eligibility.find(
        (item) =>
          item.cycleId === activeCycle.id && String(item.employeeId) === id
      );
      const systemEligible =
        !employeeDOJ(employee) ||
        !cutoff ||
        employeeDOJ(employee) <= cutoff;
      const finalEligible =
        override?.decision === "Eligible"
          ? true
          : override?.decision === "Excluded"
          ? false
          : systemEligible;

      return {
        employee,
        employeeId: id,
        systemEligible,
        finalEligible,
        override,
      };
    });
  }, [employees, eligibility, activeCycle]);

  const cycleAssignments = useMemo(
    () =>
      assignments.filter((item) => item.cycleId === activeCycle?.id),
    [assignments, activeCycle]
  );

  const activeAssignments = useMemo(
    () =>
      cycleAssignments.filter((item) => {
        const eligible = eligibleRows.find(
          (row) => String(row.employeeId) === String(item.employeeId)
        );
        return eligible?.finalEligible;
      }),
    [cycleAssignments, eligibleRows]
  );

  const cycleEvaluations = useMemo(
    () =>
      evaluations.filter((item) => item.cycleId === activeCycle?.id),
    [evaluations, activeCycle]
  );

  const myEmployee =
    employeeById.get(String(currentEmployeeId || currentUserId)) ||
    employees.find(
      (employee) =>
        String(employee.id ?? employee.employeeId ?? employee.employeeCode) ===
        String(currentEmployeeId || currentUserId)
    ) ||
    employees[0] ||
    null;

  const myAssignment = activeAssignments.find(
    (item) => String(item.employeeId) === String(myEmployee?.id ?? myEmployee?.employeeId ?? myEmployee?.employeeCode)
  );

  const myEvaluation = cycleEvaluations.find(
    (item) =>
      String(item.employeeId) ===
        String(myEmployee?.id ?? myEmployee?.employeeId ?? myEmployee?.employeeCode) &&
      item.role === "self"
  );

  const reviewerQueue = useMemo(() => {
    const expectedRole = role === "reviewer2" ? "reviewer2" : "reviewer1";
    return activeAssignments
      .map((assignment) => {
        const employee = employeeById.get(String(assignment.employeeId));
        const previous =
          expectedRole === "reviewer2"
            ? cycleEvaluations.find(
                (ev) =>
                  String(ev.employeeId) === String(assignment.employeeId) &&
                  ev.role === "reviewer1"
              )
            : null;
        const current = cycleEvaluations.find(
          (ev) =>
            String(ev.employeeId) === String(assignment.employeeId) &&
            ev.role === expectedRole
        );
        return {
          assignment,
          employee,
          previous,
          current,
        };
      })
      .filter((row) => row.employee);
  }, [role, activeAssignments, employeeById, cycleEvaluations]);

  const dashboardMetrics = useMemo(() => {
    const eligible = eligibleRows.filter((row) => row.finalEligible);
    const selfSubmitted = cycleEvaluations.filter((ev) => ev.role === "self" && ev.status === "Submitted");
    const r1Submitted = cycleEvaluations.filter((ev) => ev.role === "reviewer1" && ev.status === "Submitted");
    const r2Submitted = cycleEvaluations.filter((ev) => ev.role === "reviewer2" && ev.status === "Submitted");
    const finalScores = eligible
      .map((row) => cycleAssignments.find((a) => String(a.employeeId) === String(row.employeeId)))
      .map((assignment) => assignment?.finalScore)
      .filter((score) => Number.isFinite(Number(score)));
    return {
      activeEmployees: employees.filter((e) => String(e.status || "Active").toLowerCase() === "active").length,
      eligible: eligible.length,
      selfSubmitted: selfSubmitted.length,
      pendingReviews: Math.max(
        0,
        eligible.length - r1Submitted.length
      ),
      completed: r2Submitted.length,
      avgRating: finalScores.length
        ? Number(
            (
              finalScores.reduce((sum, score) => sum + Number(score), 0) /
              finalScores.length
            ).toFixed(2)
          )
        : 0,
    };
  }, [employees, eligibleRows, cycleAssignments, cycleEvaluations]);

  const navItems =
    role === "employee"
      ? ["My Performance", "My Goals", "My Evaluation", "Final Result"]
      : role === "reviewer1" || role === "reviewer2"
      ? ["Dashboard", "Self Evaluation", "Team Evaluation", "Final Results"]
      : [
          "Dashboard",
          "Eligibility",
          "KRA Library",
          "KRA Templates",
          "Evaluation Assignment",
          "Review Cycles",
          "Team Performance",
          "Reports",
          "Settings",
        ];

  function updateEligibility(employeeId, decision, reason = "") {
    if (!activeCycle) return;
    const current = eligibility.filter(
      (item) =>
        !(
          item.cycleId === activeCycle.id &&
          String(item.employeeId) === String(employeeId)
        )
    );
    const next = [
      ...current,
      {
        id: makeId("ELG"),
        cycleId: activeCycle.id,
        employeeId,
        decision,
        source: "Manual Override",
        reason,
        updatedAt: new Date().toISOString(),
      },
    ];
    persist(
      ELIGIBILITY_KEY,
      next,
      setEligibility,
      "PMS eligibility updated."
    );
  }

  function saveCycle(form) {
    const next = cycles.some((item) => item.id === form.id)
      ? cycles.map((item) => (item.id === form.id ? form : item))
      : [...cycles, form];
    persist(CYCLES_KEY, next, setCycles, "Review cycle saved.");
    if (!selectedCycleId) setSelectedCycleId(form.id);
    setShowCycleModal(false);
  }

  function saveKra(form, options = {}) {
    const normalized = {
      ...form,
      code: form.code || `KRA-${String(Date.now()).slice(-6)}`,
      category: form.category || "General",
      applicability: form.applicability || "Department",
      subDepartment: form.subDepartment || "",
      applicableDesignations: form.applicableDesignations || [],
      employmentTypes: form.employmentTypes || [],
      evidenceRequired: Boolean(form.evidenceRequired),
      employeeComment: form.employeeComment || "Optional",
      reviewerComment: form.reviewerComment || "Required",
      version: form.version || 1,
      updatedAt: new Date().toISOString(),
    };
    const next = kras.some((item) => item.id === normalized.id)
      ? kras.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item))
      : [...kras, { ...normalized, createdAt: new Date().toISOString() }];
    persist(KRA_KEY, next, setKras, options.silent ? "" : "KRA saved.");
    if (!options.keepModalOpen) {
      setShowKraModal(false);
      setEditingKra(null);
    }
    return normalized;
  }

  function addKraFromTemplate(form) {
    const saved = saveKra(
      {
        ...form,
        id: form.id || makeId("KRA"),
        active: true,
      },
      { keepModalOpen: true, silent: true }
    );
    setToast("Custom KRA added to the library.");
    window.setTimeout(() => setToast(""), 2200);
    return saved;
  }

  function deleteKra(id) {
    const used = templates.some((template) => (template.kraIds || []).includes(id));
    if (used) {
      setToast("This KRA is used by a template and cannot be deleted. Deactivate it instead.");
      window.setTimeout(() => setToast(""), 3200);
      return;
    }
    const next = kras.filter((item) => item.id !== id);
    persist(KRA_KEY, next, setKras, "KRA deleted.");
  }

  function toggleKra(id) {
    const next = kras.map((item) =>
      item.id === id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item
    );
    persist(KRA_KEY, next, setKras, "KRA status updated.");
  }

  function saveTemplate(form) {
    const kraWeights = form.kraWeights || Object.fromEntries(
      (form.kraIds || []).map((id) => [id, Number(kras.find((kra) => kra.id === id)?.weight || 0)])
    );
    const normalized = {
      ...form,
      version: form.version || 1,
      status: form.status || "Draft",
      financialYear: form.financialYear || activeCycle?.financialYear || "",
      kraWeights,
      totalWeight: Object.values(kraWeights).reduce((sum, value) => sum + Number(value || 0), 0),
      updatedAt: new Date().toISOString(),
    };
    const next = templates.some((item) => item.id === normalized.id)
      ? templates.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item))
      : [...templates, { ...normalized, createdAt: new Date().toISOString() }];
    persist(TEMPLATE_KEY, next, setTemplates, "KRA template saved.");
    setShowTemplateModal(false);
    setEditingTemplate(null);
  }

  function deleteTemplate(id) {
    const used = assignments.some((assignment) => assignment.templateId === id);
    if (used) {
      setToast("This template is already used in an assignment and cannot be deleted.");
      window.setTimeout(() => setToast(""), 3000);
      return;
    }
    const next = templates.filter((item) => item.id !== id);
    persist(TEMPLATE_KEY, next, setTemplates, "Template deleted.");
  }

  function duplicateTemplate(template) {
    const copy = {
      ...template,
      id: makeId("TPL"),
      name: `${template.name} — Copy`,
      status: "Draft",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [...templates, copy];
    persist(TEMPLATE_KEY, next, setTemplates, "Template duplicated.");
  }

  function importKraRows(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error("No KRA rows were found.");

    const normalizedRows = rows.map((row) => {
      const normalized = {};
      Object.entries(row || {}).forEach(([key, value]) => {
        normalized[String(key).trim()] = value == null ? "" : String(value).trim();
      });
      return normalized;
    });

    const required = ["Department", "KRA Title", "Question Type", "Weight"];
    const headers = Object.keys(normalizedRows[0] || {});
    const missingHeaders = required.filter(
      (header) =>
        !headers.some((h) => h.trim().toLowerCase() === header.toLowerCase())
    );

    if (missingHeaders.length) {
      throw new Error(`Missing columns: ${missingHeaders.join(", ")}`);
    }

    const imported = [];
    const errors = [];

    normalizedRows.forEach((row, index) => {
      const get = (name) => {
        const key = Object.keys(row).find(
          (h) => h.trim().toLowerCase() === name.toLowerCase()
        );
        return key ? String(row[key] ?? "").trim() : "";
      };

      const title = get("KRA Title");
      const department = get("Department");
      const type = get("Question Type") || "MCQ";
      const weight = Number(get("Weight") || 0);

      if (
        !title ||
        !department ||
        !["MCQ", "Target Based", "Yes / No"].includes(type) ||
        !Number.isFinite(weight) ||
        weight <= 0
      ) {
        errors.push(
          `Row ${index + 2}: invalid Department, KRA Title, Question Type or Weight.`
        );
        return;
      }

      const options = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
        .map((name) => get(name))
        .filter(Boolean);

      imported.push({
        id: get("KRA Code") || makeId("KRA"),
        code: get("KRA Code") || makeId("KRA-CODE"),
        department,
        subDepartment: get("Sub Department"),
        category: get("Category") || "General",
        title,
        description: get("Description"),
        type,
        options:
          options.length ? options : RATING_SCALE.map((rating) => rating.label),
        target: get("Target") || "",
        unit: get("Unit") || "%",
        higherIsBetter: get("Direction").toLowerCase() !== "lower is better",
        weight,
        mandatory: ["yes", "true", "1"].includes(get("Mandatory").toLowerCase()),
        evidenceRequired: ["yes", "true", "1"].includes(
          get("Evidence Required").toLowerCase()
        ),
        employeeComment: get("Employee Comment") || "Optional",
        reviewerComment: get("Reviewer Comment") || "Required",
        applicability: get("Applicable To") || "Department",
        applicableDesignations: get("Applicable Designations")
          ? get("Applicable Designations")
              .split("|")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        active:
          !get("Status") || get("Status").toLowerCase() === "active",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    if (!imported.length) {
      throw new Error(errors.join(" ") || "No valid KRA rows.");
    }

    // Prevent duplicate master codes from being silently created.
    const existingCodes = new Set(kras.map((kra) => String(kra.code || kra.id)));
    const uniqueImported = [];
    imported.forEach((item) => {
      if (existingCodes.has(String(item.code))) {
        errors.push(`${item.code}: duplicate KRA code already exists; row skipped.`);
        return;
      }
      existingCodes.add(String(item.code));
      uniqueImported.push(item);
    });

    if (!uniqueImported.length) {
      throw new Error(errors.join(" ") || "All imported KRA codes already exist.");
    }

    const next = [...kras, ...uniqueImported];
    persist(
      KRA_KEY,
      next,
      setKras,
      `Imported ${uniqueImported.length} KRAs${errors.length ? ` · ${errors.length} row(s) skipped` : ""}.`
    );
    return { imported: uniqueImported.length, errors };
  }

  async function importKrasFromFile(file) {
    if (!file) throw new Error("Please select a KRA import file.");

    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("The workbook has no worksheet.");
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
        defval: "",
      });
      return importKraRows(rows);
    }

    if (name.endsWith(".csv")) {
      return importKraRows(parseCSV(await file.text()));
    }

    throw new Error("Unsupported file. Please upload .xlsx, .xls or .csv.");
  }

  function importTemplateRows(rows) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new Error("No template rows were found.");
    }

    const normalizedRows = rows.map((row) => {
      const normalized = {};
      Object.entries(row || {}).forEach(([key, value]) => {
        normalized[String(key).trim()] = value == null ? "" : String(value).trim();
      });
      return normalized;
    });

    const imported = [];
    const errors = [];

    normalizedRows.forEach((row, index) => {
      const get = (name) => {
        const key = Object.keys(row).find(
          (h) => h.trim().toLowerCase() === name.toLowerCase()
        );
        return key ? String(row[key] ?? "").trim() : "";
      };

      const name = get("Template Name");
      const department = get("Department");
      const financialYear =
        get("Financial Year") || activeCycle?.financialYear || "";
      const kraCodes = get("KRA Codes")
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean);

      if (!name || !department || !kraCodes.length) {
        errors.push(
          `Row ${index + 2}: Template Name, Department and KRA Codes are required.`
        );
        return;
      }

      const resolvedKras = kraCodes
        .map((code) =>
          kras.find((kra) => String(kra.code || kra.id) === String(code))
        )
        .filter(Boolean);

      if (resolvedKras.length !== kraCodes.length) {
        errors.push(
          `Row ${index + 2}: one or more KRA Codes were not found in the library.`
        );
        return;
      }

      const kraWeights = Object.fromEntries(
        resolvedKras.map((kra) => [kra.id, Number(kra.weight || 0)])
      );

      const totalWeight = Object.values(kraWeights).reduce(
        (sum, value) => sum + Number(value || 0),
        0
      );

      imported.push({
        id: get("Template ID") || makeId("TPL"),
        name,
        department,
        financialYear,
        description: get("Description"),
        status: get("Status") || "Draft",
        version: Number(get("Version") || 1),
        kraIds: resolvedKras.map((kra) => kra.id),
        kraWeights,
        totalWeight,
        designations: get("Applicable Designations")
          ? get("Applicable Designations")
              .split("|")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    if (!imported.length) {
      throw new Error(errors.join(" ") || "No valid templates.");
    }

    const existingIds = new Set(templates.map((template) => String(template.id)));
    const uniqueImported = [];
    imported.forEach((item) => {
      if (existingIds.has(String(item.id))) {
        errors.push(`${item.name}: template ID already exists; row skipped.`);
        return;
      }
      existingIds.add(String(item.id));
      uniqueImported.push(item);
    });

    if (!uniqueImported.length) {
      throw new Error(errors.join(" ") || "All imported template IDs already exist.");
    }

    const next = [...templates, ...uniqueImported];
    persist(
      TEMPLATE_KEY,
      next,
      setTemplates,
      `Imported ${uniqueImported.length} templates${errors.length ? ` · ${errors.length} row(s) skipped` : ""}.`
    );
    return { imported: uniqueImported.length, errors };
  }

  async function importTemplatesFromFile(file) {
    if (!file) throw new Error("Please select a template import file.");

    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("The workbook has no worksheet.");
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
        defval: "",
      });
      return importTemplateRows(rows);
    }

    if (name.endsWith(".csv")) {
      return importTemplateRows(parseCSV(await file.text()));
    }

    throw new Error("Unsupported file. Please upload .xlsx, .xls or .csv.");
  }

  function saveAssignment(form) {
    const kraIds = form.kraIds?.length
      ? form.kraIds
      : kras
          .filter((kra) => kra.department === form.department && kra.active)
          .map((kra) => kra.id);
    const selectedTemplate = templates.find((template) => template.id === form.templateId);
    const kraWeights =
      selectedTemplate?.kraWeights ||
      Object.fromEntries(
        kraIds.map((id) => [id, Number(kras.find((kra) => kra.id === id)?.weight || 0)])
      );
    const assignment = {
      ...form,
      kraIds,
      kraWeights,
      templateVersion: selectedTemplate?.version || 1,
      status: "Assigned",
      updatedAt: new Date().toISOString(),
      selfStatus: "Pending",
      reviewer1Status: "Pending",
      reviewer2Status: "Pending",
    };
    const next = assignments.some(
      (item) =>
        item.cycleId === assignment.cycleId &&
        String(item.employeeId) === String(assignment.employeeId)
    )
      ? assignments.map((item) =>
          item.cycleId === assignment.cycleId &&
          String(item.employeeId) === String(assignment.employeeId)
            ? { ...item, ...assignment }
            : item
        )
      : [...assignments, assignment];
    persist(
      ASSIGNMENT_KEY,
      next,
      setAssignments,
      "Evaluation assignment saved."
    );
    setShowAssignModal(false);
  }

  function saveSettings(nextSettings) {
    persist(
      SETTINGS_KEY,
      nextSettings,
      setSettings,
      "PMS scoring settings saved."
    );
  }

  function openEmployeeEvaluation(employeeId, evalRole = "self") {
    setSelectedEmployeeForEvaluation(String(employeeId));
    setEvaluationRole(evalRole);
    const existing = cycleEvaluations.find(
      (ev) =>
        String(ev.employeeId) === String(employeeId) &&
        ev.role === evalRole
    );
    setSelectedEvaluation(existing || null);
  }

  function saveEvaluation(payload) {
    const {
      employeeId,
      role: evalRole,
      answers,
      score,
      status = "Submitted",
      comments = "",
    } = payload;

    const assignment = activeAssignments.find(
      (item) => String(item.employeeId) === String(employeeId)
    );
    if (!assignment) return;

    const record = {
      id:
        selectedEvaluation?.id ||
        makeId(`EVAL-${evalRole.toUpperCase()}`),
      cycleId: activeCycle.id,
      assignmentId: assignment.id,
      employeeId,
      role: evalRole,
      answers,
      score: Number(score || 0),
      percent: scoreToPercent(score),
      rating: ratingMeta(score),
      status,
      comments,
      submittedAt: new Date().toISOString(),
    };

    const next = evaluations.some((item) => item.id === record.id)
      ? evaluations.map((item) => (item.id === record.id ? record : item))
      : [...evaluations, record];

    const updatedAssignments = assignments.map((item) => {
      if (item.id !== assignment.id) return item;
      const patch =
        evalRole === "self"
          ? { selfStatus: status, selfScore: record.score }
          : evalRole === "reviewer1"
          ? { reviewer1Status: status, reviewer1Score: record.score }
          : { reviewer2Status: status, reviewer2Score: record.score };
      const merged = { ...item, ...patch, updatedAt: new Date().toISOString() };
      const parts = [
        { role: "self", score: merged.selfScore },
        { role: "reviewer1", score: merged.reviewer1Score },
        { role: "reviewer2", score: merged.reviewer2Score },
      ];
      const finalScore = weightedScore(parts, settings);
      return {
        ...merged,
        finalScore,
        finalPercent: scoreToPercent(finalScore),
        finalBand: ratingMeta(finalScore).label,
      };
    });

    setEvaluations(next);
    writeJSON(EVALUATION_KEY, next);
    setAssignments(updatedAssignments);
    writeJSON(ASSIGNMENT_KEY, updatedAssignments);
    window.dispatchEvent(
      new CustomEvent("bauerHrmsPmsUpdated", {
        detail: { cycleId: activeCycle.id, employeeId, role: evalRole },
      })
    );
    setToast("Evaluation submitted successfully.");
    window.setTimeout(() => setToast(""), 3000);
    setSelectedEvaluation(record);
  }

  return (
    <div className="pms-page">
      <div className="pms-page-head">
        <div>
          <span className="pms-eyebrow">PEOPLE • PERFORMANCE</span>
          <h1>Performance Management</h1>
          <p>Goals, KRA, evaluations, reviews and final performance outcomes in one workspace.</p>
        </div>

        <div className="pms-head-actions">
          <label className="pms-cycle-label">Review Cycle</label>
          <select
            value={selectedCycleId}
            onChange={(event) => setSelectedCycleId(event.target.value)}
            className="pms-cycle-select"
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.financialYear} · {cycle.name}
              </option>
            ))}
          </select>

          {(role === "hr") && (
            <button className="pms-primary" onClick={() => setShowCycleModal(true)}>
              + Create Cycle
            </button>
          )}
        </div>
      </div>

      <div className="pms-nav">
        {navItems.map((item) => (
          <button
            key={item}
            className={activeView === item ? "active" : ""}
            onClick={() => setActiveView(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {activeView === "Dashboard" && (
        <DashboardView
          role={role}
          metrics={dashboardMetrics}
          activeCycle={activeCycle}
          activeAssignments={activeAssignments}
          cycleEvaluations={cycleEvaluations}
          employees={employees}
          reviewerQueue={reviewerQueue}
          openEmployeeEvaluation={openEmployeeEvaluation}
        />
      )}

      {activeView === "Eligibility" && role === "hr" && (
        <EligibilityView
          activeCycle={activeCycle}
          rows={eligibleRows}
          search={search}
          setSearch={setSearch}
          updateEligibility={updateEligibility}
        />
      )}

      {activeView === "KRA Library" && role === "hr" && (
        <KraLibraryView
          kras={kras}
          search={search}
          setSearch={setSearch}
          setShowKraModal={setShowKraModal}
          deleteKra={deleteKra}
          toggleKra={toggleKra}
          setEditingKra={setEditingKra}
          onImportFile={importKrasFromFile}
        />
      )}

      {activeView === "KRA Templates" && role === "hr" && (
        <TemplateView
          templates={templates}
          kras={kras}
          setShowTemplateModal={setShowTemplateModal}
          deleteTemplate={deleteTemplate}
          setEditingTemplate={setEditingTemplate}
          duplicateTemplate={duplicateTemplate}
          activeCycle={activeCycle}
          onImportTemplates={importTemplatesFromFile}
        />
      )}

      {activeView === "Evaluation Assignment" && role === "hr" && (
        <AssignmentView
          assignments={activeAssignments}
          employees={employees}
          cycle={activeCycle}
          templates={templates}
          kras={kras}
          setShowAssignModal={setShowAssignModal}
          openEmployeeEvaluation={openEmployeeEvaluation}
        />
      )}

      {activeView === "Review Cycles" && role === "hr" && (
        <ReviewCyclesView
          cycles={cycles}
          selectedCycleId={selectedCycleId}
          setSelectedCycleId={setSelectedCycleId}
          onCreate={() => setShowCycleModal(true)}
        />
      )}

      {activeView === "Team Performance" && role === "hr" && (
        <TeamPerformanceView
          assignments={activeAssignments}
          employees={employees}
          evaluations={cycleEvaluations}
          openEmployeeEvaluation={openEmployeeEvaluation}
        />
      )}

      {activeView === "Reports" && role === "hr" && (
        <ReportsView
          assignments={activeAssignments}
          employees={employees}
          evaluations={cycleEvaluations}
          cycle={activeCycle}
        />
      )}

      {activeView === "Settings" && role === "hr" && (
        <SettingsView settings={settings} onSave={saveSettings} />
      )}

      {(activeView === "My Performance" || activeView === "My Goals") && role === "employee" && (
        <MyPerformanceView
          employee={myEmployee}
          assignment={myAssignment}
          selfEvaluation={myEvaluation}
          cycle={activeCycle}
          kras={kras}
          openEmployeeEvaluation={openEmployeeEvaluation}
        />
      )}

      {activeView === "My Evaluation" && role === "employee" && (
        <EvaluationView
          title="Self Evaluation"
          employee={myEmployee}
          assignment={myAssignment}
          cycle={activeCycle}
          kras={kras}
          existing={myEvaluation}
          evaluationRole="self"
          onSave={saveEvaluation}
        />
      )}

      {activeView === "Final Result" && role === "employee" && (
        <FinalResultView
          employee={myEmployee}
          assignment={myAssignment}
          evaluations={cycleEvaluations}
        />
      )}

      {activeView === "Self Evaluation" && (role === "reviewer1" || role === "reviewer2") && (
        <EvaluationView
          title="Self Evaluation"
          employee={myEmployee}
          assignment={myAssignment}
          cycle={activeCycle}
          kras={kras}
          existing={myEvaluation}
          evaluationRole="self"
          onSave={saveEvaluation}
        />
      )}

      {activeView === "Team Evaluation" && (role === "reviewer1" || role === "reviewer2") && (
        <TeamEvaluationView
          role={role}
          queue={reviewerQueue}
          evaluations={cycleEvaluations}
          kras={kras}
          cycle={activeCycle}
          onOpen={openEmployeeEvaluation}
          selectedEmployeeForEvaluation={selectedEmployeeForEvaluation}
        />
      )}

      {activeView === "Final Results" && (role === "reviewer1" || role === "reviewer2") && (
        <TeamPerformanceView
          assignments={activeAssignments}
          employees={employees}
          evaluations={cycleEvaluations}
          openEmployeeEvaluation={openEmployeeEvaluation}
        />
      )}

      {showKraModal && (
        <KraModal
          kras={kras}
          departments={[...new Set(employees.map(employeeDepartment).filter(Boolean))]}
          initialKra={editingKra}
          onClose={() => {
            setShowKraModal(false);
            setEditingKra(null);
          }}
          onSave={saveKra}
        />
      )}

      {showTemplateModal && (
        <TemplateModal
          kras={kras}
          initialTemplate={editingTemplate}
          activeCycle={activeCycle}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          onSave={saveTemplate}
          onCreateKra={addKraFromTemplate}
        />
      )}

      {showAssignModal && (
        <AssignmentModal
          cycle={activeCycle}
          employees={eligibleRows.filter((row) => row.finalEligible).map((row) => row.employee)}
          templates={templates}
          kras={kras}
          onClose={() => setShowAssignModal(false)}
          onSave={saveAssignment}
        />
      )}

      {showCycleModal && (
        <CycleModal
          cycle={activeCycle}
          onClose={() => setShowCycleModal(false)}
          onSave={saveCycle}
        />
      )}

      {selectedEmployeeForEvaluation && activeView === "Team Evaluation" && (
        <TeamEvaluationModal
          role={role}
          employee={employeeById.get(String(selectedEmployeeForEvaluation))}
          assignment={activeAssignments.find(
            (item) =>
              String(item.employeeId) ===
              String(selectedEmployeeForEvaluation)
          )}
          cycle={activeCycle}
          kras={kras}
          evaluations={cycleEvaluations}
          evaluationRole={evaluationRole}
          onClose={() => {
            setSelectedEmployeeForEvaluation("");
            setSelectedEvaluation(null);
          }}
          onSave={saveEvaluation}
        />
      )}

      {toast && <div className="pms-toast">{toast}</div>}
    </div>
  );
}

function DashboardView({
  role,
  metrics,
  activeCycle,
  activeAssignments,
  cycleEvaluations,
  employees,
  reviewerQueue,
  openEmployeeEvaluation,
}) {
  const reviewQueue = role === "reviewer1" || role === "reviewer2"
    ? reviewerQueue
    : activeAssignments.slice(0, 5).map((assignment) => ({
        assignment,
        employee: employees.find(
          (employee) =>
            String(employee.id ?? employee.employeeId ?? employee.employeeCode) ===
            String(assignment.employeeId)
        ),
      }));

  return (
    <>
      <section className="pms-hero">
        <div>
          <span>PERFORMANCE WORKSPACE</span>
          <h2>
            {role === "employee"
              ? "Your performance journey"
              : role === "reviewer1"
              ? "Team performance review"
              : role === "reviewer2"
              ? "Final reviewer workspace"
              : "Performance cycle overview"}
          </h2>
          <p>
            {activeCycle?.name || "Create your first review cycle to get started."}
          </p>
        </div>
        <div className="pms-hero-cycle">
          <small>Current cycle</small>
          <strong>{activeCycle?.financialYear || "—"}</strong>
          <span>{activeCycle?.status || "Draft"}</span>
        </div>
      </section>

      <section className="pms-kpi-grid">
        <Kpi label="Active Employees" value={metrics.activeEmployees} tone="blue" />
        <Kpi label="PMS Eligible" value={metrics.eligible} tone="purple" />
        <Kpi label="Self Evaluations" value={metrics.selfSubmitted} tone="green" />
        <Kpi label="Reviews Pending" value={metrics.pendingReviews} tone="amber" />
        <Kpi label="Completed" value={metrics.completed} tone="green" />
        <Kpi
          label="Average Rating"
          value={metrics.avgRating ? `${metrics.avgRating}/5` : "—"}
          tone="purple"
        />
      </section>

      <div className="pms-two-col">
        <section className="pms-card">
          <CardHead eyebrow="CYCLE PROGRESS" title="Evaluation Progress" />
          <div className="pms-progress-list">
            <ProgressLine label="Eligible Employees" value={metrics.eligible} total={Math.max(metrics.activeEmployees, metrics.eligible, 1)} tone="purple" />
            <ProgressLine label="Self Evaluation" value={metrics.selfSubmitted} total={Math.max(metrics.eligible, 1)} tone="green" />
            <ProgressLine label="Completed Reviews" value={metrics.completed} total={Math.max(metrics.eligible, 1)} tone="blue" />
          </div>
        </section>

        <section className="pms-card">
          <CardHead eyebrow="REVIEW ATTENTION" title="Items Requiring Action" />
          <div className="pms-attention-list">
            <AttentionRow
              tone={metrics.pendingReviews ? "danger" : "success"}
              title={`${metrics.pendingReviews} reviews pending`}
              text={metrics.pendingReviews ? "Reviewer action is required." : "No pending reviews."}
            />
            <AttentionRow
              tone={activeCycle?.status === "Active" ? "success" : "warning"}
              title={activeCycle?.status || "Cycle not configured"}
              text={activeCycle?.name || "Create a PMS review cycle."}
            />
            <AttentionRow
              tone="info"
              title={`${metrics.eligible} PMS-eligible employees`}
              text="Eligibility is driven by joining date with manual override support."
            />
          </div>
        </section>
      </div>

      <section className="pms-card">
        <CardHead
          eyebrow="TEAM SNAPSHOT"
          title={role === "employee" ? "My Performance" : "Evaluation Queue"}
        />
        <div className="pms-table-wrap">
          <table className="pms-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Self</th>
                <th>Reviewer 1</th>
                <th>Reviewer 2</th>
                <th>Final</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.length ? (
                reviewQueue.map((row) => {
                  const a = row.assignment;
                  return (
                    <tr key={a.id}>
                      <td>
                        <strong>{employeeName(row.employee)}</strong>
                        <small>{employeeDepartment(row.employee)}</small>
                      </td>
                      <td>{a.selfScore ? `${a.selfScore}/5` : "Pending"}</td>
                      <td>{a.reviewer1Score ? `${a.reviewer1Score}/5` : "Pending"}</td>
                      <td>{a.reviewer2Score ? `${a.reviewer2Score}/5` : "Pending"}</td>
                      <td><strong>{a.finalScore ? `${a.finalScore}/5` : "—"}</strong></td>
                      <td>
                        <span className={`pms-pill ${a.reviewer2Status === "Submitted" ? "success" : a.reviewer1Status === "Submitted" ? "info" : "warning"}`}>
                          {a.reviewer2Status === "Submitted"
                            ? "Completed"
                            : a.reviewer1Status === "Submitted"
                            ? "Reviewer 2 Pending"
                            : a.selfStatus === "Submitted"
                            ? "Reviewer 1 Pending"
                            : "Self Evaluation Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6">
                    <EmptyState title="No PMS evaluations yet" text="Eligible employees will appear here after KRA assignment." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function EligibilityView({
  activeCycle,
  rows,
  search,
  setSearch,
  updateEligibility,
}) {
  const filtered = rows.filter((row) => {
    const term = search.toLowerCase();
    return (
      !term ||
      employeeName(row.employee).toLowerCase().includes(term) ||
      employeeCode(row.employee).toLowerCase().includes(term) ||
      employeeDepartment(row.employee).toLowerCase().includes(term)
    );
  });

  const summary = {
    eligible: rows.filter((row) => row.finalEligible).length,
    system: rows.filter((row) => row.systemEligible).length,
    manual: rows.filter((row) => row.override).length,
    excluded: rows.filter((row) => !row.finalEligible).length,
  };

  return (
    <>
      <section className="pms-section-banner">
        <div>
          <span>ELIGIBILITY RULE</span>
          <h2>Who is eligible for {activeCycle?.financialYear || "this cycle"}?</h2>
          <p>
            Default rule: employees whose Date of Joining is on or before{" "}
            <strong>{activeCycle?.eligibilityDate || "—"}</strong> are eligible.
            HR can manually include or exclude employees and record a reason.
          </p>
        </div>
        <div className="pms-rule-chip">
          Joining Date ≤ {activeCycle?.eligibilityDate || "—"}
        </div>
      </section>

      <section className="pms-kpi-grid pms-kpi-4">
        <Kpi label="System Eligible" value={summary.system} tone="green" />
        <Kpi label="Final Eligible" value={summary.eligible} tone="purple" />
        <Kpi label="Manual Overrides" value={summary.manual} tone="amber" />
        <Kpi label="Excluded" value={summary.excluded} tone="danger" />
      </section>

      <section className="pms-card">
        <CardHead eyebrow="ELIGIBILITY LIST" title="PMS Eligibility" />
        <div className="pms-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee, code or department..."
          />
        </div>
        <div className="pms-table-wrap">
          <table className="pms-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>DOJ</th>
                <th>System</th>
                <th>Final</th>
                <th>Source</th>
                <th>Override Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.employeeId}>
                  <td>
                    <strong>{employeeName(row.employee)}</strong>
                    <small>{employeeCode(row.employee)}</small>
                  </td>
                  <td>{employeeDOJ(row.employee) || "—"}</td>
                  <td>
                    <span className={`pms-pill ${row.systemEligible ? "success" : "danger"}`}>
                      {row.systemEligible ? "Eligible" : "Not Eligible"}
                    </span>
                  </td>
                  <td>
                    <span className={`pms-pill ${row.finalEligible ? "success" : "danger"}`}>
                      {row.finalEligible ? "Eligible" : "Excluded"}
                    </span>
                  </td>
                  <td>
                    {row.override ? (
                      <span className="pms-pill warning">Manual Override</span>
                    ) : (
                      <span className="pms-pill info">Joining Date</span>
                    )}
                  </td>
                  <td>{row.override?.reason || "System rule"}</td>
                  <td className="pms-table-actions">
                    {!row.finalEligible ? (
                      <button
                        className="pms-action success"
                        onClick={() =>
                          updateEligibility(
                            row.employeeId,
                            "Eligible",
                            "Manual inclusion despite system eligibility rule."
                          )
                        }
                      >
                        Include
                      </button>
                    ) : (
                      <button
                        className="pms-action danger"
                        onClick={() =>
                          updateEligibility(
                            row.employeeId,
                            "Excluded",
                            "Manual exclusion from PMS cycle."
                          )
                        }
                      >
                        Exclude
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function KraLibraryView({
  kras,
  search,
  setSearch,
  setShowKraModal,
  deleteKra,
  toggleKra,
  setEditingKra,
  onImport,
}) {
  const [department, setDepartment] = useState("All");
  const [category, setCategory] = useState("All");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  const departments = ["All", ...new Set(kras.map((kra) => kra.department).filter(Boolean))];
  const categories = ["All", ...new Set(kras.map((kra) => kra.category || "General"))];
  const types = ["All", "MCQ", "Target Based", "Yes / No"];

  const departmentRows = useMemo(
    () =>
      departments.map((item) => {
        const rows = item === "All" ? kras : kras.filter((kra) => kra.department === item);
        return {
          name: item,
          total: rows.length,
          active: rows.filter((kra) => kra.active).length,
          inactive: rows.filter((kra) => !kra.active).length,
        };
      }),
    [departments, kras]
  );

  const filtered = kras.filter((kra) => {
    const term = search.toLowerCase().trim();
    return (
      (!term ||
        [kra.code, kra.title, kra.department, kra.category, kra.type, kra.description]
          .join(" ")
          .toLowerCase()
          .includes(term)) &&
      (department === "All" || kra.department === department) &&
      (category === "All" || (kra.category || "General") === category) &&
      (type === "All" || kra.type === type) &&
      (status === "All" || (status === "Active" ? kra.active : !kra.active))
    );
  });

  const activeCount = kras.filter((kra) => kra.active).length;
  const inactiveCount = kras.filter((kra) => !kra.active).length;
  const usedDepartments = new Set(kras.map((kra) => kra.department).filter(Boolean)).size;

  function exportKraWorkbook() {
    const headers = [
      "KRA Code","Department","Sub Department","Category","KRA Title",
      "Description","Question Type","Option 1","Option 2","Option 3",
      "Option 4","Option 5","Target","Unit","Direction","Weight",
      "Mandatory","Evidence Required","Employee Comment","Reviewer Comment",
      "Applicable To","Applicable Designations","Status"
    ];

    const rows = filtered.map((kra) => [
      kra.code || kra.id,
      kra.department,
      kra.subDepartment || "",
      kra.category || "",
      kra.title,
      kra.description || "",
      kra.type,
      ...(RATING_SCALE.map((_, index) => kra.options?.[index] || "")),
      kra.target || "",
      kra.unit || "",
      kra.higherIsBetter ? "Higher is Better" : "Lower is Better",
      kra.weight ?? "",
      kra.mandatory ? "Yes" : "No",
      kra.evidenceRequired ? "Yes" : "No",
      kra.employeeComment || "Optional",
      kra.reviewerComment || "Required",
      kra.applicability || "Department",
      (kra.applicableDesignations || []).join("|"),
      kra.active ? "Active" : "Inactive"
    ]);

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(workbook, sheet, "KRA Import");
    XLSX.writeFile(workbook, "BAUER_PMS_KRA_Library.xlsx");
    setImportMessage(`Exported ${rows.length} KRA question bank item${rows.length === 1 ? "" : "s"}.`);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportBusy(true);
    setImportMessage("");

    try {
      const result = await onImportFile(file);
      setImportMessage(
        `${result.imported} question bank item${result.imported === 1 ? "" : "s"} imported successfully${
          result.errors?.length ? ` · ${result.errors.length} row(s) skipped` : ""
        }.`
      );
    } catch (error) {
      setImportMessage(error.message || "Import failed.");
    } finally {
      setImportBusy(false);
    }
  }

  function downloadTemplate() {
    const rows = [
      [
        "KRA Code","Department","Sub Department","Category","KRA Title","Description",
        "Question Type","Option 1","Option 2","Option 3","Option 4","Option 5",
        "Target","Unit","Direction","Weight","Mandatory","Evidence Required",
        "Employee Comment","Reviewer Comment","Applicable To","Applicable Designations","Status"
      ],
      [
        "HR-PAY-001","HR & Admin","Payroll","Operations","Payroll Accuracy",
        "Maintain accurate and timely payroll processing.","MCQ",
        "Outstanding","Excellent","Good / Meets Expectations","Needs Improvement","Very Poor",
        "","","Higher is Better",15,"Yes","No","Optional","Required","Department",
        "Assistant Manager|Manager","Active"
      ]
    ];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "KRA Import");
    XLSX.writeFile(workbook, "BAUER_PMS_KRA_Import_Template.xlsx");
  }

  function displayOptions(kra) {
    if (kra.type === "MCQ") {
      return (kra.options || RATING_SCALE.map((r) => r.label)).map((label, index) => ({
        rating: Math.max(1, 5 - index),
        label,
        pct: RATING_SCALE[index]?.pct || "",
      }));
    }

    if (kra.type === "Yes / No") {
      return [
        { rating: 5, label: "Yes", pct: "Positive response" },
        { rating: 1, label: "No", pct: "Negative response" },
      ];
    }

    return [];
  }

  return (
    <section className="pms-kra-shell pms-department-library">
      <div className="pms-module-heading pms-library-heading">
        <div>
          <span className="pms-section-label">KRA LIBRARY</span>
          <h2>KRA Question Bank</h2>
          <p>
            Maintain department-wise reusable KRA questions, scoring options, KPI rules and
            evaluation controls from one master workspace.
          </p>
        </div>

        <div className="pms-module-actions">
          <button className="pms-secondary" onClick={downloadTemplate}>
            ↓ Excel Template
          </button>

          <label className="pms-secondary pms-file-button">
            {importBusy ? "Importing..." : "↑ Import Excel"}
            <input type="file" accept=".csv,.xlsx" onChange={handleImport} disabled={importBusy} />
          </label>

          <button className="pms-secondary" onClick={exportKraWorkbook}>
            ↓ Export
          </button>

          <button
            className="pms-primary"
            onClick={() => {
              setEditingKra(null);
              setShowKraModal(true);
            }}
          >
            + Add Question
          </button>
        </div>
      </div>

      <div className="pms-kpi-grid pms-kra-summary pms-kra-summary-compact">
        <Kpi label="Question Bank" value={kras.length} tone="purple" />
        <Kpi label="Active" value={activeCount} tone="green" />
        <Kpi label="Inactive" value={inactiveCount} tone="amber" />
        <Kpi label="Departments" value={usedDepartments} tone="blue" />
      </div>

      {importMessage && (
        <div className="pms-import-message">
          {importMessage}
        </div>
      )}

      <div className="pms-department-workspace">
        <aside className="pms-department-sidebar">
          <div className="pms-department-sidebar-head">
            <span>DEPARTMENTS</span>
            <strong>{usedDepartments}</strong>
          </div>

          <div className="pms-department-list">
            {departmentRows.map((item) => (
              <button
                key={item.name}
                className={department === item.name ? "active" : ""}
                onClick={() => {
                  setDepartment(item.name);
                  setExpandedId(null);
                }}
              >
                <span className="pms-department-icon">
                  {item.name === "All" ? "◎" : item.name.slice(0, 1).toUpperCase()}
                </span>

                <span className="pms-department-copy">
                  <strong>{item.name === "All" ? "All Departments" : item.name}</strong>
                  <small>
                    {item.active} active · {item.total} total
                  </small>
                </span>

                <b>{item.total}</b>
              </button>
            ))}
          </div>

          <div className="pms-department-sidebar-note">
            <strong>Question bank status</strong>
            <span>Green = active and available for assignment.</span>
            <span>Inactive questions stay in history and can be reactivated.</span>
          </div>
        </aside>

        <section className="pms-kra-content">
          <div className="pms-kra-content-head">
            <div>
              <span className="pms-section-label">
                {department === "All" ? "ALL QUESTION BANKS" : department.toUpperCase()}
              </span>
              <h3>
                {department === "All" ? "Department-wise KRA Master" : `${department} — Question Bank`}
              </h3>
              <p>
                {filtered.length} item{filtered.length === 1 ? "" : "s"} shown · click a row to view
                the full question, options and evaluation rules.
              </p>
            </div>

            <div className="pms-kra-head-status">
              <span><i className="green-dot" /> {filtered.filter((kra) => kra.active).length} Active</span>
              <span><i className="amber-dot" /> {filtered.filter((kra) => !kra.active).length} Inactive</span>
            </div>
          </div>

          <div className="pms-kra-filterbar">
            <div className="pms-kra-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search question, KRA code, category..."
              />
            </div>

            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All Categories" : item}
                </option>
              ))}
            </select>

            <select value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All Question Types" : item}
                </option>
              ))}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="pms-question-bank">
            {filtered.map((kra) => {
              const isExpanded = expandedId === kra.id;
              const options = displayOptions(kra);

              return (
                <article key={kra.id} className={`pms-question-row ${isExpanded ? "expanded" : ""}`}>
                  <button
                    className="pms-question-row-main"
                    onClick={() => setExpandedId(isExpanded ? null : kra.id)}
                  >
                    <span className="pms-expand-icon">{isExpanded ? "⌄" : "›"}</span>

                    <span className="pms-question-code">
                      <strong>{kra.code || kra.id}</strong>
                      <small>{kra.department}</small>
                    </span>

                    <span className="pms-question-title-cell">
                      <strong>{kra.title}</strong>
                      <small>{kra.description || "No guidance added."}</small>
                    </span>

                    <span className="pms-question-type-cell">
                      <span className="pms-type-badge">{kra.type}</span>
                      <small>{kra.category || "General"}</small>
                    </span>

                    <span className="pms-question-weight-cell">
                      <strong>{kra.weight || 0}%</strong>
                      <small>Weight</small>
                    </span>

                    <span className={`pms-status-toggle ${kra.active ? "on" : "off"}`}>
                      <i />
                      {kra.active ? "Active" : "Inactive"}
                    </span>
                  </button>

                  <div className="pms-question-row-actions">
                    <button
                      onClick={() => {
                        setEditingKra(kra);
                        setShowKraModal(true);
                      }}
                      title="Edit question"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => toggleKra(kra.id)}
                      className={kra.active ? "warning" : "success"}
                      title={kra.active ? "Deactivate question" : "Activate question"}
                    >
                      {kra.active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={() => deleteKra(kra.id)}
                      className="danger"
                      title="Delete question"
                    >
                      Delete
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="pms-question-detail">
                      <div className="pms-question-detail-overview">
                        <div>
                          <span>Evaluation Question</span>
                          <strong>{kra.title}</strong>
                          <p>{kra.description || "No description or evaluation guidance added."}</p>
                        </div>

                        <div className="pms-detail-meta-grid">
                          <div><small>Department</small><strong>{kra.department}</strong></div>
                          <div><small>Sub Department</small><strong>{kra.subDepartment || "—"}</strong></div>
                          <div><small>Category</small><strong>{kra.category || "General"}</strong></div>
                          <div><small>Weight</small><strong>{kra.weight || 0}%</strong></div>
                        </div>
                      </div>

                      <div className="pms-question-detail-grid">
                        <div className="pms-detail-box">
                          <div className="pms-detail-box-head">
                            <span>RESPONSE / SCORING</span>
                            <b>{kra.type}</b>
                          </div>

                          {kra.type === "Target Based" ? (
                            <div className="pms-target-detail">
                              <div><small>KPI Target</small><strong>{kra.target || "—"}{kra.unit || ""}</strong></div>
                              <div><small>Direction</small><strong>{kra.higherIsBetter ? "Higher is Better" : "Lower is Better"}</strong></div>
                              <div><small>Rating Engine</small><strong>Automatic 1–5</strong></div>
                            </div>
                          ) : (
                            <div className="pms-bank-options">
                              {options.map((option, index) => (
                                <div key={`${kra.id}-${index}`}>
                                  <span className="pms-bank-rating">{option.rating}</span>
                                  <strong>{option.label}</strong>
                                  <small>{option.pct}</small>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pms-detail-box">
                          <div className="pms-detail-box-head">
                            <span>RULES & APPLICABILITY</span>
                            <b>{kra.active ? "Available" : "Not Available"}</b>
                          </div>

                          <div className="pms-rules-grid">
                            <div>
                              <small>Mandatory</small>
                              <strong className={kra.mandatory ? "ok" : "muted"}>{kra.mandatory ? "Yes" : "No"}</strong>
                            </div>
                            <div>
                              <small>Evidence</small>
                              <strong className={kra.evidenceRequired ? "ok" : "muted"}>{kra.evidenceRequired ? "Required" : "Not Required"}</strong>
                            </div>
                            <div>
                              <small>Employee Comment</small>
                              <strong>{kra.employeeComment || "Optional"}</strong>
                            </div>
                            <div>
                              <small>Reviewer Comment</small>
                              <strong>{kra.reviewerComment || "Required"}</strong>
                            </div>
                            <div>
                              <small>Applicable To</small>
                              <strong>{kra.applicability || "Department"}</strong>
                            </div>
                            <div>
                              <small>Version</small>
                              <strong>v{kra.version || 1}</strong>
                            </div>
                          </div>

                          {!!kra.applicableDesignations?.length && (
                            <div className="pms-designation-chips">
                              {kra.applicableDesignations.map((designation) => (
                                <span key={designation}>{designation}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pms-question-detail-footer">
                        <span>
                          This master question can be added to multiple department templates.
                        </span>
                        <div>
                          <button
                            onClick={() => {
                              setEditingKra(kra);
                              setShowKraModal(true);
                            }}
                          >
                            Edit Question
                          </button>
                          <button
                            onClick={() => toggleKra(kra.id)}
                            className={kra.active ? "warning" : "success"}
                          >
                            {kra.active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {!filtered.length && (
              <EmptyState
                title="No questions in this department"
                text="Change the filters or use '+ Add Question' to create a new department-wise KRA manually."
              />
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function TemplateView({
  templates,
  kras,
  setShowTemplateModal,
  deleteTemplate,
  setEditingTemplate,
  duplicateTemplate,
  activeCycle,
  onImportTemplates,
}) {
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");

  const departments = ["All", ...new Set(templates.map((t) => t.department).filter(Boolean))];

  const departmentRows = departments.map((item) => {
    const rows = item === "All" ? templates : templates.filter((t) => t.department === item);
    return {
      name: item,
      total: rows.length,
      active: rows.filter((t) => t.status === "Active").length,
      draft: rows.filter((t) => t.status !== "Active").length,
    };
  });

  const filtered = templates.filter((template) => {
    const term = search.toLowerCase().trim();
    return (
      (!term ||
        [template.name, template.department, template.financialYear, template.description]
          .join(" ")
          .toLowerCase()
          .includes(term)) &&
      (department === "All" || template.department === department) &&
      (status === "All" || template.status === status)
    );
  });

  function exportTemplates() {
    const headers = [
      "Template ID",
      "Template Name",
      "Department",
      "Financial Year",
      "Version",
      "Status",
      "KRA Count",
      "Total Weight",
      "Applicable Designations",
      "KRA Codes",
    ];

    const rows = filtered.map((template) => [
      template.id,
      template.name,
      template.department,
      template.financialYear || activeCycle?.financialYear || "",
      template.version || 1,
      template.status || "Draft",
      template.kraIds?.length || 0,
      template.totalWeight ?? 0,
      (template.designations || []).join("|"),
      (template.kraIds || [])
        .map((id) => kras.find((kra) => kra.id === id)?.code || id)
        .join("|"),
    ]);

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(workbook, sheet, "Templates");
    XLSX.writeFile(workbook, "BAUER_PMS_KRA_Templates.xlsx");
  }

  async function handleTemplateImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const result = await onImportTemplates(file);
      window.alert(
        `${result.imported} template${result.imported === 1 ? "" : "s"} imported successfully${
          result.errors?.length ? `; ${result.errors.length} rows skipped.` : "."
        }`
      );
    } catch (error) {
      window.alert(error.message || "Template import failed.");
    }
  }

  return (
    <section className="pms-template-shell pms-department-templates">
      <div className="pms-module-heading pms-library-heading">
        <div>
          <span className="pms-section-label">KRA TEMPLATES</span>
          <h2>Department Performance Templates</h2>
          <p>
            Build reusable department evaluation forms by selecting approved library questions
            or adding a custom question directly into the template.
          </p>
        </div>

        <div className="pms-module-actions">
          <button className="pms-secondary" onClick={exportTemplates}>↓ Export</button>

          <label className="pms-secondary pms-file-button">
            ↑ Import
            <input type="file" accept=".csv,.xlsx" onChange={handleTemplateImport} />
          </label>

          <button
            className="pms-primary"
            onClick={() => {
              setEditingTemplate(null);
              setShowTemplateModal(true);
            }}
          >
            + Create Template
          </button>
        </div>
      </div>

      <div className="pms-kpi-grid pms-kra-summary pms-kra-summary-compact">
        <Kpi label="Total Templates" value={templates.length} tone="purple" />
        <Kpi label="Published" value={templates.filter((t) => t.status === "Active").length} tone="green" />
        <Kpi label="Draft" value={templates.filter((t) => t.status !== "Active").length} tone="amber" />
        <Kpi label="Departments" value={new Set(templates.map((t) => t.department).filter(Boolean)).size} tone="blue" />
      </div>

      <div className="pms-department-workspace">
        <aside className="pms-department-sidebar">
          <div className="pms-department-sidebar-head">
            <span>DEPARTMENTS</span>
            <strong>{departments.length - 1}</strong>
          </div>

          <div className="pms-department-list">
            {departmentRows.map((item) => (
              <button
                key={item.name}
                className={department === item.name ? "active" : ""}
                onClick={() => setDepartment(item.name)}
              >
                <span className="pms-department-icon">
                  {item.name === "All" ? "◎" : item.name.slice(0, 1).toUpperCase()}
                </span>

                <span className="pms-department-copy">
                  <strong>{item.name === "All" ? "All Departments" : item.name}</strong>
                  <small>{item.active} published · {item.total} total</small>
                </span>

                <b>{item.total}</b>
              </button>
            ))}
          </div>

          <div className="pms-department-sidebar-note">
            <strong>Template rule</strong>
            <span>Only Active templates should be assigned to a PMS cycle.</span>
            <span>Draft templates remain editable until published.</span>
          </div>
        </aside>

        <section className="pms-template-content">
          <div className="pms-kra-content-head">
            <div>
              <span className="pms-section-label">
                {department === "All" ? "ALL TEMPLATES" : department.toUpperCase()}
              </span>
              <h3>
                {department === "All" ? "Department Template Manager" : `${department} — Templates`}
              </h3>
              <p>{filtered.length} template{filtered.length === 1 ? "" : "s"} shown.</p>
            </div>
          </div>

          <div className="pms-kra-filterbar pms-template-filterbar">
            <div className="pms-kra-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search template or department..."
              />
            </div>

            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Active">Published</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div className="pms-template-bank">
            {filtered.map((template) => {
              const selectedKras = (template.kraIds || [])
                .map((id) => kras.find((kra) => kra.id === id))
                .filter(Boolean);

              return (
                <article key={template.id} className="pms-template-bank-row">
                  <div className="pms-template-bank-main">
                    <div className="pms-template-bank-icon">
                      {template.department?.slice(0, 1)?.toUpperCase() || "T"}
                    </div>
                    <div>
                      <div className="pms-template-bank-title">
                        <strong>{template.name}</strong>
                        <span className={`pms-pill ${template.status === "Active" ? "success" : "warning"}`}>
                          {template.status === "Active" ? "Published" : "Draft"}
                        </span>
                      </div>
                      <p>{template.description || "Department performance evaluation template."}</p>
                      <div className="pms-template-meta-line">
                        <span>{template.department}</span>
                        <span>{template.financialYear || activeCycle?.financialYear || "—"}</span>
                        <span>v{template.version || 1}</span>
                        <span>{template.kraIds?.length || 0} KRAs</span>
                      </div>
                    </div>
                  </div>

                  <div className={`pms-weight-status ${(template.totalWeight ?? 0) === 100 ? "good" : "warning"}`}>
                    {template.totalWeight ?? 0}%
                    <small>{(template.totalWeight ?? 0) === 100 ? "Ready" : "Check Weight"}</small>
                  </div>

                  <div className="pms-template-bank-actions">
                    <button onClick={() => { setEditingTemplate(template); setShowTemplateModal(true); }}>
                      Open
                    </button>
                    <button onClick={() => duplicateTemplate(template)}>
                      Duplicate
                    </button>
                    <button className="danger" onClick={() => deleteTemplate(template.id)}>
                      Delete
                    </button>
                  </div>

                  <div className="pms-template-preview-strip">
                    <span className="pms-preview-label">Included questions</span>
                    <div>
                      {selectedKras.slice(0, 5).map((kra) => (
                        <span key={kra.id}>
                          {kra.title}
                          <b>{kra.weight}%</b>
                        </span>
                      ))}
                      {selectedKras.length > 5 && <em>+{selectedKras.length - 5} more</em>}
                      {!selectedKras.length && <em>No KRAs selected yet.</em>}
                    </div>
                  </div>
                </article>
              );
            })}

            {!filtered.length && (
              <EmptyState
                title="No templates found"
                text="Select a department or create a new performance template."
              />
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function AssignmentView({
  assignments,
  employees,
  cycle,
  setShowAssignModal,
  openEmployeeEvaluation,
}) {
  return (
    <section className="pms-card">
      <div className="pms-card-head pms-card-head-actions">
        <CardHead eyebrow="EVALUATION ASSIGNMENT" title="Employee → KRA → Reviewers" />
        <button className="pms-primary" onClick={() => setShowAssignModal(true)}>
          + Assign Evaluation
        </button>
      </div>
      <div className="pms-table-wrap">
        <table className="pms-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Template</th>
              <th>Reviewer 1</th>
              <th>Reviewer 2</th>
              <th>Self</th>
              <th>R1</th>
              <th>R2</th>
              <th>Final</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => {
              const employee = employees.find(
                (item) =>
                  String(item.id ?? item.employeeId ?? item.employeeCode) ===
                  String(assignment.employeeId)
              );
              return (
                <tr key={assignment.id}>
                  <td>
                    <button
                      className="pms-table-link"
                      onClick={() => openEmployeeEvaluation(assignment.employeeId, "self")}
                    >
                      {employeeName(employee)}
                    </button>
                    <small>{employeeCode(employee)}</small>
                  </td>
                  <td>{employeeDepartment(employee)}</td>
                  <td>{assignment.templateName || "Department Template"}</td>
                  <td>{assignment.reviewer1Name || "Not Assigned"}</td>
                  <td>{assignment.reviewer2Name || "Not Assigned"}</td>
                  <td><StatusDot status={assignment.selfStatus} /></td>
                  <td><StatusDot status={assignment.reviewer1Status} /></td>
                  <td><StatusDot status={assignment.reviewer2Status} /></td>
                  <td>{assignment.finalScore ? `${assignment.finalScore}/5` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!assignments.length && (
        <EmptyState
          title="No evaluation assignments"
          text={`No employees have been assigned to ${cycle?.name || "this PMS cycle"} yet.`}
        />
      )}
    </section>
  );
}

function ReviewCyclesView({ cycles, selectedCycleId, setSelectedCycleId, onCreate }) {
  return (
    <section className="pms-card">
      <div className="pms-card-head pms-card-head-actions">
        <CardHead eyebrow="REVIEW CYCLES" title="PMS Review Cycles" />
        <button className="pms-primary" onClick={onCreate}>+ Create Cycle</button>
      </div>
      <div className="pms-cycle-grid">
        {cycles.map((cycle) => (
          <article
            key={cycle.id}
            className={`pms-cycle-card ${cycle.id === selectedCycleId ? "selected" : ""}`}
            onClick={() => setSelectedCycleId(cycle.id)}
          >
            <div className="pms-kra-top">
              <span className="pms-mini-label">{cycle.financialYear}</span>
              <span className={`pms-pill ${cycle.status === "Active" ? "success" : "warning"}`}>
                {cycle.status}
              </span>
            </div>
            <h3>{cycle.name}</h3>
            <div className="pms-cycle-dates">
              <div><small>Eligibility</small><strong>{cycle.eligibilityDate}</strong></div>
              <div><small>Self Review</small><strong>{cycle.selfStart} → {cycle.selfEnd}</strong></div>
              <div><small>Reviewer 1</small><strong>{cycle.reviewer1Start} → {cycle.reviewer1End}</strong></div>
              <div><small>Reviewer 2</small><strong>{cycle.reviewer2Start} → {cycle.reviewer2End}</strong></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TeamPerformanceView({
  assignments,
  employees,
  evaluations,
  openEmployeeEvaluation,
}) {
  return (
    <section className="pms-card">
      <CardHead eyebrow="TEAM PERFORMANCE" title="Employee Performance Comparison" />
      <div className="pms-table-wrap">
        <table className="pms-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Self</th>
              <th>Reviewer 1</th>
              <th>Reviewer 2</th>
              <th>Final</th>
              <th>Band</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => {
              const employee = employees.find(
                (item) =>
                  String(item.id ?? item.employeeId ?? item.employeeCode) ===
                  String(assignment.employeeId)
              );
              return (
                <tr key={assignment.id}>
                  <td>
                    <strong>{employeeName(employee)}</strong>
                    <small>{employeeDepartment(employee)}</small>
                  </td>
                  <td>{assignment.selfScore ? `${assignment.selfScore}/5` : "—"}</td>
                  <td>{assignment.reviewer1Score ? `${assignment.reviewer1Score}/5` : "—"}</td>
                  <td>{assignment.reviewer2Score ? `${assignment.reviewer2Score}/5` : "—"}</td>
                  <td><strong>{assignment.finalScore ? `${assignment.finalScore}/5` : "—"}</strong></td>
                  <td>
                    {assignment.finalBand ? (
                      <span className="pms-pill purple">{assignment.finalBand}</span>
                    ) : (
                      <span className="pms-pill warning">Pending</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="pms-action"
                      onClick={() => openEmployeeEvaluation(assignment.employeeId, "self")}
                    >
                      Compare
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!assignments.length && (
        <EmptyState title="No performance records" text="Assignments and evaluation outcomes will appear here." />
      )}
    </section>
  );
}

function ReportsView({ assignments, employees, evaluations, cycle }) {
  const bands = RATING_SCALE.map((scale) => ({
    ...scale,
    count: assignments.filter(
      (a) => a.finalScore && ratingMeta(a.finalScore).value === scale.value
    ).length,
  }));
  const completed = assignments.filter((a) => a.reviewer2Status === "Submitted").length;
  const avg =
    assignments.filter((a) => a.finalScore).length
      ? (
          assignments
            .filter((a) => a.finalScore)
            .reduce((sum, a) => sum + Number(a.finalScore), 0) /
          assignments.filter((a) => a.finalScore).length
        ).toFixed(2)
      : "—";

  function exportCSV() {
    const rows = [
      ["Employee", "Department", "Self", "Reviewer 1", "Reviewer 2", "Final", "Band"],
      ...assignments.map((assignment) => {
        const employee = employees.find(
          (item) =>
            String(item.id ?? item.employeeId ?? item.employeeCode) ===
            String(assignment.employeeId)
        );
        return [
          employeeName(employee),
          employeeDepartment(employee),
          assignment.selfScore || "",
          assignment.reviewer1Score || "",
          assignment.reviewer2Score || "",
          assignment.finalScore || "",
          assignment.finalBand || "",
        ];
      }),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `PMS_${cycle?.financialYear || "report"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="pms-kpi-grid pms-kpi-4">
        <Kpi label="Employees in Report" value={assignments.length} tone="purple" />
        <Kpi label="Completed" value={completed} tone="green" />
        <Kpi label="Pending" value={Math.max(0, assignments.length - completed)} tone="amber" />
        <Kpi label="Average Rating" value={avg === "—" ? "—" : `${avg}/5`} tone="blue" />
      </section>

      <section className="pms-two-col">
        <section className="pms-card">
          <div className="pms-card-head pms-card-head-actions">
            <CardHead eyebrow="RATING DISTRIBUTION" title="Performance Bands" />
            <button className="pms-secondary" onClick={exportCSV}>Export CSV</button>
          </div>
          <div className="pms-distribution">
            {bands.map((band) => (
              <div key={band.value} className="pms-distribution-row">
                <span>{band.value} · {band.label}</span>
                <div className="pms-bar">
                  <i
                    style={{
                      width: `${assignments.length ? (band.count / assignments.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <strong>{band.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="pms-card">
          <CardHead eyebrow="FINAL SCORE" title="Average Performance" />
          <div className="pms-big-score">
            <strong>{avg}</strong>
            <span>/ 5</span>
            {avg !== "—" && (
              <>
                <b>{scoreToPercent(Number(avg))}%</b>
                <small>{ratingMeta(Number(avg)).label}</small>
              </>
            )}
          </div>
        </section>
      </section>
    </>
  );
}

function SettingsView({ settings, onSave }) {
  const [form, setForm] = useState(settings);
  return (
    <section className="pms-card">
      <CardHead eyebrow="PMS SETTINGS" title="Scoring & Workflow Rules" />
      <div className="pms-settings-grid">
        <NumberField label="Employee Self Weight %" value={form.selfWeight} onChange={(v) => setForm({ ...form, selfWeight: v })} />
        <NumberField label="Reviewer 1 Weight %" value={form.reviewer1Weight} onChange={(v) => setForm({ ...form, reviewer1Weight: v })} />
        <NumberField label="Reviewer 2 Weight %" value={form.reviewer2Weight} onChange={(v) => setForm({ ...form, reviewer2Weight: v })} />
        <NumberField label="Yes Rating" value={form.yesNoYesRating} onChange={(v) => setForm({ ...form, yesNoYesRating: v })} />
        <NumberField label="No Rating" value={form.yesNoNoRating} onChange={(v) => setForm({ ...form, yesNoNoRating: v })} />
      </div>
      <div className="pms-setting-note">
        <strong>Default final score:</strong> weighted average of Self, Reviewer 1 and Reviewer 2.
      </div>
      <div className="pms-form-actions">
        <button className="pms-primary" onClick={() => onSave(form)}>Save Settings</button>
      </div>
    </section>
  );
}

function MyPerformanceView({
  employee,
  assignment,
  selfEvaluation,
  cycle,
  kras,
  openEmployeeEvaluation,
}) {
  return (
    <>
      <section className="pms-profile-banner">
        <div className="pms-profile-avatar">
          {employeeName(employee).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <span>MY PERFORMANCE</span>
          <h2>{employeeName(employee)}</h2>
          <p>{employeeDepartment(employee)} · {employee?.designation || "Employee"}</p>
        </div>
        <div className="pms-profile-score">
          <small>Final Score</small>
          <strong>{assignment?.finalScore ? `${assignment.finalScore}/5` : "—"}</strong>
          {assignment?.finalScore && <span>{ratingMeta(assignment.finalScore).label}</span>}
        </div>
      </section>

      <section className="pms-kpi-grid pms-kpi-4">
        <Kpi label="KRAs Assigned" value={assignment?.kraIds?.length || 0} tone="purple" />
        <Kpi label="Self Score" value={assignment?.selfScore ? `${assignment.selfScore}/5` : "—"} tone="blue" />
        <Kpi label="Reviewer 1" value={assignment?.reviewer1Score ? `${assignment.reviewer1Score}/5` : "Pending"} tone="amber" />
        <Kpi label="Reviewer 2" value={assignment?.reviewer2Score ? `${assignment.reviewer2Score}/5` : "Pending"} tone="green" />
      </section>

      <section className="pms-card">
        <CardHead eyebrow="SELF EVALUATION" title={selfEvaluation ? "Evaluation Submitted" : "Your Evaluation is Ready"} />
        {!selfEvaluation ? (
          <div className="pms-start-eval">
            <div>
              <strong>{assignment?.kraIds?.length || 0} KRAs</strong>
              <span>All mandatory questions must be completed before submission.</span>
            </div>
            <button
              className="pms-primary"
              onClick={() =>
                openEmployeeEvaluation(
                  employee?.id ?? employee?.employeeId ?? employee?.employeeCode,
                  "self"
                )
              }
              disabled={!assignment}
            >
              Start Evaluation →
            </button>
          </div>
        ) : (
          <div className="pms-score-banner success">
            <div>
              <small>Your Self Evaluation Score</small>
              <strong>{selfEvaluation.score}/5</strong>
              <span>{selfEvaluation.percent}% · {selfEvaluation.rating?.label}</span>
            </div>
            <span className="pms-pill success">Submitted</span>
          </div>
        )}
      </section>

      <section className="pms-card">
        <CardHead eyebrow="KRA SNAPSHOT" title="Assigned Performance Areas" />
        <div className="pms-simple-list">
          {(assignment?.kraIds || []).map((id) => {
            const kra = kras.find((item) => item.id === id);
            return kra ? (
              <div key={id}>
                <div>
                  <strong>{kra.title}</strong>
                  <small>{kra.department} · {kra.type}</small>
                </div>
                <span>{kra.weight}%</span>
              </div>
            ) : null;
          })}
        </div>
      </section>
      <div className="pms-cycle-note">
        <strong>Cycle:</strong> {cycle?.name || "—"} · Self evaluation window {cycle?.selfStart || "—"} to {cycle?.selfEnd || "—"}
      </div>
    </>
  );
}

function EvaluationView({
  title,
  employee,
  assignment,
  cycle,
  kras,
  existing,
  evaluationRole,
  onSave,
}) {
  const applicableKras = (assignment?.kraIds || [])
    .map((id) => kras.find((kra) => kra.id === id))
    .filter(Boolean);

  const [answers, setAnswers] = useState(
    existing?.answers || {}
  );
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(existing?.comments || "");

  useEffect(() => {
    setAnswers(existing?.answers || {});
    setNotes(existing?.comments || "");
    setError("");
  }, [existing]);

  function setAnswer(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setError("");
  }

  function computeQuestionRating(kra, value) {
    if (kra.type === "MCQ") {
      const index = kra.options?.indexOf(value);
      if (index < 0) return 0;
      return [5, 4, 3, 2, 1][index] || 1;
    }
    if (kra.type === "Yes / No") {
      return value === "Yes" ? 5 : 1;
    }
    if (kra.type === "Target Based") {
      return evaluateTarget(value.actual, kra.target, kra.higherIsBetter !== false);
    }
    return 0;
  }

  function submit() {
    const missing = applicableKras.filter((kra) => {
      if (kra.type === "Target Based") {
        return !answers[kra.id]?.actual && answers[kra.id]?.actual !== 0;
      }
      return !answers[kra.id];
    });

    if (missing.length) {
      setError(
        `Evaluation incomplete. ${missing.length} mandatory ${
          missing.length === 1 ? "response is" : "responses are"
        } missing.`
      );
      return;
    }

    let totalWeighted = 0;
    let totalWeight = 0;
    const normalizedAnswers = {};

    applicableKras.forEach((kra) => {
      const raw = answers[kra.id];
      const questionScore = computeQuestionRating(kra, raw);
      normalizedAnswers[kra.id] = {
        value: raw,
        score: questionScore,
      };
      totalWeighted += questionScore * Number(assignment?.kraWeights?.[kra.id] ?? kra.weight ?? 0);
      totalWeight += Number(assignment?.kraWeights?.[kra.id] ?? kra.weight ?? 0);
    });

    const score = totalWeight
      ? Number((totalWeighted / totalWeight).toFixed(2))
      : 0;

    onSave({
      employeeId: employee.id ?? employee.employeeId ?? employee.employeeCode,
      role: evaluationRole,
      answers: normalizedAnswers,
      score,
      comments: notes,
    });
  }

  if (!assignment) {
    return (
      <section className="pms-card">
        <EmptyState
          title="PMS evaluation is not assigned yet"
          text="Your HR/Admin team needs to complete eligibility and KRA assignment first."
        />
      </section>
    );
  }

  return (
    <section className="pms-card pms-evaluation-page">
      <div className="pms-eval-head">
        <div>
          <span>PERFORMANCE EVALUATION</span>
          <h2>{title}</h2>
          <p>
            {employeeName(employee)} · {employeeDepartment(employee)} ·{" "}
            {cycle?.financialYear}
          </p>
        </div>
        <div className="pms-eval-progress">
          <small>Questions</small>
          <strong>
            {Object.keys(answers).length}/{applicableKras.length}
          </strong>
        </div>
      </div>

      {evaluationRole !== "self" && existing && (
        <div className="pms-comparison-strip">
          <div><small>Employee Self</small><strong>{existing.score}/5</strong></div>
          <div><small>Reviewer 1</small><strong>{assignment.reviewer1Score || "—"}/5</strong></div>
          <div><small>Reviewer 2</small><strong>{assignment.reviewer2Score || "—"}/5</strong></div>
        </div>
      )}

      {error && <div className="pms-validation-error">{error}</div>}

      <div className="pms-question-list">
        {applicableKras.map((kra, index) => (
          <div key={kra.id} className="pms-question-card">
            <div className="pms-question-head">
              <div>
                <span>QUESTION {String(index + 1).padStart(2, "0")}</span>
                <h3>{kra.title}</h3>
                <p>{kra.description}</p>
              </div>
              <div className="pms-question-weight">{kra.weight}%</div>
            </div>

            {kra.type === "MCQ" && (
              <div className="pms-answer-options">
                {kra.options?.map((option, index) => (
                  <label
                    key={option}
                    className={
                      answers[kra.id] === option ? "selected" : ""
                    }
                  >
                    <input
                      type="radio"
                      name={kra.id}
                      checked={answers[kra.id] === option}
                      onChange={() => setAnswer(kra.id, option)}
                    />
                    <span>{5 - index}</span>
                    <div>
                      <strong>{option}</strong>
                      <small>
                        {RATING_SCALE[index]?.pct}
                      </small>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {kra.type === "Yes / No" && (
              <div className="pms-yesno">
                {["Yes", "No"].map((option) => (
                  <button
                    key={option}
                    className={answers[kra.id] === option ? `selected ${option.toLowerCase()}` : ""}
                    onClick={() => setAnswer(kra.id, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {kra.type === "Target Based" && (
              <div className="pms-target-answer">
                <div>
                  <small>Target</small>
                  <strong>
                    {kra.target}{kra.unit || ""}
                  </strong>
                </div>
                <label>
                  <span>Actual</span>
                  <input
                    type="number"
                    value={answers[kra.id]?.actual ?? ""}
                    onChange={(event) =>
                      setAnswer(kra.id, {
                        actual: event.target.value,
                      })
                    }
                    placeholder="Enter actual"
                  />
                </label>
                <div>
                  <small>Calculated Rating</small>
                  <strong>
                    {answers[kra.id]
                      ? `${computeQuestionRating(kra, answers[kra.id])}/5`
                      : "—"}
                  </strong>
                </div>
              </div>
            )}

            <div className="pms-question-footer">
              <span className="pms-pill info">{kra.type}</span>
              {evaluationRole !== "self" && (
                <span className="pms-review-note">
                  Reviewer may accept or change the employee's submitted rating.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pms-comment-box">
        <label>Overall Comment / Observation</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Add comments, observations or development notes..."
        />
      </div>

      <div className="pms-submit-bar">
        <div>
          <small>Submission will calculate the score immediately.</small>
          <strong>
            Current Score:{" "}
            {applicableKras.length
              ? (() => {
                  let total = 0;
                  let weight = 0;
                  applicableKras.forEach((kra) => {
                    const raw = answers[kra.id];
                    if (!raw && !["Target Based"].includes(kra.type)) return;
                    const s = raw ? computeQuestionRating(kra, raw) : 0;
                    total += s * Number(assignment?.kraWeights?.[kra.id] ?? kra.weight ?? 0);
                    weight += Number(assignment?.kraWeights?.[kra.id] ?? kra.weight ?? 0);
                  });
                  const score = weight ? total / weight : 0;
                  return `${score.toFixed(2)}/5`;
                })()
              : "—"}
          </strong>
        </div>
        <button className="pms-primary" onClick={submit}>
          Submit Evaluation →
        </button>
      </div>
    </section>
  );
}

function TeamEvaluationView({
  role,
  queue,
  onOpen,
  selectedEmployeeForEvaluation,
}) {
  return (
    <section className="pms-card">
      <CardHead
        eyebrow={role === "reviewer2" ? "REVIEWER 2" : "REVIEWER 1"}
        title="Team Evaluation"
      />
      <div className="pms-team-grid">
        {queue.map((row) => (
          <article
            key={row.assignment.id}
            className={`pms-team-card ${String(selectedEmployeeForEvaluation) === String(row.assignment.employeeId) ? "selected" : ""}`}
          >
            <div className="pms-team-avatar">
              {employeeName(row.employee).slice(0, 1).toUpperCase()}
            </div>
            <div className="pms-team-main">
              <strong>{employeeName(row.employee)}</strong>
              <small>{employeeDepartment(row.employee)}</small>
              <div className="pms-team-scores">
                <span>Self {row.assignment.selfScore || "—"}</span>
                {role === "reviewer2" && <span>R1 {row.assignment.reviewer1Score || "—"}</span>}
                <span>Final {row.assignment.finalScore || "—"}</span>
              </div>
            </div>
            <button
              className="pms-primary"
              onClick={() =>
                onOpen(
                  row.assignment.employeeId,
                  role === "reviewer2" ? "reviewer2" : "reviewer1"
                )
              }
            >
              Open Evaluation →
            </button>
          </article>
        ))}
      </div>
      {!queue.length && (
        <EmptyState
          title="No team evaluations pending"
          text="Eligible employees will appear here after HR completes their PMS assignments."
        />
      )}
    </section>
  );
}

function TeamEvaluationModal({
  role,
  employee,
  assignment,
  cycle,
  kras,
  evaluations,
  evaluationRole,
  onClose,
  onSave,
}) {
  const selfEvaluation = evaluations.find(
    (ev) =>
      String(ev.employeeId) ===
        String(employee?.id ?? employee?.employeeId ?? employee?.employeeCode) &&
      ev.role === "self"
  );
  const reviewer1 = evaluations.find(
    (ev) =>
      String(ev.employeeId) ===
        String(employee?.id ?? employee?.employeeId ?? employee?.employeeCode) &&
      ev.role === "reviewer1"
  );
  const current = evaluations.find(
    (ev) =>
      String(ev.employeeId) ===
        String(employee?.id ?? employee?.employeeId ?? employee?.employeeCode) &&
      ev.role === evaluationRole
  );

  const assignedKras = (assignment?.kraIds || [])
    .map((id) => kras.find((kra) => kra.id === id))
    .filter(Boolean);

  const [ratings, setRatings] = useState(
    current?.answers ||
      Object.fromEntries(
        assignedKras.map((kra) => [
          kra.id,
          {
            baseRating:
              selfEvaluation?.answers?.[kra.id]?.score ||
              0,
            rating:
              current?.answers?.[kra.id]?.score ||
              selfEvaluation?.answers?.[kra.id]?.score ||
              0,
          },
        ])
      )
  );
  const [comments, setComments] = useState(current?.comments || "");

  function submit() {
    const answers = {};
    let total = 0;
    let weight = 0;

    for (const kra of assignedKras) {
      const row = ratings[kra.id] || {};
      if (!row.rating) return;
      answers[kra.id] = {
        employeeAnswer: selfEvaluation?.answers?.[kra.id]?.value ?? null,
        employeeScore: selfEvaluation?.answers?.[kra.id]?.score ?? null,
        score: Number(row.rating),
      };
      total += Number(row.rating) * Number(assignment?.kraWeights?.[kra.id] ?? kra.weight ?? 0);
      weight += Number(assignment?.kraWeights?.[kra.id] ?? kra.weight ?? 0);
    }

    const score = weight ? Number((total / weight).toFixed(2)) : 0;

    onSave({
      employeeId:
        employee.id ?? employee.employeeId ?? employee.employeeCode,
      role: evaluationRole,
      answers,
      score,
      comments,
    });

    onClose();
  }

  return (
    <div className="pms-modal-backdrop">
      <div className="pms-modal pms-team-modal">
        <div className="pms-modal-head">
          <div>
            <span>{role === "reviewer2" ? "REVIEWER 2" : "REVIEWER 1"}</span>
            <h2>{employeeName(employee)}</h2>
            <p>{employeeDepartment(employee)} · {cycle?.financialYear}</p>
          </div>
          <button className="pms-close" onClick={onClose}>×</button>
        </div>

        <div className="pms-review-score-strip">
          <div><small>Employee Self</small><strong>{selfEvaluation?.score || "—"}/5</strong></div>
          <div><small>Reviewer 1</small><strong>{reviewer1?.score || "—"}/5</strong></div>
          <div><small>Reviewer 2</small><strong>{assignment?.reviewer2Score || "—"}/5</strong></div>
          <div><small>Final</small><strong>{assignment?.finalScore || "—"}/5</strong></div>
        </div>

        <div className="pms-question-list">
          {assignedKras.map((kra, index) => {
            const selfAnswer = selfEvaluation?.answers?.[kra.id];
            const row = ratings[kra.id] || {};
            return (
              <div key={kra.id} className="pms-review-question">
                <div>
                  <span>QUESTION {String(index + 1).padStart(2, "0")}</span>
                  <h3>{kra.title}</h3>
                  <p>{kra.description}</p>
                </div>

                <div className="pms-review-answer">
                  <div className="pms-review-original">
                    <small>Employee Response</small>
                    <strong>{String(selfAnswer?.value ?? "—")}</strong>
                    <span>{selfAnswer?.score ? `${selfAnswer.score}/5` : "No score"}</span>
                  </div>

                  <div className="pms-review-selector">
                    <small>{role === "reviewer2" ? "Reviewer 2 Rating" : "Reviewer 1 Rating"}</small>
                    <select
                      value={row.rating || ""}
                      onChange={(event) =>
                        setRatings((prev) => ({
                          ...prev,
                          [kra.id]: {
                            ...row,
                            rating: Number(event.target.value),
                          },
                        }))
                      }
                    >
                      <option value="">Select rating</option>
                      {RATING_SCALE.map((rating) => (
                        <option key={rating.value} value={rating.value}>
                          {rating.value} — {rating.label} ({rating.pct})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pms-comment-box">
          <label>Reviewer Comments</label>
          <textarea
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            placeholder="Add observations, justification or development comments..."
          />
        </div>

        <div className="pms-modal-actions">
          <button className="pms-secondary" onClick={onClose}>Cancel</button>
          <button className="pms-primary" onClick={submit}>Submit Review →</button>
        </div>
      </div>
    </div>
  );
}

function FinalResultView({ employee, assignment, evaluations }) {
  const id = employee?.id ?? employee?.employeeId ?? employee?.employeeCode;
  const self = evaluations.find((ev) => String(ev.employeeId) === String(id) && ev.role === "self");
  const r1 = evaluations.find((ev) => String(ev.employeeId) === String(id) && ev.role === "reviewer1");
  const r2 = evaluations.find((ev) => String(ev.employeeId) === String(id) && ev.role === "reviewer2");

  return (
    <section className="pms-card">
      <CardHead eyebrow="FINAL RESULT" title={`${employeeName(employee)} — Performance Result`} />
      <div className="pms-result-hero">
        <div><small>Self Evaluation</small><strong>{self?.score || "—"}/5</strong></div>
        <div><small>Reviewer 1</small><strong>{r1?.score || "—"}/5</strong></div>
        <div><small>Reviewer 2</small><strong>{r2?.score || "—"}/5</strong></div>
        <div className="primary">
          <small>Final Average</small>
          <strong>{assignment?.finalScore || "—"}/5</strong>
          {assignment?.finalScore && (
            <span>
              {scoreToPercent(assignment.finalScore)}% · {assignment.finalBand}
            </span>
          )}
        </div>
      </div>

      <div className="pms-result-note">
        Final result combines Self, Reviewer 1 and Reviewer 2 through the configured PMS scoring weights.
      </div>
    </section>
  );
}

/* ---------- Shared Components ---------- */

function Kpi({ label, value, tone = "blue" }) {
  return (
    <div className={`pms-kpi ${tone}`}>
      <div className="pms-kpi-icon" />
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function CardHead({ eyebrow, title }) {
  return (
    <div className="pms-card-head">
      <div>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function ProgressLine({ label, value, total, tone }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="pms-progress-line">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="pms-progress-track">
        <i className={tone} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AttentionRow({ tone, title, text }) {
  return (
    <div className="pms-attention-row">
      <span className={`pms-attention-icon ${tone}`}>{tone === "danger" ? "!" : tone === "success" ? "✓" : "i"}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

function StatusDot({ status }) {
  const normalized = String(status || "").toLowerCase();
  const ok = normalized === "submitted";
  return (
    <span className={`pms-status-dot ${ok ? "success" : "pending"}`}>
      {ok ? "Complete" : "Pending"}
    </span>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="pms-empty">
      <div className="pms-empty-icon">✦</div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="pms-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

/* ---------- Modals ---------- */

function CycleModal({ cycle, onClose, onSave }) {
  const [form, setForm] = useState(
    cycle || {
      id: makeId("PMS-CYCLE"),
      name: "",
      financialYear: "2026-27",
      startDate: "",
      endDate: "",
      eligibilityDate: "",
      goalStart: "",
      goalEnd: "",
      selfStart: "",
      selfEnd: "",
      reviewer1Start: "",
      reviewer1End: "",
      reviewer2Start: "",
      reviewer2End: "",
      status: "Draft",
    }
  );

  return (
    <div className="pms-modal-backdrop">
      <div className="pms-modal">
        <div className="pms-modal-head">
          <div>
            <span>REVIEW CYCLE</span>
            <h2>Create / Edit PMS Cycle</h2>
            <p>Define the evaluation calendar and eligibility cutoff.</p>
          </div>
          <button className="pms-close" onClick={onClose}>×</button>
        </div>

        <div className="pms-form-grid">
          <Field label="Cycle Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} wide />
          <Field label="Financial Year" value={form.financialYear} onChange={(v) => setForm({ ...form, financialYear: v })} />
          <Field label="Status" type="select" value={form.status} options={["Draft", "Active", "Closed"]} onChange={(v) => setForm({ ...form, status: v })} />
          <Field label="Cycle Start" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
          <Field label="Cycle End" type="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
          <Field label="Eligibility Cutoff" type="date" value={form.eligibilityDate} onChange={(v) => setForm({ ...form, eligibilityDate: v })} />
          <Field label="Goal Setting Start" type="date" value={form.goalStart} onChange={(v) => setForm({ ...form, goalStart: v })} />
          <Field label="Goal Setting End" type="date" value={form.goalEnd} onChange={(v) => setForm({ ...form, goalEnd: v })} />
          <Field label="Self Evaluation Start" type="date" value={form.selfStart} onChange={(v) => setForm({ ...form, selfStart: v })} />
          <Field label="Self Evaluation End" type="date" value={form.selfEnd} onChange={(v) => setForm({ ...form, selfEnd: v })} />
          <Field label="Reviewer 1 Start" type="date" value={form.reviewer1Start} onChange={(v) => setForm({ ...form, reviewer1Start: v })} />
          <Field label="Reviewer 1 End" type="date" value={form.reviewer1End} onChange={(v) => setForm({ ...form, reviewer1End: v })} />
          <Field label="Reviewer 2 Start" type="date" value={form.reviewer2Start} onChange={(v) => setForm({ ...form, reviewer2Start: v })} />
          <Field label="Reviewer 2 End" type="date" value={form.reviewer2End} onChange={(v) => setForm({ ...form, reviewer2End: v })} />
        </div>

        <div className="pms-modal-actions">
          <button className="pms-secondary" onClick={onClose}>Cancel</button>
          <button className="pms-primary" onClick={() => onSave(form)}>Save Cycle</button>
        </div>
      </div>
    </div>
  );
}

function KraModal({ kras, departments, initialKra, onClose, onSave }) {
  const empty = {
    id: makeId("KRA"),
    code: "",
    department: departments[0] || "HR & Admin",
    subDepartment: "",
    category: "Operations",
    title: "",
    description: "",
    type: "MCQ",
    options: RATING_SCALE.map((r) => r.label),
    target: "",
    unit: "%",
    higherIsBetter: true,
    weight: 10,
    mandatory: true,
    active: true,
    evidenceRequired: false,
    employeeComment: "Optional",
    reviewerComment: "Required",
    applicability: "Department",
    applicableDesignations: [],
    version: 1,
  };

  const [form, setForm] = useState(initialKra ? { ...empty, ...initialKra } : empty);
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    setForm(initialKra ? { ...empty, ...initialKra } : empty);
    setActiveStep(1);
  }, [initialKra]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const designations = ["Executive","Assistant Manager","Manager","Senior Manager","Sr. Manager"];
  const totalWeight = kras
    .filter((item) => item.department === form.department && item.id !== form.id)
    .reduce((sum, item) => sum + Number(item.weight || 0), 0);

  function save() {
    if (!form.department || !form.title.trim() || Number(form.weight) <= 0) return;
    onSave(form);
  }

  return (
    <div className="pms-modal-backdrop">
      <div className="pms-modal pms-kra-builder">
        <div className="pms-modal-head">
          <div>
            <span>KRA LIBRARY • {initialKra ? "EDIT" : "MANUAL CREATE"}</span>
            <h2>{initialKra ? "Edit KRA Master" : "Create New KRA"}</h2>
            <p>Create a reusable department-wise KRA with clear evaluation rules.</p>
          </div>
          <button className="pms-close" onClick={onClose}>×</button>
        </div>

        <div className="pms-builder-steps">
          {["Basic Information","Evaluation Definition","Applicability & Rules"].map((label, index) => (
            <button key={label} className={activeStep === index + 1 ? "active" : activeStep > index + 1 ? "done" : ""} onClick={() => setActiveStep(index + 1)}>
              <b>{index + 1}</b><span>{label}</span>
            </button>
          ))}
        </div>

        <div className="pms-builder-body">
          {activeStep === 1 && (
            <div className="pms-builder-grid">
              <Field label="KRA Code" value={form.code} placeholder="Auto generated if blank" onChange={(v) => set({ code: v })} />
              <Field label="Department *" type="select" value={form.department} options={departments.length ? departments : ["HR & Admin"]} onChange={(v) => set({ department: v })} />
              <Field label="Sub Department" value={form.subDepartment} placeholder="Payroll / Recruitment / Projects..." onChange={(v) => set({ subDepartment: v })} />
              <Field label="KRA Category *" type="select" value={form.category} options={["Operations","Quality","Compliance","Customer","People","Financial","Learning & Development","Safety","General"]} onChange={(v) => set({ category: v })} />
              <Field label="KRA Title *" value={form.title} wide placeholder="Example: Payroll Accuracy" onChange={(v) => set({ title: v })} />
              <Field label="Description / Guidance" type="textarea" value={form.description} wide placeholder="Explain what good performance means..." onChange={(v) => set({ description: v })} />
            </div>
          )}

          {activeStep === 2 && (
            <div className="pms-builder-grid">
              <Field label="Evaluation Question *" value={form.title} wide onChange={(v) => set({ title: v })} />
              <div className="pms-type-selector">
                <span className="pms-field-title">Question Type *</span>
                <div className="pms-type-cards">
                  {[
                    ["MCQ","Rating-based multiple choice","Choose 1–5 performance level"],
                    ["Target Based","KPI / target driven","System calculates rating"],
                    ["Yes / No","Binary evaluation","Yes/No mapped to ratings"],
                  ].map(([value, title, text]) => (
                    <button key={value} className={form.type === value ? "selected" : ""} onClick={() => set({ type: value })}>
                      <strong>{title}</strong><small>{text}</small>
                    </button>
                  ))}
                </div>
              </div>

              {form.type === "MCQ" && (
                <div className="pms-builder-full">
                  <div className="pms-field-title-row"><span className="pms-field-title">Response Scale</span><small>5 = Outstanding · 1 = Very Poor</small></div>
                  <div className="pms-scale-editor">
                    {form.options.map((option, index) => (
                      <div key={index}>
                        <b>{5 - index}</b>
                        <input value={option} onChange={(e) => {
                          const options = [...form.options];
                          options[index] = e.target.value;
                          set({ options });
                        }} />
                        <span>{RATING_SCALE[index]?.pct}</span>
                      </div>
                    ))}
                  </div>
                  <button className="pms-secondary pms-small-button" onClick={() => set({ options: [...form.options, "Custom Option"] })}>+ Add Custom Option</button>
                </div>
              )}

              {form.type === "Target Based" && (
                <div className="pms-builder-grid pms-builder-nested">
                  <Field label="KPI / Metric" value={form.title} onChange={(v) => set({ title: v })} />
                  <Field label="Target" type="number" value={form.target} onChange={(v) => set({ target: v })} />
                  <Field label="Unit" value={form.unit} onChange={(v) => set({ unit: v })} />
                  <Field label="Direction" type="select" value={form.higherIsBetter ? "Higher is Better" : "Lower is Better"} options={["Higher is Better","Lower is Better"]} onChange={(v) => set({ higherIsBetter: v === "Higher is Better" })} />
                  <div className="pms-mapping-preview">
                    <span>Rating Mapping</span>
                    <b>5 ≥ 100% · 4 = 90–99% · 3 = 75–89% · 2 = 60–74% · 1 &lt; 60%</b>
                  </div>
                </div>
              )}

              {form.type === "Yes / No" && (
                <div className="pms-yesno-mapping">
                  <div><span>YES</span><strong>Rating 5 — Outstanding</strong><small>Default positive mapping</small></div>
                  <div><span>NO</span><strong>Rating 1 — Very Poor</strong><small>Default negative mapping</small></div>
                </div>
              )}
            </div>
          )}

          {activeStep === 3 && (
            <div className="pms-builder-grid">
              <Field label="Weightage %" type="number" value={form.weight} onChange={(v) => set({ weight: Number(v) })} />
              <Field label="Mandatory" type="select" value={form.mandatory ? "Yes" : "No"} options={["Yes","No"]} onChange={(v) => set({ mandatory: v === "Yes" })} />
              <Field label="Evidence Required" type="select" value={form.evidenceRequired ? "Yes" : "No"} options={["Yes","No"]} onChange={(v) => set({ evidenceRequired: v === "Yes" })} />
              <Field label="Employee Comment" type="select" value={form.employeeComment} options={["Optional","Required","Hidden"]} onChange={(v) => set({ employeeComment: v })} />
              <Field label="Reviewer Comment" type="select" value={form.reviewerComment} options={["Optional","Required","Hidden"]} onChange={(v) => set({ reviewerComment: v })} />

              <div className="pms-builder-full pms-applicability-box">
                <div className="pms-field-title-row"><span className="pms-field-title">Applicability</span><small>Control who receives this KRA.</small></div>
                <div className="pms-choice-row">
                  {["Department","Selected Designations","Selected Employees"].map((option) => (
                    <button key={option} className={form.applicability === option ? "selected" : ""} onClick={() => set({ applicability: option })}>
                      {option}
                    </button>
                  ))}
                </div>
                {form.applicability === "Selected Designations" && (
                  <div className="pms-designation-list">
                    {designations.map((designation) => (
                      <label key={designation}>
                        <input
                          type="checkbox"
                          checked={form.applicableDesignations.includes(designation)}
                          onChange={(e) => set({
                            applicableDesignations: e.target.checked
                              ? [...form.applicableDesignations, designation]
                              : form.applicableDesignations.filter((item) => item !== designation),
                          })}
                        />
                        {designation}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="pms-builder-full pms-kra-rule-summary">
                <div><span>Department KRAs (excluding this KRA)</span><strong>{totalWeight}%</strong></div>
                <div><span>This KRA Weight</span><strong>{Number(form.weight || 0)}%</strong></div>
                <div><span>Reusable Master</span><strong>Yes</strong></div>
              </div>
            </div>
          )}
        </div>

        <div className="pms-modal-actions pms-builder-footer">
          <button className="pms-secondary" onClick={onClose}>Cancel</button>
          <div>
            {activeStep > 1 && <button className="pms-secondary" onClick={() => setActiveStep((v) => v - 1)}>← Back</button>}
            {activeStep < 3 && <button className="pms-secondary" onClick={() => setActiveStep((v) => v + 1)}>Next →</button>}
            {activeStep === 3 && <button className="pms-primary" onClick={save}>Save KRA Master</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateModal({
  kras,
  initialTemplate,
  activeCycle,
  onClose,
  onSave,
  onCreateKra,
}) {
  const departments = [...new Set(kras.map((kra) => kra.department).filter(Boolean))];
  const makeEmptyTemplate = () => ({
    id: makeId("TPL"),
    department: departments[0] || "HR & Admin",
    name: "",
    description: "",
    financialYear: activeCycle?.financialYear || "2026-27",
    status: "Draft",
    version: 1,
    kraIds: [],
    kraWeights: {},
    designations: [],
    ...(initialTemplate || {}),
  });

  const [form, setForm] = useState(makeEmptyTemplate);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setForm(makeEmptyTemplate());
    setSearch("");
    setShowCustomKra(false);
  }, [initialTemplate]);
  const [showCustomKra, setShowCustomKra] = useState(false);
  const [customForm, setCustomForm] = useState({
    id: makeId("KRA"),
    code: "",
    department: form.department,
    category: "General",
    title: "",
    description: "",
    type: "MCQ",
    options: RATING_SCALE.map((r) => r.label),
    weight: 5,
    mandatory: true,
    active: true,
  });

  const departmentKras = kras.filter(
    (kra) =>
      kra.department === form.department &&
      kra.active &&
      (!search ||
        [kra.code, kra.title, kra.category, kra.type]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()))
  );

  const selectedWeight = (form.kraIds || []).reduce(
    (sum, id) => sum + Number(form.kraWeights?.[id] ?? kras.find((kra) => kra.id === id)?.weight ?? 0),
    0
  );

  function toggleKra(id) {
    const exists = form.kraIds.includes(id);
    const kra = kras.find((item) => item.id === id);
    const weight = Number(form.kraWeights?.[id] ?? kra?.weight ?? 0);
    setForm({
      ...form,
      kraIds: exists ? form.kraIds.filter((item) => item !== id) : [...form.kraIds, id],
      kraWeights: {
        ...form.kraWeights,
        ...(exists ? { [id]: undefined } : { [id]: weight }),
      },
    });
  }

  function updateWeight(id, value) {
    setForm({
      ...form,
      kraWeights: { ...form.kraWeights, [id]: Number(value) },
    });
  }

  function addCustomKra() {
    if (!customForm.title.trim() || Number(customForm.weight) <= 0) return;
    const saved = onCreateKra({
      ...customForm,
      id: customForm.id || makeId("KRA"),
      department: form.department,
      code: customForm.code || `KRA-${String(Date.now()).slice(-6)}`,
      active: true,
    });
    setForm((prev) => ({
      ...prev,
      kraIds: [...prev.kraIds, saved.id],
      kraWeights: { ...prev.kraWeights, [saved.id]: Number(saved.weight) },
    }));
    setShowCustomKra(false);
    setCustomForm({
      ...customForm,
      id: makeId("KRA"),
      code: "",
      department: form.department,
      title: "",
    });
  }

  const canSave = form.name.trim() && form.department && selectedWeight === 100;

  return (
    <div className="pms-modal-backdrop">
      <div className="pms-modal pms-template-builder">
        <div className="pms-modal-head">
          <div>
            <span>KRA TEMPLATES • {initialTemplate ? "EDIT" : "CREATE"}</span>
            <h2>{initialTemplate ? "Edit Performance Template" : "Create Department Performance Template"}</h2>
            <p>Build the exact evaluation form employees and reviewers will use for this cycle.</p>
          </div>
          <button className="pms-close" onClick={onClose}>×</button>
        </div>

        <div className="pms-template-meta">
          <Field label="Department *" type="select" value={form.department} options={departments.length ? departments : ["HR & Admin"]} onChange={(v) => setForm({ ...form, department: v, kraIds: [], kraWeights: {} })} />
          <Field label="Template Name *" value={form.name} placeholder="HR & Admin — FY 2026-27" onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Financial Year" value={form.financialYear} onChange={(v) => setForm({ ...form, financialYear: v })} />
          <Field label="Status" type="select" value={form.status} options={["Draft","Active","Archived"]} onChange={(v) => setForm({ ...form, status: v })} />
          <Field label="Description" type="textarea" value={form.description} wide onChange={(v) => setForm({ ...form, description: v })} />
        </div>

        <div className="pms-template-builder-layout">
          <div className="pms-template-library-pane">
            <div className="pms-pane-head">
              <div><span>AVAILABLE KRA LIBRARY</span><strong>{departmentKras.length} KRAs</strong></div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search KRA..." />
            </div>

            <div className="pms-available-kras">
              {departmentKras.map((kra) => {
                const selected = form.kraIds.includes(kra.id);
                return (
                  <button key={kra.id} className={selected ? "selected" : ""} onClick={() => toggleKra(kra.id)}>
                    <span className="pms-check">{selected ? "✓" : ""}</span>
                    <div>
                      <strong>{kra.title}</strong>
                      <small>{kra.code || kra.id} · {kra.type} · {kra.category || "General"}</small>
                    </div>
                    <b>{kra.weight}%</b>
                  </button>
                );
              })}
            </div>

            <button className="pms-custom-kra-button" onClick={() => setShowCustomKra(true)}>
              + Create Custom KRA for this Template
            </button>
          </div>

          <div className="pms-template-selected-pane">
            <div className="pms-pane-head">
              <div><span>SELECTED KRAs</span><strong>{form.kraIds.length} selected</strong></div>
              <span className={`pms-live-weight ${selectedWeight === 100 ? "good" : selectedWeight > 100 ? "bad" : "warn"}`}>
                {selectedWeight}% / 100%
              </span>
            </div>

            <div className="pms-selected-kras">
              {form.kraIds.map((id, index) => {
                const kra = kras.find((item) => item.id === id);
                if (!kra) return null;
                const currentWeight = form.kraWeights?.[id] ?? kra.weight;
                return (
                  <div key={id} className="pms-selected-kra-row">
                    <span className="pms-order-number">{String(index + 1).padStart(2, "0")}</span>
                    <div className="pms-selected-kra-main">
                      <strong>{kra.title}</strong>
                      <small>{kra.type} · {kra.category || "General"}</small>
                    </div>
                    <label>
                      <span>Weight</span>
                      <input type="number" value={currentWeight} onChange={(e) => updateWeight(id, e.target.value)} />
                    </label>
                    <button onClick={() => toggleKra(id)} aria-label={`Remove ${kra.title}`}>×</button>
                  </div>
                );
              })}
            </div>

            <div className={`pms-template-validation ${selectedWeight === 100 ? "valid" : selectedWeight > 100 ? "invalid" : ""}`}>
              {selectedWeight === 100
                ? "✓ Template is ready to publish."
                : selectedWeight > 100
                ? `Weight exceeds 100% by ${selectedWeight - 100}%.`
                : `${100 - selectedWeight}% weight still needs to be assigned.`}
            </div>
          </div>
        </div>

        {showCustomKra && (
          <div className="pms-inline-builder">
            <div className="pms-inline-builder-head">
              <div><span>MANUAL KRA</span><strong>Create custom KRA inside this template</strong></div>
              <button onClick={() => setShowCustomKra(false)}>×</button>
            </div>
            <div className="pms-inline-builder-grid">
              <Field label="KRA Code" value={customForm.code} onChange={(v) => setCustomForm({ ...customForm, code: v })} />
              <Field label="Category" type="select" value={customForm.category} options={["Operations","Quality","Compliance","Customer","People","Financial","General"]} onChange={(v) => setCustomForm({ ...customForm, category: v })} />
              <Field label="Question Type" type="select" value={customForm.type} options={["MCQ","Target Based","Yes / No"]} onChange={(v) => setCustomForm({ ...customForm, type: v })} />
              <Field label="Weight %" type="number" value={customForm.weight} onChange={(v) => setCustomForm({ ...customForm, weight: Number(v) })} />
              <Field label="KRA Title *" value={customForm.title} wide onChange={(v) => setCustomForm({ ...customForm, title: v })} />
              <Field label="Description" type="textarea" value={customForm.description} wide onChange={(v) => setCustomForm({ ...customForm, description: v })} />
            </div>
            <div className="pms-inline-builder-actions">
              <span>Custom KRA can be saved to the central Library and immediately added here.</span>
              <button className="pms-primary" onClick={addCustomKra}>+ Add Custom KRA</button>
            </div>
          </div>
        )}

        <div className="pms-modal-actions pms-builder-footer">
          <button className="pms-secondary" onClick={onClose}>Cancel</button>
          <button className="pms-primary" disabled={!canSave} onClick={() => onSave({
            ...form,
            version: initialTemplate ? (Number(initialTemplate.version || 1) + 1) : 1,
            status: form.status || "Draft",
            kraWeights: form.kraWeights,
            totalWeight: selectedWeight,
          })}>
            {form.status === "Active" ? "Publish Template" : "Save Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignmentModal({ cycle, employees, templates, kras, onClose, onSave }) {
  const [form, setForm] = useState({
    id: makeId("ASG"),
    cycleId: cycle?.id || "",
    employeeId: "",
    department: "",
    templateId: "",
    templateName: "",
    kraIds: [],
    reviewer1Id: "",
    reviewer1Name: "",
    reviewer2Id: "",
    reviewer2Name: "",
  });

  const templateOptions = templates.filter(
    (template) => !form.department || template.department === form.department
  );

  const selectedEmployee = employees.find(
    (employee) =>
      String(employee.id ?? employee.employeeId ?? employee.employeeCode) ===
      String(form.employeeId)
  );

  function updateEmployee(id) {
    const employee = employees.find(
      (item) =>
        String(item.id ?? item.employeeId ?? item.employeeCode) === String(id)
    );
    const department = employeeDepartment(employee);
    const matchingTemplate = templates.find(
      (template) => template.department === department
    );
    setForm({
      ...form,
      employeeId: id,
      department,
      templateId: matchingTemplate?.id || "",
      templateName: matchingTemplate?.name || "",
      kraIds: matchingTemplate?.kraIds || [],
    });
  }

  return (
    <div className="pms-modal-backdrop">
      <div className="pms-modal">
        <div className="pms-modal-head">
          <div>
            <span>EVALUATION ASSIGNMENT</span>
            <h2>Assign PMS Evaluation</h2>
            <p>Map eligible employee → department KRA template → Reviewer 1 → Reviewer 2.</p>
          </div>
          <button className="pms-close" onClick={onClose}>×</button>
        </div>

        <div className="pms-form-grid">
          <Field
            label="Employee"
            type="select"
            value={form.employeeId}
            options={employees.map((employee) => ({
              value: String(employee.id ?? employee.employeeId ?? employee.employeeCode),
              label: `${employeeName(employee)} · ${employeeDepartment(employee)}`,
            }))}
            onChange={updateEmployee}
          />
          <Field
            label="KRA Template"
            type="select"
            value={form.templateId}
            options={templateOptions.map((template) => ({
              value: template.id,
              label: template.name,
            }))}
            onChange={(value) => {
              const template = templates.find((item) => item.id === value);
              setForm({
                ...form,
                templateId: value,
                templateName: template?.name || "",
                kraIds: template?.kraIds || [],
              });
            }}
          />
          <Field
            label="Reviewer 1 / HOD"
            value={form.reviewer1Name}
            onChange={(v) =>
              setForm({ ...form, reviewer1Name: v, reviewer1Id: v })
            }
            placeholder="Enter HOD / Reviewer 1"
          />
          <Field
            label="Reviewer 2 / MD"
            value={form.reviewer2Name}
            onChange={(v) =>
              setForm({ ...form, reviewer2Name: v, reviewer2Id: v })
            }
            placeholder="Enter MD / Reviewer 2"
          />
        </div>

        {selectedEmployee && form.templateId && (
          <div className="pms-assignment-preview">
            <div>
              <small>Employee</small>
              <strong>{employeeName(selectedEmployee)}</strong>
            </div>
            <div>
              <small>Department</small>
              <strong>{form.department}</strong>
            </div>
            <div>
              <small>KRA Count</small>
              <strong>{form.kraIds.length}</strong>
            </div>
          </div>
        )}

        <div className="pms-modal-actions">
          <button className="pms-secondary" onClick={onClose}>Cancel</button>
          <button className="pms-primary" disabled={!form.employeeId || !form.templateId || !form.reviewer1Name || !form.reviewer2Name} onClick={() => onSave(form)}>
            Assign Evaluation
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  options = [],
  wide = false,
  placeholder = "",
}) {
  return (
    <label className={`pms-field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : type === "select" ? (
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select...</option>
          {options.map((option) => {
            const item =
              typeof option === "object"
                ? option
                : { value: option, label: option };
            return (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
