const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors({
  origin: 'https://evenbeiter.github.io'
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Node.js API Proxy is running.');
});

app.all('/api/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  try {
    let fetchOptions = {
      method: req.method,
      headers: { ...req.headers }
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
