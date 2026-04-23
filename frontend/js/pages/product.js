// pages/product.js

let product     = null;
let activeSale  = null;
let selectedColor = null;
let selectedSize  = null;

async function initProduct() {
  const params    = new URLSearchParams(location.search);
  const productId = params.get('id');

  if (!productId) {
    location.href = 'products.html';
    return;
  }

  const [productRes, saleRes] = await Promise.allSettled([
    getProduct(productId),
    getActiveSale(),
  ]);

  if (productRes.status === 'rejected' || !productRes.value) {
    document.getElementById('loader').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>Product not found</h3>
        <a href="products.html" class="btn btn-outline mt-16">Back to Shop</a>
      </div>`;
    return;
  }

  product    = productRes.value;
  activeSale = saleRes.status === 'fulfilled' ? saleRes.value : null;

  renderProduct();
  setupSaleBanner();

  document.getElementById('loader').style.display = 'none';
  document.getElementById('product-content').classList.remove('hidden');
}

function renderProduct() {
  document.title = `${product.name} — SOLE.`;

  // Breadcrumb
  document.getElementById('bc-brand').textContent = product.brand;

  // Header info
  document.getElementById('detail-brand').textContent = product.brand;
  document.getElementById('detail-name').textContent  = product.name;
  document.getElementById('detail-description').textContent = product.description || '';

  // SKU (first variant)
  const firstVariant = product.variants[0];
  document.getElementById('detail-sku').textContent = firstVariant?.sku || '';

  // Gallery
  const mainImg = document.getElementById('main-image');
  mainImg.src   = product.image_url || 'https://placehold.co/600x480/F0EFEB/888?text=Shoe';
  mainImg.alt   = product.name;
  mainImg.onerror = () => mainImg.src = 'https://placehold.co/600x480/F0EFEB/888?text=Shoe';

  // Generate pseudo-gallery thumbs (reuse same image with slight variation)
  const thumbUrls = [
    product.image_url,
    product.image_url,
    product.image_url,
    product.image_url,
  ];
  document.getElementById('gallery-thumbs').innerHTML = thumbUrls.map((url, i) => `
    <div class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="selectThumb(this, '${url}')">
      <img src="${url || 'https://placehold.co/200x200/F0EFEB/888?text=Shoe'}"
           alt="${product.name} view ${i+1}"
           onerror="this.src='https://placehold.co/200x200/F0EFEB/888?text=Shoe'" />
    </div>`).join('');

  // Pricing
  renderPricing();

  // Sale notice
  if (activeSale) {
    const notice = document.getElementById('sale-notice');
    notice.style.display = 'flex';
    notice.classList.remove('hidden');
    document.getElementById('sale-notice-pct').textContent =
      `${Math.round(activeSale.discount_pct)}%`;
  }

  // Extract unique colors
  const colors = [...new Set(product.variants.map(v => v.color))];
  selectedColor = colors[0];
  document.getElementById('selected-color').textContent = selectedColor;

  document.getElementById('color-options').innerHTML = colors.map(c => `
    <div class="color-chip ${c === selectedColor ? 'selected' : ''}"
         onclick="selectColor('${c}')">${c}</div>`).join('');

  renderSizes();
}

function renderPricing(variant = null) {
  const basePrice   = parseFloat(product.base_price);
  const discountPct = activeSale ? parseFloat(activeSale.discount_pct) : 0;
  const salePrice   = discountPct > 0 ? basePrice * (1 - discountPct / 100) : null;

  const priceEl    = document.getElementById('detail-price-current');
  const origEl     = document.getElementById('detail-price-original');
  const badgeEl    = document.getElementById('detail-sale-badge');

  if (salePrice) {
    priceEl.textContent = formatPrice(salePrice);
    priceEl.classList.add('sale-price');
    origEl.textContent  = formatPrice(basePrice);
    origEl.classList.remove('hidden');
    badgeEl.textContent = `-${Math.round(discountPct)}%`;
    badgeEl.classList.remove('hidden');
  } else {
    priceEl.textContent = formatPrice(basePrice);
    priceEl.classList.remove('sale-price');
    origEl.classList.add('hidden');
    badgeEl.classList.add('hidden');
  }
}

function renderSizes() {
  const variants = product.variants.filter(v => v.color === selectedColor);
  const sizeGrid = document.getElementById('size-grid');

  sizeGrid.innerHTML = variants.map(v => `
    <button class="size-btn ${!v.stock ? '' : ''} ${v.size == selectedSize ? 'selected' : ''}"
            ${v.stock === 0 ? 'disabled' : ''}
            onclick="selectSize(${v.size})">
      ${parseFloat(v.size) % 1 === 0 ? parseInt(v.size) : v.size}
    </button>`).join('');

  // Reset size selection when color changes
  if (selectedSize !== null) {
    const stillAvail = variants.find(v => v.size == selectedSize && v.stock > 0);
    if (!stillAvail) {
      selectedSize = null;
      updateAddToCartBtn();
    }
  }
}

function selectColor(color) {
  selectedColor = color;
  document.getElementById('selected-color').textContent = color;
  document.querySelectorAll('.color-chip').forEach(c => {
    c.classList.toggle('selected', c.textContent.trim() === color);
  });
  selectedSize = null;
  renderSizes();
  updateStockIndicator();
  updateAddToCartBtn();
}

function selectSize(size) {
  selectedSize = size;
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.toggle('selected', parseFloat(btn.textContent) === parseFloat(size));
  });
  updateStockIndicator();
  updateAddToCartBtn();
}

function updateStockIndicator() {
  const el = document.getElementById('stock-indicator');
  if (!selectedSize) { el.textContent = ''; return; }

  const variant = getSelectedVariant();
  if (!variant) { el.textContent = ''; return; }

  const stock = variant.stock;
  if (stock === 0) {
    el.textContent = 'Out of stock';
    el.className = 'stock-indicator low';
  } else if (stock <= 3) {
    el.textContent = `Only ${stock} left!`;
    el.className = 'stock-indicator low';
  } else if (stock <= 8) {
    el.textContent = `${stock} in stock`;
    el.className = 'stock-indicator medium';
  } else {
    el.textContent = 'In stock';
    el.className = 'stock-indicator good';
  }
}

function updateAddToCartBtn() {
  const btn = document.getElementById('add-to-cart-btn');
  const variant = getSelectedVariant();

  if (!selectedSize) {
    btn.disabled = true;
    btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> Select a size`;
  } else if (!variant || variant.stock === 0) {
    btn.disabled = true;
    btn.innerHTML = `Out of Stock`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> Add to Cart`;
  }
}

function getSelectedVariant() {
  if (!selectedColor || !selectedSize) return null;
  return product.variants.find(
    v => v.color === selectedColor && parseFloat(v.size) === parseFloat(selectedSize)
  );
}

function handleAddToCart() {
  const variant = getSelectedVariant();
  if (!variant) return;

  const basePrice   = parseFloat(product.base_price);
  const discountPct = activeSale ? parseFloat(activeSale.discount_pct) : 0;
  const finalPrice  = discountPct > 0 ? basePrice * (1 - discountPct / 100) : basePrice;

  addToCart({
    variant_id:   variant.variant_id,
    product_id:   product.product_id,
    name:         product.name,
    brand:        product.brand,
    size:         parseFloat(selectedSize),
    color:        selectedColor,
    base_price:   finalPrice,
    original_price: basePrice,
    image_url:    product.image_url,
    quantity:     1,
  });

  // Animate button
  const btn = document.getElementById('add-to-cart-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = '✓ Added to Cart';
  btn.style.background = 'var(--green)';
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.style.background = '';
  }, 1800);

  showToast(`${product.name} (Size ${parseFloat(selectedSize)}) added to cart`, 'success');
}

function selectThumb(el, url) {
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const mainImg = document.getElementById('main-image');
  mainImg.style.opacity = '0';
  setTimeout(() => {
    mainImg.src = url || 'https://placehold.co/600x480/F0EFEB/888?text=Shoe';
    mainImg.style.opacity = '1';
  }, 150);
}

function setupSaleBanner() {
  if (!activeSale) return;
  document.getElementById('sale-banner').classList.add('active');
  document.getElementById('sale-pct-banner').textContent =
    `${Math.round(activeSale.discount_pct)}% OFF`;
  startCountdown(activeSale.end_time, 'banner-countdown');
}

// Expose to HTML
window.selectColor   = selectColor;
window.selectSize    = selectSize;
window.selectThumb   = selectThumb;

document.getElementById('add-to-cart-btn').addEventListener('click', handleAddToCart);
document.getElementById('wishlist-btn').addEventListener('click', function () {
  this.classList.toggle('active');
  showToast(this.classList.contains('active') ? 'Saved to wishlist' : 'Removed from wishlist', 'info');
});

initProduct();
