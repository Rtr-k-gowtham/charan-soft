<?php
// backend/index.php - Complete Textile Manufacturing ERP Router
declare(strict_types=1);

// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/core/AuditLogger.php';

// Controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/CategoryController.php';
require_once __DIR__ . '/controllers/MaterialController.php';
require_once __DIR__ . '/controllers/PurchaseOrderController.php';
require_once __DIR__ . '/controllers/ProductionController.php';
require_once __DIR__ . '/controllers/InventoryController.php';
require_once __DIR__ . '/controllers/MastersController.php';
require_once __DIR__ . '/controllers/TemplatesController.php';
require_once __DIR__ . '/controllers/ReportsController.php';
require_once __DIR__ . '/controllers/SettingsController.php';
require_once __DIR__ . '/controllers/POTemplateController.php';
require_once __DIR__ . '/controllers/DyeingController.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strip base paths
if (str_starts_with($uri, '/backend')) {
    $uri = substr($uri, 8);
}
if (str_starts_with($uri, '/api')) {
    $uri = substr($uri, 4);
}

$segments = array_values(array_filter(explode('/', trim($uri, '/'))));
$r0 = $segments[0] ?? '';
$r1 = $segments[1] ?? '';
$r2 = $segments[2] ?? '';
$id = is_numeric($r1) ? (int)$r1 : null;
$action = $id ? $r2 : $r1;

