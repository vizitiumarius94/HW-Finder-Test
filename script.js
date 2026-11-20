// script.js — Main Search, Cascading Filters & Stats Dashboard

let carsData = {};
window.carsData = carsData;

let filteredCarsCache = [];

const searchBar = document.getElementById('searchBar');
const clearBtn = document.getElementById('clearSearch');
const resultsDiv = document.getElementById('results');
const searchOldCases = document.getElementById('searchOldCases');
const resetAllFiltersBtn = document.getElementById('resetAllFiltersBtn');
const resultsCountLabel = document.getElementById('resultsCountLabel');

const filterState = {
  year: [],
  caseLetter: [],
  series: [],
  hw_number: [],
  color: [],
  unownedOnly: false,
  th: false,
  sth: false,
  showDuds: false,
};

const filterContainers = {
  year: document.getElementById('yearFilterContainer'),
  caseLetter: document.getElementById('caseLetterFilterContainer'),
  series: document.getElementById('seriesFilterContainer'),
  hw_number: document.getElementById('hwNumberFilterContainer'),
  color: document.getElementById('colorFilterContainer'),
};

const filterChipBar = document.getElementById('activeFiltersBar');
const unownedOnlyCheckbox = document.getElementById('unownedOnlyCheckbox');
const thCheckbox = document.getElementById('thCheckbox');
const sthCheckbox = document.getElementById('sthCheckbox');
const dudsCheckboxWrapper = document.getElementById('dudsCheckboxWrapper');
const showDudsCheckbox = document.getElementById('showDudsCheckbox');

// ------------------- SERVICE WORKER -------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').then(reg => {
    function showUpdate(worker) {
      const banner = document.createElement('div');
      banner.innerHTML = `
        <div style="position:fixed; bottom:16px; left:50%; transform:translateX(-50%); background:#ff5500; color:white; padding:12px 20px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.45); font-weight:600; z-index:9999; display:flex; align-items:center; gap:12px;">
          <span>🔄 New garage update ready</span>
          <button style="padding:6px 12px; border:none; background:white; color:#ff5500; border-radius:6px; cursor:pointer; font-weight:700;">Reload</button>
        </div>
      `;
      banner.querySelector('button').addEventListener('click', () => {
        worker.postMessage({ action: 'skipWaiting' });
      });
      document.body.appendChild(banner);
    }
    if (reg.waiting) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdate(newWorker);
        }
      });
    });
  }).catch(err => console.error('SW registration failed:', err));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

function manualHardRefresh() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const messageChannel = new MessageChannel();
    const port = messageChannel.port1;
    port.addEventListener('message', function handler(event) {
      if (event.data.action === 'cacheHardRefreshed') {
        notification.innerHTML = '✅ Cache Refreshed! Reloading...';
        port.removeEventListener('message', handler);
        setTimeout(() => {
          document.getElementById('refreshNotification')?.remove();
          window.location.reload();
        }, 800);
      }
    });
    port.start();

    const notification = document.createElement('div');
    notification.id = 'refreshNotification';
    notification.innerHTML = '🔄 Refreshing offline cache...';
    notification.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#e11d48; color:white; padding:10px 20px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10000; font-weight:700;';
    document.body.appendChild(notification);

    navigator.serviceWorker.controller.postMessage({ action: 'manualHardRefreshAll' }, [messageChannel.port2]);
  } else {
    window.location.reload();
  }
}

// ------------------- DASHBOARD STATS -------------------
function updateDashboardStats() {
  const ownedCars = JSON.parse(localStorage.getItem('ownedCars') || '[]');
  const wantedCars = JSON.parse(localStorage.getItem('wantedCars') || '[]');

  let totalDbCars = 0;
  const huntKeys = new Set();

  Object.keys(carsData).forEach(y => {
    (carsData[y].cases || []).forEach(c => {
      totalDbCars += (c.cars || []).length;
      if (c.th?.image) huntKeys.add(c.th.image);
      if (c.sth?.image) huntKeys.add(c.sth.image);
    });
  });

  const totalOwnedCount = ownedCars.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const ownedHuntsCount = ownedCars.filter(item => item.car && huntKeys.has(item.car.image)).length;

  const statTotalDb = document.getElementById('statTotalDb');
  const statOwned = document.getElementById('statOwned');
  const statWanted = document.getElementById('statWanted');
  const statHunts = document.getElementById('statHunts');

  if (statTotalDb) statTotalDb.textContent = totalDbCars.toLocaleString();
  if (statOwned) statOwned.textContent = totalOwnedCount.toLocaleString();
  if (statWanted) statWanted.textContent = wantedCars.length.toLocaleString();
  if (statHunts) statHunts.textContent = ownedHuntsCount.toLocaleString();
}

