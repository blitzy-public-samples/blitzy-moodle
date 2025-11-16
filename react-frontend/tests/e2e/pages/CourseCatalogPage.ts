/**
 * Page Object Model for Course Catalog Page
 * 
 * Encapsulates selectors and interactions for the course catalog interface,
 * including search, filtering, sorting, pagination, and view controls.
 * 
 * @module CourseCatalogPage
 */

import type { Page, Locator } from '@playwright/test';

/**
 * Interface representing course card data extracted from the catalog
 */
export interface CourseCardData {
  courseId: string;
  title: string;
  instructor: string;
  category: string;
  enrollmentCount: number;
  imageUrl?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
  rating?: number;
  reviewCount?: number;
  price?: string | null;
}

/**
 * Interface for catalog filter options
 */
export interface CatalogFilters {
  category?: string;
  instructor?: string;
  startDate?: string;
  endDate?: string;
  minEnrollment?: number;
  maxEnrollment?: number;
  rating?: number;
  price?: 'free' | 'paid' | 'all';
  selfPaced?: boolean;
  withCertificate?: boolean;
}

/**
 * Interface for breadcrumb navigation items
 */
export interface Breadcrumb {
  label: string;
  href: string;
  isActive: boolean;
}

/**
 * Page Object Model for the Course Catalog page
 * 
 * Provides methods to interact with the course catalog interface including
 * search, filtering, sorting, pagination, and view controls.
 */
export class CourseCatalogPage {
  private readonly page: Page;
  private readonly searchInput: Locator;
  private readonly courseCards: Locator;
  private readonly filterPanel: Locator;
  private readonly sortDropdown: Locator;
  private readonly categoryNav: Locator;
  private readonly paginationControls: Locator;
  private readonly viewToggle: Locator;
  private readonly coursesPerPageSelect: Locator;

  /**
   * Creates a new CourseCatalogPage instance
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize all locators using data-testid for reliability
    // For MUI TextField, we need to target the actual input element inside the wrapper
    this.searchInput = page.locator('[data-testid="course-search-input"] input');
    this.courseCards = page.locator('[data-testid="course-card"]');
    this.filterPanel = page.locator('[data-testid="filter-panel"]');
    this.sortDropdown = page.locator('[data-testid="sort-dropdown"]');
    this.categoryNav = page.locator('[data-testid="category-navigation"]');
    this.paginationControls = page.locator('[data-testid="pagination-controls"]');
    this.viewToggle = page.locator('[data-testid="view-toggle"]');
    // For MUI Select, target the actual select/button element inside the wrapper
    this.coursesPerPageSelect = page.locator('[data-testid="courses-per-page-select"]');
  }

  /**
   * Waits for the course catalog to fully load
   * Ensures the catalog page is ready for interaction
   */
  async waitForCatalog(): Promise<void> {
    // Wait for the main catalog container to be visible
    await this.page.waitForSelector('[data-testid="course-catalog-container"]', {
      state: 'visible',
      timeout: 10000
    });

    // Wait for at least one course card or empty state message
    await Promise.race([
      this.courseCards.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
      this.page.locator('[data-testid="empty-state-message"]').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
    ]);

    // Give a short delay for any animations to complete (removed networkidle wait for better performance)
    await this.page.waitForTimeout(100);
  }

  /**
   * Searches for courses using the search input
   * @param query - Search query string
   */
  async searchCourses(query: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible' });
    await this.searchInput.clear();
    await this.searchInput.fill(query);
    
    // Trigger search by pressing Enter or clicking search button
    const searchButton = this.page.locator('[data-testid="search-button"]');
    const searchButtonVisible = await searchButton.isVisible().catch(() => false);
    
    if (searchButtonVisible) {
      await searchButton.click();
    } else {
      await this.searchInput.press('Enter');
    }
    
    // Wait for search results to load
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(500); // Brief pause for UI updates
  }

  /**
   * Extracts data from all visible course cards
   * @returns Array of course card data objects
   */
  async getCourseCards(): Promise<CourseCardData[]> {
    await this.courseCards.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    const cardCount = await this.courseCards.count();
    const courseData: CourseCardData[] = [];

    // Process all cards in parallel for better performance
    const cardPromises = [];
    for (let i = 0; i < cardCount; i++) {
      cardPromises.push(this.extractCardData(this.courseCards.nth(i), i));
    }
    
    const results = await Promise.all(cardPromises);
    courseData.push(...results.filter((data): data is CourseCardData => data !== null));

    return courseData;
  }

