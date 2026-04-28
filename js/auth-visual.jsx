function AuthVisual() {
  const page = document.body.dataset.authPage || "login";
  const content = {
    login: {
      title: "Private compliance workspace",
      copy: "Secure access for candidate records, daily reports, and document follow-up.",
      stat: "24",
      label: "active records"
    },
    register: {
      title: "Verified account access",
      copy: "Only trusted users with the private code can create an account.",
      stat: "100%",
      label: "private sign-up"
    },
    password: {
      title: "Account security",
      copy: "Keep tracker access protected with a fresh password.",
      stat: "8+",
      label: "characters"
    }
  }[page] || {};

  return (
    <div className="auth-visual-inner">
      <div className="auth-preview-top">
        <span className="auth-preview-mark">SH</span>
        <span>Live tracker</span>
      </div>
      <h2>{content.title}</h2>
      <p>{content.copy}</p>
      <div className="auth-preview-grid">
        <article>
          <strong>{content.stat}</strong>
          <span>{content.label}</span>
        </article>
        <article>
          <strong>6</strong>
          <span>state checks</span>
        </article>
      </div>
      <div className="auth-preview-list" aria-hidden="true">
        <span><i></i> Document review</span>
        <span><i></i> Risk status</span>
        <span><i></i> Admin history</span>
      </div>
    </div>
  );
}

const authVisualRoot = document.getElementById("authVisual");
if (authVisualRoot) {
  ReactDOM.createRoot(authVisualRoot).render(<AuthVisual />);
}
