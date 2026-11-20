// nav.js — Mobile App Bottom Tab Dock, Top Bar, Light/Dark Theme Toggle & Global Import/Export

(function applyInitialTheme() {
  try {
    const saved = localStorage.getItem('hwTheme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  } catch {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const navBar = document.querySelector('.menu-bar');
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const getCounts = () => {
    let ownedTotal = 0;
    let wantedTotal = 0;
    try {
      const owned = JSON.parse(localStorage.getItem('ownedCars') || '[]');
      ownedTotal = owned.reduce((sum, item) => sum + (item.quantity || 1), 0);
      wantedTotal = JSON.parse(localStorage.getItem('wantedCars') || '[]').length;
    } catch {}
    return { ownedTotal, wantedTotal };
  };

  const { ownedTotal, wantedTotal } = getCounts();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const navItems = [
    { id: 'search', label: 'Search', icon: '🔍', url: 'index.html', active: currentPage === 'index.html' || currentPage === '' },
    { id: 'wanted', label: 'Wanted', icon: '★', url: 'wanted.html', active: currentPage === 'wanted.html', badge: wantedTotal },
    { id: 'series', label: 'Series', icon: '🏆', url: 'series.html', active: currentPage === 'series.html' },
    { id: 'owned', label: 'Garage', icon: '🏎️', url: 'owned.html', active: currentPage === 'owned.html', badge: ownedTotal },
    { id: 'dups', label: 'Trades', icon: '♻️', url: 'duplicates.html', active: currentPage === 'duplicates.html' },
    { id: 'admin', label: '+ Add DB', icon: '⚙️', url: 'admin-cars.html', active: currentPage === 'admin-cars.html' }
  ];

  if (navBar) {
    navBar.className = 'app-topbar';
    navBar.innerHTML = `
      <div class="topbar-inner">
        <a href="index.html" class="brand-logo">
          <span class="brand-flame">🔥</span>
          <span>HW Garage</span>
        </a>

        <div class="desktop-nav-links">
          ${navItems.map(item => `
            <button class="desktop-tab-btn ${item.active ? 'active' : ''}" data-href="${item.url}">
              <span>${item.icon}</span>
              <span>${item.label}</span>
              ${typeof item.badge === 'number' ? `<span class="nav-badge" data-badge-type="${item.id}">${item.badge}</span>` : ''}
            </button>
          `).join('')}
        </div>

        <div class="topbar-actions">
          <button id="exportBtn" class="icon-pill-btn" title="Export Backup">⬆ Export</button>
          <input type="file" id="importFile" accept=".json" style="display:none;">
          <button id="importBtn" class="icon-pill-btn" title="Import Backup">⬇ Import</button>
          <button id="themeToggleBtn" class="theme-toggle-btn" title="Switch Light / Dark Mode">
            <span id="themeIcon">${isDark ? '☀️' : '🌙'}</span>
            <span id="themeLabel">${isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>
    `;
  }

  // Inject Mobile App Bottom Tab Dock
  const bottomNav = document.createElement('nav');
  bottomNav.className = 'mobile-bottom-nav';
  bottomNav.setAttribute('aria-label', 'App Navigation');
  bottomNav.innerHTML = navItems.map(item => `
    <button class="bottom-tab ${item.active ? 'active' : ''}" data-href="${item.url}">
      <span class="tab-icon">${item.icon}</span>
      <span>${item.label}</span>
      ${typeof item.badge === 'number' && item.badge > 0 ? `<span class="tab-badge" data-badge-type="${item.id}">${item.badge}</span>` : ''}
    </button>
  `).join('');
  document.body.appendChild(bottomNav);

  // Attach navigation listeners to both top desktop tabs and bottom mobile tabs
  document.querySelectorAll('[data-href]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-href');
      if (target && currentPage !== target) {
        window.location.href = target;
      }
    });
  });

  // Theme Toggle Handler
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('hwTheme', next); } catch {}
      const iconEl = document.getElementById('themeIcon');
      const labelEl = document.getElementById('themeLabel');
      if (iconEl) iconEl.textContent = next === 'dark' ? '☀️' : '🌙';
      if (labelEl) labelEl.textContent = next === 'dark' ? 'Light' : 'Dark';
    });
  }

  // Export Backup
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const wantedCars = JSON.parse(localStorage.getItem('wantedCars') || '[]');
      const ownedCars = JSON.parse(localStorage.getItem('ownedCars') || '[]');
      if (!wantedCars.length && !ownedCars.length) {
        alert('No owned or wanted cars to export yet!');
        return;
      }
      const payload = { exportedAt: new Date().toISOString(), wantedCars, ownedCars };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hotwheels_collection_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Import Backup
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (!Array.isArray(imported.wantedCars) && !Array.isArray(imported.ownedCars)) {
            throw new Error('Invalid backup format.');
          }
          localStorage.setItem('wantedCars', JSON.stringify(imported.wantedCars || []));
          localStorage.setItem('ownedCars', JSON.stringify(imported.ownedCars || []));
          alert('Collection imported successfully!');
          window.location.reload();
        } catch (err) {
          alert('Failed to import: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
});

window.updateNavBadges = function () {
  try {
    const owned = JSON.parse(localStorage.getItem('ownedCars') || '[]');
    const wanted = JSON.parse(localStorage.getItem('wantedCars') || '[]');
    const totalOwned = owned.reduce((s, i) => s + (i.quantity || 1), 0);
    document.querySelectorAll('[data-badge-type="owned"]').forEach(el => el.textContent = totalOwned);
    document.querySelectorAll('[data-badge-type="wanted"]').forEach(el => el.textContent = wanted.length);
  } catch {}
};
