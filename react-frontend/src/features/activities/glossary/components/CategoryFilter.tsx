/**
 * CategoryFilter Component
 *
 * Material-UI based category filter for glossary entries with multi-select capability.
 * Provides filtering by categories including special "All Categories" and "Not Categorized" options.
 *
 * Based on Moodle glossary category browsing mode (mode=cat) from public/mod/glossary/view.php
 * and glossary_categories table structure from public/mod/glossary/edit_form.php
 *
 * @module features/activities/glossary/components
 */

import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  SelectChangeEvent,
} from '@mui/material';
import type { GlossaryCategory } from '../types/glossary.types';

/**
 * Special category ID constants
 * Based on Moodle glossary category system
 */
const CATEGORY_ALL = -1; // All categories (no filter)
const CATEGORY_NOT_CATEGORIZED = 0; // Not categorized entries (notcategorised)

/**
 * Props interface for CategoryFilter component
 */
export interface CategoryFilterProps {
  /**
   * Array of available categories for the glossary
   * Fetched from glossary_categories table ordered by name ASC
   */
  categories: GlossaryCategory[];

  /**
   * Currently selected category IDs
   * Array of category IDs to support multi-select
   * Use [-1] for "All Categories", [0] for "Not Categorized", or specific category IDs
   */
  value: number[];

  /**
   * Callback fired when selected categories change
   * @param selectedIds - Array of selected category IDs
   */
  onChange: (selectedIds: number[]) => void;

  /**
   * Optional label for the select component
   * @default "Filter by Category"
   */
  label?: string;

  /**
   * Optional flag to disable the filter
   * @default false
   */
  disabled?: boolean;

  /**
   * Optional size variant for the select component
   * @default "medium"
   */
  size?: 'small' | 'medium';

  /**
   * Optional full width flag
   * @default false
   */
  fullWidth?: boolean;
}

/**
 * CategoryFilter Component
 *
 * Renders a Material-UI Select component with multi-select capability for filtering
 * glossary entries by categories. Includes special options for "All Categories" and
 * "Not Categorized" entries based on Moodle's glossary category system.
 *
 * Features:
 * - Multi-select with chip display for selected categories
 * - "All Categories" option to show all entries
 * - "Not Categorized" option for uncategorized entries (ID 0)
 * - Controlled component pattern with value prop
 * - Material-UI theming support
 * - Responsive design
 * - Full TypeScript typing with strict mode
 *
 * @example
 * ```tsx
 * const [selectedCategories, setSelectedCategories] = useState<number[]>([-1]);
 * const categories: GlossaryCategory[] = [...]; // Fetched from API
 *
 * <CategoryFilter
 *   categories={categories}
 *   value={selectedCategories}
 *   onChange={setSelectedCategories}
 *   fullWidth
 * />
 * ```
 */
export function CategoryFilter({
  categories,
  value,
  onChange,
  label = 'Filter by Category',
  disabled = false,
  size = 'medium',
  fullWidth = false,
}: CategoryFilterProps): React.ReactElement {
  /**
   * Handle select change event
   * Validates and processes the selection, handling special cases
   */
  const handleChange = (event: SelectChangeEvent<number[]>): void => {
    const selectedValue = event.target.value;

    // Handle the case where value is a string (shouldn't happen with proper typing, but defensive)
    const selectedIds = typeof selectedValue === 'string'
      ? selectedValue.split(',').map(Number)
      : selectedValue;

    // If "All Categories" is selected, clear other selections
    if (selectedIds.includes(CATEGORY_ALL)) {
      onChange([CATEGORY_ALL]);
      return;
    }

    // If no selection, default to "All Categories"
    if (selectedIds.length === 0) {
      onChange([CATEGORY_ALL]);
      return;
    }

    // Otherwise, pass the selected category IDs to parent
    onChange(selectedIds);
  };

  /**
   * Render selected categories as chips
   * Displays category names in a compact, readable format
   */
  const renderValue = (selectedIds: number[]): React.ReactNode => {
    // Handle "All Categories" special case
    if (selectedIds.includes(CATEGORY_ALL) || selectedIds.length === 0) {
      return (
        <Chip
          label="All Categories"
          size={size}
          sx={{ margin: 0.5 }}
        />
      );
    }

    // Map selected IDs to category names and render as chips
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {selectedIds.map((id) => {
          // Handle "Not Categorized" special case
          if (id === CATEGORY_NOT_CATEGORIZED) {
            return (
              <Chip
                key={id}
                label="Not Categorized"
                size={size}
              />
            );
          }

          // Find the category name from the categories array
          const category = categories.find((cat) => cat.id === id);
          const categoryName = category ? category.name : `Category ${id}`;

          return (
            <Chip
              key={id}
              label={categoryName}
              size={size}
            />
          );
        })}
      </Box>
    );
  };

  /**
   * Generate unique ID for accessibility
   */
  const selectId = 'glossary-category-filter';
  const labelId = `${selectId}-label`;

  return (
    <FormControl
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      sx={{ minWidth: 200 }}
    >
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select<number[]>
        labelId={labelId}
        id={selectId}
        multiple
        value={value}
        onChange={handleChange}
        label={label}
        renderValue={renderValue}
        MenuProps={{
          PaperProps: {
            sx: {
              maxHeight: 400,
            },
          },
        }}
      >
        {/* All Categories option - clears filter */}
        <MenuItem value={CATEGORY_ALL}>
          <strong>All Categories</strong>
        </MenuItem>

        {/* Not Categorized option - entries without category (ID 0) */}
        <MenuItem value={CATEGORY_NOT_CATEGORIZED}>
          Not Categorized
        </MenuItem>

        {/* Divider between special options and regular categories */}
        {categories.length > 0 && (
          <MenuItem disabled divider>
            ―――
          </MenuItem>
        )}

        {/* Regular categories sorted by name ASC (from database query) */}
        {categories.map((category) => (
          <MenuItem key={category.id} value={category.id}>
            {category.name}
            {category.entrycount !== undefined && (
              <Box
                component="span"
                sx={{
                  ml: 1,
                  color: 'text.secondary',
                  fontSize: '0.875em',
                }}
              >
                ({category.entrycount})
              </Box>
            )}
          </MenuItem>
        ))}

        {/* Empty state message */}
        {categories.length === 0 && (
          <MenuItem disabled>
            <em>No categories available</em>
          </MenuItem>
        )}
      </Select>
    </FormControl>
  );
}
