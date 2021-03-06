async = require 'async'
debug = (require 'debug')('ga')
_ = require 'lodash'

class Engine
  constructor: (
    @populationSize,
    @surviveGeneration
    @generations,
    @mutatePropability = 0.2,
    @crossoverPropability = 0.8) ->

    @populationPoll = []
    @generationResult = []
    @generationParents = []
    @previousPopulation = []
    @generation = 0
    @stopped = false
    @rollbackCount = 0

    @lastSolution = 0
    @generationsWithoutChange = 0

  _initPopulation = (self, callback) ->
    debug 'Initializing population'

    async.times(
      self.populationSize
      (n, cb) -> self.random_solution_fn((solution)  ->
        self.populationPoll.push solution
        cb())
      (err) ->
        debug 'Population initialized'
        callback()
    )

  _evolve = (self, callback) ->
    debug 'Evoluting population'

    async.timesSeries(
      self.generations
      (n, cb) -> 
        if not self.stopped
          _startGeneration(self, cb)
      (err) ->
        debug 'Population evolved'
        callback()
    )

  _breakEvolution = (self, currentGenerationBestSolution) ->
    if self.lastSolution == currentGenerationBestSolution.solution
      self.generationsWithoutChange++
    else
      self.generationsWithoutChange = 0

    self.lastSolution = currentGenerationBestSolution.solution

    if(self.stop_fn?(currentGenerationBestSolution, self.generationsWithoutChange))
      true

  _assesPopulation = (self, callback) ->
    
    debug 'Assesing population'
    
    async.eachLimit self.populationPoll, 1, (item, cb) ->
      
      self.fitness_fn item, (solution) ->
        
        self.generationResult.push {
          item: item
          solution: parseFloat(solution)
        }
        cb()
    , (err) ->    
      debug 'Population assessed'
      callback()

  _startGeneration = (self, callback) ->

    if self.rollbackCount > 20
      debug 'Too much rollbacks'
      return callback true

    self.generation++
    self.generationResult = []
    self.generationParents = []
    children = []

    debug 'Starting generation: ' + self.generation

    _assesPopulation self, () ->

      firstMax = 0
      secondMax = 0
      newPopulation = []

      self.generationParents = _.sortBy self.generationResult, 'solution'
        .reverse()
        .slice 0, self.surviveGeneration

      currentGenerationBestSolution = self.generationParents.slice(0, 1).pop()

      if currentGenerationBestSolution.solution < self.lastGenerationBestSolution and self.previousPopulation.length > 0
        self.populationPoll = self.previousPopulation
        debug 'Rollback generation'
        self.generation--
        self.rollbackCount++
        callback()
        return

      self.rollbackCount = 0

      debug 'Population best solution: %d', currentGenerationBestSolution.solution

      if _breakEvolution(self, currentGenerationBestSolution) == true
        self.stopped = true
        debug 'Break evolution'
        return callback true

      self.lastGenerationBestSolution = currentGenerationBestSolution.solution

      debug 'Begin crossover'

      for i in [1..self.populationSize]

        p1 = _arrRand(self.generationParents).item
        p2 = _arrRand(self.generationParents).item

        if Math.random() <= self.crossoverPropability
          child = self.crossover_fn p1, p2
        else
          child = p1

        if Math.random() <= self.mutatePropability
          child = self.mutator_fn(child)

        newPopulation.push(child)

      self.previousPopulation = self.populationPoll
      self.populationPoll = newPopulation

      debug 'Generation completed: '+ self.generation
      callback()

  _arrRand = (arr) ->
    arr[Math.floor(Math.random() * arr.length)]

  setFitness: (fn) ->
    @fitness_fn = fn

  setMutator: (fn) ->
    @mutator_fn = fn

  setCrossover: (fn) ->
    @crossover_fn = fn

  setRandomSolution: (fn) ->
    @random_solution_fn = fn

  setStop: (fn) ->
    @stop_fn = fn

  start: (callback) ->
    async.series([
      (cb) => _initPopulation(@, cb)
      (cb) => _evolve(@, cb)
    ], =>
      callback? {
        bestSolution: @generationParents.slice(0, 1).pop()
        generations: @generation
      }
    )

module.exports = Engine