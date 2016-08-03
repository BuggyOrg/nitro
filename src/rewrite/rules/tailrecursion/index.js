import { walk } from '@buggyorg/graphtools'
import { getLambdaFunctionType } from '@buggyorg/functional'
import _ from 'lodash'
import { childrenDeep } from '../../../util/graph'
import { createEdge, createInputPort, createOutputPort, tryGetInputPort, moveNodeInto, unpackCompoundNode,
         createEdgeToEachSuccessor, createEdgeFromEachPredecessor, deepRemoveNode, renamePort } from '../../../util/rewrite'
import { copyNodeInto } from '../../../util/copy'
import * as nodeCreator from '../../nodes'

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
        const predicate = {
          control: walk.predecessor(graph, p.node, 'control')[0],
          input1: { predecessor: walk.predecessor(graph, p.node, 'input1')[0] },
          input2: { predecessor: walk.predecessor(graph, p.node, 'input2')[0] }
        }
        predicate.input1.type = graph.node(predicate.input1.predecessor.node).id
        predicate.input1.isTailcall = predicate.input1.type === compoundNode.id && predicate.input1.predecessor.port === Object.keys(compoundNode.outputPorts)[0]
        predicate.input2.type = graph.node(predicate.input2.predecessor.node).id
        predicate.input2.isTailcall = predicate.input2.type === compoundNode.id && predicate.input2.predecessor.port === Object.keys(compoundNode.outputPorts)[0]

        predicates.push(predicate)

        return [walkMuxChain(p.node, 'input1'), walkMuxChain(p.node, 'input2')]
      } else if (predecessor.id === compoundNode.id) {
        return p.node
      }
    })
  }
  const tailcalls = _.without(_.flattenDeep(walkMuxChain(n, Object.keys(compoundNode.outputPorts || {})[0])), n).filter((c) => c != null)

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
  graph.setNode(lambda, nodeCreator.lambda())
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
            }
            createEdge(graph, { node: lambdaImpl, port: predecessor.port }, { node: nodeMappings[node], port })
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
 * Also ensures that the argumentOrdering of the input ports is the same as in the reference node.
 */
function ensureInputPorts (graph, node, referenceNodeId) {
  const nodeValue = graph.node(node)
  const referenceNode = graph.node(referenceNodeId)

  Object.keys(referenceNode.inputPorts).forEach((port) => {
    if (!(nodeValue.inputPorts || {})[port]) {
      createInputPort(graph, node, port, referenceNode.inputPorts[port])
    }
  })

  if (referenceNode.settings && referenceNode.settings.argumentOrdering) {
    nodeValue.settings = nodeValue.settings || {}
    nodeValue.settings.argumentOrdering = _.concat(
      _.difference(nodeValue.settings.argumentOrdering, Object.keys(referenceNode.inputPorts)),
      _.intersection(referenceNode.settings.argumentOrdering, Object.keys(referenceNode.inputPorts))
    )
  }
}

/**
 * Adds all output ports of the given reference node to the given node, if they don't exist yet.
 * Also ensures that the argumentOrdering of the output ports is the same as in the reference node.
 */
function ensureOutputPorts (graph, node, referenceNodeId) {
  const nodeValue = graph.node(node)
  const referenceNode = graph.node(referenceNodeId)

  Object.keys(referenceNode.outputPorts).forEach((port) => {
    if (!(nodeValue.outputPorts || {})[port]) {
      createOutputPort(graph, node, port, referenceNode.outputPorts[port])
    }
  })

  if (referenceNode.settings && referenceNode.settings.argumentOrdering) {
    nodeValue.settings = nodeValue.settings || {}
    nodeValue.settings.argumentOrdering = _.concat(
      _.difference(nodeValue.settings.argumentOrdering, Object.keys(referenceNode.outputPorts)),
      _.intersection(referenceNode.settings.argumentOrdering, Object.keys(referenceNode.outputPorts))
    )
  }
}

/**
 * Merges the given lambda functions.
 */
function mergeLambdas (graph, lambdaFunctions) {
  const firstLambda = _.head(lambdaFunctions)
  const firstLambdaImpl = graph.children(firstLambda)[0]

  _.tail(lambdaFunctions).forEach((lambda) => {
    const lambdaImpl = graph.children(lambda)[0]
    moveNodeInto(graph, lambdaImpl, firstLambdaImpl)

    Object.keys(graph.node(lambdaImpl).inputPorts).forEach((port) => {
      createEdge(graph, { node: firstLambdaImpl, port }, { node: lambdaImpl, port })
    })
    ensureOutputPorts(graph, firstLambdaImpl, lambdaImpl)
    Object.keys(graph.node(lambdaImpl).outputPorts).forEach((port) => {
      createEdge(graph, { node: lambdaImpl, port }, { node: firstLambdaImpl, port })
    })
    unpackCompoundNode(graph, lambdaImpl)
    graph.removeNode(lambda)
  })

  return firstLambda
}

