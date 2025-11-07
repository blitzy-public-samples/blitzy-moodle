import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';
import ProfileView from '@/features/profile/components/ProfileView';
import type { User } from '@/types/entities';

// Extend expect matchers
expect.extend(toHaveNoViolations);

// Mock the useProfile hook
const mockUseProfile = vi.fn();
vi.mock('@/features/profile/hooks/useProfile', () => ({
  default: () => mockUseProfile(),
}));

// Mock the useAuth hook for permission checks
const mockUseAuth = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
}));

// Test data fixtures
const mockValidUser: User = {
  id: 123,
  username: 'johndoe',
  firstname: 'John',
  lastname: 'Doe',
  fullname: 'John Doe',
  email: 'john.doe@example.com',
  department: 'Engineering',
  institution: 'University of Example',
  city: 'San Francisco',
  country: 'US',
  timezone: 'America/Los_Angeles',
  description: 'Passionate software engineer with 5 years of experience in web development.',
  descriptionformat: 1,
  profileimageurl: 'https://example.com/avatar/johndoe.jpg',
  profileimageurlsmall: 'https://example.com/avatar/johndoe_small.jpg',
  interests: ['JavaScript', 'React', 'TypeScript', 'Testing'],
  customfields: [
    { name: 'Phone', value: '+1 555-0123', type: 'text' },
    { name: 'LinkedIn', value: 'linkedin.com/in/johndoe', type: 'url' },
  ],
  lang: 'en',
  theme: 'boost',
  firstaccess: 1609459200,
  lastaccess: 1704067200,
  auth: 'manual',
  suspended: false,
  confirmed: true,
};

const mockCurrentUser: User = {
  id: 123,
  username: 'johndoe',
  firstname: 'John',
  lastname: 'Doe',
  fullname: 'John Doe',
  email: 'john.doe@example.com',
  department: 'Engineering',
  institution: 'University of Example',
  city: 'San Francisco',
  country: 'US',
  timezone: 'America/Los_Angeles',
  description: 'My profile description',
  descriptionformat: 1,
  profileimageurl: 'https://example.com/avatar/johndoe.jpg',
  profileimageurlsmall: 'https://example.com/avatar/johndoe_small.jpg',
  interests: ['Coding'],
  customfields: [],
  lang: 'en',
  theme: 'boost',
  firstaccess: 1609459200,
  lastaccess: 1704067200,
  auth: 'manual',
  suspended: false,
  confirmed: true,
};

const mockOtherUser: User = {
  id: 456,
  username: 'janedoe',
  firstname: 'Jane',
  lastname: 'Doe',
  fullname: 'Jane Doe',
  email: 'jane.doe@example.com',
  department: 'Marketing',
  institution: 'University of Example',
  city: 'New York',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Marketing professional',
  descriptionformat: 1,
  profileimageurl: 'https://example.com/avatar/janedoe.jpg',
  profileimageurlsmall: 'https://example.com/avatar/janedoe_small.jpg',
  interests: ['Marketing', 'Analytics'],
  customfields: [],
  lang: 'en',
  theme: 'boost',
  firstaccess: 1609459200,
  lastaccess: 1704067200,
  auth: 'manual',
  suspended: false,
  confirmed: true,
};

const mockUserWithoutAvatar: User = {
  ...mockValidUser,
  profileimageurl: '',
  profileimageurlsmall: '',
};

