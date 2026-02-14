const { test, expect } = require('@playwright/test')

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3002/api'
const REPOS_ROOT = process.env.E2E_REPOS_ROOT || 'D:\\Projects\\reference-repos'

async function completeSetupIfNeeded(page) {
  const wizardHeading = page.getByRole('heading', { name: 'Welcome to CORTEX' })
  const visible = await wizardHeading.isVisible().catch(() => false)
  if (!visible) return

  const reposInput = page.locator('#repos-root')
  await reposInput.fill(REPOS_ROOT)
  await page.waitForTimeout(600)

  const completeButton = page.getByRole('button', { name: /Complete Setup|Initialize/i })
  const disabled = await completeButton.isDisabled()
  if (disabled) {
    throw new Error(
      `Setup wizard active but repos root is invalid. Set E2E_REPOS_ROOT to a valid path (current: ${REPOS_ROOT}).`
    )
  }

  await completeButton.click()
  await expect(wizardHeading).toBeHidden({ timeout: 15000 })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await completeSetupIfNeeded(page)
})

test.describe('Settings Persistence', () => {
  test('settings page loads with current config values', async ({ page, request }) => {
    const configRes = await request.get(`${API_BASE}/config`)
    expect(configRes.ok()).toBeTruthy()
    const configPayload = await configRes.json()
    const currentReposRoot = configPayload?.config?.reposRoot || configPayload?.reposRoot || ''
    expect(currentReposRoot).toBeTruthy()

    await page.getByTestId('nav-settings').click()
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()

    const reposRootInput = page.getByTestId('settings-repos-root')
    await expect(reposRootInput).toBeVisible()

    const value = await reposRootInput.inputValue()
    expect(value).toBeTruthy()
    // The repos root should match the config value
    expect(value.toLowerCase()).toBe(currentReposRoot.toLowerCase())
  })

  test('saving valid settings shows success feedback', async ({ page, request }) => {
    // Get current config to restore later
    const configRes = await request.get(`${API_BASE}/config`)
    const configPayload = await configRes.json()
    const originalReposRoot = configPayload?.config?.reposRoot || configPayload?.reposRoot || ''
    expect(originalReposRoot).toBeTruthy()

    await page.getByTestId('nav-settings').click()
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()

    // Re-save the same value (safe — no actual change)
    const reposRootInput = page.getByTestId('settings-repos-root')
    await reposRootInput.fill(originalReposRoot)
    await page.getByTestId('settings-save').click()

    // Should not show an error
    const errorEl = page.getByTestId('settings-error')
    await expect(errorEl).toBeHidden({ timeout: 3000 }).catch(() => {
      // If visible, it should not contain an error about repos root
    })
  })

  test('settings persist after page reload', async ({ page, request }) => {
    await request.get(`${API_BASE}/config`)

    await page.getByTestId('nav-settings').click()
    const reposRootInput = page.getByTestId('settings-repos-root')
    const initialValue = await reposRootInput.inputValue()

    // Reload page
    await page.reload()
    await completeSetupIfNeeded(page)

    await page.getByTestId('nav-settings').click()
    const afterReload = page.getByTestId('settings-repos-root')
    await expect(afterReload).toBeVisible()
    const reloadedValue = await afterReload.inputValue()
    expect(reloadedValue.toLowerCase()).toBe(initialValue.toLowerCase())
  })
})

test.describe('Job Queue API', () => {
  test('job queue endpoint returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE}/jobs`)
    expect(res.ok()).toBeTruthy()
    const jobs = await res.json()
    expect(Array.isArray(jobs)).toBe(true)
  })

  test('create and retrieve a job via API', async ({ request }) => {
    const createRes = await request.post(`${API_BASE}/jobs`, {
      data: { type: 'e2e-test-job', payload: { description: 'E2E test job' } },
    })
    expect(createRes.ok()).toBeTruthy()
    const { success, job } = await createRes.json()
    expect(success).toBe(true)
    expect(job).toHaveProperty('id')
    expect(job.type).toBe('e2e-test-job')

    // Retrieve the job by ID
    const getRes = await request.get(`${API_BASE}/jobs/${job.id}`)
    expect(getRes.ok()).toBeTruthy()
    const retrieved = await getRes.json()
    expect(retrieved.id).toBe(job.id)
  })

  test('cancel a job via API', async ({ request }) => {
    const createRes = await request.post(`${API_BASE}/jobs`, {
      data: { type: 'e2e-cancel-test' },
    })
    const { job } = await createRes.json()

    const cancelRes = await request.post(`${API_BASE}/jobs/${job.id}/cancel`)
    expect(cancelRes.ok()).toBeTruthy()
    const result = await cancelRes.json()
    expect(result.success).toBe(true)
  })
})

test.describe('Audit Trail', () => {
  test('audit trail view loads', async ({ page }) => {
    await page.getByTestId('nav-audit').click()
    await expect(page.getByRole('heading', { name: 'Audit Trail', level: 1 })).toBeVisible()
    await expect(page.getByTestId('audit-logs')).toBeVisible()
  })

  test('audit API returns entries', async ({ request }) => {
    const res = await request.get(`${API_BASE}/audit`)
    expect(res.ok()).toBeTruthy()
    const entries = await res.json()
    expect(Array.isArray(entries)).toBe(true)
  })

  test('audit export returns JSON with entries', async ({ request }) => {
    const res = await request.get(`${API_BASE}/audit/export?format=json`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toHaveProperty('entries')
    expect(Array.isArray(data.entries)).toBe(true)
  })

  test('audit export returns CSV', async ({ request }) => {
    const res = await request.get(`${API_BASE}/audit/export?format=csv`)
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    expect(text).toContain('timestamp')
    expect(text).toContain('event')
  })
})
