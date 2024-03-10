const express = require('express');
const cors = require('cors');
const responseTime = require('response-time');
const prometheus = require('prom-client');
require('dotenv').config();
const collectDefaultMetrics = prometheus.collectDefaultMetrics;
const conn = require('./conn');

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(cors());

const tripRoutes = require('./routes/trip.routes');
app.use('/trip', tripRoutes);

app.get('/hello', (req, res) => {
    res.send('Hello World!');
});

// Custom Metric: Request Count
const requestCounter = new prometheus.Counter({
    name: 'http_express_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

app.use((req, res, next) => {
    requestCounter.labels(req.method, req.url, res.statusCode).inc();
    next();
});

// Custom Metric: Error Rate
const errorRate = new prometheus.Gauge({
    name: 'http_express_error_rate',
    help: 'Current error rate of HTTP requests',
});

app.use((req, res, next) => {
    if (res.statusCode >= 400) {
        errorRate.set(1); // Indicates an error
    } else {
        errorRate.set(0); // Indicates no error
    }
    next();
});

// Existing Metric: Request-Response Time
const reqResTime = new prometheus.Histogram({
    name: 'http_express_req_res_time',
    help: 'This tells how much time is taken by req and res',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [1, 50, 100, 200, 400, 500, 800, 1000, 20001],
});

app.use(responseTime((req, res, time) => {
    reqResTime.labels({
        method: req.method,
        route: req.url,
        status_code: res.statusCode,
    }).observe(time);
}));

// Expose Metrics Endpoint
app.get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', prometheus.register.contentType);
    
    // Get and send all metrics including custom metrics
    const metrics = await prometheus.register.metrics();
    res.send(metrics);
});

app.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
});
