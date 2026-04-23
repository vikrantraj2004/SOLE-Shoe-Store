// pages/orders.js

let allOrders    = [];
let activeFilter = '';

async function initOrders() {
  // Status tab events
  document.querySelectorAll('#status-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#status-tabs button').forEach(b => {
        b.className = 'btn btn-ghost btn-sm';
      });
      btn.className = 'btn btn-primary btn-sm active-tab';
      activeFilter = btn.dataset.status;
      renderOrders();
    });
  });

  await loadOrders();
}

async function loadOrders() {
  try {
    allOrders = await getOrders();
    document.getElementById('loader').style.display  = 'none';
    document.getElementById('orders-list').classList.remove('hidden');

    document.getElementById('order-count-badge').textContent =
      `${allOrders.length} order${allOrders.length !== 1 ? 's' : ''}`;

    renderOrders();
  } catch (err) {
    document.getElementById('loader').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Could not load orders</h3>
        <p>${err.message}</p>
      </div>`;
  }
}

function renderOrders() {
  const container = document.getElementById('orders-list');
  const emptyEl   = document.getElementById('empty-state');

  const filtered = activeFilter
    ? allOrders.filter(o => o.status === activeFilter)
    : allOrders;

  if (!filtered.length) {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    emptyEl.querySelector('h3').textContent =
      activeFilter ? `No ${activeFilter} orders` : 'No orders yet';
    emptyEl.querySelector('p').textContent =
      activeFilter ? `You have no orders with status "${activeFilter}".` : 'Your orders will appear here once you make a purchase.';
    return;
  }

  emptyEl.classList.add('hidden');

  container.innerHTML = filtered.map(order => {
    const canReturn     = order.status === 'delivered';
    const date          = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const itemPreviews  = order.items.slice(0, 4).map(item => `
      <div class="order-item-thumb">
        <img src="${item.image_url || 'https://placehold.co/112x96/F0EFEB/888?text=Shoe'}"
             alt="${item.product_name}"
             onerror="this.src='https://placehold.co/112x96/F0EFEB/888?text=Shoe'" />
      </div>`).join('');

    const extra = order.items.length > 4
      ? `<div style="font-size:12px;color:var(--text-muted);align-self:center">+${order.items.length - 4} more</div>`
      : '';

    return `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <div class="order-id">Order #${order.order_id}</div>
            <div class="order-meta">${date} · ${order.items.length} item${order.items.length !== 1 ? 's' : ''}</div>
          </div>
          ${renderStatusBadge(order.status)}
        </div>

        <div class="order-items-preview">
          ${itemPreviews}
          ${extra}
        </div>

        <div class="order-card-footer">
          <span class="order-total">${formatPrice(order.total_amount)}</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a href="confirmation.html?order_id=${order.order_id}" class="btn btn-ghost btn-sm">
              View Details
            </a>
            ${canReturn
              ? `<a href="return.html?order_id=${order.order_id}" class="btn btn-outline btn-sm">
                   Request Return
                 </a>`
              : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

initOrders();
