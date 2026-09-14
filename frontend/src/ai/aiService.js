/*
 * HRSYNC AI SERVICE
 *
 * Reads HRMS data from browser localStorage and sends
 * only safe/minimal data to the HRSYNC backend.
 */

const AI_ENDPOINT =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_ENDPOINT) ||
  "http://localhost:5000/api/ai";

const EMPLOYEE_STORAGE_KEY = "bauerHrmsEmployees";
const ATTENDANCE_STORAGE_KEY = "hrms_attendance";
const ORGANIZATION_STORAGE_KEY = "bauerHrmsOrganizationMasters";


// ============================================================
// BASIC HELPERS
// ============================================================

function safeReadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) return fallback;

    const parsed = JSON.parse(raw);

    return parsed ?? fallback;
  } catch (error) {
    console.error(`HRSYNC AI: unable to read ${key}`, error);
    return fallback;
  }
}


function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getEmployeeCode(employee) {
  return (
    employee?.employeeId ||
    employee?.employeeCode ||
    employee?.empCode ||
    employee?.id ||
    ""
  );
}


function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ");
}


// ============================================================
// EMPLOYEE DATA
// ============================================================

function buildSafeEmployees(employees) {
  if (!Array.isArray(employees)) return [];

  return employees.slice(0, 1000).map((employee) => ({
    id: employee?.id ?? null,

    employeeId:
      employee?.employeeId ??
      employee?.employeeCode ??
      employee?.empCode ??
      null,

    name: employee?.name ?? null,

    location:
      employee?.location ??
      employee?.site ??
      null,

    employeeGroup:
      employee?.employeeGroup ??
      employee?.type ??
      null,

    shift: employee?.shift ?? null,

    branch: employee?.branch ?? null,

    designation: employee?.designation ?? null,

    employmentType:
      employee?.employmentType ??
      null,

    department:
      employee?.department ??
      null,

    vendor:
      employee?.vendor ??
      null,

    jobType:
      employee?.jobType ??
      null,

    doj:
      employee?.doj ??
      employee?.dateOfJoining ??
      null,

    status:
      employee?.status ??
      "Active",
  }));
}


// ============================================================
// WEEK OFF POLICY
// ============================================================

function loadWeekOffPolicies() {
  const organization = safeReadJSON(
    ORGANIZATION_STORAGE_KEY,
    {}
  );

  return Array.isArray(organization?.weekOffPolicies)
    ? organization.weekOffPolicies
    : [];
}


function employeeMatchesWeekOffPolicy(employee, policy) {
  if (!employee || !policy || policy.active !== true) {
    return false;
  }

  const assignmentType =
    String(policy.assignmentType || "All Employees");


  if (assignmentType === "All Employees") {
    return true;
  }


  const assignment = normalize(policy.assignmentValue);

  if (!assignment) {
    return false;
  }


  if (assignmentType === "Vendor") {
    return (
      normalize(employee.vendor) === assignment
    );
  }


  if (assignmentType === "Employee Group") {
    const values = [
      employee.employeeGroup,
      employee.employeeGroupName,
      employee.group,
      employee.type,
    ]
      .map(normalize)
      .filter(Boolean);

    const aliases = new Set(values);

    if (aliases.has("on-roll")) {
      aliases.add("staff");
    }

    if (aliases.has("third party")) {
      aliases.add("third party associates");
    }

    return aliases.has(assignment);
  }


  return false;
}


