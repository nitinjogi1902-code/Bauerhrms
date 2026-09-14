import { useEffect, useMemo, useState } from "react";
import "./SelfService.css";

/*
 * BAUER HRMS - Employee Self Service
 *
 * This module intentionally reads the same localStorage sources used by:
 * Employee Master, Attendance, Leave, Payroll and Organization.
 *
 * IMPORTANT ID RULE:
 * - employee.id = internal HRMS key used by Attendance / Leave / Payroll.
 * - employee.employeeId / employee.employeeCode = visible employee code.
 * The resolver below accepts either so login can safely pass either identifier.
 */

const EMPLOYEE_KEY = "bauerHrmsEmployees";
const ATTENDANCE_KEY = "hrms_attendance";
const BALANCE_KEY = "hrms_leave_balances";
const REQUEST_KEY = "hrms_leave_requests";
const ORG_KEY = "bauerHrmsOrganizationMasters";

const PAYROLL_RESULT_KEY = "bauerHrmsProcessedPayroll";
const PAYROLL_RESULT_MONTH_KEY = "bauerHrmsProcessedPayrollMonth";
const PAYROLL_STATUS_KEY = "bauerHrmsPayrollProcessingStatus";
const SALARY_STRUCTURE_KEY = "bauerHrmsSalaryStructures";

const LEAVE_TYPES = ["EL", "CL", "SL", "FL", "CO"];

