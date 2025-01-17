import {ActionContext, ActionTree, Module} from 'vuex'
import {IRootState} from '@/store'
import {ICaseBlock} from '@floip/flow-runner/src/model/block/ICaseBlock'
import {cloneDeep} from 'lodash'
import {OutputBranchingType} from '@/components/interaction-designer/block-editors/BlockOutputBranchingConfig.model'
import BaseBlockStore, {actions as baseActions, IEmptyState} from '@/store/flow/block-types/BaseBlockStore'

export const BLOCK_TYPE = 'Core.Case'

const actions: ActionTree<IEmptyState, IRootState> = {
  ...baseActions,

  async createWith({getters, dispatch}, {props}: { props: { uuid: string } & Partial<ICaseBlock> }) {
    props.type = BLOCK_TYPE
    props.vendor_metadata = {
      floip: {
        ui_metadata: {
          branching_type: OutputBranchingType.ADVANCED,
        },
      },
    }
    return baseActions.createWith({getters, dispatch} as ActionContext<IEmptyState, IRootState>, {props})
  },
}

const Core_CaseBlockStore: Module<IEmptyState, IRootState> = {
  ...cloneDeep(BaseBlockStore),
  actions,
}

export default Core_CaseBlockStore