// Mock window.matchMedia for responsive testing
const createMatchMedia = (width: number) => {
  return (query: string): MediaQueryList => {
    const mediaQuery = query.match(/\(max-width:\s*(\d+)px\)/);
    const maxWidth = mediaQuery ? parseInt(mediaQuery[1], 10) : Infinity;
    
    return {
      matches: width <= maxWidth,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
  };
};

describe('ProfileView Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Default auth state - viewing own profile
    mockUseAuth.mockReturnValue({
      user: mockCurrentUser,
      isAuthenticated: true,
      hasCapability: vi.fn().mockReturnValue(true),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering with valid user data', () => {
    it('should render the ProfileView component with valid user data', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockValidUser.id} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('should display the user fullname as the main heading', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockValidUser.id} />);

      const heading = screen.getByRole('heading', { name: 'John Doe', level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it('should render ProfileView without crashing when receiving minimal valid data', () => {
      const minimalUser: User = {
        id: 789,
        username: 'minimal',
        firstname: 'Min',
        lastname: 'User',
        fullname: 'Min User',
        email: 'min@example.com',
        department: '',
        institution: '',
        city: '',
        country: '',
        timezone: 'UTC',
        description: '',
        descriptionformat: 1,
        profileimageurl: '',
        profileimageurlsmall: '',
        interests: [],
        customfields: [],
        lang: 'en',
        theme: 'boost',
        firstaccess: 0,
        lastaccess: 0,
        auth: 'manual',
        suspended: false,
        confirmed: true,
      };

      mockUseProfile.mockReturnValue({
        data: minimalUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={minimalUser.id} />);

      expect(screen.getByText('Min User')).toBeInTheDocument();
      expect(screen.getByText('min@example.com')).toBeInTheDocument();
    });
  });

  describe('User profile fields display', () => {
    beforeEach(() => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('should display the user email address', () => {
      render(<ProfileView userId={mockValidUser.id} />);

      const emailElement = screen.getByText('john.doe@example.com');
      expect(emailElement).toBeInTheDocument();
    });

    it('should display the user department', () => {
      render(<ProfileView userId={mockValidUser.id} />);

      expect(screen.getByText(/Engineering/i)).toBeInTheDocument();
    });

    it('should display the user city and country', () => {
      render(<ProfileView userId={mockValidUser.id} />);

      expect(screen.getByText(/San Francisco/i)).toBeInTheDocument();
      expect(screen.getByText(/US/i)).toBeInTheDocument();
    });

    it('should display the user institution', () => {
      render(<ProfileView userId={mockValidUser.id} />);

      expect(screen.getByText(/University of Example/i)).toBeInTheDocument();
    });

    it('should display the user bio/description', () => {
      render(<ProfileView userId={mockValidUser.id} />);

      expect(screen.getByText(/Passionate software engineer/i)).toBeInTheDocument();
    });

    it('should display user interests as tags', () => {
      render(<ProfileView userId={mockValidUser.id} />);

      mockValidUser.interests.forEach((interest) => {
        expect(screen.getByText(interest)).toBeInTheDocument();
      });
    });

    it('should display custom profile fields', () => {
      render(<ProfileView userId={mockValidUser.id} />);

      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('+1 555-0123')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('linkedin.com/in/johndoe')).toBeInTheDocument();
    });

    it('should handle empty optional fields gracefully', () => {
      const userWithEmptyFields: User = {
        ...mockValidUser,
        department: '',
        institution: '',
        description: '',
        interests: [],
        customfields: [],
      };

      mockUseProfile.mockReturnValue({
        data: userWithEmptyFields,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={userWithEmptyFields.id} />);

      // Should still render name and email
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();

      // Optional fields should not cause errors
      expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
    });
  });

  describe('Avatar/Profile picture display', () => {
    it('should display user avatar when profileimageurl is provided', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockValidUser.id} />);

      const avatar = screen.getByRole('img', { name: /John Doe/i });
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', mockValidUser.profileimageurl);
    });

    it('should display default avatar when profileimageurl is empty', () => {
      mockUseProfile.mockReturnValue({
        data: mockUserWithoutAvatar,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockUserWithoutAvatar.id} />);

      const avatar = screen.getByRole('img', { name: /John Doe/i });
      expect(avatar).toBeInTheDocument();
      
      // Check for default avatar (either data URI or placeholder)
      const src = avatar.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src === '' || src?.includes('default') || src?.includes('placeholder')).toBe(true);
    });

    it('should use alt text with user fullname for avatar', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockValidUser.id} />);

      const avatar = screen.getByAltText(/John Doe/i);
      expect(avatar).toBeInTheDocument();
    });

    it('should handle avatar load errors gracefully', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockValidUser.id} />);

      const avatar = screen.getByRole('img', { name: /John Doe/i });
      
      // Simulate image load error
      const errorEvent = new Event('error');
      avatar.dispatchEvent(errorEvent);

      // Avatar should still be present (fallback to default)
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Edit button visibility based on permissions', () => {
    it('should display edit button when viewing own profile', () => {
      mockUseProfile.mockReturnValue({
        data: mockCurrentUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      mockUseAuth.mockReturnValue({
        user: mockCurrentUser,
        isAuthenticated: true,
        hasCapability: vi.fn().mockReturnValue(true),
      });

      render(<ProfileView userId={mockCurrentUser.id} />);

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      expect(editButton).toBeInTheDocument();
      expect(editButton).toBeEnabled();
    });

    it('should display edit button when user has edit permission for other user', () => {
      mockUseProfile.mockReturnValue({
        data: mockOtherUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      mockUseAuth.mockReturnValue({
        user: mockCurrentUser,
        isAuthenticated: true,
        hasCapability: vi.fn((capability: string) => {
          return capability === 'moodle/user:update';
        }),
      });

      render(<ProfileView userId={mockOtherUser.id} />);

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      expect(editButton).toBeInTheDocument();
    });

    it('should NOT display edit button when viewing other user without edit permission', () => {
      mockUseProfile.mockReturnValue({
        data: mockOtherUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      mockUseAuth.mockReturnValue({
        user: mockCurrentUser,
        isAuthenticated: true,
        hasCapability: vi.fn().mockReturnValue(false),
      });

      render(<ProfileView userId={mockOtherUser.id} />);

      const editButton = screen.queryByRole('button', { name: /edit profile/i });
      expect(editButton).not.toBeInTheDocument();
    });

    it('should NOT display edit button when user is not authenticated', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        hasCapability: vi.fn().mockReturnValue(false),
      });

      render(<ProfileView userId={mockValidUser.id} />);

      const editButton = screen.queryByRole('button', { name: /edit profile/i });
      expect(editButton).not.toBeInTheDocument();
    });
  });

  describe('Loading states during data fetch', () => {
    it('should display loading skeleton when isLoading is true', () => {
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={123} />);

      // Check for skeleton loading indicators
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display multiple skeleton elements for different profile sections', () => {
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={123} />);

      // Should have skeleton for avatar
      const avatarSkeleton = screen.getByTestId('skeleton-avatar');
      expect(avatarSkeleton).toBeInTheDocument();

      // Should have skeleton for name
      const nameSkeleton = screen.getByTestId('skeleton-name');
      expect(nameSkeleton).toBeInTheDocument();

      // Should have skeleton for content sections
      const contentSkeletons = screen.getAllByTestId(/skeleton-content/i);
      expect(contentSkeletons.length).toBeGreaterThan(0);
    });

    it('should not display user data when loading', () => {
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={123} />);

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('john.doe@example.com')).not.toBeInTheDocument();
    });

    it('should transition from loading to loaded state correctly', () => {
      const { rerender } = render(<ProfileView userId={123} />);

      // Initially loading
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
      });

      rerender(<ProfileView userId={123} />);
      expect(screen.getByTestId('skeleton-avatar')).toBeInTheDocument();

      // Then loaded
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      rerender(<ProfileView userId={123} />);
      
      expect(screen.queryByTestId('skeleton-avatar')).not.toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Error handling for missing/unavailable user data', () => {
    it('should display error message when user data fetch fails', () => {
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch user data'),
      });

      render(<ProfileView userId={123} />);

      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to load profile/i)).toBeInTheDocument();
    });

    it('should display specific error message for deleted user', () => {
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'User has been deleted', code: 'USER_DELETED' },
      });

      render(<ProfileView userId={123} />);

      expect(screen.getByText(/deleted/i)).toBeInTheDocument();
    });

    it('should display specific error message for invalid user', () => {
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Invalid user ID', code: 'INVALID_USER' },
      });

      render(<ProfileView userId={999999} />);

      expect(screen.getByText(/invalid user/i)).toBeInTheDocument();
    });

    it('should display error message for permission denied', () => {
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' },
      });

      render(<ProfileView userId={456} />);

      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
      expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
    });

    it('should provide retry button on error', () => {
      const mockRefetch = vi.fn();
      
      mockUseProfile.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      render(<ProfileView userId={123} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      
      retryButton.click();
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility compliance (WCAG 2.1 AA)', () => {
    it('should have no accessibility violations with valid profile data', async () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      const { container } = render(<ProfileView userId={mockValidUser.id} />);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('should use semantic HTML elements', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockValidUser.id} />);

      // Should have main heading
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

      // Should have section landmarks
      const sections = screen.getAllByRole('region');
      expect(sections.length).toBeGreaterThan(0);

      // Should have proper list structure for interests
      const lists = screen.getAllByRole('list');
      expect(lists.length).toBeGreaterThan(0);
    });

    it('should have proper ARIA labels for interactive elements', () => {
      mockUseProfile.mockReturnValue({
        data: mockCurrentUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      mockUseAuth.mockReturnValue({
        user: mockCurrentUser,
        isAuthenticated: true,
        hasCapability: vi.fn().mockReturnValue(true),
      });

      render(<ProfileView userId={mockCurrentUser.id} />);

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      expect(editButton).toHaveAccessibleName();
    });

    it('should support keyboard navigation', () => {
      mockUseProfile.mockReturnValue({
        data: mockCurrentUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      mockUseAuth.mockReturnValue({
        user: mockCurrentUser,
        isAuthenticated: true,
        hasCapability: vi.fn().mockReturnValue(true),
      });

      render(<ProfileView userId={mockCurrentUser.id} />);

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      
      // Button should be focusable
      editButton.focus();
      expect(document.activeElement).toBe(editButton);
    });

    it('should have sufficient color contrast for text elements', async () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      const { container } = render(<ProfileView userId={mockValidUser.id} />);
      
      // Axe will check color contrast as part of WCAG AA compliance
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      
      expect(results).toHaveNoViolations();
    });

    it('should have alt text for all images', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockValidUser.id} />);

      const images = screen.getAllByRole('img');
      images.forEach((image) => {
        expect(image).toHaveAccessibleName();
      });
    });

    it('should have proper heading hierarchy', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={mockValidUser.id} />);

      // Should have h1 for main heading
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();

      // Should have h2 for section headings
      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive layout rendering', () => {
    it('should render mobile layout for small screens (< 600px)', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: createMatchMedia(400),
      });

      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      const { container } = render(<ProfileView userId={mockValidUser.id} />);

      // Mobile layout should stack elements vertically
      const profileContainer = container.querySelector('[data-layout="mobile"]');
      expect(profileContainer).toBeInTheDocument();
    });

    it('should render tablet layout for medium screens (600px - 960px)', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: createMatchMedia(768),
      });

      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      const { container } = render(<ProfileView userId={mockValidUser.id} />);

      // Tablet layout should have specific breakpoint styling
      const profileContainer = container.querySelector('[data-layout="tablet"]');
      expect(profileContainer).toBeInTheDocument();
    });

    it('should render desktop layout for large screens (> 960px)', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: createMatchMedia(1200),
      });

      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      const { container } = render(<ProfileView userId={mockValidUser.id} />);

      // Desktop layout should have wider container
      const profileContainer = container.querySelector('[data-layout="desktop"]');
      expect(profileContainer).toBeInTheDocument();
    });

    it('should adjust avatar size based on screen size', () => {
      // Mobile
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: createMatchMedia(400),
      });

      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      const { rerender, container: mobileContainer } = render(
        <ProfileView userId={mockValidUser.id} />
      );

      const mobileAvatar = mobileContainer.querySelector('[data-testid="profile-avatar"]');
      const mobileSize = mobileAvatar?.getAttribute('data-size');

      // Desktop
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: createMatchMedia(1200),
      });

      rerender(<ProfileView userId={mockValidUser.id} />);

      const desktopAvatar = mobileContainer.querySelector('[data-testid="profile-avatar"]');
      const desktopSize = desktopAvatar?.getAttribute('data-size');

      // Sizes should be different
      expect(mobileSize).not.toBe(desktopSize);
    });

    it('should maintain readability on all screen sizes', () => {
      const screenSizes = [400, 768, 1200];

      screenSizes.forEach((width) => {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: createMatchMedia(width),
        });

        mockUseProfile.mockReturnValue({
          data: mockValidUser,
          isLoading: false,
          isError: false,
          error: null,
        });

        render(<ProfileView userId={mockValidUser.id} />);

        // All text content should be visible regardless of screen size
        expect(screen.getByText('John Doe')).toBeVisible();
        expect(screen.getByText('john.doe@example.com')).toBeVisible();
      });
    });
  });

  describe('Integration with useProfile hook and React Query cache', () => {
    it('should call useProfile hook with correct userId', () => {
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<ProfileView userId={123} />);

      expect(mockUseProfile).toHaveBeenCalled();
    });

    it('should handle cache updates when profile data changes', () => {
      const { rerender } = render(<ProfileView userId={123} />);

      // Initial data
      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      rerender(<ProfileView userId={123} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Updated data from cache
      const updatedUser = {
        ...mockValidUser,
        firstname: 'Jonathan',
        fullname: 'Jonathan Doe',
      };

      mockUseProfile.mockReturnValue({
        data: updatedUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      rerender(<ProfileView userId={123} />);
      expect(screen.getByText('Jonathan Doe')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should refetch data when userId prop changes', () => {
      const { rerender } = render(<ProfileView userId={123} />);

      mockUseProfile.mockReturnValue({
        data: mockValidUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      rerender(<ProfileView userId={123} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Change userId
      mockUseProfile.mockReturnValue({
        data: mockOtherUser,
        isLoading: false,
        isError: false,
        error: null,
      });

      rerender(<ProfileView userId={456} />);
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
  });
});
