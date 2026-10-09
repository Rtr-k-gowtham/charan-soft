<?php
// backend/controllers/PurchaseOrderController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class PurchaseOrderController {
    public function index(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT po.*, 
                       c.name as category_name, 
                       s.name as supplier_name, 
                       s.code as supplier_code,
                       s.phone as supplier_phone,
                       s.email as supplier_email,
                       s.address as supplier_address,
                       s.contact_person as supplier_contact,
                       s.gstin as supplier_gstin
                FROM purchase_orders po
                LEFT JOIN categories c ON po.category_id = c.id
                LEFT JOIN suppliers s ON po.supplier_id = s.id
                WHERE po.deleted_at IS NULL
                ORDER BY po.id DESC
            ");
            $orders = $stmt->fetchAll();

            foreach ($orders as &$po) {
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

            $poNumber = 'PO-' . str_pad((string)rand(100, 99999), 5, '0', STR_PAD_LEFT);
            $poDate = $data['po_date'] ?? date('Y-m-d');
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

            // Dynamically detect existing columns in purchase_orders to prevent schema mismatch
            $poCols = $pdo->query("DESCRIBE purchase_orders")->fetchAll(PDO::FETCH_COLUMN);
            $poCandidates = [
                'po_number' => $poNumber,
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
                'status' => 'PENDING',
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

            $stmt = $pdo->prepare("INSERT INTO purchase_orders (" . implode(', ', $insertPoCols) . ") VALUES (" . implode(', ', $insertPoPlaceholders) . ")");
            $stmt->execute($insertPoParams);
            $poId = (int)$pdo->lastInsertId();

            // Dynamically detect existing columns in purchase_order_items
            $poiCols = $pdo->query("DESCRIBE purchase_order_items")->fetchAll(PDO::FETCH_COLUMN);

            foreach ($items as $idx => $it) {
                $desc = $it['item_description'] ?? $it['description'] ?? $it['accessory_name'] ?? 'Textile Material';
                $rowCandidates = [
                    'purchase_order_id' => $poId,
                    'material_id' => !empty($it['material_id']) ? (int)$it['material_id'] : null,
                    'line_number' => $idx + 1,
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

            $pdo->commit();
            AuditLogger::log('PurchaseOrders', 'CREATE', $poId, null, ['po_number' => $poNumber, 'net_amount' => $netTotal]);
            Response::success(['id' => $poId, 'po_number' => $poNumber], "Purchase Order created successfully", 201);
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

            $newPaid = (float)$po['paid_amount'] + $amount;
            $newBalance = (float)$po['net_amount'] - $newPaid;
            $newStatus = ($newBalance <= 0.01) ? 'Paid' : 'Partially Paid';

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
            $pdo->beginTransaction();

            $poStmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE");
            $poStmt->execute([$poId]);
            $po = $poStmt->fetch();

            if (!$po) {
                Response::error("Purchase Order not found", 404);
                return;
            }

            $receiptNo = 'GRN-' . str_pad((string)rand(100, 99999), 5, '0', STR_PAD_LEFT);
            $grnStmt = $pdo->prepare("
                INSERT INTO purchase_receipts (receipt_no, purchase_order_id, receipt_date, delivery_challan_no, vehicle_no, remarks)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $grnStmt->execute([
                $receiptNo,
                $poId,
                $data['receipt_date'] ?? date('Y-m-d'),
                $data['challan_no'] ?? null,
                $data['vehicle_no'] ?? null,
                $data['remarks'] ?? 'Received'
            ]);
            $receiptId = (int)$pdo->lastInsertId();

            $allCompleted = true;

            foreach ($receiptItems as $ritem) {
                $poItemId = (int)$ritem['purchase_order_item_id'];
                $qtyReceived = (float)($ritem['quantity_received'] ?? 0);
                if ($qtyReceived <= 0) continue;

                // Update PO item received quantity
                $poiStmt = $pdo->prepare("SELECT * FROM purchase_order_items WHERE id = ? FOR UPDATE");
                $poiStmt->execute([$poItemId]);
                $poi = $poiStmt->fetch();

                if (!$poi) continue;

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

                // AUTOMATICALLY UPDATE INVENTORY & WRITE TO LEDGER!
                if (!empty($poi['material_id'])) {
                    $matId = (int)$poi['material_id'];
                    $stockStmt = $pdo->prepare("SELECT current_quantity FROM stock_balances WHERE material_id = ? FOR UPDATE");
                    $stockStmt->execute([$matId]);
                    $oldStock = (float)($stockStmt->fetchColumn() ?: 0.0);
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
                        VALUES (?, 'PURCHASE RECEIPT', 'Purchase Receipt', ?, ?, ?, ?, ?)
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

            // Update PO Status
            $newPOStatus = $allCompleted ? 'RECEIVED' : 'PARTIALLY RECEIVED';
            $pdo->prepare("UPDATE purchase_orders SET status = ? WHERE id = ?")->execute([$newPOStatus, $poId]);

            $pdo->commit();
            AuditLogger::log('PurchaseReceipts', 'RECEIVE', $poId, null, ['grn' => $receiptNo, 'status' => $newPOStatus]);
            Response::success([
                'receipt_no' => $receiptNo,
                'po_status' => $newPOStatus
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
}

