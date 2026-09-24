import { useEffect, useMemo, useState } from "react";
import "./dashboard.css";
import { supabase } from "./supabaseClient";

import Attendance from "./attendance";
import Employees from "./employees";
import Organization from "./Organization";
import VendorAgreements from "./VendorAgreements";
import Payroll from "./Payroll";
import Leave from "./Leave";
import Recruitment from "./Recruitment";
import SelfService from "./SelfService";
import Training from "./Training";
import PMS from "./PMS";
import Reports from "./Reports_MIS_Control_Tower";
import Settings from "./Settings";
import ForceLeave from "./forceLeave";

const menuItems = [
  { name: "Dashboard", icon: "dashboard" },
  { name: "Self Service", icon: "self" },
  { name: "Employees", icon: "users" },
  { name: "Attendance", icon: "clock" },
  { name: "Leave", icon: "calendar" },
  { name: "Payroll", icon: "wallet" },
  { name: "Vendors", icon: "briefcase" },
  { name: "Organization", icon: "building" },
  { name: "Recruitment", icon: "user-plus" },
  { name: "Training", icon: "graduation" },
  { name: "PMS", icon: "target" },
  { name: "Reports", icon: "chart" },
  { name: "Settings", icon: "settings" },
];

const apps = [
  ["Attendance", "Daily attendance", "clock", "blue"],
  ["Payroll", "Salary processing", "wallet", "green"],
  ["Device", "Device management", "smartphone", "red"],
  ["Reports", "HR reports & MIS", "chart", "yellow"],
  ["Self Service", "Employee self service", "user", "orange"],
  ["EDOC", "Employee documents", "file", "cyan"],
  ["Recruitment", "Candidate management", "user-plus", "purple"],
  ["Force Leave", "Force Leave management", "calendar", "purple"],
  ["Onboarding", "New employee joining", "sparkles", "violet"],
  ["Performance", "Performance management", "target", "pink"],
  ["Task", "Task management", "check", "indigo"],
  ["L & D", "Learning & development", "graduation", "teal"],
  ["Polls & Surveys", "Employee surveys", "message", "magenta"],
  ["Vizitrac", "Visitor tracking", "scan", "sky"],
  ["Helpdesk", "HR support", "headset", "gold"],
];

const shifts = [
  { name: "B06", time: "14:30 - 23:00", expected: 211, punched: 36 },
  { name: "General_B", time: "11:00 - 19:30", expected: 18, punched: 9 },
  { name: "A06", time: "06:00 - 14:30", expected: 164, punched: 48 },
];


const EMPLOYEE_STORAGE_KEY = "bauerHrmsEmployees";
const AGREEMENT_STORAGE_KEY = "bauerHrmsVendorAgreements";
const PO_STORAGE_KEY = "bauerHrmsVendorPOs";
const ORG_STORAGE_KEY = "bauerHrmsOrganizationMasters";
const RECRUITMENT_REQ_KEY = "bauerHrmsRecruitmentRequirements";
const RECRUITMENT_CANDIDATE_KEY = "bauerHrmsRecruitmentCandidates";
const RECRUITMENT_INTERVIEW_KEY = "bauerHrmsRecruitmentInterviews";
const RECRUITMENT_OFFER_KEY = "bauerHrmsRecruitmentOffers";

function readDashboardData(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function readDashboardEmployeeRecords() {
  const candidateKeys = [
    EMPLOYEE_STORAGE_KEY,
    "employees",
    "employeeRecords",
    "employeeMaster",
    "bauerHrmsEmployeeMaster",
  ];

  for (const key of candidateKeys) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) continue;

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) continue;

      // Accept only records that look like employee master records.
      const employeeRecords = parsed.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          (
            item.employeeId ||
            item.employeeCode ||
            item.name ||
            item.employeeName ||
            item.fullName
          )
      );

      if (employeeRecords.length || key === EMPLOYEE_STORAGE_KEY) {
        return employeeRecords;
      }
    } catch {
      // Try the next supported storage key.
    }
  }

  return [];
}

function readRecruitmentJSON(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function activeMasterNames(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => typeof item === "string" || item?.active !== false)
    .map((item) => (typeof item === "string" ? item : item.name))
    .filter(Boolean);
}

function dashboardAgreementStatus(agreement) {
  if (agreement?.manualStatus === "On Hold") return "On Hold";
  if (agreement?.manualStatus === "Cancelled") return "Cancelled";
  if (!agreement?.agreementStart || !agreement?.agreementEnd) return "Draft";

  const today = new Date();
  const start = new Date(`${agreement.agreementStart}T00:00:00`);
  const end = new Date(`${agreement.agreementEnd}T23:59:59`);

  if (today < start) return "Future";
  if (today > end) return "Expired";
  return "Active";
}

function dashboardPOStatus(po) {
  if (po?.manualStatus === "On Hold") return "On Hold";
  if (po?.manualStatus === "Cancelled") return "Cancelled";
  if (!po?.poStart || !po?.poEnd) return "Draft";

  const today = new Date();
  const start = new Date(`${po.poStart}T00:00:00`);
  const end = new Date(`${po.poEnd}T23:59:59`);

  if (today < start) return "Future";
  if (today > end) return "Expired";
  return "Active";
}

function dashboardDaysLeft(dateValue) {
  if (!dateValue) return null;
  const end = new Date(`${dateValue}T23:59:59`);
  return Math.ceil((end - new Date()) / 86400000);
}

function dashboardFormatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function parseDashboardDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dashboardAge(dob) {
  const birth = parseDashboardDate(dob);
  if (!birth) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function dashboardServiceYears(doj) {
  const joining = parseDashboardDate(doj);
  if (!joining) return null;

  const today = new Date();
  const years =
    today.getFullYear() -
    joining.getFullYear() -
    (
      today.getMonth() < joining.getMonth() ||
      (today.getMonth() === joining.getMonth() && today.getDate() < joining.getDate())
        ? 1
        : 0
    );

  const months =
    (today.getFullYear() - joining.getFullYear()) * 12 +
    today.getMonth() -
    joining.getMonth() -
    (today.getDate() < joining.getDate() ? 1 : 0);

  return {
    years: Math.max(years, 0),
    months: Math.max(months, 0),
  };
}

function dashboardUpcomingEvents(employeeList) {
  const today = new Date();
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + 30);

  const events = [];

  employeeList.forEach((employee) => {
    if (!employee || String(employee.status || "Active").toLowerCase() !== "active") return;

    const name = employee.name || employee.employeeName || employee.fullName;
    if (!name) return;

    const dob = parseDashboardDate(employee.dateOfBirth || employee.dob);
    const doj = parseDashboardDate(employee.dateOfJoining || employee.doj);

    [
      { sourceDate: dob, type: "Birthday", gender: String(employee.gender || "").toLowerCase() },
      { sourceDate: doj, type: "Anniversary", gender: String(employee.gender || "").toLowerCase() },
    ].forEach(({ sourceDate, type, gender }) => {
      if (!sourceDate) return;

      const nextDate = new Date(today.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
      if (nextDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        nextDate.setFullYear(today.getFullYear() + 1);
      }

      if (nextDate >= today && nextDate <= horizon) {
        events.push({
          name,
          date: nextDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          type,
          gender: gender.includes("female") ? "female" : "male",
          sortDate: nextDate.getTime(),
        });
      }
    });
  });

  return events.sort((a, b) => a.sortDate - b.sortDate).slice(0, 6);
}

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    user: <><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></>,
    "user-plus": <><circle cx="9" cy="8" r="4"/><path d="M3 21a6 6 0 0 1 12 0M19 8v6M22 11h-6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9h18"/></>,
    wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 7h14M16 14h5"/><circle cx="16" cy="14" r=".8"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
    building: <><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M8 19h4"/></>,
    graduation: <><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 11.5V16c3 2 7 2 10 0v-4.5M21 10v6"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.41 1.41-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V21h-2v-.09A1.7 1.7 0 0 0 12.37 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-1.41-1.41.06-.06A1.7 1.7 0 0 0 9.42 16.45a1.7 1.7 0 0 0-1.56-1.04H7v-2h.86a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.41-1.41.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.41 7.9V7h2v.9a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.41 1.41-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 13H21v2h-.1A1.7 1.7 0 0 0 19.4 15Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    smartphone: <><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M10 5h4M11 18.5h2"/></>,
    sparkles: <><path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
    message: <><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></>,
    scan: <><path d="M5 3H3v2M19 3h2v2M5 21H3v-2M21 19v2h-2M7 8v8M10 8v8M14 8v8M17 8v8"/></>,
    headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2M20 14a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2M17 16c0 2-2 4-5 4"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.7 1.8c-1 .7-1.5 1.1-1.5 2.4M12 17h.01"/></>,
    trend: <><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/></>,
  };
  return <svg {...common}>{paths[name] || paths.dashboard}</svg>;
}


function normalizePermissionCode(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "object") {
    return String(
      value.permission_code ||
      value.permissionCode ||
      value.code ||
      value.key ||
      value.name ||
      ""
    ).trim().toLowerCase();
  }
  return "";
}

function getCurrentUserPermissions(currentUser) {
  const sources = [
    currentUser?.permissions,
    currentUser?.permissionCodes,
    currentUser?.permission_codes,
    currentUser?.permissionKeys,
    currentUser?.permission_keys,
  ];

  return new Set(
    sources
      .flatMap((source) => (Array.isArray(source) ? source : source ? [source] : []))
      .map(normalizePermissionCode)
      .filter(Boolean)
  );
}

const MENU_PERMISSION_MAP = {
  Dashboard: "dashboard.view",
  "Self Service": "self_service.view",
  Employees: "employees.view",
  Attendance: "attendance.view",
  Leave: "leave.view",
  Payroll: "payroll.view",
  Vendors: "vendors.view",
  Organization: "organization.view",
  Recruitment: "recruitment.view",
  Training: "training.view",
  PMS: "pms.view",
  Reports: "reports.view",
  Settings: "settings.view",
};

