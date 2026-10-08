import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./Payroll.css";
import { supabase } from "./supabaseClient";
import { STATUTORY_RULE_VERSION, getStatutoryCalculation } from "./statutoryEngine";

const payrollMenu = [
  { id: "dashboard", label: "Payroll Dashboard", icon: "▦" },
  { id: "run", label: "Payroll Run", icon: "01" },
  { id: "inputs", label: "Payroll Inputs", icon: "02" },
  { id: "calculation", label: "Payroll Calculation", icon: "03" },
  { id: "validation", label: "Validation & Approval", icon: "04" },
  { id: "payroll-control", label: "Payroll Lock", icon: "05" },
  { id: "salary-release", label: "Salary Release", icon: "06" },
  { id: "payslips-bank", label: "Payslips & Bank", icon: "07" },
  { id: "reports", label: "Payroll Reports", icon: "08" },
];

const defaultPayrollEmployees = [
  {
    id: "EMP001",
    name: "Rahul Kumar",
    type: "On-Roll",
    department: "Civil",
    site: "Gurgaon HO",
    gross: 42000,
    pf: 1800,
    esi: 0,
    pt: 200,
    lop: 0,
    net: 40000,
    status: "Pending",
  },
  {
    id: "EMP002",
    name: "Amit Sharma",
    type: "On-Roll",
    department: "HR",
    site: "Gurgaon HO",
    gross: 38000,
    pf: 1800,
    esi: 0,
    pt: 200,
    lop: 0,
    net: 36000,
    status: "Pending",
  },
  {
    id: "EMP003",
    name: "Priya Mehta",
    type: "On-Roll",
    department: "Planning",
    site: "Hibbal Project",
    gross: 46000,
    pf: 1800,
    esi: 0,
    pt: 200,
    lop: 0,
    net: 44000,
    status: "Processed",
  },
  {
    id: "EMP004",
    name: "Rajesh Kumar",
    type: "Third Party",
    department: "Construction",
    site: "Polavaram COW",
    vendor: "Conzepts",
    gross: 31500,
    pf: 1800,
    esi: 0,
    pt: 0,
    lop: 1,
    net: 29900,
    status: "Pending",
  },
  {
    id: "EMP005",
    name: "Neha Singh",
    type: "Third Party",
    department: "Document Control",
    site: "Teesta Project",
    vendor: "Taurus",
    gross: 28500,
    pf: 1800,
    esi: 0,
    pt: 0,
    lop: 1,
    net: 26900,
    status: "Pending",
  },
];
const vendors = [
  { name: "Conzepts", employees: 18, serviceCharge: "4.00%", status: "Active" },
  { name: "Taurus", employees: 14, serviceCharge: "4.00%", status: "Active" },
  { name: "Perfect", employees: 11, serviceCharge: "4.00%", status: "Active" },
  { name: "AlignPro", employees: 8, serviceCharge: "4.00%", status: "Active" },
];

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;


// Display-only employee code helper. Internal employee.id references remain unchanged.
// employeeId is intentionally NOT preferred here because in the employee master
// it can be the internal UUID. The visible employee code should come from
// employeeCode / empCode, with safe fallbacks only when they are clearly a code.
const getEmployeeCode = (employee) => {
  const employeeCode = String(
    employee?.employeeCode ?? employee?.empCode ?? ""
  ).trim();

  if (employeeCode) return employeeCode;

  const employeeId = String(employee?.employeeId ?? "").trim();
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      employeeId
    );

  if (employeeId && !looksLikeUuid) return employeeId;

  const internalId = String(employee?.id ?? "").trim();
  return internalId.startsWith("EMP") ? internalId : "";
};
/* Professional Tax — Manual / State-wise Automatic */
const PROFESSIONAL_TAX_RULES = {
  Haryana: { applicable: false, label: "Not Applicable", calculate: () => 0 },
  Delhi: { applicable: false, label: "Not Applicable", calculate: () => 0 },
  Maharashtra: {
    applicable: true,
    label: "Maharashtra Salary/Wage Slab",
    calculate: ({ monthlyWage = 0, gender = "Male", payrollMonth = "" }) => {
      const wage = Number(monthlyWage || 0);
      const female = String(gender || "").toLowerCase() === "female";
      if (female && wage <= 25000) return 0;
      if (!female && wage <= 10000) return 0;
      const month = Number(String(payrollMonth || "").split("-")[1] || 0);
      return month === 2 ? 300 : 200;
    },
  },
};

const calculateProfessionalTax = ({ settings = {}, monthlyWage = 0, gender = "Male", payrollMonth = "" }) => {
  if (!settings?.enabled) return { amount: 0, applicable: false, mode: settings?.mode || "State-wise Automatic", reason: "PT disabled" };
  const mode = settings.mode || "State-wise Automatic";
  if (mode === "Manual") {
    const amount = Math.max(0, Number(settings.manualAmount || 0));
    return { amount, applicable: amount > 0, mode, reason: "Manual PT amount" };
  }
  const rule = PROFESSIONAL_TAX_RULES[settings.state];
  if (!rule) return { amount: 0, applicable: false, mode, reason: "State PT rule not configured" };
  const amount = Number(rule.calculate({ monthlyWage, gender, payrollMonth }) || 0);
  return { amount, applicable: Boolean(rule.applicable && amount > 0), mode, reason: amount > 0 ? rule.label : rule.label };
};


/* =========================================================
   ORGANIZATION -> PAYROLL CONFIGURATION BRIDGE
   Payroll calculations read active masters from Organization.
   Legacy Payroll settings remain only as a safe fallback.
   ========================================================= */
const loadOrganizationPayrollMasters = () => organizationMasters || {};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const resolveWorkforceCategory = (employee, masters) => {
  const categories = Array.isArray(masters?.workforceCategories) ? masters.workforceCategories : [];
  const explicitId = employee?.workforceCategoryId || employee?.workforceCategoryID;
  const explicitName = employee?.workforceCategory || employee?.workforceCategoryName;
  let category = explicitId ? categories.find((x) => x.id === explicitId) : null;
  if (!category && explicitName) category = categories.find((x) => normalizeText(x.name) === normalizeText(explicitName) || normalizeText(x.code) === normalizeText(explicitName));
  if (!category) {
    const type = normalizeText(employee?.type || employee?.employmentType);
    category = categories.find((x) => {
      const name = normalizeText(x.name);
      const ct = normalizeText(x.categoryType);
      return (type === "third party" && (ct === "third_party" || name === "third party")) ||
             ((type === "on-roll" || type === "on roll" || type === "company roll") && (ct === "company_roll" || name === "company roll")) ||
             (type === "expatriate" && (ct === "expatriate" || name === "expatriate")) ||
             (type === "consultant" && (ct === "consultant" || name === "consultant"));
    });
  }
  return category || categories.find((x) => x.active !== false && x.payrollApplicable !== false) || null;
};

const resolvePayrollProfile = (employee, masters, category) => {
  const profiles = Array.isArray(masters?.payrollProfiles) ? masters.payrollProfiles.filter((x) => x.active !== false) : [];
  const directId = employee?.payrollProfileId;
  if (directId) {
    const direct = profiles.find((x) => x.id === directId);
    if (direct) return direct;
  }
  if (category?.payrollProfile) {
    const byName = profiles.find((x) => normalizeText(x.name) === normalizeText(category.payrollProfile) || normalizeText(x.code) === normalizeText(category.payrollProfile));
    if (byName) return byName;
  }
  return profiles.find((x) => Array.isArray(x.workforceCategories) && category && x.workforceCategories.includes(category.id)) || null;
};

const resolvePolicy = (collection, ids, categoryId, effectiveDate) => {
  const items = Array.isArray(collection) ? collection.filter((x) => x.active !== false) : [];
  const list = Array.isArray(ids) ? ids : [];
  const byId = list.map((id) => items.find((x) => x.id === id)).filter(Boolean);
  const date = String(effectiveDate || "9999-12-31");
  const eligible = items.filter((x) => {
    const from = String(x.effectiveFrom || "0000-01-01");
    const to = String(x.effectiveTo || "9999-12-31");
    const catOk = !categoryId || !Array.isArray(x.workforceCategories) || x.workforceCategories.length === 0 || x.workforceCategories.includes(categoryId);
    return from <= date && date <= to && catOk;
  });
  return byId[0] || eligible.sort((a,b) => String(b.effectiveFrom || "").localeCompare(String(a.effectiveFrom || "")))[0] || null;
};

const adaptOrganizationStatutoryPolicy = (policy, fallback) => {
  if (!policy) return fallback;
  return {
    ...(fallback || {}),
    ruleVersion: policy.ruleVersion || fallback?.ruleVersion || STATUTORY_RULE_VERSION,
    effectiveFrom: policy.effectiveFrom || fallback?.effectiveFrom || "",
    companyRuleName: policy.companyRuleName || fallback?.companyRuleName || "Current Company / Establishment",
    pf: { ...(fallback?.pf || {}), ...(policy.pf || {}), enabled: policy.pf?.enabled !== false, employeeRate: String(policy.pf?.employeeRate ?? 12), employerRate: String(policy.pf?.employerRate ?? 12), wageCeiling: String(policy.pf?.wageCeiling ?? 15000), wageBasis: policy.pf?.wageBasis || fallback?.pf?.wageBasis || "Basic + DA + Special Allowance", higherWageContribution: policy.pf?.higherWageContribution ?? false },
    esi: { ...(fallback?.esi || {}), ...(policy.esi || {}), enabled: policy.esi?.enabled === true, employeeRate: String(policy.esi?.employeeRate ?? 0.75), employerRate: String(policy.esi?.employerRate ?? 3.25), wageCeiling: String(policy.esi?.wageCeiling ?? 21000), contributionBasis: policy.esi?.contributionBasis || fallback?.esi?.contributionBasis || "Basic + DA + Special Allowance" },
    pt: { ...(fallback?.pt || {}), ...(policy.pt || {}), enabled: policy.pt?.enabled === true, state: policy.pt?.state || fallback?.pt?.state || "Haryana", mode: "State-wise Automatic" },
    lwf: { ...(fallback?.lwf || {}), ...(policy.lwf || {}), enabled: policy.lwf?.enabled === true, employeeAmount: String(policy.lwf?.employeeAmount ?? 0), employerAmount: String(policy.lwf?.employerAmount ?? 0), frequency: policy.lwf?.frequency || "MONTHLY" },
  };
};

const getSalaryStructureFromOrganizationRule = (employee, existing, salaryRule) => {
  const gross = Number(existing?.gross ?? employee?.gross ?? 0);
  if (!salaryRule) return { ...(existing || {}), gross };
  const components = Array.isArray(salaryRule.components) ? salaryRule.components.filter((x) => x.active !== false) : [];
  let basicDA = 0;
  let hra = 0;
  let specialAllowance = 0;
  const componentAmounts = {};
  components.forEach((component) => {
    const type = normalizeText(component.calculationType);
    const basis = normalizeText(component.amountBasis);
    let amount = 0;
    if (type === "percentage_of_gross") amount = gross * Number(component.value || 0) / 100;
    else if (type === "percentage_of_basic_da") amount = basicDA * Number(component.value || 0) / 100;
    else if (type === "percentage_of_basic") amount = basicDA * Number(component.value || 0) / 100;
    else if (type === "balance") amount = Math.max(0, gross - Object.values(componentAmounts).reduce((s,v) => s + Number(v || 0), 0));
    else if (type === "fixed") amount = Math.max(0, Number(component.value || 0));
    componentAmounts[component.code || component.id || component.name] = amount;
    const code = normalizeText(component.code || component.name);
    if (code === "basic" || code === "basic + da" || basis === "basic_da" && !basicDA) basicDA = amount;
    if (code === "hra") hra = amount;
    if (code === "special" || code === "special allowance") specialAllowance = amount;
  });
  if (!basicDA) basicDA = gross * 0.5;
  if (!hra) hra = basicDA * 0.5;
  if (!specialAllowance) specialAllowance = Math.max(0, gross - basicDA - hra);
  return {
    ...(existing || {}), gross, basicDA, hra, specialAllowance,
    componentAmounts,
  };
};

const calculateOrganizationProration = ({ gross, attendance, employee, payrollMonth, profile, rule }) => {
  const value = Number(gross || 0);
  const [year, month] = String(payrollMonth || "").split("-").map(Number);
  const calendarDays = year && month ? new Date(year, month, 0).getDate() : 0;
  const workingDays = Math.max(0, Number(attendance?.present || 0) + Number(attendance?.halfDay || 0) * 0.5 + Number(attendance?.paidLeave || 0));
  const denomBasis = rule?.denominatorBasis || profile?.workingDaysBasis || "CALENDAR_DAYS";
  const denominator = denomBasis === "FIXED_26" ? 26 : denomBasis === "FIXED_30" ? 30 : denomBasis === "WORKING_DAYS" ? Math.max(1, workingDays) : Math.max(1, calendarDays);
  let paidDays = Number(attendance?.paidDays || 0);
  if (rule) {

  paidDays =
    Number(attendance?.present || 0) +
    Number(attendance?.halfDay || 0) * 0.5 +
    Number(attendance?.paidLeave || 0) +
    Number(attendance?.forceLeavePaidDays || 0) +
    (rule.weeklyOffIncluded ? Number(attendance?.weeklyOff || 0) : 0) +
    (rule.holidayIncluded ? Number(attendance?.holiday || 0) : 0) +
    Number(attendance?.compOff || 0);

}
  const method = rule?.salaryProration || profile?.prorationMethod || "PAID_DAYS";
  let ratio = 1;
  if (method !== "NO_PRORATION") {
    if (method === "WORKING_DAYS") ratio = paidDays / Math.max(1, workingDays);
    else if (method === "CALENDAR_DAYS" || method === "PAID_DAYS") ratio = paidDays / denominator;
  }
  const doj = String(employee?.doj || employee?.dateOfJoining || "");
  const doe = String(employee?.doe || employee?.dateOfExit || "");
  if (rule?.joiningProration && doj && doj.startsWith(String(payrollMonth))) {
    const day = Number(doj.slice(8,10));
    if (day > 1 && denomBasis !== "WORKING_DAYS") ratio *= Math.max(0, (calendarDays - day + 1) / Math.max(1, calendarDays));
  }
  if (rule?.exitProration && doe && doe.startsWith(String(payrollMonth))) {
    const day = Number(doe.slice(8,10));
    if (day > 0 && denomBasis !== "WORKING_DAYS") ratio *= Math.max(0, day / Math.max(1, calendarDays));
  }
  if (rule?.minimumPayableDays && paidDays < Number(rule.minimumPayableDays)) ratio = 0;
  const raw = value * Math.max(0, Math.min(1, ratio));
  return { payableGross: raw, paidDays, denominator, ratio };
};


const PAYROLL_MODULE_SETTINGS_KEY = "payrollModule";
const ORGANIZATION_CODE = "BAUERE";

const DEFAULT_IT_DECLARATION = {
  regime: "New Tax Regime",
  financialYear: "FY 2026-27",
  status: "Open",
  lastDate: "",
  declarations: {},
};

const DEFAULT_PAYROLL_CONTROL = {
  month: "",
  status: "Pending",
  locked: false,
  lockedAt: "",
  lockedBy: "",
  released: false,
  releasedAt: "",
  releasedBy: "",
};

const normalizePayrollModule = (value) => ({
  salaryStructures:
    value?.salaryStructures &&
    typeof value.salaryStructures === "object" &&
    !Array.isArray(value.salaryStructures)
      ? value.salaryStructures
      : {},
  deductions: Array.isArray(value?.deductions) ? value.deductions : [],
  otEntries: Array.isArray(value?.otEntries) ? value.otEntries : [],
  arrearEntries: Array.isArray(value?.arrearEntries) ? value.arrearEntries : [],
  vendorBilling: {
    gstRate: String(value?.vendorBilling?.gstRate ?? "18"),
    gstType: value?.vendorBilling?.gstType || "CGST + SGST",
  },
  payrollRuns: Array.isArray(value?.payrollRuns) ? value.payrollRuns : [],
  processedPayroll: Array.isArray(value?.processedPayroll)
    ? value.processedPayroll
    : [],
  payrollMonth: value?.payrollMonth || "",
  payrollProcessingStatus: value?.payrollProcessingStatus || "Pending",
  itDeclaration: {
    ...DEFAULT_IT_DECLARATION,
    ...(value?.itDeclaration || {}),
    declarations:
      value?.itDeclaration?.declarations &&
      typeof value.itDeclaration.declarations === "object"
        ? value.itDeclaration.declarations
        : {},
  },
  payrollControl: {
    ...DEFAULT_PAYROLL_CONTROL,
    ...(value?.payrollControl || {}),
  },
});

