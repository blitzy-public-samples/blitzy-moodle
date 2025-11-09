import type React from 'react';
import { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Paper,
  Alert,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type {
  Workshop,
  WorkshopAssessment as BaseWorkshopAssessment,
  DimensionGrade,
} from '@/features/activities/workshop/types';

/**
 * Extended assessment dimension that combines dimension grade with metadata
 * Used for displaying and comparing dimension-level assessments
 */
interface AssessmentDimension extends DimensionGrade {
  id: number;
  description: string;
  weight: number;
  criterionName?: string;
}

/**
 * Extended workshop assessment that includes dimension grades
 * The shared WorkshopAssessment type doesn't include dimensions inline,
 * but this component needs them for comparison purposes
 */
interface WorkshopAssessment extends BaseWorkshopAssessment {
  dimensions: AssessmentDimension[];
}

/**
 * Comparison data showing differences between assessments
 */
interface ComparisonData {
  dimensionDifferences: DimensionComparison[];
  overallAgreement: number;
  feedbackSimilarity: number;
}

/**
 * Individual dimension comparison
 */
interface DimensionComparison {
  dimensionId: number;
  criterionName: string;
  referenceGrade: number;
  userGrade: number;
  difference: number;
  percentageDifference: number;
  matchType: 'exact' | 'close' | 'significant';
}

/**
 * Props for AssessmentComparison component
 */
interface AssessmentComparisonProps {
  referenceAssessment: WorkshopAssessment | null;
  userAssessment: WorkshopAssessment;
  workshop: Workshop;
  comparisonData?: ComparisonData;
  onReassess?: () => void;
  canReassess?: boolean;
}

/**
 * Agreement level thresholds
 */
const AGREEMENT_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  FAIR: 60,
} as const;

/**
 * Difference tolerance for "close" matches (as percentage)
 */
const CLOSE_MATCH_TOLERANCE = 10;

/**
 * Calculate the agreement percentage between two assessments
 */
