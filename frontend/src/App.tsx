// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import PwaInstallPrompt from './components/pwa/PwaInstallPrompt';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/tasks/MyTasks';

// Purchase
import PurchaseOrders from './pages/purchase/PurchaseOrders';
import MaterialReceipts from './pages/purchase/MaterialReceipts';
import SupplierPayments from './pages/purchase/SupplierPayments';
import PurchaseReturns from './pages/purchase/PurchaseReturns';

// Inventory
import Inventory from './pages/inventory/Inventory';
import Materials from './pages/masters/Materials';
import StockLedger from './pages/inventory/StockLedger';
import MaterialConsumption from './pages/inventory/MaterialConsumption';
import StockAdjustment from './pages/inventory/StockAdjustment';
import LowStock from './pages/inventory/LowStock';

// Production
import ProductionOrders from './pages/production/ProductionOrders';
import ProductionOrderDetail from './pages/production/ProductionOrderDetail';
import CreateProductionOrder from './pages/production/CreateProductionOrder';
import ProductionBoard from './pages/production/ProductionBoard';
import ProductionStageView from './pages/production/ProductionStageView';
import RequirementOrderDetail from './pages/production/RequirementOrderDetail';
import POOrderDetail from './pages/production/POOrderDetail';
import InwardOrderDetail from './pages/production/InwardOrderDetail';
import DyeingOrderDetail from './pages/production/DyeingOrderDetail';
import CuttingOrderDetail from './pages/production/CuttingOrderDetail';
import EmbroideryOrderDetail from './pages/production/EmbroideryOrderDetail';
import StitchingOrderDetail from './pages/production/StitchingOrderDetail';
import CheckingOrderDetail from './pages/production/CheckingOrderDetail';
import PackingOrderDetail from './pages/production/PackingOrderDetail';
import DispatchOrderDetail from './pages/production/DispatchOrderDetail';

// Masters
import Products from './pages/masters/Products';
import Suppliers from './pages/masters/Suppliers';
import Buyers from './pages/masters/Buyers';
import BuyerProductDetail from './pages/masters/BuyerProductDetail';
import Categories from './pages/masters/Categories';
import ColorsPage from './pages/masters/ColorsPage';
import SizesPage from './pages/masters/SizesPage';
import UnitsPage from './pages/masters/UnitsPage';
import DesignsPage from './pages/masters/DesignsPage';
import DyeingMills from './pages/masters/DyeingMills';
import EmbroideryWorks from './pages/masters/EmbroideryWorks';

// Templates
import MaterialTemplates, { ProductTemplates, OrderTemplates, POTemplates } from './pages/templates/Templates';

// Reports
import Reports from './pages/reports/Reports';

// Settings
import { UsersPage, RolesPage, ProductionStagesPage, CompanySettingsPage } from './pages/settings/Settings';
import POTemplateSettings from './pages/settings/POTemplateSettings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Loading Cheran ERP...</p>
        </div>
      </div>
    );
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Stage-specific route authorization guard
function StageRouteGuard({ stageId, children }: { stageId: number; children: React.ReactNode }) {
  const { user } = useAuth();
  const role = (user?.role || '').trim();
  const isAdmin = role === 'Admin' || role === 'admin' || user?.id === 1;

  if (isAdmin) return <>{children}</>;

  const role1Stages = [1, 2, 3, 9, 10];
  const role2Stages = [4, 5, 6, 7, 8];

  let allowed = user?.allowed_stages;
  if (!allowed || allowed.length === 0) {
    if (role === 'Role 1') allowed = role1Stages;
    else if (role === 'Role 2') allowed = role2Stages;
    else allowed = [];
  }

  if (allowed.includes(stageId)) {
    return <>{children}</>;
  }

  // Unauthorized operational stage access redirects to /tasks
  return <Navigate to="/tasks" replace />;
}

// Admin-only route guard
function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = (user?.role || '').trim();
  const isAdmin = role === 'Admin' || role === 'admin' || user?.id === 1;

  if (isAdmin) return <>{children}</>;
  return <Navigate to="/tasks" replace />;
}

