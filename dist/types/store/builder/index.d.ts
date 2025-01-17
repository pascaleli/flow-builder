import Vue from 'vue';
import { ActionTree, GetterTree, Module, MutationTree } from 'vuex';
import { IRootState } from '../../store';
import { IBlock, IBlockExit, IBlockUIMetadataCanvasCoordinates } from '@floip/flow-runner';
import { IDeepBlockExitIdWithinFlow } from '../../store/flow/block';
export declare const SAVING_ANIMATION_DURATION = 1000;
export declare enum OperationKind {
    CONNECTION_CREATE = "CONNECTION_CREATE",
    BLOCK_RELOCATE = "BLOCK_RELOCATE"
}
export interface IConnectionCreateOperation {
    kind: OperationKind.CONNECTION_CREATE;
    data: null | {
        source: IDeepBlockExitIdWithinFlow;
        position: IPosition;
        targetId: IBlock['uuid'] | null;
    };
}
export interface IConnectionContext {
    sourceId: IBlock['uuid'];
    targetId: IBlock['uuid'];
    exitId: IBlockExit['uuid'];
}
export declare type SupportedOperation = IConnectionCreateOperation;
export interface IPosition {
    x: number;
    y: number;
}
declare type Draggable = any;
export interface IBuilderState {
    activeBlockId: IBlock['uuid'] | null;
    isEditable: boolean;
    activeMainComponent?: string;
    hasFlowChanges: boolean;
    activeConnectionsContext: IConnectionContext[];
    operations: {
        [OperationKind.CONNECTION_CREATE]: IConnectionCreateOperation;
        [OperationKind.BLOCK_RELOCATE]: null;
    };
    draggableForExitsByUuid: Record<string, Draggable>;
    isBlockEditorOpen: boolean;
    interactionDesignerHeaderBoundingClientRect: DOMRect;
    isConnectionCreationInProgress: boolean;
}
export declare const stateFactory: () => IBuilderState;
export declare type ConnectionLayout = any[];
export declare const getters: GetterTree<IBuilderState, IRootState>;
export declare const mutations: MutationTree<IBuilderState>;
export declare const actions: ActionTree<IBuilderState, IRootState>;
export declare const store: Module<IBuilderState, IRootState>;
export default store;
export declare function createDefaultBlockTypeInstallerFor(blockType: IBlock['type'], storeForBlockType: Module<any, IRootState>): (builder: Vue) => true | void;
export declare function generateConnectionLayoutKeyFor(source: IBlock, target: IBlock): ConnectionLayout;
export declare function computeBlockCanvasCoordinates(block?: IBlock | null): IBlockUIMetadataCanvasCoordinates;
export declare function getViewportCenter(): IPosition;