function Dashboard({ onLogout, currentUser = null }) {
  const [resolvedPermissions, setResolvedPermissions] = useState([]);
  const [permissionsResolved, setPermissionsResolved] = useState(false);

  const userPermissions = useMemo(
    () => getCurrentUserPermissions(currentUser),
    [currentUser]
  );

  const isPlatformSuperAdmin = Boolean(
    currentUser?.isPlatformSuperAdmin === true ||
      currentUser?.role === "Super Admin" ||
      currentUser?.role === "Platform Super Admin"
  );

  const hasPermission = (permission) => {
    const code = String(permission || "").trim().toLowerCase();
    if (isPlatformSuperAdmin) return true;

    // Keep the sidebar visible while the background permission check is
    // running. The login session already contains the user's role permissions.
    // Once the authoritative Supabase check completes, use only the resolved
    // company-enabled permissions.
    if (!permissionsResolved) return userPermissions.has(code);

    // If the background check returns no permissions, do not make the entire
    // sidebar disappear. Keep the existing session permissions visible until
    // the permission state is explicitly confirmed.
    if (!resolvedPermissions.length) return userPermissions.has(code);

    return resolvedPermissions.includes(code);
  };

  const canAccessMenu = (menuName) => {
  if (menuName === "Force Leave") return true;

  return (
    isPlatformSuperAdmin ||
    hasPermission(MENU_PERMISSION_MAP[menuName])
  );
};

  const firstAllowedMenu = useMemo(() => {
    const employeeRole = String(currentUser?.role || "").trim().toLowerCase() === "employee";
    if (employeeRole && canAccessMenu("Self Service")) return "Self Service";
    return menuItems.find((item) => canAccessMenu(item.name))?.name || "Dashboard";
  }, [currentUser, userPermissions, resolvedPermissions, permissionsResolved]);

  useEffect(() => {
    let cancelled = false;

    const loadPermissions = async () => {
      if (isPlatformSuperAdmin) {
        setPermissionsResolved(true);
        setResolvedPermissions([]);
        return;
      }

      setPermissionsResolved(false);

      const authUserId =
        currentUser?.userId ||
        currentUser?.user_id ||
        currentUser?.authUserId ||
        currentUser?.auth_user_id ||
        currentUser?.id;

      if (!authUserId) {
        setResolvedPermissions([]);
        setPermissionsResolved(true);
        return;
      }

      try {
        const { data: organizationUser, error: organizationUserError } = await supabase
          .from("organization_users")
          .select("id, organization_id, status")
          .eq("user_id", authUserId)
          .maybeSingle();

        if (organizationUserError) throw organizationUserError;

        if (
          !organizationUser ||
          String(organizationUser.status || "active").toLowerCase() !== "active"
        ) {
          if (!cancelled) { setResolvedPermissions([]); setPermissionsResolved(true); }
          return;
        }

        const { data: roleLinks, error: roleError } = await supabase
          .from("organization_user_roles")
          .select("role_id")
          .eq("organization_user_id", organizationUser.id);

        if (roleError) throw roleError;

        const roleIds = (roleLinks || []).map((item) => item.role_id).filter(Boolean);
        if (!roleIds.length) {
          if (!cancelled) { setResolvedPermissions([]); setPermissionsResolved(true); }
          return;
        }

        const { data: rolePermissions, error: permissionError } = await supabase
          .from("role_permissions")
          .select("permission_id")
          .in("role_id", roleIds);

        if (permissionError) throw permissionError;

        const permissionIds = Array.from(
          new Set((rolePermissions || []).map((item) => item.permission_id).filter(Boolean))
        );

        if (!permissionIds.length) {
          if (!cancelled) { setResolvedPermissions([]); setPermissionsResolved(true); }
          return;
        }

        const [
          { data: permissions, error: permissionsError },
          { data: organizationModules, error: organizationModulesError },
        ] = await Promise.all([
          supabase
            .from("permissions")
            .select("id, permission_code")
            .in("id", permissionIds),
          supabase
            .from("organization_modules")
            .select("module_id")
            .eq("organization_id", organizationUser.organization_id),
        ]);

        if (permissionsError) throw permissionsError;
        if (organizationModulesError) throw organizationModulesError;

        const enabledModuleIds = Array.from(
          new Set(
            (organizationModules || [])
              .map((item) => item?.module_id)
              .filter(Boolean)
          )
        );

        if (!enabledModuleIds.length) {
          if (!cancelled) { setResolvedPermissions([]); setPermissionsResolved(true); }
          return;
        }

        const { data: enabledModules, error: enabledModulesError } = await supabase
          .from("platform_modules")
          .select("id, module_code")
          .in("id", enabledModuleIds)
          .eq("is_active", true);

        if (enabledModulesError) throw enabledModulesError;

        const enabledModuleCodes = new Set(
          (enabledModules || [])
            .map((item) => String(item?.module_code || "").trim().toLowerCase())
            .filter(Boolean)
        );

        // Effective access = Role Permission AND Company Module Access.
        const codes = Array.from(
          new Set(
            (permissions || [])
              .map((item) => String(item?.permission_code || "").trim().toLowerCase())
              .filter(Boolean)
              .filter((code) => {
                const moduleCode = code.split(".")[0];
                return enabledModuleCodes.has(moduleCode);
              })
          )
        );

        if (!cancelled) { setResolvedPermissions(codes); setPermissionsResolved(true); }
      } catch (error) {
        console.error("Unable to load company user permissions:", error);
        if (!cancelled) { setResolvedPermissions([]); setPermissionsResolved(true); }
      }
    };

    loadPermissions();
    return () => { cancelled = true; };
  }, [
    currentUser?.userId,
    currentUser?.user_id,
    currentUser?.authUserId,
    currentUser?.auth_user_id,
    currentUser?.id,
    isPlatformSuperAdmin,
  ]);

  const [activeMenu, setActiveMenu] = useState(
    firstAllowedMenu
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  // Dashboard period controls are date-driven.
  // FY follows the Indian financial year (April-March), and the current
  // month/FY are generated automatically from today's date.
  const getDashboardCurrentFinancialYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const fyStart = month >= 4 ? year : year - 1;
    return `${fyStart}-${String(fyStart + 1).slice(-2)}`;
  };

  const getDashboardCurrentMonthValue = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  };

  const [financialYear, setFinancialYear] = useState(
    getDashboardCurrentFinancialYear()
  );
  const [month, setMonth] = useState(getDashboardCurrentMonthValue());

  const dashboardCurrentFY = getDashboardCurrentFinancialYear();
  const dashboardCurrentMonth = getDashboardCurrentMonthValue();

  const dashboardFinancialYearOptions = useMemo(() => {
    const currentFYStart = Number(dashboardCurrentFY.slice(0, 4));
    const firstFYStart = Math.min(2024, currentFYStart);

    return Array.from(
      { length: currentFYStart - firstFYStart + 1 },
      (_, index) => {
        const startYear = currentFYStart - index;
        return `${startYear}-${String(startYear + 1).slice(-2)}`;
      }
    );
  }, [dashboardCurrentFY]);

  const dashboardMonthOptions = useMemo(() => {
    const match = String(financialYear || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return [];

    const fyStartYear = Number(match[1]);
    const fyEndYear = fyStartYear + 1;
    const isCurrentFY = financialYear === dashboardCurrentFY;

    const startDate = new Date(fyStartYear, 3, 1); // April
    const endDate = isCurrentFY
      ? new Date(
          Number(dashboardCurrentMonth.slice(0, 4)),
          Number(dashboardCurrentMonth.slice(5, 7)),
          0
        )
      : new Date(fyEndYear, 2, 1); // March

    const options = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const year = cursor.getFullYear();
      const monthNumber = cursor.getMonth() + 1;
      const value = `${year}-${String(monthNumber).padStart(2, "0")}`;

      options.push({
        value,
        label: cursor.toLocaleString("en-IN", {
          month: "long",
          year: "numeric",
        }),
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return options.reverse();
  }, [financialYear, dashboardCurrentFY, dashboardCurrentMonth]);

  useEffect(() => {
    if (!dashboardFinancialYearOptions.includes(financialYear)) {
      setFinancialYear(dashboardCurrentFY);
      return;
    }

    const validMonths = dashboardMonthOptions.map((item) => item.value);

    if (!validMonths.includes(month)) {
      setMonth(
        financialYear === dashboardCurrentFY
          ? dashboardCurrentMonth
          : validMonths[0] || dashboardCurrentMonth
      );
    }
  }, [
    financialYear,
    month,
    dashboardFinancialYearOptions,
    dashboardMonthOptions,
    dashboardCurrentFY,
    dashboardCurrentMonth,
  ]);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState(() => readDashboardEmployeeRecords());
  const [employeeCount, setEmployeeCount] = useState(0);
  const [employeeCountLoading, setEmployeeCountLoading] = useState(true);
  const [agreements, setAgreements] = useState([]);
  const [pos, setPos] = useState([]);
  const [organization, setOrganization] = useState({});
  const [recruitmentRequirements, setRecruitmentRequirements] = useState(() =>
    readRecruitmentJSON(RECRUITMENT_REQ_KEY)
  );
  const [recruitmentCandidates, setRecruitmentCandidates] = useState(() =>
    readRecruitmentJSON(RECRUITMENT_CANDIDATE_KEY)
  );
  const [recruitmentInterviews, setRecruitmentInterviews] = useState(() =>
    readRecruitmentJSON(RECRUITMENT_INTERVIEW_KEY)
  );
  const [recruitmentOffers, setRecruitmentOffers] = useState(() =>
    readRecruitmentJSON(RECRUITMENT_OFFER_KEY)
  );

  const loadTenantEmployeeCount = async () => {
    try {
      setEmployeeCountLoading(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (!user?.id) {
        setEmployeeCount(0);
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_users")
        .select("organization_id, status")
        .eq("user_id", user.id)
        .eq("status", "Active")
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.organization_id) {
        setEmployeeCount(0);
        return;
      }

      const organizationId = membership.organization_id;

      const { count, error: employeeCountError } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);

      if (employeeCountError) throw employeeCountError;

      setEmployeeCount(Number(count || 0));
    } catch (error) {
      console.error("Unable to load tenant employee count:", error);
      setEmployeeCount(0);
    } finally {
      setEmployeeCountLoading(false);
    }
  };

  const loadVendorDashboardData = () => {
    const employeeRecords = readDashboardEmployeeRecords();
    setEmployees(employeeRecords);
    setAgreements(readDashboardData(AGREEMENT_STORAGE_KEY));
    setPos(readDashboardData(PO_STORAGE_KEY));
    setOrganization(readDashboardData(ORG_STORAGE_KEY));
  };

  useEffect(() => {
    loadVendorDashboardData();
    loadTenantEmployeeCount();

    const refresh = () => {
      loadVendorDashboardData();
      loadTenantEmployeeCount();
      setRecruitmentRequirements(readRecruitmentJSON(RECRUITMENT_REQ_KEY));
      setRecruitmentCandidates(readRecruitmentJSON(RECRUITMENT_CANDIDATE_KEY));
      setRecruitmentInterviews(readRecruitmentJSON(RECRUITMENT_INTERVIEW_KEY));
      setRecruitmentOffers(readRecruitmentJSON(RECRUITMENT_OFFER_KEY));
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("bauerHrmsEmployeesUpdated", refresh);
    window.addEventListener("bauerHrmsAgreementsUpdated", refresh);
    window.addEventListener("bauerHrmsPOsUpdated", refresh);
    window.addEventListener("bauerHrmsOrganizationUpdated", refresh);
    window.addEventListener("bauerHrmsRecruitmentUpdated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bauerHrmsEmployeesUpdated", refresh);
      window.removeEventListener("bauerHrmsAgreementsUpdated", refresh);
      window.removeEventListener("bauerHrmsPOsUpdated", refresh);
      window.removeEventListener("bauerHrmsOrganizationUpdated", refresh);
      window.removeEventListener("bauerHrmsRecruitmentUpdated", refresh);
    };
  }, []);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const filteredApps = apps.filter(([name]) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const handleMenu = (name) => {
    if (!canAccessMenu(name)) return;

    if (currentUser?.role === "Employee" && name !== "Self Service") {
      if (canAccessMenu("Self Service")) setActiveMenu("Self Service");
      return;
    }

    setActiveMenu(name);
    if (window.innerWidth < 900) setSidebarOpen(false);
  };

  const activeEmployees = employees.filter(
    (employee) =>
      String(employee.status || "Active").toLowerCase() === "active"
  );

  const genderCounts = activeEmployees.reduce(
    (result, employee) => {
      const gender = String(employee.gender || "").trim().toLowerCase();
      if (gender === "male") result.male += 1;
      else if (gender === "female") result.female += 1;
      else result.other += 1;
      return result;
    },
    { male: 0, female: 0, other: 0 }
  );

  const employeeAgeData = [
    { age: "20-25", male: 0, female: 0, other: 0 },
    { age: "26-35", male: 0, female: 0, other: 0 },
    { age: "36-40", male: 0, female: 0, other: 0 },
    { age: "41-58", male: 0, female: 0, other: 0 },
    { age: "59+", male: 0, female: 0, other: 0 },
  ];

  activeEmployees.forEach((employee) => {
    const age = dashboardAge(employee.dateOfBirth || employee.dob);
    if (age === null) return;

    const bucket =
      age <= 25
        ? employeeAgeData[0]
        : age <= 35
          ? employeeAgeData[1]
          : age <= 40
            ? employeeAgeData[2]
            : age <= 58
              ? employeeAgeData[3]
              : employeeAgeData[4];

    const gender = String(employee.gender || "").trim().toLowerCase();
    if (gender === "male") bucket.male += 1;
    else if (gender === "female") bucket.female += 1;
    else bucket.other += 1;
  });

  const averageAge = activeEmployees
    .map((employee) => dashboardAge(employee.dateOfBirth || employee.dob))
    .filter((age) => age !== null);

  const averageAgeValue = averageAge.length
    ? (
        averageAge.reduce((sum, age) => sum + age, 0) / averageAge.length
      ).toFixed(1)
    : "—";

  const serviceMonths = activeEmployees
    .map(
      (employee) =>
        dashboardServiceYears(employee.dateOfJoining || employee.doj)?.months
    )
    .filter((months) => Number.isFinite(months));

  const averageServiceValue = serviceMonths.length
    ? (
        serviceMonths.reduce((sum, months) => sum + months, 0) /
        serviceMonths.length /
        12
      ).toFixed(1)
    : "—";

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentJoinees = activeEmployees.filter((employee) => {
    const doj = parseDashboardDate(employee.dateOfJoining || employee.doj);
    return doj && doj >= ninetyDaysAgo;
  }).length;

  const exitDateValue = (employee) =>
    employee.exitDate ||
    employee.dateOfExit ||
    employee.lastWorkingDate ||
    employee.dol ||
    "";

  const recentExits = employees.filter((employee) => {
    const exitDate = parseDashboardDate(exitDateValue(employee));
    return exitDate && exitDate >= ninetyDaysAgo && exitDate <= new Date();
  }).length;

  const totalGenderKnown = genderCounts.male + genderCounts.female;
  const malePercentage = totalGenderKnown
    ? ((genderCounts.male / totalGenderKnown) * 100).toFixed(1)
    : "0.0";

  const femalePercentage = totalGenderKnown
    ? ((genderCounts.female / totalGenderKnown) * 100).toFixed(1)
    : "0.0";

  const maleShare = activeEmployees.length
    ? (genderCounts.male / activeEmployees.length) * 100
    : 0;
  const femaleShare = activeEmployees.length
    ? (genderCounts.female / activeEmployees.length) * 100
    : 0;

  const dashboardStats = [
    {
      title: "Active employees",
      value: activeEmployees.length.toLocaleString("en-IN"),
      change: `${employees.length.toLocaleString("en-IN")} records`,
      note: "Current active workforce",
      icon: "users",
      color: "purple",
    },
    {
      title: "New joiners",
      value: recentJoinees.toLocaleString("en-IN"),
      change: "Last 90 days",
      note: "Based on joining date",
      icon: "user-plus",
      color: "green",
    },
    {
      title: "Recent exits",
      value: recentExits.toLocaleString("en-IN"),
      change: "Last 90 days",
      note: "Based on exit date",
      icon: "trend",
      color: "orange",
    },
    {
      title: "Average age",
      value: averageAgeValue,
      change: "Years",
      note: "Active employee records",
      icon: "user",
      color: "blue",
    },
    {
      title: "Average service",
      value: averageServiceValue,
      change: "Years",
      note: "Calculated from DOJ",
      icon: "clock",
      color: "pink",
    },
    {
      title: "Gender ratio",
      value: `${genderCounts.male} : ${genderCounts.female}`,
      change: `${malePercentage}% male`,
      note: "Male : Female",
      icon: "users",
      color: "violet",
    },
  ];

  const dashboardEvents = dashboardUpcomingEvents(activeEmployees);

  const dashboardShiftRows = Array.from(
    new Set(activeEmployees.map((employee) => employee.shift).filter(Boolean))
  ).map((shiftName) => ({
    name: shiftName,
    time: "",
    expected: activeEmployees.filter(
      (employee) =>
        String(employee.shift || "").toLowerCase() ===
        String(shiftName).toLowerCase()
    ).length,
    punched: "—",
  }));

  const configuredVendors = activeMasterNames(organization.jobRoles);
  const vendorNames = Array.from(
    new Set([
      ...configuredVendors,
      ...activeEmployees.map((employee) => employee.vendor).filter(Boolean),
    ])
  );

  const activeVendorRows = vendorNames
    .map((vendor) => {
      const headcount = activeEmployees.filter(
        (employee) =>
          String(employee.vendor || "").toLowerCase() ===
          vendor.toLowerCase()
      ).length;

      const vendorAgreements = agreements.filter(
        (agreement) =>
          String(agreement.vendor || "").toLowerCase() === vendor.toLowerCase() &&
          dashboardAgreementStatus(agreement) === "Active"
      );

      const vendorPOs = pos.filter((po) => {
        const agreement = agreements.find((item) => item.id === po.agreementId);
        return (
          agreement &&
          String(agreement.vendor || "").toLowerCase() ===
            vendor.toLowerCase() &&
          dashboardPOStatus(po) === "Active"
        );
      });

      return {
        vendor,
        headcount,
        activeAgreements: vendorAgreements.length,
        activePOs: vendorPOs.length,
      };
    })
    .filter(
      (row) =>
        row.headcount > 0 || row.activeAgreements > 0 || row.activePOs > 0
    )
    .sort((a, b) => b.headcount - a.headcount);

  const activePOs = pos
    .map((po) => {
      const agreement = agreements.find((item) => item.id === po.agreementId);
      return {
        ...po,
        vendor: agreement?.vendor || "—",
        agreementNo: agreement?.agreementNo || "—",
        status: dashboardPOStatus(po),
        daysLeft: dashboardDaysLeft(po.poEnd),
      };
    })
    .filter((po) => po.status !== "Cancelled")
    .sort((a, b) => {
      const order = {
        Active: 1,
        "On Hold": 2,
        Future: 3,
        Expired: 4,
        Draft: 5,
      };
      return (order[a.status] || 9) - (order[b.status] || 9);
    });

  const activeVendorHeadcount = activeVendorRows.reduce(
    (sum, row) => sum + row.headcount,
    0
  );
  const activePOCount = activePOs.filter((po) => po.status === "Active").length;
  const expiringPOCount = activePOs.filter(
    (po) =>
      po.status === "Active" &&
      po.daysLeft !== null &&
      po.daysLeft >= 0 &&
      po.daysLeft <= 60
  ).length;

  const attentionCount =
    (dashboardStats[2].value === "—" ? 1 : 1) + expiringPOCount;

  const recruitmentBadgeCount = useMemo(() => {
    const pendingRequirements = recruitmentRequirements.filter(
      (item) =>
        String(item?.status || "").trim().toLowerCase() === "pending approval"
    ).length;

    const selectedCandidates = recruitmentCandidates.filter(
      (item) => String(item?.stage || "").trim().toLowerCase() === "selected"
    ).length;

    const scheduledInterviews = recruitmentInterviews.filter(
      (item) =>
        String(item?.status || "").trim().toLowerCase() ===
        "scheduled"
    ).length;

    const pendingOffers = recruitmentOffers.filter((item) =>
      ["draft", "offer released"].includes(
        String(item?.status || "").trim().toLowerCase()
      )
    ).length;

    return (
      pendingRequirements +
      selectedCandidates +
      scheduledInterviews +
      pendingOffers
    );
  }, [
    recruitmentRequirements,
    recruitmentCandidates,
    recruitmentInterviews,
    recruitmentOffers,
  ]);

  const isEmployee = currentUser?.role === "Employee";

  useEffect(() => {
    if (!canAccessMenu(activeMenu)) {
      setActiveMenu(firstAllowedMenu);
    }
  }, [activeMenu, firstAllowedMenu]);

  const pmsRole = useMemo(() => {
    const role = String(currentUser?.role || "").trim().toLowerCase();

    if (role === "employee") return "employee";
    if (
      role.includes("md") ||
      role.includes("managing director") ||
      role.includes("reviewer 2") ||
      role === "reviewer2"
    ) {
      return "reviewer2";
    }
    if (
      role.includes("hod") ||
      role.includes("head") ||
      role.includes("reviewer 1") ||
      role === "reviewer1" ||
      role.includes("manager")
    ) {
      return "reviewer1";
    }

    return "hr";
  }, [currentUser?.role]);

  return (
    <div className="hrms-app">
      <aside className={`hrms-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/hrsync-logo.webp" alt="HRSYNC" />
          </div>

          {sidebarOpen && (
            <div className="brand-wordmark">
              <div className="brand-main">
                <span className="brand-hr">HR</span>
                <span className="brand-sync">SYNC</span>
              </div>

              <div className="brand-tagline">
                PEOPLE <b>•</b> PROCESS <b>•</b> PROGRESS
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-section-label">
          {sidebarOpen ? "WORKSPACE" : ""}
        </div>

        <nav className="sidebar-nav">
          {menuItems
            .filter((item) => canAccessMenu(item.name))
            .filter(
              (item) => !isEmployee || item.name === "Self Service"
            )
            .map((item) => (
              <button
                key={item.name}
                className={`sidebar-link ${
                  activeMenu === item.name ? "active" : ""
                }`}
                onClick={() => handleMenu(item.name)}
                title={item.name}
              >
                <span className="sidebar-icon">
                  <Icon name={item.icon} size={18} />
                </span>
                {sidebarOpen && (
                  <>
                    <span className="sidebar-label">{item.name}</span>
                    {(
                      item.name === "Employees" ||
                      (item.name === "Recruitment" && recruitmentBadgeCount > 0)
                    ) && (
                      <span className="menu-badge">
                        {item.name === "Employees"
                          ? (employeeCountLoading ? "…" : employeeCount.toLocaleString("en-IN"))
                          : recruitmentBadgeCount.toLocaleString("en-IN")}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-help">
            <div className="help-circle">
              <Icon name="help" size={17} />
            </div>
            <div className="sidebar-help-copy">
              <strong>Need help?</strong>
              <span>Connect with HRMS support</span>
            </div>
            <button type="button">Contact support</button>
          </div>
        )}

        <div className="sidebar-bottom">
          <span className="online-dot" />
          {sidebarOpen && <span>Secure HRMS workspace</span>}
        </div>
      </aside>

      <main className={`hrms-main ${sidebarOpen ? "" : "full"}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen((value) => !value)}
              aria-label="Toggle sidebar"
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="top-brand">
              <strong>
                <span className="top-brand-sync">HRSYNC</span>
                <span className="top-brand-hrms">HRMS</span>
              </strong>
              <span>People operations workspace</span>
            </div>
          </div>

          <div className="topbar-right">
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search people, payroll, reports..."
              />
              <kbd>/</kbd>
            </div>

            <div className="notification-wrap">
              <button
                className="top-icon"
                onClick={() => setNotificationOpen((value) => !value)}
                aria-label="Notifications"
              >
                <Icon name="bell" size={18} />
                <i />
              </button>

              {notificationOpen && (
                <div className="notification-dropdown">
                  <div className="dropdown-title-row">
                    <strong>Notifications</strong>
                    <span>3</span>
                  </div>
                  <p>
                    <span className="notice-dot danger" />
                    New leave request requires approval.
                  </p>
                  <p>
                    <span className="notice-dot warning" />
                    Payroll processing is due soon.
                  </p>
                  <p>
                    <span className="notice-dot info" />
                    Training session scheduled.
                  </p>
                </div>
              )}
            </div>

            <div className="profile-wrap">
              <button
                className="profile"
                onClick={() => setProfileOpen((value) => !value)}
              >
                <div className="avatar">
                  {String(currentUser?.name || "Admin User")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="profile-text">
                  <strong>{currentUser?.name || "Admin User"}</strong>
                  <span>{currentUser?.role || "HR Administrator"}</span>
                </div>
                <span className="profile-arrow">
                  <Icon name="chevron" size={14} />
                </span>
              </button>

              {profileOpen && (
                <div className="profile-dropdown">
                  <button type="button">My Profile</button>
                  <button type="button">Change Password</button>
                  <div />
                  <button
                    type="button"
                    className="logout"
                    onClick={onLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {activeMenu === "Attendance" ? (
            <Attendance />
          ) : activeMenu === "Organization" ? (
            <Organization />
          ) : activeMenu === "Vendors" ? (
            <VendorAgreements />
          ) : activeMenu === "Employees" ? (
            <Employees />
          ) : activeMenu === "Leave" ? (
  <Leave employees={employees} />
) : activeMenu === "Force Leave" ? (
  <ForceLeave employees={employees} currentUser={currentUser}/>
) : activeMenu === "Payroll" ? (
  <Payroll />
          ) : activeMenu === "Recruitment" ? (
            <Recruitment employees={employees} masters={organization} />
          ) : activeMenu === "Self Service" ? (
            <SelfService employees={employees} currentUser={currentUser} />
          ) : activeMenu === "Training" ? (
            <Training employees={employees} masters={organization} />
          ) : activeMenu === "PMS" ? (
            <PMS
              role={pmsRole}
              currentUserId={
                currentUser?.id ||
                currentUser?.userId ||
                currentUser?.employeeId ||
                ""
              }
              currentEmployeeId={
                currentUser?.employeeId ||
                currentUser?.employeeCode ||
                currentUser?.id ||
                ""
              }
            />
          ) : activeMenu === "Reports" ? (
            <Reports />
          ) : activeMenu === "Settings" ? (
            <Settings currentUser={currentUser} />
          ) : (
            <>
              <div className="breadcrumb">
                <span>Dashboard</span>
                <b>/</b>
                <span>Overview</span>
              </div>

              <section className="dashboard-hero">
                <div className="hero-copy">
                  <div className="hero-kicker">
                    <span className="hero-kicker-dot" />
                    HR WORKSPACE
                  </div>
                  <h1>
                    Good morning, <span>HR Team</span>
                  </h1>
                  <p>
                    A clear view of your people, workforce movement and
                    operational priorities.
                  </p>
                  <div className="hero-meta">
                    <span className="hero-date">
                      <Icon name="calendar" size={14} />
                      {today}
                    </span>
                    <span className="hero-divider" />
                    <span className="hero-status">
                      <i />
                      System healthy
                    </span>
                  </div>
                </div>

                <div className="hero-controls">
                  <div className="filter-field">
                    <label>Financial year</label>
                    <select
                      value={financialYear}
                      onChange={(event) => setFinancialYear(event.target.value)}
                    >
                      {dashboardFinancialYearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label>Month</label>
                    <select
                      value={month}
                      onChange={(event) => setMonth(event.target.value)}
                    >
                      {dashboardMonthOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <div className="status-strip">
                <div className="status-strip-left">
                  <span className="status-icon">
                    <Icon name="check" size={14} />
                  </span>
                  <div>
                    <strong>All systems operational</strong>
                    <span>HRMS workspace is online and ready.</span>
                  </div>
                </div>
                <span className="status-strip-right">
                  Updated today · {today}
                </span>
              </div>

              <section className="kpi-grid">
                {dashboardStats.map((stat, index) => (
                  <article
                    className={`kpi-card kpi-${stat.color} ${
                      index === 0 ? "kpi-featured" : ""
                    }`}
                    key={stat.title}
                  >
                    <div className="kpi-top">
                      <span className="kpi-icon">
                        <Icon name={stat.icon} size={19} />
                      </span>
                      <span className="kpi-tag">{stat.change}</span>
                    </div>
                    <div className="kpi-title">{stat.title}</div>
                    <div className="kpi-value">{stat.value}</div>
                    <div className="kpi-note">{stat.note}</div>
                  </article>
                ))}
              </section>

              <section className="top-panels">
                <article className="panel workforce-panel">
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">WORKFORCE</span>
                      <h2>Workforce overview</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMenu("Employees")}
                    >
                      View employees <Icon name="arrow" size={14} />
                    </button>
                  </div>

                  <div className="workforce-content">
                    <div className="workforce-visual">
                      <div
                        className="gender-donut"
                        style={{
                          "--male": `${maleShare}%`,
                          "--female": `${maleShare + femaleShare}%`,
                        }}
                      >
                        <div>
                          <strong>{activeEmployees.length}</strong>
                          <span>Active</span>
                        </div>
                      </div>
                    </div>

                    <div className="workforce-side">
                      <div className="workforce-summary">
                        <div className="workforce-summary-main">
                          <strong>{activeEmployees.length}</strong>
                          <span>people in active workforce</span>
                        </div>
                        <div className="workforce-summary-arrow">
                          <Icon name="trend" size={17} />
                        </div>
                      </div>

                      <div className="gender-list">
                        <div className="gender-row">
                          <span className="gender-label">
                            <i className="legend-dot male" />
                            Male
                          </span>
                          <strong>{genderCounts.male}</strong>
                          <small>{malePercentage}%</small>
                        </div>
                        <div className="gender-row">
                          <span className="gender-label">
                            <i className="legend-dot female" />
                            Female
                          </span>
                          <strong>{genderCounts.female}</strong>
                          <small>{femalePercentage}%</small>
                        </div>
                        <div className="gender-row">
                          <span className="gender-label">
                            <i className="legend-dot other" />
                            Other
                          </span>
                          <strong>{genderCounts.other}</strong>
                          <small>
                            {activeEmployees.length
                              ? `${(
                                  (genderCounts.other /
                                    activeEmployees.length) *
                                  100
                                ).toFixed(1)}%`
                              : "0%"}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="workforce-footer">
                    <div>
                      <span>90-day joiners</span>
                      <strong>{recentJoinees}</strong>
                    </div>
                    <div>
                      <span>90-day exits</span>
                      <strong>{recentExits}</strong>
                    </div>
                    <div>
                      <span>Vendor workforce</span>
                      <strong>{activeVendorHeadcount}</strong>
                    </div>
                  </div>
                </article>

                <article className="panel attention-panel">
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">WORKFLOW</span>
                      <h2>Attention required</h2>
                    </div>
                    <span className="attention-count">{attentionCount}</span>
                  </div>

                  <div className="attention-list">
                    <div className="attention-item danger">
                      <div className="attention-icon">
                        <Icon name="alert" size={17} />
                      </div>
                      <div className="attention-copy">
                        <strong>Attrition data is incomplete</strong>
                        <span>
                          Exit data is required before this metric can be
                          calculated reliably.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMenu("Employees")}
                        aria-label="Review employee data"
                      >
                        <Icon name="arrow" size={14} />
                      </button>
                    </div>

                    {expiringPOCount > 0 ? (
                      <div className="attention-item warning">
                        <div className="attention-icon">
                          <Icon name="calendar" size={17} />
                        </div>
                        <div className="attention-copy">
                          <strong>
                            {expiringPOCount} manpower PO
                            {expiringPOCount > 1 ? "s" : ""} expiring
                          </strong>
                          <span>
                            Review active POs with 60 days or less remaining.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMenu("Vendors")}
                          aria-label="Review vendor POs"
                        >
                          <Icon name="arrow" size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="attention-item success">
                        <div className="attention-icon">
                          <Icon name="check" size={17} />
                        </div>
                        <div className="attention-copy">
                          <strong>No PO expiry alerts</strong>
                          <span>
                            No active manpower PO is currently within the
                            warning window.
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="attention-item success">
                      <div className="attention-icon">
                        <Icon name="check" size={17} />
                      </div>
                      <div className="attention-copy">
                        <strong>HRMS system is healthy</strong>
                        <span>
                          Core workspace services are online.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="attention-footer">
                    <Icon name="help" size={14} />
                    Review the items above before closing today's HR tasks.
                  </div>
                </article>
              </section>

              <section className="middle-grid">
                <article className="panel quick-actions-panel">
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">SHORTCUTS</span>
                      <h2>Quick actions</h2>
                    </div>
                  </div>

                  <div className="quick-actions-grid">
                    {hasPermission("employees.view") && (
                    <button type="button" onClick={() => handleMenu("Employees")}>
                      <span className="quick-action-icon purple">
                        <Icon name="user-plus" size={18} />
                      </span>
                      <span>
                        <strong>Add employee</strong>
                        <small>Employee master</small>
                      </span>
                      <Icon name="arrow" size={13} />
                    </button>
                    )}

                    {hasPermission("attendance.view") && (
                    <button
                      type="button"
                      onClick={() => handleMenu("Attendance")}
                    >
                      <span className="quick-action-icon blue">
                        <Icon name="clock" size={18} />
                      </span>
                      <span>
                        <strong>Attendance</strong>
                        <small>Daily records</small>
                      </span>
                      <Icon name="arrow" size={13} />
                    </button>
                    )}

                    {hasPermission("leave.view") && (
                    <button type="button" onClick={() => handleMenu("Leave")}>
                      <span className="quick-action-icon green">
                        <Icon name="calendar" size={18} />
                      </span>
                      <span>
                        <strong>Leave approvals</strong>
                        <small>Requests & approvals</small>
                      </span>
                      <Icon name="arrow" size={13} />
                    </button>
                    )}

                    {hasPermission("payroll.view") && (
                    <button type="button" onClick={() => handleMenu("Payroll")}>
                      <span className="quick-action-icon orange">
                        <Icon name="wallet" size={18} />
                      </span>
                      <span>
                        <strong>Payroll</strong>
                        <small>Salary processing</small>
                      </span>
                      <Icon name="arrow" size={13} />
                    </button>
                    )}
                  </div>
                </article>

                <article className="panel modules-panel">
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">MODULES</span>
                      <h2>Quick access</h2>
                    </div>
                    <span className="module-count">{filteredApps.length} modules</span>
                  </div>

                  <div className="module-grid">
                    {filteredApps
                      .filter(([name]) => canAccessMenu(name))
                      .slice(0, 8)
                      .map(([name, description, icon, color]) => (
                        <button
                          type="button"
                          className="module-card"
                          key={name}
                          onClick={() => handleMenu(name)}
                        >
                          <span className={`module-icon ${color}`}>
                            <Icon name={icon} size={18} />
                          </span>
                          <span className="module-text">
                            <strong>{name}</strong>
                            <small>{description}</small>
                          </span>
                          <Icon name="arrow" size={13} />
                        </button>
                      )
                    )}
                  </div>
                </article>
              </section>

              <section className="bottom-grid">
                <article className="panel compact-panel">
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">ATTENDANCE</span>
                      <h2>Shift coverage</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMenu("Attendance")}
                    >
                      Open <Icon name="arrow" size={13} />
                    </button>
                  </div>

                  <div className="table-head">
                    <span>Shift</span>
                    <span>Expected</span>
                    <span>Punched</span>
                  </div>

                  {dashboardShiftRows.length ? (
                    dashboardShiftRows.map((shift) => (
                      <div className="table-row" key={shift.name}>
                        <div>
                          <strong>{shift.name}</strong>
                          {shift.time && <small>{shift.time}</small>}
                        </div>
                        <span>{shift.expected}</span>
                        <span>{shift.punched}</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      No shift data available.
                    </div>
                  )}
                </article>

                <article className="panel compact-panel">
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">VENDOR WORKFORCE</span>
                      <h2>Active vendors</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMenu("Vendors")}
                    >
                      Open <Icon name="arrow" size={13} />
                    </button>
                  </div>

                  <div className="mini-summary-grid">
                    <div>
                      <span>Active vendors</span>
                      <strong>{activeVendorRows.length}</strong>
                    </div>
                    <div>
                      <span>Headcount</span>
                      <strong>{activeVendorHeadcount.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>

                  <div className="compact-list">
                    {activeVendorRows.length === 0 ? (
                      <div className="empty-state">
                        No active vendor workforce data available.
                      </div>
                    ) : (
                      activeVendorRows.slice(0, 4).map((row) => (
                        <div className="compact-list-row" key={row.vendor}>
                          <div>
                            <strong>{row.vendor}</strong>
                            <small>
                              {row.activePOs} PO
                              {row.activePOs === 1 ? "" : "s"} ·{" "}
                              {row.activeAgreements} agreement
                              {row.activeAgreements === 1 ? "" : "s"}
                            </small>
                          </div>
                          <b>{row.headcount}</b>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="panel compact-panel">
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">PROCUREMENT</span>
                      <h2>Manpower PO status</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMenu("Vendors")}
                    >
                      Open <Icon name="arrow" size={13} />
                    </button>
                  </div>

                  <div className="po-metrics">
                    <div className="po-metric success">
                      <span>Active</span>
                      <strong>{activePOCount}</strong>
                    </div>
                    <div className="po-metric warning">
                      <span>Expiring</span>
                      <strong>{expiringPOCount}</strong>
                    </div>
                  </div>

                  <div className="compact-list">
                    {activePOs.length === 0 ? (
                      <div className="empty-state">
                        No manpower PO records available.
                      </div>
                    ) : (
                      activePOs.slice(0, 3).map((po) => (
                        <div className="compact-list-row po-list-row" key={po.id}>
                          <div>
                            <strong>{po.poNumber}</strong>
                            <small>
                              {po.vendor} ·{" "}
                              {po.location || "All locations"}
                            </small>
                          </div>
                          <span
                            className={`status-chip ${
                              po.status === "Active"
                                ? "success"
                                : po.status === "Expired"
                                  ? "danger"
                                  : po.status === "On Hold"
                                    ? "warning"
                                    : "neutral"
                            }`}
                          >
                            {po.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </section>

              <section className="panel events-panel">
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">PEOPLE</span>
                    <h2>Upcoming events</h2>
                  </div>
                  <span className="module-count">Next 30 days</span>
                </div>

                <div className="event-list">
                  {dashboardEvents.length === 0 ? (
                    <div className="empty-state">
                      No birthdays or anniversaries in the next 30 days.
                    </div>
                  ) : (
                    dashboardEvents.map((event) => (
                      <div
                        className="event-card"
                        key={`${event.name}-${event.type}`}
                      >
                        <div className={`event-avatar ${event.gender}`}>
                          <Icon
                            name={
                              event.type === "Birthday"
                                ? "sparkles"
                                : "calendar"
                            }
                            size={18}
                          />
                        </div>
                        <div>
                          <strong>{event.name}</strong>
                          <span>{event.type}</span>
                        </div>
                        <time>{event.date}</time>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <button type="button" className="support-button">
          <Icon name="headset" size={16} />
          <span>Get support</span>
        </button>
      </main>
    </div>
  );
}

export default Dashboard;
