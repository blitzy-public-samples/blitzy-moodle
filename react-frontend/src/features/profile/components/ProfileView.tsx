/**
 * ProfileView Component
 * 
 * Displays user profile information in a read-only format.
 * Shows avatar, personal details, contact information, and custom fields.
 * 
 * @module features/profile/components
 */

import React from 'react';
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
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import type { User } from '../types/profile.types';

/**
 * Props for ProfileView component
 */
export interface ProfileViewProps {
  /**
   * User object to display
   */
  user: User;

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
 *   user={userProfile}
 *   showEditButton={canEdit}
 *   onEdit={() => navigate('/profile/edit')}
 * />
 * ```
 */
export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  compact = false,
  showEditButton = false,
  onEdit,
  className,
}) => {
  /**
   * Format timestamp to readable date
   */
  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
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
    if (!user.interests) return [];
    return user.interests.split(',').map((i) => i.trim()).filter(Boolean);
  };

  if (compact) {
    return (
      <Box className={className} display="flex" alignItems="center" gap={2}>
        <Avatar
          src={user.profileimageurlsmall || user.profileimageurl}
          alt={user.fullname}
          sx={{ width: 48, height: 48 }}
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
    <Card className={className} sx={{ maxWidth: 900, margin: 'auto' }}>
      <CardContent>
        {/* Header Section with Avatar and Basic Info */}
        <Box display="flex" alignItems="flex-start" gap={3} mb={3}>
          <Avatar
            src={user.profileimageurl}
            alt={user.fullname}
            sx={{ width: 120, height: 120 }}
          />
          <Box flex={1}>
            <Typography variant="h4" gutterBottom>
              {user.fullname}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
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
              <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
                {getInterests().map((interest, index) => (
                  <Chip
                    key={index}
                    label={interest}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            )}
          </Box>

          {/* Edit Button */}
          {showEditButton && onEdit && (
            <Box>
              <Typography
                component="button"
                onClick={onEdit}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'primary.main',
                  bgcolor: 'transparent',
                  color: 'primary.main',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                  },
                }}
              >
                Edit Profile
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Contact Information */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
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

            {user.url && (
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <LanguageIcon color="action" />
                  <Link href={user.url} target="_blank" rel="noopener noreferrer" underline="hover">
                    {user.url}
                  </Link>
                </Box>
              </Grid>
            )}

            {(user.city || user.country) && (
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
        {(user.institution || user.department) && (
          <>
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
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

        {/* Instant Messaging */}
        {(user.skype || user.aim || user.yahoo || user.msn || user.icq) && (
          <>
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Instant Messaging
              </Typography>
              <Grid container spacing={2}>
                {user.skype && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Skype:</strong> {user.skype}
                    </Typography>
                  </Grid>
                )}
                {user.aim && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>AIM:</strong> {user.aim}
                    </Typography>
                  </Grid>
                )}
                {user.yahoo && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Yahoo:</strong> {user.yahoo}
                    </Typography>
                  </Grid>
                )}
                {user.msn && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>MSN:</strong> {user.msn}
                    </Typography>
                  </Grid>
                )}
                {user.icq && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>ICQ:</strong> {user.icq}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
            <Divider sx={{ my: 3 }} />
          </>
        )}

        {/* Activity Information */}
        <Box>
          <Typography variant="h6" gutterBottom>
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
            <Box>
              <Typography variant="h6" gutterBottom>
                Additional Information
              </Typography>
              <Grid container spacing={2}>
                {user.customfields.map((field, index) => (
                  <Grid item xs={12} sm={6} key={index}>
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
              <Typography variant="h6" gutterBottom>
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
};

export default ProfileView;
