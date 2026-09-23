import { useEffect, useState } from "react";
import "./Settings.css";
import {
  requestAdminPasswordChangeOtp,
  verifyAdminPasswordChangeOtp,
} from "./auth";
import {
  getDateTimeSettings,
  saveDateTimeSettings,
} from "./dateUtils";

const ADMIN_MOBILE_KEY = "bauerHrmsAdminMobile";

const maskMobile = (mobile) => {
  const value = String(mobile || "").replace(/\D/g, "");
  if (value.length < 4) return value ? "••••" : "Not registered";
  return `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const normalizeMobile = (value) =>
  String(value || "").replace(/\D/g, "").slice(-10);

export default function Settings({ currentUser }) {
  const [mobile, setMobile] = useState(
    () => localStorage.getItem(ADMIN_MOBILE_KEY) || ""
  );
  const [mobileInput, setMobileInput] = useState(mobile);
  const [editingMobile, setEditingMobile] = useState(!mobile);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const [dateTimeSettings, setDateTimeSettings] = useState(() =>
    getDateTimeSettings()
  );

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem(ADMIN_MOBILE_KEY) || "";
      setMobile(saved);
      setMobileInput(saved);
      setEditingMobile(!saved);
    };

    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    const sync = () => setDateTimeSettings(getDateTimeSettings());

    window.addEventListener("bauerHrmsDateTimeSettingsUpdated", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("bauerHrmsDateTimeSettingsUpdated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const saveMobile = () => {
    setError("");
    setMessage("");

    const normalized = normalizeMobile(mobileInput);

    if (normalized.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    localStorage.setItem(ADMIN_MOBILE_KEY, normalized);
    setMobile(normalized);
    setMobileInput(normalized);
    setEditingMobile(false);
    setMessage("Registered mobile number saved successfully.");

    window.dispatchEvent(new Event("bauerHrmsAdminMobileUpdated"));
  };

  const saveDateTime = () => {
    setError("");
    setMessage("");

    const saved = saveDateTimeSettings(dateTimeSettings);
    setDateTimeSettings(saved);

    setMessage(
      `Date & Time settings saved. Date format: ${saved.dateFormat}.`
    );
  };

  const sendPasswordOtp = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!mobile) {
      setError("Please register the Admin mobile number first.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await requestAdminPasswordChangeOtp(
        currentPassword,
        newPassword
      );

      setOtpMode(true);
      setDevOtp(result?.devOtp || "");
      setMessage(`OTP sent to ${maskMobile(mobile)}.`);
    } catch (err) {
      setError(err?.message || "Unable to send password-change OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!otp.trim()) {
      setError("Please enter the OTP.");
      return;
    }

    setLoading(true);

    try {
      const result = await verifyAdminPasswordChangeOtp(otp.trim());

      if (!result?.success) {
        throw new Error("OTP verification failed.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setDevOtp("");
      setOtpMode(false);

      setMessage("Password changed successfully. OTP verification completed.");
    } catch (err) {
      setError(err?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <span className="settings-eyebrow">ADMIN CONTROL</span>
          <h1>Settings</h1>
          <p>Manage your Admin profile and account security.</p>
        </div>

        <div className="security-status">
          <span /> Account secured
        </div>
      </div>

      {message && <div className="settings-alert success">✓ {message}</div>}
      {error && <div className="settings-alert error">! {error}</div>}

      <div className="settings-grid">
        <article className="settings-card profile-card">
          <div className="card-heading">
            <div className="card-icon purple">♙</div>
            <div>
              <span>PROFILE</span>
              <h2>Admin Profile</h2>
            </div>
          </div>

          <div className="admin-profile">
            <div className="admin-avatar">
              {String(currentUser?.name || "Admin User")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div>
              <strong>{currentUser?.name || "Admin User"}</strong>
              <small>{currentUser?.role || "HR Admin"}</small>
            </div>
          </div>

          <div className="field-grid">
            <label>
              <span>Full Name</span>
              <input value={currentUser?.name || "Admin User"} readOnly />
            </label>

            <label>
              <span>Email</span>
              <input value={currentUser?.email || "admin@bauer.com"} readOnly />
            </label>
          </div>

          <div className="mobile-section">
            <div className="mobile-title">
              <div>
                <span>REGISTERED MOBILE</span>
                <strong>{mobile ? maskMobile(mobile) : "Not registered"}</strong>
              </div>

              {mobile && !editingMobile && (
                <button
                  onClick={() => {
                    setEditingMobile(true);
                    setError("");
                    setMessage("");
                  }}
                >
                  Edit
                </button>
              )}
            </div>

            {editingMobile && (
              <div className="mobile-edit-row">
                <input
                  value={mobileInput}
                  onChange={(e) =>
                    setMobileInput(
                      e.target.value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                />

                <button className="primary-btn" onClick={saveMobile}>
                  Save Mobile
                </button>

                {mobile && (
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      setMobileInput(mobile);
                      setEditingMobile(false);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

            <p>
              This number will receive OTPs for Admin login and password changes.
            </p>
          </div>
        </article>

        <article className="settings-card security-card">
          <div className="card-heading">
            <div className="card-icon blue">⌁</div>
            <div>
              <span>SECURITY</span>
              <h2>Change Password</h2>
            </div>
          </div>

          <p className="security-copy">
            Password changes require OTP verification on the registered Admin mobile.
          </p>

          {!otpMode ? (
            <form onSubmit={sendPasswordOtp} className="password-form">
              <label>
                <span>Current Password</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </label>

              <label>
                <span>New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                />
              </label>

              <label>
                <span>Confirm New Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
              </label>

              <button
                className="primary-btn wide"
                disabled={loading || !mobile}
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>

              {!mobile && (
                <small className="form-note">
                  Register a mobile number above before changing the password.
                </small>
              )}
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="password-form">
              <div className="otp-box">
                <strong>Enter verification code</strong>
                <span>OTP sent to {maskMobile(mobile)}</span>
              </div>

              <label>
                <span>6-digit OTP</span>
                <input
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter OTP"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                />
              </label>

              {import.meta.env.DEV && devOtp && (
                <div className="dev-otp">
                  DEV OTP: <b>{devOtp}</b>
                </div>
              )}

              <button
                className="primary-btn wide"
                disabled={loading || otp.length !== 6}
              >
                {loading
                  ? "Verifying..."
                  : "Verify OTP & Change Password"}
              </button>

              <button
                type="button"
                className="ghost-btn wide"
                onClick={() => {
                  setOtpMode(false);
                  setOtp("");
                  setDevOtp("");
                }}
              >
                Back
              </button>
            </form>
          )}
        </article>

        <article className="settings-card security-card">
          <div className="card-heading">
            <div className="card-icon purple">◷</div>
            <div>
              <span>REGIONAL PREFERENCES</span>
              <h2>Date &amp; Time</h2>
            </div>
          </div>

          <p className="security-copy">
            Set the date and time format for HRSYNC shared date utilities.
          </p>

          <div className="password-form">
            <label>
              <span>Date Format</span>
              <select
                value={dateTimeSettings.dateFormat}
                onChange={(e) =>
                  setDateTimeSettings((prev) => ({
                    ...prev,
                    dateFormat: e.target.value,
                  }))
                }
              >
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                <option value="DD-MMM-YYYY">
                  DD-MMM-YYYY (24-Sep-2026)
                </option>
                <option value="DD-Month Name-YYYY">
                  DD-Month Name-YYYY (24-September-2026)
                </option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </label>

            <label>
              <span>Time Format</span>
              <select
                value={dateTimeSettings.timeFormat}
                onChange={(e) =>
                  setDateTimeSettings((prev) => ({
                    ...prev,
                    timeFormat: e.target.value,
                  }))
                }
              >
                <option value="12-hour">12-hour (09:30 AM)</option>
                <option value="24-hour">24-hour (09:30)</option>
              </select>
            </label>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(124,92,255,.06)",
                border: "1px solid rgba(124,92,255,.12)",
                color: "#555",
                fontSize: 12,
              }}
            >
              <strong style={{ color: "#3f2d8f" }}>Preview: </strong>
              {dateTimeSettings.dateFormat === "DD-Month Name-YYYY"
                ? "24-September-2026"
                : dateTimeSettings.dateFormat === "DD-MMM-YYYY"
                ? "24-Sep-2026"
                : dateTimeSettings.dateFormat === "YYYY-MM-DD"
                ? "2026-09-24"
                : "24-09-2026"}
              {" · "}
              {dateTimeSettings.timeFormat === "24-hour"
                ? "09:30"
                : "09:30 AM"}
            </div>

            <button
              type="button"
              className="primary-btn wide"
              onClick={saveDateTime}
            >
              Save Date &amp; Time Settings
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
