import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { useCostingBaselines } from '../../contexts/CostingBaselineContext';
import { useCostingServices } from '../../contexts/CostingServicesContext';
import { CostingResultRow, InsightPayload } from '../../services/costing/types';
import { formatCurrency, formatPercentage, formatMonth } from '../../utils/formatters';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

type SortField = 'margin' | 'marginRate' | 'salePrice' | 'caseCount';

type Summary = {
  cases: number;
  revenue: number;
  cost: number;
  margin: number;
};

type ChangeMetric = {
  current: number;
  previous: number;
  delta: number;
  ratio: number | null;
};

type MomSummary = {
  cases: ChangeMetric;
  revenue: ChangeMetric;
  cost: ChangeMetric;
  margin: ChangeMetric;
};

const resolveInsightRow = (rows: CostingResultRow[], indexValue?: string | null) => {
  if (!indexValue) {
    return null;
  }
  const index = Number(indexValue);
  if (Number.isNaN(index) || index < 0 || index >= rows.length) {
    return null;
  }
  return rows[index];
};

const buildSummary = (rows: CostingResultRow[]): Summary | null => {
  if (!rows.length) {
    return null;
  }
  return rows.reduce<Summary>(
    (acc, row) => {
      const caseCount = Number.isFinite(row.caseCount) ? row.caseCount : 0;
      return {
        cases: acc.cases + caseCount,
        revenue: acc.revenue + row.salePrice * caseCount,
        cost: acc.cost + row.totalCost * caseCount,
        margin: acc.margin + row.margin * caseCount,
      };
    },
    { cases: 0, revenue: 0, cost: 0, margin: 0 }
  );
};

const buildMomSummary = (current: Summary | null, previous: Summary | null): MomSummary | null => {
  if (!current || !previous) {
    return null;
  }
  const buildMetric = (curr: number, prev: number): ChangeMetric => ({
    current: curr,
    previous: prev,
    delta: curr - prev,
    ratio: prev === 0 ? null : (curr - prev) / prev,
  });
  return {
    cases: buildMetric(current.cases, previous.cases),
    revenue: buildMetric(current.revenue, previous.revenue),
    cost: buildMetric(current.cost, previous.cost),
    margin: buildMetric(current.margin, previous.margin),
  };
};

const formatChange = (value: number, asCurrency: boolean): string => {
  if (asCurrency) {
    return formatCurrency(value);
  }
  return numberFormatter.format(value);
};

