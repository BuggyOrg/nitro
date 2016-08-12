import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { getLambdaFunctionType } from '@buggyorg/functional'
import { rule, match } from '../rewrite'
import { createEdgeToEachSuccessor, deleteUnusedPredecessors, setNodeAt, setNodeIn, removeEdge, createEdge, deepRemoveNode } from '../../util/rewrite'
import { copyNode } from '../../util/copy'
import * as nodeCreators from '../nodes'
import createSubgraph from '../../util/subgraphCreator'
import { minSearch, maxSearch } from './minSearch'

export const replaceHeadAfterMap = rule(
  match.byIdAndInputs('array/first', {
    array: match.byIdAndInputs('map', {
      list: match.any({ requireNode: false }),
      fn: match.any({ requireNode: false })
    })
  }),
  (graph, node, match) => {
    const subgraph = createSubgraph(graph, graph.parent(node), {
      node: nodeCreators.call(),
      predecessors: {
        fn: {
          node: nodeCreators.partial(),
          predecessors: {
            value: {
              node: nodeCreators.arrayFirst(),
              predecessors: {
                array: walk.predecessor(graph, match.inputs.array.node, 'list')[0]
              }
            },
            fn: walk.predecessor(graph, match.inputs.array.node, 'fn')[0]
          }
        }
      }
    })

    createEdgeToEachSuccessor(graph, subgraph.node, match.node)

    deleteUnusedPredecessors(graph, match.node)
    graph.removeNode(match.node)
  }
)

export const concatenateFilters = rule(
  match.once(match.byIdAndInputs('filter', {
    list: match.byIdAndInputs('filter', {
      list: match.any(),
      fn: match.any()
    }),
    fn: match.any()
  })),
  (graph, node, match) => {
    const lambda = setNodeAt(graph, `${match.node}_lambda_and`, match.node, nodeCreators.lambda())
    const lambdaImpl = setNodeIn(graph, `${lambda}:impl`, lambda, {
      id: `${lambda}:impl`,
      inputPorts: {
        f1: graph.node(match.inputs.list.inputs.fn.node).outputPorts[0] || 'function',
        f2: graph.node(match.inputs.fn.node).outputPorts[0] || 'function',
        element: _.values(_.values(graph.node(match.inputs.fn.node).outputPorts)[0].arguments)[0] || 'generic'
      },
      outputPorts: {
        // result: _.values(_.values(graph.node(match.inputs.fn.node).outputPorts)[0].outputs)[0]
        result: 'bool'
      },
      settings: {
        argumentOrdering: ['f1', 'f2', 'element', 'result']
      }
    })
    graph.node(lambda).outputPorts['fn'] = getLambdaFunctionType(graph, lambda)

    createSubgraph(graph, lambdaImpl, {
      node: nodeCreators.logicMux(),
      predecessors: {
        control: {
          node: nodeCreators.call(),
          predecessors: {
            fn: {
              node: nodeCreators.partial(0),
              predecessors: {
                fn: { node: lambdaImpl, port: 'f1' },
                value: { node: lambdaImpl, port: 'element' }
              }
            }
          }
        },
        input1: {
          node: nodeCreators.call(),
          predecessors: {
            fn: {
              node: nodeCreators.partial(0),
              predecessors: {
                fn: { node: lambdaImpl, port: 'f2' },
                value: { node: lambdaImpl, port: 'element' }
              }
            }
          }
        },
        input2: {
          node: nodeCreators.constantBool(false)
        }
      },
      successors: {
        output: { node: lambdaImpl, port: 'result' }
      }
    })

    createSubgraph(graph, graph.parent(node), {
      node: nodeCreators.partial(0),
      predecessors: {
        fn: {
          node: nodeCreators.partial(0),
          predecessors: {
            fn: lambda,
            value: {
              node: match.inputs.list.inputs.fn.node,
              port: match.inputs.list.inputs.fn.inPort
            }
          }
        },
        value: {
          node: match.inputs.fn.node,
          port: match.inputs.fn.inPort
        }
      },
      successors: {
        result: {
          node: match.node,
          port: 'fn'
        }
      }
    })

    removeEdge(graph,
      { node: match.inputs.fn.node, port: match.inputs.fn.inPort },
      { node: node, port: match.inputs.fn.port }
    )
    removeEdge(graph,
      { node: match.inputs.list.node, port: match.inputs.list.inPort },
      { node: node, port: match.inputs.list.port }
    )
    createEdge(graph,
      { node: match.inputs.list.inputs.list.node, port: match.inputs.list.inputs.list.inPort },
      { node: node, port: 'list' }
    )
  }
)

