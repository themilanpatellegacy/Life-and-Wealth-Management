
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  NPR = 'NPR'
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Category {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  categoryId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: TransactionType;
}

export interface GeminiParsedData {
  categoryName: string;
  amount: number;
  type: TransactionType;
  date?: string;
}