function isScheduledWeeklyOff(
  employee,
  dateKey,
  policies
) {
  if (
    !employee ||
    !dateKey ||
    !Array.isArray(policies)
  ) {
    return false;
  }


  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }


  const day = date.getDay();

  const applicablePolicies = policies
    .filter((policy) => {
      if (
        !employeeMatchesWeekOffPolicy(
          employee,
          policy
        )
      ) {
        return false;
      }

      if (
        policy.effectiveFrom &&
        dateKey < String(policy.effectiveFrom)
      ) {
        return false;
      }

      return Boolean(
        policy.saturday ||
        policy.sunday
      );
    })
    .sort((a, b) => {
      const priority = (policy) => {
        if (
          policy.assignmentType === "Vendor"
        ) {
          return 3;
        }

        if (
          policy.assignmentType === "Employee Group"
        ) {
          return 2;
        }

        return 1;
      };

      return (
        priority(b) -
          priority(a) ||
        String(
          b.effectiveFrom || ""
        ).localeCompare(
          String(
            a.effectiveFrom || ""
          )
        )
      );
    });


  if (!applicablePolicies.length) {
    return false;
  }


  const policy = applicablePolicies[0];

  if (day === 6 && policy.saturday) {
    return true;
  }

  if (day === 0 && policy.sunday) {
    return true;
  }

  return false;
}


// ============================================================
// ATTENDANCE STATUS RULES
// ============================================================

const PRESENT_STATUSES = new Set([
  "P",
  "Present",
  "OD",
  "WFH",
]);

const HALF_DAY_STATUSES = new Set([
  "HD",
  "Half Day",
]);

const LEAVE_STATUSES = new Set([
  "EL",
  "CL",
  "SL",
  "FL",
]);

const ABSENT_STATUSES = new Set([
  "A",
  "Absent",
]);

const WEEKLY_OFF_STATUSES = new Set([
  "WO",
  "Weekly Off",
]);

const HOLIDAY_STATUSES = new Set([
  "HO",
  "Holiday",
]);

const CO_USED_STATUSES = new Set([
  "CO",
  "Comp Off",
]);


// ============================================================
// BUILD ONE ATTENDANCE RECORD
// ============================================================

function buildAttendanceRecord({
  dateKey,
  employee,
  rawRecord,
  weekOffPolicies,
}) {
  const record = rawRecord || {};

  const status = String(
    record.status || ""
  ).trim();


  const scheduledWeeklyOff =
    isScheduledWeeklyOff(
      employee,
      dateKey,
      weekOffPolicies
    );


  /*
   * IMPORTANT BUSINESS RULE
   *
   * Scheduled Weekly Off + employee actually works
   * = Worked Weekly Off
   * = Present/Worked
   * = CO Earned
   *
   * It must NEVER become Leave.
   */

  const hasWorkEvidence =
    PRESENT_STATUSES.has(status) ||
    HALF_DAY_STATUSES.has(status) ||
    status === "CO";


  const weeklyOffWorked =
    scheduledWeeklyOff &&
    hasWorkEvidence;


  const coEarned =
    weeklyOffWorked
      ? 1
      : 0;


  const coUsed =
    CO_USED_STATUSES.has(status)
      ? 1
      : 0;


  let statusMeaning = "Unmarked";


  if (weeklyOffWorked) {
    statusMeaning =
      "Worked on Weekly Off";
  } else if (PRESENT_STATUSES.has(status)) {
    statusMeaning =
      "Present / Worked";
  } else if (HALF_DAY_STATUSES.has(status)) {
    statusMeaning =
      "Half Day";
  } else if (LEAVE_STATUSES.has(status)) {
    statusMeaning =
      "Leave";
  } else if (ABSENT_STATUSES.has(status)) {
    statusMeaning =
      "Absent";
  } else if (WEEKLY_OFF_STATUSES.has(status)) {
    statusMeaning =
      "Weekly Off";
  } else if (HOLIDAY_STATUSES.has(status)) {
    statusMeaning =
      "Holiday";
  } else if (CO_USED_STATUSES.has(status)) {
    statusMeaning =
      "Comp Off Used";
  }


  return {
    date: dateKey,

    employeeId:
      getEmployeeCode(employee),

    employeeRecordId:
      employee?.id ?? null,

    employeeName:
      employee?.name ?? null,

    department:
      employee?.department ?? null,

    designation:
      employee?.designation ?? null,

    site:
      employee?.site ??
      employee?.location ??
      null,

    vendor:
      employee?.vendor ?? null,

    employeeType:
      employee?.type ??
      employee?.employeeGroup ??
      null,

    status:
      status || "Unmarked",

    statusMeaning,

    scheduledWeeklyOff,

    weeklyOffWorked,

    coEarned,

    coUsed,

    inTime:
      record.inTime ||
      "",

    outTime:
      record.outTime ||
      "",

    workingHours:
      Number(record.workingHours || 0) || 0,

    otHours:
      Number(record.otHours || 0) || 0,

    remarks:
      record.remarks ||
      "",

    source:
      record.source ||
      "Manual",

    lastUpdatedAt:
      record.lastUpdatedAt ||
      null,
  };
}


