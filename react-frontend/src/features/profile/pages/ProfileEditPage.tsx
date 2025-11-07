/**
 * ProfileEditPage Component
 *
 * Page for editing user profile information with form validation,
 * avatar upload, and permission checks.
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
  Breadcrumbs,
  Link,
  Typography,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import {
  Home as HomeIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  PhotoCamera as PhotoIcon,
} from '@mui/icons-material';
import { useProfile, useCurrentUser } from '../hooks/useProfile';
import { ProfileEditForm } from '../components/ProfileEditForm';
import { AvatarUpload } from '../components/AvatarUpload';

/**
 * Tab panel interface
 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

/**
 * Tab Panel Component
 */
function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * ProfileEditPage Component
 *
 * Comprehensive profile editing page with tabbed interface for:
 * - Profile information editing
 * - Avatar management
 *
 * Features permission checks to ensure users can only edit their own profiles
 * (or admins can edit any profile).
 *
 * Routes:
 * - /profile/edit - Edit current user's profile
 * - /profile/:userId/edit - Edit specific user's profile (admin only)
 *
 * @example
 * ```tsx
 * // Router configuration
 * <Route path="/profile/edit" element={<ProfileEditPage />} />
 * <Route path="/profile/:userId/edit" element={<ProfileEditPage />} />
 * ```
 */
export function ProfileEditPage() {
  const navigate = useNavigate();
  const { userId: userIdParam } = useParams<{ userId: string }>();

  // Tab state
  const [activeTab, setActiveTab] = React.useState(0);

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
    const isAdmin = currentUser.roles?.some(
      (role: any) => role.shortname === 'admin' || role.shortname === 'manager'
    );

    return isAdmin ?? false;
  }, [user, currentUser]);

  /**
   * Redirect if user doesn't have permission
   */
  React.useEffect(() => {
    if (!isLoading && !isLoadingCurrentUser && !canEdit && user) {
      // Redirect to view-only profile page
      navigate(`/profile/${user.id}`, { replace: true });
    }
  }, [isLoading, isLoadingCurrentUser, canEdit, user, navigate]);

  /**
   * Handle tab change
   */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  /**
   * Handle breadcrumb navigation
   */
  const handleBreadcrumbClick = (path: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    navigate(path);
  };

  /**
   * Handle successful profile update
   */
  const handleUpdateSuccess = () => {
    // Navigate back to profile view
    if (user) {
      navigate(`/profile/${user.id}`);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    if (user) {
      navigate(`/profile/${user.id}`);
    } else {
      navigate('/profile');
    }
  };

  /**
   * Handle successful avatar upload
   */
  const handleAvatarUploadSuccess = () => {
    // Refetch profile to get updated avatar URLs
    void refetch();
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
          <Skeleton width={100} />
        </Breadcrumbs>

        <Paper sx={{ p: 3 }}>
          <Skeleton width="40%" height={48} sx={{ mb: 3 }} />
          <Skeleton width="100%" height={56} sx={{ mb: 2 }} />
          <Skeleton width="100%" height={56} sx={{ mb: 2 }} />
          <Skeleton width="100%" height={56} sx={{ mb: 2 }} />
          <Skeleton width="100%" height={56} />
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

        <Alert severity="error" action={<button onClick={() => refetch()}>Retry</button>}>
          {error?.message || 'Failed to load profile. Please try again.'}
        </Alert>
      </Container>
    );
  }

  /**
   * No Data State
   */
  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">User not found.</Alert>
      </Container>
    );
  }

  /**
   * No Permission State
   */
  if (!canEdit) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">You do not have permission to edit this profile.</Alert>
      </Container>
    );
  }

  /**
   * Success State - Display Edit Form
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
        <Link
          href={`/profile/${user.id}`}
          onClick={handleBreadcrumbClick(`/profile/${user.id}`)}
          underline="hover"
        >
          {user.fullname}
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <EditIcon fontSize="small" />
          Edit
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Edit Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Update your profile information and avatar
        </Typography>
      </Box>

      {/* Tabbed Interface */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="profile edit tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label="Profile Information"
            id="profile-tab-0"
            aria-controls="profile-tabpanel-0"
            icon={<EditIcon />}
            iconPosition="start"
          />
          <Tab
            label="Avatar"
            id="profile-tab-1"
            aria-controls="profile-tabpanel-1"
            icon={<PhotoIcon />}
            iconPosition="start"
          />
        </Tabs>

        {/* Profile Information Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ px: 3 }}>
            <ProfileEditForm
              user={user}
              onSuccess={handleUpdateSuccess}
              onCancel={handleCancel}
              showCancelButton
            />
          </Box>
        </TabPanel>

        {/* Avatar Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ px: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Profile Picture
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }} textAlign="center">
              Upload a profile picture that represents you. This image will be visible to other
              users.
            </Typography>

            <Divider sx={{ width: '100%', mb: 3 }} />

            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={user.profileimageurl}
              onUploadSuccess={handleAvatarUploadSuccess}
              onDeleteSuccess={handleAvatarUploadSuccess}
              allowDelete
              size="large"
            />

            <Divider sx={{ width: '100%', mt: 3, mb: 3 }} />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', width: '100%' }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </Box>
          </Box>
        </TabPanel>
      </Paper>

      {/* Help Text */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Note:</strong> Changes to your profile information may take a few moments to
          appear across the system.
          {user.id === currentUser?.id && (
            <> Your profile is visible to other users in courses you are enrolled in.</>
          )}
        </Typography>
      </Alert>
    </Container>
  );
}

export default ProfileEditPage;
