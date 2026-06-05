import { Navigate, createBrowserRouter } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { can } from '../auth/permission';
import { LoadingPanel } from '../components/common/LoadingPanel';
import { NoPermission } from '../components/common/NoPermission';
import { MainLayout } from '../layouts/MainLayout';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { EquipmentMasterPage } from '../pages/master-data/EquipmentMasterPage';
import { EquipmentTypesPage } from '../pages/master-data/EquipmentTypesPage';
import { ModelRequiredEquipmentPage } from '../pages/master-data/ModelRequiredEquipmentPage';
import { ProductCategoriesPage } from '../pages/master-data/ProductCategoriesPage';
import { ProductModelsPage } from '../pages/master-data/ProductModelsPage';
import { ProductSubCategoriesPage } from '../pages/master-data/ProductSubCategoriesPage';
import { TemplateDetailPage } from '../pages/master-data/TemplateDetailPage';
import { TestTemplatesPage } from '../pages/master-data/TestTemplatesPage';
import { ProductionLotDetailPage } from '../pages/production/ProductionLotDetailPage';
import { ProductionLotsPage } from '../pages/production/ProductionLotsPage';
import { QaLotSamplingPage } from '../pages/qa/QaLotSamplingPage';
import { QaLotSearchPage } from '../pages/qa/QaLotSearchPage';
import { QaSamplingPage } from '../pages/qa/QaSamplingPage';
import { QcInspectionPage } from '../pages/qc/QcInspectionPage';
import { QcLotInspectionPage } from '../pages/qc/QcLotInspectionPage';
import { QcLotSearchPage } from '../pages/qc/QcLotSearchPage';
import { LotDetailPage } from '../pages/reports/LotDetailPage';
import { QaSamplingDetailPage } from '../pages/reports/QaSamplingDetailPage';
import { QcInspectionDetailPage } from '../pages/reports/QcInspectionDetailPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { SerialDetailPage } from '../pages/reports/SerialDetailPage';
import { RoleDetailPage } from '../pages/admin/RoleDetailPage';
import { RolesPage } from '../pages/admin/RolesPage';
import { UserDetailPage } from '../pages/admin/UserDetailPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { ChangePasswordPage } from '../pages/profile/ChangePasswordPage';
import { ProfilePage } from '../pages/profile/ProfilePage';

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
    path: '/production-lots',
    element: <ProtectedRoute permission="ProductionLot" />,
    children: [
      { index: true, element: <ProductionLotsPage /> },
      { path: ':id', element: <ProductionLotDetailPage /> },
    ],
  },
  {
    path: '/products',
    element: <ProtectedRoute permission="ProductMaster" />,
    children: [
      { path: 'categories', element: <ProductCategoriesPage /> },
      { path: 'sub-categories', element: <ProductSubCategoriesPage /> },
      { path: 'models', element: <ProductModelsPage /> },
    ],
  },
  {
    path: '/equipment',
    element: <ProtectedRoute permission="EquipmentMaster" />,
    children: [
      { path: 'types', element: <EquipmentTypesPage /> },
      { path: 'master', element: <EquipmentMasterPage /> },
    ],
  },
  {
    path: '/equipment/model-required',
    element: <ProtectedRoute permission="ModelRequiredEquipment" />,
    children: [
      { index: true, element: <ModelRequiredEquipmentPage /> },
    ],
  },
  {
    path: '/templates',
    element: <ProtectedRoute permission="TestTemplate" />,
    children: [
      { index: true, element: <TestTemplatesPage /> },
      { path: ':templateId', element: <TemplateDetailPage /> },
    ],
  },
  {
    path: '/qc/inspection',
    element: <ProtectedRoute permission="QCInspection" />,
    children: [
      { index: true, element: <QcLotSearchPage /> },
      { path: 'lots', element: <QcLotSearchPage /> },
      { path: 'lots/:lotId', element: <QcLotInspectionPage /> },
      { path: ':inspectionId', element: <QcInspectionPage /> },
    ],
  },
  {
    path: '/qa/sampling',
    element: <ProtectedRoute permission="QASampling" />,
    children: [
      { index: true, element: <QaLotSearchPage /> },
      { path: 'lots', element: <QaLotSearchPage /> },
      { path: 'lots/:lotId', element: <QaLotSamplingPage /> },
      { path: ':qaSamplingId', element: <QaSamplingPage /> },
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
  {
    path: '/admin',
    element: <ProtectedRoute permission="UserRole" />,
    children: [
      { path: 'users', element: <UsersPage /> },
      { path: 'users/:userId', element: <UserDetailPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'roles/:roleId', element: <RoleDetailPage /> },
    ],
  },
  {
    path: '/profile',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <ProfilePage /> },
      { path: 'password', element: <ChangePasswordPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
