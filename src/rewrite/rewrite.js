import _ from 'lodash'
import * as allMatchers from './matchers'
import * as allReplacers from './replacers'

export function rule (match, rewrite, meta) {
  const rule = (graph) => {
    let nodes = graph.nodes()
    for (let i = 0; i < nodes.length; i++) {
      const m = match(graph, nodes[i])
      if (m !== false) {
        rewrite(graph, nodes[i], m)
        return true
      }
    }
    return false
  }
  rule.meta = meta
  return rule
}

export const match = allMatchers
export const replace = allReplacers

export function mapRules (functions) {
  return Object.keys(functions).map((r, i) => {
    const rule = functions[r]
    if (_.isArray(rule)) {
      return rule.map((fn) => ({
        id: (fn.meta ? fn.meta.id : null) || `${r}_${i}`,
        name: (fn.meta ? fn.meta.name : null) || `${r}_${i}`,
        apply: fn
      }))
    } else {
      const fn = rule
      return {
        id: (fn.meta ? fn.meta.id : null) || r,
        name: (fn.meta ? fn.meta.name : null) || r,
        apply: fn
      }
    }
  })
}
