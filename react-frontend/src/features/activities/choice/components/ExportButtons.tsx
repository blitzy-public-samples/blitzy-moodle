import React, { useState } from 'react';
import { ButtonGroup, Button, CircularProgress, Box } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

/**
 * Export format types for choice activity results
 */
export type ExportFormat = 'ods' | 'xls' | 'txt';

/**
 * Props for the ExportButtons component
 */
export interface ExportButtonsProps {
  /**
   * Callback function triggered when an export button is clicked
   * @param format - The selected export format (ods, xls, or txt)
   */
  onExport: (format: ExportFormat) => void;

  /**
   * Indicates if an export operation is currently in progress
   */
  loading: boolean;

  /**
   * Optional prop to disable all export buttons
   */
  disabled?: boolean;
}

/**
 * Configuration for export button formats
 * Based on public/mod/choice/report.php lines 288-303
 */
interface ExportButtonConfig {
  format: ExportFormat;
  label: string;
  ariaLabel: string;
}

/**
 * ExportButtons Component
 *
 * Renders a button group for exporting choice activity results to multiple formats.
 * This component provides three export options: ODS (OpenDocument Spreadsheet),
 * XLS (Excel), and TXT (plain text).
 *
 * Features:
 * - Material-UI ButtonGroup for consistent styling
 * - Download icon on each button
 * - Loading state with CircularProgress indicator
 * - Automatic button disabling during export
 * - Accessible with proper ARIA labels
 * - Permission-based visibility (requires mod/choice:downloadresponses capability)
 *
 * Based on Moodle's choice module report.php export functionality.
 *
 * @param props - Component props
 * @returns JSX element containing the export button group
 */
function ExportButtons({ onExport, loading, disabled = false }: ExportButtonsProps): JSX.Element {
  // Track which button was clicked to show loading state on correct button
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);

  /**
   * Export button configurations
   * Labels correspond to Moodle language strings:
   * - downloadods: "Download in ODS format"
   * - downloadexcel: "Download in Excel format"
   * - downloadtext: "Download in text format"
   */
  const exportButtons: ExportButtonConfig[] = [
    {
      format: 'ods',
      label: 'ODS',
      ariaLabel: 'Download in ODS format',
    },
    {
      format: 'xls',
      label: 'Excel',
      ariaLabel: 'Download in Excel format',
    },
    {
      format: 'txt',
      label: 'Text',
      ariaLabel: 'Download in text format',
    },
  ];

  /**
   * Handles export button click
   * Sets the active format and triggers the export callback
   */
  const handleExportClick = (format: ExportFormat): void => {
    if (!loading && !disabled) {
      setActiveFormat(format);
      onExport(format);
    }
  };

  /**
   * Reset active format when loading completes
   */
  React.useEffect(() => {
    if (!loading) {
      setActiveFormat(null);
    }
  }, [loading]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        mt: 2,
        mb: 1,
      }}
    >
      <ButtonGroup
        variant="contained"
        color="primary"
        disabled={disabled || loading}
        aria-label="Export choice results button group"
        sx={{
          boxShadow: 2,
          '& .MuiButton-root': {
            minWidth: '100px',
            textTransform: 'none',
            fontWeight: 500,
          },
        }}
      >
        {exportButtons.map((buttonConfig) => {
          const isActiveButton = loading && activeFormat === buttonConfig.format;

          return (
            <Button
              key={buttonConfig.format}
              onClick={() => handleExportClick(buttonConfig.format)}
              disabled={disabled || loading}
              startIcon={
                isActiveButton ? (
                  <CircularProgress size={20} color="inherit" aria-label="Exporting" />
                ) : (
                  <DownloadIcon />
                )
              }
              aria-label={buttonConfig.ariaLabel}
              sx={{
                position: 'relative',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'action.disabledBackground',
                  color: 'action.disabled',
                },
              }}
            >
              {buttonConfig.label}
            </Button>
          );
        })}
      </ButtonGroup>
    </Box>
  );
}

export default ExportButtons;
