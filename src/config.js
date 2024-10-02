// src/config.js

const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from .env file if it exists
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const config = {
  // Main domains
  ZLIB_DOMAIN: process.env.ZLIB_DOMAIN || "https://z-library.do",
  LOGIN_DOMAIN: process.env.LOGIN_DOMAIN || "https://z-library.do/rpc.php",

  // Tor (onion) domains
  ZLIB_TOR_DOMAIN:
    process.env.ZLIB_TOR_DOMAIN ||
    "http://bookszlibb74ugqojhzhg2a63w5i2atv5bqarulgczawnbmsb6s6qead.onion",
  LOGIN_TOR_DOMAIN:
    process.env.LOGIN_TOR_DOMAIN ||
    "http://loginzlib2vrak5zzpcocc3ouizykn6k5qecgj2tzlnab5wcbqhembyd.onion/rpc.php",

  // Add any other configurations here
};

module.exports = config;
