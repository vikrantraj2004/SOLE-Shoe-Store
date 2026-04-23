from sqlalchemy import (Column, Integer, String, Text, Numeric,
                         Enum, TIMESTAMP, ForeignKey, SmallInteger)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class GenderEnum(str, enum.Enum):
    men    = "men"
    women  = "women"
    unisex = "unisex"
    kids   = "kids"


class OrderStatusEnum(str, enum.Enum):
    pending   = "pending"
    confirmed = "confirmed"
    shipped   = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class ReturnStatusEnum(str, enum.Enum):
    requested = "requested"
    approved  = "approved"
    rejected  = "rejected"


class ReturnReasonEnum(str, enum.Enum):
    wrong_size   = "wrong_size"
    defective    = "defective"
    changed_mind = "changed_mind"
    other        = "other"


class User(Base):
    __tablename__ = "users"

    user_id    = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100), nullable=False)
    email      = Column(String(150), unique=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    orders = relationship("Order", back_populates="user")


class Product(Base):
    __tablename__ = "products"

    product_id  = Column(Integer, primary_key=True, index=True)
    name        = Column(String(200), nullable=False)
    brand       = Column(String(100), nullable=False, index=True)
    gender      = Column(Enum(GenderEnum), nullable=False, default=GenderEnum.unisex)
    base_price  = Column(Numeric(10, 2), nullable=False)
    description = Column(Text)
    image_url   = Column(String(500))
    is_featured = Column(SmallInteger, default=0)
    created_at  = Column(TIMESTAMP, server_default=func.now())

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    variant_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    size       = Column(Numeric(4, 1), nullable=False)
    color      = Column(String(50), nullable=False)
    stock      = Column(Integer, nullable=False, default=0)
    sku        = Column(String(100), unique=True)

    product     = relationship("Product", back_populates="variants")
    order_items = relationship("OrderItem", back_populates="variant")


class SaleEvent(Base):
    __tablename__ = "sale_events"

    sale_id      = Column(Integer, primary_key=True, index=True)
    name         = Column(String(200), nullable=False)
    discount_pct = Column(Numeric(5, 2), nullable=False)
    start_time   = Column(TIMESTAMP, nullable=False)
    end_time     = Column(TIMESTAMP, nullable=False)
    is_active    = Column(SmallInteger, default=1)
    created_at   = Column(TIMESTAMP, server_default=func.now())

    orders = relationship("Order", back_populates="sale")


class Order(Base):
    __tablename__ = "orders"

    order_id         = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    total_amount     = Column(Numeric(10, 2), nullable=False)
    status           = Column(Enum(OrderStatusEnum), default=OrderStatusEnum.confirmed)
    shipping_name    = Column(String(150))
    shipping_address = Column(Text)
    sale_id          = Column(Integer, ForeignKey("sale_events.sale_id"), nullable=True)
    created_at       = Column(TIMESTAMP, server_default=func.now())

    user   = relationship("User", back_populates="orders")
    sale   = relationship("SaleEvent", back_populates="orders")
    items  = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    ret    = relationship("Return", back_populates="order", uselist=False)


class OrderItem(Base):
    __tablename__ = "order_items"

    item_id      = Column(Integer, primary_key=True, index=True)
    order_id     = Column(Integer, ForeignKey("orders.order_id"), nullable=False, index=True)
    variant_id   = Column(Integer, ForeignKey("product_variants.variant_id"), nullable=False)
    product_name = Column(String(200), nullable=False)
    brand        = Column(String(100), nullable=False)
    size         = Column(Numeric(4, 1), nullable=False)
    color        = Column(String(50), nullable=False)
    image_url    = Column(String(500))
    quantity     = Column(Integer, nullable=False, default=1)
    unit_price   = Column(Numeric(10, 2), nullable=False)

    order   = relationship("Order", back_populates="items")
    variant = relationship("ProductVariant", back_populates="order_items")


class Return(Base):
    __tablename__ = "returns"

    return_id    = Column(Integer, primary_key=True, index=True)
    order_id     = Column(Integer, ForeignKey("orders.order_id"), unique=True, nullable=False, index=True)
    reason       = Column(Enum(ReturnReasonEnum), nullable=False)
    notes        = Column(Text)
    status       = Column(Enum(ReturnStatusEnum), default=ReturnStatusEnum.requested)
    requested_at = Column(TIMESTAMP, server_default=func.now())

    order = relationship("Order", back_populates="ret")
