/**
 * Ad-hoc unit tests for workshop types barrel export file
 * Tests that all types are properly exported and accessible
 */

import { describe, it, expect } from 'vitest';
import * as workshopTypes from './index';

describe('Workshop Types Barrel Export', () => {
  it('should export WorkshopPhase enum', () => {
    expect(workshopTypes.WorkshopPhase).toBeDefined();
    expect(workshopTypes.WorkshopPhase.SETUP).toBe(10);
    expect(workshopTypes.WorkshopPhase.SUBMISSION).toBe(20);
    expect(workshopTypes.WorkshopPhase.ASSESSMENT).toBe(30);
    expect(workshopTypes.WorkshopPhase.EVALUATION).toBe(40);
    expect(workshopTypes.WorkshopPhase.CLOSED).toBe(50);
  });

  it('should export ExamplesMode enum', () => {
    expect(workshopTypes.ExamplesMode).toBeDefined();
    expect(workshopTypes.ExamplesMode.VOLUNTARY).toBe(0);
    expect(workshopTypes.ExamplesMode.BEFORE_SUBMISSION).toBe(1);
    expect(workshopTypes.ExamplesMode.BEFORE_ASSESSMENT).toBe(2);
  });

  it('should export Workshop interface type', () => {
    // Verify Workshop type structure via TypeScript type checking
    const mockWorkshop: workshopTypes.Workshop = {
      id: 1,
      courseId: 100,
      name: 'Test Workshop',
      intro: 'Test intro',
      introFormat: 1,
      instructAuthors: 'Instructions for authors',
      instructAuthorsFormat: 1,
      instructReviewers: 'Instructions for reviewers',
      instructReviewersFormat: 1,
      phase: workshopTypes.WorkshopPhase.SETUP,
      strategy: 'accumulative',
      evaluation: 'best',
      grade: 100,
      gradingGrade: 20,
      gradeDecimals: 2,
      submissionStart: null,
      submissionEnd: null,
      assessmentStart: null,
      assessmentEnd: null,
      useExamples: false,
      examplesMode: workshopTypes.ExamplesMode.VOLUNTARY,
      usePeerAssessment: true,
      useSelfAssessment: false,
      lateSubmissions: false,
      maxBytes: 1048576,
      nAttachments: 1,
      submissionFileTypes: null,
      overallFeedbackMode: 1,
      overallFeedbackFiles: 0,
      overallFeedbackFileTypes: null,
      conclusion: 'Workshop conclusion',
      conclusionFormat: 1,
      timeCreated: Date.now(),
      timeModified: Date.now()
    };

    expect(mockWorkshop.id).toBe(1);
    expect(mockWorkshop.name).toBe('Test Workshop');
  });

  it('should export WorkshopSubmission interface type', () => {
    const mockSubmission: workshopTypes.WorkshopSubmission = {
      id: 1,
      workshopId: 100,
      example: false,
      authorId: 50,
      title: 'Test Submission',
      content: 'Submission content',
      contentFormat: 1,
      contentTrust: false,
      attachment: 0,
      grade: null,
      gradingGrade: null,
      gradeOver: null,
      gradingGradeOver: null,
      feedbackAuthor: null,
      feedbackAuthorFormat: 1,
      timeCreated: Date.now(),
      timeModified: Date.now(),
      published: false,
      late: false
    };

    expect(mockSubmission.id).toBe(1);
    expect(mockSubmission.title).toBe('Test Submission');
  });

  it('should export WorkshopAssessment interface type', () => {
    const mockAssessment: workshopTypes.WorkshopAssessment = {
      id: 1,
      submissionId: 100,
      reviewerId: 50,
      weight: 1,
      grade: null,
      gradingGrade: null,
      gradingGradeOver: null,
      feedbackAuthor: null,
      feedbackAuthorFormat: 1,
      feedbackAuthorAttachment: 0,
      feedbackReviewer: null,
      feedbackReviewerFormat: 1,
      timeCreated: Date.now(),
      timeModified: Date.now()
    };

    expect(mockAssessment.id).toBe(1);
    expect(mockAssessment.reviewerId).toBe(50);
  });

  it('should export AssessmentDimension interface type', () => {
    const mockDimension: workshopTypes.AssessmentDimension = {
      id: 1,
      workshopId: 100,
      sort: 1,
      description: 'Test criterion',
      descriptionFormat: 1,
      grade: 100,
      weight: 1,
      strategy: 'accumulative'
    };

    expect(mockDimension.id).toBe(1);
    expect(mockDimension.description).toBe('Test criterion');
  });

  it('should export DimensionGrade interface type', () => {
    const mockGrade: workshopTypes.DimensionGrade = {
      dimensionId: 1,
      grade: 85,
      peerComment: 'Good work',
      peerCommentFormat: 1
    };

    expect(mockGrade.dimensionId).toBe(1);
    expect(mockGrade.grade).toBe(85);
  });

  it('should export WorkshopUserPlanTask interface type', () => {
    const mockTask: workshopTypes.WorkshopUserPlanTask = {
      key: 'submit',
      title: 'Submit your work',
      link: '/workshop/submit',
      completed: false,
      details: 'Submit by the deadline'
    };

    expect(mockTask.key).toBe('submit');
    expect(mockTask.completed).toBe(false);
  });

  it('should export WorkshopUserPlanPhase interface type', () => {
    const mockPhase: workshopTypes.WorkshopUserPlanPhase = {
      phase: workshopTypes.WorkshopPhase.SUBMISSION,
      title: 'Submission Phase',
      tasks: [],
      active: true
    };

    expect(mockPhase.phase).toBe(workshopTypes.WorkshopPhase.SUBMISSION);
    expect(mockPhase.active).toBe(true);
  });

  it('should export WorkshopUserPlan interface type', () => {
    const mockPlan: workshopTypes.WorkshopUserPlan = {
      userId: 50,
      workshopId: 100,
      phases: []
    };

    expect(mockPlan.userId).toBe(50);
    expect(mockPlan.workshopId).toBe(100);
  });

  it('should export AllocationResult interface type', () => {
    const mockResult: workshopTypes.AllocationResult = {
      success: true,
      allocated: 10,
      message: 'Successfully allocated'
    };

    expect(mockResult.success).toBe(true);
    expect(mockResult.allocated).toBe(10);
  });

  it('should export WorkshopAssessmentFormData interface type', () => {
    const mockFormData: workshopTypes.WorkshopAssessmentFormData = {
      assessmentId: 1,
      dimensionGrades: [],
      feedbackAuthor: 'Great work!',
      feedbackAuthorFormat: 1
    };

    expect(mockFormData.assessmentId).toBe(1);
    expect(mockFormData.feedbackAuthor).toBe('Great work!');
  });

  it('should support type aliases for grading strategies', () => {
    const strategy1: workshopTypes.GradingStrategy = 'accumulative';
    const strategy2: workshopTypes.GradingStrategy = 'rubric';
    const strategy3: workshopTypes.GradingStrategy = 'comments';
    const strategy4: workshopTypes.GradingStrategy = 'numerrors';

    expect(strategy1).toBe('accumulative');
    expect(strategy2).toBe('rubric');
    expect(strategy3).toBe('comments');
    expect(strategy4).toBe('numerrors');
  });

  it('should support type aliases for allocation methods', () => {
    const method1: workshopTypes.AllocationMethod = 'manual';
    const method2: workshopTypes.AllocationMethod = 'random';
    const method3: workshopTypes.AllocationMethod = 'scheduled';

    expect(method1).toBe('manual');
    expect(method2).toBe('random');
    expect(method3).toBe('scheduled');
  });

  it('should allow wildcard import of all types', () => {
    // Verify that the barrel export enables wildcard imports
    expect(typeof workshopTypes).toBe('object');
    expect(workshopTypes.WorkshopPhase).toBeDefined();
    expect(workshopTypes.ExamplesMode).toBeDefined();
  });

  it('should maintain enum numeric values from Moodle constants', () => {
    // Verify that workshop phase constants match Moodle's numeric values
    expect(workshopTypes.WorkshopPhase.SETUP).toBe(10);
    expect(workshopTypes.WorkshopPhase.SUBMISSION).toBe(20);
    expect(workshopTypes.WorkshopPhase.ASSESSMENT).toBe(30);
    expect(workshopTypes.WorkshopPhase.EVALUATION).toBe(40);
    expect(workshopTypes.WorkshopPhase.CLOSED).toBe(50);
    
    // Verify examples mode numeric values
    expect(workshopTypes.ExamplesMode.VOLUNTARY).toBe(0);
    expect(workshopTypes.ExamplesMode.BEFORE_SUBMISSION).toBe(1);
    expect(workshopTypes.ExamplesMode.BEFORE_ASSESSMENT).toBe(2);
  });
});
