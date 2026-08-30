import { useEffect, useMemo, useState } from "react";
import "./dashboard.css";
import Attendance from "./attendance";
import Employees from "./employees";
import Organization from "./organization";
import VendorAgreements from "./vendorAgreements";
import Payroll from "./Payroll";

const menuItems = [
  { name: "Dashboard", icon: "▦" },
  { name: "Employees", icon: "♙" },
  { name: "Attendance", icon: "◷" },
  { name: "Leave", icon: "□" },
  { name: "Payroll", icon: "₹" },
  { name: "Vendors", icon: "▤" },
  { name: "Sites & Projects", icon: "⌖" },
  { name: "Organization", icon: "◇" },
  { name: "Recruitment", icon: "⌕", badge: "26" },
  { name: "Training", icon: "◇" },
  { name: "PMS", icon: "▥" },
  { name: "Reports", icon: "▤" },
  { name: "Settings", icon: "⚙" },
];

const apps = [
  ["Attendance", "Daily attendance", "▣", "blue"],
  ["Payroll", "Salary processing", "₹", "green"],
  ["Device", "Device management", "◉", "red"],
  ["Reports", "HR reports & MIS", "▤", "yellow"],
  ["Self Service", "Employee self service", "♙", "orange"],
  ["EDOC", "Employee documents", "▤", "cyan"],
  ["Recruitment", "Candidate management", "♧", "purple"],
  ["Onboarding", "New employee joining", "♙", "violet"],
  ["Performance", "Performance management", "▥", "pink"],
  ["Task", "Task management", "✓", "indigo"],
  ["L & D", "Learning & development", "◆", "teal"],
  ["Polls & Surveys", "Employee surveys", "▤", "magenta"],
  ["Vizitrac", "Visitor tracking", "▣", "sky"],
  ["Helpdesk", "HR support", "?", "gold"],
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

function readDashboardData(key) {
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

function Dashboard({ onLogout }) {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month, setMonth] = useState("Aug-2026");
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [pos, setPos] = useState([]);
  const [organization, setOrganization] = useState({});

  const loadVendorDashboardData = () => {
    setEmployees(readDashboardData(EMPLOYEE_STORAGE_KEY));
    setAgreements(readDashboardData(AGREEMENT_STORAGE_KEY));
    setPos(readDashboardData(PO_STORAGE_KEY));
    setOrganization(readDashboardData(ORG_STORAGE_KEY));
  };

  useEffect(() => {
    loadVendorDashboardData();

    const refresh = () => loadVendorDashboardData();
    window.addEventListener("storage", refresh);
    window.addEventListener("bauerHrmsEmployeesUpdated", refresh);
    window.addEventListener("bauerHrmsAgreementsUpdated", refresh);
    window.addEventListener("bauerHrmsPOsUpdated", refresh);
    window.addEventListener("bauerHrmsOrganizationUpdated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bauerHrmsEmployeesUpdated", refresh);
      window.removeEventListener("bauerHrmsAgreementsUpdated", refresh);
      window.removeEventListener("bauerHrmsPOsUpdated", refresh);
      window.removeEventListener("bauerHrmsOrganizationUpdated", refresh);
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
    setActiveMenu(name);

    if (window.innerWidth < 900) {
      setSidebarOpen(false);
    }
  };


  const activeEmployees = employees.filter(
    (employee) => String(employee.status || "Active").toLowerCase() === "active"
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
      age <= 25 ? employeeAgeData[0] :
      age <= 35 ? employeeAgeData[1] :
      age <= 40 ? employeeAgeData[2] :
      age <= 58 ? employeeAgeData[3] :
      employeeAgeData[4];

    const gender = String(employee.gender || "").trim().toLowerCase();
    if (gender === "male") bucket.male += 1;
    else if (gender === "female") bucket.female += 1;
    else bucket.other += 1;
  });

  const averageAge = activeEmployees
    .map((employee) => dashboardAge(employee.dateOfBirth || employee.dob))
    .filter((age) => age !== null);

  const averageAgeValue = averageAge.length
    ? (averageAge.reduce((sum, age) => sum + age, 0) / averageAge.length).toFixed(1)
    : "—";

  const serviceMonths = activeEmployees
    .map((employee) => dashboardServiceYears(employee.dateOfJoining || employee.doj)?.months)
    .filter((months) => Number.isFinite(months));

  const averageServiceValue = serviceMonths.length
    ? (serviceMonths.reduce((sum, months) => sum + months, 0) / serviceMonths.length / 12).toFixed(1)
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

  const dashboardStats = [
    {
      title: "Total Active Employee",
      value: activeEmployees.length.toLocaleString("en-IN"),
      change: `${employees.length.toLocaleString("en-IN")} total records`,
      note: "From Employee Master",
      icon: "♙",
      color: "green",
    },
    {
      title: "Gender Ratio",
      value: `${genderCounts.male} : ${genderCounts.female}`,
      change: `${malePercentage}% male`,
      note: "Male : Female",
      icon: "◉",
      color: "pink",
    },
    {
      title: "Retention / Attrition",
      value: "—",
      change: "Exit data required",
      note: "Cannot be calculated reliably yet",
      icon: "↗",
      color: "yellow",
    },
    {
      title: "New Joinees / Exits",
      value: `${recentJoinees} / ${recentExits}`,
      change: "Last 90 days",
      note: "Based on joining / exit dates",
      icon: "⇄",
      color: "blue",
    },
    {
      title: "Average Employee Age",
      value: averageAgeValue,
      change: "Years",
      note: "Active Employee Master records",
      icon: "♙",
      color: "purple",
    },
    {
      title: "Average Service Period",
      value: averageServiceValue,
      change: "Years",
      note: "Calculated from Date of Joining",
      icon: "◷",
      color: "orange",
    },
  ];

  const dashboardEvents = dashboardUpcomingEvents(activeEmployees);

  const dashboardShiftRows = Array.from(
    new Set(
      activeEmployees
        .map((employee) => employee.shift)
        .filter(Boolean)
    )
  ).map((shiftName) => ({
    name: shiftName,
    time: "",
    expected: activeEmployees.filter(
      (employee) => String(employee.shift || "").toLowerCase() === String(shiftName).toLowerCase()
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
        (employee) => String(employee.vendor || "").toLowerCase() === vendor.toLowerCase()
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
          String(agreement.vendor || "").toLowerCase() === vendor.toLowerCase() &&
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
    .filter((row) => row.headcount > 0 || row.activeAgreements > 0 || row.activePOs > 0)
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
      const order = { Active: 1, "On Hold": 2, Future: 3, Expired: 4, Draft: 5 };
      return (order[a.status] || 9) - (order[b.status] || 9);
    });

  const activeVendorHeadcount = activeVendorRows.reduce(
    (sum, row) => sum + row.headcount,
    0
  );
  const activePOCount = activePOs.filter((po) => po.status === "Active").length;
  const expiringPOCount = activePOs.filter(
    (po) => po.status === "Active" && po.daysLeft !== null && po.daysLeft >= 0 && po.daysLeft <= 60
  ).length;

  return (
    <div className="hrms-app">

      {/* ================= SIDEBAR ================= */}
      <aside className={`hrms-sidebar ${sidebarOpen ? "" : "collapsed"}`}>

        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/bauer-logo.png" alt="BAUER" />
          </div>

          {sidebarOpen && (
            <div className="brand-text">
              <strong>BAUER</strong>
              <span>HRMS</span>
            </div>
          )}
        </div>

        <div className="sidebar-line" />

        {sidebarOpen && <div className="sidebar-title">MAIN MENU</div>}

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`sidebar-link ${
                activeMenu === item.name ? "active" : ""
              }`}
              onClick={() => handleMenu(item.name)}
              title={item.name}
            >
              <span className="sidebar-icon">{item.icon}</span>

              {sidebarOpen && (
                <>
                  <span className="sidebar-label">{item.name}</span>

                  {(item.badge || item.name === "Employees") && (
                    <span className="menu-badge">
                      {item.name === "Employees"
                        ? activeEmployees.length.toLocaleString("en-IN")
                        : item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-help">
            <div className="help-circle">?</div>
            <div>
              <strong>Need help?</strong>
              <span>Contact HRMS support</span>
            </div>
            <button>Contact</button>
          </div>
        )}

        <div className="sidebar-bottom">
          <span className="online-dot" />
          {sidebarOpen && <span>Secure HRMS Workspace</span>}
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main className={`hrms-main ${sidebarOpen ? "" : "full"}`}>

        {/* ================= TOPBAR ================= */}
        <header className="topbar">

          <div className="topbar-left">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              ☰
            </button>

            <div className="top-brand">
              <strong>BAUER HRMS</strong>
              <span>Human Resource Management System</span>
            </div>
          </div>

          <div className="topbar-right">

            <div className="search-box">
              <span>⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search HRMS..."
              />
              <kbd>/</kbd>
            </div>

            <button
              className="top-icon"
              onClick={() => setNotificationOpen((v) => !v)}
            >
              ◇
              <i />
            </button>

            {notificationOpen && (
              <div className="notification-dropdown">
                <strong>Notifications</strong>
                <p>New leave request requires approval.</p>
                <p>Payroll processing is due soon.</p>
                <p>Training session scheduled.</p>
              </div>
            )}

            <div className="profile-wrap">
              <button
                className="profile"
                onClick={() => setProfileOpen((v) => !v)}
              >
                <div className="avatar">A</div>

                <div className="profile-text">
                  <strong>Admin User</strong>
                  <span>HR Administrator</span>
                </div>

                <span className="profile-arrow">⌄</span>
              </button>

              {profileOpen && (
                <div className="profile-dropdown">
                  <button>My Profile</button>
                  <button>Change Password</button>
                  <div />
                  <button
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

        {/* ================= CONTENT ================= */}
        <div className="dashboard-content">
          {activeMenu === "Attendance" ? (
            <Attendance />
          ) : activeMenu === "Organization" ? (
            <Organization />
          ) : activeMenu === "Vendors" ? (
            <VendorAgreements />
          ) : activeMenu === "Employees" ? (
            <Employees />
          ) : activeMenu === "Payroll" ? (
            <Payroll />
          ) : (
            <>
          <div className="breadcrumb">
            Dashboard <span>/</span> Overview
          </div>

          {/* PAGE HEADING */}
          <div className="page-title-row">
            <div>
              <h1>
                Welcome, <span>HR Team</span> 👋
              </h1>
              <p>
                Brief snapshot as on {today} for Employee, Attendance &
                Workforce Information
              </p>
            </div>

            <div className="header-filters">
              <label>Financial Year</label>

              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
              >
                <option>2026-27</option>
                <option>2025-26</option>
                <option>2024-25</option>
              </select>

              <label>Select Month</label>

              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                <option>Aug-2026</option>
                <option>Jul-2026</option>
                <option>Jun-2026</option>
                <option>May-2026</option>
              </select>
            </div>
          </div>

          {/* SYSTEM STATUS */}
          <div className="system-status">
            <span className="status-dot" />
            <span>HRMS System Online</span>

            <div>
              <small>Today</small>
              <strong>{today}</strong>
            </div>
          </div>

          {/* ================= KPI CARDS ================= */}
          <section className="stats-grid">
            {dashboardStats.map((stat) => (
              <div className="stat-card" key={stat.title}>

                <div className="stat-top">
                  <div className={`stat-icon ${stat.color}`}>
                    {stat.icon}
                  </div>

                  <span className={`stat-change ${stat.color}`}>
                    {stat.change}
                  </span>
                </div>

                <div className="stat-title">
                  {stat.title}
                </div>

                <div className="stat-value">
                  {stat.value}
                </div>

                <div className="stat-note">
                  {stat.note}
                </div>

              </div>
            ))}
          </section>

          {/* ================= MAIN GRID ================= */}
          <div className="dashboard-grid">

            {/* AVAILABLE APPS */}
            <section className="card apps-card">

              <div className="card-header">
                <div>
                  <span className="section-label">QUICK ACCESS</span>
                  <h2>Available Apps</h2>
                </div>

                <button>View all →</button>
              </div>

              <div className="apps-grid">
                {filteredApps.map(([name, description, icon, color]) => (
                  <button
                    className="app-item"
                    key={name}
                    onClick={() => handleMenu(name)}
                  >
                    <span className={`app-icon ${color}`}>
                      {icon}
                    </span>

                    <span className="app-text">
                      <strong>{name}</strong>
                      <small>{description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* ================= EMPLOYEE RATIO ================= */}
<section className="card ratio-card">

  <div className="card-header">
    <div>
      <span className="section-label">WORKFORCE</span>
      <h2>Employee Ratio</h2>
    </div>

    <button>View report →</button>
  </div>

  <div className="chart-area">

    <div className="chart-legend">
      <span><i className="male" /> Male</span>
      <span><i className="female" /> Female</span>
      <span><i className="other" /> Other</span>
    </div>

    <div className="bar-chart">

      {employeeAgeData.map((item, index) => (

        <div className="bar-group" key={item.age}>

          <div className="bars">

            {/* MALE */}
            <div className="tooltip-bar">
              <span
                className="male-bar"
                style={{
                  height: `${item.male / 2}px`
                }}
              />

              <div className="chart-tooltip">
                <strong>{item.age}</strong>

                <span>
                  <i className="tooltip-dot male-dot" />
                  Male: <b>{item.male}</b>
                </span>

                <span>
                  <i className="tooltip-dot female-dot" />
                  Female: <b>{item.female}</b>
                </span>

                <span>
                  <i className="tooltip-dot other-dot" />
                  Other: <b>{item.other}</b>
                </span>
              </div>
            </div>


            {/* FEMALE */}
            <div className="tooltip-bar">
              <span
                className="female-bar"
                style={{
                  height: `${item.female / 2}px`
                }}
              />

              <div className="chart-tooltip">
                <strong>{item.age}</strong>

                <span>
                  <i className="tooltip-dot male-dot" />
                  Male: <b>{item.male}</b>
                </span>

                <span>
                  <i className="tooltip-dot female-dot" />
                  Female: <b>{item.female}</b>
                </span>

                <span>
                  <i className="tooltip-dot other-dot" />
                  Other: <b>{item.other}</b>
                </span>
              </div>
            </div>

          </div>

          <small>{item.age}</small>

        </div>

      ))}

    </div>

  </div>

</section>

            {/* SHIFT INFO */}
            <section className="card shift-card">

              <div className="card-header">
                <div>
                  <span className="section-label">ATTENDANCE</span>
                  <h2>Shift Info</h2>
                </div>
              </div>

              <div className="shift-head">
                <span>Ongoing Shifts</span>
                <span>Expected<br />Employees</span>
                <span>Punched<br />Employee</span>
              </div>

              {dashboardShiftRows.map((shift) => (
                <div className="shift-row" key={shift.name}>
                  <div>
                    <strong>{shift.name}</strong>
                    {shift.time && <small>({shift.time})</small>}
                  </div>

                  <span>{shift.expected}</span>
                  <span>{shift.punched}</span>
                </div>
              ))}
            </section>

            {/* ================= ACTIVE VENDORS ================= */}
            <section className="card local-card">

              <div className="card-header">
                <div>
                  <span className="section-label">VENDOR WORKFORCE</span>
                  <h2>Active Vendors</h2>
                </div>
                <button onClick={() => handleMenu("Vendors")}>View all →</button>
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                <div style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", background: "#eef7ff" }}>
                  <small style={{ display: "block", color: "#6d86a0", fontSize: "9px" }}>ACTIVE VENDORS</small>
                  <strong style={{ fontSize: "20px", color: "#0f477c" }}>{activeVendorRows.length}</strong>
                </div>
                <div style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", background: "#eefaf5" }}>
                  <small style={{ display: "block", color: "#6d86a0", fontSize: "9px" }}>ACTIVE HEADCOUNT</small>
                  <strong style={{ fontSize: "20px", color: "#0f477c" }}>{activeVendorHeadcount.toLocaleString("en-IN")}</strong>
                </div>
              </div>

              <div style={{ maxHeight: "190px", overflowY: "auto" }}>
                {activeVendorRows.length === 0 ? (
                  <div style={{ padding: "28px 8px", textAlign: "center", color: "#7891aa", fontSize: "11px" }}>
                    No active vendor workforce data available.
                  </div>
                ) : (
                  activeVendorRows.slice(0, 6).map((row) => (
                    <div
                      key={row.vendor}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        alignItems: "center",
                        gap: "10px",
                        padding: "9px 0",
                        borderBottom: "1px solid #edf2f6",
                      }}
                    >
                      <div>
                        <strong style={{ display: "block", color: "#123f68", fontSize: "11px" }}>{row.vendor}</strong>
                        <small style={{ color: "#8197ab", fontSize: "9px" }}>
                          {row.activePOs} active PO{row.activePOs === 1 ? "" : "s"} · {row.activeAgreements} agreement{row.activeAgreements === 1 ? "" : "s"}
                        </small>
                      </div>
                      <span style={{ color: "#1765a7", fontWeight: 800, fontSize: "15px" }}>
                        {row.headcount}
                      </span>
                      <span style={{ color: "#8197ab", fontSize: "9px" }}>employees</span>
                    </div>
                  ))
                )}
              </div>

            </section>

            {/* ================= MANPOWER PO STATUS ================= */}
            <section className="card growth-card">

              <div className="card-header">
                <div>
                  <span className="section-label">MANPOWER PROCUREMENT</span>
                  <h2>Manpower PO Status</h2>
                </div>
                <button onClick={() => handleMenu("Vendors")}>View all →</button>
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <span style={{ padding: "5px 9px", borderRadius: "20px", background: "#eaf8f0", color: "#18764a", fontSize: "9px", fontWeight: 800 }}>
                  {activePOCount} Active
                </span>
                <span style={{ padding: "5px 9px", borderRadius: "20px", background: "#fff6df", color: "#8b6a24", fontSize: "9px", fontWeight: 800 }}>
                  {expiringPOCount} Expiring ≤ 60 days
                </span>
              </div>

              <div style={{ maxHeight: "205px", overflowY: "auto" }}>
                {activePOs.length === 0 ? (
                  <div style={{ padding: "30px 8px", textAlign: "center", color: "#7891aa", fontSize: "11px" }}>
                    No manpower PO records available.
                  </div>
                ) : (
                  activePOs.slice(0, 6).map((po) => (
                    <div
                      key={po.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "10px",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: "1px solid #edf2f6",
                      }}
                    >
                      <div>
                        <strong style={{ display: "block", color: "#123f68", fontSize: "10px" }}>
                          {po.poNumber}
                        </strong>
                        <small style={{ display: "block", color: "#8197ab", fontSize: "9px" }}>
                          {po.vendor} · {po.location || "All Locations"}
                        </small>
                        <small style={{ display: "block", color: "#9aaaba", fontSize: "8px", marginTop: "2px" }}>
                          {dashboardFormatDate(po.poStart)} → {dashboardFormatDate(po.poEnd)}
                          {po.approvedManpower ? ` · ${po.approvedManpower} manpower` : ""}
                        </small>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 7px",
                            borderRadius: "20px",
                            fontSize: "8px",
                            fontWeight: 800,
                            background:
                              po.status === "Active" ? "#eaf8f0" :
                              po.status === "Future" ? "#eef5ff" :
                              po.status === "On Hold" ? "#fff6df" :
                              po.status === "Expired" ? "#fdecec" : "#eef2f5",
                            color:
                              po.status === "Active" ? "#18764a" :
                              po.status === "Future" ? "#1765a7" :
                              po.status === "On Hold" ? "#8b6a24" :
                              po.status === "Expired" ? "#a14d4d" : "#64788c",
                          }}
                        >
                          {po.status}
                        </span>
                        {po.status === "Active" && po.daysLeft !== null && (
                          <small style={{ display: "block", color: po.daysLeft <= 60 ? "#b36b16" : "#8197ab", fontSize: "8px", marginTop: "3px" }}>
                            {po.daysLeft} days left
                          </small>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

            </section>

            {/* UPCOMING EVENTS */}
            <section className="card events-card">

              <div className="card-header">
                <div>
                  <span className="section-label">PEOPLE</span>
                  <h2>Upcoming Events</h2>
                </div>
              </div>

              <div className="events-grid">
                {dashboardEvents.length === 0 ? (
                  <div style={{ padding: "20px", color: "#7891aa", fontSize: "11px" }}>
                    No upcoming birthdays or anniversaries in the next 30 days.
                  </div>
                ) : (
                dashboardEvents.map((event) => (
                  <div className="event-item" key={event.name}>
                    <div className={`event-avatar ${event.gender}`}>
                      {event.gender === "female" ? "♀" : "♂"}
                      <small>
                        {event.type === "Birthday" ? "🎂" : "★"}
                      </small>
                    </div>

                    <strong>{event.name}</strong>
                    <span>{event.date}</span>
                    <small>{event.type}</small>
                  </div>
                ))
                )}
              </div>
            </section>

          </div>
            </>
          )}
        </div>

        {/* SUPPORT */}
        <button className="support-button">
          ? &nbsp; Get Support
        </button>

      </main>
    </div>
  );
}

export default Dashboard;