async function getPayrollOrganization() {
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

async function loadPayrollModuleState() {
  const organization = await getPayrollOrganization();
  const settings = organization?.settings || {};
  return {
    organization,
    module: normalizePayrollModule(settings?.[PAYROLL_MODULE_SETTINGS_KEY]),
    masters: settings?.organizationMasters || {},
  };
}

async function savePayrollModuleState(patch) {
  const organization = await getPayrollOrganization();
  const currentSettings = organization?.settings || {};
  const currentModule = normalizePayrollModule(
    currentSettings?.[PAYROLL_MODULE_SETTINGS_KEY]
  );

  const nextModule = {
    ...currentModule,
    ...patch,
  };

  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...currentSettings,
        [PAYROLL_MODULE_SETTINGS_KEY]: nextModule,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", organization.id);

  if (error) throw error;
  return nextModule;
}

const mapPayrollEmployeeRow = (row) => {
  const metadata =
    row?.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {};

  return {
    ...metadata,
    id: row?.id || row?.employee_id || "",
    employeeId: row?.employee_id || metadata.employeeId || "",
    employeeCode:
      row?.employee_id ||
      metadata.employeeCode ||
      metadata.employeeId ||
      "",
    empCode:
      row?.employee_id ||
      metadata.empCode ||
      metadata.employeeId ||
      "",
    name: row?.employee_name || metadata.name || "",
    designation: row?.designation || metadata.designation || "",
    department: row?.department || metadata.department || "",
    site: row?.location || metadata.location || metadata.site || "",
    location: row?.location || metadata.location || metadata.site || "",
    type:
      metadata.employeeGroup ||
      metadata.employeeGroupName ||
      row?.employment_type ||
      metadata.employmentType ||
      metadata.type ||
      "",
    employmentType: row?.employment_type || metadata.employmentType || "",
    vendor:
      row?.vendor ||
      row?.vendor_name ||
      metadata.vendor ||
      metadata.vendorName ||
      "",
    doj: row?.date_of_joining || metadata.doj || "",
    dateOfJoining: row?.date_of_joining || metadata.dateOfJoining || "",
    status: row?.status || metadata.status || "Active",
    gender: row?.gender || metadata.gender || "Male",
    pan: row?.pan || metadata.pan || "",
    uan: row?.uan || metadata.uan || metadata.pfNumber || "",
    esiNumber:
      row?.esi_number ||
      metadata.esiNumber ||
      metadata.esicNumber ||
      "",
    bankName: row?.bank_name || metadata.bankName || "",
    bankAccount:
      row?.bank_account_number ||
      metadata.bankAccountNumber ||
      "",
    ifsc: row?.bank_ifsc || metadata.bankIfsc || "",
    officialEmail: row?.email || metadata.officialEmail || "",
    personalEmail: row?.personal_email || metadata.personalEmail || "",
    mobile: row?.mobile || metadata.mobile || "",
  };
};

function Payroll() {
  const [payrollEmployees, setPayrollEmployees] = useState([]);
  const employees = payrollEmployees;
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [forceLeaveRecords, setForceLeaveRecords] = useState([]);
  const [organizationMasters, setOrganizationMasters] = useState({});
  const getMonthlyAttendance = (employeeId, month) => {
  const monthRecords = {};
  Object.entries(attendanceRecords || {}).forEach(([date, records]) => {
    if (String(date).startsWith(month) && records?.[employeeId]) {
      monthRecords[date] = records[employeeId];
    }
  });
  return monthRecords;
};
const ORGANIZATION_STORAGE_KEY = "bauerHrmsOrganizationMasters";

const getOrganizationLeaveTypes = () => {
  const leavePolicies = Array.isArray(organizationMasters?.leavePolicies)
    ? organizationMasters.leavePolicies
    : [];
  const leavePolicy = leavePolicies[0] || null;
  return Array.isArray(leavePolicy?.leaveTypes)
    ? leavePolicy.leaveTypes
    : [];
};

const getLeaveSalaryTreatment = (status) => {
  const leaveType = getOrganizationLeaveTypes().find(
    (item) => String(item?.code || item?.id || "").toUpperCase() === String(status || "").toUpperCase()
  );

  // Backward-compatible defaults preserve existing payroll behaviour until HR configures a leave type.
  if (!leaveType) {
    return { countAsPaidDay: ["EL", "CL", "SL", "FL", "CO"].includes(status), lop: false };
  }

  return {
    countAsPaidDay: leaveType?.salaryTreatment?.countAsPaidDay !== false,
    lop: Boolean(leaveType?.salaryTreatment?.lop),
  };
};

const calculateMonthlyAttendance = (employeeId, month) => {
  const records = getMonthlyAttendance(employeeId, month);
  const forceLeaveRecords = loadForceLeaveRecordsForPayroll();
  const employee = employees.find((item) => String(item?.id) === String(employeeId));

  let present = 0;
  let halfDay = 0;
  let paidLeave = 0;
  let weeklyOff = 0;
  let holiday = 0;
  let lop = 0;
  let compOff = 0;
  let absent = 0;
  let otHours = 0;
  let weekdayOtHours = 0;
  let sundayOtHours = 0;

  let forceLeaveDays = 0;
  let forceLeavePaidDays = 0;
  let salaryHoldDays = 0;
  let forceLeaveConflictDays = 0;
  let forceLeaveAttendanceWins = 0;
  let forceLeaveForceLeaveWins = 0;
  const forceLeaveConflictDates = [];

  const [year, monthNumber] = String(month).split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${String(year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const attendanceRecord = records?.[dateKey] || null;
    const forceLeaveRecord = getForceLeaveRecordForDate(employee, dateKey, forceLeaveRecords);
    const forceLeaveTreatment = getForceLeavePayrollTreatment(employee, forceLeaveRecord);
    const decision = getForceLeaveAttendanceDecision(attendanceRecord);

    let effectiveRecord = attendanceRecord;

    if (forceLeaveRecord) {
      const actualAttendanceExists = Boolean(attendanceRecord?.status);

      if (actualAttendanceExists && String(attendanceRecord.status).toUpperCase() !== "FL") {
        forceLeaveConflictDays += 1;
        forceLeaveConflictDates.push(dateKey);

        if (decision === "FORCE_LEAVE") {
          forceLeaveForceLeaveWins += 1;
          effectiveRecord = {
            ...(attendanceRecord || {}),
            status: "FL",
            otHours: 0,
            ot: 0,
          };
        } else {
          // No decision or Keep Attendance: never overwrite actual attendance.
          forceLeaveAttendanceWins += 1;
        }
      } else if (!actualAttendanceExists) {
        // No attendance during the active FL period: Force Leave applies.
        effectiveRecord = { status: "FL", otHours: 0, ot: 0 };
      }
    }

    const status = String(effectiveRecord?.status || "").toUpperCase();

    if (forceLeaveRecord && status === "FL") {
      forceLeaveDays += 1;
      if (forceLeaveTreatment.paidDay) {
        forceLeavePaidDays += 1;
      }
      if (forceLeaveTreatment.salaryHold) {
        salaryHoldDays += 1;
      }
    }

    switch (status) {
      case "P":
      case "OD":
      case "WFH":
        present += 1;
        break;

      case "HD":
        halfDay += 1;
        break;

      case "EL":
      case "CL":
      case "SL":
      case "FL": {
        const treatment = forceLeaveRecord && status === "FL"
          ? { countAsPaidDay: forceLeaveTreatment.paidDay, lop: false }
          : getLeaveSalaryTreatment(status);
        if (treatment.countAsPaidDay) paidLeave += 1;
        if (!treatment.countAsPaidDay || treatment.lop) lop += 1;
        break;
      }

      case "WO":
        weeklyOff += 1;
        break;

      case "HO":
        holiday += 1;
        break;

      case "A":
        absent += 1;
        lop += 1;
        break;

      case "CO": {
        const treatment = getLeaveSalaryTreatment(status);
        if (treatment.countAsPaidDay) compOff += 1;
        if (!treatment.countAsPaidDay || treatment.lop) lop += 1;
        break;
      }

      default:
        break;
    }

    const hours = Number(effectiveRecord?.otHours || effectiveRecord?.ot || 0);
    if (Number.isFinite(hours)) {
      otHours += hours;
      if (status === "WO") {
        sundayOtHours += hours;
      } else {
        weekdayOtHours += hours;
      }
    }
  }

  const paidDays =
    present +
    halfDay * 0.5 +
    paidLeave +
    weeklyOff +
    holiday +
    compOff;

  return {
    present,
    halfDay,
    paidLeave,
    weeklyOff,
    holiday,
    compOff,
    absent,
    lop,
    paidDays,
    otHours,
    weekdayOtHours,
    sundayOtHours,
    forceLeaveDays,
    forceLeavePaidDays,
    salaryHoldDays,
    forceLeaveConflictDays,
    forceLeaveAttendanceWins,
    forceLeaveForceLeaveWins,
    forceLeaveConflictDates,
    forceLeaveSalaryTreatment: salaryHoldDays > 0 ? "Salary Hold" : (forceLeavePaidDays > 0 ? "Paid" : ""),
  };
};
  const [payrollModuleLoaded, setPayrollModuleLoaded] = useState(false);
  const [itDeclaration, setITDeclaration] = useState(DEFAULT_IT_DECLARATION);
  const [payrollControl, setPayrollControl] = useState(DEFAULT_PAYROLL_CONTROL);
  const [salaryReleaseState, setSalaryReleaseState] = useState({
    released: false,
    releasedAt: "",
    releasedBy: "",
  });

  const [payrollRun, setPayrollRun] = useState(null);
  const [inputSection, setInputSection] = useState("overview");

  const getPayrollRunForMonth = (moduleState, month) => {
    const runs = Array.isArray(moduleState?.payrollRuns) ? moduleState.payrollRuns : [];
    return runs.find((run) => String(run?.month || "") === String(month)) || null;
  };

  const createOrOpenPayrollRun = async () => {
    if (payrollControl.locked) { window.alert("This payroll month is already locked."); return; }
    try {
      const state = await loadPayrollModuleState();
      const currentRuns = Array.isArray(state.module?.payrollRuns) ? state.module.payrollRuns : [];
      const existing = getPayrollRunForMonth(state.module, payrollMonth);
      const nextRun = existing || { id: `PAY-${String(payrollMonth).replace("-", "")}`, month: payrollMonth, status: "Draft", createdAt: new Date().toISOString(), createdBy: "HR / Payroll", employeeCount: employees.length };
      const nextRuns = existing ? currentRuns.map((run) => run?.month === payrollMonth ? { ...run, employeeCount: employees.length } : run) : [nextRun, ...currentRuns];
      await savePayrollModuleState({ payrollRuns: nextRuns, payrollMonth });
      setPayrollRun(nextRun); setActiveSection("inputs"); setInputSection("overview");
    } catch (error) { console.error("Unable to create payroll run:", error); window.alert("Unable to create/open the payroll run."); }
  };

  const updatePayrollRunStatus = async (status, extra = {}) => {
    try {
      const state = await loadPayrollModuleState();
      const runs = Array.isArray(state.module?.payrollRuns) ? state.module.payrollRuns : [];
      const current = getPayrollRunForMonth(state.module, payrollMonth) || {
        id: `PAY-${String(payrollMonth).replace("-", "")}`,
        month: payrollMonth,
        createdAt: new Date().toISOString(),
        createdBy: "HR / Payroll",
      };
      const nextRun = { ...current, ...extra, status, employeeCount: employees.length, updatedAt: new Date().toISOString() };
      const nextRuns = runs.some((run) => run?.month === payrollMonth)
        ? runs.map((run) => run?.month === payrollMonth ? nextRun : run)
        : [nextRun, ...runs];
      await savePayrollModuleState({ payrollRuns: nextRuns });
      setPayrollRun(nextRun);
    } catch (error) {
      console.error("Unable to update payroll run status:", error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadPayrollData = async () => {
      try {
        const { data: organization } = await getPayrollOrganization();

        const { data: employeeRows, error: employeeError } = await supabase
          .from("employees")
          .select("*")
          .eq("organization_id", organization.id)
          .order("employee_name", { ascending: true });

        if (employeeError) throw employeeError;

        const { data: attendanceRows } = await supabase
          .from("attendance_records")
          .select("*")
          .eq("organization_id", organization.id);

        const attendanceMap = {};
        (attendanceRows || []).forEach((row) => {
          const dateKey =
            row?.attendance_date ||
            row?.date ||
            row?.attendanceDate ||
            row?.date_key ||
            "";
          const employeeId =
            row?.employee_id ||
            row?.employeeId ||
            row?.employee_code ||
            row?.employeeCode ||
            "";
          if (!dateKey || !employeeId) return;

          const record = {
            ...((row?.metadata && typeof row.metadata === "object") ? row.metadata : {}),
            status: row?.status || row?.attendance_status || row?.attendanceStatus || "",
            otHours: row?.ot_hours ?? row?.otHours ?? row?.ot ?? 0,
            inTime: row?.in_time ?? row?.inTime ?? "",
            outTime: row?.out_time ?? row?.outTime ?? "",
          };

          if (!attendanceMap[dateKey]) attendanceMap[dateKey] = {};
          attendanceMap[dateKey][employeeId] = record;
        });

        let forceLeaveRows = [];
        try {
          const { data } = await supabase
            .from("force_leave_records")
            .select("*")
            .eq("organization_id", organization.id);
          forceLeaveRows = Array.isArray(data) ? data : [];
        } catch {
          forceLeaveRows = [];
        }

        const settings = organization?.settings || {};
        const moduleState = normalizePayrollModule(
          settings?.[PAYROLL_MODULE_SETTINGS_KEY]
        );

        if (cancelled) return;

        setPayrollEmployees(
          (employeeRows || [])
            .map(mapPayrollEmployeeRow)
            .filter((employee) => employee.id && getEmployeeCode(employee))
        );
        const nextMasters = settings?.organizationMasters || {};
        setOrganizationMasters(nextMasters);
        setAttendanceRecords(attendanceMap);

        const activeStatutoryPolicies = Array.isArray(nextMasters?.statutoryPolicies)
          ? nextMasters.statutoryPolicies.filter((item) => item?.active !== false)
          : [];
        const activeStatutoryPolicy = activeStatutoryPolicies
          .filter((item) => {
            const from = String(item?.effectiveFrom || "0000-01-01");
            const to = String(item?.effectiveTo || "9999-12-31");
            return from <= payrollMonth + "-31" && payrollMonth + "-01" <= to;
          })
          .sort((a, b) =>
            String(b?.effectiveFrom || "").localeCompare(String(a?.effectiveFrom || ""))
          )[0];

        if (activeStatutoryPolicy) {
          setStatutorySettings({
            ...defaultStatutorySettings,
            ...activeStatutoryPolicy,
            pf: { ...defaultStatutorySettings.pf, ...(activeStatutoryPolicy.pf || {}) },
            esi: { ...defaultStatutorySettings.esi, ...(activeStatutoryPolicy.esi || {}) },
            pt: { ...defaultStatutorySettings.pt, ...(activeStatutoryPolicy.pt || {}) },
            lwf: { ...defaultStatutorySettings.lwf, ...(activeStatutoryPolicy.lwf || {}) },
            wageDefinition: {
              ...defaultStatutorySettings.wageDefinition,
              ...(activeStatutoryPolicy.wageDefinition || {}),
            },
          });
        }
        setForceLeaveRecords(forceLeaveRows);
        setSalaryStructures(moduleState.salaryStructures);
        setDeductions(moduleState.deductions);
        setOTEntries(moduleState.otEntries);
        setArrearEntries(moduleState.arrearEntries);
        setVendorBillingGstRate(moduleState.vendorBilling.gstRate);
        setVendorBillingGstType(moduleState.vendorBilling.gstType);
        setITDeclaration(moduleState.itDeclaration);
        setPayrollControl(moduleState.payrollControl);
        setPayrollRun(getPayrollRunForMonth(moduleState, payrollMonth));
        setSalaryReleaseState({
          released: Boolean(moduleState.payrollControl.released),
          releasedAt: moduleState.payrollControl.releasedAt || "",
          releasedBy: moduleState.payrollControl.releasedBy || "",
        });

        if (moduleState.payrollMonth === payrollMonth) {
          setProcessedPayroll(moduleState.processedPayroll);
          setPayrollProcessingStatus(moduleState.payrollProcessingStatus);
        } else {
          setProcessedPayroll([]);
          setPayrollProcessingStatus("Pending");
        }

        setPayrollModuleLoaded(true);
      } catch (error) {
        console.error("Unable to load Payroll data from Supabase:", error);
        if (!cancelled) {
          setPayrollEmployees([]);
          setPayrollModuleLoaded(false);
        }
      }
    };

    loadPayrollData();

    const refresh = () => loadPayrollData();
    window.addEventListener("bauerHrmsEmployeesUpdated", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("bauerHrmsEmployeesUpdated", refresh);
    };
  }, []);
  const [activeSection, setActiveSection] = useState("dashboard");
  const getCurrentPayrollMonth = () => {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
};

const [payrollMonth, setPayrollMonth] = useState(
  getCurrentPayrollMonth()
);
  const payrollMonthOptions = useMemo(() => {
  const START_YEAR = 2026;
  const START_MONTH = 1;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const options = [];

  for (
    let year = START_YEAR, month = START_MONTH;
    year < currentYear || (year === currentYear && month <= currentMonth);
    month += 1
  ) {
    if (month > 12) {
      month = 1;
      year += 1;
    }

    const value = `${year}-${String(month).padStart(2, "0")}`;

    options.push({
      value,
      label: new Date(year, month - 1, 1).toLocaleString("en-IN", {
        month: "long",
        year: "numeric",
      }),
    });
  }

  return options;
}, []);
  const [employeeType, setEmployeeType] = useState("All Types");
  const [site, setSite] = useState("All Sites");
  const [search, setSearch] = useState("");

  // Employee-wise salary structure master
  const [salaryStructures, setSalaryStructures] = useState({});
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [editingSalaryId, setEditingSalaryId] = useState(null);
  const [salaryEmployeeId, setSalaryEmployeeId] = useState("");
  const [salaryGross, setSalaryGross] = useState("");
  const [salaryInsurance, setSalaryInsurance] = useState("");
  // =========================================================
  // FORCE LEAVE - PAYROLL BRIDGE
  // =========================================================

  const loadForceLeaveRecordsForPayroll = () => forceLeaveRecords;

  const isThirdPartyEmployee = (employee) => {
    const type = String(
      employee?.type ||
      employee?.employeeType ||
      employee?.employmentType ||
      employee?.employeeGroup ||
      ""
    ).trim().toLowerCase();

    return (
      type.includes("third party") ||
      type.includes("third-party") ||
      type.includes("thirdparty") ||
      type.includes("contract")
    );
  };

  const isDateWithinForceLeave = (dateKey, forceLeaveRecord) => {
    if (!dateKey || !forceLeaveRecord) return false;
    const start = String(forceLeaveRecord.flStartDate || "");
    if (!start) return false;

    const actualRejoining = String(forceLeaveRecord.actualRejoiningDate || "");
    const end = actualRejoining
      ? actualRejoining
      : String(forceLeaveRecord.tentativeRejoiningDate || "");

    if (!end) return false;
    return dateKey >= start && dateKey < end;
  };

  const getForceLeaveRecordForDate = (employee, dateKey, forceLeaveRecords) => {
    if (!employee || !dateKey) return null;

    const employeeKeys = new Set(
      [employee?.id, employee?.employeeId, employee?.employeeCode, employee?.empCode]
        .filter(Boolean)
        .map((value) => String(value).trim())
    );

    return (
      forceLeaveRecords.find((record) => {
        // Rejoined records remain valid for historical payroll dates before
        // the actual rejoining date. Cancelled records do not apply.
        if (record?.status === "Cancelled") return false;
        const recordEmployeeId = String(record?.employeeId || "").trim();
        if (!employeeKeys.has(recordEmployeeId)) return false;
        return isDateWithinForceLeave(dateKey, record);
      }) || null
    );
  };

  const getForceLeaveAttendanceDecision = (record) => {
    if (!record) return "";

    const raw =
      record?.forceLeaveResolution ||
      record?.conflictResolution ||
      record?.attendanceConflictResolution ||
      record?.forceLeaveDecision ||
      record?.attendanceDecision ||
      "";

    const value = String(raw).trim().toLowerCase();

    if (value === "keep attendance" || value === "attendance" || value === "attendance wins") {
      return "ATTENDANCE";
    }

    if (value === "keep force leave" || value === "force leave" || value === "force_leave" || value === "fl") {
      return "FORCE_LEAVE";
    }

    return "";
  };

  const getForceLeavePayrollTreatment = (employee, forceLeaveRecord) => {
    if (!forceLeaveRecord) {
      return { isForceLeave: false, salaryTreatment: "", salaryHold: false, paidDay: false };
    }

    const thirdParty = isThirdPartyEmployee(employee);

    return {
      isForceLeave: true,
      salaryTreatment: thirdParty ? "Salary Hold" : "Paid",
      salaryHold: thirdParty,
      paidDay: !thirdParty,
    };
  };

  const [payrollProcessingStatus, setPayrollProcessingStatus] =
    useState("Pending");

  const [processedPayroll, setProcessedPayroll] = useState([]);

  useEffect(() => {
    if (!payrollModuleLoaded) return;

    let cancelled = false;

    const loadSelectedMonth = async () => {
      try {
        const { module } = await loadPayrollModuleState();
        if (cancelled) return;

        if (module.payrollMonth === payrollMonth) {
          setProcessedPayroll(module.processedPayroll);
          setPayrollProcessingStatus(module.payrollProcessingStatus || "Pending");
          setPayrollControl(module.payrollControl);
          setPayrollRun(getPayrollRunForMonth(module, payrollMonth));
          setSalaryReleaseState({
            released: Boolean(module.payrollControl?.released),
            releasedAt: module.payrollControl?.releasedAt || "",
            releasedBy: module.payrollControl?.releasedBy || "",
          });
        } else {
          setProcessedPayroll([]);
          setPayrollProcessingStatus("Pending");
          setPayrollControl((previous) => ({
            ...DEFAULT_PAYROLL_CONTROL,
            month: payrollMonth,
          }));
          setPayrollRun(getPayrollRunForMonth(module, payrollMonth));
          setSalaryReleaseState({
            released: false,
            releasedAt: "",
            releasedBy: "",
          });
        }
      } catch (error) {
        console.error("Unable to load selected payroll month:", error);
      }
    };

    loadSelectedMonth();

    return () => {
      cancelled = true;
    };
  }, [payrollMonth, payrollModuleLoaded]);

  // Salary Register report filters
  const [salaryRegisterSearch, setSalaryRegisterSearch] = useState("");
  const [salaryRegisterType, setSalaryRegisterType] = useState("All");
  const [salaryRegisterSite, setSalaryRegisterSite] = useState("All");
  const [salaryRegisterDepartment, setSalaryRegisterDepartment] = useState("All");

  // Dedicated report state
  const [reportEmployeeId, setReportEmployeeId] = useState("");
  const [vendorBillingVendor, setVendorBillingVendor] = useState("All Vendors");
  const [vendorBillingGstRate, setVendorBillingGstRate] = useState("18");
const [vendorBillingGstType, setVendorBillingGstType] =
  useState("CGST + SGST");

const defaultStatutorySettings = {
    ruleVersion: STATUTORY_RULE_VERSION,
    effectiveFrom: "",
    companyRuleName: "No Active Statutory Policy",
    pf: {
      enabled: false,
      employeeRate: "12",
      employerRate: "12",
      wageCeiling: "25000",
      wageBasis: "Basic + DA + Special Allowance",
      higherWageContribution: false,
      applicable: true,
    },
    esi: {
      enabled: false,
      employeeRate: "0.75",
      employerRate: "3.25",
      wageCeiling: "21000",
      contributionBasis: "Basic + DA + Special Allowance",
      rounding: "Next Rupee",
    },
    pt: {
      enabled: false,
      state: "Haryana",
      mode: "State-wise Automatic",
      manualAmount: "",
      slabs: [],
    },
    lwf: {
      enabled: false,
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

  const [statutorySettings, setStatutorySettings] =
    useState(defaultStatutorySettings);
  const [statutoryTestGross, setStatutoryTestGross] = useState("30000");

  const statutoryTestEmployee = {
    id: "TEST",
    name: "Statutory Test Employee",
    gender: "Male",
  };
  const statutoryTestGrossNumber = Number(statutoryTestGross || 0);
  const statutoryTestBasicDA = statutoryTestGrossNumber * 0.5;
  const statutoryTestHra = statutoryTestBasicDA * 0.5;
  const statutoryTestSpecialAllowance = Math.max(
    0,
    statutoryTestGrossNumber - statutoryTestBasicDA - statutoryTestHra
  );

  const statutoryTestStructure = {
    gross: statutoryTestGrossNumber,
    basicDA: statutoryTestBasicDA,
    hra: statutoryTestHra,
    specialAllowance: statutoryTestSpecialAllowance,
    addOnTotal: 0,
  };
  const statutoryPreview = getStatutoryCalculation({
    employee: statutoryTestEmployee,
    structure: statutoryTestStructure,
    settings: statutorySettings,
    payrollMonth,
  });

  const statutoryPTPreview = calculateProfessionalTax({
    settings: statutorySettings.pt,
    monthlyWage: statutoryTestGrossNumber,
    gender: statutoryTestEmployee.gender,
    payrollMonth,
  });

  const updateStatutory = (section, field, value) => {
    setStatutorySettings((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        [field]: value,
      },
    }));
  };

  const saveStatutorySettings = () => {
    window.alert(
      "Statutory rules are managed in Policy Management. Publish the policy there; Payroll will automatically consume the active linked policy."
    );
  };

  // Bulk salary upload — kept separate from the single-employee salary form
  const [showBulkSalary, setShowBulkSalary] = useState(false);
  const [bulkSalaryRows, setBulkSalaryRows] = useState([]);
  const [bulkSalaryErrors, setBulkSalaryErrors] = useState([]);
  const [bulkSalaryFileName, setBulkSalaryFileName] = useState("");

  /* =========================================================
     PAYROLL DEDUCTIONS
     Loan / Advance + Food + Other + Recovery
     ========================================================= */

  const [deductions, setDeductions] = useState([]);
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionType, setDeductionType] = useState("Loan / Advance");
  const [editingDeductionId, setEditingDeductionId] = useState(null);

  const [deductionEmployeeId, setDeductionEmployeeId] = useState("");
  const [loanType, setLoanType] = useState("Salary Advance");
  const [loanTotal, setLoanTotal] = useState("");
  const [loanStartMonth, setLoanStartMonth] = useState(payrollMonth);
  const [loanEmi, setLoanEmi] = useState("");
  const [loanInstallments, setLoanInstallments] = useState("");
  const [deductionStatus, setDeductionStatus] = useState("Active");

  const [foodAmount, setFoodAmount] = useState("");
  const [foodDays, setFoodDays] = useState("");
  const [foodApplicable, setFoodApplicable] = useState(true);

  const [foodSiteFilter, setFoodSiteFilter] = useState("All Sites");
  const [foodSearch, setFoodSearch] = useState("");
  const [selectedFoodEmployees, setSelectedFoodEmployees] = useState([]);
  const [bulkFoodApplicable, setBulkFoodApplicable] = useState("Yes");
  const [bulkFoodDays, setBulkFoodDays] = useState("");
  const [bulkFoodAmount, setBulkFoodAmount] = useState("");
  const [foodDayBasis, setFoodDayBasis] = useState("26");

  const [otherAmount, setOtherAmount] = useState("");
  const [otherReason, setOtherReason] = useState("");

  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [recoveryReason, setRecoveryReason] = useState("");
  const [recoveryType, setRecoveryType] = useState("Employee Recovery");

  const selectedDeductionEmployee = employees.find(
    (employee) => employee.id === deductionEmployeeId
  );

  const foodDeductionTotal =
    foodApplicable
      ? Math.max(0, Number(foodAmount || 0))
      : 0;

  const resetDeductionForm = () => {
    setEditingDeductionId(null);
    setDeductionEmployeeId("");
    setLoanType("Salary Advance");
    setLoanTotal("");
    setLoanStartMonth(payrollMonth);
    setLoanEmi("");
    setLoanInstallments("");
    setDeductionStatus("Active");
    setFoodAmount("");
    setFoodDays("");
    setFoodApplicable(true);
    setFoodDayBasis("26");
    setOtherAmount("");
    setOtherReason("");
    setRecoveryAmount("");
    setRecoveryReason("");
    setRecoveryType("Employee Recovery");
  };

  const openNewDeduction = (type = "Loan / Advance") => {
    resetDeductionForm();
    setDeductionType(type);
    setShowDeductionForm(true);
  };

  const closeDeductionForm = () => {
    setShowDeductionForm(false);
    resetDeductionForm();
  };

  const saveDeductions = async (next) => {
    setDeductions(next);
    try {
      await savePayrollModuleState({ deductions: next });
    } catch (error) {
      console.error("Unable to save deductions:", error);
      window.alert("Unable to save deductions to Payroll database.");
    }
  };

  const saveDeduction = () => {
    if (!deductionEmployeeId) {
      window.alert("Please select an employee.");
      return;
    }

    const employee = employees.find(
      (item) => item.id === deductionEmployeeId
    );

    if (!employee) {
      window.alert("Selected employee was not found.");
      return;
    }

    let record = {
      id:
        editingDeductionId ||
        `DED-${Date.now()}`,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      employeeType: employee.type,
      site: employee.site,
      type: deductionType,
      status: deductionStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (deductionType === "Loan / Advance") {
      const total = Number(loanTotal || 0);
      const emi = Number(loanEmi || 0);
      const installments = Number(loanInstallments || 0);

      if (total <= 0) {
        window.alert("Please enter a valid total loan / advance amount.");
        return;
      }

      if (emi <= 0) {
        window.alert("Please enter a valid EMI / recovery amount.");
        return;
      }

      if (installments <= 0) {
        window.alert("Please enter number of installments.");
        return;
      }

      if (emi > total) {
        window.alert("EMI cannot be greater than total loan / advance.");
        return;
      }

      record = {
        ...record,
        loanType,
        totalAmount: total,
        recoveredAmount: editingDeductionId
          ? Number(
              deductions.find(
                (item) => item.id === editingDeductionId
              )?.recoveredAmount || 0
            )
          : 0,
        remainingAmount: Math.max(0, total),
        startMonth: loanStartMonth,
        emiAmount: emi,
        installments,
      };
    }

    if (deductionType === "Food Deduction") {
      const amount = foodApplicable
        ? Math.max(0, Number(foodAmount || 0))
        : 0;

      const days = Math.max(0, Number(foodDays || 0));

      if (foodApplicable && amount <= 0) {
        window.alert("Please enter the manual food deduction amount.");
        return;
      }

      const calculationBasis = Number(foodDayBasis || 26);
      const calculatedAmount = foodApplicable
        ? calculateFoodDeduction(amount, days, calculationBasis)
        : 0;

      record = {
        ...record,
        foodApplicable: Boolean(foodApplicable),
        deductionDays: days,
        foodMonthlyAmount: amount,
        calculationBasis,
        totalAmount: calculatedAmount,
        month: payrollMonth,
        remarks: "",
      };
    }

    if (deductionType === "Other Deduction") {
      const amount = Number(otherAmount || 0);

      if (amount <= 0) {
        window.alert("Please enter a valid deduction amount.");
        return;
      }

      if (!otherReason.trim()) {
        window.alert("Please enter the deduction reason.");
        return;
      }

      record = {
        ...record,
        totalAmount: amount,
        reason: otherReason.trim(),
        month: payrollMonth,
      };
    }

    if (deductionType === "Recovery") {
      const amount = Number(recoveryAmount || 0);

      if (amount <= 0) {
        window.alert("Please enter a valid recovery amount.");
        return;
      }

      if (!recoveryReason.trim()) {
        window.alert("Please enter the recovery reason.");
        return;
      }

      record = {
        ...record,
        recoveryType,
        totalAmount: amount,
        reason: recoveryReason.trim(),
        month: payrollMonth,
      };
    }

    const next = editingDeductionId
      ? deductions.map((item) =>
          item.id === editingDeductionId
            ? { ...item, ...record }
            : item
        )
      : [record, ...deductions];

    saveDeductions(next);
    closeDeductionForm();
  };

  const deleteDeduction = (id) => {
    if (!window.confirm("Delete this deduction record?")) return;
    saveDeductions(
      deductions.filter((item) => item.id !== id)
    );
  };

  const toggleDeductionStatus = (id) => {
    const next = deductions.map((item) =>
      item.id === id
        ? {
            ...item,
            status:
              item.status === "Active"
                ? "Inactive"
                : "Active",
            updatedAt: new Date().toISOString(),
          }
        : item
    );

    saveDeductions(next);
  };

  const openEditDeduction = (item) => {
    setEditingDeductionId(item.id);
    setDeductionType(item.type);
    setDeductionEmployeeId(item.employeeId);
    setDeductionStatus(item.status || "Active");

    if (item.type === "Loan / Advance") {
      setLoanType(item.loanType || "Salary Advance");
      setLoanTotal(String(item.totalAmount || ""));
      setLoanStartMonth(item.startMonth || payrollMonth);
      setLoanEmi(String(item.emiAmount || ""));
      setLoanInstallments(String(item.installments || ""));
    }

    if (item.type === "Food Deduction") {
      setFoodAmount(
        String(
          item.foodMonthlyAmount ??
            item.monthlyFoodAmount ??
            3500
        )
      );
      setFoodDays(String(item.deductionDays || ""));
      setFoodApplicable(item.foodApplicable !== false);
      setFoodDayBasis(
        String(item.calculationBasis || 26)
      );
    }

    if (item.type === "Other Deduction") {
      setOtherAmount(String(item.totalAmount || ""));
      setOtherReason(item.reason || "");
    }

    if (item.type === "Recovery") {
      setRecoveryAmount(String(item.totalAmount || ""));
      setRecoveryReason(item.reason || "");
      setRecoveryType(item.recoveryType || "Employee Recovery");
    }

    setShowDeductionForm(true);
  };


  const calculateFoodDeduction = (monthlyAmount, foodDays, basis = foodDayBasis) => {
    const monthly = Math.max(0, Number(monthlyAmount || 0));
    const days = Math.max(0, Number(foodDays || 0));
    const divisor = Math.max(1, Number(basis || 26));
    return Math.round(((monthly / divisor) * days + Number.EPSILON) * 100) / 100;
  };

  const foodSites = [
    "All Sites",
    ...Array.from(
      new Set(
        employees
          .map((employee) => employee.site)
          .filter(Boolean)
      )
    ),
  ];

  const foodMonthlyRecords = deductions.filter(
    (item) =>
      item.type === "Food Deduction" &&
      item.month === payrollMonth
  );

  const foodRows = employees
    .filter((employee) =>
      foodSiteFilter === "All Sites"
        ? true
        : employee.site === foodSiteFilter
    )
    .filter((employee) => {
      const query = foodSearch.trim().toLowerCase();
      if (!query) return true;

      return (
        String(employee.name || "")
          .toLowerCase()
          .includes(query) ||
        String(employee.id || "")
          .toLowerCase()
          .includes(query) ||
        String(employee.site || "")
          .toLowerCase()
          .includes(query)
      );
    })
    .map((employee) => {
      const record = foodMonthlyRecords.find(
        (item) => item.employeeId === employee.id
      );

      const monthlyAmount = Number(
        record?.foodMonthlyAmount ??
          record?.monthlyFoodAmount ??
          3500
      );
      const basis = Number(
        record?.calculationBasis ?? foodDayBasis
      );

      return {
        employee,
        record,
        applicable: record?.foodApplicable ?? false,
        days: record?.deductionDays ?? "",
        monthlyAmount,
        calculatedAmount: record?.foodApplicable
          ? calculateFoodDeduction(
              monthlyAmount,
              record?.deductionDays ?? "",
              basis
            )
          : 0,
        basis,
      };
    });

  const toggleFoodEmployee = (employeeId) => {
    setSelectedFoodEmployees((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    );
  };

  const toggleAllVisibleFoodEmployees = () => {
    const visibleIds = foodRows.map(
      ({ employee }) => employee.id
    );

    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) =>
        selectedFoodEmployees.includes(id)
      );

    setSelectedFoodEmployees((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  const upsertFoodRecord = (employee, patch = {}) => {
    const existing = deductions.find(
      (item) =>
        item.type === "Food Deduction" &&
        item.employeeId === employee.id &&
        item.month === payrollMonth
    );

    const applicable =
      patch.foodApplicable ??
      existing?.foodApplicable ??
      false;

    const deductionDays =
      patch.deductionDays ??
      existing?.deductionDays ??
      "";

    const monthlyFoodAmount = Math.max(
      0,
      Number(
        patch.foodMonthlyAmount ??
          patch.monthlyFoodAmount ??
          existing?.foodMonthlyAmount ??
          existing?.monthlyFoodAmount ??
          3500
      )
    );

    const calculationBasis = Math.max(
      1,
      Number(
        patch.calculationBasis ??
          existing?.calculationBasis ??
          foodDayBasis
      )
    );

    const totalAmount = applicable
      ? calculateFoodDeduction(
          monthlyFoodAmount,
          deductionDays,
          calculationBasis
        )
      : 0;

    const nextRecord = {
      id:
        existing?.id ||
        `FOOD-${employee.id}-${payrollMonth}`,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeType: employee.type,
      site: employee.site,
      type: "Food Deduction",
      status: applicable ? "Active" : "Inactive",
      month: payrollMonth,
      foodApplicable: applicable,
      deductionDays,
      foodMonthlyAmount: monthlyFoodAmount,
      calculationBasis,
      totalAmount,
      remarks:
        patch.remarks ??
        existing?.remarks ??
        "",
      updatedAt: new Date().toISOString(),
      createdAt:
        existing?.createdAt ||
        new Date().toISOString(),
    };

    const next = existing
      ? deductions.map((item) =>
          item.id === existing.id
            ? { ...item, ...nextRecord }
            : item
        )
      : [nextRecord, ...deductions];

    saveDeductions(next);
  };

  const applyBulkFood = () => {
    if (!selectedFoodEmployees.length) {
      window.alert("Please select at least one employee.");
      return;
    }

    const applicable = bulkFoodApplicable === "Yes";
    const hasDays = bulkFoodDays !== "";
    const hasAmount = bulkFoodAmount !== "";

    if (applicable && !hasAmount) {
      window.alert("Please enter the monthly food amount.");
      return;
    }

    const next = [...deductions];

    selectedFoodEmployees.forEach((employeeId) => {
      const employee = employees.find(
        (item) => item.id === employeeId
      );
      if (!employee) return;

      const existingIndex = next.findIndex(
        (item) =>
          item.type === "Food Deduction" &&
          item.employeeId === employee.id &&
          item.month === payrollMonth
      );

      const existing =
        existingIndex >= 0
          ? next[existingIndex]
          : null;

      const monthlyFoodAmount = hasAmount
        ? Math.max(0, Number(bulkFoodAmount || 0))
        : Number(
            existing?.foodMonthlyAmount ??
              existing?.monthlyFoodAmount ??
              3500
          );

      const deductionDays = hasDays
        ? Math.max(0, Number(bulkFoodDays || 0))
        : Math.max(0, Number(existing?.deductionDays || 0));

      const calculationBasis = Math.max(
        1,
        Number(foodDayBasis || 26)
      );

      const updated = {
        id:
          existing?.id ||
          `FOOD-${employee.id}-${payrollMonth}`,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeType: employee.type,
        site: employee.site,
        type: "Food Deduction",
        status: applicable ? "Active" : "Inactive",
        month: payrollMonth,
        foodApplicable: applicable,
        deductionDays,
        foodMonthlyAmount: monthlyFoodAmount,
        calculationBasis,
        totalAmount: applicable
          ? calculateFoodDeduction(
              monthlyFoodAmount,
              deductionDays,
              calculationBasis
            )
          : 0,
        remarks: existing?.remarks || "",
        createdAt:
          existing?.createdAt ||
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        next[existingIndex] = {
          ...next[existingIndex],
          ...updated,
        };
      } else {
        next.unshift(updated);
      }
    });

    saveDeductions(next);
    setSelectedFoodEmployees([]);
    setBulkFoodDays("");
    setBulkFoodAmount("");
  };

  const updateFoodRow = (employeeId, field, value) => {
    const employee = employees.find(
      (item) => item.id === employeeId
    );
    if (!employee) return;

    if (field === "foodApplicable") {
      upsertFoodRecord(employee, {
        foodApplicable: value,
      });
      return;
    }

    if (field === "deductionDays") {
      upsertFoodRecord(employee, {
        deductionDays: value,
      });
      return;
    }

    if (field === "foodMonthlyAmount") {
      upsertFoodRecord(employee, {
        foodMonthlyAmount: Math.max(
          0,
          Number(value || 0)
        ),
        foodApplicable: true,
      });
    }
  };

  const deductionTypeMeta = {
    "Loan / Advance": {
      icon: "₹",
      detail: "Recovery schedule",
    },
    "Food Deduction": {
      icon: "FD",
      detail: "Manual monthly deduction",
    },
    "Other Deduction": {
      icon: "−",
      detail: "Manual approved deduction",
    },
    Recovery: {
      icon: "↺",
      detail: "Vendor / employee recovery",
    },
  };




  /* =========================================================
     OT & ARREAR
     Weekday OT 1.5x + Sunday/Holiday OT 2.0x
     Arrear + Adjustment
     ========================================================= */

  const [otEntries, setOTEntries] = useState([]);
const [arrearEntries, setArrearEntries] = useState([]);

const [showOTForm, setShowOTForm] = useState(false);
  const [otFormType, setOTFormType] = useState("OT 1.5x");
  const [editingOTId, setEditingOTId] = useState(null);

  const [otEmployeeId, setOTEmployeeId] = useState("");
  const [otMonth, setOTMonth] = useState(payrollMonth);
  const [otWeekdayHours, setOTWeekdayHours] = useState("");
  const [otSundayHours, setOTSundayHours] = useState("");
  const [otMultiplier, setOTMultiplier] = useState("1.5");
  const [otMultiplier2, setOTMultiplier2] = useState("2.0");
  const [otWageBasis, setOTWageBasis] = useState("Basic + DA");
  const [otDayBasis, setOTDayBasis] = useState("26");
  const [otHoursPerDay, setOTHoursPerDay] = useState("8");
  const [otManualHourlyRate, setOTManualHourlyRate] = useState("");

  const [showBulkOT, setShowBulkOT] = useState(false);
  const [bulkOTRows, setBulkOTRows] = useState([]);
  const [bulkOTErrors, setBulkOTErrors] = useState([]);
  const [bulkOTFileName, setBulkOTFileName] = useState("");
  const [bulkOTImportMonth, setBulkOTImportMonth] = useState(payrollMonth);
  const [bulkOTWageBasis, setBulkOTWageBasis] = useState("Basic + DA");
  const [bulkOTDayBasis, setBulkOTDayBasis] = useState("26");
  const [bulkOTHoursPerDay, setBulkOTHoursPerDay] = useState("8");
  const [bulkOTMultiplier15, setBulkOTMultiplier15] = useState("1.5");
  const [bulkOTMultiplier20, setBulkOTMultiplier20] = useState("2.0");

  const openBulkOT = () => {
    setBulkOTRows([]);
    setBulkOTErrors([]);
    setBulkOTFileName("");
    setBulkOTImportMonth(payrollMonth);
    setBulkOTWageBasis("Basic + DA");
    setBulkOTDayBasis("26");
    setBulkOTHoursPerDay("8");
    setBulkOTMultiplier15("1.5");
    setBulkOTMultiplier20("2.0");
    setShowBulkOT(true);
  };

  const closeBulkOT = () => {
    setShowBulkOT(false);
    setBulkOTRows([]);
    setBulkOTErrors([]);
    setBulkOTFileName("");
  };

  const downloadOTTemplate = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Site / Project",
      "OT 1.5x Hours",
      "OT 2.0x Hours",
    ];

    const rows = employees.map((employee) => [
      employee.id,
      employee.name,
      employee.site || "",
      "",
      "",
    ]);

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS – BULK OT IMPORT TEMPLATE"],
      ["Instructions", "Do not modify Employee ID, Employee Name or Site / Project. Enter only OT 1.5x Hours and OT 2.0x Hours."],
      [],
      headers,
      ...rows,
    ]);

    sheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    ];
    sheet["!freeze"] = { xSplit: 3, ySplit: 5 };
    sheet["!autofilter"] = { ref: `A5:E${rows.length + 5}` };
    sheet["!cols"] = [
      { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 16 },
    ];

    const guide = XLSX.utils.aoa_to_sheet([
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["BULK OT IMPORT GUIDELINES"],
      ["Employee ID", "Must match the HRMS employee master."],
      ["OT 1.5x Hours", "Weekday overtime hours. Enter 0 when not applicable."],
      ["OT 2.0x Hours", "Sunday / holiday overtime hours. Enter 0 when not applicable."],
      ["Calculation", "HRMS calculates hourly rate and OT amount automatically using the selected wage basis, day basis and hours/day."],
      ["Validation", "Duplicate Employee IDs, unknown Employee IDs and negative OT hours are rejected."],
    ]);
    guide["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];
    guide["!cols"] = [{ wch: 22 }, { wch: 100 }];

    XLSX.utils.book_append_sheet(workbook, sheet, "OT Upload");
    XLSX.utils.book_append_sheet(workbook, guide, "Instructions");
    XLSX.writeFile(workbook, `HRMS_Bulk_OT_Template_${payrollMonth}.xlsx`);
  };

  const normalizeOTImportNumber = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    const number = Number(String(value).replace(/[ ,]/g, "").trim());
    return Number.isFinite(number) ? number : NaN;
  };

  const buildBulkOTPreview = (employee, row) => {
    const weekdayHours = normalizeOTImportNumber(row["OT 1.5x Hours"]);
    const sundayHours = normalizeOTImportNumber(row["OT 2.0x Hours"]);
    let wage = 0;

    if (bulkOTWageBasis === "Gross") {
      wage = Number(salaryStructures[employee.id]?.gross ?? employee.gross ?? 0);
    } else {
      wage = Number(
        salaryStructures[employee.id]?.basicDA ??
        ((salaryStructures[employee.id]?.gross ?? employee.gross ?? 0) * 0.5)
      );
    }

    const hourlyRate =
      wage /
      Math.max(1, Number(bulkOTDayBasis || 26)) /
      Math.max(1, Number(bulkOTHoursPerDay || 8));

    const weekdayAmount = hourlyRate * Number(bulkOTMultiplier15 || 1.5) * weekdayHours;
    const sundayAmount = hourlyRate * Number(bulkOTMultiplier20 || 2) * sundayHours;

    return {
      employee,
      weekdayHours,
      sundayHours,
      hourlyRate,
      weekdayAmount,
      sundayAmount,
      totalAmount: weekdayAmount + sundayAmount,
    };
  };

  const processBulkOTFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBulkOTFileName(file.name);
    setBulkOTRows([]);
    setBulkOTErrors([]);

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", range: 4 });
      const errors = [];
      const validRows = [];
      const seen = new Set();

      rawRows.forEach((row, index) => {
        const excelRow = index + 6;
        const id = String(row["Employee ID"] ?? "").trim();
        if (!id) {
          errors.push(`Row ${excelRow}: Employee ID is required.`);
          return;
        }
        if (seen.has(id)) {
          errors.push(`Row ${excelRow}: Duplicate Employee ID ${id}.`);
          return;
        }
        seen.add(id);

        const employee = employees.find((item) => item.id === id);
        if (!employee) {
          errors.push(`Row ${excelRow}: Employee ID ${id} was not found in employee master.`);
          return;
        }

        const weekdayHours = normalizeOTImportNumber(row["OT 1.5x Hours"]);
        const sundayHours = normalizeOTImportNumber(row["OT 2.0x Hours"]);
        if (Number.isNaN(weekdayHours) || Number.isNaN(sundayHours)) {
          errors.push(`Row ${excelRow}: OT hours must be numeric or blank.`);
          return;
        }
        if (weekdayHours < 0 || sundayHours < 0) {
          errors.push(`Row ${excelRow}: OT hours cannot be negative.`);
          return;
        }
        if (weekdayHours === 0 && sundayHours === 0) return;

        validRows.push({
          ...buildBulkOTPreview(employee, row),
          rowNumber: excelRow,
        });
      });

      setBulkOTErrors(errors);
      setBulkOTRows(validRows);
    } catch {
      setBulkOTErrors(["Unable to read the Excel file. Please use the HRMS OT template (.xlsx)."]);
    }
  };

  const saveBulkOTEntries = () => {
    if (!bulkOTRows.length || bulkOTErrors.length) return;

    const next = [...otEntries];
    bulkOTRows.forEach((item) => {
      const existingIndex = next.findIndex(
        (entry) => entry.employeeId === item.employee.id && entry.payrollMonth === bulkOTImportMonth
      );

      const updated = {
        id:
          existingIndex >= 0
            ? next[existingIndex].id
            : `OT-${item.employee.id}-${bulkOTImportMonth}-${Date.now()}`,
        employeeId: item.employee.id,
        employeeName: item.employee.name,
        employeeType: item.employee.type,
        site: item.employee.site,
        payrollMonth: bulkOTImportMonth,
        weekdayHours: item.weekdayHours,
        sundayHolidayHours: item.sundayHours,
        multiplier15: Number(bulkOTMultiplier15 || 1.5),
        multiplier20: Number(bulkOTMultiplier20 || 2),
        wageBasis: bulkOTWageBasis,
        dayBasis: Number(bulkOTDayBasis || 26),
        hoursPerDay: Number(bulkOTHoursPerDay || 8),
        hourlyRate: Math.round(item.hourlyRate * 100) / 100,
        weekdayAmount: Math.round(item.weekdayAmount * 100) / 100,
        sundayHolidayAmount: Math.round(item.sundayAmount * 100) / 100,
        totalAmount: Math.round(item.totalAmount * 100) / 100,
        category:
          item.weekdayHours > 0 && item.sundayHours > 0
            ? "OT 1.5x + OT 2.0x"
            : item.sundayHours > 0
              ? "OT 2.0x"
              : "OT 1.5x",
        updatedAt: new Date().toISOString(),
        createdAt:
          existingIndex >= 0
            ? next[existingIndex].createdAt || new Date().toISOString()
            : new Date().toISOString(),
      };

      if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...updated };
      else next.unshift(updated);
    });

    saveOTEntries(next);
    closeBulkOT();
  };

  const [showArrearForm, setShowArrearForm] = useState(false);
  const [arrearType, setArrearType] = useState("Arrear");
  const [editingArrearId, setEditingArrearId] = useState(null);
  const [arrearEmployeeId, setArrearEmployeeId] = useState("");
  const [arrearMonth, setArrearMonth] = useState("");
  const [arrearAmount, setArrearAmount] = useState("");
  const [arrearReason, setArrearReason] = useState("");
  const [adjustmentMode, setAdjustmentMode] = useState("Addition");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [showBulkArrear, setShowBulkArrear] = useState(false);
  const [bulkArrearRows, setBulkArrearRows] = useState([]);
  const [bulkArrearErrors, setBulkArrearErrors] = useState([]);
  const [bulkArrearFileName, setBulkArrearFileName] = useState("");
  const [bulkArrearMonth, setBulkArrearMonth] = useState(payrollMonth);
  const [bulkArrearPeriod, setBulkArrearPeriod] = useState("");


  const selectedOTEmployee = employees.find(
    (employee) => employee.id === otEmployeeId
  );

  const selectedArrearEmployee = employees.find(
    (employee) => employee.id === arrearEmployeeId
  );
  const openBulkArrear = () => {
    setBulkArrearRows([]);
    setBulkArrearErrors([]);
    setBulkArrearFileName("");
    setBulkArrearMonth(payrollMonth);
    setBulkArrearPeriod("");
    setShowBulkArrear(true);
  };

  const closeBulkArrear = () => {
    setShowBulkArrear(false);
    setBulkArrearRows([]);
    setBulkArrearErrors([]);
    setBulkArrearFileName("");
    setBulkArrearPeriod("");
  };

  const downloadArrearTemplate = () => {
    const headers = [
      "Employee Code",
      "Employee Name",
      "DOJ",
      "Vendor Name",
      "Site Name",
      "Arrear Amount",
    ];

    const rows = employees.map((employee) => [
      employee.id || "",
      employee.name || "",
      employee.doj ||
        employee.dateOfJoining ||
        "",
      employee.vendor || "",
      employee.site || "",
      "",
    ]);

    const workbook = XLSX.utils.book_new();

    const sheet = XLSX.utils.aoa_to_sheet([
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS – BULK ARREAR IMPORT TEMPLATE"],
      [
        "Instructions",
        "Do not modify Employee Code, Employee Name, DOJ, Vendor Name or Site Name. Enter only Arrear Amount.",
      ],
      [],
      headers,
      ...rows,
    ]);

    sheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: 5 },
      },
      {
        s: { r: 1, c: 0 },
        e: { r: 1, c: 5 },
      },
      {
        s: { r: 2, c: 0 },
        e: { r: 2, c: 5 },
      },
    ];

    sheet["!freeze"] = {
      xSplit: 2,
      ySplit: 5,
    };

    sheet["!autofilter"] = {
      ref: `A5:F${rows.length + 5}`,
    };

    sheet["!cols"] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 16 },
      { wch: 20 },
      { wch: 25 },
      { wch: 16 },
    ];

    const guide = XLSX.utils.aoa_to_sheet([
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["BULK ARREAR IMPORT GUIDELINES"],
      [
        "Employee Code",
        "Must match the HRMS employee master.",
      ],
      [
        "Employee Name",
        "Used as an employee verification field; HRMS also reads the master record.",
      ],
      [
        "DOJ",
        "Optional in the source file, but when provided it must match the HRMS employee record.",
      ],
      [
        "Vendor Name",
        "Optional for on-roll employees; for third-party employees it should match the HRMS master.",
      ],
      [
        "Site Name",
        "Should match the employee's current site/project.",
      ],
      [
        "Arrear Amount",
        "Enter the positive arrear amount for the employee.",
      ],
      [
        "Payroll Month",
        "Selected in the import window and applied to all uploaded rows.",
      ],
    ]);

    guide["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: 1 },
      },
      {
        s: { r: 1, c: 0 },
        e: { r: 1, c: 1 },
      },
    ];

    guide["!cols"] = [
      { wch: 22 },
      { wch: 100 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      "Arrear Upload"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      guide,
      "Instructions"
    );

    XLSX.writeFile(
      workbook,
      `HRMS_Bulk_Arrear_Template_${payrollMonth}.xlsx`
    );
  };

  const normalizeArrearAmount = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    const number = Number(
      String(value)
        .replace(/[,\s₹]/g, "")
        .trim()
    );

    return Number.isFinite(number)
      ? number
      : NaN;
  };

  const normalizeText = (value) =>
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const processBulkArrearFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setBulkArrearFileName(file.name);
    setBulkArrearRows([]);
    setBulkArrearErrors([]);

    try {
      const workbook = XLSX.read(
        await file.arrayBuffer(),
        { type: "array" }
      );

      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const rawRows =
        XLSX.utils.sheet_to_json(
          sheet,
          {
            defval: "",
            range: 4,
          }
        );

      const errors = [];
      const validRows = [];
      const seen = new Set();

      rawRows.forEach((row, index) => {
        const excelRow = index + 6;

        const id = String(
          row["Employee Code"] ??
            row["Employee ID"] ??
            ""
        ).trim();

        if (!id) {
          errors.push(
            `Row ${excelRow}: Employee Code is required.`
          );
          return;
        }

        if (seen.has(id)) {
          errors.push(
            `Row ${excelRow}: Duplicate Employee Code ${id}.`
          );
          return;
        }

        seen.add(id);

        const employee = employees.find(
          (item) => item.id === id
        );

        if (!employee) {
          errors.push(
            `Row ${excelRow}: Employee Code ${id} was not found in employee master.`
          );
          return;
        }

        const masterName =
          normalizeText(employee.name);

        const uploadedName =
          normalizeText(
            row["Employee Name"]
          );

        if (
          uploadedName &&
          uploadedName !== masterName
        ) {
          errors.push(
            `Row ${excelRow}: Employee Name does not match master for ${id}.`
          );
          return;
        }

        const masterSite =
          normalizeText(employee.site);

        const uploadedSite =
          normalizeText(
            row["Site Name"]
          );

        if (
          uploadedSite &&
          uploadedSite !== masterSite
        ) {
          errors.push(
            `Row ${excelRow}: Site Name does not match master for ${id}.`
          );
          return;
        }

        const masterVendor =
          normalizeText(
            employee.vendor
          );

        const uploadedVendor =
          normalizeText(
            row["Vendor Name"]
          );

        if (
          uploadedVendor &&
          uploadedVendor !== masterVendor
        ) {
          errors.push(
            `Row ${excelRow}: Vendor Name does not match master for ${id}.`
          );
          return;
        }

        const uploadedDOJ = String(
          row["DOJ"] ?? ""
        ).trim();

        const masterDOJ = String(
          employee.doj ||
            employee.dateOfJoining ||
            ""
        ).trim();

        if (
          uploadedDOJ &&
          masterDOJ &&
          normalizeText(uploadedDOJ) !==
            normalizeText(masterDOJ)
        ) {
          errors.push(
            `Row ${excelRow}: DOJ does not match master for ${id}.`
          );
          return;
        }

        const amount =
          normalizeArrearAmount(
            row["Arrear Amount"]
          );

        if (Number.isNaN(amount)) {
          errors.push(
            `Row ${excelRow}: Arrear Amount must be numeric.`
          );
          return;
        }

        if (amount < 0) {
          errors.push(
            `Row ${excelRow}: Arrear Amount cannot be negative.`
          );
          return;
        }

        if (amount === 0) {
          return;
        }

        validRows.push({
          employee,
          employeeCode: id,
          employeeName:
            employee.name,
          doj:
            employee.doj ||
            employee.dateOfJoining ||
            uploadedDOJ ||
            "",
          vendor:
            employee.vendor ||
            uploadedVendor ||
            "",
          site:
            employee.site ||
            uploadedSite ||
            "",
          amount:
            Math.round(
              amount * 100
            ) / 100,
          rowNumber: excelRow,
        });
      });

      setBulkArrearErrors(errors);
      setBulkArrearRows(validRows);
    } catch {
      setBulkArrearErrors([
        "Unable to read the Excel file. Please use the HRMS Arrear template (.xlsx).",
      ]);
    }
  };

  const saveBulkArrearEntries = () => {
    if (
      !bulkArrearRows.length ||
      bulkArrearErrors.length
    ) {
      return;
    }

    const next = [...arrearEntries];

    bulkArrearRows.forEach((item) => {
      const existingIndex =
        next.findIndex(
          (entry) =>
            entry.employeeId ===
              item.employee.id &&
            entry.payrollMonth ===
              bulkArrearMonth &&
            entry.type === "Arrear"
        );

      const updated = {
        id:
          existingIndex >= 0
            ? next[existingIndex].id
            : `ARR-${item.employee.id}-${bulkArrearMonth}-${Date.now()}`,
        employeeId:
          item.employee.id,
        employeeName:
          item.employee.name,
        employeeType:
          item.employee.type,
        site:
          item.employee.site,
        vendor:
          item.employee.vendor ||
          item.vendor ||
          "",
        doj:
          item.employee.doj ||
          item.employee.dateOfJoining ||
          item.doj ||
          "",
        payrollMonth:
          bulkArrearMonth,
        previousMonth:
          bulkArrearPeriod,
        amount:
          Math.round(
            item.amount * 100
          ) / 100,
        type: "Arrear",
        adjustmentMode:
          "Addition",
        reason:
          `Bulk imported arrear${bulkArrearPeriod ? ` for ${bulkArrearPeriod}` : ""}`,
        createdAt:
          existingIndex >= 0
            ? next[existingIndex]
                .createdAt ||
              new Date().toISOString()
            : new Date().toISOString(),
        updatedAt:
          new Date().toISOString(),
      };

      if (
        existingIndex >= 0
      ) {
        next[existingIndex] = {
          ...next[existingIndex],
          ...updated,
        };
      } else {
        next.unshift(updated);
      }
    });

    saveArrearEntries(next);
    closeBulkArrear();
  };



  const getEmployeeWageForOT = (employee) => {
    const structure = salaryStructures[employee.id];

    if (otWageBasis === "Gross") {
      return Number(
        structure?.gross ??
          employee.gross ??
          0
      );
    }

    if (otWageBasis === "Manual Hourly Rate") {
      return 0;
    }

    return Number(
      structure?.basicDA ??
        ((structure?.gross ??
          employee.gross ??
          0) * 0.5)
    );
  };

  const getHourlyRate = (employee) => {
    if (otWageBasis === "Manual Hourly Rate") {
      return Math.max(
        0,
        Number(otManualHourlyRate || 0)
      );
    }

    const wage = getEmployeeWageForOT(employee);
    const dayBasis = Math.max(
      1,
      Number(otDayBasis || 26)
    );
    const hoursPerDay = Math.max(
      1,
      Number(otHoursPerDay || 8)
    );

    return wage / dayBasis / hoursPerDay;
  };

  const calculateOTAmounts = (employee) => {
    if (!employee) {
      return {
        hourlyRate: 0,
        weekdayAmount: 0,
        sundayAmount: 0,
        total: 0,
      };
    }

    const hourlyRate = getHourlyRate(employee);
    const weekdayHours = Math.max(
      0,
      Number(otWeekdayHours || 0)
    );
    const sundayHours = Math.max(
      0,
      Number(otSundayHours || 0)
    );

    const weekdayAmount =
      hourlyRate *
      Number(otMultiplier || 1.5) *
      weekdayHours;

    const sundayAmount =
      hourlyRate *
      Number(otMultiplier2 || 2) *
      sundayHours;

    return {
      hourlyRate,
      weekdayAmount,
      sundayAmount,
      total:
        weekdayAmount +
        sundayAmount,
    };
  };

  const saveOTEntries = async (next) => {
    setOTEntries(next);
    try {
      await savePayrollModuleState({ otEntries: next });
    } catch (error) {
      console.error("Unable to save OT entries:", error);
      window.alert("Unable to save OT entries to Payroll database.");
    }
  };

  const saveArrearEntries = async (next) => {
    setArrearEntries(next);
    try {
      await savePayrollModuleState({ arrearEntries: next });
    } catch (error) {
      console.error("Unable to save arrears:", error);
      window.alert("Unable to save arrears to Payroll database.");
    }
  };

  const resetOTForm = () => {
    setEditingOTId(null);
    setOTEmployeeId("");
    setOTMonth(payrollMonth);
    setOTWeekdayHours("");
    setOTSundayHours("");
    setOTMultiplier("1.5");
    setOTMultiplier2("2.0");
    setOTWageBasis("Basic + DA");
    setOTDayBasis("26");
    setOTHoursPerDay("8");
    setOTManualHourlyRate("");
  };

  const resetArrearForm = () => {
    setEditingArrearId(null);
    setArrearEmployeeId("");
    setArrearMonth("");
    setArrearAmount("");
    setArrearReason("");
    setAdjustmentMode("Addition");
    setAdjustmentAmount("");
    setAdjustmentReason("");
  };

  const openOTForm = (type = "OT 1.5x") => {
    resetOTForm();
    setOTFormType(type);
    setShowOTForm(true);
  };

  const closeOTForm = () => {
    setShowOTForm(false);
    resetOTForm();
  };

  const openArrearForm = (type = "Arrear") => {
    resetArrearForm();
    setArrearType(type);
    setShowArrearForm(true);
  };

  const closeArrearForm = () => {
    setShowArrearForm(false);
    resetArrearForm();
  };

  const saveOTEntry = () => {
    if (!otEmployeeId) {
      window.alert("Please select an employee.");
      return;
    }

    const employee = employees.find(
      (item) => item.id === otEmployeeId
    );

    if (!employee) {
      window.alert("Selected employee was not found.");
      return;
    }

    if (
      otWageBasis === "Manual Hourly Rate" &&
      !(Number(otManualHourlyRate) > 0)
    ) {
      window.alert(
        "Please enter a valid manual hourly rate."
      );
      return;
    }

    const amounts =
      calculateOTAmounts(employee);

    if (
      Number(otWeekdayHours || 0) <= 0 &&
      Number(otSundayHours || 0) <= 0
    ) {
      window.alert(
        "Please enter weekday OT hours or Sunday / holiday OT hours."
      );
      return;
    }

    const record = {
      id:
        editingOTId ||
        `OT-${employee.id}-${otMonth}-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeType: employee.type,
      site: employee.site,
      payrollMonth: otMonth,
      weekdayHours: Math.max(
        0,
        Number(otWeekdayHours || 0)
      ),
      sundayHolidayHours: Math.max(
        0,
        Number(otSundayHours || 0)
      ),
      multiplier15: Math.max(
        0,
        Number(otMultiplier || 1.5)
      ),
      multiplier20: Math.max(
        0,
        Number(otMultiplier2 || 2)
      ),
      wageBasis: otWageBasis,
      dayBasis: Math.max(
        1,
        Number(otDayBasis || 26)
      ),
      hoursPerDay: Math.max(
        1,
        Number(otHoursPerDay || 8)
      ),
      manualHourlyRate:
        otWageBasis === "Manual Hourly Rate"
          ? Math.max(
              0,
              Number(otManualHourlyRate || 0)
            )
          : null,
      hourlyRate:
        Math.round(
          amounts.hourlyRate * 100
        ) / 100,
      weekdayAmount:
        Math.round(
          amounts.weekdayAmount * 100
        ) / 100,
      sundayHolidayAmount:
        Math.round(
          amounts.sundayAmount * 100
        ) / 100,
      totalAmount:
        Math.round(
          amounts.total * 100
        ) / 100,
      category:
        Number(otSundayHours || 0) > 0 &&
        Number(otWeekdayHours || 0) > 0
          ? "OT 1.5x + OT 2.0x"
          : Number(otSundayHours || 0) > 0
            ? "OT 2.0x"
            : "OT 1.5x",
      updatedAt:
        new Date().toISOString(),
      createdAt:
        editingOTId
          ? otEntries.find(
              (item) => item.id === editingOTId
            )?.createdAt ||
            new Date().toISOString()
          : new Date().toISOString(),
    };

    const next = editingOTId
      ? otEntries.map((item) =>
          item.id === editingOTId
            ? record
            : item
        )
      : [record, ...otEntries];

    saveOTEntries(next);
    closeOTForm();
  };

  const editOTEntry = (item) => {
    setEditingOTId(item.id);
    setOTFormType(
      item.category === "OT 2.0x"
        ? "OT 2.0x"
        : "OT 1.5x"
    );
    setOtEmployeeIdSafe(item.employeeId);
    setOTMonth(item.payrollMonth);
    setOTWeekdayHours(
      String(item.weekdayHours || "")
    );
    setOTSundayHours(
      String(item.sundayHolidayHours || "")
    );
    setOTMultiplier(
      String(item.multiplier15 ?? 1.5)
    );
    setOTMultiplier2(
      String(item.multiplier20 ?? 2)
    );
    setOTWageBasis(
      item.wageBasis || "Basic + DA"
    );
    setOTDayBasis(
      String(item.dayBasis || 26)
    );
    setOTHoursPerDay(
      String(item.hoursPerDay || 8)
    );
    setOTManualHourlyRate(
      item.manualHourlyRate == null
        ? ""
        : String(item.manualHourlyRate)
    );
    setShowOTForm(true);
  };

  const deleteOTEntry = (id) => {
    if (!window.confirm("Delete this OT entry?")) {
      return;
    }

    saveOTEntries(
      otEntries.filter(
        (item) => item.id !== id
      )
    );
  };

  const saveArrearEntry = () => {
    if (!arrearEmployeeId) {
      window.alert("Please select an employee.");
      return;
    }

    if (!arrearMonth) {
      window.alert("Please select the arrear month.");
      return;
    }

    const amount =
      Number(arrearAmount || 0);

    if (!(amount > 0)) {
      window.alert("Please enter a valid arrear amount.");
      return;
    }

    if (!arrearReason.trim()) {
      window.alert("Please enter the arrear reason.");
      return;
    }

    const employee = employees.find(
      (item) => item.id === arrearEmployeeId
    );

    const record = {
      id:
        editingArrearId ||
        `ARR-${arrearEmployeeId}-${Date.now()}`,
      employeeId: arrearEmployeeId,
      employeeName: employee?.name || "",
      employeeType: employee?.type || "",
      site: employee?.site || "",
      payrollMonth,
      previousMonth: arrearMonth,
      amount:
        Math.round(amount * 100) / 100,
      type: arrearType,
      adjustmentMode,
      reason:
        arrearType === "Adjustment"
          ? adjustmentReason.trim() ||
            "Approved payroll adjustment"
          : arrearReason.trim(),
      createdAt:
        editingArrearId
          ? arrearEntries.find(
              (item) =>
                item.id === editingArrearId
            )?.createdAt ||
            new Date().toISOString()
          : new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    };

    const next = editingArrearId
      ? arrearEntries.map((item) =>
          item.id === editingArrearId
            ? record
            : item
        )
      : [record, ...arrearEntries];

    saveArrearEntries(next);
    closeArrearForm();
  };

  const editArrearEntry = (item) => {
    setEditingArrearId(item.id);
    setArrearType(
      item.type || "Arrear"
    );
    setArrearEmployeeId(
      item.employeeId
    );
    setArrearMonth(
      item.previousMonth || ""
    );
    setArrearAmount(
      String(item.amount || "")
    );
    setArrearReason(
      item.reason || ""
    );
    setAdjustmentReason(
      item.reason || ""
    );
    setAdjustmentMode(
      item.adjustmentMode || "Addition"
    );
    setShowArrearForm(true);
  };

  const deleteArrearEntry = (id) => {
    if (!window.confirm("Delete this arrear / adjustment entry?")) {
      return;
    }

    saveArrearEntries(
      arrearEntries.filter(
        (item) => item.id !== id
      )
    );
  };

  // Small setter wrapper used by the OT edit handler.
  const setOtEmployeeIdSafe = (value) => {
    setOTEmployeeId(value || "");
  };

  const selectedSalaryEmployee = employees.find(
    (employee) => employee.id === salaryEmployeeId
  );

  const salaryGrossNumber = Number(salaryGross || 0);
  const salaryBasicDA = salaryGrossNumber * 0.5;
  const salaryHra = salaryBasicDA * 0.5;
  const salarySpecial = Math.max(0, salaryGrossNumber - salaryBasicDA - salaryHra);

  const openNewSalary = () => {
    setEditingSalaryId(null);
    setSalaryEmployeeId("");
    setSalaryGross("");
    setShowSalaryForm(true);
  };

  const openEditSalary = (employeeId) => {
    const existing = salaryStructures[employeeId];
    const employee = employees.find((item) => item.id === employeeId);

    setEditingSalaryId(employeeId);
    setSalaryEmployeeId(employeeId);
    setSalaryGross(String(existing?.gross ?? employee?.gross ?? ""));
    setSalaryInsurance(
    String(existing?.insurance ?? employee?.insurance ?? 0)
    );
    setShowSalaryForm(true);
  };

  const closeSalaryForm = () => {
    setShowSalaryForm(false);
    setEditingSalaryId(null);
    setSalaryEmployeeId("");
    setSalaryGross("");
  };

  const saveSalaryStructure = () => {
    if (!salaryEmployeeId) {
      window.alert("Please select an employee.");
      return;
    }

    if (salaryGrossNumber <= 0) {
      window.alert("Please enter a valid monthly gross salary.");
      return;
    }

    const next = {
      ...salaryStructures,
      [salaryEmployeeId]: {
        employeeId: salaryEmployeeId,
        gross: salaryGrossNumber,
        basicDA: salaryBasicDA,
        hra: salaryHra,
        specialAllowance: salarySpecial,
        insurance: Number(salaryInsurance || 0),
        updatedAt: new Date().toISOString(),
      },
    };

    setSalaryStructures(next);
    savePayrollModuleState({ salaryStructures: next }).catch((error) => {
      console.error("Unable to save salary structure:", error);
      window.alert("Unable to save salary structure to Payroll database.");
    });
    closeSalaryForm();
  };

  const normalizeBulkNumber = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    const cleaned = String(value).replace(/[₹,\s]/g, "").trim();
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : NaN;
  };

  const buildBulkSalaryStructure = (employee, row) => {
    const gross = normalizeBulkNumber(row["Monthly Gross"]);
    const foodAllowance = normalizeBulkNumber(row["Food Allowance"]);
    const hardshipAllowance = normalizeBulkNumber(row["Hardship Allowance"]);
    const insurance = normalizeBulkNumber(row["Monthly Insurance"]);
    const otherAllowances = [1, 2, 3]
      .map((n) => ({
        name: String(row[`Other Allowance ${n}`] ?? "").trim(),
        amount: normalizeBulkNumber(row[`Other Amount ${n}`]),
      }))
      .filter((item) => item.name || item.amount);

    const basicDA = gross * 0.5;
    const hra = basicDA * 0.5;
    const specialAllowance = Math.max(0, gross - basicDA - hra);
    const otherTotal = otherAllowances.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const addOnTotal = foodAllowance + hardshipAllowance + otherTotal;

    return {
      payrollMonth,
      employeeId: employee.id,
      gross,
      basicDA,
      hra,
      specialAllowance,
      foodAllowance,
      hardshipAllowance,
      insurance,
      otherAllowances,
      addOnTotal,
      totalEarnings: gross + addOnTotal,
      updatedAt: new Date().toISOString(),
    };
  };

  const downloadBulkSalaryTemplate = () => {
    const headers = [
      "Employee ID", "Employee Name", "Employee Type", "Site / Project", "Vendor", "DOJ",
      "Monthly Gross", "Food Allowance", "Hardship Allowance", "Monthly Insurance",
      "Other Allowance 1", "Other Amount 1", "Other Allowance 2", "Other Amount 2",
      "Other Allowance 3", "Other Amount 3",
    ];
    const rows = employees.map((employee) => {
      const structure = salaryStructures[employee.id];
      const others = structure?.otherAllowances || [];
      return [
        employee.id,
        employee.name,
        employee.type,
        employee.site,
        employee.vendor || "",
        employee.doj || employee.dateOfJoining || "",
        structure?.gross ?? employee.gross ?? "",
        structure?.foodAllowance ?? "",
        structure?.hardshipAllowance ?? "",
        others[0]?.name || "",
        others[0]?.amount ?? "",
        others[1]?.name || "", others[1]?.amount ?? "", others[2]?.name || "", others[2]?.amount ?? "",
      ];
    });
    const aoa = [
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS – BULK SALARY STRUCTURE UPLOAD TEMPLATE"],
      ["Purpose", "Update salary structures for multiple employees using Excel (.xlsx)."],
      ["Important", "Do not modify Employee ID, Employee Name, Employee Type, Site / Project, Vendor or DOJ. Enter Monthly Gross and separate/add-on earnings only."],
      ["Formula", "Basic + DA = 50% Gross | HRA = 50% of Basic + DA | Special Allowance = Balance of Gross | Add-ons are separate."],
      [], headers, ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ];
    ws["!freeze"] = { xSplit: 5, ySplit: 6 };
    ws["!autofilter"] = { ref: `A7:N${rows.length + 7}` };
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(15, Math.min(26, h.length + 3)) }));

    const instructions = XLSX.utils.aoa_to_sheet([
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      ["HRMS – BULK SALARY UPLOAD GUIDELINES"],
      ["Step 1", "Do not change Employee ID or employee master details."],
      ["Step 2", "Monthly Gross drives automatic Basic + DA, HRA and Special Allowance."],
      ["Step 3", "Food Allowance and Hardship Allowance are separate add-on earnings."],
      ["Step 4", "Use Other Allowance 1/2/3 for approved additional earnings."],
      ["Validation", "Employee ID must exist in HRMS and Monthly Gross must be greater than zero."],
    ]);
    instructions["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];
    instructions["!cols"] = [{ wch: 18 }, { wch: 105 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Salary Upload");
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
    XLSX.writeFile(workbook, `HRMS_Bulk_Salary_Template_${payrollMonth}.xlsx`);
  };

  const openBulkSalary = () => {
    setBulkSalaryRows([]); setBulkSalaryErrors([]); setBulkSalaryFileName(""); setShowBulkSalary(true);
  };
  const closeBulkSalary = () => {
    setShowBulkSalary(false); setBulkSalaryRows([]); setBulkSalaryErrors([]); setBulkSalaryFileName("");
  };

  const processBulkSalaryFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBulkSalaryFileName(file.name); setBulkSalaryRows([]); setBulkSalaryErrors([]);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", range: 6 });
      const errors = []; const validRows = []; const seenIds = new Set();
      rawRows.forEach((row, index) => {
        const excelRow = index + 8;
        const id = String(row["Employee ID"] ?? "").trim();
        if (!id) { errors.push(`Row ${excelRow}: Employee ID is required.`); return; }
        if (seenIds.has(id)) { errors.push(`Row ${excelRow}: Duplicate Employee ID ${id}.`); return; }
        seenIds.add(id);
        const employee = employees.find((item) => item.id === id);
        if (!employee) { errors.push(`Row ${excelRow}: Employee ID ${id} was not found in HRMS employee master.`); return; }
        const gross = normalizeBulkNumber(row["Monthly Gross"]);
        const amountFields = ["Food Allowance", "Hardship Allowance", "Hardship Allowance", "Other Amount 1", "Other Amount 2", "Other Amount 3"];
        const invalidAmount = amountFields.some((field) => Number.isNaN(normalizeBulkNumber(row[field])));
        if (!Number.isFinite(gross) || gross <= 0) { errors.push(`Row ${excelRow}: Monthly Gross must be greater than zero.`); return; }
        if (invalidAmount) { errors.push(`Row ${excelRow}: One or more allowance amounts are invalid.`); return; }
        const structure = buildBulkSalaryStructure(employee, row);
        validRows.push({ employee, structure, existing: Boolean(salaryStructures[id]) });
      });
      setBulkSalaryErrors(errors); setBulkSalaryRows(validRows);
    } catch (error) {
      setBulkSalaryErrors([`Unable to read the Excel file. Please use the HRMS template (.xlsx).`]);
    }
  };

  const saveBulkSalaryStructures = () => {
    if (!bulkSalaryRows.length || bulkSalaryErrors.length) return;
    const next = { ...salaryStructures };
    bulkSalaryRows.forEach(({ employee, structure }) => { next[employee.id] = structure; });
    setSalaryStructures(next);
    savePayrollModuleState({ salaryStructures: next }).catch((error) => {
      console.error("Unable to save bulk salary structures:", error);
      window.alert("Unable to save salary structures to Payroll database.");
    });
    closeBulkSalary();
  };

  const filteredEmployees = useMemo(() => {
    const q = salaryRegisterSearch.trim().toLowerCase();

    return employees.filter((employee) => {
      const typeMatch =
        employeeType === "All Types" || employee.type === employeeType;
      const siteMatch = site === "All Sites" || employee.site === site;
      const searchMatch =
        !q ||
        String(employee.name || "").toLowerCase().includes(q) ||
        String(employee.id || "").toLowerCase().includes(q) ||
        String(employee.department || "").toLowerCase().includes(q);

      return typeMatch && siteMatch && searchMatch;
    });
  }, [employeeType, site, salaryRegisterSearch, employees]);

  // Dashboard is driven by finalized/calculated payroll rows when available.
  // Before processing, it shows a live preview calculated from Employee Master,
  // Attendance, Salary Structure and Statutory settings. This keeps the dashboard
  // useful without duplicating the stored processed payroll result.
  const dashboardRows =
    Array.isArray(processedPayroll) && processedPayroll.length > 0
      ? processedPayroll
      : employees.map((employee) => {
          const structure = salaryStructures[employee.id] || {};
          const attendance = calculateMonthlyAttendance(
            employee.id,
            payrollMonth
          );

          const gross = Number(structure?.gross ?? employee?.gross ?? 0);
          const [year, month] = String(payrollMonth || "")
            .split("-")
            .map(Number);
          const daysInMonth =
            year && month ? new Date(year, month, 0).getDate() : 0;

          const reviewPaidDays =
  Number(attendance.paidDays || 0);

const payableGross =
  daysInMonth > 0
    ? (gross * reviewPaidDays) / daysInMonth
    : 0;

          const statutory = getStatutoryCalculation({
            employee,
            structure,
            settings: statutorySettings,
            payrollMonth,
          });

          const pf = Number(statutory?.pf?.employee ?? 0);
          const esi = Number(statutory?.esi?.employee ?? 0);
          const pt = Number(statutory?.pt?.amount ?? 0);
          const lopAmount = Math.max(0, gross - payableGross);
          const netPayable = payableGross - pf - esi - pt;

          return {
            employeeId: employee.id,
            employeeName: employee.name || "",
            employeeType: employee.type || "",
            department: employee.department || "",
            site: employee.site || "",
            vendor: employee.vendor || "",
            gross,
            payableGross,
            lopAmount,
            pf,
            esi,
            pt,
            paidDays: Number(attendance.paidDays || 0),
            lopDays: Number(attendance.lop || 0),
            otHours: Number(attendance.otHours || 0),
            otAmount: 0,
            netPayable,
            employerPF: Number(statutory?.pf?.employer ?? 0),
            employerESI: Number(statutory?.esi?.employer ?? 0),
            insurance: Number(structure?.insurance ?? employee?.insurance ?? 0),
            finalCTC:
              payableGross +
              Number(statutory?.pf?.employer ?? 0) +
              Number(statutory?.esi?.employer ?? 0) +
              Number(structure?.insurance ?? employee?.insurance ?? 0),
          };
        });

  const dashboardTotalGross = dashboardRows.reduce(
    (sum, row) => sum + Number(row.gross || 0),
    0
  );
  const dashboardTotalNet = dashboardRows.reduce(
    (sum, row) => sum + Number(row.netPayable || 0),
    0
  );
  const dashboardTotalDeductions = dashboardRows.reduce(
    (sum, row) =>
      sum +
      Number(row.lopAmount || 0) +
      Number(row.pf || 0) +
      Number(row.esi || 0) +
      Number(row.pt || 0),
    0
  );
  const dashboardTotalLop = dashboardRows.reduce(
    (sum, row) => sum + Number(row.lopDays || 0),
    0
  );

  const processedEmployeeIds = new Set(
    (Array.isArray(processedPayroll) ? processedPayroll : [])
      .map((row) => row?.employeeId)
      .filter(Boolean)
  );
  const processedCount = Math.min(
    processedEmployeeIds.size,
    employees.length
  );
  const pendingCount = Math.max(0, employees.length - processedCount);
  const progressPercent =
    employees.length > 0
      ? Math.min(100, (processedCount / employees.length) * 100)
      : 0;

  const dashboardAttendanceRows = employees.map((employee) => ({
    employee,
    attendance: calculateMonthlyAttendance(employee.id, payrollMonth),
  }));
  const employeesWithLOP = dashboardAttendanceRows.filter(
    ({ attendance }) => Number(attendance?.lop || 0) > 0
  ).length;
  const employeesWithAttendance = dashboardAttendanceRows.filter(
    ({ attendance }) => Number(attendance?.paidDays || 0) > 0
  ).length;
  const employeesWithSalary = employees.filter(
    (employee) => Number(salaryStructures[employee.id]?.gross ?? employee.gross ?? 0) > 0
  ).length;
  const salaryReady = employees.length > 0 && employeesWithSalary === employees.length;
  const attendanceReady = employees.length > 0 && employeesWithAttendance > 0;
  const statutoryReady = Boolean(
    statutorySettings?.pf?.enabled ||
      statutorySettings?.esi?.enabled ||
      statutorySettings?.pt?.enabled ||
      statutorySettings?.lwf?.enabled
  );

  const dashboardVendorSource =
    Array.isArray(processedPayroll) && processedPayroll.length > 0
      ? processedPayroll
      : employees;

  const dashboardVendorNames = Array.from(
    new Set(
      dashboardVendorSource
        .map((row) => String(row?.vendor || "").trim())
        .filter(Boolean)
    )
  );

  const dashboardVendors = (dashboardVendorNames.length
    ? dashboardVendorNames
    : vendors.map((vendor) => vendor.name)
  ).map((vendorName) => {
    const count = dashboardVendorSource.filter(
      (row) =>
        String(row?.vendor || "").trim().toLowerCase() ===
        vendorName.toLowerCase()
    ).length;
    const configuredVendor = vendors.find(
      (vendor) =>
        String(vendor.name || "").trim().toLowerCase() ===
        vendorName.toLowerCase()
    );
    const rate = configuredVendor?.serviceCharge || "—";

    return {
      name: vendorName,
      employees: count,
      serviceCharge: rate,
      status: count > 0 ? "Active" : "No Employees",
    };
  });

  const getWorkflowStepState = (step) => {
    const calculated = processedPayroll.length > 0;
    const approved = ["Finalized", "Locked", "Salary Released"].includes(payrollProcessingStatus);
    if (step === 1) return employees.length > 0 ? "done" : "current";
    if (step === 2) return calculated ? "done" : employees.length > 0 ? "current" : "pending";
    if (step === 3) return approved ? "done" : calculated ? "current" : "pending";
    if (step === 4) return payrollControl.locked ? "done" : approved ? "current" : "pending";
    if (step === 5) return salaryReleaseState.released ? "done" : payrollControl.locked ? "current" : "pending";
    return "pending";
  };

  const renderDashboard = () => {
    const workflow = [["01","Inputs","Attendance, salary, OT, deductions & tax",1],["02","Calculation","Calculate employee-wise payroll",2],["03","Validation & Approval","Review exceptions and approve",3],["04","Payroll Lock","Freeze the approved month",4],["05","Salary Release","Release salary and payslips",5]];
    return <>
      <div className="payroll-stat-grid">
        <div className="payroll-stat-card blue"><div className="payroll-stat-icon">₹</div><span>Total Gross</span><strong>{money(dashboardTotalGross)}</strong><small>{getPayrollMonthLabel()}</small></div>
        <div className="payroll-stat-card green"><div className="payroll-stat-icon">✓</div><span>Net Payable</span><strong>{money(dashboardTotalNet)}</strong><small>After all deductions</small></div>
        <div className="payroll-stat-card orange"><div className="payroll-stat-icon">−</div><span>Total Deductions</span><strong>{money(dashboardTotalDeductions)}</strong><small>Statutory + payroll deductions</small></div>
        <div className="payroll-stat-card purple"><div className="payroll-stat-icon">01</div><span>Employees</span><strong>{employees.length}</strong><small>Payroll population</small></div>
        <div className="payroll-stat-card cyan"><div className="payroll-stat-icon">✓</div><span>Processed</span><strong>{processedCount}</strong><small>Calculated employees</small></div>
        <div className="payroll-stat-card red"><div className="payroll-stat-icon">!</div><span>LOP Days</span><strong>{dashboardTotalLop}</strong><small>Requires review</small></div>
      </div>
      <section className="payroll-card payroll-run-overview"><div className="payroll-card-head"><div><small className="payroll-eyebrow">MONTHLY PAYROLL RUN</small><h2>{getPayrollMonthLabel()} Payroll</h2><p>{payrollRun?.id || `PAY-${String(payrollMonth).replace("-", "")}`} · {payrollProcessingStatus}</p></div><button type="button" className="payroll-primary-btn" onClick={createOrOpenPayrollRun} disabled={payrollControl.locked}>{payrollRun ? "Open Payroll Run →" : "Create Payroll Run →"}</button></div>
        <div className="payroll-workflow-line">{workflow.map(([no,title,desc,step])=>{const state=getWorkflowStepState(step);return <button type="button" key={no} className={`payroll-workflow-step ${state}`} onClick={()=>{if(step===1){setActiveSection("inputs");setInputSection("overview");}if(step===2)setActiveSection("calculation");if(step===3)setActiveSection("validation");if(step===4)setActiveSection("payroll-control");if(step===5)setActiveSection("salary-release");}}><span>{no}</span><div><strong>{title}</strong><small>{desc}</small></div></button>})}</div>
      </section>
      <div className="payroll-section-grid">
        <section className="payroll-card"><div className="payroll-card-head"><div><small className="payroll-eyebrow">PRE-CALCULATION CHECK</small><h2>Payroll Readiness</h2></div></div><div className="payroll-readiness-list">{[["Employee Master",employees.length>0,`${employees.length} employee${employees.length===1?"":"s"} loaded`],["Attendance",attendanceReady,attendanceReady?"Attendance available for selected month":"Attendance data required"],["Salary Inputs",salaryReady,salaryReady?"Salary structure available":`${Math.max(0,employees.length-employeesWithSalary)} employee(s) missing salary`],["IT Declaration",itDeclaration.status!=="Closed",itDeclaration.status||"Open"]].map(([label,ok,detail])=><div key={label}><span className={ok?"check-icon success":"check-icon warning"}>{ok?"✓":"!"}</span><div><strong>{label}</strong><small>{detail}</small></div></div>)}</div></section>
        <section className="payroll-card"><div className="payroll-card-head"><div><small className="payroll-eyebrow">MONTH-END STATUS</small><h2>Control Summary</h2></div></div><div className="payroll-control-summary"><div><span>Calculation</span><strong>{payrollProcessingStatus}</strong></div><div><span>Approval</span><strong>{["Finalized","Locked","Salary Released"].includes(payrollProcessingStatus)?"Approved":"Pending"}</strong></div><div><span>Lock</span><strong>{payrollControl.locked?"Locked":"Open"}</strong></div><div><span>Release</span><strong>{salaryReleaseState.released?"Released":"Pending"}</strong></div></div></section>
      </div>
    </>;
  };

  const renderMonthly = () => (
    <section className="payroll-card payroll-full-card">
      <div className="payroll-card-head">
        <div>
          <small className="payroll-eyebrow">MONTHLY PAYROLL</small>
          <h2>Employee Payroll Register</h2>
          <p>Attendance-driven payroll review. Salary calculations will be connected after policies are configured.</p>
        </div>
        <button className="payroll-primary-btn">+ Start Payroll</button>
      </div>

      <div className="payroll-filter-bar">
        <label>Payroll Month<input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} /></label>
        <label>Employee Type<select value={employeeType} onChange={(e) => setEmployeeType(e.target.value)}><option>All Types</option><option>On-Roll</option><option>Third Party</option></select></label>
        <label>Site / Project<select value={site} onChange={(e) => setSite(e.target.value)}><option>All Sites</option><option>Gurgaon HO</option><option>Hibbal Project</option><option>Polavaram COW</option><option>Teesta Project</option></select></label>
        <label className="payroll-search-label">Search<input placeholder="Employee / ID / Department" value={salaryRegisterSearch} onChange={(e) => setSalaryRegisterSearch(e.target.value)} /></label>
      </div>

      <div className="payroll-table-scroll">
        <table className="payroll-register-table">
          <thead>
          <tr>
          <th>Employee</th>
          <th>Type</th>
          <th>Site</th>
          <th>Gross</th>
          <th>PF</th>
          <th>ESI</th>
          <th>PT</th>
          <th>Paid Days</th>
          <th>LOP Days</th>
          <th>OT Hours</th>
          <th>LOP</th>
          <th>Net Payable</th>
          <th>Employer PF</th>
          <th>Employer ESI</th>
          <th>Insurance</th>
          <th>Final CTC</th>
          <th>Status</th>
          </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => {
                const attendance = calculateMonthlyAttendance(
                employee.id,
                payrollMonth
                );
                const reviewPaidDays =
                Number(attendance.paidDays || 0);
                const structure = salaryStructures[employee.id];
                const hourlyRate = getHourlyRate(employee);

                const weekdayOTAmount =
                hourlyRate *
                Number(otMultiplier || 1.5) *
                Number(attendance.weekdayOtHours || 0);

                const sundayOTAmount =
                hourlyRate *
                Number(otMultiplier2 || 2) *
                Number(attendance.sundayOtHours || 0);

                const otAmount =
                weekdayOTAmount + sundayOTAmount;
                const statutory = getStatutoryCalculation({
                employee,
                structure: structure || {},
                settings: statutorySettings,
                payrollMonth,
               });
               const grossSalary = Number(structure?.gross ?? 0);

               const daysInMonth = new Date(
               Number(payrollMonth.split("-")[0]),
               Number(payrollMonth.split("-")[1]),
               0
               ).getDate();

              const payableGross =
              daysInMonth > 0
              ? (grossSalary * reviewPaidDays) / daysInMonth
              : 0;

              const pfAmount = Number(statutory.pf?.employee ?? 0);
              const esiAmount = Number(statutory.esi?.employee ?? 0);
              const ptAmount = Number(statutory.pt?.amount ?? 0);

              const netPayable =
              payableGross -
              pfAmount -
              esiAmount -
              ptAmount;
              const employerPF = Number(statutory.pf?.employer ?? 0);
              const employerESI = Number(statutory.esi?.employer ?? 0);

              // Insurance - currently manual/default 0
              const insurance = Number(
              structure?.insurance ??
              employee?.insurance ??
              0
                );

              const finalCTC =
              payableGross +
              employerPF +
              employerESI +
              insurance;

              const finalNetPayable =
              netPayable + otAmount;

              return (
              <tr key={employee.id}>
                <td><strong>{employee.name}</strong><small>{getEmployeeCode(employee)} · {employee.department}</small></td>
                <td><span className={`type-pill ${employee.type === "Third Party" ? "third" : "roll"}`}>{employee.type}</span></td>
                <td>{employee.site}</td>
                <td>{money(structure?.gross ?? 0)}</td>
                <td>{money(statutory.pf?.employee ?? 0)}</td>
                <td>{money(statutory.esi?.employee ?? 0)}</td>
                <td>{money(statutory.pt?.amount ?? 0)}</td>
                <td>{reviewPaidDays}</td>
                <td>{attendance.lop}</td>
                <td>{attendance.otHours}</td>
                <td className={employee.lop ? "lop-value" : ""}>{employee.lop}</td>
                <td>
                <strong>{money(finalNetPayable)}</strong>
               </td>
               <td>{money(employerPF)}</td>

                <td>{money(employerESI)}</td>

                <td>{money(insurance)}</td>

                <td>
                <strong>{money(finalCTC)}</strong>
                </td>
                <td><span className={`payroll-status ${employee.status.toLowerCase()}`}>{employee.status}</span></td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  const processCurrentPayroll = () => {
  if (payrollControl.locked) {
    window.alert("This payroll month is locked. Unlock it before recalculating.");
    return;
  }
    const masters = loadOrganizationPayrollMasters();
    const organizationStatutoryFallback = statutorySettings;
    const errors = [];

    const rows = employees.map((employee) => {
      const category = resolveWorkforceCategory(employee, masters);
      const profile = resolvePayrollProfile(employee, masters, category);
      const effectiveDate = `${payrollMonth}-01`;
      const salaryRule = resolvePolicy(masters.salaryRules, profile?.salaryRuleIds, category?.id, effectiveDate);
      const prorationRule = resolvePolicy(masters.prorationRules, profile?.prorationRuleIds, category?.id, effectiveDate) ||
        (Array.isArray(masters.prorationRules) ? masters.prorationRules.find((x) => x.active !== false && (!x.workforceCategories?.length || x.workforceCategories.includes(category?.id))) : null);
      const statutoryPolicy = resolvePolicy(masters.statutoryPolicies, profile?.statutoryPolicyIds, category?.id, effectiveDate);
      const deductionPolicy = resolvePolicy(masters.deductionPolicies, profile?.deductionPolicyIds, category?.id, effectiveDate);
      const otPolicy = resolvePolicy(masters.otPolicies, profile?.otPolicyIds, category?.id, effectiveDate);

      const attendance = calculateMonthlyAttendance(employee.id, payrollMonth);
      const existingStructure = salaryStructures[employee.id] || {};
      const structure = getSalaryStructureFromOrganizationRule(employee, existingStructure, salaryRule);
      const grossSalary = Number(structure?.gross ?? employee?.gross ?? 0);
      if (!(grossSalary > 0)) {
        errors.push(`${getEmployeeCode(employee) || employee.name}: Gross salary is missing.`);
      }

      const proration = calculateOrganizationProration({ gross: grossSalary, attendance, employee, payrollMonth, profile, rule: prorationRule });
      const payableGross = Math.max(0, proration.payableGross);

      const policySettings = adaptOrganizationStatutoryPolicy(statutoryPolicy, organizationStatutoryFallback);
      const statutory = getStatutoryCalculation({ employee, structure, settings: policySettings, payrollMonth });
      const pfAmount = Number(statutory?.pf?.employee ?? 0);
      const esiAmount = Number(statutory?.esi?.employee ?? 0);
      const ptAmount = Number(statutory?.pt?.amount ?? 0);
      const lwfEmployee = Number(statutory?.lwf?.employee ?? 0);

      const otApplicable = otPolicy ? otPolicy.otApplicable !== false : true;
      const otBasis = normalizeText(otPolicy?.calculationBasis || "BASIC");
      const otWage = otBasis === "GROSS" ? grossSalary : Number(structure?.basicDA || grossSalary * 0.5);
      const hoursPerDay = Math.max(1, Number(otPolicy?.workingHoursPerDay || otHoursPerDay || 8));
      const dayBasis = Math.max(1, Number(otDayBasis || (profile?.workingDaysBasis === "CALENDAR_DAYS" ? new Date(Number(payrollMonth.slice(0,4)), Number(payrollMonth.slice(5,7)), 0).getDate() : 26)));
      const hourlyRate = otApplicable ? otWage / dayBasis / hoursPerDay : 0;
      const weekdayMultiplier = Number(otPolicy?.weekdayMultiplier ?? otMultiplier ?? 1.5);
      const weeklyOffMultiplier = Number(otPolicy?.weeklyOffMultiplier ?? otMultiplier2 ?? 2);
      const holidayMultiplier = Number(otPolicy?.holidayMultiplier ?? weeklyOffMultiplier);
      const weekdayOT = hourlyRate * weekdayMultiplier * Number(attendance.weekdayOtHours || 0);
      const sundayOT = hourlyRate * weeklyOffMultiplier * Number(attendance.sundayOtHours || 0);
      const otAmount = otApplicable ? weekdayOT + sundayOT : 0;

      const monthlyDeductions = deductions.filter((item) => item.status === "Active" && item.employeeId === employee.id && (!item.month || item.month === payrollMonth));
      let loanDeduction = 0, foodDeduction = 0, recoveryDeduction = 0, otherDeduction = 0;
      monthlyDeductions.forEach((item) => {
        if (item.type === "Loan / Advance") {
          const start = String(item.startMonth || "0000-00");
          if (start <= payrollMonth && Number(item.remainingAmount ?? item.totalAmount ?? 0) > 0) loanDeduction += Math.min(Number(item.emiAmount || 0), Number(item.remainingAmount ?? item.totalAmount ?? 0));
        } else if (item.type === "Food Deduction") foodDeduction += Number(item.totalAmount || 0);
        else if (item.type === "Recovery") recoveryDeduction += Number(item.totalAmount || 0);
        else if (item.type === "Other Deduction") otherDeduction += Number(item.totalAmount || 0);
      });
      const configuredMaxPercent = Number(deductionPolicy?.maximumDeductionPercent ?? 50);
      const maxDeduction = Math.max(0, payableGross * configuredMaxPercent / 100);
      const configuredDeductionTotal = loanDeduction + foodDeduction + recoveryDeduction + otherDeduction;
      const cappedOtherDeductions = Math.min(configuredDeductionTotal, maxDeduction);

      const arrears = arrearEntries.filter((item) => item.employeeId === employee.id && item.payrollMonth === payrollMonth);
      const arrearAddition = arrears.reduce((sum, item) => sum + (item.type === "Adjustment" && item.adjustmentMode === "Reduction" ? 0 : Number(item.amount || 0)), 0);
      const adjustmentReduction = arrears.reduce((sum, item) => sum + (item.type === "Adjustment" && item.adjustmentMode === "Reduction" ? Number(item.amount || 0) : 0), 0);

      const totalEmployeeDeductions = pfAmount + esiAmount + ptAmount + lwfEmployee + cappedOtherDeductions;
      const finalNetPayable = Math.max(0, payableGross + otAmount + arrearAddition - adjustmentReduction - totalEmployeeDeductions);
      const forceLeaveSalaryHoldApplied = Number(attendance.salaryHoldDays || 0) > 0;
      const employerPF = Number(statutory?.pf?.employer ?? 0);
      const employerESI = Number(statutory?.esi?.employer ?? 0);
      const lwfEmployer = Number(statutory?.lwf?.employer ?? 0);
      const insurance = Number(structure?.insurance ?? employee?.insurance ?? 0);
      const finalCTC = payableGross + otAmount + arrearAddition - adjustmentReduction + employerPF + employerESI + lwfEmployer + insurance;

      return {
        payrollMonth, employeeId: employee.id, employeeCode: getEmployeeCode(employee), employeeName: employee.name,
        employeeType: employee.type || "", workforceCategoryId: category?.id || "", workforceCategory: category?.name || employee?.type || "",
        payrollProfileId: profile?.id || "", payrollProfile: profile?.name || "", salaryRuleId: salaryRule?.id || "", prorationRuleId: prorationRule?.id || "",
        statutoryPolicyId: statutoryPolicy?.id || "", deductionPolicyId: deductionPolicy?.id || "", otPolicyId: otPolicy?.id || "", payrollCalendarId: profile?.payrollCalendarId || "",
        department: employee.department || "", designation: employee.designation || "", site: employee.site || "", vendor: employee.vendor || "",
        doj: employee.doj || employee.dateOfJoining || "", gender: employee.gender || "", pan: employee.pan || employee.panNumber || "",
        uan: employee.uan || employee.pfNumber || employee.pfAccountNumber || "", esiNumber: employee.esiNumber || employee.esicNumber || employee.esiNo || "",
        bankName: employee.bankName || "", bankAccount: employee.bankAccount || employee.bankAccountNumber || employee.accountNumber || "", ifsc: employee.ifsc || employee.ifscCode || "", paymentMode: employee.paymentMode || "Bank Transfer",
        gross: grossSalary, payableGross: Math.round(payableGross * 100) / 100, lopAmount: Math.max(0, grossSalary - payableGross),
        basicDA: Number(structure.basicDA || 0), hra: Number(structure.hra || 0), specialAllowance: Number(structure.specialAllowance || 0),
        pf: pfAmount, pfWage: Number(statutory?.pf?.base ?? 0), esi: esiAmount, esiWage: Number(statutory?.esi?.wage ?? 0), esiCovered: Boolean(statutory?.esi?.covered),
        labourCodeWage: Number(statutory?.labourCodeWage ?? 0), pt: ptAmount, lwfEmployee, lwfEmployer,
        paidDays: proration.paidDays, denominatorDays: proration.denominator, prorationRatio: proration.ratio, lopDays: attendance.lop,
        forceLeaveDays: attendance.forceLeaveDays, forceLeavePaidDays: attendance.forceLeavePaidDays,
        salaryHoldDays: attendance.salaryHoldDays,
        salaryHoldAmount: Math.round((grossSalary / Math.max(1, proration.denominator)) * attendance.salaryHoldDays * 100) / 100,
        forceLeaveSalaryHoldApplied, forceLeavePaymentStatus: forceLeaveSalaryHoldApplied ? "Salary Hold" : "Normal Payroll",
        forceLeaveConflictDays: attendance.forceLeaveConflictDays,
        forceLeaveAttendanceWins: attendance.forceLeaveAttendanceWins,
        forceLeaveForceLeaveWins: attendance.forceLeaveForceLeaveWins,
        forceLeaveConflictDates: attendance.forceLeaveConflictDates,
        forceLeaveSalaryTreatment: attendance.forceLeaveSalaryTreatment,
        presentDays: attendance.present, halfDays: attendance.halfDay, paidLeaveDays: attendance.paidLeave, weeklyOffDays: attendance.weeklyOff, holidayDays: attendance.holiday, compOffDays: attendance.compOff,
        otHours: attendance.otHours, weekdayOtHours: attendance.weekdayOtHours, sundayHolidayOtHours: attendance.sundayOtHours, hourlyRate, weekdayOT, sundayOT, holidayMultiplier, otAmount,
        loanDeduction, foodDeduction, recoveryDeduction, otherDeduction, otherDeductionsCapped: Math.max(0, configuredDeductionTotal - cappedOtherDeductions),
        deductionPolicyCap: maxDeduction, totalOtherDeductions: cappedOtherDeductions, arrearAddition, adjustmentReduction,
        totalEmployeeDeductions, netPayable: finalNetPayable, employerPF, employerESI, insurance, finalCTC, status: "Processed",
        processedAt: new Date().toISOString(),
      };
    });

    if (errors.length) {
      window.alert(errors.join("\n"));
      return;
    }

    setProcessedPayroll(rows);
    setPayrollProcessingStatus("Processed");
    setPayrollControl((previous) => ({
      ...previous,
      month: payrollMonth,
      status: "Processed",
      locked: false,
      released: false,
      releasedAt: "",
      releasedBy: "",
    }));
    savePayrollModuleState({
      processedPayroll: rows,
      payrollMonth,
      payrollProcessingStatus: "Processed",
      payrollControl: {
        ...payrollControl,
        month: payrollMonth,
        status: "Processed",
        locked: false,
        released: false,
        releasedAt: "",
        releasedBy: "",
      },
    }).catch((error) => {
      console.error("Unable to save processed payroll:", error);
      window.alert("Payroll calculated but could not be saved to the Payroll database.");
    });
    updatePayrollRunStatus("Calculated").catch(() => {});
  };

const finalizeCurrentPayroll = () => {
  if (!processedPayroll.length) {
    window.alert("Please calculate payroll before finalizing.");
    return;
  }

  if (payrollControl.locked) {
    window.alert("This payroll month is already locked.");
    return;
  }

  setPayrollProcessingStatus("Finalized");
  const nextControl = {
    ...payrollControl,
    month: payrollMonth,
    status: "Finalized",
  };
  setPayrollControl(nextControl);

  savePayrollModuleState({
    processedPayroll,
    payrollMonth,
    payrollProcessingStatus: "Finalized",
    payrollControl: nextControl,
  }).catch((error) => {
    console.error("Unable to save finalized payroll:", error);
    window.alert("Payroll finalized in the current screen, but database save failed.");
  });
  updatePayrollRunStatus("Approved").catch(() => {});
};


  const saveITDeclaration = async () => {
    const next = {
      ...itDeclaration,
      status: "Submitted",
      submittedAt: new Date().toISOString(),
    };
    setITDeclaration(next);
    try {
      await savePayrollModuleState({ itDeclaration: next });
      window.alert("IT declaration status updated successfully.");
    } catch (error) {
      console.error("Unable to save IT declaration:", error);
      window.alert("Unable to save IT declaration.");
    }
  };

  const lockCurrentPayroll = async () => {
    if (!processedPayroll.length || payrollProcessingStatus !== "Finalized") {
      window.alert("Finalize the selected payroll month before locking it.");
      return;
    }

    if (!window.confirm(
      `Lock payroll for ${getPayrollMonthLabel()}? After locking, payroll calculation and release changes will be restricted.`
    )) return;

    const nextControl = {
      ...payrollControl,
      month: payrollMonth,
      status: "Locked",
      locked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: "HR / Payroll",
      released: false,
      releasedAt: "",
      releasedBy: "",
    };

    try {
      await savePayrollModuleState({
        processedPayroll,
        payrollMonth,
        payrollProcessingStatus: "Locked",
        payrollControl: nextControl,
      });
      setPayrollControl(nextControl);
      setPayrollProcessingStatus("Locked");
      setSalaryReleaseState({
        released: false,
        releasedAt: "",
        releasedBy: "",
      });
      await updatePayrollRunStatus("Locked", { lockedAt: nextControl.lockedAt, lockedBy: nextControl.lockedBy });
      window.alert(`Payroll for ${getPayrollMonthLabel()} is locked.`);
    } catch (error) {
      console.error("Unable to lock payroll:", error);
      window.alert("Unable to lock payroll.");
    }
  };

  const unlockCurrentPayroll = async () => {
    if (!payrollControl.locked) {
      window.alert("Selected payroll month is not locked.");
      return;
    }

    if (!window.confirm(
      `Unlock payroll for ${getPayrollMonthLabel()}? This should only be done by authorised Payroll / HR users.`
    )) return;

    const nextControl = {
      ...payrollControl,
      status: "Finalized",
      locked: false,
      lockedAt: "",
      lockedBy: "",
      released: false,
      releasedAt: "",
      releasedBy: "",
    };

    try {
      await savePayrollModuleState({
        payrollMonth,
        payrollProcessingStatus: "Finalized",
        payrollControl: nextControl,
      });
      setPayrollControl(nextControl);
      setPayrollProcessingStatus("Finalized");
      setSalaryReleaseState({
        released: false,
        releasedAt: "",
        releasedBy: "",
      });
      await updatePayrollRunStatus("Approved");
    } catch (error) {
      console.error("Unable to unlock payroll:", error);
      window.alert("Unable to unlock payroll.");
    }
  };

  const releaseSalaryForEmployees = async () => {
    if (!processedPayroll.length || !["Finalized", "Locked"].includes(payrollProcessingStatus)) {
      window.alert("Finalize payroll before releasing salary.");
      return;
    }

    if (!payrollControl.locked) {
      window.alert("Please lock the payroll month before salary release.");
      return;
    }

    if (!window.confirm(
      `Release salary slips for all ${processedPayroll.length} employees for ${getPayrollMonthLabel()}?`
    )) return;

    const releasedAt = new Date().toISOString();
    const nextControl = {
      ...payrollControl,
      month: payrollMonth,
      status: "Salary Released",
      locked: true,
      released: true,
      releasedAt,
      releasedBy: "HR / Payroll",
    };
    const nextProcessedPayroll = processedPayroll.map((row) => ({
      ...row,
      salaryReleaseStatus: "Released",
      salaryReleasedAt: releasedAt,
      salaryReleasedBy: "HR / Payroll",
    }));

    try {
      await savePayrollModuleState({
        payrollMonth,
        processedPayroll: nextProcessedPayroll,
        payrollProcessingStatus: "Salary Released",
        payrollControl: nextControl,
      });
      setProcessedPayroll(nextProcessedPayroll);
      setPayrollControl(nextControl);
      setSalaryReleaseState({
        released: true,
        releasedAt: nextControl.releasedAt,
        releasedBy: nextControl.releasedBy,
      });
      setPayrollProcessingStatus("Salary Released");
      await updatePayrollRunStatus("Salary Released", { releasedAt, releasedBy: "HR / Payroll" });
      window.alert(`Salary released for ${getPayrollMonthLabel()}.`);
    } catch (error) {
      console.error("Unable to release salary:", error);
      window.alert("Unable to release salary.");
    }
  };

const renderProcessing = () => {
  const attendanceReady = employees.length > 0;

  const salaryReady =
    employees.length > 0 &&
    employees.every((employee) => {
      const structure = salaryStructures[employee.id];
      return Number(structure?.gross ?? employee?.gross ?? 0) > 0;
    });

  const statutoryReady =
    statutorySettings?.pf?.enabled ||
    statutorySettings?.esi?.enabled ||
    statutorySettings?.pt?.enabled ||
    statutorySettings?.lwf?.enabled;

  const deductionsReady = true;

  const vendorReady = true;

  const finalPayrollReady =
    attendanceReady &&
    salaryReady &&
    statutoryReady;

  const steps = [
    [
      "01",
      "Attendance",
      "Paid Days, LOP and OT",
      attendanceReady ? "Ready" : "Configure",
    ],
    [
      "02",
      "Salary Structure",
      "Basic, HRA & allowances",
      salaryReady ? "Ready" : "Configure",
    ],
    [
      "03",
      "Statutory",
      "PF, ESI, PT & LWF",
      statutoryReady ? "Ready" : "Configure",
    ],
    [
      "04",
      "Deductions",
      "Loans & other deductions",
      deductionsReady ? "Ready" : "Configure",
    ],
    [
      "05",
      "Vendor Costing",
      "Service charge & GST",
      vendorReady ? "Ready" : "Configure",
    ],
    [
      "06",
      "Final Payroll",
      "Net salary & approval",
      finalPayrollReady ? "Ready" : "Pending",
    ],
  ];

  return (
    <section className="payroll-card payroll-full-card">
      <div className="payroll-card-head">
        <div>
          <small className="payroll-eyebrow">
            PAYROLL PROCESSING
          </small>

          <h2>Processing Checklist</h2>

          <p>
            Payroll is intentionally staged so attendance, policy
            and statutory rules can be verified before calculation.
          </p>
        </div>
         <button
         type="button"
         className="payroll-primary-btn"
         onClick={processCurrentPayroll}
         >
         Calculate Payroll
         </button>
         </div>


      <div className="payroll-process-grid">
        {steps.map(([no, title, desc, state]) => (
          <div
            className="payroll-process-card"
            key={no}
          >
            <span>{no}</span>

            <div>
              <strong>{title}</strong>
              <small>{desc}</small>
            </div>

            <b
              className={
                state === "Ready"
                  ? "ready"
                  : ""
              }
            >
              {state}
            </b>
          </div>
        ))}
      </div>
            {processedPayroll.length > 0 && (
        <div style={{ marginTop: "24px" }}>

          <div className="payroll-card-head">
            <div>
              <small className="payroll-eyebrow">
                CALCULATED PAYROLL
              </small>

              <h2>Employee Payroll Review</h2>

              <p>
                Review calculated salary before final processing.
              </p>
            </div>

            <button
              className="payroll-primary-btn"
              onClick={finalizeCurrentPayroll}
              disabled={payrollProcessingStatus === "Finalized"}
            >
              {payrollProcessingStatus === "Finalized"
                ? "Payroll Finalized"
                : "Finalize Payroll"}
            </button>
          </div>

          <div className="payroll-table-scroll">
            <table className="payroll-register-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Gross</th>
                  <th>PF</th>
                  <th>ESI</th>
                  <th>PT</th>
                  <th>Paid Days</th>
                  <th>LOP</th>
                  <th>OT Hours</th>
                  <th>Net Payable</th>
                  <th>Employer PF</th>
                  <th>Employer ESI</th>
                  <th>Insurance</th>
                  <th>Final CTC</th>
                </tr>
              </thead>

              <tbody>
                {processedPayroll.map((row) => (
                  <tr key={row.employeeId}>

                    <td>
                      <strong>{row.employeeName}</strong>
                      <small>{row.employeeCode}</small>
                    </td>

                    <td>{money(row.gross)}</td>
                    <td>{money(row.pf)}</td>
                    <td>{money(row.esi)}</td>
                    <td>{money(row.pt)}</td>

                    <td>{row.paidDays}</td>
                    <td>{row.lopDays}</td>
                    <td>{row.otHours}</td>

                    <td>
                      <strong>{money(row.netPayable)}</strong>
                    </td>

                    <td>{money(row.employerPF)}</td>
                    <td>{money(row.employerESI)}</td>
                    <td>{money(row.insurance)}</td>

                    <td>
                      <strong>{money(row.finalCTC)}</strong>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </section>
  );
};

  const renderVendor = () => {
    const vendorRows = Array.from(new Set(employees.map((employee) => String(employee.vendor || "").trim()).filter(Boolean))).map((name) => ({
      name,
      employees: employees.filter((employee) => String(employee.vendor || "").trim().toLowerCase() === name.toLowerCase()).length,
      sites: Array.from(new Set(employees.filter((employee) => String(employee.vendor || "").trim().toLowerCase() === name.toLowerCase()).map((employee) => employee.site).filter(Boolean))),
    }));
    return (
      <section className="payroll-card payroll-full-card">
        <div className="payroll-card-head">
          <div><small className="payroll-eyebrow">PAYROLL INPUT · THIRD PARTY</small><h2>Third Party Payroll Inputs</h2><p>Review vendor manpower for the selected month. Vendor costing is calculated during the payroll run; configuration is maintained outside this screen.</p></div>
          <button type="button" className="payroll-secondary-btn" onClick={() => setActiveSection("vendor-billing")}>View Vendor Costing →</button>
        </div>
        <div className="payroll-input-summary"><div><span>Third Party Employees</span><strong>{employees.filter(isThirdPartyEmployee).length}</strong></div><div><span>Vendors</span><strong>{vendorRows.length}</strong></div><div><span>Payroll Month</span><strong>{getPayrollMonthLabel()}</strong></div><div><span>Costing</span><strong>Calculated in Run</strong></div></div>
        <div className="payroll-table-scroll" style={{ marginTop: "18px" }}>
          <table className="payroll-register-table"><thead><tr><th>Vendor</th><th>Employees</th><th>Sites / Projects</th><th>Payroll Input</th></tr></thead><tbody>
            {vendorRows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.employees}</td><td>{row.sites.length ? row.sites.join(", ") : "—"}</td><td><span className="payroll-status processed">Ready for Calculation</span></td></tr>)}
            {!vendorRows.length && <tr><td colSpan="4" style={{ padding: "32px", textAlign: "center" }}>No third-party vendor employees found for the selected payroll population.</td></tr>}
          </tbody></table>
        </div>
        <div className="payroll-policy-reference"><span>Vendor costing</span><strong>Calculation only</strong><small>Service charge, GST and vendor billing are handled in the costing/reporting stage. No vendor rate configuration is exposed in the Payroll workflow.</small></div>
      </section>
    );
  };

  const renderSimpleModule = (title, eyebrow, description, items) => (
    <section className="payroll-card payroll-full-card">
      <div className="payroll-card-head">
        <div>
          <small className="payroll-eyebrow">{eyebrow}</small>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="payroll-module-grid">
        {items.map(([name, detail, icon]) => (
          <div className="payroll-module-card" key={name}>
            <span>{icon}</span>
            <div>
              <strong>{name}</strong>
              <small>{detail}</small>
            </div>
            <button
              type="button"
              onClick={() => {
                if (name === "Salary Register") {
                  setActiveSection("salary-register");
                } else if (name === "Payslip") {
                  setActiveSection("payslip");
                } else if (name === "Bank Payment") {
                  setActiveSection("bank-payment");
                } else if (name === "Vendor Billing") {
                  setActiveSection("vendor-billing");
                } else if (name === "PF / ESI Report") {
                  setActiveSection("pf-esi-report");
                } else if (name === "LOP Report") {
                  setActiveSection("lop-report");
                }
              }}
            >
              Open Report →
            </button>
          </div>
        ))}
      </div>
    </section>
  );


  // =========================================================
  // PAYROLL REPORT ENGINE
  // All report values come from finalized processedPayroll.
  // Reports do not independently recalculate PF / ESI / PT.
  // =========================================================

  const getReportEmployee = (employeeId) =>
    employees.find((employee) => employee.id === employeeId) || {};

  const getReportPayrollRows = () => {
    if (!Array.isArray(processedPayroll)) return [];

    return processedPayroll.map((row) => {
      const employee = getReportEmployee(row.employeeId);

      return {
        ...row,
        employeeId: row.employeeId || employee.id || "",
        employeeCode: row.employeeCode || getEmployeeCode(employee),
        employeeName: row.employeeName || employee.name || "",
        employeeType: row.employeeType || employee.type || "",
        department: row.department || employee.department || "",
        designation: row.designation || employee.designation || "",
        site: row.site || employee.site || "",
        vendor: row.vendor || employee.vendor || "",
        doj: row.doj || employee.doj || employee.dateOfJoining || "",
        gender: row.gender || employee.gender || "",
        pan: row.pan || employee.pan || employee.panNumber || "",
        uan:
          row.uan ||
          employee.uan ||
          employee.pfNumber ||
          employee.pfAccountNumber ||
          "",
        esiNumber:
          row.esiNumber ||
          employee.esiNumber ||
          employee.esicNumber ||
          employee.esiNo ||
          "",
        bankName: row.bankName || employee.bankName || "",
        bankAccount:
          row.bankAccount ||
          employee.bankAccount ||
          employee.bankAccountNumber ||
          employee.accountNumber ||
          "",
        ifsc: row.ifsc || employee.ifsc || employee.ifscCode || "",
        paymentMode:
          row.paymentMode || employee.paymentMode || "Bank Transfer",
      };
    });
  };

  const getDaysInPayrollMonth = () => {
    const [year, month] = String(payrollMonth || "")
      .split("-")
      .map(Number);

    if (!year || !month) return 0;
    return new Date(year, month, 0).getDate();
  };

  const getPayrollMonthLabel = () => {
    if (!payrollMonth) return "—";

    const date = new Date(`${payrollMonth}-01T00:00:00`);
    if (Number.isNaN(date.getTime())) return payrollMonth;

    return date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  };

  const getReportPayableGross = (row) => {
    if (row.payableGross !== undefined && row.payableGross !== null) {
      return Number(row.payableGross || 0);
    }

    const daysInMonth = getDaysInPayrollMonth();
    const gross = Number(row.gross || 0);
    const paidDays = Number(row.paidDays || 0);

    if (!daysInMonth) return 0;

    return (gross * paidDays) / daysInMonth;
  };

  const getReportLOPDeduction = (row) => {
    if (row.lopAmount !== undefined && row.lopAmount !== null) {
      return Number(row.lopAmount || 0);
    }

    return Math.max(
      0,
      Number(row.gross || 0) - getReportPayableGross(row)
    );
  };

  const getVendorRate = (row) => {
    const vendorName = String(row.vendor || "")
      .trim()
      .toLowerCase();
    const siteName = String(row.site || "")
      .trim()
      .toLowerCase();

    if (vendorName === "perfect" && siteName === "gurgaon ho") {
      return 5;
    }

    const vendor = vendors.find(
      (item) =>
        String(item.name || "")
          .trim()
          .toLowerCase() === vendorName
    );

    if (!vendor) return 0;

    const rate = Number(
      String(vendor.serviceCharge || "")
        .replace("%", "")
        .trim()
    );

    return Number.isFinite(rate) ? rate : 0;
  };

  const saveVendorBillingSettings = (next) => {
    const safeRate = Math.max(
      0,
      Math.min(100, Number(next.gstRate || 0))
    );

    const settings = {
      gstRate: String(safeRate),
      gstType: next.gstType || "CGST + SGST",
    };

    setVendorBillingGstRate(settings.gstRate);
    setVendorBillingGstType(settings.gstType);

    savePayrollModuleState({ vendorBilling: settings }).catch((error) => {
      console.error("Unable to save vendor billing settings:", error);
      window.alert("Unable to save vendor billing settings to Payroll database.");
    });
  };

  const exportPayrollReportExcel = ({
    fileName,
    sheetName,
    title,
    headers,
    rows,
    totals,
  }) => {
    if (!rows.length) {
      window.alert(
        "No finalized payroll records are available for this report."
      );
      return;
    }

    const workbook = XLSX.utils.book_new();

    const output = [
      ["BAUER ENGINEERING INDIA PVT. LTD."],
      [title],
      [`Payroll Month: ${getPayrollMonthLabel()}`],
      [`Status: ${payrollProcessingStatus}`],
      [],
      headers,
      ...rows,
    ];

    if (totals) {
      output.push([]);
      output.push(totals);
    }

    const sheet = XLSX.utils.aoa_to_sheet(output);

    sheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: headers.length - 1 },
      },
      {
        s: { r: 1, c: 0 },
        e: { r: 1, c: headers.length - 1 },
      },
    ];

    sheet["!freeze"] = {
      xSplit: 0,
      ySplit: 5,
    };

    const lastColumn = XLSX.utils.encode_col(headers.length - 1);
    sheet["!autofilter"] = {
      ref: `A6:${lastColumn}${rows.length + 6}`,
    };

    sheet["!cols"] = headers.map((header) => ({
      wch: Math.max(
        12,
        Math.min(28, String(header).length + 5)
      ),
    }));

    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      sheetName
    );

    XLSX.writeFile(
      workbook,
      `${fileName}_${payrollMonth}.xlsx`
    );
  };

  // =========================================================
  // PRINT ENGINE
  // Uses a dedicated print document instead of window.print() on
  // the HRMS application shell. This prevents the app shell/header/
  // sidebar from being printed and, importantly, prevents Chrome from
  // showing an empty "frontend" page in Print Preview.
  // =========================================================

  const escapePrintHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const printMoney = (value) => money(Number(value || 0));
   const openPayrollPrint = ({
  title,
  subtitle = "",
  orientation = "portrait",
  content,
}) => {
  if (!content) {
    window.alert("Nothing is available to print.");
    return;
  }

  /*
   * =========================================================
   * SAME-PAGE PRINT ENGINE
   * =========================================================
   *
   * IMPORTANT:
   * - Does NOT use window.open()
   * - Does NOT create a popup
   * - Does NOT require browser popup permission
   * - Uses the current HRMS page + window.print()
   * - Only the generated report is visible in print preview
   * - Automatically cleans itself after printing/canceling
   */

  const PRINT_ROOT_ID = "bauer-hrms-print-root";
  const PRINT_STYLE_ID = "bauer-hrms-print-style";

  // ---------------------------------------------------------
  // 1. Remove any previous print container/style
  // ---------------------------------------------------------

  const existingPrintRoot = document.getElementById(PRINT_ROOT_ID);
  if (existingPrintRoot) {
    existingPrintRoot.remove();
  }

  const existingPrintStyle = document.getElementById(PRINT_STYLE_ID);
  if (existingPrintStyle) {
    existingPrintStyle.remove();
  }

  // ---------------------------------------------------------
  // 2. Create the print container
  // ---------------------------------------------------------

  const printRoot = document.createElement("div");
  printRoot.id = PRINT_ROOT_ID;

  printRoot.innerHTML = `
    <div class="bauer-print-sheet">
      <div class="bauer-print-header">
        <div class="bauer-print-company">
          BAUER ENGINEERING INDIA PVT. LTD.
        </div>

        <div class="bauer-print-title">
          ${escapePrintHtml(title)}
        </div>

        ${
          subtitle
            ? `
              <div class="bauer-print-subtitle">
                ${escapePrintHtml(subtitle)}
              </div>
            `
            : ""
        }
      </div>

      <div class="bauer-print-content">
        ${content}
      </div>
    </div>
  `;

  // ---------------------------------------------------------
  // 3. Create dedicated print CSS
  // ---------------------------------------------------------

  const printStyle = document.createElement("style");
  printStyle.id = PRINT_STYLE_ID;

  printStyle.textContent = `
    /*
     * =====================================================
     * BAUER HRMS PRINT STYLES
     * =====================================================
     */

    #${PRINT_ROOT_ID} {
      display: none;
    }

    @media print {

      /*
       * Hide the complete HRMS application.
       * Only our temporary print root will be visible.
       */
      body > * {
        visibility: hidden !important;
      }

      #${PRINT_ROOT_ID},
      #${PRINT_ROOT_ID} * {
        visibility: visible !important;
      }

      #${PRINT_ROOT_ID} {
        display: block !important;

        position: absolute !important;

        left: 0 !important;
        top: 0 !important;

        width: 100% !important;

        margin: 0 !important;
        padding: 0 !important;

        background: #ffffff !important;
        color: #173b5d !important;

        z-index: 2147483647 !important;
      }

      /*
       * A4 orientation is dynamically controlled by the
       * requested report.
       */
      @page {
        size: A4 ${orientation};
        margin: 12mm;
      }

      /*
       * Basic reset
       */
      #${PRINT_ROOT_ID},
      #${PRINT_ROOT_ID} * {
        box-sizing: border-box;
      }

      #${PRINT_ROOT_ID} {
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;

        line-height: 1.35;

        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /*
       * Main report sheet
       */
      #${PRINT_ROOT_ID} .bauer-print-sheet {
        width: 100%;
        margin: 0;
        padding: 0;
        background: #ffffff;
      }

      /*
       * Report header
       */
      #${PRINT_ROOT_ID} .bauer-print-header {
        border-bottom: 2px solid #173b5d;

        padding-bottom: 9px;

        margin-bottom: 12px;
      }

      #${PRINT_ROOT_ID} .bauer-print-company {
        font-size: 18px;

        font-weight: 800;

        letter-spacing: 0.2px;

        color: #173b5d;
      }

      #${PRINT_ROOT_ID} .bauer-print-title {
        font-size: 14px;

        font-weight: 800;

        margin-top: 3px;

        color: #173b5d;
      }

      #${PRINT_ROOT_ID} .bauer-print-subtitle {
        color: #61798d;

        margin-top: 4px;

        font-size: 9.5px;
      }

      /*
       * Metadata
       */
      #${PRINT_ROOT_ID} .meta {
        display: flex;

        justify-content: space-between;

        gap: 12px;

        margin: 8px 0 12px;

        color: #415d72;

        font-size: 9px;
      }

      /*
       * Tables
       */
      #${PRINT_ROOT_ID} table {
        width: 100%;

        border-collapse: collapse;

        table-layout: auto;

        margin: 0;

        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;
      }

      #${PRINT_ROOT_ID} th {
        background: #eaf2f8 !important;

        color: #173b5d !important;

        font-weight: 800;

        border: 1px solid #b9ccda;

        padding: 6px 5px;

        text-align: left;

        white-space: nowrap;
      }

      #${PRINT_ROOT_ID} td {
        border: 1px solid #d3dfe7;

        padding: 5px;

        vertical-align: top;

        color: #243f53;

        background: #ffffff;
      }

      /*
       * Prevent table rows from splitting between pages.
       */
      #${PRINT_ROOT_ID} tr {
        break-inside: avoid;

        page-break-inside: avoid;
      }

      /*
       * Repeat table headings on every printed page.
       */
      #${PRINT_ROOT_ID} thead {
        display: table-header-group;
      }

      #${PRINT_ROOT_ID} tfoot {
        display: table-footer-group;
      }

      #${PRINT_ROOT_ID} .total-row td {
        font-weight: 800;

        background: #f3f8fc !important;
      }

      /*
       * Alignment helpers
       */
      #${PRINT_ROOT_ID} .right {
        text-align: right;

        white-space: nowrap;
      }

      #${PRINT_ROOT_ID} .center {
        text-align: center;
      }

      #${PRINT_ROOT_ID} .nowrap {
        white-space: nowrap;
      }

      /*
       * Section headings
       */
      #${PRINT_ROOT_ID} .section-title {
        margin: 14px 0 6px;

        font-size: 11px;

        font-weight: 800;

        border-bottom: 1px solid #d3dfe7;

        padding-bottom: 4px;

        color: #173b5d;
      }

      /*
       * Employee detail grid
       */
      #${PRINT_ROOT_ID} .details {
        display: grid;

        grid-template-columns: 1fr 1fr;

        border: 1px solid #d3dfe7;

        margin-bottom: 12px;
      }

      #${PRINT_ROOT_ID} .detail {
        display: flex;

        justify-content: space-between;

        gap: 12px;

        padding: 6px 8px;

        border-bottom: 1px solid #e2e9ee;
      }

      #${PRINT_ROOT_ID} .detail:nth-child(odd) {
        border-right: 1px solid #e2e9ee;
      }

      #${PRINT_ROOT_ID} .label {
        color: #647d90;
      }

      #${PRINT_ROOT_ID} .value {
        font-weight: 700;

        text-align: right;
      }

      /*
       * Summary
       */
      #${PRINT_ROOT_ID} .summary {
        margin-top: 12px;

        display: flex;

        justify-content: flex-end;
      }

      #${PRINT_ROOT_ID} .summary-box {
        width: 320px;

        border: 1px solid #b9ccda;
      }

      #${PRINT_ROOT_ID} .summary-line {
        display: flex;

        justify-content: space-between;

        padding: 6px 8px;

        border-bottom: 1px solid #e2e9ee;
      }

      #${PRINT_ROOT_ID} .summary-line:last-child {
        border-bottom: 0;

        font-weight: 800;

        background: #eaf2f8 !important;
      }

      /*
       * Notes
       */
      #${PRINT_ROOT_ID} .note {
        margin-top: 12px;

        color: #667f91;

        font-size: 8.5px;
      }

      /*
       * Signatures
       */
      #${PRINT_ROOT_ID} .signature {
        margin-top: 28px;

        display: flex;

        justify-content: space-between;

        gap: 30px;
      }

      #${PRINT_ROOT_ID} .signature div {
        width: 220px;

        border-top: 1px solid #8196a6;

        padding-top: 4px;

        text-align: center;

        color: #536c7e;
      }

      /*
       * Explicit page break support
       */
      #${PRINT_ROOT_ID} .page-break {
        page-break-before: always;

        break-before: page;
      }

      /*
       * Anything marked no-print is excluded.
       */
      #${PRINT_ROOT_ID} .no-print {
        display: none !important;
      }

      /*
       * Prevent accidental clipping.
       */
      #${PRINT_ROOT_ID} img,
      #${PRINT_ROOT_ID} svg {
        max-width: 100%;
      }
    }
  `;

  // ---------------------------------------------------------
  // 4. Add print elements to current document
  // ---------------------------------------------------------

  document.head.appendChild(printStyle);
  document.body.appendChild(printRoot);

  // ---------------------------------------------------------
  // 5. Cleanup function
  // ---------------------------------------------------------

  let cleanedUp = false;

  const cleanupPrint = () => {
    if (cleanedUp) return;

    cleanedUp = true;

    window.removeEventListener("afterprint", cleanupPrint);

    const currentPrintRoot =
      document.getElementById(PRINT_ROOT_ID);

    if (currentPrintRoot) {
      currentPrintRoot.remove();
    }

    const currentPrintStyle =
      document.getElementById(PRINT_STYLE_ID);

    if (currentPrintStyle) {
      currentPrintStyle.remove();
    }
  };

  // ---------------------------------------------------------
  // 6. Cleanup after Save to PDF OR Cancel
  // ---------------------------------------------------------

  window.addEventListener("afterprint", cleanupPrint);

  // ---------------------------------------------------------
  // 7. Wait for DOM/layout and open native Print Preview
  // ---------------------------------------------------------

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.focus();
        window.print();
      } catch (error) {
        console.error(
          "Unable to open browser print dialog:",
          error
        );

        cleanupPrint();

        window.alert(
          "Unable to open the print dialog. Please try again."
        );
      }
    });
  });
};
    const buildPrintTable = (headers, rows, totals = null) => {
    const head = headers
      .map((header) => `<th>${escapePrintHtml(header)}</th>`)
      .join("");

    const body = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${escapePrintHtml(cell)}</td>`)
            .join("")}</tr>`
      )
      .join("");

    const totalHtml = totals
      ? `<tr class="total-row">${totals
          .map((cell) => `<td>${escapePrintHtml(cell)}</td>`)
          .join("")}</tr>`
      : "";

    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${
      totalHtml ? `<tfoot>${totalHtml}</tfoot>` : ""
    }</table>`;
  };

  const renderReportGuard = (reportName) => {
    const rows = getReportPayrollRows();
    const ready =
      payrollProcessingStatus === "Finalized" &&
      rows.length > 0;

    if (ready) return null;

    return (
      <section className="payroll-card payroll-full-card">
        <div style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "42px", marginBottom: "12px" }}>⚠</div>
          <h2 style={{ marginBottom: "8px", color: "#173b5d" }}>
            {reportName} is not available
          </h2>
          <p
            style={{
              color: "#71879a",
              maxWidth: "620px",
              margin: "0 auto 20px",
            }}
          >
            Calculate and finalize the selected payroll month before
            generating this report. Reports always use the finalized
            payroll result as their source of truth.
          </p>
          <button
            type="button"
            className="payroll-secondary-btn"
            onClick={() => setActiveSection("processing")}
          >
            ← Go to Payroll Processing
          </button>
        </div>
      </section>
    );
  };

  // =========================================================
  // 1. PAYSLIP
  // =========================================================

  const renderPayslip = () => {
    const guard = renderReportGuard("Payslip");
    if (guard) return guard;

    const rows = getReportPayrollRows();
    const selectedId = rows.some(
      (row) => row.employeeId === reportEmployeeId
    )
      ? reportEmployeeId
      : rows[0]?.employeeId || "";

    const row =
      rows.find((item) => item.employeeId === selectedId) ||
      rows[0];

    if (!row) return renderReportGuard("Payslip");

    const structure = salaryStructures[row.employeeId] || {};
    const daysInMonth = getDaysInPayrollMonth();
    const paidDays = Number(row.paidDays || 0);
    const attendanceFactor =
      daysInMonth > 0 ? paidDays / daysInMonth : 0;

    const basicDA = Number(structure.basicDA || 0) * attendanceFactor;
    const hra = Number(structure.hra || 0) * attendanceFactor;
    const specialAllowance =
      Number(structure.specialAllowance || 0) * attendanceFactor;
    const addOnTotal =
      Number(structure.addOnTotal || 0) * attendanceFactor;

    const payableGross = getReportPayableGross(row);
    const lopDeduction = getReportLOPDeduction(row);

    const totalStatutoryDeductions =
      Number(row.pf || 0) +
      Number(row.esi || 0) +
      Number(row.pt || 0);

    const totalDeductions =
      totalStatutoryDeductions + lopDeduction;

    const totalEarnings =
      payableGross + Number(row.otAmount || 0);

    const printPayslip = () => {
      const earningsRows = [
        ["Basic + DA", printMoney(basicDA)],
        ["HRA", printMoney(hra)],
        ["Special Allowance", printMoney(specialAllowance)],
        ["Other Allowances", printMoney(addOnTotal)],
        ["OT Amount", printMoney(row.otAmount)],
        ["Total Earnings", printMoney(totalEarnings)],
      ];

      const deductionRows = [
        ["Employee PF", printMoney(row.pf)],
        ["Employee ESI", printMoney(row.esi)],
        ["Professional Tax", printMoney(row.pt)],
        ["LOP Deduction", printMoney(lopDeduction)],
        ["Total Deductions", printMoney(totalDeductions)],
      ];

      const content = `
        <div class="meta">
          <span>Payroll Month: <strong>${escapePrintHtml(getPayrollMonthLabel())}</strong></span>
          <span>Status: <strong>${escapePrintHtml(payrollProcessingStatus)}</strong></span>
        </div>

        <div class="details">
          <div class="detail"><span class="label">Employee Code</span><span class="value">${escapePrintHtml(row.employeeCode || "—")}</span></div>
          <div class="detail"><span class="label">Employee Name</span><span class="value">${escapePrintHtml(row.employeeName || "—")}</span></div>
          <div class="detail"><span class="label">Designation</span><span class="value">${escapePrintHtml(row.designation || "—")}</span></div>
          <div class="detail"><span class="label">Department</span><span class="value">${escapePrintHtml(row.department || "—")}</span></div>
          <div class="detail"><span class="label">Site / Project</span><span class="value">${escapePrintHtml(row.site || "—")}</span></div>
          <div class="detail"><span class="label">Employee Type</span><span class="value">${escapePrintHtml(row.employeeType || "—")}</span></div>
          <div class="detail"><span class="label">DOJ</span><span class="value">${escapePrintHtml(row.doj || "—")}</span></div>
          <div class="detail"><span class="label">UAN</span><span class="value">${escapePrintHtml(row.uan || "—")}</span></div>
          <div class="detail"><span class="label">ESI Number</span><span class="value">${escapePrintHtml(row.esiNumber || "—")}</span></div>
          <div class="detail"><span class="label">Total Days</span><span class="value">${escapePrintHtml(daysInMonth)}</span></div>
          <div class="detail"><span class="label">Paid Days</span><span class="value">${escapePrintHtml(paidDays)}</span></div>
          <div class="detail"><span class="label">LOP Days</span><span class="value">${escapePrintHtml(row.lopDays || 0)}</span></div>
        </div>

        <div class="section-title">Earnings</div>
        ${buildPrintTable(["Particular", "Amount"], earningsRows.map(([a,b]) => [a,b]))}

        <div class="section-title">Deductions</div>
        ${buildPrintTable(["Particular", "Amount"], deductionRows.map(([a,b]) => [a,b]))}

        <div class="summary">
          <div class="summary-box">
            <div class="summary-line"><span>Payable Gross</span><strong>${escapePrintHtml(printMoney(payableGross))}</strong></div>
            <div class="summary-line"><span>Net Payable</span><strong>${escapePrintHtml(printMoney(row.netPayable))}</strong></div>
            <div class="summary-line"><span>Employer PF</span><strong>${escapePrintHtml(printMoney(row.employerPF))}</strong></div>
            <div class="summary-line"><span>Employer ESI</span><strong>${escapePrintHtml(printMoney(row.employerESI))}</strong></div>
            <div class="summary-line"><span>Insurance</span><strong>${escapePrintHtml(printMoney(row.insurance))}</strong></div>
            <div class="summary-line"><span>Final CTC</span><strong>${escapePrintHtml(printMoney(row.finalCTC))}</strong></div>
          </div>
        </div>

        <div class="note">This payslip is generated from the finalized payroll result stored in BAUER HRMS for the selected payroll month.</div>
        <div class="signature"><div>Employee Signature</div><div>Authorized Signatory</div></div>
      `;

      openPayrollPrint({
        title: "EMPLOYEE PAYSLIP",
        subtitle: `${row.employeeName || "Employee"} · ${row.employeeCode || row.employeeId || ""} · ${getPayrollMonthLabel()}`,
        orientation: "portrait",
        content,
      });
    };

    const exportPayslip = () => {
      const headers = ["Particular", "Amount"];
      const data = [
        ["Employee Code", row.employeeCode],
        ["Employee Name", row.employeeName],
        ["Designation", row.designation || "—"],
        ["Department", row.department || "—"],
        ["Site / Project", row.site || "—"],
        ["Employee Type", row.employeeType || "—"],
        ["DOJ", row.doj || "—"],
        ["UAN", row.uan || "—"],
        ["ESI Number", row.esiNumber || "—"],
        ["Payroll Month", getPayrollMonthLabel()],
        ["Total Days", daysInMonth],
        ["Paid Days", paidDays],
        ["LOP Days", Number(row.lopDays || 0)],
        ["Basic + DA", basicDA],
        ["HRA", hra],
        ["Special Allowance", specialAllowance],
        ["Other Allowances", addOnTotal],
        ["Payable Gross", payableGross],
        ["OT Hours", Number(row.otHours || 0)],
        ["OT Amount", Number(row.otAmount || 0)],
        ["Employee PF", Number(row.pf || 0)],
        ["Employee ESI", Number(row.esi || 0)],
        ["PT", Number(row.pt || 0)],
        ["LOP Deduction", lopDeduction],
        ["Total Deductions", totalDeductions],
        ["Net Payable", Number(row.netPayable || 0)],
        ["Employer PF", Number(row.employerPF || 0)],
        ["Employer ESI", Number(row.employerESI || 0)],
        ["Insurance", Number(row.insurance || 0)],
        ["Final CTC", Number(row.finalCTC || 0)],
      ];

      exportPayrollReportExcel({
        fileName: `Payslip_${row.employeeCode || row.employeeId}`,
        sheetName: "Payslip",
        title: "EMPLOYEE PAYSLIP",
        headers,
        rows: data,
      });
    };

    return (
      <section className="payroll-card payroll-full-card">
        <div
          className="payroll-card-head"
          style={{
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <small className="payroll-eyebrow">PAYROLL REPORT</small>
            <h2>Employee Payslip</h2>
            <p>
              Individual salary statement for {getPayrollMonthLabel()}.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="payroll-secondary-btn"
              onClick={() => setActiveSection("reports")}
            >
              ← Reports
            </button>
            <button
              type="button"
              className="payroll-secondary-btn"
              onClick={printPayslip}
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              className="payroll-primary-btn"
              onClick={exportPayslip}
            >
              ↓ Export Excel
            </button>
          </div>
        </div>

        <div
          style={{
            marginBottom: "18px",
            padding: "16px",
            background: "#f7fbfe",
            border: "1px solid #dce8f1",
            borderRadius: "12px",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 700,
              color: "#173b5d",
              marginBottom: "7px",
            }}
          >
            Select Employee
          </label>
          <select
            value={selectedId}
            onChange={(e) => setReportEmployeeId(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "520px",
              minHeight: "42px",
              border: "1px solid #cbdce8",
              borderRadius: "8px",
              padding: "0 12px",
              background: "#fff",
            }}
          >
            {rows.map((item) => (
              <option key={item.employeeId} value={item.employeeId}>
                {item.employeeCode} — {item.employeeName}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            border: "1px solid #d8e5ee",
            borderRadius: "14px",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div
            style={{
              padding: "24px",
              background: "#f7fbfe",
              borderBottom: "1px solid #d8e5ee",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#173b5d",
                  }}
                >
                  BAUER ENGINEERING INDIA PVT. LTD.
                </div>
                <div
                  style={{
                    marginTop: "5px",
                    color: "#71879a",
                    fontSize: "12px",
                  }}
                >
                  Salary Slip — {getPayrollMonthLabel()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: "17px",
                    color: "#173b5d",
                  }}
                >
                  {row.employeeName}
                </strong>
                <span style={{ fontSize: "11px", color: "#71879a" }}>
                  {row.employeeCode}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "1px",
              background: "#dce8f1",
            }}
          >
            {[
              ["Department", row.department || "—"],
              ["Designation", row.designation || "—"],
              ["Site / Project", row.site || "—"],
              ["Employee Type", row.employeeType || "—"],
              ["DOJ", row.doj || "—"],
              ["UAN", row.uan || "—"],
              ["ESI No.", row.esiNumber || "—"],
              ["PAN", row.pan || "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "#fff", padding: "14px" }}>
                <small
                  style={{
                    display: "block",
                    color: "#8295a5",
                    fontSize: "10px",
                    fontWeight: 700,
                    marginBottom: "5px",
                  }}
                >
                  {label}
                </small>
                <strong style={{ color: "#173b5d", fontSize: "12px" }}>
                  {value}
                </strong>
              </div>
            ))}
          </div>

          <div style={{ padding: "20px" }}>
            <div className="payroll-table-scroll">
              <table className="payroll-register-table">
                <thead>
                  <tr>
                    <th>Attendance</th>
                    <th>Value</th>
                    <th>Earnings</th>
                    <th>Amount</th>
                    <th>Deductions</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Days</td>
                    <td>{daysInMonth}</td>
                    <td>Basic + DA</td>
                    <td>{money(basicDA)}</td>
                    <td>PF</td>
                    <td>{money(row.pf)}</td>
                  </tr>
                  <tr>
                    <td>Paid Days</td>
                    <td>{paidDays}</td>
                    <td>HRA</td>
                    <td>{money(hra)}</td>
                    <td>ESI</td>
                    <td>{money(row.esi)}</td>
                  </tr>
                  <tr>
                    <td>LOP Days</td>
                    <td>{Number(row.lopDays || 0)}</td>
                    <td>Special Allowance</td>
                    <td>{money(specialAllowance)}</td>
                    <td>PT</td>
                    <td>{money(row.pt)}</td>
                  </tr>
                  <tr>
                    <td>OT Hours</td>
                    <td>{Number(row.otHours || 0).toFixed(2)}</td>
                    <td>Other Allowances</td>
                    <td>{money(addOnTotal)}</td>
                    <td>LOP Deduction</td>
                    <td>{money(lopDeduction)}</td>
                  </tr>
                  <tr>
                    <td colSpan="2"></td>
                    <td><strong>Payable Gross</strong></td>
                    <td><strong>{money(payableGross)}</strong></td>
                    <td><strong>Total Deductions</strong></td>
                    <td><strong>{money(totalDeductions)}</strong></td>
                  </tr>
                  <tr>
                    <td colSpan="2"></td>
                    <td><strong>OT Amount</strong></td>
                    <td><strong>{money(row.otAmount)}</strong></td>
                    <td><strong>NET PAYABLE</strong></td>
                    <td><strong>{money(row.netPayable)}</strong></td>
                  </tr>
                  <tr>
                    <td colSpan="3"><strong>Total Earnings</strong></td>
                    <td><strong>{money(totalEarnings)}</strong></td>
                    <td><strong>Gross Salary</strong></td>
                    <td><strong>{money(row.gross)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              <div className="payroll-stat-card blue">
                <span>Employer PF</span>
                <strong>{money(row.employerPF)}</strong>
              </div>
              <div className="payroll-stat-card green">
                <span>Employer ESI</span>
                <strong>{money(row.employerESI)}</strong>
              </div>
              <div className="payroll-stat-card orange">
                <span>Final CTC</span>
                <strong>{money(row.finalCTC)}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  // =========================================================
  // 2. BANK PAYMENT
  // =========================================================

  const renderBankPayment = () => {
    const guard = renderReportGuard("Bank Payment");
    if (guard) return guard;

    const rows = getReportPayrollRows().filter(
      (row) => Number(row.netPayable || 0) !== 0
    );

    const totalNet = rows.reduce(
      (sum, row) => sum + Number(row.netPayable || 0),
      0
    );

    const exportBankPayment = () => {
      const headers = [
        "Employee Code",
        "Employee Name",
        "Employee Type",
        "Department",
        "Site / Project",
        "Bank Name",
        "Account Number",
        "IFSC",
        "Payment Mode",
        "Net Payable",
      ];

      const data = rows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.employeeType,
        row.department,
        row.site,
        row.bankName || "Not Available",
        row.bankAccount || "Not Available",
        row.ifsc || "Not Available",
        row.paymentMode,
        Number(row.netPayable || 0),
      ]);

      exportPayrollReportExcel({
        fileName: "Bank_Payment",
        sheetName: "Bank Payment",
        title: "SALARY BANK PAYMENT STATEMENT",
        headers,
        rows: data,
        totals: ["TOTAL", "", "", "", "", "", "", "", "", totalNet],
      });
    };

    return (
      <section className="payroll-card payroll-full-card">
        <div className="payroll-card-head">
          <div>
            <small className="payroll-eyebrow">PAYROLL REPORT</small>
            <h2>Bank Payment</h2>
            <p>
              Employee-wise salary transfer statement generated from finalized payroll.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="payroll-secondary-btn" onClick={() => setActiveSection("reports")}>
              ← Reports
            </button>
            <button type="button" className="payroll-secondary-btn"onClick={() => alert("NEW PRINT BUTTON IS WORKING")} >
              Print
            </button>
            <button type="button" className="payroll-primary-btn" onClick={exportBankPayment}>
              ↓ Export Excel
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div className="payroll-stat-card blue">
            <span>Employees</span>
            <strong>{rows.length}</strong>
          </div>
          <div className="payroll-stat-card green">
            <span>Total Net Payable</span>
            <strong>{money(totalNet)}</strong>
          </div>
          <div className="payroll-stat-card cyan">
            <span>Payroll Month</span>
            <strong>{getPayrollMonthLabel()}</strong>
          </div>
        </div>

        <div className="payroll-table-scroll">
          <table className="payroll-register-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Department</th>
                <th>Site</th>
                <th>Bank</th>
                <th>Account No.</th>
                <th>IFSC</th>
                <th>Payment Mode</th>
                <th>Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId}>
                  <td>
                    <strong>{row.employeeName}</strong>
                    <small style={{ display: "block", marginTop: "3px" }}>
                      {row.employeeCode}
                    </small>
                  </td>
                  <td>{row.employeeType}</td>
                  <td>{row.department || "—"}</td>
                  <td>{row.site || "—"}</td>
                  <td>{row.bankName || "Not Available"}</td>
                  <td>{row.bankAccount || "Not Available"}</td>
                  <td>{row.ifsc || "Not Available"}</td>
                  <td>{row.paymentMode}</td>
                  <td><strong>{money(row.netPayable)}</strong></td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800, background: "#f3f8fc" }}>
                <td colSpan="8">TOTAL BANK PAYMENT</td>
                <td>{money(totalNet)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  // =========================================================
  // 3. VENDOR BILLING
  // =========================================================

  const renderVendorBilling = () => {
    const guard = renderReportGuard("Vendor Billing");
    if (guard) return guard;

    const allThirdPartyRows = getReportPayrollRows().filter((row) => {
      const employeeType = String(row.employeeType || "").toLowerCase();
      const vendorName = String(row.vendor || "").trim();
      return employeeType.includes("third") || Boolean(vendorName);
    });

    const vendorOptions = Array.from(
      new Set([
        "All Vendors",
        ...vendors.map((item) => item.name),
        ...allThirdPartyRows
          .map((row) => String(row.vendor || "").trim())
          .filter(Boolean),
      ])
    );

    const rows =
      vendorBillingVendor === "All Vendors"
        ? allThirdPartyRows
        : allThirdPartyRows.filter(
            (row) =>
              String(row.vendor || "").trim().toLowerCase() ===
              vendorBillingVendor.trim().toLowerCase()
          );

    const gstRate = Math.max(
      0,
      Math.min(100, Number(vendorBillingGstRate || 0))
    );

    const billingRows = rows.map((row) => {
      // Final CTC is the finalized monthly manpower cost available in payroll.
      // Service charge is then applied according to the configured vendor/site rule.
      const manpowerCost = Number(row.finalCTC || 0);
      const serviceRate = getVendorRate(row);
      const serviceCharge =
        (manpowerCost * serviceRate) / 100;

      // GST taxable value follows the transaction-value model used for a normal
      // taxable service invoice. Contractual pure-agent/reimbursement exclusions
      // are not assumed here and must be handled by the actual vendor invoice.
      const taxableValue = manpowerCost + serviceCharge;
      const gstAmount = (taxableValue * gstRate) / 100;
      const invoiceTotal = taxableValue + gstAmount;

      const cgst =
        vendorBillingGstType === "CGST + SGST"
          ? gstAmount / 2
          : 0;
      const sgst =
        vendorBillingGstType === "CGST + SGST"
          ? gstAmount / 2
          : 0;
      const igst =
        vendorBillingGstType === "IGST"
          ? gstAmount
          : 0;

      return {
        ...row,
        manpowerCost,
        serviceRate,
        serviceCharge,
        taxableValue,
        gstRate,
        gstAmount,
        cgst,
        sgst,
        igst,
        invoiceTotal,
      };
    });

    const totalManpower = billingRows.reduce(
      (sum, row) => sum + row.manpowerCost,
      0
    );
    const totalServiceCharge = billingRows.reduce(
      (sum, row) => sum + row.serviceCharge,
      0
    );
    const totalTaxable = billingRows.reduce(
      (sum, row) => sum + row.taxableValue,
      0
    );
    const totalGST = billingRows.reduce(
      (sum, row) => sum + row.gstAmount,
      0
    );
    const totalCGST = billingRows.reduce(
      (sum, row) => sum + row.cgst,
      0
    );
    const totalSGST = billingRows.reduce(
      (sum, row) => sum + row.sgst,
      0
    );
    const totalIGST = billingRows.reduce(
      (sum, row) => sum + row.igst,
      0
    );
    const totalInvoice = billingRows.reduce(
      (sum, row) => sum + row.invoiceTotal,
      0
    );

    const printVendorBilling = () => {
      if (!billingRows.length) {
        window.alert("No third-party employees are available for the selected vendor.");
        return;
      }

      const printRows = billingRows.map((row) => [
        row.vendor || "Unassigned",
        row.employeeCode || "—",
        row.employeeName || "—",
        row.site || "—",
        printMoney(row.manpowerCost),
        `${Number(row.serviceRate || 0).toFixed(2)}%`,
        printMoney(row.serviceCharge),
        printMoney(row.taxableValue),
        `${Number(row.gstRate || 0).toFixed(2)}%`,
        printMoney(row.cgst),
        printMoney(row.sgst),
        printMoney(row.igst),
        printMoney(row.gstAmount),
        printMoney(row.invoiceTotal),
      ]);

      const totals = [
        "TOTAL",
        "",
        "",
        "",
        printMoney(totalManpower),
        "",
        printMoney(totalServiceCharge),
        printMoney(totalTaxable),
        "",
        printMoney(totalCGST),
        printMoney(totalSGST),
        printMoney(totalIGST),
        printMoney(totalGST),
        printMoney(totalInvoice),
      ];

      const content = `
        <div class="meta">
          <span>Payroll Month: <strong>${escapePrintHtml(getPayrollMonthLabel())}</strong></span>
          <span>Vendor: <strong>${escapePrintHtml(vendorBillingVendor)}</strong></span>
          <span>GST: <strong>${escapePrintHtml(vendorBillingGstRate)}% ${escapePrintHtml(vendorBillingGstType)}</strong></span>
        </div>
        ${buildPrintTable(
          ["Vendor", "Employee Code", "Employee", "Site / Project", "Manpower Cost", "Service %", "Service Charge", "Taxable Value", "GST %", "CGST", "SGST", "IGST", "GST Total", "Invoice Total"],
          printRows,
          totals
        )}
        <div class="note">GST is calculated on manpower cost plus service charge under the selected GST treatment. Verify the actual vendor contract, place of supply and invoice-specific treatment before booking.</div>
      `;

      openPayrollPrint({
        title: "THIRD-PARTY VENDOR BILLING",
        subtitle: `${vendorBillingVendor} · ${getPayrollMonthLabel()}`,
        orientation: "landscape",
        content,
      });
    };

    const exportVendorBilling = () => {
      if (!billingRows.length) {
        window.alert("No third-party employees are available for vendor billing.");
        return;
      }

      const headers = [
        "Vendor",
        "Employee Code",
        "Employee Name",
        "Site / Project",
        "Manpower Cost",
        "Service Charge %",
        "Service Charge",
        "Taxable Value",
        "GST %",
        "CGST",
        "SGST",
        "IGST",
        "GST Total",
        "Invoice Total",
      ];

      const data = billingRows.map((row) => [
        row.vendor || "Unassigned",
        row.employeeCode,
        row.employeeName,
        row.site || "—",
        row.manpowerCost,
        row.serviceRate,
        row.serviceCharge,
        row.taxableValue,
        row.gstRate,
        row.cgst,
        row.sgst,
        row.igst,
        row.gstAmount,
        row.invoiceTotal,
      ]);

      exportPayrollReportExcel({
        fileName: "Vendor_Billing",
        sheetName: "Vendor Billing",
        title: "THIRD-PARTY VENDOR BILLING",
        headers,
        rows: data,
        totals: [
          "TOTAL",
          "",
          "",
          "",
          totalManpower,
          "",
          totalServiceCharge,
          totalTaxable,
          "",
          totalCGST,
          totalSGST,
          totalIGST,
          totalGST,
          totalInvoice,
        ],
      });
    };

    return (
      <section className="payroll-card payroll-full-card">
        <div className="payroll-card-head">
          <div>
            <small className="payroll-eyebrow">THIRD PARTY PAYROLL</small>
            <h2>Vendor Billing</h2>
            <p>
              Vendor-wise manpower cost, service charge, taxable value, GST and invoice total.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="payroll-secondary-btn" onClick={() => setActiveSection("reports")}>
              ← Reports
            </button>
            <button type="button" className="payroll-secondary-btn" onClick={printVendorBilling}>
              Print
            </button>
            <button type="button" className="payroll-primary-btn" onClick={exportVendorBilling}>
              ↓ Export Excel
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div className="payroll-stat-card blue">
            <span>Third Party Employees</span>
            <strong>{billingRows.length}</strong>
          </div>
          <div className="payroll-stat-card cyan">
            <span>Manpower Cost</span>
            <strong>{money(totalManpower)}</strong>
          </div>
          <div className="payroll-stat-card green">
            <span>Invoice Total</span>
            <strong>{money(totalInvoice)}</strong>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "18px",
            padding: "14px",
            background: "#f7fbfe",
            border: "1px solid #dce8f1",
            borderRadius: "12px",
          }}
        >
          <label>
            <span style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "#173b5d" }}>
              Vendor
            </span>
            <select
              value={vendorBillingVendor}
              onChange={(e) => setVendorBillingVendor(e.target.value)}
              style={{ width: "100%", minHeight: "38px", border: "1px solid #cbdce8", borderRadius: "7px", padding: "0 10px", background: "#fff" }}
            >
              {vendorOptions.map((vendorName) => (
                <option key={vendorName} value={vendorName}>
                  {vendorName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "#173b5d" }}>
              GST Rate %
            </span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={vendorBillingGstRate}
              onChange={(e) =>
                saveVendorBillingSettings({
                  gstRate: e.target.value,
                  gstType: vendorBillingGstType,
                })
              }
              style={{ width: "100%", minHeight: "38px", border: "1px solid #cbdce8", borderRadius: "7px", padding: "0 10px" }}
            />
          </label>
          <label>
            <span style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "#173b5d" }}>
              GST Type
            </span>
            <select
              value={vendorBillingGstType}
              onChange={(e) =>
                saveVendorBillingSettings({
                  gstRate: vendorBillingGstRate,
                  gstType: e.target.value,
                })
              }
              style={{ width: "100%", minHeight: "38px", border: "1px solid #cbdce8", borderRadius: "7px", padding: "0 10px", background: "#fff" }}
            >
              <option>CGST + SGST</option>
              <option>IGST</option>
            </select>
          </label>
          <div style={{ alignSelf: "end", fontSize: "11px", color: "#71879a", lineHeight: 1.45 }}>
            GST is calculated on the invoice taxable value (manpower cost + service charge). Verify GST rate, place of supply and any contract-specific exclusions against the vendor's actual invoice before booking.
          </div>
        </div>

        <div className="payroll-table-scroll">
          <table className="payroll-register-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Employee</th>
                <th>Site / Project</th>
                <th>Manpower Cost</th>
                <th>Service %</th>
                <th>Service Charge</th>
                <th>Taxable Value</th>
                <th>GST</th>
                <th>Invoice Total</th>
              </tr>
            </thead>
            <tbody>
              {billingRows.length ? (
                <>
                  {billingRows.map((row) => (
                    <tr key={row.employeeId}>
                      <td><strong>{row.vendor || "Unassigned"}</strong></td>
                      <td>
                        <strong>{row.employeeName}</strong>
                        <small style={{ display: "block", marginTop: "3px" }}>{row.employeeCode}</small>
                      </td>
                      <td>{row.site || "—"}</td>
                      <td>{money(row.manpowerCost)}</td>
                      <td>{row.serviceRate.toFixed(2)}%</td>
                      <td>{money(row.serviceCharge)}</td>
                      <td>{money(row.taxableValue)}</td>
                      <td>
                        {money(row.gstAmount)}
                        <small style={{ display: "block", marginTop: "3px" }}>
                          {row.gstRate.toFixed(2)}% {vendorBillingGstType === "IGST" ? "IGST" : "CGST+SGST"}
                        </small>
                      </td>
                      <td><strong>{money(row.invoiceTotal)}</strong></td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 800, background: "#f3f8fc" }}>
                    <td colSpan="3">TOTAL</td>
                    <td>{money(totalManpower)}</td>
                    <td>—</td>
                    <td>{money(totalServiceCharge)}</td>
                    <td>{money(totalTaxable)}</td>
                    <td>{money(totalGST)}</td>
                    <td>{money(totalInvoice)}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "36px" }}>
                    No third-party employees found in finalized payroll.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            border: "1px solid #dce8f1",
            borderRadius: "10px",
            background: "#f7fbfe",
            color: "#71879a",
            fontSize: "11px",
          }}
        >
          <strong style={{ color: "#173b5d" }}>Tax split:</strong>{" "}
          {vendorBillingGstType === "IGST"
            ? `IGST ${money(totalIGST)}`
            : `CGST ${money(totalCGST)} + SGST ${money(totalSGST)}`}
          . Vendor/site-specific GST treatment should be verified from the actual contract and invoice.
        </div>
      </section>
    );
  };

  // =========================================================
  // 4. PF / ESI REPORT
  // =========================================================

  const renderPFESIReport = () => {
    const guard = renderReportGuard("PF / ESI Report");
    if (guard) return guard;

    const rows = getReportPayrollRows();

    const totalPFWage = rows.reduce(
      (sum, row) => sum + Number(row.pfWage || 0),
      0
    );
    const totalEmployeePF = rows.reduce(
      (sum, row) => sum + Number(row.pf || 0),
      0
    );
    const totalEmployerPF = rows.reduce(
      (sum, row) => sum + Number(row.employerPF || 0),
      0
    );
    const totalESIWage = rows.reduce(
      (sum, row) => sum + Number(row.esiWage || 0),
      0
    );
    const totalEmployeeESI = rows.reduce(
      (sum, row) => sum + Number(row.esi || 0),
      0
    );
    const totalEmployerESI = rows.reduce(
      (sum, row) => sum + Number(row.employerESI || 0),
      0
    );

    const exportPFESI = () => {
      const headers = [
        "Employee Code",
        "Employee Name",
        "UAN",
        "ESI Number",
        "Gross",
        "PF Wage / Base",
        "Employee PF",
        "Employer PF",
        "ESI Wage",
        "ESI Covered",
        "Employee ESI",
        "Employer ESI",
        "Total PF",
        "Total ESI",
      ];

      const data = rows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.uan || "Not Available",
        row.esiNumber || "Not Available",
        Number(row.gross || 0),
        Number(row.pfWage || 0),
        Number(row.pf || 0),
        Number(row.employerPF || 0),
        Number(row.esiWage || 0),
        row.esiCovered ? "Yes" : "No",
        Number(row.esi || 0),
        Number(row.employerESI || 0),
        Number(row.pf || 0) + Number(row.employerPF || 0),
        Number(row.esi || 0) + Number(row.employerESI || 0),
      ]);

      exportPayrollReportExcel({
        fileName: "PF_ESI_Report",
        sheetName: "PF ESI Report",
        title: "PF / ESI CONTRIBUTION REPORT",
        headers,
        rows: data,
        totals: [
          "TOTAL",
          "",
          "",
          "",
          "",
          totalPFWage,
          totalEmployeePF,
          totalEmployerPF,
          totalESIWage,
          "",
          totalEmployeeESI,
          totalEmployerESI,
          totalEmployeePF + totalEmployerPF,
          totalEmployeeESI + totalEmployerESI,
        ],
      });
    };

    return (
      <section className="payroll-card payroll-full-card">
        <div className="payroll-card-head">
          <div>
            <small className="payroll-eyebrow">STATUTORY REPORT</small>
            <h2>PF / ESI Report</h2>
            <p>
              Employee and employer contribution report from finalized payroll and statutory engine results.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="payroll-secondary-btn" onClick={() => setActiveSection("reports")}>
              ← Reports
            </button>
            <button type="button" className="payroll-secondary-btn" onClick={() => alert("NEW PRINT BUTTON IS WORKING")}>
              Print
            </button>
            <button type="button" className="payroll-primary-btn" onClick={exportPFESI}>
              ↓ Export Excel
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div className="payroll-stat-card blue">
            <span>Employee PF</span>
            <strong>{money(totalEmployeePF)}</strong>
          </div>
          <div className="payroll-stat-card cyan">
            <span>Employer PF</span>
            <strong>{money(totalEmployerPF)}</strong>
          </div>
          <div className="payroll-stat-card orange">
            <span>Employee ESI</span>
            <strong>{money(totalEmployeeESI)}</strong>
          </div>
          <div className="payroll-stat-card green">
            <span>Employer ESI</span>
            <strong>{money(totalEmployerESI)}</strong>
          </div>
        </div>

        <div className="payroll-table-scroll">
          <table className="payroll-register-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>UAN</th>
                <th>ESI No.</th>
                <th>Gross</th>
                <th>PF Wage / Base</th>
                <th>Employee PF</th>
                <th>Employer PF</th>
                <th>ESI Wage</th>
                <th>ESI Covered</th>
                <th>Employee ESI</th>
                <th>Employer ESI</th>
                <th>Total PF</th>
                <th>Total ESI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const totalPF =
                  Number(row.pf || 0) + Number(row.employerPF || 0);
                const totalESI =
                  Number(row.esi || 0) + Number(row.employerESI || 0);

                return (
                  <tr key={row.employeeId}>
                    <td>
                      <strong>{row.employeeName}</strong>
                      <small style={{ display: "block", marginTop: "3px" }}>
                        {row.employeeCode}
                      </small>
                    </td>
                    <td>{row.uan || "Not Available"}</td>
                    <td>{row.esiNumber || "Not Available"}</td>
                    <td>{money(row.gross)}</td>
                    <td>{money(row.pfWage)}</td>
                    <td>{money(row.pf)}</td>
                    <td>{money(row.employerPF)}</td>
                    <td>{money(row.esiWage)}</td>
                    <td>{row.esiCovered ? "Yes" : "No"}</td>
                    <td>{money(row.esi)}</td>
                    <td>{money(row.employerESI)}</td>
                    <td><strong>{money(totalPF)}</strong></td>
                    <td><strong>{money(totalESI)}</strong></td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 800, background: "#f3f8fc" }}>
                <td colSpan="4">TOTAL</td>
                <td>{money(totalPFWage)}</td>
                <td>{money(totalEmployeePF)}</td>
                <td>{money(totalEmployerPF)}</td>
                <td>{money(totalESIWage)}</td>
                <td>—</td>
                <td>{money(totalEmployeeESI)}</td>
                <td>{money(totalEmployerESI)}</td>
                <td>{money(totalEmployeePF + totalEmployerPF)}</td>
                <td>{money(totalEmployeeESI + totalEmployerESI)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  // =========================================================
  // 5. LOP REPORT
  // =========================================================

  const renderLOPReport = () => {
    const guard = renderReportGuard("LOP Report");
    if (guard) return guard;

    const rows = getReportPayrollRows();
    const lopRows = rows.filter(
      (row) => Number(row.lopDays || 0) > 0
    );

    const totalLOPDays = lopRows.reduce(
      (sum, row) => sum + Number(row.lopDays || 0),
      0
    );
    const totalLOPDeduction = lopRows.reduce(
      (sum, row) => sum + getReportLOPDeduction(row),
      0
    );

    const exportLOP = () => {
      if (!lopRows.length) {
        window.alert("No LOP employees found for the selected payroll month.");
        return;
      }

      const headers = [
        "Employee Code",
        "Employee Name",
        "Department",
        "Site / Project",
        "Gross",
        "Total Days",
        "Paid Days",
        "LOP Days",
        "LOP Deduction",
        "Net Payable",
      ];

      const data = lopRows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.department,
        row.site,
        Number(row.gross || 0),
        getDaysInPayrollMonth(),
        Number(row.paidDays || 0),
        Number(row.lopDays || 0),
        getReportLOPDeduction(row),
        Number(row.netPayable || 0),
      ]);

      exportPayrollReportExcel({
        fileName: "LOP_Report",
        sheetName: "LOP Report",
        title: "LOSS OF PAY REPORT",
        headers,
        rows: data,
        totals: [
          "TOTAL",
          "",
          "",
          "",
          "",
          "",
          "",
          totalLOPDays,
          totalLOPDeduction,
          "",
        ],
      });
    };

    return (
      <section className="payroll-card payroll-full-card">
        <div className="payroll-card-head">
          <div>
            <small className="payroll-eyebrow">ATTENDANCE / PAYROLL REPORT</small>
            <h2>LOP Report</h2>
            <p>
              Employee-wise loss-of-pay days and corresponding gross-pay impact for the finalized payroll month.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="payroll-secondary-btn" onClick={() => setActiveSection("reports")}>
              ← Reports
            </button>
            <button type="button" className="payroll-secondary-btn" onClick={() => alert("NEW PRINT BUTTON IS WORKING")}>
              Print
            </button>
            <button type="button" className="payroll-primary-btn" onClick={exportLOP} disabled={!lopRows.length}>
              ↓ Export Excel
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div className="payroll-stat-card red">
            <span>Employees With LOP</span>
            <strong>{lopRows.length}</strong>
          </div>
          <div className="payroll-stat-card orange">
            <span>Total LOP Days</span>
            <strong>{totalLOPDays}</strong>
          </div>
          <div className="payroll-stat-card blue">
            <span>LOP Deduction Impact</span>
            <strong>{money(totalLOPDeduction)}</strong>
          </div>
        </div>

        <div className="payroll-table-scroll">
          <table className="payroll-register-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Site / Project</th>
                <th>Gross</th>
                <th>Total Days</th>
                <th>Paid Days</th>
                <th>LOP Days</th>
                <th>LOP Deduction</th>
                <th>Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {lopRows.length ? (
                <>
                  {lopRows.map((row) => (
                    <tr key={row.employeeId}>
                      <td>
                        <strong>{row.employeeName}</strong>
                        <small style={{ display: "block", marginTop: "3px" }}>
                          {row.employeeCode}
                        </small>
                      </td>
                      <td>{row.department || "—"}</td>
                      <td>{row.site || "—"}</td>
                      <td>{money(row.gross)}</td>
                      <td>{getDaysInPayrollMonth()}</td>
                      <td>{Number(row.paidDays || 0)}</td>
                      <td><strong>{Number(row.lopDays || 0)}</strong></td>
                      <td><strong>{money(getReportLOPDeduction(row))}</strong></td>
                      <td>{money(row.netPayable)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 800, background: "#f3f8fc" }}>
                    <td colSpan="6">TOTAL</td>
                    <td>{totalLOPDays}</td>
                    <td>{money(totalLOPDeduction)}</td>
                    <td>—</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "36px" }}>
                    <strong>No LOP employees found.</strong>
                    <small style={{ display: "block", marginTop: "6px" }}>
                      All finalized employees have zero LOP days for this payroll month.
                    </small>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: "16px",
            padding: "12px 14px",
            border: "1px solid #dce8f1",
            borderRadius: "10px",
            background: "#f7fbfe",
            color: "#71879a",
            fontSize: "11px",
          }}
        >
          <strong style={{ color: "#173b5d" }}>Calculation basis:</strong>{" "}
          LOP impact is taken from the finalized payroll payable-gross value. For legacy payroll rows that do not contain a stored LOP amount, the report falls back to Gross − Payable Gross, using the same calendar-day proration used by the payroll processor.
        </div>
      </section>
    );
  };

  const renderSalaryRegister = () => {
    const finalized = payrollProcessingStatus === "Finalized";

    const registerRows = (processedPayroll || []).map((row) => {
      const employee =
        employees.find((item) => item.id === row.employeeId) || {};
      return {
        ...row,
        employeeCode:
          row.employeeCode ||
          employee.employeeId ||
          employee.employeeCode ||
          employee.empCode ||
                    "",
        employeeName: row.employeeName || employee.name || "",
        employeeType: row.employeeType || employee.type || "",
        department: employee.department || row.department || "",
        site: employee.site || row.site || "",
      };
    });

    const types = ["All", ...new Set(registerRows.map((row) => row.employeeType).filter(Boolean))];
    const sites = ["All", ...new Set(registerRows.map((row) => row.site).filter(Boolean))];
    const departments = ["All", ...new Set(registerRows.map((row) => row.department).filter(Boolean))];

    const filteredRows = registerRows.filter((row) => {
      const q = salaryRegisterSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(row.employeeCode || "").toLowerCase().includes(q) ||
        String(row.employeeName || "").toLowerCase().includes(q) ||
        String(row.department || "").toLowerCase().includes(q) ||
        String(row.site || "").toLowerCase().includes(q);

      return (
        matchesSearch &&
        (salaryRegisterType === "All" || row.employeeType === salaryRegisterType) &&
        (salaryRegisterSite === "All" || row.site === salaryRegisterSite) &&
        (salaryRegisterDepartment === "All" || row.department === salaryRegisterDepartment)
      );
    });

    const total = (field) =>
      filteredRows.reduce((sum, row) => sum + Number(row[field] || 0), 0);

    const totalEmployees = filteredRows.length;
    const totalGross = total("gross");
    const totalPF = total("pf");
    const totalESI = total("esi");
    const totalPT = total("pt");
    const totalLOP = total("lopDays");
    const totalOTHours = total("otHours");
    const totalNet = total("netPayable");
    const totalEmployerPF = total("employerPF");
    const totalEmployerESI = total("employerESI");
    const totalInsurance = total("insurance");
    const totalCTC = total("finalCTC");

    const formatMonth = (value) => {
      if (!value) return "—";
      const date = new Date(`${value}-01T00:00:00`);
      return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          });
    };

    const printSalaryRegister = () => {
      if (!filteredRows.length) {
        window.alert("No payroll records are available to print.");
        return;
      }

      const printRows = filteredRows.map((row) => [
        row.employeeCode || "—",
        row.employeeName || "—",
        row.employeeType || "—",
        row.department || "—",
        row.site || "—",
        printMoney(row.gross),
        printMoney(row.pf),
        printMoney(row.esi),
        printMoney(row.pt),
        Number(row.paidDays || 0).toFixed(0),
        Number(row.lopDays || 0).toFixed(0),
        Number(row.otHours || 0).toFixed(2),
        printMoney(row.otAmount),
        printMoney(row.netPayable),
        printMoney(row.employerPF),
        printMoney(row.employerESI),
        printMoney(row.insurance),
        printMoney(row.finalCTC),
      ]);

      const totals = [
        "TOTAL",
        "",
        "",
        "",
        "",
        printMoney(totalGross),
        printMoney(totalPF),
        printMoney(totalESI),
        printMoney(totalPT),
        total("paidDays").toFixed(0),
        totalLOP.toFixed(0),
        totalOTHours.toFixed(2),
        printMoney(total("otAmount")),
        printMoney(totalNet),
        printMoney(totalEmployerPF),
        printMoney(totalEmployerESI),
        printMoney(totalInsurance),
        printMoney(totalCTC),
      ];

      const content = `
        <div class="meta">
          <span>Payroll Month: <strong>${escapePrintHtml(formatMonth(payrollMonth))}</strong></span>
          <span>Status: <strong>${escapePrintHtml(finalized ? "Finalized" : "Not Finalized")}</strong></span>
          <span>Employees: <strong>${escapePrintHtml(totalEmployees)}</strong></span>
        </div>
        ${buildPrintTable(
          ["Employee Code", "Employee Name", "Type", "Department", "Site / Project", "Gross", "PF", "ESI", "PT", "Paid Days", "LOP", "OT Hours", "OT Amount", "Net Payable", "Employer PF", "Employer ESI", "Insurance", "Final CTC"],
          printRows,
          totals
        )}
        <div class="note">This register is generated from the finalized payroll result stored in BAUER HRMS. Filters selected on the Salary Register screen are applied to this print.</div>
        <div class="signature"><div>Prepared By</div><div>Checked / Approved By</div></div>
      `;

      openPayrollPrint({
        title: "MONTHLY SALARY REGISTER",
        subtitle: `${formatMonth(payrollMonth)} · ${finalized ? "Finalized" : "Not Finalized"}`,
        orientation: "landscape",
        content,
      });
    };

    const exportSalaryRegister = () => {
      if (!filteredRows.length) {
        alert("No payroll records available for export.");
        return;
      }

      const headers = [
        "Employee Code",
        "Employee Name",
        "Employee Type",
        "Department",
        "Site / Project",
        "Gross",
        "Employee PF",
        "Employee ESI",
        "PT",
        "Paid Days",
        "LOP Days",
        "OT Hours",
        "OT Amount",
        "Net Payable",
        "Employer PF",
        "Employer ESI",
        "Insurance",
        "Final CTC",
      ];

      const data = filteredRows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.employeeType,
        row.department,
        row.site,
        Number(row.gross || 0),
        Number(row.pf || 0),
        Number(row.esi || 0),
        Number(row.pt || 0),
        Number(row.paidDays || 0),
        Number(row.lopDays || 0),
        Number(row.otHours || 0),
        Number(row.otAmount || 0),
        Number(row.netPayable || 0),
        Number(row.employerPF || 0),
        Number(row.employerESI || 0),
        Number(row.insurance || 0),
        Number(row.finalCTC || 0),
      ]);

      const totals = [
        "TOTAL",
        "",
        "",
        "",
        "",
        totalGross,
        totalPF,
        totalESI,
        totalPT,
        total("paidDays"),
        totalLOP,
        totalOTHours,
        total("otAmount"),
        totalNet,
        totalEmployerPF,
        totalEmployerESI,
        totalInsurance,
        totalCTC,
      ];

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([
        ["BAUER ENGINEERING INDIA PVT. LTD."],
        ["MONTHLY SALARY REGISTER"],
        [`Payroll Month: ${formatMonth(payrollMonth)}`, `Status: ${finalized ? "Finalized" : "Not Finalized"}`],
        [],
        headers,
        ...data,
        [],
        totals,
      ]);

      sheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      ];

      sheet["!cols"] = headers.map((header) => ({
        wch: Math.max(12, Math.min(24, header.length + 4)),
      }));

      XLSX.utils.book_append_sheet(workbook, sheet, "Salary Register");
      XLSX.writeFile(
        workbook,
        `Salary_Register_${payrollMonth || "Payroll"}.xlsx`
      );
    };

    return (
      <section className="payroll-card payroll-full-card">
        <div
          className="payroll-card-head"
          style={{
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <small className="payroll-eyebrow">MONTHLY PAYROLL REPORT</small>
            <h2>Salary Register</h2>
            <p>
              Employee-wise monthly payroll register generated from the finalized payroll calculation.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="payroll-secondary-btn"
              onClick={() => setActiveSection("reports")}
            >
              ← Reports
            </button>
            <button
              type="button"
              className="payroll-secondary-btn"
              onClick={printSalaryRegister}
            >
              Print
            </button>
            <button
              type="button"
              className="payroll-primary-btn"
              onClick={exportSalaryRegister}
              disabled={!filteredRows.length}
            >
              ↓ Export Excel
            </button>
          </div>
        </div>

        <div
          style={{
            margin: "0 0 18px",
            padding: "14px 16px",
            border: "1px solid #dce8f1",
            borderRadius: "12px",
            background: finalized ? "#f3fbf6" : "#fff8ed",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ color: "#173b5d" }}>
              Payroll Period: {formatMonth(payrollMonth)}
            </strong>
            <small style={{ display: "block", marginTop: "4px", color: "#71879a" }}>
              {finalized
                ? "Finalized payroll data is available for reporting."
                : "Payroll is not finalized yet. Finalize payroll before treating this register as an approved report."}
            </small>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 800,
              background: finalized ? "#e5f7ec" : "#fff0d9",
              color: finalized ? "#16834a" : "#a76300",
            }}
          >
            {finalized ? "FINALIZED" : "NOT FINALIZED"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: "10px",
            marginBottom: "18px",
          }}
        >
          {[
            ["Employees", totalEmployees, false],
            ["Gross", totalGross, true],
            ["Employee Deductions", totalPF + totalESI + totalPT, true],
            ["Net Payable", totalNet, true],
            ["Final CTC", totalCTC, true],
          ].map(([label, value, isMoney]) => (
            <div
              key={label}
              style={{
                border: "1px solid #dce8f1",
                borderRadius: "12px",
                padding: "13px 14px",
                background: "#fff",
                minWidth: 0,
              }}
            >
              <small
                style={{
                  display: "block",
                  color: "#7c91a2",
                  fontSize: "9px",
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </small>
              <strong
                style={{
                  display: "block",
                  marginTop: "7px",
                  color: "#173b5d",
                  fontSize: "16px",
                }}
              >
                {isMoney ? money(value) : value}
              </strong>
            </div>
          ))}
        </div>

        <div className="salary-register-filter-bar">
  <label className="salary-register-filter-field salary-register-search-field">
    <span>Search</span>
    <input
      type="text"
      value={salaryRegisterSearch}
      onChange={(e) => setSalaryRegisterSearch(e.target.value)}
      placeholder="Employee code, name, department..."
    />
  </label>

  <label className="salary-register-filter-field">
    <span>Employee Type</span>
    <select
      value={salaryRegisterType}
      onChange={(e) => setSalaryRegisterType(e.target.value)}
    >
      {types.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  </label>

  <label className="salary-register-filter-field">
    <span>Department</span>
    <select
      value={salaryRegisterDepartment}
      onChange={(e) => setSalaryRegisterDepartment(e.target.value)}
    >
      {departments.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  </label>

  <label className="salary-register-filter-field">
    <span>Site / Project</span>
    <select
      value={salaryRegisterSite}
      onChange={(e) => setSalaryRegisterSite(e.target.value)}
    >
      {sites.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  </label>
</div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "12px",
            color: "#6f8597",
            fontSize: "10px",
            fontWeight: 700,
          }}
        >
          <span>PF: {money(totalPF)}</span>
          <span>ESI: {money(totalESI)}</span>
          <span>PT: {money(totalPT)}</span>
          <span>LOP Days: {totalLOP}</span>
          <span>OT Hours: {totalOTHours.toFixed(2)}</span>
          <span>Employer PF: {money(totalEmployerPF)}</span>
          <span>Employer ESI: {money(totalEmployerESI)}</span>
          <span>Insurance: {money(totalInsurance)}</span>
        </div>

        <div className="payroll-table-scroll">
          <table className="payroll-register-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Department</th>
                <th>Site / Project</th>
                <th>Gross</th>
                <th>PF</th>
                <th>ESI</th>
                <th>PT</th>
                <th>Paid Days</th>
                <th>LOP</th>
                <th>OT Hours</th>
                <th>Net Payable</th>
                <th>Employer PF</th>
                <th>Employer ESI</th>
                <th>Insurance</th>
                <th>Final CTC</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                <>
                  {filteredRows.map((row) => (
                    <tr key={row.employeeId}>
                      <td>
                        <strong>{row.employeeName || "—"}</strong>
                        <small style={{ display: "block", marginTop: "3px" }}>
                          {row.employeeCode || "—"}
                        </small>
                      </td>
                      <td>{row.employeeType || "—"}</td>
                      <td>{row.department || "—"}</td>
                      <td>{row.site || "—"}</td>
                      <td>{money(row.gross)}</td>
                      <td>{money(row.pf)}</td>
                      <td>{money(row.esi)}</td>
                      <td>{money(row.pt)}</td>
                      <td>{Number(row.paidDays || 0).toFixed(0)}</td>
                      <td>{Number(row.lopDays || 0).toFixed(0)}</td>
                      <td>{Number(row.otHours || 0).toFixed(2)}</td>
                      <td><strong>{money(row.netPayable)}</strong></td>
                      <td>{money(row.employerPF)}</td>
                      <td>{money(row.employerESI)}</td>
                      <td>{money(row.insurance)}</td>
                      <td><strong>{money(row.finalCTC)}</strong></td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 800, background: "#f3f8fc" }}>
                    <td colSpan="4"><strong>TOTAL</strong></td>
                    <td><strong>{money(totalGross)}</strong></td>
                    <td><strong>{money(totalPF)}</strong></td>
                    <td><strong>{money(totalESI)}</strong></td>
                    <td><strong>{money(totalPT)}</strong></td>
                    <td><strong>{total("paidDays").toFixed(0)}</strong></td>
                    <td><strong>{totalLOP.toFixed(0)}</strong></td>
                    <td><strong>{totalOTHours.toFixed(2)}</strong></td>
                    <td><strong>{money(totalNet)}</strong></td>
                    <td><strong>{money(totalEmployerPF)}</strong></td>
                    <td><strong>{money(totalEmployerESI)}</strong></td>
                    <td><strong>{money(totalInsurance)}</strong></td>
                    <td><strong>{money(totalCTC)}</strong></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan="16" style={{ textAlign: "center", padding: "36px" }}>
                    <strong>No salary register records found.</strong>
                    <small style={{ display: "block", marginTop: "6px" }}>
                      Process and finalize payroll, or change the selected filters.
                    </small>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };


  const renderITDeclaration = () => {
    const declarationRows = employees.map((employee) => ({
      employee,
      declaration: itDeclaration.declarations?.[employee.id] || {},
    }));

    return (
      <section className="payroll-card payroll-full-card">
        <div className="payroll-card-head">
          <div>
            <small className="payroll-eyebrow">TAX & COMPLIANCE</small>
            <h2>IT Declaration</h2>
            <p>Manage employee tax regime and declaration status for payroll TDS.</p>
          </div>
          <button type="button" className="payroll-primary-btn" onClick={saveITDeclaration}>
            Submit / Close Declaration
          </button>
        </div>

        <div className="payroll-control-summary">
          <div><span>Financial Year</span><strong>{itDeclaration.financialYear}</strong></div>
          <div><span>Tax Regime</span><strong>{itDeclaration.regime}</strong></div>
          <div><span>Status</span><strong>{itDeclaration.status}</strong></div>
          <div><span>Employees</span><strong>{employees.length}</strong></div>
        </div>

        <div className="payroll-filter-bar">
          <label>Financial Year
            <select
              value={itDeclaration.financialYear}
              onChange={(e) => setITDeclaration((p) => ({ ...p, financialYear: e.target.value }))}
            >
              <option>FY 2026-27</option>
              <option>FY 2025-26</option>
            </select>
          </label>
          <label>Default Tax Regime
            <select
              value={itDeclaration.regime}
              onChange={(e) => setITDeclaration((p) => ({ ...p, regime: e.target.value }))}
            >
              <option>New Tax Regime</option>
              <option>Old Tax Regime</option>
            </select>
          </label>
          <label>Declaration Last Date
            <input
              type="date"
              value={itDeclaration.lastDate || ""}
              onChange={(e) => setITDeclaration((p) => ({ ...p, lastDate: e.target.value }))}
            />
          </label>
        </div>

        <div className="payroll-table-scroll">
          <table className="payroll-register-table">
            <thead>
              <tr>
                <th>Employee</th><th>Code</th><th>Regime</th><th>Declaration</th><th>TDS Status</th>
              </tr>
            </thead>
            <tbody>
              {declarationRows.map(({ employee, declaration }) => (
                <tr key={employee.id}>
                  <td><strong>{employee.name}</strong></td>
                  <td>{getEmployeeCode(employee) || "—"}</td>
                  <td>{declaration.regime || itDeclaration.regime}</td>
                  <td>{declaration.status || "Pending"}</td>
                  <td>
                    <span className={`payroll-status ${
                      declaration.status === "Submitted" ? "processed" : "pending"
                    }`}>
                      {declaration.status || "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
              {!declarationRows.length && (
                <tr><td colSpan="5" style={{ padding: "32px" }}>No employees available.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="payroll-policy-note">
          <span>IT</span>
          <div>
            <strong>Payroll integration</strong>
            <small>IT Declaration is kept inside Payroll because it directly controls tax/TDS processing. Detailed investment proof collection can be added later without changing the monthly payroll engine.</small>
          </div>
        </div>
      </section>
    );
  };

  const renderSalaryRelease = () => (
    <section className="payroll-card payroll-full-card">
      <div className="payroll-card-head">
        <div>
          <small className="payroll-eyebrow">PAYMENT & EMPLOYEE COMMUNICATION</small>
          <h2>Salary Release</h2>
          <p>Release the finalized salary cycle and make payslips available to employees.</p>
        </div>
        <button
          type="button"
          className="payroll-primary-btn"
          disabled={!payrollControl.locked || salaryReleaseState.released}
          onClick={releaseSalaryForEmployees}
        >
          {salaryReleaseState.released ? "Salary Released" : "Release Salary"}
        </button>
      </div>

      <div className="payroll-control-summary">
        <div><span>Payroll Month</span><strong>{getPayrollMonthLabel()}</strong></div>
        <div><span>Employees</span><strong>{processedPayroll.length}</strong></div>
        <div><span>Payroll Status</span><strong>{payrollProcessingStatus}</strong></div>
        <div><span>Release Status</span><strong>{salaryReleaseState.released ? "Released" : "Not Released"}</strong></div>
      </div>

      <div className="payroll-release-steps">
        {[
          ["01", "Calculate", processedPayroll.length > 0],
          ["02", "Finalize", ["Finalized", "Locked", "Salary Released"].includes(payrollProcessingStatus)],
          ["03", "Lock Month", Boolean(payrollControl.locked)],
          ["04", "Release Salary", Boolean(salaryReleaseState.released)],
        ].map(([number, label, done]) => (
          <div key={number} className={done ? "done" : ""}>
            <b>{number}</b><span>{label}</span>
          </div>
        ))}
      </div>

      <div className="payroll-table-scroll" style={{ marginTop: "18px" }}>
        <table className="payroll-register-table">
          <thead><tr><th>Employee</th><th>Net Payable</th><th>Payment Mode</th><th>Payslip</th><th>Status</th></tr></thead>
          <tbody>
            {processedPayroll.map((row) => (
              <tr key={row.employeeId}>
                <td><strong>{row.employeeName}</strong><small>{row.employeeCode}</small></td>
                <td><strong>{money(row.netPayable)}</strong></td>
                <td>{row.paymentMode || "Bank Transfer"}</td>
                <td>
                  <button type="button" className="payroll-link-btn" onClick={() => { setReportEmployeeId(row.employeeId); setActiveSection("payslip"); }}>
                    View Payslip
                  </button>
                </td>
                <td><span className={`payroll-status ${salaryReleaseState.released ? "processed" : "pending"}`}>
                  {salaryReleaseState.released ? "Released" : "Ready"}
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderPayrollControl = () => (
    <section className="payroll-card payroll-full-card">
      <div className="payroll-card-head">
        <div>
          <small className="payroll-eyebrow">MONTH-END CONTROL</small>
          <h2>Payroll Control</h2>
          <p>Lock, unlock and control the selected payroll month before salary release.</p>
        </div>
        <span className={`payroll-control-status ${payrollControl.locked ? "locked" : "open"}`}>
          {payrollControl.locked ? "MONTH LOCKED" : "MONTH OPEN"}
        </span>
      </div>

      <div className="payroll-control-summary">
        <div><span>Selected Month</span><strong>{getPayrollMonthLabel()}</strong></div>
        <div><span>Calculation Status</span><strong>{payrollProcessingStatus}</strong></div>
        <div><span>Locked At</span><strong>{payrollControl.lockedAt ? new Date(payrollControl.lockedAt).toLocaleString("en-IN") : "—"}</strong></div>
        <div><span>Salary Release</span><strong>{payrollControl.released ? "Released" : "Pending"}</strong></div>
      </div>

      <div className="payroll-control-actions">
        {!payrollControl.locked ? (
          <button type="button" className="payroll-primary-btn" onClick={lockCurrentPayroll}>
            🔒 Lock {getPayrollMonthLabel()}
          </button>
        ) : (
          <button type="button" className="payroll-secondary-btn" onClick={unlockCurrentPayroll}>
            Unlock Payroll
          </button>
        )}
        <button type="button" className="payroll-secondary-btn" onClick={() => setActiveSection("processing")}>
          Go to Processing
        </button>
        <button type="button" className="payroll-secondary-btn" onClick={() => setActiveSection("salary-release")}>
          Salary Release
        </button>
      </div>

      <div className="payroll-policy-note" style={{ marginTop: "18px" }}>
        <span>✓</span>
        <div>
          <strong>Control rule</strong>
          <small>Once a month is locked, payroll calculation changes are blocked at the Payroll workflow level. Unlock should be restricted to authorised Payroll / HR users.</small>
        </div>
      </div>
    </section>
  );

  const renderSalary = () => {
      const configuredSalaryRows = employees.map((employee) => ({
        employee,
        structure: salaryStructures[employee.id],
      }));

      return (
        <section className="payroll-card payroll-full-card">
          <div className="payroll-card-head">
            <div>
              <small className="payroll-eyebrow">SALARY MASTER</small>
              <h2>Salary Structure</h2>
              <p>Define employee-wise earnings before monthly payroll.</p>
            </div>
            <div className="salary-header-actions">
              <button type="button" className="payroll-secondary-btn" onClick={openBulkSalary}>
                ⇧ Bulk Upload
              </button>
              <button className="payroll-primary-btn" onClick={openNewSalary}>
                + Add New
              </button>
            </div>
          </div>

          <div className="salary-policy-banner">
            <div>
              <strong>Company Salary Formula</strong>
              <span>Basic + DA = 50% of Gross · HRA = 50% of Basic + DA · Special Allowance = Balance</span>
            </div>
          </div>

          <div className="payroll-module-grid">
            {[
              ["Basic + DA", "50% of Gross Salary", "₹"],
              ["HRA", "50% of Basic + DA", "⌂"],
              ["Special Allowance", "Balance of Gross", "+"],
              ["Food Allowance", "Separate payroll component", "▣"],
              ["Hardship Allowance", "Site / role based", "◆"],
              ["Other Allowances", "Additional approved earnings", "≡"],
            ].map(([name, detail, icon]) => (
              <div className="payroll-module-card" key={name}>
                <span>{icon}</span>
                <div>
                  <strong>{name}</strong>
                  <small>{detail}</small>
                </div>
                <span className="salary-locked-badge">
                  {name === "Food Allowance" || name === "Hardship Allowance" || name === "Other Allowances"
                    ? "Separate"
                    : "Auto"}
                </span>
              </div>
            ))}
          </div>

          <div className="salary-master-section">
            <div className="salary-master-heading">
              <div>
                <small className="payroll-eyebrow">EMPLOYEE SALARY MASTER</small>
                <h3>Configured Salary Structures</h3>
              </div>
              <span>{Object.keys(salaryStructures).length} configured</span>
            </div>

            <div className="payroll-table-scroll">
              <table className="payroll-register-table salary-master-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Site</th>
                    <th>Gross</th>
                    <th>Basic + DA</th>
                    <th>HRA</th>
                    <th>Special Allowance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {configuredSalaryRows.map(({ employee, structure }) => (
                    <tr key={employee.id}>
                      <td>
                        <strong>{employee.name}</strong>
                        <small>{getEmployeeCode(employee)} · {employee.department}</small>
                      </td>
                      <td>
                        <span className={`type-pill ${employee.type === "Third Party" ? "third" : "roll"}`}>
                          {employee.type}
                        </span>
                      </td>
                      <td>{employee.site}</td>
                      <td>{structure ? money(structure.gross) : "—"}</td>
                      <td>{structure ? money(structure.basicDA) : "—"}</td>
                      <td>{structure ? money(structure.hra) : "—"}</td>
                      <td>{structure ? money(structure.specialAllowance) : "—"}</td>
                      <td>
                        <span className={`payroll-status ${structure ? "processed" : "pending"}`}>
                          {structure ? "Configured" : "Not Configured"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="payroll-link-btn"
                          onClick={() => openEditSalary(employee.id)}
                        >
                          {structure ? "Edit" : "Configure"} →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showBulkSalary && (
            <div className="salary-modal-backdrop" onMouseDown={closeBulkSalary}>
              <div className="bulk-salary-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-salary-title" onMouseDown={(event) => event.stopPropagation()}>
                <div className="salary-modal-head">
                  <div>
                    <small className="payroll-eyebrow">SALARY MASTER</small>
                    <h3 id="bulk-salary-title">Bulk Salary Upload</h3>
                    <p>Upload salary structure for 50–60 employees together. Single employee interface remains unchanged.</p>
                  </div>
                  <button type="button" className="salary-modal-close" onClick={closeBulkSalary}>×</button>
                </div>
                <div className="bulk-step-grid">
                  <div className="bulk-step-card"><span>01</span><div><strong>Download Template</strong><small>Pre-filled employee master with salary and add-on columns.</small></div><button type="button" className="payroll-secondary-btn" onClick={downloadBulkSalaryTemplate}>Download Excel</button></div>
                  <div className="bulk-step-card"><span>02</span><div><strong>Upload Filled Excel</strong><small>Fill Gross, Food, Hardship and other approved allowances.</small></div><label className="bulk-file-btn">Choose Excel<input type="file" accept=".xlsx,.xls" onChange={processBulkSalaryFile} /></label></div>
                </div>
                {bulkSalaryFileName && <div className="bulk-file-selected">Selected file: <strong>{bulkSalaryFileName}</strong></div>}
                <div className="bulk-validation-summary">
                  <div><strong>{bulkSalaryRows.length}</strong><span>Valid Rows</span></div>
                  <div className={bulkSalaryErrors.length ? "has-errors" : ""}><strong>{bulkSalaryErrors.length}</strong><span>Errors</span></div>
                  <div><strong>{bulkSalaryRows.filter((item) => item.existing).length}</strong><span>Updates</span></div>
                  <div><strong>{bulkSalaryRows.filter((item) => !item.existing).length}</strong><span>New</span></div>
                </div>
                {bulkSalaryErrors.length > 0 && <div className="bulk-errors"><strong>Please correct these rows:</strong>{bulkSalaryErrors.map((error, index) => <small key={index}>{error}</small>)}</div>}
                {bulkSalaryRows.length > 0 && <div className="bulk-preview-section">
                  <div className="bulk-preview-head"><div><strong>Upload Preview</strong><small>Basic + DA, HRA and Special Allowance are automatic.</small></div><span>{bulkSalaryRows.length} employees</span></div>
                  <div className="bulk-preview-scroll"><table className="payroll-register-table bulk-preview-table"><thead><tr><th>Employee</th><th>Gross</th><th>Basic + DA</th><th>HRA</th><th>Special</th><th>Food</th><th>Hardship</th><th>Add-ons</th><th>Total</th></tr></thead><tbody>{bulkSalaryRows.map(({ employee, structure }) => <tr key={employee.id}><td><strong>{employee.name}</strong><small>{getEmployeeCode(employee)}</small></td><td>{money(structure.gross)}</td><td>{money(structure.basicDA)}</td><td>{money(structure.hra)}</td><td>{money(structure.specialAllowance)}</td><td>{money(structure.foodAllowance)}</td><td>{money(structure.hardshipAllowance)}</td><td>{money(structure.addOnTotal)}</td><td><strong>{money(structure.totalEarnings)}</strong></td></tr>)}</tbody></table></div>
                </div>}
                <div className="salary-modal-actions"><button type="button" className="payroll-secondary-btn" onClick={closeBulkSalary}>Cancel</button><button type="button" className="payroll-primary-btn" disabled={!bulkSalaryRows.length || bulkSalaryErrors.length > 0} onClick={saveBulkSalaryStructures}>Confirm & Save {bulkSalaryRows.length ? `(${bulkSalaryRows.length})` : ""}</button></div>
              </div>
            </div>
          )}

          {showSalaryForm && (
            <div className="salary-modal-backdrop" onMouseDown={closeSalaryForm}>
              <div
                className="salary-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="salary-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="salary-modal-head">
                  <div>
                    <small className="payroll-eyebrow">SALARY MASTER</small>
                    <h3 id="salary-modal-title">
                      {editingSalaryId ? "Edit Salary Structure" : "Add Salary Structure"}
                    </h3>
                  </div>
                  <button type="button" className="salary-modal-close" onClick={closeSalaryForm}>×</button>
                </div>

                <div className="salary-form-grid">
                  <label>
                    Employee *
                    <select
                      value={salaryEmployeeId}
                      onChange={(event) => {
                        const id = event.target.value;
                        setSalaryEmployeeId(id);
                        if (!editingSalaryId && id && salaryStructures[id]) {
                          setSalaryGross(String(salaryStructures[id].gross));
                        }
                      }}
                      disabled={Boolean(editingSalaryId)}
                    >
                      <option value="">Select Employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} ({getEmployeeCode(employee)})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Employee Type
                    <input value={selectedSalaryEmployee?.type || ""} readOnly placeholder="Auto" />
                  </label>

                  <label>
                    Site / Project
                    <input value={selectedSalaryEmployee?.site || ""} readOnly placeholder="Auto" />
                  </label>

                  <label>
                    Vendor
                    <input
                      value={selectedSalaryEmployee?.vendor || "—"}
                      readOnly
                      placeholder="Auto"
                    />
                  </label>

                  <label className="salary-gross-field">
                    Monthly Gross Salary *
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={salaryGross}
                      onChange={(event) => setSalaryGross(event.target.value)}
                      placeholder="Enter gross salary"
                    />
                  </label>
                  <label>
                  Employer Insurance
                  <input
                  type="number"
                  min="0"
                  step="1"
                  value={salaryInsurance}
                  onChange={(event) => setSalaryInsurance(event.target.value)}
                  placeholder="Enter monthly insurance"
                  />
                  </label>
                  </div>

                <div className="salary-calculation-box">
                  <div className="salary-calculation-title">AUTO CALCULATED COMPONENTS</div>

                  <div className="salary-calculation-row">
                    <span>Basic + DA <small>50% of Gross</small></span>
                    <strong>{money(salaryBasicDA)}</strong>
                  </div>

                  <div className="salary-calculation-row">
                    <span>HRA <small>50% of Basic + DA</small></span>
                    <strong>{money(salaryHra)}</strong>
                  </div>

                  <div className="salary-calculation-row">
                    <span>Special Allowance <small>Balance Amount</small></span>
                    <strong>{money(salarySpecial)}</strong>
                  </div>

                  <div className="salary-calculation-total">
                    <span>Gross Salary</span>
                    <strong>{money(salaryGrossNumber)}</strong>
                  </div>
                </div>

                <div className="salary-modal-actions">
                  <button type="button" className="payroll-secondary-btn" onClick={closeSalaryForm}>
                    Cancel
                  </button>
                  <button type="button" className="payroll-primary-btn" onClick={saveSalaryStructure}>
                    Save Salary Structure
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      );
  };

  const renderDeductions = () => {
      const deductionCards = [
        ["Loan / Advance", "Recovery schedule", "₹"],
        ["Food Deduction", "Attendance / meal based", "FD"],
        ["Other Deduction", "Manual approved deduction", "−"],
        ["Recovery", "Vendor / employee recovery", "↺"],
      ];

      const activeDeductions = deductions.filter(
        (item) => item.status === "Active"
      );

      const totalConfigured = activeDeductions.reduce(
        (sum, item) => sum + Number(item.totalAmount || 0),
        0
      );

      return (
        <section className="payroll-card payroll-full-card">
          <div className="payroll-card-head">
            <div>
              <small className="payroll-eyebrow">DEDUCTIONS</small>
              <h2>Payroll Deductions</h2>
              <p>Manage recurring and one-time employee deductions.</p>
            </div>
            <button
              className="payroll-primary-btn"
              type="button"
              onClick={() => openNewDeduction("Loan / Advance")}
            >
              + Add New
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div className="payroll-stat-card blue">
              <span>Active Deductions</span>
              <strong>{activeDeductions.length}</strong>
              <small>Currently enabled</small>
            </div>

            <div className="payroll-stat-card orange">
              <span>Configured Amount</span>
              <strong>{money(totalConfigured)}</strong>
              <small>Total configured recovery</small>
            </div>

            <div className="payroll-stat-card green">
              <span>Payroll Month</span>
              <strong>
                {new Date(
                  `${payrollMonth}-01T00:00:00`
                ).toLocaleDateString("en-IN", {
                  month: "short",
                  year: "numeric",
                })}
              </strong>
              <small>Current processing cycle</small>
            </div>
          </div>

          <div className="payroll-module-grid">
            {deductionCards.map(([name, detail, icon]) => (
              <div
                className="payroll-module-card"
                key={name}
              >
                <span>{icon}</span>
                <div>
                  <strong>{name}</strong>
                  <small>{detail}</small>
                </div>
                <button
                  type="button"
                  onClick={() => openNewDeduction(name)}
                >
                  Configure →
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "22px",
              borderTop: "1px solid #e2ebf2",
              paddingTop: "18px",
            }}
          >
            <div className="payroll-card-head">
              <div>
                <small className="payroll-eyebrow">
                  FOOD DEDUCTION
                </small>
                <h2>Monthly Food Deduction</h2>
                <p>
                  Manage manual food deductions employee-wise.
                  Deduction days are reference only.
                </p>
              </div>

              <button
                className="payroll-primary-btn"
                type="button"
                onClick={() => openNewDeduction("Food Deduction")}
              >
                Configure →
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              <div className="payroll-stat-card blue">
                <span>Applicable Employees</span>
                <strong>
                  {
                    foodMonthlyRecords.filter(
                      (item) =>
                        item.status === "Active" &&
                        item.foodApplicable === true
                    ).length
                  }
                </strong>
                <small>August 2026 food setup</small>
              </div>

              <div className="payroll-stat-card orange">
                <span>Manual Food Deduction</span>
                <strong>
                  {money(
                    foodMonthlyRecords
                      .filter(
                        (item) =>
                          item.status === "Active" &&
                          item.foodApplicable === true
                      )
                      .reduce(
                        (sum, item) =>
                          sum + Number(item.totalAmount || 0),
                        0
                      )
                  )}
                </strong>
                <small>Final amount for payroll</small>
              </div>

              <div className="payroll-stat-card green">
                <span>Calculation Basis</span>
                <strong>Manual</strong>
                <small>Days do not calculate amount</small>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "22px",
              borderTop: "1px solid #e2ebf2",
              paddingTop: "18px",
            }}
          >
            <div className="payroll-card-head">
              <div>
                <small className="payroll-eyebrow">
                  DEDUCTION MASTER
                </small>
                <h2>Configured Deductions</h2>
                <p>
                  Employee-wise deduction and recovery records.
                </p>
              </div>
            </div>

            {deductions.length === 0 ? (
              <div
                style={{
                  padding: "36px 20px",
                  textAlign: "center",
                  border: "1px dashed #cbd9e4",
                  borderRadius: "12px",
                  background: "#fbfdff",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "#173b5d",
                    marginBottom: "6px",
                  }}
                >
                  No deductions configured
                </strong>
                <span
                  style={{
                    color: "#71879a",
                    fontSize: "12px",
                  }}
                >
                  Add a Loan / Advance, Food Deduction,
                  Other Deduction or Recovery.
                </span>
              </div>
            ) : (
              <div className="payroll-table-scroll">
                <table className="payroll-register-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Details</th>
                      <th>Amount</th>
                      <th>Month / Start</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {deductions.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.employeeName}</strong>
                          <small>
                            {item.employeeId} · {item.site}
                          </small>
                        </td>

                        <td>
                          <span className="type-pill roll">
                            {item.type}
                          </span>
                        </td>

                        <td>
                          {item.type === "Loan / Advance" ? (
                            <small>
                              {item.loanType} · EMI{" "}
                              {money(item.emiAmount)}
                            </small>
                          ) : item.type === "Food Deduction" ? (
                            <small>
                              {money(item.ratePerDay)}/day ×{" "}
                              {item.deductionDays} days
                            </small>
                          ) : (
                            <small>
                              {item.reason || "—"}
                            </small>
                          )}
                        </td>

                        <td>
                          <strong>
                            {money(item.totalAmount)}
                          </strong>
                        </td>

                        <td>
                          {item.startMonth ||
                            item.month ||
                            "—"}
                        </td>

                        <td>
                          <span
                            className={`payroll-status ${
                              item.status === "Active"
                                ? "processed"
                                : "pending"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="payroll-link-btn"
                              onClick={() =>
                                openEditDeduction(item)
                              }
                            >
                              Edit
                            </button>

                            <button
  type="button"
  className="payroll-link-btn"
  onClick={() => toggleDeductionStatus(item.id)}
>
  {item.status === "Active" ? "Disable" : "Enable"}
</button>

                            <button
                              type="button"
                              className="payroll-link-btn"
                              onClick={() =>
                                deleteDeduction(item.id)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showDeductionForm && (
            <div
              onMouseDown={closeDeductionForm}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(18, 42, 61, 0.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
              }}
            >
              <div
                onMouseDown={(event) =>
                  event.stopPropagation()
                }
                style={{
                  width:
                    deductionType === "Food Deduction"
                      ? "min(1180px, calc(100vw - 48px))"
                      : "min(760px, 100%)",
                  maxHeight: "94vh",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: "14px",
                  border: "1px solid #dce8f1",
                  boxShadow:
                    "0 20px 60px rgba(18,42,61,.18)",
                  padding: "22px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <small className="payroll-eyebrow">
                      DEDUCTION MASTER
                    </small>
                    <h2
                      style={{
                        margin: "5px 0 4px",
                        color: "#173b5d",
                      }}
                    >
                      {deductionType === "Food Deduction"
                        ? "Food Deduction — Monthly"
                        : editingDeductionId
                          ? `Edit ${deductionType}`
                          : `Add ${deductionType}`}
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: "#71879a",
                        fontSize: "12px",
                      }}
                    >
                      {deductionType === "Food Deduction"
                        ? "Configure monthly food deduction employee-wise."
                        : "Configure the deduction for monthly payroll processing."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeDeductionForm}
                    style={{
                      border: "0",
                      background: "#eef5fa",
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "20px",
                      color: "#557087",
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  className="salary-form-grid"
                  style={{
                    display:
                      deductionType === "Food Deduction"
                        ? "none"
                        : undefined,
                  }}
                >
                  <label>
                    Employee *
                    <select
                      value={deductionEmployeeId}
                      onChange={(event) =>
                        setDeductionEmployeeId(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select Employee
                      </option>
                      {employees.map((employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                        >
                          {employee.name} ({getEmployeeCode(employee)})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Employee Type
                    <input
                      value={
                        selectedDeductionEmployee?.type || ""
                      }
                      readOnly
                      placeholder="Auto"
                    />
                  </label>

                  <label>
                    Site / Project
                    <input
                      value={
                        selectedDeductionEmployee?.site || ""
                      }
                      readOnly
                      placeholder="Auto"
                    />
                  </label>

                  <label>
                    Status
                    <select
                      value={deductionStatus}
                      onChange={(event) =>
                        setDeductionStatus(
                          event.target.value
                        )
                      }
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </label>
                </div>

                {deductionType === "Loan / Advance" && (
                  <>
                    <div
                      className="salary-policy-banner"
                      style={{ marginTop: "18px" }}
                    >
                      <div>
                        <strong>
                          Loan / Advance Recovery
                        </strong>
                        <span>
                          EMI will be used as the monthly
                          recovery amount.
                        </span>
                      </div>
                    </div>

                    <div className="salary-form-grid">
                      <label>
                        Loan / Advance Type *
                        <select
                          value={loanType}
                          onChange={(event) =>
                            setLoanType(event.target.value)
                          }
                        >
                          <option>
                            Salary Advance
                          </option>
                          <option>
                            Personal Loan
                          </option>
                          <option>
                            Emergency Advance
                          </option>
                          <option>
                            Other
                          </option>
                        </select>
                      </label>

                      <label>
                        Total Amount *
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={loanTotal}
                          onChange={(event) =>
                            setLoanTotal(event.target.value)
                          }
                          placeholder="Enter total amount"
                        />
                      </label>

                      <label>
                        Recovery Start Month *
                        <input
                          type="month"
                          value={loanStartMonth}
                          onChange={(event) =>
                            setLoanStartMonth(
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        EMI / Monthly Recovery *
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={loanEmi}
                          onChange={(event) =>
                            setLoanEmi(event.target.value)
                          }
                          placeholder="Enter EMI"
                        />
                      </label>

                      <label>
                        Number of Installments *
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={loanInstallments}
                          onChange={(event) =>
                            setLoanInstallments(
                              event.target.value
                            )
                          }
                          placeholder="e.g. 12"
                        />
                      </label>

                      <label>
                        Estimated Recovery
                        <input
                          value={
                            loanTotal && loanEmi
                              ? money(
                                  Math.min(
                                    Number(loanTotal),
                                    Number(loanEmi) *
                                      Number(
                                        loanInstallments ||
                                          0
                                      )
                                  )
                                )
                              : "₹0"
                          }
                          readOnly
                        />
                      </label>
                    </div>
                  </>
                )}

                {deductionType === "Food Deduction" && (
                  <div
                    className="food-deduction-modal"
                    style={{ marginTop: "2px" }}
                  >
                    <style>{`
                      .food-deduction-modal,
                      .food-deduction-modal * {
                        box-sizing: border-box;
                      }

                      .food-deduction-modal label {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        min-width: 0;
                        color: #173b5d;
                        font-size: 10px;
                        font-weight: 700;
                      }

                      .food-deduction-modal input:not([type="checkbox"]),
                      .food-deduction-modal select {
                        width: 100%;
                        min-width: 0;
                        height: 40px;
                        min-height: 40px;
                        padding: 0 12px;
                        border: 1px solid #d7e3ec;
                        border-radius: 8px;
                        background: #fff;
                        color: #35566e;
                        font-family: inherit;
                        font-size: 12px;
                        line-height: normal;
                        outline: none;
                        box-shadow: none;
                      }

                      .food-deduction-modal input:not([type="checkbox"]):focus,
                      .food-deduction-modal select:focus {
                        border-color: #2b8ad6;
                        box-shadow: 0 0 0 3px rgba(43,138,214,.10);
                      }

                      .food-deduction-modal input:not([type="checkbox"])::placeholder {
                        color: #9aaab6;
                        opacity: 1;
                      }

                      .food-deduction-modal input:not([type="checkbox"]):disabled,
                      .food-deduction-modal select:disabled {
                        background: #f2f6f9;
                        color: #91a0ab;
                        cursor: not-allowed;
                      }

                      .food-deduction-modal input[type="checkbox"] {
                        width: 15px;
                        height: 15px;
                        min-width: 15px;
                        min-height: 15px;
                        margin: 0;
                        padding: 0;
                        accent-color: #126fb2;
                      }

                      .food-deduction-modal .food-filter-grid {
                        display: grid;
                        grid-template-columns:
                          160px minmax(200px,1fr)
                          minmax(260px,1.2fr) 180px;
                        gap: 12px;
                        align-items: end;
                        margin-bottom: 14px;
                      }

                      .food-deduction-modal .food-bulk-grid {
                        display: grid;
                        grid-template-columns:
                          minmax(170px,.8fr)
                          minmax(180px,1fr)
                          minmax(210px,1fr) 190px;
                        gap: 10px;
                        align-items: end;
                      }

                      .food-deduction-modal .food-table {
                        width: 100%;
                        overflow: hidden;
                        border: 1px solid #d7e5ee;
                        border-radius: 10px;
                        background: #fff;
                      }

                      .food-deduction-modal .food-table-head,
                      .food-deduction-modal .food-table-row {
                        display: grid;
                        grid-template-columns:
                          42px minmax(235px,1.6fr)
                          135px 120px 155px 165px;
                        gap: 9px;
                        align-items: center;
                      }

                      .food-deduction-modal .food-table-head {
                        padding: 10px 12px;
                        background: #eef5fa;
                        border-bottom: 1px solid #d7e5ee;
                        color: #527087;
                        font-size: 9px;
                        font-weight: 700;
                        letter-spacing: .025em;
                        text-transform: uppercase;
                      }

                      .food-deduction-modal .food-table-row {
                        padding: 10px 12px;
                        border-bottom: 1px solid #edf2f6;
                      }

                      .food-deduction-modal .food-table-row:last-child {
                        border-bottom: 0;
                      }

                      .food-deduction-modal .food-calc-box {
                        display: flex;
                        align-items: center;
                        min-height: 40px;
                        height: 40px;
                        padding: 0 10px;
                        border: 1px solid #d7e3ec;
                        border-radius: 8px;
                        background: #f8fbfe;
                        color: #174a72;
                        font-size: 12px;
                        font-weight: 700;
                      }

                      .food-deduction-modal .food-summary-grid {
                        display: grid;
                        grid-template-columns: repeat(3,minmax(0,1fr));
                        gap: 10px;
                        margin-top: 12px;
                      }

                      .food-deduction-modal .food-footer {
                        display: flex;
                        justify-content: flex-end;
                        align-items: center;
                        gap: 10px;
                        margin-top: 16px;
                        padding-top: 14px;
                        border-top: 1px solid #e2ebf2;
                      }

                      @media (max-width: 900px) {
                        .food-deduction-modal .food-filter-grid {
                          grid-template-columns: repeat(2,minmax(0,1fr));
                        }
                        .food-deduction-modal .food-bulk-grid {
                          grid-template-columns: repeat(2,minmax(0,1fr));
                        }
                        .food-deduction-modal .food-table {
                          overflow-x: auto;
                        }
                        .food-deduction-modal .food-table-head,
                        .food-deduction-modal .food-table-row {
                          min-width: 900px;
                        }
                        .food-deduction-modal .food-summary-grid {
                          grid-template-columns: 1fr;
                        }
                      }
                    `}</style>
                    <div style={{
                      border: "1px solid #d9e7f1",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg,#f8fbfe,#f2f8fc)",
                      padding: "14px 16px",
                      marginBottom: "14px",
                    }}>
                      <strong style={{display:"block",color:"#173b5d",fontSize:"14px",marginBottom:"4px"}}>
                        Monthly Food Deduction
                      </strong>
                      <span style={{display:"block",color:"#71879a",fontSize:"11px",lineHeight:1.5}}>
                        ₹3,500 is the full-month food charge. Choose 26, 30 or 31 days as the monthly calculation basis.
                      </span>
                    </div>

                    <div className="food-filter-grid">
                      <label>
                        Payroll Month
                        <input type="month" value={payrollMonth} readOnly />
                      </label>
                      <label>
                        Site / Project
                        <select value={foodSiteFilter} onChange={(e)=>setFoodSiteFilter(e.target.value)}>
                          {foodSites.map((site)=><option key={site} value={site}>{site}</option>)}
                        </select>
                      </label>
                      <label>
                        Search Employee / ID / Name
                        <input value={foodSearch} onChange={(e)=>setFoodSearch(e.target.value)} placeholder="Search employee or ID..." />
                      </label>
                      <label>
                        Calculation Basis
                        <select value={foodDayBasis} onChange={(e)=>setFoodDayBasis(e.target.value)}>
                          <option value="26">26 Days</option>
                          <option value="30">30 Days</option>
                          <option value="31">31 Days</option>
                        </select>
                      </label>
                    </div>

                    <div style={{border:"1px solid #d5e5ef",borderRadius:"10px",background:"#f6fafe",padding:"13px 14px 14px",marginBottom:"12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                        <div>
                          <strong style={{display:"block",color:"#174a72",fontSize:"12px"}}>Bulk Update</strong>
                          <span style={{display:"block",color:"#8296a5",fontSize:"10px",marginTop:"2px"}}>
                            Apply the same values to all selected employees.
                          </span>
                        </div>
                        <span style={{color:"#527087",fontSize:"11px",fontWeight:700}}>{selectedFoodEmployees.length} selected</span>
                      </div>

                      <div className="food-bulk-grid">
                        <label>
                          Food Applicable
                          <select value={bulkFoodApplicable} onChange={(e)=>setBulkFoodApplicable(e.target.value)}>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </label>
                        <label>
                          Food Days
                          <input type="number" min="0" step="1" value={bulkFoodDays} onChange={(e)=>setBulkFoodDays(e.target.value)} placeholder="e.g. 4" />
                        </label>
                        <label>
                          Monthly Food Amount (₹)
                          <input type="number" min="0" step="1" value={bulkFoodAmount} disabled={bulkFoodApplicable==="No"} onChange={(e)=>setBulkFoodAmount(e.target.value)} placeholder="3500" />
                        </label>
                        <button type="button" className="payroll-primary-btn" onClick={applyBulkFood} style={{width:"100%",minHeight:"40px"}}>
                          Apply to Selected
                        </button>
                      </div>
                    </div>

                    <div className="food-table">
                      <div className="food-table-head">
                        <span>
                          <input type="checkbox" checked={foodRows.length>0 && foodRows.every(({employee})=>selectedFoodEmployees.includes(employee.id))} onChange={toggleAllVisibleFoodEmployees}/>
                        </span>
                        <span>Employee / Site</span>
                        <span>Applicable</span>
                        <span>Food Days</span>
                        <span>Monthly Amount</span>
                        <span>Calculated Deduction</span>
                      </div>

                      {foodRows.length===0 ? (
                        <div style={{padding:"32px 20px",textAlign:"center",color:"#71879a",fontSize:"12px"}}>No employees found for the selected filter.</div>
                      ) : (
                        foodRows.map(({employee,applicable,days,monthlyAmount,calculatedAmount,basis})=>(
                          <div key={employee.id} style={{display:"grid",gridTemplateColumns:"42px minmax(240px,1.6fr) 135px 120px 155px 165px",gap:"9px",alignItems:"center",padding:"10px 12px",borderBottom:"1px solid #edf2f6"}}>
                            <span><input type="checkbox" checked={selectedFoodEmployees.includes(employee.id)} onChange={()=>toggleFoodEmployee(employee.id)}/></span>

                            <div style={{minWidth:0}}>
                              <strong style={{display:"block",color:"#173b5d",fontSize:"11px"}}>{employee.name}</strong>
                              <span style={{display:"block",marginTop:"3px",color:"#71879a",fontSize:"9px"}}>{getEmployeeCode(employee)} · {employee.site||"—"} {employee.type ? `· ${employee.type}` : ""}</span>
                            </div>

                            <select value={applicable?"Yes":"No"} onChange={(e)=>upsertFoodRecord(employee,{foodApplicable:e.target.value==="Yes"})}>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>

                            <input type="number" min="0" step="1" value={days} placeholder="0" onChange={(e)=>upsertFoodRecord(employee,{deductionDays:e.target.value})}/>

                            <input type="number" min="0" step="1" value={monthlyAmount} disabled={!applicable} onChange={(e)=>upsertFoodRecord(employee,{foodMonthlyAmount:e.target.value,foodApplicable:true})}/>

                            <div className="food-calc-box">
                              {money(calculatedAmount)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="food-summary-grid">
                      <div style={{padding:"11px 13px",border:"1px solid #dbe7ef",borderRadius:"9px",background:"#f8fbfe"}}>
                        <span style={{display:"block",color:"#71879a",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>SELECTED EMPLOYEES</span>
                        <strong style={{color:"#174a72",fontSize:"16px"}}>{selectedFoodEmployees.length}</strong>
                      </div>

                      <div style={{padding:"11px 13px",border:"1px solid #dbe7ef",borderRadius:"9px",background:"#f8fbfe"}}>
                        <span style={{display:"block",color:"#71879a",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>FINAL FOOD DEDUCTION</span>
                        <strong style={{color:"#174a72",fontSize:"16px"}}>
                          {money(selectedFoodEmployees.reduce((sum,id)=>{
                            const row=foodRows.find(({employee})=>employee.id===id);
                            return sum + (row?.applicable ? Number(row.calculatedAmount||0) : 0);
                          },0))}
                        </strong>
                      </div>

                      <div style={{padding:"11px 13px",border:"1px solid #dbe7ef",borderRadius:"9px",background:"#f8fbfe"}}>
                        <span style={{display:"block",color:"#71879a",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>CALCULATION</span>
                        <strong style={{display:"block",color:"#198754",fontSize:"12px"}}>{foodDayBasis} Day Basis</strong>
                        <small style={{display:"block",marginTop:"2px",color:"#8296a5",fontSize:"9px"}}>
                          Monthly Amount ÷ {foodDayBasis} × Food Days
                        </small>
                      </div>
                    </div>

                    <div className="food-footer">
                      <button type="button" className="payroll-secondary-btn" onClick={closeDeductionForm}>Cancel</button>
                      <button type="button" className="payroll-primary-btn" onClick={closeDeductionForm}>Save Food Deduction</button>
                    </div>
                  </div>
                )}

                {deductionType === "Other Deduction" && (
                  <div
                    className="salary-form-grid"
                    style={{ marginTop: "18px" }}
                  >
                    <label>
                      Deduction Month
                      <input
                        type="month"
                        value={payrollMonth}
                        readOnly
                      />
                    </label>

                    <label>
                      Deduction Amount *
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={otherAmount}
                        onChange={(event) =>
                          setOtherAmount(
                            event.target.value
                          )
                        }
                        placeholder="Enter amount"
                      />
                    </label>

                    <label
                      style={{
                        gridColumn: "1 / -1",
                      }}
                    >
                      Reason / Approval Reference *
                      <input
                        value={otherReason}
                        onChange={(event) =>
                          setOtherReason(
                            event.target.value
                          )
                        }
                        placeholder="Enter reason"
                      />
                    </label>
                  </div>
                )}

                {deductionType === "Recovery" && (
                  <div
                    className="salary-form-grid"
                    style={{ marginTop: "18px" }}
                  >
                    <label>
                      Recovery Type
                      <select
                        value={recoveryType}
                        onChange={(event) =>
                          setRecoveryType(
                            event.target.value
                          )
                        }
                      >
                        <option>
                          Employee Recovery
                        </option>
                        <option>
                          Vendor Recovery
                        </option>
                        <option>
                          Damage / Asset Recovery
                        </option>
                        <option>
                          Other Recovery
                        </option>
                      </select>
                    </label>

                    <label>
                      Recovery Amount *
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={recoveryAmount}
                        onChange={(event) =>
                          setRecoveryAmount(
                            event.target.value
                          )
                        }
                        placeholder="Enter amount"
                      />
                    </label>

                    <label>
                      Recovery Month
                      <input
                        type="month"
                        value={payrollMonth}
                        readOnly
                      />
                    </label>

                    <label>
                      Reason / Reference *
                      <input
                        value={recoveryReason}
                        onChange={(event) =>
                          setRecoveryReason(
                            event.target.value
                          )
                        }
                        placeholder="Enter recovery reason"
                      />
                    </label>
                  </div>
                )}

                <div
                  style={{
                    display:
                      deductionType === "Food Deduction"
                        ? "none"
                        : "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "22px",
                    paddingTop: "18px",
                    borderTop: "1px solid #e2ebf2",
                  }}
                >
                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={closeDeductionForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="payroll-primary-btn"
                    onClick={saveDeduction}
                  >
                    {editingDeductionId
                      ? "Update Deduction"
                      : "Save Deduction"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      );
  };

  const renderOt = () => {
      const currentOTEntries =
        otEntries.filter(
          (item) => item.payrollMonth === payrollMonth
        );

      const currentArrears =
        arrearEntries.filter(
          (item) => item.payrollMonth === payrollMonth
        );

      const totalWeekdayOT =
        currentOTEntries.reduce(
          (sum, item) =>
            sum + Number(item.weekdayAmount || 0),
          0
        );

      const totalSundayOT =
        currentOTEntries.reduce(
          (sum, item) =>
            sum +
            Number(
              item.sundayHolidayAmount || 0
            ),
          0
        );

      const totalOT =
        currentOTEntries.reduce(
          (sum, item) =>
            sum + Number(item.totalAmount || 0),
          0
        );

      const totalArrear =
        currentArrears.reduce(
          (sum, item) =>
            sum +
            (item.adjustmentMode === "Reduction"
              ? -Number(item.amount || 0)
              : Number(item.amount || 0)),
          0
        );

      return (
        <>
          <section className="payroll-card payroll-full-card">
            <div className="payroll-card-head">
              <div>
                <small className="payroll-eyebrow">
                  ADDITIONAL PAY
                </small>
                <h2>OT & Arrear</h2>
                <p>
                  Manage overtime slabs and arrear adjustments
                  before final payroll.
                </p>
              </div>

              <button
                className="payroll-primary-btn"
                type="button"
                onClick={() => openArrearForm("Adjustment")}
              >
                + Add New
              </button>
            </div>

            <div className="payroll-module-grid">
              {[
                ["OT 1.5x", "Weekday overtime", "1.5"],
                ["OT 2.0x", "Sunday / holiday overtime", "2.0"],
                ["Arrear", "Previous period adjustment", "AR"],
                ["Adjustment", "Approved payroll adjustment", "AD"],
              ].map(([name, detail, icon]) => (
                <div
                  className="payroll-module-card"
                  key={name}
                >
                  <span>{icon}</span>

                  <div>
                    <strong>{name}</strong>
                    <small>{detail}</small>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      name === "Arrear" ||
                      name === "Adjustment"
                        ? openArrearForm(name)
                        : openOTForm(name)
                    }
                  >
                    Configure →
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4,minmax(0,1fr))",
                gap: "12px",
                marginTop: "18px",
              }}
            >
              <div className="payroll-stat-card blue">
                <span>OT 1.5x</span>
                <strong>{money(totalWeekdayOT)}</strong>
                <small>Weekday overtime</small>
              </div>

              <div className="payroll-stat-card orange">
                <span>OT 2.0x</span>
                <strong>{money(totalSundayOT)}</strong>
                <small>Sunday / holiday</small>
              </div>

              <div className="payroll-stat-card green">
                <span>Total OT</span>
                <strong>{money(totalOT)}</strong>
                <small>Current payroll month</small>
              </div>

              <div className="payroll-stat-card purple">
                <span>Arrear / Adjustment</span>
                <strong>{money(totalArrear)}</strong>
                <small>Net additional pay</small>
              </div>
            </div>
          </section>

          <section
            className="payroll-card payroll-full-card"
            style={{ marginTop: "16px" }}
          >
            <div className="payroll-card-head">
              <div>
                <small className="payroll-eyebrow">
                  OVERTIME REGISTER
                </small>
                <h2>Monthly OT Register</h2>
                <p>
                  Enter OT hours manually and let HRMS calculate
                  the payable OT amount.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="payroll-secondary-btn"
                  onClick={openBulkOT}
                >
                  ⇧ Import OT
                </button>
                <button
                  type="button"
                  className="payroll-primary-btn"
                  onClick={() => openOTForm("OT 1.5x")}
                >
                  + Add OT Entry
                </button>
              </div>
            </div>

            <div className="payroll-table-scroll">
              <table className="payroll-register-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Site</th>
                    <th>Weekday Hrs</th>
                    <th>Sunday / Holiday Hrs</th>
                    <th>Hourly Rate</th>
                    <th>OT 1.5x</th>
                    <th>OT 2.0x</th>
                    <th>Total OT</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {currentOTEntries.length === 0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        style={{
                          textAlign: "center",
                          padding: "30px 10px",
                          color: "#71879a",
                        }}
                      >
                        No OT entries configured for {payrollMonth}.
                      </td>
                    </tr>
                  ) : (
                    currentOTEntries.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.employeeName}
                          </strong>
                          <small>
                            {item.employeeId} ·{" "}
                            {item.employeeType}
                          </small>
                        </td>
                        <td>{item.site || "—"}</td>
                        <td>{item.weekdayHours}</td>
                        <td>
                          {item.sundayHolidayHours}
                        </td>
                        <td>
                          {money(item.hourlyRate)}
                        </td>
                        <td>
                          {money(item.weekdayAmount)}
                        </td>
                        <td>
                          {money(
                            item.sundayHolidayAmount
                          )}
                        </td>
                        <td>
                          <strong>
                            {money(item.totalAmount)}
                          </strong>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="payroll-link-btn"
                              onClick={() =>
                                editOTEntry(item)
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="payroll-link-btn"
                              onClick={() =>
                                deleteOTEntry(item.id)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className="payroll-card payroll-full-card"
            style={{ marginTop: "16px" }}
          >
            <div className="payroll-card-head">
              <div>
                <small className="payroll-eyebrow">
                  ARREAR & ADJUSTMENT REGISTER
                </small>
                <h2>Arrear & Adjustment</h2>
                <p>
                  Maintain previous-period arrears and approved
                  payroll adjustments separately from overtime.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="payroll-secondary-btn"
                  onClick={openBulkArrear}
                >
                  ⇧ Import Arrear
                </button>

                <button
                  type="button"
                  className="payroll-primary-btn"
                  onClick={() => openArrearForm("Arrear")}
                >
                  + Add Arrear
                </button>
              </div>
            </div>

            <div className="payroll-table-scroll">
              <table className="payroll-register-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Previous Month</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Reason</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {currentArrears.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        style={{
                          textAlign: "center",
                          padding: "30px 10px",
                          color: "#71879a",
                        }}
                      >
                        No arrear or adjustment entries configured
                        for {payrollMonth}.
                      </td>
                    </tr>
                  ) : (
                    currentArrears.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.employeeName}
                          </strong>
                          <small>
                            {item.employeeId} · {item.site}
                          </small>
                        </td>
                        <td>
                          <span className="type-pill roll">
                            {item.type}
                          </span>
                        </td>
                        <td>
                          {item.previousMonth || "—"}
                        </td>
                        <td>
                          <strong>
                            {money(item.amount)}
                          </strong>
                        </td>
                        <td>
                          {item.type === "Adjustment"
                            ? item.adjustmentMode
                            : "Addition"}
                        </td>
                        <td>
                          {item.reason || "—"}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="payroll-link-btn"
                              onClick={() =>
                                editArrearEntry(item)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="payroll-link-btn"
                              onClick={() =>
                                deleteArrearEntry(item.id)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {showBulkOT && (
            <div
              onMouseDown={closeBulkOT}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1250,
                background: "rgba(18,42,61,.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
              }}
            >
              <div
                onMouseDown={(event) => event.stopPropagation()}
                style={{
                  width: "min(1080px, calc(100vw - 48px))",
                  maxHeight: "92vh",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: "16px",
                  border: "1px solid #dce8f1",
                  boxShadow: "0 20px 60px rgba(18,42,61,.18)",
                  padding: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <small className="payroll-eyebrow">
                      BULK OT IMPORT
                    </small>
                    <h2
                      style={{
                        margin: "5px 0 4px",
                        color: "#173b5d",
                        fontSize: "24px",
                        lineHeight: 1.2,
                      }}
                    >
                      Import OT Hours
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: "#71879a",
                        fontSize: "12px",
                        lineHeight: 1.5,
                      }}
                    >
                      Upload the HRMS OT Excel template and import
                      employee-wise OT hours in bulk.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeBulkOT}
                    style={{
                      border: 0,
                      background: "#eef5fa",
                      width: "36px",
                      height: "36px",
                      borderRadius: "9px",
                      cursor: "pointer",
                      fontSize: "19px",
                      color: "#557087",
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    border: "1px solid #d9e7f1",
                    borderRadius: "10px",
                    background: "#f7fbfe",
                    marginBottom: "16px",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "#173b5d",
                      fontSize: "12px",
                      marginBottom: "3px",
                    }}
                  >
                    Import only OT hours
                  </strong>
                  <span
                    style={{
                      display: "block",
                      color: "#71879a",
                      fontSize: "10px",
                      lineHeight: 1.45,
                    }}
                  >
                    Employee name and site are taken automatically from
                    the HRMS master. Blank OT hours are treated as 0.
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1.15fr 1fr 1fr 1fr 210px",
                    gap: "12px",
                    alignItems: "start",
                    marginBottom: "16px",
                  }}
                >
                  {[
                    {
                      label: "Payroll Month",
                      node: (
                        <input
                          type="month"
                          value={bulkOTImportMonth}
                          onChange={(e) =>
                            setBulkOTImportMonth(e.target.value)
                          }
                          style={{
  width: "100%",
  minHeight: "40px",
  height: "40px",
  boxSizing: "border-box",
  border: "1px solid #d5e1ea",
  borderRadius: "8px",
  background: "#fff",
  color: "#35566e",
  padding: "0 12px",
  outline: "none",
  fontSize: "12px",
  fontWeight: 500,
}}
                        />
                      ),
                    },
                    {
                      label: "Wage Basis",
                      node: (
                        <select
                          value={bulkOTWageBasis}
                          onChange={(e) =>
                            setBulkOTWageBasis(e.target.value)
                          }
                          style={{
  width: "100%",
  minHeight: "40px",
  height: "40px",
  boxSizing: "border-box",
  border: "1px solid #d5e1ea",
  borderRadius: "8px",
  background: "#fff",
  color: "#35566e",
  padding: "0 12px",
  outline: "none",
  fontSize: "12px",
  fontWeight: 500,
}}
                        >
                          <option>Basic + DA</option>
                          <option>Gross</option>
                        </select>
                      ),
                    },
                    {
                      label: "Day Basis",
                      node: (
                        <select
                          value={bulkOTDayBasis}
                          onChange={(e) =>
                            setBulkOTDayBasis(e.target.value)
                          }
                          style={{
  width: "100%",
  minHeight: "40px",
  height: "40px",
  boxSizing: "border-box",
  border: "1px solid #d5e1ea",
  borderRadius: "8px",
  background: "#fff",
  color: "#35566e",
  padding: "0 12px",
  outline: "none",
  fontSize: "12px",
  fontWeight: 500,
}}
                        >
                          <option value="26">26 Days</option>
                          <option value="30">30 Days</option>
                          <option value="31">31 Days</option>
                        </select>
                      ),
                    },
                    {
                      label: "Hours / Day",
                      node: (
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={bulkOTHoursPerDay}
                          onChange={(e) =>
                            setBulkOTHoursPerDay(e.target.value)
                          }
                          style={{
  width: "100%",
  minHeight: "40px",
  height: "40px",
  boxSizing: "border-box",
  border: "1px solid #d5e1ea",
  borderRadius: "8px",
  background: "#fff",
  color: "#35566e",
  padding: "0 12px",
  outline: "none",
  fontSize: "12px",
  fontWeight: 500,
}}
                        />
                      ),
                    },
                  ].map((field) => (
                    <label
                      key={field.label}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        minWidth: 0,
                        color: "#173b5d",
                        fontSize: "10px",
                        fontWeight: 700,
                      }}
                    >
                      <span>{field.label}</span>
                      <div
                        style={{
                          width: "100%",
                          minHeight: "40px",
                        }}
                      >
                        {field.node}
                      </div>
                    </label>
                  ))}

                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={downloadOTTemplate}
                    style={{
                      width: "100%",
                      minHeight: "40px",
                      height: "40px",
                      boxSizing: "border-box",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      marginTop: "16.5px",
                    }}
                  >
                    ↓ Download Template
                  </button>
                </div>

                <div
                  style={{
                    border: "1px dashed #cbdde9",
                    borderRadius: "11px",
                    background: "#f8fbfe",
                    padding: "18px",
                    textAlign: "center",
                    marginBottom: "14px",
                  }}
                >
                  <input
                    id="bulk-ot-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={processBulkOTFile}
                    style={{ display: "none" }}
                  />

                  <label
                    htmlFor="bulk-ot-upload"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "40px",
                      padding: "0 18px",
                      borderRadius: "8px",
                      background: "#0f69ad",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    Choose OT Excel File
                  </label>

                  <div
                    style={{
                      marginTop: "8px",
                      color: "#71879a",
                      fontSize: "10px",
                    }}
                  >
                    {bulkOTFileName || "Excel file not selected"}
                  </div>
                </div>

                {bulkOTErrors.length > 0 && (
                  <div
                    style={{
                      marginBottom: "14px",
                      padding: "12px 14px",
                      border: "1px solid #f0c4c4",
                      background: "#fff6f6",
                      borderRadius: "10px",
                      color: "#a33c3c",
                      fontSize: "11px",
                    }}
                  >
                    <strong>Import validation errors</strong>
                    <div
                      style={{
                        display: "grid",
                        gap: "4px",
                        marginTop: "7px",
                      }}
                    >
                      {bulkOTErrors.slice(0, 10).map((error, index) => (
                        <span key={index}>• {error}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    border: "1px solid #d7e5ee",
                    borderRadius: "10px",
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1.6fr 1.25fr .8fr .8fr 1fr",
                      gap: "8px",
                      alignItems: "center",
                      padding: "10px 12px",
                      background: "#eef5fa",
                      color: "#527087",
                      fontSize: "9px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".03em",
                    }}
                  >
                    <span>Employee</span>
                    <span>Site</span>
                    <span>OT 1.5x</span>
                    <span>OT 2.0x</span>
                    <span>Total OT</span>
                  </div>

                  {bulkOTRows.length === 0 ? (
                    <div
                      style={{
                        padding: "30px 12px",
                        textAlign: "center",
                        color: "#71879a",
                        fontSize: "12px",
                      }}
                    >
                      Upload an OT Excel file to preview calculations.
                    </div>
                  ) : (
                    bulkOTRows.map((item) => (
                      <div
                        key={`${item.employee.id}-${item.rowNumber}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1.6fr 1.25fr .8fr .8fr 1fr",
                          gap: "8px",
                          padding: "9px 12px",
                          borderTop: "1px solid #edf2f6",
                          alignItems: "center",
                          fontSize: "11px",
                        }}
                      >
                        <span>
                          <strong
                            style={{
                              display: "block",
                              color: "#173b5d",
                            }}
                          >
                            {item.employee.name}
                          </strong>
                          <small style={{ color: "#8296a5" }}>
                            {getEmployeeCode(item.employee)}
                          </small>
                        </span>
                        <span>{item.employee.site || "—"}</span>
                        <span>{item.weekdayHours}</span>
                        <span>{item.sundayHours}</span>
                        <strong>{money(item.totalAmount)}</strong>
                      </div>
                    ))
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "18px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e2ebf2",
                  }}
                >
                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={closeBulkOT}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="payroll-primary-btn"
                    disabled={
                      !bulkOTRows.length ||
                      bulkOTErrors.length > 0
                    }
                    onClick={saveBulkOTEntries}
                  >
                    Import & Calculate
                  </button>
                </div>
              </div>
            </div>
          )}

          {showOTForm && (
            <div
              onMouseDown={closeOTForm}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1200,
                background: "rgba(18,42,61,.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
              }}
            >
              <div
                onMouseDown={(event) => event.stopPropagation()}
                style={{
                  width: "min(980px, calc(100vw - 48px))",
                  maxHeight: "92vh",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: "16px",
                  border: "1px solid #dce8f1",
                  boxShadow: "0 20px 60px rgba(18,42,61,.18)",
                  padding: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <small className="payroll-eyebrow">OT CONFIGURATION</small>
                    <h2
                      style={{
                        margin: "5px 0 4px",
                        color: "#173b5d",
                        fontSize: "24px",
                        lineHeight: 1.2,
                      }}
                    >
                      {editingOTId ? "Edit OT Entry" : `Add ${otFormType}`}
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: "#71879a",
                        fontSize: "12px",
                      }}
                    >
                      Weekday overtime uses OT 1.5x and Sunday / holiday overtime uses OT 2.0x.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeOTForm}
                    style={{
                      border: 0,
                      background: "#eef5fa",
                      width: "36px",
                      height: "36px",
                      borderRadius: "9px",
                      cursor: "pointer",
                      fontSize: "20px",
                      color: "#557087",
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                    gap: "14px",
                    alignItems: "start",
                  }}
                >
                  {[
                    {
                      label: "Employee *",
                      node: (
                        <select
                          value={otEmployeeId}
                          onChange={(e) => setOTEmployeeId(e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        >
                          <option value="">Select Employee</option>
                          {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name} ({getEmployeeCode(employee)})
                            </option>
                          ))}
                        </select>
                      ),
                    },
                    {
                      label: "Payroll Month *",
                      node: (
                        <input
                          type="month"
                          value={otMonth}
                          onChange={(e) => setOTMonth(e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      ),
                    },
                    {
                      label: "Wage Basis",
                      node: (
                        <select
                          value={otWageBasis}
                          onChange={(e) => setOTWageBasis(e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        >
                          <option>Basic + DA</option>
                          <option>Gross</option>
                          <option>Manual Hourly Rate</option>
                        </select>
                      ),
                    },
                    {
                      label: "OT 1.5x Multiplier",
                      node: (
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={otMultiplier}
                          onChange={(e) => setOTMultiplier(e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      ),
                    },
                    {
                      label: "OT 2.0x Multiplier",
                      node: (
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={otMultiplier2}
                          onChange={(e) => setOTMultiplier2(e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      ),
                    },
                    {
                      label: "Day Basis",
                      node: (
                        <select
                          value={otDayBasis}
                          onChange={(e) => setOTDayBasis(e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        >
                          <option value="26">26 Days</option>
                          <option value="30">30 Days</option>
                          <option value="31">31 Days</option>
                        </select>
                      ),
                    },
                    {
                      label: "Hours / Day",
                      node: (
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={otHoursPerDay}
                          onChange={(e) => setOTHoursPerDay(e.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      ),
                    },
                    {
                      label: "Weekday OT Hours",
                      node: (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={otWeekdayHours}
                          onChange={(e) => setOTWeekdayHours(e.target.value)}
                          placeholder="Enter hours"
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      ),
                    },
                    {
                      label: "Sunday / Holiday OT Hours",
                      node: (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={otSundayHours}
                          onChange={(e) => setOTSundayHours(e.target.value)}
                          placeholder="Enter hours"
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      ),
                    },
                  ].map(({ label, node }) => (
                    <label
                      key={label}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        color: "#173b5d",
                        fontSize: "10px",
                        fontWeight: 700,
                        minWidth: 0,
                      }}
                    >
                      <span>{label}</span>
                      {node}
                    </label>
                  ))}

                  {otWageBasis === "Manual Hourly Rate" && (
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        color: "#173b5d",
                        fontSize: "10px",
                        fontWeight: 700,
                      }}
                    >
                      <span>Manual Hourly Rate *</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={otManualHourlyRate}
                        onChange={(e) => setOTManualHourlyRate(e.target.value)}
                        placeholder="Enter hourly rate"
                        style={{
                          width: "100%",
                          minHeight: "42px",
                          boxSizing: "border-box",
                          border: "1px solid #d4e1ea",
                          borderRadius: "8px",
                          background: "#fff",
                          color: "#35566e",
                          padding: "0 12px",
                          outline: "none",
                          fontSize: "12px",
                        }}
                      />
                    </label>
                  )}
                </div>

                {selectedOTEmployee && (
                  <div
                    style={{
                      marginTop: "16px",
                      border: "1px solid #d6e5ef",
                      borderRadius: "10px",
                      background: "#f7fbfe",
                      padding: "13px 15px",
                    }}
                  >
                    <div
                      style={{
                        color: "#174a72",
                        fontSize: "11px",
                        fontWeight: 700,
                        marginBottom: "5px",
                      }}
                    >
                      OT Calculation Preview
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(4,minmax(0,1fr))",
                        gap: "10px",
                      }}
                    >
                      {[
                        [
                          "Hourly Rate",
                          calculateOTAmounts(selectedOTEmployee).hourlyRate,
                        ],
                        [
                          "OT 1.5x",
                          calculateOTAmounts(selectedOTEmployee).weekdayAmount,
                        ],
                        [
                          "OT 2.0x",
                          calculateOTAmounts(selectedOTEmployee).sundayAmount,
                        ],
                        [
                          "Total OT",
                          calculateOTAmounts(selectedOTEmployee).total,
                        ],
                      ].map(([label, amount]) => (
                        <div
                          key={label}
                          style={{
                            background: "#fff",
                            border: "1px solid #dce8f1",
                            borderRadius: "8px",
                            padding: "9px 10px",
                          }}
                        >
                          <span
                            style={{
                              display: "block",
                              color: "#71879a",
                              fontSize: "9px",
                              marginBottom: "3px",
                            }}
                          >
                            {label}
                          </span>
                          <strong
                            style={{
                              color: "#173b5d",
                              fontSize: "13px",
                            }}
                          >
                            {money(amount)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "20px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e2ebf2",
                  }}
                >
                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={closeOTForm}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="payroll-primary-btn"
                    onClick={saveOTEntry}
                  >
                    {editingOTId ? "Update OT Entry" : "Save OT Entry"}
                  </button>
                </div>
              </div>
            </div>
          )}


          {showBulkArrear && (
            <div
              onMouseDown={closeBulkArrear}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1240,
                background: "rgba(18,42,61,.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
              }}
            >
              <div
                onMouseDown={(event) => event.stopPropagation()}
                style={{
                  width: "min(1120px, calc(100vw - 48px))",
                  maxHeight: "92vh",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: "16px",
                  border: "1px solid #dce8f1",
                  boxShadow: "0 20px 60px rgba(18,42,61,.18)",
                  padding: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <small className="payroll-eyebrow">
                      BULK ARREAR IMPORT
                    </small>
                    <h2
                      style={{
                        margin: "5px 0 4px",
                        color: "#173b5d",
                        fontSize: "24px",
                        lineHeight: 1.2,
                      }}
                    >
                      Import Arrear
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: "#71879a",
                        fontSize: "12px",
                        lineHeight: 1.5,
                      }}
                    >
                      Upload multiple employee arrears in one Excel
                      file and verify the data before importing.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeBulkArrear}
                    style={{
                      border: 0,
                      background: "#eef5fa",
                      width: "36px",
                      height: "36px",
                      borderRadius: "9px",
                      cursor: "pointer",
                      fontSize: "19px",
                      color: "#557087",
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    border: "1px solid #d9e7f1",
                    borderRadius: "10px",
                    background: "#f7fbfe",
                    marginBottom: "16px",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "#173b5d",
                      fontSize: "12px",
                      marginBottom: "3px",
                    }}
                  >
                    Bulk arrear upload
                  </strong>
                  <span
                    style={{
                      display: "block",
                      color: "#71879a",
                      fontSize: "10px",
                      lineHeight: 1.45,
                    }}
                  >
                    Excel columns: Employee Code, Employee Name, DOJ,
                    Vendor Name, Site Name and Arrear Amount.
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 210px",
                    gap: "12px",
                    alignItems: "start",
                    marginBottom: "16px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      color: "#173b5d",
                      fontSize: "10px",
                      fontWeight: 700,
                      width: "100%",
                      minWidth: 0,
                    }}
                  >
                    <span>Payroll Month</span>
                    <input
                      type="month"
                      value={bulkArrearMonth}
                      onChange={(e) =>
                        setBulkArrearMonth(e.target.value)
                      }
                      style={{
  width: "100%",
  minHeight: "40px",
  height: "40px",
  boxSizing: "border-box",
  border: "1px solid #d5e1ea",
  borderRadius: "8px",
  background: "#fff",
  color: "#35566e",
  padding: "0 12px",
  outline: "none",
  fontSize: "12px",
  fontWeight: 500,
}}
                    />
                  </label>

                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      color: "#173b5d",
                      fontSize: "10px",
                      fontWeight: 700,
                      width: "100%",
                      minWidth: 0,
                    }}
                  >
                    <span>Arrear Period</span>
                    <input
                      type="month"
                      value={bulkArrearPeriod}
                      onChange={(e) =>
                        setBulkArrearPeriod(e.target.value)
                      }
                      style={{
  width: "100%",
  minHeight: "40px",
  height: "40px",
  boxSizing: "border-box",
  border: "1px solid #d5e1ea",
  borderRadius: "8px",
  background: "#fff",
  color: "#35566e",
  padding: "0 12px",
  outline: "none",
  fontSize: "12px",
  fontWeight: 500,
}}
                    />
                  </label>

                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={downloadArrearTemplate}
                    style={{
                      width: "100%",
                      minHeight: "40px",
                      height: "40px",
                      boxSizing: "border-box",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      marginTop: "18px",
                    }}
                  >
                    ↓ Download Template
                  </button>
                </div>

                <div
                  style={{
                    border: "1px dashed #cbdde9",
                    borderRadius: "11px",
                    background: "#f8fbfe",
                    padding: "18px",
                    textAlign: "center",
                    marginBottom: "14px",
                  }}
                >
                  <input
                    id="bulk-arrear-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={processBulkArrearFile}
                    style={{ display: "none" }}
                  />

                  <label
                    htmlFor="bulk-arrear-upload"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "40px",
                      padding: "0 18px",
                      borderRadius: "8px",
                      background: "#0f69ad",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    Choose Arrear Excel File
                  </label>

                  <div
                    style={{
                      marginTop: "8px",
                      color: "#71879a",
                      fontSize: "10px",
                    }}
                  >
                    {bulkArrearFileName || "Excel file not selected"}
                  </div>
                </div>

                {bulkArrearErrors.length > 0 && (
                  <div
                    style={{
                      marginBottom: "14px",
                      padding: "12px 14px",
                      border: "1px solid #f0c4c4",
                      background: "#fff6f6",
                      borderRadius: "10px",
                      color: "#a33c3c",
                      fontSize: "11px",
                    }}
                  >
                    <strong>Import validation errors</strong>
                    <div
                      style={{
                        display: "grid",
                        gap: "4px",
                        marginTop: "7px",
                      }}
                    >
                      {bulkArrearErrors
                        .slice(0, 12)
                        .map((error, index) => (
                          <span key={index}>• {error}</span>
                        ))}
                    </div>
                    {bulkArrearErrors.length > 12 && (
                      <small
                        style={{
                          display: "block",
                          marginTop: "6px",
                        }}
                      >
                        + {bulkArrearErrors.length - 12} more errors
                      </small>
                    )}
                  </div>
                )}

                <div
                  style={{
                    border: "1px solid #d7e5ee",
                    borderRadius: "10px",
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1fr 1.35fr 1fr 1fr 1fr 1.05fr",
                      gap: "8px",
                      alignItems: "center",
                      padding: "10px 12px",
                      background: "#eef5fa",
                      color: "#527087",
                      fontSize: "9px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".03em",
                    }}
                  >
                    <span>Employee Code</span>
                    <span>Employee Name</span>
                    <span>DOJ</span>
                    <span>Vendor</span>
                    <span>Site</span>
                    <span>Arrear Amount</span>
                  </div>

                  {bulkArrearRows.length === 0 ? (
                    <div
                      style={{
                        padding: "30px 12px",
                        textAlign: "center",
                        color: "#71879a",
                        fontSize: "12px",
                      }}
                    >
                      Upload an arrear Excel file to preview the
                      employee-wise arrear amounts.
                    </div>
                  ) : (
                    bulkArrearRows.map((item) => (
                      <div
                        key={`${item.employee.id}-${item.rowNumber}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1fr 1.35fr 1fr 1fr 1fr 1.05fr",
                          gap: "8px",
                          padding: "9px 12px",
                          borderTop: "1px solid #edf2f6",
                          alignItems: "center",
                          fontSize: "10px",
                        }}
                      >
                        <span>{item.employeeCode}</span>
                        <strong
                          style={{
                            color: "#173b5d",
                          }}
                        >
                          {item.employeeName}
                        </strong>
                        <span>{item.doj || "—"}</span>
                        <span>{item.vendor || "—"}</span>
                        <span>{item.site || "—"}</span>
                        <strong>{money(item.amount)}</strong>
                      </div>
                    ))
                  )}
                </div>

                {bulkArrearRows.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginTop: "12px",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "#f8fbfe",
                        border: "1px solid #dbe7ef",
                        borderRadius: "9px",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#71879a",
                          fontSize: "9px",
                          fontWeight: 700,
                          marginBottom: "3px",
                        }}
                      >
                        VALID EMPLOYEES
                      </span>
                      <strong
                        style={{
                          color: "#174a72",
                          fontSize: "16px",
                        }}
                      >
                        {bulkArrearRows.length}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: "12px 14px",
                        background: "#f8fbfe",
                        border: "1px solid #dbe7ef",
                        borderRadius: "9px",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#71879a",
                          fontSize: "9px",
                          fontWeight: 700,
                          marginBottom: "3px",
                        }}
                      >
                        TOTAL ARREAR
                      </span>
                      <strong
                        style={{
                          color: "#198754",
                          fontSize: "16px",
                        }}
                      >
                        {money(
                          bulkArrearRows.reduce(
                            (sum, item) =>
                              sum + Number(item.amount || 0),
                            0
                          )
                        )}
                      </strong>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "18px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e2ebf2",
                  }}
                >
                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={closeBulkArrear}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="payroll-primary-btn"
                    disabled={
                      !bulkArrearRows.length ||
                      bulkArrearErrors.length > 0
                    }
                    onClick={saveBulkArrearEntries}
                  >
                    Import Arrear
                  </button>
                </div>
              </div>
            </div>
          )}

          {showArrearForm && (
            <div
              onMouseDown={closeArrearForm}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1200,
                background: "rgba(18,42,61,.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
              }}
            >
              <div
                onMouseDown={(event) => event.stopPropagation()}
                style={{
                  width: "min(760px, calc(100vw - 48px))",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: "16px",
                  border: "1px solid #dce8f1",
                  boxShadow: "0 20px 60px rgba(18,42,61,.18)",
                  padding: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <small className="payroll-eyebrow">ADDITIONAL PAY</small>
                    <h2
                      style={{
                        margin: "5px 0 4px",
                        color: "#173b5d",
                        fontSize: "24px",
                        lineHeight: 1.2,
                      }}
                    >
                      {editingArrearId
                        ? `Edit ${arrearType}`
                        : `Add ${arrearType}`}
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: "#71879a",
                        fontSize: "12px",
                      }}
                    >
                      Keep previous-period arrears and approved adjustments separately.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeArrearForm}
                    style={{
                      border: 0,
                      background: "#eef5fa",
                      width: "36px",
                      height: "36px",
                      borderRadius: "9px",
                      cursor: "pointer",
                      fontSize: "20px",
                      color: "#557087",
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2,minmax(0,1fr))",
                    gap: "14px",
                    alignItems: "start",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      color: "#173b5d",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    <span>Employee *</span>
                    <select
                      value={arrearEmployeeId}
                      onChange={(e) =>
                        setArrearEmployeeId(e.target.value)
                      }
                      style={{
                        width: "100%",
                        minHeight: "42px",
                        boxSizing: "border-box",
                        border: "1px solid #d4e1ea",
                        borderRadius: "8px",
                        background: "#fff",
                        color: "#35566e",
                        padding: "0 12px",
                        outline: "none",
                        fontSize: "12px",
                      }}
                    >
                      <option value="">Select Employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} ({getEmployeeCode(employee)})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      color: "#173b5d",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    <span>Payroll Month</span>
                    <input
                      type="month"
                      value={payrollMonth}
                      readOnly
                      style={{
                        width: "100%",
                        minHeight: "42px",
                        boxSizing: "border-box",
                        border: "1px solid #d4e1ea",
                        borderRadius: "8px",
                        background: "#f8fbfe",
                        color: "#547085",
                        padding: "0 12px",
                        outline: "none",
                        fontSize: "12px",
                      }}
                    />
                  </label>

                  {arrearType === "Arrear" && (
                    <>
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          color: "#173b5d",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        <span>Previous Period *</span>
                        <input
                          type="month"
                          value={arrearMonth}
                          onChange={(e) =>
                            setArrearMonth(e.target.value)
                          }
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      </label>

                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          color: "#173b5d",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        <span>Arrear Amount *</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={arrearAmount}
                          onChange={(e) =>
                            setArrearAmount(e.target.value)
                          }
                          placeholder="Enter arrear amount"
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      </label>

                      <label
                        style={{
                          gridColumn: "1 / -1",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          color: "#173b5d",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        <span>Reason *</span>
                        <input
                          value={arrearReason}
                          onChange={(e) =>
                            setArrearReason(e.target.value)
                          }
                          placeholder="e.g. Salary revision arrear"
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      </label>
                    </>
                  )}

                  {arrearType === "Adjustment" && (
                    <>
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          color: "#173b5d",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        <span>Adjustment Mode *</span>
                        <select
                          value={adjustmentMode}
                          onChange={(e) =>
                            setAdjustmentMode(e.target.value)
                          }
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        >
                          <option>Addition</option>
                          <option>Reduction</option>
                        </select>
                      </label>

                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          color: "#173b5d",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        <span>Adjustment Amount *</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={adjustmentAmount}
                          onChange={(e) => {
                            setAdjustmentAmount(e.target.value);
                            setArrearAmount(e.target.value);
                          }}
                          placeholder="Enter amount"
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      </label>

                      <label
                        style={{
                          gridColumn: "1 / -1",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          color: "#173b5d",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        <span>Reason / Approval Reference *</span>
                        <input
                          value={adjustmentReason}
                          onChange={(e) => {
                            setAdjustmentReason(e.target.value);
                            setArrearReason(e.target.value);
                          }}
                          placeholder="Enter approved payroll adjustment reason"
                          style={{
                            width: "100%",
                            minHeight: "42px",
                            boxSizing: "border-box",
                            border: "1px solid #d4e1ea",
                            borderRadius: "8px",
                            background: "#fff",
                            color: "#35566e",
                            padding: "0 12px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    border: "1px solid #d6e5ef",
                    borderRadius: "10px",
                    background: "#f7fbfe",
                    padding: "13px 15px",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "#174a72",
                      fontSize: "11px",
                      marginBottom: "4px",
                    }}
                  >
                    {arrearType === "Adjustment"
                      ? "Adjustment Preview"
                      : "Arrear Preview"}
                  </strong>
                  <span
                    style={{
                      color: "#71879a",
                      fontSize: "11px",
                    }}
                  >
                    {arrearType === "Adjustment" &&
                    adjustmentMode === "Reduction"
                      ? "This amount will reduce additional pay."
                      : "This amount will be added to the current payroll cycle."}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "20px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e2ebf2",
                  }}
                >
                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={closeArrearForm}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="payroll-primary-btn"
                    onClick={saveArrearEntry}
                  >
                    {editingArrearId
                      ? "Update Entry"
                      : `Save ${arrearType}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
  };

  const renderPayrollRun = () => (
    <section className="payroll-card payroll-full-card"><div className="payroll-card-head"><div><small className="payroll-eyebrow">STEP 01 · PAYROLL RUN</small><h2>Payroll Run</h2><p>Create and control one monthly payroll cycle from start to finish.</p></div><button type="button" className="payroll-primary-btn" onClick={createOrOpenPayrollRun} disabled={payrollControl.locked}>{payrollRun?"Open Run":"Create Payroll Run"}</button></div>
      <div className="payroll-run-header-grid"><div><span>Payroll Run</span><strong>{payrollRun?.id||`PAY-${String(payrollMonth).replace("-","")}`}</strong></div><div><span>Payroll Month</span><strong>{getPayrollMonthLabel()}</strong></div><div><span>Employees</span><strong>{employees.length}</strong></div><div><span>Status</span><strong>{payrollProcessingStatus}</strong></div></div>
      <div className="payroll-sequence-card"><div className="sequence-title"><strong>Monthly Payroll Sequence</strong><small>Complete each stage in order. Locked months cannot be recalculated.</small></div>{[["01","Payroll Inputs","Attendance, salary, OT, arrear, deductions, IT declaration and third-party inputs.","inputs",true],["02","Payroll Calculation","Calculate employee-wise earnings, statutory deductions and net pay.","calculation",processedPayroll.length>0],["03","Validation & Approval","Review exceptions and approve the calculated payroll.","validation",["Finalized","Locked","Salary Released"].includes(payrollProcessingStatus)],["04","Payroll Lock","Freeze the month before salary release.","payroll-control",payrollControl.locked],["05","Salary Release","Release salary and make payslips available.","salary-release",salaryReleaseState.released]].map(([no,title,desc,target,done])=><button type="button" key={no} className={`payroll-sequence-row ${done?"done":""}`} onClick={()=>setActiveSection(target)}><span className="sequence-number">{no}</span><div><strong>{title}</strong><small>{desc}</small></div><b>{done?"✓ Done":target==="inputs"?"Start":"Pending"}</b></button>)}</div>
    </section>
  );

  const renderPayrollInputs = () => {
    const cards=[["attendance","Attendance","Paid days, LOP, leave, comp-off and OT hours.","✓"],["salary","Salary Inputs","Employee-wise gross and salary components for the selected month.","₹"],["ot","OT & Arrear","Additional earnings, overtime and prior-period adjustments.","↗"],["deductions","Deductions","Loan, food, recovery and other employee deductions.","−"],["it","IT Declaration","Tax regime and employee declaration status used for TDS.","IT"],["third-party","Third Party","Vendor manpower inputs and costing for off-roll employees.","♙"]];
    if(inputSection==="attendance") return <div><button type="button" className="payroll-back-btn" onClick={()=>setInputSection("overview")}>← Back to Payroll Inputs</button>{renderMonthly()}</div>;
    if(inputSection==="salary") return <div><button type="button" className="payroll-back-btn" onClick={()=>setInputSection("overview")}>← Back to Payroll Inputs</button>{renderSalary()}</div>;
    if(inputSection==="ot") return <div><button type="button" className="payroll-back-btn" onClick={()=>setInputSection("overview")}>← Back to Payroll Inputs</button>{renderOt()}</div>;
    if(inputSection==="deductions") return <div><button type="button" className="payroll-back-btn" onClick={()=>setInputSection("overview")}>← Back to Payroll Inputs</button>{renderDeductions()}</div>;
    if(inputSection==="it") return <div><button type="button" className="payroll-back-btn" onClick={()=>setInputSection("overview")}>← Back to Payroll Inputs</button>{renderITDeclaration()}</div>;
    if(inputSection==="third-party") return <div><button type="button" className="payroll-back-btn" onClick={()=>setInputSection("overview")}>← Back to Payroll Inputs</button>{renderVendor()}</div>;
    return <section className="payroll-card payroll-full-card"><div className="payroll-card-head"><div><small className="payroll-eyebrow">STEP 02 · PAYROLL INPUTS</small><h2>Payroll Inputs</h2><p>Complete all monthly inputs before starting payroll calculation.</p></div><span className="payroll-month-chip">{getPayrollMonthLabel()}</span></div><div className="payroll-input-card-grid">{cards.map(([id,title,desc,icon])=><button type="button" className="payroll-input-card" key={id} onClick={()=>setInputSection(id)}><span>{icon}</span><div><strong>{title}</strong><small>{desc}</small></div><b>Open →</b></button>)}</div><div className="payroll-input-summary"><div><span>Employees</span><strong>{employees.length}</strong></div><div><span>Salary Ready</span><strong>{employeesWithSalary}/{employees.length}</strong></div><div><span>Attendance</span><strong>{attendanceReady?"Available":"Pending"}</strong></div><div><span>IT Declaration</span><strong>{itDeclaration.status}</strong></div></div><div className="payroll-next-action"><div><strong>Next Step</strong><small>Once inputs are complete, move to Payroll Calculation.</small></div><button type="button" className="payroll-primary-btn" onClick={()=>setActiveSection("calculation")}>Go to Calculation →</button></div></section>;
  };

  const renderPayrollCalculation = () => {
    const calculated=processedPayroll.length>0,totalGross=calculated?processedPayroll.reduce((x,r)=>x+Number(r.gross||0),0):dashboardTotalGross,totalNet=calculated?processedPayroll.reduce((x,r)=>x+Number(r.netPayable||0),0):0,totalPF=calculated?processedPayroll.reduce((x,r)=>x+Number(r.pf||0),0):0,totalESI=calculated?processedPayroll.reduce((x,r)=>x+Number(r.esi||0),0):0,totalPT=calculated?processedPayroll.reduce((x,r)=>x+Number(r.pt||0),0):0,totalLWF=calculated?processedPayroll.reduce((x,r)=>x+Number(r.lwfEmployee||0),0):0;
    return <section className="payroll-card payroll-full-card"><div className="payroll-card-head"><div><small className="payroll-eyebrow">STEP 03 · PAYROLL CALCULATION</small><h2>Payroll Calculation</h2><p>Calculate the selected month using approved organization and Policy Management rules.</p></div><button type="button" className="payroll-primary-btn" onClick={processCurrentPayroll} disabled={payrollControl.locked}>{payrollControl.locked?"Payroll Locked":calculated?"Recalculate Payroll":"Calculate Payroll"}</button></div><div className="payroll-policy-reference"><span>Rule source</span><strong>Organization & Policy Management</strong><small>Payroll only consumes approved rules. PF, ESI, PT, LWF and other policies are not configured in Payroll.</small></div><div className="payroll-calculation-cards"><div><span>Employees</span><strong>{calculated?processedPayroll.length:employees.length}</strong></div><div><span>Gross</span><strong>{money(totalGross)}</strong></div><div><span>PF</span><strong>{money(totalPF)}</strong></div><div><span>ESI</span><strong>{money(totalESI)}</strong></div><div><span>PT / LWF</span><strong>{money(totalPT+totalLWF)}</strong></div><div><span>Net Payable</span><strong>{money(totalNet)}</strong></div></div>{calculated?<><div className="payroll-card-head compact"><div><small className="payroll-eyebrow">CALCULATED REGISTER</small><h3>Employee Payroll Calculation</h3></div><span className="payroll-status processed">Calculated</span></div><div className="payroll-table-scroll"><table className="payroll-register-table"><thead><tr><th>Employee</th><th>Gross</th><th>Paid Days</th><th>LOP</th><th>OT</th><th>PF</th><th>ESI</th><th>PT</th><th>Other Ded.</th><th>Net Pay</th></tr></thead><tbody>{processedPayroll.map(r=><tr key={r.employeeId}><td><strong>{r.employeeName}</strong><small>{r.employeeCode}</small></td><td>{money(r.gross)}</td><td>{r.paidDays}</td><td>{r.lopDays}</td><td>{money(r.otAmount)}</td><td>{money(r.pf)}</td><td>{money(r.esi)}</td><td>{money(r.pt)}</td><td>{money(r.totalOtherDeductions)}</td><td><strong>{money(r.netPayable)}</strong></td></tr>)}</tbody></table></div><div className="payroll-next-action"><div><strong>Calculation complete</strong><small>Review the register, then continue to Validation & Approval.</small></div><button type="button" className="payroll-primary-btn" onClick={()=>setActiveSection("validation")}>Continue to Validation →</button></div></>:<div className="payroll-empty-state"><strong>Payroll not calculated yet</strong><span>Complete Payroll Inputs and click Calculate Payroll.</span></div>}</section>;
  };

  const renderValidationApproval = () => {
    const checks=[["Employee Master",employees.length>0,employees.length?`${employees.length} employee(s) loaded`:"No employees loaded"],["Attendance",attendanceReady,attendanceReady?"Attendance data available":"Attendance data missing"],["Salary Inputs",salaryReady,salaryReady?"All employee salary inputs are available":`${Math.max(0,employees.length-employeesWithSalary)} employee(s) missing salary`],["Payroll Calculation",processedPayroll.length>0,processedPayroll.length?`${processedPayroll.length} employee(s) calculated`:"Payroll calculation pending"],["Critical Exceptions",processedPayroll.length>0&&processedPayroll.every(r=>Number(r.gross||0)>0),processedPayroll.length?"No zero-gross calculated employees":"Calculation required"]];
    const allReady=checks.every(x=>x[1]),approved=["Finalized","Locked","Salary Released"].includes(payrollProcessingStatus);
    return <section className="payroll-card payroll-full-card"><div className="payroll-card-head"><div><small className="payroll-eyebrow">STEP 04 · VALIDATION & APPROVAL</small><h2>Payroll Validation & Approval</h2><p>Every critical payroll check must pass before the month can be approved and locked.</p></div><button type="button" className="payroll-primary-btn" disabled={!allReady||payrollControl.locked} onClick={finalizeCurrentPayroll}>{approved?"Payroll Approved":"Approve Payroll"}</button></div><div className="payroll-validation-grid">{checks.map(([label,ok,detail])=><div className={ok?"valid":"exception"} key={label}><span>{ok?"✓":"!"}</span><div><strong>{label}</strong><small>{detail}</small></div><b>{ok?"Passed":"Action Required"}</b></div>)}</div><div className="payroll-approval-summary"><div><span>Payroll Month</span><strong>{getPayrollMonthLabel()}</strong></div><div><span>Calculated</span><strong>{processedPayroll.length}</strong></div><div><span>Approval</span><strong>{approved?"Approved":"Pending"}</strong></div><div><span>Next Step</span><strong>{approved?"Payroll Lock":"Review & Approve"}</strong></div></div><div className="payroll-next-action"><div><strong>{approved?"Payroll approved":allReady?"Ready for approval":"Payroll has pending validation items"}</strong><small>{approved?"Proceed to Payroll Lock.":"Resolve all critical exceptions before approval."}</small></div><button type="button" className="payroll-secondary-btn" onClick={()=>setActiveSection("calculation")}>Back to Calculation</button></div></section>;
  };

  const renderPayslipsBank = () => <section className="payroll-card payroll-full-card"><div className="payroll-card-head"><div><small className="payroll-eyebrow">STEP 08 · EMPLOYEE PAYMENT</small><h2>Payslips & Bank</h2><p>Complete employee communication and payment processing after salary release.</p></div></div><div className="payroll-output-grid"><button type="button" className="payroll-output-card" onClick={()=>setActiveSection("payslip")}><span>▥</span><div><strong>Payslips</strong><small>Generate and release employee salary slips.</small></div><b>Open →</b></button><button type="button" className="payroll-output-card" onClick={()=>setActiveSection("bank-payment")}><span>₹</span><div><strong>Bank Payment</strong><small>Review bank transfer data and payment status.</small></div><b>Open →</b></button></div><div className="payroll-output-summary"><div><span>Payroll Status</span><strong>{payrollProcessingStatus}</strong></div><div><span>Salary Release</span><strong>{salaryReleaseState.released?"Released":"Pending"}</strong></div><div><span>Payslips</span><strong>{processedPayroll.length}</strong></div><div><span>Payment Mode</span><strong>Bank Transfer</strong></div></div></section>;

  const renderContent = () => {
    if (activeSection === "salary-register") return renderSalaryRegister();
    if (activeSection === "payslip") return renderPayslip();
    if (activeSection === "bank-payment") return renderBankPayment();
    if (activeSection === "vendor-billing") return renderVendorBilling();
    if (activeSection === "pf-esi-report") return renderPFESIReport();
    if (activeSection === "lop-report") return renderLOPReport();
    if (activeSection === "dashboard") return renderDashboard();
    if (activeSection === "run") return renderPayrollRun();
    if (activeSection === "inputs") return renderPayrollInputs();
    if (activeSection === "calculation") return renderPayrollCalculation();
    if (activeSection === "validation") return renderValidationApproval();
    if (activeSection === "payroll-control") return renderPayrollControl();
    if (activeSection === "salary-release") return renderSalaryRelease();
    if (activeSection === "payslips-bank") return renderPayslipsBank();
    if (activeSection === "monthly") return renderMonthly();
    if (activeSection === "processing") return renderProcessing();
    if (activeSection === "vendor") return renderVendor();
    if (activeSection === "salary") return renderSalary();
    if (activeSection === "deductions") return renderDeductions();
    if (activeSection === "ot") return renderOt();
    if (activeSection === "statutory") return renderPayrollCalculation();

    return renderSimpleModule("Payroll Reports", "REPORTING", "Payroll reports will use the finalized payroll register and statutory data.", [
      ["Salary Register", "Employee-wise monthly register", "▤"], ["Payslip", "Individual employee payslip", "▥"], ["Bank Payment", "Bank transfer statement", "₹"], ["Vendor Billing", "Third-party invoice costing", "♙"], ["PF / ESI Report", "Statutory report", "▣"], ["LOP Report", "Unpaid days review", "A"],
    ]);
  };

  const payrollSectionLabels = {
    "salary-register": "Salary Register",
    payslip: "Payslips",
    "bank-payment": "Bank Payment",
    "vendor-billing": "Vendor Costing",
    "pf-esi-report": "Statutory Report",
    "lop-report": "LOP Report",
  };

  return (
    <div className="payroll-page">
      <div className="payroll-page-head">
        <div>
          <div className="payroll-breadcrumb">Payroll <span>/</span> {payrollMenu.find((item) => item.id === activeSection)?.label || payrollSectionLabels[activeSection] || "Payroll Reports"}</div>
          <div className="payroll-title-row">
            <div>
              <h1>Payroll <span>Management</span></h1>
              <p>Run monthly payroll from inputs to calculation, approval, lock, salary release and reports.</p>
            </div>
            <div className="payroll-head-actions">
              <select
  value={payrollMonth}
  onChange={(e) => setPayrollMonth(e.target.value)}
>
{payrollMonthOptions.map((month) => (
  <option key={month.value} value={month.value}>
    {month.label}
  </option>
))}
</select>
              <button className="payroll-export-btn">⇩ Export</button>
            </div>
          </div>
        </div>
      </div>

      <div className="payroll-workspace">
        <aside className="payroll-subnav">
          <div className="payroll-subnav-title">PAYROLL MODULE</div>
          {payrollMenu.map((item) => (
            <button key={item.id} className={activeSection === item.id ? "active" : ""} onClick={() => setActiveSection(item.id)}>
              <span className="payroll-subnav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div className={`payroll-sidebar-status ${payrollControl.locked ? "locked" : "open"}`}>
            <span>{payrollControl.locked ? "🔒" : "✓"}</span>
            <div><strong>{payrollControl.locked ? "Payroll Locked" : "Payroll Open"}</strong><small>{getPayrollMonthLabel()} · {payrollProcessingStatus}</small></div>
          </div>
        </aside>

        <main className="payroll-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default Payroll;
