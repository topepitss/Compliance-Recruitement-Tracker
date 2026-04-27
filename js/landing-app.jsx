const navLinks = [
  { label: "Overview", href: "#overview" },
  { label: "Workflow", href: "#workflow" },
  { label: "Reports", href: "#reports" },
];

const metrics = [
  { value: "24", label: "active records" },
  { value: "9", label: "docs to review" },
  { value: "4", label: "state checks" },
];

const features = [
  {
    number: "01",
    title: "Candidate overview",
    copy: "See active, completed, and archived records without losing the details that matter.",
  },
  {
    number: "02",
    title: "Document clarity",
    copy: "Track missing files, state requirements, notes, and readiness in one focused view.",
  },
  {
    number: "03",
    title: "Daily reporting",
    copy: "Summarize compliance movement with a clean daily outlook your team can scan quickly.",
  },
];

const workflowSteps = [
  {
    title: "Add candidate",
    copy: "Enter role, state, risk status, missing documents, and notes at intake.",
  },
  {
    title: "Review readiness",
    copy: "Update document progress and risk details as each file is completed.",
  },
  {
    title: "Archive with confidence",
    copy: "Move completed or removed candidates into history while preserving the audit trail.",
  },
];

function Header() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className={`site-header ${isScrolled ? "is-scrolled" : ""}`}>
      <nav className="navbar" aria-label="Main navigation">
        <a className="brand" href="index.html" aria-label="SustainHealth home">
          <span className="brand-mark">SH</span>
          <span className="brand-text">
            <strong>SustainHealth</strong>
            <small>Compliance Tracker</small>
          </span>
        </a>

        <button
          className="nav-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
          aria-controls="siteNavLinks"
          onClick={() => setIsOpen((value) => !value)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div id="siteNavLinks" className={`site-nav ${isOpen ? "is-open" : ""}`}>
          {navLinks.map((link) => (
            <a href={link.href} onClick={closeMenu} key={link.href}>
              {link.label}
            </a>
          ))}
          <a className="nav-action" href="login.html" onClick={closeMenu}>
            Login
          </a>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-backdrop"></div>
      <div className="hero-content">
        <p className="eyebrow">Healthcare compliance workspace</p>
        <h1 id="hero-title">A calmer way to manage compliance records.</h1>
        <p className="hero-copy">
          SustainHealth keeps candidate documents, state requirements, risk notes,
          and daily movement organized in a pleasant workspace built for real follow-up.
        </p>

        <div className="hero-actions">
          <a className="primary-link" href="login.html">Login to Tracker</a>
          <a className="secondary-link" href="#overview">Explore Features</a>
        </div>

        <div className="hero-metrics" aria-label="Tracker highlights">
          {metrics.map((metric) => (
            <div className="metric-card" key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  const rows = [
    ["Maria Lopez", "Nevada", "Ready", "Complete"],
    ["Daniel Kim", "Texas", "Review", "2 missing"],
    ["Avery Smith", "Florida", "Pending", "ID needed"],
  ];

  return (
    <section className="preview-section" aria-label="Tracker preview">
      <div className="preview-shell">
        <div className="preview-toolbar">
          <div>
            <p className="eyebrow">Today at a glance</p>
            <h2>Documents, risks, and records stay easy to read.</h2>
          </div>
          <a className="text-link" href="login.html">Open Tracker</a>
        </div>

        <div className="dashboard-grid">
          <article className="summary-panel">
            <div className="panel-heading">
              <span className="status-dot"></span>
              <strong>Daily outlook</strong>
            </div>
            <div className="chart-bars" aria-label="Daily progress chart">
              {[44, 68, 52, 78, 61, 88].map((height, index) => (
                <span style={{ height: `${height}%` }} key={index}></span>
              ))}
            </div>
          </article>

          <article className="summary-panel">
            <div className="panel-heading">
              <span className="status-dot warning"></span>
              <strong>Review queue</strong>
            </div>
            <ul className="task-list">
              <li><span></span> Missing vaccination form</li>
              <li><span></span> State license verification</li>
              <li><span></span> Risk note follow-up</li>
            </ul>
          </article>

          <article className="table-panel">
            <div className="panel-heading">
              <span className="status-dot calm"></span>
              <strong>Candidate records</strong>
            </div>
            <div className="record-table">
              {rows.map((row) => (
                <div className="record-row" key={row[0]}>
                  {row.map((cell) => <span key={cell}>{cell}</span>)}
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function Overview() {
  return (
    <section id="overview" className="section overview-section">
      <div className="section-heading">
        <p className="eyebrow">Operational clarity</p>
        <h2>Made for everyday compliance work.</h2>
        <p>
          The landing page now feels lighter and more polished while still pointing
          users clearly toward the private tracker.
        </p>
      </div>

      <div className="feature-grid">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <span className="feature-number">{feature.number}</span>
            <h3>{feature.title}</h3>
            <p>{feature.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="section workflow-section">
      <div className="workflow-layout">
        <div className="section-heading">
          <p className="eyebrow">Workflow</p>
          <h2>A steady path from intake to archive.</h2>
          <p>
            Each candidate moves through a simple process, so the team can keep
            records clean without adding extra noise to the day.
          </p>
        </div>

        <div className="timeline">
          {workflowSteps.map((step, index) => (
            <article className="timeline-item" key={step.title}>
              <span>{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reports() {
  return (
    <section id="reports" className="section reports-section">
      <div className="report-panel">
        <div>
          <p className="eyebrow">Ready to use</p>
          <h2>Open the live tracker when it is time to work.</h2>
          <p>
            Login is required before candidate documents, compliance notes, and
            archive history are available.
          </p>
        </div>
        <div className="report-chips" aria-label="Tracker capabilities">
          <span>Candidate list</span>
          <span>Daily report</span>
          <span>Archive history</span>
        </div>
        <a className="primary-link" href="login.html">Login to Tracker</a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <a className="brand" href="index.html" aria-label="SustainHealth home">
            <span className="brand-mark">SH</span>
            <span className="brand-text">
              <strong>SustainHealth</strong>
              <small>Compliance Tracker</small>
            </span>
          </a>
          <p>
            Helping compliance teams keep candidate records, documents, and daily
            activity organized with a calmer front door.
          </p>
        </div>

        <div className="footer-links">
          <h2>Navigate</h2>
          {navLinks.map((link) => (
            <a href={link.href} key={link.href}>{link.label}</a>
          ))}
        </div>

        <div className="footer-links">
          <h2>Account</h2>
          <a href="login.html">Login</a>
          <a href="change-password.html">Change Password</a>
        </div>
      </div>

      <div className="footer-bottom">
        <p>SustainHealth Compliance Tracker by Bhel</p>
        <span>Private tracker access required</span>
      </div>
    </footer>
  );
}

function LandingPage() {
  return (
    <React.Fragment>
      <Header />
      <main>
        <Hero />
        <DashboardPreview />
        <Overview />
        <Workflow />
        <Reports />
      </main>
      <Footer />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LandingPage />);
