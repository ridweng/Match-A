const baseConfig = require("./app.json");

function parseBoolean(value, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(normalized);
}

function withoutPlugin(plugins, target) {
  return (plugins || []).filter((entry) => {
    if (typeof entry === "string") {
      return entry !== target;
    }

    return !(Array.isArray(entry) && entry[0] === target);
  });
}

module.exports = () => {
  const expo = baseConfig.expo || {};
  const isProduction = process.env.NODE_ENV === "production";
  const allowCleartext = parseBoolean(
    process.env.MATCHA_ALLOW_CLEARTEXT_TRAFFIC,
    !isProduction
  );
  const iosInfoPlist = { ...(expo.ios?.infoPlist || {}) };

  if (allowCleartext) {
    iosInfoPlist.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: true,
    };
  } else {
    delete iosInfoPlist.NSAppTransportSecurity;
  }

  const plugins = withoutPlugin(expo.plugins, "./plugins/withAndroidCleartext");
  if (allowCleartext) {
    plugins.splice(1, 0, "./plugins/withAndroidCleartext");
  }

  return {
    ...expo,
    ios: {
      ...expo.ios,
      infoPlist: iosInfoPlist,
    },
    android: {
      ...expo.android,
      usesCleartextTraffic: allowCleartext,
    },
    plugins,
  };
};
