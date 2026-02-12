/**
 * Stack Profile Parser - Extracts tech stack tokens from freeform text
 * Classifies technologies into languages, frameworks, tools, platforms, and tags
 */

// Comprehensive taxonomy mapping freeform terms to stack profile categories
const PARSE_TAXONOMY = {
  languages: {
    javascript: ['javascript', 'js', 'ecmascript', 'es6', 'es2015', 'es2020', 'es2022'],
    typescript: ['typescript', 'ts'],
    python: ['python', 'py', 'python3', 'cpython'],
    rust: ['rust'],
    go: ['go', 'golang'],
    java: ['java', 'jdk', 'openjdk'],
    kotlin: ['kotlin', 'kt'],
    swift: ['swift'],
    ruby: ['ruby', 'rb'],
    php: ['php'],
    csharp: ['c#', 'csharp', 'c-sharp', '.net', 'dotnet'],
    cpp: ['c++', 'cpp'],
    c: ['\\bc\\b'],
    dart: ['dart'],
    elixir: ['elixir'],
    scala: ['scala'],
    lua: ['lua'],
    r: ['\\br\\b'],
    sql: ['sql', 'plsql', 'pl/sql', 'tsql', 't-sql'],
    shell: ['bash', 'shell', 'zsh', 'sh', 'powershell'],
    html: ['html', 'html5'],
    css: ['css', 'css3'],
  },
  frameworks: {
    react: ['react', 'reactjs', 'react.js', 'react 19'],
    nextjs: ['next', 'nextjs', 'next.js'],
    vue: ['vue', 'vuejs', 'vue.js'],
    nuxt: ['nuxt', 'nuxtjs', 'nuxt.js'],
    angular: ['angular', 'angularjs'],
    svelte: ['svelte', 'sveltekit'],
    express: ['express', 'expressjs', 'express.js', 'express 5'],
    fastify: ['fastify'],
    nestjs: ['nest', 'nestjs', 'nest.js'],
    koa: ['koa'],
    hono: ['hono'],
    django: ['django'],
    flask: ['flask'],
    fastapi: ['fastapi', 'fast api'],
    spring: ['spring', 'spring boot', 'springboot'],
    rails: ['rails', 'ruby on rails'],
    laravel: ['laravel'],
    tailwind: ['tailwind', 'tailwindcss', 'tailwind css', 'tailwind 4'],
    bootstrap: ['bootstrap'],
    'material-ui': ['material-ui', 'mui', 'material ui'],
    'framer-motion': ['framer motion', 'framer-motion'],
    junit: ['junit'],
    pytest: ['pytest'],
    jest: ['jest'],
    vitest: ['vitest', 'vitest 4'],
    mocha: ['mocha'],
    playwright: ['playwright'],
    cypress: ['cypress'],
    storybook: ['storybook'],
    gatsby: ['gatsby'],
    remix: ['remix'],
    astro: ['astro'],
    'react-router': ['react router', 'react-router'],
    redux: ['redux', 'redux toolkit', 'rtk'],
    zustand: ['zustand'],
    tanstack: ['tanstack', 'react query', 'tanstack query'],
    trpc: ['trpc', 't3'],
    prisma: ['prisma'],
    drizzle: ['drizzle'],
    sequelize: ['sequelize'],
    mongoose: ['mongoose'],
    typeorm: ['typeorm'],
  },
  tools: {
    vite: ['vite', 'vite 7'],
    webpack: ['webpack'],
    rollup: ['rollup'],
    esbuild: ['esbuild'],
    turbopack: ['turbopack'],
    docker: ['docker', 'dockerfile', 'docker-compose', 'docker compose'],
    kubernetes: ['kubernetes', 'k8s', 'kubectl', 'helm'],
    git: ['git'],
    github: ['github', 'github actions'],
    gitlab: ['gitlab', 'gitlab ci'],
    npm: ['npm'],
    yarn: ['yarn'],
    pnpm: ['pnpm'],
    bun: ['bun'],
    deno: ['deno'],
    eslint: ['eslint', 'eslint 9'],
    prettier: ['prettier'],
    biome: ['biome'],
    postgres: ['postgres', 'postgresql', 'pg'],
    mysql: ['mysql', 'mariadb'],
    sqlite: ['sqlite', 'sqlite3'],
    mongodb: ['mongodb', 'mongo'],
    redis: ['redis'],
    supabase: ['supabase'],
    firebase: ['firebase', 'firestore'],
    dynamodb: ['dynamodb', 'dynamo'],
    clickhouse: ['clickhouse'],
    elasticsearch: ['elasticsearch', 'elastic'],
    nginx: ['nginx'],
    caddy: ['caddy'],
    aws: ['aws', 'amazon web services'],
    gcp: ['gcp', 'google cloud'],
    azure: ['azure'],
    vercel: ['vercel'],
    netlify: ['netlify'],
    terraform: ['terraform'],
    ansible: ['ansible'],
    grafana: ['grafana'],
    prometheus: ['prometheus'],
    datadog: ['datadog'],
    sentry: ['sentry'],
    zod: ['zod'],
    'lucide-react': ['lucide', 'lucide-react', 'lucide react'],
    concurrently: ['concurrently'],
    nodemon: ['nodemon'],
    supertest: ['supertest'],
    maven: ['maven', 'mvn'],
    gradle: ['gradle'],
    pip: ['pip', 'pipenv'],
    poetry: ['poetry'],
    cargo: ['cargo'],
  },
  platforms: {
    web: ['web', 'browser', 'frontend', 'front-end', 'client-side', 'spa', 'single page'],
    server: ['server', 'backend', 'back-end', 'server-side'],
    mobile: ['mobile', 'ios', 'android', 'react native', 'flutter'],
    desktop: ['desktop', 'electron', 'tauri'],
    cli: ['cli', 'command line', 'terminal'],
    api: ['api', 'rest', 'restful', 'graphql', 'grpc'],
    serverless: ['serverless', 'lambda', 'edge function', 'edge functions'],
    embedded: ['embedded', 'iot'],
    'local-first': ['local-first', 'localhost', 'self-hosted', 'local'],
  },
}

