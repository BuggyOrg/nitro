import { walk } from '@buggyorg/graphtools'
import _ from 'lodash'
import { childrenDeep } from '../../../util/graph'
import { createEdge, createInputPort, createOutputPort, tryGetInputPort } from '../../../util/rewrite'
import { copyNodeInto } from '../../../util/copy'

/**
 * Checks if the given node is a tail-recursive compound node.
 * @param graph a graphlib graph
 * @param node a node name
 * @return either false or a match
 */
export function matchTailRecursiveCompound (graph, n) {
  const compoundNode = graph.node(n)
  const recursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === compoundNode.id)
  if (recursiveCalls.length === 0) {
    return false
  }

  const predicates = [] // collected while walking up the `logic/mux` chain

  // in Buggy, a compound is tail-recursive if it ends with a chain of `logic/mux` nodes and recursive calls only
  // occur in this chain
  const walkMuxChain = (node, port) => {
    return walk.predecessor(graph, node, port).map((p) => {
      const predecessor = graph.node(p.node)
      if (predecessor.id === 'logic/mux') {
        predicates.push(walk.predecessor(graph, p.node, 'control')[0])
        return [walkMuxChain(p.node, 'input1'), walkMuxChain(p.node, 'input2')]
      } else if (predecessor.id === compoundNode.id) {
        return p.node
      }
    })
  }
  const tailcalls = _.without(_.flattenDeep(walkMuxChain(n, Object.keys(compoundNode.outputPorts || {})[0])), n)

  // TODO more validation, every mux may only be used once
  // every recursive call should be a tail call and not be used otherwise
  if (_.difference(recursiveCalls, tailcalls).length === 0 && recursiveCalls.every((c) => {
    const call = graph.node(c)
    return Object.keys(call.outputPorts).every((port) => walk.successor(graph, c, port).every((successor) => {
      return graph.node(successor.node).id === compoundNode || graph.node(successor.node).id === 'logic/mux'
    }))
  })) {
    return {
      node: n,
      predicates: _.uniqBy(predicates, 'node'),
      tailcalls: _.uniq(tailcalls)
    }
  } else {
    return false
  }
}

/**
 * Puts a the given node into a lambda function and returns that lambda function. The specified
 * port will be connected to the lambda function's output port.
 */
export function extractIntoLambda (graph, trNode, { node, port }) {
  const lambda = `${node}_${_.uniqueId('copy_')}`
  graph.setNode(lambda, { id: 'functional/lambda' }) // TODO
  graph.setParent(lambda, graph.parent(trNode))

  const lambdaImpl = `${lambda}:impl`
  graph.setNode(lambdaImpl, { id: lambdaImpl })
  graph.setParent(lambdaImpl, lambda)

  // now walk up `node` until `trNode` is reached and copy everything into the lambda function
  let nodeMappings = {}

  const copyNodeIntoLambda = (node) => {
    if (!nodeMappings[node] && node !== trNode) {
      nodeMappings[node] = copyNodeInto(graph, node, lambdaImpl)
      Object.keys(graph.node(node).inputPorts).forEach((port) => {
        walk.predecessor(graph, node, port).forEach((predecessor) => {
          const newPredecessor = copyNodeIntoLambda(predecessor.node)
          if (newPredecessor) {
            createEdge(graph, { node: newPredecessor, port: predecessor.port }, { node: nodeMappings[node], port })
          } else {
            // predecessor not copied, so it is a input port of the recursive function, so we make it an
            // input port of the new lamba function, if it doesn't exist, yet
            if (!tryGetInputPort(graph, lambdaImpl, predecessor.port)) {
              createInputPort(graph, lambdaImpl, predecessor.port, graph.node(node).inputPorts[port])
              createEdge(graph, { node: lambdaImpl, port: predecessor.port }, { node: nodeMappings[node], port })
            }
          }
        })
      })
    }
    return nodeMappings[node]
  }

  const newNode = copyNodeIntoLambda(node)
  if (newNode) {
    createOutputPort(graph, lambdaImpl, port, graph.node(node).outputPorts[port])
    createEdge(graph, { node: newNode, port }, { node: lambdaImpl, port })
  } else {
    // the edge went straight from input to the recursive call
    createInputPort(graph, lambdaImpl, port, graph.node(node).inputPorts[port])
    createOutputPort(graph, lambdaImpl, `${port}_out`, graph.node(node).inputPorts[port])
    createEdge(graph, { node: lambdaImpl, port }, { node: lambdaImpl, port: `${port}_out` })
  }

  return lambda
}

/**
 * Adds all input ports of the given reference node to the given node, if they don't exist yet.
 */
function ensureInputPorts (graph, node, referenceNode) {
  Object.keys(graph.node(referenceNode).inputPorts).forEach((port) => {
    if (!graph.node(node).inputPorts[port]) {
      createInputPort(graph, node, port, graph.node(referenceNode).inputPorts[port])
    }
  })
}

export function rewriteTailRecursionToLoop (graph, node, match) {
  const predicateLambdas = match.predicates.map((predicate) => {
    let lambda = extractIntoLambda(graph, node, predicate)
    const lambdaImpl = graph.children(lambda)[0]
    ensureInputPorts(graph, lambdaImpl, node)
    return lambda
  })

  const calculateParameters = _.flattenDeep(match.tailcalls.map((tailcall) => {
    return Object.keys(graph.node(tailcall).inputPorts).map((port) => {
      let lambda = extractIntoLambda(graph, node, walk.predecessor(graph, tailcall, port)[0])
      const lambdaImpl = graph.children(lambda)[0]
      ensureInputPorts(graph, lambdaImpl, node)
      return lambda
    })
  }))
}
