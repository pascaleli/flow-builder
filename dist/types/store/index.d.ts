import { StoreOptions } from 'vuex';
import { IClipboardState } from '../store/clipboard';
import { IUndoRedoState } from './undoRedo';
import { IFlowsState } from './flow';
import { IBuilderState } from './builder';
import { IValidationState } from './validation';
export interface IRootState {
    builder: IBuilderState;
    flow: IFlowsState;
    validation: IValidationState;
    trees: any;
    audio: any;
    clipboard: IClipboardState;
    undoRedo: IUndoRedoState;
}
export declare const store: StoreOptions<IRootState>;
export default store;
