(function (global) {
  'use strict';
  const core = global.SpectraCore = global.SpectraCore || {};
  core.stripe = core.stripe || {
    setStripeY: function (v) { (core.state || (core.state = {})).stripeY = v; },
    setStripeWidth: function (v) { (core.state || (core.state = {})).stripeWidth = v; }
  };
})(window);
