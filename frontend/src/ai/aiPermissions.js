/*
 * Central AI permission guard.
 * This is a UI-side guard only. Backend authorization is mandatory in production.
 */

const ROLE_ALIASES = {
  admin: "admin",
  administrator: "admin",
  hr: "hr",
  "hr manager": "hr",
  hod: "hod",
  manager: "hod",
  head: "hod",
  employee: "employee",
  staff: "employee",
};

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return ROLE_ALIASES[value] || value || "employee";
}

const READ_PERMISSIONS = {
  admin: ["*"],
  hr: [
    "employees",
    "attendance",
    "leave",
    "payroll",
    "recruitment",
    "training",
    "pms",
    "reports",
    "vendors",
    "organization",
  ],
  hod: ["employees", "attendance", "leave", "training", "pms", "reports"],
  employee: ["self"],
};

const ACTION_PERMISSIONS = {
  admin: ["*"],
  hr: [
    "draft",
    "recommend",
    "prepare_report",
    "prepare_leave_summary",
    "prepare_payroll_audit",
    "prepare_recruitment_shortlist",
  ],
  hod: ["draft", "recommend", "prepare_leave_summary", "prepare_team_report"],
  employee: ["draft", "recommend"],
};

export function canAIRead(role, module) {
  const normalizedRole = normalizeRole(role);
  const permissions = READ_PERMISSIONS[normalizedRole] || READ_PERMISSIONS.employee;
  return permissions.includes("*") || permissions.includes(String(module).toLowerCase());
}

export function canAIPrepareAction(role, action) {
  const normalizedRole = normalizeRole(role);
  const permissions =
    ACTION_PERMISSIONS[normalizedRole] || ACTION_PERMISSIONS.employee;

  return permissions.includes("*") || permissions.includes(action);
}

export function sanitizeAIContext(value) {
  if (!value || typeof value !== "object") return value;

  const blockedKeys = new Set([
    "password",
    "passwordHash",
    "otp",
    "devOtp",
    "token",
    "activationToken",
    "sessionToken",
    "accessToken",
    "refreshToken",
    "pan",
    "aadhaar",
    "aadhar",
    "bankAccount",
    "accountNumber",
    "ifsc",
  ]);

  if (Array.isArray(value)) {
    return value.map(sanitizeAIContext);
  }

  const result = {};
  Object.entries(value).forEach(([key, val]) => {
    if (!blockedKeys.has(key.toLowerCase())) {
      result[key] = val && typeof val === "object"
        ? sanitizeAIContext(val)
        : val;
    }
  });

  return result;
}
