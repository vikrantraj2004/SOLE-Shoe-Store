// pages/index.js — Homepage logic

async function initHomepage() {
  // Load sale & featured products in parallel
  const [products, sale, brands] = await Promise.allSettled([
    getProducts({ featured: true }),
    getActiveSale(),
    getBrands(),
  ]);

  // ── Sale banner ───────────────────────────────────────────
  const activeSale = sale.status === 'fulfilled' ? sale.value : null;
  if (activeSale) {
    document.getElementById('sale-banner').classList.add('active');
    document.getElementById('sale-pct-banner').textContent =
      `${Math.round(activeSale.discount_pct)}% OFF`;
    startCountdown(activeSale.end_time, 'banner-countdown');

    // Hero sale box
    const heroBox = document.getElementById('hero-sale-box');
    heroBox.classList.remove('hidden');
    document.getElementById('hero-sale-label').textContent = activeSale.name;
    document.getElementById('hero-pct').textContent = `${Math.round(activeSale.discount_pct)}% OFF`;
    startCountdown(activeSale.end_time, 'hero-countdown');
  }

  // ── Featured Products ─────────────────────────────────────
  const grid = document.getElementById('featured-grid');
  if (products.status === 'fulfilled' && products.value?.length) {
    const discountPct = activeSale ? parseFloat(activeSale.discount_pct) : 0;
    grid.innerHTML = products.value
      .slice(0, 8)
      .map(p => renderProductCard(p, discountPct))
      .join('');
  } else {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">👟</div>
        <h3>Could not load products</h3>
        <p>Make sure the backend is running on localhost:8000</p>
      </div>`;
  }

  // ── Brands strip ──────────────────────────────────────────
  if (brands.status === 'fulfilled' && brands.value?.length) {
    document.getElementById('brands-list').innerHTML = brands.value
      .map(b => `<a href="products.html?brand=${encodeURIComponent(b)}"
                    style="font-size:15px;font-weight:600;letter-spacing:.5px;
                           color:var(--text-secondary);transition:color var(--transition)"
                    onmouseover="this.style.color='var(--black)'"
                    onmouseout="this.style.color='var(--text-secondary)'">${b}</a>`)
      .join('');
  }
}

function renderProductCard(product, discountPct = 0) {
  const basePrice = parseFloat(product.base_price);
  const salePrice = discountPct > 0 ? basePrice * (1 - discountPct / 100) : null;
  const inStock   = (product.max_stock || 0) > 0;

  return `
    <div class="product-card" onclick="location.href='product.html?id=${product.product_id}'">
      <div class="product-card-img">
        <img src="${product.image_url || 'https://placehold.co/400x320/F0EFEB/888?text=Shoe'}"
             alt="${product.name}"
             onerror="this.src='https://placehold.co/400x320/F0EFEB/888?text=Shoe'" />
      </div>
      <div class="product-card-body">
        <div class="product-brand">${product.brand}</div>
        <div class="product-name">${product.name}</div>
        <div class="product-price">
          ${inStock ? `
            ${salePrice
              ? `<span class="price-current sale">${formatPrice(salePrice)}</span>
                 <span class="price-original">${formatPrice(basePrice)}</span>
                 <span class="sale-pct-badge">-${Math.round(discountPct)}%</span>`
              : `<span class="price-current">${formatPrice(basePrice)}</span>`
            }
          ` : `<span class="out-of-stock-badge">Out of stock</span>`}
        </div>
      </div>
    </div>`;
}

// Expose for reuse
window.renderProductCard = renderProductCard;

initHomepage();
