import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";



import { supabase } from "./supabaseClient";



import { loadOrganizationModuleData, saveOrganizationModuleData } from "./organizationModuleStorage";



import "./Leave.css";







const ORGANIZATION_CODE = "BAUERE";



const LEAVE_SETTINGS_KEY = "leaveManagement";



const LEAVE_TYPES = [



  { code: "EL", name: "Earned Leave", short: "EL", description: "Accrued based on the published policy." },



  { code: "PL", name: "Privilege Leave", short: "PL", description: "Privilege / planned leave marked through Attendance." },



  { code: "CL", name: "Casual Leave", short: "CL", description: "Personal or short-duration leave." },



  { code: "SL", name: "Sick Leave", short: "SL", description: "Sickness-related leave." },



  { code: "FL", name: "Force Leave", short: "FL", description: "Company-marked day; does not deduct EL, CL or SL." },



  { code: "CO", name: "Comp-Off", short: "CO", description: "Earned and utilised through CO-E / CO-U attendance entries." },



];



const BALANCE_TYPES = ["EL", "PL", "CL", "SL", "CO"];



const ATTENDANCE_LEAVE_STATUSES = ["EL", "PL", "CL", "SL"];



const DEFAULT_POLICY_TYPES = [



  { code: "EL", enabled: true, accrualFrequency: "MONTHLY", accrualBasis: "PRESENT_DAYS", credit: 1.25, minimumPresentDays: 21, annualLimit: 0, carryForwardEnabled: true, carryForwardLimit: 30, expiryEnabled: false, expiryMonths: 0, allowRequest: true, paid: true },



  { code: "PL", enabled: true, accrualFrequency: "NONE", accrualBasis: "FIXED", credit: 0, minimumPresentDays: 0, annualLimit: 0, carryForwardEnabled: true, carryForwardLimit: 0, expiryEnabled: false, expiryMonths: 0, allowRequest: true, paid: true },



  { code: "CL", enabled: true, accrualFrequency: "YEARLY", accrualBasis: "FIXED", credit: 12, minimumPresentDays: 0, annualLimit: 12, carryForwardEnabled: false, carryForwardLimit: 0, expiryEnabled: false, expiryMonths: 0, allowRequest: true, paid: true },



  { code: "SL", enabled: true, accrualFrequency: "YEARLY", accrualBasis: "FIXED", credit: 12, minimumPresentDays: 0, annualLimit: 12, carryForwardEnabled: false, carryForwardLimit: 0, expiryEnabled: false, expiryMonths: 0, allowRequest: true, paid: true },



  { code: "FL", enabled: true, accrualFrequency: "NONE", accrualBasis: "NONE", credit: 0, minimumPresentDays: 0, annualLimit: 0, carryForwardEnabled: false, carryForwardLimit: 0, expiryEnabled: false, expiryMonths: 0, allowRequest: false, paid: false, forceLeaveTreatments: { staff: "PAID", thirdParty: "UNPAID", consultant: "POLICY" } },



  { code: "CO", enabled: true, accrualFrequency: "ON_EVENT", accrualBasis: "WEEKLY_OFF_WORKED", credit: 1, minimumPresentDays: 0, annualLimit: 0, carryForwardEnabled: true, carryForwardLimit: 30, expiryEnabled: true, expiryMonths: 6, allowRequest: true, paid: true },



];







const emptyStore = () => ({ policies: [], openingBalances: {}, adjustments: [], requests: [], audit: [] });



const safeArray = (value) => (Array.isArray(value) ? value : []);



const asNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);



const formatDays = (value) => asNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });



const todayISO = () => new Date().toISOString().slice(0, 10);



const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;



const normalizeStatus = (status) => String(status || "").trim().toUpperCase().replace(/\s+[—-]\s+.*$/, "");



const getEmployeeKey = (employee) => String(employee?.id ?? employee?.employeeId ?? employee?.empCode ?? employee?.code ?? "");



const getEmployeeGroup = (employee) => String(employee?.employeeGroup ?? employee?.group ?? employee?.employeeType ?? "").trim();



const getWorkforceCategory = (employee) => String(employee?.workforceCategory ?? employee?.category ?? employee?.rollCategory ?? employee?.type ?? "").trim();



const getDepartment = (employee) => String(employee?.department ?? employee?.departmentName ?? "").trim();



const getLocation = (employee) => String(employee?.site ?? employee?.location ?? employee?.branch ?? "").trim();



const isThirdParty = (employee) => /third\s*party|off\s*roll|associat/i.test(`${getEmployeeGroup(employee)} ${getWorkforceCategory(employee)} ${employee?.vendor || employee?.contractor || ""}`);



const isStaff = (employee) => !isThirdParty(employee) && /staff|company\s*roll|on\s*roll/i.test(`${getEmployeeGroup(employee)} ${getWorkforceCategory(employee)} ${employee?.employmentType || ""}`);







async function readAttendanceSnapshot() {



  const saved = await loadOrganizationModuleData("hrmsAttendanceData", {});



  return saved?.records && typeof saved.records === "object" ? saved.records : {};



}







function normalizeStore(raw) {



  const value = raw && typeof raw === "object" ? raw : {};



  return {



    policies: safeArray(value.policies),



    openingBalances: value.openingBalances && typeof value.openingBalances === "object" ? value.openingBalances : {},



    adjustments: safeArray(value.adjustments),



    requests: safeArray(value.requests),



    audit: safeArray(value.audit),



  };



}







function findAttendanceRow(day, employee) {



  if (!day || typeof day !== "object") return null;



  const keys = [employee?.id, employee?.employeeId, employee?.empCode, employee?.code, employee?.employeeCode]



    .filter((value) => value !== undefined && value !== null)



    .map(String);



  for (const key of keys) {



    if (day[key]) return day[key];



  }



  return Object.values(day).find((row) => {



    const rowKeys = [row?.employeeId, row?.employeeCode, row?.empCode, row?.id].filter(Boolean).map(String);



    return rowKeys.some((key) => keys.includes(key));



  }) || null;



}







function getAttendanceStats(attendance, employee, year) {



  const stats = { EL: 0, PL: 0, CL: 0, SL: 0, FL: 0, COEarned: 0, COUsed: 0, legacyCOUsed: 0, presentDays: 0, absentDays: 0, forceLeavePaid: 0, forceLeaveUnpaid: 0 };



  Object.entries(attendance || {}).forEach(([dateKey, day]) => {



    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || Number(dateKey.slice(0, 4)) !== Number(year)) return;



    const row = findAttendanceRow(day, employee);



    if (!row) return;



    const status = normalizeStatus(row.status);



    const fraction = /HALF DAY|^HD$/.test(status) ? 0.5 : 1;



    if (["P", "PRESENT", "OD", "WFH"].includes(status)) stats.presentDays += fraction;



    if (["A", "ABSENT"].includes(status)) stats.absentDays += fraction;



    if (ATTENDANCE_LEAVE_STATUSES.includes(status)) stats[status] += fraction;



    if (status === "FL") stats.FL += fraction;



    const transaction = String(row.compOffTransaction || row.compOffType || "").trim().toUpperCase();



    if (status === "CO-E" || transaction === "CO-E" || row.compOffEarned === true || asNumber(row.compOffEarned) > 0) {



      stats.COEarned += status === "CO-E" || transaction === "CO-E" ? 1 : (row.compOffEarned === true ? 1 : asNumber(row.compOffEarned));



    }



    if (status === "CO-U" || transaction === "CO-U") stats.COUsed += 1;



    else if (status === "CO") stats.legacyCOUsed += 1;



  });



  return stats;



}



const LEAVE_MUSTER_CODES = ["EL", "PL", "CL", "SL", "FL", "CO-E", "CO-U"];



function getAttendanceLeaveMuster(attendance, employee, year) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    EL: 0,
    PL: 0,
    CL: 0,
    SL: 0,
    FL: 0,
    "CO-E": 0,
    "CO-U": 0,
    total: 0,
  }));

  Object.entries(attendance || {}).forEach(([dateKey, day]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || Number(dateKey.slice(0, 4)) !== Number(year)) return;
    const row = findAttendanceRow(day, employee);
    if (!row) return;

    const status = normalizeStatus(row.status);
    const transaction = String(row.compOffTransaction || row.compOffType || "").trim().toUpperCase();
    const code = LEAVE_MUSTER_CODES.includes(status)
      ? status
      : (status === "CO" ? "CO-U" : (transaction === "CO-E" || transaction === "CO-U" ? transaction : ""));
    if (!code) return;

    const month = months[Number(dateKey.slice(5, 7)) - 1];
    if (!month) return;
    const fraction = /HALF DAY|^HD$/.test(status) ? 0.5 : 1;
    month[code] += fraction;
    month.total += fraction;
  });

  const totals = LEAVE_MUSTER_CODES.reduce((result, code) => {
    result[code] = months.reduce((sum, month) => sum + asNumber(month[code]), 0);
    return result;
  }, {});

  return { months, totals, total: Object.values(totals).reduce((sum, value) => sum + value, 0) };
}







