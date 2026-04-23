// pages/cart.js

let activeSaleData = null;

async function initCart() {
  // Load sale info
  try {
    activeSaleData = await getActiveSale();
    if (activeSaleData) {
      document.getElementById('sale-banner').classList.add('active');
      document.getElementById('sale-pct-banner').textContent =
        `${Math.round(activeSaleData.discount_pct)}% OFF`;
      startCountdown(activeSaleData.end_time, 'banner-countdown');

      const nudge = document.getElementById('sale-nudge');
      nudge.classList.remove('hidden');
      nudge.style.display = 'flex';
      document.getElementById('sale-nudge-label').textContent = activeSaleData.name;
    }
  } catch (_) {}

  renderCart();

  document.getElementById('checkout-btn').addEventListener('click', openCheckoutModal);
  document.getElementById('place-order-btn').addEventListener('click', placeOrder);
}

function renderCart() {
  const cart = getCart();

  document.getElementById('cart-count-title').textContent =
    cart.length ? `(${cart.length} item${cart.length > 1 ? 's' : ''})` : '';

  if (!cart.length) {
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('cart-content').style.display = 'none';
    return;
  }

  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('cart-content').style.display = 'grid';

  document.getElementById('cart-items-list').innerHTML = cart.map(item => `
    <div class="cart-item" id="item-${item.variant_id}">
      <div class="cart-item-img">
        <img src="${item.image_url || 'https://placehold.co/200x160/F0EFEB/888?text=Shoe'}"
             alt="${item.name}"
             onerror="this.src='https://placehold.co/200x160/F0EFEB/888?text=Shoe'" />
      </div>
      <div>
        <div class="product-brand">${item.brand}</div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">Size EU ${item.size} · ${item.color}</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${item.variant_id}, ${item.quantity - 1})">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" onclick="changeQty(${item.variant_id}, ${item.quantity + 1})">+</button>
        </div>
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:12px">
        <div>
          <div style="font-weight:600;font-size:1rem">${formatPrice(item.base_price * item.quantity)}</div>
          ${item.quantity > 1
            ? `<div class="text-sm text-muted">${formatPrice(item.base_price)} each</div>`
            : ''}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="removeItem(${item.variant_id})"
                style="color:var(--red);border-color:transparent;font-size:12px">
          Remove
        </button>
      </div>
    </div>`).join('');

  updateSummary();
}

function updateSummary() {
  const cart     = getCart();
  const subtotal = cart.reduce((s, i) => s + i.base_price * i.quantity, 0);
  const total    = subtotal;  // prices already have discount applied

  document.getElementById('summary-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('summary-total').textContent    = formatPrice(total);

  const shipping = total >= 30 ? 'Free' : formatPrice(5.99);
  document.getElementById('summary-shipping').textContent = shipping;
}

function changeQty(variantId, newQty) {
  updateQty(variantId, newQty);
  renderCart();
}

function removeItem(variantId) {
  removeFromCart(variantId);
  renderCart();
  showToast('Item removed from cart', 'info');
}

function openCheckoutModal() {
  const cart = getCart();
  if (!cart.length) return;
  const total = cart.reduce((s, i) => s + i.base_price * i.quantity, 0);
  document.getElementById('modal-total').textContent = formatPrice(total);
  document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

async function placeOrder() {
  const shippingName    = document.getElementById('shipping-name').value.trim();
  const shippingAddress = document.getElementById('shipping-address').value.trim();

  if (!shippingName || !shippingAddress) {
    showToast('Please fill in all shipping details', 'error');
    return;
  }

  const cart = getCart();
  if (!cart.length) return;

  const btn = document.getElementById('place-order-btn');
  btn.disabled   = true;
  btn.textContent = 'Placing Order…';

  const items = cart.map(item => ({
    variant_id:   item.variant_id,
    product_name: item.name,
    brand:        item.brand,
    size:         item.size,
    color:        item.color,
    image_url:    item.image_url,
    quantity:     item.quantity,
    unit_price:   item.base_price,
  }));

  try {
    const order = await createOrder({ shipping_name: shippingName, shipping_address: shippingAddress, items });
    clearCart();
    location.href = `confirmation.html?order_id=${order.order_id}`;
  } catch (err) {
    showToast(err.message || 'Order failed. Please try again.', 'error');
    btn.disabled   = false;
    btn.textContent = 'Place Order';
  }
}

// Expose to HTML onclick
window.changeQty        = changeQty;
window.removeItem       = removeItem;
window.closeCheckoutModal = closeCheckoutModal;

initCart();
