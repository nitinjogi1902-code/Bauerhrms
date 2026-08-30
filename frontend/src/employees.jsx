import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import "./employees.css";

const ORGANIZATION_STORAGE_KEY = "bauerHrmsOrganizationMasters";
const EMPLOYEE_STORAGE_KEY = "bauerHrmsEmployees";
const DOCUMENT_DB_NAME = "bauerHrmsEmployeeDocuments";
const DOCUMENT_STORE = "documents";

const INITIAL_MASTERS = {
  locations: ["Gurgaon HO", "Gurgaon Yard", "NPCIL Hisar", "Chennai Design", "Chennai Yard"],
  employeeGroups: ["Third Party (Associates)", "Staff", "GET", "Consultant", "Expat"],
  shifts: ["General", "B06", "General_B"],
  branches: ["BAUER"],
  designations: ["Engineer", "Senior Engineer", "Assistant Manager", "Manager", "Senior Manager", "AGM", "GM", "VP", "Senior VP"],
  employmentTypes: ["Skilled", "Semi-Skilled", "Unskilled", "Trainee"],
  departments: ["Civil", "Planning", "Execution", "Engineering", "HR & Admin", "Finance", "Procurement", "QA / QC", "Safety"],
  jobRoles: ["BAUER", "Conzept", "AlignPro", "Taurus"],
  jobTypes: ["Full Time", "Part Time"],
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const DOCUMENT_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Passport Photo",
  "Bank Proof / Cancelled Cheque",
  "Address Proof",
  "Educational Certificate",
  "Experience / Relieving Letter",
  "Appointment / Joining Letter",
  "Offer Letter",
  "Medical / Fitness Certificate",
  "Other",
];

const EMPTY_FORM = {
  employeeId: "",
  name: "",
  photo: "",
  fatherName: "",
  dob: "",
  gender: "Male",
  bloodGroup: "",
  mobile: "",
  officialEmail: "",
  personalEmail: "",
  pan: "",
  aadhaar: "",

  highestQualification: "",
  qualificationSpecialization: "",
  qualificationPassingYear: "",
  lastOrganization: "",
  lastDesignation: "",
  lastEmploymentStart: "",
  lastEmploymentEnd: "",

  doj: "",
  location: "",
  employeeGroup: "",
  shift: "",
  branch: "",
  designation: "",
  employmentType: "",
  department: "",
  vendor: "",
  jobType: "",

  currentAddress: "",
  currentState: "",
  currentPinCode: "",
  permanentAddress: "",
  permanentState: "",
  permanentPinCode: "",
  sameAddress: false,

  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankName: "",
  bankBranch: "",

  gratuityCategory: "",
  gratuityApplicable: true,
  gratuityWage: "",
  status: "Active",
  transferHistory: [],
};

function readMasters() {
  try {
    const saved = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
    if (saved) return { ...INITIAL_MASTERS, ...JSON.parse(saved) };
  } catch {}
  return INITIAL_MASTERS;
}

