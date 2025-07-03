//umami-export.js
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
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

async function getStats(token, websiteId, startAt, endAt) {

    const timezone = encodeURIComponent('Europe/London');
    const unit = 'day';

    const url = `${BASE_URL}/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}&unit=${unit}&timezone=${timezone}`;

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

async function resolveDateRange() {
    const startEnv = process.env.START_AT;
    const endEnv = process.env.END_AT;

    if (startEnv && endEnv) {
        return {
            startAt: parseInt(startEnv, 10),
            endAt: parseInt(endEnv, 10),
        };
    }

    const rl = readline.createInterface({ input, output });

    console.log('\n📅 Choose a date range:');
    console.log('1) Last 24 hours');
    console.log('2) Last 7 days');
    console.log('3) Last 30 days');
    console.log('4) Last 365 days');
    console.log('5) Manual entry (UNIX timestamps)\n');

    const choice = await rl.question('Your choice [1-5]: ');

    const now = Date.now();

    let startAt, endAt = now;

    switch (choice.trim()) {
        case '1':
            startAt = now - 1 * 24 * 60 * 60 * 1000;
            break;
        case '2':
            startAt = now - 7 * 24 * 60 * 60 * 1000;
            break;
        case '3':
            startAt = now - 30 * 24 * 60 * 60 * 1000;
            break;
        case '4':
            startAt = now - 365 * 24 * 60 * 60 * 1000;
            break;
        case '5':
            const customStart = await rl.question('Enter startAt (UNIX timestamp in ms): ');
            const customEnd = await rl.question('Enter endAt (UNIX timestamp in ms): ');
            startAt = parseInt(customStart.trim(), 10);
            endAt = parseInt(customEnd.trim(), 10);
            break;
        default:
            console.log('⚠️ Invalid choice. Defaulting to last 30 days.');
            startAt = now - 30 * 24 * 60 * 60 * 1000;
    }

    await rl.close();
    return { startAt, endAt };
}

function formatDate(ms) {
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

async function run() {
    console.time('📈 Total execution time');

    const { startAt, endAt } = await resolveDateRange();

    const startStr = formatDate(startAt);
    const endStr = formatDate(endAt);
    const filename = `umami_stats_${startStr}_${endStr}.csv`;

    const token = await login();
    const websites = await getWebsites(token);
    const out = fs.createWriteStream(filename);
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
            const stats = await getStats(token, site.id, startAt, endAt);
            out.write(`${site.domain},${stats.visitors},${stats.pageviews},${stats.visits},${stats.bounces},${stats.totaltime}\n`);
            completed++;
            bar.update(completed, { site: site.domain });
        })
    );

    await Promise.all(tasks);
    out.end(() => {
        bar.update(completed, { site: '' });
        bar.stop();
        console.log(`📄 CSV written to: ${filename}`);
        console.timeEnd('📈 Total execution time');
    });
}

run();