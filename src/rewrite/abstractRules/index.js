import _ from 'lodash'
import * as listRules from './lists'
import { mapRules } from '../rewrite'

/**
 * Export a map of all abstract rewrite rules, using their unique rule names
 * as key.
 */
export default _.keyBy(_.flattenDeep([
  mapRules(listRules)
]), 'id')
