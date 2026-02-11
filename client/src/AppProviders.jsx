import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ConfigProvider, useConfig } from './contexts/ConfigContext'
import { DataProvider } from './contexts/DataContext'
import { WorkspaceProvider } from './contexts/WorkspaceContext'

/**
 * Inner bridge that reads auth context and passes values to ConfigProvider.
 * This avoids coupling ConfigProvider directly to AuthContext.
 */
function ConfigBridge({ children }) {
  const { authReady, authStatus, authUser } = useAuth()
  return (
    <ConfigProvider authReady={authReady} authEnabled={authStatus.enabled} authUser={authUser}>
      {children}
    </ConfigProvider>
  )
}

/**
 * Inner bridge that reads auth + config context and passes values to DataProvider.
 */
function DataBridge({ children }) {
  const { authStatus, authUser } = useAuth()
  const { isFirstRun } = useConfig()
  return (
    <DataProvider isFirstRun={isFirstRun} authEnabled={authStatus.enabled} authUser={authUser}>
      {children}
    </DataProvider>
  )
}

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ConfigBridge>
        <WorkspaceProvider>
          <DataBridge>
            {children}
          </DataBridge>
        </WorkspaceProvider>
      </ConfigBridge>
    </AuthProvider>
  )
}
