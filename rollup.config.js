import svelte from "rollup-plugin-svelte";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import { terser } from "rollup-plugin-terser";

import { shirker } from "./shirker";

const production = !process.env.ROLLUP_WATCH;

const OUT_DIR = "public/build/bundle";

export default {
	input: ["src/main.js"],
	output: {
		sourcemap: true,
		format: "esm",
		name: "app",
		dir: OUT_DIR
	},
	plugins: [
		svelte({
			css: css => {
				css.write("public/build/bundle.css");
			},
			preprocess: shirker(OUT_DIR)
		}),
		resolve({
			browser: true,
			dedupe: importee =>
				importee === "svelte" || importee.startsWith("svelte/")
		}),
		commonjs(),
		!production && serve()
		// production && terser()
	],
	watch: {
		clearScreen: false
	}
};

function serve() {
	let started = false;

	return {
		writeBundle() {
			if (!started) {
				started = true;

				require("child_process").spawn("npm", ["run", "start", "--", "--dev"], {
					stdio: ["ignore", "inherit", "inherit"],
					shell: true
				});
			}
		}
	};
}
