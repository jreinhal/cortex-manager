import { render, screen, fireEvent, within } from '@testing-library/react'
import { KnowledgeView } from '../views/KnowledgeView'

// Mock RepoTable since it's tested separately
vi.mock('../components/RepoTable', () => ({
  RepoTable: ({ repos }) => (
    <div data-testid="repo-table">
      {repos.length} repos
    </div>
  ),
}))

describe('KnowledgeView', () => {
  const baseProps = {
    categories: [],
    categorized: {},
    categorySizes: {},
    externalSkillsCount: 0,
    externalSkillsInstalledThisRun: 0,
    repos: [],
    url: '',
    setUrl: vi.fn(),
    handleAdd: vi.fn(),
    handleScan: vi.fn(),
    repoLoading: false,
    repoAction: null,
    repoNotice: null,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    baseProps.setUrl = vi.fn()
    baseProps.handleAdd = vi.fn()
    baseProps.handleScan = vi.fn()
  })

  it('shows initializing message when no categories', () => {
    render(<KnowledgeView {...baseProps} />)
    expect(screen.getByText(/initializing knowledge base/i)).toBeTruthy()
  })

  it('renders category stat cards', () => {
    const props = {
      ...baseProps,
      categories: ['Agents', 'Skills', 'Knowledge'],
      categorized: {
        Agents: [{ id: 'a1' }],
        Skills: [{ id: 's1' }, { id: 's2' }],
        Knowledge: [],
      },
      categorySizes: { agents: 1024, skills: 2048, knowledge: 0 },
    }
    render(<KnowledgeView {...props} />)
    expect(screen.getByTestId('stat-card-agents')).toBeTruthy()
    expect(screen.getByTestId('stat-card-skills')).toBeTruthy()
    expect(screen.getByTestId('stat-card-knowledge')).toBeTruthy()
  })

  it('renders "Skill Repos" label for skills category', () => {
    const props = {
      ...baseProps,
      categories: ['Skills'],
      categorized: { Skills: [] },
      categorySizes: { skills: 0 },
    }
    render(<KnowledgeView {...props} />)
    expect(screen.getByText('Skill Repos')).toBeTruthy()
  })

  it('renders external skills stat card', () => {
    // External skills card is inside the stat grid which only renders when categories.length > 0
    const props = {
      ...baseProps,
      categories: ['Skills'],
      categorized: { Skills: [] },
      categorySizes: { skills: 0 },
      externalSkillsCount: 5,
    }
    render(<KnowledgeView {...props} />)
    const card = screen.getByTestId('stat-card-external-skills')
    expect(card).toBeTruthy()
    // Check the count is inside the card
    expect(within(card).getByText('5')).toBeTruthy()
  })

  it('shows +N badge when externalSkillsInstalledThisRun > 0', () => {
    // External skills card is inside the stat grid which only renders when categories.length > 0
    const props = {
      ...baseProps,
      categories: ['Skills'],
      categorized: { Skills: [] },
      categorySizes: { skills: 0 },
      externalSkillsCount: 3,
      externalSkillsInstalledThisRun: 2,
    }
    render(<KnowledgeView {...props} />)
    // The +2 badge is rendered inside the external skills card
    const card = screen.getByTestId('stat-card-external-skills')
    expect(within(card).getByText('+2')).toBeTruthy()
  })

  it('renders repo URL input and clone button', () => {
    render(<KnowledgeView {...baseProps} />)
    expect(screen.getByTestId('repo-url-input')).toBeTruthy()
    expect(screen.getByTestId('repo-clone-btn')).toBeTruthy()
  })

  it('clone button is disabled when url is empty', () => {
    render(<KnowledgeView {...baseProps} url="" />)
    const btn = screen.getByTestId('repo-clone-btn')
    expect(btn.disabled).toBe(true)
  })

  it('clone button is enabled when url is set', () => {
    render(<KnowledgeView {...baseProps} url="https://github.com/org/repo" />)
    const btn = screen.getByTestId('repo-clone-btn')
    expect(btn.disabled).toBe(false)
  })

  it('calls handleAdd when clone button is clicked', () => {
    render(<KnowledgeView {...baseProps} url="https://github.com/org/repo" />)
    fireEvent.click(screen.getByTestId('repo-clone-btn'))
    expect(baseProps.handleAdd).toHaveBeenCalledTimes(1)
  })

  it('calls handleScan when scan button is clicked', () => {
    render(<KnowledgeView {...baseProps} />)
    fireEvent.click(screen.getByTestId('repo-scan-btn'))
    expect(baseProps.handleScan).toHaveBeenCalledTimes(1)
  })

  it('shows cloning state during load', () => {
    render(<KnowledgeView {...baseProps} url="x" repoLoading={true} repoAction="clone" />)
    expect(screen.getByText(/cloning/i)).toBeTruthy()
  })

  it('shows syncing state during scan', () => {
    render(<KnowledgeView {...baseProps} repoLoading={true} repoAction="scan" />)
    expect(screen.getByText(/syncing/i)).toBeTruthy()
  })

  it('renders repo notice when provided', () => {
    const props = {
      ...baseProps,
      repoNotice: { type: 'success', message: 'Repository cloned successfully.' },
    }
    render(<KnowledgeView {...props} />)
    expect(screen.getByTestId('repo-notice')).toBeTruthy()
    expect(screen.getByText('Repository cloned successfully.')).toBeTruthy()
  })

  it('does not render repo notice when null', () => {
    render(<KnowledgeView {...baseProps} />)
    expect(screen.queryByTestId('repo-notice')).toBeNull()
  })

  it('passes repos to RepoTable', () => {
    const props = { ...baseProps, repos: [{ id: 'r1' }, { id: 'r2' }] }
    render(<KnowledgeView {...props} />)
    expect(screen.getByTestId('repo-table').textContent).toBe('2 repos')
  })

  it('calls setUrl when input changes', () => {
    render(<KnowledgeView {...baseProps} />)
    fireEvent.change(screen.getByTestId('repo-url-input'), { target: { value: 'new-url' } })
    expect(baseProps.setUrl).toHaveBeenCalledWith('new-url')
  })
})
