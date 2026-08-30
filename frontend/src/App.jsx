import { useState } from "react";
import Login from "./Login";
import Dashboard from "./dashboard";
import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("hrmsLoggedIn") === "true"
  );

  const handleLogin = (rememberMe) => {
    localStorage.setItem("hrmsLoggedIn", "true");

    if (rememberMe) {
      localStorage.setItem("hrmsRemember", "true");
    } else {
      localStorage.removeItem("hrmsRemember");
    }

    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("hrmsLoggedIn");
    localStorage.removeItem("hrmsRemember");

    setIsLoggedIn(false);
  };

  // Not logged in → Login page
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // Logged in → Full HRMS Dashboard
  return <Dashboard onLogout={handleLogout} />;
}

export default App;