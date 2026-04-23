// pages/admin.js
// ⚡ Core feature: Flash sale control + concurrent-write load simulator

// ── Tab switching ──────────────────────────────────────────────
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    ['sales','load','orders','returns'].forEach(id => {
      document.getElementById(`tab-${id}`).classList.add('hidden');
    });
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');

    // Lazy load tab data
    if (tab.dataset.tab === 'orders')  loadAdminOrders();
    if (tab.dataset.tab === 'returns') loadAdminReturns();
  });
});

// ── Init ───────────────────────────────────────────────────────
async function initAdmin() {
  await Promise.allSettled([loadStats(), loadSales()]);

  document.getElementById('create-sale-btn').addEventListener('click', createSaleHandler);
  document.getElementById('run-load-test-btn').addEventListener('click', runLoadTest);
  document.getElementById('clear-log-btn').addEventListener('click', () => {
    document.getElementById('load-log').innerHTML =
      '<span class="log-info">// Log cleared.</span>';
  });
  document.getElementById('check-stock-btn').addEventListener('click', checkStock);
}

// ── Stats ──────────────────────────────────────────────────────
async function loadStats() {
  try {
    const stats = await getAdminStats();
    document.getElementById('stat-orders').textContent  = stats.total_orders;
    document.getElementById('stat-returns').textContent = stats.total_returns;

    if (stats.active_sale) {
      document.getElementById('stat-sale-status').innerHTML =
        `<span style="color:var(--green)">${stats.active_sale.discount_pct}% OFF</span>`;
      startCountdown(stats.active_sale.end_time, 'stat-sale-ends');
    } else {
      document.getElementById('stat-sale-status').textContent = 'None';
      document.getElementById('stat-sale-ends').textContent   = '—';
    }
  } catch (_) {}
}

