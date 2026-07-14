const { getDefaultConfig } = require("expo/metro-config");

// Tell React Native Element Inspector to open source files in VS Code
process.env.REACT_EDITOR = process.env.REACT_EDITOR || "code";

const config = getDefaultConfig(__dirname);

module.exports = config;