function policyApplies(policy, employee, date = todayISO()) {



  if (!policy || policy.status !== "Active") return false;



  if (policy.effectiveFrom && date < policy.effectiveFrom) return false;



  if (policy.effectiveTo && date > policy.effectiveTo) return false;



  const applicability = policy.applicability || {};



  const matchAny = (selected, actual) => !Array.isArray(selected) || selected.length === 0 || selected.includes(actual);



  return matchAny(applicability.workforceCategories, getWorkforceCategory(employee))



    && matchAny(applicability.employeeGroups, getEmployeeGroup(employee))



    && matchAny(applicability.departments, getDepartment(employee))



    && matchAny(applicability.locations, getLocation(employee));



}







function resolvePolicy(policies, employee, date = todayISO()) {



  return [...safeArray(policies)]



    .filter((policy) => policyApplies(policy, employee, date))



    .sort((a, b) => String(b.effectiveFrom || "").localeCompare(String(a.effectiveFrom || "")))[0] || null;



}







function calculateAccrued(policy, type, stats, year, currentYear) {



  const rule = safeArray(policy?.leaveTypes).find((item) => item.code === type);



  if (!rule?.enabled) return 0;



  const frequency = String(rule.accrualFrequency || "NONE").toUpperCase();



  const credit = asNumber(rule.credit);



  if (frequency === "MONTHLY") {



    let total = 0;



    for (let month = 1; month <= (Number(year) === Number(currentYear) ? new Date().getMonth() + 1 : 12); month += 1) {



      const presentDays = stats.monthlyPresentDays?.[month] || 0;



      if (presentDays >= asNumber(rule.minimumPresentDays)) total += credit;



    }



    return rule.annualLimit > 0 ? Math.min(total, asNumber(rule.annualLimit)) : total;



  }



  if (frequency === "YEARLY" && rule.accrualBasis === "FIXED") {



    if (Number(year) < Number(currentYear)) return rule.annualLimit > 0 ? Math.min(credit, asNumber(rule.annualLimit)) : credit;



    if (Number(year) > Number(currentYear)) return 0;



    const prorated = credit * ((new Date().getMonth() + 1) / 12);



    return rule.annualLimit > 0 ? Math.min(prorated, asNumber(rule.annualLimit)) : prorated;



  }



  if (frequency === "ON_EVENT" && type === "CO") return stats.COEarned * (credit || 1);



  return 0;



}







function countPresentByMonth(attendance, employee, year) {



  const months = {};



  Object.entries(attendance || {}).forEach(([dateKey, day]) => {



    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || Number(dateKey.slice(0, 4)) !== Number(year)) return;



    const row = findAttendanceRow(day, employee);



    if (!row) return;



    const status = normalizeStatus(row.status);



    const month = Number(dateKey.slice(5, 7));



    if (["P", "PRESENT", "OD", "WFH"].includes(status)) months[month] = (months[month] || 0) + 1;



    else if (status === "HD" || status === "HALF DAY") months[month] = (months[month] || 0) + 0.5;



  });



  return months;



}







function getForceLeaveTreatment(policy, employee) {



  const forceRule = safeArray(policy?.leaveTypes).find((item) => item.code === "FL");



  const configured = forceRule?.forceLeaveTreatments || {};



  if (isThirdParty(employee)) return configured.thirdParty || "UNPAID";



  if (isStaff(employee)) return configured.staff || "PAID";



  return configured.consultant || "POLICY";



}







function makeDefaultPolicy() {



  return {



    id: makeId("LP"),



    name: "Standard Leave Policy",



    code: "LEAVE-STD-001",



    status: "Draft",



    effectiveFrom: todayISO(),



    effectiveTo: "",



    description: "Configure and approve this policy before assigning it to employees.",



    applicability: { workforceCategories: [], employeeGroups: [], departments: [], locations: [] },



    leaveTypes: DEFAULT_POLICY_TYPES.map((item) => ({ ...item, forceLeaveTreatments: { ...(item.forceLeaveTreatments || {}) } })),



    approval: { managerRequired: true, hodRequired: false, hrRequired: true },



    createdAt: new Date().toISOString(),



    updatedAt: new Date().toISOString(),



    version: 1,



  };



}







