/**
 * Mock for @mui/x-tree-view components
 * 
 * The TreeView components from @mui/x-tree-view don't render properly in test environments
 * (happy-dom/jsdom) due to complex internal dependencies. This mock provides a simplified
 * version that renders the tree structure without the full MUI X functionality, allowing
 * tests to verify the component's logic and data handling.
 */

import React from 'react';

/**
 * Props for the TreeView mock component
 */
interface TreeViewProps extends React.HTMLAttributes<HTMLUListElement> {
  'aria-label'?: string;
  children?: React.ReactNode;
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
export const TreeItem = React.forwardRef<HTMLLIElement, TreeItemProps>(
  ({ nodeId, label, children, ...props }, ref) => {
    return (
      <li
        ref={ref}
        role="treeitem"
        aria-selected="false"
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
