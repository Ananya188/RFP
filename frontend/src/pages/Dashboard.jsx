import React from "react";

/* keep the same dummy data and small components (StatusPill, WorkflowRow, etc.)
   but only render the inner content area here — Layout provides the outer frame.
*/

const dummyStats = [
  { label: "Active RFPs", value: 8, trend: "+2 this week" },
  { label: "Open Proposals", value: 24, trend: "+5 new" },
  { label: "Pending Review", value: 6, trend: "Need attention" },
  { label: "Approved Vendors", value: 12, trend: "Stable" },
];

const recentRFPs = [
  { id: "RFP-2025-001", title: "Laptops & Monitors for New Office", budget: "$50,000", status: "In Evaluation", deadline: "2025-12-20" },
  { id: "RFP-2025-002", title: "Cloud Hosting Provider Migration", budget: "$80,000", status: "Draft", deadline: "2026-01-05" },
  { id: "RFP-2025-003", title: "Corporate Internet Service", budget: "$30,000", status: "Published", deadline: "2025-12-15" },
];

const vendorProposals = [
  { vendor: "TechNova Solutions", rfpId: "RFP-2025-001", score: 92, price: "$47,500", status: "Recommended" },
  { vendor: "DigitalEdge Systems", rfpId: "RFP-2025-001", score: 87, price: "$45,800", status: "Strong Fit" },
  { vendor: "CloudBridge Ltd", rfpId: "RFP-2025-002", score: 79, price: "$78,000", status: "Under Review" },
];

const aiInsights = [
  "TechNova’s proposal for RFP-2025-001 offers the best price-to-feature ratio.",
  "DigitalEdge has slightly higher performance SLAs but at a 3.7% higher cost.",
  "CloudBridge’s response is missing detailed implementation timelines.",
];

