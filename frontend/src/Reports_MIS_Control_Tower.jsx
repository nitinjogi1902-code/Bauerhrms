import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
/**
 * BAUER HRMS — REPORTS / MIS CONTROL TOWER
 *
 * This module is intentionally data-adaptive:
 * - Reads the existing HRMS localStorage data without mutating it.
 * - Uses known module storage keys where available.
 * - Falls back to fuzzy localStorage discovery for payroll/training/etc.
 * - Keeps each MIS independent so adding a new module does not break reports.
 *
 * Main report families:
 * 1. Executive HR MIS
 * 2. Recruitment MIS
 * 3. Attendance MIS
 * 4. Payroll MIS
 * 5. Employee Master MIS
 * 6. Transfer Case MIS
 * 7. Leave MIS
 * 8. Vendor / Contractor MIS
 * 9. Training & Development MIS
 * 10. PMS MIS
 * 11. Organization Master MIS
 */

const REPORTS_EMBEDDED_CSS = '/* =========================================================\n   BAUER HRMS — REPORTS / MIS\n   ========================================================= */\n\n.reports-page {\n  --mis-primary: #715cf6;\n  --mis-primary-soft: #f2efff;\n  --mis-ink: #2f3852;\n  --mis-muted: #858da0;\n  --mis-border: #e2dfed;\n  --mis-green: #168454;\n  --mis-green-bg: #eaf9f1;\n  --mis-red: #c44f5b;\n  --mis-red-bg: #fff1f3;\n  --mis-amber: #a66d1d;\n  --mis-amber-bg: #fff7e8;\n  --mis-blue: #58739a;\n  --mis-blue-bg: #eef5fd;\n\n  min-height: 100%;\n  padding: 30px 34px 65px;\n  background:\n    radial-gradient(circle at 90% 0%, rgba(113,92,246,.07), transparent 28%),\n    linear-gradient(180deg,#faf9ff 0%,#f7f7fc 100%);\n  color: var(--mis-ink);\n}\n\n.reports-page *,\n.reports-page *::before,\n.reports-page *::after { box-sizing: border-box; }\n\n.reports-page button,\n.reports-page input,\n.reports-page select { font: inherit; }\n\n.reports-header {\n  display:flex;\n  align-items:flex-end;\n  justify-content:space-between;\n  gap:24px;\n  margin-bottom:17px;\n}\n\n.reports-eyebrow {\n  display:inline-flex;\n  align-items:center;\n  gap:8px;\n  color:#958cae;\n  font-size:9px;\n  font-weight:850;\n  letter-spacing:1.6px;\n}\n\n.reports-eyebrow::before {\n  content:"";\n  width:22px;\n  height:3px;\n  border-radius:99px;\n  background:linear-gradient(90deg,var(--mis-primary),#8d7ff7);\n}\n\n.reports-header h1 {\n  margin:5px 0;\n  color:#303951;\n  font-size:30px;\n  line-height:1.15;\n  letter-spacing:-.6px;\n}\n\n.reports-header p {\n  margin:0;\n  color:var(--mis-muted);\n  font-size:11px;\n  line-height:1.55;\n}\n\n.reports-header-actions {\n  display:flex;\n  gap:8px;\n}\n\n.reports-primary,\n.reports-secondary,\n.reports-reset {\n  min-height:40px;\n  padding:0 13px;\n  border-radius:9px;\n  cursor:pointer;\n  transition:.16s ease;\n}\n\n.reports-primary {\n  border:0;\n  background:linear-gradient(135deg,#715cf6,#8d7ff7);\n  color:#fff;\n  font-size:10px;\n  font-weight:800;\n  box-shadow:0 8px 20px rgba(113,92,246,.17);\n}\n\n.reports-secondary,\n.reports-reset {\n  border:1px solid #ddd9eb;\n  background:#fff;\n  color:#665c92;\n  font-size:10px;\n  font-weight:750;\n}\n\n.reports-secondary.small {\n  min-height:32px;\n  padding:0 9px;\n  font-size:8px;\n}\n\n.reports-command-bar {\n  display:grid;\n  grid-template-columns:minmax(250px,1.6fr) repeat(3,minmax(120px,.65fr)) 135px 135px auto;\n  gap:8px;\n  align-items:center;\n  padding:10px;\n  margin-bottom:14px;\n  border:1px solid var(--mis-border);\n  border-radius:12px;\n  background:rgba(255,255,255,.9);\n  box-shadow:0 6px 18px rgba(48,43,88,.03);\n}\n\n.reports-search {\n  min-height:40px;\n  display:flex;\n  align-items:center;\n  gap:8px;\n  padding:0 11px;\n  border:1px solid #ddd9eb;\n  border-radius:9px;\n  background:#fff;\n}\n\n.reports-search span {\n  color:#9991ae;\n  font-size:11px;\n}\n\n.reports-search input {\n  width:100%;\n  min-width:0;\n  border:0;\n  outline:0;\n  background:transparent;\n  color:#4d576d;\n  font-size:10px;\n}\n\n.reports-command-bar select,\n.reports-command-bar > input[type="date"] {\n  width:100%;\n  height:40px;\n  padding:0 9px;\n  border:1px solid #ddd9eb;\n  border-radius:9px;\n  background:#fff;\n  color:#616a7d;\n  font-size:9px;\n}\n\n.reports-layout {\n  display:grid;\n  grid-template-columns:235px minmax(0,1fr);\n  gap:14px;\n  align-items:start;\n}\n\n.reports-sidebar {\n  position:sticky;\n  top:10px;\n  padding:14px 10px;\n  border:1px solid var(--mis-border);\n  border-radius:14px;\n  background:rgba(255,255,255,.96);\n  box-shadow:0 7px 21px rgba(48,43,88,.04);\n}\n\n.reports-sidebar-label {\n  padding:0 9px 9px;\n  color:#948cab;\n  font-size:8px;\n  font-weight:850;\n  letter-spacing:1.45px;\n}\n\n.reports-group {\n  margin-bottom:12px;\n}\n\n.reports-group > span {\n  display:block;\n  padding:5px 9px;\n  color:#a0a3b1;\n  font-size:7px;\n  font-weight:800;\n  text-transform:uppercase;\n  letter-spacing:.8px;\n}\n\n.reports-group button {\n  width:100%;\n  display:flex;\n  align-items:center;\n  gap:7px;\n  min-height:35px;\n  padding:0 9px;\n  border:0;\n  border-radius:8px;\n  background:transparent;\n  color:#737b8e;\n  text-align:left;\n  font-size:9px;\n  cursor:pointer;\n}\n\n.reports-group button i {\n  width:6px;\n  height:6px;\n  flex:0 0 6px;\n  border-radius:50%;\n  background:#c9c7d5;\n}\n\n.reports-group button:hover {\n  background:#f8f6ff;\n  color:#5f50ae;\n}\n\n.reports-group button.active {\n  color:#5e4fac;\n  background:linear-gradient(90deg,#eeeaff,#f8f6ff);\n  box-shadow:inset 2px 0 0 var(--mis-primary);\n  font-weight:800;\n}\n\n.reports-group button.active i { background:var(--mis-primary); }\n\n.reports-main { min-width:0; }\n\n.reports-title-card {\n  display:flex;\n  align-items:center;\n  justify-content:space-between;\n  gap:18px;\n  padding:18px 19px;\n  margin-bottom:11px;\n  border:1px solid #e1ddef;\n  border-radius:15px;\n  background:\n    radial-gradient(circle at 97% 0%,rgba(113,92,246,.09),transparent 23%),\n    linear-gradient(135deg,#fff,#faf9ff);\n  box-shadow:0 8px 24px rgba(48,43,88,.035);\n}\n\n.reports-title-card > div:first-child > span {\n  color:#958cae;\n  font-size:8px;\n  font-weight:850;\n  letter-spacing:1.25px;\n}\n\n.reports-title-card h2 {\n  margin:4px 0;\n  color:#303951;\n  font-size:21px;\n  letter-spacing:-.35px;\n}\n\n.reports-title-card p {\n  margin:0;\n  color:#9298a8;\n  font-size:9px;\n  line-height:1.5;\n}\n\n.reports-meta {\n  min-width:105px;\n  padding:9px 10px;\n  border:1px solid #e0dced;\n  border-radius:10px;\n  background:#fff;\n  text-align:right;\n}\n\n.reports-meta strong,\n.reports-meta span { display:block; }\n\n.reports-meta strong {\n  color:#6455b3;\n  font-size:22px;\n}\n\n.reports-meta span {\n  margin-top:1px;\n  color:#999eac;\n  font-size:7px;\n}\n\n.reports-kpis {\n  display:grid;\n  grid-template-columns:repeat(5,minmax(0,1fr));\n  gap:9px;\n  margin-bottom:12px;\n}\n\n.report-kpi {\n  position:relative;\n  overflow:hidden;\n  min-height:82px;\n  padding:12px 13px;\n  border:1px solid var(--mis-border);\n  border-radius:12px;\n  background:rgba(255,255,255,.97);\n  box-shadow:0 5px 17px rgba(48,43,88,.03);\n}\n\n.report-kpi::after {\n  content:"";\n  position:absolute;\n  right:-23px;\n  bottom:-23px;\n  width:60px;\n  height:60px;\n  border-radius:50%;\n  background:currentColor;\n  opacity:.04;\n}\n\n.report-kpi small,\n.report-kpi strong,\n.report-kpi span { display:block; }\n\n.report-kpi small {\n  color:#858da0;\n  font-size:8px;\n}\n\n.report-kpi strong {\n  margin-top:3px;\n  color:#384158;\n  font-size:18px;\n  white-space:nowrap;\n  overflow:hidden;\n  text-overflow:ellipsis;\n}\n\n.report-kpi span {\n  margin-top:2px;\n  color:#9ba0ad;\n  font-size:7px;\n}\n\n.report-kpi.blue { color:var(--mis-blue); }\n.report-kpi.green { color:var(--mis-green); }\n.report-kpi.purple { color:var(--mis-primary); }\n.report-kpi.amber { color:var(--mis-amber); }\n.report-kpi.danger { color:var(--mis-red); }\n\n.reports-card {\n  overflow:hidden;\n  border:1px solid var(--mis-border);\n  border-radius:14px;\n  background:rgba(255,255,255,.97);\n  box-shadow:0 7px 21px rgba(48,43,88,.04);\n}\n\n.reports-card-head {\n  display:flex;\n  align-items:center;\n  justify-content:space-between;\n  gap:10px;\n  padding:16px 17px 13px;\n  border-bottom:1px solid #eceaf4;\n}\n\n.reports-card-head > div:first-child > span {\n  display:block;\n  color:#9890aa;\n  font-size:8px;\n  font-weight:850;\n  letter-spacing:1.25px;\n}\n\n.reports-card-head h3 {\n  margin:4px 0 0;\n  color:#3b445a;\n  font-size:15px;\n}\n\n.reports-card-actions {\n  display:flex;\n  align-items:center;\n  gap:6px;\n}\n\n.reports-record-pill {\n  display:inline-flex;\n  align-items:center;\n  min-height:28px;\n  padding:0 8px;\n  border:1px solid #ddd8ee;\n  border-radius:999px;\n  background:#f5f2ff;\n  color:#6758b1;\n  font-size:7px;\n  font-weight:850;\n}\n\n.reports-table-wrap { overflow:auto; }\n\n.reports-table {\n  width:100%;\n  min-width:1080px;\n  border-collapse:collapse;\n}\n\n.reports-table th {\n  padding:11px 10px;\n  border-bottom:1px solid #e4e1ea;\n  background:#f4f2f8;\n  color:#777188;\n  font-size:8px;\n  font-weight:850;\n  text-align:left;\n  letter-spacing:.45px;\n  text-transform:uppercase;\n  white-space:nowrap;\n}\n\n.reports-table td {\n  padding:11px 10px;\n  border-bottom:1px solid #efedf3;\n  color:#687286;\n  font-size:9px;\n  white-space:nowrap;\n  vertical-align:middle;\n}\n\n.reports-table tbody tr:hover { background:#fbfaff; }\n\n.mis-status {\n  display:inline-flex;\n  align-items:center;\n  min-height:21px;\n  padding:0 7px;\n  border-radius:999px;\n  font-size:7px;\n  font-weight:850;\n}\n\n.mis-status.success {\n  color:var(--mis-green);\n  background:var(--mis-green-bg);\n  border:1px solid #bfe6d2;\n}\n\n.mis-status.warning {\n  color:var(--mis-amber);\n  background:var(--mis-amber-bg);\n  border:1px solid #edd7a9;\n}\n\n.mis-status.danger {\n  color:var(--mis-red);\n  background:var(--mis-red-bg);\n  border:1px solid #efc5cb;\n}\n\n.mis-status.neutral {\n  color:#6e7789;\n  background:#f3f2f6;\n  border:1px solid #e5e2eb;\n}\n\n.mis-money { color:#5f50ae; }\n\n.reports-empty {\n  min-height:260px;\n  display:flex;\n  flex-direction:column;\n  justify-content:center;\n  align-items:center;\n  gap:7px;\n  text-align:center;\n}\n\n.reports-empty-icon {\n  width:46px;\n  height:46px;\n  display:grid;\n  place-items:center;\n  border-radius:13px;\n  background:#f1eeff;\n  color:#695ab6;\n  font-size:18px;\n}\n\n.reports-empty strong {\n  color:#4a5368;\n  font-size:11px;\n}\n\n.reports-empty span {\n  max-width:450px;\n  color:#9ca1ae;\n  font-size:8px;\n}\n\n.reports-toast {\n  position:fixed;\n  right:22px;\n  bottom:22px;\n  z-index:3000;\n  padding:11px 14px;\n  border:1px solid #bfe6d2;\n  border-radius:10px;\n  background:#eaf9f1;\n  color:#168454;\n  font-size:9px;\n  font-weight:850;\n  box-shadow:0 12px 30px rgba(48,43,88,.12);\n}\n\n@media (max-width:1200px) {\n  .reports-command-bar { grid-template-columns:minmax(240px,1fr) repeat(3,1fr); }\n  .reports-layout { grid-template-columns:205px minmax(0,1fr); }\n  .reports-kpis { grid-template-columns:repeat(3,minmax(0,1fr)); }\n}\n\n@media (max-width:900px) {\n  .reports-page { padding:24px 20px 50px; }\n  .reports-header { align-items:flex-start; flex-direction:column; }\n  .reports-command-bar { grid-template-columns:repeat(2,minmax(0,1fr)); }\n  .reports-search,\n  .reports-reset { grid-column:1/-1; }\n  .reports-layout { grid-template-columns:1fr; }\n  .reports-sidebar { position:static; }\n}\n\n@media (max-width:650px) {\n  .reports-page { padding:18px 13px 38px; }\n  .reports-header h1 { font-size:25px; }\n  .reports-header-actions { width:100%; }\n  .reports-header-actions > * { flex:1; }\n  .reports-command-bar { grid-template-columns:1fr; }\n  .reports-search,\n  .reports-reset { grid-column:auto; }\n  .reports-title-card { align-items:flex-start; flex-direction:column; }\n  .reports-kpis { grid-template-columns:1fr 1fr; }\n  .reports-card-head { align-items:flex-start; flex-direction:column; }\n}\n\n@media print {\n  .reports-page { padding:0; background:#fff; }\n  .reports-sidebar,\n  .reports-command-bar,\n  .reports-header-actions,\n  .reports-toast { display:none !important; }\n  .reports-layout { display:block; }\n  .reports-title-card,\n  .report-kpi,\n  .reports-card { box-shadow:none; }\n}\n';

