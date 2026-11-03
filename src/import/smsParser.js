import { rupeesToPaise } from '../finance/money';

const AMOUNT_PATTERNS = [
  /(?:INR|Rs\\.?|₹)\\s*([\\d,]+(?:\\.\\d{1,2})?)/i,
  /(?:debited|credited|spent|received|paid|purchase of|withdrawn)\\s*(?:by|with|for)?\\s*(?:INR|Rs\\.?|₹)?\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
];
const DATE_PATTERNS = [/(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})/, /(\\d{1,2})[-/](\\d{1,2})[-/](\\d{2,4})/];
function smsDate(raw, fallback) {
  let m=raw.match(DATE_PATTERNS[0]);
  if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=raw.match(DATE_PATTERNS[1]);
  if(m) { const y=m[3].length===2?`20${m[3]}`:m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
  const d=new Date(fallback); const local=new Date(d.getTime()-d.getTimezoneOffset()*60000); return local.toISOString().slice(0,10);
}
function hashFingerprint(value) {
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16);
}
function guessCategory(text) {
  const s=text.toLowerCase();
  if(/zomato|swiggy|restaurant|cafe|food|grocery|bigbasket|blinkit|zepto/.test(s)) return 'Food & Groceries';
  if(/uber|ola|rapido|metro|fuel|petrol|diesel|fastag|irctc|railway/.test(s)) return 'Transport';
  if(/amazon|flipkart|myntra|shopping|retail/.test(s)) return 'Shopping';
  if(/electricity|water bill|gas bill|broadband|mobile recharge|postpaid|prepaid/.test(s)) return 'Bills & Utilities';
  if(/netflix|spotify|prime video|hotstar|movie|cinema/.test(s)) return 'Entertainment';
  if(/salary|payroll|stipend/.test(s)) return 'Salary';
  if(/atm|cash withdrawal/.test(s)) return 'Cash';
  return 'Uncategorized';
}
export function parseBankSms(text, receivedAt = Date.now(), sender = '') {
  const raw=String(text||'').replace(/\\s+/g,' ').trim();
  if(!raw) return null;
  const lower=raw.toLowerCase();
  if(/otp|one.time.password|verification code|available balance|minimum balance|statement|will be debited|mandate registered/.test(lower)) return null;
  const type=/credited|received|deposited|refund|cashback/.test(lower)?'income':/debited|spent|paid|purchase|withdrawn|sent to|upi txn/.test(lower)?'expense':null;
  if(!type) return null;
  const match=AMOUNT_PATTERNS.map(p=>raw.match(p)).find(Boolean);
  if(!match) return null;
  const amount=Number(match[1].replace(/,/g,''));
  if(!Number.isFinite(amount)||amount<=0) return null;
  const reference=(raw.match(/(?:UPI Ref(?:erence)?(?: No)?|UTR|RRN|Txn(?:\\s*ID)?|Transaction ID)\\s*[:#-]?\\s*([A-Z0-9]{8,})/i)||[])[1];
  const merchant=(raw.match(/(?:to|at|from)\\s+([A-Z0-9 .&_-]{2,40}?)(?:\\s+(?:on|ref|upi|via)|[.,;]|$)/i)||[])[1];
  const timestamp=Number(receivedAt)||Date.now();
  const date=smsDate(raw,new Date(timestamp));
  const fingerprint=reference?`sms:${reference.toUpperCase()}`:`sms:${hashFingerprint(`${sender.toLowerCase()}|${timestamp}|${type}|${Math.round(amount*100)}|${raw.toLowerCase()}`)}`;
  const category=guessCategory(`${raw} ${merchant||''}`);
  return {type,amountPaise:rupeesToPaise(amount),category,note:merchant?.trim()||`${category==='Uncategorized'?'Bank/UPI':category} transaction`,account:'Bank',source:'sms',externalId:fingerprint,transactionDate:date};
}
export function parseSmsBatch(messages) {
  return messages.map(m=>parseBankSms(m.body,m.date,m.address)).filter(Boolean);
}