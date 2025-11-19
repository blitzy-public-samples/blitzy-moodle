/**
 * Page Object Model for Global Search Interface
 * 
 * Encapsulates selectors and interactions for the global search functionality
 * across courses, users, and content. Used by search.spec.ts E2E test.
 * 
 * @packageDocumentation
 */

import type { Page, Locator } from '@playwright/test';

/**
 * Interface representing a search result item
 */
export interface SearchResult {
  id: string;
  type: 'course' | 'user' | 'content';
  title: string;
  description: string;
  url: string;
  metadata?: {
    author?: string;
    date?: string;
    category?: string;
  };
}

/**
 * Interface for autocomplete suggestion items
 */
export interface AutocompleteSuggestion {
  text: string;
  type: 'course' | 'user' | 'content';
  count?: number;
}

/**
 * SearchPage - Page Object Model for global search interface
 * 
 * This class provides a comprehensive interface for interacting with the
 * search functionality in E2E tests. It encapsulates all search-related
 * UI elements and provides methods for common search operations.
 */
export class SearchPage {
  // Core search locators
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly resultsList: Locator;
  readonly resultItem: Locator;
  readonly resultTypeFilter: Locator;
  readonly autocompleteSuggestions: Locator;
  readonly emptyStateMessage: Locator;
  readonly paginationControls: Locator;
  readonly resultCount: Locator;

  /**
   * Creates a new SearchPage instance
   * @param page - Playwright Page object
   */
  constructor(private readonly page: Page) {
    // Initialize all locators with data-testid selectors
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.searchButton = page.locator('[data-testid="search-button"]');
    this.resultsList = page.locator('[data-testid="search-results-list"]');
    this.resultItem = page.locator('[data-testid="search-result-item"]');
    this.resultTypeFilter = page.locator('[data-testid="result-type-filter"]');
    this.autocompleteSuggestions = page.locator('[data-testid="autocomplete-suggestions"]');
    this.emptyStateMessage = page.locator('[data-testid="empty-state-message"]');
    this.paginationControls = page.locator('[data-testid="pagination-controls"]');
    this.resultCount = page.locator('[data-testid="result-count"]');
  }

