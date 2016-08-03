import _ from 'lodash'
import * as compoundRules from './compounds'
import { mapRules } from '../rewrite'

export default _.keyBy(_.flattenDeep([
  mapRules(compoundRules)
]), 'id')
