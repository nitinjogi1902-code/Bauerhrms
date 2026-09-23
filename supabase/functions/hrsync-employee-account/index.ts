import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

const supabaseAnonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";

const supabaseServiceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is missing.");
}

if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
}

const adminClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const getBearerToken = (request: Request) => {
  const header = request.headers.get("Authorization") || "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
};

const getCaller = async (request: Request) => {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("Authorization token is missing.");
  }

  const client = createClient(
    supabaseUrl,
    supabaseAnonKey || supabaseServiceRoleKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    throw new Error("Invalid or expired authentication session.");
  }

  return {
    user,
    token,
    client,
  };
};

const normalize = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const getOrganizationMembership = async (userId: string) => {
  const { data, error } = await adminClient
    .from("organization_users")
    .select(
      "id, user_id, organization_id, employee_id, status"
    )
    .eq("user_id", userId)
    .eq("status", "Active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to verify organization membership."
    );
  }

  return data;
};

const verifyCompanyAdmin = async (
  userId: string,
  organizationId: string
) => {
  const membership = await getOrganizationMembership(userId);

  if (!membership) {
    throw new Error(
      "You are not an active member of this organization."
    );
  }

  if (
    String(membership.organization_id) !==
    String(organizationId)
  ) {
    throw new Error(
      "You do not have access to this organization."
    );
  }

  /*
   * organization_user_roles uses organization_user_id,
   * not user_id.
   */
  const { data: roleMappings, error: roleError } =
    await adminClient
      .from("organization_user_roles")
      .select("role_id")
      .eq("organization_user_id", membership.id);

  if (roleError) {
    throw new Error(
      roleError.message ||
        "Unable to verify organization role."
    );
  }

  const roleIds = (roleMappings || [])
    .map((item) => item.role_id)
    .filter(Boolean);

  if (!roleIds.length) {
    throw new Error(
      "No organization role is assigned to this user."
    );
  }

  /*
   * Actual roles columns:
   * role_code
   * role_name
   */
  const { data: roles, error } = await adminClient
    .from("roles")
    .select(
      "id, role_name, role_code, organization_id"
    )
    .in("id", roleIds)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(
      error.message ||
        "Unable to verify organization role."
    );
  }

  const isAdmin = (roles || []).some(
    (role) =>
      normalize(role.role_code) === "company_admin" ||
      normalize(role.role_code) === "company-admin" ||
      normalize(role.role_code) === "admin" ||
      normalize(role.role_name) === "company admin"
  );

  if (!isAdmin) {
    throw new Error(
      "Company Admin permission is required for this action."
    );
  }

  return membership;
};

const findEmployee = async (
  employeeId: string,
  organizationId: string
) => {
  /*
   * employee_code does not exist in the actual
   * employees table.
   */
  const { data, error } = await adminClient
    .from("employees")
    .select(
      "id, organization_id, employee_id, employee_name, email, personal_email"
    )
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Unable to find employee."
    );
  }

  if (!data) {
    throw new Error(
      "Employee not found in this organization."
    );
  }

  return data;
};

const getEmployeeEmail = (employee: any) => {
  return normalize(
    employee?.email ||
      employee?.personal_email
  );
};

const getEmployeeRole = async (
  organizationId: string
) => {
  /*
   * Actual roles columns:
   * role_code
   * role_name
   */
  const { data, error } = await adminClient
    .from("roles")
    .select(
      "id, role_name, role_code, organization_id"
    )
    .eq("organization_id", organizationId)
    .eq("role_code", "EMPLOYEE")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to find Employee role."
    );
  }

  if (!data) {
    throw new Error(
      "EMPLOYEE role is not configured for this organization."
    );
  }

  return data;
};

