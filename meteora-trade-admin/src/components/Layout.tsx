import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <span></span>
        </div>
        {/* <div className="logo">Meteora Trade Admin</div> */}
        <div className="header-right">
          <div className="user-info">Admin</div>
        </div>
      </header>

      <div className="main-container">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="sidebar-nav">
            <ul>
              <li className={location.pathname === '/pools' ? 'active' : ''}>
                <Link to="/pools">Pools</Link>
              </li>
              <li className={location.pathname === '/positions' ? 'active' : ''}>
                <Link to="/positions">Positions</Link>
              </li>
              <li className={location.pathname === '/swap' ? 'active' : ''}>
                <Link to="/swap">Swap</Link>
              </li>
              {/* <li className={location.pathname === '/settings' ? 'active' : ''}>
                <Link to="/settings">Settings</Link>
              </li> */}
              {/* <li className={location.pathname === '/test' ? 'active' : ''}>
                <Link to="/test">Test</Link>
              </li>
              <li className={location.pathname === '/position-test' ? 'active' : ''}>
                <Link to="/position-test">Position Test</Link>
              </li> */}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout 