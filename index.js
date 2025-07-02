const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const translateGoogle = require('google-translate-api-x');
const { Papago } = require('papago-translate');

const app = express();
const papagoClient = new Papago();

// 設定 CORS：允許 GitHub Pages 網址跨來源請求
const allowedOrigin = 'https://evenbeiter.github.io';
app.use(cors({ origin: allowedOrigin }));

// 額外處理所有 OPTIONS 預請求，避免 CORS policy 阻擋
app.options('*', cors({ origin: allowedOrigin }));

// 接收 JSON 及 URL 編碼請求內容
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Home route
app.get('/', (req, res) => {
  res.send('Node.js Translation Proxy is running.');
});

// 通用 fetch proxy route
app.all('/api/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "Missing 'url' parameter" });

  try {
    const headers = { ...req.headers };
    delete headers['host']; // 避免 SSL 錯誤

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (req.method === 'POST') {
      fetchOptions.body = new URLSearchParams(req.body).toString();
      fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || 'text/plain';

    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (contentType.includes('application/json')) {
      res.json(data);
    } else {
      res.set('Content-Type', contentType).status(response.status).send(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 網頁嵌入 route（如 iframe）
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

// Google 翻譯 API route
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

// Papago 翻譯 API route
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

// 啟動伺服器
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