  /**
   * Extracts data from a single course card
   * @param card The course card locator
   * @param index Card index for error reporting
   * @returns Course card data or null if extraction fails
   */
  private async extractCardData(card: Locator, index: number): Promise<CourseCardData | null> {
    try {
      // Use Promise.all to fetch all data in parallel for speed
      const [
        courseId,
        title,
        instructor,
        category,
        enrollmentText,
        imageUrl,
        description,
        startDate,
        endDate
      ] = await Promise.all([
        card.getAttribute('data-course-id').catch(() => ''), // Read from card's data-course-id attribute, not inner text
        card.locator('[data-testid="course-title"]').textContent().catch(() => ''),
        card.locator('[data-testid="course-instructor"]').textContent().catch(() => ''),
        card.locator('[data-testid="course-category"]').textContent().catch(() => ''),
        card.locator('[data-testid="course-enrollment"]').textContent().catch(() => '0'),
        card.locator('[data-testid="course-image"]').getAttribute('src').catch(() => null),
        card.locator('[data-testid="course-description"]').textContent().catch(() => null),
        card.locator('[data-testid="course-start-date"]').textContent().catch(() => null),
        card.locator('[data-testid="course-end-date"]').textContent().catch(() => null)
      ]);
      
      // Extract enrollment count (parse from text like "123 students")
      const enrollmentCount = parseInt((enrollmentText || '0').match(/\d+/)?.[0] || '0', 10);
      
      // Strip "Starts: " and "Ends: " prefixes from dates
      const cleanStartDate = startDate?.trim().replace(/^Starts:\s*/, '');
      const cleanEndDate = endDate?.trim().replace(/^Ends:\s*/, '');
      
      return {
        courseId: (courseId || '').trim(),
        title: (title || '').trim(),
        instructor: (instructor || '').trim(),
        category: (category || '').trim(),
        enrollmentCount,
        imageUrl: imageUrl ?? undefined,
        description: description?.trim(),
        startDate: cleanStartDate || undefined,
        endDate: cleanEndDate || undefined,
        // Remove fields that don't exist in the component
        duration: undefined,
        rating: undefined,
        reviewCount: undefined,
        price: null
      };
    } catch (error) {
      // Log error but continue processing other cards
      console.warn(`Failed to extract data from course card ${index}:`, error);
      return null;
    }
  }

  /**
   * Clicks on a specific course card to navigate to course detail
   * @param courseId - ID of the course to click
   */
  async clickCourseCard(courseId: string): Promise<void> {
    const targetCard = this.page.locator(`[data-testid="course-card"][data-course-id="${courseId}"]`);
    await targetCard.waitFor({ state: 'visible' });
    
    // Scroll card into view if needed
    await targetCard.scrollIntoViewIfNeeded();
    
    // Click the card or its title link
    const cardLink = targetCard.locator('[data-testid="course-card-link"]');
    const linkExists = await cardLink.count() > 0;
    
    if (linkExists) {
      await cardLink.click();
    } else {
      await targetCard.click();
    }
    
    // Wait for navigation to complete
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }

