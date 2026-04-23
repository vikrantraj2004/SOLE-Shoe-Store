from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from enum import Enum


# ─── Enums ─────────────────────────────────────────────────────────────────

class GenderEnum(str, Enum):
    men    = "men"
    women  = "women"
    unisex = "unisex"
    kids   = "kids"


class OrderStatusEnum(str, Enum):
    pending   = "pending"
    confirmed = "confirmed"
    shipped   = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class ReturnStatusEnum(str, Enum):
    requested = "requested"
    approved  = "approved"
    rejected  = "rejected"


class ReturnReasonEnum(str, Enum):
    wrong_size   = "wrong_size"
    defective    = "defective"
    changed_mind = "changed_mind"
    other        = "other"


# ─── Product Variant ────────────────────────────────────────────────────────

class VariantOut(BaseModel):
    variant_id: int
    size:       float
    color:      str
    stock:      int
    sku:        Optional[str]

    class Config:
        from_attributes = True


# ─── Product ────────────────────────────────────────────────────────────────

class ProductListOut(BaseModel):
    product_id:   int
    name:         str
    brand:        str
    gender:       GenderEnum
    base_price:   Decimal
    image_url:    Optional[str]
    is_featured:  int
    # Convenience fields computed server-side
    min_price:    Optional[Decimal] = None
    max_stock:    Optional[int] = None

    class Config:
        from_attributes = True


class ProductDetailOut(BaseModel):
    product_id:  int
    name:        str
    brand:       str
    gender:      GenderEnum
    base_price:  Decimal
    description: Optional[str]
    image_url:   Optional[str]
    is_featured: int
    variants:    List[VariantOut]

    class Config:
        from_attributes = True


# ─── Sale Event ─────────────────────────────────────────────────────────────

class SaleCreate(BaseModel):
    name:         str
    discount_pct: Decimal = Field(..., gt=0, le=100)
    end_time:     datetime
    is_active:    bool = True


class SaleOut(BaseModel):
    sale_id:      int
    name:         str
    discount_pct: Decimal
    start_time:   datetime
    end_time:     datetime
    is_active:    int

    class Config:
        from_attributes = True


# ─── Order ──────────────────────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    variant_id:   int
    product_name: str
    brand:        str
    size:         float
    color:        str
    image_url:    Optional[str] = None
    quantity:     int = Field(..., ge=1, le=10)
    unit_price:   Decimal


class OrderCreate(BaseModel):
    user_id:          int = 1
    shipping_name:    str
    shipping_address: str
    items:            List[OrderItemCreate]


class OrderItemOut(BaseModel):
    item_id:     int
    variant_id:  int
    product_name:str
    brand:       str
    size:        float
    color:       str
    image_url:   Optional[str]
    quantity:    int
    unit_price:  Decimal

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    order_id:         int
    user_id:          int
    total_amount:     Decimal
    status:           OrderStatusEnum
    shipping_name:    Optional[str]
    shipping_address: Optional[str]
    sale_id:          Optional[int]
    created_at:       datetime
    items:            List[OrderItemOut] = []

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: OrderStatusEnum


# ─── Return ─────────────────────────────────────────────────────────────────

class ReturnCreate(BaseModel):
    order_id: int
    reason:   ReturnReasonEnum
    notes:    Optional[str] = None


class ReturnOut(BaseModel):
    return_id:    int
    order_id:     int
    reason:       ReturnReasonEnum
    notes:        Optional[str]
    status:       ReturnStatusEnum
    requested_at: datetime

    class Config:
        from_attributes = True
