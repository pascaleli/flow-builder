import {ActionContext, ActionTree, GetterTree, Module, MutationTree} from 'vuex'
import {IRootState} from '@/store'
import {IChoice, findBlockWith, IBlock, IBlockExit, IResource, ValidationException} from '@floip/flow-runner'
import {IdGeneratorUuidV4} from '@floip/flow-runner/dist/domain/IdGeneratorUuidV4'
import {ISelectOneResponseBlock} from '@floip/flow-runner/dist/model/block/ISelectOneResponseBlock'
import Vue from 'vue'
import {cloneDeep, find, reject} from 'lodash'
import BaseBlockStore, {
  actions as baseActions,
  mutations as baseMutations,
  getters as baseGetters,
  IEmptyState,
} from '@/store/flow/block-types/BaseBlockStore'
import {ValidationResults} from '@/lib/validations'
import {OutputBranchingType} from '@/components/interaction-designer/block-editors/BlockOutputBranchingConfig.model'
import * as ChoiceModule from '@/store/flow/block/choice'
import {escapeQuotes} from '@/components/interaction-designer/block-editors/choices/expressionTransformers'

export const BLOCK_TYPE = 'MobilePrimitives.SelectOneResponse'

export const getters: GetterTree<IEmptyState, IRootState> = {
  ...baseGetters,
  ...ChoiceModule.getters,
}

export const mutations: MutationTree<IEmptyState> = {
  ...baseMutations,
  ...ChoiceModule.mutations,
}

const actions: ActionTree<IEmptyState, IRootState> = {
  ...baseActions,
  ...ChoiceModule.actions,

  addChoiceByResourceIdTo({rootGetters}, {blockId, resourceId}: { blockId: IBlock['uuid'], resourceId: IResource['uuid'] }) {
    const block: ISelectOneResponseBlock = findBlockWith(blockId, rootGetters['flow/activeFlow']) as ISelectOneResponseBlock
    const resource: IResource = rootGetters['flow/resourcesByUuidOnActiveFlow'][resourceId]

    if (resource == null) {
      throw new ValidationException(`Unable to find resource for choice: ${resourceId}`)
    }

    // Do not attribute the resource if it has been done already
    const existingChoiceByResource = find(block.config.choices, {prompt: resource.uuid})
    if (existingChoiceByResource === undefined) {
      const allChoices = block.config.choices
      allChoices.push({
        prompt: resource.uuid,
      } as IChoice)
    }
  },

  deleteChoiceByResourceIdFrom({dispatch, rootGetters}, {blockId, resourceId}: { blockId: IBlock['uuid'], resourceId: IResource['uuid'] }) {
    const block: ISelectOneResponseBlock = findBlockWith(blockId, rootGetters['flow/activeFlow']) as ISelectOneResponseBlock
    const newChoices = reject(block.config.choices, v => v.prompt === resourceId)
    Vue.set(block.config, 'choices', newChoices)

    if (block.vendor_metadata?.floip?.ui_metadata?.set_contact_property?.property_value_mapping !== undefined) {
      Vue.delete(block.vendor_metadata.floip.ui_metadata.set_contact_property.property_value_mapping, resourceId)
    }

    dispatch('flow/block_updateContactPropertyAfterChoicesChange', {
      blockId,
    }, {root: true})
  },

  async reflowExitsFromChoices({dispatch, rootGetters}, {blockId}: { blockId: IBlock['uuid'] }) {
    const block: ISelectOneResponseBlock = findBlockWith(blockId, rootGetters['flow/activeFlow']) as ISelectOneResponseBlock
    const {config: {choices}, exits}: ISelectOneResponseBlock = block

    // non-default exits; default should always be last
    let exitsForChoices: IBlockExit[] = exits.slice(0, -1)

    // reflow exits based on choices
    await Promise.all(choices.map(async (choice, i) => {
      // create new exit if it doesn't exist yet
      if (exitsForChoices[i] == null) {
        const uuid = await (new IdGeneratorUuidV4()).generate()
        const exit: IBlockExit = await dispatch('flow/block_createBlockExitWith', {props: {uuid} as IBlockExit}, {root: true})
        exitsForChoices.push(exit)
      }

      Object.assign(exitsForChoices[i], {
        name: choice.name,
        test: `@block.value = '${escapeQuotes(choice.name)}'`,
      })
    }))

    // delete exits if not present in choices
    exitsForChoices = reject(exitsForChoices, exit => {
      const checkExist = find(choices, c => c.name === exit.name) === undefined

      if (checkExist === true) {
        console.debug('removing exit named', exit.name)
      }

      return checkExist
    })

    exits.splice(0, exits.length - 1, ...exitsForChoices)
  },

  /**
   * Set choice's ivr expression on a given index
   */
  block_setChoiceIvrExpressionOnIndex(
    {commit, state, dispatch},
    {blockId, index, value}: { blockId: string, index: number, value: string },
  ) {
    commit('flow/block_updateConfigByPath', {
      blockId,
      path: `choices.[${index}].ivr_test.test_expression`,
      value,
    }, {root: true})
  },

  async createWith({getters, dispatch}, {props}: { props: { uuid: string } & Partial<ISelectOneResponseBlock> }) {
    props.type = BLOCK_TYPE
    const blankPromptResource = await dispatch('flow/flow_addBlankResourceForEnabledModesAndLangs', null, {root: true})
    props.config = {
      prompt: blankPromptResource.uuid,
      choices: [],
    }
    props.vendor_metadata = {
      floip: {
        ui_metadata: {
          branching_type: OutputBranchingType.EXIT_PER_CHOICE,
          choices: {
            // Prompt UUID -> ISelectOneResponseFloipUiMetadataChoice
          },
        },
      },
    }
    return baseActions.createWith({getters, dispatch} as ActionContext<IEmptyState, IRootState>, {props})
  },

  async validateWithProgrammaticLogic(
    _ctx: unknown,
    {block}: {block: ISelectOneResponseBlock},
  ): Promise<ValidationResults> {
    console.debug('floip/SelectOneResponse/validateWithProgrammaticLogic()', `${block.type}`)
    const errors: ValidationResults = []
    const choiceValidationKey = '/config/choices'

    // validationMax must be greater than validationMin
    const allIvrTestExpressions = block.config.choices.map(choice => choice.ivr_test?.test_expression)
    const duplicates = allIvrTestExpressions.filter(
      (item, index) => item !== undefined && allIvrTestExpressions.indexOf(item) !== index,
    )
    if (duplicates.length > 0) {
      errors.push([choiceValidationKey, 'duplicate-ivr-test-test_expression'])
    }

    // should not have duplicate choices
    const allChoiceNames = block.config.choices.map(choice => choice.name)
    const duplicatedChoiceNames = allChoiceNames.filter(
      (item, index) => item !== undefined && allChoiceNames.indexOf(item) !== index,
    )
    if (duplicatedChoiceNames.length > 0) {
      errors.push([choiceValidationKey, 'duplicate-choice-names'])
    }

    return errors
  },
}

const MobilePrimitives_SelectOneResponseBlockStore: Module<IEmptyState, IRootState> = {
  ...cloneDeep(BaseBlockStore),
  getters,
  mutations,
  actions,
}

export default MobilePrimitives_SelectOneResponseBlockStore
