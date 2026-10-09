<?php
// backend/controllers/ReportsController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';

class ReportsController {
    public function purchaseReport(): void {
        try {
            $pdo = Database::getConnection();
            $summary = [
                'total_pos' => (int)$pdo->query("SELECT COUNT(*) FROM purchase_orders WHERE deleted_at IS NULL")->fetchColumn(),
                'total_spend' => (float)$pdo->query("SELECT COALESCE(SUM(net_amount), 0) FROM purchase_orders WHERE deleted_at IS NULL")->fetchColumn(),
                'total_paid' => (float)$pdo->query("SELECT COALESCE(SUM(paid_amount), 0) FROM purchase_orders WHERE deleted_at IS NULL")->fetchColumn(),
                'outstanding' => (float)$pdo->query("SELECT COALESCE(SUM(balance_amount), 0) FROM purchase_orders WHERE deleted_at IS NULL")->fetchColumn(),
            ];

            $bySupplier = $pdo->query("
                SELECT s.name as supplier_name, COUNT(po.id) as po_count, 
                       COALESCE(SUM(po.net_amount), 0) as total_amount,
                       COALESCE(SUM(po.paid_amount), 0) as paid_amount,
                       COALESCE(SUM(po.balance_amount), 0) as balance_amount
                FROM suppliers s
                JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL
                GROUP BY s.id, s.name
                ORDER BY total_amount DESC
            ")->fetchAll();

            $byStatus = $pdo->query("
                SELECT status, COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total_amount
                FROM purchase_orders WHERE deleted_at IS NULL
                GROUP BY status
            ")->fetchAll();

            Response::success([
                'summary' => $summary,
                'by_supplier' => $bySupplier,
                'by_status' => $byStatus
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function inventoryReport(): void {
        try {
            $pdo = Database::getConnection();
            $summary = [
                'total_materials' => (int)$pdo->query("SELECT COUNT(*) FROM materials WHERE deleted_at IS NULL")->fetchColumn(),
                'total_valuation' => (float)$pdo->query("SELECT COALESCE(SUM(sb.current_quantity * m.purchase_rate), 0) FROM materials m LEFT JOIN stock_balances sb ON m.id = sb.material_id WHERE m.deleted_at IS NULL")->fetchColumn(),
                'low_stock_items' => (int)$pdo->query("SELECT COUNT(*) FROM materials m LEFT JOIN stock_balances sb ON m.id = sb.material_id WHERE COALESCE(sb.current_quantity, 0) <= m.min_stock_level AND m.deleted_at IS NULL")->fetchColumn(),
            ];

            $byCategory = $pdo->query("
                SELECT c.name as category_name, COUNT(m.id) as material_count,
                       COALESCE(SUM(sb.current_quantity * m.purchase_rate), 0) as category_valuation
                FROM categories c
                JOIN materials m ON c.id = m.category_id AND m.deleted_at IS NULL
                LEFT JOIN stock_balances sb ON m.id = sb.material_id
                GROUP BY c.id, c.name
                ORDER BY category_valuation DESC
            ")->fetchAll();

            $topStock = $pdo->query("
                SELECT m.name, m.code, m.uom, m.purchase_rate, 
                       COALESCE(sb.current_quantity, 0) as current_stock,
                       ROUND(COALESCE(sb.current_quantity, 0) * m.purchase_rate, 2) as valuation
                FROM materials m
                LEFT JOIN stock_balances sb ON m.id = sb.material_id
                WHERE m.deleted_at IS NULL
                ORDER BY valuation DESC LIMIT 10
            ")->fetchAll();

            Response::success([
                'summary' => $summary,
                'by_category' => $byCategory,
                'top_stock' => $topStock
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function productionReport(): void {
        try {
            $pdo = Database::getConnection();
            $summary = [
                'total_orders' => (int)$pdo->query("SELECT COUNT(*) FROM production_orders WHERE deleted_at IS NULL")->fetchColumn(),
                'in_production' => (int)$pdo->query("SELECT COUNT(*) FROM production_orders WHERE status = 'IN PRODUCTION' AND deleted_at IS NULL")->fetchColumn(),
                'completed' => (int)$pdo->query("SELECT COUNT(*) FROM production_orders WHERE status = 'COMPLETED' AND deleted_at IS NULL")->fetchColumn(),
                'total_units_produced' => (int)$pdo->query("SELECT COALESCE(SUM(completed_quantity), 0) FROM production_orders WHERE deleted_at IS NULL")->fetchColumn(),
            ];

            $byStage = $pdo->query("
                SELECT ps.name as stage_name, ps.sequence_order, COUNT(poi.id) as batch_count,
                       COALESCE(SUM(poi.current_stage_quantity), 0) as total_quantity
                FROM production_stages ps
                LEFT JOIN production_order_items poi ON ps.id = poi.current_stage_id AND poi.status = 'In Progress'
                GROUP BY ps.id, ps.name, ps.sequence_order
                ORDER BY ps.sequence_order ASC
            ")->fetchAll();

            Response::success([
                'summary' => $summary,
                'by_stage' => $byStage
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function qcReport(): void {
        try {
            $pdo = Database::getConnection();
            $summary = [
                'total_inspections' => (int)$pdo->query("SELECT COUNT(*) FROM qc_records")->fetchColumn(),
                'passed_quantity' => (int)$pdo->query("SELECT COALESCE(SUM(passed_quantity), 0) FROM qc_records")->fetchColumn(),
                'rejected_quantity' => (int)$pdo->query("SELECT COALESCE(SUM(rejected_quantity), 0) FROM qc_records")->fetchColumn(),
                'rework_quantity' => (int)$pdo->query("SELECT COALESCE(SUM(rework_quantity), 0) FROM qc_records")->fetchColumn(),
            ];

            $recentInspections = $pdo->query("
                SELECT qc.*, ps.name as stage_name, u.name as inspector_name
                FROM qc_records qc
                LEFT JOIN production_stages ps ON qc.stage_id = ps.id
                LEFT JOIN users u ON qc.inspector_user_id = u.id
                ORDER BY qc.id DESC LIMIT 20
            ")->fetchAll();

            Response::success([
                'summary' => $summary,
                'recent_inspections' => $recentInspections
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function paymentReport(): void {
        try {
            $pdo = Database::getConnection();
            $recentPayments = $pdo->query("
                SELECT p.*, po.po_number, s.name as supplier_name
                FROM purchase_payments p
                JOIN purchase_orders po ON p.purchase_order_id = po.id
                JOIN suppliers s ON po.supplier_id = s.id
                ORDER BY p.id DESC LIMIT 50
            ")->fetchAll();

            $byMode = $pdo->query("
                SELECT payment_mode, COUNT(*) as count, SUM(amount) as total_amount
                FROM purchase_payments
                GROUP BY payment_mode
            ")->fetchAll();

            Response::success([
                'recent_payments' => $recentPayments,
                'by_mode' => $byMode
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
