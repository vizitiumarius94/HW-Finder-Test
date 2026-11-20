// utils.js — Shared Data Loader & Carbon Showroom Card Renderer

document.addEventListener('DOMContentLoaded', () => {
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  const PADDING = 10;

  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('change', () => {
      const dropdownContent = toggle.nextElementSibling;
      if (!dropdownContent) return;

      if (toggle.checked) {
        const container = toggle.closest('.custom-dropdown-container');
        const buttonRect = container.getBoundingClientRect();
        const contentWidth = dropdownContent.offsetWidth;
        const viewportWidth = window.innerWidth;

        if (buttonRect.right + contentWidth > viewportWidth - PADDING) {
          dropdownContent.classList.add('dropdown-align-right');
        } else {
          dropdownContent.classList.remove('dropdown-align-right');
        }
      } else {
        dropdownContent.classList.remove('dropdown-align-right');
      }
    });
  });
});

let globalCarsData = {};
const CUSTOM_DB_KEY = 'hwCustomDatabaseOverride';

function fetchCarData() {
  return fetch('data.json')
    .then(res => res.json())
    .then(baseData => {
      let finalData = baseData;
      try {
        const localOverride = localStorage.getItem(CUSTOM_DB_KEY);
        if (localOverride) {
          const parsed = JSON.parse(localOverride);
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            finalData = parsed;
          }
        }
      } catch (e) {
        console.warn('Could not read local custom DB override:', e);
      }
      globalCarsData = finalData;
      window.carsData = finalData;
      return finalData;
    })
    .catch(err => {
      console.error('Failed to fetch data.json:', err);
      return {};
    });
}

function getCarData() {
  return globalCarsData;
}
window.getCarData = getCarData;

function setOwnedCars(cars) {
  localStorage.setItem('ownedCars', JSON.stringify(cars));
  if (typeof window.updateNavBadges === 'function') window.updateNavBadges();
}
window.setOwnedCars = setOwnedCars;

function getWantedCars() {
  return JSON.parse(localStorage.getItem('wantedCars') || '[]');
}

function getOwnedCarsSimple() {
  return JSON.parse(localStorage.getItem('ownedCars') || '[]');
}

function applyHuntStyling(cardDiv, year, caseLetter, car) {
  const data = getCarData();
  const yearData = data[year];
  if (!yearData || !Array.isArray(yearData.cases)) return '';

  const caseData = yearData.cases.find(cs => cs.letter === caseLetter);
  if (!caseData) return '';

  let isTH = false;
  let isSTH = false;

  if (caseData.th && car.hw_number === caseData.th.hw_number && car.image === caseData.th.image) {
    isTH = true;
  }
  if (caseData.sth && car.hw_number === caseData.sth.hw_number && car.image === caseData.sth.image) {
    isSTH = true;
  }

  if (isSTH) {
    cardDiv.classList.add('is-sth');
  } else if (isTH) {
    cardDiv.classList.add('is-th');
  }

  return `
    ${isSTH ? '<div class="sth-label"><img src="images/STH.png" alt="STH" class="hunt-badge"><span>Super TH</span></div>' : ''}
    ${isTH ? '<div class="th-label"><img src="images/TH.png" alt="TH" class="hunt-badge"><span>Treasure Hunt</span></div>' : ''}
  `;
}

