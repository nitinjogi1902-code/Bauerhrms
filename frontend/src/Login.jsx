import { useEffect, useState } from "react";
import "./Login.css";
import {
  activateEmployeeAccount,
  authenticateEmployee,
  verifyAdminPasswordResetOtp,
} from "./auth";
import { supabase } from "./supabaseClient";



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
  let mounted = true;

  const checkAuthCallback = async () => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";

    // --------------------------------------------------
    // 1. Legacy activation link
    // --------------------------------------------------
    if (hash.startsWith("#activate=")) {
      if (!mounted) return;

      setActivationToken(
        decodeURIComponent(hash.slice("#activate=".length))
      );
      setActivationMode(true);
      return;
    }

    // --------------------------------------------------
    // 2. Check whether this was a Supabase invite
    // --------------------------------------------------
    const hashParams = new URLSearchParams(
      hash.replace(/^#/, "")
    );

    const searchParams = new URLSearchParams(search);

    const isSupabaseInvite =
      hashParams.get("type") === "invite" ||
      hashParams.has("access_token") ||
      searchParams.has("code");

    // --------------------------------------------------
    // 3. Get Supabase session
    // --------------------------------------------------
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!mounted) return;

    const user = session?.user;

    // --------------------------------------------------
    // 4. Employee invitation session
    // --------------------------------------------------
    const employeeId =
      user?.user_metadata?.employee_internal_id ||
      user?.user_metadata?.employeeId ||
      user?.user_metadata?.employee_id ||
      "";

    if (isSupabaseInvite || employeeId) {
      setActivationToken("");
      setActivationMode(true);
      return;
    }
  };

  checkAuthCallback();

  // --------------------------------------------------
  // 5. IMPORTANT:
  // Supabase may process the invitation AFTER the page
  // has already loaded. Listen for that event.
  // --------------------------------------------------
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (!mounted) return;

      const user = session?.user;

      const employeeId =
        user?.user_metadata?.employee_internal_id ||
        user?.user_metadata?.employeeId ||
        user?.user_metadata?.employee_id ||
        "";

      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        employeeId
      ) {
        setActivationToken("");
        setActivationMode(true);
      }
    }
  );

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);

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
      const email = username.trim().toLowerCase();

      /*
       * HRSYNC authentication flow
       *
       * 1. Authenticate the person with Supabase Auth.
       * 2. Check whether the authenticated user is a Platform Super Admin.
       * 3. If not, check company/tenant membership in organization_users.
       * 4. Resolve the user's company role and permissions.
       * 5. Only fall back to the legacy employee activation/login flow when
       *    there is no Supabase Auth account for this email.
       *
       * IMPORTANT:
       * A company user must NOT be inserted into platform_users just to log in.
       */

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (!authError && authData?.user) {
        const authUser = authData.user;

        /* ---------------------------------------------------------------
         * PATH 1: HRSYNC PLATFORM SUPER ADMIN
         * ------------------------------------------------------------- */
        const {
          data: platformUser,
          error: platformError,
        } = await supabase
          .from("platform_users")
          .select("id, user_id, is_super_admin, status")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (platformError) {
          await supabase.auth.signOut();
          throw new Error(
            platformError.message ||
              "Unable to verify HRSYNC platform access."
          );
        }

        if (
          platformUser?.is_super_admin === true &&
          String(platformUser.status || "").toLowerCase() === "active"
        ) {
          const platformAdmin = {
            id: authUser.id,
            userId: authUser.id,
            email: authUser.email || email,
            name:
              authUser.user_metadata?.full_name ||
              authUser.user_metadata?.name ||
              "HRSYNC Platform Super Admin",
            role: "Super Admin",
            roleCode: "PLATFORM_SUPER_ADMIN",
            isPlatformSuperAdmin: true,
            accessType: "platform",
            platformUserId: platformUser.id,
            status: platformUser.status,
          };

          onLogin(rememberMe, platformAdmin);
          return;
        }

        /* ---------------------------------------------------------------
         * PATH 2: COMPANY / TENANT USER
         * ------------------------------------------------------------- */

        const {
          data: organizationUser,
          error: organizationUserError,
        } = await supabase
          .from("organization_users")
          .select(
            "id, organization_id, user_id, employee_id, status, created_at"
          )
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (organizationUserError) {
          await supabase.auth.signOut();
          throw new Error(
            organizationUserError.message ||
              "Unable to verify company access."
          );
        }

        if (organizationUser) {
          if (
            String(organizationUser.status || "").toLowerCase() !== "active"
          ) {
            await supabase.auth.signOut();
            setError(
              "Your company account is inactive. Please contact your HR administrator."
            );
            return;
          }

          if (!organizationUser.organization_id) {
            await supabase.auth.signOut();
            setError(
              "Your account is not linked to a company. Please contact your HR administrator."
            );
            return;
          }

          /*
           * Resolve the tenant role.
           */
          const {
            data: roleLink,
            error: roleLinkError,
          } = await supabase
            .from("organization_user_roles")
            .select("id, organization_user_id, role_id")
            .eq("organization_user_id", organizationUser.id)
            .limit(1)
            .maybeSingle();

          if (roleLinkError) {
            await supabase.auth.signOut();
            throw new Error(
              roleLinkError.message ||
                "Unable to verify your company role."
            );
          }

          if (!roleLink?.role_id) {
            await supabase.auth.signOut();
            setError(
              "No company role has been assigned to your account. Please contact your HR administrator."
            );
            return;
          }

          const {
            data: role,
            error: roleError,
          } = await supabase
            .from("roles")
            .select(
              "id, organization_id, role_code, role_name, description, is_system_role, is_active"
            )
            .eq("id", roleLink.role_id)
            .eq("organization_id", organizationUser.organization_id)
            .maybeSingle();

          if (roleError) {
            await supabase.auth.signOut();
            throw new Error(
              roleError.message ||
                "Unable to load your company role."
            );
          }

          if (!role || role.is_active === false) {
            await supabase.auth.signOut();
            setError(
              "Your assigned company role is inactive. Please contact your HR administrator."
            );
            return;
          }

          /*
           * Resolve role permissions.
           *
           * Permission format:
           *   module.action
           * Example:
           *   employees.view
           *   payroll.process
           */
          const {
            data: rolePermissionRows,
            error: permissionError,
          } = await supabase
            .from("role_permissions")
            .select("permission_id")
            .eq("role_id", role.id);

          if (permissionError) {
            await supabase.auth.signOut();
            throw new Error(
              permissionError.message ||
                "Unable to load your permissions."
            );
          }

          const permissionIds = (rolePermissionRows || [])
            .map((item) => item.permission_id)
            .filter(Boolean);

          let permissions = [];

          if (permissionIds.length) {
            const {
              data: permissionRows,
              error: permissionsError,
            } = await supabase
              .from("permissions")
              .select(
                "id, permission_code, action, description"
              )
              .in("id", permissionIds);

            if (permissionsError) {
              await supabase.auth.signOut();
              throw new Error(
                permissionsError.message ||
                  "Unable to load your permissions."
              );
            }

            permissions = permissionRows || [];
          }

          /*
           * Company module access is a second access boundary.
           * A role permission is effective only when the corresponding
           * module has also been enabled for this organization by the
           * HRSYNC Platform Super Admin.
           */
          const {
            data: organizationModules,
            error: organizationModulesError,
          } = await supabase
            .from("organization_modules")
            .select("module_id")
            .eq("organization_id", organizationUser.organization_id);

          if (organizationModulesError) {
            await supabase.auth.signOut();
            throw new Error(
              organizationModulesError.message ||
                "Unable to verify company module access."
            );
          }

          const enabledModuleIds = Array.from(
            new Set(
              (organizationModules || [])
                .map((item) => item?.module_id)
                .filter(Boolean)
            )
          );

          let enabledModuleCodes = new Set();

          if (enabledModuleIds.length) {
            const {
              data: enabledModules,
              error: enabledModulesError,
            } = await supabase
              .from("platform_modules")
              .select("id, module_code")
              .in("id", enabledModuleIds)
              .eq("is_active", true);

            if (enabledModulesError) {
              await supabase.auth.signOut();
              throw new Error(
                enabledModulesError.message ||
                  "Unable to load company modules."
              );
            }

            enabledModuleCodes = new Set(
              (enabledModules || [])
                .map((item) => String(item?.module_code || "").trim().toLowerCase())
                .filter(Boolean)
            );
          }

          permissions = permissions.filter((permission) => {
            const permissionCode = String(permission?.permission_code || "")
              .trim()
              .toLowerCase();
            const moduleCode = permissionCode.split(".")[0];
            return moduleCode && enabledModuleCodes.has(moduleCode);
          });

          /*
           * Resolve company information.
           */
          const {
            data: organization,
            error: organizationError,
          } = await supabase
            .from("organizations")
            .select(
              "id, name, legal_name, code, email, phone, address, city, state, country, pincode, logo_url, currency_code, currency_symbol, timezone, date_format, financial_year_start_month, status, subscription_status, settings"
            )
            .eq("id", organizationUser.organization_id)
            .maybeSingle();

          if (organizationError) {
            await supabase.auth.signOut();
            throw new Error(
              organizationError.message ||
                "Unable to load company information."
            );
          }

          if (!organization) {
            await supabase.auth.signOut();
            setError(
              "The company linked to your account could not be found. Please contact your HR administrator."
            );
            return;
          }

          if (
            organization.status &&
            String(organization.status).toLowerCase() !== "active"
          ) {
            await supabase.auth.signOut();
            setError(
              "This company account is inactive. Please contact HRSYNC support."
            );
            return;
          }

          /*
           * Resolve the employee profile when the company user is linked
           * to an employee record.
           */
          let employee = null;

          if (organizationUser.employee_id) {
            const {
              data: employeeRow,
              error: employeeError,
            } = await supabase
              .from("employees")
              .select(
                "id, employee_id, employee_name, email, personal_email, mobile, department, designation, employment_type, organization_id"
              )
              .eq("id", organizationUser.employee_id)
              .eq(
                "organization_id",
                organizationUser.organization_id
              )
              .maybeSingle();

            if (employeeError) {
              await supabase.auth.signOut();
              throw new Error(
                employeeError.message ||
                  "Unable to load your employee profile."
              );
            }

            employee = employeeRow || null;
          }

          /*
           * Build the session user object consumed by App.jsx / Dashboard.
           */
          const companyUser = {
            id: authUser.id,
            userId: authUser.id,
            email: authUser.email || email,

            name:
              authUser.user_metadata?.full_name ||
              authUser.user_metadata?.name ||
              employee?.employee_name ||
              email.split("@")[0],

            role: role.role_name,
            roleCode: role.role_code,

            isPlatformSuperAdmin: false,
            accessType: "company",

            organizationId: organizationUser.organization_id,
            organizationUserId: organizationUser.id,
            employeeId: organizationUser.employee_id || null,

            status: organizationUser.status,

            organization,
            employee,

            roleId: role.id,
            permissions,

            permissionCodes: permissions
              .map((permission) => {
                const moduleKey = String(permission.permission_code || "").split(".")[0]
                  .trim()
                  .toLowerCase();
                const action = String(permission.action || "")
                  .trim()
                  .toLowerCase();
                return moduleKey && action
                  ? `${moduleKey}.${action}`
                  : "";
              })
              .filter(Boolean),

            authUserMetadata: authUser.user_metadata || {},
          };

          onLogin(rememberMe, companyUser);
          return;
        }

        /*
         * The password was correct and Supabase Auth account exists, but
         * the account is neither a Platform Super Admin nor a company user.
         */
        await supabase.auth.signOut();
        setError(
          "Your HRSYNC account is not linked to any company. Please contact your HR administrator."
        );
        return;
      }

      /*
       * Supabase Auth did not authenticate the email/password.
       *
       * Keep the existing employee authentication flow for legacy/activation
       * accounts that have not yet been migrated to Supabase Auth.
       */
      const result = await authenticateEmployee(username, password);

      if (!result) {
        setError(
          authError?.message
            ? "Invalid email or password."
            : "Invalid email or password."
        );
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
      const email = username.trim().toLowerCase();

      if (!email) {
        throw new Error("Please enter your email address first.");
      }

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });

      if (resetError) throw resetError;

      setOtpMode(false);
      setOtp("");
      setDevOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setOtpPurpose("login");
      setResendSeconds(0);
      setError(
        "If an account exists for this email, a password reset link has been sent."
      );
    } catch (err) {
      setError(err?.message || "Unable to send password reset email.");
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
              Password recovery is handled securely through your registered
              email address.
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

                  const email = username.trim().toLowerCase();

                  if (!email) {
                    setError("Please enter your email address first.");
                    return;
                  }

                  setLoading(true);

                  try {
                    const { error: resetError } =
                      await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/`,
                      });

                    if (resetError) throw resetError;

                    setError(
                      "If an account exists for this email, a password reset link has been sent."
                    );
                  } catch (err) {
                    setError(
                      err?.message || "Unable to send password reset email."
                    );
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
