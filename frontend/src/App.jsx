import { useEffect, useState } from "react";
import Login from "./Login";
import Dashboard from "./dashboard";
import "./App.css";

import { HrsyncAIProvider, useHrsyncAI } from "./ai/aiContext";
import HrsyncAI from "./ai/HrsyncAI";

const USER_KEY = "bauerHrmsCurrentUser";
const EMPLOYEE_STORAGE_KEY = "bauerHrmsEmployees";

/* =========================================
   CURRENT USER
========================================= */

const readCurrentUser = () => {
  try {
    const raw =
      localStorage.getItem(USER_KEY) ||
      sessionStorage.getItem(USER_KEY);

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/* =========================================
   EMPLOYEE MASTER
========================================= */

const readEmployees = () => {
  try {
    const saved = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/*
 * IMPORTANT:
 * AI does NOT need PAN, Aadhaar, bank details,
 * personal address, mobile numbers, etc.
 *
 * Only business-relevant Employee Master information
 * is passed to the AI context.
 */

const buildAIEmployees = (employees = []) => {
  if (!Array.isArray(employees)) return [];

  return employees.map((employee) => ({
    id: employee.id ?? null,
    employeeId: employee.employeeId ?? null,
    name: employee.name ?? null,

    location: employee.location ?? null,
    employeeGroup: employee.employeeGroup ?? null,
    shift: employee.shift ?? null,
    branch: employee.branch ?? null,

    designation: employee.designation ?? null,
    employmentType: employee.employmentType ?? null,
    department: employee.department ?? null,
    vendor: employee.vendor ?? null,
    jobType: employee.jobType ?? null,

    doj: employee.doj ?? null,
    status: employee.status ?? "Active",
  }));
};

/* ================================
   HRSYNC AI LAUNCHER
================================ */

function HrsyncAILauncher() {
  const { openAI } = useHrsyncAI();

  return (
    <button
      type="button"
      className="hrsx-ai-launcher"
      onClick={openAI}
      aria-label="Open HRSYNC AI"
      title="HRSYNC AI"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" />
        <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
      </svg>

      <span>HRSYNC AI</span>
    </button>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(readCurrentUser);

  const [employees, setEmployees] = useState(() =>
    readEmployees()
  );

  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("hrmsLoggedIn") === "true"
  );

  /* =========================================
     KEEP AI EMPLOYEE DATA IN SYNC
  ========================================= */

  useEffect(() => {
    const refreshEmployees = () => {
      setEmployees(readEmployees());
    };

    window.addEventListener(
      "bauerHrmsEmployeesUpdated",
      refreshEmployees
    );

    window.addEventListener(
      "storage",
      refreshEmployees
    );

    return () => {
      window.removeEventListener(
        "bauerHrmsEmployeesUpdated",
        refreshEmployees
      );

      window.removeEventListener(
        "storage",
        refreshEmployees
      );
    };
  }, []);

  /* =========================================
     LOGIN
  ========================================= */

  const handleLogin = (rememberMe, user) => {
    const safeUser = user || {
      id: "ADMIN",
      employeeId: "ADMIN",
      name: "Admin User",
      email: "admin@bauer.com",
      role: "HR Admin",
      department: "HR & Admin",
    };

    localStorage.setItem(
      "hrmsLoggedIn",
      "true"
    );

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(safeUser)
    );

    if (rememberMe) {
      localStorage.setItem(
        "hrmsRemember",
        "true"
      );
    } else {
      localStorage.removeItem(
        "hrmsRemember"
      );
    }

    setCurrentUser(safeUser);
    setIsLoggedIn(true);
  };

  /* =========================================
     LOGOUT
  ========================================= */

  const handleLogout = () => {
    localStorage.removeItem(
      "hrmsLoggedIn"
    );

    localStorage.removeItem(
      "hrmsRemember"
    );

    localStorage.removeItem(
      USER_KEY
    );

    sessionStorage.removeItem(
      USER_KEY
    );

    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  /* =========================================
     LOGIN SCREEN
  ========================================= */

  if (!isLoggedIn) {
    return (
      <Login
        onLogin={handleLogin}
      />
    );
  }

  /* =========================================
     SAFE AI EMPLOYEE CONTEXT
  ========================================= */

  const aiEmployees =
    buildAIEmployees(employees);

  /* =========================================
     LOGGED-IN HRMS
  ========================================= */

  return (
    <HrsyncAIProvider
      user={currentUser}
      employees={aiEmployees}
    >
      <Dashboard
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      {/* Global AI */}
      <HrsyncAILauncher />

      <HrsyncAI />
    </HrsyncAIProvider>
  );
}

export default App;