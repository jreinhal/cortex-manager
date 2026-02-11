const createAuthRoutes = require('./auth')
const createConfigRoutes = require('./config')
const createWorkspaceRoutes = require('./workspaces')
const createUserRoutes = require('./users')
const createScimRoutes = require('./scim')
const createRepoRoutes = require('./repos')
const createRunRoutes = require('./runs')
const createJobRoutes = require('./jobs')
const createEvaluationRoutes = require('./evaluations')
const createPromptRoutes = require('./prompts')
const createAnalyticsRoutes = require('./analytics')

function mountRoutes(app, deps) {
  const {
    config,
    auth,
    authStore,
    workspaces,
    repoManager,
    externalSkills,
    vectorIndex,
    jobQueue,
    runsStore,
    datasetsStore,
    evaluationsStore,
    evaluationTemplatesStore,
  } = deps

  app.use('/api', createAuthRoutes({ config, auth, authStore }))
  app.use('/api', createConfigRoutes({ config, auth }))
  app.use('/api', createWorkspaceRoutes({ config, auth, workspaces }))
  app.use('/api', createUserRoutes({ auth, authStore }))
  app.use('/api', createScimRoutes({ config, authStore }))
  app.use(
    '/api',
    createRepoRoutes({
      config,
      auth,
      repoManager,
      externalSkills,
      vectorIndex,
      jobQueue,
      workspaces,
    })
  )
  app.use(
    '/api',
    createRunRoutes({ config, auth, runsStore, jobQueue, vectorIndex })
  )
  app.use('/api', createJobRoutes({ auth, jobQueue }))
  app.use(
    '/api',
    createEvaluationRoutes({
      config,
      auth,
      datasetsStore,
      evaluationsStore,
      evaluationTemplatesStore,
      runsStore,
    })
  )
  app.use('/api', createPromptRoutes({ config, auth }))
  app.use('/api', createAnalyticsRoutes({ auth }))
}

module.exports = mountRoutes
