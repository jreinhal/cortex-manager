import { render, screen, fireEvent } from '@testing-library/react'
import { EvaluationsView } from '../views/EvaluationsView'

// Mock apiFetch (used internally for comparisons)
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn().mockImplementation(async () => ({
    ok: true,
    json: async () => ({}),
  })),
}))

const makeDataset = (overrides = {}) => ({
  id: `ds-${Math.random().toString(36).slice(2, 8)}`,
  name: 'Test Dataset',
  description: 'A test dataset',
  type: 'response',
  items: [],
  createdAt: '2025-01-15T10:00:00Z',
  ...overrides,
})

const makeEvaluation = (overrides = {}) => ({
  id: `eval-${Math.random().toString(36).slice(2, 8)}`,
  datasetId: 'ds-1',
  runId: 'run-1',
  score: 0.85,
  results: [],
  createdAt: '2025-01-15T10:00:00Z',
  ...overrides,
})

const makeRun = (overrides = {}) => ({
  id: `run-${Math.random().toString(36).slice(2, 8)}`,
  goal: 'Test run',
  format: 'universal',
  ...overrides,
})

describe('EvaluationsView', () => {
  const baseProps = {
    datasets: [],
    runs: [],
    evaluations: [],
    templates: [],
    onCreateDataset: vi.fn(),
    onDeleteDataset: vi.fn(),
    onAddDatasetItem: vi.fn(),
    onCreateEvaluation: vi.fn(),
    onImportDataset: vi.fn(),
    onCreateTemplate: vi.fn(),
    onUpdateTemplate: vi.fn(),
    onDeleteTemplate: vi.fn(),
    onImportTemplates: vi.fn(),
    onExportTemplates: vi.fn(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    Object.keys(baseProps).forEach((key) => {
      if (typeof baseProps[key] === 'function') {
        baseProps[key] = vi.fn()
      }
    })
  })

  it('renders Datasets heading', () => {
    render(<EvaluationsView {...baseProps} />)
    expect(screen.getByText('Datasets')).toBeTruthy()
  })

  it('shows empty state when no datasets', () => {
    render(<EvaluationsView {...baseProps} />)
    expect(screen.getByText('No datasets yet')).toBeTruthy()
  })

  it('renders dataset list when datasets are provided', () => {
    const datasets = [
      makeDataset({ id: 'ds-1', name: 'Response Quality' }),
      makeDataset({ id: 'ds-2', name: 'Code Accuracy' }),
    ]
    render(<EvaluationsView {...baseProps} datasets={datasets} />)
    // Dataset names may appear in list, detail panel, AND <select> <option> elements
    expect(screen.getAllByText('Response Quality').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Code Accuracy').length).toBeGreaterThanOrEqual(1)
  })

  it('renders dataset creation form elements', () => {
    render(<EvaluationsView {...baseProps} />)
    expect(screen.getByPlaceholderText('Dataset name')).toBeTruthy()
  })

  it('calls onCreateDataset when create button is clicked', () => {
    render(<EvaluationsView {...baseProps} />)
    const nameInput = screen.getByPlaceholderText('Dataset name')
    fireEvent.change(nameInput, { target: { value: 'New Dataset' } })
    const createBtn = screen.getByRole('button', { name: /create dataset/i })
    fireEvent.click(createBtn)
    expect(baseProps.onCreateDataset).toHaveBeenCalled()
  })

  it('renders evaluation list when evaluations exist', () => {
    const datasets = [makeDataset({ id: 'ds-1', name: 'Dataset A' })]
    const evaluations = [
      // Component reads evaluation.metrics?.score (not evaluation.score)
      makeEvaluation({ id: 'eval-1', datasetId: 'ds-1', metrics: { score: 0.92, passRate: 0.8, itemCount: 5 } }),
    ]
    const runs = [makeRun({ id: 'run-1', goal: 'Eval run' })]
    render(
      <EvaluationsView
        {...baseProps}
        datasets={datasets}
        evaluations={evaluations}
        runs={runs}
      />
    )
    // Score renders as "Score 0.92 · Pass 80% · Items 5"
    expect(screen.getAllByText(/0\.92/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders Rubric Templates section', () => {
    render(<EvaluationsView {...baseProps} />)
    expect(screen.getByText('Rubric Templates')).toBeTruthy()
  })

  it('renders Compare Evaluations section', () => {
    render(<EvaluationsView {...baseProps} />)
    expect(screen.getByText('Compare Evaluations')).toBeTruthy()
  })
})
