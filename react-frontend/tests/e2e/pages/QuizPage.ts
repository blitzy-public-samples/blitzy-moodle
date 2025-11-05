import { Page, Locator } from '@playwright/test';

/**
 * Interface representing quiz information displayed on the quiz page.
 */
export interface QuizInfo {
  title: string;
  description: string;
  timeLimit: string | null;
  attemptsAllowed: string;
  gradeMethod: string;
}

/**
 * Interface representing a question in the quiz.
 */
export interface QuestionData {
  questionNumber: number;
  questionText: string;
  questionType: 'single' | 'multiple' | 'text' | 'numerical' | 'essay';
  options: string[];
  hasMultipleAnswers: boolean;
}

/**
 * Interface representing the status of a question in the sidebar.
 */
export interface QuestionStatus {
  questionNumber: number;
  status: 'answered' | 'unanswered' | 'flagged' | 'current';
}

/**
 * Interface representing quiz results after submission.
 */
export interface QuizResults {
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  timeTaken: string;
  feedback: string;
}

/**
 * Interface representing attempt summary information.
 */
export interface AttemptSummary {
  attemptNumber: number;
  startTime: string;
  timeTaken: string;
  state: string;
  totalQuestions: number;
  answeredQuestions: number;
}

/**
 * Page Object Model for Quiz pages in the E2E tests.
 * Encapsulates all interactions with quiz view, attempt, review, and results pages.
 */
export class QuizPage {
  private readonly page: Page;

  // Quiz information locators
  private readonly quizTitle: Locator;
  private readonly quizDescription: Locator;
  private readonly timeLimit: Locator;
  private readonly attemptsAllowed: Locator;

  // Quiz attempt locators
  private readonly attemptButton: Locator;
  private readonly timer: Locator;
  private readonly questionText: Locator;
  // @ts-expect-error - Defined for future use and POM consistency
  private readonly _answerOptions: Locator;

  // Navigation locators
  private readonly nextButton: Locator;
  private readonly previousButton: Locator;
  // @ts-expect-error - Defined for future use and POM consistency
  private readonly _questionSidebar: Locator;

  // Submission locators
  private readonly submitAllButton: Locator;
  private readonly confirmSubmitButton: Locator;

  // Results locators
  // @ts-expect-error - Defined for future use and POM consistency
  private readonly _reviewSection: Locator;
  private readonly resultsSection: Locator;
  private readonly scoreSummary: Locator;
  private readonly feedbackSection: Locator;

  /**
   * Constructor for QuizPage.
   * @param page - Playwright Page object
   */
  constructor(page: Page) {
    this.page = page;

    // Initialize quiz information locators
    this.quizTitle = page.locator('[data-testid="quiz-title"], h1.quiz-title, .quiz-header h1').first();
    this.quizDescription = page.locator('[data-testid="quiz-description"], .quiz-description, .quiz-intro').first();
    this.timeLimit = page.locator('[data-testid="quiz-time-limit"], .quiz-time-limit, .time-limit-info').first();
    this.attemptsAllowed = page.locator('[data-testid="quiz-attempts-allowed"], .attempts-allowed, .attempt-limit-info').first();

    // Initialize quiz attempt locators
    this.attemptButton = page.locator('[data-testid="start-attempt-button"], button:has-text("Attempt quiz"), button:has-text("Continue quiz"), button:has-text("Start attempt")').first();
    this.timer = page.locator('[data-testid="quiz-timer"], .quiz-timer, .countdown-timer, #quiz-timer').first();
    this.questionText = page.locator('[data-testid="question-text"], .qtext, .question-text').first();
    this._answerOptions = page.locator('[data-testid="answer-option"], .answer input[type="radio"], .answer input[type="checkbox"], .answer textarea');

    // Initialize navigation locators
    this.nextButton = page.locator('[data-testid="next-question-button"], button:has-text("Next"), button[name="next"]').first();
    this.previousButton = page.locator('[data-testid="previous-question-button"], button:has-text("Previous"), button[name="previous"]').first();
    this._questionSidebar = page.locator('[data-testid="question-sidebar"], .question-navigation, .qn-buttons, nav.quiz-nav').first();

    // Initialize submission locators
    this.submitAllButton = page.locator('[data-testid="submit-all-button"], button:has-text("Submit all and finish"), button:has-text("Finish attempt"), input[name="finishattempt"]').first();
    this.confirmSubmitButton = page.locator('[data-testid="confirm-submit-button"], button:has-text("Submit all"), button:has-text("Confirm"), .confirmation-dialog button:has-text("Yes")').first();

    // Initialize results locators
    this._reviewSection = page.locator('[data-testid="quiz-review"], .quiz-review, .review-container').first();
    this.resultsSection = page.locator('[data-testid="quiz-results"], .quiz-results, .results-summary').first();
    this.scoreSummary = page.locator('[data-testid="score-summary"], .grade-summary, .score-display').first();
    this.feedbackSection = page.locator('[data-testid="quiz-feedback"], .quiz-feedback, .feedback-section').first();
  }

