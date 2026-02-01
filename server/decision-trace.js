/**
 * Decision Trace - structured trace for orchestration decisions.
 * Inspired by mercenary's ReasoningTracer, but deterministic and lightweight.
 */

function createDecisionTrace(goal) {
  const trace = {
    goal,
    startedAt: new Date().toISOString(),
    steps: []
  };

  function addStep(name, data) {
    trace.steps.push({
      name,
      at: new Date().toISOString(),
      data
    });
  }

  function finalize(summary = {}) {
    trace.completedAt = new Date().toISOString();
    trace.summary = summary;
    return trace;
  }

  function value() {
    return trace;
  }

  return { addStep, finalize, value };
}

module.exports = {
  createDecisionTrace
};
