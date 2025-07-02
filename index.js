const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const translateGoogle = require('google-translate-api-x');
const { Papago } = require('papago-translate');

const app = express();
const papagoClient = new Papago();

// ✅ 設定允許的前端來源
const allowedOrigin = 'https://evenbeiter.github.io';

// ✅ 設定 CORS middleware（包含自訂 headers）
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'x-linemedia-client',
    'x-linemedia-platform',
    'accept-language',
    'user-agent'
  ]
}));

// ✅ 支援 JSON 與 URL 編碼格式
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ---------- 路由 ---------- */

// 🔹 測試首頁
app.get('/', (req, res) => {
  res.send('Node.js Translation Proxy is running.');
});

// 🔹 通用 fetch proxy（支援 JSON、表單格式，並支援特定 header）
app.all('/api/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "Missing 'url' parameter" });

  try {
    const contentType = req.headers['content-type'] || '';
    const isJson = contentType.includes('application/json');

    // ✅ 白名單 header，避免轉送非法 header
    const allowList = [
      'content-type',
      'x-linemedia-platform',
      'x-linemedia-client',
      'accept-language',
      'user-agent'
    ];

    const headers = {};
    for (const h of allowList) {
      if (req.headers[h]) headers[h] = req.headers[h];
    }

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (req.method === 'POST') {
      fetchOptions.body = isJson
        ? JSON.stringify(req.body)
        : new URLSearchParams(req.body).toString();
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseType = response.headers.get('content-type') || 'text/plain';

    const data = responseType.includes('application/json')
      ? await response.json()
      : await response.text();

    res.setHeader('Content-Type', responseType);
    res.status(response.status).send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Iframe embed
app.get('/embed', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("No URL provided");

  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    res.set(Object.fromEntries(response.headers));
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send(`Error fetching URL: ${err}`);
  }
});

// 🔹 Google 翻譯 API route
app.post('/translate/google', async (req, res) => {
  const { text, to, from = 'auto' } = req.body;
  if (!text || !to) return res.status(400).json({ error: 'Missing text or target language' });

  try {
    const result = await translateGoogle(text, { from, to });
    res.json({
      translatedText: result.text,
      detectedSourceLang: result.from.language.iso
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Papago 翻譯 API route
app.post('/translate/papago', async (req, res) => {
  const { text, to, from = 'auto' } = req.body;
  if (!text || !to) return res.status(400).json({ error: 'Missing text or target language' });

  try {
    const result = await papagoClient.translate({ text, to, from });
    res.json({
      translatedText: result.result.translation,
      detectedSourceLang: result.result.srcLangType
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- 啟動伺服器 ---------- */

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
