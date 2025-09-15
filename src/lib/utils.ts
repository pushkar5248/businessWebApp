import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | Date): string {
  try {
    const date = new Date(dateStr);
    
    // Adjust for timezone offset if the input is a string like 'YYYY-MM-DD'
    // to prevent off-by-one day errors.
    if (typeof dateStr === 'string' && !dateStr.includes('T')) {
       const userTimezoneOffset = date.getTimezoneOffset() * 60000;
       const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
       
       const day = String(adjustedDate.getDate()).padStart(2, '0');
       const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
       const year = adjustedDate.getFullYear();
       return `${day}-${month}-${year}`;
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;

  } catch (error) {
    console.error("Invalid date provided to formatDate:", dateStr);
    return "Invalid Date";
  }
}
