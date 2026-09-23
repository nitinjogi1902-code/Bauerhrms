import { useMemo, useState } from "react";
import "./Organization.css";
const STORAGE_KEY = "bauerHrmsOrganizationMasters";


const MASTER_ICON_PATHS = {
  locations: (
    <>
      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  employeeGroups: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 20c.7-3.4 2.6-5 5.5-5s4.8 1.6 5.5 5" />
      <path d="M14 15.5c2.6-.1 4.4 1.2 5 3.8" />
    </>
  ),
  statutoryPolicies: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
      <path d="M4 7h2M18 7h2" />
    </>
  ),
  salaryRules: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="M8 10h8M8 14h5" />
      <circle cx="17" cy="14" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  prorationRules: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h5M8 17h8" />
      <path d="M16 15v4M14 17h4" />
    </>
  ),
  payrollProfiles: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 5V3h8v2M8 10h8M8 14h5" />
    </>
  ),
  workforceCategories: (
    <>
      <path d="M4 7.5h16M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M8 11h8M8 15h5" />
      <circle cx="8" cy="11" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  deductionPolicies: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="M8 10h8M8 14h5" />
      <path d="M17 4v4M15 6h4" />
    </>
  ),
  otPolicies: (
    <>
      <path d="M12 3v18" />
      <path d="M5 7h14M7 7l-2 5a3 3 0 0 0 6 0L9 7M15 7l-2 5a3 3 0 0 0 6 0l-2-5" />
      <path d="M8 21h8" />
    </>
  ),
  shifts: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
      <path d="M4 5.5 2.8 4.3M20 5.5l1.2-1.2" />
    </>
  ),
  branches: (
    <>
      <path d="M5 20V6h14v14" />
      <path d="M8 9h2M14 9h2M8 13h2M14 13h2M8 17h2M14 17h2" />
      <path d="M3 20h18" />
    </>
  ),
  designations: (
    <>
      <path d="M12 3 14 8l5 .4-3.8 3.2 1.2 5.1L12 14l-4.4 2.7 1.2-5.1L5 8.4 10 8l2-5Z" />
      <path d="M8 20h8M10 17.5h4" />
    </>
  ),
  employmentTypes: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M9 5V3h6v2M8 10h8M8 14h5" />
    </>
  ),
  departments: (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-2h12v2" />
    </>
  ),
  jobRoles: (
    <>
      <path d="M5 7h14v12H5z" />
      <path d="M8 7V5h8v2M8 11h8M8 15h5" />
    </>
  ),
  jobTypes: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  leavePolicies: (
    <>
      <path d="M7 3v3M17 3v3M4 9h16" />
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 13h3M13 13h3M8 16h3" />
    </>
  ),
  holidays: (
    <>
      <path d="M7 3v4M17 3v4M4 9h16" />
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 13h3M13 13h3M8 16h3M13 16h3" />
    </>
  ),
  payrollCalendars: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M7 3v4M17 3v4M3.5 9h17" />
      <path d="M8 13h3M13 13h3M8 16h3M13 16h3" />
    </>
  ),
  weekOffPolicies: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M7 3v4M17 3v4M3.5 9h17" />
      <path d="M8 13h3M13 13h3M8 16h3" />
    </>
  ),
};

function MasterIcon({ type, size = 19 }) {
  return (
    <svg
      className="master-svg-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {MASTER_ICON_PATHS[type] || MASTER_ICON_PATHS.jobTypes}
    </svg>
  );
}

const MASTER_CONFIG = [
  {
    key: "locations",
    label: "Zone / Location",
    singular: "Location",
    description: "Manage Bauer offices, yards, project sites and other workforce locations.",
    placeholder: "e.g. Gurgaon HO",
  },
  {
    key: "workforceCategories",
    label: "Workforce Category",
    singular: "Workforce Category",
    description: "Configure workforce categories used by Employee, Attendance, Payroll and vendor costing.",
    placeholder: "e.g. Company Roll",
  },
  {
    key: "prorationRules",
    label: "Proration Rules",
    singular: "Proration Rule",
    description: "Configure salary proration for joining, exit, LOP, paid days and working-day based payroll calculations.",
    placeholder: "e.g. Standard Monthly Proration",
  },
  {
    key: "payrollProfiles",
    label: "Payroll Profile",
    singular: "Payroll Profile",
    description: "Configure payroll processing profile, payment frequency, proration and policy linkage for each workforce category.",
    placeholder: "e.g. Standard Employee",
  },
  {
    key: "statutoryPolicies",
    label: "Statutory Policies",
    singular: "Statutory Policy",
    description: "Configure PF, ESI, Professional Tax and LWF rules centrally for Payroll.",
    placeholder: "e.g. India Statutory FY 2026-27",
  },
  {
    key: "salaryRules",
    label: "Salary Rules",
    singular: "Salary Rule",
    description: "Configure salary components, calculation basis and statutory applicability centrally for Payroll.",
    placeholder: "e.g. Standard Employee Salary",
  },
  {
    key: "deductionPolicies",
    label: "Deduction Policies",
    singular: "Deduction Policy",
    description: "Configure payroll deductions, limits, priority and workforce applicability centrally for Payroll.",
    placeholder: "e.g. Standard Deduction Policy",
  },
  {
    key: "otPolicies",
    label: "OT Policies",
    singular: "OT Policy",
    description: "Configure overtime multipliers, basis, approval and workforce applicability centrally for Payroll.",
    placeholder: "e.g. Standard OT Policy",
  },
  {
    key: "payrollCalendars",
    label: "Payroll Calendar",
    singular: "Payroll Calendar",
    description: "Configure payroll periods, attendance cut-off, processing, approval and salary payment dates centrally for Payroll.",
    placeholder: "e.g. Monthly Payroll 2026-27",
  },
  {
    key: "shifts",
    label: "Shift",
    singular: "Shift",
    description: "Attendance shifts. These can later be connected directly with the Shift module.",
    placeholder: "e.g. General",
  },
  {
    key: "branches",
    label: "Branch Name",
    singular: "Branch",
    description: "Company / branch master.",
    placeholder: "e.g. BAUER",
  },
  {
    key: "designations",
    label: "Designation",
    singular: "Designation",
    description: "Construction hierarchy from lower management through Senior VP and other approved levels.",
    placeholder: "e.g. Senior Manager - Civil",
  },
  {
    key: "employmentTypes",
    label: "Employment Type",
    singular: "Employment Type",
    description: "Skill / workforce classification.",
    placeholder: "e.g. Skilled",
  },
  {
    key: "departments",
    label: "Department",
    singular: "Department",
    description: "Departments used across Bauer construction and support functions.",
    placeholder: "e.g. Civil",
  },
  {
    key: "jobRoles",
    label: "Job Role / Vendor",
    singular: "Job Role / Vendor",
    description: "Bauer and contractor / vendor names used for workforce classification.",
    placeholder: "e.g. Conzept",
  },
  {
    key: "jobTypes",
    label: "Job Type",
    singular: "Job Type",
    description: "Employment schedule type.",
    placeholder: "e.g. Full Time",
  },
  {
    key: "leavePolicies",
    label: "Leave & Comp Off",
    singular: "Comp Off Policy",
    description: "Configure Comp Off applicability, validity and automatic lapse rules.",
    placeholder: "Comp Off Policy",
  },
  {
    key: "holidays",
    label: "Holiday Calendar",
    singular: "Holiday",
    description: "Manage organisation holidays used by Attendance and future payroll calculations.",
    placeholder: "e.g. Independence Day",
  },
  {
    key: "weekOffPolicies",
    label: "Week-Off Policy",
    singular: "Week-Off Policy",
    description: "Configure weekly offs by employee group, vendor or organisation-wide assignment.",
    placeholder: "e.g. On-Roll 5 Day",
  },
];

const DEFAULT_MASTERS = {
  locations: [
    { id: "loc-1", name: "Gurgaon HO", active: true },
    { id: "loc-2", name: "Gurgaon Yard", active: true },
    { id: "loc-3", name: "NPCIL Hisar", active: true },
    { id: "loc-4", name: "Chennai Design", active: true },
    { id: "loc-5", name: "Chennai Yard", active: true },
  ],
  employeeGroups: [
    { id: "grp-1", name: "Third Party (Associates)", active: true },
    { id: "grp-2", name: "Staff", active: true },
    { id: "grp-3", name: "GET", active: true },
    { id: "grp-4", name: "Consultant", active: true },
    { id: "grp-5", name: "Expat", active: true },
  ],
  workforceCategories: [
    { id: "wc-001", code: "CR", name: "Company Roll", categoryType: "COMPANY_ROLL", payrollApplicable: true, vendorRequired: false, attendanceApplicable: true, payrollProfile: "Standard Employee", active: true },
    { id: "wc-002", code: "TP", name: "Third Party", categoryType: "THIRD_PARTY", payrollApplicable: true, vendorRequired: true, attendanceApplicable: true, payrollProfile: "Third Party Worker", active: true },
    { id: "wc-003", code: "EXP", name: "Expatriate", categoryType: "EXPATRIATE", payrollApplicable: true, vendorRequired: false, attendanceApplicable: true, payrollProfile: "Expat Payroll", active: true },
    { id: "wc-004", code: "CON", name: "Consultant", categoryType: "CONSULTANT", payrollApplicable: true, vendorRequired: false, attendanceApplicable: true, payrollProfile: "Consultant Payroll", active: true },
  ],
  prorationRules: [
    {
      id: "pro-001", code: "STD-PROR", name: "Standard Monthly Proration",
      workforceCategories: ["wc-001", "wc-002", "wc-003", "wc-004"],
      salaryProration: "PAID_DAYS", denominatorBasis: "CALENDAR_DAYS",
      joiningProration: true, exitProration: true, lopProration: true,
      paidLeaveIncluded: true, weeklyOffIncluded: false, holidayIncluded: false,
      roundingRule: "NEAREST_RUPEE", minimumPayableDays: 0,
      effectiveFrom: "2026-04-01", effectiveTo: "", active: true,
      notes: "Monthly salary is prorated using paid days against calendar days.",
    },
  ],
  payrollProfiles: [
    {
      id: "pp-001", code: "STD-EMP", name: "Standard Employee",
      workforceCategories: ["wc-001"], paymentFrequency: "MONTHLY",
      prorationMethod: "PAID_DAYS", workingDaysBasis: "CALENDAR_DAYS",
      salaryRuleIds: ["sal-001"], statutoryPolicyIds: ["stat-001"],
      deductionPolicyIds: ["ded-001"], otPolicyIds: ["ot-001"],
      payrollCalendarId: "cal-001", active: true
    },
    {
      id: "pp-002", code: "TP-WKR", name: "Third Party Worker",
      workforceCategories: ["wc-002"], paymentFrequency: "MONTHLY",
      prorationMethod: "PAID_DAYS", workingDaysBasis: "CALENDAR_DAYS",
      salaryRuleIds: ["sal-002"], statutoryPolicyIds: ["stat-001"],
      deductionPolicyIds: ["ded-001"], otPolicyIds: ["ot-001"],
      payrollCalendarId: "cal-001", active: true
    },
    {
      id: "pp-003", code: "EXP-PAY", name: "Expat Payroll",
      workforceCategories: ["wc-003"], paymentFrequency: "MONTHLY",
      prorationMethod: "PAID_DAYS", workingDaysBasis: "CALENDAR_DAYS",
      salaryRuleIds: [], statutoryPolicyIds: ["stat-001"],
      deductionPolicyIds: ["ded-001"], otPolicyIds: [],
      payrollCalendarId: "cal-001", active: true
    },
    {
      id: "pp-004", code: "CON-PAY", name: "Consultant Payroll",
      workforceCategories: ["wc-004"], paymentFrequency: "MONTHLY",
      prorationMethod: "PAID_DAYS", workingDaysBasis: "CALENDAR_DAYS",
      salaryRuleIds: [], statutoryPolicyIds: [],
      deductionPolicyIds: [], otPolicyIds: [],
      payrollCalendarId: "cal-001", active: true
    },
  ],
  statutoryPolicies: [
    {
      id: "stat-001",
      name: "India Statutory FY 2026-27",
      effectiveFrom: "2026-09-17",
      ruleVersion: "STAT-2026-27-V2",
      active: true,
      pf: { enabled: true, employeeRate: 12, employerRate: 12, wageCeiling: 25000, includeBasicDa: true },
      esi: { enabled: true, employeeRate: 0.75, employerRate: 3.25, wageCeiling: 21000, includeBasicDa: false },
      pt: { enabled: true, state: "Haryana", slabs: [
        { min: 0, max: 15000, employeeAmount: 0 },
        { min: 15001, max: 25000, employeeAmount: 0 },
        { min: 25001, max: 999999999, employeeAmount: 0 }
      ] },
      lwf: { enabled: true, employeeAmount: 0, employerAmount: 0, frequency: "MONTHLY" },
    },
  ],
  salaryRules: [
    { id: "sal-001", code: "STD-EMP", name: "Standard Employee Salary", workforceCategories: ["wc-001"], effectiveFrom: "2026-04-01", ruleVersion: "SAL-2026-27-V1", active: true, prorationMethod: "PAID_DAYS", workingDaysBasis: "CALENDAR_DAYS", components: [
      { id: "basic", code: "BASIC", name: "Basic", calculationType: "PERCENTAGE_OF_GROSS", value: 50, amountBasis: "GROSS", paidDaysBased: true, lopApplicable: true, pfApplicable: true, esiApplicable: true, taxable: true, active: true },
      { id: "hra", code: "HRA", name: "HRA", calculationType: "PERCENTAGE_OF_BASIC_DA", value: 50, amountBasis: "BASIC_DA", paidDaysBased: true, lopApplicable: true, pfApplicable: false, esiApplicable: true, taxable: true, active: true },
      { id: "special", code: "SPECIAL", name: "Special Allowance", calculationType: "BALANCE", value: 0, amountBasis: "BALANCE", paidDaysBased: true, lopApplicable: true, pfApplicable: true, esiApplicable: true, taxable: true, active: true }
    ] },
    { id: "sal-002", code: "TP-WKR", name: "Third Party Worker Salary", workforceCategories: ["wc-002"], effectiveFrom: "2026-04-01", ruleVersion: "SAL-TP-2026-V1", active: true, prorationMethod: "PAID_DAYS", workingDaysBasis: "CALENDAR_DAYS", components: [
      { id: "basic", code: "BASIC", name: "Basic", calculationType: "PERCENTAGE_OF_GROSS", value: 50, amountBasis: "GROSS", paidDaysBased: true, lopApplicable: true, pfApplicable: true, esiApplicable: true, taxable: true, active: true },
      { id: "hra", code: "HRA", name: "HRA", calculationType: "PERCENTAGE_OF_BASIC_DA", value: 50, amountBasis: "BASIC_DA", paidDaysBased: true, lopApplicable: true, pfApplicable: false, esiApplicable: true, taxable: true, active: true },
      { id: "special", code: "SPECIAL", name: "Special Allowance", calculationType: "BALANCE", value: 0, amountBasis: "BALANCE", paidDaysBased: true, lopApplicable: true, pfApplicable: true, esiApplicable: true, taxable: true, active: true },
      { id: "hardship", code: "HARDSHIP", name: "Hardship Allowance", calculationType: "FIXED", value: 0, amountBasis: "FIXED", paidDaysBased: true, lopApplicable: true, pfApplicable: false, esiApplicable: true, taxable: true, active: true }
    ] },
  ],
  deductionPolicies: [
    {
      id: "ded-001", code: "STD-DEDUCT", name: "Standard Deduction Policy", effectiveFrom: "2026-04-01", ruleVersion: "DED-2026-27-V1", active: true,
      workforceCategories: ["wc-001", "wc-002", "wc-003", "wc-004"],
      maximumDeductionPercent: 50, priorityMode: "ORDERED", stopWhenNetPayZero: true, approvalRequired: false,
      deductions: [
        { id: "loan", code: "LOAN", name: "Loan / Advance", type: "LOAN_ADVANCE", calculationType: "FIXED", value: 0, frequency: "MONTHLY", priority: 1, maxPercent: 50, attendanceBased: false, active: true },
        { id: "food", code: "FOOD", name: "Food Deduction", type: "FOOD", calculationType: "FIXED", value: 0, frequency: "MONTHLY", priority: 2, maxPercent: 50, attendanceBased: true, active: true },
        { id: "recovery", code: "RECOVERY", name: "Recovery", type: "RECOVERY", calculationType: "FIXED", value: 0, frequency: "MONTHLY", priority: 3, maxPercent: 50, attendanceBased: false, active: true },
        { id: "other", code: "OTHER", name: "Other Deduction", type: "OTHER", calculationType: "FIXED", value: 0, frequency: "MONTHLY", priority: 4, maxPercent: 50, attendanceBased: false, active: true },
      ]
    },
  ],
  otPolicies: [
    {
      id: "ot-001", code: "STD-OT", name: "Standard OT Policy", effectiveFrom: "2026-04-01", ruleVersion: "OT-2026-27-V1", active: true,
      workforceCategories: ["wc-001", "wc-002"],
      otApplicable: true, calculationBasis: "BASIC", workingHoursPerDay: 8,
      weekdayMultiplier: 1.5, weeklyOffMultiplier: 2, holidayMultiplier: 2,
      minimumOtMinutes: 30, roundingRule: "NEAREST_30", maxOtHoursPerDay: 4,
      approvalRequired: true, holidayOtApplicable: true, weeklyOffOtApplicable: true,
      taxable: true, active: true
    },
  ],
  payrollCalendars: [
    {
      id: "cal-001",
      code: "CAL-MON-2026",
      name: "Monthly Payroll 2026-27",
      description: "Standard monthly payroll calendar for organisation workforce.",
      frequency: "MONTHLY",
      periodStartDay: 1,
      periodEndDay: "LAST_DAY",
      attendanceCutoffDay: 25,
      payrollProcessingStartDay: 1,
      payrollProcessingEndDay: 5,
      approvalDay: 6,
      salaryPayableDay: 7,
      workforceCategories: ["wc-001", "wc-002", "wc-003", "wc-004"],
      effectiveFrom: "2026-04-01",
      effectiveTo: "",
      autoLockAttendance: false,
      autoCalculatePaidDays: true,
      autoCreatePayrollRun: false,
      notes: "",
      active: true,
    },
  ],
  shifts: [
    { id: "shift-1", name: "General", active: true },
    { id: "shift-2", name: "B06", active: true },
    { id: "shift-3", name: "General_B", active: true },
  ],
  branches: [{ id: "branch-1", name: "BAUER", active: true }],
  designations: [
    { id: "des-1", name: "Engineer", active: true },
    { id: "des-2", name: "Senior Engineer", active: true },
    { id: "des-3", name: "Assistant Manager", active: true },
    { id: "des-4", name: "Manager", active: true },
    { id: "des-5", name: "Senior Manager", active: true },
    { id: "des-6", name: "AGM", active: true },
    { id: "des-7", name: "GM", active: true },
    { id: "des-8", name: "VP", active: true },
    { id: "des-9", name: "Senior VP", active: true },
  ],
  employmentTypes: [
    { id: "emp-1", name: "Skilled", active: true },
    { id: "emp-2", name: "Semi-Skilled", active: true },
    { id: "emp-3", name: "Unskilled", active: true },
    { id: "emp-4", name: "Trainee", active: true },
  ],
  departments: [
    { id: "dept-1", name: "Civil", active: true },
    { id: "dept-2", name: "Planning", active: true },
    { id: "dept-3", name: "Execution", active: true },
    { id: "dept-4", name: "Engineering", active: true },
    { id: "dept-5", name: "HR & Admin", active: true },
    { id: "dept-6", name: "Finance", active: true },
    { id: "dept-7", name: "Procurement", active: true },
    { id: "dept-8", name: "QA / QC", active: true },
    { id: "dept-9", name: "Safety", active: true },
  ],
  jobRoles: [
    { id: "role-1", name: "BAUER", active: true },
    { id: "role-2", name: "Conzept", active: true },
    { id: "role-3", name: "AlignPro", active: true },
    { id: "role-4", name: "Taurus", active: true },
  ],
  jobTypes: [
    { id: "type-1", name: "Full Time", active: true },
    { id: "type-2", name: "Part Time", active: true },
  ],
  leavePolicies: [
    {
      id: "attendance-leave-policy",
      name: "Default Attendance & Leave Policy",
      active: true,
      leaveTypes: [
        { code: "EL", name: "Earned Leave", paid: true, active: true },
        { code: "CL", name: "Casual Leave", paid: true, active: true },
        { code: "SL", name: "Sick Leave", paid: true, active: true },
        { code: "FL", name: "Force Leave", paid: false, active: true },
        { code: "CO", name: "Comp Off", paid: true, active: true },
      ],
      lopRules: { absent: true, unpaidLeave: true, forceLeave: false, halfDay: false },
      applicable: true,
      lapsePolicy: "6_MONTHS",
      calculationMethod: "FROM_EARNED_DATE",
    },
  ],
  holidays: [],
  // New masters; kept separate so existing organisation data is untouched.
  weekOffPolicies: [],
};


