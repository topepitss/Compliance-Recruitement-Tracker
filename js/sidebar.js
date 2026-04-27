/* ==============================
   SIDEBAR TOGGLE
   ============================== */
document.addEventListener('DOMContentLoaded', () => {
  const appShell = document.querySelector('.app-shell');
  const toggleButton = document.getElementById('sidebarToggle');
  const sectionLinks = document.querySelectorAll('.sidebar-nav a[href^="#"]');

  if (!appShell || !toggleButton) return;

  const setCollapsedState = (isCollapsed) => {
    appShell.classList.toggle('sidebar-collapsed', isCollapsed);
    toggleButton.querySelector('.sidebar-toggle-icon').textContent = isCollapsed ? '>>' : '||';
    toggleButton.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    toggleButton.setAttribute('aria-expanded', String(!isCollapsed));
    localStorage.setItem('sustainhealthSidebarCollapsed', String(isCollapsed));
  };

  const savedState = localStorage.getItem('sustainhealthSidebarCollapsed') === 'true';
  setCollapsedState(savedState);

  const setActiveLink = () => {
    const currentHash = window.location.hash || '#trackerTable';

    sectionLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === currentHash);
    });
  };

  setActiveLink();
  window.addEventListener('hashchange', setActiveLink);

  toggleButton.addEventListener('click', () => {
    setCollapsedState(!appShell.classList.contains('sidebar-collapsed'));
  });
});
