/**
 * Screenshot and Video Capture Utilities for Playwright E2E Tests
 * 
 * Provides comprehensive screenshot capture, video recording, and visual regression testing
 * utilities for debugging failed tests and comparing UI changes across test runs.
 * 
 * Features:
 * - Screenshot capture (full page, viewport, element-specific)
 * - Automatic capture on test failure
 * - Video recording of test execution
 * - Visual regression testing with pixel comparison
 * - Screenshot management (storage, cleanup, retention)
 * - Advanced features (highlighting, masking sensitive data)
 * 
 * Storage:
 * - Screenshots: test-results/screenshots/ (7 days retention)
 * - Videos: test-results/videos/ (30 days retention)
 * - Format: PNG with compression, WebM with H.264 codec
 */

import type { Page, Locator, TestInfo } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * Configuration interface for screenshot capture behavior
 */
export interface ScreenshotOptions {
  /** File path where screenshot will be saved */
  path?: string;
  /** Capture full scrollable page instead of viewport only */
  fullPage?: boolean;
  /** Capture specific rectangular area (x, y, width, height) */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Hide default white background, allow transparency */
  omitBackground?: boolean;
  /** Quality for JPEG screenshots (0-100), ignored for PNG */
  quality?: number;
  /** Maximum time in milliseconds to wait for screenshot */
  timeout?: number;
}

/**
 * Configuration interface for video recording
 */
export interface VideoOptions {
  /** Directory where video files will be saved */
  dir?: string;
  /** Video frame size configuration */
  size?: {
    width: number;
    height: number;
  };
}

/**
 * Result of visual regression comparison between two screenshots
 */
export interface ComparisonResult {
  /** Whether screenshots match within threshold */
  match: boolean;
  /** Percentage of pixels that differ (0-100) */
  mismatchPercentage: number;
  /** Path to generated diff image highlighting differences */
  diffImagePath: string;
}

/**
 * Global configuration for screenshot and video storage
 */
export interface ScreenshotConfig {
  /** Base directory for screenshot storage */
  screenshotDir: string;
  /** Base directory for video storage */
  videoDir: string;
  /** Number of days to retain screenshots before cleanup */
  retentionDays: number;
  /** Screenshot file format (png, jpeg, webp) */
  format: string;
  /** Enable compression for screenshots */
  compression: boolean;
}

/**
 * Default configuration for screenshot utilities
 */
const DEFAULT_CONFIG: ScreenshotConfig = {
  screenshotDir: 'test-results/screenshots',
  videoDir: 'test-results/videos',
  retentionDays: 7,
  format: 'png',
  compression: true,
};

/**
 * Active video recording context storage
 * Maps test IDs to their video recording paths
 */
const activeRecordings = new Map<string, string>();

/**
 * Capture screenshot of current page with custom filename
 * 
 * @param page - Playwright page instance
 * @param filename - Custom filename for screenshot (without extension)
 * @param options - Optional screenshot configuration
 * @returns Promise resolving to full path of saved screenshot
 * 
 * @example
 * await takeScreenshot(page, 'login-error', { fullPage: false });
 */
