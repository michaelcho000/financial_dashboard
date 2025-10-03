import React from 'react';

interface CostingErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface CostingErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class CostingErrorBoundary extends React.Component<CostingErrorBoundaryProps, CostingErrorBoundaryState> {
  constructor(props: CostingErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(): CostingErrorBoundaryState {
    return {
      hasError: true,
      error: null,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[CostingErrorBoundary] captured error', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null }, () => {
      if (this.props.onReset) {
        this.props.onReset();
      }
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center bg-gray-50 px-6 py-10">
          <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">원가 계산 중 오류가 발생했습니다</h2>
            <p className="mt-3 text-sm text-gray-600">
              입력하신 데이터나 네트워크 상태를 확인한 뒤 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                페이지 새로고침
              </button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left text-xs text-gray-500">
                <summary className="cursor-pointer font-medium text-gray-700">상세 오류 정보</summary>
                <pre className="mt-2 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CostingErrorBoundary;
