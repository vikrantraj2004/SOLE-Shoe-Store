from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/returns", tags=["returns"])

RETURN_WINDOW_DAYS = 7


@router.post("", response_model=schemas.ReturnOut, status_code=201)
def create_return(ret_in: schemas.ReturnCreate, db: Session = Depends(get_db)):
    """
    Submit a whole-order return request.
    Rules:
      - Order must be in 'delivered' status
      - Return must be requested within 7 days of order creation
      - Cannot submit duplicate return for same order
    """
    # Fetch order
    order = db.query(models.Order).filter(
        models.Order.order_id == ret_in.order_id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Already returned?
    existing = db.query(models.Return).filter(
        models.Return.order_id == ret_in.order_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A return request already exists for this order"
        )

    # Must be delivered
    if order.status != models.OrderStatusEnum.delivered:
        raise HTTPException(
            status_code=400,
            detail=f"Returns are only allowed for delivered orders. "
                   f"Current status: {order.status.value}"
        )

    # Within return window
    days_since = (datetime.utcnow() - order.created_at).days
    if days_since > RETURN_WINDOW_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Return window has closed. Returns must be requested within "
                   f"{RETURN_WINDOW_DAYS} days of order. Order is {days_since} days old."
        )

    new_return = models.Return(
        order_id = ret_in.order_id,
        reason   = ret_in.reason,
        notes    = ret_in.notes,
        status   = models.ReturnStatusEnum.requested,
    )
    db.add(new_return)
    db.commit()
    db.refresh(new_return)
    return new_return


@router.get("/order/{order_id}", response_model=schemas.ReturnOut)
def get_return_for_order(order_id: int, db: Session = Depends(get_db)):
    ret = db.query(models.Return).filter(
        models.Return.order_id == order_id
    ).first()
    if not ret:
        raise HTTPException(status_code=404, detail="No return found for this order")
    return ret


@router.get("", response_model=List[schemas.ReturnOut])
def list_returns(db: Session = Depends(get_db)):
    """Admin: list all returns."""
    return db.query(models.Return).order_by(models.Return.requested_at.desc()).all()


@router.patch("/{return_id}/approve", response_model=schemas.ReturnOut)
def approve_return(return_id: int, db: Session = Depends(get_db)):
    ret = db.query(models.Return).filter(models.Return.return_id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    ret.status = models.ReturnStatusEnum.approved
    db.commit()
    db.refresh(ret)
    return ret


@router.patch("/{return_id}/reject", response_model=schemas.ReturnOut)
def reject_return(return_id: int, db: Session = Depends(get_db)):
    ret = db.query(models.Return).filter(models.Return.return_id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    ret.status = models.ReturnStatusEnum.rejected
    db.commit()
    db.refresh(ret)
    return ret
