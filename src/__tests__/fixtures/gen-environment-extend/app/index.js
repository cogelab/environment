'use strict';
const Environment = require('../../../../lib/environment');
module.exports = class extends require(Environment.lookupGenerator(
  'dummy:app',
)) {};