export default function Leave({ employees = [] }) {



  const [organization, setOrganization] = useState(null);



  const [store, setStore] = useState(emptyStore);



  const [attendance, setAttendance] = useState({});



  const [masters, setMasters] = useState({ workforceCategories: [], employeeGroups: [], departments: [], locations: [] });



  const [loading, setLoading] = useState(true);



  const [saving, setSaving] = useState(false);



  const [error, setError] = useState("");



  const [notice, setNotice] = useState("");



  const [activeTab, setActiveTab] = useState("overview");



  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());



  const [musterEmployeeId, setMusterEmployeeId] = useState("");



  const [search, setSearch] = useState("");



  const [statusFilter, setStatusFilter] = useState("All");



  const [policyEditor, setPolicyEditor] = useState(null);



  const [policyTypeTab, setPolicyTypeTab] = useState("EL");



  const [balanceEmployee, setBalanceEmployee] = useState("");



  const [openingDraft, setOpeningDraft] = useState({ EL: "0", PL: "0", CL: "0", SL: "0", CO: "0" });



  const [adjustmentDraft, setAdjustmentDraft] = useState({ employeeId: "", type: "EL", amount: "", reason: "" });

  const [reportEmployeeId, setReportEmployeeId] = useState("");
  const [reportLeaveType, setReportLeaveType] = useState("ALL");
  const [reportMonth, setReportMonth] = useState("ALL");



  const [requestDraft, setRequestDraft] = useState({ employeeId: "", type: "EL", from: "", to: "", reason: "" });



  const [showPolicyForm, setShowPolicyForm] = useState(false);







  const getOrganization = useCallback(async () => {



    const { data, error: queryError } = await supabase



      .from("organizations")



      .select("id, code, name, settings")



      .eq("code", ORGANIZATION_CODE)



      .maybeSingle();



    if (queryError) throw queryError;



    if (!data) throw new Error(`Organization ${ORGANIZATION_CODE} was not found.`);



    return data;



  }, []);







  const loadData = useCallback(async () => {



    setLoading(true);



    setError("");



    try {



      const org = await getOrganization();



      setOrganization(org);

      const [savedLeaveData, attendanceSnapshot, orgMasters] = await Promise.all([

        loadOrganizationModuleData(LEAVE_SETTINGS_KEY, emptyStore()),

        readAttendanceSnapshot(),

        loadOrganizationModuleData("bauerHrmsOrganizationMasters", {}),

      ]);

      setStore(normalizeStore(savedLeaveData));

      setAttendance(attendanceSnapshot);





      setMasters({



        workforceCategories: safeArray(orgMasters.workforceCategories).filter((x) => x?.active !== false).map((x) => x.name || x.label).filter(Boolean),



        employeeGroups: safeArray(orgMasters.employeeGroups || orgMasters.employeeTypes).filter((x) => x?.active !== false).map((x) => x.name || x.label).filter(Boolean),



        departments: safeArray(orgMasters.departments).filter((x) => x?.active !== false).map((x) => x.name || x.label).filter(Boolean),



        locations: safeArray(orgMasters.locations).filter((x) => x?.active !== false).map((x) => x.name || x.label).filter(Boolean),



      });



    } catch (loadError) {



      console.error("Unable to load Leave Management:", loadError);



      setError(loadError?.message || "Unable to load Leave Management data.");



    } finally {



      setLoading(false);



    }



  }, [getOrganization]);







  useEffect(() => { loadData(); }, [loadData]);



  useEffect(() => {



    let cancelled = false;



    const refreshAttendance = async () => {



      try {



        const nextAttendance = await readAttendanceSnapshot();



        if (!cancelled) setAttendance(nextAttendance);



      } catch (refreshError) {



        console.error("Unable to refresh attendance from Supabase:", refreshError);



      }



    };



    const handleUpdated = (event) => {
      const moduleKey = event?.detail?.moduleKey;
      if (moduleKey === "hrmsAttendanceData") refreshAttendance();
      if (moduleKey === LEAVE_SETTINGS_KEY) loadData();
    };



    window.addEventListener("organizationModuleDataUpdated", handleUpdated);



    const timer = window.setInterval(refreshAttendance, 15000);



    return () => {



      cancelled = true;



      window.removeEventListener("organizationModuleDataUpdated", handleUpdated);



      window.clearInterval(timer);



    };



  }, []);







  const persistStore = useCallback(async (nextValue) => {



    if (!organization?.id) throw new Error("Organization is not loaded. Please refresh and try again.");



    const nextStore = normalizeStore(nextValue);



    await saveOrganizationModuleData(LEAVE_SETTINGS_KEY, nextStore);

    setStore(nextStore);



    return nextStore;



  }, [organization]);







  const activePolicies = useMemo(() => store.policies.filter((policy) => policy.status === "Active"), [store.policies]);



  const filteredEmployees = useMemo(() => {



    const query = search.trim().toLowerCase();



    return employees.filter((employee) => {



      const haystack = [employee.name, employee.id, employee.employeeId, employee.designation, employee.department, employee.site, employee.vendor, getEmployeeGroup(employee), getWorkforceCategory(employee)].join(" ").toLowerCase();



      return !query || haystack.includes(query);



    });



  }, [employees, search]);



  const musterEmployee = useMemo(() => {
    const selected = employees.find((employee) => getEmployeeKey(employee) === String(musterEmployeeId));
    return selected || filteredEmployees[0] || employees[0] || null;
  }, [employees, filteredEmployees, musterEmployeeId]);



  const attendanceLeaveMuster = useMemo(
    () => musterEmployee ? getAttendanceLeaveMuster(attendance, musterEmployee, selectedYear) : null,
    [attendance, musterEmployee, selectedYear]
  );







  const getBalance = useCallback((employee) => {



    const employeeKey = getEmployeeKey(employee);



    const policy = resolvePolicy(store.policies, employee, `${selectedYear}-12-31`);



    const attendanceStats = getAttendanceStats(attendance, employee, selectedYear);



    attendanceStats.monthlyPresentDays = countPresentByMonth(attendance, employee, selectedYear);



    const opening = store.openingBalances[`${selectedYear}:${employeeKey}`] || store.openingBalances[employeeKey] || {};



    const adjustments = store.adjustments.filter((item) => String(item.employeeId) === employeeKey && Number(item.year) === Number(selectedYear));



    const balances = {};



    BALANCE_TYPES.forEach((type) => {



      const accrued = policy ? calculateAccrued(policy, type, attendanceStats, selectedYear, new Date().getFullYear()) : 0;



      const attendanceUsed = type === "CO" ? attendanceStats.COUsed + attendanceStats.legacyCOUsed : attendanceStats[type] || 0;



      // Approved requests reserve leave until Attendance is marked. If the same date/type is already in Attendance,



      // count it only once so approval + attendance marking cannot double-deduct the balance.



      let approvedRequestUsed = 0;



      store.requests.filter((request) => String(request.employeeId) === employeeKey && request.type === type && request.status === "Approved").forEach((request) => {



        const start = new Date(`${request.from}T00:00:00`);



        const end = new Date(`${request.to}T00:00:00`);



        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {



          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;



          if (date.getFullYear() !== Number(selectedYear)) continue;



          const row = findAttendanceRow(attendance[dateKey], employee);



          const status = normalizeStatus(row?.status);



          const alreadyInAttendance = type === "CO" ? ["CO-U", "CO"].includes(status) || ["CO-U", "CO"].includes(String(row?.compOffTransaction || "").toUpperCase()) : status === type;



          if (!alreadyInAttendance) approvedRequestUsed += 1;



        }



      });



      const used = attendanceUsed + approvedRequestUsed;



      const adjustment = adjustments.filter((item) => item.type === type).reduce((sum, item) => sum + asNumber(item.amount), 0);



      let raw = asNumber(opening[type]) + accrued + adjustment - used;



      const rule = safeArray(policy?.leaveTypes).find((item) => item.code === type);



      if (rule?.carryForwardEnabled && asNumber(rule.carryForwardLimit) > 0) raw = Math.min(raw, asNumber(rule.carryForwardLimit));



      // Keep the real signed balance. HR needs to see a negative balance
      // instead of silently converting an over-utilised leave type to zero.
      balances[type] = { opening: asNumber(opening[type]), accrued, used, adjustment, available: raw };



    });



    const forceLeaveTreatment = getForceLeaveTreatment(policy, employee);



    return { balances, policy, attendanceStats, forceLeaveTreatment };



  }, [store, attendance, selectedYear]);







  const stats = useMemo(() => {



    let forceLeaveDays = 0;



    let forceLeavePaidDays = 0;



    let forceLeaveUnpaidDays = 0;



    let pendingRequests = 0;



    let onLeaveToday = 0;



    const today = todayISO();



    const todayRecord = attendance[today] || {};



    Object.values(todayRecord).forEach((row) => {



      if (["EL", "PL", "CL", "SL", "FL"].includes(normalizeStatus(row?.status))) onLeaveToday += 1;



    });



    filteredEmployees.forEach((employee) => {



      const row = getBalance(employee);



      forceLeaveDays += row.attendanceStats.FL;



      if (row.forceLeaveTreatment === "PAID") forceLeavePaidDays += row.attendanceStats.FL;



      if (row.forceLeaveTreatment === "UNPAID") forceLeaveUnpaidDays += row.attendanceStats.FL;



    });



    pendingRequests = store.requests.filter((item) => ["Pending", "Pending HOD", "Pending HR/Admin"].includes(item.status)).length;



    return { forceLeaveDays, forceLeavePaidDays, forceLeaveUnpaidDays, pendingRequests, onLeaveToday };



  }, [attendance, filteredEmployees, getBalance, store.requests]);







  const reportMonthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Number(selectedYear), index, 1);
    return { value: String(index + 1).padStart(2, "0"), label: date.toLocaleDateString("en-IN", { month: "long" }) };
  }), [selectedYear]);

  const leaveReportRows = useMemo(() => {
    const rows = [];
    const reportCodes = ["EL", "PL", "CL", "SL", "FL", "CO-E", "CO-U", "CO"];
    Object.entries(attendance || {}).forEach(([dateKey, day]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || Number(dateKey.slice(0, 4)) !== Number(selectedYear)) return;
      if (reportMonth !== "ALL" && dateKey.slice(5, 7) !== reportMonth) return;
      employees.forEach((employee) => {
        if (reportEmployeeId && getEmployeeKey(employee) !== String(reportEmployeeId)) return;
        const row = findAttendanceRow(day, employee);
        if (!row) return;
        const status = normalizeStatus(row.status);
        const transaction = String(row.compOffTransaction || row.compOffType || "").trim().toUpperCase();
        const code = reportCodes.includes(status) ? (status === "CO" ? "CO-U" : status) : (transaction === "CO-E" || transaction === "CO-U" ? transaction : "");
        if (!code || (reportLeaveType !== "ALL" && code !== reportLeaveType)) return;
        const days = /HALF DAY|^HD$/.test(status) ? 0.5 : 1;
        const leaveName = code === "CO-E" ? "Comp-Off Earned" : code === "CO-U" ? "Comp-Off Utilised" : (LEAVE_TYPES.find((item) => item.code === code)?.name || code);
        rows.push({ id: `${dateKey}-${getEmployeeKey(employee)}-${code}`, date: dateKey, employee: employee.name || "Unnamed employee", employeeId: employee.employeeId || employee.id || "—", department: getDepartment(employee) || "—", site: getLocation(employee) || "—", code, leaveName, days, source: row.source || "Attendance", remarks: row.remarks || "" });
      });
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.employee.localeCompare(b.employee));
  }, [attendance, employees, reportEmployeeId, reportLeaveType, reportMonth, selectedYear]);

  const leaveReportSummary = useMemo(() => leaveReportRows.reduce((summary, row) => {
    summary.total += row.days;
    summary[row.code] = (summary[row.code] || 0) + row.days;
    return summary;
  }, { total: 0, EL: 0, PL: 0, CL: 0, SL: 0, FL: 0, "CO-E": 0, "CO-U": 0 }), [leaveReportRows]);

  const exportLeaveReportExcel = () => {
    if (!leaveReportRows.length) { window.alert("No leave data matches the selected filters."); return; }
    const rows = leaveReportRows.map((row) => ({ Date: row.date, Employee: row.employee, "Employee ID": row.employeeId, Department: row.department, "Project / Site": row.site, Code: row.code, "Leave Type": row.leaveName, Days: row.days, Source: row.source, Remarks: row.remarks }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 13 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 22 }, { wch: 8 }, { wch: 16 }, { wch: 30 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leave Report");
    XLSX.writeFile(workbook, `Leave_Report_${selectedYear}.xlsx`);
  };

  const exportLeaveReportPdf = () => {
    if (!leaveReportRows.length) { window.alert("No leave data matches the selected filters."); return; }
    const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
    const employeeName = reportEmployeeId ? (employees.find((employee) => getEmployeeKey(employee) === String(reportEmployeeId))?.name || "Selected employee") : "All employees";
    const leaveName = reportLeaveType === "ALL" ? "All leave types" : reportLeaveType === "CO-E" ? "Comp-Off Earned" : reportLeaveType === "CO-U" ? "Comp-Off Utilised" : (LEAVE_TYPES.find((item) => item.code === reportLeaveType)?.name || reportLeaveType);
    const monthName = reportMonth === "ALL" ? "All months" : (reportMonthOptions.find((item) => item.value === reportMonth)?.label || reportMonth);
    const popup = window.open("", "_blank", "width=1280,height=850");
    if (!popup) { window.alert("Please allow pop-ups to generate the PDF report."); return; }
    const tableRows = leaveReportRows.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.employee)}</td><td>${escapeHtml(row.employeeId)}</td><td>${escapeHtml(row.department)}</td><td>${escapeHtml(row.site)}</td><td>${escapeHtml(row.code)}</td><td>${escapeHtml(row.leaveName)}</td><td>${escapeHtml(formatDays(row.days))}</td><td>${escapeHtml(row.source)}</td><td>${escapeHtml(row.remarks || "—")}</td></tr>`).join("");
    const html = `<!doctype html><html><head><title>Leave Report ${selectedYear}</title><style>@page{size:landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#183b60;margin:0}h1{font-size:22px;margin:0 0 4px}p{margin:0 0 12px;color:#6f8493;font-size:11px}.meta{display:flex;gap:18px;flex-wrap:wrap;padding:10px 12px;margin-bottom:14px;border:1px solid #dbe8f0;border-radius:8px;background:#f4f9fc;font-size:11px}.meta b{color:#123d62}table{width:100%;border-collapse:collapse;font-size:9px}th{padding:8px;text-align:left;background:#f0f6fa;color:#537084;text-transform:uppercase}td{padding:7px;border-bottom:1px solid #e4edf2;color:#38566b}tfoot td{font-weight:bold;background:#eef7fb;color:#123d62}</style></head><body><h1>BAUER HRMS — Leave Report</h1><p>Attendance-linked leave report generated on ${escapeHtml(new Date().toLocaleString("en-IN"))}</p><div class="meta"><span><b>Year:</b> ${selectedYear}</span><span><b>Employee:</b> ${escapeHtml(employeeName)}</span><span><b>Leave:</b> ${escapeHtml(leaveName)}</span><span><b>Month:</b> ${escapeHtml(monthName)}</span></div><table><thead><tr><th>Date</th><th>Employee</th><th>Employee ID</th><th>Department</th><th>Site</th><th>Code</th><th>Leave Type</th><th>Days</th><th>Source</th><th>Remarks</th></tr></thead><tbody>${tableRows}</tbody><tfoot><tr><td colspan="7">Total leave marks</td><td>${escapeHtml(formatDays(leaveReportSummary.total))}</td><td colspan="2"></td></tr></tfoot></table></body></html>`;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.setTimeout(() => popup.print(), 250);
  };

  const showSuccess = (message) => {



    setNotice(message);



    window.setTimeout(() => setNotice(""), 3000);



  };







  const savePolicy = async (status) => {



    if (!policyEditor) return;



    if (!policyEditor.name?.trim() || !policyEditor.code?.trim() || !policyEditor.effectiveFrom) {



      setError("Policy name, policy code and Effective From are required.");



      return;



    }



    if (policyEditor.effectiveTo && policyEditor.effectiveTo < policyEditor.effectiveFrom) {



      setError("Effective To cannot be earlier than Effective From.");



      return;



    }



    const now = new Date().toISOString();



    const existing = store.policies.find((item) => item.id === policyEditor.id);



    const nextPolicy = {



      ...policyEditor,



      name: policyEditor.name.trim(),



      code: policyEditor.code.trim().toUpperCase().replace(/\s+/g, "-"),



      status,



      version: existing ? asNumber(existing.version) + (status === "Active" ? 1 : 0) : 1,



      createdAt: existing?.createdAt || now,



      updatedAt: now,



      publishedAt: status === "Active" ? now : existing?.publishedAt || null,



    };



    const duplicate = store.policies.some((item) => item.id !== nextPolicy.id && String(item.code).toLowerCase() === nextPolicy.code.toLowerCase());



    if (duplicate) {



      setError("Policy code already exists. Please use a unique code.");



      return;



    }



    setSaving(true);



    setError("");



    try {



      const policies = existing ? store.policies.map((item) => item.id === nextPolicy.id ? nextPolicy : item) : [nextPolicy, ...store.policies];



      const audit = [{ id: makeId("LAUD"), action: status === "Active" ? (existing ? "POLICY_PUBLISHED_UPDATE" : "POLICY_PUBLISHED") : (existing ? "POLICY_DRAFT_UPDATED" : "POLICY_DRAFT_CREATED"), policyId: nextPolicy.id, policyCode: nextPolicy.code, policyName: nextPolicy.name, timestamp: now }, ...store.audit];



      await persistStore({ ...store, policies, audit });



      setPolicyEditor(null);



      setShowPolicyForm(false);



      showSuccess(status === "Active" ? "Leave policy published successfully." : "Leave policy saved as draft.");



    } catch (saveError) {



      console.error("Unable to save leave policy:", saveError);



      setError(saveError?.message || "Unable to save leave policy. Check Supabase RPC setup and permissions.");



    } finally {



      setSaving(false);



    }



  };







  const saveOpeningBalance = async () => {



    if (!balanceEmployee) { setError("Please select an employee first."); return; }



    setSaving(true); setError("");



    try {



      const nextOpening = { ...store.openingBalances, [`${selectedYear}:${balanceEmployee}`]: Object.fromEntries(BALANCE_TYPES.map((type) => [type, Math.max(0, asNumber(openingDraft[type]))])) };



      const nextAudit = [{ id: makeId("LAUD"), action: "OPENING_BALANCE_UPDATED", employeeId: balanceEmployee, year: selectedYear, timestamp: new Date().toISOString() }, ...store.audit];



      await persistStore({ ...store, openingBalances: nextOpening, audit: nextAudit });



      showSuccess("Opening balance saved.");



      setActiveTab("balances");



    } catch (saveError) { setError(saveError?.message || "Unable to save opening balance."); }



    finally { setSaving(false); }



  };







  const saveAdjustment = async (event) => {



    event.preventDefault();



    if (!adjustmentDraft.employeeId || !adjustmentDraft.reason.trim() || asNumber(adjustmentDraft.amount) === 0) {



      setError("Select employee, enter a non-zero adjustment and provide a reason."); return;



    }



    setSaving(true); setError("");



    try {



      const item = { id: makeId("LADJ"), employeeId: adjustmentDraft.employeeId, type: adjustmentDraft.type, amount: asNumber(adjustmentDraft.amount), reason: adjustmentDraft.reason.trim(), year: selectedYear, createdAt: new Date().toISOString(), createdBy: "HR/Admin" };



      await persistStore({ ...store, adjustments: [item, ...store.adjustments], audit: [{ id: makeId("LAUD"), action: "BALANCE_ADJUSTMENT", ...item }, ...store.audit] });



      setAdjustmentDraft({ employeeId: "", type: "EL", amount: "", reason: "" });



      showSuccess("Adjustment recorded in the leave ledger.");



    } catch (saveError) { setError(saveError?.message || "Unable to save adjustment."); }



    finally { setSaving(false); }



  };







  const submitRequest = async (event) => {



    event.preventDefault();



    const employee = employees.find((item) => getEmployeeKey(item) === String(requestDraft.employeeId));



    if (!employee || !requestDraft.from || !requestDraft.to || requestDraft.to < requestDraft.from) { setError("Select a valid employee and leave date range."); return; }



    if (requestDraft.type === "FL") { setError("Force Leave is marked by the company in Attendance; it is not an employee leave request."); return; }



    const policy = resolvePolicy(store.policies, employee, requestDraft.from);



    const rule = safeArray(policy?.leaveTypes).find((item) => item.code === requestDraft.type);



    if (!policy || !rule?.enabled || rule.allowRequest === false) { setError("No active applicable leave policy is assigned to this employee for the selected date."); return; }



    const days = Math.floor((new Date(`${requestDraft.to}T00:00:00`) - new Date(`${requestDraft.from}T00:00:00`)) / 86400000) + 1;



    const balance = getBalance(employee).balances[requestDraft.type]?.available || 0;



    if (requestDraft.type !== "CO" && balance < days) { setError(`${requestDraft.type} available balance is ${formatDays(balance)} day(s); requested ${days} day(s).`); return; }



    setSaving(true); setError("");



    try {



      const request = { id: makeId("LR"), employeeId: getEmployeeKey(employee), employeeName: employee.name || "", type: requestDraft.type, from: requestDraft.from, to: requestDraft.to, days, reason: requestDraft.reason.trim(), status: "Pending", source: "HR/Admin", policyId: policy.id, createdAt: new Date().toISOString(), approvalStage: "Manager" };



      await persistStore({ ...store, requests: [request, ...store.requests], audit: [{ id: makeId("LAUD"), action: "LEAVE_REQUEST_CREATED", requestId: request.id, employeeId: request.employeeId, timestamp: new Date().toISOString() }, ...store.audit] });



      setRequestDraft({ employeeId: "", type: "EL", from: "", to: "", reason: "" });



      showSuccess("Leave request created.");



    } catch (saveError) { setError(saveError?.message || "Unable to create leave request."); }



    finally { setSaving(false); }



  };







  const updateRequestStatus = async (requestId, decision) => {



    const now = new Date().toISOString();



    const approved = decision === "approve";



    const requests = store.requests.map((request) => {



      if (String(request.id) !== String(requestId)) return request;



      if (/employee self service/i.test(String(request.source || "")) && String(request.approvalStage || "").toUpperCase() === "HOD") return request;



      return { ...request, status: approved ? "Approved" : "Rejected", approvalStage: "Completed", hrAdminStatus: approved ? "Approved" : "Rejected", hrAdminDecisionBy: "HR/Admin", hrAdminDecisionAt: now };



    });



    setSaving(true); setError("");



    try {



      await persistStore({ ...store, requests, audit: [{ id: makeId("LAUD"), action: approved ? "LEAVE_REQUEST_APPROVED" : "LEAVE_REQUEST_REJECTED", requestId, timestamp: now }, ...store.audit] });



      showSuccess(approved ? "Leave request approved." : "Leave request rejected.");



    } catch (saveError) { setError(saveError?.message || "Unable to update request status."); }



    finally { setSaving(false); }



  };







  const startNewPolicy = () => { setError(""); setPolicyEditor(makeDefaultPolicy()); setPolicyTypeTab("EL"); setShowPolicyForm(true); };



  const editPolicy = (policy) => { setError(""); setPolicyEditor({ ...makeDefaultPolicy(), ...policy, applicability: { ...makeDefaultPolicy().applicability, ...(policy.applicability || {}) }, leaveTypes: DEFAULT_POLICY_TYPES.map((base) => ({ ...base, ...(safeArray(policy.leaveTypes).find((x) => x.code === base.code) || {}), forceLeaveTreatments: { ...(base.forceLeaveTreatments || {}), ...(safeArray(policy.leaveTypes).find((x) => x.code === base.code)?.forceLeaveTreatments || {}) } })) }); setPolicyTypeTab("EL"); setShowPolicyForm(true); };



  const updatePolicyField = (field, value) => setPolicyEditor((previous) => ({ ...previous, [field]: value }));



  const updateApplicability = (field, value) => setPolicyEditor((previous) => ({ ...previous, applicability: { ...previous.applicability, [field]: value } }));



  const updateLeaveRule = (code, field, value) => setPolicyEditor((previous) => ({ ...previous, leaveTypes: previous.leaveTypes.map((rule) => rule.code === code ? { ...rule, [field]: value } : rule) }));



  const updateForceRule = (field, value) => setPolicyEditor((previous) => ({ ...previous, leaveTypes: previous.leaveTypes.map((rule) => rule.code === "FL" ? { ...rule, forceLeaveTreatments: { ...(rule.forceLeaveTreatments || {}), [field]: value } } : rule) }));







  if (loading) return <section className="leave-module"><div className="leave-loading"><span className="leave-spinner" />Loading Leave Management…</div></section>;







  return (



    <section className="leave-module">



      <header className="leave-page-header">



        <div><div className="leave-eyebrow">HR OPERATIONS / TIME OFF</div><h1>Leave Management</h1><p>Company-specific leave policies, attendance-linked balances and controlled approvals.</p></div>



        <div className="leave-header-actions"><span className="leave-company-pill">{organization?.name || "Organization"}</span><button className="leave-btn leave-btn-primary" onClick={startNewPolicy}>＋ Create Leave Policy</button></div>



      </header>







      {error && <div className="leave-alert leave-alert-error"><span>!</span><div>{error}</div><button type="button" onClick={() => setError("")}>×</button></div>}



      {notice && <div className="leave-alert leave-alert-success"><span>✓</span><div>{notice}</div></div>}







      <nav className="leave-nav" aria-label="Leave management sections">



        {[ ["overview", "Overview"], ["policies", "Leave Policies"], ["balances", "Employee Balances"], ["muster", "Leave Muster"], ["requests", "Leave Requests"], ["compoff", "Comp-Off Ledger"], ["calendar", "Leave Calendar"], ["reports", "Reports & Audit"] ].map(([key, label]) => <button type="button" key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>{label}{key === "requests" && stats.pendingRequests > 0 && <span className="leave-nav-count">{stats.pendingRequests}</span>}</button>)}



      </nav>







      {activeTab === "overview" && <>



        <div className="leave-kpi-grid">



          <article className="leave-kpi"><span>Active Employees</span><strong>{employees.length}</strong><small>Current employee master</small><i className="kpi-icon">♙</i></article>



          <article className="leave-kpi"><span>On Leave Today</span><strong>{stats.onLeaveToday}</strong><small>EL, PL, CL, SL and Force Leave marks</small><i className="kpi-icon purple">▦</i></article>



          <article className="leave-kpi"><span>Pending Requests</span><strong>{stats.pendingRequests}</strong><small>Awaiting approval action</small><i className="kpi-icon amber">◷</i></article>



          <article className="leave-kpi"><span>Force Leave Days</span><strong>{formatDays(stats.forceLeaveDays)}</strong><small>{formatDays(stats.forceLeavePaidDays)} paid · {formatDays(stats.forceLeaveUnpaidDays)} unpaid by current rule</small><i className="kpi-icon blue">⚑</i></article>



        </div>



        <div className="leave-content-grid">



          <article className="leave-card leave-card-wide"><div className="leave-card-header"><div><span className="leave-eyebrow">CONTROL CENTER</span><h2>Leave operations</h2><p>Manage policy, employee balances and approval workflow from one place.</p></div><select aria-label="Year" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>{[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}</select></div>



            <div className="leave-quick-grid"><button onClick={() => setActiveTab("policies")}><span>⚙</span><strong>Configure Leave Policy</strong><small>Eligibility, accrual, carry-forward and Force Leave rules</small></button><button onClick={() => setActiveTab("balances")}><span>▤</span><strong>Review Employee Balances</strong><small>Opening, accrued, used, adjusted and available</small></button><button onClick={() => setActiveTab("requests")}><span>✓</span><strong>Process Leave Requests</strong><small>Review pending requests and decisions</small></button><button onClick={() => setActiveTab("compoff")}><span>↔</span><strong>Comp-Off Ledger</strong><small>CO-E earned and CO-U utilised</small></button></div>



          </article>



          <article className="leave-card"><div className="leave-card-header"><div><span className="leave-eyebrow">POLICY STATUS</span><h2>Policy coverage</h2></div><span className="leave-status-count">{activePolicies.length} active</span></div>{activePolicies.length ? activePolicies.slice(0, 5).map((policy) => <div className="leave-policy-mini" key={policy.id}><span className="leave-policy-mini-icon">LP</span><div><strong>{policy.name}</strong><small>{policy.code} · v{policy.version || 1}</small></div><span className="leave-status leave-status-active">Active</span></div>) : <div className="leave-empty-state"><span>⚙</span><strong>No active leave policy</strong><p>Create a policy, select its applicability and publish it to start policy-based accrual.</p><button className="leave-btn leave-btn-primary" onClick={startNewPolicy}>Create policy</button></div>}</article>



        </div>



        <article className="leave-card leave-force-callout"><div className="leave-force-icon">⚑</div><div><strong>Force Leave treatment</strong><p>FL is a company-marked Attendance status. It never deducts EL/CL/SL. Staff/Company Roll defaults to Paid; Third Party/Off Roll defaults to Unpaid. These rules are configurable in the published leave policy.</p></div><button className="leave-btn leave-btn-secondary" onClick={() => { setActiveTab("policies"); if (activePolicies[0]) editPolicy(activePolicies[0]); else startNewPolicy(); }}>Configure rules</button></article>



      </>}







      {activeTab === "policies" && <>



        {showPolicyForm && policyEditor ? <article className="leave-card leave-policy-editor">



          <div className="leave-card-header"><div><span className="leave-eyebrow">POLICY CONFIGURATION</span><h2>{store.policies.some((item) => item.id === policyEditor.id) ? "Edit Leave Policy" : "Create Leave Policy"}</h2><p>Save as Draft while configuring. Publish only after checking applicability and rules.</p></div><button className="leave-icon-btn" onClick={() => { setShowPolicyForm(false); setPolicyEditor(null); }}>×</button></div>



          <div className="leave-form-section"><h3>1. Basic information</h3><div className="leave-form-grid"><label>Policy name *<input value={policyEditor.name} onChange={(e) => updatePolicyField("name", e.target.value)} placeholder="e.g. Staff Leave Policy" /></label><label>Policy code *<input value={policyEditor.code} onChange={(e) => updatePolicyField("code", e.target.value.toUpperCase().replace(/\s+/g, "-"))} placeholder="LEAVE-STAFF-001" /></label><label>Effective from *<input type="date" value={policyEditor.effectiveFrom || ""} onChange={(e) => updatePolicyField("effectiveFrom", e.target.value)} /></label><label>Effective to<input type="date" value={policyEditor.effectiveTo || ""} onChange={(e) => updatePolicyField("effectiveTo", e.target.value)} /></label><label className="leave-form-span">Description<textarea rows="2" value={policyEditor.description || ""} onChange={(e) => updatePolicyField("description", e.target.value)} placeholder="Policy purpose and coverage" /></label></div></div>



          <div className="leave-form-section"><h3>2. Policy applicability</h3><p className="leave-help-text">Leave a group empty to make the policy unrestricted for that dimension. When more than one active policy matches, the latest Effective From date takes precedence.</p><div className="leave-form-grid"><label>Workforce category<select multiple value={policyEditor.applicability.workforceCategories} onChange={(e) => updateApplicability("workforceCategories", Array.from(e.target.selectedOptions).map((option) => option.value))}>{(masters.workforceCategories.length ? masters.workforceCategories : ["On Roll", "Off Roll", "Consultant"]).map((item) => <option key={item}>{item}</option>)}</select><small>Use Ctrl/Command to select multiple values.</small></label><label>Employee group<select multiple value={policyEditor.applicability.employeeGroups} onChange={(e) => updateApplicability("employeeGroups", Array.from(e.target.selectedOptions).map((option) => option.value))}>{(masters.employeeGroups.length ? masters.employeeGroups : ["Staff", "Third Party (Associates)", "GET", "Consultant", "Expat"]).map((item) => <option key={item}>{item}</option>)}</select><small>Use Ctrl/Command to select multiple values.</small></label><label>Department<select multiple value={policyEditor.applicability.departments} onChange={(e) => updateApplicability("departments", Array.from(e.target.selectedOptions).map((option) => option.value))}>{masters.departments.map((item) => <option key={item}>{item}</option>)}</select><small>Leave empty for all departments.</small></label><label>Location / Site<select multiple value={policyEditor.applicability.locations} onChange={(e) => updateApplicability("locations", Array.from(e.target.selectedOptions).map((option) => option.value))}>{masters.locations.map((item) => <option key={item}>{item}</option>)}</select><small>Leave empty for all locations.</small></label></div></div>



          <div className="leave-form-section"><h3>3. Leave type rules</h3><div className="leave-rule-tabs">{LEAVE_TYPES.map((item) => <button type="button" key={item.code} className={policyTypeTab === item.code ? "active" : ""} onClick={() => setPolicyTypeTab(item.code)}>{item.code}<small>{item.name}</small></button>)}</div>{(() => { const rule = policyEditor.leaveTypes.find((item) => item.code === policyTypeTab); if (!rule) return null; const typeMeta = LEAVE_TYPES.find((item) => item.code === rule.code); return <div className="leave-rule-editor"><div className="leave-rule-title"><div><h4>{typeMeta.name} ({rule.code})</h4><p>{typeMeta.description}</p></div><label className="leave-toggle"><input type="checkbox" checked={!!rule.enabled} onChange={(e) => updateLeaveRule(rule.code, "enabled", e.target.checked)} /><span>Enabled</span></label></div>{rule.code === "FL" ? <><div className="leave-force-grid"><div><span>Staff / Company Roll</span><select value={rule.forceLeaveTreatments?.staff || "PAID"} onChange={(e) => updateForceRule("staff", e.target.value)}><option value="PAID">Paid day</option><option value="UNPAID">Unpaid day</option></select></div><div><span>Third Party / Off Roll</span><select value={rule.forceLeaveTreatments?.thirdParty || "UNPAID"} onChange={(e) => updateForceRule("thirdParty", e.target.value)}><option value="PAID">Paid day</option><option value="UNPAID">Unpaid day</option></select></div><div><span>Consultant / Other</span><select value={rule.forceLeaveTreatments?.consultant || "POLICY"} onChange={(e) => updateForceRule("consultant", e.target.value)}><option value="POLICY">Follow employee contract</option><option value="PAID">Paid day</option><option value="UNPAID">Unpaid day</option></select></div></div><div className="leave-note">Force Leave is driven by Attendance status FL. It is tracked separately and never consumes EL, CL or SL balance. Payroll impact should follow the approved employment/payroll policy.</div></> : <><div className="leave-form-grid leave-rule-fields"><label>Accrual frequency<select value={rule.accrualFrequency || "NONE"} onChange={(e) => updateLeaveRule(rule.code, "accrualFrequency", e.target.value)}><option value="NONE">No accrual</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option><option value="ON_EVENT">On event</option></select></label><label>Accrual basis<select value={rule.accrualBasis || "FIXED"} onChange={(e) => updateLeaveRule(rule.code, "accrualBasis", e.target.value)}><option value="FIXED">Fixed entitlement</option><option value="PRESENT_DAYS">Minimum present days</option><option value="WEEKLY_OFF_WORKED">Weekly-off work / Comp-Off</option></select></label><label>Credit per frequency<input type="number" min="0" step="0.5" value={rule.credit} onChange={(e) => updateLeaveRule(rule.code, "credit", e.target.value)} /></label><label>Minimum present days<input type="number" min="0" step="1" value={rule.minimumPresentDays} onChange={(e) => updateLeaveRule(rule.code, "minimumPresentDays", e.target.value)} /></label><label>Annual entitlement limit<input type="number" min="0" step="0.5" value={rule.annualLimit} onChange={(e) => updateLeaveRule(rule.code, "annualLimit", e.target.value)} /></label><label>Carry-forward limit<input type="number" min="0" step="0.5" value={rule.carryForwardLimit} onChange={(e) => updateLeaveRule(rule.code, "carryForwardLimit", e.target.value)} disabled={!rule.carryForwardEnabled} /></label><label>Expiry after (months)<input type="number" min="0" step="1" value={rule.expiryMonths} onChange={(e) => updateLeaveRule(rule.code, "expiryMonths", e.target.value)} disabled={!rule.expiryEnabled} /></label><label className="leave-check-field"><input type="checkbox" checked={!!rule.carryForwardEnabled} onChange={(e) => updateLeaveRule(rule.code, "carryForwardEnabled", e.target.checked)} /> Allow carry forward</label><label className="leave-check-field"><input type="checkbox" checked={!!rule.expiryEnabled} onChange={(e) => updateLeaveRule(rule.code, "expiryEnabled", e.target.checked)} /> Expire carried leave</label><label className="leave-check-field"><input type="checkbox" checked={rule.allowRequest !== false} onChange={(e) => updateLeaveRule(rule.code, "allowRequest", e.target.checked)} /> Allow employee leave request</label></div>{rule.code === "CO" && <div className="leave-note">CO-E from Attendance credits Comp-Off. CO-U and legacy CO entries consume Comp-Off. Duplicate transaction rows must not be counted twice.</div>}</>}</div>; })()}</div>



          <div className="leave-form-section"><h3>4. Approval workflow</h3><div className="leave-approval-options"><label><input type="checkbox" checked={policyEditor.approval.managerRequired !== false} onChange={(e) => updatePolicyField("approval", { ...policyEditor.approval, managerRequired: e.target.checked })} /> Reporting Manager</label><label><input type="checkbox" checked={!!policyEditor.approval.hodRequired} onChange={(e) => updatePolicyField("approval", { ...policyEditor.approval, hodRequired: e.target.checked })} /> HOD</label><label><input type="checkbox" checked={policyEditor.approval.hrRequired !== false} onChange={(e) => updatePolicyField("approval", { ...policyEditor.approval, hrRequired: e.target.checked })} /> HR/Admin</label></div></div>



          <div className="leave-editor-footer"><span className="leave-help-text">Draft policies do not calculate employee balances until published.</span><div><button className="leave-btn leave-btn-secondary" disabled={saving} onClick={() => { setShowPolicyForm(false); setPolicyEditor(null); }}>Cancel</button><button className="leave-btn leave-btn-secondary" disabled={saving} onClick={() => savePolicy("Draft")}>{saving ? "Saving…" : "Save Draft"}</button><button className="leave-btn leave-btn-primary" disabled={saving} onClick={() => savePolicy("Active")}>{saving ? "Publishing…" : "Publish Policy"}</button></div></div>



        </article> : <article className="leave-card"><div className="leave-card-header"><div><span className="leave-eyebrow">POLICY LIBRARY</span><h2>Leave policies</h2><p>Configure leave entitlement, eligibility, Force Leave paid/unpaid treatment and approvals by employee group.</p></div><button className="leave-btn leave-btn-primary" onClick={startNewPolicy}>＋ Create policy</button></div><div className="leave-table-wrap"><table className="leave-table"><thead><tr><th>Policy</th><th>Applicability</th><th>Leave types</th><th>Effective from</th><th>Version</th><th>Status</th><th>Action</th></tr></thead><tbody>{store.policies.map((policy) => <tr key={policy.id}><td><strong>{policy.name}</strong><small>{policy.code}</small></td><td><small>{[...(policy.applicability?.workforceCategories || []), ...(policy.applicability?.employeeGroups || [])].join(", ") || "All groups"}</small></td><td>{safeArray(policy.leaveTypes).filter((rule) => rule.enabled).map((rule) => rule.code).join(", ")}</td><td>{policy.effectiveFrom || "—"}</td><td>v{policy.version || 1}</td><td><span className={`leave-status ${policy.status === "Active" ? "leave-status-active" : "leave-status-draft"}`}>{policy.status}</span></td><td><button className="leave-table-action" onClick={() => editPolicy(policy)}>Edit</button></td></tr>)}</tbody></table>{store.policies.length === 0 && <div className="leave-empty-state"><span>▤</span><strong>No leave policies created</strong><p>Create a draft, configure applicability and rules, then publish it.</p><button className="leave-btn leave-btn-primary" onClick={startNewPolicy}>Create first policy</button></div>}</div></article>}



      </>}







      {activeTab === "balances" && <article className="leave-card"><div className="leave-card-header"><div><span className="leave-eyebrow">EMPLOYEE LEAVE LEDGER</span><h2>Employee balances</h2><p>Opening + accrual + adjustments − Attendance usage. FL is reported separately and never deducted from EL/CL/SL.</p></div><div className="leave-inline-actions"><select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>{[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => <option key={year}>{year}</option>)}</select><button className="leave-btn leave-btn-secondary" onClick={() => setActiveTab("reports")}>View ledger</button><button className="leave-btn leave-btn-primary" onClick={() => setActiveTab("opening")}>Set opening balance</button></div></div><div className="leave-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee, department, site…" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option><option>Policy Assigned</option><option>Policy Missing</option></select></div><div className="leave-table-wrap"><table className="leave-table leave-balance-table"><thead><tr><th>Employee</th><th>Group / Category</th><th>Policy</th><th>EL Available</th><th>PL Available</th><th>CL Available</th><th>SL Available</th><th>CO Available</th><th>FL Days</th><th>FL Treatment</th></tr></thead><tbody>{filteredEmployees.filter((employee) => statusFilter === "All" || (statusFilter === "Policy Assigned" ? !!getBalance(employee).policy : !getBalance(employee).policy)).map((employee) => { const result = getBalance(employee); return <tr key={getEmployeeKey(employee)}><td><div className="leave-employee-cell"><span className="leave-avatar">{String(employee.name || "E").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{employee.name || "Unnamed employee"}</strong><small>{employee.employeeId || employee.id || "—"} · {employee.designation || "—"}</small></div></div></td><td><strong>{getEmployeeGroup(employee) || "—"}</strong><small>{getWorkforceCategory(employee) || "—"}</small></td><td>{result.policy ? <><strong>{result.policy.name}</strong><small>v{result.policy.version || 1}</small></> : <span className="leave-status leave-status-warning">Not assigned</span>}</td>{["EL", "PL", "CL", "SL", "CO"].map((type) => <td key={type}><strong className={result.balances[type].available < 0 ? "leave-balance-negative" : ""}>{formatDays(result.balances[type].available)}</strong><small>Used {formatDays(result.balances[type].used)}</small></td>)}<td><strong>{formatDays(result.attendanceStats.FL)}</strong></td><td><span className={`leave-status ${result.forceLeaveTreatment === "PAID" ? "leave-status-active" : result.forceLeaveTreatment === "UNPAID" ? "leave-status-warning" : "leave-status-draft"}`}>{result.forceLeaveTreatment === "PAID" ? "Paid" : result.forceLeaveTreatment === "UNPAID" ? "Unpaid" : "Follow contract"}</span></td></tr>; })}</tbody></table>{filteredEmployees.length === 0 && <div className="leave-empty-state">No employees match your search.</div>}</div></article>}









      {activeTab === "muster" && (() => {
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const muster = attendanceLeaveMuster || { months: [], totals: {}, total: 0 };
        const balance = musterEmployee ? getBalance(musterEmployee) : null;
        const musterCodes = ["EL", "PL", "CL", "SL", "FL", "CO-E", "CO-U"];
        const displayCount = (value) => value ? formatDays(value) : "—";

        return <article className="leave-card leave-muster-card">
          <div className="leave-card-header">
            <div>
              <span className="leave-eyebrow">ATTENDANCE-LINKED LEAVE MUSTER</span>
              <h2>Monthly leave muster</h2>
              <p>Imported Attendance marks are grouped month-wise for the selected employee. Opening balance and signed available balance remain separate.</p>
            </div>
            <div className="leave-inline-actions">
              <select aria-label="Muster year" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              <select aria-label="Muster employee" value={musterEmployee ? getEmployeeKey(musterEmployee) : ""} onChange={(event) => setMusterEmployeeId(event.target.value)}>
                <option value="">Select employee</option>
                {employees.map((employee) => <option key={getEmployeeKey(employee)} value={getEmployeeKey(employee)}>{employee.name || "Unnamed"} · {employee.employeeId || employee.id}</option>)}
              </select>
            </div>
          </div>

          {musterEmployee && balance ? <>
            <div className="leave-muster-employee-bar">
              <div><strong>{musterEmployee.name || "Unnamed employee"}</strong><small>{musterEmployee.employeeId || musterEmployee.id || "—"} · {musterEmployee.department || "—"} · {musterEmployee.designation || "—"}</small></div>
              <div className="leave-muster-balance-strip">
                {BALANCE_TYPES.map((type) => <span key={type}><small>{type} available</small><strong className={balance.balances[type].available < 0 ? "leave-balance-negative" : ""}>{formatDays(balance.balances[type].available)}</strong></span>)}
              </div>
            </div>

            <div className="leave-table-wrap">
              <table className="leave-table leave-muster-table">
                <thead><tr><th>Month</th>{musterCodes.map((code) => <th key={code}>{code}</th>)}<th>Total Marks</th></tr></thead>
                <tbody>{muster.months.map((month) => <tr key={month.month}><td><strong>{monthLabels[month.month - 1]}</strong><small>{selectedYear}</small></td>{musterCodes.map((code) => <td key={code}><span style={{ fontWeight: month[code] ? 800 : 500, color: month[code] ? "#1b5f88" : "#9aabb8" }}>{displayCount(month[code])}</span></td>)}<td><strong>{displayCount(month.total)}</strong></td></tr>)}</tbody>
                <tfoot><tr><th>Year total</th>{musterCodes.map((code) => <th key={code}>{displayCount(muster.totals[code])}</th>)}<th>{displayCount(muster.total)}</th></tr></tfoot>
              </table>
            </div>
            <div className="leave-muster-note">Source: Attendance import and manual Attendance marks for {selectedYear}. Negative balances are intentionally shown with a minus sign so over-utilisation is visible.</div>
          </> : <div className="leave-empty-state"><strong>Select an employee to view the Leave Muster.</strong><p>Attendance entries with EL, PL, CL, SL, FL, CO-E and CO-U will appear month-wise here.</p></div>}
        </article>;
      })()}

      {activeTab === "opening" && <article className="leave-card leave-narrow-card"><div className="leave-card-header"><div><span className="leave-eyebrow">BALANCE SETUP</span><h2>Opening balance</h2><p>Enter opening entitlement by leave type. Every save is recorded in the organization database.</p></div></div><label className="leave-field-full">Employee<select value={balanceEmployee} onChange={(e) => { const id = e.target.value; setBalanceEmployee(id); setOpeningDraft(Object.fromEntries(BALANCE_TYPES.map((type) => [type, String((store.openingBalances[`${selectedYear}:${id}`] || store.openingBalances[id] || {})[type] ?? 0)]))); }}><option value="">Select employee</option>{employees.map((employee) => <option key={getEmployeeKey(employee)} value={getEmployeeKey(employee)}>{employee.name} · {employee.employeeId || employee.id}</option>)}</select></label><div className="leave-form-grid leave-opening-grid">{BALANCE_TYPES.map((type) => <label key={type}>{LEAVE_TYPES.find((item) => item.code === type)?.name}<input type="number" min="0" step="0.5" value={openingDraft[type]} onChange={(e) => setOpeningDraft((previous) => ({ ...previous, [type]: e.target.value }))} /></label>)}</div><div className="leave-editor-footer"><span className="leave-help-text">FL is excluded from leave balance by design.</span><button className="leave-btn leave-btn-primary" disabled={saving} onClick={saveOpeningBalance}>{saving ? "Saving…" : "Save opening balance"}</button></div></article>}







      {activeTab === "requests" && <div className="leave-content-grid leave-request-layout"><article className="leave-card"><div className="leave-card-header"><div><span className="leave-eyebrow">LEAVE REQUESTS</span><h2>Create request</h2><p>Requests are validated against the employee’s active applicable policy and available balance.</p></div></div><form className="leave-request-form" onSubmit={submitRequest}><label>Employee<select value={requestDraft.employeeId} onChange={(e) => setRequestDraft((previous) => ({ ...previous, employeeId: e.target.value }))} required><option value="">Select employee</option>{employees.map((employee) => <option key={getEmployeeKey(employee)} value={getEmployeeKey(employee)}>{employee.name} · {employee.employeeId || employee.id}</option>)}</select></label><label>Leave type<select value={requestDraft.type} onChange={(e) => setRequestDraft((previous) => ({ ...previous, type: e.target.value }))}>{["EL", "PL", "CL", "SL", "CO"].map((type) => <option key={type} value={type}>{LEAVE_TYPES.find((item) => item.code === type)?.name}</option>)}</select></label><label>From<input type="date" value={requestDraft.from} onChange={(e) => setRequestDraft((previous) => ({ ...previous, from: e.target.value }))} required /></label><label>To<input type="date" min={requestDraft.from || undefined} value={requestDraft.to} onChange={(e) => setRequestDraft((previous) => ({ ...previous, to: e.target.value }))} required /></label><label className="leave-field-full">Reason<textarea rows="3" value={requestDraft.reason} onChange={(e) => setRequestDraft((previous) => ({ ...previous, reason: e.target.value }))} placeholder="Enter reason" /></label><button className="leave-btn leave-btn-primary leave-field-full" disabled={saving}>{saving ? "Submitting…" : "Submit leave request"}</button><small className="leave-help-text leave-field-full">Force Leave is company-marked in Attendance and cannot be requested by an employee.</small></form></article><article className="leave-card"><div className="leave-card-header"><div><span className="leave-eyebrow">WORKFLOW</span><h2>Request register</h2><p>Approve or reject requests and retain decision history.</p></div><span className="leave-status-count">{stats.pendingRequests} pending</span></div><div className="leave-request-list">{store.requests.length === 0 ? <div className="leave-empty-state"><strong>No leave requests yet</strong><p>Submitted requests will appear here.</p></div> : store.requests.map((request) => { const employee = employees.find((item) => getEmployeeKey(item) === String(request.employeeId)); const canAct = ["Pending", "Pending HR/Admin"].includes(request.status) && !(/employee self service/i.test(String(request.source || "")) && String(request.approvalStage || "").toUpperCase() === "HOD"); return <div className="leave-request-row" key={request.id}><div className="leave-request-main"><strong>{employee?.name || request.employeeName || request.employeeId}</strong><span>{LEAVE_TYPES.find((item) => item.code === request.type)?.name || request.type} · {request.from} → {request.to} · {request.days} day(s)</span><small>{request.reason || "No reason provided"}</small>{/employee self service/i.test(String(request.source || "")) && <small>HOD: {request.hodName || "Not configured"} · {request.hodStatus || "Pending"} · HR/Admin: {request.hrAdminStatus || "CC"}</small>}</div><div className="leave-request-actions"><span className={`leave-status ${request.status === "Approved" ? "leave-status-active" : request.status === "Rejected" ? "leave-status-danger" : "leave-status-warning"}`}>{request.status}</span>{canAct && <><button className="leave-table-action" disabled={saving} onClick={() => updateRequestStatus(request.id, "approve")}>Approve</button><button className="leave-table-action danger" disabled={saving} onClick={() => updateRequestStatus(request.id, "reject")}>Reject</button></>}</div></div>; })}</div></article></div>}







      {activeTab === "compoff" && <article className="leave-card"><div className="leave-card-header"><div><span className="leave-eyebrow">COMPENSATORY OFF</span><h2>Comp-Off ledger</h2><p>CO-E is earned, CO-U is utilised and legacy CO is treated as utilisation for balance compatibility.</p></div></div><div className="leave-table-wrap"><table className="leave-table"><thead><tr><th>Employee</th><th>CO-E Earned</th><th>CO-U Utilised</th><th>Legacy CO</th><th>Available</th></tr></thead><tbody>{filteredEmployees.map((employee) => { const result = getBalance(employee); return <tr key={getEmployeeKey(employee)}><td><strong>{employee.name}</strong><small>{employee.employeeId || employee.id}</small></td><td>{formatDays(result.attendanceStats.COEarned)}</td><td>{formatDays(result.attendanceStats.COUsed)}</td><td>{formatDays(result.attendanceStats.legacyCOUsed)}</td><td><strong>{formatDays(result.balances.CO.available)}</strong></td></tr>; })}</tbody></table></div></article>}







      {activeTab === "calendar" && <article className="leave-card"><div className="leave-card-header"><div><span className="leave-eyebrow">LEAVE CALENDAR</span><h2>Attendance-linked leave calendar</h2><p>Calendar entries are read from the current Attendance snapshot. Approved requests are shown separately.</p></div><select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>{[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => <option key={year}>{year}</option>)}</select></div><div className="leave-calendar-list">{Object.entries(attendance).filter(([dateKey]) => dateKey.startsWith(`${selectedYear}-`)).sort(([a], [b]) => b.localeCompare(a)).flatMap(([dateKey, day]) => employees.map((employee) => { const row = findAttendanceRow(day, employee); if (!row || !["EL", "PL", "CL", "SL", "FL", "CO-E", "CO-U", "CO"].includes(normalizeStatus(row.status))) return null; const status = normalizeStatus(row.status); return <div className="leave-calendar-row" key={`${dateKey}-${getEmployeeKey(employee)}`}><span className="leave-calendar-date">{dateKey}</span><span className={`leave-calendar-code code-${status.toLowerCase().replace(/[^a-z]/g, "")}`}>{status}</span><div><strong>{employee.name}</strong><small>{status === "FL" ? `Force Leave · ${getForceLeaveTreatment(resolvePolicy(store.policies, employee, dateKey), employee)}` : (LEAVE_TYPES.find((item) => item.code === status)?.name || (status === "CO-E" ? "Comp-Off Earned" : status === "CO-U" ? "Comp-Off Utilisation" : "Comp-Off (Legacy)"))}</small></div></div>; }).filter(Boolean))}{!Object.keys(attendance).some((dateKey) => dateKey.startsWith(`${selectedYear}-`)) && <div className="leave-empty-state"><strong>No attendance leave entries for {selectedYear}</strong><p>Once Attendance has EL, PL, CL, SL, FL or Comp-Off entries, they will appear here.</p></div>}</div></article>}







      {activeTab === "reports" && <div className="leave-reports-page">
        <div className="leave-report-hero">
          <div><span className="leave-eyebrow">REPORTS & AUDIT</span><h2>Leave report center</h2><p>Filter attendance-linked leave marks by employee, leave type, month and year, then export the selected data.</p></div>
          <div className="leave-report-actions"><button className="leave-btn leave-btn-secondary" onClick={exportLeaveReportExcel}>↓ Export Excel</button><button className="leave-btn leave-btn-primary" onClick={exportLeaveReportPdf}>▣ Export PDF</button></div>
        </div>

        <div className="leave-report-layout">
          <article className="leave-card leave-report-data-card">
            <div className="leave-card-header"><div><span className="leave-eyebrow">LEAVE DATA</span><h2>Filtered leave register</h2><p>Showing {leaveReportRows.length} attendance leave row(s) for the selected filters.</p></div><span className="leave-status-count">{selectedYear}</span></div>
            <div className="leave-report-filter-grid">
              <label>Year<select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>{[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
              <label>Employee<select value={reportEmployeeId} onChange={(event) => setReportEmployeeId(event.target.value)}><option value="">All employees</option>{employees.map((employee) => <option key={getEmployeeKey(employee)} value={getEmployeeKey(employee)}>{employee.name || "Unnamed"} · {employee.employeeId || employee.id}</option>)}</select></label>
              <label>Leave type<select value={reportLeaveType} onChange={(event) => setReportLeaveType(event.target.value)}><option value="ALL">All leave types</option><option value="EL">EL — Earned Leave</option><option value="PL">PL — Privilege Leave</option><option value="CL">CL — Casual Leave</option><option value="SL">SL — Sick Leave</option><option value="FL">FL — Force Leave</option><option value="CO-E">CO-E — Comp-Off Earned</option><option value="CO-U">CO-U — Comp-Off Utilised</option><option value="CO">CO — Legacy Comp-Off</option></select></label>
              <label>Month<select value={reportMonth} onChange={(event) => setReportMonth(event.target.value)}><option value="ALL">All months</option>{reportMonthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select></label>
              <button className="leave-btn leave-btn-secondary leave-report-reset" onClick={() => { setReportEmployeeId(""); setReportLeaveType("ALL"); setReportMonth("ALL"); }}>Reset filters</button>
            </div>

            <div className="leave-report-stat-grid"><div className="blue"><span>Total marks</span><strong>{formatDays(leaveReportSummary.total)}</strong></div><div className="green"><span>EL / PL</span><strong>{formatDays(leaveReportSummary.EL + leaveReportSummary.PL)}</strong></div><div className="amber"><span>CL / SL</span><strong>{formatDays(leaveReportSummary.CL + leaveReportSummary.SL)}</strong></div><div className="orange"><span>FL</span><strong>{formatDays(leaveReportSummary.FL)}</strong></div><div className="purple"><span>Comp-Off</span><strong>{formatDays(leaveReportSummary["CO-E"] + leaveReportSummary["CO-U"])}</strong></div></div>

            <div className="leave-table-wrap"><table className="leave-table leave-report-table"><thead><tr><th>Date</th><th>Employee</th><th>Employee ID</th><th>Department</th><th>Site</th><th>Code</th><th>Leave Type</th><th>Days</th><th>Source</th><th>Remarks</th></tr></thead><tbody>{leaveReportRows.map((row) => <tr key={row.id}><td>{row.date}</td><td><strong>{row.employee}</strong></td><td>{row.employeeId}</td><td>{row.department}</td><td>{row.site}</td><td><span className="leave-report-code">{row.code}</span></td><td>{row.leaveName}</td><td><strong>{formatDays(row.days)}</strong></td><td>{row.source}</td><td>{row.remarks || "—"}</td></tr>)}</tbody></table>{leaveReportRows.length === 0 && <div className="leave-empty-state"><strong>No leave data found</strong><p>Try changing the employee, leave type, month or year filters.</p></div>}</div>
          </article>

          <article className="leave-card leave-audit-card"><div className="leave-card-header"><div><span className="leave-eyebrow">AUDIT TRAIL</span><h2>Recent changes</h2><p>Policy, balance and request actions.</p></div></div><div className="leave-audit-list">{store.audit.slice(0, 30).map((item) => <div className="leave-audit-row" key={item.id}><span className="leave-audit-dot" /><div><strong>{String(item.action || "CHANGE").replace(/[_-]/g, " ")}</strong><small>{item.policyName || item.employeeId || item.requestId || "Leave Management"}</small><time>{item.timestamp ? new Date(item.timestamp).toLocaleString("en-IN") : "—"}</time></div></div>)}{store.audit.length === 0 && <div className="leave-empty-state">No audit entries yet.</div>}</div></article>
        </div>
      </div>}

    </section>



  );



}
