import * as mathRules from './math'
import * as logicRules from './logic'

function applyAndReturnName (functions) {
  return Object.keys(functions).map((r) =>
    (...args) => {
      functions[r].apply(undefined, args)
      return (functions[r].meta ? functions[r].meta.name : null) || r
    }
  )
}

export default [
  ...applyAndReturnName(mathRules),
  ...applyAndReturnName(logicRules)
]