const KEYS = {
  employees: "bauerHrmsEmployees",
  recruitmentRequirements: "bauerHrmsRecruitmentRequirements",
  recruitmentCandidates: "bauerHrmsRecruitmentCandidates",
  recruitmentInterviews: "bauerHrmsRecruitmentInterviews",
  recruitmentOffers: "bauerHrmsRecruitmentOffers",
  organizationMasters: "bauerHrmsOrganizationMasters",
  attendance: [
    "bauerHrmsAttendance",
    "bauerHrmsAttendanceRecords",
    "attendanceRecords",
    "employeeAttendance",
  ],
  payroll: [
    "bauerHrmsPayroll",
    "bauerHrmsPayrollRecords",
    "payrollRecords",
    "bauerHrmsMonthlyPayroll",
    "bauerHrmsVendorPayroll",
  ],
  training: [
    "bauerHrmsTraining",
    "bauerHrmsTrainings",
    "trainingRecords",
    "bauerHrmsTrainingRecords",
  ],
  pms: {
    cycles: "bauerHrmsPmsCycles",
    eligibility: "bauerHrmsPmsEligibility",
    kras: "bauerHrmsPmsKraLibrary",
    templates: "bauerHrmsPmsTemplates",
    assignments: "bauerHrmsPmsAssignments",
    evaluations: "bauerHrmsPmsEvaluations",
  },
};

