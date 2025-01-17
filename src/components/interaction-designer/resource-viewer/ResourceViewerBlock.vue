<template>
  <div class="resource-viewer-block border p-2">
    <div class="block-header-1 d-flex">
      <div class="mr-auto text-primary">
        <h5>{{ blockLabel }}</h5>
      </div>
      <div class="ml-auto">
        <h6>{{ trans(`flow-builder.${block.type}`).toUpperCase() }}</h6>
      </div>
    </div>
    <div class="block-content">
      <fieldset :disabled="!isEditable">
        <div class="d-flex flex-wrap">
          <simplified-name-editor
            :block="block"
            class="col-lg-3 col-sm-6 col-xs-12 p-0"
            @change="$emit('change')" />
          <div
            v-if="!hasContent"
            class="col-lg-3 col-sm-6 col-xs-12 pl-1 mb-3">
            <div class="badge badge-info">
              {{ trans('flow-builder.no-content-block-info') }}
            </div>
          </div>
          <slot
            name="tags"
            :block="block" />
        </div>
        <div v-if="hasContent">
          <per-mode-resource-editor
            :block="block"
            @change="$emit('change')" />
        </div>
      </fieldset>
    </div>
  </div>
</template>

<script lang="ts">
import {IBlock} from '@floip/flow-runner'
import {lang} from '@/lib/filters/lang'
import {mapGetters} from 'vuex'
import {PropType} from 'vue'

export default {
  name: 'ResourceViewerBlock',
  mixins: [lang],
  props: {
    block: {
      required: true,
      type: Object as PropType<IBlock>,
    },
  },
  computed: {
    ...mapGetters('flow', ['block_classesConfig']),
    ...mapGetters('builder', ['isEditable']),
    blockLabel() {
      return this.block.label > '' ? this.block.label : lang.trans('flow-builder.untitled-block')
    },
    hasContent() {
      return this.block.config.prompt !== undefined
    },
  },
}
</script>

<style scoped>
.resource-viewer-block {
  border: 1px solid #dee2e6 !important;
  margin-top: -1px;
}
</style>
