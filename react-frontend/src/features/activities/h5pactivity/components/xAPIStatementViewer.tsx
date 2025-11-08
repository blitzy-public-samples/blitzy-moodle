/**
 * xAPI Statement Viewer Component
 * 
 * Displays and analyzes xAPI (Experience API) statements captured during H5P activity interactions.
 * Provides detailed visualization of xAPI statement structure including actor, verb, object, result,
 * and context information with expandable JSON tree view and interactive filtering capabilities.
 * 
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  Box,
  LinearProgress,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tab,
  Tabs,
  Alert,
  IconButton,
  Grid,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Cancel as CancelIcon,
  ContentCopy as ContentCopyIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import ReactJson from 'react-json-view';

/**
 * xAPI Actor interface representing the user who performed the action
 */
interface XAPIActor {
  objectType?: string;
  name?: string;
  mbox?: string;
  mbox_sha1sum?: string;
  openid?: string;
  account?: {
    homePage: string;
    name: string;
  };
}

/**
 * xAPI Verb interface representing the action performed
 */
interface XAPIVerb {
  id: string;
  display: {
    [languageCode: string]: string;
  };
}

/**
 * xAPI Score interface for result scoring
 */
interface XAPIScore {
  scaled?: number;
  raw?: number;
  min?: number;
  max?: number;
}

/**
 * xAPI Result interface containing outcome information
 */
interface XAPIResult {
  score?: XAPIScore;
  success?: boolean;
  completion?: boolean;
  response?: string;
  duration?: string;
  extensions?: Record<string, any>;
}

/**
 * xAPI Object Definition interface
 */
interface XAPIDefinition {
  name?: {
    [languageCode: string]: string;
  };
  description?: {
    [languageCode: string]: string;
  };
  type?: string;
  interactionType?: string;
  correctResponsesPattern?: string[];
  extensions?: Record<string, any>;
}

/**
 * xAPI Object interface representing the activity
 */
interface XAPIObject {
  id: string;
  objectType?: string;
  definition?: XAPIDefinition;
}

/**
 * xAPI Context interface for additional context information
 */
interface XAPIContext {
  registration?: string;
  platform?: string;
  language?: string;
  contextActivities?: {
    parent?: XAPIObject[];
    grouping?: XAPIObject[];
    category?: XAPIObject[];
    other?: XAPIObject[];
  };
  extensions?: Record<string, any>;
}

/**
 * xAPI Statement interface representing a complete xAPI statement
 */
export interface XAPIStatement {
  id?: string;
  actor: XAPIActor;
  verb: XAPIVerb;
  object: XAPIObject;
  result?: XAPIResult;
  context?: XAPIContext;
  timestamp?: string;
  stored?: string;
  authority?: XAPIActor;
  version?: string;
}

/**
 * Props for the xAPIStatementViewer component
 */
interface XAPIStatementViewerProps {
  /** Single statement or array of statements to display */
  statements: XAPIStatement | XAPIStatement[];
  /** Whether to show the JSON tree view by default */
  showJsonByDefault?: boolean;
  /** Theme for the JSON viewer (light or dark) */
  jsonTheme?: 'rjv-default' | 'monokai' | 'ocean' | 'paraiso';
}

/**
 * Extracts the display name from a language map, preferring English
 */
const getDisplayName = (languageMap?: { [key: string]: string }): string => {
  if (!languageMap) return '';
  return languageMap['en-US'] || languageMap['en'] || Object.values(languageMap)[0] || '';
};

/**
 * Formats ISO 8601 duration to human-readable format
 * Example: PT1H30M45S -> "1 hour 30 minutes 45 seconds"
 */
