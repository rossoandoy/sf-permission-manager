/**
 * Dashboard ルートコンポーネント — フルページ3ペインレイアウト
 */

import type { FC } from "react";
import { PermissionProvider, usePermissionStore } from "./stores/permission-store";
import { useSfSession } from "./hooks/useSfSession";
import { useFieldMetadata } from "./hooks/useFieldMetadata";
import { usePermissions } from "./hooks/usePermissions";
import { Header } from "./components/Header";
import { TabNav } from "./components/TabNav";
import { ObjectSidebar } from "./components/ObjectSidebar";
import { MatrixView } from "./components/MatrixView";
import { StatusBar } from "./components/StatusBar";

const DashboardContent: FC = () => {
  const { state, dispatch } = usePermissionStore();
  const { status, error, reconnect } = useSfSession();
  const {
    objects,
    permissionSets,
    selectedObjectApiName,
    detectedObjectApiName,
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

  const selectedObject = selectedObjectApiName
    ? objects.find((o) => o.apiName === selectedObjectApiName) ?? null
    : null;

  return (
    <div className="h-screen flex flex-col bg-zinc-900 text-zinc-100 overflow-hidden">
      <Header
        status={status}
        sfHost={state.session?.sfHost ?? null}
        error={error}
        onReconnect={reconnect}
      />

      {(status === "disconnected" || status === "error") && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔗</span>
            </div>
            <p className="text-base text-zinc-300 mb-2">
              {status === "error" ? "接続エラー" : "Salesforceに接続されていません"}
            </p>
            <p className="text-sm text-zinc-500 mb-4">
              {error ?? "Salesforceにログインした状態でこの拡張機能を使用してください"}
            </p>
            <button
              onClick={reconnect}
              className="px-6 py-2.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              再接続
            </button>
          </div>
        </div>
      )}

      {status === "connecting" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-base text-zinc-400">接続中...</span>
          </div>
        </div>
      )}

      {status === "connected" && (
        <>
          <div className="flex flex-1 min-h-0">
            <ObjectSidebar
              objects={objects}
              selectedObjectApiName={selectedObjectApiName}
              detectedObjectApiName={detectedObjectApiName}
              onSelectObject={loadFieldsForObject}
            />

            <div className="flex-1 flex flex-col min-w-0">
              <TabNav
                activeTab={state.activeTab}
                onTabChange={(tab) =>
                  dispatch({ type: "SET_ACTIVE_TAB", tab })
                }
              />

              {loading && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-zinc-400">
                      {loadingMessage ?? "読み込み中..."}
                    </span>
                  </div>
                </div>
              )}

              {!loading && matrix && state.activeTab === "matrix" && (
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

              {!loading && !matrix && selectedObjectApiName === null && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-3 opacity-20">◧</div>
                    <p className="text-sm text-zinc-500">
                      左のリストからオブジェクトを選択してください
                    </p>
                  </div>
                </div>
              )}

              {!loading && (state.activeTab === "gaps" || state.activeTab === "diff") && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-zinc-500">Coming soon</p>
                </div>
              )}
            </div>
          </div>

          <StatusBar
            objectLabel={selectedObject?.label ?? null}
            fieldCount={matrix?.fields.filter((f) => f.isCustom).length ?? 0}
            objectCount={objects.length}
            permissionSetCount={permissionSets.length}
          />
        </>
      )}
    </div>
  );
};

const App: FC = () => {
  return (
    <PermissionProvider>
      <DashboardContent />
    </PermissionProvider>
  );
};

export default App;
