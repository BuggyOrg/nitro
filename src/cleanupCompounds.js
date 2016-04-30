import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'

export default function (graph) {
  // for now, a compound node is 'unneeded' if its input ports are unused
  graph.nodes().filter((n) => {
    const node = graph.node(n)
    return !node.atomic && _.flatten(Object.keys(node.inputPorts).map((p) => walk.predecessor(graph, n, p))).length === 0
  }).forEach((n) => {
    const node = graph.node(n)
    let children = graph.children(n)

    // move the compound's children one level up (so that the compound can be safely removed)
    children.forEach((c) => {
      graph.setParent(c, node.parent)
    })

    // create new output edges for all edges that previously used the compound node's output ports
    _.flatten(children.map((c) => graph.outEdges(c, n))).forEach((e) => {
      const edge = graph.edge(e)
      walk.successorInPort(graph, n, edge.inPort).forEach((successor) => {
        graph.setEdge(e.v, successor.node, {
          outPort: edge.outPort,
          inPort: successor.port
        }, e.name + '-rewritten')
      })
    })

    graph.removeNode(n)
  })
}
