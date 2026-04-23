// pages/products.js

let allProducts = [];
let activeSaleDiscount = 0;

async function initProducts() {
  const params = new URLSearchParams(location.search);
  const urlGender = params.get('gender') || '';
  const urlBrand  = params.get('brand')  || '';
  const urlSale   = params.get('sale');

  // Set initial filter UI
  if (urlGender) {
    const radio = document.querySelector(`input[name="gender"][value="${urlGender}"]`);
    if (radio) radio.checked = true;
    document.getElementById('page-heading').textContent =
      urlGender.charAt(0).toUpperCase() + urlGender.slice(1) + ' Shoes';
    document.getElementById('breadcrumb-label').textContent =
      urlGender.charAt(0).toUpperCase() + urlGender.slice(1);
  }

  // Load sale + brands in parallel
  const [saleRes, brandsRes] = await Promise.allSettled([
    getActiveSale(),
    getBrands(),
  ]);

  if (saleRes.status === 'fulfilled' && saleRes.value) {
    const sale = saleRes.value;
    activeSaleDiscount = parseFloat(sale.discount_pct);
    document.getElementById('sale-banner').classList.add('active');
    document.getElementById('sale-pct-banner').textContent = `${Math.round(activeSaleDiscount)}% OFF`;
    startCountdown(sale.end_time, 'banner-countdown');
  }

  // Render brand checkboxes
  if (brandsRes.status === 'fulfilled') {
    const brandContainer = document.getElementById('brand-filters');
    brandContainer.innerHTML = brandsRes.value.map(b => `
      <label class="filter-option">
        <input type="checkbox" name="brand" value="${b}" ${b === urlBrand ? 'checked' : ''}> ${b}
      </label>`).join('');
  }

  await loadProducts({ gender: urlGender, brand: urlBrand });

  // Event listeners
  document.getElementById('apply-filters').addEventListener('click', applyFilters);
  document.getElementById('clear-filters').addEventListener('click', clearFilters);
  document.getElementById('sort-select').addEventListener('change', renderGrid);

  // Enter key on price inputs
  ['min-price','max-price'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') applyFilters();
    });
  });
}

async function loadProducts(filters = {}) {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = '<div class="page-loader" style="grid-column:1/-1"><div class="spinner"></div></div>';

  try {
    allProducts = await getProducts(filters);
    renderGrid();
  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">⚠️</div>
        <h3>Could not load products</h3>
        <p>${err.message}</p>
      </div>`;
  }
}

function renderGrid() {
  const grid    = document.getElementById('product-grid');
  const sort    = document.getElementById('sort-select').value;
  let   products = [...allProducts];

  if (sort === 'price_asc')  products.sort((a,b) => a.base_price - b.base_price);
  if (sort === 'price_desc') products.sort((a,b) => b.base_price - a.base_price);
  if (sort === 'name')       products.sort((a,b) => a.name.localeCompare(b.name));
  if (sort === 'featured')   products.sort((a,b) => b.is_featured - a.is_featured);

  document.getElementById('product-count').textContent =
    `${products.length} product${products.length !== 1 ? 's' : ''}`;

  if (!products.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">👟</div>
        <h3>No shoes found</h3>
        <p>Try adjusting your filters.</p>
        <button class="btn btn-outline" onclick="clearFilters()">Clear Filters</button>
      </div>`;
    return;
  }

  grid.innerHTML = products.map(p => renderProductCard(p, activeSaleDiscount)).join('');
}

function applyFilters() {
  const gender   = document.querySelector('input[name="gender"]:checked')?.value || '';
  const brands   = [...document.querySelectorAll('input[name="brand"]:checked')].map(i => i.value);
  const size     = document.querySelector('input[name="size"]:checked')?.value || '';
  const minPrice = document.getElementById('min-price').value;
  const maxPrice = document.getElementById('max-price').value;

  const filters = {};
  if (gender)            filters.gender    = gender;
  if (brands.length === 1) filters.brand   = brands[0];
  if (size)              filters.size      = size;
  if (minPrice)          filters.min_price = minPrice;
  if (maxPrice)          filters.max_price = maxPrice;

  loadProducts(filters);
}

function clearFilters() {
  document.querySelectorAll('input[name="gender"]')[0].checked = true;
  document.querySelectorAll('input[name="brand"]').forEach(i => i.checked = false);
  document.querySelectorAll('input[name="size"]')[0].checked = true;
  document.getElementById('min-price').value = '';
  document.getElementById('max-price').value = '';
  loadProducts({});
}

window.clearFilters = clearFilters;

initProducts();
