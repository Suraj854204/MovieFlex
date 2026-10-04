import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { AppShell } from './layout/AppShell';
import { Logo } from './components/ui/Logo';
import { Spinner } from './components/ui/Feedback';
import { Icon } from './components/ui/Icon';
import Landing from './pages/Landing';
import { LoginPage, SignupPage } from './pages/Auth';
import Home from './pages/Home';
import Discover from './pages/Discover';
import { MyRooms, History, Notifications } from './pages/Library';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

const RoomPage = lazy(() => import('./pages/Room'));

function BootScreen() {
  const { status, slowBoot, bootError, retry } = useAuth();
  return (
    <div className="boot">
      <Logo />
      {status === 'error' ? (
        <div className="boot-msg" role="alert"><Icon name="alert" size={22} /><p>{bootError || "We couldn't reach the server."}</p>
          <button className="btn btn-primary" onClick={retry}><Icon name="refresh" size={16} /> Try again</button></div>
      ) : (
        <div className="boot-msg"><Spinner label="Loading…" />{slowBoot && <p className="muted">Waking the server up — this can take up to 30 seconds on free hosting.</p>}</div>
      )}
    </div>
  );
}

/** Gate for signed-in pages. Remembers where the user was heading. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'loading' || status === 'error') return <BootScreen />;
  if (status === 'anon') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'loading' || status === 'error') return <BootScreen />;
  if (status === 'authed') {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith('/') ? from : '/home'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ConfirmProvider>
            <SocketProvider>
              <NotificationsProvider>
                <Routes>
                  <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
                  <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
                  <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
                  <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                    <Route path="/home" element={<Home />} />
                    <Route path="/discover" element={<Discover />} />
                    <Route path="/rooms" element={<MyRooms />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>
                  <Route path="/room/:code" element={<RequireAuth><Suspense fallback={<BootScreen />}><RoomPage /></Suspense></RequireAuth>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </NotificationsProvider>
            </SocketProvider>
          </ConfirmProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
