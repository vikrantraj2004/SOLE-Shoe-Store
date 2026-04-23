// ============================================================
// api.js — Central API client for SOLE. backend
// ============================================================

const BASE_URL = 'http://localhost:8000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (res.status === 204) return null;  // No content

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.detail || `Request failed: ${res.status}`;
    const err  = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

// ── Products ─────────────────────────────────────────────────

async function getProducts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.brand)     params.set('brand',     filters.brand);
  if (filters.gender)    params.set('gender',    filters.gender);
  if (filters.size)      params.set('size',      filters.size);
  if (filters.min_price) params.set('min_price', filters.min_price);
  if (filters.max_price) params.set('max_price', filters.max_price);
  if (filters.featured !== undefined) params.set('featured', filters.featured);
  const qs = params.toString();
  return request(`/api/products${qs ? '?' + qs : ''}`);
}

async function getProduct(productId) {
  return request(`/api/products/${productId}`);
}

async function getBrands() {
  return request('/api/products/brands');
}

// ── Sales ─────────────────────────────────────────────────────

async function getActiveSale() {
  return request('/api/sales/active');
}

async function getAllSales() {
  return request('/api/sales');
}

async function createSale({ name, discount_pct, end_time }) {
  return request('/api/sales', {
    method: 'POST',
    body: JSON.stringify({ name, discount_pct, end_time }),
  });
}

async function toggleSale(saleId) {
  return request(`/api/sales/${saleId}/toggle`, { method: 'PATCH' });
}

async function deleteSale(saleId) {
  return request(`/api/sales/${saleId}`, { method: 'DELETE' });
}

// ── Orders ────────────────────────────────────────────────────

async function createOrder(orderData) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ user_id: 1, ...orderData }),
  });
}

async function getOrders() {
  return request('/api/orders?user_id=1');
}

async function getOrder(orderId) {
  return request(`/api/orders/${orderId}`);
}

async function updateOrderStatus(orderId, status) {
  return request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ── Returns ───────────────────────────────────────────────────

async function createReturn({ order_id, reason, notes }) {
  return request('/api/returns', {
    method: 'POST',
    body: JSON.stringify({ order_id, reason, notes }),
  });
}

async function getReturnForOrder(orderId) {
  return request(`/api/returns/order/${orderId}`);
}

// ── Admin ─────────────────────────────────────────────────────

async function getAdminStats() {
  return request('/api/admin/stats');
}