const STATUS_LABELS = {
  P: "Present",
  A: "Absent",
  EL: "Earned Leave",
  CL: "Casual Leave",
  SL: "Sick Leave",
  FL: "Force Leave",
  CO: "Comp Off",
  OD: "On Duty",
  WFH: "Work From Home",
  WO: "Weekly Off",
  HO: "Holiday",
  HD: "Half Day",
  LOP: "LOP",
};

const REPORTS = [
  {
    id: "executive",
    label: "Executive HR MIS",
    group: "Management",
    description: "Headcount, movement, attendance, hiring, payroll and performance at a glance.",
  },
  {
    id: "recruitment",
    label: "Recruitment MIS",
    group: "Talent Acquisition",
    description: "Requirement ageing, candidate funnel, interviews, offers and joining conversion.",
  },
  {
    id: "attendance",
    label: "Attendance MIS",
    group: "Workforce",
    description: "Present, absent, leave, weekly-off, overtime and attendance exceptions.",
  },
  {
    id: "payroll",
    label: "Payroll MIS",
    group: "Payroll",
    description: "Payroll processing, payable, deductions, vendor costing and exception control.",
  },
  {
    id: "employee",
    label: "Employee Master MIS",
    group: "People",
    description: "Employee population, department, location, vendor, employment and data quality.",
  },
  {
    id: "transfer",
    label: "Transfer Case MIS",
    group: "People",
    description: "Employee transfers, movement routes, effective dates, reasons and current status.",
  },
  {
    id: "leave",
    label: "Leave MIS",
    group: "Workforce",
    description: "EL, CL, SL, FL, Comp Off and leave-balance movement.",
  },
  {
    id: "vendor",
    label: "Vendor / Contractor MIS",
    group: "Third Party",
    description: "Vendor manpower, agreements, validity, active/expired and on-hold positions.",
  },
  {
    id: "training",
    label: "Training MIS",
    group: "Learning",
    description: "Training plans, scheduled/completed programmes, participants and cost.",
  },
  {
    id: "pms",
    label: "PMS MIS",
    group: "Performance",
    description: "Eligibility, KRA assignments, self/reviewer completion and final performance.",
  },
  {
    id: "organization",
    label: "Organization MIS",
    group: "Masters",
    description: "Master-data health across locations, departments, designations, shifts and more.",
  },
];

function safeJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readArray(keyList) {
  const keys = Array.isArray(keyList) ? keyList : [keyList];
  for (const key of keys) {
    const value = safeJSON(key, null);
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.records)) return value.records;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.data)) return value.data;
  }
  return [];
}

function fuzzyArray(keywords) {
  const lowered = keywords.map((k) => k.toLowerCase());
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = String(localStorage.key(i) || "").toLowerCase();
    if (!lowered.some((word) => key.includes(word))) continue;
    const value = safeJSON(localStorage.key(i), null);
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.records)) return value.records;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.data)) return value.data;
  }
  return [];
}

function fuzzyObject(keywords) {
  const lowered = keywords.map((k) => k.toLowerCase());
  for (let i = 0; i < localStorage.length; i += 1) {
    const rawKey = localStorage.key(i);
    const key = String(rawKey || "").toLowerCase();
    if (!lowered.some((word) => key.includes(word))) continue;
    const value = safeJSON(rawKey, null);
    if (value && !Array.isArray(value) && typeof value === "object") return value;
  }
  return {};
}

function firstDefined(obj, keys, fallback = "") {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function nameOf(e) {
  return firstDefined(e, ["name", "employeeName", "fullName"], "—");
}

function codeOf(e) {
  return String(firstDefined(e, ["employeeCode", "empCode", "employeeId", "id"], "—"));
}

function deptOf(e) {
  return firstDefined(e, ["department", "departmentName"], "—");
}

function dateOf(e) {
  return firstDefined(e, ["date", "attendanceDate", "workDate", "createdAt"], "");
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
  const d = toDate(value);
  if (!d) return value || "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value || "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function sum(list, getter) {
  return list.reduce((total, item) => {
    const value = Number(getter(item));
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function percent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportRows(title, rows, columns) {
  const workbook = XLSX.utils.book_new();
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.label, row[column.key] ?? ""]))
  );

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, ws, title.slice(0, 31));
  XLSX.writeFile(
    workbook,
    `BAUER_${title.replace(/[^a-z0-9]+/gi, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`
  );
}