// ------------------- FILTER RENDERING -------------------
function renderFilterOptions(field, optionsSet) {
  const container = filterContainers[field];
  if (!container) return;

  const contentDiv = container.querySelector('.dropdown-content');
  if (!contentDiv) return;

  let ul = contentDiv.querySelector('.filter-options');
  if (!ul) {
    ul = document.createElement('ul');
    ul.classList.add('filter-options');
    contentDiv.appendChild(ul);
  }
  ul.innerHTML = '';

  const sortedOptions = Array.from(optionsSet).filter(Boolean).sort((a, b) => {
    if (field === 'hw_number') {
      const numA = parseInt(String(a).match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(String(b).match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    }
    if (field === 'year') {
      return parseInt(b, 10) - parseInt(a, 10);
    }
    return String(a).localeCompare(String(b));
  });

  sortedOptions.forEach(optionValue => {
    const li = document.createElement('li');
    li.textContent = optionValue;
    li.dataset.value = optionValue;
    li.dataset.field = field;

    if (filterState[field].includes(optionValue)) {
      li.classList.add('selected');
    }

    li.addEventListener('click', handleFilterChange);
    ul.appendChild(li);
  });
}

function renderActiveChips() {
  if (!filterChipBar) return;
  filterChipBar.innerHTML = '';

  ['year', 'caseLetter', 'series', 'hw_number', 'color'].forEach(field => {
    filterState[field].forEach(value => {
      addFilterChip(field, value);
    });
  });

  if (filterState.unownedOnly) addFilterChip('checkbox', 'Unowned Only', 'unownedOnly');
  if (filterState.th) addFilterChip('checkbox', 'Treasure Hunts', 'th');
  if (filterState.sth) addFilterChip('checkbox', 'Super TH', 'sth');
  if (filterState.showDuds) addFilterChip('checkbox', 'Show Regular Duds', 'showDuds');
}

function addFilterChip(field, value, stateKey = null) {
  const chip = document.createElement('span');
  chip.classList.add('filter-chip');
  chip.textContent = value;

  const closeBtn = document.createElement('span');
  closeBtn.textContent = ' ×';
  closeBtn.classList.add('chip-close');

  chip.dataset.field = field;
  chip.dataset.value = value;
  chip.dataset.stateKey = stateKey || field;

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFilterChip(chip);
  });

  chip.appendChild(closeBtn);
  filterChipBar.appendChild(chip);
}

function removeFilterChip(chipElement) {
  const field = chipElement.dataset.field;
  const value = chipElement.dataset.value;
  const stateKey = chipElement.dataset.stateKey;

  if (field === 'checkbox') {
    filterState[stateKey] = false;
    const checkbox = document.getElementById(stateKey + 'Checkbox');
    if (checkbox) checkbox.checked = false;

    if (stateKey === 'sth') {
      dudsCheckboxWrapper.style.display = 'none';
      filterState.showDuds = false;
      if (showDudsCheckbox) showDudsCheckbox.checked = false;
      document.querySelector('[data-state-key="showDuds"]')?.remove();
    }
  } else {
    filterState[field] = filterState[field].filter(v => v !== value);
  }

  chipElement.remove();
  performSearch();
}

function getAllCarsForInitialLoad() {
  const allCars = [];
  Object.keys(carsData).forEach(yearKey => {
    (carsData[yearKey].cases || []).forEach(hwCase => {
      (hwCase.cars || []).forEach(car => {
        allCars.push({ year: yearKey, hwCase, car, caseLetter: hwCase.letter });
      });
    });
  });
  return allCars;
}

function getAvailableOptionsForFiltering(targetField) {
  const options = new Set();
  const allCars = getAllCarsForInitialLoad();

  if (targetField === 'year' || targetField === 'caseLetter') {
    allCars.forEach(item => {
      if (!searchOldCases.checked && parseInt(item.year, 10) < 2024) return;
      const value = targetField === 'year' ? item.year : item.caseLetter;
      if (value) options.add(value);
    });
    return options;
  }

  const query = searchBar.value.trim().toLowerCase();
  const ownedCars = JSON.parse(localStorage.getItem('ownedCars') || '[]');
  const activeFilters = {};
  for (const key in filterState) {
    if (Array.isArray(filterState[key]) && filterState[key].length > 0) {
      activeFilters[key] = filterState[key].map(v => String(v).toLowerCase());
    }
  }

  allCars.forEach(item => {
    const yearKey = item.year;
    const car = item.car;
    const hwCase = item.hwCase;

    if (!searchOldCases.checked && parseInt(yearKey, 10) < 2024) return;
    if (query.length > 0 && !car.name.toLowerCase().includes(query) && !String(car.hw_number).toLowerCase().includes(query) && !(car.series || '').toLowerCase().includes(query)) {
      return;
    }

    const checkFilter = (field, itemValue) => {
      if (activeFilters[field] && activeFilters[field].length > 0 && field !== targetField && !activeFilters[field].includes(String(itemValue || '').toLowerCase())) {
        return false;
      }
      return true;
    };

    if (!checkFilter('year', yearKey)) return;
    if (!checkFilter('caseLetter', hwCase.letter)) return;
    if (!checkFilter('series', car.series)) return;
    if (!checkFilter('hw_number', car.hw_number)) return;
    if (!checkFilter('color', car.color)) return;

    if (filterState.unownedOnly && ownedCars.some(o => o.car.image === car.image)) return;

    const value = targetField === 'series' ? car.series : targetField === 'hw_number' ? car.hw_number : car.color;
    if (value) options.add(value);
  });

  return options;
}