const DEFAULT_LEAVE_CONFIG = {
  EL: {
    accrual: {
      enabled: true,
      frequency: "MONTHLY",
      basis: "PRESENT_DAYS",
      minimumDays: 21,
      credit: 1.25,
    },
    carryForward: {
      enabled: true,
      maximum: 30,
      expiryEnabled: false,
      expiryMonths: 0,
    },
  },
  CL: {
    accrual: {
      enabled: true,
      frequency: "YEARLY",
      basis: "FIXED",
      minimumDays: 0,
      credit: 12,
    },
    carryForward: {
      enabled: false,
      maximum: 0,
      expiryEnabled: false,
      expiryMonths: 0,
    },
  },
  SL: {
    accrual: {
      enabled: true,
      frequency: "YEARLY",
      basis: "FIXED",
      minimumDays: 0,
      credit: 12,
    },
    carryForward: {
      enabled: false,
      maximum: 0,
      expiryEnabled: false,
      expiryMonths: 0,
    },
  },
  FL: {
    accrual: {
      enabled: false,
      frequency: "NONE",
      basis: "NONE",
      minimumDays: 0,
      credit: 0,
    },
    carryForward: {
      enabled: false,
      maximum: 0,
      expiryEnabled: false,
      expiryMonths: 0,
    },
  },
  CO: {
    accrual: {
      enabled: true,
      frequency: "ON_EVENT",
      basis: "WEEKLY_OFF_WORKED",
      minimumDays: 0,
      credit: 1,
    },
    carryForward: {
      enabled: true,
      maximum: 30,
      expiryEnabled: true,
      expiryMonths: 6,
    },
  },
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function employeeName(employee) {
  return (
    employee?.name ||
    employee?.employeeName ||
    employee?.fullName ||
    "Employee"
  );
}

function employeeCode(employee) {
  return (
    employee?.employeeCode ||
    employee?.empCode ||
    employee?.employeeId ||
    employee?.code ||
    (String(employee?.id || "").startsWith("EMP") ? employee.id : "") ||
    "—"
  );
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value) {
  if (!value) return "—";
  const raw = String(value);

  // YYYY-MM-DD is parsed locally to avoid timezone shifting.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00`)
    : new Date(raw);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortMonth(month) {
  if (!month) return "—";
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getDays(from, to) {
  if (!from || !to || to < from) return 0;

  return (
    Math.floor(
      (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) /
        86400000
    ) + 1
  );
}

function normalizeLeaveType(item) {
  const code = String(item?.code || item?.id || "")
    .trim()
    .toUpperCase();

  if (!code) return null;

  const defaults = DEFAULT_LEAVE_CONFIG[code] || {};

  return {
    ...item,
    code,
    id: item?.id || code,
    active: item?.active !== false,
    accrual: {
      ...(defaults.accrual || {}),
      ...(item?.accrual || {}),
    },
    carryForward: {
      ...(defaults.carryForward || {}),
      ...(item?.carryForward || {}),
    },
  };
}

function getConfiguredLeaveTypes(organization) {
  const policy = Array.isArray(organization?.leavePolicies)
    ? organization.leavePolicies[0]
    : null;

  const configured = Array.isArray(policy?.leaveTypes)
    ? policy.leaveTypes
    : [];

  const byCode = new Map(
    configured
      .map(normalizeLeaveType)
      .filter(Boolean)
      .map((item) => [item.code, item])
  );

  return LEAVE_TYPES.map((code) =>
    normalizeLeaveType(byCode.get(code) || { code })
  );
}

function getPolicy(policies, code) {
  const normalizedCode = String(code || "").toUpperCase();

  return (
    policies.find(
      (item) =>
        String(item?.code || item?.id || "").toUpperCase() === normalizedCode
    ) ||
    normalizeLeaveType({ code: normalizedCode }) ||
    {
      code: normalizedCode,
      active: true,
      ...(DEFAULT_LEAVE_CONFIG[normalizedCode] || {}),
    }
  );
}

function countPresentDays(records, employeeId, year, month = null) {
  let total = 0;

  Object.entries(records || {}).forEach(([date, day]) => {
    const [y, m] = String(date).split("-").map(Number);

    if (y !== year || (month && m !== month)) return;

    const status = String(day?.[employeeId]?.status || "")
      .trim()
      .toUpperCase();

    const normalized = status.replace(/\s*[—-]\s*.*/, "").trim();

    if (["PRESENT", "P", "OD", "WFH"].includes(normalized)) total += 1;
    if (["HALF DAY", "HD"].includes(normalized)) total += 0.5;
  });

  return total;
}

function countUsed(records, employeeId, year, type) {
  let total = 0;

  Object.entries(records || {}).forEach(([date, day]) => {
    if (!String(date).startsWith(`${year}-`)) return;

    const status = String(day?.[employeeId]?.status || "")
      .trim()
      .toUpperCase();

    const normalized = status.replace(/\s*[—-]\s*.*/, "").trim();

    if (normalized === String(type).toUpperCase()) total += 1;
  });

  return total;
}

function countCompOffEarned(records, employeeId, year) {
  let total = 0;

  Object.entries(records || {}).forEach(([date, day]) => {
    if (!String(date).startsWith(`${year}-`)) return;

    const value = day?.[employeeId]?.compOffEarned;

    if (value) {
      total += value === true ? 1 : Number(value) || 0;
    }
  });

  return total;
}

function calculateAccrual(employee, type, year, attendance, policies) {
  const policy = getPolicy(policies, type);
  const accrual = policy?.accrual || {};

  if (policy?.active === false || accrual.enabled === false) return 0;

  const frequency = String(accrual.frequency || "NONE").toUpperCase();
  const basis = String(accrual.basis || "NONE").toUpperCase();
  const credit = Number(accrual.credit || 0);

  if (!credit || frequency === "NONE") return 0;

  if (frequency === "ON_EVENT" || basis === "WEEKLY_OFF_WORKED") {
    return type === "CO"
      ? countCompOffEarned(attendance, employee.id, year) * credit
      : 0;
  }

  if (frequency === "YEARLY") {
    if (basis === "FIXED") return credit;

    return countPresentDays(
      attendance,
      employee.id,
      year
    ) >= Number(accrual.minimumDays || 0)
      ? credit
      : 0;
  }

  if (frequency === "MONTHLY") {
    const minimum = Number(accrual.minimumDays || 0);
    let earned = 0;

    for (let month = 1; month <= 12; month += 1) {
      if (
        countPresentDays(
          attendance,
          employee.id,
          year,
          month
        ) >= minimum
      ) {
        earned += credit;
      }
    }

    return earned;
  }

  return 0;
}

function getEmployeeMatchValues(employee) {
  return [
    employee?.id,
    employee?.employeeId,
    employee?.employeeCode,
    employee?.employeeCode,
    employee?.empCode,
    employee?.code,
    employee?.officialEmail,
    employee?.email,
    employee?.username,
    employee?.name,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
}

/*
 * Resolve the logged-in employee without changing the internal employee.id.
 * Login may provide:
 *   { employeeId: "EMP001" }
 * or
 *   { employeeId: "<internal UUID>" }
 * or
 *   { officialEmail: "..." }
 */
function resolveCurrentEmployee(employeeList, currentUser) {
  if (!Array.isArray(employeeList) || employeeList.length === 0) return null;

  if (currentUser) {
    const wanted = [
      currentUser.id,
      currentUser.employeeId,
      currentUser.employeeCode,
      currentUser.employeeCode,
      currentUser.empCode,
      currentUser.email,
      currentUser.officialEmail,
      currentUser.username,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    if (wanted.length) {
      const found = employeeList.find((employee) =>
        getEmployeeMatchValues(employee).some((value) =>
          wanted.includes(value)
        )
      );

      if (found) return found;
    }
  }

  // Backward-compatible preview only when authentication has not yet supplied
  // a user. This keeps the page usable while Login/Dashboard is being connected.
  return (
    employeeList.find(
      (item) =>
        String(item?.status || "Active").toLowerCase() === "active"
    ) ||
    employeeList[0] ||
    null
  );
}

function openDocumentDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open("bauerHrmsEmployeeDocuments", 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("documents")) {
        const store = db.createObjectStore("documents", {
          keyPath: "id",
        });

        store.createIndex("employeeId", "employeeId", {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getEmployeeDocuments(employeeId) {
  const db = await openDocumentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readonly");
    const store = tx.objectStore("documents");

    let request;

    try {
      request = store.index("employeeId").getAll(employeeId);
    } catch {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const all = request.result || [];

      resolve(
        all.filter(
          (item) => String(item?.employeeId) === String(employeeId)
        )
      );

      db.close();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

function formatDocumentSize(bytes) {
  const value = Number(bytes || 0);

  if (!value) return "";

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusLabel(status) {
  const value = String(status || "").trim();

  const labels = {
    P: "Present",
    A: "Absent",
    EL: "Earned Leave",
    CL: "Casual Leave",
    SL: "Sick Leave",
    FL: "Force Leave",
    CO: "Comp Off Worked",
    OD: "On Duty",
    WFH: "Work From Home",
    WO: "Weekly Off",
    HO: "Holiday",
    HD: "Half Day",
  };

  return labels[value] || value || "Unmarked";
}

function attendanceStatusClass(status) {
  return String(status || "unmarked")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

const normalizeWeekOffPolicyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ");

const loadWeekOffPolicies = (organization) =>
  Array.isArray(organization?.weekOffPolicies)
    ? organization.weekOffPolicies
    : [];

const employeeMatchesWeekOffPolicy = (employee, policy) => {
  if (!employee || !policy || policy.active !== true) return false;

  const assignmentType = String(
    policy.assignmentType || "All Employees"
  );

  if (assignmentType === "All Employees") return true;

  const assignment = normalizeWeekOffPolicyValue(policy.assignmentValue);
  if (!assignment) return false;

  if (assignmentType === "Vendor") {
    return normalizeWeekOffPolicyValue(employee.vendor) === assignment;
  }

  if (assignmentType === "Employee Group") {
    const values = [
      employee.employeeGroup,
      employee.employeeGroupName,
      employee.group,
      employee.type,
    ]
      .map(normalizeWeekOffPolicyValue)
      .filter(Boolean);

    const aliases = new Set(values);

    if (aliases.has("on-roll")) aliases.add("staff");
    if (aliases.has("third party")) aliases.add("third party associates");

    return aliases.has(assignment);
  }

  return false;
};

const getWeekOffPolicyForDate = (employee, dateKey, organization) => {
  const policies = loadWeekOffPolicies(organization);

  if (!employee || !dateKey || !policies.length) return null;

  const applicable = policies.filter((policy) => {
    if (!employeeMatchesWeekOffPolicy(employee, policy)) return false;
    if (policy.effectiveFrom && dateKey < String(policy.effectiveFrom)) {
      return false;
    }
    return Boolean(policy.saturday || policy.sunday);
  });

  if (!applicable.length) return null;

  applicable.sort((a, b) => {
    const priority = (p) =>
      p.assignmentType === "Vendor"
        ? 3
        : p.assignmentType === "Employee Group"
        ? 2
        : 1;

    return (
      priority(b) - priority(a) ||
      String(b.effectiveFrom || "").localeCompare(
        String(a.effectiveFrom || "")
      )
    );
  });

  const day = new Date(`${dateKey}T00:00:00`).getDay();
  const policy = applicable[0];

  if (day === 6 && policy.saturday) return policy;
  if (day === 0 && policy.sunday) return policy;

  return null;
};

const getESSAttendanceRecord = (employee, dateKey, attendance, organization) => {
  const existing = attendance?.[dateKey]?.[employee?.id] || {};
  const policy = getWeekOffPolicyForDate(employee, dateKey, organization);

  if (!policy) return existing;

  const actualStatus = ["P", "HD", "OD", "WFH", "CO", "HO", "WO"].includes(
    existing.status
  );

  if (actualStatus) return existing;

  return {
    ...existing,
    status: "WO",
    source: existing.source || "Policy",
    policyId: policy.id,
    policyName: policy.name,
    auditReason:
      existing.auditReason || `Week-Off Policy: ${policy.name}`,
  };
};

export default function SelfService({
  employees = [],
  currentUser = null,
}) {
  const [activeTab, setActiveTab] = useState("Home");
  const [attendanceMonth, setAttendanceMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );

  const [employeeList, setEmployeeList] = useState(() =>
    readJSON(EMPLOYEE_KEY, employees)
  );

  const [attendance, setAttendance] = useState(() =>
    readJSON(ATTENDANCE_KEY, {})
  );

  const [balances, setBalances] = useState(() =>
    readJSON(BALANCE_KEY, {})
  );

  const [requests, setRequests] = useState(() =>
    readJSON(REQUEST_KEY, [])
  );

  const [organization, setOrganization] = useState(() =>
    readJSON(ORG_KEY, {})
  );

  const [processedPayroll, setProcessedPayroll] = useState(() =>
    readJSON(PAYROLL_RESULT_KEY, [])
  );

  const [processedPayrollMonth, setProcessedPayrollMonth] = useState(() =>
    localStorage.getItem(PAYROLL_RESULT_MONTH_KEY) || ""
  );

  const [payrollStatus, setPayrollStatus] = useState(() =>
    localStorage.getItem(PAYROLL_STATUS_KEY) || "Pending"
  );

  const [salaryStructures, setSalaryStructures] = useState(() =>
    readJSON(SALARY_STRUCTURE_KEY, {})
  );

  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    type: "EL",
    from: "",
    to: "",
    reason: "",
  });

  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => {
      setEmployeeList(readJSON(EMPLOYEE_KEY, employees));
      setAttendance(readJSON(ATTENDANCE_KEY, {}));
      setBalances(readJSON(BALANCE_KEY, {}));
      setRequests(readJSON(REQUEST_KEY, []));
      setOrganization(readJSON(ORG_KEY, {}));
      setProcessedPayroll(readJSON(PAYROLL_RESULT_KEY, []));
      setProcessedPayrollMonth(
        localStorage.getItem(PAYROLL_RESULT_MONTH_KEY) || ""
      );
      setPayrollStatus(
        localStorage.getItem(PAYROLL_STATUS_KEY) || "Pending"
      );
      setSalaryStructures(readJSON(SALARY_STRUCTURE_KEY, {}));
    };

    window.addEventListener("storage", refresh);

    // Same-tab custom events are used by the HRMS modules.
    const events = [
      "bauerHrmsEmployeesUpdated",
      "bauerHrmsMastersUpdated",
      "bauerHrmsLeaveRequestsUpdated",
      "bauerHrmsOrganizationUpdated",
    ];

    events.forEach((eventName) =>
      window.addEventListener(eventName, refresh)
    );

    const timer = window.setInterval(refresh, 1000);

    return () => {
      window.removeEventListener("storage", refresh);
      events.forEach((eventName) =>
        window.removeEventListener(eventName, refresh)
      );
      window.clearInterval(timer);
    };
  }, [employees]);

  const employee = useMemo(
    () => resolveCurrentEmployee(employeeList, currentUser),
    [employeeList, currentUser]
  );

  const name = employeeName(employee);
  const code = employeeCode(employee);
  const internalId = employee?.id || "";

  const policies = useMemo(
    () => getConfiguredLeaveTypes(organization),
    [organization]
  );

  const attendanceRows = useMemo(() => {
    if (!internalId || !employee) return [];

    const rows = [];

    Object.keys(attendance || {}).forEach((date) => {
      const record = getESSAttendanceRecord(
        employee,
        date,
        attendance,
        organization
      );

      if (!record || !record.status) return;

      rows.push({
        date,
        status: record.status || "",
        statusLabel: getStatusLabel(record.status),
        inTime: record.inTime || "—",
        outTime: record.outTime || "—",
        hours: record.workingHours || "—",
        otHours: record.otHours || 0,
        source: record.source || "",
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, internalId, employee, organization]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const currentMonthAttendanceRows = useMemo(
    () =>
      attendanceRows.filter((row) =>
        String(row.date).startsWith(currentMonth)
      ),
    [attendanceRows, currentMonth]
  );

  const attendanceSummary = useMemo(() => {
    const summary = {
      present: 0,
      leave: 0,
      absent: 0,
      half: 0,
      weeklyOff: 0,
      holiday: 0,
      compOffWorked: 0,
      od: 0,
      wfh: 0,
      workHours: 0,
      otHours: 0,
    };

    currentMonthAttendanceRows.forEach((row) => {
      const status = String(row.status || "").trim().toUpperCase();

      if (["P", "PRESENT"].includes(status)) summary.present += 1;
      else if (["EL", "CL", "SL", "FL"].includes(status)) summary.leave += 1;
      else if (["A", "ABSENT"].includes(status)) summary.absent += 1;
      else if (["HD", "HALF DAY"].includes(status)) summary.half += 1;
      else if (status === "WO") summary.weeklyOff += 1;
      else if (status === "HO") summary.holiday += 1;
      else if (status === "CO") summary.compOffWorked += 1;
      else if (status === "OD") summary.od += 1;
      else if (status === "WFH") summary.wfh += 1;

      summary.workHours += Number(row.hours || 0) || 0;
      summary.otHours += Number(row.otHours || 0) || 0;
    });

    return summary;
  }, [currentMonthAttendanceRows]);

  const attendanceMonthInfo = useMemo(() => {
    const [year, month] = String(attendanceMonth).split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days = [];

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(year, month - 1, day);
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ date, key, day });
    }

    return {
      year,
      month,
      label: firstDay.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      }),
      days,
      startOffset: firstDay.getDay(),
    };
  }, [attendanceMonth]);

  const attendanceCalendar = useMemo(() => {
    if (!internalId || !employee) return [];

    const holidayDates = new Set(
      (Array.isArray(organization?.holidays) ? organization.holidays : [])
        .filter((holiday) => holiday?.active !== false && holiday?.date)
        .map((holiday) => String(holiday.date))
    );

    return attendanceMonthInfo.days.map(({ date, key, day }) => {
      const record = getESSAttendanceRecord(
        employee,
        key,
        attendance,
        organization
      );

      const rawStatus = String(record?.status || "").trim().toUpperCase();
      const normalized = rawStatus.replace(/\s*[—-]\s*.*/, "").trim();

      let status = normalized || "";

      if (!status && holidayDates.has(key)) status = "HO";

      return {
        key,
        day,
        date,
        status: status || "UNMARKED",
        label: status ? getStatusLabel(status) : "Not Marked",
        inTime: record?.inTime || "—",
        outTime: record?.outTime || "—",
        hours: record?.workingHours || "—",
        otHours: record?.otHours || 0,
      };
    });
  }, [attendance, attendanceMonthInfo, internalId, employee, organization]);

  const selectedMonthSummary = useMemo(() => {
    const summary = {
      present: 0,
      leave: 0,
      absent: 0,
      half: 0,
      weeklyOff: 0,
      holiday: 0,
      od: 0,
      wfh: 0,
      compOffWorked: 0,
      unmarked: 0,
    };

    attendanceCalendar.forEach((item) => {
      const status = item.status;
      if (["P", "PRESENT"].includes(status)) summary.present += 1;
      else if (["EL", "CL", "SL", "FL"].includes(status)) summary.leave += 1;
      else if (["A", "ABSENT"].includes(status)) summary.absent += 1;
      else if (["HD", "HALF DAY"].includes(status)) summary.half += 1;
      else if (status === "WO") summary.weeklyOff += 1;
      else if (status === "HO") summary.holiday += 1;
      else if (status === "OD") summary.od += 1;
      else if (status === "WFH") summary.wfh += 1;
      else if (status === "CO") summary.compOffWorked += 1;
      else if (status === "UNMARKED") summary.unmarked += 1;
    });

    return summary;
  }, [attendanceCalendar]);

  const selectedMonthWorkHours = useMemo(
    () =>
      attendanceCalendar.reduce(
        (sum, row) => sum + (Number(row.hours) || 0),
        0
      ),
    [attendanceCalendar]
  );

  const selectedMonthOTHours = useMemo(
    () =>
      attendanceCalendar.reduce(
        (sum, row) => sum + (Number(row.otHours) || 0),
        0
      ),
    [attendanceCalendar]
  );

  const attendanceTrend = useMemo(() => {
    const base = new Date();
    base.setDate(1);

    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(base.getFullYear(), base.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const rows = attendanceRows.filter((row) => String(row.date).startsWith(key));
      const result = {
        key,
        label: date.toLocaleDateString("en-IN", { month: "short" }),
        present: 0,
        leave: 0,
        absent: 0,
        half: 0,
        total: 0,
      };

      rows.forEach((row) => {
        const status = String(row.status || "").trim().toUpperCase();
        if (["P", "PRESENT", "OD", "WFH"].includes(status)) result.present += 1;
        else if (["EL", "CL", "SL", "FL"].includes(status)) result.leave += 1;
        else if (["A", "ABSENT"].includes(status)) result.absent += 1;
        else if (["HD", "HALF DAY"].includes(status)) {
          result.half += 1;
          result.present += 0.5;
        }
      });

      result.total = result.present + result.leave + result.absent;
      return result;
    });
  }, [attendanceRows]);

  const attendanceMonthStep = (direction) => {
    const [year, month] = String(attendanceMonth).split("-").map(Number);
    const next = new Date(year, month - 1 + direction, 1);
    setAttendanceMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
    );
  };

  /*
   * Leave balance intentionally mirrors Leave.jsx:
   * opening balance + policy accrual - attendance usage,
   * with carry-forward maximum applied.
   */
  const leaveBalances = useMemo(() => {
    const result = {};

    const year = new Date().getFullYear();

    LEAVE_TYPES.forEach((type) => {
      const opening = Number(balances?.[internalId]?.[type] || 0);

      const earned = employee
        ? calculateAccrual(
            employee,
            type,
            year,
            attendance,
            policies
          )
        : 0;

      const used = employee
        ? countUsed(attendance, internalId, year, type)
        : 0;

      const policy = getPolicy(policies, type);
      const carryForward = policy?.carryForward || {};
      const maximum = Number(carryForward.maximum || 0);

      const raw = opening + earned - used;

      result[type] =
        carryForward.enabled && maximum > 0
          ? Math.min(Math.max(0, raw), maximum)
          : Math.max(0, raw);
    });

    return result;
  }, [balances, internalId, employee, attendance, policies]);

  const myRequests = useMemo(
    () =>
      (requests || [])
        .filter(
          (request) =>
            String(request?.employeeId || "") === String(internalId)
        )
        .sort((a, b) =>
          String(b.createdAt || "").localeCompare(
            String(a.createdAt || "")
          )
        ),
    [requests, internalId]
  );

  /*
   * Payroll ESS is deliberately read-only and uses the Payroll module's
   * finalized result as the source of truth. A calculated (but not finalized)
   * payroll must never appear as an employee payslip.
   */
  const myPayroll = useMemo(() => {
    if (!internalId || !Array.isArray(processedPayroll)) return null;
    if (payrollStatus !== "Finalized") return null;
    if (!processedPayrollMonth) return null;

    return (
      processedPayroll.find(
        (row) =>
          String(row?.employeeId) === String(internalId) &&
          String(row?.payrollMonth || processedPayrollMonth) ===
            String(processedPayrollMonth)
      ) || null
    );
  }, [processedPayroll, internalId, payrollStatus, processedPayrollMonth]);

  const payrollNotFinalized =
    Boolean(processedPayrollMonth) && payrollStatus !== "Finalized";

  const mySalaryStructure = useMemo(() => {
    if (!internalId) return null;
    return salaryStructures?.[internalId] || null;
  }, [salaryStructures, internalId]);

  const upcomingEvents = useMemo(() => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const holidays = Array.isArray(organization?.holidays)
      ? organization.holidays
      : [];

    holidays.forEach((holiday) => {
      if (holiday?.active === false || !holiday?.date) return;

      const date = new Date(`${holiday.date}T00:00:00`);

      if (Number.isNaN(date.getTime()) || date < today) return;

      result.push({
        id: `holiday-${holiday.id || holiday.date}`,
        date,
        title: holiday.name || "Holiday",
        type: "Holiday",
        detail: holiday.paid === false ? "Unpaid holiday" : "Company holiday",
      });
    });

    if (employee?.dob) {
      const dob = new Date(`${employee.dob}T00:00:00`);

      if (!Number.isNaN(dob.getTime())) {
        const birthday = new Date(
          today.getFullYear(),
          dob.getMonth(),
          dob.getDate()
        );

        if (birthday < today) birthday.setFullYear(today.getFullYear() + 1);

        result.push({
          id: "my-birthday",
          date: birthday,
          title: "My Birthday",
          type: "Birthday",
          detail: name,
        });
      }
    }

    const joiningDate = employee?.doj || employee?.dateOfJoining;

    if (joiningDate) {
      const doj = new Date(`${joiningDate}T00:00:00`);

      if (!Number.isNaN(doj.getTime())) {
        const anniversary = new Date(
          today.getFullYear(),
          doj.getMonth(),
          doj.getDate()
        );

        if (anniversary < today) {
          anniversary.setFullYear(today.getFullYear() + 1);
        }

        result.push({
          id: "my-anniversary",
          date: anniversary,
          title: "Work Anniversary",
          type: "Anniversary",
          detail: `${name} · ${employee?.designation || "Employee"}`,
        });
      }
    }

    return result
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
  }, [organization, employee, name]);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      if (!internalId) {
        setDocuments([]);
        return;
      }

      setDocumentsLoading(true);

      try {
        const result = await getEmployeeDocuments(internalId);

        if (!cancelled) {
          setDocuments(
            result.sort((a, b) =>
              String(b.uploadedAt || "").localeCompare(
                String(a.uploadedAt || "")
              )
            )
          );
        }
      } catch {
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setDocumentsLoading(false);
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [internalId]);

  const submitLeave = (event) => {
    event.preventDefault();

    if (!employee || !internalId) {
      setMessage("Your Employee Master record could not be found.");
      return;
    }

    const days = getDays(leaveForm.from, leaveForm.to);

    if (!days) {
      setMessage("Please select valid From and To dates.");
      return;
    }

    const available = Number(leaveBalances[leaveForm.type] || 0);

    if (available < days) {
      setMessage(
        `${leaveForm.type} available balance is only ${available.toFixed(
          2
        )} day(s).`
      );
      return;
    }

    const request = {
      id: `ESS-LR-${Date.now()}`,
      employeeId: internalId,
      type: leaveForm.type,
      from: leaveForm.from,
      to: leaveForm.to,
      days,
      reason: String(leaveForm.reason || "").trim(),
      status: "Pending",
      createdAt: new Date().toISOString(),
      source: "Employee Self Service",
    };

    const next = [request, ...(Array.isArray(requests) ? requests : [])];

    setRequests(next);
    localStorage.setItem(REQUEST_KEY, JSON.stringify(next));

    window.dispatchEvent(
      new Event("bauerHrmsLeaveRequestsUpdated")
    );

    setLeaveForm({
      type: "EL",
      from: "",
      to: "",
      reason: "",
    });

    setMessage("Leave request submitted successfully.");
  };

  const downloadDocument = (documentRecord) => {
    const blob = documentRecord?.blob;

    if (!(blob instanceof Blob)) {
      window.alert(
        "This document does not contain a downloadable file object."
      );
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      documentRecord.name || `Employee_Document_${documentRecord.id}`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const tabs = [
    ["Home", "⌂"],
    ["My Profile", "♙"],
    ["Attendance", "◷"],
    ["Leave", "□"],
    ["Payroll", "₹"],
    ["Events", "★"],
    ["Documents", "▤"],
  ];

  const quickCards = [
    [
      "Attendance",
      "◷",
      "My Attendance",
      "Check attendance and working history",
      "blue",
    ],
    [
      "Leave",
      "□",
      "Leave",
      "Apply leave and check your balance",
      "orange",
    ],
    [
      "Payroll",
      "₹",
      "My Payslips",
      "Access finalized salary and payroll records",
      "green",
    ],
    [
      "Events",
      "★",
      "Upcoming Events",
      "Birthdays, anniversaries and HR events",
      "purple",
    ],
  ];

  const renderHome = () => (
    <>
      <section className="ess-welcome ess-hero">
        <div className="ess-hero-copy">
          <span>WELCOME BACK</span>
          <h2>{name}</h2>
          <p>
            {employee?.designation || "Employee"}
            {employee?.department ? ` · ${employee.department}` : ""}
          </p>
          <div className="ess-hero-meta">
            <span>Employee ID: <strong>{code}</strong></span>
            <span>Today: <strong>{dateText(new Date().toISOString().slice(0, 10))}</strong></span>
          </div>
        </div>
        <div className="ess-status"><i /> Self Service Active</div>
      </section>

      <section className="ess-grid">
        {quickCards.map(([key, icon, title, text, tone]) => (
          <button key={key} className="ess-card" onClick={() => setActiveTab(key)}>
            <div className={`ess-card-icon ${tone}`}>{icon}</div>
            <div className="ess-card-body">
              <span>{title}</span>
              <strong>{key === "Leave" ? "Apply" : "View"}</strong>
              <small>{text}</small>
            </div>
            <b>→</b>
          </button>
        ))}
      </section>

      <section className="ess-stat-grid ess-stat-grid-5">
        <div className="ess-stat-present">
          <small>PRESENT</small>
          <strong>{selectedMonthSummary.present}</strong>
          <span>{attendanceMonthInfo.label}</span>
        </div>
        <div className="ess-stat-absent">
          <small>ABSENT</small>
          <strong>{selectedMonthSummary.absent}</strong>
          <span>{attendanceMonthInfo.label}</span>
        </div>
        <div className="ess-stat-leave">
          <small>LEAVE</small>
          <strong>{selectedMonthSummary.leave}</strong>
          <span>{attendanceMonthInfo.label}</span>
        </div>
        <div>
          <small>WEEKLY OFF</small>
          <strong>{selectedMonthSummary.weeklyOff}</strong>
          <span>Calendar days</span>
        </div>
        <div>
          <small>OT HOURS</small>
          <strong>{selectedMonthOTHours.toFixed(1)}</strong>
          <span>Current month</span>
        </div>
      </section>

      <div className="ess-dashboard-grid">
        <section className="ess-panel ess-calendar-panel">
          <div className="ess-panel-head">
            <div>
              <span>ATTENDANCE CALENDAR</span>
              <h3>Monthly Attendance</h3>
            </div>
            <div className="ess-month-switcher">
              <button type="button" onClick={() => attendanceMonthStep(-1)}>‹</button>
              <strong>{attendanceMonthInfo.label}</strong>
              <button type="button" onClick={() => attendanceMonthStep(1)}>›</button>
            </div>
          </div>

          <div className="ess-calendar-legend">
            <span><i className="present" /> Present</span>
            <span><i className="absent" /> Absent</span>
            <span><i className="leave" /> Leave</span>
            <span><i className="wo" /> Weekly Off</span>
            <span><i className="holiday" /> Holiday</span>
            <span><i className="unmarked" /> Not Marked</span>
          </div>

          <div className="ess-calendar">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="ess-calendar-weekday">{day}</div>
            ))}
            {Array.from({ length: attendanceMonthInfo.startOffset }).map((_, index) => (
              <div key={`blank-${index}`} className="ess-calendar-day blank" />
            ))}
            {attendanceCalendar.map((item) => (
              <div
                key={item.key}
                className={`ess-calendar-day ${attendanceStatusClass(item.status)} ${
                  item.key === new Date().toISOString().slice(0, 10) ? "today" : ""
                }`}
                title={`${dateText(item.key)} · ${item.label}`}
              >
                <b>{item.day}</b>
                <span>{item.status === "UNMARKED" ? "—" : item.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ess-panel ess-trend-panel">
          <div className="ess-panel-head">
            <div>
              <span>ATTENDANCE ANALYTICS</span>
              <h3>6-Month Attendance Trend</h3>
            </div>
            <button type="button" onClick={() => setActiveTab("Attendance")}>View details →</button>
          </div>

          <div className="ess-chart-legend">
            <span><i className="present" /> Present</span>
            <span><i className="leave" /> Leave</span>
            <span><i className="absent" /> Absent</span>
          </div>

          <div className="ess-bar-chart">
            {attendanceTrend.map((item) => {
              const max = Math.max(1, ...attendanceTrend.map((x) => Math.max(x.present, x.leave, x.absent)));
              return (
                <div className="ess-bar-column" key={item.key}>
                  <div className="ess-bar-value">{item.present || 0}</div>
                  <div className="ess-bar-track">
                    <div className="ess-bar present" style={{ height: `${Math.max(2, (item.present / max) * 100)}%` }} />
                    {item.leave > 0 && (
                      <div className="ess-bar leave" style={{ height: `${Math.max(2, (item.leave / max) * 100)}%` }} />
                    )}
                    {item.absent > 0 && (
                      <div className="ess-bar absent" style={{ height: `${Math.max(2, (item.absent / max) * 100)}%` }} />
                    )}
                  </div>
                  <strong>{item.label}</strong>
                  <small>{item.present}P · {item.leave}L · {item.absent}A</small>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="ess-columns">
        <section className="ess-panel">
          <div className="ess-panel-head">
            <div>
              <span>LEAVE BALANCE</span>
              <h3>My Available Balance</h3>
            </div>
            <button onClick={() => setActiveTab("Leave")}>View all →</button>
          </div>
          <div className="ess-balance-grid">
            {LEAVE_TYPES.map((type) => (
              <div key={type}>
                <small>{type === "CO" ? "COMP OFF" : type}</small>
                <strong>{Number(leaveBalances[type] || 0).toFixed(2)}</strong>
                <span>days</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ess-panel">
          <div className="ess-panel-head">
            <div>
              <span>QUICK ACTIONS</span>
              <h3>Frequently Used</h3>
            </div>
          </div>
          <div className="ess-actions">
            <button onClick={() => setActiveTab("Leave")}><span>□</span><div><strong>Apply Leave</strong><small>Submit a new leave request</small></div></button>
            <button onClick={() => setActiveTab("Attendance")}><span>◷</span><div><strong>Attendance History</strong><small>View your attendance records</small></div></button>
            <button onClick={() => setActiveTab("My Profile")}><span>♙</span><div><strong>My Profile</strong><small>View your employee information</small></div></button>
          </div>
        </section>
      </div>

      <section className="ess-panel ess-full">
        <div className="ess-panel-head">
          <div>
            <span>PAYROLL</span>
            <h3>Latest Payroll Snapshot</h3>
          </div>
          <button onClick={() => setActiveTab("Payroll")}>Open Payroll →</button>
        </div>
        {myPayroll ? (
          <div className="ess-stat-grid">
            <div><small>PAYROLL MONTH</small><strong>{shortMonth(myPayroll.payrollMonth || processedPayrollMonth)}</strong><span>{payrollStatus}</span></div>
            <div><small>GROSS</small><strong>{money(myPayroll.gross)}</strong><span>Monthly gross</span></div>
            <div><small>DEDUCTIONS</small><strong>{money(Number(myPayroll.pf || 0) + Number(myPayroll.esi || 0) + Number(myPayroll.pt || 0) + Number(myPayroll.lopAmount || 0))}</strong><span>PF + ESI + PT + LOP</span></div>
            <div><small>NET PAYABLE</small><strong>{money(myPayroll.netPayable)}</strong><span>Processed payroll</span></div>
          </div>
        ) : (
          <div className="ess-empty">No processed payroll record is available for your employee ID yet.{mySalaryStructure ? <span> Salary structure exists at {money(mySalaryStructure.gross)} gross, but payroll is not processed yet.</span> : null}</div>
        )}
      </section>
    </>
  );

  const renderProfile = () => (
    <section className="ess-panel ess-full">
      <div className="ess-panel-head">
        <div>
          <span>MY PROFILE</span>
          <h3>Employee Information</h3>
        </div>
      </div>

      <div className="ess-profile-grid">
        {[
          ["Employee ID", code],
          ["Employee Name", name],
          ["Department", employee?.department || "—"],
          ["Designation", employee?.designation || "—"],
          [
            "Date of Joining",
            dateText(employee?.doj || employee?.dateOfJoining),
          ],
          [
            "Date of Birth",
            dateText(employee?.dob || employee?.dateOfBirth),
          ],
          ["Gender", employee?.gender || "—"],
          [
            "Employment Type",
            employee?.employmentType || employee?.type || "—",
          ],
          [
            "Employee Group",
            employee?.employeeGroup || "—",
          ],
          [
            "Location",
            employee?.location || employee?.site || "—",
          ],
          ["Branch", employee?.branch || "—"],
          ["Shift", employee?.shift || "—"],
          ["Vendor", employee?.vendor || "—"],
          ["Job Type", employee?.jobType || "—"],
          ["Official Email", employee?.officialEmail || "—"],
          ["Mobile", employee?.mobile || "—"],
          ["Status", employee?.status || "Active"],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{String(value ?? "—")}</strong>
          </div>
        ))}
      </div>
    </section>
  );

  const renderAttendance = () => (
    <div className="ess-attendance-page">
      <section className="ess-stat-grid ess-stat-grid-5">
        <div className="ess-stat-present"><small>PRESENT</small><strong>{selectedMonthSummary.present}</strong><span>{attendanceMonthInfo.label}</span></div>
        <div className="ess-stat-absent"><small>ABSENT</small><strong>{selectedMonthSummary.absent}</strong><span>{attendanceMonthInfo.label}</span></div>
        <div className="ess-stat-leave"><small>LEAVE</small><strong>{selectedMonthSummary.leave}</strong><span>{attendanceMonthInfo.label}</span></div>
        <div><small>HALF DAY</small><strong>{selectedMonthSummary.half}</strong><span>{attendanceMonthInfo.label}</span></div>
        <div><small>WORK HOURS</small><strong>{selectedMonthWorkHours.toFixed(1)}</strong><span>Recorded hours</span></div>
      </section>

      <div className="ess-dashboard-grid">
        <section className="ess-panel ess-calendar-panel">
          <div className="ess-panel-head">
            <div><span>ATTENDANCE</span><h3>My Attendance Calendar</h3></div>
            <div className="ess-month-switcher">
              <button type="button" onClick={() => attendanceMonthStep(-1)}>‹</button>
              <strong>{attendanceMonthInfo.label}</strong>
              <button type="button" onClick={() => attendanceMonthStep(1)}>›</button>
            </div>
          </div>
          <div className="ess-calendar-legend">
            <span><i className="present" /> Present</span>
            <span><i className="absent" /> Absent</span>
            <span><i className="leave" /> Leave</span>
            <span><i className="wo" /> Weekly Off</span>
            <span><i className="holiday" /> Holiday</span>
            <span><i className="unmarked" /> Not Marked</span>
          </div>
          <div className="ess-calendar">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="ess-calendar-weekday">{day}</div>)}
            {Array.from({ length: attendanceMonthInfo.startOffset }).map((_, index) => <div key={`blank-${index}`} className="ess-calendar-day blank" />)}
            {attendanceCalendar.map((item) => (
              <div key={item.key} className={`ess-calendar-day ${attendanceStatusClass(item.status)} ${item.key === new Date().toISOString().slice(0, 10) ? "today" : ""}`} title={`${dateText(item.key)} · ${item.label}`}>
                <b>{item.day}</b><span>{item.status === "UNMARKED" ? "—" : item.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ess-panel ess-trend-panel">
          <div className="ess-panel-head">
            <div><span>ATTENDANCE ANALYTICS</span><h3>Last 6 Months</h3></div>
          </div>
          <div className="ess-chart-legend">
            <span><i className="present" /> Present</span><span><i className="leave" /> Leave</span><span><i className="absent" /> Absent</span>
          </div>
          <div className="ess-bar-chart">
            {attendanceTrend.map((item) => {
              const max = Math.max(1, ...attendanceTrend.map((x) => Math.max(x.present, x.leave, x.absent)));
              return (
                <div className="ess-bar-column" key={item.key}>
                  <div className="ess-bar-value">{item.present}</div>
                  <div className="ess-bar-track">
                    <div className="ess-bar present" style={{ height: `${Math.max(2, (item.present / max) * 100)}%` }} />
                    {item.leave > 0 && <div className="ess-bar leave" style={{ height: `${Math.max(2, (item.leave / max) * 100)}%` }} />}
                    {item.absent > 0 && <div className="ess-bar absent" style={{ height: `${Math.max(2, (item.absent / max) * 100)}%` }} />}
                  </div>
                  <strong>{item.label}</strong><small>{item.present}P · {item.leave}L · {item.absent}A</small>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="ess-panel ess-full">
        <div className="ess-panel-head">
          <div><span>DAILY RECORDS</span><h3>{attendanceMonthInfo.label} Attendance History</h3></div>
          <div className="ess-mini-stats"><b>{selectedMonthSummary.present} Present</b><b>{selectedMonthSummary.leave} Leave</b><b>{selectedMonthSummary.absent} Absent</b><b>{selectedMonthOTHours.toFixed(2)} OT Hrs</b></div>
        </div>
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead><tr><th>Date</th><th>In Time</th><th>Out Time</th><th>Working Hours</th><th>OT Hours</th><th>Status</th></tr></thead>
            <tbody>
              {attendanceRows.filter((row) => String(row.date).startsWith(attendanceMonth)).map((row) => (
                <tr key={row.date}>
                  <td>{dateText(row.date)}</td><td>{row.inTime}</td><td>{row.outTime}</td><td>{row.hours}</td><td>{row.otHours || "—"}</td>
                  <td><span className={`ess-status-pill ${attendanceStatusClass(row.status)}`}>{row.statusLabel}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!attendanceRows.filter((row) => String(row.date).startsWith(attendanceMonth)).length && <div className="ess-empty">No attendance records found for {attendanceMonthInfo.label}.</div>}
        </div>
      </section>
    </div>
  );

  const renderLeave = () => (
    <div className="ess-leave-layout">
      <section className="ess-panel">
        <div className="ess-panel-head">
          <div>
            <span>LEAVE BALANCE</span>
            <h3>Available Leave</h3>
          </div>
        </div>

        <div className="ess-balance-grid">
          {LEAVE_TYPES.map((type) => {
            const policy = getPolicy(policies, type);

            return (
              <div key={type}>
                <small>
                  {type === "CO"
                    ? "COMP OFF"
                    : policy?.name || type}
                </small>

                <strong>
                  {Number(leaveBalances[type] || 0).toFixed(2)}
                </strong>

                <span>days</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="ess-panel">
        <div className="ess-panel-head">
          <div>
            <span>EMPLOYEE ACTION</span>
            <h3>Apply Leave</h3>
          </div>
        </div>

        <form className="ess-leave-form" onSubmit={submitLeave}>
          <label>
            Leave Type
            <select
              value={leaveForm.type}
              onChange={(event) =>
                setLeaveForm((previous) => ({
                  ...previous,
                  type: event.target.value,
                }))
              }
            >
              {LEAVE_TYPES.map((type) => {
                const policy = getPolicy(policies, type);

                return (
                  <option key={type} value={type}>
                    {type === "CO"
                      ? "CO - Comp Off"
                      : `${type} - ${policy?.name || type}`}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            From
            <input
              type="date"
              value={leaveForm.from}
              onChange={(event) =>
                setLeaveForm((previous) => ({
                  ...previous,
                  from: event.target.value,
                }))
              }
              required
            />
          </label>

          <label>
            To
            <input
              type="date"
              value={leaveForm.to}
              onChange={(event) =>
                setLeaveForm((previous) => ({
                  ...previous,
                  to: event.target.value,
                }))
              }
              required
            />
          </label>

          <label>
            Reason
            <textarea
              rows="3"
              value={leaveForm.reason}
              onChange={(event) =>
                setLeaveForm((previous) => ({
                  ...previous,
                  reason: event.target.value,
                }))
              }
            />
          </label>

          <div className="ess-available">
            Available:{" "}
            <strong>
              {Number(
                leaveBalances[leaveForm.type] || 0
              ).toFixed(2)}{" "}
              days
            </strong>
          </div>

          {message && (
            <div className="ess-form-message">{message}</div>
          )}

          <button className="ess-primary" type="submit">
            Submit Leave Request
          </button>
        </form>
      </section>

      <section className="ess-panel ess-full">
        <div className="ess-panel-head">
          <div>
            <span>MY REQUESTS</span>
            <h3>Leave History</h3>
          </div>
        </div>

        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {myRequests.map((request) => (
                <tr key={request.id}>
                  <td>{request.type}</td>
                  <td>{dateText(request.from)}</td>
                  <td>{dateText(request.to)}</td>
                  <td>{request.days}</td>
                  <td>{request.reason || "—"}</td>
                  <td>
                    <span
                      className={`ess-status-pill ${String(
                        request.status
                      ).toLowerCase()}`}
                    >
                      {request.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!myRequests.length && (
            <div className="ess-empty">
              No leave requests submitted yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderPayroll = () => {
    const payrollMonthLabel = myPayroll?.payrollMonth || processedPayrollMonth;
    const structure = mySalaryStructure || {};
    const daysInMonth = payrollMonthLabel
      ? new Date(
          Number(String(payrollMonthLabel).split("-")[0]),
          Number(String(payrollMonthLabel).split("-")[1]),
          0
        ).getDate()
      : 0;
    const paidDays = Number(myPayroll?.paidDays || 0);
    const attendanceFactor =
      daysInMonth > 0 ? Math.min(1, Math.max(0, paidDays / daysInMonth)) : 0;

    const basicDA = Number(structure.basicDA || 0) * attendanceFactor;
    const hra = Number(structure.hra || 0) * attendanceFactor;
    const specialAllowance =
      Number(structure.specialAllowance || 0) * attendanceFactor;
    const addOnTotal = Number(structure.addOnTotal || 0) * attendanceFactor;
    const statutoryDeductions =
      Number(myPayroll?.pf || 0) +
      Number(myPayroll?.esi || 0) +
      Number(myPayroll?.pt || 0);
    const lopAmount = Number(
      myPayroll?.lopAmount ??
        Math.max(0, Number(myPayroll?.gross || 0) - Number(myPayroll?.payableGross || 0))
    );
    const totalDeductions = statutoryDeductions + lopAmount;
    const totalEarnings =
      Number(myPayroll?.payableGross || 0) + Number(myPayroll?.otAmount || 0);

    return (
      <section className="ess-panel ess-full">
        <div className="ess-panel-head">
          <div>
            <span>PAYROLL</span>
            <h3>My Payroll & Payslip</h3>
            <small>Finalized payroll data from HR Payroll Management</small>
          </div>

          <div className="ess-mini-stats">
            <b>{myPayroll ? "Finalized" : payrollStatus}</b>
            <b>{shortMonth(payrollMonthLabel)}</b>
          </div>
        </div>

        {myPayroll ? (
          <>
            <div className="ess-stat-grid">
              <div>
                <small>GROSS</small>
                <strong>{money(myPayroll.gross)}</strong>
                <span>Monthly salary structure</span>
              </div>
              <div>
                <small>PAID DAYS</small>
                <strong>{myPayroll.paidDays ?? "—"}</strong>
                <span>{daysInMonth} calendar days</span>
              </div>
              <div>
                <small>OT</small>
                <strong>{money(myPayroll.otAmount)}</strong>
                <span>{myPayroll.otHours || 0} hours</span>
              </div>
              <div>
                <small>NET PAYABLE</small>
                <strong>{money(myPayroll.netPayable)}</strong>
                <span>Finalized salary</span>
              </div>
            </div>

            <div className="ess-profile-grid">
              {[
                ["Employee ID", myPayroll.employeeCode || code],
                ["Payroll Month", shortMonth(payrollMonthLabel)],
                ["Employee Type", myPayroll.employeeType || employee?.type || "—"],
                ["Department", myPayroll.department || employee?.department || "—"],
                ["Site / Project", myPayroll.site || employee?.site || "—"],
                ["Gross Salary", money(myPayroll.gross)],
                ["Payable Gross", money(myPayroll.payableGross)],
                ["LOP Days", myPayroll.lopDays ?? 0],
                ["LOP Deduction", money(lopAmount)],
                ["Employee PF", money(myPayroll.pf)],
                ["Employee ESI", money(myPayroll.esi)],
                ["Professional Tax", money(myPayroll.pt)],
                ["Total Deductions", money(totalDeductions)],
                ["OT Hours", myPayroll.otHours ?? 0],
                ["OT Amount", money(myPayroll.otAmount)],
                ["Net Payable", money(myPayroll.netPayable)],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{String(value ?? "—")}</strong>
                </div>
              ))}
            </div>

            <div className="ess-columns" style={{ marginTop: "18px" }}>
              <section className="ess-panel">
                <div className="ess-panel-head">
                  <div><span>EARNINGS</span><h3>Payable Earnings</h3></div>
                </div>
                <div className="ess-profile-grid">
                  {[
                    ["Basic + DA", money(basicDA)],
                    ["HRA", money(hra)],
                    ["Special Allowance", money(specialAllowance)],
                    ["Other Allowances", money(addOnTotal)],
                    ["Payable Gross", money(myPayroll.payableGross)],
                    ["OT Amount", money(myPayroll.otAmount)],
                    ["Total Earnings", money(totalEarnings)],
                  ].map(([label, value]) => (
                    <div key={label}><small>{label}</small><strong>{value}</strong></div>
                  ))}
                </div>
              </section>

              <section className="ess-panel">
                <div className="ess-panel-head">
                  <div><span>DEDUCTIONS</span><h3>Employee Deductions</h3></div>
                </div>
                <div className="ess-profile-grid">
                  {[
                    ["Employee PF", money(myPayroll.pf)],
                    ["Employee ESI", money(myPayroll.esi)],
                    ["Professional Tax", money(myPayroll.pt)],
                    ["LOP Deduction", money(lopAmount)],
                    ["Total Deductions", money(totalDeductions)],
                    ["Net Payable", money(myPayroll.netPayable)],
                  ].map(([label, value]) => (
                    <div key={label}><small>{label}</small><strong>{value}</strong></div>
                  ))}
                </div>
              </section>
            </div>

            <div className="ess-empty" style={{ marginTop: "18px" }}>
              <strong>Payslip status: Finalized</strong>
              <p>Your figures above are read directly from the finalized payroll result. ESS does not recalculate or modify payroll.</p>
            </div>
          </>
        ) : (
          <div className="ess-empty">
            <strong>Payroll is not available yet.</strong>
            {payrollNotFinalized ? (
              <p>Payroll for {shortMonth(processedPayrollMonth)} has been calculated but is not finalized by HR yet. Your payslip will appear here after finalization.</p>
            ) : (
              <p>No finalized payroll record is available for your employee yet.</p>
            )}
          </div>
        )}
      </section>
    );
  };

  const renderEvents = () => (
    <section className="ess-panel ess-full">
      <div className="ess-panel-head">
        <div>
          <span>PEOPLE & EVENTS</span>
          <h3>Upcoming Events</h3>
        </div>
      </div>

      <div className="ess-table-wrap">
        <table className="ess-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Type</th>
              <th>Details</th>
            </tr>
          </thead>

          <tbody>
            {upcomingEvents.map((event) => (
              <tr key={event.id}>
                <td>{dateText(event.date.toISOString().slice(0, 10))}</td>
                <td>{event.title}</td>
                <td>{event.type}</td>
                <td>{event.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!upcomingEvents.length && (
          <div className="ess-empty">
            No upcoming events or holidays are configured in
            Organization.
          </div>
        )}
      </div>
    </section>
  );

  const renderDocuments = () => (
    <section className="ess-panel ess-full">
      <div className="ess-panel-head">
        <div>
          <span>EMPLOYEE DOCUMENTS</span>
          <h3>My Documents</h3>
        </div>
      </div>

      <div className="ess-table-wrap">
        {documentsLoading ? (
          <div className="ess-empty">Loading your documents...</div>
        ) : documents.length ? (
          <table className="ess-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Size</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {documents.map((documentRecord) => (
                <tr key={documentRecord.id}>
                  <td>{documentRecord.name || "Document"}</td>
                  <td>{documentRecord.type || "Other"}</td>
                  <td>{dateText(documentRecord.uploadedAt)}</td>
                  <td>{formatDocumentSize(documentRecord.size)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        downloadDocument(documentRecord)
                      }
                    >
                      View / Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="ess-empty">
            No employee documents have been uploaded against your
            employee record.
          </div>
        )}
      </div>
    </section>
  );

  if (!employee) {
    return (
      <div className="ess-page">
        <div className="ess-placeholder">
          <div className="ess-placeholder-icon">♙</div>
          <span>EMPLOYEE SELF SERVICE</span>
          <h2>Employee record not found</h2>
          <p>
            The logged-in employee could not be matched with Employee
            Master. Please check the Employee ID / employee code in
            Login and Employee Master.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ess-page">
      <div className="ess-breadcrumb">
        Dashboard <span>/</span> Self Service
      </div>

      <div className="ess-header">
        <div>
          <span className="ess-eyebrow">
            EMPLOYEE SELF SERVICE
          </span>
          <h1>My Workspace</h1>
          <p>
            Attendance, leave, payroll and employee information in
            one place.
          </p>
        </div>

        <div className="ess-user-card">
          <div className="ess-avatar">
            {name.charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{name}</strong>
            <span>{code}</span>
          </div>
        </div>
      </div>

      <div className="ess-tabs">
        {tabs.map(([label, icon]) => (
          <button
            key={label}
            className={activeTab === label ? "active" : ""}
            onClick={() => {
              setActiveTab(label);
              setMessage("");
            }}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "Home" && renderHome()}
      {activeTab === "My Profile" && renderProfile()}
      {activeTab === "Attendance" && renderAttendance()}
      {activeTab === "Leave" && renderLeave()}
      {activeTab === "Payroll" && renderPayroll()}
      {activeTab === "Events" && renderEvents()}
      {activeTab === "Documents" && renderDocuments()}
    </div>
  );
}
