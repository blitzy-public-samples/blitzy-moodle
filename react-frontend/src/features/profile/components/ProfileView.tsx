/**
 * ProfileView Component
 *
 * Displays user profile information in a read-only format.
 * Shows avatar, personal details, contact information, and custom fields.
 *
 * @module features/profile/components
 */

import {
  Box,
  Card,
  CardContent,
  Avatar,
  Typography,
  Grid,
  Chip,
  Divider,
  Link,
  Stack,
  Skeleton,
  Alert,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { useProfile } from '../hooks/useProfile';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { UseAuthReturn } from '@/features/auth/hooks/useAuth';

/**
 * Extended auth type with optional capability checking
 */
type AuthWithCapabilities = UseAuthReturn & {
  hasCapability?: (capability: string, context: { contextlevel: string; instanceid: number }) => boolean;
};

/**
 * Props for ProfileView component
 */
export interface ProfileViewProps {
  /**
   * User ID to fetch and display profile for
   */
  userId: number;

  /**
   * Whether to show full details or compact view
   * @default false
   */
  compact?: boolean;

  /**
   * Whether to show edit button
   * @default false
   */
  showEditButton?: boolean;

  /**
   * Callback when edit button is clicked
   */
  onEdit?: () => void;

  /**
   * Additional CSS class name
   */
  className?: string;
}

/**
 * ProfileView Component
 *
 * Renders a comprehensive view of user profile information with avatar,
 * personal details, contact information, and metadata.
 *
 * @example
 * ```tsx
 * <ProfileView
 *   userId={123}
 *   showEditButton={canEdit}
 *   onEdit={() => navigate('/profile/edit')}
 * />
 * ```
 */
export function ProfileView({
  userId,
  compact = false,
  showEditButton = false,
  onEdit,
  className,
}: ProfileViewProps) {
  // Fetch user profile data using the useProfile hook
  const { profile: user, isLoading, error, refetch } = useProfile(userId);

  // Get authentication state for permission checks
  const auth = useAuth();
  const currentUser = auth?.user;
  const hasCapability = (auth as AuthWithCapabilities)?.hasCapability;

  // Responsive layout detection
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600px - 960px

  // Determine layout type
  const getLayout = (): 'mobile' | 'tablet' | 'desktop' => {
    if (isMobile) {return 'mobile';}
    if (isTablet) {return 'tablet';}
    return 'desktop';
  };

  const layout = getLayout();

  // Determine if current user can edit this profile
  const canEdit = (() => {
    // If showEditButton is explicitly set (true or false), respect that
    if (showEditButton !== undefined && showEditButton !== false) {
      return true;
    }

    // If no current user, cannot edit
    if (!currentUser || !user) {
      return false;
    }

    // Viewing own profile - can edit
    if (currentUser.id === userId) {
      return true;
    }

    // Check if user has capability to edit other profiles
    if (hasCapability && typeof hasCapability === 'function') {
      return hasCapability('moodle/user:update', { contextlevel: 'user', instanceid: userId });
    }

    return false;
  })();

  /**
   * Format timestamp to readable date
   */
  const formatDate = (timestamp?: number): string => {
    if (!timestamp) {
      return 'Never';
    }
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  /**
   * Format interests string to array of tags
   */
  const getInterests = (): string[] => {
    if (!user?.interests) {
      return [];
    }
    // Handle both string and array formats
    if (Array.isArray(user.interests)) {
      return user.interests.filter(Boolean);
    }
    return user.interests
      .split(',')
      .map((interest: string) => interest.trim())
      .filter(Boolean);
  };

  // Loading state - show skeleton
  if (isLoading) {
    if (compact) {
      return (
        <Box className={className} display="flex" alignItems="center" gap={2} data-testid="profile-skeleton">
          <Skeleton variant="circular" width={48} height={48} data-testid="skeleton-avatar" />
          <Box flex={1}>
            <Skeleton variant="text" width="60%" height={24} data-testid="skeleton-name" />
            <Skeleton variant="text" width="80%" height={20} data-testid="skeleton-info" />
          </Box>
        </Box>
      );
    }

    return (
      <Card className={className} sx={{ maxWidth: 900, margin: 'auto' }} data-testid="profile-skeleton">
        <CardContent>
          <Box display="flex" alignItems="flex-start" gap={3} mb={3}>
            <Skeleton variant="circular" width={120} height={120} data-testid="skeleton-avatar" />
            <Box flex={1}>
              <Skeleton variant="text" width="40%" height={40} data-testid="skeleton-name" />
              <Skeleton variant="text" width="30%" height={24} data-testid="skeleton-username" />
              <Skeleton variant="text" width="100%" height={20} sx={{ mt: 2 }} data-testid="skeleton-bio" />
              <Skeleton variant="text" width="100%" height={20} data-testid="skeleton-bio-line2" />
            </Box>
          </Box>
          <Divider sx={{ my: 3 }} />
          <Skeleton variant="rectangular" height={200} data-testid="skeleton-content" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    // Determine error message based on error code
    let errorMessage = 'Failed to load profile. Please try again.';
    
    if (error instanceof Error) {
      // Check if Error has custom error code property
      const errorWithCode = error as Error & { code?: string };
      
      if (errorWithCode.code === 'USER_DELETED') {
        errorMessage = 'This user account has been deleted.';
      } else if (errorWithCode.code === 'INVALID_USER') {
        errorMessage = 'Invalid user ID provided.';
      } else if (errorWithCode.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. You are not authorized to view this profile.';
      } else {
        errorMessage = error.message;
      }
    } else if (typeof error === 'object' && error !== null) {
      const errorObj = error as { message?: string; code?: string };
      
      // Check error code first to provide specific messages
      if (errorObj.code === 'USER_DELETED') {
        errorMessage = 'This user account has been deleted.';
      } else if (errorObj.code === 'INVALID_USER') {
        errorMessage = 'Invalid user ID provided.';
      } else if (errorObj.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. You are not authorized to view this profile.';
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }
    }

    return (
      <Box className={className}>
        <Alert 
          severity="error"
          action={
            refetch && (
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Retry
              </Button>
            )
          }
        >
          {errorMessage}
        </Alert>
      </Box>
    );
  }

  // No user data
  if (!user) {
    return (
      <Alert severity="warning" className={className}>
        User profile not found.
      </Alert>
    );
  }

  // Determine avatar size based on layout
  const getAvatarSize = (): { width: number; height: number; size: string } => {
    if (isMobile) {return { width: 80, height: 80, size: 'small' };}
    if (isTablet) {return { width: 100, height: 100, size: 'medium' };}
    return { width: 120, height: 120, size: 'large' };
  };

  const avatarSize = getAvatarSize();

  if (compact) {
    return (
      <Box className={className} display="flex" alignItems="center" gap={2} data-layout={layout}>
        <Avatar
          src={user.profileimageurlsmall || user.profileimageurl}
          alt={user.fullname}
          sx={{ width: 48, height: 48 }}
          data-testid="profile-avatar"
          data-size="compact"
        />
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            {user.fullname}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user.email}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Card className={className} sx={{ maxWidth: 900, margin: 'auto' }} data-layout={layout}>
      <CardContent>
        {/* Header Section with Avatar and Basic Info */}
        <Box component="section" role="region" aria-label="Profile header" display="flex" alignItems="flex-start" gap={3} mb={3}>
          <Avatar 
            src={user.profileimageurl} 
            alt={user.fullname} 
            sx={{ width: avatarSize.width, height: avatarSize.height }} 
            data-testid="profile-avatar"
            data-size={avatarSize.size}
          />
          <Box flex={1}>
            <Typography variant="h1" component="h1" gutterBottom sx={{ fontSize: '2.125rem' }}>
              {user.fullname}
            </Typography>
            <Typography variant="h2" component="h2" color="text.secondary" gutterBottom sx={{ fontSize: '1rem', fontWeight: 400 }}>
              @{user.username}
            </Typography>

            {user.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2 }}
                dangerouslySetInnerHTML={{ __html: user.description }}
              />
            )}

            {/* Interests Tags */}
            {getInterests().length > 0 && (
              <Stack component="ul" role="list" direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap sx={{ listStyle: 'none', padding: 0 }}>
                {getInterests().map((interest) => (
                  <Box component="li" key={interest}>
                    <Chip label={interest} size="small" variant="outlined" />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {/* Edit Button */}
          {canEdit && (
            <Box>
              <Button
                variant="outlined"
                color="primary"
                onClick={onEdit}
              >
                Edit Profile
              </Button>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Contact Information */}
        <Box component="section" role="region" aria-labelledby="contact-heading" mb={3}>
          <Typography id="contact-heading" variant="h2" component="h2" gutterBottom sx={{ fontSize: '1.25rem', fontWeight: 500 }}>
            Contact Information
          </Typography>
          <Grid container spacing={2}>
            {user.email && (
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <EmailIcon color="action" />
                  <Link href={`mailto:${user.email}`} underline="hover">
                    {user.email}
                  </Link>
                </Box>
              </Grid>
            )}

            {user.phone1 && (
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PhoneIcon color="action" />
                  <Link href={`tel:${user.phone1}`} underline="hover">
                    {user.phone1}
                  </Link>
                </Box>
              </Grid>
            )}

            {(Boolean(user.city) || Boolean(user.country)) && (
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <LocationIcon color="action" />
                  <Typography variant="body2">
                    {[user.city, user.country].filter(Boolean).join(', ')}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Professional Information */}
        {(Boolean(user.institution) || Boolean(user.department)) && (
          <>
            <Box component="section" role="region" aria-labelledby="professional-heading" mb={3}>
              <Typography id="professional-heading" variant="h2" component="h2" gutterBottom sx={{ fontSize: '1.25rem', fontWeight: 500 }}>
                Professional Information
              </Typography>
              <Grid container spacing={2}>
                {user.institution && (
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <BusinessIcon color="action" />
                      <Typography variant="body2">{user.institution}</Typography>
                    </Box>
                  </Grid>
                )}

                {user.department && (
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <BusinessIcon color="action" />
                      <Typography variant="body2">{user.department}</Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
            <Divider sx={{ my: 3 }} />
          </>
        )}

        {/* Activity Information */}
        <Box component="section" role="region" aria-labelledby="activity-heading">
          <Typography id="activity-heading" variant="h2" component="h2" gutterBottom sx={{ fontSize: '1.25rem', fontWeight: 500 }}>
            Activity
          </Typography>
          <Grid container spacing={2}>
            {user.firstaccess && (
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <CalendarIcon color="action" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    <strong>First access:</strong> {formatDate(user.firstaccess)}
                  </Typography>
                </Box>
              </Grid>
            )}

            {user.lastaccess && (
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <CalendarIcon color="action" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Last access:</strong> {formatDate(user.lastaccess)}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Box>

        {/* Custom Fields */}
        {user.customfields && user.customfields.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box component="section" role="region" aria-labelledby="additional-heading">
              <Typography id="additional-heading" variant="h2" component="h2" gutterBottom sx={{ fontSize: '1.25rem', fontWeight: 500 }}>
                Additional Information
              </Typography>
              <Grid container spacing={2}>
                {user.customfields.map((field, index) => (
                  <Grid item xs={12} sm={6} key={field.shortname || `customfield-${index}`}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>{field.name}:</strong> {String(field.value)}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </>
        )}

        {/* Roles */}
        {user.roles && user.roles.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box>
              <Typography variant="h2" component="h2" gutterBottom sx={{ fontSize: '1.25rem', fontWeight: 500 }}>
                Roles
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {user.roles.map((role) => (
                  <Chip
                    key={role.roleid}
                    label={role.name}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ProfileView;
