import fetch from 'node-fetch';
import fs from 'fs';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import logUpdate from 'log-update';
import dotenv from 'dotenv';

dotenv.config(); // Load .env file

const BASE_URL = process.env.UMAMI_BASE_URL;
const USER = process.env.UMAMI_USER;
const PASS = process.env.UMAMI_PASS;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '10', 10);

async function login() {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USER, password: PASS }),
    });
    const data = await res.json();
    return data.token;
}

async function getWebsites(token) {
    let websites = [];
    let page = 1;
    const pageSize = 100;

    console.log('📥 Fetching website list from Umami...');

    while (true) {
        logUpdate(`🔄 Fetching page ${page}... (Total so far: ${websites.length})`);

        const res = await fetch(`${BASE_URL}/api/websites?page=${page}&pageSize=${pageSize}&orderBy=name`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();

        if (!json.data || json.data.length === 0) break;

        websites.push(...json.data);
        page++;

        if (json.data.length < pageSize) break;
    }

    logUpdate.clear();
    console.log(`🎉 Total websites fetched: ${websites.length}`);
    return websites;
}

async function getStats(token, websiteId) {
    const now = new Date();
    const end = now.getTime();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
    const timezone = encodeURIComponent('Europe/London');
    const unit = 'day';

    const url = `${BASE_URL}/api/websites/${websiteId}/stats?startAt=${start}&endAt=${end}&unit=${unit}&timezone=${timezone}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    const body = await res.text();

    if (!res.ok) {
        console.error(`❌ Failed to fetch stats for ${websiteId} — ${res.status}`);
        console.error('🧾 Raw response body:\n', body);
        return {
            visitors: 0,
            pageviews: 0,
            visits: 0,
            bounces: 0,
            totaltime: 0
        };
    }

    try {
        const data = JSON.parse(body);
        return {
            visitors: data.visitors?.value ?? 0,
            pageviews: data.pageviews?.value ?? 0,
            visits: data.visits?.value ?? 0,
            bounces: data.bounces?.value ?? 0,
            totaltime: data.totaltime?.value ?? 0,
        };
    } catch (e) {
        console.error('❌ JSON parse error:', e.message);
        return {
            visitors: 0,
            pageviews: 0,
            visits: 0,
            bounces: 0,
            totaltime: 0
        };
    }
}

async function run() {
    console.time('📈 Total execution time');

    const token = await login();
    const websites = await getWebsites(token);
    const out = fs.createWriteStream('umami_stats_last30days.csv');
    out.write('Domain,Visitors,Pageviews,Visits,Bounces,TotalTime\n');

    const limit = pLimit(CONCURRENCY);

    const bar = new cliProgress.SingleBar({
        format: 'Progress [{bar}] {percentage}% | {value}/{total} | Site: {site}',
        hideCursor: true,
        clearOnComplete: false,
    }, cliProgress.Presets.shades_classic);

    bar.start(websites.length, 0, { site: 'starting...' });

    let completed = 0;

    const tasks = websites.map(site =>
        limit(async () => {
            const stats = await getStats(token, site.id);
            out.write(`${site.domain},${stats.visitors},${stats.pageviews},${stats.visits},${stats.bounces},${stats.totaltime}\n`);
            completed++;
            bar.update(completed, { site: site.domain });
        })
    );

    await Promise.all(tasks);
    out.end(() => {
        bar.update(completed, { site: '' });
        bar.stop();
        console.timeEnd('📈 Total execution time');
    });
}

run();