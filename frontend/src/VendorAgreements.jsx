import { useEffect, useMemo, useState } from "react";
import "./VendorAgreements.css";

const AGREEMENT_KEY = "bauerHrmsVendorAgreements";
const PO_KEY = "bauerHrmsVendorPOs";
const ORG_KEY = "bauerHrmsOrganizationMasters";

const EMPTY_PO = {
  poNumber: "",
  poStart: "",
  poEnd: "",
  poValue: "",
  location: "",
  manpowerCategory: "Third Party (Associates)",
  approvedManpower: "",
  manpowerType: "",
  manualStatus: "Auto",
  documentName: "",
  remarks: "",
  pos: [],
};

const EMPTY_FORM = {
  vendor: "",
  agreementNo: "",
  agreementStart: "",
  agreementEnd: "",
  agreementType: "Manpower Supply",
  location: "",
  manpowerCategory: "Third Party (Associates)",
  manualStatus: "Auto",
  gratuityProvision: "As per Agreement",
  gratuityResponsibility: "Contractor",
  betterTerms: "",
  documentName: "",
  remarks: "",
};

const FALLBACK_VENDORS = ["BAUER", "Conzept", "AlignPro", "Taurus"];
const FALLBACK_LOCATIONS = [
  "Gurgaon HO",
  "Gurgaon Yard",
  "NPCIL Hisar",
  "Chennai Design",
  "Chennai Yard",
];

