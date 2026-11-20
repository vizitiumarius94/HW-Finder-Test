// wanted.js — Wanted List with Instant "Found / Mark Owned" Action

const wantedListDiv = document.getElementById('wantedList');
const searchBar = document.getElementById('searchBar');
const clearBtn = document.getElementById('clearSearch');

function getWantedCars() {
  return JSON.parse(localStorage.getItem('wantedCars') || '[]');
}
function setWantedCars(cars) {
  localStorage.setItem('wantedCars', JSON.stringify(cars));
  if (typeof window.updateNavBadges === 'function') window.updateNavBadges();
}

fetchCarData().then(() => {
  loadWantedCars('');

  if (searchBar) {
    searchBar.addEventListener('input', () => {
      loadWantedCars(searchBar.value);
      if (clearBtn) clearBtn.style.display = searchBar.value ? 'block' : 'none';
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchBar.value = '';
      clearBtn.style.display = 'none';
      loadWantedCars('');
    });
  }
});

function loadWantedCars(searchTerm = '') {
  const wanted = getWantedCars();
  wantedListDiv.innerHTML = '';

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const filteredCars = normalizedSearch.length > 0
    ? wanted.filter(item => {
        const car = item.car;
        if (!item || !car) return false;
        return (
          car.name?.toLowerCase().includes(normalizedSearch) ||
          car.series?.toLowerCase().includes(normalizedSearch) ||
          String(car.hw_number).includes(normalizedSearch) ||
          car.color?.toLowerCase().includes(normalizedSearch)
        );
      })
    : wanted;

  if (!filteredCars.length) {
    wantedListDiv.innerHTML = `<div class="no-results">No wanted cars found${normalizedSearch ? ` matching "${searchTerm}"` : '. Click "★ Add to Wanted" on any car in Search!'}.</div>`;
    return;
  }

  window.loadWantedCars = loadWantedCars;

  filteredCars.forEach(item => {
    const card = document.createElement('div');
    card.classList.add('result-card');
    const huntIconHtml = applyHuntStyling(card, item.year, item.caseLetter, item.car);

    card.innerHTML = `
      <div class="card-img-stage">
        <div class="card-badges-overlay">
          <span class="case-pill">${item.year} • Case ${item.caseLetter}</span>
        </div>
        <div class="img-blend-frame">
          <img src="${item.car.image || 'images/images-coming-soon.png'}" alt="${item.car.name}" loading="lazy" onerror="this.src='images/images-coming-soon.png'">
        </div>
      </div>
      <div class="card-info">
        <div>
          <h3>${item.car.name}</h3>
          <div class="card-meta-tags">
            <span class="meta-tag">${item.car.series} (#${item.car.series_number})</span>
            <span class="meta-tag">HW #${item.car.hw_number}</span>
            <span class="meta-tag">${item.car.color}</span>
          </div>
          ${huntIconHtml}
        </div>
        <div class="card-actions">
          <button class="owned-btn">✓ Found! Move to Owned</button>
          <button class="remove-from-list-btn">Remove from Wanted</button>
        </div>
      </div>
    `;

    card.querySelector('.owned-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const owned = JSON.parse(localStorage.getItem('ownedCars') || '[]');
      const existing = owned.find(o => o.car.image === item.car.image && o.car.name === item.car.name);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        owned.push({ year: item.year, caseLetter: item.caseLetter, car: item.car, quantity: 1 });
      }
      window.setOwnedCars(owned);
      const updatedWanted = getWantedCars().filter(w => !(w.car.image === item.car.image && w.car.name === item.car.name));
      setWantedCars(updatedWanted);
      loadWantedCars(searchBar ? searchBar.value : '');
    });

    card.querySelector('.remove-from-list-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const updated = getWantedCars().filter(w => !(w.car.image === item.car.image && w.car.name === item.car.name));
      setWantedCars(updated);
      loadWantedCars(searchBar ? searchBar.value : '');
    });

    card.addEventListener('click', e => {
      if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
      const carsData = window.getCarData();
      const parentCase = carsData[item.year]?.cases?.find(
        hCase => hCase.letter === item.caseLetter && hCase.cars.some(c => c.image === item.car.image)
      );
      if (parentCase && typeof window.showDetails === 'function') {
        window.showDetails(item.year, parentCase, item.car);
      }
    });

    wantedListDiv.appendChild(card);
  });
}
