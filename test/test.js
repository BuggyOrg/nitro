/* global describe, it */
var graphlib = require('graphlib')
var fs = require('fs')
var constRewrite = require('../src/constrewrite.js')
var expect = require('chai').expect
const exec = require('child_process').exec
import _ from 'lodash'

describe('constant branch checker', function () {
  it('recognizes constant graphs as constant', function () {
    var constantGraph = graphlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/constant.json')))
    expect(constRewrite.isConstant(constantGraph)).to.be.true
  })
  
  it('does not treat input from io/stdin as constant', function () {
    var constantGraph = graphlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/stdin.json')))
    expect(constRewrite.isConstant(constantGraph)).to.be.false
  })
})
