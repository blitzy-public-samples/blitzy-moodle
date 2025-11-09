import type React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Stack,
  Divider,
  Skeleton,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Help as HelpIcon,
  AccessTime as AccessTimeIcon,
  Event as EventIcon,
  Score as ScoreIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

/**
 * Interface for H5P result additional data (xAPI statements)
 */
interface H5PResultAdditionals {
  statement?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Interface for H5P activity result entry
 */
interface H5PResult {
  id: number;
  attemptid: number;
  subcontent: string;
  timecreated: number;
  interactiontype: string;
  description: string;
  response: string;
  correctpattern: string | null;
  rawscore: number;
  maxscore: number;
  duration: number | null;
  completion: number;
  success: number | null;
  additionals: string | null;
}

/**
 * Interface for H5P activity attempt
 */
interface H5PAttempt {
  id: number;
  h5pactivityid: number;
  userid: number;
  timecreated: number;
  timemodified: number;
  attempt: number;
  rawscore: number;
  maxscore: number;
  duration: number | null;
  completion: number;
  success: number | null;
  scaled: number | null;
}

/**
 * Interface for results detail data
 */
interface ResultsDetailData {
  attempt: H5PAttempt;
  results: H5PResult[];
}

/**
 * Props for ResultsDetail component
 */
interface ResultsDetailProps {
  data: ResultsDetailData | null;
  loading?: boolean;
}

/**
 * Interaction type labels mapping
 */
const INTERACTION_TYPE_LABELS: Record<string, string> = {
  choice: 'Multiple Choice',
  'true-false': 'True/False',
  'fill-in': 'Fill in the Blanks',
  'long-fill-in': 'Long Fill in',
  matching: 'Matching',
  sequencing: 'Sequencing',
  compound: 'Compound',
  other: 'Other',
};

/**
 * Get human-readable duration string from seconds
 */
const formatDuration = (seconds: number): string => {
  if (seconds === 0) {
    return '0 seconds';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  if (secs > 0) {
    parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
  }

  return parts.join(' ');
};

/**
 * Decode H5P response string into array format
 * H5P uses special delimiters: [,] for list, [.] for pairs, [:] for ranges
 */
const decodeResponse = (value: string): Array<string | string[]> => {
  if (!value) {
    return [];
  }

  const list = value.split('[,]');

  return list.map((item) => {
    if (item.includes('[.]')) {
      return item.split('[.]');
    }
    if (item.includes('[:]')) {
      return item.split('[:]');
    }
    return item;
  });
};

/**
 * Parse H5P additionals JSON string
 */
const parseAdditionals = (additionals: string | null): H5PResultAdditionals | null => {
  if (!additionals) {
    return null;
  }

  try {
    return JSON.parse(additionals) as H5PResultAdditionals;
  } catch (error) {
    console.error('Failed to parse additionals:', error);
    return null;
  }
};

/**
 * Component for rendering different interaction type responses
 */
function ResponseRenderer({
  interactiontype,
  response,
  correctpattern,
}: {
  interactiontype: string;
  response: string;
  correctpattern: string | null;
}): React.ReactElement {
  const decodedResponse = decodeResponse(response);
  const decodedCorrect = correctpattern ? decodeResponse(correctpattern) : null;

  // True-False rendering
  if (interactiontype === 'true-false') {
    const userAnswer = decodedResponse[0] as string;
    const correctAnswer = decodedCorrect ? (decodedCorrect[0] as string) : null;

    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Your answer:
          </Typography>
          <Chip
            icon={
              userAnswer === 'true' ? <RadioButtonUncheckedIcon /> : <RadioButtonUncheckedIcon />
            }
            label={userAnswer === 'true' ? 'True' : 'False'}
            color={userAnswer === correctAnswer ? 'success' : 'error'}
            size="small"
          />
        </Stack>
        {correctAnswer && userAnswer !== correctAnswer && (
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Correct answer:
            </Typography>
            <Chip
              icon={<CheckCircleIcon />}
              label={correctAnswer === 'true' ? 'True' : 'False'}
              color="success"
              variant="outlined"
              size="small"
            />
          </Stack>
        )}
      </Box>
    );
  }

  // Choice (multiple choice) rendering
  if (interactiontype === 'choice') {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Your answer:
        </Typography>
        <Stack spacing={1}>
          {decodedResponse.map((item) => {
            const isCorrect = decodedCorrect?.includes(item);
            return (
              <Box
                key={`choice-${String(item)}`}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {isCorrect ? (
                  <CheckBoxIcon color="success" fontSize="small" />
                ) : (
                  <CheckBoxOutlineBlankIcon color="error" fontSize="small" />
                )}
                <Typography variant="body2">{String(item)}</Typography>
              </Box>
            );
          })}
        </Stack>
        {decodedCorrect && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Correct answer:
            </Typography>
            <Stack spacing={1}>
              {decodedCorrect.map((item) => (
                <Box
                  key={`correct-${String(item)}`}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography variant="body2">{String(item)}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    );
  }

  // Fill-in or long-fill-in rendering
  if (interactiontype === 'fill-in' || interactiontype === 'long-fill-in') {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {decodedResponse.join(', ')}
          </Typography>
        </Alert>
        {decodedCorrect && decodedCorrect.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Acceptable answers:
            </Typography>
            <Alert severity="success" variant="outlined">
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {decodedCorrect.map((item) => String(item)).join(', ')}
              </Typography>
            </Alert>
          </Box>
        )}
      </Box>
    );
  }

  // Matching rendering
  if (interactiontype === 'matching') {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Your matches:
        </Typography>
        <Grid container spacing={2}>
          {decodedResponse.map((item, index) => {
            if (Array.isArray(item)) {
              const [source, target] = item;
              const correctPair = decodedCorrect?.[index];
              const isCorrect =
                Array.isArray(correctPair) &&
                correctPair[0] === source &&
                correctPair[1] === target;

              return (
                <Grid item xs={12} key={`match-${String(source)}-${String(target)}`}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      backgroundColor: isCorrect ? 'success.light' : 'error.light',
                      borderColor: isCorrect ? 'success.main' : 'error.main',
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {source}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        →
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {target}
                      </Typography>
                      {isCorrect ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <CancelIcon color="error" fontSize="small" />
                      )}
                    </Stack>
                  </Paper>
                </Grid>
              );
            }
            return null;
          })}
        </Grid>
      </Box>
    );
  }

