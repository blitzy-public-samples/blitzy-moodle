import type React from 'react';
import { useMemo, useState } from 'react';
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { DataGrid, GridToolbarContainer } from '@mui/x-data-grid';
import { Button, Typography, Paper, Stack, Menu, MenuItem } from '@mui/material';
import { Delete as DeleteIcon, SwapHoriz as SwapIcon } from '@mui/icons-material';

/**
 * Interface representing a user's response to a choice activity
 */
export interface UserResponse {
  /** Unique identifier for the response attempt */
  attemptid: number;
  /** User ID who made the response */
  userid: number;
  /** User's last name */
  lastname: string;
  /** User's first name */
  firstname: string;
  /** Dynamic extra identity fields (e.g., email, idnumber, institution) */
  [key: string]: string | number;
  /** Comma-separated list of group names the user belongs to */
  groups: string;
  /** Selected choice option text */
  choice: string;
  /** Selected choice option ID */
  optionid: number;
}

/**
 * Props for the ChoiceResultsTable component
 */
export interface ChoiceResultsTableProps {
  /** Array of user responses to display in the table */
  results: UserResponse[];
  /** Callback function to delete selected responses */
  onDelete: (attemptids: number[]) => void;
  /** Callback function to modify selected responses to a new option */
  onModify: (userids: number[], newoptionid: number) => void;
  /** Loading state for data fetching */
  loading: boolean;
  /** Array of extra identity field names to display as columns */
  extraFields: string[];
  /** Available choice options for the modify action */
  availableOptions?: Array<{ id: number; text: string }>;
}

/**
 * Custom toolbar component for the DataGrid with bulk action buttons
 */
interface CustomToolbarProps {
  selectedRows: GridRowSelectionModel;
  onDelete: () => void;
  onModify: (optionid: number) => void;
  availableOptions: Array<{ id: number; text: string }>;
}

function CustomToolbar({ selectedRows, onDelete, onModify, availableOptions }: CustomToolbarProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleModifyClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleModifyClose = () => {
    setAnchorEl(null);
  };

  const handleSelectOption = (optionid: number) => {
    onModify(optionid);
    handleModifyClose();
  };

  if (selectedRows.length === 0) {
    return null;
  }

  return (
    <GridToolbarContainer>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          p: 2,
          width: '100%',
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {selectedRows.length} {selectedRows.length === 1 ? 'row' : 'rows'} selected
        </Typography>
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<DeleteIcon />}
          onClick={onDelete}
          aria-label="Delete selected responses"
        >
          Delete Selected
        </Button>
        {availableOptions.length > 0 && (
          <>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<SwapIcon />}
              onClick={handleModifyClick}
              aria-label="Move selected responses to option"
            >
              Move to Option
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleModifyClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              {availableOptions.map((option) => (
                <MenuItem key={option.id} onClick={() => handleSelectOption(option.id)}>
                  {option.text}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Stack>
    </GridToolbarContainer>
  );
}

/**
 * Custom component to display when there are no rows in the table
 */
function NoRowsOverlay() {
  return (
    <Stack height="100%" alignItems="center" justifyContent="center" sx={{ py: 4 }}>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No responses yet
      </Typography>
      <Typography variant="body2" color="text.secondary">
        There are currently no responses to display for this choice activity.
      </Typography>
    </Stack>
  );
}

/**
 * Data table component displaying choice results with user details, groups,
 * selected options, and bulk action support using Material-UI DataGrid
 */
function ChoiceResultsTable({
  results,
  onDelete,
  onModify,
  loading,
  extraFields,
  availableOptions = [],
}: ChoiceResultsTableProps) {
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>([]);

  /**
   * Generate column definitions dynamically based on data structure
   */
  const columns = useMemo<GridColDef[]>(() => {
    const baseColumns: GridColDef[] = [
      {
        field: 'lastname',
        headerName: 'Last Name',
        flex: 1,
        minWidth: 120,
        sortable: true,
        filterable: true,
      },
      {
        field: 'firstname',
        headerName: 'First Name',
        flex: 1,
        minWidth: 120,
        sortable: true,
        filterable: true,
      },
    ];

    // Add dynamic extra identity field columns
    const extraColumns: GridColDef[] = extraFields.map((field) => ({
      field,
      headerName: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
      flex: 1,
      minWidth: 120,
      sortable: true,
      filterable: true,
    }));

    const endColumns: GridColDef[] = [
      {
        field: 'groups',
        headerName: 'Groups',
        flex: 1.5,
        minWidth: 150,
        sortable: true,
        filterable: true,
        renderCell: (params) => {
          const groups = params.value as string;
          return (
            <Typography variant="body2" noWrap title={groups}>
              {groups || '-'}
            </Typography>
          );
        },
      },
      {
        field: 'choice',
        headerName: 'Choice',
        flex: 1.5,
        minWidth: 150,
        sortable: true,
        filterable: true,
        renderCell: (params) => {
          const choice = params.value as string;
          return (
            <Typography variant="body2" noWrap title={choice}>
              {choice}
            </Typography>
          );
        },
      },
    ];

    return [...baseColumns, ...extraColumns, ...endColumns];
  }, [extraFields]);

  /**
   * Handle deletion of selected responses
   */
  const handleDelete = () => {
    const selectedAttemptIds = selectionModel
      .map((id) => {
        const response = results.find((r) => r.attemptid === id);
        return response?.attemptid;
      })
      .filter((id): id is number => id !== undefined);

    if (selectedAttemptIds.length > 0) {
      onDelete(selectedAttemptIds);
      setSelectionModel([]);
    }
  };

  /**
   * Handle modification of selected responses to a new option
   */
  const handleModify = (newoptionid: number) => {
    const selectedUserIds = selectionModel
      .map((id) => {
        const response = results.find((r) => r.attemptid === id);
        return response?.userid;
      })
      .filter((id): id is number => id !== undefined);

    if (selectedUserIds.length > 0) {
      onModify(selectedUserIds, newoptionid);
      setSelectionModel([]);
    }
  };

  /**
   * Map results to DataGrid rows with attemptid as the unique identifier
   */
  const rows = useMemo(() => {
    return results.map((result) => ({
      id: result.attemptid,
      ...result,
    }));
  }, [results]);

  return (
    <Paper
      elevation={1}
      sx={{
        width: '100%',
        height: 600,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={(newSelection) => {
          setSelectionModel(newSelection);
        }}
        slots={{
          toolbar: CustomToolbar,
          noRowsOverlay: NoRowsOverlay,
        }}
        slotProps={{
          toolbar: {
            selectedRows: selectionModel,
            onDelete: handleDelete,
            onModify: handleModify,
            availableOptions,
          },
        }}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25, page: 0 },
          },
          sorting: {
            sortModel: [{ field: 'lastname', sort: 'asc' }],
          },
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        sx={{
          border: 'none',
          '& .MuiDataGrid-cell': {
            py: 1,
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'action.hover',
            borderBottom: 2,
            borderColor: 'divider',
          },
          '& .MuiDataGrid-row': {
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            '&.Mui-selected': {
              backgroundColor: 'action.selected',
              '&:hover': {
                backgroundColor: 'action.selected',
              },
            },
          },
          // Responsive design for mobile
          '@media (max-width: 600px)': {
            '& .MuiDataGrid-columnHeaders': {
              fontSize: '0.875rem',
            },
            '& .MuiDataGrid-cell': {
              fontSize: '0.875rem',
              py: 0.5,
            },
          },
        }}
        aria-label="Choice results table"
      />
    </Paper>
  );
}

export default ChoiceResultsTable;
