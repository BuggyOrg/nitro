# Nitro
Nitro is an optimizer for Buggy programs that uses graph rewriting.

## CLI
You need to install Nitro with `npm i -g @buggyorg/nitro` in order to use it. The following options are available:

```
-f, --graphfile <graph file>   Set graph file to parse. If none is given stdin is read
-o, --out <graph output file>  Set a custom output file. If none is given, stdout is used.
-i, --include-intermediate     Print an array of all intermediate graphs.
--stats                        Print stats to stderr after optimizing the graph.
-v, --verbose                  Prints verbose output to stderr during optimization.
--keep-dead-code               Disable removal of unreachable code.
-h, --help                     Output usage information.
-V, --version                  Output the version number.
```

Example usage: `nitro -f program.json --stats -v -o program_optimized.json`

## API
You can use Nitro (or maybe certain rewrite rules) easily using the its API.

```
import { optimize, applyRule, rewriteRules } from '@buggyorg/nitro'
```

* `optimize(graph, options = {})`  
  Optimize the given Buggy port graph (as graphlib graph). Returns an object `{ graph, stats }` with `graph` being the optimized graph and `stats` being statistics about the optimization.
  
  Supported options:
   * `rules`: Array of the rewrite rules to use, defaults to all rewrite rules.
  * `keepDeadCode`: Whether to disable the rewrite rules that remove dead code, only works if `rules` is not specified.
  * `onRuleApplied`: A function that is called whenever a rewrite rule was applied. The only argument it is called with is the used rewrite rule.

* `applyRule(graph, rule)`  
  Apply a single rewrite rule on the given graph. Returns `true` if the rule changed the graph and `false` if it didn't.

* `rules`  
  An object-map of the available rewrite rules. The keys are the IDs of the rules that may be used in the options above.