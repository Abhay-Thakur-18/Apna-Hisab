/**
 * Converts paise (integer) to rupees (number).
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Safely converts rupees to paise, avoiding floating point precision errors.
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Formats a paise amount into the Indian Rupee formatting style.
 * Example: 125075 paise -> ₹1,250.75
 * Example: 12500000 paise -> ₹1,25,000.00
 */
export function formatRupees(paise: number): string {
  const rupeesVal = paiseToRupees(paise);
  const isNegative = rupeesVal < 0;
  const absVal = Math.abs(rupeesVal);
  
  // Get decimal parts
  const parts = absVal.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  let formattedInt = '';
  
  if (integerPart.length <= 3) {
    formattedInt = integerPart;
  } else {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const remaining = integerPart.substring(0, integerPart.length - 3);
    
    // Group remaining digits by twos (Indian standard: 12,34,567)
    const reversedRemaining = remaining.split('').reverse().join('');
    const groups: string[] = [];
    for (let i = 0; i < reversedRemaining.length; i += 2) {
      groups.push(reversedRemaining.substring(i, i + 2));
    }
    
    const formattedRemaining = groups.join(',').split('').reverse().join('');
    formattedInt = `${formattedRemaining},${lastThree}`;
  }
  
  return `${isNegative ? '-' : ''}₹${formattedInt}.${decimalPart}`;
}
