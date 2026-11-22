export function isEditorialAdmin(user: { googleId: string } | null): boolean {
  return !!user && (process.env.CL2_EDITORIAL_ADMIN_GOOGLE_IDS || '')
    .split(',')
    .some(id => id.trim() === user.googleId);
}
