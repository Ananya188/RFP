// Drop-in replacement for parseWithRules
export function parseWithRules(text) {
  if (!text || typeof text !== 'string') throw new TypeError('text must be a string');

  const original = text.trim();
  const lower = original.toLowerCase();

  const items = [];

  // --- Helpers ---
  const wordNumberMap = {
    zero:0, one:1, two:2, three:3, four:4, five:5,
    six:6, seven:7, eight:8, nine:9, ten:10,
    eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
    sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20,
    thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90,
    lakh:100000, crore:10000000
  };

  const toNumber = (s) => {
    if (s == null) return null;
    const str = String(s).trim().toLowerCase();
    // pure digits (with commas/decimal)
    if (/^[\d,]+(?:\.\d+)?$/.test(str)) return Number(str.replace(/,/g, ''));
    // shorthand 50k / 50K
    const kMatch = str.match(/^([\d.]+)\s*k$/i);
    if (kMatch) return Number(kMatch[1]) * 1000;
    // phrases like "5 lakh" or "2 crore"
    const bigMatch = str.match(/(\d+(?:\.\d+)?)\s*(lakh|crore)/i);
    if (bigMatch) {
      const n = Number(bigMatch[1]);
      return bigMatch[2].toLowerCase() === 'lakh' ? n * 100000 : n * 10000000;
    }
    // extract first digits if present
    const d = str.match(/(\d+(?:\.\d+)?)/);
    if (d) return Number(d[1]);
    // word numbers (simple)
    if (wordNumberMap.hasOwnProperty(str)) return wordNumberMap[str];
    // try split words (e.g., "fifty thousand")
    const tokens = str.split(/[\s-]+/).filter(Boolean);
    let total = 0, had = false;
    for (let t of tokens) {
      if (wordNumberMap[t] != null) {
        total += wordNumberMap[t];
        had = true;
        continue;
      }
      // thousand/hundred multipliers
      if (t === 'thousand') { total = total || 1; total *= 1000; had = true; continue; }
      if (t === 'hundred') { total = total || 1; total *= 100; had = true; continue; }
      if (t === 'lakh') { total = total || 1; total *= 100000; had = true; continue; }
      if (t === 'crore') { total = total || 1; total *= 10000000; had = true; continue; }
    }
    return had ? total : null;
  };

  const parseCurrencyToNumber = (s) => {
    if (!s) return null;
    // common cases: "$50,000", "50,000 total", "5 lakh INR", "₹75,000", "50k"
    const cleaned = String(s).trim();
    // direct numeric parse first
    const n1 = toNumber(cleaned);
    if (typeof n1 === 'number' && !Number.isNaN(n1)) return n1;
    // fallback strip symbols
    const cand = cleaned.replace(/[^0-9kKmMlLaAcCrOre\s.,-]/g, '').trim();
    const n2 = toNumber(cand);
    if (typeof n2 === 'number' && !Number.isNaN(n2)) return n2;
    return null;
  };

  const normalizeItemName = (name) => {
    if (!name) return name;
    return name.replace(/\s+/g, ' ').replace(/\blaptops\b/i, 'laptop').replace(/\bmonitors\b/i, 'monitor').toLowerCase().trim();
  };

  const pushItem = (name, qty = 1, specs = {}) => {
    if (!name) return;
    const n = normalizeItemName(name);
    const existing = items.find(it => it.name === n);
    if (existing) {
      existing.quantity = (existing.quantity || 0) + (qty || 0);
      existing.specs = { ...(existing.specs || {}), ...(specs || {}) };
    } else {
      items.push({ name: n, quantity: qty || 1, specs: specs || {} });
    }
  };

  // --- Item detection (hardware first) ---
  // explicit patterns like "20 laptops", "15 monitors 27-inch"
  const explicitItemRegex = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:x|\s+)?\s*(laptops?|monitors?|printers?|chairs?|desks?|routers?|switches?|phones?|tablets?|CPU?|servers?|workstations?|keyboards?|mice|projectors?)(?:\b|[^,;.]?)/ig;
  let m;
  while ((m = explicitItemRegex.exec(lower)) !== null) {
    const rawQty = m[1];
    const qty = toNumber(rawQty) || 1;
    const name = m[2];
    pushItem(name, qty, {});
  }

  // If still none, fallback to software detection
  if (items.length === 0) {
    if (/mobile app|android|ios|app development/.test(lower)) {
      const platforms = [];
      if (/android/.test(lower)) platforms.push('Android');
      if (/ios|iphone/.test(lower)) platforms.push('iOS');
      pushItem('mobile app', 1, platforms.length ? { platforms } : {});
    }
    if (/web app|website|web application/.test(lower)) pushItem('web app', 1, {});
    if (/api development|build an api|create api/.test(lower)) pushItem('api', 1, {});
  }

  // --- Specs enrichment (RAM and monitor size) ---
  // global RAM first occurrence
  const globalRamMatch = lower.match(/(\d{1,3})\s*gb\s*(?:ram)?/i);
  const globalRam = globalRamMatch ? `${globalRamMatch[1]}GB` : null;
  // global monitor size
  const globalSizeMatch = lower.match(/\b([2-4]\d|5[0-9])(?:\s*-\s*inch|\s*inch|["']|in\b)/i);
  const globalSize = globalSizeMatch ? `${globalSizeMatch[1]}-inch` : null;

  // segment-level enrichment (split sentences to find local specs)
  const segments = original.split(/[.;!\n]/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const segL = seg.toLowerCase();
    if (/\blaptop(s)?\b/.test(segL)) {
      const rm = segL.match(/(\d{1,3})\s*gb\s*(?:ram)?/i);
      if (rm) {
        items.filter(it => /laptop/.test(it.name)).forEach(it => { if (!it.specs) it.specs = {}; if (!it.specs.ram) it.specs.ram = `${rm[1]}GB`; });
      }
    }
    if (/\bmonitor(s)?\b/.test(segL)) {
      const sm = segL.match(/\b([2-4]\d|5[0-9])(?:\s*-\s*inch|\s*inch|["']|in\b)/i);
      if (sm) {
        items.filter(it => /monitor/.test(it.name)).forEach(it => { if (!it.specs) it.specs = {}; if (!it.specs.size) it.specs.size = `${sm[1]}-inch`; });
      }
    }
  }

  // attach global where missing
  for (const it of items) {
    if (/laptop/.test(it.name) && globalRam && !it.specs.ram) it.specs.ram = globalRam;
    if (/monitor/.test(it.name) && globalSize && !it.specs.size) it.specs.size = globalSize;
  }

  // --- Budget extraction (robust) ---
  // candidates: "Budget is $50,000 total", "Budget: 5 lakh INR", "Total budget $50,000"
  let totalBudget = null;
  const budgetRegexes = [
    /budget(?:\s*is|\s*:)?\s*([^\.\n;]+)/i,
    /total budget(?:\s*is|\s*:)?\s*([^\.\n;]+)/i,
    /budget[:\s]*([₹$€£]?\s?[\d,.\skKmMlLaAcCrOrEe]+)/i
  ];
  for (const br of budgetRegexes) {
    const bm = original.match(br);
    if (bm && bm[1]) {
      const parsed = parseCurrencyToNumber(bm[1]);
      if (parsed != null && !Number.isNaN(parsed)) { totalBudget = parsed; break; }
    }
  }
  // fallback: find first currency-like number anywhere ($... or number with commas)
  if (totalBudget == null) {
    const anyMoney = original.match(/([₹$€£]\s?[\d,]+(?:\.\d+)?)/) || original.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/);
    if (anyMoney && anyMoney[1]) {
      const p = parseCurrencyToNumber(anyMoney[1]);
      if (p != null && !Number.isNaN(p)) totalBudget = p;
    }
  }
  // ensure not NaN
  if (typeof totalBudget === 'number' && Number.isNaN(totalBudget)) totalBudget = null;

  // --- Delivery / timeline extraction ---
  let deliveryDays = null;
  const deliveryPatterns = [
    /timeline .*?(\d+)\s*days?/i,
    /timeline.*?(\d+)\s*day/i,
    /need delivery within\s+(\d+)\s*days?/i,
    /need\s+delivery\s+within\s+(\d+)\s*days?/i,
    /within\s+(\d+)\s*days?/i,
    /deliver(?:y)? in\s+(\d+)\s*days?/i,
    /required within\s+(\d+)\s*days?/i,
    /(\d+)\s*days?\s*(?:timeline|delivery)/i
  ];
  for (const p of deliveryPatterns) {
    const dm = lower.match(p);
    if (dm) { deliveryDays = toNumber(dm[1]); break; }
  }

  // --- Payment terms ---
  let paymentTerms = null;
  if (/\bnet\s*\d{1,3}\b/i.test(lower)) {
    const net = lower.match(/\bnet\s*(\d{1,3})\b/i);
    if (net) paymentTerms = `net ${toNumber(net[1])}`;
  } else if (/\bmilestone[- ]?based\b/i.test(lower)) {
    paymentTerms = 'milestone-based';
  } else if (/\bpayment on delivery\b|\bpay on delivery\b|\bpayment upon delivery\b/i.test(lower)) {
    paymentTerms = 'payment on delivery';
  } else {
    const p = original.match(/payment terms[:\s]*([^.;\n]+)/i);
    if (p) paymentTerms = p[1].trim();
  }

  // --- Warranty months ---
  let warrantyMonths = null;
  const wMonths = lower.match(/(\d{1,3})\s*months?/i);
  const wYears = lower.match(/(\d{1,2})\s*(?:years?|yrs?|yr)/i);
  const wWord = lower.match(/(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:years?|year)/i);
  if (wMonths) warrantyMonths = toNumber(wMonths[1]);
  else if (wYears) warrantyMonths = toNumber(wYears[1]) * 12;
  else if (wWord && wordNumberMap[wWord[1].toLowerCase()] != null) warrantyMonths = wordNumberMap[wWord[1].toLowerCase()] * 12;
  else {
    const wMin = lower.match(/(?:at least|min(?:imum)?)\s*(\d{1,2})\s*(?:years?|year)/i);
    if (wMin) warrantyMonths = toNumber(wMin[1]) * 12;
  }

  // --- Title building ---
  const titleParts = items.map(it => {
    const qty = it.quantity || 1;
    const specParts = [];
    if (it.specs) {
      if (it.specs.ram) specParts.push(it.specs.ram);
      if (it.specs.size) specParts.push(it.specs.size);
      if (it.specs.platforms) specParts.push(Array.isArray(it.specs.platforms) ? it.specs.platforms.join('/') : it.specs.platforms);
    }
    const specsStr = specParts.length ? ` (${specParts.join(', ')})` : '';
    return `${qty}x ${it.name}${specsStr}`;
  });
  const title = titleParts.length ? `Procure: ${titleParts.join(', ')}` : 'New RFP';

  return {
    title,
    description: original,
    items,
    totalBudget,       // number or null (safe for Mongoose if you allow null)
    deliveryDays,
    paymentTerms,
    warrantyMonths
  };
}
