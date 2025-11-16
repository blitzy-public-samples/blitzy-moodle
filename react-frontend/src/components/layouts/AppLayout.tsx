import type React from 'react';
import { Box, Toolbar, Container } from '@mui/material';
import { Header } from '../navigation/Header';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * AppLayout Component
 * 
 * Main application layout wrapper that includes the header and content area.
 * Used for authenticated pages that need the full application chrome.
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Toolbar /> {/* Spacer for fixed AppBar */}
      <Container
        component="main"
        maxWidth="xl"
        sx={{
          flexGrow: 1,
          py: 3,
        }}
      >
        {children}
      </Container>
    </Box>
  );
}
