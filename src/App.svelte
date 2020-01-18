<script context="module">
  import marked from "marked";

  export function parse(source) {
    if (!source) return;
    return marked(source);
  }
</script>

<script>
  import { markdown } from "./markdown.js";
  let count = 5000;
  let md;

  worker: text = parse(md);

  function start_timer() {
    const t = setInterval(() => {
      count -= 100;
      if (count <= 0) {
        count = 0;
        clearTimeout(t);
      }
    }, 100);
  }
</script>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  h1:hover {
    background: darkorange;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>

<h1>Hello friends</h1>

<button on:click={() => (md = markdown) && start_timer()}>
  Do expensive stuff
</button>

<h2>{count / 1000}</h2>
{#if !text}
  <h3>Parsing</h3>
{:else}
  <h3>Done parsing</h3>
{/if}

<main>
  <!-- {@html text} -->
</main>
