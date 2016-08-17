import _ from 'lodash'
import * as compoundRules from './compounds'
import * as deadCode from '../rules/deadCode'
import { mapRules } from '../rewrite'

/**
 * Export a map of all cleanup rewrite rules, using their unique rule names
 * as key.
 */
export default _.keyBy(_.flattenDeep([
  mapRules(compoundRules),
  mapRules(deadCode)
]), 'id')
