// ============================================================
// cart.js — localStorage cart logic
// Cart item shape:
// { variant_id, product_id, name, brand, size, color,
//   base_price, image_url, quantity }
// ============================================================

const CART_KEY = 'sole_cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(item) {
  const cart = getCart();
  const existingIdx = cart.findIndex(c => c.variant_id === item.variant_id);

  if (existingIdx >= 0) {
    cart[existingIdx].quantity = Math.min(
      cart[existingIdx].quantity + (item.quantity || 1),
      10
    );
  } else {
    cart.push({ ...item, quantity: item.quantity || 1 });
  }

  saveCart(cart);
  return cart;
}

function removeFromCart(variantId) {
  const cart = getCart().filter(c => c.variant_id !== variantId);
  saveCart(cart);
  return cart;
}

function updateQty(variantId, quantity) {
  const cart = getCart();
  const idx = cart.findIndex(c => c.variant_id === variantId);
  if (idx >= 0) {
    if (quantity <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].quantity = Math.min(quantity, 10);
    }
  }
  saveCart(cart);
  return cart;
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

function getCartTotal(discountPct = 0) {
  const cart = getCart();
  const subtotal = cart.reduce(
    (sum, item) => sum + (item.base_price * item.quantity),
    0
  );
  if (discountPct > 0) {
    return subtotal * (1 - discountPct / 100);
  }
  return subtotal;
}

function applyDiscount(price, discountPct) {
  if (!discountPct) return price;
  return price * (1 - discountPct / 100);
}

function formatPrice(amount) {
  return '$' + parseFloat(amount).toFixed(2);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// Call on page load to sync badge
document.addEventListener('DOMContentLoaded', updateCartBadge);

// ── Toast Notifications ───────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', info: '◆' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size:16px">${icons[type] || '◆'}</span>
                     <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastIn 300ms cubic-bezier(.4,0,.2,1) reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Utility: Star Rating HTML ─────────────────────────────────

function renderStars(rating, max = 5) {
  let html = '<span class="stars">';
  for (let i = 1; i <= max; i++) {
    html += i <= Math.round(rating)
      ? '<span>★</span>'
      : '<span class="empty">★</span>';
  }
  html += '</span>';
  return html;
}

// ── Utility: Status badge HTML ─────────────────────────────────

function renderStatusBadge(status) {
  const labels = {
    pending:   'Pending',
    confirmed: 'Confirmed',
    shipped:   'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return `<span class="badge status-${status}">${labels[status] || status}</span>`;
}

// ── Utility: Countdown timer ──────────────────────────────────

function startCountdown(endTime, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  function tick() {
    const diff = new Date(endTime) - new Date();
    if (diff <= 0) {
      el.textContent = 'EXPIRED';
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent =
      String(h).padStart(2,'0') + ':' +
      String(m).padStart(2,'0') + ':' +
      String(s).padStart(2,'0');
    setTimeout(tick, 1000);
  }
  tick();
}
