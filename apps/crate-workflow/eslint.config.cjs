const {
    defineConfig,
} = require("eslint/config");

const config = require("@riddick/eslint-config");

module.exports = defineConfig([{
    extends: [config],
}]);