// ── Sales ──────────────────────────────────────────────────────
async function loadSales() {
  const list = document.getElementById('sales-list');
  try {
    const sales = await getAllSales();
    if (!sales.length) {
      list.innerHTML = '<p class="text-sm text-muted" style="padding:12px 0">No sale events yet.</p>';
      return;
    }

    list.innerHTML = sales.map(sale => {
      const isActive = sale.is_active && new Date(sale.end_time) > new Date();
      const endDate  = new Date(sale.end_time).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      return `
        <div class="sale-row ${isActive ? 'is-active' : ''}">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              ${isActive ? '<span class="active-dot"></span>' : ''}
              <strong style="font-size:14px">${sale.name}</strong>
              <span class="badge badge-gold" style="font-size:11px">${Math.round(sale.discount_pct)}% OFF</span>
            </div>
            <div class="text-sm text-muted">Ends: ${endDate}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn btn-ghost btn-sm" onclick="handleToggleSale(${sale.sale_id})">
              ${isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<p class="text-sm text-red">Error: ${err.message}</p>`;
  }
}

async function createSaleHandler() {
  const name        = document.getElementById('sale-name').value.trim();
  const discount    = parseFloat(document.getElementById('sale-discount').value);
  const durationMin = parseInt(document.getElementById('sale-duration').value);

  if (!name || !discount || discount < 1 || discount > 90) {
    showToast('Please fill in valid sale details', 'error');
    return;
  }

  const endTime = new Date(Date.now() + durationMin * 60000).toISOString();
  const btn = document.getElementById('create-sale-btn');
  btn.disabled = true;
  btn.textContent = 'Launching…';

  try {
    await createSale({ name, discount_pct: discount, end_time: endTime, is_active: true });
    showToast(`"${name}" is now live! ${discount}% off everything.`, 'success');
    await Promise.allSettled([loadSales(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '⚡ Launch Flash Sale';
  }
}

async function handleToggleSale(saleId) {
  try {
    const sale = await toggleSale(saleId);
    showToast(
      sale.is_active ? `Sale activated: ${sale.name}` : `Sale deactivated`,
      sale.is_active ? 'success' : 'info'
    );
    await Promise.allSettled([loadSales(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

window.handleToggleSale = handleToggleSale;

// ── HIGH-WRITE LOAD TEST ───────────────────────────────────────
// The core demo of the "High write load during sales" focus variation.
// Fires N concurrent order requests against the same variant.
// Backend uses atomic UPDATE-WHERE to prevent overselling.

async function checkStock() {
  const productId = document.getElementById('load-product-id').value;
  const size      = document.getElementById('load-size').value;
  const log       = document.getElementById('load-log');

  try {
    const product = await getProduct(productId);
    const variants = product.variants.filter(v => parseFloat(v.size) === parseFloat(size));

    if (!variants.length) {
      appendLog(log, `No variants found for product ${productId} size ${size}`, 'warn');
      return;
    }

    appendLog(log, `── Stock check: ${product.name} size ${size} ──`, 'info');
    variants.forEach(v => {
      const level = v.stock === 0 ? 'error' : v.stock <= 3 ? 'warn' : 'success';
      appendLog(log, `  Variant #${v.variant_id} (${v.color}): ${v.stock} in stock  [SKU: ${v.sku}]`, level);
    });
  } catch (err) {
    appendLog(log, `Error: ${err.message}`, 'error');
  }
}

async function runLoadTest() {
  const n         = parseInt(document.getElementById('load-concurrency').value);
  const productId = document.getElementById('load-product-id').value;
  const size      = parseFloat(document.getElementById('load-size').value);
  const log       = document.getElementById('load-log');
  const btn       = document.getElementById('run-load-test-btn');

  btn.disabled    = true;
  btn.textContent = '⏳ Running…';

  // Reset UI
  document.getElementById('load-summary').classList.remove('hidden');
  document.getElementById('load-progress-box').classList.remove('hidden');
  const progressFill  = document.getElementById('load-progress-fill');
  const progressLabel = document.getElementById('load-progress-label');
  progressFill.style.width = '0%';

  document.getElementById('load-success-count').textContent = '0';
  document.getElementById('load-fail-count').textContent    = '0';
  document.getElementById('load-total-count').textContent   = n;
  document.getElementById('load-time').textContent          = '…';

  appendLog(log, `\n═══════════════════════════════════════`, 'info');
  appendLog(log, `⚡ LOAD TEST STARTED — ${n} concurrent requests`, 'info');
  appendLog(log, `   Product ID: ${productId} | Size: ${size}`, 'info');
  appendLog(log, `   Timestamp: ${new Date().toLocaleTimeString()}`, 'info');
  appendLog(log, `═══════════════════════════════════════`, 'info');

  // First, fetch the product to get a valid variant
  let targetVariant = null;
  try {
    const product  = await getProduct(productId);
    const variants = product.variants.filter(v => parseFloat(v.size) === parseFloat(size));

    if (!variants.length) {
      appendLog(log, `✕ No variants found for product ${productId} size ${size}`, 'error');
      appendLog(log, `  Try running "Check Current Stock" first.`, 'warn');
      btn.disabled = false; btn.textContent = '🔥 Run Load Test';
      return;
    }

    // Pick the first color variant
    targetVariant = variants[0];
    appendLog(log, `\n📦 Target: ${product.name}`, 'info');
    appendLog(log, `   Variant #${targetVariant.variant_id} (${targetVariant.color} / Size ${size})`, 'info');
    appendLog(log, `   Stock before test: ${targetVariant.stock}`, targetVariant.stock > 0 ? 'success' : 'warn');
    appendLog(log, `\n🚀 Firing ${n} simultaneous requests…\n`, 'info');
  } catch (err) {
    appendLog(log, `✕ Could not load product: ${err.message}`, 'error');
    btn.disabled = false; btn.textContent = '🔥 Run Load Test';
    return;
  }

  // Build all order requests
  const makeOrder = (idx) => createOrder({
    shipping_name:    `Load Test User ${idx + 1}`,
    shipping_address: `${idx + 1} Test Street, Load City`,
    items: [{
      variant_id:   targetVariant.variant_id,
      product_name: `Load Test Product`,
      brand:        'Test',
      size:         size,
      color:        targetVariant.color,
      image_url:    null,
      quantity:     1,
      unit_price:   99.99,
    }],
  });

  let completed = 0;
  let successes = 0;
  let failures  = 0;
  const startTime = Date.now();

  // Fire ALL requests concurrently — this is the high-write demo
  const promises = Array.from({ length: n }, (_, idx) =>
    makeOrder(idx).then(order => {
      successes++;
      completed++;
      progressFill.style.width  = `${(completed / n) * 100}%`;
      progressLabel.textContent = `${completed} / ${n}`;
      document.getElementById('load-success-count').textContent = successes;
      appendLog(log, `  ✓ [${idx+1}] Order #${order.order_id} created successfully`, 'success');
    }).catch(err => {
      failures++;
      completed++;
      progressFill.style.width  = `${(completed / n) * 100}%`;
      progressLabel.textContent = `${completed} / ${n}`;
      document.getElementById('load-fail-count').textContent = failures;

      const isStockErr = err.status === 409;
      appendLog(
        log,
        `  ${isStockErr ? '⚡' : '✕'} [${idx+1}] ${isStockErr ? 'Stock conflict (correct!)' : 'Error'}: ${err.message.substring(0, 80)}`,
        isStockErr ? 'warn' : 'error'
      );
    })
  );

  await Promise.allSettled(promises);

  const elapsed = Date.now() - startTime;
  document.getElementById('load-time').textContent = elapsed;

  appendLog(log, `\n═══════════════════════════════════════`, 'info');
  appendLog(log, `✅ TEST COMPLETE in ${elapsed}ms`, 'success');
  appendLog(log, `   ✓ ${successes} orders succeeded`, 'success');
  appendLog(log, `   ⚡ ${failures} blocked by stock check (no overselling!)`, failures > 0 ? 'warn' : 'info');
  appendLog(log, `   Total: ${n} requests`, 'info');
  appendLog(log, `═══════════════════════════════════════\n`, 'info');

  // Check stock after
  try {
    const productAfter  = await getProduct(productId);
    const variantAfter  = productAfter.variants.find(
      v => v.variant_id === targetVariant.variant_id
    );
    if (variantAfter !== undefined) {
      appendLog(log, `📦 Stock after test: ${variantAfter.stock} remaining`, variantAfter.stock >= 0 ? 'success' : 'error');
      if (variantAfter.stock < 0) {
        appendLog(log, `🚨 OVERSELL DETECTED — stock went negative!`, 'error');
      } else {
        appendLog(log, `✓ No oversell — stock is non-negative`, 'success');
      }
    }
  } catch (_) {}

  loadStats();
  btn.disabled    = false;
  btn.textContent = '🔥 Run Load Test';
}

function appendLog(el, text, type = 'info') {
  const span = document.createElement('span');
  span.className = `log-${type}`;
  span.textContent = text;
  el.appendChild(span);
  el.appendChild(document.createTextNode('\n'));
  el.scrollTop = el.scrollHeight;
}

// ── Admin Orders ───────────────────────────────────────────────
async function loadAdminOrders() {
  const container = document.getElementById('admin-orders-list');
  container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

  try {
    const orders = await getOrders();
    if (!orders.length) {
      container.innerHTML = '<p class="text-sm text-muted" style="padding:20px 24px">No orders found.</p>';
      return;
    }

    const statusOptions = ['pending','confirmed','shipped','delivered','cancelled'];
    container.innerHTML = orders.map(o => {
      const date = new Date(o.created_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      return `
        <div class="order-row">
          <div style="min-width:80px">
            <strong>#${o.order_id}</strong><br>
            <span class="text-sm text-muted">${date}</span>
          </div>
          <div style="flex:1;min-width:120px">
            <span class="text-sm">${o.items?.length || 0} item(s)</span><br>
            <span class="text-sm text-muted">${o.shipping_name || '—'}</span>
          </div>
          <div>${renderStatusBadge(o.status)}</div>
          <div style="font-weight:600">${formatPrice(o.total_amount)}</div>
          <select class="form-select" style="width:auto;font-size:12px;padding:6px 10px"
                  onchange="advanceOrderStatus(${o.order_id}, this.value)">
            ${statusOptions.map(s =>
              `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red" style="padding:20px">${err.message}</p>`;
  }
}

async function advanceOrderStatus(orderId, status) {
  try {
    await updateOrderStatus(orderId, status);
    showToast(`Order #${orderId} → ${status}`, 'success');
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
    loadAdminOrders(); // Revert UI
  }
}

window.loadAdminOrders    = loadAdminOrders;
window.advanceOrderStatus = advanceOrderStatus;

// ── Admin Returns ──────────────────────────────────────────────
async function loadAdminReturns() {
  const container = document.getElementById('admin-returns-list');
  container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

  try {
    const returns = await request('/api/returns');
    if (!returns.length) {
      container.innerHTML = '<p class="text-sm text-muted" style="padding:20px 24px">No return requests.</p>';
      return;
    }

    const reasonLabels = {
      wrong_size: 'Wrong Size', defective: 'Defective',
      changed_mind: 'Changed Mind', other: 'Other'
    };

    container.innerHTML = returns.map(r => {
      const date = new Date(r.requested_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
      return `
        <div class="order-row">
          <div style="min-width:90px">
            <strong>Return #${r.return_id}</strong><br>
            <span class="text-sm text-muted">Order #${r.order_id}</span>
          </div>
          <div style="flex:1">
            <span class="text-sm">${reasonLabels[r.reason] || r.reason}</span><br>
            <span class="text-sm text-muted">${date}</span>
          </div>
          <div>${renderStatusBadge(r.status)}</div>
          ${r.status === 'requested' ? `
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" style="color:var(--green);border-color:var(--green-light)"
                      onclick="handleReturn(${r.return_id},'approve')">Approve</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red);border-color:var(--red-light)"
                      onclick="handleReturn(${r.return_id},'reject')">Reject</button>
            </div>` : '<div></div>'}
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red" style="padding:20px">${err.message}</p>`;
  }
}

async function handleReturn(returnId, action) {
  try {
    await request(`/api/returns/${returnId}/${action}`, { method: 'PATCH' });
    showToast(`Return #${returnId} ${action}d`, action === 'approve' ? 'success' : 'info');
    loadAdminReturns();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

window.handleReturn    = handleReturn;
window.loadAdminReturns = loadAdminReturns;

initAdmin();