function updateFilterOptionsUI() {
  renderFilterOptions('year', getAvailableOptionsForFiltering('year'));
  renderFilterOptions('caseLetter', getAvailableOptionsForFiltering('caseLetter'));
  renderFilterOptions('series', getAvailableOptionsForFiltering('series'));
  renderFilterOptions('hw_number', getAvailableOptionsForFiltering('hw_number'));
  renderFilterOptions('color', getAvailableOptionsForFiltering('color'));
}

// ------------------- INITIALIZE ONCE USING UTILS.JS -------------------
fetchCarData().then(data => {
  carsData = data;
  window.carsData = data;
  updateDashboardStats();
  updateFilterOptionsUI();
  performSearch();
});

function handleFilterChange(e) {
  const target = e.target;

  if (target.tagName.toLowerCase() === 'li') {
    e.stopPropagation();
    const field = target.dataset.field;
    const value = target.dataset.value;

    if (filterState[field].includes(value)) {
      filterState[field] = filterState[field].filter(v => v !== value);
    } else {
      filterState[field].push(value);
    }
  } else {
    if (target.id === 'unownedOnlyCheckbox') filterState.unownedOnly = target.checked;
    if (target.id === 'thCheckbox') filterState.th = target.checked;
    if (target.id === 'sthCheckbox') {
      filterState.sth = target.checked;
      if (target.checked) {
        dudsCheckboxWrapper.style.display = 'inline-block';
      } else {
        dudsCheckboxWrapper.style.display = 'none';
        filterState.showDuds = false;
        if (showDudsCheckbox) showDudsCheckbox.checked = false;
      }
    }
    if (target.id === 'showDudsCheckbox') {
      filterState.showDuds = target.checked;
    }
  }

  renderActiveChips();
  performSearch();
}

if (unownedOnlyCheckbox) unownedOnlyCheckbox.addEventListener('click', handleFilterChange);
if (thCheckbox) thCheckbox.addEventListener('click', handleFilterChange);
if (sthCheckbox) sthCheckbox.addEventListener('click', handleFilterChange);
if (showDudsCheckbox) showDudsCheckbox.addEventListener('click', handleFilterChange);

if (resetAllFiltersBtn) {
  resetAllFiltersBtn.addEventListener('click', () => {
    searchBar.value = '';
    clearBtn.style.display = 'none';
    filterState.year = [];
    filterState.caseLetter = [];
    filterState.series = [];
    filterState.hw_number = [];
    filterState.color = [];
    filterState.unownedOnly = false;
    filterState.th = false;
    filterState.sth = false;
    filterState.showDuds = false;
    if (unownedOnlyCheckbox) unownedOnlyCheckbox.checked = false;
    if (thCheckbox) thCheckbox.checked = false;
    if (sthCheckbox) sthCheckbox.checked = false;
    if (showDudsCheckbox) showDudsCheckbox.checked = false;
    if (dudsCheckboxWrapper) dudsCheckboxWrapper.style.display = 'none';
    renderActiveChips();
    performSearch();
  });
}

document.addEventListener('click', (event) => {
  const isClickInsideFilterContainer = event.target.closest('.custom-dropdown-container');
  const isClickOnChip = event.target.closest('.filter-chip');

  document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
    const container = toggle.closest('.custom-dropdown-container');
    if (toggle.checked && !container.contains(event.target) && !isClickOnChip) {
      toggle.checked = false;
    } else if (isClickInsideFilterContainer && container !== isClickInsideFilterContainer) {
      toggle.checked = false;
    }
  });
});

