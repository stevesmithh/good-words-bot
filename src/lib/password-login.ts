/** Password-only access is available only when exactly one account exists. */
export function passwordLoginUsername(members: { username: string }[]): string | null {
  return members.length === 1 ? members[0]?.username ?? null : null;
}