import React, { useEffect, useMemo, useRef, useState } from "react";
import "./SuperAdmin.css";
import { supabase } from "./supabaseClient";

/**
 * HRSYNC HRMS — Platform Administration
 * Supabase-backed tenant registry. UI contract intentionally preserved.
 */

const DEFAULT_MODULES = [
  { id: "dashboard", name: "Dashboard", description: "Company HR overview and analytics", group: "Core" },
  { id: "employees", name: "Employees", description: "Employee master and employee records", group: "Core" },
  { id: "attendance", name: "Attendance", description: "Attendance, punches and exceptions", group: "Core" },
  { id: "leave", name: "Leave", description: "Leave policies, requests and approvals", group: "Core" },
  { id: "payroll", name: "Payroll", description: "Payroll processing, payslips and payroll reports", group: "Payroll" },
  { id: "vendors", name: "Vendors", description: "Vendor and contractor management", group: "Operations" },
  { id: "vendor_agreements", name: "Vendor Agreements", description: "Commercial/vendor agreement tracking", group: "Operations" },
  { id: "recruitment", name: "Recruitment", description: "Jobs, candidates and hiring workflow", group: "Talent" },
  { id: "training", name: "Training", description: "Training calendar, participants and records", group: "Talent" },
  { id: "pms", name: "PMS", description: "Performance management and appraisal", group: "Talent" },
  { id: "reports", name: "Reports & MIS", description: "Reports, exports and management information", group: "Analytics" },
  { id: "organization", name: "Organization", description: "Company masters, policies and configuration", group: "Core" },
  { id: "self_service", name: "Self Service", description: "Employee self-service workspace", group: "Employee" },
  { id: "settings", name: "Settings", description: "Company-level system settings", group: "Administration" },
];

const INDIA_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
].sort((a, b) => a.localeCompare(b));

// State-wise Indian city dataset. The application loads the public 1,220-city
// dataset once and filters it by the selected Indian state. A small fallback
// keeps the form usable if the external dataset is temporarily unavailable.
const INDIA_CITY_DATA_URL =
  "https://raw.githubusercontent.com/nshntarora/Indian-Cities-JSON/master/cities.json";

const COMPANY_ASSETS_BUCKET = "company-assets";
const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

