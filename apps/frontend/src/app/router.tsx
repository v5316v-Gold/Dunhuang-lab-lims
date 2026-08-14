// =====================================================
// 路由配置
// =====================================================

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { MainLayout } from '../views/layout/MainLayout';
import { RequireAuth } from './RequireAuth';

const LoginPage = lazy(() => import('../views/auth/Login'));
const DashboardPage = lazy(() => import('../views/dashboard/Dashboard'));
const SamplesListPage = lazy(() => import('../views/sample/SamplesList'));
const SampleReceivePage = lazy(() => import('../views/sample/SampleReceive'));
const BatchesListPage = lazy(() => import('../views/batch/BatchesList'));
const BatchDetailPage = lazy(() => import('../views/batch/BatchDetail'));
const TestsListPage = lazy(() => import('../views/test/TestsList'));
const ReportsListPage = lazy(() => import('../views/report/ReportsList'));
const ReportDetailPage = lazy(() => import('../views/report/ReportDetail'));
const QcDashboardPage = lazy(() => import('../views/qc/QcDashboard'));
const EquipmentListPage = lazy(() => import('../views/equipment/EquipmentList'));
const PersonnelListPage = lazy(() => import('../views/personnel/PersonnelList'));
const ReagentsListPage = lazy(() => import('../views/reagent/ReagentsList'));
const AuditLogsPage = lazy(() => import('../views/audit/AuditLogs'));

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
          <Route path="samples/receive" element={<SampleReceivePage />} />
          <Route path="batches" element={<BatchesListPage />} />
          <Route path="batches/:id" element={<BatchDetailPage />} />
          <Route path="tests" element={<TestsListPage />} />
          <Route path="reports" element={<ReportsListPage />} />
          <Route path="reports/:id" element={<ReportDetailPage />} />
          <Route path="qc" element={<QcDashboardPage />} />
          <Route path="equipment" element={<EquipmentListPage />} />
          <Route path="personnel" element={<PersonnelListPage />} />
          <Route path="reagents" element={<ReagentsListPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}