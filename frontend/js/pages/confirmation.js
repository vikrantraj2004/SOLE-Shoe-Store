// pages/confirmation.js

async function initConfirmation() {
  const params  = new URLSearchParams(location.search);
  const orderId = params.get('order_id');

  if (!orderId) { location.href = 'orders.html'; return; }

  try {
    const order = await getOrder(orderId);
    renderConfirmation(order);
  } catch (err) {
    document.getElementById('loader').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Could not load order</h3>
        <p>${err.message}</p>
        <a href="orders.html" class="btn btn-primary mt-16">My Orders</a>
      </div>`;
  }
}

function renderConfirmation(order) {
  document.getElementById('loader').style.display = 'none';
  document.getElementById('confirmation-content').classList.remove('hidden');

  document.getElementById('conf-order-id').textContent   = `#${order.order_id}`;
  document.getElementById('conf-status-badge').innerHTML = renderStatusBadge(order.status);
  document.getElementById('conf-date').textContent =
    new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  document.getElementById('conf-address').textContent  = order.shipping_address || '—';
  document.getElementById('conf-total').textContent    = formatPrice(order.total_amount);

  document.getElementById('conf-items').innerHTML = order.items.map(item => `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 0;
                border-bottom:1px solid var(--border)">
      <div style="width:56px;height:48px;border-radius:var(--radius-sm);overflow:hidden;
                  background:var(--bg);flex-shrink:0;border:1px solid var(--border)">
        <img src="${item.image_url || 'https://placehold.co/112x96/F0EFEB/888?text=Shoe'}"
             style="width:100%;height:100%;object-fit:cover"
             onerror="this.src='https://placehold.co/112x96/F0EFEB/888?text=Shoe'" />
      </div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:500">${item.product_name}</div>
        <div class="text-sm text-muted">Size EU ${item.size} · ${item.color} · Qty ${item.quantity}</div>
      </div>
      <div style="font-weight:600;font-size:14px">${formatPrice(item.unit_price * item.quantity)}</div>
    </div>`).join('');
}

initConfirmation();
