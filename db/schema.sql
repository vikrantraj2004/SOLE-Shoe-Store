-- ============================================================
-- SOLE. Shoe Store — E-Commerce Order & Returns DB
-- Domain Focus: High write load during flash sales
-- ============================================================

CREATE DATABASE IF NOT EXISTS shoestore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shoestore;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id     INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    product_id  INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    brand       VARCHAR(100) NOT NULL,
    gender      ENUM('men', 'women', 'unisex', 'kids') NOT NULL DEFAULT 'unisex',
    base_price  DECIMAL(10,2) NOT NULL,
    description TEXT,
    image_url   VARCHAR(500),
    is_featured TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_brand (brand),
    INDEX idx_gender (gender),
    INDEX idx_featured (is_featured)
);

CREATE TABLE IF NOT EXISTS product_variants (
    variant_id  INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    size        DECIMAL(4,1) NOT NULL,
    color       VARCHAR(50) NOT NULL,
    stock       INT NOT NULL DEFAULT 0,
    sku         VARCHAR(100) UNIQUE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_stock (stock),
    INDEX idx_size (size)
) ENGINE=InnoDB;
-- InnoDB is critical: supports row-level locking for concurrent writes

-- ============================================================
-- SALE EVENTS — One active sale at a time
-- High-write focus: discount_pct applied atomically per order
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_events (
    sale_id      INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    discount_pct DECIMAL(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 100),
    start_time   TIMESTAMP NOT NULL,
    end_time     TIMESTAMP NOT NULL,
    is_active    TINYINT(1) DEFAULT 1,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_active_sale (is_active, end_time)
);

-- ============================================================
-- ORDERS — One row per completed order
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT NOT NULL,
    total_amount     DECIMAL(10,2) NOT NULL,
    status           ENUM('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'confirmed',
    shipping_name    VARCHAR(150),
    shipping_address TEXT,
    sale_id          INT DEFAULT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (sale_id) REFERENCES sale_events(sale_id),
    INDEX idx_user_orders (user_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- ORDER ITEMS — Each variant+qty per order
-- unit_price stored at time of purchase (after any discount)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    item_id       INT AUTO_INCREMENT PRIMARY KEY,
    order_id      INT NOT NULL,
    variant_id    INT NOT NULL,
    product_name  VARCHAR(200) NOT NULL,
    brand         VARCHAR(100) NOT NULL,
    size          DECIMAL(4,1) NOT NULL,
    color         VARCHAR(50) NOT NULL,
    image_url     VARCHAR(500),
    quantity      INT NOT NULL DEFAULT 1,
    unit_price    DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id),
    INDEX idx_order (order_id)
) ENGINE=InnoDB;

