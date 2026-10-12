-- ==========================================================
-- CHERAN SOFT GOODS - SEED DATA: SUPPLIERS / VENDORS
-- ==========================================================

-- 1. Ensure phone column can hold longer numbers / multiple contact numbers
ALTER TABLE suppliers MODIFY COLUMN phone VARCHAR(100) NOT NULL DEFAULT 'N/A';

-- 2. Insert Suppliers / Vendors
INSERT INTO suppliers (code, name, contact_person, phone, email, address, gstin, payment_terms_days, status) VALUES

-- ----------------------------------------------------------
-- YARN SUPPLIERS
-- ----------------------------------------------------------
('VEND-YARN-001', 'Lakshmi Textiles Mills', NULL, 'N/A', NULL, 'D.No. 10/37, SF No. 512, Periya vadugapatti Vennamalai Post, Karur – 639006', NULL, 30, 'active'),
('VEND-YARN-002', 'Skywin Impex', NULL, 'N/A', NULL, '33/5, Vivekanantha street, RSR Building Near, Sangeetha theatre Surampatti, Erode - 638009', NULL, 30, 'active'),
('VEND-YARN-003', 'S.S.V Textile Exim Pvt. Ltd.', NULL, 'N/A', NULL, 'S.F.NO. 416/6, Iyappa Nagar, Thaneerpandal, Peelmedu, Coimbatore - 641004', NULL, 30, 'active'),
('VEND-YARN-004', 'Kailash International', NULL, 'N/A', NULL, '47A, J.G. Nagar, 2nd Street, 60 Feet Road, Tirupur - 641602', NULL, 30, 'active'),
('VEND-YARN-005', 'Shri Senthur Textile Mills', NULL, 'N/A', NULL, 'Sf No; 601,602, West Street, Palllapalayam (po),Mangalam , Tirupur-641663', NULL, 30, 'active'),

-- ----------------------------------------------------------
-- FABRIC PROCESSING (DYEING & PRINTING)
-- ----------------------------------------------------------
('VEND-DYE-001', 'Allied Textiles', NULL, '9843054566', NULL, 'No.5, Kamadenunagar, Pugalur Road, karur-639001', NULL, 30, 'active'),
('VEND-DYE-002', 'Maxima Tex process Mill', NULL, '7397752199', NULL, 'S.F No. 228/2,232/1, Thaneerpandal Pudur, Punnamchatram (Po), Erode Mani Road, Karur 639163', NULL, 30, 'active'),
('VEND-DYE-003', 'Wintex Processing Mills', NULL, '04288-240219', NULL, '165,R.S. Road Pallipalayam Kumarapalayam, Namakkal DT', NULL, 30, 'active'),
('VEND-DYE-004', 'Sri Vedha Mill', NULL, '9047025261', NULL, 'Near Eleiyathaal Kovil Nasiyanur Road, vallarasampatti (po), Erode', NULL, 30, 'active'),
('VEND-DYE-005', 'M.R.C. Mills Pvt. Ltd.', NULL, '98426 42799', NULL, '9/1, Chinnandan kovil Road Near Water Pumping Station, Karur – 639 001', NULL, 30, 'active'),
('VEND-DYE-006', 'Sri Jothi Colours', NULL, '9659059449', NULL, 'New Bye Pass Road Sukkaliur South, Karur - 639003', NULL, 30, 'active'),
('VEND-DYE-007', 'Sri Vinayaga Mills', NULL, '98435 07766', NULL, 'R.S.NO 63,45/1,45/3, Kovilkadu, Sadayamplayam,Gandhipuram Village, Chitode-638102. erode', NULL, 30, 'active'),
('VEND-DYE-008', 'Sri Sivaperumal Dyeing', NULL, '9751769482', NULL, '1/176/A, S.n.Nagar, Near Primary Health Centre, Karupanpalayam, Karur – 639003', NULL, 30, 'active'),
('VEND-DYE-009', 'Arasi Colors', NULL, '9843055188', NULL, 'Othaiyur Road, T.sellandipalayam, Karur - 3', NULL, 30, 'active'),
('VEND-DYE-010', 'Anantha screen printer', NULL, '9894182486', NULL, '63, Devarankandu, Sathyamoorthy Nagar Veerappanchatram, Erode – 638 004', NULL, 30, 'active'),
('VEND-DYE-011', 'Balaji Print', NULL, '9994666199', NULL, '2E/ 136, Main Street, Tirumurugan Poondi Avinashi, Tirupur – 641 652', NULL, 30, 'active'),

