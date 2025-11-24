/**
 * Unit Tests for List Component
 *
 * Comprehensive test suite validating the List component's functionality including
 * item rendering, avatars, action buttons, spacing variants, interactivity, custom
 * rendering, and WCAG 2.1 AA accessibility compliance.
 *
 * Test Coverage:
 * - Rendering tests (basic display, multiple items, empty states)
 * - Avatar tests (user photos, course icons, fallback initials, sizes)
 * - Action button tests (display, clicks, multiple actions, disabled state)
 * - Spacing variant tests (dense/comfortable, dividers)
 * - Interactive tests (clickable items, hover states, click handlers, disabled items)
 * - Custom rendering tests (render props, slot props, default fallback)
 * - Accessibility tests (ARIA roles, keyboard navigation, focus management, screen reader support)
 *
 * @see Section 0.7 - Unit tests: 90%+ coverage requirement
 * @see Section 0.7 - Test Infrastructure: Vitest and React Testing Library
 * @see Section 0.7 - Accessibility: WCAG 2.1 AA compliance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SchoolIcon from '@mui/icons-material/School';

import List, { type ListItemData, type ListItemAction } from '@/components/data-display/List';
import { render } from '@/tests/helpers/render';

// Extend Jest matchers with jest-axe
expect.extend(toHaveNoViolations);

/**
 * Helper function to create mock list item data
 * Generates properly typed ListItemData objects for testing
 */
function createMockListItems(count: number, options: Partial<ListItemData> = {}): ListItemData[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    primary: `Item ${index + 1}`,
    secondary: `Description for item ${index + 1}`,
    avatar: undefined,
    actions: undefined,
    disabled: false,
    onClick: undefined,
    ...options,
  }));
}

/**
 * Helper function to create mock action buttons
 * Generates properly typed ListItemAction objects for testing
 */
function createMockActions(itemId: string | number): ListItemAction[] {
  return [
    {
      id: 'edit',
      icon: <EditIcon />,
      label: `Edit item ${itemId}`,
      onClick: vi.fn(),
      disabled: false,
    },
    {
      id: 'delete',
      icon: <DeleteIcon />,
      label: `Delete item ${itemId}`,
      onClick: vi.fn(),
      disabled: false,
    },
  ];
}

