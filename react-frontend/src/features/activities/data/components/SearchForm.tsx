/**
 * SearchForm Component
 *
 * React component providing advanced search capabilities for the Moodle Database activity
 * with field-specific filters, multiple search operators, and toggle between simple and
 * advanced search modes.
 *
 * Features:
 * - Simple search mode with single text input searching across all fields
 * - Advanced search mode with per-field filters based on database field definitions
 * - Dynamic filter input generation based on field types (12 field types supported)
 * - Multiple search operators per field type (contains, equals, greater than, less than, etc.)
 * - Debounced search input to prevent excessive API calls
 * - React Hook Form integration for form state management
 * - Material-UI v5 components following Material Design specifications
 * - WCAG 2.1 AA compliant accessibility
 *
 * Based on Moodle's PHP implementation:
 * - public/mod/data/view.php (search filtering)
 * - public/mod/data/locallib.php (data_build_search_array function)
 *
 * @module features/activities/data/components/SearchForm
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { FieldValues, Control } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import {
  Box,
  Stack,
  Paper,
  Typography,
  Button,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Grid,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import { useDatabase } from '@/features/activities/data/hooks/useDatabase';
import type { DatabaseField } from '@/features/activities/data/types/data.types';
import { FieldType } from '@/features/activities/data/types/data.types';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';
import type { SelectOption } from '@/components/forms/FormSelect';
import { FormDatePicker } from '@/components/forms/FormDatePicker';
import useDebounce from '@/hooks/useDebounce';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Search mode options for toggling between simple and advanced search
 */
export type SearchMode = 'simple' | 'advanced';

/**
 * Available search operators for different field types
 */
export type SearchOperator =
  | 'contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'between'
  | 'is_empty'
  | 'is_not_empty';

/**
 * Structure for a single search filter criterion
 */
export interface SearchFilter {
  /** Field ID to filter on */
  fieldId: number;
  /** Field name for display */
  fieldName: string;
  /** Search operator */
  operator: SearchOperator;
  /** Primary filter value */
  value: string;
  /** Secondary value for range operators (between) */
  valueTo?: string;
}

/**
 * Search criteria structure passed to parent component/API
 */
export interface SearchCriteriaOutput {
  /** Simple search query string */
  search?: string;
  /** Advanced search filters by field ID */
  advanced?: Record<number, { operator: SearchOperator; value: string; valueTo?: string }>;
  /** Whether search is in advanced mode */
  isAdvanced: boolean;
}

/**
 * Props interface for the SearchForm component
 */
export interface SearchFormProps {
  /** Database activity ID */
  dataId: number;
  /** Callback when search criteria changes */
  onSearch: (criteria: SearchCriteriaOutput) => void;
  /** Initial search mode */
  initialMode?: SearchMode;
  /** Initial simple search value */
  initialSearch?: string;
  /** Initial advanced filters */
  initialFilters?: SearchFilter[];
  /** Debounce delay in milliseconds for simple search */
  debounceDelay?: number;
  /** Whether to show the search form in a compact layout */
  compact?: boolean;
  /** Custom placeholder text for simple search */
  placeholder?: string;
  /** Whether to disable the search form */
  disabled?: boolean;
}

/**
 * Form values structure for React Hook Form
 */
