import {IRootState} from '@/store'
import {
  findBlockOnActiveFlowWith as findBlock,
  IBlock,
  IChoice,
  IContext,
  ISelectOneResponseBlockConfig,
  SetContactProperty,
} from '@floip/flow-runner'
import {ActionTree, GetterTree, MutationTree} from 'vuex'
import {IFlowsState} from '../index'
import Vue from 'vue'
import {choicesToExpression} from '@/components/interaction-designer/block-editors/choices/expressionTransformers'
import {ISelectOneResponseBlock} from '@floip/flow-runner/src/model/block/ISelectOneResponseBlock'

export interface ISetContactPropertyBlockKey {
  blockId: IBlock['uuid'],
  key: SetContactProperty['property_key'],
}

export interface ISetContactPropertyBlockKeyWithValue extends ISetContactPropertyBlockKey {
  value: SetContactProperty['property_value'],
}

export const getters: GetterTree<IFlowsState, IRootState> = {
  /**
   * Get contact property element on a given index
   */
  block_getContactPropertyOnIndex: state => ({blockId, index}: {blockId: string, index: number}): SetContactProperty | undefined =>
    findBlock(blockId, state as unknown as IContext)
      .config
      ?.set_contact_property
      ?.[index],

  block_getContactPropertyValueByKey: state => ({blockId, key}: ISetContactPropertyBlockKey): string | undefined =>
    findBlock(blockId, state as unknown as IContext)
      .config
      .set_contact_property
      ?.find(({property_key}) => property_key === key)
      ?.property_value,
}

export const mutations: MutationTree<IFlowsState> = {
  /**
   * Adds a new contact_property to a specific block.
   *
   * @throws {Error} When a property with given key already exists
   */
  block_addContactProperty(state, {blockId, key, value}: ISetContactPropertyBlockKeyWithValue) {
    const block = findBlock(blockId, state as unknown as IContext)

    if (!block.config.set_contact_property) {
      block.config.set_contact_property = []
    }

    if (block.config.set_contact_property.find(({property_key}) => property_key === key)) {
      throw new Error(`set_contact_property[${key}] already exists`)
    }

    block.config.set_contact_property.push({
      property_key: key,
      property_value: value,
    })
  },

  block_removeContactProperty(state, {blockId, key}: ISetContactPropertyBlockKey) {
    const block = findBlock(blockId, state as unknown as IContext)

    block.config.set_contact_property = (block.config.set_contact_property ?? [])
      .filter(({property_key}) => property_key !== key)
  },

  block_changeContactProperty(state, {blockId, key, value: newValue}: ISetContactPropertyBlockKeyWithValue) {
    const block = findBlock(blockId, state as unknown as IContext)

    block.config.set_contact_property = (block.config.set_contact_property ?? [])
      .map(({property_key, property_value: oldValue}) => ({
        property_key,
        property_value: property_key === key ? newValue : oldValue,
      }))
  },
}

export const actions: ActionTree<IFlowsState, IRootState> = {
  /**
   * Make sure we have Array set_contact_property,
   * if it's not an array, then the mutation will set an object like {set_contact_property: {0: object1, 1: object2}} instead
   */
     block_makeSureSetContactPropertyExistsAsArray({commit, state}, {blockId}: { blockId: string}) {
      const block = findBlock(blockId, state as unknown as IContext)
      if (block.config?.set_contact_property === undefined) {
        commit('block_updateConfigByPath', {
          blockId,
          path: 'set_contact_property',
          value: [],
        })
      }
    },
    /**
     * Set contact property element on a given index
     */
    block_setContactPropertyOnIndex(
      {commit, state, dispatch},
      {blockId, index, propertyKey, propertyValue}: { blockId: string, index: number, propertyKey?: string, propertyValue?: string },
    ) {
      dispatch('block_makeSureSetContactPropertyExistsAsArray', {blockId})

      commit('block_updateConfigByPath', {
        blockId,
        path: `set_contact_property.[${index}]`,
        value: {
          property_key: propertyKey,
          property_value: propertyValue,
        },
      })
    },

    /**
     * Set contact property element's property_key on a given index
     */
    block_setContactPropertyKeyOnIndex(
      {commit, state, dispatch},
      {blockId, index, propertyKey}: { blockId: string, index: number, propertyKey?: string },
    ) {
      dispatch('block_makeSureSetContactPropertyExistsAsArray', {blockId})
      commit('block_updateConfigByPath', {
        blockId,
        path: `set_contact_property.[${index}].property_key`,
        value: propertyKey,
      })
    },

    /**
     * Set contact property element's property_value on a given index
     */
    block_setContactPropertyValueOnIndex(
      {commit, state, dispatch},
      {blockId, index, propertyValue}: { blockId: string, index: number, propertyValue: string },
    ) {
      dispatch('block_makeSureSetContactPropertyExistsAsArray', {blockId})
      commit('block_updateConfigByPath', {
        blockId,
        path: `set_contact_property.[${index}].property_value`,
        value: propertyValue,
      })
    },

  block_setContactPropertyByKey({commit, getters}, {blockId, key, value}: ISetContactPropertyBlockKeyWithValue): void {
    if (getters.block_getContactPropertyValueByKey({blockId, key}) === undefined) {
      commit('block_addContactProperty', {blockId, key, value})
    } else {
      commit('block_changeContactProperty', {blockId, key, value})
    }
  },

  block_deleteContactPropertyByKey({commit}, {blockId, key}: ISetContactPropertyBlockKey): void {
    commit('block_removeContactProperty', {blockId, key})
  },

  /**
   * update expression in property_value if a choice is renamed (and if set-contact-property is turned on)
   */
  block_updateContactPropertyAfterChoicesChange({state, commit, dispatch}, {blockId}: {blockId: IBlock['uuid']}): void {
    const block = findBlock(blockId, state as unknown as IContext)
    const propertyValueMapping = block.vendor_metadata?.floip?.ui_metadata?.set_contact_property?.property_value_mapping

    if (propertyValueMapping !== undefined) {
      dispatch('block_setContactPropertyValueOnIndex', {
        blockId,
        index: 0,
        propertyValue: choicesToExpression(block.config.choices, propertyValueMapping),
      })
    }
  },

  block_updateContactPropertyMetadataAfterNewChoiceAdded({state, commit, dispatch}, {blockId, prompt}: {blockId: IBlock['uuid'], prompt: IChoice['prompt']}): void {
    commit('block_updateVendorMetadataByPath', {
      blockId,
      path: `floip.ui_metadata.set_contact_property.property_value_mapping.${prompt}`,
      value: '',
    })
  },

  block_resetContactPropertyMetadata({state, commit, dispatch}, {blockId}: {blockId: IBlock['uuid']}): void {
    const {config: {choices}} = findBlock(blockId, state as unknown as IContext) as ISelectOneResponseBlock

    choices.forEach((choice) => {
      commit('block_updateVendorMetadataByPath', {
        blockId,
        path: `floip.ui_metadata.set_contact_property.property_value_mapping.${choice.prompt}`,
        value: '',
      })
    })
  },
}