function printReport() {
  window.print();
}

function getAttendanceRecords(employees) {
  const direct = readArray(KEYS.attendance);
  if (direct.length) return direct;

  const nested = fuzzyArray(["attendance", "biomax", "timesheet", "daily"]);
  if (nested.length) return nested;

  // Support employee-level embedded attendance/history if present.
  return employees.flatMap((employee) => {
    const records =
      employee.attendance ||
      employee.attendanceRecords ||
      employee.dailyAttendance ||
      employee.attendanceHistory ||
      [];
    return Array.isArray(records)
      ? records.map((record) => ({
          ...record,
          employeeId: record.employeeId || employee.employeeId || employee.id,
          employeeName: record.employeeName || employee.name,
          department: record.department || employee.department,
          location: record.location || employee.location,
          vendor: record.vendor || employee.vendor,
        }))
      : [];
  });
}

function normalizeAttendance(records, employees) {
  return records.map((row) => {
    const employee =
      employees.find(
        (e) =>
          String(e.id ?? e.employeeId ?? e.employeeCode) ===
          String(row.employeeId ?? row.empId ?? row.employeeCode)
      ) || {};

    const status = String(
      firstDefined(row, ["status", "attendance", "code"], "")
    ).toUpperCase();

    return {
      date: dateOf(row),
      employeeId: codeOf({ ...employee, ...row }),
      employeeName: nameOf({ ...employee, ...row }),
      department: firstDefined(row, ["department"], deptOf(employee)),
      location: firstDefined(row, ["location", "site"], employee.location || employee.site || "—"),
      vendor: firstDefined(row, ["vendor"], employee.vendor || "—"),
      shift: firstDefined(row, ["shift"], employee.shift || "—"),
      status: status || "—",
      statusLabel: STATUS_LABELS[status] || firstDefined(row, ["status"], "—"),
      inTime: firstDefined(row, ["inTime", "checkIn", "punchIn"], "—"),
      outTime: firstDefined(row, ["outTime", "checkOut", "punchOut"], "—"),
      workingHours: firstDefined(row, ["workingHours", "hours", "workHours"], "—"),
      otHours: firstDefined(row, ["otHours", "overtime", "ot"], "0"),
      remarks: firstDefined(row, ["remarks", "remark", "comment"], ""),
    };
  });
}

function getPayrollRecords() {
  const direct = readArray(KEYS.payroll);
  return direct.length ? direct : fuzzyArray(["payroll", "salary", "payslip"]);
}

function normalizePayroll(records, employees) {
  return records.map((row) => {
    const employee =
      employees.find(
        (e) =>
          String(e.id ?? e.employeeId ?? e.employeeCode) ===
          String(row.employeeId ?? row.empId ?? row.employeeCode)
      ) || {};

    return {
      month: firstDefined(row, ["month", "payrollMonth", "period"], "—"),
      employeeId: codeOf({ ...employee, ...row }),
      employeeName: nameOf({ ...employee, ...row }),
      department: firstDefined(row, ["department"], deptOf(employee)),
      vendor: firstDefined(row, ["vendor"], employee.vendor || "—"),
      gross: firstDefined(row, ["gross", "grossSalary", "totalGross"], 0),
      net: firstDefined(row, ["net", "netPayable", "netSalary"], 0),
      deductions: firstDefined(row, ["deductions", "totalDeductions"], 0),
      paidDays: firstDefined(row, ["paidDays", "payableDays"], 0),
      ot: firstDefined(row, ["ot", "otAmount", "overtimeAmount"], 0),
      status: firstDefined(row, ["status", "payrollStatus"], "—"),
    };
  });
}

function getTrainingRecords() {
  const direct = readArray(KEYS.training);
  return direct.length ? direct : fuzzyArray(["training", "learning", "development"]);
}

function normalizeTraining(records) {
  return records.map((row) => ({
    programme: firstDefined(row, ["programme", "trainingName", "title", "name"], "—"),
    date: firstDefined(row, ["date", "trainingDate", "startDate"], ""),
    department: firstDefined(row, ["department", "departmentName"], "—"),
    trainer: firstDefined(row, ["trainer", "trainerName"], "—"),
    participants: firstDefined(row, ["participants", "participantCount", "plannedParticipants"], 0),
    hours: firstDefined(row, ["hours", "trainingHours", "duration"], 0),
    cost: firstDefined(row, ["cost", "plannedCost", "actualCost"], 0),
    status: firstDefined(row, ["status", "trainingStatus"], "—"),
  }));
}

function pmsRows() {
  const eligibility = readArray(KEYS.pms.eligibility);
  const assignments = readArray(KEYS.pms.assignments);
  const evaluations = readArray(KEYS.pms.evaluations);
  const employees = readArray(KEYS.employees);

  return assignments.map((assignment) => {
    const employee =
      employees.find(
        (e) =>
          String(e.id ?? e.employeeId ?? e.employeeCode) ===
          String(assignment.employeeId)
      ) || {};

    const eligible = eligibility.find(
      (item) =>
        String(item.employeeId) === String(assignment.employeeId)
    );

    const self = evaluations.find(
      (item) =>
        String(item.employeeId) === String(assignment.employeeId) &&
        item.role === "self"
    );
    const r1 = evaluations.find(
      (item) =>
        String(item.employeeId) === String(assignment.employeeId) &&
        item.role === "reviewer1"
    );
    const r2 = evaluations.find(
      (item) =>
        String(item.employeeId) === String(assignment.employeeId) &&
        item.role === "reviewer2"
    );

    return {
      employeeId: codeOf(employee),
      employeeName: nameOf(employee),
      department: deptOf(employee),
      eligibility: eligible?.decision || (eligible ? "Eligible" : "System"),
      selfScore: self?.score ?? assignment.selfScore ?? "",
      reviewer1Score: r1?.score ?? assignment.reviewer1Score ?? "",
      reviewer2Score: r2?.score ?? assignment.reviewer2Score ?? "",
      finalScore: assignment.finalScore ?? "",
      finalBand: assignment.finalBand ?? "",
      selfStatus: assignment.selfStatus || "Pending",
      reviewer1Status: assignment.reviewer1Status || "Pending",
      reviewer2Status: assignment.reviewer2Status || "Pending",
    };
  });
}