function getDefaultWorkforceCategory() {
  return {
    id: "", code: "", name: "", categoryType: "COMPANY_ROLL",
    payrollApplicable: true, vendorRequired: false, attendanceApplicable: true,
    payrollProfile: "Standard Employee", active: true,
  };
}

function getDefaultPayrollCalendar() {
  return {
    id: "",
    code: "",
    name: "",
    description: "",
    frequency: "MONTHLY",
    periodStartDay: 1,
    periodEndDay: "LAST_DAY",
    attendanceCutoffDay: 25,
    payrollProcessingStartDay: 1,
    payrollProcessingEndDay: 5,
    approvalDay: 6,
    salaryPayableDay: 7,
    workforceCategories: [],
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    autoLockAttendance: false,
    autoCalculatePaidDays: true,
    autoCreatePayrollRun: false,
    notes: "",
    active: true,
  };
}

function normalizePayrollCalendar(item) {
  const base = getDefaultPayrollCalendar();
  return {
    ...base,
    ...(item || {}),
    periodStartDay: Number(item?.periodStartDay ?? base.periodStartDay),
    attendanceCutoffDay: Number(item?.attendanceCutoffDay ?? base.attendanceCutoffDay),
    payrollProcessingStartDay: Number(item?.payrollProcessingStartDay ?? base.payrollProcessingStartDay),
    payrollProcessingEndDay: Number(item?.payrollProcessingEndDay ?? base.payrollProcessingEndDay),
    approvalDay: Number(item?.approvalDay ?? base.approvalDay),
    salaryPayableDay: Number(item?.salaryPayableDay ?? base.salaryPayableDay),
    workforceCategories: Array.isArray(item?.workforceCategories) ? item.workforceCategories : [],
    active: item?.active !== false,
  };
}

function getDefaultProrationRule() {
  return {
    id: "", code: "", name: "", workforceCategories: [],
    salaryProration: "PAID_DAYS", denominatorBasis: "CALENDAR_DAYS",
    joiningProration: true, exitProration: true, lopProration: true,
    paidLeaveIncluded: true, weeklyOffIncluded: false, holidayIncluded: false,
    roundingRule: "NEAREST_RUPEE", minimumPayableDays: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: "",
    active: true, notes: "",
  };
}

function normalizeProrationRule(item) {
  const base = getDefaultProrationRule();
  return { ...base, ...(item || {}), workforceCategories: Array.isArray(item?.workforceCategories) ? item.workforceCategories : [], minimumPayableDays: Number(item?.minimumPayableDays ?? base.minimumPayableDays), active: item?.active !== false };
}

function getDefaultPayrollProfile() {
  return {
    id: "", code: "", name: "", workforceCategories: [], paymentFrequency: "MONTHLY",
    prorationMethod: "PAID_DAYS", workingDaysBasis: "CALENDAR_DAYS",
    salaryRuleIds: [], statutoryPolicyIds: [], deductionPolicyIds: [], otPolicyIds: [],
    payrollCalendarId: "", active: true,
  };
}

function normalizePayrollProfile(item) {
  const base = getDefaultPayrollProfile();
  return {
    ...base, ...(item || {}),
    workforceCategories: Array.isArray(item?.workforceCategories) ? item.workforceCategories : [],
    salaryRuleIds: Array.isArray(item?.salaryRuleIds) ? item.salaryRuleIds : [],
    statutoryPolicyIds: Array.isArray(item?.statutoryPolicyIds) ? item.statutoryPolicyIds : [],
    deductionPolicyIds: Array.isArray(item?.deductionPolicyIds) ? item.deductionPolicyIds : [],
    otPolicyIds: Array.isArray(item?.otPolicyIds) ? item.otPolicyIds : [],
    active: item?.active !== false,
  };
}

function getDefaultStatutoryPolicy() {
  return {
    id: "",
    name: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    ruleVersion: "",
    active: true,
    pf: { enabled: true, employeeRate: 12, employerRate: 12, wageCeiling: 15000, includeBasicDa: true },
    esi: { enabled: true, employeeRate: 0.75, employerRate: 3.25, wageCeiling: 21000, includeBasicDa: false },
    pt: { enabled: false, state: "Haryana", slabs: [{ min: 0, max: 999999999, employeeAmount: 0 }] },
    lwf: { enabled: false, employeeAmount: 0, employerAmount: 0, frequency: "MONTHLY" },
  };
}

function normalizeStatutoryPolicy(item) {
  const base = getDefaultStatutoryPolicy();
  return {
    ...base,
    ...item,
    pf: { ...base.pf, ...(item?.pf || {}) },
    esi: { ...base.esi, ...(item?.esi || {}) },
    pt: { ...base.pt, ...(item?.pt || {}), slabs: Array.isArray(item?.pt?.slabs) && item.pt.slabs.length ? item.pt.slabs : base.pt.slabs },
    lwf: { ...base.lwf, ...(item?.lwf || {}) },
  };
}

function getDefaultSalaryComponent() {
  return { id: `component-${Date.now()}`, code: "", name: "", calculationType: "FIXED", value: 0, amountBasis: "FIXED", paidDaysBased: true, lopApplicable: true, pfApplicable: false, esiApplicable: false, taxable: true, active: true };
}

function getDefaultSalaryRule() {
  const now = Date.now();
  return { id: "", code: "", name: "", workforceCategories: [], effectiveFrom: new Date().toISOString().slice(0, 10), ruleVersion: "", active: true, prorationMethod: "PAID_DAYS", workingDaysBasis: "CALENDAR_DAYS", components: [
    { ...getDefaultSalaryComponent(), id: `component-${now}`, code: "BASIC", name: "Basic", calculationType: "PERCENTAGE_OF_GROSS", value: 50, amountBasis: "GROSS", pfApplicable: true, esiApplicable: true },
    { ...getDefaultSalaryComponent(), id: `component-${now+1}`, code: "HRA", name: "HRA", calculationType: "PERCENTAGE_OF_BASIC_DA", value: 50, amountBasis: "BASIC_DA", esiApplicable: true },
    { ...getDefaultSalaryComponent(), id: `component-${now+2}`, code: "SPECIAL", name: "Special Allowance", calculationType: "BALANCE", amountBasis: "BALANCE", pfApplicable: true, esiApplicable: true },
  ] };
}

function normalizeSalaryComponent(item) { return { ...getDefaultSalaryComponent(), ...(item || {}) }; }

function normalizeSalaryRule(item) {
  const base = getDefaultSalaryRule();
  return { ...base, ...(item || {}), workforceCategories: Array.isArray(item?.workforceCategories) ? item.workforceCategories : [], components: (Array.isArray(item?.components) && item.components.length ? item.components : base.components).map(normalizeSalaryComponent) };
}

function calculateSalaryRulePreview(rule) {
  const gross = 100000; let basicDa = 0; let used = 0;
  const rows = normalizeSalaryRule(rule).components.filter((c) => c.active !== false).map((component) => {
    const c = normalizeSalaryComponent(component); let preview = 0;
    if (c.calculationType === "FIXED") preview = Number(c.value) || 0;
    if (c.calculationType === "PERCENTAGE_OF_GROSS") preview = gross * (Number(c.value) || 0) / 100;
    if (c.calculationType === "PERCENTAGE_OF_BASIC" || c.calculationType === "PERCENTAGE_OF_BASIC_DA") preview = basicDa * (Number(c.value) || 0) / 100;
    if (c.calculationType === "BALANCE") preview = 0; else used += preview;
    if (c.code === "BASIC" || c.amountBasis === "BASIC_DA") basicDa += preview;
    return { ...c, preview };
  });
  const balanceIndex = rows.findIndex((r) => r.calculationType === "BALANCE");
  if (balanceIndex >= 0) rows[balanceIndex].preview = Math.max(0, gross - used);
  return rows;
}

function getDefaultDeductionLine() {
  return { id: `ded-line-${Date.now()}`, code: "", name: "", type: "OTHER", calculationType: "FIXED", value: 0, frequency: "MONTHLY", priority: 1, maxPercent: 50, attendanceBased: false, active: true };
}

function getDefaultDeductionPolicy() {
  return { id: "", code: "", name: "", effectiveFrom: new Date().toISOString().slice(0, 10), ruleVersion: "", active: true, workforceCategories: [], maximumDeductionPercent: 50, priorityMode: "ORDERED", stopWhenNetPayZero: true, approvalRequired: false, deductions: [getDefaultDeductionLine()] };
}

function normalizeDeductionLine(item) {
  return { ...getDefaultDeductionLine(), ...(item || {}), value: Number(item?.value ?? 0), priority: Number(item?.priority ?? 1), maxPercent: Number(item?.maxPercent ?? 50), active: item?.active !== false };
}

function normalizeDeductionPolicy(item) {
  const base = getDefaultDeductionPolicy();
  return { ...base, ...(item || {}), workforceCategories: Array.isArray(item?.workforceCategories) ? item.workforceCategories : [], maximumDeductionPercent: Number(item?.maximumDeductionPercent ?? base.maximumDeductionPercent), deductions: (Array.isArray(item?.deductions) && item.deductions.length ? item.deductions : base.deductions).map(normalizeDeductionLine) };
}

function getDefaultOTPolicy() {
  return {
    id: "", code: "", name: "", effectiveFrom: new Date().toISOString().slice(0, 10), ruleVersion: "", active: true,
    workforceCategories: [], otApplicable: true, calculationBasis: "BASIC", workingHoursPerDay: 8,
    weekdayMultiplier: 1.5, weeklyOffMultiplier: 2, holidayMultiplier: 2, minimumOtMinutes: 30,
    roundingRule: "NEAREST_30", maxOtHoursPerDay: 4, approvalRequired: true,
    holidayOtApplicable: true, weeklyOffOtApplicable: true, taxable: true,
  };
}

function normalizeOTPolicy(item) {
  const base = getDefaultOTPolicy();
  return {
    ...base, ...(item || {}),
    workforceCategories: Array.isArray(item?.workforceCategories) ? item.workforceCategories : [],
    workingHoursPerDay: Number(item?.workingHoursPerDay ?? base.workingHoursPerDay),
    weekdayMultiplier: Number(item?.weekdayMultiplier ?? base.weekdayMultiplier),
    weeklyOffMultiplier: Number(item?.weeklyOffMultiplier ?? base.weeklyOffMultiplier),
    holidayMultiplier: Number(item?.holidayMultiplier ?? base.holidayMultiplier),
    minimumOtMinutes: Number(item?.minimumOtMinutes ?? base.minimumOtMinutes),
    maxOtHoursPerDay: Number(item?.maxOtHoursPerDay ?? base.maxOtHoursPerDay),
  };
}

function getDefaultShift() {
  return {
    id: "",
    code: "",
    name: "",
    shiftType: "Day",
    startTime: "09:00",
    endTime: "18:00",
    crossMidnight: false,
    breaks: [{ id: `break-${Date.now()}`, name: "Lunch", start: "13:00", end: "14:00" }],
    graceIn: 10,
    graceOut: 10,
    otApplicable: true,
    otAfter: 8,
    weeklyOff: "Sunday",
    active: true,
  };
}

function minutesFromTime(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function calculateShiftHours(shift) {
  const start = minutesFromTime(shift.startTime);
  const end = minutesFromTime(shift.endTime);
  if (start === null || end === null) return { gross: 0, break: 0, effective: 0 };

  let grossMinutes = end - start;
  if (grossMinutes < 0 || shift.crossMidnight) grossMinutes += 24 * 60;

  const breakMinutes = (shift.breaks || []).reduce((total, item) => {
    const bs = minutesFromTime(item.start);
    const be = minutesFromTime(item.end);
    if (bs === null || be === null) return total;
    let duration = be - bs;
    if (duration < 0) duration += 24 * 60;
    return total + Math.max(0, duration);
  }, 0);

  const effective = Math.max(0, grossMinutes - breakMinutes);

  return {
    gross: grossMinutes / 60,
    break: breakMinutes / 60,
    effective: effective / 60,
  };
}

function formatHours(value) {
  if (!Number.isFinite(value)) return "—";
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function normalizeShift(item) {
  const defaults = getDefaultShift();
  const shift = { ...defaults, ...item };
  shift.breaks = Array.isArray(item?.breaks) && item.breaks.length
    ? item.breaks
    : defaults.breaks;
  return shift;
}

const COMP_OFF_LAPSE_OPTIONS = [
  { value: "QUARTERLY", label: "Quarterly (Calendar Quarter)" },
  { value: "6_MONTHS", label: "After 6 Months" },
  { value: "1_YEAR", label: "After 1 Year" },
];

const COMP_OFF_CALCULATION_OPTIONS = [
  { value: "FROM_EARNED_DATE", label: "From Comp Off Earned Date" },
  { value: "QUARTER_END", label: "End of Current Calendar Quarter" },
];

function getPolicyLabel(policy) {
  return (
    COMP_OFF_LAPSE_OPTIONS.find((item) => item.value === policy?.lapsePolicy)?.label ||
    "After 6 Months"
  );
}

const DEFAULT_LEAVE_TYPES = [
  {
    id: "EL", code: "EL", name: "Earned Leave", paid: true, active: true,
    applicability: { scope: "ALL", value: "" },
    accrual: { enabled: true, frequency: "MONTHLY", basis: "PRESENT_DAYS", minimumDays: 21, credit: 1.25 },
    carryForward: { enabled: true, maximum: 30, expiryEnabled: false, expiryMonths: 0, refusedLeaveUnlimited: true },
    salaryTreatment: { countAsPaidDay: true, lop: false },
    compOff: { enabled: false, earnBasis: "WEEKLY_OFF_WORKED", earnUnits: 1, utilisationEnabled: true },
  },
  {
    id: "CL", code: "CL", name: "Casual Leave", paid: true, active: true,
    applicability: { scope: "ALL", value: "" },
    accrual: { enabled: true, frequency: "YEARLY", basis: "FIXED", minimumDays: 0, credit: 7 },
    carryForward: { enabled: false, maximum: 0, expiryEnabled: false, expiryMonths: 0, refusedLeaveUnlimited: false },
    salaryTreatment: { countAsPaidDay: true, lop: false },
    compOff: { enabled: false, earnBasis: "WEEKLY_OFF_WORKED", earnUnits: 1, utilisationEnabled: true },
  },
  {
    id: "SL", code: "SL", name: "Sick Leave", paid: true, active: true,
    applicability: { scope: "ALL", value: "" },
    accrual: { enabled: true, frequency: "YEARLY", basis: "FIXED", minimumDays: 0, credit: 7 },
    carryForward: { enabled: false, maximum: 0, expiryEnabled: false, expiryMonths: 0, refusedLeaveUnlimited: false },
    salaryTreatment: { countAsPaidDay: true, lop: false },
    compOff: { enabled: false, earnBasis: "WEEKLY_OFF_WORKED", earnUnits: 1, utilisationEnabled: true },
  },
  {
    id: "FL", code: "FL", name: "Force Leave", paid: false, active: true,
    applicability: { scope: "ALL", value: "" },
    accrual: { enabled: false, frequency: "NONE", basis: "NONE", minimumDays: 0, credit: 0 },
    carryForward: { enabled: false, maximum: 0, expiryEnabled: false, expiryMonths: 0, refusedLeaveUnlimited: false },
    salaryTreatment: { countAsPaidDay: false, lop: true },
    compOff: { enabled: false, earnBasis: "WEEKLY_OFF_WORKED", earnUnits: 1, utilisationEnabled: true },
  },
  {
    id: "CO", code: "CO", name: "Comp Off", paid: true, active: true,
    applicability: { scope: "ALL", value: "" },
    accrual: { enabled: true, frequency: "ON_EVENT", basis: "WEEKLY_OFF_WORKED", minimumDays: 0, credit: 1 },
    carryForward: { enabled: true, maximum: 30, expiryEnabled: true, expiryMonths: 6, refusedLeaveUnlimited: false },
    salaryTreatment: { countAsPaidDay: true, lop: false },
    compOff: { enabled: true, earnBasis: "WEEKLY_OFF_WORKED", earnUnits: 1, utilisationEnabled: true },
  },
];

function normalizeLeaveType(item) {
  const fallback = DEFAULT_LEAVE_TYPES.find((row) => row.code === item?.code) || DEFAULT_LEAVE_TYPES[0];
  return {
    ...fallback,
    ...item,
    id: item?.id || item?.code || fallback.code,
    applicability: { ...fallback.applicability, ...(item?.applicability || {}) },
    accrual: { ...fallback.accrual, ...(item?.accrual || {}) },
    carryForward: { ...fallback.carryForward, ...(item?.carryForward || {}) },
    salaryTreatment: { ...fallback.salaryTreatment, ...(item?.salaryTreatment || {}) },
    compOff: { ...fallback.compOff, ...(item?.compOff || {}) },
  };
}

function normalizeLeavePolicy(item) {
  const base = DEFAULT_MASTERS.leavePolicies[0];
  return {
    ...base,
    ...item,
    leaveTypes: (Array.isArray(item?.leaveTypes) && item.leaveTypes.length ? item.leaveTypes : DEFAULT_LEAVE_TYPES).map(normalizeLeaveType),
    lopRules: { ...base.lopRules, ...(item?.lopRules || {}) },
  };
}

function getDefaultLeaveType() {
  return normalizeLeaveType({
    id: `leave-${Date.now()}`,
    code: "",
    name: "",
    paid: true,
    active: true,
    applicability: { scope: "ALL", value: "" },
    accrual: { enabled: false, frequency: "YEARLY", basis: "FIXED", minimumDays: 0, credit: 0 },
    carryForward: { enabled: false, maximum: 0, expiryEnabled: false, expiryMonths: 0, refusedLeaveUnlimited: false },
    salaryTreatment: { countAsPaidDay: true, lop: false },
    compOff: { enabled: false, earnBasis: "WEEKLY_OFF_WORKED", earnUnits: 1, utilisationEnabled: true },
  });
}

function loadMasters() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const migratedWorkforceCategories = Array.isArray(parsed.workforceCategories) && parsed.workforceCategories.length
        ? parsed.workforceCategories
        : (parsed.employeeGroups || DEFAULT_MASTERS.employeeGroups).map((item, index) => {
            const name = String(item.name || "");
            const isThirdParty = /third party/i.test(name);
            const isExpat = /expat/i.test(name);
            const isConsultant = /consultant/i.test(name);
            return {
              id: item.id ? `wc-migrated-${item.id}` : `wc-migrated-${index + 1}`,
              code: isThirdParty ? "TP" : isExpat ? "EXP" : isConsultant ? "CON" : `WC${String(index + 1).padStart(2, "0")}`,
              name,
              categoryType: isThirdParty ? "THIRD_PARTY" : isExpat ? "EXPATRIATE" : isConsultant ? "CONSULTANT" : "COMPANY_ROLL",
              payrollApplicable: true,
              vendorRequired: isThirdParty,
              attendanceApplicable: true,
              payrollProfile: isThirdParty ? "Third Party Worker" : isExpat ? "Expat Payroll" : isConsultant ? "Consultant Payroll" : "Standard Employee",
              active: item.active !== false,
            };
          });

      let statutoryPolicies = (parsed.statutoryPolicies || DEFAULT_MASTERS.statutoryPolicies).map(normalizeStatutoryPolicy);
      const hasCurrentEpfPolicy = statutoryPolicies.some((policy) => policy.effectiveFrom >= "2026-09-17" && Number(policy.pf?.wageCeiling) === 25000);
      const legacyDefault = statutoryPolicies.find((policy) => policy.name === "India Statutory FY 2026-27" && Number(policy.pf?.wageCeiling) === 15000);
      if (!hasCurrentEpfPolicy && legacyDefault && legacyDefault.ruleVersion === "STAT-2026-27-V1") {
        const historical = { ...legacyDefault, id: `${legacyDefault.id}-HIST`, active: false, effectiveTo: "2026-09-16", ruleVersion: "STAT-2026-27-V1-HISTORICAL" };
        const current = { ...getDefaultStatutoryPolicy(), ...DEFAULT_MASTERS.statutoryPolicies[0], id: `stat-${Date.now()}`, name: "India Statutory FY 2026-27", effectiveFrom: "2026-09-17", ruleVersion: "STAT-2026-27-V2", active: true };
        statutoryPolicies = [...statutoryPolicies.filter((policy) => policy.id !== legacyDefault.id), historical, current];
      }

      return {
        ...DEFAULT_MASTERS,
        ...parsed,
        workforceCategories: migratedWorkforceCategories,
        prorationRules: (parsed.prorationRules || DEFAULT_MASTERS.prorationRules).map(normalizeProrationRule),
        payrollProfiles: (parsed.payrollProfiles || DEFAULT_MASTERS.payrollProfiles).map(normalizePayrollProfile),
        statutoryPolicies,
        payrollCalendars: (parsed.payrollCalendars || DEFAULT_MASTERS.payrollCalendars).map(normalizePayrollCalendar),
        salaryRules: (parsed.salaryRules || DEFAULT_MASTERS.salaryRules).map(normalizeSalaryRule),
        deductionPolicies: (parsed.deductionPolicies || DEFAULT_MASTERS.deductionPolicies).map(normalizeDeductionPolicy),
        otPolicies: (parsed.otPolicies || DEFAULT_MASTERS.otPolicies).map(normalizeOTPolicy),
        shifts: (parsed.shifts || DEFAULT_MASTERS.shifts).map(normalizeShift),
        leavePolicies: parsed.leavePolicies?.length
          ? parsed.leavePolicies.map(normalizeLeavePolicy)
          : DEFAULT_MASTERS.leavePolicies.map(normalizeLeavePolicy),
        holidays: Array.isArray(parsed.holidays) ? parsed.holidays : DEFAULT_MASTERS.holidays,
      };
    }
  } catch {
    // Fall back to the initial Bauer master data.
  }
  return DEFAULT_MASTERS;
}

