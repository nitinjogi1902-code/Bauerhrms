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

import PolicyManagement from "./PolicyManagement";

const ADMIN_MOBILE_KEY = "bauerHrmsAdminMobile";

/* =========================================================
   HELPERS
   ========================================================= */

const maskMobile = (mobile) => {
  const value = String(mobile || "").replace(/\D/g, "");

  if (value.length < 4) {
    return value ? "••••" : "Not registered";
  }

  return `${"•".repeat(
    Math.max(0, value.length - 4)
  )}${value.slice(-4)}`;
};

const normalizeMobile = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(-10);

/* =========================================================
   SETTINGS
   ========================================================= */

export default function Settings({ currentUser }) {
  /* ---------------------------------------------------------
     MOBILE
     --------------------------------------------------------- */

  const [mobile, setMobile] = useState(
    () => localStorage.getItem(ADMIN_MOBILE_KEY) || ""
  );

  const [mobileInput, setMobileInput] = useState(mobile);

  const [editingMobile, setEditingMobile] =
    useState(!mobile);

  /* ---------------------------------------------------------
     ALERTS
     --------------------------------------------------------- */

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /* ---------------------------------------------------------
     PASSWORD
     --------------------------------------------------------- */

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [otp, setOtp] = useState("");

  const [otpMode, setOtpMode] =
    useState(false);

  const [devOtp, setDevOtp] = useState("");

  const [loading, setLoading] =
    useState(false);

  /* ---------------------------------------------------------
     DATE & TIME
     --------------------------------------------------------- */

  const [dateTimeSettings, setDateTimeSettings] =
    useState(() => getDateTimeSettings());

  /* ---------------------------------------------------------
     POLICY MANAGEMENT
     --------------------------------------------------------- */

  const [showPolicyManagement, setShowPolicyManagement] =
    useState(false);

  /* =========================================================
     SYNC REGISTERED MOBILE
     ========================================================= */

  useEffect(() => {
    const sync = () => {
      const saved =
        localStorage.getItem(ADMIN_MOBILE_KEY) || "";

      setMobile(saved);
      setMobileInput(saved);
      setEditingMobile(!saved);
    };

    window.addEventListener("storage", sync);

    window.addEventListener(
      "bauerHrmsAdminMobileUpdated",
      sync
    );

    return () => {
      window.removeEventListener(
        "storage",
        sync
      );

      window.removeEventListener(
        "bauerHrmsAdminMobileUpdated",
        sync
      );
    };
  }, []);

  /* =========================================================
     SYNC DATE & TIME SETTINGS
     ========================================================= */

  useEffect(() => {
    const sync = () => {
      setDateTimeSettings(
        getDateTimeSettings()
      );
    };

    window.addEventListener(
      "bauerHrmsDateTimeSettingsUpdated",
      sync
    );

    window.addEventListener(
      "storage",
      sync
    );

    return () => {
      window.removeEventListener(
        "bauerHrmsDateTimeSettingsUpdated",
        sync
      );

      window.removeEventListener(
        "storage",
        sync
      );
    };
  }, []);

  /* =========================================================
     CLEAR ALERT
     ========================================================= */

  const clearAlerts = () => {
    setMessage("");
    setError("");
  };

  /* =========================================================
     SAVE MOBILE
     ========================================================= */

  const saveMobile = () => {
    clearAlerts();

    const normalized =
      normalizeMobile(mobileInput);

    if (normalized.length !== 10) {
      setError(
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }

    localStorage.setItem(
      ADMIN_MOBILE_KEY,
      normalized
    );

    setMobile(normalized);
    setMobileInput(normalized);
    setEditingMobile(false);

    setMessage(
      "Registered mobile number saved successfully."
    );

    window.dispatchEvent(
      new Event(
        "bauerHrmsAdminMobileUpdated"
      )
    );
  };

  /* =========================================================
     SAVE DATE & TIME
     ========================================================= */

  const saveDateTime = () => {
    clearAlerts();

    const saved =
      saveDateTimeSettings(
        dateTimeSettings
      );

    setDateTimeSettings(saved);

    setMessage(
      `Date & Time settings saved. Date format: ${saved.dateFormat}.`
    );
  };

  /* =========================================================
     PASSWORD OTP
     ========================================================= */

  const sendPasswordOtp = async (event) => {
    event.preventDefault();

    clearAlerts();

    if (!mobile) {
      setError(
        "Please register the Admin mobile number first."
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "New password must be at least 8 characters."
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        "New password and confirm password do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const result =
        await requestAdminPasswordChangeOtp(
          currentPassword,
          newPassword
        );

      setOtpMode(true);
      setDevOtp(
        result?.devOtp || ""
      );

      setMessage(
        `OTP sent to ${maskMobile(mobile)}.`
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to send password-change OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     VERIFY OTP
     ========================================================= */

  const verifyOtp = async (event) => {
    event.preventDefault();

    clearAlerts();

    if (!otp.trim()) {
      setError(
        "Please enter the OTP."
      );
      return;
    }

    setLoading(true);

    try {
      const result =
        await verifyAdminPasswordChangeOtp(
          otp.trim()
        );

      if (!result?.success) {
        throw new Error(
          "OTP verification failed."
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setOtp("");
      setDevOtp("");
      setOtpMode(false);

      setMessage(
        "Password changed successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Invalid or expired OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     DATE PREVIEW
     ========================================================= */

  const getDatePreview = () => {
    switch (
      dateTimeSettings.dateFormat
    ) {
      case "DD-Month Name-YYYY":
        return "24-September-2026";

      case "DD-MMM-YYYY":
        return "24-Sep-2026";

      case "YYYY-MM-DD":
        return "2026-09-24";

      default:
        return "24-09-2026";
    }
  };

  const getTimePreview = () =>
    dateTimeSettings.timeFormat ===
    "24-hour"
      ? "09:30"
      : "09:30 AM";

  /* =========================================================
     POLICY MANAGEMENT SCREEN
     ========================================================= */

  if (showPolicyManagement) {
    return (
      <PolicyManagement
        onClose={() => {
          setShowPolicyManagement(
            false
          );

          clearAlerts();
        }}
      />
    );
  }

  /* =========================================================
     MAIN SETTINGS
     ========================================================= */

  return (
    <section className="settings-page">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="settings-header">

        <div>
          <span className="settings-eyebrow">
            ADMIN CONTROL
          </span>

          <h1>Settings</h1>

          <p>
            Manage your profile, security,
            regional preferences and HR policies.
          </p>
        </div>

        <div className="security-status">
          <span />
          Account secured
        </div>

      </header>

      {/* =====================================================
          ALERTS
          ===================================================== */}

      {message && (
        <div className="settings-alert success">
          <span className="alert-icon">
            ✓
          </span>

          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="settings-alert error">
          <span className="alert-icon">
            !
          </span>

          <span>{error}</span>
        </div>
      )}

      {/* =====================================================
          SETTINGS GRID
          ===================================================== */}

      <div className="settings-grid">

        {/* ===================================================
            01 — ADMIN PROFILE
            =================================================== */}

        <article className="settings-card profile-card">

          <div className="card-heading">

            <div className="card-icon purple">
              ♙
            </div>

            <div>
              <span>PROFILE</span>
              <h2>Admin Profile</h2>
            </div>

          </div>

          {/* ADMIN IDENTITY */}

          <div className="admin-profile">

            <div className="admin-avatar">
              {String(
                currentUser?.name ||
                  "Admin User"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="admin-profile-info">

              <strong>
                {currentUser?.name ||
                  "Admin User"}
              </strong>

              <small>
                {currentUser?.role ||
                  "HR Admin"}
              </small>

            </div>

            <span className="profile-badge">
              ADMIN
            </span>

          </div>

          {/* BASIC DETAILS */}

          <div className="field-grid">

            <label>
              <span>Full Name</span>

              <input
                value={
                  currentUser?.name ||
                  "Admin User"
                }
                readOnly
              />
            </label>

            <label>
              <span>Email</span>

              <input
                value={
                  currentUser?.email ||
                  "admin@bauer.com"
                }
                readOnly
              />
            </label>

          </div>

          {/* REGISTERED MOBILE */}

          <div className="mobile-section">

            <div className="mobile-title">

              <div>
                <span>
                  REGISTERED MOBILE
                </span>

                <strong>
                  {mobile
                    ? maskMobile(mobile)
                    : "Not registered"}
                </strong>
              </div>

              {mobile &&
                !editingMobile && (
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => {
                      setEditingMobile(
                        true
                      );
                      clearAlerts();
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
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10)
                    )
                  }
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                />

                <button
                  type="button"
                  className="primary-btn"
                  onClick={saveMobile}
                >
                  Save
                </button>

                {mobile && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setMobileInput(
                        mobile
                      );
                      setEditingMobile(
                        false
                      );
                    }}
                  >
                    Cancel
                  </button>
                )}

              </div>
            )}

            <p>
              OTPs for Admin security
              will be sent to this number.
            </p>

          </div>

        </article>

        {/* ===================================================
            02 — SECURITY
            =================================================== */}

        <article className="settings-card security-card">

          <div className="card-heading">

            <div className="card-icon blue">
              ⌁
            </div>

            <div>
              <span>SECURITY</span>
              <h2>Change Password</h2>
            </div>

          </div>

          <p className="security-copy">
            Secure your Admin account using
            OTP verification.
          </p>

          {!otpMode ? (

            <form
              onSubmit={
                sendPasswordOtp
              }
              className="password-form"
            >

              <label>
                <span>
                  Current Password
                </span>

                <input
                  type="password"
                  value={
                    currentPassword
                  }
                  onChange={(e) =>
                    setCurrentPassword(
                      e.target.value
                    )
                  }
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </label>

              <label>
                <span>
                  New Password
                </span>

                <input
                  type="password"
                  value={
                    newPassword
                  }
                  onChange={(e) =>
                    setNewPassword(
                      e.target.value
                    )
                  }
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                />
              </label>

              <label>
                <span>
                  Confirm Password
                </span>

                <input
                  type="password"
                  value={
                    confirmPassword
                  }
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
              </label>

              <button
                type="submit"
                className="primary-btn wide"
                disabled={
                  loading ||
                  !mobile
                }
              >
                {loading
                  ? "Sending OTP..."
                  : "Send OTP"}
              </button>

              {!mobile && (
                <small className="form-note">
                  Register your mobile
                  number first.
                </small>
              )}

            </form>

          ) : (

            <form
              onSubmit={verifyOtp}
              className="password-form"
            >

              <div className="otp-box">

                <div className="otp-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    Verification required
                  </strong>

                  <span>
                    OTP sent to{" "}
                    {maskMobile(
                      mobile
                    )}
                  </span>
                </div>

              </div>

              <label>
                <span>
                  6-digit OTP
                </span>

                <input
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      e.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(0, 6)
                    )
                  }
                  placeholder="Enter OTP"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                />
              </label>

              {import.meta.env
                .DEV &&
                devOtp && (
                  <div className="dev-otp">
                    DEV OTP:{" "}
                    <b>{devOtp}</b>
                  </div>
                )}

              <button
                type="submit"
                className="primary-btn wide"
                disabled={
                  loading ||
                  otp.length !== 6
                }
              >
                {loading
                  ? "Verifying..."
                  : "Verify & Change Password"}
              </button>

              <button
                type="button"
                className="ghost-btn wide"
                onClick={() => {
                  setOtpMode(
                    false
                  );
                  setOtp("");
                  setDevOtp("");
                }}
              >
                Back
              </button>

            </form>

          )}

        </article>

        {/* ===================================================
            03 — DATE & TIME
            =================================================== */}

        <article className="settings-card">

          <div className="card-heading">

            <div className="card-icon purple">
              ◷
            </div>

            <div>
              <span>
                REGIONAL PREFERENCES
              </span>

              <h2>
                Date &amp; Time
              </h2>
            </div>

          </div>

          <p className="security-copy">
            Configure how dates and times
            appear throughout HRSYNC.
          </p>

          <div className="password-form">

            <label>
              <span>
                Date Format
              </span>

              <select
                value={
                  dateTimeSettings.dateFormat
                }
                onChange={(e) =>
                  setDateTimeSettings(
                    (prev) => ({
                      ...prev,
                      dateFormat:
                        e.target.value,
                    })
                  )
                }
              >
                <option value="DD-MM-YYYY">
                  DD-MM-YYYY
                </option>

                <option value="DD-MMM-YYYY">
                  DD-MMM-YYYY
                  (24-Sep-2026)
                </option>

                <option value="DD-Month Name-YYYY">
                  DD-Month Name-YYYY
                  (24-September-2026)
                </option>

                <option value="YYYY-MM-DD">
                  YYYY-MM-DD
                </option>
              </select>
            </label>

            <label>
              <span>
                Time Format
              </span>

              <select
                value={
                  dateTimeSettings.timeFormat
                }
                onChange={(e) =>
                  setDateTimeSettings(
                    (prev) => ({
                      ...prev,
                      timeFormat:
                        e.target.value,
                    })
                  )
                }
              >
                <option value="12-hour">
                  12-hour (09:30 AM)
                </option>

                <option value="24-hour">
                  24-hour (09:30)
                </option>
              </select>
            </label>

            {/* PREVIEW */}

            <div className="datetime-preview">

              <span>
                PREVIEW
              </span>

              <strong>
                {getDatePreview()}
                {" · "}
                {getTimePreview()}
              </strong>

            </div>

            <button
              type="button"
              className="primary-btn wide"
              onClick={
                saveDateTime
              }
            >
              Save Preferences
            </button>

          </div>

        </article>

        {/* ===================================================
            04 — POLICY MANAGEMENT
            =================================================== */}

        <article className="settings-card policy-management-card">

          <div className="card-heading">

            <div className="card-icon purple">
              ⚙
            </div>

            <div>
              <span>
                HR GOVERNANCE
              </span>

              <h2>
                Policy Management
              </h2>
            </div>

          </div>

          <p className="security-copy policy-description">
            Centralized control for all
            HR rules, policies and workflows.
          </p>

          {/* POLICY STATS */}

          <div className="policy-mini-stats">

            <div className="policy-mini-stat">
              <strong>20</strong>
              <span>Total</span>
            </div>

            <div className="policy-mini-stat active">
              <strong>12</strong>
              <span>Active</span>
            </div>

            <div className="policy-mini-stat draft">
              <strong>03</strong>
              <span>Draft</span>
            </div>

            <div className="policy-mini-stat warning">
              <strong>02</strong>
              <span>Expiring</span>
            </div>

          </div>

          {/* POLICY COVERAGE */}

          <div className="policy-card-footer">

            <div>
              <small>
                POLICY COVERAGE
              </small>

              <strong>
                Attendance · Leave · Payroll · OT
              </strong>
            </div>

            <button
              type="button"
              className="policy-open-btn"
              onClick={() =>
                setShowPolicyManagement(
                  true
                )
              }
            >
              Manage →
            </button>

          </div>

        </article>

      </div>

    </section>
  );
}