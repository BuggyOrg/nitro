import _ from 'lodash'
import * as listRules from './lists'
import { mapRules } from '../rewrite'

export default _.keyBy(_.flattenDeep([
  mapRules(listRules)
]), 'id')
