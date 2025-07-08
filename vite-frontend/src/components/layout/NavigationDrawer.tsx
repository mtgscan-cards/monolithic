// src/components/NavigationDrawer.tsx

import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  Link as MuiLink,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTheme } from '@mui/material/styles';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { AuthContext } from '../../contexts/AuthContext';
import { logout as apiLogout } from '../../api/auth';
import { LinkAccountDialog } from '../dialogs/LinkAccountDialog';
import './DrawerIcons.css';

export interface NavItem {
  text: string;
  icon: React.ReactNode;
  path: string;
}

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  drawerWidth?: number;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  open,
  onClose,
  navItems,
  drawerWidth = 280,
}) => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const signedIn = Boolean(user);
  const displayName = user?.display_name ?? '';
  const avatarUrl = user?.avatar_url ?? '';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const drawerRef = useRef<HTMLDivElement | null>(null);
  const listItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number } | null>(null);

  const closeTimeout = useRef<number | null>(null);

  const [indicatorVisible, setIndicatorVisible] = useState(false);

  const handleCloseWithDelay = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
    }
    closeTimeout.current = window.setTimeout(() => {
      onClose();
      closeTimeout.current = null;
    }, 250);
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
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

const moveIndicatorToIndex = (index: number | null) => {
  if (index === null) {
    setIndicatorVisible(false);
    return;
  }
  const element = listItemRefs.current[index];
  const drawerRect = drawerRef.current?.getBoundingClientRect();

  if (element && drawerRect) {
    const rect = element.getBoundingClientRect();
    const top = rect.top - drawerRect.top;
    const height = rect.height;
    setIndicatorStyle({ top, height });
    setIndicatorVisible(true);
  }
};

  useEffect(() => {
    if (open) {
      const activeIndex = navItems.findIndex(item =>
        pendingPath ? pendingPath === item.path : location.pathname === item.path
      );
      if (activeIndex !== -1) {
        moveIndicatorToIndex(activeIndex);
      } else {
        moveIndicatorToIndex(null); // hide if no active nav item
      }
    }
  }, [location.pathname, pendingPath, open, navItems]);

  return (
    <>
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            zIndex: 9999,
            width: drawerWidth,
             background: '#1e1e1e',
            color: 'text.primary',
            borderRight: 'none',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          },
          ref: drawerRef,
        }}
        role="navigation"
        aria-label="Main navigation menu"
      >
        {/* Animated red indicator bar */}
{indicatorStyle && (
  <Box
    sx={{
      position: 'absolute',
      top: indicatorStyle.top,
      right: 0,
      width: '3px',
      height: indicatorStyle.height,
      backgroundColor: theme.palette.primary.main,
      borderRadius: '4px',
      opacity: indicatorVisible ? 1 : 0,
      transition: 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
    }}
  />
)}

        <Box sx={{ height: 64 }} />

        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          <List disablePadding>
            {navItems.map((item, index) => {
              const isActive = pendingPath
                ? pendingPath === item.path
                : location.pathname === item.path && pendingPath === null;

              return (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton
                    component={Link}
                    to={item.path}
                    ref={el => { listItemRefs.current[index] = el; }}
                    onClick={() => {
                      setPendingPath(item.path);
                      handleCloseWithDelay();
                    }}
                    onMouseEnter={() => moveIndicatorToIndex(index)}
                    onMouseLeave={() => {
                      const activeIndex = navItems.findIndex(it =>
                        pendingPath ? pendingPath === it.path : location.pathname === it.path
                      );
                      if (activeIndex !== -1) {
                        moveIndicatorToIndex(activeIndex);
                      } else {
                        moveIndicatorToIndex(null);
                      }
                    }}
                    aria-label={`Navigate to ${item.text}`}
                    aria-current={isActive ? 'page' : undefined}
                    sx={{
                      mx: 0,
                      px: 2,
                      py: 1,
                      position: 'relative',
                      overflow: 'hidden',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                      transition: 'background-color 0.3s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.06)',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isActive ? 'primary.main' : 'text.secondary',
                        minWidth: 40,
                        transition: 'color 0.3s ease',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? 'primary.main' : 'text.primary',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        <Divider sx={{ borderColor: 'divider' }} />

        {/* User info */}
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
            {signedIn && avatarUrl ? (
              <Box
                component="img"
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  mr: 1,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: 'grey.800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1,
                }}
              >
                <Typography variant="caption" color="grey.300">
                  {displayName.charAt(0).toUpperCase() || '?'}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="body2" sx={{ lineHeight: 1 }}>
                {signedIn ? displayName : 'Not signed in'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                {signedIn ? (
                  <MuiLink
                    component={Link}
                    to="/login"
                    variant="caption"
                    sx={{ cursor: 'pointer' }}
                    onClick={handleLogout}
                    underline="hover"
                  >
                    Logout
                  </MuiLink>
                ) : (
                  <MuiLink
                    component={Link}
                    to="/login"
                    variant="caption"
                    sx={{ cursor: 'pointer' }}
                    underline="hover"
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
      </Drawer>

      <LinkAccountDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export default NavigationDrawer;
