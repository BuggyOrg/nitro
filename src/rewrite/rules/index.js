import _ from 'lodash'
import * as mathRules from './math'
import * as logicRules from './logic'
import * as functionalRules from './functional'
import * as compoundRules from './compounds'
import * as deadCode from './deadCode'
import { mapRules } from '../rewrite'

/**
 * Export a map of all rewrite rules, using their unique rule names
 * as key.
 */
export default _.keyBy(_.flattenDeep([
  mapRules(mathRules),
  mapRules(logicRules),
  mapRules(functionalRules),
  mapRules(compoundRules),
  mapRules(deadCode)
]), 'id')