function readAgreements() {
  try {
    const saved = localStorage.getItem(AGREEMENT_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function readOrganization() {
  try {
    const saved = localStorage.getItem(ORG_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function activeNames(items, fallback) {
  if (!Array.isArray(items) || !items.length) return fallback;
  return items
    .filter((item) => typeof item === "string" || item?.active !== false)
    .map((item) => (typeof item === "string" ? item : item.name))
    .filter(Boolean);
}


function readPOs() {
  try {
    const saved = localStorage.getItem(PO_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function statusForPO(po) {
  if (po.manualStatus === "On Hold") return "On Hold";
  if (po.manualStatus === "Cancelled") return "Cancelled";
  if (!po.poStart || !po.poEnd) return "Draft";

  const today = new Date();
  const start = new Date(`${po.poStart}T00:00:00`);
  const end = new Date(`${po.poEnd}T23:59:59`);

  if (today < start) return "Future";
  if (today > end) return "Expired";
  return "Active";
}

function daysRemainingPO(po) {
  if (!po.poEnd) return null;
  const end = new Date(`${po.poEnd}T23:59:59`);
  return Math.ceil((end - new Date()) / 86400000);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function statusForAgreement(agreement) {
  // Manual controls take precedence only for HR-controlled states.
  if (agreement.manualStatus === "On Hold") return "On Hold";
  if (agreement.manualStatus === "Cancelled") return "Cancelled";

  if (!agreement.agreementStart || !agreement.agreementEnd) return "Draft";

  const today = new Date();
  const start = new Date(`${agreement.agreementStart}T00:00:00`);
  const end = new Date(`${agreement.agreementEnd}T23:59:59`);

  if (today < start) return "Future";
  if (today > end) return "Expired";
  return "Active";
}

function daysRemaining(agreement) {
  if (!agreement.agreementEnd) return null;
  const end = new Date(`${agreement.agreementEnd}T23:59:59`);
  return Math.ceil((end - new Date()) / 86400000);
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function VendorAgreements() {
  const [agreements, setAgreements] = useState(readAgreements);
  const [pos, setPos] = useState(readPOs);
  const [org, setOrg] = useState(readOrganization);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poAgreementId, setPoAgreementId] = useState(null);
  const [poForm, setPoForm] = useState(EMPTY_PO);

  useEffect(() => {
    const refresh = () => {
      setOrg(readOrganization());
      setAgreements(readAgreements());
      setPos(readPOs());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("bauerHrmsMastersUpdated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bauerHrmsMastersUpdated", refresh);
    };
  }, []);

  const vendors = activeNames(org.jobRoles, FALLBACK_VENDORS);
  const locations = activeNames(org.locations, FALLBACK_LOCATIONS);
  const groups = activeNames(org.employeeGroups, ["Third Party (Associates)"]);

  const save = (next) => {
    setAgreements(next);
    localStorage.setItem(AGREEMENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("bauerHrmsAgreementsUpdated"));
  };

  const savePOs = (next) => {
    setPos(next);
    localStorage.setItem(PO_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("bauerHrmsPOsUpdated"));
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({ ...EMPTY_FORM, ...item });
    setShowModal(true);
  };


  const openAddPO = (agreementId) => {
    const agreement = agreements.find((x) => x.id === agreementId);
    setPoAgreementId(agreementId);
    setPoForm({
      ...EMPTY_PO,
      location: agreement?.location || "",
      manpowerCategory: agreement?.manpowerCategory || "Third Party (Associates)",
    });
    setShowPOModal(true);
  };

  const editPO = (po) => {
    setPoAgreementId(po.agreementId);
    setPoForm({ ...EMPTY_PO, ...po });
    setShowPOModal(true);
  };

  const submitPO = (e) => {
    e.preventDefault();

    if (!poAgreementId || !poForm.poNumber || !poForm.poStart || !poForm.poEnd) {
      window.alert("Agreement, PO Number, PO Start Date and PO End Date are required.");
      return;
    }

    if (new Date(poForm.poEnd) < new Date(poForm.poStart)) {
      window.alert("PO End Date cannot be before PO Start Date.");
      return;
    }

    const duplicate = pos.some(
      (item) =>
        item.poNumber.toLowerCase() === poForm.poNumber.trim().toLowerCase() &&
        item.id !== poForm.id
    );

    if (duplicate) {
      window.alert("This PO Number already exists.");
      return;
    }

    const clean = {
      ...poForm,
      id: poForm.id || (
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`
      ),
      agreementId: poAgreementId,
      poNumber: poForm.poNumber.trim(),
      poValue: poForm.poValue ? Number(poForm.poValue) : "",
      approvedManpower: poForm.approvedManpower ? Number(poForm.approvedManpower) : "",
    };

    const exists = pos.some((item) => item.id === clean.id);
    savePOs(exists ? pos.map((item) => item.id === clean.id ? clean : item) : [...pos, clean]);

    setShowPOModal(false);
    setPoAgreementId(null);
    setPoForm(EMPTY_PO);
  };

  const deletePO = (id) => {
    if (!window.confirm("Delete this PO record?")) return;
    savePOs(pos.filter((item) => item.id !== id));
  };

  const submit = (e) => {
    e.preventDefault();

    if (!form.vendor || !form.agreementNo || !form.agreementStart || !form.agreementEnd) {
      window.alert("Vendor, Agreement No., Start Date and End Date are required.");
      return;
    }

    if (new Date(form.agreementEnd) < new Date(form.agreementStart)) {
      window.alert("Agreement End Date cannot be before Start Date.");
      return;
    }

    const duplicate = agreements.some(
      (item) =>
        item.agreementNo.toLowerCase() === form.agreementNo.trim().toLowerCase() &&
        item.id !== editingId
    );

    if (duplicate) {
      window.alert("This Agreement No. already exists.");
      return;
    }

    const clean = {
      ...form,
      agreementNo: form.agreementNo.trim(),
      documentName: form.documentName.trim(),
    };

    if (editingId) {
      save(agreements.map((item) => item.id === editingId ? { ...clean, id: editingId } : item));
    } else {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`;
      save([...agreements, { ...clean, id }]);
    }

    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const remove = (id) => {
    if (!window.confirm("Delete this agreement record?")) return;
    save(agreements.filter((item) => item.id !== id));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return agreements
      .map((item) => ({ ...item, calculatedStatus: statusForAgreement(item) }))
      .filter((item) => {
        const matchesSearch =
          !q ||
          [item.vendor, item.agreementNo, item.location, item.agreementType, item.manpowerCategory]
            .join(" ")
            .toLowerCase()
            .includes(q);

        const matchesStatus =
          statusFilter === "ALL" || item.calculatedStatus === statusFilter;

        return matchesSearch && matchesStatus;
      });
  }, [agreements, search, statusFilter]);

  const activeCount = agreements.filter((x) => statusForAgreement(x) === "Active").length;
  const expiringCount = agreements.filter((x) => {
    const status = statusForAgreement(x);
    if (status !== "Active" || !x.agreementEnd) return false;
    const days = (new Date(`${x.agreementEnd}T23:59:59`) - new Date()) / 86400000;
    return days >= 0 && days <= 60;
  }).length;
  const expiredCount = agreements.filter((x) => statusForAgreement(x) === "Expired").length;
  const holdCount = agreements.filter((x) => statusForAgreement(x) === "On Hold").length;


  const activePOs = pos.filter((x) => statusForPO(x) === "Active").length;
  const expiringPOs = pos.filter((x) => {
    if (statusForPO(x) !== "Active") return false;
    const days = daysRemainingPO(x);
    return days !== null && days >= 0 && days <= 60;
  }).length;

  return (
    <section className="vendor-agreements-page">
      <div className="va-head">
        <div>
          <div className="va-eyebrow">ORGANIZATION • CONTRACT MANAGEMENT</div>
          <h1>Vendor / Contractor Agreements</h1>
          <p>
            Maintain vendor agreements, validity, locations and gratuity-related
            contractual provisions for third-party manpower.
          </p>
        </div>
        <button className="va-primary" onClick={openAdd}>＋ Add Agreement</button>
      </div>

      <div className="va-summary">
        <div><span>Total Agreements</span><strong>{agreements.length}</strong></div>
        <div><span>Active</span><strong>{activeCount}</strong></div>
        <div><span>Expiring ≤ 60 Days</span><strong>{expiringCount}</strong></div>
        <div><span>Expired</span><strong>{expiredCount}</strong></div>
        <div><span>On Hold</span><strong>{holdCount}</strong></div>
      </div>

      <div className="va-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor, agreement no., location..."
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="Active">Active</option>
          <option value="Future">Future</option>
          <option value="Expired">Expired</option>
          <option value="On Hold">On Hold</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <button className="va-secondary" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>
          Reset
        </button>
      </div>

      <div className="va-card">
        <div className="va-card-head">
          <div>
            <h2>Agreement Records</h2>
            <span>{filtered.length} records</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="va-empty">
            <div>📄</div>
            <h3>No agreement records yet</h3>
            <p>Add vendor agreements here. The vendor and location dropdowns are connected to Organization Masters.</p>
            <button className="va-primary" onClick={openAdd}>＋ Add Agreement</button>
          </div>
        ) : (
          <div className="va-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vendor / Contractor</th>
                  <th>Agreement No.</th>
                  <th>Validity</th>
                  <th>Location</th>
                  <th>Manpower Category</th>
                  <th>Gratuity</th>
                  <th>Responsibility</th>
                  <th>Status</th>
                  <th>POs</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td><b>{item.vendor}</b></td>
                    <td>{item.agreementNo}</td>
                    <td>{formatDate(item.agreementStart)} → {formatDate(item.agreementEnd)}</td>
                    <td>{item.location || "All Locations"}</td>
                    <td>{item.manpowerCategory}</td>
                    <td>{item.gratuityProvision}</td>
                    <td>{item.gratuityResponsibility}</td>
                    <td>
                      <span className={`va-status ${item.calculatedStatus.toLowerCase().replace(/\\s+/g, "-")}`}>
                        {item.calculatedStatus}
                      </span>
                      {item.calculatedStatus === "Active" && daysRemaining(item) !== null && (
                        <small className="va-days">
                          {daysRemaining(item)} days left
                        </small>
                      )}
                      {item.calculatedStatus === "Expired" && (
                        <small className="va-days expired-text">Expired</small>
                      )}
                    </td>
                    <td>
                      <div className="va-po-summary">
                        <b>{pos.filter((p) => p.agreementId === item.id).length}</b>
                        <span>PO(s)</span>
                      </div>
                      <button className="va-po-add" onClick={() => openAddPO(item.id)}>＋ Add PO</button>
                    </td>
                    <td>
                      <div className="va-actions">
                        <button onClick={() => openEdit(item)}>Edit</button>
                        <button className="danger" onClick={() => remove(item.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="va-card va-po-card">
        <div className="va-card-head va-po-head">
          <div>
            <h2>Manpower Purchase Orders</h2>
            <span>{pos.length} PO records • {activePOs} active • {expiringPOs} expiring within 60 days</span>
          </div>
        </div>

        {pos.length === 0 ? (
          <div className="va-po-empty">
            No manpower PO added yet. Add an agreement first, then add one or more POs under it.
          </div>
        ) : (
          <div className="va-table-wrap">
            <table className="va-po-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Agreement</th>
                  <th>Validity</th>
                  <th>Site / Location</th>
                  <th>Approved Manpower</th>
                  <th>PO Value</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po, index) => {
                  const agreement = agreements.find((x) => x.id === po.agreementId);
                  const poStatus = statusForPO(po);
                  const remaining = daysRemainingPO(po);

                  return (
                    <tr key={po.id}>
                      <td>{index + 1}</td>
                      <td><b>{po.poNumber}</b></td>
                      <td>{agreement?.vendor || "—"}</td>
                      <td>{agreement?.agreementNo || "—"}</td>
                      <td>{formatDate(po.poStart)} → {formatDate(po.poEnd)}</td>
                      <td>{po.location || "All Locations"}</td>
                      <td>{po.approvedManpower ? formatNumber(po.approvedManpower) : "—"}</td>
                      <td>{po.poValue ? `₹${formatNumber(po.poValue)}` : "—"}</td>
                      <td>
                        <span className={`va-status ${poStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                          {poStatus}
                        </span>
                        {poStatus === "Active" && remaining !== null && (
                          <small className="va-days">{remaining} days left</small>
                        )}
                      </td>
                      <td>
                        <div className="va-actions">
                          <button onClick={() => editPO(po)}>Edit</button>
                          <button className="danger" onClick={() => deletePO(po.id)}>Delete</button>
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
        <div className="va-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <form className="va-modal" onSubmit={submit}>
            <div className="va-modal-head">
              <div>
                <div className="va-eyebrow">VENDOR AGREEMENT MASTER</div>
                <h2>{editingId ? "Edit Agreement" : "Add Agreement"}</h2>
              </div>
              <button type="button" className="va-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="va-section">
              <div className="va-section-title">Agreement Details</div>
              <div className="va-grid">
                <label>Vendor / Contractor *
                  <select value={form.vendor} onChange={(e) => update("vendor", e.target.value)}>
                    <option value="">Select Vendor</option>
                    {vendors.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <label>Agreement No. *
                  <input value={form.agreementNo} onChange={(e) => update("agreementNo", e.target.value)} placeholder="e.g. CON/BAUER/2026/01" />
                </label>

                <label>Agreement Start Date *
                  <input type="date" value={form.agreementStart} onChange={(e) => update("agreementStart", e.target.value)} />
                </label>

                <label>Agreement End Date *
                  <input type="date" value={form.agreementEnd} onChange={(e) => update("agreementEnd", e.target.value)} />
                </label>

                <label>Agreement Type
                  <select value={form.agreementType} onChange={(e) => update("agreementType", e.target.value)}>
                    <option>Manpower Supply</option>
                    <option>Service Contract</option>
                    <option>Works Contract</option>
                    <option>Consultancy</option>
                    <option>Other</option>
                  </select>
                </label>

                <label>Site / Location
                  <select value={form.location} onChange={(e) => update("location", e.target.value)}>
                    <option value="">All Locations</option>
                    {locations.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <label>Manpower Category
                  <select value={form.manpowerCategory} onChange={(e) => update("manpowerCategory", e.target.value)}>
                    {groups.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <label>HR Status Control
                  <select value={form.manualStatus} onChange={(e) => update("manualStatus", e.target.value)}>
                    <option value="Auto">Auto (Date Based)</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="va-section">
              <div className="va-section-title">Gratuity / Commercial Provision</div>
              <div className="va-grid">
                <label>Gratuity Provision
                  <select value={form.gratuityProvision} onChange={(e) => update("gratuityProvision", e.target.value)}>
                    <option>As per Agreement</option>
                    <option>Statutory</option>
                    <option>Better Than Statutory</option>
                    <option>Not Specified</option>
                  </select>
                </label>

                <label>Gratuity Responsibility
                  <select value={form.gratuityResponsibility} onChange={(e) => update("gratuityResponsibility", e.target.value)}>
                    <option>Contractor</option>
                    <option>Principal Employer</option>
                    <option>As per Agreement</option>
                  </select>
                </label>

                <label className="va-wide">Better Terms / Special Provision
                  <textarea
                    value={form.betterTerms}
                    onChange={(e) => update("betterTerms", e.target.value)}
                    placeholder="Mention any contractual benefit or special gratuity provision..."
                  />
                </label>
              </div>
            </div>

            <div className="va-section">
              <div className="va-section-title">Documents & Remarks</div>
              <div className="va-grid">
                <label>Agreement Document
                  <input
                    type="text"
                    value={form.documentName}
                    onChange={(e) => update("documentName", e.target.value)}
                    placeholder="Document name / reference (upload module later)"
                  />
                </label>

                <label className="va-wide">Remarks
                  <textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} />
                </label>
              </div>
            </div>

            <div className="va-note">
              <b>Status logic:</b> With <b>Auto (Date Based)</b>, the system calculates
              Future / Active / Expired from the agreement dates. HR can manually put an
              agreement <b>On Hold</b> or <b>Cancelled</b>. An expired agreement cannot
              become Active just by changing a status dropdown.
            </div>

            <div className="va-modal-actions">
              <button type="button" className="va-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="va-primary">{editingId ? "Update Agreement" : "Save Agreement"}</button>
            </div>
          </form>
        </div>
      )}

      {showPOModal && (
        <div className="va-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowPOModal(false)}>
          <form className="va-modal va-po-modal" onSubmit={submitPO}>
            <div className="va-modal-head">
              <div>
                <div className="va-eyebrow">MANPOWER PURCHASE ORDER</div>
                <h2>{poForm.id ? "Edit PO" : "Add Manpower PO"}</h2>
              </div>
              <button type="button" className="va-close" onClick={() => setShowPOModal(false)}>×</button>
            </div>

            <div className="va-section">
              <div className="va-section-title">PO Details</div>
              <div className="va-grid">
                <label>PO Number *
                  <input value={poForm.poNumber} onChange={(e) => setPoForm((p) => ({ ...p, poNumber: e.target.value }))} placeholder="e.g. PO/BAU/2026/001" />
                </label>

                <label>PO Start Date *
                  <input type="date" value={poForm.poStart} onChange={(e) => setPoForm((p) => ({ ...p, poStart: e.target.value }))} />
                </label>

                <label>PO End Date *
                  <input type="date" value={poForm.poEnd} onChange={(e) => setPoForm((p) => ({ ...p, poEnd: e.target.value }))} />
                </label>

                <label>PO Value
                  <input type="number" min="0" value={poForm.poValue} onChange={(e) => setPoForm((p) => ({ ...p, poValue: e.target.value }))} placeholder="₹" />
                </label>

                <label>Site / Location
                  <select value={poForm.location} onChange={(e) => setPoForm((p) => ({ ...p, location: e.target.value }))}>
                    <option value="">All Locations</option>
                    {locations.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <label>Manpower Category
                  <select value={poForm.manpowerCategory} onChange={(e) => setPoForm((p) => ({ ...p, manpowerCategory: e.target.value }))}>
                    {groups.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <label>Approved Manpower / Headcount
                  <input type="number" min="0" value={poForm.approvedManpower} onChange={(e) => setPoForm((p) => ({ ...p, approvedManpower: e.target.value }))} placeholder="e.g. 25" />
                </label>

                <label>Manpower Type / Designation
                  <input value={poForm.manpowerType} onChange={(e) => setPoForm((p) => ({ ...p, manpowerType: e.target.value }))} placeholder="e.g. Civil Engineer / Helper" />
                </label>

                <label>HR Status Control
                  <select value={poForm.manualStatus} onChange={(e) => setPoForm((p) => ({ ...p, manualStatus: e.target.value }))}>
                    <option value="Auto">Auto (Date Based)</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </label>

                <label>PO Document / Reference
                  <input value={poForm.documentName} onChange={(e) => setPoForm((p) => ({ ...p, documentName: e.target.value }))} placeholder="Document name / reference" />
                </label>

                <label className="va-wide">Remarks
                  <textarea value={poForm.remarks} onChange={(e) => setPoForm((p) => ({ ...p, remarks: e.target.value }))} />
                </label>
              </div>
            </div>

            <div className="va-note">
              <b>PO status:</b> Auto mode calculates Future / Active / Expired from PO dates.
              HR can manually put a PO On Hold or Cancelled. Multiple POs can exist for the same vendor and agreement.
            </div>

            <div className="va-modal-actions">
              <button type="button" className="va-secondary" onClick={() => setShowPOModal(false)}>Cancel</button>
              <button type="submit" className="va-primary">{poForm.id ? "Update PO" : "Save PO"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}