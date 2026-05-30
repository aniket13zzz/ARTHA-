const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.DB);
pool.on('error', (err) => console.error('[DB] Idle client error', err));

module.exports = pool;
