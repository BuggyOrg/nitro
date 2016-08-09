import createSubgraph from '../../util/subgraphCreator'
import * as nodeCreators from '../nodes'
import { createEdge, setNodeAt } from '../../util/rewrite'
import _ from 'lodash'

export function minSearch(graph, { node, port }) {
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

  const minImpl = createSubgraph(graph, minImplRecursiveRoot, {
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
                  less: {
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
    successors: { node: minInput, port: 'min' }
  })
  
  return {
    node: minImplRecursiveRoot,
    port: 'minimum'
  }
}