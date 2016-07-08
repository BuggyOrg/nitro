# Nitro
Nitro is an optimizer for Buggy programs that uses graph rewriting.

## CLI
_Coming soon..._

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