import React from "react";
import { Link,Outlet, NavLink } from "react-router-dom";

/* You can move SidebarItem to a separate file if you want */
const SidebarItem = ({ label, to }) => {
  return (
    <NavLink to={to} end className={({ isActive }) =>
      `w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${isActive
        ? "bg-slate-800 text-slate-100"
        : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
      }`
    }>
      {({ isActive }) => (
        <>
          <span className="text-sm">{label}</span>
          <span className={isActive ? "h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" : "hidden"} />
        </>
      )}
    </NavLink>
  );
};

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-md hidden md:flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-linear-to-tr from-emerald-400 to-sky-500 flex items-center justify-center text-slate-900 font-black">
              AI
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">RFP Copilot</p>
              <p className="text-xs text-slate-400">AI-Powered RFP System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 text-sm">
          <SidebarItem label="Dashboard" to="/" />
          <SidebarItem label="RFPs" to="/create" />
          <SidebarItem label="Vendors" to="/venderpage" />
          <SidebarItem label="Proposals" to="/venderresponse" />
          <SidebarItem label="Comparisons" to="/proposal" />
          <SidebarItem label="Vender Settings" to="/setting" />
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 text-xs text-slate-400">
          <p className="font-medium text-slate-300 mb-1">AI Status</p>
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Models online · Last sync 2 min ago
          </p>
        </div>
      </aside>

      {/* Main area (Navbar + content rendered by Outlet) */}
      <main className="flex-1 flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg md:text-2xl font-semibold tracking-tight">
                AI-Powered RFP Dashboard
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Create, send, and compare RFPs with AI assistance.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 text-xs text-slate-300">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mr-1.5"><path d="M10.5 4a6.5 6.5 0 014.93 10.78l3.4 3.39a1 1 0 01-1.42 1.42l-3.39-3.4A6.5 6.5 0 1110.5 4zm0 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" fill="currentColor" /></svg>
                <input type="text" placeholder="Search RFPs, vendors..." className="bg-transparent outline-none placeholder:text-slate-500 w-40 md:w-56" />
                <span className="hidden md:inline-flex ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">⌘K</span>
              </div>

              <Link to="/ai">
                <button className="text-xs px-3 py-1.5 rounded-full bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5">
                    <path
                      d="M9 3L10.2 7.8 15 9 10.2 10.2 9 15 7.8 10.2 3 9 7.8 7.8 9 3zM17 11l.6 2.4L20 14l-2.4.6L17 17l-.6-2.4L14 14l2.4-.6L17 11z"
                      fill="currentColor"
                    />
                  </svg>
                  Ask AI
                </button>
              </Link>

              <div className="h-8 w-8 rounded-full bg-linear-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-xs font-semibold">
                AD
              </div>
            </div>
          </div>
        </header>

        {/* Outlet - routed child components render here */}
        <div className="flex-1 px-4 lg:px-8 py-6 space-y-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
