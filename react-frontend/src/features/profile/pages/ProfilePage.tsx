/**
 * ProfilePage Component
 *
 * Main page for displaying user profile information.
 * Handles loading, error states, and permissions for viewing profiles.
 *
 * @module features/profile/pages
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Skeleton,
  Alert,
  Button,
  Breadcrumbs,
  Link,
  Typography,
} from '@mui/material';
import { Edit as EditIcon, Home as HomeIcon, Person as PersonIcon } from '@mui/icons-material';
import { useProfile, useCurrentUser } from '../hooks/useProfile';
import { ProfileView } from '../components/ProfileView';

/**
 * ProfilePage Component
 *
 * Displays user profile information with support for viewing own profile
 * or other users' profiles based on URL parameters.
 *
 * Routes:
 * - /profile - View current user's profile
 * - /profile/:userId - View specific user's profile
 *
 * @example
 * ```tsx
 * // Router configuration
 * <Route path="/profile" element={<ProfilePage />} />
 * <Route path="/profile/:userId" element={<ProfilePage />} />
 * ```
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const { userId: userIdParam } = useParams<{ userId: string }>();

  // Parse userId from params (undefined means current user)
  const userId = userIdParam ? parseInt(userIdParam, 10) : undefined;

  // Fetch profile data
  const { profile: user, isLoading, isError, error, refetch } = useProfile(userId);

  // Fetch current user to determine edit permissions
  const { profile: currentUser, isLoading: isLoadingCurrentUser } = useCurrentUser();

  /**
   * Check if current user can edit this profile
   */
  const canEdit = React.useMemo(() => {
    if (!user || !currentUser) {
      return false;
    }

    // User can edit their own profile
    if (user.id === currentUser.id) {
      return true;
    }

    // Admin users can edit any profile
    // Check if current user has admin role
    const isAdmin = currentUser.roles?.some(
      (role) => role.shortname === 'admin' || role.shortname === 'manager'
    );

    return isAdmin ?? false;
  }, [user, currentUser]);

  /**
   * Handle edit button click
   */
  const handleEdit = () => {
    if (user) {
      navigate(`/profile/${user.id}/edit`);
    }
  };

  /**
   * Handle breadcrumb navigation
   */
  const handleBreadcrumbClick = (path: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    navigate(path);
  };

  /**
   * Loading State
   */
  if (isLoading || isLoadingCurrentUser) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Skeleton width={60} />
          <Skeleton width={80} />
        </Breadcrumbs>

        <Paper sx={{ p: 3 }}>
          {/* Avatar and Basic Info Skeleton */}
          <Box display="flex" gap={3} mb={3}>
            <Skeleton variant="circular" width={120} height={120} />
            <Box flex={1}>
              <Skeleton width="60%" height={40} sx={{ mb: 1 }} />
              <Skeleton width="40%" height={24} sx={{ mb: 2 }} />
              <Skeleton width="80%" height={20} />
              <Skeleton width="70%" height={20} />
            </Box>
          </Box>

          {/* Content Skeleton */}
          <Box>
            <Skeleton width="30%" height={32} sx={{ mb: 2 }} />
            <Skeleton width="100%" height={20} sx={{ mb: 1 }} />
            <Skeleton width="100%" height={20} sx={{ mb: 1 }} />
            <Skeleton width="90%" height={20} sx={{ mb: 1 }} />
            <Skeleton width="95%" height={20} />
          </Box>
        </Paper>
      </Container>
    );
  }

  /**
   * Error State
   */
  if (isError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            href="/"
            onClick={handleBreadcrumbClick('/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <HomeIcon fontSize="small" />
            Home
          </Link>
          <Typography color="text.primary">Profile</Typography>
        </Breadcrumbs>

        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          {error?.message ?? 'Failed to load profile. Please try again.'}
        </Alert>
      </Container>
    );
  }

  /**
   * No Data State (shouldn't happen if not loading and not error, but for safety)
   */
  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">User not found.</Alert>
      </Container>
    );
  }

  /**
   * Success State - Display Profile
   */
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          href="/"
          onClick={handleBreadcrumbClick('/')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          underline="hover"
        >
          <HomeIcon fontSize="small" />
          Home
        </Link>
        <Link
          href="/profile"
          onClick={handleBreadcrumbClick('/profile')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          underline="hover"
        >
          <PersonIcon fontSize="small" />
          Profile
        </Link>
        <Typography color="text.primary">{user.fullname}</Typography>
      </Breadcrumbs>

      {/* Profile View */}
      <ProfileView userId={user.id} showEditButton={canEdit} onEdit={handleEdit} />

      {/* Additional Actions (if needed) */}
      {canEdit && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button variant="contained" startIcon={<EditIcon />} onClick={handleEdit} size="large">
            Edit Profile
          </Button>
        </Box>
      )}
    </Container>
  );
}

export default ProfilePage;
