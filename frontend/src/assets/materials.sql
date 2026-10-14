-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Oct 14, 2026 at 10:56 AM
-- Server version: 11.8.9-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u868013330_cheran`
--

-- --------------------------------------------------------

--
-- Table structure for table `materials`
--

CREATE TABLE `materials` (
  `id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `uom` varchar(20) NOT NULL DEFAULT 'KG',
  `purchase_rate` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_percent` decimal(5,2) NOT NULL DEFAULT 5.00,
  `min_stock_level` decimal(12,2) NOT NULL DEFAULT 0.00,
  `current_stock` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumping data for table `materials`
--

INSERT INTO `materials` (`id`, `category_id`, `supplier_id`, `code`, `name`, `uom`, `purchase_rate`, `tax_percent`, `min_stock_level`, `current_stock`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(86, 21, 1, 'MAT-FAB-001', 'Cotton Fabric', 'MTR', 160.00, 5.00, 200.00, 6.00, 'active', '2026-10-08 07:46:14', '2026-10-12 09:35:14', NULL),
(87, 21, 1, 'MAT-FAB-002', 'Linen Fabric', 'MTR', 320.00, 5.00, 100.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(88, 21, 1, 'MAT-FAB-003', 'Velvet Fabric', 'MTR', 280.00, 5.00, 80.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(89, 21, 1, 'MAT-FAB-004', 'Canvas Fabric', 'MTR', 210.00, 5.00, 150.00, 80.00, 'active', '2026-10-08 07:46:14', '2026-10-13 05:55:19', NULL),
(90, 22, 3, 'MAT-SEW-001', 'Sewing Thread', 'CONE', 65.00, 12.00, 50.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(91, 22, 3, 'MAT-SEW-002', 'Overlock Thread', 'CONE', 55.00, 12.00, 40.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(92, 22, 3, 'MAT-SEW-003', 'Elastic', 'MTR', 8.50, 12.00, 300.00, 17.00, 'active', '2026-10-08 07:46:14', '2026-10-12 09:35:14', NULL),
(93, 22, 3, 'MAT-SEW-004', 'Zipper', 'PCS', 12.00, 18.00, 500.00, 2000.00, 'active', '2026-10-08 07:46:14', '2026-10-12 10:18:19', NULL),
(94, 22, 3, 'MAT-SEW-005', 'Velcro', 'MTR', 15.00, 12.00, 100.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(95, 22, 3, 'MAT-SEW-006', 'Rope', 'MTR', 18.00, 12.00, 150.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(96, 23, 3, 'MAT-PKG-001', 'Main Label', 'PCS', 2.20, 12.00, 2000.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(97, 23, 3, 'MAT-PKG-002', 'Size Label', 'PCS', 1.10, 12.00, 2000.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(98, 23, 3, 'MAT-PKG-003', 'Care Label', 'PCS', 1.50, 12.00, 2000.00, 5.00, 'active', '2026-10-08 07:46:14', '2026-10-13 05:55:19', NULL),
(99, 23, 3, 'MAT-PKG-004', 'Hang Tag', 'PCS', 3.50, 12.00, 1000.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(100, 23, 3, 'MAT-PKG-005', 'Barcode Sticker', 'PCS', 0.75, 12.00, 3000.00, 35.00, 'active', '2026-10-08 07:46:14', '2026-10-12 11:52:35', NULL),
(101, 23, 3, 'MAT-PKG-006', 'Poly Bag', 'PCS', 4.20, 18.00, 1500.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(102, 23, 3, 'MAT-PKG-007', 'Carton Box', 'BOX', 48.00, 18.00, 100.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(103, 23, 3, 'MAT-PKG-008', 'Packing Tape', 'ROLL', 65.00, 18.00, 25.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(104, 24, 3, 'MAT-ACC-001', 'Button', 'PCS', 1.80, 18.00, 2500.00, 400.00, 'active', '2026-10-08 07:46:14', '2026-10-13 05:55:19', NULL),
(105, 24, 3, 'MAT-ACC-002', 'Buckle', 'PCS', 8.50, 18.00, 300.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(106, 24, 3, 'MAT-ACC-003', 'Eyelet', 'PCS', 0.60, 18.00, 3000.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(107, 24, 3, 'MAT-ACC-004', 'Rivet', 'PCS', 0.85, 18.00, 3000.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(108, 24, 3, 'MAT-ACC-005', 'Foam', 'MTR', 95.00, 18.00, 80.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(109, 24, 3, 'MAT-ACC-006', 'Eva Foam', 'MTR', 140.00, 18.00, 60.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(110, 25, 2, 'MAT-FIL-001', 'Polyester Fiber', 'KG', 93.00, 18.00, 250.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-12 12:23:22', NULL),
(111, 25, 2, 'MAT-FIL-002', 'Kapok', 'KG', 230.00, 5.00, 100.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(112, 25, 2, 'MAT-FIL-003', 'Cotton Filling', 'KG', 110.00, 5.00, 200.00, 0.00, 'active', '2026-10-08 07:46:14', '2026-10-08 07:46:14', NULL),
(113, 1, NULL, 'MAT-TEST-79777', 'Temporary Test Material for Deletion - EDITED NAME', 'MTR', 220.00, 12.00, 50.00, 0.00, 'active', '2026-10-12 10:58:22', '2026-10-12 10:58:22', NULL),
(114, 1, NULL, 'MAT-DEL-23210', 'Delete Test Item', 'KG', 100.00, 5.00, 0.00, 0.00, 'active', '2026-10-12 11:37:30', '2026-10-12 11:37:32', '2026-10-12 11:37:32'),
(115, 1, NULL, 'MAT-DEL-22247', 'Delete Test Item', 'KG', 100.00, 5.00, 0.00, 0.00, 'active', '2026-10-12 11:43:14', '2026-10-12 11:43:14', NULL),
(116, 1, NULL, 'MAT-TEST-67501', 'Temporary Test Material for Deletion - EDITED NAME', 'MTR', 220.00, 12.00, 50.00, 0.00, 'active', '2026-10-12 11:44:27', '2026-10-12 11:44:28', '2026-10-12 11:44:28'),
(117, 1, NULL, 'MAT-TEST-24987', 'Temporary Test Material for Deletion - EDITED NAME', 'MTR', 220.00, 12.00, 50.00, 0.00, 'active', '2026-10-12 11:52:32', '2026-10-12 11:52:33', '2026-10-12 11:52:33');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `materials`
--
ALTER TABLE `materials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `category_id` (`category_id`),
  ADD KEY `supplier_id` (`supplier_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `materials`
--
ALTER TABLE `materials`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=118;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `materials`
--
ALTER TABLE `materials`
  ADD CONSTRAINT `materials_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  ADD CONSTRAINT `materials_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
