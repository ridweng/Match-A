const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

function shouldAllowCleartextTraffic() {
  const normalized = String(process.env.MATCHA_ALLOW_CLEARTEXT_TRAFFIC ?? "")
    .trim()
    .toLowerCase();

  if (normalized) {
    return ["1", "true", "yes", "on"].includes(normalized);
  }

  return process.env.NODE_ENV !== "production";
}

function ensureUsesCleartextTraffic(androidManifest) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

  mainApplication.$ = mainApplication.$ || {};
  mainApplication.$["android:usesCleartextTraffic"] = "true";

  return androidManifest;
}

module.exports = function withAndroidCleartext(config) {
  if (!shouldAllowCleartextTraffic()) {
    return config;
  }

  return withAndroidManifest(config, (configWithManifest) => {
    configWithManifest.modResults = ensureUsesCleartextTraffic(configWithManifest.modResults);
    return configWithManifest;
  });
};
