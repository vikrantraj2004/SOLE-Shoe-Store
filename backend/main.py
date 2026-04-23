from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models  # noqa: F401 — ensures all models are registered before create_all

from routers import products, orders, returns, sales

# Create tables (safe if already exist)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SOLE. Shoe Store API",
    description=(
        "E-Commerce Order & Returns backend with MySQL. "
        "Optimised for high-write load during flash sales using "
        "atomic UPDATE-WHERE stock checks inside InnoDB transactions."
    ),
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────
# Allow all origins for local dev (frontend served from file:// or localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(returns.router)
app.include_router(sales.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "SOLE. API"}


@app.get("/api/admin/stats")
def admin_stats(db=None):
    """Quick overview for the admin page."""
    from sqlalchemy.orm import Session
    from database import SessionLocal
    from datetime import datetime

    db: Session = SessionLocal()
    try:
        total_orders  = db.query(models.Order).count()
        total_returns = db.query(models.Return).count()
        active_sale   = db.query(models.SaleEvent).filter(
            models.SaleEvent.is_active == 1,
            models.SaleEvent.end_time > datetime.utcnow()
        ).first()

        return {
            "total_orders":  total_orders,
            "total_returns": total_returns,
            "active_sale":   {
                "sale_id":      active_sale.sale_id,
                "name":         active_sale.name,
                "discount_pct": float(active_sale.discount_pct),
                "end_time":     active_sale.end_time.isoformat(),
            } if active_sale else None,
        }
    finally:
        db.close()
