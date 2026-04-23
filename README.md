# SOLE. — Shoe Store

**E-Commerce Order & Returns DB** · Focus: **High Write Load During Flash Sales**

A full-stack mini e-commerce project for premium footwear, built with FastAPI + MySQL + plain HTML/CSS/JS.

---

## 🗂️ Project Structure

```
shoe-store/
├── frontend/
│   ├── index.html          # Homepage — hero, featured products, sale banner
│   ├── products.html       # Listing — filter by brand/gender/size/price
│   ├── product.html        # Detail — gallery, size selector, stock count, add to cart
│   ├── cart.html           # Cart — quantities, order summary, checkout modal
│   ├── confirmation.html   # Order confirmation — ID, items, total
│   ├── orders.html         # My Orders — status tabs, return button
│   ├── return.html         # Return request — eligibility check, reason form
│   ├── admin.html          # Admin — flash sale control + ⚡ load test simulator
│   ├── css/style.css       # Full design system (editorial minimal, gold accents)
│   └── js/
│       ├── api.js          # All fetch() calls to FastAPI
│       ├── cart.js         # localStorage cart + toasts + countdown timer
│       └── pages/          # Per-page JS modules
│
├── backend/
│   ├── main.py             # FastAPI app, CORS, router registration
│   ├── database.py         # MySQL connection (pool_size=20 for flash sale load)
│   ├── models.py           # SQLAlchemy ORM models
│   ├── schemas.py          # Pydantic request/response models
│   └── routers/
│       ├── products.py     # GET /api/products, /api/products/{id}
│       ├── orders.py       # POST /api/orders (atomic stock decrement)
│       ├── returns.py      # POST /api/returns (7-day window validation)
│       └── sales.py        # Flash sale CRUD + toggle
│
├── db/
│   └── schema.sql          # CREATE TABLE + seed data (8 products, 96 variants)
│
├── requirements.txt
└── .env.example
```

---

## ⚙️ Setup

### 1. MySQL Database

```bash
mysql -u root -p < db/schema.sql
```

This creates the `shoestore` database, all tables, and seeds 8 shoe products with variants.

### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt

# Configure environment
cp ../.env.example ../.env
# Edit .env with your MySQL credentials

# Start the API server
uvicorn main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

### 3. Frontend

Open any HTML file directly in a browser, or use a simple dev server:

```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

> The frontend calls `http://localhost:8000` — make sure the backend is running.

---

## 🗄️ Database Schema

| Table | Purpose |
|---|---|
| `users` | Mock customer (user_id=1, hardcoded) |
| `products` | Shoe catalog — name, brand, gender, price |
| `product_variants` | Size × color combinations with individual **stock** |
| `sale_events` | Flash sale — discount %, start/end time, active flag |
| `orders` | One row per completed order |
| `order_items` | Each variant + qty in an order (price locked at purchase time) |
| `returns` | Whole-order return requests (7-day window, delivered only) |

---

## ⚡ High Write Load — How It Works

### The Problem
During a flash sale, hundreds of concurrent users may attempt to buy the last pair of a shoe simultaneously. Without protection, this causes **overselling** — stock goes negative.

### The Solution (in `routers/orders.py`)

```python
# ATOMIC stock check + decrement in a single UPDATE
result = db.execute(
    text("""
        UPDATE product_variants
        SET    stock = stock - :qty
        WHERE  variant_id = :vid
        AND    stock >= :qty   -- ← Only decrements if enough stock exists
    """),
    {"qty": item.quantity, "vid": item.variant_id}
)

if result.rowcount == 0:
    db.rollback()
    raise HTTPException(409, "Insufficient stock — someone beat you to it!")
```

**Why this works:**
- MySQL InnoDB executes this as a **row-level atomic operation**
- If two requests arrive simultaneously, only one can pass the `stock >= qty` check
- The loser gets a `409 Conflict` response immediately
- No application-level locks, no race conditions, no overselling

### Additional safeguards
- **Connection pooling**: `pool_size=20, max_overflow=40` in `database.py`
- **InnoDB engine**: explicit `ENGINE=InnoDB` on all transactional tables
- **Full transaction**: all `order_items` inserts + all stock decrements in one `db.commit()`

### Demo (Admin Panel)

1. Open **`admin.html`**
2. **Create a Flash Sale** (e.g. 30% off, 10 minutes)
3. Go to the **⚡ High-Write Load Test** tab
4. Set concurrent requests (try 20–50)
5. Click **Run Load Test**
6. Watch the terminal log — successful orders vs. stock conflicts are color-coded
7. Click **Check Current Stock** to confirm no negative stock

---

## 🖥️ Pages Overview

| Page | URL | Description |
|---|---|---|
| Homepage | `index.html` | Sale banner, countdown timer, featured grid |
| Listing | `products.html` | Filter sidebar, sort, sale prices |
| Product | `product.html?id=1` | Gallery, size/color selector, stock badge |
| Cart | `cart.html` | Item list, qty controls, checkout modal |
| Confirmation | `confirmation.html?order_id=1` | Order summary |
| My Orders | `orders.html` | Status filter tabs, return button |
| Return | `return.html?order_id=1` | Eligibility check + reason form |
| Admin | `admin.html` | Sale control + load test + order management |

---

## 🔌 API Endpoints

```
GET    /api/products               List products (filter: brand, gender, size, price)
GET    /api/products/brands        List unique brands
GET    /api/products/{id}          Product detail with variants

GET    /api/sales/active           Currently active sale (for frontend countdown)
GET    /api/sales                  All sales (admin)
POST   /api/sales                  Create new sale
PATCH  /api/sales/{id}/toggle      Toggle sale on/off
DELETE /api/sales/{id}             End sale

POST   /api/orders                 Create order (atomic stock decrement)
GET    /api/orders                 User's orders
GET    /api/orders/{id}            Order detail
PATCH  /api/orders/{id}/status     Advance order status (admin)

POST   /api/returns                Submit return request
GET    /api/returns/order/{id}     Get return for order
GET    /api/returns                All returns (admin)
PATCH  /api/returns/{id}/approve   Approve return
PATCH  /api/returns/{id}/reject    Reject return

GET    /api/admin/stats            Dashboard stats
GET    /health                     Health check
```

---

## 🎨 Design

- **Aesthetic**: Editorial luxury minimal (inspired by reference mockups)
- **Fonts**: Cormorant Garamond (display) + DM Sans (body)
- **Palette**: Off-white (`#F6F5F1`), pure black, warm gold (`#C89B2A`)
- **Cart**: `localStorage` (no auth required)
- **User**: Hardcoded mock user (`user_id=1`, Alex Mercer)
