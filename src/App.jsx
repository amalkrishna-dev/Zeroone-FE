import React, { useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import apiClient, { SESSION_EXPIRED_EVENT } from './api/client';
import { getAccessToken, clearTokens } from './api/tokenStorage';
import useIdleTimeout from './hooks/useIdleTimeout';
import SessionExpiredModal from './components/SessionExpiredModal';

// Idle timeout before a signed-in session is ended (default 30 min).
const IDLE_TIMEOUT_MS =
  (Number(process.env.REACT_APP_IDLE_TIMEOUT_MIN) || 30) * 60 * 1000;

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

// The dashboard a given role lands on. Single source of truth so every
// guard (protected routes, root redirect, and the login-page guard) agrees.
function roleHome(user) {
  if (user?.role === 'global_admin') return '/global-admin';
  if (user?.role === 'org_admin' || user?.role === 'employee') return '/org-admin';
  if (user?.role === 'admin') return '/admin/dashboard';
  return '/dashboard';
}

// Staff/company areas send unauthenticated visitors to the company login;
// everything else falls back to the customer login.
const STAFF_ROLES = ['global_admin', 'org_admin', 'employee', 'admin'];
function loginPathFor(allowedRoles) {
  if (allowedRoles && allowedRoles.every(r => STAFF_ROLES.includes(r))) {
    return '/company-login';
  }
  return '/login';
}

function ProtectedRoute({ children, allowedRoles = null }) {
  const { user, isAuthenticated, isInitializing } = useAuthStore();
  if (isInitializing) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to={loginPathFor(allowedRoles)} replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={roleHome(user)} replace />;
  }
  return children;
}

// Login / staff-login pages. A logged-in user must never reach these -
// not by URL, in-app link, or the browser Back button. The only way back
// to a login screen is to sign out (or confirm the session-timeout modal),
// which clears auth state and lets this guard fall through to the page.
function PublicOnlyRoute({ children }) {
  const { user, isAuthenticated, isInitializing } = useAuthStore();
  if (isInitializing) return <PageLoader />;
  if (isAuthenticated) return <Navigate to={roleHome(user)} replace />;
  return children;
}

function RootRedirect() {
  const { user, isAuthenticated, isInitializing } = useAuthStore();
  if (isInitializing) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/properties" replace />;
  return <Navigate to={roleHome(user)} replace />;
}

// Owns the "session expired" lifecycle: arms an idle timer while signed
// in, listens for the refresh-failure event from the API client, and shows
// a blocking modal. The only exit is "Sign in again", which clears auth and
// returns to the login page. Must live inside <Router> (uses navigation).
function SessionGate() {
  const navigate = useNavigate();
  const { user, isAuthenticated, sessionExpired, expireSession, logout } = useAuthStore();

  const handleExpire = useCallback(() => {
    // Drop tokens immediately so any in-flight requests stop succeeding,
    // but keep `user` in state so the modal can greet them by name.
    clearTokens();
    expireSession();
  }, [expireSession]);

  // Idle timeout (only armed while signed in and not already expired).
  useIdleTimeout(handleExpire, {
    timeoutMs: IDLE_TIMEOUT_MS,
    enabled: isAuthenticated && !sessionExpired,
  });

  // Token-refresh failures raised by the axios interceptor.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpire);
  }, [handleExpire]);

  const handleSignIn = useCallback(() => {
    const dest = STAFF_ROLES.includes(user?.role) ? '/company-login' : '/login';
    logout();
    navigate(dest, { replace: true });
  }, [logout, navigate, user]);

  return (
    <SessionExpiredModal open={sessionExpired} name={user?.name} onSignIn={handleSignIn} />
  );
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
          {/* Public routes - blocked once authenticated (sign out to return) */}
          <Route path="/login" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
          <Route path="/company-login" element={<PublicOnlyRoute><AdminAuth /></PublicOnlyRoute>} />
          {/* Legacy staff URL → company login */}
          <Route path="/staff" element={<Navigate to="/company-login" replace />} />
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
      <SessionGate />
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
