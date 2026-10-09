import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
    js.configs.recommended,
    eslintConfigPrettier,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "commonjs",
            globals: globals.node,
        },
        rules: {
            eqeqeq: [2, "smart"],
            "no-caller": 2,
            "dot-notation": 2,
            "no-var": 2,
            "prefer-const": 2,
            "prefer-arrow-callback": [
                2,
                {
                    allowNamedFunctions: true,
                },
            ],
            "arrow-body-style": [2, "as-needed"],
            "object-shorthand": 2,
            "prefer-template": 2,
            "one-var": [2, "never"],
            "prefer-destructuring": [
                2,
                {
                    object: true,
                },
            ],
            "capitalized-comments": 2,
            "multiline-comment-style": [2, "starred-block"],
            "spaced-comment": 2,
            yoda: [2, "never"],
            curly: [2, "multi-line"],
            "no-else-return": 2,
        },
    },
];
