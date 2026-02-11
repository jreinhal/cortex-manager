import { useState } from 'react'
import { motion } from 'framer-motion'
import brainIcon from '../assets/brain.png'
import { SPRING_SMOOTH } from '../lib/constants'

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center app-shell">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SMOOTH}
        className="glass-panel rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-black rounded-2xl p-3 mb-4 relative overflow-visible">
            <div className="brain-glow absolute -inset-2 rounded-[20px] bg-[radial-gradient(circle_at_28%_35%,rgba(93,126,166,0.55),transparent_64%),radial-gradient(circle_at_72%_55%,rgba(79,110,146,0.5),transparent_66%)] blur-xl opacity-80 pointer-events-none" />
            <img
              src={brainIcon}
              alt="Cortex Brain"
              width="40"
              height="40"
              className="relative z-10 w-10 h-10 object-contain"
              style={{
                filter:
                  'drop-shadow(0 0 10px rgba(93,126,166,0.6)) drop-shadow(0 0 14px rgba(79,110,146,0.5))',
              }}
            />
          </div>
          <h2 className="text-xl font-display font-bold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {children}
      </motion.div>
    </div>
  )
}

export function LoginScreen({ onLogin, loading, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin(username, password)
  }

  return (
    <AuthShell title="Sign In" subtitle="Enter your credentials to access CORTEX.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
          className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus-visible:border-cyan-500/50 rounded-2xl px-4 py-3 text-sm focus-visible:outline-none transition-ui placeholder:text-slate-600"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus-visible:border-cyan-500/50 rounded-2xl px-4 py-3 text-sm focus-visible:outline-none transition-ui placeholder:text-slate-600"
        />
        {error && (
          <div className="text-red-400 text-sm px-1">{error}</div>
        )}
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-white text-slate-900 font-bold text-sm transition-ui disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </AuthShell>
  )
}

export function BootstrapAdminScreen({ onBootstrap, loading, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onBootstrap(username, password)
  }

  return (
    <AuthShell title="Create Admin Account" subtitle="Set up the initial administrator.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Admin username"
          autoFocus
          className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus-visible:border-cyan-500/50 rounded-2xl px-4 py-3 text-sm focus-visible:outline-none transition-ui placeholder:text-slate-600"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 focus-visible:border-cyan-500/50 rounded-2xl px-4 py-3 text-sm focus-visible:outline-none transition-ui placeholder:text-slate-600"
        />
        {error && (
          <div className="text-red-400 text-sm px-1">{error}</div>
        )}
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-white text-slate-900 font-bold text-sm transition-ui disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create Admin'}
        </button>
      </form>
    </AuthShell>
  )
}
