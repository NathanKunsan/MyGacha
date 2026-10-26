// Clean slug helper: removes spaces and special characters, leaving only continuous alphanumeric/Thai characters
export const toCleanSlug = (str: string): string => {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9\u0E00-\u0E7F]/g, '');
};
