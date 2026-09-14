import { useEffect, useMemo, useState } from "react";
import "./Leave.css";

const BALANCE_KEY = "hrms_leave_balances";
const REQUEST_KEY = "hrms_leave_requests";
const ATTENDANCE_KEY = "hrms_attendance";
const ORG_KEY = "bauerHrmsOrganizationMasters";
const LEAVE_TYPES = ["EL", "CL", "SL", "FL", "CO"];

const DEFAULT_LEAVE_CONFIG = {
  EL: { accrual: { enabled: true, frequency: "MONTHLY", basis: "PRESENT_DAYS", minimumDays: 21, credit: 1.25 }, carryForward: { enabled: true, maximum: 30, expiryEnabled: false, expiryMonths: 0 } },
  CL: { accrual: { enabled: true, frequency: "YEARLY", basis: "FIXED", minimumDays: 0, credit: 12 }, carryForward: { enabled: false, maximum: 0, expiryEnabled: false, expiryMonths: 0 } },
  SL: { accrual: { enabled: true, frequency: "YEARLY", basis: "FIXED", minimumDays: 0, credit: 12 }, carryForward: { enabled: false, maximum: 0, expiryEnabled: false, expiryMonths: 0 } },
  FL: { accrual: { enabled: false, frequency: "NONE", basis: "NONE", minimumDays: 0, credit: 0 }, carryForward: { enabled: false, maximum: 0, expiryEnabled: false, expiryMonths: 0 } },
  CO: { accrual: { enabled: true, frequency: "ON_EVENT", basis: "WEEKLY_OFF_WORKED", minimumDays: 0, credit: 1 }, carryForward: { enabled: true, maximum: 30, expiryEnabled: true, expiryMonths: 6 } },
};

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
};

const normalizeLeaveType = (item) => {
  const code = String(item?.code || item?.id || "").trim().toUpperCase();
  if (!code) return null;
  const defaults = DEFAULT_LEAVE_CONFIG[code] || {};
  return {
    ...item,
    code,
    id: item?.id || code,
    active: item?.active !== false,
    accrual: { ...(defaults.accrual || {}), ...(item?.accrual || {}) },
    carryForward: { ...(defaults.carryForward || {}), ...(item?.carryForward || {}) },
  };
};

const getConfiguredLeaveTypes = () => {
  const organization = readJSON(ORG_KEY, {});
  const policy = Array.isArray(organization?.leavePolicies) ? organization.leavePolicies[0] : null;
  const configured = Array.isArray(policy?.leaveTypes) ? policy.leaveTypes : [];
  const byCode = new Map(configured.map(normalizeLeaveType).filter(Boolean).map((item) => [item.code, item]));
  return LEAVE_TYPES.map((code) => normalizeLeaveType(byCode.get(code) || { code }));
};

const getPolicy = (types, code) => {
  const normalizedCode = String(code || "").toUpperCase();
  return types.find((item) => String(item?.code || item?.id || "").toUpperCase() === normalizedCode)
    || normalizeLeaveType({ code: normalizedCode })
    || { code: normalizedCode, active: true, ...(DEFAULT_LEAVE_CONFIG[normalizedCode] || {}) };
};

const countPresentDays = (records, employeeId, year, month = null) => {
  let total = 0;
  Object.entries(records || {}).forEach(([date, day]) => {
    const [y, m] = String(date).split("-").map(Number);
    if (y !== year || (month && m !== month)) return;
    const status = String(day?.[employeeId]?.status || "").trim().toUpperCase();
    const normalized = status.replace(/\s*[—-]\s*.*/, "").trim();
    if (["PRESENT", "P", "OD", "WFH"].includes(normalized)) total += 1;
    if (["HALF DAY", "HD"].includes(normalized)) total += 0.5;
  });
  return total;
};

const countUsed = (records, employeeId, year, type) => {
  let total = 0;
  Object.entries(records || {}).forEach(([date, day]) => {
    if (!String(date).startsWith(`${year}-`)) return;
    const status = String(day?.[employeeId]?.status || "").trim().toUpperCase();
    const normalized = status.replace(/\s*[—-]\s*.*/, "").trim();
    if (normalized === String(type).toUpperCase()) total += 1;
  });
  return total;
};

const countCompOffEarned = (records, employeeId, year) => {
  let total = 0;
  Object.entries(records || {}).forEach(([date, day]) => {
    if (!String(date).startsWith(`${year}-`)) return;
    const value = day?.[employeeId]?.compOffEarned;
    if (value) total += value === true ? 1 : Number(value) || 0;
  });
  return total;
};

