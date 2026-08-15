const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

if (process.env.EXPO_PUBLIC_BROWSER || process.argv.includes("--web")) {
  config.resolver.blockList = [
    /[\\/]node_modules[\\/]@stripe[\\/]stripe-react-native[\\/].*/,
  ];
}

module.exports = withNativeWind(config, {
  input: "./global.css",
});
