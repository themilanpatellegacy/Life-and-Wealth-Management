
import React, { useMemo } from 'react';
import { Category, Transaction, TransactionType } from '../types';
import { Pencil, Trash2 } from 'lucide-react';

interface FinancialTableProps {
  categories: Category[];
  transactions: Transaction[];
  currencySymbol: string;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
}

// Helper to get a consistent Week/Period identifier
// Displays Start Date of the week for "Unlimited Date" feel
const getWeekKey = (dateStr: string) => {
  const d = new Date(dateStr);
  // Set to Monday of that week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  
  // Sort key: YYYY-MM-DD of the Monday
  const year = monday.getFullYear();
  const month = (monday.getMonth() + 1).toString().padStart(2, '0');
  const date = monday.getDate().toString().padStart(2, '0');
  const key = `${year}-${month}-${date}`; // ISO-like key for sorting

  // Label: "Oct 23"
  const label = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const labelYear = year !== new Date().getFullYear() ? ` '${year.toString().slice(2)}` : '';
  
  return {
    key,
    label: label + labelYear
  };
};

export const FinancialTable: React.FC<FinancialTableProps> = ({
  categories,
  transactions,
  currencySymbol,
  onEditCategory,
  onDeleteCategory
}) => {
  
  // 1. Determine Dynamic Columns based on actual data
  const periodColumns = useMemo(() => {
    if (transactions.length === 0) {
       // Default to current week if no data
       const now = new Date().toISOString().split('T')[0];
       return [getWeekKey(now)];
    }

    // Get all unique week keys from transactions
    const uniqueWeeks = new Map<string, string>();
    transactions.forEach(t => {
      const { key, label } = getWeekKey(t.date);
      uniqueWeeks.set(key, label);
    });

    // Convert map to array and sort chronologically
    return Array.from(uniqueWeeks.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [transactions]);

  // 2. Compute Data Grid
  const gridData = useMemo(() => {
    const data: Record<string, Record<string, { income: number; expense: number; balance: number }>> = {};

    categories.forEach(cat => {
      data[cat.id] = {};
      let runningBalance = 0;

      // We iterate through ALL sorted period columns to ensure running balance carries over correctly
      periodColumns.forEach(period => {
        // Filter transactions for this category and specific week key
        const weeklyTrans = transactions.filter(t => {
           const { key } = getWeekKey(t.date);
           return t.categoryId === cat.id && key === period.key;
        });

        const income = weeklyTrans
          .filter(t => t.type === TransactionType.INCOME)
          .reduce((sum, t) => sum + t.amount, 0);
          
        const expense = weeklyTrans
          .filter(t => t.type === TransactionType.EXPENSE)
          .reduce((sum, t) => sum + t.amount, 0);

        runningBalance += (income - expense);

        data[cat.id][period.key] = { income, expense, balance: runningBalance };
      });
    });

    return data;
  }, [categories, transactions, periodColumns]);

  if (categories.length === 0) {
    return (
      <div className="border border-slate-800 rounded-lg bg-slate-900/50 p-8 text-center text-slate-500">
        No Products/Articles added yet. Click "Add Article" to begin tracking.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-700 rounded-lg shadow-2xl bg-slate-900">
      <table className="w-full text-sm text-left rtl:text-right text-slate-400 border-collapse">
        <thead className="text-xs text-slate-200 uppercase bg-slate-800 sticky top-0 z-10 shadow-md">
          <tr>
            <th scope="col" className="px-6 py-4 sticky left-0 bg-slate-800 z-20 min-w-[250px] border-r border-slate-700 shadow-[4px_0_8px_rgba(0,0,0,0.3)]">
              Product / Article
            </th>
            {periodColumns.map(period => (
              <th key={period.key} scope="col" className="px-4 py-4 min-w-[100px] text-center border-b border-slate-700 bg-slate-800 whitespace-nowrap">
                {period.label}
              </th>
            ))}
            {/* Lifetime Total Column */}
            <th scope="col" className="px-4 py-4 min-w-[140px] text-center border-b border-slate-700 bg-slate-800/80 text-emerald-400 border-l border-slate-700">
               Lifetime
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            // Calculate lifetime total for this category
            const lastPeriodKey = periodColumns[periodColumns.length - 1]?.key;
            const finalBalance = gridData[category.id]?.[lastPeriodKey]?.balance || 0;

            return (
            <React.Fragment key={category.id}>
              {/* Category Header Row */}
              <tr className="bg-slate-900/50 border-b border-slate-800 group">
                <td className="px-6 py-3 font-bold text-slate-100 sticky left-0 bg-slate-900 border-r border-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.3)] flex items-center justify-between gap-2">
                  <span className="truncate">{category.name}</span>
                  {/* Edit options are always visible */}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => onEditCategory(category)}
                      className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                      title="Edit Product Name"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => onDeleteCategory(category.id)}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                {periodColumns.map(period => (
                   <td key={period.key} className="px-4 py-3 bg-slate-900/20 border-r border-slate-800/50"></td>
                ))}
                <td className="border-l border-slate-800 bg-slate-900/30"></td>
              </tr>

              {/* Inbound / Revenue */}
              <tr className="bg-slate-900/30 hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-1.5 text-xs font-medium text-emerald-400 text-right sticky left-0 bg-slate-900/95 border-r border-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                  Revenue (In)
                </td>
                {periodColumns.map(period => {
                  const val = gridData[category.id]?.[period.key]?.income || 0;
                  return (
                    <td key={period.key} className="px-4 py-1.5 text-right text-emerald-500/90 font-mono border-r border-slate-800/50">
                      {val > 0 ? val.toLocaleString() : '-'}
                    </td>
                  );
                })}
                <td className="border-l border-slate-800"></td>
              </tr>

              {/* Outbound / Spent */}
              <tr className="bg-slate-900/30 hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-1.5 text-xs font-medium text-rose-400 text-right sticky left-0 bg-slate-900/95 border-r border-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                  Spent (Out)
                </td>
                {periodColumns.map(period => {
                  const val = gridData[category.id]?.[period.key]?.expense || 0;
                  return (
                    <td key={period.key} className="px-4 py-1.5 text-right text-rose-500/90 font-mono border-r border-slate-800/50">
                      {val > 0 ? val.toLocaleString() : '-'}
                    </td>
                  );
                })}
                <td className="border-l border-slate-800"></td>
              </tr>

              {/* Stock / Net */}
              <tr className="bg-slate-800/30 border-b border-slate-700 hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-1.5 text-xs font-bold text-blue-400 text-right sticky left-0 bg-slate-900/95 border-r border-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                  Net Asset (Stock)
                </td>
                {periodColumns.map(period => {
                  const val = gridData[category.id]?.[period.key]?.balance || 0;
                  return (
                    <td key={period.key} className={`px-4 py-1.5 text-right font-mono font-bold border-r border-slate-800/50 ${val < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {currencySymbol}{val.toLocaleString()}
                    </td>
                  );
                })}
                 <td className={`px-4 py-1.5 text-right font-mono font-black border-l border-slate-700 ${finalBalance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {currencySymbol}{finalBalance.toLocaleString()}
                 </td>
              </tr>
            </React.Fragment>
          )})}
          
          {/* Summary Footer */}
          <tr className="bg-slate-950 border-t-2 border-slate-600">
             <td className="px-6 py-4 font-black text-slate-100 sticky left-0 bg-slate-950 border-r border-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.3)]">
               TOTAL NET ASSETS
             </td>
             {periodColumns.map(period => {
                // Calculate total across all categories for this week
                let weekTotal = 0;
                categories.forEach(cat => {
                    weekTotal += gridData[cat.id]?.[period.key]?.balance || 0;
                });
                return (
                  <td key={period.key} className={`px-4 py-4 text-right font-mono font-black border-r border-slate-800/50 ${weekTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currencySymbol}{weekTotal.toLocaleString()}
                  </td>
                );
             })}
             <td className="border-l border-slate-600"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
