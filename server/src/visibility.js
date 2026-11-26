const Follow = require('sidequest-database/models/Follow');
const { HttpError } = require('./http');

// Privacy rules for profile activity (PBI-31) and wishlists (PBI-29).
//
// Each setting is `public` (anyone, signed in or not), `followers` (users who
// follow the owner), or `private` (the owner only). The owner always sees
// everything. Any other value is treated as `private`, so a bad value fails closed.
//
// Every route that shows a user's activity must check it here: profile history,
// wishlists, and the Steam achievement route (#51). Reviews still appear on game
// pages and count toward game ratings whatever the setting, because those show
// the review, not the person's activity history.

// Settings that let a follower see the data.
const FOLLOWER_VISIBLE = ['public', 'followers'];

// Older accounts saved before activityVisibility existed are public.
const activityVisibilityOf = user => user.activityVisibility ?? 'public';
const wishlistVisibilityOf = user => user.wishlistVisibility ?? 'private';

const isOwner = (viewerId, owner) => Boolean(viewerId) && String(viewerId) === String(owner._id);

// Whether `viewerId` (the signed-in user's id, or null/undefined when signed out)
// may see data that `owner` protects with `setting`. Defaults to the owner's
// activity setting. Pass `wishlistVisibilityOf(owner)` for the wishlist.
async function canViewActivity(viewerId, owner, setting = activityVisibilityOf(owner)) {
  if (isOwner(viewerId, owner)) return true;
  if (setting === 'public') return true;
  if (setting !== 'followers' || !viewerId) return false;
  return Boolean(await Follow.exists({ follower: viewerId, followee: owner._id }));
}

// Throws 403 ACTIVITY_PRIVATE unless the viewer may see the owner's activity.
async function assertCanViewActivity(viewerId, owner) {
  const setting = activityVisibilityOf(owner);
  if (await canViewActivity(viewerId, owner, setting)) return;
  throw new HttpError(403, 'ACTIVITY_PRIVATE', setting === 'followers'
    ? "Only this user's followers can see their activity."
    : "This user's activity is private.");
}

module.exports = {
  FOLLOWER_VISIBLE, activityVisibilityOf, wishlistVisibilityOf, canViewActivity, assertCanViewActivity,
};