function organizationRows() {
  const masters = safeJSON(KEYS.organizationMasters, {});
  const definitions = [
    ["locations", "Zone / Location"],
    ["employeeGroups", "Employee Group"],
    ["shifts", "Shift"],
    ["branches", "Branch"],
    ["designations", "Designation"],
    ["employmentTypes", "Employment Type"],
    ["departments", "Department"],
    ["jobRoles", "Job Role / Vendor"],
    ["jobTypes", "Job Type"],
  ];

  return definitions.flatMap(([key, label]) =>
    (masters?.[key] || []).map((item, index) => ({
      master: label,
      name: typeof item === "string" ? item : item.name || item.label || `Record ${index + 1}`,
      status: typeof item === "string" ? "Active" : item.active === false ? "Inactive" : "Active",
    }))
  );
}

function vendorRows() {
  const agreements = readArray("bauerHrmsVendorAgreements");
  const employees = readArray(KEYS.employees);
  const vendorNameSet = new Set(
    employees.map((e) => e.vendor).filter((v) => v && v !== "-")
  );

  const rows = agreements.map((agreement) => ({
    vendor: firstDefined(agreement, ["vendor", "vendorName", "name"], "—"),
    agreementNo: firstDefined(agreement, ["agreementNo", "agreementNumber", "code"], "—"),
    location: firstDefined(agreement, ["location", "site"], "—"),
    startDate: firstDefined(agreement, ["startDate", "validFrom"], ""),
    endDate: firstDefined(agreement, ["endDate", "validTo", "expiryDate"], ""),
    status: firstDefined(agreement, ["status"], "—"),
    serviceCharge: firstDefined(agreement, ["serviceCharge", "charge"], ""),
  }));

  if (rows.length) return rows;

  return [...vendorNameSet].map((vendor) => ({
    vendor,
    agreementNo: "—",
    location: "—",
    startDate: "",
    endDate: "",
    status: "Active",
    serviceCharge: "—",
  }));
}

function employeeRows(employees) {
  return employees.map((employee) => ({
    employeeId: codeOf(employee),
    employeeName: nameOf(employee),
    department: deptOf(employee),
    designation: firstDefined(employee, ["designation"], "—"),
    location: firstDefined(employee, ["location", "site"], "—"),
    vendor: firstDefined(employee, ["vendor"], "—"),
    employeeGroup: firstDefined(employee, ["employeeGroup", "group"], "—"),
    employmentType: firstDefined(employee, ["employmentType", "type"], "—"),
    doj: firstDefined(employee, ["doj", "dateOfJoining", "joiningDate"], ""),
    status: firstDefined(employee, ["status"], "Active"),
  }));
}

function transferRows(employees) {
  return employees.flatMap((employee) =>
    (Array.isArray(employee.transferHistory) ? employee.transferHistory : []).map(
      (transfer, index) => ({
        transferId: `${codeOf(employee)}-T${index + 1}`,
        employeeId: codeOf(employee),
        employeeName: nameOf(employee),
        department: deptOf(employee),
        date: transfer.date || "",
        fromLocation: transfer.fromLocation || "—",
        toLocation: transfer.toLocation || "—",
        reason: transfer.reason || "—",
        status: transfer.status || "Completed",
      })
    )
  );
}

function leaveRows(employees, attendance) {
  const direct = fuzzyArray(["leave", "leaveRequest", "leaveHistory"]);
  if (direct.length) {
    return direct.map((row) => ({
      date: firstDefined(row, ["date", "fromDate", "startDate"], ""),
      employeeId: firstDefined(row, ["employeeId", "empId"], "—"),
      employeeName: firstDefined(row, ["employeeName", "name"], "—"),
      department: firstDefined(row, ["department"], "—"),
      type: firstDefined(row, ["leaveType", "type", "code"], "—"),
      days: firstDefined(row, ["days", "totalDays"], 0),
      status: firstDefined(row, ["status"], "—"),
      reason: firstDefined(row, ["reason", "remarks"], ""),
    }));
  }

  return attendance
    .filter((row) =>
      ["EL", "CL", "SL", "FL", "CO"].includes(row.status)
    )
    .map((row) => ({
      date: row.date,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      department: row.department,
      type: row.status,
      days: 1,
      status: "Recorded",
      reason: row.remarks,
    }));
}

function recruitmentRows() {
  const requirements = readArray(KEYS.recruitmentRequirements);
  const candidates = readArray(KEYS.recruitmentCandidates);
  const interviews = readArray(KEYS.recruitmentInterviews);
  const offers = readArray(KEYS.recruitmentOffers);

  const requirementMap = new Map(
    requirements.map((r) => [String(r.id ?? r.reqId ?? r.requirementId), r])
  );

  return candidates.map((candidate) => {
    const requirement = requirementMap.get(
      String(candidate.requirementId ?? candidate.reqId ?? "")
    ) || {};

    const interview = interviews.find(
      (item) =>
        String(item.candidateId ?? item.candidate_id) ===
        String(candidate.id ?? candidate.candidateId)
    );

    const offer = offers.find(
      (item) =>
        String(item.candidateId ?? item.candidate_id) ===
        String(candidate.id ?? candidate.candidateId)
    );

    return {
      requirement: firstDefined(requirement, ["title", "requirementName", "designation"], "—"),
      candidateId: firstDefined(candidate, ["id", "candidateId"], "—"),
      candidateName: firstDefined(candidate, ["name", "candidateName"], "—"),
      designation: firstDefined(candidate, ["currentDesignation", "designation"], "—"),
      experience: firstDefined(candidate, ["totalExperience", "experience"], "—"),
      source: firstDefined(candidate, ["source"], "—"),
      recruiter: firstDefined(candidate, ["recruiter"], "—"),
      stage: firstDefined(candidate, ["stage", "status"], "—"),
      interview: interview ? firstDefined(interview, ["status"], "Scheduled") : "—",
      offer: offer ? firstDefined(offer, ["status"], "Issued") : "—",
    };
  });
}

function useLiveStorageVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("bauerHrmsRecruitmentUpdated", refresh);
    window.addEventListener("bauerHrmsPmsUpdated", refresh);
    window.addEventListener("bauerHrmsEmployeesUpdated", refresh);
    window.addEventListener("bauerHrmsAttendanceUpdated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bauerHrmsRecruitmentUpdated", refresh);
      window.removeEventListener("bauerHrmsPmsUpdated", refresh);
      window.removeEventListener("bauerHrmsEmployeesUpdated", refresh);
      window.removeEventListener("bauerHrmsAttendanceUpdated", refresh);
    };
  }, []);
  return version;
}

