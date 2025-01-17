<template>
  <div
    v-if="activeFlow"
    ref="interaction-designer-contents"
    class="interaction-designer interaction-designer-contents">
    <header ref="interaction-designer-header" class="interaction-designer-header">
      <slot name="toolbar">
        <tree-builder-toolbar />
      </slot>
    </header>

    <aside
      v-if="isSimulatorActive"
      class="tree-sidebar-container"
      :class="{ 'slide-out': !$route.meta.isSidebarShown,}">
      <div
        class="sidebar-cue"
        :class="{'sidebar-close': $route.meta.isSidebarShown}"
        @click="showOrHideSidebar">
        <font-awesome-icon
          v-if="$route.meta.isSidebarShown"
          :icon="['fac', 'minimize']"
          class="fa-btn" />
        <font-awesome-icon
          v-else
          :icon="['fac', 'expand']"
          class="fa-btn" />
      </div>

      <div
        class="tree-sidebar">
        <clipboard-root />
      </div>
    </aside>

    <main class="interaction-designer-main">
      <builder-canvas
        v-if="mainComponent === 'builder'"
        :width-adjustment="builderWidthAdjustment"
        @click.native="handleCanvasSelected" />
      <resource-viewer
        v-else-if="mainComponent === 'resource-viewer'"/>
      <div v-else>
        <div class="alert alert-danger">ERROR: component '{{ mainComponent }}' is not supported</div>
      </div>
    </main>
  </div>
</template>

<script lang="ts">
import {cloneDeep, debounce, endsWith, forEach, get, includes, invoke, isEmpty, values} from 'lodash'
import {mixins} from 'vue-class-component'
import {Component, Prop, Vue, Watch} from 'vue-property-decorator'
import {Action, Getter, Mutation, namespace, State} from 'vuex-class'
import Lang from '@/lib/filters/lang'
import Routes from '@/lib/mixins/Routes'
import {scrollBehavior, scrollBlockIntoView} from '@/router/helpers'
import {store} from '@/store'
import ClipboardRoot from '@/components/interaction-designer/clipboard/ClipboardRoot.vue'
import {Route} from 'vue-router'
import {IBlock, IFlow, ILanguage, IResource, IResources, SupportedMode} from '@floip/flow-runner'
import {ErrorObject} from 'ajv'
import {MutationPayload} from 'vuex'
import {IValidationStatus} from '@/store/validation'

Component.registerHooks(['beforeRouteUpdate'])

const flowNamespace = namespace('flow')
const builderNamespace = namespace('builder')
const clipboardNamespace = namespace('clipboard')
const validationVuexNamespace = namespace('validation')

const DEBOUNCE_VALIDATION_TIMER_MS = 300

@Component({
  components: {
    ClipboardRoot,
  },
})
export class InteractionDesigner extends mixins(Lang, Routes) {
  @Prop(String) readonly id!: string
  @Prop(String) readonly mode!: string
  @Prop(String) readonly mainComponent!: string

  @Prop({
    type: Object,
    default() {
      return {}
    },
  }) readonly appConfig!: object
  @Prop({
    type: Object,
    default() {
      return {}
    },
  }) readonly builderConfig!: object

  get blocksOnActiveFlowForWatcher(): IBlock[] {
    // needed to make comparison between new & old values on watcher
    return cloneDeep(this.activeFlow?.blocks)
  }

  // ###### Validation API Watchers [
  @Watch('activeFlow', {deep: true, immediate: true})
  async onActiveFlowChanged(newFlow: IFlow): Promise<void> {
    this.debounceFlowValidation({newFlow})
  }

  @Watch('blocksOnActiveFlowForWatcher', {deep: true, immediate: true})
  async onBlocksInActiveFlowChanged(newBlocks: IBlock[], oldBlocks: IBlock[]): Promise<void> {
    this.debounceBlockValidation()
  }

  @validationVuexNamespace.Action validate_flow!: ({flow}: { flow: IFlow }) => Promise<IValidationStatus>
  debounceFlowValidation = debounce(async function (this: any, {newFlow}: {newFlow: IFlow}) {
    if (newFlow !== undefined) {
      console.debug(
        'watch/activeFlow:', 'active flow has changed', `from ${this.mainComponent}.`,
        'Validating flow & supported resources ...',
      )
      await this.validate_flow({flow: newFlow})
      await this.validate_resourcesOnSupportedValues({
        resources: newFlow.resources,
        supportedModes: this.activeFlow.supported_modes,
        supportedLanguages: this.activeFlow.languages,
      })
    } else {
      console.warn('watch/activeFlow:', 'newFlow is undefined')
    }
  }, DEBOUNCE_VALIDATION_TIMER_MS)
  @validationVuexNamespace.Action validate_allBlocksWithinFlow!: () => Promise<void>
  debounceBlockValidation = debounce(function (this: any) {
    if (this.activeFlow !== undefined) {
      console.debug('watch/activeFlow.blocks:', 'blocks inside active flow have changed', `from ${this.mainComponent}.`, 'Validating ...');
      this.validate_allBlocksWithinFlow()
    } else {
      console.warn('watch/activeFlow.blocks:', 'activeFlow is undefined')
    }
  }, DEBOUNCE_VALIDATION_TIMER_MS)
  @validationVuexNamespace.Action validate_resourcesOnSupportedValues!: (
    {resources, supportedModes, supportedLanguages}: {resources: IResource[], supportedModes: SupportedMode[], supportedLanguages: ILanguage[]}
  ) => Promise<void>

