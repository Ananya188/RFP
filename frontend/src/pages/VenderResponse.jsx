// src/pages/VenderResponse.jsx
import React, { useState, useEffect } from "react";

// --- Mock data (replace later with real API) ---
const MOCK_RFPS = [
  { id: "RFP-001", title: "Laptops & Monitors for New Office" },
  { id: "RFP-002", title: "Cloud Hosting & Support" },
];

const MOCK_RESPONSES = [
  {
    id: "VR-001",
    rfpId: "RFP-001",
    vendorName: "TechWorld Supplies",
    vendorEmail: "sales@techworld.com",
    subject: "Re: RFP-001 – Laptop & Monitor Proposal",
    receivedAt: "2025-12-02T10:15:00Z",
    status: "parsed", // "pending" | "parsed" | "error"
    rawBody: `
Hi Team,

Please find our proposal:

- Laptops: 30 units, i7, 16GB RAM, 512GB SSD
  Unit Price: $1,100
- Monitors: 30 units, 27", 2K
  Unit Price: $260

Total (approx): $40,800
Delivery: within 21 days from PO
Payment terms: 50% advance, 50% on delivery
Validity: Proposal valid for 15 days.

Regards,
Ankit
TechWorld Supplies
    `,
    attachments: [
      { name: "TechWorld_Proposal_RFP-001.pdf", size: "320 KB" },
      { name: "Product_Specs.xlsx", size: "95 KB" },
    ],
    parsedProposal: {
      currency: "USD",
      totalApprox: 40800,
      deliveryTimeline: "21 days from PO",
      paymentTerms: "50% advance, 50% on delivery",
      validity: "15 days",
      notes: "Pricing is approximate; subject to final BOQ.",
      lineItems: [
        {
          id: 1,
          item: "Laptop",
          description: "Intel i7, 16GB RAM, 512GB SSD",
          quantity: 30,
          unitPrice: 1100,
          total: 33000,
        },
        {
          id: 2,
          item: "Monitor",
          description: '27" 2K Monitor',
          quantity: 30,
          unitPrice: 260,
          total: 7800,
        },
      ],
    },
  },
  {
    id: "VR-002",
    rfpId: "RFP-001",
    vendorName: "DigitalEdge Systems",
    vendorEmail: "quotes@digitaledge.io",
    subject: "Laptop & Monitor Quote",
    receivedAt: "2025-12-02T09:45:00Z",
    status: "pending",
    rawBody: `
Hello,

Attached is our detailed quotation for RFP-001.

Highlights:
- Laptops: 30 units, unit price $1,050
- Monitors: 30 units, unit price $280
- Total: $39,900
- Delivery: 30 days
- Payment: Net 30 days

Regards,
DigitalEdge Systems
    `,
    attachments: [{ name: "DigitalEdge_RFP-001_Quote.pdf", size: "410 KB" }],
    parsedProposal: null, // Not parsed yet
  },
];

// --- Helper components ---
const StatusBadge = ({ status }) => {
  const map = {
    parsed: {
      text: "Parsed",
      className:
        "bg-emerald-500/10 text-emerald-300 border border-emerald-500/50",
    },
    pending: {
      text: "Pending Parsing",
      className:
        "bg-amber-500/10 text-amber-300 border border-amber-500/50",
    },
    error: {
      text: "Error",
      className: "bg-red-500/10 text-red-300 border border-red-500/50",
    },
  };

  const cfg = map[status] || map["pending"];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5" />
      {cfg.text}
    </span>
  );
};

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-100 border border-slate-700">
    {children}
  </span>
);

const formatDateTime = (isoStr) => {
  try {
    return new Date(isoStr).toLocaleString();
  } catch {
    return isoStr;
  }
};

