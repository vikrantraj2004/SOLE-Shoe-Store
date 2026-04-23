from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from decimal import Decimal

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=List[schemas.ProductListOut])
def list_products(
    brand:     Optional[str]   = None,
    gender:    Optional[str]   = None,
    size:      Optional[float] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    featured:  Optional[bool]  = None,
    db:        Session         = Depends(get_db),
):
    """List products with optional filters. Returns max_stock per product."""
    q = db.query(models.Product)

    if brand:
        q = q.filter(models.Product.brand.ilike(f"%{brand}%"))
    if gender:
        q = q.filter(models.Product.gender == gender)
    if min_price is not None:
        q = q.filter(models.Product.base_price >= min_price)
    if max_price is not None:
        q = q.filter(models.Product.base_price <= max_price)
    if featured is not None:
        q = q.filter(models.Product.is_featured == (1 if featured else 0))

    products = q.all()

    # Filter by size availability if requested
    if size is not None:
        products = [
            p for p in products
            if any(
                float(v.size) == size and v.stock > 0
                for v in p.variants
            )
        ]

    result = []
    for p in products:
        max_stock = max((v.stock for v in p.variants), default=0)
        item = schemas.ProductListOut.model_validate(p)
        item.max_stock = max_stock
        result.append(item)

    return result


@router.get("/brands", response_model=List[str])
def list_brands(db: Session = Depends(get_db)):
    brands = db.query(models.Product.brand).distinct().order_by(models.Product.brand).all()
    return [b[0] for b in brands]


@router.get("/{product_id}", response_model=schemas.ProductDetailOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(
        models.Product.product_id == product_id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return product
