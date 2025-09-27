import { parseISO, format } from "date-fns";

export const safeFmt = (s?: string, f = "EEE MMM d, h:mma") => {
  if (!s) return "—";
  try { 
    const d = parseISO(s); 
    return isNaN(d.getTime()) ? "—" : format(d, f); 
  } catch { 
    return "—"; 
  }
};

// Additional utility for common time formatting
export const safeTimeFormat = (s?: string) => {
  return safeFmt(s, "h:mm a");
};

// Additional utility for date-only formatting  
export const safeDateFormat = (s?: string) => {
  return safeFmt(s, "MMM d, yyyy");
};