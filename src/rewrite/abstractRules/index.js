import _ from 'lodash'
import { mapRules } from '../rewrite'

export default _.keyBy(_.flattenDeep([
]), 'id')
