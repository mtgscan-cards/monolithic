// src/components/LinkAccountDialog.tsx
import React, { useContext } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  Box,
  Typography,
  Avatar,
  Button,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { AuthContext, User } from '../../contexts/AuthContext';
import { GoogleButton } from '../auth/GoogleButton';
import { GithubButton } from '../auth/GithubButton';

interface LinkAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

export const LinkAccountDialog: React.FC<LinkAccountDialogProps> = ({
  open,
  onClose,
}) => {
  const { user, setUser } = useContext(AuthContext);
  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Manage Linked Accounts</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Google */}
          <Grid
            item
            xs={12}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box display="flex" alignItems="center">
              <Avatar sx={{ bgcolor: '#DB4437', mr: 1 }}>
                <GoogleIcon sx={{ color: '#fff' }} />
              </Avatar>
              <Typography variant="subtitle1">Google</Typography>
            </Box>
            {user.google_linked ? (
              <Button variant="outlined" size="small" disabled>
                Linked
              </Button>
            ) : (
              <GoogleButton
                linkMode
                onSuccess={() => {
                  setUser({ ...user, google_linked: true } as User);
                  onClose();
                }}
              />
            )}
          </Grid>

          {/* GitHub */}
          <Grid
            item
            xs={12}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box display="flex" alignItems="center">
              <Avatar sx={{ bgcolor: '#24292E', mr: 1 }}>
                <GitHubIcon sx={{ color: '#fff' }} />
              </Avatar>
              <Typography variant="subtitle1">GitHub</Typography>
            </Box>
            {user.github_linked ? (
              <Button variant="outlined" size="small" disabled>
                Linked
              </Button>
            ) : (
              <GithubButton
                linkMode
                onSuccess={() => {
                  setUser({ ...user, github_linked: true } as User);
                  onClose();
                }}
              />
            )}
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};
