import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import {
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { UserMenu } from './UserMenu';
import type { RootState } from '../../app/store';

interface HeaderProps {
  onMenuClick?: () => void;
}

/**
 * Header Component
 * 
 * Application header with navigation and user menu.
 * Displays site title and user controls for authenticated users.
 */
export function Header({ onMenuClick }: HeaderProps) {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        {onMenuClick && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={onMenuClick}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          Moodle
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isAuthenticated && <UserMenu />}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