export default function Reports() {
  const liveVersion = useLiveStorageVersion();
  const [activeReport, setActiveReport] = useState("executive");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [location, setLocation] = useState("All");
  const [status, setStatus] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState("");

  const employees = useMemo(() => readArray(KEYS.employees), [liveVersion]);
  const attendance = useMemo(
    () => normalizeAttendance(getAttendanceRecords(employees), employees),
    [employees, liveVersion]
  );
  const payroll = useMemo(
    () => normalizePayroll(getPayrollRecords(), employees),
    [employees, liveVersion]
  );
  const training = useMemo(
    () => normalizeTraining(getTrainingRecords()),
    [liveVersion]
  );
  const recruitment = useMemo(() => recruitmentRows(), [liveVersion]);
  const transfers = useMemo(() => transferRows(employees), [employees, liveVersion]);
  const leave = useMemo(
    () => leaveRows(employees, attendance),
    [employees, attendance]
  );
  const vendors = useMemo(() => vendorRows(), [liveVersion]);
  const pms = useMemo(() => pmsRows(), [liveVersion]);
  const organization = useMemo(() => organizationRows(), [liveVersion]);

  const departments = useMemo(() => {
    const source = [
      ...employees.map(deptOf),
      ...attendance.map((r) => r.department),
      ...payroll.map((r) => r.department),
      ...training.map((r) => r.department),
      ...recruitment.map((r) => r.department),
      ...pms.map((r) => r.department),
    ];
    return ["All", ...new Set(source.filter((v) => v && v !== "—"))];
  }, [employees, attendance, payroll, training, recruitment, pms]);

  const locations = useMemo(
    () => ["All", ...new Set(employees.map((e) => firstDefined(e, ["location", "site"], "")).filter(Boolean))],
    [employees]
  );

  const definitions = {
    executive: useMemo(
      () => executiveRows({
        employees,
        attendance,
        recruitment,
        payroll,
        pms,
        transfers,
      }),
      [employees, attendance, recruitment, payroll, pms, transfers]
    ),
    recruitment: {
      columns: [
        ["requirement", "Requirement"],
        ["candidateId", "Candidate ID"],
        ["candidateName", "Candidate"],
        ["designation", "Designation"],
        ["experience", "Experience"],
        ["source", "Source"],
        ["recruiter", "Recruiter"],
        ["stage", "Stage"],
        ["interview", "Interview"],
        ["offer", "Offer"],
      ],
      rows: recruitment,
      title: "Recruitment MIS",
      kpis: recruitmentKpis(recruitment),
    },
    attendance: {
      columns: [
        ["date", "Date"],
        ["employeeId", "Employee ID"],
        ["employeeName", "Employee"],
        ["department", "Department"],
        ["location", "Location"],
        ["vendor", "Vendor"],
        ["shift", "Shift"],
        ["statusLabel", "Status"],
        ["inTime", "In Time"],
        ["outTime", "Out Time"],
        ["workingHours", "Working Hours"],
        ["otHours", "OT Hours"],
        ["remarks", "Remarks"],
      ],
      rows: attendance,
      title: "Attendance MIS",
      kpis: attendanceKpis(attendance),
    },
    payroll: {
      columns: [
        ["month", "Month"],
        ["employeeId", "Employee ID"],
        ["employeeName", "Employee"],
        ["department", "Department"],
        ["vendor", "Vendor"],
        ["gross", "Gross"],
        ["deductions", "Deductions"],
        ["net", "Net Payable"],
        ["paidDays", "Paid Days"],
        ["ot", "OT"],
        ["status", "Status"],
      ],
      rows: payroll,
      title: "Payroll MIS",
      kpis: payrollKpis(payroll),
    },
    employee: {
      columns: [
        ["employeeId", "Employee ID"],
        ["employeeName", "Employee"],
        ["department", "Department"],
        ["designation", "Designation"],
        ["location", "Location"],
        ["vendor", "Vendor"],
        ["employeeGroup", "Employee Group"],
        ["employmentType", "Employment Type"],
        ["doj", "DOJ"],
        ["status", "Status"],
      ],
      rows: employeeRows(employees),
      title: "Employee Master MIS",
      kpis: employeeKpis(employees),
    },
    transfer: {
      columns: [
        ["transferId", "Transfer ID"],
        ["employeeId", "Employee ID"],
        ["employeeName", "Employee"],
        ["department", "Department"],
        ["date", "Transfer Date"],
        ["fromLocation", "From"],
        ["toLocation", "To"],
        ["reason", "Reason"],
        ["status", "Status"],
      ],
      rows: transfers,
      title: "Transfer Case MIS",
      kpis: transferKpis(transfers),
    },
    leave: {
      columns: [
        ["date", "Date"],
        ["employeeId", "Employee ID"],
        ["employeeName", "Employee"],
        ["department", "Department"],
        ["type", "Leave Type"],
        ["days", "Days"],
        ["status", "Status"],
        ["reason", "Reason"],
      ],
      rows: leave,
      title: "Leave MIS",
      kpis: leaveKpis(leave),
    },
    vendor: {
      columns: [
        ["vendor", "Vendor"],
        ["agreementNo", "Agreement No."],
        ["location", "Location"],
        ["startDate", "Start Date"],
        ["endDate", "Expiry Date"],
        ["status", "Status"],
        ["serviceCharge", "Service Charge"],
      ],
      rows: vendors,
      title: "Vendor / Contractor MIS",
      kpis: vendorKpis(vendors),
    },
    training: {
      columns: [
        ["programme", "Programme"],
        ["date", "Date"],
        ["department", "Department"],
        ["trainer", "Trainer"],
        ["participants", "Participants"],
        ["hours", "Hours"],
        ["cost", "Cost"],
        ["status", "Status"],
      ],
      rows: training,
      title: "Training MIS",
      kpis: trainingKpis(training),
    },
    pms: {
      columns: [
        ["employeeId", "Employee ID"],
        ["employeeName", "Employee"],
        ["department", "Department"],
        ["eligibility", "Eligibility"],
        ["selfScore", "Self"],
        ["reviewer1Score", "Reviewer 1"],
        ["reviewer2Score", "Reviewer 2"],
        ["finalScore", "Final"],
        ["finalBand", "Band"],
        ["selfStatus", "Self Status"],
        ["reviewer1Status", "R1 Status"],
        ["reviewer2Status", "R2 Status"],
      ],
      rows: pms,
      title: "PMS MIS",
      kpis: pmsKpis(pms),
    },
    organization: {
      columns: [
        ["master", "Master"],
        ["name", "Value"],
        ["status", "Status"],
      ],
      rows: organization,
      title: "Organization Master MIS",
      kpis: organizationKpis(organization),
    },
  };

  const activeDefinition = definitions[activeReport];

  const filteredRows = useMemo(() => {
    const rows = activeDefinition.rows || [];
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const textMatch =
        !q ||
        Object.values(row)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const departmentValue = String(
        row.department ?? row.Department ?? ""
      );
      const locationValue = String(
        row.location ?? row.Location ?? ""
      );
      const statusValue = String(
        row.status ?? row.Status ?? row.statusLabel ?? ""
      );

      const dateValue = firstDefined(row, ["date", "month", "doj", "startDate", "transferDate"], "");
      const parsedDate = toDate(dateValue);
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

      return (
        textMatch &&
        (department === "All" || departmentValue === department) &&
        (location === "All" || locationValue === location) &&
        (status === "All" || statusValue.toLowerCase() === status.toLowerCase()) &&
        (!from || !parsedDate || parsedDate >= from) &&
        (!to || !parsedDate || parsedDate <= to)
      );
    });
  }, [
    activeDefinition,
    query,
    department,
    location,
    status,
    dateFrom,
    dateTo,
  ]);

  const statusOptions = useMemo(() => {
    const values = filteredRows
      .map((row) => String(row.status ?? row.Status ?? row.statusLabel ?? ""))
      .filter(Boolean);
    return ["All", ...new Set(values)];
  }, [filteredRows]);

  useEffect(() => {
    setStatus("All");
  }, [activeReport]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function downloadCurrent() {
    const columns = activeDefinition.columns;
    exportRows(
      activeDefinition.title,
      filteredRows,
      columns.map(([key, label]) => ({ key, label }))
    );
    showToast(`${activeDefinition.title} exported successfully.`);
  }

  function clearFilters() {
    setQuery("");
    setDepartment("All");
    setLocation("All");
    setStatus("All");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="reports-page">
      <style dangerouslySetInnerHTML={{ __html: REPORTS_EMBEDDED_CSS }} />
      <header className="reports-header">
        <div>
          <span className="reports-eyebrow">HR CONTROL TOWER • MIS</span>
          <h1>Reports & MIS</h1>
          <p>
            One reporting workspace for workforce, attendance, payroll, hiring,
            transfers, learning and performance.
          </p>
        </div>

        <div className="reports-header-actions">
          <button className="reports-secondary" onClick={printReport}>
            Print
          </button>
          <button className="reports-primary" onClick={downloadCurrent}>
            ↓ Export Excel
          </button>
        </div>
      </header>

      <section className="reports-command-bar">
        <div className="reports-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${activeDefinition.title.toLowerCase()}...`}
          />
        </div>

        <select value={department} onChange={(e) => setDepartment(e.target.value)}>
          {departments.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          {locations.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {statusOptions.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
        />

        <button className="reports-reset" onClick={clearFilters}>
          Reset
        </button>
      </section>

      <div className="reports-layout">
        <aside className="reports-sidebar">
          <div className="reports-sidebar-label">REPORT LIBRARY</div>

          {[
            "Management",
            "People",
            "Workforce",
            "Payroll",
            "Talent Acquisition",
            "Third Party",
            "Learning",
            "Performance",
            "Masters",
          ].map((group) => {
            const items = REPORTS.filter((report) => report.group === group);
            if (!items.length) return null;

            return (
              <div key={group} className="reports-group">
                <span>{group}</span>
                {items.map((report) => (
                  <button
                    key={report.id}
                    className={activeReport === report.id ? "active" : ""}
                    onClick={() => setActiveReport(report.id)}
                  >
                    <i />
                    {report.label}
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        <main className="reports-main">
          <section className="reports-title-card">
            <div>
              <span>MIS REPORT</span>
              <h2>{activeDefinition.title}</h2>
              <p>{REPORTS.find((item) => item.id === activeReport)?.description}</p>
            </div>

            <div className="reports-meta">
              <strong>{filteredRows.length}</strong>
              <span>records in view</span>
            </div>
          </section>

          <section className="reports-kpis">
            {activeDefinition.kpis.map((kpi) => (
              <div key={kpi.label} className={`report-kpi ${kpi.tone || "purple"}`}>
                <small>{kpi.label}</small>
                <strong>{kpi.value}</strong>
                {kpi.sub && <span>{kpi.sub}</span>}
              </div>
            ))}
          </section>

          <section className="reports-card">
            <div className="reports-card-head">
              <div>
                <span>REPORT DATA</span>
                <h3>{activeDefinition.title} Register</h3>
              </div>

              <div className="reports-card-actions">
                <span className="reports-record-pill">
                  {filteredRows.length} rows
                </span>
                <button className="reports-secondary small" onClick={downloadCurrent}>
                  Export
                </button>
              </div>
            </div>

            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {activeDefinition.columns.map(([key, label]) => (
                      <th key={key}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? (
                    filteredRows.map((row, index) => (
                      <tr key={`${activeReport}-${index}`}>
                        <td>{index + 1}</td>
                        {activeDefinition.columns.map(([key]) => (
                          <td key={key}>
                            <ReportCell reportId={activeReport} keyName={key} value={row[key]} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={activeDefinition.columns.length + 1}>
                        <div className="reports-empty">
                          <div className="reports-empty-icon">◌</div>
                          <strong>No report records found</strong>
                          <span>
                            Add module data or change the current filters to populate this MIS.
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {toast && <div className="reports-toast">{toast}</div>}
    </div>
  );
}

function ReportCell({ reportId, keyName, value }) {
  if (
    ["status", "statusLabel", "stage", "offer", "interview", "selfStatus", "reviewer1Status", "reviewer2Status", "eligibility"].includes(
      keyName
    )
  ) {
    const normalized = String(value || "").toLowerCase();

    let tone = "neutral";
    if (
      /active|complete|completed|joined|present|approved|on track|eligible|issued|published/.test(
        normalized
      )
    ) {
      tone = "success";
    } else if (
      /pending|scheduled|planned|draft|review|in progress|warning/.test(
        normalized
      )
    ) {
      tone = "warning";
    } else if (
      /absent|expired|cancelled|rejected|overdue|inactive|danger|excluded/.test(
        normalized
      )
    ) {
      tone = "danger";
    }

    return <span className={`report-status ${tone}`}>{value || "—"}</span>;
  }

  if (
    ["gross", "net", "deductions", "ot", "cost", "serviceCharge"].includes(keyName)
  ) {
    return <strong className="report-money">{fmtMoney(value)}</strong>;
  }

  if (
    ["date", "startDate", "endDate", "doj"].includes(keyName)
  ) {
    return fmtDate(value);
  }

  if (["selfScore", "reviewer1Score", "reviewer2Score", "finalScore"].includes(keyName)) {
    return value === "" || value === null || value === undefined
      ? "—"
      : `${Number(value).toFixed(2)}/5`;
  }

  return value === "" || value === null || value === undefined ? "—" : String(value);
}

function executiveRows({ employees, attendance, recruitment, payroll, pms, transfers }) {
  const byDept = new Map();

  employees.forEach((employee) => {
    const dept = deptOf(employee);
    if (!byDept.has(dept)) {
      byDept.set(dept, {
        department: dept,
        headcount: 0,
        present: 0,
        absent: 0,
        hiringCandidates: 0,
        payrollNet: 0,
        transfers: 0,
        avgPerformance: 0,
        pmsCount: 0,
      });
    }
    byDept.get(dept).headcount += 1;
  });

  attendance.forEach((row) => {
    const item = byDept.get(row.department);
    if (!item) return;
    if (row.status === "P") item.present += 1;
    if (row.status === "A") item.absent += 1;
  });

  recruitment.forEach((row) => {
    const item = byDept.get(row.department) || byDept.get("—");
    if (item) item.hiringCandidates += 1;
  });

  payroll.forEach((row) => {
    const item = byDept.get(row.department);
    if (!item) return;
    item.payrollNet += Number(row.net) || 0;
  });

  transfers.forEach((row) => {
    const item = byDept.get(row.department);
    if (item) item.transfers += 1;
  });

  pms.forEach((row) => {
    const item = byDept.get(row.department);
    if (!item || !row.finalScore) return;
    item.avgPerformance += Number(row.finalScore);
    item.pmsCount += 1;
  });

  return {
    columns: [
      ["department", "Department"],
      ["headcount", "Headcount"],
      ["present", "Present"],
      ["absent", "Absent"],
      ["hiringCandidates", "Recruitment Candidates"],
      ["payrollNet", "Net Payroll"],
      ["transfers", "Transfers"],
      ["avgPerformance", "Avg PMS Rating"],
    ],
    rows: [...byDept.values()].map((row) => ({
      ...row,
      avgPerformance: row.pmsCount
        ? Number((row.avgPerformance / row.pmsCount).toFixed(2))
        : "—",
    })),
    title: "Executive HR MIS",
    kpis: [
      { label: "Active Workforce", value: employees.length, sub: "Employee Master", tone: "blue" },
      { label: "Attendance Records", value: attendance.length, sub: "Available records", tone: "green" },
      { label: "Recruitment Candidates", value: recruitment.length, sub: "Current pipeline", tone: "purple" },
      { label: "Payroll Records", value: payroll.length, sub: "Loaded records", tone: "amber" },
      { label: "Transfer Cases", value: transfers.length, sub: "Movement history", tone: "blue" },
      {
        label: "PMS Finalized",
        value: pms.filter((r) => r.finalScore !== "").length,
        sub: "Final score available",
        tone: "green",
      },
    ],
  };
}

function kpi(label, value, sub, tone) {
  return { label, value, sub, tone };
}

function recruitmentKpis(rows) {
  return [
    kpi("Candidates", rows.length, "Candidate records", "blue"),
    kpi("Interviewed", rows.filter((r) => r.interview !== "—").length, "Interview records", "purple"),
    kpi("Offers", rows.filter((r) => r.offer !== "—").length, "Offer pipeline", "amber"),
    kpi("Selected / Joined", rows.filter((r) => /selected|joined/i.test(r.stage || "")).length, "Conversion pipeline", "green"),
  ];
}

function attendanceKpis(rows) {
  const count = (code) => rows.filter((r) => r.status === code).length;
  return [
    kpi("Present", count("P"), "Attendance", "green"),
    kpi("Absent", count("A"), "Exception", "danger"),
    kpi("Leave", rows.filter((r) => ["EL", "CL", "SL", "FL", "CO"].includes(r.status)).length, "Leave / comp-off", "purple"),
    kpi("Weekly Off", count("WO"), "Scheduled WO", "amber"),
    kpi("OT Hours", sum(rows, (r) => r.otHours), "Overtime", "blue"),
  ];
}

function payrollKpis(rows) {
  return [
    kpi("Payroll Records", rows.length, "Loaded", "blue"),
    kpi("Gross", fmtMoney(sum(rows, (r) => r.gross)), "Total gross", "purple"),
    kpi("Deductions", fmtMoney(sum(rows, (r) => r.deductions)), "Total deductions", "danger"),
    kpi("Net Payable", fmtMoney(sum(rows, (r) => r.net)), "Total net", "green"),
    kpi("Paid Days", sum(rows, (r) => r.paidDays), "Across records", "amber"),
  ];
}

function employeeKpis(rows) {
  return [
    kpi("Employees", rows.length, "Master records", "blue"),
    kpi("Active", rows.filter((r) => String(r.status).toLowerCase() === "active").length, "Current workforce", "green"),
    kpi("Departments", new Set(rows.map((r) => r.department)).size, "Covered", "purple"),
    kpi("Locations", new Set(rows.map((r) => r.location)).size, "Covered", "blue"),
  ];
}

function transferKpis(rows) {
  return [
    kpi("Transfers", rows.length, "Movement cases", "purple"),
    kpi("Employees Moved", new Set(rows.map((r) => r.employeeId)).size, "Unique employees", "blue"),
    kpi("Routes", new Set(rows.map((r) => `${r.fromLocation}→${r.toLocation}`)).size, "Unique movement routes", "amber"),
    kpi("Completed", rows.filter((r) => /complete/i.test(r.status || "")).length, "Closed cases", "green"),
  ];
}

function leaveKpis(rows) {
  return [
    kpi("Leave Records", rows.length, "Requests / attendance", "purple"),
    kpi("EL", rows.filter((r) => r.type === "EL").length, "Earned Leave", "blue"),
    kpi("CL", rows.filter((r) => r.type === "CL").length, "Casual Leave", "green"),
    kpi("SL / FL", rows.filter((r) => ["SL", "FL"].includes(r.type)).length, "Sick / Force", "danger"),
    kpi("Comp Off", rows.filter((r) => r.type === "CO").length, "Separate balance stream", "amber"),
  ];
}

function vendorKpis(rows) {
  return [
    kpi("Vendor Records", rows.length, "Agreements / vendors", "blue"),
    kpi("Active", rows.filter((r) => /active/i.test(r.status || "")).length, "Current", "green"),
    kpi("Expired", rows.filter((r) => /expired/i.test(r.status || "")).length, "Attention", "danger"),
    kpi("Expiring / Hold", rows.filter((r) => /expir|hold/i.test(r.status || "")).length, "Control queue", "amber"),
  ];
}

function trainingKpis(rows) {
  return [
    kpi("Training Records", rows.length, "Programmes", "purple"),
    kpi("Completed", rows.filter((r) => /complete/i.test(r.status || "")).length, "Delivered", "green"),
    kpi("Upcoming", rows.filter((r) => /upcoming|planned|scheduled/i.test(r.status || "")).length, "Future", "blue"),
    kpi("Participants", sum(rows, (r) => r.participants), "Planned / recorded", "amber"),
    kpi("Training Cost", fmtMoney(sum(rows, (r) => r.cost)), "Loaded cost", "purple"),
  ];
}

function pmsKpis(rows) {
  const avgValues = rows
    .map((r) => Number(r.finalScore))
    .filter((value) => Number.isFinite(value));

  const avg = avgValues.length
    ? Number((avgValues.reduce((a, b) => a + b, 0) / avgValues.length).toFixed(2))
    : 0;

  return [
    kpi("Assignments", rows.length, "PMS population", "purple"),
    kpi("Self Submitted", rows.filter((r) => /submitted/i.test(r.selfStatus)).length, "Employee stage", "green"),
    kpi("Reviewer 1", rows.filter((r) => /submitted/i.test(r.reviewer1Status)).length, "HOD stage", "blue"),
    kpi("Reviewer 2", rows.filter((r) => /submitted/i.test(r.reviewer2Status)).length, "MD stage", "amber"),
    kpi("Average Final", avg ? `${avg}/5` : "—", "Finalized records", "purple"),
  ];
}

function organizationKpis(rows) {
  return [
    kpi("Master Entries", rows.length, "Organization master", "blue"),
    kpi("Active", rows.filter((r) => r.status === "Active").length, "Enabled", "green"),
    kpi("Inactive", rows.filter((r) => r.status !== "Active").length, "Needs review", "amber"),
    kpi("Master Types", new Set(rows.map((r) => r.master)).size, "Configured", "purple"),
  ];
}
