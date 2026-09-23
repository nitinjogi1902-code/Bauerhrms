import { supabase } from "./supabaseClient";

const ACCOUNT_KEY = "bauerHrmsUserAccounts";
const OTP_KEY = "hrms_login_otp";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_MS = 30 * 1000; // 30 seconds
const MAX_OTP_ATTEMPTS = 5;

const readAccounts = () => {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const writeAccounts = (accounts) => {
  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify(accounts)
  );
};

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();


// ======================================================
// PASSWORD HASH
// ======================================================

const hashPassword = async (password) => {
  const data = new TextEncoder().encode(
    password || ""
  );

  const digest = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((b) =>
      b.toString(16).padStart(2, "0")
    )
    .join("");
};


// ======================================================
// OTP HELPERS
// ======================================================

const generateOtp = () => {
  return String(
    Math.floor(
      100000 +
        Math.random() * 900000
    )
  );
};


const maskMobile = (mobile) => {
  const digits = String(
    mobile || ""
  ).replace(/\D/g, "");

  if (digits.length < 4) {
    return "your registered mobile";
  }

  return (
    "*".repeat(
      Math.max(0, digits.length - 4)
    ) +
    digits.slice(-4)
  );
};


const readOtpState = () => {
  try {
    const raw =
      sessionStorage.getItem(OTP_KEY);

    const parsed = raw
      ? JSON.parse(raw)
      : null;

    return parsed &&
      typeof parsed === "object"
      ? parsed
      : null;
  } catch {
    return null;
  }
};


const saveOtpState = (state) => {
  sessionStorage.setItem(
    OTP_KEY,
    JSON.stringify(state)
  );
};


const clearOtpState = () => {
  sessionStorage.removeItem(
    OTP_KEY
  );
};


// ======================================================
// SUPABASE EMPLOYEE ACCOUNT HELPERS
// ======================================================

const EMPLOYEE_ACCOUNT_FUNCTION = "hrsync-employee-account";

const callEmployeeAccountFunction = async (body) => {
  const { data, error } = await supabase.functions.invoke(
    EMPLOYEE_ACCOUNT_FUNCTION,
    { body }
  );

  if (error) {
    throw new Error(
      error.message || "Employee account service failed."
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error || "Employee account service failed."
    );
  }

  return data;
};

// ======================================================
// GET EMPLOYEE ACCOUNT
// ======================================================

export const getEmployeeAccount = async (
  employeeInternalId
) => {
  if (!employeeInternalId) return null;

  return callEmployeeAccountFunction({
    action: "status",
    employeeId: String(employeeInternalId),
  });
};

// ======================================================
// CREATE / SEND EMPLOYEE INVITATION
// ======================================================

export const createEmployeeInvitation = async (
  employee
) => {
  const id = String(employee?.id || "").trim();

  if (!id) {
    throw new Error(
      "Employee internal ID is missing."
    );
  }

  const email = normalize(
    employee?.officialEmail ||
      employee?.email
  );

  if (!email) {
    throw new Error(
      "Official Email is required before sending login credentials."
    );
  }

  // Resolve the employee's organization from the employee record.
  // Do not hard-code an organization ID; HRSYNC is multi-tenant.
  let organizationId = String(
    employee?.organizationId ||
      employee?.organization_id ||
      ""
  ).trim();

  if (!organizationId) {
    const { data: employeeRecord, error: employeeLookupError } =
      await supabase
        .from("employees")
        .select("organization_id")
        .eq("id", id)
        .maybeSingle();

    if (employeeLookupError) {
      throw new Error(
        employeeLookupError.message ||
          "Unable to determine the employee organization."
      );
    }

    organizationId = String(
      employeeRecord?.organization_id || ""
    ).trim();
  }

  if (!organizationId) {
    throw new Error(
      "Organization ID is missing for this employee."
    );
  }

  return callEmployeeAccountFunction({
    action: "invite",
    employeeId: id,
    organizationId,
    redirectOrigin: window.location.origin,
  });
};

