# 📊 umami-get-stats

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-blue.svg)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/neylaur/umami-get-stats/pulls)
[![Made with ❤️](https://img.shields.io/badge/made%20with-%E2%9D%A4-red)](#)

A Node.js CLI tool to export **basic analytics stats** from your [Umami](https://umami.is/) instance into CSV. The script uses the `stats` endpoint to retrieve metrics such as visitors, pageviews, visits, bounce rate, and total time.

✅ It automatically extracts data for **all websites** linked to the authenticated account.

---

## 🚀 Features

- Authenticates to Umami via API
- Fetches **all websites** in your Umami account
- Extracts **only basic stats** using `/api/websites/:id/stats`
- Supports preset and custom date ranges
- Outputs metrics to a structured CSV file
- Shows a real-time CLI progress bar
- Simple `.env` configuration

---

## 📦 Prerequisites

- Node.js v18+ (ESM support required)
- A running instance of Umami (self-hosted or SaaS)
- An Umami user with access to analytics data

---

## 🛠️ Installation

```bash
git clone https://github.com/yourusername/umami-get-stats.git
cd umami-get-stats
npm install
cp .env.sample .env
````

Edit `.env` with your values:

```env
UMAMI_BASE_URL=https://your-umami-instance.com
UMAMI_USER=your-username
UMAMI_PASS=your-password
CONCURRENCY=10
```

---

## 🧪 Usage

### 🏁 Run the script:

```bash
npm start
```

### 📅 Date Range Options:

You will be prompted to choose:

```
📅 Choose a date range:
1) Last 24 hours
2) Last 7 days
3) Last 30 days
4) Last 365 days
5) Manual entry (UNIX timestamps)
```

Alternatively, set `START_AT` and `END_AT` in your `.env` file to skip the prompt:

```env
START_AT=1717200000000
END_AT=1724800000000
```

---

## 📤 Output

The script generates a CSV file like:

```
umami_stats_20240702_20250702.csv
```

Each row includes:

```
Domain,Visitors,Pageviews,Visits,Bounces,TotalTime
```

This data comes **exclusively from the `/api/websites/:id/stats`** route — no advanced metrics or events are included.

---

## 📁 Project Structure

```
.
├── umami-export.js     # Main CLI script
├── .env                # Your environment config (excluded from git)
├── .env.sample         # Sample .env file for setup
├── package.json
```

---

## 📘 License

[ISC](https://opensource.org/licenses/ISC) — free for personal or commercial use.

---

## 🙋‍♂️ Author

Created and maintained by [Laurentiu Nae](https://github.com/LorenzoNey).
Pull requests, feedback, and forks are welcome!
