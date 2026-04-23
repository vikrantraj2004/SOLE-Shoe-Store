from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/orders", tags=["orders"])

MOCK_USER_ID = 1


@router.post("", response_model=schemas.OrderOut, status_code=201)
def create_order(order_in: schemas.OrderCreate, db: Session = Depends(get_db)):
    """
    Create an order with ATOMIC stock decrement.
    
    ⚡ HIGH-WRITE SAFETY:
    Each variant stock is decremented using a single UPDATE that checks
    stock >= qty in the WHERE clause. If rowcount == 0, the row was
    already taken by a concurrent order → rollback immediately.
    This prevents overselling without application-level locks.
    
    All operations are wrapped in a single MySQL transaction (InnoDB).
    """
    if not order_in.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    # ── Check active sale (read once, apply to all items) ─────────────────
    active_sale = db.query(models.SaleEvent).filter(
        models.SaleEvent.is_active == 1,
        models.SaleEvent.end_time > datetime.utcnow()
    ).first()
    sale_id = active_sale.sale_id if active_sale else None

    # ── Begin transaction ──────────────────────────────────────────────────
    try:
        # Atomically decrement stock for each variant
        for item in order_in.items:
            result = db.execute(
                text("""
                    UPDATE product_variants
                    SET    stock = stock - :qty
                    WHERE  variant_id = :vid
                    AND    stock >= :qty
                """),
                {"qty": item.quantity, "vid": item.variant_id}
            )
            if result.rowcount == 0:
                db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail=f"Insufficient stock for variant {item.variant_id} "
                           f"(size {item.size}, color {item.color}). "
                           "Another customer may have just bought the last pair!"
                )

        # ── Create Order ───────────────────────────────────────────────────
        total = sum(
            Decimal(str(item.unit_price)) * item.quantity
            for item in order_in.items
        )

        new_order = models.Order(
            user_id          = order_in.user_id or MOCK_USER_ID,
            total_amount     = total,
            status           = models.OrderStatusEnum.confirmed,
            shipping_name    = order_in.shipping_name,
            shipping_address = order_in.shipping_address,
            sale_id          = sale_id,
        )
        db.add(new_order)
        db.flush()  # Get order_id without committing

        # ── Create Order Items ─────────────────────────────────────────────
        for item in order_in.items:
            db.add(models.OrderItem(
                order_id     = new_order.order_id,
                variant_id   = item.variant_id,
                product_name = item.product_name,
                brand        = item.brand,
                size         = item.size,
                color        = item.color,
                image_url    = item.image_url,
                quantity     = item.quantity,
                unit_price   = item.unit_price,
            ))

        db.commit()
        db.refresh(new_order)
        return new_order

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")


@router.get("", response_model=List[schemas.OrderOut])
def list_orders(user_id: int = MOCK_USER_ID, db: Session = Depends(get_db)):
    """Get all orders for the mock user, newest first."""
    orders = (
        db.query(models.Order)
        .filter(models.Order.user_id == user_id)
        .order_by(models.Order.created_at.desc())
        .all()
    )
    return orders


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(
        models.Order.order_id == order_id,
        models.Order.user_id == MOCK_USER_ID
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/status", response_model=schemas.OrderOut)
def update_order_status(
    order_id: int,
    body: schemas.OrderStatusUpdate,
    db: Session = Depends(get_db)
):
    """Admin: advance order status (for demo — simulate delivery)."""
    order = db.query(models.Order).filter(models.Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = body.status
    db.commit()
    db.refresh(order)
    return order
