/**
 * SCORM API Integration Layer
 *
 * Provides functions to interact with backend SCORM endpoints including:
 * - Retrieving SCORM package data and configuration
 * - Managing SCOs (Shareable Content Objects) and table of contents
 * - Player configuration and launch management
 * - Tracking data submission (SCORM 1.2 and SCORM 2004)
 * - Attempt management and reporting
 * - Prerequisite evaluation for navigation
 *
 * All functions wrap calls to /api/v1/scorm/* endpoints that delegate to
 * existing Moodle SCORM PHP functions, ensuring zero business logic duplication.
 *
 * @module features/activities/scorm/api/scormApi
 */

import { apiClient } from '@/services/api/client';
import type { AxiosError } from 'axios';
import type {
  Scorm,
  ScormSco,
  ScormToc,
  ScormPlayerConfig,
  ScormAttempt,
  ScormTrackingData,
  ScormAttemptReport,
  LaunchScoParams,
  SubmitTrackingParams,
  EvaluatePrerequisitesParams,
  FetchScormTocParams,
  FetchAttemptReportParams,
} from '../types/scorm.types';
import type { ApiResponse } from '@/types/api';

/**
 * Type guard to check if error is an AxiosError
 */
function isAxiosError(
  error: unknown
): error is AxiosError<{ error?: { status?: number; message?: string } }> {
  return (error as AxiosError).isAxiosError === true;
}

/**
 * Fetch SCORM package details
 *
 * Retrieves comprehensive SCORM package information including configuration,
 * version, grading method, display settings, and launch parameters.
 *
 * Maps to PHP functions:
 * - scorm_get_scorm() from lib.php
 * - Database: scorm table
 *
 * @param id - SCORM module ID
 * @returns Promise resolving to SCORM package details
 * @throws Error if SCORM package not found or access denied
 */
export async function fetchScorm(id: number): Promise<Scorm> {
  try {
    const response = await apiClient.get<ApiResponse<Scorm>>(`/scorm/${id}`);

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch SCORM package');
    }

    return response.data.data;
  } catch (error: unknown) {
    // Transform backend errors into user-friendly messages
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 404) {
        throw new Error('SCORM package not found');
      } else if (errorData.status === 403) {
        throw new Error('You do not have permission to access this SCORM package');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to fetch SCORM package. Please try again.');
  }
}

/**
 * Fetch all SCOs (Shareable Content Objects) for a SCORM package
 *
 * Retrieves the complete list of SCOs with their organization structure,
 * identifiers, launch URLs, and metadata.
 *
 * Maps to PHP function:
 * - scorm_get_scoes() from locallib.php
 *
 * @param id - SCORM module ID
 * @returns Promise resolving to array of SCOs
 * @throws Error if SCOs cannot be retrieved
 */
export async function fetchScormScos(id: number): Promise<ScormSco[]> {
  try {
    const response = await apiClient.get<ApiResponse<ScormSco[]>>(`/scorm/${id}/scos`);

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch SCOs');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 404) {
        throw new Error('SCORM package or SCOs not found');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to fetch SCORM content objects. Please try again.');
  }
}

/**
 * Fetch hierarchical table of contents for SCORM navigation
 *
 * Retrieves the TOC with prerequisite evaluation, completion status,
 * and navigation structure for the current user's context.
 *
 * Maps to PHP function:
 * - scorm_get_toc() from locallib.php
 *
 * Supports SCORM navigation parameters:
 * - currentorg: Current organization identifier
 * - mode: Navigation mode (normal, browse, review)
 *
 * @param id - SCORM module ID
 * @param params - Optional parameters for TOC generation
 * @returns Promise resolving to hierarchical TOC structure
 * @throws Error if TOC cannot be generated
 */
export async function fetchScormToc(id: number, params?: FetchScormTocParams): Promise<ScormToc> {
  try {
    const response = await apiClient.get<ApiResponse<ScormToc>>(`/scorm/${id}/toc`, { params });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch table of contents');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 404) {
        throw new Error('SCORM package not found');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to fetch SCORM navigation. Please try again.');
  }
}

/**
 * Fetch player configuration for SCORM package
 *
 * Retrieves player settings including launch parameters, popup options,
 * navigation display settings, and TOC visibility preferences.
 *
 * Maps to:
 * - player.php configuration logic
 * - scorm_get_popup_options_array() from locallib.php
 *
 * @param id - SCORM module ID
 * @returns Promise resolving to player configuration
 * @throws Error if configuration cannot be retrieved
 */