export default function Dashboard() {
  return (
    <>
      {/* KPI cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {dummyStats.map((stat) => (
          <div key={stat.label} className="border border-slate-800 bg-slate-900/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400">{stat.label}</p>
              <span className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-300">AI</span>
            </div>
            <p className="text-2xl font-semibold mb-1">{stat.value}</p>
            <p className="text-[11px] text-emerald-400">{stat.trend}</p>
          </div>
        ))}
      </section>

      {/* Main grid */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Recent RFPs */}
          <div className="border border-slate-800 bg-slate-900/60 rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-semibold">Recent RFPs</h2>
                <p className="text-xs text-slate-400">Latest RFPs created or updated.</p>
              </div>
              <button className="text-xs px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition">View all</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">RFP ID</th>
                    <th className="px-4 py-2 text-left font-medium">Title</th>
                    <th className="px-4 py-2 text-left font-medium">Budget</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRFPs.map((rfp, idx) => (
                    <tr key={rfp.id} className={`border-b border-slate-800/60 ${idx % 2 === 0 ? "bg-slate-900/40" : ""}`}>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-200">{rfp.id}</td>
                      <td className="px-4 py-2 text-slate-300">{rfp.title}</td>
                      <td className="px-4 py-2 text-slate-200">{rfp.budget}</td>
                      <td className="px-4 py-2"><StatusPill status={rfp.status} /></td>
                      <td className="px-4 py-2 text-slate-300">{rfp.deadline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vendor Proposals */}
          <div className="border border-slate-800 bg-slate-900/60 rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-semibold">AI-Scored Vendor Proposals</h2>
                <p className="text-xs text-slate-400">AI assigns scores based on price, terms, and fit.</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Scores updated in real time
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Vendor</th>
                    <th className="px-4 py-2 text-left font-medium">RFP</th>
                    <th className="px-4 py-2 text-left font-medium">AI Score</th>
                    <th className="px-4 py-2 text-left font-medium">Price</th>
                    <th className="px-4 py-2 text-left font-medium">AI Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorProposals.map((proposal, idx) => (
                    <tr key={proposal.vendor + proposal.rfpId} className={`border-b border-slate-800/60 ${idx % 2 === 0 ? "bg-slate-900/40" : ""}`}>
                      <td className="px-4 py-2 text-slate-200 whitespace-nowrap">{proposal.vendor}</td>
                      <td className="px-4 py-2 text-slate-300">{proposal.rfpId}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-800 text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1" />
                          {proposal.score} / 100
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-200">{proposal.price}</td>
                      <td className="px-4 py-2"><RecommendationPill status={proposal.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-400"><path d="M9 3L10.2 7.8 15 9 10.2 10.2 9 15 7.8 10.2 3 9 7.8 7.8 9 3zM17 11l.6 2.4L20 14l-2.4.6L17 17l-.6-2.4L14 14l2.4-.6L17 11z" fill="currentColor"/></svg>
                  AI Insights
                </h2>
                <p className="text-xs text-slate-400">Generated from latest vendor responses.</p>
              </div>
              <button className="text-[11px] px-2 py-1 rounded-full border border-slate-700 hover:border-slate-500 transition">Regenerate</button>
            </div>

            <div className="space-y-2 text-xs">
              {aiInsights.map((insight, index) => (
                <div key={index} className="border border-slate-800/80 bg-slate-900/80 rounded-lg px-3 py-2 flex gap-2">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-emerald-400"><path d="M9 3L10.2 7.8 15 9 10.2 10.2 9 15 7.8 10.2 3 9 7.8 7.8 9 3zM17 11l.6 2.4L20 14l-2.4.6L17 17l-.6-2.4L14 14l2.4-.6L17 11z" fill="currentColor"/></svg>
                  <p className="text-slate-200">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">RFP Workflow Snapshot</h2>
            <div className="space-y-3 text-xs">
              <WorkflowRow label="Draft" count={3} total={8} />
              <WorkflowRow label="Published" count={2} total={8} />
              <WorkflowRow label="In Evaluation" count={2} total={8} />
              <WorkflowRow label="Awarded" count={1} total={8} />
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Activity Timeline</h2>
            <ul className="space-y-3 text-xs">
              <ActivityItem title="3 new vendor proposals received" time="5 min ago" detail="For RFP-2025-001 (Laptops & Monitors)" />
              <ActivityItem title="AI rescored proposals" time="18 min ago" detail="DigitalEdge score updated from 84 → 87" />
              <ActivityItem title="New RFP created" time="1 hr ago" detail="Cloud Hosting Provider Migration" />
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---- Small components (StatusPill, RecommendationPill, WorkflowRow, ActivityItem) ---- */
/* Copy your implementations from your original file (they are unchanged) */
const StatusPill = ({ status }) => {
  let colorClasses = "bg-slate-800 text-slate-200";
  if (status === "Published") colorClasses = "bg-sky-500/10 text-sky-300";
  if (status === "In Evaluation") colorClasses = "bg-amber-500/10 text-amber-300";
  if (status === "Draft") colorClasses = "bg-slate-700 text-slate-200";

  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${colorClasses}`}>{status}</span>;
};

const RecommendationPill = ({ status }) => {
  let colorClasses = "bg-slate-800 text-slate-200";
  if (status === "Recommended") colorClasses = "bg-emerald-500/10 text-emerald-300";
  if (status === "Strong Fit") colorClasses = "bg-sky-500/10 text-sky-300";
  if (status === "Under Review") colorClasses = "bg-amber-500/10 text-amber-300";

  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${colorClasses}`}>{status}</span>;
};

const WorkflowRow = ({ label, count, total }) => {
  const pct = (count / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{count}/{total}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-linear-to-r from-emerald-400 to-sky-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ActivityItem = ({ title, time, detail }) => (
  <li className="flex gap-3">
    <div className="flex flex-col items-center">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      <span className="flex-1 w-px bg-slate-800 mt-1" />
    </div>
    <div>
      <p className="text-slate-200">{title}</p>
      <p className="text-[11px] text-slate-400">{detail}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{time}</p>
    </div>
  </li>
);