function calculateAgreement(
  referenceAssessment: WorkshopAssessment,
  userAssessment: WorkshopAssessment
): number {
  if (!referenceAssessment.dimensions || referenceAssessment.dimensions.length === 0) {
    return 0;
  }

  let totalDifference = 0;
  let totalPossible = 0;
  let matchedDimensions = 0;

  referenceAssessment.dimensions.forEach((refDim) => {
    const userDim = userAssessment.dimensions.find(
      (d) => d.dimensionId === refDim.dimensionId
    );

    if (userDim) {
      matchedDimensions++;
      const refGrade = refDim.grade ?? 0;
      const userGrade = userDim.grade ?? 0;
      const maxGrade = Math.max(refGrade, userGrade, refDim.weight || 100);
      const difference = Math.abs(refGrade - userGrade);
      
      totalDifference += difference;
      totalPossible += maxGrade;
    }
  });

  if (totalPossible === 0 || matchedDimensions === 0) {
    return 0;
  }

  // Calculate agreement as inverse of average difference percentage
  const averageDifferencePercentage = (totalDifference / totalPossible) * 100;
  const agreement = Math.max(0, 100 - averageDifferencePercentage);

  return Math.round(agreement * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate dimension-by-dimension comparison
 */
function calculateDimensionComparisons(
  referenceAssessment: WorkshopAssessment,
  userAssessment: WorkshopAssessment
): DimensionComparison[] {
  if (!referenceAssessment.dimensions) {
    return [];
  }

  return referenceAssessment.dimensions.map((refDim) => {
    const userDim = userAssessment.dimensions.find(
      (d) => d.dimensionId === refDim.dimensionId
    );

    const userGrade = userDim?.grade ?? 0;
    const refGrade = refDim.grade ?? 0;
    const difference = userGrade - refGrade;
    const maxGrade = refDim.weight || 100;
    const percentageDifference = (Math.abs(difference) / maxGrade) * 100;

    let matchType: 'exact' | 'close' | 'significant';
    if (percentageDifference === 0) {
      matchType = 'exact';
    } else if (percentageDifference <= CLOSE_MATCH_TOLERANCE) {
      matchType = 'close';
    } else {
      matchType = 'significant';
    }

    return {
      dimensionId: refDim.dimensionId,
      criterionName: refDim.criterionName ?? refDim.description ?? `Criterion ${refDim.dimensionId}`,
      referenceGrade: refGrade,
      userGrade,
      difference,
      percentageDifference: Math.round(percentageDifference * 10) / 10,
      matchType,
    };
  });
}

/**
 * Get agreement feedback based on percentage
 */
function getAgreementFeedback(agreementPercentage: number): {
  level: string;
  message: string;
  color: 'success' | 'info' | 'warning' | 'error';
  icon: React.ReactElement;
} {
  if (agreementPercentage >= AGREEMENT_THRESHOLDS.EXCELLENT) {
    return {
      level: 'Excellent',
      message: 'Your assessment closely matches the reference assessment. You have demonstrated a strong understanding of the assessment criteria.',
      color: 'success',
      icon: <CheckCircleIcon />,
    };
  } else if (agreementPercentage >= AGREEMENT_THRESHOLDS.GOOD) {
    return {
      level: 'Good',
      message: 'Your assessment is generally aligned with the reference. Review the specific differences to further improve your assessment skills.',
      color: 'info',
      icon: <CheckCircleIcon />,
    };
  } else if (agreementPercentage >= AGREEMENT_THRESHOLDS.FAIR) {
    return {
      level: 'Fair',
      message: 'Your assessment shows some understanding, but there are notable differences from the reference. Please review the criteria carefully and consider reassessing.',
      color: 'warning',
      icon: <WarningIcon />,
    };
  } 
    return {
      level: 'Needs Improvement',
      message: 'Your assessment differs significantly from the reference. Please review the assessment criteria and example more carefully before reassessing.',
      color: 'error',
      icon: <ErrorIcon />,
    };
  
}

/**
 * Get match type color for visual highlighting
 */
function getMatchTypeColor(matchType: 'exact' | 'close' | 'significant'): string {
  switch (matchType) {
    case 'exact':
      return '#4caf50'; // Green
    case 'close':
      return '#ff9800'; // Orange/Yellow
    case 'significant':
      return '#f44336'; // Red
  }
}

/**
 * Get improvement tips based on comparison data
 */
function getImprovementTips(dimensionComparisons: DimensionComparison[]): string[] {
  const tips: string[] = [];

  const significantDifferences = dimensionComparisons.filter(
    (d) => d.matchType === 'significant'
  );

  if (significantDifferences.length > 0) {
    tips.push(
      `You have ${significantDifferences.length} criterion/criteria with significant differences. Focus on understanding these specific assessment criteria.`
    );
  }

  const allTooLow = dimensionComparisons.every((d) => d.difference < -5);
  const allTooHigh = dimensionComparisons.every((d) => d.difference > 5);

  if (allTooLow) {
    tips.push(
      'Your scores are consistently lower than the reference. You may be assessing too strictly. Review the grading criteria to ensure you understand the standards.'
    );
  } else if (allTooHigh) {
    tips.push(
      'Your scores are consistently higher than the reference. You may be assessing too leniently. Pay careful attention to the specific requirements of each criterion.'
    );
  }

  const highVariance = dimensionComparisons.some(
    (d) => d.percentageDifference > 50
  );
  if (highVariance) {
    tips.push(
      'Some of your scores differ greatly from the reference. Take time to carefully read both the criterion description and the submission before scoring.'
    );
  }

  if (tips.length === 0) {
    tips.push(
      'Continue to practice assessing submissions to maintain your assessment skills.'
    );
  }

  return tips;
}

/**
 * AssessmentComparison Component
 * 
 * Displays a side-by-side comparison of a reference assessment and user's assessment
 * for workshop example submissions. Highlights differences and provides feedback
 * on assessment quality to help users improve their assessment skills.
 */
function AssessmentComparison({
  referenceAssessment,
  userAssessment,
  workshop,
  comparisonData,
  onReassess,
  canReassess = false,
}: AssessmentComparisonProps): React.ReactElement {
  // Calculate comparison if not provided
  const calculatedComparison = useMemo(() => {
    if (comparisonData) {
      return comparisonData;
    }

    if (!referenceAssessment) {
      return {
        dimensionDifferences: [],
        overallAgreement: 0,
        feedbackSimilarity: 0,
      };
    }

    const dimensionDifferences = calculateDimensionComparisons(
      referenceAssessment,
      userAssessment
    );
    const overallAgreement = calculateAgreement(referenceAssessment, userAssessment);

    return {
      dimensionDifferences,
      overallAgreement,
      feedbackSimilarity: 0, // Would require text comparison algorithm
    };
  }, [referenceAssessment, userAssessment, comparisonData]);

  const agreementFeedback = useMemo(
    () => getAgreementFeedback(calculatedComparison.overallAgreement),
    [calculatedComparison.overallAgreement]
  );

  const improvementTips = useMemo(
    () => getImprovementTips(calculatedComparison.dimensionDifferences),
    [calculatedComparison.dimensionDifferences]
  );

  // Handle case where reference assessment doesn't exist
  if (!referenceAssessment) {
    return (
      <Card>
        <CardContent>
          <Alert severity="info">
            No reference assessment is available for this example. Your assessment has been recorded,
            but comparison is not possible without a reference.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Overall Agreement Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" component="h2">
              Assessment Comparison
            </Typography>
            <Chip
              icon={agreementFeedback.icon}
              label={`${calculatedComparison.overallAgreement}% Agreement`}
              color={agreementFeedback.color}
              size="medium"
            />
          </Box>

          <Alert severity={agreementFeedback.color} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Assessment Quality: {agreementFeedback.level}
            </Typography>
            <Typography variant="body2">
              {agreementFeedback.message}
            </Typography>
          </Alert>

          {canReassess && onReassess && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={onReassess}
              fullWidth
            >
              Reassess Example
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dimension Comparison Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            Detailed Comparison by Criterion
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Criterion</strong></TableCell>
                  <TableCell align="right"><strong>Reference Score</strong></TableCell>
                  <TableCell align="right"><strong>Your Score</strong></TableCell>
                  <TableCell align="right"><strong>Difference</strong></TableCell>
                  <TableCell align="center"><strong>Match</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {calculatedComparison.dimensionDifferences.map((comparison) => (
                  <TableRow
                    key={comparison.dimensionId}
                    sx={{
                      backgroundColor:
                        comparison.matchType === 'exact'
                          ? 'rgba(76, 175, 80, 0.08)'
                          : comparison.matchType === 'close'
                          ? 'rgba(255, 152, 0, 0.08)'
                          : 'rgba(244, 67, 54, 0.08)',
                    }}
                  >
                    <TableCell>{comparison.criterionName}</TableCell>
                    <TableCell align="right">{comparison.referenceGrade}</TableCell>
                    <TableCell align="right">{comparison.userGrade}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          comparison.difference > 0
                            ? '#d32f2f'
                            : comparison.difference < 0
                            ? '#1976d2'
                            : '#666',
                        fontWeight: 'bold',
                      }}
                    >
                      {comparison.difference > 0 ? '+' : ''}
                      {comparison.difference} ({comparison.percentageDifference}%)
                    </TableCell>
                    <TableCell align="center">
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: getMatchTypeColor(comparison.matchType),
                          display: 'inline-block',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: '#4caf50',
                }}
              />
              <Typography variant="caption">Exact Match</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: '#ff9800',
                }}
              />
              <Typography variant="caption">Close Match (±{CLOSE_MATCH_TOLERANCE}%)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: '#f44336',
                }}
              />
              <Typography variant="caption">Significant Difference</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Feedback Comparison */}
      {referenceAssessment.feedbackAuthor && userAssessment.feedbackAuthor && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
              Feedback Comparison
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                    Reference Feedback
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {referenceAssessment.feedbackAuthor}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="secondary" sx={{ mb: 1 }}>
                    Your Feedback
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {userAssessment.feedbackAuthor}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Improvement Tips */}
      <Card>
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            Tips for Improvement
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            {improvementTips.map((tip) => (
              <Typography component="li" variant="body2" key={tip} sx={{ mb: 1 }}>
                {tip}
              </Typography>
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            <strong>Grading Grade:</strong> Your assessment quality score for this example is{' '}
            {userAssessment.gradingGrade !== null && userAssessment.gradingGrade !== undefined
              ? `${userAssessment.gradingGrade} / ${workshop.gradingGrade}`
              : 'pending calculation'}.
            This reflects how well your assessment matched the reference assessment.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default AssessmentComparison;
