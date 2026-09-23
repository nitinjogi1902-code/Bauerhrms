import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
const FORCE_LEAVE_STORAGE_KEY = "bauerHrmsForceLeaveRecords";

const EMPTY_FORCE_LEAVE = {
  id: "",
  forceLeaveId: "",
  employeeId: "",
  employeeName: "",
  employeeType: "",
  vendor: "",
  department: "",
  designation: "",
  currentSite: "",
  flStartDate: "",
  tentativeRejoiningDate: "",
  actualRejoiningDate: "",
  reason: "",
  remarks: "",
  status: "Active",
  salaryTreatment: "",
  payrollMonth: "",
  rejoiningSite: "",
  transferRequired: false,
  transferId: "",
  transferDate: "",
  createdAt: "",
  updatedAt: "",
};

function readForceLeaveRecords() {
  try {
    const saved = localStorage.getItem(FORCE_LEAVE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Unable to read Force Leave records:", error);
    return [];
  }
}

function saveForceLeaveRecords(records) {
  localStorage.setItem(
    FORCE_LEAVE_STORAGE_KEY,
    JSON.stringify(records)
  );

  window.dispatchEvent(
    new Event("bauerHrmsForceLeaveUpdated")
  );
}

function generateForceLeaveId(records) {
  const lastNumber = records.reduce((max, record) => {
    const match = String(record?.forceLeaveId || "").match(
      /^FL-(\d+)$/
    );

    if (!match) return max;

    return Math.max(max, Number(match[1]));
  }, 0);

  return `FL-${String(lastNumber + 1).padStart(4, "0")}`;
}

function getAttendanceForceLeaveStartDate(employee) {
  try {
    const saved = localStorage.getItem("hrms_attendance");
    if (!saved) return "";

    const attendance = JSON.parse(saved);
    if (!attendance || typeof attendance !== "object") return "";

    const employeeKeys = new Set(
      [
        employee?.id,
        employee?.employeeId,
        employee?.employeeCode,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())
    );

    const flDates = Object.entries(attendance)
      .filter(([date, day]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return false;
        const record =
          day && typeof day === "object"
            ? Object.entries(day).find(([key]) =>
                employeeKeys.has(String(key).trim())
              )?.[1]
            : null;
        return String(record?.status || "").trim().toUpperCase() === "FL";
      })
      .map(([date]) => date)
      .sort();

    if (!flDates.length) return "";

    // Use the latest FL period. Walk backwards through consecutive FL dates
    // so the start date represents the beginning of the current FL spell.
    let startDate = flDates[flDates.length - 1];
    const flSet = new Set(flDates);
    const cursor = new Date(`${startDate}T00:00:00`);

    while (true) {
      cursor.setDate(cursor.getDate() - 1);
      const previousDate = cursor.toISOString().slice(0, 10);
      if (!flSet.has(previousDate)) break;
      startDate = previousDate;
    }

    return startDate;
  } catch (error) {
    console.error("Unable to read Force Leave attendance status:", error);
    return "";
  }
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}


async function transferEmployeeForForceLeave(
  record,
  toLocation,
  transferDate,
  remarks = ""
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!user?.id) {
    throw new Error(
      "Your HRSYNC session has expired. Please log in again."
    );
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("organization_users")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .maybeSingle();

  if (membershipError) throw membershipError;

  if (!membership?.organization_id) {
    throw new Error(
      "No active company is linked to your HRSYNC account."
    );
  }

  const organizationId = membership.organization_id;

  const { data: employeeRow, error: employeeError } =
    await supabase
      .from("employees")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("employee_id", record.employeeId)
      .maybeSingle();

  if (employeeError) throw employeeError;

  if (!employeeRow) {
    throw new Error(
      `Employee ${record.employeeId} was not found in Employee Master.`
    );
  }

  const fromLocation =
    employeeRow.location ||
    record.currentSite ||
    "";

  if (!toLocation || !toLocation.trim()) {
    throw new Error("Please select Rejoining Site.");
  }

  if (
    fromLocation.trim().toLowerCase() ===
    toLocation.trim().toLowerCase()
  ) {
    throw new Error(
      "New Site must be different from the current site."
    );
  }

  const { data: allEmployees, error: allEmployeesError } =
    await supabase
      .from("employees")
      .select("metadata")
      .eq("organization_id", organizationId);

  if (allEmployeesError) throw allEmployeesError;

  let lastTransferNumber = 0;

  (allEmployees || []).forEach((item) => {
    const metadata =
      item?.metadata &&
      typeof item.metadata === "object"
        ? item.metadata
        : {};

    const history = Array.isArray(
      metadata.transferHistory
    )
      ? metadata.transferHistory
      : [];

    history.forEach((transfer) => {
      const match = String(
        transfer?.transferCode || ""
      ).match(/^TRN-(\d+)$/);

      if (match) {
        lastTransferNumber = Math.max(
          lastTransferNumber,
          Number(match[1])
        );
      }
    });
  });

  const transferCode = `TRN-${String(
    lastTransferNumber + 1
  ).padStart(3, "0")}`;

  const transferRecord = {
    id:
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}`,
    transferCode,
    date: transferDate,
    fromLocation,
    toLocation: toLocation.trim(),
    reason: "Force Leave Rejoining",
    remarks: String(remarks || "").trim(),
  };

  const oldMetadata =
    employeeRow?.metadata &&
    typeof employeeRow.metadata === "object"
      ? employeeRow.metadata
      : {};

  const existingHistory = Array.isArray(
    oldMetadata.transferHistory
  )
    ? oldMetadata.transferHistory
    : [];

  const newMetadata = {
    ...oldMetadata,
    location: toLocation.trim(),
    transferHistory: [
      ...existingHistory,
      transferRecord,
    ],
  };

  const { error: updateError } = await supabase
    .from("employees")
    .update({
      location: toLocation.trim(),
      metadata: newMetadata,
    })
    .eq("id", employeeRow.id)
    .eq("organization_id", organizationId);

  if (updateError) throw updateError;

  try {
    const cached =
      localStorage.getItem("bauerHrmsEmployees");

    if (cached) {
      const employees = JSON.parse(cached);

      if (Array.isArray(employees)) {
        const updatedEmployees = employees.map(
          (employee) => {
            const sameEmployee =
              String(
                employee?.employeeId ||
                  employee?.id ||
                  ""
              ) === String(record.employeeId);

            if (!sameEmployee) return employee;

            return {
              ...employee,
              location: toLocation.trim(),
              transferHistory: [
                ...(Array.isArray(
                  employee.transferHistory
                )
                  ? employee.transferHistory
                  : []),
                transferRecord,
              ],
            };
          }
        );

        localStorage.setItem(
          "bauerHrmsEmployees",
          JSON.stringify(updatedEmployees)
        );

        window.dispatchEvent(
          new Event("bauerHrmsEmployeesUpdated")
        );
      }
    }
  } catch (cacheError) {
    console.warn(
      "Employee cache could not be refreshed:",
      cacheError
    );
  }

  return {
    transferCode,
    transferRecord,
  };
}

export default function ForceLeave({ employees: dashboardEmployees = [], currentUser = null }) {
  const [employees, setEmployees] = useState(dashboardEmployees);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState("");
  const [records, setRecords] = useState(readForceLeaveRecords);

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState(EMPTY_FORCE_LEAVE);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [attendanceFLDate, setAttendanceFLDate] = useState("");

  const [editingRecordId, setEditingRecordId] = useState("");
  const [showRejoinForm, setShowRejoinForm] = useState(false);
  const [rejoinRecord, setRejoinRecord] = useState(null);
  const [rejoiningSites, setRejoiningSites] = useState([]);
  const [rejoinForm, setRejoinForm] = useState({
    actualRejoiningDate: "",
    rejoiningSite: "",
    rejoiningType: "Same Site",
    remarks: "",
  });

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();

    if (!search) {
      return employees;
    }

    return employees.filter((employee) => {
      const employeeId = String(
        employee.employeeId ||
          employee.employeeCode ||
          employee.id ||
          ""
      ).toLowerCase();

      const employeeName = String(
        employee.name || ""
      ).toLowerCase();

      return (
        employeeId.includes(search) ||
        employeeName.includes(search)
      );
    });
  }, [employees, employeeSearch]);

  const activeRecords = useMemo(
    () =>
      records.filter(
        (record) => record.status === "Active"
      ),
    [records]
  );

  useEffect(() => {
    let cancelled = false;

    const loadForceLeaveEmployees = async () => {
      setEmployeeLoading(true);
      setEmployeeError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user?.id) {
          throw new Error(
            "Your HRSYNC session has expired. Please log in again."
          );
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("organization_users")
            .select("id, organization_id, employee_id, status")
            .eq("user_id", user.id)
            .eq("status", "Active")
            .maybeSingle();

        if (membershipError) throw membershipError;

        if (!membership?.organization_id) {
          throw new Error(
            "No active company is linked to your HRSYNC account."
          );
        }

        const { data: rows, error: employeeQueryError } =
          await supabase
            .from("employees")
            .select("*")
            .eq("organization_id", membership.organization_id)
            .order("employee_name", { ascending: true });

        if (employeeQueryError) throw employeeQueryError;

        const dashboardEmployeeMap = new Map(
          (dashboardEmployees || []).map((item) => [
            String(
              item?.employeeId ||
                item?.employeeCode ||
                item?.id ||
                ""
            ).trim(),
            item,
          ])
        );

        const loadedEmployees = (rows || []).map((row) => {
          const metadata =
            row?.metadata && typeof row.metadata === "object"
              ? row.metadata
              : {};

          const employeeId = String(
            row?.employee_id ||
              metadata.employeeId ||
              ""
          ).trim();

          const dashboardEmployee =
            dashboardEmployeeMap.get(employeeId) || {};

          const employeeType =
            row?.employment_type ||
            metadata.employmentType ||
            metadata.employeeType ||
            dashboardEmployee.employmentType ||
            dashboardEmployee.employeeType ||
            dashboardEmployee.type ||
            dashboardEmployee.employeeGroup ||
            "";

          return {
            ...dashboardEmployee,
            ...metadata,
            id: row?.id || dashboardEmployee.id || "",
            organizationId:
              row?.organization_id ||
              dashboardEmployee.organizationId ||
              "",
            employeeId,
            name:
              row?.employee_name ||
              metadata.name ||
              dashboardEmployee.name ||
              dashboardEmployee.employeeName ||
              "",
            department:
              row?.department ||
              metadata.department ||
              metadata.departmentName ||
              dashboardEmployee.department ||
              dashboardEmployee.departmentName ||
              "",
            designation:
              row?.designation ||
              metadata.designation ||
              dashboardEmployee.designation ||
              "",
            location:
              row?.location ||
              metadata.location ||
              metadata.site ||
              dashboardEmployee.location ||
              dashboardEmployee.site ||
              "",
            employmentType: employeeType,
            employeeType,
            employeeGroup:
              metadata.employeeGroup ||
              dashboardEmployee.employeeGroup ||
              "",
            vendor:
              metadata.vendor ||
              metadata.vendorName ||
              dashboardEmployee.vendor ||
              dashboardEmployee.vendorName ||
              "",
            currentSite:
              metadata.currentSite ||
              metadata.site ||
              dashboardEmployee.currentSite ||
              dashboardEmployee.site ||
              row?.location ||
              "",
            status:
              row?.status ||
              metadata.status ||
              dashboardEmployee.status ||
              "Active",
          };
        });

        if (!cancelled) {
          setEmployees(loadedEmployees);
        }
      } catch (error) {
        console.error(
          "Unable to load Force Leave employees:",
          error
        );

        if (!cancelled) {
          setEmployees(dashboardEmployees || []);
          setEmployeeError(
            error?.message ||
              "Unable to load employee records."
          );
        }
      } finally {
        if (!cancelled) {
          setEmployeeLoading(false);
        }
      }
    };

    loadForceLeaveEmployees();

    return () => {
      cancelled = true;
    };
  }, [dashboardEmployees]);

  useEffect(() => {
    const loadRejoiningSites = () => {
      try {
        const names = new Map();

        const organizationRaw = localStorage.getItem(
          "bauerHrmsOrganizationMasters"
        );

        if (organizationRaw) {
          const organizationMasters = JSON.parse(
            organizationRaw
          );

          const locations = Array.isArray(
            organizationMasters?.locations
          )
            ? organizationMasters.locations
            : [];

          locations.forEach((site) => {
            if (site?.active === false) return;

            const name = String(site?.name || "").trim();

            if (name) {
              names.set(name.toLowerCase(), name);
            }
          });
        }

        const sitesRaw = localStorage.getItem(
          "bauerHrmsSites"
        );

        if (sitesRaw) {
          const sites = JSON.parse(sitesRaw);

          if (Array.isArray(sites)) {
            sites.forEach((site) => {
              if (
                site?.status &&
                String(site.status).toLowerCase() !== "active"
              ) {
                return;
              }

              const name = String(
                site?.name || ""
              ).trim();

              if (name) {
                names.set(name.toLowerCase(), name);
              }
            });
          }
        }

        setRejoiningSites(
          Array.from(names.values()).sort(
            (a, b) => a.localeCompare(b)
          )
        );
      } catch (error) {
        console.error(
          "Unable to load site master:",
          error
        );

        setRejoiningSites([]);
      }
    };

    loadRejoiningSites();

    window.addEventListener(
      "storage",
      loadRejoiningSites
    );

    window.addEventListener(
      "bauerHrmsSitesUpdated",
      loadRejoiningSites
    );

    return () => {
      window.removeEventListener(
        "storage",
        loadRejoiningSites
      );

      window.removeEventListener(
        "bauerHrmsSitesUpdated",
        loadRejoiningSites
      );
    };
  }, []);

  useEffect(() => {
    const refreshAttendanceFLDate = () => {
      if (!form.employeeId) {
        setAttendanceFLDate("");
        return;
      }

      const employee = employees.find(
        (item) =>
          String(
            item?.employeeId ||
              item?.employeeCode ||
              item?.id ||
              ""
          ).trim() === String(form.employeeId).trim()
      );

      const detectedDate = getAttendanceForceLeaveStartDate(employee);
      setAttendanceFLDate(detectedDate);
    };

    refreshAttendanceFLDate();
    window.addEventListener("storage", refreshAttendanceFLDate);
    window.addEventListener("bauerHrmsAttendanceUpdated", refreshAttendanceFLDate);

    return () => {
      window.removeEventListener("storage", refreshAttendanceFLDate);
      window.removeEventListener("bauerHrmsAttendanceUpdated", refreshAttendanceFLDate);
    };
  }, [employees, form.employeeId]);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleEmployeeChange = (employeeId) => {
    const employee = employees.find(
      (item) =>
        String(
          item.employeeId ||
            item.employeeCode ||
            item.id ||
            ""
        ) === String(employeeId)
    );

    if (!employee) {
      setForm((previous) => ({
        ...previous,
        employeeId,
        employeeName: "",
        employeeType: "",
        vendor: "",
        department: "",
        designation: "",
        currentSite: "",
        salaryTreatment: "",
      }));

      return;
    }

    const employeeType =
      employee.employeeType ||
      employee.employmentType ||
      employee.employeeGroup ||
      employee.type ||
      "";

    const normalizedType = String(employeeType)
      .trim()
      .toLowerCase();

    const isThirdParty =
      normalizedType.includes("third") ||
      normalizedType.includes("third-party") ||
      normalizedType.includes("contract");

    const salaryTreatment =
      isThirdParty ? "Salary Hold" : "Paid";

    const detectedFLDate = getAttendanceForceLeaveStartDate(employee);
    setAttendanceFLDate(detectedFLDate);

    setForm((previous) => ({
      ...previous,
      employeeId:
        employee.employeeId ||
        employee.employeeCode ||
        employee.id ||
        "",
      employeeName: employee.name || "",
      employeeType,
      vendor:
        employee.vendor ||
        employee.vendorName ||
        "",
      department:
        employee.department ||
        employee.departmentName ||
        "",
      designation: employee.designation || "",
      currentSite:
        employee.currentSite ||
        employee.location ||
        employee.site ||
        "",
      salaryTreatment,
      flStartDate: detectedFLDate || previous.flStartDate || "",
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORCE_LEAVE);
    setAttendanceFLDate("");
    setEmployeeSearch("");
    setEmployeeDropdownOpen(false);
    setEditingRecordId("");
    setShowForm(false);
  };

  const startEdit = (record) => {
    setEditingRecordId(record.id);
    setForm({
      ...EMPTY_FORCE_LEAVE,
      ...record,
    });
    setAttendanceFLDate(
      getAttendanceForceLeaveStartDate({
        id: record.employeeId,
        employeeId: record.employeeId,
        employeeCode: record.employeeId,
      })
    );
    setEmployeeSearch("");
    setEmployeeDropdownOpen(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openRejoin = (record) => {
    const today = new Date().toISOString().slice(0, 10);

    setRejoinRecord(record);
    setRejoinForm({
      actualRejoiningDate: today,
      rejoiningSite: record.rejoiningSite || record.currentSite || "",
      rejoiningType: "Same Site",
      remarks: "",
    });
    setShowRejoinForm(true);
  };

  const closeRejoin = () => {
    setShowRejoinForm(false);
    setRejoinRecord(null);
    setRejoinForm({
      actualRejoiningDate: "",
      rejoiningSite: "",
      rejoiningType: "Same Site",
      remarks: "",
    });
  };

  const saveRejoining = async () => {
    if (!rejoinRecord) return;

    if (!rejoinForm.actualRejoiningDate) {
      alert("Please select Actual Rejoining Date.");
      return;
    }

    if (!rejoinForm.rejoiningSite.trim()) {
      alert("Please select Rejoining Site.");
      return;
    }

    if (
      rejoinRecord.flStartDate &&
      rejoinForm.actualRejoiningDate <
        rejoinRecord.flStartDate
    ) {
      alert(
        "Actual Rejoining Date cannot be before Force Leave Start Date."
      );
      return;
    }

    if (
      rejoinForm.rejoiningType === "New Site" &&
      rejoinForm.rejoiningSite.trim().toLowerCase() ===
        String(
          rejoinRecord.currentSite || ""
        ).trim().toLowerCase()
    ) {
      alert(
        "New Site must be different from Current Site."
      );
      return;
    }

    const now = new Date().toISOString();
    let transferResult = null;

    try {
      if (rejoinForm.rejoiningType === "New Site") {
        transferResult =
          await transferEmployeeForForceLeave(
            rejoinRecord,
            rejoinForm.rejoiningSite,
            rejoinForm.actualRejoiningDate,
            rejoinForm.remarks
          );
      }

      const updatedRecords = records.map(
        (record) =>
          record.id === rejoinRecord.id
            ? {
                ...record,
                status: "Rejoined",
                actualRejoiningDate:
                  rejoinForm.actualRejoiningDate,
                rejoiningSite:
                  rejoinForm.rejoiningSite.trim(),
                transferRequired:
                  rejoinForm.rejoiningType ===
                  "New Site",
                transferId:
                  transferResult?.transferCode ||
                  record.transferId ||
                  "",
                transferDate:
                  rejoinForm.rejoiningType ===
                  "New Site"
                    ? rejoinForm.actualRejoiningDate
                    : "",
                remarks: [
                  record.remarks || "",
                  rejoinForm.remarks.trim()
                    ? `Rejoining: ${rejoinForm.remarks.trim()}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" | "),
                updatedAt: now,
              }
            : record
      );

      saveForceLeaveRecords(updatedRecords);
      setRecords(updatedRecords);
      closeRejoin();

      alert(
        `Employee rejoined successfully.\n\nForce Leave ID: ${
          rejoinRecord.forceLeaveId
        }${
          transferResult
            ? `\nTransfer ID: ${transferResult.transferCode}`
            : ""
        }`
      );
    } catch (error) {
      console.error(
        "Unable to complete Force Leave rejoining:",
        error
      );

      alert(
        error?.message ||
          "Unable to complete rejoining. The Force Leave record was not closed."
      );
    }
  };

  const cancelForceLeave = (record) => {
    if (record.status !== "Active") {
      return;
    }

    if (
      !window.confirm(
        `Cancel Force Leave ${record.forceLeaveId} for ${record.employeeName}?\n\nThe record will remain in history with status Cancelled.`
      )
    ) {
      return;
    }

    const now = new Date().toISOString();

    const updatedRecords = records.map((item) =>
      item.id === record.id
        ? {
            ...item,
            status: "Cancelled",
            updatedAt: now,
          }
        : item
    );

    saveForceLeaveRecords(updatedRecords);
    setRecords(updatedRecords);
  };

  const createForceLeave = () => {
    if (!form.employeeId) {
      alert("Please select an employee.");
      return;
    }

    if (!form.flStartDate) {
      alert("Please select Force Leave Start Date.");
      return;
    }

    if (!form.tentativeRejoiningDate) {
      alert("Please enter Tentative Rejoining Date.");
      return;
    }

    if (
      form.tentativeRejoiningDate <
      form.flStartDate
    ) {
      alert(
        "Tentative Rejoining Date cannot be before Force Leave Start Date."
      );
      return;
    }

    if (!form.reason.trim()) {
      alert("Please enter Force Leave Reason.");
      return;
    }

    const now = new Date().toISOString();

    if (editingRecordId) {
      const updatedRecords = records.map((record) =>
        record.id === editingRecordId
          ? {
              ...record,
              ...form,
              id: record.id,
              forceLeaveId: record.forceLeaveId,
              status:
                record.status === "Cancelled"
                  ? "Active"
                  : record.status,
              updatedAt: now,
            }
          : record
      );

      saveForceLeaveRecords(updatedRecords);
      setRecords(updatedRecords);
      resetForm();

      alert(
        "Force Leave record updated successfully."
      );
      return;
    }

    const newRecord = {
      ...form,

      id:
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}`,

      forceLeaveId: generateForceLeaveId(records),

      status: "Active",

      actualRejoiningDate: "",

      rejoiningSite: "",

      transferRequired: false,

      transferId: "",

      transferDate: "",

      createdAt: now,

      updatedAt: now,
    };

    const nextRecords = [...records, newRecord];

    saveForceLeaveRecords(nextRecords);

    setRecords(nextRecords);

    resetForm();

    alert(
      `Force Leave created successfully.\n\nForce Leave ID: ${newRecord.forceLeaveId}`
    );
  };

  const clearTestData = () => {
    if (
      !window.confirm(
        "Delete all Force Leave records stored in this browser?"
      )
    ) {
      return;
    }

    localStorage.removeItem(
      FORCE_LEAVE_STORAGE_KEY
    );

    setRecords([]);

    window.dispatchEvent(
      new Event("bauerHrmsForceLeaveUpdated")
    );
  };

  return (
    <div
      style={{
        padding: "24px",
        background: "#f8f9ff",
        minHeight: "100%",
      }}
    >
      <style>{`
        .fl-label {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 6px;
        }

        .fl-field,
        .fl-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #fff;
          color: #172554;
          font-size: 13px;
          padding: 9px 11px;
          outline: none;
        }

        .fl-field:focus,
        .fl-textarea:focus {
          border-color: #a5b4fc;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.08);
        }

        .fl-field::placeholder,
        .fl-textarea::placeholder {
          color: #94a3b8;
        }

        .fl-readonly {
          background: #fafbfc;
          color: #64748b;
        }

        .fl-trigger {
          width: 100%;
          min-height: 38px;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #fff;
          color: #64748b;
          padding: 9px 11px;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
        }

        .fl-trigger:hover {
          border-color: #cbd5e1;
        }

        .fl-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 50;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.10);
          overflow: hidden;
        }

        .fl-search-wrap {
          padding: 8px;
          background: #fff;
          border-bottom: 1px solid #f1f5f9;
        }

        .fl-search {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #fff;
          color: #172554;
          padding: 8px 10px;
          font-size: 13px;
          outline: none;
        }

        .fl-search:focus {
          border-color: #a5b4fc;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.08);
        }

        .fl-option {
          display: block;
          width: 100%;
          border: none;
          border-bottom: 1px solid #f8fafc;
          background: #fff;
          padding: 9px 11px;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
        }

        .fl-option:hover {
          background: #f8f9ff;
        }

        .fl-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(220px, 1fr));
          gap: 16px;
        }

        @media (max-width: 900px) {
          .fl-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: "#172554",
              fontSize: "28px",
            }}
          >
            Force Leave Management
          </h1>

          <p
            style={{
              marginTop: "6px",
              color: "#64748b",
            }}
          >
            Manage employee Force Leave, rejoining and
            salary treatment.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              padding: "11px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + Create Force Leave
          </button>

          <button
            type="button"
            onClick={clearTestData}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#475569",
              padding: "11px 16px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Clear Records
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "18px",
          }}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Total Force Leave
          </div>

          <strong
            style={{
              fontSize: "26px",
              color: "#172554",
            }}
          >
            {records.length}
          </strong>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "18px",
          }}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Active Force Leave
          </div>

          <strong
            style={{
              fontSize: "26px",
              color: "#dc2626",
            }}
          >
            {activeRecords.length}
          </strong>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "18px",
          }}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Rejoined
          </div>

          <strong
            style={{
              fontSize: "26px",
              color: "#16a34a",
            }}
          >
            {
              records.filter(
                (record) =>
                  record.status === "Rejoined"
              ).length
            }
          </strong>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "22px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#172554",
                fontSize: "20px",
              }}
            >
              {editingRecordId
                ? "Edit Force Leave"
                : "Create Force Leave"}
            </h2>

            <button
              type="button"
              onClick={resetForm}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "20px",
              }}
            >
              ×
            </button>
          </div>

          <div className="fl-form-grid">
            <div>
              <label className="fl-label">Employee *</label>

              <div
                style={{
                  position: "relative",
                }}
              >
                <button
                  type="button"
                  className="fl-trigger"
                  onClick={() =>
                    setEmployeeDropdownOpen(
                      (previous) => !previous
                    )
                  }
                >
                  {form.employeeId
                    ? `${form.employeeId} - ${form.employeeName}`
                    : employeeLoading
                      ? "Loading employees..."
                      : "Select Employee"}
                  <span
                    style={{
                      float: "right",
                      color: "#64748b",
                    }}
                  >
                    ▾
                  </span>
                </button>

                {employeeDropdownOpen && (
                  <div className="fl-dropdown">
                    <div className="fl-search-wrap">
                      <input
                        type="text"
                        autoFocus
                        value={employeeSearch}
                        onChange={(event) =>
                          setEmployeeSearch(event.target.value)
                        }
                        placeholder="Search Employee Code or Name"
                        className="fl-search"
                      />
                    </div>

                    <div
                      style={{
                        maxHeight: "190px",
                        overflowY: "auto",
                      }}
                    >
                      {employeeLoading ? (
                        <div
                          style={{
                            padding: "12px",
                            color: "#64748b",
                            fontSize: "13px",
                          }}
                        >
                          Loading employees...
                        </div>
                      ) : filteredEmployees.length ===
                        0 ? (
                        <div
                          style={{
                            padding: "12px",
                            color: "#64748b",
                            fontSize: "13px",
                          }}
                        >
                          No employee found.
                        </div>
                      ) : (
                        filteredEmployees.map(
                          (employee) => {
                            const employeeId =
                              employee.employeeId ||
                              employee.employeeCode ||
                              employee.id ||
                              "";

                            return (
                              <button
                                type="button"
                                key={employeeId}
                                onClick={() => {
                                  handleEmployeeChange(
                                    employeeId
                                  );
                                  setEmployeeSearch("");
                                  setEmployeeDropdownOpen(
                                    false
                                  );
                                }}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  border: "none",
                                  borderBottom:
                                    "1px solid #f1f5f9",
                                  background:
                                    form.employeeId ===
                                    employeeId
                                      ? "#eef2ff"
                                      : "#fff",
                                  padding:
                                    "10px 12px",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                <strong
                                  style={{
                                    color: "#172554",
                                  }}
                                >
                                  {employeeId}
                                </strong>

                                <span
                                  style={{
                                    color: "#475569",
                                    marginLeft: "8px",
                                  }}
                                >
                                  {employee.name ||
                                    "Unnamed Employee"}
                                </span>
                              </button>
                            );
                          }
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              {employeeError && (
                <div
                  style={{
                    color: "#dc2626",
                    fontSize: "12px",
                    marginTop: "5px",
                  }}
                >
                  {employeeError}
                </div>
              )}
            </div>

            <div>
              <label className="fl-label">Employee Type</label>

              <input
                value={form.employeeType}
                readOnly
                placeholder="Auto populated"
                className="fl-field fl-readonly"
              />
            </div>

            <div>
              <label className="fl-label">Vendor</label>

              <input
                value={form.vendor}
                readOnly
                placeholder="Auto populated"
                className="fl-field fl-readonly"
              />
            </div>

            <div>
              <label className="fl-label">Department</label>

              <input
                value={form.department}
                readOnly
                placeholder="Auto populated"
                className="fl-field fl-readonly"
              />
            </div>

            <div>
              <label className="fl-label">Designation</label>

              <input
                value={form.designation}
                readOnly
                placeholder="Auto populated"
                className="fl-field fl-readonly"
              />
            </div>

            <div>
              <label className="fl-label">Current Site</label>

              <input
                value={form.currentSite}
                readOnly
                placeholder="Auto populated"
                className="fl-field fl-readonly"
              />
            </div>

            <div>
              <label className="fl-label">FL Start Date *</label>

              <input
                type="date"
                value={form.flStartDate}
                onChange={(event) =>
                  updateField(
                    "flStartDate",
                    event.target.value
                  )
                }
                className="fl-field"
              />

              <div
                style={{
                  marginTop: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  minHeight: "18px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    color: attendanceFLDate ? "#64748b" : "#94a3b8",
                  }}
                >
                  {attendanceFLDate
                    ? `Attendance FL: ${formatShortDate(attendanceFLDate)}`
                    : "No FL marked in Attendance — enter date manually"}
                </span>

                {attendanceFLDate && form.flStartDate !== attendanceFLDate ? (
                  <button
                    type="button"
                    onClick={() => updateField("flStartDate", attendanceFLDate)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#4f46e5",
                      fontSize: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Use Attendance Date
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label className="fl-label">
                Tentative Rejoining Date *
              </label>

              <input
                type="date"
                value={
                  form.tentativeRejoiningDate
                }
                onChange={(event) =>
                  updateField(
                    "tentativeRejoiningDate",
                    event.target.value
                  )
                }
                className="fl-field"
              />
            </div>

            <div>
              <label className="fl-label">Salary Treatment</label>

              <input
                value={
                  form.salaryTreatment
                }
                readOnly
                placeholder="Auto populated"
                className="fl-field fl-readonly"
              />
            </div>

            <div
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <label className="fl-label">Reason *</label>

              <input
                value={form.reason}
                onChange={(event) =>
                  updateField(
                    "reason",
                    event.target.value
                  )
                }
                placeholder="e.g. Project Completed / No Project Availability"
                className="fl-field"
              />
            </div>

            <div
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <label className="fl-label">Remarks</label>

              <textarea
                value={form.remarks}
                onChange={(event) =>
                  updateField(
                    "remarks",
                    event.target.value
                  )
                }
                rows={3}
                placeholder="Enter additional remarks"
                className="fl-textarea"
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={createForceLeave}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#4f46e5",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {editingRecordId
                ? "Update Force Leave"
                : "Create Force Leave"}
            </button>
          </div>
        </div>
      )}

      {showRejoinForm && rejoinRecord && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(15, 23, 42, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "min(620px, 100%)",
              background: "#fff",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow:
                "0 20px 50px rgba(15, 23, 42, 0.18)",
              padding: "22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "12px",
                  }}
                >
                  Force Leave {rejoinRecord.forceLeaveId}
                </div>
                <h2
                  style={{
                    margin: "4px 0 0",
                    color: "#172554",
                    fontSize: "20px",
                  }}
                >
                  Rejoin Employee
                </h2>
              </div>

              <button
                type="button"
                onClick={closeRejoin}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: "#64748b",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label className="fl-label">
                  Actual Rejoining Date *
                </label>
                <input
                  type="date"
                  value={
                    rejoinForm.actualRejoiningDate
                  }
                  min={rejoinRecord.flStartDate || undefined}
                  onChange={(event) =>
                    setRejoinForm((previous) => ({
                      ...previous,
                      actualRejoiningDate:
                        event.target.value,
                    }))
                  }
                  className="fl-field"
                />
              </div>

              <div>
                <label className="fl-label">
                  Rejoining Type *
                </label>
                <select
                  value={rejoinForm.rejoiningType}
                  onChange={(event) =>
                    setRejoinForm((previous) => ({
                      ...previous,
                      rejoiningType:
                        event.target.value,
                    }))
                  }
                  className="fl-field"
                >
                  <option value="Same Site">
                    Same Site
                  </option>
                  <option value="New Site">
                    New Site
                  </option>
                </select>
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                <label className="fl-label">
                  Rejoining Site *
                </label>
                <select
                  value={rejoinForm.rejoiningSite}
                  onChange={(event) =>
                    setRejoinForm((previous) => ({
                      ...previous,
                      rejoiningSite:
                        event.target.value,
                    }))
                  }
                  className="fl-field"
                >
                  <option value="">
                    Select Rejoining Site
                  </option>

                  {rejoiningSites.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}

                  {rejoinForm.rejoiningSite &&
                    !rejoiningSites.includes(
                      rejoinForm.rejoiningSite
                    ) && (
                      <option
                        value={
                          rejoinForm.rejoiningSite
                        }
                      >
                        {rejoinForm.rejoiningSite}
                        {" (Current Site)"}
                      </option>
                    )}
                </select>
              </div>

              {rejoinForm.rejoiningType ===
                "New Site" && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "10px 12px",
                    borderRadius: "7px",
                    background: "#f8f9ff",
                    color: "#475569",
                    fontSize: "13px",
                  }}
                >
                  <strong>Transfer Required:</strong>{" "}
                  Yes. After rejoining, use the existing
                  Transfer module with the same Employee ID.
                  No duplicate employee will be created.
                </div>
              )}

              <div
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                <label className="fl-label">
                  Rejoining Remarks
                </label>
                <textarea
                  value={rejoinForm.remarks}
                  onChange={(event) =>
                    setRejoinForm((previous) => ({
                      ...previous,
                      remarks: event.target.value,
                    }))
                  }
                  rows={3}
                  className="fl-textarea"
                  placeholder="Enter rejoining remarks"
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={closeRejoin}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveRejoining}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#4f46e5",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Confirm Rejoining
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              color: "#172554",
            }}
          >
            Force Leave Records
          </h2>
        </div>

        {records.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            No Force Leave records found.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "1100px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                }}
              >
                <th style={{ padding: "12px", textAlign: "left" }}>
                  FL ID
                </th>

                <th style={{ padding: "12px", textAlign: "left" }}>
                  Employee
                </th>

                <th style={{ padding: "12px", textAlign: "left" }}>
                  Type
                </th>

                <th style={{ padding: "12px", textAlign: "left" }}>
                  Current Site
                </th>

                <th style={{ padding: "12px", textAlign: "left" }}>
                  FL Start
                </th>

                <th style={{ padding: "12px", textAlign: "left" }}>
                  Tentative Rejoining
                </th>

                <th style={{ padding: "12px", textAlign: "left" }}>
                  Status
                </th>

                <th style={{ padding: "12px", textAlign: "left" }}>
                  Salary Treatment
                </th>

                <th style={{ padding: "12px", textAlign: "left" }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td style={{ padding: "12px" }}>
                    {record.forceLeaveId}
                  </td>

                  <td style={{ padding: "12px" }}>
                    <strong>
                      {record.employeeName}
                    </strong>
                    <br />
                    <small>
                      {record.employeeId}
                    </small>
                  </td>

                  <td style={{ padding: "12px" }}>
                    {record.employeeType}
                  </td>

                  <td style={{ padding: "12px" }}>
                    {record.currentSite}
                  </td>

                  <td style={{ padding: "12px" }}>
                    {record.flStartDate}
                  </td>

                  <td style={{ padding: "12px" }}>
                    {record.tentativeRejoiningDate}
                  </td>

                  <td style={{ padding: "12px" }}>
                    {record.status}
                  </td>

                  <td style={{ padding: "12px" }}>
                    {record.salaryTreatment}
                  </td>

                  <td
                    style={{
                      padding: "12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(record)
                        }
                        style={{
                          border: "1px solid #c7d2fe",
                          background: "#eef2ff",
                          color: "#4338ca",
                          borderRadius: "6px",
                          padding: "6px 9px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        Edit
                      </button>

                      {record.status === "Active" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openRejoin(record)
                            }
                            style={{
                              border:
                                "1px solid #bbf7d0",
                              background: "#f0fdf4",
                              color: "#15803d",
                              borderRadius: "6px",
                              padding: "6px 9px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            Rejoin
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              cancelForceLeave(record)
                            }
                            style={{
                              border:
                                "1px solid #fecaca",
                              background: "#fef2f2",
                              color: "#dc2626",
                              borderRadius: "6px",
                              padding: "6px 9px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}