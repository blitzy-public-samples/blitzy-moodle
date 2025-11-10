/**
 * PageRenderer Component
 * 
 * React component that displays HTML page content with proper formatting and embedded media support.
 * Replaces Moodle's public/mod/page/view.php server-side rendering with client-side React rendering.
 * 
 * Features:
 * - Renders HTML page content using Material-UI components
 * - Processes content through DOMPurify sanitization for XSS protection
 * - Handles different content formats (HTML/Markdown/Plain)
 * - Displays last modified timestamp
 * - Implements comprehensive loading/error states
 * - Maintains WCAG 2.1 AA accessibility compliance
 * 
 * @module features/activities/resources/components/PageRenderer
 */

import React, { useMemo, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Skeleton,
  Paper,
  Divider,
} from '@mui/material';
import DOMPurify from 'dompurify';

// Internal imports
import { useResourcePage } from '../hooks/useResource';
import { Alert } from '@/components/feedback/Alert';
import { formatDate } from '@/utils/date';

/**
 * Local interface for page data used internally in this component
 * Matches the structure returned from the API via useResourcePage hook
 */
interface PageData {
  id: number;
  coursemodule: number;
  course: number;
  name: string;
  intro: string;
  introformat: number;
  content: string;
  contentformat: number;
  display: number;
  displayoptions: string | Record<string, unknown>;
  timemodified: number;
  legacyfiles?: number;
  legacyfileslast?: number;
}

/**
 * Props interface for PageRenderer component
 * Defines all required and optional properties for page rendering
 */
export interface PageRendererProps {
  /** Unique identifier for the page resource */
  pageId: number;
  
  /** Raw page content to render (optional, fetched if not provided) */
  content?: string;
  
  /** Content format type: html, markdown, or plain text */
  contentFormat?: 'html' | 'markdown' | 'plain';
  
  /** Display options for page rendering (serialized settings) */
  displayOptions?: Record<string, unknown>;
  
  /** Unix timestamp of last modification */
  lastModified?: number;
  
  /** Introduction text to display before main content */
  introduction?: string;
  
  /** Whether to show introduction text (printintro option) */
  showIntroduction?: boolean;
  
  /** Whether page is displayed in popup mode */
  inPopup?: boolean;
}

/**
 * Content format enumeration matching Moodle's FORMAT_* constants
 */
enum ContentFormat {
  HTML = 1,
  PLAIN = 2,
  MARKDOWN = 4,
  MOODLE = 0,
}

/**
 * PageRenderer Component
 * 
 * Displays page content with proper formatting, sanitization, and embedded media support.
 * Wraps existing Moodle page_view() and format_text() functions via API endpoints.
 * 
 * @param {PageRendererProps} props - Component properties
 * @returns {JSX.Element} Rendered page content with loading/error states
 */