const formatDuration = (isoDuration?: string): string => {
  if (!isoDuration) return 'N/A';
  
  try {
    const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!matches) return isoDuration;

    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseFloat(matches[3] || '0');

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${Math.round(seconds)} second${seconds !== 1 ? 's' : ''}`);

    return parts.length > 0 ? parts.join(' ') : '0 seconds';
  } catch (error) {
    return isoDuration;
  }
};

/**
 * Gets the verb display name from verb object
 */
const getVerbDisplay = (verb: XAPIVerb): string => {
  const displayName = getDisplayName(verb.display);
  if (displayName) return displayName;
  
  // Fallback: extract from verb ID
  const parts = verb.id.split('/');
  return parts[parts.length - 1] || 'unknown';
};

/**
 * Gets color for verb chip based on verb type
 */
const getVerbColor = (verbId: string): 'info' | 'primary' | 'success' | 'error' | 'warning' => {
  const lowercaseId = verbId.toLowerCase();
  
  if (lowercaseId.includes('experienced') || lowercaseId.includes('viewed')) return 'info';
  if (lowercaseId.includes('answered') || lowercaseId.includes('responded')) return 'primary';
  if (lowercaseId.includes('completed')) return 'success';
  if (lowercaseId.includes('passed')) return 'success';
  if (lowercaseId.includes('failed')) return 'error';
  
  return 'warning';
};

/**
 * Single Statement Viewer Component
 */
const StatementCard: React.FC<{
  statement: XAPIStatement;
  jsonTheme: string;
  showJsonByDefault: boolean;
}> = ({ statement, jsonTheme, showJsonByDefault }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopyToClipboard = (data: any, section: string) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const verbDisplay = getVerbDisplay(statement.verb);
  const verbColor = getVerbColor(statement.verb.id);
  const objectName = getDisplayName(statement.object.definition?.name);
  const timestamp = statement.timestamp ? format(parseISO(statement.timestamp), 'PPpp') : 'N/A';

  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={verbDisplay}
              color={verbColor}
              size="small"
            />
            <Typography variant="h6" component="span">
              xAPI Statement
            </Typography>
          </Box>
        }
        subheader={`Recorded: ${timestamp}`}
      />
      <CardContent>
        {/* Actor Section */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1" fontWeight="bold">
                Actor
              </Typography>
              <Tooltip title="The user who performed this action">
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {statement.actor.name && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Name:
                  </Typography>
                  <Typography variant="body1">{statement.actor.name}</Typography>
                </Grid>
              )}
              {statement.actor.mbox && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Email:
                  </Typography>
                  <Typography variant="body1">
                    {statement.actor.mbox.replace('mailto:', '')}
                  </Typography>
                </Grid>
              )}
              {statement.actor.account && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Account:
                  </Typography>
                  <Typography variant="body1">
                    {statement.actor.account.name} ({statement.actor.account.homePage})
                  </Typography>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Object Section */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1" fontWeight="bold">
                Object
              </Typography>
              <Tooltip title="The H5P content that was interacted with">
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {objectName && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Content Name:
                  </Typography>
                  <Typography variant="body1">{objectName}</Typography>
                </Grid>
              )}
              {statement.object.definition?.type && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Type:
                  </Typography>
                  <Typography variant="body1">
                    {statement.object.definition.type.split('/').pop()}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Object ID:
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {statement.object.id}
                </Typography>
              </Grid>
              {statement.object.definition?.description && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Description:
                  </Typography>
                  <Typography variant="body1">
                    {getDisplayName(statement.object.definition.description)}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Result Section */}
        {statement.result && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Result
                </Typography>
                <Tooltip title="The outcome of the interaction">
                  <InfoIcon fontSize="small" color="action" />
                </Tooltip>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {/* Score Display */}
                {statement.result.score && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Score:
                    </Typography>
                    {statement.result.score.scaled !== undefined && (
                      <Box>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="body2">
                            Scaled Score: {(statement.result.score.scaled * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={statement.result.score.scaled * 100}
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>
                    )}
                    {statement.result.score.raw !== undefined && statement.result.score.max !== undefined && (
                      <Typography variant="body1" mt={1}>
                        Raw Score: {statement.result.score.raw} / {statement.result.score.max}
                      </Typography>
                    )}
                  </Grid>
                )}

                {/* Completion Status */}
                {statement.result.completion !== undefined && (
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {statement.result.completion ? (
                        <CheckCircleIcon color="success" />
                      ) : (
                        <RadioButtonUncheckedIcon color="action" />
                      )}
                      <Typography variant="body1">
                        {statement.result.completion ? 'Completed' : 'Not Completed'}
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {/* Success Status */}
                {statement.result.success !== undefined && (
                  <Grid item xs={12} sm={6}>
                    <Chip
                      icon={statement.result.success ? <CheckCircleIcon /> : <CancelIcon />}
                      label={statement.result.success ? 'Passed' : 'Failed'}
                      color={statement.result.success ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </Grid>
                )}

                {/* Response */}
                {statement.result.response && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Response:
                    </Typography>
                    <Alert severity="info" variant="outlined">
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: 'monospace',
                          margin: 0,
                        }}
                      >
                        {statement.result.response}
                      </Typography>
                    </Alert>
                  </Grid>
                )}

                {/* Duration */}
                {statement.result.duration && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Duration:
                    </Typography>
                    <Typography variant="body1">
                      {formatDuration(statement.result.duration)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Context Section */}
        {statement.context && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Context
                </Typography>
                <Tooltip title="Additional contextual information about the activity">
                  <InfoIcon fontSize="small" color="action" />
                </Tooltip>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {statement.context.registration && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Registration ID:
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {statement.context.registration}
                    </Typography>
                  </Grid>
                )}
                {statement.context.platform && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Platform:
                    </Typography>
                    <Typography variant="body1">{statement.context.platform}</Typography>
                  </Grid>
                )}
                {statement.context.language && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Language:
                    </Typography>
                    <Typography variant="body1">{statement.context.language}</Typography>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Full JSON View */}
        <Accordion defaultExpanded={showJsonByDefault}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Raw Statement Data (JSON)
                </Typography>
                <Tooltip title="Complete xAPI statement in JSON format">
                  <InfoIcon fontSize="small" color="action" />
                </Tooltip>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyToClipboard(statement, 'full');
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {copiedSection === 'full' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Copied to clipboard!
              </Alert>
            )}
            <ReactJson
              src={statement}
              theme={jsonTheme as any}
              collapsed={1}
              displayDataTypes={false}
              displayObjectSize={true}
              enableClipboard={true}
              name="statement"
              iconStyle="triangle"
              style={{
                padding: '1rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
};

/**
 * xAPI Statement Viewer Component
 * 
 * Main component for displaying xAPI statements with filtering and navigation
 */
const xAPIStatementViewer: React.FC<XAPIStatementViewerProps> = ({
  statements,
  showJsonByDefault = false,
  jsonTheme = 'rjv-default',
}) => {
  const statementsArray = Array.isArray(statements) ? statements : [statements];
  const [selectedTab, setSelectedTab] = useState(0);
  const [verbFilter, setVerbFilter] = useState<string>('all');

  // Extract unique verb types for filtering
  const availableVerbs = useMemo(() => {
    const verbs = new Set<string>();
    statementsArray.forEach((stmt) => {
      const verbDisplay = getVerbDisplay(stmt.verb);
      verbs.add(verbDisplay);
    });
    return Array.from(verbs).sort();
  }, [statementsArray]);

  // Filter statements by verb
  const filteredStatements = useMemo(() => {
    if (verbFilter === 'all') return statementsArray;
    return statementsArray.filter((stmt) => {
      const verbDisplay = getVerbDisplay(stmt.verb);
      return verbDisplay === verbFilter;
    });
  }, [statementsArray, verbFilter]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  const handleVerbFilterChange = (event: any) => {
    setVerbFilter(event.target.value);
    setSelectedTab(0); // Reset to first tab when filter changes
  };

  // Single statement view
  if (filteredStatements.length === 1) {
    return (
      <Box>
        {availableVerbs.length > 1 && (
          <Box mb={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter by Verb</InputLabel>
              <Select
                value={verbFilter}
                label="Filter by Verb"
                onChange={handleVerbFilterChange}
              >
                <MenuItem value="all">All Verbs</MenuItem>
                {availableVerbs.map((verb) => (
                  <MenuItem key={verb} value={verb}>
                    {verb}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <StatementCard
          statement={filteredStatements[0]}
          jsonTheme={jsonTheme}
          showJsonByDefault={showJsonByDefault}
        />
      </Box>
    );
  }

  // Multiple statements view with tabs
  return (
    <Box>
      {availableVerbs.length > 1 && (
        <Box mb={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Filter by Verb</InputLabel>
            <Select
              value={verbFilter}
              label="Filter by Verb"
              onChange={handleVerbFilterChange}
            >
              <MenuItem value="all">All Verbs ({statementsArray.length})</MenuItem>
              {availableVerbs.map((verb) => {
                const count = statementsArray.filter(
                  (stmt) => getVerbDisplay(stmt.verb) === verb
                ).length;
                return (
                  <MenuItem key={verb} value={verb}>
                    {verb} ({count})
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>
      )}

      {filteredStatements.length === 0 ? (
        <Alert severity="info">No statements match the selected filter.</Alert>
      ) : (
        <>
          <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            {filteredStatements.map((stmt, index) => {
              const verbDisplay = getVerbDisplay(stmt.verb);
              const timestamp = stmt.timestamp
                ? format(parseISO(stmt.timestamp), 'HH:mm:ss')
                : `#${index + 1}`;
              return (
                <Tab
                  key={stmt.id || index}
                  label={`${verbDisplay} - ${timestamp}`}
                  id={`statement-tab-${index}`}
                  aria-controls={`statement-tabpanel-${index}`}
                />
              );
            })}
          </Tabs>

          {filteredStatements.map((stmt, index) => (
            <Box
              key={stmt.id || index}
              role="tabpanel"
              hidden={selectedTab !== index}
              id={`statement-tabpanel-${index}`}
              aria-labelledby={`statement-tab-${index}`}
            >
              {selectedTab === index && (
                <StatementCard
                  statement={stmt}
                  jsonTheme={jsonTheme}
                  showJsonByDefault={showJsonByDefault}
                />
              )}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
};

export default xAPIStatementViewer;
