/**
 * Dashboard Page Component
 *
 * Main dashboard view for authenticated users showing personalized widgets
 * and navigation to key features. Supports role-based dashboard layouts
 * (student, teacher, admin).
 *
 * @module features/dashboard/pages
 */

import { Box, Grid, Typography, Paper } from '@mui/material';
import { AppLayout } from '../../../components/layouts/AppLayout';

/**
 * DashboardPage Component
 *
 * Renders the main user dashboard with widgets tailored to the user's role.
 * Provides quick access to courses, calendar, timeline, and recent activities.
 *
 * @returns React component displaying the dashboard
 */
export function DashboardPage() {
  return (
    <AppLayout>
      <Box sx={{ py: 4 }} data-testid="dashboard-container">
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        
        <Grid container spacing={3}>
          {/* Calendar Widget */}
          <Grid item xs={12} md={6} lg={4}>
            <Paper
              sx={{ p: 2, height: '100%' }}
              data-testid="calendar-widget"
            >
              <Typography variant="h6" gutterBottom>
                Calendar
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Calendar widget coming soon...
              </Typography>
            </Paper>
          </Grid>

          {/* Timeline Widget */}
          <Grid item xs={12} md={6} lg={4}>
            <Paper
              sx={{ p: 2, height: '100%' }}
              data-testid="timeline-widget"
            >
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Timeline widget coming soon...
              </Typography>
            </Paper>
          </Grid>

          {/* Upcoming Events Widget */}
          <Grid item xs={12} md={6} lg={4}>
            <Paper
              sx={{ p: 2, height: '100%' }}
              data-testid="upcoming-events-widget"
            >
              <Typography variant="h6" gutterBottom>
                Upcoming Events
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upcoming events widget coming soon...
              </Typography>
            </Paper>
          </Grid>

          {/* Recent Activity Widget */}
          <Grid item xs={12} md={6} lg={4}>
            <Paper
              sx={{ p: 2, height: '100%' }}
              data-testid="recent-activity-widget"
            >
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Recent activity widget coming soon...
              </Typography>
            </Paper>
          </Grid>

          {/* Online Users Widget */}
          <Grid item xs={12} md={6} lg={4}>
            <Paper
              sx={{ p: 2, height: '100%' }}
              data-testid="online-users-widget"
            >
              <Typography variant="h6" gutterBottom>
                Online Users
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Online users widget coming soon...
              </Typography>
            </Paper>
          </Grid>

          {/* Course Overview Widget */}
          <Grid item xs={12} md={6} lg={4}>
            <Paper
              sx={{ p: 2, height: '100%' }}
              data-testid="course-overview-widget"
            >
              <Typography variant="h6" gutterBottom>
                Course Overview
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Course overview widget coming soon...
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </AppLayout>
  );
}

export default DashboardPage;