  @Watch('activeFlow.resources', {deep: true, immediate: true})
  async onResourcesOnActiveFlowChanged(newResources: IResources, oldResources: IResources): Promise<void> {
    console.debug('watch/activeFlow.resources:', 'resources inside active flow have changed', `from ${this.mainComponent}.`, 'Validating ...')
    if (this.activeFlow !== undefined) {
      await this.validate_resourcesOnSupportedValues({
        resources: newResources,
        supportedModes: this.activeFlow.supported_modes,
        supportedLanguages: this.activeFlow.languages,
      })
    } else {
      console.warn('watch/activeFlow.resources:', 'activeFlow is undefined')
    }
  }
  // ] ######### end Validation API Watchers

  toolbarHeight = 102
  // TODO: Move this to BlockClassDetails spec // an inversion can be "legacy types"
  pureVuejsBlocks = [
    'CallBackWithCallCenterBlock',
    'CollaborativeFilteringQuestionBlock',
    'CollaborativeFilteringRatingBlock',
    'CollaborativeFilteringRatioBranchBlock',
    'CreateSubscriberBlock',
    'CurrentTimeBranchBlock',
    'DirectorySelectionBlock',
    'EntitySelectionBlock',
    'GenerateCodeBlock',
    'GroupPropertyBlock',
    'SubscriberPropertiesSnapshotBlock',
    'SubscriberPropertyBlock',
    'SummaryBlock',
    'ValidateCodeBlock',
    'WebhookBlock',
    'WebhookContentBlock',
    'RecordGroupMessageBlock',
    'PlayGroupMessageBlock',
  ]
  simulateClipboard = true

  @Getter isConfigured!: boolean
  @Getter selectedBlock?: IBlock
  @Getter hasChanges!: boolean
  @Getter hasIssues!: boolean
  @Getter isTreeSaving!: boolean
  @Getter isTreeValid!: boolean
  @Getter jsonValidationResults?: ErrorObject
  @Getter validationResults?: ErrorObject
  @Getter builderWidthAdjustment!: number

  // TODO: We'll need to do width as well and use margin-right:365 to allow for sidebar
  @State(({trees: {tree, ui}}) => ui.designerWorkspaceHeight) designerWorkspaceHeight!: number
  @State(({trees: {tree, ui}}) => tree) tree: unknown
  @State(({trees: {tree, ui}}) => !(tree.blocks.length as number)) validationResultsEmptyTree!: boolean
  @State(({trees: {tree}}) => tree.details.hasVoice) hasVoice?: boolean
  @State(({trees: {tree}}) => tree.details.hasSms) hasSms?: boolean
  @State(({trees: {tree}}) => tree.details.hasUssd) hasUssd?: boolean
  @State(({trees: {tree}}) => tree.details.hasSocial) hasSocial?: boolean
  @State(({trees: {tree}}) => tree.details.hasClipboard) hasClipboard?: boolean
  @State(({trees: {ui}}) => ui.blockClasses) blockClasses!: Record<string, any>

  @flowNamespace.Getter activeFlow?: IFlow
  @builderNamespace.State activeMainComponent?: string
  @builderNamespace.Getter activeBlock?: IBlock
  @builderNamespace.Getter isEditable!: boolean
  @builderNamespace.Getter hasFlowChanges!: boolean
  @builderNamespace.Getter isBuilderCanvasEnabled!: boolean
  @builderNamespace.Getter isResourceViewerCanvasEnabled!: boolean
  @clipboardNamespace.Getter isSimulatorActive!: boolean

  get jsKey(): string {
    return get(this.selectedBlock, 'jsKey')
  }

  // Pure VueJS block types handle readonly mode on their own
  isPureVueBlock(): boolean {
    return includes(this.pureVuejsBlocks, get(this.selectedBlock, 'type'))
  }

  async beforeCreate(): Promise<void> {
    const {$store} = this

    forEach(store.modules, (v, k) => !$store.hasModule(k) && $store.registerModule(k, v))
  }

