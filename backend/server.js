import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { runScraper } from './scraper.js';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'db.json');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let dbCache = null;
function loadCache() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    dbCache = JSON.parse(raw);
    console.log("[Cache] Initialized database cache in memory successfully.");
  } catch (err) {
    console.error("[Cache] Critical error: Could not initialize cache from db.json:", err.message);
    dbCache = { days: [], scraperConfig: { targetFeeds: [], keywords: [], cronSchedule: "*/30 * * * *" }, scrapeLogs: [] };
  }
}
loadCache();

function reloadCache() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    dbCache = JSON.parse(raw);
    console.log("[Cache] Database cache reloaded from disk.");
  } catch (err) {
    console.error("[Cache] Failed to reload database cache from disk:", err.message);
  }
}

// Helper function to read database
function getDb() {
  return dbCache;
}

let gitSyncTimeout = null;
function triggerGitSync() {
  if (gitSyncTimeout) {
    clearTimeout(gitSyncTimeout);
  }
  gitSyncTimeout = setTimeout(() => {
    console.log("[Git Sync] Initiating auto commit & push...");
    exec('git add db.json && git commit -m "chore: auto-sync study progress and scraper updates" && git push', (err, stdout, stderr) => {
      if (err) {
        console.error("[Git Sync] Failed to auto-push:", err.message);
        return;
      }
      console.log("[Git Sync] Succeeded:\n", stdout || "Pushed successfully.");
    });
  }, 5000); // 5-second debounce window to batch rapid updates
}

// Helper function to write database
function saveDb(data) {
  dbCache = data;
  
  // Non-blocking asynchronous file write
  fs.writeFile(dbPath, JSON.stringify(dbCache, null, 2), 'utf8', (err) => {
    if (err) {
      console.error("[Cache] Async write to db.json failed:", err.message);
    } else {
      triggerGitSync();
    }
  });
  return true;
}

// Cron job variable to hold current job reference
let activeCronJob = null;

// Function to schedule/reschedule the scraper cron job
function scheduleScraperJob() {
  const dbData = getDb();
  if (!dbData) return;

  const cronSchedule = dbData.scraperConfig.cronSchedule || '*/30 * * * *';
  
  if (activeCronJob) {
    activeCronJob.stop();
    console.log("Stopped existing cron job.");
  }

  try {
    activeCronJob = cron.schedule(cronSchedule, async () => {
      console.log(`[Cron Task] Triggering automated scrape. Schedule: ${cronSchedule}`);
      try {
        const dbData = getDb();
        if (!dbData) return;
        const log = await runScraper(dbData);
        console.log(`[Cron Task] Scrape completed. Status: ${log.status}, Added: ${log.articlesAdded}`);
        saveDb(dbData);
      } catch (err) {
        console.error("[Cron Task] Failed to run automated scraper:", err);
      }
    });
    console.log(`Scheduled automated web scraper with expression: "${cronSchedule}"`);
  } catch (err) {
    console.error(`Failed to schedule cron with expression "${cronSchedule}":`, err.message);
  }
}

// --- API ENDPOINTS ---

// Get all lessons, config, and logs
app.get('/api/lessons', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: "Could not retrieve study records." });
  }
  res.json(db);
});

// Toggle objective checklist item
app.post('/api/lessons/:dayId/objectives/:objId/toggle', (req, res) => {
  const dayId = parseInt(req.params.dayId, 10);
  const objId = req.params.objId;
  const { completed } = req.body;

  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: "Could not load database." });
  }

  const day = db.days.find(d => d.id === dayId);
  if (!day) {
    return res.status(404).json({ error: `Day ${dayId} not found.` });
  }

  const objective = day.objectives.find(o => o.id === objId);
  if (!objective) {
    return res.status(404).json({ error: `Objective ${objId} not found.` });
  }

  objective.completed = completed !== undefined ? completed : !objective.completed;

  // Recalculate day completion if all objectives are completed
  const allDone = day.objectives.every(o => o.completed);
  // Optional flag: we can check how the UI manages it, but let's persist the state
  
  if (saveDb(db)) {
    res.json({ success: true, dayId, objId, completed: objective.completed, allDone });
  } else {
    res.status(500).json({ error: "Failed to save checklist state." });
  }
});

// Reset all progress
app.post('/api/lessons/reset', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: "Could not load database." });
  }

  db.days.forEach(day => {
    day.objectives.forEach(obj => {
      obj.completed = false;
    });
    day.scrapedMaterials = [];
  });

  db.scrapeLogs = [
    {
      timestamp: new Date().toISOString(),
      status: "Reset",
      articlesFound: 0,
      articlesAdded: 0,
      message: "Study tracker progress and scraped materials reset by user."
    }
  ];

  if (saveDb(db)) {
    res.json({ success: true, message: "Progress reset successfully." });
  } else {
    res.status(500).json({ error: "Failed to reset database progress." });
  }
});

// Trigger scraper manually
app.post('/api/scrape', async (req, res) => {
  try {
    const dbData = getDb();
    if (!dbData) {
      return res.status(500).json({ error: "Database unavailable." });
    }
    const log = await runScraper(dbData);
    saveDb(dbData);
    res.json(log);
  } catch (err) {
    console.error("Manual scraper trigger failed:", err);
    res.status(500).json({ error: "Scraping failed: " + err.message });
  }
});

// Save Scraper Configuration
app.post('/api/scraper-config', (req, res) => {
  const { targetFeeds, keywords, cronSchedule } = req.body;

  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: "Database unavailable." });
  }

  if (targetFeeds) {
    for (const feed of targetFeeds) {
      if (!feed.url || (!feed.url.startsWith('http://') && !feed.url.startsWith('https://'))) {
        return res.status(400).json({ error: `Invalid URL format for "${feed.name}". Must start with http:// or https://.` });
      }
    }
    db.scraperConfig.targetFeeds = targetFeeds;
  }
  if (keywords) db.scraperConfig.keywords = keywords;
  
  let scheduleChanged = false;
  if (cronSchedule && cronSchedule !== db.scraperConfig.cronSchedule) {
    if (!cron.validate(cronSchedule)) {
      return res.status(400).json({ error: "Invalid cron expression format." });
    }
    db.scraperConfig.cronSchedule = cronSchedule;
    scheduleChanged = true;
  }

  if (saveDb(db)) {
    if (scheduleChanged) {
      scheduleScraperJob(); // Reschedule with new cron string
    }
    res.json({ success: true, config: db.scraperConfig });
  } else {
    res.status(500).json({ error: "Failed to save configurations." });
  }
});

// Start the Express Server
app.listen(PORT, () => {
  console.log(`Backend server active on http://localhost:${PORT}`);
  
  // Seed verification check
  const db = getDb();
  if (!db) {
    console.warn("WARNING: Database is empty. Please run 'node seed.js' first.");
  } else {
    console.log(`Loaded ${db.days.length} curriculum days successfully.`);
    scheduleScraperJob(); // Run scheduler
  }
});
