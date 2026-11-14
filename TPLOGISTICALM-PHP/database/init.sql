CREATE DATABASE IF NOT EXISTS tplogisticalm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tplogisticalm;

CREATE TABLE vehicles (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  model VARCHAR(120) NOT NULL,
  pbv_kg DECIMAL(12,2) NOT NULL,
  tare_kg DECIMAL(12,2) NOT NULL,
  volume_m3 DECIMAL(12,3) NOT NULL
);
CREATE TABLE packages (
  code VARCHAR(40) PRIMARY KEY,
  sender VARCHAR(100) NOT NULL,
  recipient VARCHAR(100) NOT NULL,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  description VARCHAR(120) NOT NULL,
  weight_kg DECIMAL(12,2) NOT NULL,
  length_m DECIMAL(10,3) NOT NULL,
  width_m DECIMAL(10,3) NOT NULL,
  height_m DECIMAL(10,3) NOT NULL,
  volume_m3 DECIMAL(12,4) NOT NULL,
  status VARCHAR(30) NOT NULL,
  received_at DATETIME NOT NULL,
  trip_id VARCHAR(40) NULL
);
CREATE TABLE trips (
  id VARCHAR(40) PRIMARY KEY,
  vehicle_id VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_trip_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);
CREATE TABLE trip_packages (
  trip_id VARCHAR(40) NOT NULL,
  package_code VARCHAR(40) NOT NULL,
  PRIMARY KEY (trip_id, package_code),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (package_code) REFERENCES packages(code) ON DELETE CASCADE
);
CREATE TABLE package_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  package_code VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL,
  note VARCHAR(255) NOT NULL,
  happened_at DATETIME NOT NULL,
  FOREIGN KEY (package_code) REFERENCES packages(code) ON DELETE CASCADE
);

INSERT INTO vehicles VALUES
('camion-a','Camión A','Camión liviano','Mercedes Accelo',220000,8000,40),
('camion-b','Camión B','Camión liviano','Mercedes Atego',18000,6000,30),
('camion-c','Camión C','Camión liviano','Mercedes Accelo',26000,9500,50);
INSERT INTO packages VALUES
('TLS-261114-A001','Depósito Sur','Sucursal Centro','Buenos Aires','La Plata','Caja A · repuestos',50,1.2,0.8,0.6,0.576,'En depósito','2026-11-14 09:15:00',NULL),
('TLS-261114-B002','Distribuidora Norte','Comercio San Martín','Buenos Aires','San Martín','Caja B · mercadería',120,2,1,1,2,'En depósito','2026-11-14 10:30:00',NULL),
('TLS-261114-C003','Taller Central','Cliente particular','Buenos Aires','Avellaneda','Caja C · piezas',10,0.5,0.5,0.5,0.125,'En depósito','2026-11-14 11:10:00',NULL),
('TLS-261113-D004','Casa del Hogar','Micaela Ruiz','Buenos Aires','Luján','Paquete de muestra',8,0.6,0.5,0.4,0.12,'En viaje','2026-11-13 14:20:00','V-024'),
('TLS-261112-E005','Librería del Parque','Biblioteca Oeste','Buenos Aires','Moreno','Libros',3,0.3,0.3,0.3,0.027,'Entregado','2026-11-12 08:40:00',NULL);
INSERT INTO trips VALUES ('V-024','camion-c','En curso','2026-11-13 16:00:00');
INSERT INTO trip_packages VALUES ('V-024','TLS-261113-D004');
INSERT INTO package_history (package_code,status,note,happened_at) VALUES
('TLS-261114-A001','En depósito','Paquete recibido en origen.','2026-11-14 09:15:00'),
('TLS-261114-B002','En depósito','Paquete recibido en origen.','2026-11-14 10:30:00'),
('TLS-261114-C003','En depósito','Paquete recibido en origen.','2026-11-14 11:10:00'),
('TLS-261113-D004','En viaje','Asignado al viaje V-024 con Camión C.','2026-11-13 16:00:00'),
('TLS-261113-D004','En depósito','Paquete recibido en origen.','2026-11-13 14:20:00'),
('TLS-261112-E005','Entregado','Entrega confirmada en destino.','2026-11-12 15:30:00'),
('TLS-261112-E005','En viaje','Paquete salió a distribución.','2026-11-12 11:00:00'),
('TLS-261112-E005','En depósito','Paquete recibido en origen.','2026-11-12 08:40:00');

CREATE TABLE IF NOT EXISTS web_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(40) UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  address_line1 VARCHAR(180) NOT NULL,
  address_line2 VARCHAR(180) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL,
  country VARCHAR(80) NOT NULL,
  postal_code VARCHAR(30) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Recibido',
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS web_order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT NOT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(120) NOT NULL DEFAULT '',
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_web_order_item_order FOREIGN KEY (order_id) REFERENCES web_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
