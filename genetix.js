// Generated by CoffeeScript 1.8.0
(function() {
  var Engine, async, debug, _;

  async = require('async');

  debug = (require('debug'))('ga');

  _ = require('lodash');

  Engine = (function() {
    var _arrRand, _assesPopulation, _breakEvolution, _evolve, _initPopulation, _startGeneration;

    function Engine(populationSize, surviveGeneration, generations, mutatePropability, crossoverPropability) {
      this.populationSize = populationSize;
      this.surviveGeneration = surviveGeneration;
      this.generations = generations;
      this.mutatePropability = mutatePropability != null ? mutatePropability : 0.2;
      this.crossoverPropability = crossoverPropability != null ? crossoverPropability : 0.8;
      this.populationPoll = [];
      this.generationResult = [];
      this.generationParents = [];
      this.previousPopulation = [];
      this.generation = 0;
      this.stopped = false;
      this.rollbackCount = 0;
      this.lastSolution = 0;
      this.generationsWithoutChange = 0;
    }

    _initPopulation = function(self, callback) {
      debug('Initializing population');
      return async.times(self.populationSize, function(n, cb) {
        return self.random_solution_fn(function(solution) {
          self.populationPoll.push(solution);
          return cb();
        });
      }, function(err) {
        debug('Population initialized');
        return callback();
      });
    };

    _evolve = function(self, callback) {
      debug('Evoluting population');
      return async.timesSeries(self.generations, function(n, cb) {
        if (!self.stopped) {
          return _startGeneration(self, cb);
        }
      }, function(err) {
        debug('Population evolved');
        return callback();
      });
    };

    _breakEvolution = function(self, currentGenerationBestSolution) {
      if (self.lastSolution === currentGenerationBestSolution.solution) {
        self.generationsWithoutChange++;
      } else {
        self.generationsWithoutChange = 0;
      }
      self.lastSolution = currentGenerationBestSolution.solution;
      if (typeof self.stop_fn === "function" ? self.stop_fn(currentGenerationBestSolution, self.generationsWithoutChange) : void 0) {
        return true;
      }
    };

    _assesPopulation = function(self, callback) {
      debug('Assesing population');
      return async.eachLimit(self.populationPoll, 1, function(item, cb) {
        return self.fitness_fn(item, function(solution) {
          self.generationResult.push({
            item: item,
            solution: parseFloat(solution)
          });
          return cb();
        });
      }, function(err) {
        debug('Population assessed');
        return callback();
      });
    };

    _startGeneration = function(self, callback) {
      var children;
      if (self.rollbackCount > 20) {
        debug('Too much rollbacks');
        return callback(true);
      }
      self.generation++;
      self.generationResult = [];
      self.generationParents = [];
      children = [];
      debug('Starting generation: ' + self.generation);
      return _assesPopulation(self, function() {
        var child, currentGenerationBestSolution, firstMax, i, newPopulation, p1, p2, secondMax, _i, _ref;
        firstMax = 0;
        secondMax = 0;
        newPopulation = [];
        self.generationParents = _.sortBy(self.generationResult, 'solution').reverse().slice(0, self.surviveGeneration);
        currentGenerationBestSolution = self.generationParents.slice(0, 1).pop();
        if (currentGenerationBestSolution.solution < self.lastGenerationBestSolution && self.previousPopulation.length > 0) {
          self.populationPoll = self.previousPopulation;
          debug('Rollback generation');
          self.generation--;
          self.rollbackCount++;
          callback();
          return;
        }
        self.rollbackCount = 0;
        debug('Population best solution: %d', currentGenerationBestSolution.solution);
        if (_breakEvolution(self, currentGenerationBestSolution) === true) {
          self.stopped = true;
          debug('Break evolution');
          return callback(true);
        }
        self.lastGenerationBestSolution = currentGenerationBestSolution.solution;
        debug('Begin crossover');
        for (i = _i = 1, _ref = self.populationSize; 1 <= _ref ? _i <= _ref : _i >= _ref; i = 1 <= _ref ? ++_i : --_i) {
          p1 = _arrRand(self.generationParents).item;
          p2 = _arrRand(self.generationParents).item;
          if (Math.random() <= self.crossoverPropability) {
            child = self.crossover_fn(p1, p2);
          } else {
            child = p1;
          }
          if (Math.random() <= self.mutatePropability) {
            child = self.mutator_fn(child);
          }
          newPopulation.push(child);
        }
        self.previousPopulation = self.populationPoll;
        self.populationPoll = newPopulation;
        debug('Generation completed: ' + self.generation);
        return callback();
      });
    };

    _arrRand = function(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    };

    Engine.prototype.setFitness = function(fn) {
      return this.fitness_fn = fn;
    };

    Engine.prototype.setMutator = function(fn) {
      return this.mutator_fn = fn;
    };

    Engine.prototype.setCrossover = function(fn) {
      return this.crossover_fn = fn;
    };

    Engine.prototype.setRandomSolution = function(fn) {
      return this.random_solution_fn = fn;
    };

    Engine.prototype.setStop = function(fn) {
      return this.stop_fn = fn;
    };

    Engine.prototype.start = function(callback) {
      return async.series([
        (function(_this) {
          return function(cb) {
            return _initPopulation(_this, cb);
          };
        })(this), (function(_this) {
          return function(cb) {
            return _evolve(_this, cb);
          };
        })(this)
      ], (function(_this) {
        return function() {
          return typeof callback === "function" ? callback({
            bestSolution: _this.generationParents.slice(0, 1).pop(),
            generations: _this.generation
          }) : void 0;
        };
      })(this));
    };

    return Engine;

  })();

  module.exports = Engine;

}).call(this);