  // `this.mode` comes from captured param in js-routes
  @Watch('mode')
  onModeChanged(newMode: string): void {
    this.updateIsEditableFromParams(newMode)
  }
  @Watch('mainComponent')
  onMainComponentChanged(newMainComponent: string): void {
    this.setActiveMainComponent({mainComponent: newMainComponent})
  }
  @builderNamespace.Mutation setActiveMainComponent!: ({mainComponent}: {mainComponent: string | undefined}) => void

  activated(): void {
    // todo: remove once we have jsKey in our js-route
    this.deselectBlocks()
  }

  created(): void {
    if ((!isEmpty(this.appConfig) && !isEmpty(this.builderConfig)) || !this.isConfigured) {
      this.configure({appConfig: this.appConfig, builderConfig: this.builderConfig})
    }

    // Initialize global reference for legacy + debugging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).builder = this

    // Listen to Flow updates to maintain "hasFlowChanges" state
    this.$store.subscribe(this.handleFlowChanges.bind(this))

    this.initializeTreeModel()

    // `this.mode` comes from captured param in js-routes
    this.updateIsEditableFromParams(this.mode)
    this.setActiveMainComponent({mainComponent: this.mainComponent})
  }

  /** @note - mixin's mount() is called _before_ local mount() (eg. InteractionDesigner.legacy::mount() is 1st) */
  async mounted(): Promise<void> {
    window.addEventListener('scroll', this.onScroll, true)

    //Ensure that the blocks are installed before activating the flow
    //Block stores are needed to ensure validations can run immediately
    await this.registerBlockTypes()
    this.flow_setActiveFlowId({flowId: this.id})

    // if nothing was found for the flow Id
    if (!this.activeFlow) {
      this.flow_setActiveFlowId({flowId: null})
      await this.$router.replace(
        {
          path: this.route('flows.fetchFlow', {flowId: this.id}),
          query: {nextUrl: this.$route.fullPath},
        },
      )
    }

    if (this.isBuilderCanvasEnabled) {
      this.deselectBlocks()
      this.discoverTallestBlockForDesignerWorkspaceHeight({aboveTallest: true})

      setTimeout(() => {
        const {blockId, field} = this.$route.params
        if (blockId) {
          this.activateBlock({blockId})
          scrollBlockIntoView(blockId)
        }
        if (field) {
          scrollBehavior(this.$route)
        }
        if (this.$route.meta?.isBlockEditorShown as boolean) {
          this.setIsBlockEditorOpen(true)
        }
      }, 500)
    }
    console.debug('Vuej tree interaction designer mounted!')
  }

  beforeDestroy() {
    window.removeEventListener('scroll', this.onScroll, true)
  }

  onScroll(e) {
    if (this.isBuilderCanvasEnabled) {
      // will be used to set other elements' position in the canvas (eg: for block editor)
      if (this.$refs['interaction-designer-header'] !== undefined) {
        this.setInteractionDesignerHeaderBoundingClientRect((this.$refs['interaction-designer-header'] as Element).getBoundingClientRect())
      }
    }
  }

  @Watch('$route', {deep: true})
  handleRouteUpdate(to: Route): void {
    this.activateBlock({blockId: to.params.blockId || null})
    if (to.meta?.isBlockEditorShown as boolean) {
      scrollBlockIntoView(to.params.blockId)
      this.setIsBlockEditorOpen(true)
    }
  }

  @Mutation configure!: ({appConfig, builderConfig}: {appConfig: object, builderConfig: object}) => void
  @Mutation deselectBlocks!: () => void
  @builderNamespace.Mutation activateBlock!: ({blockId}: {blockId: IBlock['uuid'] | null}) => void
  @builderNamespace.Mutation setIsBlockEditorOpen!: (value: boolean) => void
  @builderNamespace.Mutation setInteractionDesignerHeaderBoundingClientRect!: (value: DOMRect) => void
  @builderNamespace.Action setIsEditable!: (arg0: boolean) => void
  @builderNamespace.Action setHasFlowChanges!: (arg0: boolean) => void
  @flowNamespace.Mutation flow_setActiveFlowId!: ({flowId}: {flowId: string | null}) => void
  @Action attemptSaveTree!: () => void
  @Action discoverTallestBlockForDesignerWorkspaceHeight!: ({buffer, aboveTallest}: {buffer?: number, aboveTallest: boolean}) => void
  @Action initializeTreeModel!: () => void