  /**
   * Wait for the quiz page to load completely.
   * @param timeout - Optional timeout in milliseconds (default: 30000)
   */
  async waitForQuiz(timeout: number = 30000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
    await this.quizTitle.waitFor({ state: 'visible', timeout });
  }

  /**
   * Get quiz information from the quiz page.
   * @returns Promise resolving to QuizInfo object
   */
  async getQuizInfo(): Promise<QuizInfo> {
    const title = await this.quizTitle.textContent() || '';
    const description = await this.quizDescription.textContent() || '';
    
    let timeLimit: string | null = null;
    try {
      const timeLimitText = await this.timeLimit.textContent({ timeout: 5000 });
      timeLimit = timeLimitText || null;
    } catch {
      // Time limit not displayed or not set
      timeLimit = null;
    }

    let attemptsAllowed = 'Unlimited';
    try {
      const attemptsText = await this.attemptsAllowed.textContent({ timeout: 5000 });
      attemptsAllowed = attemptsText || 'Unlimited';
    } catch {
      // Attempts info not displayed
    }

    return {
      title: title.trim(),
      description: description.trim(),
      timeLimit,
      attemptsAllowed: attemptsAllowed.trim(),
      gradeMethod: 'Highest grade', // Default value
    };
  }

  /**
   * Start a quiz attempt by clicking the attempt button.
   */
  async startAttempt(): Promise<void> {
    await this.attemptButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.attemptButton.click();
    
    // Wait for the first question to load
    await this.page.waitForLoadState('networkidle');
    await this.questionText.waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * Get the remaining time from the quiz timer.
   * @returns Promise resolving to remaining time string (e.g., "10:30")
   */
  async getRemainingTime(): Promise<string> {
    try {
      await this.timer.waitFor({ state: 'visible', timeout: 5000 });
      const timerText = await this.timer.textContent();
      return timerText?.trim() || '00:00';
    } catch {
      return '00:00';
    }
  }

  /**
   * Get information about the current question being displayed.
   * @returns Promise resolving to QuestionData object
   */
  async getCurrentQuestion(): Promise<QuestionData> {
    const questionText = await this.questionText.textContent() || '';
    
    // Determine question number from URL or navigation
    const url = this.page.url();
    const pageMatch = url.match(/page=(\d+)/);
    const questionNumber = pageMatch && pageMatch[1] ? parseInt(pageMatch[1], 10) + 1 : 1;

    // Determine question type by inspecting answer options
    const radioInputs = await this.page.locator('.answer input[type="radio"]').count();
    const checkboxInputs = await this.page.locator('.answer input[type="checkbox"]').count();
    const textareas = await this.page.locator('.answer textarea').count();
    const textInputs = await this.page.locator('.answer input[type="text"]').count();

    let questionType: QuestionData['questionType'] = 'single';
    let hasMultipleAnswers = false;

    if (checkboxInputs > 0) {
      questionType = 'multiple';
      hasMultipleAnswers = true;
    } else if (textareas > 0) {
      questionType = 'essay';
    } else if (textInputs > 0) {
      questionType = 'text';
    } else if (radioInputs > 0) {
      questionType = 'single';
    }

    // Extract answer options
    const options: string[] = [];
    const optionElements = await this.page.locator('.answer label').all();
    
    for (const element of optionElements) {
      const text = await element.textContent();
      if (text) {
        options.push(text.trim());
      }
    }

    return {
      questionNumber,
      questionText: questionText.trim(),
      questionType,
      options,
      hasMultipleAnswers,
    };
  }

  /**
   * Select a single answer option for a single-choice question.
   * @param optionIndex - Zero-based index of the option to select
   */
  async selectAnswer(optionIndex: number): Promise<void> {
    const radioInputs = await this.page.locator('.answer input[type="radio"]').all();
    
    if (optionIndex < 0 || optionIndex >= radioInputs.length) {
      throw new Error(`Invalid option index: ${optionIndex}. Available options: ${radioInputs.length}`);
    }

    const selectedInput = radioInputs[optionIndex];
    if (!selectedInput) {
      throw new Error(`Radio input at index ${optionIndex} not found`);
    }
    await selectedInput.check();
    
    // Wait a moment for the answer to be registered
    await this.page.waitForTimeout(500);
  }

  /**
   * Select multiple answer options for a multiple-choice question.
   * @param optionIndexes - Array of zero-based indexes of options to select
   */
  async selectMultipleAnswers(optionIndexes: number[]): Promise<void> {
    const checkboxInputs = await this.page.locator('.answer input[type="checkbox"]').all();
    
    for (const index of optionIndexes) {
      if (index < 0 || index >= checkboxInputs.length) {
        throw new Error(`Invalid option index: ${index}. Available options: ${checkboxInputs.length}`);
      }
      
      const selectedInput = checkboxInputs[index];
      if (!selectedInput) {
        throw new Error(`Checkbox input at index ${index} not found`);
      }
      await selectedInput.check();
    }
    
    // Wait a moment for the answers to be registered
    await this.page.waitForTimeout(500);
  }

  /**
   * Enter text answer for a text-based question.
   * @param text - Text to enter as the answer
   */
  async enterTextAnswer(text: string): Promise<void> {
    const textarea = this.page.locator('.answer textarea').first();
    const textInput = this.page.locator('.answer input[type="text"]').first();
    
    // Try textarea first, then text input
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill(text);
    } else if (await textInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textInput.fill(text);
    } else {
      throw new Error('No text input field found for this question');
    }
    
    // Wait a moment for the answer to be registered
    await this.page.waitForTimeout(500);
  }

