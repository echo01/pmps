import { Navigate, createBrowserRouter } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { can } from '../auth/permission';
import { LoadingPanel } from '../components/common/LoadingPanel';
import { NoPermission } from '../components/common/NoPermission';
import { MainLayout } from '../layouts/MainLayout';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { LotDetailPage } from '../pages/reports/LotDetailPage';
import { QaSamplingDetailPage } from '../pages/reports/QaSamplingDetailPage';
import { QcInspectionDetailPage } from '../pages/reports/QcInspectionDetailPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { SerialDetailPage } from '../pages/reports/SerialDetailPage';

function ProtectedRoute({ permission }: { permission?: string }) {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return <LoadingPanel label="Checking session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !can(permission, user?.permissions || [])) {
    return <NoPermission />;
  }

  return <MainLayout />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
    ],
  },
  {
    path: '/reports',
    element: <ProtectedRoute permission="SearchReport" />,
    children: [
      { index: true, element: <ReportsPage /> },
      { path: 'lots/:lotId', element: <LotDetailPage /> },
      { path: 'serials/:productUnitId', element: <SerialDetailPage /> },
      { path: 'qc-inspections/:id', element: <QcInspectionDetailPage /> },
      { path: 'qa-samplings/:id', element: <QaSamplingDetailPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
