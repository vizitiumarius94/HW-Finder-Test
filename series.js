// series.js — Animated Collector Series Shelf with Mini Car Thumbnails & Progress

let ownedCars = JSON.parse(localStorage.getItem('ownedCars') || '[]');
let wantedCars = JSON.parse(localStorage.getItem('wantedCars') || '[]');

const yearSelect = document.getElementById('yearSelect');
const seriesSearchBar = document.getElementById('seriesSearchBar');
const seriesList = document.getElementById('seriesList');

const seriesPopup = document.getElementById('seriesPopup');
const seriesPopupClose = document.getElementById('seriesPopupClose');
const seriesPopupTitle = document.getElementById('seriesPopupTitle');
const seriesCarsGrid = document.getElementById('seriesCarsGrid');

let currentStatusFilter = 'all'; // 'all' | 'in_progress' | 'completed'

fetchCarData().then(() => {
  injectSeriesFilterControls();
  populateYearSelect();
});

function injectSeriesFilterControls() {
  const controlsRow = document.querySelector('.search-controls-row');
  if (!controlsRow || document.getElementById('seriesFilterTabs')) return;

  const tabsWrap = document.createElement('div');
  tabsWrap.id = 'seriesFilterTabs';
  tabsWrap.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; width:100%; margin-top:4px;';
  tabsWrap.innerHTML = `
    <button type="button" class="checkbox-pill series-tab active" data-status="all" style="border-color:var(--hw-orange); color:var(--hw-orange);">All Series</button>
    <button type="button" class="checkbox-pill series-tab" data-status="in_progress">🔥 In Progress</button>
    <button type="button" class="checkbox-pill series-tab" data-status="completed">🏆 Completed</button>
  `;
  controlsRow.appendChild(tabsWrap);

  tabsWrap.querySelectorAll('.series-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStatusFilter = btn.dataset.status;
      tabsWrap.querySelectorAll('.series-tab').forEach(b => {
        b.style.borderColor = '';
        b.style.color = '';
      });
      btn.style.borderColor = 'var(--hw-orange)';
      btn.style.color = 'var(--hw-orange)';
      renderSeriesGrid();
    });
  });
}

function populateYearSelect() {
  const carsData = getCarData();
  const years = Object.keys(carsData).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });

  yearSelect.value = 'all';
  renderSeriesGrid();
}

