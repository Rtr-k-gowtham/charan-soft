// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';

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
import ProductionBoard from './pages/production/ProductionBoard';
import ProductionStageView from './pages/production/ProductionStageView';

// Masters
import Products from './pages/masters/Products';
import Suppliers from './pages/masters/Suppliers';
import Customers from './pages/masters/Customers';
import Categories from './pages/masters/Categories';
import ColorsPage from './pages/masters/ColorsPage';
import SizesPage from './pages/masters/SizesPage';
import UnitsPage from './pages/masters/UnitsPage';
import DesignsPage from './pages/masters/DesignsPage';

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

              {/* Production */}
              <Route path="/production/orders" element={<ProductionOrders />} />
              <Route path="/production/board" element={<ProductionBoard />} />
              <Route path="/production/installation" element={<ProductionStageView stageName="Installation" stageCode="INST" breadcrumb={['Installation']} />} />
              <Route path="/production/dyeing" element={<ProductionStageView stageName="Dyeing" stageCode="DYE" breadcrumb={['Dyeing']} />} />
              <Route path="/production/detailing" element={<ProductionStageView stageName="Detailing" stageCode="DET" breadcrumb={['Detailing']} />} />
              <Route path="/production/cutting" element={<ProductionStageView stageName="Cutting" stageCode="CUT" breadcrumb={['Cutting']} />} />
              <Route path="/production/stitching" element={<ProductionStageView stageName="Stitching" stageCode="STI" breadcrumb={['Stitching']} />} />
              <Route path="/production/qc" element={<ProductionStageView stageName="QC" stageCode="QC" breadcrumb={['Quality Control']} />} />
              <Route path="/production/rework" element={<ProductionStageView stageName="Rework" stageCode="RWK" breadcrumb={['Rework']} />} />
              <Route path="/production/completed" element={<ProductionStageView stageName="Completed" stageCode="COMP" breadcrumb={['Completed']} />} />

              {/* Masters */}
              <Route path="/masters/products" element={<Products />} />
              <Route path="/masters/materials" element={<Materials />} />
              <Route path="/masters/categories" element={<Categories />} />
              <Route path="/masters/suppliers" element={<Suppliers />} />
              <Route path="/masters/customers" element={<Customers />} />
              <Route path="/masters/colors" element={<ColorsPage />} />
              <Route path="/masters/sizes" element={<SizesPage />} />
              <Route path="/masters/units" element={<UnitsPage />} />
              <Route path="/masters/designs" element={<DesignsPage />} />

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
      </AuthProvider>
    </BrowserRouter>
  );
}
