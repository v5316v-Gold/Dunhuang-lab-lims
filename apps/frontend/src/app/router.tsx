// =====================================================
// 路由配置
// =====================================================

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { MainLayout } from '../views/layout/MainLayout';
// Phase 2/3 填充页面: 直接 import(规避 lazy 渲染兼容问题)
import { TestsList } from '../views/test/TestsList';
import { ReportsList } from '../views/report/ReportsList';
import { EquipmentList } from '../views/equipment/EquipmentList';
import { PersonnelList } from '../views/personnel/PersonnelList';
import { ReagentsList } from '../views/reagent/ReagentsList';
import { GasList } from '../views/gas/GasList';
import { WasteList } from '../views/waste/WasteList';
import { ContainerList } from '../views/container/ContainerList';
import { PreciousMetalList } from '../views/precious-metal/PreciousMetalList';
import ScanPage from '../views/scan/ScanPage';
import { SampleDetail } from '../views/sample/SampleDetail';
import { RequireAuth } from './RequireAuth';

const LoginPage = lazy(() => import('../views/auth/Login'));
const DashboardPage = lazy(() => import('../views/dashboard/Dashboard'));
const SamplesListPage = lazy(() => import('../views/sample/SamplesList'));
const SampleReceivePage = lazy(() => import('../views/sample/SampleReceive'));
const BatchesListPage = lazy(() => import('../views/batch/BatchesList'));
const BatchDetailPage = lazy(() => import('../views/batch/BatchDetail'));
const ReportDetailPage = lazy(() =>
  import('../views/report/ReportDetail').then((m) => ({ default: m.ReportDetail })),
);
const QcDashboardPage = lazy(() => import('../views/qc/QcDashboard'));
const AuditLogsPage = lazy(() => import('../views/audit/AuditLogs'));
const CompliancePage = lazy(() => import('../views/compliance/ComplianceHub'));
const DocumentsPage = lazy(() => import('../views/documents/DocumentsPage'));
const AuthorizedSignatoriesPage = lazy(() => import('../views/authorized-signatories/AuthorizedSignatoriesPage'));
const SodPolicyPage = lazy(() => import('../views/sod-policy/SodPolicyPage'));

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <Spin size="large" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 受保护路由 */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="samples" element={<SamplesListPage />} />
          <Route path="samples/:id" element={<SampleDetail />} />
          <Route path="samples/receive" element={<SampleReceivePage />} />
          <Route path="batches" element={<BatchesListPage />} />
          <Route path="batches/:id" element={<BatchDetailPage />} />
          <Route path="tests" element={<TestsList />} />
          <Route path="reports" element={<ReportsList />} />
          <Route path="reports/:id" element={<ReportDetailPage />} />
          <Route path="qc" element={<QcDashboardPage />} />
          <Route path="equipment" element={<EquipmentList />} />
          <Route path="personnel" element={<PersonnelList />} />
          <Route path="reagents" element={<ReagentsList />} />
          <Route path="gas" element={<GasList />} />
          <Route path="waste" element={<WasteList />} />
          <Route path="container" element={<ContainerList />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="precious-metal" element={<PreciousMetalList />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="compliance" element={<CompliancePage />} />
          <Route path="authorized-signatories" element={<AuthorizedSignatoriesPage />} />
          <Route path="sod-policies" element={<SodPolicyPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}