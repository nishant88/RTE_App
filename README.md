# Release Train Engineer (RTE) Study Planner & Web Scraper

An interactive, responsive full-stack learning platform to master the **SAFe Release Train Engineer (RTE)** role and prepare for certification.

## 🚀 Key Features

*   **30-Day Structured Curriculum**: A comprehensive curriculum based on the SAFe RTE certification syllabus (Serving the ART, Executing the PI, Applying Principles, Exploring the RTE Role).
*   **Automated RSS Scraper**: Runs as a background task using `node-cron` to fetch, clean, and map relevant articles from Scaled Agile, Scrum.org, and Agile Alliance.
*   **Progress Tracking**: Mark daily objectives completed to dynamically update overall study progress indicators.
*   **Indexed Library Search**: Fast, client-side global search covering all study days and scraped supplemental web articles.
*   **Concept Quizzes**: Challenge your knowledge daily with scenario-based practice questions.
*   **Premium Glassmorphic UI**: High-end dark mode layout built in React and Vanilla CSS, fully responsive for desktop, tablet, and mobile browsers.

## 🛠️ Tech Stack

*   **Frontend**: React (TypeScript), Vite 5, Lucide Icons, Glassmorphism CSS layout.
*   **Backend**: Node.js, Express, `node-cron` scheduler, `rss-parser`, `cheerio` HTML parser.
*   **Database**: Local JSON document store (`db.json`) for configuration, progress persistence, and scraper logs.

## 💻 Setup & Execution

### 1. Install Dependencies
Run the workspace installer script from the root project folder:
```bash
npm run install-deps
```

### 2. Start Servers Concurrently
Run the development servers for both the frontend (port 3000) and backend (port 3001) simultaneously:
```bash
npm run dev
```

### 3. Open Web Client
Open your browser and navigate to:
[http://localhost:3000/](http://localhost:3000/)
