/* global describe, it */
import { expect } from 'chai'
import graphlib from 'graphlib'
import * as atomicWalk from '../../src/util/atomicWalk'

describe('atomicWalk', () => {
  describe('atomicPredecessorsOutPort', () => {
    it('returns an empty array if there are no predecessors', () => {
      const g = new graphlib.Graph({ multigraph: true, compound: true })
      g.setNode('n', { inputPorts: {} })

      expect(atomicWalk.atomicPredecessorsOutPort(g, 'n', 'in')).to.be.an.array
    })

    it('returns direct atomic predecessors', () => {
      const g = new graphlib.Graph({ multigraph: true, compound: true })
      g.setNode('n', { inputPorts: { in: 'number' } })
       .setNode('pre', { inputPorts: {}, outputPorts: { out: 'number' }, atomic: true })
       .setEdge('pre', 'n', { outPort: 'out', inPort: 'in' })

      expect(atomicWalk.atomicPredecessorsOutPort(g, 'n', 'in')).to.deep.equal([{ node: 'pre', port: 'out' }])
    })

    it('returns indirect atomic predecessors but no direct non-atomic ones', () => {
      const g = new graphlib.Graph({ multigraph: true, compound: true })
      g.setNode('n', { inputPorts: { in: 'number' } })
       .setNode('pre', { inputPorts: {}, outputPorts: { out: 'number' } })
       .setEdge('pre', 'n', { outPort: 'out', inPort: 'in' })
       .setNode('inner', { inputPorts: {}, outputPorts: { innerOut: 'number' }, atomic: true })
       .setParent('inner', 'pre')
       .setEdge('inner', 'pre', { outPort: 'innerOut', inPort: 'out' })

      expect(atomicWalk.atomicPredecessorsOutPort(g, 'n', 'in')).to.deep.equal([{ node: 'inner', port: 'innerOut' }])
    })
  })

  describe('atomicSuccessorsInPort', () => {
    it('returns an empty array if there are no successors', () => {
      const g = new graphlib.Graph({ multigraph: true, compound: true })
      g.setNode('n', { inputPorts: {} })

      expect(atomicWalk.atomicSuccessorsInPort(g, 'n', 'in')).to.be.an.array
    })

    it('returns direct atomic successors', () => {
      const g = new graphlib.Graph({ multigraph: true, compound: true })
      g.setNode('n', { inputPorts: { in: 'number' }, atomic: true })
       .setNode('pre', { inputPorts: {}, outputPorts: { out: 'number' } })
       .setEdge('pre', 'n', { outPort: 'out', inPort: 'in' })

      expect(atomicWalk.atomicSuccessorsInPort(g, 'pre', 'out')).to.deep.equal([{ node: 'n', port: 'in' }])
    })

    it('returns indirect atomic predecessors but no direct non-atomic ones', () => {
      const g = new graphlib.Graph({ multigraph: true, compound: true })
      g.setNode('pre', { inputPorts: {}, outputPorts: { out: 'number' } })
       .setNode('inner', { inputPorts: {}, outputPorts: { innerOut: 'number' }, atomic: true })
       .setParent('inner', 'pre')
       .setEdge('inner', 'pre', { outPort: 'innerOut', inPort: 'out' })
       .setNode('n', { inputPorts: { in: 'number' }, atomic: true })
       .setEdge('pre', 'n', { outPort: 'out', inPort: 'in' })

      expect(atomicWalk.atomicSuccessorsInPort(g, 'inner', 'innerOut')).to.deep.equal([{ node: 'n', port: 'in' }])
    })
  })
})