interface SearchFormValues extends FieldValues {
  simpleSearch: string;
  advancedFilters: Record<string, { operator: string; value: string; valueTo?: string }>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default debounce delay for simple search (500ms)
 */
const DEFAULT_DEBOUNCE_DELAY = 500;

/**
 * Operator labels for display in dropdown
 */
const OPERATOR_LABELS: Record<SearchOperator, string> = {
  contains: 'Contains',
  equals: 'Equals',
  not_equals: 'Does not equal',
  starts_with: 'Starts with',
  ends_with: 'Ends with',
  greater_than: 'Greater than',
  less_than: 'Less than',
  greater_equal: 'Greater than or equal',
  less_equal: 'Less than or equal',
  between: 'Between',
  is_empty: 'Is empty',
  is_not_empty: 'Is not empty',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets available operators for a specific field type
 *
 * @param fieldType - The type of database field
 * @returns Array of applicable search operators
 */
function getOperatorsForFieldType(fieldType: FieldType): SearchOperator[] {
  switch (fieldType) {
    case FieldType.Text:
    case FieldType.Textarea:
    case FieldType.URL:
      return ['contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'];

    case FieldType.Number:
      return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'between', 'is_empty', 'is_not_empty'];

    case FieldType.Date:
      return ['equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'between', 'is_empty', 'is_not_empty'];

    case FieldType.Menu:
    case FieldType.RadioButton:
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];

    case FieldType.MultiMenu:
      return ['contains', 'equals', 'is_empty', 'is_not_empty'];

    case FieldType.Checkbox:
      return ['equals', 'is_empty', 'is_not_empty'];

    case FieldType.File:
    case FieldType.Picture:
      return ['is_empty', 'is_not_empty'];

    case FieldType.LatLong:
      return ['contains', 'is_empty', 'is_not_empty'];

    default:
      return ['contains', 'equals', 'is_empty', 'is_not_empty'];
  }
}

/**
 * Gets menu options from a field's param1 configuration
 *
 * @param field - Database field with menu options
 * @returns Array of SelectOption for dropdown
 */
function getMenuOptionsFromField(field: DatabaseField): SelectOption[] {
  if (
    field.type !== FieldType.Menu &&
    field.type !== FieldType.MultiMenu &&
    field.type !== FieldType.RadioButton
  ) {
    return [];
  }

  const param1 = (field as { param1?: string }).param1;
  if (!param1) {
    return [];
  }

  return param1
    .split('\n')
    .filter((option) => option.trim() !== '')
    .map((option) => ({
      value: option.trim(),
      label: option.trim(),
    }));
}

/**
 * Converts operators to SelectOption format for dropdown
 *
 * @param operators - Array of search operators
 * @returns Array of SelectOption
 */
function operatorsToSelectOptions(operators: SearchOperator[]): SelectOption[] {
  return operators.map((op) => ({
    value: op,
    label: OPERATOR_LABELS[op],
  }));
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * SearchForm Component
 *
 * Provides advanced search capabilities for the Database activity with field-specific
 * filters, multiple search operators, and toggle between simple and advanced modes.
 *
 * @param props - Component props
 * @returns JSX element rendering the search form
 *
 * @example
 * ```tsx
 * <SearchForm
 *   dataId={123}
 *   onSearch={(criteria) => console.log('Search criteria:', criteria)}
 *   initialMode="simple"
 *   placeholder="Search entries..."
 * />
 * ```
 *
 * @example Advanced mode with initial filters
 * ```tsx
 * <SearchForm
 *   dataId={123}
 *   onSearch={handleSearch}
 *   initialMode="advanced"
 *   initialFilters={[
 *     { fieldId: 1, fieldName: 'Name', operator: 'contains', value: 'John' }
 *   ]}
 * />
 * ```
 */
function SearchForm({
  dataId,
  onSearch,
  initialMode = 'simple',
  initialSearch = '',
  initialFilters = [],
  debounceDelay = DEFAULT_DEBOUNCE_DELAY,
  compact = false,
  placeholder = 'Search all fields...',
  disabled = false,
}: SearchFormProps): JSX.Element {
  // ============================================================================
  // State
  // ============================================================================

  /** Current search mode (simple or advanced) */
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);

  /** Active search filters for advanced mode */
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>(initialFilters);

  /** Expanded accordion panels in advanced mode */
  const [expandedPanels, setExpandedPanels] = useState<Set<number>>(new Set());

  /** Simple search input value (before debounce) */
  const [simpleSearchValue, setSimpleSearchValue] = useState<string>(initialSearch);

  // ============================================================================
  // Hooks
  // ============================================================================

  /** Fetch database configuration including field definitions */
  const { data: database, isLoading: isDatabaseLoading } = useDatabase(dataId, {
    enabled: dataId > 0,
  });

  /** Debounced simple search value */
  const debouncedSimpleSearch = useDebounce(simpleSearchValue, debounceDelay);

  /** React Hook Form setup */
  const { control, reset } = useForm<SearchFormValues>({
    defaultValues: {
      simpleSearch: initialSearch,
      advancedFilters: {},
    },
  });

  /** Type-cast control for compatibility with generic form components */
  const formControl = control as unknown as Control<FieldValues>;

  // ============================================================================
  // Derived State
  // ============================================================================

  /** Available fields from database configuration */
  const fields = useMemo<DatabaseField[]>(() => {
    return database?.fields ?? [];
  }, [database?.fields]);

  /** Check if there are any active filters */
  const hasActiveFilters = useMemo(() => {
    return searchMode === 'advanced' && activeFilters.length > 0;
  }, [searchMode, activeFilters]);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Trigger search when debounced simple search value changes
   */
  useEffect(() => {
    if (searchMode === 'simple') {
      onSearch({
        search: debouncedSimpleSearch || undefined,
        isAdvanced: false,
      });
    }
  }, [debouncedSimpleSearch, searchMode, onSearch]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handles search mode toggle between simple and advanced
   */
  const handleModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: SearchMode | null) => {
      if (newMode !== null) {
        setSearchMode(newMode);

        // Clear filters when switching modes
        if (newMode === 'simple') {
          setActiveFilters([]);
          onSearch({
            search: simpleSearchValue || undefined,
            isAdvanced: false,
          });
        } else {
          // Trigger advanced search with current filters
          if (activeFilters.length > 0) {
            const advancedCriteria: Record<number, { operator: SearchOperator; value: string; valueTo?: string }> = {};
            activeFilters.forEach((filter) => {
              advancedCriteria[filter.fieldId] = {
                operator: filter.operator,
                value: filter.value,
                valueTo: filter.valueTo,
              };
            });
            onSearch({
              advanced: advancedCriteria,
              isAdvanced: true,
            });
          } else {
            onSearch({
              isAdvanced: true,
            });
          }
        }
      }
    },
    [simpleSearchValue, activeFilters, onSearch]
  );

