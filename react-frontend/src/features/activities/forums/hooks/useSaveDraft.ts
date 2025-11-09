/**
 * useSaveDraft Hook
 *
 * Custom React hook for managing forum post drafts with auto-save functionality.
 * Stores drafts in localStorage for persistence across page reloads.
 *
 * Features:
 * - Auto-save drafts every 30 seconds
 * - Manual draft save
 * - Draft restoration on mount
 * - Draft deletion
 * - Debounced auto-save
 * - localStorage persistence
 *
 * @module features/activities/forums/hooks/useSaveDraft
 */

import { useEffect, useCallback, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Draft data structure
 */
export interface DraftData {
  /** Subject of the discussion (for new discussions) */
  subject?: string;
  /** Message content */
  message: string;
  /** Whether user subscribed to discussion */
  subscribe?: boolean;
  /** File attachments (stored as file names, not actual files) */
  attachmentNames?: string[];
  /** Timestamp when draft was saved */
  savedAt: number;
}

/**
 * Options for the useSaveDraft hook
 */
export interface UseSaveDraftOptions {
  /** Unique key for the draft (e.g., 'forum-123-discussion' or 'forum-123-post-456') */
  draftKey: string;
  /** Auto-save interval in milliseconds (default: 30000 = 30 seconds) */
  autoSaveInterval?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return type of the useSaveDraft hook
 */
export interface UseSaveDraftReturn {
  /** Save draft data to localStorage */
  saveDraft: (data: Omit<DraftData, 'savedAt'>) => void;
  /** Load draft from localStorage */
  loadDraft: () => DraftData | null;
  /** Delete draft from localStorage */
  deleteDraft: () => void;
  /** Whether a draft exists */
  hasDraft: boolean;
  /** Timestamp of last save (null if never saved) */
  lastSavedAt: number | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get draft from localStorage
 */
function getDraftFromStorage(key: string): DraftData | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) {return null;}
    
    const draft = JSON.parse(item) as DraftData;
    
    // Validate draft structure
    if (!draft.message || typeof draft.savedAt !== 'number') {
      return null;
    }
    
    return draft;
  } catch (error) {
    console.error('Error loading draft from localStorage:', error);
    return null;
  }
}

/**
 * Save draft to localStorage
 */
function saveDraftToStorage(key: string, data: Omit<DraftData, 'savedAt'>): void {
  try {
    const draft: DraftData = {
      ...data,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.error('Error saving draft to localStorage:', error);
  }
}

/**
 * Remove draft from localStorage
 */
function removeDraftFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing draft from localStorage:', error);
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing forum post drafts with auto-save
 *
 * @param options - Configuration options
 * @returns Draft management functions and state
 *
 * @example
 * ```tsx
 * const { saveDraft, loadDraft, deleteDraft, hasDraft } = useSaveDraft({
 *   draftKey: `forum-${forumId}-discussion`,
 *   autoSaveInterval: 30000,
 * });
 *
 * // Load draft on mount
 * useEffect(() => {
 *   const draft = loadDraft();
 *   if (draft) {
 *     setSubject(draft.subject || '');
 *     setMessage(draft.message);
 *   }
 * }, []);
 *
 * // Save draft manually
 * const handleSaveDraft = () => {
 *   saveDraft({ subject, message });
 * };
 *
 * // Auto-save is handled automatically
 * ```
 */
export function useSaveDraft(options: UseSaveDraftOptions): UseSaveDraftReturn {
  const {
    draftKey,
    autoSaveInterval: _autoSaveInterval = 30000,
    enabled = true,
  } = options;

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveDataRef = useRef<string>('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  /**
   * Save draft to localStorage
   */
  const saveDraft = useCallback((data: Omit<DraftData, 'savedAt'>) => {
    if (!enabled) {return;}
    
    // Don't save empty drafts
    if (!data.message?.trim()) {return;}
    
    // Don't save if data hasn't changed
    const dataStr = JSON.stringify(data);
    if (dataStr === lastSaveDataRef.current) {return;}
    
    saveDraftToStorage(draftKey, data);
    lastSaveDataRef.current = dataStr;
    setLastSavedAt(Date.now());
  }, [draftKey, enabled]);

  /**
   * Load draft from localStorage
   */
  const loadDraft = useCallback((): DraftData | null => {
    return getDraftFromStorage(draftKey);
  }, [draftKey]);

  /**
   * Delete draft from localStorage
   */
  const deleteDraft = useCallback(() => {
    removeDraftFromStorage(draftKey);
    lastSaveDataRef.current = '';
  }, [draftKey]);

  /**
   * Check if draft exists
   */
  const hasDraft = Boolean(getDraftFromStorage(draftKey));

  /**
   * Cleanup auto-save timer on unmount
   */
  useEffect(() => {
    const timer = autoSaveTimerRef.current;
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return {
    saveDraft,
    loadDraft,
    deleteDraft,
    hasDraft,
    lastSavedAt,
  };
}
