import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/auth';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import CharactersPage from './pages/CharactersPage';
import CharacterEditPage from './pages/CharacterEditPage';
import GamesPage from './pages/GamesPage';
import GameLobbyPage from './pages/GameLobbyPage';
import JoinGamePage from './pages/JoinGamePage';
import CampaignsPage from './pages/CampaignsPage';
import AdminPage from './pages/AdminPage';
import PlayByPostPage from './pages/PlayByPostPage';

const GameSessionPage = lazy(() =>
  import('./pages/GameSessionPage').catch((err) => {
    console.error('Failed to load GameSessionPage chunk:', err);
    throw err;
  })
);

function Loader() {
  return (
    <div className="flex items-center justify-center h-screen bg-tavern-bg">
      <div className="text-center">
        <div className="text-4xl mb-4">⚔</div>
        <p className="text-tavern-muted font-serif animate-pulse">Entering the Tavern...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <Loader />;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { fetchMe } = useAuthStore();

  useEffect(() => { fetchMe(); }, [fetchMe]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a0f0a',
            color: '#e8d5b7',
            border: '1px solid #4a2f1a',
            fontFamily: 'Lato, sans-serif',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/join/:code" element={<JoinGamePage />} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/characters" element={<ProtectedRoute><CharactersPage /></ProtectedRoute>} />
        <Route path="/characters/:id" element={<ProtectedRoute><CharacterEditPage /></ProtectedRoute>} />
        <Route path="/characters/new" element={<ProtectedRoute><CharacterEditPage /></ProtectedRoute>} />
        <Route path="/games" element={<ProtectedRoute><GamesPage /></ProtectedRoute>} />
        <Route path="/games/:id" element={<ProtectedRoute><GameLobbyPage /></ProtectedRoute>} />
        <Route path="/games/:id/pbp" element={<ProtectedRoute><PlayByPostPage /></ProtectedRoute>} />
        <Route path="/games/:id/play" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Suspense fallback={<Loader />}>
                <GameSessionPage />
              </Suspense>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
