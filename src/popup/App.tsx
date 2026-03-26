/**
 * ルートコンポーネント
 */

import type { FC } from "react";
import { PermissionProvider, usePermissionStore } from "./stores/permission-store";
import { useSfSession } from "./hooks/useSfSession";
import { useFieldMetadata } from "./hooks/useFieldMetadata";
import { usePermissions } from "./hooks/usePermissions";
import { Header } from "./components/Header";
import { ObjectSelector } from "./components/ObjectSelector";
import { MatrixView } from "./components/MatrixView";

const AppContent: FC = () => {
  const { state, dispatch } = usePermissionStore();
  const { status, error, reconnect } = useSfSession();
  const {
    objects,
    permissionSets,
    selectedObjectApiName,
    loading,
    loadingMessage,
    loadFieldsForObject,
  } = useFieldMetadata();
  const {
    matrix,
    pendingChanges,
    pendingCount,
    saving,
    lastSaveResult,
    togglePermission,
    saveChanges,
    cancelChanges,
  } = usePermissions();

  return (
    <div className="w-[800px] h-[600px] flex flex-col bg-zinc-900 text-zinc-100 overflow-hidden">
      <Header
        status={status}
        sfHost={state.session?.sfHost ?? null}
        error={error}
        onReconnect={reconnect}
      />

      {/* 未接続時の案内 */}
      {status === "disconnected" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-zinc-400 text-sm max-w-xs">
            <p className="mb-2">Salesforceに接続されていません</p>
            <p className="text-xs text-zinc-500">
              Salesforceにログインした状態でこの拡張機能を開いてください
            </p>
          </div>
        </div>
      )}

      {/* 接続中 */}
      {status === "connecting" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-zinc-400 animate-pulse">接続中...</div>
        </div>
      )}

      {/* 接続済み */}
      {status === "connected" && (
        <>
          <ObjectSelector
            objects={objects}
            permissionSets={permissionSets}
            selectedObjectApiName={selectedObjectApiName}
            selectedPermissionSetIds={state.selectedPermissionSetIds}
            onSelectObject={loadFieldsForObject}
            onSelectPermissionSets={(ids) =>
              dispatch({ type: "SELECT_PERMISSION_SETS", ids })
            }
          />

          {/* ローディング */}
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-zinc-400 animate-pulse">
                {loadingMessage ?? "読み込み中..."}
              </div>
            </div>
          )}

          {/* マトリクス */}
          {!loading && matrix && (
            <MatrixView
              matrix={matrix}
              pendingChanges={pendingChanges}
              pendingCount={pendingCount}
              saving={saving}
              lastSaveResult={lastSaveResult}
              onTogglePermission={togglePermission}
              onSave={saveChanges}
              onCancel={cancelChanges}
            />
          )}

          {/* オブジェクト未選択時 */}
          {!loading && !matrix && selectedObjectApiName === null && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-zinc-500">
                オブジェクトを選択してください
              </div>
            </div>
          )}
        </>
      )}

      {/* エラー */}
      {status === "error" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-sm max-w-xs">
            <p className="text-red-400 mb-2">接続エラー</p>
            <p className="text-xs text-zinc-500">{error}</p>
            <button
              onClick={reconnect}
              className="mt-3 px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              再接続
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const App: FC = () => {
  return (
    <PermissionProvider>
      <AppContent />
    </PermissionProvider>
  );
};

export default App;
