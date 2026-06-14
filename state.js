// state.js v25 — Persistent state management (save/resume across restarts)
const fs = require('fs');
const cfg = require('./config');

class StateManager {
  constructor(filePath) {
    this.filePath = filePath || cfg.state.file;
    this.saveTimer = null;
    this.dirty = false;
  }

  // Save current bot state to disk
  save(botState) {
    try {
      const data = {
        version: '25.0',
        savedAt: new Date().toISOString(),
        timestamp: Date.now(),
        ...botState,
      };
      // Atomic write: write to tmp then rename
      const tmpFile = this.filePath + '.tmp';
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
      fs.renameSync(tmpFile, this.filePath);
      this.dirty = false;
      return true;
    } catch (e) {
      console.error(`[STATE] Save failed: ${e.message}`);
      return false;
    }
  }

  // Load saved state from disk
  load() {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);

      // Validate version
      if (!data.version) return null;

      // Check staleness (>24h old = stale, warn but still load)
      const age = Date.now() - (data.timestamp || 0);
      if (age > 86400000) {
        console.log(`[STATE] Warning: saved state is ${Math.round(age / 3600000)}h old`);
      }

      console.log(`[STATE] Loaded state from ${data.savedAt} (${Math.round(age / 60000)}min ago)`);
      return data;
    } catch (e) {
      console.error(`[STATE] Load failed: ${e.message}`);
      return null;
    }
  }

  // Start auto-save timer
  startAutoSave(getStateFn, intervalMs) {
    if (this.saveTimer) clearInterval(this.saveTimer);
    const interval = intervalMs || cfg.state.saveInterval;
    this.saveTimer = setInterval(() => {
      const state = getStateFn();
      if (state) this.save(state);
    }, interval);
    console.log(`[STATE] Auto-save every ${interval / 1000}s to ${this.filePath}`);
  }

  // Stop auto-save
  stopAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }

  // Mark state as dirty (needs save)
  markDirty() {
    this.dirty = true;
  }

  // Clean up on exit
  shutdown(getStateFn) {
    this.stopAutoSave();
    if (getStateFn) {
      const state = getStateFn();
      if (state) {
        this.save(state);
        console.log('[STATE] Final state saved on shutdown');
      }
    }
  }
}

module.exports = StateManager;
