import 
    defineConfig from "eslint/config";

import config  from "@riddick/eslint-config";

export default defineConfig([{
    extends: [config],
    ignores: [
        "src/rust_parser_generated/**",]
}]);