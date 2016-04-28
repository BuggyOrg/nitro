/* global describe, it */
var graphlib = require('graphlib')
var fs = require('fs')
var constRewrite = require('../src/constrewrite.js')
var expect = require('chai').expect
const exec = require('child_process').exec
import _ from 'lodash'

describe('constant branch checker', () => {
  it('recognizes constant graphs as constant', () => {
    var constantGraph = graphlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/constant.json')))
    expect(constRewrite.isConstant(constantGraph)).to.be.true
  })

  it('does not treat input from io/stdin as constant', () => {
    var constantGraph = graphlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/stdin.json')))
    expect(constRewrite.isConstant(constantGraph)).to.be.false
  })
})

describe('constant branch replacer', () => {
  it('replaces constant branches with constants', () => {
    var graph = graphlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/constant.json')))
    constRewrite.rewriteConstants(graph)
    expect(graph).to.satisfy(g => !g.nodes().some(n => g.node(n).id === 'math/add'))
  })

  it('does not touch non-constant branches', () => {
    const originalGraph = JSON.parse(fs.readFileSync('test/fixtures/stdin.json'))
    var graph = graphlib.json.read(originalGraph)
    constRewrite.rewriteConstants(graph)
    expect(graphlib.json.write(graph)).to.deep.equal(originalGraph)
  })
})