  /**
   * Adds a new empty filter for a specific field
   */
  const handleAddFilter = useCallback(
    (fieldId: number) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;

      const operators = getOperatorsForFieldType(field.type);
      const defaultOperator = operators[0] || 'contains';

      const newFilter: SearchFilter = {
        fieldId: field.id,
        fieldName: field.name,
        operator: defaultOperator,
        value: '',
      };

      setActiveFilters((prev) => [...prev, newFilter]);
      setExpandedPanels((prev) => new Set([...prev, field.id]));
    },
    [fields]
  );

  /**
   * Removes a filter by field ID
   */
  const handleRemoveFilter = useCallback((fieldId: number) => {
    setActiveFilters((prev) => prev.filter((f) => f.fieldId !== fieldId));
    setExpandedPanels((prev) => {
      const newSet = new Set(prev);
      newSet.delete(fieldId);
      return newSet;
    });
  }, []);

  /**
   * Handles accordion panel expansion toggle
   */
  const handleAccordionChange = useCallback(
    (fieldId: number) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedPanels((prev) => {
        const newSet = new Set(prev);
        if (isExpanded) {
          newSet.add(fieldId);
        } else {
          newSet.delete(fieldId);
        }
        return newSet;
      });
    },
    []
  );

  /**
   * Handles advanced search form submission
   */
  const handleAdvancedSearch = useCallback(() => {
    if (activeFilters.length === 0) {
      onSearch({ isAdvanced: true });
      return;
    }

    const advancedCriteria: Record<number, { operator: SearchOperator; value: string; valueTo?: string }> = {};
    activeFilters.forEach((filter) => {
      if (filter.value || filter.operator === 'is_empty' || filter.operator === 'is_not_empty') {
        advancedCriteria[filter.fieldId] = {
          operator: filter.operator,
          value: filter.value,
          valueTo: filter.valueTo,
        };
      }
    });

    onSearch({
      advanced: Object.keys(advancedCriteria).length > 0 ? advancedCriteria : undefined,
      isAdvanced: true,
    });
  }, [activeFilters, onSearch]);

  /**
   * Clears all search criteria and resets form
   */
  const handleClearSearch = useCallback(() => {
    setSimpleSearchValue('');
    setActiveFilters([]);
    setExpandedPanels(new Set());
    reset();

    onSearch({
      isAdvanced: searchMode === 'advanced',
    });
  }, [reset, searchMode, onSearch]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Renders the value input based on field type
   */
  const renderValueInput = useCallback(
    (_filter: SearchFilter, field: DatabaseField, valueKey: 'value' | 'valueTo') => {
      const inputName = `${field.id}-${valueKey}`;

      switch (field.type) {
        case FieldType.Number:
          return (
            <FormInput
              name={inputName}
              label={valueKey === 'value' ? 'Value' : 'To value'}
              type="number"
              control={formControl}
              placeholder="Enter number..."
              disabled={disabled}
            />
          );

        case FieldType.Date:
          return (
            <FormDatePicker
              name={inputName}
              label={valueKey === 'value' ? 'Date' : 'To date'}
              control={formControl}
              disabled={disabled}
            />
          );

        case FieldType.Menu:
        case FieldType.RadioButton:
          const menuOptions = getMenuOptionsFromField(field);
          return (
            <FormSelect
              name={inputName}
              label={valueKey === 'value' ? 'Value' : 'To value'}
              control={formControl}
              options={menuOptions}
              placeholder="Select option..."
              disabled={disabled}
            />
          );

        case FieldType.MultiMenu:
          const multiMenuOptions = getMenuOptionsFromField(field);
          return (
            <FormSelect
              name={inputName}
              label={valueKey === 'value' ? 'Value' : 'To value'}
              control={formControl}
              options={multiMenuOptions}
              multiple
              placeholder="Select options..."
              disabled={disabled}
            />
          );

        case FieldType.Checkbox:
          return (
            <FormSelect
              name={inputName}
              label="Value"
              control={formControl}
              options={[
                { value: '1', label: 'Checked' },
                { value: '0', label: 'Unchecked' },
              ]}
              placeholder="Select..."
              disabled={disabled}
            />
          );

        case FieldType.Text:
        case FieldType.Textarea:
        case FieldType.URL:
        case FieldType.LatLong:
        case FieldType.File:
        case FieldType.Picture:
        default:
          return (
            <FormInput
              name={inputName}
              label={valueKey === 'value' ? 'Value' : 'To value'}
              type="text"
              control={formControl}
              placeholder={`Enter ${field.name.toLowerCase()}...`}
              disabled={disabled}
            />
          );
      }
    },
    [formControl, disabled]
  );

  /**
   * Renders active filter chips for quick overview
   */
  const renderActiveFilterChips = useCallback(() => {
    if (activeFilters.length === 0) return null;

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
        {activeFilters.map((filter) => (
          <Chip
            key={filter.fieldId}
            label={`${filter.fieldName}: ${OPERATOR_LABELS[filter.operator]}${
              filter.value ? ` "${filter.value}"` : ''
            }${filter.valueTo ? ` - "${filter.valueTo}"` : ''}`}
            onDelete={() => handleRemoveFilter(filter.fieldId)}
            deleteIcon={<CloseIcon />}
            size="small"
            color="primary"
            variant="outlined"
          />
        ))}
      </Box>
    );
  }, [activeFilters, handleRemoveFilter]);

  // ============================================================================
  // Render
  // ============================================================================

  if (isDatabaseLoading) {
    return (
      <Paper elevation={compact ? 0 : 1} sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Loading search options...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={compact ? 0 : 1}
      sx={{
        p: compact ? 1 : 2,
        mb: 2,
      }}
      role="search"
      aria-label="Database search form"
    >
      <Stack spacing={2}>
        {/* Search Mode Toggle */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 500 }}>
            Search Entries
          </Typography>

          <ToggleButtonGroup
            value={searchMode}
            exclusive
            onChange={handleModeChange}
            size="small"
            aria-label="Search mode"
            disabled={disabled}
          >
            <ToggleButton value="simple" aria-label="Simple search">
              <SearchIcon sx={{ mr: 0.5 }} fontSize="small" />
              Simple
            </ToggleButton>
            <ToggleButton value="advanced" aria-label="Advanced search">
              <FilterListIcon sx={{ mr: 0.5 }} fontSize="small" />
              Advanced
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider />

        {/* Simple Search Mode */}
        {searchMode === 'simple' && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <FormInput
              name="simpleSearch"
              label=""
              type="text"
              control={formControl}
              placeholder={placeholder}
              disabled={disabled}
              fullWidth
              margin="none"
              size="small"
              startAdornment={<SearchIcon color="action" />}
            />
            {simpleSearchValue && (
              <IconButton
                onClick={handleClearSearch}
                size="small"
                aria-label="Clear search"
                disabled={disabled}
              >
                <ClearIcon />
              </IconButton>
            )}
          </Box>
        )}

        {/* Advanced Search Mode */}
        {searchMode === 'advanced' && (
          <Box>
            {/* Field Selection for Adding Filters */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Add search filters by selecting a field:
              </Typography>
              <Grid container spacing={1}>
                {fields.map((field) => {
                  const isActive = activeFilters.some((f) => f.fieldId === field.id);
                  return (
                    <Grid item key={field.id}>
                      <Chip
                        label={field.name}
                        onClick={() => handleAddFilter(field.id)}
                        icon={isActive ? <RemoveIcon /> : <AddIcon />}
                        color={isActive ? 'primary' : 'default'}
                        variant={isActive ? 'filled' : 'outlined'}
                        disabled={disabled || isActive}
                        size="small"
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </Box>

            {/* Active Filter Chips */}
            {renderActiveFilterChips()}

            {/* Filter Accordions */}
            {activeFilters.length > 0 && (
              <Box sx={{ mt: 2 }}>
                {activeFilters.map((filter) => {
                  const field = fields.find((f) => f.id === filter.fieldId);
                  if (!field) return null;

                  return (
                    <Accordion
                      key={filter.fieldId}
                      expanded={expandedPanels.has(filter.fieldId)}
                      onChange={handleAccordionChange(filter.fieldId)}
                      sx={{ mb: 1 }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls={`filter-${filter.fieldId}-content`}
                        id={`filter-${filter.fieldId}-header`}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            pr: 2,
                          }}
                        >
                          <Typography variant="subtitle2">{filter.fieldName}</Typography>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFilter(filter.fieldId);
                            }}
                            aria-label={`Remove ${filter.fieldName} filter`}
                            disabled={disabled}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          {/* Operator Selection */}
                          <Grid item xs={12} sm={4}>
                            <FormSelect
                              name={`filter-${filter.fieldId}-operator`}
                              label="Operator"
                              control={formControl}
                              options={operatorsToSelectOptions(getOperatorsForFieldType(field.type))}
                              disabled={disabled}
                            />
                          </Grid>

                          {/* Value Input */}
                          {filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && (
                            <>
                              <Grid item xs={12} sm={filter.operator === 'between' ? 4 : 8}>
                                {renderValueInput(filter, field, 'value')}
                              </Grid>

                              {/* Secondary Value for Between */}
                              {filter.operator === 'between' && (
                                <Grid item xs={12} sm={4}>
                                  {renderValueInput(filter, field, 'valueTo')}
                                </Grid>
                              )}
                            </>
                          )}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
            )}

            {/* Search Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearSearch}
                disabled={disabled || (!hasActiveFilters && !simpleSearchValue)}
                size="small"
              >
                Clear
              </Button>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleAdvancedSearch}
                disabled={disabled}
                size="small"
              >
                Search
              </Button>
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export default SearchForm;