function readEmployees() {
  try {
    const saved = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function getActiveOptions(masters, key) {
  return (masters?.[key] || [])
    .filter((item) => typeof item === "string" || item?.active !== false)
    .map((item) => (typeof item === "string" ? item : item.name))
    .filter(Boolean);
}

function getGratuityCategory(form) {
  if (form.gratuityCategory) return form.gratuityCategory;
  if (form.employeeGroup === "Staff") return "Regular Employee";
  return "Contract Labour / Third Party";
}

function getGratuityRule(category) {
  if (category === "Direct Fixed-Term Employee") {
    return { years: 1, label: "1 year from start of contract" };
  }
  return { years: 5, label: "5 years continuous service" };
}

function calculateGratuity(form) {
  if (!form.doj || !form.gratuityApplicable) {
    return {
      category: getGratuityCategory(form),
      rule: null,
      serviceText: "—",
      eligibilityDate: "—",
      eligible: false,
      status: form.gratuityApplicable ? "Awaiting DOJ" : "Not Applicable",
      amount: 0,
    };
  }

  const doj = new Date(`${form.doj}T00:00:00`);
  if (Number.isNaN(doj.getTime())) {
    return {
      category: getGratuityCategory(form),
      rule: null,
      serviceText: "—",
      eligibilityDate: "—",
      eligible: false,
      status: "Invalid DOJ",
      amount: 0,
    };
  }

  const category = getGratuityCategory(form);
  const rule = getGratuityRule(category);
  const eligibility = new Date(doj);
  eligibility.setFullYear(eligibility.getFullYear() + rule.years);

  const today = new Date();
  const eligible = today >= eligibility;

  let years = today.getFullYear() - doj.getFullYear();
  let months = today.getMonth() - doj.getMonth();
  const days = today.getDate() - doj.getDate();

  if (days < 0) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const wage = Number(form.gratuityWage) || 0;
  const completedYearsForEstimate = Math.max(0, years + (months > 6 ? 1 : 0));
  const amount = Math.min((15 / 26) * wage * completedYearsForEstimate, 2000000);

  return {
    category,
    rule,
    serviceText: `${Math.max(0, years)} Years ${Math.max(0, months)} Months`,
    eligibilityDate: eligibility.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    eligible,
    status: eligible ? "Eligible" : "Not Eligible",
    amount,
  };
}
function calculateEmployeeQuality(employee) {
  const checks = [];

  const addCheck = (name, fields) => {
    const total = fields.length;

    const completed = fields.filter(
      (field) =>
        employee[field] !== undefined &&
        employee[field] !== null &&
        String(employee[field]).trim() !== ""
    ).length;

    checks.push({
      name,
      completed,
      total,
      complete: completed === total,
    });
  };

  addCheck("Personal Details", [
    "employeeId",
    "name",
    "fatherName",
    "dob",
    "gender",
    "mobile",
    "officialEmail",
  ]);

  addCheck("Employment Details", [
    "doj",
    "location",
    "employeeGroup",
    "designation",
    "employmentType",
    "department",
  ]);

  addCheck("Bank Details", [
    "bankAccountName",
    "bankAccountNumber",
    "bankIfsc",
    "bankName",
    "bankBranch",
  ]);

  addCheck("Statutory Details", [
    "pan",
    "aadhaar",
    "uan",
    "esic",
  ]);

  const totalFields = checks.reduce(
    (sum, item) => sum + item.total,
    0
  );

  const completedFields = checks.reduce(
    (sum, item) => sum + item.completed,
    0
  );

  const score = totalFields
    ? Math.round((completedFields / totalFields) * 100)
    : 0;

  return {
    score,
    checks,
  };
}
function formatINR(value) {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function maskAccount(value) {
  const s = String(value || "");
  if (!s) return "—";
  if (s.length <= 4) return "••••";
  return `${"•".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function openDocumentDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DOCUMENT_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCUMENT_STORE)) {
        const store = db.createObjectStore(DOCUMENT_STORE, { keyPath: "id" });
        store.createIndex("employeeId", "employeeId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveDocumentBlob(documentRecord) {
  const db = await openDocumentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCUMENT_STORE, "readwrite");
    tx.objectStore(DOCUMENT_STORE).put(documentRecord);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function getEmployeeDocuments(employeeId) {
  const db = await openDocumentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCUMENT_STORE, "readonly");
    const index = tx.objectStore(DOCUMENT_STORE).index("employeeId");
    const request = index.getAll(employeeId);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || []);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function deleteDocumentBlob(documentId) {
  const db = await openDocumentDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCUMENT_STORE, "readwrite");
    tx.objectStore(DOCUMENT_STORE).delete(documentId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function safeFilePart(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function documentExtension(record) {
  const originalName = String(record.name || "");
  const match = originalName.match(/\.[a-zA-Z0-9]+$/);
  if (match) return match[0].toLowerCase();

  const mimeMap = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };

  return mimeMap[record.mimeType] || "";
}

async function downloadBlob(record, employeeCode, employeeName) {
  const url = URL.createObjectURL(record.blob);

  const code = safeFilePart(employeeCode) || "EMPLOYEE";
  const name = safeFilePart(employeeName) || "Employee";
  const type = safeFilePart(record.type) || "Document";
  const extension = documentExtension(record);

  // Example:
  // BAU001_Rahul_Kumar_PAN_Card.png
  const downloadName = `${code}_${name}_${type}${extension}`;

  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function downloadAllEmployeeDocuments(employeeId, employeeCode, employeeName) {
  const docs = await getEmployeeDocuments(employeeId);

  if (!docs.length) {
    window.alert(`No documents attached for ${employeeName}.`);
    return;
  }

  const zip = new JSZip();

  for (const doc of docs) {
    const code = safeFilePart(employeeCode) || "EMPLOYEE";
    const name = safeFilePart(employeeName) || "Employee";
    const type = safeFilePart(doc.type) || "Document";
    const extension = documentExtension(doc);

    const fileName = `${type}${extension}`;
    const existingNames = Object.keys(zip.files);

    let finalName = fileName;
    let counter = 2;

    while (existingNames.includes(finalName)) {
      finalName = `${type}_${counter}${extension}`;
      counter += 1;
    }

    zip.file(finalName, doc.blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

  const zipUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = zipUrl;
  a.download = `${safeFilePart(employeeCode) || "EMPLOYEE"}_${safeFilePart(employeeName) || "Employee"}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
}


const EMPLOYEE_EXPORT_COLUMNS = [
  ["Employee ID", "employeeId"],
  ["Employee Name", "name"],
  ["Father Name", "fatherName"],
  ["Date of Birth", "dob"],
  ["Gender", "gender"],
  ["Blood Group", "bloodGroup"],
  ["Mobile No.", "mobile"],
  ["Official Email ID", "officialEmail"],
  ["Personal Email ID", "personalEmail"],
  ["PAN Number", "pan"],
  ["Aadhaar Number", "aadhaar"],
  ["Highest Qualification", "highestQualification"],
  ["Qualification / Specialization", "qualificationSpecialization"],
  ["Qualification Passing Year", "qualificationPassingYear"],
  ["Last Organization", "lastOrganization"],
  ["Last Designation", "lastDesignation"],
  ["Last Employment Start Date", "lastEmploymentStart"],
  ["Last Employment End Date", "lastEmploymentEnd"],
  ["Date of Joining", "doj"],
  ["Zone / Location", "location"],
  ["Employee Group", "employeeGroup"],
  ["Shift", "shift"],
  ["Branch Name", "branch"],
  ["Designation", "designation"],
  ["Employment Type", "employmentType"],
  ["Department", "department"],
  ["Vendor / Contractor", "vendor"],
  ["Job Type", "jobType"],
  ["Current Address", "currentAddress"],
  ["Current State", "currentState"],
  ["Current PIN Code", "currentPinCode"],
  ["Permanent Address", "permanentAddress"],
  ["Permanent State", "permanentState"],
  ["Permanent PIN Code", "permanentPinCode"],
  ["Bank Account Name", "bankAccountName"],
  ["Bank Account Number", "bankAccountNumber"],
  ["Bank IFSC Code", "bankIfsc"],
  ["Bank Name", "bankName"],
  ["Bank Branch", "bankBranch"],
  ["Gratuity Category", "gratuityCategory"],
  ["Gratuity Applicable", "gratuityApplicable"],
  ["Applicable Monthly Gratuity Wage", "gratuityWage"],
  ["Gratuity Eligibility Date", "gratuityEligibilityDate"],
  ["Gratuity Status", "gratuityStatus"],
  ["Estimated Gratuity Amount", "estimatedGratuityAmount"],
  ["Status", "status"],
];

const EMPLOYEE_IMPORT_FIELDS = new Map(
  EMPLOYEE_EXPORT_COLUMNS.map(([header, key]) => [header.toLowerCase(), key])
);

function excelDateToISO(value) {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${mm}-${dd}`;
    }
  }

  const text = String(value).trim();
  if (!text) return "";

  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function excelCellText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function buildEmployeeExcelRows(employees) {
  return employees.map((employee) => {
    const gratuity = calculateGratuity(employee);

    return {
      "Employee ID": employee.employeeId || "",
      "Employee Name": employee.name || "",
      "Father Name": employee.fatherName || "",
      "Date of Birth": employee.dob || "",
      "Gender": employee.gender || "",
      "Blood Group": employee.bloodGroup || "",
      "Mobile No.": employee.mobile || "",
      "Official Email ID": employee.officialEmail || "",
      "Personal Email ID": employee.personalEmail || "",
      "PAN Number": employee.pan || "",
      "Aadhaar Number": employee.aadhaar || "",
      "Highest Qualification": employee.highestQualification || "",
      "Qualification / Specialization": employee.qualificationSpecialization || "",
      "Qualification Passing Year": employee.qualificationPassingYear || "",
      "Last Organization": employee.lastOrganization || "",
      "Last Designation": employee.lastDesignation || "",
      "Last Employment Start Date": employee.lastEmploymentStart || "",
      "Last Employment End Date": employee.lastEmploymentEnd || "",
      "Date of Joining": employee.doj || "",
      "Zone / Location": employee.location || "",
      "Employee Group": employee.employeeGroup || "",
      "Shift": employee.shift || "",
      "Branch Name": employee.branch || "",
      "Designation": employee.designation || "",
      "Employment Type": employee.employmentType || "",
      "Department": employee.department || "",
      "Vendor / Contractor": employee.vendor || "",
      "Job Type": employee.jobType || "",
      "Current Address": employee.currentAddress || "",
      "Current State": employee.currentState || "",
      "Current PIN Code": employee.currentPinCode || "",
      "Permanent Address": employee.permanentAddress || "",
      "Permanent State": employee.permanentState || "",
      "Permanent PIN Code": employee.permanentPinCode || "",
      "Bank Account Name": employee.bankAccountName || "",
      "Bank Account Number": employee.bankAccountNumber || "",
      "Bank IFSC Code": employee.bankIfsc || "",
      "Bank Name": employee.bankName || "",
      "Bank Branch": employee.bankBranch || "",
      "Gratuity Category": gratuity.category || "",
      "Gratuity Applicable": employee.gratuityApplicable ? "Yes" : "No",
      "Applicable Monthly Gratuity Wage": employee.gratuityWage || "",
      "Gratuity Eligibility Date": gratuity.eligibilityDate === "—" ? "" : gratuity.eligibilityDate,
      "Gratuity Status": gratuity.status || "",
      "Estimated Gratuity Amount": gratuity.amount || 0,
      "Status": employee.status || "Active",
    };
  });
}

function exportEmployeesToExcel(employees) {
  if (!employees.length) {
    window.alert("There are no employee records to export.");
    return;
  }

  const rows = buildEmployeeExcelRows(employees);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = EMPLOYEE_EXPORT_COLUMNS.map(([header]) => ({
    wch: Math.max(14, Math.min(34, header.length + 4)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employee Master");

  XLSX.writeFile(workbook, `BAUER_Employee_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadEmployeeImportTemplate() {
  const emptyRow = Object.fromEntries(
    EMPLOYEE_EXPORT_COLUMNS.map(([header]) => [header, ""])
  );

  const worksheet = XLSX.utils.json_to_sheet([emptyRow]);
  worksheet["!cols"] = EMPLOYEE_EXPORT_COLUMNS.map(([header]) => ({
    wch: Math.max(14, Math.min(34, header.length + 4)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employee Import");

  XLSX.writeFile(workbook, "BAUER_Employee_Import_Template.xlsx");
}

function normalizeImportedEmployee(row) {
  const normalized = {};

  Object.entries(row).forEach(([header, value]) => {
    const key = EMPLOYEE_IMPORT_FIELDS.get(String(header).trim().toLowerCase());
    if (key) normalized[key] = value;
  });

  const textFields = [
    "employeeId", "name", "fatherName", "gender", "bloodGroup", "mobile",
    "officialEmail", "personalEmail", "pan", "aadhaar",
    "highestQualification", "qualificationSpecialization", "qualificationPassingYear",
    "lastOrganization", "lastDesignation", "lastEmploymentStart", "lastEmploymentEnd",
    "location",
    "employeeGroup", "shift", "branch", "designation", "employmentType",
    "department", "vendor", "jobType", "currentAddress", "currentState",
    "currentPinCode", "permanentAddress", "permanentState",
    "permanentPinCode", "bankAccountName", "bankAccountNumber",
    "bankIfsc", "bankName", "bankBranch", "status",
  ];

  textFields.forEach((key) => {
    normalized[key] = excelCellText(normalized[key]);
  });

  normalized.dob = excelDateToISO(normalized.dob);
  normalized.lastEmploymentStart = excelDateToISO(normalized.lastEmploymentStart);
  normalized.lastEmploymentEnd = excelDateToISO(normalized.lastEmploymentEnd);
  normalized.doj = excelDateToISO(normalized.doj);

  if (normalized.pan) normalized.pan = normalized.pan.toUpperCase();
  if (normalized.aadhaar) normalized.aadhaar = normalized.aadhaar.replace(/\D/g, "");

  normalized.gratuityApplicable =
    String(normalized.gratuityApplicable ?? "Yes").trim().toLowerCase() !== "no";

  normalized.gratuityWage =
    normalized.gratuityWage === "" || normalized.gratuityWage === undefined
      ? ""
      : Number(normalized.gratuityWage) || 0;

  // These are calculated fields. They are deliberately ignored from import.
  delete normalized.gratuityEligibilityDate;
  delete normalized.gratuityStatus;
  delete normalized.estimatedGratuityAmount;

  normalized.gratuityCategory = normalized.gratuityCategory || "";

  return normalized;
}

async function importEmployeesFromExcel(file, employees, saveEmployees) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    throw new Error("The Excel file does not contain a worksheet.");
  }

  const rows = XLSX.utils.sheet_to_json(firstSheet, {
    defval: "",
    raw: true,
  });

  if (!rows.length) {
    throw new Error("The Excel file has no employee rows.");
  }

  const firstHeaders = Object.keys(rows[0]).map((h) => String(h).trim().toLowerCase());
  if (!firstHeaders.includes("employee id") || !firstHeaders.includes("employee name")) {
    throw new Error('The Excel file must contain at least "Employee ID" and "Employee Name" columns.');
  }

  const next = [...employees];
  const errors = [];
  let added = 0;
  let updated = 0;

  rows.forEach((row, index) => {
    const employee = normalizeImportedEmployee(row);
    const rowNumber = index + 2;

    if (!employee.employeeId || !employee.name) {
      errors.push(`Row ${rowNumber}: Employee ID and Employee Name are required.`);
      return;
    }

    if (employee.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(employee.pan)) {
      errors.push(`Row ${rowNumber}: Invalid PAN format for ${employee.employeeId}.`);
      return;
    }

    if (employee.aadhaar && employee.aadhaar.length !== 12) {
      errors.push(`Row ${rowNumber}: Aadhaar must contain 12 digits for ${employee.employeeId}.`);
      return;
    }

    const existingIndex = next.findIndex(
      (item) => item.employeeId.toLowerCase() === employee.employeeId.toLowerCase()
    );

    const merged = {
      ...EMPTY_FORM,
      ...(existingIndex >= 0 ? next[existingIndex] : {}),
      ...employee,
    };

    if (!merged.status) merged.status = "Active";

    if (existingIndex >= 0) {
      merged.id = next[existingIndex].id;
      next[existingIndex] = merged;
      updated += 1;
    } else {
      merged.id = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${index}`;
      next.push(merged);
      added += 1;
    }
  });

  saveEmployees(next);

  return { added, updated, errors };
}

export default function Employees() {
  const [masters, setMasters] = useState(readMasters);
  const [employees, setEmployees] = useState(readEmployees);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [importing, setImporting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewEmployee, setPreviewEmployee] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);

const [transferForm, setTransferForm] = useState({
  toLocation: "",
  transferDate: "",
  reason: "",
  remarks: "",
});
  const [photoPreview, setPhotoPreview] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [documents, setDocuments] = useState([]);
  const [documentType, setDocumentType] = useState("Other");
  const [documentUploading, setDocumentUploading] = useState(false);

  useEffect(() => {
    const refreshMasters = () => setMasters(readMasters());
    const refreshEmployees = () => setEmployees(readEmployees());

    window.addEventListener("bauerHrmsMastersUpdated", refreshMasters);
    window.addEventListener("bauerHrmsEmployeesUpdated", refreshEmployees);
    window.addEventListener("storage", refreshMasters);
    window.addEventListener("storage", refreshEmployees);

    return () => {
      window.removeEventListener("bauerHrmsMastersUpdated", refreshMasters);
      window.removeEventListener("bauerHrmsEmployeesUpdated", refreshEmployees);
      window.removeEventListener("storage", refreshMasters);
      window.removeEventListener("storage", refreshEmployees);
    };
  }, []);

  const saveEmployees = (next) => {
    setEmployees(next);
    localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("bauerHrmsEmployeesUpdated"));
  };

  const updateForm = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "sameAddress" && value) {
        next.permanentAddress = prev.currentAddress;
        next.permanentState = prev.currentState;
        next.permanentPinCode = prev.currentPinCode;
      }

      if (
        prev.sameAddress &&
        ["currentAddress", "currentState", "currentPinCode"].includes(key)
      ) {
        if (key === "currentAddress") next.permanentAddress = value;
        if (key === "currentState") next.permanentState = value;
        if (key === "currentPinCode") next.permanentPinCode = value;
      }

      return next;
    });
  };
  const transferEmployee = (employee, toLocation, transferDate, reason, remarks = "") => {
  if (!employee) return;

  const fromLocation = employee.location || "";

  if (!toLocation) {
    alert("Please select To Location.");
    return false;
  }

  if (!transferDate) {
    alert("Please select Transfer Date.");
    return false;
  }

  if (fromLocation === toLocation) {
    alert("To Location must be different from Current Location.");
    return false;
  }

  // Generate next Transfer Code
const allTransferRecords = employees.flatMap((emp) =>
  Array.isArray(emp.transferHistory)
    ? emp.transferHistory
    : []
);

const lastTransferNumber = allTransferRecords.reduce((max, record) => {
  const match = String(record.transferCode || "").match(/^TRN-(\d+)$/);

  if (!match) return max;

  return Math.max(max, Number(match[1]));
}, 0);

const transferCode = `TRN-${String(lastTransferNumber + 1).padStart(3, "0")}`;

const transferRecord = {
  id: crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}`,

  transferCode,

  date: transferDate,

  fromLocation,

  toLocation: toLocation.trim(),

  reason,

  remarks: remarks.trim(),
};

  const nextEmployees = employees.map((item) => {
    if (item.id !== employee.id) return item;

    return {
      ...item,
      location: toLocation,
      transferHistory: [
        ...(Array.isArray(item.transferHistory)
          ? item.transferHistory
          : []),
        transferRecord,
      ],
    };
  });

  saveEmployees(nextEmployees);

  setPreviewEmployee({
    ...employee,
    location: toLocation,
    transferHistory: [
      ...(Array.isArray(employee.transferHistory)
        ? employee.transferHistory
        : []),
      transferRecord,
    ],
  });

  return true;
};

  const handleExcelImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setImporting(true);
    try {
      const result = await importEmployeesFromExcel(file, employees, saveEmployees);

      const message = [
        `Import completed.`,
        `Added: ${result.added}`,
        `Updated: ${result.updated}`,
        result.errors.length ? `Skipped: ${result.errors.length}` : "",
        result.errors.length ? `\n\n${result.errors.slice(0, 10).join("\n")}` : "",
        result.errors.length > 10 ? `\n...and ${result.errors.length - 10} more errors.` : "",
      ]
        .filter(Boolean)
        .join("\n");

      window.alert(message);
    } catch (error) {
      window.alert(error?.message || "Unable to import the Excel file.");
    } finally {
      setImporting(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDocuments([]);
    setDocumentType("Other");
    setShowModal(true);
  };
  const openPreview = (employee) => {
  setPreviewEmployee(employee);
  };

  const openEdit = async (employee) => {
    setEditingId(employee.id);
    setForm({ ...EMPTY_FORM, ...employee });
    setDocumentType("Other");
    try {
      setDocuments(await getEmployeeDocuments(employee.id));
    } catch {
      setDocuments([]);
    }
    setShowModal(true);
  };

  const saveDocument = async (file) => {
    if (!file || !editingId) {
      if (!editingId) {
        window.alert("Save the employee first, then attach documents.");
      }
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      window.alert("Please keep each document within 10 MB.");
      return;
    }

    setDocumentUploading(true);
    try {
      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${file.name}`,
        employeeId: editingId,
        type: documentType,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date().toISOString(),
        blob: file,
      };

      await saveDocumentBlob(record);
      const next = await getEmployeeDocuments(editingId);
      setDocuments(next);
    } finally {
      setDocumentUploading(false);
    }
  };

  const removeDocument = async (id) => {
    if (!window.confirm("Delete this document permanently?")) return;
    await deleteDocumentBlob(id);
    setDocuments((prev) => prev.filter((item) => item.id !== id));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!form.employeeId.trim() || !form.name.trim()) {
      window.alert("Employee ID and Employee Name are required.");
      return;
    }

    const pan = form.pan.trim().toUpperCase();
    const aadhaar = form.aadhaar.replace(/\D/g, "");

    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      window.alert("Please enter a valid PAN format, e.g. ABCDE1234F.");
      return;
    }

    if (aadhaar && aadhaar.length !== 12) {
      window.alert("Aadhaar should contain 12 digits.");
      return;
    }

    const duplicate = employees.some(
      (item) =>
        item.employeeId.toLowerCase() === form.employeeId.trim().toLowerCase() &&
        item.id !== editingId
    );

    if (duplicate) {
      window.alert("This Employee ID already exists.");
      return;
    }

    const finalForm = {
      ...form,
      employeeId: form.employeeId.trim(),
      name: form.name.trim(),
      pan,
      aadhaar,
      gratuityWage: form.gratuityWage ? Number(form.gratuityWage) : "",
      gratuityCategory: getGratuityCategory(form),
    };

    const employeeId =
      editingId ||
      (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`);

    if (editingId) {
      saveEmployees(
        employees.map((item) =>
          item.id === editingId ? { ...finalForm, id: editingId } : item
        )
      );
    } else {
      saveEmployees([...employees, { ...finalForm, id: employeeId }]);
      setEditingId(employeeId);
    }

    // Save is complete. Keep document handling separate so an IndexedDB/document
    // error cannot block the employee save/update action.
    try {
      const savedDocs = await getEmployeeDocuments(employeeId);
      setDocuments(savedDocs);
    } catch {
      // Employee data has already been saved; document retrieval failure should
      // not prevent closing the form.
      setDocuments([]);
    }

    window.alert(
      editingId
        ? "Employee updated successfully."
        : "Employee saved successfully. You can now edit the employee to attach additional documents."
    );

    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDocuments([]);
  };

  const toggleStatus = (id) => {
    saveEmployees(
      employees.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "Active" ? "Inactive" : "Active",
            }
          : item
      )
    );
  };

  const deleteEmployee = async (id) => {
    const employee = employees.find((item) => item.id === id);
    if (!employee) return;

    if (!window.confirm(`Delete ${employee.name}? This will also remove attached documents.`)) return;

    const docs = await getEmployeeDocuments(id);
    for (const doc of docs) {
      await deleteDocumentBlob(doc.id);
    }

    saveEmployees(employees.filter((item) => item.id !== id));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return employees.filter((item) => {
      const text = [
        item.employeeId,
        item.name,
        item.location,
        item.department,
        item.designation,
        item.vendor,
        item.employeeGroup,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!q || text.includes(q)) &&
        (filterStatus === "ALL" || item.status === filterStatus)
      );
    });
  }, [employees, search, filterStatus]);

  const activeCount = employees.filter((item) => item.status === "Active").length;
  const inactiveCount = employees.filter((item) => item.status === "Inactive").length;

  const organizationFields = [
    ["location", "Zone / Location", "locations"],
    ["employeeGroup", "Employee Group", "employeeGroups"],
    ["shift", "Shift", "shifts"],
    ["branch", "Branch Name", "branches"],
    ["designation", "Designation", "designations"],
    ["employmentType", "Employment Type", "employmentTypes"],
    ["department", "Department", "departments"],
    ["vendor", "Vendor / Contractor", "jobRoles"],
    ["jobType", "Job Type", "jobTypes"],
  ];

  const gratuityPreview = calculateGratuity(form);

  return (
    <section className="employees-page">
      <div className="employees-head">
        <div>
          <div className="eyebrow">WORKFORCE MANAGEMENT</div>
          <h1>Employee Master</h1>
          <p>
            Maintain employee master data used across Attendance, Leave,
            Payroll and HR modules.
          </p>
        </div>
        <button className="primary-btn" onClick={openAdd}>
          ＋ Add Employee
        </button>
      </div>

      <div className="employee-summary">
        <div>
          <span>Total Employees</span>
          <strong>{employees.length}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Inactive</span>
          <strong>{inactiveCount}</strong>
        </div>
        <div>
          <span>Organization Masters</span>
          <strong>Connected</strong>
        </div>
      </div>

      <div className="employee-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Employee ID, name, location, department..."
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <button
          className="secondary-btn"
          onClick={() => {
            setSearch("");
            setFilterStatus("ALL");
          }}
        >
          Reset
        </button>

        <button
          type="button"
          className="secondary-btn excel-action"
          onClick={() => exportEmployeesToExcel(employees)}
          title="Export the currently filtered employee records"
        >
          ↓ Export Excel
        </button>

        <button
          type="button"
          className="secondary-btn excel-action"
          onClick={downloadEmployeeImportTemplate}
          title="Download the standard Employee Master import format"
        >
          ↓ Import Template
        </button>

        <label className="secondary-btn excel-action import-excel-label">
          ↑ Import Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelImport}
            disabled={importing}
          />
        </label>
      </div>

      <div className="employee-table-card">
        <div className="table-title">
          <div>
            <h2>Employee Records</h2>
            <span>{filtered.length} records</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No employee records yet</h3>
            <p>
              Add your first employee. Organization fields will be loaded
              automatically from Organization Masters.
            </p>
            <button className="primary-btn" onClick={openAdd}>
              ＋ Add Employee
            </button>
          </div>
        ) : (
          <div className="employee-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Location</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Group</th>
                  <th>Vendor / Contractor</th>
                  <th>Bank A/C</th>
                  <th>Gratuity</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => {
                  const gratuity = calculateGratuity(item);

                  return (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td><b>{item.employeeId}</b></td>
                      <td><b>{item.name}</b></td>
                      <td>{item.location || "—"}</td>
                      <td>{item.department || "—"}</td>
                      <td>{item.designation || "—"}</td>
                      <td>{item.employeeGroup || "—"}</td>
                      <td>{item.vendor || "—"}</td>
                      <td>{maskAccount(item.bankAccountNumber)}</td>
                      <td>
                        <span className={`gratuity-badge ${gratuity.eligible ? "eligible" : "pending"}`}>
                          {formatINR(gratuity.amount)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${item.status === "Active" ? "active" : "inactive"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-row">
                            <button className="preview-button"onClick={() => openPreview(item)}>Preview
                            </button>
                          <button onClick={() => openEdit(item)}>Edit</button>
                          <button
                            className="docs-button"
                            onClick={() => downloadAllEmployeeDocuments(item.id, item.employeeId, item.name)}
                          >
                            ⇩ Docs
                          </button>
                          <button onClick={() => toggleStatus(item.id)}>
                            {item.status === "Active" ? "Deactivate" : "Activate"}
                          </button>
                          <button className="danger" onClick={() => deleteEmployee(item.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <form className="employee-modal" onSubmit={submit}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">EMPLOYEE MASTER</div>
                <h2>{editingId ? "Edit Employee" : "Add Employee"}</h2>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className="form-section">
              <div className="form-section-title">Personal Details</div>
              <div className="employee-photo-upload">
  <div
  className={`employee-photo-preview ${
    form.photo ? "photo-clickable" : ""
  }`}
  onClick={() => {
    if (form.photo) {
      setPhotoPreview(form.photo);
    }
  }}
>
  {form.photo ? (
    <img src={form.photo} alt="Employee" />
  ) : (
    <span>Photo</span>
  )}
</div>

  <div className="employee-photo-controls">
    <label className="photo-upload-button">
      Upload Photo
      <input
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (!file) return;

          if (file.size > 5 * 1024 * 1024) {
            alert("Photo size must be less than 5 MB.");
            e.target.value = "";
            return;
          }

          const reader = new FileReader();

          reader.onload = () => {
            updateForm("photo", reader.result);
          };

          reader.readAsDataURL(file);
          e.target.value = "";
        }}
      />
    </label>

    {form.photo && (
      <button
        type="button"
        className="remove-photo-button"
        onClick={() => updateForm("photo", "")}
      >
        Remove Photo
      </button>
    )}

    <small>
      JPG / PNG • Maximum 5 MB
    </small>
  </div>
</div>
              <div className="form-grid">
                <label>Employee ID *
                  <input value={form.employeeId} onChange={(e) => updateForm("employeeId", e.target.value)} placeholder="e.g. BAU001" />
                </label>
                <label>Employee Name *
                  <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Full name" />
                </label>
                <label>Father Name
                  <input value={form.fatherName} onChange={(e) => updateForm("fatherName", e.target.value)} />
                </label>
                <label>Date of Birth
                  <input type="date" value={form.dob} onChange={(e) => updateForm("dob", e.target.value)} />
                </label>
                <label>Gender
                  <select value={form.gender} onChange={(e) => updateForm("gender", e.target.value)}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </label>
                <label>Blood Group
                  <select value={form.bloodGroup} onChange={(e) => updateForm("bloodGroup", e.target.value)}>
                    <option value="">Select Blood Group</option>
                    {BLOOD_GROUPS.map((group) => <option key={group}>{group}</option>)}
                  </select>
                </label>
                <label>Mobile No.
                  <input inputMode="numeric" value={form.mobile} onChange={(e) => updateForm("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digit mobile" />
                </label>
                <label>Official Email ID
                  <input type="email" value={form.officialEmail} onChange={(e) => updateForm("officialEmail", e.target.value)} />
                </label>
                <label>Personal Email ID
                  <input type="email" value={form.personalEmail} onChange={(e) => updateForm("personalEmail", e.target.value)} />
                </label>
                <label>PAN Number
                  <input value={form.pan} maxLength="10" onChange={(e) => updateForm("pan", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="ABCDE1234F" />
                </label>
                <label>Aadhaar Number
                  <input inputMode="numeric" value={form.aadhaar} maxLength="12" onChange={(e) => updateForm("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="12 digit Aadhaar" />
                </label>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Education & Previous Organization Details</div>
              <div className="form-grid">
                <label>Highest Qualification
                  <input
                    value={form.highestQualification}
                    onChange={(e) => updateForm("highestQualification", e.target.value)}
                    placeholder="e.g. B.Tech Civil Engineering"
                  />
                </label>

                <label>Qualification / Specialization
                  <input
                    value={form.qualificationSpecialization}
                    onChange={(e) => updateForm("qualificationSpecialization", e.target.value)}
                    placeholder="e.g. Civil Engineering"
                  />
                </label>

                <label>Qualification Passing Year
                  <input
                    inputMode="numeric"
                    maxLength="4"
                    value={form.qualificationPassingYear}
                    onChange={(e) => updateForm("qualificationPassingYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="e.g. 2022"
                  />
                </label>

                <label>Last Organization
                  <input
                    value={form.lastOrganization}
                    onChange={(e) => updateForm("lastOrganization", e.target.value)}
                    placeholder="Previous employer"
                  />
                </label>

                <label>Last Designation
                  <input
                    value={form.lastDesignation}
                    onChange={(e) => updateForm("lastDesignation", e.target.value)}
                    placeholder="Previous designation"
                  />
                </label>

                <label>Last Employment Start Date
                  <input
                    type="date"
                    value={form.lastEmploymentStart}
                    onChange={(e) => updateForm("lastEmploymentStart", e.target.value)}
                  />
                </label>

                <label>Last Employment End Date
                  <input
                    type="date"
                    value={form.lastEmploymentEnd}
                    onChange={(e) => updateForm("lastEmploymentEnd", e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Employment Details</div>
              <div className="form-grid">
                <label>Date of Joining
                  <input type="date" value={form.doj} onChange={(e) => updateForm("doj", e.target.value)} />
                </label>
                {organizationFields.map(([key, label, masterKey]) => (
                  <label key={key}>
                    {label}
                    <select value={form[key]} onChange={(e) => updateForm(key, e.target.value)}>
                      <option value="">Select {label}</option>
                      {getActiveOptions(masters, masterKey).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Bank Account Details</div>
              <div className="form-grid">
                <label>Account Holder Name
                  <input value={form.bankAccountName} onChange={(e) => updateForm("bankAccountName", e.target.value)} />
                </label>
                <label>Bank Account Number
                  <input inputMode="numeric" value={form.bankAccountNumber} onChange={(e) => updateForm("bankAccountNumber", e.target.value.replace(/\D/g, "").slice(0, 20))} />
                </label>
                <label>IFSC Code
                  <input maxLength="11" value={form.bankIfsc} onChange={(e) => updateForm("bankIfsc", e.target.value.toUpperCase().slice(0, 11))} placeholder="e.g. HDFC0001234" />
                </label>
                <label>Bank Name
                  <input value={form.bankName} onChange={(e) => updateForm("bankName", e.target.value)} />
                </label>
                <label>Bank Branch
                  <input value={form.bankBranch} onChange={(e) => updateForm("bankBranch", e.target.value)} />
                </label>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Address Details</div>
              <div className="form-grid address-grid">
                <label className="wide-field">Current Address
                  <textarea value={form.currentAddress} onChange={(e) => updateForm("currentAddress", e.target.value)} />
                </label>
                <label>Current State
                  <input value={form.currentState} onChange={(e) => updateForm("currentState", e.target.value)} />
                </label>
                <label>Current PIN Code
                  <input inputMode="numeric" maxLength="6" value={form.currentPinCode} onChange={(e) => updateForm("currentPinCode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
                </label>
                <label className="same-address-check">
                  <span>Address Option</span>
                  <span>
                    <input type="checkbox" checked={form.sameAddress} onChange={(e) => updateForm("sameAddress", e.target.checked)} />{" "}
                    Permanent address same as current
                  </span>
                </label>
                <label className="wide-field">Permanent Address
                  <textarea value={form.permanentAddress} onChange={(e) => updateForm("permanentAddress", e.target.value)} disabled={form.sameAddress} />
                </label>
                <label>Permanent State
                  <input value={form.permanentState} onChange={(e) => updateForm("permanentState", e.target.value)} disabled={form.sameAddress} />
                </label>
                <label>Permanent PIN Code
                  <input inputMode="numeric" maxLength="6" value={form.permanentPinCode} onChange={(e) => updateForm("permanentPinCode", e.target.value.replace(/\D/g, "").slice(0, 6))} disabled={form.sameAddress} />
                </label>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Gratuity Details</div>

              <div className="gratuity-info">
                <div><span>Category</span><strong>{gratuityPreview.category}</strong></div>
                <div><span>Eligibility Rule</span><strong>{gratuityPreview.rule?.label || "Enter DOJ"}</strong></div>
                <div><span>Eligibility Date</span><strong>{gratuityPreview.eligibilityDate}</strong></div>
                <div><span>Current Status</span><strong className={gratuityPreview.eligible ? "green-text" : "orange-text"}>{gratuityPreview.status}</strong></div>
              </div>

              <div className="form-grid">
                <label>Gratuity Category
                  <select value={form.gratuityCategory} onChange={(e) => updateForm("gratuityCategory", e.target.value)}>
                    <option value="">Auto from employee group</option>
                    <option>Regular Employee</option>
                    <option>Contract Labour / Third Party</option>
                    <option>Direct Fixed-Term Employee</option>
                  </select>
                </label>
                <label>Gratuity Applicable
                  <select value={String(form.gratuityApplicable)} onChange={(e) => updateForm("gratuityApplicable", e.target.value === "true")}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <label>Applicable Monthly Wage
                  <input type="number" min="0" value={form.gratuityWage} onChange={(e) => updateForm("gratuityWage", e.target.value)} placeholder="Payroll-linked later" />
                </label>
                <div className="gratuity-amount-box"><span>Estimated Gratuity Amount</span><strong>{formatINR(gratuityPreview.amount)}</strong></div>
              </div>

              <div className="gratuity-note">
                Estimated statutory gratuity is calculated using the configured gratuity rule and applicable wage.
                Final payable gratuity will be calculated in Payroll / Full & Final Settlement.
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Employee Documents & Audit File</div>

              {!editingId ? (
                <div className="document-save-first">
                  <strong>Save the employee first.</strong>
                  <span>After saving, you can attach and download documents for audit purposes.</span>
                </div>
              ) : (
                <>
                  <div className="document-upload-row">
                    <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                      {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
                    </select>

                    <label className="upload-button">
                      ＋ Attach Document
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) saveDocument(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="document-help">
                    Maximum <b>10 MB per document</b>. Recommended: PDF/JPG/PNG.
                    Documents are stored against this employee and can be downloaded later.
                  </div>

                  {documentUploading && <div className="document-help">Uploading document…</div>}

                  <div className="documents-list">
                    {documents.length === 0 ? (
                      <div className="no-documents">No documents attached yet.</div>
                    ) : (
                      documents.map((doc) => (
                        <div className="document-row" key={doc.id}>
                          <div className="document-info">
                            <span className="document-icon">📄</span>
                            <div>
                              <strong>{doc.name}</strong>
                              <small>{doc.type} · {(doc.size / 1024).toFixed(1)} KB</small>
                            </div>
                          </div>
                          <div className="document-actions">
                            <button type="button" onClick={() => downloadBlob(doc, form.employeeId, form.name)}>Download</button>
                            <button type="button" className="danger" onClick={() => removeDocument(doc.id)}>Delete</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="form-section">
              <div className="form-section-title">Employee Status</div>
              <div className="form-grid single-status">
                <label>Status
                  <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="modal-note">
              <b>Organization connection:</b> Location, Employee Group, Shift, Branch,
              Designation, Employment Type, Department, Vendor and Job Type are loaded
              from active Organization Masters.
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Close</button>
              <button type="submit" className="primary-btn">
                {editingId ? "Update Employee" : "Save Employee"}
              </button>
            </div>
          </form>
        </div>
      )}
            {/* EMPLOYEE PROFILE PREVIEW */}
      {previewEmployee && (
        <div
          className="employee-profile-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewEmployee(null);
            }
          }}
        >
          <div className="employee-profile-modal">

            {/* HEADER */}
            <div className="employee-profile-header">
              <div className="employee-profile-identity">

                <div
                  className={`employee-profile-photo ${
                    previewEmployee.photo ? "photo-clickable" : ""
                  }`}
                  onClick={() => {
                    if (previewEmployee.photo) {
                      setPhotoPreview(previewEmployee.photo);
                    }
                  }}
                >
                  {previewEmployee.photo ? (
                    <img
                      src={previewEmployee.photo}
                      alt={previewEmployee.name || "Employee"}
                    />
                  ) : (
                    <span>
                      {(previewEmployee.name || "E")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="employee-profile-heading">
                  <div className="employee-profile-id">
                    {previewEmployee.employeeId || "—"}
                  </div>

                  <h2>{previewEmployee.name || "—"}</h2>

                  <div className="employee-profile-designation">
                    {previewEmployee.designation || "—"}
                  </div>

                  <div className="employee-profile-meta">
                    <span>🏢 {previewEmployee.department || "—"}</span>
                    <span>📍 {previewEmployee.location || "—"}</span>
                    <span>📅 DOJ: {previewEmployee.doj || "—"}</span>
                  </div>
                </div>

              </div>

              <div className="employee-profile-header-right">

                <span
                  className={`status-badge ${
                    previewEmployee.status === "Active"
                      ? "active"
                      : "inactive"
                  }`}
                >
                  {previewEmployee.status || "Active"}
                </span>

                <button
                  type="button"
                  className="employee-profile-close"
                  onClick={() => setPreviewEmployee(null)}
                >
                  ×
                </button>

              </div>
            </div>

            {/* QUICK SUMMARY */}
            <div className="employee-profile-summary">

              <div>
                <small>Employee Type</small>
                <strong>{previewEmployee.employmentType || "—"}</strong>
              </div>

              <div>
                <small>Employee Group</small>
                <strong>{previewEmployee.employeeGroup || "—"}</strong>
              </div>

              <div>
                <small>Job Type</small>
                <strong>{previewEmployee.jobType || "—"}</strong>
              </div>

              <div>
                <small>Vendor / Contractor</small>
                <strong>{previewEmployee.vendor || "—"}</strong>
              </div>

            </div>

            {/* PROFILE OVERVIEW */}
            <div className="employee-profile-section">

              <div className="employee-profile-section-title">
                Profile Overview
              </div>

              <div className="employee-profile-grid">

                <div>
                  <span>Employee ID</span>
                  <strong>{previewEmployee.employeeId || "—"}</strong>
                </div>

                <div>
                  <span>Employee Name</span>
                  <strong>{previewEmployee.name || "—"}</strong>
                </div>

                <div>
                  <span>Department</span>
                  <strong>{previewEmployee.department || "—"}</strong>
                </div>

                <div>
                  <span>Designation</span>
                  <strong>{previewEmployee.designation || "—"}</strong>
                </div>

                <div>
                  <span>Location</span>
                  <strong>{previewEmployee.location || "—"}</strong>
                </div>

                <div>
                  <span>Branch</span>
                  <strong>{previewEmployee.branch || "—"}</strong>
                </div>

                <div>
                  <span>Shift</span>
                  <strong>{previewEmployee.shift || "—"}</strong>
                </div>

                <div>
                  <span>Employment Type</span>
                  <strong>{previewEmployee.employmentType || "—"}</strong>
                </div>

              </div>

            </div>

            {/* ACTIONS */}
<div className="employee-profile-actions">

  <button
    type="button"
    onClick={() => {
      const employee = previewEmployee;
      setPreviewEmployee(null);
      openEdit(employee);
    }}
  >
    ✎ Edit Profile
  </button>

<button
  type="button"
  onClick={() => {
    setTransferForm({
      toLocation: "",
      transferDate: new Date().toISOString().split("T")[0],
      reason: "",
      remarks: "",
    });

    setShowTransferModal(true);
  }}
>
  ⇄ Transfer Employee
</button>
  <button
    type="button"
    onClick={() => setPreviewEmployee(null)}
  >
    Close
  </button>

</div>


{/* ================= HR DATA QUALITY CHECK ================= */}

{previewEmployee && (() => {
  const quality = calculateEmployeeQuality(previewEmployee);

  return (
    <div className="employee-profile-section quality-check-section">

      <div className="employee-profile-section-title">
        HR Data Quality Check
      </div>

      <div className="quality-check-header">

        <div className="quality-score">
          <strong>{quality.score}%</strong>
          <span>Overall Data Quality</span>
        </div>

        <div className="quality-summary">
          {quality.score >= 90
            ? "Excellent"
            : quality.score >= 70
            ? "Good — Some information needs attention"
            : "Attention Required"}
        </div>

      </div>

      <div className="quality-check-list">

        {quality.checks.map((check) => (
          <div
            className={`quality-check-item ${
              check.complete
                ? "quality-complete"
                : "quality-warning"
            }`}
            key={check.name}
          >

            <div className="quality-check-icon">
              {check.complete ? "✓" : "!"}
            </div>

            <div className="quality-check-name">
              {check.name}
            </div>

            <div className="quality-check-progress">
              {check.completed}/{check.total}
            </div>

            <div className="quality-check-status">
              {check.complete ? "Complete" : "Attention"}
            </div>

          </div>
        ))}

      </div>

    </div>
  );
})()}


{/* ================= TRANSFER HISTORY ================= */}

{previewEmployee && (
  <div className="employee-profile-section transfer-history-section">

    <div className="employee-profile-section-title">
      Transfer History
    </div>

    <div className="transfer-current-card">

      <div>
        <span>Current Location</span>
        <strong>
          {previewEmployee.location || "—"}
        </strong>
      </div>

      <div>
        <span>Total Transfers</span>
        <strong>
          {Array.isArray(previewEmployee.transferHistory)
            ? previewEmployee.transferHistory.length
            : 0}
        </strong>
      </div>

      <div>
        <span>Current Status</span>
        <strong>
          {previewEmployee.status || "Active"}
        </strong>
      </div>

    </div>


    {Array.isArray(previewEmployee.transferHistory) &&
    previewEmployee.transferHistory.length > 0 ? (

      <div className="transfer-history-list">

        {previewEmployee.transferHistory
          .slice()
          .reverse()
          .map((transfer, index) => (

            <div
              className="transfer-history-item"
              key={index}
            >

             <div className="transfer-history-date">
  <span>Transfer ID</span>
  <strong>
    {transfer.transferCode || "—"}
  </strong>
</div>

<div className="transfer-history-date">
  <span>Date</span>
  <strong>
    {transfer.date || "—"}
  </strong>
</div>

              <div className="transfer-history-route">

                <div>
                  <span>From</span>
                  <strong>
                    {transfer.fromLocation || "—"}
                  </strong>
                </div>

                <div className="transfer-arrow">
                  →
                </div>

                <div>
                  <span>To</span>
                  <strong>
                    {transfer.toLocation || "—"}
                  </strong>
                </div>

              </div>


              <div className="transfer-history-reason">

                <span>Reason</span>

                <strong>
                  {transfer.reason || "—"}
                </strong>

              </div>

            </div>

          ))}

      </div>

    ) : (

      <div className="no-transfer-history">
        No transfer history available for this employee.
      </div>

    )}

  </div>
)}


{/* CLOSE EMPLOYEE PROFILE MODAL */}

</div>
</div>
)}
            {/* PHOTO PREVIEW POPUP */}
      {photoPreview && (
        <div
          className="photo-preview-overlay"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="photo-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="photo-preview-close"
              onClick={() => setPhotoPreview(null)}
            >
              ×
            </button>

            <img
              src={photoPreview}
              alt="Employee Preview"
              className="photo-preview-large"
            />
          </div>
        </div>
      )}
      {/* ================= TRANSFER EMPLOYEE MODAL ================= */}

{showTransferModal && previewEmployee && (
  <div
    className="transfer-modal-backdrop"
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) {
        setShowTransferModal(false);
      }
    }}
  >
    <div className="transfer-modal">

      {/* Header */}
      <div className="transfer-modal-header">
        <div>
          <div className="transfer-modal-eyebrow">
            EMPLOYEE MASTER
          </div>

          <h2>Transfer Employee</h2>

          <p>
            Transfer employee to a new location and maintain transfer history.
          </p>
        </div>

        <button
          type="button"
          className="transfer-modal-close"
          onClick={() => setShowTransferModal(false)}
        >
          ×
        </button>
      </div>


      {/* Employee Information */}
      <div className="transfer-employee-info">

        <div className="transfer-info-item">
          <span>Employee ID</span>
          <strong>
            {previewEmployee.employeeId || "—"}
          </strong>
        </div>

        <div className="transfer-info-item">
          <span>Employee Name</span>
          <strong>
            {previewEmployee.name || "—"}
          </strong>
        </div>

        <div className="transfer-info-item">
          <span>Current Location</span>
          <strong>
            {previewEmployee.location || "—"}
          </strong>
        </div>

      </div>


      {/* Transfer Form */}
      <form
        className="transfer-form"
        onSubmit={(e) => {
          e.preventDefault();

          const success = transferEmployee(
            previewEmployee,
            transferForm.toLocation,
            transferForm.transferDate,
            transferForm.reason,
            transferForm.remarks
          );

          if (success) {
            setShowTransferModal(false);
          }
        }}
      >

        <div className="transfer-form-grid">

          {/* Transfer Date */}
          <div className="transfer-field">
            <label>
              Transfer Date <span>*</span>
            </label>

            <input
              type="date"
              value={transferForm.transferDate}
              onChange={(e) =>
                setTransferForm((prev) => ({
                  ...prev,
                  transferDate: e.target.value,
                }))
              }
              required
            />
          </div>


          {/* To Location */}
          <div className="transfer-field">
            <label>
              To Location <span>*</span>
            </label>

           <select
  value={transferForm.toLocation}
  onChange={(e) =>
    setTransferForm((prev) => ({
      ...prev,
      toLocation: e.target.value,
    }))
  }
  required
>
  <option value="">Select Location</option>

  {(masters.locations || [])
    .filter((location) => {
      const locationName =
        typeof location === "string"
          ? location
          : location.name || location.locationName || "";

      return (
        locationName &&
        locationName.toLowerCase() !==
          String(previewEmployee.location || "").toLowerCase()
      );
    })
    .map((location, index) => {
      const locationName =
        typeof location === "string"
          ? location
          : location.name || location.locationName || "";

      return (
        <option key={location.id || index} value={locationName}>
          {locationName}
        </option>
      );
    })}
</select>
          </div>


          {/* Reason */}
          <div className="transfer-field">
            <label>
              Transfer Reason <span>*</span>
            </label>

            <select
              value={transferForm.reason}
              onChange={(e) =>
                setTransferForm((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              required
            >
              <option value="">Select Reason</option>
              <option value="Business Requirement">
                Business Requirement
              </option>
              <option value="Project Allocation">
                Project Allocation
              </option>
              <option value="Employee Request">
                Employee Request
              </option>
              <option value="Management Decision">
                Management Decision
              </option>
              <option value="Other">
                Other
              </option>
            </select>
          </div>

        </div>


        {/* Remarks */}
        <div className="transfer-field transfer-remarks">
          <label>Remarks</label>

          <textarea
            rows="4"
            placeholder="Enter remarks (optional)"
            value={transferForm.remarks}
            onChange={(e) =>
              setTransferForm((prev) => ({
                ...prev,
                remarks: e.target.value,
              }))
            }
          />
        </div>


        {/* Footer */}
        <div className="transfer-modal-footer">

          <button
            type="button"
            className="transfer-cancel-btn"
            onClick={() => setShowTransferModal(false)}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="transfer-submit-btn"
          >
            ⇄ Submit Transfer
          </button>

        </div>

      </form>

    </div>
  </div>
)}
      {/* DATA QUALITY CHECK */}
{previewEmployee && (() => {
  const quality = calculateEmployeeQuality(previewEmployee);

  return (
    <div className="employee-profile-section quality-check-section">

      <div className="employee-profile-section-title">
        HR Data Quality Check
      </div>

      <div className="quality-check-header">
        <div className="quality-score">
          <strong>{quality.score}%</strong>
          <span>Overall Data Quality</span>
        </div>

        <div className="quality-summary">
          {quality.score >= 90
            ? "Excellent"
            : quality.score >= 70
            ? "Good — Some information needs attention"
            : "Attention Required"}
        </div>
      </div>

      <div className="quality-check-list">
        {quality.checks.map((check) => (
          <div
            className={`quality-check-item ${
              check.complete ? "quality-complete" : "quality-warning"
            }`}
            key={check.name}
          >
            <div className="quality-check-icon">
              {check.complete ? "✓" : "!"}
            </div>

            <div className="quality-check-name">
              {check.name}
            </div>

            <div className="quality-check-progress">
              {check.completed}/{check.total}
            </div>

            <div className="quality-check-status">
              {check.complete ? "Complete" : "Attention"}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
})()}
{/* TRANSFER HISTORY */}
{previewEmployee && (
  <div className="employee-profile-section transfer-history-section">

    <div className="employee-profile-section-title">
      Transfer History
    </div>

    <div className="transfer-current-card">
      <div>
        <span>Current Location</span>
        <strong>{previewEmployee.location || "—"}</strong>
      </div>

      <div>
        <span>Total Transfers</span>
        <strong>
          {Array.isArray(previewEmployee.transferHistory)
            ? previewEmployee.transferHistory.length
            : 0}
        </strong>
      </div>

      <div>
        <span>Current Status</span>
        <strong>{previewEmployee.status || "Active"}</strong>
      </div>
    </div>

    {Array.isArray(previewEmployee.transferHistory) &&
    previewEmployee.transferHistory.length > 0 ? (
      <div className="transfer-history-list">

        {previewEmployee.transferHistory
          .slice()
          .reverse()
          .map((transfer, index) => (
            <div className="transfer-history-item" key={index}>

              <div className="transfer-history-date">
  <span>Transfer ID</span>
  <strong>
    {transfer.transferCode || "—"}
  </strong>
</div>

<div className="transfer-history-date">
  <span>Date</span>
  <strong>
    {transfer.date || "—"}
  </strong>
</div>

              <div className="transfer-history-route">
                <div>
                  <span>From</span>
                  <strong>{transfer.fromLocation || "—"}</strong>
                </div>

                <div className="transfer-arrow">
                  →
                </div>

                <div>
                  <span>To</span>
                  <strong>{transfer.toLocation || "—"}</strong>
                </div>
              </div>

              <div className="transfer-history-reason">
                <span>Reason</span>
                <strong>{transfer.reason || "—"}</strong>
              </div>

            </div>
          ))}

      </div>
    ) : (
      <div className="no-transfer-history">
        No transfer history available for this employee.
      </div>
    )}

  </div>
)}
    </section>
  );
}