try {
    match(true) {
        // ---------------- AUTH ----------------
        $r0 === 'auth' && $r1 === 'login' && $method === 'POST' => (new AuthController)->login(),
        $r0 === 'auth' && $r1 === 'me' => (new AuthController)->me(),

        // ---------------- DASHBOARD ----------------
        $r0 === 'dashboard' => handleDashboard(),

        // ---------------- CATEGORIES ----------------
        $r0 === 'categories' && $method === 'GET' && !$id => (new CategoryController)->index(),
        $r0 === 'categories' && $method === 'GET' && $id => (new CategoryController)->show($id),
        $r0 === 'categories' && $method === 'POST' && !$id => (new CategoryController)->store(),
        $r0 === 'categories' && $id && !$r2 && in_array($method, ['PUT', 'PATCH']) => (new CategoryController)->update($id),
        $r0 === 'categories' && $id && $r2 === 'fields' && $method === 'POST' => (new CategoryController)->addField($id),
        $r0 === 'categories' && $id && $r2 === 'fields' && isset($segments[3]) && $method === 'DELETE' => (new CategoryController)->deleteField($id, (int)$segments[3]),
        $r0 === 'categories' && $id && $r2 === 'terms' && in_array($method, ['PUT', 'POST', 'PATCH']) => (new CategoryController)->saveTerms($id),
        $r0 === 'categories' && $id && $r2 === 'terms' && $method === 'GET' => (new CategoryController)->getTerms($id),
        $r0 === 'categories' && $method === 'DELETE' && $id => (new CategoryController)->destroy($id),

        // ---------------- MATERIALS ----------------
        $r0 === 'materials' && $method === 'GET' && !$id => (new MaterialController)->index(),
        $r0 === 'materials' && $method === 'GET' && $id => (new MaterialController)->show($id),
        $r0 === 'materials' && $method === 'POST' && !$id => (new MaterialController)->store(),
        $r0 === 'materials' && $id && in_array($method, ['PUT', 'PATCH', 'POST']) => (new MaterialController)->update($id),
        $r0 === 'materials' && $id && $method === 'DELETE' => (new MaterialController)->destroy($id),

        // ---------------- PURCHASE ----------------
        $r0 === 'purchase-orders' && $method === 'GET' && !$id => (new PurchaseOrderController)->index(),
        $r0 === 'purchase-orders' && $method === 'GET' && $id => (new PurchaseOrderController)->show($id),
        $r0 === 'purchase-orders' && $method === 'POST' && !$id => (new PurchaseOrderController)->store(),
        $r0 === 'purchase-orders' && $id && !$action && in_array($method, ['PUT', 'PATCH', 'POST']) => (new PurchaseOrderController)->update($id),
        $r0 === 'purchase-orders' && $id && $action === 'status' && in_array($method, ['PATCH', 'PUT', 'POST']) => (new PurchaseOrderController)->updateStatus($id),
        $r0 === 'purchase-orders' && $id && $action === 'cancel' && $method === 'POST' => (new PurchaseOrderController)->cancel($id),
        $r0 === 'purchase-orders' && $id && $action === 'reissue' && $method === 'POST' => (new PurchaseOrderController)->reissue($id),
        $r0 === 'purchase-orders' && $id && $action === 'payments' && $method === 'POST' => (new PurchaseOrderController)->addPayment($id),
        $r0 === 'purchase-orders' && $id && $action === 'receive' && $method === 'POST' => (new PurchaseOrderController)->receive($id),
        $r0 === 'purchase' && $r1 === 'receipts' && $method === 'GET' => (new PurchaseOrderController)->receiptsList(),
        $r0 === 'purchase' && $r1 === 'payments' && $method === 'GET' => (new PurchaseOrderController)->paymentsList(),
        $r0 === 'purchase' && $r1 === 'returns' && $method === 'GET' => (new PurchaseOrderController)->returnsList(),
        $r0 === 'purchase' && $r1 === 'returns' && $method === 'POST' => (new PurchaseOrderController)->storeReturn(),
        $r0 === 'purchase-orders' && ($r1 === 'record-exclusion' || $action === 'record-exclusion') && $method === 'POST' => (new PurchaseOrderController)->recordExclusion(),
        $r0 === 'production-orders' && $id && ($r2 === 'unordered-items' || $action === 'unordered-items') && $method === 'GET' => (new PurchaseOrderController)->unorderedItems($id),
        $r0 === 'production' && $r1 === 'unordered-items' && $method === 'GET' => (new PurchaseOrderController)->allUnorderedItems(),

        // ---------------- INVENTORY ----------------
        $r0 === 'inventory' && $method === 'GET' && empty($r1) => (new InventoryController)->index(),
        $r0 === 'inventory' && $r1 === 'ledger' => (new InventoryController)->ledger(),
        $r0 === 'inventory' && $r1 === 'low-stock' => (new InventoryController)->lowStock(),
        $r0 === 'inventory' && $r1 === 'adjustment' && $method === 'POST' => (new InventoryController)->adjustStock(),
        $r0 === 'inventory' && $r1 === 'consumption' => (new InventoryController)->consumption(),

        // ---------------- PRODUCTION ----------------
        $r0 === 'production-stages' && $method === 'GET' => (new ProductionController)->stages(),
        $r0 === 'production-orders' && $method === 'GET' && !$id => (new ProductionController)->index(),
        $r0 === 'production-orders' && $id && ($r2 === 'material-requirements' || $r2 === 'bom') && $method === 'GET' => (new ProductionController)->materialRequirements($id),
        $r0 === 'production-orders' && $id && ($r2 === 'material-requirements' || $r2 === 'bom') && $method === 'POST' => (new ProductionController)->saveMaterialRequirements($id),
        $r0 === 'production-orders' && $method === 'GET' && $id => (new ProductionController)->show($id),
        $r0 === 'production-orders' && $method === 'POST' && empty($r1) => (new ProductionController)->store(),
        $r0 === 'production-orders' && ($action === 'stage' || $r1 === 'stage' || $r2 === 'stage') && $method === 'POST' => (new ProductionController)->moveStage(),
        $r0 === 'production' && $r1 === 'dashboard-stats' && $method === 'GET' => (new ProductionController)->dashboardStats(),
        $r0 === 'production' && $r1 === 'orders' && is_numeric($r2) && ($segments[3] ?? '') === 'product-quantities' && $method === 'GET' => (new ProductionController)->orderProductQuantities((int)$r2),
        $r0 === 'production' && $r1 === 'orders' && is_numeric($r2) && ($segments[3] ?? '') === 'quantity-ledger' && $method === 'GET' => (new ProductionController)->orderQuantityLedger((int)$r2),
        $r0 === 'production' && $r1 === 'stage' && !empty($r2) => (new ProductionController)->stageOrders($r2),
        $r0 === 'production' && $r1 === 'rework' && empty($r2) && $method === 'GET' => (new ProductionController)->reworkList(),
        $r0 === 'production' && $r1 === 'rework' && $r2 === 'create' && $method === 'POST' => (new ProductionController)->createRework(),
        $r0 === 'production' && $r1 === 'rework' && $r2 === 'send' && $method === 'POST' => (new ProductionController)->sendRework(),
        $r0 === 'production' && $r1 === 'rework' && $r2 === 'receive' && $method === 'POST' => (new ProductionController)->receiveRework(),
        $r0 === 'production' && $r1 === 'rework' && $r2 === 'reinspect' && $method === 'POST' => (new ProductionController)->reinspectRework(),
        $r0 === 'production' && $r1 === 'inspect' && $method === 'POST' => (new ProductionController)->recordQualityInspection(),
        $r0 === 'production' && in_array($r1, ['dyeing', 'cutting', 'embroidery', 'stitching', 'checking']) && $r2 === 'inspect' && $method === 'POST' => (new ProductionController)->recordQualityInspection(),
        $r0 === 'production' && $r1 === 'qc' && $method === 'GET' => (new ProductionController)->qcList(),
        $r0 === 'qc' && $method === 'POST' => (new ProductionController)->recordQC(),

        // ---------------- STAGE 05: CUTTING ----------------
        $r0 === 'production' && $r1 === 'cutting' && $r2 === 'orders' && $method === 'GET' => (new ProductionController)->cuttingOrders(),
        $r0 === 'production' && $r1 === 'cutting' && $r2 === 'batch' && $method === 'POST' => (new ProductionController)->createCuttingBatch(),
        $r0 === 'production' && $r1 === 'cutting' && $r2 === 'transfer' && $method === 'POST' => (new ProductionController)->transferCuttingOutput(),
        $r0 === 'production' && $r1 === 'cutting' && is_numeric($r2) && $method === 'GET' => (new ProductionController)->cuttingOrderDetails((int)$r2),

        // ---------------- STAGE 06: EMBROIDERY (JOB WORK OUTWARD / INWARD) ----------------
        $r0 === 'production' && $r1 === 'embroidery' && $r2 === 'job-orders' && $method === 'GET' => (new ProductionController)->embroideryJobOrders(),
        $r0 === 'production' && $r1 === 'embroidery' && $r2 === 'job-order' && $method === 'POST' => (new ProductionController)->createEmbroideryJobOrder(),
        $r0 === 'production' && $r1 === 'embroidery' && $r2 === 'inward' && $method === 'POST' => (new ProductionController)->receiveEmbroideryJobOrder(),
        $r0 === 'production' && $r1 === 'embroidery' && $r2 === 'transfer' && $method === 'POST' => (new ProductionController)->transferEmbroideryOutput(),
        $r0 === 'production' && $r1 === 'embroidery' && $r2 === 'vendor-outstanding' && $method === 'GET' => (new ProductionController)->vendorOutstandingEmbroidery(),
        $r0 === 'production' && $r1 === 'embroidery' && is_numeric($r2) && $method === 'GET' => (new ProductionController)->embroideryOrderDetails((int)$r2),

        // ---------------- STAGE 07: STITCHING ----------------
        $r0 === 'production' && $r1 === 'stitching' && $r2 === 'orders' && $method === 'GET' => (new ProductionController)->stitchingOrders(),
        $r0 === 'production' && $r1 === 'stitching' && $r2 === 'batch' && $method === 'POST' => (new ProductionController)->createStitchingBatch(),
        $r0 === 'production' && $r1 === 'stitching' && $r2 === 'transfer' && $method === 'POST' => (new ProductionController)->transferStitchingOutput(),
        $r0 === 'production' && $r1 === 'stitching' && is_numeric($r2) && $method === 'GET' => (new ProductionController)->stitchingOrderDetails((int)$r2),

        // ---------------- STAGE 08: CHECKING / QC ----------------
        $r0 === 'production' && $r1 === 'checking' && $r2 === 'orders' && $method === 'GET' => (new ProductionController)->checkingOrders(),
        $r0 === 'production' && $r1 === 'checking' && $r2 === 'inspect' && $method === 'POST' => (new ProductionController)->recordQualityInspection(),
        $r0 === 'production' && $r1 === 'checking' && $r2 === 'bulk-inspect' && $method === 'POST' => (new ProductionController)->recordBulkQualityInspection(),
        $r0 === 'production' && $r1 === 'checking' && $r2 === 'transfer' && $method === 'POST' => (new ProductionController)->transferCheckingOutput(),
        $r0 === 'production' && $r1 === 'checking' && is_numeric($r2) && $method === 'GET' => (new ProductionController)->checkingOrderDetails((int)$r2),

        // ---------------- STAGE 09: PACKING & CARTON MANAGEMENT ----------------
        $r0 === 'production' && $r1 === 'packing' && $r2 === 'orders' && $method === 'GET' => (new ProductionController)->packingOrders(),
        $r0 === 'production' && $r1 === 'packing' && $r2 === 'batch' && $method === 'POST' => (new ProductionController)->createPackingBatch(),
        $r0 === 'production' && $r1 === 'packing' && $r2 === 'transfer' && $method === 'POST' => (new ProductionController)->transferPackingOutput(),
        $r0 === 'production' && $r1 === 'packing' && $r2 === 'cartons' && $method === 'GET' => (new ProductionController)->packingCartons(),
        $r0 === 'production' && $r1 === 'packing' && $r2 === 'carton' && isset($segments[3]) && $method === 'GET' => (new ProductionController)->getCartonBySerial($segments[3]),
        $r0 === 'production' && $r1 === 'packing' && is_numeric($r2) && $method === 'GET' => (new ProductionController)->packingOrderDetails((int)$r2),

        // ---------------- STAGE 10: COMPLETED & DISPATCH ----------------
        $r0 === 'production' && $r1 === 'dispatch' && $r2 === 'orders' && $method === 'GET' => (new ProductionController)->dispatchOrders(),
        $r0 === 'production' && $r1 === 'dispatch' && $r2 === 'record' && $method === 'POST' => (new ProductionController)->recordOrderDispatch(),
        $r0 === 'production' && $r1 === 'dispatch' && $r2 === 'history' && $method === 'GET' => (new ProductionController)->dispatchHistory(),
        $r0 === 'production' && $r1 === 'dispatch' && $r2 === 'document' && $method === 'GET' => (new ProductionController)->dispatchDocument(),
        $r0 === 'production' && $r1 === 'dispatch' && is_numeric($r2) && ($segments[3] ?? '') === 'document' && $method === 'GET' => (new ProductionController)->dispatchDocument((int)$r2),
        $r0 === 'production' && $r1 === 'dispatch' && is_numeric($r2) && $method === 'GET' => (new ProductionController)->dispatchOrderDetails((int)$r2),

        // ---------------- REPORTS ----------------
        $r0 === 'reports' && $r1 === 'production' && ($segments[2] ?? '') === 'detailed' && $method === 'GET' => (new ProductionController)->detailedReports(),

        // ---------------- DYEING (STAGE 04) ----------------
        $r0 === 'dyeing' && $r1 === 'fabric-stock' && $method === 'GET' => (new DyeingController)->fabricStock(),
        $r0 === 'dyeing' && $r1 === 'transfer-to-cutting' && $method === 'POST' => (new DyeingController)->transferToCutting(),
        $r0 === 'dyeing' && $r1 === 'orders' && isset($segments[2]) && ($segments[3] ?? '') === 'receive' && $method === 'POST' => (new DyeingController)->receive($segments[2]),
        $r0 === 'dyeing' && $r1 === 'orders' && isset($segments[2]) && !isset($segments[3]) && $method === 'GET' => (new DyeingController)->show($segments[2]),
        $r0 === 'dyeing' && $r1 === 'orders' && !isset($segments[2]) && $method === 'GET' => (new DyeingController)->index(),
        $r0 === 'dyeing' && $r1 === 'orders' && !isset($segments[2]) && $method === 'POST' => (new DyeingController)->store(),
        $r0 === 'dyeing' && $id && $r2 === 'receive' && $method === 'POST' => (new DyeingController)->receive($id),

        // ---------------- MASTERS ----------------
        $r0 === 'products' && $method === 'GET' => (new MastersController)->getProducts(),
        $r0 === 'products' && $method === 'POST' => (new MastersController)->createProduct(),
        $r0 === 'products' && $id && $method === 'PUT' => (new MastersController)->updateProduct($id),
        $r0 === 'products' && $id && $method === 'DELETE' => (new MastersController)->deleteProduct($id),

        $r0 === 'suppliers' && $method === 'GET' && !$id => (new MastersController)->getSuppliers(),
        $r0 === 'suppliers' && $method === 'GET' && $id => (new MastersController)->getSupplier((int)$id),
        $r0 === 'suppliers' && $method === 'POST' && !$id => (new MastersController)->createSupplier(),
        $r0 === 'suppliers' && $id && in_array($method, ['PUT', 'PATCH', 'POST']) => (new MastersController)->updateSupplier((int)$id),
        $r0 === 'suppliers' && $id && $method === 'DELETE' => (new MastersController)->deleteSupplier((int)$id),

        // Dyeing Mills
        $r0 === 'dyeing-mills' && $method === 'GET' && !$id => (new MastersController)->getDyeingMills(),
        $r0 === 'dyeing-mills' && $method === 'GET' && $id => (new MastersController)->getDyeingMill((int)$id),
        $r0 === 'dyeing-mills' && $method === 'POST' && !$id => (new MastersController)->createDyeingMill(),
        $r0 === 'dyeing-mills' && $id && in_array($method, ['PUT', 'PATCH', 'POST']) => (new MastersController)->updateDyeingMill((int)$id),
        $r0 === 'dyeing-mills' && $id && $method === 'DELETE' => (new MastersController)->deleteDyeingMill((int)$id),

        // Embroidery Works
        $r0 === 'embroidery-works' && $method === 'GET' && !$id => (new MastersController)->getEmbroideryWorks(),
        $r0 === 'embroidery-works' && $method === 'GET' && $id => (new MastersController)->getEmbroideryWork((int)$id),
        $r0 === 'embroidery-works' && $method === 'POST' && !$id => (new MastersController)->createEmbroideryWork(),
        $r0 === 'embroidery-works' && $id && in_array($method, ['PUT', 'PATCH', 'POST']) => (new MastersController)->updateEmbroideryWork((int)$id),
        $r0 === 'embroidery-works' && $id && $method === 'DELETE' => (new MastersController)->deleteEmbroideryWork((int)$id),

        ($r0 === 'customers' || $r0 === 'buyers') && $id && $r2 === 'products' && isset($segments[3]) && $method === 'GET' => (new MastersController)->getBuyerProduct($id, (int)$segments[3]),
        ($r0 === 'customers' || $r0 === 'buyers') && $id && $r2 === 'products' && $method === 'GET' => (new MastersController)->getBuyerProducts($id),
        ($r0 === 'customers' || $r0 === 'buyers') && $id && $r2 === 'products' && $method === 'POST' => (new MastersController)->createBuyerProduct($id),
        ($r0 === 'customers' || $r0 === 'buyers') && $id && $r2 === 'products' && isset($segments[3]) && $method === 'PUT' => (new MastersController)->updateBuyerProduct($id, (int)$segments[3]),
        ($r0 === 'customers' || $r0 === 'buyers') && $id && $r2 === 'products' && isset($segments[3]) && $method === 'DELETE' => (new MastersController)->deleteBuyerProduct($id, (int)$segments[3]),
        ($r0 === 'customers' || $r0 === 'buyers') && $method === 'GET' && !$id => (new MastersController)->getCustomers(),
        ($r0 === 'customers' || $r0 === 'buyers') && $method === 'POST' && !$id => (new MastersController)->createCustomer(),
        ($r0 === 'customers' || $r0 === 'buyers') && ($method === 'PUT' || $method === 'PATCH') && $id => (new MastersController)->updateCustomer((int)$id),

        $r0 === 'pantone-colors' && $method === 'GET' => (new MastersController)->lookupPantoneColor(),
        $r0 === 'pantone-colors' && $method === 'POST' => (new MastersController)->createPantoneColor(),
        $r0 === 'pantone-colors' && $id && $method === 'PUT' => (new MastersController)->updatePantoneColor($id),
        $r0 === 'pantone-colors' && $id && $method === 'DELETE' => (new MastersController)->deletePantoneColor($id),
        $r0 === 'colors' && $method === 'GET' => (new MastersController)->getColors(),
        $r0 === 'colors' && $method === 'POST' => (new MastersController)->createColor(),
        $r0 === 'colors' && $id && $method === 'PUT' => (new MastersController)->updateColor($id),
        $r0 === 'colors' && $id && $method === 'DELETE' => (new MastersController)->deleteColor($id),

        $r0 === 'sizes' && $method === 'GET' => (new MastersController)->getSizes(),
        $r0 === 'sizes' && $method === 'POST' => (new MastersController)->createSize(),

        $r0 === 'units' && $method === 'GET' => (new MastersController)->getUnits(),
        $r0 === 'units' && $method === 'POST' => (new MastersController)->createUnit(),

        $r0 === 'designs' && $method === 'GET' => (new MastersController)->getDesigns(),
        $r0 === 'designs' && $method === 'POST' => (new MastersController)->createDesign(),

        // ---------------- DYEING MILLS MASTER ----------------
        $r0 === 'dyeing-mills' && $method === 'GET' && !$id => (new MastersController)->getDyeingMills(),
        $r0 === 'dyeing-mills' && $method === 'POST' && !$id => (new MastersController)->createDyeingMill(),
        $r0 === 'dyeing-mills' && $id && ($method === 'PUT' || $method === 'PATCH') => (new MastersController)->updateDyeingMill((int)$id),
        $r0 === 'dyeing-mills' && $id && $method === 'DELETE' => (new MastersController)->deleteDyeingMill((int)$id),

        // ---------------- EMBROIDERY WORKS MASTER ----------------
        $r0 === 'embroidery-works' && $method === 'GET' && !$id => (new MastersController)->getEmbroideryWorks(),
        $r0 === 'embroidery-works' && $method === 'POST' && !$id => (new MastersController)->createEmbroideryWork(),
        $r0 === 'embroidery-works' && $id && ($method === 'PUT' || $method === 'PATCH') => (new MastersController)->updateEmbroideryWork((int)$id),
        $r0 === 'embroidery-works' && $id && $method === 'DELETE' => (new MastersController)->deleteEmbroideryWork((int)$id),

        // ---------------- TEMPLATES ----------------
        $r0 === 'templates' && $method === 'GET' => (new TemplatesController)->index(),
        $r0 === 'templates' && $method === 'POST' => (new TemplatesController)->store(),

        // ---------------- REPORTS ----------------
        $r0 === 'reports' && $r1 === 'purchase' => (new ReportsController)->purchaseReport(),
        $r0 === 'reports' && $r1 === 'inventory' => (new ReportsController)->inventoryReport(),
        $r0 === 'reports' && $r1 === 'production' => (new ReportsController)->productionReport(),
        $r0 === 'reports' && $r1 === 'qc' => (new ReportsController)->qcReport(),
        $r0 === 'reports' && $r1 === 'payments' => (new ReportsController)->paymentReport(),

        // ---------------- SETTINGS ----------------
        $r0 === 'settings' && $r1 === 'users' && $method === 'GET' => (new SettingsController)->getUsers(),
        $r0 === 'settings' && $r1 === 'users' && $method === 'POST' => (new SettingsController)->createUser(),
        $r0 === 'settings' && $r1 === 'users' && $id && $method === 'PUT' => (new SettingsController)->updateUser($id),
        $r0 === 'settings' && $r1 === 'roles' => (new SettingsController)->getRoles(),
        $r0 === 'settings' && $r1 === 'permissions' => (new SettingsController)->getPermissions(),
        $r0 === 'settings' && $r1 === 'stages' && $method === 'GET' => (new SettingsController)->getStages(),
        $r0 === 'settings' && $r1 === 'stages' && $method === 'POST' => (new SettingsController)->createStage(),
        $r0 === 'settings' && $r1 === 'company' && $method === 'GET' => (new SettingsController)->getCompanySettings(),
        $r0 === 'settings' && $r1 === 'company' && $method === 'POST' => (new SettingsController)->updateCompanySettings(),
        $r0 === 'settings' && $r1 === 'po-template' && $r2 === 'restore-defaults' && $method === 'POST' => (new POTemplateController)->restoreDefaults(),
        $r0 === 'settings' && $r1 === 'po-template' && $method === 'GET' => (new POTemplateController)->getSettings(),
        $r0 === 'settings' && $r1 === 'po-template' && in_array($method, ['POST', 'PUT']) => (new POTemplateController)->saveSettings(),

        default => Response::error("Endpoint not found: {$method} /" . implode('/', $segments), 404)
    };
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    Response::error("Server error: " . $e->getMessage(), 500);
}

