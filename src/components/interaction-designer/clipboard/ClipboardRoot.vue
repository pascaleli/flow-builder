<template>
  <div class="clipboard-root">
    <header class="d-flex justify-content-between">
      <h3>
        {{ 'flow-builder.clipboard-simulator' | trans }}
      </h3>
      <i
        class="glyphicon glyphicon-remove cursor-pointer align-self-center h4"
        @click="closeSimulator" />
    </header>
    <main>
      <div
        v-for="(blockData, i) in blocksData"
        :key="i"
        class="mt-2">
        <div
          class="card"
          :class="{'gray-background': !isBlockFocused(i)}">
          <div class="card-body sm-padding-below font-roboto">
            <component
              :is="blockData.prompt.config.kind"
              :context="context"
              :go-next="goNext"
              :index="i"
              :is-complete="isComplete"
              :on-edit-complete="onEditComplete">
              <template #title>
                <h4
                  v-if="!cursorChangeInProgress"
                  class="card-title font-weight-regular pl-0 text-color-title">
                  {{ blockData.prompt.block.label }}
                </h4>
              </template>
              <template #content>
                <p class="card-text">
                  {{ content(blockData.prompt.config.prompt) }}
                </p>
              </template>
            </component>
          </div>
        </div>
      </div>
      <div
        v-if="unsupportedBlockName"
        class="mt-2">
        <unsupported-block :block-name="unsupportedBlockName" />
      </div>
    </main>
    <footer
      v-if="isComplete"
      class="mt-2">
      <div class="card">
        <div class="card-body">
          <h5 class="card-title">
            {{ 'flow-builder.completed' | trans }}!
          </h5>
        </div>
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
import {
  Context, IContext,
  createContextDataObjectFor,
  FlowRunner,
  IRichCursorInputRequired,
  SupportedMode,
  IContact,
  IGroup,
  BasicBacktrackingBehaviour,
} from '@floip/flow-runner'
import {IFlowsState} from '@/store/flow'
import Component, {mixins} from 'vue-class-component'
import Lang from '@/lib/filters/lang'
import {namespace} from 'vuex-class'
import {BlocksData} from '@/store/clipboard'
import Message from './prompt-kinds/Message.vue'
import Numeric from './prompt-kinds/Numeric.vue'
import Open from './prompt-kinds/Open.vue'
import SelectOne from './prompt-kinds/SelectOne.vue'
import SelectMany from './prompt-kinds/SelectMany.vue'
import UnsupportedBlock from './shared/UnsupportedBlock.vue'

const flowVuexNamespace = namespace('flow')
const clipboardVuexNamespace = namespace('clipboard')

@Component({
  components: {
    Message,
    Numeric,
    Open,
    SelectOne,
    SelectMany,
    UnsupportedBlock,
  },
})
export default class ClipboardRoot extends mixins(Lang) {
  runner!: FlowRunner
  context!: IContext
  isComplete = false
  unsupportedBlockName = ''
  cursorChangeInProgress = false

  created(): void {
    this.initializeFlowRunner()
  }

  content(promptId: string): string | undefined {
    if (!this.cursorChangeInProgress) {
      const result = Context.prototype.getResource.call(this.context, promptId)
      return result.hasText() ? result.getText() : ''
    }
    return undefined
  }

  async initializeFlowRunner(): Promise<void> {
    const flowState = this.currentFlowsState
    const contact = {id: '1'} as IContact
    const groups: IGroup[] = []
    // TODO: fix this value when user details are available
    const userId = 'user-1234'
    const orgId = 'org-1234'
    const {flows} = flowState
    const languageId = '22'
    const mode = SupportedMode.OFFLINE
    const context: IContext = await createContextDataObjectFor(
      contact,
      groups,
      userId,
      orgId,
      flows,
      languageId,
      mode,
    )

    this.context = context
    this.runner = new FlowRunner(context)
    await this.goNext()
  }

  async goNext(): Promise<void> {
    this.isComplete = false
    try {
      const cursor: IRichCursorInputRequired | undefined = await this.runner.run()
      if (!cursor) {
        this.isComplete = true
        return
      }
      const {prompt}: IRichCursorInputRequired = cursor
      this.addToBlocksData({prompt, isFocused: true})
    } catch (e) {
      if ((e as Error).message.includes('Unable to find factory for block type')) {
        [, this.unsupportedBlockName] = e.message.split(': ')
      }
      console.warn(e.message)
    }
  }

  async onEditComplete(index: number): Promise<void> {
    this.setIsFocused({index: this.blocksData.length - 1, value: true})
    const backtracking: BasicBacktrackingBehaviour = this.runner.behaviours.basicBacktracking as BasicBacktrackingBehaviour
    const seekSteps = (this.blocksData.length - 1) - index
    this.cursorChangeInProgress = true
    const cursor = await backtracking.seek(seekSteps, this.context)
    this.cursorChangeInProgress = false
    this.removeFromBlocksData(index)
    this.addToBlocksData({prompt: cursor.prompt, isFocused: true})
  }

  closeSimulator(): void {
    this.setSimulatorActive(false)
  }

  destroyed(): void {
    this.resetBlocksData()
  }

  @flowVuexNamespace.Getter currentFlowsState!: IFlowsState

  @clipboardVuexNamespace.Getter blocksData!: BlocksData[]
  @clipboardVuexNamespace.Getter isBlockFocused!: boolean
  @clipboardVuexNamespace.Action setSimulatorActive!: (value: boolean) => void
  @clipboardVuexNamespace.Action resetBlocksData!: () => void
  @clipboardVuexNamespace.Action setIsFocused!: (data: {index: number, value: boolean}) => void
  @clipboardVuexNamespace.Action addToBlocksData!: (data: BlocksData) => void
  @clipboardVuexNamespace.Action removeFromBlocksData!: (index: number) => void
}
</script>

<style lang="scss">
.clipboard-root {
  min-height: 80vh;
}

.cursor-pointer {
  cursor: pointer;
}

.font-roboto {
  font-family: Roboto, sans-serif;
}

.gray-background {
  background-color: #F5F5F5;
}
</style>