const PageRenderer: React.FC<PageRendererProps> = ({
  pageId,
  content: providedContent,
  contentFormat = 'html',
  displayOptions = {},
  lastModified,
  introduction,
  showIntroduction = true,
  inPopup = false,
}) => {
  // Fetch page data via React Query hook (wraps GET /api/v1/resources/pages/{id})
  const {
    data: pageData,
    isLoading,
    isError,
    error,
  } = useResourcePage(pageId);

  // Extract page content and metadata from API response or props
  const page = useMemo<PageData | null>(() => {
    if (pageData) {
      // Map the API response to our PageData structure
      return {
        id: pageData.id,
        coursemodule: pageData.coursemodule,
        course: pageData.course,
        name: pageData.name,
        intro: pageData.intro,
        introformat: pageData.introformat,
        content: pageData.content,
        contentformat: pageData.contentformat,
        display: pageData.display,
        displayoptions: pageData.displayoptions,
        timemodified: pageData.timemodified,
        legacyfiles: pageData.legacyfiles,
        legacyfileslast: pageData.legacyfileslast,
      };
    }
    
    // Fallback to provided props if no API data
    if (providedContent) {
      return {
        id: pageId,
        coursemodule: 0,
        course: 0,
        name: '',
        intro: introduction || '',
        introformat: 1,
        content: providedContent,
        contentformat: mapContentFormatToNumber(contentFormat),
        display: 0,
        displayoptions: displayOptions,
        timemodified: lastModified || Date.now() / 1000,
      };
    }
    
    return null;
  }, [pageData, providedContent, pageId, contentFormat, displayOptions, lastModified, introduction]);

  // Rewrite pluginfile URLs for secure file access via context-based file API
  const rewritePluginFileUrls = (content: string): string => {
    if (!content) return '';
    
    // Replace @@PLUGINFILE@@ placeholder with actual API endpoint
    // Equivalent to file_rewrite_pluginfile_urls() in Moodle
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const pluginFilePattern = /@@PLUGINFILE@@\//g;
    
    return content.replace(
      pluginFilePattern,
      `${apiBaseUrl}/files/pluginfile/mod_page/content/${pageId}/`
    );
  };

  // Sanitize and format HTML content with XSS protection
  const sanitizeContent = (rawContent: string, format: number): string => {
    if (!rawContent) return '';
    
    // Rewrite file URLs first
    let processedContent = rewritePluginFileUrls(rawContent);
    
    // Handle different content formats (equivalent to format_text() in Moodle)
    switch (format) {
      case ContentFormat.HTML:
        // HTML format: sanitize with DOMPurify
        processedContent = DOMPurify.sanitize(processedContent, {
          ALLOWED_TAGS: [
            'a', 'abbr', 'acronym', 'address', 'area', 'article', 'aside',
            'audio', 'b', 'bdi', 'bdo', 'blockquote', 'br', 'button', 'canvas',
            'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist',
            'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em',
            'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'iframe',
            'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'main',
            'map', 'mark', 'meter', 'nav', 'object', 'ol', 'optgroup', 'option',
            'output', 'p', 'param', 'picture', 'pre', 'progress', 'q', 'rp',
            'rt', 'ruby', 's', 'samp', 'section', 'select', 'small', 'source',
            'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td',
            'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'tr', 'track',
            'u', 'ul', 'var', 'video', 'wbr'
          ],
          ALLOWED_ATTR: [
            'alt', 'aria-*', 'class', 'colspan', 'controls', 'data-*', 'datetime',
            'dir', 'height', 'href', 'id', 'lang', 'loading', 'role', 'rowspan',
            'src', 'srcset', 'style', 'target', 'title', 'type', 'width'
          ],
          ALLOW_DATA_ATTR: true,
          ALLOW_ARIA_ATTR: true,
          ADD_ATTR: ['target', 'rel'],
        });
        break;
        
      case ContentFormat.PLAIN:
        // Plain text: escape HTML and preserve line breaks
        processedContent = processedContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br />');
        break;
        
      case ContentFormat.MARKDOWN:
        // Markdown: convert to HTML then sanitize
        // For production, implement markdown-to-html conversion
        // For now, treat as HTML after basic markdown processing
        processedContent = processBasicMarkdown(processedContent);
        processedContent = DOMPurify.sanitize(processedContent, {
          ALLOWED_TAGS: ['a', 'b', 'blockquote', 'br', 'code', 'em', 'h1', 'h2',
            'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre',
            'strong', 'ul'
          ],
          ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
        });
        break;
        
      default:
        // Moodle auto format or unknown: apply HTML sanitization
        processedContent = DOMPurify.sanitize(processedContent);
    }
    
    return processedContent;
  };

  // Basic markdown processing (simplified for demonstration)
  const processBasicMarkdown = (markdown: string): string => {
    return markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/__(.*?)__/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/_(.*?)_/gim, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
      // Line breaks
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br />');
  };

  // Process and sanitize page content
  const processedContent = useMemo(() => {
    if (!page?.content) return '';
    
    return sanitizeContent(page.content, page.contentformat || ContentFormat.HTML);
  }, [page]);

  // Parse displayoptions to determine if intro should be shown
  const shouldShowIntro = useMemo(() => {
    // Priority: explicit prop > displayoptions.printintro > default
    if (showIntroduction === false) return false;
    
    if (page?.displayoptions) {
      const opts = typeof page.displayoptions === 'string' 
        ? JSON.parse(page.displayoptions || '{}')
        : page.displayoptions;
      
      // printintro can be string '0'/'1' or boolean
      if ('printintro' in opts) {
        const printintro = opts.printintro;
        return printintro === '1' || printintro === 1 || printintro === true;
      }
    }
    
    return showIntroduction;
  }, [page, showIntroduction]);

  // Process introduction text with sanitization
  const processedIntroduction = useMemo(() => {
    if (!page?.intro || !shouldShowIntro) return '';
    
    return sanitizeContent(page.intro, ContentFormat.HTML);
  }, [page, shouldShowIntro]);

  // Add target="_blank" and rel attributes to external links for security
  useEffect(() => {
    if (!page) return;
    
    const contentElement = document.getElementById(`page-content-${pageId}`);
    if (!contentElement) return;
    
    const links = contentElement.querySelectorAll('a[href]');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }, [page, pageId, processedContent]);

  // Format last modified timestamp
  const formattedLastModified = useMemo(() => {
    if (!page?.timemodified) return '';
    
    return formatDate(page.timemodified * 1000); // Convert Unix timestamp to milliseconds
  }, [page]);

  // Display loading skeleton while fetching page data
  if (isLoading) {
    return (
      <Container
        maxWidth={inPopup ? false : 'lg'}
        sx={{ py: 3 }}
        role="main"
        aria-busy="true"
        aria-label="Loading page content"
      >
        <Paper
          elevation={0}
          sx={{
            p: 3,
            backgroundColor: 'background.paper',
            borderRadius: 1,
          }}
        >
          <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="75%" />
          <Skeleton variant="text" width="40%" sx={{ mt: 2 }} />
        </Paper>
      </Container>
    );
  }

  // Display error message if page load fails
  if (isError || !page) {
    return (
      <Container
        maxWidth={inPopup ? false : 'lg'}
        sx={{ py: 3 }}
        role="main"
        aria-live="assertive"
      >
        <Alert
          severity="error"
          title="Failed to Load Page"
          message={
            error instanceof Error
              ? error.message
              : 'Unable to load page content. Please try again later.'
          }
        />
      </Container>
    );
  }

  // Render page content with proper formatting and accessibility
  return (
    <Container
      maxWidth={inPopup ? false : 'lg'}
      sx={{
        py: inPopup ? 2 : 3,
        px: inPopup ? 2 : 3,
      }}
      role="main"
      aria-label="Page content"
    >
      {/* Page title */}
      {page?.name && (
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ mb: 3 }}
        >
          {page.name}
        </Typography>
      )}

      <Paper
        elevation={inPopup ? 0 : 1}
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          backgroundColor: 'background.paper',
          borderRadius: inPopup ? 0 : 1,
          overflow: 'hidden',
        }}
      >
        {/* Introduction text section (if enabled) */}
        {processedIntroduction && (
          <Box
            component="section"
            aria-label="Introduction"
            sx={{ mb: 3 }}
          >
            <Typography
              variant="body1"
              component="div"
              sx={{
                color: 'text.secondary',
                '& p:first-of-type': { mt: 0 },
                '& p:last-of-type': { mb: 0 },
              }}
              dangerouslySetInnerHTML={{ __html: processedIntroduction }}
            />
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        {/* Main page content */}
        <Box
          id={`page-content-${pageId}`}
          component="article"
          aria-label="Main content"
          sx={{
            // Content styling matching Moodle's generalbox
            color: 'text.primary',
            lineHeight: 1.6,
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            
            // Typography styles
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              mt: 2,
              mb: 1.5,
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'text.primary',
            },
            '& h1': { fontSize: '2rem' },
            '& h2': { fontSize: '1.75rem' },
            '& h3': { fontSize: '1.5rem' },
            '& h4': { fontSize: '1.25rem' },
            '& h5': { fontSize: '1.1rem' },
            '& h6': { fontSize: '1rem' },
            
            // Paragraph and text styles
            '& p': {
              mt: 0,
              mb: 1.5,
            },
            '& p:last-child': {
              mb: 0,
            },
            
            // Link styles
            '& a': {
              color: 'primary.main',
              textDecoration: 'underline',
              '&:hover': {
                color: 'primary.dark',
              },
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              },
            },
            
            // List styles
            '& ul, & ol': {
              mt: 0,
              mb: 1.5,
              pl: 3,
            },
            '& li': {
              mb: 0.5,
            },
            
            // Table styles
            '& table': {
              width: '100%',
              maxWidth: '100%',
              mb: 2,
              borderCollapse: 'collapse',
              border: '1px solid',
              borderColor: 'divider',
            },
            '& th, & td': {
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'left',
            },
            '& th': {
              backgroundColor: 'action.hover',
              fontWeight: 600,
            },
            
            // Image styles
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              display: 'block',
              my: 2,
            },
            
            // Video and iframe styles
            '& video, & iframe': {
              maxWidth: '100%',
              my: 2,
            },
            
            // Code and pre styles
            '& code': {
              px: 0.5,
              py: 0.25,
              backgroundColor: 'action.hover',
              borderRadius: 0.5,
              fontSize: '0.875em',
              fontFamily: 'monospace',
            },
            '& pre': {
              p: 2,
              mb: 2,
              backgroundColor: 'action.hover',
              borderRadius: 1,
              overflow: 'auto',
              '& code': {
                p: 0,
                backgroundColor: 'transparent',
              },
            },
            
            // Blockquote styles
            '& blockquote': {
              ml: 0,
              pl: 2,
              py: 1,
              borderLeft: '4px solid',
              borderColor: 'primary.main',
              backgroundColor: 'action.hover',
              fontStyle: 'italic',
            },
            
            // Overflow handling for wide content
            overflowX: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: processedContent }}
        />

        {/* Last modified timestamp */}
        {formattedLastModified && (
          <Box
            component="footer"
            sx={{
              mt: 4,
              pt: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{ fontStyle: 'italic' }}
            >
              Last modified: {formattedLastModified}
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

/**
 * Helper function to map string content format to Moodle numeric constant
 */
function mapContentFormatToNumber(format: string): number {
  switch (format.toLowerCase()) {
    case 'html':
      return ContentFormat.HTML;
    case 'plain':
      return ContentFormat.PLAIN;
    case 'markdown':
      return ContentFormat.MARKDOWN;
    default:
      return ContentFormat.MOODLE;
  }
}

export default PageRenderer;