function handleDashboard(): void {
    $pdo = Database::getConnection();

    $kpis = [];
    $kpis['total_purchase_orders'] = (int)$pdo->query("SELECT COUNT(*) FROM purchase_orders WHERE deleted_at IS NULL")->fetchColumn();
    $kpis['pending_payments_po'] = (int)$pdo->query("SELECT COUNT(*) FROM purchase_orders WHERE payment_status != 'Paid' AND deleted_at IS NULL")->fetchColumn();
    $kpis['pending_payment_amount'] = (float)$pdo->query("SELECT COALESCE(SUM(balance_amount),0) FROM purchase_orders WHERE balance_amount > 0 AND deleted_at IS NULL")->fetchColumn();
    $kpis['low_stock_count'] = (int)$pdo->query("SELECT COUNT(*) FROM materials m LEFT JOIN stock_balances sb ON m.id = sb.material_id WHERE COALESCE(sb.current_quantity,0) <= m.min_stock_level AND m.deleted_at IS NULL")->fetchColumn();
    $kpis['production_orders'] = (int)$pdo->query("SELECT COUNT(*) FROM production_orders WHERE status = 'IN PRODUCTION' AND deleted_at IS NULL")->fetchColumn();
    $kpis['completed_orders'] = (int)$pdo->query("SELECT COUNT(*) FROM production_orders WHERE status = 'COMPLETED' AND deleted_at IS NULL")->fetchColumn();

    $lowStock = $pdo->query("
        SELECT m.name, m.uom, m.min_stock_level, COALESCE(sb.current_quantity,0) as current_stock, c.name as category_name
        FROM materials m
        JOIN categories c ON m.category_id = c.id
        LEFT JOIN stock_balances sb ON m.id = sb.material_id
        WHERE COALESCE(sb.current_quantity,0) <= m.min_stock_level AND m.deleted_at IS NULL
        ORDER BY (m.min_stock_level - COALESCE(sb.current_quantity,0)) DESC
        LIMIT 8
    ")->fetchAll();

    $recentPOs = $pdo->query("
        SELECT po.po_number, po.status, po.payment_status, po.net_amount, po.balance_amount, po.po_date, s.name as supplier_name
        FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.deleted_at IS NULL
        ORDER BY po.id DESC LIMIT 6
    ")->fetchAll();

    $recentProduction = $pdo->query("
        SELECT po.order_number, po.status, po.total_quantity, po.completed_quantity, po.target_delivery_date, cu.name as customer_name
        FROM production_orders po
        LEFT JOIN customers cu ON po.customer_id = cu.id
        WHERE po.deleted_at IS NULL
        ORDER BY po.id DESC LIMIT 6
    ")->fetchAll();

    Response::success([
        'kpis' => $kpis,
        'low_stock' => $lowStock,
        'recent_purchase_orders' => $recentPOs,
        'recent_production' => $recentProduction
    ]);
}
