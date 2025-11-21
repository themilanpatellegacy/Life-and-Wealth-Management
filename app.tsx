
import React, { useState, useMemo, useRef } from 'react';
import { 
  Currency, 
  Transaction, 
  Category, 
  TransactionType
} from './types';
import { FinancialTable } from './components/FinancialTable';
import { parseFinancialDocument, fileToGenerativePart } from './services/geminiService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  Plus, 
  TrendingUp, 
  DollarSign, 
  ScanLine,
  X,
  Loader2,
  CreditCard
} from 'lucide-react';

// --- INITIAL DATA (CLEAN SLATE) ---
const INITIAL_CATEGORIES: Category[] = [];
const INITIAL_TRANSACTIONS: Transaction[] = [];

function App() {
  const [currency, setCurrency] = useState<Currency>(Currency.USD);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  
  // Modal State
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  
  // Edit State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Modal Inputs
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTransAmount, setNewTransAmount] = useState('');
  const [newTransDate, setNewTransDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTransCategory, setNewTransCategory] = useState('');
  const [newTransType, setNewTransType] = useState<TransactionType>(TransactionType.INCOME);

  // AI State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // --- DERIVED STATE ---
  const currencySymbol = useMemo(() => {
    switch (currency) {
      case Currency.USD: return '$';
      case Currency.EUR: return '€';
      case Currency.NPR: return 'Rs.';
      default: return '$';
    }
  }, [currency]);

  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + t.amount, 0);
    const netIncome = totalIncome - totalExpense;

    return { totalIncome, totalExpense, netIncome };
  }, [transactions]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];

    // Group by month for chart cleanliness
    const grouped: Record<string, { name: string; income: number; expense: number; net: number; sortDate: number }> = {};
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`; // Group key
      const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });

      if (!grouped[key]) {
        grouped[key] = { name: monthName, income: 0, expense: 0, net: 0, sortDate: date.getTime() };
      }

      if (t.type === TransactionType.INCOME) {
        grouped[key].income += t.amount;
      } else {
        grouped[key].expense += t.amount;
      }
      grouped[key].net = grouped[key].income - grouped[key].expense;
    });

    return Object.values(grouped).sort((a, b) => a.sortDate - b.sortDate);
  }, [transactions]);

  // --- HANDLERS ---

  const openAddCategory = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setIsArticleModalOpen(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setIsArticleModalOpen(true);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm("Are you sure? This will delete the product and all its financial history.")) {
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      setTransactions(prev => prev.filter(t => t.categoryId !== categoryId));
    }
  };

  const handleSaveCategory = () => {
    if (!newCategoryName.trim()) return;
    
    if (editingCategory) {
      // Edit existing
      setCategories(prev => prev.map(c => 
        c.id === editingCategory.id ? { ...c, name: newCategoryName } : c
      ));
    } else {
      // Create new
      const newCat: Category = {
        id: Date.now().toString(),
        name: newCategoryName
      };
      setCategories([...categories, newCat]);
    }
    
    setNewCategoryName('');
    setEditingCategory(null);
    setIsArticleModalOpen(false);
  };

  const handleAddTransaction = () => {
    if (!newTransAmount || !newTransCategory) return;
    const newTrans: Transaction = {
      id: Date.now().toString(),
      categoryId: newTransCategory,
      amount: parseFloat(newTransAmount),
      date: newTransDate,
      type: newTransType
    };
    setTransactions([...transactions, newTrans]);
    setNewTransAmount('');
    setIsRevenueModalOpen(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setAiError(null);

    try {
      const base64Data = await fileToGenerativePart(file);
      const parsedData = await parseFinancialDocument(base64Data, file.type);
      
      if (parsedData.length === 0) {
        setAiError("Could not extract any data. Try a clearer image.");
        setIsAnalyzing(false);
        return;
      }

      // Add parsed data to state
      const newTransactions: Transaction[] = [];
      const newCategories = [...categories];

      parsedData.forEach(item => {
        // Find or create category
        let catId = newCategories.find(c => c.name.toLowerCase() === item.categoryName.toLowerCase())?.id;
        if (!catId) {
          catId = Date.now().toString() + Math.random().toString().slice(2, 5);
          newCategories.push({ id: catId, name: item.categoryName });
        }

        newTransactions.push({
          id: Date.now().toString() + Math.random().toString().slice(2, 5),
          categoryId: catId,
          amount: item.amount,
          date: item.date || new Date().toISOString().split('T')[0],
          type: item.type
        });
      });

      setCategories(newCategories);
      setTransactions([...transactions, ...newTransactions]);
      setIsAIModalOpen(false); // Close modal on success

    } catch (e) {
      setAiError("Failed to analyze image. Ensure API Key is valid.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      
      {/* --- STICKY HEADER --- */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
             <div className="p-2 bg-emerald-500 rounded-lg">
                <TrendingUp className="text-white w-6 h-6" />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white uppercase">
               AssetTrack <span className="text-emerald-500">AI</span>
             </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center sm:text-right">
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Net Income (Lifetime)</p>
              <p className={`text-2xl font-black font-mono tracking-tight ${stats.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currencySymbol}{stats.netIncome.toLocaleString()}
              </p>
            </div>
            
            <div className="hidden md:block h-10 w-px bg-slate-700"></div>

            <div className="flex gap-4">
               <div>
                  <p className="text-[10px] text-slate-500 uppercase">Net Revenue</p>
                  <p className="text-sm font-bold text-emerald-500">{currencySymbol}{stats.totalIncome.toLocaleString()}</p>
               </div>
               <div>
                  <p className="text-[10px] text-slate-500 uppercase">Total Spent</p>
                  <p className="text-sm font-bold text-rose-500">{currencySymbol}{stats.totalExpense.toLocaleString()}</p>
               </div>
            </div>

            <div className="hidden md:block h-10 w-px bg-slate-700"></div>

            <select 
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="bg-slate-800 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 border border-slate-700"
            >
              {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* --- ACTION BAR --- */}
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={openAddCategory}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-all shadow-lg hover:shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" /> Add Article (Product)
          </button>
          
          <button 
            onClick={() => setIsRevenueModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium transition-all shadow-lg hover:shadow-emerald-500/20"
          >
            <DollarSign className="w-4 h-4" /> Add Revenue / Expense
          </button>

          <button 
            onClick={() => setIsAIModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-all shadow-lg hover:shadow-purple-500/20 ml-auto"
          >
            <ScanLine className="w-4 h-4" /> AI Scan Invoice
          </button>
        </div>

        {/* --- CHARTS AREA --- */}
        {transactions.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Trend Chart */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
              <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" /> My Assets Over Time
              </h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `${currencySymbol}${val}`} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} 
                        itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="net" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNet)" name="Net Asset" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-orange-500"></div>
              <h2 className="text-lg font-bold text-slate-200 mb-6">Income vs Spent</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                        cursor={{fill: '#1e293b'}}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} 
                    />
                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
                    <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Spent" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
             <p className="text-slate-400 text-lg">No financial data yet. Add an Article to begin.</p>
             <div className="mt-6 inline-block p-4 bg-slate-800 rounded-full">
               <TrendingUp className="w-8 h-8 text-emerald-500" />
             </div>
             <p className="mt-4 text-slate-500 text-sm">Your lifetime income stats will appear here.</p>
          </div>
        )}

        {/* --- DATA TABLE --- */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Detailed Asset Breakdown
            </h2>
            <span className="text-xs text-slate-500 italic">Lifetime History</span>
          </div>
          
          <FinancialTable 
            categories={categories}
            transactions={transactions}
            currencySymbol={currencySymbol}
            onEditCategory={openEditCategory}
            onDeleteCategory={handleDeleteCategory}
          />
          
          {categories.length > 0 && (
            <button 
              onClick={openAddCategory}
              className="w-full py-3 bg-slate-900 border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
               <Plus className="w-4 h-4" /> Add New Product / Article
            </button>
          )}
        </div>
      </main>

      {/* --- MODALS --- */}

      {/* Add/Edit Article Modal */}
      {isArticleModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{editingCategory ? 'Edit Article' : 'Add New Article'}</h3>
              <button onClick={() => setIsArticleModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Category Name (Product)</label>
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Salary, Rent, Investments"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button 
                onClick={handleSaveCategory}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all"
              >
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Revenue/Expense Modal */}
      {isRevenueModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Add Transaction</h3>
              <button onClick={() => setIsRevenueModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <button 
                   onClick={() => setNewTransType(TransactionType.INCOME)}
                   className={`py-2 rounded-lg font-medium border ${newTransType === TransactionType.INCOME ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                 >
                   Income (Revenue)
                 </button>
                 <button 
                   onClick={() => setNewTransType(TransactionType.EXPENSE)}
                   className={`py-2 rounded-lg font-medium border ${newTransType === TransactionType.EXPENSE ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                 >
                   Expense (Spent)
                 </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Category / Article</label>
                <select 
                  value={newTransCategory}
                  onChange={(e) => setNewTransCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {categories.length === 0 && <p className="text-xs text-rose-400 mt-1">Please add an Article (Product) first.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-500">{currencySymbol}</span>
                  <input 
                    type="number" 
                    value={newTransAmount}
                    onChange={(e) => setNewTransAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 pl-8 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                <input 
                  type="date" 
                  value={newTransDate}
                  onChange={(e) => setNewTransDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <button 
                onClick={handleAddTransaction}
                className={`w-full font-bold py-3 rounded-lg transition-all text-white ${newTransType === TransactionType.INCOME ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                Add {newTransType === TransactionType.INCOME ? 'Revenue' : 'Spent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Scan Modal */}
      {isAIModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-6 shadow-2xl text-center">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ScanLine className="text-purple-500"/> AI Document Scanner
              </h3>
              <button onClick={() => setIsAIModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div 
              className="border-2 border-dashed border-slate-600 rounded-xl p-8 hover:bg-slate-800/50 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
              />
              {isAnalyzing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                  <p className="text-slate-300">Analyzing document structure...</p>
                  <p className="text-xs text-slate-500 mt-2">Extracting amounts, dates, and categories.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                   <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <ScanLine className="w-8 h-8 text-purple-400" />
                   </div>
                   <p className="text-slate-200 font-medium mb-2">Click to upload Invoice or Spreadsheet</p>
                   <p className="text-sm text-slate-500">Supports JPG, PNG (Max 5MB)</p>
                </div>
              )}
            </div>

            {aiError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/50 rounded-lg text-rose-400 text-sm">
                {aiError}
              </div>
            )}
            
            <p className="mt-6 text-xs text-slate-500 text-left">
              * Powered by Gemini 2.5 Flash. Upload an image similar to your reference table to auto-populate categories and amounts.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;