function renderSeriesGrid() {
  const selectedYear = yearSelect.value;
  const query = (seriesSearchBar?.value || '').trim().toLowerCase();
  seriesList.innerHTML = '';
  if (!selectedYear) return;

  ownedCars = JSON.parse(localStorage.getItem('ownedCars') || '[]');
  const ownedSet = new Set(ownedCars.map(o => o.car?.image));

  const carsData = getCarData();
  const seriesStats = new Map();

  const yearsToScan = selectedYear === 'all' ? Object.keys(carsData) : [selectedYear];

  yearsToScan.forEach(year => {
    const yearObj = carsData[year];
    if (!yearObj || !Array.isArray(yearObj.cases)) return;
    yearObj.cases.forEach(hwCase => {
      (hwCase.cars || []).forEach(car => {
        const sName = car.series || 'Uncategorized';
        if (query && !sName.toLowerCase().includes(query)) return;

        if (!seriesStats.has(sName)) {
          seriesStats.set(sName, { seenImages: new Set(), ownedCount: 0, sampleThumbs: [] });
        }
        const entry = seriesStats.get(sName);
        const uniqueKey = `${year}-${car.image}-${car.name}`;
        if (!entry.seenImages.has(uniqueKey)) {
          entry.seenImages.add(uniqueKey);
          if (ownedSet.has(car.image)) entry.ownedCount++;
          if (entry.sampleThumbs.length < 3 && car.image) {
            entry.sampleThumbs.push(car.image);
          }
        }
      });
    });
  });

  let sortedSeries = Array.from(seriesStats.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  if (currentStatusFilter === 'completed') {
    sortedSeries = sortedSeries.filter(([, s]) => s.seenImages.size > 0 && s.ownedCount >= s.seenImages.size);
  } else if (currentStatusFilter === 'in_progress') {
    sortedSeries = sortedSeries.filter(([, s]) => s.ownedCount > 0 && s.ownedCount < s.seenImages.size);
  }

  if (sortedSeries.length === 0) {
    seriesList.innerHTML = '<div class="no-results">No series found matching this filter.</div>';
    return;
  }

  sortedSeries.forEach(([seriesName, stats], idx) => {
    const total = stats.seenImages.size;
    const owned = stats.ownedCount;
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
    const isComplete = total > 0 && owned >= total;

    const card = document.createElement('div');
    card.classList.add('series-card');
    if (isComplete) card.classList.add('completed');
    card.style.animationDelay = `${Math.min(idx * 0.03, 0.45)}s`;

    const thumbsHtml = stats.sampleThumbs.map(src => `
      <div class="series-mini-thumb">
        <img src="${src}" alt="" loading="lazy" onerror="this.src='images/images-coming-soon.png'">
      </div>
    `).join('');

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <h3 style="margin:0; font-size:0.98rem; color:var(--text-primary); line-height:1.25;">${seriesName}</h3>
        ${isComplete
          ? `<span class="series-trophy-badge"><span class="trophy-icon">🏆</span> 100%</span>`
          : `<span style="font-size:0.76rem; font-weight:800; color:var(--hw-orange); white-space:nowrap;">${owned}/${total} (${pct}%)</span>`
        }
      </div>

      ${thumbsHtml ? `<div class="series-preview-strip">${thumbsHtml}</div>` : ''}

      <div>
        <div class="progress-track">
          <div class="progress-fill" style="width: 0%;" data-target-width="${pct}%"></div>
        </div>
      </div>
    `;

    // Trigger smooth progress bar fill animation on next frame
    requestAnimationFrame(() => {
      const fill = card.querySelector('.progress-fill');
      if (fill) fill.style.width = `${pct}%`;
    });

    card.addEventListener('click', () => showSeriesPopup(selectedYear, seriesName));
    seriesList.appendChild(card);
  });
}

yearSelect.addEventListener('change', renderSeriesGrid);
if (seriesSearchBar) seriesSearchBar.addEventListener('input', renderSeriesGrid);

function showSeriesPopup(selectedYear, seriesName) {
  seriesPopupTitle.textContent = `${seriesName} (${selectedYear === 'all' ? 'All Years' : selectedYear})`;
  seriesCarsGrid.innerHTML = '';

  const carsData = getCarData();
  const yearsToCheck = selectedYear === 'all' ? Object.keys(carsData) : [selectedYear];

  const collected = [];
  yearsToCheck.forEach(year => {
    const yearObj = carsData[year];
    if (!yearObj || !Array.isArray(yearObj.cases)) return;
    yearObj.cases.forEach(hwCase => {
      if (!Array.isArray(hwCase.cars)) return;
      hwCase.cars.forEach(car => {
        if ((car.series || 'Uncategorized') === seriesName) {
          collected.push({ year, caseLetter: hwCase.letter, hwCase, car });
        }
      });
    });
  });

  const extractSeriesNumber = (val) => {
    if (val == null) return 0;
    const m = String(val).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };

  collected.sort((a, b) => {
    const numA = extractSeriesNumber(a.car.series_number);
    const numB = extractSeriesNumber(b.car.series_number);
    if (numA !== numB) return numA - numB;
    return String(a.car.name || '').localeCompare(String(b.car.name || ''));
  });

  collected.forEach(entry => {
    window.renderCarCard(entry.year, entry.caseLetter, entry.car, seriesCarsGrid);
  });

  seriesPopup.style.display = 'block';
  document.body.classList.add('popup-open');
}

seriesPopupClose.addEventListener('click', () => {
  seriesPopup.style.display = 'none';
  document.body.classList.remove('popup-open');
  renderSeriesGrid();
});

if (seriesPopup) {
  seriesPopup.addEventListener('click', (e) => {
    if (e.target === seriesPopup) {
      seriesPopup.style.display = 'none';
      document.body.classList.remove('popup-open');
      renderSeriesGrid();
    }
  });
}
