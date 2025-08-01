import React, { useState, useEffect } from 'react';
import './Dashboard.css';

// Import html2pdf dynamically to avoid SSR issues
let html2pdf;
if (typeof window !== 'undefined') {
  html2pdf = require('html2pdf.js');
}

const Dashboard = ({ user, onLogout }) => {
  // States
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);

  // Theme state
  const [theme, setTheme] = useState('light');

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exportDateRange, setExportDateRange] = useState('all');

  // Budget form states
  const [budgetForm, setBudgetForm] = useState({
    name: '',
    amount: '',
    currency: user?.currency || 'USD',
    period: 'monthly',
    description: ''
  });

  // Expense form states
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    budget_id: null,
    category_id: null
  });

  // Currency symbols
  const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF',
    CNY: '¥',
    KRW: '₩'
  };

  // Format currency
  const formatCurrency = (amount, currency = user?.currency || 'USD') => {
    return `${currencySymbols[currency]} ${parseFloat(amount || 0).toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    showToast('Theme changed', `Switched to ${newTheme} mode`, 'info');
  };

  // Toast notification system
  const showToast = (title, message, type = 'info') => {
    const id = Date.now();
    const toast = { id, title, message, type };
    setToasts(prev => [...prev, toast]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Export functionality
  const generateExportData = (dateRange = 'all') => {
    let filteredExpenses = [...expenses];
    
    if (dateRange !== 'all') {
      const now = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          break;
      }
      
      filteredExpenses = expenses.filter(expense => 
        new Date(expense.date) >= startDate
      );
    }

    return {
      budgets,
      expenses: filteredExpenses,
      categories,
      dateRange,
      generatedAt: new Date().toISOString()
    };
  };

  const exportToCSV = (data) => {
    const { budgets, expenses, categories } = data;
    
    // Budgets CSV
    const budgetsCSV = [
      ['Budget Name', 'Amount', 'Currency', 'Period', 'Description', 'Created Date'],
      ...budgets.map(budget => [
        budget.name,
        budget.amount,
        budget.currency,
        budget.period,
        budget.description || '',
        new Date(budget.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    // Expenses CSV
    const expensesCSV = [
      ['Title', 'Description', 'Amount', 'Currency', 'Category', 'Budget', 'Date'],
      ...expenses.map(expense => {
        const category = categories.find(c => c.id === expense.category_id);
        const budget = budgets.find(b => b.id === expense.budget_id);
        return [
          expense.title,
          expense.description || '',
          expense.amount,
          expense.currency,
          category?.name || 'Uncategorized',
          budget?.name || 'Unknown',
          new Date(expense.date).toLocaleDateString()
        ];
      })
    ].map(row => row.join(',')).join('\n');

    // Categories CSV
    const categoriesCSV = [
      ['Category Name', 'Created Date'],
      ...categories.map(category => [
        category.name,
        new Date(category.createdAt || Date.now()).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    // Combine all CSVs
    const fullCSV = `BUDGETS\n${budgetsCSV}\n\nEXPENSES\n${expensesCSV}\n\nCATEGORIES\n${categoriesCSV}`;
    
    const blob = new Blob([fullCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-tracker-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = async (data) => {
    // Create a temporary div to render the PDF content
    const pdfContent = document.createElement('div');
    pdfContent.style.cssText = `
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: white;
      color: black;
    `;

    const { budgets, expenses, categories, dateRange } = data;
    
    // Calculate statistics
    const totalBudget = budgets.reduce((sum, budget) => sum + parseFloat(budget.amount), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const remainingBudget = totalBudget - totalExpenses;
    
    // Category breakdown
    const categoryBreakdown = categories.map(category => {
      const categoryExpenses = expenses.filter(expense => expense.category_id === category.id);
      const totalSpent = categoryExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
      const percentage = totalExpenses > 0 ? (totalSpent / totalExpenses * 100).toFixed(1) : 0;
      return { category, totalSpent, percentage };
    }).filter(item => item.totalSpent > 0);

    // Generate elegant classic PDF content with pie chart
    pdfContent.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        * { 
          font-family: 'Source Sans Pro', sans-serif;
          box-sizing: border-box;
        }
        body {
          background: #fafafa;
          margin: 0;
          padding: 40px;
          color: #2c3e50;
        }
        .page {
          background: white;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          border-radius: 8px;
        }
        .header {
          text-align: center;
          margin-bottom: 60px;
          border-bottom: 3px solid #34495e;
          padding-bottom: 40px;
        }
        .header h1 {
          font-family: 'Playfair Display', serif;
          font-size: 42px;
          font-weight: 700;
          color: #2c3e50;
          margin: 0 0 16px 0;
          letter-spacing: -0.5px;
        }
        .header .subtitle {
          font-size: 18px;
          color: #7f8c8d;
          font-weight: 400;
          margin: 0 0 8px 0;
        }
        .header .meta {
          font-size: 14px;
          color: #95a5a6;
          font-weight: 300;
        }
        .stats-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        .stat-card {
          background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
          border: 2px solid #ecf0f1;
          border-radius: 12px;
          padding: 20px 15px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #3498db, #2980b9);
        }
        .stat-card h3 {
          font-size: 16px;
          font-weight: 600;
          color: #7f8c8d;
          margin: 0 0 20px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .stat-card .amount {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          line-height: 1.2;
        }
        .budget-card .amount { color: #27ae60; }
        .expense-card .amount { color: #e74c3c; }
        .remaining-card .amount { color: ${remainingBudget >= 0 ? '#27ae60' : '#e74c3c'}; }
        .section {
          margin-bottom: 50px;
          background: #ffffff;
          border: 2px solid #ecf0f1;
          border-radius: 12px;
          padding: 40px;
          position: relative;
        }
        .section h2 {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 600;
          color: #2c3e50;
          margin: 0 0 30px 0;
          position: relative;
          padding-left: 20px;
        }
        .section h2::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 6px;
          height: 30px;
          background: linear-gradient(180deg, #3498db, #2980b9);
          border-radius: 3px;
        }
        .pie-chart-container {
          display: flex;
          align-items: center;
          gap: 30px;
          margin: 30px 0;
        }
        .pie-chart {
          width: 180px;
          height: 180px;
          position: relative;
          flex-shrink: 0;
          background: white;
        }
        .pie-legend {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 6px;
          background: #f8f9fa;
          border: 1px solid #ecf0f1;
        }
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .legend-text {
          font-size: 13px;
          font-weight: 600;
          color: #2c3e50;
        }
        .legend-amount {
          font-size: 11px;
          color: #7f8c8d;
          margin-left: auto;
          font-weight: 500;
        }
        .elegant-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 25px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          font-size: 12px;
        }
        .elegant-table th {
          background: linear-gradient(145deg, #34495e, #2c3e50);
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .elegant-table td {
          padding: 12px 8px;
          border-bottom: 1px solid #ecf0f1;
          font-size: 11px;
          color: #2c3e50;
        }
        .elegant-table tr:nth-child(even) {
          background: #f8f9fa;
        }
        .elegant-table tr:hover {
          background: #ecf0f1;
        }
        .progress-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .progress-bar {
          width: 80px;
          height: 8px;
          background: #ecf0f1;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }
        .progress-fill {
          height: 100%;
          border-radius: 5px;
          position: relative;
        }
        .progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
        }
        .footer {
          text-align: center;
          padding: 30px 0;
          margin-top: 50px;
          border-top: 2px solid #ecf0f1;
          color: #7f8c8d;
          font-size: 13px;
          font-weight: 400;
        }
        .footer .logo {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
        }
      </style>

              <div class="page">
                      <div class="header">
              <h1>Financial Report</h1>
              <div class="subtitle">FinTrack - Your Financial Management Companion</div>
              <div class="meta">
                Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br>
                Date Range: ${dateRange === 'all' ? 'All Time' : dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}
              </div>
            </div>

                  <div class="stats-section">
            <div class="stat-card budget-card">
              <h3>Total Budget</h3>
              <div class="amount">${formatCurrency(totalBudget)}</div>
            </div>
            <div class="stat-card expense-card">
              <h3>Total Expenses</h3>
              <div class="amount">${formatCurrency(totalExpenses)}</div>
            </div>
            <div class="stat-card remaining-card">
              <h3>Remaining</h3>
              <div class="amount">${formatCurrency(remainingBudget)}</div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3498db;">
            <div style="font-size: 14px; color: #7f8c8d; margin-bottom: 8px;">💡 Financial Wisdom</div>
            <div style="font-size: 16px; color: #2c3e50; font-style: italic;">
              "The best investment you can make is in yourself." - Warren Buffett
            </div>
          </div>

                 <div class="section">
           <h2>Spending Analysis</h2>
           <div class="pie-chart-container">
             <div class="pie-chart">
               <svg width="180" height="180" viewBox="0 0 180 180">
                 ${(() => {
                   const colors = ['#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#2c3e50'];
                   let currentAngle = 0;
                   const totalSpent = categoryBreakdown.reduce((sum, item) => sum + item.totalSpent, 0);
                   
                   if (totalSpent === 0) {
                     return `<circle cx="90" cy="90" r="75" fill="#ecf0f1" stroke="#bdc3c7" stroke-width="2"/>`;
                   }
                   
                   return categoryBreakdown.map((item, index) => {
                     const percentage = (item.totalSpent / totalSpent) * 100;
                     const startAngle = currentAngle;
                     const endAngle = currentAngle + (percentage / 100) * 360;
                     currentAngle = endAngle;
                     
                     const x1 = 90 + 75 * Math.cos(startAngle * Math.PI / 180);
                     const y1 = 90 + 75 * Math.sin(startAngle * Math.PI / 180);
                     const x2 = 90 + 75 * Math.cos(endAngle * Math.PI / 180);
                     const y2 = 90 + 75 * Math.sin(endAngle * Math.PI / 180);
                     
                     const largeArcFlag = percentage > 50 ? 1 : 0;
                     const pathData = percentage === 100 
                       ? `M 90 15 A 75 75 0 1 1 89.99 15`
                       : `M 90 90 L ${x1} ${y1} A 75 75 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                     
                     return `<path d="${pathData}" fill="${colors[index % colors.length]}" stroke="white" stroke-width="2"/>`;
                   }).join('');
                 })()}
               </svg>
             </div>
            <div class="pie-legend">
              ${categoryBreakdown.map((item, index) => {
                const colors = ['#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#2c3e50'];
                const percentage = (item.totalSpent / categoryBreakdown.reduce((sum, i) => sum + i.totalSpent, 0)) * 100;
                return `
                  <div class="legend-item">
                    <div class="legend-color" style="background: ${colors[index % colors.length]}"></div>
                    <div class="legend-text">${item.category.name}</div>
                    <div class="legend-amount">${formatCurrency(item.totalSpent)} (${percentage.toFixed(1)}%)</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Budget Performance</h2>
          <table class="elegant-table">
            <thead>
              <tr>
                <th>Budget Name</th>
                <th>Allocated</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              ${budgets.map(budget => {
                const budgetExpenses = expenses.filter(expense => expense.budget_id === budget.id);
                const spent = budgetExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
                const remaining = parseFloat(budget.amount) - spent;
                const progress = (spent / parseFloat(budget.amount) * 100).toFixed(1);
                const progressColor = progress > 100 ? '#e74c3c' : progress > 80 ? '#f39c12' : '#27ae60';
                return `
                  <tr>
                    <td><strong>${budget.name}</strong></td>
                    <td>${formatCurrency(budget.amount, budget.currency)}</td>
                    <td>${formatCurrency(spent, budget.currency)}</td>
                    <td style="color: ${remaining >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: 600;">${formatCurrency(remaining, budget.currency)}</td>
                                         <td>
                       <div class="progress-container">
                         <span style="font-weight: 600; min-width: 35px; font-size: 10px;">${progress}%</span>
                         <div class="progress-bar">
                           <div class="progress-fill" style="width: ${Math.min(progress, 100)}%; background: ${progressColor};"></div>
                         </div>
                       </div>
                     </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Recent Transactions</h2>
          <table class="elegant-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Budget</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.slice(0, 12).map(expense => {
                const category = categories.find(c => c.id === expense.category_id);
                const budget = budgets.find(b => b.id === expense.budget_id);
                return `
                  <tr>
                    <td><strong>${expense.title}</strong></td>
                    <td>${category?.name || 'Uncategorized'}</td>
                    <td>${budget?.name || 'Unknown'}</td>
                    <td style="font-weight: 600; color: #e74c3c;">${formatCurrency(expense.amount, expense.currency)}</td>
                    <td>${new Date(expense.date).toLocaleDateString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div class="logo">FinTrack</div>
          <div>Your Financial Management Companion • Professional Financial Report • ${new Date().toLocaleDateString()}</div>
        </div>
      </div>
    `;

    // Add the content to the document temporarily
    document.body.appendChild(pdfContent);

    try {
      // Check if html2pdf is available
      if (!html2pdf) {
        throw new Error('PDF generation library not available');
      }

      // Configure html2pdf options
      const options = {
        margin: [10, 10, 10, 10],
        filename: `budget-tracker-report-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        }
      };

      // Generate and download PDF
      await html2pdf().from(pdfContent).set(options).save();
      
      // Clean up
      document.body.removeChild(pdfContent);
      
    } catch (error) {
      console.error('PDF generation failed:', error);
      showToast('Export Error', 'PDF generation failed. Please try again.', 'error');
      // Clean up on error
      if (document.body.contains(pdfContent)) {
        document.body.removeChild(pdfContent);
      }
    }
  };

  const handleExport = () => {
    const data = generateExportData(exportDateRange);
    
    if (exportFormat === 'csv') {
      exportToCSV(data);
      showToast('Export Successful', 'Data exported to CSV file!', 'success');
    } else if (exportFormat === 'pdf') {
      exportToPDF(data);
      showToast('Export Successful', 'PDF report generated!', 'success');
    }
    
    setShowExportModal(false);
  };

  // Initialize default categories for new users
  const initializeDefaultCategories = (userId) => {
    const defaultCategories = [
      { id: 1, name: 'Food & Dining', userId: userId },
      { id: 2, name: 'Transportation', userId: userId },
      { id: 3, name: 'Entertainment', userId: userId },
      { id: 4, name: 'Shopping', userId: userId },
      { id: 5, name: 'Utilities', userId: userId },
      { id: 6, name: 'Healthcare', userId: userId },
      { id: 7, name: 'Education', userId: userId },
      { id: 8, name: 'Travel', userId: userId },
      { id: 9, name: 'Miscellaneous', userId: userId }
    ];

    // Save to localStorage
    const allCategories = JSON.parse(localStorage.getItem('categories') || '[]');
    const otherCategories = allCategories.filter(category => category.userId !== userId);
    localStorage.setItem('categories', JSON.stringify([...otherCategories, ...defaultCategories]));

    return defaultCategories;
  };

  // Load data from localStorage
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = () => {
    try {
      setLoading(true);
      
      // Load data from localStorage
      const storedBudgets = JSON.parse(localStorage.getItem('budgets') || '[]');
      const storedExpenses = JSON.parse(localStorage.getItem('expenses') || '[]');
      const storedCategories = JSON.parse(localStorage.getItem('categories') || '[]');
      
      // Filter data for current user
      const userBudgets = storedBudgets.filter(budget => budget.userId === user.id);
      const userExpenses = storedExpenses.filter(expense => expense.userId === user.id);
      let userCategories = storedCategories.filter(category => category.userId === user.id);
      
      // Initialize default categories if user has none
      if (userCategories.length === 0) {
        userCategories = initializeDefaultCategories(user.id);
      }
      
      setBudgets(userBudgets);
      setExpenses(userExpenses);
      setCategories(userCategories);
      
      if (userBudgets.length > 0) {
        setSelectedBudget(userBudgets[0]);
        // Update expense form with the first budget
        setExpenseForm(prev => ({
          ...prev,
          budget_id: userBudgets[0].id
        }));
      }
    } catch (error) {
      setError('Failed to load data. Please try again.');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save data to localStorage
  const saveBudgets = (newBudgets) => {
    const allBudgets = JSON.parse(localStorage.getItem('budgets') || '[]');
    const otherBudgets = allBudgets.filter(budget => budget.userId !== user.id);
    localStorage.setItem('budgets', JSON.stringify([...otherBudgets, ...newBudgets]));
  };

  const saveExpenses = (newExpenses) => {
    const allExpenses = JSON.parse(localStorage.getItem('expenses') || '[]');
    const otherExpenses = allExpenses.filter(expense => expense.userId !== user.id);
    localStorage.setItem('expenses', JSON.stringify([...otherExpenses, ...newExpenses]));
  };



  // Handle budget creation
  const handleCreateBudget = (e) => {
    e.preventDefault();
    try {
      const newBudget = {
        id: Date.now().toString(),
        ...budgetForm,
        userId: user.id,
        amount: parseFloat(budgetForm.amount),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updatedBudgets = [...budgets, newBudget];
      setBudgets(updatedBudgets);
      saveBudgets(updatedBudgets);
      setSelectedBudget(newBudget);
      
      // Update expense form with the new budget
      setExpenseForm(prev => ({
        ...prev,
        budget_id: newBudget.id
      }));
      
      setBudgetForm({
        name: '',
        amount: '',
        currency: user?.currency || 'USD',
        period: 'monthly',
        description: ''
      });
      setShowAddBudget(false);
      showToast('Budget Created', `${newBudget.name} budget has been created successfully!`, 'success');
    } catch (error) {
      setError('Failed to create budget. Please try again.');
      showToast('Error', 'Failed to create budget. Please try again.', 'error');
    }
  };

  // Handle expense creation
  const handleCreateExpense = (e) => {
    e.preventDefault();
    try {
      // Get the correct budget ID - prioritize form selection, then selected budget
      const budgetId = expenseForm.budget_id || selectedBudget?.id;
      
      if (!budgetId) {
        showToast('Error', 'Please select a budget for this expense.', 'error');
        return;
      }

      // Ensure the expense is associated with the correct budget
      const expenseData = {
        id: Date.now().toString(),
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
        date: new Date(expenseForm.date).toISOString(),
        currency: user?.currency || 'USD',
        userId: user.id,
        budget_id: budgetId, // Use the determined budget ID
        category_id: expenseForm.category_id || null, // Handle null category
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Adding expense to budget:', budgetId, 'Expense:', expenseData.title);

      const updatedExpenses = [...expenses, expenseData];
      setExpenses(updatedExpenses);
      saveExpenses(updatedExpenses);
      setExpenseForm({
        title: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        budget_id: selectedBudget?.id || null,
        category_id: null
      });
      setShowAddExpense(false);
      showToast('Expense Added', `${expenseData.title} has been added to ${selectedBudget?.name || 'selected budget'}!`, 'success');
    } catch (error) {
      setError('Failed to create expense. Please try again.');
      showToast('Error', 'Failed to create expense. Please try again.', 'error');
    }
  };

  // Handle expense deletion
  const handleDeleteExpense = (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        const expenseToDelete = expenses.find(expense => expense.id === expenseId);
        const updatedExpenses = expenses.filter(expense => expense.id !== expenseId);
        setExpenses(updatedExpenses);
        saveExpenses(updatedExpenses);
        showToast('Expense Deleted', `${expenseToDelete.title} has been deleted.`, 'info');
      } catch (error) {
        setError('Failed to delete expense. Please try again.');
        showToast('Error', 'Failed to delete expense. Please try again.', 'error');
      }
    }
  };

  // Calculate totals for specific budget
  const getBudgetExpenses = (budgetId) => {
    return expenses.filter(expense => expense.budget_id === budgetId);
  };

  const getBudgetTotalExpenses = (budgetId) => {
    const budgetExpenses = getBudgetExpenses(budgetId);
    return budgetExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  // Calculate overall totals (only for budgets that have expenses)
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remainingBudget = totalBudget - totalExpenses;

  // Get expenses for selected budget
  const selectedBudgetExpenses = selectedBudget 
    ? getBudgetExpenses(selectedBudget.id)
    : [];

  // Filter expenses based on search and filters
  const filteredExpenses = selectedBudgetExpenses.filter(expense => {
    const matchesSearch = expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || expense.category_id === parseInt(categoryFilter);
    const matchesDate = !dateFilter || expense.date.startsWith(dateFilter);
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-content">
          <div className="user-info">
            <div className="skeleton skeleton-line long" style={{ height: '32px', marginBottom: '8px' }}></div>
            <div className="skeleton skeleton-line medium" style={{ height: '16px' }}></div>
          </div>
        </div>
      </div>
      
      <main className="dashboard-main">
        <div className="overview-section">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skeleton skeleton-line short" style={{ height: '32px', marginBottom: '16px' }}></div>
              <div className="skeleton skeleton-line long" style={{ height: '32px' }}></div>
            </div>
          ))}
        </div>
        
        <div className="budgets-section">
          <div className="skeleton-card">
            <div className="skeleton skeleton-line short" style={{ height: '18px', marginBottom: '16px' }}></div>
            <div className="skeleton skeleton-line long" style={{ height: '28px', marginBottom: '20px' }}></div>
            <div className="skeleton skeleton-line long" style={{ height: '8px', marginBottom: '12px' }}></div>
            <div className="skeleton skeleton-line medium" style={{ height: '14px' }}></div>
          </div>
        </div>
      </main>
    </div>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="dashboard-container">
      {/* Theme Toggle */}
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'light' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        )}
      </button>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' ? (
              <svg className="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22,4 12,14.01 9,11.01"></polyline>
              </svg>
            ) : toast.type === 'error' ? (
              <svg className="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            ) : toast.type === 'warning' ? (
              <svg className="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            ) : (
              <svg className="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            )}
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="dashboard-header shimmer-effect">
        <div className="container">
          <div className="header-content">
            <div className="user-info">
              <h1 className="text-glow">FinTrack</h1>
              <p>Your Financial Management Companion</p>
            </div>
            <div className="header-actions">
              <button className="btn btn-primary btn-3d btn-enhanced" onClick={() => setShowExportModal(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Data
              </button>
              <button className="btn btn-secondary btn-3d btn-enhanced" onClick={onLogout}>
                <ion-icon name="refresh-outline" className="icon-3d"></ion-icon>
                Reset Data
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="container">
          {error && (
            <div className="error-banner">
              <ion-icon name="alert-circle-outline" className="icon-3d"></ion-icon>
              {error}
              <button onClick={() => setError('')} className="close-btn">
                <ion-icon name="close-outline"></ion-icon>
              </button>
            </div>
          )}

          {/* Financial Quote */}
          <div className="quote-section" style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white', 
            padding: '24px', 
            borderRadius: '16px', 
            marginBottom: '32px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              💰 Financial Wisdom
            </div>
            <div style={{ fontSize: '16px', opacity: '0.9', fontStyle: 'italic' }}>
              "The art is not in making money, but in keeping it." - Proverb
            </div>
          </div>

          {/* Overview Cards */}
          <div className="overview-section">
            <div className="overview-card card-enhanced glow-effect">
              <div className="card-icon icon-3d">
                <ion-icon name="wallet-outline"></ion-icon>
              </div>
              <div className="card-content">
                <h3 className="text-animate">Total Budget</h3>
                <p className="amount text-glow">{formatCurrency(totalBudget)}</p>
              </div>
            </div>

            <div className="overview-card card-enhanced glow-effect">
              <div className="card-icon icon-3d">
                <ion-icon name="trending-down-outline"></ion-icon>
              </div>
              <div className="card-content">
                <h3 className="text-animate">Total Expenses</h3>
                <p className="amount text-glow">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>

            <div className="overview-card card-enhanced glow-effect">
              <div className="card-icon icon-3d">
                <ion-icon name="trending-up-outline"></ion-icon>
              </div>
              <div className="card-content">
                <h3 className="text-animate">Remaining</h3>
                <p className="amount text-glow">{formatCurrency(remainingBudget)}</p>
              </div>
            </div>
          </div>

          {/* Analytics Section */}
          <div className="analytics-section" style={{ marginBottom: '48px' }}>
            <div className="section-header">
              <h2 className="text-glow">Analytics & Insights</h2>
            </div>
            
            {/* Insight Quote */}
            <div style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-light)', 
              borderRadius: '12px', 
              padding: '20px', 
              marginBottom: '24px',
              textAlign: 'center',
              borderLeft: '4px solid #10b981'
            }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                📊 Financial Insight
              </div>
              <div style={{ fontSize: '16px', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                "A budget tells us what we can't afford, but it doesn't keep us from buying it." - William Feather
              </div>
            </div>
            
            <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {/* Spending by Category - Full Row Pie Chart */}
              <div className="analytics-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '24px', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
                Spending by Category
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                {/* Pie Chart */}
                <div style={{ flex: '0 0 200px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                    {(() => {
                      const categoryData = categories.map(category => {
                        const categoryExpenses = expenses.filter(expense => expense.category_id === category.id);
                        const totalSpent = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
                        return { category, totalSpent };
                      }).filter(item => item.totalSpent > 0);

                      // Add uncategorized expenses to Miscellaneous
                      const uncategorizedExpenses = expenses.filter(expense => !expense.category_id);
                      const uncategorizedTotal = uncategorizedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
                      
                      if (uncategorizedTotal > 0) {
                        const miscellaneousCategory = categoryData.find(item => item.category.name === 'Miscellaneous');
                        if (miscellaneousCategory) {
                          miscellaneousCategory.totalSpent += uncategorizedTotal;
                        } else {
                          categoryData.push({
                            category: { id: 9, name: 'Miscellaneous' },
                            totalSpent: uncategorizedTotal
                          });
                        }
                      }

                      if (categoryData.length === 0) {
                        return (
                          <div style={{ 
                            width: '160px', 
                            height: '160px', 
                            borderRadius: '50%', 
                            background: 'var(--bg-tertiary)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '14px'
                          }}>
                            No data
                          </div>
                        );
                      }

                      const totalSpending = categoryData.reduce((sum, item) => sum + item.totalSpent, 0);
                      const colors = [
                        '#667eea', '#764ba2', '#f093fb', '#f5576c', 
                        '#4facfe', '#00f2fe', '#fa709a', '#fee140',
                        '#ff9a9e', '#fecfef', '#a8edea', '#fed6e3'
                      ];

                      let currentAngle = 0;
                      const segments = categoryData.map((item, index) => {
                        const percentage = (item.totalSpent / totalSpending) * 100;
                        const startAngle = currentAngle;
                        const endAngle = currentAngle + (percentage / 100) * 360;
                        currentAngle = endAngle;

                        const x1 = 80 + 60 * Math.cos(startAngle * Math.PI / 180);
                        const y1 = 80 + 60 * Math.sin(startAngle * Math.PI / 180);
                        const x2 = 80 + 60 * Math.cos(endAngle * Math.PI / 180);
                        const y2 = 80 + 60 * Math.sin(endAngle * Math.PI / 180);

                        const largeArcFlag = percentage > 50 ? 1 : 0;

                        const pathData = percentage === 100 
                          ? `M 80 20 A 60 60 0 1 1 79.99 20`
                          : `M 80 80 L ${x1} ${y1} A 60 60 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                        return {
                          ...item,
                          percentage,
                          pathData,
                          color: colors[index % colors.length]
                        };
                      });

                      return (
                        <svg width="160" height="160" viewBox="0 0 160 160">
                          {segments.map((segment, index) => (
                            <path
                              key={index}
                              d={segment.pathData}
                              fill={segment.color}
                              stroke="var(--bg-card)"
                              strokeWidth="2"
                            />
                          ))}
                          <circle cx="80" cy="80" r="25" fill="var(--bg-card)" />
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* Legend */}
                <div style={{ flex: '1', minWidth: '300px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const categoryData = categories.map(category => {
                        const categoryExpenses = expenses.filter(expense => expense.category_id === category.id);
                        const totalSpent = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
                        return { category, totalSpent };
                      }).filter(item => item.totalSpent > 0);

                      // Add uncategorized expenses to Miscellaneous
                      const uncategorizedExpenses = expenses.filter(expense => !expense.category_id);
                      const uncategorizedTotal = uncategorizedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
                      
                      if (uncategorizedTotal > 0) {
                        const miscellaneousCategory = categoryData.find(item => item.category.name === 'Miscellaneous');
                        if (miscellaneousCategory) {
                          miscellaneousCategory.totalSpent += uncategorizedTotal;
                        } else {
                          categoryData.push({
                            category: { id: 9, name: 'Miscellaneous' },
                            totalSpent: uncategorizedTotal
                          });
                        }
                      }

                      const colors = [
                        '#667eea', '#764ba2', '#f093fb', '#f5576c', 
                        '#4facfe', '#00f2fe', '#fa709a', '#fee140',
                        '#ff9a9e', '#fecfef', '#a8edea', '#fed6e3'
                      ];

                      const totalSpending = categoryData.reduce((sum, item) => sum + item.totalSpent, 0);

                      return categoryData.map((item, index) => {
                        const percentage = (item.totalSpent / totalSpending) * 100;
                        return (
                          <div key={item.category.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%', 
                              background: colors[index % colors.length],
                              flexShrink: 0
                            }}></div>
                            <div style={{ flex: '1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                                {item.category.name}
                              </span>
                              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                {formatCurrency(item.totalSpent)}
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'right' }}>
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>

              {/* Budget Performance */}
              <div className="analytics-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
                  Budget Performance
                </h3>
                <div className="budget-performance">
                  {budgets.map(budget => {
                    const budgetTotal = getBudgetTotalExpenses(budget.id);
                    const utilization = (budgetTotal / budget.amount) * 100;
                    const status = utilization > 100 ? 'Overspent' : utilization > 80 ? 'Warning' : 'Good';
                    
                    return (
                      <div key={budget.id} className="budget-performance-item" style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                            {budget.name}
                          </span>
                          <span style={{ 
                            fontSize: '12px', 
                            fontWeight: '600',
                            color: status === 'Overspent' ? 'var(--text-danger)' : 
                                   status === 'Warning' ? 'var(--text-warning)' : 'var(--text-success)'
                          }}>
                            {status}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${Math.min(utilization, 100)}%`, 
                              height: '100%', 
                              background: status === 'Overspent' ? 'var(--text-danger)' : 
                                         status === 'Warning' ? 'var(--text-warning)' : 'var(--text-success)', 
                              borderRadius: '4px',
                              transition: 'width 0.3s ease'
                            }}
                          ></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          <span>{formatCurrency(budgetTotal)} / {formatCurrency(budget.amount)}</span>
                          <span>{utilization.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="analytics-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
                  Quick Stats
                </h3>
                <div className="quick-stats">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Budgets</span>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{budgets.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Expenses</span>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{expenses.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Avg. Expense</span>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {expenses.length > 0 ? formatCurrency(totalExpenses / expenses.length) : formatCurrency(0)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Savings Rate</span>
                    <span style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: remainingBudget >= 0 ? 'var(--text-success)' : 'var(--text-danger)'
                    }}>
                      {totalBudget > 0 ? ((remainingBudget / totalBudget) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Budgets Section */}
          <div className="budgets-section">
            <div className="section-header">
              <h2 className="text-glow">Your Budgets</h2>
              <button 
                className="btn btn-primary btn-3d btn-enhanced"
                onClick={() => setShowAddBudget(true)}
              >
                <ion-icon name="add-outline" className="icon-3d"></ion-icon>
                Add Budget
              </button>
            </div>

            {budgets.length === 0 ? (
              <div className="empty-state card-enhanced float-animation">
                <ion-icon name="wallet-outline" className="icon-3d"></ion-icon>
                <h3 className="text-glow">No budgets yet</h3>
                <p>Create your first budget to start tracking expenses</p>
                <button 
                  className="btn btn-primary btn-3d btn-enhanced"
                  onClick={() => setShowAddBudget(true)}
                >
                  Create Budget
                </button>
              </div>
            ) : (
              <div className="budgets-grid">
                {budgets.map(budget => {
                  // Calculate expenses for this specific budget
                  const budgetTotalExpenses = getBudgetTotalExpenses(budget.id);
                  const budgetRemaining = budget.amount - budgetTotalExpenses;
                  const progressPercentage = Math.min((budgetTotalExpenses / budget.amount) * 100, 100);
                  
                  return (
                    <div 
                      key={budget.id} 
                      className={`budget-card card-enhanced ${selectedBudget?.id === budget.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedBudget(budget);
                        // Update expense form with the selected budget
                        setExpenseForm(prev => ({
                          ...prev,
                          budget_id: budget.id
                        }));
                        // Clear any existing search/filters when switching budgets
                        setSearchTerm('');
                        setCategoryFilter('');
                        setDateFilter('');
                      }}
                    >
                      <div className="budget-header">
                        <h3 className="text-animate">{budget.name}</h3>
                        <span className="period">{budget.period}</span>
                      </div>
                      <div className="budget-amount text-glow">
                        {formatCurrency(budget.amount, budget.currency)}
                      </div>
                      <div className="budget-progress">
                        <div className="progress-bar progress-3d">
                          <div 
                            className="progress-fill"
                            style={{
                              width: `${progressPercentage}%`,
                              backgroundColor: budgetTotalExpenses > budget.amount ? '#ef4444' : 
                                             budgetTotalExpenses > budget.amount * 0.8 ? '#f59e0b' : '#10b981'
                            }}
                          ></div>
                        </div>
                        <span className="progress-text">
                          {formatCurrency(budgetTotalExpenses, budget.currency)} / {formatCurrency(budget.amount, budget.currency)}
                        </span>
                      </div>
                      
                      <div className={`budget-remaining-section ${budgetRemaining >= 0 ? 'positive' : 'negative'}`}>
                        <div className="remaining-label">
                          {budgetRemaining >= 0 ? 'Remaining' : 'Overspent'}
                        </div>
                        <div className={`remaining-amount ${budgetRemaining >= 0 ? 'positive' : 'negative'}`}>
                          {budgetRemaining >= 0 ? 
                            formatCurrency(budgetRemaining, budget.currency) : 
                            formatCurrency(Math.abs(budgetRemaining), budget.currency)
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expenses Section */}
          <div className="expenses-section">
            <div className="section-header">
              <h2 className="text-glow">
                {selectedBudget ? `${selectedBudget.name} Expenses` : 'All Expenses'}
              </h2>
              <button 
                className="btn btn-primary btn-3d btn-enhanced"
                onClick={() => setShowAddExpense(true)}
                disabled={!selectedBudget}
              >
                <ion-icon name="add-outline" className="icon-3d"></ion-icon>
                Add Expense
              </button>
            </div>

            {/* Advanced Filters */}
            {selectedBudgetExpenses.length > 0 && (
              <div className="filters-section" style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  type="month"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
              </div>
            )}

            {selectedBudgetExpenses.length === 0 ? (
              <div className="empty-state card-enhanced float-animation">
                <ion-icon name="receipt-outline" className="icon-3d"></ion-icon>
                <h3 className="text-glow">No expenses yet</h3>
                <p>{selectedBudget ? `Add your first expense to ${selectedBudget.name}` : 'Add your first expense to start tracking'}</p>
                <button 
                  className="btn btn-primary btn-3d btn-enhanced"
                  onClick={() => setShowAddExpense(true)}
                  disabled={!selectedBudget}
                >
                  Add Expense
                </button>
              </div>
            ) : (
              <div className="expenses-list">
                {filteredExpenses.map(expense => (
                  <div key={expense.id} className="expense-item card-enhanced">
                    <div className="expense-info">
                      <h4 className="text-animate">{expense.title}</h4>
                      <p>{expense.description}</p>
                      <span className="expense-date">
                        {new Date(expense.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="expense-amount text-glow">
                      {formatCurrency(expense.amount, expense.currency)}
                    </div>
                    <div className="expense-actions">
                      <button 
                        className="btn-icon btn-delete btn-3d"
                        onClick={() => handleDeleteExpense(expense.id)}
                        title="Delete expense"
                      >
                        <ion-icon name="trash-outline" className="icon-3d"></ion-icon>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      {/* Add Budget Modal */}
      {showAddBudget && (
        <div className="modal-overlay modal-backdrop-3d" onClick={() => setShowAddBudget(false)}>
          <div className="modal-content card-enhanced" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-glow">Create New Budget</h3>
              <button onClick={() => setShowAddBudget(false)} className="close-btn btn-3d">
                <ion-icon name="close-outline" className="icon-3d"></ion-icon>
              </button>
            </div>
            <form onSubmit={handleCreateBudget} className="modal-form horizontal">
              <div className="input-group half-width">
                <label>Budget Name</label>
                <input
                  type="text"
                  className="input-field input-3d"
                  value={budgetForm.name}
                  onChange={(e) => setBudgetForm({...budgetForm, name: e.target.value})}
                  placeholder="e.g., Monthly Budget"
                  required
                />
              </div>
              <div className="input-group half-width">
                <label>Amount</label>
                <input
                  type="number"
                  className="input-field input-3d"
                  value={budgetForm.amount}
                  onChange={(e) => setBudgetForm({...budgetForm, amount: e.target.value})}
                  placeholder="Enter amount"
                  required
                />
              </div>
              <div className="input-group half-width">
                <label>Currency</label>
                <select
                  className="input-field input-3d"
                  value={budgetForm.currency}
                  onChange={(e) => setBudgetForm({...budgetForm, currency: e.target.value})}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="CHF">CHF</option>
                  <option value="CNY">CNY (¥)</option>
                  <option value="KRW">KRW (₩)</option>
                </select>
              </div>
              <div className="input-group half-width">
                <label>Period</label>
                <select
                  className="input-field input-3d"
                  value={budgetForm.period}
                  onChange={(e) => setBudgetForm({...budgetForm, period: e.target.value})}
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="input-group full-width">
                <label>Description (Optional)</label>
                <textarea
                  className="input-field input-3d"
                  value={budgetForm.description}
                  onChange={(e) => setBudgetForm({...budgetForm, description: e.target.value})}
                  placeholder="Add a description..."
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-3d btn-enhanced" onClick={() => setShowAddBudget(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-3d btn-enhanced">
                  Create Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="modal-overlay modal-backdrop-3d" onClick={() => setShowAddExpense(false)}>
          <div className="modal-content card-enhanced" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-glow">Add New Expense</h3>
              <button onClick={() => setShowAddExpense(false)} className="close-btn btn-3d">
                <ion-icon name="close-outline" className="icon-3d"></ion-icon>
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="modal-form horizontal">
              <div className="input-group half-width">
                <label>Expense Title</label>
                <input
                  type="text"
                  className="input-field input-3d"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({...expenseForm, title: e.target.value})}
                  placeholder="e.g., Groceries"
                  required
                />
              </div>
              <div className="input-group half-width">
                <label>Amount</label>
                <input
                  type="number"
                  className="input-field input-3d"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  placeholder="Enter amount"
                  required
                />
              </div>
              <div className="input-group half-width">
                <label>Date</label>
                <input
                  type="date"
                  className="input-field input-3d"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                  required
                />
              </div>
              <div className="input-group half-width">
                <label>Category</label>
                <select
                  className="input-field input-3d"
                  value={expenseForm.category_id || ''}
                  onChange={(e) => setExpenseForm({...expenseForm, category_id: e.target.value ? parseInt(e.target.value) : null})}
                >
                  <option value="">Select category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group half-width">
                <label>Budget</label>
                <select
                  className="input-field input-3d"
                  value={expenseForm.budget_id || selectedBudget?.id || ''}
                  onChange={(e) => setExpenseForm({...expenseForm, budget_id: e.target.value})}
                  required
                >
                  <option value="">Select a budget</option>
                  {budgets.map(budget => (
                    <option key={budget.id} value={budget.id}>
                      {budget.name} - {formatCurrency(budget.amount, budget.currency)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group full-width">
                <label>Description</label>
                <input
                  type="text"
                  className="input-field input-3d"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  placeholder="Add description..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-3d btn-enhanced" onClick={() => setShowAddExpense(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-3d btn-enhanced">
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay modal-backdrop-3d" onClick={() => setShowExportModal(false)}>
          <div className="modal-content card-enhanced" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-glow">Export Data</h3>
              <button onClick={() => setShowExportModal(false)} className="close-btn btn-3d">
                <ion-icon name="close-outline" className="icon-3d"></ion-icon>
              </button>
            </div>
            <div className="modal-body">
              <div className="export-options">
                <div className="input-group">
                  <label>Export Format</label>
                  <select
                    className="input-field input-3d"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="pdf">PDF Report</option>
                    <option value="csv">CSV Data</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Date Range</label>
                  <select
                    className="input-field input-3d"
                    value={exportDateRange}
                    onChange={(e) => setExportDateRange(e.target.value)}
                  >
                    <option value="all">All Time</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="quarter">Last 3 Months</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>
                <div className="export-preview">
                  <h4>Export Preview</h4>
                  <div className="preview-stats">
                    <div className="stat-item">
                      <span className="stat-label">Budgets:</span>
                      <span className="stat-value">{budgets.length}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Expenses:</span>
                      <span className="stat-value">{expenses.length}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Categories:</span>
                      <span className="stat-value">{categories.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary btn-3d btn-enhanced" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-3d btn-enhanced" onClick={handleExport}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-light)',
        padding: '20px 0',
        marginTop: '60px',
        textAlign: 'center'
      }}>
        <div className="container">
          <div style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: '400'
          }}>
            © 2025 Dev2Design. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard; 