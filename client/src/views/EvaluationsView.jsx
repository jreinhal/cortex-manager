import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { SPRING_SMOOTH } from '../lib/constants'
import { apiFetch } from '../lib/api'
import { EmptyState } from '../components/EmptyState'
import { TrendCard } from '../components/TrendCard'

export function EvaluationsView({
  datasets,
  runs,
  evaluations,
  templates = [],
  onCreateDataset,
  onDeleteDataset,
  onAddDatasetItem,
  onCreateEvaluation,
  onImportDataset,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onImportTemplates,
  onExportTemplates
}) {
  const [selectedDatasetId, setSelectedDatasetId] = useState(datasets[0]?.id || '');
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');
  const [datasetType, setDatasetType] = useState('response');
  const [itemInput, setItemInput] = useState('');
  const [itemExpected, setItemExpected] = useState('');
  const [itemExpectedPaths, setItemExpectedPaths] = useState('');
  const [itemWeight, setItemWeight] = useState('1');
  const [itemRubric, setItemRubric] = useState('');
  const [itemExpectedType, setItemExpectedType] = useState('contains');
  const [evalDatasetId, setEvalDatasetId] = useState('');
  const [evalRunId, setEvalRunId] = useState('');
  const [selectedEvaluationId, setSelectedEvaluationId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateExpectedType, setTemplateExpectedType] = useState('llm');
  const [templateRubric, setTemplateRubric] = useState('');
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const importInputRef = useRef(null);
  const templateImportRef = useRef(null);

  useEffect(() => {
    if (!selectedDatasetId && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  useEffect(() => {
    if (!evalDatasetId && selectedDatasetId) {
      setEvalDatasetId(selectedDatasetId);
    }
  }, [selectedDatasetId, evalDatasetId]);

  useEffect(() => {
    if (!compareLeftId && evaluations.length > 0) {
      setCompareLeftId(evaluations[0].id);
    }
    if (!compareRightId && evaluations.length > 1) {
      setCompareRightId(evaluations[1].id);
    }
  }, [evaluations, compareLeftId, compareRightId]);

  useEffect(() => {
    if (compareResult) {
      setCompareResult(null);
    }
  }, [compareLeftId, compareRightId]);

  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const isRetrievalDataset = selectedDataset?.benchmarkType === 'retrieval';

  const handleCreateDataset = async () => {
    if (!datasetName.trim()) return;
    const created = await onCreateDataset?.(datasetName.trim(), datasetDescription.trim(), datasetType);
    if (created) {
      setSelectedDatasetId(created.id);
      setDatasetName('');
      setDatasetDescription('');
      setDatasetType('response');
    }
  };

  const handleAddItem = async () => {
    if (!selectedDataset || !itemInput.trim()) return;
    const parsedPaths = itemExpectedPaths
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const added = await onAddDatasetItem?.(selectedDataset.id, {
      input: itemInput.trim(),
      expected: itemExpected.trim(),
      weight: Number(itemWeight) || 1,
      expectedType: isRetrievalDataset ? 'retrieval' : itemExpectedType,
      rubric: isRetrievalDataset ? '' : itemRubric.trim(),
      expectedPaths: isRetrievalDataset ? parsedPaths : []
    });
    if (added) {
      setItemInput('');
      setItemExpected('');
      setItemWeight('1');
      setItemRubric('');
      setItemExpectedType('contains');
      setItemExpectedPaths('');
    }
  };

  const handleTemplateApply = () => {
    if (isRetrievalDataset) return;
    if (!selectedTemplate) return;
    if (selectedTemplate.rubric) {
      setItemRubric(selectedTemplate.rubric);
    }
    if (selectedTemplate.expectedType) {
      setItemExpectedType(selectedTemplate.expectedType);
    }
  };

  const resetTemplateForm = () => {
    setEditingTemplateId('');
    setTemplateName('');
    setTemplateDescription('');
    setTemplateExpectedType('llm');
    setTemplateRubric('');
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    const payload = {
      name: templateName.trim(),
      description: templateDescription.trim(),
      rubric: templateRubric.trim(),
      expectedType: templateExpectedType
    };
    const saved = editingTemplateId
      ? await onUpdateTemplate?.(editingTemplateId, payload)
      : await onCreateTemplate?.(payload);
    if (saved) {
      setSelectedTemplateId(saved.id);
      resetTemplateForm();
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name || '');
    setTemplateDescription(template.description || '');
    setTemplateExpectedType(template.expectedType || 'llm');
    setTemplateRubric(template.rubric || '');
  };

  const handleDeleteTemplate = async (template) => {
    if (!template) return;
    const label = template.name ? `"${template.name}"` : 'this template';
    if (!window.confirm(`Delete ${label}?`)) return;
    await onDeleteTemplate?.(template.id);
    if (editingTemplateId === template.id) {
      resetTemplateForm();
    }
  };

  const handleExportTemplates = async () => {
    await onExportTemplates?.();
  };

  const handleImportTemplates = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed.templates || parsed.template || parsed;
      await onImportTemplates?.(payload);
    } catch (e) {
      console.error('Failed to import templates:', e);
    } finally {
      event.target.value = '';
    }
  };

  const handleExportDataset = async () => {
    if (!selectedDataset) return;
    try {
      const res = await apiFetch(`/datasets/${selectedDataset.id}/export`);
      const data = await res.json();
      const payload = data.dataset || data;
      if (!payload) return;
      const safeName = (payload.name || 'dataset').replace(/[^a-z0-9-_]+/gi, '_');
      const blob = new Blob([JSON.stringify({ dataset: payload }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export dataset:', e);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed.dataset || parsed;
      const created = await onImportDataset?.(payload);
      if (created) {
        setSelectedDatasetId(created.id);
      }
    } catch (e) {
      console.error('Failed to import dataset:', e);
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateEvaluation = async () => {
    if (!evalDatasetId) return;
    const dataset = datasets.find((entry) => entry.id === evalDatasetId);
    const needsRun = dataset?.benchmarkType !== 'retrieval';
    if (needsRun && !evalRunId) return;
    const created = await onCreateEvaluation?.(evalDatasetId, needsRun ? evalRunId : null);
    if (created) {
      setSelectedEvaluationId(created.id);
    }
  };

  const handleCompareEvaluations = async () => {
    if (!compareLeftId || !compareRightId) return;
    setCompareLoading(true);
    try {
      const res = await apiFetch(`/evaluations/compare?left=${encodeURIComponent(compareLeftId)}&right=${encodeURIComponent(compareRightId)}`);
      const data = await res.json();
      if (res.ok) {
        setCompareResult(data);
      } else {
        console.error(data?.error || 'Failed to compare evaluations');
      }
    } catch (e) {
      console.error('Failed to compare evaluations:', e);
    }
    setCompareLoading(false);
  };

  const selectedEvaluation = evaluations.find((evaluation) => evaluation.id === selectedEvaluationId);
  const evalDataset = datasets.find((dataset) => dataset.id === evalDatasetId);
  const evalNeedsRun = evalDataset?.benchmarkType !== 'retrieval';
  const deltaScore = compareResult?.delta?.score ?? 0;
  const deltaPassRate = compareResult?.delta?.passRate ?? 0;
  const deltaItemCount = compareResult?.delta?.itemCount ?? 0;
  const compareMeta = compareResult?.meta || {};

  const orderedEvaluations = [...evaluations]
    .filter((evaluation) => evaluation.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const buildTrend = (type) => {
    const values = orderedEvaluations
      .filter((evaluation) => evaluation.type === type)
      .map((evaluation) => Number(evaluation.metrics?.score ?? 0));
    const latest = values.length > 0 ? values[values.length - 1] : 0;
    const previous = values.length > 1 ? values[values.length - 2] : latest;
    const avg = values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    return {
      values,
      latest: Number(latest.toFixed(1)),
      delta: Number((latest - previous).toFixed(1)),
      avg: Number(avg.toFixed(1)),
      count: values.length
    };
  };

  const responseTrend = buildTrend('response');
  const retrievalTrend = buildTrend('retrieval');

  const handleDeleteSelected = async () => {
    if (!selectedDataset) return;
    const label = selectedDataset.name ? `"${selectedDataset.name}"` : 'this dataset';
    if (!window.confirm(`Delete ${label}?`)) return;
    await onDeleteDataset?.(selectedDataset.id);
  };

  return (
    <motion.div
      key="evaluations"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={SPRING_SMOOTH}
      className="grid lg:grid-cols-3 gap-6"
    >
      <div className="glass-panel rounded-3xl p-6 space-y-5">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Datasets</div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {datasets.length === 0 && <EmptyState title="No datasets yet" subtitle="Create one to start evaluations." />}
            {datasets.map((dataset) => (
              <button
                key={dataset.id}
                onClick={() => setSelectedDatasetId(dataset.id)}
                className={cn(
                  "w-full text-left p-3 rounded-2xl border transition-ui",
                  dataset.id === selectedDatasetId
                    ? "bg-slate-800/60 border-cyan-500/40"
                    : "bg-slate-900/40 border-slate-800/60 hover:border-slate-700"
                )}
              >
                <div className="text-sm text-slate-200 truncate">{dataset.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {dataset.items?.length || 0} items · {dataset.benchmarkType || 'response'} · v{dataset.version || 1}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Create Dataset</div>
          <input
            type="text"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="Dataset name"
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
          />
          <textarea
            value={datasetDescription}
            onChange={(e) => setDatasetDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
          />
          <select
            value={datasetType}
            onChange={(e) => setDatasetType(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
          >
            <option value="response">Response evaluation</option>
            <option value="retrieval">Retrieval benchmark</option>
          </select>
          <button
            type="button"
            onClick={handleCreateDataset}
            className="w-full py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm"
          >
            Create dataset
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Dataset Detail</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportDataset}
                disabled={!selectedDataset}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-50"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              >
                Import
              </button>
              {selectedDataset && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          {!selectedDataset ? (
            <EmptyState title="Select a dataset" subtitle="Choose one from the list to add items." />
          ) : (
            <>
              <div className="mb-4">
                <div className="text-lg font-semibold text-white">{selectedDataset.name}</div>
                <div className="text-sm text-slate-400 mt-1">{selectedDataset.description || 'No description provided.'}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="tag-inline tag-inline-muted">Version v{selectedDataset.version || 1}</span>
                  <span className="tag-inline tag-inline-muted">
                    Type {selectedDataset.benchmarkType || 'response'}
                  </span>
                  {selectedDataset.updatedAt && (
                    <span className="tag-inline tag-inline-muted">
                      Updated {new Date(selectedDataset.updatedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <input
                  type="text"
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  placeholder="Prompt / input"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                />
                {isRetrievalDataset ? (
                  <input
                    type="text"
                    value={itemExpectedPaths}
                    onChange={(e) => setItemExpectedPaths(e.target.value)}
                    placeholder="Expected resource paths (comma-separated)"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  />
                ) : (
                  <input
                    type="text"
                    value={itemExpected}
                    onChange={(e) => setItemExpected(e.target.value)}
                    placeholder="Expected text or regex:..."
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  />
                )}
                {isRetrievalDataset ? (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={itemWeight}
                    onChange={(e) => setItemWeight(e.target.value)}
                    placeholder="Weight"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  />
                ) : (
                  <select
                    value={itemExpectedType}
                    onChange={(e) => setItemExpectedType(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  >
                    <option value="contains">Contains</option>
                    <option value="regex">Regex</option>
                    <option value="llm">LLM Rubric</option>
                  </select>
                )}
                {!isRetrievalDataset && (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={itemWeight}
                    onChange={(e) => setItemWeight(e.target.value)}
                    placeholder="Weight"
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
                  />
                )}
              </div>
              {!isRetrievalDataset && (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200 min-w-[220px]"
                    >
                      <option value="">Rubric template (optional)</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleTemplateApply}
                      disabled={!selectedTemplate}
                      className="px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm border border-slate-700/60 disabled:opacity-50"
                    >
                      Use template
                    </button>
                    {selectedTemplate && (
                      <span className="text-xs text-slate-500">{selectedTemplate.description}</span>
                    )}
                  </div>
                  <textarea
                    value={itemRubric}
                    onChange={(e) => setItemRubric(e.target.value)}
                    placeholder="Optional rubric (used by LLM grader)"
                    rows={3}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200 mb-4"
                  />
                </>
              )}
              <button
                type="button"
                onClick={handleAddItem}
                className="mb-4 px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm border border-slate-700/60"
              >
                Add item
              </button>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {(selectedDataset.items || []).length === 0 && (
                  <EmptyState title="No items yet" subtitle="Add prompts to make this dataset usable." />
                )}
                {(selectedDataset.items || []).map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/60">
                    <div className="text-sm text-slate-200 truncate">{item.input}</div>
                    {item.expected && <div className="text-xs text-slate-500 mt-1 truncate">Expected: {item.expected}</div>}
                    {item.expectedPaths?.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        Expected paths: {item.expectedPaths.join(', ')}
                      </div>
                    )}
                    {item.expectedType && (
                      <div className="text-[10px] text-slate-600 mt-1">Type: {item.expectedType}</div>
                    )}
                    {item.rubric && (
                      <div className="text-[10px] text-slate-600 mt-1 truncate">Rubric: {item.rubric}</div>
                    )}
                    {item.weight && <div className="text-[10px] text-slate-600 mt-1">Weight: {item.weight}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Evaluation Trends</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <TrendCard label="Response" trend={responseTrend} accent="#38bdf8" />
              <TrendCard label="Retrieval" trend={retrievalTrend} accent="#22c55e" />
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-4">Run Evaluation</div>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <select
                value={evalDatasetId}
                onChange={(e) => setEvalDatasetId(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="">Select dataset</option>
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
                ))}
              </select>
              <select
                value={evalRunId}
                onChange={(e) => setEvalRunId(e.target.value)}
                disabled={!evalNeedsRun}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="">{evalNeedsRun ? 'Select run' : 'Not required for retrieval'}</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>{(run.goal || 'Untitled run').substring(0, 60)}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleCreateEvaluation}
              disabled={!evalDatasetId || (evalNeedsRun && !evalRunId)}
              className="px-4 py-2 rounded-2xl bg-emerald-500/90 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-sm font-semibold transition-ui"
            >
              Create evaluation
            </button>
          <div className="mt-6 space-y-3">
            {evaluations.length === 0 && <EmptyState title="No evaluations yet" subtitle="Create one to capture scores." />}
            {evaluations.map((evaluation) => {
              const isRetrieval = evaluation.type === 'retrieval';
              const detail = isRetrieval
                ? `Recall@${evaluation.metrics?.topK ?? 0} ${Math.round((evaluation.metrics?.recallAtK || 0) * 100)}% · MRR ${(evaluation.metrics?.mrr || 0).toFixed(2)} · Items ${evaluation.metrics?.itemCount ?? 0}`
                : `Score ${evaluation.metrics?.score ?? '—'} · Pass ${Math.round((evaluation.metrics?.passRate || 0) * 100)}% · Items ${evaluation.metrics?.itemCount ?? 0}`;
              return (
                <button
                  key={evaluation.id}
                  type="button"
                  onClick={() => setSelectedEvaluationId(evaluation.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-2xl border transition-ui",
                    evaluation.id === selectedEvaluationId
                      ? "border-cyan-500/40 bg-slate-800/60"
                      : "border-slate-800/60 bg-slate-900/50 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-slate-200">{evaluation.name}</div>
                    <span className={cn(
                      "text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border",
                      evaluation.status === 'pass'
                        ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                        : evaluation.status === 'warn'
                          ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                          : evaluation.status === 'fail'
                            ? "border-red-500/40 text-red-300 bg-red-500/10"
                            : "border-slate-700 text-slate-400 bg-slate-800/60"
                    )}>
                      {evaluation.status || 'needs-review'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {detail} · v{evaluation.datasetVersion || 1}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-6">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-3">Compare Evaluations</div>
            <div className="grid md:grid-cols-2 gap-4 mb-3">
              <select
                value={compareLeftId}
                onChange={(e) => setCompareLeftId(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="">Left evaluation</option>
                {evaluations.map((evaluation) => (
                  <option key={evaluation.id} value={evaluation.id}>{evaluation.name}</option>
                ))}
              </select>
              <select
                value={compareRightId}
                onChange={(e) => setCompareRightId(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="">Right evaluation</option>
                {evaluations.map((evaluation) => (
                  <option key={evaluation.id} value={evaluation.id}>{evaluation.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleCompareEvaluations}
              disabled={!compareLeftId || !compareRightId || compareLeftId === compareRightId || compareLoading}
              className="px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm border border-slate-700/60 disabled:opacity-50"
            >
              {compareLoading ? 'Comparing…' : 'Compare'}
            </button>
            <div className="text-[10px] text-slate-500 mt-2">Delta = right − left</div>
            {evaluations.length < 2 && (
              <div className="text-xs text-slate-500 mt-3">Add at least two evaluations to compare results.</div>
            )}
            {compareResult && (
              <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs">
                <div className={cn(
                  "p-3 rounded-xl border",
                  deltaScore >= 0
                    ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                    : "border-red-500/30 text-red-300 bg-red-500/10"
                )}>
                  Score Δ {deltaScore >= 0 ? '+' : ''}{deltaScore.toFixed(2)}
                </div>
                <div className={cn(
                  "p-3 rounded-xl border",
                  deltaPassRate >= 0
                    ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                    : "border-red-500/30 text-red-300 bg-red-500/10"
                )}>
                  Pass Rate Δ {deltaPassRate >= 0 ? '+' : ''}{Math.round(deltaPassRate * 100)}%
                </div>
                <div className="p-3 rounded-xl border border-slate-700 text-slate-300 bg-slate-800/60">
                  Items Δ {deltaItemCount >= 0 ? '+' : ''}{deltaItemCount}
                </div>
              </div>
            )}
            {(compareMeta.datasetMismatch || compareMeta.datasetVersionMismatch) && (
              <div className="mt-3 text-xs text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-xl px-3 py-2">
                {compareMeta.datasetMismatch ? 'Comparing different datasets.' : 'Dataset versions differ between evaluations.'}
              </div>
            )}
          </div>
          {selectedEvaluation && (
            <div className="mt-6">
              {selectedEvaluation.type === 'retrieval' ? (
                <div className="grid sm:grid-cols-3 gap-3 mb-4 text-xs text-slate-300">
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    Recall@{selectedEvaluation.metrics?.topK ?? 0}{' '}
                    <span className="text-slate-100">{Math.round((selectedEvaluation.metrics?.recallAtK || 0) * 100)}%</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    Precision@{selectedEvaluation.metrics?.topK ?? 0}{' '}
                    <span className="text-slate-100">{Math.round((selectedEvaluation.metrics?.precisionAtK || 0) * 100)}%</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    MRR <span className="text-slate-100">{(selectedEvaluation.metrics?.mrr || 0).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3 mb-4 text-xs text-slate-300">
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    LLM calls <span className="text-slate-100">{selectedEvaluation.usage?.llmCalls ?? selectedEvaluation.metrics?.llmCalls ?? 0}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    LLM tokens <span className="text-slate-100">{selectedEvaluation.usage?.tokensEstimated ?? 0}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800/60 bg-slate-900/60">
                    LLM cost <span className="text-slate-100">${(selectedEvaluation.usage?.costEstimated ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-3">Per-item grading</div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {(selectedEvaluation.items || []).length === 0 && (
                  <EmptyState title="No item results" subtitle="Evaluation details not available." />
                )}
                {(selectedEvaluation.items || []).map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span className="truncate">{item.input}</span>
                      <span className={cn(
                        "text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border",
                        item.status === 'pass'
                          ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                          : item.status === 'fail'
                            ? "border-red-500/40 text-red-300 bg-red-500/10"
                            : "border-amber-500/40 text-amber-300 bg-amber-500/10"
                      )}>
                        {item.status}
                      </span>
                    </div>
                    {item.expected && (
                      <div className="text-xs text-slate-500 mt-1 truncate">Expected: {item.expected}</div>
                    )}
                    {item.expectedPaths?.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        Expected paths: {item.expectedPaths.join(', ')}
                      </div>
                    )}
                    {selectedEvaluation.type === 'retrieval' ? (
                      <div className="text-[10px] text-slate-500 mt-2">
                        Precision {Math.round((item.precision || 0) * 100)}% · Recall {Math.round((item.recall || 0) * 100)}% · MRR {(item.mrr || 0).toFixed(2)}
                      </div>
                    ) : (
                    <div className="text-[10px] text-slate-500 mt-2">
                      Score {Math.round((item.score || 0) * 100)} · Weight {item.weight || 1} · {item.method}
                    </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] text-slate-500 mt-2">Notes: {item.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Rubric Templates</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportTemplates}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => templateImportRef.current?.click()}
                className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              >
                Import
              </button>
            </div>
          </div>
          <input
            ref={templateImportRef}
            type="file"
            accept="application/json"
            onChange={handleImportTemplates}
            className="hidden"
          />
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {templates.length === 0 && (
                <EmptyState title="No templates yet" subtitle="Create a rubric template to standardize grading." />
              )}
              {templates.map((template) => (
                <div key={template.id} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-200">{template.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{template.description || 'No description'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditTemplate(template)}
                        className="text-xs px-2 py-1 rounded-full border border-slate-700 text-slate-300 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(template)}
                        className="text-xs px-2 py-1 rounded-full border border-red-500/40 text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">Type: {template.expectedType || 'llm'}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">
                {editingTemplateId ? 'Edit Template' : 'Create Template'}
              </div>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              />
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              />
              <select
                value={templateExpectedType}
                onChange={(e) => setTemplateExpectedType(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              >
                <option value="llm">LLM rubric</option>
                <option value="contains">Contains</option>
                <option value="regex">Regex</option>
              </select>
              <textarea
                value={templateRubric}
                onChange={(e) => setTemplateRubric(e.target.value)}
                placeholder="Rubric instructions"
                rows={4}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-4 py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-semibold"
                >
                  {editingTemplateId ? 'Save changes' : 'Create template'}
                </button>
                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={resetTemplateForm}
                    className="px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm border border-slate-700/60"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </motion.div>
  );
}