// ======================================================
// RESEND EMPLOYEE ACTIVATION EMAIL
// ======================================================

export const resendEmployeeInvitation = async (employee) => {
  const id = String(employee?.id || "").trim();

  if (!id) {
    throw new Error("Employee internal ID is missing.");
  }

  const email = normalize(
    employee?.officialEmail ||
      employee?.email
  );

  if (!email) {
    throw new Error(
      "Official Email is required before resending login credentials."
    );
  }

  let organizationId = String(
    employee?.organizationId ||
      employee?.organization_id ||
      ""
  ).trim();

  if (!organizationId) {
    const {
      data: employeeRecord,
      error: employeeLookupError,
    } = await supabase
      .from("employees")
      .select("organization_id")
      .eq("id", id)
      .maybeSingle();

    if (employeeLookupError) {
      throw new Error(
        employeeLookupError.message ||
          "Unable to determine the employee organization."
      );
    }

    organizationId = String(
      employeeRecord?.organization_id || ""
    ).trim();
  }

  if (!organizationId) {
    throw new Error(
      "Organization ID is missing for this employee."
    );
  }

  return callEmployeeAccountFunction({
    action: "resend",
    employeeId: id,
    organizationId,
  });
};


// ======================================================
// ACTIVATE EMPLOYEE ACCOUNT
// ======================================================

export const activateEmployeeAccount = async (
  token,
  password
) => {
  if (!password || password.length < 8) {
    throw new Error(
      "Password must be at least 8 characters."
    );
  }

  /*
   * New HRSYNC flow:
   * Supabase Auth creates the invitation session after the
   * employee opens the invitation email. The browser then
   * creates the password and activates organization_users.
   */
  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!sessionError && sessionData?.session?.user) {
    const authUser = sessionData.session.user;
    const employeeId =
      authUser.user_metadata?.employee_internal_id ||
      authUser.user_metadata?.employeeId ||
      authUser.user_metadata?.employee_id ||
      "";

    if (!employeeId && !token) {
      throw new Error(
        "The employee invitation is missing its employee reference."
      );
    }

    const { error: passwordError } =
      await supabase.auth.updateUser({
        password,
      });

    if (passwordError) {
      throw passwordError;
    }

    const resolvedEmployeeId = String(
      employeeId || token || ""
    ).trim();

    if (!resolvedEmployeeId) {
      throw new Error(
        "The employee invitation is missing its employee reference."
      );
    }

    // Resolve organization from the authenticated user's metadata first.
    // Fall back to the employee record so the Edge Function always receives
    // the organization context required by the multi-tenant account flow.
    let organizationId = String(
      authUser.user_metadata?.organization_id ||
        authUser.user_metadata?.organizationId ||
        ""
    ).trim();

    if (!organizationId) {
      const { data: employeeRecord, error: employeeLookupError } =
        await supabase
          .from("employees")
          .select("organization_id")
          .eq("id", resolvedEmployeeId)
          .maybeSingle();

      if (employeeLookupError) {
        throw new Error(
          employeeLookupError.message ||
            "Unable to determine the employee organization."
        );
      }

      organizationId = String(
        employeeRecord?.organization_id || ""
      ).trim();
    }

    if (!organizationId) {
      throw new Error(
        "Organization ID is missing for this employee."
      );
    }

    const activation = await callEmployeeAccountFunction({
      action: "activate",
      employeeId: resolvedEmployeeId,
      organizationId,
    });

    const email =
      authUser.email || "";

    await supabase.auth.signOut();

    return {
      email,
      status: activation.status || "Active",
    };
  }

  /*
   * Backward compatibility for old local activation links.
   * This path is retained only so existing legacy accounts do
   * not break immediately while the tenant accounts migrate.
   */
  const accounts = readAccounts();

  const entry = Object.values(
    accounts
  ).find(
    (account) =>
      account?.activationToken === token
  );

  if (!entry) {
    throw new Error(
      "This activation link is invalid or has expired."
    );
  }

  const passwordHash =
    await hashPassword(password);

  const id = String(
    entry.employeeInternalId
  );

  accounts[id] = {
    ...entry,
    passwordHash,
    status: "active",
    activationToken: "",
    activatedAt:
      new Date().toISOString(),
  };

  writeAccounts(accounts);

  return accounts[id];
};

