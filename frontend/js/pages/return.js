// pages/return.js

let currentOrder = null;

async function initReturn() {
  const params  = new URLSearchParams(location.search);
  const orderId = params.get('order_id');
  if (!orderId) { location.href = 'orders.html'; return; }

  try {
    const [order, existingReturn] = await Promise.allSettled([
      getOrder(orderId),
      getReturnForOrder(orderId),
    ]);

    document.getElementById('loader').style.display = 'none';

    if (order.status === 'rejected') {
      showBlocked('Order Not Found', 'This order could not be found.');
      return;
    }

    currentOrder = order.value;

    // Check if return already exists
    if (existingReturn.status === 'fulfilled' && existingReturn.value) {
      const ret = existingReturn.value;
      document.getElementById('already-returned').classList.remove('hidden');
      document.getElementById('existing-return-status').innerHTML =
        renderStatusBadge(ret.status);
      document.getElementById('existing-return-reason').textContent =
        formatReason(ret.reason);
      return;
    }

    // Check eligibility: must be delivered
    if (currentOrder.status !== 'delivered') {
      showBlocked(
        'Return Not Available',
        `Returns are only available for delivered orders. Your order is currently <strong>${currentOrder.status}</strong>.`
      );
      return;
    }

    // Check return window (7 days)
    const daysSince = Math.floor(
      (new Date() - new Date(currentOrder.created_at)) / 86400000
    );
    if (daysSince > 7) {
      showBlocked(
        'Return Window Closed',
        `The 7-day return window has passed. This order was placed ${daysSince} days ago.`
      );
      return;
    }

    // All good — show form
    renderReturnForm(daysSince);
    document.getElementById('return-form-content').classList.remove('hidden');
    document.getElementById('submit-return-btn').addEventListener('click', submitReturn);

  } catch (err) {
    document.getElementById('loader').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Error loading order</h3>
        <p>${err.message}</p>
        <a href="orders.html" class="btn btn-outline mt-16">Back to Orders</a>
      </div>`;
  }
}

function renderReturnForm(daysSince) {
  document.getElementById('return-order-id').textContent = `#${currentOrder.order_id}`;
  document.getElementById('return-status-badge').innerHTML = renderStatusBadge(currentOrder.status);
  document.getElementById('return-order-total').textContent = formatPrice(currentOrder.total_amount);
  document.getElementById('days-since').textContent = `${daysSince} day${daysSince !== 1 ? 's' : ''} ago`;

  const daysLeft = 7 - daysSince;
  if (daysLeft <= 2) {
    document.getElementById('days-since').style.color = 'var(--red)';
    document.getElementById('days-since').textContent += ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left to return)`;
  }

  document.getElementById('return-items-list').innerHTML = currentOrder.items.map(item => `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0">
      <div style="width:44px;height:38px;border-radius:var(--radius-sm);overflow:hidden;
                  background:var(--bg);flex-shrink:0;border:1px solid var(--border)">
        <img src="${item.image_url || 'https://placehold.co/88x76/F0EFEB/888?text=Shoe'}"
             style="width:100%;height:100%;object-fit:cover"
             onerror="this.src='https://placehold.co/88x76/F0EFEB/888?text=Shoe'" />
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${item.product_name}</div>
        <div class="text-sm text-muted">Size ${item.size} · ${item.color} · Qty ${item.quantity}</div>
      </div>
      <div style="font-size:13px;font-weight:600">${formatPrice(item.unit_price * item.quantity)}</div>
    </div>`).join('');
}

async function submitReturn() {
  const reason = document.getElementById('return-reason').value;
  const notes  = document.getElementById('return-notes').value.trim();

  if (!reason) {
    showToast('Please select a reason for the return', 'error');
    return;
  }

  const btn = document.getElementById('submit-return-btn');
  btn.disabled   = true;
  btn.textContent = 'Submitting…';

  try {
    await createReturn({
      order_id: currentOrder.order_id,
      reason,
      notes: notes || null,
    });

    document.getElementById('return-form-content').classList.add('hidden');
    document.getElementById('success-state').classList.remove('hidden');
    document.getElementById('success-order-id').textContent = `Order #${currentOrder.order_id}`;
  } catch (err) {
    showToast(err.message || 'Could not submit return. Please try again.', 'error');
    btn.disabled   = false;
    btn.textContent = 'Submit Return Request';
  }
}

function showBlocked(title, msg) {
  document.getElementById('blocked-state').classList.remove('hidden');
  document.getElementById('blocked-title').textContent = title;
  document.getElementById('blocked-msg').innerHTML     = msg;
}

function formatReason(reason) {
  const map = {
    wrong_size:   'Wrong size',
    defective:    'Defective / damaged item',
    changed_mind: 'Changed my mind',
    other:        'Other',
  };
  return map[reason] || reason;
}

initReturn();