-- ----------------------------------------------------------
-- PACKING MATERIAL & ACCESSORIES
-- ----------------------------------------------------------
('VEND-PACK-001', 'Sara Enterprises', NULL, '9843046613', NULL, '4th cross, Vaiyapuri Nagar, Karur - 2', NULL, 30, 'active'),
('VEND-PACK-002', 'Sri Malayamman Packers', NULL, '9944405153', NULL, '180/1, B Jagan Complex, Chinna Kongu West Side, Kamarajapuram West, Karur- 639002', NULL, 30, 'active'),
('VEND-PACK-003', 'Top Light Trims Pvt Ltd', 'Mr. Dharma lingam', '0421 – 2217136 / 94440 – 89711', NULL, '7-B, Top Light Building, Palladam Road, Tirupur – 641 604', NULL, 30, 'active'),
('VEND-PACK-004', 'Nava Sathi pack', NULL, '9443255826', NULL, '82 A, Arikamapalayam main Road, LNS Post, Karur', NULL, 30, 'active'),
('VEND-PACK-005', 'Janaksons', NULL, '0421-4212500', NULL, '89-A, Amarjothi Garden,3rd Street, Opp. DSK Hospital, Kangayam road Tirupur - 641604', NULL, 30, 'active'),
('VEND-PACK-006', 'The Classic Polybag', NULL, '9364636303 / 9791616420', NULL, 'No: 551, Tamil Nagar west, Andankovil East, Covai road, Karur 639 008', NULL, 30, 'active'),
('VEND-PACK-007', 'Nisha Graphics', NULL, '99949 33779 / 9940724444', NULL, 'No.390/1,2 LNS Village, Sengunthapuram post, 12th cross corner, Karur 2', NULL, 30, 'active'),
('VEND-PACK-008', 'ARTT Textiles', NULL, '9894632279 / 9894632297', NULL, '5/1, Nethaji Nagar, 1st Cross, New Pallipalayam Road, Komarapalayam - 638183', NULL, 30, 'active'),
('VEND-PACK-009', 'ARS Insulation', NULL, '9884443479', NULL, 'Plot No 6, VOC Street, Bharathi Nagar, Gerugampakkam, Porur, Chennai - 600122', NULL, 30, 'active'),
('VEND-PACK-010', 'M/S, Shyam Processing Unit', NULL, '9981131771 / 9595622365', NULL, 'Shadevpalli, Raidarh (c.g), 496001', NULL, 30, 'active'),
('VEND-PACK-011', 'Vanya Fashion Jewellery', NULL, 'N/A', NULL, '3230A, Basement & GF, Near B1 Block, Gurgaon – 122003 Haryana', NULL, 30, 'active'),
('VEND-PACK-012', 'B.B.G AGRO Service', NULL, '9842750409', NULL, '16, Rajaji Street, Gobi Chettipalayam- 638452', NULL, 30, 'active'),
('VEND-PACK-013', 'C.S TERAEDERES', NULL, '9443161285', NULL, 'NO. 6, Gandhi Salai South, Narathagana Saba Road, Karur – 639 001.', NULL, 30, 'active'),
('VEND-PACK-014', 'Sivasidh Packs', NULL, '9843507766', NULL, '14 C, Mettukadai Kodumudi Road, Muthur, Tirupur', NULL, 30, 'active'),
('VEND-PACK-015', 'Vijay Packs', NULL, '9894665652', NULL, '488/6,Selva Nagar,Andankovil(po), Karur - 639008', NULL, 30, 'active'),

-- ----------------------------------------------------------
-- WEAVING
-- ----------------------------------------------------------
('VEND-WEAV-001', 'Sri Vinayagar Tex', NULL, '9788872276', NULL, NULL, NULL, 30, 'active'),
('VEND-WEAV-002', 'Aart tex', NULL, 'N/A', NULL, NULL, NULL, 30, 'active'),
('VEND-WEAV-003', 'Raju Tex', NULL, 'N/A', NULL, NULL, NULL, 30, 'active')

ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    contact_person = VALUES(contact_person),
    phone = VALUES(phone),
    email = VALUES(email),
    address = VALUES(address),
    gstin = VALUES(gstin),
    payment_terms_days = VALUES(payment_terms_days),
    status = VALUES(status);
