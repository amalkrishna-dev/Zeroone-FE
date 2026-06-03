import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import apiClient from './api/client';
import { getAccessToken, clearTokens } from './api/tokenStorage';

const Auth = lazy(() => import('./pages/Auth'));
const AdminAuth = lazy(() => import('./pages/AdminAuth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PropertyDetails = lazy(() => import('./pages/PropertyDetails'));
const RoomDetails = lazy(() => import('./pages/RoomDetails'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const GlobalAdminDashboard = lazy(() => import('./pages/GlobalAdminDashboard'));
const OrgAdminDashboard = lazy(() => import('./pages/OrgAdminDashboard'));
const BookingDocument = lazy(() => import('./pages/BookingDocument'));
const AvailabilityCalendar = lazy(() => import('./pages/AvailabilityCalendar'));
const HousekeepingSubmit = lazy(() => import('./pages/HousekeepingSubmit'));
const ReportsDashboard = lazy(() => import('./pages/ReportsDashboard'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4">
      <span className="wordmark text-xl">
        Zero One<span className="wordmark-dot">.</span>
      </span>
      <div className="h-1 w-24 bg-ink-100 overflow-hidden rounded-full">
        <div className="h-full w-1/3 bg-teal-600 rounded-full animate-pulse-soft" />
      </div>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles = null }) {
  const { user, isAuthenticated, isInitializing } = useAuthStore();
  if (isInitializing) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    if (user?.role === 'global_admin') return <Navigate to="/global-admin" replace />;
    if (user?.role === 'org_admin' || user?.role === 'employee') return <Navigate to="/org-admin" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function RootRedirect() {
  const { user, isAuthenticated, isInitializing } = useAuthStore();
  if (isInitializing) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/properties" replace />;
  if (user?.role === 'global_admin') return <Navigate to="/global-admin" replace />;
  if (user?.role === 'org_admin') return <Navigate to="/org-admin" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === 'employee') return <Navigate to="/org-admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function App() {
  const { setUser, setTokens, setAuthenticated, setInitializing } = useAuthStore();

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      apiClient.get('/auth/profile')
        .then((response) => {
          setUser(response.data.user);
          setAuthenticated(true);
        })
        .catch(() => {
          clearTokens();
        })
        .finally(() => {
          setInitializing(false);
        });
    } else {
      setInitializing(false);
    }
  }, [setUser, setAuthenticated, setTokens, setInitializing]);

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Auth />} />
          <Route path="/staff" element={<AdminAuth />} />
          <Route path="/properties" element={<Dashboard publicMode />} />
          <Route path="/property/:propertyId" element={<PropertyDetails />} />
          <Route path="/property/:propertyId/room/:roomId" element={<RoomDetails />} />

          {/* Public token-based pages (no auth required) */}
          <Route path="/housekeeping/:bookingId" element={<HousekeepingSubmit />} />

          {/* Public legal pages */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Guest user dashboard */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['user']}>
              <Dashboard />
            </ProtectedRoute>
          } />

          {/* Booking document */}
          <Route path="/booking/:bookingId/document" element={
            <ProtectedRoute>
              <BookingDocument />
            </ProtectedRoute>
          } />

          {/* Legacy admin dashboard */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Global Admin */}
          <Route path="/global-admin" element={
            <ProtectedRoute allowedRoles={['global_admin']}>
              <GlobalAdminDashboard />
            </ProtectedRoute>
          } />

          {/* Org Admin + employees */}
          <Route path="/org-admin" element={
            <ProtectedRoute allowedRoles={['org_admin', 'employee', 'admin']}>
              <OrgAdminDashboard />
            </ProtectedRoute>
          } />

          {/* Availability Calendar */}
          <Route path="/calendar/:propertyId" element={
            <ProtectedRoute allowedRoles={['org_admin', 'admin', 'global_admin', 'employee']}>
              <AvailabilityCalendar />
            </ProtectedRoute>
          } />

          {/* Reports */}
          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={['org_admin', 'admin', 'global_admin']}>
              <ReportsDashboard />
            </ProtectedRoute>
          } />

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-center"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            background: '#0c1713',
            color: '#fff',
            fontSize: '13.5px',
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1px solid #24352d',
            boxShadow: '0 10px 28px -10px rgba(12,23,19,0.45)',
          },
          success: { iconTheme: { primary: '#1f9254', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
        }}
      />
    </Router>
  );
}

export default App;
