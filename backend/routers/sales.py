from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.get("/active", response_model=Optional[schemas.SaleOut])
def get_active_sale(db: Session = Depends(get_db)):
    """
    Returns the currently active sale, or null.
    Called on every product page load to apply discount prices
    and render the countdown timer.
    """
    sale = db.query(models.SaleEvent).filter(
        models.SaleEvent.is_active == 1,
        models.SaleEvent.end_time > datetime.utcnow()
    ).first()
    return sale


@router.get("", response_model=List[schemas.SaleOut])
def list_sales(db: Session = Depends(get_db)):
    """Admin: list all sale events."""
    return db.query(models.SaleEvent).order_by(
        models.SaleEvent.created_at.desc()
    ).all()


@router.post("", response_model=schemas.SaleOut, status_code=201)
def create_sale(sale_in: schemas.SaleCreate, db: Session = Depends(get_db)):
    """
    Admin: create a new sale event.
    Deactivates any previously active sale first.
    """
    # Deactivate current active sale if any
    db.query(models.SaleEvent).filter(
        models.SaleEvent.is_active == 1
    ).update({"is_active": 0})

    new_sale = models.SaleEvent(
        name         = sale_in.name,
        discount_pct = sale_in.discount_pct,
        start_time   = datetime.utcnow(),
        end_time     = sale_in.end_time,
        is_active    = 1 if sale_in.is_active else 0,
    )
    db.add(new_sale)
    db.commit()
    db.refresh(new_sale)
    return new_sale


@router.delete("/{sale_id}", status_code=204)
def end_sale(sale_id: int, db: Session = Depends(get_db)):
    """Admin: immediately deactivate a sale."""
    sale = db.query(models.SaleEvent).filter(
        models.SaleEvent.sale_id == sale_id
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    sale.is_active = 0
    db.commit()


@router.patch("/{sale_id}/toggle", response_model=schemas.SaleOut)
def toggle_sale(sale_id: int, db: Session = Depends(get_db)):
    """Admin: toggle a sale on or off."""
    sale = db.query(models.SaleEvent).filter(
        models.SaleEvent.sale_id == sale_id
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale.is_active == 0:
        # Activating — deactivate all others first
        db.query(models.SaleEvent).filter(
            models.SaleEvent.sale_id != sale_id
        ).update({"is_active": 0})
        sale.is_active = 1
    else:
        sale.is_active = 0

    db.commit()
    db.refresh(sale)
    return sale