function Organization() {
  const [masters, setMasters] = useState(loadMasters);
  const [activeMaster, setActiveMaster] = useState("locations");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState("");
  const [workforceCategoryForm, setWorkforceCategoryForm] = useState(getDefaultWorkforceCategory());
  const [payrollProfileForm, setPayrollProfileForm] = useState(getDefaultPayrollProfile());
  const [prorationRuleForm, setProrationRuleForm] = useState(getDefaultProrationRule());
  const [statutoryPolicyForm, setStatutoryPolicyForm] = useState(getDefaultStatutoryPolicy());
  const [salaryRuleForm, setSalaryRuleForm] = useState(getDefaultSalaryRule());
  const [payrollCalendarForm, setPayrollCalendarForm] = useState(getDefaultPayrollCalendar());
  const [otPolicyForm, setOTPolicyForm] = useState(getDefaultOTPolicy());
  const [deductionPolicyForm, setDeductionPolicyForm] = useState(getDefaultDeductionPolicy());
  const [shiftForm, setShiftForm] = useState(getDefaultShift());
  const [policyForm, setPolicyForm] = useState(
    () => normalizeLeavePolicy(loadMasters().leavePolicies?.[0] || DEFAULT_MASTERS.leavePolicies[0])
  );
  const [leaveTypeForm, setLeaveTypeForm] = useState(getDefaultLeaveType());
  const [editingLeaveType, setEditingLeaveType] = useState(null);
  const [holidayForm, setHolidayForm] = useState({
    id: "",
    name: "",
    date: new Date().toISOString().slice(0, 10),
    paid: true,
    active: true,
  });
  const [weekOffForm, setWeekOffForm] = useState({
    id: "",
    name: "",
    assignmentType: "Workforce Category",
    assignmentValue: "",
    saturday: false,
    sunday: true,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    active: true,
  });

  const currentConfig = MASTER_CONFIG.find((item) => item.key === activeMaster);
  const currentItems = masters[activeMaster] || [];

  const filteredItems = useMemo(() => {
    return currentItems.filter((item) => {
      const matchesSearch = String(item.name || item.ruleVersion || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = showInactive ? true : item.active;
      return matchesSearch && matchesStatus;
    });
  }, [currentItems, search, showInactive]);

  const saveMasters = (next) => {
    setMasters(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const openAdd = () => {
    setEditing(null);
    setValue("");

    if (activeMaster === "workforceCategories") {
      setWorkforceCategoryForm(getDefaultWorkforceCategory());
    }

    if (activeMaster === "payrollProfiles") {
      setPayrollProfileForm(getDefaultPayrollProfile());
    }

    if (activeMaster === "prorationRules") {
      setProrationRuleForm(getDefaultProrationRule());
    }

    if (activeMaster === "statutoryPolicies") {
      setStatutoryPolicyForm(getDefaultStatutoryPolicy());
    }
    if (activeMaster === "salaryRules") {
      setSalaryRuleForm(getDefaultSalaryRule());
    }
    if (activeMaster === "payrollCalendars") {
      setPayrollCalendarForm(getDefaultPayrollCalendar());
    }
    if (activeMaster === "otPolicies") {
      setOTPolicyForm(getDefaultOTPolicy());
    }
    if (activeMaster === "deductionPolicies") {
      setDeductionPolicyForm(getDefaultDeductionPolicy());
    }

    if (activeMaster === "shifts") {
      setShiftForm(getDefaultShift());
    }

    if (activeMaster === "leavePolicies") {
      setPolicyForm(normalizeLeavePolicy(
        masters.leavePolicies?.[0] || DEFAULT_MASTERS.leavePolicies[0]
      ));
      setEditingLeaveType(null);
      setLeaveTypeForm(getDefaultLeaveType());
    }

    if (activeMaster === "holidays") {
      setHolidayForm({
        id: "",
        name: "",
        date: new Date().toISOString().slice(0, 10),
        paid: true,
        active: true,
      });
    }

    if (activeMaster === "weekOffPolicies") {
      setWeekOffForm({
        id: "",
        name: "",
        assignmentType: "Workforce Category",
        assignmentValue: "",
        saturday: false,
        sunday: true,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        active: true,
      });
    }

    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditing(item);

    if (activeMaster === "workforceCategories") {
      setWorkforceCategoryForm({ ...getDefaultWorkforceCategory(), ...item });
    } else if (activeMaster === "payrollProfiles") {
      setPayrollProfileForm(normalizePayrollProfile(item));
    } else if (activeMaster === "prorationRules") {
      setProrationRuleForm(normalizeProrationRule(item));
    } else if (activeMaster === "statutoryPolicies") {
      setStatutoryPolicyForm(normalizeStatutoryPolicy(item));
    } else if (activeMaster === "salaryRules") {
      setSalaryRuleForm(normalizeSalaryRule(item));
    } else if (activeMaster === "payrollCalendars") {
      setPayrollCalendarForm(normalizePayrollCalendar(item));
    } else if (activeMaster === "otPolicies") {
      setOTPolicyForm(normalizeOTPolicy(item));
    } else if (activeMaster === "deductionPolicies") {
      setDeductionPolicyForm(normalizeDeductionPolicy(item));
    } else if (activeMaster === "shifts") {
      setShiftForm(normalizeShift(item));
    } else if (activeMaster === "leavePolicies") {
      setPolicyForm(normalizeLeavePolicy(item));
    } else if (activeMaster === "holidays") {
      setHolidayForm({
        id: "",
        name: "",
        date: new Date().toISOString().slice(0, 10),
        paid: true,
        active: true,
        ...item,
      });
    } else if (activeMaster === "weekOffPolicies") {
      setWeekOffForm({
        id: "",
        name: "",
        assignmentType: "Workforce Category",
        assignmentValue: "",
        saturday: false,
        sunday: true,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        active: true,
        ...item,
      });
    } else {
      setValue(item.name);
    }

    setShowForm(true);
  };


  const saveWorkforceCategory = (event) => {
    event.preventDefault();
    const code = String(workforceCategoryForm.code || "").trim().toUpperCase();
    const name = String(workforceCategoryForm.name || "").trim();
    const payrollProfile = String(workforceCategoryForm.payrollProfile || "").trim();

    if (!code || !name || !payrollProfile) {
      window.alert("Category Code, Category Name and Payroll Profile are required.");
      return;
    }

    if (currentItems.some((item) => item.id !== editing?.id && String(item.code || "").toLowerCase() === code.toLowerCase())) {
      window.alert("Workforce Category Code already exists.");
      return;
    }
    if (currentItems.some((item) => item.id !== editing?.id && String(item.name || "").toLowerCase() === name.toLowerCase())) {
      window.alert("Workforce Category Name already exists.");
      return;
    }

    const nextCategory = {
      ...getDefaultWorkforceCategory(), ...workforceCategoryForm,
      id: editing?.id || `wc-${Date.now()}`, code, name, payrollProfile,
      payrollApplicable: Boolean(workforceCategoryForm.payrollApplicable),
      vendorRequired: Boolean(workforceCategoryForm.vendorRequired),
      attendanceApplicable: Boolean(workforceCategoryForm.attendanceApplicable),
      active: workforceCategoryForm.active !== false,
    };

    const nextItems = editing
      ? currentItems.map((item) => item.id === editing.id ? nextCategory : item)
      : [...currentItems, nextCategory];

    saveMasters({ ...masters, workforceCategories: nextItems });
    setWorkforceCategoryForm(nextCategory);
    setShowForm(false);
    setEditing(null);
  };

  const savePayrollCalendar = (event) => {
    event.preventDefault();
    const clean = normalizePayrollCalendar(payrollCalendarForm);
    clean.code = String(clean.code || "").trim().toUpperCase();
    clean.name = String(clean.name || "").trim();
    clean.description = String(clean.description || "").trim();
    clean.notes = String(clean.notes || "").trim();

    if (!clean.code || !clean.name || !clean.effectiveFrom) {
      window.alert("Calendar Code, Calendar Name and Effective From are required.");
      return;
    }
    if (clean.effectiveTo && clean.effectiveTo < clean.effectiveFrom) {
      window.alert("Effective To cannot be earlier than Effective From.");
      return;
    }
    if (clean.payrollProcessingStartDay > clean.payrollProcessingEndDay) {
      window.alert("Payroll Processing Start Day cannot be greater than End Day.");
      return;
    }
    if (clean.attendanceCutoffDay < 1 || clean.attendanceCutoffDay > 31) {
      window.alert("Attendance Cut-off Day must be between 1 and 31.");
      return;
    }
    if (currentItems.some((item) => item.id !== editing?.id && String(item.code || "").toLowerCase() === clean.code.toLowerCase())) {
      window.alert("Payroll Calendar Code already exists.");
      return;
    }

    clean.id = editing?.id || `cal-${Date.now()}`;
    clean.active = clean.active !== false;

    const nextItems = editing
      ? currentItems.map((item) => item.id === editing.id ? clean : item)
      : [...currentItems, clean];

    saveMasters({ ...masters, payrollCalendars: nextItems });
    setPayrollCalendarForm(clean);
    setShowForm(false);
    setEditing(null);
  };

  const saveProrationRule = (event) => {
    event.preventDefault();
    const clean = normalizeProrationRule(prorationRuleForm);
    clean.code = String(clean.code || "").trim().toUpperCase();
    clean.name = String(clean.name || "").trim();
    clean.workforceCategories = clean.workforceCategories.filter(Boolean);
    clean.effectiveFrom = String(clean.effectiveFrom || "").trim();
    if (!clean.code || !clean.name) return window.alert("Proration Rule Code and Name are required.");
    if (!clean.effectiveFrom) return window.alert("Effective From date is required.");
    if (!clean.workforceCategories.length) return window.alert("Select at least one Workforce Category.");
    if (clean.minimumPayableDays < 0) return window.alert("Minimum Payable Days cannot be negative.");
    if (currentItems.some((item) => item.id !== editing?.id && String(item.code || "").toLowerCase() === clean.code.toLowerCase())) return window.alert("Proration Rule Code already exists.");
    if (currentItems.some((item) => item.id !== editing?.id && String(item.name || "").toLowerCase() === clean.name.toLowerCase())) return window.alert("Proration Rule Name already exists.");
    clean.id = editing?.id || `pro-${Date.now()}`;
    const nextItems = editing ? currentItems.map((item) => item.id === editing.id ? clean : item) : [...currentItems, clean];
    saveMasters({ ...masters, prorationRules: nextItems });
    setProrationRuleForm(clean);
    setShowForm(false);
    setEditing(null);
  };

  const savePayrollProfile = (event) => {
    event.preventDefault();
    const clean = normalizePayrollProfile(payrollProfileForm);
    clean.code = String(clean.code || "").trim().toUpperCase();
    clean.name = String(clean.name || "").trim();
    clean.workforceCategories = clean.workforceCategories.filter(Boolean);
    if (!clean.code || !clean.name) return window.alert("Payroll Profile Code and Name are required.");
    if (!clean.workforceCategories.length) return window.alert("Select at least one Workforce Category.");
    if (currentItems.some((item) => item.id !== editing?.id && String(item.code || "").toLowerCase() === clean.code.toLowerCase())) return window.alert("Payroll Profile Code already exists.");
    if (currentItems.some((item) => item.id !== editing?.id && String(item.name || "").toLowerCase() === clean.name.toLowerCase())) return window.alert("Payroll Profile Name already exists.");
    clean.id = editing?.id || `pp-${Date.now()}`;
    clean.active = clean.active !== false;
    const nextItems = editing ? currentItems.map((item) => item.id === editing.id ? clean : item) : [...currentItems, clean];
    saveMasters({ ...masters, payrollProfiles: nextItems });
    setPayrollProfileForm(clean);
    setShowForm(false);
    setEditing(null);
  };

  const saveStatutoryPolicy = (event) => {
    event.preventDefault();
    const clean = normalizeStatutoryPolicy(statutoryPolicyForm);
    clean.name = String(clean.name || "").trim();
    clean.ruleVersion = String(clean.ruleVersion || "").trim();
    if (!clean.name || !clean.effectiveFrom || !clean.ruleVersion) {
      window.alert("Policy Name, Effective From and Rule Version are required.");
      return;
    }
    if (currentItems.some((item) => item.id !== editing?.id && String(item.ruleVersion || "").toLowerCase() === clean.ruleVersion.toLowerCase())) {
      window.alert("Rule Version already exists.");
      return;
    }
    if (currentItems.some((item) => item.id !== editing?.id && String(item.name || "").toLowerCase() === clean.name.toLowerCase())) {
      window.alert("Policy Name already exists.");
      return;
    }
    clean.id = editing?.id || `stat-${Date.now()}`;
    clean.active = clean.active !== false;
    clean.pf = { ...clean.pf, employeeRate: Number(clean.pf.employeeRate) || 0, employerRate: Number(clean.pf.employerRate) || 0, wageCeiling: Number(clean.pf.wageCeiling) || 0 };
    clean.esi = { ...clean.esi, employeeRate: Number(clean.esi.employeeRate) || 0, employerRate: Number(clean.esi.employerRate) || 0, wageCeiling: Number(clean.esi.wageCeiling) || 0 };
    clean.pt = { ...clean.pt, slabs: (clean.pt.slabs || []).map((row) => ({ min: Number(row.min) || 0, max: Number(row.max) || 0, employeeAmount: Number(row.employeeAmount) || 0 })) };
    clean.lwf = { ...clean.lwf, employeeAmount: Number(clean.lwf.employeeAmount) || 0, employerAmount: Number(clean.lwf.employerAmount) || 0 };
    const nextItems = editing ? currentItems.map((item) => item.id === editing.id ? clean : item) : [...currentItems, clean];
    saveMasters({ ...masters, statutoryPolicies: nextItems });
    setStatutoryPolicyForm(clean);
    setShowForm(false);
    setEditing(null);
  };

  const updateStatutorySection = (section, key, value) => {
    setStatutoryPolicyForm((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const updatePTSlab = (index, key, value) => {
    setStatutoryPolicyForm((prev) => {
      const slabs = [...(prev.pt?.slabs || [])];
      slabs[index] = { ...slabs[index], [key]: value };
      return { ...prev, pt: { ...prev.pt, slabs } };
    });
  };

  const addPTSlab = () => {
    setStatutoryPolicyForm((prev) => ({ ...prev, pt: { ...prev.pt, slabs: [...(prev.pt?.slabs || []), { min: 0, max: 0, employeeAmount: 0 }] } }));
  };

  const removePTSlab = (index) => {
    setStatutoryPolicyForm((prev) => ({ ...prev, pt: { ...prev.pt, slabs: (prev.pt?.slabs || []).filter((_, i) => i !== index) } }));
  };

  const saveSalaryRule = (event) => {
    event.preventDefault(); const clean = normalizeSalaryRule(salaryRuleForm);
    clean.code = String(clean.code || "").trim().toUpperCase(); clean.name = String(clean.name || "").trim(); clean.ruleVersion = String(clean.ruleVersion || "").trim().toUpperCase(); clean.workforceCategories = (clean.workforceCategories || []).filter(Boolean);
    if (!clean.code || !clean.name || !clean.ruleVersion || !clean.effectiveFrom) return window.alert("Salary Rule Code, Name, Effective From and Rule Version are required.");
    if (!clean.workforceCategories.length) return window.alert("Select at least one Workforce Category.");
    if (currentItems.some((item) => item.id !== editing?.id && String(item.code || "").toLowerCase() === clean.code.toLowerCase())) return window.alert("Salary Rule Code already exists.");
    if (currentItems.some((item) => item.id !== editing?.id && String(item.ruleVersion || "").toLowerCase() === clean.ruleVersion.toLowerCase())) return window.alert("Rule Version already exists.");
    const codes = new Set(); clean.components = clean.components.filter((component) => { const c = normalizeSalaryComponent(component); c.code = String(c.code || "").trim().toUpperCase(); c.name = String(c.name || "").trim(); c.value = Number(c.value) || 0; if (!c.code || !c.name || codes.has(c.code)) return false; codes.add(c.code); return true; });
    if (!clean.components.length) return window.alert("Add at least one salary component.");
    clean.id = editing?.id || `sal-${Date.now()}`; clean.active = clean.active !== false;
    saveMasters({ ...masters, salaryRules: editing ? currentItems.map((item) => item.id === editing.id ? clean : item) : [...currentItems, clean] });
    setSalaryRuleForm(clean); setShowForm(false); setEditing(null);
  };
  const updateSalaryRuleField = (key, value) => setSalaryRuleForm((prev) => ({ ...prev, [key]: value }));
  const toggleSalaryCategory = (id) => setSalaryRuleForm((prev) => { const set = new Set(prev.workforceCategories || []); set.has(id) ? set.delete(id) : set.add(id); return { ...prev, workforceCategories: [...set] }; });
  const updateSalaryComponent = (index, key, value) => setSalaryRuleForm((prev) => { const components = [...(prev.components || [])]; components[index] = { ...normalizeSalaryComponent(components[index]), [key]: value }; return { ...prev, components }; });
  const addSalaryComponent = () => setSalaryRuleForm((prev) => ({ ...prev, components: [...(prev.components || []), getDefaultSalaryComponent()] }));
  const removeSalaryComponent = (index) => setSalaryRuleForm((prev) => ({ ...prev, components: (prev.components || []).filter((_, i) => i !== index) }));

  const saveDeductionPolicy = (event) => {
    event.preventDefault();
    const clean = normalizeDeductionPolicy(deductionPolicyForm);
    clean.code = String(clean.code || "").trim().toUpperCase();
    clean.name = String(clean.name || "").trim();
    clean.ruleVersion = String(clean.ruleVersion || "").trim().toUpperCase();
    clean.workforceCategories = clean.workforceCategories.filter(Boolean);
    if (!clean.code || !clean.name || !clean.ruleVersion || !clean.effectiveFrom) return window.alert("Deduction Policy Code, Name, Effective From and Rule Version are required.");
    if (!clean.workforceCategories.length) return window.alert("Select at least one Workforce Category.");
    if (clean.maximumDeductionPercent < 0 || clean.maximumDeductionPercent > 100) return window.alert("Maximum deduction percentage must be between 0 and 100.");
    if (!clean.deductions.length) return window.alert("Add at least one deduction rule.");
    const codes = new Set();
    clean.deductions = clean.deductions.map(normalizeDeductionLine).filter((row) => { const code = String(row.code || "").trim().toUpperCase(); const name = String(row.name || "").trim(); if (!code || !name || codes.has(code)) return false; codes.add(code); row.code = code; row.name = name; row.priority = Math.max(1, Number(row.priority) || 1); row.maxPercent = Math.min(100, Math.max(0, Number(row.maxPercent) || 0)); return true; });
    if (!clean.deductions.length) return window.alert("Each deduction rule needs a unique Code and Name.");
    if ((masters.deductionPolicies || []).some((item) => item.id !== editing?.id && String(item.code || "").toLowerCase() === clean.code.toLowerCase())) return window.alert("Deduction Policy Code already exists.");
    if ((masters.deductionPolicies || []).some((item) => item.id !== editing?.id && String(item.ruleVersion || "").toLowerCase() === clean.ruleVersion.toLowerCase())) return window.alert("Deduction Rule Version already exists.");
    clean.id = editing?.id || `ded-${Date.now()}`;
    clean.active = clean.active !== false;
    const current = masters.deductionPolicies || [];
    saveMasters({ ...masters, deductionPolicies: editing ? current.map((item) => item.id === editing.id ? clean : item) : [...current, clean] });
    setDeductionPolicyForm(clean); setShowForm(false); setEditing(null);
  };

  const updateDeductionPolicyField = (key, value) => setDeductionPolicyForm((prev) => ({ ...prev, [key]: value }));
  const toggleDeductionCategory = (id) => setDeductionPolicyForm((prev) => { const selected = new Set(prev.workforceCategories || []); selected.has(id) ? selected.delete(id) : selected.add(id); return { ...prev, workforceCategories: [...selected] }; });
  const updateDeductionLine = (index, key, value) => setDeductionPolicyForm((prev) => { const rows = [...(prev.deductions || [])]; rows[index] = { ...normalizeDeductionLine(rows[index]), [key]: value }; return { ...prev, deductions: rows }; });
  const addDeductionLine = () => setDeductionPolicyForm((prev) => ({ ...prev, deductions: [...(prev.deductions || []), { ...getDefaultDeductionLine(), priority: (prev.deductions || []).length + 1 }] }));
  const removeDeductionLine = (index) => setDeductionPolicyForm((prev) => ({ ...prev, deductions: (prev.deductions || []).filter((_, i) => i !== index) }));

  const saveOTPolicy = (event) => {
    event.preventDefault();
    const clean = normalizeOTPolicy(otPolicyForm);
    clean.code = String(clean.code || "").trim().toUpperCase();
    clean.name = String(clean.name || "").trim();
    clean.ruleVersion = String(clean.ruleVersion || "").trim().toUpperCase();
    if (!clean.code || !clean.name || !clean.ruleVersion || !clean.effectiveFrom) {
      window.alert("OT Policy Code, Name, Effective From and Rule Version are required.");
      return;
    }
    if (!clean.workforceCategories.length) {
      window.alert("Select at least one Workforce Category.");
      return;
    }
    if (clean.otApplicable && !(clean.workingHoursPerDay > 0)) {
      window.alert("Working Hours per Day must be greater than 0.");
      return;
    }
    if (clean.weekdayMultiplier < 0 || clean.weeklyOffMultiplier < 0 || clean.holidayMultiplier < 0) {
      window.alert("OT multipliers cannot be negative.");
      return;
    }
    if ((masters.otPolicies || []).some((item) => item.id !== editing?.id && String(item.code || "").toLowerCase() === clean.code.toLowerCase())) {
      window.alert("OT Policy Code already exists.");
      return;
    }
    if ((masters.otPolicies || []).some((item) => item.id !== editing?.id && String(item.ruleVersion || "").toLowerCase() === clean.ruleVersion.toLowerCase())) {
      window.alert("OT Rule Version already exists.");
      return;
    }
    clean.id = editing?.id || `ot-${Date.now()}`;
    clean.active = clean.active !== false;
    const current = masters.otPolicies || [];
    const nextItems = editing ? current.map((item) => item.id === editing.id ? clean : item) : [...current, clean];
    saveMasters({ ...masters, otPolicies: nextItems });
    setOTPolicyForm(clean);
    setShowForm(false);
    setEditing(null);
  };

  const updateOTPolicyField = (key, value) => setOTPolicyForm((prev) => ({ ...prev, [key]: value }));
  const toggleOTCategory = (id) => setOTPolicyForm((prev) => {
    const selected = new Set(prev.workforceCategories || []);
    selected.has(id) ? selected.delete(id) : selected.add(id);
    return { ...prev, workforceCategories: [...selected] };
  });

  const saveShift = (event) => {
    event.preventDefault();

    const cleanCode = shiftForm.code.trim();
    const cleanName = shiftForm.name.trim();

    if (!cleanCode || !cleanName || !shiftForm.startTime || !shiftForm.endTime) {
      window.alert("Shift Code, Shift Name, Start Time and End Time are required.");
      return;
    }

    const duplicate = currentItems.some(
      (item) =>
        item.id !== editing?.id &&
        String(item.code || "").toLowerCase() === cleanCode.toLowerCase()
    );

    if (duplicate) {
      window.alert("Shift Code already exists.");
      return;
    }

    const nextShift = {
      ...normalizeShift(shiftForm),
      id: editing?.id || `shift-${Date.now()}`,
      code: cleanCode,
      name: cleanName,
      breaks: (shiftForm.breaks || []).filter(
        (item) => item.start && item.end
      ),
      active: editing?.active ?? true,
    };

    const nextItems = editing
      ? currentItems.map((item) => (item.id === editing.id ? nextShift : item))
      : [...currentItems, nextShift];

    saveMasters({ ...masters, shifts: nextItems });
    setShowForm(false);
    setEditing(null);
  };

  const saveCompOffPolicy = (event) => {
    event.preventDefault();

    let policyToSave = { ...policyForm };

    // If a leave type is currently being edited, commit the editor values
    // before saving the complete Leave & Comp Off policy.
    if (editingLeaveType && leaveTypeForm?.code) {
      const code = String(leaveTypeForm.code || "").trim().toUpperCase();
      const leaveTypes = (policyForm.leaveTypes || DEFAULT_LEAVE_TYPES).map(normalizeLeaveType);
      const nextLeaveType = normalizeLeaveType({
        ...leaveTypeForm,
        id: editingLeaveType.id,
        code,
      });

      policyToSave = {
        ...policyForm,
        leaveTypes: leaveTypes.map((item) =>
          item.id === editingLeaveType.id ? nextLeaveType : item
        ),
      };
    }

    const nextPolicy = normalizeLeavePolicy({
      ...policyToSave,
      id: policyToSave.id || "attendance-leave-policy",
      name: policyToSave.name || "Default Attendance & Leave Policy",
      active: policyToSave.active !== false,
    });

    saveMasters({ ...masters, leavePolicies: [nextPolicy] });
    setPolicyForm(nextPolicy);
    setShowForm(false);
    setEditing(null);
    setEditingLeaveType(null);
    setLeaveTypeForm(getDefaultLeaveType());
  };

  const updateLeaveType = (code, field, fieldValue) => {
    setPolicyForm((previous) => ({
      ...previous,
      leaveTypes: (previous.leaveTypes || DEFAULT_LEAVE_TYPES).map((item) =>
        item.code === code ? { ...item, [field]: fieldValue } : item
      ),
    }));
  };

  const updateLeaveTypeSection = (section, field, fieldValue) => {
    setLeaveTypeForm((previous) => ({
      ...previous,
      [section]: { ...(previous[section] || {}), [field]: fieldValue },
    }));
  };

  const startAddLeaveType = () => {
    setEditingLeaveType(null);
    setLeaveTypeForm(getDefaultLeaveType());
  };

  const startEditLeaveType = (item) => {
    setEditingLeaveType(item);
    setLeaveTypeForm(normalizeLeaveType(item));
  };

  const saveLeaveType = () => {
    const code = String(leaveTypeForm.code || "").trim().toUpperCase();
    const name = String(leaveTypeForm.name || "").trim();

    if (!code || !name) {
      window.alert("Leave Code and Leave Name are required.");
      return;
    }

    const leaveTypes = (policyForm.leaveTypes || DEFAULT_LEAVE_TYPES).map(normalizeLeaveType);
    const duplicate = leaveTypes.some((item) =>
      item.code.toLowerCase() === code.toLowerCase() && item.id !== editingLeaveType?.id
    );
    if (duplicate) {
      window.alert("Leave Code already exists.");
      return;
    }

    const nextLeaveType = normalizeLeaveType({ ...leaveTypeForm, id: editingLeaveType?.id || `leave-${Date.now()}`, code, name });
    const nextLeaveTypes = editingLeaveType
      ? leaveTypes.map((item) => item.id === editingLeaveType.id ? nextLeaveType : item)
      : [...leaveTypes, nextLeaveType];

    setPolicyForm((previous) => ({ ...previous, leaveTypes: nextLeaveTypes }));
    setEditingLeaveType(null);
    setLeaveTypeForm(getDefaultLeaveType());
  };

  const deleteLeaveType = (item) => {
    const confirmed = window.confirm(`Delete leave type "${item.code} - ${item.name}" permanently?`);
    if (!confirmed) return;
    setPolicyForm((previous) => ({
      ...previous,
      leaveTypes: (previous.leaveTypes || []).filter((row) => row.id !== item.id),
    }));
    if (editingLeaveType?.id === item.id) {
      setEditingLeaveType(null);
      setLeaveTypeForm(getDefaultLeaveType());
    }
  };

  const updateLopRule = (field, fieldValue) => {
    setPolicyForm((previous) => ({
      ...previous,
      lopRules: { ...(previous.lopRules || {}), [field]: fieldValue },
    }));
  };

  const saveHoliday = (event) => {
    event.preventDefault();
    const cleanName = String(holidayForm.name || "").trim();
    const cleanDate = String(holidayForm.date || "").trim();

    if (!cleanName || !cleanDate) {
      window.alert("Holiday Name and Date are required.");
      return;
    }

    const duplicate = (masters.holidays || []).some(
      (item) => item.id !== editing?.id && String(item.date) === cleanDate
    );
    if (duplicate) {
      window.alert("A holiday already exists for this date.");
      return;
    }

    const nextHoliday = {
      ...holidayForm,
      id: editing?.id || `holiday-${Date.now()}`,
      name: cleanName,
      date: cleanDate,
      paid: holidayForm.paid !== false,
      active: editing?.active ?? holidayForm.active ?? true,
    };

    const current = masters.holidays || [];
    const nextItems = editing
      ? current.map((item) => (item.id === editing.id ? nextHoliday : item))
      : [...current, nextHoliday];

    saveMasters({ ...masters, holidays: nextItems });
    setHolidayForm(nextHoliday);
    setShowForm(false);
    setEditing(null);
  };

  const updateShiftBreak = (breakId, field, fieldValue) => {
    setShiftForm((previous) => ({
      ...previous,
      breaks: previous.breaks.map((item) =>
        item.id === breakId ? { ...item, [field]: fieldValue } : item
      ),
    }));
  };

  const addShiftBreak = () => {
    setShiftForm((previous) => ({
      ...previous,
      breaks: [
        ...previous.breaks,
        {
          id: `break-${Date.now()}-${previous.breaks.length}`,
          name: `Break ${previous.breaks.length + 1}`,
          start: "",
          end: "",
        },
      ],
    }));
  };

  const removeShiftBreak = (breakId) => {
    setShiftForm((previous) => ({
      ...previous,
      breaks: previous.breaks.filter((item) => item.id !== breakId),
    }));
  };

  const saveWeekOffPolicy = (event) => {
    event.preventDefault();
    const cleanName = String(weekOffForm.name || "").trim();
    const cleanAssignment = weekOffForm.assignmentType === "All Employees"
      ? "Organisation-wide"
      : String(weekOffForm.assignmentValue || "").trim();

    if (!cleanName) {
      window.alert("Week-Off Policy Name is required.");
      return;
    }

    if (!cleanAssignment) {
      window.alert("Please select or enter the policy assignment.");
      return;
    }

    if (!weekOffForm.saturday && !weekOffForm.sunday) {
      window.alert("Select at least one weekly off day.");
      return;
    }

    const duplicate = (masters.weekOffPolicies || []).some(
      (item) => item.id !== editing?.id && item.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      window.alert("Week-Off Policy Name already exists.");
      return;
    }

    const nextPolicy = {
      ...weekOffForm,
      id: editing?.id || `weekoff-${Date.now()}`,
      name: cleanName,
      assignmentValue: cleanAssignment,
      active: editing?.active ?? weekOffForm.active ?? true,
    };

    const current = masters.weekOffPolicies || [];
    const nextItems = editing
      ? current.map((item) => (item.id === editing.id ? nextPolicy : item))
      : [...current, nextPolicy];

    saveMasters({ ...masters, weekOffPolicies: nextItems });
    setWeekOffForm(nextPolicy);
    setShowForm(false);
    setEditing(null);
  };

  const saveItem = (event) => {
    event.preventDefault();
    const cleanValue = value.trim();

    if (!cleanValue) return;

    const duplicate = currentItems.some(
      (item) =>
        item.id !== editing?.id &&
        item.name.toLowerCase() === cleanValue.toLowerCase()
    );

    if (duplicate) {
      window.alert(`${currentConfig.singular} already exists.`);
      return;
    }

    let nextItems;

    if (editing) {
      nextItems = currentItems.map((item) =>
        item.id === editing.id ? { ...item, name: cleanValue } : item
      );
    } else {
      nextItems = [
        ...currentItems,
        {
          id: `${activeMaster}-${Date.now()}`,
          name: cleanValue,
          active: true,
        },
      ];
    }

    saveMasters({ ...masters, [activeMaster]: nextItems });
    setShowForm(false);
    setEditing(null);
    setValue("");
  };

  const toggleStatus = (item) => {
    if (activeMaster === "leavePolicies") {
      const nextPolicy = { ...item, active: !item.active };
      saveMasters({ ...masters, leavePolicies: [nextPolicy] });
      setPolicyForm(nextPolicy);
      return;
    }

    if (activeMaster === "payrollProfiles") {
      const nextItems = currentItems.map((row) => row.id === item.id ? { ...row, active: !row.active } : row);
      saveMasters({ ...masters, payrollProfiles: nextItems });
      return;
    }

    if (activeMaster === "prorationRules") {
      const nextItems = currentItems.map((row) => row.id === item.id ? { ...row, active: !row.active } : row);
      saveMasters({ ...masters, prorationRules: nextItems });
      return;
    }

    if (activeMaster === "statutoryPolicies") {
      const nextItems = currentItems.map((row) => row.id === item.id ? { ...row, active: !row.active } : row);
      saveMasters({ ...masters, statutoryPolicies: nextItems });
      return;
    }
    if (activeMaster === "payrollCalendars") {
      const nextItems = currentItems.map((row) => row.id === item.id ? { ...row, active: !row.active } : row);
      saveMasters({ ...masters, payrollCalendars: nextItems });
      return;
    }
    if (activeMaster === "salaryRules") {
      const nextItems = currentItems.map((row) => row.id === item.id ? { ...row, active: !row.active } : row);
      saveMasters({ ...masters, salaryRules: nextItems });
      return;
    }
    if (activeMaster === "otPolicies") {
      const nextItems = currentItems.map((row) => row.id === item.id ? { ...row, active: !row.active } : row);
      saveMasters({ ...masters, otPolicies: nextItems });
      return;
    }

    if (activeMaster === "weekOffPolicies") {
      const nextItems = currentItems.map((row) =>
        row.id === item.id ? { ...row, active: !row.active } : row
      );
      saveMasters({ ...masters, weekOffPolicies: nextItems });
      return;
    }

    const nextItems = currentItems.map((row) =>
      row.id === item.id ? { ...row, active: !row.active } : row
    );

    saveMasters({ ...masters, [activeMaster]: nextItems });
  };

  const deleteItem = (item) => {
    const confirmed = window.confirm(
      `Delete "${item.name}" permanently? Use Deactivate when you only want to stop it from appearing in new selections.`
    );

    if (!confirmed) return;

    const nextItems = currentItems.filter((row) => row.id !== item.id);
    saveMasters({ ...masters, [activeMaster]: nextItems });
  };

  return (
    <div className="organization-page">
      <div className="organization-heading">
        <div>
          <span className="organization-eyebrow">MASTER CONFIGURATION</span>
          <h1>Organization</h1>
          <p>
            Maintain Bauer organization masters used across Employee,
            Attendance, Leave, Payroll and other HR modules.
          </p>
        </div>

        <button className="primary-action" onClick={openAdd}>
          <span className="button-plus">+</span>
          {activeMaster === "leavePolicies" || activeMaster === "payrollProfiles" || activeMaster === "statutoryPolicies" || activeMaster === "salaryRules" || activeMaster === "otPolicies" || activeMaster === "deductionPolicies" ? "Configure Policy" : `Add ${currentConfig.singular}`}
        </button>
      </div>

      <div className="organization-layout">
        <aside className="master-sidebar">
          <div className="master-sidebar-title">ORGANIZATION MASTERS</div>

          {MASTER_CONFIG.map((master) => (
            <button
              key={master.key}
              className={`master-nav master-nav-${master.key} ${
                activeMaster === master.key ? "active" : ""
              }`}
              onClick={() => {
                setActiveMaster(master.key);
                setSearch("");
                setShowInactive(false);
                setShowForm(false);
              }}
            >
              <span className="master-nav-icon">
                <MasterIcon type={master.key} />
              </span>
              <span>{master.label}</span>
              <b>{(masters[master.key] || []).filter((x) => x.active).length}</b>
            </button>
          ))}
        </aside>

        <section className="master-content">
          <div className="master-content-header">
            <div className="master-title-block">
              <div className="master-title-icon">
                <MasterIcon type={activeMaster} size={21} />
              </div>
              <div>
                <div className="master-title-kicker">MASTER DATA</div>
                <h2>{currentConfig.label}</h2>
                <p>{currentConfig.description}</p>
              </div>
            </div>

            <div className="master-header-actions">
              <label className="inactive-toggle">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show inactive
              </label>

              <button className="secondary-action" onClick={openAdd}>
                + {activeMaster === "leavePolicies" || activeMaster === "payrollProfiles" || activeMaster === "statutoryPolicies" || activeMaster === "salaryRules" || activeMaster === "otPolicies" || activeMaster === "deductionPolicies" ? "Configure" : "Add"}
              </button>
            </div>
          </div>

          <div className="master-toolbar">
            <div className="master-search">
              <span className="search-icon" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${currentConfig.label.toLowerCase()}...`}
              />
            </div>

            <span className="record-count">
              {filteredItems.length} record
              {filteredItems.length === 1 ? "" : "s"}
            </span>
          </div>

          {showForm && activeMaster === "workforceCategories" && (
            <form className="workforce-category-form policy-form" onSubmit={saveWorkforceCategory}>
              <div className="policy-form-title">
                <div>
                  <span>WORKFORCE & PAYROLL CONFIGURATION</span>
                  <h3>{editing ? "Edit Workforce Category" : "Add Workforce Category"}</h3>
                </div>
                <span className={`status-pill ${workforceCategoryForm.active ? "active" : "inactive"}`}>
                  {workforceCategoryForm.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="workforce-category-intro">
                <div className="workforce-category-icon"><MasterIcon type="workforceCategories" size={22} /></div>
                <div><strong>Configurable workforce classification</strong><span>Use this master for Company Roll, Third Party, Expatriate, Consultant or any customer-specific category. Payroll and vendor costing can consume these settings.</span></div>
              </div>
              <div className="workforce-category-grid">
                <label>Category Code *<input maxLength="12" value={workforceCategoryForm.code} onChange={(e) => setWorkforceCategoryForm({ ...workforceCategoryForm, code: e.target.value.toUpperCase() })} placeholder="e.g. CR" /></label>
                <label>Category Name *<input value={workforceCategoryForm.name} onChange={(e) => setWorkforceCategoryForm({ ...workforceCategoryForm, name: e.target.value })} placeholder="e.g. Company Roll" /></label>
                <label>Category Type<select value={workforceCategoryForm.categoryType} onChange={(e) => { const categoryType = e.target.value; setWorkforceCategoryForm({ ...workforceCategoryForm, categoryType, vendorRequired: categoryType === "THIRD_PARTY" ? true : workforceCategoryForm.vendorRequired, payrollProfile: categoryType === "THIRD_PARTY" ? "Third Party Worker" : categoryType === "EXPATRIATE" ? "Expat Payroll" : categoryType === "CONSULTANT" ? "Consultant Payroll" : "Standard Employee" }); }}>
                  <option value="COMPANY_ROLL">Company Roll</option><option value="THIRD_PARTY">Third Party</option><option value="EXPATRIATE">Expatriate</option><option value="CONSULTANT">Consultant</option><option value="OTHER">Other / Custom</option>
                </select></label>
                <label>Payroll Profile *<input value={workforceCategoryForm.payrollProfile} onChange={(e) => setWorkforceCategoryForm({ ...workforceCategoryForm, payrollProfile: e.target.value })} placeholder="e.g. Standard Employee" /></label>
              </div>
              <div className="workforce-switch-grid">
                <label className="policy-toggle"><span>Payroll Applicable</span><input type="checkbox" checked={Boolean(workforceCategoryForm.payrollApplicable)} onChange={(e) => setWorkforceCategoryForm({ ...workforceCategoryForm, payrollApplicable: e.target.checked })} /></label>
                <label className="policy-toggle"><span>Attendance Applicable</span><input type="checkbox" checked={Boolean(workforceCategoryForm.attendanceApplicable)} onChange={(e) => setWorkforceCategoryForm({ ...workforceCategoryForm, attendanceApplicable: e.target.checked })} /></label>
                <label className="policy-toggle"><span>Vendor Required</span><input type="checkbox" checked={Boolean(workforceCategoryForm.vendorRequired)} onChange={(e) => setWorkforceCategoryForm({ ...workforceCategoryForm, vendorRequired: e.target.checked })} /></label>
                <label className="policy-toggle"><span>Active</span><input type="checkbox" checked={workforceCategoryForm.active !== false} onChange={(e) => setWorkforceCategoryForm({ ...workforceCategoryForm, active: e.target.checked })} /></label>
              </div>
              <div className="policy-note"><strong>Payroll integration:</strong> Active categories will be available for employee assignment. Vendor Required tells Payroll that a vendor relationship is expected; vendor costing remains a Payroll reporting/costing view.</div>
              <div className="master-form-actions"><button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-action">{editing ? "Update Workforce Category" : "Save Workforce Category"}</button></div>
            </form>
          )}

          {showForm && activeMaster === "payrollCalendars" && (
            <form className="payroll-calendar-form policy-form" onSubmit={savePayrollCalendar}>
              <div className="policy-form-title">
                <div>
                  <span>PAYROLL CALENDAR CONFIGURATION</span>
                  <h3>{editing ? "Edit Payroll Calendar" : "Add Payroll Calendar"}</h3>
                  <small>Define the payroll period, attendance cut-off, processing window, approval date and salary payable date. Payroll consumes this configuration by effective date.</small>
                </div>
                <span className={`status-pill ${payrollCalendarForm.active ? "active" : "inactive"}`}>
                  {payrollCalendarForm.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="payroll-calendar-intro">
                <div className="payroll-calendar-icon"><MasterIcon type="payrollCalendars" size={23} /></div>
                <div>
                  <strong>Central Payroll Calendar</strong>
                  <span>This is an Organization master. Payroll should not hard-code cut-off, processing or salary payment dates.</span>
                </div>
              </div>

              <div className="payroll-calendar-section">
                <div className="payroll-calendar-section-title"><b>Calendar Identity</b><small>Basic identification and effective period.</small></div>
                <div className="payroll-calendar-grid">
                  <label>Calendar Code *<input maxLength="30" value={payrollCalendarForm.code} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, code: e.target.value.toUpperCase() })} placeholder="e.g. CAL-MON-2026" /></label>
                  <label>Calendar Name *<input value={payrollCalendarForm.name} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, name: e.target.value })} placeholder="e.g. Monthly Payroll 2026-27" /></label>
                  <label>Frequency<select value={payrollCalendarForm.frequency} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, frequency: e.target.value })}><option value="MONTHLY">Monthly</option><option value="BI_MONTHLY">Bi-Monthly</option><option value="WEEKLY">Weekly</option><option value="FORTNIGHTLY">Fortnightly</option></select></label>
                  <label>Effective From *<input type="date" value={payrollCalendarForm.effectiveFrom} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, effectiveFrom: e.target.value })} /></label>
                  <label>Effective To<input type="date" value={payrollCalendarForm.effectiveTo || ""} min={payrollCalendarForm.effectiveFrom || undefined} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, effectiveTo: e.target.value })} /></label>
                </div>
                <label className="calendar-full-field">Description<textarea rows="2" value={payrollCalendarForm.description} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, description: e.target.value })} placeholder="Describe where and how this payroll calendar is used." /></label>
              </div>

              <div className="payroll-calendar-section">
                <div className="payroll-calendar-section-title"><b>Payroll Cycle Dates</b><small>These values are consumed by Payroll Processing.</small></div>
                <div className="payroll-calendar-grid payroll-calendar-grid-4">
                  <label>Period Start Day<input type="number" min="1" max="31" value={payrollCalendarForm.periodStartDay} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, periodStartDay: e.target.value })} /></label>
                  <label>Period End<select value={payrollCalendarForm.periodEndDay} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, periodEndDay: e.target.value })}><option value="LAST_DAY">Last Day of Month</option><option value="28">28</option><option value="29">29</option><option value="30">30</option><option value="31">31</option></select></label>
                  <label>Attendance Cut-off Day<input type="number" min="1" max="31" value={payrollCalendarForm.attendanceCutoffDay} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, attendanceCutoffDay: e.target.value })} /></label>
                  <label>Processing Start Day<input type="number" min="1" max="31" value={payrollCalendarForm.payrollProcessingStartDay} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, payrollProcessingStartDay: e.target.value })} /></label>
                  <label>Processing End Day<input type="number" min="1" max="31" value={payrollCalendarForm.payrollProcessingEndDay} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, payrollProcessingEndDay: e.target.value })} /></label>
                  <label>Approval Day<input type="number" min="1" max="31" value={payrollCalendarForm.approvalDay} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, approvalDay: e.target.value })} /></label>
                  <label>Salary Payable Day<input type="number" min="1" max="31" value={payrollCalendarForm.salaryPayableDay} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, salaryPayableDay: e.target.value })} /></label>
                </div>
              </div>

              <div className="payroll-calendar-section">
                <div className="payroll-calendar-section-title"><b>Workforce Category Applicability</b><small>Select which workforce categories use this payroll calendar.</small></div>
                <div className="calendar-category-grid">
                  {(masters.workforceCategories || []).filter((c) => c.active !== false).map((category) => {
                    const selected = (payrollCalendarForm.workforceCategories || []).includes(category.id);
                    return (
                      <label className={`calendar-category-card ${selected ? "selected" : ""}`} key={category.id}>
                        <input type="checkbox" checked={selected} onChange={() => setPayrollCalendarForm((prev) => ({ ...prev, workforceCategories: selected ? prev.workforceCategories.filter((id) => id !== category.id) : [...prev.workforceCategories, category.id] }))} />
                        <span><strong>{category.name}</strong><small>{category.code} · {category.payrollProfile || "Payroll"}</small></span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="payroll-calendar-section">
                <div className="payroll-calendar-section-title"><b>Automation</b><small>Optional workflow controls. Keep disabled if your organisation wants manual payroll control.</small></div>
                <div className="calendar-automation-grid">
                  <label className="policy-toggle"><span>Auto Lock Attendance</span><input type="checkbox" checked={Boolean(payrollCalendarForm.autoLockAttendance)} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, autoLockAttendance: e.target.checked })} /></label>
                  <label className="policy-toggle"><span>Auto Calculate Paid Days</span><input type="checkbox" checked={Boolean(payrollCalendarForm.autoCalculatePaidDays)} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, autoCalculatePaidDays: e.target.checked })} /></label>
                  <label className="policy-toggle"><span>Auto Create Payroll Run</span><input type="checkbox" checked={Boolean(payrollCalendarForm.autoCreatePayrollRun)} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, autoCreatePayrollRun: e.target.checked })} /></label>
                  <label className="policy-toggle"><span>Active</span><input type="checkbox" checked={payrollCalendarForm.active !== false} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, active: e.target.checked })} /></label>
                </div>
              </div>

              <label className="calendar-full-field">Notes<textarea rows="3" value={payrollCalendarForm.notes} onChange={(e) => setPayrollCalendarForm({ ...payrollCalendarForm, notes: e.target.value })} placeholder="Add implementation notes for Payroll / HR / Finance." /></label>

              <div className="policy-note"><strong>Payroll integration:</strong> Payroll will select the applicable active calendar using Workforce Category + payroll period/effective date. Historical payroll runs should retain the calendar version used when they were finalized.</div>

              <div className="master-form-actions">
                <button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-action">{editing ? "Update Payroll Calendar" : "Save Payroll Calendar"}</button>
              </div>
            </form>
          )}

          {showForm && activeMaster === "prorationRules" && (
            <form className="proration-rule-form policy-form" onSubmit={saveProrationRule}>
              <div className="policy-form-title">
                <div><span>PRORATION RULE CONFIGURATION</span><h3>{editing ? "Edit Proration Rule" : "Add Proration Rule"}</h3></div>
                <label className="policy-switch"><input type="checkbox" checked={prorationRuleForm.active} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, active: e.target.checked })} /><span>Active</span></label>
              </div>
              <div className="proration-rule-grid">
                <label>Rule Code *<input value={prorationRuleForm.code} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, code: e.target.value.toUpperCase() })} placeholder="e.g. STD-PROR" /></label>
                <label>Rule Name *<input value={prorationRuleForm.name} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, name: e.target.value })} placeholder="e.g. Standard Monthly Proration" /></label>
                <label>Effective From *<input type="date" value={prorationRuleForm.effectiveFrom} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, effectiveFrom: e.target.value })} /></label>
                <label>Effective To<input type="date" value={prorationRuleForm.effectiveTo} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, effectiveTo: e.target.value })} /></label>
                <label>Salary Proration<select value={prorationRuleForm.salaryProration} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, salaryProration: e.target.value })}><option value="PAID_DAYS">Paid Days</option><option value="WORKING_DAYS">Working Days</option><option value="CALENDAR_DAYS">Calendar Days</option><option value="NO_PRORATION">No Proration</option></select></label>
                <label>Denominator Basis<select value={prorationRuleForm.denominatorBasis} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, denominatorBasis: e.target.value })}><option value="CALENDAR_DAYS">Calendar Days</option><option value="WORKING_DAYS">Working Days</option><option value="FIXED_26_DAYS">Fixed 26 Days</option><option value="FIXED_30_DAYS">Fixed 30 Days</option></select></label>
                <label>Rounding Rule<select value={prorationRuleForm.roundingRule} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, roundingRule: e.target.value })}><option value="NEAREST_RUPEE">Nearest Rupee</option><option value="ROUND_DOWN">Round Down</option><option value="ROUND_UP">Round Up</option><option value="NO_ROUNDING">No Rounding</option></select></label>
                <label>Minimum Payable Days<input type="number" min="0" step="0.5" value={prorationRuleForm.minimumPayableDays} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, minimumPayableDays: e.target.value })} /></label>
              </div>
              <div className="policy-section"><div className="policy-section-title">Proration Treatment</div><div className="policy-check-grid proration-check-grid">
                <label className="policy-check"><input type="checkbox" checked={prorationRuleForm.joiningProration} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, joiningProration: e.target.checked })} /><span>Prorate on Joining</span></label>
                <label className="policy-check"><input type="checkbox" checked={prorationRuleForm.exitProration} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, exitProration: e.target.checked })} /><span>Prorate on Exit</span></label>
                <label className="policy-check"><input type="checkbox" checked={prorationRuleForm.lopProration} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, lopProration: e.target.checked })} /><span>Prorate LOP</span></label>
                <label className="policy-check"><input type="checkbox" checked={prorationRuleForm.paidLeaveIncluded} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, paidLeaveIncluded: e.target.checked })} /><span>Paid Leave Included</span></label>
                <label className="policy-check"><input type="checkbox" checked={prorationRuleForm.weeklyOffIncluded} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, weeklyOffIncluded: e.target.checked })} /><span>Weekly Off Included</span></label>
                <label className="policy-check"><input type="checkbox" checked={prorationRuleForm.holidayIncluded} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, holidayIncluded: e.target.checked })} /><span>Holiday Included</span></label>
              </div></div>
              <div className="policy-section"><div className="policy-section-title">Applicable Workforce Categories</div><div className="policy-check-grid">{(masters.workforceCategories || []).filter((x) => x.active).map((cat) => <label key={cat.id} className="policy-check"><input type="checkbox" checked={prorationRuleForm.workforceCategories.includes(cat.id)} onChange={() => setProrationRuleForm((prev) => { const set = new Set(prev.workforceCategories || []); set.has(cat.id) ? set.delete(cat.id) : set.add(cat.id); return { ...prev, workforceCategories: [...set] }; })} /><span>{cat.name}</span></label>)}</div></div>
              <label className="proration-notes-field">Notes<textarea rows="3" value={prorationRuleForm.notes} onChange={(e) => setProrationRuleForm({ ...prorationRuleForm, notes: e.target.value })} placeholder="Optional calculation note or business rule." /></label>
              <div className="policy-form-actions"><button type="button" className="secondary-action" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button><button type="submit" className="primary-action">{editing ? "Update Rule" : "Save Rule"}</button></div>
            </form>
          )}

          {showForm && activeMaster === "payrollProfiles" && (
            <form className="payroll-profile-form policy-form" onSubmit={savePayrollProfile}>
              <div className="policy-form-title">
                <div><span>PAYROLL PROFILE CONFIGURATION</span><h3>{editing ? "Edit Payroll Profile" : "Add Payroll Profile"}</h3></div>
              </div>
              <div className="payroll-profile-grid">
                <label>Profile Code *<input value={payrollProfileForm.code} onChange={(e) => setPayrollProfileForm({ ...payrollProfileForm, code: e.target.value.toUpperCase() })} placeholder="e.g. STD-EMP" /></label>
                <label>Profile Name *<input value={payrollProfileForm.name} onChange={(e) => setPayrollProfileForm({ ...payrollProfileForm, name: e.target.value })} placeholder="e.g. Standard Employee" /></label>
                <label>Payment Frequency<select value={payrollProfileForm.paymentFrequency} onChange={(e) => setPayrollProfileForm({ ...payrollProfileForm, paymentFrequency: e.target.value })}><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option><option value="FORTNIGHTLY">Fortnightly</option></select></label>
                <label>Proration Method<select value={payrollProfileForm.prorationMethod} onChange={(e) => setPayrollProfileForm({ ...payrollProfileForm, prorationMethod: e.target.value })}><option value="PAID_DAYS">Paid Days</option><option value="WORKING_DAYS">Working Days</option><option value="CALENDAR_DAYS">Calendar Days</option><option value="NO_PRORATION">No Proration</option></select></label>
                <label>Working Days Basis<select value={payrollProfileForm.workingDaysBasis} onChange={(e) => setPayrollProfileForm({ ...payrollProfileForm, workingDaysBasis: e.target.value })}><option value="CALENDAR_DAYS">Calendar Days</option><option value="WORKING_DAYS">Working Days</option></select></label>
                <label>Payroll Calendar<select value={payrollProfileForm.payrollCalendarId} onChange={(e) => setPayrollProfileForm({ ...payrollProfileForm, payrollCalendarId: e.target.value })}><option value="">Select Calendar</option>{(masters.payrollCalendars || []).filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              </div>
              <div className="policy-section"><div className="policy-section-title">Applicable Workforce Categories</div><div className="policy-check-grid">{(masters.workforceCategories || []).filter((x) => x.active).map((cat) => <label key={cat.id} className="policy-check"><input type="checkbox" checked={payrollProfileForm.workforceCategories.includes(cat.id)} onChange={() => setPayrollProfileForm((prev) => { const set = new Set(prev.workforceCategories || []); set.has(cat.id) ? set.delete(cat.id) : set.add(cat.id); return { ...prev, workforceCategories: [...set] }; })} /><span>{cat.name}</span></label>)}</div></div>
              <div className="policy-form-actions"><button type="button" className="secondary-action" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button><button type="submit" className="primary-action">{editing ? "Update Profile" : "Save Profile"}</button></div>
            </form>
          )}

          {showForm && activeMaster === "statutoryPolicies" && (
            <form className="statutory-policy-form" onSubmit={saveStatutoryPolicy}>
              <div className="statutory-form-header">
                <div><span>STATUTORY POLICY CONFIGURATION</span><h3>{editing ? "Edit Statutory Policy" : "Add Statutory Policy"}</h3></div>
                <label className="policy-switch"><input type="checkbox" checked={statutoryPolicyForm.active} onChange={(e) => setStatutoryPolicyForm({ ...statutoryPolicyForm, active: e.target.checked })} /><span>Active</span></label>
              </div>
              <div className="statutory-basic-grid">
                <label>Policy Name *<input value={statutoryPolicyForm.name} onChange={(e) => setStatutoryPolicyForm({ ...statutoryPolicyForm, name: e.target.value })} placeholder="e.g. India Statutory FY 2026-27" /></label>
                <label>Effective From *<input type="date" value={statutoryPolicyForm.effectiveFrom} onChange={(e) => setStatutoryPolicyForm({ ...statutoryPolicyForm, effectiveFrom: e.target.value })} /></label>
                <label>Rule Version *<input value={statutoryPolicyForm.ruleVersion} onChange={(e) => setStatutoryPolicyForm({ ...statutoryPolicyForm, ruleVersion: e.target.value.toUpperCase() })} placeholder="e.g. STAT-2026-27-V1" /></label>
              </div>
              <div className="statutory-rule-grid">
                <div className="statutory-rule-card">
                  <div className="statutory-rule-title"><div><b>PF / EPF</b><small>Employee and employer contribution</small></div><input type="checkbox" checked={statutoryPolicyForm.pf.enabled} onChange={(e) => updateStatutorySection("pf", "enabled", e.target.checked)} /></div>
                  <div className="statutory-fields">
                    <label>Employee %<input type="number" step="0.01" value={statutoryPolicyForm.pf.employeeRate} onChange={(e) => updateStatutorySection("pf", "employeeRate", e.target.value)} /></label>
                    <label>Employer %<input type="number" step="0.01" value={statutoryPolicyForm.pf.employerRate} onChange={(e) => updateStatutorySection("pf", "employerRate", e.target.value)} /></label>
                    <label>Wage Ceiling<input type="number" value={statutoryPolicyForm.pf.wageCeiling} onChange={(e) => updateStatutorySection("pf", "wageCeiling", e.target.value)} /></label>
                    <label className="check-field"><input type="checkbox" checked={statutoryPolicyForm.pf.includeBasicDa} onChange={(e) => updateStatutorySection("pf", "includeBasicDa", e.target.checked)} /> Include Basic + DA</label>
                  </div>
                </div>
                <div className="statutory-rule-card">
                  <div className="statutory-rule-title"><div><b>ESI</b><small>Employee and employer contribution</small></div><input type="checkbox" checked={statutoryPolicyForm.esi.enabled} onChange={(e) => updateStatutorySection("esi", "enabled", e.target.checked)} /></div>
                  <div className="statutory-fields">
                    <label>Employee %<input type="number" step="0.01" value={statutoryPolicyForm.esi.employeeRate} onChange={(e) => updateStatutorySection("esi", "employeeRate", e.target.value)} /></label>
                    <label>Employer %<input type="number" step="0.01" value={statutoryPolicyForm.esi.employerRate} onChange={(e) => updateStatutorySection("esi", "employerRate", e.target.value)} /></label>
                    <label>Wage Ceiling<input type="number" value={statutoryPolicyForm.esi.wageCeiling} onChange={(e) => updateStatutorySection("esi", "wageCeiling", e.target.value)} /></label>
                    <label className="check-field"><input type="checkbox" checked={statutoryPolicyForm.esi.includeBasicDa} onChange={(e) => updateStatutorySection("esi", "includeBasicDa", e.target.checked)} /> Use Basic + DA basis</label>
                  </div>
                </div>
                <div className="statutory-rule-card statutory-wide-card">
                  <div className="statutory-rule-title"><div><b>Professional Tax (PT)</b><small>State-wise employee deduction slabs</small></div><input type="checkbox" checked={statutoryPolicyForm.pt.enabled} onChange={(e) => updateStatutorySection("pt", "enabled", e.target.checked)} /></div>
                  <div className="statutory-fields pt-top-fields"><label>State<input value={statutoryPolicyForm.pt.state} onChange={(e) => updateStatutorySection("pt", "state", e.target.value)} placeholder="e.g. Haryana" /></label></div>
                  <div className="pt-slab-table"><div className="pt-slab-head"><span>Min Gross</span><span>Max Gross</span><span>Employee PT</span><span></span></div>{(statutoryPolicyForm.pt.slabs || []).map((slab, index) => <div className="pt-slab-row" key={index}><input type="number" value={slab.min} onChange={(e) => updatePTSlab(index, "min", e.target.value)} /><input type="number" value={slab.max} onChange={(e) => updatePTSlab(index, "max", e.target.value)} /><input type="number" value={slab.employeeAmount} onChange={(e) => updatePTSlab(index, "employeeAmount", e.target.value)} /><button type="button" className="icon-delete" onClick={() => removePTSlab(index)} disabled={(statutoryPolicyForm.pt.slabs || []).length <= 1}>×</button></div>)}</div>
                  <button type="button" className="secondary-action add-slab-btn" onClick={addPTSlab}>+ Add PT Slab</button>
                </div>
                <div className="statutory-rule-card">
                  <div className="statutory-rule-title"><div><b>LWF</b><small>Labour Welfare Fund contribution</small></div><input type="checkbox" checked={statutoryPolicyForm.lwf.enabled} onChange={(e) => updateStatutorySection("lwf", "enabled", e.target.checked)} /></div>
                  <div className="statutory-fields"><label>Employee Amount<input type="number" value={statutoryPolicyForm.lwf.employeeAmount} onChange={(e) => updateStatutorySection("lwf", "employeeAmount", e.target.value)} /></label><label>Employer Amount<input type="number" value={statutoryPolicyForm.lwf.employerAmount} onChange={(e) => updateStatutorySection("lwf", "employerAmount", e.target.value)} /></label><label>Frequency<select value={statutoryPolicyForm.lwf.frequency} onChange={(e) => updateStatutorySection("lwf", "frequency", e.target.value)}><option>MONTHLY</option><option>QUARTERLY</option><option>HALF_YEARLY</option><option>YEARLY</option></select></label></div>
                </div>
              </div>
              <div className="policy-note"><strong>Payroll integration:</strong> Payroll will consume the active policy by effective date. Workforce Category applicability and employee-level statutory eligibility remain separate controls.</div>
              <div className="master-form-actions"><button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-action">{editing ? "Update Statutory Policy" : "Save Statutory Policy"}</button></div>
            </form>
          )}

          {showForm && activeMaster === "salaryRules" && (
            <form className="salary-rule-form" onSubmit={saveSalaryRule}>
              <div className="salary-rule-header"><div><span>SALARY RULE CONFIGURATION</span><h3>{editing ? "Edit Salary Rule" : "Add Salary Rule"}</h3><small>Configure salary components once here; Payroll will consume the rule by workforce category and effective date.</small></div><label className="policy-switch"><input type="checkbox" checked={salaryRuleForm.active} onChange={(e) => updateSalaryRuleField("active", e.target.checked)} /><span>Active</span></label></div>
              <div className="salary-rule-basic-grid">
                <label>Rule Code *<input value={salaryRuleForm.code} onChange={(e) => updateSalaryRuleField("code", e.target.value.toUpperCase())} placeholder="e.g. STD-EMP" /></label>
                <label>Rule Name *<input value={salaryRuleForm.name} onChange={(e) => updateSalaryRuleField("name", e.target.value)} placeholder="e.g. Standard Employee Salary" /></label>
                <label>Effective From *<input type="date" value={salaryRuleForm.effectiveFrom} onChange={(e) => updateSalaryRuleField("effectiveFrom", e.target.value)} /></label>
                <label>Rule Version *<input value={salaryRuleForm.ruleVersion} onChange={(e) => updateSalaryRuleField("ruleVersion", e.target.value.toUpperCase())} placeholder="e.g. SAL-2026-27-V1" /></label>
                <label>Proration Method<select value={salaryRuleForm.prorationMethod} onChange={(e) => updateSalaryRuleField("prorationMethod", e.target.value)}><option value="PAID_DAYS">Paid Days</option><option value="CALENDAR_DAYS">Calendar Days</option><option value="WORKING_DAYS">Working Days</option><option value="NO_PRORATION">No Proration</option></select></label>
                <label>Working Days Basis<select value={salaryRuleForm.workingDaysBasis} onChange={(e) => updateSalaryRuleField("workingDaysBasis", e.target.value)}><option value="CALENDAR_DAYS">Calendar Days</option><option value="WORKING_DAYS">Working Days</option><option value="FIXED_26">Fixed 26 Days</option><option value="FIXED_30">Fixed 30 Days</option></select></label>
              </div>
              <div className="salary-rule-section"><div className="salary-rule-section-title"><div><b>Workforce Category Applicability</b><small>Select which workforce categories can use this salary rule.</small></div></div><div className="salary-category-grid">{(masters.workforceCategories || []).filter((c) => c.active !== false).map((category) => <label className={`salary-category-option ${(salaryRuleForm.workforceCategories || []).includes(category.id) ? "selected" : ""}`} key={category.id}><input type="checkbox" checked={(salaryRuleForm.workforceCategories || []).includes(category.id)} onChange={() => toggleSalaryCategory(category.id)} /><span><strong>{category.name}</strong><small>{category.code} · {category.payrollProfile || "Payroll"}</small></span></label>)}</div></div>
              <div className="salary-rule-section"><div className="salary-rule-section-title"><div><b>Salary Components</b><small>Fixed, percentage or balance. PF/ESI flags tell Payroll whether this component is included in the applicable statutory wage basis.</small></div><button type="button" className="secondary-action" onClick={addSalaryComponent}>+ Add Component</button></div>
                <div className="salary-component-table-wrap"><table className="salary-component-table"><thead><tr><th>Code</th><th>Component</th><th>Calculation</th><th>Value</th><th>Basis</th><th>Paid Days</th><th>LOP</th><th>PF</th><th>ESI</th><th>Taxable</th><th></th></tr></thead><tbody>{(salaryRuleForm.components || []).map((component, index) => { const c = normalizeSalaryComponent(component); return <tr key={c.id || index}><td><input value={c.code} onChange={(e) => updateSalaryComponent(index, "code", e.target.value.toUpperCase())} placeholder="BASIC" /></td><td><input value={c.name} onChange={(e) => updateSalaryComponent(index, "name", e.target.value)} placeholder="Basic" /></td><td><select value={c.calculationType} onChange={(e) => updateSalaryComponent(index, "calculationType", e.target.value)}><option value="FIXED">Fixed Amount</option><option value="PERCENTAGE_OF_GROSS">% of Gross</option><option value="PERCENTAGE_OF_BASIC">% of Basic</option><option value="PERCENTAGE_OF_BASIC_DA">% of Basic + DA</option><option value="BALANCE">Balance</option></select></td><td><input type="number" step="0.01" value={c.value} disabled={c.calculationType === "BALANCE"} onChange={(e) => updateSalaryComponent(index, "value", e.target.value)} /></td><td><select value={c.amountBasis} onChange={(e) => updateSalaryComponent(index, "amountBasis", e.target.value)}><option value="FIXED">Fixed</option><option value="GROSS">Gross</option><option value="BASIC">Basic</option><option value="BASIC_DA">Basic + DA</option><option value="BALANCE">Balance</option></select></td><td><input type="checkbox" checked={c.paidDaysBased} onChange={(e) => updateSalaryComponent(index, "paidDaysBased", e.target.checked)} /></td><td><input type="checkbox" checked={c.lopApplicable} onChange={(e) => updateSalaryComponent(index, "lopApplicable", e.target.checked)} /></td><td><input type="checkbox" checked={c.pfApplicable} onChange={(e) => updateSalaryComponent(index, "pfApplicable", e.target.checked)} /></td><td><input type="checkbox" checked={c.esiApplicable} onChange={(e) => updateSalaryComponent(index, "esiApplicable", e.target.checked)} /></td><td><input type="checkbox" checked={c.taxable} onChange={(e) => updateSalaryComponent(index, "taxable", e.target.checked)} /></td><td><button type="button" className="icon-delete" onClick={() => removeSalaryComponent(index)}>×</button></td></tr>; })}</tbody></table></div>
              </div>
              <div className="salary-rule-preview"><div><b>Illustrative preview on ₹1,00,000 Gross</b><small>Preview only. Actual Payroll uses employee salary, attendance and the effective statutory policy.</small></div><div className="salary-preview-chips">{calculateSalaryRulePreview(salaryRuleForm).map((row) => <span key={row.id || row.code}><b>{row.name}</b> ₹{Math.round(row.preview || 0).toLocaleString("en-IN")}</span>)}</div></div>
              <div className="policy-note"><strong>Statutory integration:</strong> PF/ESI applicability is configured at component level; actual rates and wage ceilings come from the effective Statutory Policy. The current EPF mandatory coverage ceiling is ₹25,000 from 17-Sep-2026.</div>
              <div className="master-form-actions"><button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-action">{editing ? "Update Salary Rule" : "Save Salary Rule"}</button></div>
            </form>
          )}

          {showForm && activeMaster === "deductionPolicies" && (
            <form className="deduction-policy-form" onSubmit={saveDeductionPolicy}>
              <div className="deduction-form-header"><div><span>PAYROLL DEDUCTION POLICY</span><h3>{editing ? "Edit Deduction Policy" : "Add Deduction Policy"}</h3><small>Configure deduction behaviour once and let Payroll consume the active policy by workforce category and effective date.</small></div><label className="policy-switch"><input type="checkbox" checked={deductionPolicyForm.active} onChange={(e) => updateDeductionPolicyField("active", e.target.checked)} /><span>Active</span></label></div>
              <div className="deduction-basic-grid">
                <label>Policy Code *<input value={deductionPolicyForm.code} onChange={(e) => updateDeductionPolicyField("code", e.target.value.toUpperCase())} placeholder="e.g. STD-DEDUCT" /></label>
                <label>Policy Name *<input value={deductionPolicyForm.name} onChange={(e) => updateDeductionPolicyField("name", e.target.value)} placeholder="e.g. Standard Deduction Policy" /></label>
                <label>Effective From *<input type="date" value={deductionPolicyForm.effectiveFrom} onChange={(e) => updateDeductionPolicyField("effectiveFrom", e.target.value)} /></label>
                <label>Rule Version *<input value={deductionPolicyForm.ruleVersion} onChange={(e) => updateDeductionPolicyField("ruleVersion", e.target.value.toUpperCase())} placeholder="e.g. DED-2026-27-V1" /></label>
              </div>
              <div className="deduction-policy-section"><div className="salary-rule-section-title"><div><b>Workforce Applicability</b><small>Select where this deduction policy can be used.</small></div></div><div className="deduction-category-grid">{(masters.workforceCategories || []).filter((x) => x.active !== false).map((category) => <label className={`deduction-category-chip ${(deductionPolicyForm.workforceCategories || []).includes(category.id) ? "selected" : ""}`} key={category.id}><input type="checkbox" checked={(deductionPolicyForm.workforceCategories || []).includes(category.id)} onChange={() => toggleDeductionCategory(category.id)} /><span><strong>{category.name}</strong><small>{category.code}</small></span></label>)}</div></div>
              <div className="deduction-policy-section"><div className="salary-rule-section-title"><div><b>Deduction Controls</b><small>Controls for total deduction exposure and processing.</small></div></div><div className="deduction-control-grid">
                <label>Maximum Deduction % of Net Pay<input type="number" min="0" max="100" step="1" value={deductionPolicyForm.maximumDeductionPercent} onChange={(e) => updateDeductionPolicyField("maximumDeductionPercent", e.target.value)} /></label>
                <label>Priority Mode<select value={deductionPolicyForm.priorityMode} onChange={(e) => updateDeductionPolicyField("priorityMode", e.target.value)}><option value="ORDERED">Priority Order</option><option value="LOWEST_FIRST">Lowest Priority Number First</option><option value="MANUAL">Manual Review</option></select></label>
              </div><div className="deduction-switch-grid"><label className="policy-toggle"><span>Stop when Net Pay reaches zero</span><input type="checkbox" checked={deductionPolicyForm.stopWhenNetPayZero} onChange={(e) => updateDeductionPolicyField("stopWhenNetPayZero", e.target.checked)} /></label><label className="policy-toggle"><span>Approval Required</span><input type="checkbox" checked={deductionPolicyForm.approvalRequired} onChange={(e) => updateDeductionPolicyField("approvalRequired", e.target.checked)} /></label></div></div>
              <div className="deduction-policy-section"><div className="salary-rule-section-title"><div><b>Deduction Rules</b><small>Loan, Food, Recovery and custom deductions can be configured here.</small></div><button type="button" className="secondary-small-btn" onClick={addDeductionLine}>+ Add Deduction</button></div>
                <div className="deduction-rule-list">{(deductionPolicyForm.deductions || []).map((row, index) => <div className="deduction-rule-row" key={row.id || index}>
                  <label>Code<input value={row.code} onChange={(e) => updateDeductionLine(index, "code", e.target.value.toUpperCase())} placeholder="LOAN" /></label>
                  <label>Name<input value={row.name} onChange={(e) => updateDeductionLine(index, "name", e.target.value)} placeholder="Loan / Advance" /></label>
                  <label>Type<select value={row.type} onChange={(e) => updateDeductionLine(index, "type", e.target.value)}><option value="LOAN_ADVANCE">Loan / Advance</option><option value="FOOD">Food Deduction</option><option value="RECOVERY">Recovery</option><option value="OTHER">Other Deduction</option><option value="CUSTOM">Custom</option></select></label>
                  <label>Calculation<select value={row.calculationType} onChange={(e) => updateDeductionLine(index, "calculationType", e.target.value)}><option value="FIXED">Fixed Amount</option><option value="PERCENTAGE_OF_NET">% of Net Pay</option><option value="PERCENTAGE_OF_GROSS">% of Gross</option><option value="MANUAL">Manual</option></select></label>
                  <label>Default Value<input type="number" min="0" step="0.01" value={row.value} onChange={(e) => updateDeductionLine(index, "value", e.target.value)} /></label>
                  <label>Priority<input type="number" min="1" step="1" value={row.priority} onChange={(e) => updateDeductionLine(index, "priority", e.target.value)} /></label>
                  <label>Max %<input type="number" min="0" max="100" step="1" value={row.maxPercent} onChange={(e) => updateDeductionLine(index, "maxPercent", e.target.value)} /></label>
                  <label>Frequency<select value={row.frequency} onChange={(e) => updateDeductionLine(index, "frequency", e.target.value)}><option value="MONTHLY">Monthly</option><option value="ONE_TIME">One Time</option><option value="AS_APPLICABLE">As Applicable</option></select></label>
                  <label className="check-field"><input type="checkbox" checked={row.attendanceBased} onChange={(e) => updateDeductionLine(index, "attendanceBased", e.target.checked)} /> Attendance Based</label>
                  <label className="check-field"><input type="checkbox" checked={row.active !== false} onChange={(e) => updateDeductionLine(index, "active", e.target.checked)} /> Active</label>
                  <button type="button" className="delete-button deduction-remove" onClick={() => removeDeductionLine(index)} disabled={(deductionPolicyForm.deductions || []).length <= 1}>Remove</button>
                </div>)}</div>
              </div>
              <div className="policy-note"><strong>Payroll integration:</strong> Payroll will select the applicable deduction policy using Workforce Category + effective date. Employee-specific amounts such as loan EMI or food deduction can be supplied from Payroll/Attendance while this master controls the allowed deduction behaviour and limits.</div>
              <div className="master-form-actions"><button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-action">{editing ? "Update Deduction Policy" : "Save Deduction Policy"}</button></div>
            </form>
          )}

          {showForm && activeMaster === "otPolicies" && (
            <form className="ot-policy-form policy-form" onSubmit={saveOTPolicy}>
              <div className="policy-form-title">
                <div><span>OVERTIME CONFIGURATION</span><h3>{editing ? "Edit OT Policy" : "Add OT Policy"}</h3><small>Configure overtime rules centrally. Payroll will consume the effective policy by workforce category and payroll date.</small></div>
                <label className="policy-switch"><input type="checkbox" checked={otPolicyForm.active} onChange={(e) => updateOTPolicyField("active", e.target.checked)} /><span>Active</span></label>
              </div>
              <div className="ot-policy-info"><strong>Standard OT treatment</strong><span>Use separate multipliers for normal working days, weekly offs and holidays. Do not hard-code these multipliers inside Payroll.</span></div>
              <div className="ot-policy-grid">
                <label>Policy Code *<input value={otPolicyForm.code} onChange={(e) => updateOTPolicyField("code", e.target.value.toUpperCase())} placeholder="e.g. STD-OT" /></label>
                <label>Policy Name *<input value={otPolicyForm.name} onChange={(e) => updateOTPolicyField("name", e.target.value)} placeholder="e.g. Standard OT Policy" /></label>
                <label>Effective From *<input type="date" value={otPolicyForm.effectiveFrom} onChange={(e) => updateOTPolicyField("effectiveFrom", e.target.value)} /></label>
                <label>Rule Version *<input value={otPolicyForm.ruleVersion} onChange={(e) => updateOTPolicyField("ruleVersion", e.target.value.toUpperCase())} placeholder="e.g. OT-2026-27-V1" /></label>
              </div>
              <div className="ot-policy-section"><div className="salary-rule-section-title"><div><b>Workforce Category Applicability</b><small>Select the workforce categories covered by this OT policy.</small></div></div><div className="salary-category-grid">{(masters.workforceCategories || []).filter((c) => c.active !== false).map((category) => <label className={`salary-category-option ${(otPolicyForm.workforceCategories || []).includes(category.id) ? "selected" : ""}`} key={category.id}><input type="checkbox" checked={(otPolicyForm.workforceCategories || []).includes(category.id)} onChange={() => toggleOTCategory(category.id)} /><span><strong>{category.name}</strong><small>{category.code} · {category.payrollProfile || "Payroll"}</small></span></label>)}</div></div>
              <div className="ot-policy-section"><div className="salary-rule-section-title"><div><b>OT Calculation</b><small>Configure the rate basis and multipliers used by Payroll.</small></div></div>
                <div className="ot-policy-grid ot-policy-grid-4">
                  <label className="policy-toggle"><span>OT Applicable</span><input type="checkbox" checked={otPolicyForm.otApplicable} onChange={(e) => updateOTPolicyField("otApplicable", e.target.checked)} /></label>
                  <label>Calculation Basis<select value={otPolicyForm.calculationBasis} onChange={(e) => updateOTPolicyField("calculationBasis", e.target.value)}><option value="BASIC">Basic</option><option value="BASIC_DA">Basic + DA</option><option value="GROSS">Gross Salary</option><option value="HOURLY_RATE">Configured Hourly Rate</option></select></label>
                  <label>Working Hours / Day<input type="number" min="0.1" step="0.25" value={otPolicyForm.workingHoursPerDay} onChange={(e) => updateOTPolicyField("workingHoursPerDay", e.target.value)} /></label>
                  <label>Minimum OT Minutes<input type="number" min="0" step="1" value={otPolicyForm.minimumOtMinutes} onChange={(e) => updateOTPolicyField("minimumOtMinutes", e.target.value)} /></label>
                  <label>Weekday OT Multiplier<input type="number" min="0" step="0.05" value={otPolicyForm.weekdayMultiplier} onChange={(e) => updateOTPolicyField("weekdayMultiplier", e.target.value)} /></label>
                  <label>Weekly-Off OT Multiplier<input type="number" min="0" step="0.05" value={otPolicyForm.weeklyOffMultiplier} onChange={(e) => updateOTPolicyField("weeklyOffMultiplier", e.target.value)} /></label>
                  <label>Holiday OT Multiplier<input type="number" min="0" step="0.05" value={otPolicyForm.holidayMultiplier} onChange={(e) => updateOTPolicyField("holidayMultiplier", e.target.value)} /></label>
                  <label>Max OT Hours / Day<input type="number" min="0" step="0.25" value={otPolicyForm.maxOtHoursPerDay} onChange={(e) => updateOTPolicyField("maxOtHoursPerDay", e.target.value)} /></label>
                </div>
              </div>
              <div className="ot-policy-section"><div className="salary-rule-section-title"><div><b>Attendance, Approval & Payroll Treatment</b><small>These flags control how OT flows from Attendance into Payroll.</small></div></div><div className="ot-switch-grid"><label className="policy-toggle"><span>Weekly-Off OT Applicable</span><input type="checkbox" checked={otPolicyForm.weeklyOffOtApplicable} onChange={(e) => updateOTPolicyField("weeklyOffOtApplicable", e.target.checked)} /></label><label className="policy-toggle"><span>Holiday OT Applicable</span><input type="checkbox" checked={otPolicyForm.holidayOtApplicable} onChange={(e) => updateOTPolicyField("holidayOtApplicable", e.target.checked)} /></label><label className="policy-toggle"><span>Approval Required</span><input type="checkbox" checked={otPolicyForm.approvalRequired} onChange={(e) => updateOTPolicyField("approvalRequired", e.target.checked)} /></label><label className="policy-toggle"><span>OT Taxable</span><input type="checkbox" checked={otPolicyForm.taxable} onChange={(e) => updateOTPolicyField("taxable", e.target.checked)} /></label></div><div className="ot-policy-grid ot-policy-grid-2"><label>Rounding Rule<select value={otPolicyForm.roundingRule} onChange={(e) => updateOTPolicyField("roundingRule", e.target.value)}><option value="EXACT">Exact Minutes</option><option value="NEAREST_15">Nearest 15 Minutes</option><option value="NEAREST_30">Nearest 30 Minutes</option><option value="FLOOR_30">Floor to 30 Minutes</option><option value="CEIL_30">Ceiling to 30 Minutes</option></select></label></div></div>
              <div className="policy-note"><strong>Payroll integration:</strong> Payroll will select the OT policy by Workforce Category + effective date. The policy does not replace statutory rules; OT earnings will remain subject to the applicable salary/statutory configuration.</div>
              <div className="master-form-actions"><button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-action">{editing ? "Update OT Policy" : "Save OT Policy"}</button></div>
            </form>
          )}

          {showForm && activeMaster === "shifts" && (
            <form className="shift-form" onSubmit={saveShift}>
              <div className="shift-form-title">
                <div>
                  <span>SHIFT CONFIGURATION</span>
                  <h3>{editing ? "Edit Shift" : "Add New Shift"}</h3>
                </div>
                <div className="shift-live-hours">
                  <small>Effective Hours</small>
                  <strong>{formatHours(calculateShiftHours(shiftForm).effective)}</strong>
                </div>
              </div>

              <div className="shift-form-grid">
                <label>
                  Shift Code *
                  <input value={shiftForm.code} onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value.toUpperCase() })} placeholder="e.g. G01" />
                </label>
                <label>
                  Shift Name *
                  <input value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} placeholder="e.g. General" />
                </label>
                <label>
                  Shift Type
                  <select value={shiftForm.shiftType} onChange={(e) => setShiftForm({ ...shiftForm, shiftType: e.target.value })}>
                    <option>Day</option>
                    <option>Night</option>
                    <option>Rotational</option>
                  </select>
                </label>
                <label>
                  Start Time *
                  <input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
                </label>
                <label>
                  End Time *
                  <input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
                </label>
                <label className="shift-check-field">
                  <span>Cross Midnight</span>
                  <input type="checkbox" checked={shiftForm.crossMidnight} onChange={(e) => setShiftForm({ ...shiftForm, crossMidnight: e.target.checked })} />
                </label>
                <label>
                  Grace In (minutes)
                  <input type="number" min="0" value={shiftForm.graceIn} onChange={(e) => setShiftForm({ ...shiftForm, graceIn: Number(e.target.value) })} />
                </label>
                <label>
                  Grace Out (minutes)
                  <input type="number" min="0" value={shiftForm.graceOut} onChange={(e) => setShiftForm({ ...shiftForm, graceOut: Number(e.target.value) })} />
                </label>
                <label>
                  Weekly Off
                  <select value={shiftForm.weeklyOff} onChange={(e) => setShiftForm({ ...shiftForm, weeklyOff: e.target.value })}>
                    <option>Sunday</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option>
                  </select>
                </label>
                <label>
                  OT Applicable
                  <select value={shiftForm.otApplicable ? "Yes" : "No"} onChange={(e) => setShiftForm({ ...shiftForm, otApplicable: e.target.value === "Yes" })}>
                    <option>Yes</option><option>No</option>
                  </select>
                </label>
                <label>
                  OT After (hours)
                  <input type="number" min="0" step="0.25" value={shiftForm.otAfter} onChange={(e) => setShiftForm({ ...shiftForm, otAfter: Number(e.target.value) })} />
                </label>
              </div>

              <div className="shift-breaks-panel">
                <div className="shift-breaks-head">
                  <div>
                    <span>BREAK SCHEDULE</span>
                    <small>Multiple breaks can be configured. Total break time is deducted automatically.</small>
                  </div>
                  <button type="button" className="secondary-action" onClick={addShiftBreak}>+ Add Break</button>
                </div>

                {shiftForm.breaks.map((item) => (
                  <div className="shift-break-row" key={item.id}>
                    <input value={item.name} onChange={(e) => updateShiftBreak(item.id, "name", e.target.value)} placeholder="Break name" />
                    <input type="time" value={item.start} onChange={(e) => updateShiftBreak(item.id, "start", e.target.value)} />
                    <span>to</span>
                    <input type="time" value={item.end} onChange={(e) => updateShiftBreak(item.id, "end", e.target.value)} />
                    <button type="button" className="delete-break" onClick={() => removeShiftBreak(item.id)}>Remove</button>
                  </div>
                ))}

                <div className="shift-calculation-strip">
                  <span>Gross Shift <strong>{formatHours(calculateShiftHours(shiftForm).gross)}</strong></span>
                  <span>Total Break <strong>{formatHours(calculateShiftHours(shiftForm).break)}</strong></span>
                  <span>Effective Working <strong>{formatHours(calculateShiftHours(shiftForm).effective)}</strong></span>
                </div>
              </div>

              <div className="master-form-actions">
                <button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-action">{editing ? "Update Shift" : "Save Shift"}</button>
              </div>
            </form>
          )}

          {showForm && activeMaster === "holidays" && (
            <form className="holiday-form policy-form" onSubmit={saveHoliday}>
              <div className="policy-form-title">
                <div>
                  <span>HOLIDAY CALENDAR</span>
                  <h3>{editing ? "Edit Holiday" : "Add Holiday"}</h3>
                </div>
                <span className={`status-pill ${holidayForm.active ? "active" : "inactive"}`}>
                  {holidayForm.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="holiday-form-grid">
                <label>
                  Holiday Name *
                  <input value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} placeholder="e.g. Independence Day" />
                </label>
                <label>
                  Holiday Date *
                  <input type="date" value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} />
                </label>
                <label className="policy-toggle">
                  <span>Paid Holiday</span>
                  <input type="checkbox" checked={holidayForm.paid} onChange={(e) => setHolidayForm({ ...holidayForm, paid: e.target.checked })} />
                </label>
              </div>

              <div className="policy-note">
                A paid holiday is treated as <strong>HO</strong> in Attendance, excluded from Working Days and included in Paid Days.
              </div>

              <div className="master-form-actions">
                <button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-action">{editing ? "Update Holiday" : "Save Holiday"}</button>
              </div>
            </form>
          )}

          {showForm && activeMaster === "weekOffPolicies" && (
            <form className="weekoff-form policy-form" onSubmit={saveWeekOffPolicy}>
              <div className="policy-form-title">
                <div>
                  <span>ATTENDANCE POLICY</span>
                  <h3>{editing ? "Edit Week-Off Policy" : "Add Week-Off Policy"}</h3>
                </div>
                <span className={`status-pill ${weekOffForm.active ? "active" : "inactive"}`}>
                  {weekOffForm.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="weekoff-policy-intro">
                <div className="weekoff-policy-icon">▣</div>
                <div>
                  <strong>Weekly Off Configuration</strong>
                  <span>Configure Saturday / Sunday weekly offs. The selected policy will later drive Daily Attendance, Monthly Attendance and Excel Import automatically.</span>
                </div>
              </div>

              <div className="policy-grid">
                <label>
                  Policy Name *
                  <input value={weekOffForm.name} onChange={(e) => setWeekOffForm({ ...weekOffForm, name: e.target.value })} placeholder="e.g. On-Roll 5 Day" />
                </label>
                <label>
                  Applies To
                  <select value={weekOffForm.assignmentType} onChange={(e) => setWeekOffForm({ ...weekOffForm, assignmentType: e.target.value, assignmentValue: "" })}>
                    <option>Workforce Category</option>
                    <option>Vendor</option>
                    <option>All Employees</option>
                  </select>
                </label>
                <label>
                  {weekOffForm.assignmentType === "Workforce Category" ? "Workforce Category *" : weekOffForm.assignmentType === "Vendor" ? "Vendor *" : "Assignment"}
                  {weekOffForm.assignmentType === "All Employees" ? (
                    <input value="Organisation-wide" disabled />
                  ) : (
                    <select value={weekOffForm.assignmentValue} onChange={(e) => setWeekOffForm({ ...weekOffForm, assignmentValue: e.target.value })}>
                      <option value="">Select {weekOffForm.assignmentType}</option>
                      {(weekOffForm.assignmentType === "Workforce Category" ? (masters.workforceCategories || []) : (masters.jobRoles || []))
                        .filter((item) => item.active)
                        .map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select>
                  )}
                </label>
                <label>
                  Effective From *
                  <input type="date" value={weekOffForm.effectiveFrom} onChange={(e) => setWeekOffForm({ ...weekOffForm, effectiveFrom: e.target.value })} />
                </label>
              </div>

              <div className="weekoff-days-panel">
                <div className="weekoff-days-head">
                  <div>
                    <span>WEEKLY OFF DAYS</span>
                    <small>Turn a day ON to automatically treat it as Weekly Off (WO) for this policy.</small>
                  </div>
                </div>
                <div className="weekoff-day-grid">
                  {[
                    ["Monday", false], ["Tuesday", false], ["Wednesday", false], ["Thursday", false], ["Friday", false],
                    ["Saturday", weekOffForm.saturday], ["Sunday", weekOffForm.sunday],
                  ].map(([day, enabled]) => (
                    <label className={`weekoff-day-card ${enabled ? "selected" : ""}`} key={day}>
                      <span className="weekoff-day-check">
                        <input type="checkbox" checked={enabled} onChange={(e) => {
                          if (day === "Saturday") setWeekOffForm({ ...weekOffForm, saturday: e.target.checked });
                          if (day === "Sunday") setWeekOffForm({ ...weekOffForm, sunday: e.target.checked });
                        }} />
                      </span>
                      <span className="weekoff-day-name">{day}</span>
                      <span className={`weekoff-day-status ${enabled ? "on" : "off"}`}>{enabled ? "OFF" : "Working"}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="policy-note">
                <strong>How it will work:</strong> Example — On-Roll can have Saturday + Sunday OFF, while standard Third Party can have Sunday OFF only. A separate policy can be created for selected Third Party employees who also receive Saturday OFF.
              </div>

              <div className="master-form-actions">
                <button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-action">Save Week-Off Policy</button>
              </div>
            </form>
          )}

          {showForm && activeMaster === "leavePolicies" && (
            <form className="policy-form attendance-leave-policy-form" onSubmit={saveCompOffPolicy}>
              <div className="policy-form-title">
                <div>
                  <span>ATTENDANCE & LEAVE POLICY</span>
                  <h3>Leave, LOP & Comp Off Configuration</h3>
                </div>
                <span className={`status-pill ${policyForm.active ? "active" : "inactive"}`}>
                  {policyForm.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="policy-section-title leave-type-title-row">
                <span>Leave Types & Policy Rules</span>
                <button type="button" className="secondary-action leave-add-button" onClick={startAddLeaveType}>+ Add Leave Type</button>
              </div>

              <div className="leave-policy-grid leave-policy-grid-v2">
                <div className="leave-policy-head leave-policy-head-v2"><span>Code</span><span>Leave Type</span><span>Accrual</span><span>Carry Forward</span><span>Salary</span><span>Action</span></div>
                {(policyForm.leaveTypes || DEFAULT_LEAVE_TYPES).map((item) => (
                  <div className="leave-policy-row leave-policy-row-v2" key={item.id || item.code}>
                    <strong>{item.code}</strong>
                    <div><b>{item.name}</b><small>{item.active ? "Active" : "Inactive"} · {item.applicability?.scope === "ALL" ? "All Employees" : item.applicability?.value || item.applicability?.scope}</small></div>
                    <div><b>{item.accrual?.enabled ? `${item.accrual.credit || 0} / ${item.accrual.frequency === "ON_EVENT" ? "Event" : item.accrual.frequency === "YEARLY" ? "Year" : "Month"}` : "Not Applicable"}</b><small>{item.accrual?.basis || "—"}</small></div>
                    <div><b>{item.carryForward?.enabled ? `Yes · Max ${item.carryForward.maximum ?? 0}` : "No"}</b><small>{item.carryForward?.expiryEnabled ? `Expiry ${item.carryForward.expiryMonths} months` : "No expiry"}</small></div>
                    <div><b>{item.salaryTreatment?.countAsPaidDay ? "Paid Day" : "No Paid Day"}</b><small>{item.salaryTreatment?.lop ? "LOP" : "No LOP"}</small></div>
                    <div className="leave-row-actions">
                      <button type="button" onClick={() => startEditLeaveType(item)}>Edit</button>
                      <button type="button" onClick={() => updateLeaveType(item.code, "active", !item.active)}>{item.active ? "Deactivate" : "Activate"}</button>
                      <button type="button" className="delete-button" onClick={() => deleteLeaveType(item)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="leave-type-editor">
                <div className="leave-type-editor-head">
                  <div>
                    <span>{editingLeaveType ? "EDIT LEAVE TYPE" : "ADD LEAVE TYPE"}</span>
                    <h4>{editingLeaveType ? `${leaveTypeForm.code} · ${leaveTypeForm.name}` : "Configure leave rules"}</h4>
                  </div>
                  {editingLeaveType && <button type="button" className="text-button" onClick={startAddLeaveType}>Clear / New</button>}
                </div>

                <div className="leave-editor-grid">
                  <label>Leave Code<input maxLength={10} value={leaveTypeForm.code} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value.toUpperCase() })} placeholder="e.g. CL" /></label>
                  <label>Leave Name<input value={leaveTypeForm.name} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })} placeholder="e.g. Casual Leave" /></label>
                  <label className="policy-toggle"><span>Active</span><input type="checkbox" checked={leaveTypeForm.active !== false} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, active: e.target.checked })} /></label>
                  <label className="policy-toggle"><span>Paid Leave</span><input type="checkbox" checked={leaveTypeForm.paid !== false} onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, paid: e.target.checked, salaryTreatment: { ...leaveTypeForm.salaryTreatment, countAsPaidDay: e.target.checked } })} /></label>
                </div>

                <div className="leave-editor-subtitle">Applicability</div>
                <div className="leave-editor-grid">
                  <label>Apply To<select value={leaveTypeForm.applicability?.scope || "ALL"} onChange={(e) => updateLeaveTypeSection("applicability", "scope", e.target.value)}>
                    <option value="ALL">All Employees</option><option value="SITE">Specific Site</option><option value="WORKFORCE_CATEGORY">Workforce Category</option><option value="EMPLOYEE">Specific Employee</option>
                  </select></label>
                  <label>Assignment / Value<input value={leaveTypeForm.applicability?.value || ""} onChange={(e) => updateLeaveTypeSection("applicability", "value", e.target.value)} placeholder="Optional: site / group / employee" /></label>
                </div>

                <div className="leave-editor-subtitle">Accrual / Grant</div>
                <div className="leave-editor-grid leave-editor-grid-4">
                  <label className="policy-toggle"><span>Accrual Enabled</span><input type="checkbox" checked={Boolean(leaveTypeForm.accrual?.enabled)} onChange={(e) => updateLeaveTypeSection("accrual", "enabled", e.target.checked)} /></label>
                  <label>Frequency<select value={leaveTypeForm.accrual?.frequency || "YEARLY"} onChange={(e) => updateLeaveTypeSection("accrual", "frequency", e.target.value)}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option><option value="ON_EVENT">On Event</option><option value="NONE">None</option></select></label>
                  <label>Accrual Basis<select value={leaveTypeForm.accrual?.basis || "FIXED"} onChange={(e) => updateLeaveTypeSection("accrual", "basis", e.target.value)}><option value="PRESENT_DAYS">Present Days</option><option value="DAYS_WORKED">Days Worked / Labour Code</option><option value="FIXED">Fixed Grant</option><option value="WEEKLY_OFF_WORKED">Weekly Off Worked</option><option value="CUSTOM">Custom</option><option value="NONE">None</option></select></label>
                  <label>Credit / Rate<input type="number" min="0" step="0.01" value={leaveTypeForm.accrual?.credit ?? 0} onChange={(e) => updateLeaveTypeSection("accrual", "credit", Number(e.target.value))} /></label>
                  <label>Minimum Days<input type="number" min="0" value={leaveTypeForm.accrual?.minimumDays ?? 0} onChange={(e) => updateLeaveTypeSection("accrual", "minimumDays", Number(e.target.value))} placeholder="e.g. 21 / 180" /></label>
                </div>
                <div className="policy-note small-note">For EL, you can configure <strong>Present Days + Monthly + 21 minimum days + 1.25 credit</strong>, or switch the basis to <strong>Days Worked / Labour Code</strong> and set the required eligibility/rate.</div>

                <div className="leave-editor-subtitle">Carry Forward & Expiry</div>
                <div className="leave-editor-grid leave-editor-grid-4">
                  <label className="policy-toggle"><span>Carry Forward</span><input type="checkbox" checked={Boolean(leaveTypeForm.carryForward?.enabled)} onChange={(e) => updateLeaveTypeSection("carryForward", "enabled", e.target.checked)} /></label>
                  <label>Maximum Carry Forward<input type="number" min="0" step="0.5" value={leaveTypeForm.carryForward?.maximum ?? 0} onChange={(e) => updateLeaveTypeSection("carryForward", "maximum", Number(e.target.value))} /></label>
                  <label className="policy-toggle"><span>Expiry Enabled</span><input type="checkbox" checked={Boolean(leaveTypeForm.carryForward?.expiryEnabled)} onChange={(e) => updateLeaveTypeSection("carryForward", "expiryEnabled", e.target.checked)} /></label>
                  <label>Expiry After (Months)<input type="number" min="0" value={leaveTypeForm.carryForward?.expiryMonths ?? 0} onChange={(e) => updateLeaveTypeSection("carryForward", "expiryMonths", Number(e.target.value))} /></label>
                  <label className="policy-toggle"><span>Refused Leave: No Normal Cap</span><input type="checkbox" checked={Boolean(leaveTypeForm.carryForward?.refusedLeaveUnlimited)} onChange={(e) => updateLeaveTypeSection("carryForward", "refusedLeaveUnlimited", e.target.checked)} /></label>
                </div>

                <div className="leave-editor-subtitle">Attendance / Payroll Treatment</div>
                <div className="leave-editor-grid">
                  <label className="policy-toggle"><span>Count as Paid Day</span><input type="checkbox" checked={Boolean(leaveTypeForm.salaryTreatment?.countAsPaidDay)} onChange={(e) => updateLeaveTypeSection("salaryTreatment", "countAsPaidDay", e.target.checked)} /></label>
                  <label className="policy-toggle"><span>Counts as LOP</span><input type="checkbox" checked={Boolean(leaveTypeForm.salaryTreatment?.lop)} onChange={(e) => updateLeaveTypeSection("salaryTreatment", "lop", e.target.checked)} /></label>
                </div>
                {leaveTypeForm.code === "FL" && (
                  <div className="policy-note fl-note"><strong>FL rule:</strong> The same FL type can be configured differently by Site / Employee Group. For a paid FL site, keep <strong>Count as Paid Day = ON</strong> and <strong>LOP = OFF</strong>. For an unpaid FL site, use <strong>Count as Paid Day = OFF</strong> and <strong>LOP = ON</strong>.</div>
                )}

                {leaveTypeForm.code === "CO" && (
                  <>
                    <div className="leave-editor-subtitle">Comp Off Earn & Utilisation</div>
                    <div className="leave-editor-grid leave-editor-grid-4">
                      <label className="policy-toggle"><span>Comp Off Enabled</span><input type="checkbox" checked={Boolean(leaveTypeForm.compOff?.enabled)} onChange={(e) => updateLeaveTypeSection("compOff", "enabled", e.target.checked)} /></label>
                      <label>Earn Basis<select value={leaveTypeForm.compOff?.earnBasis || "WEEKLY_OFF_WORKED"} onChange={(e) => updateLeaveTypeSection("compOff", "earnBasis", e.target.value)}><option value="WEEKLY_OFF_WORKED">Weekly Off Worked</option><option value="HOLIDAY_WORKED">Holiday Worked</option><option value="CUSTOM">Custom</option></select></label>
                      <label>Units Earned<input type="number" min="0" step="0.5" value={leaveTypeForm.compOff?.earnUnits ?? 1} onChange={(e) => updateLeaveTypeSection("compOff", "earnUnits", Number(e.target.value))} /></label>
                      <label className="policy-toggle"><span>Utilisation Enabled</span><input type="checkbox" checked={leaveTypeForm.compOff?.utilisationEnabled !== false} onChange={(e) => updateLeaveTypeSection("compOff", "utilisationEnabled", e.target.checked)} /></label>
                    </div>
                    <div className="policy-note small-note">Comp Off balance will be treated separately as <strong>Earned → Available → Utilised → Carry Forward / Expired</strong>. Working on a Weekly Off remains Present / Worked in Attendance.</div>
                  </>
                )}

                <div className="leave-editor-actions">
                  <button type="button" className="cancel-action" onClick={startAddLeaveType}>Clear</button>
                  <button type="button" className="primary-action" onClick={saveLeaveType}>{editingLeaveType ? "Update Leave Type" : "Add Leave Type"}</button>
                </div>
              </div>

              <div className="policy-section-title">LOP Rules</div>
              <div className="lop-rule-grid">
                <label className="policy-toggle"><span>Absent (A) → LOP</span><input type="checkbox" checked={policyForm.lopRules?.absent !== false} onChange={(e) => updateLopRule("absent", e.target.checked)} /></label>
                <label className="policy-toggle"><span>Unpaid Leave → LOP</span><input type="checkbox" checked={policyForm.lopRules?.unpaidLeave !== false} onChange={(e) => updateLopRule("unpaidLeave", e.target.checked)} /></label>
                <label className="policy-toggle"><span>Force Leave (FL) → LOP</span><input type="checkbox" checked={Boolean(policyForm.lopRules?.forceLeave)} onChange={(e) => updateLopRule("forceLeave", e.target.checked)} /></label>
                <label className="policy-toggle"><span>Half Day (HD) → LOP</span><input type="checkbox" checked={Boolean(policyForm.lopRules?.halfDay)} onChange={(e) => updateLopRule("halfDay", e.target.checked)} /></label>
              </div>

              <div className="policy-section-title">Comp Off</div>
              <div className="policy-grid">
                <label className="policy-toggle"><span>Comp Off Applicable</span><input type="checkbox" checked={policyForm.applicable !== false} onChange={(e) => setPolicyForm({ ...policyForm, applicable: e.target.checked })} /></label>
                <label>Comp Off Validity / Lapse<select value={policyForm.lapsePolicy} onChange={(e) => setPolicyForm({ ...policyForm, lapsePolicy: e.target.value })}>{COMP_OFF_LAPSE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label>Lapse Calculation<select value={policyForm.calculationMethod} onChange={(e) => setPolicyForm({ ...policyForm, calculationMethod: e.target.value })}>{COMP_OFF_CALCULATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>

              <div className="policy-preview">
                <div><span>Paid Leave</span><strong>{(policyForm.leaveTypes || []).filter((item) => item.active && item.paid).map((item) => item.code).join(", ") || "None"}</strong></div>
                <div><span>LOP on Absent</span><strong>{policyForm.lopRules?.absent !== false ? "Yes" : "No"}</strong></div>
                <div><span>Comp Off</span><strong>{policyForm.applicable !== false ? getPolicyLabel(policyForm) : "Not Applicable"}</strong></div>
              </div>

              <div className="policy-note">
                This policy will drive Attendance Paid Days / LOP treatment. Comp Off earned on a worked Weekly Off remains a separate earned balance; the worked day stays Present / Worked.
              </div>

              <div className="master-form-actions">
                <button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-action">Save Attendance & Leave Policy</button>
              </div>
            </form>
          )}

          {showForm && !["workforceCategories", "payrollProfiles", "prorationRules", "statutoryPolicies", "salaryRules", "payrollCalendars", "otPolicies", "shifts", "leavePolicies", "holidays", "weekOffPolicies"].includes(activeMaster) && (
            <form className="master-form" onSubmit={saveItem}>
              <div>
                <label>{currentConfig.singular} Name</label>
                <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={currentConfig.placeholder} />
              </div>
              <div className="master-form-actions">
                <button type="button" className="cancel-action" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-action">{editing ? "Update" : "Save"}</button>
              </div>
            </form>
          )}

          {activeMaster === "workforceCategories" ? (
            <div className="master-table-wrap">
              <table className="master-table workforce-master-table">
                <thead><tr><th>#</th><th>Code</th><th>Workforce Category</th><th>Payroll</th><th>Vendor</th><th>Payroll Profile</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {filteredItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td><td className="master-name">{item.code || "—"}</td>
                      <td><strong>{item.name}</strong><small className="table-subtext">{item.categoryType || "Custom"}</small></td>
                      <td><span className={`status-pill ${item.payrollApplicable ? "active" : "inactive"}`}>{item.payrollApplicable ? "Applicable" : "No"}</span></td>
                      <td><span className={`status-pill ${item.vendorRequired ? "active" : "inactive"}`}>{item.vendorRequired ? "Required" : "No"}</span></td>
                      <td>{item.payrollProfile || "—"}</td>
                      <td><span className={`status-pill ${item.active ? "active" : "inactive"}`}>{item.active ? "Active" : "Inactive"}</span></td>
                      <td className="row-actions"><button onClick={() => openEdit(item)}>Edit</button><button onClick={() => toggleStatus(item)}>{item.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(item)}>Delete</button></td>
                    </tr>
                  ))}
                  {!filteredItems.length && <tr><td colSpan="8" className="empty-state">No workforce categories found.<button onClick={openAdd}>Add one now</button></td></tr>}
                </tbody>
              </table>
            </div>
          ) : activeMaster === "payrollCalendars" ? (
            <div className="master-table-wrap payroll-calendar-table-wrap">
              <table className="master-table payroll-calendar-master-table">
                <thead><tr><th>#</th><th>Calendar</th><th>Frequency</th><th>Period</th><th>Attendance Cut-off</th><th>Processing</th><th>Approval</th><th>Salary Payable</th><th>Workforce</th><th>Effective</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const calendar = normalizePayrollCalendar(item);
                    const names = calendar.workforceCategories.map((id) => (masters.workforceCategories || []).find((c) => c.id === id)?.name).filter(Boolean);
                    return (
                      <tr key={calendar.id}>
                        <td>{index + 1}</td>
                        <td><strong>{calendar.name}</strong><small className="table-subtext">{calendar.code}</small></td>
                        <td>{calendar.frequency}</td>
                        <td>Day {calendar.periodStartDay} – {calendar.periodEndDay === "LAST_DAY" ? "Last Day" : `Day ${calendar.periodEndDay}`}</td>
                        <td>Day {calendar.attendanceCutoffDay}</td>
                        <td>Day {calendar.payrollProcessingStartDay} – {calendar.payrollProcessingEndDay}</td>
                        <td>Day {calendar.approvalDay}</td>
                        <td>Day {calendar.salaryPayableDay}</td>
                        <td>{names.length ? names.join(", ") : "All / Not Specified"}</td>
                        <td className="master-name">{calendar.effectiveFrom || "—"}{calendar.effectiveTo ? <small className="table-subtext">to {calendar.effectiveTo}</small> : null}</td>
                        <td><span className={`status-pill ${calendar.active ? "active" : "inactive"}`}>{calendar.active ? "Active" : "Inactive"}</span></td>
                        <td className="row-actions"><button onClick={() => openEdit(calendar)}>Edit</button><button onClick={() => toggleStatus(calendar)}>{calendar.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(calendar)}>Delete</button></td>
                      </tr>
                    );
                  })}
                  {!filteredItems.length && <tr><td colSpan="12" className="empty-state">No payroll calendars found.<button onClick={openAdd}>Add one now</button></td></tr>}
                </tbody>
              </table>
            </div>
          ) : activeMaster === "prorationRules" ? (
            <div className="master-table-wrap">
              <table className="master-table proration-rule-master-table">
                <thead><tr><th>#</th><th>Rule</th><th>Workforce Category</th><th>Proration</th><th>Denominator</th><th>Joining / Exit</th><th>LOP</th><th>Effective</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>{filteredItems.map((item, index) => { const rule = normalizeProrationRule(item); const names = rule.workforceCategories.map((id) => (masters.workforceCategories || []).find((c) => c.id === id)?.name).filter(Boolean); return <tr key={rule.id}><td>{index + 1}</td><td><strong>{rule.name}</strong><small className="table-subtext">{rule.code}</small></td><td>{names.length ? names.join(", ") : "—"}</td><td>{rule.salaryProration === "PAID_DAYS" ? "Paid Days" : rule.salaryProration}</td><td>{rule.denominatorBasis === "FIXED_26_DAYS" ? "26 Days" : rule.denominatorBasis === "FIXED_30_DAYS" ? "30 Days" : rule.denominatorBasis === "CALENDAR_DAYS" ? "Calendar Days" : "Working Days"}</td><td>{rule.joiningProration && rule.exitProration ? "Joining + Exit" : rule.joiningProration ? "Joining" : rule.exitProration ? "Exit" : "No"}</td><td>{rule.lopProration ? "Yes" : "No"}</td><td className="master-name">{rule.effectiveFrom || "—"}{rule.effectiveTo ? <small className="table-subtext">to {rule.effectiveTo}</small> : null}</td><td><span className={`status-pill ${rule.active ? "active" : "inactive"}`}>{rule.active ? "Active" : "Inactive"}</span></td><td className="row-actions"><button onClick={() => openEdit(rule)}>Edit</button><button onClick={() => toggleStatus(rule)}>{rule.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(rule)}>Delete</button></td></tr>; })}{!filteredItems.length && <tr><td colSpan="10" className="empty-state">No proration rules found.<button onClick={openAdd}>Add one now</button></td></tr>}</tbody>
              </table>
            </div>
          ) : activeMaster === "payrollProfiles" ? (
            <div className="master-table-wrap">
              <table className="master-table payroll-profile-master-table">
                <thead><tr><th>#</th><th>Profile</th><th>Workforce Category</th><th>Frequency</th><th>Proration</th><th>Payroll Calendar</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>{filteredItems.map((item, index) => { const profile = normalizePayrollProfile(item); const names = profile.workforceCategories.map((id) => (masters.workforceCategories || []).find((c) => c.id === id)?.name).filter(Boolean); const calendar = (masters.payrollCalendars || []).find((c) => c.id === profile.payrollCalendarId); return <tr key={profile.id}><td>{index + 1}</td><td><strong>{profile.name}</strong><small className="table-subtext">{profile.code}</small></td><td>{names.length ? names.join(", ") : "—"}</td><td>{profile.paymentFrequency}</td><td>{profile.prorationMethod === "PAID_DAYS" ? "Paid Days" : profile.prorationMethod}</td><td>{calendar?.name || "—"}</td><td><span className={`status-pill ${profile.active ? "active" : "inactive"}`}>{profile.active ? "Active" : "Inactive"}</span></td><td className="row-actions"><button onClick={() => openEdit(profile)}>Edit</button><button onClick={() => toggleStatus(profile)}>{profile.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(profile)}>Delete</button></td></tr>; })}{!filteredItems.length && <tr><td colSpan="8" className="empty-state">No payroll profiles found.<button onClick={openAdd}>Add one now</button></td></tr>}</tbody>
              </table>
            </div>
          ) : activeMaster === "statutoryPolicies" ? (
            <div className="master-table-wrap">
              <table className="master-table statutory-master-table">
                <thead><tr><th>#</th><th>Policy</th><th>Effective From</th><th>Version</th><th>PF</th><th>ESI</th><th>PT</th><th>LWF</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {filteredItems.map((item, index) => { const policy = normalizeStatutoryPolicy(item); return <tr key={item.id}><td>{index + 1}</td><td><strong>{policy.name}</strong><small className="table-subtext">{policy.pt?.state || "All States"}</small></td><td className="master-name">{policy.effectiveFrom || "—"}</td><td>{policy.ruleVersion || "—"}</td><td><span className={`status-pill ${policy.pf.enabled ? "active" : "inactive"}`}>{policy.pf.enabled ? `${policy.pf.employeeRate}% / ${policy.pf.employerRate}%` : "Off"}</span></td><td><span className={`status-pill ${policy.esi.enabled ? "active" : "inactive"}`}>{policy.esi.enabled ? `${policy.esi.employeeRate}% / ${policy.esi.employerRate}%` : "Off"}</span></td><td><span className={`status-pill ${policy.pt.enabled ? "active" : "inactive"}`}>{policy.pt.enabled ? "Enabled" : "Off"}</span></td><td><span className={`status-pill ${policy.lwf.enabled ? "active" : "inactive"}`}>{policy.lwf.enabled ? "Enabled" : "Off"}</span></td><td><span className={`status-pill ${policy.active ? "active" : "inactive"}`}>{policy.active ? "Active" : "Inactive"}</span></td><td className="row-actions"><button onClick={() => openEdit(policy)}>Edit</button><button onClick={() => toggleStatus(policy)}>{policy.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(policy)}>Delete</button></td></tr>; })}
                  {!filteredItems.length && <tr><td colSpan="10" className="empty-state">No statutory policies found.<button onClick={openAdd}>Add one now</button></td></tr>}
                </tbody>
              </table>
            </div>
          ) : activeMaster === "salaryRules" ? (
            <div className="master-table-wrap"><table className="master-table salary-rules-master-table"><thead><tr><th>#</th><th>Rule</th><th>Workforce Category</th><th>Effective</th><th>Version</th><th>Components</th><th>Proration</th><th>Status</th><th className="action-column">Action</th></tr></thead><tbody>{filteredItems.map((item, index) => { const rule = normalizeSalaryRule(item); const names = rule.workforceCategories.map((id) => (masters.workforceCategories || []).find((c) => c.id === id)?.name).filter(Boolean); return <tr key={rule.id}><td>{index + 1}</td><td><strong>{rule.name}</strong><small className="table-subtext">{rule.code}</small></td><td>{names.length ? names.join(", ") : "—"}</td><td className="master-name">{rule.effectiveFrom || "—"}</td><td>{rule.ruleVersion || "—"}</td><td>{rule.components.filter((c) => c.active !== false).length}</td><td>{rule.prorationMethod === "PAID_DAYS" ? "Paid Days" : rule.prorationMethod === "NO_PRORATION" ? "No Proration" : rule.prorationMethod}</td><td><span className={`status-pill ${rule.active ? "active" : "inactive"}`}>{rule.active ? "Active" : "Inactive"}</span></td><td className="row-actions"><button onClick={() => openEdit(rule)}>Edit</button><button onClick={() => toggleStatus(rule)}>{rule.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(rule)}>Delete</button></td></tr>; })}{!filteredItems.length && <tr><td colSpan="9" className="empty-state">No salary rules found.<button onClick={openAdd}>Add one now</button></td></tr>}</tbody></table></div>
          ) : activeMaster === "deductionPolicies" ? (
            <div className="master-table-wrap"><table className="master-table deduction-policy-master-table"><thead><tr><th>#</th><th>Policy</th><th>Workforce Category</th><th>Effective</th><th>Version</th><th>Rules</th><th>Max Deduction</th><th>Approval</th><th>Status</th><th className="action-column">Action</th></tr></thead><tbody>{filteredItems.map((item, index) => { const policy = normalizeDeductionPolicy(item); const names = policy.workforceCategories.map((id) => (masters.workforceCategories || []).find((c) => c.id === id)?.name).filter(Boolean); return <tr key={policy.id}><td>{index + 1}</td><td><strong>{policy.name}</strong><small className="table-subtext">{policy.code}</small></td><td>{names.length ? names.join(", ") : "—"}</td><td className="master-name">{policy.effectiveFrom || "—"}</td><td>{policy.ruleVersion || "—"}</td><td>{policy.deductions.filter((x) => x.active !== false).length}</td><td>{policy.maximumDeductionPercent}%</td><td><span className={`status-pill ${policy.approvalRequired ? "active" : "inactive"}`}>{policy.approvalRequired ? "Required" : "Not Required"}</span></td><td><span className={`status-pill ${policy.active ? "active" : "inactive"}`}>{policy.active ? "Active" : "Inactive"}</span></td><td className="row-actions"><button onClick={() => openEdit(policy)}>Edit</button><button onClick={() => toggleStatus(policy)}>{policy.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(policy)}>Delete</button></td></tr>; })}{!filteredItems.length && <tr><td colSpan="10" className="empty-state">No deduction policies found.<button onClick={openAdd}>Add one now</button></td></tr>}</tbody></table></div>
          ) : activeMaster === "otPolicies" ? (
            <div className="master-table-wrap"><table className="master-table ot-policy-master-table"><thead><tr><th>#</th><th>Policy</th><th>Workforce Category</th><th>Effective</th><th>Version</th><th>Weekday</th><th>Weekly Off</th><th>Holiday</th><th>Basis</th><th>Status</th><th className="action-column">Action</th></tr></thead><tbody>{filteredItems.map((item, index) => { const policy = normalizeOTPolicy(item); const names = policy.workforceCategories.map((id) => (masters.workforceCategories || []).find((c) => c.id === id)?.name).filter(Boolean); return <tr key={policy.id}><td>{index + 1}</td><td><strong>{policy.name}</strong><small className="table-subtext">{policy.code}</small></td><td>{names.length ? names.join(", ") : "—"}</td><td className="master-name">{policy.effectiveFrom || "—"}</td><td>{policy.ruleVersion || "—"}</td><td>{policy.weekdayMultiplier}×</td><td>{policy.weeklyOffMultiplier}×</td><td>{policy.holidayMultiplier}×</td><td>{policy.calculationBasis === "BASIC_DA" ? "Basic + DA" : policy.calculationBasis === "HOURLY_RATE" ? "Hourly Rate" : policy.calculationBasis}</td><td><span className={`status-pill ${policy.active ? "active" : "inactive"}`}>{policy.active ? "Active" : "Inactive"}</span></td><td className="row-actions"><button onClick={() => openEdit(policy)}>Edit</button><button onClick={() => toggleStatus(policy)}>{policy.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(policy)}>Delete</button></td></tr>; })}{!filteredItems.length && <tr><td colSpan="11" className="empty-state">No OT policies found.<button onClick={openAdd}>Add one now</button></td></tr>}</tbody></table></div>
          ) : activeMaster === "holidays" ? (
            <div className="master-table-wrap">
              <table className="master-table holiday-master-table">
                <thead><tr><th>#</th><th>Holiday Date</th><th>Holiday Name</th><th>Paid</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {[...filteredItems].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td className="master-name">{item.date}</td>
                      <td><strong>{item.name}</strong></td>
                      <td><span className={`status-pill ${item.paid ? "active" : "inactive"}`}>{item.paid ? "Paid" : "Unpaid"}</span></td>
                      <td><span className={`status-pill ${item.active ? "active" : "inactive"}`}>{item.active ? "Active" : "Inactive"}</span></td>
                      <td className="row-actions"><button onClick={() => openEdit(item)}>Edit</button><button onClick={() => toggleStatus(item)}>{item.active ? "Deactivate" : "Activate"}</button><button className="delete-button" onClick={() => deleteItem(item)}>Delete</button></td>
                    </tr>
                  ))}
                  {!filteredItems.length && <tr><td colSpan="6" className="empty-state">No holidays found.<button onClick={openAdd}>Add one now</button></td></tr>}
                </tbody>
              </table>
            </div>
          ) : activeMaster === "weekOffPolicies" ? (
            <div className="weekoff-policy-list">
              {(filteredItems || []).map((item) => (
                <div className="weekoff-policy-card" key={item.id}>
                  <div className="weekoff-card-icon">▣</div>
                  <div className="weekoff-card-main">
                    <div className="weekoff-card-title-row">
                      <strong>{item.name}</strong>
                      <span className={`status-pill ${item.active ? "active" : "inactive"}`}>{item.active ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="weekoff-card-meta">
                      <span><b>Applies:</b> {item.assignmentType === "All Employees" ? "Organisation-wide" : item.assignmentValue}</span>
                      <span><b>Effective:</b> {item.effectiveFrom || "—"}</span>
                    </div>
                    <div className="weekoff-chip-row">
                      {item.saturday && <span className="weekoff-chip on">Saturday OFF</span>}
                      {item.sunday && <span className="weekoff-chip on">Sunday OFF</span>}
                      {!item.saturday && !item.sunday && <span className="weekoff-chip off">No weekly off configured</span>}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button onClick={() => openEdit(item)}>Edit</button>
                    <button onClick={() => toggleStatus(item)}>{item.active ? "Deactivate" : "Activate"}</button>
                    <button className="delete-button" onClick={() => deleteItem(item)}>Delete</button>
                  </div>
                </div>
              ))}
              {!filteredItems.length && (
                <div className="empty-state">No Week-Off Policies found. <button onClick={openAdd}>Add one now</button></div>
              )}
            </div>
          ) : activeMaster === "leavePolicies" ? (
            <div className="policy-card">
              {(currentItems || []).map((item) => (
                <div className="policy-card-row" key={item.id}>
                  <div className="policy-card-icon">◐</div>
                  <div className="policy-card-main">
                    <strong>{item.name}</strong>
                    <span>{item.applicable ? "Applicable" : "Not Applicable"} · {getPolicyLabel(item)}</span>
                  </div>
                  <span className={`status-pill ${item.active ? "active" : "inactive"}`}>{item.active ? "Active" : "Inactive"}</span>
                  <div className="row-actions">
                    <button onClick={() => openEdit(item)}>Edit</button>
                    <button onClick={() => toggleStatus(item)}>{item.active ? "Deactivate" : "Activate"}</button>
                  </div>
                </div>
              ))}
            </div>
          ) : activeMaster === "shifts" ? (
            <div className="master-table-wrap">
              <table className="master-table shift-master-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Code</th>
                    <th>Shift</th>
                    <th>Timing</th>
                    <th>Break</th>
                    <th>Effective Hrs</th>
                    <th>OT</th>
                    <th>Status</th>
                    <th className="action-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const shift = normalizeShift(item);
                    const hours = calculateShiftHours(shift);
                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td className="master-name">{shift.code || "—"}</td>
                        <td><strong>{shift.name}</strong><small className="table-subtext">{shift.shiftType}</small></td>
                        <td>{shift.startTime} – {shift.endTime}{shift.crossMidnight ? " +1" : ""}</td>
                        <td>{formatHours(hours.break)}</td>
                        <td><strong>{formatHours(hours.effective)}</strong></td>
                        <td>{shift.otApplicable ? `After ${shift.otAfter}h` : "No"}</td>
                        <td><span className={`status-pill ${shift.active ? "active" : "inactive"}`}>{shift.active ? "Active" : "Inactive"}</span></td>
                        <td className="row-actions">
                          <button onClick={() => openEdit(shift)}>Edit</button>
                          <button onClick={() => toggleStatus(shift)}>{shift.active ? "Deactivate" : "Activate"}</button>
                          <button className="delete-button" onClick={() => deleteItem(shift)}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredItems.length && (
                    <tr><td colSpan="9" className="empty-state">No shifts found.<button onClick={openAdd}>Add one now</button></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="master-table-wrap">
              <table className="master-table">
                <thead><tr><th>#</th><th>{currentConfig.singular} Name</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {filteredItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td className="master-name">{item.name}</td>
                      <td><span className={`status-pill ${item.active ? "active" : "inactive"}`}>{item.active ? "Active" : "Inactive"}</span></td>
                      <td className="row-actions">
                        <button onClick={() => openEdit(item)}>Edit</button>
                        <button onClick={() => toggleStatus(item)}>{item.active ? "Deactivate" : "Activate"}</button>
                        <button className="delete-button" onClick={() => deleteItem(item)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {!filteredItems.length && <tr><td colSpan="4" className="empty-state">No records found.<button onClick={openAdd}>Add one now</button></td></tr>}
                </tbody>
              </table>
            </div>
          )}

          <div className="master-note">
            <strong>Dynamic master:</strong> Active values from this section
            will be used as dropdown options in the relevant HRMS modules.
            Deactivating a value keeps the master history while removing it
            from new selections.
          </div>
        </section>
      </div>
    </div>
  );
}

export default Organization;