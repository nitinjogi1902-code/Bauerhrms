import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

const client = apiKey
  ? new GoogleGenAI({
      apiKey,
    })
  : null;

const MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash";


/* =========================================================
   HRSYNC AI SYSTEM INSTRUCTIONS
========================================================= */

const SYSTEM_INSTRUCTIONS = `
You are HRSYNC AI, an intelligent HRMS copilot.

You assist users with:

- Employee Master
- Attendance
- Leave
- Payroll
- Recruitment
- Training
- PMS
- Vendors
- Organization Masters
- Reports and MIS


IMPORTANT RULES:

1. Respect the user's role and permissions.

2. Never reveal passwords, OTPs, tokens, API keys or secrets.

3. Never expose sensitive financial or statutory data unless the
   user is authorized to access it.

4. Do not invent HRMS data.

5. Use the HRMS data provided in CURRENT HRSYNC CONTEXT.

6. If required data is not available in CURRENT HRSYNC CONTEXT,
   clearly say that the data is currently unavailable.

7. If employee records are present in the employees array,
   use those records to answer employee-related questions.

8. Never create or guess an employee that does not exist in the
   employees array.

9. Only use employee fields actually provided in the context.


=========================================================
ATTENDANCE RULES
=========================================================

Attendance records are provided in:

CURRENT HRSYNC CONTEXT
→ attendance
→ records

Use those records for attendance-related questions.

Valid attendance concepts can include:

- Present
- Absent
- EL
- CL
- SL
- FL
- CO
- OD
- WFH
- WO
- HO
- HD


FORCE LEAVE:

FL means Force Leave.

Force Leave is a separate leave type.

Do not combine FL with EL, CL or SL.


=========================================================
WEEKLY OFF RULE
=========================================================

A scheduled Weekly Off is NOT automatically leave.

If an employee is scheduled for Weekly Off and does not work:

- Attendance remains Weekly Off / WO.

If an employee works on a scheduled Weekly Off:

- Attendance remains Present / Worked.
- It must NOT be classified as leave.
- The employee earns 1 Compensatory Off.
- This creates CO Earned = 1.


IMPORTANT:

Worked Weekly Off
=
Present / Worked
+
CO Earned

Worked Weekly Off
does NOT
=
Leave.


=========================================================
COMP OFF RULE
=========================================================

CO Earned and CO Used are completely separate.

CO EARNED:

CO Earned happens when an employee works on a scheduled
Weekly Off.

Example:

Employee works Sunday Weekly Off.

Attendance:
Present / Worked

CO Earned:
+1


CO USED:

When an employee later takes Comp Off as leave:

CO Used = 1

This is a separate transaction.

Do not confuse CO Earned with CO Used.

Do not convert a historical CO Earned transaction into CO Used.

Do not count CO Used as CO Earned.


CO BALANCE:

CO Balance =
Opening CO
+
CO Earned
-
CO Used


If Opening CO is not available in the context,
do not invent it.

If only current-period CO Earned and CO Used are available,
clearly state that the calculation is based on the available
records.


=========================================================
ATTENDANCE INTELLIGENCE
=========================================================

When answering attendance questions:

- Use actual attendance records.
- Use actual employee names and employee IDs.
- Use actual dates.
- Use actual department/designation when provided.
- Do not invent missing attendance.
- Do not invent punch times.
- Do not invent working hours.
- Do not invent overtime.
- Do not invent leave balances.


Examples of valid questions:

"Who was absent?"

"Who came late?"

"Show attendance of employee TC2605."

"How many employees were present?"

"Who worked on Weekly Off?"

"How much CO was earned?"

"How much CO was used?"

"Show employees who earned Comp Off."

"How many Force Leaves were recorded?"

"Show FL employees."

"Who has missing punches?"

"Who worked overtime?"

"Show attendance exceptions."


=========================================================
EMPLOYEE DATA
=========================================================

The employees array contains the employee records currently
available to you.

employeeCount represents the number of employee records
provided to you.

If the employees array contains the information required to
answer the user's question:

- Use it directly.
- Give the actual employee information.
- Do not say that employee information is unavailable.

Never create or guess an employee.


=========================================================
SENSITIVE DATA
=========================================================

Never reveal:

- passwords
- OTPs
- API keys
- access tokens
- refresh tokens
- PAN
- Aadhaar
- bank account numbers
- IFSC
- CVV
- private keys
- authentication secrets


=========================================================
SENSITIVE HR ACTIONS
=========================================================

For sensitive HR actions such as:

- payroll changes
- salary changes
- leave approval
- employee deletion
- policy changes
- attendance modification
- payroll approval

provide a recommendation, explanation or draft only.

Never pretend that the action was executed.

Human approval is required.


=========================================================
RESPONSE STYLE
=========================================================

Be concise and professional.

For lists:
- Use bullets.

For counts:
- Give the number clearly.

For employee questions:
- Use actual employee records.

For attendance:
- Mention employee and date when available.

For CO:
- Clearly distinguish CO Earned from CO Used.

If required data is unavailable:
- Say so clearly.
- Do not guess.
- Do not fabricate.

ATTENDANCE DATA PRIORITY:

When the user asks about attendance, today's attendance,
monthly attendance, Present, Absent, Leave, Weekly Off,
Worked Weekly Off, Comp Off, Late Coming, Missing Punches,
Work Hours or OT:

1. Treat CURRENT HRSYNC CONTEXT -> attendance as the authoritative
   attendance source.
2. Do NOT describe the source as "dashboard context" when
   attendance data is available.
3. Use attendance.summary for today's numerical summary.
4. Use attendance.records for employee/date-level details.
5. If attendance.summary.recordsFound is greater than 0, say that
   attendance records were found for the requested date.
6. A Present status remains Present even if inTime/outTime are blank.
7. Missing Punch means incomplete punch data; it does NOT mean Absent.
8. If Work Hours are 0 because punches are missing, explain that
   hours could not be calculated from the available punches.
9. Never invent punch times, work hours, overtime, leave or attendance.
10. For "today", use the attendance.today date supplied in context.
11. For employee/date questions, filter attendance.records by the
    actual employeeId, employeeName and date fields supplied.

CO EARNED / CO USED DATA PRIORITY:

- weeklyOffWorked = true means Worked Weekly Off and CO Earned = 1.
- scheduledWeeklyOff may be used as the Weekly Off indicator.
- weeklyOff is also accepted as a Weekly Off indicator.
- status = CO means CO Used; it does not create CO Earned.
- Never count a worked Weekly Off as Leave.

`;


