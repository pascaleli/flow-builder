import {ActionContext, GetterTree, Module, MutationTree} from 'vuex'
import {IRootState} from '@/store'
import {IBlock, IBlockExit} from '@floip/flow-runner'
import {defaultsDeep} from 'lodash'
import {IValidationStatus, validateBlockWithJsonSchema} from '@/store/validation'
import {ValidationResults} from '@/lib/validations'
import {ErrorObject} from 'ajv'
import Lang from '@/lib/filters/lang'

export interface IEmptyState {}

export const getters: GetterTree<IEmptyState, IRootState> = {
  /**
   * Compute the primary exit test.
   * We can override this from block type store, or from the consumer side.
   *
   * We're sending the blockProps because we might need them for customization
   */
  primaryExitTest: () => (_blockProps: Partial<IBlock>) => undefined,
}

export const mutations: MutationTree<IEmptyState> = {}

// noinspection JSUnusedLocalSymbols
export const actions = {
  async createWith(
    {getters, dispatch}: ActionContext<IEmptyState, IRootState>,
    {props}: { props: { uuid: string } & Partial<IBlock> },
  ): Promise<IBlock> {
    const vendorMetadata = {
      vendor_metadata: await dispatch('initiateExtraVendorConfig'),
    }

    const defaultProps = {
      // Default props if not provided yet
      type: '',
      name: '',
      label: '',
      semantic_label: '',
      config: {},
      tags: [],
      vendor_metadata: {
        floip: {
          ui_metadata: {
            branching_type: 'UNIFIED',
            should_auto_update_name: true,
          },
        },
      },
    }

    const mainProps = defaultsDeep({}, vendorMetadata, props, defaultProps)

    // Define exits after we have the whole final props, this is important for dynamic test value
    if (props?.exits === undefined) {
      mainProps.exits = await Promise.all(
        (await dispatch('flow/block_generateExitsBasedOnUiConfig', {
          blockType: props.type,
          primaryExitTest: getters.primaryExitTest(mainProps),
        }, {root: true}))
          .map(async (exit: IBlockExit) => ({
            ...exit,
            vendor_metadata: await dispatch('initiateExtraVendorExitMetadata', {exit}),
          })) as Promise<IBlockExit>[],
      )
    }

    return mainProps
  },

  /**
   * This will be the default standard exit mode,
   * but we can override it in the specific block store (eg: for dynamic test generation in MCQ)
   */
  async handleBranchingTypeChangedToUnified(
    {dispatch, getters, rootGetters}: ActionContext<IEmptyState, IRootState>,
    {block}: {block: IBlock},
  ): Promise<void> {
    if (rootGetters['flow/block_shouldHave2Exits'](block.type) === true) {
      await dispatch('flow/block_resetBranchingExitsByCollapsingNonDefault', {
        blockId: block.uuid,
        primaryExitTest: getters.primaryExitTest(block),
      }, {root: true})
    } else {
      await dispatch('flow/block_resetBranchingExitsToDefaultOnly', {
        blockId: block.uuid,
      }, {root: true})
    }
  },

  /**
   * Override this method in the consumer side to add extra config attributes
   * to avoid the validation saying we have missing prop at the creation.
   *
   * Remember to namespace the fields, e.g.:
   *
   * return {
   *   org_example: {
   *     foo: 1,
   *     bar: 'baz',
   *   },
   * }
   */
  async initiateExtraVendorConfig(_ctx: unknown): Promise<object> {
    return {}
  },

  /**
   * Override this method on the consumer side to add extra vendor metadata to an exit
   *
   * @param _ctx
   * @param exit
   *
   * @returns {Promise<Partial<IBlockExit['vendor_metadata']>>}
   */
   async initiateExtraVendorExitMetadata(_ctx: unknown, {exit}: {exit: IBlockExit}): Promise<IBlockExit['vendor_metadata']> {
    return {}
  },

  /**
   * Validate the Consumer block
   * By overriding this action in the consumer side, we will be able to customize it using different json schema for eg.
   *
   * Important: This will be overridden in the consumer side, so DO NOT add generic validations here,
   * instead edit the `validate()` if needed.
   */
  async validateBlockWithCustomJsonSchema(
    _ctx: unknown,
    {block, schemaVersion}: {block: IBlock, schemaVersion: string},
  ): Promise<IValidationStatus> {
    console.debug('floip/BaseBlockStore/validateBlockWithCustomJsonSchema()', `${block.type}`)
    // we can provide the customBlockJsonSchema option for validateBlockWithJsonSchema when overriding this validateBlockWithCustomJsonSchema
    return validateBlockWithJsonSchema({block, schemaVersion})
  },

  /**
   * Validate the Consumer block
   * By overriding this action in the consumer side, we will be able to customize it using different json schema for eg.
   *
   * Important: This will be overridden in the consumer side, so DO NOT add generic validations here,
   * instead edit the `validate()` if needed.
   */
  async validateWithProgrammaticLogic(
    _ctx: unknown,
    {block}: {block: IBlock},
  ): Promise<ValidationResults> {
    console.debug('floip/BaseBlockStore/validateWithProgrammaticLogic()', `${block.type}`)
    return [] as ValidationResults
  },

  /**
   * Override this in block stores if needed, it's not recommended though.
   * For customization, let's try to override the 02 actions validateBlockWithCustomJsonSchema & validateWithProgrammaticLogic instead
   */
  async validate(
    {dispatch}: ActionContext<IEmptyState, IRootState>,
    {block, schemaVersion}: {block: IBlock, schemaVersion: string},
  ): Promise<IValidationStatus> {
    console.debug('floip/BaseBlockStore/validate()', `${block.type}`)
    // Validation based on JsonSchema
    const validationStatus: IValidationStatus = await dispatch('validateBlockWithCustomJsonSchema', {block, schemaVersion})

    // Validation based on programmatic logic
    const dataPaths = new Set(validationStatus.ajvErrors?.map((error: ErrorObject) => error.dataPath))
    const validationResults: ValidationResults = await dispatch('validateWithProgrammaticLogic', {block})

    validationResults.forEach(([dataPath, suffix]) => {
      if (!dataPaths.has(dataPath)) {
        dataPaths.add(dataPath)

        validationStatus.ajvErrors = validationStatus.ajvErrors || []
        validationStatus.ajvErrors.push({
          dataPath,
          message: Lang.trans(`flow-builder-validation.${suffix}`),
        } as ErrorObject)
      }
    })

    if ((validationStatus.ajvErrors?.length ?? 0) > 0) {
      validationStatus.isValid = false
    }

    return validationStatus
  },

  /**
   * Override this method on the consumer side to react to another block's changes,
   * e.g. to update expressions that reference the modified block: "@(flow.myBlockNameThatChanged)"
   * @param context
   * @param thisBlock, listening block
   * @param oldBlock, deep clone of the modified block before the change
   * @param newBlock, deep clone of the modified block after the change, null if the block was deleted
   */
  async maybeHandleAnotherBlockChange(
    context: ActionContext<IEmptyState, IRootState>,
    {thisBlock, oldBlock, newBlock}: {thisBlock: IBlock, oldBlock: IBlock, newBlock: IBlock | null},
  ): Promise<void> {},
}

const BaseBlockStore: Module<IEmptyState, IRootState> = {
  namespaced: true,
  getters,
  mutations,
  actions,
}

export default BaseBlockStore