// Post-login / Root router
function RootIndexRedirect() {
  const { user } = useAuth();
  const role = (user?.role || '').trim();
  const isAdmin = role === 'Admin' || role === 'admin' || user?.id === 1;

  if (isAdmin) {
    return <Dashboard />;
  }
  return <Navigate to="/tasks" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppLayout>
            <Routes>
              {/* Root redirect: Admin -> Dashboard, Role 1/2 -> /tasks */}
              <Route path="/" element={<RootIndexRedirect />} />
              <Route path="/dashboard" element={<AdminRouteGuard><Dashboard /></AdminRouteGuard>} />

              {/* Operational Tasks Screen */}
              <Route path="/tasks" element={<MyTasks />} />

              {/* Purchase */}
              <Route path="/purchase/orders" element={<PurchaseOrders />} />
              <Route path="/purchase/orders/:id" element={<PurchaseOrders />} />
              <Route path="/purchase/orders/:id/edit" element={<PurchaseOrders />} />
              <Route path="/purchase/receipts" element={<MaterialReceipts />} />
              <Route path="/purchase/payments" element={<SupplierPayments />} />
              <Route path="/purchase/returns" element={<PurchaseReturns />} />

              {/* Inventory */}
              <Route path="/inventory/materials" element={<Materials />} />
              <Route path="/inventory/stock" element={<Inventory />} />
              <Route path="/inventory/ledger" element={<StockLedger />} />
              <Route path="/inventory/consumption" element={<MaterialConsumption />} />
              <Route path="/inventory/adjustment" element={<StockAdjustment />} />
              <Route path="/inventory/low-stock" element={<LowStock />} />

              {/* Production - 10 Core Stages with Role Route Guards */}
              <Route path="/production/orders" element={<ProductionOrders />} />
              <Route path="/production/orders/:id" element={<ProductionOrderDetail />} />
              <Route path="/production/orders/create" element={<CreateProductionOrder />} />
              <Route path="/production/board" element={<ProductionBoard />} />

              {/* Stage 01: Requirement Gathering */}
              <Route path="/production/requirement" element={
                <StageRouteGuard stageId={1}>
                  <ProductionStageView stageName="Requirement Gathering" stageCode="REQ" breadcrumb={['01. Requirement gathering']} />
                </StageRouteGuard>
              } />
              <Route path="/production/requirement/:id" element={
                <StageRouteGuard stageId={1}><RequirementOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 02: PO */}
              <Route path="/production/po" element={
                <StageRouteGuard stageId={2}>
                  <ProductionStageView stageName="Purchase Order (PO)" stageCode="PO" breadcrumb={['02. PO (Purchase Order)']} />
                </StageRouteGuard>
              } />
              <Route path="/production/po/:id" element={
                <StageRouteGuard stageId={2}><POOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 03: Inward */}
              <Route path="/production/inward" element={
                <StageRouteGuard stageId={3}>
                  <ProductionStageView stageName="Inward" stageCode="INW" breadcrumb={['03. Inward']} />
                </StageRouteGuard>
              } />
              <Route path="/production/inward/:id" element={
                <StageRouteGuard stageId={3}><InwardOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 04: Dyeing */}
              <Route path="/production/dyeing" element={
                <StageRouteGuard stageId={4}>
                  <ProductionStageView stageName="Dyeing" stageCode="DYE" breadcrumb={['04. Dyeing']} />
                </StageRouteGuard>
              } />
              <Route path="/production/dyeing/:id" element={
                <StageRouteGuard stageId={4}><DyeingOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 05: Cutting */}
              <Route path="/production/cutting" element={
                <StageRouteGuard stageId={5}>
                  <ProductionStageView stageName="Cutting — Product-wise" stageCode="CUT" breadcrumb={['05. Cutting — Product-wise']} />
                </StageRouteGuard>
              } />
              <Route path="/production/cutting/:id" element={
                <StageRouteGuard stageId={5}><CuttingOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 06: Embroidery */}
              <Route path="/production/embroidery" element={
                <StageRouteGuard stageId={6}>
                  <ProductionStageView stageName="Embroidery — Outward / Inward" stageCode="EMB" breadcrumb={['06. Embroidery — Outward / Inward']} />
                </StageRouteGuard>
              } />
              <Route path="/production/embroidery/:id" element={
                <StageRouteGuard stageId={6}><EmbroideryOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 07: Stitching */}
              <Route path="/production/stitching" element={
                <StageRouteGuard stageId={7}>
                  <ProductionStageView stageName="Stitching — Color-wise Tracking" stageCode="STI" breadcrumb={['07. Stitching — Color-wise Tracking']} />
                </StageRouteGuard>
              } />
              <Route path="/production/stitching/:id" element={
                <StageRouteGuard stageId={7}><StitchingOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 08: Checking */}
              <Route path="/production/checking" element={
                <StageRouteGuard stageId={8}>
                  <ProductionStageView stageName="Checking" stageCode="CHK" breadcrumb={['08. Checking']} />
                </StageRouteGuard>
              } />
              <Route path="/production/checking/:id" element={
                <StageRouteGuard stageId={8}><CheckingOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 09: Packing */}
              <Route path="/production/packing" element={
                <StageRouteGuard stageId={9}>
                  <ProductionStageView stageName="Packing" stageCode="PCK" breadcrumb={['09. Packing']} />
                </StageRouteGuard>
              } />
              <Route path="/production/packing/:id" element={
                <StageRouteGuard stageId={9}><PackingOrderDetail /></StageRouteGuard>
              } />

              {/* Stage 10: Completed */}
              <Route path="/production/completed" element={
                <StageRouteGuard stageId={10}>
                  <ProductionStageView stageName="Completed" stageCode="COMP" breadcrumb={['10. Completed']} />
                </StageRouteGuard>
              } />
              <Route path="/production/completed/:id" element={
                <StageRouteGuard stageId={10}><DispatchOrderDetail /></StageRouteGuard>
              } />

              {/* Backward compatibility redirects */}
              <Route path="/production/installation" element={<Navigate to="/production/requirement" replace />} />
              <Route path="/production/detailing" element={<Navigate to="/production/dyeing" replace />} />
              <Route path="/production/qc" element={<Navigate to="/production/checking" replace />} />
              <Route path="/production/rework" element={<Navigate to="/production/checking" replace />} />

              {/* Masters */}
              <Route path="/masters/products" element={<Products />} />
              <Route path="/masters/materials" element={<Materials />} />
              <Route path="/masters/categories" element={<Categories />} />
              <Route path="/masters/suppliers" element={<Suppliers />} />
              <Route path="/masters/buyers" element={<Buyers />} />
              <Route path="/masters/buyers/:buyerId/products" element={<Buyers />} />
              <Route path="/masters/buyers/:buyerId/products/:productId" element={<BuyerProductDetail />} />
              <Route path="/masters/customers" element={<Buyers />} />
              <Route path="/masters/customers/:buyerId/products" element={<Buyers />} />
              <Route path="/masters/customers/:buyerId/products/:productId" element={<BuyerProductDetail />} />
              <Route path="/masters/colors" element={<ColorsPage />} />
              <Route path="/masters/sizes" element={<SizesPage />} />
              <Route path="/masters/units" element={<UnitsPage />} />
              <Route path="/masters/designs" element={<DesignsPage />} />
              <Route path="/masters/dyeing-mills" element={<DyeingMills />} />
              <Route path="/masters/embroidery-works" element={<EmbroideryWorks />} />

              {/* Templates */}
              <Route path="/templates/material" element={<MaterialTemplates />} />
              <Route path="/templates/product" element={<ProductTemplates />} />
              <Route path="/templates/order" element={<OrderTemplates />} />
              <Route path="/templates/po" element={<POTemplateSettings />} />

              {/* Reports - Admin Guard */}
              <Route path="/reports/*" element={<AdminRouteGuard><Reports /></AdminRouteGuard>} />

              {/* Settings - Admin Guard */}
              <Route path="/settings/users" element={<AdminRouteGuard><UsersPage /></AdminRouteGuard>} />
              <Route path="/settings/roles" element={<AdminRouteGuard><RolesPage /></AdminRouteGuard>} />
              <Route path="/settings/permissions" element={<AdminRouteGuard><RolesPage /></AdminRouteGuard>} />
              <Route path="/settings/stages" element={<AdminRouteGuard><ProductionStagesPage /></AdminRouteGuard>} />
              <Route path="/settings/company" element={<AdminRouteGuard><CompanySettingsPage /></AdminRouteGuard>} />
              <Route path="/settings/po-template" element={<AdminRouteGuard><POTemplateSettings /></AdminRouteGuard>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <PwaInstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  );
}
