import createSubgraph from '../../util/subgraphCreator'
import * as nodeCreators from '../nodes'
import { createEdge, setNodeAt } from '../../util/rewrite'
import _ from 'lodash'

/**
 * Insert a minimum search algorithm in the given graph that sort the gets the minimum of the list
 * at the given node and port.
 * @param graph graphlib graph
 * @param node node name of the list input
 * @param port port name of the list input
 * @returns node name and port of the minimum search output
 */
export function minSearch (graph, { node, port }) {
  const context = (graph.node(node).inputPorts || {})[port] ? node : graph.parent(node)

  const minImplId = _.uniqueId('minimum')
  const minImplRecursiveRoot = setNodeAt(graph, _.uniqueId('minimum'), context, {
    id: minImplId,
    recursiveRoot: true,
    recursive: true,
    inputPorts: {
      list: 'generic',
      min: 'number'
    },
    outputPorts: {
      minimum: 'number'
    },
    settings: {
      argumentOrdering: ['list', 'min', 'minimum']
    }
  })

  const listInput = { node: minImplRecursiveRoot, port: 'list' }
  const minInput = { node: minImplRecursiveRoot, port: 'min' }

  createSubgraph(graph, minImplRecursiveRoot, {
    node: nodeCreators.logicMux(),
    predecessors: {
      control: {
        node: nodeCreators.array.empty(),
        predecessors: {
          array: listInput
        }
      },
      input1: minInput,
      input2: {
        node: {
          id: minImplId,
          recursive: true,
          inputPorts: {
            list: 'generic',
            min: 'number'
          },
          outputPorts: {
            minimum: 'number'
          },
          settings: {
            argumentOrdering: ['list', 'min', 'minimum']
          }
        },
        predecessors: {
          list: {
            node: nodeCreators.array.rest(),
            predecessors: {
              array: listInput
            }
          },
          min: {
            node: nodeCreators.logicMux(),
            predecessors: {
              control: {
                node: nodeCreators.math.less(),
                predecessors: {
                  isLess: {
                    node: nodeCreators.array.first(),
                    predecessors: {
                      array: listInput
                    }
                  },
                  than: minInput
                }
              },
              input1: {
                node: nodeCreators.array.first(),
                predecessors: {
                  array: listInput
                }
              },
              input2: minInput
            }
          }
        }
      }
    },
    successors: {
      output: { node: minImplRecursiveRoot, port: 'minimum' }
    }
  })

  createEdge(graph, { node, port }, listInput)
  createSubgraph(graph, context, {
    node: nodeCreators.array.first(),
    predecessors: {
      array: { node, port }
    },
    successors: {
      value: { node: minImplRecursiveRoot, port: 'min' }
    }
  })

  return {
    node: minImplRecursiveRoot,
    port: 'minimum'
  }
}

/**
 * Insert a maximum search algorithm in the given graph that sort the gets the maximum of the list
 * at the given node and port.
 * @param graph graphlib graph
 * @param node node name of the list input
 * @param port port name of the list input
 * @returns node name and port of the maximum search output
 */
export function maxSearch (graph, { node, port }) {
  const context = (graph.node(node).inputPorts || {})[port] ? node : graph.parent(node)

  const maxImplId = _.uniqueId('maximum')
  const maxImplRecursiveRoot = setNodeAt(graph, _.uniqueId('maximum'), context, {
    id: maxImplId,
    recursiveRoot: true,
    recursive: true,
    inputPorts: {
      list: 'generic',
      max: 'number'
    },
    outputPorts: {
      maximum: 'number'
    },
    settings: {
      argumentOrdering: ['list', 'max', 'maximum']
    }
  })

  const listInput = { node: maxImplRecursiveRoot, port: 'list' }
  const maxInput = { node: maxImplRecursiveRoot, port: 'max' }

  createSubgraph(graph, maxImplRecursiveRoot, {
    node: nodeCreators.logicMux(),
    predecessors: {
      control: {
        node: nodeCreators.array.empty(),
        predecessors: {
          array: listInput
        }
      },
      input1: maxInput,
      input2: {
        node: {
          id: maxImplId,
          recursive: true,
          inputPorts: {
            list: 'generic',
            max: 'number'
          },
          outputPorts: {
            maximum: 'number'
          },
          settings: {
            argumentOrdering: ['list', 'max', 'maximum']
          }
        },
        predecessors: {
          list: {
            node: nodeCreators.array.rest(),
            predecessors: {
              array: listInput
            }
          },
          max: {
            node: nodeCreators.logicMux(),
            predecessors: {
              control: {
                node: nodeCreators.math.less(),
                predecessors: {
                  isLess: maxInput,
                  than: {
                    node: nodeCreators.array.first(),
                    predecessors: {
                      array: listInput
                    }
                  }
                }
              },
              input1: {
                node: nodeCreators.array.first(),
                predecessors: {
                  array: listInput
                }
              },
              input2: maxInput
            }
          }
        }
      }
    },
    successors: {
      output: { node: maxImplRecursiveRoot, port: 'maximum' }
    }
  })

  createEdge(graph, { node, port }, listInput)
  createSubgraph(graph, context, {
    node: nodeCreators.array.first(),
    predecessors: {
      array: { node, port }
    },
    successors: {
      value: { node: maxImplRecursiveRoot, port: 'max' }
    }
  })

  return {
    node: maxImplRecursiveRoot,
    port: 'maximum'
  }
}
