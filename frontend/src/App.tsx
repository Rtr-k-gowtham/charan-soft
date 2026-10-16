// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import PwaInstallPrompt from './components/pwa/PwaInstallPrompt';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />

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

              {/* Production - 10 Core Stages */}
              <Route path="/production/orders" element={<ProductionOrders />} />
              <Route path="/production/orders/:id" element={<ProductionOrderDetail />} />
              <Route path="/production/orders/create" element={<CreateProductionOrder />} />
              <Route path="/production/board" element={<ProductionBoard />} />
              <Route path="/production/requirement" element={<ProductionStageView stageName="Requirement Gathering" stageCode="REQ" breadcrumb={['01. Requirement gathering']} />} />
              <Route path="/production/requirement/:id" element={<RequirementOrderDetail />} />
              <Route path="/production/po" element={<ProductionStageView stageName="Purchase Order (PO)" stageCode="PO" breadcrumb={['02. PO (Purchase Order)']} />} />
              <Route path="/production/po/:id" element={<POOrderDetail />} />
              <Route path="/production/inward" element={<ProductionStageView stageName="Inward" stageCode="INW" breadcrumb={['03. Inward']} />} />
              <Route path="/production/inward/:id" element={<InwardOrderDetail />} />
              <Route path="/production/dyeing" element={<ProductionStageView stageName="Dyeing" stageCode="DYE" breadcrumb={['04. Dyeing']} />} />
              <Route path="/production/dyeing/:id" element={<DyeingOrderDetail />} />
              <Route path="/production/cutting" element={<ProductionStageView stageName="Cutting — Product-wise" stageCode="CUT" breadcrumb={['05. Cutting — Product-wise']} />} />
              <Route path="/production/cutting/:id" element={<CuttingOrderDetail />} />
              <Route path="/production/embroidery" element={<ProductionStageView stageName="Embroidery — Outward / Inward" stageCode="EMB" breadcrumb={['06. Embroidery — Outward / Inward']} />} />
              <Route path="/production/embroidery/:id" element={<EmbroideryOrderDetail />} />
              <Route path="/production/stitching" element={<ProductionStageView stageName="Stitching — Color-wise Tracking" stageCode="STI" breadcrumb={['07. Stitching — Color-wise Tracking']} />} />
              <Route path="/production/stitching/:id" element={<StitchingOrderDetail />} />
              <Route path="/production/checking" element={<ProductionStageView stageName="Checking" stageCode="CHK" breadcrumb={['08. Checking']} />} />
              <Route path="/production/checking/:id" element={<CheckingOrderDetail />} />
              <Route path="/production/packing" element={<ProductionStageView stageName="Packing" stageCode="PCK" breadcrumb={['09. Packing']} />} />
              <Route path="/production/packing/:id" element={<PackingOrderDetail />} />
              <Route path="/production/completed" element={<ProductionStageView stageName="Completed" stageCode="COMP" breadcrumb={['10. Completed']} />} />
              <Route path="/production/completed/:id" element={<DispatchOrderDetail />} />

              {/* Backward compatibility redirects for legacy stage links */}
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

              {/* Reports */}
              <Route path="/reports/*" element={<Reports />} />

              {/* Settings */}
              <Route path="/settings/users" element={<UsersPage />} />
              <Route path="/settings/roles" element={<RolesPage />} />
              <Route path="/settings/permissions" element={<RolesPage />} />
              <Route path="/settings/stages" element={<ProductionStagesPage />} />
              <Route path="/settings/company" element={<CompanySettingsPage />} />
              <Route path="/settings/po-template" element={<POTemplateSettings />} />

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