  /**
   * Wait for the search page to fully load
   * @returns Promise that resolves when page is loaded
   */
  async waitForSearch(): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible' });
    await this.searchButton.waitFor({ state: 'visible' });
  }

  /**
   * Enter a search query and execute the search
   * @param query - The search term to query
   * @returns Promise that resolves when search is complete
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.waitForSearchResults();
  }

  /**
   * Get all search results from the current page
   * @returns Promise resolving to array of search results
   */
  async getResults(): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const items = await this.resultItem.all();

    for (const item of items) {
      const id = await item.getAttribute('data-result-id') || '';
      const type = (await item.getAttribute('data-result-type')) as 'course' | 'user' | 'content';
      const title = await item.locator('[data-testid="result-title"]').textContent() || '';
      const description = await item.locator('[data-testid="result-description"]').textContent() || '';
      const url = await item.locator('a').getAttribute('href') || '';

      results.push({
        id,
        type,
        title,
        description,
        url
      });
    }

    return results;
  }

  /**
   * Filter and get results by specific type
   * @param type - The type of results to retrieve ('course', 'user', or 'content')
   * @returns Promise resolving to filtered array of search results
   */
  async getResultsByType(type: 'course' | 'user' | 'content'): Promise<SearchResult[]> {
    const allResults = await this.getResults();
    return allResults.filter(result => result.type === type);
  }

  /**
   * Navigate to a specific search result by ID
   * @param resultId - The ID of the result to click
   * @returns Promise that resolves when navigation is complete
   */
  async clickResult(resultId: string): Promise<void> {
    const result = this.resultItem.filter({ has: this.page.locator(`[data-result-id="${resultId}"]`) });
    await result.locator('a').click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Apply a type filter to search results
   * @param type - The type to filter by ('course', 'user', or 'content')
   * @returns Promise that resolves when filter is applied
   */
  async filterByType(type: 'course' | 'user' | 'content'): Promise<void> {
    await this.resultTypeFilter.selectOption(type);
    await this.waitForSearchResults();
  }

  /**
   * Get autocomplete suggestions from the search input
   * @returns Promise resolving to array of autocomplete suggestions
   */
  async getAutocompleteSuggestions(): Promise<AutocompleteSuggestion[]> {
    await this.autocompleteSuggestions.waitFor({ state: 'visible' });
    const suggestions: AutocompleteSuggestion[] = [];
    const suggestionItems = await this.autocompleteSuggestions.locator('[data-testid="suggestion-item"]').all();

    for (const item of suggestionItems) {
      const text = await item.textContent() || '';
      const type = (await item.getAttribute('data-suggestion-type')) as 'course' | 'user' | 'content';
      const countText = await item.locator('[data-testid="suggestion-count"]').textContent();
      const count = countText ? parseInt(countText, 10) : undefined;

      suggestions.push({
        text,
        type,
        count
      });
    }

    return suggestions;
  }

  /**
   * Select an autocomplete suggestion by index
   * @param suggestionIndex - Zero-based index of the suggestion to select
   * @returns Promise that resolves when suggestion is selected
   */
  async selectSuggestion(suggestionIndex: number): Promise<void> {
    const suggestions = await this.autocompleteSuggestions.locator('[data-testid="suggestion-item"]').all();
    
    if (suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
      await suggestions[suggestionIndex]!.click();
      await this.waitForSearchResults();
    } else {
      throw new Error(`Invalid suggestion index: ${suggestionIndex}. Available suggestions: ${suggestions.length}`);
    }
  }

  /**
   * Verify that the empty state message is displayed
   * @returns Promise resolving to true if empty state is visible
   */
  async verifyEmptyState(): Promise<boolean> {
    try {
      await this.emptyStateMessage.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the total count of search results
   * @returns Promise resolving to the number of results
   */
  async getResultCount(): Promise<number> {
    const countText = await this.resultCount.textContent();
    const match = countText?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * Navigate to the next page of search results
   * @returns Promise that resolves when next page is loaded
   */
  async nextPage(): Promise<void> {
    const nextButton = this.paginationControls.locator('[data-testid="next-page-button"]');
    await nextButton.click();
    await this.waitForSearchResults();
  }

  /**
   * Clear the search input field
   * @returns Promise that resolves when input is cleared
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  /**
   * Verify that search results match the query
   * @param query - The search query to verify against
   * @returns Promise resolving to true if results are relevant
   */
  async verifyResultsMatch(query: string): Promise<boolean> {
    const results = await this.getResults();
    const queryLower = query.toLowerCase();

    if (results.length === 0) {
      return false;
    }

    // Check if at least one result contains the query in title or description
    return results.some(result => 
      result.title.toLowerCase().includes(queryLower) ||
      result.description.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Get all course-specific search results
   * @returns Promise resolving to array of course results
   */
  async getCourseResults(): Promise<SearchResult[]> {
    return this.getResultsByType('course');
  }

  /**
   * Get all user-specific search results
   * @returns Promise resolving to array of user results
   */
  async getUserResults(): Promise<SearchResult[]> {
    return this.getResultsByType('user');
  }

  /**
   * Wait for search results to load after a search operation
   * @param timeout - Maximum time to wait in milliseconds (default: 10000)
   * @returns Promise that resolves when results are loaded or empty state is shown
   */
  async waitForSearchResults(timeout: number = 10000): Promise<void> {
    try {
      // Wait for either results list or empty state message to appear
      await Promise.race([
        this.resultsList.waitFor({ state: 'visible', timeout }),
        this.emptyStateMessage.waitFor({ state: 'visible', timeout })
      ]);
    } catch (error) {
      throw new Error(`Search results failed to load within ${timeout}ms: ${String(error)}`);
    }
  }
}