const calculateAccrual = (employee, type, year, attendance, policies) => {
  const policy = getPolicy(policies, type);
  const accrual = policy?.accrual || {};
  if (policy.active === false || accrual.enabled === false) return 0;

  const frequency = String(accrual.frequency || "NONE").toUpperCase();
  const basis = String(accrual.basis || "NONE").toUpperCase();
  const credit = Number(accrual.credit || 0);
  if (!credit || frequency === "NONE") return 0;

  if (frequency === "ON_EVENT" || basis === "WEEKLY_OFF_WORKED") {
    return type === "CO" ? countCompOffEarned(attendance, employee.id, year) * credit : 0;
  }

  if (frequency === "YEARLY") {
    if (basis === "FIXED") return credit;
    return countPresentDays(attendance, employee.id, year) >= Number(accrual.minimumDays || 0) ? credit : 0;
  }

  if (frequency === "MONTHLY") {
    const minimum = Number(accrual.minimumDays || 0);
    let earned = 0;
    for (let month = 1; month <= 12; month += 1) {
      if (countPresentDays(attendance, employee.id, year, month) >= minimum) earned += credit;
    }
    return earned;
  }

  return 0;
};

export default function Leave({ employees = [] }) {
  const [attendance, setAttendance] = useState(() => readJSON(ATTENDANCE_KEY, {}));
  const [balances, setBalances] = useState(() => readJSON(BALANCE_KEY, {}));
  const [requests, setRequests] = useState(() => readJSON(REQUEST_KEY, []));
  const [policies, setPolicies] = useState(getConfiguredLeaveTypes);
  const [year, setYear] = useState(new Date().getFullYear());
  const [view, setView] = useState("Balance");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [employeeId, setEmployeeId] = useState("");
  const [adjustment, setAdjustment] = useState({ EL: 0, CL: 0, SL: 0, FL: 0, CO: 0 });
  const [form, setForm] = useState({ employeeId: "", type: "EL", from: "", to: "", reason: "" });

  useEffect(() => localStorage.setItem(BALANCE_KEY, JSON.stringify(balances)), [balances]);
  useEffect(() => localStorage.setItem(REQUEST_KEY, JSON.stringify(requests)), [requests]);

  useEffect(() => {
    const refresh = () => {
      setAttendance(readJSON(ATTENDANCE_KEY, {}));
      setPolicies(getConfiguredLeaveTypes());
    };
    window.addEventListener("storage", refresh);
    const timer = window.setInterval(refresh, 1000);
    return () => { window.removeEventListener("storage", refresh); window.clearInterval(timer); };
  }, []);

  const getBalance = (employee) => {
    const opening = balances[employee.id] || {};
    const result = {};
    LEAVE_TYPES.forEach((type) => {
      const earned = calculateAccrual(employee, type, year, attendance, policies);
      const used = countUsed(attendance, employee.id, year, type);
      const policy = getPolicy(policies, type);
      const raw = Number(opening[type] || 0) + earned - used;
      const cf = policy?.carryForward || {};
      const max = Number(cf.maximum || 0);
      result[type] = cf.enabled && max > 0 ? Math.min(Math.max(0, raw), max) : Math.max(0, raw);
    });
    return result;
  };

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matches = !q || [employee.id, employee.name, employee.designation, employee.site, employee.vendor]
        .some((value) => String(value || "").toLowerCase().includes(q));
      if (!matches) return false;
      return typeFilter === "All" || getBalance(employee)[typeFilter] !== undefined;
    });
  }, [employees, search, typeFilter, balances, attendance, policies, year]);

  const saveOpening = () => {
    if (!employeeId) return window.alert("Please select an employee.");
    setBalances((prev) => ({
      ...prev,
      [employeeId]: Object.fromEntries(LEAVE_TYPES.map((type) => [type, Math.max(0, Number(adjustment[type]) || 0)])),
    }));
    setView("Balance");
  };

  const submitRequest = (event) => {
    event.preventDefault();
    const { employeeId: id, type, from, to, reason } = form;
    if (!id || !from || !to || to < from) return window.alert("Please enter valid employee and leave dates.");
    const days = Math.floor((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1;
    const employee = employees.find((item) => item.id === id);
    const balance = employee ? getBalance(employee)[type] : 0;
    if (balance < days) return window.alert(`${type} balance is only ${balance} day(s).`);
    setRequests((prev) => [{ id: `LR-${Date.now()}`, employeeId: id, type, from, to, days, reason, status: "Pending", createdAt: new Date().toISOString() }, ...prev]);
    setForm({ employeeId: "", type: "EL", from: "", to: "", reason: "" });
    setView("Requests");
  };

  const updateRequestStatus = (requestId, decision) => {
    const approved = String(decision || "").toLowerCase() === "approve";
    setRequests((prev) => prev.map((request) => {
      if (String(request?.id) !== String(requestId)) return request;

      // ESS requests reach HR/Admin only after HOD approval.
      if (request?.source === "Employee Self Service" && request?.approvalStage === "HOD") {
        return request;
      }

      return {
        ...request,
        status: approved ? "Approved" : "Rejected",
        approvalStage: "Completed",
        hrAdminStatus: approved ? "Approved" : "Rejected",
        hrAdminDecisionBy: "HR/Admin",
        hrAdminDecisionAt: new Date().toISOString(),
      };
    }));
    window.dispatchEvent(new Event("bauerHrmsLeaveRequestsUpdated"));
  };

  const today = new Date().toISOString().slice(0, 10);
  const onLeaveToday = Object.values(attendance[today] || {}).filter((row) => LEAVE_TYPES.includes(row?.status)).length;
  const totals = Object.fromEntries(LEAVE_TYPES.map((type) => [type, employees.reduce((sum, employee) => sum + getBalance(employee)[type], 0)]));

  return (
    <section className="leave-module">
      <div className="leave-page-header">
        <div><div className="module-eyebrow">HR OPERATIONS</div><h2>Leave Management</h2><p>Policy-driven accrual, opening balances, requests and Comp Off.</p></div>
        <div className="leave-header-actions">
          {[["Balance", "Balance"], ["Requests", "Requests"], ["Adjust", "Opening Balance"]].map(([key, label]) => <button key={key} className={`leave-tab ${view === key ? "active" : ""}`} onClick={() => setView(key)}>{label}</button>)}
        </div>
      </div>

      <div className="leave-summary-grid">
        {[['Employees', employees.length, 'total'], ['On Leave Today', onLeaveToday, 'leave'], ['Pending Requests', requests.filter((r) => r.status === 'Pending').length, 'pending'], ['EL', totals.EL, 'el'], ['CL', totals.CL, 'cl'], ['SL', totals.SL, 'sl'], ['FL', totals.FL, 'fl'], ['Comp Off', totals.CO, 'co']].map(([label, value, type]) => <div className={`leave-summary-card ${type}`} key={label}><span>{label}</span><strong>{Number(value).toFixed(label === 'Employees' || label === 'On Leave Today' ? 0 : 2)}</strong><small>{label === 'Employees' ? 'Active HR master' : `Available in ${year}`}</small></div>)}
      </div>

      {view === "Balance" && <>
        <div className="leave-toolbar">
          <div className="leave-search-wrap"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee, site, vendor..." /></div>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>{[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}</select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="All">All Leave Types</option>{LEAVE_TYPES.map((type) => <option key={type} value={type}>{type === "CO" ? "Comp Off" : type}</option>)}</select>
          <span className="leave-policy-chip">Accrual from Organization policy</span>
          <button className="primary-button" onClick={() => setView("Adjust")}>+ Set Opening Balance</button>
        </div>
        <div className="leave-table-card"><div className="table-wrapper"><table><thead><tr><th>Employee</th><th>Site</th><th>Type</th><th>EL</th><th>CL</th><th>SL</th><th>FL</th><th>Comp Off</th><th>Total</th><th>Accrual / Year</th></tr></thead><tbody>
          {filteredEmployees.map((employee) => { const balance = getBalance(employee); const accrual = LEAVE_TYPES.reduce((sum, type) => sum + calculateAccrual(employee, type, year, attendance, policies), 0); return <tr key={employee.id}><td><div className="leave-employee"><div className="table-avatar">{String(employee.name || '').split(' ').map((n) => n[0]).slice(0, 2).join('')}</div><div><strong>{employee.name}</strong><span>{employee.employeeId} · {employee.designation || '-'}</span></div></div></td><td>{employee.site || '-'}</td><td><span className="type-badge">{employee.type || '-'}</span></td>{LEAVE_TYPES.map((type) => <td key={type}><strong>{Number(balance[type]).toFixed(2)}</strong></td>)}<td><span className="leave-total-badge">{LEAVE_TYPES.reduce((sum, type) => sum + balance[type], 0).toFixed(2)}</span></td><td><span className="leave-accrual-badge">{accrual.toFixed(2)}</span></td></tr>; })}
        </tbody></table>{filteredEmployees.length === 0 && <div className="leave-empty">No employees match the selected filters.</div>}</div></div>
      </>}

      {view === "Adjust" && <div className="leave-panel-grid"><div className="leave-form-card"><div className="leave-card-heading"><div><h3>Opening Leave Balance</h3><p>Opening balance + policy accrual − attendance usage.</p></div></div><div className="leave-form-grid"><div className="form-field full-width"><label>Employee</label><select value={employeeId} onChange={(e) => { const id = e.target.value; setEmployeeId(id); setAdjustment({ EL: balances[id]?.EL || 0, CL: balances[id]?.CL || 0, SL: balances[id]?.SL || 0, FL: balances[id]?.FL || 0, CO: balances[id]?.CO || 0 }); }}><option value="">Select employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}</select></div>{LEAVE_TYPES.map((type) => <div className="form-field" key={type}><label>{type === 'CO' ? 'Comp Off' : type} Opening Balance</label><input type="number" min="0" step="0.5" value={adjustment[type]} onChange={(e) => setAdjustment((prev) => ({ ...prev, [type]: e.target.value }))} /></div>)}</div><div className="leave-form-actions"><button className="secondary-btn" onClick={() => setView('Balance')}>Cancel</button><button className="primary-button" onClick={saveOpening}>Save Opening Balance</button></div></div><div className="leave-info-card"><h3>How balance works</h3><div className="leave-info-item"><strong>EL</strong><span>Uses the accrual rule configured under Organization → Leave & Comp Off.</span></div><div className="leave-info-item"><strong>Monthly rule</strong><span>Each month is evaluated independently. Example: minimum 21 present days → configured credit.</span></div><div className="leave-info-item"><strong>Comp Off</strong><span>Earned separately when Attendance records Weekly Off work with CO Earned.</span></div><div className="leave-info-item"><strong>Carry Forward</strong><span>Configured maximum is applied to the calculated available balance.</span></div></div></div>}

      {view === "Requests" && <div className="leave-panel-grid"><div className="leave-form-card"><div className="leave-card-heading"><div><h3>New Leave Request</h3><p>Request against the employee's calculated balance.</p></div></div><form onSubmit={submitRequest} className="leave-form-grid"><div className="form-field full-width"><label>Employee</label><select value={form.employeeId} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))} required><option value="">Select employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}</select></div><div className="form-field"><label>Leave Type</label><select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>{LEAVE_TYPES.map((type) => <option key={type} value={type}>{type === 'CO' ? 'Comp Off' : type}</option>)}</select></div><div className="form-field"><label>Available</label><input readOnly value={form.employeeId ? getBalance(employees.find((e) => e.id === form.employeeId))[form.type].toFixed(2) : '0.00'} /></div><div className="form-field"><label>From</label><input type="date" value={form.from} onChange={(e) => setForm((p) => ({ ...p, from: e.target.value }))} required /></div><div className="form-field"><label>To</label><input type="date" value={form.to} onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))} required /></div><div className="form-field full-width"><label>Reason</label><textarea rows="3" value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} /></div><div className="form-field full-width"><button className="primary-button" type="submit">Submit Request</button></div></form></div><div className="leave-form-card"><div className="leave-card-heading"><div><h3>Leave Requests</h3><p>Approve or reject submitted requests.</p></div></div><div className="leave-request-list">{requests.length === 0 ? <div className="leave-empty">No leave requests yet.</div> : requests.map((request) => { const emp = employees.find((e) => e.id === request.employeeId); const isEss = request?.source === "Employee Self Service"; const canAct = request.status === "Pending HR/Admin" || (!isEss && request.status === "Pending"); return <div className="leave-request-row" key={request.id}><div><strong>{emp?.name || request.employeeId}</strong><span>{request.type === 'CO' ? 'Comp Off' : request.type} · {request.from} → {request.to} · {request.days} day(s)</span><small>{isEss ? `HOD: ${request.hodName || "Not configured"} · ${request.hodStatus || "Pending"} · HR/Admin: ${request.hrAdminStatus || "CC"}` : "HR/Admin request"}</small></div><div className="leave-request-actions"><span className={`leave-request-status ${String(request.status).toLowerCase().replace(/\s+/g, '-')}`}>{request.status}</span>{canAct && <><button onClick={() => updateRequestStatus(request.id, "approve")}>Approve</button><button onClick={() => updateRequestStatus(request.id, "reject")}>Reject</button></>}</div></div>; })}</div></div></div>}
    </section>
  );
}
