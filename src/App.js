import React, { useState, useEffect } from 'react';
import './style.css';
import './responsive.css';
import Dashboard from './components/Dashboard/Dashboard';
import { motion, AnimatePresence } from 'framer-motion';

// Main App component - Direct to dashboard without authentication
function App() {
  const [user] = useState({
    id: 'default-user',
    username: 'User',
    full_name: 'Budget Tracker User',
    currency: 'USD',
    createdAt: new Date().toISOString()
  });

  // Mouse trail effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      const trail = document.createElement('div');
      trail.className = 'mouse-trail';
      trail.style.left = e.pageX - 4 + 'px';
      trail.style.top = e.pageY - 4 + 'px';
      document.body.appendChild(trail);

      setTimeout(() => {
        document.body.removeChild(trail);
      }, 1000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogout = () => {
    // Clear all data from localStorage
    localStorage.removeItem('budgets');
    localStorage.removeItem('expenses');
    localStorage.removeItem('categories');
    // Reload the page to reset the app
    window.location.reload();
  };

  return (
    <>
      {/* Enhanced 3D Background Elements */}
      <div className="floating-shapes">
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
      </div>

      <div className="wave-container">
        <div className="wave"></div>
        <div className="wave"></div>
        <div className="wave"></div>
      </div>

      <div className="gradient-orb"></div>
      <div className="gradient-orb"></div>

      {/* Interactive 3D Particles */}
      <div className="particle-container">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="particle"
            style={{
              position: 'fixed',
              width: Math.random() * 4 + 2 + 'px',
              height: Math.random() * 4 + 2 + 'px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              pointerEvents: 'none',
              zIndex: -1,
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%'
            }}
            animate={{
              y: [0, -100, 0],
              x: [0, Math.random() * 50 - 25, 0],
              opacity: [0, 1, 0],
              scale: [0, 1, 0]
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 5
            }}
          />
        ))}
      </div>

      {/* 3D Grid Effect */}
      <div className="grid-container">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="grid-line"
            style={{
              position: 'fixed',
              width: '1px',
              height: '100vh',
              background: 'rgba(255, 255, 255, 0.02)',
              left: (i * 2) + '%',
              zIndex: -1
            }}
            animate={{
              opacity: [0, 0.02, 0],
              scaleY: [0, 1, 0]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.1
            }}
          />
        ))}
      </div>

      <Dashboard user={user} onLogout={handleLogout} />

      {/* Ionicons scripts */}
      <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
      <script
        nomodule
        src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"
      ></script>
    </>
  );
}

export default App;