const ensureEmployeeOrganizationUser = async ({
  organizationId,
  employeeId,
  authUserId,
}: {
  organizationId: string;
  employeeId: string;
  authUserId: string;
}) => {
  const { data: existing, error: existingError } =
    await adminClient
      .from("organization_users")
      .select(
        "id, user_id, organization_id, employee_id, status"
      )
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      existingError.message ||
        "Unable to check employee organization access."
    );
  }

  let organizationUser = existing;

  if (organizationUser) {
    if (
      organizationUser.user_id &&
      String(organizationUser.user_id) !==
        String(authUserId)
    ) {
      throw new Error(
        "This employee is already linked to another login account."
      );
    }

    const { data: updated, error: updateError } =
      await adminClient
        .from("organization_users")
        .update({
          user_id: authUserId,
          status: "Active",
        })
        .eq("id", organizationUser.id)
        .select(
          "id, user_id, organization_id, employee_id, status"
        )
        .single();

    if (updateError) {
      throw new Error(
        updateError.message ||
          "Unable to activate employee organization access."
      );
    }

    organizationUser = updated;
  } else {
    const { data: inserted, error: insertError } =
      await adminClient
        .from("organization_users")
        .insert({
          user_id: authUserId,
          organization_id: organizationId,
          employee_id: employeeId,
          status: "Active",
        })
        .select(
          "id, user_id, organization_id, employee_id, status"
        )
        .single();

    if (insertError) {
      throw new Error(
        insertError.message ||
          "Unable to create employee organization access."
      );
    }

    organizationUser = inserted;
  }

  return organizationUser;
};

const ensureEmployeeRole = async ({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}) => {
  const role = await getEmployeeRole(
    organizationId
  );

  /*
   * Find the employee's organization_users record.
   *
   * organization_user_roles references
   * organization_users.id through organization_user_id.
   */
  const { data: organizationUser, error: orgUserError } =
    await adminClient
      .from("organization_users")
      .select(
        "id, user_id, organization_id, employee_id, status"
      )
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("status", "Active")
      .maybeSingle();

  if (orgUserError) {
    throw new Error(
      orgUserError.message ||
        "Unable to find employee organization access."
    );
  }

  if (!organizationUser) {
    throw new Error(
      "Employee organization access does not exist."
    );
  }

  /*
   * Actual organization_user_roles columns:
   * id
   * organization_user_id
   * role_id
   * created_at
   */
  const {
    data: existingMapping,
    error: mappingError,
  } = await adminClient
    .from("organization_user_roles")
    .select(
      "id, organization_user_id, role_id"
    )
    .eq(
      "organization_user_id",
      organizationUser.id
    )
    .eq("role_id", role.id)
    .maybeSingle();

  if (mappingError) {
    throw new Error(
      mappingError.message ||
        "Unable to check employee role."
    );
  }

  if (!existingMapping) {
    const { error: insertError } =
      await adminClient
        .from("organization_user_roles")
        .insert({
          organization_user_id:
            organizationUser.id,
          role_id: role.id,
        });

    if (insertError) {
      throw new Error(
        insertError.message ||
          "Unable to assign Employee role."
      );
    }
  }

  return role;
};

const handleStatus = async (
  request: Request,
  body: any
) => {
  const { user } = await getCaller(request);

  const employeeId = String(
    body?.employeeId || ""
  ).trim();

  if (!employeeId) {
    throw new Error(
      "Employee ID is required."
    );
  }

  const { data, error } = await adminClient
    .from("organization_users")
    .select(
      "id, user_id, organization_id, employee_id, status"
    )
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to retrieve employee login status."
    );
  }

  if (!data) {
    return {
      success: true,
      status: "not_created",
      account: null,
    };
  }

  const isOwner =
    String(data.user_id || "") ===
    String(user.id);

  if (!isOwner) {
    const membership =
      await getOrganizationMembership(user.id);

    if (
      !membership ||
      String(membership.organization_id) !==
        String(data.organization_id)
    ) {
      throw new Error(
        "You do not have access to this employee account."
      );
    }
  }

  return {
    success: true,
    status: data.status,
    account: data,
  };
};

