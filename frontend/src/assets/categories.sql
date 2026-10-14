-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Oct 14, 2026 at 11:14 AM
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
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `code`, `type`, `description`, `status`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 'WEAVING ORDER', 'CAT_WEAVING_ORDER', 'order', 'Loom weaving production order with design and sizing specifications', 'active', 1, '2026-10-08 10:12:10', '2026-10-08 10:12:10'),
(2, 'FABRIC WEAVING PROCESS ORDER', 'CAT_FABRIC_WEAVING_PROC', 'order', 'Fabric weaving job work and conversion work order', 'active', 2, '2026-10-08 10:12:10', '2026-10-08 10:12:10'),
(3, 'FABRIC DYEING PROCESS ORDER', 'CAT_FABRIC_DYEING_PROC', 'order', 'Yarn or grey fabric dyeing and wet processing work order', 'active', 3, '2026-10-08 10:12:10', '2026-10-08 10:12:10'),
(4, 'FABRIC 2 SIDE KITTY REMOVE AND JIGGAR PROCESS ORDER', 'CAT_FABRIC_KITTY_JIGGAR', 'order', 'Fabric kitty removal and jigger scouring process work order', 'active', 4, '2026-10-08 10:12:10', '2026-10-08 10:12:10'),
(5, 'FILLING ORDER', 'CAT_FILLING_ORDER', 'order', 'Cushion/pillow fiber and polyfill filling production order', 'active', 5, '2026-10-08 10:12:10', '2026-10-08 10:12:10'),
(6, 'FABRIC PURCHASE ORDER', 'CAT_FABRIC_PO', 'order', 'Raw grey and finished fabric procurement purchase order', 'active', 6, '2026-10-08 10:12:10', '2026-10-08 10:12:10'),
(7, 'STICHING ORDER', 'CAT_STITCHING_ORDER', 'order', 'Cutting and stitching production order with sizing/color breakups', 'active', 7, '2026-10-08 10:12:10', '2026-10-08 10:12:10'),
(8, 'ACCESSORY PURCHASE ORDER', 'CAT_ACCESSORY_PO', 'order', 'Zippers, buttons, sewing threads, wash care labels and packing trims PO', 'active', 8, '2026-10-08 10:12:10', '2026-10-08 10:12:10');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
