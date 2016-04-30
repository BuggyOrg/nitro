import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { unpackCompoundNode } from './util/rewrite'

export default function (graph) {
  // for now, a compound node is 'unneeded' if its input ports are unused
  let unneededCompoundNodes = graph.nodes().filter((n) => {
    const node = graph.node(n)
    return !node.atomic && _.flatten(Object.keys(node.inputPorts).map((p) => walk.predecessor(graph, n, p))).length === 0
  })

  // remove all unneeded compound nodes
  unneededCompoundNodes.forEach((n) => unpackCompoundNode(graph, n))
}
