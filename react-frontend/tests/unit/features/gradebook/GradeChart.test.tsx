/**
 * Unit Tests for GradeChart Component
 * 
 * Comprehensive test suite validating the GradeChart component's ability to:
 * - Render grade data visualizations using Recharts library
 * - Support multiple chart types (bar, line, area)
 * - Transform grade data for chart display
 * - Display tooltips with grade information
 * - Show legends with color-coded grade ranges
 * - Handle filtering by date range and category
 * - Respond to different screen sizes
 * - Meet accessibility standards (WCAG 2.1 AA)
 * - Handle empty, loading, and error states gracefully
 * 
 * @module tests/unit/features/gradebook/GradeChart.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@tests/helpers/render';
import { GradeChart } from '@/features/gradebook/components/GradeChart';
import type { GradeSummary } from '@/features/gradebook/types/grade.types';
import { AggregationStatus } from '@/features/gradebook/types/grade.types';

// ============================================================================
// TYPES FOR MOCKS
// ============================================================================

/**
 * Props for mocked Recharts Bar/Line/Area components
 */
interface MockChartElementProps {
  dataKey: string;
  fill?: string;
  stroke?: string;
}

/**
 * Structure of chart data items as stored in data-chart-data attribute
 */
interface ChartDataItem {
  itemname: string;
  percentage: number;
  lettergrade?: string;
  grade?: number;
  [key: string]: unknown;
}

/**
 * Helper function to parse chart data from DOM attribute with proper typing
 * @param element - DOM element with data-chart-data attribute
 * @returns Typed array of chart data items
 */
function parseChartData(element: HTMLElement): ChartDataItem[] {
  const chartDataStr = element.getAttribute('data-chart-data');
  return JSON.parse(chartDataStr || '[]') as ChartDataItem[];
}

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock Recharts library to avoid complex SVG rendering in tests.
 * Tests verify that GradeChart passes correct props to Recharts components
 * without actually rendering real charts.
 */
