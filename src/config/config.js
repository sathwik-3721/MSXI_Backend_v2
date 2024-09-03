const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000,
  MIRA_AI_URL: process.env.MIRA_AI_URL,
  MIRA_AI_MODEL: process.env.MIRA_AI_MODEL,
  MIRA_AI_ACCESS_KEY: process.env.MIRA_AI_ACCESS_KEY,
};
