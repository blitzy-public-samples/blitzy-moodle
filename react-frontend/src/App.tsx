import { Box, Typography, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import CourseProgress from './features/courses/components/CourseProgress';

// Create a basic MUI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Moodle React Frontend
        </Typography>
        <Typography variant="body1" paragraph>
          React application infrastructure in development.
        </Typography>
        
        {/* Demo of CourseProgress component */}
        <Box sx={{ mt: 4, maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Course Progress Example
          </Typography>
          <CourseProgress
            completionPercentage={65}
            completedActivities={13}
            totalActivities={20}
            showDetails={true}
            activityBreakdown={[
              { type: 'Assignment', completed: 5, total: 7 },
              { type: 'Quiz', completed: 4, total: 6 },
              { type: 'Forum', completed: 4, total: 7 },
            ]}
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
