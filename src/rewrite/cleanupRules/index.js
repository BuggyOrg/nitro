import _ from 'lodash'
import * as compoundRules from './compounds'
import * as deadCode from '../rules/deadCode'
import { mapRules } from '../rewrite'

export default _.keyBy(_.flattenDeep([
  mapRules(compoundRules),
  mapRules(deadCode)
]), 'id')