-- ============================================================
-- RETURNS — Whole-order returns only
-- Eligibility: status=delivered AND within 7 days of order
-- ============================================================
CREATE TABLE IF NOT EXISTS returns (
    return_id    INT AUTO_INCREMENT PRIMARY KEY,
    order_id     INT NOT NULL UNIQUE,
    reason       ENUM('wrong_size','defective','changed_mind','other') NOT NULL,
    notes        TEXT,
    status       ENUM('requested','approved','rejected') DEFAULT 'requested',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    INDEX idx_return_order (order_id),
    INDEX idx_return_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Mock user (no auth — hardcoded in frontend as user_id=1)
INSERT INTO users (user_id, name, email) VALUES
(1, 'Alex Mercer', 'alex.mercer@example.com');

-- ============================================================
-- PRODUCTS (8 shoes, spanning brands & genders)
-- ============================================================
INSERT INTO products (product_id, name, brand, gender, base_price, description, image_url, is_featured) VALUES
(1, 'Air Max 90', 'Nike', 'unisex', 149.99,
 'The Nike Air Max 90 stays true to its OG running roots with the iconic Waffle outsole, stitched overlays and classic TPU details. Classic colors celebrate your fresh look while Max Air cushioning adds comfort to your journey.',
 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', 1),

(2, 'Stan Smith', 'Adidas', 'unisex', 99.99,
 'The Stan Smith shoe was made for tennis in 1971 and became a cultural icon. Premium leather upper with perforated 3-Stripes, cushioned midsole for all-day comfort.',
 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=80', 1),

(3, 'Zig Kinetica 3', 'Reebok', 'unisex', 199.00,
 'The Zig Kinetica 3 features a ZigTech sole for energy return and a Floatride Energy Foam midsole for lightweight cushioning. Engineered upper wraps your foot for a secure feel.',
 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=80', 1),

(4, '880 v13', 'New Balance', 'men', 154.99,
 'The 880 has been a staple of the New Balance running lineup for years. v13 brings Fresh Foam X cushioning and an engineered knit upper for breathable, long-run comfort.',
 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600&q=80', 1),

(5, 'Gel-Lyte III OG', 'ASICS', 'unisex', 119.99,
 'The Gel-Lyte III OG brings back the iconic split tongue design from 1990. Full-length GEL technology cushioning absorbs shock and allows movement in multiple planes of motion.',
 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&q=80', 0),

(6, 'RS-X Efekt', 'Puma', 'unisex', 129.99,
 'The RS-X Efekt brings a chunky 90s aesthetic to everyday wear. RS (Running System) technology provides responsive cushioning, while bold overlays and a thick outsole command attention.',
 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&q=80', 0),

(7, 'Old Skool Pro', 'Vans', 'unisex', 79.99,
 'The Vans Old Skool features the iconic side stripe, suede and canvas upper, and waffle outsole for traction. A skate classic that has become a street staple worldwide.',
 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=600&q=80', 0),

(8, 'Chuck 70 Hi', 'Converse', 'unisex', 95.00,
 'The Chuck 70 is a premium version of the All Star. Higher quality canvas, more durable rubber, and enhanced cushioning make this the go-to for purists who want the classic look elevated.',
 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80', 1);

-- ============================================================
-- PRODUCT VARIANTS (size × color per product)
-- Sizes: 40, 41, 42, 43, 44, 45 | 2 colors each
-- Stock seeded with realistic values for sale simulation
-- ============================================================

-- Product 1: Nike Air Max 90 — White & Black
INSERT INTO product_variants (product_id, size, color, stock, sku) VALUES
(1, 40, 'White', 15, 'NIKE-AM90-WHT-40'), (1, 41, 'White', 20, 'NIKE-AM90-WHT-41'),
(1, 42, 'White', 18, 'NIKE-AM90-WHT-42'), (1, 43, 'White', 12, 'NIKE-AM90-WHT-43'),
(1, 44, 'White', 8,  'NIKE-AM90-WHT-44'), (1, 45, 'White', 5,  'NIKE-AM90-WHT-45'),
(1, 40, 'Black', 10, 'NIKE-AM90-BLK-40'), (1, 41, 'Black', 14, 'NIKE-AM90-BLK-41'),
(1, 42, 'Black', 3,  'NIKE-AM90-BLK-42'), (1, 43, 'Black', 9,  'NIKE-AM90-BLK-43'),
(1, 44, 'Black', 11, 'NIKE-AM90-BLK-44'), (1, 45, 'Black', 6,  'NIKE-AM90-BLK-45');

-- Product 2: Adidas Stan Smith — White/Green & White/Navy
INSERT INTO product_variants (product_id, size, color, stock, sku) VALUES
(2, 40, 'White/Green', 20, 'ADI-SS-WG-40'), (2, 41, 'White/Green', 25, 'ADI-SS-WG-41'),
(2, 42, 'White/Green', 18, 'ADI-SS-WG-42'), (2, 43, 'White/Green', 14, 'ADI-SS-WG-43'),
(2, 44, 'White/Green', 9,  'ADI-SS-WG-44'), (2, 45, 'White/Green', 4,  'ADI-SS-WG-45'),
(2, 40, 'White/Navy', 12, 'ADI-SS-WN-40'),  (2, 41, 'White/Navy', 16, 'ADI-SS-WN-41'),
(2, 42, 'White/Navy', 5,  'ADI-SS-WN-42'),  (2, 43, 'White/Navy', 8,  'ADI-SS-WN-43'),
(2, 44, 'White/Navy', 11, 'ADI-SS-WN-44'),  (2, 45, 'White/Navy', 3,  'ADI-SS-WN-45');

-- Product 3: Reebok Zig Kinetica 3 — White/Grey & White/Coral
INSERT INTO product_variants (product_id, size, color, stock, sku) VALUES
(3, 40, 'White/Grey', 8, 'RBK-ZK3-WG-40'),   (3, 41, 'White/Grey', 2, 'RBK-ZK3-WG-41'),
(3, 42, 'White/Grey', 6, 'RBK-ZK3-WG-42'),   (3, 43, 'White/Grey', 10, 'RBK-ZK3-WG-43'),
(3, 44, 'White/Grey', 7, 'RBK-ZK3-WG-44'),   (3, 45, 'White/Grey', 3,  'RBK-ZK3-WG-45'),
(3, 40, 'White/Coral', 5, 'RBK-ZK3-WC-40'),  (3, 41, 'White/Coral', 9, 'RBK-ZK3-WC-41'),
(3, 42, 'White/Coral', 4, 'RBK-ZK3-WC-42'),  (3, 43, 'White/Coral', 12, 'RBK-ZK3-WC-43'),
(3, 44, 'White/Coral', 1, 'RBK-ZK3-WC-44'),  (3, 45, 'White/Coral', 6,  'RBK-ZK3-WC-45');

-- Product 4: New Balance 880 v13 — Grey & Navy
INSERT INTO product_variants (product_id, size, color, stock, sku) VALUES
(4, 40, 'Grey', 12, 'NB-880-GRY-40'), (4, 41, 'Grey', 18, 'NB-880-GRY-41'),
(4, 42, 'Grey', 15, 'NB-880-GRY-42'), (4, 43, 'Grey', 10, 'NB-880-GRY-43'),
(4, 44, 'Grey', 6,  'NB-880-GRY-44'), (4, 45, 'Grey', 4,  'NB-880-GRY-45'),
(4, 40, 'Navy', 8,  'NB-880-NVY-40'), (4, 41, 'Navy', 11, 'NB-880-NVY-41'),
(4, 42, 'Navy', 9,  'NB-880-NVY-42'), (4, 43, 'Navy', 5,  'NB-880-NVY-43'),
(4, 44, 'Navy', 13, 'NB-880-NVY-44'), (4, 45, 'Navy', 7,  'NB-880-NVY-45');

-- Product 5: ASICS Gel-Lyte III OG — Cream & Sage
INSERT INTO product_variants (product_id, size, color, stock, sku) VALUES
(5, 40, 'Cream', 10, 'ASC-GL3-CRM-40'), (5, 41, 'Cream', 8,  'ASC-GL3-CRM-41'),
(5, 42, 'Cream', 14, 'ASC-GL3-CRM-42'), (5, 43, 'Cream', 6,  'ASC-GL3-CRM-43'),
(5, 44, 'Cream', 9,  'ASC-GL3-CRM-44'), (5, 45, 'Cream', 3,  'ASC-GL3-CRM-45'),
(5, 40, 'Sage',  7,  'ASC-GL3-SAG-40'), (5, 41, 'Sage',  12, 'ASC-GL3-SAG-41'),
(5, 42, 'Sage',  5,  'ASC-GL3-SAG-42'), (5, 43, 'Sage',  8,  'ASC-GL3-SAG-43'),
(5, 44, 'Sage',  11, 'ASC-GL3-SAG-44'), (5, 45, 'Sage',  4,  'ASC-GL3-SAG-45');

-- Product 6: Puma RS-X Efekt — White/Blue & Black/Red
INSERT INTO product_variants (product_id, size, color, stock, sku) VALUES
(6, 40, 'White/Blue', 9,  'PUM-RSX-WB-40'), (6, 41, 'White/Blue', 15, 'PUM-RSX-WB-41'),
(6, 42, 'White/Blue', 11, 'PUM-RSX-WB-42'), (6, 43, 'White/Blue', 7,  'PUM-RSX-WB-43'),
(6, 44, 'White/Blue', 13, 'PUM-RSX-WB-44'), (6, 45, 'White/Blue', 5,  'PUM-RSX-WB-45'),
(6, 40, 'Black/Red', 6,   'PUM-RSX-BR-40'), (6, 41, 'Black/Red', 8,   'PUM-RSX-BR-41'),
(6, 42, 'Black/Red', 4,   'PUM-RSX-BR-42'), (6, 43, 'Black/Red', 10,  'PUM-RSX-BR-43'),
(6, 44, 'Black/Red', 7,   'PUM-RSX-BR-44'), (6, 45, 'Black/Red', 2,   'PUM-RSX-BR-45');

-- Product 7: Vans Old Skool Pro — Black/White & Checkerboard
INSERT INTO product_variants (product_id, size, color, stock, sku) VALUES
(7, 40, 'Black/White', 20, 'VNS-OSP-BW-40'), (7, 41, 'Black/White', 25, 'VNS-OSP-BW-41'),
(7, 42, 'Black/White', 18, 'VNS-OSP-BW-42'), (7, 43, 'Black/White', 15, 'VNS-OSP-BW-43'),
(7, 44, 'Black/White', 10, 'VNS-OSP-BW-44'), (7, 45, 'Black/White', 8,  'VNS-OSP-BW-45'),
(7, 40, 'Checkerboard', 8,  'VNS-OSP-CHK-40'),(7, 41, 'Checkerboard', 12, 'VNS-OSP-CHK-41'),
(7, 42, 'Checkerboard', 6,  'VNS-OSP-CHK-42'),(7, 43, 'Checkerboard', 9,  'VNS-OSP-CHK-43'),
(7, 44, 'Checkerboard', 14, 'VNS-OSP-CHK-44'),(7, 45, 'Checkerboard', 4,  'VNS-OSP-CHK-45');

-- Product 8: Converse Chuck 70 Hi — Natural Ivory & Classic Black
INSERT INTO product_variants (product_id, size, color, stock, sku) VALUES
(8, 40, 'Ivory', 15, 'CVS-C70-IVR-40'), (8, 41, 'Ivory', 20, 'CVS-C70-IVR-41'),
(8, 42, 'Ivory', 12, 'CVS-C70-IVR-42'), (8, 43, 'Ivory', 8,  'CVS-C70-IVR-43'),
(8, 44, 'Ivory', 10, 'CVS-C70-IVR-44'), (8, 45, 'Ivory', 5,  'CVS-C70-IVR-45'),
(8, 40, 'Black', 18, 'CVS-C70-BLK-40'), (8, 41, 'Black', 22, 'CVS-C70-BLK-41'),
(8, 42, 'Black', 9,  'CVS-C70-BLK-42'), (8, 43, 'Black', 14, 'CVS-C70-BLK-43'),
(8, 44, 'Black', 7,  'CVS-C70-BLK-44'), (8, 45, 'Black', 3,  'CVS-C70-BLK-45');
