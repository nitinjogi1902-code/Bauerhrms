import { useEffect, useState } from "react";
import "./Login.css";
import {
  activateEmployeeAccount,
  authenticateAdmin,
  authenticateEmployee,
  requestAdminPasswordResetOtp,
  verifyAdminPasswordResetOtp,
} from "./auth";

const ADMIN_EMAIL = "admin@bauer.com";

const UserIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m3 3 18 18" />
    <path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16.7 16.7 0 0 1-3.1 3.8" />
    <path d="M6.1 6.9C3.8 8.6 2.5 12 2.5 12s3.4 6 9.5 6c1.3 0 2.4-.3 3.4-.7" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

const OtpIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="6" width="16" height="12" rx="2.5" />
    <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
  </svg>
);

export default function Login({ onLogin }) {
  const [activationToken, setActivationToken] = useState("");
  const [activationMode, setActivationMode] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpMobile, setOtpMobile] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [otpEmployee, setOtpEmployee] = useState(null);
  const [otpPurpose, setOtpPurpose] = useState("login");
  const [resendSeconds, setResendSeconds] = useState(0);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash || "";

    if (hash.startsWith("#activate=")) {
      setActivationToken(
        decodeURIComponent(hash.slice("#activate=".length))
      );
      setActivationMode(true);
    }
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setResendSeconds(v => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const resetOtp = () => {
    setOtpMode(false);
    setOtp("");
    setOtpMobile("");
    setDevOtp("");
    setOtpEmployee(null);
    setOtpPurpose("login");
    setResendSeconds(0);
  };

  const handleActivation = async (event) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const account = await activateEmployeeAccount(
        activationToken,
        newPassword
      );

      window.location.hash = "";
      setActivationMode(false);
      setUsername(account.email || "");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");

      window.alert(
        "Password created successfully. Please login with your official email."
      );
    } catch (err) {
      setError(err?.message || "Unable to activate account.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);

    try {
      if (username.trim().toLowerCase() === ADMIN_EMAIL) {
        const adminResult = await authenticateAdmin(username, password);

        if (!adminResult) {
          setError("Invalid email or password.");
          return;
        }
        onLogin(rememberMe, adminResult.admin);
return;
      }

      const result = await authenticateEmployee(username, password);

      if (!result) {
        setError("Invalid email or password.");
        return;
      }

      if (result.inactive) {
        setError(
          "Your account is not activated yet. Please use the activation email sent by HR."
        );
        return;
      }
      onLogin(rememberMe, result.employee);
      return;
} catch (err) {
      setError(err?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      if (otpPurpose === "reset") {
        if (newPassword.length < 8) {
          throw new Error("New password must be at least 8 characters.");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await verifyAdminPasswordResetOtp(otp, newPassword);
        setOtpMode(false);
        setOtp("");
        setDevOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setPassword("");
        setOtpPurpose("login");
        setError("Password reset successfully. Please login with your new password.");
        return;
      }
      throw new Error("Login OTP is disabled. Please return to the login screen and sign in with email and password.");
    } catch (err) {
      setError(err?.message || "Unable to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendSeconds > 0) return;
    setError("");
    setLoading(true);

    try {
      if (otpPurpose === "reset" && username.trim().toLowerCase() === ADMIN_EMAIL) {
        const result = await requestAdminPasswordResetOtp();
        setOtpMobile(result.mobile);
        setDevOtp(result.devOtp || "");
      } else {
        throw new Error("Login OTP is disabled.");
      }
      setOtp("");
      setResendSeconds(30);
    } catch (err) {
      setError(err?.message || "Unable to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-bg-brand">
        <img src="/HR SYNC Logo.png" alt="HRSYNC" />
        <div>
          <strong>HRSYNC</strong>
          <span>PEOPLE • PROCESS • PROGRESS</span>
        </div>
      </div>

      <section className="login-side login-side-left">
        <div className="left-copy">
          <span className="eyebrow">SMART HR • BETTER PEOPLE</span>

          <h2>
            People
            <span>Power</span>
            <span>Progress</span>
            Together
          </h2>

          <p>
            A smarter way to manage people, processes and workplace growth.
          </p>
        </div>

        <div className="people-orbit">
          <div className="orbit-line orbit-line-one"></div>
          <div className="orbit-line orbit-line-two"></div>

          <div className="orbit-card orbit-people">
            <div className="orbit-icon">♟</div>
            <strong>People</strong>
            <small>Connected teams</small>
          </div>

          <div className="orbit-card orbit-process">
            <div className="orbit-icon">⚙</div>
            <strong>Process</strong>
            <small>Smarter workflow</small>
          </div>

          <div className="orbit-card orbit-progress">
            <div className="orbit-icon">↗</div>
            <strong>Progress</strong>
            <small>Better growth</small>
          </div>

          <div className="mini-dashboard">
            <div className="mini-dashboard-top">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div className="mini-dashboard-content">
              <div>
                <small>WORKFORCE</small>
                <strong>Building Better Workplaces</strong>
              </div>

              <div className="growth-bars">
                <i></i>
                <i></i>
                <i></i>
                <i></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="login-card">
        <div className="login-brand">
          <img src="/HR SYNC Logo.png" alt="HRSYNC" />

          <div>
            <strong>HRSYNC</strong>
            <span>Human Resource Management System</span>
          </div>
        </div>

        {activationMode ? (
          <form onSubmit={handleActivation}>
            <div className="login-heading">
              <div className="heading-badge">🔐</div>
              <div>
                <h1>Activate Account</h1>
                <p>Create your HRSYNC password.</p>
              </div>
            </div>

            <label>
              New Password
              <div className="input-wrapper password-wrapper">
                <span className="input-icon">
                  <LockIcon />
                </span>

                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoFocus
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showNewPassword ? "Hide password" : "Show password"
                  }
                  onClick={() => setShowNewPassword((value) => !value)}
                >
                  {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            <label>
              Confirm Password
              <div className="input-wrapper password-wrapper">
                <span className="input-icon">
                  <LockIcon />
                </span>

                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            {error && (
              <div className="login-error">
                <span>!</span>
                {error}
              </div>
            )}

            <button className="login-submit" disabled={loading}>
              {loading ? "Activating…" : "Create Password & Activate"}
            </button>
          </form>
        ) : otpMode ? (
          <form onSubmit={handleVerifyOtp}>
            <div className="login-heading">
              <div className="heading-badge">
                <OtpIcon />
              </div>

              <div>
                <span className="welcome-small">SECURITY VERIFICATION</span>
                <h1>{otpPurpose === "reset" ? "Reset Password" : "Verify OTP"}</h1>
                <p>
                  We sent a 6-digit verification code to{" "}
                  <strong>{otpMobile}</strong>.
                </p>
              </div>
            </div>

            {otpPurpose === "reset" && (
              <>
                <label>
                  New Password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Confirm New Password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                </label>
              </>
            )}

            <label>
              One-Time Password
              <div className="input-wrapper otp-input-wrapper">
                <span className="input-icon">
                  <OtpIcon />
                </span>

                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit OTP"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
            </label>

            {devOtp && (
              <div className="otp-dev-box">
                <strong>Development OTP:</strong> {devOtp}
                <small>
                  This is visible only during Vite development. Connect an
                  SMS backend before production.
                </small>
              </div>
            )}

            {error && (
              <div className="login-error">
                <span>!</span>
                {error}
              </div>
            )}

            <button className="login-submit" disabled={loading}>
              {loading ? "Verifying…" : "Verify & Login"}
            </button>

            <div className="otp-actions">
              <button
                type="button"
                className="forgot-password"
                disabled={loading}
                onClick={handleResendOtp}
              >
                {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : "Resend OTP"}
              </button>

              <button
                type="button"
                className="forgot-password"
                onClick={() => {
                  resetOtp();
                  setError("");
                }}
              >
                Change email
              </button>
            </div>

            <p className="login-help">
              Your OTP is valid for 5 minutes. For security, only 5 incorrect
              attempts are allowed.
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="login-heading">
              <div>
                <span className="welcome-small">WELCOME TO HRSYNC</span>
                <h1>Welcome Back</h1>
                <p>Sign in to continue to your workspace.</p>
              </div>
            </div>

            <label>
              Email / Username
              <div className="input-wrapper">
                <span className="input-icon">
                  <UserIcon />
                </span>

                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Official email"
                  autoComplete="username"
                />
              </div>
            </label>

            <label>
              Password
              <div className="input-wrapper password-wrapper">
                <span className="input-icon">
                  <LockIcon />
                </span>

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            <div className="login-row">
              <label className="login-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="forgot-password"
                onClick={async () => {
                  setError("");
                  if (username.trim().toLowerCase() !== ADMIN_EMAIL) {
                    setError("Admin password reset is available for the Admin account. Employees should contact HR.");
                    return;
                  }
                  setLoading(true);
                  try {
                    const result = await requestAdminPasswordResetOtp();
                    setOtpPurpose("reset");
                    setOtpMobile(result.mobile);
                    setDevOtp(result.devOtp || "");
                    setOtp("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setResendSeconds(30);
                    setOtpMode(true);
                  } catch (err) {
                    setError(err?.message || "Unable to send password reset OTP.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="login-error">
                <span>!</span>
                {error}
              </div>
            )}

            <button className="login-submit" disabled={loading}>
              <span>{loading ? "Signing in…" : "Login"}</span>
              {!loading && <span className="login-arrow">→</span>}
            </button>

            <p className="login-help">
              Employee? Use your official email and the password you created
              from the HR activation email.
            </p>
          </form>
        )}

        <footer>© 2026 HRSYNC. All rights reserved.</footer>
      </section>

      <section className="login-side login-side-right">
        <div className="workforce-visual">
          <div className="workforce-glow"></div>

          <img
            src="/hrsync-workforce.png"
            alt="HRSYNC Workforce"
            className="workforce-image"
          />

          <div className="workforce-caption">
            <span>SMART HR • BETTER PEOPLE</span>
            <strong>People. Process. Progress.</strong>
            <small>One connected workforce experience.</small>
          </div>
        </div>
      </section>
    </main>
  );
}
