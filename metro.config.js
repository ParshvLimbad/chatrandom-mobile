const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("bin")) {
  config.resolver.assetExts.push("bin");
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith("event-target-shim") &&
    context.originModulePath.includes("react-native-webrtc")
  ) {
    return {
      filePath: path.join(
        __dirname,
        "node_modules",
        "react-native-webrtc",
        "node_modules",
        "event-target-shim",
        "index.js",
      ),
      type: "sourceFile",
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