const handleInvite = async (
  request: Request,
  body: any
) => {
  const { user } = await getCaller(request);

  const organizationId = String(
    body?.organizationId || ""
  ).trim();

  const employeeId = String(
    body?.employeeId || ""
  ).trim();

  if (!organizationId) {
    throw new Error(
      "Organization ID is required."
    );
  }

  if (!employeeId) {
    throw new Error(
      "Employee ID is required."
    );
  }

  await verifyCompanyAdmin(
    user.id,
    organizationId
  );

  const employee = await findEmployee(
    employeeId,
    organizationId
  );

  const email = getEmployeeEmail(employee);

  if (!email) {
    throw new Error(
      "Official employee email is required before sending login credentials."
    );
  }

  const role = await getEmployeeRole(
    organizationId
  );

  /*
   * Check whether this employee already has
   * an organization user.
   */
  const { data: existingOrgUser, error: existingOrgUserError } =
    await adminClient
      .from("organization_users")
      .select(
        "id, user_id, organization_id, employee_id, status"
      )
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .maybeSingle();

  if (existingOrgUserError) {
    throw new Error(
      existingOrgUserError.message ||
        "Unable to check existing employee account."
    );
  }

  /*
   * If an existing Auth user is already linked,
   * do not create a duplicate account.
   */
  if (existingOrgUser?.user_id) {
    return {
      success: true,
      alreadyExists: true,
      message:
        "This employee already has a login account.",
      employee: {
        id: employee.id,
        employeeId: employee.employee_id,
        name: employee.employee_name,
        email,
      },
      role,
    };
  }

  /*
   * Check Auth by email using the admin API.
   */
  let authUser = null;

  let page = 1;
  const perPage = 1000;

  while (!authUser) {
    const {
      data: usersData,
      error: usersError,
    } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (usersError) {
      throw new Error(
        usersError.message ||
          "Unable to check existing authentication users."
      );
    }

    authUser =
      usersData.users.find(
        (item) =>
          normalize(item.email) === email
      ) || null;

    if (
      !usersData.users.length ||
      usersData.users.length < perPage
    ) {
      break;
    }

    page += 1;
  }

  /*
   * Create/invite Auth account.
   */
  if (!authUser) {
    const appUrl =
      Deno.env.get("APP_URL") ||
      Deno.env.get("SITE_URL") ||
      "";

    const redirectTo = appUrl
      ? `${appUrl.replace(/\/$/, "")}/`
      : undefined;

    const {
      data: inviteData,
      error,
    } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          employee_id: employee.id,
          organization_id: organizationId,
          role_code: "EMPLOYEE",
        },
        ...(redirectTo
          ? { redirectTo }
          : {}),
      }
    );

    if (error) {
      throw new Error(
        error.message ||
          "Unable to send employee invitation."
      );
    }

    authUser = inviteData.user;
  }

  if (!authUser?.id) {
    throw new Error(
      "Supabase Auth user could not be created."
    );
  }

  /*
   * Create employee organization membership.
   */
  const organizationUser =
    await ensureEmployeeOrganizationUser({
      organizationId,
      employeeId,
      authUserId: authUser.id,
    });

  /*
   * Assign Employee role.
   */
  await ensureEmployeeRole({
    userId: authUser.id,
    organizationId,
  });

  return {
    success: true,
    alreadyExists: false,
    message:
      "Employee login invitation created successfully.",
    employee: {
      id: employee.id,
      employeeId: employee.employee_id,
      name: employee.employee_name,
      email,
    },
    authUserId: authUser.id,
    organizationUserId:
      organizationUser.id,
    role,
  };
};