function renderCarCard(year, caseLetter, c, container) {
  const div = document.createElement('div');
  div.classList.add('result-card');
  const cardIdx = container ? container.children.length : 0;
  div.style.animationDelay = `${Math.min(cardIdx * 0.025, 0.35)}s`;

  const huntIconHtml = applyHuntStyling(div, year, caseLetter, c);

  function updateCardUI() {
    const ownedCars = getOwnedCarsSimple();
    const ownedCar = ownedCars.find(o => o.car.image === c.image && o.car.name === c.name);
    const isOwned = !!ownedCar;
    const isWanted = getWantedCars().some(w => w.car.image === c.image && w.car.name === c.name);
    const quantity = ownedCar ? (ownedCar.quantity || 1) : 0;

    div.innerHTML = `
      <div class="card-img-stage">
        <div class="card-badges-overlay">
          <span class="case-pill">${year} • Case ${caseLetter}</span>
          ${isOwned ? `<span class="owned-pill">Owned ×${quantity}</span>` : ''}
        </div>
        <div class="img-blend-frame">
          <img src="${c.image || 'images/images-coming-soon.png'}" alt="${c.name}" loading="lazy" onerror="this.src='images/images-coming-soon.png'">
        </div>
      </div>
      <div class="card-info">
        <div>
          <h3>${c.name}</h3>
          <div class="card-meta-tags">
            <span class="meta-tag">${c.series || 'Mainline'} ${c.series_number ? `(#${c.series_number})` : ''}</span>
            <span class="meta-tag">HW #${c.hw_number || '—'}</span>
            ${c.color ? `<span class="meta-tag">${c.color}</span>` : ''}
          </div>
          ${huntIconHtml}
        </div>

        <div class="card-actions">
          ${isOwned ? `
            <div class="quantity-line">
              <button class="decrease-btn" data-action="decrement" title="Decrease quantity">−</button>
              <span class="quantity-value" data-qty="${quantity}" title="Click to set exact quantity">${quantity}</span>
              <button class="increase-btn" data-action="increment" title="Increase quantity">+</button>
            </div>
          ` : ''}
          <button class="${isOwned ? 'unowned-btn' : 'owned-btn'}">
            ${isOwned ? '✓ In Collection (Remove)' : '+ Mark Owned'}
          </button>
          ${!isWanted ? '<button class="add-wanted-btn">★ Add to Wanted</button>' : ''}
        </div>
      </div>
    `;

    const updateQuantity = (change) => {
      let currentOwned = getOwnedCarsSimple();
      let carToUpdate = currentOwned.find(o => o.car.image === c.image && o.car.name === c.name);
      if (carToUpdate) {
        let newQty = (carToUpdate.quantity || 1) + change;
        if (newQty < 1) {
          currentOwned = currentOwned.filter(o => !(o.car.image === c.image && o.car.name === c.name));
        } else {
          carToUpdate.quantity = newQty;
        }
        window.setOwnedCars(currentOwned);
        if (typeof window.renderOwnedCars === 'function' && window.groupSelect) {
          window.renderOwnedCars(window.groupSelect.value);
        } else if (typeof window.performSearch === 'function') {
          window.performSearch();
        }
        updateCardUI();
      }
    };

    const ownedBtn = div.querySelector('.owned-btn, .unowned-btn');
    if (ownedBtn) {
      ownedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let currentOwned = getOwnedCarsSimple();
        const currentlyOwned = currentOwned.find(o => o.car.image === c.image && o.car.name === c.name);
        if (currentlyOwned) {
          currentOwned = currentOwned.filter(o => !(o.car.image === c.image && o.car.name === c.name));
        } else {
          currentOwned.push({ year, caseLetter, car: c, quantity: 1 });
        }
        window.setOwnedCars(currentOwned);
        if (typeof window.renderOwnedCars === 'function' && window.groupSelect) {
          window.renderOwnedCars(window.groupSelect.value);
        } else if (typeof window.performSearch === 'function') {
          window.performSearch();
        }
        updateCardUI();
      });
    }

    const incBtn = div.querySelector('.increase-btn');
    if (incBtn) {
      incBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateQuantity(1);
      });
    }

    const decBtn = div.querySelector('.decrease-btn');
    if (decBtn) {
      decBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateQuantity(-1);
      });
    }

    const addWantedBtn = div.querySelector('.add-wanted-btn');
    if (addWantedBtn) {
      addWantedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let currentWanted = getWantedCars();
        if (!currentWanted.some(w => w.car.image === c.image && w.car.name === c.name)) {
          currentWanted.push({ year, caseLetter, car: c });
          localStorage.setItem('wantedCars', JSON.stringify(currentWanted));
          if (typeof window.updateNavBadges === 'function') window.updateNavBadges();
        }
        updateCardUI();
      });
    }

    const qtySpan = div.querySelector('.quantity-value');
    if (qtySpan) {
      qtySpan.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentQty = parseInt(qtySpan.dataset.qty, 10);
        const newQtyStr = prompt(`Enter new quantity for ${c.name}:`, currentQty);
        if (newQtyStr === null) return;
        const newQty = parseInt(newQtyStr, 10);
        if (isNaN(newQty) || newQty < 1) {
          alert('Please enter a valid number (minimum 1).');
          return;
        }
        let owned = getOwnedCarsSimple();
        const idx = owned.findIndex(o => o.car.image === c.image && o.car.name === c.name);
        if (idx !== -1) {
          owned[idx].quantity = newQty;
          window.setOwnedCars(owned);
          if (typeof window.renderOwnedCars === 'function' && window.groupSelect) {
            window.renderOwnedCars(window.groupSelect.value);
          } else if (typeof window.performSearch === 'function') {
            window.performSearch();
          }
          updateCardUI();
        }
      });
    }
  }

  div.addEventListener('click', (e) => {
    if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button') || e.target.classList.contains('quantity-value')) return;
    const currentCarsData = getCarData();
    let parentCase = null;
    if (currentCarsData[year] && currentCarsData[year].cases) {
      parentCase = currentCarsData[year].cases.find(
        hCase => hCase.letter === caseLetter && hCase.cars.some(carInCase => carInCase.image === c.image && carInCase.name === c.name)
      );
    }
    if (parentCase && typeof window.showDetails === 'function') {
      window.showDetails(year, parentCase, c);
    }
  });

  updateCardUI();
  container.appendChild(div);
}

window.renderCarCard = renderCarCard;
