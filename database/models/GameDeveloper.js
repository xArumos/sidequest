const mongoose = require('mongoose');

const STATUSES = ['pending', 'approved', 'rejected'];

// A user's request to be recognized as a developer of one game (PBI-32). Only an
// approved record grants developer access; an admin or the approve-developer script
// decides each request.
const gameDeveloperSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  game: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  status: { type: String, enum: STATUSES, default: 'pending', required: true },
  justification: { type: String, default: '', trim: true, maxlength: 500 },
  requestedAt: { type: Date, default: Date.now, required: true },
  decidedAt: { type: Date, default: null },
  // The admin who decided; null when decided by the approve-developer script.
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
});

gameDeveloperSchema.index({ user: 1, game: 1 }, { unique: true });
// The admin queue lists requests by status, oldest first.
gameDeveloperSchema.index({ status: 1, requestedAt: 1 });

const GameDeveloper = mongoose.model('GameDeveloper', gameDeveloperSchema);
GameDeveloper.STATUSES = STATUSES;

module.exports = GameDeveloper;
