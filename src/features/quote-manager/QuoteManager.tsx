import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FilePlus2,
  Files,
  Users,
  CalendarClock,
  ShieldCheck,
  ChartNoAxesCombined,
  Settings2,
  Search,
  ChevronRight,
  ChevronsLeft,
  Menu,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Download,
  Car,
  Bike,
  Sparkles,
  Check,
  X,
  Copy,
  Eye,
  Pencil,
  Send,
  CircleHelp,
  LogOut,
  Wallet,
  Target,
  Clock3,
  FileText,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Toaster, toast } from "sonner";
import { auth, loadCloud, saveCloud, createWorkspace, setMember, sharePdf } from "./backend";
import {
  blankQuote,
  categories,
  csvDownload,
  initialStore,
  money,
  normalizePhone,
  rupees,
  today,
  totals,
  uid,
  validateQuote,
  type Quote,
  type Store,
  type Service,
  type Status,
  type Member,
} from "./model";
import { makePdf } from "./pdf";

const navigation = [
  ["Dashboard", LayoutDashboard],
  ["New Quotation", FilePlus2],
  ["All Quotations", Files],
  ["Customers", Users],
  ["Follow-ups", CalendarClock],
  ["Service & Price List", ShieldCheck],
  ["Reports", ChartNoAxesCombined],
  ["Settings", Settings2],
] as const;
const statuses: Status[] = ["Draft", "Sent", "Booked", "Lost"];
const colors = ["#d9a441", "#668ca8", "#497f69", "#c9c9c9"];
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({
  title = "No records yet",
  text = "Your records will appear here as you create quotations.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <FileText size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`status ${status.toLowerCase()}`}>
      <i />
      {status}
    </span>
  );
}
function Metric({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="metric">
      <div className="metric-top">
        {title}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function message(e: unknown) {
  return e instanceof Error
    ? e.message
    : (e as { message?: string })?.message || "Something went wrong. Please try again.";
}

export default function QuoteManager() {
  const [store, setStore] = useState<Store>(initialStore),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("Dashboard"),
    [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    [search, setSearch] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null),
    [view, setView] = useState<Quote | null>(null),
    [followQuote, setFollowQuote] = useState(""),
    [authOpen, setAuthOpen] = useState(false),
    [user, setUser] = useState(""),
    [workspace, setWorkspace] = useState(""),
    [revision, setRevision] = useState(0),
    [role, setRole] = useState<"Admin" | "Staff">("Admin"),
    [members, setMembers] = useState<Member[]>([]),
    [busy, setBusy] = useState(false),
    [cloudError, setCloudError] = useState(""),
    [period, setPeriod] = useState("6"),
    [help, setHelp] = useState(false);
  const [pdfPreview, setPdfPreview] = useState("");
  const [quoteFilter, setQuoteFilter] = useState("All statuses");
  useEffect(
    () => () => {
      if (pdfPreview) URL.revokeObjectURL(pdfPreview);
    },
    [pdfPreview],
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem("formatix-demo-v1");
      if (saved) setStore(JSON.parse(saved));
      const draft = localStorage.getItem("formatix-draft-v1");
      setQuote(draft ? JSON.parse(draft) : blankQuote());
    } catch {
      toast.error("Saved demo data could not be read.");
      setQuote(blankQuote());
    }
    const navigate = () => {
      const hash = decodeURIComponent(location.hash.slice(1));
      if (navigation.some(([p]) => p === hash)) setPage(hash);
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    setReady(true);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    if (ready && quote && !workspace) {
      try {
        localStorage.setItem("formatix-draft-v1", JSON.stringify(quote));
      } catch {
        toast.error("Unable to preserve draft on this device.");
      }
    }
  }, [quote, ready, workspace]);
  useEffect(() => {
    if (ready && !workspace) {
      try {
        localStorage.setItem("formatix-demo-v1", JSON.stringify(store));
      } catch {
        toast.error("Device storage is full. Changes may not persist.");
      }
    }
  }, [store, ready, workspace]);
  useEffect(() => {
    let live = true;
    auth()
      .getSession()
      .then(async ({ data }) => {
        if (!data.session || !live) return;
        setUser(data.session.user.email || "Team member");
        try {
          const cloud = await loadCloud();
          if (live) applyCloud(cloud);
        } catch (e) {
          if (live) setCloudError(message(e));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  function applyCloud(cloud: Awaited<ReturnType<typeof loadCloud>>) {
    setStore(cloud.state);
    setWorkspace(cloud.workspace);
    setRole(cloud.role);
    setMembers(cloud.members);
    setRevision(cloud.revision);
    setCloudError("");
    setQuote(blankQuote());
  }
  function go(p: string) {
    setPage(p);
    location.hash = encodeURIComponent(p);
    setDrawer(false);
    setSearch("");
  }
  async function persist(next: Store) {
    if (busy) throw new Error("Please wait for the current save.");
    setBusy(true);
    try {
      if (workspace) setRevision(await saveCloud(next, revision));
      setStore(next);
    } catch (e) {
      toast.error(message(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function save(q: Quote, draft: boolean) {
    try {
      validateQuote(q, draft);
      const exists = store.quotes.some((v) => v.id === q.id);
      const saved = {
        ...q,
        phone: normalizePhone(q.phone),
        number:
          q.number ||
          `${store.settings.prefix}-${new Date().getFullYear()}-${q.id.slice(0, 8).toUpperCase()}`,
        status: draft ? ("Draft" as const) : q.status === "Draft" ? ("Sent" as const) : q.status,
        staff: q.staff || user || "Demo Admin",
      };
      await persist({
        ...store,
        quotes: exists
          ? store.quotes.map((v) => (v.id === q.id ? saved : v))
          : [saved, ...store.quotes],
      });
      setQuote(blankQuote());
      toast.success(draft ? "Draft saved" : "Quotation saved");
      go("All Quotations");
      return saved;
    } catch (e) {
      toast.error(message(e));
      return null;
    }
  }
  async function changeStatus(q: Quote, status: Status) {
    await persist({
      ...store,
      quotes: store.quotes.map((v) => (v.id === q.id ? { ...v, status } : v)),
    });
    toast.success("Status updated");
  }
  function edit(q: Quote, duplicate = false) {
    setQuote(
      duplicate
        ? { ...q, id: uid(), number: "", date: today(), status: "Draft", booking: 0 }
        : { ...q, items: q.items.map((i) => ({ ...i })) },
    );
    go("New Quotation");
  }
  async function pdf(q: Quote, share = false, preview = false) {
    try {
      validateQuote(q, true);
      const doc = await makePdf(q, store.settings);
      if (preview) {
        setPdfPreview(URL.createObjectURL(doc.output("blob")));
        return;
      }
      if (!share) {
        doc.save(`${q.number || "Formatix-preview"}.pdf`);
        return;
      }
      if (!workspace) {
        toast.info("Sign in to cloud mode for secure PDF links. PDF downloads work in demo mode.");
        return;
      }
      setBusy(true);
      const url = await sharePdf(doc.output("blob"), workspace, q.id);
      const text = `Hello ${q.customer}, here is your ${store.settings.company} quotation ${q.number}. Total ${money(totals(q.items, q.discount, q.booking).total)}. PDF link (valid 7 days): ${url}`;
      const a = document.createElement("a");
      a.href = `https://wa.me/91${normalizePhone(q.phone)}?text=${encodeURIComponent(text)}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      toast.success("PDF link created. WhatsApp will open with the link.");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  const quotes = store.quotes,
    booked = quotes.filter((q) => q.status === "Booked"),
    total = quotes.reduce((s, q) => s + totals(q.items, q.discount, q.booking).total, 0),
    pending = store.followups.filter((f) => !f.done),
    conversion = quotes.length ? Math.round((booked.length / quotes.length) * 100) : 0;
  const monthly = Array.from({ length: Number(period) }, (_, i) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - Number(period) + 1 + i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const records = quotes.filter((q) => q.date.startsWith(key));
    return {
      month: date.toLocaleDateString("en", { month: "short" }),
      value: records.reduce((s, q) => s + totals(q.items, q.discount, q.booking).total / 100, 0),
      count: records.length,
    };
  });
  const monthValue = quotes
    .filter((q) => q.date.startsWith(today().slice(0, 7)))
    .reduce((s, q) => s + totals(q.items, q.discount, q.booking).total, 0);
  const topServices = Object.entries(
    quotes
      .flatMap((q) => q.items)
      .reduce<Record<string, number>>((a, i) => {
        a[i.name] = (a[i.name] || 0) + i.price;
        return a;
      }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  function exportQuotes() {
    csvDownload("formatix-quotations.csv", [
      [
        "Quotation",
        "Date",
        "Customer",
        "Phone",
        "Vehicle",
        "Staff",
        "Status",
        "Quotation value INR",
        "Booking amount recorded INR",
      ],
      ...quotes.map((q) => [
        q.number,
        q.date,
        q.customer,
        q.phone,
        q.model,
        q.staff,
        q.status,
        totals(q.items, q.discount, q.booking).total / 100,
        q.booking / 100,
      ]),
    ]);
  }
  const sideContent = (
    <>
      <a
        className="brand"
        href="#Dashboard"
        onClick={() => go("Dashboard")}
        aria-label="Formatix Dashboard"
      >
        <span className="brand-mark">
          F<span />
        </span>
        {!collapsed && (
          <span>
            <b>FORMATIX</b>
            <small>PREMIUM DETAILING STUDIO</small>
          </span>
        )}
      </a>
      <div className="workspace-label">{!collapsed && "WORKSPACE"}</div>
      <nav aria-label="Main navigation">
        {navigation.map(([p, Icon], i) => (
          <a
            key={p}
            title={p}
            href={`#${encodeURIComponent(p)}`}
            onClick={(e) => {
              e.preventDefault();
              go(p);
            }}
            className={page === p ? "active" : ""}
          >
            <Icon size={19} />
            {!collapsed && (
              <>
                <span>{p}</span>
                {p === "Follow-ups" && pending.length > 0 && <em>{pending.length}</em>}
                {i === 0 && <span className="active-dot" />}
              </>
            )}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        {!collapsed && (
          <div className="studio-card">
            <Sparkles size={20} />
            <b>Every detail matters.</b>
            <p>
              Exceptional care.
              <br />
              Extraordinary experiences.
            </p>
            <span>THE FORMATIX STANDARD</span>
          </div>
        )}
        <button className="help-link" onClick={() => setHelp(true)}>
          <CircleHelp size={18} />
          {!collapsed && "Help & getting started"}
        </button>
        <button className="profile" onClick={() => setAuthOpen(true)}>
          <span className="avatar">{user ? user.slice(0, 2).toUpperCase() : "FA"}</span>
          {!collapsed && (
            <span>
              <b>{user || "Formatix Admin"}</b>
              <small>{workspace ? role : "Local demo workspace"}</small>
            </span>
          )}
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
  return (
    <div className={`app ${collapsed ? "is-collapsed" : ""}`} data-ready={ready}>
      <Toaster richColors position="top-right" />
      <aside className="sidebar">
        {sideContent}
        <button
          className="collapse"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed((v) => !v)}
        >
          <ChevronsLeft size={16} />
        </button>
      </aside>
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="mobile-sidebar">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Formatix workspace pages</SheetDescription>
          {sideContent}
        </SheetContent>
      </Sheet>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            aria-label="Open navigation"
            onClick={() => {
              setCollapsed(false);
              setDrawer(true);
            }}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumbs">
            Workspace <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="global-search">
            <Search size={16} />
            <input
              aria-label="Global search quotations and customers"
              placeholder="Search anything..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌕</kbd>
            {search && (
              <div className="search-results">
                {quotes
                  .filter((q) =>
                    `${q.customer} ${q.phone} ${q.number} ${q.model}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .slice(0, 6)
                  .map((q) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        setView(q);
                        setSearch("");
                      }}
                    >
                      {q.customer}
                      <small>
                        {q.number} · {q.model}
                      </small>
                    </button>
                  ))}
                {!quotes.some((q) =>
                  `${q.customer} ${q.phone} ${q.number} ${q.model}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) && <p>No matching quotations</p>}
              </div>
            )}
          </div>
          <button className="top-profile" onClick={() => setAuthOpen(true)}>
            <span className="avatar small">{workspace ? "TM" : "FA"}</span>
            <span>{workspace ? role : "Demo Admin"}</span>
            <ChevronRight size={14} />
          </button>
        </header>
        <main>
          <div className="mode-banner">
            <span className={`connection-dot ${workspace ? "online" : ""}`} />
            {workspace
              ? "Connected to secure cloud workspace"
              : "DEMO WORKSPACE · Browser storage · Illustrative catalog prices"}
            <button onClick={() => setAuthOpen(true)}>
              {workspace ? "Account" : "Connect cloud"}
              <ArrowUpRight size={13} />
            </button>
          </div>
          {cloudError && (
            <div className="error-banner">
              {cloudError}
              <button onClick={() => setAuthOpen(true)}>Cloud setup</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">FORMATIX WORKSPACE</div>
              <h1>{page === "Dashboard" ? "The bigger picture." : page}</h1>
              <p>
                {
                  (
                    {
                      Dashboard: "A clear view of your studio. Every quotation, every opportunity.",
                      "New Quotation": "Great experiences start with the right quotation.",
                      "All Quotations": "Every conversation. Every opportunity. In one place.",
                      Customers: "Build lasting relationships, one detail at a time.",
                      "Follow-ups": "A thoughtful follow-up makes all the difference.",
                      "Service & Price List": "Exceptional services, clearly priced.",
                      Reports: "Turn your studio’s records into meaningful insights.",
                      Settings: "Make this workspace your own.",
                    } as Record<string, string>
                  )[page]
                }
              </p>
            </div>
            {["Dashboard", "All Quotations", "Customers"].includes(page) ? (
              <button
                className="btn primary"
                onClick={() => {
                  if (quote?.customer || quote?.items.length) {
                    go("New Quotation");
                  } else {
                    setQuote(blankQuote());
                    go("New Quotation");
                  }
                }}
              >
                <Plus size={17} />
                Create Quotation
              </button>
            ) : page === "Reports" ? (
              <button className="btn" onClick={exportQuotes}>
                <Download size={16} />
                Export CSV
              </button>
            ) : null}
          </div>
          {page === "Dashboard" && (
            <>
              <div className="section-heading">
                <h2>
                  Studio overview <span>LIVE FROM YOUR RECORDS</span>
                </h2>
                <span className="date-chip">
                  <CalendarDays size={14} />
                  {new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="metrics">
                <Metric
                  title="Total quotations"
                  value={String(quotes.length).padStart(2, "0")}
                  detail="All quotations in your workspace"
                  icon={<Files size={18} />}
                />
                <Metric
                  title="Quotation value"
                  value={money(total)}
                  detail="Potential business · not collected revenue"
                  icon={<Wallet size={18} />}
                />
                <Metric
                  title="Confirmed bookings"
                  value={String(booked.length).padStart(2, "0")}
                  detail={`${conversion}% overall conversion rate`}
                  icon={<ShieldCheck size={18} />}
                />
                <Metric
                  title="Pending follow-ups"
                  value={String(pending.length).padStart(2, "0")}
                  detail={`${pending.filter((f) => f.date < today()).length} overdue · keep the conversation going`}
                  icon={<Clock3 size={18} />}
                />
              </div>
              <div className="dashboard-middle">
                <section className="panel performance">
                  <div className="panel-heading">
                    <div>
                      <h2>Quotation performance</h2>
                      <p>A closer look at your studio’s momentum</p>
                    </div>
                    <select
                      aria-label="Performance period"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <option value="6">Last 6 months</option>
                      <option value="12">Last 12 months</option>
                      <option value="3">Last 3 months</option>
                    </select>
                  </div>
                  <div className="chart-meta">
                    <strong>{money(monthValue)}</strong>
                    <span>
                      <i />
                      This month’s quotation value
                    </span>
                  </div>
                  <div className="area-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthly} margin={{ left: 0, right: 18, top: 14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#ecebe8" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#94948e" }}
                          dy={8}
                        />
                        <YAxis
                          width={48}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#94948e" }}
                          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                        />
                        <Tooltip
                          formatter={(v) => [money(Number(v) * 100), "Quotation value"]}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                        <Area
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="value"
                          stroke="#c79739"
                          strokeWidth={2.5}
                          fill="#f9f2e4"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="panel status-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Quotation status</h2>
                      <p>From first enquiry to confirmed booking</p>
                    </div>
                  </div>
                  <div className="donut-wrap">
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie
                          isAnimationActive={false}
                          onClick={(entry: { name?: string }) => {
                            if (statuses.includes(entry.name as Status)) {
                              setQuoteFilter(entry.name!);
                              go("All Quotations");
                            }
                          }}
                          data={
                            quotes.length
                              ? statuses.map((s) => ({
                                  name: s,
                                  value: quotes.filter((q) => q.status === s).length,
                                }))
                              : [{ name: "No records", value: 1 }]
                          }
                          dataKey="value"
                          innerRadius={58}
                          outerRadius={77}
                          stroke="white"
                          strokeWidth={4}
                        >
                          {(quotes.length ? statuses : ["empty"]).map((s, i) => (
                            <Cell key={s} fill={quotes.length ? colors[i] : "#eeede9"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-label">
                      <strong>{quotes.length}</strong>
                      <small>QUOTATIONS</small>
                    </div>
                  </div>
                  <div className="status-legend">
                    {statuses.map((s, i) => (
                      <button
                        key={s}
                        onClick={() => {
                          setQuoteFilter(s);
                          go("All Quotations");
                        }}
                      >
                        <i style={{ background: colors[i] }} />
                        {s}
                        <b>{quotes.filter((q) => q.status === s).length}</b>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <div className="dashboard-lower">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent quotations</h2>
                      <p>Your latest opportunities, at a glance</p>
                    </div>
                    <button className="text-btn" onClick={() => go("All Quotations")}>
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  <QuoteTable quotes={quotes.slice(0, 5)} onView={setView} />
                  {quotes.length === 0 && (
                    <button className="empty-create" onClick={() => go("New Quotation")}>
                      Create your first quotation <ArrowRight size={15} />
                    </button>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Top services</h2>
                      <p>What your customers are choosing</p>
                    </div>
                    <Sparkles size={18} color="#bc913f" />
                  </div>
                  {topServices.length ? (
                    <div className="top-services">
                      {topServices.map(([s, v], i) => (
                        <div key={s}>
                          <span className="service-rank">0{i + 1}</span>
                          <div>
                            <b>{s}</b>
                            <div className="bar-track">
                              <span
                                style={{ width: `${(v / (topServices[0]?.[1] || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                          <strong>{money(v)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="A fresh start"
                      text="Your most quoted services will appear here."
                    />
                  )}
                  <div className="panel-footer">Based on item value before discounts</div>
                </section>
              </div>
              {quotes.length > 0 && (
                <section className="panel employee-overview">
                  <div className="panel-heading">
                    <div>
                      <h2>Team performance</h2>
                      <p>The people behind your studio’s results</p>
                    </div>
                    <button className="text-btn" onClick={() => go("Reports")}>
                      Full report <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>EMPLOYEE</th>
                          <th>QUOTATIONS</th>
                          <th>BOOKINGS</th>
                          <th>QUOTATION VALUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...new Set(quotes.map((q) => q.staff))].map((staff) => {
                          const records = quotes.filter((q) => q.staff === staff);
                          return (
                            <tr key={staff}>
                              <td>{staff}</td>
                              <td>{records.length}</td>
                              <td>{records.filter((q) => q.status === "Booked").length}</td>
                              <td>
                                {money(
                                  records.reduce(
                                    (sum, q) => sum + totals(q.items, q.discount, q.booking).total,
                                    0,
                                  ),
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              <div className="bottom-strip">
                <span>
                  <ShieldCheck size={18} /> A little precision. A lot of possibility.
                </span>
                <span>
                  Conversion <b>{conversion}%</b> <i /> This month <b>{money(monthValue)}</b>
                </span>
              </div>
            </>
          )}
          {page === "New Quotation" && quote && (
            <Builder
              quote={quote}
              setQuote={setQuote}
              store={store}
              admin={role === "Admin"}
              busy={busy}
              onSave={save}
              onPdf={pdf}
            />
          )}
          {page === "All Quotations" && (
            <Quotations
              key={quoteFilter}
              initialStatus={quoteFilter}
              quotes={quotes}
              busy={busy}
              onView={setView}
              onEdit={edit}
              onPdf={pdf}
              onStatus={changeStatus}
              onFollow={setFollowQuote}
              onExport={exportQuotes}
            />
          )}
          {page === "Customers" && (
            <Customers
              store={store}
              onView={setView}
              onSave={async (phone, notes) => {
                await persist({
                  ...store,
                  customerNotes: { ...store.customerNotes, [phone]: notes },
                });
                toast.success("Customer notes saved");
              }}
            />
          )}
          {page === "Follow-ups" && (
            <Followups
              store={store}
              members={members}
              busy={busy}
              onSave={async (followups) => {
                await persist({ ...store, followups });
                toast.success("Follow-ups updated");
              }}
            />
          )}
          {page === "Service & Price List" && (
            <Catalog
              services={store.services}
              admin={role === "Admin"}
              onSave={async (services) => {
                await persist({ ...store, services });
                toast.success("Catalog updated. Historical quotation prices are preserved.");
              }}
            />
          )}
          {page === "Reports" && <Reports store={store} monthly={monthly} />}
          {page === "Settings" && (
            <Settings
              store={store}
              admin={role === "Admin"}
              members={members}
              cloud={!!workspace}
              onSave={async (settings) => {
                await persist({ ...store, settings });
                toast.success("Settings saved");
              }}
              onMember={async (email, name, role) => {
                await setMember(email, name, role);
                applyCloud(await loadCloud());
                toast.success("Staff access updated");
              }}
            />
          )}
          <footer className="app-footer">
            <span>
              FORMATIX <i /> PREMIUM DETAILING STUDIO
            </span>
            <span>Crafted for the details.</span>
          </footer>
        </main>
      </div>
      <Dialog
        open={!!view}
        onOpenChange={(o) => {
          if (!o) setView(null);
        }}
      >
        <DialogContent className="quote-dialog">
          <DialogHeader>
            <DialogTitle>Quotation {view?.number}</DialogTitle>
            <DialogDescription>Quotation details and sharing options</DialogDescription>
          </DialogHeader>
          {view && (
            <>
              <div className="preview-brand">
                <strong>{store.settings.company}</strong>
                <Badge status={view.status} />
              </div>
              <div className="details-grid">
                <div>
                  <small>PREPARED FOR</small>
                  <h3>{view.customer}</h3>
                  <p>{view.phone}</p>
                </div>
                <div>
                  <small>VEHICLE</small>
                  <h3>{view.model}</h3>
                  <p>
                    {view.category} · {view.colour} · {view.registration || "Unregistered"}
                  </p>
                </div>
              </div>
              <Summary quote={view} />
              <p className="muted">
                Date: {view.date} · Prepared by: {view.staff}
                <br />
                {view.notes}
              </p>
              <div className="actions">
                <button
                  className="btn"
                  onClick={() => {
                    edit(view);
                    setView(null);
                  }}
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button className="btn" onClick={() => pdf(view)}>
                  <Download size={15} />
                  PDF
                </button>
                <button className="btn primary" disabled={busy} onClick={() => pdf(view, true)}>
                  <Send size={15} />
                  WhatsApp
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!followQuote}
        onOpenChange={(o) => {
          if (!o) setFollowQuote("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule follow-up</DialogTitle>
            <DialogDescription>Keep the next conversation on your calendar.</DialogDescription>
          </DialogHeader>
          <FollowForm
            quotes={quotes}
            members={members}
            quoteId={followQuote}
            onSave={async (f) => {
              await persist({ ...store, followups: [...store.followups, f] });
              setFollowQuote("");
              toast.success("Follow-up scheduled");
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{workspace ? "Your cloud workspace" : "Connect your studio"}</DialogTitle>
            <DialogDescription>
              Secure sign-in with Supabase. Demo records stay separate from cloud records.
            </DialogDescription>
          </DialogHeader>
          {workspace ? (
            <>
              <p>
                Signed in as {user} · {role}
              </p>
              <button
                className="btn"
                onClick={async () => {
                  try {
                    applyCloud(await loadCloud());
                    toast.success("Workspace refreshed");
                  } catch (e) {
                    toast.error(message(e));
                  }
                }}
              >
                Refresh cloud records
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await auth().signOut();
                  location.reload();
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </>
          ) : (
            <AuthForm
              onLogin={async (email) => {
                setUser(email);
                try {
                  applyCloud(await loadCloud());
                  setAuthOpen(false);
                  toast.success("Connected to cloud");
                } catch (e) {
                  setCloudError(message(e));
                  toast.error(message(e));
                }
              }}
            />
          )}
          {user && !workspace && (
            <button
              className="btn"
              onClick={async () => {
                try {
                  applyCloud(await createWorkspace({ ...initialStore(), services: [] }));
                  setAuthOpen(false);
                  toast.success("Studio workspace created. Add your official service catalog.");
                } catch (e) {
                  toast.error(message(e));
                }
              }}
            >
              Create my cloud workspace
            </button>
          )}
          <p className="muted">
            Cloud requires the included database migration. Create an account, sign in, then create
            a workspace. Staff should sign up before an Admin adds their email in Settings.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!pdfPreview}
        onOpenChange={(open) => {
          if (!open) setPdfPreview("");
        }}
      >
        <DialogContent className="pdf-dialog">
          <DialogHeader>
            <DialogTitle>Preview quotation PDF</DialogTitle>
            <DialogDescription>
              A4 quotation with GST breakdown, balance and terms.
            </DialogDescription>
          </DialogHeader>
          <iframe title="Quotation PDF preview" src={pdfPreview || undefined} />
          <a className="btn primary" href={pdfPreview} download="Formatix-quotation.pdf">
            <Download size={16} />
            Download PDF
          </a>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome to your studio workspace</DialogTitle>
            <DialogDescription>Start with the details that matter.</DialogDescription>
          </DialogHeader>
          <ol className="help-list">
            <li>Set your studio details and terms in Settings.</li>
            <li>Replace the marked demo catalog with verified prices.</li>
            <li>
              Create quotations with tax-inclusive prices. GST is extracted at 18% after discount.
            </li>
            <li>Record bookings, schedule follow-ups and track results.</li>
            <li>Connect cloud for team access and shareable PDF links.</li>
          </ol>
          <p className="muted">
            Booking amounts are recorded advances, not a verified payment ledger.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ quote }: { quote: Quote }) {
  let t;
  try {
    t = totals(quote.items, quote.discount, quote.booking);
  } catch (e) {
    return <div className="error-banner">{message(e)}</div>;
  }
  return (
    <div className="summary">
      <div className="summary-items">
        {quote.items.length ? (
          quote.items.map((i) => (
            <div key={i.id}>
              <span>{i.name}</span>
              <b>{money(i.price)}</b>
            </div>
          ))
        ) : (
          <p className="muted">Select services to build your quotation.</p>
        )}
      </div>
      <div>
        <span>Services subtotal</span>
        <b>{money(t.subtotal)}</b>
      </div>
      <div>
        <span>Discount</span>
        <b>− {money(t.discount)}</b>
      </div>
      <div>
        <span>Taxable value</span>
        <b>{money(t.taxable)}</b>
      </div>
      <div>
        <span>GST included (18%)</span>
        <b>{money(t.gst)}</b>
      </div>
      <div className="grand-total">
        <span>Grand total</span>
        <strong>{money(t.total)}</strong>
      </div>
      <div>
        <span>Booking amount</span>
        <b>{money(t.booking)}</b>
      </div>
      <div className="balance">
        <span>Balance payable</span>
        <b>{money(t.balance)}</b>
      </div>
    </div>
  );
}

function Builder({
  quote: q,
  setQuote,
  store,
  admin,
  busy,
  onSave,
  onPdf,
}: {
  quote: Quote;
  setQuote: (q: Quote) => void;
  store: Store;
  admin: boolean;
  busy: boolean;
  onSave: (q: Quote, d: boolean) => Promise<Quote | null>;
  onPdf: (q: Quote, s?: boolean, preview?: boolean) => void;
}) {
  const [tab, setTab] = useState("All services");
  const update = (key: keyof Quote, value: Quote[keyof Quote]) => setQuote({ ...q, [key]: value });
  function chooseCategory(category: string, type = q.type) {
    if (
      q.items.length &&
      !window.confirm("Changing vehicle category will reprice catalog services. Continue?")
    )
      return;
    setQuote({
      ...q,
      category,
      type,
      items: q.items.map((i) => {
        const s = store.services.find((s) => s.id === i.serviceId);
        return s ? { ...i, price: s.prices[category] || 0 } : i;
      }),
      discount: 0,
      booking: 0,
    });
  }
  const existing = store.quotes.find((v) => normalizePhone(v.phone) === normalizePhone(q.phone)),
    serviceTabs = [
      "All services",
      ...new Set(store.services.filter((s) => s.active).map((s) => s.category)),
    ];
  return (
    <div className="builder-layout">
      <div className="builder-form">
        <section className="panel form-panel">
          <div className="form-title">
            <span>01</span>
            <div>
              <h2>Customer & vehicle</h2>
              <p>Let’s start with the essentials</p>
            </div>
            <Car size={22} />
          </div>
          <div className="form-grid">
            <Field label="Customer name *">
              <input
                value={q.customer}
                onChange={(e) => update("customer", e.target.value)}
                placeholder="Full name"
              />
            </Field>
            <Field label="Mobile number *">
              <input
                type="tel"
                value={q.phone}
                onChange={(e) => {
                  const phone = e.target.value;
                  const match = store.quotes.find(
                    (v) => normalizePhone(v.phone) === normalizePhone(phone),
                  );
                  setQuote({ ...q, phone, customer: match?.customer || q.customer });
                }}
                placeholder="10-digit mobile number"
              />
            </Field>
            <Field label="Lead source">
              <select value={q.source} onChange={(e) => update("source", e.target.value)}>
                {["Walk-in", "Instagram", "Google", "Referral", "WhatsApp", "Website", "Other"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Vehicle type">
              <div className="segmented">
                {["Car", "Bike"].map((type) => (
                  <button
                    className={q.type === type ? "selected" : ""}
                    key={type}
                    onClick={() => chooseCategory(type === "Bike" ? "Bike" : "Sedan", type)}
                  >
                    {type === "Car" ? <Car size={17} /> : <Bike size={17} />} {type}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Vehicle category">
              <select value={q.category} onChange={(e) => chooseCategory(e.target.value)}>
                {categories
                  .filter((c) => (q.type === "Bike" ? c === "Bike" : c !== "Bike"))
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            </Field>
            <Field label="Vehicle model *">
              <input
                value={q.model}
                onChange={(e) => update("model", e.target.value)}
                placeholder="e.g. Hyundai Creta"
              />
            </Field>
            <Field label="Colour">
              <input
                value={q.colour}
                onChange={(e) => update("colour", e.target.value)}
                placeholder="Vehicle colour"
              />
            </Field>
            <Field label="Registration (optional)">
              <input
                value={q.registration}
                onChange={(e) => update("registration", e.target.value.toUpperCase())}
                placeholder="MH 00 AB 0000"
              />
            </Field>
          </div>
          {existing && (
            <div className="info-note">
              <Users size={15} />
              Existing customer found. This vehicle will share the same customer history.
            </div>
          )}
        </section>
        <section className="panel form-panel">
          <div className="form-title">
            <span>02</span>
            <div>
              <h2>A little extra protection.</h2>
              <p>Select the services that suit this vehicle</p>
            </div>
            <ShieldCheck size={22} />
          </div>
          {store.services.some((s) => s.demo) && (
            <div className="demo-note">
              DEMO CATALOG · Illustrative prices, not official Formatix pricing
            </div>
          )}
          <div className="service-tabs">
            {serviceTabs.map((t) => (
              <button key={t} className={tab === t ? "selected" : ""} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="service-cards">
            {store.services
              .filter(
                (s) =>
                  s.active &&
                  (!s.applicableCategories || s.applicableCategories.includes(q.category)) &&
                  (tab === "All services" || s.category === tab),
              )
              .map((s) => {
                const selected = q.items.some((i) => i.serviceId === s.id);
                return (
                  <button
                    key={s.id}
                    className={`service-card ${selected ? "selected" : ""}`}
                    onClick={() => {
                      if (selected)
                        setQuote({
                          ...q,
                          items: q.items.filter((i) => i.serviceId !== s.id),
                          discount: 0,
                          booking: 0,
                        });
                      else
                        update("items", [
                          ...q.items,
                          {
                            id: uid(),
                            serviceId: s.id,
                            name: s.name,
                            price: s.prices[q.category] || 0,
                          },
                        ]);
                    }}
                  >
                    <div>
                      <span className="service-icon">
                        <ShieldCheck size={19} />
                      </span>
                      <span className="check-box">{selected && <Check size={14} />}</span>
                    </div>
                    <small>{s.category}</small>
                    <h3>{s.name}</h3>
                    <p>{s.description}</p>
                    <strong>
                      {money(s.prices[q.category] || 0)}
                      <small> / {q.category}</small>
                    </strong>
                  </button>
                );
              })}
          </div>
          {!store.services.some((s) => s.active) && (
            <Empty
              title="Your catalog is empty"
              text="An Admin can add official services in Service & Price List."
            />
          )}
        </section>
        <section className="panel form-panel">
          <div className="form-title">
            <span>03</span>
            <div>
              <h2>Fine-tune the details</h2>
              <p>Review line items, adjustments and notes</p>
            </div>
          </div>
          {q.items.map((item, index) => (
            <div className="line-editor" key={item.id}>
              <input
                aria-label={`Item ${index + 1} name`}
                disabled={!admin}
                value={item.name}
                onChange={(e) =>
                  update(
                    "items",
                    q.items.map((i) => (i.id === item.id ? { ...i, name: e.target.value } : i)),
                  )
                }
              />
              <input
                aria-label={`Item ${index + 1} price INR`}
                type="number"
                min="0"
                step="0.01"
                disabled={!admin}
                value={item.price / 100}
                onChange={(e) =>
                  update(
                    "items",
                    q.items.map((i) =>
                      i.id === item.id ? { ...i, price: rupees(e.target.value) } : i,
                    ),
                  )
                }
              />
              <button
                className="icon-btn"
                aria-label={`Remove ${item.name}`}
                onClick={() =>
                  setQuote({
                    ...q,
                    items: q.items.filter((i) => i.id !== item.id),
                    discount: 0,
                    booking: 0,
                  })
                }
              >
                <X size={17} />
              </button>
            </div>
          ))}
          {admin && (
            <button
              className="text-btn add-line"
              onClick={() =>
                update("items", [...q.items, { id: uid(), name: "Custom service", price: 0 }])
              }
            >
              <Plus size={15} />
              Add custom line item
            </button>
          )}
          <div className="form-grid">
            <Field label="Discount (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={q.discount / 100}
                onChange={(e) => update("discount", rupees(e.target.value))}
              />
            </Field>
            <Field label="Booking amount recorded (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={q.booking / 100}
                onChange={(e) => update("booking", rupees(e.target.value))}
              />
            </Field>
            <Field label="Prepared by">
              <input
                value={q.staff}
                onChange={(e) => update("staff", e.target.value)}
                placeholder="Your name"
              />
            </Field>
            <Field label="Quotation date">
              <input type="date" value={q.date} onChange={(e) => update("date", e.target.value)} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={q.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Anything your customer should know…"
            />
          </Field>
        </section>
      </div>
      <aside className="quote-summary panel">
        <div className="panel-heading">
          <h2>Quotation summary</h2>
          <FileText size={19} />
        </div>
        <div className="summary-vehicle">
          <Car size={24} />
          <div>
            <b>{q.model || "Your vehicle"}</b>
            <small>
              {q.category} · {q.items.length} services selected
            </small>
          </div>
        </div>
        <Summary quote={q} />
        <p className="tax-note">
          <ShieldCheck size={14} /> All prices include 18% GST.
        </p>
        <button className="btn primary" disabled={busy} onClick={() => onSave(q, false)}>
          <span className="mobile-total" aria-hidden="true">
            Total{" "}
            <b>
              {money(Math.max(0, q.items.reduce((sum, item) => sum + item.price, 0) - q.discount))}
            </b>
          </span>
          <Check size={16} />
          {busy ? "Saving…" : "Save Quotation"}
        </button>
        <div className="summary-secondary">
          <button className="btn" disabled={busy} onClick={() => onSave(q, true)}>
            Save Draft
          </button>
          <button className="btn" onClick={() => onPdf(q, false, true)}>
            <Eye size={15} />
            Preview PDF
          </button>
        </div>
        <button
          className="text-btn share-action"
          disabled={busy}
          onClick={async () => {
            const saved = await onSave(q, false);
            if (saved) onPdf(saved, true);
          }}
        >
          <Send size={15} />
          Save & share on WhatsApp
        </button>
        <small className="muted">
          Valid for {store.settings.validity} days. Prices are saved with this quotation.
        </small>
      </aside>
    </div>
  );
}

function QuoteTable({ quotes, onView }: { quotes: Quote[]; onView: (q: Quote) => void }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>QUOTATION / CUSTOMER</th>
            <th>VEHICLE</th>
            <th>AMOUNT</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id}>
              <td>
                <button className="table-link" onClick={() => onView(q)}>
                  {q.customer}
                </button>
                <small>
                  {q.number} · {q.date}
                </small>
              </td>
              <td>
                {q.model || "—"}
                <small>{q.category}</small>
              </td>
              <td className="amount">{money(totals(q.items, q.discount, q.booking).total)}</td>
              <td>
                <Badge status={q.status} />
              </td>
              <td>
                <button
                  className="icon-btn"
                  aria-label={`View ${q.number}`}
                  onClick={() => onView(q)}
                >
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {quotes.length === 0 && <Empty />}
    </div>
  );
}

function Quotations({
  initialStatus,
  quotes,
  busy,
  onView,
  onEdit,
  onPdf,
  onStatus,
  onFollow,
  onExport,
}: {
  quotes: Quote[];
  initialStatus: string;
  busy: boolean;
  onView: (q: Quote) => void;
  onEdit: (q: Quote, d?: boolean) => void;
  onPdf: (q: Quote, s?: boolean) => void;
  onStatus: (q: Quote, s: Status) => Promise<void>;
  onFollow: (id: string) => void;
  onExport: () => void;
}) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(initialStatus),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sort, setSort] = useState("newest"),
    [pg, setPg] = useState(1);
  const filtered = quotes
    .filter(
      (q) =>
        `${q.customer} ${q.number} ${q.phone} ${q.model} ${q.staff}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (status === "All statuses" || q.status === status) &&
        (!from || q.date >= from) &&
        (!to || q.date <= to),
    )
    .sort((a, b) =>
      sort === "value"
        ? totals(b.items, b.discount, b.booking).total -
          totals(a.items, a.discount, a.booking).total
        : sort === "customer"
          ? a.customer.localeCompare(b.customer)
          : b.date.localeCompare(a.date),
    );
  const max = Math.max(1, Math.ceil(filtered.length / 8)),
    current = Math.min(pg, max);
  return (
    <section className="panel">
      <div className="filter-bar">
        <div className="input-icon">
          <Search size={16} />
          <input
            placeholder="Search customer, vehicle or quotation…"
            aria-label="Search quotations"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPg(1);
            }}
          />
        </div>
        <select
          aria-label="Status filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPg(1);
          }}
        >
          {["All statuses", ...statuses].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Sort quotations" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="value">Highest value</option>
          <option value="customer">Customer A–Z</option>
        </select>
        <button className="btn" onClick={onExport}>
          <Download size={15} />
          CSV
        </button>
      </div>
      <div className="date-filters">
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <span>{filtered.length} quotations</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>QUOTATION / CUSTOMER</th>
              <th>VEHICLE / STAFF</th>
              <th>DATE</th>
              <th>TOTAL</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * 8, current * 8).map((q) => (
              <tr key={q.id}>
                <td>
                  <button className="table-link" onClick={() => onView(q)}>
                    {q.number}
                  </button>
                  <small>
                    {q.customer} · {q.phone}
                  </small>
                </td>
                <td>
                  {q.model || "—"}
                  <small>{q.staff}</small>
                </td>
                <td>{q.date}</td>
                <td className="amount">{money(totals(q.items, q.discount, q.booking).total)}</td>
                <td>
                  <select
                    aria-label={`Status for ${q.number}`}
                    disabled={busy}
                    value={q.status}
                    onChange={(e) => onStatus(q, e.target.value as Status).catch(() => {})}
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="icon-btn"
                      title="View"
                      aria-label="View quotation"
                      onClick={() => onView(q)}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Edit"
                      aria-label="Edit quotation"
                      onClick={() => onEdit(q)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Duplicate"
                      aria-label="Duplicate quotation"
                      onClick={() => onEdit(q, true)}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title="PDF"
                      aria-label="Download quotation"
                      onClick={() => onPdf(q)}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title="WhatsApp"
                      aria-label="Share quotation"
                      onClick={() => onPdf(q, true)}
                    >
                      <Send size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Follow-up"
                      aria-label="Schedule follow-up"
                      onClick={() => onFollow(q.id)}
                    >
                      <CalendarClock size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <Empty title="No matching quotations" text="Create a quotation or adjust your filters." />
        )}
      </div>
      <div className="pagination">
        <span>
          Page {current} of {max}
        </span>
        <button className="btn" disabled={current === 1} onClick={() => setPg(current - 1)}>
          Previous
        </button>
        <button className="btn" disabled={current === max} onClick={() => setPg(current + 1)}>
          Next
        </button>
      </div>
    </section>
  );
}

function Customers({
  store,
  onView,
  onSave,
}: {
  store: Store;
  onView: (q: Quote) => void;
  onSave: (p: string, n: string) => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(""),
    [notes, setNotes] = useState("");
  const groups = Object.entries(
    store.quotes.reduce<Record<string, Quote[]>>((a, q) => {
      const p = normalizePhone(q.phone);
      (a[p] ??= []).push(q);
      return a;
    }, {}),
  );
  const records = groups.find(([p]) => p === selected)?.[1] || [];
  return (
    <>
      <div className="input-icon standalone-search">
        <Search size={16} />
        <input
          aria-label="Search customers"
          placeholder="Search name or phone number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="customer-grid">
        {groups
          .filter(([p, qs]) =>
            `${p} ${qs[0]?.customer}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map(([p, qs]) => (
            <button
              className="panel customer-card"
              key={p}
              onClick={() => {
                setSelected(p);
                setNotes(store.customerNotes[p] || "");
              }}
            >
              <span className="avatar">{qs[0]?.customer.slice(0, 2).toUpperCase()}</span>
              <h3>{qs[0]?.customer}</h3>
              <p>{p}</p>
              <div>
                <span>{new Set(qs.map((q) => q.registration || q.model)).size} vehicles</span>
                <span>{qs.length} quotations</span>
              </div>
              <small>
                {qs.filter((q) => q.status === "Booked").length} bookings · {qs[0]?.source}
              </small>
              <ArrowUpRight size={17} />
            </button>
          ))}
      </div>
      {!groups.length && (
        <section className="panel">
          <Empty
            title="Your customer book starts here"
            text="Customers are created from quotations and grouped by phone number, with all their vehicles."
          />
        </section>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected("");
        }}
      >
        <DialogContent className="quote-dialog">
          <DialogHeader>
            <DialogTitle>{records[0]?.customer}</DialogTitle>
            <DialogDescription>
              {selected} · {records.length} quotations ·{" "}
              {records.filter((q) => q.status === "Booked").length} bookings
            </DialogDescription>
          </DialogHeader>
          <h3>Vehicles & history</h3>
          {records.map((q) => (
            <button
              className="history-row"
              key={q.id}
              onClick={() => {
                setSelected("");
                onView(q);
              }}
            >
              <Car size={19} />
              <span>
                {q.model} · {q.colour} · {q.registration || "No registration"}
                <small>
                  {q.number} · {q.date} · {q.source}
                </small>
              </span>
              <Badge status={q.status} />
            </button>
          ))}
          <Field label="Customer notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <button className="btn primary" onClick={() => onSave(selected, notes).catch(() => {})}>
            Save notes
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Follow = Store["followups"][number];
function FollowForm({
  quotes,
  members,
  quoteId = "",
  existing,
  onSave,
}: {
  quotes: Quote[];
  members: Member[];
  quoteId?: string;
  existing?: Follow;
  onSave: (f: Follow) => Promise<void>;
}) {
  const [f, setF] = useState<Follow>(
    existing || {
      id: uid(),
      quoteId: quoteId || quotes[0]?.id || "",
      date: today(),
      priority: "Normal",
      employee: members[0]?.name || "Demo Admin",
      notes: "",
      done: false,
    },
  );
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.quoteId) {
          toast.error("Create a quotation first.");
          return;
        }
        setSaving(true);
        try {
          await onSave(f);
        } catch (e) {
          toast.error(message(e));
        } finally {
          setSaving(false);
        }
      }}
    >
      <Field label="Quotation">
        <select
          required
          value={f.quoteId}
          onChange={(e) => setF({ ...f, quoteId: e.target.value })}
        >
          {quotes.map((q) => (
            <option key={q.id} value={q.id}>
              {q.customer} · {q.number}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Follow-up date">
          <input
            type="date"
            required
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        </Field>
        <Field label="Priority">
          <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            {["Normal", "High", "Low"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Assigned employee">
        <input
          required
          list="staff-names"
          value={f.employee}
          onChange={(e) => setF({ ...f, employee: e.target.value })}
        />
        <datalist id="staff-names">
          {members.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Notes">
        <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <button className="btn primary" disabled={saving}>
        {saving ? "Saving…" : "Save follow-up"}
      </button>
    </form>
  );
}
function Followups({
  store,
  members,
  busy,
  onSave,
}: {
  store: Store;
  members: Member[];
  busy: boolean;
  onSave: (f: Follow[]) => Promise<void>;
}) {
  const [filter, setFilter] = useState("All"),
    [calendar, setCalendar] = useState(false),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Follow | undefined>(),
    [month, setMonth] = useState(today().slice(0, 7));
  const fs = store.followups
    .filter((f) =>
      filter === "Completed"
        ? f.done
        : !f.done &&
          (filter === "All" ||
            (filter === "Overdue" && f.date < today()) ||
            (filter === "Today" && f.date === today()) ||
            (filter === "Upcoming" && f.date > today())),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(`${month}-01T12:00:00`),
    days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return (
    <>
      <div className="follow-toolbar">
        <div className="service-tabs">
          {["All", "Overdue", "Today", "Upcoming", "Completed"].map((t) => (
            <button key={t} className={filter === t ? "selected" : ""} onClick={() => setFilter(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setCalendar((v) => !v)}>
            <CalendarDays size={16} />
            {calendar ? "List view" : "Calendar view"}
          </button>
          <button
            className="btn primary"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            Schedule
          </button>
        </div>
      </div>
      {calendar ? (
        <section className="panel calendar-panel">
          <Field label="Calendar month">
            <input
              type="month"
              required
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </Field>
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <b key={d}>{d}</b>
            ))}
            {Array.from({ length: start.getDay() }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const d = `${month}-${String(i + 1).padStart(2, "0")}`;
              return (
                <div className={d === today() ? "today" : ""} key={d}>
                  <span>{i + 1}</span>
                  {fs
                    .filter((f) => f.date === d)
                    .map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setEditing(f);
                          setOpen(true);
                        }}
                      >
                        {store.quotes.find((q) => q.id === f.quoteId)?.customer || "Quotation"}
                        <small>{f.priority}</small>
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="panel follow-list">
          {fs.length ? (
            fs.map((f) => {
              const q = store.quotes.find((q) => q.id === f.quoteId);
              return (
                <article key={f.id}>
                  <span className={`follow-date ${!f.done && f.date < today() ? "overdue" : ""}`}>
                    <CalendarClock size={18} />
                    {f.date}
                  </span>
                  <div>
                    <h3>{q?.customer || "Quotation"}</h3>
                    <p>
                      {q?.number} · {f.employee} · {f.priority} priority
                    </p>
                    <small>{f.notes}</small>
                  </div>
                  <Badge
                    status={
                      f.done
                        ? "Completed"
                        : f.date < today()
                          ? "Overdue"
                          : f.date === today()
                            ? "Today"
                            : "Upcoming"
                    }
                  />
                  <button
                    className="btn"
                    onClick={() => {
                      setEditing(f);
                      setOpen(true);
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    className="icon-btn"
                    disabled={busy}
                    aria-label={f.done ? "Reopen follow-up" : "Complete follow-up"}
                    onClick={() =>
                      onSave(
                        store.followups.map((v) => (v.id === f.id ? { ...v, done: !v.done } : v)),
                      ).catch(() => {})
                    }
                  >
                    <Check size={19} />
                  </button>
                </article>
              );
            })
          ) : (
            <Empty
              title="All caught up"
              text="Schedule your next conversation from a quotation or the button above."
            />
          )}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit follow-up" : "Schedule follow-up"}</DialogTitle>
            <DialogDescription>
              Choose an employee and a date for the next conversation.
            </DialogDescription>
          </DialogHeader>
          <FollowForm
            key={editing?.id || "new"}
            quotes={store.quotes}
            members={members}
            {...(editing ? { existing: editing } : {})}
            onSave={async (f) => {
              await onSave(
                editing
                  ? store.followups.map((v) => (v.id === f.id ? f : v))
                  : [...store.followups, f],
              );
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Catalog({
  services,
  admin,
  onSave,
}: {
  services: Service[];
  admin: boolean;
  onSave: (s: Service[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Service | null>(null),
    [query, setQuery] = useState("");
  return (
    <>
      <div className="follow-toolbar">
        <div className="input-icon">
          <Search size={16} />
          <input
            aria-label="Search services"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a service…"
          />
        </div>
        {admin && (
          <button
            className="btn primary"
            onClick={() =>
              setEditing({
                id: uid(),
                name: "",
                category: "Detailing",
                description: "",
                prices: Object.fromEntries(categories.map((c) => [c, 0])),
                active: true,
              })
            }
          >
            <Plus size={16} />
            Add service
          </button>
        )}
      </div>
      <div className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SERVICE</th>
                {categories.map((c) => (
                  <th key={c}>{c.toUpperCase()}</th>
                ))}
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {services
                .filter((s) =>
                  `${s.name} ${s.category}`.toLowerCase().includes(query.toLowerCase()),
                )
                .map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.name}</b>
                      <small>
                        {s.category}
                        {s.demo ? " · DEMO" : ""}
                      </small>
                    </td>
                    {categories.map((c) => (
                      <td key={c}>
                        {!s.applicableCategories || s.applicableCategories.includes(c)
                          ? money(s.prices[c] || 0)
                          : "—"}
                      </td>
                    ))}
                    <td>
                      <Badge status={s.active ? "Active" : "Inactive"} />
                    </td>
                    <td>
                      {admin && (
                        <div className="table-actions">
                          <button
                            className="icon-btn"
                            title="Edit service"
                            aria-label={`Edit ${s.name}`}
                            onClick={() => setEditing({ ...s, prices: { ...s.prices } })}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Move service up"
                            aria-label={`Move ${s.name} up`}
                            onClick={() => {
                              const next = [...services],
                                i = next.findIndex((v) => v.id === s.id);
                              if (i > 0) {
                                [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                                onSave(next).catch(() => {});
                              }
                            }}
                          >
                            <TrendingUp size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!services.length && (
          <Empty
            title="Add your official catalog"
            text="Define services and vehicle-specific prices to start quoting."
          />
        )}
      </div>
      <p className="muted">
        Prices include 18% GST. Existing quotations keep their original prices.{" "}
        {admin ? "" : "Only Admins can edit the catalog."}
      </p>
      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="quote-dialog">
          <DialogHeader>
            <DialogTitle>Service details</DialogTitle>
            <DialogDescription>
              Set GST-inclusive prices for each vehicle category.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (Object.values(editing.prices).some((p) => p < 0 || !Number.isSafeInteger(p))) {
                  toast.error("Enter valid non-negative prices.");
                  return;
                }
                try {
                  await onSave(
                    services.some((s) => s.id === editing.id)
                      ? services.map((s) => (s.id === editing.id ? { ...editing, demo: false } : s))
                      : [...services, editing],
                  );
                  setEditing(null);
                } catch {}
              }}
            >
              <div className="form-grid">
                <Field label="Service name">
                  <input
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field label="Category">
                  <input
                    required
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <fieldset className="applicability">
                <legend>Applicable vehicle categories</legend>
                <div className="actions">
                  {categories.map((c) => (
                    <label key={c} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={
                          !editing.applicableCategories || editing.applicableCategories.includes(c)
                        }
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            applicableCategories: e.target.checked
                              ? [...new Set([...(editing.applicableCategories || categories), c])]
                              : (editing.applicableCategories || categories).filter((v) => v !== c),
                          })
                        }
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="form-grid">
                {categories.map((c) => (
                  <Field label={`${c} (₹)`} key={c}>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={(editing.prices[c] || 0) / 100}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          prices: { ...editing.prices, [c]: rupees(e.target.value) },
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active service
              </label>
              <button className="btn primary">Save service</button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Reports({
  store,
  monthly,
}: {
  store: Store;
  monthly: { month: string; value: number; count: number }[];
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const qs = store.quotes.filter((q) => (!from || q.date >= from) && (!to || q.date <= to));
  const value = qs.reduce((s, q) => s + totals(q.items, q.discount, q.booking).total, 0),
    bookings = qs.filter((q) => q.status === "Booked");
  function grouped(key: "staff" | "source") {
    return Object.entries(
      qs.reduce<Record<string, { count: number; value: number; booked: number }>>((a, q) => {
        const k = q[key] || "Unassigned";
        a[k] ??= { count: 0, value: 0, booked: 0 };
        a[k].count++;
        a[k].value += totals(q.items, q.discount, q.booking).total;
        if (q.status === "Booked") a[k].booked++;
        return a;
      }, {}),
    );
  }
  const services = Object.entries(
    qs
      .filter((q) => q.status === "Booked")
      .flatMap((q) =>
        q.items.map((i) => {
          const t = totals(q.items, q.discount, q.booking);
          return { ...i, price: t.subtotal ? Math.round((i.price * t.total) / t.subtotal) : 0 };
        }),
      )
      .reduce<Record<string, number>>((a, i) => {
        a[i.name] = (a[i.name] || 0) + i.price;
        return a;
      }, {}),
  );
  return (
    <>
      <div className="date-filters">
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <button
          className="btn"
          onClick={() =>
            csvDownload("formatix-report.csv", [
              ["Quotation", "Customer", "Status", "Value INR", "Recorded advance INR"],
              ...qs.map((q) => [
                q.number,
                q.customer,
                q.status,
                totals(q.items, q.discount, q.booking).total / 100,
                q.booking / 100,
              ]),
            ])
          }
        >
          <Download size={16} />
          Export filtered report
        </button>
      </div>
      <div className="metrics">
        <Metric
          title="Quotation value"
          value={money(value)}
          detail={`${qs.length} quotations in selected range`}
          icon={<Wallet size={18} />}
        />
        <Metric
          title="Booked value"
          value={money(
            bookings.reduce((s, q) => s + totals(q.items, q.discount, q.booking).total, 0),
          )}
          detail="Confirmed business, not collected revenue"
          icon={<ShieldCheck size={18} />}
        />
        <Metric
          title="Recorded advances"
          value={money(qs.reduce((s, q) => s + q.booking, 0))}
          detail="Manually recorded · not verified collections"
          icon={<FileText size={18} />}
        />
        <Metric
          title="Booking conversion"
          value={`${qs.length ? Math.round((bookings.length / qs.length) * 100) : 0}%`}
          detail={`${bookings.length} of ${qs.length} quotations booked`}
          icon={<Target size={18} />}
        />
      </div>
      <div className="report-grid">
        {(["staff", "source"] as const).map((key) => (
          <section className="panel" key={key}>
            <div className="panel-heading">
              <h2>{key === "staff" ? "Employee-wise results" : "Lead-source performance"}</h2>
              <button
                className="icon-btn"
                aria-label={`Export ${key} report`}
                onClick={() =>
                  csvDownload(`formatix-${key}.csv`, [
                    [key, "Quotations", "Booked", "Value INR"],
                    ...grouped(key).map(([k, v]) => [k, v.count, v.booked, v.value / 100]),
                  ])
                }
              >
                <Download size={16} />
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{key.toUpperCase()}</th>
                  <th>QUOTES</th>
                  <th>BOOKED</th>
                  <th>VALUE</th>
                </tr>
              </thead>
              <tbody>
                {grouped(key).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v.count}</td>
                    <td>{v.booked}</td>
                    <td>{money(v.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!qs.length && <Empty />}
          </section>
        ))}
        <section className="panel">
          <div className="panel-heading">
            <h2>Service-wise booked value</h2>
            <button
              className="icon-btn"
              aria-label="Export service report"
              onClick={() =>
                csvDownload("formatix-services.csv", [
                  ["Service", "Booked value INR"],
                  ...services.map(([k, v]) => [k, v / 100]),
                ])
              }
            >
              <Download size={16} />
            </button>
          </div>
          <p className="report-caption">
            Discount allocated proportionally. Includes GST; not collected revenue.
          </p>
          {services.map(([k, v]) => (
            <div className="report-row" key={k}>
              <span>{k}</span>
              <b>{money(v)}</b>
            </div>
          ))}
          {!services.length && <Empty />}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Monthly performance</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>MONTH</th>
                <th>QUOTATIONS</th>
                <th>VALUE</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td>{m.count}</td>
                  <td>{money(m.value * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="report-caption">Rolling monthly overview for all records.</p>
        </section>
      </div>
    </>
  );
}

function Settings({
  store,
  admin,
  members,
  cloud,
  onSave,
  onMember,
}: {
  store: Store;
  admin: boolean;
  members: Member[];
  cloud: boolean;
  onSave: (s: Store["settings"]) => Promise<void>;
  onMember: (e: string, n: string, r: string) => Promise<void>;
}) {
  const [s, setS] = useState(store.settings),
    [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState("Staff"),
    [busy, setBusy] = useState(false);
  return (
    <div className="settings-layout">
      <form
        className="panel form-panel stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(s);
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Studio & quotation settings</h2>
        <div className="form-grid">
          {(
            [
              ["company", "Company name"],
              ["phone", "Contact number"],
              ["gstin", "GSTIN"],
              ["prefix", "Quotation prefix"],
            ] as const
          ).map(([k, l]) => (
            <Field key={k} label={l}>
              <input
                required={k === "company" || k === "prefix"}
                disabled={!admin}
                value={s[k]}
                onChange={(e) => setS({ ...s, [k]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <Field label="Studio address">
          <textarea
            disabled={!admin}
            value={s.address}
            onChange={(e) => setS({ ...s, address: e.target.value })}
          />
        </Field>
        <Field label="Company logo (PNG or JPEG, max 500 KB)">
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={!admin}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 500000 || !["image/png", "image/jpeg"].includes(file.type)) {
                toast.error("Use a PNG or JPEG smaller than 500 KB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setS({ ...s, logo: String(reader.result) });
              reader.readAsDataURL(file);
            }}
          />
        </Field>
        {s.logo && <img className="logo-preview" src={s.logo} alt="Studio logo" />}
        <Field label="Bank / payment details">
          <textarea
            disabled={!admin}
            value={s.bank}
            onChange={(e) => setS({ ...s, bank: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="Quotation validity (days)">
            <input
              required
              min="1"
              max="365"
              type="number"
              disabled={!admin}
              value={s.validity}
              onChange={(e) => setS({ ...s, validity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Tax calculation">
            <input readOnly value="18% GST included in prices" />
          </Field>
        </div>
        <Field label="Terms & conditions">
          <textarea
            disabled={!admin}
            rows={5}
            value={s.terms}
            onChange={(e) => setS({ ...s, terms: e.target.value })}
          />
        </Field>
        <p className="muted">Tax stays fixed at the requested GST-inclusive 18%.</p>
        {admin && (
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        )}
      </form>
      <section className="panel form-panel">
        <h2>Team & permissions</h2>
        <p className="muted">
          Admins manage master prices and permissions. Staff use approved catalog prices.
        </p>
        {members.map((m) => (
          <div className="member-row" key={m.id}>
            <span className="avatar small">{m.name.slice(0, 2).toUpperCase()}</span>
            <span>
              {m.name}
              <small>{m.email}</small>
            </span>
            <Badge status={m.role} />
          </div>
        ))}
        {!cloud && (
          <div className="demo-note">
            Staff management requires cloud sign-in. Demo role: Admin.
          </div>
        )}
        {admin && cloud && (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onMember(email, name, role);
                setEmail("");
                setName("");
              } catch (e) {
                toast.error(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Add or update a team member</h3>
            <Field label="Registered account email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Display name">
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option>Staff</option>
                <option>Admin</option>
              </select>
            </Field>
            <button className="btn" disabled={busy}>
              Save team access
            </button>
            <small className="muted">
              Employees must create an account first. Adding an existing email updates their role.
              Permissions are checked in the database.
            </small>
          </form>
        )}
      </section>
    </div>
  );
}
function AuthForm({ onLogin }: { onLogin: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const result = signup
            ? await auth().signUp({ email, password })
            : await auth().signInWithPassword({ email, password });
          if (result.error) throw result.error;
          if (signup && !result.data.session)
            toast.success("Account created. Check your email to confirm, then sign in.");
          else await onLogin(email);
        } catch (e) {
          toast.error(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Email">
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <button className="btn primary" disabled={busy}>
        {busy ? "Connecting…" : signup ? "Create account" : "Sign in"}
      </button>
      <button type="button" className="text-btn" onClick={() => setSignup((v) => !v)}>
        {signup ? "Already have an account? Sign in" : "New to Formatix? Create an account"}
      </button>
    </form>
  );
}