// ======================================================
// AUTHENTICATE EMPLOYEE
//
// Supabase Auth is the primary authentication mechanism.
// The localStorage path remains only for legacy accounts.
// ======================================================

export const authenticateEmployee = async (
  email,
  password
) => {
  const wanted = normalize(email);

  /*
   * Legacy localStorage authentication only.
   *
   * New HRSYNC company users authenticate through the
   * Supabase Auth flow implemented in Login.jsx.
   */
  const accounts = readAccounts();

  const entry = Object.values(
    accounts
  ).find(
    (account) =>
      normalize(account?.email) ===
      wanted
  );

  if (!entry) return null;

  if (
    entry.status !== "active" ||
    !entry.passwordHash
  ) {
    return {
      inactive: true,
    };
  }

  const hash =
    await hashPassword(
      password || ""
    );

  if (hash !== entry.passwordHash) {
    return null;
  }

  return {
    otpRequired: false,
    employee: {
      id: entry.employeeInternalId,
      employeeId: entry.employeeId,
      name: entry.employeeName,
      email: entry.email,
      role: "Employee",
    },
  };
};

// ======================================================
// REQUEST LOGIN OTP
// ======================================================


export const requestLoginOtp = async (
  email
) => {
  const wanted = normalize(email);

  const accounts = readAccounts();

  const entry = Object.values(
    accounts
  ).find(
    (account) =>
      normalize(account?.email) ===
      wanted
  );

  if (
    !entry ||
    entry.status !== "active"
  ) {
    throw new Error(
      "Unable to send OTP."
    );
  }

  const mobile = String(
    entry.mobile || ""
  ).trim();

  if (!mobile) {
    throw new Error(
      "No registered mobile number is available. Please contact HR."
    );
  }

  const previous =
    readOtpState();

  // ----------------------------------------------------
  // RESEND COOLDOWN
  // ----------------------------------------------------

  if (
    previous?.email === wanted &&
    previous?.createdAt &&
    Date.now() -
      Number(previous.createdAt) <
      OTP_RESEND_MS
  ) {
    const remaining =
      Math.ceil(
        (
          OTP_RESEND_MS -
          (
            Date.now() -
            Number(
              previous.createdAt
            )
          )
        ) / 1000
      );

    throw new Error(
      `Please wait ${remaining} seconds before requesting another OTP.`
    );
  }

  // ----------------------------------------------------
  // GENERATE OTP
  // ----------------------------------------------------

  const otp =
    generateOtp();

  saveOtpState({
    email: wanted,

    employeeInternalId:
      entry.employeeInternalId,

    otp,

    createdAt:
      Date.now(),

    expiresAt:
      Date.now() +
      OTP_TTL_MS,

    attempts: 0,
  });


  // ====================================================
  // DEVELOPMENT MODE
  //
  // This allows you to test OTP before SMS backend.
  //
  // IMPORTANT:
  // Remove this before production.
  // ====================================================

  if (
    import.meta.env.DEV
  ) {
    console.info(
      `[HRSYNC DEV OTP] ${wanted}: ${otp}`
    );
  }


  return {
    success: true,

    mobile:
      maskMobile(mobile),

    expiresInSeconds:
      OTP_TTL_MS / 1000,

    // Development testing only
    devOtp:
      import.meta.env.DEV
        ? otp
        : undefined,
  };
};


// ======================================================
// VERIFY LOGIN OTP
// ======================================================