  async registerBlockTypes(): Promise<void[]> {
    const {blockClasses} = this

    const blockInstallers = values(blockClasses).map(async (blockClass) => {
      const type = blockClass.type
      const normalizedType = type.replace('.', '_')
      const typeWithoutSeparators = type.replace('.', '')
      let {uiComponent} = blockClass
      if (blockClass.install === undefined) {
        // noinspection TypeScriptCheckImport
        const exported = await import(`../components/interaction-designer/block-types/${normalizedType}Block.vue`)
        blockClass.install = exported.install
        uiComponent = exported.default
      }
      invoke(blockClass, 'install', this)
      Vue.component(`Flow${typeWithoutSeparators}`, uiComponent)
    })
    return Promise.all(blockInstallers)
  }

  handleCanvasSelected({target}: {target: Element}): void {
    if (!target.classList.contains('builder-canvas')) {
      console.debug('InteractionDesigner', 'Non-canvas selection mitigated')
      return
    }
    this.setIsBlockEditorOpen(false)
    this.replaceRouteInHistory(this.$route.meta?.isFlowEditorShown as boolean ? 'flow-details' : 'flow-canvas')
  }

  updateIsEditableFromParams(mode: string): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isEditableLocked = Boolean((global as any).app.ui.isEditableLocked)
    const isEditable = Boolean(+this.discoverIsEditableFrom(mode, this.$route.hash, isEditableLocked))
    this.setIsEditable(isEditable)
  }

  /** --------------------------------| has-editable-locked | not-editable-locked |
   | mode-is-absent+view-url-suffix   |        0            |     0               |
   | mode-is-absent+edit-url-suffix   |        0 (r=>view)  |     1               |
   | mode-is-absent+absent-url-suffix |        0 (r=>view)  |     0 (r=>view)     | <- Equivalent to /view
   | mode-is-view                     |        0            |     0               |
   | mode-is-view+edit-url-suffix     |        0            |     0               |
   | mode-is-edit                     |        0 (r=>view)  |     1               |
   | mode-is-edit+view-url-suffix     |        0 (r=>view)  |     1               |
   ------------------------------------------------------------------------------ */
  discoverIsEditableFrom(mode: string, hash: string, isEditableLocked: boolean): boolean {
    return !isEditableLocked && (
      mode === 'edit' || (!mode && endsWith(hash, '/edit'))
    )
  }

  showOrHideSidebar(): void {
    //TODO with simulator work
    // this.replaceRoute(this.$route.meta.isSidebarShown ? 'flow-canvas' : '???')
  }

  replaceRouteInHistory(name: string): void {
    // VueRouter doesn't have typed .history but actually has it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.$router as any).history.replace({
      name,
    })
  }

  handleFlowChanges({type, payload}: MutationPayload): void {
    // We overwrite flow container after saving, reset change state
    if (type === 'flow/flow_setFlowContainer') {
      this.setHasFlowChanges(false)
      return
    }

    // Consider changing block positoin a flow change
    if (type === 'builder/setBlockPositionTo') {
      this.setHasFlowChanges(true)
      return
    }

    // Only consider flow mutations
    if (type.startsWith('flow/') === false) {
      return
    }

    // Mutations that does not change flow data
    if (![
      'flow/flow_updateCreatedState',
      'flow/flow_setActiveFlowId',
    ].includes(type)) {
      this.setHasFlowChanges(true)
    }
  }
}

export default InteractionDesigner
</script>

<style lang="scss"> @import '../css/customized/vue-multiselect.css';</style>
<style lang="scss">
  $sidebar-width: 365px;

  .interaction-designer-contents {
    min-height: 100vh;
    display:inline-block;
    margin: 0;
    padding: 0;
  }

  .interaction-designer-header {
    width: 100vw;
    position: sticky;
    top: 0;
    left: 0;
    display:inline-block;
    z-index: 4*10;
    margin-right: -100%;
  }

  .viamo-app-container .interaction-designer-header {
    margin-left: -100px;
  }

  .tree-sidebar-container {
    position: fixed;
    right: 0;
    top: 62px;
    z-index: 5*10;

    height: 100vh;
    width: $sidebar-width;
    overflow-y: scroll;

    padding: 1em;
    transition: right 200ms ease-in-out;

    .tree-sidebar {
      background-color: white;
      border: 1px solid #D6D0D0;
      border-radius: 0.3em;
      box-shadow: 0 3px 6px #CACACA;

      padding: 1em;
      margin-top: 2em;

      transition:
        200ms background-color ease-in-out,
        200ms border-color ease-in-out,
        200ms border-radius ease-in-out;
    }

    &.slide-out {
      right: -$sidebar-width;
    }
  }

  .sidebar-cue {
    cursor: pointer;
    background-color: #eee;
    padding: 5px;
    position: fixed;
    margin-top: 2em;
    right: 0;
  }

  .sidebar-close {
    right: 350px;
  }

  .interaction-designer-main {
    flex: 1;
  }

</style>
