<template>
  <!--Resource editors grouped by mode (channel)-->
  <div
    v-if="resource"
    class="per-mode-resource-editor-row d-flex flex-wrap">
    <div
      v-for="({id: languageId, label: language}) in languages"
      :key="languageId"
      class="col-3">
      <header class="d-flex">
        <div class="mr-auto">
          {{ language || trans('flow-builder.unknown-language') }}
        </div>
      </header>

      <resource-editor-cell
        v-for="contentType in discoverContentTypesFor(mode)"
        :key="contentType"
        :block="block"
        :content-type="contentType"
        :language-id="languageId"
        :mode="mode"
        @change="$emit('change')" />
    </div>
  </div>
</template>

<script lang="ts">
import {Component, Prop} from 'vue-property-decorator'
import {mixins} from 'vue-class-component'
import Lang from '@/lib/filters/lang'
import Permissions from '@/lib/mixins/Permissions'
import Routes from '@/lib/mixins/Routes'
import FlowUploader from '@/lib/mixins/FlowUploader'
import {namespace} from 'vuex-class'
import {IBlock, IFlow, ILanguage, IResource} from '@floip/flow-runner'
import {discoverContentTypesFor} from '@/store/flow/utils/resourceHelpers'
import {orderLanguages} from '@/store/flow/flow'

const flowVuexNamespace = namespace('flow')
const builderVuexNamespace = namespace('builder')

@Component({})
export class PerModeResourceEditorRow extends mixins(FlowUploader, Permissions, Routes, Lang) {
  @Prop({required: true}) block!: IBlock
  @Prop({required: true}) mode!: string

  discoverContentTypesFor = discoverContentTypesFor
  @flowVuexNamespace.Getter resourcesByUuidOnActiveFlow!: { [key: string]: IResource }
  @flowVuexNamespace.Getter activeFlow!: IFlow

  get resource(): IResource {
    return this.resourcesByUuidOnActiveFlow[this.block.config.prompt]
  }

  get languages(): ILanguage[] {
    return orderLanguages(this.activeFlow.languages ?? [])
  }
}
export default PerModeResourceEditorRow
</script>
