const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: [
      "android/**/*",
      "dist/**/*",
      "ios/**/*",
      "supabase/functions/**/*",
      "worker/**/*",
    ],
  },
];
