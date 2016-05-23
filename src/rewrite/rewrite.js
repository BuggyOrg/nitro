import * as allMatchers from './matchers'
import * as allReplacers from './replacers'

export function rule (match, rewrite, meta) {
  const rule = (graph) => {
    let nodes = graph.nodes()
    for (let i = 0; i < nodes.length; i++) {
      let m = match(graph, nodes[i])
      if (m !== false) {
        rewrite(graph, nodes[i], m)
        break
      }
    }
  }
  rule.meta = meta
  return rule
}

export const match = allMatchers
export const replace = allReplacers
