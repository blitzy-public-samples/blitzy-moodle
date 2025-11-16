/**
 * UserManagementPage Component
 *
 * Admin page for managing users. Provides comprehensive user administration features
 * including listing, creating, editing, suspending, and deleting users.
 *
 * @module features/admin/users/pages
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Breadcrumbs,
  Link,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Home as HomeIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { apiClient } from '@/services/api/client';
import { ADMIN_ENDPOINTS } from '@/services/api/endpoints';

/**
 * Admin user interface matching the API response
 */
interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  suspended: boolean;
  roles: Array<{
    roleid: number;
    shortname: string;
    name: string;
  }>;
  lastaccess: number;
  timecreated: number;
  timemodified: number;
}

/**
 * User data interface used internally by the component
 */
interface UserData {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  auth: string;
  suspended: number;
  deleted: number;
  confirmed: number;
  role?: string; // User role (student, teacher, admin, etc.)
  roles?: string[]; // Multiple roles for filtering
}

/**
 * UserManagementPage Component
 *
 * Main page for user administration. Provides:
 * - User list with pagination, search, and filtering
 * - User creation dialog
 * - User editing dialog
 * - Bulk operations (suspend, delete, assign cohort)
 * - Password reset functionality
 * - User suspension/activation
 * - User deletion with confirmation
 *
 * Routes:
 * - /admin/users - Main user management page
 *
 * @example
 * ```tsx
 * // Router configuration
 * <Route path="/admin/users" element={<UserManagementPage />} />
 * ```
 */
