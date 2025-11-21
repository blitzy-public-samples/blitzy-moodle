/**
 * E2E Tests for Global Search Functionality
 * 
 * Validates comprehensive search capabilities across courses, users, and content
 * including search input, results display, filtering, autocomplete, pagination,
 * and navigation to search results. Tests both functional correctness and
 * performance requirements (<1 second search response time).
 * 
 * Test Coverage:
 * - Course search by name and metadata
 * - User search by username, name, and email
 * - Global search across all content types
 * - Search result filtering by type
 * - Autocomplete suggestions
 * - Empty and no-results states
 * - Result pagination
 * - Navigation from search results
 * - Search performance validation
 * 
 * Dependencies:
 * - SearchPage POM for search UI interactions
 * - Auth utilities for student login
 * - Course and user fixtures for test data
 * - Wait helpers for performance testing
 * - Screenshot helpers for failure debugging
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SearchPage } from './pages/SearchPage';
import { loginAsStudent } from './utils/auth';
import { testCourse4 } from './fixtures/courses';
import { testStudent } from './fixtures/users';
import { waitForCondition } from './utils/wait-helpers';
import { captureOnFailure } from './utils/screenshot-helpers';

/**
 * Test suite for global search functionality
 * 
 * Uses authenticated student user with access to multiple courses
 * to validate search across all accessible content types.
 */
