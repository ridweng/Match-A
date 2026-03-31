const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

function ensureUsesCleartextTraffic(androidManifest) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

  mainApplication.$ = mainApplication.$ || {};
  mainApplication.$["android:usesCleartextTraffic"] = "true";

  return androidManifest;
}

module.exports = function withAndroidCleartext(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    configWithManifest.modResults = ensureUsesCleartextTraffic(configWithManifest.modResults);
    return configWithManifest;
  });
};
