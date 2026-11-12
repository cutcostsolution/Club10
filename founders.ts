/**
 * The two founders of Club 10 and their back-office titles:
 *  - Charity Wealth — "the Admin": her access can NEVER be revoked by anyone.
 *  - Moses Egbiremhon — "Founder": his access can only be revoked by Charity.
 * Both of them can revoke any other admin's access.
 */
export const ADMIN_EMAIL = "realestateintelligencelab@gmail.com";
export const FOUNDER_EMAIL = "mocious2021@gmail.com";

export function isAdmin(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

export function isFounder(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === FOUNDER_EMAIL;
}

/** Display title for the two founders; null for everyone else. */
export function founderTitle(email?: string | null): "Admin" | "Founder" | null {
  if (isAdmin(email)) return "Admin";
  if (isFounder(email)) return "Founder";
  return null;
}

/**
 * Approval-attribution privacy (security rule):
 *  - If CHARITY approved/reviewed something, only Charity herself sees her
 *    name — every other admin (including Moses) sees "Admin office".
 *  - Any other admin's reviews are tracked and shown by name to everyone,
 *    so approvals are auditable apart from Charity.
 */
export function reviewerDisplay(
  viewerEmail?: string | null,
  reviewer?: { email?: string | null; name?: string | null } | null
): string | null {
  if (!reviewer) return null;
  if (isAdmin(reviewer.email) && !isAdmin(viewerEmail)) return "Admin office";
  return reviewer.name ?? null;
}

/** Both founder accounts (Charity + Moses). Their membership never expires —
 *  lifetime access, and it is never DISPLAYED as such anywhere. */
export function isFounderAccount(email?: string | null) {
  return isAdmin(email) || isFounder(email);
}

/**
 * Background-monitoring protocol: Charity's Executive category is invisible to
 * everyone but herself — other members, other admins and the public see her as
 * a plain Basic member. Memberships are keyed by the member's USER email.
 */
export function visibleCategory(
  viewerEmail: string | null | undefined,
  memberUserEmail: string | null | undefined,
  category: string
): string {
  if (isAdmin(memberUserEmail) && !isAdmin(viewerEmail)) return "basic";
  return category;
}