  // Default rendering for other types
  return (
    <Alert severity="info">
      <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
        {response}
      </Typography>
    </Alert>
  );
}

/**
 * Component for displaying xAPI statement data
 */
function XAPIStatementViewer({
  additionals,
}: {
  additionals: H5PResultAdditionals;
}): React.ReactElement {
  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' }}>
      <Typography variant="subtitle2" gutterBottom color="text.secondary">
        xAPI Statement Data
      </Typography>
      <Box
        component="pre"
        sx={{
          fontSize: '0.75rem',
          overflow: 'auto',
          maxHeight: '200px',
          fontFamily: 'monospace',
          backgroundColor: 'background.paper',
          p: 1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {JSON.stringify(additionals, null, 2)}
      </Box>
    </Paper>
  );
}

/**
 * ResultsDetail Component
 *
 * Displays detailed results of a single H5P activity attempt with question-level breakdown,
 * responses, correctness indicators, and scoring information.
 */
function ResultsDetail({ data, loading = false }: ResultsDetailProps): React.ReactElement {
  // Loading state
  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="rectangular" height={60} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Skeleton variant="text" width="40%" height={30} />
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Skeleton variant="rectangular" height={50} />
              <Skeleton variant="rectangular" height={50} />
              <Skeleton variant="rectangular" height={50} />
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Empty state
  if (!data?.results || data.results.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <HelpIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Results Available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This attempt does not have any results to display.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const { attempt, results } = data;

  // Calculate statistics
  const totalQuestions = results.length;
  const questionsAnswered = results.filter((r) => r.response && r.response.length > 0).length;
  const correctAnswers = results.filter((r) => r.success === 1).length;
  const completedResults = results.filter((r) => r.completion === 1).length;
  const completionPercentage =
    totalQuestions > 0 ? Math.round((completedResults / totalQuestions) * 100) : 0;
  const scorePercentage =
    attempt.maxscore > 0 ? Math.round((attempt.rawscore / attempt.maxscore) * 100) : 0;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Attempt Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom fontWeight="bold">
            Attempt #{attempt.attempt} Results
          </Typography>

          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EventIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Started
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {format(new Date(attempt.timecreated * 1000), 'MMM d, yyyy HH:mm')}
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTimeIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Duration
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {attempt.duration ? formatDuration(attempt.duration) : 'N/A'}
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ScoreIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Total Score
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {attempt.rawscore} / {attempt.maxscore}
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip
                    icon={
                      attempt.completion === 1 ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />
                    }
                    label={attempt.completion === 1 ? 'Complete' : 'Incomplete'}
                    color={attempt.completion === 1 ? 'success' : 'default'}
                    size="small"
                  />
                  {attempt.success !== null && (
                    <Chip
                      icon={attempt.success === 1 ? <CheckCircleIcon /> : <CancelIcon />}
                      label={attempt.success === 1 ? 'Pass' : 'Fail'}
                      color={attempt.success === 1 ? 'success' : 'error'}
                      size="small"
                    />
                  )}
                </Stack>
              </Stack>
            </Grid>
          </Grid>

          {/* Overall Score Progress */}
          <Box sx={{ mt: 3 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                Overall Score
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                {scorePercentage}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={scorePercentage}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Attempt Statistics
          </Typography>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6} sm={3}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {totalQuestions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Questions
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main" fontWeight="bold">
                  {questionsAnswered}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Answered
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {correctAnswers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Correct
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="secondary.main" fontWeight="bold">
                  {completionPercentage}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completion
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Detailed Results
          </Typography>

          <Stack spacing={1} sx={{ mt: 2 }}>
            {results.map((result, index) => {
              const additionals = parseAdditionals(result.additionals);
              const hasXAPIData = additionals !== null && Object.keys(additionals).length > 0;
              const scorePercentageResult =
                result.maxscore > 0 ? Math.round((result.rawscore / result.maxscore) * 100) : 0;

              return (
                <Accordion key={result.id}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      backgroundColor:
                        result.success === 1
                          ? 'success.lighter'
                          : result.success === 0
                            ? 'error.lighter'
                            : 'grey.50',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      sx={{ width: '100%', pr: 2 }}
                    >
                      <Typography variant="body1" fontWeight="bold" sx={{ minWidth: '80px' }}>
                        Question {index + 1}
                      </Typography>

                      <Chip
                        label={
                          INTERACTION_TYPE_LABELS[result.interactiontype] ?? result.interactiontype
                        }
                        size="small"
                        color="primary"
                        variant="outlined"
                      />

                      <Box sx={{ flex: 1 }} />

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight="medium">
                          {result.rawscore} / {result.maxscore}
                        </Typography>
                        {result.success !== null &&
                          (result.success === 1 ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <CancelIcon color="error" fontSize="small" />
                          ))}
                      </Stack>
                    </Stack>
                  </AccordionSummary>

                  <AccordionDetails>
                    <Stack spacing={3}>
                      {/* Question Description */}
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Question
                        </Typography>
                        <Typography variant="body1">
                          {result.description || 'No description available'}
                        </Typography>
                      </Box>

                      <Divider />

                      {/* Response */}
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Response
                        </Typography>
                        <ResponseRenderer
                          interactiontype={result.interactiontype}
                          response={result.response}
                          correctpattern={result.correctpattern}
                        />
                      </Box>

                      <Divider />

                      {/* Score and Status */}
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Score
                          </Typography>
                          <Box>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 0.5 }}
                            >
                              <Typography variant="body2">
                                {result.rawscore} / {result.maxscore} points
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="primary">
                                {scorePercentageResult}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={scorePercentageResult}
                              sx={{ height: 6, borderRadius: 1 }}
                            />
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Status
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip
                              icon={
                                result.completion === 1 ? (
                                  <CheckCircleIcon />
                                ) : (
                                  <RadioButtonUncheckedIcon />
                                )
                              }
                              label={result.completion === 1 ? 'Completed' : 'Incomplete'}
                              color={result.completion === 1 ? 'success' : 'default'}
                              size="small"
                            />
                            {result.success !== null && (
                              <Chip
                                icon={result.success === 1 ? <CheckCircleIcon /> : <CancelIcon />}
                                label={result.success === 1 ? 'Correct' : 'Incorrect'}
                                color={result.success === 1 ? 'success' : 'error'}
                                size="small"
                              />
                            )}
                          </Stack>
                        </Grid>
                      </Grid>

                      {/* xAPI Statement Data */}
                      {hasXAPIData && additionals && (
                        <>
                          <Divider />
                          <XAPIStatementViewer additionals={additionals} />
                        </>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ResultsDetail;