export async function fetchPlayerConfig(id: number): Promise<ScormPlayerConfig> {
  try {
    const response = await apiClient.get<ApiResponse<ScormPlayerConfig>>(`/scorm/${id}/player`);

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch player configuration');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 404) {
        throw new Error('SCORM package not found');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to fetch player configuration. Please try again.');
  }
}

/**
 * Launch a specific SCO with proper attempt management
 *
 * Initiates a SCO launch with prerequisite checking, attempt creation
 * if needed, and returns launch URL and parameters.
 *
 * Maps to PHP function:
 * - scorm_launch_sco() from locallib.php
 *
 * Handles:
 * - Prerequisite validation
 * - Attempt creation or continuation
 * - Launch URL generation
 *
 * @param id - SCORM module ID
 * @param params - Launch parameters including SCO ID and attempt options
 * @returns Promise resolving to launch configuration
 * @throws Error if prerequisites not met or launch fails
 */
export async function launchSco(
  id: number,
  params: LaunchScoParams
): Promise<{ launchUrl: string; attemptId: number; scoId: number }> {
  try {
    const response = await apiClient.post<
      ApiResponse<{ launchUrl: string; attemptId: number; scoId: number }>
    >(`/scorm/${id}/launch`, params);

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to launch SCO');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      const errorMsg = errorData.message;
      if (errorData.status === 403) {
        if (errorMsg?.includes('prerequisite')) {
          throw new Error('Prerequisites not met. Please complete required content first.');
        }
        throw new Error('You do not have permission to launch this content');
      } else if (errorData.status === 404) {
        throw new Error('SCORM content not found');
      } else if (errorMsg === 'PACKAGE_NOT_AVAILABLE') {
        throw new Error('SCORM package is not currently available');
      } else if (errorMsg === 'INVALID_SCO') {
        throw new Error('Invalid content object specified');
      } else if (errorMsg) {
        throw new Error(errorMsg);
      }
    }
    throw new Error('Failed to launch SCORM content. Please try again.');
  }
}

/**
 * Submit SCORM tracking data (CMI elements)
 *
 * Submits tracking data for the current attempt including scores, completion
 * status, time spent, interactions, and other CMI data model elements.
 *
 * Maps to PHP function:
 * - scorm_insert_track() from locallib.php
 *
 * Supports:
 * - SCORM 1.2 data model (cmi.*)
 * - SCORM 2004 data model (cmi.*)
 * - Automatic data model detection
 *
 * @param id - SCORM module ID
 * @param params - Tracking data including attempt ID and CMI elements
 * @returns Promise resolving to submission confirmation
 * @throws Error if tracking data cannot be saved
 */
export async function submitTracking(
  id: number,
  params: SubmitTrackingParams
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
      `/scorm/${id}/track`,
      params
    );

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to save tracking data');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 403) {
        throw new Error('You do not have permission to submit tracking data');
      } else if (errorData.status === 404) {
        throw new Error('SCORM attempt not found');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to save progress. Please try again.');
  }
}

/**
 * Fetch all user attempts for a SCORM package
 *
 * Retrieves the complete list of attempts with status, timing information,
 * scores, and completion data.
 *
 * Maps to PHP functions:
 * - scorm_get_all_attempts() from locallib.php
 * - scorm_get_last_attempt() from locallib.php
 *
 * @param id - SCORM module ID
 * @param userId - Optional user ID to filter attempts for a specific user
 * @returns Promise resolving to array of attempts
 * @throws Error if attempts cannot be retrieved
 */
