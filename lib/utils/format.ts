/**
 * India Localization & Billing Formatting Utilities
 * Time Zone Default: Asia/Kolkata (IST, UTC+05:30)
 * Currency: INR (₹)
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_CURRENCY = "INR";

/**
 * Format Date & Time in Indian Standard Time (IST)
 * Example: "11 Oct 2026, 02:45 PM IST"
 */
export function formatDateTimeIST(
  dateInput: string | number | Date | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  if (!dateInput) return "—";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timeZone || DEFAULT_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date) + " IST";
  } catch {
    return String(dateInput);
  }
}

/**
 * Format Date only in Indian Standard Time (IST)
 * Example: "11 Oct 2026"
 */
export function formatDateIST(
  dateInput: string | number | Date | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  if (!dateInput) return "—";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timeZone || DEFAULT_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format Time only in Indian Standard Time (IST)
 * Example: "02:45 PM"
 */
export function formatTimeIST(
  dateInput: string | number | Date | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  if (!dateInput) return "—";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timeZone || DEFAULT_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format Currency in Indian numbering system
 * Example: ₹1,50,000.00
 */
export function formatCurrencyINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "₹0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹0.00";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Convert numerical amount into Words according to the Indian Numbering System
 * Example: 1250 -> "Rupees One Thousand Two Hundred Fifty Only"
 */
export function amountToWordsINR(amountInput: number | string | null | undefined): string {
  const num = typeof amountInput === "string" ? parseFloat(amountInput) : Number(amountInput || 0);
  if (isNaN(num) || num <= 0) return "Rupees Zero Only";

  const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const twoDigits = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tensMultiple = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 10) return singleDigits[n];
    if (n < 20) return twoDigits[n - 10];
    return tensMultiple[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + singleDigits[n % 10] : "");
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = "";
    if (hundred > 0) {
      res += singleDigits[hundred] + " Hundred";
      if (rest > 0) res += " ";
    }
    if (rest > 0) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  // Indian System: Crores, Lakhs, Thousands, Hundreds
  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const hundred = integerPart % 1000;

  let words = "Rupees ";

  if (crore > 0) {
    words += convertTwoDigits(crore) + " Crore ";
  }
  if (lakh > 0) {
    words += convertTwoDigits(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    words += convertTwoDigits(thousand) + " Thousand ";
  }
  if (hundred > 0) {
    words += convertThreeDigits(hundred) + " ";
  }

  words = words.trim();

  if (decimalPart > 0) {
    words += " and " + convertTwoDigits(decimalPart) + " Paise";
  }

  words += " Only";
  return words;
}