function propagatePortType (graph, { node, port }) {
  const type = graph.node(node).outputPorts[port]
  if (type) {
    walk.successor(graph, node, port).forEach((successor) => {
      graph.node(successor.node).inputPorts[successor.port] = type
    })
  }
}

/**
 * Ensures that the order of <x>_new output ports matches the order of
 * <x> input ports of the specified node.
 */
function fixNewOutputPortsOrdering (graph, n) {
  const node = graph.node(n)
  const inputPorts = _.intersection(node.settings.argumentOrdering, Object.keys(node.inputPorts))
  const expectedOutputPorts = inputPorts.map((p) => `${p}_new`)
  node.settings.argumentOrdering = _.concat(inputPorts, expectedOutputPorts)
}

export function rewriteTailRecursionToLoop (graph, node, match) {
  const predicateLambdas = match.predicates.map((predicate) => {
    const controlLambda = extractIntoLambda(graph, node, predicate.control)
    ensureInputPorts(graph, graph.children(controlLambda)[0], node)

    let input1Lambda
    let input1LambdaRelevantPort
    if (predicate.input1.type !== 'logic/mux' && !predicate.input1.isTailcall) {
      input1Lambda = extractIntoLambda(graph, node, predicate.input1.predecessor)
      const input1LambdaImpl = graph.children(input1Lambda)[0]
      ensureInputPorts(graph, input1LambdaImpl, node)

      renamePort(graph, input1LambdaImpl, Object.keys(graph.node(input1LambdaImpl).outputPorts)[0], `${predicate.input1.predecessor.port}_new`)
      input1LambdaRelevantPort = predicate.input1.predecessor.port

      _.forOwn(graph.node(input1LambdaImpl).inputPorts, (type, port) => {
        if (!graph.node(input1LambdaImpl).outputPorts[`${port}_new`]) {
          createOutputPort(graph, input1LambdaImpl, `${port}_new`, type)
          createEdge(graph, { node: input1LambdaImpl, port: port }, { node: input1LambdaImpl, port: `${port}_new` })
        }
      })

      fixNewOutputPortsOrdering(graph, input1LambdaImpl)
    }

    let input2Lambda
    let input2LambdaRelevantPort
    if (predicate.input2.type !== 'logic/mux' && !predicate.input2.isTailcall) {
      input2Lambda = extractIntoLambda(graph, node, predicate.input2.predecessor)
      const input2LambdaImpl = graph.children(input2Lambda)[0]
      ensureInputPorts(graph, input2LambdaImpl, node)

      renamePort(graph, input2LambdaImpl, Object.keys(graph.node(input2LambdaImpl).outputPorts)[0], `${predicate.input2.predecessor.port}_new`)
      input2LambdaRelevantPort = predicate.input2.predecessor.port

      _.forOwn(graph.node(input2LambdaImpl).inputPorts, (type, port) => {
        if (!graph.node(input2LambdaImpl).outputPorts[`${port}_new`]) {
          createOutputPort(graph, input2LambdaImpl, `${port}_new`, type)
          createEdge(graph, { node: input2LambdaImpl, port: port }, { node: input2LambdaImpl, port: `${port}_new` })
        }
      })

      fixNewOutputPortsOrdering(graph, input2LambdaImpl)
    }

    return {
      predicate,
      lambda: {
        control: controlLambda,
        input1: input1Lambda,
        input1RelevantPort: input1LambdaRelevantPort,
        input2: input2Lambda,
        input2RelevantPort: input2LambdaRelevantPort
      }
    }
  })

  let calculateParameters = _.flattenDeep(match.tailcalls.map((tailcall) => {
    return Object.keys(graph.node(tailcall).inputPorts).map((port) => {
      let lambda = extractIntoLambda(graph, node, walk.predecessor(graph, tailcall, port)[0])
      const lambdaImpl = graph.children(lambda)[0]
      renamePort(graph, lambdaImpl, Object.keys(graph.node(lambdaImpl).outputPorts)[0], `${port}_new`)
      ensureInputPorts(graph, lambdaImpl, node)
      return { tailcall, lambda, port }
    })
  }))

  calculateParameters = _.mapValues(_.groupBy(calculateParameters, 'tailcall'), (parameterLambdas) =>
    mergeLambdas(graph, parameterLambdas.map((p) => p.lambda)) // merge parameter lambdas that belong to the same tail call
  )
  // calculateParameters now maps the tail call nodes to lambda functions that calculate the parameters for them

  _.each(calculateParameters, (lambda) => fixNewOutputPortsOrdering(graph, graph.children(lambda)[0]))

  const tailrecNode = `${node}_tailrec`
  graph.setNode(tailrecNode, {
    id: 'tailrec',
    atomic: true,
    outputPorts: _.clone(graph.node(node).outputPorts),
    tailrecConfig: {
      tailcalls: [],
      inputPorts: Object.keys(graph.node(node).inputPorts),
      predicateCount: match.predicates.length
    }
  })
  graph.setParent(tailrecNode, graph.parent(node))

  // create `2 * n + 1 + p` input ports (n predicates, n if/elseif-cases, one final else-case and p initial values for the parameters)
  _.range(match.predicates.length).forEach((i) => {
    createInputPort(graph, tailrecNode, `p_${i}`, 'function')
    createInputPort(graph, tailrecNode, `f_${i}`, 'function')
  })
  createInputPort(graph, tailrecNode, `f_${match.predicates.length}`, 'function')
  Object.keys(graph.node(node).inputPorts).forEach((port) => {
    createInputPort(graph, tailrecNode, `initial_${port}`, graph.node(node).inputPorts[port])
  })

  // connect initial input
  Object.keys(graph.node(node).inputPorts).forEach((port) => {
    createEdgeFromEachPredecessor(graph, { node, port }, { node: tailrecNode, port: `initial_${port}` })
  })
  // connect output
  createEdgeToEachSuccessor(graph, tailrecNode, node)

  // connect the predicates and parameter generators (and set types correctly)
  predicateLambdas.forEach((predicate, i) => {
    createEdge(graph, predicate.lambda.control, { node: tailrecNode, port: `p_${i}` })
    graph.node(tailrecNode).inputPorts[`p_${i}`] = graph.node(predicate.lambda.control).outputPorts.fn

    if (predicate.lambda.input1) {
      createEdge(graph, predicate.lambda.input1, { node: tailrecNode, port: `f_${i}` })
      graph.node(tailrecNode).tailrecConfig.returnPort = predicate.lambda.input1RelevantPort
      graph.node(tailrecNode).inputPorts[`f_${i}`] = graph.node(predicate.lambda.input1).outputPorts.fn
    } else if (predicate.lambda.input2) {
      createEdge(graph, predicate.lambda.input2, { node: tailrecNode, port: `f_${i + 1}` })
      graph.node(tailrecNode).tailrecConfig.returnPort = predicate.lambda.input2RelevantPort
      graph.node(tailrecNode).inputPorts[`f_${i + 1}`] = graph.node(predicate.lambda.input2).outputPorts.fn
    }

    if (predicate.predicate.input1.isTailcall) {
      createEdge(graph, calculateParameters[predicate.predicate.input1.predecessor.node], { node: tailrecNode, port: `f_${i}` })
      graph.node(tailrecNode).tailrecConfig.tailcalls.push(`f_${i}`)
      graph.node(tailrecNode).inputPorts[`f_${i}`] = graph.node(calculateParameters[predicate.predicate.input1.predecessor.node]).outputPorts.fn
    } else if (predicate.predicate.input2.isTailcall) {
      createEdge(graph, calculateParameters[predicate.predicate.input2.predecessor.node], { node: tailrecNode, port: `f_${i + 1}` })
      graph.node(tailrecNode).tailrecConfig.tailcalls.push(`f_${i + 1}`)
      graph.node(tailrecNode).inputPorts[`f_${i + 1}`] = graph.node(calculateParameters[predicate.predicate.input2.predecessor.node]).outputPorts.fn
    }
  })

  // set correct function types for all generated lambda functions
  predicateLambdas.forEach((predicate) => {
    graph.node(predicate.lambda.control).outputPorts.fn = getLambdaFunctionType(graph, predicate.lambda.control)
    propagatePortType(graph, { node: predicate.lambda.control, port: 'fn' })

    if (predicate.lambda.input1) {
      graph.node(predicate.lambda.input1).outputPorts.fn = getLambdaFunctionType(graph, predicate.lambda.input1)
      propagatePortType(graph, { node: predicate.lambda.input1, port: 'fn' })
    }
    if (predicate.lambda.input2) {
      graph.node(predicate.lambda.input2).outputPorts.fn = getLambdaFunctionType(graph, predicate.lambda.input2)
      propagatePortType(graph, { node: predicate.lambda.input2, port: 'fn' })
    }
  })
  _.each(calculateParameters, (lambda) => {
    graph.node(lambda).outputPorts.fn = getLambdaFunctionType(graph, lambda)
    propagatePortType(graph, { node: lambda, port: 'fn' })
  })

  deepRemoveNode(graph, node)
}
