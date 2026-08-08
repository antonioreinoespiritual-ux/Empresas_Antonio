const base = require("@repo/config/eslint-preset");

module.exports = {
  ...base,
  extends: [...(base.extends ?? []), "plugin:react/recommended", "plugin:react-hooks/recommended"],
  parserOptions: { ...base.parserOptions, ecmaFeatures: { jsx: true } },
  settings: { react: { version: "18.3" } },
  rules: {
    ...base.rules,
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
  },
};
