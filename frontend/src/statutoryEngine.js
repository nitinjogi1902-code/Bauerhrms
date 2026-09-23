/* =========================================================
   BAUER HRMS — Statutory Calculation Engine
   PF + ESI + PT + LWF + Labour Code Wage
   Compatible with existing Payroll.jsx
   ========================================================= */

export const STATUTORY_RULE_VERSION = "2026.05";


/* =========================================================
   COMMON HELPERS
   ========================================================= */

export const roundMoney = (value) => {
  const number = Number(value) || 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

export const roundUpRupee = (value) => {
  const number = Number(value) || 0;
  return Math.ceil(number);
};


/* =========================================================
   ESI CONTRIBUTION PERIOD
   ========================================================= */

export const getContributionPeriod = (monthKey) => {
  const [year, month] = String(monthKey || "")
    .split("-")
    .map(Number);

  if (!year || !month) return null;

  if (month >= 4 && month <= 9) {
    return {
      key: `${year}-APR-SEP`,
      label: `1 Apr ${year} – 30 Sep ${year}`,
      start: `${year}-04-01`,
      end: `${year}-09-30`,
    };
  }

  const startYear = month >= 10 ? year : year - 1;

  return {
    key: `${startYear}-OCT-MAR`,
    label: `1 Oct ${startYear} – 31 Mar ${startYear + 1}`,
    start: `${startYear}-10-01`,
    end: `${startYear + 1}-03-31`,
  };
};


/* =========================================================
   LABOUR CODE WAGE
   Kept separate from PF / ESI wage.
   ========================================================= */

export const calculateLabourCodeWage = (
  structure = {},
  settings = {}
) => {
  const gross = Number(structure.gross || 0);
  const addOns = Number(structure.addOnTotal || 0);
  const remuneration = gross + addOns;

  let excluded = 0;

  if (settings.excludeHra) {
    excluded += Number(structure.hra || 0);
  }

  if (settings.excludeOvertime) {
    excluded += Number(structure.overtime || 0);
  }

  if (settings.excludeBonus) {
    excluded += Number(structure.bonus || 0);
  }

  if (settings.excludeConveyance) {
    excluded += Number(structure.conveyance || 0);
  }

  if (settings.excludeGratuity) {
    excluded += Number(structure.gratuity || 0);
  }

  const listedWage = Math.max(0, remuneration - excluded);
  const exclusionLimit = remuneration * 0.5;
  const excessExclusions = Math.max(
    0,
    excluded - exclusionLimit
  );

  return roundMoney(listedWage + excessExclusions);
};


/* =========================================================
   PF WAGE
   ---------------------------------------------------------
   PF wage basis is configurable from Statutory Configuration.

   Supported values:
     - Basic Only
     - Basic + DA
     - Basic + Special Allowance
     - Basic + DA + Special Allowance
     - Gross

   The engine does NOT hard-code one company rule. Payroll.jsx
   should pass settings.pf.wageBasis from the manual statutory
   configuration.
   ========================================================= */

export const calculatePFWage = (
  structure = {},
  settings = {}
) => {
  const basic = Number(
    structure.basic ??
    structure.basicDA ??
    0
  );

  const da = Number(
    structure.da ??
    structure.dearnessAllowance ??
    0
  );

  const basicDA = Number(
    structure.basicDA ??
    (basic + da)
  );

  const specialAllowance = Number(
    structure.specialAllowance || 0
  );

  const gross = Number(structure.gross || 0);

  const basis = String(
    settings?.wageBasis ||
    "Basic + DA + Special Allowance"
  ).trim().toLowerCase();

  if (basis === "basic only" || basis === "basic") {
    return roundMoney(basic);
  }

  if (basis.includes("basic + special") && !basis.includes("da")) {
    return roundMoney(basic + specialAllowance);
  }

  if (basis.includes("gross")) {
    return roundMoney(gross);
  }

  if (basis.includes("special")) {
    return roundMoney(basicDA + specialAllowance);
  }

  return roundMoney(basicDA);
};


/* =========================================================
   ESI WAGE
   ---------------------------------------------------------
   ESI wage basis is configurable from Statutory Configuration.

   Supported values:
     - Basic Only
     - Basic + DA
     - Basic + Special Allowance
     - Basic + DA + Special Allowance
     - Gross

   This keeps the statutory engine company-configurable while
   preserving the existing ESI calculation flow.
   ========================================================= */

export const calculateESIWage = (
  structure = {},
  settings = {}
) => {
  const basic = Number(
    structure.basic ??
    structure.basicDA ??
    0
  );

  const da = Number(
    structure.da ??
    structure.dearnessAllowance ??
    0
  );

  const basicDA = Number(
    structure.basicDA ??
    (basic + da)
  );

  const specialAllowance = Number(
    structure.specialAllowance || 0
  );

  const gross = Number(structure.gross || 0);

  const basis = String(
    settings?.contributionBasis ||
    "Basic + DA + Special Allowance"
  ).trim().toLowerCase();

  if (basis === "basic only" || basis === "basic") {
    return roundMoney(basic);
  }

  if (basis.includes("basic + special") && !basis.includes("da")) {
    return roundMoney(basic + specialAllowance);
  }

  if (basis.includes("gross")) {
    return roundMoney(gross);
  }

  if (basis.includes("special")) {
    return roundMoney(basicDA + specialAllowance);
  }

  return roundMoney(basicDA);
};


/* =========================================================
   PROFESSIONAL TAX
   =========================================================
   Modes:
     1. State-wise Automatic
     2. Manual

   Backward compatibility:
     "State Slab"  -> treated as "State-wise Automatic"
     "Fixed Amount" -> treated as "Manual"

   PT is calculated on monthly gross salary.

   Config:
     settings.pt.enabled
     settings.pt.state
     settings.pt.mode
     settings.pt.manualAmount

   Maharashtra additionally uses employee gender:
   Male:
      <= 7,500       = 0
      7,501–10,000   = 175
      > 10,000       = 200 (300 in February)

   Female:
      <= 25,000      = 0
      > 25,000       = 200 (300 in February)

   States currently configured here:
      Haryana        = Not applicable
      Delhi          = Not applicable
      Uttar Pradesh  = Not applicable
      Rajasthan      = Not applicable
      Maharashtra    = Maharashtra salary slab
   ========================================================= */

export const calculateProfessionalTax = ({
  employee = {},
  structure = {},
  settings = {},
  payrollMonth = "",
}) => {
  const pt = settings?.pt || {};

  if (!Boolean(pt.enabled)) {
    return {
      enabled: false,
      applicable: false,
      mode: pt.mode || "State-wise Automatic",
      state: pt.state || "",
      wage: roundMoney(Number(structure.gross || 0)),
      amount: 0,
      reason: "Professional Tax disabled",
    };
  }

  const gross = roundMoney(
    Number(structure.gross || 0)
  );

  const state = String(pt.state || "").trim();

  const mode =
    pt.mode === "State Slab"
      ? "State-wise Automatic"
      : pt.mode === "Fixed Amount"
        ? "Manual"
        : (pt.mode || "State-wise Automatic");


  /* -------------------------------------------------------
     MANUAL
     ------------------------------------------------------- */

  if (mode === "Manual") {
    const manualAmount = Math.max(
      0,
      Number(pt.manualAmount || 0)
    );

    return {
      enabled: true,
      applicable: manualAmount > 0,
      mode: "Manual",
      state,
      wage: gross,
      amount: roundMoney(manualAmount),
      reason: "Manual PT amount",
    };
  }


  /* -------------------------------------------------------
     STATE-WISE AUTOMATIC
     ------------------------------------------------------- */

  /* Haryana, Delhi, Uttar Pradesh and Rajasthan:
     No state PT deduction configured in this engine. */

  if (
    state === "Haryana" ||
    state === "Delhi" ||
    state === "Uttar Pradesh" ||
    state === "Rajasthan"
  ) {
    return {
      enabled: true,
      applicable: false,
      mode: "State-wise Automatic",
      state,
      wage: gross,
      amount: 0,
      reason: `${state}: Professional Tax not applicable`,
    };
  }


  /* Maharashtra */

  if (state === "Maharashtra") {
    const gender = String(
      employee.gender ||
      employee.sex ||
      "Male"
    ).toLowerCase();

    const isFemale =
      gender === "female" ||
      gender === "f" ||
      gender === "woman";

    const month = Number(
      String(payrollMonth || "").split("-")[1]
    );

    let amount = 0;

    if (isFemale) {
      if (gross > 25000) {
        amount = month === 2 ? 300 : 200;
      }
    } else {
      if (gross > 10000) {
        amount = month === 2 ? 300 : 200;
      } else if (gross > 7500) {
        amount = 175;
      }
    }

    return {
      enabled: true,
      applicable: amount > 0,
      mode: "State-wise Automatic",
      state,
      wage: gross,
      amount: roundMoney(amount),
      reason:
        amount > 0
          ? "Maharashtra salary slab applied"
          : "Maharashtra PT exemption slab",
    };
  }


  /* -------------------------------------------------------
     STATE NOT CONFIGURED
     ------------------------------------------------------- */

  return {
    enabled: true,
    applicable: false,
    mode: "State-wise Automatic",
    state,
    wage: gross,
    amount: 0,
    reason: "State PT rule is not configured",
  };
};


/* =========================================================
   LABOUR WELFARE FUND (LWF)
   =========================================================
   LWF amount is taken from Statutory Configuration.

   Settings:
     settings.lwf.enabled
     settings.lwf.employeeAmount
     settings.lwf.employerAmount
     settings.lwf.frequency

   Frequency:
     Monthly     -> every month
     Quarterly   -> Mar / Jun / Sep / Dec
     Half-Yearly -> Mar / Sep
     Yearly      -> Mar

   State-specific LWF amounts are NOT hard-coded here.
   The configured amounts remain editable in the LWF card.
   ========================================================= */

export const calculateLWF = ({
  settings = {},
  structure = {},
  payrollMonth = "",
}) => {
  const lwf = settings?.lwf || {};
  const enabled = Boolean(lwf.enabled);

  if (!enabled) {
    return {
      enabled: false,
      applicable: false,
      mode: lwf.mode || "State-wise Automatic",
      state: lwf.state || "",
      frequency: lwf.frequency || "Monthly",
      employee: 0,
      employer: 0,
      reason: "LWF disabled",
    };
  }

  const mode = lwf.mode || "State-wise Automatic";
  const state = lwf.state || "Haryana";

  if (mode === "Manual") {
    const employeeAmount = Math.max(
      0,
      Number(lwf.employeeAmount || 0)
    );

    const employerAmount = Math.max(
      0,
      Number(lwf.employerAmount || 0)
    );

    return {
      enabled: true,
      applicable:
        employeeAmount > 0 ||
        employerAmount > 0,
      mode: "Manual",
      state,
      frequency: lwf.frequency || "Monthly",
      employee: roundMoney(employeeAmount),
      employer: roundMoney(employerAmount),
      reason: "Manual LWF contribution",
    };
  }


  /* Haryana LWF — effective from 01-Jan-2026.
     Employee: 0.2% of salary/wages/remuneration, capped at ₹35/month.
     Employer: twice employee contribution, capped at ₹70/month. */

  if (state === "Haryana") {
    const wage = Math.max(
      0,
      Number(structure.gross || 0)
    );

    const employeeAmount = Math.min(
      wage * 0.002,
      35
    );

    const employerAmount = Math.min(
      employeeAmount * 2,
      70
    );

    return {
      enabled: true,
      applicable:
        employeeAmount > 0 ||
        employerAmount > 0,
      mode: "State-wise Automatic",
      state: "Haryana",
      frequency: "Monthly",
      employee: roundMoney(employeeAmount),
      employer: roundMoney(employerAmount),
      reason:
        "Haryana LWF: 0.2% of salary/wages/remuneration; employee cap ₹35; employer twice employee",
    };
  }

  return {
    enabled: true,
    applicable: false,
    mode: "State-wise Automatic",
    state,
    frequency: "Not configured",
    employee: 0,
    employer: 0,
    reason:
      `${state}: LWF rule is not configured`,
  };
};


/* =========================================================
   COMPLETE STATUTORY CALCULATION
   ========================================================= */

export const getStatutoryCalculation = ({
  employee = {},
  structure = {},
  settings = {},
  payrollMonth,
}) => {
  const period = getContributionPeriod(payrollMonth);


  /* =======================================================
     LABOUR CODE WAGE
     ======================================================= */

  const labourCodeWage =
    calculateLabourCodeWage(
      structure,
      settings?.wageDefinition || {}
    );


  /* =======================================================
     PF
     -------------------------------------------------------
     PF wage basis, employee rate, employer rate, ceiling and
     higher-wage contribution are all taken from the manual
     Statutory Configuration.

     higherWageContribution = true
       -> use full configured PF wage

     higherWageContribution = false
       -> apply configured PF wage ceiling
     ======================================================= */

  const pf = settings?.pf || {};

  const pfEnabled =
    Boolean(pf.enabled) &&
    pf.applicable !== false;

  const pfWage =
    calculatePFWage(structure, pf);

  const pfCeiling = Number(
    pf.wageCeiling ?? 15000
  );

  const pfBase = pfEnabled
    ? Boolean(pf.higherWageContribution) || pfCeiling <= 0
      ? pfWage
      : Math.min(
          pfWage,
          pfCeiling
        )
    : 0;

  const pfEmployee = pfEnabled
    ? roundMoney(
        pfBase *
        (Number(pf.employeeRate || 12) / 100)
      )
    : 0;

  const pfEmployer = pfEnabled
    ? roundMoney(
        pfBase *
        (Number(pf.employerRate || 12) / 100)
      )
    : 0;


  /* =======================================================
     ESI
     ESI Wage = Basic + DA + Special Allowance

     Simple eligibility:
       ESI Wage <= ₹21,000 => Eligible
       ESI Wage >  ₹21,000 => Not Eligible
     ======================================================= */

  const esi = settings?.esi || {};

  const esiEnabled =
    Boolean(esi.enabled);

  const esiCeiling = Number(
    esi.wageCeiling ?? 21000
  );

  const esiWage =
    calculateESIWage(structure, esi);

  const esiCovered =
    Boolean(
      esiEnabled &&
      esiWage <= esiCeiling
    );

  const esiBase =
    esiCovered
      ? esiWage
      : 0;

  const esiEmployeeRaw =
    esiBase *
    (Number(esi.employeeRate || 0.75) / 100);

  const esiEmployerRaw =
    esiBase *
    (Number(esi.employerRate || 3.25) / 100);

  const esiEmployee =
    employee?.esiEmployeeShareExempt
      ? 0
      : esiCovered
        ? roundUpRupee(esiEmployeeRaw)
        : 0;

  const esiEmployer =
    esiCovered
      ? roundUpRupee(esiEmployerRaw)
      : 0;


  /* =======================================================
     PROFESSIONAL TAX
     ======================================================= */

  const pt =
    calculateProfessionalTax({
      employee,
      structure,
      settings,
      payrollMonth,
    });


  /* =======================================================
     LABOUR WELFARE FUND
     ======================================================= */

  const lwf =
    calculateLWF({
      settings,
      structure,
      payrollMonth,
    });


  /* =======================================================
     RETURN
     ======================================================= */

  return {
    ruleVersion:
      STATUTORY_RULE_VERSION,

    payrollMonth:
      payrollMonth || null,

    period,

    labourCodeWage,

    pf: {
      enabled: pfEnabled,
      wage: pfWage,
      wageBasis:
        pf.wageBasis ||
        "Basic + DA + Special Allowance",
      ceiling:
        pfCeiling,
      higherWageContribution:
        Boolean(pf.higherWageContribution),
      base: roundMoney(pfBase),
      employee: pfEmployee,
      employer: pfEmployer,
    },

    esi: {
      enabled: esiEnabled,
      wage: esiWage,
      contributionBasis:
        esi.contributionBasis ||
        "Basic + DA + Special Allowance",
      covered: esiCovered,
      base: roundMoney(esiBase),
      employee: esiEmployee,
      employer: esiEmployer,
      continuedAfterCeiling: false,
      ceiling: esiCeiling,
    },

    pt: {
      enabled: pt.enabled,
      applicable: pt.applicable,
      mode: pt.mode,
      state: pt.state,
      wage: pt.wage,
      amount: pt.amount,
      reason: pt.reason,
    },

    lwf: {
      enabled: lwf.enabled,
      applicable: lwf.applicable,
      frequency: lwf.frequency,
      employee: lwf.employee,
      employer: lwf.employer,
      reason: lwf.reason,
    },
  };
};