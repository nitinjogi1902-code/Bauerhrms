import { useState } from "react";
import Login from "./Login";
import Dashboard from "./dashboard";
import SuperAdmin from "./SuperAdmin";
import { supabase } from "./supabaseClient";
import "./App.css";
import "./HRSYNC_THEME.css";

const USER_KEY = "bauerHrmsCurrentUser";

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

const isPlatformSuperAdmin = (user) =>
  user?.isPlatformSuperAdmin === true ||
  user?.role === "Super Admin" ||
  user?.role === "Platform Super Admin";

function App() {
  const [currentUser, setCurrentUser] = useState(readCurrentUser);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const loggedIn = localStorage.getItem("hrmsLoggedIn") === "true";
    return loggedIn && !!readCurrentUser();
  });

  const handleLogin = (rememberMe, user) => {
    const safeUser = user || {
      id: "ADMIN",
      employeeId: "ADMIN",
      name: "Admin User",
      email: "admin@bauer.com",
      role: "HR Admin",
      department: "HR & Admin",
    };

    localStorage.setItem("hrmsLoggedIn", "true");
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser));

    if (rememberMe) {
      localStorage.setItem("hrmsRemember", "true");
    } else {
      localStorage.removeItem("hrmsRemember");
    }

    setCurrentUser(safeUser);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Legacy/local employee sessions do not depend on Supabase Auth.
    }

    localStorage.removeItem("hrmsLoggedIn");
    localStorage.removeItem("hrmsRemember");
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);

    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  /*
   * HRSYNC Platform Super Admin has a separate workspace.
   * Do NOT send this user into the company HR dashboard.
   */
  if (isPlatformSuperAdmin(currentUser)) {
    return (
      <SuperAdmin
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Dashboard
      onLogout={handleLogout}
      currentUser={currentUser}
    />
  );
}

export default App;
