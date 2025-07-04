// src/app/App.tsx

import React, { Suspense, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
} from '@mui/material';
import { Routes, Route } from 'react-router-dom';

import { mountMenuButton } from '../components/layout/MenuButton';
import { NavItem } from '../components/layout/NavigationDrawer';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const NavigationDrawer = React.lazy(() => import('../components/layout/NavigationDrawer'));
const LoginPage = React.lazy(() => import('../pages/LoginPage/LoginPage'));
const RegisterPage = React.lazy(() => import('../pages/RegisterPage/RegisterPage'));
const AccountSetupPage = React.lazy(() => import('../pages/AccountSetupPage/AccountSetupPage'));
const ProtectedRoute = React.lazy(() => import('../components/layout/ProtectedRoute'));
const PublicOrProtectedRoute = React.lazy(() => import('../components/layout/PublicOrProtectedRoute'));
const CollectionDetails = React.lazy(() => import('../pages/CollectionDetails/CollectionDetails'));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage/NotFoundPage'));
const MobileScanPage = React.lazy(() => import('../pages/MobileScanPage/MobileScanPage'));
const LandingPage = React.lazy(() => import('../pages/LandingPage/LandingPage'));
const LegalPage = React.lazy(() => import('../pages/Legal/LegalPage'));
const SearchPage = React.lazy(() => import('../pages/SearchPage/SearchPage'));
const CollectionsOverviewPage = React.lazy(() => import('../pages/CollectionsOverview/CollectionsOverview'));
const CollectionPortfolioPage = React.lazy(() => import('../pages/CollectionPortfolio/CollectionPortfolio'));
const ScanPage = React.lazy(() => import('../pages/ScanPage/ScanPage'));

const modernTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#ff5252' },
    secondary: { main: '#524e4e' },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    h1: { fontSize: '2.5rem', fontWeight: 600 },
    h2: { fontSize: '2rem', fontWeight: 600 },
    h3: { fontSize: '1.75rem', fontWeight: 500 },
    h4: { fontSize: '1.5rem', fontWeight: 500 },
    h5: { fontSize: '1.25rem', fontWeight: 400 },
    h6: { fontWeight: 600 },
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.6 },
    caption: { fontSize: '0.875rem', fontWeight: 400, color: '#aaa' },
  },
  shape: { borderRadius: 8 },
  zIndex: {
    appBar: 1100,
    drawer: 1099,
  },
});

const navItems: NavItem[] = [
  { text: 'Search', icon: <SearchIcon />, path: '/search' },
  { text: 'Collections', icon: <span className="material-symbols-outlined" style={{ fontSize: 24 }}>deployed_code</span>, path: '/collections' },
  { text: 'Portfolio', icon: <TrendingUpIcon />, path: '/portfolio' },
  { text: 'Scan', icon: <span className="material-symbols-outlined" style={{ fontSize: 24 }}>document_scanner</span>, path: '/scan' },
];

const App: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  useEffect(() => {
    const toggleDrawer = () => setDrawerOpen(prev => !prev);
    mountMenuButton(toggleDrawer);
  }, []);

  return (
    <ThemeProvider theme={modernTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', pt: '64px' }}>
        <Suspense fallback={null}>
          <NavigationDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            navItems={navItems}
          />
        </Suspense>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            overflowY: 'auto',
            paddingY: 4,
          }}
        >
          <Suspense fallback={null}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/setup" element={<AccountSetupPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/" element={<LandingPage />} />
              <Route path="/mobile-scan/:session_id/*" element={<MobileScanPage />} />
              <Route element={<PublicOrProtectedRoute />}>
                <Route path="/:username/collection/:user_collection_id" element={<CollectionDetails />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/search" element={<SearchPage />} />
                <Route path="/scan" element={<ScanPage />} />
                <Route path="/collections" element={<CollectionsOverviewPage />} />
                <Route path="/portfolio" element={<CollectionPortfolioPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
