import { useEffect, useMemo, useState } from "react";
import "./Training.css";

const TRAINING_STORAGE_KEY = "bauerHrmsTrainings";
const TRAINING_UPDATED_EVENT = "bauerHrmsTrainingUpdated";
const TRAINING_MASTER_KEY = "bauerHrmsTrainingMasters";
const TRAINER_MASTER_KEY = "bauerHrmsTrainingTrainers";
const TNI_KEY = "bauerHrmsTrainingTNI";
const ANNUAL_PLAN_KEY = "bauerHrmsTrainingAnnualPlan";

const STATUS_OPTIONS = [
  "Draft",
  "Planned",
  "Scheduled",
  "In Progress",
  "Completed",
  "Cancelled",
  "Postponed",
];

const TYPE_OPTIONS = [
  "Technical",
  "Behavioural",
  "Safety",
  "Compliance",
  "Functional",
  "Leadership",
  "Induction",
  "Quality",
  "IT / Digital",
  "Other",
];

const MODE_OPTIONS = ["Classroom", "Online", "Hybrid", "On-the-Job"];

const emptyForm = {
  trainingName: "",
  category: "Technical",
  type: "Technical",
  department: "All Departments",
  trainer: "",
  startDate: "",
  endDate: "",
  startTime: "09:30",
  endTime: "12:30",
  venue: "",
  mode: "Classroom",
  plannedParticipants: 0,
  plannedHours: 3,
  plannedCost: 0,
  mandatory: false,
  status: "Scheduled",
  description: "",
};

