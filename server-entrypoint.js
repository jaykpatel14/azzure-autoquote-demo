const path = require("path");

// Next's standalone server reads HOSTNAME at startup. Docker and EC2 can inject
// their own hostname values, so force a safe bind host explicitly.
process.env.HOSTNAME = process.env.APP_HOST || "0.0.0.0";

require(path.join(__dirname, "server.js"));
