import { parse } from "./somewhere.js";

addEventListener("message", ({ data }) => {
	postMessage(parse(data));
});
