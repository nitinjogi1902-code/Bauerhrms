import { useEffect, useMemo, useRef, useState } from "react";
import "./attendance.css";
import * as XLSX from "xlsx-js-style";
import { supabase } from "./supabaseClient";

const employeesData = [
  {
    id: "EMP001",
    name: "Rahul Kumar",
    designation: "Site Engineer",
    department: "Civil",
    site: "Gurgaon HO",
    type: "Third Party",
    doj: "10-Jan-2025",
    status: "Active",
    vendor: "Conzept",
  },
  {
    id: "EMP002",
    name: "Amit Sharma",
    designation: "HR Executive",
    department: "HR",
    site: "Gurgaon HO",
    type: "On-Roll",
    doj: "15-Feb-2024",
    status: "Active",
    vendor: "-",
  },
  {
    id: "EMP003",
    name: "Priya Mehta",
    designation: "Planning Engineer",
    department: "Planning",
    site: "Hibbal Project",
    type: "On-Roll",
    doj: "05-Jun-2024",
    status: "Active",
    vendor: "-",
  },
  {
    id: "EMP004",
    name: "Rajesh Kumar",
    designation: "Supervisor",
    department: "Construction",
    site: "Polavaram COW",
    type: "Third Party",
    doj: "21-Aug-2025",
    status: "Active",
    vendor: "Taurus",
  },
  {
    id: "EMP005",
    name: "Neha Singh",
    designation: "Document Controller",
    department: "Admin",
    site: "Teesta Project",
    type: "Third Party",
    doj: "12-Mar-2025",
    status: "Active",
    vendor: "Conzept",
  },
  {
    id: "EMP006",
    name: "Vikas Verma",
    designation: "Project Engineer",
    department: "Civil",
    site: "Hibbal Project",
    type: "Third Party",
    doj: "18-Sep-2024",
    status: "Inactive",
    vendor: "Taurus",
  },
];
const STORAGE_KEY = "bauerHrmsEmployees";

const getAttendanceEmployeeCode = (employee) =>
  employee?.employeeId ||
  employee?.employeeCode ||
  employee?.empCode ||
  employee?.employee_id ||
  "";
const ORGANIZATION_STORAGE_KEY = "bauerHrmsOrganizationMasters";

const normalizePolicyValue = (value) =>
  String(value || "").trim().toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ");

const loadWeekOffPoliciesFromStorage = () => {
  try {
    const saved = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed?.weekOffPolicies) ? parsed.weekOffPolicies : [];
  } catch {
    return [];
  }
};

const employeeMatchesWeekOffPolicy = (employee, policy) => {
  if (!employee || !policy || policy.active !== true) return false;
  const assignmentType = String(policy.assignmentType || "All Employees");
  if (assignmentType === "All Employees") return true;
  const assignment = normalizePolicyValue(policy.assignmentValue);
  if (!assignment) return false;
  if (assignmentType === "Vendor") {
    return normalizePolicyValue(employee.vendor) === assignment;
  }
  if (assignmentType === "Employee Group") {
    const values = [employee.employeeGroup, employee.employeeGroupName, employee.group, employee.type]
      .map(normalizePolicyValue)
      .filter(Boolean);
    const aliases = new Set(values);
    if (aliases.has("on-roll")) aliases.add("staff");
    if (aliases.has("third party")) aliases.add("third party associates");
    return aliases.has(assignment);
  }
  return false;
};

const getWeekOffPolicyForDate = (employee, dateKey, policies) => {
  if (!employee || !dateKey || !Array.isArray(policies) || policies.length === 0) return null;
  const applicable = policies.filter((policy) => {
    if (!employeeMatchesWeekOffPolicy(employee, policy)) return false;
    if (policy.effectiveFrom && dateKey < String(policy.effectiveFrom)) return false;
    return Boolean(policy.saturday || policy.sunday);
  });
  if (!applicable.length) return null;
  applicable.sort((a, b) => {
    const priority = (p) => p.assignmentType === "Vendor" ? 3 : p.assignmentType === "Employee Group" ? 2 : 1;
    return (priority(b) - priority(a)) || String(b.effectiveFrom || "").localeCompare(String(a.effectiveFrom || ""));
  });
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  const policy = applicable[0];
  if (day === 6 && policy.saturday) return policy;
  if (day === 0 && policy.sunday) return policy;
  return null;
};

const getPolicyAttendanceRecord = (employee, dateKey, attendanceRecords, policies) => {
  const existing = attendanceRecords?.[dateKey]?.[employee?.id] || {};
  const policy = getWeekOffPolicyForDate(employee, dateKey, policies);
  if (!policy) return existing;
  const actualStatus = ["P", "HD", "OD", "WFH", "CO", "HO", "WO"].includes(existing.status);
  if (actualStatus) return existing;
  return {
    ...existing,
    status: "WO",
    source: existing.source || "Policy",
    policyId: policy.id,
    policyName: policy.name,
    auditReason: existing.auditReason || `Week-Off Policy: ${policy.name}`,
  };
};


const FORCE_LEAVE_STORAGE_KEY = "bauerHrmsForceLeaveRecords";

const readForceLeaveRecordsForAttendance = () => {
  try {
    const saved = localStorage.getItem(FORCE_LEAVE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read Force Leave records for attendance:", error);
    return [];
  }
};

const getEmployeeIdentityKeys = (employee) =>
  new Set(
    [employee?.id, employee?.employeeId, employee?.employeeCode, employee?.empCode]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
  );

const getForceLeaveForDate = (employee, dateKey) => {
  if (!employee || !dateKey) return null;

  const keys = getEmployeeIdentityKeys(employee);
  const records = readForceLeaveRecordsForAttendance();

  const matches = records.filter((record) => {
    const status = String(record?.status || "").trim().toLowerCase();
    if (status === "cancelled") return false;

    const employeeId = String(record?.employeeId || "").trim().toLowerCase();
    if (!employeeId || !keys.has(employeeId)) return false;

    const start = String(record?.flStartDate || "").trim();
    if (!start || dateKey < start) return false;

    const actualRejoiningDate = String(record?.actualRejoiningDate || "").trim();
    if (actualRejoiningDate && dateKey >= actualRejoiningDate) return false;

    return true;
  });

  if (!matches.length) return null;

  // If overlapping records ever exist, use the most recently created/updated
  // record without deleting or changing any historical Force Leave record.
  return [...matches].sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(
      String(a.updatedAt || a.createdAt || "")
    )
  )[0];
};

const getForceLeaveAttendanceInfo = (employee, dateKey, rawRecord = {}) => {
  const forceLeave = getForceLeaveForDate(employee, dateKey);
  if (!forceLeave) {
    return {
      forceLeave: null,
      inForceLeavePeriod: false,
      conflict: false,
      rawRecord,
      effectiveRecord: rawRecord,
    };
  }

  const rawStatus = String(rawRecord?.status || "").trim().toUpperCase();
  const hasPunch = Boolean(rawRecord?.inTime || rawRecord?.outTime);
  const sourceText = String(rawRecord?.source || "").trim().toLowerCase();
  const hasBiometricEvidence = sourceText.includes("biometric") || sourceText.includes("machine") || sourceText.includes("device");
  const hasExplicitAttendance = Boolean(
    (rawStatus && rawStatus !== "-") ||
    hasPunch ||
    hasBiometricEvidence
  );
  const conflict = hasExplicitAttendance && rawStatus !== "FL";
  const resolution = String(rawRecord?.flConflictResolution || "").trim();

  let effectiveRecord = rawRecord;

  if (!hasExplicitAttendance) {
    effectiveRecord = {
      ...rawRecord,
      status: "FL",
      source: rawRecord?.source || "Force Leave",
      auditReason: rawRecord?.auditReason || `Force Leave: ${forceLeave.forceLeaveId || "FL"}`,
      forceLeaveId: forceLeave.forceLeaveId || "",
      forceLeaveDerived: true,
    };
  } else if (conflict && resolution === "Keep FL") {
    effectiveRecord = {
      ...rawRecord,
      status: "FL",
      forceLeaveEffectiveStatus: true,
    };
  }

  return {
    forceLeave,
    inForceLeavePeriod: true,
    conflict,
    resolution,
    rawRecord,
    effectiveRecord,
  };
};

const ATTENDANCE_STATUS_OPTIONS = [
  { value: "P", label: "Present" },
  { value: "A", label: "Absent" },
  { value: "EL", label: "Earned Leave" },
  { value: "CL", label: "Casual Leave" },
  { value: "SL", label: "Sick Leave" },
  { value: "FL", label: "Floating Leave" },
  { value: "CO", label: "Comp Off (Legacy)" },
  { value: "CO-E", label: "Comp Off Earned" },
  { value: "CO-U", label: "Comp Off Utilisation" },
  { value: "OD", label: "On Duty" },
  { value: "WFH", label: "Work From Home" },
  { value: "WO", label: "Weekly Off" },
  { value: "HO", label: "Holiday" },
  { value: "HD", label: "Half Day" },
];

const getStatusLabel = (value) => {
  if (!value || value === "-") return "Unmarked";
  return ATTENDANCE_STATUS_OPTIONS.find((item) => item.value === value)?.label || value;
};

const isWorkingStatus = (value) => ["P", "HD", "OD", "WFH", "CO"].includes(value);
const isLeaveStatus = (value) => ["EL", "CL", "SL", "FL", "CO"].includes(value);

const calculateHoursFromPunches = (inTime, outTime) => {
  if (!inTime || !outTime) return "";
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  if (![inH, inM, outH, outM].every(Number.isFinite)) return "";
  let minutes = outH * 60 + outM - (inH * 60 + inM);
  if (minutes < 0) minutes += 24 * 60;
  return (minutes / 60).toFixed(2);
};


const isSundayDate = (dateKey) => {
  if (!dateKey) return false;
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  return day === 0;
};

const isCompOffWorkingStatus = (status) =>
  ["P", "OD", "WFH", "HD", "CO-E"].includes(String(status || "").trim().toUpperCase());

const getCompOffTransactionForRecord = (record, dateKey) => {
  const explicit = String(record?.compOffTransaction || "").trim().toUpperCase();
  if (explicit === "CO-E" || explicit === "CO-U") return explicit;

  const status = String(record?.status || "").trim().toUpperCase();
  if (status === "CO-E") return "CO-E";
  if (status === "CO-U" || status === "CO") return "CO-U";

  // Sunday working automatically earns one Comp Off. This does not change
  // the attendance status (P/OD/WFH/HD), so the Sunday itself is counted only once.
  if (isSundayDate(dateKey) && isCompOffWorkingStatus(status)) return "CO-E";
  return "";
};

const getCompOffLedger = (employeeId, beforeDate, attendanceRecords, pendingUpdates = []) => {
  const dates = new Set(Object.keys(attendanceRecords || {}));
  pendingUpdates.forEach((item) => dates.add(item.dateKey));

  let earned = 0;
  let used = 0;
  const transactions = [];
  [...dates].filter((dateKey) => dateKey < beforeDate).sort().forEach((dateKey) => {
    const baseRecord = attendanceRecords?.[dateKey]?.[employeeId] || {};
    const pending = pendingUpdates.find((item) => item.dateKey === dateKey && String(item.employeeId) === String(employeeId));
    const record = pending ? { ...baseRecord, ...pending } : baseRecord;
    const transaction = getCompOffTransactionForRecord(record, dateKey);
    if (transaction === "CO-E") {
      earned += 1;
      transactions.push({ dateKey, type: "CO-E" });
    } else if (transaction === "CO-U") {
      used += 1;
      transactions.push({ dateKey, type: "CO-U" });
    }
  });

  return {
    earned,
    used,
    balance: earned - used,
    transactions,
  };
};

const validateCompOffUpdate = (update, attendanceRecords, pendingUpdates = []) => {
  const status = String(update?.status || "").trim().toUpperCase();
  const dateKey = String(update?.dateKey || "");
  if (!dateKey || !update?.employeeId) return null;

  if (status === "CO-E" && !isSundayDate(dateKey)) {
    return "CO-E (Comp Off Earned) can only be recorded for Sunday working.";
  }

  if (status === "CO-U") {
    if (isSundayDate(dateKey)) {
      return "CO-U (Comp Off Utilisation) should be used on a weekday, not on Sunday.";
    }
    const ledger = getCompOffLedger(update.employeeId, dateKey, attendanceRecords, pendingUpdates);
    if (ledger.balance <= 0) {
      return `No earned Comp Off balance is available as of ${dateKey}. Earn CO-E by Sunday working before using CO-U.`;
    }
  }

  return null;
};

const loadEmployeesFromStorage = () => {
  try {
    const storedEmployees = localStorage.getItem(STORAGE_KEY);

    if (!storedEmployees) {
      return [];
    }

    const parsedEmployees = JSON.parse(storedEmployees);

    if (!Array.isArray(parsedEmployees)) {
      return [];
    }

    return parsedEmployees;
  } catch (error) {
    console.error("Unable to load employees from local storage:", error);
    return [];
  }
};

const employeeFromDbForAttendance = (row) => {
  const metadata =
    row?.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {};

  const employeeGroup =
    row?.employee_group ||
    row?.employeeGroup ||
    metadata.employeeGroup ||
    metadata.employeeGroupName ||
    metadata.group ||
    "";

  const employmentType =
    row?.employment_type ||
    metadata.employmentType ||
    "";

  const vendor =
    row?.vendor ||
    row?.vendor_name ||
    metadata.vendor ||
    metadata.vendorName ||
    "";

  return {
    ...metadata,
    id: row?.id || row?.employee_id || "",
    employeeId: row?.employee_id || metadata.employeeId || "",
    employeeCode: row?.employee_id || metadata.employeeCode || metadata.employeeId || "",
    empCode: row?.employee_id || metadata.empCode || metadata.employeeId || "",
    name: row?.employee_name || metadata.name || "",
    designation: row?.designation || metadata.designation || "",
    department: row?.department || metadata.department || "",
    site: row?.location || metadata.location || metadata.site || "",
    location: row?.location || metadata.location || metadata.site || "",
    type: employeeGroup || employmentType || metadata.type || "",
    employeeGroup,
    employeeGroupName: employeeGroup,
    employmentType,
    vendor,
    doj: row?.date_of_joining || metadata.doj || metadata.dateOfJoining || "",
    dateOfJoining: row?.date_of_joining || metadata.dateOfJoining || metadata.doj || "",
    status: row?.status || metadata.status || "Active",
    organizationId: row?.organization_id || "",
  };
};

function Attendance() {
  const [activeMenu, setActiveMenu] = useState("Dashboard");

  const [employees, setEmployees] = useState(loadEmployeesFromStorage);
  const [employeeLoadError, setEmployeeLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadTenantEmployees = async () => {
      try {
        setEmployeeLoadError("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user?.id) {
          throw new Error("Your HRSYNC session has expired. Please log in again.");
        }

        const { data: membership, error: membershipError } = await supabase
          .from("organization_users")
          .select("id, organization_id, employee_id, status")
          .eq("user_id", user.id)
          .eq("status", "Active")
          .maybeSingle();

        if (membershipError) throw membershipError;
        if (!membership?.organization_id) {
          throw new Error("No active company is linked to your HRSYNC account.");
        }

        const { data: rows, error: employeeQueryError } = await supabase
          .from("employees")
          .select("*")
          .eq("organization_id", membership.organization_id)
          .order("employee_name", { ascending: true });

        if (employeeQueryError) throw employeeQueryError;

        if (!cancelled) {
          const mappedEmployees = (rows || [])
            .map(employeeFromDbForAttendance)
            .filter((employee) => employee.id && employee.employeeId);

          setEmployees(mappedEmployees);
          setEmployeeLoadError("");
        }
      } catch (error) {
        console.error("Unable to load tenant employees for attendance:", error);

        if (!cancelled) {
          const cachedEmployees = loadEmployeesFromStorage();
          setEmployees(cachedEmployees);
          setEmployeeLoadError(
            cachedEmployees.length
              ? "Live Employee Master could not be loaded. Showing cached employee data."
              : error?.message || "Unable to load Employee Master records."
          );
        }
      }
    };

    loadTenantEmployees();

    const refreshEmployeesFromMaster = () => {
      loadTenantEmployees();
    };

    window.addEventListener(
      "bauerHrmsEmployeesUpdated",
      refreshEmployeesFromMaster
    );

    window.addEventListener(
      "storage",
      refreshEmployeesFromMaster
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        "bauerHrmsEmployeesUpdated",
        refreshEmployeesFromMaster
      );
      window.removeEventListener(
        "storage",
        refreshEmployeesFromMaster
      );
    };
  }, []);
  const weekOffPolicies = loadWeekOffPoliciesFromStorage();

  const [search, setSearch] = useState("");
  const [employeeType, setEmployeeType] = useState("All");
  const [status, setStatus] = useState("All");

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // ================= ATTENDANCE =================
  const getCurrentMonthKey = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  };

  const [attendanceMonth, setAttendanceMonth] = useState(getCurrentMonthKey);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [attendanceRecords, setAttendanceRecords] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_attendance");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceSite, setAttendanceSite] = useState("All");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("All");
  const [attendanceView, setAttendanceView] = useState("daily");
  const [monthlyEmployeeSearch, setMonthlyEmployeeSearch] = useState("");
  const [selectedMonthlyEmployeeId, setSelectedMonthlyEmployeeId] = useState("");
  const [showEmployeeMonthly, setShowEmployeeMonthly] = useState(false);
  const [monthlySaveState, setMonthlySaveState] = useState("saved");
  const [monthlyLastSavedAt, setMonthlyLastSavedAt] = useState("");
  const [monthlySubmissionState, setMonthlySubmissionState] = useState("draft");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const monthlyEmployeePickerRef = useRef(null);

  const [attendanceDepartment, setAttendanceDepartment] = useState("All");
  const [attendanceVendor, setAttendanceVendor] = useState("All");
  const [showAttendanceImportChoice, setShowAttendanceImportChoice] = useState(false);
  const [attendanceImportMode, setAttendanceImportMode] = useState("monthly");
  const [showAttendanceImport, setShowAttendanceImport] = useState(false);
  const [flConflictDialog, setFlConflictDialog] = useState(null);
  const [attendanceImportPreview, setAttendanceImportPreview] = useState(null);
  const attendanceImportInputRef = useRef(null);

  // ================= ATTENDANCE REPORTS =================
  const [attendanceReportMonth, setAttendanceReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportSite, setReportSite] = useState("All");
  const [reportDepartment, setReportDepartment] = useState("All");
  const [reportEmployeeType, setReportEmployeeType] = useState("All");
  const [reportVendor, setReportVendor] = useState("All");
  const [showAttendanceReport, setShowAttendanceReport] = useState(false);

