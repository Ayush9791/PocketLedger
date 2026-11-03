import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

let db;
async function databaseKey() {
  let key = await SecureStore.getItemAsync('pocketledger.db.key');
  if (!key) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync('pocketledger.db.key', key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }
  return key;
}
export async function initializeDatabase() {
  const key = await databaseKey();
  db = await SQLite.openDatabaseAsync('pocketledger.db');
  const cipher = await db.getFirstAsync('PRAGMA cipher_version;');
  if (!cipher || !Object.values(cipher).some(Boolean)) {
    throw new Error('Encrypted SQLite is unavailable in this build. Refusing to open an unencrypted finance database.');
  }
  await db.execAsync(`PRAGMA key = "x'${key}'";`);
  await db.execAsync('PRAGMA cipher_memory_security = ON;');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL CHECK(type IN ('income','expense')));
    CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'cash');
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
      amount_paise INTEGER NOT NULL CHECK(amount_paise > 0), category TEXT NOT NULL,
      note TEXT DEFAULT '', account TEXT NOT NULL DEFAULT 'Cash', source TEXT NOT NULL DEFAULT 'manual',
      external_id TEXT UNIQUE, transaction_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category_date ON transactions(category,transaction_date);
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, month TEXT NOT NULL,
      limit_paise INTEGER NOT NULL CHECK(limit_paise >= 0), UNIQUE(category, month)
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      monthly_fee_paise INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      amount_paise INTEGER NOT NULL CHECK(amount_paise > 0), paid_date TEXT NOT NULL,
      month_for TEXT NOT NULL, note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sms_imports (id INTEGER PRIMARY KEY AUTOINCREMENT, fingerprint TEXT NOT NULL UNIQUE, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  await db.runAsync("INSERT OR IGNORE INTO accounts(name,type) VALUES ('Cash','cash')");
  await db.runAsync("INSERT OR IGNORE INTO accounts(name,type) VALUES ('Bank','bank')");
  return db;
}
export async function addTransaction(t) {
  return db.runAsync('INSERT INTO transactions(type,amount_paise,category,note,account,source,external_id,transaction_date) VALUES(?,?,?,?,?,?,?,?)',
    [t.type,t.amountPaise,t.category,t.note||'',t.account||'Cash',t.source||'manual',t.externalId||null,t.transactionDate]);
}
export async function listTransactions(limit=300) {
  return db.getAllAsync('SELECT * FROM transactions ORDER BY transaction_date DESC,id DESC LIMIT ?',[limit]);
}
export async function monthlySummary(date=new Date()) {
  const month=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const row=await db.getFirstAsync(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount_paise ELSE 0 END),0) income, COALESCE(SUM(CASE WHEN type='expense' THEN amount_paise ELSE 0 END),0) expense FROM transactions WHERE substr(transaction_date,1,7)=?`,[month]);
  return {...row,net:row.income-row.expense};
}
export async function importTransactionBatch(items) {
  let inserted=0,skipped=0;
  await db.withTransactionAsync(async()=>{
    for(const item of items){
      try{await addTransaction(item);inserted++;}
      catch(e){if(String(e).includes('UNIQUE')) skipped++; else throw e;}
    }
  });
  return {inserted,skipped};
}
export async function listStudents(month=new Date().toISOString().slice(0,7)) {
  return db.getAllAsync(`SELECT s.*, COALESCE(SUM(CASE WHEN substr(p.month_for,1,7)=? THEN p.amount_paise ELSE 0 END),0) paid_this_month FROM students s LEFT JOIN fee_payments p ON p.student_id=s.id WHERE s.active=1 GROUP BY s.id ORDER BY s.name COLLATE NOCASE`,[month]);
}
export async function addStudent(name,monthlyFeePaise) {
  return db.runAsync('INSERT INTO students(name,monthly_fee_paise) VALUES(?,?)',[name.trim(),monthlyFeePaise]);
}
export async function recordFeePayment(studentId,amountPaise,monthFor,paidDate,note='') {
  await db.withTransactionAsync(async()=>{
    const payment=await db.runAsync('INSERT INTO fee_payments(student_id,amount_paise,month_for,paid_date,note) VALUES(?,?,?,?,?)',[studentId,amountPaise,monthFor,paidDate,note]);
    await db.runAsync(`INSERT INTO transactions(type,amount_paise,category,note,account,source,external_id,transaction_date) VALUES('income',?,'Tuition',?,'Cash','tuition',?,?)`,[amountPaise,`Tuition fee · ${note||'Student payment'}`,`tuition-payment:${payment.lastInsertRowId}`,paidDate]);
  });
}
export async function listStudentPayments(studentId) {
  return db.getAllAsync('SELECT * FROM fee_payments WHERE student_id=? ORDER BY paid_date DESC,id DESC',[studentId]);
}
export async function listBudgets(month) {
  return db.getAllAsync(`SELECT b.*, COALESCE((SELECT SUM(t.amount_paise) FROM transactions t WHERE t.type='expense' AND t.category=b.category AND substr(t.transaction_date,1,7)=b.month),0) spent_paise FROM budgets b WHERE b.month=? ORDER BY b.category`,[month]);
}
export async function saveBudget(category,month,limitPaise) {
  return db.runAsync('INSERT INTO budgets(category,month,limit_paise) VALUES(?,?,?) ON CONFLICT(category,month) DO UPDATE SET limit_paise=excluded.limit_paise',[category.trim(),month,limitPaise]);
}
export async function monthlyTrend(monthCount=6) {
  return db.getAllAsync(`SELECT substr(transaction_date,1,7) month, SUM(CASE WHEN type='income' THEN amount_paise ELSE 0 END) income, SUM(CASE WHEN type='expense' THEN amount_paise ELSE 0 END) expense FROM transactions WHERE transaction_date >= date('now','start of month',?) GROUP BY substr(transaction_date,1,7) ORDER BY month`,[`-${monthCount-1} months`]);
}
export async function expenseBreakdown(month) {
  return db.getAllAsync(`SELECT category,SUM(amount_paise) amount_paise FROM transactions WHERE type='expense' AND substr(transaction_date,1,7)=? GROUP BY category ORDER BY amount_paise DESC`,[month]);
}
export async function tuitionReport(month) {
  const row=await db.getFirstAsync('SELECT COALESCE(SUM(p.amount_paise),0) collected_paise, COUNT(p.id) payment_count FROM fee_payments p WHERE substr(p.month_for,1,7)=?',[month]);
  const expected=await db.getFirstAsync('SELECT COALESCE(SUM(monthly_fee_paise),0) expected_paise FROM students WHERE active=1');
  return {...row,expected_paise:expected.expected_paise||0,pending_paise:Math.max(0,(expected.expected_paise||0)-(row.collected_paise||0))};
}