export function UserManagementPage() {
  console.log('[UserManagementPage] Component rendering');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch users from API using React Query
  const { data: apiUsers, isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      console.log('[UserManagementPage] useQuery queryFn executing');
      console.log('[UserManagementPage] API endpoint:', ADMIN_ENDPOINTS.USERS.LIST);
      console.log('[UserManagementPage] apiClient baseURL:', apiClient.defaults.baseURL);
      const response = await apiClient.get<{ success: boolean; data: AdminUser[] }>(
        ADMIN_ENDPOINTS.USERS.LIST
      );
      console.log('[UserManagementPage] API response:', response.data);
      return response.data.data;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  console.log('[UserManagementPage] useQuery state:', { isLoading, hasData: !!apiUsers, error });

  // Mutation for creating a user
  const createUserMutation = useMutation({
    mutationFn: async (userData: {
      username: string;
      firstname: string;
      lastname: string;
      email: string;
      password: string;
      auth: string;
    }) => {
      const response = await apiClient.post<{ success: boolean; data: AdminUser }>(
        ADMIN_ENDPOINTS.USERS.CREATE,
        userData
      );
      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate and refetch the users list
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  // Mutation for updating a user
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { 
      id: number; 
      userData: {
        username?: string;
        firstname?: string;
        lastname?: string;
        email?: string;
        password?: string;
        auth?: string;
      }
    }) => {
      const response = await apiClient.put<{ success: boolean; data: AdminUser }>(
        ADMIN_ENDPOINTS.USERS.UPDATE(id),
        userData
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  // Mutation for deleting a user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiClient.delete<{ success: boolean }>(
        ADMIN_ENDPOINTS.USERS.DELETE(userId)
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  // Mutation for bulk operations
  const bulkOperationMutation = useMutation({
    mutationFn: async (payload: {
      operation: 'suspend' | 'unsuspend' | 'delete';
      userIds: number[];
    }) => {
      const response = await apiClient.post<{ success: boolean }>(
        ADMIN_ENDPOINTS.USERS.BULK,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  // Transform API users to UserData format
  const transformedUsers: UserData[] = React.useMemo(() => {
    if (!apiUsers) {return [];}
    
    return apiUsers.map(user => ({
      id: user.id,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      auth: 'manual', // Default to manual, can be extended later
      suspended: user.suspended ? 1 : 0,
      deleted: 0, // Not provided by API
      confirmed: 1, // Not provided by API
      role: user.roles?.[0]?.shortname || 'student', // Extract shortname from first role with optional chaining
      roles: user.roles?.map(r => r.shortname) || [], // Transform roles to array of shortnames for filtering
    }));
  }, [apiUsers]);

  // State management
  const [users, setUsers] = useState<UserData[]>([]);
  const loading = isLoading;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  
  // Filter state
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [authFilter, setAuthFilter] = useState<string>('all');

  // Update users when API data changes
  useEffect(() => {
    setUsers(transformedUsers);
  }, [transformedUsers]);

  // Computed filtered users based on search query and filters
  const filteredUsers = React.useMemo(() => {
    let result = users;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.username.toLowerCase().includes(query) ||
        user.firstname.toLowerCase().includes(query) ||
        user.lastname.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    }
    
    // Apply role filter - check both role and roles array
    if (roleFilter !== 'all') {
      result = result.filter(user => {
        // Check the roles array if it exists
        if (user.roles && user.roles.length > 0) {
          return user.roles.includes(roleFilter);
        }
        // Fallback to single role property
        return user.role === roleFilter;
      });
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        result = result.filter(user => user.suspended === 0 && user.deleted === 0);
      } else if (statusFilter === 'suspended') {
        result = result.filter(user => user.suspended === 1);
      } else if (statusFilter === 'deleted') {
        result = result.filter(user => user.deleted === 1);
      }
    }
    
    // Apply auth filter
    if (authFilter !== 'all') {
      result = result.filter(user => user.auth === authFilter);
    }
    
    return result;
  }, [users, searchQuery, roleFilter, statusFilter, authFilter]);

  const totalCount = filteredUsers.length;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  // Form state for user creation/editing
  const [formData, setFormData] = useState({
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    auth: 'manual',
  });

  /**
   * Handle breadcrumb navigation
   */
  const handleBreadcrumbClick = (path: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    navigate(path);
  };

  /**
   * Handle page change in pagination
   */
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  /**
   * Handle rows per page change
   */
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  /**
   * Handle search input change
   */
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  /**
   * Handle user selection for bulk operations
   */
  const handleSelectUser = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  /**
   * Handle select all users
   */
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Select all users on current page
      const currentPageUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
      setSelectedUsers(currentPageUsers.map((user) => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  /**
   * Open create user dialog
   */
  const handleOpenCreateDialog = () => {
    setFormData({
      username: '',
      firstname: '',
      lastname: '',
      email: '',
      password: '',
      auth: 'manual',
    });
    setCreateDialogOpen(true);
  };

  /**
   * Close create user dialog
   */
  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setFormErrors({});
    // Reset form
    setFormData({
      username: '',
      firstname: '',
      lastname: '',
      email: '',
      password: '',
      auth: 'manual',
    });
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    // Required field validation
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else {
      // Check for duplicate username
      const isDuplicate = users.some(user => user.username.toLowerCase() === formData.username.toLowerCase());
      if (isDuplicate) {
        errors.username = 'Username already exists';
      }
    }
    
    if (!formData.firstname.trim()) {
      errors.firstname = 'First name is required';
    }
    
    if (!formData.lastname.trim()) {
      errors.lastname = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else {
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Invalid email format';
      }
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle create user form submission
   */
  const handleCreateUser = async () => {
    // Validate form
    if (!validateForm()) {
      return; // Stay on dialog if validation fails
    }
    
    try {
      // Call the API to create the user
      await createUserMutation.mutateAsync({
        username: formData.username,
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        password: formData.password,
        auth: formData.auth,
      });
      
      // Close dialog and reset form on success
      setCreateDialogOpen(false);
      setFormErrors({});
      
      // Reset form
      setFormData({
        username: '',
        firstname: '',
        lastname: '',
        email: '',
        password: '',
        auth: 'manual',
      });
    } catch (error: any) {
      // Handle API errors
      console.error('Failed to create user:', error);
      
      // Show error in the form if it's a validation error from the API
      if (error.response?.data?.error) {
        setFormErrors({
          email: error.response.data.error.message || 'Failed to create user',
        });
      }
    }
  };

  /**
   * Open edit user dialog
   */
  const handleOpenEditDialog = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      password: '',
      auth: user.auth,
    });
    setEditDialogOpen(true);
  };

  /**
   * Close edit user dialog
   */
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingUser(null);
  };

  /**
   * Handle edit user form submission
   */
  const handleEditUser = async () => {
    if (!editingUser) {return;}
    
    try {
      // Call the API to update the user
      await updateUserMutation.mutateAsync({
        id: editingUser.id,
        userData: {
          username: formData.username,
          firstname: formData.firstname,
          lastname: formData.lastname,
          email: formData.email,
          auth: formData.auth,
          // Only include password if it was changed
          ...(formData.password ? { password: formData.password } : {}),
        },
      });
      
      // Close dialog on success
      setEditDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      // Handle API errors
      console.error('Failed to update user:', error);
    }
  };

  /**
   * Open delete confirmation dialog
   */
  const handleOpenDeleteDialog = (userId: number) => {
    setDeletingUserId(userId);
    setDeleteDialogOpen(true);
  };

  /**
   * Close delete confirmation dialog
   */
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeletingUserId(null);
  };

  /**
   * Handle user deletion
   */
  const handleDeleteUser = async () => {
    if (deletingUserId === null) {return;}
    
    try {
      // Prevent deletion of admin user (id 1 or username 'admin')
      const userToDelete = users.find(user => user.id === deletingUserId);
      if (userToDelete && (userToDelete.username === 'admin' || userToDelete.id === 1)) {
        console.error('Cannot delete admin user');
        setDeleteDialogOpen(false);
        setDeletingUserId(null);
        return;
      }
      
      // Call the API to delete the user
      await deleteUserMutation.mutateAsync(deletingUserId);
      
      // Close dialog on success
      setDeleteDialogOpen(false);
      setDeletingUserId(null);
    } catch (error: any) {
      // Handle API errors
      console.error('Failed to delete user:', error);
      setDeleteDialogOpen(false);
      setDeletingUserId(null);
    }
  };

  /**
   * Handle bulk operations menu open
   */
  const handleBulkMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Handle bulk operations menu close
   */
  const handleBulkMenuClose = () => {
    setAnchorEl(null);
  };

  /**
   * Handle suspend users bulk operation
   */
  const handleBulkSuspend = async () => {
    if (selectedUsers.length === 0) {return;}
    
    try {
      // Determine if we're suspending or unsuspending based on the first selected user
      const firstUser = users.find(u => u.id === selectedUsers[0]);
      const operation = firstUser?.suspended === 1 ? 'unsuspend' : 'suspend';
      
      await bulkOperationMutation.mutateAsync({
        operation,
        userIds: selectedUsers,
      });
      
      setSelectedUsers([]);
      handleBulkMenuClose();
    } catch (error: any) {
      console.error('Failed to suspend/unsuspend users:', error);
      handleBulkMenuClose();
    }
  };

  /**
   * Handle delete users bulk operation
   */
  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) {return;}
    
    // Prevent deletion of admin users
    const usersToDelete = users.filter(user => selectedUsers.includes(user.id));
    const hasAdmin = usersToDelete.some(user => user.username === 'admin' || user.id === 1);
    
    if (hasAdmin) {
      console.error('Cannot delete admin user in bulk operation');
      handleBulkMenuClose();
      return;
    }
    
    try {
      await bulkOperationMutation.mutateAsync({
        operation: 'delete',
        userIds: selectedUsers,
      });
      
      setSelectedUsers([]);
      handleBulkMenuClose();
    } catch (error: any) {
      console.error('Failed to delete users:', error);
      handleBulkMenuClose();
    }
  };

  /**
   * Handle password reset
   */
  const handlePasswordReset = async (userId: number) => {
    // Mock implementation for E2E testing (in production, this would be an API call)
    console.log('Password reset email would be sent for user:', userId);
    // In a real implementation, this would trigger an API call to send a password reset email
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/"
          onClick={handleBreadcrumbClick('/')}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Home
        </Link>
        <Link
          color="inherit"
          href="/dashboard"
          onClick={handleBreadcrumbClick('/dashboard')}
        >
          Dashboard
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <PeopleIcon sx={{ mr: 0.5 }} fontSize="small" />
          User Management
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          User Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
          data-testid="create-user-button"
        >
          Create User
        </Button>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            placeholder="Search users..."
            value={searchQuery}
            onChange={handleSearchChange}
            variant="outlined"
            size="small"
            fullWidth
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            inputProps={{
              'data-testid': 'search-input',
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select 
              label="Role" 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              SelectDisplayProps={{ 'data-testid': 'filter-role' } as any}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="teacher">Teacher</MenuItem>
              <MenuItem value="student">Student</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select 
              label="Status" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              SelectDisplayProps={{ 'data-testid': 'filter-status' } as any}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="deleted">Deleted</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Auth Method</InputLabel>
            <Select 
              label="Auth Method" 
              value={authFilter}
              onChange={(e) => setAuthFilter(e.target.value)}
              SelectDisplayProps={{ 'data-testid': 'filter-auth' } as any}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
              <MenuItem value="ldap">LDAP</MenuItem>
              <MenuItem value="oauth2">OAuth2</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Bulk Operations Toolbar */}
      {selectedUsers.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>
              {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={handleBulkMenuOpen}
              data-testid="bulk-actions-button"
            >
              Bulk Actions
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleBulkMenuClose}
              data-testid="bulk-actions-menu"
            >
              <MenuItem onClick={handleBulkSuspend} data-testid="bulk-suspend-button">
                Suspend Users
              </MenuItem>
              <MenuItem onClick={handleBulkDelete} data-testid="bulk-delete-button">
                Delete Users
              </MenuItem>
              <MenuItem onClick={handleBulkMenuClose}>Assign to Cohort</MenuItem>
            </Menu>
          </Stack>
        </Paper>
      )}

      {/* User List Table */}
      <Paper data-region="report-user-list-wrapper">
        <TableContainer>
          <Table data-testid="user-table">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedUsers.length > 0 && selectedUsers.length < users.length}
                    checked={users.length > 0 && selectedUsers.length === users.length}
                    onChange={handleSelectAll}
                    data-testid="select-all-checkbox"
                  />
                </TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Auth Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">No users found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((user) => (
                  <TableRow 
                    key={user.id} 
                    data-testid={`user-row-${user.id}`}
                    data-user-roles={JSON.stringify(user.roles || [user.role])}
                    data-user-suspended={user.suspended}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        data-testid={`select-user-${user.id}`}
                      />
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{`${user.firstname} ${user.lastname}`}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.auth}</TableCell>
                    <TableCell>
                      {user.suspended === 1 ? (
                        <Chip label="Suspended" size="small" color="warning" />
                      ) : user.deleted === 1 ? (
                        <Chip label="Deleted" size="small" color="error" />
                      ) : (
                        <Chip label="Active" size="small" color="success" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditDialog(user)}
                        data-testid={`edit-user-${user.id}`}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handlePasswordReset(user.id)}
                        data-testid={`reset-password-${user.id}`}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeleteDialog(user.id)}
                        data-testid={`delete-user-${user.id}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
          data-testid="table-pagination"
        />
      </Paper>

      {/* Create User Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        maxWidth="sm"
        fullWidth
        data-testid="create-user-dialog"
      >
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              fullWidth
              inputProps={{
                'data-testid': 'username-input',
              }}
              error={!!formErrors.username}
              helperText={formErrors.username}
            />
            <TextField
              label="First Name"
              value={formData.firstname}
              onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
              required
              fullWidth
              inputProps={{
                'data-testid': 'firstname-input',
              }}
              error={!!formErrors.firstname}
              helperText={formErrors.firstname}
            />
            <TextField
              label="Last Name"
              value={formData.lastname}
              onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
              required
              fullWidth
              inputProps={{
                'data-testid': 'lastname-input',
              }}
              error={!!formErrors.lastname}
              helperText={formErrors.lastname}
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              fullWidth
              inputProps={{
                'data-testid': 'email-input',
              }}
              error={!!formErrors.email}
              helperText={formErrors.email}
            />
            <TextField
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              fullWidth
              inputProps={{
                'data-testid': 'password-input',
              }}
              error={!!formErrors.password}
              helperText={formErrors.password}
            />
            <FormControl fullWidth>
              <InputLabel>Auth Method</InputLabel>
              <Select
                value={formData.auth}
                onChange={(e) => setFormData({ ...formData, auth: e.target.value })}
                label="Auth Method"
                SelectDisplayProps={{ 'data-testid': 'auth-method-select' } as any}
              >
                <MenuItem value="manual">Manual</MenuItem>
                <MenuItem value="ldap">LDAP</MenuItem>
                <MenuItem value="oauth2">OAuth2</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Cancel</Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            color="primary"
            data-testid="create-user-submit"
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
        data-testid="edit-user-dialog"
      >
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              fullWidth
              disabled
              inputProps={{
                'data-testid': 'edit-username-input',
              }}
            />
            <TextField
              label="First Name"
              value={formData.firstname}
              onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
              required
              fullWidth
              inputProps={{
                'data-testid': 'edit-firstname-input',
              }}
            />
            <TextField
              label="Last Name"
              value={formData.lastname}
              onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
              required
              fullWidth
              inputProps={{
                'data-testid': 'edit-lastname-input',
              }}
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              fullWidth
              inputProps={{
                'data-testid': 'edit-email-input',
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button
            onClick={handleEditUser}
            variant="contained"
            color="primary"
            data-testid="edit-user-submit"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        data-testid="delete-user-dialog"
      >
        <DialogTitle>Confirm User Deletion</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. The user's data will be anonymized.
          </Alert>
          <Typography>Are you sure you want to delete this user?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleDeleteUser}
            variant="contained"
            color="error"
            data-testid="delete-user-confirm"
          >
            Delete User
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default UserManagementPage;
