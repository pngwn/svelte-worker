<script context="module">
  import marked from "marked";

  export function parse(source) {
    if (!source) return;
    return marked(source);
  }
</script>

<script>
  // stuff here

  worker: text = parse(md);

  // more stuff
</script>

<!-- even more stuff -->
