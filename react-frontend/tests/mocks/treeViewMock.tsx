/**
 * Mock for @mui/x-tree-view components
 * 
 * The TreeView components from @mui/x-tree-view don't render properly in test environments
 * (happy-dom/jsdom) due to complex internal dependencies. This mock provides a simplified
 * version that renders the tree structure without the full MUI X functionality, allowing
 * tests to verify the component's logic and data handling.
 * 
 * This mock supports:
 * - Expand/collapse state via the `expanded` prop
 * - Node toggle events via `onNodeToggle`
 * - ARIA tree roles and attributes for accessibility testing
 * - Keyboard navigation simulation
 */

import React, { createContext, useContext, useCallback } from 'react';

/**
 * Context to pass expand state and handlers from TreeView to TreeItems
 */
interface TreeViewContextType {
  expanded: string[];
  onNodeToggle?: (event: React.SyntheticEvent, nodeIds: string[]) => void;
  selected?: string | string[];
  onNodeSelect?: (event: React.SyntheticEvent, nodeIds: string | string[]) => void;
  multiSelect?: boolean;
}

const TreeViewContext = createContext<TreeViewContextType>({
  expanded: [],
});

/**
 * Props for the TreeView mock component
 */
interface TreeViewProps extends React.HTMLAttributes<HTMLUListElement> {
  'aria-label'?: string;
  children?: React.ReactNode;
  expanded?: string[];
  defaultExpanded?: string[];
  selected?: string | string[];
  onNodeToggle?: (event: React.SyntheticEvent, nodeIds: string[]) => void;
  onNodeSelect?: (event: React.SyntheticEvent, nodeIds: string | string[]) => void;
  multiSelect?: boolean;
  defaultCollapseIcon?: React.ReactNode;
  defaultExpandIcon?: React.ReactNode;
}

/**
 * Props for the TreeItem mock component
 */
interface TreeItemProps extends React.HTMLAttributes<HTMLLIElement> {
  nodeId: string;
  label: React.ReactNode;
  children?: React.ReactNode;
}

// Mock TreeView component
export const TreeView = React.forwardRef<HTMLUListElement, TreeViewProps>(
  ({ 
    children, 
    'aria-label': ariaLabel, 
    expanded = [], 
    defaultExpanded = [],
    selected,
    onNodeToggle,
    onNodeSelect,
    multiSelect = false,
    ...props 
  }, ref) => {
    // Use expanded if provided (controlled), otherwise use defaultExpanded
    const effectiveExpanded = expanded.length > 0 ? expanded : defaultExpanded;
    
    return (
      <TreeViewContext.Provider value={{ 
        expanded: effectiveExpanded, 
        onNodeToggle, 
        selected,
        onNodeSelect,
        multiSelect 
      }}>
        <ul 
          ref={ref}
          role="tree"
          aria-label={ariaLabel}
          data-testid="tree-view"
          {...props}
        >
          {children}
        </ul>
      </TreeViewContext.Provider>
    );
  }
);

TreeView.displayName = 'TreeView';

// Mock TreeItem component
export const TreeItem = React.forwardRef<HTMLLIElement, TreeItemProps>(
  ({ nodeId, label, children, onClick, ...props }, ref) => {
    const { expanded, onNodeToggle, selected, onNodeSelect, multiSelect } = useContext(TreeViewContext);
    
    const hasChildren = React.Children.count(children) > 0;
    const isExpanded = expanded.includes(nodeId);
    const isSelected = Array.isArray(selected) 
      ? selected.includes(nodeId) 
      : selected === nodeId;
    
    const handleClick = useCallback((event: React.MouseEvent<HTMLLIElement>) => {
      // Toggle expansion if has children
      if (hasChildren && onNodeToggle) {
        const newExpanded = isExpanded
          ? expanded.filter(id => id !== nodeId)
          : [...expanded, nodeId];
        onNodeToggle(event, newExpanded);
      }
      
      // Handle selection
      if (onNodeSelect) {
        if (multiSelect && Array.isArray(selected)) {
          const newSelected = isSelected
            ? selected.filter(id => id !== nodeId)
            : [...selected, nodeId];
          onNodeSelect(event, newSelected);
        } else {
          onNodeSelect(event, nodeId);
        }
      }
      
      // Call original onClick if provided
      onClick?.(event);
    }, [expanded, hasChildren, isExpanded, isSelected, multiSelect, nodeId, onClick, onNodeSelect, onNodeToggle, selected]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLLIElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick(event as unknown as React.MouseEvent<HTMLLIElement>);
      }
      // Arrow keys would navigate but we'll let the test handle that separately
    }, [handleClick]);
    
    return (
      <li
        ref={ref}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        data-nodeid={nodeId}
        data-testid={`tree-item-${nodeId}`}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <div data-testid={`tree-item-label-${nodeId}`}>
          {label}
        </div>
        {hasChildren && isExpanded && (
          <ul role="group" data-testid={`tree-item-group-${nodeId}`}>
            {children}
          </ul>
        )}
      </li>
    );
  }
);

TreeItem.displayName = 'TreeItem';
