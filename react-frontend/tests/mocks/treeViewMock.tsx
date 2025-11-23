/**
 * Mock for @mui/x-tree-view components
 * 
 * The TreeView components from @mui/x-tree-view don't render properly in test environments
 * (happy-dom/jsdom) due to complex internal dependencies. This mock provides a simplified
 * version that renders the tree structure without the full MUI X functionality, allowing
 * tests to verify the component's logic and data handling.
 */

import React from 'react';

// Mock TreeView component
export const TreeView = React.forwardRef<HTMLUListElement, any>(
  ({ children, 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <ul 
        ref={ref}
        role="tree"
        aria-label={ariaLabel}
        data-testid="tree-view"
        {...props}
      >
        {children}
      </ul>
    );
  }
);

TreeView.displayName = 'TreeView';

// Mock TreeItem component
export const TreeItem = React.forwardRef<HTMLLIElement, any>(
  ({ nodeId, label, children, ...props }, ref) => {
    return (
      <li
        ref={ref}
        role="treeitem"
        data-nodeid={nodeId}
        data-testid={`tree-item-${nodeId}`}
        {...props}
      >
        <div data-testid={`tree-item-label-${nodeId}`}>
          {label}
        </div>
        {children && (
          <ul role="group">
            {children}
          </ul>
        )}
      </li>
    );
  }
);

TreeItem.displayName = 'TreeItem';