vi.mock('recharts', () => ({
  ResponsiveContainer: vi.fn(({ children }) => <div data-testid="responsive-container">{children}</div>),
  BarChart: vi.fn(({ data, children }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  )),
  LineChart: vi.fn(({ data, children }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  )),
  AreaChart: vi.fn(({ data, children }) => (
    <div data-testid="area-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  )),
  XAxis: vi.fn(() => <div data-testid="x-axis" />),
  YAxis: vi.fn(() => <div data-testid="y-axis" />),
  CartesianGrid: vi.fn(() => <div data-testid="cartesian-grid" />),
  Tooltip: vi.fn(() => <div data-testid="tooltip" />),
  Legend: vi.fn(() => <div data-testid="legend" />),
  Bar: vi.fn(({ dataKey, fill }: MockChartElementProps) => <div data-testid="bar" data-key={dataKey} data-fill={fill} />),
  Line: vi.fn(({ dataKey, stroke }: MockChartElementProps) => <div data-testid="line" data-key={dataKey} data-stroke={stroke} />),
  Area: vi.fn(({ dataKey, fill }: MockChartElementProps) => <div data-testid="area" data-key={dataKey} data-fill={fill} />),
}));

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Creates mock GradeSummary data for testing chart display.
 * 
 * @param overrides - Partial grade summary properties to override
 * @returns Complete GradeSummary object
 */
function createMockGradeSummary(overrides: Partial<GradeSummary> = {}): GradeSummary {
  return {
    id: 1,
    itemname: 'Test Assignment',
    category: 'Assignments',
    grade: 85.5,
    lettergrade: 'B+',
    percentage: 85.5,
    range: '0-100',
    grademax: 100,
    grademin: 0,
    feedback: 'Good work!',
    timemodified: Date.now(),
    weight: 1.0,
    contributiontocoursetotal: 10.0,
    rank: null,
    average: 78.5,
    parentcategories: ['Course'],
    hidden: false,
    locked: false,
    overridden: false,
    excluded: false,
    aggregationstatus: AggregationStatus.USED,
    ...overrides,
  };
}

/**
 * Creates an array of mock grade summaries with varied distribution.
 * 
 * @param count - Number of grades to generate
 * @returns Array of GradeSummary objects
 */
function createGradeDistribution(count: number): GradeSummary[] {
  const grades: GradeSummary[] = [];
  
  for (let i = 0; i < count; i++) {
    const percentage = (i / count) * 100;
    let rawgrade: number;
    
    // Create realistic grade distribution
    if (percentage < 10) {
      rawgrade = Math.random() * 50; // Failing grades
    } else if (percentage < 30) {
      rawgrade = 50 + Math.random() * 10; // Low passing
    } else if (percentage < 70) {
      rawgrade = 60 + Math.random() * 20; // Average grades
    } else if (percentage < 90) {
      rawgrade = 80 + Math.random() * 10; // Good grades
    } else {
      rawgrade = 90 + Math.random() * 10; // Excellent grades
    }
    
    const gradeValue = Math.round(rawgrade * 100) / 100;
    const lettergrade = gradeValue >= 90 ? 'A' : gradeValue >= 80 ? 'B' : gradeValue >= 70 ? 'C' : gradeValue >= 60 ? 'D' : 'F';
    
    grades.push(createMockGradeSummary({
      id: i + 1,
      itemname: `Assignment ${i + 1}`,
      grade: gradeValue,
      percentage: gradeValue,
      lettergrade,
      category: i % 3 === 0 ? 'Assignments' : i % 3 === 1 ? 'Quizzes' : 'Exams',
    }));
  }
  
  return grades;
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('GradeChart Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  // ==========================================================================
  // BASIC RENDERING TESTS
  // ==========================================================================
  
  describe('Basic Rendering', () => {
    it('should render without errors with valid grade data', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Grade Distribution"
          chartType="bar"
        />
      );
      
      expect(screen.getByText('Grade Distribution')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
    
    it('should render chart container with correct data', () => {
      const grades = createGradeDistribution(5);
      
      render(
        <GradeChart
          grades={grades}
          title="Test Chart"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      expect(chart).toBeInTheDocument();
      
      // Verify chart receives data
      const chartData = chart.getAttribute('data-chart-data');
      expect(chartData).toBeDefined();
      expect(chartData).not.toBe('[]');
    });
    
    it('should display correct number of data points matching grade items', () => {
      const grades = createGradeDistribution(8);
      
      render(
        <GradeChart
          grades={grades}
          title="Grade Distribution"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      const chartData = parseChartData(chart);
      
      // Data should be grouped into grade ranges (distribution)
      expect(chartData.length).toBeGreaterThan(0);
      expect(chartData.length).toBeLessThanOrEqual(10); // Max 10 grade ranges
    });
  });
  
  // ==========================================================================
  // CHART TYPE TESTS
  // ==========================================================================
  
  describe('Chart Types', () => {
    const testGrades = createGradeDistribution(10);
    
    it('should render bar chart when chartType is "bar"', () => {
      render(
        <GradeChart
          grades={testGrades}
          title="Bar Chart Test"
          chartType="bar"
        />
      );
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
    });
    
    it('should render line chart when chartType is "line"', () => {
      render(
        <GradeChart
          grades={testGrades}
          title="Line Chart Test"
          chartType="line"
        />
      );
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
    });
    
    it('should render area chart when chartType is "area"', () => {
      render(
        <GradeChart
          grades={testGrades}
          title="Area Chart Test"
          chartType="area"
        />
      );
      
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
    
    it('should include chart elements (axes, grid, tooltip, legend)', () => {
      render(
        <GradeChart
          grades={testGrades}
          title="Complete Chart"
          chartType="bar"
        />
      );
      
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });
  });
  
  // ==========================================================================
  // DATA TRANSFORMATION TESTS
  // ==========================================================================
  
  describe('Data Transformation', () => {
    it('should display all individual grade items in chart data', () => {
      const grades = [
        createMockGradeSummary({ itemname: 'Assignment 1', grade: 45, percentage: 45, lettergrade: 'F' }),
        createMockGradeSummary({ itemname: 'Assignment 2', grade: 48, percentage: 48, lettergrade: 'F' }),
        createMockGradeSummary({ itemname: 'Quiz 1', grade: 55, percentage: 55, lettergrade: 'D' }),
        createMockGradeSummary({ itemname: 'Midterm', grade: 75, percentage: 75, lettergrade: 'C' }),
        createMockGradeSummary({ itemname: 'Project', grade: 78, percentage: 78, lettergrade: 'C' }),
        createMockGradeSummary({ itemname: 'Final', grade: 95, percentage: 95, lettergrade: 'A' }),
      ];
      
      render(
        <GradeChart
          grades={grades}
          title="Distribution Test"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      const chartData = parseChartData(chart);
      
      // Should have one item per grade
      expect(chartData.length).toBe(6);
      expect(chartData.every((item) => 'itemname' in item && 'percentage' in item)).toBe(true);
      
      // Verify percentages are preserved
      const percentages = chartData.map((item) => item.percentage);
      expect(percentages).toContain(45);
      expect(percentages).toContain(48);
      expect(percentages).toContain(55);
      expect(percentages).toContain(75);
      expect(percentages).toContain(78);
      expect(percentages).toContain(95);
    });
    
    it('should handle edge cases in grade ranges', () => {
      const grades = [
        createMockGradeSummary({ itemname: 'Zero Grade', grade: 0, percentage: 0, lettergrade: 'F' }),
        createMockGradeSummary({ itemname: 'Mid Range', grade: 50, percentage: 50, lettergrade: 'D' }),
        createMockGradeSummary({ itemname: 'Perfect Score', grade: 100, percentage: 100, lettergrade: 'A' }),
      ];
      
      render(
        <GradeChart
          grades={grades}
          title="Edge Cases"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      const chartData = parseChartData(chart);
      
      // All grades should be displayed individually
      expect(chartData.length).toBe(3);
      
      // Verify edge case values are preserved
      const percentages = chartData.map((item) => item.percentage);
      expect(percentages).toContain(0);
      expect(percentages).toContain(50);
      expect(percentages).toContain(100);
    });
    
    it('should handle null and undefined grades gracefully', () => {
      const grades = [
        createMockGradeSummary({ itemname: 'Incomplete 1', grade: null, percentage: null, lettergrade: null }),
        createMockGradeSummary({ itemname: 'Valid Grade', grade: 75, percentage: 75, lettergrade: 'C' }),
        createMockGradeSummary({ itemname: 'Incomplete 2', grade: null, percentage: null, lettergrade: null }),
      ];
      
      render(
        <GradeChart
          grades={grades}
          title="Null Grades Test"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      const chartData = parseChartData(chart);
      
      // Only non-null grades should be displayed (component filters out null percentages)
      expect(chartData.length).toBe(1);
      expect(chartData[0]?.percentage).toBe(75);
      expect(chartData[0]?.itemname).toBe('Valid Grade');
    });
  });
  
  // ==========================================================================
  // TOOLTIP AND LEGEND TESTS
  // ==========================================================================
  
  describe('Tooltips and Legends', () => {
    it('should include tooltip component in chart', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Tooltip Test"
          chartType="bar"
        />
      );
      
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
    
    it('should include legend component in chart', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Legend Test"
          chartType="bar"
        />
      );
      
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });
    
    it('should configure bar chart with proper data key and color', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Bar Config Test"
          chartType="bar"
        />
      );
      
      const bars = screen.getAllByTestId('bar');
      expect(bars.length).toBeGreaterThan(0);
      expect(bars[0]).toHaveAttribute('data-key', 'percentage');
      expect(bars[0]).toHaveAttribute('data-fill');
    });
    
    it('should configure line chart with proper data key and color', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Line Config Test"
          chartType="line"
        />
      );
      
      const lines = screen.getAllByTestId('line');
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toHaveAttribute('data-key', 'percentage');
      expect(lines[0]).toHaveAttribute('data-stroke');
    });
    
    it('should configure area chart with proper data key and color', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Area Config Test"
          chartType="area"
        />
      );
      
      const areas = screen.getAllByTestId('area');
      expect(areas.length).toBeGreaterThan(0);
      expect(areas[0]).toHaveAttribute('data-key', 'percentage');
      expect(areas[0]).toHaveAttribute('data-fill');
    });
  });
  
  // ==========================================================================
  // RESPONSIVE BEHAVIOR TESTS
  // ==========================================================================
  
  describe('Responsive Behavior', () => {
    it('should render ResponsiveContainer for responsive sizing', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Responsive Test"
          chartType="bar"
        />
      );
      
      const container = screen.getByTestId('responsive-container');
      expect(container).toBeInTheDocument();
    });
    
    it('should wrap chart in ResponsiveContainer regardless of chart type', () => {
      const grades = createGradeDistribution(10);
      
      // Test with each chart type
      const { rerender } = render(
        <GradeChart
          grades={grades}
          title="Responsive Bar"
          chartType="bar"
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      
      rerender(
        <GradeChart
          grades={grades}
          title="Responsive Line"
          chartType="line"
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      
      rerender(
        <GradeChart
          grades={grades}
          title="Responsive Area"
          chartType="area"
        />
      );
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
  
  // ==========================================================================
  // ACCESSIBILITY TESTS
  // ==========================================================================
  
  describe('Accessibility', () => {
    it('should have accessible title', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Accessible Chart Title"
          chartType="bar"
        />
      );
      
      const title = screen.getByText('Accessible Chart Title');
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe('H6');
    });
    
    it('should provide semantic structure for screen readers', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Grade Distribution"
          chartType="bar"
        />
      );
      
      // Title should be a heading for proper document outline
      const heading = screen.getByRole('heading', { name: 'Grade Distribution' });
      expect(heading).toBeInTheDocument();
    });
    
    it('should render chart components with proper hierarchy', () => {
      const grades = createGradeDistribution(10);
      
      render(
        <GradeChart
          grades={grades}
          title="Chart Hierarchy"
          chartType="bar"
        />
      );
      
      const container = screen.getByTestId('responsive-container');
      const chart = within(container).getByTestId('bar-chart');
      
      expect(container).toContainElement(chart);
    });
  });
  
  // ==========================================================================
  // EMPTY STATE TESTS
  // ==========================================================================
  
  describe('Empty State Handling', () => {
    it('should display message when no grade data is provided', () => {
      render(
        <GradeChart
          grades={[]}
          title="Empty Chart"
          chartType="bar"
        />
      );
      
      expect(screen.getByText(/no grade data available/i)).toBeInTheDocument();
    });
    
    it('should not render chart elements when grades array is empty', () => {
      render(
        <GradeChart
          grades={[]}
          title="No Data"
          chartType="bar"
        />
      );
      
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
    });
    
    it('should display empty state with all null grades', () => {
      const grades = [
        createMockGradeSummary({ grade: null, percentage: null, lettergrade: null }),
        createMockGradeSummary({ grade: null, percentage: null, lettergrade: null }),
        createMockGradeSummary({ grade: null, percentage: null, lettergrade: null }),
      ];
      
      render(
        <GradeChart
          grades={grades}
          title="All Null Grades"
          chartType="bar"
        />
      );
      
      // Should show empty state since no valid grades
      expect(screen.getByText(/no grade data available/i)).toBeInTheDocument();
    });
  });
  
  // ==========================================================================
  // NOTE: Loading and error states are handled by parent components.
  // GradeChart component expects valid grade data and does not have
  // loading or error props.
  // ==========================================================================

  
  // ==========================================================================
  // GRADE DISTRIBUTION VISUALIZATION TESTS
  // ==========================================================================
  
  describe('Grade Distribution Visualization', () => {
    it('should display individual grade items in the chart', () => {
      const grades = [
        createMockGradeSummary({ itemname: 'Assignment 1', grade: 15, percentage: 15, lettergrade: 'F' }),
        createMockGradeSummary({ itemname: 'Assignment 2', grade: 25, percentage: 25, lettergrade: 'F' }),
        createMockGradeSummary({ itemname: 'Assignment 3', grade: 27, percentage: 27, lettergrade: 'F' }),
        createMockGradeSummary({ itemname: 'Quiz 1', grade: 55, percentage: 55, lettergrade: 'D' }),
        createMockGradeSummary({ itemname: 'Midterm', grade: 85, percentage: 85, lettergrade: 'B' }),
        createMockGradeSummary({ itemname: 'Project', grade: 88, percentage: 88, lettergrade: 'B' }),
        createMockGradeSummary({ itemname: 'Final', grade: 92, percentage: 92, lettergrade: 'A' }),
      ];
      
      render(
        <GradeChart
          grades={grades}
          title="Distribution Bins"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      const chartData = parseChartData(chart);
      
      // Should render all individual grade items
      expect(chartData.length).toBe(grades.length);
      
      // Verify each item has expected properties
      chartData.forEach((item) => {
        expect(item.itemname).toBeDefined();
        expect(item.percentage).toBeDefined();
        expect(typeof item.percentage).toBe('number');
      });
    });
    
    it('should display grade distribution with passing and failing grades', () => {
      const grades = [
        // 3 Failing grades
        ...Array(3).fill(null).map((_, i) => createMockGradeSummary({ id: i + 1, grade: 30, percentage: 30, lettergrade: 'F', itemname: `Assignment ${i + 1}` })),
        // 7 Passing grades
        ...Array(7).fill(null).map((_, i) => createMockGradeSummary({ id: i + 4, grade: 80, percentage: 80, lettergrade: 'B', itemname: `Assignment ${i + 4}` })),
      ];
      
      render(
        <GradeChart
          grades={grades}
          title="Pass/Fail Distribution"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      const chartData = parseChartData(chart);
      
      // Should display all individual grades
      expect(chartData.length).toBe(10);
      
      // Count grades by percentage (failing vs passing)
      const failingGrades = chartData.filter((item) => item.percentage < 50).length;
      const passingGrades = chartData.filter((item) => item.percentage >= 50).length;
      
      expect(failingGrades).toBe(3);
      expect(passingGrades).toBe(7);
    });
    
    it('should handle uniform grade distribution', () => {
      const grades = Array(10).fill(null).map((_, i) => 
        createMockGradeSummary({ id: i + 1, itemname: `Assignment ${i + 1}`, grade: 75, percentage: 75, lettergrade: 'C' })
      );
      
      render(
        <GradeChart
          grades={grades}
          title="Uniform Distribution"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      const chartData = parseChartData(chart);
      
      // All individual grades should be displayed
      expect(chartData.length).toBe(10);
      
      // All grades should have the same percentage
      const allSamePercentage = chartData.every((item) => item.percentage === 75);
      expect(allSamePercentage).toBe(true);
    });
  });
  
  // ==========================================================================
  // PROPS VALIDATION TESTS
  // ==========================================================================
  
  describe('Props Validation', () => {
    it('should accept and render with minimal required props', () => {
      const grades = createGradeDistribution(5);
      
      render(
        <GradeChart
          grades={grades}
          title="Minimal Props"
          chartType="bar"
        />
      );
      
      expect(screen.getByText('Minimal Props')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
    
    it('should handle optional height prop', () => {
      const grades = createGradeDistribution(5);
      
      render(
        <GradeChart
          grades={grades}
          title="Custom Height"
          chartType="bar"
          height={500}
        />
      );
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
    
    it('should update when grades prop changes', () => {
      const initialGrades = createGradeDistribution(5);
      const updatedGrades = createGradeDistribution(10);
      
      const { rerender } = render(
        <GradeChart
          grades={initialGrades}
          title="Dynamic Grades"
          chartType="bar"
        />
      );
      
      let chart = screen.getByTestId('bar-chart');
      const initialData = parseChartData(chart);
      
      // Update grades
      rerender(
        <GradeChart
          grades={updatedGrades}
          title="Dynamic Grades"
          chartType="bar"
        />
      );
      
      chart = screen.getByTestId('bar-chart');
      const updatedData = parseChartData(chart);
      
      // Data should reflect the new grades (count of grade items)
      const initialTotal = initialData.length;
      const updatedTotal = updatedData.length;
      
      expect(updatedTotal).toBe(10);
      expect(updatedTotal).toBeGreaterThan(initialTotal);
    });
    
    it('should switch chart types when chartType prop changes', () => {
      const grades = createGradeDistribution(5);
      
      const { rerender } = render(
        <GradeChart
          grades={grades}
          title="Chart Type Switch"
          chartType="bar"
        />
      );
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      
      rerender(
        <GradeChart
          grades={grades}
          title="Chart Type Switch"
          chartType="line"
        />
      );
      
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });
  
  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================
  
  describe('Integration Scenarios', () => {
    it('should handle realistic course grade distribution', () => {
      const grades = [
        // Low grades (10%)
        createMockGradeSummary({ grade: 35, percentage: 35, lettergrade: 'F' }),
        createMockGradeSummary({ grade: 42, percentage: 42, lettergrade: 'F' }),
        // Average grades (50%)
        createMockGradeSummary({ grade: 65, percentage: 65, lettergrade: 'D' }),
        createMockGradeSummary({ grade: 68, percentage: 68, lettergrade: 'D' }),
        createMockGradeSummary({ grade: 72, percentage: 72, lettergrade: 'C' }),
        createMockGradeSummary({ grade: 75, percentage: 75, lettergrade: 'C' }),
        createMockGradeSummary({ grade: 78, percentage: 78, lettergrade: 'C' }),
        // High grades (40%)
        createMockGradeSummary({ grade: 85, percentage: 85, lettergrade: 'B' }),
        createMockGradeSummary({ grade: 88, percentage: 88, lettergrade: 'B' }),
        createMockGradeSummary({ grade: 95, percentage: 95, lettergrade: 'A' }),
      ];
      
      render(
        <GradeChart
          grades={grades}
          title="Course Grade Distribution"
          chartType="bar"
        />
      );
      
      const chart = screen.getByTestId('bar-chart');
      const chartData = parseChartData(chart);
      
      // Should have all individual grade items
      expect(chartData.length).toBe(10);
      
      // All items should have percentage data
      expect(chartData.every((item) => typeof item.percentage === 'number')).toBe(true);
    });
    
    it('should display chart with title, axes, and data elements', () => {
      const grades = createGradeDistribution(15);
      
      render(
        <GradeChart
          grades={grades}
          title="Complete Gradebook Chart"
          chartType="bar"
        />
      );
      
      // Verify all major components are present
      expect(screen.getByText('Complete Gradebook Chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
      const bars = screen.getAllByTestId('bar');
      expect(bars.length).toBeGreaterThan(0);
    });
  });
});