  /**
   * Filters courses by category
   * @param categoryName - Name of the category to filter by
   */
  async filterByCategory(categoryName: string): Promise<void> {
    await this.filterPanel.waitFor({ state: 'visible' });
    
    // Find and click the category filter option
    const categoryFilter = this.filterPanel.locator(`[data-testid="category-filter-${categoryName}"]`);
    
    // If specific filter not found, try generic category selection
    if (await categoryFilter.count() === 0) {
      const categoryDropdown = this.filterPanel.locator('[data-testid="category-filter-dropdown"]');
      await categoryDropdown.click();
      await this.page.locator(`[data-value="${categoryName}"]`).click();
    } else {
      await categoryFilter.click();
    }
    
    // Wait for filtered results to load
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Applies a sort order to the course list
   * @param sortType - Type of sort (e.g., 'name', 'name-asc', 'name-desc', 'date', 'date-desc', 'popularity', 'popularity-desc')
   */
  async applySortOrder(sortType: string): Promise<void> {
    // Map test sort types to actual component testid values
    // Component only has: sort-option-name, sort-option-date, sort-option-popularity
    // Tests may use: name-asc, name-desc, date-desc, popularity-desc
    const sortMapping: Record<string, string> = {
      'name': 'name',
      'name-asc': 'name',
      'name-desc': 'name',
      'date': 'date',
      'date-asc': 'date',
      'date-desc': 'date',
      'popularity': 'popularity',
      'popularity-asc': 'popularity',
      'popularity-desc': 'popularity',
      'rating': 'popularity', // Fallback to popularity
    };
    
    const mappedSortType = sortMapping[sortType] || sortType;
    
    await this.sortDropdown.waitFor({ state: 'visible' });
    await this.sortDropdown.click();
    
    // Wait for dropdown menu to open
    await this.page.waitForTimeout(200);
    
    // Select the sort option
    const sortOption = this.page.locator(`[data-testid="sort-option-${mappedSortType}"]`);
    await sortOption.click();
    
    // Wait for sorted results to load
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Applies multiple filters to the course catalog
   * @param filters - Object containing filter criteria
   */
  async applyFilters(filters: CatalogFilters): Promise<void> {
    await this.filterPanel.waitFor({ state: 'visible' });
    
    // Apply category filter
    if (filters.category) {
      await this.filterByCategory(filters.category);
    }
    
    // Apply instructor filter
    if (filters.instructor) {
      const instructorInput = this.filterPanel.locator('[data-testid="instructor-filter-input"]');
      await instructorInput.fill(filters.instructor);
    }
    
    // Apply date range filters
    if (filters.startDate) {
      const startDateInput = this.filterPanel.locator('[data-testid="start-date-filter"]');
      await startDateInput.fill(filters.startDate);
    }
    
    if (filters.endDate) {
      const endDateInput = this.filterPanel.locator('[data-testid="end-date-filter"]');
      await endDateInput.fill(filters.endDate);
    }
    
    // Apply enrollment range filters
    if (filters.minEnrollment !== undefined) {
      const minEnrollmentInput = this.filterPanel.locator('[data-testid="min-enrollment-filter"]');
      await minEnrollmentInput.fill(filters.minEnrollment.toString());
    }
    
    if (filters.maxEnrollment !== undefined) {
      const maxEnrollmentInput = this.filterPanel.locator('[data-testid="max-enrollment-filter"]');
      await maxEnrollmentInput.fill(filters.maxEnrollment.toString());
    }
    
    // Apply rating filter
    if (filters.rating !== undefined) {
      const ratingFilter = this.filterPanel.locator(`[data-testid="rating-filter-${filters.rating}"]`);
      await ratingFilter.click();
    }
    
    // Apply price filter
    if (filters.price) {
      const priceFilter = this.filterPanel.locator(`[data-testid="price-filter-${filters.price}"]`);
      await priceFilter.click();
    }
    
    // Click apply filters button if present
    const applyButton = this.filterPanel.locator('[data-testid="apply-filters-button"]');
    const applyButtonVisible = await applyButton.isVisible().catch(() => false);
    
    if (applyButtonVisible) {
      await applyButton.click();
    }
    
    // Wait for filtered results to load
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggles between grid and list view
   * @param viewType - View type ('grid' or 'list')
   */
  async toggleView(viewType: 'grid' | 'list'): Promise<void> {
    await this.viewToggle.waitFor({ state: 'visible' });
    
    // Find the specific view button
    const viewButton = this.viewToggle.locator(`[data-testid="view-${viewType}-button"]`);
    
    // Check if already in the requested view
    const isActive = await viewButton.getAttribute('aria-pressed') === 'true' ||
                     await viewButton.getAttribute('class').then(cls => cls?.includes('active')).catch(() => false);
    
    if (!isActive) {
      await viewButton.click();
      await this.page.waitForTimeout(300); // Wait for view transition
    }
  }

  /**
   * Navigates to a specific page number
   * @param pageNumber - Page number to navigate to
   */
  async navigatePage(pageNumber: number): Promise<void> {
    await this.paginationControls.waitFor({ state: 'visible' });
    
    // Find and click the page number button
    // Use type="page" to disambiguate from first/last page buttons which may share the same page number
    const pageButton = this.paginationControls.locator(`[data-testid="page-${pageNumber}"][type="page"]`);
    
    // If specific page button not found, try generic pagination
    if (await pageButton.count() === 0) {
      const pageInput = this.paginationControls.locator('[data-testid="page-input"]');
      if (await pageInput.count() > 0) {
        await pageInput.fill(pageNumber.toString());
        await pageInput.press('Enter');
      }
    } else {
      await pageButton.scrollIntoViewIfNeeded();
      await pageButton.click();
    }
    
    // Wait for new page to load
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Navigates to the next page of results
   */
  async nextPage(): Promise<void> {
    await this.paginationControls.waitFor({ state: 'visible' });
    
    const nextButton = this.paginationControls.locator('[data-testid="next-page-button"]');
    
    // Check if next button is enabled
    const isDisabled = await nextButton.getAttribute('disabled') !== null ||
                       await nextButton.getAttribute('aria-disabled') === 'true';
    
    if (!isDisabled) {
      await nextButton.click();
      await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    } else {
      throw new Error('Next page button is disabled - already on last page');
    }
  }

  /**
   * Navigates to the previous page of results
   */
  async previousPage(): Promise<void> {
    await this.paginationControls.waitFor({ state: 'visible' });
    
    const prevButton = this.paginationControls.locator('[data-testid="previous-page-button"]');
    
    // Check if previous button is enabled
    const isDisabled = await prevButton.getAttribute('disabled') !== null ||
                       await prevButton.getAttribute('aria-disabled') === 'true';
    
    if (!isDisabled) {
      await prevButton.click();
      await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    } else {
      throw new Error('Previous page button is disabled - already on first page');
    }
  }

  /**
   * Sets the number of courses displayed per page
   * @param count - Number of courses per page (e.g., 10, 25, 50, 100)
   */
  async setCoursesPerPage(count: number): Promise<void> {
    await this.coursesPerPageSelect.waitFor({ state: 'visible' });
    await this.coursesPerPageSelect.click();
    
    // Wait for dropdown to open
    await this.page.waitForTimeout(200);
    
    // Select the option
    const option = this.page.locator(`[data-value="${count}"]`);
    await option.click();
    
    // Wait for page to reload with new count
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Gets the current breadcrumb navigation path
   * @returns Array of breadcrumb objects
   */
  async getBreadcrumbs(): Promise<Breadcrumb[]> {
    await this.categoryNav.waitFor({ state: 'visible' });
    
    const breadcrumbItems = this.categoryNav.locator('[data-testid="breadcrumb-item"]');
    const count = await breadcrumbItems.count();
    const breadcrumbs: Breadcrumb[] = [];
    
    for (let i = 0; i < count; i++) {
      const item = breadcrumbItems.nth(i);
      
      const label = await item.textContent() || '';
      const link = item.locator('a');
      const href = await link.getAttribute('href').catch(() => '');
      const ariaCurrent = await item.getAttribute('aria-current').catch(() => null);
      const classAttr = await item.getAttribute('class').catch(() => null);
      const isActive = ariaCurrent === 'page' || (classAttr?.includes('active') ?? false);
      
      breadcrumbs.push({
        label: label.trim(),
        href: href || '',
        isActive
      });
    }
    
    return breadcrumbs;
  }

  /**
   * Verifies that the empty state message is displayed
   * (when no courses match the current filters/search)
   * @returns True if empty state is visible, false otherwise
   */
  async verifyEmptyState(): Promise<boolean> {
    const emptyStateMessage = this.page.locator('[data-testid="empty-state-message"]');
    
    try {
      await emptyStateMessage.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets quick preview data for a specific course
   * (hover preview or quick view without navigating)
   * @param courseId - ID of the course to preview
   * @returns Course preview data
   */
  async getCoursePreview(courseId: string): Promise<Partial<CourseCardData>> {
    const targetCard = this.page.locator(`[data-testid="course-card"][data-course-id="${courseId}"]`);
    await targetCard.waitFor({ state: 'visible' });
    await targetCard.scrollIntoViewIfNeeded();
    
    // Hover over the card to trigger preview
    await targetCard.hover();
    await this.page.waitForTimeout(500); // Wait for preview to appear
    
    // Look for preview popup or expanded card
    const previewPopup = this.page.locator('[data-testid="course-preview-popup"]');
    const previewVisible = await previewPopup.isVisible().catch(() => false);
    
    if (previewVisible) {
      // Extract preview data from popup
      const title = await previewPopup.locator('[data-testid="preview-title"]').textContent() || '';
      const description = await previewPopup.locator('[data-testid="preview-description"]').textContent().catch(() => undefined);
      const instructor = await previewPopup.locator('[data-testid="preview-instructor"]').textContent().catch(() => undefined);
      const category = await previewPopup.locator('[data-testid="preview-category"]').textContent().catch(() => undefined);
      const duration = await previewPopup.locator('[data-testid="preview-duration"]').textContent().catch(() => undefined);
      
      return {
        courseId,
        title: title.trim(),
        description: description?.trim(),
        instructor: instructor?.trim(),
        category: category?.trim(),
        duration: duration?.trim()
      };
    } 
      // If no preview popup, extract data from the card itself
      const title = await targetCard.locator('[data-testid="course-title"]').textContent() || '';
      const description = await targetCard.locator('[data-testid="course-description"]').textContent().catch(() => undefined);
      
      return {
        courseId,
        title: title.trim(),
        description: description?.trim()
      };
    
  }
}
