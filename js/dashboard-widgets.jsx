function WidgetIcon({ name }) {
  const icons = {
    shield: (
      <path d="M12 3l7 3v5c0 4.6-2.9 8.5-7 10-4.1-1.5-7-5.4-7-10V6l7-3zm0 4v10m-4-5h8" />
    ),
    file: (
      <path d="M7 3h7l4 4v14H7V3zm7 0v5h5M9 12h6M9 16h6" />
    ),
    users: (
      <path d="M16 11a4 4 0 10-8 0 4 4 0 008 0zm-11 9a7 7 0 0114 0M18 9a3 3 0 110 6" />
    ),
    chart: (
      <path d="M4 19h16M7 16V9m5 7V5m5 11v-4" />
    ),
    clock: (
      <path d="M12 4a8 8 0 100 16 8 8 0 000-16zm0 4v5l3 2" />
    ),
    lock: (
      <path d="M7 10V8a5 5 0 0110 0v2m-9 0h8a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6a2 2 0 012-2z" />
    )
  };

  return (
    <svg className="widget-icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name] || icons.chart}
    </svg>
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("en").format(value || 0);
}

function TrackerWidget() {
  const [summary, setSummary] = React.useState({
    active: 0,
    pending: 0,
    completed: 0,
    missingDocs: 0
  });

  React.useEffect(() => {
    fetch("/api/data", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        const candidates = Array.isArray(data.candidates) ? data.candidates : [];
        setSummary({
          active: candidates.length,
          pending: candidates.filter((candidate) => !candidate.completed).length,
          completed: candidates.filter((candidate) => candidate.completed).length,
          missingDocs: candidates.filter((candidate) => candidate.missingDocs && candidate.missingDocs.length).length
        });
      })
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Active records", value: summary.active, icon: "users" },
    { label: "Pending review", value: summary.pending, icon: "clock" },
    { label: "Completed", value: summary.completed, icon: "shield" },
    { label: "Missing docs", value: summary.missingDocs, icon: "file" }
  ];

  return (
    <div className="react-overview">
      <div className="react-overview-copy">
        <p className="eyebrow">React workspace</p>
        <h2>Today’s compliance pulse</h2>
        <p>Quick visual summary for the records below, designed for faster scanning before working in the table.</p>
      </div>
      <div className="react-metric-grid">
        {cards.map((card) => (
          <article className="react-metric-card" key={card.label}>
            <WidgetIcon name={card.icon} />
            <span>{formatNumber(card.value)}</span>
            <p>{card.label}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function AdminWidget() {
  const [summary, setSummary] = React.useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    activityEvents: 0
  });

  React.useEffect(() => {
    fetch("/api/admin/summary", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && data.stats) setSummary(data.stats);
      })
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Total users", value: summary.totalUsers, icon: "users" },
    { label: "Approved", value: summary.activeUsers, icon: "shield" },
    { label: "Admins", value: summary.adminUsers, icon: "lock" },
    { label: "History events", value: summary.activityEvents, icon: "chart" }
  ];

  return (
    <div className="react-overview admin-react-overview">
      <div className="react-overview-copy">
        <p className="eyebrow">React control center</p>
        <h2>Access and activity at a glance</h2>
        <p>Keep the admin page focused with a clean summary before reviewing users, records, and history.</p>
      </div>
      <div className="react-metric-grid">
        {cards.map((card) => (
          <article className="react-metric-card" key={card.label}>
            <WidgetIcon name={card.icon} />
            <span>{formatNumber(card.value)}</span>
            <p>{card.label}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

const trackerRoot = document.getElementById("trackerReactPanel");
if (trackerRoot) {
  ReactDOM.createRoot(trackerRoot).render(<TrackerWidget />);
}

const adminRoot = document.getElementById("adminReactPanel");
if (adminRoot) {
  ReactDOM.createRoot(adminRoot).render(<AdminWidget />);
}
