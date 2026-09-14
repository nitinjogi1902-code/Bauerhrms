import { useMemo, useState } from "react";
import "./organization.css";

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
    key: "employeeGroups",
    label: "Employee Group",
    singular: "Employee Group",
    description: "Workforce categories maintained by HR.",
    placeholder: "e.g. Third Party (Associates)",
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
      return {
        ...DEFAULT_MASTERS,
        ...parsed,
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
    assignmentType: "Employee Group",
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
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
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
        assignmentType: "Employee Group",
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

    if (activeMaster === "shifts") {
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
        assignmentType: "Employee Group",
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
          {activeMaster === "leavePolicies" ? "Configure Policy" : `Add ${currentConfig.singular}`}
        </button>
      </div>

      <div className="organization-layout">
        <aside className="master-sidebar">
          <div className="master-sidebar-title">ORGANIZATION MASTERS</div>

          {MASTER_CONFIG.map((master) => (
            <button
              key={master.key}
              className={`master-nav ${
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
                + {activeMaster === "leavePolicies" ? "Configure" : "Add"}
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
                    <option>Employee Group</option>
                    <option>Vendor</option>
                    <option>All Employees</option>
                  </select>
                </label>
                <label>
                  {weekOffForm.assignmentType === "Employee Group" ? "Employee Group *" : weekOffForm.assignmentType === "Vendor" ? "Vendor *" : "Assignment"}
                  {weekOffForm.assignmentType === "All Employees" ? (
                    <input value="Organisation-wide" disabled />
                  ) : (
                    <select value={weekOffForm.assignmentValue} onChange={(e) => setWeekOffForm({ ...weekOffForm, assignmentValue: e.target.value })}>
                      <option value="">Select {weekOffForm.assignmentType}</option>
                      {(weekOffForm.assignmentType === "Employee Group" ? (masters.employeeGroups || []) : (masters.jobRoles || []))
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
                    <option value="ALL">All Employees</option><option value="SITE">Specific Site</option><option value="EMPLOYEE_GROUP">Employee Group</option><option value="EMPLOYEE">Specific Employee</option>
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

          {showForm && !["shifts", "leavePolicies", "holidays", "weekOffPolicies"].includes(activeMaster) && (
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

          {activeMaster === "holidays" ? (
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