const CostingResultsPage: React.FC = () => {
  const {
    baselines,
    selectedBaselineId,
    selectedBaseline,
    loading: baselineLoading,
    refreshBaselines,
  } = useCostingBaselines();
  const { calculationService } = useCostingServices();

  const [activeTab, setActiveTab] = useState<'table' | 'insights'>('table');

  const [allRows, setAllRows] = useState<CostingResultRow[]>([]);
  const [insights, setInsights] = useState<InsightPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('margin');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [recalculating, setRecalculating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [compareBaselineId, setCompareBaselineId] = useState<string | null>(null);
  const [compareRows, setCompareRows] = useState<CostingResultRow[] | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const loadResults = useCallback(async (baselineId: string) => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const [rows, insightData] = await Promise.all([
        calculationService.getResults(baselineId),
        calculationService.getInsights(baselineId),
      ]);
      setAllRows(rows);
      setInsights(insightData);
    } catch (err) {
      console.error('[Costing] Failed to load results', err);
      setError('Unable to load costing results. Please retry.');
      setAllRows([]);
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, [calculationService]);

  const loadCompareResults = useCallback(async (baselineId: string) => {
    setCompareLoading(true);
    setCompareError(null);
    try {
      const rows = await calculationService.getResults(baselineId);
      setCompareRows(rows);
    } catch (err) {
      console.error('[Costing] Failed to load comparison results', err);
      setCompareError('Unable to load comparison baseline data.');
      setCompareRows(null);
    } finally {
      setCompareLoading(false);
    }
  }, [calculationService]);

  useEffect(() => {
    if (!selectedBaselineId) {
      setAllRows([]);
      setInsights(null);
      setError(null);
      setInfoMessage(null);
      return;
    }
    loadResults(selectedBaselineId);
  }, [selectedBaselineId, loadResults]);

  const lockedBaselines = useMemo(
    () => baselines.filter(baseline => baseline.status === 'LOCKED' && baseline.id !== selectedBaselineId),
    [baselines, selectedBaselineId]
  );

  useEffect(() => {
    if (!selectedBaseline) {
      setCompareBaselineId(null);
      return;
    }

    if (!lockedBaselines.length) {
      setCompareBaselineId(null);
      return;
    }

    const previousLocked = lockedBaselines
      .filter(baseline => baseline.month < selectedBaseline.month)
      .sort((a, b) => b.month.localeCompare(a.month))[0] ?? lockedBaselines[0];

    setCompareBaselineId(prev => {
      if (prev && lockedBaselines.some(baseline => baseline.id === prev)) {
        return prev;
      }
      return previousLocked?.id ?? null;
    });
  }, [lockedBaselines, selectedBaseline]);

  useEffect(() => {
    if (!compareBaselineId) {
      setCompareRows(null);
      setCompareError(null);
      return;
    }
    loadCompareResults(compareBaselineId);
  }, [compareBaselineId, loadCompareResults]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (debouncedSearch) {
      const keyword = debouncedSearch.toLowerCase();
      rows = rows.filter(row =>
        row.procedureName.toLowerCase().includes(keyword) ||
        row.variantName.toLowerCase().includes(keyword)
      );
    }
    return [...rows].sort((a, b) => {
      const direction = sortOrder === 'desc' ? -1 : 1;
      switch (sortField) {
        case 'marginRate':
          return ((a.marginRate ?? 0) - (b.marginRate ?? 0)) * direction;
        case 'salePrice':
          return (a.salePrice - b.salePrice) * direction;
        case 'caseCount':
          return (a.caseCount - b.caseCount) * direction;
        case 'margin':
        default:
          return (a.margin - b.margin) * direction;
      }
    });
  }, [allRows, debouncedSearch, sortField, sortOrder]);

  const filteredSummary = useMemo(() => buildSummary(filteredRows), [filteredRows]);
  const baselineSummary = useMemo(() => buildSummary(allRows), [allRows]);
  const comparisonSummary = useMemo(() => buildSummary(compareRows ?? []), [compareRows]);
  const momSummary = useMemo(() => buildMomSummary(baselineSummary, comparisonSummary), [baselineSummary, comparisonSummary]);
  const momMetrics = useMemo(() => {
    if (!momSummary) {
      return [] as Array<{ label: string; metric: ChangeMetric; asCurrency: boolean }>;
    }
    return [
      { label: 'Case Count', metric: momSummary.cases, asCurrency: false },
      { label: 'Revenue', metric: momSummary.revenue, asCurrency: true },
      { label: 'Total Cost', metric: momSummary.cost, asCurrency: true },
      { label: 'Total Margin', metric: momSummary.margin, asCurrency: true },
    ];
  }, [momSummary]);

  const topByVolumeRow = useMemo(() => resolveInsightRow(allRows, insights?.topByVolume?.procedureId), [allRows, insights]);
  const topByMarginRow = useMemo(() => resolveInsightRow(allRows, insights?.topByMargin?.procedureId), [allRows, insights]);
  const lowestMarginRateRow = useMemo(() => resolveInsightRow(allRows, insights?.lowestMarginRate?.procedureId), [allRows, insights]);

  const handleRecalculate = async () => {
    if (!selectedBaselineId) {
      return;
    }
    setRecalculating(true);
    setError(null);
    setInfoMessage(null);
    try {
      await calculationService.recalculate(selectedBaselineId);
      await Promise.all([refreshBaselines(), loadResults(selectedBaselineId)]);
      setInfoMessage('Recalculation completed successfully.');
    } catch (err) {
      console.error('[Costing] Failed to recalculate results', err);
      setError('Recalculation failed. Check input data and try again.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleExport = async () => {
    if (!selectedBaselineId) {
      return;
    }
    setExporting(true);
    setError(null);
    setInfoMessage(null);
    try {
      const blob = await calculationService.exportResults(selectedBaselineId, 'csv');
      if (typeof window !== 'undefined' && typeof document !== 'undefined' && blob instanceof Blob) {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${selectedBaseline?.month ?? 'baseline'}-costing-results.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
        setInfoMessage('Exported results to CSV.');
      } else {
        console.warn('[Costing] Unexpected export payload', blob);
        setInfoMessage('Generated CSV payload. Handle manually in this environment.');
      }
    } catch (err) {
      console.error('[Costing] Failed to export results', err);
      setError('Export failed. Verify your connection and retry.');
    } finally {
      setExporting(false);
    }
  };

  if (baselineLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Loading baseline information...
      </div>
    );
  }

  if (!selectedBaselineId) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
        Select a baseline to view costing results and insights.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Baseline Overview</h2>
            <p className="text-sm text-gray-600">
              {selectedBaseline?.month ? formatMonth(selectedBaseline.month) : 'No month selected'} · Last calculation:
              {' '}
              {selectedBaseline?.lastCalculatedAt ? new Date(selectedBaseline.lastCalculatedAt).toLocaleString() : 'Not run'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={recalculating}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${recalculating ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {recalculating ? 'Recalculating...' : 'Recalculate'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !allRows.length}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${exporting || !allRows.length ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
        {infoMessage && (
          <p className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{infoMessage}</p>
        )}
        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}
        {!allRows.length && !loading && !error && (
          <p className="mt-4 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
            No calculated results yet. Complete baseline configuration and run recalculation.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            Procedure Cost Table
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === 'insights' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            Monthly Insights
          </button>
        </div>
      </section>

      {activeTab === 'table' ? (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Procedure Cost Table</h2>
              <p className="text-sm text-gray-600">
                Review revenue, cost, and margin per procedure variant with filtering and sorting controls.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search by procedure or variant"
                className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm"
                type="search"
              />
              <select
                value={sortField}
                onChange={event => setSortField(event.target.value as SortField)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="margin">Margin</option>
                <option value="marginRate">Margin Rate</option>
                <option value="salePrice">Sale Price</option>
                <option value="caseCount">Case Count</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                {sortOrder === 'desc' ? 'Sort: Desc' : 'Sort: Asc'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-md border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
              Loading calculation results...
            </div>
          ) : filteredRows.length ? (
            <div className="mt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Procedure</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Case Count</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Margin Rate</TableHead>
                    <TableHead className="text-right">Margin per Minute</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => (
                    <TableRow key={`${row.procedureName}-${row.variantName}-${index}`}>
                      <TableCell>{row.procedureName}</TableCell>
                      <TableCell>{row.variantName}</TableCell>
                      <TableCell className="text-right">{numberFormatter.format(row.caseCount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.salePrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.totalCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.margin)}</TableCell>
                      <TableCell className="text-right">{formatPercentage((row.marginRate ?? 0) * 100)}</TableCell>
                      <TableCell className="text-right">
                        {row.marginPerMinute === null || Number.isNaN(row.marginPerMinute)
                          ? '-'
                          : formatCurrency(row.marginPerMinute)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mt-6 rounded-md border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
              No results match the current filters. Adjust search or sorting criteria.
            </div>
          )}

          {filteredSummary && (
            <div className="mt-6 grid gap-3 rounded-md border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-4">
              <div>
                <span className="block text-xs text-gray-500">Total Case Count</span>
                <span className="text-base font-semibold text-gray-900">{numberFormatter.format(filteredSummary.cases)}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-500">Total Revenue (cases applied)</span>
                <span className="text-base font-semibold text-gray-900">{formatCurrency(filteredSummary.revenue)}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-500">Total Cost (cases applied)</span>
                <span className="text-base font-semibold text-gray-900">{formatCurrency(filteredSummary.cost)}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-500">Total Margin (cases applied)</span>
                <span className="text-base font-semibold text-gray-900">{formatCurrency(filteredSummary.margin)}</span>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Monthly Insights</h2>
                <p className="text-sm text-gray-600">
                  Summaries of key procedures and month-over-month movement for the selected baseline.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-gray-600">Comparison Baseline</label>
                <select
                  value={compareBaselineId ?? ''}
                  onChange={event => setCompareBaselineId(event.target.value || null)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={!lockedBaselines.length}
                >
                  <option value="">(None)</option>
                  {lockedBaselines.map(baseline => (
                    <option key={baseline.id} value={baseline.id}>
                      {formatMonth(baseline.month)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700">Most Performed Procedure</h3>
                {topByVolumeRow ? (
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p className="text-base font-semibold text-gray-900">{topByVolumeRow.procedureName}</p>
                    <p className="text-sm text-gray-500">{topByVolumeRow.variantName}</p>
                    <p className="text-xs text-gray-500">Case Count: {numberFormatter.format(topByVolumeRow.caseCount)}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">Insufficient data to identify a top procedure.</p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700">Highest Margin Procedure</h3>
                {topByMarginRow ? (
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p className="text-base font-semibold text-gray-900">{topByMarginRow.procedureName}</p>
                    <p className="text-sm text-gray-500">{topByMarginRow.variantName}</p>
                    <p className="text-xs text-gray-500">Margin: {formatCurrency(topByMarginRow.margin)}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">Insufficient data to identify a margin leader.</p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700">Lowest Margin Rate Alert</h3>
                {lowestMarginRateRow ? (
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p className="text-base font-semibold text-gray-900">{lowestMarginRateRow.procedureName}</p>
                    <p className="text-sm text-gray-500">{lowestMarginRateRow.variantName}</p>
                    <p className="text-xs text-gray-500">Margin Rate: {formatPercentage((lowestMarginRateRow.marginRate ?? 0) * 100)}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">Insufficient data to determine a risk alert.</p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Month-over-Month Comparison</h3>
              {!lockedBaselines.length ? (
                <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                  Lock at least one previous baseline to enable comparison data.
                </p>
              ) : compareBaselineId && compareLoading ? (
                <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                  Loading comparison baseline data...
                </p>
              ) : compareError ? (
                <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{compareError}</p>
              ) : momSummary ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">Current Baseline</TableHead>
                        <TableHead className="text-right">Comparison Baseline</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                        <TableHead className="text-right">Change %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {momMetrics.map(item => (
                        <TableRow key={item.label}>
                          <TableCell>{item.label}</TableCell>
                          <TableCell className="text-right">{formatChange(item.metric.current, item.asCurrency)}</TableCell>
                          <TableCell className="text-right">{formatChange(item.metric.previous, item.asCurrency)}</TableCell>
                          <TableCell className="text-right">{formatChange(item.metric.delta, item.asCurrency)}</TableCell>
                          <TableCell className="text-right">
                            {item.metric.ratio === null ? 'N/A' : formatPercentage(item.metric.ratio * 100)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                  Select a comparison baseline to view month-over-month deltas.
                </p>
              )}
            </div>

            {insights?.mom && (
              <div className="mt-4 grid gap-4 rounded-md border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-2">
                <div>
                  <span className="block text-xs text-gray-500">MoM Case Change</span>
                  <span className="text-base font-semibold text-gray-900">
                    {insights.mom.volume?.change === null || insights.mom.volume === undefined
                      ? 'N/A'
                      : `${numberFormatter.format(insights.mom.volume.change)} (${insights.mom.volume.previous ? formatPercentage((insights.mom.volume.change / insights.mom.volume.previous) * 100) : 'N/A'})`}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">MoM Margin Change</span>
                  <span className="text-base font-semibold text-gray-900">
                    {insights.mom.margin?.change === null || insights.mom.margin === undefined
                      ? 'N/A'
                      : `${formatCurrency(insights.mom.margin.change)} (${insights.mom.margin.previous ? formatPercentage((insights.mom.margin.change / insights.mom.margin.previous) * 100) : 'N/A'})`}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
              <p className="mt-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Capture key observations, action items, or risk flags here. This placeholder aligns with the PRD requirement and can evolve into a collaborative note feature later.
              </p>
              <p className="mt-1 text-xs text-gray-400">Placeholder aligned with PRD section 9.3.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default CostingResultsPage;

