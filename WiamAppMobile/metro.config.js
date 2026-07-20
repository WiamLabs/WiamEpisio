const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix "Failed to start watch mode" on Windows by using polling watcher
config.watcher = {
  watchman: {
    enabled: false,
  },
  healthCheck: {
    enabled: false,
  },
};

module.exports = config;
