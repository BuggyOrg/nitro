import { match } from '../../rewrite'

export function matchInvertableNode () {
  return match.oneOf(
    match.byIdAndInputs('math/less', [ match.any(), match.any() ]),
    match.byIdAndInputs('logic/not', [ match.any() ])
  )
}

export function getInvertedNode (graph, node) {
  const nodeValue = graph.node(node)

  switch (nodeValue.id) {
    case 'math/less':
      return {
        component: {
          'id': 'math/greaterOrEqual',
          'inputPorts': {
            'isGreaterOrEqual': 'number',
            'than': 'number'
          },
          'outputPorts': {
            'value': 'bool'
          },
          'atomic': true,
          'version': '0.1.0'
        },
        inputPorts: [{
          oldPort: 'isLess',
          newPort: 'isGreaterOrEqual'
        }, {
          oldPort: 'than',
          newPort: 'than'
        }],
        outputPorts: [{
          oldPort: 'value',
          newPort: 'value'
        }]
      }
    case 'math/greaterOrEqual':
      return {
        component: {
          'id': 'math/less',
          'inputPorts': {
            'isLess': 'number',
            'than': 'number'
          },
          'outputPorts': {
            'value': 'bool'
          },
          'atomic': true,
          'version': '0.1.0'
        },
        inputPorts: [{
          oldPort: 'isGreaterOrEqual',
          newPort: 'isLess'
        }, {
          oldPort: 'than',
          newPort: 'than'
        }],
        outputPorts: [{
          oldPort: 'value',
          newPort: 'value'
        }]
      }
    case 'logic/not':
      return {
        component: {
          'id': 'std/id',
          'inputPorts': {
            'input': 'generic'
          },
          'outputPorts': {
            'output': 'generic'
          },
          'atomic': true,
          'version': '0.2.1'
        },
        inputPorts: [{
          oldPort: 'input',
          newPort: 'input'
        }],
        outputPorts: [{
          oldPort: 'output',
          newPort: 'output'
        }]
      }
    default:
      throw new Error(`${node} (type ${nodeValue.id}) is not invertable`)
  }
}