/* =========================================================
   SAFE CONTEXT SANITIZATION
========================================================= */

function sanitizeContext(context = {}) {
  const safe = {
    module:
      context?.module ||
      "Dashboard",

    activeModule:
      context?.activeModule ||
      context?.module ||
      "Dashboard",

    employeeCount:
      Number(context?.employeeCount) || 0,

    user: null,

    employees: [],

    attendance: null,
  };


  /* =======================================================
     USER
  ======================================================= */

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


  /* =======================================================
     EMPLOYEES
  ======================================================= */

  if (Array.isArray(context?.employees)) {
    safe.employees = context.employees
      .slice(0, 200)
      .map((employee) => ({
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
      }));
  }


  /* =======================================================
     ATTENDANCE
  ======================================================= */

  if (context?.attendance) {
    const sourceAttendance =
      context.attendance;


    const sourceSummary =
      sourceAttendance.summary ||
      {};


    safe.attendance = {
      recordCount:
        Number(
          sourceAttendance.recordCount
        ) || 0,


      /* ---------------------------------------------------
         ATTENDANCE SUMMARY
      --------------------------------------------------- */

      summary: {
        present:
          Number(
            sourceSummary.present
          ) || 0,

        absent:
          Number(
            sourceSummary.absent
          ) || 0,

        leave:
          Number(
            sourceSummary.leave
          ) || 0,

        weeklyOff:
          Number(
            sourceSummary.weeklyOff
          ) || 0,

        weeklyOffWorked:
          Number(
            sourceSummary.weeklyOffWorked
          ) || 0,

        coEarned:
          Number(
            sourceSummary.coEarned
          ) || 0,

        coUsed:
          Number(
            sourceSummary.coUsed
          ) || 0,

        coBalance:
          Number(
            sourceSummary.coBalance
          ) || 0,

        late:
          Number(
            sourceSummary.late
          ) || 0,

        missingPunch:
          Number(
            sourceSummary.missingPunch
          ) || 0,

        workHours:
          Number(
            sourceSummary.workHours
          ) || 0,

        otHours:
          Number(
            sourceSummary.otHours
          ) || 0,
      },


      /* ---------------------------------------------------
         ATTENDANCE RECORDS
      --------------------------------------------------- */

      records:
        Array.isArray(
          sourceAttendance.records
        )
          ? sourceAttendance.records
              .slice(0, 500)
              .map((record) => ({
                date:
                  record.date ??
                  null,

                employeeId:
                  record.employeeId ??
                  null,

                employeeName:
                  record.employeeName ??
                  null,

                department:
                  record.department ??
                  null,

                designation:
                  record.designation ??
                  null,

                site:
                  record.site ??
                  null,

                vendor:
                  record.vendor ??
                  null,

                status:
                  record.status ??
                  null,

                statusMeaning:
                  record.statusMeaning ??
                  null,

                weeklyOff:
                  Boolean(
                    record.weeklyOff
                  ),

                weeklyOffWorked:
                  Boolean(
                    record.weeklyOffWorked
                  ),

                coEarned:
                  Number(
                    record.coEarned
                  ) || 0,

                coUsed:
                  Number(
                    record.coUsed
                  ) || 0,

                inTime:
                  record.inTime ??
                  null,

                outTime:
                  record.outTime ??
                  null,

                workingHours:
                  Number(
                    record.workingHours
                  ) || 0,

                otHours:
                  Number(
                    record.otHours
                  ) || 0,

                remarks:
                  record.remarks ??
                  null,

                source:
                  record.source ??
                  "Manual",
              }))
          : [],
    };
  }


  return safe;
}


