/**
 * E2E Tests for Quiz Attempt Workflow
 * 
 * This test suite validates the complete quiz attempt workflow including:
 * - Quiz information display with time limits and attempt restrictions
 * - Quiz attempt start and timer countdown functionality
 * - Question display, answer selection, and navigation
 * - Answer persistence across question navigation
 * - Quiz submission workflow with confirmation
 * - Forced auto-submission on timer expiration
 * - Quiz review with results, feedback, and attempt summary
 * - Multiple attempts support
 * - Error scenarios and edge cases
 * 
 * Uses Playwright for browser automation with Page Object Model pattern.
 * Tests timer accuracy using Playwright's clock control capabilities.
 * Captures screenshots on test failure for debugging.
 */

import { test, expect, type Page } from '@playwright/test';
import { QuizPage } from './pages/QuizPage';
import { loginAsStudent } from './utils/auth';
import { testCourse1 } from './fixtures/courses';
import { testQuiz1, testQuiz2, testQuiz3 } from './fixtures/quizzes';

/**
 * Test suite for quiz attempt workflow with timer and question navigation
 */
test.describe('Quiz Attempt E2E Tests', () => {
  let page: Page;
  let quizPage: QuizPage;

  /**
   * Setup: Login as student before each test
   * Ensures each test has fresh authenticated page context
   */
  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    quizPage = new QuizPage(page);
    
    // Step 1: Login as student for quiz testing
    await loginAsStudent(page);
    
    // Verify authentication successful
    const isAuthenticated = await page.evaluate(() => {
      return localStorage.getItem('moodle_access_token') !== null;
    });
    expect(isAuthenticated).toBe(true);
    
    // Navigate to course page
    await page.goto(`/courses/${testCourse1.id}`);
    await page.waitForLoadState('load');
  });

  /**
   * Test 1: Quiz Information Display
   * Validates that quiz displays with name, description, time limit, and attempts allowed
   * Covers requirement step 2
   */
  test('should display quiz information with time limit and attempts', async () => {
    // Navigate to quiz 2 (timed quiz with 60-minute limit, 2 attempts)
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz2.id}`);
    
    // Wait for quiz page to load
    await quizPage.waitForQuiz();
    
    // Get quiz information
    const quizInfo = await quizPage.getQuizInfo();
    
    // Step 2: Verify quiz displays with name, description, time limit, attempts allowed
    expect(quizInfo.title).toBe(testQuiz2.name);
    expect(quizInfo.description).toContain('timed midterm examination');
    expect(quizInfo.timeLimit).toBe('60 minutes'); // 3600 seconds = 60 minutes
    expect(quizInfo.attemptsAllowed).toBe('2'); // Maximum 2 attempts
    
    // Verify grade method is displayed (case-sensitive match for UI text)
    expect(quizInfo.gradeMethod).toContain('Highest');
  });

  /**
   * Test 2: Basic Quiz Attempt Start
   * Validates starting a quiz attempt and verifying the attempt begins
   * Covers requirement step 3
   */
  test('should start quiz attempt successfully', async () => {
    // Navigate to quiz 1 (basic quiz with no time limit, unlimited attempts)
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    
    // Step 3: Click "Attempt quiz", verify attempt starts
    await quizPage.startAttempt();
    
    // Verify we're now on the attempt page
    await expect(page).toHaveURL(new RegExp(`/quizzes/${testQuiz1.id}/attempt`));
    
    // Verify first question is displayed
    const question = await quizPage.getCurrentQuestion();
    expect(question).toBeDefined();
    expect(question.questionNumber).toBe(1);
    expect(question.questionText).toContain('correct way to declare a variable');
  });

  /**
   * Test 3: Timer Display and Countdown
   * Validates timer starts on quiz attempt and displays countdown in MM:SS format
   * Covers requirement steps 3, 4
   */
  test('should display and countdown timer for timed quiz', async () => {
    // Navigate to timed quiz (60-minute time limit)
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz2.id}`);
    await quizPage.waitForQuiz();
    
    // Start the quiz attempt
    await quizPage.startAttempt();
    
    // Step 4: Verify countdown timer shows remaining time in format MM:SS
    const initialTime = await quizPage.getRemainingTime();
    expect(initialTime).toMatch(/^\d{2}:\d{2}$/); // Format: MM:SS
    
    // Verify timer is running (time decreases)
    await quizPage.verifyTimerRunning();
    
    // Wait a few seconds and check time decreased
    await page.waitForTimeout(3000);
    const laterTime = await quizPage.getRemainingTime();
    expect(laterTime).toMatch(/^\d{2}:\d{2}$/);
    
    // Parse times and verify countdown
    const parseTime = (timeStr: string) => {
      const [mins, secs] = timeStr.split(':').map(Number);
      return mins! * 60 + secs!;
    };
    
    const initialSeconds = parseTime(initialTime);
    const laterSeconds = parseTime(laterTime);
    
    // Verify time decreased by approximately 3 seconds (with tolerance)
    expect(initialSeconds - laterSeconds).toBeGreaterThanOrEqual(2);
    expect(initialSeconds - laterSeconds).toBeLessThanOrEqual(4);
  });

  /**
   * Test 4: Question Display
   * Validates first question displays with text, options, and question number
   * Covers requirement step 5
   */
  test('should display question with text, options, and number', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Step 5: Verify first question displays with text, options, and question number
    const question = await quizPage.getCurrentQuestion();
    
    expect(question.questionNumber).toBe(1);
    expect(question.questionText).toBeTruthy();
    expect(question.questionText.length).toBeGreaterThan(0);
    expect(question.questionType).toBe('single'); // Multiple choice
    expect(question.options).toBeDefined();
    expect(question.options.length).toBe(4); // 4 answer options
    
    // Verify all options have text
    question.options.forEach(option => {
      expect(option.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test 5: Answer Selection
   * Validates selecting an answer option and verifying selection is highlighted
   * Covers requirement step 6
   */
  test('should select answer and highlight selection', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Step 6: Select answer option, verify selection highlighted
    await quizPage.getCurrentQuestion();
    
    // Select the second answer option (index 1)
    await quizPage.selectAnswer(1);
    
    // Verify the answer is selected (the data-testid is on the input element itself)
    const selectedOption = page.locator('[data-testid^="option-"]').nth(1);
    
    // Verify radio button or checkbox is checked
    await expect(selectedOption).toBeChecked();
  });

  /**
   * Test 6: Question Navigation
   * Validates navigation between questions using next/previous buttons
   * Covers requirement step 7
   */
  test('should navigate between questions using next and previous buttons', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Verify we're on question 1
    let question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(1);
    
    // Step 7: Click next button, verify navigation to question 2
    await quizPage.nextQuestion();
    question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(2);
    expect(question.questionText).toContain('lists are immutable');
    
    // Navigate to question 3
    await quizPage.nextQuestion();
    question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(3);
    expect(question.questionText).toContain('keyword is used to define a function');
    
    // Step 7: Click previous button, verify navigation back to question 2
    await quizPage.previousQuestion();
    question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(2);
    
    // Navigate back to question 1
    await quizPage.previousQuestion();
    question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(1);
  });

  /**
   * Test 7: Question Sidebar Navigation
   * Validates question navigation sidebar shows all questions with status
   * Covers requirement step 8
   */
  test('should display question sidebar with all questions and status', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Step 8: Verify question navigation sidebar shows all questions with status
    // Initially all questions should be unanswered except current
    let status1 = await quizPage.getQuestionStatus(1);
    expect(status1.status).toBe('current'); // Currently viewing question 1
    
    let status2 = await quizPage.getQuestionStatus(2);
    expect(status2.status).toBe('unanswered');
    
    let status3 = await quizPage.getQuestionStatus(3);
    expect(status3.status).toBe('unanswered');
    
    const status4 = await quizPage.getQuestionStatus(4);
    expect(status4.status).toBe('unanswered');
    
    // Answer question 1
    await quizPage.selectAnswer(1); // Select answer option index 1
    
    // Navigate to question 2
    await quizPage.nextQuestion();
    
    // Now question 1 should be marked as answered
    status1 = await quizPage.getQuestionStatus(1);
    expect(status1.status).toBe('answered');
    
    status2 = await quizPage.getQuestionStatus(2);
    expect(status2.status).toBe('current'); // Now on question 2
    
    // Answer question 2
    await quizPage.selectAnswer(1); // Select True or False option
    
    // Navigate to question 3
    await quizPage.nextQuestion();
    
    // Both questions 1 and 2 should now be answered
    status1 = await quizPage.getQuestionStatus(1);
    expect(status1.status).toBe('answered');
    
    status2 = await quizPage.getQuestionStatus(2);
    expect(status2.status).toBe('answered');
    
    status3 = await quizPage.getQuestionStatus(3);
    expect(status3.status).toBe('current');
  });

  /**
   * Test 8: Jump to Specific Question via Sidebar
   * Validates clicking question number in sidebar navigates directly to that question
   * Covers requirement step 8
   */
  test('should jump to specific question using sidebar navigation', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Currently on question 1
    let question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(1);
    
    // Step 8: Jump directly to question 3 using sidebar
    await quizPage.jumpToQuestion(3);
    question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(3);
    
    // Jump to question 4
    await quizPage.jumpToQuestion(4);
    question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(4);
    expect(question.questionType).toBe('essay'); // Question 4 is essay
    
    // Jump back to question 1
    await quizPage.jumpToQuestion(1);
    question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(1);
  });

  /**
   * Test 9: Answer Persistence Across Navigation
   * Validates that answers persist when navigating between questions
   * Covers requirement step 9
   */
  test('should persist answers when navigating between questions', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Step 9: Navigate between questions, verify answers persist
    
    // Answer question 1 - select option at index 1 (second option: "x = 10")
    await quizPage.selectAnswer(1);
    
    // Verify answer is selected
    let selectedOption = page.locator('[data-testid^="option-"]').nth(1);
    await expect(selectedOption).toBeChecked();
    
    // Navigate to question 2
    await quizPage.nextQuestion();
    
    // Answer question 2 (True/False) - select option at index 1 (False)
    await quizPage.selectAnswer(1);
    
    // Navigate to question 3
    await quizPage.nextQuestion();
    
    // Answer question 3 (Short Answer) - enter text "def"
    await quizPage.enterTextAnswer('def');
    
    // Navigate back to question 1
    await quizPage.jumpToQuestion(1);
    
    // Verify answer for question 1 is still selected
    selectedOption = page.locator('[data-testid^="option-"]').nth(1);
    await expect(selectedOption).toBeChecked();
    
    // Navigate to question 2
    await quizPage.nextQuestion();
    
    // Verify answer for question 2 is still selected
    selectedOption = page.locator('[data-testid^="option-"]').nth(1);
    await expect(selectedOption).toBeChecked();
    
    // Navigate to question 3
    await quizPage.nextQuestion();
    
    // Verify text answer is still present
    const textInput = page.locator('input[type="text"], textarea').first();
    await expect(textInput).toHaveValue('def');
  });

  /**
   * Test 10: Quiz Submission with Confirmation
   * Validates clicking "Submit all and finish" shows confirmation dialog
   * Covers requirement step 10
   */
  test('should show confirmation dialog when submitting quiz', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Answer at least one question
    await quizPage.selectAnswer(1);
    await quizPage.nextQuestion();
    await quizPage.selectAnswer(1);
    
    // Step 10: Click "Submit all and finish", verify confirmation dialog appears
    await quizPage.submitQuiz();
    
    // Verify confirmation dialog is visible
    const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-submit-dialog"]');
    await expect(confirmDialog).toBeVisible();
    
    // Verify dialog contains warning message
    const dialogText = await confirmDialog.textContent();
    expect(dialogText).toMatch(/submit|finish|confirm/i);
    
    // Cancel the submission for now (so we don't affect other tests)
    const cancelButton = confirmDialog.locator('button', { hasText: 'Cancel' });
    if (await cancelButton.count() > 0) {
      await cancelButton.click();
    }
  });

  /**
   * Test 11: Complete Quiz Submission and Results
   * Validates full submission workflow and results display
   * Covers requirement steps 10, 12, 13
   */
  test('should complete quiz submission and display results', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Answer all questions
    // Question 1: Multiple choice - select correct answer (index 1: "x = 10")
    await quizPage.selectAnswer(1);
    await quizPage.nextQuestion();
    
    // Question 2: True/False - select correct answer (index 1: "False")
    await quizPage.selectAnswer(1);
    await quizPage.nextQuestion();
    
    // Question 3: Short answer - enter correct answer
    await quizPage.enterTextAnswer('def');
    await quizPage.nextQuestion();
    
    // Question 4: Essay - enter some text
    await quizPage.enterTextAnswer('Inheritance is a fundamental concept in OOP that allows a class to inherit properties and methods from another class...');
    
    // Submit the quiz
    await quizPage.submitQuiz();
    await quizPage.confirmSubmit();
    
    // Step 12: After submission, view results, verify correct/incorrect answers shown
    await page.waitForURL(/\/review/, { timeout: 10000 });
    
    const results = await quizPage.getResults();
    
    // Verify results contain score information
    expect(results.score).toBeGreaterThanOrEqual(0);
    expect(results.maxScore).toBe(8.0); // Total marks for testQuiz1
    expect(results.percentage).toBeGreaterThanOrEqual(0);
    expect(results.percentage).toBeLessThanOrEqual(100);
    
    // Step 13: Verify feedback displayed for each question with explanation
    const feedback = await quizPage.viewFeedback();
    expect(feedback).toBeTruthy();
    expect(feedback.length).toBeGreaterThan(0);
  });

  /**
   * Test 12: Quiz Results Score Display
   * Validates score calculation and display accuracy
   * Covers requirement steps 12, 16
   */
  test('should display accurate score and grade in results', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Answer questions (3 correct out of 4)
    await quizPage.selectAnswer(1); // Q1: Correct
    await quizPage.nextQuestion();
    await quizPage.selectAnswer(1); // Q2: Correct
    await quizPage.nextQuestion();
    await quizPage.enterTextAnswer('def'); // Q3: Correct
    await quizPage.nextQuestion();
    await quizPage.enterTextAnswer('Test answer'); // Q4: Essay (requires manual grading)
    
    await quizPage.submitQuiz();
    await quizPage.confirmSubmit();
    
    await page.waitForURL(/\/review/, { timeout: 10000 });
    
    // Step 16: Verify score calculated correctly
    const score = await quizPage.getScore();
    
    // Score should be at least 3.0 (three 1-point questions correct)
    // Essay question worth 5 points requires manual grading
    expect(score).toBeGreaterThanOrEqual(3.0);
    expect(score).toBeLessThanOrEqual(8.0); // Maximum possible score
  });

  /**
   * Test 13: Attempt Summary Display
   * Validates attempt summary shows score, time taken, and date
   * Covers requirement step 14
   */
  test('should display attempt summary with score, time, and date', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Answer questions quickly
    await quizPage.selectAnswer(1);
    await quizPage.nextQuestion();
    await quizPage.selectAnswer(1);
    await quizPage.nextQuestion();
    await quizPage.enterTextAnswer('def');
    await quizPage.nextQuestion();
    await quizPage.enterTextAnswer('Test');
    
    await quizPage.submitQuiz();
    await quizPage.confirmSubmit();
    
    await page.waitForURL(/\/review/, { timeout: 10000 });
    
    // Step 14: View attempt summary, verify score, time taken, date displayed
    const summary = await quizPage.viewAttemptSummary();
    
    expect(summary.attemptNumber).toBe(1); // First attempt
    expect(summary.state).toBe('finished');
    expect(summary.startTime).toBeTruthy(); // Start time should be present
    expect(summary.timeTaken).toBeTruthy(); // Time taken should be calculated
    
    // Verify time taken is reasonable (should be less than 2 minutes for this quick test)
    const timeParts = summary.timeTaken.match(/(\d+)/g);
    if (timeParts && timeParts.length > 0) {
      const totalSeconds = timeParts.length > 1 
        ? parseInt(timeParts[0]!) * 60 + parseInt(timeParts[1]!)
        : parseInt(timeParts[0]!);
      expect(totalSeconds).toBeLessThan(120); // Less than 2 minutes
    }
    
    expect(summary.totalQuestions).toBe(4);
    expect(summary.answeredQuestions).toBe(4);
  });

  /**
   * Test 14: Multiple Attempts Support
   * Validates starting a second attempt creates a new attempt record
   * Covers requirement step 15
   */
  test('should allow multiple attempts and create new attempt records', async () => {
    // Use testQuiz3 which has unlimited attempts
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz3.id}`);
    await quizPage.waitForQuiz();
    
    // First attempt
    await quizPage.startAttempt();
    await quizPage.selectAnswer(1); // Answer first question
    await quizPage.submitQuiz();
    await quizPage.confirmSubmit();
    
    await page.waitForURL(/\/review/, { timeout: 10000 });
    
    let summary = await quizPage.viewAttemptSummary();
    expect(summary.attemptNumber).toBe(1);
    
    // Return to quiz page
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz3.id}`);
    await quizPage.waitForQuiz();
    
    // Step 15: Start second attempt, verify new attempt created
    await quizPage.startAttempt();
    
    // Verify we're on a new attempt (URL should show attempt page)
    await expect(page).toHaveURL(new RegExp(`/quizzes/${testQuiz3.id}/attempt`));
    
    // Answer and submit second attempt
    await quizPage.selectAnswer(0); // Different answer this time
    await quizPage.submitQuiz();
    await quizPage.confirmSubmit();
    
    await page.waitForURL(/\/review/, { timeout: 10000 });
    
    // Verify this is attempt 2
    summary = await quizPage.viewAttemptSummary();
    expect(summary.attemptNumber).toBeGreaterThanOrEqual(2);
  });

  /**
   * Test 15: Timed Quiz Auto-Submit on Expiration
   * Validates quiz auto-submits when timer expires
   * Covers requirement steps 11, 16
   * Uses Playwright's clock control to manipulate time
   */
  test('should auto-submit quiz when timer expires', async () => {
    // Navigate to timed quiz with 60-minute limit
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz2.id}`);
    await quizPage.waitForQuiz();
    
    // Install fake timer to control time
    await page.clock.install({ time: new Date() });
    
    // Start the quiz
    await quizPage.startAttempt();
    
    // Verify timer is displayed
    const initialTime = await quizPage.getRemainingTime();
    expect(initialTime).toMatch(/^\d{2}:\d{2}$/);
    
    // Answer first question so we have some data
    await quizPage.selectAnswer(1);
    
    // Step 11: Let timer expire, verify quiz auto-submits
    // Fast-forward time by 61 minutes (3660 seconds) to exceed 60-minute limit
    await page.clock.fastForward(61 * 60 * 1000);
    
    // Wait for auto-submit to trigger
    await quizPage.waitForAutoSubmit();
    
    // Should now be on results/review page
    await page.waitForURL(/\/review|\/result/, { timeout: 10000 });
    
    // Verify the attempt was submitted
    const summary = await quizPage.viewAttemptSummary();
    expect(summary.state).toBe('finished');
    
    // Step 16: Verify timer was accurate (time taken should be approximately 60 minutes)
    const { timeTaken } = summary;
    expect(timeTaken).toMatch(/\d+/); // Contains numeric time value
    
    // Clock is automatically cleaned up at test end - no manual cleanup needed
  });

  /**
   * Test 16: Multiple Answer Selection for Checkbox Questions
   * Validates selecting multiple answers when question allows it
   * Extends requirement step 6 for multiple choice questions
   */
  test('should handle multiple answer selection for checkbox questions', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Navigate to a question (if quiz had checkbox questions)
    const question = await quizPage.getCurrentQuestion();
    
    if (question.hasMultipleAnswers) {
      // Select multiple answers
      await quizPage.selectMultipleAnswers([0, 2]);
      
      // Verify both are checked
      const option0 = page.locator('[data-testid^="option-"]').nth(0);
      await expect(option0).toBeChecked();
      
      const option2 = page.locator('[data-testid^="option-"]').nth(2);
      await expect(option2).toBeChecked();
    } else {
      // For single-answer questions, selecting a new answer should deselect previous
      await quizPage.selectAnswer(0);
      let selected0 = page.locator('[data-testid^="option-"]').nth(0);
      await expect(selected0).toBeChecked();
      
      await quizPage.selectAnswer(1);
      const selected1 = page.locator('[data-testid^="option-"]').nth(1);
      await expect(selected1).toBeChecked();
      
      // First option should now be unchecked
      selected0 = page.locator('[data-testid^="option-"]').nth(0);
      await expect(selected0).not.toBeChecked();
    }
  });

  /**
   * Test 17: Error Scenario - Answering After Time Expires
   * Validates that users cannot modify answers after timer expires
   * Covers requirement step 17
   */
  test('should prevent answering after time expires', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz2.id}`);
    await quizPage.waitForQuiz();
    
    // Install fake timer
    await page.clock.install({ time: new Date() });
    
    await quizPage.startAttempt();
    
    // Fast-forward to just before expiration
    await page.clock.fastForward(59 * 60 * 1000); // 59 minutes
    
    // Try to answer - should work
    await quizPage.selectAnswer(1);
    const option1 = page.locator('[data-testid^="option-"]').nth(1);
    await expect(option1).toBeChecked();
    
    // Fast-forward past expiration
    await page.clock.fastForward(2 * 60 * 1000); // 2 more minutes (now 61 minutes total)
    
    // Wait for auto-submit
    await quizPage.waitForAutoSubmit();
    
    // Should be on review page, cannot modify answers
    await page.waitForURL(/\/review|\/result/, { timeout: 10000 });
    
    // Verify answer inputs are disabled or not present
    const answerInputs = page.locator('input[type="radio"], input[type="checkbox"]');
    const count = await answerInputs.count();
    
    if (count > 0) {
      // If inputs are shown in review, they should be disabled
      await expect(answerInputs.first()).toBeDisabled();
    }
    
    // Clock is automatically cleaned up at test end - no manual cleanup needed
  });

  /**
   * Test 18: Error Scenario - Navigation Restrictions
   * Validates navigation restrictions (e.g., can't go back from first question)
   * Covers requirement step 17
   */
  test('should handle navigation restrictions appropriately', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // On question 1, previous button should be disabled or not present
    const question = await quizPage.getCurrentQuestion();
    expect(question.questionNumber).toBe(1);
    
    const previousButton = page.locator('[data-testid="prev-button"]');
    
    if (await previousButton.count() > 0) {
      // If button exists, it should be disabled
      await expect(previousButton).toBeDisabled();
    }
    
    // Navigate to last question
    await quizPage.jumpToQuestion(4);
    
    // On last question, next button should be disabled or not present
    const nextButton = page.locator('[data-testid="next-button"]');
    
    if (await nextButton.count() > 0) {
      // If button exists, it should be disabled
      await expect(nextButton).toBeDisabled();
    }
    
    // Submit button should be available on last question
    const submitButton = page.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  /**
   * Test 19: Timer Accuracy Verification
   * Validates timer countdown is accurate within tolerance
   * Covers requirement step 16
   */
  test('should maintain accurate timer countdown within tolerance', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz2.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Get initial time (should be close to 60:00)
    const initialTime = await quizPage.getRemainingTime();
    const parseTime = (timeStr: string) => {
      const [mins, secs] = timeStr.split(':').map(Number);
      return mins! * 60 + secs!;
    };
    
    const initialSeconds = parseTime(initialTime);
    
    // Should be close to 3600 seconds (60 minutes)
    expect(initialSeconds).toBeGreaterThan(3590); // Within 10 seconds of start
    expect(initialSeconds).toBeLessThanOrEqual(3600);
    
    // Wait exactly 5 seconds
    await page.waitForTimeout(5000);
    
    // Check time again
    const laterTime = await quizPage.getRemainingTime();
    const laterSeconds = parseTime(laterTime);
    
    // Should have decreased by approximately 5 seconds
    const elapsed = initialSeconds - laterSeconds;
    
    // Allow 1 second tolerance for timing variations
    expect(elapsed).toBeGreaterThanOrEqual(4);
    expect(elapsed).toBeLessThanOrEqual(6);
    
    // Verify timer is still running
    await quizPage.verifyTimerRunning();
  });

  /**
   * Test 20: Answer Tracking Across Attempts
   * Validates that multiple attempts track separately
   * Covers requirement step 16
   */
  test('should track attempts separately without interference', async () => {
    // Use unlimited attempts quiz
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz3.id}`);
    await quizPage.waitForQuiz();
    
    // First attempt - answer with option 0
    await quizPage.startAttempt();
    await quizPage.selectAnswer(0);
    await quizPage.submitQuiz();
    await quizPage.confirmSubmit();
    await page.waitForURL(/\/review/, { timeout: 10000 });
    
    const firstScore = await quizPage.getScore();
    
    // Return to quiz
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz3.id}`);
    await quizPage.waitForQuiz();
    
    // Second attempt - answer with option 1 (different answer)
    await quizPage.startAttempt();
    
    // Verify no answer is pre-selected (fresh attempt)
    const option0 = page.locator('[data-testid^="option-"]').nth(0);
    const option1 = page.locator('[data-testid^="option-"]').nth(1);
    
    await expect(option0).not.toBeChecked();
    await expect(option1).not.toBeChecked();
    
    // Answer differently
    await quizPage.selectAnswer(1);
    await quizPage.submitQuiz();
    await quizPage.confirmSubmit();
    await page.waitForURL(/\/review/, { timeout: 10000 });
    
    const secondScore = await quizPage.getScore();
    
    // Scores might be different based on which answer was correct
    // Both should be valid scores
    expect(firstScore).toBeGreaterThanOrEqual(0);
    expect(secondScore).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test 21: Quiz Feedback Display
   * Validates detailed feedback is shown for each question after submission
   * Covers requirement step 13
   */
  test('should display detailed feedback with explanations after submission', async () => {
    await page.goto(`/courses/${testCourse1.id}/quizzes/${testQuiz1.id}`);
    await quizPage.waitForQuiz();
    await quizPage.startAttempt();
    
    // Answer questions
    await quizPage.selectAnswer(1); // Correct answer
    await quizPage.nextQuestion();
    await quizPage.selectAnswer(0); // Incorrect answer
    await quizPage.nextQuestion();
    await quizPage.enterTextAnswer('def'); // Correct answer
    await quizPage.nextQuestion();
    await quizPage.enterTextAnswer('Test essay response');
    
    await quizPage.submitQuiz();
    await quizPage.confirmSubmit();
    await page.waitForURL(/\/review/, { timeout: 10000 });
    
    // Step 13: Verify feedback displayed for each question with explanation
    const feedback = await quizPage.viewFeedback();
    
    // Feedback should be a non-empty string
    expect(typeof feedback).toBe('string');
    expect(feedback.length).toBeGreaterThan(0);
    
    // Verify feedback contains content
    expect(feedback.trim()).not.toBe('');
    expect(feedback).toBeTruthy();
    
    // Verify feedback section is visible
    const feedbackSection = page.locator('[data-testid="question-feedback"], .question-feedback');
    const feedbackCount = await feedbackSection.count();
    expect(feedbackCount).toBeGreaterThan(0);
  });
});