  /**
   * Navigate to the next question in the quiz.
   */
  async nextQuestion(): Promise<void> {
    await this.nextButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.nextButton.click();
    
    // Wait for the next question to load
    await this.page.waitForLoadState('networkidle');
    await this.questionText.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Navigate to the previous question in the quiz.
   */
  async previousQuestion(): Promise<void> {
    await this.previousButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.previousButton.click();
    
    // Wait for the previous question to load
    await this.page.waitForLoadState('networkidle');
    await this.questionText.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Jump directly to a specific question using the question sidebar.
   * @param questionNumber - One-based question number to jump to
   */
  async jumpToQuestion(questionNumber: number): Promise<void> {
    const questionButton = this.page.locator(
      `[data-testid="question-nav-${questionNumber}"], ` +
      `.qnbutton[data-question="${questionNumber}"], ` +
      `.question-nav button:has-text("${questionNumber}")`
    ).first();

    await questionButton.waitFor({ state: 'visible', timeout: 5000 });
    await questionButton.click();
    
    // Wait for the question to load
    await this.page.waitForLoadState('networkidle');
    await this.questionText.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get the status of a specific question from the sidebar.
   * @param questionNumber - One-based question number to check
   * @returns Promise resolving to QuestionStatus object
   */
  async getQuestionStatus(questionNumber: number): Promise<QuestionStatus> {
    const questionButton = this.page.locator(
      `[data-testid="question-nav-${questionNumber}"], ` +
      `.qnbutton[data-question="${questionNumber}"], ` +
      `.question-nav button:nth-child(${questionNumber})`
    ).first();

    await questionButton.waitFor({ state: 'visible', timeout: 5000 });
    
    const classNames = await questionButton.getAttribute('class') || '';
    const ariaLabel = await questionButton.getAttribute('aria-label') || '';
    
    let status: QuestionStatus['status'] = 'unanswered';
    
    if (classNames.includes('answered') || ariaLabel.includes('answered')) {
      status = 'answered';
    } else if (classNames.includes('flagged') || ariaLabel.includes('flagged')) {
      status = 'flagged';
    } else if (classNames.includes('current') || classNames.includes('active')) {
      status = 'current';
    }

    return {
      questionNumber,
      status,
    };
  }

  /**
   * Click the submit all and finish button to submit the quiz.
   */
  async submitQuiz(): Promise<void> {
    await this.submitAllButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.submitAllButton.click();
    
    // Wait for confirmation dialog to appear
    await this.page.waitForTimeout(1000);
  }

  /**
   * Confirm the quiz submission in the confirmation dialog.
   */
  async confirmSubmit(): Promise<void> {
    await this.confirmSubmitButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.confirmSubmitButton.click();
    
    // Wait for results page to load
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Get the quiz results after submission.
   * @returns Promise resolving to QuizResults object
   */
  async getResults(): Promise<QuizResults> {
    await this.resultsSection.waitFor({ state: 'visible', timeout: 15000 });
    
    const scoreText = await this.scoreSummary.textContent() || '';
    
    // Parse score information (e.g., "8.00/10.00" or "80%")
    const scoreMatch = scoreText.match(/([\d.]+)\s*\/\s*([\d.]+)/);
    const percentageMatch = scoreText.match(/([\d.]+)%/);
    
    let score = 0;
    let maxScore = 0;
    let percentage = 0;
    
    if (scoreMatch && scoreMatch[1] && scoreMatch[2]) {
      score = parseFloat(scoreMatch[1]);
      maxScore = parseFloat(scoreMatch[2]);
      percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    } else if (percentageMatch && percentageMatch[1]) {
      percentage = parseFloat(percentageMatch[1]);
    }

    const feedbackText = await this.feedbackSection.textContent().catch(() => '');
    
    // Extract time taken
    const timeTakenElement = this.page.locator('[data-testid="time-taken"], .time-taken, .summary-time');
    const timeTaken = await timeTakenElement.textContent().catch(() => 'N/A');

    return {
      score,
      maxScore,
      percentage,
      grade: `${score.toFixed(2)}/${maxScore.toFixed(2)}`,
      timeTaken: timeTaken?.trim() || 'N/A',
      feedback: feedbackText?.trim() || '',
    };
  }

  /**
   * Get the final score from the results page.
   * @returns Promise resolving to score as a number
   */
  async getScore(): Promise<number> {
    const results = await this.getResults();
    return results.score;
  }

  /**
   * View and retrieve feedback for the quiz attempt.
   * @returns Promise resolving to feedback text
   */
  async viewFeedback(): Promise<string> {
    await this.feedbackSection.waitFor({ state: 'visible', timeout: 10000 });
    const feedbackText = await this.feedbackSection.textContent();
    return feedbackText?.trim() || '';
  }

  /**
   * Get attempt summary information.
   * @returns Promise resolving to AttemptSummary object
   */
  async viewAttemptSummary(): Promise<AttemptSummary> {
    const summarySection = this.page.locator('[data-testid="attempt-summary"], .attempt-summary, .quiz-attempt-summary').first();
    await summarySection.waitFor({ state: 'visible', timeout: 10000 });
    
    const summaryText = await summarySection.textContent() || '';
    
    // Extract attempt number
    const attemptMatch = summaryText.match(/Attempt\s+(\d+)/i);
    const attemptNumber = attemptMatch && attemptMatch[1] ? parseInt(attemptMatch[1], 10) : 1;
    
    // Extract time information
    const timeMatch = summaryText.match(/Time taken:?\s*([^,\n]+)/i);
    const timeTaken = timeMatch && timeMatch[1] ? timeMatch[1].trim() : 'N/A';
    
    const startMatch = summaryText.match(/Started:?\s*([^,\n]+)/i);
    const startTime = startMatch && startMatch[1] ? startMatch[1].trim() : 'N/A';
    
    // Count questions
    const questionButtons = await this.page.locator('.qnbutton, .question-nav button').count();
    const answeredButtons = await this.page.locator('.qnbutton.answered, .question-nav button.answered').count();

    return {
      attemptNumber,
      startTime,
      timeTaken,
      state: 'Finished',
      totalQuestions: questionButtons,
      answeredQuestions: answeredButtons,
    };
  }

  /**
   * Wait for the quiz to auto-submit when time expires.
   * @param maxWaitTime - Maximum time to wait in milliseconds (default: 60000)
   */
  async waitForAutoSubmit(maxWaitTime: number = 60000): Promise<void> {
    // Wait for the timer to reach zero or the results page to load
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const remainingTime = await this.getRemainingTime();
      
      if (remainingTime === '00:00' || remainingTime === '0:00') {
        // Timer has expired, wait for auto-submit
        await this.page.waitForTimeout(2000);
        
        // Check if we're on the results page
        const isOnResults = await this.resultsSection.isVisible({ timeout: 5000 }).catch(() => false);
        if (isOnResults) {
          return;
        }
      }
      
      // Check if already on results page
      const isOnResults = await this.resultsSection.isVisible({ timeout: 1000 }).catch(() => false);
      if (isOnResults) {
        return;
      }
      
      await this.page.waitForTimeout(1000);
    }
    
    throw new Error('Auto-submit did not occur within the expected time');
  }

  /**
   * Verify that the quiz timer is counting down.
   * @returns Promise resolving to true if timer is running, false otherwise
   */
  async verifyTimerRunning(): Promise<boolean> {
    try {
      // Get initial time
      const initialTime = await this.getRemainingTime();
      
      if (initialTime === '00:00') {
        return false;
      }
      
      // Wait 3 seconds
      await this.page.waitForTimeout(3000);
      
      // Get time again
      const newTime = await this.getRemainingTime();
      
      // Timer should have decreased
      return initialTime !== newTime && newTime !== '00:00';
    } catch {
      return false;
    }
  }
}