// ============================================================
// BUILD COMPLETE ATTENDANCE CONTEXT
// ============================================================

function buildAttendanceContext(
  employees
) {
  const attendance =
    safeReadJSON(
      ATTENDANCE_STORAGE_KEY,
      {}
    );


  const weekOffPolicies =
    loadWeekOffPolicies();


  const employeeList =
    Array.isArray(employees)
      ? employees
      : [];


  /*
   * Map employee IDs in both possible forms:
   *
   * attendance uses employee.id
   * AI queries may use employee.employeeId
   */

  const employeeMap = new Map();

  employeeList.forEach((employee) => {
    if (employee?.id) {
      employeeMap.set(
        String(employee.id),
        employee
      );
    }

    if (employee?.employeeId) {
      employeeMap.set(
        String(employee.employeeId),
        employee
      );
    }

    if (employee?.employeeCode) {
      employeeMap.set(
        String(employee.employeeCode),
        employee
      );
    }
  });


  const records = [];


  /*
   * IMPORTANT:
   * Do NOT only read today's selected employee.
   *
   * Read ALL stored attendance dates.
   */

  Object.entries(attendance || {})
    .forEach(
      ([dateKey, dayRecords]) => {
        if (
          !dayRecords ||
          typeof dayRecords !== "object"
        ) {
          return;
        }


        Object.entries(dayRecords)
          .forEach(
            ([employeeRecordId, rawRecord]) => {
              const employee =
                employeeMap.get(
                  String(employeeRecordId)
                );


              /*
               * If employee master record is not
               * available, still keep the attendance
               * record instead of silently dropping it.
               */

              const fallbackEmployee = employee || {
                id: employeeRecordId,
                employeeId: employeeRecordId,
                name:
                  rawRecord?.employeeName ||
                  null,
                department:
                  rawRecord?.department ||
                  null,
                designation:
                  rawRecord?.designation ||
                  null,
                site:
                  rawRecord?.site ||
                  null,
                vendor:
                  rawRecord?.vendor ||
                  null,
              };


              records.push(
                buildAttendanceRecord({
                  dateKey,
                  employee:
                    fallbackEmployee,
                  rawRecord,
                  weekOffPolicies,
                })
              );
            }
          );
      }
    );


  /*
   * Today is based on the browser's LOCAL date.
   *
   * This avoids UTC date shifting caused by:
   * new Date().toISOString()
   */

  const today =
    getLocalDateKey();


  const todayRecords =
    records.filter(
      (record) =>
        record.date === today
    );


  const summary = {
    date: today,

    totalEmployees:
      employeeList.length,

    recordsFound:
      todayRecords.length,

    present: 0,

    absent: 0,

    leave: 0,

    weeklyOff: 0,

    weeklyOffWorked: 0,

    holiday: 0,

    halfDay: 0,

    late: 0,

    missingPunch: 0,

    coEarned: 0,

    coUsed: 0,

    coBalance: 0,

    workHours: 0,

    otHours: 0,
  };


  todayRecords.forEach(
    (record) => {

      const status =
        String(
          record.status || ""
        ).trim();


      if (
        PRESENT_STATUSES.has(status)
      ) {
        summary.present += 1;
      }


      if (
        HALF_DAY_STATUSES.has(status)
      ) {
        summary.halfDay += 1;
      }


      if (
        ABSENT_STATUSES.has(status)
      ) {
        summary.absent += 1;
      }


      if (
        LEAVE_STATUSES.has(status)
      ) {
        summary.leave += 1;
      }


      if (
        WEEKLY_OFF_STATUSES.has(status)
      ) {
        summary.weeklyOff += 1;
      }


      if (
        HOLIDAY_STATUSES.has(status)
      ) {
        summary.holiday += 1;
      }


      if (record.weeklyOffWorked) {
        summary.weeklyOffWorked += 1;
      }


      summary.coEarned +=
        Number(record.coEarned || 0);


      summary.coUsed +=
        Number(record.coUsed || 0);


      summary.workHours +=
        Number(record.workingHours || 0);


      summary.otHours +=
        Number(record.otHours || 0);


      if (
        record.inTime &&
        record.inTime > "09:30"
      ) {
        summary.late += 1;
      }


      if (
        (
          PRESENT_STATUSES.has(status) ||
          HALF_DAY_STATUSES.has(status)
        ) &&
        (
          !record.inTime ||
          !record.outTime
        )
      ) {
        summary.missingPunch += 1;
      }
    }
  );


  summary.coBalance =
    summary.coEarned -
    summary.coUsed;


  /*
   * Monthly / complete totals
   */

  const totalSummary = {
    present: 0,
    absent: 0,
    leave: 0,
    weeklyOff: 0,
    weeklyOffWorked: 0,
    holiday: 0,
    halfDay: 0,
    coEarned: 0,
    coUsed: 0,
    coBalance: 0,
    workHours: 0,
    otHours: 0,
  };


  records.forEach(
    (record) => {

      const status =
        String(
          record.status || ""
        ).trim();


      if (
        PRESENT_STATUSES.has(status)
      ) {
        totalSummary.present += 1;
      }


      if (
        ABSENT_STATUSES.has(status)
      ) {
        totalSummary.absent += 1;
      }


      if (
        LEAVE_STATUSES.has(status)
      ) {
        totalSummary.leave += 1;
      }


      if (
        WEEKLY_OFF_STATUSES.has(status)
      ) {
        totalSummary.weeklyOff += 1;
      }


      if (record.weeklyOffWorked) {
        totalSummary.weeklyOffWorked += 1;
      }


      if (
        HOLIDAY_STATUSES.has(status)
      ) {
        totalSummary.holiday += 1;
      }


      if (
        HALF_DAY_STATUSES.has(status)
      ) {
        totalSummary.halfDay += 1;
      }


      totalSummary.coEarned +=
        Number(record.coEarned || 0);


      totalSummary.coUsed +=
        Number(record.coUsed || 0);


      totalSummary.workHours +=
        Number(record.workingHours || 0);


      totalSummary.otHours +=
        Number(record.otHours || 0);
    }
  );


  totalSummary.coBalance =
    totalSummary.coEarned -
    totalSummary.coUsed;


  return {
    today,

    summary,

    totalSummary,

    todayRecords,

    /*
     * Keep enough historical records for AI
     * but don't send unlimited browser data.
     */

    records:
      records.slice(-2000),
  };
}


