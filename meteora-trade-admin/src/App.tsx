import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import MTRPools from './components/MTRPools'
import Positions from './components/PositionStats'
import Layout from './components/Layout'
import { Toaster } from 'sonner'
import Test from './components/Test'
import PositionTest from './components/PositionTest'

function App() {
  return (
    <Router>
      <Layout>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/" element={<Navigate to="/pools" replace />} />
          <Route path="/pools" element={<MTRPools />} />
          <Route path="/positions" element={<Positions />} />
          <Route path="/test" element={<Test />} />
          <Route path="/position-test" element={<PositionTest />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