// Extra signal terms that become tags (not in specific categories above)
const TAG_SIGNALS = {
  fullstack: ['fullstack', 'full-stack', 'full stack'],
  monorepo: ['monorepo', 'mono-repo', 'mono repo', 'turborepo', 'lerna', 'nx'],
  microservices: ['microservice', 'microservices', 'micro-service'],
  jamstack: ['jamstack', 'jam stack'],
  'real-time': ['real-time', 'realtime', 'websocket', 'websockets', 'socket.io', 'sse'],
  testing: ['testing', 'tdd', 'bdd', 'test-driven'],
  ci: ['ci', 'ci/cd', 'continuous integration'],
  cd: ['cd', 'continuous deployment', 'continuous delivery'],
  devops: ['devops', 'dev ops'],
  security: ['security', 'owasp', 'auth', 'authentication', 'authorization'],
  performance: ['performance', 'optimization', 'caching', 'cdn'],
  accessibility: ['accessibility', 'a11y', 'wcag', 'aria'],
  i18n: ['i18n', 'internationalization', 'l10n', 'localization'],
  seo: ['seo', 'search engine optimization'],
  pwa: ['pwa', 'progressive web app'],
  ssr: ['ssr', 'server-side rendering'],
  ssg: ['ssg', 'static site generation', 'static generation'],
  'flat-file': ['flat file', 'flat-file', 'json files', 'json storage', 'no database'],
  'content-hashing': ['content hashing', 'sha-256', 'sha256', 'content hash'],
  esm: ['esm', 'es modules', 'ecmascript modules'],
  commonjs: ['commonjs', 'cjs', 'require'],
}

function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse freeform text and extract tech stack tokens classified by category
 * @param {string} text - Raw text describing a tech stack
 * @returns {{ languages: string[], frameworks: string[], tools: string[], platforms: string[], tags: string[] }}
 */
function parseStackText(text) {
  if (!text || typeof text !== 'string') {
    return { languages: [], frameworks: [], tools: [], platforms: [], tags: [] }
  }

  const normalized = text.toLowerCase().replace(/\r\n/g, '\n')

  const result = {
    languages: new Set(),
    frameworks: new Set(),
    tools: new Set(),
    platforms: new Set(),
    tags: new Set(),
  }

  // Match against taxonomy categories
  for (const [category, entries] of Object.entries(PARSE_TAXONOMY)) {
    for (const [canonical, aliases] of Object.entries(entries)) {
      for (const alias of aliases) {
        const isRegexPattern = alias.startsWith('\\b')
        if (isRegexPattern) {
          try {
            const regex = new RegExp(alias, 'i')
            if (regex.test(normalized)) {
              result[category].add(canonical)
              break
            }
          } catch {
            // skip invalid regex
          }
        } else if (alias.includes(' ')) {
          // Multi-word: exact substring match
          if (normalized.includes(alias)) {
            result[category].add(canonical)
            break
          }
        } else {
          // Single word: word boundary match
          const regex = new RegExp(`\\b${escapeForRegex(alias)}\\b`, 'i')
          if (regex.test(normalized)) {
            result[category].add(canonical)
            break
          }
        }
      }
    }
  }

  // Match tag signals
  for (const [tag, aliases] of Object.entries(TAG_SIGNALS)) {
    for (const alias of aliases) {
      if (alias.includes(' ')) {
        if (normalized.includes(alias)) {
          result.tags.add(tag)
          break
        }
      } else {
        const regex = new RegExp(`\\b${escapeForRegex(alias)}\\b`, 'i')
        if (regex.test(normalized)) {
          result.tags.add(tag)
          break
        }
      }
    }
  }

  return {
    languages: [...result.languages].sort(),
    frameworks: [...result.frameworks].sort(),
    tools: [...result.tools].sort(),
    platforms: [...result.platforms].sort(),
    tags: [...result.tags].sort(),
  }
}

module.exports = { parseStackText, PARSE_TAXONOMY, TAG_SIGNALS }