export async function fetchAttempts(id: number, userId?: number): Promise<ScormAttempt[]> {
  try {
    const response = await apiClient.get<ApiResponse<ScormAttempt[]>>(`/scorm/${id}/attempts`, {
      params: userId !== undefined ? { userId } : undefined,
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch attempts');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 404) {
        throw new Error('SCORM package not found');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to fetch attempt history. Please try again.');
  }
}

/**
 * Create a new attempt for the SCORM package
 *
 * Validates and creates a new attempt, checking for:
 * - Maximum attempts limit
 * - Completion status of previous attempts
 * - Force new attempt settings
 *
 * Maps to PHP function:
 * - scorm_get_attempt() with create=true from locallib.php
 *
 * @param id - SCORM module ID
 * @returns Promise resolving to new attempt details
 * @throws Error if attempt cannot be created (e.g., max attempts reached)
 */
export async function createAttempt(id: number): Promise<ScormAttempt> {
  try {
    const response = await apiClient.post<ApiResponse<ScormAttempt>>(`/scorm/${id}/attempt`);

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to create attempt');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      const errorMsg = errorData.message;
      if (errorData.status === 403) {
        if (errorMsg?.includes('maximum')) {
          throw new Error('Maximum number of attempts reached');
        }
        throw new Error('You do not have permission to create a new attempt');
      } else if (errorData.status === 404) {
        throw new Error('SCORM package not found');
      } else if (errorMsg) {
        throw new Error(errorMsg);
      }
    }
    throw new Error('Failed to create new attempt. Please try again.');
  }
}

/**
 * Fetch all tracking data for a specific attempt
 *
 * Retrieves complete CMI tracking data including all interactions,
 * objectives, scores, and navigation history for the specified attempt.
 *
 * Maps to PHP function:
 * - scorm_get_tracks() from locallib.php
 *
 * @param attemptId - Attempt ID
 * @param scoId - Optional SCO ID to filter tracking data for a specific SCO
 * @returns Promise resolving to tracking data collection
 * @throws Error if tracking data cannot be retrieved
 */
export async function fetchAttemptTracking(attemptId: number, scoId?: number): Promise<ScormTrackingData> {
  try {
    const response = await apiClient.get<ApiResponse<ScormTrackingData>>(
      `/scorm/attempts/${attemptId}/tracking`,
      {
        params: scoId !== undefined ? { scoId } : undefined,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch tracking data');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 404) {
        throw new Error('Attempt not found');
      } else if (errorData.status === 403) {
        throw new Error('You do not have permission to view this attempt');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to fetch tracking data. Please try again.');
  }
}

/**
 * Generate comprehensive report for user attempts
 *
 * Generates detailed report including:
 * - All attempts with scores and status
 * - Time spent analysis
 * - Completion progress
 * - Interaction details
 * - Grade calculation based on grading method
 *
 * Maps to PHP reporting functions from report/ directory
 *
 * @param id - SCORM module ID
 * @param params - Optional report parameters (user filter, attempt filter)
 * @returns Promise resolving to comprehensive report data
 * @throws Error if report cannot be generated
 */
export async function fetchAttemptReport(
  id: number,
  params?: FetchAttemptReportParams
): Promise<ScormAttemptReport> {
  try {
    const response = await apiClient.get<ApiResponse<ScormAttemptReport>>(`/scorm/${id}/report`, {
      params,
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to generate report');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 404) {
        throw new Error('SCORM package or attempts not found');
      } else if (errorData.status === 403) {
        throw new Error('You do not have permission to view reports');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to generate report. Please try again.');
  }
}

/**
 * Delete a specific attempt
 *
 * Deletes an attempt if allowed by permissions and SCORM settings.
 * Removes all associated tracking data.
 *
 * Maps to PHP function:
 * - scorm_delete_attempt() from locallib.php
 *
 * @param id - SCORM module ID
 * @param attemptId - Attempt ID to delete
 * @returns Promise resolving to deletion confirmation
 * @throws Error if attempt cannot be deleted
 */
export async function deleteAttempt(
  id: number,
  attemptId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.delete<ApiResponse<{ success: boolean; message: string }>>(
      `/scorm/${id}/attempts/${attemptId}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to delete attempt');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 403) {
        throw new Error('You do not have permission to delete attempts');
      } else if (errorData.status === 404) {
        throw new Error('Attempt not found');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to delete attempt. Please try again.');
  }
}

/**
 * Evaluate prerequisites for SCO navigation
 *
 * Evaluates whether a user can navigate to a specific SCO based on:
 * - Prerequisite rules defined in SCORM manifest
 * - Completion status of required SCOs
 * - Scores and mastery status
 *
 * Maps to PHP function:
 * - scorm_eval_prerequisites() from locallib.php
 *
 * @param id - SCORM module ID
 * @param params - Prerequisite evaluation parameters (SCO ID, organization)
 * @returns Promise resolving to prerequisite evaluation result
 * @throws Error if evaluation fails
 */
export async function evaluatePrerequisites(
  id: number,
  params: EvaluatePrerequisitesParams
): Promise<{ canAccess: boolean; reason?: string }> {
  try {
    const response = await apiClient.post<ApiResponse<{ canAccess: boolean; reason?: string }>>(
      `/scorm/${id}/prerequisites`,
      params
    );

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to evaluate prerequisites');
    }

    return response.data.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data?.error) {
      const errorData = error.response.data.error;
      if (errorData.status === 404) {
        throw new Error('SCORM package or SCO not found');
      } else if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    throw new Error('Failed to evaluate prerequisites. Please try again.');
  }
}