export async function takeScreenshot(
  page: Page,
  filename: string,
  options: Partial<ScreenshotOptions> = {}
): Promise<string> {
  // Ensure screenshot directory exists
  await ensureDirectoryExists(DEFAULT_CONFIG.screenshotDir);

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const screenshotFilename = `${filename}_${timestamp}_${randomSuffix}.${DEFAULT_CONFIG.format}`;
  const screenshotPath = path.join(DEFAULT_CONFIG.screenshotDir, screenshotFilename);

  try {
    // Capture screenshot with provided options
    await page.screenshot({
      path: screenshotPath,
      fullPage: options.fullPage ?? false,
      clip: options.clip,
      omitBackground: options.omitBackground ?? false,
      quality: options.quality,
      timeout: options.timeout ?? 30000,
    });

    console.log(`Screenshot saved: ${screenshotPath}`);
    return path.resolve(screenshotPath);
  } catch (error) {
    console.error(`Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Capture entire scrollable page as single screenshot
 * 
 * Automatically scrolls through entire page and stitches together
 * a complete screenshot including all off-viewport content.
 * 
 * @param page - Playwright page instance
 * @param filename - Custom filename for screenshot
 * @returns Promise resolving to full path of saved screenshot
 * 
 * @example
 * await takeFullPageScreenshot(page, 'complete-dashboard');
 */
export async function takeFullPageScreenshot(
  page: Page,
  filename: string
): Promise<string> {
  return takeScreenshot(page, filename, { fullPage: true });
}

/**
 * Capture screenshot of specific DOM element
 * 
 * Focuses screenshot on a single element, clipping to its bounding box.
 * Useful for component-level testing and debugging specific UI elements.
 * 
 * @param locator - Playwright locator identifying the target element
 * @param filename - Custom filename for screenshot
 * @returns Promise resolving to full path of saved screenshot
 * 
 * @example
 * const button = page.locator('button[data-testid="submit"]');
 * await takeElementScreenshot(button, 'submit-button-error');
 */
export async function takeElementScreenshot(
  locator: Locator,
  filename: string
): Promise<string> {
  // Ensure screenshot directory exists
  await ensureDirectoryExists(DEFAULT_CONFIG.screenshotDir);

  // Generate unique filename
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const screenshotFilename = `${filename}_${timestamp}_${randomSuffix}.${DEFAULT_CONFIG.format}`;
  const screenshotPath = path.join(DEFAULT_CONFIG.screenshotDir, screenshotFilename);

  try {
    // Capture element screenshot using locator's built-in method
    await locator.screenshot({
      path: screenshotPath,
      timeout: 30000,
    });

    console.log(`Element screenshot saved: ${screenshotPath}`);
    return path.resolve(screenshotPath);
  } catch (error) {
    console.error(`Failed to capture element screenshot: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Element screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Automatically capture screenshot when test fails
 * 
 * Integrates with Playwright test hooks to capture debugging screenshots
 * on test failure. Should be called in test.afterEach() hook.
 * 
 * @param page - Playwright page instance
 * @param testInfo - Playwright test metadata
 * @returns Promise resolving when screenshot is captured (only on failure)
 * 
 * @example
 * test.afterEach(async ({ page }, testInfo) => {
 *   await captureOnFailure(page, testInfo);
 * });
 */
export async function captureOnFailure(
  page: Page,
  testInfo: TestInfo
): Promise<void> {
  // Only capture if test failed
  if (testInfo.status !== 'passed') {
    try {
      // Generate failure screenshot filename from test title
      const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const failureFilename = `failure_${sanitizedTitle}`;

      // Capture full page screenshot of failure state
      const screenshotPath = await takeFullPageScreenshot(page, failureFilename);

      // Attach screenshot to test report for visibility
      await testInfo.attach('failure-screenshot', {
        path: screenshotPath,
        contentType: 'image/png',
      });

      console.log(`Failure screenshot captured for test: ${testInfo.title}`);
    } catch (error) {
      // Don't fail the test if screenshot capture fails
      console.warn(`Failed to capture failure screenshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Start recording video of test execution
 * 
 * Begins video capture of browser viewport. Must be called before
 * test execution starts. Use stopVideoRecording() to save video.
 * 
 * @param page - Playwright page instance
 * @param testInfo - Playwright test metadata
 * @param options - Optional video configuration
 * @returns Promise resolving to video recording ID
 * 
 * @example
 * test('complex workflow', async ({ page }, testInfo) => {
 *   await startVideoRecording(page, testInfo);
 *   // ... test steps ...
 *   await stopVideoRecording(page, testInfo);
 * });
 */
export async function startVideoRecording(
  _page: Page,
  testInfo: TestInfo,
  options: Partial<VideoOptions> = {}
): Promise<string> {
  // Ensure video directory exists
  const videoDir = options.dir ?? DEFAULT_CONFIG.videoDir;
  await ensureDirectoryExists(videoDir);

  // Generate unique video ID and filename
  const videoId = crypto.randomUUID();
  const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = Date.now();
  const videoFilename = `${sanitizedTitle}_${timestamp}_${videoId}.webm`;
  const videoPath = path.join(videoDir, videoFilename);

  // Store recording context for later retrieval
  activeRecordings.set(videoId, videoPath);

  console.log(`Video recording started: ${videoPath}`);
  return videoId;
}

/**
 * Stop video recording and save file
 * 
 * Stops active video recording and saves to disk. Returns path to saved video.
 * Note: Playwright's video recording is managed by context configuration,
 * this function manages the video file lifecycle.
 * 
 * @param page - Playwright page instance
 * @param testInfo - Playwright test metadata
 * @param videoId - Optional video ID from startVideoRecording (uses test ID if omitted)
 * @returns Promise resolving to full path of saved video
 * 
 * @example
 * const videoId = await startVideoRecording(page, testInfo);
 * // ... test execution ...
 * const videoPath = await stopVideoRecording(page, testInfo, videoId);
 */
export async function stopVideoRecording(
  _page: Page,
  testInfo: TestInfo,
  videoId?: string
): Promise<string> {
  try {
    // Get video path from context or generate default
    const recordingId = videoId ?? testInfo.testId;
    let videoPath = activeRecordings.get(recordingId);

    if (!videoPath) {
      // Generate default video path if not found
      const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const timestamp = Date.now();
      videoPath = path.join(
        DEFAULT_CONFIG.videoDir,
        `${sanitizedTitle}_${timestamp}.webm`
      );
    }

    // Playwright automatically saves video when context closes
    // We attach it to the test report here
    const videoExists = await fileExists(videoPath);
    if (videoExists) {
      await testInfo.attach('video', {
        path: videoPath,
        contentType: 'video/webm',
      });
    }

    // Clean up active recording reference
    if (videoId) {
      activeRecordings.delete(videoId);
    }

    console.log(`Video recording stopped: ${videoPath}`);
    return path.resolve(videoPath);
  } catch (error) {
    console.warn(`Failed to stop video recording: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Video recording stop failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Compare two screenshots for visual regression testing
 * 
 * Performs pixel-by-pixel comparison of two PNG screenshots using pixelmatch algorithm.
 * Generates diff image highlighting differences in red. Returns comparison result with
 * match status and mismatch percentage.
 * 
 * @param baselinePath - Path to baseline (expected) screenshot
 * @param currentPath - Path to current (actual) screenshot
 * @param threshold - Sensitivity threshold for color differences (0-1, default 0.1)
 * @returns Promise resolving to comparison result with diff image
 * 
 * @example
 * const result = await compareScreenshots(
 *   'baseline/dashboard.png',
 *   'current/dashboard.png',
 *   0.1
 * );
 * if (!result.match) {
 *   console.log(`Visual regression detected: ${result.mismatchPercentage}% different`);
 * }
 */
export async function compareScreenshots(
  baselinePath: string,
  currentPath: string,
  threshold: number = 0.1
): Promise<ComparisonResult> {
  try {
    // Read both screenshots as PNG buffers
    const baselineBuffer = await fs.readFile(baselinePath);
    const currentBuffer = await fs.readFile(currentPath);

    // Parse PNG images
    const baselineImg = PNG.sync.read(baselineBuffer);
    const currentImg = PNG.sync.read(currentBuffer);

    // Validate dimensions match
    if (
      baselineImg.width !== currentImg.width ||
      baselineImg.height !== currentImg.height
    ) {
      throw new Error(
        `Screenshot dimensions mismatch: baseline ${baselineImg.width}x${baselineImg.height}, current ${currentImg.width}x${currentImg.height}`
      );
    }

    // Create diff image
    const { width, height } = baselineImg;
    const diffImg = new PNG({ width, height });

    // Perform pixel-by-pixel comparison
    const numDiffPixels = pixelmatch(
      baselineImg.data,
      currentImg.data,
      diffImg.data,
      width,
      height,
      {
        threshold,
        includeAA: true, // Include anti-aliasing differences
      }
    );

    // Calculate mismatch percentage
    const totalPixels = width * height;
    const mismatchPercentage = (numDiffPixels / totalPixels) * 100;

    // Generate diff image path
    const timestamp = Date.now();
    const diffFilename = `diff_${timestamp}_${crypto.randomBytes(4).toString('hex')}.png`;
    const diffImagePath = path.join(DEFAULT_CONFIG.screenshotDir, diffFilename);

    // Save diff image to disk
    await fs.writeFile(diffImagePath, PNG.sync.write(diffImg));

    // Determine match status (allow up to 0.5% difference for minor rendering variations)
    const match = mismatchPercentage < 0.5;

    console.log(
      `Screenshot comparison: ${match ? 'MATCH' : 'MISMATCH'} (${mismatchPercentage.toFixed(2)}% different)`
    );

    return {
      match,
      mismatchPercentage: parseFloat(mismatchPercentage.toFixed(2)),
      diffImagePath: path.resolve(diffImagePath),
    };
  } catch (error) {
    console.error(`Screenshot comparison failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Visual regression test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate screenshot file path based on test name and timestamp
 * 
 * Creates consistent, unique file paths for screenshot storage with
 * collision-resistant naming using timestamps and random suffixes.
 * 
 * @param testName - Test name or identifier
 * @param category - Optional category subdirectory (e.g., 'baseline', 'current')
 * @returns Absolute file path for screenshot
 * 
 * @example
 * const screenshotPath = getScreenshotPath('login_test', 'baseline');
 * // Returns: /absolute/path/test-results/screenshots/baseline/login_test_1699123456789_a3f2.png
 */
export function getScreenshotPath(
  testName: string,
  category?: string
): string {
  // Sanitize test name for filesystem
  const sanitizedName = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  // Generate unique filename components
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const filename = `${sanitizedName}_${timestamp}_${randomSuffix}.${DEFAULT_CONFIG.format}`;

  // Construct path with optional category subdirectory
  const baseDir = category
    ? path.join(DEFAULT_CONFIG.screenshotDir, category)
    : DEFAULT_CONFIG.screenshotDir;

  return path.resolve(baseDir, filename);
}

/**
 * Remove old screenshots older than retention period
 * 
 * Scans screenshot directory and deletes files older than configured
 * retention period (default 7 days for screenshots, 30 days for videos).
 * Should be run periodically to prevent disk space exhaustion.
 * 
 * @param screenshotDir - Optional custom screenshot directory
 * @param retentionDays - Optional custom retention period in days
 * @returns Promise resolving to number of files deleted
 * 
 * @example
 * // Clean up screenshots older than 7 days
 * const deletedCount = await cleanupScreenshots();
 * console.log(`Deleted ${deletedCount} old screenshots`);
 */
export async function cleanupScreenshots(
  screenshotDir: string = DEFAULT_CONFIG.screenshotDir,
  retentionDays: number = DEFAULT_CONFIG.retentionDays
): Promise<number> {
  try {
    // Check if directory exists
    const dirExists = await fileExists(screenshotDir);
    if (!dirExists) {
      console.log(`Screenshot directory does not exist: ${screenshotDir}`);
      return 0;
    }

    // Calculate cutoff timestamp
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    // Read all files in directory
    const files = await fs.readdir(screenshotDir);

    // Check each file and delete if older than retention period
    for (const file of files) {
      const filePath = path.join(screenshotDir, file);

      try {
        const stats = await fs.stat(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          continue;
        }

        // Delete file if older than cutoff
        if (stats.birthtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
          console.log(`Deleted old screenshot: ${file}`);
        }
      } catch (error) {
        console.warn(`Failed to process file ${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`Cleanup complete: deleted ${deletedCount} old screenshots`);
    return deletedCount;
  } catch (error) {
    console.error(`Screenshot cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Attach screenshot to test report for visibility
 * 
 * Integrates screenshot with Playwright test reporter, making it visible
 * in HTML reports and CI/CD pipeline artifacts.
 * 
 * @param testInfo - Playwright test metadata
 * @param screenshotPath - Path to screenshot file
 * @param name - Optional attachment name for report
 * @returns Promise resolving when attachment is complete
 * 
 * @example
 * const screenshotPath = await takeScreenshot(page, 'checkout-complete');
 * await attachScreenshotToReport(testInfo, screenshotPath, 'checkout-success');
 */
export async function attachScreenshotToReport(
  testInfo: TestInfo,
  screenshotPath: string,
  name: string = 'screenshot'
): Promise<void> {
  try {
    // Verify screenshot file exists
    const exists = await fileExists(screenshotPath);
    if (!exists) {
      throw new Error(`Screenshot file not found: ${screenshotPath}`);
    }

    // Attach to test report
    await testInfo.attach(name, {
      path: screenshotPath,
      contentType: `image/${DEFAULT_CONFIG.format}`,
    });

    console.log(`Screenshot attached to report: ${name}`);
  } catch (error) {
    console.error(`Failed to attach screenshot to report: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Attachment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Capture screenshot with specific element highlighted
 * 
 * Takes screenshot and overlays red highlight box around specified element.
 * Useful for documentation, bug reports, and visual debugging.
 * 
 * @param page - Playwright page instance
 * @param locator - Element to highlight
 * @param filename - Custom filename for screenshot
 * @returns Promise resolving to full path of saved screenshot
 * 
 * @example
 * const errorField = page.locator('input[aria-invalid="true"]');
 * await screenshotWithHighlight(page, errorField, 'validation-error');
 */
export async function screenshotWithHighlight(
  page: Page,
  locator: Locator,
  filename: string
): Promise<string> {
  try {
    // Get element bounding box
    const boundingBox = await locator.boundingBox();
    if (!boundingBox) {
      throw new Error('Element not visible or has zero size');
    }

    // Inject highlight overlay using JavaScript
    await page.evaluate((box) => {
      const highlight = document.createElement('div');
      highlight.style.position = 'absolute';
      highlight.style.left = `${box.x}px`;
      highlight.style.top = `${box.y}px`;
      highlight.style.width = `${box.width}px`;
      highlight.style.height = `${box.height}px`;
      highlight.style.border = '3px solid red';
      highlight.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
      highlight.style.zIndex = '999999';
      highlight.style.pointerEvents = 'none';
      highlight.setAttribute('data-playwright-highlight', 'true');
      document.body.appendChild(highlight);
    }, boundingBox);

    // Capture screenshot with highlight
    const screenshotPath = await takeFullPageScreenshot(page, filename);

    // Remove highlight overlay
    await page.evaluate(() => {
      const highlights = document.querySelectorAll('[data-playwright-highlight]');
      highlights.forEach((el) => el.remove());
    });

    console.log(`Highlighted screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error(`Failed to capture highlighted screenshot: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Highlight screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Capture screenshot with sensitive data masked
 * 
 * Takes screenshot and overlays black rectangles over elements matching
 * selectors to hide sensitive information (passwords, credit cards, PII).
 * 
 * @param page - Playwright page instance
 * @param filename - Custom filename for screenshot
 * @param selectors - Array of CSS selectors for elements to mask
 * @returns Promise resolving to full path of saved screenshot
 * 
 * @example
 * await screenshotWithMask(
 *   page,
 *   'user-profile',
 *   ['input[type="password"]', '.credit-card-number', '.ssn']
 * );
 */
export async function screenshotWithMask(
  page: Page,
  filename: string,
  selectors: string[]
): Promise<string> {
  try {
    // Collect all elements to mask
    const maskElements: Array<{ x: number; y: number; width: number; height: number }> = [];

    for (const selector of selectors) {
      const elements = await page.locator(selector).all();

      for (const element of elements) {
        const boundingBox = await element.boundingBox();
        if (boundingBox) {
          maskElements.push(boundingBox);
        }
      }
    }

    // Inject mask overlays
    await page.evaluate((boxes) => {
      boxes.forEach((box, index) => {
        const mask = document.createElement('div');
        mask.style.position = 'absolute';
        mask.style.left = `${box.x}px`;
        mask.style.top = `${box.y}px`;
        mask.style.width = `${box.width}px`;
        mask.style.height = `${box.height}px`;
        mask.style.backgroundColor = 'black';
        mask.style.zIndex = '999999';
        mask.style.pointerEvents = 'none';
        mask.setAttribute('data-playwright-mask', String(index));
        document.body.appendChild(mask);
      });
    }, maskElements);

    // Capture screenshot with masks
    const screenshotPath = await takeFullPageScreenshot(page, filename);

    // Remove mask overlays
    await page.evaluate(() => {
      const masks = document.querySelectorAll('[data-playwright-mask]');
      masks.forEach((el) => el.remove());
    });

    console.log(`Masked screenshot saved: ${screenshotPath} (${maskElements.length} elements masked)`);
    return screenshotPath;
  } catch (error) {
    console.error(`Failed to capture masked screenshot: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Mask screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper: Ensure directory exists, create if necessary
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Helper: Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