const INDIA_CITY_FALLBACK = {
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Andhra Pradesh": ["Amaravati", "Anantapur", "Guntur", "Kakinada", "Nellore", "Tirupati", "Vijayawada", "Visakhapatnam"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro"],
  Assam: ["Dispur", "Dibrugarh", "Guwahati", "Jorhat", "Silchar", "Tezpur"],
  Bihar: ["Arrah", "Bhagalpur", "Darbhanga", "Gaya", "Muzaffarpur", "Patna", "Purnia"],
  Chandigarh: ["Chandigarh"],
  Chhattisgarh: ["Bhilai", "Bilaspur", "Durg", "Korba", "Raipur"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  Delhi: ["Delhi", "New Delhi", "Rohini", "Dwarka", "Narela"],
  Goa: ["Mapusa", "Margao", "Panaji", "Ponda", "Vasco da Gama"],
  Gujarat: ["Ahmedabad", "Anand", "Bhavnagar", "Gandhinagar", "Jamnagar", "Rajkot", "Surat", "Vadodara"],
  Haryana: ["Ambala", "Faridabad", "Gurugram", "Hisar", "Karnal", "Panipat", "Rohtak", "Sonipat", "Yamunanagar"],
  "Himachal Pradesh": ["Dharamshala", "Kullu", "Manali", "Mandi", "Shimla", "Solan"],
  "Jammu and Kashmir": ["Anantnag", "Jammu", "Srinagar", "Udhampur"],
  Jharkhand: ["Bokaro", "Dhanbad", "Deoghar", "Jamshedpur", "Ranchi"],
  Karnataka: ["Bengaluru", "Belagavi", "Ballari", "Davanagere", "Hubballi", "Mangaluru", "Mysuru", "Shivamogga"],
  Kerala: ["Alappuzha", "Ernakulam", "Kochi", "Kollam", "Kozhikode", "Palakkad", "Thiruvananthapuram", "Thrissur"],
  Ladakh: ["Leh", "Kargil"],
  Lakshadweep: ["Kavaratti"],
  "Madhya Pradesh": ["Bhopal", "Gwalior", "Indore", "Jabalpur", "Sagar", "Satna", "Ujjain"],
  Maharashtra: ["Aurangabad", "Amravati", "Bhiwandi", "Chhatrapati Sambhajinagar", "Kolhapur", "Mumbai", "Nagpur", "Nashik", "Navi Mumbai", "Pune", "Solapur", "Thane"],
  Manipur: ["Imphal", "Thoubal"],
  Meghalaya: ["Shillong", "Tura"],
  Mizoram: ["Aizawl", "Lunglei"],
  Nagaland: ["Dimapur", "Kohima", "Mokokchung"],
  Odisha: ["Bhubaneswar", "Berhampur", "Cuttack", "Puri", "Rourkela", "Sambalpur"],
  Puducherry: ["Puducherry", "Karaikal", "Mahe", "Yanam"],
  Punjab: ["Amritsar", "Bathinda", "Jalandhar", "Ludhiana", "Patiala", "Pathankot"],
  Rajasthan: ["Ajmer", "Alwar", "Bharatpur", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur"],
  Sikkim: ["Gangtok", "Namchi", "Pelling"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Thanjavur", "Tiruchirappalli", "Tirunelveli", "Tiruppur", "Vellore"],
  Telangana: ["Hyderabad", "Karimnagar", "Khammam", "Nizamabad", "Warangal"],
  Tripura: ["Agartala", "Dharmanagar", "Udaipur"],
  "Uttar Pradesh": ["Agra", "Aligarh", "Ayodhya", "Bareilly", "Ghaziabad", "Gorakhpur", "Kanpur", "Lucknow", "Meerut", "Moradabad", "Noida", "Prayagraj", "Varanasi"],
  Uttarakhand: ["Dehradun", "Haridwar", "Haldwani", "Nainital", "Rishikesh", "Roorkee"],
  "West Bengal": ["Asansol", "Durgapur", "Howrah", "Kolkata", "Siliguri"],
};

const normalizeIndianState = (value) => {
  const key = String(value || "").trim().toLowerCase();
  const aliases = {
    "himachal praddesh": "Himachal Pradesh",
    "himachal pradesh": "Himachal Pradesh",
    "uttaranchal": "Uttarakhand",
    "orissa": "Odisha",
    "pondicherry": "Puducherry",
    "puducherry": "Puducherry",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "delhi (nct)": "Delhi",
    "jammu & kashmir": "Jammu and Kashmir",
  };
  return aliases[key] || INDIA_STATES.find((item) => item.toLowerCase() === key) || value;
};

const buildCityMap = (rows) => {
  const map = {};
  (rows || []).forEach((row) => {
    const stateName = normalizeIndianState(row?.state);
    const cityName = String(row?.name || "").trim();
    if (!stateName || !cityName || !INDIA_STATES.includes(stateName)) return;
    if (!map[stateName]) map[stateName] = new Set();
    map[stateName].add(cityName);
  });

  INDIA_STATES.forEach((stateName) => {
    const merged = new Set([
      ...(INDIA_CITY_FALLBACK[stateName] || []),
      ...(map[stateName] ? Array.from(map[stateName]) : []),
    ]);
    map[stateName] = Array.from(merged).sort((a, b) => a.localeCompare(b));
  });

  return map;
};

const initialForm = {
  name: "", legalName: "", code: "", email: "", phone: "",
  address: "", city: "", state: "", pincode: "", country: "India",
  currency: "INR", currencySymbol: "₹", timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY", financialYear: "APR-MAR",
  adminName: "", adminEmail: "", logo: "", status: "ACTIVE",
  subscriptionStatus: "Trial", subscriptionPlan: "Trial", enabledModules: [],
};

const normalizeStatus = (value) => String(value || "").toUpperCase() === "ACTIVE" ? "ACTIVE" : "INACTIVE";
const dbStatus = (value) => value === "ACTIVE" ? "Active" : "Inactive";

const moduleFallback = (rows) => rows?.length ? rows.map((m) => {
  const id = m.module_code || m.id;
  return {
    id, dbId: m.id, name: m.module_name || id || "Module", description: m.description || "",
    group: m.module_group || m.module_group_name || DEFAULT_MODULES.find((item) => item.id === id)?.group || "Other",
  };
}) : DEFAULT_MODULES;

const companyFromDb = (row, moduleRows) => {
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  return {
    id: row.id, code: row.code || "", name: row.name || "",
    legalName: row.legal_name || row.name || "", country: row.country || "India",
    currency: row.currency_code || "", currencySymbol: row.currency_symbol || "",
    timezone: row.timezone || "UTC", dateFormat: row.date_format || "DD/MM/YYYY",
    financialYear: settings.financialYear || (Number(row.financial_year_start_month || 1) === 4 ? "APR-MAR" : "JAN-DEC"),
    email: row.email || "", adminName: settings.adminName || "", adminEmail: settings.adminEmail || row.email || "",
    logo: row.logo_url || "", status: normalizeStatus(row.status),
    subscriptionStatus: row.subscription_status || "Trial",
    subscriptionPlan: settings.subscriptionPlan || "Trial",
    phone: row.phone || "", address: row.address || "", city: row.city || "",
    state: normalizeIndianState(row.state || ""), pincode: row.pincode || "",
    enabledModules: moduleRows.filter((m) => m.module_code).map((m) => m.module_code),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
};

const makeCompanyCode = (name, companies) => {
  const base = String(name || "COMPANY").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "COMPANY";
  if (!companies.some((item) => String(item.code).toUpperCase() === base)) return base;
  let index = 2; while (companies.some((item) => String(item.code).toUpperCase() === `${base}${index}`)) index += 1;
  return `${base}${index}`;
};

function navIcon(type) {
    const paths = {
      grid: <>
        <rect x="3" y="3" width="7" height="7" rx="1.6" />
        <rect x="14" y="3" width="7" height="7" rx="1.6" />
        <rect x="3" y="14" width="7" height="7" rx="1.6" />
        <rect x="14" y="14" width="7" height="7" rx="1.6" />
      </>,
      building: <>
        <path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V21" />
        <path d="M15 9.5A1.5 1.5 0 0 1 16.5 8H19a1.5 1.5 0 0 1 1.5 1.5V21" />
        <path d="M8 8h3M8 12h3M8 16h3M17 12h1M17 16h1M2.5 21h19" />
      </>,
      layers: <>
        <path d="m12 3 8.5 4.7L12 12.4 3.5 7.7 12 3Z" />
        <path d="m3.5 12 8.5 4.7 8.5-4.7" />
        <path d="m3.5 16.3 8.5 4.7 8.5-4.7" />
      </>,
      shield: <>
        <path d="M12 3 20 6v5.7c0 4.8-3.2 8-8 9.3-4.8-1.3-8-4.5-8-9.3V6l8-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>,
      settings: <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.2 2.2-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7v.2h-3.1v-.2a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .4l-.1.1L6 17.1l.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 4.8 14h-.2v-3h.2a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.4-2L6 7.8 8.2 5.6l.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 11.4 4v-.2h3.1V4a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1 2.2 2.2-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1h.2v3h-.2A1.8 1.8 0 0 0 19.4 15Z" />
      </>,
      bell: <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </>,
      logout: <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M13 4h6v16h-6" />
      </>,
    };
    return (
      <svg className="sa-svg-icon" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true">
        {paths[type]}
      </svg>
    );
  };

function PlatformFrame({ children, currentUser, onLogout }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountModal, setAccountModal] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);

  const displayName =
    currentUser?.name ||
    currentUser?.email ||
    "HRSYNC Platform Super Admin";

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "SA";


  const closeMenus = () => {
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  const openAccountModal = (type) => {
    closeMenus();
    setAccountMessage("");
    if (type === "password") {
      setPassword("");
      setConfirmPassword("");
    }
    setAccountModal(type);
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setAccountMessage("");
    if (password.length < 8) {
      setAccountMessage("Password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setAccountMessage("New password and confirmation do not match.");
      return;
    }
    setAccountSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setAccountMessage("Password updated successfully.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setAccountMessage(error?.message || "Unable to update password.");
    } finally {
      setAccountSaving(false);
    }
  };

  const handleLogoutClick = () => {
    closeMenus();
    onLogout?.();
  };

  return (
    <div className="sa-app-shell">
      <aside className="sa-sidebar">
        <div className="sa-brand">
          <div className="sa-brand-lockup">
            <img className="sa-brand-mark" src="/HR%20SYNC%20Logo.png" alt="HRSYNC" />
            <div className="sa-brand-wordmark">
              <strong>HRSYNC</strong>
              <span>PEOPLE • PROCESS • PROGRESS</span>
            </div>
          </div>
        </div>

        <div className="sa-sidebar-section">
          <span className="sa-sidebar-label">PLATFORM</span>

          <div className="sa-sidebar-item active">
            <span className="sa-sidebar-icon">{navIcon("grid")}</span>
            <span>Overview</span>
          </div>
          <div className="sa-sidebar-item">
            <span className="sa-sidebar-icon">{navIcon("building")}</span>
            <span>Companies</span>
          </div>
          <div className="sa-sidebar-item">
            <span className="sa-sidebar-icon">{navIcon("layers")}</span>
            <span>Platform Modules</span>
          </div>
          <div className="sa-sidebar-item">
            <span className="sa-sidebar-icon">{navIcon("shield")}</span>
            <span>Access &amp; Permissions</span>
          </div>
          <div className="sa-sidebar-item">
            <span className="sa-sidebar-icon">{navIcon("settings")}</span>
            <span>Settings</span>
          </div>
        </div>

        <div className="sa-sidebar-bottom">
          <div className="sa-sidebar-tagline">
            <span className="sa-tagline-kicker">A SMARTER WAY</span>
            <strong>TO MANAGE PEOPLE</strong>
          </div>

          <div className="sa-platform-badge">
            <span className="sa-live-dot" />
            <div>
              <strong>HRSYNC Platform</strong>
              <small>System operational</small>
            </div>
          </div>

          <button type="button" className="sa-logout-btn" onClick={onLogout}>
            {navIcon("logout")}
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="sa-workspace">
        <header className="sa-topbar">
          <div className="sa-topbar-left">
            <div className="sa-topbar-brand">
              <img src="/HR%20SYNC%20Logo.png" alt="HRSYNC" />
            </div>
            <span className="sa-topbar-divider" />
            <div className="sa-topbar-title">
              <strong>Platform Administration</strong>
              <span>Manage • Configure • Grow</span>
            </div>
          </div>

          <div className="sa-topbar-right">
            <div className="sa-topbar-menu-wrap">
              <button
                type="button"
                className={`sa-topbar-icon ${notificationsOpen ? "is-open" : ""}`}
                title="Notifications"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => { setNotificationsOpen((value) => !value); setProfileOpen(false); }}
              >
                {navIcon("bell")}
                <i className="sa-notification-dot" />
              </button>
              {notificationsOpen && (
                <div className="sa-topbar-dropdown" role="menu">
                  <div className="sa-dropdown-head">
                    <div><strong>Notifications</strong><small>Platform activity and alerts</small></div>
                    <span className="sa-dropdown-count">0</span>
                  </div>
                  <div className="sa-notification-empty">
                    <span className="sa-notification-empty-icon">{navIcon("bell")}</span>
                    <strong>No new notifications</strong>
                    <span>You are all caught up. Important platform alerts will appear here.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="sa-topbar-menu-wrap">
              <button
                type="button"
                className={`sa-user-menu-button ${profileOpen ? "is-open" : ""}`}
                onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); }}
                aria-expanded={profileOpen}
                aria-label="Open Super Admin account menu"
              >
                <span className="sa-user-avatar">{initials}</span>
                <span className="sa-user-copy">
                  <strong>{displayName}</strong>
                  <small>Platform Super Admin</small>
                </span>
                <span className="sa-user-chevron">⌄</span>
              </button>
              {profileOpen && (
                <div className="sa-topbar-dropdown sa-profile-dropdown" role="menu">
                  <div className="sa-profile-dropdown-head">
                    <span className="sa-profile-large-avatar">{initials}</span>
                    <div><strong>{displayName}</strong><small>{currentUser?.email || "Super Admin account"}</small></div>
                  </div>
                  <button type="button" className="sa-dropdown-action" onClick={() => openAccountModal("profile")}>
                    <span className="sa-dropdown-action-icon">{navIcon("grid")}</span>
                    <span><strong>My Profile</strong><small>View your platform account</small></span>
                  </button>
                  <button type="button" className="sa-dropdown-action" onClick={() => openAccountModal("password")}>
                    <span className="sa-dropdown-action-icon">{navIcon("shield")}</span>
                    <span><strong>Change Password</strong><small>Update your sign-in password</small></span>
                  </button>
                  <div className="sa-dropdown-divider" />
                  <button type="button" className="sa-dropdown-action sa-dropdown-logout" onClick={handleLogoutClick}>
                    <span className="sa-dropdown-action-icon">{navIcon("logout")}</span>
                    <span><strong>Logout</strong><small>Sign out of HRSYNC</small></span>
                  </button>
                </div>
              )}
            </div>

            <button type="button" className="sa-topbar-logout" onClick={handleLogoutClick}>
              Logout
            </button>
          </div>
        </header>

        <div className="sa-workspace-content">
          {children}
        </div>

        {accountModal === "profile" && (
          <div className="sa-account-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccountModal(null); }}>
            <section className="sa-account-modal" role="dialog" aria-modal="true" aria-labelledby="sa-profile-title">
              <div className="sa-account-modal-head">
                <div><span className="sa-section-kicker">PLATFORM ACCOUNT</span><h3 id="sa-profile-title">My Profile</h3><p>Super Admin account information.</p></div>
                <button type="button" className="sa-icon-close" onClick={() => setAccountModal(null)} aria-label="Close">×</button>
              </div>
              <div className="sa-account-profile">
                <span className="sa-profile-large-avatar">{initials}</span>
                <div><strong>{displayName}</strong><span>Platform Super Admin</span><small>HRSYNC Platform Administration</small></div>
              </div>
              <div className="sa-account-grid">
                <div><span>Name</span><strong>{displayName}</strong></div>
                <div><span>Email</span><strong>{currentUser?.email || "—"}</strong></div>
                <div><span>Role</span><strong>Platform Super Admin</strong></div>
                <div><span>Status</span><strong>Active</strong></div>
              </div>
              <div className="sa-account-modal-actions"><button type="button" className="sa-btn sa-btn-secondary" onClick={() => setAccountModal(null)}>Close</button><button type="button" className="sa-btn sa-btn-primary" onClick={() => openAccountModal("password")}>Change Password</button></div>
            </section>
          </div>
        )}

        {accountModal === "password" && (
          <div className="sa-account-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccountModal(null); }}>
            <form className="sa-account-modal sa-password-modal" onSubmit={handlePasswordChange}>
              <div className="sa-account-modal-head">
                <div><span className="sa-section-kicker">SECURITY</span><h3>Change Password</h3><p>Update the password used for your HRSYNC Super Admin sign-in.</p></div>
                <button type="button" className="sa-icon-close" onClick={() => setAccountModal(null)} aria-label="Close">×</button>
              </div>
              {accountMessage && <div className={accountMessage.includes("successfully") ? "sa-account-success" : "sa-account-error"}>{accountMessage}</div>}
              <div className="sa-password-field">
                <label><span>New Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter new password" autoComplete="new-password" /></label>
                <label><span>Confirm New Password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter new password" autoComplete="new-password" /></label>
              </div>
              <div className="sa-password-note">Use at least 8 characters. Choose a password that is unique to your HRSYNC account.</div>
              <div className="sa-account-modal-actions"><button type="button" className="sa-btn sa-btn-secondary" onClick={() => setAccountModal(null)}>Cancel</button><button type="submit" className="sa-btn sa-btn-primary" disabled={accountSaving}>{accountSaving ? "Updating…" : "Update Password"}</button></div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuperAdmin({ currentUser, onLogout }) {
  const [state, setState] = useState({ companies: [], modules: DEFAULT_MODULES });
  const [activeTab, setActiveTab] = useState("companies");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [indiaCities, setIndiaCities] = useState(INDIA_CITY_FALLBACK);
  const [locationLoading, setLocationLoading] = useState(false);
  const [previewCompany, setPreviewCompany] = useState(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState("");
  const [usersCompany, setUsersCompany] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [companyRoles, setCompanyRoles] = useState([]);
  const [companyEmployees, setCompanyEmployees] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userNotice, setUserNotice] = useState("");
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    employeeId: "",
    roleId: "",
    status: "Active",
  });
  const [editingUserId, setEditingUserId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const loadIndianCities = async () => {
      setLocationLoading(true);
      try {
        const response = await fetch(INDIA_CITY_DATA_URL);
        if (!response.ok) throw new Error("Unable to load Indian city list");
        const rows = await response.json();
        if (!cancelled && Array.isArray(rows)) {
          setIndiaCities(buildCityMap(rows));
        }
      } catch {
        // Keep the built-in fallback list so the company form remains usable.
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    };
    loadIndianCities();
    return () => { cancelled = true; };
  }, []);

  const cityOptions = useMemo(() => {
    const stateCities = indiaCities[form.state] || [];
    const currentCity = String(form.city || "").trim();
    return currentCity && !stateCities.includes(currentCity)
      ? [currentCity, ...stateCities].sort((a, b) => a.localeCompare(b))
      : stateCities;
  }, [indiaCities, form.state, form.city]);

  const handleStateChange = (stateName) => {
    setForm((previous) => ({
      ...previous,
      state: stateName,
      city: "",
      country: "India",
      currency: "INR",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      dateFormat: "DD/MM/YYYY",
      financialYear: "APR-MAR",
    }));
  };

  const loadData = async () => {
    setLoading(true); setNotice("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your HRSYNC session has expired. Please login again.");

      const { data: platformUser, error: platformError } = await supabase
        .from("platform_users").select("id, user_id, is_super_admin, status")
        .eq("user_id", user.id).maybeSingle();
      if (platformError) throw platformError;
      if (!platformUser?.is_super_admin || String(platformUser.status || "").toLowerCase() !== "active") {
        setAuthorized(false); throw new Error("You are not authorized to access HRSYNC Platform Administration.");
      }
      setAuthorized(true);

      const [{ data: modules, error: modulesError }, { data: organizations, error: orgError }] = await Promise.all([
        supabase.from("platform_modules").select("id, module_code, module_name, description, display_order, is_active").eq("is_active", true).order("display_order", { ascending: true }),
        supabase.from("organizations").select("id, name, legal_name, code, email, phone, address, city, state, pincode, country, logo_url, settings, currency_code, currency_symbol, timezone, date_format, financial_year_start_month, status, subscription_status, created_at, updated_at").order("created_at", { ascending: false }),
      ]);
      if (modulesError) throw modulesError;
      if (orgError) throw orgError;

      const orgIds = (organizations || []).map((o) => o.id);
      let moduleLinks = [];
      if (orgIds.length) {
        const { data, error } = await supabase
          .from("organization_modules")
          .select("organization_id, module_id")
          .in("organization_id", orgIds);
        if (error) throw error;
        moduleLinks = (data || []).map((link) => {
          const module = (modules || []).find((item) => item.id === link.module_id);
          return { ...link, module_code: module?.module_code || null };
        });
      }

      const mappedCompanies = (organizations || []).map((org) => companyFromDb(org, moduleLinks.filter((m) => m.organization_id === org.id)));
      setState({ companies: mappedCompanies, modules: moduleFallback(modules) });
    } catch (err) {
      setAuthorized(false);
      setNotice(err?.message || "Unable to load platform data.");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const activeCompanies = state.companies.filter((item) => item.status === "ACTIVE").length;
  const payrollCompanies = state.companies.filter((item) => item.enabledModules.includes("payroll")).length;
  const employeeCompanies = state.companies.filter((item) => item.enabledModules.includes("employees")).length;

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return state.companies.filter((company) => {
      if (!showInactive && company.status !== "ACTIVE") return false;
      if (!query) return true;
      return [company.code, company.name, company.legalName, company.country, company.adminName, company.adminEmail]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [state.companies, search, showInactive]);

  const invokeCompanyUsers = async (body) => {
    const { data, error } = await supabase.functions.invoke("platform-company-users", { body });
    if (error) {
      let message = error.message || "Unable to complete company user request.";
      try {
        if (error.context) {
          const payload = await error.context.json();
          message = payload?.error || payload?.message || message;
        }
      } catch {}
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.error || "Unable to complete company user request.");
    return data;
  };

  const resetUserForm = (roles = []) => {
    setEditingUserId(null);
    setUserForm({
      fullName: "",
      email: "",
      password: "",
      employeeId: "",
      roleId: roles.find((role) => role.role_code === "COMPANY_ADMIN")?.id || roles[0]?.id || "",
      status: "Active",
    });
  };

  const openCompanyUsers = async (company) => {
    setUsersCompany(company);
    setUsersLoading(true);
    setUserNotice("");
    try {
      const result = await invokeCompanyUsers({ action: "list", organizationId: company.id });
      setCompanyUsers(result.users || []);
      setCompanyRoles(result.roles || []);
      setCompanyEmployees(result.employees || []);
      resetUserForm(result.roles || []);
    } catch (err) {
      setCompanyUsers([]);
      setCompanyRoles([]);
      setCompanyEmployees([]);
      setUserNotice(err?.message || "Unable to load company users.");
    } finally {
      setUsersLoading(false);
    }
  };

  const closeCompanyUsers = () => {
    setUsersCompany(null);
    setCompanyUsers([]);
    setCompanyRoles([]);
    setCompanyEmployees([]);
    setUserNotice("");
    setEditingUserId(null);
  };

  const startEditCompanyUser = (item) => {
    setEditingUserId(item.id);
    setUserForm({
      fullName: item.fullName || item.employee?.employee_name || "",
      email: item.email || item.employee?.email || item.employee?.personal_email || "",
      password: "",
      employeeId: item.employee_id || "",
      roleId: item.role?.id || companyRoles[0]?.id || "",
      status: item.status || "Active",
    });
    setUserNotice("Editing this company user. Leave password blank to keep the current password.");
  };

  const saveCompanyUser = async (event) => {
    event.preventDefault();
    if (!usersCompany) return;
    const fullName = userForm.fullName.trim();
    const email = userForm.email.trim().toLowerCase();
    if (!fullName) return setUserNotice("Full Name is required.");
    if (!email) return setUserNotice("Email is required.");
    if (!userForm.roleId) return setUserNotice("Please select a company role.");
    if (!editingUserId && userForm.password.length < 8) return setUserNotice("Password must be at least 8 characters.");

    setUserSaving(true);
    setUserNotice("");
    try {
      const result = await invokeCompanyUsers({
        action: editingUserId ? "update" : "create",
        organizationId: usersCompany.id,
        organizationUserId: editingUserId || undefined,
        fullName,
        email,
        password: userForm.password || undefined,
        employeeId: userForm.employeeId || null,
        roleId: userForm.roleId,
        status: userForm.status,
      });
      setUserNotice(result.message || (editingUserId ? "Company user updated successfully." : "Company user created successfully."));
      const refreshed = await invokeCompanyUsers({ action: "list", organizationId: usersCompany.id });
      setCompanyUsers(refreshed.users || []);
      setCompanyRoles(refreshed.roles || []);
      setCompanyEmployees(refreshed.employees || []);
      resetUserForm(refreshed.roles || []);
    } catch (err) {
      setUserNotice(err?.message || "Unable to save company user.");
    } finally {
      setUserSaving(false);
    }
  };

  const toggleCompanyUser = async (item) => {
    try {
      setUserSaving(true);
      const nextStatus = String(item.status || "Active").toLowerCase() === "active" ? "Inactive" : "Active";
      const result = await invokeCompanyUsers({
        action: "status",
        organizationId: usersCompany.id,
        organizationUserId: item.id,
        status: nextStatus,
      });
      setUserNotice(result.message || `User ${nextStatus.toLowerCase()} successfully.`);
      const refreshed = await invokeCompanyUsers({ action: "list", organizationId: usersCompany.id });
      setCompanyUsers(refreshed.users || []);
    } catch (err) {
      setUserNotice(err?.message || "Unable to update user status.");
    } finally {
      setUserSaving(false);
    }
  };

  const openPreview = async (company) => {
    setPreviewCompany(company);
    setPreviewLogoUrl("");
    if (company?.logo) {
      const url = await resolveLogoPreview(company.logo);
      setPreviewLogoUrl(url || "");
    }
  };

  const closePreview = () => {
    setPreviewCompany(null);
    setPreviewLogoUrl("");
  };

  const extractStoragePath = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const marker = `/storage/v1/object/public/${COMPANY_ASSETS_BUCKET}/`;
    const signMarker = `/storage/v1/object/sign/${COMPANY_ASSETS_BUCKET}/`;
    if (raw.includes(marker)) return decodeURIComponent(raw.split(marker)[1].split("?")[0]);
    if (raw.includes(signMarker)) return decodeURIComponent(raw.split(signMarker)[1].split("?")[0]);
    if (/^https?:\/\//i.test(raw)) return "";
    return raw;
  };

  const resolveLogoPreview = async (value) => {
    const raw = String(value || "").trim();
    if (!raw) { setLogoPreviewUrl(""); return ""; }
    if (/^https?:\/\//i.test(raw)) { setLogoPreviewUrl(raw); return raw; }
    try {
      const { data, error } = await supabase.storage.from(COMPANY_ASSETS_BUCKET).createSignedUrl(extractStoragePath(raw), 3600);
      if (error) throw error;
      const url = data?.signedUrl || "";
      setLogoPreviewUrl(url);
      return url;
    } catch {
      setLogoPreviewUrl("");
      return "";
    }
  };

  const handleLogoFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!LOGO_MIME_TYPES.includes(file.type)) {
      setNotice("Please select a PNG, JPG, WEBP or SVG logo.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setNotice("Logo size must be 2 MB or less.");
      return;
    }
    setNotice("");
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  };

  const uploadCompanyLogo = async (organizationId, file) => {
    if (!file) return "";
    const extension = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${organizationId}/logo/company-logo-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from(COMPANY_ASSETS_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) throw error;
    return path;
  };

  const removeStoredLogo = async (value) => {
    const path = extractStoragePath(value);
    if (!path || /^https?:\/\//i.test(path)) return;
    const { error } = await supabase.storage.from(COMPANY_ASSETS_BUCKET).remove([path]);
    if (error) throw error;
  };

  const handleRemoveLogo = async () => {
    if (logoUploading) return;
    setNotice("");
    try {
      setLogoUploading(true);
      if (form.logo) await removeStoredLogo(form.logo);
      setLogoFile(null);
      setLogoPreviewUrl("");
      updateForm("logo", "");
      if (editingId) {
        const { error } = await supabase.from("organizations").update({ logo_url: null, updated_at: new Date().toISOString() }).eq("id", editingId);
        if (error) throw error;
        await loadData();
        setNotice("Company logo removed successfully.");
      }
    } catch (error) {
      setNotice(error?.message || "Unable to remove company logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleViewLogo = async () => {
    if (!form.logo && !logoFile) return;
    if (logoFile && logoPreviewUrl) { window.open(logoPreviewUrl, "_blank", "noopener,noreferrer"); return; }
    const raw = String(form.logo || "").trim();
    if (/^https?:\/\//i.test(raw)) { window.open(raw, "_blank", "noopener,noreferrer"); return; }
    try {
      const { data, error } = await supabase.storage.from(COMPANY_ASSETS_BUCKET).createSignedUrl(extractStoragePath(raw), 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setNotice(error?.message || "Unable to open company logo.");
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...initialForm,
      enabledModules: [],
    });
    setNotice("");
    setLogoFile(null);
    setLogoPreviewUrl("");
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (company) => {
    const selectedState = normalizeIndianState(company?.state || "");
    const selectedCity = String(company?.city || "").trim();

    setEditingId(company.id);
    setForm({
      ...initialForm,
      ...company,
      country: "India",
      state: selectedState,
      city: selectedCity,
      email: company?.email || "",
      adminEmail: company?.adminEmail || company?.email || "",
      enabledModules: Array.from(new Set(
        Array.isArray(company?.enabledModules) ? company.enabledModules : []
      )),
    });
    setNotice("");
    setLogoFile(null);
    setLogoPreviewUrl("");
    resolveLogoPreview(company?.logo || "");
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(initialForm);
    setLogoFile(null);
    setLogoPreviewUrl("");
    setNotice("");
    setFormOpen(false);
  };
  const updateForm = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const toggleModule = (moduleId) => setForm((previous) => {
    const current = new Set(previous.enabledModules || []);
    if (current.has(moduleId)) current.delete(moduleId);
    else current.add(moduleId);
    return { ...previous, enabledModules: Array.from(current) };
  });

  const selectAllModules = () => setForm((previous) => ({
    ...previous,
    enabledModules: state.modules.map((module) => module.id),
  }));

  const clearAllModules = () => setForm((previous) => ({
    ...previous,
    enabledModules: [],
  }));

  const saveModuleLinks = async (organizationId, enabledModules) => {
    const finalEnabledModules = Array.from(new Set(
      Array.isArray(enabledModules) ? enabledModules : []
    ));

    const { error: deleteError } = await supabase
      .from("organization_modules")
      .delete()
      .eq("organization_id", organizationId);
    if (deleteError) throw deleteError;

    if (!finalEnabledModules.length) return;

    const moduleRows = state.modules
      .filter((module) => finalEnabledModules.includes(module.id))
      .filter((module) => module.dbId)
      .map((module) => ({
        organization_id: organizationId,
        module_id: module.dbId,
      }));

    if (!moduleRows.length) return;

    const { error } = await supabase
      .from("organization_modules")
      .insert(moduleRows);
    if (error) throw error;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setNotice("");
    if (!form.name.trim()) return setNotice("Company name is required.");
    if (!form.state.trim()) return setNotice("State / UT is required.");
    if (!form.city.trim()) return setNotice("City is required.");
    if (!form.adminEmail.trim()) return setNotice("Company admin email is required.");
    setSaving(true);
    setLogoUploading(Boolean(logoFile));
    const wasEditing = Boolean(editingId);
    const previousLogo = wasEditing ? state.companies.find((company) => company.id === editingId)?.logo || "" : "";
    try {
      const financialYearStartMonth = form.financialYear === "APR-MAR" ? 4 : form.financialYear === "JUL-JUN" ? 7 : form.financialYear === "OCT-SEP" ? 10 : 1;
      const settings = {
        financialYear: form.financialYear,
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        subscriptionPlan: form.subscriptionPlan || "Trial",
      };

      let organizationId = editingId;
      let uploadedLogoPath = form.logo.trim() || "";

      if (wasEditing) {
        const { error } = await supabase.from("organizations").update({
          name: form.name.trim(), legal_name: form.legalName.trim() || form.name.trim(),
          code: form.code.trim() || makeCompanyCode(form.name, state.companies),
          email: form.email.trim() || form.adminEmail.trim(), phone: form.phone.trim(), address: form.address.trim(),
          city: form.city.trim(), state: form.state.trim(), pincode: form.pincode.trim(), country: "India",
          logo_url: uploadedLogoPath || null, settings, currency_code: form.currency.trim().toUpperCase(), currency_symbol: form.currencySymbol.trim(),
          timezone: form.timezone.trim() || "UTC", date_format: form.dateFormat, financial_year_start_month: financialYearStartMonth,
          status: dbStatus(form.status), subscription_status: form.subscriptionStatus || "Trial", updated_at: new Date().toISOString(),
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const code = makeCompanyCode(form.name, state.companies);
        const { data, error } = await supabase.from("organizations").insert({
          code, name: form.name.trim(), legal_name: form.legalName.trim() || form.name.trim(),
          email: form.email.trim() || form.adminEmail.trim(), phone: form.phone.trim(), address: form.address.trim(),
          city: form.city.trim(), state: form.state.trim(), pincode: form.pincode.trim(), country: "India",
          logo_url: null, settings, currency_code: form.currency.trim().toUpperCase(), currency_symbol: form.currencySymbol.trim(),
          timezone: form.timezone.trim() || "UTC", date_format: form.dateFormat, financial_year_start_month: financialYearStartMonth,
          status: dbStatus(form.status), subscription_status: form.subscriptionStatus || "Trial",
        }).select("id").single();
        if (error) throw error;
        organizationId = data.id;
      }

      if (logoFile) {
        uploadedLogoPath = await uploadCompanyLogo(organizationId, logoFile);
        const { error: logoUpdateError } = await supabase.from("organizations").update({ logo_url: uploadedLogoPath, updated_at: new Date().toISOString() }).eq("id", organizationId);
        if (logoUpdateError) throw logoUpdateError;
        if (wasEditing && previousLogo && extractStoragePath(previousLogo) !== uploadedLogoPath) {
          try { await removeStoredLogo(previousLogo); } catch { /* Keep the new logo even if old-object cleanup is blocked. */ }
        }
      }

      await saveModuleLinks(organizationId, form.enabledModules);
      setEditingId(null);
      setForm(initialForm);
      setLogoFile(null);
      setLogoPreviewUrl("");
      setFormOpen(false);
      const successMessage = wasEditing ? "Company details updated successfully." : "Company created successfully.";
      try { await loadData(); } catch { /* Keep the successful save state visible. */ }
      setNotice(successMessage);
    } catch (err) {
      setNotice(err?.message || "Unable to save company.");
    } finally {
      setLogoUploading(false);
      setSaving(false);
    }
  };

  const toggleCompanyStatus = async (company) => {
    setNotice("");
    try {
      const next = company.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const { error } = await supabase.from("organizations").update({ status: dbStatus(next), updated_at: new Date().toISOString() }).eq("id", company.id);
      if (error) throw error;
      await loadData(); setNotice(`Company ${next === "ACTIVE" ? "activated" : "deactivated"} successfully.`);
    } catch (err) { setNotice(err?.message || "Unable to update company status."); }
  };

  const deleteCompany = async (company) => {
    const confirmed = window.confirm(`Delete "${company.name}" from the HRSYNC platform?\n\nThis will permanently delete the company record and related tenant records protected by database foreign keys.`);
    if (!confirmed) return;
    setNotice(""); setSaving(true);
    try {
      const { error } = await supabase.from("organizations").delete().eq("id", company.id);
      if (error) throw error;
      await loadData(); setNotice("Company deleted successfully.");
    } catch (err) { setNotice(err?.message || "Unable to delete company."); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <PlatformFrame currentUser={currentUser} onLogout={onLogout}>
        <main className="sa-page">
          <section className="sa-panel">
            <div className="sa-panel-head">
              <div>
                <span className="sa-section-kicker">HRSYNC PLATFORM ADMIN</span>
                <h2>Loading Platform Administration…</h2>
                <p>Connecting to the HRSYNC platform database.</p>
              </div>
            </div>
          </section>
        </main>
      </PlatformFrame>
    );
  }

  if (!authorized) {
    return (
      <PlatformFrame currentUser={currentUser} onLogout={onLogout}>
        <main className="sa-page">
          <section className="sa-panel">
            <div className="sa-panel-head">
              <div>
                <span className="sa-section-kicker">ACCESS CHECK</span>
                <h2>Platform access unavailable</h2>
                <p>{notice || "Your account is not authorized for Platform Administration."}</p>
              </div>
            </div>
            <div className="sa-form-actions">
              <button type="button" className="sa-btn sa-btn-primary" onClick={loadData}>
                Retry
              </button>
            </div>
          </section>
        </main>
      </PlatformFrame>
    );
  }

  return (
    <PlatformFrame currentUser={currentUser} onLogout={onLogout}>
      <main className="sa-page">
      <header className="sa-hero">
        <div className="sa-hero-copy">
          <span className="sa-eyebrow">HRSYNC PLATFORM ADMIN</span>
          <div className="sa-welcome">Welcome back,</div>
          <h1>Platform Administration</h1>
          <p>Manage companies, tenant configuration and platform-level access from one control centre.</p>
        </div>

        <div className="sa-hero-art" aria-hidden="true">
          <span>People</span>
          <span>Process</span>
          <span>Progress</span>
          <i />
        </div>

        <div className="sa-header-actions">
          <button type="button" className="sa-btn sa-btn-secondary" onClick={loadData} disabled={loading}>
            <span className="sa-btn-icon">↻</span> Refresh
          </button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={openCreate}>
            <span className="sa-btn-plus">+</span> Add Company
          </button>
        </div>
      </header>

      <section className="sa-stat-grid">
        <article className="sa-stat-card">
          <div className="sa-stat-icon purple">{navIcon("building")}</div>
          <div><span>Total Companies</span><strong>{state.companies.length}</strong><small>Total tenants registered</small></div>
        </article>
        <article className="sa-stat-card">
          <div className="sa-stat-icon green">{navIcon("grid")}</div>
          <div><span>Active Companies</span><strong>{activeCompanies}</strong><small>Currently enabled tenants</small></div>
        </article>
        <article className="sa-stat-card">
          <div className="sa-stat-icon blue">{navIcon("layers")}</div>
          <div><span>Payroll Enabled</span><strong>{payrollCompanies}</strong><small>Companies with Payroll access</small></div>
        </article>
        <article className="sa-stat-card">
          <div className="sa-stat-icon orange">{navIcon("building")}</div>
          <div><span>Employee Management</span><strong>{employeeCompanies}</strong><small>Companies with Employee access</small></div>
        </article>
      </section>

      <nav className="sa-tabs" aria-label="Platform sections"><button className={activeTab === "companies" ? "active" : ""} onClick={() => setActiveTab("companies")}>Companies</button><button className={activeTab === "modules" ? "active" : ""} onClick={() => setActiveTab("modules")}>Platform Modules</button><button className={activeTab === "access" ? "active" : ""} onClick={() => setActiveTab("access")}>Access Model</button></nav>

      {activeTab === "companies" && <section className="sa-panel sa-company-panel">
        <div className="sa-panel-head"><div><span className="sa-section-kicker">TENANT REGISTRY</span><h2>{editingId ? "Edit Company" : "Companies"}</h2><p>Each company is an independent HRSYNC tenant with its own users, organization masters, payroll and branding.</p></div><div className="sa-head-meta"><span className="sa-count">{filteredCompanies.length} records</span><label className="sa-switch-label"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /><span>Show inactive</span></label></div></div>
        <div className="sa-toolbar"><label className="sa-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, code, country or admin..." /></label><button type="button" className="sa-btn sa-btn-secondary" onClick={openCreate}>+ New Company</button></div>

        {formOpen && <form className="sa-form" onSubmit={handleSave}>
          <div className="sa-form-head"><div><span className="sa-section-kicker">COMPANY CONFIGURATION</span><h3>{editingId ? "Edit Company" : "Create Company"}</h3></div><button type="button" className="sa-icon-close" onClick={closeForm} aria-label="Close">×</button></div>
          {notice && <div className="sa-alert">{notice}</div>}
          <div className="sa-form-section">
            <div className="sa-section-title"><div><h4>Company Profile</h4><p>India-only company address master. State and city lists are sorted A–Z and city options follow the selected state.</p></div></div>
            <div className="sa-form-grid">
              <label><span>Company Name <b>*</b></span><input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="e.g. Global Engineering Ltd." /></label>
              <label><span>Legal Name</span><input value={form.legalName} onChange={(e) => updateForm("legalName", e.target.value)} placeholder="Registered legal entity name" /></label>
              <label><span>Company Code</span><input value={form.code} onChange={(e) => updateForm("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="e.g. GLE01" /></label>
              <label><span>Company Email</span><input type="email" value={form.email || form.adminEmail} onChange={(e) => updateForm("email", e.target.value)} placeholder="contact@company.com" /></label>
              <label><span>Phone</span><input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} placeholder="Company contact number" /></label>
              <label><span>Country <b>*</b></span><select value="India" disabled><option value="India">India</option></select></label>
              <label className="sa-span-2"><span>Address</span><input value={form.address} onChange={(e) => updateForm("address", e.target.value)} placeholder="Registered / operating address" /></label>
              <label><span>State <b>*</b></span><select value={form.state} onChange={(e) => handleStateChange(e.target.value)}><option value="">Select state / UT</option>{INDIA_STATES.map((stateName) => <option key={stateName} value={stateName}>{stateName}</option>)}</select></label>
              <label><span>City <b>*</b></span><select value={form.city} onChange={(e) => updateForm("city", e.target.value)} disabled={!form.state || locationLoading}><option value="">{!form.state ? "Select state first" : locationLoading ? "Loading cities..." : "Select city"}</option>{cityOptions.map((cityName) => <option key={cityName} value={cityName}>{cityName}</option>)}</select></label>
              <label><span>Postal Code</span><input value={form.pincode} onChange={(e) => updateForm("pincode", e.target.value.replace(/[^0-9A-Za-z -]/g, ""))} placeholder="Postal code" /></label>
              <div className="sa-logo-upload-field">
                <div className="sa-logo-upload-label"><span>Company Logo</span><small>PNG, JPG, WEBP or SVG · Max 2 MB</small></div>
                <div className="sa-logo-upload-box">
                  <div className="sa-logo-preview">
                    {logoPreviewUrl ? <img src={logoPreviewUrl} alt="Company logo preview" /> : <div className="sa-logo-preview-empty"><strong>LOGO</strong><span>No logo selected</span></div>}
                  </div>
                  <div className="sa-logo-upload-content">
                    <div className="sa-logo-upload-copy"><strong>{logoFile ? logoFile.name : form.logo ? "Company logo selected" : "Add your company logo"}</strong><span>{logoFile ? "Ready to upload when you save the company." : form.logo ? "Stored securely in company assets." : "Use your company branding across HRSYNC."}</span></div>
                    <div className="sa-logo-upload-actions">
                      <input ref={logoInputRef} className="sa-logo-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoFileChange} />
                      <button type="button" className="sa-logo-choose" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>{form.logo || logoFile ? "Replace Logo" : "Choose Logo"}</button>
                      {(form.logo || logoFile) && <button type="button" className="sa-logo-view" onClick={handleViewLogo} disabled={logoUploading}>View</button>}
                      {(form.logo || logoFile) && <button type="button" className="sa-logo-remove" onClick={handleRemoveLogo} disabled={logoUploading}>{logoUploading ? "Working…" : "Remove"}</button>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="sa-form-section">
            <div className="sa-section-title"><div><h4>Regional &amp; Subscription Configuration</h4><p>These settings control the tenant's regional presentation and lifecycle.</p></div></div>
            <div className="sa-form-grid">
              <label><span>Currency</span><input value={form.currency} onChange={(e) => updateForm("currency", e.target.value.toUpperCase())} /></label>
              <label><span>Currency Symbol</span><input value={form.currencySymbol} onChange={(e) => updateForm("currencySymbol", e.target.value)} /></label>
              <label><span>Time Zone</span><input value={form.timezone} onChange={(e) => updateForm("timezone", e.target.value)} /></label>
              <label><span>Date Format</span><select value={form.dateFormat} onChange={(e) => updateForm("dateFormat", e.target.value)}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label>
              <label><span>Financial Year</span><select value={form.financialYear} onChange={(e) => updateForm("financialYear", e.target.value)}><option>JAN-DEC</option><option>APR-MAR</option><option>JUL-JUN</option><option>OCT-SEP</option></select></label>
              <label><span>Subscription Plan</span><select value={form.subscriptionPlan} onChange={(e) => updateForm("subscriptionPlan", e.target.value)}><option>Trial</option><option>Starter</option><option>Professional</option><option>Enterprise</option></select></label>
              <label><span>Subscription Status</span><select value={form.subscriptionStatus} onChange={(e) => updateForm("subscriptionStatus", e.target.value)}><option>Trial</option><option>Active</option><option>Suspended</option><option>Expired</option></select></label>
              <label><span>Company Status</span><select value={form.status} onChange={(e) => updateForm("status", e.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
            </div>
          </div>

          <div className="sa-form-section">
            <div className="sa-section-title"><div><h4>Company Administrator</h4><p>Store the primary administrator details. Account invitation will be handled through secure authentication services.</p></div></div>
            <div className="sa-form-grid">
              <label><span>Admin Name</span><input value={form.adminName} onChange={(e) => updateForm("adminName", e.target.value)} placeholder="Primary company administrator" /></label>
              <label><span>Admin Email <b>*</b></span><input type="email" value={form.adminEmail} onChange={(e) => updateForm("adminEmail", e.target.value)} placeholder="admin@company.com" /></label>
            </div>
          </div>
          <div className="sa-module-section">
            <div className="sa-module-access-head">
              <div className="sa-section-title sa-module-section-head">
                <div>
                  <h4>Company Module Access</h4>
                  <p>All modules are optional. Select only the modules this company should have access to.</p>
                </div>
              </div>
              <div className="sa-module-toolbar">
                <span className="sa-module-count-text">{form.enabledModules.length} of {state.modules.length} enabled</span>
                <button type="button" className="sa-module-select-btn" onClick={selectAllModules}>Select All</button>
                <button type="button" className="sa-module-select-btn secondary" onClick={clearAllModules}>Clear All</button>
              </div>
            </div>
            <div className="sa-module-grid">
              {state.modules.map((module) => {
                const checked = form.enabledModules.includes(module.id);
                return (
                  <label key={module.id} className={`sa-module-card ${checked ? "selected" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleModule(module.id)} />
                    <span className="sa-module-check">✓</span>
                    <span className="sa-module-copy">
                      <strong>{module.name}</strong>
                      <small>{module.description}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="sa-form-actions"><button type="button" className="sa-btn sa-btn-secondary" onClick={closeForm}>Cancel</button><button type="submit" className="sa-btn sa-btn-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Update Company" : "Create Company"}</button></div>
        </form>}

        {!formOpen && notice && <div className="sa-alert">{notice}</div>}
        <div className="sa-table-wrap"><table className="sa-table"><thead><tr><th>Company</th><th>Country</th><th>Admin</th><th>Modules</th><th>Status</th><th className="sa-action-col">Action</th></tr></thead><tbody>
          {filteredCompanies.map((company) => <tr key={company.id}><td><div className="sa-company-cell"><div className="sa-company-avatar">{String(company.name || "?").slice(0,1).toUpperCase()}</div><div><strong>{company.name}</strong><small>{company.code} · {company.legalName}</small></div></div></td><td><span className="sa-primary-text">{company.country}</span><small className="sa-cell-sub">{company.currency} {company.currencySymbol}</small></td><td><span className="sa-primary-text">{company.adminName || "—"}</span><small className="sa-cell-sub">{company.adminEmail || "—"}</small></td><td><span className="sa-module-count">{company.enabledModules?.length || 0} enabled</span></td><td><span className={`sa-status ${company.status === "ACTIVE" ? "active" : "inactive"}`}>{company.status === "ACTIVE" ? "Active" : "Inactive"}</span></td><td><div className="sa-row-actions">
            <button type="button" className="sa-icon-action sa-preview-action" onClick={() => openPreview(company)} title="Preview company" aria-label={`Preview ${company.name || "company"}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>
            </button>
            <button type="button" className="sa-users-action" onClick={() => openCompanyUsers(company)}>Users</button>
            <button type="button" onClick={() => openEdit(company)}>Edit</button>
            <button type="button" onClick={() => toggleCompanyStatus(company)}>{company.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
            <button type="button" className="danger" onClick={() => deleteCompany(company)}>Delete</button>
          </div></td></tr>)}
          {!filteredCompanies.length && <tr><td colSpan="6" className="sa-empty">
  <div className="sa-empty-state">
    <div className="sa-empty-illustration" aria-hidden="true">
      <svg viewBox="0 0 100 70" fill="none">
        <path d="M12 56h76" stroke="currentColor" strokeWidth="2"/>
        <rect x="31" y="22" width="38" height="34" rx="3" fill="currentColor" opacity=".12"/>
        <path d="M38 56V30h24v26M44 37h4M52 37h4M44 44h4M52 44h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M20 56V42l9-7v21M71 56V39l9 6v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M18 29c3-5 8-5 11 0M72 27c4-5 9-4 11 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".55"/>
      </svg>
    </div>
    <strong>No companies found</strong>
    <span>Get started by adding your first company.</span>
    <button type="button" className="sa-empty-add" onClick={openCreate}>+ Add Company</button>
  </div>
</td></tr>}
        </tbody></table></div>
      </section>}

      {activeTab === "modules" && <section className="sa-panel"><div className="sa-panel-head"><div><span className="sa-section-kicker">FEATURE CATALOG</span><h2>Platform Modules</h2><p>These are platform-level capabilities. Company access is configured separately per tenant.</p></div></div><div className="sa-catalog-grid">{state.modules.map((module) => <article className="sa-catalog-card" key={module.id}><div className="sa-catalog-icon">{module.name.slice(0,1)}</div><div><strong>{module.name}</strong><small>{module.group}</small><p>{module.description}</p></div></article>)}</div></section>}

      {activeTab === "access" && <section className="sa-panel"><div className="sa-panel-head"><div><span className="sa-section-kicker">ACCESS ARCHITECTURE</span><h2>Platform Access Model</h2><p>HRSYNC separates platform-level access, company module access and user permissions.</p></div></div><div className="sa-access-grid"><article className="sa-access-card"><span>01</span><h3>Platform</h3><p>HRSYNC Super Admin controls tenants, platform modules, subscription state and system-level configuration.</p></article><article className="sa-access-card"><span>02</span><h3>Company</h3><p>Each tenant receives only the modules enabled for that company. Company data remains isolated by tenant ID.</p></article><article className="sa-access-card"><span>03</span><h3>User</h3><p>Company users receive roles and permissions such as View, Add, Edit, Delete, Approve, Export and Configure.</p></article><article className="sa-access-card"><span>04</span><h3>Employee</h3><p>Employee self-service is restricted to the employee's own attendance, leave, payslips, documents and profile.</p></article></div><div className="sa-permission-preview"><h3>Example permission matrix</h3><div className="sa-permission-table"><div className="head"><span>Module</span><span>View</span><span>Add</span><span>Edit</span><span>Approve</span><span>Export</span><span>Configure</span></div>{["Employees", "Attendance", "Leave", "Payroll", "Reports"].map((name) => <div className="row" key={name}><strong>{name}</strong><span>✓</span><span>✓</span><span>✓</span><span>—</span><span>✓</span><span>—</span></div>)}</div></div></section>}
    
      {usersCompany && <div className="sa-users-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCompanyUsers(); }}>
        <section className="sa-users-modal" role="dialog" aria-modal="true" aria-labelledby="company-users-title">
          <div className="sa-users-head">
            <div>
              <span className="sa-section-kicker">COMPANY ACCESS</span>
              <h3 id="company-users-title">{usersCompany.name} — Users</h3>
              <p>Create and manage company login accounts, employee links and tenant roles.</p>
            </div>
            <button type="button" className="sa-icon-close" onClick={closeCompanyUsers} aria-label="Close users">×</button>
          </div>

          <div className="sa-users-note">
            <strong>Secure account creation</strong>
            <span>New login accounts are created securely through the HRSYNC backend. The Supabase service key is never exposed in the browser.</span>
          </div>

          <div className="sa-users-layout">
            <div className="sa-users-list-wrap">
              <div className="sa-users-list-head"><h4>Company Users</h4><span>{companyUsers.length} users</span></div>
              {usersLoading ? <div className="sa-users-empty">Loading company users…</div> : companyUsers.length ? <div className="sa-users-list">
                {companyUsers.map((item) => <div className="sa-user-row" key={item.id}>
                  <div className="sa-user-row-avatar">{String(item.fullName || item.employee?.employee_name || "U").slice(0,1).toUpperCase()}</div>
                  <div className="sa-user-row-main">
                    <strong>{item.fullName || item.employee?.employee_name || "User"}</strong>
                    <small>{item.email || item.employee?.email || item.employee?.personal_email || "No email"}</small>
                    <span>{item.role?.role_name || "No role assigned"}{item.employee ? ` · ${item.employee.employee_id}` : ""}</span>
                  </div>
                  <div className="sa-user-row-actions">
                    <span className={`sa-status ${String(item.status || "").toLowerCase() === "active" ? "active" : "inactive"}`}>{item.status || "—"}</span>
                    <button type="button" onClick={() => startEditCompanyUser(item)}>Edit</button>
                    <button type="button" disabled={userSaving} onClick={() => toggleCompanyUser(item)}>{String(item.status || "").toLowerCase() === "active" ? "Deactivate" : "Activate"}</button>
                  </div>
                </div>)}
              </div> : <div className="sa-users-empty">No users have been created for this company yet.</div>}
            </div>

            <form className="sa-users-form" onSubmit={saveCompanyUser}>
              <div className="sa-users-form-head"><h4>{editingUserId ? "Edit User" : "Add Company User"}</h4><span>Tenant access</span></div>

              <label><span>Full Name <b>*</b></span><input value={userForm.fullName} onChange={(e) => setUserForm((v) => ({ ...v, fullName: e.target.value }))} placeholder="Enter full name" autoComplete="name" /></label>
              <label><span>Email Address <b>*</b></span><input type="email" value={userForm.email} onChange={(e) => setUserForm((v) => ({ ...v, email: e.target.value }))} placeholder="name@company.com" autoComplete="email" /></label>
              <label><span>{editingUserId ? "New Password" : "Temporary Password"} {!editingUserId && <b>*</b>}</span><input type="password" value={userForm.password} onChange={(e) => setUserForm((v) => ({ ...v, password: e.target.value }))} placeholder={editingUserId ? "Leave blank to keep current password" : "Minimum 8 characters"} autoComplete={editingUserId ? "new-password" : "new-password"} /></label>
              <label><span>Employee</span><select value={userForm.employeeId} onChange={(e) => setUserForm((v) => ({ ...v, employeeId: e.target.value }))}><option value="">No employee link</option>{companyEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_name} · {employee.employee_id}</option>)}</select></label>
              <label><span>Company Role <b>*</b></span><select value={userForm.roleId} onChange={(e) => setUserForm((v) => ({ ...v, roleId: e.target.value }))}><option value="">Select role</option>{companyRoles.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}</select></label>
              <label><span>Status</span><select value={userForm.status} onChange={(e) => setUserForm((v) => ({ ...v, status: e.target.value }))}><option>Active</option><option>Inactive</option></select></label>
              {userNotice && <div className="sa-users-notice">{userNotice}</div>}
              <div className="sa-form-actions">
                {editingUserId && <button type="button" className="sa-btn sa-btn-secondary" onClick={() => resetUserForm(companyRoles)}>Cancel Edit</button>}
                <button type="button" className="sa-btn sa-btn-secondary" onClick={closeCompanyUsers}>Close</button>
                <button type="submit" className="sa-btn sa-btn-primary" disabled={userSaving}>{userSaving ? "Saving…" : editingUserId ? "Update User" : "Create User"}</button>
              </div>
            </form>
          </div>
        </section>
      </div>}

      {previewCompany && <div className="sa-preview-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
        <section className="sa-preview-modal" role="dialog" aria-modal="true" aria-labelledby="company-preview-title">
          <div className="sa-preview-head">
            <div>
              <span className="sa-section-kicker">COMPANY PREVIEW</span>
              <h3 id="company-preview-title">{previewCompany.name || "Company"}</h3>
              <p>Review the company information currently stored in HRSYNC.</p>
            </div>
            <button type="button" className="sa-icon-close" onClick={closePreview} aria-label="Close preview">×</button>
          </div>
          <div className="sa-preview-body">
            <div className="sa-preview-section">
              <h4>Company Profile</h4>
              {previewLogoUrl && <div className="sa-preview-logo"><img src={previewLogoUrl} alt={`${previewCompany.name || "Company"} logo`} /></div>}
              <div className="sa-preview-grid">
                <div><span>Company Name</span><strong>{previewCompany.name || "—"}</strong></div>
                <div><span>Legal Name</span><strong>{previewCompany.legalName || "—"}</strong></div>
                <div><span>Company Code</span><strong>{previewCompany.code || "—"}</strong></div>
                <div><span>Company Email</span><strong>{previewCompany.email || "—"}</strong></div>
                <div><span>Phone</span><strong>{previewCompany.phone || "—"}</strong></div>
                <div><span>Country</span><strong>{previewCompany.country || "—"}</strong></div>
                <div><span>State / UT</span><strong>{previewCompany.state || "—"}</strong></div>
                <div><span>City</span><strong>{previewCompany.city || "—"}</strong></div>
                <div><span>Postal Code</span><strong>{previewCompany.pincode || "—"}</strong></div>
                <div className="wide"><span>Address</span><strong>{previewCompany.address || "—"}</strong></div>
              </div>
            </div>
            <div className="sa-preview-section">
              <h4>Company Settings</h4>
              <div className="sa-preview-grid">
                <div><span>Currency</span><strong>{previewCompany.currency || "—"} {previewCompany.currencySymbol || ""}</strong></div>
                <div><span>Time Zone</span><strong>{previewCompany.timezone || "—"}</strong></div>
                <div><span>Date Format</span><strong>{previewCompany.dateFormat || "—"}</strong></div>
                <div><span>Financial Year</span><strong>{previewCompany.financialYear || "—"}</strong></div>
                <div><span>Subscription Plan</span><strong>{previewCompany.subscriptionPlan || "—"}</strong></div>
                <div><span>Subscription Status</span><strong>{previewCompany.subscriptionStatus || "—"}</strong></div>
                <div><span>Company Status</span><strong>{previewCompany.status === "ACTIVE" ? "Active" : "Inactive"}</strong></div>
              </div>
            </div>
            <div className="sa-preview-section">
              <h4>Company Administrator</h4>
              <div className="sa-preview-grid">
                <div><span>Admin Name</span><strong>{previewCompany.adminName || "—"}</strong></div>
                <div><span>Admin Email</span><strong>{previewCompany.adminEmail || "—"}</strong></div>
              </div>
            </div>
            <div className="sa-preview-section">
              <div className="sa-preview-module-head"><h4>Enabled Modules</h4><span>{previewCompany.enabledModules?.length || 0} enabled</span></div>
              {previewCompany.enabledModules?.length ? <div className="sa-preview-modules">{previewCompany.enabledModules.map((moduleId) => { const module = state.modules.find((item) => item.id === moduleId); return <span key={moduleId}>{module?.name || moduleId}</span>; })}</div> : <div className="sa-preview-empty">No modules enabled.</div>}
            </div>
          </div>
          <div className="sa-preview-actions">
            <button type="button" className="sa-btn sa-btn-secondary" onClick={closePreview}>Close</button>
            <button type="button" className="sa-btn sa-btn-primary" onClick={() => { const company = previewCompany; closePreview(); openEdit(company); }}>Edit Company</button>
          </div>
        </section>
      </div>}

      <footer className="sa-brand-footer">
        <div className="sa-footer-brand-lockup">
          <img src="/HR%20SYNC%20Logo.png" alt="HRSYNC" />
          <div><strong>HRSYNC</strong><small>PEOPLE • PROCESS • PROGRESS</small></div>
        </div>
        <span className="sa-footer-divider" />
        <div className="sa-footer-message">
          <small>MORE THAN HRMS</small>
          <strong>IT’S PEOPLE <em>POTENTIAL</em></strong>
        </div>
        <div className="sa-footer-right">
          <span>Built for People</span>
          <span>Who Build the Future</span>
        </div>
      </footer>
    </main>
    </PlatformFrame>
  );
}