function readTrainingData() {
  try {
    const saved = localStorage.getItem(TRAINING_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function readTrainingStore(key, fallback = []) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveTrainingStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeId() {
  return `TRN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function sameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

function statusClass(status = "") {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function employeeName(employee) {
  return employee?.name || employee?.employeeName || employee?.fullName || "Employee";
}

function employeeDepartment(employee) {
  return employee?.department || employee?.departmentName || employee?.dept || "Unassigned";
}

function getDaysInMonth(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function Training({ employees = [], masters = {} }) {
  const [trainings, setTrainings] = useState(readTrainingData);
  const [view, setView] = useState("Dashboard");
  const [calendarView, setCalendarView] = useState("Month");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [trainingMasters, setTrainingMasters] = useState(() => readTrainingStore(TRAINING_MASTER_KEY));
  const [trainers, setTrainers] = useState(() => readTrainingStore(TRAINER_MASTER_KEY));
  const [tniRecords, setTniRecords] = useState(() => readTrainingStore(TNI_KEY));
  const [annualPlans, setAnnualPlans] = useState(() => readTrainingStore(ANNUAL_PLAN_KEY));
  const [masterForm, setMasterForm] = useState({ name: "", category: "Technical", frequency: "Annual", duration: 3, mandatory: false, mode: "Classroom", department: "All Departments", designation: "", description: "", status: "Active" });
  const [masterSearch, setMasterSearch] = useState("");
  const [masterCategoryFilter, setMasterCategoryFilter] = useState("All");
  const [masterStatusFilter, setMasterStatusFilter] = useState("All");
  const [editingMasterId, setEditingMasterId] = useState(null);
  const [trainerForm, setTrainerForm] = useState({ name: "", type: "Internal", department: "All Departments", expertise: "", contact: "" });
  const [tniForm, setTniForm] = useState({ employeeId: "", need: "", category: "Technical", priority: "Medium", targetDate: "", remarks: "" });
  const [planForm, setPlanForm] = useState({ year: new Date().getFullYear(), training: "", department: "All Departments", target: 0, budget: 0, status: "Planned" });

  const departments = useMemo(() => {
    const fromEmployees = employees.map(employeeDepartment).filter(Boolean);
    const fromMasters =
      masters?.departments ||
      masters?.department ||
      masters?.Department ||
      [];
    const masterNames = Array.isArray(fromMasters)
      ? fromMasters
          .map((item) => (typeof item === "string" ? item : item?.name))
          .filter(Boolean)
      : [];
    return [...new Set(["All Departments", ...fromEmployees, ...masterNames])];
  }, [employees, masters]);

  useEffect(() => {
    localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(trainings));
  }, [trainings]);
  useEffect(() => saveTrainingStore(TRAINING_MASTER_KEY, trainingMasters), [trainingMasters]);
  useEffect(() => saveTrainingStore(TRAINER_MASTER_KEY, trainers), [trainers]);
  useEffect(() => saveTrainingStore(TNI_KEY, tniRecords), [tniRecords]);
  useEffect(() => saveTrainingStore(ANNUAL_PLAN_KEY, annualPlans), [annualPlans]);

  useEffect(() => {
    const refresh = () => setTrainings(readTrainingData());
    window.addEventListener("storage", refresh);
    window.addEventListener(TRAINING_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(TRAINING_UPDATED_EVENT, refresh);
    };
  }, []);

  const today = new Date();
  const currentMonth = calendarDate.getMonth();
  const currentYear = calendarDate.getFullYear();

  const activeTrainings = trainings.filter(
    (item) => !["Cancelled"].includes(item.status)
  );

  const upcomingTrainings = useMemo(() => {
    const todayKey = dateKey(today);
    return activeTrainings
      .filter((item) => item.startDate && item.startDate >= todayKey)
      .sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
  }, [trainings]);

  const monthTrainings = useMemo(
    () =>
      activeTrainings.filter((item) => {
        if (!item.startDate) return false;
        const date = new Date(`${item.startDate}T00:00:00`);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      }),
    [trainings, currentMonth, currentYear]
  );

  const filteredTrainings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trainings
      .filter((item) => statusFilter === "All" || item.status === statusFilter)
      .filter((item) => typeFilter === "All" || item.type === typeFilter)
      .filter(
        (item) =>
          departmentFilter === "All" ||
          departmentFilter === "All Departments" ||
          item.department === departmentFilter
      )
      .filter((item) => {
        if (!q) return true;
        return [
          item.trainingName,
          item.trainer,
          item.department,
          item.venue,
          item.type,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => `${b.startDate} ${b.startTime}`.localeCompare(`${a.startDate} ${a.startTime}`));
  }, [trainings, search, statusFilter, typeFilter, departmentFilter]);

  const plannedCount = activeTrainings.length;
  const completedCount = activeTrainings.filter((item) => item.status === "Completed").length;
  const scheduledCount = activeTrainings.filter((item) =>
    ["Planned", "Scheduled"].includes(item.status)
  ).length;
  const upcomingCount = upcomingTrainings.length;
  const participantPlan = activeTrainings.reduce(
    (sum, item) => sum + Number(item.plannedParticipants || 0),
    0
  );
  const trainingHours = activeTrainings.reduce(
    (sum, item) => sum + Number(item.actualHours ?? item.plannedHours ?? 0),
    0
  );
  const plannedCost = activeTrainings.reduce(
    (sum, item) => sum + Number(item.plannedCost || 0),
    0
  );
  const actualCost = activeTrainings.reduce(
    (sum, item) => sum + Number(item.actualCost || 0),
    0
  );

  const completionRate = plannedCount
    ? Math.round((completedCount / plannedCount) * 100)
    : 0;

  const currentMonthPlanned = monthTrainings.length;
  const currentMonthActual = monthTrainings.filter(
    (item) => item.status === "Completed"
  ).length;

  const monthBars = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const d = new Date(currentYear, currentMonth - 5 + index, 1);
      const planned = activeTrainings.filter((item) => {
        if (!item.startDate) return false;
        const date = new Date(`${item.startDate}T00:00:00`);
        return date.getMonth() === d.getMonth() && date.getFullYear() === d.getFullYear();
      });
      return {
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        planned: planned.length,
        actual: planned.filter((item) => item.status === "Completed").length,
      };
    });
  }, [activeTrainings, currentMonth, currentYear]);

  const calendarDays = useMemo(() => getDaysInMonth(calendarDate), [calendarDate]);

  const openNewTraining = () => {
    setForm({
      ...emptyForm,
      startDate: dateKey(calendarDate),
      endDate: dateKey(calendarDate),
    });
    setDetails(null);
    setModalOpen(true);
  };

  const openEditTraining = (training) => {
    setDetails(null);
    setForm({
      ...emptyForm,
      ...training,
      plannedParticipants: Number(training.plannedParticipants || 0),
      plannedHours: Number(training.plannedHours || 0),
      plannedCost: Number(training.plannedCost || 0),
    });
    setModalOpen(true);
  };

  const saveTraining = (event) => {
    event.preventDefault();
    if (!form.trainingName.trim() || !form.startDate) return;

    const record = {
      ...form,
      id: form.id || makeId(),
      trainingCode: form.trainingCode || `TRN-${new Date().getFullYear()}-${String(trainings.length + 1).padStart(4, "0")}`,
      plannedParticipants: Number(form.plannedParticipants || 0),
      plannedHours: Number(form.plannedHours || 0),
      plannedCost: Number(form.plannedCost || 0),
      actualParticipants: Number(form.actualParticipants || 0),
      actualHours: Number(form.actualHours || 0),
      actualCost: Number(form.actualCost || 0),
      updatedAt: new Date().toISOString(),
    };

    setTrainings((current) => {
      const exists = current.some((item) => item.id === record.id);
      return exists
        ? current.map((item) => (item.id === record.id ? record : item))
        : [record, ...current];
    });

    setModalOpen(false);
    setForm(emptyForm);
    window.dispatchEvent(new Event(TRAINING_UPDATED_EVENT));
  };

  const deleteTraining = (id) => {
    if (!window.confirm("Delete this training record?")) return;
    setTrainings((current) => current.filter((item) => item.id !== id));
    setDetails(null);
    window.dispatchEvent(new Event(TRAINING_UPDATED_EVENT));
  };

  const moveMonth = (amount) => {
    setCalendarDate(
      (current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)
    );
  };

  const openDay = (day) => {
    setCalendarDate(day);
    setCalendarView("Day");
  };

  const renderKpi = (icon, title, value, sub, tone) => (
    <div className={`trn-kpi ${tone}`}>
      <div className="trn-kpi-icon">{icon}</div>
      <div className="trn-kpi-body">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );

  const renderCalendarEvent = (training) => (
    <button
      key={training.id}
      className={`trn-calendar-event ${statusClass(training.status)}`}
      onClick={() => setDetails(training)}
      title={training.trainingName}
    >
      <strong>{training.trainingName}</strong>
      <span>{training.startTime || "—"} · {training.trainer || "Trainer not assigned"}</span>
    </button>
  );

  const renderCalendar = () => {
    const dayTrainings = activeTrainings.filter(
      (item) => item.startDate === dateKey(calendarDate)
    );

    if (calendarView === "Day") {
      return (
        <div className="trn-day-view">
          <div className="trn-day-heading">
            <div>
              <span className="trn-eyebrow">DAY VIEW</span>
              <h3>{formatDate(dateKey(calendarDate))}</h3>
            </div>
            <button className="trn-link-btn" onClick={() => setCalendarView("Month")}>
              Back to Month
            </button>
          </div>
          {dayTrainings.length ? (
            <div className="trn-day-list">{dayTrainings.map(renderCalendarEvent)}</div>
          ) : (
            <div className="trn-empty">No training scheduled for this day.</div>
          )}
        </div>
      );
    }

    if (calendarView === "List") {
      return (
        <div className="trn-list-calendar">
          {monthTrainings.length ? (
            monthTrainings.map((item) => (
              <button
                key={item.id}
                className="trn-list-row"
                onClick={() => setDetails(item)}
              >
                <div className="trn-date-box">
                  <strong>{new Date(`${item.startDate}T00:00:00`).getDate()}</strong>
                  <span>
                    {new Date(`${item.startDate}T00:00:00`).toLocaleDateString("en-IN", {
                      month: "short",
                    })}
                  </span>
                </div>
                <div className="trn-list-main">
                  <strong>{item.trainingName}</strong>
                  <span>{item.department} · {item.trainer || "Trainer not assigned"} · {item.venue || "Venue TBD"}</span>
                </div>
                <span className={`trn-status ${statusClass(item.status)}`}>{item.status}</span>
              </button>
            ))
          ) : (
            <div className="trn-empty">No trainings scheduled for this month.</div>
          )}
        </div>
      );
    }

    return (
      <div className="trn-calendar">
        <div className="trn-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="trn-calendar-grid">
          {calendarDays.map((day) => {
            const dayKey = dateKey(day);
            const events = activeTrainings.filter((item) => item.startDate === dayKey);
            const outside = day.getMonth() !== currentMonth;
            return (
              <button
                key={dayKey}
                className={`trn-calendar-cell ${outside ? "outside" : ""} ${sameDay(day, today) ? "today" : ""}`}
                onDoubleClick={() => openDay(day)}
              >
                <span className="trn-calendar-number">{day.getDate()}</span>
                <div className="trn-calendar-events">
                  {events.slice(0, 3).map(renderCalendarEvent)}
                  {events.length > 3 && (
                    <span className="trn-more">+{events.length - 3} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <>
      <div className="trn-kpi-grid">
        {renderKpi("◈", "Total Trainings", plannedCount, "Current training records", "blue")}
        {renderKpi("◷", "Planned / Scheduled", scheduledCount, "Awaiting execution", "indigo")}
        {renderKpi("✓", "Completed", completedCount, `${completionRate}% completion rate`, "green")}
        {renderKpi("→", "Upcoming", upcomingCount, "Future scheduled trainings", "orange")}
        {renderKpi("♙", "Participants Planned", participantPlan.toLocaleString("en-IN"), "Across all trainings", "cyan")}
        {renderKpi("◫", "Training Hours", trainingHours.toLocaleString("en-IN"), "Recorded / planned hours", "purple")}
        {renderKpi("₹", "Planned Cost", `₹${plannedCost.toLocaleString("en-IN")}`, "Training budget", "teal")}
        {renderKpi("★", "Effectiveness", "—", "Available after feedback & assessment", "slate")}
      </div>

      <div className="trn-main-grid">
        <section className="trn-card trn-calendar-card">
          <div className="trn-card-head">
            <div>
              <span className="trn-eyebrow">SCHEDULING</span>
              <h2>Training Calendar</h2>
              <p>Plan, schedule and track training activity from one place.</p>
            </div>
            <div className="trn-calendar-actions">
              <button className="trn-icon-btn" onClick={() => moveMonth(-1)}>‹</button>
              <strong>{monthLabel(calendarDate)}</strong>
              <button className="trn-icon-btn" onClick={() => moveMonth(1)}>›</button>
              <div className="trn-segmented">
                {["Month", "List", "Day"].map((item) => (
                  <button
                    key={item}
                    className={calendarView === item ? "active" : ""}
                    onClick={() => setCalendarView(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {renderCalendar()}
        </section>

        <section className="trn-card trn-upcoming-card">
          <div className="trn-card-head compact">
            <div>
              <span className="trn-eyebrow">NEXT 30 DAYS</span>
              <h2>Upcoming Training</h2>
            </div>
            <button className="trn-link-btn" onClick={() => setView("Calendar")}>View all</button>
          </div>
          <div className="trn-upcoming-list">
            {upcomingTrainings.slice(0, 6).map((item) => (
              <button className="trn-upcoming-item" key={item.id} onClick={() => setDetails(item)}>
                <div className="trn-date-box">
                  <strong>{new Date(`${item.startDate}T00:00:00`).getDate()}</strong>
                  <span>{new Date(`${item.startDate}T00:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span>
                </div>
                <div className="trn-upcoming-main">
                  <strong>{item.trainingName}</strong>
                  <span>{item.department} · {item.startTime || "Time TBD"}</span>
                  <small>{item.trainer || "Trainer not assigned"}</small>
                </div>
                <span className={`trn-status ${statusClass(item.status)}`}>{item.status}</span>
              </button>
            ))}
            {!upcomingTrainings.length && (
              <div className="trn-empty">No upcoming trainings. Use “Schedule Training” to create one.</div>
            )}
          </div>
        </section>
      </div>

      <div className="trn-secondary-grid">
        <section className="trn-card">
          <div className="trn-card-head compact">
            <div>
              <span className="trn-eyebrow">PERFORMANCE</span>
              <h2>Plan vs Actual</h2>
              <p>Training sessions planned compared with completed sessions.</p>
            </div>
            <span className="trn-mini-stat">{currentMonthActual}/{currentMonthPlanned} this month</span>
          </div>
          <div className="trn-chart">
            {monthBars.map((bar) => {
              const max = Math.max(1, ...monthBars.map((item) => item.planned));
              return (
                <div className="trn-chart-col" key={bar.label}>
                  <div className="trn-chart-values">
                    <span style={{ height: `${Math.max(4, (bar.planned / max) * 100)}%` }} title={`Planned: ${bar.planned}`} />
                    <i style={{ height: `${Math.max(4, (bar.actual / max) * 100)}%` }} title={`Actual: ${bar.actual}`} />
                  </div>
                  <strong>{bar.label}</strong>
                  <small>{bar.planned} / {bar.actual}</small>
                </div>
              );
            })}
          </div>
          <div className="trn-chart-legend">
            <span><i className="planned-dot" /> Planned</span>
            <span><i className="actual-dot" /> Actual</span>
          </div>
        </section>

        <section className="trn-card">
          <div className="trn-card-head compact">
            <div>
              <span className="trn-eyebrow">CONTROL CENTRE</span>
              <h2>Pending Actions</h2>
              <p>Items that will require action as later training phases are enabled.</p>
            </div>
          </div>
          <div className="trn-action-list">
            <button onClick={() => setView("Calendar")}><b>{trainings.filter((x) => x.status === "Planned").length}</b><span>Trainings awaiting scheduling</span><em>›</em></button>
            <button onClick={() => setView("Calendar")}><b>{trainings.filter((x) => x.status === "Postponed").length}</b><span>Postponed trainings</span><em>›</em></button>
            <button onClick={() => setView("Calendar")}><b>{trainings.filter((x) => x.status === "In Progress").length}</b><span>Trainings in progress</span><em>›</em></button>
            <button onClick={() => setView("Calendar")}><b>—</b><span>Feedback pending <small>Phase 4</small></span><em>›</em></button>
          </div>
        </section>
      </div>

      <section className="trn-card trn-activity-card">
        <div className="trn-card-head compact">
          <div>
            <span className="trn-eyebrow">TRAINING REGISTER</span>
            <h2>Recent Training Activity</h2>
          </div>
          <button className="trn-link-btn" onClick={() => setView("Calendar")}>Open register</button>
        </div>
        {filteredTrainings.slice(0, 6).length ? (
          <div className="trn-table-wrap">
            <table className="trn-table">
              <thead>
                <tr>
                  <th>Training</th>
                  <th>Date</th>
                  <th>Department</th>
                  <th>Trainer</th>
                  <th>Participants</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrainings.slice(0, 6).map((item) => (
                  <tr key={item.id} onClick={() => setDetails(item)}>
                    <td><strong>{item.trainingName}</strong><small>{item.trainingCode}</small></td>
                    <td>{formatDate(item.startDate)}</td>
                    <td>{item.department}</td>
                    <td>{item.trainer || "—"}</td>
                    <td>{Number(item.plannedParticipants || 0).toLocaleString("en-IN")}</td>
                    <td><span className={`trn-status ${statusClass(item.status)}`}>{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="trn-empty large">No training records yet. Your dashboard will populate automatically after the first schedule is created.</div>
        )}
      </section>
    </>
  );

  const renderRegister = () => (
    <section className="trn-card trn-register-card">
      <div className="trn-card-head">
        <div>
          <span className="trn-eyebrow">TRAINING REGISTER</span>
          <h2>All Trainings</h2>
          <p>Search, filter and manage scheduled training records.</p>
        </div>
      </div>
      <div className="trn-filters">
        <div className="trn-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search training, trainer, department..." /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option>{STATUS_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option>All</option>{TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>{departments.map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </div>
      <div className="trn-table-wrap">
        {filteredTrainings.length ? (
          <table className="trn-table">
            <thead><tr><th>Training</th><th>Date & Time</th><th>Department</th><th>Trainer</th><th>Mode / Venue</th><th>Participants</th><th>Status</th><th /></tr></thead>
            <tbody>
              {filteredTrainings.map((item) => (
                <tr key={item.id}>
                  <td><button className="trn-table-link" onClick={() => setDetails(item)}><strong>{item.trainingName}</strong><small>{item.trainingCode} · {item.type}</small></button></td>
                  <td>{formatDate(item.startDate)}<small>{item.startTime || "—"} - {item.endTime || "—"}</small></td>
                  <td>{item.department}</td>
                  <td>{item.trainer || "—"}</td>
                  <td>{item.mode}<small>{item.venue || "Venue TBD"}</small></td>
                  <td>{Number(item.plannedParticipants || 0).toLocaleString("en-IN")}</td>
                  <td><span className={`trn-status ${statusClass(item.status)}`}>{item.status}</span></td>
                  <td><button className="trn-more-btn" onClick={() => openEditTraining(item)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="trn-empty large">No records match the selected filters.</div>
        )}
      </div>
    </section>
  );


  const renderTrainingMaster = () => {
    const masterRows = trainingMasters.filter((x) => {
      const q = masterSearch.trim().toLowerCase();
      const matchesSearch = !q || [x.code, x.name, x.category, x.department, x.designation, x.description]
        .join(" ").toLowerCase().includes(q);
      const matchesCategory = masterCategoryFilter === "All" || x.category === masterCategoryFilter;
      const matchesStatus = masterStatusFilter === "All" || (x.status || "Active") === masterStatusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    const resetMasterForm = () => {
      setMasterForm({
        name: "", category: "Technical", frequency: "Annual", duration: 3,
        mandatory: false, mode: "Classroom", department: "All Departments",
        designation: "", description: "", status: "Active"
      });
      setEditingMasterId(null);
    };

    const saveMaster = (e) => {
      e.preventDefault();
      if (!masterForm.name.trim()) return;
      const record = {
        ...masterForm,
        id: editingMasterId || makeId(),
        code: trainingMasters.find((x) => x.id === editingMasterId)?.code ||
          `TM-${new Date().getFullYear()}-${String(trainingMasters.length + 1).padStart(4, "0")}`,
        duration: Number(masterForm.duration || 0),
        updatedAt: new Date().toISOString()
      };
      setTrainingMasters((items) =>
        editingMasterId
          ? items.map((item) => item.id === editingMasterId ? record : item)
          : [record, ...items]
      );
      resetMasterForm();
    };

    const editMaster = (item) => {
      setEditingMasterId(item.id);
      setMasterForm({
        name: item.name || "",
        category: item.category || "Technical",
        frequency: item.frequency || "Annual",
        duration: Number(item.duration || 3),
        mandatory: Boolean(item.mandatory),
        mode: item.mode || "Classroom",
        department: item.department || "All Departments",
        designation: item.designation || "",
        description: item.description || "",
        status: item.status || "Active"
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
      <section className="trn-card trn-phase-card">
        <div className="trn-card-head">
          <div>
            <span className="trn-eyebrow">MASTER DATA</span>
            <h2>Training Master</h2>
            <p>Define standard training programmes, ownership, applicability, frequency and mandatory requirements.</p>
          </div>
          <span className="trn-mini-stat">{trainingMasters.length} programme{trainingMasters.length === 1 ? "" : "s"}</span>
        </div>

        <form className="trn-phase-form" onSubmit={saveMaster}>
          <label>Training Programme *
            <input placeholder="e.g. Fire Safety & Emergency Response" value={masterForm.name}
              onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })} required />
          </label>
          <label>Category
            <select value={masterForm.category} onChange={(e) => setMasterForm({ ...masterForm, category: e.target.value })}>
              {TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label>Frequency
            <select value={masterForm.frequency} onChange={(e) => setMasterForm({ ...masterForm, frequency: e.target.value })}>
              <option>One Time</option><option>Annual</option><option>Half Yearly</option><option>Quarterly</option><option>Monthly</option><option>As Required</option>
            </select>
          </label>
          <label>Duration (Hours)
            <input type="number" min="0.5" step="0.5" value={masterForm.duration}
              onChange={(e) => setMasterForm({ ...masterForm, duration: e.target.value })} />
          </label>
          <label>Mode
            <select value={masterForm.mode} onChange={(e) => setMasterForm({ ...masterForm, mode: e.target.value })}>
              {MODE_OPTIONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label>Department
            <select value={masterForm.department} onChange={(e) => setMasterForm({ ...masterForm, department: e.target.value })}>
              {departments.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label>Designation
            <input placeholder="Applicable designation" value={masterForm.designation}
              onChange={(e) => setMasterForm({ ...masterForm, designation: e.target.value })} />
          </label>
          <label>Status
            <select value={masterForm.status} onChange={(e) => setMasterForm({ ...masterForm, status: e.target.value })}>
              <option>Active</option><option>Inactive</option>
            </select>
          </label>
          <label className="trn-check">
            <input type="checkbox" checked={masterForm.mandatory}
              onChange={(e) => setMasterForm({ ...masterForm, mandatory: e.target.checked })} />
            Mandatory Training
          </label>
          <label className="wide">Description / Objective
            <input placeholder="Purpose, competency or learning objective" value={masterForm.description}
              onChange={(e) => setMasterForm({ ...masterForm, description: e.target.value })} />
          </label>
          <div className="trn-form-footer">
            <span>{editingMasterId ? "Editing existing programme" : "Create a standard programme once and reuse it across TNI, Annual Plan and scheduling."}</span>
            <div>
              {editingMasterId && <button type="button" className="trn-secondary" onClick={resetMasterForm}>Cancel Edit</button>}
              <button className="trn-primary" type="submit">{editingMasterId ? "Save Changes" : "+ Add Training"}</button>
            </div>
          </div>
        </form>

        <div className="trn-master-toolbar">
          <div className="trn-search">
            <span>⌕</span>
            <input value={masterSearch} onChange={(e) => setMasterSearch(e.target.value)} placeholder="Search training programme, department..." />
          </div>
          <select value={masterCategoryFilter} onChange={(e) => setMasterCategoryFilter(e.target.value)}>
            <option>All</option>{TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select value={masterStatusFilter} onChange={(e) => setMasterStatusFilter(e.target.value)}>
            <option>All</option><option>Active</option><option>Inactive</option>
          </select>
          <span className="trn-toolbar-count">{masterRows.length} shown</span>
        </div>

        <div className="trn-table-wrap">
          {masterRows.length ? (
            <table className="trn-table">
              <thead><tr>
                <th>Code</th><th>Programme</th><th>Category</th><th>Frequency</th>
                <th>Duration</th><th>Mode</th><th>Applicable To</th><th>Mandatory</th><th>Status</th><th />
              </tr></thead>
              <tbody>
                {masterRows.map((x) => (
                  <tr key={x.id}>
                    <td><small>{x.code}</small></td>
                    <td><strong>{x.name}</strong><small>{x.description || "Standard training programme"}</small></td>
                    <td>{x.category}</td>
                    <td>{x.frequency}</td>
                    <td>{x.duration} hrs</td>
                    <td>{x.mode || "Classroom"}</td>
                    <td>{x.department || "All Departments"}{x.designation ? <small>{x.designation}</small> : null}</td>
                    <td>{x.mandatory ? "Yes" : "No"}</td>
                    <td><span className={`trn-status ${statusClass(x.status || "Active")}`}>{x.status || "Active"}</span></td>
                    <td>
                      <div className="trn-row-actions">
                        <button className="trn-more-btn" onClick={() => editMaster(x)}>Edit</button>
                        <button className="trn-more-btn" onClick={() => {
                          if (window.confirm(`Delete "${x.name}"?`)) setTrainingMasters((items) => items.filter((i) => i.id !== x.id));
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="trn-empty large">
              {trainingMasters.length ? "No training programmes match the selected filters." : "No training programmes defined. Add your first standard training above."}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderTrainerMaster = () => (
    <section className="trn-card trn-phase-card">
      <div className="trn-card-head"><div><span className="trn-eyebrow">RESOURCE MASTER</span><h2>Trainer Master</h2><p>Maintain internal and external trainers for future assignment and scheduling.</p></div></div>
      <form className="trn-inline-form" onSubmit={(e) => {
        e.preventDefault();
        if (!trainerForm.name.trim()) return;
        setTrainers((items) => [{ id: makeId(), ...trainerForm }, ...items]);
        setTrainerForm({ name: "", type: "Internal", department: "All Departments", expertise: "", contact: "" });
      }}>
        <input placeholder="Trainer name *" value={trainerForm.name} onChange={(e) => setTrainerForm({ ...trainerForm, name: e.target.value })} required />
        <select value={trainerForm.type} onChange={(e) => setTrainerForm({ ...trainerForm, type: e.target.value })}><option>Internal</option><option>External</option><option>Consultant</option></select>
        <select value={trainerForm.department} onChange={(e) => setTrainerForm({ ...trainerForm, department: e.target.value })}>{departments.map((x) => <option key={x}>{x}</option>)}</select>
        <input placeholder="Expertise / specialization" value={trainerForm.expertise} onChange={(e) => setTrainerForm({ ...trainerForm, expertise: e.target.value })} />
        <input placeholder="Contact" value={trainerForm.contact} onChange={(e) => setTrainerForm({ ...trainerForm, contact: e.target.value })} />
        <button className="trn-primary" type="submit">+ Add Trainer</button>
      </form>
      <div className="trn-table-wrap">
        {trainers.length ? <table className="trn-table"><thead><tr><th>Trainer</th><th>Type</th><th>Department</th><th>Expertise</th><th>Contact</th><th /></tr></thead>
          <tbody>{trainers.map((x) => <tr key={x.id}><td><strong>{x.name}</strong></td><td>{x.type}</td><td>{x.department}</td><td>{x.expertise || "—"}</td><td>{x.contact || "—"}</td><td><button className="trn-more-btn" onClick={() => setTrainers((items) => items.filter((i) => i.id !== x.id))}>Delete</button></td></tr>)}</tbody></table>
          : <div className="trn-empty large">No trainers added yet. Add internal or external trainers above.</div>}
      </div>
    </section>
  );

  const renderTNI = () => (
    <section className="trn-card trn-phase-card">
      <div className="trn-card-head"><div><span className="trn-eyebrow">TRAINING NEED IDENTIFICATION</span><h2>TNI Preparation</h2><p>Capture employee-level training needs, priority and target dates for the annual learning plan.</p></div></div>
      <form className="trn-tni-form" onSubmit={(e) => {
        e.preventDefault();
        if (!tniForm.employeeId || !tniForm.need.trim()) return;
        const employee = employees.find((x) => String(x.id ?? x.employeeId ?? x.code) === String(tniForm.employeeId));
        setTniRecords((items) => [{ id: makeId(), employeeId: tniForm.employeeId, employeeName: employee ? employeeName(employee) : "Employee", ...tniForm, status: "Open", createdAt: new Date().toISOString() }, ...items]);
        setTniForm({ employeeId: "", need: "", category: "Technical", priority: "Medium", targetDate: "", remarks: "" });
      }}>
        <label>Employee *<select required value={tniForm.employeeId} onChange={(e) => setTniForm({ ...tniForm, employeeId: e.target.value })}><option value="">Select Employee</option>{employees.map((x, i) => <option key={x.id ?? x.employeeId ?? i} value={x.id ?? x.employeeId ?? x.code ?? i}>{employeeName(x)} · {employeeDepartment(x)}</option>)}</select></label>
        <label>Training Need *<input required value={tniForm.need} onChange={(e) => setTniForm({ ...tniForm, need: e.target.value })} placeholder="e.g. Advanced Excel, Fire Safety..." /></label>
        <label>Category<select value={tniForm.category} onChange={(e) => setTniForm({ ...tniForm, category: e.target.value })}>{TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Priority<select value={tniForm.priority} onChange={(e) => setTniForm({ ...tniForm, priority: e.target.value })}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
        <label>Target Date<input type="date" value={tniForm.targetDate} onChange={(e) => setTniForm({ ...tniForm, targetDate: e.target.value })} /></label>
        <label>Remarks<input value={tniForm.remarks} onChange={(e) => setTniForm({ ...tniForm, remarks: e.target.value })} placeholder="Reason / competency gap" /></label>
        <button className="trn-primary" type="submit">+ Add TNI</button>
      </form>
      <div className="trn-table-wrap">
        {tniRecords.length ? <table className="trn-table"><thead><tr><th>Employee</th><th>Training Need</th><th>Category</th><th>Priority</th><th>Target</th><th>Status</th><th /></tr></thead>
          <tbody>{tniRecords.map((x) => <tr key={x.id}><td><strong>{x.employeeName}</strong></td><td>{x.need}</td><td>{x.category}</td><td><span className={`trn-status ${statusClass(x.priority)}`}>{x.priority}</span></td><td>{formatDate(x.targetDate)}</td><td>{x.status}</td><td><button className="trn-more-btn" onClick={() => setTniRecords((items) => items.filter((i) => i.id !== x.id))}>Delete</button></td></tr>)}</tbody></table>
          : <div className="trn-empty large">{employees.length ? "No TNI records yet. Start identifying employee training needs above." : "No employees are available from Employee Master yet."}</div>}
      </div>
    </section>
  );

  const renderAnnualPlan = () => (
    <section className="trn-card trn-phase-card">
      <div className="trn-card-head"><div><span className="trn-eyebrow">ANNUAL TRAINING PLAN</span><h2>Annual Training Plan</h2><p>Convert identified needs into an approved annual training roadmap with participant targets and budget.</p></div></div>
      <form className="trn-inline-form" onSubmit={(e) => {
        e.preventDefault();
        if (!planForm.training.trim()) return;
        setAnnualPlans((items) => [{ id: makeId(), ...planForm, target: Number(planForm.target || 0), budget: Number(planForm.budget || 0) }, ...items]);
        setPlanForm({ year: new Date().getFullYear(), training: "", department: "All Departments", target: 0, budget: 0, status: "Planned" });
      }}>
        <input type="number" value={planForm.year} onChange={(e) => setPlanForm({ ...planForm, year: e.target.value })} />
        <input placeholder="Training programme / objective *" value={planForm.training} onChange={(e) => setPlanForm({ ...planForm, training: e.target.value })} required />
        <select value={planForm.department} onChange={(e) => setPlanForm({ ...planForm, department: e.target.value })}>{departments.map((x) => <option key={x}>{x}</option>)}</select>
        <input type="number" min="0" placeholder="Target participants" value={planForm.target} onChange={(e) => setPlanForm({ ...planForm, target: e.target.value })} />
        <input type="number" min="0" placeholder="Budget ₹" value={planForm.budget} onChange={(e) => setPlanForm({ ...planForm, budget: e.target.value })} />
        <select value={planForm.status} onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}><option>Draft</option><option>Planned</option><option>Approved</option><option>Closed</option></select>
        <button className="trn-primary" type="submit">+ Add Plan</button>
      </form>
      <div className="trn-plan-summary">
        <div><span>Plans</span><strong>{annualPlans.length}</strong></div>
        <div><span>Participants Target</span><strong>{annualPlans.reduce((s, x) => s + Number(x.target || 0), 0).toLocaleString("en-IN")}</strong></div>
        <div><span>Total Budget</span><strong>₹{annualPlans.reduce((s, x) => s + Number(x.budget || 0), 0).toLocaleString("en-IN")}</strong></div>
        <div><span>TNI Open</span><strong>{tniRecords.filter((x) => x.status === "Open").length}</strong></div>
      </div>
      <div className="trn-table-wrap">
        {annualPlans.length ? <table className="trn-table"><thead><tr><th>Year</th><th>Training / Objective</th><th>Department</th><th>Participants</th><th>Budget</th><th>Status</th><th /></tr></thead>
          <tbody>{annualPlans.map((x) => <tr key={x.id}><td>{x.year}</td><td><strong>{x.training}</strong></td><td>{x.department}</td><td>{Number(x.target || 0).toLocaleString("en-IN")}</td><td>₹{Number(x.budget || 0).toLocaleString("en-IN")}</td><td>{x.status}</td><td><button className="trn-more-btn" onClick={() => setAnnualPlans((items) => items.filter((i) => i.id !== x.id))}>Delete</button></td></tr>)}</tbody></table>
          : <div className="trn-empty large">No annual plan created yet. Add the first plan above.</div>}
      </div>
    </section>
  );

  return (
    <section className="training-module">
      <div className="trn-page-head">
        <div>
          <span className="trn-eyebrow">LEARNING & DEVELOPMENT</span>
          <h1>Training & Development</h1>
          <p>Plan, schedule and monitor employee learning from one professional workspace.</p>
        </div>
        <div className="trn-page-actions">
          <button className="trn-secondary" onClick={() => setView("Calendar")}>▣ Calendar</button>
          <button className="trn-primary" onClick={openNewTraining}>＋ Schedule Training</button>
        </div>
      </div>

      <div className="trn-nav">
        {[
          ["Dashboard", "▦"],
          ["Calendar", "◷"],
          ["Training Master", "▤"],
          ["Trainer Master", "♙"],
          ["TNI", "◇"],
          ["Annual Plan", "▥"],
          ["Training Register", "☷"],
        ].map(([item, icon]) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
            <span>{icon}</span>{item}
          </button>
        ))}
      </div>

      {view === "Dashboard" && renderDashboard()}
      {view === "Calendar" && (
        <section className="trn-card trn-calendar-full">
          <div className="trn-card-head">
            <div><span className="trn-eyebrow">TRAINING CALENDAR</span><h2>{monthLabel(calendarDate)}</h2><p>Double-click a date to open its day view.</p></div>
            <div className="trn-calendar-actions">
              <button className="trn-icon-btn" onClick={() => moveMonth(-1)}>‹</button>
              <button className="trn-today-btn" onClick={() => setCalendarDate(new Date())}>Today</button>
              <button className="trn-icon-btn" onClick={() => moveMonth(1)}>›</button>
              <div className="trn-segmented">{["Month", "List", "Day"].map((item) => <button key={item} className={calendarView === item ? "active" : ""} onClick={() => setCalendarView(item)}>{item}</button>)}</div>
            </div>
          </div>
          {renderCalendar()}
        </section>
      )}
      {view === "Training Master" && renderTrainingMaster()}
      {view === "Trainer Master" && renderTrainerMaster()}
      {view === "TNI" && renderTNI()}
      {view === "Annual Plan" && renderAnnualPlan()}
      {view === "Training Register" && renderRegister()}

      {details && (
        <div className="trn-modal-backdrop" onMouseDown={() => setDetails(null)}>
          <div className="trn-modal trn-detail-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="trn-modal-head">
              <div><span className="trn-eyebrow">{details.trainingCode}</span><h2>{details.trainingName}</h2><p>{details.description || "Training record"}</p></div>
              <button className="trn-close" onClick={() => setDetails(null)}>×</button>
            </div>
            <div className="trn-detail-grid">
              <div><span>Date</span><strong>{formatDate(details.startDate)}</strong></div>
              <div><span>Time</span><strong>{details.startTime || "—"} - {details.endTime || "—"}</strong></div>
              <div><span>Department</span><strong>{details.department}</strong></div>
              <div><span>Trainer</span><strong>{details.trainer || "Not assigned"}</strong></div>
              <div><span>Mode</span><strong>{details.mode}</strong></div>
              <div><span>Venue</span><strong>{details.venue || "Not specified"}</strong></div>
              <div><span>Participants</span><strong>{Number(details.plannedParticipants || 0).toLocaleString("en-IN")}</strong></div>
              <div><span>Planned Cost</span><strong>₹{Number(details.plannedCost || 0).toLocaleString("en-IN")}</strong></div>
            </div>
            <div className="trn-detail-footer">
              <span className={`trn-status ${statusClass(details.status)}`}>{details.status}</span>
              <div><button className="trn-danger" onClick={() => deleteTraining(details.id)}>Delete</button><button className="trn-secondary" onClick={() => { setDetails(null); openEditTraining(details); }}>Edit Training</button></div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="trn-modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <div className="trn-modal trn-form-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="trn-modal-head">
              <div><span className="trn-eyebrow">TRAINING SCHEDULER</span><h2>{form.id ? "Edit Training" : "Schedule Training"}</h2><p>Create a training record now; later phases will connect assignment, attendance, assessment and feedback.</p></div>
              <button className="trn-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={saveTraining}>
              <div className="trn-form-grid">
                <label className="wide">Training Name *<input required value={form.trainingName} onChange={(e) => setForm({ ...form, trainingName: e.target.value })} placeholder="e.g. Fire Safety & Emergency Response" /></label>
                <label>Training Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label>Department<select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>{departments.filter((x) => x !== "All Departments").map((x) => <option key={x}>{x}</option>)}<option>All Departments</option></select></label>
                <label>Trainer<input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} placeholder="Trainer / faculty name" /></label>
                <label>Start Date *<input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.endDate || e.target.value })} /></label>
                <label>End Date<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
                <label>Start Time<input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label>
                <label>End Time<input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label>
                <label>Mode<select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{MODE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label>Venue<input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Training room / online link" /></label>
                <label>Planned Participants<input type="number" min="0" value={form.plannedParticipants} onChange={(e) => setForm({ ...form, plannedParticipants: e.target.value })} /></label>
                <label>Planned Hours<input type="number" min="0" step="0.5" value={form.plannedHours} onChange={(e) => setForm({ ...form, plannedHours: e.target.value })} /></label>
                <label>Planned Cost<input type="number" min="0" value={form.plannedCost} onChange={(e) => setForm({ ...form, plannedCost: e.target.value })} /></label>
                <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="trn-check"><input type="checkbox" checked={form.mandatory} onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} /> Mandatory training</label>
                <label className="wide">Description<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Training objective, scope or notes..." /></label>
              </div>
              <div className="trn-form-footer">
                <span>{employees.length ? `${employees.length.toLocaleString("en-IN")} employees available in Employee Master` : "Employee Master will be connected for assignment in the next phase."}</span>
                <div><button type="button" className="trn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="trn-primary">Save Training</button></div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Training;
