// popup.js — Car Detail Modal & Full Case/Series Viewer

const popup = document.getElementById('popup');
const detailsDiv = document.getElementById('details');
const popupClose = document.getElementById('popupClose');

const extractSeriesNumber = val => {
  if (!val) return 0;
  const m = String(val).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

function showDetails(year, hwCase, car) {
  const wantedCars = JSON.parse(localStorage.getItem('wantedCars') || '[]');
  const ownedCars = JSON.parse(localStorage.getItem('ownedCars') || '[]');

  const isCarTH = hwCase.th && car.hw_number === hwCase.th.hw_number && car.image === hwCase.th.image;
  const isCarSTH = hwCase.sth && car.hw_number === hwCase.sth.hw_number && car.image === hwCase.sth.image;

  const sthColor = 'style="color: #fde047; text-shadow: 0 0 14px rgba(251,191,36,0.45);"';
  const thColor = 'style="color: #bae6fd; text-shadow: 0 0 12px rgba(56,189,248,0.4);"';
  const carNameStyle = isCarSTH ? sthColor : (isCarTH ? thColor : '');

  const isOwned = ownedCars.some(o => o.car.image === car.image && o.car.name === car.name);
  const isWanted = wantedCars.some(w => w.car.image === car.image && w.car.name === car.name);

  detailsDiv.innerHTML = `
    <div class="card-detail">
      <div class="detail-img-stage">
        <img src="${car.image || 'images/images-coming-soon.png'}" alt="${car.name}" onerror="this.src='images/images-coming-soon.png'">
      </div>
      <div class="card-info">
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
          <span class="case-pill">${year} • Case ${hwCase.letter}</span>
          ${isCarSTH ? '<span class="case-pill" style="background:rgba(251,191,36,0.2); border-color:#fbbf24; color:#fde047;">★ SUPER TREASURE HUNT</span>' : ''}
          ${isCarTH ? '<span class="case-pill" style="background:rgba(56,189,248,0.2); border-color:#7dd3fc; color:#bae6fd;">★ TREASURE HUNT</span>' : ''}
          ${isOwned ? '<span class="owned-pill">In Collection</span>' : ''}
        </div>
        <h2 ${carNameStyle}>${car.name}</h2>
        <p><strong>Series:</strong> ${car.series || 'Mainline'} ${car.series_number ? `(#${car.series_number})` : ''}</p>
        <p><strong>HW Number:</strong> #${car.hw_number || '—'}</p>
        <p><strong>Color:</strong> ${car.color || '—'}</p>

        <div class="hunt-showcase-grid">
          <div class="hunt-box silver-box">
            <div style="font-size:0.75rem; font-weight:700; color:#bae6fd; text-transform:uppercase;">Case ${hwCase.letter} Treasure Hunt</div>
            <div style="font-size:0.85rem; font-weight:600; margin-top:4px;">${hwCase.th?.name || 'None listed'}</div>
            ${hwCase.th?.image ? `<div class="hunt-box-img-wrap"><img src="${hwCase.th.image}" alt="TH" onerror="this.style.display='none'"></div>` : ''}
          </div>
          <div class="hunt-box gold-box">
            <div style="font-size:0.75rem; font-weight:700; color:#fde047; text-transform:uppercase;">Case ${hwCase.letter} Super TH</div>
            <div style="font-size:0.85rem; font-weight:600; margin-top:4px;">${hwCase.sth?.name || 'None listed'}</div>
            ${hwCase.sth?.image ? `<div class="hunt-box-img-wrap"><img src="${hwCase.sth.image}" alt="STH" onerror="this.style.display='none'"></div>` : ''}
          </div>
        </div>

        <div style="margin-top:14px; display:flex; flex-direction:column; gap:8px;">
          ${!isWanted ? `<button id="addWantedBtn" class="add-wanted-btn">★ Add to Wanted List</button>` : ''}
          <button id="showAllCaseBtn" class="action-btn">View All Cars in ${year} Case ${hwCase.letter} (${(hwCase.cars || []).length})</button>
          <button id="showAllSeriesBtn" class="action-btn secondary">View All Cars in "${car.series}" (${year})</button>
        </div>
      </div>
    </div>
    <div id="allCarsGrid" class="results-grid" style="margin-top:20px;"></div>
  `;

  const addBtn = document.getElementById('addWantedBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const currentWanted = JSON.parse(localStorage.getItem('wantedCars') || '[]');
      currentWanted.push({ year, caseLetter: hwCase.letter, car });
      localStorage.setItem('wantedCars', JSON.stringify(currentWanted));
      addBtn.style.display = 'none';
      if (typeof window.updateNavBadges === 'function') window.updateNavBadges();
      if (typeof window.performSearch === 'function') window.performSearch();
    });
  }

  const allCarsGrid = document.getElementById('allCarsGrid');

  document.getElementById('showAllCaseBtn').addEventListener('click', e => {
    e.stopPropagation();
    allCarsGrid.innerHTML = '';
    (hwCase.cars || []).forEach(c => window.renderCarCard(year, hwCase.letter, c, allCarsGrid));
  });

  document.getElementById('showAllSeriesBtn').addEventListener('click', e => {
    e.stopPropagation();
    allCarsGrid.innerHTML = '';
    const data = window.getCarData();
    const collected = (data[year]?.cases || []).flatMap(hwCaseItem =>
      (hwCaseItem.cars || [])
        .filter(c => c.series === car.series)
        .map(c => ({ year, caseLetter: hwCaseItem.letter, car: c }))
    );

    collected.sort((a, b) => {
      const numA = extractSeriesNumber(a.car.series_number);
      const numB = extractSeriesNumber(b.car.series_number);
      if (numA !== numB) return numA - numB;
      return (a.car.color || '').localeCompare(b.car.color || '');
    });

    collected.forEach(entry => window.renderCarCard(entry.year, entry.caseLetter, entry.car, allCarsGrid));
  });

  popup.style.display = 'block';
  document.body.classList.add('popup-open');
}

if (popupClose) {
  popupClose.addEventListener('click', () => {
    popup.style.display = 'none';
    document.body.classList.remove('popup-open');
  });
}

if (popup) {
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.style.display = 'none';
      document.body.classList.remove('popup-open');
    }
  });
}

window.showDetails = showDetails;
