// Requirement: Main Admin Credentials:
// gmail: 6nathan.dev@gmail.com | password: Khunsan.1605 หรือ username: NathanKunsan | password: Khunsan.1605
export const isMainAdmin = (username?: string | null, email?: string | null): boolean => {
  const cleanU = (username || '').trim().toLowerCase();
  const cleanE = (email || '').trim().toLowerCase();
  return cleanU === 'nathankunsan' || cleanE === '6nathan.dev@gmail.com';
};
