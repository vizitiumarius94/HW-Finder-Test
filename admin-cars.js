(() => {
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'admin';
  const STORAGE_KEY = 'adminCarsDraftSession';
  const DB_OVERRIDE_KEY = 'hwCustomDatabaseOverride';

  const loginView = document.getElementById('loginView');
  const adminView = document.getElementById('adminView');
  const adminTopActions = document.getElementById('adminTopActions');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  const yearSelect = document.getElementById('yearSelect');
  const caseSelect = document.getElementById('caseSelect');
  const caseSearch = document.getElementById('caseSearch');

  const thSelect = document.getElementById('thSelect');
  const sthSelect = document.getElementById('sthSelect');
  const thPreview = document.getElementById('thPreview');
  const sthPreview = document.getElementById('sthPreview');
  const thSthSave = document.getElementById('thSthSave');

  const carsList = document.getElementById('carsList');
  const exportBtnAdmin = document.getElementById('exportBtnAdmin');
  const resetOverrideBtn = document.getElementById('resetOverrideBtn');
  const quickAddForm = document.getElementById('quickAddForm');
  const caseCarsCountHeading = document.getElementById('caseCarsCountHeading');

  let draftData = null;
  let currentYear = '';
  let currentCaseLetter = '';

  function showToast(msg) {
    const existing = document.querySelector('.toast-banner');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'toast-banner';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  }

  function setLoggedIn(loggedIn) {
    loginView.style.display = loggedIn ? 'none' : 'block';
    adminView.style.display = loggedIn ? 'block' : 'none';
    if (adminTopActions) adminTopActions.style.display = loggedIn ? 'flex' : 'none';
  }

  function isLoggedIn() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  // Convert an uploaded file into a compressed data URL so it persists in localStorage AND data.json!
  function fileToCompressedDataURL(file, maxWidth = 600) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function saveDraftToBrowser() {
    try {
      localStorage.setItem(DB_OVERRIDE_KEY, JSON.stringify(draftData));
      window.carsData = draftData;
    } catch (err) {
      alert('Browser storage is full (too many embedded photos). Please click "Download data.json" to save your changes!');
    }
  }

  function getCaseObject() {
    if (!draftData || !currentYear || !currentCaseLetter) return null;
    const yearObj = draftData[currentYear];
    if (!yearObj || !Array.isArray(yearObj.cases)) return null;
    return yearObj.cases.find(c => c && c.letter === currentCaseLetter) || null;
  }

  function ensureThSthShape(caseObj) {
    if (!caseObj.th || typeof caseObj.th !== 'object') caseObj.th = { name: '', image: '', hw_number: '' };
    if (!caseObj.sth || typeof caseObj.sth !== 'object') caseObj.sth = { name: '', image: '', hw_number: '' };
  }

  function renderThSthSelects() {
    const caseObj = getCaseObject();
    if (!caseObj) return;
    ensureThSthShape(caseObj);

    const cars = caseObj.cars || [];
    thSelect.innerHTML = '<option value="">(None)</option>';
    sthSelect.innerHTML = '<option value="">(None)</option>';

    cars.forEach((car, idx) => {
      const label = `${car.name || 'Unnamed'} (#${car.hw_number || '?'} • ${car.color || 'N/A'})`;
      const optTh = document.createElement('option');
      optTh.value = String(idx);
      optTh.textContent = label;
      thSelect.appendChild(optTh);

      const optSth = document.createElement('option');
      optSth.value = String(idx);
      optSth.textContent = label;
      sthSelect.appendChild(optSth);
    });

    function findMatch(target) {
      if (!target || !target.name) return '';
      const byImg = cars.findIndex(c => c.image === target.image && c.name === target.name);
      if (byImg !== -1) return String(byImg);
      const byName = cars.findIndex(c => c.name === target.name);
      return byName !== -1 ? String(byName) : '';
    }

    thSelect.value = findMatch(caseObj.th);
    sthSelect.value = findMatch(caseObj.sth);

    const updatePreview = (sel, imgEl) => {
      const idx = parseInt(sel.value, 10);
      imgEl.src = Number.isFinite(idx) && cars[idx] ? (cars[idx].image || 'images/images-coming-soon.png') : 'images/images-coming-soon.png';
    };

    thSelect.onchange = () => updatePreview(thSelect, thPreview);
    sthSelect.onchange = () => updatePreview(sthSelect, sthPreview);
    updatePreview(thSelect, thPreview);
    updatePreview(sthSelect, sthPreview);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function makeCarRowUI(car, realIdx) {
    const row = document.createElement('div');
    row.className = 'admin-car-row';

    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <strong>#${realIdx + 1} — ${escapeHtml(car.name || 'New Car')}</strong>
        <button type="button" class="action-btn danger del-car-btn" style="padding:6px 12px; font-size:0.8rem;">Delete Car</button>
      </div>
      <div class="admin-car-layout">
        <div class="admin-img-box">
          <img class="car-preview-img" src="${escapeHtml(car.image || 'images/images-coming-soon.png')}" alt="${escapeHtml(car.name)}" onerror="this.src='images/images-coming-soon.png'">
          <input type="text" class="edit-img-path" value="${escapeHtml(car.image || '')}" placeholder="images/filename.jpg" style="padding:6px 8px; font-size:0.78rem;">
          <input type="file" class="edit-img-file" accept="image/*" style="font-size:0.75rem; color:var(--text-secondary);">
        </div>
        <div class="admin-grid-form">
          <div class="form-group">
            <label>Name</label>
            <input type="text" class="edit-name" value="${escapeHtml(car.name || '')}">
          </div>
          <div class="form-group">
            <label>HW #</label>
            <input type="text" class="edit-hw" value="${escapeHtml(car.hw_number || '')}">
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="text" class="edit-color" value="${escapeHtml(car.color || '')}">
          </div>
          <div class="form-group">
            <label>Series</label>
            <input type="text" class="edit-series" value="${escapeHtml(car.series || '')}">
          </div>
          <div class="form-group">
            <label>Series #</label>
            <input type="text" class="edit-sernum" value="${escapeHtml(car.series_number || '')}">
          </div>
          <div class="form-group" style="justify-content:flex-end;">
            <button type="button" class="action-btn blue save-car-btn">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    const fileInput = row.querySelector('.edit-img-file');
    const pathInput = row.querySelector('.edit-img-path');
    const previewImg = row.querySelector('.car-preview-img');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const dataUrl = await fileToCompressedDataURL(file);
      pathInput.value = dataUrl;
      previewImg.src = dataUrl;
    });

    row.querySelector('.save-car-btn').addEventListener('click', () => {
      const caseObj = getCaseObject();
      if (!caseObj) return;
      const target = caseObj.cars[realIdx];
      target.name = row.querySelector('.edit-name').value.trim();
      target.hw_number = row.querySelector('.edit-hw').value.trim();
      target.color = row.querySelector('.edit-color').value.trim();
      target.series = row.querySelector('.edit-series').value.trim();
      target.series_number = row.querySelector('.edit-sernum').value.trim();
      target.image = pathInput.value.trim() || 'images/images-coming-soon.png';
      saveDraftToBrowser();
      renderCars();
      showToast(`Saved "${target.name}"!`);
    });

    row.querySelector('.del-car-btn').addEventListener('click', () => {
      if (!confirm(`Delete "${car.name}" from ${currentYear} Case ${currentCaseLetter}?`)) return;
      const caseObj = getCaseObject();
      if (!caseObj) return;
      caseObj.cars.splice(realIdx, 1);
      saveDraftToBrowser();
      renderCars();
      showToast('Car deleted from draft.');
    });

    return row;
  }

  function renderCars() {
    carsList.innerHTML = '';
    const caseObj = getCaseObject();
    if (!caseObj) return;

    const cars = caseObj.cars || [];
    const q = (caseSearch.value || '').toLowerCase().trim();

    const filtered = q
      ? cars.filter(car =>
          String(car.name || '').toLowerCase().includes(q) ||
          String(car.hw_number || '').toLowerCase().includes(q) ||
          String(car.color || '').toLowerCase().includes(q) ||
          String(car.series || '').toLowerCase().includes(q)
        )
      : cars;

    if (caseCarsCountHeading) {
      caseCarsCountHeading.textContent = `${currentYear} Case ${currentCaseLetter} — ${filtered.length} of ${cars.length} Cars`;
    }

    filtered.forEach(car => {
      const realIdx = cars.indexOf(car);
      carsList.appendChild(makeCarRowUI(car, realIdx));
    });

    renderThSthSelects();
  }

  function populateSelectors(selectYearVal = null, selectCaseVal = null) {
    const years = Object.keys(draftData || {}).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    yearSelect.innerHTML = '';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });

    currentYear = selectYearVal && draftData[selectYearVal] ? selectYearVal : (years[0] || '');
    yearSelect.value = currentYear;

    const cases = Array.isArray(draftData[currentYear]?.cases)
      ? draftData[currentYear].cases.map(c => c.letter).filter(Boolean).sort()
      : [];

    caseSelect.innerHTML = '';
    cases.forEach(letter => {
      const opt = document.createElement('option');
      opt.value = letter;
      opt.textContent = `Case ${letter}`;
      caseSelect.appendChild(opt);
    });

    currentCaseLetter = selectCaseVal && cases.includes(selectCaseVal) ? selectCaseVal : (cases[0] || '');
    caseSelect.value = currentCaseLetter;

    const newYearInput = document.getElementById('newCarYear');
    const newCaseInput = document.getElementById('newCarCase');
    if (newYearInput && !newYearInput.value) newYearInput.value = currentYear;
    if (newCaseInput && !newCaseInput.value) newCaseInput.value = currentCaseLetter;

    renderCars();
  }

  // Quick Add Car Form Submission
  if (quickAddForm) {
    quickAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const year = document.getElementById('newCarYear').value.trim();
      const caseLetter = document.getElementById('newCarCase').value.trim().toUpperCase();
      const name = document.getElementById('newCarName').value.trim();
      const series = document.getElementById('newCarSeries').value.trim() || 'Mainline';
      const series_number = document.getElementById('newCarSeriesNum').value.trim() || '1/10';
      const hw_number = document.getElementById('newCarHwNum').value.trim() || '1';
      const color = document.getElementById('newCarColor').value.trim() || 'Standard';
      const huntType = document.getElementById('newCarHuntType').value;
      const pathText = document.getElementById('newCarImagePath').value.trim();
      const fileInput = document.getElementById('newCarImageFile');

      if (!year || !caseLetter || !name) {
        alert('Year, Case Letter, and Car Name are required.');
        return;
      }

      let image = pathText || 'images/images-coming-soon.png';
      if (fileInput.files && fileInput.files[0]) {
        image = await fileToCompressedDataURL(fileInput.files[0]);
      }

      if (!draftData[year]) {
        draftData[year] = { cases: [] };
      }
      if (!Array.isArray(draftData[year].cases)) {
        draftData[year].cases = [];
      }

      let caseObj = draftData[year].cases.find(c => c.letter.toUpperCase() === caseLetter);
      if (!caseObj) {
        caseObj = { letter: caseLetter, th: { name: '', image: '', hw_number: '' }, sth: { name: '', image: '', hw_number: '' }, cars: [] };
        draftData[year].cases.push(caseObj);
      }

      const newCar = { name, image, hw_number, color, series, series_number };
      caseObj.cars.unshift(newCar);

      if (huntType === 'th') {
        caseObj.th = { ...newCar };
      } else if (huntType === 'sth') {
        caseObj.sth = { ...newCar };
      }

      saveDraftToBrowser();
      populateSelectors(year, caseLetter);

      // Clear model-specific fields for rapid entry
      document.getElementById('newCarName').value = '';
      document.getElementById('newCarHwNum').value = '';
      document.getElementById('newCarColor').value = '';
      document.getElementById('newCarImagePath').value = '';
      fileInput.value = '';

      showToast(`Added "${name}" to ${year} Case ${caseLetter}!`);
    });
  }

  loginBtn.addEventListener('click', () => {
    loginError.style.display = 'none';
    const u = document.getElementById('adminUser').value;
    const p = document.getElementById('adminPass').value;
    if (u === ADMIN_USERNAME && p === ADMIN_PASSWORD) {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
      setLoggedIn(true);
      initData();
    } else {
      loginError.style.display = 'block';
      loginError.textContent = 'Wrong username or password (default: admin / admin)';
    }
  });

  yearSelect.addEventListener('change', () => {
    populateSelectors(yearSelect.value, null);
  });

  caseSelect.addEventListener('change', () => {
    currentCaseLetter = caseSelect.value;
    renderCars();
  });

  caseSearch.addEventListener('input', () => renderCars());

  thSthSave.addEventListener('click', () => {
    const caseObj = getCaseObject();
    if (!caseObj) return;
    ensureThSthShape(caseObj);
    const cars = caseObj.cars || [];

    const thIdx = thSelect.value === '' ? -1 : parseInt(thSelect.value, 10);
    const sthIdx = sthSelect.value === '' ? -1 : parseInt(sthSelect.value, 10);

    caseObj.th = thIdx >= 0 && cars[thIdx] ? { ...cars[thIdx] } : { name: '', image: '', hw_number: '' };
    caseObj.sth = sthIdx >= 0 && cars[sthIdx] ? { ...cars[sthIdx] } : { name: '', image: '', hw_number: '' };

    saveDraftToBrowser();
    showToast('Updated TH / STH for this case!');
  });

  exportBtnAdmin.addEventListener('click', () => {
    if (!draftData) return;
    const blob = new Blob([JSON.stringify(draftData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded data.json! Upload it to your GitHub repo to publish globally.');
  });

  if (resetOverrideBtn) {
    resetOverrideBtn.addEventListener('click', async () => {
      if (!confirm('Discard all local browser additions/edits and reload the original data.json from GitHub?')) return;
      localStorage.removeItem(DB_OVERRIDE_KEY);
      const res = await fetch('data.json');
      draftData = await res.json();
      populateSelectors();
      showToast('Reverted to original data.json');
    });
  }

  async function initData() {
    if (draftData) return;
    draftData = await fetchCarData();
    populateSelectors();
  }

  if (isLoggedIn()) {
    setLoggedIn(true);
    initData();
  } else {
    setLoggedIn(false);
  }
})();