export const verifyLoginOtp = async (
  email,
  otp
) => {
  const wanted =
    normalize(email);

  const state =
    readOtpState();

  if (
    !state ||
    state.email !== wanted
  ) {
    throw new Error(
      "OTP session not found. Please request a new OTP."
    );
  }


  // ----------------------------------------------------
  // EXPIRY CHECK
  // ----------------------------------------------------

  if (
    Date.now() >
    Number(state.expiresAt)
  ) {
    clearOtpState();

    throw new Error(
      "OTP has expired. Please request a new OTP."
    );
  }


  // ----------------------------------------------------
  // ATTEMPT LIMIT
  // ----------------------------------------------------

  if (
    Number(state.attempts || 0) >=
    MAX_OTP_ATTEMPTS
  ) {
    clearOtpState();

    throw new Error(
      "Too many incorrect OTP attempts. Please request a new OTP."
    );
  }


  // ----------------------------------------------------
  // OTP CHECK
  // ----------------------------------------------------

  if (
    String(otp || "").trim() !==
    String(state.otp)
  ) {
    const attempts =
      Number(
        state.attempts || 0
      ) + 1;

    saveOtpState({
      ...state,
      attempts,
    });

    const remaining =
      Math.max(
        0,
        MAX_OTP_ATTEMPTS -
          attempts
      );

    throw new Error(
      remaining
        ? `Incorrect OTP. ${remaining} attempt${
            remaining === 1
              ? ""
              : "s"
          } remaining.`
        : "Too many incorrect OTP attempts. Please request a new OTP."
    );
  }


  // ----------------------------------------------------
  // OTP SUCCESS
  // ----------------------------------------------------

  const account =
    getEmployeeAccount(
      state.employeeInternalId
    );

  clearOtpState();

  if (
    !account ||
    account.status !== "active"
  ) {
    throw new Error(
      "Employee account is no longer active."
    );
  }

  return {
    id:
      account.employeeInternalId,

    employeeId:
      account.employeeId,

    name:
      account.employeeName,

    email:
      account.email,

    role:
      account.role ||
      "Employee",
  };
};


// ======================================================
// RESEND OTP
// ======================================================

export const resendLoginOtp = async (
  email
) => {
  return requestLoginOtp(email);
};



// ======================================================
// ADMIN AUTHENTICATION + OTP
// ======================================================

const ADMIN_EMAIL = "admin@bauer.com";
const ADMIN_MOBILE_KEY = "bauerHrmsAdminMobile";
const ADMIN_PASSWORD_HASH_KEY = "bauerHrmsAdminPasswordHash";
const ADMIN_LOGIN_OTP_KEY = "hrms_admin_login_otp";
const ADMIN_PASSWORD_OTP_KEY = "hrms_admin_password_otp";

const getAdminMobile = () =>
  String(localStorage.getItem(ADMIN_MOBILE_KEY) || "").trim();

const getAdminUser = () => ({
  id: "ADMIN",
  employeeId: "ADMIN",
  name: "Admin User",
  email: ADMIN_EMAIL,
  role: "HR Admin",
  department: "HR & Admin",
  mobile: getAdminMobile(),
});

const readSessionJson = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const saveSessionJson = (key, value) => {
  sessionStorage.setItem(key, JSON.stringify(value));
};

const clearSessionJson = (key) => {
  sessionStorage.removeItem(key);
};

export const authenticateAdmin = async (email, password) => {
  if (normalize(email) !== ADMIN_EMAIL) return null;

  const storedHash = localStorage.getItem(ADMIN_PASSWORD_HASH_KEY);

  // First run migration: the existing development password remains
  // Admin@123, but is immediately stored as a SHA-256 hash.
  if (!storedHash) {
    const defaultHash = await hashPassword("Admin@123");
    if (await hashPassword(password || "") !== defaultHash) return null;

    localStorage.setItem(ADMIN_PASSWORD_HASH_KEY, defaultHash);
  } else {
    const suppliedHash = await hashPassword(password || "");
    if (suppliedHash !== storedHash) return null;
  }

  // Login OTP is temporarily disabled.
  return {
    otpRequired: false,
    admin: getAdminUser(),
  };
};

