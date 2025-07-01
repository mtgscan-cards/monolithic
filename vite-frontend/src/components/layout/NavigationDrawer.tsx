// src/components/NavigationDrawer.tsx

import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  Box,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  Link as MuiLink,
  useMediaQuery,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTheme } from '@mui/material/styles';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { AuthContext } from '../../contexts/AuthContext';
import { logout as apiLogout } from '../../api/auth';
import { LinkAccountDialog } from '../dialogs/LinkAccountDialog';

export interface NavItem {
  text: string;
  icon: React.ReactNode;
  path: string;
}

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpen?: () => void;
  navItems: NavItem[];
  drawerWidth?: number;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  open,
  onClose,
  onOpen = () => {},
  navItems,
  drawerWidth = 280,
}) => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const signedIn = Boolean(user);
  const displayName = user?.display_name ?? '';
  const avatarUrl = user?.avatar_url ?? '';

  const [dialogOpen, setDialogOpen] = useState(false);

  // ✅ Use correct ref type for Link underlying <a>
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (open && firstLinkRef.current) {
      firstLinkRef.current.focus();
    }
  }, [open]);

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore logout errors
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('username');
    setUser(null);
    onClose();
    navigate('/login');
  };

  const openLinkDialog = () => {
    setDialogOpen(true);
    onClose();
  };

  return (
    <>
      <SwipeableDrawer
        anchor="left"
        open={open}
        onClose={onClose}
        onOpen={onOpen}
        disableSwipeToOpen={!isMobile}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            zIndex: (theme) => theme.zIndex.drawer + 1,
            width: drawerWidth,
            background: 'linear-gradient(180deg, #1e1e1e, #121212)',
            color: 'text.primary',
            borderRight: 'none',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          },
        }}
        role="navigation"
        aria-label="Main navigation menu"
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box sx={{ height: 30 }} />
        </Box>

        {/* Navigation items */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          <List disablePadding>
            {navItems.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton
                    component={Link}
                    to={item.path}
                    onClick={onClose}
                    aria-label={`Navigate to ${item.text}`}
                    aria-current={isActive ? 'page' : undefined}
                    ref={index === 0 ? firstLinkRef : undefined}
                    sx={{
                      borderRadius: 2,
                      mx: 1,
                      my: 0.5,
                      transition: 'background-color 0.3s ease',
                      '&:hover': { backgroundColor: 'primary.dark' },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: theme.palette.primary.main,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'text.primary', minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        <Divider sx={{ borderColor: 'divider' }} />

        {/* User info section, bottom-aligned */}
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {signedIn && (
              <Box
                component="img"
                src={avatarUrl}
                referrerPolicy="no-referrer"
                alt={`Avatar of ${displayName}`}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  mr: 1,
                }}
              />
            )}
            <Box>
              <Typography variant="body1" sx={{ lineHeight: 1 }}>
                {signedIn ? displayName : 'Not signed in'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                {signedIn ? (
                  <>
                    Signed in –{' '}
                    <MuiLink
                      component={Link}
                      to="/login"
                      variant="caption"
                      sx={{ p: 0, cursor: 'pointer' }}
                      onClick={handleLogout}
                      underline="always"
                    >
                      Logout
                    </MuiLink>
                  </>
                ) : (
                  <MuiLink
                    component={Link}
                    to="/login"
                    variant="caption"
                    sx={{ p: 0, cursor: 'pointer' }}
                    underline="always"
                  >
                    Tap “Login” to continue
                  </MuiLink>
                )}
              </Typography>
            </Box>
          </Box>
          {signedIn && (
            <IconButton
              size="small"
              onClick={openLinkDialog}
              aria-label="Manage linked accounts"
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </SwipeableDrawer>

      <LinkAccountDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export default NavigationDrawer;