// --- Main Page (used inside Layout's <Outlet />) ---
function VenderResponse() {
  const [rfps] = useState(MOCK_RFPS);
  const [responses, setResponses] = useState(MOCK_RESPONSES);
  const [selectedRfpId, setSelectedRfpId] = useState("RFP-001");
  const [selectedResponseId, setSelectedResponseId] = useState("VR-001");
  const [search, setSearch] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const filteredResponses = responses.filter((resp) => {
    const matchesRfp =
      !selectedRfpId || resp.rfpId.toLowerCase() === selectedRfpId.toLowerCase();
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      resp.vendorName.toLowerCase().includes(term) ||
      resp.subject.toLowerCase().includes(term) ||
      resp.vendorEmail.toLowerCase().includes(term);

    return matchesRfp && matchesSearch;
  });

  const selectedResponse =
    responses.find((r) => r.id === selectedResponseId) || filteredResponses[0];

  useEffect(() => {
    if (!selectedResponse && filteredResponses.length > 0) {
      setSelectedResponseId(filteredResponses[0].id);
    }
  }, [filteredResponses, selectedResponse]);

  const handleRunParsing = async () => {
    if (!selectedResponse) return;
    setIsParsing(true);

    // Later: replace with real API call
    // await fetch(`/api/vendor-responses/${selectedResponse.id}/parse`, { method: "POST" })
    setTimeout(() => {
      setResponses((prev) =>
        prev.map((resp) =>
          resp.id === selectedResponse.id
            ? {
                ...resp,
                status: "parsed",
                parsedProposal:
                  resp.parsedProposal ||
                  {
                    currency: "USD",
                    totalApprox: 39900,
                    deliveryTimeline: "30 days",
                    paymentTerms: "Net 30 days",
                    validity: "30 days",
                    notes:
                      "Auto-parsed from email body. Please review before finalizing.",
                    lineItems: [
                      {
                        id: 1,
                        item: "Laptop",
                        description: "Standard laptop as per RFP",
                        quantity: 30,
                        unitPrice: 1050,
                        total: 31500,
                      },
                      {
                        id: 2,
                        item: "Monitor",
                        description: "Standard monitor as per RFP",
                        quantity: 30,
                        unitPrice: 280,
                        total: 8400,
                      },
                    ],
                  },
              }
            : resp
        )
      );
      setIsParsing(false);
    }, 800);
  };

  return (
    <div className="space-y-4">
      {/* Local page header (inside dashboard, not full navbar) */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-50">
            Vendor Responses & AI Parsing
          </h2>
          <p className="text-xs md:text-sm text-slate-400">
            View inbound vendor emails, run AI extraction, and manage structured
            proposals for comparison.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill>Inbound email connected</Pill>
          <Pill>AI parsing enabled</Pill>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-md flex flex-col min-h-[520px]">
        {/* Main layout (no h-screen; contained in card) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left pane: Filters + list */}
          <section className="w-full md:w-[360px] border-r border-slate-800 bg-slate-950/40 flex flex-col">
            {/* Filters */}
            <div className="p-4 space-y-3 border-b border-slate-800">
              <div>
                <label
                  htmlFor="rfpSelect"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Filter by RFP
                </label>
                <select
                  id="rfpSelect"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={selectedRfpId}
                  onChange={(e) => setSelectedRfpId(e.target.value)}
                >
                  <option value="">All RFPs</option>
                  {rfps.map((rfp) => (
                    <option key={rfp.id} value={rfp.id}>
                      {rfp.id} – {rfp.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="search"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Search vendors / subject
                </label>
                <div className="relative">
                  <input
                    id="search"
                    type="text"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-500"
                    placeholder="Search by vendor, subject, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 text-xs">
                    ⌕
                  </span>
                </div>
              </div>
            </div>

            {/* List of responses */}
            <div className="flex-1 overflow-y-auto">
              {filteredResponses.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">
                  No responses found. Try adjusting filters.
                </div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {filteredResponses.map((resp) => (
                    <li
                      key={resp.id}
                      className={`cursor-pointer px-4 py-3 text-sm transition-colors ${
                        resp.id === selectedResponseId
                          ? "bg-slate-800/80 border-l-2 border-emerald-500"
                          : "hover:bg-slate-900/70"
                      }`}
                      onClick={() => setSelectedResponseId(resp.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-50">
                          {resp.vendorName}
                        </div>
                        <StatusBadge status={resp.status} />
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {resp.subject}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{resp.rfpId}</span>
                        <span>{formatDateTime(resp.receivedAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Right pane: Details */}
          <section className="flex-1 flex flex-col bg-slate-950/30">
            {selectedResponse ? (
              <>
                {/* Header */}
                <div className="border-b border-slate-800 px-6 py-3 flex items-center justify-between bg-slate-950/60">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-50">
                        {selectedResponse.vendorName}
                      </h3>
                      <span className="text-xs text-slate-400">
                        &lt;{selectedResponse.vendorEmail}&gt;
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {selectedResponse.subject}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {selectedResponse.rfpId} •{" "}
                      {formatDateTime(selectedResponse.receivedAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedResponse.status} />
                    <button
                      type="button"
                      onClick={handleRunParsing}
                      disabled={isParsing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm hover:bg-emerald-400 disabled:bg-emerald-700/60 disabled:text-slate-300 disabled:cursor-not-allowed"
                    >
                      {isParsing ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900 border-b-transparent" />
                          Parsing…
                        </>
                      ) : (
                        <>
                          <span>⚙️</span>
                          Run AI Parsing
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Content: split raw vs parsed */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden">
                  {/* Raw email / message */}
                  <div className="border-r border-slate-800 bg-slate-950/40 flex flex-col">
                    <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Raw Vendor Email
                      </h4>
                      <span className="text-[10px] text-slate-500">
                        As received from email inbox
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      <pre className="whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs text-slate-100 border border-slate-800 font-mono">
                        {selectedResponse.rawBody.trim()}
                      </pre>

                      {/* Attachments */}
                      {selectedResponse.attachments?.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs font-semibold text-slate-100 mb-1">
                            Attachments
                          </div>
                          <ul className="space-y-1">
                            {selectedResponse.attachments.map((att, idx) => (
                              <li
                                key={idx}
                                className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">📎</span>
                                  <span className="text-slate-100">
                                    {att.name}
                                  </span>
                                </div>
                                <span className="text-slate-500">
                                  {att.size}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Parsed proposal */}
                  <div className="bg-slate-950/30 flex flex-col">
                    <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                        AI-Extracted Proposal
                      </h4>
                      <span className="text-[10px] text-slate-500">
                        Structured data for comparison & storage
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {selectedResponse.parsedProposal ? (
                        <ParsedProposalView
                          parsed={selectedResponse.parsedProposal}
                          vendorName={selectedResponse.vendorName}
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400">
                          <div className="mb-2 text-2xl">🧠</div>
                          <p className="font-medium text-slate-200 mb-1">
                            Not parsed yet
                          </p>
                          <p className="max-w-xs">
                            Click{" "}
                            <span className="font-semibold">“Run AI Parsing”</span>{" "}
                            to automatically extract pricing, terms, and other key
                            details from this response.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                Select a vendor response from the left to view details.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// --- Parsed proposal view ---
function ParsedProposalView({ parsed, vendorName }) {
  const currency = parsed.currency || "USD";

  const formatMoney = (value) =>
    typeof value === "number" ? `${currency} ${value.toLocaleString()}` : value;

  const totalFromLines =
    parsed.lineItems?.reduce((sum, li) => sum + (li.total || 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
          <div className="text-[11px] font-medium text-slate-400">
            Approx. Total
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-50">
            {formatMoney(parsed.totalApprox || totalFromLines)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Based on extracted quantities & unit prices
          </div>
        </div>

        <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
          <div className="text-[11px] font-medium text-slate-400">
            Delivery Timeline
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-50">
            {parsed.deliveryTimeline || "—"}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Validity:{" "}
            <span className="font-medium">
              {parsed.validity || "not specified"}
            </span>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-xs font-semibold text-slate-100">
            Commercial Terms
          </h5>
          <span className="text-[10px] text-slate-500">
            Auto-extracted – review before finalizing
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-slate-400">Payment Terms</dt>
            <dd className="text-slate-100">{parsed.paymentTerms || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Currency</dt>
            <dd className="text-slate-100">{currency}</dd>
          </div>
        </dl>
        {parsed.notes && (
          <p className="mt-2 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">Notes: </span>
            {parsed.notes}
          </p>
        )}
      </div>

      {/* Line items */}
      <div className="rounded-xl bg-slate-900 border border-slate-800">
        <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
          <h5 className="text-xs font-semibold text-slate-100">
            Line Items from {vendorName}
          </h5>
          <span className="text-[10px] text-slate-500">
            For comparison against other vendors & RFP
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-xs">
            <thead className="bg-slate-950/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-400">
                  Item
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-400">
                  Description
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-400">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-400">
                  Unit Price
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {parsed.lineItems?.map((li) => (
                <tr key={li.id}>
                  <td className="px-3 py-2 text-slate-100">{li.item}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {li.description}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-100">
                    {li.quantity}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-100">
                    {formatMoney(li.unitPrice)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-100">
                    {formatMoney(li.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-950/70">
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-300"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-slate-100">
                  {formatMoney(totalFromLines)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* JSON preview (optional) */}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-slate-500">
          Show raw parsed JSON
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] text-slate-100 border border-slate-800">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default VenderResponse;