// ============================================================
// COMPLETE AI CONTEXT
// ============================================================

export function buildAIContext({
  user = null,
  module = "Dashboard",
  employees = [],
  attendance = null,
  leave = null,
  payroll = null,
} = {}) {

  const safeEmployees =
    buildSafeEmployees(
      employees
    );


  /*
   * Always rebuild attendance from localStorage.
   *
   * This is the important fix.
   */

  const attendanceContext =
    buildAttendanceContext(
      safeEmployees
    );


  return {
    user: user
      ? {
          id:
            user.id ??
            user.employeeId ??
            null,

          role:
            user.role ??
            null,

          name:
            user.name ??
            user.employeeName ??
            null,

          employeeId:
            user.employeeId ??
            user.code ??
            null,
        }
      : null,

    module,

    employeeCount:
      safeEmployees.length,

    employees:
      safeEmployees,

    attendance:
      attendanceContext,

    leave:
      leave ?? null,

    payroll:
      payroll ?? null,
  };
}


// ============================================================
// FINAL SANITIZER
// ============================================================

export function sanitizeAIContext(
  context = {}
) {
  const safe = {
    module:
      context?.module ||
      "Dashboard",

    employeeCount:
      Number(
        context?.employeeCount
      ) || 0,

    user: null,

    employees: [],

    attendance: null,

    leave: null,

    payroll: null,
  };


  if (context?.user) {
    safe.user = {
      id:
        context.user.id ??
        null,

      role:
        context.user.role ??
        null,

      name:
        context.user.name ??
        null,

      employeeId:
        context.user.employeeId ??
        null,
    };
  }


  if (
    Array.isArray(
      context?.employees
    )
  ) {
    safe.employees =
      context.employees
        .slice(0, 1000)
        .map(
          (employee) => ({
            id:
              employee.id ??
              null,

            employeeId:
              employee.employeeId ??
              null,

            name:
              employee.name ??
              null,

            location:
              employee.location ??
              null,

            employeeGroup:
              employee.employeeGroup ??
              null,

            shift:
              employee.shift ??
              null,

            branch:
              employee.branch ??
              null,

            designation:
              employee.designation ??
              null,

            employmentType:
              employee.employmentType ??
              null,

            department:
              employee.department ??
              null,

            vendor:
              employee.vendor ??
              null,

            jobType:
              employee.jobType ??
              null,

            doj:
              employee.doj ??
              null,

            status:
              employee.status ??
              "Active",
          })
        );
  }


  if (context?.attendance) {

    safe.attendance = {
      today:
        context.attendance.today ??
        null,

      summary:
        context.attendance.summary ??
        null,

      totalSummary:
        context.attendance.totalSummary ??
        null,

      todayRecords:
        Array.isArray(
          context.attendance.todayRecords
        )
          ? context.attendance.todayRecords.slice(
              0,
              1000
            )
          : [],

      records:
        Array.isArray(
          context.attendance.records
        )
          ? context.attendance.records.slice(
              -2000
            )
          : [],
    };
  }


  return safe;
}


