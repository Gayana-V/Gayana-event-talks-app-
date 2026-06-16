# ⚡ BigQuery Release Notes Hub & Broadcaster

A premium, modern, dark-themed Single Page Application (SPA) built using **Python Flask** and **Vanilla HTML, JS, and CSS**. This application fetches the official Google Cloud BigQuery release notes XML feed, dynamically parses them into granular items, and lets users compose and broadcast updates to X (Twitter) or to a simulated mock social timeline.

---

## 🚀 Key Features

*   **Granular Release Item Splitter**: Automatically parses multi-item date entries (using `BeautifulSoup`) into individual, selectable release notes (e.g. *Feature*, *Deprecated*, *Changed*, *General*).
*   **Performance Server Caching**: Fetches and caches the Google Cloud RSS XML feed on the server side for **10 minutes** to ensure fast load times and respect external API rate limits.
*   **Refresh/Sync Loader**: A manual refresh button with an interactive spinner lets users bypass the cache to pull the absolute latest updates dynamically.
*   **Dynamic Search & Filter System**: Real-time filtering by category (Features, Deprecations, Changes) and full-text keyword search.
*   **Interactive Tweet Composer Modal**:
    *   Pre-populates an optimized tweet draft with update details, documentation links, and hashtags.
    *   Interactive hashtag quick-helpers (`#BigQuery`, `#GoogleCloud`).
    *   **Circular Character Progress Circle**: Animates and changes color (amber at 20 chars left, red when over-limit) to indicate Twitter's 280-character constraint.
*   **Simulated Twitter Timeline**: An in-app sidebar feed that stores "posted" updates locally in the browser's `localStorage`. Includes like, retweet, and delete interactions to preview simulated broadcasts.
*   **Official X (Twitter) Sharing**: Uses the official Twitter web intent API to populate a real tweet draft in the user's browser.

---

## 🛠️ Technology Stack

*   **Backend**: Python 3.11+, Flask, Requests (HTTP Client), BeautifulSoup4 (HTML Parsing), XML ElementTree.
*   **Frontend**: Plain Vanilla HTML5, Vanilla CSS3 (Custom properties, grid systems, animations, glassmorphism), and Vanilla JavaScript (ES6 State management, event bubbling, DOM rendering).
*   **Design System**: Custom deep space theme (`#0a0e1a`) with glassmorphism borders, Outfit (headings) and Inter (body) typography.

---

## 📂 Project Structure

```
├── app.py                  # Flask server, API endpoints, feed fetching, BeautifulSoup parser
├── templates/
│   └── index.html          # Main HTML structure, modal composer, and layout anchors
├── static/
│   ├── css/
│   │   └── style.css       # Glassmorphic dark theme stylesheet, animations, and elements
│   └── js/
│       └── app.js          # Controller managing state, AJAX polling, X intents, localStorage
├── .gitignore              # Files ignored by Git (caches, environments, IDE files)
└── README.md               # Project documentation
```

---

## ⚡ Setup and Execution

### 1. Clone the repository
```bash
git clone https://github.com/Gayana-V/Gayana-event-talks-app-.git
cd Gayana-event-talks-app-
```

### 2. Install Dependencies
Make sure Python is installed, then run:
```bash
pip install flask requests beautifulsoup4
```

### 3. Run the Server
Launch the Flask development server:
```bash
python app.py
```

### 4. Open the Web Application
Open your browser and navigate to:
**[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔒 License
This project is open-source and available under the MIT License.