export const concatenateMaps = rule(
  match.once(match.byIdAndInputs('map', {
    list: match.byIdAndInputs('map', {
      list: match.any(),
      fn: match.any()
    }),
    fn: match.any()
  })),
  (graph, node, match) => {
    const lambda = setNodeAt(graph, `${match.node}_lambda_concat`, match.node, nodeCreators.lambda())
    const lambdaImpl = setNodeIn(graph, `${lambda}:impl`, lambda, {
      id: `${lambda}:impl`,
      inputPorts: {
        f1: graph.node(match.inputs.list.inputs.fn.node).outputPorts[0] || 'function',
        f2: graph.node(match.inputs.fn.node).outputPorts[0] || 'function',
        element: _.values(_.values(graph.node(match.inputs.fn.node).outputPorts)[0].arguments)[0] || 'generic'
      },
      outputPorts: {
        result: _.values(_.values(graph.node(match.inputs.fn.node).outputPorts)[0].outputs)[0]
      },
      settings: {
        argumentOrdering: ['f1', 'f2', 'element', 'result']
      }
    })
    graph.node(lambda).outputPorts['fn'] = getLambdaFunctionType(graph, lambda)

    createSubgraph(graph, lambdaImpl, {
      node: nodeCreators.call(),
      predecessors: {
        fn: {
          node: nodeCreators.partial(0),
          predecessors: {
            fn: { node: lambdaImpl, port: 'f2' },
            value: {
              node: nodeCreators.call(),
              predecessors: {
                fn: {
                  node: nodeCreators.partial(0),
                  predecessors: {
                    fn: { node: lambdaImpl, port: 'f1' },
                    value: { node: lambdaImpl, port: 'element' }
                  }
                }
              }
            }
          }
        }
      },
      successors: {
        result: { node: lambdaImpl, port: 'result' }
      }
    })

    createSubgraph(graph, graph.parent(node), {
      node: nodeCreators.partial(0),
      predecessors: {
        fn: {
          node: nodeCreators.partial(0),
          predecessors: {
            fn: lambda,
            value: {
              node: match.inputs.list.inputs.fn.node,
              port: match.inputs.list.inputs.fn.inPort
            }
          }
        },
        value: {
          node: match.inputs.fn.node,
          port: match.inputs.fn.inPort
        }
      },
      successors: {
        result: {
          node: match.node,
          port: 'fn'
        }
      }
    })

    removeEdge(graph,
      { node: match.inputs.fn.node, port: match.inputs.fn.inPort },
      { node: node, port: match.inputs.fn.port }
    )
    removeEdge(graph,
      { node: match.inputs.list.node, port: match.inputs.list.inPort },
      { node: node, port: match.inputs.list.port }
    )
    createEdge(graph,
      { node: match.inputs.list.inputs.list.node, port: match.inputs.list.inputs.list.inPort },
      { node: node, port: 'list' }
    )
  }
)

export const replaceHeadAfterSort = rule(
  match.byIdAndInputs('array/first', {
    array: match.byIdAndInputs('sort', {
      list: match.any({ requireNode: false })
    })
  }),
  (graph, node, match) => {
    const minSearchImpl = minSearch(graph, {
      node: match.inputs.array.inputs.list.node,
      port: match.inputs.array.inputs.list.inPort
    })
    createEdgeToEachSuccessor(graph, minSearchImpl, match.node)

    deleteUnusedPredecessors(graph, match.node)
    graph.removeNode(match.node)
  }
)

export const replaceHeadAfterSortDesc = rule(
  match.byIdAndInputs('array/first', {
    array: match.byIdAndInputs('sortDesc', {
      list: match.any({ requireNode: false })
    })
  }),
  (graph, node, match) => {
    const maxSearchImpl = maxSearch(graph, {
      node: match.inputs.array.inputs.list.node,
      port: match.inputs.array.inputs.list.inPort
    })
    createEdgeToEachSuccessor(graph, maxSearchImpl, match.node)

    deleteUnusedPredecessors(graph, match.node)
    graph.removeNode(match.node)
  }
)

export const swapSortAndFilter = rule(
  match.byIdAndInputs('filter', {
    list: match.oneOf(
      match.byIdAndInputs('sort', { list: match.any() }),
      match.byIdAndInputs('sortDesc', { list: match.any() })
    ),
    fn: match.any()
  }),
  (graph, node, match) => {
    const filterCopy = copyNode(graph, match.node)
    const sortCopy = copyNode(graph, match.inputs.list.node)

    createEdge(graph, filterCopy, { node: sortCopy, port: 'list' })
    createEdge(graph, { node: match.inputs.list.inputs.list.node, port: match.inputs.list.inputs.list.inPort },
                      { node: filterCopy, port: 'list' })
    createEdge(graph, match.inputs.fn.node, { node: filterCopy, port: 'fn' })

    createEdgeToEachSuccessor(graph, sortCopy, match.node)

    deepRemoveNode(graph, match.node)
  }
)
