// src/lib/numberToWords.ts
// Converts numbers to Indian numbering format words (Lakhs, Crores, Thousands)

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ONES[n % 10] : '') + ' ';
  } else if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

export function numberToIndianWords(amount: number): string {
  if (amount === 0) return 'Zero';

  const parts = Math.abs(amount).toFixed(2).split('.');
  let num = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  let words = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const hundred = num;

  if (crore > 0) {
    words += convertBelowThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertBelowThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertBelowThousand(thousand) + ' Thousand ';
  }
  if (hundred > 0) {
    words += convertBelowThousand(hundred) + ' ';
  }

  words = words.trim();

  if (paise > 0) {
    words += (words ? ' and ' : '') + convertBelowThousand(paise) + ' Paise';
  }

  return words;
}

export function formatAmountInWords(
  amount: number,
  prefix = 'RUPEES',
  suffix = 'ONLY',
  casing: 'UPPERCASE' | 'Title Case' | 'Sentence Case' = 'UPPERCASE'
): string {
  const baseWords = numberToIndianWords(amount);
  let combined = `${prefix ? prefix + ' ' : ''}${baseWords}${suffix ? ' ' + suffix : ''}`.trim();

  if (casing === 'UPPERCASE') {
    return combined.toUpperCase();
  } else if (casing === 'Sentence Case') {
    return combined.charAt(0).toUpperCase() + combined.slice(1).toLowerCase();
  } else {
    // Title Case
    return combined.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }
}
