// src/App.tsx
import React, { useState } from 'react'
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  IconButton,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { Routes, Route } from 'react-router-dom'

import NavigationDrawer, { NavItem } from '../components/layout/NavigationDrawer'
import FilterPanel, { FilterCriteria } from '../components/filters/FilterPanel'
import SearchResults, { Card } from '../components/filters/SearchResults'

import ScanPage from '../pages/ScanPage/ScanPage.tsx'
import LoginPage from '../pages/LoginPage/LoginPage.tsx'
import RegisterPage from '../pages/RegisterPage/RegisterPage.tsx'
import AccountSetupPage from '../pages/AccountSetupPage/AccountSetupPage.tsx'
import ProtectedRoute from '../components/layout/ProtectedRoute'
import PublicOrProtectedRoute from '../components/layout/PublicOrProtectedRoute'
import CollectionsOverview from '../pages/CollectionsOverview/CollectionsOverview.tsx'
import CollectionDetails from '../pages/CollectionDetails/CollectionDetails.tsx'
import CollectionPortfolioPage from '../pages/CollectionPortfolio/CollectionPortfolio.tsx'
import NotFoundPage from '../pages/NotFoundPage/NotFoundPage.tsx'
import MobileScanPage from '../pages/MobileScanPage/MobileScanPage.tsx';

import { sendFilterCriteria } from '../api/FilterBackend'
import '../styles/App.css'

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
    fontFamily: '"Inter", sans-serif',
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1c1c1c',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          padding: '8px 16px',
          borderRadius: 6,
          transition: 'all 0.3s ease',
        },
      },
    },
  },
})

const navItems: NavItem[] = [
  { text: 'Search', icon: <SearchIcon />, path: '/' },
{
  text: 'Collections',
  icon: (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: 24, lineHeight: 1 }}
    >
      deployed_code
    </span>
  ),
  path: '/collections',
},
  { text: 'Portfolio', icon: <TrendingUpIcon />, path: '/portfolio' },
  { text: 'Scan', icon: <span className="material-symbols-outlined" style={{ fontSize: 24 }}>document_scanner</span>, path: '/scan' },
]

const App: React.FC = () => {

  const [results, setResults] = useState<Card[]>([])
  const [currentCriteria, setCurrentCriteria] = useState<FilterCriteria | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const runNewSearch = async (criteria: FilterCriteria) => {
    setCurrentCriteria(criteria)
    try {
      const { results: newResults } = await sendFilterCriteria({
        ...(criteria as object),
        limit: 18,
      } as FilterCriteria & { limit: number; lastId?: string })
      setResults(newResults)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  const loadMore = async () => {
    if (!currentCriteria || results.length === 0) return
    const lastCard = results[results.length - 1]
    setLoadingMore(true)
    try {
      const { results: more } = await sendFilterCriteria({
        ...(currentCriteria as object),
        limit: 18,
        lastId: lastCard.id,
      } as FilterCriteria & { limit: number; lastId?: string })
      setResults(prev => [...prev, ...more])
    } catch (err) {
      console.error('Load more failed:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const toggleDrawer =
    (open: boolean) => (e: React.KeyboardEvent | React.MouseEvent) => {
      if (
        e.type === 'keydown' &&
        ((e as React.KeyboardEvent).key === 'Tab' ||
          (e as React.KeyboardEvent).key === 'Shift')
      ) {
        return
      }
      setDrawerOpen(open)
    }

  return (
    <ThemeProvider theme={modernTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <IconButton color="inherit" onClick={toggleDrawer(true)}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6">mtgscan.cards</Typography>
          </Toolbar>
        </AppBar>

        <NavigationDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          navItems={navItems}
        />

        <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/setup" element={<AccountSetupPage />} />
            <Route path="*" element={<NotFoundPage />} />

            <Route element={<PublicOrProtectedRoute />}>
              <Route
                path="/:username/collection/:user_collection_id"
                element={<CollectionDetails />}
              />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route
                path="/"
                element={
                  <>
                    <Box sx={{ mb: 4 }}>
                      <FilterPanel onSearch={runNewSearch} />
                    </Box>
                    <SearchResults
                      results={results}
                      onLoadMore={loadMore}
                      loadingMore={loadingMore}
                      totalResults={0}
                    />
                  </>
                }
              />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/collections" element={<CollectionsOverview />} />
              <Route
                path="/portfolio"
                element={<CollectionPortfolioPage />}
              />
            </Route>
            <Route path="/mobile-scan/:session_id/*" element={<MobileScanPage />} />
          </Routes>
        </Container>
      </Box>
    </ThemeProvider>
  )
}

export default App