const handleActivate = async (
  request: Request,
  body: any
) => {
  const { user } = await getCaller(request);

  const employeeId = String(
    body?.employeeId || ""
  ).trim();

  const organizationId = String(
    body?.organizationId || ""
  ).trim();

  if (!employeeId) {
    throw new Error(
      "Employee ID is required for activation."
    );
  }

  /*
   * Find the employee account linked to
   * the currently authenticated Supabase user.
   */
  let query = adminClient
    .from("organization_users")
    .select(
      "id, user_id, organization_id, employee_id, status"
    )
    .eq("user_id", user.id)
    .eq("employee_id", employeeId);

  if (organizationId) {
    query = query.eq(
      "organization_id",
      organizationId
    );
  }

  const {
    data: organizationUser,
    error,
  } = await query.maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to verify employee account."
    );
  }

  if (!organizationUser) {
    throw new Error(
      "This login account is not linked to the employee record."
    );
  }

  const finalOrganizationId =
    organizationUser.organization_id;

  /*
   * Activate organization membership.
   */
  const { data: updated, error: updateError } =
    await adminClient
      .from("organization_users")
      .update({
        status: "Active",
      })
      .eq("id", organizationUser.id)
      .select(
        "id, user_id, organization_id, employee_id, status"
      )
      .single();

  if (updateError) {
    throw new Error(
      updateError.message ||
        "Unable to activate employee account."
    );
  }

  /*
   * Make sure Employee role exists.
   */
  const role = await ensureEmployeeRole({
    userId: user.id,
    organizationId:
      finalOrganizationId,
  });

  return {
    success: true,
    message:
      "Employee account activated successfully.",
    account: updated,
    role,
  };
};

const handleResend = async (
  request: Request,
  body: any
) => {
  const { user } = await getCaller(request);

  const organizationId = String(
    body?.organizationId || ""
  ).trim();

  const employeeId = String(
    body?.employeeId || ""
  ).trim();

  if (!organizationId) {
    throw new Error(
      "Organization ID is required."
    );
  }

  if (!employeeId) {
    throw new Error(
      "Employee ID is required."
    );
  }

  await verifyCompanyAdmin(
    user.id,
    organizationId
  );

  const employee = await findEmployee(
    employeeId,
    organizationId
  );

  const email = getEmployeeEmail(employee);

  if (!email) {
    throw new Error(
      "Official employee email is required."
    );
  }

  /*
   * Find Auth user.
   */
  let authUser = null;
  let page = 1;

  while (!authUser) {
    const {
      data: usersData,
      error,
    } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(
        error.message ||
          "Unable to find employee account."
      );
    }

    authUser =
      usersData.users.find(
        (item) =>
          normalize(item.email) === email
      ) || null;

    if (
      !usersData.users.length ||
      usersData.users.length < 1000
    ) {
      break;
    }

    page += 1;
  }

  if (!authUser) {
    throw new Error(
      "Employee login account does not exist yet. Please send the initial invitation."
    );
  }

  const appUrl =
    Deno.env.get("APP_URL") ||
    Deno.env.get("SITE_URL") ||
    "";

  const redirectTo = appUrl
    ? `${appUrl.replace(/\/$/, "")}/`
    : undefined;

  /*
   * Supabase does not expose a direct
   * resend-invitation method in every runtime.
   * Generate a fresh recovery/activation link.
   */
  const { error: resetError } =
  await adminClient.auth.resetPasswordForEmail(
    email,
    redirectTo
      ? { redirectTo }
      : undefined
  );

if (resetError) {
  throw new Error(
    resetError.message ||
      "Unable to send a new activation link."
  );
}

  return {
  success: true,
  message:
    "A new account activation link has been sent to the employee's email.",
    employee: {
      id: employee.id,
      employeeId: employee.employee_id,
      name: employee.employee_name,
      email,
    },
  };
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return json(
      {
        success: false,
        error: "Only POST requests are allowed.",
      },
      405
    );
  }

  try {
    const body = await request.json();

    const action = String(
      body?.action || ""
    )
      .trim()
      .toLowerCase();

    if (!action) {
      return json(
        {
          success: false,
          error: "Action is required.",
        },
        400
      );
    }

    switch (action) {
      case "status":
        return json(
          await handleStatus(request, body)
        );

      case "invite":
        return json(
          await handleInvite(request, body)
        );

      case "activate":
        return json(
          await handleActivate(request, body)
        );

      case "resend":
        return json(
          await handleResend(request, body)
        );

      default:
        return json(
          {
            success: false,
            error: `Unsupported action: ${action}`,
          },
          400
        );
    }
  } catch (error) {
    console.error(
      "HRSYNC employee account error:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    return json(
      {
        success: false,
        error:
          errorMessage ||
          "Unexpected server error.",
      },
      400
    );
  }
});