// src/pages/Proposal.jsx
import React, { useState } from "react";

const Proposal = () => {
  const [proposals] = useState([
    {
      vendor: "Vendor A",
      price: 45000,
      delivery: "25 days",
      warranty: "2 years",
      notes: "Includes onsite support",
      score: 87,
    },
    {
      vendor: "Vendor B",
      price: 48000,
      delivery: "30 days",
      warranty: "3 years",
      notes: "Extended replacement guarantee",
      score: 92,
    },
    {
      vendor: "Vendor C",
      price: 42000,
      delivery: "40 days",
      warranty: "1 year",
      notes: "Lowest price but longer delivery",
      score: 78,
    },
  ]);

  // Auto-recommend the highest score
  const recommended = proposals.reduce((max, p) =>
    p.score > max.score ? p : max
  );

  return (
    <div className="space-y-4">
      {/* Local page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-50">
            Proposal Comparison
          </h2>
          <p className="text-xs md:text-sm text-slate-400">
            Compare vendor proposals side-by-side with AI recommendation on top.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 px-3 py-1 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5" />
            AI Scoring Enabled
          </span>
        </div>
      </div>

      {/* Comparison table card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Vendor Proposals
          </h3>
          <span className="text-[10px] text-slate-500">
            Highlighted row: AI-recommended vendor
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-950/70 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2 text-slate-400 font-medium">Vendor</th>
                <th className="px-4 py-2 text-slate-400 font-medium">Price</th>
                <th className="px-4 py-2 text-slate-400 font-medium">
                  Delivery Time
                </th>
                <th className="px-4 py-2 text-slate-400 font-medium">
                  Warranty
                </th>
                <th className="px-4 py-2 text-slate-400 font-medium">Notes</th>
                <th className="px-4 py-2 text-slate-400 font-medium text-right">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {proposals.map((p, i) => {
                const isRecommended = p.vendor === recommended.vendor;
                return (
                  <tr
                    key={i}
                    className={`transition-colors ${
                      isRecommended
                        ? "bg-emerald-500/5 border-l-2 border-emerald-400"
                        : "hover:bg-slate-900/70"
                    }`}
                  >
                    <td className="px-4 py-2 font-semibold text-slate-100">
                      <div className="flex items-center gap-2">
                        {isRecommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Recommended
                          </span>
                        )}
                        <span>{p.vendor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-100">
                      ${p.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-300">{p.delivery}</td>
                    <td className="px-4 py-2 text-slate-300">{p.warranty}</td>
                    <td className="px-4 py-2 text-slate-400">{p.notes}</td>
                    <td className="px-4 py-2 text-right font-bold text-slate-100">
                      {p.score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI SUMMARY SECTION */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-md">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            AI Recommendation
          </h3>
          <span className="text-[10px] text-slate-500">
            Generated from price, delivery, warranty & notes
          </span>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Based on price, delivery time, warranty, and completeness of
            response, the recommended vendor is:
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-2xl md:text-3xl font-bold text-emerald-400">
              ✅ {recommended.vendor}
            </h4>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-950/70 border border-slate-700 text-slate-300">
              AI Score:{" "}
              <span className="font-semibold text-emerald-300">
                {recommended.score}
              </span>
            </span>
          </div>

          <p className="text-xs md:text-sm text-slate-400">
            This vendor received the highest evaluation score ({recommended.score}).
            It offers a strong balance of overall cost, warranty period, and
            delivery timeline compared to other proposals. You can use this as a
            starting point and still apply your own business judgment before
            finalizing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Proposal;
