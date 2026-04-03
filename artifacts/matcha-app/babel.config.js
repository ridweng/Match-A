module.exports = function (api) {
  const nodeEnv = process.env.NODE_ENV || "development";
  api.cache.using(() => nodeEnv);
  const isProduction = nodeEnv === "production";

  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: isProduction
      ? [["transform-remove-console", { exclude: ["error", "warn"] }]]
      : [],
  };
};