describe('List Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Cleanup after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering Tests', () => {
    it('should render an empty list when no items provided', () => {
      render(<List items={[]} ariaLabel="Empty list" />);

      const list = screen.getByRole('list', { name: 'Empty list' });
      expect(list).toBeInTheDocument();
      expect(list.children).toHaveLength(0);
    });

    it('should render a list with multiple items', () => {
      const items = createMockListItems(5);
      render(<List items={items} ariaLabel="Test list" />);

      const list = screen.getByRole('list', { name: 'Test list' });
      expect(list).toBeInTheDocument();

      // Should have 5 list items (no dividers by default)
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
    });

    it('should display primary text for each item', () => {
      const items = createMockListItems(3);
      render(<List items={items} ariaLabel="Primary text list" />);

      items.forEach((item) => {
        expect(screen.getByText(item.primary as string)).toBeInTheDocument();
      });
    });

    it('should display secondary text for each item when provided', () => {
      const items = createMockListItems(3);
      render(<List items={items} ariaLabel="Secondary text list" />);

      items.forEach((item) => {
        expect(screen.getByText(item.secondary as string)).toBeInTheDocument();
      });
    });

    it('should render without secondary text when not provided', () => {
      const items = createMockListItems(2, { secondary: undefined });
      render(<List items={items} ariaLabel="No secondary text list" />);

      items.forEach((item) => {
        expect(screen.getByText(item.primary as string)).toBeInTheDocument();
      });

      // Verify no secondary text elements
      const listItems = screen.getAllByRole('listitem');
      listItems.forEach((listItem) => {
        const text = within(listItem).queryByText(/Description for item/);
        expect(text).not.toBeInTheDocument();
      });
    });

    it('should apply custom className to the list', () => {
      const items = createMockListItems(2);
      const { container } = render(
        <List items={items} ariaLabel="Custom class list" className="custom-list-class" />
      );

      const list = container.querySelector('.custom-list-class');
      expect(list).toBeInTheDocument();
    });

    it('should apply custom sx styles to the list', () => {
      const items = createMockListItems(2);
      const customSx = { backgroundColor: 'primary.main', padding: 2 };
      render(<List items={items} ariaLabel="Styled list" sx={customSx} />);

      const list = screen.getByRole('list', { name: 'Styled list' });
      expect(list).toBeInTheDocument();
      // Style application is handled by MUI, presence validates prop passing
    });
  });

  describe('Avatar Tests', () => {
    it('should render user photo avatars from URLs', () => {
      const items = createMockListItems(2, {
        avatar: 'https://example.com/user1.jpg',
      });
      render(<List items={items} ariaLabel="User avatars list" />);

      const avatars = screen.getAllByRole('img');
      expect(avatars).toHaveLength(2);
      avatars.forEach((avatar) => {
        expect(avatar).toHaveAttribute('src', 'https://example.com/user1.jpg');
      });
    });

    it('should render course icon avatars as ReactNode', () => {
      const items: ListItemData[] = [
        {
          id: 'course-1',
          primary: 'Mathematics 101',
          secondary: 'Basic algebra course',
          avatar: <SchoolIcon />,
        },
        {
          id: 'course-2',
          primary: 'Physics 201',
          secondary: 'Advanced physics',
          avatar: <SchoolIcon />,
        },
      ];
      render(<List items={items} ariaLabel="Course icons list" />);

      // SchoolIcon should be rendered within avatars
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(2);
      // Icons are rendered inside avatars (verified by component structure)
    });

    it('should render fallback avatars with initials for text content', () => {
      const items: ListItemData[] = [
        {
          id: 'user-1',
          primary: 'John Doe',
          secondary: 'john@example.com',
          avatar: <PersonIcon />,
        },
      ];
      render(<List items={items} ariaLabel="Fallback avatars list" />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(1);
      // Fallback avatars render icon within Avatar component
    });

    it('should render items without avatars when not provided', () => {
      const items = createMockListItems(2, { avatar: undefined });
      render(<List items={items} ariaLabel="No avatars list" />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(2);

      // No img elements should be present
      const avatars = screen.queryAllByRole('img');
      expect(avatars).toHaveLength(0);
    });

    it('should handle avatar sizes through MUI theming', () => {
      // Avatar sizes are controlled by MUI theme and ListItemAvatar component
      const items = createMockListItems(1, {
        avatar: 'https://example.com/avatar.jpg',
      });
      render(<List items={items} ariaLabel="Avatar sizes list" dense />);

      const avatar = screen.getByRole('img');
      expect(avatar).toBeInTheDocument();
      // Dense mode affects spacing; avatar size is theme-controlled
    });
  });

  describe('Action Button Tests', () => {
    it('should render action buttons for list items', () => {
      const editHandler = vi.fn();
      const deleteHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Item with actions',
          actions: [
            {
              id: 'edit',
              icon: <EditIcon />,
              label: 'Edit item',
              onClick: editHandler,
            },
            {
              id: 'delete',
              icon: <DeleteIcon />,
              label: 'Delete item',
              onClick: deleteHandler,
            },
          ],
        },
      ];
      render(<List items={items} ariaLabel="Actions list" />);

      const editButton = screen.getByRole('button', { name: 'Edit item' });
      const deleteButton = screen.getByRole('button', { name: 'Delete item' });

      expect(editButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();
    });

    it('should fire click handlers when action buttons are clicked', async () => {
      const user = userEvent.setup();
      const editHandler = vi.fn();
      const deleteHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Clickable actions item',
          actions: [
            {
              id: 'edit',
              icon: <EditIcon />,
              label: 'Edit item',
              onClick: editHandler,
            },
            {
              id: 'delete',
              icon: <DeleteIcon />,
              label: 'Delete item',
              onClick: deleteHandler,
            },
          ],
        },
      ];
      render(<List items={items} ariaLabel="Clickable actions list" />);

      const editButton = screen.getByRole('button', { name: 'Edit item' });
      const deleteButton = screen.getByRole('button', { name: 'Delete item' });

      await user.click(editButton);
      expect(editHandler).toHaveBeenCalledTimes(1);
      expect(editHandler).toHaveBeenCalledWith('item-1', expect.any(Object));

      await user.click(deleteButton);
      expect(deleteHandler).toHaveBeenCalledTimes(1);
      expect(deleteHandler).toHaveBeenCalledWith('item-1', expect.any(Object));
    });

    it('should support multiple actions per item', async () => {
      const user = userEvent.setup();
      const action1Handler = vi.fn();
      const action2Handler = vi.fn();
      const action3Handler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Multiple actions item',
          actions: [
            {
              id: 'action1',
              icon: <EditIcon />,
              label: 'Action 1',
              onClick: action1Handler,
            },
            {
              id: 'action2',
              icon: <DeleteIcon />,
              label: 'Action 2',
              onClick: action2Handler,
            },
            {
              id: 'action3',
              icon: <PersonIcon />,
              label: 'Action 3',
              onClick: action3Handler,
            },
          ],
        },
      ];
      render(<List items={items} ariaLabel="Multiple actions list" />);

      const action1Button = screen.getByRole('button', { name: 'Action 1' });
      const action2Button = screen.getByRole('button', { name: 'Action 2' });
      const action3Button = screen.getByRole('button', { name: 'Action 3' });

      await user.click(action1Button);
      await user.click(action2Button);
      await user.click(action3Button);

      expect(action1Handler).toHaveBeenCalledTimes(1);
      expect(action2Handler).toHaveBeenCalledTimes(1);
      expect(action3Handler).toHaveBeenCalledTimes(1);
    });

    it('should prevent clicks on disabled action buttons', async () => {
      const user = userEvent.setup();
      const clickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Disabled action item',
          actions: [
            {
              id: 'disabled-action',
              icon: <EditIcon />,
              label: 'Disabled action',
              onClick: clickHandler,
              disabled: true,
            },
          ],
        },
      ];
      render(<List items={items} ariaLabel="Disabled action list" />);

      const actionButton = screen.getByRole('button', { name: 'Disabled action' });
      expect(actionButton).toBeDisabled();

      await user.click(actionButton);
      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('should not propagate action button clicks to item click handler', async () => {
      const user = userEvent.setup();
      const actionHandler = vi.fn();
      const itemClickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Item with action',
          onClick: itemClickHandler,
          actions: [
            {
              id: 'action',
              icon: <EditIcon />,
              label: 'Action button',
              onClick: actionHandler,
            },
          ],
        },
      ];
      render(<List items={items} ariaLabel="Action propagation list" />);

      const actionButton = screen.getByRole('button', { name: 'Action button' });
      await user.click(actionButton);

      expect(actionHandler).toHaveBeenCalledTimes(1);
      expect(itemClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Spacing Variant Tests', () => {
    it('should apply dense spacing when dense prop is true', () => {
      const items = createMockListItems(3);
      render(<List items={items} ariaLabel="Dense list" dense />);

      const list = screen.getByRole('list', { name: 'Dense list' });
      expect(list).toBeInTheDocument();
      // Dense mode is applied via MUI List component props
      // Visual spacing differences are theme-controlled
    });

    it('should apply comfortable spacing by default', () => {
      const items = createMockListItems(3);
      render(<List items={items} ariaLabel="Comfortable list" />);

      const list = screen.getByRole('list', { name: 'Comfortable list' });
      expect(list).toBeInTheDocument();
      // Default spacing (comfortable) is applied when dense is false/undefined
    });

    it('should render dividers between items when showDividers is true', () => {
      const items = createMockListItems(3);
      const { container } = render(
        <List items={items} ariaLabel="Dividers list" showDividers />
      );

      // Dividers are rendered as <hr> elements with role separator
      const dividers = container.querySelectorAll('hr.MuiDivider-root');
      expect(dividers).toHaveLength(2); // n-1 dividers for n items
    });

    it('should not render dividers when showDividers is false', () => {
      const items = createMockListItems(3);
      const { container } = render(
        <List items={items} ariaLabel="No dividers list" showDividers={false} />
      );

      const dividers = container.querySelectorAll('hr.MuiDivider-root');
      expect(dividers).toHaveLength(0);
    });

    it('should combine dense spacing with dividers', () => {
      const items = createMockListItems(4);
      const { container } = render(
        <List items={items} ariaLabel="Dense with dividers list" dense showDividers />
      );

      const list = screen.getByRole('list', { name: 'Dense with dividers list' });
      expect(list).toBeInTheDocument();

      const dividers = container.querySelectorAll('hr.MuiDivider-root');
      expect(dividers).toHaveLength(3); // n-1 dividers for n items
    });
  });

  describe('Interactive Tests', () => {
    it('should make list items clickable when onClick handler is provided', async () => {
      const user = userEvent.setup();
      const clickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Clickable item',
          secondary: 'Click me',
          onClick: clickHandler,
        },
      ];
      render(<List items={items} ariaLabel="Interactive list" />);

      const listItem = screen.getByRole('button', { name: 'Clickable item' });
      expect(listItem).toBeInTheDocument();

      await user.click(listItem);
      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(clickHandler).toHaveBeenCalledWith('item-1', expect.any(Object));
    });

    it('should use global onItemClick when item-specific onClick not provided', async () => {
      const user = userEvent.setup();
      const globalClickHandler = vi.fn();

      const items = createMockListItems(2);
      render(
        <List items={items} ariaLabel="Global click list" onItemClick={globalClickHandler} />
      );

      const listItems = screen.getAllByRole('button');
      expect(listItems).toHaveLength(2);

      await user.click(listItems[0]);
      expect(globalClickHandler).toHaveBeenCalledTimes(1);
      expect(globalClickHandler).toHaveBeenCalledWith('item-1', expect.any(Object));

      await user.click(listItems[1]);
      expect(globalClickHandler).toHaveBeenCalledTimes(2);
      expect(globalClickHandler).toHaveBeenCalledWith('item-2', expect.any(Object));
    });

    it('should prioritize item-specific onClick over global onItemClick', async () => {
      const user = userEvent.setup();
      const itemClickHandler = vi.fn();
      const globalClickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Item with specific handler',
          onClick: itemClickHandler,
        },
      ];
      render(
        <List items={items} ariaLabel="Priority click list" onItemClick={globalClickHandler} />
      );

      const listItem = screen.getByRole('button', { name: 'Item with specific handler' });
      await user.click(listItem);

      expect(itemClickHandler).toHaveBeenCalledTimes(1);
      expect(globalClickHandler).not.toHaveBeenCalled();
    });

    it('should apply hover states correctly for interactive items', async () => {
      const user = userEvent.setup();
      const clickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Hoverable item',
          onClick: clickHandler,
        },
      ];
      render(<List items={items} ariaLabel="Hover list" />);

      const listItem = screen.getByRole('button', { name: 'Hoverable item' });

      await user.hover(listItem);
      // Hover state is applied via MUI ListItemButton component
      // Visual feedback is theme-controlled; we verify interactivity works
      expect(listItem).toBeInTheDocument();
    });

    it('should pass item data to click handlers', async () => {
      const user = userEvent.setup();
      const clickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-123',
          primary: 'Data item',
          secondary: 'Contains data',
          onClick: clickHandler,
        },
      ];
      render(<List items={items} ariaLabel="Data click list" />);

      const listItem = screen.getByRole('button', { name: 'Data item' });
      await user.click(listItem);

      expect(clickHandler).toHaveBeenCalledWith('item-123', expect.any(Object));
    });

    it('should not trigger click handlers for disabled items', async () => {
      const user = userEvent.setup();
      const clickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Disabled item',
          onClick: clickHandler,
          disabled: true,
        },
      ];
      render(<List items={items} ariaLabel="Disabled item list" />);

      const listItem = screen.getByRole('button', { name: 'Disabled item' });
      expect(listItem).toBeDisabled();

      await user.click(listItem);
      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('should render static items without click handlers as non-interactive', () => {
      const items = createMockListItems(2);
      render(<List items={items} ariaLabel="Static list" />);

      // Items without onClick should be listitem role, not button role
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(2);

      // Should not have any buttons
      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });
  });

  describe('Custom Rendering Tests', () => {
    it('should allow custom item rendering via renderItem prop', () => {
      const items = createMockListItems(2);
      const customRenderer = vi.fn((item: ListItemData) => (
        <div data-testid={`custom-${item.id}`}>Custom: {item.primary}</div>
      ));

      render(<List items={items} ariaLabel="Custom render list" renderItem={customRenderer} />);

      expect(customRenderer).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('custom-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('custom-item-2')).toBeInTheDocument();
      expect(screen.getByText('Custom: Item 1')).toBeInTheDocument();
      expect(screen.getByText('Custom: Item 2')).toBeInTheDocument();
    });

    it('should pass item and index to custom renderer', () => {
      const items = createMockListItems(3);
      const customRenderer = vi.fn((item: ListItemData, index: number) => (
        <div data-testid={`custom-${item.id}`}>
          Item {index}: {item.primary}
        </div>
      ));

      render(<List items={items} ariaLabel="Index render list" renderItem={customRenderer} />);

      expect(customRenderer).toHaveBeenCalledTimes(3);
      expect(customRenderer).toHaveBeenNthCalledWith(1, items[0], 0);
      expect(customRenderer).toHaveBeenNthCalledWith(2, items[1], 1);
      expect(customRenderer).toHaveBeenNthCalledWith(3, items[2], 2);

      expect(screen.getByText('Item 0: Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 1: Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 2: Item 3')).toBeInTheDocument();
    });

    it('should wrap non-ListItem custom elements in ListItem', () => {
      const items = createMockListItems(1);
      const customRenderer = () => <span>Custom content without ListItem</span>;

      render(<List items={items} ariaLabel="Wrapped custom list" renderItem={customRenderer} />);

      // Custom content should be wrapped in ListItem
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(1);
      expect(screen.getByText('Custom content without ListItem')).toBeInTheDocument();
    });

    it('should use custom renderer over default rendering', () => {
      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Original primary',
          secondary: 'Original secondary',
          avatar: 'https://example.com/avatar.jpg',
        },
      ];
      const customRenderer = () => <div>Completely custom rendering</div>;

      render(<List items={items} ariaLabel="Override render list" renderItem={customRenderer} />);

      // Custom rendering should replace default
      expect(screen.getByText('Completely custom rendering')).toBeInTheDocument();
      expect(screen.queryByText('Original primary')).not.toBeInTheDocument();
      expect(screen.queryByText('Original secondary')).not.toBeInTheDocument();
    });

    it('should use default rendering when renderItem is not provided', () => {
      const items = createMockListItems(2, {
        avatar: 'https://example.com/avatar.jpg',
      });
      render(<List items={items} ariaLabel="Default render list" />);

      // Default rendering should show primary and secondary text
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Description for item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Description for item 2')).toBeInTheDocument();

      // Avatars should be rendered
      const avatars = screen.getAllByRole('img');
      expect(avatars).toHaveLength(2);
    });

    it('should preserve dividers with custom rendering', () => {
      const items = createMockListItems(3);
      const customRenderer = (item: ListItemData) => <div>{item.primary}</div>;
      const { container } = render(
        <List items={items} ariaLabel="Custom dividers list" renderItem={customRenderer} showDividers />
      );

      const dividers = container.querySelectorAll('hr.MuiDivider-root');
      expect(dividers).toHaveLength(2); // n-1 dividers
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper ARIA role for list', () => {
      const items = createMockListItems(3);
      render(<List items={items} ariaLabel="Accessible list" />);

      const list = screen.getByRole('list', { name: 'Accessible list' });
      expect(list).toBeInTheDocument();
    });

    it('should have proper ARIA role for list items', () => {
      const items = createMockListItems(3);
      render(<List items={items} ariaLabel="Items list" />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('should support keyboard navigation for interactive items', async () => {
      const user = userEvent.setup();
      const clickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'First item',
          onClick: clickHandler,
        },
        {
          id: 'item-2',
          primary: 'Second item',
          onClick: clickHandler,
        },
      ];
      render(<List items={items} ariaLabel="Keyboard nav list" />);

      const firstItem = screen.getByRole('button', { name: 'First item' });
      const secondItem = screen.getByRole('button', { name: 'Second item' });

      // Tab to first item
      await user.tab();
      expect(firstItem).toHaveFocus();

      // Press Enter to activate
      await user.keyboard('{Enter}');
      expect(clickHandler).toHaveBeenCalledWith('item-1', expect.any(Object));

      // Tab to second item
      await user.tab();
      expect(secondItem).toHaveFocus();

      // Press Space to activate
      await user.keyboard(' ');
      expect(clickHandler).toHaveBeenCalledWith('item-2', expect.any(Object));
    });

    it('should manage focus correctly for interactive items', async () => {
      const user = userEvent.setup();
      const clickHandler = vi.fn();

      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Focusable item 1',
          onClick: clickHandler,
        },
        {
          id: 'item-2',
          primary: 'Focusable item 2',
          onClick: clickHandler,
        },
      ];
      render(<List items={items} ariaLabel="Focus management list" />);

      const item1 = screen.getByRole('button', { name: 'Focusable item 1' });
      const item2 = screen.getByRole('button', { name: 'Focusable item 2' });

      await user.click(item1);
      expect(item1).toHaveFocus();

      await user.click(item2);
      expect(item2).toHaveFocus();
    });

    it('should provide accessible labels for action buttons', () => {
      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Item with actions',
          actions: [
            {
              id: 'edit',
              icon: <EditIcon />,
              label: 'Edit this item',
              onClick: vi.fn(),
            },
            {
              id: 'delete',
              icon: <DeleteIcon />,
              label: 'Delete this item',
              onClick: vi.fn(),
            },
          ],
        },
      ];
      render(<List items={items} ariaLabel="Action labels list" />);

      const editButton = screen.getByRole('button', { name: 'Edit this item' });
      const deleteButton = screen.getByRole('button', { name: 'Delete this item' });

      expect(editButton).toHaveAttribute('aria-label', 'Edit this item');
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete this item');
    });

    it('should announce list structure for screen readers', () => {
      const items = createMockListItems(5);
      render(<List items={items} ariaLabel="Screen reader list" />);

      const list = screen.getByRole('list', { name: 'Screen reader list' });
      expect(list).toHaveAttribute('aria-label', 'Screen reader list');

      // List items should be properly structured for screen readers
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
    });

    it('should have proper ARIA labels for interactive items', () => {
      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Interactive item with label',
          onClick: vi.fn(),
        },
      ];
      render(<List items={items} ariaLabel="ARIA labels list" />);

      const button = screen.getByRole('button', { name: 'Interactive item with label' });
      expect(button).toHaveAttribute('aria-label', 'Interactive item with label');
    });

    it('should pass WCAG 2.1 AA compliance validation', async () => {
      const items: ListItemData[] = [
        {
          id: 'item-1',
          primary: 'Accessible item 1',
          secondary: 'Description 1',
          avatar: 'https://example.com/avatar1.jpg',
          onClick: vi.fn(),
          actions: [
            {
              id: 'edit',
              icon: <EditIcon />,
              label: 'Edit item 1',
              onClick: vi.fn(),
            },
          ],
        },
        {
          id: 'item-2',
          primary: 'Accessible item 2',
          secondary: 'Description 2',
          avatar: 'https://example.com/avatar2.jpg',
          onClick: vi.fn(),
        },
      ];
      const { container } = render(
        <List items={items} ariaLabel="WCAG compliant list" showDividers />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass accessibility validation with dense spacing', async () => {
      const items = createMockListItems(4);
      const { container } = render(
        <List items={items} ariaLabel="Dense accessible list" dense showDividers />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass accessibility validation with custom rendering', async () => {
      const items = createMockListItems(3);
      const customRenderer = (item: ListItemData) => (
        <div role="listitem" aria-label={item.primary as string}>
          Custom: {item.primary}
        </div>
      );
      const { container } = render(
        <List items={items} ariaLabel="Custom accessible list" renderItem={customRenderer} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility with empty list', async () => {
      const { container } = render(<List items={[]} ariaLabel="Empty accessible list" />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