const [formStep, setFormStep] = useState(1);

const [newEmployee, setNewEmployee] = useState({
  // Personal Details
  id: "",
  name: "",
  fatherName: "",
  dob: "",
  gender: "",
  mobile: "",
  email: "",
  aadhaar: "",
  pan: "",
  permanentAddress: "",
  currentAddress: "",
  emergencyContact: "",

  // Employment Details
  designation: "",
  department: "",
  grade: "",
  site: "",
  project: "",
  type: "Third Party",
  doj: "",
  reportingManager: "",
  vendor: "",
  contractorId: "",
  status: "Active",

  // Statutory Details
  uan: "",
  pfApplicable: "Yes",
  pfNumber: "",
  esiApplicable: "Yes",
  esiNumber: "",
  ptApplicable: "Yes",
  lwfApplicable: "Yes",

  // Bank & Salary
  bankName: "",
  accountNumber: "",
  ifsc: "",
  accountHolderName: "",
  basicSalary: "",
  grossSalary: "",
  hra: "",
  otherAllowance: "",
  otRate: "",

  // Documents
  photo: "",
  aadhaarDocument: "",
  panDocument: "",
  resume: "",
  qualificationCertificate: "",
  experienceCertificate: "",
  bankProof: "",
  joiningDocuments: "",
  otherDocuments: "",
});
  const menuItems = [
    "Dashboard",
    "Employees",
    "Attendance",
    "Leave",
    "Payroll",
    "Vendors",
    "Sites & Projects",
    "Recruitment",
    "Training",
    "PMS",
    "Reports",
    "Settings",
  ];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
    } catch (error) {
      console.error("Unable to save employees:", error);
    }
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem("hrms_attendance", JSON.stringify(attendanceRecords));
    } catch (error) {
      console.error("Unable to save attendance:", error);
    }
  }, [attendanceRecords]);

  const attendanceSites = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((employee) => String(employee.site || "").trim())
          .filter(Boolean)
      )
    ).sort();
  }, [employees]);

  const currentMonthKey = getCurrentMonthKey();

  // Attendance follows the same India financial-year period as Dashboard:
  // April to the current month. This is fully dynamic and never hard-coded
  // to July/August/etc. Existing attendance records remain untouched.
  const attendanceMonthOptions = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    const options = [];

    for (let year = fyStartYear, month = 4; ; month += 1) {
      if (month > 12) {
        month = 1;
        year += 1;
      }

      const value = `${year}-${String(month).padStart(2, "0")}`;
      const label = new Date(`${value}-01T00:00:00`).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });

      options.push({
        value,
        label: value === currentMonthKey ? `Current Month — ${label}` : label,
      });

      if (year === currentYear && month === currentMonth) break;
    }

    return options.reverse();
  }, [currentMonthKey]);

  const getMonthDateRange = (monthKey) => {
    const [year, month] = String(monthKey).split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      min: `${year}-${String(month).padStart(2, "0")}-01`,
      max: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  };

  const selectedMonthRange = getMonthDateRange(attendanceMonth);
  const todayAttendance = attendanceRecords[attendanceDate] || {};

  const getDisplayedAttendanceRecord = (employee, dateKey = attendanceDate) => {
    const rawRecord = attendanceRecords?.[dateKey]?.[employee?.id] || {};
    const flInfo = getForceLeaveAttendanceInfo(employee, dateKey, rawRecord);
    const policyRecord = getPolicyAttendanceRecord(
      employee,
      dateKey,
      attendanceRecords,
      weekOffPolicies
    );

    // Explicit attendance always wins over the automatic FL display until HR
    // resolves the conflict. The original attendance record is never replaced.
    if (flInfo.conflict) {
      return {
        ...policyRecord,
        ...flInfo.effectiveRecord,
        flConflict: true,
        flConflictResolution: flInfo.resolution || "Pending",
        forceLeaveRecord: flInfo.forceLeave,
      };
    }

    if (flInfo.inForceLeavePeriod) {
      return {
        ...policyRecord,
        ...flInfo.effectiveRecord,
        flConflict: false,
        forceLeaveRecord: flInfo.forceLeave,
      };
    }

    return policyRecord;
  };

  const openForceLeaveConflict = (employee, dateKey = attendanceDate) => {
    const rawRecord = attendanceRecords?.[dateKey]?.[employee?.id] || {};
    const info = getForceLeaveAttendanceInfo(employee, dateKey, rawRecord);
    if (!info.forceLeave || !info.conflict) return;

    setFlConflictDialog({
      employee,
      dateKey,
      rawRecord,
      forceLeave: info.forceLeave,
      resolution: info.resolution || "Pending",
    });
  };

  const resolveForceLeaveConflict = (decision) => {
    if (!flConflictDialog) return;

    const { employee, dateKey } = flConflictDialog;
    const employeeId = employee?.id;
    if (!employeeId) return;

    setAttendanceRecords((previous) => {
      const previousRecord = previous?.[dateKey]?.[employeeId] || {};
      const nextRecord = {
        ...previousRecord,
        flConflictResolution: decision,
        flConflictResolvedAt: new Date().toISOString(),
        flConflictResolvedBy: "HR/Admin",
        auditReason:
          decision === "Keep FL"
            ? "Force Leave conflict reviewed — Force Leave retained; original attendance preserved."
            : "Force Leave conflict reviewed — attendance retained; original Force Leave preserved.",
      };

      return {
        ...previous,
        [dateKey]: {
          ...(previous[dateKey] || {}),
          [employeeId]: nextRecord,
        },
      };
    });

    setFlConflictDialog((previous) =>
      previous ? { ...previous, resolution: decision } : previous
    );
  };

  const updateAttendance = (employeeId, field, value) => {
    if (field === "status") {
      const validation = validateCompOffUpdate(
        { employeeId, dateKey: attendanceDate, status: value },
        attendanceRecords
      );
      if (validation) {
        window.alert(validation);
        return;
      }
    }

    setAttendanceRecords((previous) => {
      const previousRecord = previous[attendanceDate]?.[employeeId] || {};
      const nextRecord = {
        ...previousRecord,
        [field]: value,
        source: "Manual",
        lastUpdatedBy: "HR/Admin",
        lastUpdatedAt: new Date().toISOString(),
      };

      if (field === "status" && String(value).toUpperCase() === "CO-E") {
        nextRecord.compOffTransaction = "CO-E";
        nextRecord.auditReason = "Comp Off Earned — Sunday working";
      } else if (field === "status" && String(value).toUpperCase() === "CO-U") {
        nextRecord.compOffTransaction = "CO-U";
        nextRecord.auditReason = "Comp Off Utilisation";
      } else if (field === "status" && String(value).toUpperCase() === "P" && isSundayDate(attendanceDate)) {
        nextRecord.compOffTransaction = "CO-E";
        nextRecord.auditReason = "Sunday working — Comp Off Earned";
      } else if (field === "status" && previousRecord.compOffTransaction) {
        delete nextRecord.compOffTransaction;
      }

      if (field === "inTime" || field === "outTime") {
        const nextIn = field === "inTime" ? value : previousRecord.inTime;
        const nextOut = field === "outTime" ? value : previousRecord.outTime;
        const calculated = calculateHoursFromPunches(nextIn, nextOut);
        if (calculated !== "") nextRecord.workingHours = calculated;
      }

      if (field === "status" && value !== previousRecord.status) {
        const flInfo = getForceLeaveAttendanceInfo(
          employees.find((item) => item.id === employeeId),
          attendanceDate,
          previousRecord
        );
        if (flInfo.forceLeave && String(value).toUpperCase() !== "FL") {
          nextRecord.flConflictResolution = "Pending";
          nextRecord.flConflictResolvedAt = "";
          nextRecord.flConflictResolvedBy = "";
        } else {
          delete nextRecord.flConflictResolution;
          delete nextRecord.flConflictResolvedAt;
          delete nextRecord.flConflictResolvedBy;
        }
      }

      return {
        ...previous,
        [attendanceDate]: {
          ...(previous[attendanceDate] || {}),
          [employeeId]: nextRecord,
        },
      };
    });
  };

  const markAllAttendance = (statusValue) => {
    setAttendanceRecords((previous) => {
      const day = { ...(previous[attendanceDate] || {}) };
      employees.forEach((employee) => {
        day[employee.id] = {
          ...(day[employee.id] || {}),
          status: statusValue,
        };
      });
      return { ...previous, [attendanceDate]: day };
    });
  };

  const clearAttendanceDay = () => {
    if (!window.confirm(`Clear attendance for ${attendanceDate}?`)) return;
    setAttendanceRecords((previous) => {
      const next = { ...previous };
      delete next[attendanceDate];
      return next;
    });
  };

  const filteredAttendanceEmployees = useMemo(() => {
    const query = attendanceSearch.trim().toLowerCase();
    return employees.filter((employee) => {
      const record = getDisplayedAttendanceRecord(employee);
      const matchesSearch =
        !query ||
        String(getAttendanceEmployeeCode(employee) || "").toLowerCase().includes(query) ||
        String(employee.name || "").toLowerCase().includes(query) ||
        String(employee.designation || "").toLowerCase().includes(query);
      const matchesSite =
        attendanceSite === "All" || String(employee.site || "") === attendanceSite;
      const matchesStatus =
        attendanceStatusFilter === "All" ||
        String(record.status || "-") === attendanceStatusFilter;
      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [employees, attendanceDate, attendanceSearch, attendanceSite, attendanceStatusFilter, attendanceRecords]);

  const attendanceSummary = useMemo(() => {
    const counts = {
      P: 0, A: 0, EL: 0, CL: 0, SL: 0, FL: 0, CO: 0,
      OD: 0, WFH: 0, WO: 0, HO: 0, HD: 0, Unmarked: 0,
    };
    employees.forEach((employee) => {
      const statusValue = todayAttendance[employee.id]?.status || "Unmarked";
      counts[statusValue] = (counts[statusValue] || 0) + 1;
    });
    return counts;
  }, [employees, attendanceDate, attendanceRecords]);


  const monthDays = useMemo(() => {
    const [year, month] = attendanceDate.slice(0, 7).split("-").map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    });
  }, [attendanceDate]);

  const monthlyEmployeeResults = useMemo(() => {
    const query = monthlyEmployeeSearch.trim().toLowerCase();

    return [...employees]
      .filter((employee) => {
        const status = String(employee.status || "Active").trim().toLowerCase();
        return status !== "inactive";
      })
      .filter((employee) => {
        if (!query) return true;

        const employeeCode =
          getAttendanceEmployeeCode(employee) ||
          "";

        return (
          String(employeeCode).toLowerCase().includes(query) ||
          String(employee.name || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const codeA = getAttendanceEmployeeCode(a) || "";
        const codeB = getAttendanceEmployeeCode(b) || "";

        return String(codeA).localeCompare(
          String(codeB),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
      });
  }, [employees, monthlyEmployeeSearch]);

  useEffect(() => {
    if (!selectedMonthlyEmployeeId && monthlyEmployeeResults.length > 0) {
      setSelectedMonthlyEmployeeId(monthlyEmployeeResults[0].id);
    }
  }, [monthlyEmployeeResults, selectedMonthlyEmployeeId]);

  useEffect(() => {
    const handleOutsideEmployeePicker = (event) => {
      if (
        monthlyEmployeePickerRef.current &&
        !monthlyEmployeePickerRef.current.contains(event.target)
      ) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideEmployeePicker);
    return () => {
      document.removeEventListener("mousedown", handleOutsideEmployeePicker);
    };
  }, []);

  useEffect(() => {
    if (!showEmployeeMonthly) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") closeEmployeeMonthlyAttendance();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [showEmployeeMonthly]);

  const selectedMonthlyEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedMonthlyEmployeeId) || null,
    [employees, selectedMonthlyEmployeeId]
  );

  const openEmployeeMonthlyAttendance = (employee) => {
    setSelectedMonthlyEmployeeId(employee.id);
    setMonthlyEmployeeSearch(`${getAttendanceEmployeeCode(employee) || "-"} — ${employee.name}`);
    setMonthlySaveState("saved");
    setMonthlySubmissionState("draft");
    setShowEmployeeMonthly(true);
  };

  const closeEmployeeMonthlyAttendance = () => {
    setShowEmployeeMonthly(false);
  };

  const updateMonthlyAttendance = (dateKey, field, value) => {
    const employeeId = selectedMonthlyEmployeeId;
    if (field === "status") {
      const validation = validateCompOffUpdate(
        { employeeId, dateKey, status: value },
        attendanceRecords
      );
      if (validation) {
        window.alert(validation);
        return;
      }
    }
    setMonthlySaveState("unsaved");
    setMonthlySubmissionState("draft");
    if (!employeeId) return;

    setAttendanceRecords((previous) => {
      const previousRecord = previous[dateKey]?.[employeeId] || {};
      const nextRecord = {
        ...previousRecord,
        [field]: value,
        source: "Manual",
        lastUpdatedBy: "HR/Admin",
        lastUpdatedAt: new Date().toISOString(),
      };

      if (field === "inTime" || field === "outTime") {
        const nextIn = field === "inTime" ? value : previousRecord.inTime;
        const nextOut = field === "outTime" ? value : previousRecord.outTime;
        const calculated = calculateHoursFromPunches(nextIn, nextOut);
        if (calculated !== "") nextRecord.workingHours = calculated;
      }

      if (field === "status") {
        const normalizedStatus = String(value || "").toUpperCase();
        if (normalizedStatus === "CO-E") {
          nextRecord.compOffTransaction = "CO-E";
          nextRecord.auditReason = "Comp Off Earned — Sunday working";
        } else if (normalizedStatus === "CO-U") {
          nextRecord.compOffTransaction = "CO-U";
          nextRecord.auditReason = "Comp Off Utilisation";
        } else if (normalizedStatus === "P" && isSundayDate(dateKey)) {
          nextRecord.compOffTransaction = "CO-E";
          nextRecord.auditReason = "Sunday working — Comp Off Earned";
        } else {
          delete nextRecord.compOffTransaction;
          nextRecord.auditReason = "Manual monthly timesheet update";
        }
      }

      return {
        ...previous,
        [dateKey]: {
          ...(previous[dateKey] || {}),
          [employeeId]: nextRecord,
        },
      };
    });
  };

  const markSelectedEmployeeMonth = (statusValue) => {
    if (!selectedMonthlyEmployeeId) return;
    setMonthlySaveState("unsaved");
    setMonthlySubmissionState("draft");

    setAttendanceRecords((previous) => {
      const next = { ...previous };

      monthDays.forEach((dateKey) => {
        next[dateKey] = {
          ...(next[dateKey] || {}),
          [selectedMonthlyEmployeeId]: {
            ...(next[dateKey]?.[selectedMonthlyEmployeeId] || {}),
            status: statusValue,
            source: "Manual",
            lastUpdatedBy: "HR/Admin",
            lastUpdatedAt: new Date().toISOString(),
            auditReason: `Monthly attendance marked ${statusValue === "P" ? "Present" : statusValue}`,
          },
        };
      });

      return next;
    });
  };

  const clearSelectedEmployeeMonth = () => {
    if (!selectedMonthlyEmployeeId) return;
    setMonthlySaveState("unsaved");
    setMonthlySubmissionState("draft");

    const employeeName = selectedMonthlyEmployee?.name || selectedMonthlyEmployeeId;
    if (!window.confirm(`Clear attendance for ${employeeName} for the selected month?`)) return;

    setAttendanceRecords((previous) => {
      const next = { ...previous };

      monthDays.forEach((dateKey) => {
        if (!next[dateKey]?.[selectedMonthlyEmployeeId]) return;

        const day = { ...next[dateKey] };
        delete day[selectedMonthlyEmployeeId];

        if (Object.keys(day).length === 0) {
          delete next[dateKey];
        } else {
          next[dateKey] = day;
        }
      });

      return next;
    });
  };

  const monthlyTimesheetSummary = useMemo(() => {
    const summary = {
      total: monthDays.length,
      P: 0,
      A: 0,
      leave: 0,
      WFH: 0,
      CO: 0,
      OD: 0,
      WO: 0,
      HO: 0,
      HD: 0,
      unmarked: 0,
      workHours: 0,
      otHours: 0,
    };

    monthDays.forEach((dateKey) => {
      const record = attendanceRecords[dateKey]?.[selectedMonthlyEmployeeId] || {};
      const statusValue = record.status || "Unmarked";

      if (statusValue === "P") summary.P += 1;
      else if (statusValue === "A") summary.A += 1;
      else if (["EL", "CL", "SL", "FL"].includes(statusValue)) summary.leave += 1;
      else if (statusValue === "WFH") summary.WFH += 1;
      else if (["CO", "CO-E", "CO-U"].includes(statusValue)) summary.CO += 1;
      else if (statusValue === "OD") summary.OD += 1;
      else if (statusValue === "WO") summary.WO += 1;
      else if (statusValue === "HO") summary.HO += 1;
      else if (statusValue === "HD") summary.HD += 1;
      else summary.unmarked += 1;

      summary.workHours += Number(record.workingHours || 0) || 0;
      summary.otHours += Number(record.otHours || 0) || 0;
    });

    return summary;
  }, [monthDays, attendanceRecords, selectedMonthlyEmployeeId]);


  const saveMonthlyAttendance = () => {
    if (!selectedMonthlyEmployee) {
      alert("Please select an employee first.");
      return;
    }

    try {
      localStorage.setItem("hrms_attendance", JSON.stringify(attendanceRecords));
      const now = new Date();
      const savedText = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const saveKey = `hrms_attendance_month_meta_${selectedMonthlyEmployee.id}_${attendanceDate.slice(0, 7)}`;
      localStorage.setItem(
        saveKey,
        JSON.stringify({
          employeeId: selectedMonthlyEmployee.id,
          employeeName: selectedMonthlyEmployee.name,
          month: attendanceDate.slice(0, 7),
          status: "Draft Saved",
          savedAt: now.toISOString(),
          savedBy: "HR/Admin",
        })
      );

      setMonthlyLastSavedAt(savedText);
      setMonthlySaveState("saved");
      setMonthlySubmissionState("draft");
    } catch (error) {
      console.error("Unable to save monthly attendance:", error);
      alert("Unable to save attendance. Please try again.");
    }
  };

  const submitMonthlyAttendance = () => {
    if (!selectedMonthlyEmployee) {
      alert("Please select an employee first.");
      return;
    }

    const monthLabel = new Date(`${attendanceDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString(
      "en-IN",
      { month: "long", year: "numeric" }
    );

    if (monthlySaveState !== "saved") {
      saveMonthlyAttendance();
    }

    const confirmed = window.confirm(
      `Submit ${monthLabel} attendance for ${selectedMonthlyEmployee.name}?`
    );

    if (!confirmed) return;

    try {
      const now = new Date();
      const submitKey = `hrms_attendance_month_meta_${selectedMonthlyEmployee.id}_${attendanceDate.slice(0, 7)}`;

      localStorage.setItem(
        submitKey,
        JSON.stringify({
          employeeId: selectedMonthlyEmployee.id,
          employeeName: selectedMonthlyEmployee.name,
          month: attendanceDate.slice(0, 7),
          status: "Submitted",
          submittedAt: now.toISOString(),
          submittedBy: "HR/Admin",
        })
      );

      localStorage.setItem("hrms_attendance", JSON.stringify(attendanceRecords));
      setMonthlyLastSavedAt(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setMonthlySaveState("saved");
      setMonthlySubmissionState("submitted");
    } catch (error) {
      console.error("Unable to submit monthly attendance:", error);
      alert("Unable to submit attendance. Please try again.");
    }
  };

  const exportSelectedMonthlyTimesheet = () => {
    if (!selectedMonthlyEmployee) {
      alert("Please select an employee first.");
      return;
    }

    const rows = monthDays.map((dateKey) => {
      const record = getDisplayedAttendanceRecord(selectedMonthlyEmployee, dateKey);
                            const rawRecord = attendanceRecords?.[dateKey]?.[selectedMonthlyEmployee.id] || {};
                            const flInfo = getForceLeaveAttendanceInfo(selectedMonthlyEmployee, dateKey, rawRecord);
      const date = new Date(`${dateKey}T00:00:00`);

      return {
        Date: dateKey,
        Day: date.toLocaleDateString("en-IN", { weekday: "short" }),
        "Employee Code": selectedMonthlyEmployee.id,
        "Employee Name": selectedMonthlyEmployee.name,
        Designation: selectedMonthlyEmployee.designation || "-",
        Department: selectedMonthlyEmployee.department || "-",
        Site: selectedMonthlyEmployee.site || "-",
        "Employee Type": selectedMonthlyEmployee.type || "-",
        Status: record.status || "",
        "In Time": record.inTime || "",
        "Out Time": record.outTime || "",
        "Working Hours": record.workingHours || "",
        "OT Hours": record.otHours || "",
        Source: record.source || "Manual",
        Remarks: record.remarks || "",
        "Last Updated By": record.lastUpdatedBy || "",
        "Last Updated At": record.lastUpdatedAt || "",
        "Audit Reason": record.auditReason || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Timesheet");

    const safeName = selectedMonthlyEmployee.name.replace(/[^a-z0-9]+/gi, "_");
    const monthLabel = new Date(`${attendanceDate.slice(0, 7)}-01T00:00:00`)
      .toLocaleDateString("en-IN", { month: "short", year: "numeric" })
      .replace(" ", "_");

    XLSX.writeFile(
      workbook,
      `${selectedMonthlyEmployee.id}_${safeName}_${monthLabel}.xlsx`
    );
  };

  const exportAttendanceExcel = () => {
    const rows = employees.map((employee) => {
      const record = getDisplayedAttendanceRecord(employee);
      return {
        Date: attendanceDate,
        "Employee ID": getAttendanceEmployeeCode(employee) || "-",
        "Employee Name": employee.name,
        Designation: employee.designation || "-",
        Department: employee.department || "-",
        Site: employee.site || "-",
        Type: employee.type || "-",
        Status: record.status || "",
        "In Time": record.inTime || "",
        "Out Time": record.outTime || "",
        "Working Hours": record.workingHours || "",
        "OT Hours": record.otHours || "",
        Remarks: record.remarks || "",
        "Attendance Source": record.source || "Manual",
        "Last Updated By": record.lastUpdatedBy || "HR/Admin",
        "Last Updated At": record.lastUpdatedAt || "",
        "Audit Reason": record.auditReason || "",
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `HRMS_Attendance_${attendanceDate}.xlsx`);
  };

  const downloadAttendanceTemplate = () => {
    const [year, month] = attendanceDate.slice(0, 7).split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthLabel = new Date(`${attendanceDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    const employeeHeaders = ["Employee ID", "Employee Name", "Designation", "Department", "Site", "Vendor Name", "DOJ"];
    const dateObjects = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const date = new Date(year, month - 1, dayNumber);
      const dayName = date.toLocaleDateString("en-IN", { weekday: "long" });
      const shortDayName = date.toLocaleDateString("en-IN", { weekday: "short" });
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      return {
        date: `${String(dayNumber).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`,
        dayName,
        shortDayName,
        isWeekend,
        dayIndex: date.getDay(),
      };
    });
    const dateHeaders = dateObjects.map((item) => item.date);
    const dayHeaders = dateObjects.map((item) => item.dayName);
    const headers = [...employeeHeaders, ...dateHeaders];

    const rows = employees.map((employee) => {
      const row = [
        getAttendanceEmployeeCode(employee) || "",
        employee.name || "",
        employee.designation || "",
        employee.department || "",
        employee.site || "",
        employee.vendor || "",
        employee.doj || employee.dateOfJoining || "",
      ];
      dateHeaders.forEach(() => row.push(""));
      return row;
    });

    // Professional first sheet: company identity, purpose, month, status legend,
    // then the date header followed immediately by a weekday reference row.
    const dayReferenceRow = [
      "DAY", "", "", "", "", "", "",
      ...dayHeaders,
    ];

    const aoa = [
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS – MONTHLY ATTENDANCE IMPORT TEMPLATE"],
      ["Attendance Month", monthLabel],
      ["Purpose", "Monthly site attendance upload into HRMS"],
      ["Status Codes", "P = Present | A = Absent | EL = Earned Leave | CL = Casual Leave | SL = Sick Leave | FL = Force Leave | CO = Comp Off | OD = On Duty | WFH = Work From Home | WO = Weekly Off | HO = Holiday"],
      ["Instructions", "Do not modify employee master fields. Enter attendance only in date columns. Use approved status codes only. Keep blank where no attendance update is required. Weekend columns are highlighted for reference; actual WO is controlled by employee Week-Off Policy."],
      headers,
      dayReferenceRow,
      ...rows,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ];
    worksheet["!freeze"] = { xSplit: 7, ySplit: 8 };
    worksheet["!autofilter"] = { ref: `A7:${XLSX.utils.encode_col(headers.length - 1)}${rows.length + 8}` };

    // Day row is informational only; import parser still uses row 7 date headers.
    // Weekend styling requires a style-capable XLSX build (xlsx-js-style).
    dateObjects.forEach((item, index) => {
      const columnIndex = employeeHeaders.length + index;
      const dateCell = XLSX.utils.encode_cell({ r: 6, c: columnIndex });
      const dayCell = XLSX.utils.encode_cell({ r: 7, c: columnIndex });
      const weekendFill = item.dayIndex === 0 ? "FDECEC" : "FFF4D8";
      const weekendFont = item.dayIndex === 0 ? "B42318" : "9A6700";

      if (item.isWeekend) {
        [dateCell, dayCell].forEach((cellAddress) => {
          worksheet[cellAddress] = worksheet[cellAddress] || { t: "s", v: "" };
          worksheet[cellAddress].s = {
            fill: { patternType: "solid", fgColor: { rgb: weekendFill } },
            font: { bold: true, color: { rgb: weekendFont } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "D9E2EC" } },
              bottom: { style: "thin", color: { rgb: "D9E2EC" } },
              left: { style: "thin", color: { rgb: "D9E2EC" } },
              right: { style: "thin", color: { rgb: "D9E2EC" } },
            },
          };
        });
      } else {
        worksheet[dayCell] = worksheet[dayCell] || { t: "s", v: "" };
        worksheet[dayCell].s = {
          font: { bold: true, color: { rgb: "55708D" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
    });

    const headerRow = 6;
    const dayRow = 7;
    for (let columnIndex = 0; columnIndex < employeeHeaders.length; columnIndex += 1) {
      const dayCell = XLSX.utils.encode_cell({ r: dayRow, c: columnIndex });
      worksheet[dayCell] = worksheet[dayCell] || { t: "s", v: "" };
      worksheet[dayCell].s = {
        fill: { patternType: "solid", fgColor: { rgb: "EAF2F8" } },
        font: { bold: true, color: { rgb: "55708D" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
      ...dateHeaders.map(() => ({ wch: 13 })),
    ];
    worksheet["!rows"] = [
      { hpt: 24 },
      { hpt: 24 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 34 },
      { hpt: 34 },
      { hpt: 22 },
      { hpt: 20 },
    ];

    const instructions = XLSX.utils.aoa_to_sheet([
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS – ATTENDANCE IMPORT GUIDELINES"],
      ["Purpose", "Use this workbook to upload monthly site attendance into HRMS."],
      ["Step 1", "Do not change Employee ID, Employee Name, Designation, Department, Site, Vendor Name or DOJ."],
      ["Step 2", "Enter attendance only under the applicable date columns."],
      ["Step 3", "Use only: P, A, EL, CL, SL, FL, CO-E, CO-U, CO, OD, WFH, WO, HO. CO-E = Comp Off Earned; CO-U = Comp Off Utilisation."],
      ["Aliases", "W/O is accepted as WO. HLD or HOLIDAY is accepted as HO."],
      ["Not supported", "HD / Half Day and split values such as P/EL, P/2, EL/P and EL/CL are currently not supported."],
      ["Step 4", "Save the completed workbook and upload it through HRMS → Daily Attendance → Import Attendance."],
      ["Important", "The system validates Employee ID, attendance status and date columns before any attendance record is updated."],
    ]);
    instructions["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];
    instructions["!cols"] = [{ wch: 18 }, { wch: 110 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Import");
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
    XLSX.writeFile(workbook, `HRMS_Attendance_Template_${attendanceDate.slice(0, 7)}.xlsx`);
  };

  const normalizeImportedAttendanceStatus = (value) => {
    const raw = String(value ?? "").trim().toUpperCase();
    if (!raw) return "";
    const aliases = { "W/O": "WO", "W.O": "WO", HLD: "HO", HOLIDAY: "HO" };
    const normalized = aliases[raw] || raw;
    return ATTENDANCE_STATUS_OPTIONS.some((item) => item.value === normalized && normalized !== "HD") ? normalized : null;
  };

  const parseAttendanceImportDate = (header) => {
    const text = String(header ?? "").trim();
    const [year, month] = attendanceDate.slice(0, 7).split("-").map(Number);
    const targetPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const direct = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (direct) {
      const day = Number(direct[1]);
      const m = Number(direct[2]);
      const y = Number(direct[3]);
      const key = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return key.startsWith(targetPrefix) ? key : null;
    }
    const monthName = text.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})(?:[-\s](\d{4}))?$/);
    if (monthName) {
      const day = Number(monthName[1]);
      const monthText = monthName[2].slice(0, 3).toLowerCase();
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const m = months.indexOf(monthText) + 1;
      const y = Number(monthName[3] || year);
      if (m > 0 && y === year && m === month) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    if (/^\d{1,2}$/.test(text)) {
      const day = Number(text);
      if (day >= 1 && day <= new Date(year, month, 0).getDate()) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  };

  const downloadDailyAttendanceTemplate = () => {
    const dateKey = attendanceDate;
    const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const headers = [
      "Employee ID",
      "Employee Name",
      "Designation",
      "Department",
      "Site",
      "Vendor Name",
      "DOJ",
      "Date",
      "Status",
      "In Time",
      "Out Time",
      "Working Hours",
      "OT Hours",
      "Remarks",
    ];

    const rows = employees.map((employee) => [
      getAttendanceEmployeeCode(employee) || employee.id || "",
      employee.name || "",
      employee.designation || "",
      employee.department || "",
      employee.site || "",
      employee.vendor || "",
      employee.doj || employee.dateOfJoining || "",
      dateKey,
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const aoa = [
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS – DAILY ATTENDANCE IMPORT TEMPLATE"],
      ["Attendance Date", dateLabel],
      ["Purpose", "Daily site attendance upload — one Excel file for all employees for one attendance date."],
      ["Instructions", "Do not modify employee master fields. Enter Status / punch / hours data only. Employee ID and Date are validated before import."],
      ["Status Codes", "P = Present | A = Absent | EL = Earned Leave | CL = Casual Leave | SL = Sick Leave | FL = Force Leave | CO = Comp Off | OD = On Duty | WFH = Work From Home | WO = Weekly Off | HO = Holiday"],
      headers,
      ...rows,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ];
    worksheet["!freeze"] = { xSplit: 7, ySplit: 7 };
    worksheet["!autofilter"] = { ref: `A7:${XLSX.utils.encode_col(headers.length - 1)}${rows.length + 7}` };
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 15 }, { wch: 14 }, { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
      { wch: 12 }, { wch: 28 },
    ];

    for (let c = 0; c < headers.length; c += 1) {
      const cell = XLSX.utils.encode_cell({ r: 6, c });
      if (worksheet[cell]) {
        worksheet[cell].s = {
          fill: { patternType: "solid", fgColor: { rgb: "EAF2F8" } },
          font: { bold: true, color: { rgb: "244E73" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "D9E2EC" } },
            bottom: { style: "thin", color: { rgb: "D9E2EC" } },
            left: { style: "thin", color: { rgb: "D9E2EC" } },
            right: { style: "thin", color: { rgb: "D9E2EC" } },
          },
        };
      }
    }

    const instructions = XLSX.utils.aoa_to_sheet([
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS — DAILY ATTENDANCE IMPORT GUIDELINES"],
      ["Step 1", "Use this template when the site sends attendance every day and you want to upload all employees in one go."],
      ["Step 2", "One Excel file represents one attendance date. The Date column must match the selected attendance date."],
      ["Step 3", "Do not change Employee ID / Employee Name / Designation / Department / Site / Vendor Name / DOJ."],
      ["Step 4", "Enter Status and, where available, In Time, Out Time, Working Hours, OT Hours and Remarks."],
      ["Step 5", "Status may be P, A, EL, CL, SL, FL, CO, OD, WFH, WO or HO. If Status is blank but In Time and Out Time are present, HRMS will treat the row as Present."],
      ["Important", "Only the selected date is updated. Existing attendance for other dates is never changed."],
    ]);
    instructions["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];
    instructions["!cols"] = [{ wch: 18 }, { wch: 110 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Attendance");
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
    XLSX.writeFile(workbook, `HRMS_Daily_Attendance_Template_${dateKey}.xlsx`);
  };

  const openAttendanceImport = (mode) => {
    setAttendanceImportMode(mode);
    setShowAttendanceImportChoice(false);
    window.setTimeout(() => attendanceImportInputRef.current?.click(), 0);
  };

  const normalizeDailyHeader = (value) =>
    String(value ?? "").trim().toLowerCase().replace(/[._/()-]+/g, " ").replace(/\s+/g, " ");

  const getDailyImportColumn = (headers, aliases) => {
    const normalizedAliases = new Set(aliases.map(normalizeDailyHeader));
    return headers.find((key) => normalizedAliases.has(normalizeDailyHeader(key))) || "";
  };

  const parseDailyAttendanceDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed?.y && parsed?.m && parsed?.d) {
        return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }
    }

    const text = String(value ?? "").trim();
    if (!text) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const direct = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (direct) {
      return `${direct[3]}-${String(direct[2]).padStart(2, "0")}-${String(direct[1]).padStart(2, "0")}`;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }

    return "";
  };

  const parseDailyAttendanceImport = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array", cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
          if (!matrix.length) throw new Error("Excel file is empty.");

          const headerRowIndex = matrix.findIndex((row) => {
            const headers = row.map(normalizeDailyHeader);
            return headers.some((item) => ["employee id", "employee code", "emp id", "emp code", "employeeid"].includes(item)) &&
              headers.some((item) => ["status", "attendance", "attendance status", "in time", "out time"].includes(item));
          });
          if (headerRowIndex < 0) throw new Error("Daily attendance headers not found. Use the HRMS Daily Attendance Template.");

          const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", range: headerRowIndex, raw: true, cellDates: true });
          const headers = rows.length ? Object.keys(rows[0]) : [];
          const idKey = getDailyImportColumn(headers, ["Employee ID", "Employee Code", "Emp ID", "Emp Code", "EmployeeID"]);
          const dateKeyName = getDailyImportColumn(headers, ["Date", "Attendance Date", "AttendanceDate"]);
          const statusKey = getDailyImportColumn(headers, ["Status", "Attendance", "Attendance Status"]);
          const inKey = getDailyImportColumn(headers, ["In Time", "InTime", "Punch In", "Check In"]);
          const outKey = getDailyImportColumn(headers, ["Out Time", "OutTime", "Punch Out", "Check Out"]);
          const workKey = getDailyImportColumn(headers, ["Working Hours", "Work Hours", "Working Hrs", "Work Hrs"]);
          const otKey = getDailyImportColumn(headers, ["OT Hours", "Overtime Hours", "OT Hrs"]);
          const remarksKey = getDailyImportColumn(headers, ["Remarks", "Remark", "Comments"]);

          if (!idKey) throw new Error("Employee ID column not found. Please use Employee ID or Employee Code.");

          const employeeMap = new Map();
          employees.forEach((employee) => {
            const internalId = String(employee.id || "").trim().toUpperCase();
            const employeeCode = String(getAttendanceEmployeeCode(employee) || "").trim().toUpperCase();
            if (internalId) employeeMap.set(internalId, employee);
            if (employeeCode) employeeMap.set(employeeCode, employee);
          });

          const errors = [];
          const updates = [];
          let populatedCells = 0;
          const targetDate = attendanceDate;

          rows.forEach((row, index) => {
            const excelRow = headerRowIndex + index + 2;
            const employeeId = String(row[idKey] ?? "").trim();
            if (!employeeId) {
              errors.push({ row: excelRow, employeeId: "-", date: targetDate, value: "", message: "Employee ID is blank." });
              return;
            }

            const employee = employeeMap.get(employeeId.toUpperCase());
            if (!employee) {
              errors.push({ row: excelRow, employeeId, date: targetDate, value: "", message: "Employee ID not found in HRMS master." });
              return;
            }

            const rowDate = dateKeyName ? parseDailyAttendanceDate(row[dateKeyName]) : targetDate;
            if (!rowDate) {
              errors.push({ row: excelRow, employeeId, date: "-", value: "", message: "Attendance date is blank or invalid." });
              return;
            }
            if (rowDate !== targetDate) {
              errors.push({ row: excelRow, employeeId, date: rowDate, value: String(row[dateKeyName] ?? ""), message: `Date must match the selected attendance date (${targetDate}).` });
              return;
            }

            const rawStatus = statusKey ? String(row[statusKey] ?? "").trim() : "";
            const inTime = inKey ? String(row[inKey] ?? "").trim() : "";
            const outTime = outKey ? String(row[outKey] ?? "").trim() : "";
            const workingHours = workKey ? String(row[workKey] ?? "").trim() : "";
            const otHours = otKey ? String(row[otKey] ?? "").trim() : "";
            const remarks = remarksKey ? String(row[remarksKey] ?? "").trim() : "";

            const statusValue = rawStatus ? normalizeImportedAttendanceStatus(rawStatus) : ((inTime || outTime) ? "P" : "");
            if (!statusValue) {
              errors.push({ row: excelRow, employeeId, date: rowDate, value: rawStatus || "Blank", message: "Attendance status is required. Use an approved status code, or provide In Time / Out Time so HRMS can mark the row Present." });
              return;
            }

            if (inTime && !/^\d{1,2}:\d{2}$/.test(inTime)) {
              errors.push({ row: excelRow, employeeId, date: rowDate, value: inTime, message: "Invalid In Time. Use HH:MM format." });
              return;
            }
            if (outTime && !/^\d{1,2}:\d{2}$/.test(outTime)) {
              errors.push({ row: excelRow, employeeId, date: rowDate, value: outTime, message: "Invalid Out Time. Use HH:MM format." });
              return;
            }

            populatedCells += 1;
            updates.push({
              dateKey: rowDate,
              employeeId: employee.id,
              status: statusValue,
              inTime,
              outTime,
              workingHours,
              otHours,
              remarks,
              source: "Daily Excel Import",
            });
          });

          const uniqueKeys = new Set();
          const duplicateUpdates = [];
          const uniqueUpdates = updates.filter((item) => {
            const key = `${item.dateKey}__${item.employeeId}`;
            if (uniqueKeys.has(key)) { duplicateUpdates.push(item); return false; }
            uniqueKeys.add(key);
            return true;
          });
          duplicateUpdates.forEach((item) => errors.push({ row: "-", employeeId: item.employeeId, date: item.dateKey, value: item.status, message: "Duplicate employee/date entry." }));

          resolve({
            fileName: file.name,
            importMode: "daily",
            updates: uniqueUpdates,
            errors,
            rows: rows.length,
            populatedCells,
            dateColumns: 1,
            targetDate,
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Unable to read the attendance Excel file."));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleAttendanceImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (attendanceImportMode === "daily") {
      parseDailyAttendanceImport(file)
        .then((preview) => {
          setAttendanceImportPreview(preview);
          setShowAttendanceImport(true);
        })
        .catch((error) => {
          console.error("Unable to import daily attendance:", error);
          alert(error.message || "Unable to read the daily attendance Excel file.");
        })
        .finally(() => {
          event.target.value = "";
        });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
        if (!matrix.length) throw new Error("Excel file is empty.");

        // The official template has a professional title/instruction block above the data header.
        // Locate the actual Employee ID header row so users may upload the template unchanged.
        const headerRowIndex = matrix.findIndex((row) => row.some((cell) => ["employee id", "employee code", "emp id", "emp code", "employeeid"].includes(String(cell).trim().toLowerCase())));
        if (headerRowIndex < 0) throw new Error("Employee ID column not found. Use the official HRMS Attendance Import Template.");

        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", range: headerRowIndex });
        const employeeMap = new Map();
        employees.forEach((employee) => {
          const internalId = String(employee.id || "").trim().toUpperCase();
          const employeeCode = String(getAttendanceEmployeeCode(employee) || "").trim().toUpperCase();
          if (internalId) employeeMap.set(internalId, employee);
          if (employeeCode) employeeMap.set(employeeCode, employee);
        });
        const errors = [];
        const updates = [];
        let populatedCells = 0;
        const firstRow = rows[0];
        const idKey = Object.keys(firstRow).find((key) => ["employee id", "employee code", "emp id", "emp code", "employeeid"].includes(String(key).trim().toLowerCase()));
        if (!idKey) throw new Error("Employee ID column not found. Use Employee ID or Employee Code.");

        const dateColumns = Object.keys(firstRow).map((key) => ({ key, dateKey: parseAttendanceImportDate(key) })).filter((item) => item.dateKey);
        if (!dateColumns.length) throw new Error("No date columns found for the selected month.");

        // The template contains a weekday reference row immediately below the date headers.
        // It is informational and must never be imported as an employee attendance row.
        const weekdayNames = new Set(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]);
        const dataRows = rows.filter((row) => String(row[idKey] || "").trim().toUpperCase() !== "DAY");

        dataRows.forEach((row, rowIndex) => {
          const employeeId = String(row[idKey] || "").trim();
          if (!employeeId) {
            errors.push({ row: rowIndex + headerRowIndex + 2, employeeId: "-", date: "-", value: "", message: "Employee ID is blank." });
            return;
          }
          const employee = employeeMap.get(employeeId.toUpperCase());
          if (!employee) {
            errors.push({ row: rowIndex + headerRowIndex + 2, employeeId, date: "-", value: "", message: "Employee ID not found in HRMS master." });
            return;
          }
          dateColumns.forEach(({ key, dateKey }) => {
            const rawValue = row[key];
            if (String(rawValue ?? "").trim() === "") return;
            populatedCells += 1;
            const statusValue = normalizeImportedAttendanceStatus(rawValue);
            if (!statusValue) {
              errors.push({ row: rowIndex + 2, employeeId, date: dateKey, value: String(rawValue), message: "Invalid attendance status. Use only the approved attendance codes shown in the template. HD / split values are not supported." });
              return;
            }
            updates.push({ dateKey, employeeId: employee.id, status: statusValue, source: "Excel Import" });
          });
        });

        const uniqueKeys = new Set();
        const duplicateUpdates = [];
        const uniqueUpdates = updates.filter((item) => {
          const key = `${item.dateKey}__${item.employeeId}`;
          if (uniqueKeys.has(key)) { duplicateUpdates.push(item); return false; }
          uniqueKeys.add(key); return true;
        });
        duplicateUpdates.forEach((item) => errors.push({ row: "-", employeeId: item.employeeId, date: item.dateKey, value: item.status, message: "Duplicate employee/date entry." }));

        setAttendanceImportPreview({ fileName: file.name, updates: uniqueUpdates, errors, rows: dataRows.length, populatedCells, dateColumns: dateColumns.length });
        setShowAttendanceImport(true);
      } catch (error) {
        console.error("Unable to import attendance:", error);
        alert(error.message || "Unable to read the attendance Excel file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmAttendanceImport = () => {
    if (!attendanceImportPreview?.updates?.length) return;

    const orderedUpdates = [...attendanceImportPreview.updates].sort((a, b) =>
      String(a.dateKey).localeCompare(String(b.dateKey)) || String(a.employeeId).localeCompare(String(b.employeeId))
    );
    const compOffErrors = [];
    const pending = [];
    orderedUpdates.forEach((update) => {
      const validation = validateCompOffUpdate(update, attendanceRecords, pending);
      if (validation) {
        compOffErrors.push({ ...update, message: validation });
        return;
      }
      pending.push(update);
    });

    if (compOffErrors.length) {
      const first = compOffErrors.slice(0, 10).map((item) =>
        `${item.employeeId} · ${item.dateKey}: ${item.message}`
      ).join("\n");
      window.alert(`Comp Off validation failed for ${compOffErrors.length} record(s).\n\n${first}${compOffErrors.length > 10 ? "\n..." : ""}\n\nNo attendance records were imported.`);
      return;
    }

    setAttendanceRecords((previous) => {
      const next = { ...previous };
      attendanceImportPreview.updates.forEach(({ dateKey, employeeId, status, inTime, outTime, workingHours, otHours, remarks }) => {
        const previousRecord = next[dateKey]?.[employeeId] || {};
        next[dateKey] = {
          ...(next[dateKey] || {}),
          [employeeId]: {
            ...previousRecord,
            status,
            ...(String(status).toUpperCase() === "CO-E" ? { compOffTransaction: "CO-E", auditReason: "Comp Off Earned — Sunday working" } : {}),
            ...(String(status).toUpperCase() === "CO-U" ? { compOffTransaction: "CO-U", auditReason: "Comp Off Utilisation" } : {}),
            ...(String(status).toUpperCase() === "P" && isSundayDate(dateKey) ? { compOffTransaction: "CO-E", auditReason: "Sunday working — Comp Off Earned" } : {}),
            ...(attendanceImportPreview.importMode === "daily" ? {
              inTime: inTime || "",
              outTime: outTime || "",
              workingHours: workingHours || "",
              otHours: otHours || "",
              remarks: remarks || "",
            } : {}),
            source: attendanceImportPreview.importMode === "daily" ? "Daily Excel Import" : "Excel Import",
            lastUpdatedBy: "HR/Admin",
            lastUpdatedAt: new Date().toISOString(),
            auditReason: (String(status).toUpperCase() === "CO-E")
              ? "Comp Off Earned — Sunday working"
              : (String(status).toUpperCase() === "CO-U")
                ? "Comp Off Utilisation"
                : (String(status).toUpperCase() === "P" && isSundayDate(dateKey))
                  ? "Sunday working — Comp Off Earned"
                  : (attendanceImportPreview.importMode === "daily" ? "Daily bulk attendance Excel import" : "Bulk attendance Excel import"),
          },
        };
      });
      return next;
    });
    setShowAttendanceImport(false);
    setAttendanceImportPreview(null);
    alert("Attendance imported successfully.");
  };

  const reportMonthDays = useMemo(() => {
    const [year, month] = attendanceReportMonth.split("-").map(Number);
    if (!year || !month) return [];
    const totalDays = new Date(year, month, 0).getDate();
    return Array.from({ length: totalDays }, (_, index) =>
      `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`
    );
  }, [attendanceReportMonth]);

  const attendanceReportEmployees = useMemo(() => employees.filter((employee) => {
    const matchesSite = reportSite === "All" || String(employee.site || "") === reportSite;
    const matchesDepartment = reportDepartment === "All" || String(employee.department || "") === reportDepartment;
    const matchesVendor = reportVendor === "All" || String(employee.vendor || "") === reportVendor;
    const matchesType = reportEmployeeType === "All" || String(employee.type || "") === reportEmployeeType;
    return matchesSite && matchesDepartment && matchesVendor && matchesType && String(employee.status || "Active").toLowerCase() !== "inactive";
  }), [employees, reportSite, reportDepartment, reportVendor, reportEmployeeType]);

  const getReportRecord = (employee, dateKey) =>
    getPolicyAttendanceRecord(employee, dateKey, attendanceRecords, weekOffPolicies);

  const getReportStatus = (employee, dateKey) => {
    const record = getReportRecord(employee, dateKey);
    if (record?.status) return record.status;
    if (record?.lop === true || record?.payrollStatus === "LOP") return "LOP";
    return "";
  };

  const attendanceReportData = useMemo(() => attendanceReportEmployees.map((employee) => {
    const counts = { P: 0, A: 0, EL: 0, CL: 0, SL: 0, FL: 0, CO: 0, "CO-E": 0, "CO-U": 0, OD: 0, WFH: 0, WO: 0, HO: 0, HD: 0, LOP: 0, unmarked: 0 };
    let workHours = 0;
    let otHours = 0;
    let paidDays = 0;
    let scheduledPayableDays = 0;
    const days = reportMonthDays.map((dateKey) => {
      const record = getReportRecord(employee, dateKey);
      const statusValue = getReportStatus(employee, dateKey);
      if (counts[statusValue] !== undefined) counts[statusValue] += 1;
      else if (!statusValue) counts.unmarked += 1;

      // Payroll rule:
      // An attendance status of A (Absent) is unpaid and therefore counts as LOP.
      // Keep the daily attendance status as "A" for attendance/report readability;
      // LOP is calculated separately as the payroll consequence.
      const isAbsent = statusValue === "A";
      const isExplicitLop =
        record?.lop === true ||
        record?.payrollStatus === "LOP" ||
        statusValue === "LOP";

      if (isAbsent || isExplicitLop) counts.LOP += 1;

      // Paid Days:
      // P, paid leaves, CO, OD, WFH, WO and HO are paid.
      // HD contributes 0.5 day. A/LOP/unmarked do not contribute.
      const paidStatusDays = ["P", "EL", "CL", "SL", "FL", "CO", "CO-E", "CO-U", "OD", "WFH", "WO", "HO"];
      if (paidStatusDays.includes(statusValue)) paidDays += 1;
      else if (statusValue === "HD") paidDays += 0.5;

      // Expected payable days for this employee = calendar days minus
      // scheduled weekly offs. Paid holidays remain payable.
      if (statusValue !== "WO") scheduledPayableDays += 1;

      workHours += Number(record?.workingHours || 0) || 0;
      otHours += Number(record?.otHours || 0) || 0;
      return { dateKey, status: statusValue || "", record };
    });
    // Review rule:
    // WO and HO are paid days, so they are included in Paid Days.
    // Therefore compare Paid Days against the full calendar days in the month.
    // Example: August has 31 days -> Paid Days 30/29/28 needs review.
    const totalCalendarDays = reportMonthDays.length;
    const paidDaysNeedsReview = paidDays < totalCalendarDays;
    return {
      employee,
      days,
      counts,
      paidDays,
      scheduledPayableDays,
      totalCalendarDays,
      paidDaysNeedsReview,
      workHours,
      otHours
    };
  }), [attendanceReportEmployees, reportMonthDays, attendanceRecords, weekOffPolicies.length]);

  const attendanceReportSummary = useMemo(() => {
    const summary = { employees: attendanceReportData.length, P: 0, A: 0, leave: 0, WFH: 0, CO: 0, OD: 0, WO: 0, HO: 0, HD: 0, LOP: 0, paidDays: 0, workHours: 0, otHours: 0 };
    attendanceReportData.forEach((row) => {
      summary.P += row.counts.P; summary.A += row.counts.A;
      summary.leave += row.counts.EL + row.counts.CL + row.counts.SL + row.counts.FL;
      summary.WFH += row.counts.WFH; summary.CO += row.counts.CO; summary.OD += row.counts.OD;
      summary.WO += row.counts.WO; summary.HO += row.counts.HO; summary.HD += row.counts.HD; summary.LOP += row.counts.LOP;
      summary.paidDays += row.paidDays;
      summary.workHours += row.workHours; summary.otHours += row.otHours;
    });
    return summary;
  }, [attendanceReportData]);

  const exportAttendanceReportExcel = () => {
    if (!attendanceReportData.length) {
      alert("No employees found for the selected report filters.");
      return;
    }

    // IMPORTANT:
    // Build the Excel sheet from an explicit column array instead of
    // json_to_sheet(). Numeric-looking keys such as "10"..."31" can otherwise
    // be reordered by JavaScript and appear before employee information.
    const dateColumns = reportMonthDays.map((dateKey) => {
      const date = new Date(`${dateKey}T00:00:00`);
      const dayName = date.toLocaleDateString("en-IN", { weekday: "long" });
      const shortDay = date.toLocaleDateString("en-IN", { weekday: "short" });
      const displayDate = date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return {
        dateKey,
        date,
        shortDay,
        dayName,
        header: `${displayDate}\n${dayName}`,
        shortHeader: `${dateKey.slice(8, 10)}\n${shortDay}`,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      };
    });

    const fixedColumns = [
      "Employee Code",
      "Employee Name",
      "Designation",
      "Department",
      "Site / Project",
      "Vendor Name",
      "DOJ",
    ];

    const statusColumns = [
      "Present",
      "Absent",
      "EL",
      "CL",
      "SL",
      "FL",
      "Comp Off",
      "OD",
      "WFH",
      "Weekly Off",
      "Holiday",
      "Half Day",
      "LOP",
      "Scheduled Payable Days",
      "Paid Days",
      "Paid Days Review",
      "Work Hours",
      "OT Hours",
    ];

    const columns = [
      ...fixedColumns,
      ...dateColumns.map((item) => item.header),
      ...statusColumns,
    ];

    const aoa = [];

    // Professional report heading.
    aoa.push(["BAUER ENGINEERING INDIA PVT. LTD."]);
    aoa.push(["HRMS — MONTHLY ATTENDANCE REPORT"]);
    aoa.push([
      `Attendance Month: ${new Date(`${attendanceReportMonth}-01T00:00:00`).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })}`,
    ]);
    aoa.push([
      `Generated: ${new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`,
    ]);
    aoa.push([]);
    aoa.push(columns);

    attendanceReportData.forEach((row) => {
      const values = [
        getAttendanceEmployeeCode(row.employee) || "-",
        row.employee.name || "-",
        row.employee.designation || "-",
        row.employee.department || "-",
        row.employee.site || "-",
        row.employee.vendor || "-",
        row.employee.doj || "-",
      ];

      row.days.forEach((day) => {
        values.push(day.status || "");
      });

      values.push(
        row.counts.P,
        row.counts.A,
        row.counts.EL,
        row.counts.CL,
        row.counts.SL,
        row.counts.FL,
        row.counts.CO,
        row.counts.OD,
        row.counts.WFH,
        row.counts.WO,
        row.counts.HO,
        row.counts.HD,
        row.counts.LOP,
        Number(row.scheduledPayableDays.toFixed(1)),
        Number(row.paidDays.toFixed(1)),
        row.paidDaysNeedsReview ? "REVIEW REQUIRED" : "OK",
        Number(row.workHours.toFixed(2)),
        Number(row.otHours.toFixed(2))
      );

      aoa.push(values);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Merge report heading across the complete report width.
    const lastCol = columns.length - 1;
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
    ];

    // Freeze employee information + report header.
    ws["!freeze"] = { xSplit: 7, ySplit: 6 };

    // Auto-filter only on the real table header row.
    ws["!autofilter"] = {
      ref: `A6:${XLSX.utils.encode_col(lastCol)}${aoa.length}`,
    };

    // Column widths.
    const widths = [
      { wch: 16 }, // Employee Code
      { wch: 24 }, // Employee Name
      { wch: 24 }, // Designation
      { wch: 18 }, // Department
      { wch: 22 }, // Site
      { wch: 18 }, // Vendor
      { wch: 14 }, // DOJ
    ];

    dateColumns.forEach(() => widths.push({ wch: 12 }));

    statusColumns.forEach((column) => {
      if (column === "Paid Days Review") widths.push({ wch: 18 });
      else if (column === "Scheduled Payable Days") widths.push({ wch: 16 });
      else widths.push({ wch: 12 });
    });

    ws["!cols"] = widths;

    // Row heights.
    ws["!rows"] = [
      { hpt: 25 },
      { hpt: 24 },
      { hpt: 19 },
      { hpt: 18 },
      { hpt: 8 },
      { hpt: 42 },
    ];

    const border = {
      top: { style: "thin", color: { rgb: "D7E3ED" } },
      bottom: { style: "thin", color: { rgb: "D7E3ED" } },
      left: { style: "thin", color: { rgb: "D7E3ED" } },
      right: { style: "thin", color: { rgb: "D7E3ED" } },
    };

    // Heading styles.
    for (let c = 0; c <= lastCol; c += 1) {
      const titleCell = XLSX.utils.encode_cell({ r: 0, c });
      const reportCell = XLSX.utils.encode_cell({ r: 1, c });
      const monthCell = XLSX.utils.encode_cell({ r: 2, c });
      const generatedCell = XLSX.utils.encode_cell({ r: 3, c });

      if (ws[titleCell]) {
        ws[titleCell].s = {
          fill: { fgColor: { rgb: "0F4C81" } },
          font: { color: { rgb: "FFFFFF" }, bold: true, sz: 12 },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }

      if (ws[reportCell]) {
        ws[reportCell].s = {
          fill: { fgColor: { rgb: "0F4C81" } },
          font: { color: { rgb: "FFFFFF" }, bold: true, sz: 15 },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }

      if (ws[monthCell]) {
        ws[monthCell].s = {
          fill: { fgColor: { rgb: "0F4C81" } },
          font: { color: { rgb: "FFFFFF" }, sz: 10 },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }

      if (ws[generatedCell]) {
        ws[generatedCell].s = {
          fill: { fgColor: { rgb: "0F4C81" } },
          font: { color: { rgb: "DDEBFA" }, sz: 9 },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }
    }

    // Header row.
    for (let c = 0; c <= lastCol; c += 1) {
      const cell = XLSX.utils.encode_cell({ r: 5, c });
      if (!ws[cell]) continue;

      const isDateColumn = c >= fixedColumns.length && c < fixedColumns.length + dateColumns.length;
      const weekend = isDateColumn ? dateColumns[c - fixedColumns.length].isWeekend : false;

      ws[cell].s = {
        fill: {
          fgColor: {
            rgb: weekend ? "FFF1D6" : "EAF2F8",
          },
        },
        font: {
          color: {
            rgb: weekend ? "A65B00" : "244E73",
          },
          bold: true,
          sz: 9,
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
          wrapText: true,
        },
        border,
      };
    }

    const statusStyle = {
      P: { bg: "EFFAF3", fg: "087A45" },
      A: { bg: "FFF1F3", fg: "C3313F" },
      EL: { bg: "FFF8EB", fg: "A96608" },
      CL: { bg: "F1F6FF", fg: "2563A8" },
      SL: { bg: "F7F2FF", fg: "7141A8" },
      FL: { bg: "FFF2F8", fg: "B23B72" },
      CO: { bg: "EFFAF8", fg: "08786D" },
      OD: { bg: "F0F8FE", fg: "12679A" },
      WFH: { bg: "EFFBFD", fg: "08758A" },
      WO: { bg: "F5F7F9", fg: "5D6F80" },
      HO: { bg: "EEF1F4", fg: "536474" },
      HD: { bg: "FFF6E8", fg: "9B5D08" },
    };

    const dataStartRow = 6;

    attendanceReportData.forEach((row, rowIndex) => {
      const excelRow = dataStartRow + rowIndex;

      for (let c = 0; c <= lastCol; c += 1) {
        const cell = XLSX.utils.encode_cell({ r: excelRow, c });
        if (!ws[cell]) continue;

        ws[cell].s = {
          border,
          alignment: {
            horizontal: c < fixedColumns.length ? "left" : "center",
            vertical: "center",
            wrapText: false,
          },
          font: {
            color: { rgb: "244E73" },
            sz: 9,
          },
        };
      }

      // Highlight weekends in the attendance cells even when the cell is blank.
      dateColumns.forEach((dateColumn, index) => {
        if (!dateColumn.isWeekend) return;
        const col = fixedColumns.length + index;
        const cell = XLSX.utils.encode_cell({ r: excelRow, c: col });
        if (!ws[cell]) return;

        const currentStyle = ws[cell].s || {};
        ws[cell].s = {
          ...currentStyle,
          fill: { fgColor: { rgb: "FFF8E8" } },
          font: { color: { rgb: "8A6500" }, bold: true, sz: 9 },
          alignment: { horizontal: "center", vertical: "center" },
          border,
        };
      });

      // Apply the exact attendance status colour palette.
      row.days.forEach((day, index) => {
        const col = fixedColumns.length + index;
        const cell = XLSX.utils.encode_cell({ r: excelRow, c: col });
        if (!ws[cell]) return;

        const palette = statusStyle[day.status];
        if (palette) {
          ws[cell].s = {
            fill: { fgColor: { rgb: palette.bg } },
            font: { color: { rgb: palette.fg }, bold: true, sz: 9 },
            alignment: { horizontal: "center", vertical: "center" },
            border,
          };
        }
      });

      // LOP and Paid Days review highlighting.
      const lopCol = fixedColumns.length + dateColumns.length + 12;
      const paidDaysCol = fixedColumns.length + dateColumns.length + 14;
      const reviewCol = fixedColumns.length + dateColumns.length + 15;

      const lopCell = XLSX.utils.encode_cell({ r: excelRow, c: lopCol });
      const paidCell = XLSX.utils.encode_cell({ r: excelRow, c: paidDaysCol });
      const reviewCell = XLSX.utils.encode_cell({ r: excelRow, c: reviewCol });

      if (ws[lopCell] && Number(row.counts.LOP) > 0) {
        ws[lopCell].s = {
          fill: { fgColor: { rgb: "FFF0F0" } },
          font: { color: { rgb: "C62828" }, bold: true, sz: 9 },
          alignment: { horizontal: "center", vertical: "center" },
          border,
        };
      }

      if (ws[paidCell] && row.paidDaysNeedsReview) {
        ws[paidCell].s = {
          fill: { fgColor: { rgb: "FFF0F0" } },
          font: { color: { rgb: "C62828" }, bold: true, sz: 9 },
          alignment: { horizontal: "center", vertical: "center" },
          border,
        };
      }

      if (ws[reviewCell] && row.paidDaysNeedsReview) {
        ws[reviewCell].s = {
          fill: { fgColor: { rgb: "FFF0F0" } },
          font: { color: { rgb: "C62828" }, bold: true, sz: 9 },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border,
        };
      }
    });

    // Summary sheet with the same professional formatting.
    const summaryAoa = [
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS — ATTENDANCE SUMMARY"],
      [`Attendance Month: ${new Date(`${attendanceReportMonth}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`],
      [],
      [
        "Employee Code",
        "Employee Name",
        "Department",
        "Site / Project",
        "Vendor",
        "Present",
        "Absent",
        "Leave",
        "Weekly Off",
        "Holiday",
        "LOP",
        "Scheduled Payable Days",
        "Paid Days",
        "Paid Days Review",
        "Work Hours",
        "OT Hours",
      ],
    ];

    attendanceReportData.forEach((row) => {
      summaryAoa.push([
        getAttendanceEmployeeCode(row.employee) || "-",
        row.employee.name || "-",
        row.employee.department || "-",
        row.employee.site || "-",
        row.employee.vendor || "-",
        row.counts.P,
        row.counts.A,
        row.counts.EL + row.counts.CL + row.counts.SL + row.counts.FL,
        row.counts.WO,
        row.counts.HO,
        row.counts.LOP,
        Number(row.scheduledPayableDays.toFixed(1)),
        Number(row.paidDays.toFixed(1)),
        row.paidDaysNeedsReview ? "REVIEW REQUIRED" : "OK",
        Number(row.workHours.toFixed(2)),
        Number(row.otHours.toFixed(2)),
      ]);
    });

    summaryAoa.push([]);
    summaryAoa.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      attendanceReportSummary.P,
      attendanceReportSummary.A,
      attendanceReportSummary.leave,
      attendanceReportSummary.WO,
      attendanceReportSummary.HO,
      attendanceReportSummary.LOP,
      "",
      Number(attendanceReportSummary.paidDays.toFixed(1)),
      "",
      Number(attendanceReportSummary.workHours.toFixed(2)),
      Number(attendanceReportSummary.otHours.toFixed(2)),
    ]);

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
    const summaryLastCol = 15;

    summaryWs["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: summaryLastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: summaryLastCol } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: summaryLastCol } },
    ];

    summaryWs["!freeze"] = { xSplit: 5, ySplit: 5 };
    summaryWs["!autofilter"] = {
      ref: `A5:${XLSX.utils.encode_col(summaryLastCol)}${5 + attendanceReportData.length}`,
    };
    summaryWs["!cols"] = [
      { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 22 },
      { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
      { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
    ];

    for (let c = 0; c <= summaryLastCol; c += 1) {
      [0, 1, 2].forEach((r) => {
        const cell = XLSX.utils.encode_cell({ r, c });
        if (summaryWs[cell]) {
          summaryWs[cell].s = {
            fill: { fgColor: { rgb: "0F4C81" } },
            font: { color: { rgb: "FFFFFF" }, bold: true, sz: r === 1 ? 14 : 10 },
            alignment: { horizontal: "left", vertical: "center" },
          };
        }
      });

      const headerCell = XLSX.utils.encode_cell({ r: 4, c });
      if (summaryWs[headerCell]) {
        summaryWs[headerCell].s = {
          fill: { fgColor: { rgb: "EAF2F8" } },
          font: { color: { rgb: "244E73" }, bold: true, sz: 9 },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border,
        };
      }
    }

    // Status Legend sheet.
    const legendRows = [
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS — ATTENDANCE REPORT STATUS LEGEND"],
      [],
      ["Code", "Meaning"],
      ["P", "Present"],
      ["A", "Absent / LOP"],
      ["EL", "Earned Leave"],
      ["CL", "Casual Leave"],
      ["SL", "Sick Leave"],
      ["FL", "Floating Leave"],
      ["CO", "Comp Off"],
      ["OD", "On Duty"],
      ["WFH", "Work From Home"],
      ["WO", "Weekly Off"],
      ["HO", "Holiday"],
      ["HD", "Half Day"],
      ["LOP", "Loss of Pay"],
      ["Paid Days Review", "Highlighted when Paid Days are below the calendar days of the selected month."],
    ];

    const legendWs = XLSX.utils.aoa_to_sheet(legendRows);
    legendWs["!cols"] = [{ wch: 22 }, { wch: 72 }];
    legendWs["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];

    for (let c = 0; c < 2; c += 1) {
      [0, 1].forEach((r) => {
        const cell = XLSX.utils.encode_cell({ r, c });
        if (legendWs[cell]) {
          legendWs[cell].s = {
            fill: { fgColor: { rgb: "0F4C81" } },
            font: { color: { rgb: "FFFFFF" }, bold: true, sz: r === 1 ? 14 : 10 },
            alignment: { horizontal: "left", vertical: "center" },
          };
        }
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
    XLSX.utils.book_append_sheet(wb, legendWs, "Status Legend");

    // Always generate a real Excel XLSX workbook.
    XLSX.writeFile(
      wb,
      `HRMS_Monthly_Attendance_Report_${attendanceReportMonth}.xlsx`,
      { bookType: "xlsx" }
    );
  };

  const printAttendanceReportPdf = () => {
    if (!attendanceReportData.length) { alert("No employees found for the selected report filters."); return; }
    setShowAttendanceReport(true);
    setTimeout(() => window.print(), 250);
  };

  const attendanceDepartments = useMemo(() => Array.from(new Set(employees.map((employee) => String(employee.department || "").trim()).filter(Boolean))).sort(), [employees]);
  const attendanceVendors = useMemo(() => Array.from(new Set(employees.map((employee) => String(employee.vendor || "").trim()).filter((vendor) => vendor && vendor !== "-"))).sort(), [employees]);

  const attendanceDashboardEmployees = useMemo(() => employees.filter((employee) => {
    const matchesSite = attendanceSite === "All" || String(employee.site || "") === attendanceSite;
    const matchesDepartment = attendanceDepartment === "All" || String(employee.department || "") === attendanceDepartment;
    const matchesVendor = attendanceVendor === "All" || String(employee.vendor || "") === attendanceVendor;
    const matchesType = employeeType === "All" || employee.type === employeeType;
    return matchesSite && matchesDepartment && matchesVendor && matchesType;
  }), [employees, attendanceSite, attendanceDepartment, attendanceVendor, employeeType]);

  const attendanceDashboardSummary = useMemo(() => {
    const summary = { total: attendanceDashboardEmployees.length, present: 0, absent: 0, leave: 0, wfh: 0, compOff: 0, onDuty: 0, holiday: 0, wo: 0, half: 0, unmarked: 0, late: 0, missingPunch: 0, otHours: 0, workHours: 0 };
    attendanceDashboardEmployees.forEach((employee) => {
      const record = getDisplayedAttendanceRecord(employee);
      const statusValue = record.status || "Unmarked";
      if (statusValue === "P") summary.present += 1;
      else if (statusValue === "A") summary.absent += 1;
      else if (["CL", "SL", "EL", "FL"].includes(statusValue)) summary.leave += 1;
      else if (statusValue === "WFH") summary.wfh += 1;
      else if (statusValue === "CO") summary.compOff += 1;
      else if (statusValue === "OD") summary.onDuty += 1;
      else if (statusValue === "HO") summary.holiday += 1;
      else if (statusValue === "WO") summary.wo += 1;
      else if (statusValue === "HD") summary.half += 1;
      else summary.unmarked += 1;
      if (record.inTime && record.inTime > "09:30") summary.late += 1;
      if ((isWorkingStatus(statusValue)) && (!record.inTime || !record.outTime)) summary.missingPunch += 1;
      summary.otHours += Number(record.otHours || 0) || 0;
      summary.workHours += Number(record.workingHours || 0) || 0;
    });
    return summary;
  }, [attendanceDashboardEmployees, attendanceDate, attendanceRecords]);

  const attendanceSiteStats = useMemo(() => {
    const map = new Map();
    attendanceDashboardEmployees.forEach((employee) => {
      const site = employee.site || "Unassigned";
      if (!map.has(site)) map.set(site, { site, total: 0, present: 0, absent: 0, leave: 0, wo: 0, ot: 0 });
      const item = map.get(site);
      const record = getDisplayedAttendanceRecord(employee);
      item.total += 1;
      if (record.status === "P") item.present += 1;
      if (record.status === "A") item.absent += 1;
      if (["CL", "SL", "EL", "FL"].includes(record.status)) item.leave += 1;
      if (record.status === "WO") item.wo += 1;
      item.ot += Number(record.otHours || 0) || 0;
    });
    return Array.from(map.values()).sort((a,b) => b.total - a.total);
  }, [attendanceDashboardEmployees, attendanceDate, attendanceRecords]);

  const attendanceVendorStats = useMemo(() => {
    const map = new Map();
    attendanceDashboardEmployees.filter((employee) => employee.type === "Third Party").forEach((employee) => {
      const vendor = employee.vendor && employee.vendor !== "-" ? employee.vendor : "Unassigned Vendor";
      if (!map.has(vendor)) map.set(vendor, { vendor, total: 0, present: 0, absent: 0, leave: 0, ot: 0 });
      const item = map.get(vendor);
      const record = getDisplayedAttendanceRecord(employee);
      item.total += 1;
      if (record.status === "P") item.present += 1;
      if (record.status === "A") item.absent += 1;
      if (["CL", "SL", "EL", "FL"].includes(record.status)) item.leave += 1;
      item.ot += Number(record.otHours || 0) || 0;
    });
    return Array.from(map.values()).sort((a,b) => b.total - a.total);
  }, [attendanceDashboardEmployees, attendanceDate, attendanceRecords]);

  const attendanceExceptions = useMemo(() => attendanceDashboardEmployees.map((employee) => {
    const record = getDisplayedAttendanceRecord(employee);
    const issues = [];
    if (record.inTime && record.inTime > "09:30") issues.push("Late Arrival");
    if ((isWorkingStatus(record.status)) && (!record.inTime || !record.outTime)) issues.push("Missing Punch");
    if (record.status === "A") issues.push("Absent");
    if (record.status === "HD") issues.push("Half Day");
    if (record.flConflict) issues.push("FL Conflict");
    return issues.length ? { employee, record, issues } : null;
  }).filter(Boolean), [attendanceDashboardEmployees, attendanceDate, attendanceRecords]);

  const monthlyAttendanceRows = useMemo(() => {
    const monthPrefix = attendanceDate.slice(0, 7);
    return employees.map((employee) => {
      const days = Object.entries(attendanceRecords).filter(([date]) => date.startsWith(monthPrefix));
      const row = { employee, present: 0, absent: 0, leave: 0, wfh: 0, compOff: 0, wo: 0, half: 0, ot: 0 };
      days.forEach(([, day]) => {
        const record = day?.[employee.id] || {};
        if (record.status === "P") row.present++;
        else if (record.status === "A") row.absent++;
        else if (["CL", "SL", "EL", "FL"].includes(record.status)) row.leave++;
        else if (record.status === "WFH") row.wfh++;
        else if (record.status === "CO") row.compOff++;
        else if (record.status === "WO") row.wo++;
        else if (record.status === "HD") row.half++;
        row.ot += Number(record.otHours || 0) || 0;
      });
      return row;
    });
  }, [employees, attendanceDate, attendanceRecords]);

 const filteredEmployees = useMemo(() => {
  const searchText = String(search || "").trim().toLowerCase();

  return employees.filter((employee) => {
    const employeeId = String(
      employee?.id ||
      employee?.employeeId ||
      employee?.employeeCode ||
      employee?.empCode ||
      ""
    ).toLowerCase();

    const employeeName = String(
      employee?.name ||
      employee?.employeeName ||
      employee?.fullName ||
      ""
    ).toLowerCase();

    const designation = String(
      employee?.designation ||
      employee?.designationName ||
      ""
    ).toLowerCase();

    const site = String(
      employee?.site ||
      employee?.siteName ||
      employee?.project ||
      ""
    ).toLowerCase();

    const matchesSearch =
      !searchText ||
      employeeId.includes(searchText) ||
      employeeName.includes(searchText) ||
      designation.includes(searchText) ||
      site.includes(searchText);

    const matchesType =
      employeeType === "All" ||
      String(employee?.type || "") === employeeType;

    const matchesStatus =
      status === "All" ||
      String(employee?.status || "Active") === status;

    return matchesSearch && matchesType && matchesStatus;
  });
}, [employees, search, employeeType, status]);

  const totalEmployees = employees.length;

  const activeEmployees = employees.filter(
    (employee) => employee.status === "Active"
  ).length;

  const onRollEmployees = employees.filter(
    (employee) => employee.type === "On-Roll"
  ).length;

  const thirdPartyEmployees = employees.filter(
    (employee) => employee.type === "Third Party"
  ).length;

  const handleAddEmployee = (event) => {
  event.preventDefault();

  if (!newEmployee.id || !newEmployee.name || !newEmployee.designation) {
    alert("Please enter Employee ID, Name and Designation.");
    return;
  }

  const employeeData = {
    ...newEmployee,
    doj: newEmployee.doj || "-",
    vendor: newEmployee.vendor || "-",
  };

  if (editingEmployee) {
    setEmployees((previous) =>
      previous.map((employee) =>
        employee.id === editingEmployee.id
          ? employeeData
          : employee
      )
    );
  } else {
    setEmployees((previous) => [
      ...previous,
      employeeData,
    ]);
  }

  setNewEmployee({
    id: "",
    name: "",
    fatherName: "",
    dob: "",
    gender: "",
    mobile: "",
    email: "",
    aadhaar: "",
    pan: "",
    permanentAddress: "",
    currentAddress: "",
    emergencyContact: "",

    designation: "",
    department: "",
    grade: "",
    site: "",
    project: "",
    type: "Third Party",
    doj: "",
    reportingManager: "",
    vendor: "",
    contractorId: "",
    status: "Active",

    uan: "",
    pfApplicable: "Yes",
    pfNumber: "",
    esiApplicable: "Yes",
    esiNumber: "",
    ptApplicable: "Yes",
    lwfApplicable: "Yes",

    bankName: "",
    accountNumber: "",
    ifsc: "",
    accountHolderName: "",
    basicSalary: "",
    grossSalary: "",
    hra: "",
    otherAllowance: "",
    otRate: "",

    photo: "",
    aadhaarDocument: "",
    panDocument: "",
    resume: "",
    qualificationCertificate: "",
    experienceCertificate: "",
    bankProof: "",
    joiningDocuments: "",
    otherDocuments: "",
  });

  setEditingEmployee(null);
  setFormStep(1);
  setShowAddForm(false);
};

  const handleDeleteEmployee = (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to remove this employee?"
    );

    if (!confirmDelete) return;

    setEmployees((previous) =>
      previous.filter((employee) => employee.id !== id)
    );
  };

  const updateEmployeeField = (field, value) => {
    setNewEmployee((previous) => ({
      ...previous,
      [field]: value,
    }));
  };
  const handleExportExcel = () => {
  const worksheet = XLSX.utils.json_to_sheet(employees);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Employee Master"
  );

  XLSX.writeFile(
    workbook,
    "HRMS_Employee_Master.xlsx"
  );
};
const handleImportExcel = (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const firstSheet =
        workbook.Sheets[workbook.SheetNames[0]];

      const importedEmployees =
        XLSX.utils.sheet_to_json(firstSheet);

      if (importedEmployees.length === 0) {
        alert("Excel file is empty.");
        return;
      }

      setEmployees((previous) => {
        const existingIds = new Set(
          previous.map((employee) => employee.id)
        );

        const addedEmployees = [];
        const duplicateEmployees = [];
        const invalidEmployees = [];

        importedEmployees.forEach((employee) => {
          const employeeId = String(employee.id || "").trim();
          const employeeName = String(employee.name || "").trim();
          const designation = String(
            employee.designation || ""
          ).trim();

          // Required fields validation
          if (!employeeId || !employeeName || !designation) {
            invalidEmployees.push(employee);
            return;
          }

          // Duplicate Employee ID check
          if (
            existingIds.has(employeeId) ||
            addedEmployees.some(
              (item) => item.id === employeeId
            )
          ) {
            duplicateEmployees.push(employee);
            return;
          }

          addedEmployees.push({
            ...employee,
            id: employeeId,
            name: employeeName,
            designation: designation,
            doj: employee.doj || "-",
            vendor: employee.vendor || "-",
            status: employee.status || "Active",
          });
        });

        return [...previous, ...addedEmployees];
      });

      const existingIds = new Set(
        employees.map((employee) => employee.id)
      );

      let addedCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;
      const addedIds = new Set();

      importedEmployees.forEach((employee) => {
        const employeeId = String(employee.id || "").trim();
        const employeeName = String(employee.name || "").trim();
        const designation = String(
          employee.designation || ""
        ).trim();

        if (!employeeId || !employeeName || !designation) {
          invalidCount++;
        } else if (
          existingIds.has(employeeId) ||
          addedIds.has(employeeId)
        ) {
          duplicateCount++;
        } else {
          addedIds.add(employeeId);
          addedCount++;
        }
      });

      alert(
        `Import completed!\n\n` +
        `Added: ${addedCount}\n` +
        `Duplicate IDs: ${duplicateCount}\n` +
        `Invalid rows: ${invalidCount}`
      );
    } catch (error) {
      console.error(error);
      alert(
        "Unable to read the Excel file. Please check the format."
      );
    }
  };

  reader.readAsArrayBuffer(file);

  // Allow selecting the same file again
  event.target.value = "";
};

  return (
        <>
          <style>{`
            .fl-conflict-row > td {
              background: #fff7ed !important;
              border-top: 1px solid #fed7aa;
              border-bottom: 1px solid #fed7aa;
            }
            .attendance-status-control,
            .monthly-status-with-conflict {
              display: flex;
              align-items: center;
              gap: 6px;
              flex-wrap: wrap;
            }
            .fl-conflict-badge {
              border: 1px solid #fdba74;
              background: #fff7ed;
              color: #c2410c;
              border-radius: 999px;
              padding: 4px 8px;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              white-space: nowrap;
            }
            .fl-conflict-badge:hover { background: #ffedd5; }
            .fl-conflict-overlay {
              position: fixed;
              inset: 0;
              z-index: 9999;
              background: rgba(15, 23, 42, .45);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .fl-conflict-modal {
              width: min(520px, 100%);
              background: #fff;
              border-radius: 16px;
              box-shadow: 0 24px 70px rgba(15, 23, 42, .24);
              overflow: hidden;
            }
            .fl-conflict-modal-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding: 20px 22px;
              border-bottom: 1px solid #e2e8f0;
            }
            .fl-conflict-modal-header h3 { margin: 3px 0 4px; color: #0f172a; }
            .fl-conflict-modal-header p { margin: 0; color: #64748b; font-size: 13px; }
            .fl-conflict-close {
              border: 0; background: transparent; font-size: 24px; color: #64748b; cursor: pointer;
            }
            .fl-conflict-modal-body { padding: 20px 22px; }
            .fl-conflict-warning {
              padding: 12px 14px;
              background: #fff7ed;
              border: 1px solid #fed7aa;
              border-radius: 10px;
              color: #9a3412;
              margin-bottom: 16px;
              font-size: 13px;
            }
            .fl-conflict-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 18px;
            }
            .fl-conflict-item {
              padding: 11px 12px;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              background: #f8fafc;
            }
            .fl-conflict-item span { display:block; color:#64748b; font-size:11px; margin-bottom:3px; }
            .fl-conflict-item strong { color:#0f172a; font-size:13px; }
            .fl-conflict-actions { display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; }
            .fl-conflict-actions button { border-radius:9px; padding:9px 13px; cursor:pointer; font-weight:700; }
            .fl-keep-attendance { border:1px solid #cbd5e1; background:#fff; color:#334155; }
            .fl-keep-leave { border:1px solid #fb923c; background:#fff7ed; color:#c2410c; }
          `}</style>
          <input ref={attendanceImportInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleAttendanceImportFile} style={{ display: "none" }} />
        <section className="attendance-module">
          <div className="attendance-page-header attendance-dashboard-header">
            <div>
              <div className="module-eyebrow">WORKFORCE & SITE OPERATIONS</div>
              <h2>Attendance Dashboard</h2>
              <p>Monitor site manpower, attendance, working hours, overtime and exceptions from one place.</p>
            </div>
            <div className="attendance-header-actions">
              <button className="secondary-btn" onClick={exportAttendanceExcel}>📤 Export Excel</button>
              <button className="primary-button" onClick={() => { setAttendanceView("daily"); markAllAttendance("P"); }}>✓ Mark All Present</button>
            </div>
          </div>

          <div className="attendance-view-tabs">
            {[['dashboard','Dashboard','📊'],['daily','Daily Attendance','📝'],['reports','Attendance Reports','📊'],['exceptions','Exceptions','⚠️']].map(([view,label,icon]) => (
              <button key={view} className={attendanceView === view ? "active" : ""} onClick={() => setAttendanceView(view)}><span>{icon}</span>{label}</button>
            ))}
          </div>

          <div className="attendance-filter-panel">
            <div className="attendance-filter-title"><div><strong>Attendance Filters</strong><span>Apply filters to site, department and manpower type</span></div><button className="filter-reset" onClick={() => { setAttendanceSite("All"); setAttendanceDepartment("All"); setAttendanceVendor("All"); setEmployeeType("All"); setAttendanceStatusFilter("All"); setAttendanceSearch(""); }}>Reset</button></div>
            <div className="attendance-filter-grid">
              <div><label>Attendance Month</label><select value={attendanceMonth} onChange={(e) => { const nextMonth = e.target.value; setAttendanceMonth(nextMonth); const range = getMonthDateRange(nextMonth); setAttendanceDate(nextMonth === currentMonthKey ? new Date().toISOString().slice(0, 10) : range.min); }}>{attendanceMonthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div><label>Date</label><input type="date" min={selectedMonthRange.min} max={selectedMonthRange.max} value={attendanceDate} onChange={(e) => { const nextDate = e.target.value; setAttendanceDate(nextDate); setAttendanceMonth(nextDate.slice(0, 7)); }} /></div>
              <div><label>Site / Project</label><select value={attendanceSite} onChange={(e) => setAttendanceSite(e.target.value)}><option value="All">All Sites</option>{attendanceSites.map((site) => <option key={site}>{site}</option>)}</select></div>
              <div><label>Department</label><select value={attendanceDepartment} onChange={(e) => setAttendanceDepartment(e.target.value)}><option value="All">All Departments</option>{attendanceDepartments.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div><label>Employee Type</label><select value={employeeType} onChange={(e) => setEmployeeType(e.target.value)}><option value="All">All Types</option><option value="On-Roll">On-Roll</option><option value="Third Party">Third Party</option></select></div>
              <div><label>Vendor</label><select value={attendanceVendor} onChange={(e) => setAttendanceVendor(e.target.value)}><option value="All">All Vendors</option>{attendanceVendors.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div><label>Status</label><select value={attendanceStatusFilter} onChange={(e) => setAttendanceStatusFilter(e.target.value)}><option value="All">All Status</option>{ATTENDANCE_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.value} — {item.label}</option>)}<option value="-">Unmarked</option></select></div>
            </div>
          </div>

          {attendanceView === "dashboard" && (
            <>
              <div className="attendance-kpi-grid">
                <div className="attendance-kpi total"><span>👥</span><div><small>Total Manpower</small><strong>{attendanceDashboardSummary.total}</strong></div></div>
                <div className="attendance-kpi present"><span>✓</span><div><small>Present</small><strong>{attendanceDashboardSummary.present}</strong></div></div>
                <div className="attendance-kpi absent"><span>!</span><div><small>Absent</small><strong>{attendanceDashboardSummary.absent}</strong></div></div>
                <div className="attendance-kpi leave"><span>◐</span><div><small>On Leave</small><strong>{attendanceDashboardSummary.leave}</strong></div></div>
                <div className="attendance-kpi wfh"><span>⌂</span><div><small>WFH</small><strong>{attendanceDashboardSummary.wfh}</strong></div></div>
                <div className="attendance-kpi co"><span>↻</span><div><small>Comp Off</small><strong>{attendanceDashboardSummary.compOff}</strong></div></div>
                <div className="attendance-kpi late"><span>◷</span><div><small>Late Arrival</small><strong>{attendanceDashboardSummary.late}</strong></div></div>
                <div className="attendance-kpi missing"><span>⚠</span><div><small>Missing Punch</small><strong>{attendanceDashboardSummary.missingPunch}</strong></div></div>
                <div className="attendance-kpi ot"><span>⏱</span><div><small>OT Hours</small><strong>{attendanceDashboardSummary.otHours.toFixed(2)}</strong></div></div>
                <div className="attendance-kpi onsite"><span>🏗️</span><div><small>On Site / Present</small><strong>{attendanceDashboardSummary.present}</strong></div></div>
              </div>

              <div className="attendance-dashboard-grid top-grid">
                <div className="attendance-panel attendance-summary-panel">
                  <div className="panel-heading"><div><h3>Today's Attendance</h3><p>{new Date(`${attendanceDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p></div><button className="link-button" onClick={() => setAttendanceView("daily")}>View Daily →</button></div>
                  <div className="donut-area">
                    <div className="attendance-donut" style={{"--present": `${attendanceDashboardSummary.total ? (attendanceDashboardSummary.present / attendanceDashboardSummary.total) * 100 : 0}%`}}><div><strong>{attendanceDashboardSummary.total ? Math.round((attendanceDashboardSummary.present / attendanceDashboardSummary.total) * 100) : 0}%</strong><span>Present</span></div></div>
                    <div className="donut-legend"><div><i className="legend-dot green"></i>Present <strong>{attendanceDashboardSummary.present}</strong></div><div><i className="legend-dot red"></i>Absent <strong>{attendanceDashboardSummary.absent}</strong></div><div><i className="legend-dot amber"></i>Leave <strong>{attendanceDashboardSummary.leave}</strong></div><div><i className="legend-dot blue"></i>Weekly Off <strong>{attendanceDashboardSummary.wo}</strong></div><div><i className="legend-dot gray"></i>Unmarked <strong>{attendanceDashboardSummary.unmarked}</strong></div></div>
                  </div>
                </div>
                <div className="attendance-panel">
                  <div className="panel-heading"><div><h3>Attendance Exceptions</h3><p>Items requiring HR attention</p></div><button className="link-button" onClick={() => setAttendanceView("exceptions")}>View All →</button></div>
                  <div className="exception-list">
                    {attendanceExceptions.slice(0,5).map(({employee,issues}) => <div className="exception-row" key={employee.id}><div className="exception-avatar">{employee.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div><div><strong>{employee.name}</strong><span>{employee.site || "Unassigned"}</span></div><div className="exception-tags">{issues.map(issue=><span key={issue} className={issue.toLowerCase().replace(/ /g,"-")}>{issue}</span>)}</div></div>)}
                    {attendanceExceptions.length === 0 && <div className="empty-state">✓ No attendance exceptions for the selected filters.</div>}
                  </div>
                </div>
              </div>

              <div className="attendance-panel full-panel">
                <div className="panel-heading"><div><h3>Site-wise Manpower</h3><p>Current deployment and attendance by project/site</p></div><button className="link-button" onClick={() => setAttendanceView("site")}>View All →</button></div>
                <div className="site-attendance-table"><div className="site-table-head"><span>Site / Project</span><span>Total</span><span>Present</span><span>Absent</span><span>Leave</span><span>OT Hrs.</span><span>Attendance</span></div>{attendanceSiteStats.slice(0,8).map(item => { const pct=item.total ? Math.round(item.present/item.total*100) : 0; return <div className="site-table-row" key={item.site}><strong>{item.site}</strong><span>{item.total}</span><span className="text-green">{item.present}</span><span className="text-red">{item.absent}</span><span>{item.leave}</span><span>{item.ot.toFixed(2)}</span><div className="progress-wrap"><div className="progress-bar"><i style={{width:`${pct}%`}}></i></div><small>{pct}%</small></div></div> })}{attendanceSiteStats.length===0 && <div className="empty-state">No site data available.</div>}</div>
              </div>

              <div className="attendance-dashboard-grid bottom-grid">
                <div className="attendance-panel"><div className="panel-heading"><div><h3>Vendor-wise Third Party Manpower</h3><p>Vendor deployment and attendance</p></div><button className="link-button" onClick={() => setAttendanceView("vendor")}>View All →</button></div><div className="vendor-list">{attendanceVendorStats.slice(0,5).map(item => <div className="vendor-row" key={item.vendor}><div><strong>{item.vendor}</strong><span>{item.total} employees</span></div><div className="vendor-numbers"><b>{item.present}</b><small>Present</small></div><div className="vendor-numbers red"><b>{item.absent}</b><small>Absent</small></div><div className="vendor-numbers"><b>{item.ot.toFixed(1)}</b><small>OT Hrs</small></div></div>)}{attendanceVendorStats.length===0 && <div className="empty-state">No third-party vendor data available.</div>}</div></div>
                <div className="attendance-panel"><div className="panel-heading"><div><h3>Work Hours & OT</h3><p>For selected date and filters</p></div></div><div className="hours-highlight"><div><span>Regular Work Hours</span><strong>{attendanceDashboardSummary.workHours.toFixed(2)}</strong></div><div><span>Overtime Hours</span><strong>{attendanceDashboardSummary.otHours.toFixed(2)}</strong></div></div><div className="hours-bar"><i style={{width:`${Math.min(100, attendanceDashboardSummary.total ? attendanceDashboardSummary.workHours/(attendanceDashboardSummary.total*8)*100 : 0)}%`}}></i></div><p className="hours-note">Target reference: 8 hours per employee/day. Actual values come from attendance entries.</p></div>
              </div>
            </>
          )}

          {attendanceView === "daily" && (
            <>
              <div className="attendance-toolbar"><div><strong>{new Date(`${attendanceDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong><span>{filteredAttendanceEmployees.length} employees shown</span></div><div className="attendance-toolbar-actions"><button className="secondary-btn" onClick={downloadAttendanceTemplate}>⬇ Monthly Template</button><button className="secondary-btn" onClick={downloadDailyAttendanceTemplate}>⬇ Daily Template</button><button className="primary-button bulk-import-btn" onClick={() => openAttendanceImport("monthly")}>📥 Monthly Import</button><button className="primary-button bulk-import-btn" onClick={() => openAttendanceImport("daily")}>📅 Daily Import</button><button className="secondary-btn" onClick={() => markAllAttendance("WO")}>Mark Weekly Off</button><button className="danger-light-btn" onClick={clearAttendanceDay}>Clear Day</button></div></div>
              <div className="attendance-summary-grid">{[["Total Employees",attendanceSummary.P+attendanceSummary.A+attendanceSummary.CL+attendanceSummary.SL+attendanceSummary.EL+attendanceSummary.FL+attendanceSummary.CO+attendanceSummary.OD+attendanceSummary.WFH+attendanceSummary.WO+attendanceSummary.HO+attendanceSummary.HD+attendanceSummary.Unmarked,"total"],["Present",attendanceSummary.P,"present"],["Absent",attendanceSummary.A,"absent"],["Leave",attendanceSummary.CL+attendanceSummary.SL+attendanceSummary.EL+attendanceSummary.FL,"leave"],["WFH",attendanceSummary.WFH,"wfh"],["Comp Off",attendanceSummary.CO,"co"],["Unmarked",attendanceSummary.Unmarked,"unmarked"]].map(([label,value,type])=><div className={`attendance-summary-card ${type}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
              <div className="attendance-table-card"><div className="table-wrapper"><table><thead><tr><th>Employee</th><th>Site</th><th>Type</th><th>Attendance</th><th>In Time</th><th>Out Time</th><th>Working Hrs.</th><th>OT Hrs.</th><th>Source</th><th>Remarks</th><th className="attendance-action-header">Action</th></tr></thead><tbody>{filteredAttendanceEmployees.map(employee=>{
                const record = getDisplayedAttendanceRecord(employee, attendanceDate);
                const rawRecord = todayAttendance[employee.id] || {};
                const flInfo = getForceLeaveAttendanceInfo(employee, attendanceDate, rawRecord);
                return <tr key={employee.id} className={flInfo.conflict ? "fl-conflict-row" : ""}>
                  <td><div className="attendance-employee"><div className="table-avatar">{String(employee.name||"").split(" ").map(n=>n[0]).slice(0,2).join("")}</div><div><strong>{employee.name}</strong><span>{getAttendanceEmployeeCode(employee) || "-"} · {employee.department || "-"}</span></div></div></td>
                  <td>{employee.site||"-"}</td><td><span className="type-badge">{employee.type||"-"}</span></td>
                  <td><div className="attendance-status-cell">
                    <div className="attendance-status-control">
                      <select title={getStatusLabel(record.status)} className={`attendance-status-select status-${String(record.status||"unmarked").toLowerCase()}`} value={record.status||"-"} onChange={e=>updateAttendance(employee.id,"status",e.target.value)}>
                        <option value="-">Select</option>{ATTENDANCE_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.value} — {item.label}</option>)}
                      </select>
                      {flInfo.conflict && <button type="button" className="fl-conflict-badge" title="Force Leave conflict — click to review" onClick={() => openForceLeaveConflict(employee, attendanceDate)}>⚠ FL Conflict</button>}
                    </div>
                    <small>{getStatusLabel(record.status)}</small>
                  </div></td>
                  <td><input className="attendance-time-input" type="time" value={record.inTime||""} onChange={e=>updateAttendance(employee.id,"inTime",e.target.value)}/></td>
                  <td><input className="attendance-time-input" type="time" value={record.outTime||""} onChange={e=>updateAttendance(employee.id,"outTime",e.target.value)}/></td>
                  <td><input className="attendance-small-input" type="number" min="0" max="24" step="0.25" placeholder="0" value={record.workingHours||""} onChange={e=>updateAttendance(employee.id,"workingHours",e.target.value)}/></td>
                  <td><input className="attendance-small-input" type="number" min="0" max="24" step="0.25" placeholder="0" value={record.otHours||""} onChange={e=>updateAttendance(employee.id,"otHours",e.target.value)}/></td>
                  <td><span className="attendance-source-badge">{record.source || "Manual"}</span></td>
                  <td><input className="attendance-remarks-input" type="text" placeholder="Remarks" value={record.remarks||""} onChange={e=>updateAttendance(employee.id,"remarks",e.target.value)}/></td>
                  <td className="attendance-action-cell"><button type="button" className="employee-month-btn" title={`View ${employee.name} monthly attendance`} onClick={() => openEmployeeMonthlyAttendance(employee)}><span>📅</span><span>View Month</span></button></td>
                </tr>})}</tbody></table>{filteredAttendanceEmployees.length===0&&<div className="no-attendance">No employees match the selected filters.</div>}</div></div>
            </>
          )}

          {attendanceView === "reports" && (
            <div className="attendance-reports-page">
              <div className="attendance-report-header">
                <div>
                  <div className="module-eyebrow">REPORTING & COMPLIANCE</div>
                  <h3>Monthly Attendance Report</h3>
                  <p>Generate a complete employee-wise monthly attendance register for HR and payroll review.</p>
                </div>
                <div className="attendance-report-actions">
                  <button className="secondary-btn" onClick={() => setShowAttendanceReport(true)}>👁 View Report</button>
                  <button className="secondary-btn" onClick={exportAttendanceReportExcel}>📊 Download Excel</button>
                  <button className="primary-button" onClick={printAttendanceReportPdf}>📄 PDF / Print</button>
                </div>
              </div>

              <div className="attendance-report-filter-card">
                <div><label>Attendance Month</label><input type="month" value={attendanceReportMonth} onChange={(e) => setAttendanceReportMonth(e.target.value)} /></div>
                <div><label>Site / Project</label><select value={reportSite} onChange={(e) => setReportSite(e.target.value)}><option value="All">All Sites</option>{attendanceSites.map((site) => <option key={site}>{site}</option>)}</select></div>
                <div><label>Department</label><select value={reportDepartment} onChange={(e) => setReportDepartment(e.target.value)}><option value="All">All Departments</option>{attendanceDepartments.map((item) => <option key={item}>{item}</option>)}</select></div>
                <div><label>Employee Type</label><select value={reportEmployeeType} onChange={(e) => setReportEmployeeType(e.target.value)}><option value="All">All Types</option><option value="On-Roll">On-Roll</option><option value="Third Party">Third Party</option></select></div>
                <div><label>Vendor</label><select value={reportVendor} onChange={(e) => setReportVendor(e.target.value)}><option value="All">All Vendors</option>{attendanceVendors.map((item) => <option key={item}>{item}</option>)}</select></div>
              </div>

              <div className="attendance-report-summary-grid">
                <div><span>Total Employees</span><strong>{attendanceReportSummary.employees}</strong></div>
                <div className="report-present"><span>Present</span><strong>{attendanceReportSummary.P}</strong></div>
                <div className="report-absent"><span>Absent</span><strong>{attendanceReportSummary.A}</strong></div>
                <div className="report-leave"><span>Leave</span><strong>{attendanceReportSummary.leave}</strong></div>
                <div className="report-wo"><span>Weekly Off</span><strong>{attendanceReportSummary.WO}</strong></div>
                <div className="report-lop"><span>LOP</span><strong>{attendanceReportSummary.LOP}</strong></div>
                <div><span>OT Hours</span><strong>{attendanceReportSummary.otHours.toFixed(2)}</strong></div>
              </div>

              {showAttendanceReport && (
                <div className="attendance-report-preview" id="attendance-report-print-area">
                  <div className="report-brand-header">
                    <div>
                      <div className="report-company-name">BAUER ENGINEERING INDIA PVT. LTD.</div>
                      <div className="report-title">HRMS — MONTHLY ATTENDANCE REGISTER</div>
                      <div className="report-subtitle">Attendance Month: {new Date(`${attendanceReportMonth}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
                    </div>
                    <div className="report-generated">Generated: {new Date().toLocaleDateString("en-IN")}</div>
                  </div>
                  <div className="report-mini-summary">
                    <span>Total <b>{attendanceReportSummary.employees}</b></span><span>Present <b>{attendanceReportSummary.P}</b></span><span className="report-danger">Absent <b>{attendanceReportSummary.A}</b></span><span>Leave <b>{attendanceReportSummary.leave}</b></span><span>WO <b>{attendanceReportSummary.WO}</b></span><span className="report-danger">LOP <b>{attendanceReportSummary.LOP}</b></span><span className="report-paid">Paid Days <b>{attendanceReportSummary.paidDays.toFixed(1)}</b></span>
                  </div>
                  <div className="attendance-report-table-wrap">
                    <table className="attendance-report-table">
                      <thead><tr><th className="report-sticky">Employee</th><th>Designation</th><th>Site</th>{reportMonthDays.map((dateKey) => <th key={dateKey}>{dateKey.slice(8,10)}</th>)}<th>P</th><th>A</th><th>EL</th><th>CL</th><th>SL</th><th>FL</th><th>CO</th><th>OD</th><th>WFH</th><th>WO</th><th>HO</th><th>HD</th><th className="lop-head">LOP</th><th className="paid-head">Paid Days</th></tr></thead>
                      <tbody>
                        {attendanceReportData.map((row) => (
                          <tr key={row.employee.id}>
                            <td className="report-sticky"><strong>{row.employee.name}</strong><small>{getAttendanceEmployeeCode(row.employee) || "-"} · {row.employee.department || "-"}</small></td>
                            <td>{row.employee.designation || "-"}</td><td>{row.employee.site || "-"}</td>
                            {row.days.map((day) => <td key={day.dateKey} className={`report-status-cell report-status-${String(day.status || "blank").toLowerCase()}`}>{day.status || ""}</td>)}
                            <td className="count-p">{row.counts.P}</td><td className="count-a">{row.counts.A}</td><td>{row.counts.EL}</td><td>{row.counts.CL}</td><td>{row.counts.SL}</td><td>{row.counts.FL}</td><td>{row.counts.CO}</td><td>{row.counts.OD}</td><td>{row.counts.WFH}</td><td>{row.counts.WO}</td><td>{row.counts.HO}</td><td>{row.counts.HD}</td><td className="count-lop">{row.counts.LOP}</td><td className={`count-paid${row.paidDaysNeedsReview ? " paid-days-warning" : ""}`} title={row.paidDaysNeedsReview ? `Paid Days ${row.paidDays.toFixed(1)} is below ${row.totalCalendarDays} calendar days — please review attendance.` : `Paid Days ${row.paidDays.toFixed(1)} of ${row.totalCalendarDays} — OK.`}>{row.paidDays.toFixed(1)}{row.paidDaysNeedsReview && <span className="paid-days-alert" aria-label="Review required">!</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="report-legend"><span><i className="legend-p"></i>P Present</span><span><i className="legend-a"></i>A Absent</span><span><i className="legend-l"></i>Leave</span><span><i className="legend-wo"></i>WO Weekly Off</span><span><i className="legend-lop"></i>LOP Loss of Pay</span></div>
                  <div className="report-footer">BAUER ENGINEERING INDIA PVT. LTD. · HRMS Attendance Report · Confidential</div>
                </div>
              )}
            </div>
          )}

          {showEmployeeMonthly && selectedMonthlyEmployee && (
            <div
              className="attendance-monthly-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Employee monthly attendance"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                overflowY: "auto",
                overflowX: "hidden",
                padding: "16px",
                boxSizing: "border-box",
              }}
            >
              <div
                className="attendance-monthly-modal"
                style={{
                  width: "100%",
                  maxHeight: "calc(100vh - 32px)",
                  overflowY: "auto",
                  overflowX: "hidden",
                  margin: "0 auto",
                  boxSizing: "border-box",
                }}
              >
                <div className="attendance-monthly-modal-header">
                  <div>
                    <div className="module-eyebrow">EMPLOYEE-WISE ATTENDANCE</div>
                    <h3>Monthly Attendance</h3>
                    <p>{selectedMonthlyEmployee.name} · {selectedMonthlyEmployee.id} · Complete attendance register</p>
                  </div>
                  <button type="button" className="attendance-monthly-close" onClick={closeEmployeeMonthlyAttendance} aria-label="Close monthly attendance">×</button>
                </div>
                <div className="monthly-timesheet-page">
              <div className="monthly-timesheet-topbar monthly-modal-actions-row">
                <div>
                  <strong className="monthly-selected-month-label">
                    {new Date(`${attendanceDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </strong>
                  <p>Review and maintain this employee's complete monthly attendance.</p>
                </div>
                <div className="monthly-top-actions">
                  <button className="secondary-btn" onClick={exportSelectedMonthlyTimesheet} disabled={!selectedMonthlyEmployee}>
                    ↓ Export
                  </button>
                  <button className="secondary-btn monthly-save-btn" onClick={saveMonthlyAttendance} disabled={!selectedMonthlyEmployee}>
                    {monthlySaveState === "saved" ? "✓ Saved" : "💾 Save Draft"}
                  </button>
                  <button className="primary-button monthly-submit-btn" onClick={submitMonthlyAttendance} disabled={!selectedMonthlyEmployee}>
                    ✓ Submit Attendance
                  </button>
                </div>
              </div>

              <div className="monthly-save-status-row">
                <span className={`monthly-save-dot ${monthlySaveState === "saved" ? "saved" : "unsaved"}`}></span>
                <span>
                  {monthlySubmissionState === "submitted"
                    ? "Attendance submitted successfully"
                    : monthlySaveState === "saved"
                      ? `All changes saved${monthlyLastSavedAt ? ` at ${monthlyLastSavedAt}` : ""}`
                      : "Unsaved changes — click Save Draft before leaving this employee/month"}
                </span>
                {monthlySubmissionState === "submitted" && (
                  <span className="monthly-submitted-badge">SUBMITTED</span>
                )}
              </div>

              <div className="monthly-employee-selector monthly-employee-selector-compact">
                <div className="monthly-month-field">
                  <span>Attendance Month</span>
                  <input
                    type="month"
                    value={attendanceDate.slice(0, 7)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) setAttendanceDate(`${value}-01`);
                      setMonthlySaveState("saved");
                      setMonthlySubmissionState("draft");
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="secondary-btn monthly-small-action"
                  onClick={() => markSelectedEmployeeMonth("P")}
                  disabled={!selectedMonthlyEmployee}
                >
                  ✓ Mark All Present
                </button>

                <button
                  type="button"
                  className="secondary-btn monthly-small-action danger-outline"
                  onClick={clearSelectedEmployeeMonth}
                  disabled={!selectedMonthlyEmployee}
                >
                  Clear Month
                </button>
              </div>

              {selectedMonthlyEmployee ? (
                <>
                  <div className="monthly-employee-card">
                    <div className="monthly-profile">
                      <div className="monthly-profile-avatar">
                        {String(selectedMonthlyEmployee.name || "")
                          .split(" ")
                          .map((namePart) => namePart[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <h4>{selectedMonthlyEmployee.name}</h4>
                        <p>{selectedMonthlyEmployee.id} · {selectedMonthlyEmployee.designation || "Employee"}</p>
                      </div>
                    </div>

                    <div className="monthly-profile-meta">
                      <span><b>Site</b>{selectedMonthlyEmployee.site || "-"}</span>
                      <span><b>Department</b>{selectedMonthlyEmployee.department || "-"}</span>
                      <span><b>Type</b>{selectedMonthlyEmployee.type || "-"}</span>
                      <span><b>Vendor</b>{selectedMonthlyEmployee.vendor || "-"}</span>
                      <span><b>Shift</b>{selectedMonthlyEmployee.shift || "General"}</span>
                    </div>
                  </div>

                  <div className="monthly-kpi-grid">
                    <div><span>Present</span><strong className="green">{monthlyTimesheetSummary.P}</strong></div>
                    <div><span>Absent</span><strong className="red">{monthlyTimesheetSummary.A}</strong></div>
                    <div><span>Leave</span><strong>{monthlyTimesheetSummary.leave}</strong></div>
                    <div><span>WFH</span><strong>{monthlyTimesheetSummary.WFH}</strong></div>
                    <div><span>Comp Off</span><strong>{monthlyTimesheetSummary.CO}</strong></div>
                    <div><span>Weekly Off</span><strong>{monthlyTimesheetSummary.WO}</strong></div>
                    <div><span>Work Hours</span><strong>{monthlyTimesheetSummary.workHours.toFixed(2)}</strong></div>
                    <div><span>OT Hours</span><strong>{monthlyTimesheetSummary.otHours.toFixed(2)}</strong></div>
                    <div><span>Unmarked</span><strong className="amber">{monthlyTimesheetSummary.unmarked}</strong></div>
                  </div>

                  <div className="monthly-timesheet-card">
                    <div className="monthly-table-heading">
                      <div>
                        <h4>Attendance Register</h4>
                        <p>
                          {new Date(`${attendanceDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", {
                            month: "long",
                            year: "numeric",
                          })}
                          {" · "}
                          {monthDays.length} calendar days
                        </p>
                      </div>
                      <span className="monthly-audit-badge">Manual + Audit Ready</span>
                    </div>

                    <div className="monthly-timesheet-wrap">
                      <table className="monthly-timesheet-table">
                        <thead>
                          <tr>
                            <th className="sticky-date">Date</th>
                            <th>Day</th>
                            <th>Shift</th>
                            <th>Status</th>
                            <th>In Time</th>
                            <th>Out Time</th>
                            <th>Break</th>
                            <th>Working Hrs.</th>
                            <th>OT Hrs.</th>
                            <th>Source</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthDays.map((dateKey) => {
                            const date = new Date(`${dateKey}T00:00:00`);
                            const rawRecord = attendanceRecords?.[dateKey]?.[selectedMonthlyEmployee.id] || {};
                            const flInfo = getForceLeaveAttendanceInfo(selectedMonthlyEmployee, dateKey, rawRecord);
                            const record = getDisplayedAttendanceRecord(selectedMonthlyEmployee, dateKey);
                            const dayName = date.toLocaleDateString("en-IN", { weekday: "short" });
                            const isWeekend = Boolean(getWeekOffPolicyForDate(selectedMonthlyEmployee, dateKey, weekOffPolicies));

                            return (
                              <tr
                                key={dateKey}
                                className={`${isWeekend ? "weekend-row" : ""}${flInfo.conflict ? " fl-conflict-row" : ""}`}
                              >
                                <td className="sticky-date">
                                  <strong>{date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</strong>
                                  <small>{dateKey}</small>
                                </td>
                                <td>
                                  <span className={`day-chip ${isWeekend ? "weekend" : ""}`}>{dayName}</span>
                                </td>
                                <td>
                                  <span className="shift-chip">{selectedMonthlyEmployee.shift || "General"}</span>
                                </td>
                                <td>
                                  <div className="monthly-status-with-conflict">
                                    <select
                                      className={`monthly-status-select status-${String(record.status || "unmarked").toLowerCase()}`}
                                      value={record.status || "-"}
                                      onChange={(e) => updateMonthlyAttendance(dateKey, "status", e.target.value)}
                                    >
                                    <option value="-">Select</option>
                                    {ATTENDANCE_STATUS_OPTIONS.map((item) => (
                                      <option key={item.value} value={item.value}>
                                        {item.value} — {item.label}
                                      </option>
                                    ))}
                                    </select>
                                    {flInfo.conflict && (
                                      <button
                                        type="button"
                                        className="fl-conflict-badge"
                                        title="Force Leave conflict — click to review"
                                        onClick={() => openForceLeaveConflict(selectedMonthlyEmployee, dateKey)}
                                      >
                                        ⚠ FL Conflict
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <input
                                    className="monthly-time-input"
                                    type="time"
                                    value={record.inTime || ""}
                                    onChange={(e) => updateMonthlyAttendance(dateKey, "inTime", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="monthly-time-input"
                                    type="time"
                                    value={record.outTime || ""}
                                    onChange={(e) => updateMonthlyAttendance(dateKey, "outTime", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <span className="break-value">
                                    {record.breakHours || selectedMonthlyEmployee.breakHours || "01:00"}
                                  </span>
                                </td>
                                <td>
                                  <input
                                    className="monthly-hours-input"
                                    type="number"
                                    min="0"
                                    max="24"
                                    step="0.25"
                                    placeholder="0"
                                    value={record.workingHours || ""}
                                    onChange={(e) => updateMonthlyAttendance(dateKey, "workingHours", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="monthly-hours-input"
                                    type="number"
                                    min="0"
                                    max="24"
                                    step="0.25"
                                    placeholder="0"
                                    value={record.otHours || ""}
                                    onChange={(e) => updateMonthlyAttendance(dateKey, "otHours", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <span className="monthly-source-badge">{record.source || "Manual"}</span>
                                </td>
                                <td>
                                  <input
                                    className="monthly-remarks-input"
                                    type="text"
                                    placeholder="Add remark..."
                                    value={record.remarks || ""}
                                    onChange={(e) => updateMonthlyAttendance(dateKey, "remarks", e.target.value)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="monthly-empty-state">
                  <div className="monthly-empty-icon">⌕</div>
                  <h4>Select an employee from Daily Attendance</h4>
                  <p>Open monthly attendance directly from an employee row to review the complete month.</p>
                </div>
              )}
                </div>
              </div>
            </div>
          )}

          {attendanceView === "exceptions" && <div className="attendance-panel full-panel"><div className="panel-heading"><div><h3>Attendance Exceptions</h3><p>Late arrivals, missing punches, absences and half days</p></div></div><div className="exception-list exception-list-large">{attendanceExceptions.map(({employee,issues})=><div className="exception-row" key={employee.id}><div className="exception-avatar">{employee.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div><div><strong>{employee.name}</strong><span>{getAttendanceEmployeeCode(employee) || "-"} · {employee.site||"-"}</span></div><div className="exception-tags">{issues.map(issue=><span key={issue} className={issue.toLowerCase().replace(/ /g,"-")}>{issue}</span>)}</div></div>)}{attendanceExceptions.length===0&&<div className="empty-state">✓ No exceptions found for the selected filters.</div>}</div></div>}
        </section>

        {flConflictDialog && (
          <div className="fl-conflict-overlay" role="dialog" aria-modal="true" aria-label="Force Leave attendance conflict">
            <div className="fl-conflict-modal">
              <div className="fl-conflict-modal-header">
                <div>
                  <div className="module-eyebrow">ATTENDANCE CONTROL</div>
                  <h3>Force Leave Conflict</h3>
                  <p>{flConflictDialog.employee?.name || "Employee"} · {flConflictDialog.dateKey}</p>
                </div>
                <button type="button" className="fl-conflict-close" onClick={() => setFlConflictDialog(null)} aria-label="Close">×</button>
              </div>
              <div className="fl-conflict-modal-body">
                <div className="fl-conflict-warning">
                  This employee has an active Force Leave period, but attendance is already marked for this date. Nothing has been overwritten.
                </div>
                <div className="fl-conflict-grid">
                  <div className="fl-conflict-item"><span>Force Leave ID</span><strong>{flConflictDialog.forceLeave?.forceLeaveId || "-"}</strong></div>
                  <div className="fl-conflict-item"><span>FL Period</span><strong>{flConflictDialog.forceLeave?.flStartDate || "-"} → {flConflictDialog.forceLeave?.actualRejoiningDate || "Open"}</strong></div>
                  <div className="fl-conflict-item"><span>Attendance Status</span><strong>{flConflictDialog.rawRecord?.status || "-"}</strong></div>
                  <div className="fl-conflict-item"><span>Attendance Source</span><strong>{flConflictDialog.rawRecord?.source || "Manual"}</strong></div>
                </div>
                <p style={{ margin: "0 0 14px", color: "#475569", fontSize: 13 }}>
                  Choose the effective attendance treatment. The original attendance record and Force Leave record will both remain in history.
                </p>
                <div className="fl-conflict-actions">
                  <button type="button" className="fl-keep-attendance" onClick={() => resolveForceLeaveConflict("Keep Attendance")}>Keep Attendance</button>
                  <button type="button" className="fl-keep-leave" onClick={() => resolveForceLeaveConflict("Keep FL")}>Keep Force Leave</button>
                </div>
                {flConflictDialog.resolution && flConflictDialog.resolution !== "Pending" && (
                  <div style={{ marginTop: 12, color: "#166534", fontSize: 12, fontWeight: 700 }}>
                    ✓ Resolution saved: {flConflictDialog.resolution}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showAttendanceImportChoice && (
          <div
            className="attendance-import-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Choose attendance import type"
          >
            <div className="attendance-import-modal" style={{ maxWidth: "760px" }}>
              <div className="attendance-import-header">
                <div>
                  <div className="module-eyebrow">BULK ATTENDANCE</div>
                  <h3>Choose Import Type</h3>
                  <p>Use monthly upload for the complete month, or daily upload when the site sends one day at a time.</p>
                </div>
                <button
                  type="button"
                  className="monthly-close-btn"
                  aria-label="Close import options"
                  onClick={() => setShowAttendanceImportChoice(false)}
                >×</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, padding: "8px 0 18px" }}>
                <div style={{ border: "1px solid #dbe4f0", borderRadius: 14, padding: 18, background: "#f8fbff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#5b6b8c", letterSpacing: ".08em", textTransform: "uppercase" }}>Monthly Upload</div>
                  <h4 style={{ margin: "7px 0 6px", color: "#17213b", fontSize: 17 }}>Full Month Attendance</h4>
                  <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>Upload one Excel containing all employees and all dates of the selected month.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="secondary-btn" onClick={downloadAttendanceTemplate}>⬇ Download Monthly Template</button>
                    <button type="button" className="primary-button" onClick={() => openAttendanceImport("monthly")}>Upload Monthly Excel</button>
                  </div>
                </div>

                <div style={{ border: "1px solid #d8d2ff", borderRadius: 14, padding: 18, background: "#faf9ff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#6957d8", letterSpacing: ".08em", textTransform: "uppercase" }}>Daily Upload</div>
                  <h4 style={{ margin: "7px 0 6px", color: "#17213b", fontSize: 17 }}>One Day · All Employees</h4>
                  <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>For daily site Excel files. Upload one date for all employees in bulk — no need to mark employees one by one.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="secondary-btn" onClick={downloadDailyAttendanceTemplate}>⬇ Download Daily Template</button>
                    <button type="button" className="primary-button" onClick={() => openAttendanceImport("daily")}>Upload Daily Excel</button>
                  </div>
                </div>
              </div>

              <div className="attendance-import-note" style={{ marginTop: 0 }}>
                <strong>Daily upload:</strong> Select the attendance date first. Only that date will be updated. Existing attendance for other dates remains unchanged.
              </div>
            </div>
          </div>
        )}

        {showAttendanceImport && attendanceImportPreview && (
          <div
            className="attendance-import-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Bulk attendance import"
          >
            <div className="attendance-import-modal">
              <div className="attendance-import-header">
                <div>
                  <div className="module-eyebrow">BULK ATTENDANCE</div>
                  <h3>{attendanceImportPreview.importMode === "daily" ? "Import Daily Attendance" : "Import Monthly Attendance"}</h3>
                  <p>
                    {attendanceImportPreview.fileName} ·{" "}
                    {attendanceImportPreview.populatedCells} attendance entries detected
                    {attendanceImportPreview.importMode === "daily" && attendanceImportPreview.targetDate ? ` · ${attendanceImportPreview.targetDate}` : ""}
                  </p>
                </div>

                <button
                  type="button"
                  className="monthly-close-btn"
                  aria-label="Close import preview"
                  onClick={() => {
                    setShowAttendanceImport(false);
                    setAttendanceImportPreview(null);
                  }}
                >
                  ×
                </button>
              </div>

              <div className="attendance-import-stats">
                <div>
                  <span>Rows in Excel</span>
                  <strong>{attendanceImportPreview.rows}</strong>
                </div>

                <div>
                  <span>Ready to Import</span>
                  <strong className="import-valid">
                    {attendanceImportPreview.updates.length}
                  </strong>
                </div>

                <div>
                  <span>Needs Correction</span>
                  <strong className="import-error">
                    {attendanceImportPreview.errors.length}
                  </strong>
                </div>
              </div>

              <div className="attendance-import-note">
                <strong>Import Review:</strong>{" "}
                {attendanceImportPreview.errors.length > 0
                  ? "Valid records can be imported now. Please correct the records listed below in Excel and upload the file again for the remaining entries."
                  : "All attendance records have passed validation and are ready to import."}
              </div>

              {attendanceImportPreview.errors.length > 0 && (
                <div className="attendance-import-errors">
                  <div className="import-section-title">
                    <span>Records Requiring Correction</span>
                    <small>
                      {attendanceImportPreview.errors.length} record
                      {attendanceImportPreview.errors.length > 1 ? "s" : ""} found
                    </small>
                  </div>

                  <div className="attendance-import-error-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Excel Row</th>
                          <th>Employee ID</th>
                          <th>Date</th>
                          <th>Entered Value</th>
                          <th>What Needs Correction</th>
                        </tr>
                      </thead>

                      <tbody>
                        {attendanceImportPreview.errors
                          .slice(0, 100)
                          .map((error, index) => (
                            <tr
                              key={`${error.row}-${error.employeeId}-${error.date}-${index}`}
                            >
                              <td>
                                <strong>{error.row}</strong>
                              </td>

                              <td>
                                <strong>{error.employeeId || "-"}</strong>
                              </td>

                              <td>{error.date || "-"}</td>

                              <td>
                                <span className="import-invalid-value">
                                  {error.value || "Blank"}
                                </span>
                              </td>

                              <td>
                                <div className="import-issue-message">
                                  <strong>Correction required</strong>
                                  <span>{error.message}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {attendanceImportPreview.errors.length > 100 && (
                    <p className="import-more-errors">
                      Showing the first 100 errors. Please correct these records
                      and re-upload the Excel file.
                    </p>
                  )}
                </div>
              )}

              <div className="attendance-import-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowAttendanceImport(false);
                    setAttendanceImportPreview(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  disabled={!attendanceImportPreview.updates.length}
                  onClick={confirmAttendanceImport}
                >
                  ✓ Import {attendanceImportPreview.updates.length} Entries
                </button>
              </div>
            </div>
          </div>
        )}
        </>
  );
}

export default Attendance;  