// ============================================================
// ASK HRSYNC AI
// ============================================================

export async function askHrsyncAI({
  message,
  context = {},
  signal,
}) {

  const cleanMessage =
    String(
      message || ""
    ).trim();


  if (!cleanMessage) {
    return {
      ok: false,
      message:
        "Please enter a question.",
    };
  }


  /*
   * Rebuild context immediately before every
   * AI request so newly saved Attendance data
   * is always available.
   */

  const freshContext =
    buildAIContext({
      user:
        context?.user ||
        null,

      module:
        context?.module ||
        "Dashboard",

      employees:
        context?.employees ||
        [],

      leave:
        context?.leave ||
        null,

      payroll:
        context?.payroll ||
        null,
    });


  const safeContext =
    sanitizeAIContext(
      freshContext
    );


  try {

    const response =
      await fetch(
        AI_ENDPOINT,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials:
            "include",

          signal,

          body:
            JSON.stringify({
              message:
                cleanMessage,

              context:
                safeContext,

              source:
                "hrsync-web",
            }),
        }
      );


    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }


    if (
      !response.ok ||
      data?.ok === false
    ) {
      return {
        ok: false,

        message:
          data?.message ||
          data?.error ||
          `AI request failed (${response.status})`,

        error:
          data?.error ||
          `HTTP ${response.status}`,
      };
    }


    return {
      ok: true,

      answer:
        data?.answer ||
        data?.message ||
        "I received the request, but no answer was returned.",

      data:
        data?.data ??
        null,

      actions:
        Array.isArray(
          data?.actions
        )
          ? data.actions
          : [],

      citations:
        Array.isArray(
          data?.citations
        )
          ? data.citations
          : [],
    };

  } catch (error) {

    if (
      error?.name ===
      "AbortError"
    ) {
      return {
        ok: false,
        aborted: true,
      };
    }


    console.error(
      "HRSYNC AI request error:",
      error
    );


    return {
      ok: false,

      message:
        "Unable to connect to the HRSYNC AI backend.",

      error:
        error?.message ||
        "Unknown connection error",
    };
  }
}