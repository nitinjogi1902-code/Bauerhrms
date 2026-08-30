import { useState } from "react";
import "./Login.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  console.log("NEW BAUER LOGIN LOADED");

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setError("Please enter your username or work email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    // Temporary local authentication
    // Backend/database will be connected later.
    const validUsername = "admin@bauer.com";
    const validPassword = "Admin@123";

    if (
      cleanUsername !== validUsername ||
      password !== validPassword
    ) {
      setError("Invalid username or password.");
      return;
    }

    setLoading(true);

    window.setTimeout(() => {
      onLogin(rememberMe);
    }, 700);
  };

  return (
    <main className="bauer-login-page">

      {/* =====================================================
          LEFT BRAND PANEL
      ====================================================== */}

      <section className="bauer-brand-panel">

        <div className="brand-background-circle circle-one"></div>
        <div className="brand-background-circle circle-two"></div>
        <div className="brand-background-line"></div>

        <div className="brand-content">

          {/* LOGO */}
          <div className="brand-logo-area">
            <div className="brand-logo-box">
              <img
                src="/bauer-logo.png"
                alt="BAUER"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          </div>

          {/* BRAND TITLE */}
          <div className="brand-kicker">
            HUMAN RESOURCE MANAGEMENT SYSTEM
          </div>

          <h1>
            Workforce
            <br />
            <span>Management.</span>
          </h1>

          <p className="brand-description">
            One centralized platform for managing people,
            projects, attendance, payroll and performance.
          </p>

          {/* BRAND STATS */}
          <div className="brand-stats">

            <div className="brand-stat">
              <strong>01</strong>
              <div>
                <b>People</b>
                <span>Employee lifecycle</span>
              </div>
            </div>

            <div className="brand-stat">
              <strong>02</strong>
              <div>
                <b>Workforce</b>
                <span>Project deployment</span>
              </div>
            </div>

            <div className="brand-stat">
              <strong>03</strong>
              <div>
                <b>Performance</b>
                <span>Growth & productivity</span>
              </div>
            </div>

          </div>

          {/* BRAND MESSAGE */}
          <div className="brand-message">
            <span className="message-dot"></span>

            <div>
              <strong>Built for HR Operations</strong>
              <p>
                Employee master, attendance, leave,
                payroll and workforce reporting.
              </p>
            </div>
          </div>

        </div>

        {/* LEFT FOOTER */}
        <footer className="brand-footer">
          <span>BAUER Engineering India Pvt. Ltd.</span>
          <span>HRMS • Secure Workspace</span>
        </footer>

      </section>


      {/* =====================================================
          RIGHT LOGIN PANEL
      ====================================================== */}

      <section className="bauer-login-panel">

        <div className="login-content">

          {/* MOBILE LOGO */}
          <div className="mobile-logo">
            <div className="mobile-logo-box">
              <img
                src="/bauer-logo.png"
                alt="BAUER"
              />
            </div>
          </div>


          {/* LOGIN HEADER */}
          <div className="login-header">

            <div className="secure-label">
              <span></span>
              SECURE HRMS ACCESS
            </div>

            <h2>
              Welcome back.
            </h2>

            <p>
              Sign in to continue to your HR workspace.
            </p>

          </div>


          {/* LOGIN FORM */}
          <form
            className="bauer-login-form"
            onSubmit={handleSubmit}
          >

            {/* USERNAME */}
            <div className="login-field">

              <label htmlFor="bauer-username">
                Username / Work Email
              </label>

              <input
                id="bauer-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                disabled={loading}
              />

            </div>


            {/* PASSWORD */}
            <div className="login-field">

              <label htmlFor="bauer-password">
                Password
              </label>

              <input
                id="bauer-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />

            </div>


            {/* ERROR */}
            {error && (
              <div className="login-error">
                <div className="error-symbol">!</div>

                <span>{error}</span>
              </div>
            )}


            {/* OPTIONS */}
            <div className="login-options">

              <label className="remember-me">

                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) =>
                    setRememberMe(e.target.checked)
                  }
                  disabled={loading}
                />

                <span className="custom-checkbox"></span>

                <span className="remember-text">
                  Remember me
                </span>

              </label>


              <button
                type="button"
                className="forgot-password"
                onClick={() =>
                  alert(
                    "Please contact the HRMS Administrator to reset your password."
                  )
                }
                disabled={loading}
              >
                Forgot password?
              </button>

            </div>


            {/* SIGN IN */}
            <button
              type="submit"
              className="signin-button"
              disabled={loading}
            >

              {loading ? (
                <>
                  <span className="button-loader"></span>
                  Signing in...
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <span className="button-arrow">→</span>
                </>
              )}

            </button>

          </form>


          {/* SECURITY STATUS */}
          <div className="security-status">

            <span className="security-status-dot"></span>

            <span>
              Secure HRMS environment
            </span>

          </div>


          {/* LOGIN INFORMATION */}
          <div className="login-info-card">

            <div className="info-icon">
              HR
            </div>

            <div className="info-content">
              <strong>BAUER HRMS</strong>

              <span>
                Authorized workforce management portal
              </span>
            </div>

            <div className="info-status">
              <span></span>
              Online
            </div>

          </div>


          {/* COPYRIGHT */}
          <div className="login-footer">

            <span>
              © 2026 BAUER Engineering India Pvt. Ltd.
            </span>

            <span>
              Human Resource Management System
            </span>

          </div>

        </div>

      </section>

    </main>
  );
}