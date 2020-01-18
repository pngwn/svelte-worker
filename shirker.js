import { basename, dirname, resolve } from "path";

import compiler from "svelte/compiler";
import { rollup } from "rollup";
import svelte from "rollup-plugin-svelte";
import commonjs from "rollup-plugin-commonjs";
import resolve_plugin from "rollup-plugin-node-resolve";

const RE_MODULE = /(?:(<script[\s\S]*context=['"]?module['"]?>[\s\S]*?)(<\/script>))?/;

function string_insert(source, text_to_insert, idx) {
	return source.slice(0, idx) + text_to_insert + source.slice(idx);
}

function string_delete(source, start, end) {
	return source.substring(0, start) + source.substring(end);
}

// this allows for multiple workerised functions per script

function generate_worker(function_names, filename) {
	return `
import { ${function_names} } from "${filename}";

const funcs = {
	${function_names}
};

addEventListener("message", ({ data }) => {
	if (data && data.func && data.data) {
		postMessage({ func: data.func, data: funcs[data.func](data.data) });
	}
});
`;
}

function generate_listener(actions) {
	return `
  worker.addEventListener('message', ({ data }) => {${actions}
  })
`;
}

function generate_listener_actions(meta) {
	return meta
		.map(
			({ func, assign }) => `
if (data.func === "${func}") {
${assign} = data.data;
}`
		)
		.join("\n");
}

function generate_reactive_postmessage(meta) {
	return meta
		.map(
			({ func, arg }) =>
				`  $: worker.postMessage({ func: "${func}", data: ${arg} });`
		)
		.join("\n");
}

export function shirker(output_dir) {
	return {
		async markup({ content, filename }) {
			let _content = content;
			const name = basename(filename, ".svelte");
			const dir = dirname(filename);
			const { instance } = compiler.parse(content);

			// find the worker labels
			//
			// this only supports call expression assignments and not arbitrary expressions
			// the only thing i think would be useful is logical expressions `x && func()` but it does pose some interesting questsions
			// it seems reaosnable to me that the right most expression should be a call expression and delegated to the worker with
			// everything on the left being the qualifier for posting the message to the worker
			// `worker: x = y && z && someFunc()` would compile to `$: y && z && postMessage()` or similar
			// i haven't implemented anything like this because I'm not even sure what the desirable behaviour would be.
			// multiple function calls within the expression should *probably* be treated the same (as qualifiers)

			const meta = instance.content.body
				.filter(
					({ type, label, body }) =>
						type &&
						type === "LabeledStatement" &&
						label.name === "worker" &&
						body.type === "ExpressionStatement"
				)
				.map(({ body, start, end }) => {
					const [arg] = body.expression.right.arguments;

					return {
						func: body.expression.right.callee.name,
						arg: arg.type === "Literal" ? arg.raw : arg.name,
						assign: body.expression.left.name,
						start,
						end
					};
				});

			if (!meta.length) return;

			// remove the worker labels from  the source

			for (let i = 0; i < meta.length; i += 1) {
				_content = string_delete(_content, meta[i].start, meta[i].end);
			}

			const function_names = Array.from(
				new Set(meta.map(({ func }) => func))
			).join(", ");

			// generate the new code

			const reactive_post_message = generate_reactive_postmessage(meta);
			const listener = generate_listener(generate_listener_actions(meta));
			const variables = `let ${meta.map(({ assign }) => assign).join(", ")};`;

			// smoosh it
			_content = string_insert(
				_content,
				variables + "\n" + listener + "\n" + reactive_post_message,
				instance.content.start
			);

			// the actual worker file will be bundled for now because of reasons.
			// a `type: module` could make this unnessecary and prevent duplication of code

			const worker_file = generate_worker(function_names, filename);

			function fromMemory(input, src) {
				return {
					resolveId(id) {
						if (id === input) {
							return id;
						}
					},
					load(id) {
						if (id === input) return src;
					}
				};
			}

			const bundle = await rollup({
				input: name,
				plugins: [
					fromMemory(name, worker_file),
					resolve_plugin(),
					commonjs(),
					svelte()
				]
			});

			const { output } = await bundle.generate({
				sourcemap: true,
				format: "esm",
				name: `worker-${name}`,
				dir: `${output_dir}`
			});

			// the worker is inlined and stuffed into the module script
			// we turn it into a Blob and create a new URL object from it
			const worker_script = `
	const src = ${JSON.stringify(output[0].code)};
  const worker = new Worker(URL.createObjectURL(new Blob([src])));
`;

			const match = _content.match(RE_MODULE);
			if (match[0]) {
				_content = _content.replace(
					RE_MODULE,
					(_, start, end) => `${start}\n  ${worker_script}\n${end}`
				);
			}

			return {
				code: _content
			};
		}
	};
}
