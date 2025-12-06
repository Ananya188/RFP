import React, { useEffect, useState } from "react";
import axios from "axios";
import { aiRecommendForRfpApi, getRfpTemplatesApi } from "../context/api";


export default function AiRfpRecommendations({ rfpList: initialRfps = null, onApply = null }) {
  const [rfps, setRfps] = useState(initialRfps || []);
  const [selectedRfp, setSelectedRfp] = useState(null);
  const [loadingRfps, setLoadingRfps] = useState(false);

  // templates
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // AI
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    // if rfp list passed in props, use it
    if (initialRfps) {
      setRfps(initialRfps);
      if (initialRfps.length) setSelectedRfp(initialRfps[0].id ?? initialRfps[0]._id);
    } else {
      // try to fetch rfps from backend
      const fetchRfps = async () => {
        setLoadingRfps(true);
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL;
          const res = await axios.get(`${backendUrl}/api/rfp`);
          setRfps(res.data || []);
          if ((res.data || []).length) setSelectedRfp(res.data[0].id ?? res.data[0]._id);
        } catch (err) {
          console.warn("Could not auto-fetch RFP list:", err.message || err);
        } finally {
          setLoadingRfps(false);
        }
      };
      fetchRfps();
    }

    // fetch templates
    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const t = await getRfpTemplatesApi();
        // Accept either array or object with .templates
        const data = Array.isArray(t) ? t : t?.templates ?? [];
        setTemplates(data);
        if (data.length) setSelectedTemplate(data[0].id ?? data[0]._id);
      } catch (err) {
        console.warn("Could not fetch templates:", err?.message ?? err);
      } finally {
        setTemplatesLoading(false);
      }
    };
    fetchTemplates();
  }, [initialRfps]);

  const handleSelectRfp = (e) => {
    setSelectedRfp(e.target.value || null);
    setRecommendations([]);
    setAiError(null);
  };

  const handleSelectTemplate = (e) => {
    setSelectedTemplate(e.target.value || null);
  };

  const fetchAi = async () => {
    if (!selectedRfp) {
      setAiError("Please select an RFP first.");
      return;
    }
    setLoadingAi(true);
    setAiError(null);
    setRecommendations([]);
    try {
      const res = await aiRecommendForRfpApi(selectedRfp);
      // expected shape: { recommendations: [...] } or array directly
      const data = res?.recommendations ?? res ?? [];
      // normalize entries: ensure vendorId, name, score, reason exist
      const normalized = (Array.isArray(data) ? data : []).map((r, i) => ({
        _localId: `rec-${i}`,
        vendorId: r.vendorId ?? r.id ?? r._id ?? null,
        vendorName: r.vendorName ?? r.name ?? r.vendor?.name ?? "Unknown Vendor",
        email: r.vendor?.email ?? r.email ?? null,
        contact: r.vendor?.contact ?? r.contact ?? r.contactName ?? null,
        score: typeof r.score !== "undefined" ? r.score : r.confidence ?? null,
        reason: r.reason ?? r.explanation ?? r.note ?? "No justification provided.",
        categories: r.categories ?? r.vendor?.categories ?? [],
        raw: r,
        selected: false,
      }));
      setRecommendations(normalized);
    } catch (err) {
      console.error(err);
      setAiError((err && err.message) || "Failed to fetch AI recommendations.");
    } finally {
      setLoadingAi(false);
    }
  };

  const toggleSelectRec = (idx) => {
    setRecommendations((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  };

  const handleApply = () => {
    const vendorIds = recommendations
      .filter((r) => r.selected)
      .map((r) => r.vendorId)
      .filter(Boolean);

    if (!vendorIds.length) {
      // fall back to selecting all recommendations if none explicitly selected
      const fallback = recommendations.map((r) => r.vendorId).filter(Boolean);
      if (fallback.length) {
        if (typeof onApply === "function") onApply(fallback);
      }
      return;
    }

    if (typeof onApply === "function") onApply(vendorIds);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(recommendations.map(r => r.raw ?? r), null, 2));
      alert("Recommendations copied to clipboard");
    } catch (e) {
      alert("Unable to copy to clipboard: " + (e.message || e));
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(recommendations.map(r => r.raw ?? r), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfp-${selectedRfp ?? "recommendations"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount = recommendations.filter((r) => r.selected).length;

  // find selected template object for preview
  const selectedTemplateObj = templates.find((t) => (t.id ?? t._id) === selectedTemplate);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="bg-white shadow-md rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left column: selectors and actions */}
          <div className="w-full lg:w-1/3 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select RFP</label>
              <select
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={selectedRfp ?? ""}
                onChange={handleSelectRfp}
              >
                {loadingRfps && <option>Loading RFPs...</option>}
                {!loadingRfps && rfps.length === 0 && <option value="">No RFPs found</option>}
                {!loadingRfps &&
                  rfps.map((r) => {
                    const key = r.id ?? r._id ?? r._id;
                    return (
                      <option key={key} value={r.id ?? r._id ?? r._id}>
                        {r.title ?? r.name ?? `RFP ${r.id ?? r._id}`}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFP Templates</label>
              <select
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={selectedTemplate ?? ""}
                onChange={handleSelectTemplate}
              >
                {templatesLoading && <option>Loading templates...</option>}
                {!templatesLoading && templates.length === 0 && <option value="">No templates</option>}
                {!templatesLoading &&
                  templates.map((t) => (
                    <option key={t.id ?? t._id ?? t.title} value={t.id ?? t._id}>
                      {t.title ?? `Template ${t.id ?? t._id}`}
                    </option>
                  ))}
              </select>

              {selectedTemplateObj && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  <div className="text-sm font-semibold">{selectedTemplateObj.title}</div>
                  <div className="text-xs text-gray-600 mt-1 whitespace-pre-line">
                    {selectedTemplateObj.description ?? "No description available."}
                  </div>
                  {selectedTemplateObj.fields?.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      <span className="font-medium">Fields:</span>{" "}
                      {selectedTemplateObj.fields.map((f) => f.name ?? f).join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={fetchAi}
                disabled={loadingAi || !selectedRfp}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                {loadingAi ? "Finding..." : "Get AI Recommendations"}
              </button>

              <button
                onClick={() => {
                  setRecommendations([]);
                  setAiError(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            </div>

            <div className="pt-2">
              <div className="text-sm text-gray-600">Actions</div>
              <div className="mt-2 flex gap-2">
                <button onClick={handleCopy} className="px-3 py-1 border rounded text-sm">
                  Copy JSON
                </button>
                <button onClick={handleExportJson} className="px-3 py-1 border rounded text-sm">
                  Export JSON
                </button>
                <button
                  onClick={handleApply}
                  className="ml-auto px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  Apply {selectedCount > 0 && `(${selectedCount})`}
                </button>
              </div>
            </div>
          </div>

          {/* Right column: recommendations / preview */}
          <div className="w-full lg:w-2/3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">AI Recommendations</h3>
              <div className="text-sm text-gray-500">{recommendations.length} recommendation(s)</div>
            </div>

            <div className="mt-3">
              {aiError && <div className="text-red-600 text-sm">{aiError}</div>}

              {!aiError && recommendations.length === 0 && !loadingAi && (
                <div className="text-sm text-gray-500">No recommendations yet. Click "Get AI Recommendations" to fetch suggestions.</div>
              )}

              {loadingAi && (
                <div className="mt-4 animate-pulse space-y-3">
                  <div className="h-14 bg-gray-100 rounded" />
                  <div className="h-14 bg-gray-100 rounded" />
                  <div className="h-14 bg-gray-100 rounded" />
                </div>
              )}

              {recommendations.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={rec.vendorId ?? rec._localId}
                      className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm ${rec.selected ? "ring-2 ring-indigo-200" : ""}`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <input
                          type="checkbox"
                          checked={!!rec.selected}
                          onChange={() => toggleSelectRec(idx)}
                          className="h-5 w-5 rounded"
                        />

                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">{rec.vendorName}</div>
                              <div className="text-xs text-gray-500">{rec.contact ?? ""}</div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-semibold">
                                {rec.score !== null ? (typeof rec.score === "number" ? rec.score.toFixed(2) : rec.score) : "—"}
                              </div>
                              <div className="text-xs text-gray-500">score</div>
                            </div>
                          </div>

                          <div className="mt-2 text-sm text-gray-700">{rec.reason}</div>

                          {rec.categories?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rec.categories.map((c, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-2">
                        <button
                          className="px-3 py-1 border rounded text-sm"
                          onClick={() => navigator.clipboard?.writeText(JSON.stringify(rec.raw ?? rec, null, 2))}
                        >
                          Copy
                        </button>

                        <a
                          className={`px-3 py-1 border rounded text-sm ${!(rec.email) ? "opacity-60 pointer-events-none" : ""}`}
                          href={`mailto:${rec.email ?? ""}`}
                          onClick={(e) => {
                            if (!rec.email) e.preventDefault();
                          }}
                        >
                          Email
                        </a>

                        <button
                          className={`px-3 py-1 rounded text-sm ${rec.selected ? "bg-gray-200" : "bg-indigo-600 text-white"}`}
                          onClick={() => toggleSelectRec(idx)}
                        >
                          {rec.selected ? "Selected" : "Select"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