/* =========================================================
   ASK HRSYNC AI
========================================================= */

export async function askHrsyncAI({
  message,
  context = {},
}) {

  /* =======================================================
     API KEY CHECK
  ======================================================= */

  if (!client) {
    return {
      ok: false,

      message:
        "HRSYNC AI backend is running, but GEMINI_API_KEY is not configured in backend/.env.",
    };
  }


  /* =======================================================
     MESSAGE CHECK
  ======================================================= */

  const cleanMessage =
    String(
      message || ""
    ).trim();


  if (!cleanMessage) {
    return {
      ok: false,
      message:
        "AI message is required.",
    };
  }


  /* =======================================================
     SANITIZE CONTEXT
  ======================================================= */

  const safeContext =
    sanitizeContext(
      context
    );


  /* =======================================================
     AI PROMPT
  ======================================================= */

  const prompt = `
${SYSTEM_INSTRUCTIONS}


=========================================================
USER QUESTION
=========================================================

${cleanMessage}


=========================================================
CURRENT HRSYNC CONTEXT
=========================================================

${JSON.stringify(
  safeContext,
  null,
  2
)}


=========================================================
FINAL ANSWER INSTRUCTIONS
=========================================================

Answer the user's question using ONLY the available
CURRENT HRSYNC CONTEXT and the HRSYNC AI rules.

Do not invent data.

If the user asks about employees:
use the employees array.

If the user asks about attendance:
use attendance.records and attendance.summary.

If the user asks about Weekly Off:
check weeklyOff and weeklyOffWorked.

If weeklyOffWorked is true:

- Attendance = Present / Worked
- CO Earned = 1
- Leave = 0

Never classify weeklyOffWorked as leave.

If the user asks about Comp Off:
   use the actual attendance records and summary provided in context.
   Do not assume CO is 0 when attendance records contain CO Earned/Used data.

Clearly separate:

CO Earned
CO Used
CO Balance

Do not mix them.

If a required field is not available:
say that the required HRMS data is currently unavailable.

Do not expose sensitive information.

Give a concise professional answer.

For today's attendance, report the numerical values from
attendance.summary directly. If recordsFound > 0, do not say
that no attendance records exist.

If Present > 0 but Missing Punches > 0 and Work Hours = 0,
explain that the employee is marked Present but punch timings
are incomplete, so hours could not be calculated.
`;


  /* =======================================================
     GEMINI REQUEST
  ======================================================= */

  try {

    const interaction =
      await client.interactions.create({
        model:
          MODEL,

        input:
          prompt,

        store:
          false,

        generation_config: {
          thinking_level:
            "low",
        },
      });


    /* =====================================================
       RESPONSE
    ===================================================== */

    const answer =
      interaction?.output_text ||
      "I could not generate an answer.";


    return {
      ok: true,

      answer,

      data: {
        employeeCount:
          safeContext.employeeCount,

        employeeRecords:
          safeContext.employees.length,

        attendanceRecords:
          safeContext.attendance
            ?.recordCount || 0,

        attendanceSummary:
          safeContext.attendance
            ?.summary || null,
      },

      actions: [],

      citations: [],
    };


  } catch (error) {

    console.error(
      "Gemini request failed:",
      error
    );


    return {
      ok: false,

      message:
        "HRSYNC AI could not process the request.",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error?.message
          : undefined,
    };
  }
}   