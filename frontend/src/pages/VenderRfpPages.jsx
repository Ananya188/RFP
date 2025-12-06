// VenderRfpPages.jsx
import React, { useState, useEffect } from "react";
import {
  getRfpTemplatesApi,
  listVendorsApi,
  getVendorByIdApi,
  sendRfpToVendorsApi,
  getVendorCandidatesApi,
} from "../context/api";

/* ---------- Component ---------- */
const VenderRfpPages = () => {
  // Vendors loaded from API (no local fallback)
  const [vendors, setVendors] = useState([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);

  // RFP templates
  const [rfps, setRfps] = useState([]);
  const [loadingRfps, setLoadingRfps] = useState(false);
  const [rfpError, setRfpError] = useState(null);
  const [selectedRfpId, setSelectedRfpId] = useState("");

  // candidate query options
  const [candidateMode, setCandidateMode] = useState("any"); // 'any' | 'all'
  const [candidateCheckStock, setCandidateCheckStock] = useState(false);

  // candidates result
  const [candidates, setCandidates] = useState([]); // normalized { id, dbId, name, email, ... }
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);

  // Apply button loading (applies template + fetches candidates + merges)
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // whether to attach a JSON copy of the RFP in the email
  const [attachJson, setAttachJson] = useState(true);

  // rfp form
  const [rfpForm, setRfpForm] = useState({
    title: "",
    description: "",
    budget: "",
    dueDate: "",
    subjectOverride: "",
    messageOverride: "",
  });

  // vendor details modal
  const [vendorDetails, setVendorDetails] = useState(null);
  const [loadingVendorDetails, setLoadingVendorDetails] = useState(false);
  const [vendorDetailsError, setVendorDetailsError] = useState(null);

  // request in-flight states
  const [sendingRfp, setSendingRfp] = useState(false);

  // whether any modal/drawer is open (for scroll lock)
  const isAnyModalOpen =
    !!vendorDetails || loadingVendorDetails || !!vendorDetailsError;

  /* ---------- helper: link candidates to vendors by email/name ---------- */
  const linkCandidatesToVendors = (candidatesArray) => {
    if (!Array.isArray(candidatesArray) || candidatesArray.length === 0)
      return candidatesArray;

    return candidatesArray.map((c) => {
      const email = (c.email || "").toLowerCase().trim();
      const name = (c.name || "").toLowerCase().trim();

      const match = vendors.find((v) => {
        const vEmail = (v.email || "").toLowerCase().trim();
        const vName = (v.name || "").toLowerCase().trim();
        return (
          (email && vEmail && vEmail === email) ||
          (name && vName && vName === name)
        );
      });

      if (match) {
        return {
          ...c,
          id: match.id, // UI id aligned with vendors array
          dbId: match.dbId || c.dbId, // real Mongo id
        };
      }

      return c;
    });
  };

  /* ---------- lock body scroll while modal/drawer is open ---------- */
  useEffect(() => {
    if (isAnyModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev || "";
      };
    }
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isAnyModalOpen]);

  /* ---------- load RFP templates ---------- */
  useEffect(() => {
    let mounted = true;
    const loadTemplates = async () => {
      setLoadingRfps(true);
      setRfpError(null);
      try {
        const json = await getRfpTemplatesApi?.({ limit: 200 });
        if (!mounted) return;

        if (json && json.success && Array.isArray(json.data)) {
          setRfps(
            json.data.map((r) => ({
              // IMPORTANT: prefer _id (Mongo) first so /api/rfp/:id/send gets a valid ObjectId
              id: String(r._id ?? r.id ?? r._uid ?? r.uid ?? r.title),
              title: r.title,
              description: r.description || "",
              budget: r.budget ?? "",
              dueDate: r.dueDate ?? "",
              raw: r,
            }))
          );
        } else {
          console.warn("Unexpected templates payload", json);
        }
      } catch (err) {
        console.error("Failed loading RFP templates", err);
        if (!mounted) return;
        setRfpError(err);
      } finally {
        if (mounted) setLoadingRfps(false);
      }
    };

    loadTemplates();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- load vendors from API on mount (no local fallback) ---------- */
  useEffect(() => {
    let mounted = true;
    const loadVendors = async () => {
      try {
        const resp = await listVendorsApi();
        let items = [];
        if (resp == null) throw new Error("Empty vendor response");
        if (Array.isArray(resp)) items = resp;
        else if (resp.success && Array.isArray(resp.data)) items = resp.data;
        else if (resp.data && Array.isArray(resp.data.items))
          items = resp.data.items;
        else if (resp.data && Array.isArray(resp.data)) items = resp.data;
        else if (resp.vendors && Array.isArray(resp.vendors))
          items = resp.vendors;
        else {
          console.warn(
            "Unrecognized vendor payload shape; treating as empty list",
            resp
          );
          items = [];
        }

        const normalized = items.map((v, i) => {
          const dbId = v._id ?? v.id ?? v.vendorId ?? null; // real DB id if present
          return {
            id: String(dbId ?? `vendor-${i}-${Date.now()}`), // UI id
            dbId: dbId ? String(dbId) : null, // DB id used when sending to backend
            name: v.name ?? v.companyName ?? v.title ?? "Unnamed Vendor",
            contactName: v.contactName ?? v.contact_person ?? v.contact ?? "",
            email: v.email ?? v.emailAddress ?? "",
            phone: v.phone ?? v.contactPhone ?? "",
            categories: v.categories ?? (v.category ? [v.category] : []),
            category: v.category ?? undefined,
            rating:
              typeof v.rating === "number"
                ? v.rating
                : v.rating
                ? Number(v.rating)
                : undefined,
            address: v.address ?? undefined,
            catalog: v.catalog ?? undefined,
            raw: v,
          };
        });

        if (mounted) {
          setVendors(normalized);
          setSelectedVendorIds((prev) =>
            prev.filter((id) => normalized.some((nv) => nv.id === id))
          );
        }
      } catch (err) {
        console.error("Error loading vendors:", err);
        if (mounted) {
          // keep vendors empty (no local fallback)
          setVendors([]);
        }
      }
    };

    loadVendors();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- helpers ---------- */

  const handleRfpFormChange = (e) => {
    const { name, value } = e.target;
    setRfpForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectRfp = (e) => {
    const id = e.target.value;
    setSelectedRfpId(id);
  };

  const fetchCandidatesInternal = async (
    rfpId,
    { mode = "any", checkStock = false } = {}
  ) => {
    if (!rfpId) throw new Error("rfpId required");
    const resp = await getVendorCandidatesApi(rfpId, { mode, checkStock });
    return resp;
  };

  // when Apply is clicked: populate form + fetch candidates + merge candidates into vendor list + select them
  const applySelectedTemplate = async () => {
    if (!selectedRfpId) return;

    // populate local rfp form fields from selected template (if exists)
    const chosen = rfps.find((r) => String(r.id) === String(selectedRfpId));
    if (chosen) {
      setRfpForm({
        title: chosen.title || "",
        description: chosen.description || "",
        budget: chosen.budget || "",
        dueDate: chosen.dueDate || "",
        subjectOverride: "",
        messageOverride: "",
      });
    }

    // now fetch candidates and apply them to the vendor list & selection
    setApplyingTemplate(true);
    try {
      const resp = await fetchCandidatesInternal(selectedRfpId, {
        mode: candidateMode,
        checkStock: candidateCheckStock,
      });

      if (!resp) {
        console.warn("Empty candidates response", resp);
        return;
      }

      const arr = Array.isArray(resp.data)
        ? resp.data
        : Array.isArray(resp)
        ? resp
        : [];

      let normalized = arr.map((v, i) => {
        const dbId = v._id ?? v.id ?? v.vendorId ?? null;
        return {
          id: String(dbId ?? `candidate-${i}-${Date.now()}`),
          dbId: dbId ? String(dbId) : null,
          name: v.name ?? v.companyName ?? "Unnamed Vendor",
          contactName: v.contactName ?? v.contact_person ?? "",
          email: v.email ?? "",
          phone: v.phone ?? "",
          categories: v.categories ?? (v.category ? [v.category] : []),
          rating:
            typeof v.rating === "number"
              ? v.rating
              : v.rating
              ? Number(v.rating)
              : undefined,
          matchedCount: v.matchedCount ?? v.matchedCount ?? 0,
          coverage: v.coverage ?? v.coverage ?? 0,
          _score: typeof v._score !== "undefined" ? v._score : v.score ?? null,
          avgPrice: v.avgPrice ?? null,
          hasAllStock: !!v.hasAllStock,
          matchedCatalogItems: v.matchedCatalogItems ?? [],
          raw: v,
        };
      });

      // align candidates with existing vendors (so ids & dbIds line up)
      normalized = linkCandidatesToVendors(normalized);

      if (normalized.length === 0) {
        setCandidates([]);
        setCandidatesError(null);
        alert("No candidate vendors found for this RFP.");
        return;
      }

      // Merge normalized candidates into vendors list, avoiding duplicates by dbId (real vendor)
      setVendors((prev) => {
        const byDbId = new Map(prev.map((p) => [String(p.dbId ?? p.id), p]));
        normalized.forEach((c) => {
          const key = String(c.dbId ?? c.id);
          if (!byDbId.has(key)) {
            byDbId.set(key, {
              id: c.id,
              dbId: c.dbId,
              name: c.name,
              contactName: c.contactName,
              email: c.email,
              phone: c.phone,
              categories: c.categories,
              rating: c.rating,
              catalog: c.matchedCatalogItems ?? [],
              raw: c.raw,
            });
          } else {
            const existing = byDbId.get(key);
            byDbId.set(key, {
              ...existing,
              name: existing.name || c.name,
              contactName: existing.contactName || c.contactName,
              email: existing.email || c.email,
              phone: existing.phone || c.phone,
              categories:
                existing.categories && existing.categories.length
                  ? existing.categories
                  : c.categories,
              rating: existing.rating ?? c.rating,
              catalog:
                existing.catalog ?? c.matchedCatalogItems ?? existing.catalog,
              raw: existing.raw ?? c.raw,
            });
          }
        });
        return Array.from(byDbId.values());
      });

      // set candidates state (so "Find Candidates" box still shows)
      setCandidates(normalized);

      // auto-select the candidate vendor ids in main selection (UI ids)
      setSelectedVendorIds((prev) => {
        const arrPrev = Array.from(new Set(prev));
        normalized.forEach((c) => {
          if (!arrPrev.includes(c.id)) arrPrev.push(c.id);
        });
        return arrPrev;
      });

      alert(
        `Applied template and added ${normalized.length} candidate vendor(s) to the vendor list & selection.`
      );
    } catch (err) {
      console.error("applySelectedTemplate error:", err);
      alert("Failed to fetch/apply vendor candidates. See console for details.");
    } finally {
      setApplyingTemplate(false);
    }
  };

  /* ---------- delete vendor (local) ---------- */
  const handleDeleteVendor = (vendorId) => {
    if (!window.confirm("Are you sure you want to delete this vendor?")) return;
    setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    setSelectedVendorIds((prev) => prev.filter((id) => id !== vendorId));
  };

  /* ---------- select toggle ---------- */
  const handleToggleSelectVendor = (vendorId) => {
    setSelectedVendorIds((prev) =>
      prev.includes(vendorId)
        ? prev.filter((id) => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const handleSelectAll = () => {
    if (selectedVendorIds.length === vendors.length && vendors.length > 0) {
      setSelectedVendorIds([]);
    } else {
      setSelectedVendorIds(vendors.map((v) => v.id));
    }
  };

  /* ---------- CANDIDATES: fetch and manage (manual) ---------- */
  const fetchCandidates = async () => {
    if (!selectedRfpId) {
      alert(
        "Please select an RFP template (or saved RFP) first to find candidates."
      );
      return;
    }

    setLoadingCandidates(true);
    setCandidatesError(null);
    setCandidates([]);
    setSelectedCandidateIds([]);
    try {
      const resp = await fetchCandidatesInternal(selectedRfpId, {
        mode: candidateMode,
        checkStock: candidateCheckStock,
      });

      if (!resp) throw new Error("Empty response from candidates API");

      const arr = Array.isArray(resp.data)
        ? resp.data
        : Array.isArray(resp)
        ? resp
        : [];

      let normalized = arr.map((v, i) => {
        const dbId = v._id ?? v.id ?? v.vendorId ?? null;
        return {
          id: String(dbId ?? `candidate-${i}-${Date.now()}`),
          dbId: dbId ? String(dbId) : null,
          name: v.name ?? v.companyName ?? "Unnamed",
          email: v.email ?? "",
          phone: v.phone ?? "",
          rating:
            typeof v.rating === "number"
              ? v.rating
              : v.rating
              ? Number(v.rating)
              : undefined,
          categories: v.categories ?? [],
          matchedCount: v.matchedCount ?? v.matchedCount,
          coverage: v.coverage ?? v.coverage ?? 0,
          _score: typeof v._score !== "undefined" ? v._score : v.score ?? null,
          avgPrice: v.avgPrice ?? null,
          hasAllStock: !!v.hasAllStock,
          matchedCatalogItems: v.matchedCatalogItems ?? [],
          raw: v,
        };
      });

      // link to vendor list so ids/dbIds match
      normalized = linkCandidatesToVendors(normalized);

      setCandidates(normalized);
    } catch (err) {
      console.error("fetchCandidates error:", err);
      setCandidatesError(err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const toggleSelectCandidate = (candidateId) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const addSelectedCandidatesToSelection = () => {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      selectedCandidateIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
    setSelectedCandidateIds([]);
    alert("Selected candidates added to selection.");
  };

  const selectAllCandidates = () => {
    setSelectedCandidateIds(candidates.map((c) => c.id));
  };

  const clearCandidates = () => {
    setCandidates([]);
    setSelectedCandidateIds([]);
    setCandidatesError(null);
  };

  /* ---------- send RFP (real API call) ---------- */
  const handleSendRfp = async () => {
    if (!selectedRfpId) {
      alert(
        "Please select an RFP template (or saved RFP) to send. The backend requires an RFP ID."
      );
      return;
    }

    if (!rfpForm.title.trim() || !rfpForm.description.trim()) {
      alert("RFP title and description are required.");
      return;
    }
    if (selectedVendorIds.length === 0) {
      alert("Please select at least one vendor to send the RFP to.");
      return;
    }

    // Map UI vendor IDs -> real Mongo IDs (dbId)
    const vendorIds = selectedVendorIds
      .map((uiId) => vendors.find((v) => v.id === uiId)?.dbId)
      .filter(Boolean);

    if (vendorIds.length === 0) {
      alert(
        "No valid vendors with database IDs selected. Make sure your vendors are coming from the backend (with _id)."
      );
      return;
    }

    const payload = {
      vendorIds, // IMPORTANT: send real Mongo IDs
      subject: rfpForm.subjectOverride?.trim() || rfpForm.title,
      message: rfpForm.messageOverride?.trim() || rfpForm.description,
      attachJson: !!attachJson,
    };

    setSendingRfp(true);
    try {
      const resp = await sendRfpToVendorsApi(selectedRfpId, payload);

      if (resp && resp.success) {
        // optional: still keep local RFP list in sync
        if (resp.rfp) {
          const updatedRfp = resp.rfp;
          setRfps((prev) =>
            prev.map((r) =>
              String(r.id) === String(updatedRfp._id ?? updatedRfp.id)
                ? {
                    id: String(updatedRfp._id ?? updatedRfp.id),
                    title: updatedRfp.title ?? r.title,
                    description: updatedRfp.description ?? r.description,
                    budget: updatedRfp.budget ?? r.budget,
                    dueDate: updatedRfp.dueDate ?? r.dueDate,
                    raw: updatedRfp,
                  }
                : r
            )
          );
        }

        alert("Successfully sent");
      } else {
        alert("Failed to send");
      }
    } catch (err) {
      console.error("Error sending RFP to vendors:", err);
      alert("Failed to send");
    } finally {
      setSendingRfp(false);
    }
  };

  const snippet = (text = "", max = 140) =>
    text.length > max ? text.slice(0, max - 1) + "…" : text;

  /* ---------- vendor details popup ---------- */
  const openVendorDetails = async (vendorOrId) => {
    const vendorId =
      typeof vendorOrId === "string"
        ? vendorOrId
        : vendorOrId?.dbId || vendorOrId?.id;

    if (!vendorId) {
      console.warn("openVendorDetails called without a valid vendor id");
      return;
    }

    setVendorDetailsError(null);
    setVendorDetails(null);
    setLoadingVendorDetails(true);
    try {
      const resp = await getVendorByIdApi(vendorId);
      let vd = null;
      if (resp == null) throw new Error("Empty response");
      if (resp.success && resp.data) vd = resp.data;
      else if (resp.data) vd = resp.data;
      else vd = resp;
      vd = { ...vd, id: String(vd._id ?? vd.id ?? vendorId) };
      setVendorDetails(vd);
    } catch (err) {
      console.error("Failed to load vendor details", err);
      setVendorDetailsError(err);
    } finally {
      setLoadingVendorDetails(false);
    }
  };

  const closeVendorDetails = () => {
    setVendorDetails(null);
    setVendorDetailsError(null);
  };

  /* ---------- UI (dark theme aligned with dashboard) ---------- */
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-100">
              Vendor Management &amp; RFP Sending
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Maintain your vendor master data, select vendors, and send RFPs
              via email.
            </p>

            {/* Template control directly under subtitle (compact, titles-only) */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex w-full items-center gap-2 sm:w-1/2">
                <label htmlFor="rfpSelect" className="sr-only">
                  Choose RFP template
                </label>
                <select
                  id="rfpSelect"
                  value={selectedRfpId}
                  onChange={handleSelectRfp}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  <option value="">
                    {loadingRfps
                      ? "Loading templates…"
                      : "— Select template (titles only) —"}
                  </option>
                  {rfps.map((r) => (
                    <option
                      key={r.id}
                      value={r.id}
                      className="bg-slate-800 text-slate-200"
                    >
                      {r.title}
                    </option>
                  ))}
                </select>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={applySelectedTemplate}
                    disabled={!selectedRfpId || loadingRfps || applyingTemplate}
                    className={`inline-flex items-center gap-1 rounded px-3 py-2 text-xs font-medium shadow-sm ${
                      selectedRfpId && !loadingRfps
                        ? "bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    }`}
                    aria-disabled={
                      !selectedRfpId || loadingRfps || applyingTemplate
                    }
                  >
                    {applyingTemplate
                      ? "Applying…"
                      : loadingRfps
                      ? "Loading…"
                      : "Apply"}
                  </button>
                </div>
              </div>
            </div>

            {/* Template preview (compact) */}
            {selectedRfpId && (
              <div className="mt-3 max-w-2xl rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm">
                {(() => {
                  const t = rfps.find((r) => r.id === selectedRfpId);
                  if (!t)
                    return (
                      <div className="text-slate-500">Template not found.</div>
                    );
                  return (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">
                          {t.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Budget: {t.budget ? `₹ ${t.budget}` : "—"}
                        </div>
                        <div className="mt-2 text-xs text-slate-200 whitespace-pre-line">
                          {snippet(t.description, 220)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={applySelectedTemplate}
                          className="rounded bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => setSelectedRfpId("")}
                          className="text-xs text-slate-400 hover:underline"
                        >
                          Deselect
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {rfpError && (
              <div className="mt-3 max-w-2xl rounded-lg border border-rose-600/40 bg-rose-900/10 p-3 text-sm text-rose-200">
                Failed to load templates. Check console for details.
              </div>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* RFP panel */}
          <section className="col-span-1 lg:col-span-2 flex flex-col rounded-xl bg-slate-800/60 p-4 ring-1 ring-slate-700">
            <h2 className="mb-3 text-lg font-semibold text-slate-100">
              RFP Details, Candidates &amp; Email
            </h2>

            <div className="flex-1 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    RFP Title*
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={rfpForm.title}
                    onChange={handleRfpFormChange}
                    placeholder="e.g. Laptops & Monitors for New Office"
                    className="block w-full rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Budget (optional)
                  </label>
                  <input
                    type="number"
                    name="budget"
                    value={rfpForm.budget}
                    onChange={handleRfpFormChange}
                    placeholder="50000"
                    className="block w-full rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Response Due Date (optional)
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={rfpForm.dueDate}
                    onChange={handleRfpFormChange}
                    className="block w-full rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Email Subject (optional)
                </label>
                <input
                  type="text"
                  name="subjectOverride"
                  value={rfpForm.subjectOverride}
                  onChange={handleRfpFormChange}
                  placeholder="Optional override for email subject"
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  RFP Email Body*
                </label>
                <textarea
                  name="description"
                  value={rfpForm.description}
                  onChange={handleRfpFormChange}
                  rows={7}
                  placeholder={`Dear Vendor,\n\nWe are inviting you to submit a proposal for supplying laptops and monitors for our new office.\n\nKind regards,\nProcurement Team`}
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={attachJson}
                    onChange={(e) => setAttachJson(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                  />
                  Attach RFP JSON to email
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="text-xs text-slate-400">Candidate mode:</span>
                  <select
                    value={candidateMode}
                    onChange={(e) => setCandidateMode(e.target.value)}
                    className="rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="any">any</option>
                    <option value="all">all</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={candidateCheckStock}
                    onChange={(e) => setCandidateCheckStock(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                  />
                  Check stock
                </label>

                <div className="ml-auto text-xs text-slate-400">
                  Selected template:{" "}
                  <span className="font-semibold text-slate-100">
                    {selectedRfpId ? selectedRfpId : "—"}
                  </span>
                </div>
              </div>

              {/* Candidate controls */}
              <div className="flex gap-2">
                <button
                  onClick={fetchCandidates}
                  disabled={!selectedRfpId || loadingCandidates}
                  className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20"
                >
                  {loadingCandidates ? "Finding…" : "Find Candidates"}
                </button>

                <button
                  onClick={selectAllCandidates}
                  disabled={candidates.length === 0}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/40"
                >
                  Select All Candidates
                </button>

                <button
                  onClick={addSelectedCandidatesToSelection}
                  disabled={selectedCandidateIds.length === 0}
                  className="rounded-lg border border-emerald-300 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-400/10"
                >
                  Add Selected → Selection
                </button>

                <button
                  onClick={clearCandidates}
                  disabled={candidates.length === 0}
                  className="rounded-lg border border-rose-500 px-3 py-2 text-xs text-rose-300 hover:bg-rose-900/10"
                >
                  Clear Candidates
                </button>
              </div>

              {/* Candidates result box */}
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-sm">
                {loadingCandidates ? (
                  <div className="py-6 text-slate-400">
                    Finding candidates…
                  </div>
                ) : candidatesError ? (
                  <div className="py-4 text-rose-400">
                    Failed to fetch candidates. Check console for details.
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="py-4 text-slate-400">
                    No candidates. Click "Find Candidates" to search vendors
                    that match this RFP.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div>Found {candidates.length} candidate(s)</div>
                      <div>
                        Selected:{" "}
                        <span className="font-semibold text-slate-100">
                          {selectedCandidateIds.length}
                        </span>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-700 text-sm">
                        <thead className="sticky top-0 bg-slate-900/60">
                          <tr>
                            <th className="px-2 py-2 text-left w-8"></th>
                            <th className="px-2 py-2 text-left text-slate-300">
                              Vendor
                            </th>
                            <th className="px-2 py-2 text-left text-slate-300">
                              Email
                            </th>
                            <th className="px-2 py-2 text-left text-slate-300">
                              Matched
                            </th>
                            <th className="px-2 py-2 text-left text-slate-300">
                              Coverage
                            </th>
                            <th className="px-2 py-2 text-left text-slate-300">
                              Score
                            </th>
                            <th className="px-2 py-2 text-left text-slate-300">
                              Avg Price
                            </th>
                            <th className="px-2 py-2 text-left text-slate-300">
                              Has All Stock
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {candidates.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-900/50">
                              <td className="px-2 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedCandidateIds.includes(c.id)}
                                  onChange={() => toggleSelectCandidate(c.id)}
                                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-300"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => openVendorDetails(c)}
                                  className="text-left text-sm font-medium text-emerald-300 hover:underline"
                                >
                                  {c.name}
                                </button>
                              </td>
                              <td className="px-2 py-2 text-slate-300">
                                {c.email || "—"}
                              </td>
                              <td className="px-2 py-2 text-slate-300">
                                {c.matchedCount ?? "-"}
                              </td>
                              <td className="px-2 py-2 text-slate-300">
                                {(c.coverage || 0) > 0
                                  ? `${Math.round(
                                      (c.coverage || 0) * 100
                                    )}%`
                                  : "-"}
                              </td>
                              <td className="px-2 py-2 text-slate-300">
                                {typeof c._score !== "undefined" &&
                                c._score !== null
                                  ? c._score
                                  : "-"}
                              </td>
                              <td className="px-2 py-2 text-slate-300">
                                {c.avgPrice != null ? `₹ ${c.avgPrice}` : "-"}
                              </td>
                              <td className="px-2 py-2 text-slate-300">
                                {c.hasAllStock ? "Yes" : "No"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* optional preview of first candidate's matched items */}
                    <div>
                      <div className="text-xs text-slate-400">
                        Preview matched catalog items (first 3 of first
                        candidate)
                      </div>
                      <pre className="mt-2 max-h-28 overflow-auto text-xs text-slate-300 bg-slate-900/30 p-2 rounded">
                        {JSON.stringify(
                          candidates[0]?.matchedCatalogItems?.slice(0, 3) ??
                            [],
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-slate-700 pt-4 text-sm sm:flex-row sm:items-center">
              <p className="text-xs text-slate-400">
                RFP will be emailed to{" "}
                <span className="font-semibold text-slate-100">
                  {selectedVendorIds.length}
                </span>{" "}
                selected vendor(s).
              </p>
              <button
                onClick={handleSendRfp}
                className="inline-flex items-center justify-center rounded-xl border border-transparent bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 shadow-sm transition hover:bg-emerald-400/20 focus:outline-none disabled:opacity-60"
                disabled={vendors.length === 0 || sendingRfp}
              >
                {sendingRfp ? "Sending..." : "Send RFP Emails"}
              </button>
            </div>
          </section>
        </div>

        {/* ---------- CENTERED VENDOR DETAILS MODAL (robust) ---------- */}
        {(vendorDetails || loadingVendorDetails || vendorDetailsError) && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
            aria-modal="true"
            role="dialog"
          >
            <div className="relative w-full max-w-2xl rounded-xl bg-slate-900 p-5 shadow-xl ring-1 ring-slate-700">
              {/* Close button */}
              <button
                onClick={closeVendorDetails}
                aria-label="Close vendor details"
                className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm font-medium text-slate-200 hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                style={{ zIndex: 9999 }}
              >
                ✕
              </button>

              {/* Header */}
              <div className="mb-3 pt-1">
                <h3 className="text-lg font-semibold text-slate-100">
                  {vendorDetails
                    ? vendorDetails.name
                    : loadingVendorDetails
                    ? "Loading…"
                    : "Vendor details"}
                </h3>
                {vendorDetails?.email && (
                  <p className="mt-1 text-xs text-slate-400">
                    {vendorDetails.email}
                  </p>
                )}
              </div>

              {/* Body */}
              <div className="max-h-[60vh] overflow-auto pr-2">
                {loadingVendorDetails && (
                  <div className="py-6 text-slate-400">
                    Loading vendor information…
                  </div>
                )}
                {vendorDetailsError && (
                  <div className="py-6 text-rose-400">
                    Failed to load details. Check console for error.
                  </div>
                )}

                {vendorDetails && (
                  <div className="space-y-4 text-sm text-slate-200">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-xs text-slate-400">Contact</div>
                        <div className="font-medium">
                          {vendorDetails.contactName ?? "—"}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {vendorDetails.phone ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Email</div>
                        <div className="font-medium">
                          {vendorDetails.email ?? "—"}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Rating: {vendorDetails.rating ?? "—"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">Categories</div>
                      <div className="font-medium">
                        {(vendorDetails.categories &&
                          vendorDetails.categories.join(", ")) ||
                          vendorDetails.category ||
                          "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">Address</div>
                      <div className="whitespace-pre-line">
                        {vendorDetails.address || "—"}
                      </div>
                    </div>

                    {vendorDetails.catalog &&
                      Array.isArray(vendorDetails.catalog) && (
                        <div>
                          <div className="text-xs text-slate-400">
                            Catalog
                          </div>
                          <div className="mt-2 space-y-2">
                            {vendorDetails.catalog.map((it, idx) => (
                              <div
                                key={idx}
                                className="rounded border border-slate-700 p-3 bg-slate-800/40"
                              >
                                <div className="font-medium">
                                  {it.name || "Unnamed"}
                                </div>
                                <div className="text-xs text-slate-400">
                                  Price: {it.price ?? "—"} • Stock:{" "}
                                  {it.stock ?? "—"}
                                </div>
                                {it.meta && (
                                  <pre className="mt-2 max-h-40 overflow-auto text-xs text-slate-300">
                                    {JSON.stringify(it.meta, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    <div>
                      <div className="text-xs text-slate-400">Raw</div>
                      <pre className="mt-2 max-h-48 overflow-auto text-xs text-slate-400 bg-slate-900/30 p-2 rounded">
                        {JSON.stringify(
                          vendorDetails.raw ?? vendorDetails,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={closeVendorDetails}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900/40"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VenderRfpPages;