// ------------------- PERFORM SEARCH -------------------
function performSearch() {
  const query = searchBar.value.trim().toLowerCase();
  resultsDiv.innerHTML = '';
  updateDashboardStats();

  if (query === 'c-refresh') {
    searchBar.value = '';
    manualHardRefresh();
    return;
  }

  const ownedCars = JSON.parse(localStorage.getItem('ownedCars') || '[]');
  const activeFilters = {};
  for (const key in filterState) {
    if (Array.isArray(filterState[key]) && filterState[key].length > 0) {
      activeFilters[key] = filterState[key].map(v => String(v).toLowerCase());
    }
  }

  const isSearchActive = query.length > 0;
  const isFilterActive =
    Object.keys(activeFilters).some(key => activeFilters[key].length > 0) ||
    filterState.unownedOnly ||
    filterState.th ||
    filterState.sth ||
    filterState.showDuds;

  if (resetAllFiltersBtn) {
    resetAllFiltersBtn.style.display = (isSearchActive || isFilterActive) ? 'inline-flex' : 'none';
  }

  if (!isSearchActive && !isFilterActive) {
    filteredCarsCache = [];
    updateFilterOptionsUI();
    if (resultsCountLabel) resultsCountLabel.textContent = 'Ready to search';
    resultsDiv.innerHTML = `
      <div class="no-results">
        <p style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin:0 0 6px;">Start exploring your Hot Wheels database</p>
        <p style="margin:0;">Type a car name, HW number, or color above — or pick a Year, Case, or Treasure Hunt filter.</p>
      </div>`;
    return;
  }

  filteredCarsCache = [];
  const yearsSorted = Object.keys(carsData).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  yearsSorted.forEach(yearKey => {
    if (activeFilters.year && !activeFilters.year.includes(yearKey)) return;
    if (!searchOldCases.checked && parseInt(yearKey, 10) < 2024) return;

    (carsData[yearKey].cases || []).forEach(hwCase => {
      if (activeFilters.caseLetter && !activeFilters.caseLetter.includes(hwCase.letter.toLowerCase())) return;

      (hwCase.cars || []).forEach(car => {
        if (isSearchActive) {
          let searchMatches = false;
          if (car.name.toLowerCase().includes(query)) searchMatches = true;
          if (String(car.hw_number || '').toLowerCase().includes(query)) searchMatches = true;
          if ((car.color || '').toLowerCase().includes(query)) searchMatches = true;
          if ((car.series || '').toLowerCase().includes(query)) searchMatches = true;
          if (query.startsWith('s-') && (car.series || '').toLowerCase().includes(query.slice(2).trim())) searchMatches = true;
          if (query === 'sth' && hwCase.sth && car.hw_number === hwCase.sth.hw_number && car.image === hwCase.sth.image) searchMatches = true;
          if (query === 'th' && hwCase.th && car.hw_number === hwCase.th.hw_number && car.image === hwCase.th.image) searchMatches = true;
          if (query.startsWith('c-') && hwCase.letter.toLowerCase() === query.slice(2).trim()) searchMatches = true;
          if (!searchMatches) return;
        }

        if (activeFilters.series && !activeFilters.series.includes((car.series || '').toLowerCase())) return;
        if (activeFilters.hw_number && !activeFilters.hw_number.includes(String(car.hw_number || '').toLowerCase())) return;
        if (activeFilters.color && !activeFilters.color.includes((car.color || '').trim().toLowerCase())) return;

        if (filterState.unownedOnly && ownedCars.some(o => o.car.image === car.image)) return;

        if (filterState.th || filterState.sth || filterState.showDuds) {
          const isTH = filterState.th && hwCase.th && car.hw_number === hwCase.th.hw_number && car.image === hwCase.th.image;
          const isSTH = filterState.sth && hwCase.sth && car.hw_number === hwCase.sth.hw_number && car.image === hwCase.sth.image;
          const isDud = filterState.showDuds && hwCase.sth && car.hw_number === hwCase.sth.hw_number && car.image !== hwCase.sth.image;
          if (!isTH && !isSTH && !isDud) return;
        }

        filteredCarsCache.push({ year: yearKey, hwCase, car, caseLetter: hwCase.letter });
        window.renderCarCard(yearKey, hwCase.letter, car, resultsDiv);
      });
    });
  });

  updateFilterOptionsUI();
  if (resultsCountLabel) {
    resultsCountLabel.textContent = `${filteredCarsCache.length} car${filteredCarsCache.length === 1 ? '' : 's'} found`;
  }

  if (filteredCarsCache.length === 0) {
    resultsDiv.innerHTML = '<div class="no-results">No cars found matching all criteria. Try broadening your filters or enabling Pre-2024 Cases.</div>';
  }
}

window.performSearch = performSearch;

searchBar.addEventListener('input', () => {
  performSearch();
  clearBtn.style.display = searchBar.value ? 'block' : 'none';
});

searchOldCases.addEventListener('click', performSearch);

clearBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  searchBar.value = '';
  clearBtn.style.display = 'none';
  performSearch();
  searchBar.focus();
});
