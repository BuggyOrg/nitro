import { values } from 'lodash'
import * as mathRules from './math'
import * as logicRules from './logic'

export default [
  ...values(mathRules),
  ...values(logicRules)
]
