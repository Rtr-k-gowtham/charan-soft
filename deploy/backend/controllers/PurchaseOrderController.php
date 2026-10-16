<?php
// backend/controllers/PurchaseOrderController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class PurchaseOrderController {
    private function enrichPaymentStatus(array &$po): void {
        $payable = round((float)($po['net_amount'] ?? 0), 2);
        $paid = round((float)($po['paid_amount'] ?? 0), 2);
        $balance = round(max(0.0, $payable - $paid), 2);
        $po['balance_amount'] = $balance;
        $dueDate = !empty($po['payment_due_date']) ? $po['payment_due_date'] : null;
        $today = date('Y-m-d');

        if ($balance <= 0.01 && $payable > 0) {
            $po['payment_status'] = 'Settled';
        } elseif (!empty($dueDate) && $dueDate !== '0000-00-00' && $dueDate < $today && $balance > 0.01) {
            $po['payment_status'] = 'Overdue';
        } elseif ($paid > 0.01 && $balance > 0.01) {
            $po['payment_status'] = 'Partially Paid';
        } else {
            $po['payment_status'] = 'Unpaid';
        }
    }

    public function index(): void {
        try {
            $pdo = Database::getConnection();
            try {
                $pdo->exec("ALTER TABLE purchase_orders ADD COLUMN production_order_id INT NULL");
            } catch (Exception $alterEx) {}

            $stmt = $pdo->query("
                SELECT po.*, 
                       c.name as category_name, 
                       s.name as supplier_name, 
                       s.code as supplier_code,
                       s.phone as supplier_phone,
                       s.email as supplier_email,
                       s.address as supplier_address,
                       s.contact_person as supplier_contact,
                       s.gstin as supplier_gstin,
                       pro.order_number as production_order_number,
                       pro.title as production_order_title
                FROM purchase_orders po
                LEFT JOIN categories c ON po.category_id = c.id
                LEFT JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN production_orders pro ON po.production_order_id = pro.id
                WHERE po.deleted_at IS NULL
                ORDER BY po.id DESC
            ");
            $orders = $stmt->fetchAll();

            foreach ($orders as &$po) {
                $st = strtolower(trim((string)($po['status'] ?? '')));
                $po['status'] = ($st === 'draft') ? 'Draft' : 'Ordered';
                try {
                    $iStmt = $pdo->prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id ASC");
                    $iStmt->execute([$po['id']]);
                    $items = $iStmt->fetchAll();
                    foreach ($items as &$poi) {
                        if (!empty($poi['dynamic_data'])) {
                            $dyn = json_decode($poi['dynamic_data'], true);
                            if (is_array($dyn)) {
                                $poi = array_merge($dyn, $poi);
                            }
                        }
                        if (empty($poi['accessory_name']) && !empty($poi['item_description'])) {
                            $poi['accessory_name'] = $poi['item_description'];
                        }
                        if (empty($poi['item_description']) && !empty($poi['accessory_name'])) {
                            $poi['item_description'] = $poi['accessory_name'];
                        }
                        if (!empty($poi['item_description'])) {
                            $poi['item_description'] = trim(preg_replace('/\s*\[[A-Za-z0-9_-]+\]\s*/', ' ', (string)$poi['item_description']));
                        }
                        if (!empty($poi['accessory_name'])) {
                            $poi['accessory_name'] = trim(preg_replace('/\s*\[[A-Za-z0-9_-]+\]\s*/', ' ', (string)$poi['accessory_name']));
                        }
                        if (!empty($poi['description'])) {
                            $poi['description'] = trim(preg_replace('/\s*\[[A-Za-z0-9_-]+\]\s*/', ' ', (string)$poi['description']));
                        }
                    }
                    $po['items'] = $items;
                } catch (Exception $ie) {
                    $po['items'] = [];
                }

                try {
                    $pStmt = $pdo->prepare("SELECT * FROM purchase_payments WHERE purchase_order_id = ? ORDER BY id DESC");
                    $pStmt->execute([$po['id']]);
                    $po['payments'] = $pStmt->fetchAll();
                } catch (Exception $pe) {
                    $po['payments'] = [];
                }

                try {
                    $rStmt = $pdo->prepare("SELECT * FROM purchase_receipts WHERE purchase_order_id = ? ORDER BY id DESC");
                    $rStmt->execute([$po['id']]);
                    $po['receipts'] = $rStmt->fetchAll();
                } catch (Exception $re) {
                    $po['receipts'] = [];
                }

                $this->enrichPaymentStatus($po);
            }

            Response::success($orders);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $categoryId = (int)($data['category_id'] ?? 0);
        $supplierId = (int)($data['supplier_id'] ?? 0);
        $items = $data['items'] ?? [];

        if (empty($items)) {
            Response::error("At least one item line is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Auto-fallback category if missing or zero
            if (!$categoryId) {
                $cRow = $pdo->query("SELECT id FROM categories WHERE (status = 'active' OR status IS NULL) ORDER BY sort_order ASC, id ASC LIMIT 1")->fetch();
                if ($cRow) {
                    $categoryId = (int)$cRow['id'];
                } else {
                    $cRow2 = $pdo->query("SELECT id FROM categories ORDER BY id ASC LIMIT 1")->fetch();
                    if ($cRow2) $categoryId = (int)$cRow2['id'];
                }
            }

            // Auto-fallback supplier if missing or zero
            if (!$supplierId) {
                $sRow = $pdo->query("SELECT id FROM suppliers ORDER BY id ASC LIMIT 1")->fetch();
                if ($sRow) {
                    $supplierId = (int)$sRow['id'];
                } else {
                    // Create default general supplier if none exist
                    $pdo->query("INSERT INTO suppliers (name, contact_person, phone, email, address, status) VALUES ('General Supplier', 'Manager', '9876543210', 'supplier@cheransoftgoods.in', 'Tirupur, Tamil Nadu', 'active')");
                    $supplierId = (int)$pdo->lastInsertId();
                }
            }
            $pdo->beginTransaction();

            // Ensure business timezone is set to Asia/Kolkata
            if (!date_default_timezone_get() || date_default_timezone_get() === 'UTC') {
                date_default_timezone_set('Asia/Kolkata');
            }

            $poDate = !empty($data['po_date']) ? $data['po_date'] : date('Y-m-d');
            $dueDate = $data['delivery_due_date'] ?? date('Y-m-d', strtotime('+15 days'));

            // Server-side calculation
            $subtotal = 0.0;
            $totalTax = 0.0;

            foreach ($items as &$item) {
                $qty = (float)($item['quantity'] ?? $item['qty'] ?? 0);
                $rate = (float)($item['rate'] ?? 0);
                $taxPct = (float)($item['tax_percent'] ?? 5.0);

                $taxable = round($qty * $rate, 2);
                $taxAmt = round($taxable * ($taxPct / 100), 2);
                $net = round($taxable + $taxAmt, 2);

                $item['_taxable'] = $taxable;
                $item['_tax_amount'] = $taxAmt;
                $item['_net'] = $net;

                $subtotal += $taxable;
                $totalTax += $taxAmt;
            }
            $netTotal = round($subtotal + $totalTax, 2);

            // Determine date prefix in DDMMYY format
            $dateParts = explode('-', $poDate);
            if (count($dateParts) === 3) {
                $yy = substr($dateParts[0], -2);
                $mm = str_pad($dateParts[1], 2, '0', STR_PAD_LEFT);
                $dd = str_pad($dateParts[2], 2, '0', STR_PAD_LEFT);
                $dateFormatted = $dd . $mm . $yy;
            } else {
                $dateFormatted = date('dmy', strtotime($poDate) ?: time());
            }
            $prefix = 'PO-' . $dateFormatted . '-';

            // Dynamically detect existing columns in purchase_orders to prevent schema mismatch
            $poCols = $pdo->query("DESCRIBE purchase_orders")->fetchAll(PDO::FETCH_COLUMN);

            $poId = null;
            $poNumber = null;
            $maxAttempts = 5;

            for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
                // Lock and query highest sequence for this date prefix
                $seqStmt = $pdo->prepare("SELECT po_number FROM purchase_orders WHERE po_number LIKE :prefix ORDER BY id DESC FOR UPDATE");
                $seqStmt->execute([':prefix' => $prefix . '%']);
                $existingNumbers = $seqStmt->fetchAll(PDO::FETCH_COLUMN);

                $maxSeq = 0;
                foreach ($existingNumbers as $num) {
                    if (preg_match('/^PO-' . preg_quote($dateFormatted, '/') . '-(\d+)$/', $num, $matches)) {
                        $val = (int)$matches[1];
                        if ($val > $maxSeq) {
                            $maxSeq = $val;
                        }
                    }
                }

                $nextSeq = $maxSeq + 1;
                $poNumber = $prefix . str_pad((string)$nextSeq, 2, '0', STR_PAD_LEFT);

                // Per Task 3.B: Initial status of newly created purchase orders must strictly be Draft
                $poStatus = 'Draft';

                $poCandidates = [
                    'po_number' => $poNumber,
                    'production_order_id' => !empty($data['production_order_id']) ? (int)$data['production_order_id'] : null,
                    'category_id' => $categoryId,
                    'supplier_id' => $supplierId,
                    'po_date' => $poDate,
                    'delivery_due_date' => $dueDate,
                    'subtotal' => $subtotal,
                    'tax_amount' => $totalTax,
                    'net_amount' => $netTotal,
                    'paid_amount' => 0.00,
                    'balance_amount' => $netTotal,
                    'payment_status' => 'Not Paid',
                    'status' => $poStatus,
                    'remarks' => $data['remarks'] ?? null
                ];

                $insertPoCols = [];
                $insertPoPlaceholders = [];
                $insertPoParams = [];
                foreach ($poCandidates as $col => $val) {
                    if (in_array($col, $poCols)) {
                        $insertPoCols[] = "`$col`";
                        $insertPoPlaceholders[] = ":$col";
                        $insertPoParams[":$col"] = $val;
                    }
                }

                try {
                    $stmt = $pdo->prepare("INSERT INTO purchase_orders (" . implode(', ', $insertPoCols) . ") VALUES (" . implode(', ', $insertPoPlaceholders) . ")");
                    $stmt->execute($insertPoParams);
                    $poId = (int)$pdo->lastInsertId();
                    break;
                } catch (PDOException $ex) {
                    // In case of race condition triggering unique constraint (SQLSTATE 23000 / Error 1062)
                    if (($ex->getCode() == 23000 || ($ex->errorInfo[1] ?? 0) === 1062) && $attempt < $maxAttempts) {
                        continue;
                    }
                    throw $ex;
                }
            }

            // Dynamically detect existing columns in purchase_order_items
            $poiCols = $pdo->query("DESCRIBE purchase_order_items")->fetchAll(PDO::FETCH_COLUMN);

            foreach ($items as $idx => $it) {
                if (empty($it['order_no'])) {
                    $it['order_no'] = 'ORD-' . str_pad((string)($idx + 1), 3, '0', STR_PAD_LEFT);
                }
                $desc = $it['item_description'] ?? $it['description'] ?? $it['accessory_name'] ?? 'Textile Material';
                $desc = trim(preg_replace('/\s*\[[A-Za-z0-9_-]+\]\s*/', ' ', (string)$desc));
                if (empty($it['accessory_name']) && !empty($desc)) {
                    $it['accessory_name'] = $desc;
                }
                if (empty($it['item_description']) && !empty($desc)) {
                    $it['item_description'] = $desc;
                }
                $rowCandidates = [
                    'purchase_order_id' => $poId,
                    'material_id' => !empty($it['material_id']) ? (int)$it['material_id'] : null,
                    'line_number' => $idx + 1,
                    'order_no' => $it['order_no'],
                    'item_description' => $desc,
                    'description' => $desc,
                    'spec' => $it['spec'] ?? null,
                    'uom' => $it['uom'] ?? 'KG',
                    'quantity' => (float)($it['quantity'] ?? $it['qty'] ?? 0),
                    'weight_kg' => !empty($it['weight_kg']) ? (float)$it['weight_kg'] : null,
                    'received_quantity' => 0.00,
                    'rate' => (float)($it['rate'] ?? 0),
                    'taxable_amount' => $it['_taxable'] ?? 0,
                    'tax_percent' => (float)($it['tax_percent'] ?? 5.0),
                    'tax_amount' => $it['_tax_amount'] ?? 0,
                    'net_amount' => $it['_net'] ?? 0,
                    'dynamic_data' => json_encode($it)
                ];

                $rCols = [];
                $rPlaceholders = [];
                $rParams = [];
                foreach ($rowCandidates as $c => $v) {
                    if (in_array($c, $poiCols)) {
                        $rCols[] = "`$c`";
                        $rPlaceholders[] = "?";
                        $rParams[] = $v;
                    }
                }

                $itemStmt = $pdo->prepare("INSERT INTO purchase_order_items (" . implode(', ', $rCols) . ") VALUES (" . implode(', ', $rPlaceholders) . ")");
                $itemStmt->execute($rParams);
            }

            // If linked to a production order, auto-advance its items from Stage 1 to Stage 2 (PO)
            if (!empty($data['production_order_id'])) {
                try {
                    $pOrdId = (int)$data['production_order_id'];
                    $stgStmt = $pdo->query("SELECT id FROM production_stages WHERE code = 'PO' OR name LIKE '%Purchase Order%' ORDER BY sequence_order ASC LIMIT 1");
                    $poStageId = $stgStmt ? $stgStmt->fetchColumn() : null;
                    if ($poStageId) {
                        $updatePoi = $pdo->prepare("UPDATE production_order_items SET current_stage_id = ? WHERE production_order_id = ? AND (current_stage_id = 1 OR current_stage_id IN (SELECT id FROM production_stages WHERE sequence_order < 2))");
                        $updatePoi->execute([$poStageId, $pOrdId]);
                    }
                } catch (\Throwable $exIgnore) {
                    // Stage auto-advance non-fatal
                }
            }

            $pdo->commit();
            AuditLogger::log('PurchaseOrders', 'CREATE', $poId, null, ['po_number' => $poNumber, 'status' => $poStatus, 'net_amount' => $netTotal]);
            Response::success(['id' => $poId, 'po_number' => $poNumber, 'status' => $poStatus], "Purchase Order created successfully", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function update(int $poId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $data['items'] ?? [];

        if (empty($items)) {
            Response::error("At least one item line is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE");
            $stmt->execute([$poId]);
            $po = $stmt->fetch();

            if (!$po) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Purchase Order not found", 404);
                return;
            }

            $currentStatus = strtolower(trim((string)($po['status'] ?? '')));
            if ($currentStatus !== 'draft') {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Only Draft purchase orders can be edited. Ordered purchase orders are locked.", 422);
                return;
            }

            // Categories & Suppliers
            $categoryId = !empty($data['category_id']) ? (int)$data['category_id'] : (int)$po['category_id'];
            $supplierId = !empty($data['supplier_id']) ? (int)$data['supplier_id'] : (int)$po['supplier_id'];
            $poDate = !empty($data['po_date']) ? $data['po_date'] : $po['po_date'];
            $dueDate = !empty($data['delivery_due_date']) ? $data['delivery_due_date'] : $po['delivery_due_date'];
            $remarks = array_key_exists('remarks', $data) ? $data['remarks'] : $po['remarks'];

            // Server-side calculation
            $subtotal = 0.0;
            $totalTax = 0.0;

            foreach ($items as &$item) {
                $qty = (float)($item['quantity'] ?? $item['qty'] ?? 0);
                $rate = (float)($item['rate'] ?? 0);
                $taxPct = (float)($item['tax_percent'] ?? 5.0);

                $taxable = round($qty * $rate, 2);
                $taxAmt = round($taxable * ($taxPct / 100), 2);
                $net = round($taxable + $taxAmt, 2);

                $item['_taxable'] = $taxable;
                $item['_tax_amount'] = $taxAmt;
                $item['_net'] = $net;

                $subtotal += $taxable;
                $totalTax += $taxAmt;
            }
            $netTotal = round($subtotal + $totalTax, 2);
            $paidAmt = (float)($po['paid_amount'] ?? 0);
            $balanceAmt = round($netTotal - $paidAmt, 2);

            // Update purchase_orders table dynamically based on existing columns
            $poCols = $pdo->query("DESCRIBE purchase_orders")->fetchAll(PDO::FETCH_COLUMN);

            $updateCandidates = [
                'category_id' => $categoryId,
                'supplier_id' => $supplierId,
                'production_order_id' => array_key_exists('production_order_id', $data) ? (!empty($data['production_order_id']) ? (int)$data['production_order_id'] : null) : ($po['production_order_id'] ?? null),
                'po_date' => $poDate,
                'delivery_due_date' => $dueDate,
                'subtotal' => $subtotal,
                'tax_amount' => $totalTax,
                'net_amount' => $netTotal,
                'balance_amount' => $balanceAmt,
                'remarks' => $remarks
            ];

            $updateSets = [];
            $updateParams = [];
            foreach ($updateCandidates as $col => $val) {
                if (in_array($col, $poCols)) {
                    $updateSets[] = "`$col` = :$col";
                    $updateParams[":$col"] = $val;
                }
            }
            $updateParams[':po_id'] = $poId;

            if (!empty($updateSets)) {
                $upStmt = $pdo->prepare("UPDATE purchase_orders SET " . implode(', ', $updateSets) . " WHERE id = :po_id");
                $upStmt->execute($updateParams);
            }

            // Remove previous items and insert updated items
            $delStmt = $pdo->prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?");
            $delStmt->execute([$poId]);

            $poiCols = $pdo->query("DESCRIBE purchase_order_items")->fetchAll(PDO::FETCH_COLUMN);

            foreach ($items as $idx => $it) {
                if (empty($it['order_no'])) {
                    $it['order_no'] = 'ORD-' . str_pad((string)($idx + 1), 3, '0', STR_PAD_LEFT);
                }
                $desc = $it['item_description'] ?? $it['description'] ?? $it['accessory_name'] ?? 'Textile Material';
                $desc = trim(preg_replace('/\s*\[[A-Za-z0-9_-]+\]\s*/', ' ', (string)$desc));
                if (empty($it['accessory_name']) && !empty($desc)) {
                    $it['accessory_name'] = $desc;
                }
                if (empty($it['item_description']) && !empty($desc)) {
                    $it['item_description'] = $desc;
                }
                $rowCandidates = [
                    'purchase_order_id' => $poId,
                    'material_id' => !empty($it['material_id']) ? (int)$it['material_id'] : null,
                    'line_number' => $idx + 1,
                    'order_no' => $it['order_no'],
                    'item_description' => $desc,
                    'description' => $desc,
                    'spec' => $it['spec'] ?? null,
                    'uom' => $it['uom'] ?? 'KG',
                    'quantity' => (float)($it['quantity'] ?? $it['qty'] ?? 0),
                    'weight_kg' => !empty($it['weight_kg']) ? (float)$it['weight_kg'] : null,
                    'received_quantity' => (float)($it['received_quantity'] ?? 0),
                    'rate' => (float)($it['rate'] ?? 0),
                    'taxable_amount' => $it['_taxable'] ?? 0,
                    'tax_percent' => (float)($it['tax_percent'] ?? 5.0),
                    'tax_amount' => $it['_tax_amount'] ?? 0,
                    'net_amount' => $it['_net'] ?? 0,
                    'dynamic_data' => json_encode($it)
                ];

                $rCols = [];
                $rPlaceholders = [];
                $rParams = [];
                foreach ($rowCandidates as $c => $v) {
                    if (in_array($c, $poiCols)) {
                        $rCols[] = "`$c`";
                        $rPlaceholders[] = "?";
                        $rParams[] = $v;
                    }
                }

                $itemStmt = $pdo->prepare("INSERT INTO purchase_order_items (" . implode(', ', $rCols) . ") VALUES (" . implode(', ', $rPlaceholders) . ")");
                $itemStmt->execute($rParams);
            }

            $pdo->commit();
            AuditLogger::log('PurchaseOrders', 'UPDATE', $poId, ['old_net_amount' => $po['net_amount']], ['net_amount' => $netTotal, 'items_count' => count($items)]);
            Response::success([
                'id' => $poId,
                'po_number' => $po['po_number'],
                'status' => 'Draft',
                'net_amount' => $netTotal
            ], "Purchase Order updated successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function addPayment(int $poId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $amount = (float)($data['amount'] ?? 0);
        $mode = $data['payment_mode'] ?? 'NEFT';
        $refNo = $data['reference_number'] ?? '';

        if ($amount <= 0) {
            Response::error("Payment amount must be greater than zero", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE");
            $stmt->execute([$poId]);
            $po = $stmt->fetch();

            if (!$po) {
                Response::error("Purchase Order not found", 404);
                return;
            }

            if (strtolower(trim((string)($po['status'] ?? ''))) === 'draft') {
                Response::error("Cannot record payments against a Draft Purchase Order. Please confirm and order the PO first.", 422);
                return;
            }

            if ($amount > (float)$po['balance_amount']) {
                Response::error("Payment amount (₹{$amount}) cannot exceed outstanding balance (₹{$po['balance_amount']})", 422);
                return;
            }

            $receiptNo = 'PAY-' . strtoupper(substr($mode, 0, 3)) . '-' . rand(1000, 9999);
            $pStmt = $pdo->prepare("
                INSERT INTO purchase_payments (purchase_order_id, receipt_number, payment_date, amount, payment_mode, reference_number, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $pStmt->execute([
                $poId,
                $receiptNo,
                $data['payment_date'] ?? date('Y-m-d'),
                $amount,
                $mode,
                $refNo,
                $data['notes'] ?? null
            ]);

            $newPaid = round((float)$po['paid_amount'] + $amount, 2);
            $newBalance = round(max(0.0, (float)$po['net_amount'] - $newPaid), 2);
            $dueDate = !empty($po['payment_due_date']) ? $po['payment_due_date'] : null;
            $today = date('Y-m-d');

            if ($newBalance <= 0.01) {
                $newStatus = 'Settled';
            } elseif (!empty($dueDate) && $dueDate !== '0000-00-00' && $dueDate < $today && $newBalance > 0.01) {
                $newStatus = 'Overdue';
            } elseif ($newPaid > 0.01 && $newBalance > 0.01) {
                $newStatus = 'Partially Paid';
            } else {
                $newStatus = 'Unpaid';
            }

            $uStmt = $pdo->prepare("UPDATE purchase_orders SET paid_amount = ?, balance_amount = ?, payment_status = ? WHERE id = ?");
            $uStmt->execute([$newPaid, $newBalance, $newStatus, $poId]);

            $pdo->commit();
            AuditLogger::log('PurchasePayments', 'CREATE', $poId, ['balance' => $po['balance_amount']], ['new_balance' => $newBalance, 'paid' => $amount]);
            Response::success([
                'paid_amount' => $newPaid,
                'balance_amount' => $newBalance,
                'payment_status' => $newStatus
            ], "Payment recorded successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function receive(int $poId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $receiptItems = $data['items'] ?? [];

        if (empty($receiptItems)) {
            Response::error("No items specified for receipt", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Run any schema adjustments OUTSIDE transaction (DDL causes implicit commit in MySQL)
            try { $pdo->exec("ALTER TABLE purchase_receipts ADD COLUMN photo_url LONGTEXT NULL"); } catch (Exception $e) {}
            try { $pdo->exec("ALTER TABLE purchase_receipts ADD COLUMN received_by VARCHAR(255) NULL"); } catch (Exception $e) {}
            try { $pdo->exec("ALTER TABLE purchase_receipts ADD COLUMN condition_status VARCHAR(100) NULL"); } catch (Exception $e) {}

            $pdo->beginTransaction();

            $poStmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE");
            $poStmt->execute([$poId]);
            $po = $poStmt->fetch();

            if (!$po) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Purchase Order not found", 404);
                return;
            }

            if (strtolower(trim((string)($po['status'] ?? ''))) === 'draft') {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Cannot receive materials against a Draft Purchase Order. Please confirm and order the PO first.", 422);
                return;
            }

            $receiptNo = 'GRN-' . str_pad((string)rand(100, 99999), 5, '0', STR_PAD_LEFT);
            $grnStmt = $pdo->prepare("
                INSERT INTO purchase_receipts (receipt_no, purchase_order_id, receipt_date, delivery_challan_no, vehicle_no, remarks, photo_url, received_by, condition_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $grnStmt->execute([
                $receiptNo,
                $poId,
                $data['receipt_date'] ?? date('Y-m-d'),
                $data['delivery_challan_no'] ?? $data['challan_no'] ?? null,
                $data['vehicle_no'] ?? null,
                $data['remarks'] ?? 'Received',
                $data['photo_url'] ?? null,
                $data['received_by'] ?? null,
                $data['condition'] ?? $data['condition_status'] ?? 'Good & Verified'
            ]);
            $receiptId = (int)$pdo->lastInsertId();

            $allCompleted = true;

            foreach ($receiptItems as $ritem) {
                $poItemId = (int)($ritem['purchase_order_item_id'] ?? $ritem['item_id'] ?? 0);
                $qtyReceived = (float)($ritem['quantity_received'] ?? $ritem['received_quantity'] ?? 0);

                if ($qtyReceived < 0) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    Response::error("Receive quantity cannot be negative.", 422);
                    return;
                }

                if ($qtyReceived <= 0) continue;

                // Update PO item received quantity with row lock
                $poiStmt = $pdo->prepare("SELECT * FROM purchase_order_items WHERE id = ? AND purchase_order_id = ? FOR UPDATE");
                $poiStmt->execute([$poItemId, $poId]);
                $poi = $poiStmt->fetch();

                if (!$poi) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    Response::error("Line item #{$poItemId} not found on this Purchase Order", 404);
                    return;
                }

                $orderedQty = (float)$poi['quantity'];
                $alreadyReceived = (float)$poi['received_quantity'];
                $remainingQty = round(max(0.0, $orderedQty - $alreadyReceived), 4);

                if ($qtyReceived > ($remainingQty + 0.0001)) {
                    $itemDesc = !empty($poi['item_description']) ? $poi['item_description'] : "Item #{$poItemId}";
                    $uom = !empty($poi['uom']) ? $poi['uom'] : 'units';
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    Response::error("Receive quantity for {$itemDesc} cannot exceed the remaining ordered quantity of {$remainingQty} {$uom}.", 422);
                    return;
                }

                $newReceived = (float)$poi['received_quantity'] + $qtyReceived;
                $updPoi = $pdo->prepare("UPDATE purchase_order_items SET received_quantity = ? WHERE id = ?");
                $updPoi->execute([$newReceived, $poItemId]);

                if ($newReceived < (float)$poi['quantity']) {
                    $allCompleted = false;
                }

                // Add to GRN items
                $griStmt = $pdo->prepare("
                    INSERT INTO purchase_receipt_items (purchase_receipt_id, purchase_order_item_id, material_id, quantity_received, weight_received, accepted_quantity, remarks)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $griStmt->execute([
                    $receiptId,
                    $poItemId,
                    $poi['material_id'],
                    $qtyReceived,
                    $ritem['weight_received'] ?? null,
                    $qtyReceived,
                    $ritem['remarks'] ?? 'Goods checked'
                ]);

                // Resolve material ID if missing
                $matId = !empty($poi['material_id']) ? (int)$poi['material_id'] : 0;
                $itemDesc = !empty($poi['item_description']) ? trim((string)$poi['item_description']) : '';
                if (!$matId && !empty($itemDesc)) {
                    $findMat = $pdo->prepare("SELECT id FROM materials WHERE name = ? OR code = ? LIMIT 1");
                    $findMat->execute([$itemDesc, $itemDesc]);
                    $matId = (int)($findMat->fetchColumn() ?: 0);
                    if (!$matId) {
                        // Auto-register material in materials master to preserve inventory tracking
                        $nextCode = 'MAT-' . str_pad((string)(time() % 100000 + rand(1, 999)), 5, '0', STR_PAD_LEFT);
                        $insMat = $pdo->prepare("
                            INSERT INTO materials (category_id, supplier_id, code, name, uom, purchase_rate, tax_percent, min_stock_level, current_stock, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 10.0, 0.0, 'active')
                        ");
                        $insMat->execute([
                            $po['category_id'] ?? 1,
                            $po['supplier_id'] ?? null,
                            $nextCode,
                            $itemDesc,
                            $poi['uom'] ?: 'KG',
                            $poi['rate'] ?: 0.0,
                            $poi['tax_percent'] ?: 5.0
                        ]);
                        $matId = (int)$pdo->lastInsertId();
                    }
                    if ($matId) {
                        $pdo->prepare("UPDATE purchase_order_items SET material_id = ? WHERE id = ?")->execute([$matId, $poItemId]);
                        $pdo->prepare("UPDATE purchase_receipt_items SET material_id = ? WHERE purchase_receipt_id = ? AND purchase_order_item_id = ?")->execute([$matId, $receiptId, $poItemId]);
                    }
                }

                // AUTOMATICALLY UPDATE INVENTORY & WRITE TO LEDGER!
                if ($matId > 0) {
                    $stockStmt = $pdo->prepare("SELECT current_quantity FROM stock_balances WHERE material_id = ? FOR UPDATE");
                    $stockStmt->execute([$matId]);
                    $row = $stockStmt->fetch(PDO::FETCH_ASSOC);
                    if ($row !== false) {
                        $oldStock = (float)$row['current_quantity'];
                    } else {
                        $mStockStmt = $pdo->prepare("SELECT current_stock FROM materials WHERE id = ? FOR UPDATE");
                        $mStockStmt->execute([$matId]);
                        $oldStock = (float)($mStockStmt->fetchColumn() ?: 0.0);
                    }
                    $newStock = $oldStock + $qtyReceived;

                    $updStock = $pdo->prepare("
                        INSERT INTO stock_balances (material_id, current_quantity, available_quantity)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE current_quantity = ?, available_quantity = ?
                    ");
                    $updStock->execute([$matId, $newStock, $newStock, $newStock, $newStock]);

                    // Update material current_stock column
                    $pdo->prepare("UPDATE materials SET current_stock = ? WHERE id = ?")->execute([$newStock, $matId]);

                    // Add Ledger Entry
                    $txStmt = $pdo->prepare("
                        INSERT INTO inventory_transactions (material_id, transaction_type, reference_type, reference_id, quantity, previous_stock, new_stock, notes)
                        VALUES (?, 'RECEIPT', 'Purchase Receipt', ?, ?, ?, ?, ?)
                    ");
                    $txStmt->execute([
                        $matId,
                        $receiptId,
                        $qtyReceived,
                        $oldStock,
                        $newStock,
                        "Received against PO #{$po['po_number']} (GRN #{$receiptNo})"
                    ]);
                }
            }

            // Note: PO status remains strictly 'Ordered' per two-status requirement ('Draft' | 'Ordered')
            $pdo->prepare("UPDATE purchase_orders SET status = 'Ordered' WHERE id = ?")->execute([$poId]);

            if ($pdo && $pdo->inTransaction()) {
                $pdo->commit();
            }
            AuditLogger::log('PurchaseReceipts', 'RECEIVE', $poId, null, ['grn' => $receiptNo, 'status' => 'Ordered']);
            Response::success([
                'receipt_no' => $receiptNo,
                'po_status' => 'Ordered'
            ], "Materials received and inventory updated successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function receiptsList(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT pr.*, po.po_number, s.name as supplier_name,
                       (SELECT COUNT(*) FROM purchase_receipt_items pri WHERE pri.purchase_receipt_id = pr.id) as item_count,
                       (SELECT COALESCE(SUM(quantity_received), 0) FROM purchase_receipt_items pri WHERE pri.purchase_receipt_id = pr.id) as total_quantity
                FROM purchase_receipts pr
                JOIN purchase_orders po ON pr.purchase_order_id = po.id
                JOIN suppliers s ON po.supplier_id = s.id
                ORDER BY pr.id DESC
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function paymentsList(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT pp.*, po.po_number, s.name as supplier_name
                FROM purchase_payments pp
                JOIN purchase_orders po ON pp.purchase_order_id = po.id
                JOIN suppliers s ON po.supplier_id = s.id
                ORDER BY pp.id DESC
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function returnsList(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT pr.*, po.po_number, s.name as supplier_name, m.name as material_name, m.uom
                FROM purchase_returns pr
                JOIN purchase_orders po ON pr.purchase_order_id = po.id
                JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN materials m ON pr.material_id = m.id
                ORDER BY pr.id DESC
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function storeReturn(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $poId = (int)($data['purchase_order_id'] ?? 0);
        $materialId = (int)($data['material_id'] ?? 0);
        $qty = (float)($data['quantity'] ?? 0);
        $amount = (float)($data['amount'] ?? 0);
        $reason = trim($data['reason'] ?? 'Defective quality');

        if (!$poId || $qty <= 0) {
            Response::error("PO and valid return quantity are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $returnNo = 'RET-' . rand(1000, 9999);
            $debitNote = 'DN-' . rand(1000, 9999);

            $stmt = $pdo->prepare("
                INSERT INTO purchase_returns (return_number, purchase_order_id, material_id, return_date, quantity, amount, debit_note_no, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
            ");
            $stmt->execute([
                $returnNo,
                $poId,
                $materialId ?: null,
                $data['return_date'] ?? date('Y-m-d'),
                $qty,
                $amount,
                $debitNote,
                $reason
            ]);
            $returnId = (int)$pdo->lastInsertId();

            if ($materialId > 0) {
                // Deduct from stock
                $pdo->prepare("UPDATE stock_balances SET current_quantity = GREATEST(0, current_quantity - ?) WHERE material_id = ?")->execute([$qty, $materialId]);
                $pdo->prepare("UPDATE materials SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?")->execute([$qty, $materialId]);
            }

            $pdo->commit();
            AuditLogger::log('PurchaseReturns', 'CREATE', $returnId, null, ['return_number' => $returnNo, 'amount' => $amount]);
            Response::success(['id' => $returnId, 'return_number' => $returnNo, 'debit_note_no' => $debitNote], "Purchase return recorded", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function show(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT po.*, 
                       c.name as category_name, 
                       s.name as supplier_name, 
                       s.code as supplier_code,
                       s.phone as supplier_phone,
                       s.email as supplier_email,
                       s.address as supplier_address,
                       s.contact_person as supplier_contact,
                       s.gstin as supplier_gstin,
                       pro.order_number as production_order_number,
                       pro.title as production_order_title
                FROM purchase_orders po
                LEFT JOIN categories c ON po.category_id = c.id
                LEFT JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN production_orders pro ON po.production_order_id = pro.id
                WHERE po.id = ? AND po.deleted_at IS NULL
            ");
            $stmt->execute([$id]);
            $po = $stmt->fetch();

            if (!$po) {
                Response::error("Purchase Order not found", 404);
                return;
            }

            $st = strtolower(trim((string)($po['status'] ?? '')));
            $po['status'] = ($st === 'draft') ? 'Draft' : 'Ordered';

            try {
                $iStmt = $pdo->prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id ASC");
                $iStmt->execute([$po['id']]);
                $items = $iStmt->fetchAll();
                foreach ($items as &$poi) {
                    if (!empty($poi['dynamic_data'])) {
                        $dyn = json_decode($poi['dynamic_data'], true);
                        if (is_array($dyn)) {
                            $poi = array_merge($dyn, $poi);
                        }
                    }
                    if (empty($poi['accessory_name']) && !empty($poi['item_description'])) {
                        $poi['accessory_name'] = $poi['item_description'];
                    }
                    if (empty($poi['item_description']) && !empty($poi['accessory_name'])) {
                        $poi['item_description'] = $poi['accessory_name'];
                    }
                    if (!empty($poi['item_description'])) {
                        $poi['item_description'] = trim(preg_replace('/\s*\[[A-Za-z0-9_-]+\]\s*/', ' ', (string)$poi['item_description']));
                    }
                    if (!empty($poi['accessory_name'])) {
                        $poi['accessory_name'] = trim(preg_replace('/\s*\[[A-Za-z0-9_-]+\]\s*/', ' ', (string)$poi['accessory_name']));
                    }
                    if (!empty($poi['description'])) {
                        $poi['description'] = trim(preg_replace('/\s*\[[A-Za-z0-9_-]+\]\s*/', ' ', (string)$poi['description']));
                    }
                }
                $po['items'] = $items;
            } catch (Exception $ie) {
                $po['items'] = [];
            }

            try {
                $pStmt = $pdo->prepare("SELECT * FROM purchase_payments WHERE purchase_order_id = ? ORDER BY id DESC");
                $pStmt->execute([$po['id']]);
                $po['payments'] = $pStmt->fetchAll();
            } catch (Exception $pe) {
                $po['payments'] = [];
            }

            try {
                $rStmt = $pdo->prepare("SELECT * FROM purchase_receipts WHERE purchase_order_id = ? ORDER BY id DESC");
                $rStmt->execute([$po['id']]);
                $po['receipts'] = $rStmt->fetchAll();
            } catch (Exception $re) {
                $po['receipts'] = [];
            }

            $this->enrichPaymentStatus($po);

            Response::success($po);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateStatus(int $poId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = trim((string)($data['status'] ?? ''));
        $statusLower = strtolower($status);

        if ($statusLower !== 'draft' && $statusLower !== 'ordered') {
            Response::error("Invalid status. Allowed statuses are 'Draft' and 'Ordered'", 422);
            return;
        }

        $canonicalStatus = ($statusLower === 'draft') ? 'Draft' : 'Ordered';

        try {
            $pdo = Database::getConnection();

            // Authorization check
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
            if (empty($authHeader) && function_exists('getallheaders')) {
                $allHeaders = getallheaders();
                $authHeader = $allHeaders['Authorization'] ?? $allHeaders['authorization'] ?? '';
            }

            if (!empty($authHeader) && preg_match('/Bearer\s+(.*)$/i', $authHeader, $m)) {
                $token = trim($m[1]);
                $decoded = json_decode(base64_decode($token), true);
                if (is_array($decoded) && !empty($decoded['id'])) {
                    $uStmt = $pdo->prepare("SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND u.status = 'active'");
                    $uStmt->execute([(int)$decoded['id']]);
                    $roleName = strtoupper((string)($uStmt->fetchColumn() ?: ''));
                    $allowedRoles = ['ADMIN', 'MANAGER', 'PURCHASE', 'PURCHASE_MGR', 'SYSTEM ADMINISTRATOR', 'OPERATIONS MANAGER', 'PURCHASE OFFICER'];
                    if ($roleName && !in_array($roleName, $allowedRoles, true)) {
                        Response::error("You do not have permission to approve Purchase Orders", 403);
                        return;
                    }
                }
            }

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT id, status, po_number, ordered_at, payment_due_date FROM purchase_orders WHERE id = ? FOR UPDATE");
            $stmt->execute([$poId]);
            $po = $stmt->fetch();

            if (!$po) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Purchase Order not found", 404);
                return;
            }

            $currentStatus = strtolower(trim((string)($po['status'] ?? '')));
            if ($canonicalStatus === 'Ordered' && $currentStatus === 'ordered') {
                if ($pdo->inTransaction()) $pdo->commit();
                Response::success(['id' => $poId, 'status' => 'Ordered', 'payment_due_date' => $po['payment_due_date']], "Purchase Order is already Ordered");
                return;
            }

            if ($canonicalStatus === 'Ordered' && $currentStatus !== 'draft') {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Only Draft purchase orders can be approved", 422);
                return;
            }

            $orderedAt = null;
            $dueDate = null;

            if ($canonicalStatus === 'Ordered') {
                $now = date('Y-m-d H:i:s');
                $orderedAt = !empty($po['ordered_at']) ? $po['ordered_at'] : $now;
                
                // Calculate default payment due date as 15 calendar days after ordered date
                $dueDate = $po['payment_due_date'] ?? null;
                if (empty($dueDate) || $dueDate === '0000-00-00') {
                    $orderedDate = date('Y-m-d', strtotime($orderedAt));
                    $dueDate = date('Y-m-d', strtotime($orderedDate . ' +15 days'));
                }

                $uStmt = $pdo->prepare("UPDATE purchase_orders SET status = ?, ordered_at = ?, payment_due_date = ? WHERE id = ?");
                $uStmt->execute([$canonicalStatus, $orderedAt, $dueDate, $poId]);
            } else {
                $uStmt = $pdo->prepare("UPDATE purchase_orders SET status = ? WHERE id = ?");
                $uStmt->execute([$canonicalStatus, $poId]);
            }

            $pdo->commit();

            AuditLogger::log('PurchaseOrders', 'UPDATE_STATUS', $poId, ['old_status' => $po['status']], ['status' => $canonicalStatus]);
            Response::success([
                'id' => $poId,
                'status' => $canonicalStatus,
                'ordered_at' => $canonicalStatus === 'Ordered' ? $orderedAt : null,
                'payment_due_date' => $canonicalStatus === 'Ordered' ? $dueDate : null
            ], "Purchase Order status updated to {$canonicalStatus}");
        } catch (Exception $e) {
            if (isset($pdo) && $pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}

