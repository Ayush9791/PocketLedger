import Papa from 'papaparse';
import { rupeesToPaise } from '../finance/money';

const normalized = row => Object.fromEntries(Object.entries(row).map(([k,v]) => [k.toLowerCase().trim().replace(/[_-]+/g,' '), String(v ?? '').trim()]));
const get = (row, keys) => { for (const key of keys) if (row[key]) return row[key]; return ''; };
const amountNumber = value => {
  const cleaned = String(value || '').replace(/[₹,\\s]/g,'').replace(/^\\((.*)\\)$/,'-$1');
  return cleaned ? Number(cleaned) : 0;
};
function normalizeDate(raw) {
  const s=String(raw||'').trim();
  let m=s.match(/^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})/);
  if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=s.match(/^(\\d{1,2})[-/](\\d{1,2})[-/](\\d{2,4})$/);
  if(m) return `${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}
export function parseTransactionsCSV(csvText) {
  const parsed=Papa.parse(csvText,{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.trim()});
  if(parsed.errors.length) throw new Error(parsed.errors[0].message);
  if(!parsed.meta.fields?.length) throw new Error('CSV needs a header row.');
  const rows=[];
  const fingerprintCounts=new Map();
  parsed.data.forEach((original,i)=>{
    const row=normalized(original);
    const debitRaw=get(row,['debit','withdrawal','withdrawal amount','dr amount']);
    const creditRaw=get(row,['credit','deposit','deposit amount','cr amount']);
    const amountRaw=get(row,['amount','value','transaction amount']);
    const rawType=get(row,['type','transaction type','dr cr','dr/cr']).toLowerCase();
    let amount,type;
    if(debitRaw||creditRaw){
      const debit=amountNumber(debitRaw),credit=amountNumber(creditRaw);
      if(debit>0&&credit>0) throw new Error(`Both debit and credit are populated on CSV row ${i+2}.`);
      amount=credit>0?credit:debit; type=credit>0?'income':'expense';
    } else {
      amount=amountNumber(amountRaw);
      type=/income|credit|deposit|\\bcr\\b/.test(rawType)?'income':'expense';
      if(amount<0){amount=Math.abs(amount);type=type==='income'?'expense':'income';}
    }
    if(/debit|withdrawal|\\bdr\\b/.test(rawType)) type='expense';
    if(/credit|deposit|\\bcr\\b/.test(rawType)) type='income';
    if(!Number.isFinite(amount)||amount<=0) throw new Error(`Invalid amount on CSV row ${i+2}.`);
    const date=normalizeDate(get(row,['date','transaction date','value date','txn date']));
    if(!date) throw new Error(`Unsupported date on CSV row ${i+2}. Use YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY.`);
    const description=get(row,['description','narration','remarks','merchant','details','particulars']);
    const category=get(row,['category'])||'Uncategorized';
    const reference=get(row,['reference','reference number','transaction id','utr','ref no','rrn']);
    const baseKey=reference?reference.toUpperCase():`${date}:${type}:${Math.round(amount*100)}:${description.toLowerCase()}`;
    const occurrence=(fingerprintCounts.get(baseKey)||0)+1; fingerprintCounts.set(baseKey,occurrence);
    const stableKey=reference?`ref:${reference.toUpperCase()}`:`${baseKey}:${occurrence}`;
    rows.push({type,amountPaise:rupeesToPaise(amount),category,note:description,account:'Bank',source:'csv',externalId:`csv:${stableKey}`,transactionDate:date});
  });
  return rows;
}