test.describe('Global Search Functionality', () => {
  let page: Page;
  let searchPage: SearchPage;

  /**
   * Setup: Login as student and initialize search page
   * 
   * Establishes authenticated session with student role to test
   * search from student perspective with appropriate permissions.
   */
  test.beforeEach(async ({ browser }) => {
    // Create a new page context
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Login as student user with access to test courses
    await loginAsStudent(page);
    
    // Initialize search page object model
    searchPage = new SearchPage(page);
    
    // Navigate to search page or wait for it to load
    await searchPage.waitForSearch();
  });

  /**
   * Cleanup: Capture screenshots on test failure
   * 
   * Automatically captures full page screenshot when test fails
   * to facilitate debugging of search UI and results display issues.
   */
  test.afterEach(async (_context, testInfo) => {
    await captureOnFailure(page, testInfo);
    
    // Close page after test
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  /**
   * Test: Course search by name
   * 
   * Validates that searching for a course name returns matching
   * course results with correct course information displayed.
   */
  test('should search for courses by name and display results', async () => {
    // Use testCourse4 fixture data for search
    const courseSearchTerm = testCourse4.shortname;
    
    // Perform course search
    await searchPage.search(courseSearchTerm);
    
    // Wait for search results to load
    const results = await searchPage.getResults();
    
    // Verify results are returned
    expect(results.length).toBeGreaterThan(0);
    
    // Get course-specific results
    const courseResults = await searchPage.getCourseResults();
    
    // Verify course results contain the searched course
    expect(courseResults.length).toBeGreaterThan(0);
    
    // Verify search term appears in results
    await searchPage.verifyResultsMatch(courseSearchTerm);
    
    // Verify course details are displayed correctly
    const firstCourse = courseResults[0];
    expect(firstCourse).toBeTruthy();
    
    // Verify course fullname or shortname is present
    const courseText = await page.locator(`[data-testid="search-result-0"]`).textContent();
    expect(courseText).toContain(testCourse4.fullname.toLowerCase());
  });

  /**
   * Test: User search by username and email
   * 
   * Validates that searching for users by username or email
   * returns matching user results with correct user information.
   */
  test('should search for users by username or email', async () => {
    // Use testStudent fixture data for search
    const userSearchTerm = testStudent.username;
    
    // Perform user search
    await searchPage.search(userSearchTerm);
    
    // Wait for search results to load
    const results = await searchPage.getResults();
    
    // Verify results are returned
    expect(results.length).toBeGreaterThan(0);
    
    // Get user-specific results
    const userResults = await searchPage.getUserResults();
    
    // Verify user results are returned
    expect(userResults.length).toBeGreaterThan(0);
    
    // Verify search term appears in user results
    await searchPage.verifyResultsMatch(userSearchTerm);
    
    // Verify user details are displayed (name, email)
    const firstUser = userResults[0];
    expect(firstUser).toBeTruthy();
    
    // Verify user information is visible
    const userText = await page.locator('[data-type="user"]').first().textContent();
    expect(userText).toMatch(new RegExp(`${testStudent.firstname}|${testStudent.lastname}|${testStudent.email}`, 'i'));
  });

  /**
   * Test: User search by email address
   * 
   * Additional validation that email address search works correctly
   * and returns the expected user results.
   */
  test('should search for users by email address', async () => {
    // Search by email from testStudent fixture
    const emailSearchTerm = testStudent.email;
    
    // Perform search
    await searchPage.search(emailSearchTerm);
    
    // Get user results
    const userResults = await searchPage.getUserResults();
    
    // Verify user results include the searched email
    expect(userResults.length).toBeGreaterThan(0);
    
    // Verify email appears in results
    const resultText = await page.locator('[data-type="user"]').first().textContent();
    expect(resultText?.toLowerCase()).toContain(testStudent.email.toLowerCase());
  });

  /**
   * Test: Global search across all content types
   * 
   * Validates that global search returns mixed results from multiple
   * content types (courses, users, activities, etc.) when search term
   * matches across different types.
   */
  test('should perform global search across all content types', async () => {
    // Use a generic search term that may match multiple types
    const globalSearchTerm = 'test';
    
    // Perform global search
    await searchPage.search(globalSearchTerm);
    
    // Get all results
    const allResults = await searchPage.getResults();
    
    // Verify mixed results are returned
    expect(allResults.length).toBeGreaterThan(0);
    
    // Verify multiple content types are present
    const courseResults = await searchPage.getCourseResults();
    const userResults = await searchPage.getUserResults();
    
    // At least one type should have results for "test" keyword
    const totalTypeResults = courseResults.length + userResults.length;
    expect(totalTypeResults).toBeGreaterThan(0);
    
    // Verify results match the search term
    await searchPage.verifyResultsMatch(globalSearchTerm);
  });

  /**
   * Test: Search result filtering by type
   * 
   * Validates that users can filter search results to show only
   * specific content types (courses only or users only).
   */
  test('should filter search results by type', async () => {
    // Perform search that returns mixed results
    await searchPage.search('test');
    
    // Get initial results count
    const initialResults = await searchPage.getResults();
    expect(initialResults.length).toBeGreaterThan(0);
    
    // Apply course filter
    await searchPage.filterByType('course');
    
    // Verify only course results are shown
    const courseResults = await searchPage.getCourseResults();
    const userResultsAfterFilter = await searchPage.getUserResults();
    
    expect(courseResults.length).toBeGreaterThan(0);
    expect(userResultsAfterFilter.length).toBe(0);
    
    // Reset and apply user filter
    await searchPage.search('test');
    await searchPage.filterByType('user');
    
    // Verify only user results are shown
    const userResults = await searchPage.getUserResults();
    const courseResultsAfterFilter = await searchPage.getCourseResults();
    
    expect(userResults.length).toBeGreaterThan(0);
    expect(courseResultsAfterFilter.length).toBe(0);
  });

  /**
   * Test: Search result navigation
   * 
   * Validates that clicking on search results navigates to the
   * correct destination page (course page, user profile, etc.).
   */
  test('should navigate to correct page when clicking search result', async () => {
    // Search for specific course
    await searchPage.search(testCourse4.shortname);
    
    // Get course results
    const courseResults = await searchPage.getCourseResults();
    expect(courseResults.length).toBeGreaterThan(0);
    
    // Click first course result
    await searchPage.clickResult(courseResults[0]!.id);
    
    // Verify navigation to course page
    await page.waitForLoadState('networkidle');
    
    // Verify URL contains course ID
    const currentUrl = page.url();
    expect(currentUrl).toContain(`/courses/${testCourse4.id}`);
    
    // Verify course page is loaded
    await expect(page.locator('h1')).toContainText(testCourse4.fullname);
  });

  /**
   * Test: Search autocomplete suggestions
   * 
   * Validates that typing partial search queries shows autocomplete
   * suggestions that users can select to complete their search.
   */
  test('should display autocomplete suggestions for partial queries', async () => {
    // Type partial course name (first few characters)
    const partialQuery = testCourse4.shortname.substring(0, 3);
    
    // Enter partial query without submitting
    await page.locator('[data-testid="search-input"]').fill(partialQuery);
    
    // Wait for autocomplete suggestions to appear
    await page.waitForTimeout(500); // Debounce delay
    
    // Get autocomplete suggestions
    const suggestions = await searchPage.getAutocompleteSuggestions();
    
    // Verify suggestions are shown
    expect(suggestions.length).toBeGreaterThan(0);
    
    // Verify suggestions contain matching text
    const firstSuggestion = suggestions[0]!;
    expect(firstSuggestion.text.toLowerCase()).toContain(partialQuery.toLowerCase());
    
    // Select a suggestion
    await searchPage.selectSuggestion(0);
    
    // Verify search is performed with selected suggestion
    const results = await searchPage.getResults();
    expect(results.length).toBeGreaterThan(0);
  });

  /**
   * Test: Empty search submission
   * 
   * Validates that submitting an empty search query shows an
   * appropriate message and doesn't break the application.
   */
  test('should show appropriate message for empty search query', async () => {
    // Submit empty search
    await searchPage.search('');
    
    // Verify empty state is displayed
    await searchPage.verifyEmptyState();
    
    // Verify appropriate message is shown
    const emptyMessage = page.locator('[data-testid="empty-search-message"]');
    await expect(emptyMessage).toBeVisible();
    
    // Verify message text is appropriate
    const messageText = await emptyMessage.textContent();
    expect(messageText).toMatch(/enter.*search|provide.*query|type.*search/i);
  });

  /**
   * Test: No results found
   * 
   * Validates that searching for non-existent terms shows a
   * "no results found" message with helpful suggestions.
   */
  test('should show no results message for non-existent search term', async () => {
    // Search for term that won't match anything
    const nonExistentTerm = 'xyzabc123nonexistent999';
    
    // Perform search
    await searchPage.search(nonExistentTerm);
    
    // Verify no results message is displayed
    const noResultsMessage = page.locator('[data-testid="no-results-message"]');
    await expect(noResultsMessage).toBeVisible();
    
    // Verify appropriate message text
    const messageText = await noResultsMessage.textContent();
    expect(messageText).toMatch(/no results|not found|no matches/i);
    
    // Verify result count is zero
    const resultCount = await searchPage.getResultCount();
    expect(resultCount).toBe(0);
  });

  /**
   * Test: Search results pagination
   * 
   * Validates that search results are paginated correctly and
   * users can navigate between pages of results.
   */
  test('should paginate search results correctly', async () => {
    // Perform broad search that returns many results
    await searchPage.search('course');
    
    // Get initial results
    const firstPageResults = await searchPage.getResults();
    expect(firstPageResults.length).toBeGreaterThan(0);
    
    // Get initial result count
    const totalResults = await searchPage.getResultCount();
    
    // If there are enough results for pagination
    if (totalResults > 20) {
      // Navigate to next page
      await searchPage.nextPage();
      
      // Wait for new results to load
      await page.waitForLoadState('networkidle');
      
      // Get second page results
      const secondPageResults = await searchPage.getResults();
      expect(secondPageResults.length).toBeGreaterThan(0);
      
      // Verify different results on second page
      // (first result on page 2 should differ from first result on page 1)
      const firstPageFirstResult = firstPageResults[0];
      const secondPageFirstResult = secondPageResults[0];
      expect(firstPageFirstResult).not.toBe(secondPageFirstResult);
    }
  });

  /**
   * Test: Search performance requirement
   * 
   * Validates that search operations complete within 1 second
   * to meet performance requirements for responsive user experience.
   */
  test('should complete search within 1 second performance target', async () => {
    // Record start time
    const startTime = Date.now();
    
    // Perform search
    await searchPage.search(testCourse4.shortname);
    
    // Wait for results to be displayed
    await searchPage.waitForSearch();
    
    // Verify search completed within 1 second
    await waitForCondition(
      async () => {
        const results = await searchPage.getResults();
        return results.length > 0;
      },
      {
        timeout: 1000,
        errorMessage: 'Search did not complete within 1 second performance requirement'
      }
    );
    
    // Calculate actual time taken
    const endTime = Date.now();
    const searchDuration = endTime - startTime;
    
    // Assert search completed within 1 second (1000ms)
    expect(searchDuration).toBeLessThan(1000);
    
    // Log performance metric
    console.log(`Search completed in ${searchDuration}ms`);
  });

  /**
   * Test: Search results match query relevance
   * 
   * Validates that search results are relevant to the query
   * and contain the searched terms in appropriate fields.
   */
  test('should return relevant results matching search query', async () => {
    // Search for specific course
    const searchTerm = testCourse4.fullname;
    
    // Perform search
    await searchPage.search(searchTerm);
    
    // Get results
    const results = await searchPage.getResults();
    expect(results.length).toBeGreaterThan(0);
    
    // Verify results match search term
    await searchPage.verifyResultsMatch(searchTerm);
    
    // Verify each result contains search term in title or description
    for (let i = 0; i < Math.min(results.length, 5); i++) {
      const resultElement = page.locator(`[data-testid="search-result-${i}"]`);
      const resultText = await resultElement.textContent();
      
      // Result should contain at least part of the search term
      const searchWords = searchTerm.toLowerCase().split(' ');
      const hasMatch = searchWords.some(word => 
        word.length > 3 && resultText?.toLowerCase().includes(word)
      );
      
      expect(hasMatch).toBeTruthy();
    }
  });

  /**
   * Test: Search results are clickable
   * 
   * Validates that all search results are interactive and can be
   * clicked to navigate to their respective pages.
   */
  test('should make all search results clickable and navigable', async () => {
    // Perform search
    await searchPage.search('test');
    
    // Get results
    const results = await searchPage.getResults();
    expect(results.length).toBeGreaterThan(0);
    
    // Verify first result is clickable
    const firstResult = page.locator('[data-testid="search-result-0"]');
    await expect(firstResult).toBeVisible();
    
    // Verify result has proper interactive role
    const role = await firstResult.getAttribute('role');
    expect(['link', 'button'].includes(role || '')).toBeTruthy();
    
    // Verify result can receive focus (keyboard accessible)
    await firstResult.focus();
    const isFocused = await firstResult.evaluate(el => el === document.activeElement);
    expect(isFocused).toBeTruthy();
    
    // Verify result has cursor pointer (visual affordance)
    const cursor = await firstResult.evaluate(el => 
      window.getComputedStyle(el).cursor
    );
    expect(cursor).toBe('pointer');
  });

  /**
   * Test: Search with special characters
   * 
   * Validates that search handles special characters correctly
   * without breaking the search functionality or causing errors.
   */
  test('should handle special characters in search query', async () => {
    // Search with special characters
    const specialCharQuery = 'test@#$%&*()';
    
    // Perform search (should not throw error)
    await searchPage.search(specialCharQuery);
    
    // Verify search completes without error
    // Either returns results or shows no results message
    const hasResults = await page.locator('[data-testid="search-result-0"]').isVisible()
      .catch(() => false);
    const hasNoResults = await page.locator('[data-testid="no-results-message"]').isVisible()
      .catch(() => false);
    
    // One of these should be true
    expect(hasResults || hasNoResults).toBeTruthy();
  });

  /**
   * Test: Case-insensitive search
   * 
   * Validates that search is case-insensitive and returns same
   * results regardless of query case.
   */
  test('should perform case-insensitive search', async () => {
    // Search with lowercase
    await searchPage.search(testCourse4.shortname.toLowerCase());
    const lowercaseResults = await searchPage.getResults();
    
    // Navigate back to search
    await searchPage.waitForSearch();
    
    // Search with uppercase
    await searchPage.search(testCourse4.shortname.toUpperCase());
    const uppercaseResults = await searchPage.getResults();
    
    // Verify same number of results
    expect(lowercaseResults.length).toBe(uppercaseResults.length);
    expect(lowercaseResults.length).toBeGreaterThan(0);
  });

  /**
   * Test: Search result count display
   * 
   * Validates that the total number of search results is displayed
   * accurately to inform users of result quantity.
   */
  test('should display accurate search result count', async () => {
    // Perform search
    await searchPage.search('course');
    
    // Get displayed result count
    const displayedCount = await searchPage.getResultCount();
    
    // Get actual results
    const results = await searchPage.getResults();
    
    // Verify count matches or exceeds visible results
    // (count may be total across pages, results are current page)
    expect(displayedCount).toBeGreaterThanOrEqual(results.length);
    
    // Verify count is displayed to user
    const countElement = page.locator('[data-testid="result-count"]');
    await expect(countElement).toBeVisible();
    
    // Verify count text format
    const countText = await countElement.textContent();
    expect(countText).toMatch(/\d+.*result/i);
  });
});
