import { rupeesToPaise } from '../finance/money';

function fingerprint(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function transactionDate(raw, fallback = Date.now()) {
  let match = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  const d = new Date(fallback);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function categoryFor(text) {
  const s = text.toLowerCase();
  if (/zomato|swiggy|restaurant|cafe|food|grocery|bigbasket|blinkit|zepto/.test(s)) return 'Food & Groceries';
  if (/uber|ola|rapido|metro|fuel|petrol|diesel|fastag|irctc|railway/.test(s)) return 'Transport';
  if (/amazon|flipkart|myntra|shopping|retail/.test(s)) return 'Shopping';
  if (/electricity|water bill|gas bill|broadband|mobile recharge|postpaid|prepaid/.test(s)) return 'Bills & Utilities';
  if (/netflix|spotify|prime video|hotstar|movie|cinema/.test(s)) return 'Entertainment';
  if (/salary|payroll|stipend/.test(s)) return 'Salary';
  if (/atm|cash withdrawal/.test(s)) return 'Cash';
  return 'Uncategorized';
}

export function parseBankSms(text, receivedAt = Date.now(), sender = '') {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (/\botp\b|one.time.password|verification code|available balance|minimum balance|statement|will be debited|mandate registered/.test(lower)) return null;
  const type = /credited|received|deposited|refund|cashback/.test(lower) ? 'income'
    : /debited|spent|paid|purchase|withdrawn|sent to|upi txn/.test(lower) ? 'expense' : null;
  if (!type) return null;
  const amountMatch = raw.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i)
    || raw.match(/(?:debited|credited|spent|received|paid|purchase of|withdrawn)\s*(?:by|with|for)?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const reference = (raw.match(/(?:UPI Ref(?:erence)?(?: No)?|UTR|RRN|Txn(?:\s*ID)?|Transaction ID)\s*[:#-]?\s*([A-Z0-9]{8,})/i) || [])[1];
  const merchant = (raw.match(/(?:to|at|from)\s+([A-Z0-9 .&_-]{2,40}?)(?:\s+(?:on|ref|upi|via)|[.,;]|$)/i) || [])[1];
  const date = transactionDate(raw, receivedAt);
  const externalId = reference ? `sms:${reference.toUpperCase()}`
    : `sms-paste:${fingerprint(`${date}| ${type}| ${Math.round(amount * 100)}| ${raw.toLowerCase()}`)}`;
  const category = categoryFor(`${raw} ${merchant || ''}`);
  return {
    type,
    amountPaise: rupeesToPaise(amount),
    category,
    note: merchant?.trim() || (category === 'Uncategorized' ? 'Bank/UPI transaction' : category),
    account: 'Bank',
    source: 'sms',
    externalId,
    transactionDate: date
  };
}

export function parsePastedSmsBatch(text) {
  return String(text || '').split(/\n\s*\n+/)
    .map((block) => parseBankSms(block))
    .filter(Boolean);
}