export const requestAdminLoginOtp = async () => {
  const mobile = getAdminMobile();

  if (!mobile) {
    throw new Error(
      "Admin mobile number is not registered. Please add the Admin mobile number in Settings first."
    );
  }

  const previous = readSessionJson(ADMIN_LOGIN_OTP_KEY);

  if (
    previous?.createdAt &&
    Date.now() - Number(previous.createdAt) < OTP_RESEND_MS
  ) {
    const remaining = Math.ceil(
      (OTP_RESEND_MS - (Date.now() - Number(previous.createdAt))) / 1000
    );
    throw new Error(
      `Please wait ${remaining} seconds before requesting another OTP.`
    );
  }

  const otp = generateOtp();

  saveSessionJson(ADMIN_LOGIN_OTP_KEY, {
    email: ADMIN_EMAIL,
    otp,
    createdAt: Date.now(),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  if (import.meta.env.DEV) {
    console.info(`[HRSYNC DEV ADMIN OTP]: ${otp}`);
  }

  return {
    success: true,
    mobile: maskMobile(mobile),
    expiresInSeconds: OTP_TTL_MS / 1000,
    devOtp: import.meta.env.DEV ? otp : undefined,
  };
};

export const verifyAdminLoginOtp = async (otp) => {
  const state = readSessionJson(ADMIN_LOGIN_OTP_KEY);

  if (!state) {
    throw new Error("OTP session not found. Please request a new OTP.");
  }

  if (Date.now() > Number(state.expiresAt)) {
    clearSessionJson(ADMIN_LOGIN_OTP_KEY);
    throw new Error("OTP has expired. Please request a new OTP.");
  }

  if (Number(state.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    clearSessionJson(ADMIN_LOGIN_OTP_KEY);
    throw new Error(
      "Too many incorrect OTP attempts. Please request a new OTP."
    );
  }

  if (String(otp || "").trim() !== String(state.otp)) {
    const attempts = Number(state.attempts || 0) + 1;
    saveSessionJson(ADMIN_LOGIN_OTP_KEY, { ...state, attempts });

    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - attempts);
    throw new Error(
      remaining
        ? `Incorrect OTP. ${remaining} attempt${
            remaining === 1 ? "" : "s"
          } remaining.`
        : "Too many incorrect OTP attempts. Please request a new OTP."
    );
  }

  clearSessionJson(ADMIN_LOGIN_OTP_KEY);
  recordAdminLogin();
  return getAdminUser();
};

export const resendAdminLoginOtp = async () => {
  return requestAdminLoginOtp();
};

export const requestAdminPasswordChangeOtp = async (
  currentPassword,
  newPassword
) => {
  if (!currentPassword) {
    throw new Error("Current password is required.");
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }

  const admin = await authenticateAdmin(ADMIN_EMAIL, currentPassword);

  if (!admin || admin.mobileMissing) {
    throw new Error("Current Admin password is incorrect.");
  }

  const otp = generateOtp();
  const newPasswordHash = await hashPassword(newPassword);

  saveSessionJson(ADMIN_PASSWORD_OTP_KEY, {
    email: ADMIN_EMAIL,
    otp,
    newPasswordHash,
    createdAt: Date.now(),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  if (import.meta.env.DEV) {
    console.info(`[HRSYNC DEV ADMIN PASSWORD OTP]: ${otp}`);
  }

  return {
    success: true,
    mobile: maskMobile(admin.mobile),
    expiresInSeconds: OTP_TTL_MS / 1000,
    devOtp: import.meta.env.DEV ? otp : undefined,
  };
};

export const verifyAdminPasswordChangeOtp = async (otp) => {
  const state = readSessionJson(ADMIN_PASSWORD_OTP_KEY);

  if (!state) {
    throw new Error("Password-change OTP session not found.");
  }

  if (Date.now() > Number(state.expiresAt)) {
    clearSessionJson(ADMIN_PASSWORD_OTP_KEY);
    throw new Error("OTP has expired. Please request a new OTP.");
  }

  if (Number(state.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    clearSessionJson(ADMIN_PASSWORD_OTP_KEY);
    throw new Error(
      "Too many incorrect OTP attempts. Please request a new OTP."
    );
  }

  if (String(otp || "").trim() !== String(state.otp)) {
    const attempts = Number(state.attempts || 0) + 1;
    saveSessionJson(ADMIN_PASSWORD_OTP_KEY, { ...state, attempts });

    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - attempts);
    throw new Error(
      remaining
        ? `Incorrect OTP. ${remaining} attempt${
            remaining === 1 ? "" : "s"
          } remaining.`
        : "Too many incorrect OTP attempts. Please request a new OTP."
    );
  }

  localStorage.setItem(ADMIN_PASSWORD_HASH_KEY, state.newPasswordHash);
  clearSessionJson(ADMIN_PASSWORD_OTP_KEY);

  return { success: true };
};

// ======================================================
// ADMIN SESSION SECURITY + PASSWORD RESET
// ======================================================

const ADMIN_SESSION_VERSION_KEY = "bauerHrmsAdminSessionVersion";
const ADMIN_PASSWORD_RESET_OTP_KEY = "hrms_admin_password_reset_otp";

export const getAdminSessionVersion = () =>
  Number(localStorage.getItem(ADMIN_SESSION_VERSION_KEY) || "1");

export const revokeAdminSessions = () => {
  const next = getAdminSessionVersion() + 1;
  localStorage.setItem(ADMIN_SESSION_VERSION_KEY, String(next));
  return next;
};

export const recordAdminLogin = () => {
  localStorage.setItem("bauerHrmsAdminLastLogin", new Date().toISOString());
};

export const requestAdminPasswordResetOtp = async () => {
  const mobile = getAdminMobile();
  if (!mobile) throw new Error("Admin mobile number is not registered. Please contact the system administrator.");

  const previous = readSessionJson(ADMIN_PASSWORD_RESET_OTP_KEY);
  if (previous?.createdAt && Date.now() - Number(previous.createdAt) < OTP_RESEND_MS) {
    const remaining = Math.ceil((OTP_RESEND_MS - (Date.now() - Number(previous.createdAt))) / 1000);
    throw new Error(`Please wait ${remaining} seconds before requesting another OTP.`);
  }

  const otp = generateOtp();
  saveSessionJson(ADMIN_PASSWORD_RESET_OTP_KEY, { email: ADMIN_EMAIL, otp, createdAt: Date.now(), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
  if (import.meta.env.DEV) console.info(`[HRSYNC DEV ADMIN RESET OTP]: ${otp}`);
  return { success: true, mobile: maskMobile(mobile), expiresInSeconds: OTP_TTL_MS / 1000, devOtp: import.meta.env.DEV ? otp : undefined };
};

export const verifyAdminPasswordResetOtp = async (otp, newPassword) => {
  if (!newPassword || newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
  const state = readSessionJson(ADMIN_PASSWORD_RESET_OTP_KEY);
  if (!state) throw new Error("Password reset OTP session not found. Please request a new OTP.");
  if (Date.now() > Number(state.expiresAt)) { clearSessionJson(ADMIN_PASSWORD_RESET_OTP_KEY); throw new Error("OTP has expired. Please request a new OTP."); }
  if (Number(state.attempts || 0) >= MAX_OTP_ATTEMPTS) { clearSessionJson(ADMIN_PASSWORD_RESET_OTP_KEY); throw new Error("Too many incorrect OTP attempts. Please request a new OTP."); }
  if (String(otp || "").trim() !== String(state.otp)) {
    const attempts = Number(state.attempts || 0) + 1;
    saveSessionJson(ADMIN_PASSWORD_RESET_OTP_KEY, { ...state, attempts });
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - attempts);
    throw new Error(remaining ? `Incorrect OTP. ${remaining} attempts remaining.` : "Too many incorrect OTP attempts. Please request a new OTP.");
  }
  localStorage.setItem(ADMIN_PASSWORD_HASH_KEY, await hashPassword(newPassword));
  clearSessionJson(ADMIN_PASSWORD_RESET_OTP_KEY);
  revokeAdminSessions();
  return { success: true };
};

// ======================================================
// ACCOUNT KEY EXPORT
// ======================================================

export {
  ACCOUNT_KEY,
};
